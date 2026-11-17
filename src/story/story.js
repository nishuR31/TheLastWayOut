// Story state machine: chapters run in order; chapter 11 decides branch A or B.
import { G, ui } from './helpers.js'
import { ch1, ch1b } from './act1.js'
import { ch2 as campCh, } from './camp.js'
import { ch5 as lostCh, ch6 as fireCh } from './lost.js'
import { ch7 } from './act3.js'
import { ch9, ch10, ch11, ch12a, ch13a, ch12b, ch13b, ch14b, ch13c } from './act4.js'

export const CHAPTERS = [
  { id: 'c1', title: 'Ek aam din — A normal day', run: async (s) => { if (!(typeof location !== 'undefined' && /[?&]ride=1/.test(location.search))) await ch1(s); await ch1b(s) } },
  { id: 'c2', title: 'Campsite — Warm, ordinary, and the loop', run: campCh },
  { id: 'c5', title: 'Riding into the lost forest', run: lostCh },
  { id: 'c6', title: 'The fire — and the village that returns', run: fireCh },
  { id: 'c7', title: 'Gaon aur ghar — The village and the house', run: ch7 },
  { id: 'c9', title: 'Uncle ke do dost — The two friends', run: ch9 },
  { id: 'c10', title: 'Parchhai — The shadow', run: ch10 },
  { id: 'c11', title: 'Shamshan — The cremation ground', run: ch11 },
  { id: 'c12a', branch: 'A', title: 'Ending A · Antim raasta — The last stretch', run: ch12a },
  { id: 'c13a', branch: 'A', title: 'Ending A · Ghar — Home', run: ch13a },
  { id: 'c12b', branch: 'B', title: 'Ending B · Shamshan ki raat — Night at the ground', run: ch12b },
  { id: 'c13b', branch: 'B', title: 'Ending B · Ajnabi — The ordinary stranger', run: ch13b },
  { id: 'c14b', branch: 'B', title: 'Ending B · Chai — The tea stop', run: ch14b },
  { id: 'c13c', branch: 'C', title: 'Ending C · Aspatal — The hospital', run: ch13c },
]
let token = 0
export function stopStory() { token++; G.abort() }
export async function play(idx, { onEnd }) {
  const my = ++token
  G.abort(); G.beginRun(); G.flags = G.flags || {}; const s = { onEnd, branch: (CHAPTERS[idx] && CHAPTERS[idx].branch) || null, idx }
  G.flags = {}
  try {
    for (let i = idx; i < CHAPTERS.length; i++) {
      const c = CHAPTERS[i]
      if (c.branch && c.branch !== s.branch) continue
      if (my !== token) return
      s.idx = i; await c.run(s)
    }
  } catch (e) { if (e !== 'abort') throw e }
}
