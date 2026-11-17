// Free roaming + guard rails.
// In free-roam levels you can leave the road / trail. Dark pits (khadda) and the dark undergrowth keep you from
// wandering off forever: fall in (or stray too far) and the scooter is tossed, you tumble, and a cinematic shows
// the two friends pushing it back to the path before the ride starts again.
import * as THREE from 'three'
import { nearestOnPoly, RNG, damp, clamp } from './util.js'
import { audio } from './audio.js'
import { ui } from './ui.js'
import { ptAt, projDist } from '../world/common.js'

export function placePits(L, G) {
  const core = L.core; if (!core || !core.length || !L.roam) return
  const rnd = new RNG((L.roam.seed || 5) * 7 + 3), pits = (L.pits = [])
  const dark = new THREE.MeshBasicMaterial({ color: '#010101', transparent: true, opacity: 0.97, depthWrite: false })
  const halo = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.38, depthWrite: false })
  const rim = new THREE.MeshStandardMaterial({ color: '#3a2c1e', roughness: 1 })
  for (let tries = 0, n = 0; n < L.roam.pits && tries < 200; tries++) {
    const pl = core[Math.floor(rnd.next() * core.length)], i = 1 + Math.floor(rnd.next() * (pl.length - 2))
    const a = pl[i - 1], b = pl[i + 1], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, off = (14 + rnd.next() * 26) * (rnd.next() < 0.5 ? 1 : -1)
    const x = pl[i].x - dz / l * off, z = pl[i].z + dx / l * off
    if (core.some(c => nearestOnPoly(c, x, z).d < 13) || pits.some(q => Math.hypot(q.x - x, q.z - z) < 16) || (L.noPit && Math.hypot(x - L.noPit.x, z - L.noPit.z) < L.noPit.r)) continue
    const r = 2.0 + rnd.next() * 1.5
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), dark); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z); m.renderOrder = 2; L.add(m)
    const h = new THREE.Mesh(new THREE.CircleGeometry(r * 2.4, 18), halo); h.rotation.x = -Math.PI / 2; h.position.set(x, 0.03, z); L.add(h)
    const rg = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.5, 18), rim); rg.rotation.x = -Math.PI / 2; rg.position.set(x, 0.035, z); L.add(rg)
    pits.push({ x, z, r }); n++
  }
}

const nearestCore = (L, x, z) => { let best = null; for (const c of L.core) { const n = nearestOnPoly(c, x, z); if (!best || n.d < best.d) best = { ...n, pts: c } } return best }

export function roamUpdate(G, dt) {
  const L = G.level, p = G.player
  if (G.pit) return updatePit(G, dt)
  G.fearBoost = damp(G.fearBoost || 0, G._wantBoost || 0, 1.2, dt)
  if (!L || !L.core || !L.walk.free || !p.canMove || G.camOverride) { G._wantBoost = 0; return }
  G.pitCD = Math.max(0, (G.pitCD || 0) - dt)
  const ref = p.mode === 'ride' && G.scooter ? G.scooter.chassis.position : p.pos
  if (!G.pitCD) for (const pit of L.pits || []) if (Math.hypot(ref.x - pit.x, ref.z - pit.z) < pit.r - 0.1) return startPit(G, pit)
  G._strayT = (G._strayT || 0) - dt
  if (G._strayT <= 0) { G._strayT = 0.25; G.stray = nearestCore(L, ref.x, ref.z).d }
  const d = G.stray || 0, lim = L.roam.stray
  G._wantBoost = clamp((d - lim * 0.45) / (lim * 0.55), 0, 1) * 0.55
  if (d > lim * 0.6 && !G._warned) { G._warned = true; ui.toast('Raaste se bahut door... andhera ghana ho raha hai · Too far from the path, it is getting dark', 4) }
  if (d < lim * 0.4) G._warned = false
  if (d > lim && !G.pitCD) startPit(G, { x: ref.x, z: ref.z })
}

export function startCrash(G, pos) {
  if (G.pit || (G.pitCD || 0) > 0 || !G.level || !G.level.core || !G.player.canMove) return
  startPit(G, pos || G.player.pos, 'crash')
}

