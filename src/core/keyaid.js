// Contextual key aid. Shows only the keys that matter RIGHT NOW, briefly, when
// the situation changes — so the player is never hunting through a key list
// while a scene is trying to be frightening. Hold TAB for the full pocket card.
//
// This is an aid, not a hint system: it never tells the player where to go or
// what to do, only which physical key performs the action they already chose.
import { items } from './items.js'
import { fire } from './fire.js'

const CARD = [
  ['Chalna · Move', [['W A S D', 'walk / ride'], ['Mouse', 'look'], ['⇧ W', 'run']]],
  ['Duniya · World', [['E', 'interact'], ['⇧ E', 'put item back'], ['C', 'crouch'], ['X', 'camera'], ['F', 'torch / bike light']]],
  ['Bike', [['B', 'ride / get off'], ['G', 'push'], ['⇧ B', 'helmet'], ['E', 'engine'], ['Click', 'horn']]],
  ['Bachav · Survive', [['T', 'build fire (3 twigs)'], ['P', 'phone'], ['I', 'inventory'], ['M', 'map'], ['H', 'hint · twice = hop'], ['Esc', 'pause']]]
]

const $ = (id) => document.getElementById(id)

export const keyaid = {
  el: null, card: null, sig: '', showT: 0, peek: false, poll: 0,

  init() {
    this.el = $('keyaid'); this.card = $('keycard')
    if (!this.el) return
    if (this.card) {
      this.card.innerHTML = CARD.map(([title, rows]) =>
        `<div class="kc-group"><h5>${title}</h5>${rows.map(([k, v]) => `<div class="kc-row"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div>`
      ).join('')
    }
    addEventListener('keydown', (e) => {
      if (e.code !== 'Tab' || e.repeat || !document.getElementById('hud') || document.getElementById('hud').classList.contains('hidden')) return
      e.preventDefault(); this.peek = true; this.card && this.card.classList.add('show')
    })
    addEventListener('keyup', (e) => {
      if (e.code !== 'Tab') return
      this.peek = false; this.card && this.card.classList.remove('show')
    })
    addEventListener('blur', () => { this.peek = false; this.card && this.card.classList.remove('show') })
  },

  hints(G) {
    const out = [], p = G.player
    if (p.mode === 'ride') {
      out.push(['E', 'engine'], ['B', 'get off'], ['F', 'headlight'], ['Click', 'horn'])
    } else {
      if (p.push) {
        out.push(['⇧W', 'friend helps'], ['G', 'stop pushing'], ['B', 'ride'], ['F', 'bike light'])
      } else if (G.scooter) {
        out.push(['B', 'ride'], ['G', 'push'], ['⇧B', 'helmet'])
      }
      const it = items.near(G)
      if (it) out.push([items.isReturn(G, it) ? '⇧E' : 'E', it.hook ? 'key' : it.helmet ? 'helmet' : 'phone'])
      const fa = fire.near(G)
      if (fa) out.push(['E', fa.kind === 'twig' ? 'twigs' : 'fire'])
      if (fire.count >= 3) out.push(['T', 'build fire'])
      if (G.hasPhone !== false) out.push(['P', 'phone'], ['F', 'torch'])
    }
    if (G.goal) out.push(['H', 'help · twice = hop'])
    out.push(['I', 'inventory'], ['Esc', 'pause'])
    return out
  },

  update(dt, G) {
    if (!this.el) return
    const mode = (G.cfg && G.cfg.keyaid) || 'context'
    if (mode === 'off' || G.paused) { this.el.classList.remove('show'); return }
    // Rebuilding the hint list walks items/fire near-checks; 10 Hz is plenty.
    this.poll -= dt
    if (this.poll <= 0) {
      this.poll = 0.1
      const list = this.hints(G)
      const sig = list.map(h => h[0] + h[1]).join('|')
      if (sig !== this.sig) {
        this.sig = sig
        this.el.innerHTML = list.map(([k, v]) => `<span class="ka"><kbd>${k}</kbd>${v}</span>`).join('')
        this.showT = mode === 'always' ? Infinity : 5.5
      }
    }
    if (this.showT !== Infinity) this.showT -= dt
    // Quiet down during dialogue so a subtitle is never competed with.
    this.el.classList.toggle('show', this.showT > 0)
    this.el.classList.toggle('quiet', !!G.speaking)
  }
}
