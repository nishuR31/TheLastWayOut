// Chapter 5-6: dark forest trail -> peepal clearing -> the lantern light (seen again from the other side).
import * as THREE from 'three'
import { forestLevel, clearing, nightTick, farLight, shakyBush, makeSnake, ptAt, sideAt } from '../world/common.js'
import { makePeepal, makeRock, makeLog, makeSiris } from '../world/nature.js'
import { bush } from '../world/build.js'
import { R } from '../core/util.js'
import { makeMirage } from '../world/mirage.js'

export function build(G, opts = {}) {
  G.env.set(opts.env || 'rain', true)
  const walk = [[0, -10], [0, 28], [9, 60], [-6, 96], [-12, 130], [0, 160]]
  const toLight = [[0, 176], [-2, 200], [-6, 226]]
  const away = [[3, 162], [12, 140], [-28, 120], [-70, 150], [-74, 200], [-46, 242]]
  const village = [[-46, 242], [-40, 276], [-30, 312], [-22, 346]]
  const L = forestLevel(G, { name: 'night', trails: [{ pts: walk, hw: 1.5, name: 'walk' }, { pts: toLight, hw: 1.5, name: 'toLight' }, { pts: away, hw: 1.5, name: 'away' }, { pts: village, hw: 1.6, name: 'village' }], bounds: [-130, -30, 70, 380], density: 0.026, seed: 41, groundSize: [400, 520, -30, 170], avoid: [{ x: 0, z: 170, r: 12 }, { x: 0, z: -10, r: 4 }], groundColor: 0xb4bcae })
  const T = (n) => L.trails.find(t => t.name === n)
  L.walkPts = T('walk').pts; L.awayPts = T('away').pts; L.toLightPts = T('toLight').pts; L.villagePts = T('village').pts
  clearing(L, 0, 170, 8.5, 'peepalC', 'mud', 5)
  const pp = makePeepal(1.15); pp.position.set(-2, 0, 173); L.add(pp); L.walk.circle(-2, 173, 1.8); L.refs.peepal = new THREE.Vector3(-2, 1, 173)
  L.puddle(3, 166, 1.2); L.refs.firePit = { x: 5.2, z: 167.5 }
  // a siris tree with rattling pods near the path (the "payal")
  const sr = makeSiris(1.2); const sp = sideAt(L.walkPts, 34, 4.2); sr.position.set(sp.x, 0, sp.z); L.add(sr); L.refs.siris = new THREE.Vector3(sp.x, 4.6, sp.z); L.walk.circle(sp.x, sp.z, 0.5)
  // a bent tree that looks like a person standing still
  const bt = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ color: '#17140f', roughness: 1 })
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.75, 6), bm); c1.position.y = 0.87; bt.add(c1)
  const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bm); c2.position.y = 1.85; c2.scale.set(0.9, 1.2, 0.9); bt.add(c2)
  const c3 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 5), bm); c3.position.set(0.28, 1.2, 0); c3.rotation.z = -0.9; bt.add(c3)
  const bp = sideAt(L.walkPts, 112, -3.4); bt.position.set(bp.x, 0, bp.z); L.add(bt); L.walk.circle(bp.x, bp.z, 0.3); L.refs.bent = new THREE.Vector3(bp.x, 1.2, bp.z)
  // bush that shakes
  const sb = sideAt(L.walkPts, 78, 2.6); L.refs.bushPos = new THREE.Vector3(sb.x, 0.6, sb.z)
  L.shaky = shakyBush(L, bush, sb.x, sb.z, 1.5)
  // the light
  L.lightPos = new THREE.Vector3(-20, 2.2, 392)
  L.light = farLight(L, -20, 2.2, 392, 14)
  L.light.visible = !!opts.light
  L.light.visible = false
  L.mirage = makeMirage(L, G); L.mirage.place(L.lightPos.x, L.lightPos.z)
  L.setLight = (v) => { if (v) L.mirage.place(L.lightPos.x, L.lightPos.z); L.mirage.show(v) }
  if (opts.light) L.mirage.show(true)
  // the way back closes: a wall of trees and undisturbed mud (shown once the story calls sealBack)
  const seal = new THREE.Group(); seal.visible = false; L.add(seal)
  for (let i = -9; i <= 9; i++) { const b = bush(2.4); b.position.set(i * 3.4 + R.range(-0.6, 0.6), 0, -16 + R.range(-1, 1)); seal.add(b) }
  L.sealBack = () => { seal.visible = true; L.walk.box(-34, -18, 34, -14.5) }
  // a stump with a handprint pressed in the mud beside it (it shows up again, deeper)
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.7, 8), new THREE.MeshStandardMaterial({ color: '#3a2c1e', roughness: 1 })); stump.position.set(2.4, 0.35, 60); L.add(stump); L.walk.circle(2.4, 60, 0.5)
  const hand = new THREE.Mesh(new THREE.CircleGeometry(0.16, 8), new THREE.MeshBasicMaterial({ color: '#1a120a', transparent: true, opacity: 0.8 })); hand.rotation.x = -Math.PI / 2; hand.position.set(1.4, 0.03, 60.4); hand.scale.set(0.8, 1.1, 1); L.add(hand); L.refs.stumpPos = new THREE.Vector3(2.4, 0.5, 60)
  L.spawn = { x: 0, z: -6, yaw: 0 }
  L.surface = () => 'mud'
  nightTick(L, G, { owl: 0.6, dog: 0.3, jackal: 0.4 })
  return L
}
