// The player's own body, only shown in third-person view (C key).
import * as THREE from 'three'
import { makePerson } from './people.js'

export const body = {
  G: null, P: null, root: null,
  init(G) {
    this.G = G; this.P = makePerson('nishan'); this.root = this.P.root; this.root.visible = false; G.scene.add(this.root)
  },
  update(dt) {
    const G = this.G, p = G.player; if (!this.root) return
    const vis = ((!!G.tpp && !G.camOverride) || !!G.showBody) && !!G.level
    this.root.visible = vis; if (!vis) return
    if (p.mode === 'ride' && G.scooter) {
      const sc = G.scooter, q = new THREE.Quaternion()
      sc.sit.getWorldPosition(this.root.position); sc.sit.getWorldQuaternion(q)
      this.root.rotation.y = new THREE.Euler().setFromQuaternion(q, 'YXZ').y
      this.P.setPose('sit'); this.P.crouch = 0; this.P.update(dt, 0)
    } else {
      this.root.position.set(p.pos.x, p.pos.y, p.pos.z); this.root.rotation.y = p.yaw
      this.P.setPose(G.bodyPose || (p.push ? 'push' : 'stand')); this.P.crouch = p.crouch; this.P.update(dt, p.push ? Math.abs(p.vel) : p.vel)
    }
  }
}
