// Road traffic with simple vehicle physics: lanes, car-following (acceleration limits, braking distance), overtaking,
// horns, and real crashes with the player. Vehicles keep to the left of their own heading (Indian traffic).
import * as THREE from 'three'
import { carModel, motorbike, truck } from './build.js'
import { ptAt, projDist } from './common.js'
import { R } from '../core/util.js'
import { vehicle, human } from './variety.js'
import { lod } from './lod.js'
import { startCrash } from '../core/roam.js'

const COLORS = ['#c8c8c8', '#8a1c1c', '#1d3f7a', '#e0d8c0', '#2d5a3a', '#3a3a3e', '#b8892a']
const SPEC = {
  car: { len: 4.2, v: [10, 15] }, truck: { len: 7.5, v: [7, 10] }, bike: { len: 2.0, v: [9, 13] },
  auto: { len: 2.6, v: [7, 11] }, van: { len: 4.4, v: [9, 13] }, tractor: { len: 3.4, v: [4, 7] },
  cycle: { len: 1.8, v: [3, 5] }, cart: { len: 3.2, v: [2, 4] }
}
// Silhouette variants per kind — the mesh factory decides the actual shape.
const VARIANTS = {
  bike: ['standard', 'sports', 'cruiser', 'dirt'], car: ['hatch', 'sedan', 'suv'],
  truck: ['cargo', 'tanker'], auto: ['green', 'yellow', 'black'],
  van: ['tempo', 'delivery'], tractor: ['red', 'blue', 'green'],
  cycle: ['road', 'gear'], cart: ['wood', 'painted']
}
const AUTO_COLORS = { green: '#2d7a3a', yellow: '#d8b02a', black: '#3a3a3e' }
const RAD = { truck: 2.6, bike: 1.3, auto: 1.8, van: 2.2, tractor: 2.2, cycle: 1.0, cart: 2.0 }
const hornOf = (k) => (k === 'truck' || k === 'tractor' ? 'truck' : 'car')

