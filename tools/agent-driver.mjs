#!/usr/bin/env node
// Zero-dependency Chrome DevTools Protocol driver for The Last Way Out's
// opt-in dev harness (?dev=1). Lets an AI agent SEE, WATCH, INTERACT,
// CONTROL and PLAY the game, and collect bug evidence.
//
// Usage (from the project root):
//   node tools/agent-driver.mjs targets
//   node tools/agent-driver.mjs navigate 'http://127.0.0.1:3000/?dev=1&ch=0&auto=1&fast=6'
//   node tools/agent-driver.mjs state
//   node tools/agent-driver.mjs checks
//   node tools/agent-driver.mjs report
//   node tools/agent-driver.mjs events 50
//   node tools/agent-driver.mjs cmd play 0 b
//   node tools/agent-driver.mjs press KeyW 1200
//   node tools/agent-driver.mjs screenshot shots/ch1.png
//   node tools/agent-driver.mjs run tools/scenarios/smoke.json
//   node tools/agent-driver.mjs issue "bike gets stuck at camp"
//   node tools/agent-driver.mjs analyze
//   node tools/agent-driver.mjs issues
//   node tools/agent-driver.mjs save-issues fixNeeded.txt
//
// Env: CDP_ENDPOINT (default http://127.0.0.1:9222)
// Output is JSON on stdout (one object), so agents can parse it directly.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const ENDPOINT = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222'
const [cmd, ...args] = process.argv.slice(2)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function targets() {
  const res = await fetch(`${ENDPOINT}/json/list`)
  if (!res.ok) throw new Error(`CDP endpoint ${ENDPOINT} returned ${res.status}`)
  return (await res.json()).filter(t => t.type === 'page')
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.pending = new Map()
    this.id = 0
  }
  ready() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  start() {
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id); this.pending.delete(msg.id)
        if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result)
      }
    })
  }
  close() { try { this.ws.close() } catch (e) {} }
}

async function connect(index = 0) {
  const list = await targets()
  if (!list.length) throw new Error('no page targets on CDP endpoint')
  const t = list[index]
  const c = new CDP(t.webSocketDebuggerUrl)
  c.start(); await c.ready()
  c.target = t
  return c
}

async function evaluate(c, expression) {
  const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception?.description || ''))
  return r.result.value
}

const VK = (() => {
  const m = { Space: 32, Shift: 16, Control: 17, Alt: 18, Enter: 13, Backspace: 8, Escape: 27, Tab: 9 }
  for (let i = 0; i < 26; i++) m['Key' + String.fromCharCode(65 + i)] = 65 + i
  for (let i = 0; i < 10; i++) m['Digit' + i] = 48 + i
  for (let i = 1; i <= 12; i++) m['F' + i] = 111 + i
  return m
})()
function keyInfo(k) {
  if (VK[k] !== undefined) {
    const letter = /^Key([A-Z])$/.exec(k)
    return { key: letter ? letter[1].toLowerCase() : (k === 'Space' ? ' ' : k), code: k, windowsVirtualKeyCode: VK[k], nativeVirtualKeyCode: VK[k] }
  }
  return { key: k, code: k, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0 }
}
async function press(c, k, holdMs = 0) {
  const info = keyInfo(k)
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', ...info, text: info.key.length === 1 ? info.key : undefined })
  if (holdMs > 0) await sleep(holdMs)
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...info })
  return `pressed ${k}${holdMs ? ` for ${holdMs}ms` : ''}`
}

async function screenshot(c, file) {
  const r = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (file) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, Buffer.from(r.data, 'base64')) }
  return { file: file || null, bytes: Buffer.from(r.data, 'base64').length }
}

