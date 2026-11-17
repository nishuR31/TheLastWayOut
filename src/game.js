// Game core: renderer, physics, player, companion, interaction, timing, level switching
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { audio } from './core/audio.js'
import { input } from './core/input.js'
import { ui } from './core/ui.js'
import { Env } from './world/env.js'
import { Actor } from './world/actors.js'
import { lod } from './world/lod.js'
import { makeTorch } from './world/people.js'
import { clamp, damp, lerp, angDiff, fmtClock, R, nearestOnPoly } from './core/util.js'
import { Scooter } from './world/scooter.js'
import { preloadPBR } from './world/textures.js'
import { nav } from './core/nav.js'
import { phone } from './core/phone.js'
import { vm } from './world/viewmodel.js'
import { body } from './world/playerbody.js'
import { items } from './core/items.js'
import { fire } from './core/fire.js'
import { roamUpdate, placePits } from './core/roam.js'
import { horror } from './core/horror.js'
import { companionAI } from './core/companion-ai.js'
import { keyaid } from './core/keyaid.js'

const LEVELS = import.meta.glob('./levels/*.js')
// reusable scratch objects for the per-frame hot path (no per-frame allocation)
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vc = new THREE.Vector3()
const _vq = new THREE.Quaternion(), _ve = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0)

export const G = {
  cfg: { density: 1, rain: 1, shadows: false, ambBoost: 1, reduceShake: false, reduceFlash: false, engineSign: -1, gfx: 'med' },
  input, ui, audio, THREE, CANNON, running: false, paused: false, stopped: false, runId: 0,
  timers: [], untils: [], interacts: [], lastDt: 0.016, time: 19.7, clockFrozen: false, clockShow: false, shake: 0,
  level: null, levels: {}, actors: [], flags: {}, camOverride: null, forceLook: null,
  helmetOnBike: false, visorDown: false, engineOn: true, _hornT: 0
}
audio.setVec3(THREE.Vector3)
ui.G = G

// ---------------- init ----------------
G.init = function (canvas) {
  nav.init(G); G.nav = nav
  G.canvas = canvas
  const r = (G.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }))
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace
  G.scene = new THREE.Scene()
  G.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 1200); G.scene.add(G.camera)
  // ---- physics: split GS solver (stable stacked/vehicle contacts), swept-AABB
  // broadphase, firm contact equations, and a fixed 120 Hz substep clock. ----
  G.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) }); G.world.allowSleep = false
  const gs = new CANNON.GSSolver(); gs.iterations = 20; gs.tolerance = 0.001
  G.world.solver = new CANNON.SplitSolver(gs)
  G.world.broadphase = new CANNON.SAPBroadphase(G.world); G.world.broadphase.useBoundingBoxes = true
  const dc = G.world.defaultContactMaterial
  dc.friction = 0.5; dc.restitution = 0
  dc.contactEquationStiffness = 1e8; dc.contactEquationRelaxation = 3
  dc.frictionEquationStiffness = 1e8; dc.frictionEquationRelaxation = 3
  // collision groups: keep the ground, solids, the bike and loose props separate
  G.groups = { GROUND: 1, STATIC: 2, VEHICLE: 4, PROP: 8 }
  G.mat = { ground: new CANNON.Material('ground'), vehicle: new CANNON.Material('vehicle'), prop: new CANNON.Material('prop') }
  G.world.addContactMaterial(new CANNON.ContactMaterial(G.mat.ground, G.mat.vehicle, { friction: 0.45, restitution: 0 }))
  G.world.addContactMaterial(new CANNON.ContactMaterial(G.mat.ground, G.mat.prop, { friction: 0.6, restitution: 0.25 }))
  G.world.addContactMaterial(new CANNON.ContactMaterial(G.mat.prop, G.mat.prop, { friction: 0.35, restitution: 0.2 }))
  G.world.addContactMaterial(new CANNON.ContactMaterial(G.mat.vehicle, G.mat.prop, { friction: 0.35, restitution: 0.15 }))
  const gb = (G.groundBody = new CANNON.Body({ mass: 0, material: G.mat.ground }))
  gb.addShape(new CANNON.Plane()); gb.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  gb.collisionFilterGroup = G.groups.GROUND; gb.collisionFilterMask = -1
  G.world.addBody(gb)
  G.env = new Env(G)
  horror.init(G)
  companionAI.attach(G)
  // Horror beats feed the companion's split perception: the seer reacts to
  // shapes, the hearer to sounds. He never speaks for the player.
  horror.onEvent = (kind, pos) => companionAI.onEvent(kind, pos)
  // torch (player's flashlight)
  const tl = (G.torch = new THREE.SpotLight('#fff3d6', 0, 46, 0.4, 0.55, 1.35)); tl.position.set(0.18, -0.14, 0); G.camera.add(tl)
  G.torchTarget = new THREE.Object3D(); G.torchTarget.position.set(0.0, -0.05, -8); G.camera.add(G.torchTarget); tl.target = G.torchTarget
  G.torchFill = new THREE.PointLight('#ffe9c0', 0, 7, 2); G.torchFill.position.set(0, 0, -0.6); G.camera.add(G.torchFill)
  G.torchOn = false; G.torchPow = 1
  // player
  G.player = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, eyeH: 1.62, crouch: 0, stamina: 1, bobT: 0, stepT: 0, mode: 'walk', canMove: true, canLook: true, speedMul: 1, vel: 0, roll: 0, lookX: 0, push: false, tired: 0, headDip: 0 }
  G.fear = 0; G.fearT = 0; G.tiredT = 0
  vm.init(G); body.init(G); fire.init(G)
  addEventListener('resize', G.resize); G.resize()
  G.setGfx(G.cfg.gfx)
}
G.resize = function () { const w = innerWidth, h = innerHeight; G.renderer.setSize(w, h, false); G.camera.aspect = w / h; G.camera.updateProjectionMatrix() }
G.setGfx = function (q) {
  G.cfg.gfx = q
  const pr = { low: 0.6, med: 0.85, high: Math.min(devicePixelRatio, 1.5) }[q]; G.renderer.setPixelRatio(pr)
  G.cfg.density = { low: 0.55, med: 0.8, high: 1 }[q]; G.cfg.rain = { low: 0.4, med: 0.75, high: 1 }[q]
  const sh = q !== 'low'
  G.renderer.shadowMap.enabled = sh; G.renderer.shadowMap.type = THREE.PCFSoftShadowMap
  if (G.env) { G.env.sun.castShadow = sh; const m = q === 'high' ? 2048 : 1024; if (G.env.sun.shadow.mapSize.x !== m) { G.env.sun.shadow.mapSize.set(m, m); if (G.env.sun.shadow.map) { G.env.sun.shadow.map.dispose(); G.env.sun.shadow.map = null } } }
  if (G.scene) G.scene.traverse(o => { if (o.material) { const a = Array.isArray(o.material) ? o.material : [o.material]; a.forEach(x => x.needsUpdate = true) } })
}

