// AI-AGENT DEV HARNESS — opt-in only, loaded when the URL has ?dev=1.
// Gives an agent (or a human dev) SEE / WATCH / INTERACT / CONTROL / PLAY:
//   - a structured state snapshot (window.__dev.state)
//   - a ring-buffer event log incl. errors, unhandled rejections, resource failures
//   - invariant checks that surface bugs (NaN, missing level, render failure, stuck run)
//   - commands to drive the story, teleport, set flags/moods, autoplay and speed
//   - a small visible HUD so state is readable in screenshots
// Nothing in here is loaded during normal play.

import { G } from '../game.js'
import { horror } from '../core/horror.js'
import { items } from '../core/items.js'
import { startCrash } from '../core/roam.js'
import chat from './chat.js'

const QS = new URLSearchParams(location.search)
if (QS.has('ch')) G._devChapter = +QS.get('ch')

const MAX_EVENTS = 400
const events = []
let seq = 0
let hudEl = null

// Independent frame-rate tracker: G._fps only updates while the F3 overlay is open.
let _fps = 60, _frames = 0, _fpsT = performance.now()
function frameTick() {
  _frames++
  const t = performance.now()
  if (t - _fpsT >= 500) { _fps = _frames * 1000 / (t - _fpsT); _frames = 0; _fpsT = t }
  requestAnimationFrame(frameTick)
}
requestAnimationFrame(frameTick)

function log(type, data = {}) {
  const ev = { n: ++seq, t: Date.now(), type, ...data }
  events.push(ev)
  if (events.length > MAX_EVENTS) events.shift()
  try { window.dispatchEvent(new CustomEvent('dev-event', { detail: ev })) } catch (e) {}
  return ev
}

// ---- error / warning capture ------------------------------------------------
window.addEventListener('error', (e) => {
  const src = e.target && (e.target.src || e.target.href)
  if (src) log('resource-error', { src: String(src).slice(0, 200) })
  else log('page-error', { message: e.message || '', src: e.filename || '', line: e.lineno || 0 })
}, true)
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason
  log('rejection', { message: String((r && r.message) || r || '') .slice(0, 300) })
})
const _consoleError = console.error.bind(console)
console.error = (...a) => {
  try { log('console-error', { message: a.map(x => (x && x.message) || String(x)).join(' ').slice(0, 300) }) } catch (e) {}
  _consoleError(...a)
}

// ---- state snapshot ---------------------------------------------------------
function num(v) { return typeof v === 'number' ? (Number.isFinite(v) ? +v.toFixed(3) : String(v)) : v }
function state() {
  const p = G.player || {}, cam = G.camera || {}, r = G.renderer && G.renderer.info && G.renderer.info.render
  const sc = G.scooter
  return {
    ready: !!G.renderer, running: !!G.running, paused: !!G.paused, stopped: !!G.stopped,
    level: G.level ? G.level.name : null,
    clock: num(G.time), chapter: G._devChapter ?? null,
    player: { x: num(p.pos && p.pos.x), z: num(p.pos && p.pos.z), yaw: num(p.yaw), mode: p.mode || 'walk', crouch: num(p.crouch) },
    camera: { x: num(cam.position && cam.position.x), y: num(cam.position && cam.position.y), z: num(cam.position && cam.position.z) },
    scooter: sc ? { x: num(sc.chassis.position.x), z: num(sc.chassis.position.z), speed: num(sc.speed), parked: !!sc.parked } : null,
    goal: G.goal ? (G.goal.label || 'goal') : null,
    interacts: (G.interacts || []).map(i => i.label || 'interact'),
    fear: num(G.fear), tired: num(p.tired),
    flags: { ...(G.flags || {}) },
    render: r ? { calls: r.calls, triangles: r.triangles } : null,
    fps: +_fps.toFixed(1),
    horror: { value: +(horror.value || 0).toFixed(2), level: horror.level || null, figures: horror.figures.filter(f => f.group.visible).length },
    autoplay: !!G.auto, fastSim: G.fastSim || 0,
    eventCount: events.length,
    errorCount: events.filter(e => /error|rejection/.test(e.type)).length
  }
}