async function runScenario(c, file) {
  const steps = JSON.parse((await import('node:fs')).readFileSync(file, 'utf8'))
  const results = []
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    let out = null
    try {
      if (s.cmd) out = await evaluate(c, `window.__dev.cmd(${JSON.stringify(s.cmd)}, ...${JSON.stringify(s.args || [])})`)
      else if (s.eval) out = await evaluate(c, s.eval)
      else if (s.press) out = await press(c, s.press, s.ms || 0)
      else if (s.click) out = await evaluate(c, `(()=>{const e=document.querySelector(${JSON.stringify(s.click)});if(!e)return 'NO ELEMENT';e.click();return 'clicked'})()`)
      else if (s.navigate) { await c.send('Page.navigate', { url: s.navigate }); out = `navigated ${s.navigate}` }
      else if (s.wait) { await sleep(s.wait); out = `waited ${s.wait}ms` }
      else if (s.screenshot) out = await screenshot(c, s.screenshot)
      else if (s.check) {
        const rep = await evaluate(c, 'window.__dev.report()')
        const hit = rep.checks.find(x => x.name === s.check)
        out = hit || { name: s.check, ok: false, detail: 'check not found' }
      }
      if (s.after !== false) {
        const st = await evaluate(c, 'window.__dev.state()')
        results.push({ step: i + 1, action: Object.keys(s)[0], ok: true, out, state: { level: st.level, goal: st.goal, errors: st.errorCount } })
      } else results.push({ step: i + 1, ok: true, out })
    } catch (e) {
      results.push({ step: i + 1, action: Object.keys(s)[0], ok: false, error: String(e.message || e) })
    }
  }
  const report = await evaluate(c, 'window.__dev.report()').catch(e => ({ error: String(e) }))
  const failed = results.filter(r => !r.ok).length
  const checkFails = (report.checks || []).filter(x => !x.ok)
  const summary = {
    scenario: file, steps: results.length, failedSteps: failed,
    failedChecks: checkFails, errors: (report.errors || []).slice(-20),
    verdict: failed === 0 && checkFails.length === 0 && (report.errors || []).length === 0 ? 'PASS' : 'BUGS_FOUND',
    results
  }
  const outFile = file.replace(/\.json$/i, '.report.json')
  writeFileSync(outFile, JSON.stringify(summary, null, 2))
  return { ...summary, reportFile: outFile }
}

async function main() {
  if (!cmd || cmd === 'help') {
    return { usage: 'targets | navigate <url> | state | checks | report | events [n] | errors | dom | cmd <name> [args...] | press <key> [ms] | screenshot <file> | eval <expr> | run <scenario.json> | issue <text> | analyze | issues | chat | save-issues [file]', endpoint: ENDPOINT }
  }
  if (cmd === 'targets') return await targets()
  const c = await connect()
  try {
    switch (cmd) {
      case 'eval': return { value: await evaluate(c, args.join(' ')) }
      case 'state': return await evaluate(c, 'window.__dev.state()')
      case 'checks': return await evaluate(c, 'window.__dev.checks()')
      case 'report': return await evaluate(c, 'window.__dev.report()')
      case 'events': return await evaluate(c, `window.__dev.events(${+args[0] || 30})`)
      case 'errors': return await evaluate(c, 'window.__dev.errors()')
      case 'dom': return await evaluate(c, 'window.__dev.dom()')
      case 'issues': return await evaluate(c, 'window.__dev.issues()')
      case 'chat': return await evaluate(c, 'window.__dev.chat.list()')
      case 'issue': return { result: await evaluate(c, `window.__dev.cmd('issue', ${JSON.stringify(args.join(' '))})`) }
      case 'analyze': return { result: await evaluate(c, `window.__dev.cmd('analyze')`) }
      case 'save-issues': {
        const text = await evaluate(c, 'window.__dev.chatText()')
        const file = args[0] || 'fixNeeded.txt'
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, text, 'utf8')
        const count = (text.match(/^## \[/gm) || []).length
        return { file, bytes: Buffer.byteLength(text), entries: count, written: true }
      }
      case 'help': return await evaluate(c, 'window.__dev.cmd("help")')
      case 'cmd': return { result: await evaluate(c, `window.__dev.cmd(${JSON.stringify(args[0])}, ...${JSON.stringify(args.slice(1))})`) }
      case 'press': return { result: await press(c, args[0], +args[1] || 0) }
      case 'combo': {
        const keys = String(args[0]).split('+').map(k => k.trim())
        const shift = keys.some(k => k.startsWith('Shift'))
        const mod = shift ? { modifiers: 8, shiftKey: true } : {}
        for (const k of keys) await c.send('Input.dispatchKeyEvent', { type: 'keyDown', ...keyInfo(k), ...mod })
        await sleep(1200) // hold long enough for a game frame to observe the modifier
        for (const k of [...keys].reverse()) await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...keyInfo(k), modifiers: 0, shiftKey: false })
        return { result: 'pressed ' + args[0] }
      }
      case 'screenshot': return await screenshot(c, args[0])
      case 'navigate': { await c.send('Page.navigate', { url: args[0] }); await sleep(1500); return { url: args[0] } }
      case 'run': return await runScenario(c, args[0])
      default: throw new Error('unknown command: ' + cmd)
    }
  } finally { c.close() }
}

main().then(v => console.log(JSON.stringify(v, null, 2))).catch(e => {
  console.log(JSON.stringify({ error: String(e.message || e), endpoint: ENDPOINT }, null, 2))
  process.exitCode = 1
})
