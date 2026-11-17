import * as THREE from 'three'
import { tex } from './textures.js'
import { R } from '../core/util.js'

// A far-off village made of silhouettes, lit windows and lanterns. While you walk away from it, it quietly re-appears
// ahead of you (out of sight, then fading in): turn away, turn round, walk back: the same village again. No cut, no fade to black.
export function makeMirage(L, G) {
  const g = new THREE.Group(); g.visible = false; L.add(g)
  const dark = new THREE.MeshBasicMaterial({ color: '#16130f', transparent: true, opacity: 0 })
  const amber = new THREE.MeshBasicMaterial({ color: '#d9923a', transparent: true, opacity: 0, fog: false })
  const glowTex = tex.glow(), sprites = []
  const spots = [[-15, 0, 5.4, 4], [-7, 5, 4.8, 4], [5, 2, 5.6, 4.2], [14, -3, 5, 4], [0, -9, 5.2, 4], [-11, -10, 4.6, 3.8], [10, -12, 5, 4]]
  spots.forEach(([x, z, w, d], i) => {
    const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = (R.next() - 0.5) * 0.3; g.add(h)
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), dark); b.position.y = 1.3; h.add(b)
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.3, 1.5, 4), dark); r.position.y = 3.35; r.rotation.y = Math.PI / 4; h.add(r)
    for (const wx of [-w * 0.25, w * 0.25]) if (R.next() < 0.75) { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), amber); win.position.set(wx, 1.4, d / 2 + 0.02); h.add(win); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb25a', transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false })); sp.scale.setScalar(3.2); sp.position.set(wx, 1.4, d / 2 + 0.6); sp.renderOrder = 5; h.add(sp); sprites.push({ sp, base: 0.55, ph: R.range(0, 6) }) }
    if (i % 2 === 0) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff9a3c', transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false })); sp.scale.setScalar(5); sp.position.set(0.3, 1.9, d / 2 + 0.8); sp.renderOrder = 5; h.add(sp); sprites.push({ sp, base: 0.9, ph: R.range(0, 6) }) }
  })
  const m = { group: g, vis: 0, target: 0, auto: false, count: 0, travel: 0, behindT: 0, last: null }
  m.place = (x, z) => { const p = G.player.pos; g.position.set(x, 0, z); g.rotation.y = Math.atan2(p.x - x, p.z - z) }
  m.show = (v) => { m.target = v ? 1 : 0; if (v && !g.visible) { g.visible = true } }
  const flatDir = () => { const d = new THREE.Vector3(); G.camera.getWorldDirection(d); d.y = 0; return d.normalize() }
  m.placeAhead = (dist = 52, side = 0) => { const p = G.player.pos, d = flatDir(); m.place(p.x + d.x * dist - d.z * side, p.z + d.z * dist + d.x * side) }
  m.relocate = () => { m.placeAhead(52, R.range(-9, 9)); m.vis = 0; m.target = 1; m.count++; m.travel = 0; m.behindT = 0 }
  L.updaters.push((dt, t) => {
    m.vis += (m.target - m.vis) * Math.min(1, dt * 0.9); g.visible = m.vis > 0.02
    dark.opacity = m.vis; amber.opacity = m.vis
    for (const s of sprites) s.sp.material.opacity = s.base * m.vis * (0.8 + 0.2 * Math.sin(t * 9 + s.ph) + 0.08 * Math.sin(t * 23 + s.ph))
    const p = G.player.pos
    if (m.last) m.travel += Math.hypot(p.x - m.last.x, p.z - m.last.z); else m.last = { x: p.x, z: p.z }; m.last.x = p.x; m.last.z = p.z
    if (!m.auto || !g.visible || G.camOverride) return
    const dx = g.position.x - p.x, dz = g.position.z - p.z, dist = Math.hypot(dx, dz) || 1, dir = flatDir()
    const dot = (dx * dir.x + dz * dir.z) / dist
    m.behindT = (dot < -0.3 && dist > 20) ? m.behindT + dt : 0
    if (m.behindT > 1.0 && m.travel > 26) m.relocate()   // it is behind us: put it ahead again, unseen
  })
  return m
}

