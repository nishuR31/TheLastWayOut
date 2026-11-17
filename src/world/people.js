// Procedural Indian characters (humanoid rigs built from primitives + painted face textures)
import * as THREE from 'three'
import { tex, fabricNormal } from './textures.js'
import { clamp, damp, lerp, R } from '../core/util.js'

const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o })
const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg)

// Outfit presets
export const OUTFITS = {
  nishan: { skin: '#9a6544', hair: '#14100d', hairStyle: 'short', top: ['#27424a', '#8aa0a6', 'check'], long: true, bottom: '#2a3f66', shoes: '#e8e8e8', h: 1.74, face: { stache: false, beard: 0.1, brow: '#17100b' } },
  nishant: { skin: '#a46d49', hair: '#120d0a', hairStyle: 'short', top: ['#b5532a', '#d9a06a', 'stripe'], long: false, bottom: '#6d6347', shoes: '#2a2a2a', h: 1.77, glasses: true, face: { stache: true, brow: '#17100b' } },
  uncle: { skin: '#8a5a3b', hair: '#b9b4a8', hairStyle: 'thin', top: ['#e8e0cc', '#e8e0cc', 'plain'], long: true, kurta: true, bottom: '#efe9d8', shoes: '#4a3a2a', h: 1.68, gamchha: true, face: { stache: true, brow: '#8c877c', age: 2, beard: 0.15 }, age: 2 },
  daughter: { skin: '#9c6a48', hair: '#0e0a08', hairStyle: 'braids', top: ['#d8a62a', '#b0581e', 'print'], long: true, kurta: true, bottom: '#b0581e', shoes: null, h: 1.2, female: true, bangles: true, face: { male: false, bindi: true, brow: '#120c08' } },
  mother: { skin: '#9a6746', hair: '#171210', hairStyle: 'bun', saree: ['#8b1d2c', '#e0b13a'], h: 1.6, female: true, bangles: true, face: { male: false, bindi: true, brow: '#120c08', age: 1 } },
  chacha: { skin: '#8d5b3b', hair: '#6c6a66', hairStyle: 'short', top: ['#6e8aa0', '#dde3e8', 'stripe'], long: false, bottom: '#35352f', shoes: '#3a2f25', h: 1.7, glasses: true, face: { stache: true, brow: '#4a4844', age: 1 } },
  father: { skin: '#8a5838', hair: '#4a4744', hairStyle: 'short', top: ['#cdd5c4', '#cdd5c4', 'plain'], long: false, bottom: '#2a2f3a', shoes: '#3a2f25', h: 1.72, face: { stache: true, brow: '#33302d', age: 1 } },
  man1: { skin: '#7d4d31', hair: '#d8d2c4', hairStyle: 'turban', top: ['#d9d2bc', '#d9d2bc', 'plain'], long: true, kurta: true, bottom: '#e6dfcb', shoes: '#4a3a2a', h: 1.66, face: { stache: true, brow: '#a6a095', age: 2 }, turban: '#c4572a' },
  man2: { skin: '#86563a', hair: '#1a1410', hairStyle: 'short', top: ['#4a5d3a', '#a6b190', 'check'], long: true, bottom: '#2f3d6e', lungi: true, shoes: null, h: 1.7, face: { stache: true, brow: '#1a120c', beard: 0.3, age: 1 }, thin: 0.85 },
  stranger: { skin: '#8c5a3a', hair: '#17110d', hairStyle: 'short', top: ['#7b6a52', '#d8d0b8', 'check'], long: true, bottom: '#3a3a36', shoes: '#5a4a38', h: 1.7, gamchha: true, face: { stache: true, brow: '#1a120c', age: 1, beard: 0.2 } },
  chaiwala: { skin: '#85553a', hair: '#26201a', hairStyle: 'short', top: ['#b9b2a0', '#b9b2a0', 'plain'], long: false, bottom: '#2b2f4a', shoes: null, h: 1.66, apron: true, gamchha: true, face: { stache: true, brow: '#1a120c', age: 1 } },
  farmer: { skin: '#7c4b2e', hair: '#d0cabb', hairStyle: 'turban', top: ['#d9d2bc', '#d9d2bc', 'plain'], long: false, bottom: '#e6dfcb', shoes: null, h: 1.62, face: { stache: true, brow: '#a6a095', age: 2 }, turban: '#e9e2d0' },
  kid: { skin: '#996444', hair: '#0e0a08', hairStyle: 'short', top: ['#2f6a9a', '#e8e8e8', 'stripe'], long: false, bottom: '#243040', shoes: '#c8c8c8', h: 1.25, face: { brow: '#120c08' } },
  neighbor: { skin: '#946141', hair: '#201a14', hairStyle: 'short', top: ['#8a3a3a', '#d6b8a0', 'check'], long: false, bottom: '#3a3a3a', shoes: '#3a2f25', h: 1.7, face: { stache: true, brow: '#1a120c' } },
  shadow: { skin: '#050505', hair: '#000', hairStyle: 'short', top: ['#050505', '#050505', 'plain'], long: true, bottom: '#050505', shoes: null, h: 1.74, flat: true, face: { brow: '#000' } },
  arunab: { skin: '#8a5a3b', hair: '#2a2622', hairStyle: 'short', top: ['#3a4a3a', '#8aa08a', 'check'], long: true, bottom: '#2d2d30', shoes: '#4a3a2a', h: 1.74, face: { stache: true, beard: 0.25, brow: '#1a120c', age: 1 } },
  karan: { skin: '#a06a46', hair: '#120d0a', hairStyle: 'short', top: ['#222426', '#46494c', 'plain'], long: false, bottom: '#3a4a6a', shoes: '#c8c8c8', h: 1.76, face: { stache: false, beard: 0.1, brow: '#17100b' } },
  aman: { skin: '#9a6544', hair: '#14100d', hairStyle: 'short', top: ['#b04a2a', '#e0b090', 'stripe'], long: false, bottom: '#4a4a3a', shoes: '#2a2a2a', h: 1.72, glasses: true, face: { stache: false, brow: '#17100b' } },
  rohan: { skin: '#a46d49', hair: '#0e0a08', hairStyle: 'short', top: ['#2f6a9a', '#e8e8e8', 'stripe'], long: false, bottom: '#243040', shoes: '#c8c8c8', h: 1.62, face: { brow: '#120c08' } },
  tall: { skin: '#a8a094', hair: '#0a0a0a', hairStyle: 'thin', top: ['#3a3630', '#2a2724', 'plain'], long: true, bottom: '#2d2a26', shoes: null, h: 2.55, thin: 0.52, tallFace: true }
}

