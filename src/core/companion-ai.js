// The friend you are NOT playing, driven by the story's own rules.
//
// FULL_STORY.md:28 — "Nishan hears things first, Nishant sees things first,
// and neither can prove it to the other."
// horror.md:1048-1060 — companion fear is a state (Calm → Uneasy → Alert →
// Frightened → Terrified), and "sometimes he should simply stop walking.
// The player should notice."
//
// This layer only adds *behaviour*. It never speaks for the companion and it
// yields completely to scripted story control (mode !== 'follow', hold poses,
// G.onUpdate follow-along sequences, alert hooks and the headless autopilot).
import { clamp, R } from './util.js'

const VISUAL = /apparition|figure|shadow|eyes|tall|creature|flash/i
const AUDIBLE = /ambient|whisper|payal|step|foot|rustle|knock|crack|howl|breath|door|voice|drone|silence|sting/i
const TREMBLE = { calm: 0, uneasy: 0.12, alert: 0.28, frightened: 0.45, terrified: 0.7 }

export const companionAI = {
  G: null,

  attach(G) { this.G = G },

  onSpawn(c, playerChar) {
    // The companion is whichever friend the player did not pick, so his sense
    // is the opposite of the protagonist's.
    c.role = playerChar === 'Nishant' ? 'hearer' : 'seer'
    c.ai = {
      state: 'calm', stateT: 0,
      reactPos: null, reactT: 0,
      freezeT: 0, pointT: 0, didPoint: false,
      cooldown: 0, lookT: 0, lookPos: null,
      goalT: R.range(8, 16)
    }
  },

  // Called by the horror director for apparitions, scares and ambient beats.
  onEvent(kind, pos) {
    const G = this.G, c = G && G.comp
    if (!c || !c.ai || G.auto) return
    const a = c.ai
    const visual = VISUAL.test(kind), audible = AUDIBLE.test(kind)
    if (!visual && !audible) return
    a.reactPos = pos ? { x: pos.x, y: pos.y ?? 1.4, z: pos.z } : null
    a.reactT = 0.8
    // A small ambient sound only turns his head — he does not stop the walk.
    // This is the hearer's tell; the player may notice it or may not.
    if (kind === 'ambient') {
      if (c.role === 'hearer' && a.reactPos && a.cooldown <= 0) {
        a.lookT = 0.9; a.lookPos = a.reactPos; a.cooldown = 3
      }
      return
    }
    // Only his own sense arrests him. The other sense gets a passing glance,
    // which the follower logic already supplies — so the split stays legible.
    if ((c.role === 'seer' ? visual : audible) && a.cooldown <= 0) {
      a.freezeT = c.role === 'seer' ? 0.9 : 0.55
      a.cooldown = 4.5
      if (c.role === 'seer' && visual && !G.speaking && c.P.pose === 'stand') a.pointT = 1.0
    }
  },

  // Runs AFTER companionUpdate each frame, so its overrides win for that frame.
  update(dt, G, horror) {
    const c = G.comp
    if (!c || !c.ai || c.attach || c.hidden || G.auto) return
    const a = c.ai
    a.stateT += dt
    a.reactT = Math.max(0, a.reactT - dt)
    a.freezeT = Math.max(0, a.freezeT - dt)
    a.pointT = Math.max(0, a.pointT - dt)
    a.cooldown = Math.max(0, a.cooldown - dt)
    a.lookT = Math.max(0, a.lookT - dt)

    // Warmth is the story's safety dial: by the fire both friends settle.
    const tension = clamp(Math.max(horror ? horror.value : 0, (G.fear || 0) * 0.72) - (G.warm || 0) * 0.22, 0, 1)
    const next = tension < 0.18 ? 'calm' : tension < 0.38 ? 'uneasy'
      : tension < 0.60 ? 'alert' : tension < 0.82 ? 'frightened' : 'terrified'
    if (next !== a.state && a.stateT > 0.9) { a.state = next; a.stateT = 0 }

    // Scripted moments own him completely.
    const free = c.mode === 'follow' && c.alertT <= 0 && !c.assisting
      && !(c.fidT > 0) && !G.onUpdate && !G.speaking
    if (!free) {
      if (a.didPoint && c.P.pose === 'point') { c.pose('stand'); a.didPoint = false }
      return
    }

    const p = G.player

    // Fear is a state, not a smooth number — the stillness is deliberate.
    if (TREMBLE[a.state] > c.P.tremble) c.P.tremble = TREMBLE[a.state]
    if (a.state === 'uneasy') c.idleLookT = Math.min(c.idleLookT, 2.2)

    if (a.freezeT > 0) {
      c.path = []
      const t = a.reactPos || G.lookingNow || { x: p.pos.x, y: 1.5, z: p.pos.z }
      c.look(t); c.face(t)
      c.P.tremble = Math.max(c.P.tremble, a.state === 'terrified' ? 0.75 : 0.35)
      if (a.pointT > 0 && c.P.pose === 'stand') { c.pose('point'); a.didPoint = true }
      return
    }
    if (a.didPoint && c.P.pose === 'point') { c.pose('stand'); a.didPoint = false }

    // "Simply stop walking. The player should notice." — no cue needed.
    if (a.state === 'terrified' && a.stateT < 0.6) {
      c.path = []
      c.look(G.lookingNow || { x: p.pos.x, y: 1.5, z: p.pos.z })
      return
    }

    // A held glance the follower's own look logic cannot immediately erase.
    if (a.lookT > 0 && a.lookPos) { c.look(a.lookPos); return }

    // While the day is still ordinary, he occasionally eyes the waypoint —
    // the friend who keeps asking "ye kya hai?" before any of this went wrong.
    if (a.state === 'calm' && G.goal) {
      a.goalT -= dt
      if (a.goalT <= 0) {
        a.goalT = R.range(10, 20)
        a.lookT = 1.5
        a.lookPos = { x: G.goal.x, y: 1.5, z: G.goal.z }
        c.look(a.lookPos)
      }
    }
  }
}
