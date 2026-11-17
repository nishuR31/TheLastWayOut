// Actor = a Person rig with simple path-following, look-at, footsteps and attach support
import * as THREE from 'three'
import { humanFromOutfit } from './humanRig.js'
import { lod } from './lod.js'
import { angDiff, damp, clamp } from '../core/util.js'
import { audio } from '../core/audio.js'

const _q = new THREE.Quaternion(), _e = new THREE.Euler()

export class Actor {
  constructor(G, outfit, over = {}) {
    this.G = G; this.key = outfit; this.P = humanFromOutfit(outfit, over); this.root = this.P.root
    lod.register(this.P)
    this.pos = this.root.position; this.yaw = 0; this.path = []; this.speed = 0; this.walkSpeed = 1.5
    this.mode = 'idle'; this.lookTarget = null; this.stepT = 0; this.sfx = true; this.attach = null; this.faceYaw = null
    this.wander = 0; this.hidden = false; this.stepVol = 1; this.collide = false; this.torch = null
    G.scene.add(this.root)
  }
  place(x, z, yaw = this.yaw, y = 0) { this.pos.set(x, y, z); this.yaw = yaw; this.root.rotation.y = yaw; this.path = []; this.speed = 0 }
  headPos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.P.o.h * 0.94, this.pos.z) }
  setVisible(v) { this.root.visible = v; this.hidden = !v }
  pose(p) { this.P.setPose(p) }
  walkTo(x, z, speed = 1.5) { return new Promise((res, rej) => { this.path = [{ x, z, res }]; this.walkSpeed = speed }) }
  walkPath(pts, speed = 1.5) { return new Promise((res) => { this.path = pts.map((p, i) => ({ x: p[0] ?? p.x, z: p[1] ?? p.z, res: i === pts.length - 1 ? res : null })); this.walkSpeed = speed }) }
  stop() { this.path = [] }
  face(target) { this.faceYaw = target === null ? null : (typeof target === 'number' ? target : Math.atan2(target.x - this.pos.x, target.z - this.pos.z)) }
  look(target) { this.lookTarget = target }
  giveTorch(on = true, power = 1) {
    if (on && !this.torch) { const s = new THREE.SpotLight('#fff1d0', 38 * power, 24, 0.45, 0.6, 1.3); s.position.set(0, 1.3, 0.3); const t = new THREE.Object3D(); t.position.set(0, 0.6, 6); this.root.add(s, t); s.target = t; this.torch = s }
    if (this.torch) this.torch.visible = on
  }
  update(dt) {
    const G = this.G
    if (this.attach) { this.attach.getWorldPosition(this.pos); this.pos.y -= 0.0; const q = _q; this.attach.getWorldQuaternion(q); const e = _e.setFromQuaternion(q, 'YXZ'); this.yaw = e.y; this.root.rotation.y = e.y; this.P.update(dt, 0); this.root.position.y = this.pos.y - this.P.legL * 0.0; return }
    let moving = 0
    if (this.path.length) {
      const w = this.path[0], dx = w.x - this.pos.x, dz = w.z - this.pos.z, d = Math.hypot(dx, dz)
      if (d < 0.18) { const r = w.res; this.path.shift(); if (r) r() } else {
        const want = Math.atan2(dx, dz); this.yaw += angDiff(this.yaw, want) * Math.min(1, dt * 7)
        const sp = Math.min(this.walkSpeed, d * 4 + 0.3); this.pos.x += (dx / d) * sp * dt; this.pos.z += (dz / d) * sp * dt; moving = sp
        if (this.collide && G.level) { const p = { x: this.pos.x, z: this.pos.z }; G.level.walk.resolve(p, 0.3); this.pos.x = p.x; this.pos.z = p.z }
      }
    } else if (this.faceYaw !== null) this.yaw += angDiff(this.yaw, this.faceYaw) * Math.min(1, dt * 5)
    this.speed = damp(this.speed, moving, 8, dt)
    if (G.level && G.level.groundY && !(G.level.isIndoors && G.level.isIndoors(this.pos.x, this.pos.z))) this.pos.y = G.level.groundY(this.pos.x, this.pos.z)
    this.root.rotation.y = this.yaw
    // head look
    if (this.lookTarget) { const t = this.lookTarget.isVector3 ? this.lookTarget : (this.lookTarget.pos || this.lookTarget); const dx = t.x - this.pos.x, dz = t.z - this.pos.z; const rel = angDiff(this.yaw, Math.atan2(dx, dz)); this.P.lookY = clamp(rel, -1.1, 1.1); this.P.lookX = -Math.atan2((t.y ?? 1.2) - 1.55, Math.hypot(dx, dz)) * 0.5 } else { this.P.lookY *= 0.94; this.P.lookX *= 0.94 }
    this.P.update(dt, this.speed)
    if (this.sfx && this.speed > 0.4 && !this.hidden && audio.ctx) { this.stepT -= dt * this.speed; if (this.stepT <= 0) { this.stepT = 0.78; const s = G.level && G.level.surface ? G.level.surface(this.pos.x, this.pos.z) : 'dirt'; audio.footstep(s, 0.8 * this.stepVol, { x: this.pos.x, y: 0.1, z: this.pos.z }) } }
  }
  dispose() { lod.unregister(this.P); this.G.scene.remove(this.root); this.root.traverse(o => { if (o.geometry) o.geometry.dispose() }) }
}
