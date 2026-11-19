// Indian-forest kit: instanced trees, peepal, banyan, bamboo, undergrowth, rocks
import * as THREE from 'three'
import { tex, withPBR } from './textures.js'
import { RNG, nearestOnPoly, clamp, noise2 } from '../core/util.js'

const mat = (o) => withPBR(new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...o }))
let _geo
function geos() {
  if (_geo) return _geo
  const trunk = new THREE.CylinderGeometry(0.55, 1, 1, 6, 1); trunk.translate(0, 0.5, 0)
  const blob = new THREE.IcosahedronGeometry(1, 1); const p = blob.attributes.position, r = new RNG(3)
  for (let i = 0; i < p.count; i++) { const k = 0.78 + r.next() * 0.44; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k) }
  blob.computeVertexNormals()
  const card = new THREE.PlaneGeometry(1, 1); card.translate(0, 0.5, 0)
  const rock = new THREE.IcosahedronGeometry(1, 1); const rp = rock.attributes.position
  for (let i = 0; i < rp.count; i++) { const k = 0.7 + r.next() * 0.5; rp.setXYZ(i, rp.getX(i) * k * 1.2, rp.getY(i) * k * 0.7, rp.getZ(i) * k) } rock.computeVertexNormals()
  return (_geo = { trunk, blob, card, rock })
}

export function makeInstances(group, geo, material, mats, colors, shadow = false) {
  const m = new THREE.InstancedMesh(geo, material, mats.length)
  mats.forEach((mm, i) => { m.setMatrixAt(i, mm); if (colors) m.setColorAt(i, colors[i]) })
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true
  m.castShadow = shadow; m.receiveShadow = false
  // Static transforms: a real bounding sphere lets the renderer skip whole
  // forests that are behind the camera instead of submitting every instance.
  m.frustumCulled = true; if (m.computeBoundingSphere) m.computeBoundingSphere()
  group.add(m); return m
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3()
const mtx = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => { _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz); return new THREE.Matrix4().compose(_p, _q, _s) }

