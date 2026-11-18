import * as THREE from 'three'
import { pfbm, pnoise, RNG, clamp } from '../core/util.js'

const cache = {}
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
function toTex(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry); t.anisotropy = 4
  return t
}
function pixel(w, h, fn) {
  const c = mk(w, h), g = c.getContext('2d'), id = g.createImageData(w, h), d = id.data
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, v = fn(x / w, y / h)
    d[o] = clamp(v[0], 0, 255); d[o + 1] = clamp(v[1], 0, 255); d[o + 2] = clamp(v[2], 0, 255); d[o + 3] = v[3] === undefined ? 255 : v[3]
  }
  g.putImageData(id, 0, 0); return c
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const hex = (s) => { const n = parseInt(s.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function once(key, f) { return cache[key] || (cache[key] = f()) }

export const tex = {
  // A cheap sky/ground environment so metals and glass have something to
  // reflect. Three auto-PMREMs this when assigned to scene.environment.
  envMap: () => once('envmap', () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128
    const x = c.getContext('2d')
    const g = x.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, '#aebfd2'); g.addColorStop(0.42, '#8795a3'); g.addColorStop(0.52, '#6b6553'); g.addColorStop(1, '#1b1916')
    x.fillStyle = g; x.fillRect(0, 0, 256, 128)
    const s = x.createRadialGradient(178, 38, 2, 178, 38, 54)
    s.addColorStop(0, 'rgba(255,244,214,0.95)'); s.addColorStop(1, 'rgba(255,244,214,0)')
    x.fillStyle = s; x.fillRect(0, 0, 256, 90)
    const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping
    t.colorSpace = THREE.SRGBColorSpace; return t
  }),
  grass: () => once('grass', () => toTex(pixel(256, 256, (u, v) => {
    const n = pfbm(u * 8, v * 8, 8, 4), m = pfbm(u * 32, v * 32, 32, 2)
    const c = mix([38, 52, 24], [88, 98, 44], n)
    const k = 0.75 + m * 0.5
    return [c[0] * k, c[1] * k, c[2] * k]
  }), 24, 24)),
  mud: () => once('mud', () => toTex(pixel(256, 256, (u, v) => {
    const n = pfbm(u * 6, v * 6, 6, 4), m = pfbm(u * 40, v * 40, 40, 2)
    const c = mix([62, 44, 30], [118, 86, 58], n)
    const k = 0.7 + m * 0.6
    return [c[0] * k, c[1] * k, c[2] * k]
  }), 20, 20)),
  leaf: () => once('leaf', () => toTex(pixel(256, 256, (u, v) => {
    const n = pfbm(u * 10, v * 10, 10, 4), m = pnoise(u * 48, v * 48, 48)
    const c = mix([20, 44, 18], [74, 112, 38], n * 0.8 + m * 0.35)
    return c
  }), 2, 2)),
  bark: () => once('bark', () => toTex(pixel(128, 256, (u, v) => {
    const n = pfbm(u * 6, v * 1.5, 6, 4), m = pnoise(u * 24, v * 4, 24)
    const k = 0.45 + n * 0.8 + (m > 0.6 ? -0.18 : 0)
    return [86 * k, 70 * k, 56 * k]
  }), 1, 3)),
  barkLight: () => once('barkL', () => toTex(pixel(128, 256, (u, v) => {
    const n = pfbm(u * 8, v * 2, 8, 3)
    const k = 0.7 + n * 0.5
    return [150 * k, 138 * k, 120 * k]
  }), 1, 3)),
  bamboo: () => once('bamboo', () => toTex(pixel(32, 128, (u, v) => {
    const node = Math.abs(((v * 4) % 1) - 0.02) < 0.04 ? 0.6 : 1
    const n = pnoise(u * 8, v * 16, 8)
    const c = mix([98, 120, 40], [146, 150, 60], n)
    return [c[0] * node, c[1] * node, c[2] * node]
  }), 1, 1)),
  road: () => once('road', () => toTex(pixel(256, 256, (u, v) => {
    const n = pfbm(u * 20, v * 20, 20, 3), m = pnoise(u * 90, v * 90, 90)
    const k = 0.7 + n * 0.5 + m * 0.2
    return [58 * k, 58 * k, 62 * k]
  }), 3, 40)),
  plaster: (col = '#d8c9a8') => once('pl' + col, () => { const b = hex(col); return toTex(pixel(256, 256, (u, v) => {
    const n = pfbm(u * 5, v * 5, 5, 4), s = pfbm(u * 3, v * 14, 3, 3)
    const k = 0.72 + n * 0.4 - (s > 0.62 ? (s - 0.62) * 1.2 : 0)
    return [b[0] * k, b[1] * k, b[2] * k]
  }), 2, 2) }),
  mudwall: () => once('mudwall', () => toTex(pixel(256, 256, (u, v) => {
    const n = pfbm(u * 6, v * 6, 6, 4), m = pnoise(u * 60, v * 60, 60)
    const c = mix([104, 76, 52], [150, 116, 84], n)
    const k = 0.8 + m * 0.3
    return [c[0] * k, c[1] * k, c[2] * k]
  }), 2, 1)),
  brick: () => once('brick', () => toTex(pixel(256, 256, (u, v) => {
    const row = Math.floor(v * 8), off = (row % 2) * 0.5
    const bu = ((u * 4 + off) % 1), bv = (v * 8) % 1
    const mortar = bu < 0.04 || bv < 0.08
    const n = pfbm(u * 20, v * 20, 20, 2)
    if (mortar) return [150, 145, 135]
    const k = 0.7 + n * 0.5
    return [150 * k, 70 * k, 52 * k]
  }), 2, 2)),
  tile: () => once('tile', () => toTex(pixel(128, 128, (u, v) => {
    const s = Math.sin(u * Math.PI * 12) * 0.5 + 0.5, n = pfbm(u * 10, v * 10, 10, 2)
    const k = 0.5 + s * 0.5 + n * 0.3
    return [170 * k, 80 * k, 50 * k]
  }), 6, 6)),
  tin: () => once('tin', () => toTex(pixel(128, 128, (u, v) => {
    const s = Math.sin(u * Math.PI * 16) * 0.5 + 0.5, n = pfbm(u * 6, v * 6, 6, 3)
    const rust = n > 0.55 ? (n - 0.55) * 2.2 : 0
    const k = 0.5 + s * 0.35
    return mix([128 * k, 134 * k, 138 * k], [120, 60, 30], clamp(rust, 0, 0.8))
  }), 4, 4)),
  thatch: () => once('thatch', () => toTex(pixel(128, 128, (u, v) => {
    const n = pnoise(u * 4, v * 60, 4) * 0.7 + pnoise(u * 20, v * 80, 20) * 0.3
    const k = 0.45 + n * 0.8
    return [150 * k, 120 * k, 66 * k]
  }), 4, 3)),
  wood: (col = '#5a3f2a') => once('wd' + col, () => { const b = hex(col); return toTex(pixel(128, 128, (u, v) => {
    const n = pfbm(u * 2, v * 18, 2, 4)
    const k = 0.6 + n * 0.7
    return [b[0] * k, b[1] * k, b[2] * k]
  }), 2, 2) }),
  stone: (col = '#8a8a82') => once('st' + col, () => { const b = hex(col); return toTex(pixel(128, 128, (u, v) => {
    const n = pfbm(u * 8, v * 8, 8, 4), m = pnoise(u * 50, v * 50, 50)
    const moss = pfbm(u * 5 + 3, v * 5, 5, 3) > 0.62
    const k = 0.6 + n * 0.6 + m * 0.15
    return moss ? [b[0] * k * 0.55, b[1] * k * 0.8, b[2] * k * 0.5] : [b[0] * k, b[1] * k, b[2] * k]
  }), 2, 2) }),
  cement: () => once('cement', () => toTex(pixel(128, 128, (u, v) => {
    const n = pfbm(u * 10, v * 10, 10, 4)
    const k = 0.6 + n * 0.5
    return [150 * k, 150 * k, 146 * k]
  }), 2, 2)),
  tileFloor: (a = '#b8ad98', b = '#a69b86') => once('tf' + a + b, () => { const A = hex(a), B = hex(b); return toTex(pixel(256, 256, (u, v) => {
    const x = Math.floor(u * 4), y = Math.floor(v * 4), t = (x + y) % 2
    const g = (u * 4 % 1 < 0.025 || v * 4 % 1 < 0.025) ? 0.55 : 1
    const n = pfbm(u * 12, v * 12, 12, 3)
    const c = t ? A : B, k = g * (0.8 + n * 0.35)
    return [c[0] * k, c[1] * k, c[2] * k]
  }), 3, 3) }),
  earthFloor: () => once('earthfloor', () => toTex(pixel(256, 256, (u, v) => {
    const n = pfbm(u * 6, v * 6, 6, 4), m = pnoise(u * 60, v * 60, 60)
    const c = mix([96, 74, 54], [138, 108, 80], n)
    const k = 0.85 + m * 0.2
    return [c[0] * k, c[1] * k, c[2] * k]
  }), 3, 3)),
  ash: () => once('ash', () => toTex(pixel(256, 256, (u, v) => {
    const n = pfbm(u * 8, v * 8, 8, 4), m = pnoise(u * 50, v * 50, 50)
    const k = 0.35 + n * 0.5 + m * 0.2
    return [90 * k, 88 * k, 84 * k]
  }), 8, 8)),
  // alpha cards
  foliage: () => once('foliage', () => {
    const c = mk(256, 256), g = c.getContext('2d'), r = new RNG(7)
    for (let i = 0; i < 90; i++) {
      const x = r.range(20, 236), y = r.range(20, 236), a = r.range(0, Math.PI * 2), l = r.range(14, 30)
      const sh = r.range(0.5, 1)
      g.save(); g.translate(x, y); g.rotate(a)
      g.fillStyle = `rgb(${30 * sh | 0},${(70 + 50 * sh) | 0},${24 * sh | 0})`
      g.beginPath(); g.ellipse(0, 0, l, l * 0.38, 0, 0, Math.PI * 2); g.fill(); g.restore()
    }
    const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t
  }),
  fern: () => once('fern', () => {
    const c = mk(256, 256), g = c.getContext('2d'), r = new RNG(11)
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + r.range(-0.9, 0.9), len = r.range(100, 190)
      g.save(); g.translate(128, 250); g.rotate(a + Math.PI / 2)
      for (let i = 0; i < 26; i++) {
        const t = i / 26, y = -t * len, w = (1 - t) * 26 + 3
        const sh = 0.5 + r.range(0, 0.5)
        g.fillStyle = `rgb(${(26 * sh) | 0},${(70 + 60 * sh) | 0},${(20 * sh) | 0})`
        g.beginPath(); g.ellipse(-w * 0.5, y, w * 0.5, 3, 0.3, 0, 7); g.fill()
        g.beginPath(); g.ellipse(w * 0.5, y, w * 0.5, 3, -0.3, 0, 7); g.fill()
      }
      g.restore()
    }
    const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t
  }),
  grassBlades: () => once('blades', () => {
    const c = mk(128, 128), g = c.getContext('2d'), r = new RNG(5)
    for (let i = 0; i < 46; i++) {
      const x = r.range(6, 122), h = r.range(50, 120), lean = r.range(-22, 22), sh = r.range(0.45, 1)
      g.strokeStyle = `rgb(${(50 * sh) | 0},${(90 + 60 * sh) | 0},${(28 * sh) | 0})`
      g.lineWidth = r.range(1.4, 3)
      g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.6, x + lean, 128 - h); g.stroke()
    }
    const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t
  }),
  bambooLeaf: () => once('bleaf', () => {
    const c = mk(128, 128), g = c.getContext('2d'), r = new RNG(3)
    for (let i = 0; i < 40; i++) {
      const a = r.range(0, Math.PI * 2), x = 64 + Math.cos(a) * r.range(0, 40), y = 64 + Math.sin(a) * r.range(0, 40)
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgb(${50 + r.range(0, 30) | 0},${100 + r.range(0, 40) | 0},30)`
      g.beginPath(); g.ellipse(0, 0, 20, 3.4, 0, 0, 7); g.fill(); g.restore()
    }
    const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t
  }),
  glow: () => once('glow', () => {
    const c = mk(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }),
  sign: (text, bg = '#c9a227', fg = '#1a1a1a', w = 512, h = 128, font = '700 64px "Noto Sans Devanagari", sans-serif') => {
    const c = mk(w, h), g = c.getContext('2d')
    const [family, startPx] = [font.slice(font.indexOf('px') + 2).trim() || 'sans-serif', parseInt((font.match(/(\d+)px/) || [])[1] || '48', 10)]
    const lines = text.split('\n')
    const draw = () => {
      g.clearRect(0, 0, w, h)
      g.fillStyle = bg; g.fillRect(0, 0, w, h)
      g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12)
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'
      // shrink the type until the longest line fits the board (Devanagari strings are wide)
      let px = startPx
      do { g.font = font.replace(/\d+px/, px + 'px'); px -= 2 } while (px > 12 && Math.max(...lines.map(ln => g.measureText(ln).width)) > w - 28)
      const step = Math.min(h / (lines.length + 0.7), px + 12)
      lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * step))
    }
    draw()
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
    // web fonts load asynchronously — redraw once they are ready so the sign is never tofu boxes
    if (typeof document !== 'undefined' && document.fonts && !document.fonts.check(font)) {
      document.fonts.ready.then(() => { draw(); t.needsUpdate = true }).catch(() => {})
    }
    return t
  },
  cloth: (a, b, kind = 'check') => once('cl' + a + b + kind, () => {
    const c = mk(128, 128), g = c.getContext('2d')
    g.fillStyle = a; g.fillRect(0, 0, 128, 128)
    g.fillStyle = b
    if (kind === 'check') { g.globalAlpha = 0.55; for (let i = 0; i < 128; i += 32) { g.fillRect(i, 0, 14, 128); g.fillRect(0, i, 128, 14) } }
    else if (kind === 'stripe') { g.globalAlpha = 0.6; for (let i = 0; i < 128; i += 24) g.fillRect(i, 0, 8, 128) }
    else if (kind === 'print') { g.globalAlpha = 0.7; const r = new RNG(9); for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r.range(0, 128), r.range(0, 128), r.range(2, 5), 0, 7); g.fill() } }
    g.globalAlpha = 1
    const id = g.getImageData(0, 0, 128, 128), d = id.data
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n }
    g.putImageData(id, 0, 0)
    return toTex(c, 1, 1)
  }),
  saree: (a = '#9b1c31', b = '#e0b13a') => once('saree' + a + b, () => {
    const c = mk(128, 128), g = c.getContext('2d')
    g.fillStyle = a; g.fillRect(0, 0, 128, 128)
    g.fillStyle = b; g.fillRect(0, 108, 128, 12); g.fillRect(0, 100, 128, 3)
    g.globalAlpha = 0.35; const r = new RNG(4); for (let i = 0; i < 36; i++) { g.beginPath(); g.arc(r.range(0, 128), r.range(0, 96), 2.2, 0, 7); g.fill() }
    g.globalAlpha = 1
    return toTex(c, 2, 1)
  }),
  face: (o = {}) => {
    const { skin = '#8f5c3d', brow = '#1c120c', male = true, stache = false, beard = 0, bindi = false, age = 0, eyeWhite = false, hollow = false } = o
    const c = mk(512, 256), g = c.getContext('2d')
    const sk = hex(skin)
    // base with subtle gradient & noise
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, `rgb(${sk[0] * 0.92},${sk[1] * 0.92},${sk[2] * 0.92})`); gr.addColorStop(1, `rgb(${sk[0] * 0.82},${sk[1] * 0.8},${sk[2] * 0.8})`)
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256)
    const id = g.getImageData(0, 0, 512, 256), d = id.data
    for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) { const o2 = (y * 512 + x) * 4, n = (pnoise(x / 6, y / 6, 90) - 0.5) * 22; d[o2] += n; d[o2 + 1] += n; d[o2 + 2] += n }
    g.putImageData(id, 0, 0)
    const cx = 128, cy = 132 // face centre on 512 wide (u=.25 -> 128 on a 512 map covering full circumference? we map 0..1 -> 512)
    const fx = 128 // u=.25
    // eye sockets shade
    const eyeY = 118, eyeDX = 26
    g.fillStyle = 'rgba(40,20,10,.25)'
    ;[-1, 1].forEach(s => { g.beginPath(); g.ellipse(fx + s * eyeDX, eyeY + 2, 17, 11, 0, 0, 7); g.fill() })
    // eyes
    ;[-1, 1].forEach(s => {
      g.fillStyle = eyeWhite ? '#f4f4ee' : '#e8e2d4'
      g.beginPath(); g.ellipse(fx + s * eyeDX, eyeY, 12, 6.5, 0, 0, 7); g.fill()
      if (!eyeWhite) {
        g.fillStyle = '#2a170d'; g.beginPath(); g.arc(fx + s * eyeDX, eyeY, 5.2, 0, 7); g.fill()
        g.fillStyle = '#000'; g.beginPath(); g.arc(fx + s * eyeDX, eyeY, 2.4, 0, 7); g.fill()
        g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(fx + s * eyeDX - 1.6, eyeY - 1.8, 1.2, 0, 7); g.fill()
      }
      g.strokeStyle = 'rgba(20,10,5,.85)'; g.lineWidth = 2; g.beginPath(); g.ellipse(fx + s * eyeDX, eyeY, 12, 6.5, 0, Math.PI, 0); g.stroke()
    })
    // brows
    g.strokeStyle = brow; g.lineCap = 'round'
    ;[-1, 1].forEach(s => { g.lineWidth = male ? 6.5 : 4; g.beginPath(); g.moveTo(fx + s * 12, eyeY - 17); g.quadraticCurveTo(fx + s * 30, eyeY - 24, fx + s * 45, eyeY - 15); g.stroke() })
    // nose
    g.fillStyle = 'rgba(40,18,8,.28)'; g.beginPath(); g.ellipse(fx, 150, 9, 6, 0, 0, 7); g.fill()
    g.fillStyle = 'rgba(0,0,0,.45)'; ;[-1, 1].forEach(s => { g.beginPath(); g.ellipse(fx + s * 5, 152, 2.4, 1.8, 0, 0, 7); g.fill() })
    g.strokeStyle = 'rgba(40,18,8,.18)'; g.lineWidth = 4; g.beginPath(); g.moveTo(fx - 4, 124); g.lineTo(fx - 7, 148); g.moveTo(fx + 4, 124); g.lineTo(fx + 7, 148); g.stroke()
    // mouth
    g.fillStyle = male ? '#5e2c22' : '#a8423c'; g.beginPath(); g.ellipse(fx, 178, 14, male ? 3.2 : 4.2, 0, 0, 7); g.fill()
    if (stache) { g.fillStyle = brow; g.beginPath(); g.moveTo(fx - 26, 168); g.quadraticCurveTo(fx, 158, fx + 26, 168); g.quadraticCurveTo(fx + 12, 176, fx, 171); g.quadraticCurveTo(fx - 12, 176, fx - 26, 168); g.fill() }
    if (beard) { g.fillStyle = `rgba(20,14,10,${beard})`; g.beginPath(); g.ellipse(fx, 190, 44, 36, 0, 0, Math.PI); g.fill() }
    if (bindi) { g.fillStyle = '#b01020'; g.beginPath(); g.arc(fx, eyeY - 22, 3.4, 0, 7); g.fill() }
    if (age) { g.strokeStyle = `rgba(30,15,8,${0.12 * age})`; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(fx - 36, 84 + i * 6); g.quadraticCurveTo(fx, 78 + i * 6, fx + 36, 84 + i * 6); g.stroke() } g.beginPath(); g.moveTo(fx - 22, 164); g.quadraticCurveTo(fx - 28, 176, fx - 22, 188); g.moveTo(fx + 22, 164); g.quadraticCurveTo(fx + 28, 176, fx + 22, 188); g.stroke() }
    if (hollow) { g.fillStyle = 'rgba(0,0,0,.35)'; ;[-1, 1].forEach(s => { g.beginPath(); g.ellipse(fx + s * eyeDX, eyeY + 4, 18, 14, 0, 0, 7); g.fill() }); g.beginPath(); g.ellipse(fx, 188, 20, 16, 0, 0, 7); g.fill() }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
  },
  photoWoman: () => once('photo', () => {
    const c = mk(128, 160), g = c.getContext('2d')
    g.fillStyle = '#c9c0a8'; g.fillRect(0, 0, 128, 160)
    g.fillStyle = '#3a2a22'; g.beginPath(); g.ellipse(64, 66, 30, 36, 0, 0, 7); g.fill()
    g.fillStyle = '#9b6a4a'; g.beginPath(); g.ellipse(64, 72, 22, 28, 0, 0, 7); g.fill()
    g.fillStyle = '#9b1c31'; g.beginPath(); g.moveTo(14, 160); g.quadraticCurveTo(64, 96, 114, 160); g.fill()
    g.fillStyle = '#1a0f0a'; g.beginPath(); g.arc(54, 68, 2.4, 0, 7); g.arc(74, 68, 2.4, 0, 7); g.fill()
    g.fillStyle = '#b01020'; g.beginPath(); g.arc(64, 52, 2.4, 0, 7); g.fill()
    g.fillStyle = '#e8a010'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(20 + i * 5.5, 124 + Math.sin(i) * 6, 5, 0, 7); g.fill() }
    return new THREE.CanvasTexture(c)
  })
}
export const wrapRepeat = (t, x, y) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(x, y); return c }

// ================= Poly Haven CC0 PBR layer =================
// Real photographic PBR sets (public/tex/*). If they fail to load, the procedural textures above stay in use.
const SETS = {
  plaster:    { slug: 'beige_wall_001',       m: 2.4, tint: true },
  mudwall:    { slug: 'clay_plaster',         m: 2.0 },
  brick:      { slug: 'brick_wall_02',        m: 2.0 },
  tile:       { slug: 'clay_roof_tiles_02',   m: 1.6 },
  tin:        { slug: 'corrugated_iron_03',   m: 2.0 },
  wood:       { slug: 'wood_planks',          m: 1.2, tint: true },
  cement:     { slug: 'concrete_wall_008',    m: 2.2 },
  tileFloor:  { slug: 'floor_tiles_06',       m: 2.2 },
  earthFloor: { slug: 'dirt_floor',           m: 3.0 },
  stone:      { slug: 'rock_boulder_dry',     m: 1.6, tint: true },
  bark:       { slug: 'bark_brown_01',        m: 0, rep: [1, 2] },
  grass:      { slug: 'grass_ground',         m: 2.0 },
  mud:        { slug: 'gravel_road',          m: 2.0 },
  road:       { slug: 'asphalt_02',           m: 2.0 },
}
const imgs = {}, pbrTex = {}
const loadImg = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url })
let _pbrP = null
export function preloadPBR() {
  if (_pbrP) return _pbrP
  const slugs = [...new Set([...Object.values(SETS).map(s => s.slug), 'rough_linen'])]
  _pbrP = Promise.all(slugs.map(async (slug) => {
    const [d, n, r] = await Promise.all(['diff', 'nor', 'rough'].map(k => loadImg(`./tex/${slug}_${k}.jpg`)))
    if (!d) return
    const mk = (im, srgb) => { const t = new THREE.Texture(im); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; return t }
    const avg = (() => { const c = mk0(8); const g = c.getContext('2d'); g.drawImage(d, 0, 0, 8, 8); const a = g.getImageData(0, 0, 8, 8).data; let R = 0, G = 0, B = 0; for (let i = 0; i < a.length; i += 4) { R += a[i]; G += a[i + 1]; B += a[i + 2] } const k = a.length / 4; return [R / k, G / k, B / k] })()
    const shrink = (im) => { if (!im) return null; const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(im, 0, 0, 512, 512); return c }
    const mkc = (c) => { if (!c) return null; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t }
    pbrTex[slug] = { diff: mk(d, true), nrm: mkc(shrink(n)), rgh: mkc(shrink(r)), img: d, avg }
  })).then(() => installPBR())
  return _pbrP
}
const mk0 = (s) => mk(s, s)
const tintCache = {}
function tinted(slug, col, m) {
  const P = pbrTex[slug]; const key = slug + col
  if (tintCache[key]) return tintCache[key]
  const S = 512, c = mk(S, S), g = c.getContext('2d'); g.drawImage(P.img, 0, 0, S, S)
  const id = g.getImageData(0, 0, S, S), a = id.data, b = hex(col)
  const kr = clamp(b[0] / P.avg[0], 0.25, 1.9), kg = clamp(b[1] / P.avg[1], 0.25, 1.9), kb = clamp(b[2] / P.avg[2], 0.25, 1.9)
  for (let i = 0; i < a.length; i += 4) { a[i] = Math.min(255, a[i] * kr); a[i + 1] = Math.min(255, a[i + 1] * kg); a[i + 2] = Math.min(255, a[i + 2] * kb) }
  g.putImageData(id, 0, 0)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8
  t.userData = { slug, world: m }
  return (tintCache[key] = t)
}
const plainCache = {}
function plain(slug, m, rep) {
  const P = pbrTex[slug], key = slug + m + (rep || '')
  if (plainCache[key]) return plainCache[key]
  const t = P.diff.clone(); t.needsUpdate = true; t.userData = { slug, world: m }; if (rep) t.repeat.set(rep[0], rep[1])
  return (plainCache[key] = t)
}
function installPBR() {
  const proc = { ...tex }
  for (const [k, s] of Object.entries(SETS)) {
    if (!pbrTex[s.slug]) continue
    if (s.tint) tex[k] = (col) => col ? tinted(s.slug, col, s.m) : plain(s.slug, s.m, s.rep)
    else tex[k] = () => plain(s.slug, s.m, s.rep)
  }
  tex.__proc = proc
}
// give a material the normal + roughness maps matching its colour map (same UV transform)
export function withPBR(m) {
  const map = m && m.map, u = map && map.userData
  if (!u || !u.slug || !pbrTex[u.slug]) return m
  const P = pbrTex[u.slug]
  const cp = (t) => { const c = t.clone(); c.needsUpdate = true; c.repeat.copy(map.repeat); c.offset.copy(map.offset); c.wrapS = map.wrapS; c.wrapT = map.wrapT; return c }
  if (P.nrm) { m.normalMap = cp(P.nrm); m.normalScale.set(1.1, 1.1) }
  if (P.rgh) { m.roughnessMap = cp(P.rgh); m.roughness = 1 }
  m.needsUpdate = true
  return m
}
export const worldUV = (mat) => (mat && mat.map && mat.map.userData && mat.map.userData.world) || 0

// woven-cloth normal map for clothing (null until PBR sets are loaded)
export function fabricNormal(rx = 4, ry = 3) {
  const P = pbrTex.rough_linen; if (!P || !P.nrm) return null
  const t = P.nrm.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t
}
