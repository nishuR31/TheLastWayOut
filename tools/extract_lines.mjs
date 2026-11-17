// Extracts every spoken line from src/story/*.js into public/voice/lines.json
import fs from 'fs'
import { lineId } from '../src/core/hash.js'
const str = String.raw`(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")`
const ev = (s) => new Function('return ' + s)()
const lines = {}
const files = fs.readdirSync('src/story').filter(f => f.endsWith('.js') && f !== 'helpers.js' && f !== 'story.js')
const NAMES = { N: 'Nishan', T: 'Nishant', U: 'Uncle' }
for (const f of files) {
  const src = fs.readFileSync('src/story/' + f, 'utf8')
  const re2 = new RegExp(String.raw`(?<![\w.])(N|T|U)\(\s*(${str})\s*,\s*(${str})`, 'g')
  const re3 = new RegExp(String.raw`(?<![\w])(?:say|ui\.say)\(\s*(${str})\s*,\s*(${str})\s*,\s*(${str})`, 'g')
  let m
  while ((m = re2.exec(src))) { const who = NAMES[m[1]], hi = ev(m[2]), en = ev(m[3]); lines[lineId(who, hi)] = { who, hi, en, src: f } }
  while ((m = re3.exec(src))) { const who = ev(m[1]), hi = ev(m[2]), en = ev(m[3]); lines[lineId(who, hi)] = { who, hi, en, src: f } }
}
fs.mkdirSync('public/voice', { recursive: true })
fs.writeFileSync('public/voice/lines.json', JSON.stringify(lines, null, 1))
const by = {}; Object.values(lines).forEach(l => by[l.who] = (by[l.who] || 0) + 1)
console.log(Object.keys(lines).length, 'lines', by)