// ---------------- timing ----------------
G.wait = (s) => new Promise((res, rej) => { if (G.stopped) return rej('abort'); G.timers.push({ t: s, res, rej }) })
G.until = (fn, timeout = 0) => new Promise((res, rej) => { if (G.stopped) return rej('abort'); G.untils.push({ fn, res, rej, t: timeout, el: 0 }) })
G.waitSkippable = (s) => new Promise((res, rej) => { if (G.stopped) return rej('abort'); G.timers.push({ t: s, res, rej, skippable: true, el: 0 }) })
G.abort = function () {
  G.stopped = true; G.runId++
  const rej = [...G.timers, ...G.untils]; G.timers = []; G.untils = []
  rej.forEach(x => x.rej('abort')); if (G._choiceRej) G._choiceRej('abort')
  G.interacts.forEach(i => i.rej && i.rej('abort')); G.interacts = []
}
G.beginRun = function () { G.stopped = false; vm.reset(); horror.reset() }

// ---------------- clock ----------------
G.setClock = function (h, frozen = false, show = true) { G.time = h; G.clockFrozen = frozen; G.clockShow = show; ui.clock(fmtClock(h), frozen, show) }
G.tickClock = function (dt, rate) { if (G.clockFrozen || !rate) return; G.time += dt * rate / 3600; ui.clock(fmtClock(G.time), false, G.clockShow) }

// ---------------- levels ----------------
G.loadLevel = async function (name, opts = {}) {
  vm.reset()
  document.getElementById('loading').classList.remove('hidden')
  await new Promise(r => setTimeout(r, 30))
  await preloadPBR()
  if (G.level) { G.level.dispose(); G.level = null }
  G.actors.forEach(a => a.dispose()); G.actors = []; G.comp = null; G.scooter = null; lod.clear()
  // purge any leftover rain/torch state
  const loader = LEVELS['./levels/' + name + '.js']
  if (typeof loader !== 'function') {
    document.getElementById('loading').classList.add('hidden')
    throw new Error('Unknown level: ' + name)
  }
  const mod = await loader()
  G.pit = null; G.showBody = false; G.bodyPose = null; G.fearBoost = 0; G._wantBoost = 0; G.pitCD = 0
  const L = mod.build(G, opts); G.level = L; G.scene.add(L.group); if (L.core && L.roam && !L.pits) placePits(L, G); items.scan(G, L); fire.populate(G, L)
  G.interacts = []
  const p = G.player; p.pos.set(L.spawn.x, L.groundY(L.spawn.x, L.spawn.z), L.spawn.z); p.yaw = L.spawn.yaw; p.pitch = 0
  G.env.indoors = false; G.env.fogMul = 1
  document.getElementById('loading').classList.add('hidden')
  return L
}
G.addActor = function (outfit, over) { const a = new Actor(G, outfit, over); G.actors.push(a); return a }
G.removeActor = function (a) { const i = G.actors.indexOf(a); if (i >= 0) G.actors.splice(i, 1); a.dispose(); if (G.comp === a) G.comp = null }

// ---------------- companion (Nishant) ----------------
G.spawnCompanion = function (x, z, yaw = 0, outfit) {
  // The companion is the friend the player is NOT controlling, and looks like
  // them. Non-friend outfits (if any future scene asks for one) pass through.
  const other = ui.playerChar === 'Nishant' ? 'nishan' : 'nishant'
  const key = (outfit === 'nishan' || outfit === 'nishant' || !outfit) ? other : outfit
  const a = G.addActor(key); a.place(x, z, yaw, G.level && G.level.groundY ? G.level.groundY(x, z) : 0); a.collide = true; G.comp = a
  a.mode = 'follow'; a.alertT = 0; a.idleLookT = 3; a.sideSign = 1; a.holdPos = null; a.catchup = false; a.torchOn = false
  companionAI.onSpawn(a, ui.playerChar)
  return a
}
function companionUpdate(dt) {
  const c = G.comp; if (!c || c.attach) return
  const p = G.player, pf = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }, pr = { x: -pf.z, z: pf.x }
  const dxp = p.pos.x - c.pos.x, dzp = p.pos.z - c.pos.z, dp = Math.hypot(dxp, dzp)
  c.alertT = Math.max(0, c.alertT - dt)
  if (G.assistT > 0 && G.scooter && p.push && c.mode === 'follow') {
    const sc = G.scooter, f = sc.fwd(), cp = sc.chassis.position
    const tx = cp.x - f.x * 0.45 - f.z * 0.8, tz = cp.z - f.z * 0.45 + f.x * 0.8, d = Math.hypot(tx - c.pos.x, tz - c.pos.z)
    c.assisting = true; c.pose(d < 0.7 ? 'push' : 'stand'); c.look(null)
    if (d > 0.2) { c.path = [{ x: tx, z: tz }]; c.walkSpeed = clamp(d * 2.4, 0.6, 2.6) } else { c.path = []; c.face(sc.yaw) }
    return
  } else if (c.assisting) { c.assisting = false; c.pose('stand') }
  if (c.mode === 'follow') {
    if (c.alertT > 0) { c.path = []; c.look(c.alertPos); c.face(c.alertPos) }
    else {
      // ---- smarter follower: keeps a comfortable distance, matches pace, crouches/hides with you, fidgets when idle,
      // keeps out of your way, hugs you tighter when scared and never gets left behind ----
      const pushing = G.scooter && p.push, moving = Math.abs(p.vel) > 0.3, running = p.vel > 2.6, fearK = G.fear > 0.5 ? 0.7 : 1
      G.stillT = moving ? 0 : (G.stillT || 0) + dt
      const off = pushing ? { f: 0.2, r: 1.2 * c.sideSign } : moving ? { f: -1.3 * fearK, r: -1.0 * c.sideSign * fearK } : { f: -0.5, r: -1.6 * c.sideSign * fearK }
      const tx = p.pos.x + pf.x * off.f + pr.x * off.r, tz = p.pos.z + pf.z * off.f + pr.z * off.r
      const d = Math.hypot(tx - c.pos.x, tz - c.pos.z)
      if (d > 0.8) { const sp = clamp(d * 1.7, 0.6, running || dp > 7 ? 3.6 : 2.5) * (1 - G.player.tired * 0.25); c.path = [{ x: tx, z: tz }]; c.walkSpeed = sp } else { c.path = []; c.face(Math.atan2(pf.x, pf.z)) }
      // never stand in the player's way
      if (dp < 0.9 && !pushing) { const sx = c.pos.x - p.pos.x || 0.1, sz = c.pos.z - p.pos.z || 0.1, l = Math.hypot(sx, sz); c.path = [{ x: c.pos.x + sx / l * 1.2, z: c.pos.z + sz / l * 1.2 }]; c.walkSpeed = 1.8 }
      // copies the player's crouch
      c.P.crouch += ((p.crouch > 0.5 ? 1 : 0) - c.P.crouch) * Math.min(1, dt * 6)
      c.P.tremble = G.fear > 0.55 ? (G.fear - 0.5) * 1.2 : 0
      // idle fidgets (only if the story has not put him in some other pose)
      if (G.stillT > 6 && !c.fidT && c.P.pose === 'stand' && !moving && c.alertT <= 0 && R.next() < dt * 0.15) { c.fidT = 2.6; c.pose('rub') }
      if (c.fidT) { c.fidT -= dt; if (c.fidT <= 0 || moving) { c.fidT = 0; if (c.P.pose === 'rub') c.pose('stand') } }
      // lost him? bring him back from behind, out of sight
      c.stuckT = (c.stuckT || 0) + (d > 4 && c.speed < 0.15 ? dt : 0); if (d < 3) c.stuckT = 0
      if (dp > 16 || c.stuckT > 3) { const bx = p.pos.x - pf.x * 5 + pr.x * 1.5, bz = p.pos.z - pf.z * 5 + pr.z * 1.5; const q = { x: bx, z: bz }; if (G.level) G.level.walk.resolve(q, 0.4); c.place(q.x, q.z, p.yaw); c.stuckT = 0 }
      c.idleLookT -= dt
      if (c.idleLookT <= 0) { c.idleLookT = R.range(2.5, 6); c.glance = R.next() < 0.6 ? { x: c.pos.x + R.range(-6, 6), y: 1.5, z: c.pos.z + R.range(-6, 6) } : null }
      if (dp < 3.5 && G.lookingNow) c.look(G.lookingNow); else if (c.glance && dp < 8 && !running) c.look(c.glance); else c.look({ x: p.pos.x + pf.x * 6, y: 1.4 - p.pitch * 3, z: p.pos.z + pf.z * 6 })
    }
  } else if (c.mode === 'hold' && c.holdPos) {
    const d = Math.hypot(c.holdPos.x - c.pos.x, c.holdPos.z - c.pos.z)
    if (d > 0.5) { c.path = [{ x: c.holdPos.x, z: c.holdPos.z }]; c.walkSpeed = 1.8 } else { c.path = []; c.face(Math.atan2(dxp, dzp)) }
    c.look(c.alertT > 0 ? c.alertPos : { x: p.pos.x, y: 1.5, z: p.pos.z })
  }
}
G.alertComp = function (pos, dur = 2.2) { const c = G.comp; if (!c) return; c.alertT = dur; c.alertPos = pos.isVector3 ? pos : { x: pos.x, y: pos.y ?? 1.4, z: pos.z } }
G.compSay = (hi, en, o) => ui.say('Nishant', hi, en, o)
G.nishanSay = (hi, en, o) => ui.say('Nishan', hi, en, o)

