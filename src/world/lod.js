// Distance-based level of detail for human rigs.
//   NEAR (2): full rig + fine detail + skeletal animation
//   MID  (1): skeleton animates, fine detail hidden
//   FAR  (0): 3-mesh static silhouette, no skeletal animation
// Updated at ~8 Hz (not every frame) with hysteresis so tiers don't flicker while
// walking across a threshold. Rigs that are in focus (speaking companion) stay near.
import * as THREE from 'three'

const NEAR = 26, MID = 72, HYST = 1.22
const _v = new THREE.Vector3()

export const lod = {
  items: [],
  enabled: true,
  focus: null,          // rig that must stay at full detail (e.g. the speaker)
  counts: [0, 0, 0],
  _t: 1,

  register(rig, o = {}) {
    if (!rig || !rig.lod) return rig
    if (o.min !== undefined) rig.lod.min = o.min
    if (o.max !== undefined) rig.lod.max = o.max
    if (o.forced !== undefined) rig.lod.forced = o.forced
    if (this.items.indexOf(rig) < 0) this.items.push(rig)
    return rig
  },

  unregister(rig) {
    const i = this.items.indexOf(rig)
    if (i >= 0) this.items.splice(i, 1)
  },

  clear() { this.items.length = 0; this.focus = null },

  update(camPos, playerPos, dt = 0.016) {
    if (!this.enabled) return
    this._t += dt
    if (this._t < 0.12) return // throttle: ~8 Hz is plenty for a moving camera
    this._t = 0
    const c = camPos || playerPos
    if (!c) return
    const counts = this.counts = [0, 0, 0]
    for (const rig of this.items) {
      if (!rig || !rig.root || !rig.root.visible) continue
      let level
      if (rig === this.focus || rig.lod.forced) level = rig.lod.max
      else {
        rig.root.getWorldPosition(_v)
        const d = Math.hypot(_v.x - c.x, _v.z - c.z)
        const cur = rig.lod.level
        // upgrade as soon as the camera gets closer; downgrade only past a margin
        level = d < NEAR ? 2 : d < MID ? 1 : 0
        if (level < cur) {
          const limit = cur === 2 ? NEAR * HYST : MID * HYST
          if (d < limit) level = cur
        }
      }
      rig.setLOD(level)
      counts[level]++
    }
  },

  // compact string for the on-screen debug overlay
  stats() { return `lod ${this.counts[2]}/${this.counts[1]}/${this.counts[0]}` }
}
