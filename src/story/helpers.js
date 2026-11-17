// Story helper layer: dialogue shortcuts, level loading, timing utilities
import * as THREE from 'three'
import { G } from '../game.js'
import { ui } from '../core/ui.js'
import { audio } from '../core/audio.js'
import { unlock } from '../reality.js'
import { ptAt, projDist } from '../world/common.js'

export { G, ui, audio, THREE }
export const wait = (s) => G.wait(s)
export const N = (hi, en, o) => ui.say('Nishan', hi, en, o)
export const T = (hi, en, o) => ui.say('Nishant', hi, en, o)       // Nishant (companion)
export const U = (hi, en, o) => ui.say('Uncle', hi, en, o)
export const say = (who, hi, en, o) => ui.say(who, hi, en, o)
// reality unlocks are silent: shown in the report after the story
export const reveal = (...ids) => ids.forEach(id => unlock(id))
export const P = () => G.player

export async function load(name, opts = {}, comp = { x: 0, z: 0, outfit: 'nishant' }) {
  ui.show('hud', true)
  const L = await G.loadLevel(name, opts)
  if (comp !== false) {
    const sp = L.spawn, f = { x: Math.sin(sp.yaw), z: Math.cos(sp.yaw) }
    G.spawnCompanion(sp.x - f.z * -1.1 + (comp.dx || 0), sp.z - f.x * 1.1 + (comp.dz || 0), sp.yaw, comp.outfit || 'nishant')
  }
  G.torchOn = false; G.fearT = 0; G.tiredT = opts.tired ?? G.tiredT
  G.player.canMove = true; G.player.canLook = true; G.player.mode = 'walk'; G.player.push = false
  G.camOverride = null; G.clearInteracts(); G.lookLimit = null; G.noRun = false; G.goal = null; G.skipFn = null
  if (opts.scooter && !G.scooter) {
    const sp = L.spawn, f = { x: Math.sin(sp.yaw), z: Math.cos(sp.yaw) }
    G.addScooter(L, sp.x + f.x * 1.3, sp.z + f.z * 1.3, sp.yaw)
    if (opts.push !== false) { G.startPush(); G.noRun = true }
  }
  return L
}
export async function startScene(fadeSec = 1.6) { G.input.enabled = true; G.input.lock(); G.cineSet(0); await ui.fade(0, fadeSec) }
export async function endScene(fadeSec = 1.4) { await ui.fade(1, fadeSec) }

// wait for the player to press E on something at pos
export function useAt(pos, label, o) { return G.interact(pos, label, o) }
// wait until the player is within r of (x,z)
export const reach = (x, z, r = 2.2) => G.until(() => G.distToPlayer(x, z) < r)
export const reachZone = (zn) => G.until(() => G.distToPlayer(zn.x, zn.z) < zn.r)
// wait until progress along polyline >= d
export function alongTrail(L, pts, d, proj) { return G.until(() => proj(pts, G.player.pos.x, G.player.pos.z) >= d) }

// glance helpers
export function lookAtMe(pos, cos = 0.9) { return G.playerLookingAt3(pos, cos) }
export const heard = async (hi, en, pos, who = 'Awaaz') => { await ui.say(who, hi, en, { pos }) }

// make companion stand still and look at something
export function compHold(x, z) { const c = G.comp; if (!c) return; c.mode = 'hold'; c.holdPos = { x, z } }
export function compFollow() { const c = G.comp; if (!c) return; c.mode = 'follow'; c.holdPos = null }
export function setTime(h, rate = 0, frozen = false, show = true) { G.setClock(h, frozen, show); G.clockRate = rate }

// fear / tiredness presets
export const fear = (v) => { G.fearT = v }
export const tired = (v) => { G.tiredT = v }

// random point around player at radius r (behind / sides)
export function around(r, ang0 = 0, spread = Math.PI * 2) {
  const p = G.player.pos, a = G.player.yaw + ang0 + (Math.random() - 0.5) * spread
  return { x: p.x + Math.sin(a) * r, y: 1.2, z: p.z + Math.cos(a) * r }
}
// camera shake relaxed by setting
export const shake = (a) => G.camShake(a)
export const caption = (t, d = 2.4) => ui.caption(t, d)

