// In-game phone: bottom-right HUD widget. P toggles it, F toggles the flashlight (also via the phone icon).
import { audio } from './audio.js'
import { fmtClock } from './util.js'
import { ui } from './ui.js'

const $ = (id) => document.getElementById(id)
const ICON = {
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>',
  torch: '<svg viewBox="0 0 24 24"><path d="M8 2h8l-1.5 6h-5zM9.5 8h5v13h-5z"/><path d="M12 11v3"/></svg>',
  time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  network: '<svg viewBox="0 0 24 24"><path d="M3 9a13 13 0 0 1 18 0M6 12.5a8.5 8.5 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="19.2" r="1"/></svg>'
}

export const phone = {
  open: false, G: null, hooks: {},
  init(G, hooks = {}) {
    this.G = G; this.hooks = hooks
    const el = $('phone'); if (!el) return
    el.innerHTML = `
      <div class="ph-body">
        <div class="ph-notch"></div>
        <div class="ph-status"><span id="ph-time">--:--</span><span class="ph-sig" id="ph-sig"><i></i><i></i><i></i><i></i></span><span id="ph-bat" class="ph-bat"><b></b></span></div>
        <div class="ph-clock" id="ph-clock">--:--</div>
        <div class="ph-net" id="ph-net">No service</div>
        <div class="ph-grid">
          <button data-app="torch" id="ph-torch">${ICON.torch}<span>Flashlight</span><kbd>F</kbd></button>
          <button data-app="settings">${ICON.settings}<span>Settings</span><kbd>2</kbd></button>
          <button data-app="menu">${ICON.menu}<span>Menu</span><kbd>3</kbd></button>
          <button data-app="time" id="ph-app-time">${ICON.time}<span id="ph-app-time-t">Time</span></button>
          <button data-app="network" id="ph-app-net">${ICON.network}<span id="ph-app-net-t">Network</span></button>
        </div>
        <div class="ph-home"></div>
      </div>`
    el.querySelectorAll('button[data-app]').forEach(b => {
      const run = (e) => { e.preventDefault(); e.stopPropagation(); this.action(b.dataset.app) }
      b.addEventListener('click', run); b.addEventListener('touchstart', run, { passive: false })
    })
    addEventListener('keydown', e => {
      if (e.repeat || !this.open || !this.G.input.enabled) return
      if (e.code === 'Digit1') this.action('torch')
      else if (e.code === 'Digit2') this.action('settings')
      else if (e.code === 'Digit3') this.action('menu')
    })
    setInterval(() => { if (this.open) this.refresh() }, 400)
  },
  toggle(on = !this.open) {
    if (on === this.open) return
    if (on && this.G.hasPhone === false) { ui.toast('Phone table par rakha hai · Your phone is on the table', 2.5); return }
    this.open = on; $('phone').classList.toggle('show', on); document.body.classList.toggle('phone-open', on)
    if (audio.ctx) audio.phoneBuzz()
    if (on) this.refresh()
  },
  close() { this.toggle(false) },
  action(app) {
    if (app === 'torch') { this.G.toggleLight(); this.refresh() }
    else if (app === 'settings') { this.close(); this.hooks.settings && this.hooks.settings() }
    else if (app === 'menu') { this.close(); this.hooks.menu && this.hooks.menu() }
    else this.refresh()
  },
  battery() { const G = this.G; if (G.batteryOverride) return G.batteryOverride; return Math.max(6, Math.round(78 - (G.time >= 19 ? (G.time - 19) * 6 : 0))) },
  refresh() {
    const G = this.G, t = fmtClock(G.time), sig = !!G.hasSignal, bat = this.battery()
    $('ph-time').textContent = t; $('ph-clock').textContent = t
    $('ph-net').textContent = sig ? 'Network connected' : 'No service'
    $('ph-sig').className = 'ph-sig' + (sig ? ' on' : '')
    $('ph-app-net').classList.toggle('off', !sig); $('ph-app-net-t').textContent = sig ? 'Network' : 'No signal'
    $('ph-app-time-t').textContent = t
    $('ph-torch').classList.toggle('on', !!G.torchActive() || !!(G.scooter && G.player.push && G.scooter.lightOn))
    const b = $('ph-bat'); b.firstElementChild.style.width = bat + '%'; b.classList.toggle('low', bat < 20); b.title = bat + '%'
  }
}
