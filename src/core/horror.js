// Horror director: atmospheric dread, peripheral apparitions, ambient beats and
// restrained jump scares. Self-driving from the current level + G.fear, with a
// few explicit hooks (`horror.scare`, `horror.apparition`, `horror.kick`) available
// to story beats. All effects degrade gracefully with no AudioContext / WebGL.
import * as THREE from 'three'
import { audio } from './audio.js'
import { clamp, R } from './util.js'
import { ghost, floatGhost } from '../world/variety.js'

const BASE = {
  home: 0, road: 0, camp: 0.04, forest: 0.16, night: 0.24, bamboo: 0.42,
  village: 0.46, escort: 0.58, shamshan: 0.72, exit: 0.5, tea: 0.04,
  hospital: 0.1, mirage: 0.34
}
const _dir = new THREE.Vector3(), _fwd = new THREE.Vector3()

class Horror {
  constructor() {
    this.value = 0
    this.target = 0
    this.level = null
    this.t = 0
    this.kickV = 0
    this.beatT = 8
    this.scareT = 26
    this.events = []
    this.figures = []
    this.root = null
    this.dreadEl = null
    this.flashEl = null
    this.flashTimer = null
    this.silenceTimer = null
  }

  init(G) {
    if (this.root) return
    this.G = G
    this.root = new THREE.Group()
    G.scene.add(this.root)
    for (let i = 0; i < 4; i++) this.figures.push(this.makeFigure())
    this.dreadEl = document.getElementById('dread')
    this.flashEl = document.getElementById('scare-flash')
  }