export function makeTraffic(L, G, pts, o = {}) {
  const count = o.count ?? 7, lanesAt = o.lanesAt || (() => [o.lane ?? 2.1]), len = pts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0)
  const vs = []
  const mkMesh = (kind, seed) => {
    const variants = VARIANTS[kind] || ['standard']
    const n = Math.abs(Math.floor(Math.sin(seed) * 10000)) % variants.length
    const variant = variants[n]
    const color = kind === 'auto' ? (AUTO_COLORS[variant] || '#2d7a3a')
      : COLORS[Math.abs(Math.floor(Math.sin(seed * 3) * 10000)) % COLORS.length]
    return vehicle({ kind, variant, color })
  }
  // every vehicle gets a rider with an age / build / role variety
  const addRider = (mesh, kind, seed) => {
    const ages = ['teen', 'adult', 'adult', 'elder']
    const p = human({ age: ages[Math.abs(Math.floor(Math.sin(seed * 7) * 10000)) % ages.length], female: kind === 'cycle' || kind === 'cart' ? false : (seed % 5) === 0 })
    lod.register(p) // full rig up close, 3-mesh proxy far away
    const SCALE = { car: 0.66, truck: 0.8, bike: 0.88, auto: 0.85, van: 0.7, tractor: 0.9, cycle: 0.86, cart: 0.9 }
    const SEAT = {
      bike: [0, 0.5, -0.25], car: [-0.36, 0.05, 0.3], truck: [0, 0.12, 3.3],
      auto: [0, 0.35, 0.1], van: [-0.4, 0.05, 1.5], tractor: [0, 0.95, -0.25],
      cycle: [0, 0.9, -0.3], cart: [0, 0.9, -0.6]
    }
    p.root.scale.setScalar(SCALE[kind] || 0.85)
    const seat = SEAT[kind] || [0, 0.5, 0]
    p.root.position.set(seat[0], seat[1], seat[2])
    p.root.rotation.y = Math.PI // facing the vehicle's +z forward
    p.setPose(kind === 'bike' || kind === 'cycle' ? 'pillion' : 'sit')
    mesh.add(p.root)
    return p
  }
  // A believable Indian road: cars and bikes dominate, autos are common,
  // with the odd tempo, tractor, cycle and bullock cart.
  const kinds = ['car', 'bike', 'auto', 'truck', 'car', 'bike', 'auto', 'cycle', 'car', 'van', 'bike', 'tractor', 'car', 'cart', 'bike', 'truck', 'auto', 'car', 'cycle', 'car']
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length], m = mkMesh(kind, i + 1); m.visible = false; L.add(m)
    const rider = addRider(m, kind, 1000 + i * 37)
    vs.push({ m, rider, kind, len: SPEC[kind].len, dir: i % 2 ? -1 : 1, d: 0, speed: 0, want: 12, pref: i % 3 === 0 ? 1 : 0, lat: 0, wait: R.range(0, 6), near: false, honkT: 0, lcT: 0 })
  }
  const respawn = (v, p0) => {
    const sp = SPEC[v.kind]; v.want = R.range(sp.v[0], sp.v[1]) * (o.speedMul || 1); v.speed = v.want * 0.8
    v.d = v.dir > 0 ? p0 - R.range(90, 230) : p0 + R.range(150, 320)
    v.near = false; v.honkT = R.range(0, 5); v.pref = R.next() < 0.35 ? 1 : 0
  }
  // lateral coordinate along the path normal (+ = the "off > 0" side) for a vehicle in lane offset `lane` of heading `dir`
  const latOf = (dir, lane) => (dir > 0 ? -lane : lane)
  let init = false
  L.updaters.push((dt) => {
    const riding = G.player.mode === 'ride' && G.scooter
    const pl = riding ? G.scooter.chassis.position : G.player.pos
    const p0 = projDist(pts, pl.x, pl.z), q0 = ptAt(pts, p0)
    const plat = (pl.x - q0.x) * -Math.cos(q0.yaw) + (pl.z - q0.z) * Math.sin(q0.yaw)    // the player's lateral position on the road
    const pspd = riding ? Math.abs(G.scooter.speed) : Math.hypot(G.player.vel || 0)
    if (!init) { init = true; vs.forEach(v => respawn(v, p0)) }
    for (const v of vs) {
      if (v.wait > 0) { v.wait -= dt; v.m.visible = v.d >= 0 && v.d <= len && v.speed > 0; if (v.wait > 0) continue }
      const lanes = lanesAt(v.d), lane = lanes[Math.min(v.pref, lanes.length - 1)]
      v.lat += (latOf(v.dir, lane) - v.lat) * Math.min(1, dt * 1.6)
      // ---- find the car in front (same direction, same lane, ahead) ----
      let gap = 1e9, lead = null
      for (const w of vs) { if (w === v || w.dir !== v.dir || Math.abs(w.lat - v.lat) > 1.9) continue; const ahead = (w.d - v.d) * v.dir; if (ahead > 0 && ahead < gap) { gap = ahead; lead = w } }
      for (const w of (o.obstacles || [])) { if (Math.abs(w.lat - v.lat) > 2.3) continue; const ahead = (w.d - v.d) * v.dir; if (ahead > 0 && ahead < gap) { gap = ahead; lead = { speed: 0, len: w.len, d: w.d } } }
      let leadSpeed = lead ? lead.speed : v.want, gapNet = gap - (lead ? (v.len + lead.len) / 2 : 0)
      // the player counts as an obstacle too
      const pAhead = (p0 - v.d) * v.dir
      if (pAhead > 0 && pAhead < gap && Math.abs(plat - v.lat) < 1.9) { gap = pAhead; lead = null; leadSpeed = pspd; gapNet = pAhead - v.len / 2 - 1.2; v.blockedByPlayer = true } else v.blockedByPlayer = false
      // ---- car-following: target speed from the gap, with comfortable braking ----
      const safe = 5 + v.speed * 0.9
      let target = v.want
      if (gapNet < safe * 2) target = Math.min(v.want, leadSpeed + (gapNet - safe) * 0.7)
      if (gapNet < 3) target = Math.min(target, Math.max(0, leadSpeed - 1))
      target = Math.max(0, target)
      v.speed += Math.max(-9 * dt, Math.min(3.2 * dt, target - v.speed))
      // ---- overtake: blocked and the other lane (if any) is clear ----
      v.lcT -= dt
      if (gapNet < safe && v.speed < v.want * 0.7 && lanes.length > 1 && v.lcT <= 0) {
        const other = v.pref === 0 ? 1 : 0, ol = latOf(v.dir, lanes[other]); let free = true
        for (const w of vs) { if (w === v || w.dir !== v.dir) continue; if (Math.abs(w.lat - ol) < 2.4 && Math.abs(w.d - v.d) < 14) { free = false; break } }
        if (Math.abs(plat - ol) < 2.4 && Math.abs(p0 - v.d) < 14) free = false
        if (free) { v.pref = other; v.lcT = 6; if (G.audio.ctx && Math.random() < 0.5) G.audio.horn({ x: v.m.position.x, y: 1, z: v.m.position.z }, hornOf(v.kind)) }
      } else if (v.pref === 1 && gapNet > safe * 3 && v.lcT <= 0 && lanes.length > 1) { v.pref = 0; v.lcT = 5 }
      // ---- horn at whoever is in the way ----
      v.honkT -= dt
      if (v.blockedByPlayer && gapNet < 9 && v.speed < v.want * 0.6 && v.honkT <= 0 && G.audio.ctx) { v.honkT = 3.5 + Math.random() * 2; G.audio.horn({ x: v.m.position.x, y: 1, z: v.m.position.z }, hornOf(v.kind)) }
      v.d += v.dir * v.speed * dt
      const out = v.dir > 0 ? v.d > p0 + 280 : v.d < p0 - 170
      if (out) { respawn(v, p0); v.wait = R.range(0, 8); v.lat = latOf(v.dir, lanes[0]); v.m.visible = false; continue }
      if (v.d < 0 || v.d > len) { v.m.visible = false; continue }
      const q = ptAt(pts, v.d), yaw = v.dir > 0 ? q.yaw : q.yaw + Math.PI
      // lateral position along the path normal; a small yaw during a lane change
      const nx = -Math.cos(q.yaw), nz = Math.sin(q.yaw), tgt = latOf(v.dir, lane), steer = (v.lat - tgt) * 0.04 * v.dir
      v.m.position.set(q.x + nx * v.lat, 0, q.z + nz * v.lat); v.m.rotation.y = yaw + steer; v.m.visible = true
      if (v.rider) { v.rider.update(dt, v.speed); v.rider.root.rotation.z = steer * 1.6 }
      const dx = v.m.position.x - pl.x, dz = v.m.position.z - pl.z, dist = Math.hypot(dx, dz)
      if (!v.near && dist < 40) { v.near = true; if (G.audio.ctx) { const a = { x: v.m.position.x, y: 1, z: v.m.position.z }; G.audio.passBy(a, { x: pl.x, y: 1, z: pl.z }, 3.5, hornOf(v.kind)); if (Math.random() < 0.55) setTimeout(() => G.audio.horn(a, hornOf(v.kind)), 900) } }
      // crashes: fast into a vehicle (or a vehicle into a walker) is a real accident; a gentle touch just shoves
      const rad = RAD[v.kind] || 2.0
      if (dist < rad && riding && Math.abs(G.scooter.speed) > 3) { v.speed = 0; v.wait = 4; startCrash(G, { x: pl.x, z: pl.z }); continue }
      if (dist < rad && riding) { const c = G.scooter.chassis; c.velocity.x += (dx > 0 ? -1 : 1) * 2.2; c.velocity.z *= 0.8; G.camShake(0.4); if (G.audio.ctx) G.audio.thud(null, 0.5) }
      else if (dist < 1.4 && !riding && v.speed > 4) { v.speed = 0; v.wait = 3; startCrash(G, { x: pl.x, z: pl.z }); continue }
    }
  })
  return vs
}
