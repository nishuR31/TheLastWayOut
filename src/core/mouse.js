// Mouse-clickable action bar. Clicks are injected into the SAME input state the
// keyboard uses, so every action keeps one implementation and one set of guards.
import { input } from './input.js'

const $ = (id) => document.getElementById(id)
const ACTIONS = [
  { code: 'KeyE', label: 'USE', key: 'E' },
  { code: 'KeyE', label: 'BACK', key: '⇧E', shift: true },
  { code: 'KeyF', label: 'LIGHT', key: 'F' },
  { code: 'KeyB', label: 'BIKE', key: 'B' },
  { code: 'KeyG', label: 'PUSH', key: 'G' },
  { code: 'KeyT', label: 'FIRE', key: 'T' },
  { code: 'KeyP', label: 'PHONE', key: 'P' },
  { code: 'KeyC', label: 'CROUCH', key: 'C', hold: true },
  { code: 'KeyI', label: 'BAG', key: 'I' },
  { code: 'KeyM', label: 'MAP', key: 'M' },
  { code: 'KeyH', label: 'HELP', key: 'H' }
]

export const mouseCtl = {
  init() {
    const bar = $('actionbar'); if (!bar) return
    bar.innerHTML = ACTIONS.map(a =>
      `<button type="button" data-code="${a.code}" data-key="${a.key}"${a.shift ? ' data-shift="1"' : ''}${a.hold ? ' data-hold="1"' : ''} title="${a.key}">${a.label}<kbd>${a.key}</kbd></button>`
    ).join('')
    bar.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button[data-code]'); if (!b) return
      e.preventDefault(); e.stopPropagation()
      if (!input.enabled) return
      const code = b.dataset.code, hold = b.dataset.hold === '1'
      if (b.dataset.shift === '1') {
        input._mouseShiftUntil = performance.now() + 220
        input.keys.Shift = true
      }
      input.keys[code] = true
      input.pressed.add(code)
      b.classList.add('down')
      const release = () => {
        b.classList.remove('down')
        if (!hold) { input.keys[code] = false; if (b.dataset.shift === '1') input.keys.Shift = false }
      }
      if (hold) {
        // Crouch is a hold key: toggle it on click, click again to release.
        b.dataset.on = b.dataset.on === '1' ? '0' : '1'
        if (b.dataset.on === '1') { input.keys[code] = true; b.classList.add('on') }
        else { input.keys[code] = false; b.classList.remove('on') }
        setTimeout(() => b.classList.remove('down'), 120)
      } else setTimeout(release, 90)
    })
  }
}