// ---- movement goals (with a debug autopilot used by headless tests: ?auto=1) ----
const auto = () => !!G.auto
export function snapTo(x, z) {
  const p = G.player
  if (p.mode === 'ride' && G.scooter) { const c = G.scooter.chassis; c.position.set(x, 0.6, z); c.velocity.set(0, 0, 0) }
  else { G.teleportPlayer(x, z); if (G.scooter && p.push) { const c = G.scooter.chassis; c.position.set(x, 0.6, z) } }
}
// ---- waypoint goal (drives the map / compass / on-screen marker) ----
const setGoal = (g) => { g.prev = G.goal || null; G.goal = g; return g }
const endGoal = (g) => { if (G.goal === g) G.goal = g.prev || null }
// persistent base goal for a whole stretch (nested gates temporarily override it)
export const baseGoal = (x, z, label, pts, d) => { G.goal = { x, z, label, pts, d, skip: () => snapTo(x, z) } }
const DEF_LABEL = 'Raaste par aage badho · Follow the path'
const atGoal = (at, skip) => { if (!at) return null; const o = Array.isArray(at) ? { x: at[0], z: at[1], label: at[2] } : at; return { label: DEF_LABEL, ...o, skip } }
// wait until player is within r of (x,z)
export async function go(x, z, r = 2.4, label) {
  if (auto()) { await wait(0.5); snapTo(x, z); await wait(0.3); return }
  const g = setGoal({ x, z, label: label || DEF_LABEL, skip: () => snapTo(x, z) }); G.skipFn = g.skip
  try { await G.until(() => G.distToPlayer(x, z) < r) } finally { endGoal(g) }
}
// wait until the player has travelled to distance d along a trail polyline
export async function goTrail(pts, d, back = 0, label) {
  if (auto()) { await wait(0.5); const q = ptAt(pts, d); snapTo(q.x, q.z); await wait(0.3); return }
  const q = ptAt(pts, d), g = setGoal({ x: q.x, z: q.z, pts, d, label: label || DEF_LABEL, skip: () => { const e = ptAt(pts, d); snapTo(e.x, e.z) } }); G.skipFn = g.skip
  try { await G.until(() => projDist(pts, G.player.pos.x, G.player.pos.z) >= d) } finally { endGoal(g) }
}
export const trailD = (pts) => projDist(pts, G.player.pos.x, G.player.pos.z)
export const trailLen = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return l }
// interact with auto-press
export async function use(pos, label, o) {
  const pr = G.interact(pos, label, o)
  if (auto()) { await wait(0.5); G.player.pos.x = pos.x + 0.3; G.player.pos.z = pos.z + 0.3; G.interacts.forEach(i => i.res && i.res()); G.interacts = []; return pr }
  const g = setGoal({ x: pos.x, z: pos.z, label: label + ' · [E]', skip: () => { G.teleportPlayer(pos.x + 0.9, pos.z + 0.9) } }); G.skipFn = g.skip
  try { return await pr } finally { endGoal(g) }
}
// race two interactions; returns 0 or 1
export async function either(a, b) {
  const ia = G.interact(a.pos, a.label, { r: a.r || 3.2, cone: -1, once: true }), ib = G.interact(b.pos, b.label, { r: b.r || 3.2, cone: -1, once: true })
  if (auto()) { await wait(0.6); const k = G.autoPick ?? 0; const it = G.interacts[k]; G.interacts.forEach(i => i.res && i.res()); }
  const r = await Promise.race([ia.then(() => 0), ib.then(() => 1)])
  G.clearInteracts(); return auto() ? (G.autoPick ?? 0) : r
}
// freeze movement, turn the camera to a point, run fn, release
export async function focus(pos, fn, dur = 0.9) { const p = G.player; p.canMove = false; await G.turnTo(pos, dur); try { await fn() } finally { p.canMove = true } }
// wait while the player is looking toward pos (3D cone) for sec seconds
export async function lookFor(pos, sec = 1.2, cos = 0.93) {
  if (auto()) { await wait(0.5); return }
  let t = 0; await G.until(() => { t = G.playerLookingAt3(pos, cos) ? t + G.lastDt : Math.max(0, t - G.lastDt); return t >= sec })
}
export const lookedAway = (pos, cos = 0.35) => auto() || !G.playerLookingAt3(pos, cos)
export function pushOn() { G.startPush(); G.noRun = true }
export function pushOff() { G.stopPush(); G.noRun = false }
export function envSet(n) { G.env.set(n) }

// enable/disable a named trail (walkable corridor + its visible ribbon)
export function enableTrail(L, name, on = true) { L.walk.set(name, on); const t = (L.trails || []).find(t => t.name === name); if (t && t.mesh) t.mesh.visible = on }
// a choice that auto-picks in headless test mode
export async function choose(q, opts, autoIdx) {
  if (G.auto) { await wait(0.4); return autoIdx !== undefined ? autoIdx : (G.autoPick ?? 0) }
  return ui.choose(q, opts)
}
// make followers keep pace along a trail: list of {a: actor, off: metres ahead(+)/behind(-)}
export function followAlong(pts, list, speed = 2.1) {
  G.onUpdate = () => {
    const d = projDist(pts, G.player.pos.x, G.player.pos.z)
    for (const f of list) { if (!f.a || f.a.hidden) continue; const q = ptAt(pts, Math.max(0, d + f.off)); const dx = q.x - f.a.pos.x, dz = q.z - f.a.pos.z; if (Math.hypot(dx, dz) > 0.5) { f.a.path = [{ x: q.x, z: q.z }]; f.a.walkSpeed = Math.min(3.6, speed + Math.hypot(dx, dz) * 0.5) } else f.a.path = [] }
  }
}
export const stopFollow = () => { G.onUpdate = null }
// footsteps from a spot (n steps, gap seconds)
export async function stepsAt(pos, n = 4, gap = 0.55, surface = 'mud') { for (let i = 0; i < n; i++) { audio.footstep(surface, 0.9, pos); await wait(gap) } }
// spawn companion-like spare actor
export function spawn(outfit, x, z, yaw = 0) { const a = G.addActor(outfit); a.place(x, z, yaw); a.sfx = false; return a }

// generic wait-for-condition that the autopilot can skip (snap runs the "player did it" effect)
export async function gate(fn, snap, timeout = 0, at) {
  if (auto()) { await wait(0.5); if (snap) snap(); await wait(0.2); return }
  const g = at ? setGoal(atGoal(at, snap)) : null
  if (snap) G.skipFn = snap
  try { return await G.until(fn, timeout) } finally { if (g) endGoal(g) }
}
