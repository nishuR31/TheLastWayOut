// shared helpers for level modules
import * as THREE from 'three'
import { Level } from './build.js'
import { scatterForest } from './nature.js'
import { rolling } from './terrain.js'
import { nearestOnPoly } from '../core/util.js'
import { tex, withPBR } from './textures.js'

// Catmull-Rom smoothing of a polyline -> dense points
export function smoothPts(pts, per = 6) {
  const P = pts.map(p => (Array.isArray(p) ? { x: p[0], z: p[1] } : p)), out = []
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)]
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) })
    }
  }
  out.push(P[P.length - 1]); return out
}
export const polyLen = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return l }
export function ptAt(pts, d) { // point at distance d along polyline
  let acc = 0
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); if (acc + l >= d) { const k = (d - acc) / l; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * k, yaw: Math.atan2(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) } } acc += l }
  const a = pts[pts.length - 2], b = pts[pts.length - 1]; return { x: b.x, z: b.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) }
}
// distance travelled along polyline for nearest point
export function projDist(pts, x, z) {
  let best = 1e9, bd = 0, acc = 0
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1].x, az = pts[i - 1].z, bx = pts[i].x, bz = pts[i].z, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz), l = Math.sqrt(l2)
    if (d < best) { best = d; bd = acc + l * t } acc += l
  }
  return bd
}

// A forest level made of trails. o: {name, trails:[{pts,hw,tex,rep,y}], bounds, density, seed, ground:'grass', tint, avoid, groundSize}
export function forestLevel(G, o) {
  const L = new Level(G, o.name)
  if (o.rolling !== false) rolling(L, o.seed || 3, o.relief ?? 1.5)
  const gs = o.groundSize || [500, 700, 0, 0]
  L.ground(gs[0], gs[1], o.ground || 'grass', 7, gs[2], gs[3], o.groundColor || 0xffffff)
  for (const t of o.trails) {
    t.pts = smoothPts(t.pts, 6)
    if (!t.noRibbon) t.mesh = L.ribbon(t.pts, t.hw * 0.95, t.tex || 'mud', t.rep || 3, t.y || 0.012, t.color || 0xffffff)
    if (!t.noWalk) L.walk.corridor(t.pts, t.hw, t.name || 'trail')
  }
  if (o.bounds) L.add(scatterForest(G, { bounds: o.bounds, trails: o.trails, density: o.density || 0.05, seed: o.seed || 3, avoid: o.avoid || [], walk: L.walk, tint: o.tint, allTrees: o.freeRoam !== false, mode: o.natural === false ? undefined : 'natural', level: L }))
  const trails = o.trails
  L.surface = (x, z) => { for (const t of trails) if (nearestOnPoly(t.pts, x, z).d < t.hw) return t.surface || 'mud'; return 'grass' }
  L.trails = trails
  { const wb = o.walkBound || o.bounds; if (wb) L.walk.bound = { x0: wb[0] + 2, z0: wb[1] + 2, x1: wb[2] - 2, z1: wb[3] - 2 } }
  if (o.freeRoam !== false) { const fr = o.freeRoam || {}; L.walk.free = true; L.core = trails.map(t => t.pts); L.roam = { stray: fr.stray || 48, pits: fr.pits ?? 8, seed: o.seed || 3 } }
  return L
}
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z)

// point at distance d along polyline, offset sideways by off (positive = left of travel direction)
export function sideAt(pts, d, off = 0) {
  const p = ptAt(pts, d), nx = Math.cos(p.yaw), nz = -Math.sin(p.yaw)
  return { x: p.x + nx * -off, z: p.z + nz * -off, yaw: p.yaw }
}

// round clearing: textured disc + walkable disc
export function clearing(L, x, z, r, name = '', texKey = 'mud', rep = 4) {
  const t = tex[texKey]().clone(); t.needsUpdate = true; t.repeat.set(r * 2 / rep, r * 2 / rep)
  const m = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 28), withPBR(new THREE.MeshStandardMaterial({ map: t, roughness: 1 })))
  m.rotation.x = -Math.PI / 2; m.position.set(x, (L.groundY ? L.groundY(x, z) : 0) + 0.013, z); m.receiveShadow = true; L.add(m)
  L.walk.disc(x, z, r, name); return m
}
// far-away lantern glow (not fogged so it can be seen through the dark)
export function farLight(L, x, y, z, size = 9, color = '#ffb25a') {
  const g = new THREE.Group(); g.position.set(x, y, z)
  const mk = (sz, op) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow(), color, transparent: true, opacity: op, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false })); s.scale.setScalar(sz); s.renderOrder = 5; g.add(s); return s }
  const a = mk(size, 0.9), b = mk(size * 0.35, 1)
  L.updaters.push((dt, t) => { const k = 0.8 + 0.2 * Math.sin(t * 9) + 0.1 * Math.sin(t * 23.3); a.material.opacity = 0.75 * k; b.material.opacity = 0.9 * k })
  L.add(g); return g
}
// bush that can be told to shake (event scares)
export function shakyBush(L, bushFn, x, z, s = 1.2) {
  const b = bushFn(s); b.position.set(x, 0, z); L.add(b); b.userData.k = 0; b.userData.base = b.position.clone()
  L.updaters.push((dt, t) => { const k = b.userData.k; if (k > 0.001) { b.userData.k = Math.max(0, k - dt * 0.9); b.position.x = b.userData.base.x + Math.sin(t * 38) * 0.06 * k; b.rotation.z = Math.sin(t * 31) * 0.12 * k; b.rotation.x = Math.cos(t * 27) * 0.08 * k } else { b.rotation.z = 0; b.rotation.x = 0; b.position.copy(b.userData.base) } })
  b.shake = () => { b.userData.k = 1 }; return b
}
// sway of bamboo/siris with wind
export function windSway(L, G, items) {
  L.updaters.push((dt, t) => { const w = 0.25 + G.env.windV * 2.2; items.forEach((o, i) => { o.rotation.z = Math.sin(t * 1.3 + i * 1.7) * 0.012 * w; o.rotation.x = Math.cos(t * 1.1 + i) * 0.009 * w }) })
}
export function makeSnake() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#2a2a1c', roughness: 0.5 }), segs = []
  for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.035 - i * 0.0008, 6, 5), m); s.scale.z = 1.6; s.position.y = 0.035; g.add(s); segs.push(s) }
  g.userData.segs = segs; g.visible = false; return g
}

// random distant night sounds (owl, dog, jackal, peacock). o: {owl,dog,jackal,peacock} multipliers (0 = off)
import { R as _R } from '../core/util.js'
export function nightTick(L, G, o = {}) {
  const t = { owl: _R.range(4, 12), dog: _R.range(20, 40), jackal: _R.range(40, 80), peacock: _R.range(30, 60) }
  const fns = { owl: 'owl', dog: 'dog', jackal: 'jackal', peacock: 'peacock' }
  const rate = { owl: [12, 28], dog: [30, 70], jackal: [60, 120], peacock: [50, 110] }
  L.tickAudio = (dt) => {
    if (!G.audio.ctx || G.stopped) return
    const p = G.player.pos
    for (const k in t) {
      const m = o[k] === undefined ? 1 : o[k]; if (!m) continue
      t[k] -= dt; if (t[k] <= 0) { t[k] = _R.range(rate[k][0], rate[k][1]) / m; const a = _R.range(0, 6.28), r = _R.range(28, 60); G.audio[fns[k]]({ x: p.x + Math.sin(a) * r, y: 3, z: p.z + Math.cos(a) * r }) }
    }
  }
}
export function trailOf(L, name) { return L.trails.find(t => t.name === name) }
