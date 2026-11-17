// Chapter 3-4: dense bamboo shade in the storm.
import * as THREE from 'three'
import { forestLevel, clearing, nightTick, windSway } from '../world/common.js'
import { makeRock, makeLog, scatterBamboo } from '../world/nature.js'
import { audio } from '../core/audio.js'
import { R } from '../core/util.js'
import { makeMirage } from '../world/mirage.js'

export function build(G, opts = {}) {
  G.env.set(opts.env || 'storm', true)
  const L = forestLevel(G, { name: 'bamboo', trails: [{ pts: [[0, -14], [1, 14], [0, 36]], hw: 2, name: 'in' }, { pts: [[1, 54], [1, 72], [5, 100], [14, 130]], hw: 1.7, name: 'out' }], bounds: [-90, -30, 90, 150], density: 0.022, seed: 21, groundSize: [300, 300, 0, 50], avoid: [{ x: 0, z: 47, r: 12 }], groundColor: 0xbcc4b4 })
  clearing(L, 0, 47, 8, 'shelter', 'mud', 5)
  L.puddle(-2, 44, 1.1); L.puddle(3, 50, 0.8)
  // A scattered grove: varied clump sizes, random gaps, no tidy ring.
  const grove = scatterBamboo(G, { bounds: [-60, -8, 60, 105], centre: { x: 0, z: 47 }, inner: 8, outer: 32, gap: 5.2, count: 18, seed: 31, trails: L.trails, walk: L.walk, level: L })
  L.add(grove); windSway(L, G, grove.userData.swayers)
  const pos = grove.children.filter(c => c.userData && c.userData.sway).map(c => [c.position.x, c.position.z])
  const log = makeLog(2.4, 0.2); log.position.set(-3, 0.2, 47); log.rotation.y = 0.9; L.add(log)
  const rk = makeRock(0.8); rk.position.set(3.4, 0.22, 46); L.add(rk); L.walk.circle(3.4, 46, 0.7)
  if (!opts.story) L.refs.firePit = { x: 0.6, z: 44.2 }
  L.refs.seat = new THREE.Vector3(-3, 0.5, 47); L.refs.rock = new THREE.Vector3(3.4, 0.6, 46)
  L.bambooNear = (x, z) => { let m = 99; for (const p of pos) m = Math.min(m, Math.hypot(x - p[0], z - p[1])); return m }
  L.isIndoors = (x, z) => (Math.hypot(x, z - 47) < 6 ? 0.9 : 0)
  // a small stream with smooth stones (fire ring), a hollow stump, and the far village glow
  const stm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 40), new THREE.MeshStandardMaterial({ color: '#4d6f7c', roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.8 })); stm.rotation.x = -Math.PI / 2; stm.position.set(-20, 0.03, 52); L.add(stm)
  L.refs.stones = [[-17.5, 49], [-17, 51.5], [-18, 54], [-16.8, 47], [-17.6, 56], [-16.9, 52.8]]
  L.refs.stones.forEach(([x, z]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: '#8a8880', roughness: 0.7 })); m.scale.set(1.2, 0.7, 1); m.position.set(x, 0.1, z); L.add(m) })
  const stump = new THREE.Group(); { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.8, 9), new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 1 })); c.position.y = 0.4; stump.add(c); for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 5), new THREE.MeshStandardMaterial({ color: '#b8b2a4', roughness: 1 })); t.position.set(-0.12 + (i % 3) * 0.12, 0.85, -0.07 + Math.floor(i / 3) * 0.14); t.rotation.z = (i % 2 ? 0.1 : -0.1); stump.add(t) } }
  stump.position.set(-9.5, 0, 62); L.add(stump); L.walk.circle(-9.5, 62, 0.5); L.refs.stump = new THREE.Vector3(-9.5, 0.9, 62)
  L.lightPos = new THREE.Vector3(18, 2.2, 270); L.mirage = makeMirage(L, G); L.mirage.place(L.lightPos.x, L.lightPos.z)
  L.setLight = (v) => { if (v) L.mirage.place(L.lightPos.x, L.lightPos.z); L.mirage.show(v) }
  L.spawn = { x: 0, z: -8, yaw: 0 }
  L.surface = () => 'mud'
  let dripT = 0
  L.tickAudio = (dt) => { if (!audio.ctx) return; dripT -= dt; if (dripT < 0 && Math.hypot(G.player.pos.x, G.player.pos.z - 47) < 7) { dripT = R.range(0.25, 1.1); audio.drip(0.9) } }
  return L
}
