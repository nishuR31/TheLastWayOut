// Chapter 7-8: the "village". Looks ordinary: mud + brick houses, lantern light, no wires, no poles. The uncle's house is at the end of the lane.
import * as THREE from 'three'
import { Level, buildHouse, charpai, table, stool, matka, brassVessel, chulha, garlandedPhoto, bush, cyl, bx, sph, diya } from '../world/build.js'
import { makeSteelGlass, makeGlass } from '../world/people.js'
import { smoothPts, nightTick } from '../world/common.js'
import { scatterForest } from '../world/nature.js'
import { tex } from '../world/textures.js'
import { R } from '../core/util.js'

export function build(G, opts = {}) {
  const L = new Level(G, 'village')
  G.env.set('still', true)
  L.ground(300, 300, 'mud', 6, 0, 30, 0x9aa090)
  const lane = smoothPts([[0, -16], [0.5, 10], [-0.5, 40], [0, 62]], 6)
  L.ribbon(lane, 2.4, 'mud', 4, 0.012, 0xb0a890); L.walk.corridor(lane, 3.0, 'lane'); L.lanePts = lane
  L.walk.rect(-3.5, 56, 3.5, 66, 'porch')
  L.surface = () => 'mud'
  L.add(scatterForest(G, { bounds: [-90, -40, 90, 120], trails: [{ pts: lane, hw: 3.0 }], avoid: [{ x: 0, z: 40, r: 22 }], density: 0.02, seed: 61, walk: L.walk, allTrees: true }))
  L.walk.bound = { x0: -80, z0: -34, x1: 80, z1: 108 }
  L.walk.free = true; L.core = [lane]; L.roam = { stray: 44, pits: 6, seed: 61 }   // free roam round the village too
  const mats = ['plaster', 'mud', 'brick']
  const mk = (x, z, rot, w, d, col, roof, wall, pale = false, lit = false) => {
    const wd = [{ side: 's', x: -1.2, y: 1.2, w: 0.7, h: 0.7, lit: false, pale, color: pale ? '#06080a' : undefined }, { side: 's', x: 1.6, y: 1.2, w: 0.7, h: 0.7, lit, pale: pale && R.next() < 0.5, color: lit ? '#c8903f' : '#06080a' }]
    const hs = buildHouse(L, { x, z, w, d, h: 2.7, rot, col, roof, wall, floor: 'earth', interior: false, windows: wd, doorX: 0.3, doorW: 0.95 }); (L.doorHouses = L.doorHouses || []).push(hs); return hs
  }
  mk(-8.5, 6, Math.PI / 2, 6, 4.5, '#d6c6a0', 'tile', 'plaster', true)
  mk(8.5, 10, -Math.PI / 2, 5.5, 4.5, '#b9a78a', 'thatch', 'mud', false, true)
  mk(-9, 22, Math.PI / 2, 6.5, 5, '#cbbd9c', 'tile', 'brick', true)
  mk(9, 27, -Math.PI / 2, 6, 4.5, '#d0c2a2', 'tile', 'plaster', true)
  mk(-8.5, 40, Math.PI / 2, 5.5, 4.5, '#b5a384', 'thatch', 'mud', false)
  mk(8.8, 44, -Math.PI / 2, 6, 5, '#d6c9aa', 'tile', 'brick', true)
  // lanterns hung on a few doors (no poles, no wires)
  for (const [x, z] of [[-5.6, 7.2], [5.7, 8.6], [-5.8, 40.6], [5.4, 45.5], [-5.9, 23]]) L.lantern(x, 1.9, z, { dist: 9, int: 5, glow: 1.5 })
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
  // uncle's house
  const H = buildHouse(L, { x: 0, z: 64, w: 7.5, d: 5.5, h: 2.8, rot: Math.PI, wall: 'mud', col: '#b9a78a', roof: 'tile', floor: 'earth', doorX: 0, doorW: 1.0, closedDoor: true, name: 'uncle', windows: [{ side: 's', x: -2.3, y: 1.2, w: 0.7, h: 0.8, color: '#a8742e' }, { side: 's', x: 2.3, y: 1.2, w: 0.7, h: 0.8, color: '#a8742e' }] })
  L.house = H
  const lamp = H.addLight(0.8, 1.6, 0.3, '#ff9a46', 9, 11); L.flick.push({ light: lamp, base: 9, sp: 7, ph: 1 })
  const lamp2 = H.addLight(-2.4, 1.2, -1.8, '#ff9440', 3, 6); L.flick.push({ light: lamp2, base: 3, sp: 9, ph: 2 })
  const lan = L.lantern(0, 0, 0, { light: false }); const lp = H.local(0.8, 1.9, 0.3); lan.position.copy(lp)
  H.place(charpai(), 2.6, -1.8, 0, 0.1)
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
