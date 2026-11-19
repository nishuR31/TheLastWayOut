// Lightweight but proper human rig: a real joint hierarchy (hips → spine → chest →
// neck → head; shoulders → arms → hands; legs → feet), anatomically tapered meshes
// and damped walk/idle animation. Geometry and materials are cached so a crowd is cheap.
//
// Every rig carries its own LOD tiers:
//   2 NEAR  — full skeleton + all fine detail (face, fingers, hair, clothing)
//   1 MID   — skeleton animates, fine detail hidden (still reads as a person)
//   0 FAR   — a 3-mesh silhouette proxy, no skeletal animation at all
// The world LOD manager switches tiers by distance; only near rigs cost draw calls.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { tex, withPBR, fabricNormal } from './textures.js'
import { OUTFITS } from './people.js'

// Adapt an old OUTFITS preset (used by the actor/character-select layers) to the new rig.
export function humanFromOutfit(key, over = {}) {
  const base = OUTFITS[key] || OUTFITS.nishan
  const face = base.face || {}
  const age = base.h < 1.4 ? 'child' : base.age === 2 ? 'elder' : 'adult'
  return buildHuman({
    ...base,
    moustache: face.stache,
    beard: face.beard,
    browColor: face.brow,
    bindi: face.bindi,
    age,
    ...over
  })
}

const _geo = new Map(), _mat = new Map(), _face = new Map()
const capGeo = (r, len) => {
  const k = 'c' + r.toFixed(3) + '_' + len.toFixed(3)
  if (!_geo.has(k)) _geo.set(k, new THREE.CapsuleGeometry(r, Math.max(0.001, len), 3, 8))
  return _geo.get(k)
}
const boxGeo = (w, h, d) => {
  const k = 'b' + w.toFixed(3) + '_' + h.toFixed(3) + '_' + d.toFixed(3)
  if (!_geo.has(k)) _geo.set(k, new THREE.BoxGeometry(w, h, d))
  return _geo.get(k)
}
const sphereGeo = (r) => {
  const k = 's' + r.toFixed(3)
  if (!_geo.has(k)) _geo.set(k, new THREE.SphereGeometry(r, 12, 9))
  return _geo.get(k)
}
// painted face texture (the old rig's approach — a face drawn on the sphere reads far
// better than a handful of geometric bumps buried inside the head). Cached per face.
const faceMaterial = (o, skin) => {
  skin = skin || o.skin || '#8f5c3d'
  const key = [skin, !!o.female, o.moustache, o.beard, o.bindi, o.browColor, o.age, o.flat].join('|')
  if (!_face.has(key)) {
    let t = null
    if (typeof document !== 'undefined') {
      try { t = tex.face({ skin, male: !o.female, stache: o.moustache, beard: o.beard, bindi: o.bindi, brow: o.browColor || '#1c120c', age: o.age === 'elder' ? 2 : 0, flat: o.flat }) } catch (e) { t = null }
    }
    _face.set(key, material(t ? '#ffffff' : skin, t ? { map: t } : {}))
  }
  return _face.get(key)
}
const partialSphereGeo = (r, theta) => {
  const k = 'ps' + r.toFixed(3) + '_' + theta.toFixed(3)
  if (!_geo.has(k)) _geo.set(k, new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, Math.PI * theta))
  return _geo.get(k)
}
const material = (color, opts = {}) => {
  const parts = []
  for (const k in opts) { const v = opts[k]; parts.push(k + ':' + (v && v.uuid ? v.uuid : String(v))) }
  const key = 'm' + color + '|' + parts.join('|')
  if (!_mat.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...opts })
    _mat.set(key, withPBR(m))
  }
  return _mat.get(key)
}
// the painted face needs enough segments to read cleanly
const headSphereGeo = (r) => {
  const k = 'hs' + r.toFixed(3)
  if (!_geo.has(k)) _geo.set(k, new THREE.SphereGeometry(r, 22, 16))
  return _geo.get(k)
}
const mesh = (parent, geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m
}
const joint = (parent, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g
}