// ---------------- scooter helpers ----------------
G.addScooter = function (L, x, z, yaw = 0, color = '#a31d1d') {
  const sc = new Scooter(G, color); sc.place(x, z, yaw); L.group.add(sc.root); L.disposers.push(() => sc.dispose()); G.scooter = sc; L.scooter = sc
  for (let i = 0; i < 80; i++) { G.world.step(1 / 120); sc.sync(0.008) }
  sc.park(); return sc
}
// E — the ONLY place the ignition key animation plays: on start and on stop.
G.toggleEngine = function () {
  if (G.player.mode !== 'ride' || G.keyBusy || !G.scooter) return
  const sc = G.scooter
  G.keyBusy = true
  if (!G.engineOn) {
    vm.keyStart(sc, () => {
      G.engineOn = true; audio.st.engine = 1; sc.light(true); audio.ignition(true)
      ui.toast('Engine chalu · Engine on', 1.8)
    }).then(() => { G.keyBusy = false })
  } else {
    vm.keyStop(sc, () => {
      G.engineOn = false; audio.st.engine = 0; audio.st.rpm = 0; sc.light(false); audio.ignition(false)
      ui.toast('Engine band · Engine off', 1.8)
    }).then(() => { G.keyBusy = false })
  }
}
G.mount = function (sc) {
  const p = G.player; p.mode = 'ride'; G.scooter = sc; G.engineOn = false; sc.parked = false
  sc.setStand && sc.setStand(false); sc.light(false); audio.st.engine = 0; audio.st.rpm = 0
  G.keyBusy = false
  // mounting does NOT start the engine — the player presses E to turn the key
  ui.toast('Bike par baith gaye — E se engine chalu karo', 2.6)
  if (G.comp) { G.comp.attach = sc.pillion; G.comp.pose('pillion'); G.comp.path = [] }
  ui.show('speedo', true)
}
G.dismount = function (x, z) {
  const p = G.player, sc = G.scooter; p.mode = 'walk'; audio.st.engine = 0; audio.st.rpm = 0; ui.show('speedo', false)
  // stopping a running engine is an engine-stop, so its animation still plays here
  if (G.engineOn && !G.keyBusy) {
    G.keyBusy = true
    vm.keyStop(sc, () => { sc.light(false); G.engineOn = false }).then(() => { G.keyBusy = false })
  } else sc.light(false)
  sc.park(); sc.setStand && sc.setStand(true); const f = sc.fwd(); const px = x ?? sc.chassis.position.x - f.z * 0.9, pz = z ?? sc.chassis.position.z + f.x * 0.9; p.pos.set(px, G.level && G.level.groundY ? G.level.groundY(px, pz) : 0, pz); p.yaw = sc.yaw
  if (G.comp && G.comp.attach) { const c = G.comp; c.attach = null; c.pose('stand'); c.place(sc.chassis.position.x + f.z * 0.9, sc.chassis.position.z - f.x * 0.9, sc.yaw) }
}
// B: get on / start the scooter, or switch it off and get off
G.toggleVisor = function () {
  if (!G.hasHelmet) { ui.reason('Helmet nahi hai — visor chalane ke liye pehle helmet uthao (E)'); return }
  G.visorDown = !G.visorDown
  const v = document.getElementById('visor')
  if (v) v.classList.toggle('down', G.visorDown)
  audio.metalClack(); ui.toast(G.visorDown ? 'Visor neeche · Visor down' : 'Visor upar · Visor up', 1.6)
}
G.canBoard = () => !!G.level && !G.noBoard && !(G.scooter && (G.scooter.punctured || G.scooter.dead))
const nearScooter = (pos) => G.scooter && Math.hypot(pos.x - G.scooter.chassis.position.x, pos.z - G.scooter.chassis.position.z) < 3.6
// Why can't we ride right now? null = allowed. Used by the prompt AND the key handler
// so every blocked action explains itself in red instead of failing silently.
G.boardBlock = function () {
  const sc = G.scooter, p = G.player
  if (!G.level) return 'Abhi bike nahi mil sakti — koi level load nahi hua'
  if (!sc) return 'Bike yahan nahi hai'
  if (G.pit) return 'Pehle gaddhe se bike bahar kheencho — tabhi chal payegi'
  if (G.keyBusy) return 'Chabi abhi lag rahi hai — thoda intezaar karo'
  if (G.camOverride) return 'Abhi scene chal raha hai — baad mein'
  if (!p.canMove) return 'Abhi hille nahi pa rahe — scene chal raha hai'
  if (sc.dead) return 'Bike geeli mitti mein phas gayi hai — chal nahi sakti, G se dhakelo'
  if (sc.punctured) return 'Bike ka tyre puncture ho gaya — chal nahi sakti, G se dhakelo'
  if (G.noBoard) return 'Is jagah bike chalani nahi — yahan sirf dhakelna hoga (G)'
  if (G.hasKey === false) return 'Bike ki chabi wall hook par hai — pehle uthao (E)'
  return null
}
// Same for pushing — with its own reasons.
G.pushBlock = function () {
  const sc = G.scooter, p = G.player
  if (!sc) return 'Dhakelne ke liye bike yahan nahi hai'
  if (G.pit) return 'Gaddhe mein khadi bike ko pehle bahar kheencho'
  if (G.keyBusy) return 'Chabi lagne de — abhi nahi'
  if (G.camOverride) return 'Abhi scene chal raha hai'
  if (!p.canMove) return 'Abhi hille nahi pa rahe'
  if (p.mode === 'ride') return 'Pehle bike se utro (B), phir dhakelo'
  return null
}
G.bikeAction = function () {
  const p = G.player, sc = G.scooter
  if (!sc || G.keyBusy || G.camOverride) { const r = G.boardBlock(); if (r) ui.reason(r); return }
  if (p.push && p.mode !== 'ride' && !input.down('Shift')) { G.stopPush(); G.noRun = false }   // B while pushing: let go and get on
  if (p.mode === 'ride') { if (Math.abs(sc.speed) > 2.2) { ui.reason('Pehle bike roko (Space) — tab hi utar sakte ho'); return } G.dismount(); return }
  if (G.cur && nearScooter(G.cur.pos)) return       // a story prompt on the scooter handles B itself
  const blocked = G.boardBlock()
  if (blocked) { ui.reason(blocked); return }
  if (Math.hypot(sc.chassis.position.x - p.pos.x, sc.chassis.position.z - p.pos.z) > 2.8) { ui.reason('Bike se door ho — paas jao pehle'); return }
  G.mount(sc)
}
// G: start / stop pushing the bike by hand (rough ground, mud, or when you do not want to ride)
G.pushToggle = function () {
  const p = G.player, sc = G.scooter
  const blocked = G.pushBlock()
  if (blocked) { ui.reason(blocked); return }
  if (p.push) { G.stopPush(); G.noRun = false; ui.toast('Bike chhod di · Let go of the bike', 1.6); return }
  if (Math.hypot(sc.chassis.position.x - p.pos.x, sc.chassis.position.z - p.pos.z) > 2.8) { ui.reason('Bike se door ho — dhakelne ke liye paas jao'); return }
  G.startPush(); ui.toast('Bike dhakel rahe ho (Shift+W: dost bhi madad karega) · Pushing', 2.5)
}
// Shift+B — hang the helmet on the bike's rear holder by its chin strap, or take it back.
G.toggleBikeHelmet = function () {
  const p = G.player, sc = G.scooter
  if (!sc || G.pit || G.keyBusy || G.camOverride || !p.canMove || p.mode === 'ride') {
    ui.reason(p.mode === 'ride' ? 'Helmet tabhi latka sakte ho jab bike se utre ho (B)' : 'Abhi helmet nahi chhua ja sakta — scene chal raha hai'); return
  }
  if (Math.hypot(sc.chassis.position.x - p.pos.x, sc.chassis.position.z - p.pos.z) > 3.0) {
    ui.reason('Bike se door ho — helmet uske hook par latkaane ke liye paas jao'); return
  }
  if (G.helmetOnBike) {
    G.helmetOnBike = false; G.hasHelmet = true
    if (sc.setHelmet) sc.setHelmet(false)
    audio.clang(sc.chassis.position, 0.5); ui.toast('Helmet utha liya [ic:helmet] · Helmet back on', 2.4)
  } else if (G.hasHelmet) {
    G.helmetOnBike = true; G.hasHelmet = false
    if (sc.setHelmet) sc.setHelmet(true)
    audio.click(); ui.toast('Helmet bike ke pichhle hook par latka diya · Helmet hung on the bike', 2.6)
  } else ui.reason('Paas helmet nahi hai — pehle rack se uthao (E)')
  items.reconcile(G)
}
G.startPush = function () {
  const p = G.player, sc = G.scooter; if (!sc) return
  p.push = true; p.mode = 'walk'; sc.parked = false; sc.setStand && sc.setStand(false)
  if (G.comp) G.comp.sideSign = 1
  if (G.torchOn) sc.light(true)
  ui.toast('Handlebar pakdo — bike chala rahe ho. Shift+W se Nishant peeche se dhakkega', 3.4)
}
G.stopPush = function () { const p = G.player, sc = G.scooter; p.push = false; if (sc) { sc.park(); sc.setStand && sc.setStand(true); if (p.mode !== 'ride') sc.light(false) } }

