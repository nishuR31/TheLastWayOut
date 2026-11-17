// Sky, fog, lights, rain, lightning, wind - all driven by story "mood" presets
import * as THREE from 'three'
import { damp, lerp, R } from '../core/util.js'

const C = (h) => new THREE.Color(h)
// module-scope scratch objects — avoid per-frame allocations in update()
const _sd = new THREE.Vector3(), _sunN = new THREE.Vector3()
export const MOODS = {
  day:      { top: '#5f93c9', hor: '#cfe0e8', fog: 0.0035, amb: 0.9, hemiS: '#c8d8ee', hemiG: '#6b6a50', sun: 2.6, sunC: '#fff2d8', sunDir: [60, 80, 40], rain: 0, wind: 0.08, exposure: 1.0 },
  evening:  { top: '#4c6f9b', hor: '#f0a468', fog: 0.0065, amb: 0.65, hemiS: '#b9a690', hemiG: '#5a4b32', sun: 2.0, sunC: '#ffb067', sunDir: [-80, 22, 40], rain: 0, wind: 0.1, exposure: 1.0 },
  dusk:     { top: '#1d2a48', hor: '#8a5a6a', fog: 0.014, amb: 0.35, hemiS: '#6b6a8a', hemiG: '#2a2a28', sun: 0.35, sunC: '#cc7a6a', sunDir: [-80, 8, 40], rain: 0, wind: 0.15, exposure: 1.3 },
  night:    { top: '#0a1226', hor: '#233450', fog: 0.026, amb: 0.42, hemiS: '#5a70a0', hemiG: '#1c2018', sun: 0.6, sunC: '#7f9bd0', sunDir: [30, 60, -40], rain: 0, wind: 0.2, exposure: 1.7 },
  storm:    { top: '#0c1220', hor: '#2a3648', fog: 0.036, amb: 0.4, hemiS: '#566a8c', hemiG: '#181c16', sun: 0.5, sunC: '#6a84b0', sunDir: [30, 60, -40], rain: 0.9, wind: 0.75, exposure: 2.1 },
  rain:     { top: '#0c1220', hor: '#26323f', fog: 0.034, amb: 0.38, hemiS: '#566a8c', hemiG: '#181c16', sun: 0.45, sunC: '#6a84b0', sunDir: [30, 60, -40], rain: 0.55, wind: 0.45, exposure: 2.0 },
  drizzle:  { top: '#0c1220', hor: '#2a3644', fog: 0.032, amb: 0.38, hemiS: '#566a8c', hemiG: '#181c16', sun: 0.45, sunC: '#6a84b0', sunDir: [30, 60, -40], rain: 0.25, wind: 0.3, exposure: 2.0 },
  deep:     { top: '#080d18', hor: '#18222f', fog: 0.042, amb: 0.3, hemiS: '#42567a', hemiG: '#10140f', sun: 0.35, sunC: '#5a74a0', sunDir: [30, 60, -40], rain: 0.35, wind: 0.3, exposure: 2.3 },
  still:    { top: '#070b14', hor: '#141c28', fog: 0.045, amb: 0.28, hemiS: '#3c4e6e', hemiG: '#0e120e', sun: 0.3, sunC: '#5a74a0', sunDir: [30, 60, -40], rain: 0.0, wind: 0.0, exposure: 2.3 },
  predawn:  { top: '#0c1530', hor: '#4a4a62', fog: 0.03, amb: 0.22, hemiS: '#556690', hemiG: '#1c1c1a', sun: 0.3, sunC: '#aab8e0', sunDir: [80, 14, 20], rain: 0.1, wind: 0.15, exposure: 1.8 },
  dawn:     { top: '#5b7ea8', hor: '#f2b78a', fog: 0.012, amb: 0.7, hemiS: '#c8c0b8', hemiG: '#605a46', sun: 1.7, sunC: '#ffc890', sunDir: [80, 14, 20], rain: 0, wind: 0.1, exposure: 1.0 },
  indoor:   { top: '#0a0e16', hor: '#10161e', fog: 0.012, amb: 0.2, hemiS: '#6a5a44', hemiG: '#2a2218', sun: 0, sunC: '#000', sunDir: [0, 1, 0], rain: 0, wind: 0.0, exposure: 1.6 },
  homeDay:  { top: '#6f9acb', hor: '#e2d8c0', fog: 0.003, amb: 1.0, hemiS: '#d8e0ee', hemiG: '#7a7058', sun: 2.8, sunC: '#ffe2b0', sunDir: [-50, 60, 30], rain: 0, wind: 0.06, exposure: 1.0 }
}