// scatter dense forest around trails. opts: {bounds:[x0,z0,x1,z1], trails:[{pts,hw}], density, seed, wrapZ:{z0,z1}, avoid:[{x,z,r}], walk, tint}
export function scatterForest(G, opts) {
  const g = geos(), r = new RNG(opts.seed || 1), group = new THREE.Group()
  const [x0, z0, x1, z1] = opts.bounds, dens = (opts.density || 0.05) * G.cfg.density
  const area = (x1 - x0) * (z1 - z0), N = Math.floor(area * dens)
  const tr = [], cn = [], tc = [], cc = [], fm = [], gm = [], bushM = [], lf = []
  // 'natural' mode breaks the straight rank of trees beside a path (a fixed
  // clearance radius makes two tidy walls) by modulating that clearance with
  // noise, and uses a jittered grid so trees never coincide or leave big holes.
  const natural = opts.mode === 'natural'
  // Auto-exclude every building footprint on the level, so no tree ever grows
  // through a house (a hard-won bug: trees were appearing in the bedroom).
  const houseAvoid = []
  if (opts.level) {
    const houses = [...(opts.level.doorHouses || []), opts.level.house].filter(Boolean)
    for (const h of houses) if (typeof h.x === 'number' && typeof h.z === 'number') {
      houseAvoid.push({ x: h.x, z: h.z, r: Math.max(h.w || 6, h.d || 6) * 0.75 + 3 })
    }
  }
  const noGo = [...(opts.avoid || []), ...houseAvoid]
  // Cheap AABB reject before the O(segments) polyline projection. With a
  // 73-point forest trail and ~10k undergrowth samples this was the bulk of
  // level-build time on slower machines.
  const trailBoxes = (opts.trails || []).map(t => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
    for (const p of t.pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z }
    const pad = t.hw + 6
    return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad, t }
  })
  const farFromTrails = (x, z, m) => {
    const wob = natural ? noise2(x * 0.035, z * 0.035) * 3.6 : 0
    for (const b of trailBoxes) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && nearestOnPoly(b.t.pts, x, z).d < b.t.hw + m + wob) return false
    for (const a of noGo) if (Math.hypot(x - a.x, z - a.z) < a.r) return false
    return true
  }
  const samplePoints = (count, gap) => {
    if (!natural) { const a = []; for (let i = 0; i < count; i++) a.push([r.range(x0, x1), r.range(z0, z1)]); return a }
    const spacing = Math.max(gap, Math.sqrt(area / Math.max(1, count)) * 0.85)
    const cols = Math.ceil((x1 - x0) / spacing), rows = Math.ceil((z1 - z0) / spacing), out = []
    for (let cz = 0; cz < rows; cz++) for (let cx = 0; cx < cols; cx++) {
      const x = x0 + (cx + 0.15 + r.next() * 0.7) * spacing, z = z0 + (cz + 0.15 + r.next() * 0.7) * spacing
      if (x > x1 || z > z1) continue
      if (r.next() > 0.45 + noise2(x * 0.02, z * 0.02) * 0.6) continue
      out.push([x, z])
    }
    return out
  }
  const col = new THREE.Color()
  const ground = (x, z) => (opts.level && opts.level.groundY ? opts.level.groundY(x, z) : 0)
  const place = (x, z, dz = 0) => {
    const s = r.range(0.8, 1.5), h = r.range(7, 13) * s, tw = r.range(0.22, 0.4) * s, gy = ground(x, z + dz)
    tr.push(mtx(x, gy, z + dz, tw, h * 0.72, tw, r.range(0, 6.28), r.range(-0.04, 0.04), r.range(-0.04, 0.04)))
    const cr = r.range(2.2, 3.8) * s
    for (let k = 0; k < 3; k++) { cn.push(mtx(x + r.range(-1.2, 1.2), gy + h * (0.72 + k * 0.1), z + dz + r.range(-1.2, 1.2), cr * r.range(0.8, 1.1), cr * r.range(0.8, 1.1), cr * r.range(0.8, 1.1), r.range(0, 6))); col.setHSL(0.26 + r.range(-0.03, 0.04), 0.4, r.range(0.14, 0.26)); cc.push(col.clone()) }
    // Leafy silhouette instead of three bare balls: a few crossed foliage cards
    // around each crown break up the "lollipop" outline.
    for (let k = 0; k < 6; k++) {
      const a = r.range(0, 6.28), rad = cr * r.range(0.45, 1.1)
      // lower cards flare outward so the crown reads as a canopy, not a ball
      const low = k >= 4 ? 0.14 : 0
      lf.push(mtx(x + Math.cos(a) * rad * (1 + low), gy + h * (r.range(0.78, 1.0) - low), z + dz + Math.sin(a) * rad * (1 + low), cr * r.range(0.8, 1.25), cr * r.range(0.8, 1.2), 1, a, r.range(-0.5, 0.2)))
    }
    if (opts.walk && (opts.allTrees || nearestOnPoly(opts.trails[0].pts, x, z).d < (opts.trails[0].hw + 14))) opts.walk.circle(x, z + dz, tw * 1.05 + 0.1)
  }
  const wrap = opts.wrapZ
  for (const [x, z] of samplePoints(N, 4.2)) {
    if (!farFromTrails(x, z, 1.4)) continue
    place(x, z)
    if (wrap && !natural) { const per = wrap.z1 - wrap.z0; place(x, z, per); place(x, z, -per) }
  }
  // undergrowth (ferns, grass cards, bushes)
  const U = Math.floor(area * 0.06 * G.cfg.density)
  for (const [x, z] of samplePoints(U, 1.4)) {
    if (!farFromTrails(x, z, 0.5)) continue
    const dzs = wrap ? [0, wrap.z1 - wrap.z0, wrap.z0 - wrap.z1] : [0]
    const kind = r.next(), s = r.range(0.7, 1.7), ry = r.range(0, 6.28)
    for (const dz of dzs) {
      const gy = ground(x, z + dz)
      if (kind < 0.4) fm.push(mtx(x, gy, z + dz, s * 1.3, s * 1.0, s * 1.3, ry))
      else if (kind < 0.85) gm.push(mtx(x, gy, z + dz, s * 1.1, s * 0.9, s * 1.1, ry))
      else bushM.push(mtx(x, gy + 0.35 * s, z + dz, 0.9 * s, 0.7 * s, 0.9 * s, ry))
    }
  }
  const trunkMat = mat({ map: tex.bark(), color: opts.tint || 0xffffff }), leafMat = mat({ map: tex.leaf(), color: 0xffffff })
  makeInstances(group, g.trunk, trunkMat, tr, null, true)
  makeInstances(group, g.blob, leafMat, cn, cc, true)
  const cardMat = (t) => new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 })
  const card2 = (arr, t, sc) => { if (!arr.length) return; const a = arr.map(m => m.clone()); makeInstances(group, g.card, cardMat(t), a); const b = arr.map(m => { const q = new THREE.Matrix4().makeRotationY(Math.PI / 2); return m.clone().multiply(q) }); makeInstances(group, g.card, cardMat(t), b) }
  card2(fm, tex.fern(), 1); card2(gm, tex.grassBlades(), 1)
  if (lf.length) card2(lf, tex.foliage(), 1)
  if (bushM.length) makeInstances(group, g.blob, leafMat, bushM)
  // rocks
  const rocks = []; for (let i = 0; i < area * 0.0035; i++) { const x = r.range(x0, x1), z = r.range(z0, z1); if (!farFromTrails(x, z, 0.8)) continue; const s = r.range(0.3, 1.0); rocks.push(mtx(x, ground(x, z) + s * 0.2, z, s, s, s, r.range(0, 6))); if (wrap) { const per = wrap.z1 - wrap.z0; rocks.push(mtx(x, ground(x, z + per) + s * 0.2, z + per, s, s, s, 1)); rocks.push(mtx(x, ground(x, z - per) + s * 0.2, z - per, s, s, s, 2)) } }
  makeInstances(group, g.rock, mat({ map: tex.stone('#7d7c72'), roughness: 1 }), rocks)
  return group
}