// ---- automated bug checks ---------------------------------------------------
function checks() {
  const s = state(), out = []
  const add = (name, ok, detail) => out.push({ name, ok: !!ok, detail })
  add('renderer-ready', s.ready, 'WebGL2 renderer created')
  add('no-page-errors', s.errorCount === 0, `${s.errorCount} error/rejection events`)
  const finite = (v) => typeof v === 'number' || (typeof v === 'string' && Number.isFinite(+v))
  add('player-position-finite', finite(s.player.x) && finite(s.player.z), JSON.stringify(s.player))
  add('camera-position-finite', finite(s.camera.x) && finite(s.camera.y) && finite(s.camera.z), JSON.stringify(s.camera))
  if (s.scooter) add('scooter-state-finite', finite(s.scooter.x) && finite(s.scooter.z) && finite(s.scooter.speed), JSON.stringify(s.scooter))
  if (s.running) add('draw-calls-positive', !s.render || s.render.calls > 0, JSON.stringify(s.render))
  if (s.running && !s.fastSim) add('fps-reasonable', _fps > 5, `fps ${_fps.toFixed(1)} (measured independently of the F3 overlay)`)
  if (s.ready) add('level-loaded', !!s.level, String(s.level))
  const stuck = G._devStuck
  if (stuck) add('not-stuck', !stuck, `no progress for ${stuck}s`)
  return out
}

// ---- commands ---------------------------------------------------------------
const commands = {
  help: () => ({ commands: Object.keys(commands), api: Object.keys(dev) }),
  chapter: (i = 0) => { G._devChapter = +i; if (typeof window.__startGame === 'function') { window.__startGame(+i); return `started chapter ${i}` } return 'no startGame' },
  play: (i = 0, branch) => {
    if (branch === 'b' || branch === 'B') { G.auto = true; G.autoPick = 1 }
    if (branch === 'c' || branch === 'C') { G.auto = true; G.autoPick = 2 }
    G._devChapter = +i
    if (typeof window.__startGame === 'function') window.__startGame(+i)
    return `playing chapter ${i}${branch ? ' branch ' + branch : ''}`
  },
  flag: (k, v = true) => { G.flags = G.flags || {}; G.flags[k] = v; return `flag ${k}=${v}` },
  teleport: (x, z, yaw) => { G.teleportPlayer(+x, +z, yaw === undefined ? undefined : +yaw); return `teleported ${x},${z}` },
  time: (h) => { G.setClock(+h, false, true); return `clock ${h}` },
  mood: (name) => { G.env.set(String(name)); return `mood ${name}` },
  item: (name) => { G[name] = true; return `gave ${name}` },
  speed: (n = 0) => { G.fastSim = +n; return `fastSim ${G.fastSim}` },
  auto: (on = true) => { G.auto = !!on; return `autoplay ${G.auto}` },
  pause: (on = true) => { G.paused = !!on; return `paused ${G.paused}` },
  skip: () => { const n = (G.interacts || []).length; G.interacts.forEach(i => i.res && i.res()); return `resolved ${n} interacts` },
  toast: (msg) => { const t = document.getElementById('toast'); if (t) { t.textContent = String(msg); t.classList.add('show') } return 'ok' },
  issue: (text) => { chat.agent(String(text), { kind: 'issue' }); return `agent issue queued: ${String(text).slice(0, 60)}` },
  agent: (text) => { chat.agent(String(text)); return `agent note: ${String(text).slice(0, 60)}` },
  analyze: () => { const m = chat.analyze(); return m ? m.text : 'no report' },
  'chat-toggle': () => `chat ${chat.toggle() ? 'open' : 'closed'}`,
  'chat-clear': () => { chat.clear(); return 'chat cleared' },
  scare: (kind, i) => { horror.scare(kind || 'sting', i || 1); return 'scare ' + (kind || 'sting') },
  apparition: (kind, dist) => { horror.apparition(kind || 'shadow', { dist: +(dist || 10) }); return 'apparition ' + (kind || 'shadow') },
  crash: (offroad) => { G.player.canMove = true; const p = G.player.pos; if (offroad) p.set(400, 0, 40); startCrash(G, { x: p.x, y: 0, z: p.z }); return G.pit ? G.pit.kind : 'no crash' },
  reset: () => { location.reload(); return 'reloading' }
}