// A rig is built from ~70 tiny meshes. Most of them are sibling detail on the
// same joint sharing one material (fingers, buttons, pockets, braids, ...).
// Collapse each such group into a single geometry: joints still animate
// independently, materials stay identical, and one draw call replaces many.
// LOD tiers are preserved — a group becomes CORE if any member was CORE, so
// sub-pixel detail simply becomes visible a little earlier instead of costing
// an extra tier. `keep` holds meshes that must stay separate (the animated
// mouth), which stay in their original tier.
function collapseJointDetail(core, hi, keep) {
  const tier = new Map()
  core.forEach(m => tier.set(m, 'core'))
  hi.forEach(m => tier.set(m, 'hi'))
  const parents = new Set()
  for (const m of core) parents.add(m.parent)
  for (const m of hi) parents.add(m.parent)
  const mergedCore = [], mergedHi = []
  for (const parent of parents) {
    const groups = new Map()
    for (const m of parent.children) {
      if (!m.isMesh || keep.has(m) || !tier.has(m)) continue
      let list = groups.get(m.material)
      if (!list) groups.set(m.material, list = [])
      list.push(m)
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue
      const parts = []
      for (const m of list) {
        m.updateMatrix()
        const g = m.geometry.clone(); g.applyMatrix4(m.matrix); parts.push(g)
      }
      const geo = mergeGeometries(parts, false)
      parts.forEach(g => g.dispose())
      if (!geo) continue
      const mesh = new THREE.Mesh(geo, list[0].material)
      mesh.castShadow = list.some(m => m.castShadow)
      mesh.receiveShadow = list.some(m => m.receiveShadow)
      mesh.renderOrder = Math.max(...list.map(m => m.renderOrder))
      parent.add(mesh)
      for (const m of list) {
        parent.remove(m)
        const bucket = tier.get(m) === 'core' ? core : hi
        bucket.splice(bucket.indexOf(m), 1)
      }
      ;(list.some(m => tier.get(m) === 'core') ? mergedCore : mergedHi).push(mesh)
    }
  }
  const restCore = core.slice(), restHi = hi.slice()
  core.length = 0; hi.length = 0
  restCore.forEach(m => core.push(m))
  restHi.forEach(m => hi.push(m))
  mergedCore.forEach(m => core.push(m))
  mergedHi.forEach(m => hi.push(m))
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const damp = (a, b, l, dt) => a + (b - a) * Math.min(1, l * dt)
const pick = (a) => a[Math.floor(Math.random() * a.length)]

const SKIN = ['#8d5b3b', '#a46d49', '#9a6544', '#7a4a30', '#b07c55', '#6f462b', '#c08a63']
const TOPS = [
  ['#27424a', '#8aa0a6', 'check'], ['#b5532a', '#d9a06a', 'stripe'], ['#3a5a3a', '#9aa87a', 'check'],
  ['#6a3a5a', '#b090a0', 'stripe'], ['#4a4a52', '#9a9aa0', 'check'], ['#c9a227', '#8a5a20', 'plain'],
  ['#e8e0cc', '#e8e0cc', 'plain'], ['#8b1d2c', '#e0b13a', 'print']
]
const BOTTOMS = ['#2a3f66', '#6d6347', '#333333', '#4a3a2a', '#e6dfcb']

export function buildHuman(o = {}) {
  const age = o.age || 'adult'
  const h = o.h || ({ child: 1.15, teen: 1.55, adult: 1.72, elder: 1.63 }[age] || 1.7)
  const s = h / 1.72
  const fat = o.fat || (age === 'elder' ? 1.05 : 1)
  let skin = o.skin || pick(SKIN)
  const female = !!o.female
  let top = o.top || pick(TOPS), bottom = o.bottom || pick(BOTTOMS)
  let hairColor = o.hair || (age === 'elder' ? '#c9c4b8' : pick(['#14100d', '#1d1712', '#3a2418', '#6b4a2a']))
  const style = o.hairStyle || (female ? 'bun' : age === 'elder' ? 'thin' : 'short')
  const simple = !!o.simple // permanently-lite crowd (used only when explicitly asked)
  let hairCap = null

  if (o.flat) { skin = '#050505'; bottom = '#050505'; hairColor = '#000000'; top = ['#050505', '#050505', 'plain'] }
  const fn = o.flat ? null : fabricNormal(5, 4)
  const clothOpts = fn ? { normalMap: fn, normalScale: new THREE.Vector2(0.85, 0.85), roughness: 0.95 } : { roughness: 0.95 }
  const skinM = material(skin, { roughness: 0.72 })
  const shoeM = material(o.flat ? '#050505' : (o.shoes || '#2a2018'), { roughness: 0.7 })
  const hairM = material(hairColor, { roughness: 0.6 })
  const shirtM = (!o.flat && top[2] !== 'plain')
    ? material('#ffffff', { ...clothOpts, map: tex.cloth(top[0], top[1], top[2]) })
    : material(top[0], clothOpts)
  const pantM = material(bottom, clothOpts)
  const trimM = material(o.flat ? '#050505' : '#1d1a17', { roughness: 0.8 })

  const coreMeshes = [], hiMeshes = []
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, tier = 'core') => {
    const m = mesh(parent, geo, mat, x, y, z)
    ;(tier === 'hi' ? hiMeshes : coreMeshes).push(m)
    return m
  }

  const root = new THREE.Group(), body = joint(root)
  const legL = 0.88 * s, torsoL = 0.56 * s, neckLen = 0.07 * s
  const hips = joint(body, 0, legL)

  // pelvis: a short flattened taper — not a ball, so the trousers never read as a bulge
  const pelvis = add(hips, new THREE.CylinderGeometry(0.148 * s, 0.164 * s, 0.2 * s, 12), pantM, 0, -0.02 * s)
  pelvis.scale.z = 0.74

  // torso: one tapered oval (broad shoulders, narrow waist) instead of stacked capsules
  const spine = joint(hips), chest = joint(spine)
  const torsoMesh = add(chest, new THREE.CylinderGeometry(0.19 * s * fat, 0.148 * s * fat, torsoL, 14), shirtM, 0, torsoL / 2)
  torsoMesh.scale.z = 0.66
  for (const side of [-1, 1]) add(chest, sphereGeo(0.062 * s), shirtM, side * 0.18 * s * fat, torsoL * 0.86, 0, 'hi').scale.set(1, 0.9, 0.9)

  // neck + head (painted face on the sphere, like the original rig)
  const neck = joint(chest, 0, torsoL)
  add(neck, new THREE.CylinderGeometry(0.045 * s, 0.055 * s, neckLen + 0.05 * s, 8), skinM, 0, neckLen / 2)
  const head = joint(neck, 0, neckLen)
  const headR = 0.112 * s
  const headMesh = add(head, headSphereGeo(headR), faceMaterial(o, skin), 0, headR * 1.05)
  headMesh.scale.set(0.95, 1.15, 1.0)
  for (const side of [-1, 1]) add(head, sphereGeo(headR * 0.2), skinM, side * headR * 0.88, headR * 1.05, -0.005, 'hi')
  add(head, sphereGeo(headR * 0.16), skinM, 0, headR * 0.98, headR * 0.98, 'hi').scale.set(0.8, 1.1, 1.0)
  // speaking mouth (a thin line that opens from the voice clip level)
  const mouthMesh = add(head, new THREE.CircleGeometry(headR * 0.14, 14), new THREE.MeshBasicMaterial({ color: '#2a0c09' }), 0, headR * 0.4, headR * 0.843, 'hi')
  mouthMesh.rotation.x = 0.55; mouthMesh.scale.set(1, 0.001, 1); mouthMesh.visible = false

  // hair: a partial sphere that wraps the crown (the old full sphere hid inside the skull)
  if (style !== 'bald') {
    if (style === 'turban') {
      add(head, partialSphereGeo(headR * 1.18, 0.62), material(o.turban || '#c4572a'), 0, headR * 1.12, -headR * 0.06).scale.set(0.99, 1.05, 1.08)
    } else {
      const cap = add(head, partialSphereGeo(headR * (style === 'thin' ? 1.02 : 1.07), style === 'thin' ? 0.42 : 0.52), hairM, 0, headR * 1.12, -headR * 0.1)
      cap.scale.set(0.99, 1.12, 1.08); hairCap = cap; cap.userData.sway = 1
      if (style === 'bun') add(head, sphereGeo(headR * 0.5), hairM, 0, headR * 1.2, -headR * 1.0, 'hi')
      if (style === 'braids') for (const side of [-1, 1]) for (let i = 0; i < 5; i++) add(head, sphereGeo(0.03 * s), hairM, side * 0.07 * s, headR * 0.7 - i * 0.07 * s, -headR * 0.9 - i * 0.012, 'hi')
      if (style === 'short') add(head, new THREE.BoxGeometry(headR * 0.7, headR * 0.16, headR * 0.12), hairM, 0, headR * 1.55, headR * 0.82, 'hi').rotation.x = -0.25 // fringe
    }
  }
  if (o.cap) add(head, partialSphereGeo(headR * 1.1, 0.5), material(o.cap), 0, headR * 1.16, -headR * 0.05, 'hi').scale.set(1.02, 0.75, 1.05)
  if (o.glasses) for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.28, 0.006, 6, 14), material('#111', { metalness: 0.6, roughness: 0.4 }))
    rim.position.set(side * headR * 0.34, headR * 1.12, headR * 0.93); head.add(rim); hiMeshes.push(rim)
  }

  // arms: shoulder ball → upper sleeve → forearm → hand
  const upperLen = 0.29 * s, foreLen = 0.27 * s, armR = 0.043 * s
  const arms = []
  for (const side of [-1, 1]) {
    const shoulderW = 0.19 * s * fat + 0.018 * s
    const shoulder = joint(chest, side * shoulderW, torsoL * 0.87)
    add(shoulder, sphereGeo(0.053 * s), shirtM)
    add(shoulder, capGeo(armR, upperLen - 2 * armR), shirtM, 0, -upperLen / 2)
    const elbow = joint(shoulder, 0, -upperLen)
    add(elbow, sphereGeo(armR * 0.9), skinM, 0, 0, 0, 'hi')
    add(elbow, capGeo(armR * 0.84, foreLen - 2 * armR * 0.84), skinM, 0, -foreLen / 2)
    const wrist = joint(elbow, 0, -foreLen)
    const hand = add(wrist, sphereGeo(0.045 * s), skinM, 0, -0.02 * s)
    hand.scale.set(0.9, 1.25, 0.6)
    if (simple) add(wrist, boxGeo(0.07 * s, 0.08 * s, 0.035 * s), skinM, 0, -0.07 * s, 0.005 * s, 'hi')
    else {
      for (let f = 0; f < 4; f++) add(wrist, capGeo(0.011 * s, 0.075 * s), skinM, (f - 1.5) * 0.024 * s, -0.075 * s, 0.005 * s, 'hi')
      add(wrist, capGeo(0.014 * s, 0.055 * s), skinM, -0.055 * s, -0.045 * s, 0.01 * s, 'hi').rotation.z = 0.7
    }
    arms.push({ shoulder, elbow, wrist })
  }

  // legs: thigh → knee → shin → flattened foot. Hips sit just under the pelvis taper.
  const thighLen = legL * 0.5, shinLen = legL * 0.5 - 0.06 * s, legR = 0.072 * s
  const legs = []
  for (const side of [-1, 1]) {
    const thigh = joint(hips, side * 0.095 * s * fat, -0.04 * s)
    add(thigh, capGeo(legR, thighLen - 2 * legR), pantM, 0, -thighLen / 2)
    const knee = joint(thigh, 0, -thighLen)
    add(knee, sphereGeo(legR * 0.72), pantM)
    add(knee, capGeo(legR * 0.72, shinLen - 2 * legR * 0.72), pantM, 0, -shinLen / 2)
    const ankle = joint(knee, 0, -shinLen)
    const foot = add(ankle, sphereGeo(0.06 * s), shoeM, 0, -0.03 * s, 0.06 * s)
    foot.scale.set(0.85, 0.55, 2.1)
    add(ankle, boxGeo(0.1 * s, 0.022 * s, 0.24 * s), trimM, 0, -0.06 * s, 0.06 * s, 'hi') // sole
    add(ankle, sphereGeo(0.038 * s), shoeM, 0, -0.015 * s, 0.15 * s, 'hi').scale.set(1.1, 0.55, 1.2) // toe cap
    legs.push({ thigh, knee, ankle, foot })
  }

  if (o.apron) add(chest, boxGeo(0.34 * s, 0.6 * s, 0.03 * s), material('#5e564a'), 0, torsoL * 0.4, 0.17 * s, 'hi')
  if (o.gamchha) add(chest, boxGeo(0.1 * s, 0.34 * s, 0.03 * s), material('#c8321e'), 0.14 * s, torsoL * 0.6, 0.15 * s, 'hi')
  if (female && !o.kurta && !o.saree) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.26 * s, 0.38 * s, 12), shirtM)
    skirt.position.y = -0.19 * s; hips.add(skirt); coreMeshes.push(skirt)
  }
  if (o.saree) {
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 0.7 * s, 12), pantM)
    sk.position.y = -0.34 * s; sk.scale.z = 0.8; hips.add(sk); coreMeshes.push(sk)
  }

  // ---- tailoring: small layers that make a figure read as "dressed" ----
  if (!o.flat) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.055 * s, 0.012 * s, 5, 12), material('#d8d0b8'))
    collar.position.set(0, torsoL - 0.01 * s, 0); collar.rotation.x = Math.PI / 2; collar.scale.z = 0.8; chest.add(collar); hiMeshes.push(collar)
    add(chest, boxGeo(0.022 * s, torsoL * 0.72, 0.012 * s), material('#e6dfd0'), 0, torsoL * 0.52, 0.128 * s, 'hi') // placket
    for (let i = 0; i < 3; i++) add(chest, sphereGeo(0.007 * s), trimM, 0, torsoL * (0.36 + i * 0.15), 0.138 * s, 'hi')
    add(hips, new THREE.CylinderGeometry(0.155 * s, 0.155 * s, 0.045 * s, 14), trimM, 0, 0.015 * s).scale.z = 0.75 // belt
    add(hips, boxGeo(0.04 * s, 0.035 * s, 0.018 * s), material('#b8a15c', { metalness: 0.5, roughness: 0.4 }), 0, 0.015 * s, 0.12 * s, 'hi') // buckle
    for (const side of [-1, 1]) add(hips, boxGeo(0.055 * s, 0.075 * s, 0.012 * s), pantM, side * 0.085 * s, -0.09 * s, 0.115 * s, 'hi') // pockets
    add(arms[0].wrist, new THREE.TorusGeometry(0.048 * s, 0.008 * s, 5, 12), trimM, 0, 0.02 * s, 0, 'hi').rotation.x = Math.PI / 2 // watch
  }

  // ---- FAR LOD: three cached meshes, no joints, no animation ----------------
  const proxy = new THREE.Group(); root.add(proxy)
  const pLegs = mesh(proxy, capGeo(0.11 * s, 0.7 * s), pantM, 0, 0.42 * s)
  const pBody = mesh(proxy, capGeo(0.16 * s * fat, 0.42 * s), shirtM, 0, 1.12 * s)
  const pHead = mesh(proxy, sphereGeo(0.12 * s), skinM, 0, 1.62 * s)
  const proxyMeshes = [pLegs, pBody, pHead]
  proxyMeshes.forEach(m => { m.visible = false; m.castShadow = false })

  collapseJointDetail(coreMeshes, hiMeshes, new Set([mouthMesh]))

  const rig = {
    root, body, hips, spine, chest, neck, head, arms, legs, o, h, fat, legL,
    mouthM: mouthMesh, mouth: 0, lookX: 0, lookY: 0, crouch: 0, tremble: 0, held: null,
    pose: 'stand', t: Math.random() * 8, speed: 0, phase: 0, look: 0,
    lod: { level: 2, core: coreMeshes, hi: hiMeshes, proxy: proxyMeshes, min: 0, max: 2, forced: 0 },
    setPose(p) { this.pose = p },
    // attach a cup / biscuit / pickaxe to a hand; rides the hand during gestures
    hold(obj, side = 1, off = [0, -0.3, 0.12]) {
      if (this.held && this.held.parent) this.held.parent.remove(this.held)
      this.held = obj
      if (obj) {
        arms[side > 0 ? 1 : 0].elbow.add(obj)
        obj.position.set(off[0] * s, off[1] * s, off[2] * s)
        this._holdBase = obj.position.clone()
      } else this._holdBase = null
    },
    setLOD(level) {
      level = clamp(level | 0, this.lod.min, this.lod.max)
      if (this.lod.level === level) return
      this.lod.level = level
      const far = level === 0, hi = level === 2
      for (const m of this.lod.proxy) m.visible = far
      for (const m of this.lod.core) m.visible = !far
      for (const m of this.lod.hi) m.visible = hi
    },
    update(dt, spd = 0) {
      this.t += dt
      if (this.lod.level === 0) { // cheap far bob; the skeleton is frozen
        pBody.position.y = 1.12 * s + Math.sin(this.t * 2.2) * 0.012 * Math.min(1, Math.abs(spd || 0))
        return
      }
      this.speed = damp(this.speed, spd || 0, 8, dt)
      const w = clamp(Math.abs(this.speed) / 1.5, 0, 1.3)
      const ph = this.phase += dt * (2 + this.speed * 2.2)
      const pose = this.pose
      // Snapshot the previous frame so every pose change is eased instead of
      // snapping — one extra math pass, no new meshes or draw calls.
      const old = {
        bodyY: body.position.y,
        thigh: legs.map(l => l.thigh.rotation.x), knee: legs.map(l => l.knee.rotation.x), ankle: legs.map(l => l.ankle.rotation.x),
        shX: arms.map(a => a.shoulder.rotation.x), shZ: arms.map(a => a.shoulder.rotation.z), elX: arms.map(a => a.elbow.rotation.x),
        chX: chest.rotation.x, chY: chest.rotation.y, hipY: hips.rotation.y, hdZ: head.rotation.z, hdY: head.position.y
      }
      const sit = pose === 'sit' || pose === 'pillion' || pose === 'sit_drink' || pose === 'sit_eat'
      const breath = Math.sin(this.t * 1.9) * 0.014
      chest.scale.set(1 + breath, 1 + breath * 0.5, 1 + breath)
      head.rotation.z = Math.sin(this.t * 0.8) * 0.015 - chest.rotation.y * 0.25
      head.position.y = neckLen + Math.sin(this.t * 1.9 + 0.4) * 0.005
      if (hairCap) hairCap.rotation.z = Math.sin(this.t * 2.3) * (0.008 + w * 0.02) - head.rotation.z * 0.3

      if (sit) {
        body.position.y = -0.3 * s
        legs.forEach(l => { l.thigh.rotation.x = -1.4; l.knee.rotation.x = 1.5; l.ankle.rotation.x = 0.2 })
        arms.forEach(a => { a.shoulder.rotation.x = -0.55; a.elbow.rotation.x = -0.9 })
        chest.rotation.x = 0.04
      } else {
        body.position.y = 0
        legs.forEach((l, i) => {
          const k = ph + i * Math.PI
          l.thigh.rotation.x = Math.sin(k) * 0.62 * w
          l.knee.rotation.x = Math.max(0, -Math.cos(k)) * 0.8 * w
          l.ankle.rotation.x = -Math.sin(k) * 0.22 * w
          l.foot.rotation.x = Math.sin(k - 0.5) * 0.16 * w // heel-toe roll
        })
        arms.forEach((a, i) => {
          const k = ph + (i ? 0 : Math.PI)
          a.shoulder.rotation.x = Math.sin(k) * 0.5 * w - 0.04
          a.elbow.rotation.x = -0.1 - w * 0.12
        })
        chest.rotation.y = Math.sin(ph) * 0.07 * w
        hips.rotation.y = -Math.sin(ph) * 0.04 * w
      }
      if (pose === 'steer') { arms.forEach((a, i) => { a.shoulder.rotation.x = -1.22; a.shoulder.rotation.z = (i ? -1 : 1) * 0.14; a.elbow.rotation.x = -0.3 }); chest.rotation.x = 0.07 }
      if (pose === 'hands_up') arms.forEach(a => { a.shoulder.rotation.x = -2.55; a.elbow.rotation.x = -0.3 })
      if (pose === 'push') { arms.forEach(a => { a.shoulder.rotation.x = -1.05; a.elbow.rotation.x = -0.35 }); chest.rotation.x = 0.16 }
      if (pose === 'point') { arms[1].shoulder.rotation.x = -1.55; arms[1].elbow.rotation.x = -0.05 }
      if (pose === 'hug') arms.forEach((a, i) => { a.shoulder.rotation.x = -0.8; a.shoulder.rotation.z = (i ? 1 : -1) * 0.25; a.elbow.rotation.x = -1.4 })
      if (pose === 'photo') arms.forEach(a => { a.shoulder.rotation.x = -1.5; a.elbow.rotation.x = -1.05 })
      if (pose === 'wave') { arms[1].shoulder.rotation.x = -2.4; arms[1].shoulder.rotation.z = -0.4 + Math.sin(this.t * 9) * 0.22; arms[1].elbow.rotation.x = -0.2 }
      if (pose === 'offer') { arms[1].shoulder.rotation.x = -1.0; arms[1].elbow.rotation.x = -0.55 }
      if (pose === 'hold_hand') arms.forEach((a, i) => { a.shoulder.rotation.x = -0.5; a.shoulder.rotation.z = (i ? -1 : 1) * 0.28; a.elbow.rotation.x = -0.7 })
      if (pose === 'rub') { arms.forEach((a, i) => { a.shoulder.rotation.x = -0.9 + Math.sin(this.t * 7 + i) * 0.1; a.elbow.rotation.x = -1.7; a.shoulder.rotation.z = (i ? 1 : -1) * 0.5 }); chest.rotation.x = 0.12 }
      if (pose === 'strike') { const k = (this.t * 1.6) % 1; const up = k < 0.55 ? k / 0.55 : 1 - (k - 0.55) / 0.12; arms.forEach(a => { a.shoulder.rotation.x = -(0.4 + 2.1 * clamp(up, 0, 1)); a.elbow.rotation.x = -0.3 }); chest.rotation.x = 0.25 - clamp(up, 0, 1) * 0.5 }
      // hand-to-mouth gestures, with the held object riding the hand up
      this._bite = 0
      if (pose === 'eat' || pose === 'bite' || pose === 'sit_eat') {
        const cyc = (this.t * 1.35) % 1
        this._bite = cyc < 0.45 ? Math.sin((cyc / 0.45) * Math.PI) : 0
        arms[1].shoulder.rotation.x = (sit ? -0.35 : -0.62) - this._bite * 0.85
        arms[1].elbow.rotation.x = (sit ? -0.9 : -1.15) - this._bite * 0.7
      }
      if (pose === 'sip' || pose === 'sit_drink' || pose === 'drink') {
        const cyc = (this.t * 0.7) % 1
        const lift = cyc < 0.5 ? Math.sin((cyc / 0.5) * Math.PI) : 0
        this._bite = lift * 0.5
        arms[1].shoulder.rotation.x = (sit ? -0.35 : -0.7) - lift * 0.55
        arms[1].elbow.rotation.x = (sit ? -0.9 : -1.35) - lift * 0.5
      }
      if (this._bite > 0.4) {
        head.rotation.x += this._bite * 0.13
        mouthMesh.visible = this.lod.level === 2
        mouthMesh.scale.y = 0.4 + Math.sin(this.t * 14) * 0.3
      } else {
        mouthMesh.visible = this.lod.level === 2 && this.mouth > 0.06
        mouthMesh.scale.y = 0.001 + clamp(this.mouth * 2.6, 0, 1) * 1.4
      }
      if (this.held && this._holdBase) {
        if (this._bite > 0) this.held.position.set(this._holdBase.x, this._holdBase.y + this._bite * 0.07 * s, this._holdBase.z - this._bite * 0.06 * s)
        else this.held.position.lerp(this._holdBase, Math.min(1, dt * 6))
      }
      if (pose === 'fallen') { body.rotation.z = damp(body.rotation.z, 1.5, 4, dt); body.position.y = -0.3 * s }
      else body.rotation.z = damp(body.rotation.z, 0, 6, dt)
      if (this.crouch > 0.01 && !sit) {
        body.position.y -= this.crouch * 0.42 * s
        legs.forEach(l => { l.thigh.rotation.x = -1.1 * this.crouch; l.knee.rotation.x = 1.9 * this.crouch })
      }
      if (this.tremble > 0) {
        chest.rotation.z = Math.sin(this.t * 38) * 0.02 * this.tremble
        arms.forEach(a => { a.shoulder.rotation.z += Math.sin(this.t * 41) * 0.02 * this.tremble })
      } else chest.rotation.z = damp(chest.rotation.z, 0, 8, dt)
      head.rotation.y = damp(head.rotation.y, clamp(this.lookY || this.look, -1.1, 1.1), 7, dt)
      head.rotation.x = damp(head.rotation.x, clamp(this.lookX, -0.6, 0.6), 7, dt)
      const kb = 1 - Math.exp(-dt * (w > 0.25 ? 16 : 10))
      const bl = (a, b) => a + (b - a) * kb
      body.position.y = bl(old.bodyY, body.position.y)
      legs.forEach((l, i) => {
        l.thigh.rotation.x = bl(old.thigh[i], l.thigh.rotation.x)
        l.knee.rotation.x = bl(old.knee[i], l.knee.rotation.x)
        l.ankle.rotation.x = bl(old.ankle[i], l.ankle.rotation.x)
      })
      arms.forEach((a, i) => {
        a.shoulder.rotation.x = bl(old.shX[i], a.shoulder.rotation.x)
        a.shoulder.rotation.z = bl(old.shZ[i], a.shoulder.rotation.z)
        a.elbow.rotation.x = bl(old.elX[i], a.elbow.rotation.x)
      })
      chest.rotation.x = bl(old.chX, chest.rotation.x); chest.rotation.y = bl(old.chY, chest.rotation.y)
      hips.rotation.y = bl(old.hipY, hips.rotation.y)
      head.rotation.z = bl(old.hdZ, head.rotation.z); head.position.y = bl(old.hdY, head.position.y)
    }
  }
  return rig
}
