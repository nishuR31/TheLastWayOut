// The player's own body, only shown in third-person view (C key).
import * as THREE from 'three'
import { humanFromOutfit } from './humanRig.js'
import { ridingHelmet } from './build.js'

export const body = {
  G: null, P: null, root: null, helmet: null,
  init(G) {
    this.G = G; this.P = humanFromOutfit('nishan'); this.root = this.P.root; this.root.visible = false; G.scene.add(this.root)
    // Helmet is worn on the HEAD joint, so it follows every look/turn animation.
    this.helmet = ridingHelmet('#c02020')
    this.helmet.position.set(0, 0.135, 0.005)
    this.helmet.scale.setScalar(0.95)
    this.helmet.visible = false
    this.P.head.add(this.helmet)
  },
  update(dt) {
    const G = this.G, p = G.player; if (!this.root) return
    if (G._helmetPoseT > 0) G._helmetPoseT = Math.max(0, G._helmetPoseT - dt)
    // The rig's hair/cap stays underneath; the shell covers it when worn.
    if (this.helmet) {
      this.helmet.visible = !!G.hasHelmet
      const v = this.helmet.userData && this.helmet.userData.visor
      if (v) v.rotation.x += (((G.hasHelmet && G.visorDown) ? 0 : -0.95) - v.rotation.x) * Math.min(1, dt * 8)
    }
    const vis = ((!!G.tpp && !G.camOverride) || !!G.showBody) && !!G.level
    this.root.visible = vis; if (!vis) return
    if (p.mode === 'ride' && G.scooter) {
      const sc = G.scooter, q = new THREE.Quaternion()
      sc.sit.getWorldPosition(this.root.position); sc.sit.getWorldQuaternion(q)
      this.root.rotation.y = new THREE.Euler().setFromQuaternion(q, 'YXZ').y
      this.P.setPose('sit'); this.P.crouch = 0; this.P.update(dt, 0)
    } else {
      this.root.position.set(p.pos.x, p.pos.y, p.pos.z); this.root.rotation.y = p.yaw
      this.P.setPose(G._helmetPoseT > 0 ? 'hands_up' : (G.bodyPose || (p.push ? 'steer' : 'stand'))); this.P.crouch = p.crouch; this.P.update(dt, p.push ? Math.abs(p.vel) : p.vel)
    }
  }
}
