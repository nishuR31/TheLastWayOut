// Gather dry twigs, build a fire (T anywhere, or E at a stone fire-pit) and warm up next to it.
// Fire burns out faster in the open rain; a bamboo shelter or a tree keeps it alive. Warmth eases tiredness and fear.
import * as THREE from 'three'
import { tex } from '../world/textures.js'
import { audio } from './audio.js'
import { ui } from './ui.js'
import { clamp, damp, RNG } from './util.js'

const woodM = new THREE.MeshStandardMaterial({ color: '#3b2a1a', roughness: 1 })
const stoneM = new THREE.MeshStandardMaterial({ color: '#6f6c64', roughness: 1 })
const sprite = (color, size, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.scale.setScalar(size); return s }
// Smoke is not light — normal blending so it darkens rather than glows.
const smokeSprite = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow(), color: '#8d8a82', transparent: true, opacity: 0, depthWrite: false, fog: false })); s.scale.setScalar(0.6); return s }

export const fire = {
  G: null, fires: [], twigs: [], light: null, count: 0, warm: 0,
  init(G) { this.G = G; this.light = new THREE.PointLight('#ff9a46', 0, 17, 1.6); G.scene.add(this.light) },
  reset() { this.fires = []; this.twigs = [] },
  _twig(L, x, z, rnd) {
    const g = new THREE.Group()
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.45 + rnd.next() * 0.25, 5), woodM); m.rotation.z = Math.PI / 2; m.rotation.y = i * 0.9 + rnd.next(); m.position.y = 0.03 + i * 0.02; g.add(m) }
    g.position.set(x, 0, z); L.group.add(g); this.twigs.push({ x, z, g })
  },
  addPit(L, x, z, ring = true) {
    const g = new THREE.Group(); g.position.set(x, 0, z)
    for (let i = 0; ring && i < 8; i++) { const a = i / 8 * 6.283, s = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.2), stoneM); s.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55); s.rotation.y = a; g.add(s) }
    const logs = new THREE.Group(); for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 6), woodM); const a = i / 5 * 6.283; m.position.set(Math.cos(a) * 0.14, 0.26, Math.sin(a) * 0.14); m.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); logs.add(m) } g.add(logs)
    const flames = [sprite('#ff7a1c', 1.5, 0.9), sprite('#ffb23c', 0.95, 0.95), sprite('#fff0b0', 0.5, 1)]; flames.forEach((f, i) => { f.position.y = 0.38 + i * 0.16; f.visible = false; g.add(f) })
    const ember = sprite('#ff3a10', 0.9, 0.6); ember.position.y = 0.14; ember.visible = false; g.add(ember)
    const smoke = []
    for (let i = 0; i < 5; i++) { const s = smokeSprite(); s.visible = false; g.add(s); smoke.push(s) }
    L.group.add(g); L.walk.circle(x, z, 0.6)
    const f = { x, z, g, flames, ember, smoke, logs, state: 'unlit', fuel: 0, t: Math.random() * 9, cr: 0 }; this.fires.push(f); return f
  },
  populate(G, L) {
    this.reset(); const rnd = new RNG(((L.roam && L.roam.seed) || 9) * 13 + 5)
    const free = (x, z, r) => !L.walk.circles.some(c => Math.hypot(c.x - x, c.z - z) < c.r + r)
    const put = (cx, cz, rmin, rmax, n) => { for (let i = 0, k = 0; i < n * 12 && k < n; i++) { const a = rnd.next() * 6.283, d = rmin + rnd.next() * (rmax - rmin), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (free(x, z, 0.6)) { this._twig(L, x, z, rnd); k++ } } }
    if (L.refs && L.refs.firePit) { const p = L.refs.firePit; this.addPit(L, p.x, p.z); put(p.x, p.z, 3, 9, 6) }
    if (L.core && L.core.length && L.walk.free && !L.noTwigs) {
      for (let i = 0; i < 9; i++) { const pl = L.core[Math.floor(rnd.next() * L.core.length)], k = Math.floor(rnd.next() * pl.length), q = pl[k]; put(q.x, q.z, 3, 10, 1) }
    }
  },
  near(G) {
    const p = G.player, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); let best = null, bd = 1e9
    for (const f of this.fires) { const dx = f.x - p.pos.x, dz = f.z - p.pos.z, d = Math.hypot(dx, dz); if (d < 2.3 && d < bd) { bd = d; best = { kind: 'fire', f } } }
    if (best) return best
    for (const t of this.twigs) { const dx = t.x - p.pos.x, dz = t.z - p.pos.z, d = Math.hypot(dx, dz); if (d > 1.9 || ((dx * fx + dz * fz) / (d || 1) < 0.25 && d > 0.8)) continue; if (d < bd) { bd = d; best = { kind: 'twig', t } } }
    return best
  },
  label(G, a) {
    if (a.kind === 'twig') return `Sookhi lakdiyaan uthao · Pick up twigs (${this.count})`
    const f = a.f
    if (f.state === 'lit') return this.count > 0 ? 'Aag mein lakdi daalo · Feed the fire' : 'Aag ke paas garmi mil rahi hai · Warming up'
    return this.count >= 2 ? 'Aag jalao (2 lakdi) · Light the fire' : 'Aag jalane ke liye 2 sookhi lakdi chahiye · Need 2 twigs'
  },
  use(G, a) {
    if (a.kind === 'twig') { this.twigs.splice(this.twigs.indexOf(a.t), 1); a.t.g.visible = false; this.count++; audio.rustle({ x: a.t.x, y: 0.2, z: a.t.z }, 0.4); ui.toast(`Lakdi: ${this.count}`, 1.6); return }
    const f = a.f
    if (f.state === 'lit') { if (this.count > 0) { this.count--; f.fuel = Math.min(260, f.fuel + 45); audio.crackle({ x: f.x, y: 0.3, z: f.z }, 1.4); ui.toast('Aag tez ho gayi · The fire picks up', 2) } return }
    if (this.count < 2) { ui.reason('Aag jalane ke liye 2 sookhi lakdi chahiye — jungle se uthao (E)'); return }
    this.count -= 2; this._ignite(f)
  },
  _ignite(f) {
    const lit = this.fires.filter(x => x.state === 'lit'); if (lit.length >= 2) this._out(lit[0])
    f.state = 'lit'; f.fuel = 100; f.logs.visible = true; f.flames.forEach(s => { s.visible = true }); f.ember.visible = false
    audio.click(); audio.crackle({ x: f.x, y: 0.3, z: f.z }, 1.6); ui.toast('Nishant ne lighter se aag jalayi · Nishant lights it with his lighter', 3)
  },
  // scripted ignition (no toast); fuel in seconds
  lightNow(f, fuel = 160) { f.state = 'lit'; f.fuel = fuel; f.logs.visible = true; f.flames.forEach(s => { s.visible = true }); f.ember.visible = false; audio.click(); audio.crackle({ x: f.x, y: 0.3, z: f.z }, 1.6) },
  _out(f) { f.state = 'out'; f.fuel = 0; f.flames.forEach(s => { s.visible = false }); f.ember.visible = true; audio.fireOut && audio.fireOut({ x: f.x, y: 0.2, z: f.z }) },
  // T anywhere: stack 3 twigs in front of you and light them
  build(G) {
    const p = G.player, L = G.level
    if (!L) return
    if (p.mode === 'ride') { ui.reason('Bike chalate waqt aag nahi bana sakte — pehle utro (B)'); return }
    if (p.push) { ui.reason('Bike dhakelte waqt aag nahi bana sakte — pehle G se chhodo'); return }
    if (!p.canMove) { ui.reason('Abhi hille nahi pa rahe — scene khatam hone de'); return }
    if (G.pit) { ui.reason('Gaddhe mein aag nahi jal sakti — pehle bahar niklo'); return }
    if (G.noBuild) { ui.reason('Is jagah aag nahi bana sakte — andar ya baarish mein chirag nahi jalta'); return }
    if (this.count < 3) { ui.reason('Aag banane ke liye 3 sookhi lakdi chahiye — abhi ' + this.count + ' hain'); return }
    if (this.fires.some(f => Math.hypot(f.x - p.pos.x, f.z - p.pos.z) < 3)) { ui.reason('Yahan pehle se aag jal rahi hai — doosri nahi bana sakte'); return }
    const q = { x: p.pos.x + Math.sin(p.yaw) * 1.5, z: p.pos.z + Math.cos(p.yaw) * 1.5 }; L.walk.resolve(q, 0.6)
    this.count -= 3; const f = this.addPit(L, q.x, q.z); this._ignite(f)
  },
  update(G, dt) {
    const L = G.level, p = G.player; if (!L) return
    let warm = 0, near = null, nk = 0
    for (const f of this.fires) {
      f.t += dt
      const d = Math.hypot(f.x - p.pos.x, f.z - p.pos.z)
      if (f.state === 'lit') {
        const exposed = G.env.rainAmt > 0.3 && !(L.isIndoors && L.isIndoors(f.x, f.z) > 0.5)
        f.fuel -= dt * (exposed ? 3 : 1); if (f.fuel <= 0) { this._out(f); if (d < 20) ui.toast('Aag bujh gayi · The fire has died down', 2.5); continue }
        const k = clamp(f.fuel / 25, 0.3, 1), fl = 1 + 0.13 * Math.sin(f.t * 13) + 0.07 * Math.sin(f.t * 31)
        f.flames.forEach((s, i) => { s.scale.setScalar((1.5 - i * 0.5) * (0.55 + 0.45 * k) * fl * (exposed ? 0.75 : 1)); s.position.y = 0.34 + i * 0.16 * k + 0.03 * Math.sin(f.t * 17 + i); s.position.x = Math.sin(f.t * 5 + i * 2) * 0.035 + (f.lean || 0) * (0.15 + i * 0.12); s.position.z = (f.leanZ || 0) * (0.15 + i * 0.12) })
        f.smoke.forEach((s, i) => {
          const ph = (f.t * 0.22 + i / 5) % 1
          s.visible = true
          s.position.set(Math.sin(f.t * 0.8 + i * 2) * 0.12, 0.6 + ph * 1.7, Math.cos(f.t * 0.7 + i) * 0.1)
          s.scale.setScalar(0.5 + ph * 0.9)
          s.material.opacity = (1 - ph) * 0.16 * k * (exposed ? 0.5 : 1)
        })
        if (d < 22) { f.cr -= dt; if (f.cr <= 0) { f.cr = 0.15 + Math.random() * 0.6; audio.crackle({ x: f.x, y: 0.3, z: f.z }, 0.8) } }
        warm = Math.max(warm, clamp(1 - d / 5.5, 0, 1) * k)
        if (!near || d < near.d) near = { f, d, k, fl }
      } else if (f.state === 'out') { f.ember.material.opacity = 0.45 + 0.15 * Math.sin(f.t * 2); f.smoke.forEach(s => { s.visible = false }) }
    }
    this.warm = G.warm = damp(this.warm, warm, 2, dt)
    if (warm > 0.35 && !G._warmToast) { G._warmToast = true; ui.toast('Aag ki garmi mil rahi hai · The fire is warm', 3) }
    if (warm < 0.1) G._warmToast = false
    const lt = this.light
    if (near) { lt.position.set(near.f.x, 0.9, near.f.z); lt.intensity = damp(lt.intensity, 11 * near.k * near.fl, 10, dt) } else lt.intensity = damp(lt.intensity, 0, 6, dt)
  }
}
