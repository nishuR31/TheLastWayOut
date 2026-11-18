// Level base class + building / prop kit
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { tex, withPBR, worldUV } from './textures.js'
import { Walk } from './walk.js'
import { RNG, nearestOnPoly, R } from '../core/util.js'

const S = (o) => withPBR(new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o }))
// scale a box's UVs to world metres so photo textures keep their real-world size
export function boxUV(geo, w, h, d, m) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / m, uv.getY(k) * dims[f][1] / m) }
  uv.needsUpdate = true; return geo
}
export const bx = (p, w, h, d, mat, x, y, z, ry = 0) => { const wu = worldUV(mat), geo = new THREE.BoxGeometry(w, h, d); if (wu) boxUV(geo, w, h, d, wu); const m = new THREE.Mesh(geo, mat); m.position.set(x, y + h / 2, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; p.add(m); return m }
export const cyl = (p, rt, rb, h, mat, x, y, z, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m }
export const sph = (p, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; p.add(m); return m }

export class Level {
  constructor(G, name) {
    this.G = G; this.name = name; this.group = new THREE.Group(); this.walk = new Walk(); this.updaters = []; this.bodies = []; this.flick = []; this.puddles = []
    this.ripples = []; this.spawn = { x: 0, z: 0, yaw: 0 }; this.lights = []; this.swayers = []; this.pods = []; this.t = 0; this.doors = []; this.cams = []; this.disposers = []; this.refs = {}
  }
  add(o) { this.group.add(o); return o }
  update(dt) { this.t += dt; for (const u of this.updaters) u(dt, this.t); for (const f of this.flick) { const k = f.base * (0.78 + 0.22 * Math.sin(this.t * f.sp + f.ph) + 0.1 * Math.sin(this.t * f.sp * 2.3 + f.ph * 2)); f.light.intensity = k * (f.mul ? f.mul() : 1); if (f.glow) f.glow.material.opacity = 0.5 * (k / f.base) * (f.mul ? f.mul() : 1) } }
  solid(x0, z0, x1, z1, h = 3) {
    this.walk.box(x0, z0, x1, z1)
    const g = this.G.groups || { GROUND: 1, STATIC: 2, VEHICLE: 4, PROP: 8 }
    const b = new CANNON.Body({ mass: 0, material: this.G.mat.ground, collisionFilterGroup: g.STATIC, collisionFilterMask: g.VEHICLE | g.PROP | g.GROUND })
    b.addShape(new CANNON.Box(new CANNON.Vec3(Math.abs(x1 - x0) / 2, h / 2, Math.abs(z1 - z0) / 2))); b.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2)
    this.G.world.addBody(b); this.bodies.push(b); return b
  }
  dynamic(mesh, shape, mass, x, y, z, mat) {
    const g = this.G.groups || { GROUND: 1, STATIC: 2, VEHICLE: 4, PROP: 8 }
    const b = new CANNON.Body({ mass, material: mat || this.G.mat.prop, linearDamping: 0.15, angularDamping: 0.35, collisionFilterGroup: g.PROP, collisionFilterMask: g.VEHICLE | g.STATIC | g.GROUND })
    b.addShape(shape); b.position.set(x, y, z); this.G.world.addBody(b); this.bodies.push(b)
    mesh.position.set(x, y, z); this.group.add(mesh); this.updaters.push(() => { mesh.position.copy(b.position); mesh.quaternion.copy(b.quaternion) }); return b
  }
  ground(w, d, texKey, rep = 1, cx = 0, cz = 0, color = 0xffffff) {
    const t = tex[texKey]().clone(); t.needsUpdate = true; t.repeat.set(w / rep, d / rep)
    const seg = this.heightAt ? Math.min(80, Math.max(12, Math.floor(Math.max(w, d) / 6))) : 1
    const geo = new THREE.PlaneGeometry(w, d, seg, seg)
    if (this.heightAt) {
      // the plane is rotated -90° about X: local (x,y) -> world (cx+x, cz-y),
      // and local z becomes world height.
      const p = geo.attributes.position
      for (let i = 0; i < p.count; i++) p.setZ(i, this.heightAt(cx + p.getX(i), cz - p.getY(i)))
      p.needsUpdate = true; geo.computeVertexNormals()
    }
    const m = new THREE.Mesh(geo, S({ map: t, color })); m.rotation.x = -Math.PI / 2; m.position.set(cx, 0, cz); m.receiveShadow = true; this.group.add(m); return m
  }
  ribbon(pts, w, texKey = 'mud', rep = 4, y = 0.012, color = 0xffffff, wobble = true) {
    const P = pts.map(p => (Array.isArray(p) ? { x: p[0], z: p[1] } : p)), pos = [], uv = [], idx = []; let acc = 0
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l
      if (i > 0) acc += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z)
      const nx = -dz, nz = dx, wob = wobble ? 0.75 + 0.25 * Math.sin(i * 1.7) : 1, ww = typeof w === 'function' ? w(i, acc) : w
      const hA = this.heightAt ? this.heightAt(P[i].x + nx * ww * wob, P[i].z + nz * ww * wob) : 0
      const hB = this.heightAt ? this.heightAt(P[i].x - nx * ww * wob, P[i].z - nz * ww * wob) : 0
      pos.push(P[i].x + nx * ww * wob, hA + y, P[i].z + nz * ww * wob, P[i].x - nx * ww * wob, hB + y, P[i].z - nz * ww * wob); uv.push(0, acc / rep, 1, acc / rep)
      if (i < P.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
    const t = tex[texKey]().clone(); t.needsUpdate = true; const m = new THREE.Mesh(g, S({ map: t, color, side: THREE.DoubleSide })); m.receiveShadow = true; this.group.add(m); return m
  }
  puddle(x, z, r) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), new THREE.MeshStandardMaterial({ color: '#1b2430', roughness: 0.04, metalness: 0.85, transparent: true, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(x, (this.groundY ? this.groundY(x, z) : 0) + 0.02, z); m.scale.y = 0.7; m.rotation.z = R.range(0, 3); this.group.add(m); this.puddles.push({ x, z, r }); return m
  }
  lantern(x, y, z, o = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z)
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 10), new THREE.MeshBasicMaterial({ color: '#ffd08a' })); g.add(glass)
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 10), S({ color: '#222', metalness: 0.6 })); top.position.y = 0.12; g.add(top)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), S({ color: '#222', metalness: 0.6 })); base.position.y = -0.1; g.add(base)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow(), color: o.color || '#ff9a3c', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: true })); glow.scale.setScalar(o.glow || 1.8); g.add(glow)
    this.group.add(g)
    if (o.light !== false) { const L = new THREE.PointLight(o.color || '#ff9a3c', 0, o.dist || 11, 1.6); L.position.set(x, y + 0.05, z); this.group.add(L); this.flick.push({ light: L, base: o.int || 7, sp: R.range(6, 11), ph: R.range(0, 6), glow, mul: o.mul }); this.lights.push(L) }
    return g
  }
  dispose() {
    (this.disposers || []).forEach(f => f()); this.disposers = []
    for (const b of this.bodies) this.G.world.removeBody(b); this.bodies = []
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose() })
    this.G.scene.remove(this.group)
  }
}

