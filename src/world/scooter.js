// Scooter: visual model + cannon-es RaycastVehicle (real suspension / friction / mass)
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { tex } from './textures.js'
import { clamp, damp } from '../core/util.js'
import { makeKeyMesh } from './viewmodel.js'
import { motorbike, ridingHelmet, mergeStaticMeshes } from './build.js'

const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1, ...o })
// scratch objects reused by the per-frame physics helpers
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0)
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3()
const _e = new THREE.Euler()
// scratch vectors for the swept-collision ray (no per-frame allocations)
const _rayFrom = new CANNON.Vec3(), _rayTo = new CANNON.Vec3()

export class Scooter {
  constructor(G, color = '#a31d1d') {
    this.G = G; this.punctured = false; this.parked = true; this.steer = 0; this.lean = 0; this.wheelSpin = 0
    this.root = new THREE.Group(); this.lean_g = new THREE.Group(); this.root.add(this.lean_g)
    // cheap contact shadow — grounds the bike without a second render pass
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }))
    this.shadow.rotation.x = -Math.PI / 2; G.scene.add(this.shadow)
    const dark = M({ color: '#161616', roughness: 0.8 }), chrome = M({ color: '#b8bcc0', metalness: 0.9, roughness: 0.25 })
    const mk = (geo, mat, x, y, z, p = this.lean_g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m }
    // forward = +Z — the player rides the same motorbike model Chacha works on.
    const bike = motorbike(color, true)
    bike.userData.lean.children.slice(0, 4).forEach(c => { c.visible = false }) // hide static wheels; spinning physics wheels below
    mergeStaticMeshes(bike, [bike.userData.headMesh]) // collapse the small body details into a few draw calls
    this.lean_g.add(bike)
    this.headMesh = bike.userData.headMesh
    if (this.headMesh) this.headMesh.material.emissiveIntensity = 0
    // number plate + tail light
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), new THREE.MeshStandardMaterial({ map: tex.sign('MP 04 NN 5721', '#f3f3f0', '#111', 512, 128, '700 62px Inter, sans-serif') })); plate.position.set(0, 0.33, -0.705); plate.rotation.y = Math.PI; this.lean_g.add(plate)
    mk(new THREE.BoxGeometry(0.07, 0.07, 0.03), new THREE.MeshStandardMaterial({ color: '#600', emissive: '#f00', emissiveIntensity: 0.25 }), 0, 0.5, -0.7)
    // helmet hanging from the rear holder / mirror by its chin strap
    const hm = ridingHelmet('#c02020')
    hm.scale.setScalar(0.92)
    if (hm.userData.visor) hm.userData.visor.rotation.x = -0.95 // visor up while hung
    hm.position.set(0, 1.12, -0.42); hm.rotation.set(0.1, 0, 0.2); hm.visible = false
    this.lean_g.add(hm); this.bikeHelmet = hm
    this.setHelmet(!!G.helmetOnBike)
    // kickstand — folds away when riding / pushing, drops when parked
    const st = new THREE.Group()
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.62, 8), M({ color: '#6b6f74', metalness: 0.8, roughness: 0.35 }))
    rod.position.y = -0.28; st.add(rod)
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 8), M({ color: '#3a3d40' }))
    tip.position.y = -0.58; st.add(tip)
    st.position.set(-0.18, 0.44, -0.48)
    this.lean_g.add(st); this.stand = st
    this.standT = 0; this.standTarget = 1 // parked on its stand until mounted / pushed
    // ignition key (shown while the key is in)
    { const fx = this.keyFix = new THREE.Group(); fx.position.set(0, 1.03, 0.34); fx.rotation.y = Math.PI; const inner = new THREE.Group(); inner.add(makeKeyMesh()); fx.add(inner); fx.userData.inner = inner; fx.visible = false; this.lean_g.add(fx) }
    // hook for tiffin/bag
    mk(new THREE.BoxGeometry(0.02, 0.06, 0.04), chrome, 0, 0.75, 0.3)
    // front fork + wheel
    this.fork = new THREE.Group(); this.fork.position.set(0, 0.95, 0.5); this.lean_g.add(this.fork)
    mk(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8), chrome, 0.08, -0.4, 0.04, this.fork); mk(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8), chrome, -0.08, -0.4, 0.04, this.fork)
    this.wheelF = this._wheel(this.fork, 0, -0.74, 0.06); this.wheelR = this._wheel(this.lean_g, 0, 0.21, -0.62)
    // physics
    const w = G.world, g = G.groups || { GROUND: 1, STATIC: 2, VEHICLE: 4, PROP: 8 }
    this.chassis = new CANNON.Body({ mass: 150, material: G.mat.vehicle, allowSleep: false, linearDamping: 0.03, angularDamping: 0.45, collisionFilterGroup: g.VEHICLE, collisionFilterMask: g.GROUND | g.STATIC | g.PROP })
    this.chassis.addShape(new CANNON.Box(new CANNON.Vec3(0.2, 0.15, 0.85)), new CANNON.Vec3(0, -0.12, 0)); this.chassis.angularFactor.set(0.12, 1, 0.12)
    this.chassis.position.set(0, 0.7, 0)
    this.vehicle = new CANNON.RaycastVehicle({ chassisBody: this.chassis, indexRightAxis: 0, indexUpAxis: 1, indexForwardAxis: 2 })
    const o = { radius: 0.21, directionLocal: new CANNON.Vec3(0, -1, 0), axleLocal: new CANNON.Vec3(-1, 0, 0), suspensionStiffness: 45, suspensionRestLength: 0.22, frictionSlip: 3.4, dampingRelaxation: 3.6, dampingCompression: 5.2, maxSuspensionForce: 1e5, rollInfluence: 0, maxSuspensionTravel: 0.22, customSlidingRotationalSpeed: -30, useCustomSlidingRotationalSpeed: true }
    ;[[0.24, 0.62], [-0.24, 0.62], [0.24, -0.62], [-0.24, -0.62]].forEach(([x, z]) => this.vehicle.addWheel({ ...o, chassisConnectionPointLocal: new CANNON.Vec3(x, 0.02, z) }))
    this.vehicle.addToWorld(w)
    // swept collision + impact feedback: cannon has no built-in CCD, so at speed
    // we raycast the chassis' last position → current position and stop at solids.
    this._lastPos = this.chassis.position.clone()
    this._ray = new CANNON.RaycastResult()
    this._hitT = 0
    this.chassis.addEventListener('collide', (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal())
      this._impact(v, this.chassis.position)
    })
    this.headLight = new THREE.SpotLight('#fff1cf', 0, 55, 0.5, 0.55, 1.4); this.headLight.position.set(0, 0.93, 0.6); this.headTarget = new THREE.Object3D(); this.headTarget.position.set(0, 0.5, 6); this.lean_g.add(this.headLight, this.headTarget); this.headLight.target = this.headTarget
    this.sit = new THREE.Object3D(); this.sit.position.set(0, 0.66, -0.2); this.lean_g.add(this.sit)    // rider hip
    this.pillion = new THREE.Object3D(); this.pillion.position.set(0, 0.66, -0.52); this.lean_g.add(this.pillion)
    this.eye = new THREE.Object3D(); this.eye.position.set(0, 1.52, -0.12); this.lean_g.add(this.eye)
    this.brake = 0; this.throttle = 0; this.vehicle.wheelInfos.forEach((wi, i) => this.vehicle.setBrake(60, i))
    this.light(false)
  }
  _wheel(parent, x, y, z) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g)
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.052, 10, 24), M({ color: '#111', roughness: 0.95 })); tyre.rotation.y = Math.PI / 2; tyre.castShadow = true; g.add(tyre)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 14), M({ color: '#8d9298', metalness: 0.8, roughness: 0.35 })); rim.rotation.z = Math.PI / 2; g.add(rim)
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.12), M({ color: '#222' })); s.rotation.x = (i / 5) * Math.PI * 2; s.position.set(0, 0, 0); g.add(s) }
    const inner = new THREE.Group(); inner.add(tyre, rim); g.children.filter(c => c !== inner && c !== tyre && c !== rim).forEach(c => inner.add(c)); g.add(inner)
    g.userData.inner = inner; return g
  }
  setHelmet(on) { if (this.bikeHelmet) this.bikeHelmet.visible = !!on }
  setStand(on) {
    if (!!this.standTarget === !!on) return
    this.standTarget = on ? 1 : 0
    if (this.G && this.G.audio && this.G.audio.metalClack) this.G.audio.metalClack(this.chassis.position)
  }
  light(on) { this.headLight.intensity = on ? 18 : 0; this.headMesh.material.emissiveIntensity = on ? 2 : 0; this.lightOn = on }
  place(x, z, yaw = 0) {
    const c = this.chassis; c.position.set(x, 0.62, z); c.velocity.set(0, 0, 0); c.angularVelocity.set(0, 0, 0); c.quaternion.setFromEuler(0, yaw, 0); this.steer = 0; this.lean = 0
    // Reset the swept-collision ray origin too — otherwise the next drive()
    // sees a huge jump from the old position and snaps the bike back there.
    if (this._lastPos) this._lastPos.copy(c.position); else this._lastPos = c.position.clone()
    this._hitT = 0
  }
  get yaw() { const q = this.chassis.quaternion; _q.set(q.x, q.y, q.z, q.w); return _e.setFromQuaternion(_q, 'YXZ').y }
  get speed() { return this.vehicle.currentVehicleSpeedKmHour / 3.6 }
  fwd() { const y = this.yaw; return new THREE.Vector3(Math.sin(y), 0, Math.cos(y)) }
  setPunctured(v) { this.punctured = v; const s = v ? 0.55 : 1; this.wheelR.scale.set(1, s, 1); this.wheelR.position.y = v ? 0.17 : 0.21 }
  stabilize(dt) {
    const q = this.chassis.quaternion, qq = _q.set(q.x, q.y, q.z, q.w)
    const up = _v1.set(0, 1, 0).applyQuaternion(qq)
    const ax = _v2.crossVectors(up, _up) // axis that rotates up -> world up
    const k = 40, av = this.chassis.angularVelocity
    av.x += ax.x * k * dt; av.z += ax.z * k * dt
    av.x *= 1 - Math.min(1, 6 * dt); av.z *= 1 - Math.min(1, 6 * dt)
  }
  uprightCheck(dt) {
    this.stabilize(dt)
    const q = this.chassis.quaternion
    const up = _v1.set(0, 1, 0).applyQuaternion(_q.set(q.x, q.y, q.z, q.w))
    if (up.y < 0.6) { this._tip = (this._tip || 0) + dt; if (this._tip > 0.5) { const p = this.chassis.position; this.place(p.x, p.z, this.yaw); this._tip = 0 } } else this._tip = 0
  }
  _impact(v, pos) {
    if (v < 3 || performance.now() - (this._hitT || 0) < 300) return
    this._hitT = performance.now()
    const G = this.G
    if (G.audio && G.audio.thud) G.audio.thud(pos || this.chassis.position, clamp(v / 18, 0.25, 1))
    if (G.camShake) G.camShake(clamp(v / 32, 0.15, 0.8))
  }
  // Continuous collision detection: the chassis moves up to ~0.35 m per 120 Hz
  // step at top speed. Raycasting the travelled segment catches thin walls that
  // a discrete narrowphase would tunnel through.
  sweep(dt) {
    const c = this.chassis, prev = this._lastPos
    if (!prev) return
    const dx = c.position.x - prev.x, dy = c.position.y - prev.y, dz = c.position.z - prev.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dist < 0.07 || dist / Math.max(dt, 1e-3) < 12) return
    const g = this.G.groups || { GROUND: 1, STATIC: 2, VEHICLE: 4, PROP: 8 }
    _rayFrom.set(prev.x, prev.y + 0.05, prev.z); _rayTo.set(c.position.x, c.position.y + 0.05, c.position.z)
    this._ray.reset()
    // only solid walls get the hard stop — loose props should be knocked over
    this.G.world.raycastClosest(_rayFrom, _rayTo, { collisionFilterMask: g.STATIC, skipBackfaces: true }, this._ray)
    if (!this._ray.hasHit || !this._ray.body || this._ray.body === c) return
    const n = this._ray.hitNormalWorld, p = this._ray.hitPointWorld
    c.position.set(p.x + n.x * 0.4, c.position.y, p.z + n.z * 0.4)
    const v = c.velocity, vn = v.x * n.x + v.z * n.z
    if (vn < 0) { v.x -= 1.4 * vn * n.x; v.z -= 1.4 * vn * n.z }
    v.x *= 0.5; v.z *= 0.5
    this._impact(Math.abs(vn), p)
  }
  // controls: throttle -1..1, steer -1..1, brake bool, maxSpeed m/s
  drive(dt, throttle, steer, brake, maxSpeed = 42) {
    this.sweep(dt)
    const v = this.vehicle, c = this.chassis, sp = this.speed, asp = Math.abs(sp), av = c.angularVelocity
    this.parked = false
    // grip follows the ground: mud and wet tarmac let the tyres slide more
    const L = this.G.level
    const surf = L && L.surface ? L.surface(c.position.x, c.position.z) : 'dirt'
    const slip = (surf === 'mud' || surf === 'water' || surf === 'wet') ? 2.3 : 4.2
    for (const w of v.wheelInfos) w.frictionSlip = slip
    // A real bike holds a useful steering angle even at speed; only a mild taper.
    const maxSteer = 0.72 - 0.24 * clamp(asp / 22, 0, 1) // generous at walking speed, stable when fast
    this.steer = damp(this.steer, steer * maxSteer, 11, dt)
    const sv = sp < -0.2 ? this.steer : -this.steer // intuitive steering while backing
    v.setSteeringValue(sv, 0); v.setSteeringValue(sv, 1)
    // A scooter does not jump to 100 km/h: torque falls away as speed builds,
    // and the player's throttle is eased in the game loop. Backing is weak and
    // capped, and the bars invert in reverse so it does not feel broken.
    const top = Math.min(maxSpeed, 22)
    let f = 0
    if (throttle > 0 && sp < top) f = throttle * 260 * (1 - Math.pow(clamp(sp / top, 0, 1), 2) * 0.8)
    else if (throttle < 0) {
      if (sp > 0.5) { v.wheelInfos.forEach((w, i) => v.setBrake(10, i)); f = 0 }
      else if (sp > -3.5) f = throttle * 90
    }
    const sign = this.G.cfg.engineSign
    ;[2, 3].forEach(i => v.applyEngineForce(f * sign * (this.punctured ? 0.7 : 1), i))
    const bf = brake ? 8 + Math.abs(sp) * 0.9 : (throttle === 0 ? 0.6 : (throttle < 0 && sp > 0.5 ? 10 : 0))
    if (!(throttle < 0 && sp > 0.5)) v.wheelInfos.forEach((w, i) => v.setBrake(bf, i))
    this.lean = damp(this.lean, -this.steer * clamp(asp / 10, 0, 1) * 0.85, 4, dt)
    // --- grip: kill sideways velocity so the bike rotates about its own axle
    // instead of sliding diagonally when the bars are turned.
    const q = c.quaternion
    const fwd = _v1.set(0, 0, 1).applyQuaternion(_q.set(q.x, q.y, q.z, q.w)); fwd.y = 0
    if (fwd.lengthSq() > 0.0001) {
      fwd.normalize()
      const right = _v2.crossVectors(fwd, _up)
      const cv = c.velocity, lat = cv.x * right.x + cv.z * right.z
      const grip = Math.min(1, 10 * dt) * clamp(asp / 2.5, 0.2, 1)
      cv.x -= right.x * lat * grip; cv.z -= right.z * lat * grip
    }
    const cv2 = c.velocity
    c.applyForce(new CANNON.Vec3(-cv2.x * 0.9, 0, -cv2.z * 0.9), c.position)
    if (Math.abs(steer) < 0.08 && asp > 1.2) av.y *= 1 - Math.min(1, 2.2 * dt)
    if (sp < -0.25) av.y *= 1 - Math.min(1, 6 * dt)
    this.throttle = throttle
  }
  park() { this.parked = true; this.vehicle.wheelInfos.forEach((w, i) => { this.vehicle.setBrake(70, i); this.vehicle.applyEngineForce(0, i) }); this.lean = damp(this.lean, 0, 3, 0.016) }
  // low-speed pushing by foot
  push(dt, throttle, steer) {
    const v = this.vehicle, sp = this.speed, target = throttle * 1.45
    this.steer = damp(this.steer, steer * 0.5, 5, dt); v.setSteeringValue(-this.steer, 0); v.setSteeringValue(-this.steer, 1)
    const sign = this.G.cfg.engineSign
    let f = clamp((target - sp) * 160, -220, 220); if (this.punctured) f *= 0.8
    ;[2, 3].forEach(i => v.applyEngineForce(f * sign, i))
    v.wheelInfos.forEach((w, i) => v.setBrake(Math.abs(throttle) < 0.05 ? 25 : 0, i)); this.lean = damp(this.lean, 0, 3, dt)
  }
  sync(dt) {
    const c = this.chassis, v = this.vehicle
    if (this._lastPos) this._lastPos.copy(c.position); else this._lastPos = c.position.clone()
    v.wheelInfos.forEach((w, i) => v.updateWheelTransform(i))
    // Physics stays on the flat cannon plane; lift only the visible model so
    // the bike sits on the rolling ground without a heightfield rebuild.
    const gy = this.G.level && this.G.level.groundY ? this.G.level.groundY(c.position.x, c.position.z) : 0
    this.root.position.set(c.position.x, c.position.y + gy, c.position.z); this.root.quaternion.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
    if (this.shadow) this.shadow.position.set(c.position.x, 0.03 + gy, c.position.z)
    // chassis origin sits ~ at wheel hub height region: lower so wheels touch ground visually
    this.lean_g.position.y = -0.34 - 0.0; this.lean_g.rotation.z = this.lean
    if (this.stand) { this.standT = damp(this.standT, this.standTarget || 0, 7, dt); this.stand.rotation.z = -0.15 + this.standT * 1.05 }
    this.fork.rotation.y = this.steer * 0.9
    this.wheelSpin += (this.speed / 0.21) * dt
    this.wheelF.userData.inner.rotation.x = this.wheelSpin; this.wheelR.userData.inner.rotation.x = this.wheelSpin
    // suspension compression visual on front fork (cheap)
    const comp = (v.wheelInfos[0].suspensionLength + v.wheelInfos[1].suspensionLength) / 2
    this.wheelF.position.y = -0.74 + clamp((0.22 - comp) * 0.5, -0.05, 0.07)
  }
  dispose() {
    this.vehicle.removeFromWorld(this.G.world)
    if (this.shadow) { this.G.scene.remove(this.shadow); this.shadow.geometry.dispose(); this.shadow.material.dispose() }
  }
}
