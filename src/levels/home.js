// Home + street. opts.night: Ending A homecoming (family is up, tiffin on the table)
import * as THREE from 'three'
import { Level, buildHouse, sofa, table, chair, stool, charpai, tvSet, shelf, matka, brassVessel, chulha, garlandedPhoto, fan, tubeLight, pole, wires, streetLight, autoRickshaw, cow, dogModel, helmetRack, keyHook, motorbike, bush, bed, bx, cyl, sph } from '../world/build.js'
import { makeTiffin, makeSteelGlass } from '../world/people.js'
import { tex, withPBR } from '../world/textures.js'
import { R } from '../core/util.js'
import { makeTraffic } from '../world/traffic.js'
import { teaStall, wires as wiresFn } from '../world/build.js'

// everything that makes the house and its lane: reusable inside the long road level (o.inRoad)
export function populateHome(G, L, night, o = {}) {
  L.walk.rect(-7, 3.5, 7, 11.2, 'yard')
  L.walk.rect(-9, 10, 12, 18, 'street2')
  // our house
  const house = buildHouse(L, { x: 0, z: 0, w: 9, d: 6, h: 3.1, col: '#e3d3a8', roof: 'flat', floor: 'tile', doorX: 0.6, doorW: 1.2, closedDoor: false, name: 'home',
    windows: [{ side: 's', x: -2.6, y: 1.2, w: 1.1, h: 1.0, lit: true }, { side: 's', x: 3.0, y: 1.2, w: 1.1, h: 1.0, lit: true }, { side: 'n', x: 0, y: 1.2, w: 1.2, h: 1.0, lit: true }] })
  L.house = house
  L.surface = (x, z) => (house.inside(x, z) ? 'tile' : (z > 10.8 && z < 19.2 ? 'road' : (z < 3.4 ? 'tile' : 'dirt')))
  house.addLight(0, 2.5, 0, night ? '#ffe2b0' : '#ffeccb', night ? 14 : 9, 14)
  house.addLight(-3, 2.5, -1.5, '#ffe2b0', 6, 8)
  tubeLight(L, house.group, 0, 3.05, 0)
  fan(L, house.group, 0, 2.95, 0.5)
  // furniture (house-local x lateral, z depth; +z = door side)
  house.place(sofa(), 2.4, -2.2, 0, 0)
  const tv = tvSet(!night); house.place(tv, -0.4, -2.8, 0.55, 0)
  const tvStand = table(1.2, 0.45, 0.55); house.place(tvStand, -0.4, -2.75, 0, 0)
  house.place(table(1.2, 0.7, 0.45), 2.4, -0.8, 0, 0)
  house.place(shelf(), 4.1, 0.2, 0, -Math.PI / 2)
  house.place(garlandedPhoto(), -4.2, -1.0, 1.55, Math.PI / 2)
  // the bed you wake up in (final script: phone face-up on the bed, helmets by the door)
  const bedObj = bed(); house.place(bedObj, -3.5, -2.0, 0, 0); L.refs.bedPos = house.local(-2.9, 0.7, -2.0)
  const phoneOnBed = new THREE.Group()
  phoneOnBed.add(new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.01, 0.158), new THREE.MeshStandardMaterial({ color: '#15181c', metalness: 0.4, roughness: 0.4 })))
  house.place(phoneOnBed, -3.2, 0.72, -2.0)
  // kitchen corner
  house.place(chulha(), -4.0, 0.1, 0, 0)
  house.place(table(1.3, 0.7, 0.8), -2.9, 0.4, 0, 0)
  const tiffin = makeTiffin(); house.place(tiffin, -2.9, 0.4, 0.8, 0.3)     // left on the table. Never mentioned.
  const gl1 = makeSteelGlass(); house.place(gl1, -2.5, 0.5, 0.8)
  house.place(stool(), -3.7, 1.0, 0, 0.5); house.place(stool(), -2.1, 1.1, 0, 0.2)
  const mt = matka(); house.place(mt, -4.0, 2.4, 0, 0)
  const rack = helmetRack(); house.place(rack, 3.9, 2.6, 0, 0)
  const hook = keyHook(); house.place(hook, 4.38, 1.1, 1.45, -Math.PI / 2); L.refs.keyHook = house.local(4.3, 1.45, 1.1)
  L.refs.helmetPos = house.local(3.9, 1.3, 2.4); L.refs.rack = rack
  // phone now starts on the low coffee table by the sofa, not the kitchen table
  L.refs.homeTable = house.local(2.4, 0.75, -0.8)
  L.refs.tiffinPos = house.local(-2.9, 0.9, 0.4)
  L.refs.tiffin = tiffin
  // interior partitions: a kitchen wall and a small back bedroom, with wide gaps to walk through
  {
    const pw = withPBR(new THREE.MeshStandardMaterial({ map: tex.plaster('#dccba6') }))
    const div = (lx0, lz0, lx1, lz1, hh = 1.3) => {
      const ww = Math.max(0.14, Math.abs(lx1 - lx0)), dd = Math.max(0.14, Math.abs(lz1 - lz0))
      bx(house.group, ww, hh, dd, pw, (lx0 + lx1) / 2, hh / 2, (lz0 + lz1) / 2)
    }
    div(-4.35, -1.15, -1.7, -1.15)   // kitchen / living divider
    div(0.95, -1.15, 4.35, -1.15)    // bedroom front
    div(1.15, -2.9, 1.15, -1.85)     // bedroom side
    // a second small room divider on the left
    div(-2.2, -2.9, -2.2, -2.0, 1.1)
  }
  // yard
  const ch = charpai(); ch.position.set(-4.5, 0, 7.6); ch.rotation.y = 0.2; L.add(ch)
  const tul = bush(0.6); tul.position.set(4.6, 0, 5.2); L.add(tul)
  cyl(L.group, 0.28, 0.22, 0.4, withPBR(new THREE.MeshStandardMaterial({ map: tex.mudwall() })), 4.6, 0, 5.2, 10)
  const mt2 = matka(); mt2.position.set(-5.5, 0, 5); L.add(mt2)
  // gate wall
  const wall = withPBR(new THREE.MeshStandardMaterial({ map: tex.plaster('#cdbd96') }))
  bx(L.group, 6.6, 1.2, 0.2, wall, -3.7, 0, 11.6); bx(L.group, 6.6, 1.2, 0.2, wall, 6.1, 0, 11.6); L.solid(-7, 11.5, -0.4, 11.75, 1.2); L.solid(2.8, 11.5, 9.4, 11.75, 1.2)
  bx(L.group, 0.3, 1.5, 0.3, wall, -0.4, 0, 11.6); bx(L.group, 0.3, 1.5, 0.3, wall, 2.8, 0, 11.6)
  // compound boundary: low walls round the yard, with a clear gap at the front door
  {
    const bwl = withPBR(new THREE.MeshStandardMaterial({ map: tex.plaster('#cbb994') }))
    bx(L.group, 0.22, 1.05, 8.3, bwl, -7.2, 0, 7.4)
    bx(L.group, 0.22, 1.05, 8.3, bwl, 7.2, 0, 7.4)
    bx(L.group, 6.9, 1.05, 0.22, bwl, -3.75, 0, 3.35)
    bx(L.group, 5.4, 1.05, 0.22, bwl, 4.5, 0, 3.35)
    L.solid(-7.3, 3.3, -7.1, 11.5, 1.05); L.solid(7.1, 3.3, 7.3, 11.5, 1.05)
    L.solid(-7.3, 3.3, -0.4, 3.5, 1.05); L.solid(1.8, 3.3, 7.3, 3.5, 1.05)
  }
  // the front gate (on the road side): two iron leaves that swing open towards the street when anyone gets near
  { const iron = new THREE.MeshStandardMaterial({ color: '#2f3a34', roughness: 0.6, metalness: 0.6 })
    const leaf = (hx, dir) => { const piv = new THREE.Group(); piv.position.set(hx, 0, 11.6); const lf = new THREE.Group(); lf.position.x = dir * 0.8; lf.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.05), iron)); lf.children[0].position.y = 1.15; const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.05), iron); b2.position.y = 0.25; lf.add(b2); for (let i = 0; i < 8; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.04), iron); bar.position.set(-0.65 + i * 0.185, 0.7, 0); lf.add(bar) } piv.add(lf); L.add(piv); return piv }
    const a = leaf(-0.2, 1), b = leaf(2.6, -1)
    const gb = L.walk.box(-0.4, 11.45, 2.8, 11.75); let open = 0
    L.refs.gatePos = new THREE.Vector3(1.2, 1, 11.6)
    L.updaters.push((dt) => {
      const sc = G.scooter, pl = G.player, near = (x, z) => Math.hypot(x - 1.2, z - 11.6) < 5.2
      const want = near(pl.pos.x, pl.pos.z) || (sc && near(sc.chassis.position.x, sc.chassis.position.z)) ? 1 : 0
      const was = open; open += (want - open) * Math.min(1, dt * 2.6)
      a.rotation.y = -1.5 * open; b.rotation.y = 1.5 * open
      if (was < 0.5 && open >= 0.5) { const i = L.walk.boxes.indexOf(gb); if (i >= 0) L.walk.boxes.splice(i, 1); if (G.audio.ctx) G.audio.door(L.refs.gatePos, true) }
      if (was >= 0.5 && open < 0.5) { if (!L.walk.boxes.includes(gb)) L.walk.boxes.push(gb); if (G.audio.ctx) G.audio.door(L.refs.gatePos, false) }
    }) }
  // a covered veranda in front of the door: the scooter is parked here
  { const rf = bx(L.group, 7.2, 0.14, 3.0, wall, 0, 2.7, 4.8); for (const [x, z] of [[-3.4, 6.1], [3.4, 6.1]]) cyl(L.group, 0.1, 0.1, 2.7, wall, x, 0, z, 8); L.walk.circle(-3.4, 6.1, 0.15); L.walk.circle(3.4, 6.1, 0.15) }
  // neighbours across the street
  buildHouse(L, { x: -14, z: 25, w: 8, d: 6, h: 3.4, rot: Math.PI, col: '#b8d0c2', roof: 'flat', interior: false, windows: [{ side: 's', x: -2, y: 1.3, w: 1, h: 1, lit: true }, { side: 's', x: 2, y: 1.3, w: 1, h: 1 }] })
  buildHouse(L, { x: 5, z: 26, w: 9, d: 6, h: 3.4, rot: Math.PI, col: '#d8b8a0', roof: 'tile', interior: false, windows: [{ side: 's', x: -2.5, y: 1.3, w: 1, h: 1 }] })
  buildHouse(L, { x: 24, z: 25, w: 7, d: 6, h: 3.2, rot: Math.PI, col: '#c8c0e0', roof: 'flat', interior: false, windows: [{ side: 's', x: 0, y: 1.3, w: 1.2, h: 1 }] })
  buildHouse(L, { x: -24, z: -4, w: 8, d: 7, h: 3.2, rot: 0, col: '#e8d0a0', roof: 'tile', interior: false })
  buildHouse(L, { x: 17, z: -2, w: 8, d: 7, h: 3.2, rot: 0, col: '#cfd8c0', roof: 'flat', interior: false })
  for (let x = -20; x <= 80; x += 22) { pole(L, x, 11.2, 8); }
  for (let x = -20; x < 80; x += 22) wires(L, { x, y: 7.6, z: 11.2 }, { x: x + 22, y: 7.6, z: 11.2 }, 0.8)
  streetLight(L, 12, 11.6, false)
  const auto = autoRickshaw(); auto.position.set(-12, 0, 16); auto.rotation.y = Math.PI / 2; L.add(auto); L.walk.circle(-12, 16, 1.1); L.walk.circle(-12.7, 16, 1)
  const cw = cow(); cw.position.set(18, 0, 16.4); cw.rotation.y = 1.4; L.add(cw); L.walk.circle(18, 16.4, 0.9)
  const dg = dogModel(); dg.position.set(2, 0, 17.3); dg.rotation.y = 2; L.add(dg)
  // trees
  const tr = (x, z, s = 1) => { const g = new THREE.Group(); const t = cyl(g, 0.22 * s, 0.32 * s, 4 * s, withPBR(new THREE.MeshStandardMaterial({ map: tex.bark() })), 0, 0, 0, 8); for (let i = 0; i < 3; i++) sph(g, 1.8 * s, new THREE.MeshStandardMaterial({ map: tex.leaf(), color: '#7aa860' }), R.range(-0.8, 0.8), 4.4 * s + i * 0.5, R.range(-0.8, 0.8)); g.position.set(x, 0, z); L.add(g); L.walk.circle(x, z, 0.35 * s) }
  tr(-6, 9.5, 1.1); tr(9, 8.4, 1.2); tr(30, 19, 1.3); tr(-30, 19, 1.2); tr(40, 10, 1.1); tr(55, 18.5, 1.3); tr(65, 10, 1.2)
  if (!night) {
    // chacha on the veranda, working on his bike
    const bk = motorbike('#a31d1d'); bk.position.set(2.6, 0, 6.4); bk.rotation.y = Math.PI / 2; L.add(bk); L.walk.circle(2.0, 6.4, 0.55); L.walk.circle(3.2, 6.4, 0.55)
    const ch = G.addActor('chacha'); ch.place(2.6, 7.6, Math.PI); ch.sfx = false; ch.P.setPose('rub'); ch.P.crouch = 0.55; L.walk.circle(2.6, 7.6, 0.45); L.refs.chacha = ch; L.refs.chachaPos = new THREE.Vector3(2.6, 1.1, 7.4)
    if (!o.inRoad) makeTraffic(L, G, [{ x: -30, z: 15 }, { x: 150, z: 15 }], { count: 6, lane: 2.1 })
  }
  // ---- the neighbourhood is open to roam: you can walk or ride off the road, anywhere that is not a wall ----
  if (!o.inRoad) { L.walk.free = true; L.core = [[{ x: -30, z: 15 }, { x: 150, z: 15 }]]; L.roam = { stray: 600, pits: 0, seed: 3 } }
  L.noTwigs = true
  if (!night) {
    // a run-down, crowded lane: more houses, rough walls and patched roofs
    const wallKinds = ['plaster', 'mud', 'brick'], dull = ['#c9b99a', '#b9a98a', '#a8a090', '#c4aa88', '#9fa89a', '#b8a08a'], roofs = ['tile', 'tin', 'thatch', 'flat']
    const extra = [[-40, -4, 0], [36, -3, 0], [54, -3, 0], [72, -3, 0], [92, -3, 0], [112, -3, 0], [44, 26, Math.PI], [64, 25, Math.PI], [84, 26, Math.PI], [104, 26, Math.PI], [-40, 25, Math.PI], [-58, 12, Math.PI / 2], [-58, -4, Math.PI / 2]]
    extra.forEach(([x, z, rot], i) => buildHouse(L, { x, z, w: 5.2 + R.next() * 3.4, d: 4.6 + R.next() * 1.2, h: 2.6 + R.next() * 0.6, rot, col: dull[i % dull.length], roof: roofs[i % 4], wall: wallKinds[i % 3], interior: false, windows: [{ side: 's', x: -1.4, y: 1.2, w: 0.8, h: 0.9, lit: R.next() < 0.35 }, { side: 's', x: 1.6, y: 1.2, w: 0.7, h: 0.8 }] }))
    // street litter, rubbish heaps, broken things
    const heap = (x, z, s = 1) => { const g = new THREE.Group(), cols = ['#2a2620', '#4a3a2a', '#5a5a52', '#6a4a3a', '#1e2a22']; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + R.next() * 0.2, 0), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 1 })); m.position.set(R.range(-0.6, 0.6) * s, 0.1 + R.next() * 0.2, R.range(-0.5, 0.5) * s); m.rotation.set(R.next() * 3, R.next() * 3, R.next() * 3); g.add(m) } g.position.set(x, 0, z); L.add(g); L.walk.circle(x, z, 0.75 * s) }
    for (const [x, z] of [[-18, 20.2], [8, 10.2], [26, 20.3], [41, 10.1], [58, 20.1], [78, 10.2], [96, 20.2], [-26, 10.3], [112, 10.4]]) heap(x, z, 0.9 + R.next() * 0.5)
    const cart = new THREE.Group(); bx(cart, 1.6, 0.12, 0.9, new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 1 }), 0, 0.6, 0); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 14), new THREE.MeshStandardMaterial({ color: '#1a1a1a' })); w.position.set(0, 0.34, s * 0.5); w.rotation.y = Math.PI / 2; cart.add(w) } bx(cart, 0.08, 0.5, 0.08, new THREE.MeshStandardMaterial({ color: '#3a2a1a' }), 0.85, 0.6, 0); cart.position.set(31, 0, 20.4); cart.rotation.y = 0.4; L.add(cart); L.walk.circle(31, 20.4, 1)
    // a tin-sheet shack, a tea stall, a broken bike
    const shack = new THREE.Group(); bx(shack, 3.2, 2.2, 2.6, new THREE.MeshStandardMaterial({ map: tex.tin(), roughness: 0.8, metalness: 0.4 }), 0, 0, 0); const tilt = bx(shack, 3.6, 0.08, 3.0, new THREE.MeshStandardMaterial({ color: '#5a5a58', roughness: 0.8, metalness: 0.5 }), 0, 2.2, 0); tilt.rotation.z = 0.1; shack.position.set(-34, 0, 8.4); L.add(shack); L.solid(-35.6, 7.1, -32.4, 9.7, 2.3)
    const stall = teaStall(); stall.position.set(48, 0, 8.6); stall.rotation.y = Math.PI; L.add(stall); L.walk.circle(48, 8.6, 1.6)
    const wreck = motorbike('#5a5248'); wreck.position.set(20.5, 0, 9.4); wreck.rotation.y = 0.8; wreck.userData.lean.rotation.z = 0.9; L.add(wreck); L.walk.circle(20.5, 9.4, 0.7)
    // torn banner, laundry line, broken fence
    wiresFn(L, { x: 60, y: 2.3, z: 5 }, { x: 68, y: 2.3, z: 5 }, 0.3)
    for (let i = 0; i < 5; i++) { const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ color: ['#a33', '#37a', '#ddc', '#7a5', '#c93'][i], side: THREE.DoubleSide, roughness: 1 })); cl.position.set(60.8 + i * 1.5, 1.9, 5); L.add(cl) }
    for (let i = 0; i < 7; i++) { const pk = bx(L.group, 0.1, 1.0 - (i % 3) * 0.25, 0.06, new THREE.MeshStandardMaterial({ color: '#6a5a44', roughness: 1 }), 62 + i * 0.7, 0, 9.4); pk.rotation.z = (R.next() - 0.5) * 0.7 }
    // a drain, potholes, puddles
    const drain = new THREE.Mesh(new THREE.PlaneGeometry(190, 0.5), new THREE.MeshStandardMaterial({ color: '#12170f', roughness: 0.2, metalness: 0.4 })); drain.rotation.x = -Math.PI / 2; drain.position.set(40, 0.02, 10.0); L.add(drain)
    for (const [x, z, r] of [[10, 13.4, 0.8], [27, 16.6, 0.6], [43, 14.2, 0.9], [60, 17.1, 0.7], [79, 13.2, 0.8], [96, 16.4, 0.6]]) { const ph = new THREE.Mesh(new THREE.CircleGeometry(r, 12), new THREE.MeshStandardMaterial({ color: '#16130f', roughness: 0.3, metalness: 0.3 })); ph.rotation.x = -Math.PI / 2; ph.position.set(x, 0.03, z); ph.scale.y = 0.7; L.add(ph); L.puddle(x + 0.3, z - 0.2, r * 0.6) }
    for (const [x, z] of [[-6, 12.2], [14, 11.5], [34, 18.4]]) { const dg2 = dogModel(); dg2.position.set(x, 0, z); dg2.rotation.y = R.next() * 6; L.add(dg2) }
    for (const x of [-32, 22, 66, 96, 126]) tr(x + 4, R.range(-12, -6), 1.1), tr(x, R.range(24, 34), 1.2)
  }
  // scooter parked on the street, facing +x (east: the way out of town)
  L.spawn = night ? { x: 2, z: 5, yaw: Math.PI } : { x: -2.35, z: -1.9, yaw: Math.PI / 2 } // wake up beside the bed
  if (!night) {
    G.addScooter(L, -1.6, 5.0, 0)   // parked on the veranda, facing the gate
  }
  return house
}

