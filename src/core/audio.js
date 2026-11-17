// Procedural audio engine: every sound in the game is synthesised (no asset files).
import { clamp, lerp, R } from './util.js'

const VOWELS = { a: [800, 1150], e: [450, 1900], i: [300, 2300], o: [480, 900], u: [330, 800] }

class AudioEngine {
  constructor() {
    this.ctx = null
    this.vol = { master: 0.8, voice: 1, amb: 0.8, sfx: 1 }
    this.st = { rain: 0, wind: 0.1, gust: 0, insects: 0, birds: 0, frogs: 0, room: 0, fan: 0, traffic: 0, tin: 0, bamboo: 0, hush: 0, fear: 0, engine: 0, rpm: 0, breathRate: 0.25, breathDepth: 0.2, indoors: 0, owl: 0 }
    this.cur = { ...this.st }
    this._hb = 0; this._hbOn = 0; this._breathT = 0; this._birdT = 0; this._dripT = 0
    this.captions = []; this.onCaption = null
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const c = (this.ctx = new AC())
    this.master = c.createGain(); this.master.gain.value = this.vol.master
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.ratio.value = 4
    this.master.connect(this.comp); this.comp.connect(c.destination)
    this.busAmb = c.createGain(); this.busSfx = c.createGain(); this.busVoice = c.createGain()
    // Ambience passes through a tension low-pass: the world goes muffled as dread rises.
    this.ambLP = c.createBiquadFilter(); this.ambLP.type = 'lowpass'; this.ambLP.frequency.value = 20000
    this.busAmb.connect(this.ambLP); this.ambLP.connect(this.master)
    this.busSfx.connect(this.master); this.busVoice.connect(this.master)
    this.hush = c.createGain(); this.hush.connect(this.busAmb) // ambience goes through hush for "sudden silence"
    // noise buffers
    const mk = (fn) => { const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0); fn(d); return b }
    this.nWhite = mk(d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 })
    this.nPink = mk(d => { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926 } })
    this.nBrown = mk(d => { let l = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; l = (l + .02 * w) / 1.02; d[i] = l * 3.5 } })
    // reverb (forest / open air tail)
    this.verb = c.createConvolver()
    const ir = c.createBuffer(2, c.sampleRate * 2.4, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2) }
    this.verb.buffer = ir; this.verbIn = c.createGain(); this.verbIn.gain.value = 0.5
    this.verbIn.connect(this.verb); const vg = c.createGain(); vg.gain.value = 0.7; this.verb.connect(vg); vg.connect(this.master)
    this._buildLayers()
    this.applyVolumes()
  }

  applyVolumes() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05)
    this.busAmb.gain.setTargetAtTime(this.vol.amb, t, 0.05)
    this.busSfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05)
    this.busVoice.gain.setTargetAtTime(this.vol.voice, t, 0.05)
  }

  // ---------- helpers ----------
  _loop(buf, rate = 1) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.loopStart = Math.random() * 1.5; s.start(0, Math.random() * 2); return s }
  _g(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g }
  _f(type, f, q = 1) { const x = this.ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x }
  _chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1] }
  _out(pos, bus, verbAmt = 0) {
    // returns an input node; spatialised if pos given
    const c = this.ctx
    let node
    if (pos) {
      const p = c.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2.5; p.rolloffFactor = 1.35; p.maxDistance = 260
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z } else p.setPosition(pos.x, pos.y, pos.z)
      p.connect(bus || this.busSfx); node = p
    } else { node = this._g(1); node.connect(bus || this.busSfx) }
    if (verbAmt > 0) { const s = this._g(verbAmt); node.connect(s); s.connect(this.verbIn) }
    return node
  }
  _noise(buf, dur, t0) { const s = this.ctx.createBufferSource(); s.buffer = buf || this.nWhite; s.start(t0, Math.random() * 2, dur + 0.05); return s }
  _env(g, t0, a, d, peak, floor = 0.0001) { g.gain.setValueAtTime(floor, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(floor, t0 + a + d) }
  caption(txt, dur = 2.2) { if (this.onCaption) this.onCaption(txt, dur) }

  // ---------- continuous layers ----------
  _buildLayers() {
    const c = this.ctx, L = (this.L = {})
    const amb = this.hush
    // rain (broad hiss) + leaf patter
    { const s = this._loop(this.nWhite), hp = this._f('highpass', 600), lp = this._f('lowpass', 8000), g = this._g(0); this._chain(s, hp, lp, g, amb); L.rain = g
      const s2 = this._loop(this.nPink, 1.2), bp = this._f('bandpass', 2600, 0.8), g2 = this._g(0); this._chain(s2, bp, g2, amb); L.leaf = g2
      const s3 = this._loop(this.nWhite), bp3 = this._f('bandpass', 2100, 1.6), g3 = this._g(0); this._chain(s3, bp3, g3, amb); L.tin = g3 }
    // wind
    { const s = this._loop(this.nPink, 0.6), bp = this._f('bandpass', 380, 0.7), g = this._g(0); this._chain(s, bp, g, amb); L.wind = g; L.windF = bp.frequency
      const o = c.createOscillator(); o.frequency.value = 0.13; const og = this._g(160); o.connect(og); og.connect(bp.frequency); o.start()
      const s2 = this._loop(this.nBrown, 0.8), lp = this._f('lowpass', 260), g2 = this._g(0); this._chain(s2, lp, g2, amb); L.windLow = g2
      // bamboo / reed whistle: narrow band, slowly wandering -> "voice-like"
      const s3 = this._loop(this.nWhite), b3 = this._f('bandpass', 900, 14), b4 = this._f('bandpass', 1500, 10), g3 = this._g(0); s3.connect(b3); s3.connect(b4); b3.connect(g3); b4.connect(g3); g3.connect(amb); L.bamboo = g3; L.bam1 = b3.frequency; L.bam2 = b4.frequency }
    // crickets / insects
    { const g = this._g(0); g.connect(amb); L.insects = g
      for (let i = 0; i < 3; i++) { const s = this._loop(this.nWhite), bp = this._f('bandpass', 3800 + i * 900, 22), am = this._g(0); const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 11 + i * 3.7 + Math.random() * 2; const lg = this._g(0.5); lfo.connect(lg); lg.connect(am.gain); am.gain.value = 0.5; lfo.start(); this._chain(s, bp, am, g) }
      // slow cicada swell
      const s = this._loop(this.nWhite), bp = this._f('bandpass', 5200, 8), am = this._g(0.25), l2 = c.createOscillator(); l2.frequency.value = 0.21; const lg2 = this._g(0.22); l2.connect(lg2); lg2.connect(am.gain); l2.start(); this._chain(s, bp, am, g) }
    // frogs after rain
    { const g = this._g(0); g.connect(amb); L.frogs = g; for (let i = 0; i < 2; i++) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 180 + i * 43; const lp = this._f('lowpass', 700), am = this._g(0), l = c.createOscillator(); l.type = 'square'; l.frequency.value = 6 + i * 1.7; const lg = this._g(0.5); l.connect(lg); lg.connect(am.gain); am.gain.value = 0.5; l.start(); o.start(); this._chain(o, lp, am, g) } }
    // room tone + fan
    { const o = c.createOscillator(); o.frequency.value = 50; const g = this._g(0); const lp = this._f('lowpass', 200); this._chain(o, lp, g, amb); o.start(); L.room = g
      const s = this._loop(this.nPink), bp = this._f('bandpass', 420, 1.2), gf = this._g(0); const l = c.createOscillator(); l.frequency.value = 3.2; const lg = this._g(0.35); l.connect(lg); const am = this._g(0.65); lg.connect(am.gain); l.start(); this._chain(s, bp, am, gf, amb); L.fan = gf }
    // traffic
    { const s = this._loop(this.nBrown, 0.9), lp = this._f('lowpass', 420), g = this._g(0); this._chain(s, lp, g, amb); L.traffic = g }
    // scooter engine
    { const o1 = c.createOscillator(); o1.type = 'sawtooth'; const o2 = c.createOscillator(); o2.type = 'square'
      const lp = this._f('lowpass', 520), g = this._g(0), tr = c.createOscillator(); tr.frequency.value = 22; const tg = this._g(0.35); tr.connect(tg); const am = this._g(0.7); tg.connect(am.gain); tr.start()
      o1.connect(am); o2.connect(am); this._chain(am, lp, g, this.busSfx); o1.start(); o2.start(); L.eng = { g, o1, o2, lp, tr } }
    // breath bus + heartbeat bus
    { const s = this._loop(this.nPink, 1.3), bp = this._f('bandpass', 1100, 0.9), g = this._g(0); this._chain(s, bp, g, this.busSfx); L.breath = g; L.breathF = bp.frequency }
  }

  // ---------- per-frame ----------
  update(dt, listenerPos, fwd, up) {
    if (!this.ctx) return
    const c = this.ctx, t = c.currentTime, S = this.st, C = this.cur, L = this.L
    for (const k in S) C[k] = typeof S[k] === 'number' ? lerp(C[k], S[k], 1 - Math.exp(-dt * (k === 'hush' ? 6 : 1.4))) : S[k]
    const ind = C.indoors
    const set = (g, v, tc = 0.2) => g.gain.setTargetAtTime(v, t, tc)
    set(L.rain, C.rain * 0.17 * (1 - 0.55 * ind)); set(L.leaf, C.rain * 0.12 * (1 - ind)); set(L.tin, C.tin * 0.2)
    const w = C.wind + C.gust
    set(L.wind, w * 0.5 * (1 - 0.7 * ind)); L.windF.setTargetAtTime(280 + w * 700, t, 0.3); set(L.windLow, w * 0.8 * (1 - ind * 0.8))
    set(L.bamboo, C.bamboo * (0.04 + C.gust * 0.07) * (1 - ind)); L.bam1.setTargetAtTime(760 + Math.sin(t * 0.37) * 220 + C.gust * 350, t, 0.4); L.bam2.setTargetAtTime(1380 + Math.sin(t * 0.23 + 1) * 320 + C.gust * 420, t, 0.4)
    set(L.insects, C.insects * 0.05 * (1 - 0.7 * ind)); set(L.frogs, C.frogs * 0.04 * (1 - ind)); set(L.room, C.room * 0.05); set(L.fan, C.fan * 0.07); set(L.traffic, C.traffic * 0.1 * (1 - 0.4 * ind))
    this.hush.gain.setTargetAtTime(1 - clamp(C.hush, 0, 1) * 0.94, t, 0.12)
    // engine
    const e = L.eng, rpm = C.rpm
    e.o1.frequency.setTargetAtTime(48 + rpm * 120, t, 0.06); e.o2.frequency.setTargetAtTime(24 + rpm * 60, t, 0.06); e.lp.frequency.setTargetAtTime(380 + rpm * 1300, t, 0.1); e.tr.frequency.setTargetAtTime(16 + rpm * 36, t, 0.1)
    set(e.g, C.engine * (0.10 + rpm * 0.14), 0.1)
    // breathing
    this._breathT += dt * C.breathRate * 2 * Math.PI
    const br = Math.max(0, Math.sin(this._breathT)) ** 2
    set(L.breath, (br * C.breathDepth * 0.12) * (S.engine > 0.5 ? 0.2 : 1), 0.05); L.breathF.setTargetAtTime(700 + C.breathRate * 900, t, 0.2)
    // random birds / owl / drips
    if (C.birds > 0.05) { this._birdT -= dt; if (this._birdT <= 0) { this._birdT = R.range(1.2, 4.5) / C.birds; this.bird(new this._V(R.range(-30, 30), 6 + R.range(0, 6), R.range(-30, 30))) } }
    if (C.rain > 0.05 || C.frogs > 0.1) { this._dripT -= dt; if (this._dripT <= 0) { this._dripT = R.range(0.08, 0.4) / (0.3 + C.rain + C.frogs * 0.5); this.drip(C.frogs > C.rain ? 0.5 : 1) } }
    // heartbeat
    if (C.fear > 0.08) { this._hb -= dt; const bpm = 62 + C.fear * 70; if (this._hb <= 0) { this._hb = 60 / bpm; this.heartbeat(C.fear) } }
    // listener
    const l = c.listener
    if (l.positionX) { l.positionX.value = listenerPos.x; l.positionY.value = listenerPos.y; l.positionZ.value = listenerPos.z; l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z; l.upX.value = up.x; l.upY.value = up.y; l.upZ.value = up.z }
    else { l.setPosition(listenerPos.x, listenerPos.y, listenerPos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z) }
  }
  setVec3(V) { this._V = V }

  // ---------- one-shots ----------
  _tone(f0, f1, dur, type, vol, out, t0) {
    const c = this.ctx, o = c.createOscillator(), g = this._g(0); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur)
    this._env(g, t0, 0.005, dur, vol); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.1)
  }
  _burst(buf, ftype, f, q, dur, vol, out, t0, a = 0.004) {
    const n = this._noise(buf, dur, t0), fl = this._f(ftype, f, q), g = this._g(0); this._env(g, t0, a, dur, vol); this._chain(n, fl, g, out); return fl
  }
  footstep(type = 'dirt', vol = 1, pos = null) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx), v = vol * (0.85 + Math.random() * 0.3)
    const pitch = 0.85 + Math.random() * 0.3
    switch (type) {
      case 'tile': this._burst(this.nWhite, 'highpass', 1800, 1, 0.04, 0.22 * v, o, t, 0.001); this._tone(260 * pitch, 120, 0.09, 'sine', 0.2 * v, o, t); break
      case 'indoor': this._burst(this.nWhite, 'bandpass', 1500 * pitch, 1.2, 0.05, 0.16 * v, o, t, 0.001); this._tone(180, 90, 0.08, 'sine', 0.13 * v, o, t); break
      case 'mud': this._burst(this.nBrown, 'lowpass', 520 * pitch, 1, 0.16, 0.9 * v, o, t, 0.01); this._burst(this.nPink, 'bandpass', 300 * pitch, 3, 0.22, 0.3 * v, o, t + 0.05); break
      case 'grass': this._burst(this.nPink, 'bandpass', 2400 * pitch, 0.8, 0.12, 0.18 * v, o, t, 0.012); this._burst(this.nBrown, 'lowpass', 700, 1, 0.07, 0.4 * v, o, t); break
      case 'road': this._burst(this.nWhite, 'bandpass', 1900 * pitch, 1, 0.06, 0.2 * v, o, t, 0.002); this._burst(this.nBrown, 'lowpass', 600, 1, 0.07, 0.4 * v, o, t); break
      case 'wet': this._burst(this.nWhite, 'bandpass', 1200 * pitch, 0.7, 0.14, 0.3 * v, o, t, 0.006); this._burst(this.nBrown, 'lowpass', 500, 1, 0.12, 0.6 * v, o, t); break
      case 'leaves': this.leaves(pos, v); break
      default: this._burst(this.nBrown, 'lowpass', 800 * pitch, 1, 0.09, 0.7 * v, o, t, 0.004); this._burst(this.nPink, 'bandpass', 2000, 1, 0.07, 0.1 * v, o, t)
    }
  }
  drip(v = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busAmb)
    const f = 900 + Math.random() * 1700; this._tone(f, f * 0.55, 0.05, 'sine', 0.025 * v * (1 - this.cur.indoors * 0.5), o, t)
  }
  bird(pos) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busAmb, 0.1), n = R.int(2, 5), base = R.range(1800, 3800), kind = R.int(0, 2)
    for (let i = 0; i < n; i++) { const tt = t + i * (kind ? 0.11 : 0.17); this._tone(base * (kind ? 1 + i * 0.08 : 1.4 - i * 0.1), base * (kind ? 1.3 : 0.9), 0.1, 'sine', 0.05, o, tt) }
  }
  owl(pos) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busAmb, 0.5); this.caption('[an owl hoots far away]')
    ;[0, 0.55, 0.9].forEach((d, i) => this._tone(420 - i * 20, 380 - i * 25, 0.4, 'sine', 0.18, o, t + d))
  }
  dog(pos, n = 3) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.6); this.caption('[a dog barks in the distance]')
    for (let i = 0; i < n; i++) { const tt = t + i * (0.42 + Math.random() * 0.12); this._tone(520, 260, 0.16, 'sawtooth', 0.14, this._chain(this._f('lowpass', 1500), o), tt); this._burst(this.nWhite, 'bandpass', 900, 2, 0.1, 0.1, o, tt) }
  }
  peacock(pos) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.7); this.caption('[a long, harsh cry far away]', 3)
    const fm = this._f('bandpass', 1400, 2); fm.connect(o)
    ;[0, 1.2].forEach(d => { const osc = this.ctx.createOscillator(); osc.type = 'sawtooth'; const g = this._g(0); osc.frequency.setValueAtTime(480, t + d); osc.frequency.linearRampToValueAtTime(980, t + d + 0.35); osc.frequency.linearRampToValueAtTime(700, t + d + 0.9); this._env(g, t + d, 0.1, 0.8, 0.32); osc.connect(g); g.connect(fm); osc.start(t + d); osc.stop(t + d + 1) })
  }
  jackal(pos) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.8); this.caption('[howling, far away]', 3)
    for (let k = 0; k < 3; k++) { const osc = this.ctx.createOscillator(); osc.type = 'sawtooth'; const g = this._g(0); const t0 = t + k * 0.35; osc.frequency.setValueAtTime(500 + k * 80, t0); osc.frequency.linearRampToValueAtTime(900 + k * 60, t0 + 1.4); osc.frequency.linearRampToValueAtTime(640, t0 + 2.6); this._env(g, t0, 0.5, 2.1, 0.07); const bp = this._f('bandpass', 1000, 1.5); this._chain(osc, bp, g, o); osc.start(t0); osc.stop(t0 + 3) }
  }
  thunder(dist = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx, 0.4); this.caption('[thunder]', 3)
    this._burst(this.nBrown, 'lowpass', 220 + 500 / dist, 0.8, 3.4, 1.5 / dist, o, t, 0.25)
    for (let i = 0; i < 4; i++) this._burst(this.nBrown, 'lowpass', 300, 1, 1.2, 0.9 / dist, o, t + 0.4 + i * 0.5 + Math.random() * 0.3, 0.1)
  }
  payal(pos, n = 0) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.3); this.caption('[a faint jingling, like anklets]', 2.8)
    const count = n || R.int(5, 9); let tt = t
    for (let i = 0; i < count; i++) { tt += 0.07 + Math.random() * 0.1; const base = 2300 + Math.random() * 1700; for (let k = 0; k < 3; k++) this._tone(base * (1 + k * 0.57), base * (1 + k * 0.57) * 0.99, 0.35 + Math.random() * 0.15, 'sine', 0.05 / (k + 1), o, tt) }
  }
  call(pos, who = 'mother', variant = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = this._out(pos, this.busVoice, 0.9)
    const f0 = who === 'mother' ? 230 + variant * 15 : 135 + variant * 8, dur = 1.5
    const src = c.createOscillator(); src.type = 'sawtooth'; src.frequency.setValueAtTime(f0 * 0.9, t); src.frequency.linearRampToValueAtTime(f0 * 1.18, t + 0.4); src.frequency.linearRampToValueAtTime(f0 * 0.95, t + dur)
    const vib = c.createOscillator(); vib.frequency.value = 5.2; const vg = this._g(f0 * 0.018); vib.connect(vg); vg.connect(src.frequency)
    const f1 = this._f('bandpass', 650, 5), f2 = this._f('bandpass', 1050, 6), mix = this._g(0), lp = this._f('lowpass', 2100)
    f1.frequency.setValueAtTime(800, t); f1.frequency.linearRampToValueAtTime(480, t + dur); f2.frequency.setValueAtTime(1200, t); f2.frequency.linearRampToValueAtTime(900, t + dur)
    src.connect(f1); src.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(lp); lp.connect(o)
    this._env(mix, t, 0.25, dur, 0.55); src.start(t); vib.start(t); src.stop(t + dur + 0.2); vib.stop(t + dur + 0.2)
    this._burst(this.nWhite, 'bandpass', 1800, 2, dur, 0.04, o, t, 0.2)
    this.caption(who === 'mother' ? '[a woman’s voice calls out, far away]' : '[a man’s voice calls out, far away]', 3)
  }
  scream(pos) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = this._out(pos, this.busVoice, 0.9); this.caption('[a scream, deep in the forest]', 3)
    const s = c.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(380, t); s.frequency.linearRampToValueAtTime(820, t + 0.5); s.frequency.linearRampToValueAtTime(560, t + 1.6)
    const f = this._f('bandpass', 1100, 2.5), g = this._g(0); this._env(g, t, 0.1, 1.5, 0.5); this._chain(s, f, g, o); s.start(t); s.stop(t + 1.8)
    this._burst(this.nWhite, 'bandpass', 2400, 1.5, 1.5, 0.12, o, t, 0.1)
  }
  whisper(pos, n = 5) {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.4); this.caption('[a whisper]', 2)
    for (let i = 0; i < n; i++) this._burst(this.nWhite, 'bandpass', 2500 + Math.random() * 3500, 1.4, 0.09 + Math.random() * 0.06, 0.1, o, t + i * 0.14 + Math.random() * 0.05, 0.02)
  }
  puff(pan = 1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, p = c.createStereoPanner ? c.createStereoPanner() : this._g(1); if (p.pan) p.pan.value = pan; p.connect(this.busSfx); this.caption('[a cold puff of air near the ear]', 2.5)
    this._burst(this.nPink, 'bandpass', 3200, 0.9, 0.55, 0.28, p, t, 0.12); this._burst(this.nWhite, 'highpass', 5000, 1, 0.35, 0.06, p, t + 0.05, 0.1)
  }
  rustle(pos, vol = 1) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx); this.caption('[leaves rustle]', 1.6); for (let i = 0; i < 5; i++) this._burst(this.nWhite, 'bandpass', 2500 + Math.random() * 2500, 0.8, 0.08, 0.1 * vol, o, t + i * 0.05 + Math.random() * 0.05, 0.01) }
  crack(pos, vol = 1) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.4); this.caption('[a branch cracks]', 1.8); this._burst(this.nWhite, 'bandpass', 1500, 1.2, 0.05, 0.7 * vol, o, t, 0.0008); this._tone(700, 200, 0.06, 'square', 0.15 * vol, o, t) }
  strike(pos, vol = 1) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.5); this._burst(this.nWhite, 'bandpass', 1200, 1.5, 0.05, 0.9 * vol, o, t, 0.0008); this._tone(160, 60, 0.18, 'sine', 0.5 * vol, o, t); this._tone(2200, 1400, 0.1, 'triangle', 0.1 * vol, o, t) }
  knock(pos, n = 3, vol = 1) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.15); for (let i = 0; i < n; i++) { const tt = t + i * 0.24; this._tone(220, 90, 0.12, 'sine', 0.9 * vol, o, tt); this._burst(this.nWhite, 'lowpass', 900, 1, 0.07, 0.6 * vol, o, tt, 0.001) } }
  door(pos, open = true) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.2); const osc = this.ctx.createOscillator(); osc.type = 'sawtooth'; const g = this._g(0), f = this._f('bandpass', 700, 6); osc.frequency.setValueAtTime(open ? 140 : 220, t); osc.frequency.linearRampToValueAtTime(open ? 260 : 120, t + 0.9); this._env(g, t, 0.15, 0.8, 0.12); this._chain(osc, f, g, o); osc.start(t); osc.stop(t + 1.1) }
  glass(pos) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.2); this._tone(3100, 3000, 0.5, 'sine', 0.18, o, t); this._tone(4700, 4600, 0.35, 'sine', 0.1, o, t); this._burst(this.nWhite, 'highpass', 4000, 1, 0.03, 0.2, o, t, 0.001) }
  pour(pos, dur = 1.4) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.1); const f = this._burst(this.nWhite, 'bandpass', 900, 3, dur, 0.18, o, t, 0.15); f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1500, t + dur) }
  gulp(n = 3) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx); for (let i = 0; i < n; i++) this._tone(180, 90, 0.12, 'sine', 0.3, o, t + i * 0.4) }
  laugh(pos) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = this._out(pos, this.busVoice, 0.35); this.caption('[the uncle laughs]', 6)
    let tt = t; const N = 15
    for (let i = 0; i < N; i++) { const p = i / N, f0 = 108 + p * 38 + (i % 2) * 6; const s = c.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f0, tt); s.frequency.linearRampToValueAtTime(f0 * 0.92, tt + 0.16); const f1 = this._f('bandpass', 760, 5), f2 = this._f('bandpass', 1150, 6), g = this._g(0), m = this._g(0.9); this._env(g, tt, 0.02, 0.16, 0.5 + p * 0.2); s.connect(f1); s.connect(f2); f1.connect(g); f2.connect(g); g.connect(o); s.start(tt); s.stop(tt + 0.25); tt += 0.2 - p * 0.05 }
  }
  // ---------- recorded voice clips (Piper TTS, pre-rendered by tools/make_voice.py) ----------
  async loadClip(url) {
    if (!this.ctx) return null
    this._clips = this._clips || new Map()
    if (this._clips.has(url)) return this._clips.get(url)
    const p = fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer() }).then(b => this.ctx.decodeAudioData(b)).catch(() => null)
    this._clips.set(url, p); return p
  }
  // plays a decoded clip; pos = {x,y,z} for positional voices (off-screen speakers), null = in-head
  playClip(buf, pos = null, vol = 1, rate = 1) {
    if (!this.ctx || !buf) return null
    const c = this.ctx, src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate
    const g = this._g(vol), o = this._out(pos, this.busVoice, pos ? 0.15 : 0.04)
    const an = c.createAnalyser(); an.fftSize = 512; src.connect(g); g.connect(an); an.connect(o)
    src.start(c.currentTime + 0.02)
    const h = { src, an, buf, t0: c.currentTime + 0.02, data: new Uint8Array(an.fftSize), stop() { try { src.stop() } catch (e) {} } }
    h.level = () => { an.getByteTimeDomainData(h.data); let m = 0; for (let i = 0; i < h.data.length; i++) m = Math.max(m, Math.abs(h.data[i] - 128)); return m / 128 }
    this.voiceNow = h; src.onended = () => { if (this.voiceNow === h) this.voiceNow = null }
    return h
  }
  stopVoice() { if (this.voiceNow) { this.voiceNow.stop(); this.voiceNow = null } }
  voiceTick(pos, f0 = 120, text = '', vol = 1) {
    // speech-like murmur (not words): syllable bursts shaped by vowel formants
    if (!this.ctx) return 0; const c = this.ctx, t0 = c.currentTime + 0.05, o = this._out(pos, this.busVoice, pos ? 0.12 : 0)
    let t = t0; const letters = text.toLowerCase().replace(/[^a-z .,?!…-]/g, '')
    let v = 'a'
    for (let i = 0; i < letters.length; i++) {
      const ch = letters[i]
      if (' .,?!…-'.includes(ch)) { t += ch === ' ' ? 0.05 : 0.22; continue }
      if ('aeiou'.includes(ch)) v = ch
      else if (i % 2) continue
      const dur = 0.085 + (ch === 'a' ? 0.03 : 0), fm = VOWELS[v]
      const s = c.createOscillator(); s.type = 'sawtooth'; const pitch = f0 * (0.92 + 0.16 * Math.sin(i * 0.7) + (letters[i + 1] === '?' ? 0.1 : 0)); s.frequency.setValueAtTime(pitch, t); s.frequency.linearRampToValueAtTime(pitch * 0.97, t + dur)
      const a = this._f('bandpass', fm[0], 6), b = this._f('bandpass', fm[1], 8), g = this._g(0), lp = this._f('lowpass', 3200)
      this._env(g, t, 0.02, dur, 0.5 * vol); s.connect(a); s.connect(b); a.connect(g); b.connect(g); g.connect(lp); lp.connect(o); s.start(t); s.stop(t + dur + 0.1)
      t += dur * 0.85
    }
    return t - t0
  }
  heartbeat(level = 0.5) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx); this._tone(62, 38, 0.14, 'sine', 0.55 * clamp(level, 0.2, 1), o, t); this._tone(54, 34, 0.16, 'sine', 0.4 * clamp(level, 0.2, 1), o, t + 0.17) }
  gasp() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx); this._burst(this.nPink, 'bandpass', 1400, 0.8, 0.35, 0.3, o, t, 0.05) }
  phoneBuzz() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx); for (let i = 0; i < 3; i++) this._tone(180, 180, 0.2, 'square', 0.12, this._chain(this._f('lowpass', 500), o), t + i * 0.3) }
  phoneRing() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx); for (let i = 0; i < 6; i++) this._tone(i % 2 ? 1046 : 784, i % 2 ? 1046 : 784, 0.1, 'sine', 0.14, o, t + i * 0.12) }
  signalUp() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx); [660, 880, 1320].forEach((f, i) => this._tone(f, f, 0.14, 'sine', 0.14, o, t + i * 0.1)) }
  horn(pos, kind = 'truck') { if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = this._out(pos, this.busSfx, 0.2); const fs = kind === 'truck' ? [210, 262, 330] : [400, 500]; this.caption('[a horn blares]', 2); fs.forEach(f => { const s = c.createOscillator(); s.type = 'square'; s.frequency.value = f; const g = this._g(0), lp = this._f('lowpass', 1800); this._env(g, t, 0.04, 1.1, 0.07); this._chain(s, lp, g, o); s.start(t); s.stop(t + 1.2) }) }
  passBy(pos0, pos1, dur = 4, kind = 'truck') { // doppler-ish moving engine, uses panner automation
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = this._out(pos0, this.busSfx, 0.1)
    const s = c.createOscillator(); s.type = 'sawtooth'; s.frequency.value = kind === 'truck' ? 62 : 90; const lp = this._f('lowpass', 600), g = this._g(0); this._env(g, t, dur * 0.3, dur * 0.7, 0.25); this._chain(s, lp, g, o)
    if (o.positionX) { o.positionX.setValueAtTime(pos0.x, t); o.positionX.linearRampToValueAtTime(pos1.x, t + dur); o.positionZ.setValueAtTime(pos0.z, t); o.positionZ.linearRampToValueAtTime(pos1.z, t + dur) }
    const n = this._noise(this.nBrown, dur, t), g2 = this._g(0.0); this._env(g2, t, dur * 0.4, dur * 0.6, 0.6); this._chain(n, this._f('lowpass', 900), g2, o); s.start(t); s.stop(t + dur + 0.1)
  }
  teaGlass() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx); this._tone(2600, 2500, 0.3, 'sine', 0.12, o, t); this._burst(this.nWhite, 'highpass', 3500, 1, 0.03, 0.15, o, t) }
  chime(f = 440) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx, 0.4); this._tone(f, f, 1.4, 'sine', 0.12, o, t); this._tone(f * 1.5, f * 1.5, 1.0, 'sine', 0.06, o, t) }
  flash() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx); this._tone(2200, 3200, 0.08, 'sine', 0.05, o, t) }
  crackle(pos, vol = 1) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.4), n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) this._burst(this.nWhite, 'bandpass', 1800 + Math.random() * 2600, 1.2, 0.025, 0.22 * vol, o, t + i * 0.03, 0.001) }
  click() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(null, this.busSfx); this._burst(this.nWhite, 'bandpass', 2200, 2, 0.02, 0.2, o, t, 0.001) }
  thud(pos, v = 1) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx); this._tone(120, 50, 0.16, 'sine', 0.5 * v, o, t); this._burst(this.nBrown, 'lowpass', 400, 1, 0.1, 0.4 * v, o, t) }
  clang(pos, v = 1) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.2); this._tone(900, 880, 0.5, 'triangle', 0.15 * v, o, t); this._tone(1450, 1400, 0.4, 'sine', 0.1 * v, o, t) }
  fall(pos) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this._out(pos, this.busSfx); this._burst(this.nBrown, 'lowpass', 500, 1, 0.3, 0.9, o, t, 0.01); this._burst(this.nWhite, 'bandpass', 1800, 1, 0.1, 0.2, o, t) }
  silence(on) { this.st.hush = on ? 1 : 0 }

  // ---------- horror: tension + scares ----------
  setTension(v = 0) {
    if (!this.ctx || !this.ambLP) return
    this.ambLP.frequency.setTargetAtTime(20000 - clamp(v, 0, 1) * 18800, this.ctx.currentTime, 0.25)
  }
  // A discordant stab used for jump scares. Loud, ugly, over in a fraction of a second.
  sting(v = 1) {
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(null, this.busSfx)
    this._tone(104, 44, 0.55, 'sawtooth', 0.5 * v, o, t)
    this._tone(1880, 220, 0.32, 'square', 0.15 * v, o, t)
    this._tone(2640, 2500, 0.12, 'sine', 0.2 * v, o, t)
    this._burst(this.nWhite, 'highpass', 2800, 0.7, 0.2, 0.55 * v, o, t, 0.001)
    this._burst(this.nBrown, 'lowpass', 320, 1, 0.6, 0.5 * v, o, t, 0.01)
  }
  // Ringing left in the ears after a scare.
  tinnitus(f = 3200, dur = 1.4, v = 0.12) {
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(null, this.busSfx)
    this._tone(f, f * 0.95, dur, 'sine', v, o, t)
  }
  // A long, low, wrong drone — dread without a scare.
  drone(dur = 3, v = 0.14) {
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(null, this.busSfx)
    this._tone(58, 46, dur, 'sine', v, o, t)
    this._tone(87, 82, dur, 'triangle', v * 0.5, o, t)
  }
  // Breath very close to the listener's ear.
  closeBreath(v = 1) {
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(null, this.busSfx)
    this._burst(this.nPink, 'bandpass', 1200, 0.7, 0.5, 0.22 * v, o, t, 0.18)
  }

  // ---------- full horror palette ----------
  leaves(pos, v = 1) { // dry leaf crunch (the forest's signature sound)
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx)
    for (let i = 0; i < 3; i++) this._burst(this.nWhite, 'bandpass', 2600 + Math.random() * 1800, 1.1, 0.09, 0.13 * v, o, t + i * 0.07, 0.004)
    this._burst(this.nBrown, 'lowpass', 900, 1, 0.12, 0.18 * v, o, t, 0.008)
  }
  howl(pos) { // long distant animal-like howl, no animal ever shown
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.5)
    const s = this.ctx.createOscillator(), g = this._g(0), f = this._f('bandpass', 700, 2.4)
    s.type = 'sawtooth'
    s.frequency.setValueAtTime(260, t); s.frequency.linearRampToValueAtTime(540, t + 0.5)
    s.frequency.linearRampToValueAtTime(360, t + 1.8); s.frequency.linearRampToValueAtTime(180, t + 2.5)
    this._env(g, t, 0.35, 2.3, 0.11)
    this._chain(s, f, g, o); s.start(t); s.stop(t + 2.7)
    this.caption('[a howl, far away — no animal in sight]', 3)
  }
  eyeShimmer(pos) { // pale eyes at a window
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.3)
    this._tone(2400, 2650, 0.5, 'sine', 0.05, o, t)
    this._tone(3300, 3100, 0.35, 'sine', 0.035, o, t + 0.06)
  }
  shadowWhoosh(pos) { // a shadow crossing with no source
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx)
    const b = this._burst(this.nPink, 'lowpass', 500, 0.8, 0.7, 0.16, o, t, 0.3)
    b.frequency.setValueAtTime(300, t); b.frequency.linearRampToValueAtTime(900, t + 0.35)
  }
  figureMoan(pos) { // the tall, faceless figure
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.3)
    this._tone(96, 58, 2.4, 'sawtooth', 0.13, o, t)
    this._tone(144, 88, 2.0, 'sine', 0.07, o, t + 0.1)
    this.closeBreath(0.8)
  }
  cloth(pos) { // a companion quietly no longer there
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx)
    this._burst(this.nPink, 'bandpass', 800, 0.7, 0.28, 0.12, o, t, 0.06)
    this._burst(this.nWhite, 'bandpass', 1900, 0.9, 0.09, 0.06, o, t + 0.05, 0.003)
  }
  fireOut(pos) {
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx)
    this._burst(this.nPink, 'lowpass', 1400, 0.8, 0.5, 0.3, o, t, 0.02)
    this._tone(220, 60, 0.4, 'sine', 0.1, o, t)
  }
  blueFlare(pos) {
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx)
    this._tone(300, 1400, 0.25, 'triangle', 0.09, o, t)
    this._burst(this.nWhite, 'highpass', 3200, 0.8, 0.3, 0.1, o, t, 0.01)
  }
  metalClack(pos) {
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx)
    this._tone(1500, 700, 0.06, 'square', 0.12, o, t)
    this._burst(this.nWhite, 'bandpass', 2600, 2, 0.05, 0.16, o, t, 0.001)
  }
  ignition(on = true) {
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(null, this.busSfx)
    if (on) {
      this._tone(70, 150, 0.5, 'sawtooth', 0.12, o, t)      // starter
      this._tone(160, 90, 0.35, 'square', 0.09, o, t + 0.45) // catch
      this._burst(this.nBrown, 'lowpass', 400, 1, 0.6, 0.16, o, t + 0.45, 0.05)
    } else {
      this._tone(150, 55, 0.5, 'sawtooth', 0.1, o, t)
      this._burst(this.nBrown, 'lowpass', 320, 1, 0.35, 0.12, o, t + 0.3, 0.05)
    }
  }
  echoCall(pos, who = 'mother') { // a familiar voice from the direction just left
    if (!this.ctx) return
    this.call(pos, who, 1)
    setTimeout(() => { if (this.ctx) { const o = this._out(pos, this.busSfx, 0.4); this._tone(420, 300, 0.35, 'sine', 0.035, o, this.ctx.currentTime) } }, 320)
  }
  diyaChime(pos) {
    if (!this.ctx) return
    const t = this.ctx.currentTime, o = this._out(pos, this.busSfx, 0.4)
    ;[880, 1320, 1760].forEach((f, i) => this._tone(f, f * 0.98, 1.2 - i * 0.2, 'sine', 0.045 - i * 0.01, o, t + i * 0.04))
  }
}
export const audio = new AudioEngine()