// -------- hero trees --------
export function makePeepal(scale = 1) {
  const g = new THREE.Group(), r = new RNG(21)
  const bark = mat({ map: tex.barkLight(), color: 0xd8d0c4 }), leaf = mat({ map: tex.leaf(), color: 0xb8e08a })
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.15, 5.5, 8, 2), bark); trunk.position.y = 2.75; trunk.castShadow = true; g.add(trunk)
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, b = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.6, 6), bark); b.position.set(Math.cos(a) * 1.0, 0.7, Math.sin(a) * 1.0); b.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); g.add(b) }
  const brs = []
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * 6.28 + r.range(-0.3, 0.3), len = r.range(4, 6.4), br = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, len, 7), bark)
    br.position.set(Math.cos(a) * len * 0.35, 5.2 + len * 0.2, Math.sin(a) * len * 0.35); br.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); br.castShadow = true; g.add(br)
    const tipx = Math.cos(a) * len * 0.78, tipz = Math.sin(a) * len * 0.78
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r.range(2.1, 3.0), 1), leaf); b.position.set(tipx * r.range(0.8, 1.1) + r.range(-1, 1), 7.2 + len * 0.25 + r.range(-0.6, 1.0), tipz * r.range(0.8, 1.1) + r.range(-1, 1)); b.scale.y = 0.72; g.add(b) }
  }
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1), leaf); crown.position.y = 9.2; crown.scale.y = 0.7; g.add(crown)
  // chabutra (stone platform) with sindoor-smeared stones, red thread, diya
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.1, 0.45, 14), mat({ map: tex.stone('#9a968a') })); plat.position.y = 0.22; plat.receiveShadow = true; g.add(plat)
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat({ color: '#a8321e' })); s.scale.y = 1.3; s.position.set(1.3 + i * 0.28, 0.58, -0.4 + i * 0.35); g.add(s) }
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 0.18, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#c0261c', side: THREE.DoubleSide })); thread.position.y = 1.8; g.add(thread)
  const thread2 = thread.clone(); thread2.position.y = 2.0; thread2.scale.set(1.01, 1, 1.01); g.add(thread2)
  g.scale.setScalar(scale); return g
}