function startPit(G, pit, kind = 'pit') {
  const p = G.player, sc = G.scooter, ride = p.mode === 'ride' && !!sc
  G.pit = { t: 0, stage: 0, ride, wasPush: !!p.push }
  p.canMove = false; G.keyBusy = false; p.vel = 0
  if (ride) {
    audio.st.engine = 0; audio.st.rpm = 0; sc.light(false); ui.show('speedo', false); p.mode = 'walk'
    const c = sc.chassis; c.velocity.set((Math.random() - 0.5) * 5, 7.5, (Math.random() - 0.5) * 5); c.angularVelocity.set(Math.random() * 6, Math.random() * 4, Math.random() * 6)
    p.pos.set(c.position.x, 0, c.position.z)
    if (G.comp && G.comp.attach) { const co = G.comp; co.attach = null; co.pose('stand'); co.place(pit.x + 1.4, pit.z + 1.0, 0) }
  }
  audio.fall(p.pos); audio.thud(p.pos, 0.8); G.camShake(1); ui.flash(0.7)
  if (kind === 'crash') { audio.horn && audio.horn(p.pos, 'truck'); ui.caption('[tyres screech. A crash: metal, glass, shouting]', 3.4) } else ui.caption('[a hard fall into the dark]', 3)
  G.bodyPose = 'fallen'; G.showBody = true; G._wantBoost = 0.7; G.pitCD = 25
  G.camOverride = { pos: new THREE.Vector3(p.pos.x + 3.4, 2.4, p.pos.z + 3.4), look: new THREE.Vector3(p.pos.x, 0.5, p.pos.z), fov: 58, snap: true }
}