  makeFigure() {
    const g = ghost()
    const mats = []
    g.traverse(o => { if (o.material && o.material.transparent) mats.push(o.material) })
    // a digging tool silhouette for the tall figure
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.05), new THREE.MeshBasicMaterial({ color: 0x05070a, transparent: true, opacity: 0, depthWrite: false }))
    tool.position.set(0.36, 1.3, 0); tool.rotation.z = 0.22; g.add(tool); mats.push(tool.material)
    g.visible = false
    this.root.add(g)
    return { group: g, mats, life: 0, fade: 0, kind: 'shadow' }
  }

  apparition(kind = 'shadow', opts = {}) {
    if (!this.G || !this.figures.length) return null
    const f = this.figures.find(x => x.life <= 0) || this.figures[0]
    const p = this.G.player.pos, yaw = this.G.player.yaw
    const dist = opts.dist ?? R.range(9, 16)
    const side = opts.angle ?? (Math.random() < 0.5 ? -1 : 1) * R.range(0.9, 1.8)
    const a = yaw + side
    f.group.position.set(p.x + Math.sin(a) * dist, 0, p.z + Math.cos(a) * dist)
    f.group.rotation.y = a + Math.PI
    f.group.scale.set(kind === 'tall' ? 1.25 : 1, kind === 'tall' ? 1.55 : kind === 'crawler' ? 0.55 : 1, 1)
    f.life = opts.life ?? (kind === 'tall' ? 8 : R.range(3.5, 7))
    f.fade = 0
    f.kind = kind
    f.group.visible = true
    if (this.onEvent) this.onEvent('apparition-' + kind, f.group.position)
    return f
  }

  kick(v = 0.3) { this.kickV = clamp(this.kickV + v, 0, 1) }

  onLevel(name) {
    this.events = []
    // Let the UI breathe with the story: each location gets its own light and
    // colour language (firelight at the camp, cold dread in the forest, ash at
    // the shamshan). CSS reads body[data-scene].
    if (typeof document !== 'undefined') document.body.dataset.scene = name || ''
    this.beatT = R.range(6, 11)
    this.scareT = R.range(22, 36)
    const at = (s, fn) => this.events.push({ at: this.t + s, fn })
    if (name === 'camp') {
      at(14, () => this.apparition('shadow', { dist: 17 }))
      at(38, () => { audio.rustle(null, 0.6); this.kick(0.12) })
    } else if (name === 'night') {
      at(9, () => this.apparition('shadow', { dist: 13 }))
      at(24, () => { audio.payal(null, 1); this.kick(0.15) })
    } else if (name === 'bamboo') {
      at(7, () => audio.closeBreath(0.7))
      at(16, () => this.apparition('crawler', { dist: 11 }))
      at(30, () => { this.kick(0.22); audio.drone(3) })
    } else if (name === 'village') {
      at(6, () => this.apparition('eyes', { dist: 13, life: 5 }))
      at(18, () => { audio.whisper(null, 6); this.kick(0.15) })
      at(34, () => this.apparition('shadow', { dist: 15 }))
    } else if (name === 'escort') {
      at(10, () => { audio.rustle(null, 0.9); this.kick(0.14) })
      at(26, () => this.apparition('shadow', { dist: 12 }))
    } else if (name === 'shamshan') {
      at(5, () => { audio.drone(4, 0.18); this.kick(0.25) })
      at(13, () => this.apparition('tall', { dist: 18, life: 9 }))
      at(28, () => this.scare('sting', 0.8))
    } else if (name === 'exit') {
      at(12, () => this.apparition('shadow', { dist: 16 }))
    }
  }

  ambientBeat(G) {
    const r = Math.random()
    const p = G.player.pos
    const at = (dx, dz) => ({ x: p.x + dx, y: 1, z: p.z + dz })
    if (r < 0.12) audio.whisper(null, R.int(3, 7))
    else if (r < 0.22) audio.rustle(null, 0.7)
    else if (r < 0.32) audio.leaves(at(R.range(-9, 9), R.range(-9, 9)), 0.6)
    else if (r < 0.4) audio.knock(null, R.int(1, 3), 0.5)
    else if (r < 0.47) audio.crack(null, 0.6)
    else if (r < 0.54) audio.payal(null, 1)
    else if (r < 0.61) audio.howl(null)
    else if (r < 0.68) audio.eyeShimmer(at(R.range(-12, 12), R.range(-12, 12)))
    else if (r < 0.75) audio.shadowWhoosh(at(R.range(-8, 8), R.range(-8, 8)))
    else if (r < 0.81) audio.cloth(at(R.range(-5, 5), R.range(-5, 5)))
    else if (r < 0.87) audio.figureMoan(at(R.range(-16, 16), R.range(-16, 16)))
    else if (r < 0.92) audio.echoCall(at(R.range(-10, 10), R.range(-10, 10)))
    else if (r < 0.96) audio.diyaChime(at(R.range(-6, 6), R.range(-6, 6)))
    else audio.drone(2, 0.1)
    // Give the hearer a direction to turn toward: an off-axis point in the dark.
    const ang = r * Math.PI * 2
    if (this.onEvent) this.onEvent('ambient', { x: p.x + Math.cos(ang) * 8, y: 1.3, z: p.z + Math.sin(ang) * 8 })
  }

  flash(white = false, ms = 90) {
    if (!this.flashEl) return
    clearTimeout(this.flashTimer)
    this.flashEl.classList.toggle('white', white)
    this.flashEl.style.opacity = white ? '0.92' : '1'
    this.flashTimer = setTimeout(() => { this.flashEl.style.opacity = '0' }, ms)
  }

  scare(kind = 'sting', intensity = 1) {
    if (!this.G) return
    if (this.onEvent) this.onEvent('scare-' + kind, null)
    const G = this.G
    if (kind === 'silence') {
      audio.silence(true); audio.drone(2.4, 0.2)
      clearTimeout(this.silenceTimer)
      this.silenceTimer = setTimeout(() => audio.silence(false), 2200)
      this.kick(0.3)
      return
    }
    if (kind === 'creature') {
      this.apparition('tall', { dist: 7, life: 2.5, angle: 0.25 })
      audio.figureMoan(G.player.pos); audio.sting(intensity); this.flash(false, 70)
      G.camShake(1.6); audio.tinnitus(3000, 1.6, 0.14)
      this.kick(0.5)
      return
    }
    // default: hard sting, black flash, camera jolt, a shape almost on top of the player
    audio.sting(intensity); audio.shadowWhoosh(G.player.pos); audio.cloth(G.player.pos)
    this.flash(false, 80)
    G.camShake(1.2 + intensity)
    this.apparition('shadow', { dist: R.range(5, 8), life: 1.8, angle: R.range(0.2, 0.6) })
    setTimeout(() => audio.tinnitus(R.range(2400, 3600), 1.3, 0.12), 180)
    this.kick(0.45)
  }

  fovFactor() { return 1 - clamp(this.value, 0, 1) * 0.075 }

  updateFigures(dt, G) {
    if (!this.figures.length || !G.camera) return
    const cam = G.camera
    cam.getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize()
    for (const f of this.figures) {
      if (f.life <= 0) { f.group.visible = false; continue }
      f.life -= dt
      _dir.subVectors(f.group.position, cam.position); _dir.y = 0
      const dist = _dir.length()
      _dir.normalize()
      const ang = Math.acos(clamp(_fwd.dot(_dir), -1, 1))
      let want = 0
      if (dist < 28 && ang > 0.42 && ang < 2.25) {
        want = clamp((ang - 0.42) / 0.45, 0, 1) * clamp((28 - dist) / 9, 0, 1)
      }
      if (f.kind === 'eyes') want = dist < 20 && ang > 0.3 && ang < 2.6 ? 0.95 * clamp((20 - dist) / 6, 0, 1) : 0
      f.fade += (want - f.fade) * (1 - Math.exp(-dt * (want > f.fade ? 8 : 2.6)))
      for (const m of f.mats) m.opacity = f.fade * (m.color && m.color.getHex() === 0xeaf6ff ? 1 : 0.7)
      floatGhost(f.group, dt)
      f.group.visible = f.fade > 0.02 && f.life > 0
    }
  }

  update(dt, G) {
    if (!G || !G.level) return
    this.t += dt
    const name = G.level.name || ''
    if (name !== this.level) { this.level = name; this.onLevel(name) }

    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.t >= this.events[i].at) { const e = this.events[i]; this.events.splice(i, 1); try { e.fn() } catch (err) {} }
    }

    const base = BASE[name] ?? 0.1
    this.target = clamp(base + (G.fear || 0) * 0.5 + (G.fearT || 0) * 0.22 + this.kickV, 0, 1)
    this.kickV = Math.max(0, this.kickV - dt * 0.32)
    this.value += (this.target - this.value) * (1 - Math.exp(-dt * 1.3))

    if (this.dreadEl) this.dreadEl.style.opacity = (this.value * 0.82).toFixed(3)
    // Publish the director's tension to CSS at 2-decimal granularity (max ~100
    // writes over a full ramp) so the HUD itself can show the story's dread.
    if (typeof document !== 'undefined') {
      const dv = this.value.toFixed(2)
      if (dv !== this._cssDread) { this._cssDread = dv; document.documentElement.style.setProperty('--dread', dv) }
    }
    if (audio.setTension) audio.setTension(this.value)
    audio.st.breathRate = 0.25 + this.value * 1.05
    audio.st.breathDepth = 0.2 + this.value * 0.85

    this.beatT -= dt
    if (this.beatT <= 0) { this.beatT = R.range(10, 22) * (1 - this.value * 0.5); if (this.value > 0.16) this.ambientBeat(G) }
    this.scareT -= dt
    if (this.scareT <= 0 && this.value > 0.4) { this.scareT = R.range(30, 70); this.scare(Math.random() < 0.3 ? 'creature' : 'sting', 0.7) }

    this.updateFigures(dt, G)
  }

  reset() {
    this.value = 0; this.kickV = 0; this.level = null; this.events = []
    this.figures.forEach(f => { f.life = 0; f.group.visible = false })
    if (this.dreadEl) this.dreadEl.style.opacity = '0'
    if (typeof document !== 'undefined') { document.body.dataset.scene = ''; document.documentElement.style.setProperty('--dread', '0'); this._cssDread = '0' }
    audio.st.breathRate = 0.25; audio.st.breathDepth = 0.2
    if (audio.setTension) audio.setTension(0)
    audio.silence(false)
  }
}

export const horror = new Horror()