// ---------------- interaction ----------------
G.interact = function (pos, label, o = {}) {
  return new Promise((res, rej) => {
    const it = { pos: pos.isVector3 ? pos : new THREE.Vector3(pos.x, pos.y ?? 1, pos.z), label, r: o.r ?? 2.1, res, rej, once: o.once !== false, cone: o.cone ?? 0.5, key: o.key || 'E', enabled: o.enabled }
    G.interacts.push(it)
    if (G.stopped) return rej('abort')
    // Autoplay must never stall on a prompt nobody will press. Helpers may also
    // resolve/teleport; resolving twice is harmless, so direct G.interact() calls
    // are safe in ?auto=1 runs too.
    if (G.auto) queueMicrotask(() => res(true))
  })
}
G.addInteract = function (it) { G.interacts.push(it); return it }
G.clearInteracts = function () { G.interacts = [] }

// ---------------- helpers for story ----------------
G.fx = {
  fear(v) { G.fearT = v }, tired(v) { G.tiredT = v }
}
// the phone torch is only "really" on if the bike headlight is not doing the job (pushing the bike)
G.torchActive = () => !!G.torchOn && !(G.player.push && G.scooter && G.scooter.lightOn)
// F: while pushing the scooter this switches the BIKE HEADLIGHT, otherwise the phone flashlight
G.toggleLight = function () {
  const p = G.player, sc = G.scooter
  if (p.push && sc && p.mode !== 'ride') { const on = !sc.lightOn; sc.light(on); audio.click(); ui.toast(on ? 'Scooter ki headlight on · Bike headlight' : 'Headlight off', 1.6); return }
  G.setTorch(!G.torchOn)
}
G.setTorch = function (on) { if (on && G.hasPhone === false) { ui.reason('Torch phone ka hai — phone table par hai, pehle uthao (E)'); return } G.torchOn = on; audio.click() }
G.lockMove = (m = true) => { G.player.canMove = !m }
G.teleportPlayer = function (x, z, yaw) { const p = G.player; p.pos.set(x, G.level && G.level.groundY ? G.level.groundY(x, z) : 0, z); if (yaw !== undefined) p.yaw = yaw }
G.blink = async function (dur = 0.5) { await ui.fade(1, dur * 0.4, true); await G.wait(dur * 0.2) }
G.unblink = async function (dur = 0.8) { await ui.fade(0, dur, true) }
G.distToPlayer = (x, z) => Math.hypot(x - G.player.pos.x, z - G.player.pos.z)
G.playerLookingAt = function (pos, cos = 0.8) { const p = G.player, d = new THREE.Vector3(pos.x - p.pos.x, 0, pos.z - p.pos.z).normalize(); const f = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)); return d.dot(f) > cos }
G.playerLookingAt3 = function (pos, cos = 0.9) { const d = new THREE.Vector3(pos.x, pos.y ?? 1.5, pos.z).sub(G.camera.position).normalize(); const f = new THREE.Vector3(); G.camera.getWorldDirection(f); return d.dot(f) > cos }
G.turnTo = async function (pos, dur = 0.9) {
  const p = G.player, tgt = Math.atan2(pos.x - p.pos.x, pos.z - p.pos.z), ty = Math.atan2((pos.y ?? 1.4) - 1.6, Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z))
  const y0 = p.yaw, d = angDiff(y0, tgt), pi0 = p.pitch; let el = 0
  await G.until(() => { el += G.lastDt; const k = Math.min(1, el / dur), e = k * k * (3 - 2 * k); p.yaw = y0 + d * e; p.pitch = lerp(pi0, ty, e); return k >= 1 })
}
// A scripted camera move (dolly / crane / pan) for opening shots and key beats. Space / Enter skips it.
// sh: { from, to, lookFrom, lookTo, dur, fov, fov1, arc?, handheld?, ease? }
//   arc:      offset of a bezier control point — the camera curves around the
//             subject instead of sliding in a straight line.
//   handheld: subtle breathing sway in metres (horror beats feel less clinical).
//   ease:     'in' | 'out' | 'linear' (default smoothstep).
G.shot = async function (sh) {
  const o = G.camOverride = { pos: sh.from.clone(), look: sh.lookFrom.clone(), fov: sh.fov || 62, snap: true }
  const fov0 = sh.fov || 62, fov1 = sh.fov1 || fov0; let el = 0
  const from = sh.from.clone(), to = sh.to.clone()
  const ctrl = sh.arc ? from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(sh.arc.x || 0, sh.arc.y || 0, sh.arc.z || 0)) : null
  const ease = (k) => sh.ease === 'linear' ? k : sh.ease === 'in' ? k * k : sh.ease === 'out' ? 1 - (1 - k) * (1 - k) : k * k * (3 - 2 * k)
  await G.until(() => {
    el += G.lastDt
    if (el > 0.8 && (input.hit('Space') || input.hit('Enter'))) el = sh.dur
    const k = Math.min(1, el / sh.dur), e = ease(k)
    if (ctrl) {
      const u = 1 - e
      o.pos.copy(from).multiplyScalar(u * u).addScaledVector(ctrl, 2 * u * e).addScaledVector(to, e * e)
    } else o.pos.lerpVectors(from, to, e)
    if (sh.handheld && k < 1) { o.pos.x += Math.sin(el * 7.3) * sh.handheld * 0.02; o.pos.y += Math.cos(el * 5.1) * sh.handheld * 0.015 }
    o.look.lerpVectors(sh.lookFrom, sh.lookTo, e)
    o.fov = lerp(fov0, fov1, e)
    return k >= 1
  })
}
// hand the camera back to the player, facing where the last shot looked
G.endShot = function () {
  const o = G.camOverride, p = G.player; if (!o) return
  const d = new THREE.Vector3().subVectors(o.look, o.pos)
  p.yaw = Math.atan2(d.x, d.z); p.pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -1.2, 1.2)
  G.camOverride = null
}
// horror beat: the player's head is pulled round to a sound / shape, held a moment, then released (never during transitions)
G.horrorTurn = async function (pos, hold = 1.2, dur = 0.75, shake = 0.25) {
  const p = G.player; if (p.mode === 'ride' || G.camOverride || G.pit) return
  const was = p.canMove; p.canMove = false
  try { await G.turnTo(pos.isVector3 ? pos : new THREE.Vector3(pos.x, pos.y ?? 1.4, pos.z), dur); if (shake) G.camShake(shake); await G.wait(hold) } finally { p.canMove = was }
}
G.camShake = (a = 0.5) => { G.shake = Math.max(G.shake, a * (G.cfg.reduceShake ? 0.25 : 1)) }

