import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/800.css'
import '@fontsource/noto-sans-devanagari/devanagari-400.css'
import '@fontsource/noto-sans-devanagari/devanagari-700.css'
import './style.css'
import { G } from './game.js'
import { audio } from './core/audio.js'
import { input } from './core/input.js'
import { ui } from './core/ui.js'
import { tips } from './core/tips.js'
import { REALITY, getUnlocked } from './reality.js'
import { CHAPTERS, play, stopStory } from './story/story.js'
import { nav } from './core/nav.js'
import { phone } from './core/phone.js'
import { fire } from './core/fire.js'
import { fmtClock } from './core/util.js'
import { charPreview } from './core/charpreview.js'
import { icons, iconTag as icon } from './core/icons.js'
import { keyaid } from './core/keyaid.js'

const $ = (id) => document.getElementById(id)
const SKEY = 'tlwo_settings_v1'
const defaults = { master: 0.8, voice: 1, amb: 0.8, sfx: 1, sens: 1, subs: 'both', caps: true, gfx: 'med', shake: false, flash: false, vlang: 'hi', nav: 'full', fov: 70, subsz: 1, playerChar: 'Nishan', keyaid: 'context' }
let S = { ...defaults, ...(() => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}') } catch (e) { return {} } })() }
let inGame = false, screenStack = [], pausedNow = false

// ---------- screens ----------
const SCREENS = ['charscreen', 'menu', 'chapters', 'settings', 'controls', 'pause', 'report', 'endcard', 'map', 'inventory']
function showScreen(id) {
  SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id))
  ui.show('hud', false) // keep the compass/HUD from bleeding through translucent screens
  screenStack.push(id)
}
function hideScreens() { SCREENS.forEach(s => $(s).classList.add('hidden')); ui.show('hud', true); screenStack = [] }
let backTo = 'menu', charFromMenu = false

