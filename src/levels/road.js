// One continuous world: our house and lane (opts.home) flow straight into the long road to the forest.
// Along the road: town traffic, a stuck truck, a petrol pump, a puncture shop, a roadside temple, the dhaba, the forest-edge board.
import * as THREE from 'three'
import { Level, pole, wires, teaStall, signboard, buildHouse, streetLight, truck, table, charpai, fan, bush, bx, cyl, sph, motorbike } from '../world/build.js'
import { scatterForest, makePalm } from '../world/nature.js'
import { makeTraffic } from '../world/traffic.js'
import { placePits } from '../core/roam.js'
import { smoothPts, polyLen, projDist, ptAt } from '../world/common.js'
import { tex, withPBR } from '../world/textures.js'
import { building, tree as varietyTree, terrainPatch } from '../world/variety.js'
import { R, nearestOnPoly } from '../core/util.js'
import { populateHome } from './home.js'

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o })

export function build(G, opts = {}) {
  const L = new Level(G, 'road')
  G.env.set('day', true)
  // the old forward-running road rotated to run along +x, starting at the far end of our lane
  const raw = [[-30, 15], [110, 15], [190, 9], [280, 23], [370, 25], [460, 11], [550, -3], [640, 5], [730, 19], [810, 21]]
  const pts = smoothPts(raw, 8)
  const len = polyLen(pts)
  L.roadLen = len; L.pts = pts
  L.ground(1300, 760, 'grass', 7, 380, 40, 0xe0e8d0)
  // the carriageway: a 2-lane lane by the house, a 4-lane city road through town, then back down to 2 lanes into the forest
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z))
  // Four lanes out of the busy home city, narrowing to two, then a single
  // forest lane — the width change is gradual, not a sudden step.
  const hwAt = (d) => d < 120 ? 7.4 : d < 220 ? 7.4 - (d - 120) / 100 * 3.4 : d < 520 ? 4.0 : d < 620 ? 4.0 - (d - 520) / 100 * 1.0 : 3.0
  L.hwAt = hwAt
  L.ribbon(pts, (i) => hwAt(cum[i]), 'road', 6, 0.012, 0xffffff, false)
  L.ribbon(pts.map(p => ({ x: p.x, z: p.z - 0.02 })), (i) => hwAt(cum[i]) + 1.5, 'mud', 4, 0.006, 0xffffff, false)
  // lane markings: centre (double yellow in the 4-lane stretch, dashed otherwise), lane dashes, solid edge lines
  const mark = (offFn, d0, d1, step, segLen, color, wdt = 0.16) => {
    // Flat painted lines, not raised boxes — a 3D box reads as a speed breaker.
    const n = Math.max(1, Math.floor((d1 - d0) / step)), geo = new THREE.PlaneGeometry(wdt, segLen)
    geo.rotateX(-Math.PI / 2)
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthWrite: false }), n)
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), p4 = new THREE.Vector3(), s4 = new THREE.Vector3(1, 1, 1); let c = 0
    for (let d = d0; d < d1 && c < n; d += step) { const a2 = ptAt(pts, d), off = offFn(d); e4.set(0, a2.yaw, 0); q4.setFromEuler(e4); p4.set(a2.x - Math.cos(a2.yaw) * off, 0.014, a2.z + Math.sin(a2.yaw) * off); im.setMatrixAt(c++, m4.compose(p4, q4, s4)) }
    im.count = c; im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; L.add(im)
  }
  mark(() => 0, 130, 520, 7, 2.4, '#e8e2c8'); mark(() => 0, 630, len - 3, 8, 2.6, '#e8e2c8')          // dashed centre, 2-lane stretches
  mark(() => 0.14, 4, 120, 3.2, 3.2, '#d8b020'); mark(() => -0.14, 4, 120, 3.2, 3.2, '#d8b020')       // double yellow, 4-lane city stretch
  mark(() => 3.5, 4, 120, 9, 3, '#e8e2c8'); mark(() => -3.5, 4, 120, 9, 3, '#e8e2c8')                 // lane dashes
  mark((d) => hwAt(d) - 0.4, 3, len - 3, 3.2, 3.2, '#e8e2c8', 0.14); mark((d) => -(hwAt(d) - 0.4), 3, len - 3, 3.2, 3.2, '#e8e2c8', 0.14)   // edge lines
  const la = pts[pts.length - 1], lb = pts[pts.length - 2], ll = Math.hypot(la.x - lb.x, la.z - lb.z) || 1
  const ext = [...pts, { x: la.x + (la.x - lb.x) / ll * 45, z: la.z + (la.z - lb.z) / ll * 45 }]
  L.rideCorr = { pts: ext, hw: 8.0 }
  L.walk.corridor(ext, 8.0, 'road')
  L.walk.bound = { x0: -110, z0: -140, x1: 940, z1: 240 }
  L.walk.free = true; L.core = [ext]; L.roam = { stray: 62, pits: 10, seed: 17 }
  L.noPit = { x: 60, z: 15, r: 170 }                // no pits in the neighbourhood
  L.projDist = (x, z) => projDist(pts, x, z)
  const side = (d, off) => {
    // Clamp to the real road length. Decoration loops run past the last point;
    // without this the fallback origin (0,0) dropped trees, crops and props
    // straight into the bedroom.
    d = Math.max(0, Math.min(d, len))
    let acc = 0
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); if (acc + l >= d) { const k = (d - acc) / l, dx = pts[i].x - pts[i - 1].x, dz = pts[i].z - pts[i - 1].z, ll2 = Math.hypot(dx, dz) || 1; const x = pts[i - 1].x + dx * k, z = pts[i - 1].z + dz * k; return { x: x + (-dz / ll2) * off, z: z + (dx / ll2) * off, yaw: Math.atan2(dx, dz) } } acc += l }
    // d === len (or rounding drift): place at the final point along its heading.
    const a = pts[pts.length - 2], b = pts[pts.length - 1], dx = b.x - a.x, dz = b.z - a.z, ll2 = Math.hypot(dx, dz) || 1
    return { x: b.x + (-dz / ll2) * off, z: b.z + (dx / ll2) * off, yaw: Math.atan2(dx, dz) }
  }
  // set a group beside the road, its front (+z) facing the carriageway
  const put = (obj, d, off) => { const s = side(d, off); obj.position.set(s.x, 0, s.z); obj.rotation.y = s.yaw + (off > 0 ? Math.PI / 2 : -Math.PI / 2); L.add(obj); return s }
  const world = (obj, lx, ly, lz) => { obj.updateMatrixWorld(true); return obj.localToWorld(new THREE.Vector3(lx, ly, lz)) }

  // ---- our house and lane at the start (populateHome also places the scooter, chacha, props and spawn) ----
  const house = populateHome(G, L, false, { inRoad: true })
  // Trees everywhere EXCEPT inside buildings: a tight exclusion around our
  // house and the township. The old r=110 bubble erased the entire horizon.
  const NO_TREES = [{ x: 0, z: 4, r: 26 }, { x: 60, z: 15, r: 34 }]
  // forest density grows with distance, but the first stretch already has trees
  const segs = [[45, 180, 0.010], [180, 320, 0.014], [320, 450, 0.018], [450, 600, 0.024], [600, 880, 0.034]]
  for (const [a, b, d] of segs) {
    const A = side(a, 0), B = side(Math.min(len, b), 0)
    L.add(scatterForest(G, { bounds: [Math.min(A.x, B.x) - 95, Math.min(A.z, B.z) - 95, Math.max(A.x, B.x) + 95, Math.max(A.z, B.z) + 95], trails: [{ pts, hw: 7.4 }], density: d * 0.95, seed: Math.floor(a) + 5, walk: L.walk, allTrees: true, avoid: NO_TREES, mode: 'natural', level: L }))
  }
  // ---- vivid countryside: pavements, lanes into the fields, crops, orchards and homes ----
  {
    for (const sgn of [1, -1]) {
      const walk = []
      for (let d = 150; d < 450; d += 10) { const s = side(d, sgn * (hwAt(d) + 1.1)); walk.push({ x: s.x, z: s.z }) }
      if (walk.length > 1) L.ribbon(walk, () => 0.85, 'cement', 2, 0.014, 0xffffff, false)
    }
    for (let d = 200, n = 0; d < 840; d += 95, n++) {
      const sgn = n % 2 ? 1 : -1
      const lane = [side(d, 0), side(d + 8, sgn * 18), side(d + 22, sgn * 44)]
      L.ribbon(lane.map(p => ({ x: p.x, z: p.z })), () => 1.5, 'mud', 2, 0.011, 0xffffff, false)
    }
    const cropCols = ['#7d9a3a', '#b6a24c', '#5f8f46', '#c2a24e']
    const tree = (x, z, s = 1) => {
      const g = new THREE.Group()
      cyl(g, 0.2 * s, 0.3 * s, 3.6 * s, withPBR(new THREE.MeshStandardMaterial({ map: tex.bark() })), 0, 0, 0, 7)
      for (let i = 0; i < 3; i++) sph(g, (1.4 + R.range(-0.3, 0.4)) * s, new THREE.MeshStandardMaterial({ map: tex.leaf(), color: '#7fae63' }), R.range(-0.9, 0.9), 3.7 * s + i * 0.65, R.range(-0.9, 0.9))
      g.position.set(x, 0, z); L.add(g)
    }
    let k = 0
    for (let d = 165; d < 860; d += 62) {
      const sgn = k % 2 ? 1 : -1, p = side(d, sgn * R.range(26, 46)), col = cropCols[k % cropCols.length]
      const fw = R.range(24, 40), fd = R.range(30, 52)
      terrainPatch(L, p.x, p.z, fw, fd, { color: col, crop: col, rows: 4, ry: p.yaw })
      const kinds = ['neem', 'banyan', 'palm', 'conifer', 'bush']
      for (let t = 0; t < 5; t++) {
        const q = side(d + R.range(-18, 18), sgn * R.range(38, 68))
        const g = varietyTree({ kind: kinds[(k + t) % kinds.length], s: 0.8 + R.next() * 0.7 })
        g.position.set(q.x, 0, q.z); L.add(g)
      }
      // homes only along the low-density town stretch, well inside the tree line
      if (d < 440 && k % 3 === 0) {
        const hp = side(d + R.range(-8, 8), sgn * R.range(16, 26))
        buildHouse(L, { x: hp.x, z: hp.z, w: 6 + R.next() * 2.5, d: 5 + R.next(), h: 2.8 + R.next() * 0.6, rot: hp.yaw, col: ['#e2cfa8', '#cbb9a0', '#d8c2a8'][k % 3], roof: ['tile', 'flat', 'tin'][k % 3], interior: false, windows: [{ side: 's', x: -1.5, y: 1.2, w: 0.9, h: 0.9, lit: true }] })
      }
      k++
    }
  }
  // ---- busy township: shops with people to talk to, a gym, extra dhabas and fuel stops ----
  {
    const shopSigns = ['Kirana General Store', 'Tea & Snacks', 'Bike Repair', 'Medical Store', 'Chai Stall']
    let n = 0
    for (let d = 210; d < 440; d += 46, n++) {
      const sgn = n % 2 ? 1 : -1, off = sgn * R.range(9.5, 14), p = side(d, off)
      building(L, {
        x: p.x, z: p.z, w: 5.2, d: 5, h: 2.7,
        rot: p.yaw + (off > 0 ? Math.PI / 2 : -Math.PI / 2),
        col: ['#c9b08a', '#a8bfae', '#d0b4a0'][n % 3], roof: ['tile', 'flat', 'tin'][n % 3],
        interior: false, name: shopSigns[n % shopSigns.length],
        signBg: n % 3 === 2 ? '#2a5a7a' : '#8a3a2a', awning: true
      })
      const q = side(d + 2, sgn * R.range(7.5, 9))
      const npc = G.addActor(n % 2 ? 'chaiwala' : 'farmer')
      npc.place(q.x, q.z, sgn > 0 ? Math.PI : 0); npc.sfx = false; npc.pose('stand')
      G.addInteract({
        pos: new THREE.Vector3(q.x, 1, q.z), label: 'Dukaandar se baat karo · Talk to the shopkeeper',
        r: 2.6, cone: -1, once: false,
        onUse: () => G.ui.say('Dukaandar', 'Bhaiya, kya chahiye?', 'What do you need, brother?', { pos: new THREE.Vector3(q.x, 1.2, q.z) })
      })
    }
    // open-air gym on the left
    {
      const p = side(330, -13), g = new THREE.Group()
      bx(g, 8, 0.12, 6, M('#7a7468'), 0, 0, 0)
      for (const x of [-2.5, 0, 2.5]) { bx(g, 0.08, 1.6, 0.08, M('#4a4a4a'), x, 0.8, -1.5); bx(g, 1.2, 0.1, 0.1, M('#333'), x, 1.6, -1.5) }
      bx(g, 2, 0.3, 0.6, M('#55443a'), 0, 0.45, 1.4)
      g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw; L.add(g)
      const trainer = G.addActor('farmer'); trainer.place(p.x + 2, p.z + 1.5, 0); trainer.sfx = false
      G.addInteract({ pos: new THREE.Vector3(p.x + 2, 1, p.z + 1.5), label: 'Trainer se baat karo · Talk to the trainer', r: 2.6, cone: -1, once: false,
        onUse: () => G.ui.say('Trainer', 'Bhai, thoda saadhana zaroori hai!', 'A little exercise is necessary, brother!', { pos: new THREE.Vector3(p.x + 2, 1.2, p.z + 1.5) }) })
      L.refs.gym = new THREE.Vector3(p.x, 1, p.z)
    }
    // a second dhaba and a second fuel stop
    for (const [d, off, label] of [[410, 11, 'DHABA · MEALS'], [250, -12, 'FUEL STOP · OPEN']]) {
      const p = side(d, off), g = new THREE.Group()
      bx(g, 6, 2.4, 0.2, M('#c9a882'), 0, 0, -1.5)
      const sg = signboard(label, '#8a3a2a', '#fff', 2.8, 1.0); sg.position.set(0, 0, 2); g.add(sg)
      put(g, d, off)
      const q = side(d + 2, off - 1.5)
      const npc = G.addActor('chaiwala'); npc.place(q.x, q.z, 0); npc.sfx = false
    }
  }
  const sb = signboard('जंगल क्षेत्र · वन विभाग\nTiger / Leopard Zone', '#1f5a34', '#f2f0e0', 3, 1.2); put(sb, 560, 7.2)
  const sb2 = signboard('Petrol Pump 1 km →', '#1c3a6a', '#f4f0e0', 2.6, 1.0); put(sb2, 245, -9.8)
  for (let d = 170; d < 450; d += 24) { const s = side(d, -9.6); pole(L, s.x, s.z, 8) }
  for (let d = 170; d < 426; d += 24) { const a = side(d, -9.6), b = side(d + 24, -9.6); wires(L, { x: a.x, y: 7.6, z: a.z }, { x: b.x, y: 7.6, z: b.z }, 0.8) }
  for (let i = 0; i < 9; i++) { const s = side(R.range(170, 420), R.range(14, 26) * (R.next() < 0.5 ? 1 : -1)); const p = makePalm(R.range(7, 10)); p.position.set(s.x, 0, s.z); L.add(p) }


  // ---- the city stretch (d 190-440): multi-storey blocks with shopfronts, awnings, signs and parked bikes ----
  const facades = new Map()
  const facadeTex = (color, floors, cols) => {
    const key = color + floors + cols; if (facades.has(key)) return facades.get(key)
    const cv = document.createElement('canvas'); cv.width = cols * 48; cv.height = floors * 56 + 8; const g2 = cv.getContext('2d')
    g2.fillStyle = color; g2.fillRect(0, 0, cv.width, cv.height)
    for (let f = 0; f < floors; f++) for (let c2 = 0; c2 < cols; c2++) { g2.fillStyle = f === 0 ? '#1c1a18' : (Math.random() < 0.35 ? '#e8c47a' : '#26323a'); g2.fillRect(c2 * 48 + 9, cv.height - (f + 1) * 56 + 8, 30, f === 0 ? 40 : 34); g2.fillStyle = 'rgba(0,0,0,.25)'; g2.fillRect(c2 * 48 + 7, cv.height - (f + 1) * 56 + 6, 34, 3) }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; facades.set(key, t); return t
  }
  const SHOPS = ['MEDICAL STORE', 'KIRANA STORE', 'SWEETS & NAMKEEN', 'MOBILE REPAIR', 'LADIES SALON', 'HARDWARE', 'BOOK DEPOT', 'ROYAL TAILORS', 'ELECTRONICS', 'FRESH BAKERY', 'CYCLE MART', 'CHAI & SNACKS', 'JEWELLERS', 'CLINIC 24x7']
  const cityBlock = (w, floors, color, name, signBg) => {
    const g = new THREE.Group(), h = floors * 3.3 + 0.6, dd = 7
    const sd = new THREE.MeshStandardMaterial({ color, roughness: 0.95 }), fr = new THREE.MeshStandardMaterial({ map: facadeTex(color, floors, Math.max(2, Math.round(w / 2.4))), roughness: 0.9 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), [sd, sd, sd, sd, fr, sd]); body.position.y = h / 2; body.castShadow = true; g.add(body)
    const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.08, 1.5), new THREE.MeshStandardMaterial({ color: signBg, roughness: 0.9 })); aw.position.set(0, 2.9, dd / 2 + 0.7); aw.rotation.x = 0.28; g.add(aw)
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.85, 7), 0.95), new THREE.MeshBasicMaterial({ map: tex.sign(name, signBg, '#f6efd8', 512, 128, '700 54px Inter, sans-serif') })); sg.position.set(0, 3.6, dd / 2 + 0.06); g.add(sg)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.1, 10), new THREE.MeshStandardMaterial({ color: '#2a3a52', roughness: 0.7 })); tank.position.set(w * 0.25, h + 0.55, 0); g.add(tank)
    return g
  }
  const shopCols = ['#d8c8a8', '#c4b49a', '#b8a890', '#d4bca0', '#bcc4b0', '#c8b0a4', '#e0d2b0'], signCols = ['#a33a1a', '#1d5a3a', '#1c3a6a', '#7a2a5a', '#6a4a1a', '#2a5a7a', '#8a2a2a']
  for (let d = 196, i = 0; d < 440; d += 19 + R.range(0, 6), i++) {
    for (const sgn of [1, -1]) {
      if (sgn > 0 && d > 252 && d < 290) continue          // petrol pump
      if (sgn < 0 && d > 365 && d < 400) continue          // tyre shop
      const w = 7 + R.range(0, 5), fl = 1 + Math.floor(R.range(0, 3.99)), blk = cityBlock(w, fl, shopCols[(i + (sgn > 0 ? 0 : 3)) % shopCols.length], SHOPS[(i * 2 + (sgn > 0 ? 0 : 1)) % SHOPS.length], signCols[(i + (sgn > 0 ? 1 : 4)) % signCols.length])
      put(blk, d, sgn * (hwAt(d) + 1.4 + 3.7))
      const bb = new THREE.Box3().setFromObject(blk); L.walk.box(bb.min.x, bb.min.z, bb.max.x, bb.max.z)
      if (R.next() < 0.55) { const bk = motorbike(['#a31d1d', '#1d3f7a', '#2a2a2e'][i % 3]); const q = side(d + R.range(-2, 2), sgn * (hwAt(d) + 1.0)); bk.position.set(q.x, 0, q.z); bk.rotation.y = q.yaw + sgn * Math.PI / 2; L.add(bk); L.walk.circle(q.x, q.z, 0.6) }
    }
  }

  // ---- POI: the traffic jam (a stuck truck, a constable whistling at nobody, a vegetable cart, school kids) ----
  { const t = truck(); const ls = []; t.traverse(o => { if (o.isLight) ls.push(o) }); ls.forEach(l => l.parent.remove(l)); const s = side(215, 2.2); t.position.set(s.x, 0, s.z); t.rotation.y = s.yaw + Math.PI; L.add(t); L.walk.circle(s.x, s.z, 1.6); L.walk.circle(s.x - Math.sin(s.yaw) * 3, s.z - Math.cos(s.yaw) * 3, 1.6)
    const c = G.addActor('father'); const sc = side(224, -0.3); c.place(sc.x, sc.z, s.yaw + Math.PI); c.sfx = false; c.pose('point'); L.refs.jam = new THREE.Vector3(s.x, 1.2, s.z)
    for (let i = 0; i < 2; i++) { const k = G.addActor('kid'); const q = side(205 + i * 2, 5.6); k.place(q.x, q.z, q.yaw); k.sfx = false; k.face(q.yaw - Math.PI / 2) }
    const vc = new THREE.Group(); bx(vc, 1.7, 0.1, 0.9, M('#6a4a2a'), 0, 0.7, 0); for (const sg of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 6, 14), M('#1a1a1a')); w.position.set(0, 0.36, sg * 0.5); w.rotation.y = Math.PI / 2; vc.add(w) } for (let i = 0; i < 7; i++) sph(vc, 0.16, M(['#c83', '#6a4', '#b33'][i % 3]), -0.6 + i * 0.2, 0.9, 0); put(vc, 195, 5.6); L.walk.circle(vc.position.x, vc.position.z, 1.1) }

  // ---- POI: petrol pump (d = 270, right side) ----
  { const g = new THREE.Group(), red = M('#b3261e'), white = M('#e8e6dc')
    bx(g, 8, 0.3, 5, white, 0, 4.2, 0); for (const [x, z] of [[-3.6, -2.2], [3.6, -2.2], [-3.6, 2.2], [3.6, 2.2]]) cyl(g, 0.12, 0.12, 4.3, M('#9a9890'), x, 0, z, 8)
    bx(g, 8, 0.1, 5, red, 0, 4.0, 0)
    bx(g, 5, 0.18, 1.1, M('#8a877e'), 0, 0, 0)
    for (const x of [-1.6, 1.6]) { bx(g, 0.8, 1.7, 0.6, red, x, 0.18, 0); bx(g, 0.6, 0.5, 0.05, M('#111c26'), x, 1.1, 0.32); cyl(g, 0.03, 0.03, 0.9, M('#222'), x + 0.45, 0.4, 0.2, 6) }
    const board = signboard('PETROL PUMP\nOPEN 24 HOURS', '#b3261e', '#f4f0e0', 3.2, 1.2); board.position.set(0, 0, 3.4); g.add(board)
    const s = put(g, 270, 12); L.refs.pump = world(g, 0, 0.9, 1.9); for (const [x, z] of [[-3.6, -2.2], [3.6, -2.2], [-3.6, 2.2], [3.6, 2.2]]) { const w = world(g, x, 0, z); L.walk.circle(w.x, w.z, 0.2) }
    const at = G.addActor('chaiwala'); const w = world(g, 0, 0, 1.4); at.place(w.x, w.z, g.rotation.y + Math.PI); at.sfx = false; L.refs.pumpMan = at }

  // ---- POI: puncture / tyre shop (d = 380, left side) ----
  { const g = new THREE.Group()
    bx(g, 5.2, 2.6, 0.2, M('#8a7a62'), 0, 0, -1.6); bx(g, 0.2, 2.6, 3.2, M('#8a7a62'), -2.6, 0, 0); bx(g, 0.2, 2.6, 3.2, M('#8a7a62'), 2.6, 0, 0)
    const roof = bx(g, 5.8, 0.1, 3.8, new THREE.MeshStandardMaterial({ map: tex.tin(), roughness: 0.8, metalness: 0.4 }), 0, 2.6, 0); roof.rotation.x = 0.08
    for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 8, 14), M('#111')); t.rotation.x = Math.PI / 2; t.position.set(-1.8, 0.14 + i * 0.26, -0.8); g.add(t) }
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 8, 14), M('#151515')); t.position.set(1.0 + i * 0.5, 0.4, 0.5 + i * 0.2); t.rotation.y = i; g.add(t) }
    bx(g, 0.9, 0.7, 0.6, M('#3a5a8a'), 1.8, 0, -1.0)    // air compressor
    const board = signboard('PUNCTURE · TYRE REPAIR\nAIR FREE', '#d8b020', '#1a1a1a', 3, 1.0); board.position.set(0, 0, 2.5); g.add(board)
    put(g, 380, -12); L.refs.tyre = world(g, 0, 0.8, 1.3)
    const o = G.addActor('farmer'); const w = world(g, 0.6, 0, -0.6); o.place(w.x, w.z, g.rotation.y); o.sfx = false; o.pose('sit'); L.refs.tyreMan = o }

  // ---- POI: roadside temple with a bell (d = 480, right side) ----
  { const g = new THREE.Group()
    bx(g, 4, 0.4, 4, M('#b8b2a2'), 0, 0, 0); bx(g, 1.8, 1.9, 1.5, M('#e8dcc0'), 0, 0.4, -0.6)
    const dome = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.3, 8), M('#d98a2a')); dome.position.set(0, 3.2, -0.6); g.add(dome)
    const flag = cyl(g, 0.03, 0.03, 2.2, M('#4a3a2a'), 0.9, 2.3, -0.6, 6); const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), M('#c8321e', { side: THREE.DoubleSide })); fl.position.set(1.25, 4.3, -0.6); g.add(fl)
    // bell tied in red cloth
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 10), M('#b8942a', { metalness: 0.7, roughness: 0.4 })); bell.position.set(0, 2.0, 0.6); g.add(bell); bx(g, 0.5, 0.06, 0.06, M('#4a3a2a'), 0, 2.32, 0.6)
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.5), M('#c8321e', { side: THREE.DoubleSide })); cloth.position.set(0, 1.7, 0.6); g.add(cloth)
    for (let i = 0; i < 3; i++) sph(g, 0.12, M('#e6a020'), -0.5 + i * 0.5, 0.78, 0.2, 1, 0.6, 1)   // marigolds
    put(g, 480, 11); L.refs.temple = world(g, 0, 1.2, 1.4); L.walk.circle(world(g, 0, 0, -0.6).x, world(g, 0, 0, -0.6).z, 1.4) }

  // ---- POI: the dhaba (d = 580, left side): blue tarpaulin, a fan on a pole, tables, charpais, a transistor radio ----
  { const g = new THREE.Group()
    bx(g, 10, 0.1, 6.6, M('#2a5aa8', { roughness: 0.7 }), 0, 3.0, 0)
    for (const [x, z] of [[-4.7, -3.0], [4.7, -3.0], [-4.7, 3.0], [4.7, 3.0]]) cyl(g, 0.07, 0.07, 3.0, M('#6a5a44'), x, 0, z, 8)
    fan(L, g, 0, 2.9, 0)
    bx(g, 5, 1.0, 0.7, M('#6a4a2a'), 0, 0, -2.6)                // the counter
    bx(g, 0.3, 0.2, 0.15, M('#222'), -1.8, 1.0, -2.6)          // transistor radio
    for (const [x, z] of [[-3, 0.4], [0.2, 0.9], [3.2, 0.2]]) { const t = table(1.3, 0.8, 0.75); t.position.set(x, 0, z); g.add(t); const c1 = charpai(); c1.scale.setScalar(0.62); c1.rotation.y = Math.PI / 2; c1.position.set(x - 0.95, 0, z); g.add(c1) }
    const board = signboard('DHABA\nParatha · Lassi · Chai', '#a33a1a', '#f6edd0', 3.4, 1.2); board.position.set(0, 0, 4.2); g.add(board)
    put(g, 580, -13); L.refs.dhabaTable = world(g, 0.2, 0.8, 0.9); L.refs.dhaba = world(g, 0, 0, 2.6); L.refs.dhabaPark = world(g, 0, 0, 6.5)
    const o = G.addActor('chaiwala'); const w = world(g, 0, 0, -2.0); o.place(w.x, w.z, g.rotation.y); o.sfx = false; L.refs.dhabaMan = o }

  // ---- the forest edge: the mossy board (d = len - 75) ----
  { const sg = signboard('JUNGLE RESERVE\nENTRY ALLOWED TILL 5:00 PM', '#3a5a34', '#f2f0e0', 3.2, 1.3); const s = put(sg, len - 75, 7.0); sg.rotation.z = 0.04; L.refs.edge = new THREE.Vector3(s.x, 1.2, s.z) }

  // ---- yellow kaccha spur on the right, toward the forest camp ----
  {
    const s0 = side(len - 96, hwAt(len - 96) + 0.6)
    const spur = smoothPts([[s0.x, s0.z], [s0.x + 9, s0.z + 7], [s0.x + 19, s0.z + 19], [s0.x + 27, s0.z + 36]], 6)
    L.ribbon(spur, () => 2.9, 'mud', 5, 0.013, 0xd8b060, false)
    L.walk.corridor(spur, 2.9, 'kaccha')
    L.kaccha = spur
    for (const q of [spur[6], spur[14]]) {
      if (!q) continue
      const st = teaStall(); st.position.set(q.x + 3.6, 0, q.z); st.rotation.y = -0.5; L.add(st)
    }
    const gate = G.addActor('chaiwala'); gate.place(s0.x + 2.4, s0.z + 2, Math.PI); gate.sfx = false
    const guard1 = G.addActor('farmer'); guard1.place(s0.x + 6, s0.z + 6, -0.8); guard1.sfx = false
    const guard2 = G.addActor('farmer'); guard2.place(s0.x - 2, s0.z + 8, 0.6); guard2.sfx = false
    G.addInteract({ pos: new THREE.Vector3(s0.x + 2.4, 1, s0.z + 2), label: 'Gatekeeper se baat karo · Talk to the gatekeeper', r: 3, cone: -1, once: false,
      onUse: () => G.ui.say('Gatekeeper', 'Andar jaana hai toh isi kacche raaste se jao. Bike yahin chhod do.', 'Take this dirt track to go in. Leave the bike here.', { pos: gate.pos }) })
    // Dry twigs on the track — visible markers for the way back.
    for (let i = 0; i < 24; i++) {
      const q = spur[Math.floor(R.range(1, spur.length - 1))]
      if (!q) continue
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, R.range(0.3, 0.7), 5), new THREE.MeshStandardMaterial({ color: '#8a6a42', roughness: 1 }))
      tw.rotation.set(Math.PI / 2, R.range(0, 6.28), 0)
      tw.position.set(q.x + R.range(-2.4, 2.4), 0.05, q.z + R.range(-2.4, 2.4)); L.add(tw)
    }
  }

  makeTraffic(L, G, ext, { count: 14, lanesAt: (d) => hwAt(Math.max(0, d)) > 5.2 ? [1.8, 5.3] : [1.8], obstacles: [{ d: 215, lat: 2.2, len: 7.5 }] })
  placePits(L, G)
  // surfaces + sound
  L.surface = (x, z) => { if (house.inside(x, z)) return 'tile'; const n = nearestOnPoly(pts, x, z); return n.d < hwAt(cum[Math.min(pts.length - 1, Math.floor(n.t))]) + 0.4 ? 'road' : (Math.hypot(x - 20, z - 6) < 30 ? 'dirt' : 'grass') }
  L.isIndoors = (x, z) => (house.inside(x, z) ? 1 : 0)
  let passed = false
  L.updaters.push(() => {
    const sc = G.scooter, pl = sc && G.player.mode === 'ride' ? sc.chassis.position : G.player.pos
    G.env.set('day')
    const pr = projDist(pts, pl.x, pl.z) / len
    if (!passed && pr > 0.16) { passed = true; const a = side(120, -1.4), b = side(10, -1.4); G.audio.passBy({ x: a.x, y: 1, z: a.z }, { x: b.x, y: 1, z: b.z }, 5, 'truck') }
  })
  L.ambient = (S, p) => { const ins = house.inside(p.pos.x, p.pos.z), pr = projDist(pts, p.pos.x, p.pos.z) / len; S.fan = ins ? 0.8 : 0; S.room = ins ? 0.6 : 0.1; S.traffic = ins ? 0.25 : Math.max(0.15, 0.55 - pr * 0.9); S.birds = pr < 0.7 ? 0.6 : 0.25; S.insects = pr > 0.6 ? 0.7 : 0.1 }
  return L
}
