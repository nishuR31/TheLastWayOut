// First-person hand viewmodel: phone (screen / flashlight) and the scooter key.
// The hand lives on the camera. Poses are damped; the key sequences are keyframed.
import * as THREE from 'three'
import { phone } from '../core/phone.js'
import { damp } from '../core/util.js'

const SKIN = '#9a6544', SLEEVE = '#27424a'
const smooth = (t) => t * t * (3 - 2 * t)
const mat = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: new THREE.Color(c).multiplyScalar(0.3), depthTest: false, ...o }); return m }

export function makeKeyMesh() {
  const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.9, roughness: 0.3, emissive: '#303236' })
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.036), steel); blade.position.z = -0.018; g.add(blade)
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.016), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6, emissive: '#111' })); bow.position.z = 0.008; g.add(bow)
  return g
}

// keyframes: [t, px,py,pz, rx,ry,rz, keyInHand(1/0)]
const POCKET = [0.34, -0.9, -0.12, 0.4, 0, 0.5]
const KEY_START = [
  [0, ...POCKET, 1], [0.5, 0.2, -0.33, -0.36, -0.1, 0.1, 0.2, 1], [1.0, 0.03, -0.47, -0.5, -0.3, 0, 0, 1],
  [1.25, 0.03, -0.47, -0.57, -0.3, 0, 0, 1], [1.6, 0.03, -0.47, -0.57, -0.3, 0, -1.1, 1], [1.7, 0.03, -0.47, -0.57, -0.3, 0, -1.1, 0],
  [2.3, ...POCKET, 0]
]
const KEY_STOP = [
  [0, ...POCKET, 0], [0.55, 0.12, -0.38, -0.45, -0.3, 0, -1.1, 0], [0.7, 0.03, -0.47, -0.57, -0.3, 0, -1.1, 0],
  [0.75, 0.03, -0.47, -0.57, -0.3, 0, -1.1, 1], [1.1, 0.03, -0.47, -0.57, -0.3, 0, 0, 1], [1.4, 0.03, -0.46, -0.4, -0.3, 0, 0, 1],
  [2.0, ...POCKET, 1]
]
const POSES = { pocket: POCKET, phone: [0.09, -0.22, -0.42, 0.1, -0.12, 0.02], torch: [0.26, -0.3, -0.5, -0.45, -0.18, 0] }

