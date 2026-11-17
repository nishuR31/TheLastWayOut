// Navigation aid: minimap (heading-up), compass strip with waypoint, full map (north-up) and a walkable-grid A* router.
// World convention: forward at yaw 0 is +z = NORTH; the player's right at yaw 0 is -x = EAST.
const $ = (id) => document.getElementById(id)
const TAU = Math.PI * 2
const norm = (a) => { a %= 360; if (a > 180) a -= 360; if (a <= -180) a += 360; return a }
const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
let _wpv = null // lazy scratch vector for the per-frame waypoint projection
const TITLES = {
  home: 'Ghar aur gali · Home & street', road: 'Jungle ki sadak · The road', forest: 'Jungle · The forest', bamboo: 'Baans ka jhund · Bamboo grove',
  night: 'Raat ka jungle · Night forest', village: 'Gaon · The village', escort: 'Jungle ka raasta · Forest path', shamshan: 'Shamshan · Cremation ground',
  exit: 'Bahar ka raasta · The way out', tea: 'Chai ki dukaan · Tea stop'
}
const COL = { bg: '#12100d', road: '#6b6b68', trail: '#8a6f4a', disc: '#7a6644', rect: '#52483a', box: '#2b2620', boxLine: '#9b8c6c', route: '#f1c76a', goal: '#ffd36b', you: '#7fe0a8', comp: '#7fb4ff' }

