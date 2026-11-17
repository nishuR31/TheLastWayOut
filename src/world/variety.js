// Parameterized procedural models — variety from arguments, not one-off art.
// Everything is lightweight geometry + shared materials, safe for software WebGL.
import * as THREE from 'three'
import { bx, cyl, sph, buildHouse, signboard, motorbike, carModel } from './build.js'
import { tex, withPBR } from './textures.js'
import { R } from '../core/util.js'
import { buildHuman } from './humanRig.js'

const mat = (c, o = {}) => withPBR(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o }))
const SKIN = ['#8d5b3b', '#a46d49', '#9a6544', '#7a4a30', '#b07c55', '#6f462b', '#c08a63']
const CLOTH = [
  ['#27424a', '#8aa0a6', 'check'], ['#b5532a', '#d9a06a', 'stripe'], ['#3a5a3a', '#9aa87a', 'check'],
  ['#6a3a5a', '#b090a0', 'stripe'], ['#4a4a52', '#9a9aa0', 'check'], ['#c9a227', '#8a5a20', 'plain'],
  ['#e8e0cc', '#e8e0cc', 'plain'], ['#8b1d2c', '#e0b13a', 'print']
]
const pick = (a) => a[Math.floor(Math.random() * a.length)]

// A human with age / build / gender / role / clothing driven entirely by options.
// age: 'child' | 'teen' | 'adult' | 'elder'  — changes height, head/body ratio, hair and face.
export const human = (o = {}) => buildHuman(o)

// A ghost: translucent, tall, void face, white eyes, tattered cloth, floats.
export function ghost(o = {}) {
  const g = new THREE.Group()
  const h = o.h || 1.9
  const pale = new THREE.MeshStandardMaterial({ color: o.color || '#c9d3d8', transparent: true, opacity: 0.42, roughness: 1, depthWrite: false })
  const dark = new THREE.MeshBasicMaterial({ color: '#05070a' })
  const eyes = new THREE.MeshBasicMaterial({ color: '#eaf6ff' })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, h * 0.72, 9), pale)
  body.position.y = h * 0.38; g.add(body)
  sph(g, 0.19, pale, 0, h * 0.84, 0, 0.9, 1.15, 0.9)
  sph(g, 0.16, dark, 0, h * 0.85, 0.12, 0.95, 1.1, 0.6) // void face
  for (const side of [-1, 1]) sph(g, 0.03, eyes, side * 0.07, h * 0.87, 0.2, 1, 1.2, 0.5)
  for (let i = 0; i < 6; i++) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.5 + Math.random() * 0.5), pale)
    const a = i / 6 * Math.PI * 2
    strip.position.set(Math.sin(a) * 0.3, h * 0.12, Math.cos(a) * 0.3); strip.rotation.y = a; g.add(strip)
  }
  for (const side of [-1, 1]) {
    cyl(g, 0.035, 0.025, h * 0.5, pale, side * 0.26, h * 0.45, 0, 6)
  }
  g.userData.float = { t: Math.random() * 6, base: 0 }
  return g
}
export function floatGhost(g, dt) { if (g && g.userData.float) { const f = g.userData.float; f.t += dt; g.position.y = Math.sin(f.t * 1.1) * 0.1; g.rotation.y = Math.sin(f.t * 0.4) * 0.15 } }