// ---------------- main loop ----------------
let last = 0, acc = 0
G.start = function () { G.running = true; last = performance.now(); requestAnimationFrame(loop) }
function loop(now) {
  requestAnimationFrame(loop)
  let dt = Math.min(0.05, (now - last) / 1000); last = now
  if (!G.running) return
  if (G.paused) { G.renderer.render(G.scene, G.camera); return }
  if (G.fastSim) { // headless test mode: many simulation steps per frame, render rarely
    for (let i = 0; i < G.fastSim; i++) { G.lastDt = 0.05; G.step(0.05); input.endFrame() }
    G._fr = (G._fr || 0) + 1; if (G._fr % 8 === 0) G.renderer.render(G.scene, G.camera)
    return
  }
  G.lastDt = dt
  G.step(dt)
  G.renderer.render(G.scene, G.camera)
  input.endFrame()
}
G.step = function (dt) {
  const p = G.player, L = G.level
  if (!L) return
  // timers
  for (let i = G.timers.length - 1; i >= 0; i--) { const t = G.timers[i]; t.t -= dt * (G.timeScale || 1); if (t.skippable) { t.el += dt; if (t.el > 0.5 && (input.hit('Space') || input.hit('Enter'))) t.t = 0 } if (t.t <= 0) { G.timers.splice(i, 1); t.res() } }
  for (let i = G.untils.length - 1; i >= 0; i--) { const u = G.untils[i]; u.el += dt; let ok = false; try { ok = u.fn() } catch (e) { console.error(e) } if (ok || (u.t && u.el >= u.t)) { G.untils.splice(i, 1); u.res(ok) } }
  // player
  playerUpdate(dt)
  roamUpdate(G, dt); fire.update(G, dt)
  // physics
  G.world.step(1 / 120, dt, 8) // 120 Hz fixed substeps keep fast bike contacts stable
  if (G.scooter) { const sc = G.scooter; if (p.mode === 'ride') { const ax = input.axis(); sc.drive(dt, (G.engineOn === false || G.keyBusy) ? 0 : ax.y, ax.x, input.down('Space') || !!G.keyBusy, Math.min(G.rideMax || 42, G.surfaceCap(sc.chassis.position))); sc.uprightCheck(dt); rideBound(sc) } else if (p.push) pushScooter(dt); else sc.park(); sc.sync(dt); audio.st.rpm = clamp(Math.abs(sc.speed) / 42, 0, 1); ui.show('speedo', p.mode === 'ride'); if (p.mode === 'ride') document.getElementById('speedo-v').textContent = Math.round(Math.abs(sc.speed) * 3.6) }
  L.update(dt)
  for (const a of G.actors) a.update(dt)
  lod.update(G.camera.position, p.pos, dt)
  { // lip-sync: open the mouth of the speaking actor from the clip level
    const sp = G.speaking; let who = null, lv = 0
    if (sp && sp.h && sp.h.level) { lv = sp.h.level(); who = sp.who === 'Nishant' ? G.comp : sp.who === 'Nishan' ? null : G.actors.filter(a => a !== G.comp && !a.hidden && a.P.mouthM).sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) - Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z))[0] }
    lod.focus = (who && who.P) ? who.P : null // the speaker always renders at full detail
    for (const a of G.actors) a.P.mouth = a === who ? lv : a.P.mouth * 0.7
  }
  companionUpdate(dt)
  companionAI.update(dt, G, horror)
  keyaid.update(dt, G)
  G.env.update(dt, G.camera.position)
  horror.update(dt, G)
  updateInteract(dt)
  updateCamera(dt)
  nav.update(dt)
  if (G._dbg) { G._fps = (G._fps || 60) * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05; const r = G.renderer.info.render; document.getElementById('dbg').textContent = `fps ${G._fps.toFixed(0)}  calls ${r.calls}  tris ${(r.triangles / 1000).toFixed(0)}k  ${lod.stats()}\nphys ${G.world.bodies.length} bodies / ${G.world.contacts.length} contacts / 120Hz\nlevel ${L.name}  t ${G.time.toFixed(2)}\npos ${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)}  yaw ${p.yaw.toFixed(2)}\ngoal ${G.goal ? G.goal.label : '-'}` }
  updateAudioState(dt)
  G.tickClock(dt, G.clockRate || 0)
  // fear / tired smoothing
  G.fear = damp(G.fear, Math.min(1, G.fearT * (1 - 0.35 * (G.warm || 0)) + (G.fearBoost || 0)), 1.5, dt); p.tired = damp(p.tired, G.tiredT * (1 - 0.5 * (G.warm || 0)), 0.5, dt)
  ui.fear(Math.max(0, (G.fear - 0.45) * 1.3))
  audio.st.fear = G.fear > 0.35 ? G.fear : 0
  if (G.onUpdate) G.onUpdate(dt)
}