// ---------- houses ----------
const rotPt = (r, cx, cz, lx, lz) => [cx + lx * Math.cos(r) + lz * Math.sin(r), cz - lx * Math.sin(r) + lz * Math.cos(r)]
export function buildHouse(L, o) {
  const { x, z, w, d, h = 2.9, rot = 0, wall = 'plaster', col = '#d8c9a8', roof = 'tile', floor = 'earth', windows = [], doorX = 0, doorW = 1.1, light = null, interior = true, name = '', closedDoor = true, frame } = o
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; L.add(g)
  const t = 0.22
  const wm = wall === 'mud' ? S({ map: tex.mudwall() }) : wall === 'brick' ? S({ map: tex.brick() }) : S({ map: tex.plaster(col) })
  const rects = []
  const seg = (lx0, lz0, lx1, lz1, hh = h, y0 = 0) => { const ww = Math.abs(lx1 - lx0), dd = Math.abs(lz1 - lz0); const m = bx(g, ww, hh, dd, wm, (lx0 + lx1) / 2, y0, (lz0 + lz1) / 2); if (y0 === 0) { const a = rotPt(rot, x, z, lx0, lz0), b = rotPt(rot, x, z, lx1, lz1); rects.push([a[0], a[1], b[0], b[1]]) } return m }
  seg(-w / 2 - t, -d / 2 - t, w / 2 + t, -d / 2) // back
  seg(-w / 2 - t, -d / 2, -w / 2, d / 2); seg(w / 2, -d / 2, w / 2 + t, d / 2)
  const dl = doorX - doorW / 2, dr = doorX + doorW / 2
  seg(-w / 2 - t, d / 2, dl, d / 2 + t); seg(dr, d / 2, w / 2 + t, d / 2 + t)
  bx(g, doorW, h - 2.15, t, wm, doorX, 2.15, d / 2 + t / 2)  // lintel
  for (const r of rects) L.solid(r[0], r[1], r[2], r[3], h)
  // door leaf
  const hinge = new THREE.Group(); hinge.position.set(dl, 0, d / 2 + t / 2); g.add(hinge)
  const leaf = bx(hinge, doorW - 0.04, 2.1, 0.06, S({ map: tex.wood('#4a3524') }), (doorW - 0.04) / 2, 0, 0); hinge.userData.open = 0
  const dc = rotPt(rot, x, z, doorX, d / 2 + t / 2); const dh = doorW / 2
  const doorBox = { x0: dc[0] - (Math.abs(Math.cos(rot)) > 0.5 ? dh : 0.12), x1: dc[0] + (Math.abs(Math.cos(rot)) > 0.5 ? dh : 0.12), z0: dc[1] - (Math.abs(Math.cos(rot)) > 0.5 ? 0.12 : dh), z1: dc[1] + (Math.abs(Math.cos(rot)) > 0.5 ? 0.12 : dh) }
  const house = { group: g, hinge, w, d, x, z, rot, doorX, doorOpen: false, name, doorWorld: new THREE.Vector3(...[dc[0], 1.2, dc[1]]), light: [] }
  house.setDoor = (open, instant = false) => { house.doorOpen = open; const i = L.walk.boxes.indexOf(doorBox); if (open && i >= 0) L.walk.boxes.splice(i, 1); if (!open && i < 0) L.walk.boxes.push(doorBox); if (instant) hinge.rotation.y = open ? -1.7 : 0 }
  house.setDoor(!closedDoor, true)
  L.updaters.push((dt) => { const tgt = house.doorOpen ? -1.7 : 0; hinge.rotation.y += (tgt - hinge.rotation.y) * Math.min(1, dt * 3.5) })
  // floor + ceiling
  const ft = floor === 'tile' ? tex.tileFloor() : floor === 'cement' ? tex.cement() : tex.earthFloor(); const f2 = ft.clone(); f2.needsUpdate = true; f2.repeat.set(w / 2.2, d / 2.2)
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), S({ map: f2 })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.015; fl.receiveShadow = true; g.add(fl)
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(w, d), S({ color: '#6a5a48', side: THREE.DoubleSide })); ce.rotation.x = Math.PI / 2; ce.position.y = h; g.add(ce)
  // roof
  const rm = roof === 'tin' ? S({ map: tex.tin(), side: THREE.DoubleSide }) : roof === 'thatch' ? S({ map: tex.thatch(), side: THREE.DoubleSide }) : roof === 'flat' ? S({ map: tex.cement() }) : S({ map: tex.tile(), side: THREE.DoubleSide })
  if (roof === 'flat') { bx(g, w + 0.5, 0.2, d + 0.5, rm, 0, h, 0); bx(g, w + 0.5, 0.5, 0.1, rm, 0, h + 0.2, d / 2 + 0.2); bx(g, w + 0.5, 0.5, 0.1, rm, 0, h + 0.2, -d / 2 - 0.2); bx(g, 0.1, 0.5, d + 0.5, rm, w / 2 + 0.2, h + 0.2, 0); bx(g, 0.1, 0.5, d + 0.5, rm, -w / 2 - 0.2, h + 0.2, 0) }
  else {
    const sl = roof === 'tin' ? 0.22 : 0.5, rise = Math.tan(sl) * (d / 2 + 0.5), len = (d / 2 + 0.6) / Math.cos(sl)
    for (const s of [-1, 1]) { const rg = new THREE.BoxGeometry(w + 0.9, 0.08, len); if (worldUV(rm)) boxUV(rg, w + 0.9, 0.08, len, worldUV(rm)); const m = new THREE.Mesh(rg, rm); m.position.set(0, h + rise / 2 + 0.05, s * (d / 4 + 0.25)); m.rotation.x = s * sl; m.castShadow = true; g.add(m) }
    const shp = new THREE.Shape(); shp.moveTo(-d / 2 - 0.1, 0); shp.lineTo(d / 2 + 0.1, 0); shp.lineTo(0, rise); shp.closePath()
    for (const s of [-1, 1]) { const gm = new THREE.Mesh(new THREE.ShapeGeometry(shp), wm); gm.position.set(s * (w / 2 + 0.1), h, 0); gm.rotation.y = s * Math.PI / 2; g.add(gm) }
  }
  // windows
  for (const wd of windows) {
    const side = wd.side || 's', ww = wd.w || 0.8, hh = wd.h || 0.9, y = wd.y || 1.1, px = wd.x || 0
    const pos = side === 's' ? [px, y, d / 2 + t + 0.012, 0] : side === 'n' ? [px, y, -d / 2 - t - 0.012, Math.PI] : side === 'e' ? [w / 2 + t + 0.012, y, px, Math.PI / 2] : [-w / 2 - t - 0.012, y, px, -Math.PI / 2]
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), new THREE.MeshBasicMaterial({ color: wd.color || (wd.lit ? '#d9a050' : '#06080b') })); pane.position.set(pos[0], pos[1], pos[2]); pane.rotation.y = pos[3]; g.add(pane)
    const fr = bx(g, ww + 0.1, 0.05, 0.05, S({ color: '#3a2a1c' }), pos[0], pos[1] + hh / 2, pos[2]); fr.rotation.y = pos[3]
    if (wd.pale) { // two pale eye-like gaps seen through the shutter
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), new THREE.MeshBasicMaterial({ color: '#e8efe8', transparent: true, opacity: 0.5, fog: true })); e.scale.set(1.5, 0.8, 1); e.position.set(pos[0], pos[1], pos[2] + 0.004); e.rotation.y = pos[3]; e.translateX(s * 0.13); e.translateY(0.05); g.add(e); e.userData.pale = true }
    }
    for (let i = -1; i <= 1; i++) { const bar = bx(g, 0.02, hh, 0.02, S({ color: '#222', metalness: 0.5 }), pos[0], pos[1] - hh / 2, pos[2] + 0.01); bar.rotation.y = pos[3]; bar.translateX(i * ww / 3.2) }
  }
  // interior walkable & door approach
  if (interior) { const a = rotPt(rot, x, z, -w / 2 + 0.05, -d / 2 + 0.05), b = rotPt(rot, x, z, w / 2 - 0.05, d / 2 - 0.05); L.walk.rect(a[0], a[1], b[0], b[1], 'in_' + name); const c = rotPt(rot, x, z, doorX - doorW / 2 - 0.4, d / 2 - 1.1), e = rotPt(rot, x, z, doorX + doorW / 2 + 0.4, d / 2 + 2.2); L.walk.rect(c[0], c[1], e[0], e[1], 'door_' + name) }
  // interior bounds for audio/rain
  const a = rotPt(rot, x, z, -w / 2, -d / 2), b = rotPt(rot, x, z, w / 2, d / 2); house.bounds = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) }
  house.local = (lx, ly, lz) => { const p = rotPt(rot, x, z, lx, lz); return new THREE.Vector3(p[0], ly, p[1]) }
  house.inside = (px, pz) => px > house.bounds.x0 && px < house.bounds.x1 && pz > house.bounds.z0 && pz < house.bounds.z1
  house.addLight = (lx, ly, lz, color, int, dist) => { const p = rotPt(rot, x, z, lx, lz); const Lt = new THREE.PointLight(color, int, dist, 1.4); Lt.position.set(p[0], ly, p[1]); L.group.add(Lt); house.light.push(Lt); L.lights.push(Lt); return Lt }
  house.place = (obj, lx, lz, ly = 0, ry = 0) => { const p = rotPt(rot, x, z, lx, lz); obj.position.set(p[0], ly, p[1]); obj.rotation.y = rot + ry; L.add(obj); return obj }
  return house
}