// Vehicle variants from a small set of parameters; existing base models reused.
// Wheels are a shared helper so the different Indian-road vehicles read clearly
// even at a distance (silhouette matters more than detail here).
const wheel = (g, x, y, z, r, w, col = '#161616') => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 12), mat(col))
  m.rotation.z = Math.PI / 2; m.position.set(x, y, z); g.add(m)
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, w + 0.02, 8), mat('#8a8a86'))
  hub.rotation.z = Math.PI / 2; hub.position.set(x, y, z); g.add(hub)
  return m
}
export function vehicle(o = {}) {
  const kind = o.kind || 'bike', variant = o.variant || pick(['standard', 'sports', 'cruiser', 'dirt'])
  const col = o.color || pick(['#c8c8c8', '#8a1c1c', '#1d3f7a', '#e0d8c0', '#2d5a3a', '#3a3a3e', '#b8892a'])
  let g
  if (kind === 'car') {
    g = carModel(col)
    if (variant === 'suv') g.scale.set(1.1, 1.35, 1.05)
    if (variant === 'hatch') g.scale.set(0.9, 0.92, 0.85)
  } else if (kind === 'truck') {
    g = new THREE.Group()
    bx(g, 2.4, 1.7, 2.0, mat(col), 0, 0.7, 3.4)
    if (variant === 'tanker') {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 5.4, 14), mat('#c9c4b4'))
      tank.rotation.x = Math.PI / 2; tank.position.set(0, 1.3, -1.2); g.add(tank)
      for (const z of [1.2, -1.2, -3.6]) { const band = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.04, 5, 14), mat('#5a5a54')); band.position.set(0, 1.3, z); g.add(band) }
    } else {
      bx(g, 2.5, 0.25, 6.4, mat('#1f5fa8'), 0, 0.7, -1.2)
      bx(g, 2.3, 1.9, 5.8, mat(col), 0, 1.7, -1.4)
    }
    for (const z of [3.2, -0.5, -2.2, -3.8]) for (const s of [-1, 1]) wheel(g, s * 1.1, 0.5, z, 0.5, 0.35)
  } else if (kind === 'auto') {
    // three-wheeled auto-rickshaw: green lower body, yellow canopy
    g = new THREE.Group()
    bx(g, 1.5, 0.65, 2.1, mat(col), 0, 0.55, 0)
    bx(g, 1.55, 0.55, 1.6, mat('#d8b02a'), 0, 1.2, -0.25)
    bx(g, 1.4, 0.5, 0.04, mat('#2a3942', { transparent: true, opacity: 0.6 }), 0, 1.05, 0.78)
    bx(g, 0.9, 0.25, 0.5, mat('#4a4a46'), 0, 0.55, 1.05)
    wheel(g, 0, 0.38, 1.12, 0.36, 0.16)
    for (const s of [-1, 1]) wheel(g, s * 0.78, 0.38, -0.75, 0.36, 0.16)
    cyl(g, 0.03, 0.03, 0.6, mat('#333'), 0, 0.95, 1.0, 6)
  } else if (kind === 'van') {
    // tempo / small commercial van
    g = new THREE.Group()
    bx(g, 1.9, 1.5, 4.2, mat(col), 0, 0.95, -0.2)
    bx(g, 1.8, 0.9, 1.3, mat('#3a4a52'), 0, 1.35, 1.6)
    bx(g, 1.7, 0.03, 0.05, mat('#93a6ad', { emissive: '#1a2a30' }), 0, 1.45, 2.24)
    for (const z of [1.35, -1.6]) for (const s of [-1, 1]) wheel(g, s * 0.92, 0.45, z, 0.44, 0.22)
  } else if (kind === 'tractor') {
    g = new THREE.Group()
    bx(g, 1.1, 0.8, 1.8, mat(col), 0, 0.85, 0.35)
    bx(g, 0.95, 0.18, 0.6, mat('#3a3a36'), 0, 1.35, -0.25)
    for (const s of [-1, 1]) {
      cyl(g, 0.04, 0.04, 1.2, mat('#4a4a46'), s * 0.5, 1.7, -0.3, 6)
      wheel(g, s * 0.95, 0.62, -0.9, 0.62, 0.3)
      wheel(g, s * 0.72, 0.34, 1.35, 0.34, 0.22)
    }
    cyl(g, 0.05, 0.05, 0.9, mat('#2a2a28'), 0.42, 1.5, 1.0, 6)
  } else if (kind === 'cycle') {
    g = new THREE.Group()
    for (const z of [-0.62, 0.62]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 16), mat('#3a3a38'))
      rim.position.set(0, 0.35, z); g.add(rim)
      for (let i = 0; i < 6; i++) { const spoke = cyl(g, 0.006, 0.006, 0.66, mat('#888'), 0, 0.35, z, 4); spoke.rotation.x = i * Math.PI / 6 }
    }
    cyl(g, 0.025, 0.025, 1.2, mat(col), 0, 0.55, 0, 6).rotation.x = 1.1
    cyl(g, 0.025, 0.025, 0.9, mat(col), 0, 0.75, -0.2, 6).rotation.x = -0.5
    bx(g, 0.22, 0.06, 0.3, mat('#222'), 0, 0.9, -0.35)
    cyl(g, 0.025, 0.025, 0.5, mat('#666'), 0, 0.95, 0.6, 6).rotation.z = Math.PI / 2
  } else if (kind === 'cart') {
    // bullock cart: wooden platform, two big spoked wheels, long shafts
    g = new THREE.Group()
    bx(g, 1.7, 0.16, 2.2, mat('#6b4a2c'), 0, 0.72, 0)
    for (const s of [-1, 1]) bx(g, 0.1, 0.5, 2.1, mat('#4a331c'), s * 0.8, 0.95, 0)
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.045, 6, 16), mat('#5a4128'))
      rim.position.set(s * 0.95, 0.56, 0); g.add(rim)
      for (let i = 0; i < 8; i++) { const sp = cyl(g, 0.012, 0.012, 1.05, mat('#6b5136'), s * 0.95, 0.56, 0, 4); sp.rotation.z = i * Math.PI / 8 }
      cyl(g, 0.04, 0.04, 2.4, mat('#6b4a2c'), s * 0.55, 0.8, 1.9, 6).rotation.x = Math.PI / 2
    }
  } else {
    g = motorbike(o.color || pick(['#a31d1d', '#1d3f7a', '#222', '#c8a020']), true)
    if (variant === 'sports') { const fair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.9), mat(o.color || '#c02020')); fair.position.set(0, 0.78, 0.42); g.add(fair) }
    if (variant === 'cruiser') g.userData.lean.rotation.x = -0.04
    if (variant === 'dirt') { g.scale.set(1.05, 1.12, 1.0); cyl(g, 0.03, 0.03, 0.6, mat('#333'), 0, 1.0, 0.55, 6) }
  }
  g.userData.variant = variant
  return g
}

