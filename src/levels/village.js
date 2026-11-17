// Chapter 7-8: the "village". Looks ordinary: mud + brick houses, lantern light, no wires, no poles. The uncle's house is at the end of the lane.
import * as THREE from 'three'
import { Level, buildHouse, charpai, table, stool, matka, brassVessel, chulha, garlandedPhoto, bush, cyl, bx, sph, diya, wires } from '../world/build.js'
import { makeSteelGlass, makeGlass } from '../world/people.js'
import { smoothPts, nightTick } from '../world/common.js'
import { scatterForest, makeBanyan } from '../world/nature.js'
import { tex } from '../world/textures.js'
import { rolling } from '../world/terrain.js'
import { R } from '../core/util.js'

export function build(G, opts = {}) {
  const L = new Level(G, 'village')
  G.env.set('still', true)
  rolling(L, 61, 1.0)
  L.ground(300, 300, 'mud', 6, 0, 30, 0x9aa090)
  const lane = smoothPts([[0, -16], [0.5, 10], [-0.5, 40], [0, 62]], 6)
  L.ribbon(lane, 2.4, 'mud', 4, 0.012, 0xb0a890); L.walk.corridor(lane, 3.0, 'lane'); L.lanePts = lane
  L.walk.rect(-3.5, 56, 3.5, 66, 'porch')
  L.surface = () => 'mud'
  L.add(scatterForest(G, { bounds: [-90, -40, 90, 120], trails: [{ pts: lane, hw: 3.0 }], avoid: [{ x: 0, z: 40, r: 22 }], density: 0.02, seed: 61, walk: L.walk, allTrees: true, mode: 'natural', level: L }))
  L.walk.bound = { x0: -80, z0: -34, x1: 80, z1: 108 }
  L.walk.free = true; L.core = [lane]; L.roam = { stray: 44, pits: 6, seed: 61 }   // free roam round the village too
  const mk = (x, z, rot, w, d, col, roof, wall, pale = false, lit = false) => {
    const wd = [{ side: 's', x: -1.2, y: 1.2, w: 0.7, h: 0.7, lit: false, pale, color: pale ? '#06080a' : undefined }, { side: 's', x: 1.6, y: 1.2, w: 0.7, h: 0.7, lit, pale: pale && R.next() < 0.5, color: lit ? '#c8903f' : '#06080a' }]
    const hs = buildHouse(L, { x, z, w, d, h: 2.7, rot, col, roof, wall, floor: 'earth', interior: false, windows: wd, doorX: 0.3, doorW: 0.95 }); (L.doorHouses = L.doorHouses || []).push(hs); return hs
  }
  // A whole village, not a row of six facades: pairs of mud / brick houses
  // down both sides of the lane. Every door faces the lane and the well.
  const houses = [
    [-8.5, 6, Math.PI / 2, 6, 4.5, '#d6c6a0', 'tile', 'plaster', true, false],
    [8.5, 10, -Math.PI / 2, 5.5, 4.5, '#b9a78a', 'thatch', 'mud', false, true], // the one lit window — this is the house that answers
    [-9, 22, Math.PI / 2, 6.5, 5, '#cbbd9c', 'tile', 'brick', true, false],
    [9, 27, -Math.PI / 2, 6, 4.5, '#d0c2a2', 'tile', 'plaster', true, false],
    [-8.5, 40, Math.PI / 2, 5.5, 4.5, '#b5a384', 'thatch', 'mud', false, false],
    [8.8, 44, -Math.PI / 2, 6, 5, '#d6c9aa', 'tile', 'brick', true, false],
    [-9.5, 14, Math.PI / 2, 5, 4, '#c2b193', 'thatch', 'mud', false, false],
    [9.2, 18, -Math.PI / 2, 5.5, 4.5, '#d8c9a8', 'tile', 'plaster', false, false],
    [-8.8, 32, Math.PI / 2, 6, 4.5, '#cbbd9c', 'tile', 'brick', true, false],
    [9, 36, -Math.PI / 2, 5, 4, '#b9a78a', 'thatch', 'mud', false, false],
    [-9.2, 50, Math.PI / 2, 5.5, 4.5, '#d0c2a2', 'tile', 'plaster', true, false],
    [8.7, 54, -Math.PI / 2, 6, 4.5, '#c2b193', 'thatch', 'brick', false, false]
  ]
  for (const h of houses) mk(...h)
  // Only this one house ever answers a knock; the lit window is a true clue.
  L.answerHouse = L.doorHouses[1]
  L.refs.answerDoor = L.answerHouse.doorWorld.clone()
  // a lantern by every door (no poles, no wires) — one of them is lit
  for (const hs of L.doorHouses) L.lantern(hs.doorWorld.x, 1.9, hs.doorWorld.z, { dist: 8, int: 4, glow: 1.3 })
  // white eyes in the windows: seen from the corner of your eye, gone the moment you look straight at them
  const eyes = []; L.group.traverse(o => { if (o.userData && o.userData.pale) { o.material = o.material.clone(); o.material.opacity = 0.9; eyes.push({ m: o, t: R.range(0, 4), gone: 0 }) } })
  L.eyes = eyes
  const _v = new THREE.Vector3(), _d = new THREE.Vector3()
  L.updaters.push((dt) => {
    G.camera.getWorldDirection(_d)
    for (const e of eyes) {
      e.m.getWorldPosition(_v); _v.sub(G.camera.position); const dist = _v.length(); _v.normalize()
      const dot = _v.dot(_d)
      if (e.gone > 0) { e.gone -= dt; e.m.visible = false; continue }
      if (dist > 30) { e.m.visible = false; continue }
      if (dot > 0.965 && e.m.visible) { e.m.visible = false; e.gone = 7 + Math.random() * 6; continue }       // looked straight at them: gone
      e.t -= dt; if (e.t <= 0) { e.m.visible = dot > 0.35 && dot < 0.94 && dist < 26 && (e.show !== false); e.t = 0.4 }
    }
  })
  L.flashEyes = (house) => { for (const e of eyes) if (e.m.parent === house.group) { e.gone = 0; e.m.visible = true; e.t = 3 } }

  // ---- the well and the banyan, at the heart of the village ---------------
  const gy = (x, z) => (L.groundY ? L.groundY(x, z) : 0)
  const wx = 4.6, wz = 35
  const stoneM = new THREE.MeshStandardMaterial({ map: tex.stone('#8a8578'), roughness: 1 })
  const well = cyl(L.group, 1.15, 1.25, 0.9, stoneM, wx, gy(wx, wz) + 0.45, wz, 16)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.11, 6, 18), stoneM)
  rim.rotation.x = Math.PI / 2; rim.position.set(wx, gy(wx, wz) + 0.92, wz); L.group.add(rim)
  const woodM = new THREE.MeshStandardMaterial({ color: '#6b4a2c', roughness: 1 })
  for (const s of [-1, 1]) bx(L.group, 0.12, 2.3, 0.12, woodM, wx + s * 1.0, gy(wx, wz) + 1.15, wz)
  bx(L.group, 2.3, 0.14, 0.14, woodM, wx, gy(wx, wz) + 2.25, wz)
  cyl(L.group, 0.02, 0.02, 1.6, new THREE.MeshStandardMaterial({ color: '#9a8c6a' }), wx, gy(wx, wz) + 1.5, wz, 6)
  const redCloth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshStandardMaterial({ color: '#8e2020', side: THREE.DoubleSide, roughness: 1 }))
  redCloth.rotation.x = -Math.PI / 2; redCloth.position.set(wx + 0.45, gy(wx, wz) + 0.96, wz + 0.2); L.group.add(redCloth)
  L.walk.circle(wx, wz, 1.4); L.refs.well = new THREE.Vector3(wx, gy(wx, wz) + 1, wz)
  const bxz = -4.8, bzz = 39
  const banyan = makeBanyan(0.9); banyan.position.set(bxz, gy(bxz, bzz), bzz); L.add(banyan)
  L.walk.circle(bxz, bzz, 1.4); L.refs.banyan = new THREE.Vector3(bxz, gy(bxz, bzz), bzz)
  // short, crooked picket fences along the lane edges (no poles or wires)
  const fence = new THREE.MeshStandardMaterial({ color: '#7c6444', roughness: 1 })
  for (const side of [-1, 1]) for (let z = 4; z <= 58; z += 1.35) {
    if (Math.abs(z - 35) < 6) continue // leave the well / banyan clearing open
    const x = side * 3.4 + (R.next() - 0.5) * 0.3
    const pk = bx(L.group, 0.1, 0.85 - (z % 3) * 0.12, 0.09, fence, x, gy(x, z) + 0.42, z)
    pk.rotation.z = (R.next() - 0.5) * 0.5
  }
  // wet laundry on a rope between two houses — swaying though there is no wind
  wires(L, { x: -6.4, y: 2.2, z: 15 }, { x: -6.4, y: 2.2, z: 21 }, 0.35)
  for (let i = 0; i < 4; i++) {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42 + R.next() * 0.2, 0.55), new THREE.MeshStandardMaterial({ color: ['#c9bba0', '#7d9a8c', '#a85a4a', '#d8cba8'][i], side: THREE.DoubleSide, roughness: 1 }))
    cloth.position.set(-6.4, 1.7 - Math.sin(i / 3 * Math.PI) * 0.2, 15.6 + i * 1.4)
    cloth.rotation.y = Math.PI / 2; cloth.rotation.x = (R.next() - 0.5) * 0.25
    L.group.add(cloth)
  }
  // charpoy outside a couple of doors
  for (const [x, z] of [[-5.2, 12], [5.6, 29], [-5.4, 47]]) {
    const ch = charpai(); const y = gy(x, z); ch.position.set(x, y, z); ch.rotation.y = R.range(0, 3); L.add(ch); L.walk.circle(x, z, 0.9)
  }
  // uncle's house
  const H = buildHouse(L, { x: 0, z: 64, w: 7.5, d: 5.5, h: 2.8, rot: Math.PI, wall: 'mud', col: '#b9a78a', roof: 'tile', floor: 'earth', doorX: 0, doorW: 1.0, closedDoor: true, name: 'uncle', windows: [{ side: 's', x: -2.3, y: 1.2, w: 0.7, h: 0.8, color: '#a8742e' }, { side: 's', x: 2.3, y: 1.2, w: 0.7, h: 0.8, color: '#a8742e' }] })
  L.house = H
  const lamp = H.addLight(0.8, 1.6, 0.3, '#ff9a46', 9, 11); L.flick.push({ light: lamp, base: 9, sp: 7, ph: 1 })
  const lamp2 = H.addLight(-2.4, 1.2, -1.8, '#ff9440', 3, 6); L.flick.push({ light: lamp2, base: 3, sp: 9, ph: 2 })
  const lan = L.lantern(0, 0, 0, { light: false }); const lp = H.local(0.8, 1.9, 0.3); lan.position.copy(lp)
  H.place(charpai(), 2.6, -1.8, 0, 0.1)
  // two cots, one smaller — "Do hi cot hain. Teen log rehte hain?"
  const smallCot = charpai(); smallCot.scale.setScalar(0.72); H.place(smallCot, -2.3, 1.5, 0, 0.25)
  // five steel glasses, three with water — the detail nobody explains
  const gg = [[0.35, 0.35], [0.58, 0.42], [0.82, 0.32], [0.45, 0.62], [0.72, 0.66]]
  gg.forEach(([lx, lz], i) => { const glass = i < 3 ? makeGlass(true) : makeSteelGlass(); glass.scale.setScalar(0.32); H.place(glass, lx, lz, 0.42, 0) })
  H.place(chulha(), -3.0, -2.2, 0, 0); H.place(matka(), -3.2, 0.2, 0, 0); H.place(brassVessel(1.4), -2.6, -1.0, 0.0, 0)
  const ph = garlandedPhoto(); H.place(ph, 3.74, 1.0, 1.5, -Math.PI / 2)
  const tb = table(1.0, 0.7, 0.42); H.place(tb, 0.6, 0.3, 0, 0)
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshStandardMaterial({ map: tex.cloth('#6a5a3a', '#b8a070', 'check'), roughness: 1 })); mat.rotation.x = -Math.PI / 2; H.place(mat, 0.2, 0.2, 0.025)
  diya(L, 0, 0, 0); // placeholder removed below
  L.group.children.pop(); L.group.children.pop(); L.flick.pop()
  L.refs.tray = H.local(0.6, 0.45, 0.3)
  L.refs.sit1 = H.local(-0.5, 0, 1.0); L.refs.sit2 = H.local(1.6, 0, 1.0)
  L.refs.uncleSpot = H.local(0.6, 0, -1.0); L.refs.daughterSpot = H.local(2.5, 0, -1.2)
  L.refs.doorOut = H.local(0, 0, 3.2); L.refs.doorIn = H.local(0, 0, 0.6)
  L.refs.knock = new THREE.Vector3(0.3, 1.4, 61.0)
  L.refs.glassPos = H.local(0.6, 0.5, 0.3)
  // where we arrive: the end of the forest trail
  L.spawn = { x: 0, z: -12, yaw: 0 }
  L.isIndoors = (x, z) => (H.inside(x, z) ? 1 : 0)
  L.ambient = (S) => { const ins = H.inside(G.player.pos.x, G.player.pos.z); S.room = ins ? 0.5 : 0; S.birds = 0; S.insects = 0; S.traffic = 0 }
  return L
}