// how fast the ground lets you go: tarmac is quick, mud and forest floor are slow
G.surfaceCap = (pos) => { const L = G.level, sf = L && L.surface ? L.surface(pos.x, pos.z) : 'road'; return ({ road: 42, tile: 16, dirt: 24, grass: 22, ash: 20, mud: 18 })[sf] || 16 }
function rideBound(sc) {
  const L = G.level
  if (L.walk.free) { // free roam: only trees / props are solid
    const c = sc.chassis, q = { x: c.position.x, z: c.position.z }; L.walk.resolve(q, 0.55)
    if (L.walk.lastClamp && (!G._bndT || performance.now() - G._bndT > 3500)) { G._bndT = performance.now(); ui.toast('Yahan se aage raasta band hai · The way is blocked', 2.4) }
    if (Math.abs(q.x - c.position.x) + Math.abs(q.z - c.position.z) > 1e-4) { c.position.x = q.x; c.position.z = q.z; c.velocity.x *= 0.35; c.velocity.z *= 0.35; if (!G._bonkT || performance.now() - G._bonkT > 600) { G._bonkT = performance.now(); audio.thud(null, 0.5); G.camShake(0.3) } }
    return
  }
  if (!L.rideCorr) {
    if (L.rideWalk === false) return
    const c = sc.chassis, q = L.walk.query(c.position.x, c.position.z, 0.45)
    if (q.d > 0) { c.position.x = q.x; c.position.z = q.z; c.velocity.x *= 0.85; c.velocity.z *= 0.85; if (!G._edgeT || performance.now() - G._edgeT > 1800) { G._edgeT = performance.now(); ui.toast('Raaste par hi raho.', 2) } }
    return
  }
  const c = sc.chassis, n = nearestOnPoly(L.rideCorr.pts, c.position.x, c.position.z)
  if (n.d > L.rideCorr.hw) { const k = L.rideCorr.hw / n.d; const nx = n.x + (c.position.x - n.x) * k, nz = n.z + (c.position.z - n.z) * k; c.position.x = nx; c.position.z = nz; { const ox = (c.position.x - n.x) / (L.rideCorr.hw || 1), oz = (c.position.z - n.z) / (L.rideCorr.hw || 1), vn = c.velocity.x * ox + c.velocity.z * oz; if (vn > 0) { c.velocity.x -= ox * vn; c.velocity.z -= oz * vn } } if (!G._edgeT || performance.now() - G._edgeT > 1500) { G._edgeT = performance.now(); ui.toast('Raaste par hi raho.', 2) } }
}
function playerUpdate(dt) {
  const p = G.player, L = G.level
  // look
  const lk = input.consumeLook(), s = 0.0022 * input.sens * (input.touch ? 1.1 : 1)
  if (p.mode === 'ride') { p.lookOff = clamp((p.lookOff || 0) - lk.x * s, -1.9, 1.9); p.pitch = clamp(p.pitch - lk.y * s, -0.8, 0.5); if (!lk.x) p.lookOff *= Math.exp(-dt * 0.6) }
  else if (p.canLook && !G.paused) { let dx = -lk.x * s; const LL = G.lookLimit; if (LL) { const rel = angDiff(LL.c, p.yaw); if (Math.abs(rel) > LL.w && Math.sign(dx) === Math.sign(rel)) dx *= 0.12 } p.yaw += dx; p.pitch = clamp(p.pitch - lk.y * s, -1.45, 1.45) }
  // left click = horn while riding; E = engine on/off
  if (G._hornT > 0) G._hornT -= dt
  if (p.mode === 'ride') {
    if (input.consumeClick() && G._hornT <= 0 && G.audio.ctx) { G._hornT = 0.65; audio.horn(G.scooter ? G.scooter.chassis.position : p.pos, 'car') }
    if (input.hit('KeyE')) G.toggleEngine()
  } else input.consumeClick()
  if (input.hit('KeyF')) G.toggleLight()
  if (input.hit('KeyH')) nav.help()
  if (input.hit('F3')) { G._dbg = !G._dbg; document.getElementById('dbg').classList.toggle('hidden', !G._dbg) }
  if (input.hit('KeyP')) phone.toggle()
  if (input.hit('KeyV')) G.toggleVisor()
  if (input.hit('KeyX')) G.toggleCam()
  if (input.hit('KeyG')) G.pushToggle()
  if (input.hit('KeyT')) fire.build(G)
  if (input.hit('KeyB')) { if (input.down('Shift')) G.toggleBikeHelmet(); else G.bikeAction() }
  if (input.hit('KeyC') && G.noCrouch) ui.reason('Is scene mein jhukna nahi — pehle scene khatam karo')
  const wantCrouch = input.down('KeyC') && !G.noCrouch
  if (p.mode === 'ride' || !p.canMove) { if (p.mode !== 'ride') { p.vel = damp(p.vel, 0, 8, dt); p.crouch = damp(p.crouch, wantCrouch ? 1 : 0, 8, dt) } return }
  const ax = input.axis(), run = input.down('Shift') || (input.touch && input.down('ShiftLeft'))
  const tiredF = 1 - p.tired * 0.28
  let sp = 1.55 * tiredF
  // stamina with hysteresis: after exhaustion you must regain 30% before sprinting again (no flicker)
  if (p.stamina <= 0.02) p.winded = true; else if (p.stamina > 0.3) p.winded = false
  if (run && ax.y > 0.3 && G.noRun && !p.push && !(G._rt > performance.now() - 6000)) {
    G._rt = performance.now()
    ui.reason(p.push ? 'Bike dhakelte waqt nahi daud sakte — G se chhodo pehle' : 'Is jagah daudna nahi — dhakelna ya chalna hoga')
  }
  const canRun = run && !p.winded && !p.push && ax.y > 0.3 && !G.noRun
  if (canRun) { sp = 3.5 * tiredF; p.stamina = Math.max(0, p.stamina - dt * (0.07 + p.tired * 0.05)) } else p.stamina = Math.min(1, p.stamina + dt * (0.22 - p.tired * 0.08) * (ax.x || ax.y ? 0.6 : 1.5))
  { const sb = document.getElementById('stam'); if (sb) { sb.style.opacity = (p.stamina < 0.98 || canRun) ? 0.85 : 0; sb.firstElementChild.style.width = (p.stamina * 100).toFixed(0) + '%'; sb.classList.toggle('winded', !!p.winded) } }
  // Shift+W while pushing the scooter: the friend joins in and helps push (faster)
  { const assist = p.push && run && ax.y > 0.3 && !!G.comp && !G.comp.attach; if (assist && !(G.assistT > 0)) ui.toast('Shift+W — Nishant peeche se dhakka laga raha hai, bike tez ho gayi', 2.5); G.assistT = assist ? 0.5 : Math.max(0, (G.assistT || 0) - dt) }
  if (p.push) {
    // brisk walk at the handlebars; sprinting calls the friend to shove from behind
    const two = G.assistT > 0 && !!G.comp, ground = clamp(G.surfaceCap(p.pos) / 6.5, 0.6, 1.25)
    sp = (two ? 2.75 : 1.4) * ground * tiredF * (G.mudSlow || 1)
    if (!two && (ax.x || ax.y)) p.stamina = Math.max(0, p.stamina - dt * 0.012)
    G.pushers = two ? 2 : 1
  } else G.pushers = 0
  p.crouch = damp(p.crouch, (wantCrouch || G.forceCrouch) && !p.push ? 1 : 0, 9, dt); sp *= 1 - p.crouch * 0.55
  sp *= p.speedMul
  const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }, r = { x: -f.z, z: f.x }
  let mx = f.x * ax.y + r.x * ax.x, mz = f.z * ax.y + r.z * ax.x
  const mag = Math.hypot(mx, mz); if (mag > 0.001) { mx /= Math.max(1, mag); mz /= Math.max(1, mag) }
  const tv = Math.hypot(mx, mz) * sp; p.vel = damp(p.vel, tv, 10, dt)
  const nx = p.pos.x + mx * sp * dt, nz = p.pos.z + mz * sp * dt
  const np = { x: nx, z: nz }; L.walk.resolve(np, 0.33)
  if (L.walk.lastClamp && (!G._bndT || performance.now() - G._bndT > 3500)) { G._bndT = performance.now(); ui.reason('Aage ghana andhera jungle hai — is raaste se aage koi rasta nahi, wapas chalna padega') }
  if (G.scooter && p.push) { /* scooter is a collider while pushing */ }
  else if (G.scooter && !p.push) { const c = G.scooter.chassis.position; const dx = np.x - c.x, dz = np.z - c.z, d = Math.hypot(dx, dz); if (d < 1.05) { const k = 1.05 / (d || 1e-3); np.x = c.x + dx * k; np.z = c.z + dz * k } }
  p.pos.x = np.x; p.pos.z = np.z
  if (L.groundY) p.pos.y = L.groundY(p.pos.x, p.pos.z)
  // head bob + footsteps
  const moving = tv > 0.2
  if (moving) { p.bobT += dt * (canRun ? 11.5 : 7.6) * (1 - p.tired * 0.12); p.stepT += dt * (canRun ? 11.5 : 7.6) ; if (p.stepT >= Math.PI) { p.stepT -= Math.PI; if (audio.ctx) audio.footstep(L.surface ? L.surface(p.pos.x, p.pos.z) : 'dirt', canRun ? 1.15 : 0.8 - p.crouch * 0.4) } }
  audio.st.breathRate = canRun ? 0.9 : moving ? 0.38 + p.tired * 0.12 : 0.24 + G.fear * 0.2
  audio.st.breathDepth = canRun ? 1.0 : moving ? 0.35 + p.tired * 0.2 : 0.16 + G.fear * 0.4 + p.tired * 0.2
  if (p.winded && run) audio.st.breathDepth = 1.2
}