// Building variety: storeys, roof, wall material, a shop name and awnings/balconies.
export function building(L, o = {}) {
  const house = buildHouse(L, o)
  const g = house.group
  const w = o.w || 8, d = o.d || 6, h = o.h || 3
  if (o.name) {
    const sign = signboard(o.name, o.signBg || '#1c3a6a', '#f4e8c0', Math.min(3.2, w * 0.5), 0.9)
    sign.position.set(0, 0, d / 2 + 0.35); g.add(sign)
  }
  if (o.awning) {
    const aw = bx(g, w * 0.8, 0.08, 1.2, mat(o.awningColor || '#a33a1a'), 0, 2.3, d / 2 + 0.6)
    aw.rotation.x = 0.12
  }
  if (o.balcony) {
    bx(g, w * 0.7, 0.1, 0.8, mat('#8a857a'), 0, h + 0.1, d / 2 + 0.4)
    for (let i = -2; i <= 2; i++) cyl(g, 0.02, 0.02, 0.5, mat('#444'), i * (w * 0.12), h + 0.1, d / 2 + 0.7, 5)
  }
  if (o.storeys > 1) {
    for (let i = 1; i < o.storeys; i++) {
      bx(g, w + 0.3, 2.6, d + 0.3, mat(i % 2 ? '#c9b99a' : '#d8c9b0'), 0, h + i * 2.6, 0)
      for (const x of [-w * 0.25, w * 0.25]) bx(g, 0.8, 1.0, 0.06, mat('#203040', { emissive: '#0a1420' }), x, h + i * 2.6 + 0.4, d / 2 + 0.2)
    }
  }
  return house
}

// Tree variants — reuses existing geometry where possible, adds silhouettes.
export function tree(o = {}) {
  const kind = o.kind || pick(['neem', 'banyan', 'palm', 'bush', 'conifer'])
  const s = o.s || 1, g = new THREE.Group()
  const barkM = mat('#6a4a30')
  if (kind === 'palm') {
    cyl(g, 0.12 * s, 0.22 * s, 5 * s, barkM, 0, 0, 0, 8)
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28 * s, 2.1 * s, 4), mat('#3f7a3a'))
      const a = i / 7 * Math.PI * 2
      leaf.position.set(Math.sin(a) * 0.9 * s, 5 * s, Math.cos(a) * 0.9 * s)
      leaf.rotation.set(Math.PI / 2.6, a, 0); leaf.rotation.z = Math.cos(a) * 0.5; g.add(leaf)
    }
  } else if (kind === 'conifer') {
    cyl(g, 0.1 * s, 0.16 * s, 1.4 * s, barkM, 0, 0, 0, 7)
    for (let i = 0; i < 4; i++) { const cone = new THREE.Mesh(new THREE.ConeGeometry((1.3 - i * 0.25) * s, 1.6 * s, 8), mat('#2f5a34')); cone.position.y = (1.2 + i * 0.9) * s; g.add(cone) }
  } else if (kind === 'banyan') {
    cyl(g, 0.32 * s, 0.5 * s, 3.2 * s, barkM, 0, 0, 0, 9)
    for (let i = 0; i < 5; i++) { const r = (0.8 + i * 0.35) * s; sph(g, (1.5 - i * 0.12) * s, mat('#4a7a3a'), Math.sin(i * 1.7) * r, (3.2 + i * 0.4) * s, Math.cos(i * 1.7) * r) }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cyl(g, 0.03 * s, 0.05 * s, 2.4 * s, barkM, Math.sin(a) * 0.9 * s, 0, Math.cos(a) * 0.9 * s, 5) }
  } else if (kind === 'bush') {
    for (let i = 0; i < 5; i++) sph(g, (0.35 + Math.random() * 0.25) * s, mat('#4a7a3a'), (Math.random() - 0.5) * s, (0.3 + Math.random() * 0.3) * s, (Math.random() - 0.5) * s)
  } else {
    cyl(g, 0.14 * s, 0.24 * s, 3.4 * s, barkM, 0, 0, 0, 8)
    for (let i = 0; i < 4; i++) sph(g, (1.1 - i * 0.1) * s, mat(i % 2 ? '#3f6b34' : '#527f3e'), (Math.random() - 0.5) * 1.4 * s, (3.3 + i * 0.5) * s, (Math.random() - 0.5) * 1.4 * s)
  }
  g.userData.kind = kind
  return g
}

// A terrain patch: flat colour + scattered texture tufts, cheap and instanced-free at small counts.
export function terrainPatch(L, x, z, w, d, o = {}) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(o.color || '#7d9a3a', { roughness: 1 }))
  p.rotation.x = -Math.PI / 2; p.position.set(x, o.y || 0.016, z); if (o.ry) p.rotation.z = o.ry; L.add(p)
  if (o.rows) {
    for (let i = -o.rows; i <= o.rows; i++) {
      const row = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, d * 0.9), mat(o.crop || '#b6a24c'))
      row.position.set(x + i * (w / (o.rows * 2 + 1)), 0.15, z); row.rotation.y = o.ry || 0; L.add(row)
    }
  }
  return p
}
