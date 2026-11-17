// Scooter: visual model + cannon-es RaycastVehicle (real suspension / friction / mass)
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { tex } from './textures.js'
import { clamp, damp } from '../core/util.js'
import { makeKeyMesh } from './viewmodel.js'

const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1, ...o })
// scratch objects reused by the per-frame physics helpers
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0)
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3()
const _e = new THREE.Euler()

export class Scooter {
  constructor(G, color = '#27508f') {
    this.G = G; this.punctured = false; this.parked = true; this.steer = 0; this.lean = 0; this.wheelSpin = 0
    this.root = new THREE.Group(); this.lean_g = new THREE.Group(); this.root.add(this.lean_g)
    const body = M({ color, roughness: 0.35, metalness: 0.35 }), dark = M({ color: '#161616', roughness: 0.8 }), chrome = M({ color: '#b8bcc0', metalness: 0.9, roughness: 0.25 })
    const mk = (geo, mat, x, y, z, p = this.lean_g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m }
    // forward = +Z
    mk(new THREE.BoxGeometry(0.36, 0.05, 0.6), dark, 0, 0.2, 0.1)                      // floorboard
    const rear = mk(new THREE.BoxGeometry(0.34, 0.3, 0.62), body, 0, 0.42, -0.38); rear.geometry.translate(0, 0, 0)
    mk(new THREE.BoxGeometry(0.3, 0.07, 0.58), M({ color: '#1a1a1a', roughness: 0.9 }), 0, 0.62, -0.32) // seat
    const apron = mk(new THREE.BoxGeometry(0.38, 0.55, 0.07), body, 0, 0.5, 0.38); apron.rotation.x = -0.18
    mk(new THREE.BoxGeometry(0.46, 0.16, 0.22), body, 0, 0.93, 0.44)                 // handlebar cover
    const hl = mk(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffe9b0', emissiveIntensity: 0.0 }), 0, 0.93, 0.57); hl.rotation.x = Math.PI / 2; this.headMesh = hl
    mk(new THREE.CylinderGeometry(0.014, 0.014, 0.66, 8), chrome, 0, 1.0, 0.42).rotation.z = Math.PI / 2
    ;[-1, 1].forEach(s => { mk(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), dark, s * 0.33, 1.0, 0.42).rotation.z = Math.PI / 2; mk(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), chrome, s * 0.3, 1.1, 0.4); const mir = mk(new THREE.BoxGeometry(0.1, 0.07, 0.01), M({ color: '#222' }), s * 0.32, 1.2, 0.38); mir.rotation.y = s * 0.3 })
    mk(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 10), chrome, 0.2, 0.28, -0.35).rotation.x = Math.PI / 2 // silencer
    mk(new THREE.BoxGeometry(0.07, 0.07, 0.03), new THREE.MeshStandardMaterial({ color: '#600', emissive: '#f00', emissiveIntensity: 0.25 }), 0, 0.5, -0.7)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), new THREE.MeshStandardMaterial({ map: tex.sign('MP 04 NN 5721', '#f3f3f0', '#111', 512, 128, '700 62px Inter, sans-serif') })); plate.position.set(0, 0.33, -0.705); plate.rotation.y = Math.PI; this.lean_g.add(plate)
    mk(new THREE.BoxGeometry(0.3, 0.05, 0.4), dark, 0, 0.7, -0.02).visible = false
    // ignition key (shown while the key is in)
    { const fx = this.keyFix = new THREE.Group(); fx.position.set(0, 1.03, 0.34); fx.rotation.y = Math.PI; const inner = new THREE.Group(); inner.add(makeKeyMesh()); fx.add(inner); fx.userData.inner = inner; fx.visible = false; this.lean_g.add(fx) }
    // hook for tiffin/bag
    mk(new THREE.BoxGeometry(0.02, 0.06, 0.04), chrome, 0, 0.75, 0.3)
    // front fork + wheel
    this.fork = new THREE.Group(); this.fork.position.set(0, 0.95, 0.5); this.lean_g.add(this.fork)
    mk(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8), chrome, 0.08, -0.4, 0.04, this.fork); mk(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8), chrome, -0.08, -0.4, 0.04, this.fork)
    this.wheelF = this._wheel(this.fork, 0, -0.74, 0.06); this.wheelR = this._wheel(this.lean_g, 0, 0.21, -0.62)
    // physics
    const w = G.world
    this.chassis = new CANNON.Body({ mass: 150, material: G.mat.vehicle, allowSleep: false, linearDamping: 0.03, angularDamping: 0.45 })
    this.chassis.addShape(new CANNON.Box(new CANNON.Vec3(0.2, 0.15, 0.85)), new CANNON.Vec3(0, -0.12, 0)); this.chassis.angularFactor.set(0.12, 1, 0.12)
    this.chassis.position.set(0, 0.7, 0)
    this.vehicle = new CANNON.RaycastVehicle({ chassisBody: this.chassis, indexRightAxis: 0, indexUpAxis: 1, indexForwardAxis: 2 })
    const o = { radius: 0.21, directionLocal: new CANNON.Vec3(0, -1, 0), axleLocal: new CANNON.Vec3(-1, 0, 0), suspensionStiffness: 45, suspensionRestLength: 0.22, frictionSlip: 3.4, dampingRelaxation: 3.6, dampingCompression: 5.2, maxSuspensionForce: 1e5, rollInfluence: 0, maxSuspensionTravel: 0.22, customSlidingRotationalSpeed: -30, useCustomSlidingRotationalSpeed: true }
    ;[[0.24, 0.62], [-0.24, 0.62], [0.24, -0.62], [-0.24, -0.62]].forEach(([x, z]) => this.vehicle.addWheel({ ...o, chassisConnectionPointLocal: new CANNON.Vec3(x, 0.02, z) }))
    this.vehicle.addToWorld(w)
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
  light(on) { this.headLight.intensity = on ? 18 : 0; this.headMesh.material.emissiveIntensity = on ? 2 : 0; this.lightOn = on }
  place(x, z, yaw = 0) {
    const c = this.chassis; c.position.set(x, 0.62, z); c.velocity.set(0, 0, 0); c.angularVelocity.set(0, 0, 0); c.quaternion.setFromEuler(0, yaw, 0); this.steer = 0; this.lean = 0
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
  // controls: throttle -1..1, steer -1..1, brake bool, maxSpeed m/s
  drive(dt, throttle, steer, brake, maxSpeed = 11) {
    const v = this.vehicle, sp = this.speed, asp = Math.abs(sp)
    this.parked = false
    const maxSteer = 0.62 - 0.46 * clamp(asp / 11, 0, 1)
    this.steer = damp(this.steer, steer * maxSteer, 7, dt)
    v.setSteeringValue(-this.steer, 0); v.setSteeringValue(-this.steer, 1)
    let f = 0
    if (throttle > 0 && sp < maxSpeed) f = throttle * 260 * (1 - clamp(sp / maxSpeed, 0, 1) * 0.65)
    else if (throttle < 0) { if (sp > 0.5) { v.wheelInfos.forEach((w, i) => v.setBrake(14, i)); f = 0 } else if (sp > -3) f = throttle * 150 }
    const sign = this.G.cfg.engineSign
    ;[2, 3].forEach(i => v.applyEngineForce(f * sign * (this.punctured ? 0.7 : 1), i))
    const bf = brake ? 22 : (throttle === 0 ? 1.4 : (throttle < 0 && sp > 0.5 ? 14 : 0))
    if (!(throttle < 0 && sp > 0.5)) v.wheelInfos.forEach((w, i) => v.setBrake(bf, i))
    this.lean = damp(this.lean, -this.steer * clamp(asp / 8, 0, 1) * 0.9, 4, dt)
    // drag
    const cv = this.chassis.velocity; this.chassis.applyForce(new CANNON.Vec3(-cv.x * 3.2, 0, -cv.z * 3.2), this.chassis.position)
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
    v.wheelInfos.forEach((w, i) => v.updateWheelTransform(i))
    this.root.position.set(c.position.x, c.position.y, c.position.z); this.root.quaternion.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w)
    // chassis origin sits ~ at wheel hub height region: lower so wheels touch ground visually
    this.lean_g.position.y = -0.34 - 0.0; this.lean_g.rotation.z = this.lean
    this.fork.rotation.y = this.steer * 0.9
    this.wheelSpin += (this.speed / 0.21) * dt
    this.wheelF.userData.inner.rotation.x = this.wheelSpin; this.wheelR.userData.inner.rotation.x = this.wheelSpin
    // suspension compression visual on front fork (cheap)
    const comp = (v.wheelInfos[0].suspensionLength + v.wheelInfos[1].suspensionLength) / 2
    this.wheelF.position.y = -0.74 + (0.22 - comp) * 0.0
  }
  dispose() { this.vehicle.removeFromWorld(this.G.world) }
}
