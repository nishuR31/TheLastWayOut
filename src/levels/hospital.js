// Ending C: a small government-hospital ward, morning. Plain, quiet, believable.
import * as THREE from 'three'
import { Level, buildHouse, bed, table, chair, tubeLight, bx } from '../world/build.js'

export function build(G, opts = {}) {
  const L = new Level(G, 'hospital')
  G.env.set('homeDay', true)
  L.ground(120, 120, 'grass', 8, 0, 0)
  const ward = buildHouse(L, { x: 0, z: 0, w: 7, d: 6, h: 3.1, col: '#e4eae6', roof: 'flat', floor: 'tile', doorX: 0, doorW: 1.3, closedDoor: false, name: 'ward',
    windows: [{ side: 'n', x: -1.6, y: 1.4, w: 1.2, h: 1.1, color: '#cfe0ea' }, { side: 'n', x: 1.6, y: 1.4, w: 1.2, h: 1.1, color: '#cfe0ea' }] })
  L.house = ward
  // plain white ceiling under the default one
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), new THREE.MeshStandardMaterial({ color: '#f1f3f2', side: THREE.DoubleSide, roughness: 1 }))
  ce.rotation.x = Math.PI / 2; ce.position.copy(ward.local(0, 3.08, 0)); ce.rotation.y = 0; L.add(ce)
  ward.addLight(0, 2.7, 0, '#eef6ff', 14, 14)
  tubeLight(L, ward.group, -1.5, 3.04, 0); tubeLight(L, ward.group, 1.5, 3.04, 0)
  const b1 = ward.place(bed(), -1.4, -1.6, 0, Math.PI / 2), b2 = ward.place(bed(), 1.4, -1.6, 0, Math.PI / 2)
  ward.place(table(0.5, 0.45, 0.7), 0, -2.4, 0, 0)
  ward.place(chair(), 0.2, -0.4, 0, Math.PI)
  // saline stands
  for (const x of [-2.3, 0.5]) { const g = new THREE.Group(); bx(g, 0.03, 1.7, 0.03, new THREE.MeshStandardMaterial({ color: '#b9bec2', metalness: 0.8, roughness: 0.4 }), 0, 0, 0); bx(g, 0.1, 0.18, 0.04, new THREE.MeshStandardMaterial({ color: '#dfefe9', transparent: true, opacity: 0.8 }), 0, 1.45, 0); ward.place(g, x, -1.0, 0, 0) }
  // a muddy footprint just inside the door (Ending C aftertaste)
  const fp = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshBasicMaterial({ color: '#2a2018', transparent: true, opacity: 0.85 })); fp.scale.set(0.55, 1.2, 1)
  fp.rotation.x = -Math.PI / 2; fp.position.copy(ward.local(0.1, 0.03, 1.9)); fp.visible = false; L.add(fp); L.refs.footprint = fp
  L.refs.bed1 = ward.local(-1.4, 0.6, -1.6); L.refs.bed2 = ward.local(1.4, 0.6, -1.6)
  L.refs.door = ward.local(0, 0, 2.6); L.refs.inside = ward.local(0, 0, 1.2)
  L.spawn = { x: L.refs.bed1.x, z: L.refs.bed1.z, yaw: 0 }
  L.surface = () => 'tile'
  L.isIndoors = (x, z) => (ward.inside(x, z) ? 1 : 0)
  L.ambient = (S, p) => { S.room = 0.7; S.fan = 0.5; S.birds = 0.15; S.traffic = 0.2 }
  return L
}