// ---------- furniture & props ----------
const wood = () => S({ map: tex.wood('#6b4a30') })
export function sofa() { const g = new THREE.Group(), m = S({ map: tex.cloth('#7a2e2a', '#a8544c', 'stripe') }); bx(g, 1.9, 0.4, 0.85, m, 0, 0.15, 0); bx(g, 1.9, 0.5, 0.2, m, 0, 0.5, -0.33); bx(g, 0.2, 0.3, 0.85, m, -0.95, 0.5, 0); bx(g, 0.2, 0.3, 0.85, m, 0.95, 0.5, 0); return g }
export function table(w = 1.4, d = 0.8, h = 0.75) { const g = new THREE.Group(), m = wood(); g.userData.table = { w, d, h }; bx(g, w, 0.06, d, m, 0, h - 0.06, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.06, h - 0.06, 0.06, m, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06)); return g }
export function chair() { const g = new THREE.Group(), m = wood(); bx(g, 0.42, 0.05, 0.42, m, 0, 0.44, 0); bx(g, 0.42, 0.5, 0.04, m, 0, 0.5, -0.19); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.04, 0.44, 0.04, m, sx * 0.18, 0, sz * 0.18); return g }
export function stool() { const g = new THREE.Group(); bx(g, 0.32, 0.04, 0.32, wood(), 0, 0.28, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.035, 0.28, 0.035, wood(), sx * 0.12, 0, sz * 0.12); return g }
export function charpai() { const g = new THREE.Group(), m = wood(), rope = S({ map: tex.cloth('#6a5a3a', '#b8a070', 'check') }); bx(g, 1.0, 0.04, 1.9, m, 0, 0.38, 0); bx(g, 0.9, 0.02, 1.8, rope, 0, 0.4, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.07, 0.4, 0.07, m, sx * 0.47, 0, sz * 0.92); return g }
export function bed() {
  const g = new THREE.Group()
  bx(g, 1.5, 0.35, 2.0, wood(), 0, 0, 0)
  bx(g, 1.6, 0.7, 0.1, wood(), 0, 0.35, -1.02) // headboard
  // ONE fitted bedsheet over the whole mattress, with gentle wrinkles. Real
  // beds do not have two different patterns spliced down the middle.
  const sh = new THREE.PlaneGeometry(1.42, 1.92, 12, 18)
  const p = sh.attributes.position
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.016 * Math.sin(p.getX(i) * 9 + p.getY(i) * 3) + 0.01 * Math.sin(p.getY(i) * 11))
  sh.computeVertexNormals()
  const sheet = new THREE.Mesh(sh, S({ map: tex.cloth('#dfe4e8', '#b7c9d8', 'check'), side: THREE.DoubleSide }))
  sheet.rotation.x = -Math.PI / 2; sheet.position.y = 0.455; g.add(sheet)
  // A single folded blanket at the FOOT only — same colour family, clearly a
  // folded layer on top of the sheet, not a second bedsheet.
  const fold = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.42, 6, 4), S({ map: tex.cloth('#b7c9d8', '#e8eef2', 'stripe'), side: THREE.DoubleSide }))
  fold.rotation.x = -Math.PI / 2; fold.position.set(0, 0.472, 0.74); g.add(fold)
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 8), S({ color: '#c3d2de' }))
  lip.rotation.z = Math.PI / 2; lip.position.set(0, 0.485, 0.53); g.add(lip)
  // pillow: squashed sphere with a seam
  const pillow = sph(g, 0.25, S({ color: '#e8e0d0', roughness: 1 }), 0, 0.6, -0.75, 1.45, 0.32, 0.9)
  pillow.castShadow = true
  return g
}
export function fan(L, parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), S({ color: '#ddd' })); g.add(hub); const blades = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.13), S({ color: '#e8e4d8' })); b.position.x = 0.38; const p = new THREE.Group(); p.rotation.y = i * 2.094; p.add(b); blades.add(p) } g.add(blades); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 6), S({ color: '#444' })); rod.position.y = 0.15; g.add(rod); parent.add(g); L.updaters.push((dt) => { blades.rotation.y += dt * 9 }); return g }
export function tubeLight(L, parent, x, y, z, ry = 0) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.06), new THREE.MeshBasicMaterial({ color: '#f4f7ff' })); g.add(m); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g }
export function tvSet(on = false) { const g = new THREE.Group(); bx(g, 1.3, 0.55, 0.06, S({ color: '#111' }), 0, 0.0, 0); const scr = bx(g, 1.22, 0.47, 0.01, new THREE.MeshBasicMaterial({ color: on ? '#587a96' : '#080a0c' }), 0, 0.04, 0.035); g.userData.screen = scr; return g }
export function shelf() { const g = new THREE.Group(), m = wood(); bx(g, 1.1, 1.7, 0.35, m, 0, 0, 0); for (let i = 0; i < 4; i++) bx(g, 1.0, 0.03, 0.3, S({ color: '#2a1a10' }), 0, 0.28 + i * 0.4, 0.03); const cols = ['#9a3a2a', '#2a5a7a', '#c0a030', '#3a6a3a']; for (let i = 0; i < 12; i++) bx(g, 0.07, 0.25, 0.2, S({ color: cols[i % 4] }), -0.42 + (i % 6) * 0.14, 0.31 + Math.floor(i / 6) * 0.4, 0.14); return g }
export function matka() { const g = new THREE.Group(), m = S({ color: '#a8552e', roughness: 1 }); sph(g, 0.22, m, 0, 0.24, 0, 1, 1.05, 1); cyl(g, 0.12, 0.17, 0.12, m, 0, 0.42, 0); return g }
export function brassVessel(s = 1) { const g = new THREE.Group(), m = S({ color: '#c8a038', metalness: 0.85, roughness: 0.3 }); cyl(g, 0.1 * s, 0.14 * s, 0.2 * s, m, 0, 0, 0); cyl(g, 0.12 * s, 0.1 * s, 0.05 * s, m, 0, 0.2 * s, 0); return g }
export function chulha() {
  const g = new THREE.Group(), m = S({ map: tex.mudwall() })
  bx(g, 0.7, 0.28, 0.5, m, 0, 0, 0)
  bx(g, 0.5, 0.06, 0.04, S({ color: '#111' }), 0, 0.28, 0)
  const em = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: '#ff6a20' }))
  em.position.set(0, 0.14, 0.255); g.add(em)
  // small live flames instead of a flat orange sticker
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.035 - i * 0.005, 0.14 - i * 0.02, 6),
      new THREE.MeshBasicMaterial({ color: i < 2 ? '#ff7a1c' : '#ffd06a', transparent: true, opacity: 0.9 }))
    f.position.set((i - 1.5) * 0.03, 0.16, 0.26); f.userData.phase = i * 1.7
    f.onBeforeRender = () => { const t = performance.now() * 0.005; f.scale.setScalar(0.85 + 0.15 * Math.sin(t + f.userData.phase)) }
    g.add(f)
  }
  const glow = new THREE.PointLight('#ff9a46', 2.2, 3.2); glow.position.set(0, 0.3, 0.18); g.add(glow)
  const pot = brassVessel(1.3); pot.position.set(0, 0.3, 0); g.add(pot)
  return g
}
export function garlandedPhoto() { const g = new THREE.Group(); const fr = bx(g, 0.36, 0.46, 0.03, S({ color: '#2a1a10' }), 0, 0, 0); const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), new THREE.MeshStandardMaterial({ map: tex.photoWoman(), roughness: 0.6 })); ph.position.set(0, 0.23, 0.02); g.add(ph); const gar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 6, 14, Math.PI), S({ color: '#e08a1a' })); gar.position.set(0, 0.34, 0.03); gar.rotation.z = Math.PI; g.add(gar); return g }
export function pole(L, x, z, h = 8) { const g = new THREE.Group(); cyl(g, 0.1, 0.14, h, S({ map: tex.cement() }), 0, 0, 0, 8); bx(g, 1.6, 0.08, 0.08, S({ color: '#333' }), 0, h - 0.4, 0); g.position.set(x, 0, z); L.add(g); return g }
export function wires(L, a, b, sag = 0.5) { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag, a.z + (b.z - a.z) * t)) } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#111' })); L.add(l) }
export function streetLight(L, x, z, on = true) { const g = new THREE.Group(); cyl(g, 0.05, 0.08, 6, S({ color: '#444', metalness: 0.5 }), 0, 0, 0, 8); bx(g, 1.2, 0.06, 0.06, S({ color: '#444' }), 0.5, 6, 0); const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.2), new THREE.MeshBasicMaterial({ color: on ? '#fff0c0' : '#555' })); lamp.position.set(1.0, 5.95, 0); g.add(lamp); g.position.set(x, 0, z); L.add(g); if (on) { const p = new THREE.PointLight('#ffe0a0', 14, 22, 1.5); p.position.set(x + 1, 5.6, z); L.add(p); L.lights.push(p) } return g }
export function autoRickshaw() { const g = new THREE.Group(), y = S({ color: '#d8b020', roughness: 0.5 }), k = S({ color: '#1a1a1a' }); bx(g, 1.3, 0.7, 2.0, y, 0, 0.35, -0.2); bx(g, 1.3, 0.1, 1.4, k, 0, 1.45, -0.55); bx(g, 0.05, 0.8, 0.05, k, -0.6, 0.7, 0.2); bx(g, 0.05, 0.8, 0.05, k, 0.6, 0.7, 0.2); bx(g, 0.04, 0.5, 0.8, k, -0.62, 0.9, -0.8); bx(g, 0.04, 0.5, 0.8, k, 0.62, 0.9, -0.8); bx(g, 1.2, 0.1, 0.7, S({ color: '#0e2a14' }), 0, 0.6, -0.8); bx(g, 0.5, 0.5, 0.7, y, 0, 0.5, 1.0); for (const [x, z] of [[-0.55, -0.9], [0.55, -0.9], [0, 1.2]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 14), k); w.rotation.z = Math.PI / 2; w.position.set(x, 0.22, z); g.add(w) } return g }
export function cow() {
  // Indian zebu-style cow: long face, hump, dewlap, horns, drooping ears, patched hide, thin legs, tail
  const g = new THREE.Group(), m = S({ color: '#d9cdb4', roughness: 1 }), sp = S({ color: '#6e4c30', roughness: 1 }), dk = S({ color: '#2a211a', roughness: 1 }), pink = S({ color: '#b98c80', roughness: 1 })
  sph(g, 0.48, m, 0, 1.05, 0, 0.95, 0.85, 1.75)                       // barrel
  sph(g, 0.4, m, 0, 1.08, -0.62, 0.95, 0.95, 0.95)                    // hindquarters
  sph(g, 0.34, m, 0, 1.12, 0.62, 0.95, 1.0, 1.0)                      // chest
  sph(g, 0.2, m, 0, 1.52, 0.5, 0.85, 1.0, 1.25)                       // hump
  sph(g, 0.16, m, 0, 0.78, 0.78, 0.7, 1.4, 1.0)                       // dewlap
  const neck = cyl(g, 0.17, 0.2, 0.55, m, 0, 1.0, 0.98, 10); neck.rotation.x = -0.9
  const head = sph(g, 0.17, m, 0, 1.18, 1.3, 0.85, 0.95, 1.45)       // head
  sph(g, 0.1, pink, 0, 1.08, 1.5, 1.0, 0.85, 0.9)                     // muzzle
  for (const s of [-1, 1]) {
    sph(g, 0.05, dk, s * 0.1, 1.2, 1.5, 1, 1, 0.6)                    // eyes/nostril marks
    const ear = sph(g, 0.07, m, s * 0.2, 1.3, 1.2, 0.35, 0.8, 1.5); ear.rotation.z = s * 0.5
    const horn = cyl(g, 0.012, 0.035, 0.26, S({ color: '#e6dcc4' }), s * 0.12, 1.36, 1.2, 6); horn.rotation.z = s * 0.9
  }
  sph(g, 0.3, sp, 0.28, 1.15, -0.25, 0.45, 0.95, 1.2)                 // hide patches
  sph(g, 0.26, sp, -0.3, 1.2, 0.3, 0.4, 0.9, 1.0)
  for (const [x, z] of [[-0.24, -0.58], [0.24, -0.58], [-0.22, 0.58], [0.22, 0.58]]) { cyl(g, 0.065, 0.045, 0.8, m, x, 0.06, z, 8); cyl(g, 0.05, 0.05, 0.1, dk, x, 0, z, 8) }
  const tail = cyl(g, 0.018, 0.012, 0.85, m, 0, 0.65, -1.0, 5); tail.rotation.x = 0.12; sph(g, 0.06, dk, 0, 0.22, -1.03, 0.8, 1.4, 0.8)
  g.traverse(o => { if (o.isMesh) { o.castShadow = true } })
  return g
}
export function dogModel() { const g = new THREE.Group(), m = S({ color: '#8a6a3a' }); sph(g, 0.2, m, 0, 0.42, 0, 0.9, 0.8, 1.9); sph(g, 0.12, m, 0, 0.55, 0.42); for (const [x, z] of [[-0.1, -0.2], [0.1, -0.2], [-0.1, 0.2], [0.1, 0.2]]) cyl(g, 0.03, 0.025, 0.3, m, x, 0, z, 5); return g }
export function truck() {
  const g = new THREE.Group(), body = S({ color: '#c94a1a', roughness: 0.5 }), blue = S({ color: '#1f5fa8' }), k = S({ color: '#161616' })
  bx(g, 2.4, 1.7, 2.0, body, 0, 0.7, 3.4); bx(g, 2.4, 0.9, 0.1, new THREE.MeshBasicMaterial({ color: '#202830' }), 0, 1.4, 4.42)
  bx(g, 2.5, 0.25, 6.4, blue, 0, 0.7, -1.2); bx(g, 2.5, 1.6, 0.14, S({ map: tex.cloth('#d8a020', '#a02818', 'stripe') }), 0, 0.95, -4.45); bx(g, 0.14, 1.6, 6.4, S({ map: tex.cloth('#d8a020', '#a02818', 'stripe') }), 1.2, 0.95, -1.2); bx(g, 0.14, 1.6, 6.4, S({ map: tex.cloth('#d8a020', '#a02818', 'stripe') }), -1.2, 0.95, -1.2)
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: tex.sign('HORN OK PLEASE', '#f2d640', '#a01010', 512, 128, '800 60px Inter, sans-serif') })); pl.position.set(0, 1.7, -4.53); pl.rotation.y = Math.PI; g.add(pl)
  for (const z of [3.2, -0.5, -2.2, -3.8]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), k); w.rotation.z = Math.PI / 2; w.position.set(s * 1.1, 0.5, z); g.add(w) }
  const hl = new THREE.PointLight('#fff0c0', 20, 40, 1.4); hl.position.set(0, 1, 4.9); g.add(hl); g.userData.light = hl; for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshBasicMaterial({ color: '#fff6d8' })); l.position.set(s * 0.8, 0.75, 4.43); g.add(l) }
  const sp = new THREE.SpotLight('#fff0c0', 120, 70, 0.5, 0.6, 1.2); sp.position.set(0, 1, 4.9); const tg = new THREE.Object3D(); tg.position.set(0, 0.5, 20); g.add(sp, tg); sp.target = tg; g.userData.spot = sp
  g.traverse(o => o.isMesh && (o.castShadow = false)); return g
}
export function teaStall() {
  const g = new THREE.Group(), w = S({ map: tex.wood('#5a3f28') }), tin = S({ map: tex.tin(), side: THREE.DoubleSide })
  bx(g, 3.2, 0.9, 1.2, w, 0, 0, 0); bx(g, 3.4, 0.06, 1.6, w, 0, 0.9, 0.1)
  for (const x of [-1.6, 1.6]) bx(g, 0.1, 2.4, 0.1, w, x, 0, 0.7); const roof = bx(g, 3.8, 0.06, 2.2, tin, 0, 2.4, 0.2); roof.rotation.x = 0.12
  const kettle = cyl(g, 0.17, 0.22, 0.3, S({ color: '#bfc3c8', metalness: 0.9, roughness: 0.3 }), -0.8, 0.96, 0, 14); const stove = cyl(g, 0.22, 0.25, 0.14, S({ color: '#222' }), -0.8, 0.9, 0, 12)
  const jars = ['#d84a2a', '#e8c040', '#3a8a5a']; for (let i = 0; i < 3; i++) cyl(g, 0.1, 0.1, 0.22, S({ color: jars[i], transparent: true, opacity: 0.85 }), 0.3 + i * 0.35, 0.96, 0.05, 10)
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshBasicMaterial({ map: tex.sign('चाय', '#d8c07a', '#7a1010', 256, 96, '700 58px "Noto Sans Devanagari", sans-serif') })); sg.position.set(0, 2.1, 1.18); g.add(sg)
  return g
}
export function marigoldGarland(len = 1) { const g = new THREE.Group(); for (let i = 0; i < 14; i++) sph(g, 0.045, S({ color: i % 3 ? '#e8921a' : '#f2b82a' }), (i / 13 - 0.5) * len, -Math.sin((i / 13) * Math.PI) * 0.08, 0); return g }
export function diya(L, x, y, z, parent) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.02, 10), S({ color: '#a8552e' })); g.add(b); const f = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffb040' })); f.position.y = 0.025; f.scale.y = 1.8; g.add(f); g.position.set(x, y, z); (parent || L.group).add(g); const l = new THREE.PointLight('#ff9a40', 0, 6, 1.8); l.position.set(x, y + 0.1, z); (parent || L.group).add(l); L.flick.push({ light: l, base: 1.6, sp: 9, ph: R.range(0, 6) }); return g }

