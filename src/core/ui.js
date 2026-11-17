import { audio } from './audio.js'
import { lineId } from './hash.js'
const $ = (id) => document.getElementById(id)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const F0 = { Nishan: 118, Nishant: 132, Uncle: 98, Beti: 250, Mummy: 215, Chacha: 105, Papa: 100, Stranger: 112, Aadmi: 108, Chaiwala: 115, Awaaz: 135 }

class UI {
  constructor() { this.subMode = 'both'; this.caps = true; this._capT = null; this._toastT = null; this.reduceFlash = false; this.voiceLang = 'hi'; this.lines = null; this.objText = null }
  init() {
    audio.onCaption = (t, d) => this.caption(t, d)
    fetch('./voice/lines.json').then(r => r.json()).then(j => { this.lines = j }).catch(() => { this.lines = {} })
  }
  // resolves a recorded clip for a line (null if the language is off / clip missing)
  async clipFor(who, hi, id) {
    if (this.voiceLang === 'off' || !audio.ctx) return null
    id = id || lineId(who, hi)
    if (this.lines && !this.lines[id]) return null
    return audio.loadClip(`./voice/${this.voiceLang}/${id}.ogg`)
  }
  show(id, on = true) { $(id).classList.toggle('hidden', !on) }
  async say(who, hi, en, opts = {}) {
    const mode = this.subMode, len = (hi || '').length
    let dur = opts.dur || Math.max(1.6, 0.9 + len * 0.05)
    $('subs-who').textContent = who || ''
    if (mode === 'en') { $('subs-hi').textContent = en || hi; $('subs-en').textContent = '' }
    else { $('subs-hi').textContent = mode === 'off' ? '' : hi; $('subs-en').textContent = mode === 'hi' || mode === 'off' ? '' : (en || '') }
    $('subs').classList.toggle('show', mode !== 'off')
    let clip = null
    if (opts.voice !== false) {
      clip = await this.clipFor(who, hi, opts.id)
      if (clip) { audio.stopVoice(); this._cur = audio.playClip(clip, opts.pos || null, opts.vol ?? 1); dur = Math.max(clip.duration + 0.25, 0.9); this.G.speaking = { who, h: this._cur } }
      else if (opts.voice !== false && this.voiceLang !== 'off' && audio.ctx && this.lines && !this.lines[opts.id || lineId(who, hi)]) dur = dur
    }
    try { await this.G.waitSkippable(dur) } finally { if (!opts.keep) $('subs').classList.remove('show'); if (this._cur && this.G.speaking && this.G.speaking.h === this._cur) { this._cur.stop(); this.G.speaking = null } }
    if (opts.gap !== 0) await this.G.wait(opts.gap === undefined ? 0.12 : opts.gap)
  }
  hideSubs() { $('subs').classList.remove('show') }
  caption(t, d = 2) { if (!this.caps) return; const e = $('caption'); e.textContent = t; e.classList.add('show'); clearTimeout(this._capT); this._capT = setTimeout(() => e.classList.remove('show'), d * 1000) }
  toast(t, d = 3.5) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(this._toastT); this._toastT = setTimeout(() => e.classList.remove('show'), d * 1000) }
  prompt(text, key = 'E') {
    const p = $('prompt'); if (!text) { p.classList.remove('show'); return }
    if (p.dataset.t !== text + key) { $('prompt-t').textContent = text; p.querySelector('kbd').textContent = key; p.dataset.t = text + key }
    p.classList.add('show')
  }
  objective(t) { this.objText = t || null }
  hold(v) { const h = $('holdbar'); h.style.opacity = v > 0 ? 1 : 0; h.firstElementChild.style.width = (v * 100) + '%' }
  clock(txt, frozen = false, show = true) { const c = $('clock'); $('clock-t').textContent = txt; c.classList.toggle('show', show); c.classList.toggle('frozen', frozen) }
  // No black screens. Scene changes are plain hard cuts; a crane move is used only where asked for (cine = true).
  fade(to = 1, sec = 1.2, cine = false) { if (cine) { sec = Math.min(sec, 2.4); this.G.cineTo(to >= 0.5 ? 1 : 0, sec); return sleep(sec * 1000 + 30) } return sleep(Math.min(sec, 0.35) * 1000) }
  fadeInstant() {}
  flash(a = 0.8) { if (this.reduceFlash) a *= 0.2; const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; void f.offsetWidth; f.style.transition = 'opacity .5s ease-out'; f.style.opacity = 0 }
  fear(v) { $('fear').style.opacity = Math.min(1, v) }
  async titleCard(ch, title, time, sec = 3.2) {
    $('tc-chapter').textContent = ch; $('tc-title').textContent = title; $('tc-time').textContent = time || ''
    const t = $('titlecard'); t.style.transition = 'none'; t.style.opacity = 1; this.show('titlecard', true)
    await sleep(Math.min(sec, 2.6) * 1000)
    t.style.transition = 'opacity .5s'; t.style.opacity = 0; await sleep(500); this.show('titlecard', false)
  }
  choose(q, opts) {
    return new Promise((res, rej) => {
      $('choice-q').textContent = q; const box = $('choice-opts'); box.innerHTML = ''
      let done = false
      const cleanup = () => { removeEventListener('keydown', kd); this.show('choice', false) }
      const pick = (i) => { if (done) return; done = true; cleanup(); this.G.input.enabled = true; this.G.input.lock(); this.G._choiceRej = null; res(i) }
      this.G._choiceRej = (e) => { if (done) return; done = true; cleanup(); rej(e) }
      opts.forEach((o, i) => { const b = document.createElement('button'); b.textContent = `${i + 1}.  ${o}`; b.onclick = () => pick(i); box.appendChild(b) })
      const kd = (e) => { const n = parseInt(e.key); if (n >= 1 && n <= opts.length) pick(n - 1) }
      addEventListener('keydown', kd)
      this.show('choice', true); this.G.input.unlock()
    })
  }
}
export const ui = new UI()
