// Phone + key can be left on any table and picked up again (E near a table).
import * as THREE from 'three'
import { ui } from './ui.js'
import { audio } from './audio.js'
import { phone } from './phone.js'
import { makeKeyMesh } from '../world/viewmodel.js'

export const items = {
  tables: [], placed: null,
  scan(G, L) {
    this.tables = []; this.placed = null; G.hasPhone = true; G.hasKey = true
    L.group.updateMatrixWorld(true)
    L.group.traverse(o => { if (o.userData && o.userData.hook) { const w = new THREE.Vector3(); o.getWorldPosition(w); this.tables.push({ x: w.x, z: w.z, y: w.y, r: 1.7, obj: o, hook: true, keyOn: true }) } })
    L.group.traverse(o => { if (o.userData && o.userData.table) { const w = new THREE.Vector3(), t = o.userData.table; o.getWorldPosition(w); this.tables.push({ x: w.x, z: w.z, y: w.y + t.h, r: Math.max(t.w, t.d) / 2 + 0.9, obj: o }) } })
  },
  near(G) {
    const p = G.player, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); let best = null, bd = 1e9
    for (const t of this.tables) { const dx = t.x - p.pos.x, dz = t.z - p.pos.z, d = Math.hypot(dx, dz); if (d > t.r + 0.4) continue; if ((dx * fx + dz * fz) / (d || 1) < 0.15 && d > 1.1) continue; if (d < bd) { bd = d; best = t } }
    return best
  },
  label(G, t) {
    if (t.hook) return t.keyOn ? 'Chabi utha lo (hook se) · Take the key off the hook' : null
    if (this.placed && this.placed.table === t) return 'Phone utha lo · Pick up the phone'
    return null
  },
  _mesh(G, kind, t, i) {
    let m
    if (kind === 'phone') { m = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.009, 0.158), new THREE.MeshStandardMaterial({ color: '#15181c', metalness: 0.4, roughness: 0.4 })); m.add(b); const s = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.148), new THREE.MeshBasicMaterial({ color: '#2a3a52' })); s.rotation.x = -Math.PI / 2; s.position.y = 0.0051; m.add(s) }
    else { m = makeKeyMesh(); m.scale.setScalar(1.6); m.rotation.x = 0 }
    m.position.set(t.x + (kind === 'phone' ? -0.12 : 0.12) * (i || 1), t.y + (kind === 'phone' ? 0.006 : 0.004), t.z + 0.04); m.rotation.y = kind === 'phone' ? 0.5 : -0.9
    G.level.group.add(m); return m
  },
  use(G, t) {
    if (t.hook) { const km = t.obj.userData.keyMesh; if (t.keyOn) { t.keyOn = false; km.visible = false; G.hasKey = true; audio.click(); ui.toast('Chabi jeb mein · Key in pocket', 2.2) } else if (G.hasKey) { t.keyOn = true; km.visible = true; G.hasKey = false; audio.click(); ui.toast('Chabi hook par tang gayi · Key hung on the hook', 2.2) } return }
    if (this.placed && this.placed.table === t) {
      const pl = this.placed; if (pl.phone) { G.level.group.remove(pl.phone); G.hasPhone = true }
      this.placed = null; audio.click(); ui.toast('Phone jeb mein · Phone in pocket', 2.5); return
    }
    if (!G.hasPhone) return
    if (this.placed) { ui.toast('Pehle wahan se utha lo · Pick up the other set first', 2); return }
    const pl = { table: t, phone: null, key: null }
    if (G.hasPhone) { phone.close(); G.torchOn = false; pl.phone = this._mesh(G, 'phone', t); G.hasPhone = false }
    this.placed = pl; audio.click(); ui.toast('Phone table par rakh diya · Phone left on the table', 2.5)
  },
  // story helper: the phone starts on the table nearest (x, z); the key hangs on the wall hook
  stageHome(G, x, z) {
    let best = null, bd = 1e9; for (const t of this.tables) { if (t.hook) continue; const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t } }
    if (best) { this.placed = { table: best, phone: this._mesh(G, 'phone', best), key: null }; G.hasPhone = false }
    G.hasKey = false   // the hook holds it (keyOn is already true)
    return !!best
  },
  giveAll(G) { for (const t of this.tables) if (t.hook && t.keyOn) this.use(G, t); if (this.placed && !G.hasPhone) this.use(G, this.placed.table) },
  // story helper: start with phone + key lying on the table nearest (x, z)
  putOn(G, x, z) {
    let best = null, bd = 1e9; for (const t of this.tables) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t } }
    if (!best) return false
    const pl = { table: best, phone: this._mesh(G, 'phone', best), key: null }; this.placed = pl; G.hasPhone = false; return true
  }
}