function walkSig(w) { let s = ''; for (const c of w.corr) s += c.off ? 1 : 0; for (const c of w.discs) s += c.off ? 1 : 0; for (const r of w.rects) s += r.off ? 1 : 0; return s + ':' + w.boxes.length }
function levelBounds(L) {
  if (L._navB) return L._navB
  const w = L.walk; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9
  const add = (x, z, r = 0) => { x0 = Math.min(x0, x - r); z0 = Math.min(z0, z - r); x1 = Math.max(x1, x + r); z1 = Math.max(z1, z + r) }
  for (const c of w.corr) for (const p of c.pts) add(p.x, p.z, c.hw)
  for (const d of w.discs) add(d.x, d.z, d.r)
  for (const r of w.rects) { add(r.x0, r.z0); add(r.x1, r.z1) }
  if (x0 > x1) { x0 = -20; x1 = 20; z0 = -20; z1 = 20 }
  return (L._navB = { x0: x0 - 8, z0: z0 - 8, x1: x1 + 8, z1: z1 + 8 })
}
// ---------- walkable grid + A* ----------
class Grid {
  constructor(L, b, cs = 1.2) {
    this.cs = cs; this.x0 = b.x0; this.z0 = b.z0; this.W = Math.ceil((b.x1 - b.x0) / cs); this.H = Math.ceil((b.z1 - b.z0) / cs)
    this.ok = new Uint8Array(this.W * this.H); const w = L.walk
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
      const x = this.x0 + (i + 0.5) * cs, z = this.z0 + (j + 0.5) * cs
      if (w.query(x, z, 0.3).d > 0) continue
      let bad = false
      for (const c of w.circles) { const dx = x - c.x, dz = z - c.z, m = c.r + 0.35; if (dx * dx + dz * dz < m * m) { bad = true; break } }
      if (!bad) for (const q of w.boxes) { if (x > q.x0 - 0.35 && x < q.x1 + 0.35 && z > q.z0 - 0.35 && z < q.z1 + 0.35) { bad = true; break } }
      if (!bad) this.ok[j * this.W + i] = 1
    }
  }
  idx(x, z) { const i = Math.floor((x - this.x0) / this.cs), j = Math.floor((z - this.z0) / this.cs); return (i < 0 || j < 0 || i >= this.W || j >= this.H) ? -1 : j * this.W + i }
  nearest(x, z) { // nearest walkable cell (spiral)
    const c = this.idx(x, z); if (c < 0) return -1
    const ci = c % this.W, cj = (c / this.W) | 0
    for (let r = 0; r < 40; r++) {
      let best = -1, bd = 1e9
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue
        if (this.ok[j * this.W + i]) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = j * this.W + i } }
      }
      if (best >= 0) return best
    }
    return -1
  }
  path(sx, sz, gx, gz) {
    const s = this.nearest(sx, sz), g = this.nearest(gx, gz); if (s < 0 || g < 0) return null
    const N = this.W * this.H, W = this.W, gc = new Float32Array(N).fill(1e9), par = new Int32Array(N).fill(-1), closed = new Uint8Array(N)
    const gi = g % W, gj = (g / W) | 0
    const h = (n) => { const dx = Math.abs((n % W) - gi), dz = Math.abs(((n / W) | 0) - gj); return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz) }
    const heap = [[h(s), s]]; gc[s] = 0
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p } }
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (; ;) { let a = 2 * i + 1, b = a + 1, m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return t }
    let found = false, guard = 0
    while (heap.length && guard++ < 120000) {
      const [, n] = pop(); if (closed[n]) continue; closed[n] = 1
      if (n === g) { found = true; break }
      const ni = n % W, nj = (n / W) | 0
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const i = ni + di, j = nj + dj; if (i < 0 || j < 0 || i >= W || j >= this.H) continue
        const m = j * W + i; if (!this.ok[m] || closed[m]) continue
        if (di && dj && (!this.ok[nj * W + i] || !this.ok[j * W + ni])) continue
        const c = gc[n] + (di && dj ? 1.4142 : 1); if (c < gc[m]) { gc[m] = c; par[m] = n; push([c + h(m), m]) }
      }
    }
    if (!found) return null
    const out = []; for (let n = g; n >= 0; n = par[n]) out.push({ x: this.x0 + ((n % W) + 0.5) * this.cs, z: this.z0 + (((n / W) | 0) + 0.5) * this.cs })
    out.reverse()
    // light smoothing
    const sm = out.map((p, i) => { if (i === 0 || i === out.length - 1) return p; const a = out[i - 1], b = out[i + 1]; return { x: (a.x + p.x * 2 + b.x) / 4, z: (a.z + p.z * 2 + b.z) / 4 } })
    return sm
  }
}
function projAlong(pts, x, z) { // {d: distance along, off: lateral distance}
  let best = 1e9, bd = 0, acc = 0
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1].x, az = pts[i - 1].z, bx = pts[i].x, bz = pts[i].z, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6, l = Math.sqrt(l2)
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - (ax + dx * t), z - (az + dz * t))
    if (d < best) { best = d; bd = acc + l * t } acc += l
  }
  return { d: bd, off: best }
}
function sliceRoute(pts, d0, d1) {
  const out = []; let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.z - a.z)
    if (acc + l >= d0 && acc <= d1) {
      if (!out.length) { const k = Math.max(0, (d0 - acc) / (l || 1)); out.push({ x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }) }
      if (acc + l <= d1) out.push({ x: b.x, z: b.z }); else { const k = (d1 - acc) / (l || 1); out.push({ x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }); break }
    }
    acc += l
  }
  return out
}
const routeLen = (r) => { let l = 0; for (let i = 1; i < r.length; i++) l += Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z); return l }