function pushScooter(dt) {
  const p = G.player, sc = G.scooter, c = sc.chassis, f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }
  // the controlling rider walks beside the front of the bike with both hands on
  // the handlebars — the bike sits just ahead and to their right, not far behind
  const side = { x: -f.z, z: f.x }
  const tgt = { x: p.pos.x + f.x * 0.72 + side.x * 0.3, z: p.pos.z + f.z * 0.72 + side.z * 0.3 }
  G.level.walk.resolve(tgt, 0.3)
  const dx = tgt.x - c.position.x, dz = tgt.z - c.position.z
  c.velocity.x = dx * 9; c.velocity.z = dz * 9
  const dy = angDiff(sc.yaw, p.yaw); c.angularVelocity.y = dy * 6; sc.steer = damp(sc.steer, clamp(dy * 1.5, -0.5, 0.5), 5, dt)
  sc.vehicle.setSteeringValue(-sc.steer, 0); sc.vehicle.setSteeringValue(-sc.steer, 1)
  sc.vehicle.wheelInfos.forEach((w, i) => { sc.vehicle.setBrake(0, i); sc.vehicle.applyEngineForce(0, i) })
  // stay near player
  if (Math.hypot(c.position.x - p.pos.x, c.position.z - p.pos.z) > 3) { c.position.x = tgt.x; c.position.z = tgt.z }
  sc.lean = damp(sc.lean, 0, 3, dt); sc.parked = false
  // wheel roll visual from speed
  const sp = Math.hypot(c.velocity.x, c.velocity.z); sc.vehicle.currentVehicleSpeedKmHour = sp * 3.6 * (dx * f.x + dz * f.z >= 0 ? 1 : -1)
  if (G.level.surface && sp > 0.3 && G.level.surface(p.pos.x, p.pos.z) === 'mud' && Math.random() < dt * 1.5) audio.thud({ x: c.position.x, y: 0.2, z: c.position.z }, 0.12)
}

function updateInteract(dt) {
  items.reconcile(G) // self-heal item state drift every frame (world vs pocket)
  const p = G.player; let best = null, bd = 1e9
  if (p.canMove && p.mode !== 'ride') {
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw)
    for (const it of G.interacts) {
      if (it.enabled && !it.enabled()) continue
      const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z, d = Math.hypot(dx, dz)
      if (d > it.r) continue
      const dot = (dx * fx + dz * fz) / (d || 1); if (dot < it.cone && d > 0.9) continue
      if (d < bd) { bd = d; best = it }
    }
  }
  G.cur = best
  let tb = null, fa = null
  if (!best && p.canMove && p.mode !== 'ride' && !G.pit) { tb = items.near(G); if (tb && !items.label(G, tb)) tb = null }
  if (!best && !tb && p.canMove && p.mode !== 'ride' && !G.pit) fa = fire.near(G)
  const board = !best && !tb && !fa && G.scooter && p.canMove && p.mode !== 'ride' && !p.push && !G.pit && G.canBoard() && Math.hypot(G.scooter.chassis.position.x - p.pos.x, G.scooter.chassis.position.z - p.pos.z) < 2.6
  if (best) { ui.prompt(best.label, best.key === 'E' ? 'E' : best.key) }
  else if (tb) ui.prompt(items.label(G, tb), items.isReturn(G, tb) ? '⇧E' : 'E')
  else if (fa) ui.prompt(fire.label(G, fa), 'E')
  else if (board) ui.prompt('B — bike par baitho · G — dhakelo · Shift+B — helmet', 'B')
  else if (G.scooter && p.canMove && p.mode !== 'ride' && !p.push && !G.pit && !G.keyBusy && !G.camOverride && Math.hypot(G.scooter.chassis.position.x - p.pos.x, G.scooter.chassis.position.z - p.pos.z) < 2.8) {
    const why = G.boardBlock()
    if (why && (!G._bikeRoT || performance.now() - G._bikeRoT > 5000)) { G._bikeRoT = performance.now(); ui.reason(why) }
  }
  else if (G.scooter && p.canMove && p.mode !== 'ride' && p.push && !G.pit) ui.prompt('B — bike par baitho · G — handlebar chhodo', 'B')
  else if (p.mode === 'ride') ui.prompt((G.rideHint ? G.rideHint + '  ·  ' : '') + 'B — utro / band karo', 'B')
  else ui.prompt(null, 'E')
  // Taking an item: plain E. Putting it back: Shift+E (never a stray E).
  if (tb && input.hit('KeyE')) {
    const back = items.isReturn(G, tb)
    if (back && input.down('Shift')) items.use(G, tb)
    else if (!back) items.use(G, tb)
  }
  if (fa && input.hit('KeyE')) fire.use(G, fa)
  if (best && (input.hit('KeyE') || (input.hit('KeyB') && nearScooter(best.pos)))) { audio.click(); if (best.once) G.interacts.splice(G.interacts.indexOf(best), 1); if (best.onUse) best.onUse(); if (best.res) best.res() }
}

