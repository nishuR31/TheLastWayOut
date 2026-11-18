// Take/leave stations for the phone (table), key (wall hook) and helmets (rack).
// Every station is two-way: E takes the item if it is there, or puts it back if
// it is in your pocket. This means nothing can ever be permanently lost.
import * as THREE from 'three'
import { ui } from './ui.js'
import { audio } from './audio.js'
import { phone } from './phone.js'
import { makeKeyMesh } from '../world/viewmodel.js'

export const items = {
  tables: [], racks: [], placed: null,
  scan(G, L) {
    // A phone left on a table in the OLD level would be destroyed with that level's
    // group. Return it to the pocket instead of losing it entirely.
    const hadPlacedPhone = !!this.placed && !G.hasPhone
    this.tables = []; this.racks = []; this.placed = null
    L.group.updateMatrixWorld(true)
    L.group.traverse(o => {
      if (!o.userData) return
      const w = new THREE.Vector3(); o.getWorldPosition(w)
      if (o.userData.hook) {
        // Exactly one copy of the key must exist: on this hook, or in the pocket.
        // itemTaken is authoritative — once picked up, a level reload must never
        // silently hang it back on the hook.
        const taken = !!(G.itemTaken && G.itemTaken.key)
        const keyOn = !G.hasKey && !taken
        let km = o.userData.keyMesh
        if (!km) { km = makeKeyMesh(); km.position.set(0, 0, 0.06); o.add(km); o.userData.keyMesh = km }
        km.visible = keyOn
        this.tables.push({ x: w.x, z: w.z, y: w.y, r: 1.9, obj: o, hook: true, keyOn })
      }
      if (o.userData.helmetRack) {
        const taken = !!(G.itemTaken && G.itemTaken.helmet)
        ;(o.userData.helmets || []).forEach(h => { h.visible = !G.hasHelmet && !G.helmetOnBike && !taken })
        this.racks.push({ x: w.x, z: w.z, y: w.y, r: 2.0, obj: o, helmet: true })
      }
      if (o.userData.table) { const t = o.userData.table; this.tables.push({ x: w.x, z: w.z, y: w.y + t.h, r: Math.max(t.w, t.d) / 2 + 0.9, obj: o }) }
    })
    if (hadPlacedPhone) { G.hasPhone = true; ui.toast('Phone wapis jeb mein · Phone back in your pocket', 2.5) }
    this.reconcile(G)
  },
  // Self-heal any drift: an item must be in exactly one place — world or pocket.
  reconcile(G) {
    for (const h of this.tables) {
      if (!h.hook) continue
      let km = h.obj.userData.keyMesh
      if (!km) { km = makeKeyMesh(); km.position.set(0, 0, 0.06); h.obj.add(km); h.obj.userData.keyMesh = km }
      if (G.hasKey && h.keyOn) { h.keyOn = false; km.visible = false }
      else if (!G.hasKey && !h.keyOn) { h.keyOn = true; km.visible = true }
      else km.visible = h.keyOn
    }
    if (!G.hasHelmet && G.visorDown) {
      G.visorDown = false
      const v = document.getElementById('visor'); if (v) v.classList.remove('down')
    }
    const tookHelmet = !!(G.itemTaken && G.itemTaken.helmet)
    for (const r of this.racks) {
      const away = !!G.hasHelmet || !!G.helmetOnBike || tookHelmet
      ;(r.obj.userData.helmets || []).forEach(h => { h.visible = !away })
    }
    // Deliberately NO "self-heal" that flips hasPhone here: that ran every
    // frame and could hand the phone back (or re-stage it) behind the player's
    // back. scan() already returns a left-behind phone on level change.
  },
  all() { return [...this.tables, ...this.racks] },
  near(G) {
    const p = G.player, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); let best = null, bd = 1e9
    for (const t of this.all()) {
      const dx = t.x - p.pos.x, dz = t.z - p.pos.z, d = Math.hypot(dx, dz)
      if (d > t.r + 0.4) continue
      if ((dx * fx + dz * fz) / (d || 1) < 0.15 && d > 1.1) continue
      if (d < bd) { bd = d; best = t }
    }
    return best
  },
  // true when the station action would PUT an item back rather than take it.
  // Put-back needs Shift+E so a stray E can never silently empty your pocket.
  isReturn(G, t) {
    if (t.helmet) return !!G.hasHelmet
    if (t.hook) return !t.keyOn && !!G.hasKey
    if (this.placed && this.placed.table === t) return false
    return !!G.hasPhone && !this.placed
  },
  label(G, t) {
    const back = this.isReturn(G, t) ? ' · Shift+E' : ''
    if (t.helmet) return G.hasHelmet ? 'Helmet rack par rakh do · Put the helmets back' + back : 'Helmet utha lo · Take the helmets'
    if (t.hook) {
      if (t.keyOn) return 'Chabi utha lo (hook se) · Take the key off the hook'
      return G.hasKey ? 'Chabi hook par tang do · Hang the key back' + back : null
    }
    if (this.placed && this.placed.table === t) return 'Phone utha lo · Pick up the phone'
    if (G.hasPhone && !this.placed) return 'Phone mez par rakh do · Put the phone down' + back
    return null
  },
  _mesh(G, kind, t, i) {
    let m
    if (kind === 'phone') {
      m = new THREE.Group()
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.009, 0.158), new THREE.MeshStandardMaterial({ color: '#15181c', metalness: 0.4, roughness: 0.4 })); m.add(b)
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.148), new THREE.MeshBasicMaterial({ color: '#2a3a52' })); s.rotation.x = -Math.PI / 2; s.position.y = 0.0051; m.add(s)
    } else { m = makeKeyMesh(); m.scale.setScalar(1.6); m.rotation.x = 0 }
    m.position.set(t.x + (kind === 'phone' ? -0.12 : 0.12) * (i || 1), t.y + (kind === 'phone' ? 0.006 : 0.004), t.z + 0.04)
    m.rotation.y = kind === 'phone' ? 0.5 : -0.9
    G.level.group.add(m); return m
  },
  use(G, t) {
    if (t.helmet) {
      const hs = (t.obj.userData.helmets) || []
      if (!G.hasHelmet) {
        G.hasHelmet = true; G.itemTaken = G.itemTaken || {}; G.itemTaken.helmet = true; hs.forEach(h => { h.visible = false })
        audio.clang({ x: t.x, y: 1.4, z: t.z }, 0.5)
        ui.toast('Dono helmet le liye [ic:helmet] · Took both helmets', 2.6)
      } else {
        G.hasHelmet = false; G.itemTaken = G.itemTaken || {}; G.itemTaken.helmet = false; hs.forEach(h => { h.visible = true })
        audio.click(); ui.toast('Helmet rack par rakh diye · Helmets back on the rack', 2.6)
      }
      this.reconcile(G)
      return
    }
    if (t.hook) {
      let km = t.obj.userData.keyMesh
      if (!km) { // rebuild a lost key mesh so the hook always works
        km = makeKeyMesh(); km.position.set(0, 0, 0.06); t.obj.add(km); t.obj.userData.keyMesh = km
      }
      if (t.keyOn) {
        t.keyOn = false; km.visible = false; G.hasKey = true; G.itemTaken = G.itemTaken || {}; G.itemTaken.key = true; audio.click()
        ui.toast('Chabi jeb mein · Key in pocket', 2.2)
      } else if (G.hasKey) {
        t.keyOn = true; km.visible = true; G.hasKey = false; G.itemTaken = G.itemTaken || {}; G.itemTaken.key = false; audio.click()
        ui.toast('Chabi hook par tang gayi · Key hung on the hook', 2.2)
      }
      this.reconcile(G)
      return
    }
    if (this.placed && this.placed.table === t) {
      const pl = this.placed
      if (pl.phone) { G.level.group.remove(pl.phone); G.hasPhone = true; G.itemTaken = G.itemTaken || {}; G.itemTaken.phone = true }
      this.placed = null; audio.click(); ui.toast('Phone jeb mein · Phone in pocket', 2.5)
      this.reconcile(G)
      return
    }
    if (!G.hasPhone || this.placed) {
      if (this.placed) ui.reason('Ek phone pehle se hi doosri mez par hai — wahan se uthao')
      return
    }
    phone.close(); G.torchOn = false
    this.placed = { table: t, phone: this._mesh(G, 'phone', t), key: null }
    G.hasPhone = false; G.itemTaken = G.itemTaken || {}; G.itemTaken.phone = false; audio.click(); ui.toast('Phone table par rakh diya · Phone left on the table', 2.5)
    this.reconcile(G)
  },
  // story helper: the phone starts on the table nearest (x, z); the key hangs on the hook
  stageHome(G, x, z) {
    let best = null, bd = 1e9
    for (const t of this.tables) { if (t.hook) continue; const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t } }
    const took = G.itemTaken || {}
    // Only stage what the player has never picked up. Re-running Chapter 1 must
    // not teleport a carried phone/key back to the table/hook.
    if (best && !took.phone && !G.hasPhone) { this.placed = { table: best, phone: this._mesh(G, 'phone', best), key: null }; G.hasPhone = false }
    const hook = this.tables.find(t => t.hook)
    if (hook && hook.keyOn && !took.key) G.hasKey = false // only if the hook actually still holds it
    G._itemStaged = true
    this.reconcile(G)
    return !!best
  },
  // Idempotent safety net: only grants items the player has NEVER taken.
  // A taken item stays taken unless the player explicitly puts it back.
  giveAll(G) {
    G.itemTaken = G.itemTaken || {}
    if (!G.itemTaken.key) {
      for (const t of this.tables) {
        if (!t.hook) continue
        t.keyOn = false
        const km = t.obj.userData.keyMesh
        if (km) km.visible = false
      }
      G.hasKey = true
    }
    if (!G.itemTaken.phone) {
      if (this.placed) {
        if (this.placed.phone) G.level.group.remove(this.placed.phone)
        this.placed = null
      }
      G.hasPhone = true
    }
    if (!G.itemTaken.helmet) {
      G.helmetOnBike = false
      G.hasHelmet = true
      if (G.scooter && G.scooter.setHelmet) G.scooter.setHelmet(false)
    }
    G._itemStaged = true
    this.reconcile(G)
  },
  putOn(G, x, z) {
    let best = null, bd = 1e9
    for (const t of this.tables) { if (t.hook) continue; const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t } }
    if (!best) return false
    this.placed = { table: best, phone: this._mesh(G, 'phone', best), key: null }; G.hasPhone = false; G._itemStaged = true; this.reconcile(G); return true
  }
}
