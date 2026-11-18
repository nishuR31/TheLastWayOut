// Detailed, low-cost procedural props for story objects that were previously
// only an inventory icon or a plain box. All factories return a THREE.Group in
// metres, ready to be dropped into a level or a character's hand.
import * as THREE from 'three'

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.06, envMapIntensity: 0.8, ...o })
const STEEL = M('#9aa2a3', { metalness: 0.78, roughness: 0.32, envMapIntensity: 1.4 })
const STEEL_D = M('#545b5c', { metalness: 0.7, roughness: 0.4, envMapIntensity: 1.2 })
const CERAMIC = M('#d8d2c2', { roughness: 0.5 })
const WOOD = M('#6b4a2c')
const DARK = M('#17191a', { roughness: 0.9 })
const add = (g, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); g.add(mesh); return mesh }

// ---- food & drink --------------------------------------------------------

export function makeTiffin(open = false) {
  const g = new THREE.Group()
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.125, 0.105, 28), STEEL), 0, 0.052, 0)
  add(g, new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.008, 6, 28), STEEL_D), 0, 0.104, 0).rotation.x = Math.PI / 2
  const lid = new THREE.Group()
  add(lid, new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.138, 0.022, 28), STEEL), 0, 0.112, 0)
  add(lid, new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), STEEL_D), 0, 0.126, 0)
  if (open) lid.position.set(0.04, 0.16, -0.19), lid.rotation.x = -0.6
  g.add(lid)
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.03, 0.012), STEEL_D), 0, 0.09, 0.135)
  for (let i = 0; i < 3; i++) {
    const b = makeBiscuit(); b.scale.setScalar(0.62)
    b.position.set((i - 1) * 0.055, 0.112 + (open ? 0.002 : 0), (i % 2) * 0.02)
    if (open) g.add(b)
  }
  return g
}

export function makeBiscuit() {
  const g = new THREE.Group()
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20), M('#c79a5c', { roughness: 0.95 })))
  const rim = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.003, 5, 20), M('#a87a42')), 0, 0.007, 0)
  rim.rotation.x = Math.PI / 2
  for (const [x, z] of [[-0.017, 0], [0.017, 0], [0, -0.017], [0, 0.017]]) {
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.0026, 6, 5), M('#6d4622')), x, 0.007, z)
  }
  return g
}

// A steel tumbler of red sharbat with one rose petal. Never glows — the story
// insists the drink stays ordinary.
export function makeSharbat(fill = 0.62) {
  const g = new THREE.Group()
  const glass = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.043, 0.14, 20, 1, true), STEEL))
  glass.material.side = THREE.DoubleSide
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.008, 20), STEEL_D), 0, -0.07, 0)
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.007, 20), STEEL), 0, 0.069, 0)
  const liquid = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.041, 0.14 * fill, 20), M('#8e1f28', { roughness: 0.25, metalness: 0.05 })), 0, -0.07 + 0.07 * fill, 0)
  g.userData.liquid = liquid
  const petal = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), M('#b5484f', { roughness: 0.6 })), 0.012, -0.07 + 0.14 * fill + 0.003, 0)
  petal.scale.set(1, 0.25, 0.7)
  return g
}

// A roadside thali: steel plate, two parathas and a small bowl of pickle.
export function makeThali() {
  const g = new THREE.Group()
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.012, 24), STEEL))
  add(g, new THREE.Mesh(new THREE.TorusGeometry(0.166, 0.004, 5, 24), STEEL_D), 0, 0.006, 0).rotation.x = Math.PI / 2
  for (let i = 0; i < 2; i++) {
    const p = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.016, 20), M('#c79a5c', { roughness: 0.95 })), i ? 0.075 : -0.07, 0.015, i * 0.02)
    p.rotation.y = i * 0.6
  }
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.028, 16), M('#9c5a2c')), -0.115, 0.02, -0.09)
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.003, 16), M('#a83b1e', { roughness: 0.5 })), -0.115, 0.034, -0.09)
  return g
}

export function makeLassi() {
  const g = new THREE.Group()
  const cup = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.13, 18, 1, true), M('#e8e2d0', { roughness: 0.45 })))
  cup.material.side = THREE.DoubleSide
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.006, 18), M('#c9c2ad')), 0, -0.065, 0)
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.004, 18), M('#f0eada')), 0, 0.058, 0)
  return g
}

export function makeChai() {
  const g = new THREE.Group()
  const cup = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.026, 0.075, 16, 1, true), M('#9c6a45', { roughness: 0.95 })))
  cup.material.side = THREE.DoubleSide
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.006, 16), M('#6b4a2c')), 0, -0.037, 0)
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.003, 16), M('#b08b5c', { roughness: 0.4 })), 0, 0.032, 0)
  add(g, new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.004, 5, 16), M('#7d5233')), 0, -0.034, 0).rotation.x = Math.PI / 2
  return g
}