function headTexture(o) {
  if (o.tallFace) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d')
    g.fillStyle = '#9d968a'; g.fillRect(0, 0, 512, 256)
    // eyes: pure white, wide, no pupil
    g.fillStyle = '#ffffff'; ;[-1, 1].forEach(s => { g.beginPath(); g.ellipse(128 + s * 24, 112, 13, 8.5, 0, 0, 7); g.fill() })
    g.strokeStyle = 'rgba(20,20,20,.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(112, 175); g.lineTo(144, 175); g.stroke()
    const gr = g.createLinearGradient(0, 256, 0, 40); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,.97)'); gr.addColorStop(0.62, 'rgba(0,0,0,.55)'); gr.addColorStop(0.82, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256)
    g.fillStyle = '#ffffff'; ;[-1, 1].forEach(s => { g.beginPath(); g.ellipse(128 + s * 24, 112, 13, 8.5, 0, 0, 7); g.fill() })
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }
  if (o.flat) { const c = document.createElement('canvas'); c.width = 4; c.height = 4; const g = c.getContext('2d'); g.fillStyle = '#040404'; g.fillRect(0, 0, 4, 4); return new THREE.CanvasTexture(c) }
  return tex.face({ skin: o.skin, male: !o.female, ...o.face })
}

// cheap seeded variety for crowds: height, build, skin and clothing from a few palettes
export function makeVariety(seed = Math.random() * 1e9) {
  let s = (seed >>> 0) || 1
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  return {
    h: 1.5 + rnd() * 0.42,
    fat: 0.86 + rnd() * 0.32,
    skin: pick(['#8d5b3b', '#a46d49', '#9a6544', '#7a4a30', '#b07c55', '#6f462b']),
    top: pick([['#27424a', '#8aa0a6', 'check'], ['#b5532a', '#d9a06a', 'stripe'], ['#3a5a3a', '#9aa87a', 'check'], ['#6a3a5a', '#b090a0', 'stripe'], ['#4a4a52', '#9a9aa0', 'check']]),
    bottom: pick(['#2a3f66', '#6d6347', '#333333', '#4a3a2a']),
    glasses: rnd() < 0.18
  }
}
export function makeRandomPerson(seed) { return makePerson('nishan', makeVariety(seed)) }

