// Unified keyboard / mouse (pointer lock, drag fallback) / touch input
export const input = {
  keys: {}, pressed: new Set(), clicked: false, dx: 0, dy: 0, locked: false, enabled: false, touch: false,
  joy: { x: 0, y: 0 }, sens: 1, canvas: null, drag: false, noLock: false,
  down(code) { return !!this.keys[code] },
  hit(code) { return this.pressed.has(code) },
  axis() {
    let x = 0, y = 0
    if (this.keys.KeyW || this.keys.ArrowUp) y += 1
    if (this.keys.KeyS || this.keys.ArrowDown) y -= 1
    if (this.keys.KeyD || this.keys.ArrowRight) x += 1
    if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1
    x += this.joy.x; y += this.joy.y
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l }
    return { x, y }
  },
  consumeLook() { const r = { x: this.dx, y: this.dy }; this.dx = 0; this.dy = 0; return r },
  consumeClick() { const v = this.clicked; this.clicked = false; return v },
  endFrame() { this.pressed.clear() },
  init(canvas, hooks) {
    this.canvas = canvas; this.hooks = hooks
    // Shift state straight from the event (immune to lost keyup / focus changes)
    const syncShift = e => { if (e.shiftKey !== undefined) this.keys.Shift = !!e.shiftKey }
    addEventListener('keyup', syncShift, true); addEventListener('mousemove', syncShift, true); addEventListener('mousedown', syncShift, true)
    addEventListener('keydown', e => {
      syncShift(e)
      if (e.repeat) { if (this.enabled) e.preventDefault(); return }
      this.keys[e.code] = true; this.pressed.add(e.code)
      if (e.code === 'Escape' && this.enabled) hooks.onPause && hooks.onPause()
      if (this.enabled && ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    })
    addEventListener('keyup', e => { this.keys[e.code] = false })
    addEventListener('blur', () => { this.keys = {} })
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked
      this.locked = document.pointerLockElement === canvas
      if (was && !this.locked && this.enabled && hooks.onPause) hooks.onPause()
    })
    document.addEventListener('pointerlockerror', () => { this.noLock = true })
    addEventListener('mousemove', e => {
      if (!this.enabled) return
      if (this.locked || this.drag) { this.dx += e.movementX; this.dy += e.movementY }
    })
    canvas.addEventListener('mousedown', (e) => { if (!this.enabled) return; if (e.button === 0) this.clicked = true; this.drag = true; this.lock() })
    addEventListener('mouseup', () => { this.drag = false })
    this.setupTouch()
  },
  lock() {
    if (this.touch || this.noLock || !this.canvas || !this.canvas.requestPointerLock || this.locked) return
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { this.noLock = true }) } catch (e) { this.noLock = true }
  },
  unlock() { if (document.pointerLockElement) document.exitPointerLock() },
  setupTouch() {
    const joy = document.getElementById('joy'), look = document.getElementById('look')
    let jid = null, lid = null, lx = 0, ly = 0, ox = 0, oy = 0
    addEventListener('touchstart', () => { this.touch = true; if (this.enabled) document.getElementById('touch').classList.remove('hidden') }, { passive: true })
    joy.addEventListener('touchstart', e => { const t = e.changedTouches[0]; jid = t.identifier; const r = joy.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; e.preventDefault() }, { passive: false })
    joy.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === jid) { const x = (t.clientX - ox) / 55, y = (t.clientY - oy) / 55; const l = Math.hypot(x, y) || 1, k = Math.min(1, l) / l; this.joy.x = x * k; this.joy.y = -y * k; joy.firstElementChild.style.transform = `translate(${x * k * 30}px,${y * k * 30}px)` } e.preventDefault() }, { passive: false })
    const jend = () => { jid = null; this.joy.x = this.joy.y = 0; joy.firstElementChild.style.transform = '' }
    joy.addEventListener('touchend', jend); joy.addEventListener('touchcancel', jend)
    look.addEventListener('touchstart', e => { const t = e.changedTouches[0]; lid = t.identifier; lx = t.clientX; ly = t.clientY; e.preventDefault() }, { passive: false })
    look.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === lid) { this.dx += (t.clientX - lx) * 1.6; this.dy += (t.clientY - ly) * 1.6; lx = t.clientX; ly = t.clientY } e.preventDefault() }, { passive: false })
    look.addEventListener('touchend', () => { lid = null })
    const bind = (id, code) => { const b = document.getElementById(id); b.addEventListener('touchstart', e => { this.keys[code] = true; this.pressed.add(code); e.preventDefault() }, { passive: false }); b.addEventListener('touchend', () => { this.keys[code] = false }) }
    bind('b-run', 'ShiftLeft'); bind('b-torch', 'KeyF'); bind('b-use', 'KeyE'); bind('b-pause', 'Escape')
  }
}