export const vm = {
  G: null, root: null, hand: null, phoneM: null, keyM: null, lens: null, anim: null, mode: 'pocket', t: 0,
  init(G) {
    this.G = G
    const root = this.root = new THREE.Group(); root.visible = false; G.camera.add(root)
    const hand = this.hand = new THREE.Group(); root.add(hand)
    // forearm runs back toward the lower-right corner of the screen
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.55, 8), mat(SKIN)); arm.rotation.set(Math.PI / 2 - 0.5, 0, 0.35); arm.position.set(0.1, -0.12, 0.28); hand.add(arm)
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.34, 8), mat(SLEEVE)); sleeve.rotation.copy(arm.rotation); sleeve.position.set(0.15, -0.2, 0.52); hand.add(sleeve)
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(SKIN)); palm.scale.set(1, 0.7, 1.15); hand.add(palm)
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.045, 2, 6), mat(SKIN)); thumb.position.set(-0.04, 0.02, -0.01); thumb.rotation.z = 0.6; hand.add(thumb)
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.04, 2, 6), mat(SKIN)); f.position.set(0.045, 0.012 - i * 0.002, -0.025 + i * 0.022); f.rotation.z = -0.5; hand.add(f) }
    // phone: screen towards the player (+z), camera lens on the back (-z)
    const ph = this.phoneM = new THREE.Group(); ph.position.set(0, 0.08, -0.01); hand.add(ph)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.158, 0.009), mat('#15181c', { metalness: 0.4 })); ph.add(body)
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.148), new THREE.MeshBasicMaterial({ color: '#7fa6d6', depthTest: false })); scr.position.z = 0.0047; ph.add(scr)
    const lens = this.lens = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), new THREE.MeshBasicMaterial({ color: '#fff6d0', depthTest: false })); lens.position.set(-0.02, 0.06, -0.0047); lens.rotation.y = Math.PI; ph.add(lens)
    const key = this.keyM = makeKeyMesh(); key.position.set(0, 0.0, -0.05); key.visible = false; hand.add(key)
    root.traverse(o => { if (o.isMesh) o.renderOrder = 999 })
    this.pos = new THREE.Vector3(...POCKET.slice(0, 3)); this.rot = new THREE.Vector3(...POCKET.slice(3))
  },
  reset() { this.anim = null; if (this.G) this.G.keyBusy = false; if (this.keyM) this.keyM.visible = false },
  _play(frames, sc, onEvent) {
    return new Promise(res => { this.anim = { frames, t: 0, sc, res, onEvent, fired: new Set() } })
  },
  // take the key out, push it in, twist (engine starts), leave it in the ignition
  keyStart(sc, onTwist) {
    if (this.anim) { this.anim.res() }
    return this._play(KEY_START, sc, (ev) => { if (ev === 'twist') onTwist && onTwist() })
  },
  keyStop(sc, onTwist) {
    if (this.anim) { this.anim.res() }
    if (sc && sc.keyFix) sc.keyFix.visible = true
    return this._play(KEY_STOP, sc, (ev) => { if (ev === 'twist') onTwist && onTwist() })
  },
  _sample(fr, t) {
    if (t <= fr[0][0]) return fr[0]
    for (let i = 1; i < fr.length; i++) {
      if (t <= fr[i][0]) { const a = fr[i - 1], b = fr[i], k = smooth((t - a[0]) / (b[0] - a[0])); return a.map((v, j) => (j === 0 ? t : j === 7 ? a[7] : v + (b[j] - v) * k)) }
    }
    return fr[fr.length - 1]
  },
  update(dt) {
    const G = this.G, root = this.root; if (!root) return
    const hidden = G.tpp || G.camOverride
    let want = phone.open ? 'phone' : (G.torchActive() ? 'torch' : 'pocket')
    if (this.anim) {
      const A = this.anim; A.t += dt
      const s = this._sample(A.frames, A.t)
      this.pos.set(s[1], s[2], s[3]); this.rot.set(s[4], s[5], s[6])
      this.phoneM.visible = false; this.keyM.visible = s[7] === 1
      const fix = A.sc && A.sc.keyFix
      if (A.frames === KEY_START) {
        if (A.t >= 1.25 && fix) { fix.visible = true; fix.userData.inner.rotation.z = A.t >= 1.6 ? 1.1 : Math.min(1.1, Math.max(0, (A.t - 1.25) / 0.35 * 1.1)) }
        if (A.t >= 1.5 && !A.fired.has('twist')) { A.fired.add('twist'); A.onEvent && A.onEvent('twist') }
      } else {
        if (fix) { fix.visible = A.t < 0.75 || false; if (A.t < 0.75) fix.userData.inner.rotation.z = 1.1 }
        if (A.t >= 0.75 && A.t < 1.1 && fix) { fix.visible = false }
        if (A.t >= 0.7 && !A.fired.has('twist')) { A.fired.add('twist'); A.onEvent && A.onEvent('twist') }
      }
      const end = A.frames[A.frames.length - 1][0]
      if (A.t >= end) { this.anim = null; if (A.frames === KEY_STOP && A.sc && A.sc.keyFix) A.sc.keyFix.visible = false; A.res() }
      root.visible = !hidden; this._apply(); return
    }
    this.keyM.visible = false; this.phoneM.visible = true
    const T = POSES[want]
    this.pos.x = damp(this.pos.x, T[0], 8, dt); this.pos.y = damp(this.pos.y, T[1], want === 'pocket' ? 7 : 5.5, dt); this.pos.z = damp(this.pos.z, T[2], 8, dt)
    this.rot.x = damp(this.rot.x, T[3], 8, dt); this.rot.y = damp(this.rot.y, T[4], 8, dt); this.rot.z = damp(this.rot.z, T[5], 8, dt)
    this.lens.visible = !!G.torchActive()
    root.visible = !hidden && (want !== 'pocket' || this.pos.y > -0.8)
    this._apply()
  },
  _apply() {
    this.hand.position.copy(this.pos); this.hand.rotation.set(this.rot.x, this.rot.y, this.rot.z)
    // slight idle sway so the hand feels alive
    const t = performance.now() * 0.001; this.hand.position.y += Math.sin(t * 1.6) * 0.003; this.hand.position.x += Math.cos(t * 1.1) * 0.002
  }
}
