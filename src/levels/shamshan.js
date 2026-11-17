// Chapter 11 + Ending B: the cremation ground beside the forest. Respectful, realistic: trees, wet ground, a shed, samadhi markers.
import * as THREE from 'three'
import { forestLevel, clearing, nightTick, ptAt } from '../world/common.js'
import { makeBanyan, makeRock, makePeepal } from '../world/nature.js'
import { samadhi, cremationShed, gateway, waterTank, stoneMarker, diya, bush } from '../world/build.js'
import { R } from '../core/util.js'

export function build(G, opts = {}) {
  G.env.set(opts.env || 'deep', true)
  const inn = [[0, -10], [0, 8], [0, 18]]
  const out = [[20, 46], [38, 52], [60, 50], [80, 60]]
  const L = forestLevel(G, { name: 'shamshan', trails: [{ pts: inn, hw: 1.5, name: 'in' }, { pts: out, hw: 1.5, name: 'dir', noWalk: true }], bounds: [-70, -30, 110, 120], density: 0.03, seed: 91, groundSize: [260, 260, 20, 40], avoid: [{ x: 0, z: 42, r: 26 }], groundColor: 0xa4aa9c })
  L.dirPts = L.trails[1].pts
  L.walk.disc(0, 42, 24, 'ground'); L.walk.corridor(L.dirPts, 1.5, 'dirTrail'); L.walk.set('dirTrail', false)
  clearing(L, 0, 42, 24, 'groundX', 'ash', 6)
  // gateway (sign faces the arriving visitors)
  const gw = gateway('मुक्तिधाम'); gw.position.set(0, 0, 20); gw.rotation.y = Math.PI; L.add(gw); L.walk.circle(-2.2, 20, 0.5); L.walk.circle(2.2, 20, 0.5)
  const shed = cremationShed(); shed.position.set(-10, 0, 46); shed.rotation.y = 0.15; L.add(shed); L.walk.box(-12.1, 44.7, -7.9, 47.3); L.refs.shed = new THREE.Vector3(-10, 1, 46)
  const sm = [[10, 34, 0, 0.3], [14, 40, 1, -0.1], [8, 44, 2, 0.2], [18, 48, 0, 0.5], [4, 54, 1, -0.2], [-4, 58, 0, 0.1], [22, 36, 2, 0.0], [-16, 34, 1, 0.4]]
  sm.forEach(([x, z, k, r]) => { const m = samadhi(k, R.next() < 0.3); m.position.set(x, 0, z); m.rotation.y = r; L.add(m); L.walk.box(x - 0.95, z - 0.6, x + 0.95, z + 0.6) })
  // the samadhi that is being struck later (same style, further away, to the east)
  const tm = samadhi(0, false); tm.position.set(30, 0, 62); tm.rotation.y = -0.4; L.add(tm); L.refs.target = new THREE.Vector3(30, 0.6, 62); L.walk.box(29, 61.4, 31, 62.6)
  for (const [x, z] of [[-6, 38], [12, 52], [26, 52], [-14, 56]]) { const m = stoneMarker(); m.position.set(x, 0, z); L.add(m) }
  const wt = waterTank(); wt.position.set(-18, 0, 52); L.add(wt)
  // resting tree (banyan) with a low stone slab to sit on
  const by = makeBanyan(0.8); by.position.set(-14, 0, 40); L.add(by); L.walk.circle(-14, 40, 1.4)
  L.refs.firePit = { x: -5.4, z: 45 }
  L.refs.tree = new THREE.Vector3(-9.5, 0, 40); L.refs.rest = new THREE.Vector3(-8.2, 0.4, 42)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.7), new THREE.MeshStandardMaterial({ color: '#8c8a80', roughness: 1 })); slab.position.set(-8.4, 0.2, 41); slab.rotation.y = 0.3; L.add(slab)
  // a single diya on one samadhi: the only light besides ours
  diya(L, 14.3, 0.7, 40.4); L.puddle(2, 30, 1.4); L.puddle(-4, 48, 1.1)
  L.refs.dirPos = new THREE.Vector3(60, 1.4, 50)
  L.spawn = { x: 0, z: -6, yaw: 0 }
  L.surface = (x, z) => (Math.hypot(x, z - 42) < 24 ? 'ash' : 'mud')
  nightTick(L, G, { owl: 0.4, dog: opts.dog ?? 0.2, jackal: 0.3 })
  return L
}
