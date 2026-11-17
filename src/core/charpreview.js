// Small standalone 3D preview for the character-select screen.
// Uses the same rig the game uses, so what you see is what you play.
import * as THREE from 'three'
import { humanFromOutfit } from '../world/humanRig.js'

export const charPreview = {
  renderer: null, rigs: {}, current: 'Nishan', t: 0,

  init(canvas) {
    if (!canvas || this.renderer) return
    try { this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }) }
    catch (e) { console.warn('Character preview unavailable:', e.message); return }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
    this.camera.position.set(0, 1.35, 3.05)
    this.camera.lookAt(0, 1.0, 0)
    this.scene.add(new THREE.HemisphereLight(0xc8d8ee, 0x2a2015, 1.25))
    const key = new THREE.DirectionalLight(0xffe3b0, 2.3); key.position.set(2.2, 4, 3); this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x86add8, 1.1); rim.position.set(-3, 2.4, -2.5); this.scene.add(rim)
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 40),
      new THREE.MeshStandardMaterial({ color: 0x14120e, roughness: 1, metalness: 0 })
    )
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; this.scene.add(floor)

    for (const name of ['Nishan', 'Nishant']) {
      const rig = humanFromOutfit(name.toLowerCase()) // OUTFITS keys are lowercase
      rig.setPose('stand')
      rig.root.visible = false
      this.scene.add(rig.root)
      this.rigs[name] = rig
    }
    this.select(this.current)
    this._resize()
    window.addEventListener('resize', () => this._resize())
    this._loop()
  },

  select(name) {
    this.current = name
    for (const k in this.rigs) this.rigs[k].root.visible = (k === name)
  },

  _resize() {
    if (!this.renderer) return
    const c = this.renderer.domElement
    const w = c.clientWidth || 340, h = c.clientHeight || 340
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  },

  _loop() {
    requestAnimationFrame(() => this._loop())
    const c = this.renderer && this.renderer.domElement
    if (!c || c.closest('.hidden')) return
    const rig = this.rigs[this.current]
    if (rig) {
      this.t += 0.016
      rig.update(0.016, 0)
      rig.root.rotation.y = Math.sin(this.t * 0.5) * 0.42
    }
    this.renderer.render(this.scene, this.camera)
  }
}
