// Custom item icons. The SVGs live in /icons at the project root; Vite imports
// them as (inlined) asset URLs so nothing depends on emoji glyph availability.
// Narrative strings use [ic:name] tokens — no emoji glyphs remain in the source.
import phone from '../../icons/phone.svg'
import key from '../../icons/key.svg'
import helmet from '../../icons/helmet.svg'
import money from '../../icons/money.svg'
import matchbox from '../../icons/matchbox.svg'
import lighter from '../../icons/lighter.svg'
import wood from '../../icons/wood.svg'
import sparkPlug from '../../icons/spark-plug.svg'
import petrol from '../../icons/petrol.svg'
import torch from '../../icons/torch.svg'
import tiffin from '../../icons/tiffin.svg'
import camera from '../../icons/camera.svg'
import network from '../../icons/network.svg'
import tyre from '../../icons/tyre.svg'

export const icons = { phone, key, helmet, money, matchbox, lighter, wood, sparkPlug, petrol, torch, tiffin, camera, network, tyre }

// Legacy emoji glyphs, still accepted at runtime in case a string is built
// dynamically. Every authored string now uses the [ic:name] token below.
const EMOJI_ICON = {
  '📱': icons.phone,
  '🔑': icons.key,
  '🪖': icons.helmet,
  '💵': icons.money,
  '🔥': icons.matchbox,
  '🪔': icons.lighter,
  '🪵': icons.wood,
  '🔧': icons.sparkPlug,
  '⛽': icons.petrol,
  '🏏': icons.torch,
  '🍪': icons.tiffin,
  '📷': icons.camera,
  '📶': icons.network,
  '🛞': icons.tyre
}

// 26FD is the fuel-pump glyph; 2713/2717 (✓/✗) are deliberately excluded so
// status ticks/crosses in the UI text are preserved.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{26FD}]\u{FE0F}?/gu
const TOKEN_RE = /\[ic:([A-Za-z]+)\]/g
// Icons are decorative: the adjacent text already names the item, so hide the
// image from screen readers instead of announcing a duplicate label.
const img = (src) => `<img class="ic-inline" src="${src}" alt="" aria-hidden="true">`

// Replace icon tokens (and any stray emoji glyphs) with inline <img> icons.
// All inputs are internal game strings, and only tokens/mapped glyphs are touched.
export function inlineIcons(text) {
  return String(text)
    .replace(EMOJI_RE, (glyph) => {
      const src = EMOJI_ICON[glyph] ?? EMOJI_ICON[glyph.replace(/\uFE0F$/, '')]
      return src ? img(src) : ''
    })
    .replace(TOKEN_RE, (_, name) => {
      const src = icons[name]
      return src ? img(src) : ''
    })
}

// An <img> tag for a standalone inventory icon. Decorative by default; the
// visible card heading supplies the accessible name.
export const iconTag = (src) => `<img class="ic" src="${src}" alt="" aria-hidden="true">`