export function makeBanyan(scale = 1) {
  const g = new THREE.Group(), r = new RNG(5)
  const bark = mat({ map: tex.bark(), color: 0xc8c0b0 }), leaf = mat({ map: tex.leaf(), color: 0xa8d078 })
  const main = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.9, 6, 8, 2), bark); main.position.y = 3; g.add(main)
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, len = r.range(6, 9), br = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.55, len, 7), bark); br.position.set(Math.cos(a) * len * 0.38, 6.2 + len * 0.15, Math.sin(a) * len * 0.38); br.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); g.add(br)
    const tx = Math.cos(a) * len * 0.82, tz = Math.sin(a) * len * 0.82
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r.range(2.6, 3.8), 1), leaf); b.position.set(tx + r.range(-1.5, 1.5), 8 + r.range(-0.5, 1.5), tz + r.range(-1.5, 1.5)); b.scale.y = 0.65; g.add(b) }
    // aerial roots (prop roots) hanging from branches, some reaching ground
    for (let k = 0; k < 6; k++) { const rl = k < 3 ? 7.3 : r.range(2.5, 5), rx = tx * r.range(0.4, 0.95) + r.range(-.6, .6), rz = tz * r.range(0.4, 0.95) + r.range(-.6, .6); const root = new THREE.Mesh(new THREE.CylinderGeometry(0.035 + (k < 3 ? 0.07 : 0), 0.05 + (k < 3 ? 0.08 : 0), rl, 5), bark); root.position.set(rx, k < 3 ? rl / 2 : 7.6 - rl / 2, rz); g.add(root) }
  }
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 1), leaf); crown.position.y = 9.6; crown.scale.y = 0.6; g.add(crown)
  g.scale.setScalar(scale); return g
}

export function makeBambooClump(G, opts = {}) {
  const r = new RNG(opts.seed || 8), n = opts.n || 55, rad = opts.radius || 3.2, h0 = opts.h || 11
  const group = new THREE.Group(), culmM = mat({ map: tex.bamboo(), roughness: 0.55 }), leafM = new THREE.MeshStandardMaterial({ map: tex.bambooLeaf(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 })
  const sway = new THREE.Group(); group.add(sway)
  const cul = new THREE.CylinderGeometry(0.045, 0.075, 1, 5, 3); cul.translate(0, 0.5, 0)
  const culms = [], leaves = [], card = new THREE.PlaneGeometry(2.4, 2.4)
  for (let i = 0; i < n; i++) {
    const a = r.range(0, 6.28), d = Math.sqrt(r.next()) * rad, x = Math.cos(a) * d, z = Math.sin(a) * d, h = h0 * r.range(0.7, 1.15), lean = 0.04 + d / rad * 0.25
    culms.push(mtx(x, 0, z, 1, h, 1, 0, Math.sin(a) * lean, -Math.cos(a) * lean)); const tx = x + Math.cos(a) * Math.sin(lean) * h, tz = z + Math.sin(a) * Math.sin(lean) * h
    for (let k = 0; k < 4; k++) leaves.push(mtx(tx + r.range(-.5, .5), h * r.range(0.72, 1.0) * Math.cos(lean), tz + r.range(-.5, .5), r.range(0.9, 1.5), r.range(0.9, 1.4), 1, r.range(0, 3.1), r.range(-0.7, 0.2)))
  }
  makeInstances(sway, cul, culmM, culms); makeInstances(sway, card, leafM, leaves)
  group.userData.sway = sway; group.userData.radius = rad
  // dead culms w/ faint foxfire (bioluminescent fungus on decaying wood) – very subtle
  if (opts.glow) { for (let i = 0; i < 4; i++) { const a = r.range(0, 6.28), d = r.range(rad * 0.7, rad * 1.4); const dm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), new THREE.MeshBasicMaterial({ color: '#6dffb0', transparent: true, opacity: 0.35 })); dm.position.set(Math.cos(a) * d, 0.06, Math.sin(a) * d); dm.rotation.z = 1.4; group.add(dm) } }
  return group
}

// A grove instead of a ring of tight clumps: clump centres are scattered over
// a bounded annulus with minimum separation and trail avoidance, then each
// clump gets its own size, height, density and lean. opts:
// {bounds, count, gap, centre, inner, outer, trails, walk, seed, level, glow}
export function scatterBamboo(G, opts = {}) {
  const r = new RNG(opts.seed || 99), group = new THREE.Group(), swayers = []
  const [x0, z0, x1, z1] = opts.bounds || [-40, -20, 40, 80]
  const count = Math.max(1, Math.floor((opts.count || 16) * (G.cfg ? G.cfg.density : 1)))
  const gap = opts.gap || 5.5
  const centre = opts.centre || { x: (x0 + x1) / 2, z: (z0 + z1) / 2 }
  const inner = opts.inner || 9, outer = opts.outer || 34
  const pts = []
  for (let i = 0; i < count * 10 && pts.length < count; i++) {
    const a = r.range(0, 6.28), d = r.range(inner, outer)
    const x = centre.x + Math.cos(a) * d * 1.15, z = centre.z + Math.sin(a) * d
    if (x < x0 || x > x1 || z < z0 || z > z1) continue
    if (opts.trails) { let ok = true; for (const t of opts.trails) if (nearestOnPoly(t.pts, x, z).d < t.hw + gap * 0.55) { ok = false; break } if (!ok) continue }
    if (pts.some(p => Math.hypot(p.x - x, p.z - z) < gap)) continue
    pts.push({ x, z })
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const b = makeBambooClump(G, { seed: (opts.seed || 99) * 10 + i, n: Math.floor(r.range(18, 34)), radius: r.range(2.0, 4.2), h: r.range(8, 13), glow: opts.glow && r.next() < 0.3 })
    const gy = opts.level && opts.level.groundY ? opts.level.groundY(p.x, p.z) : 0
    b.position.set(p.x, gy, p.z)
    group.add(b); swayers.push(b.userData.sway)
    if (opts.walk) opts.walk.circle(p.x, p.z, Math.max(1.3, b.userData.radius * 0.65))
  }
  group.userData.swayers = swayers
  return group
}