// ---- carried & found items ----------------------------------------------

export function makeMatchbox() {
  const g = new THREE.Group()
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.055), M('#9a3d2c')))
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.004, 0.05), M('#c9b18a')), 0, 0.018, 0)
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.002, 0.012), M('#5a5147')), 0, 0.021, -0.014)
  const stick = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.085, 6), M('#e2d6b2')), 0.03, 0.058, 0.005)
  stick.rotation.z = 0.22
  add(g, new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), M('#b3261e', { roughness: 0.4 })), 0.039, 0.099, 0.005)
  return g
}

export function makeTwigs(n = 5) {
  const g = new THREE.Group()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const t = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.42, 5), WOOD), Math.sin(a) * 0.028, 0, Math.cos(a) * 0.028)
    t.rotation.set(0.14 * Math.sin(a), a, 0.12 * Math.cos(a))
  }
  add(g, new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.004, 5, 14), M('#9c8a63')), 0, 0.01, 0).rotation.x = Math.PI / 2
  return g
}

export function makePetrolCan() {
  const g = new THREE.Group()
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.17), M('#6b3d24', { metalness: 0.3, roughness: 0.6 })))
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.14), STEEL_D), 0, 0.16, 0)
  add(g, new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 6, 16, Math.PI), STEEL_D), 0, 0.24, 0)
  const spout = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.16, 10), STEEL_D), 0.13, 0.12, 0)
  spout.rotation.z = -0.9
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 12), STEEL), 0.23, 0.06, 0)
  return g
}

export function makeSparkPlug() {
  const g = new THREE.Group()
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), STEEL_D), 0, 0.1, 0)
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.014, 0.055, 12), CERAMIC), 0, 0.06, 0)
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.022, 6), STEEL), 0, 0.025, 0)
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.07, 12), STEEL_D), 0, -0.022, 0)
  for (let i = 0; i < 3; i++) add(g, new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0016, 4, 12), STEEL), 0, -0.005 - i * 0.016, 0).rotation.x = Math.PI / 2
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.004), STEEL), 0.009, -0.066, 0)
  return g
}

export function makeCamera() {
  const g = new THREE.Group()
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.06), DARK))
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.02, 0.02), STEEL_D), 0, 0.052, 0)
  const lens = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.055, 20), STEEL_D), 0, 0, 0.055)
  lens.rotation.x = Math.PI / 2
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.002, 20), M('#16222c', { metalness: 0.5, roughness: 0.15 })), 0, 0, 0.083).rotation.x = Math.PI / 2
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.016, 0.006), M('#d8c9a0')), 0.05, 0.035, 0.032)
  return g
}

export function makePhone() {
  const g = new THREE.Group()
  add(g, new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.01, 0.158), M('#15181c', { metalness: 0.4, roughness: 0.4 })))
  const s = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.147), M('#2a3a52', { emissive: '#101d2e', emissiveIntensity: 0.6 })), 0, 0.0056, 0)
  s.rotation.x = -Math.PI / 2
  add(g, new THREE.Mesh(new THREE.CircleGeometry(0.005, 12), M('#0a0c0f')), 0, 0.0058, 0.066).rotation.x = -Math.PI / 2
  add(g, new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), M('#05070a')), 0, 0.0058, -0.061).rotation.x = -Math.PI / 2
  return g
}

// A burning brand. userData.flames are animated by fire.js / the render loop.
export function makeTorch() {
  const g = new THREE.Group()
  const stick = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.62, 8), WOOD), 0, 0.31, 0)
  stick.rotation.z = 0.08
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.11, 10), M('#3b2a18', { roughness: 1 })), 0.025, 0.63, 0)
  const flames = new THREE.Group(); flames.position.set(0.025, 0.7, 0)
  for (let i = 0; i < 4; i++) {
    const f = add(flames, new THREE.Mesh(new THREE.ConeGeometry(0.028 - i * 0.004, 0.12 - i * 0.015, 7),
      M(i < 2 ? '#e2621d' : '#f2c14e', { emissive: i < 2 ? '#8a2c08' : '#8a6410', emissiveIntensity: 1.4, transparent: true, opacity: 0.85 })),
      Math.sin(i * 2) * 0.012, 0.05 + i * 0.012, Math.cos(i * 2) * 0.012)
    f.userData.phase = i * 1.7
    // Self-animating flame: no scene-level bookkeeping needed for held brands.
    f.onBeforeRender = () => {
      const t = performance.now() * 0.004
      f.scale.setScalar(0.86 + 0.14 * Math.sin(t + f.userData.phase))
      f.rotation.z = Math.sin(t * 0.7 + f.userData.phase) * 0.12
    }
  }
  g.add(flames); g.userData.flames = flames
  return g
}