function updatePit(G, dt) {
  const P = G.pit, p = G.player, sc = G.scooter, L = G.level; P.t += dt
  const o = G.camOverride
  if (P.stage === 0) {                     // lying in the pit
    p.vel = 0; o.look.set(p.pos.x, 0.5, p.pos.z)
    if (P.t > 2.4) {
      const n = nearestCore(L, p.pos.x, p.pos.z), dx = n.x - p.pos.x, dz = n.z - p.pos.z, dist = Math.hypot(dx, dz) || 1
      P.target = { x: n.x, z: n.z, pts: n.pts }; P.dir = { x: dx / dist, z: dz / dist }; P.dist = dist; P.dur = clamp(dist / 1.5, 5, 14); P.t1 = 0
      P.yaw = Math.atan2(P.dir.x, P.dir.z); p.yaw = P.yaw; G.bodyPose = null
      P.hauled = 0; P.t2 = 0; p.push = false
      if (sc) { sc.place(p.pos.x + P.dir.x * 1.1, p.pos.z + P.dir.z * 1.1, P.yaw); sc.chassis.quaternion.setFromEuler(0.05, P.yaw, 1.2) }   // the scooter lies on its side
      ui.toast('Pehle scooter ko gaddhe se bahar kheencho... · Hauling the scooter out of the pit', 4)
      P.stage = 1
    }
    return
  }
  const rx = -P.dir.z, rz = P.dir.x
  if (P.stage === 1) {                      // both of them haul the scooter out, up the lip of the pit
    P.t2 += dt; const k = Math.min(1, P.t2 / 3.2), step = 1.8 * dt / 3.2
    p.pos.x += P.dir.x * step; p.pos.z += P.dir.z * step; P.hauled += step; p.vel = 0.9; G.bodyPose = 'push'; G.assistT = 0.5
    if (sc) { const c = sc.chassis; c.position.x = p.pos.x + P.dir.x * 1.1; c.position.z = p.pos.z + P.dir.z * 1.1; c.position.y = 0.45 + 0.35 * Math.sin(k * 3.1416) + k * 0.15; c.velocity.set(0, 0, 0); c.angularVelocity.set(0, 0, 0); c.quaternion.setFromEuler(0, P.yaw, 1.2 * (1 - k)) }
    o.pos.set(p.pos.x + rx * 3.2 - P.dir.x * 1.2, 0.9 + k * 0.6, p.pos.z + rz * 3.2 - P.dir.z * 1.2); o.look.set(p.pos.x + P.dir.x * 0.8, 0.7, p.pos.z + P.dir.z * 0.8)
    if (k >= 1) { if (sc) { sc.place(p.pos.x + P.dir.x * 1.2, p.pos.z + P.dir.z * 1.2, P.yaw); p.push = true; sc.parked = false }; P.stage = 2 }
    return
  }
  if (P.stage === 2) {                      // push it back to the path, camera ahead of them
    P.t1 += dt; const k = Math.min(1, P.t1 / P.dur), sp = P.dist / P.dur
    const q = { x: p.pos.x + P.dir.x * sp * dt, z: p.pos.z + P.dir.z * sp * dt }; L.walk.resolve(q, 0.4); p.pos.x = q.x; p.pos.z = q.z
    p.yaw = P.yaw; p.vel = sp; G.assistT = 0.5; G.bodyPose = null
    o.pos.set(p.pos.x + P.dir.x * 5.2 + rx * 2.4, 1.5, p.pos.z + P.dir.z * 5.2 + rz * 2.4); o.look.set(p.pos.x + P.dir.x * 0.6, 1.0, p.pos.z + P.dir.z * 0.6)
    if (k >= 1 || Math.hypot(P.target.x - p.pos.x, P.target.z - p.pos.z) < 0.6) {
      if (!(P.ride && sc)) return finishPit(G)
      P.stage = 3; P.t3 = 0; p.push = false; p.vel = 0; G.assistT = 0; sc.place(P.target.x + P.dir.x * 1.2, P.target.z + P.dir.z * 1.2, P.yaw); sc.park()
      const yw = ptAt(P.target.pts, projDist(P.target.pts, P.target.x, P.target.z)).yaw; P.yaw2 = yw
      G.bodyPose = 'stand'; ui.toast('Wapas raaste par. Chabi lagao, scooter phir start karo · Back on the road: key in, start it again', 4)
    }
    return
  }
  // stage 3: on the road again; the scooter is switched on and the camera swings round behind Nishan
  if (!sc) return finishPit(G)
  P.t3 += dt; const k3 = Math.min(1, P.t3 / 3.4)
  if (!P.lit && P.t3 > 1.0) { P.lit = true; sc.light(true); audio.click(); caption3('[the key turns. The engine catches]') }
  const bx = p.pos.x - Math.sin(p.yaw) * 3.0, bz = p.pos.z - Math.cos(p.yaw) * 3.0, fx = p.pos.x + rx * 3.0 + P.dir.x * 1.5, fz = p.pos.z + rz * 3.0 + P.dir.z * 1.5
  o.pos.set(fx + (bx - fx) * k3, 1.3 + 0.3 * k3, fz + (bz - fz) * k3); o.look.set(p.pos.x + Math.sin(p.yaw) * 1.0, 1.2, p.pos.z + Math.cos(p.yaw) * 1.0)
  if (k3 >= 1) finishPit(G)
}
const caption3 = (t) => ui.caption(t, 2.6)

function finishPit(G) {
  const P = G.pit, p = G.player, sc = G.scooter, T = P.target
  G.camOverride = null; G.showBody = false; G.bodyPose = null; p.push = !!P.wasPush; p.vel = 0; p.canMove = true; G.assistT = 0
  p.pos.set(T.x, 0, T.z)
  const yaw = ptAt(T.pts, projDist(T.pts, T.x, T.z)).yaw; p.yaw = yaw
  if (sc) { sc.place(T.x + Math.sin(yaw) * 1.3, T.z + Math.cos(yaw) * 1.3, yaw); if (!P.wasPush) sc.park(); sc.sync(0.016) }
  G._wantBoost = 0; G.pit = null
  if (P.ride && sc) { G.mount(sc); ui.toast('Chabi lagi, scooter phir start · Key in, back on the road', 3.5) }
  else ui.toast('Wapas raaste par · Back on the path', 3)
}