export function makeSplitTree() {
  const g = new THREE.Group(), bark = mat({ map: tex.bark(), color: 0xd6cdbc }), leaf = mat({ map: tex.leaf(), color: 0xc0e098 })
  const a = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.55, 3.6, 8), bark); a.position.y = 1.8; g.add(a)
  const mk = (s) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 6.5, 7), bark); b.position.set(s * 1.1, 6, 0); b.rotation.z = -s * 0.32; g.add(b); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), leaf); c.position.set(s * 2.5, 9, 0); c.scale.y = 0.75; g.add(c); return b }
  mk(-1); mk(1)
  // broken branch hanging by its bark (the unmistakable mark)
  const brk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 2.2, 6), mat({ map: tex.barkLight() })); brk.position.set(-0.75, 3.35, 0.35); brk.rotation.set(0.15, 0, 2.5); g.add(brk)
  const scar = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat({ color: '#d7c9a0' })); scar.position.set(-0.45, 3.9, 0.3); scar.scale.set(1, 1.6, 0.6); g.add(scar)
  return g
}

export function makeSiris(scale = 1) { // Albizia lebbeck: dry pods rattle in wind
  const g = new THREE.Group(), r = new RNG(6), bark = mat({ map: tex.bark() }), leaf = mat({ map: tex.leaf(), color: 0x9fcf70 })
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5, 8), bark); t.position.y = 2.5; g.add(t)
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r.range(1.6, 2.4), 1), leaf); b.position.set(r.range(-2.2, 2.2), 6.3 + r.range(-0.3, 1.2), r.range(-2.2, 2.2)); b.scale.y = 0.6; g.add(b) }
  const podM = new THREE.MeshStandardMaterial({ color: '#c8b078', roughness: 0.9 }), pods = []
  for (let i = 0; i < 26; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.1), podM); const a = r.range(0, 6.28), d = r.range(0.8, 2.6); p.position.set(Math.cos(a) * d, 5.3 + r.range(-0.4, 0.5), Math.sin(a) * d); p.rotation.set(r.range(-0.4, 0.4), a, r.range(-0.3, 0.3)); g.add(p); pods.push(p) }
  g.userData.pods = pods; g.scale.setScalar(scale); return g
}

export function makeRock(s = 1, col = '#7d7c72') { const m = new THREE.Mesh(geos().rock, mat({ map: tex.stone(col) })); m.scale.setScalar(s); m.castShadow = true; return m }
export function makeLog(len = 3, r = 0.25) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, len, 8), mat({ map: tex.bark() })); m.rotation.z = Math.PI / 2; m.castShadow = true; return m }

export function makePalm(h = 8) {
  const g = new THREE.Group(), bark = mat({ map: tex.bark(), color: 0xb8a890 }); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, h, 7), bark); t.position.y = h / 2; t.rotation.z = 0.05; g.add(t)
  const lm = new THREE.MeshStandardMaterial({ color: '#3f6a2a', side: THREE.DoubleSide, roughness: 0.9 })
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.2, 1, 3), lm); f.position.set(Math.cos(a) * 1.3, h + 0.2, Math.sin(a) * 1.3); f.rotation.set(-1.2 * Math.sin(a) - 0.2, -a + Math.PI / 2, 0); f.rotation.order = 'YXZ'; f.rotation.y = -a + Math.PI / 2; f.rotation.x = -0.9; g.add(f) }
  return g
}