// ---- public API -------------------------------------------------------------
const dev = {
  version: '1.0.0',
  state,
  events: (n = 30) => events.slice(-Math.max(1, +n || 30)),
  errors: () => events.filter(e => /error|rejection/.test(e.type)),
  checks,
  report: () => ({ state: state(), checks: checks(), errors: dev.errors(), recent: events.slice(-15) }),
  cmd: (name, ...args) => {
    const fn = commands[name]
    if (!fn) throw new Error('unknown dev command: ' + name)
    const res = fn(...args)
    log('command', { name, args, result: String(res).slice(0, 120) })
    return res
  },
  chat,
  horror,
  items,
  stations: () => items.all().map(t => ({ kind: t.hook ? 'hook' : t.helmet ? 'rack' : 'table', x: +t.x.toFixed(2), z: +t.z.toFixed(2), label: items.label(G, t), keyOn: t.keyOn })),
  scare: (kind, intensity) => horror.scare(kind || 'sting', intensity || 1),
  apparition: (kind, dist) => horror.apparition(kind || 'shadow', { dist: dist || 10 }),
  issues: () => chat.issues(),
  chatText: () => chat.fileText(),
  screenshot: () => { try { return G.canvas.toDataURL('image/png') } catch (e) { return null } },
  dom: () => {
    const pick = (id) => {
      const e = document.getElementById(id)
      if (!e) return null
      let n = e
      while (n) { if (n.classList && n.classList.contains('hidden')) return null; n = n.parentElement }
      if (id === 'objective' && !e.classList.contains('show')) return null
      const txt = (e.textContent || '').trim()
      return txt ? txt.slice(0, 300) : null
    }
    return { subs: pick('subs'), objective: pick('objective'), prompt: pick('prompt'), toast: pick('toast'), title: pick('title') }
  },
  commands
}
window.__dev = dev
log('harness-ready', { version: dev.version })

// ---- visible HUD (readable in screenshots) ----------------------------------
function makeHud() {
  hudEl = document.createElement('div')
  hudEl.id = 'dev-hud'
  hudEl.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;max-width:390px;padding:6px 8px;background:rgba(0,0,0,.82);color:#9fe0a0;font:11px/1.35 monospace;white-space:pre-wrap;border:1px solid #39553a;pointer-events:none;border-radius:4px'
  document.body.appendChild(hudEl)
}
if (document.body) makeHud(); else addEventListener('DOMContentLoaded', makeHud)

// ---- periodic sampling: level changes, HUD refresh, stuck detection --------
let lastLevel = null, lastPos = null, lastActivity = null, stillFor = 0
setInterval(() => {
  const s = state()
  if (s.level && s.level !== lastLevel) { lastLevel = s.level; log('level', { name: s.level }) }
  if (s.goal && G._devGoal !== s.goal) { G._devGoal = s.goal; log('goal', { label: s.goal }) }
  if (s.running && s.level) {
    const p = s.player
    // Story activity (dialogue, new goal, interaction, timer) means standing
    // still is intended — do not report that as "stuck".
    const sub = document.getElementById('subs-hi')
    const activity = [s.level, s.goal, s.interacts.length, (G.timers || []).length, (G.untils || []).length, sub && sub.textContent].join('|')
    if (activity !== lastActivity) { lastActivity = activity; stillFor = 0 }
    if (lastPos && Math.hypot(p.x - lastPos.x, p.z - lastPos.z) < 0.05) stillFor += 0.5; else stillFor = 0
    lastPos = p
    G._devStuck = stillFor >= 45 ? stillFor : 0
  }
  if (hudEl) {
    const err = dev.errors().slice(-2).map(e => `${e.type}: ${(e.message || e.result || '').slice(0, 48)}`).join('\n')
    hudEl.textContent = `[DEV] ${s.level || 'menu'}  t=${s.clock}  ${s.running ? 'RUN' : 'IDLE'}\npos ${s.player.x},${s.player.z} yaw ${s.player.yaw}  goal ${s.goal || '-'}\ninteracts ${s.interacts.length}  fear ${s.fear}  err ${s.errorCount}\n${err}`
  }
}, 500)
