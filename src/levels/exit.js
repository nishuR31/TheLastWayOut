// Ending A: forest path (the direction the uncle pointed) -> a proper road. Dawn begins.
import * as THREE from 'three'
import { forestLevel, nightTick, shakyBush, makeSnake, sideAt, ptAt } from '../world/common.js'
import { makeRock, makeLog } from '../world/nature.js'
import { bush, streetLight, pole, signboard } from '../world/build.js'

export function build(G, opts = {}) {
  G.env.set('deep', true)
  const pts = [[0, -10], [0, 30], [10, 70], [-2, 115], [-12, 160], [-4, 205], [8, 250], [2, 290], [0, 320]]
  const road = [[-80, 345], [-30, 345], [0, 345], [60, 349], [120, 349]]
  const L = forestLevel(G, { name: 'exit', walkBound: [-95, -30, 130, 385], trails: [{ pts, hw: 1.3, name: 'path' }, { pts: road, hw: 3.4, name: 'road', tex: 'road', rep: 6, surface: 'road', y: 0.02 }], bounds: [-80, -30, 110, 330], density: 0.045, seed: 123, groundSize: [320, 460, 20, 170], avoid: [{ x: 0, z: -10, r: 4 }, { x: 0, z: 340, r: 14 }], groundColor: 0xa0a898 })
  // join: path ends at the road edge (0,320)->(0,345): short mud connector
  const conn = [[0, 318], [0, 332], [0, 345]]; L.ribbon(conn, 1.4, 'mud', 3, 0.014); L.walk.corridor(conn, 1.3, 'conn')
  L.pathPts = L.trails[0].pts; L.roadPts = L.trails[1].pts
  L.walk.set('road', true)
  const hp = [38, 74, 112, 150, 188, 226]
  L.bushes = hp.map((d, i) => { const s = sideAt(L.pathPts, d, (i % 2 ? 2.6 : -2.6)); const b = shakyBush(L, bush, s.x, s.z, 1.5); b.userData.pos = new THREE.Vector3(s.x, 0.6, s.z); return b })
  L.snake = makeSnake(); L.add(L.snake)
  // silhouette tree that looks like a person standing
  const bt = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ color: '#12100c', roughness: 1 })
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 1.8, 6), bm); c1.position.y = 0.9; bt.add(c1)
  const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), bm); c2.position.y = 1.92; c2.scale.set(0.9, 1.2, 0.9); bt.add(c2)
  const bp = sideAt(L.pathPts, 128, -3.0); bt.position.set(bp.x, 0, bp.z); L.add(bt); L.refs.bent = new THREE.Vector3(bp.x, 1.2, bp.z)
  // road dressing
  streetLight(L, 6, 342, false); const sbd = signboard('Mukti Dham · 2 km', '#1c3a6a', '#f4f0e0', 2.4, 0.9); sbd.position.set(-12, 0, 341); sbd.rotation.y = Math.PI; L.add(sbd)
  L.spawn = { x: 0, z: -6, yaw: 0 }
  L.surface = (x, z) => (z > 341 ? 'road' : 'mud')
  nightTick(L, G, { owl: 0.4, dog: 0.4, jackal: 0.4 })
  L.setDawn = () => G.env.set('predawn')
  return L
}