export class Env {
  constructor(G) {
    this.G = G; const sc = G.scene
    this.mood = MOODS.day; this.cur = { ...MOODS.day, topC: C('#000'), horC: C('#000'), sunCc: C('#fff'), hemiSc: C('#fff'), hemiGc: C('#fff'), sunDirV: new THREE.Vector3() }
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x333322, 0.6); sc.add(this.hemi)
    this.sun = new THREE.DirectionalLight(0xffffff, 1); sc.add(this.sun, this.sun.target)
    this.sun.castShadow = false; this.sun.shadow.mapSize.set(1024, 1024); const s = this.sun.shadow.camera; s.left = -22; s.right = 22; s.top = 22; s.bottom = -22; s.near = 1; s.far = 200; this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.04
    this.fog = new THREE.FogExp2(0x000000, 0.02); sc.fog = this.fog
    // sky dome
    const geo = new THREE.SphereGeometry(900, 24, 14)
    this.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: true, uniforms: { top: { value: C('#000') }, hor: { value: C('#000') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunC: { value: C('#fff') }, sunI: { value: 0 }, flash: { value: 0 }, stars: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `varying vec3 vP; uniform vec3 top,hor,sunDir,sunC; uniform float sunI,flash,stars;
        float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){ float t = clamp(vP.y*1.6+0.05,0.0,1.0); vec3 c = mix(hor, top, pow(t,0.65));
          float hz = smoothstep(0.0,-0.18,vP.y); c = mix(c, hor*0.55, hz);
          float band = exp(-abs(vP.y)*14.0); c = mix(c, hor, band*0.35);
          float sd = max(dot(normalize(vP), normalize(sunDir)),0.0); c += sunC * (pow(sd,64.0)*0.9 + pow(sd,6.0)*0.18) * clamp(sunI,0.0,1.0);
          vec3 q = floor(vP*220.0); float s = step(0.9972, h(q)) * stars * smoothstep(0.1,0.5,vP.y); c += vec3(s)*(0.5+0.5*h(q+3.0));
          c += vec3(0.55,0.62,0.85)*flash*(0.4+0.6*t); gl_FragColor = vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` })
    this.sky = new THREE.Mesh(geo, this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; sc.add(this.sky)
    // rain streaks (camera-relative)
    this.rainN = 1400; const pos = new Float32Array(this.rainN * 6); this.rainSeed = new Float32Array(this.rainN * 3)
    for (let i = 0; i < this.rainN; i++) { this.rainSeed[i * 3] = R.range(-14, 14); this.rainSeed[i * 3 + 1] = R.range(0, 14); this.rainSeed[i * 3 + 2] = R.range(-14, 14) }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaab8cc, transparent: true, opacity: 0.35, depthWrite: false })); this.rain.frustumCulled = false; sc.add(this.rain)
    this.rainT = 0; this.flashV = 0; this.nextBolt = 99; this.lightning = false; this.gust = 0; this.gustT = 3; this.windV = 0; this.rainAmt = 0
    this.set('day', true)
  }
  set(name, instant = false) { this.name = name; this.mood = MOODS[name] || MOODS.day; if (instant) { this._snap = true } }
  get raining() { return this.rainAmt > 0.08 }
  strike(dist = 1) { this.flashV = 1; this.G.audio.thunder(dist); setTimeout(() => { this.flashV = 0.7 }, 120); }
  update(dt, camPos) {
    const m = this.mood, c = this.cur, k = this._snap ? 1 : 1 - Math.exp(-dt * 0.55)
    this._snap = false
    c.topC.lerp(C(m.top), k); c.horC.lerp(C(m.hor), k); c.sunCc.lerp(C(m.sunC), k); c.hemiSc.lerp(C(m.hemiS), k); c.hemiGc.lerp(C(m.hemiG), k)
    c.exposure = lerp(c.exposure ?? 1, m.exposure ?? 1, k); this.G.renderer.toneMappingExposure = 1.05 * c.exposure; c.fog = lerp(c.fog, m.fog, k); c.amb = lerp(c.amb, m.amb, k); c.sun = lerp(c.sun, m.sun, k); c.rain = lerp(c.rain, m.rain, k); c.wind = lerp(c.wind, m.wind, k)
    _sd.set(m.sunDir[0], m.sunDir[1], m.sunDir[2]); c.sunDirV.lerp(_sd, k)
    this.hemi.color.copy(c.hemiSc); this.hemi.groundColor.copy(c.hemiGc); this.hemi.intensity = c.amb * (this.G.cfg.ambBoost || 1)
    this.sun.color.copy(c.sunCc); this.sun.intensity = c.sun + this.flashV * 3; this.sun.position.copy(camPos).addScaledVector(_sunN.copy(c.sunDirV).normalize(), 80); this.sun.target.position.copy(camPos)
    this.fog.color.copy(c.horC).multiplyScalar(0.9); this.fog.density = c.fog * (this.fogMul || 1)
    this.skyMat.uniforms.top.value.copy(c.topC); this.skyMat.uniforms.hor.value.copy(c.horC); this.skyMat.uniforms.sunDir.value.copy(c.sunDirV); this.skyMat.uniforms.sunC.value.copy(c.sunCc); this.skyMat.uniforms.sunI.value = c.sun > 0.2 ? 1 : 0
    this.skyMat.uniforms.stars.value = this.name === 'day' || this.name === 'evening' || this.name === 'homeDay' || this.name === 'dawn' ? 0 : (c.rain > 0.3 ? 0.1 : 1)
    this.sky.position.copy(camPos)
    this.rainAmt = c.rain; this.windV = c.wind + this.gust
    // gusts
    this.gustT -= dt; if (this.gustT <= 0) { this.gustT = R.range(3, 9) / (0.3 + c.wind * 2); this.gustTarget = R.range(0.2, 0.6) * (0.3 + c.wind * 1.5) } if (this.gustTarget !== undefined) { this.gust = damp(this.gust, this.gustTarget, 1.2, dt); this.gustTarget *= Math.exp(-dt * 0.45) }
    // lightning during storm
    if (this.name === 'storm') { this.nextBolt -= dt; if (this.nextBolt <= 0) { this.nextBolt = R.range(14, 34); this.strike(R.range(0.8, 2.2)) } } else this.nextBolt = Math.min(this.nextBolt, 12)
    this.flashV = Math.max(0, this.flashV - dt * 3); this.skyMat.uniforms.flash.value = this.flashV * (this.G.cfg.reduceFlash ? 0.25 : 1)
    // rain geometry
    const on = c.rain > 0.04 && !this.indoors; this.rain.visible = on
    if (on) {
      this.rainT += dt; const p = this.rain.geometry.attributes.position.array, n = Math.floor(this.rainN * Math.min(1, c.rain + 0.15) * this.G.cfg.rain), fall = 14, w = c.wind * 3
      for (let i = 0; i < n; i++) {
        const sx = this.rainSeed[i * 3], sy = this.rainSeed[i * 3 + 1], sz = this.rainSeed[i * 3 + 2]
        const y = ((sy - this.rainT * fall) % 14 + 14) % 14, x = camPos.x + ((sx + w * (14 - y) * 0.3 + 28) % 28) - 14, z = camPos.z + ((sz + 28) % 28) - 14, ln = 0.55
        p[i * 6] = x; p[i * 6 + 1] = camPos.y - 4 + y; p[i * 6 + 2] = z; p[i * 6 + 3] = x + w * 0.04; p[i * 6 + 4] = camPos.y - 4 + y + ln; p[i * 6 + 5] = z
      }
      // Only hide drops that left the active range since the previous frame.
      for (let i = n; i < (this.rainPrevN || 0); i++) { p[i * 6] = p[i * 6 + 3] = 0; p[i * 6 + 1] = p[i * 6 + 4] = -999 }
      this.rainPrevN = n
      this.rain.geometry.attributes.position.needsUpdate = true; this.rain.material.opacity = 0.18 + c.rain * 0.25
    }
  }
}