export function build(G, opts = {}) {
  const night = !!opts.night
  const L = new Level(G, 'home')
  G.env.set(night ? 'night' : 'homeDay', true)
  L.ground(300, 300, 'grass', 8, 0, 0, night ? 0xb0b8c0 : 0xffffff)
  // road along x at z=14
  const road = L.ground(260, 8, 'road', 6, 20, 15); road.position.y = 0.012
  const verge = L.ground(260, 1.4, 'mud', 3, 20, 10.3); verge.position.y = 0.008
  const verge2 = L.ground(260, 1.4, 'mud', 3, 20, 19.7); verge2.position.y = 0.008
  L.walk.corridor([[-30, 15], [90, 15]], 4.2, 'road')
  L.walk.bound = { x0: -70, z0: -40, x1: 150, z1: 60 }
  const house = populateHome(G, L, night)
  // ambience
  L.isIndoors = (x, z) => (house.inside(x, z) ? 1 : 0)
  L.ambient = (S, p) => { const ins = house.inside(p.pos.x, p.pos.z); S.fan = ins ? 0.8 : 0; S.room = ins ? 0.6 : 0.1; S.traffic = night ? 0.0 : (ins ? 0.25 : 0.55); S.birds = night ? 0 : 0.6; S.insects = night ? 0.7 : 0 }
  L.sceneTick = 0
  return L
}