// shamshan pieces
export function samadhi(kind = 0, garland = false) {
  const g = new THREE.Group(), st = S({ map: tex.stone('#a8a496') }), wh = S({ map: tex.plaster('#cfc9b8') })
  bx(g, 1.9, 0.18, 1.2, st, 0, 0, 0)
  if (kind === 0) { bx(g, 1.6, 0.45, 0.9, wh, 0, 0.18, 0); bx(g, 1.2, 0.16, 0.6, wh, 0, 0.63, 0) }
  else if (kind === 1) { bx(g, 1.5, 0.3, 0.8, wh, 0, 0.18, 0); const d = sph(g, 0.4, wh, 0, 0.5, 0, 1, 0.8, 0.8) }
  else { bx(g, 0.8, 0.9, 0.8, wh, 0, 0.18, 0); bx(g, 1.0, 0.1, 1.0, st, 0, 1.08, 0); const t = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.45, 4), wh); t.position.y = 1.4; t.rotation.y = Math.PI / 4; g.add(t) }
  if (garland) { const m = marigoldGarland(1.3); m.position.set(0, 0.7, 0.46); g.add(m) }
  const moss = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ color: '#1a3a14', transparent: true, opacity: 0.3 })); moss.position.set(0, 0.35, 0.47); g.add(moss)
  return g
}
export function cremationShed() {
  const g = new THREE.Group(), tin = S({ map: tex.tin(), side: THREE.DoubleSide }), br = S({ map: tex.brick() }), st = S({ color: '#4a4a48', metalness: 0.5 })
  bx(g, 4.2, 0.5, 2.6, br, 0, 0, 0); bx(g, 3.6, 0.04, 2.0, S({ map: tex.ash() }), 0, 0.5, 0)
  for (const x of [-2, 2]) for (const z of [-1.3, 1.3]) bx(g, 0.14, 3.2, 0.14, st, x, 0, z)
  const r = bx(g, 4.8, 0.06, 3.2, tin, 0, 3.2, 0); r.rotation.z = 0.06
  for (let i = -1; i <= 1; i++) bx(g, 0.05, 0.05, 2.0, S({ color: '#222', metalness: 0.7 }), i * 1.0, 0.56, 0)
  return g
}
export function gateway(text = 'मुक्तिधाम') { const g = new THREE.Group(), w = S({ map: tex.plaster('#c8b690') }); bx(g, 0.7, 3.2, 0.7, w, -2.2, 0, 0); bx(g, 0.7, 3.2, 0.7, w, 2.2, 0, 0); bx(g, 5.6, 0.7, 0.6, w, 0, 3.2, 0); const s = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.55), new THREE.MeshBasicMaterial({ map: tex.sign(text, '#1c3a6a', '#f4e8c0', 512, 96, '700 60px "Noto Sans Devanagari", sans-serif') })); s.position.set(0, 3.55, 0.31); g.add(s); const s2 = s.clone(); s2.position.z = -0.31; s2.rotation.y = Math.PI; g.add(s2); return g }
export function waterTank() { const g = new THREE.Group(); cyl(g, 0.6, 0.6, 1.0, S({ color: '#1c3a6a' }), 0, 2.2, 0, 14); for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) bx(g, 0.08, 2.2, 0.08, S({ color: '#555' }), x, 0, z); return g }
export function stoneMarker() { const g = new THREE.Group(); bx(g, 0.3, 0.7, 0.2, S({ map: tex.stone('#8c8a80') }), 0, 0, 0); return g }
export function signboard(text, bg = '#1f5a34', fg = '#f2f0e0', w = 2.2, h = 1.0) { const g = new THREE.Group(); cyl(g, 0.04, 0.04, 2.2, S({ color: '#555' }), -w / 2 + 0.2, 0, 0, 6); cyl(g, 0.04, 0.04, 2.2, S({ color: '#555' }), w / 2 - 0.2, 0, 0, 6); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex.sign(text, bg, fg, 512, Math.round(512 * h / w), '700 44px "Noto Sans Devanagari", Inter, sans-serif'), roughness: 0.8 })); s.position.set(0, 1.9, 0.05); g.add(s); return g }
export function bush(s = 1) { const g = new THREE.Group(), m = S({ map: tex.leaf() }); for (let i = 0; i < 4; i++) sph(g, 0.4 * s, m, R.range(-0.4, 0.4) * s, 0.35 * s, R.range(-0.4, 0.4) * s, 1, 0.8, 1); return g }
export function can() { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12), new THREE.MeshStandardMaterial({ color: '#c0161c', metalness: 0.8, roughness: 0.3 })); g.add(m); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.01, 12), new THREE.MeshStandardMaterial({ color: '#ccc', metalness: 0.9, roughness: 0.3 })); t.position.y = 0.06; g.add(t); return g }
export function ball() { const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshStandardMaterial({ map: tex.cloth('#e8e8e0', '#2a60b0', 'print'), roughness: 0.6 })); m.castShadow = true; return m }
export function helmetRack() { const g = new THREE.Group(); bx(g, 0.6, 0.05, 0.2, wood(), 0, 1.4, 0); g.userData.helmets = []; g.userData.helmetRack = true; for (const x of [-0.18, 0.18]) { const h = sph(g, 0.14, S({ color: x < 0 ? '#c02020' : '#202020', roughness: 0.3, metalness: 0.2 }), x, 1.55, 0.02, 1, 0.9, 1.1); g.userData.helmets.push(h) } return g }
export function ropeBridgeless() { return new THREE.Group() }