export function makePerson(name, over = {}) {
  const o = { ...(OUTFITS[name] || OUTFITS.nishan), ...over }
  const H = o.h, sc = H / 1.74, thin = o.thin || 1
  const fat = o.fat || 1
  const legL = 0.88 * sc, torsoL = 0.56 * sc, neck = 0.07 * sc
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body)
  body.scale.set(fat, 1, fat) // build variety: heavier / slimmer silhouette with one parameter
  const skinM = M({ color: o.skin, roughness: 0.7 })
  const topTex = o.saree ? tex.saree(o.saree[0], o.saree[1]) : (o.top ? tex.cloth(o.top[0], o.top[1], o.top[2]) : null)
  const topM = M({ map: topTex, color: 0xffffff, roughness: 0.95 })
  const botM = M({ color: o.bottom || '#333', roughness: 0.95 })
  { const fn = fabricNormal(5, 4); if (fn) { topM.normalMap = fn; topM.normalScale.set(0.9, 0.9); botM.normalMap = fn; botM.normalScale.set(0.9, 0.9) } }
  if (o.saree) botM.map = tex.saree(o.saree[0], o.saree[1])
  if (o.flat) { skinM.color.set('#040404'); topM.color.set('#040404'); topM.map = null; botM.color.set('#040404') }
  const shoeM = M({ color: o.shoes || o.skin, roughness: 0.7 })
  const hairM = M({ color: o.hair, roughness: 0.6 })
  const mk = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m }

  const hips = new THREE.Group(); hips.position.y = legL; body.add(hips)
  const pelvisW = 0.2 * sc * thin * (o.female ? 1.05 : 1)
  // torso
  const torso = new THREE.Group(); hips.add(torso)
  const chest = mk(cyl(0.2 * sc * thin, 0.17 * sc * thin, torsoL, 14), topM, torso, 0, torsoL / 2, 0); chest.scale.z = 0.62
  if (o.kurta || o.saree) { const skirtLen = o.saree ? 0.75 * sc : 0.38 * sc; const sk = mk(cyl(0.17 * sc * thin, o.saree ? 0.26 * sc : 0.23 * sc, skirtLen, 12), o.saree ? botM : topM, hips, 0, -skirtLen / 2 + 0.05, 0); sk.scale.z = 0.8 }
  const hipM = mk(cyl(0.165 * sc * thin, 0.17 * sc * thin, 0.2 * sc, 12), botM, hips, 0, -0.02, 0); hipM.scale.z = 0.7
  if (o.apron) { const ap = mk(new THREE.BoxGeometry(0.34 * sc, 0.6 * sc, 0.03), M({ color: '#5e564a' }), torso, 0, torsoL * 0.4, 0.17 * sc) }
  if (o.gamchha) { const g = mk(new THREE.TorusGeometry(0.17 * sc * thin, 0.035, 6, 14), M({ map: tex.cloth('#b5342c', '#f0e8d8', 'check') }), torso, 0, torsoL - 0.04, 0); g.rotation.x = Math.PI / 2 + 0.15; g.scale.y = 0.75; const tail = mk(new THREE.BoxGeometry(0.1, 0.5 * sc, 0.02), M({ map: tex.cloth('#b5342c', '#f0e8d8', 'check') }), torso, 0.14 * sc, torsoL - 0.28, 0.14 * sc) }
  // head
  const headG = new THREE.Group(); headG.position.y = torsoL + neck; torso.add(headG)
  mk(cyl(0.045 * sc, 0.055 * sc, neck + 0.05, 8), skinM, torso, 0, torsoL + 0.0, 0)
  const headR = 0.112 * sc * (o.tallFace ? 0.9 : 1)
  const headM = new THREE.MeshStandardMaterial({ map: headTexture(o), roughness: 0.75 })
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 22, 16), headM); head.scale.set(0.86 * thin * 1.1, 1.15, 1.0); head.position.y = headR * 1.05; head.castShadow = true; headG.add(head)
  // ears + nose bump for silhouette
  ;[-1, 1].forEach(s => mk(new THREE.SphereGeometry(headR * 0.2, 8, 6), skinM, headG, s * headR * 0.88 * thin, headR * 1.05, -0.005))
  mk(new THREE.SphereGeometry(headR * 0.16, 8, 6), skinM, headG, 0, headR * 0.98, headR * 0.98).scale.set(0.8, 1.1, 1.0)
  // speaking mouth (opened by the voice clip level)
  let mouthM = null
  if (!o.flat && !o.tallFace) { mouthM = new THREE.Mesh(new THREE.CircleGeometry(headR * 0.14, 14), new THREE.MeshBasicMaterial({ color: '#2a0c09' })); mouthM.position.set(0, headR * 0.4, headR * 0.835); mouthM.rotation.x = 0.55; mouthM.scale.set(1, 0.001, 1); mouthM.visible = false; headG.add(mouthM) }
  // hair
  const hs = o.hairStyle
  if (hs !== 'bald') {
    if (hs === 'turban') { const t = mk(new THREE.SphereGeometry(headR * 1.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), M({ map: tex.cloth(o.turban, '#ffffff', 'stripe'), roughness: 1 }), headG, 0, headR * 1.12, -headR * 0.06); t.scale.set(0.98 * thin * 1.05, 1.0, 1.08) }
    else {
      const cap = mk(new THREE.SphereGeometry(headR * (hs === 'thin' ? 1.02 : 1.07), 12, 8, 0, Math.PI * 2, 0, Math.PI * (hs === 'thin' ? 0.42 : 0.52)), hairM, headG, 0, headR * 1.12, -headR * 0.1); cap.scale.set(0.9 * thin * 1.1, 1.12, 1.08)
      if (hs === 'long' || hs === 'braids') { ;[-1, 1].forEach(s => { for (let i = 0; i < 5; i++) mk(new THREE.SphereGeometry(0.03 * sc, 6, 5), hairM, headG, s * 0.07 * sc, headR * 0.7 - i * 0.07 * sc, -headR * 0.9 - i * 0.012) }) }
      if (hs === 'bun') mk(new THREE.SphereGeometry(headR * 0.5, 10, 8), hairM, headG, 0, headR * 1.2, -headR * 1.0)
    }
  }
  if (o.saree) { const pallu = mk(new THREE.SphereGeometry(headR * 1.08, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M({ map: tex.saree(o.saree[0], o.saree[1]), side: THREE.DoubleSide }), headG, 0, headR * 1.1, -headR * 0.18); pallu.scale.set(1, 1.12, 1.08); pallu.visible = false; o._pallu = pallu }
  if (o.glasses) { ;[-1, 1].forEach(s => { const r = mk(new THREE.TorusGeometry(headR * 0.28, 0.006, 6, 14), M({ color: '#111', metalness: 0.6, roughness: 0.4 }), headG, s * headR * 0.31 * thin * 1.1, headR * 1.12, headR * 0.93); r.scale.set(1.15, 1, 1) }); mk(new THREE.BoxGeometry(headR * 0.2, 0.006, 0.006), M({ color: '#111' }), headG, 0, headR * 1.15, headR * 0.98) }
  // arms
  const arms = []
  const sleeveLong = !!o.long
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * (0.205 * sc * thin + 0.035), torsoL - 0.06, 0); torso.add(sh)
    const upL = 0.29 * sc, loL = 0.27 * sc
    mk(new THREE.SphereGeometry(0.05 * sc, 8, 6), o.saree || o.top ? topM : skinM, sh, 0, 0, 0)
    mk(new THREE.CapsuleGeometry(0.043 * sc, upL - 0.086 * sc, 2, 8), o.saree || o.top ? topM : skinM, sh, 0, -upL / 2, 0)
    const el = new THREE.Group(); el.position.y = -upL; sh.add(el)
    mk(new THREE.CapsuleGeometry(0.036 * sc, loL - 0.072 * sc, 2, 8), sleeveLong ? topM : skinM, el, 0, -loL / 2, 0)
    const hand = mk(new THREE.SphereGeometry(0.043 * sc, 8, 6), skinM, el, 0, -loL - 0.02, 0); hand.scale.set(0.9, 1.25, 0.6)
    if (o.bangles) for (let i = 0; i < 3; i++) { const b = mk(new THREE.TorusGeometry(0.034 * sc, 0.006, 5, 10), M({ color: i % 2 ? '#c8a21a' : '#2a8a4a', metalness: 0.7, roughness: 0.3 }), el, 0, -loL + 0.01 - i * 0.012, 0); b.rotation.x = Math.PI / 2 }
    arms.push({ sh, el })
  }
  // legs
  const legs = []
  for (const s of [-1, 1]) {
    const hp = new THREE.Group(); hp.position.set(s * pelvisW * 0.55, -0.04, 0); hips.add(hp)
    const thL = legL * 0.5, shL = legL * 0.5 - 0.06
    const trouser = botM
    const th = mk(new THREE.CapsuleGeometry(0.075 * sc * thin, Math.max(0.05, thL - 0.15 * sc * thin), 2, 8), trouser, hp, 0, -thL / 2, 0)
    const kn = new THREE.Group(); kn.position.y = -thL; hp.add(kn)
    mk(new THREE.CapsuleGeometry(0.052 * sc * thin, Math.max(0.05, shL - 0.104 * sc * thin), 2, 8), o.lungi ? skinM : trouser, kn, 0, -shL / 2, 0)
    const foot = mk(new THREE.SphereGeometry(0.06 * sc, 8, 6), shoeM, kn, 0, -shL - 0.03, 0.06 * sc); foot.scale.set(0.85, 0.55, 2.1)
    legs.push({ hp, kn, foot })
  }
  if (o.lungi) { const l = mk(cyl(0.2 * sc, 0.25 * sc, 0.62 * sc, 12), botM, hips, 0, -0.3 * sc, 0); l.scale.z = 0.8; l.material = M({ map: tex.cloth(o.bottom, '#d9d2b0', 'check') }) }

  const P = {
    root, body, hips, torso, headG, arms, legs, o, sc, legL, mouthM, mouth: 0, phase: 0, speed: 0, pose: 'stand', crouch: 0, lookY: 0, lookX: 0, tremble: 0, held: null, t: Math.random() * 10, headR,
    setPose(p) { this.pose = p },
    hold(obj, side = 1, off = [0, -0.3, 0.12]) {
      if (this.held) this.held.parent && this.held.parent.remove(this.held)
      this.held = obj
      if (obj) {
        arms[side > 0 ? 1 : 0].el.add(obj)
        obj.position.set(...off.map(v => v * sc))
        this._holdBase = obj.position.clone()
      } else this._holdBase = null
    },
    update(dt, speed = 0) {
      if (mouthM) { const m = this.mouth; mouthM.visible = m > 0.06; mouthM.scale.y = 0.12 + clamp(m * 2.6, 0, 1) * 1.1 }
      this.t += dt; this.speed = damp(this.speed, speed, 8, dt)
      const sp = this.speed, w = clamp(sp / 1.6, 0, 1.4), ph = (this.phase += dt * sp * 2.6)
      const idleB = Math.sin(this.t * 1.7) * 0.012
      let hipY = legL, tilt = 0, la = 0, ra = 0, lk = 0, rk = 0, la_el = 0.12, ra_el = 0.12, sit = 0
      const pose = this.pose
      if (pose === 'sit' || pose === 'pillion' || pose === 'sit_eat' || pose === 'sit_drink') sit = 1
      if (sp > 0.05 && !sit) {
        const sw = Math.sin(ph) * 0.62 * w, sw2 = Math.sin(ph + Math.PI) * 0.62 * w
        legs[0].hp.rotation.x = sw; legs[1].hp.rotation.x = sw2
        legs[0].kn.rotation.x = Math.max(0, -Math.cos(ph)) * 0.8 * w; legs[1].kn.rotation.x = Math.max(0, Math.cos(ph)) * 0.8 * w
        arms[0].sh.rotation.x = sw2 * 0.7; arms[1].sh.rotation.x = sw * 0.7
        hipY = legL - Math.abs(Math.cos(ph)) * 0.03 * w; tilt = 0.06 * w
        arms[0].el.rotation.x = -0.15 - w * 0.25; arms[1].el.rotation.x = -0.15 - w * 0.25
        torso.rotation.y = Math.sin(ph) * 0.07 * w
      } else if (sit) {
        hipY = legL * 0.5 + (pose === 'pillion' ? 0.0 : -0.05)
        legs.forEach((l, i) => { l.hp.rotation.x = pose === 'pillion' ? -1.35 : -1.5; l.kn.rotation.x = pose === 'pillion' ? 1.45 : 1.55; l.hp.rotation.z = (i ? -1 : 1) * (pose === 'pillion' ? 0.18 : 0.05) })
        arms.forEach(a => { a.sh.rotation.x = pose === 'pillion' ? -0.9 : -0.35; a.el.rotation.x = pose === 'pillion' ? -0.6 : -0.9 })
        tilt = pose === 'pillion' ? 0.18 : 0.02
      } else {
        legs.forEach(l => { l.hp.rotation.x *= 0.85; l.kn.rotation.x *= 0.85; l.hp.rotation.z = 0 })
        arms.forEach(a => { a.sh.rotation.x *= 0.85; a.el.rotation.x = lerp(a.el.rotation.x, -0.12, 0.1) })
        torso.rotation.y *= 0.9
      }
      if (this.crouch > 0.01 && !sit) {
        const c = this.crouch; hipY = legL * (1 - 0.42 * c); legs.forEach(l => { l.hp.rotation.x = -1.2 * c; l.kn.rotation.x = 1.9 * c }); tilt = 0.3 * c
      }
      if (pose === 'hands_up') { arms.forEach(a => { a.sh.rotation.x = -2.6; a.el.rotation.x = -0.3 }) }
      if (pose === 'hug') { arms.forEach((a, i) => { a.sh.rotation.x = -0.8; a.sh.rotation.z = (i ? 1 : -1) * 0.25; a.el.rotation.x = -1.4 }) }
      if (pose === 'drink') { arms[1].sh.rotation.x = -1.1; arms[1].el.rotation.x = -1.9 }
      if (pose === 'strike') { const k = (this.t * 1.6) % 1; const up = k < 0.55 ? k / 0.55 : 1 - (k - 0.55) / 0.12; arms.forEach(a => { a.sh.rotation.x = -(0.4 + 2.1 * clamp(up, 0, 1)); a.el.rotation.x = -0.3 }); tilt = 0.25 - clamp(up, 0, 1) * 0.5 }
      if (pose === 'point') { arms[1].sh.rotation.x = -1.55; arms[1].el.rotation.x = -0.05 }
      if (pose === 'push') { arms.forEach(a => { a.sh.rotation.x = -1.0; a.el.rotation.x = -0.35 }); tilt = 0.18 }
      if (pose === 'steer') { // walking the bike, both hands on the handlebars
        arms.forEach((a, i) => { a.sh.rotation.x = -1.2; a.sh.rotation.z = (i ? -1 : 1) * 0.14; a.el.rotation.x = -0.3 })
        tilt = 0.06
      }
      if (pose === 'rub') { arms.forEach((a, i) => { a.sh.rotation.x = -0.9 + Math.sin(this.t * 7 + i) * 0.1; a.el.rotation.x = -1.7; a.sh.rotation.z = (i ? 1 : -1) * 0.5 }); tilt = 0.12 }
      // ---- everyday life: eating, drinking, handing things over ------------
      // Hand-to-mouth cycles are deliberately small: food is a warm, ordinary
      // beat, not a performance. The chew is applied after head look below.
      this._bite = 0
      if (pose === 'eat' || pose === 'bite' || pose === 'sit_eat') {
        const cyc = (this.t * 1.35) % 1
        this._bite = cyc < 0.45 ? Math.sin((cyc / 0.45) * Math.PI) : 0
        arms[1].sh.rotation.x = (sit ? -0.35 : -0.62) - this._bite * 0.85
        arms[1].el.rotation.x = (sit ? -0.9 : -1.15) - this._bite * 0.7
        tilt = 0.03
      }
      if (pose === 'sip' || pose === 'sit_drink') {
        const cyc = (this.t * 0.7) % 1
        const lift = cyc < 0.5 ? Math.sin((cyc / 0.5) * Math.PI) : 0
        this._bite = lift * 0.5
        arms[1].sh.rotation.x = (sit ? -0.35 : -0.7) - lift * 0.55
        arms[1].el.rotation.x = (sit ? -0.9 : -1.35) - lift * 0.5
      }
      if (pose === 'offer') { arms[1].sh.rotation.x = -1.0; arms[1].el.rotation.x = -0.55; tilt = 0.04 }
      if (pose === 'photo') { arms.forEach(a => { a.sh.rotation.x = -1.5; a.el.rotation.x = -1.05 }) }
      if (pose === 'wave') { arms[1].sh.rotation.x = -2.4; arms[1].sh.rotation.z = -0.4 + Math.sin(this.t * 9) * 0.22; arms[1].el.rotation.x = -0.2 }
      if (pose === 'hold_hand') { arms.forEach((a, i) => { a.sh.rotation.x = -0.5; a.sh.rotation.z = (i ? -1 : 1) * 0.28; a.el.rotation.x = -0.7 }) }
      if (pose === 'fallen') { body.rotation.z = lerp(body.rotation.z, 1.5, 0.08); hipY = 0.2 }
      else body.rotation.z = lerp(body.rotation.z, 0, 0.12)
      if (this.tremble > 0) { const tr = this.tremble; torso.rotation.z = Math.sin(this.t * 38) * 0.02 * tr; arms.forEach(a => { a.sh.rotation.z += Math.sin(this.t * 41) * 0.02 * tr }) }
      else torso.rotation.z *= 0.8
      hips.position.y = hipY + idleB; hips.rotation.x = tilt * 0.5; torso.rotation.x = tilt * 0.6
      // subtle life: breathing and a slow idle sway, stronger when standing still
      const breath = Math.sin(this.t * 1.9) * 0.016 * (1 - w * 0.5)
      torso.scale.set(1 + breath, 1 + breath * 0.7, 1 + breath) // body group already carries the fat factor
      headG.rotation.z = Math.sin(this.t * 0.85) * 0.018 * (1 - w)
      headG.position.y = torsoL + neck + Math.sin(this.t * 1.9 + 0.5) * 0.006
      headG.rotation.y = damp(headG.rotation.y, clamp(this.lookY, -1.1, 1.1), 7, dt); headG.rotation.x = damp(headG.rotation.x, clamp(this.lookX, -0.6, 0.6) - tilt * 0.5, 7, dt)
      if (this._bite > 0.4) {
        headG.rotation.x += this._bite * 0.13
        if (mouthM) { mouthM.visible = true; mouthM.scale.y = 0.5 + Math.sin(this.t * 14) * 0.22 }
      }
      // The held cup/biscuit rides the hand up to the mouth instead of hanging
      // at a fixed offset — the object is part of the gesture, not just carried.
      if (this.held && this._holdBase) {
        if (this._bite > 0) this.held.position.set(this._holdBase.x, this._holdBase.y + this._bite * 0.07 * sc, this._holdBase.z - this._bite * 0.06 * sc)
        else this.held.position.lerp(this._holdBase, Math.min(1, dt * 6))
      }
    }
  }
  return P
}

