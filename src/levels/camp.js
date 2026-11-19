// The campsite: a clearing with a stone fireplace, tents, a bench, a stream, a bamboo grove behind it and a big sal tree
// (with the bikes) sixty steps away at the far edge. Day first; the story turns the weather.
import * as THREE from 'three'
import { forestLevel, clearing, nightTick } from '../world/common.js'
import { scatterBamboo, makeSiris, makeLog } from '../world/nature.js'
import { signboard, bx, cyl, motorbike } from '../world/build.js'
import { tex } from '../world/textures.js'
import { R } from '../core/util.js'

export function build(G, opts = {}) {
  G.env.set(opts.env || 'day', true)
  // The entry bends through the trees instead of cutting straight across an
  // open field — the board should feel like a threshold into the forest.
  const entry = [[0, -34], [2, -18], [-3, -2], [4, 18], [-2, 38], [0, 60]]
  const toBamboo = [[0, 60], [-22, 80], [-46, 104]]
  const L = forestLevel(G, { name: 'camp', trails: [{ pts: entry, hw: 2.2, name: 'entry' }, { pts: toBamboo, hw: 1.8, name: 'toBamboo' }], bounds: [-110, -40, 110, 160], density: 0.032, seed: 71, groundSize: [320, 320, 0, 60], avoid: [{ x: 0, z: 62, r: 17 }, { x: 36, z: 92, r: 8 }, { x: -30, z: 100, r: 14 }], freeRoam: { stray: 60, pits: 8 } })
  L.entryPts = L.trails[0].pts
  clearing(L, 0, 62, 16, 'camp', 'mud', 5)
  // entry signboards
  const sb = signboard('JUNGLE RESERVE\nENTRY ALLOWED TILL 5:00 PM', '#3a5a34', '#f2f0e0', 3, 1.2); sb.position.set(4.2, 0, -18); sb.rotation.y = Math.PI + 0.1; L.add(sb)
  const sb2 = signboard('CAMP SITE →', '#7a5a2a', '#f4eed8', 2, 0.8); sb2.position.set(-3.6, 0, 6); sb2.rotation.y = Math.PI - 0.15; L.add(sb2)
  const sb3 = signboard('Jungle ke raaste ka dhyan rakhein', '#2a2a2a', '#f4eed8', 2.4, 0.8); sb3.position.set(-4.5, 0, 52); sb3.rotation.y = Math.PI - 0.3; L.add(sb3)
  L.refs.firePit = { x: 0, z: 60 }                 // the old blackened stone fireplace (fire.populate builds it)
  // the stone with the scratched drawing
  const dr = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: '#7a776e', roughness: 1 })); dr.position.set(1.6, 0.09, 58.6); dr.rotation.y = 0.4; L.add(dr); L.refs.drawing = new THREE.Vector3(1.6, 0.3, 58.6); L.refs.drawStone = dr
  const dmark = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: tex.sign('⌂ ⌂   ⌂', '#7a776e', '#2a2824', 128, 96, '700 38px Inter, sans-serif'), transparent: true })); dmark.rotation.x = -Math.PI / 2; dmark.position.set(1.6, 0.185, 58.6); dmark.rotation.z = 0.4; L.add(dmark); L.refs.drawMark = dmark
  // wood pile, bench, log seats
  const wood = new THREE.Group(); for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 7), new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 1 })); m.rotation.z = Math.PI / 2; m.position.set(0, 0.08 + Math.floor(i / 3) * 0.14, (i % 3) * 0.17); wood.add(m) } wood.position.set(3.4, 0, 62.5); L.add(wood)
  const bench = new THREE.Group(); bx(bench, 1.8, 0.07, 0.4, new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 1 }), 0, 0.42, 0); for (const x of [-0.8, 0.8]) bx(bench, 0.07, 0.42, 0.35, new THREE.MeshStandardMaterial({ color: '#4a331c' }), x, 0, 0); bench.position.set(-4.5, 0, 63.5); bench.rotation.y = 1.2; L.add(bench); L.walk.circle(-4.5, 63.5, 0.8); L.refs.bench = new THREE.Vector3(-4.5, 0.5, 63.5)
  for (const [x, z, a] of [[-2.4, 59, 0.4], [2.6, 64.6, 2.4], [-1, 65.5, 1.6]]) { const lg = makeLog(1.2, 0.18); lg.position.set(x, 0.18, z); lg.rotation.y = a; L.add(lg) }
  // tents
  const tent = (x, z, ry, col) => { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide }); const c = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.5, 4), m); c.rotation.y = Math.PI / 4; c.scale.set(1.15, 1, 0.85); c.position.y = 0.75; g.add(c); g.position.set(x, 0, z); g.rotation.y = ry; L.add(g); L.walk.circle(x, z, 1.5) }
  tent(-11, 55, 0.4, '#c8602a'); tent(-12.5, 67, -0.3, '#3f7a4a'); tent(11, 56, 0.2, '#3a5a9a')
  // the stream, flowing away from the camp downhill to the bamboo
  const st = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 78), new THREE.MeshStandardMaterial({ color: '#5d8394', roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.82 })); st.rotation.x = -Math.PI / 2; st.rotation.z = 0.58; st.position.set(-26, 0.03, 80); L.add(st); L.refs.stream = new THREE.Vector3(-22, 0.1, 70)
  // the bamboo grove behind the clearing
  const grove = scatterBamboo(G, { bounds: [-60, 88, 4, 130], centre: { x: -26, z: 110 }, inner: 4, outer: 24, gap: 5.5, count: 9, seed: 51, trails: L.trails, walk: L.walk, level: L })
  L.add(grove)
  // the sal tree (far edge, ~sixty steps away) with other visitors' bikes, and ours
  const sal = makeSiris(1.9); sal.position.set(38, 0, 94); L.add(sal); L.walk.circle(38, 94, 0.7); L.refs.salTree = new THREE.Vector3(38, 0, 94)
  const cols = ['#2a2a2e', '#a37a1d', '#1d4a7a']
  cols.forEach((c, i) => { const bk = motorbike(c); bk.position.set(33 + i * 1.5, 0, 90 - i * 0.8); bk.rotation.y = 0.5 + i * 0.1; L.add(bk); L.walk.circle(bk.position.x, bk.position.z, 0.7); bk.userData.crew = true; (L.refs.crewBikes = L.refs.crewBikes || []).push(bk) })
  // Two more visitors' bikes right by the approach, with their owners spawned
  // in ch2 — so the place is already inhabited when the player walks in.
  L.refs.visitorBikes = []
  ;[[-6.5, 46, 0.8], [6.2, 50, -0.5]].forEach(([x, z, ry], i) => {
    const bk = motorbike(cols[i % cols.length]); bk.position.set(x, 0, z); bk.rotation.y = ry
    L.add(bk); L.walk.circle(x, z, 0.7); L.refs.visitorBikes.push(bk)
  })
  L.refs.bikePos = new THREE.Vector3(36.5, 0.8, 92.5)
  G.addScooter(L, 36.5, 92.5, 2.1); G.scooter.park()
  L.spawn = { x: 0, z: -20, yaw: 0 }
  L.surface = (x, z) => (Math.hypot(x, z - 62) < 15 ? 'dirt' : 'grass')
  L.ambient = (S) => { const d = G.env.name === 'day' || G.env.name === 'evening'; S.birds = d ? 0.8 : 0; S.insects = d ? 0.3 : 0.9 }
  nightTick(L, G, { owl: 0, dog: 0, jackal: 0 })
  return L
}
