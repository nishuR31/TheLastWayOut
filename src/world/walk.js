// Walkable areas: union of corridors (trails/roads), discs (clearings), rects (yards/rooms) + obstacle colliders.
import { nearestOnPoly } from '../core/util.js'

export class Walk {
  constructor() { this.corr = []; this.discs = []; this.rects = []; this.circles = []; this.boxes = []; this.free = false; this.bound = null; this.lastClamp = false }
  corridor(pts, hw, name = '') { pts = pts.map(p => (Array.isArray(p) ? { x: p[0], z: p[1] } : p)); const c = { pts, hw, name, off: false }; this.corr.push(c); return c }
  set(name, on) { for (const c of this.corr) if (c.name === name) c.off = !on; for (const c of this.discs) if (c.name === name) c.off = !on; for (const c of this.rects) if (c.name === name) c.off = !on }
  disc(x, z, r, name = '') { const d = { x, z, r, name, off: false }; this.discs.push(d); return d }
  rect(x0, z0, x1, z1, name = '') { const r = { name, off: false, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }; this.rects.push(r); return r }
  circle(x, z, r) { const c = { x, z, r }; this.circles.push(c); return c }
  box(x0, z0, x1, z1) { const b = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }; this.boxes.push(b); return b }
  // signed distance to the walkable union (negative = inside), plus the nearest allowed point
  query(x, z, rad = 0) {
    if (this.free) return { d: -1, x, z }
    let best = 1e9, bx = x, bz = z
    for (const c of this.corr) {
      if (c.off) continue
      const n = nearestOnPoly(c.pts, x, z), a = c.hw - rad, d = n.d - a
      if (d < best) { best = d; if (d > 0) { const k = a / (n.d || 1); bx = n.x + (x - n.x) * k; bz = n.z + (z - n.z) * k } else { bx = x; bz = z } }
    }
    for (const c of this.discs) {
      if (c.off) continue
      const dd = Math.hypot(x - c.x, z - c.z), a = c.r - rad, d = dd - a
      if (d < best) { best = d; if (d > 0) { const k = a / dd; bx = c.x + (x - c.x) * k; bz = c.z + (z - c.z) * k } else { bx = x; bz = z } }
    }
    for (const r of this.rects) {
      if (r.off) continue
      const cx = Math.min(Math.max(x, r.x0 + rad), r.x1 - rad), cz = Math.min(Math.max(z, r.z0 + rad), r.z1 - rad)
      const d = Math.hypot(x - cx, z - cz) - 0
      const dd = (cx === x && cz === z) ? -1 : d
      if (dd < best) { best = dd; bx = cx; bz = cz }
    }
    return { d: best, x: bx, z: bz }
  }
  dist(x, z) { return this.query(x, z, 0).d }
  resolve(p, rad = 0.35) {
    this.lastClamp = false
    if (this.bound) { const b = this.bound; if (p.x < b.x0 + rad) { p.x = b.x0 + rad; this.lastClamp = true } if (p.x > b.x1 - rad) { p.x = b.x1 - rad; this.lastClamp = true } if (p.z < b.z0 + rad) { p.z = b.z0 + rad; this.lastClamp = true } if (p.z > b.z1 - rad) { p.z = b.z1 - rad; this.lastClamp = true } }
    const q = this.query(p.x, p.z, rad)
    if (q.d > 0) { p.x = q.x; p.z = q.z }
    for (let it = 0; it < 2; it++) {
      for (const c of this.circles) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad; if (d < m) { const k = m / (d || 1e-4); p.x = c.x + (d ? dx * k : m); p.z = c.z + (d ? dz * k : 0) } }
      for (const b of this.boxes) {
        if (p.x > b.x0 - rad && p.x < b.x1 + rad && p.z > b.z0 - rad && p.z < b.z1 + rad) {
          const l = p.x - (b.x0 - rad), r = (b.x1 + rad) - p.x, t = p.z - (b.z0 - rad), bt = (b.z1 + rad) - p.z, m = Math.min(l, r, t, bt)
          if (m === l) p.x = b.x0 - rad; else if (m === r) p.x = b.x1 + rad; else if (m === t) p.z = b.z0 - rad; else p.z = b.z1 + rad
        }
      }
    }
    return p
  }
}