export const nav = {
  G: null, mode: 'full', t: 0, mmT: 0, route: null, routeFor: null, routeT: 0, routeAt: null, grid: null, gridKey: '', gridSigT: 0, mmZoom: 40, fullK: 1,
  init(G) {
    this.G = G
    this.mm = $('minimap'); this.mctx = this.mm.getContext('2d')
    this.cc = $('compass-c'); this.cctx = this.cc.getContext('2d')
  },
  setMode(m) { this.mode = m; const h = $('hud'); h.classList.toggle('nav-compass', m === 'compass'); h.classList.toggle('nav-off', m === 'off') },
  pose() {
    const G = this.G, p = G.player, sc = G.scooter, riding = p.mode === 'ride' && sc
    return riding ? { x: sc.chassis.position.x, z: sc.chassis.position.z, yaw: sc.yaw, riding: true } : { x: p.pos.x, z: p.pos.z, yaw: p.yaw, riding: false }
  },
  gridFor(L) {
    const sig = walkSig(L.walk), key = L.name + sig
    if (this.gridKey !== key || this.gridL !== L) { this.grid = new Grid(L, levelBounds(L)); this.gridKey = key; this.gridL = L }
    return this.grid
  },
  // route from pose to goal (explicit goal.pts wins; otherwise grid A*)
  updateRoute(pose, goal, force) {
    const G = this.G, L = G.level
    if (!goal || !L) { this.route = null; this.routeFor = null; return }
    const moved = this.routeAt ? Math.hypot(pose.x - this.routeAt.x, pose.z - this.routeAt.z) : 1e9
    if (!force && this.routeFor === goal && moved < 2.5 && this.t - this.routeT < 3) return
    this.routeFor = goal; this.routeT = this.t; this.routeAt = { x: pose.x, z: pose.z }
    if (goal.pts) {
      const pr = projAlong(goal.pts, pose.x, pose.z), d1 = goal.d ?? 1e9
      if (pr.d >= d1 - 0.5) { this.route = [{ x: pose.x, z: pose.z }, { x: goal.x, z: goal.z }]; return }
      this.route = [{ x: pose.x, z: pose.z }, ...sliceRoute(goal.pts, pr.d, d1)]
      return
    }
    let r = null; try { r = this.gridFor(L).path(pose.x, pose.z, goal.x, goal.z) } catch (e) { r = null }
    this.route = r ? [{ x: pose.x, z: pose.z }, ...r, { x: goal.x, z: goal.z }] : [{ x: pose.x, z: pose.z }, { x: goal.x, z: goal.z }]
  },
  // point ~lookahead metres ahead along the route (what the compass should point at)
  lookAhead(pose, look = 10) {
    const r = this.route; if (!r || r.length < 2) return null
    let acc = 0
    for (let i = 1; i < r.length; i++) { const l = Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z); if (acc + l >= look) { const k = (look - acc) / (l || 1); return { x: r[i - 1].x + (r[i].x - r[i - 1].x) * k, z: r[i - 1].z + (r[i].z - r[i - 1].z) * k } } acc += l }
    return r[r.length - 1]
  },
  update(dt) {
    const G = this.G, L = G.level; if (!L) return
    this.t += dt
    const goal = G.goal, pose = this.pose(), ui = G.ui
    this.updateRoute(pose, goal)
    // objective text (explicit chapter objective wins, otherwise the active goal's label) + distance line
    const want = ui.objText || (goal && goal.label) || null
    if (want !== this._obj) { this._obj = want; const e = $('objective'); if (want) { $('objective-t').textContent = want; e.classList.add('show') } else e.classList.remove('show') }
    this.wp(pose, goal)
    this.stuckCheck(pose, goal, dt)
    this.mmT -= dt; if (this.mmT > 0) return; this.mmT = 0.05
    let info = null
    if (goal && this.route) {
      const la = this.lookAhead(pose, 9) || { x: goal.x, z: goal.z }
      const tb = Math.atan2(-(la.x - pose.x), la.z - pose.z) * 180 / Math.PI, hb = -pose.yaw * 180 / Math.PI
      info = { rel: norm(tb - hb), dist: routeLen(this.route), la }
      const e = $('objective-d'); e.textContent = `▸ ${Math.round(info.dist)} m · ${this.dirWord(info.rel)}`; e.style.opacity = want ? 1 : 0
    } else $('objective-d').style.opacity = 0
    this.info = info
    if (this.mode !== 'off') this.drawCompass(pose, info)
    if (this.mode === 'full') this.drawMini(pose, goal, info)
  },
  // on-screen waypoint diamond (projected from the 3D goal position)
  wp(pose, goal) {
    const G = this.G, el = $('wp'); if (!el) return
    if (!goal || this.mode === 'off' || G.paused || !G.camera) { el.style.opacity = 0; return }
    const cam = G.camera; cam.updateMatrixWorld()
    const v = (_wpv || (_wpv = new G.THREE.Vector3())).set(goal.x, (goal.y ?? 0) + 1.6, goal.z).project(cam)
    if (v.z > 1 || Math.abs(v.x) > 0.96 || Math.abs(v.y) > 0.92) { el.style.opacity = 0; return }
    el.style.left = ((v.x * 0.5 + 0.5) * innerWidth).toFixed(0) + 'px'; el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight).toFixed(0) + 'px'
    const d = Math.hypot(goal.x - pose.x, goal.z - pose.z); $('wp-d').textContent = Math.round(d) + ' m'
    el.style.opacity = d < 3.5 ? 0 : 0.95
  },
  // no progress for a long time -> gentle nudge toward the H key
  stuckCheck(pose, goal, dt) {
    if (!goal || this.G.paused) { this._sk = null; return }
    if (!this._sk || this._sk.goal !== goal) { this._sk = { goal, x: pose.x, z: pose.z, t: 0 }; return }
    const s = this._sk; s.t += dt
    if (Math.hypot(pose.x - s.x, pose.z - s.z) > 3) { s.x = pose.x; s.z = pose.z; s.t = 0; return }
    if (s.t > 18) { s.t = 0; this.G.ui.toast('Atak gaye? Sunhari nishaan ki taraf chalo — ya H dabao (do baar = aage le jayega) · Stuck? Press H (twice = hop ahead)', 6) }
  },
  // H: first press = hint, second press within 3 s = hop a few metres ahead along the route
  help() {
    const G = this.G, ui = G.ui, pose = this.pose(), g = G.goal
    if (!g) { ui.toast('Abhi koi khaas manzil nahi — kahani aage badhegi. · No waypoint right now.', 3); return }
    if (this._hT !== undefined && this.t - this._hT < 3 && this.t - this._hT > 0.35) { this._hT = undefined; return this.hop(pose, g) }
    this._hT = this.t
    const i = this.info
    ui.toast(`${g.label || 'Agla padaav'}  ·  ${i ? Math.round(i.dist) + ' m, ' + this.dirWord(i.rel) : ''}\n(H dobara = aage hop)`, 4.5)
  },
  hop(pose, g) {
    const G = this.G, p = G.player
    this.updateRoute(pose, g, true)
    const la = this.lookAhead(pose, 9); if (!la) return
    const yaw = Math.atan2(la.x - pose.x, la.z - pose.z)
    if (p.mode === 'ride' && G.scooter) { G.scooter.place(la.x, la.z, yaw); G.scooter.chassis.velocity.set(0, 0, 0) }
    else { G.teleportPlayer(la.x, la.z, yaw); if (G.scooter && p.push) { const c = G.scooter.chassis; c.position.set(la.x + Math.sin(yaw) * 1.05, 0.6, la.z + Math.cos(yaw) * 1.05); c.velocity.set(0, 0, 0) } }
    this.routeAt = null; G.ui.toast('Aage badh gaye · Hopped ahead', 1.8)
  },
  dirWord(rel) {
    const a = Math.abs(rel)
    if (a < 18) return 'seedha aage'
    if (a < 60) return rel > 0 ? 'thoda daayen' : 'thoda baayen'
    if (a < 125) return rel > 0 ? 'daayen mudo' : 'baayen mudo'
    return 'peeche mudo'
  },
  // ----- world drawing (transform already set; units = metres) -----
  layers(ctx, L, s, full) {
    const w = L.walk; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const px = 1 / s
    for (const d of w.discs) { if (d.off) continue; ctx.fillStyle = COL.disc; ctx.beginPath(); ctx.arc(d.x, d.z, d.r, 0, TAU); ctx.fill() }
    for (const c of w.corr) {
      if (c.off || c.noMap) continue
      ctx.strokeStyle = (c.name === 'road' || c.name === 'street') ? COL.road : COL.trail; ctx.lineWidth = Math.max(c.hw * 2, 3 * px)
      ctx.beginPath(); c.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)); ctx.stroke()
    }
    for (const r of w.rects) { if (r.off) continue; ctx.fillStyle = COL.rect; ctx.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0) }
    ctx.fillStyle = COL.box; ctx.strokeStyle = COL.boxLine; ctx.lineWidth = Math.max(1.2 * px, 0.15)
    for (const b of w.boxes) { const bw = b.x1 - b.x0, bh = b.z1 - b.z0; if (bw < 0.4 && bh < 0.4) continue; ctx.fillRect(b.x0, b.z0, bw, bh); ctx.strokeRect(b.x0, b.z0, bw, bh) }
  },
  routeDraw(ctx, s) {
    const r = this.route; if (!r || r.length < 2) return
    ctx.save(); ctx.strokeStyle = COL.route; ctx.lineWidth = Math.max(5 / s, 1.2); ctx.setLineDash([10 / s, 7 / s]); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.95
    ctx.beginPath(); r.forEach((p, i) => i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)); ctx.stroke(); ctx.restore()
  },
  actorsDraw(ctx, s, pose) {
    const G = this.G
    if (G.comp && !G.comp.attach && !G.comp.hidden) { ctx.fillStyle = COL.comp; ctx.strokeStyle = '#000'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.arc(G.comp.pos.x, G.comp.pos.z, 5 / s, 0, TAU); ctx.fill(); ctx.stroke() }
    const sc = G.scooter
    if (sc && !(G.player.mode === 'ride')) { const c = sc.chassis.position; ctx.fillStyle = '#d9d2c0'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1 / s; ctx.fillRect(c.x - 4 / s, c.z - 4 / s, 8 / s, 8 / s); ctx.strokeRect(c.x - 4 / s, c.z - 4 / s, 8 / s, 8 / s) }
  },
  goalDraw(ctx, s, goal) {
    if (!goal) return
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4), R = (9 + pulse * 5) / s
    ctx.save(); ctx.strokeStyle = COL.goal; ctx.fillStyle = COL.goal; ctx.lineWidth = 2 / s
    ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(goal.x, goal.z, R, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1
    const d = 7 / s; ctx.beginPath(); ctx.moveTo(goal.x, goal.z + d); ctx.lineTo(goal.x + d, goal.z); ctx.lineTo(goal.x, goal.z - d); ctx.lineTo(goal.x - d, goal.z); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore()
  },
  youDraw(ctx, s, pose, cone) {
    ctx.save(); ctx.translate(pose.x, pose.z)
    // forward = (sin yaw, cos yaw): canvas rotation maps +z(up in world) -> heading
    if (cone) { ctx.save(); ctx.rotate(0); const a = Math.atan2(pose.yaw === undefined ? 0 : Math.sin(pose.yaw), Math.cos(pose.yaw)); ctx.beginPath(); ctx.moveTo(0, 0); const R = 30 / s * 1.8, h = 0.62; ctx.lineTo(Math.sin(pose.yaw - h) * R, Math.cos(pose.yaw - h) * R); ctx.lineTo(Math.sin(pose.yaw + h) * R, Math.cos(pose.yaw + h) * R); ctx.closePath(); ctx.fillStyle = 'rgba(127,224,168,.18)'; ctx.fill(); ctx.restore() }
    const f = { x: Math.sin(pose.yaw), z: Math.cos(pose.yaw) }, r = { x: f.z, z: -f.x }, L = 9 / s, W = 5.5 / s
    ctx.beginPath(); ctx.moveTo(f.x * L, f.z * L); ctx.lineTo(-f.x * L * 0.7 + r.x * W, -f.z * L * 0.7 + r.z * W); ctx.lineTo(-f.x * L * 0.25, -f.z * L * 0.25); ctx.lineTo(-f.x * L * 0.7 - r.x * W, -f.z * L * 0.7 - r.z * W); ctx.closePath()
    ctx.fillStyle = COL.you; ctx.strokeStyle = '#041'; ctx.lineWidth = 1.6 / s; ctx.fill(); ctx.stroke(); ctx.restore()
  },
  // ----- minimap (heading-up) -----
  drawMini(pose, goal, info) {
    const G = this.G, L = G.level, c = this.mctx, W = this.mm.width, cx = W / 2, R = W / 2 - 3
    const target = pose.riding ? 105 : 36; this.mmZoom += (target - this.mmZoom) * 0.08
    const s = R / this.mmZoom, cs = Math.cos(pose.yaw), sn = Math.sin(pose.yaw)
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, W)
    c.save(); c.beginPath(); c.arc(cx, cx, R, 0, TAU); c.clip(); c.fillStyle = COL.bg; c.fillRect(0, 0, W, W)
    const a = -s * cs, b = -s * sn, cc = s * sn, d = -s * cs
    c.setTransform(a, b, cc, d, cx - a * pose.x - cc * pose.z, cx - b * pose.x - d * pose.z)
    this.layers(c, L, s, false); this.routeDraw(c, s); this.actorsDraw(c, s, pose); this.goalDraw(c, s, goal)
    // you: always up
    c.setTransform(1, 0, 0, 1, 0, 0); c.restore()
    c.save(); c.translate(cx, cx); c.fillStyle = COL.you; c.strokeStyle = '#041'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.lineTo(7.5, 8); c.lineTo(0, 4); c.lineTo(-7.5, 8); c.closePath(); c.fill(); c.stroke(); c.restore()
    // goal pointer on the rim (next waypoint along the route)
    if (info) { const ang = info.rel * Math.PI / 180; c.save(); c.translate(cx, cx); c.rotate(ang); c.fillStyle = COL.goal; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -R + 3); c.lineTo(9, -R + 19); c.lineTo(-9, -R + 19); c.closePath(); c.fill(); c.stroke(); c.restore() }
    // compass letters on rim (rotate with heading)
    c.save(); c.font = '700 15px Inter,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
    const dirs = [['N', 0, 1, '#ff6a5a'], ['E', -1, 0, '#e8e2d2'], ['S', 0, -1, '#e8e2d2'], ['W', 1, 0, '#e8e2d2']]
    for (const [t, dx, dz, col] of dirs) { const f = dx * sn + dz * cs, r = -dx * cs + dz * sn; const x = cx + r * (R - 11), y = cx - f * (R - 11); c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill(); c.fillStyle = col; c.fillText(t, x, y + 0.5) }
    c.restore()
  },
  // ----- compass strip -----
  drawCompass(pose, info) {
    const c = this.cctx, W = this.cc.width, H = this.cc.height, hb = norm(-pose.yaw * 180 / Math.PI), ppd = W / 180   // 180deg visible
    c.clearRect(0, 0, W, H); c.font = '700 22px Inter,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
    for (let a = -90; a <= 90; a += 5) {
      const brg = ((Math.round(hb / 5) * 5 + a) % 360 + 360) % 360, x = W / 2 + (brg - hb + (Math.abs(brg - hb) > 180 ? (brg > hb ? -360 : 360) : 0)) * ppd
      if (x < 6 || x > W - 6) continue
      const fade = 1 - Math.abs(x - W / 2) / (W / 2) * 0.75
      c.globalAlpha = fade
      if (brg % 45 === 0) { const t = CARD[brg / 45]; c.fillStyle = t === 'N' ? '#ff7a6a' : '#f2ecda'; c.fillText(t, x, 22) } else if (brg % 15 === 0) { c.fillStyle = '#cfc9b8'; c.fillRect(x - 1, 30, 2, 14) } else { c.fillStyle = '#8f8a7c'; c.fillRect(x - 0.5, 36, 1, 8) }
    }
    c.globalAlpha = 1
    c.fillStyle = '#7fe0a8'; c.beginPath(); c.moveTo(W / 2, H - 2); c.lineTo(W / 2 - 9, H - 16); c.lineTo(W / 2 + 9, H - 16); c.closePath(); c.fill()
    if (info) {
      let x = W / 2 + info.rel * ppd; const edge = Math.abs(info.rel) > 88; x = Math.max(16, Math.min(W - 16, x))
      c.fillStyle = COL.goal; c.strokeStyle = '#000'; c.lineWidth = 3
      c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 11, 24); c.lineTo(x, 40); c.lineTo(x - 11, 24); c.closePath(); c.stroke(); c.fill()
      if (edge) { c.fillStyle = '#000'; c.font = '700 16px sans-serif'; c.fillText(info.rel > 0 ? '▶' : '◀', x, 24) }
    }
    const el = $('compass-t'); el.textContent = info ? `${Math.round(info.dist)} m` : `${Math.round(((hb % 360) + 360) % 360)}°`
  },
  // ----- full map -----
  fullInfo() {
    const G = this.G, g = G.goal, p = this.pose(); if (!g) return 'Abhi koi khaas jagah nahi — bas aage badho. · No waypoint right now.'
    const i = this.info
    return `<b>${g.label || 'Agla padaav · Next stop'}</b><br>${i ? `${Math.round(i.dist)} m door · ${this.dirWord(i.rel)}` : ''}`
  },
  drawFull(canvas) {
    const G = this.G, L = G.level; if (!L) return
    const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height, pose = this.pose(), goal = G.goal
    this.updateRoute(pose, goal, true)
    const b = { ...levelBounds(L) }; if (goal) { b.x0 = Math.min(b.x0, goal.x - 6); b.x1 = Math.max(b.x1, goal.x + 6); b.z0 = Math.min(b.z0, goal.z - 6); b.z1 = Math.max(b.z1, goal.z + 6) }
    const bw = b.x1 - b.x0, bh = b.z1 - b.z0, pad = 34 * (W / 900)
    const fit = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh)
    const base = Math.max(fit, 1.4 * (W / 900)), s = base * this.fullK
    const follow = s > fit * 1.02
    const cx0 = follow ? pose.x : (b.x0 + b.x1) / 2, cz0 = follow ? pose.z : (b.z0 + b.z1) / 2
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0d0b09'; c.fillRect(0, 0, W, H)
    // faint grid
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1
    const step = 20 * s < 30 ? 100 : 20
    c.save()
    c.setTransform(-s, 0, 0, -s, W / 2 + s * cx0, H / 2 + s * cz0)
    c.lineWidth = 1 / s
    for (let x = Math.floor(b.x0 / step) * step; x <= b.x1; x += step) { c.beginPath(); c.moveTo(x, b.z0); c.lineTo(x, b.z1); c.stroke() }
    for (let z = Math.floor(b.z0 / step) * step; z <= b.z1; z += step) { c.beginPath(); c.moveTo(b.x0, z); c.lineTo(b.x1, z); c.stroke() }
    this.layers(c, L, s, true); this.routeDraw(c, s); this.actorsDraw(c, s, pose); this.goalDraw(c, s, goal); this.youDraw(c, s, pose, true)
    c.restore()
    // labels (screen space)
    const T = (x, z) => [W / 2 - s * (x - cx0), H / 2 - s * (z - cz0)]
    c.font = `600 ${Math.round(14 * W / 900)}px Inter,'Noto Sans Devanagari',sans-serif`; c.textAlign = 'center'
    const lab = (x, z, t, col, dy = -16) => { const [sx, sy] = T(x, z); c.lineWidth = 4; c.strokeStyle = '#000'; c.strokeText(t, sx, sy + dy); c.fillStyle = col; c.fillText(t, sx, sy + dy) }
    lab(pose.x, pose.z, 'Aap · You', COL.you, 22 * W / 900)
    if (goal) lab(goal.x, goal.z, goal.label ? goal.label.split(' · ')[0] : 'Yahan jao', COL.goal)
    if (G.comp && !G.comp.attach && !G.comp.hidden) lab(G.comp.pos.x, G.comp.pos.z, 'Nishant', COL.comp, -12)
    if (G.scooter && G.player.mode !== 'ride') { const q = G.scooter.chassis.position; lab(q.x, q.z, 'Scooter', '#d9d2c0', 20 * W / 900) }
    // north arrow + scale bar
    c.save(); c.translate(W - 46 * W / 900, 52 * W / 900); c.fillStyle = '#ff6a5a'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -24); c.lineTo(10, 8); c.lineTo(0, 2); c.lineTo(-10, 8); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = '700 15px Inter,sans-serif'; c.fillText('N', 0, 28); c.restore()
    let len = 10; for (const v of [10, 20, 50, 100, 200, 500]) { len = v; if (v * s > 90) break }
    c.fillStyle = '#e8e2d2'; c.fillRect(24, H - 28, len * s, 3); c.fillRect(24, H - 34, 2, 12); c.fillRect(24 + len * s - 2, H - 34, 2, 12); c.textAlign = 'left'; c.font = '600 13px Inter,sans-serif'; c.fillText(len + ' m', 30 + len * s, H - 22)
  },
  title() { const L = this.G.level; return L ? (TITLES[L.name] || L.name) : '' }
}