function updateCameraBase(dt) {
  // helmet narrows peripheral vision; the dropped visor narrows it further
  const hv = document.getElementById('helmetvision')
  if (hv) hv.style.opacity = G.hasHelmet ? (G.visorDown ? '0.92' : '0.5') : '0'
  const p = G.player, cam = G.camera
  if (G.camOverride) { const o = G.camOverride; if (o.snap) cam.position.copy(o.pos); else cam.position.lerp(o.pos, Math.min(1, dt * 4)); cam.lookAt(o.look); cam.fov = lerp(cam.fov, o.fov || 62, 0.1); cam.updateProjectionMatrix(); return }
  let ex, ey, ez, yaw = p.yaw, pitch = p.pitch, roll = 0
  if (p.mode === 'ride' && G.scooter) {
    const sc = G.scooter, v = _va; sc.eye.getWorldPosition(v)
    const q = _vq; sc.eye.getWorldQuaternion(q); const e = _ve.setFromQuaternion(q, 'YXZ')
    const spd = sc.speed, bump = Math.sin(performance.now() * 0.021) * 0.007 * clamp(Math.abs(spd) / 8, 0, 1)
    p.rideYaw = e.y; p.yaw = e.y + (p.lookOff || 0)
    cam.rotation.order = 'YXZ'; cam.position.set(v.x, v.y + bump, v.z); cam.rotation.set(p.pitch, p.yaw + Math.PI, -sc.lean * 0.5)
    { const px = sc.chassis.position.x, pz = sc.chassis.position.z; p.pos.set(px, G.level && G.level.groundY ? G.level.groundY(px, pz) : 0, pz) }
    cam.fov = lerp(cam.fov, ((G.cfg.fov || 70) + clamp(Math.abs(spd) / 11, 0, 1) * 10) * horror.fovFactor(), 0.05); cam.updateProjectionMatrix(); return
  }
  const eye = p.eyeH - p.crouch * 0.75 - p.headDip
  const bob = Math.sin(p.bobT) * 0.035 * (1 - p.crouch * 0.4) * (1 + p.tired * 0.4), sway = Math.cos(p.bobT * 0.5) * 0.02
  ex = p.pos.x; ez = p.pos.z; ey = p.pos.y + eye + bob
  const sh = G.shake; G.shake = Math.max(0, G.shake - dt * 1.2)
  cam.position.set(ex + Math.cos(p.yaw) * sway, ey + (Math.random() - 0.5) * sh * 0.05, ez - Math.sin(p.yaw) * sway)
  cam.rotation.order = 'YXZ'; cam.rotation.set(p.pitch + (Math.random() - 0.5) * sh * 0.02, p.yaw + Math.PI + (Math.random() - 0.5) * sh * 0.02, p.roll + Math.sin(p.bobT * 0.5) * 0.004 * (1 + p.tired))
  cam.fov = lerp(cam.fov, ((G.cfg.fov || 70) - p.crouch * 4 + (input.down('Shift') && p.vel > 2.5 ? 4 : 0)) * horror.fovFactor(), 0.08); cam.updateProjectionMatrix()
}

G.tpp = false
G.toggleCam = function () { G.tpp = !G.tpp; audio.click(); ui.toast(G.tpp ? 'Teesra view (TPP) · X se wapas' : 'Pehla view (FPP)', 1.6) }
// cinematic scene transitions: a crane move instead of a fade to black
G.cine = { k: 0, target: 0, rate: 1 }
G.cineSet = (k) => { G.cine.k = k; G.cine.target = k }
G.cineTo = (target, sec = 1.4) => { G.cine.target = target; G.cine.rate = 1 / Math.max(0.2, sec) }
function updateCamera(dt) {
  updateCameraBase(dt)
  const p = G.player, cam = G.camera, c = G.cine
  vm.update(dt); body.update(dt)
  if (G.camOverride) return
  if (G.tpp) {
    const dir = _va; cam.getWorldDirection(dir)
    const right = _vb.crossVectors(dir, _up).normalize(), ride = p.mode === 'ride'
    const L = G.level, indoor = L && L.isIndoors ? L.isIndoors(p.pos.x, p.pos.z) > 0.5 : false
    cam.position.addScaledVector(dir, -(ride ? 3.2 : indoor ? 1.5 : 2.5)).addScaledVector(right, 0.45); cam.position.y += 0.2
    if (!ride && L) { const q = { x: cam.position.x, z: cam.position.z }; L.walk.resolve(q, 0.25); cam.position.x = q.x; cam.position.z = q.z }
    if (cam.position.y < 0.15) cam.position.y = 0.15
  }
  if (c.k !== c.target) { const d = c.rate * dt; c.k = c.k < c.target ? Math.min(c.target, c.k + d) : Math.max(c.target, c.k - d) }
  if (c.k > 0.001) {
    const e = c.k * c.k * (3 - 2 * c.k), dir = _vc; cam.getWorldDirection(dir); dir.y = 0; dir.normalize()
    cam.position.addScaledVector(dir, -6.5 * e); cam.position.y += 7 * e
    cam.rotation.x -= 0.5 * e; cam.rotation.z += 0.06 * e
  }
}

function updateAudioState(dt) {
  const p = G.player, S = audio.st, env = G.env, L = G.level
  // torch smooth
  const tl = G.torch; tl.intensity = damp(tl.intensity, G.torchActive() ? 70 * G.torchPow : 0, 18, dt); G.torchFill.intensity = tl.intensity * 0.03
  G.torchTarget.position.x = damp(G.torchTarget.position.x, 0, 4, dt)
  // env -> audio
  const indoor = L.isIndoors ? L.isIndoors(p.pos.x, p.pos.z) : 0
  G.env.indoors = indoor > 0.9; S.indoors = indoor
  S.rain = env.rainAmt; S.tin = indoor > 0.5 && env.rainAmt > 0.1 && L.tinRoof ? env.rainAmt : 0
  S.wind = env.windV; S.gust = 0
  const now = env.name, night = ['night', 'storm', 'rain', 'drizzle', 'deep', 'still', 'predawn'].includes(now)
  S.insects = (now === 'dusk' || now === 'night' || now === 'drizzle' || now === 'predawn') && env.rainAmt < 0.5 ? 1 : (now === 'evening' ? 0.4 : 0)
  S.birds = (now === 'day' || now === 'homeDay' || now === 'evening' || now === 'dawn') ? 0.7 : 0
  S.frogs = env.rainAmt > 0.15 || now === 'drizzle' ? 0.5 : 0
  S.bamboo = L.bambooNear ? clamp(1 - L.bambooNear(p.pos.x, p.pos.z) / 25, 0, 1) : 0
  if (L.ambient) L.ambient(S, p)
  if (L.tickAudio) L.tickAudio(dt)
  const f = _va; G.camera.getWorldDirection(f)
  audio.update(dt, G.camera.position, f, _up)
  // clock label visible only when allowed
}

// story beats call this to show the phone on its own (opens the HUD phone briefly)
G.checkPhone = function () { if (G.hasPhone === false) return; phone.toggle(true); clearTimeout(G._phT); G._phT = setTimeout(() => phone.close(), 3500) }

// pointer events for debug in tests
window.__G = G