// ---------- settings ----------
function applySettings() {
  audio.vol.master = +S.master; audio.vol.voice = +S.voice; audio.vol.amb = +S.amb; audio.vol.sfx = +S.sfx; audio.applyVolumes()
  input.sens = +S.sens; ui.subMode = S.subs; ui.caps = !!S.caps; ui.voiceLang = S.vlang
  ui.playerChar = S.playerChar === 'Nishant' ? 'Nishant' : 'Nishan'
  document.querySelectorAll('.cs-card').forEach(c => c.classList.toggle('selected', c.dataset.char === ui.playerChar))
  if (charPreview.select) charPreview.select(ui.playerChar)
  if ($('cs-name')) $('cs-name').textContent = ui.playerChar.toUpperCase()
  if ($('cs-trait')) $('cs-trait').textContent = ui.playerChar === 'Nishant' ? 'observant · sees things first' : 'hears things first · questions the strange'
  if ($('menu-char-name')) $('menu-char-name').textContent = ui.playerChar
  nav.setMode(S.nav); G.cfg.fov = +S.fov; G.cfg.keyaid = S.keyaid; document.documentElement.style.setProperty('--subsz', S.subsz);
  G.cfg.reduceShake = !!S.shake; G.cfg.reduceFlash = !!S.flash; ui.reduceFlash = !!S.flash
  if (G.renderer) G.setGfx(S.gfx); else G.cfg.gfx = S.gfx
  localStorage.setItem(SKEY, JSON.stringify(S))
}
function bindSettings() {
  const map = { 's-master': 'master', 's-voice': 'voice', 's-amb': 'amb', 's-sfx': 'sfx', 's-sens': 'sens', 's-subs': 'subs', 's-caps': 'caps', 's-gfx': 'gfx', 's-shake': 'shake', 's-flash': 'flash', 's-vlang': 'vlang', 's-nav': 'nav', 's-fov': 'fov', 's-subsz': 'subsz', 's-keyaid': 'keyaid' }
  for (const [id, k] of Object.entries(map)) {
    const el = $(id); if (el.type === 'checkbox') el.checked = !!S[k]; else el.value = S[k]
    el.addEventListener('input', () => { S[k] = el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' ? el.value : +el.value); applySettings() })
  }
}

// ---------- reality report ----------
function renderReport(head, onlyUnlocked = false) {
  const un = getUnlocked(), box = $('report-cards'); box.innerHTML = ''
  const typeName = { sci: 'SCIENCE · विज्ञान', myth: 'MYTH vs FACT · मिथक', unk: 'UNANSWERED · अनसुलझा', tip: 'REAL-LIFE TIP · सावधानी' }
  $('report-head').innerHTML = head || `<h2>ASLI SACH · THE REALITY REPORT</h2><p>Raat ki har awaaz, har saaya — jitna ho sake, uska asli kaaran. ${un.length} / ${REALITY.length} unlocked. Jo cheezein abhi bhi bina jawab ki hain, unhe hum jawab banakar nahi dikhate.</p>`
  for (const r of REALITY) {
    const open = un.includes(r.id)
    if (onlyUnlocked && !open) continue
    const c = document.createElement('div')
    // Unanswered cards must never look solved — the report deliberately does
    // not explain the village, the laugh, the samadhi or the drink.
    const unanswered = open && r.type === 'unk'
    c.className = 'card ' + r.type + (open ? '' : ' locked') + (unanswered ? ' unanswered' : '')
    if (unanswered && r.id === 'drink') c.classList.add('keystone')
    c.innerHTML = open
      ? `<div class="tag">${typeName[r.type]}</div><h4>${r.title}</h4><div class="saw">Aapne dekha: ${r.saw}</div><p>${r.hi}</p><p class="en">${r.en}</p>`
      : `<div class="tag">${typeName[r.type]}</div><h4>???</h4><div class="saw">Abhi tak nahi mila.</div>`
    box.appendChild(c)
  }
  const n = $('m-log-n'); if (n) n.textContent = `(${un.length}/${REALITY.length})`
}

// ---------- pause ----------
function pauseGame() {
  if (!inGame || pausedNow || mapOpen) return
  pausedNow = true; G.paused = true; input.enabled = false; input.unlock(); if (audio.ctx) audio.ctx.suspend()
  backTo = 'pause'; renderPauseInfo(); showScreen('pause')
}
function resumeGame() {
  if (!pausedNow) return
  pausedNow = false; hideScreens(); G.paused = false; input.enabled = true; if (audio.ctx) audio.ctx.resume(); input.lock()
}
// Escape on the pause screen is handled together with the other menu letters
// below, so it can check which screen is actually visible (and yield to the
// map / inventory handlers) instead of firing on every paused state.

// ---------- map ----------
let mapOpen = false
function openMap() {
  if (!inGame || pausedNow || mapOpen || !G.level || input.locked === undefined) return
  mapOpen = true; pausedNow = true; G.paused = true; input.enabled = false; input.unlock(); if (audio.ctx) audio.ctx.suspend()
  document.body.classList.add('map-open'); backTo = 'pause'; showScreen('map'); $('map-title').textContent = 'Naksha · ' + nav.title()
  nav.fullK = 1; drawMap()
}
function drawMap() { nav.drawFull($('map-c')); $('map-obj').innerHTML = nav.fullInfo() }
function closeMap() {
  if (!mapOpen) return
  mapOpen = false; document.body.classList.remove('map-open'); pausedNow = false; hideScreens(); G.paused = false; input.enabled = true; if (audio.ctx) audio.ctx.resume(); input.lock()
}
addEventListener('keydown', e => {
  if (e.repeat) return
  // M is the map only while actually playing. On the pause screen the letter M
  // means "Main menu" — so leave that keydown for the menu handler below.
  if (e.code === 'KeyM') {
    if (mapOpen) { e.preventDefault(); e.stopImmediatePropagation(); closeMap() }
    else if (inGame && !pausedNow && !invOpen && G.level) { e.preventDefault(); e.stopImmediatePropagation(); openMap() }
  }
  else if (e.code === 'Escape' && mapOpen) { e.preventDefault(); e.stopImmediatePropagation(); closeMap() }
  else if (mapOpen && (e.code === 'Equal' || e.code === 'NumpadAdd')) { nav.fullK = Math.min(8, nav.fullK * 1.35); drawMap() }
  else if (mapOpen && (e.code === 'Minus' || e.code === 'NumpadSubtract')) { nav.fullK = Math.max(1, nav.fullK / 1.35); drawMap() }
}, true)
window.__openMap = openMap


// ---------- inventory (I) ----------
let invOpen = false, invFromPause = false
function invItems() {
  const bat = phone.battery(), have = (v) => v !== false && v !== undefined && v !== null
  const items = [
    { ic: icons.phone, n: 'Phone', ok: G.hasPhone !== false, ct: bat + '%', t: G.hasSignal ? 'Network hai · P kholo, F flashlight' : 'Network nahi · P kholo, F flashlight' },
    { ic: icons.key, n: 'Bike ki chabi', ok: G.hasKey !== false, t: 'B — bike par baitho / utro' },
    { ic: icons.helmet, n: 'Helmet', ok: G.hasHelmet !== false, t: 'Dono ke helmet' },
    { ic: icons.money, n: 'Paise', ok: (G.money || 0) > 0, ct: '₹' + (G.money || 0), t: 'Chacha ne diye the' },
    { ic: icons.matchbox, n: 'Matchbox', ok: (G.matches || 0) > 0, ct: G.matches || 0, t: (G.matches || 0) > 0 ? `${G.matches} teeli bachi hain` : 'Teeliyan geeli / khatam' },
    { ic: icons.lighter, n: 'Lighter', ok: false, t: 'Nahi hai. Mummy ne ghar se hata diya tha' },
    { ic: icons.wood, n: 'Sookhi lakdi', ok: fire.count > 0, ct: fire.count, t: 'E — uthao · T — aag banao (3) · pit par E (2)', hot: fire.count >= 3 },
    { ic: icons.sparkPlug, n: 'Spare spark plug', ok: !!G.sparePlug, t: 'Chacha ke toolbox se · chingari ke liye' },
    { ic: icons.petrol, n: 'Petrol (dhakkan)', ok: !!G.petrol, t: 'Aag bhadkane ke liye, thoda sa' },
    { ic: icons.torch, n: 'Jalti lakdi (mashaal)', ok: !!G.brand, t: 'Garam rehti hai, aage ki taraf nahi jhukti' },
    { ic: icons.tiffin, n: 'Biscuit ka tiffin', ok: !!G.hasTiffin, t: 'Mummy ne diya' },
    { ic: icons.camera, n: 'Photos', ok: (G.photos || 0) > 0, ct: G.photos || 0, t: 'Camp ki yaadein' }
  ]
  return items
}
function invTip() {
  const L = G.level, tips = []
  if (fire.count >= 3) tips.push('Tumhare paas 3+ sookhi lakdi hai: <kbd>T</kbd> dabao aur aag banao (khule mein baarish se bujh jaati hai, shelter mein tikti hai).')
  else if (fire.count > 0) tips.push('Aag ke liye 3 sookhi lakdi chahiye. Patte-lakdi jungle mein raaste ke kinare milti hai (<kbd>E</kbd>).')
  if (G.hasPhone === false) tips.push('Phone abhi mez par rah gaya hai.')
  if (G.hasKey === false) tips.push('Bike ki chabi deewar ke hook par rah gayi hai.')
  if (!tips.length) tips.push('Sab kuch saath hai. <kbd>I</kbd> dobara dabao band karne ke liye.')
  return tips.join('<br>')
}
function renderInventory() {
  const box = $('inv-grid'); box.innerHTML = ''
  for (const it of invItems()) {
    const c = document.createElement('div'); c.className = 'inv-card' + (it.ok ? '' : ' off') + (it.hot ? ' hot' : '')
    c.innerHTML = `${icon(it.ic)}${it.ct !== undefined && it.ok ? `<div class="ct">${it.ct}</div>` : ''}<h4>${it.n}</h4><small>${it.t}</small>`
    box.appendChild(c)
  }
  $('inv-tip').innerHTML = invTip()
}
function openInventory(fromPause = false) {
  if (!inGame || invOpen || mapOpen) return
  invFromPause = fromPause
  if (!pausedNow) { pausedNow = true; G.paused = true; input.enabled = false; input.unlock(); if (audio.ctx) audio.ctx.suspend() }
  invOpen = true; renderInventory(); backTo = 'pause'; showScreen('inventory')
}
function closeInventory() {
  if (!invOpen) return
  invOpen = false
  if (invFromPause) { renderPauseInfo(); showScreen('pause'); return }
  pausedNow = false; hideScreens(); G.paused = false; input.enabled = true; if (audio.ctx) audio.ctx.resume(); input.lock()
}
function renderPauseInfo() {
  const el = $('pause-info'); if (!el) return
  const ok = (v) => (v === false ? '✗' : '✓')
  const mini = (src, val) => `<span class="pi-item">${icon(src)}<span>${val}</span></span>`
  el.innerHTML = `<b>${fmtClock(G.time)}</b> · ${G.level ? G.level.name : ''}<br>`
    + mini(icons.phone, ok(G.hasPhone))
    + mini(icons.key, ok(G.hasKey))
    + mini(icons.helmet, ok(G.hasHelmet))
    + mini(icons.wood, fire.count)
    + mini(icons.matchbox, G.matches || 0)
    + mini(icons.camera, G.photos || 0)
}
// ---------- keyboard shortcuts for every menu: the highlighted letter ----------
addEventListener('keydown', e => {
  // Ctrl/Cmd+V — screenshot (V on its own is the helmet visor)
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
    e.preventDefault(); e.stopImmediatePropagation()
    try {
      const data = G.canvas && G.canvas.toDataURL('image/png')
      if (data) {
        const a = document.createElement('a'); a.href = data
        a.download = 'tlwo-' + Date.now() + '.png'
        document.body.appendChild(a); a.click(); a.remove()
        ui.toast('Screenshot saved [ic:camera]', 1.8)
      }
    } catch (err) { ui.toast('Screenshot failed', 2) }
    return
  }
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
  const vis = (id) => { const el = $(id); return !!el && !el.classList.contains('hidden') }
  const k = e.code.startsWith('Key') ? e.code.slice(3) : e.code
  const hit = (id) => { const el = $(id); if (el && !el.classList.contains('hidden')) { e.preventDefault(); e.stopImmediatePropagation(); el.click(); return true } return false }
  // Escape resumes from the pause screen — but only when no modal sits over it.
  // The map owns Escape while open, and the inventory owns it while open.
  if (k === 'Escape' && vis('pause') && !invOpen && !mapOpen) { e.preventDefault(); e.stopImmediatePropagation(); resumeGame(); return }
  if (k === 'I' && inGame) {
    e.preventDefault(); e.stopImmediatePropagation()
    if (invOpen) closeInventory(); else if (vis('pause')) openInventory(true); else if (!pausedNow) openInventory(false)
    return
  }
  if (vis('charscreen')) {
    if (k === 'Enter' || k === 'Space') { hit('cs-next'); return }
    if (k === 'ArrowLeft' || k === 'KeyA') { hit('cs-nishan'); return }
    if (k === 'ArrowRight' || k === 'KeyD') { hit('cs-nishant'); return }
    if (k === 'Escape' && charFromMenu) { hit('cs-back'); return }
    return
  }
  if (vis('menu')) { const m = { N: 'm-start', C: 'm-chapters', R: 'm-log', S: 'm-settings', K: 'm-controls', Q: 'm-quit', V: 'm-char' }; if (m[k]) hit(m[k]); return }
  if (vis('pause')) { const m = { R: 'p-resume', S: 'p-settings', C: 'p-controls', M: 'p-menu', Q: 'p-quit' }; if (m[k]) hit(m[k]); return }
  if (vis('endcard')) { const m = { R: 'e-report', M: 'e-menu' }; if (m[k]) hit(m[k]); return }
  if (invOpen && (k === 'Escape' || k === 'B')) { e.preventDefault(); e.stopImmediatePropagation(); closeInventory(); return }
  if (['settings', 'controls', 'chapters', 'report'].some(vis) && (k === 'Escape' || k === 'B' || k === 'Backspace')) { const b = document.querySelector('.screen:not(.hidden) .back, #r-close:not(.hidden)'); if (b) { e.preventDefault(); e.stopImmediatePropagation(); b.click() } }
}, true)
window.__openInventory = openInventory

// ---------- game start ----------
async function startGame(chIdx = 0) {
  audio.init(); applySettings()
  // Per the definitive script: a NEW GAME starts with nothing — the phone, key
  // and helmets are picked up during Chapter 1. Chapter-select starts equipped.
  const skipHome = new URLSearchParams(location.search).has('ride')
  G.hasPhone = chIdx !== 0 || skipHome; G.hasKey = G.hasPhone; G.hasHelmet = G.hasPhone
  G._itemStaged = chIdx !== 0 || skipHome
  G.itemTaken = { key: G.hasKey, phone: G.hasPhone, helmet: G.hasHelmet }
  G.helmetOnBike = false
  G.torchOn = false
  hideScreens(); inGame = true; pausedNow = false; G.paused = false
  ui.fadeInstant(1)
  input.enabled = false
  if (!G.running) G.start()
  try {
    const res = await play(chIdx, { onEnd: showEnd })
  } catch (e) {
    if (e !== 'abort') {
      console.error(e)
      ui.toast('कहानी लोड नहीं हो सकी · Story could not load', 6)
      setTimeout(() => { if (inGame) toMenu() }, 2500)
    }
  }
}
function toMenu() {
  phone.close(); invOpen = false
  mapOpen = false; document.body.classList.remove('map-open'); stopStory(); inGame = false; pausedNow = false; G.paused = false; input.enabled = false; input.unlock()
  ui.show('hud', false); ui.fadeInstant(1); if (audio.ctx) { audio.ctx.resume(); audio.st.engine = 0 }
  renderReport(null); backTo = 'menu'; showScreen('menu'); $('m-quit').classList.toggle('hidden', !window.electronAPI)
}
function showEnd(title, sub) {
  inGame = false; input.enabled = false; input.unlock()
  $('end-title').textContent = title; $('end-sub').textContent = sub; ui.fadeInstant(1); showScreen('endcard')
}

// ---------- wiring ----------
function wire() {
  // character-select screen
  document.querySelectorAll('.cs-card').forEach(card => {
    card.onclick = () => { S.playerChar = card.dataset.char; applySettings(); audio.click && audio.click() }
  })
  $('cs-next').onclick = () => { audio.init(); audio.click && audio.click(); charFromMenu = false; $('cs-back').classList.add('hidden'); showScreen('menu') }
  const toChars = () => { charFromMenu = true; backTo = 'menu'; $('cs-back').classList.remove('hidden'); showScreen('charscreen') }
  $('m-char').onclick = toChars
  $('m-char-btn').onclick = toChars
  $('cs-back').onclick = () => { audio.click && audio.click(); showScreen('menu') }
  $('m-start').onclick = () => startGame(0)
  $('m-chapters').onclick = () => { const L = $('chapter-list'); L.innerHTML = ''; CHAPTERS.forEach((c, i) => { const b = document.createElement('button'); b.textContent = `${i + 1}.  ${c.title}`; b.onclick = () => startGame(i); L.appendChild(b) }); showScreen('chapters') }
  $('m-log').onclick = () => { renderReport(null); backTo = 'menu'; showScreen('report') }
  $('m-settings').onclick = () => { backTo = 'menu'; showScreen('settings') }
  $('m-controls').onclick = () => { backTo = 'menu'; showScreen('controls') }
  $('m-quit').onclick = () => window.electronAPI && window.electronAPI.quit()
  document.querySelectorAll('.back').forEach(b => b.onclick = () => showScreen(backTo))
  $('p-resume').onclick = resumeGame
  $('map-close').onclick = closeMap
  $('map-zi').onclick = () => { nav.fullK = Math.min(8, nav.fullK * 1.35); drawMap() }
  $('map-zo').onclick = () => { nav.fullK = Math.max(1, nav.fullK / 1.35); drawMap() }
  $('map-c').addEventListener('wheel', e => { e.preventDefault(); nav.fullK = e.deltaY < 0 ? Math.min(8, nav.fullK * 1.2) : Math.max(1, nav.fullK / 1.2); drawMap() }, { passive: false })
  const tb = (id, fn) => { const b = $(id); if (b) b.addEventListener('touchstart', e => { fn(); e.preventDefault() }, { passive: false }) }
  tb('b-map', () => (mapOpen ? closeMap() : openMap())); tb('b-help', () => nav.help())
  $('p-settings').onclick = () => { backTo = 'pause'; showScreen('settings') }
  $('p-controls').onclick = () => { backTo = 'pause'; showScreen('controls') }
  $('p-menu').onclick = toMenu
  $('p-inv').onclick = () => openInventory(true)
  $('inv-close').onclick = closeInventory
  $('p-quit').onclick = () => window.electronAPI && window.electronAPI.quit()
  $('p-quit').classList.toggle('hidden', !window.electronAPI)
  $('r-close').onclick = () => { if (backTo === 'end') showScreen('endcard'); else showScreen('menu') }
  $('e-report').onclick = () => { renderReport(null); backTo = 'end'; showScreen('report') }
  $('e-menu').onclick = toMenu
  // first user gesture unlocks audio
  addEventListener('pointerdown', () => audio.init(), { once: true })
  addEventListener('keydown', () => audio.init(), { once: true })
}

// ---------- boot ----------
try {
  G.init($('c')); ui.init(); input.init($('c'), { onPause: pauseGame }); keyaid.init(); bindSettings(); applySettings(); wire(); tips.init()
  charPreview.init($('char-preview'))
  window.__charPreview = charPreview
} catch (err) {
  // Graceful degradation when WebGL2 is unavailable: explain instead of a black page.
  console.error(err)
  const ld = $('loading')
  if (ld) {
    ld.classList.remove('hidden')
    ld.innerHTML = '<div class="ld-t">THE LAST WAY OUT</div><div class="ld-s" style="margin-top:1em;max-width:34em;line-height:1.6">This game needs WebGL2, which your browser or graphics driver did not provide.<br>Try a current browser with hardware acceleration enabled.</div>'
  }
  throw err
}
G.start()
const q = new URLSearchParams(location.search)
// Opt-in AI-agent dev harness: dynamically imported only with ?dev=1, so it is
// absent from normal play and from the default bundle's startup path.
if (q.has('dev')) import('./dev/harness.js').catch(e => console.error('dev harness failed to load', e))
renderReport(null)
if (q.has('ch')) { startGame(+q.get('ch') || 0) }
else {
  ui.fadeInstant(1)
  showScreen(q.has('auto') ? 'menu' : 'charscreen') // character select → menu is the normal first-run flow
  $('m-quit').classList.toggle('hidden', !window.electronAPI)
}

// Splash screen: fades out on its own, or instantly on the first click / keypress.
// ?nosplash skips it entirely (used by automated tests).
const splash = $('splash')
if (splash && !q.has('nosplash') && !q.has('ch') && !q.has('auto')) {
  let dismissed = false
  const dismiss = () => {
    if (dismissed) return
    dismissed = true
    splash.classList.add('out')
    setTimeout(() => splash.classList.add('hidden'), 750)
    removeEventListener('keydown', dismiss)
    splash.removeEventListener('click', dismiss)
  }
  addEventListener('keydown', dismiss)
  splash.addEventListener('click', dismiss)
  setTimeout(dismiss, 3400)
} else if (splash) splash.classList.add('hidden')
if (q.has('auto')) { G.auto = true; if (q.get('auto') === 'b') G.autoPick = 1; if (q.has('ts')) G.timeScale = +q.get('ts'); if (q.has('fast')) G.fastSim = +q.get('fast') }
phone.init(G, {
  settings: () => { pauseGame(); backTo = 'pause'; showScreen('settings') },
  menu: () => pauseGame()
})
window.__startGame = startGame