// ---------- vehicles (forward = +z) ----------
export function motorbike(color = '#a31d1d', riding = false) {
  const g = new THREE.Group(), body = S({ color, roughness: 0.35, metalness: 0.4 }), dark = S({ color: '#141414', roughness: 0.8 }), chrome = S({ color: '#b8bcc0', metalness: 0.9, roughness: 0.25 })
  const lean = new THREE.Group(); g.add(lean)
  for (const z of [-0.62, 0.62]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.07, 8, 18), dark); w.rotation.y = Math.PI / 2; w.position.set(0, 0.36, z); lean.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 10), chrome); hub.rotation.z = Math.PI / 2; hub.position.set(0, 0.36, z); lean.add(hub) }
  bx(lean, 0.16, 0.12, 1.1, dark, 0, 0.42, 0)                       // frame
  bx(lean, 0.22, 0.26, 0.5, body, 0, 0.7, 0.2)                      // tank
  bx(lean, 0.2, 0.08, 0.6, S({ color: '#1a1a1a' }), 0, 0.8, -0.35)  // seat
  bx(lean, 0.18, 0.3, 0.2, dark, 0, 0.35, 0)                         // engine block
  const fork = bx(lean, 0.05, 0.62, 0.05, chrome, 0, 0.36, 0.62); fork.rotation.x = -0.25
  bx(lean, 0.6, 0.03, 0.03, chrome, 0, 1.02, 0.5)                    // handlebar
  const hl = sph(lean, 0.075, new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffe9b0', emissiveIntensity: 0.4 }), 0, 0.95, 0.66)
  const pipe = bx(lean, 0.07, 0.07, 0.8, chrome, 0.16, 0.3, -0.25)
  g.userData.lean = lean; g.userData.headMesh = hl
  if (!riding) { lean.rotation.z = 0.16; lean.position.x = 0.1 }  // resting on its side stand
  return g
}
export function carModel(color = '#c8c8c8') {
  const g = new THREE.Group(), body = S({ color, roughness: 0.3, metalness: 0.5 }), glass = new THREE.MeshStandardMaterial({ color: '#0e1318', roughness: 0.1, metalness: 0.6 }), dark = S({ color: '#111' })
  bx(g, 1.7, 0.55, 3.9, body, 0, 0.35, 0); bx(g, 1.5, 0.5, 2.0, glass, 0, 0.9, -0.2); bx(g, 1.46, 0.06, 1.9, body, 0, 1.4, -0.2)
  for (const x of [-0.8, 0.8]) for (const z of [-1.25, 1.25]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.33, z); g.add(w) }
  for (const x of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: '#fff3c8' })); h.position.set(x, 0.65, 1.96); g.add(h); const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: '#b01010' })); t.position.set(x, 0.65, -1.96); g.add(t) }
  return g
}

// a plank with a nail: the scooter key hangs here (items.js handles taking it / hanging it back)
export function keyHook() {
  const g = new THREE.Group(), wd = new THREE.MeshStandardMaterial({ color: '#5a3d22', roughness: 1 }), iron = new THREE.MeshStandardMaterial({ color: '#8a8d92', metalness: 0.8, roughness: 0.4 })
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.02), wd); g.add(plank)
  const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), iron); nail.rotation.x = Math.PI / 2; nail.position.set(0, 0, 0.045); g.add(nail)
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 8), iron); head.rotation.x = Math.PI / 2; head.position.set(0, 0, 0.08); g.add(head)
  const key = new THREE.Group(); key.position.set(0, 0, 0.06)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 6, 12), iron); ring.position.y = 0.0; key.add(ring)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.004), iron); blade.position.y = -0.05; key.add(blade)
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: '#c0161c', roughness: 0.6 })); bow.position.y = -0.095; key.add(bow)
  g.add(key); g.userData.hook = true; g.userData.keyMesh = key
  return g
}