// held props
export function makeTorch() {
  const g = new THREE.Group(); const m = new THREE.Mesh(cyl(0.022, 0.02, 0.17, 10), M({ color: '#222', metalness: 0.6, roughness: 0.4 })); g.add(m)
  const head = new THREE.Mesh(cyl(0.032, 0.022, 0.05, 10), M({ color: '#444', metalness: 0.8, roughness: 0.3 })); head.position.y = 0.1; g.add(head)
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: '#fff6d0' })); lens.rotation.x = -Math.PI / 2; lens.position.y = 0.126; lens.name = 'lens'; g.add(lens)
  return g
}
export function makeGlass(fill = true, col = '#a1121b') {
  const g = new THREE.Group()
  const gl = new THREE.Mesh(cyl(0.036, 0.028, 0.1, 12), new THREE.MeshPhysicalMaterial({ color: '#dfe8ee', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, clearcoat: 1 })); gl.position.y = 0.05; g.add(gl)
  if (fill) { const l = new THREE.Mesh(cyl(0.033, 0.0275, 0.075, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.25, emissive: new THREE.Color(col).multiplyScalar(0.06) })); l.position.y = 0.043; l.name = 'liquid'; g.add(l) }
  return g
}
export function makeSteelGlass() {
  const g = new THREE.Group(); const gl = new THREE.Mesh(cyl(0.04, 0.032, 0.11, 16), new THREE.MeshStandardMaterial({ color: '#b9bdc2', metalness: 0.9, roughness: 0.28 })); gl.position.y = 0.055; g.add(gl); return g
}
export function makeTiffin() {
  const g = new THREE.Group(); const st = new THREE.MeshStandardMaterial({ color: '#c3c7cc', metalness: 0.9, roughness: 0.3 })
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(cyl(0.085, 0.085, 0.07, 12), st); c.position.y = 0.04 + i * 0.075; g.add(c); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.004, 5, 18), st); ring.rotation.x = Math.PI / 2; ring.position.y = 0.075 + i * 0.075; g.add(ring) }
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 5, 14, Math.PI), st); h.position.y = 0.3; h.rotation.z = 0; g.add(h)
  const bar = new THREE.Mesh(cyl(0.004, 0.004, 0.28), st); bar.position.set(0.09, 0.16, 0); g.add(bar); const bar2 = bar.clone(); bar2.position.x = -0.09; g.add(bar2)
  return g
}
export function makePickaxe() {
  const g = new THREE.Group(); const wood = new THREE.Mesh(cyl(0.018, 0.02, 1.3, 8), M({ color: '#5a4026' })); wood.position.y = 0.0; g.add(wood)
  const iron = M({ color: '#5a5d60', metalness: 0.7, roughness: 0.5, map: (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#585b5e'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#b9b5aa'; for (let i = 0; i < 40; i++) { x.globalAlpha = 0.5; x.beginPath(); x.arc(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 6, 0, 7); x.fill() } return new THREE.CanvasTexture(c) })() })
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.045, 0.045), iron); head.position.y = 0.62; g.add(head)
  ;[-1, 1].forEach(s => { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 6), iron); tip.rotation.z = -s * Math.PI / 2; tip.position.set(s * 0.37, 0.62, 0); g.add(tip) })
  return g
}
