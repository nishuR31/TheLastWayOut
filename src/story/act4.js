// Chapters 9-11 (escort, shadow, cremation ground + branch) and both endings.
import { G, ui, audio, THREE, N, T, U, say, wait, load, startScene, endScene, setTime, compHold, compFollow, reveal, fear, tired, use, gate, snapTo, go, goTrail, trailD, trailLen, lookFor, lookedAway, focus, around, stepsAt, spawn, caption, followAlong, stopFollow, pushOn, pushOff, choose, enableTrail } from './helpers.js'
import { ptAt, sideAt } from '../world/common.js'
import { makePickaxe, makeGlass, makeSteelGlass } from '../world/people.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const P = () => G.player
const D2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

// a snake-like shape slides across the ground from a to b
async function slither(snake, a, b, secs = 3.2) {
  const segs = snake.userData.segs, dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len
  snake.visible = true; let el = 0
  try {
    await G.until(() => {
      el += G.lastDt; const k = Math.min(1, el / secs), hx = a.x + dx * k, hz = a.z + dz * k
      segs.forEach((s, i) => { const w = Math.sin(el * 7 - i * 0.7) * 0.06; s.position.set(hx - ux * i * 0.07 - uz * w, 0.035, hz - uz * i * 0.07 + ux * w) })
      return k >= 1
    })
  } finally { snake.visible = false }
}
// background loop helper that never throws on story abort
function loop(fn, gap) { const h = { on: true }; (async () => { try { while (h.on) { fn(); await wait(typeof gap === 'function' ? gap() : gap) } } catch (e) {} })(); return h }

/* ------------------------------------------------------------------ CH 9 */
export async function ch9(s) {
  setTime(3.55, 0, false, true)
  const L = await load('escort', { scooter: true }, { dx: 1.2 })
  const c = G.comp, W = L.pathPts
  G.hasSignal = false; G.torchOn = true
  const un = spawn('uncle', 0.9, -10.5, 0), m1 = spawn('man1', -1.0, -12.8, 0), m2 = spawn('man2', 1.2, -14, 0)
  un.collide = m1.collide = m2.collide = false
  const crew = [{ a: un, off: 3.0 }, { a: m1, off: 5.2 }, { a: m2, off: -3.2 }]
  followAlong(W, crew, 1.5)
  await startScene(1.8)
  ui.titleCard('CHAPTER 9', 'Uncle ke do dost', '3:50 AM', 3.4)
  G.clockRate = 5; fear(0.35); tired(0.95)
  await T('Uncle aur unke dost... itni raat ko hamare liye nikle. Shukriya.', 'The uncle and his friends... coming out at this hour for us. Thank you.', { dur: 4 })
  await say('Uncle', 'Ye mere dost hain. Bhola aur Mangu.', 'These are my friends. Bhola and Mangu.', { pos: un.pos, dur: 3 })
  await say('Bhola', 'Namaste.', 'Namaste.', { pos: m1.pos, dur: 1.6 })
  await say('Mangu', 'Arre bacche, namaste! Chalo chalo, raat ho gayi.', 'Hey kids, namaste! Come on, it is late.', { pos: m2.pos, dur: 3 })
  caption('[Mangu hums, under his breath, the exact tune Karan could never name]', 4)
  await N('(dheere) Bhai, wahi dhun...', '(whisper) That same tune...', { dur: 2 })
  await T('(dheere) Mat bol. Chal.', '(whisper) Do not say it. Keep walking.', { dur: 2 })
  ui.toast('Scooter dhakelte hue chalte raho', 4.5)
  await goTrail(W, 50)
  await N('Raasta... patla hota ja raha hai.', 'The path... it keeps getting narrower.', { dur: 2.8 })
  await T('Mujhe nahi lagta road is taraf hogi. Par aur kya karein.', 'I don\'t think the road is this way. But what else can we do.', { dur: 3.4 })
  await goTrail(W, 78)
  // the two companions vanish, unseen
  await gate(() => lookedAway(m1.pos, 0.2) && lookedAway(m2.pos, 0.2), null, 40)
  crew.splice(1, 2); stopFollow(); followAlong(W, crew, 1.5)
  m1.setVisible(false); m2.setVisible(false)
  setTimeout(() => { try { G.removeActor(m1); G.removeActor(m2) } catch (e) {} }, 50)
  await wait(5.5)    // the delay: nothing is announced
  await T('Uncle, woh dono kahan gaye?', 'Uncle, where did those two go?', { dur: 2.4 })
  await U('Aage honge.', 'They will be ahead.', { pos: un.pos, dur: 1.8 })
  await N('Par abhi toh saath hi chal rahe the.', 'But they were walking with us just now.', { dur: 2.6 })
  await U('Chalte raho.', 'Keep walking.', { pos: un.pos, dur: 1.8 })
  // whispers return
  await goTrail(W, 96)
  audio.whisper(L.refs.bushPos, 6); L.shaky.shake()
  await wait(1.8)
  await T('Jhaadi ke peeche se... fusfusahat.', 'From behind the bush... a whisper.', { dur: 2.6 })
  await U('Aage dekho.', 'Look ahead.', { pos: un.pos, dur: 1.6 })
  await goTrail(W, 114)
  audio.dog({ x: P().pos.x + 60, y: 1, z: P().pos.z + 40 }, 3)
  await wait(3)
  await N('Kutta... bahut door.', 'A dog... very far.', { dur: 2.2 })
  await goTrail(W, 124)
  const sa = L.refs.snakeAt
  slither(L.snake, { x: sa.x - 1.6, z: sa.z }, { x: sa.x + 1.6, z: sa.z + 0.4 }, 3.2).catch(() => {})
  await wait(1.4)
  await N('Saanp! Ruk!', 'Snake! Stop!', { dur: 1.6 })
  await wait(2.2)
  await T('Chala gaya. Bas ek lakeer jaisa.', 'Gone. Just a dark streak.', { dur: 2.4 })
  await goTrail(W, 140)
  audio.puff(1); G.camShake(0.3)
  caption('[a cold gust slides past your neck]', 2.6)
  await wait(2.4)
  stepsAt(around(5, Math.PI, 0.5), 5, 0.6); stepsAt(around(7, 1.9, 0.5), 6, 0.5)
  await wait(3.6)
  await T('Kadam... do se zyada logon ke.', 'Footsteps... more than two people\'s.', { dur: 3 })
  await N('Torch band mat karna.', 'Don\'t switch off the torch.', { dur: 2.2 })
  await goTrail(W, 156)
  stopFollow()
  await endScene(1.4)
}

/* ------------------------------------------------------------------ CH 10 */
export async function ch10(s) {
  setTime(3.85, 0, false, true)
  const L = await load('escort', { scooter: true }, { dx: 1.2 })
  const c = G.comp, W = L.pathPts, p = P()
  G.hasSignal = false; G.torchOn = true
  const q = ptAt(W, 150); snapTo(q.x, q.z); G.scooter.place(q.x + 0.7, q.z + 1.4, q.yaw)
  const un = spawn('uncle', q.x - 0.3, q.z + 3.2, q.yaw); followAlong(W, [{ a: un, off: 3.0 }], 1.5)
  await startScene(1.6)
  ui.titleCard('CHAPTER 10', 'Parchhai', '3:58 AM', 3.4)
  G.clockRate = 3; fear(0.5); tired(1)
  ui.toast('Chalte raho', 3)
  await goTrail(W, 168)
  stopFollow(); un.path = []; un.face(L.refs.hide)
  pushOff(); compHold(c.pos.x, c.pos.z)
  await U('Ruko! Chhup jao. Us ped ke peeche - jaldi!', 'Stop! Hide. Behind that tree - quick!', { pos: un.pos, dur: 2.8 })
  ui.toast('Ped aur jhaadiyon ke peeche chhup jao', 5)
  c.mode = 'follow'
  un.walkTo(L.refs.hide.x + 0.9, L.refs.hide.z - 0.4, 2)
  await gate(() => G.distToPlayer(L.refs.hide.x, L.refs.hide.z) < 1.8, () => snapTo(L.refs.hide.x, L.refs.hide.z), 0, [L.refs.hide.x, L.refs.hide.z, 'Ped ke peeche chhup jao · Hide behind the tree'])
  G.noRun = true
  c.mode = 'hold'; c.holdPos = { x: L.refs.hide.x - 0.8, z: L.refs.hide.z + 0.3 }
  await U('Shhh.', 'Shhh.', { pos: un.pos, dur: 1.2 })
  G.camShake(0.15)
  await wait(3.2)
  // the shadow crosses the path: never seen clearly
  const a = sideAt(W, 186, -11), b = sideAt(W, 186, 11)
  const sh = G.addActor('shadow'); sh.sfx = false; sh.place(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z)); sh.walkTo(b.x, b.z, 1.2)
  audio.rustle({ x: a.x, y: 0.5, z: a.z }, 0.7)
  await wait(6)
  G.removeActor(sh)
  reveal('shadow')
  await wait(2.5)
  await N('...', '(nobody speaks. The rain is the only sound.)', { voice: false, dur: 3 })
  await T('Wo kya tha? Aadmi? Janwar?', 'What was that? A man? An animal?', { dur: 2.6 })
  un.look(G.camera.position)
  await wait(2.4)
  await N('Uncle?', 'Uncle?', { dur: 1.4 })
  await wait(3)
  await U('Chalo.', 'Let\'s go.', { pos: un.pos, dur: 1.6 })
  un.look(null)
  await wait(0.6)
  await endScene(1.5)
}

/* ------------------------------------------------------------------ CH 11 */
export async function ch11(s) {
  setTime(4.0, 0, true, true)
  const L = await load('shamshan', { env: 'deep', dog: 0 }, { dx: 1.2 })
  const c = G.comp, p = P()
  G.hasSignal = false; G.torchOn = true; G.mudSlow = 0
  G.scooter || G.addScooter(L, 0.4, -4.6, 0)
  G.startPush(); G.noRun = true
  const un = spawn('uncle', 0.9, -9.5, 0); followAlong(L.trails[0].pts, [{ a: un, off: 2.6 }], 1.4)
  await startScene(1.8)
  ui.titleCard('CHAPTER 11', 'Shamshan', '4:00 AM', 3.8)
  G.clockRate = 0; fear(0.35); tired(1)
  // from here on: the clock stays at 4:00
  await go(0, 24, 5)
  stopFollow(); pushOff()
  G.scooter.place(-3.0, 37, 0.5)
  await T('Ye toh... shamshan hai. Mukti Dham.', 'This is... a cremation ground. Mukti Dham.', { dur: 3 })
  await N('Kam se kam jaani-pehchaani jagah. Road paas hi hogi.', 'At least a known kind of place. The road must be near.', { dur: 3.4 })
  un.walkTo(L.refs.rest.x + 2.6, L.refs.rest.z + 0.3, 1.3)
  c.mode = 'hold'; c.holdPos = { x: L.refs.rest.x + 0.5, z: L.refs.rest.z - 1.5 }
  ui.toast('Ped ke neeche thodi der baith jao', 4.5)
  await gate(() => G.distToPlayer(L.refs.rest.x, L.refs.rest.z) < 4.5, () => snapTo(L.refs.rest.x + 0.6, L.refs.rest.z - 0.4), 0, [L.refs.rest.x, L.refs.rest.z, 'Ped ke neeche baith jao · Rest under the tree'])
  p.canMove = false; G.noRun = false
  un.face(p.pos)
  await wait(1.8)
  // the questions
  await T('Uncle, ek baat poochhein?', 'Uncle, may we ask something?', { dur: 2.2 })
  await U('Poochho.', 'Ask.', { pos: un.pos, dur: 1.4 })
  await N('Aap bura mat maniyega... par aap logon ka gaon bahut ajeeb hai.', 'Please don\'t mind... but your village is very strange.', { dur: 3.6 })
  await T('Wahan kisi ke paas phone nahi, bijli nahi, hospital nahi...', 'No phones, no electricity, no hospital there...', { dur: 3.4 })
  await N('Aur humne khidkiyon mein kuch safed aankhon jaisa bhi dekha.', 'And we saw something like white eyes in the windows.', { dur: 3.4 })
  await T('Sach sach bataiye uncle... aap bhoot toh nahi hain?', 'Tell us the truth, uncle... you are not a ghost, are you?', { dur: 3.4 })
  // the laugh: starts normal, goes on too long, stops abruptly
  await wait(1.2)
  await U('Tum logon ko shak ho gaya?', 'You two became suspicious?', { pos: un.pos, dur: 2.4, gap: 0.1 })
  audio.laugh(un.pos)
  await wait(3.6)
  audio.silence(true)
  await wait(1.6)
  audio.silence(false)
  un.face({ x: un.pos.x + 5, z: un.pos.z + 12 }); G.camShake(0.1)
  await wait(1.8)
  un.face(p.pos)
  await U('Un logon ko bhi pata chal gaya hai ki tum dono ne unhe dekh liya.', 'They too have found out that you two have seen them.', { pos: un.pos, dur: 4 })
  await U('Woh tum dono ke liye aa rahe hain. Chalo. Ab yahan rukne ka time nahi.', 'They are coming for you two. Go. There is no time to stay here now.', { pos: un.pos, dur: 4.4 })
  await N('Kaun? Kaun aa raha hai? Unko kaise pata chala?', 'Who? Who is coming? How would they know?', { dur: 3 })
  await wait(2.4)
  un.path = []; un.pose('point'); un.face(L.refs.dirPos)
  await U('Seedha ussi taraf jaao. Seedha.', 'Go straight that way. Straight on.', { pos: un.pos, dur: 3 })
  // both look where he points; when you look back, he's gone
  await G.turnTo(L.refs.dirPos, 1.1)
  await wait(2.4)
  await T('Kitni door, uncle?', 'How far, uncle?', { dur: 2 })
  await wait(1)
  G.removeActor(un)
  await G.turnTo(V(L.refs.rest.x + 2.6, 1.5, L.refs.rest.z + 0.3), 1.2)
  await wait(1.6)
  caption('[no footsteps. Nothing but rain on the stones]', 3)
  await N('...Uncle?', '...Uncle?', { dur: 2.2 })
  await T('Gayab. Koi aawaz nahi. Koi parchhai nahi.', 'Gone. No sound. No figure.', { dur: 3.2 })
  reveal('laugh', 'microsleep')
  fear(0.55)
  p.canMove = true
  await wait(2)
  // the two thoughts
  await N('Ye shamshan hai. Shayad yahi sabse safe jagah hai. Mujhe bhoot-vhoot pe yakeen nahi.', 'This is a cremation ground. Maybe it\'s the safest place. I don\'t believe in ghosts.', { dur: 4.8 })
  await T('Par ghar? Sab hamari raah dekh rahe honge. Aur network abhi bhi nahi hai.', 'But home? Everyone is waiting. And there is still no network.', { dur: 4.4 })
  caption('[the lantern still burns; the pale path leads to a gap in the trees; the peepal\'s stone platform is dry; something scrapes, very faintly, behind a distant wall]', 7)
  await wait(3)
  await T('Uncle ne wahi raasta dikhaya tha. Chalo.', 'The uncle showed us that way. Let us go.', { dur: 3 })
  await N('Yahin ruk jaate hain. Subah ka intezaar karte hain.', 'Let us stay here and wait for morning.', { dur: 3 })
  await T('Ya chhup ke dekhte hain. Kuch toh hoga.', 'Or we hide and watch. Something will happen.', { dur: 3 })
  const k = await choose('Faisla (dono ka)', ['Uncle ka bataya raasta (Ending 1)', 'Peepal ke neeche ruko, jo aaye uske paas jao (Ending 2)', 'Ruko, chhup ke dekho (Ending 3)'])
  s.branch = k === 0 ? 'A' : 'B'; s.pref = k
  await wait(0.4)
  if (k === 0) { await N('Chal. Jo bhi ho, rukna theek nahi.', 'Let\'s go. Whatever happens, waiting isn\'t right.', { dur: 3 }); await T('Scooter uthaate hain.', 'Let\'s take the scooter.', { dur: 2 }) }
  else { await N('Hum yahin rukte hain. Pehchaani jagah hai, subah ka intezaar karte hain.', 'We stay here. It\'s a known place. We wait for morning.', { dur: 3.8 }); await T('Theek hai. Par sote nahi.', 'Okay. But we don\'t sleep.', { dur: 2.4 }) }
  await endScene(1.8)
}

/* ------------------------------------------------------------------ ENDING A */
export async function ch12a(s) {
  setTime(4.1, 0, true, true)
  const L = await load('exit', { scooter: true }, { dx: 1.2 })
  const c = G.comp, W = L.pathPts, len = trailLen(W), sc = G.scooter
  G.hasSignal = false; G.torchOn = true
  await startScene(1.8)
  ui.titleCard('ENDING A', 'Antim raasta', '', 3)
  G.clockRate = 0; fear(0.5); tired(1)
  const gap = (a = 2, b = 3) => wait(a + Math.random() * (b - a))
  await N('Uncle ne jis taraf kaha tha, usi taraf.', 'The direction the uncle pointed. Only that.', { dur: 3 })
  await T('Pata nahi sahi hai ya nahi.', 'No idea if it\'s right.', { dur: 2.2 })
  // 1 whisper behind bushes
  await goTrail(W, 34)
  audio.whisper(L.bushes[0].userData.pos, 6); L.bushes[0].shake(); await wait(2.6)
  await T('Suna?', 'Heard that?', { dur: 1.4 })
  // 2 bush moves while torch is elsewhere
  await goTrail(W, 62)
  await gate(() => lookedAway(L.bushes[1].userData.pos, 0.2), null, 10)
  L.bushes[1].shake(); audio.rustle(L.bushes[1].userData.pos, 1); await gap()
  // 3 dog
  await goTrail(W, 86)
  audio.dog({ x: P().pos.x - 70, y: 1, z: P().pos.z + 30 }, 3); await wait(3.4)
  // 4 snake
  await goTrail(W, 104)
  const q = ptAt(W, 110)
  slither(L.snake, { x: q.x - 1.8, z: q.z }, { x: q.x + 1.8, z: q.z - 0.3 }, 3.4).catch(() => {})
  await wait(1.2); await N('Saanp!', 'Snake!', { dur: 1.2 }); await wait(2.6)
  // 5 cold gust
  await goTrail(W, 118)
  audio.puff(-1); G.camShake(0.25); caption('[a cold gust brushes past an ear]', 2.4); await gap()
  // 7 tree silhouette
  await goTrail(W, 124)
  await lookFor(L.refs.bent, 0.9, 0.94)
  await T('Wahan koi khada hai...', 'Someone is standing there...', { dur: 2.2 })
  await wait(2)
  await go(L.refs.bent.x + 3, L.refs.bent.z - 4, 5)
  await N('Ped. Bas ped.', 'A tree. Only a tree.', { dur: 1.8 })
  // 6 footsteps follow then stop
  await goTrail(W, 148)
  stepsAt(around(6, Math.PI, 0.5), 6, 0.56)
  await wait(4)
  // 8 branch cracks behind
  audio.crack(around(8, Math.PI, 0.7), 1); G.camShake(0.2); await wait(2.4)
  // 9 something like our names
  await goTrail(W, 188)
  const pn = around(18, 2.6, 1)
  await say('Awaaz', 'Nishaan...', '(something like your name, from the dark)', { pos: pn, voice: false, dur: 2.4 })
  audio.whisper(pn, 5)
  await T('Mera naam bhi... kisi ne liya?', 'Did it say my name too?', { dur: 2.4 })
  // 10-12 stumble, scratches, torn clothes; the tyre
  await goTrail(W, 218)
  audio.fall(P().pos); G.camShake(0.7); ui.flash(0.35)
  await ui.fade(1, 0.25); await wait(0.5); await ui.fade(0, 0.6)
  sc.setPunctured(true)
  await N('Aah! Pair phisla... Kaanta!', 'Ah! My foot slipped... thorns!', { dur: 2.6 })
  await T('Scooter ka tyre... puncture ho gaya.', 'The scooter\'s tyre... it\'s punctured.', { dur: 2.8 })
  caption('[scratches on your arms, mud to the knees]', 3)
  await wait(1.5)
  await N('Kapde phat gaye, haath chheel gaye. Chalte raho. Road paas hi hai.', 'Clothes torn, hands scraped. Keep going. The road must be close.', { dur: 4 })
  await goTrail(W, len - 3)
  // the road
  await go(0, 345, 4)
  pushOff(); L.setDawn(); sc.place(-5.5, 343, 1.2)
  await wait(1.5)
  G.hasSignal = true; audio.signalUp(); audio.phoneRing()
  ui.toast('📶 Network aa gaya!', 3)
  await N('Network aa gaya! Ghar pe call laga.', 'Network is back! Call home.', { dur: 2.6 })
  await T('Mummy ko bol, hum safe hain. Bas aa rahe hain.', 'Tell Mom we\'re safe. We\'re just coming.', { dur: 3 })
  await wait(1)
  audio.phoneRing(); await wait(1.2)
  await say('Ghar waala', 'Tum dono kahan the? Pata hai kitni chinta ho rahi thi?', 'Where were you two? Do you know how worried we were?', { voice: true, dur: 4 })
  await N('Ghar aake sab batate hain.', 'We\'ll tell everything when we get home.', { dur: 2.8 })
  await T('Scooter ko yahin kinare laga dete hain. Kal aake le jaayenge.', 'Let\'s leave the scooter by the roadside. We\'ll fetch it tomorrow.', { dur: 3.6 })
  reveal('lost')
  audio.passBy({ x: -60, y: 1, z: 346 }, { x: 70, y: 1, z: 346 }, 5, 'truck')
  await wait(3)
  await endScene(2.4)
}

export async function ch13a(s) {
  setTime(6.4, 0, false, true)
  const L = await load('home', { night: true }, { dx: 1.4, dz: 1.2 })
  const H = L.house, c = G.comp, p = P()
  G.env.set('predawn'); G.hasSignal = true; G.torchOn = false; fear(0); tired(0.8)
  c.place(...H.local(1.8, 0, 1.0).toArray().filter((v, i) => i !== 1), 0); c.mode = 'hold'; c.holdPos = null
  const mom = G.addActor('mother'); mom.sfx = false; { const m = H.local(-1.4, 0, -0.8); mom.place(m.x, m.z, 0.3) }
  const dad = G.addActor('chacha'); dad.sfx = false; { const m = H.local(2.4, 0, -1.4); dad.place(m.x, m.z, Math.PI) } dad.pose('sit')
  G.clockRate = 0
  await startScene(2)
  ui.titleCard('ENDING A', 'Ghar', '', 3)
  G.player.pos.set(L.spawn.x, 0, L.spawn.z)
  await wait(0.8)
  await say('Mummy', 'Beta! Dono ko dekho... ye kya haal bana rakha hai!', 'Look at you both! What state are you in!', { pos: mom.pos, dur: 3.4 })
  await N('Mummy... ghar aa gaye.', 'Mom... we\'re home.', { dur: 2.4 })
  await ui.fade(1, 1.2)
  ui.toast('Nahaye, kapde badle, pattee karwayi, aur bhookh se bhara khaana khaaya.', 5)
  await wait(3.4)
  c.place(...H.local(-2.1, 0, 1.6).toArray().filter((v, i) => i !== 1), 0.6); c.pose('sit')
  p.pos.set(...H.local(-2.1, 0, -0.2).toArray()); p.pos.y = 0
  p.yaw = Math.atan2(-2.9 + 2.1, 0.4 + 0.2) // look at the table
  mom.place(...H.local(-1.0, 0, -1.2).toArray().filter((v, i) => i !== 1), 0)
  await ui.fade(0, 1.4)
  p.canMove = false
  await say('Mummy', 'Ab bolo, hua kya tha?', 'Now tell me, what happened?', { pos: mom.pos, dur: 2.6 })
  await N('Hum jungle mein chale gaye the. Raasta bhool gaye. Raaste baar-baar wahin aa rahe the.', 'We went into the forest. Got lost. The paths kept repeating.', { dur: 4.8 })
  await T('Phir ek gaon mila. Ek uncle ne darwaza khola. Unki beti thi, patni guzar chuki thi.', 'Then we found a village. An uncle opened his door. He had a daughter; his wife had died.', { dur: 5.4 })
  await N('Unhone laal sharbat jaisa kuch pilaya. Rukne ko bole. Hum nahi ruke.', 'He gave us something red like sharbat. He told us to stay. We didn\'t.', { dur: 5 })
  await T('Unke do dost saath chale, phir gayab ho gaye. Shamshan mein uncle bhi gayab. Bole, "Woh log aa rahe hain."', 'His two friends came along, then vanished. At the cremation ground he vanished too. He said "They are coming."', { dur: 6 })
  await wait(1.2)
  ui.toast('E — tiffin dekho', 3.6)
  await use(L.refs.tiffinPos, 'Mez par rakha tiffin', { r: 4, cone: -1 })
  await say('Mummy', 'Tumhara tiffin toh ghar pe hi pada tha.', 'Your tiffin was left right here at home.', { pos: mom.pos, dur: 3.4 })
  await N('Kya? Hum toh...', 'What? We...', { dur: 2 })
  await say('Chacha', 'Us taraf koi gaon nahi hai. Jis jagah ka tum log bata rahe ho, wahan toh shamshan ghat hai.', 'There is no village that way. The place you describe is just a cremation ground.', { pos: dad.pos, dur: 5 })
  await T('Lekin hum ek ghar mein gaye the. Ek uncle the...', 'But we went into a house. There was an uncle...', { dur: 3 })
  await say('Chacha', 'Wahan koi ghar nahi hai.', 'There is no house there.', { pos: dad.pos, dur: 2.2 })
  G.fearT = 0
  await wait(4.5)   // let the room become quiet
  caption('[the fan hums. Nobody speaks.]', 4)
  await wait(4)
  await N('Ek baat... us uncle ne humein jo pilaya tha, woh kya tha?', 'One thing... what was it that uncle gave us to drink?', { dur: 3.6 })
  await T('Sharbat jaisa kuch tha.', 'Something like sharbat.', { dur: 2.2 })
  await N('Taste yaad hai?', 'Do you remember the taste?', { dur: 2 })
  await T('Nahi. Kuch bhi clear yaad nahi.', 'No. I can\'t clearly remember anything.', { dur: 2.8 })
  reveal('village', 'drink')
  await wait(5)
  await endScene(3)
  s.onEnd('ENDING A — Ghar wapsi', 'Aap ghar pahunch gaye. Par ek sawaal abhi bhi baaki hai: humne piya kya tha?')
}

/* ------------------------------------------------------------------ ENDING B */
export async function ch12b(s) {
  setTime(4.0, 0, true, true)
  const L = await load('shamshan', { env: 'deep', dog: 0 }, { dx: 1.2 })
  const c = G.comp, p = P()
  G.hasSignal = false; G.torchOn = true
  const R = L.refs
  p.pos.set(R.rest.x + 0.2, 0, R.rest.z - 0.3); p.yaw = -0.4; p.canMove = false
  c.place(R.rest.x + 0.6, R.rest.z + 1.2, -0.6); c.pose('sit'); c.mode = 'hold'; c.holdPos = null
  G.scooter || G.addScooter(L, R.rest.x + 2, R.rest.z - 2.6, 0.9); G.stopPush && G.stopPush()
  // dim light near the samadhi being struck (so it is visible at distance)
  const wl = new THREE.PointLight('#ffa860', 7, 16, 1.6); wl.position.set(29, 2.4, 59); L.group.add(wl)
  const pick = makePickaxe()
  const fig = G.addActor('shadow'); fig.sfx = false; fig.place(29.2, 60.2, Math.PI); fig.pose('strike'); fig.P.hold(pick, 1, [0.0, -0.1, 0.0])
  fig.setVisible(false)
  await startScene(1.8)
  ui.titleCard('ENDING B', 'Shamshan ki raat', '4:00 AM', 3.4)
  fear(0.3); tired(1)
  await T('Sote nahi, theek hai? Mujhe is jagah mein neend nahi chahiye.', 'We don\'t sleep, okay? I don\'t want to sleep in this place.', { dur: 3.6 })
  await N('Haan. Baat karte rehte hain.', 'Yes. Keep talking.', { dur: 2.2 })
  await wait(3)
  await T('Mera sar bhaari ho raha hai...', 'My head is getting heavy...', { dur: 2.6 })
  await wait(2)
  await G.blink(1.2); await wait(1.2); ui.fade(0, 0.8, true); await wait(1)
  await N('Aankhein khuli rakh...', 'Keep your eyes open...', { dur: 2.2 })
  await wait(2)
  await G.blink(1.6); await wait(1.6)
  reveal('microsleep')
  // first friend wakes: companion is gone
  c.setVisible(false); c.place(R.rest.x - 3, R.rest.z + 9, 0)
  fear(0.45)
  await ui.fade(0, 1, true)
  p.canMove = true
  fig.setVisible(true)
  const sw = loop(() => { audio.strike({ x: 29.2, y: 0.5, z: 60.6 }, 0.9) }, () => 1.05 + Math.random() * 0.25)
  await wait(1.2)
  await N('Nishant? ...Nishant?', 'Nishant? ...Nishant?', { dur: 2 })
  caption('[something is being struck, over and over, far off]', 3.6)
  await wait(1.6)
  await N('Scooter yahin hai. Matlab paidal gaya hai. Par kahan?', 'The scooter is here. So he went on foot. But where?', { dur: 3.6 })
  ui.toast('Aawaz ki taraf dekho', 4)
  await lookFor(R.target, 1.2, 0.96)
  await N('Koi... samadhi tod raha hai. Mitti nikaal raha hai.', 'Someone... is breaking a samadhi. Digging out the soil.', { dur: 3.6 })
  await wait(8)
  await N('Itni der se ek hi jagah... Nahi, paas jaana theek nahi.', 'All this time on one spot... No, going closer isn\'t right.', { dur: 3.6 })
  ui.toast('Ped ke paas wapas laut aao', 4)
  await gate(() => G.distToPlayer(R.rest.x, R.rest.z) < 2.6, () => snapTo(R.rest.x + 0.2, R.rest.z - 0.3), 0, [R.rest.x, R.rest.z, 'Ped ke paas wapas aao · Come back to the tree'])
  await N('(dheere) Nishant... jaldi aa...', '(under his breath) Nishant... come back soon...', { dur: 2.8 })
  await wait(8)
  // a hand on the shoulder from behind
  p.canMove = false
  c.setVisible(true); c.pose('stand'); c.place(p.pos.x - 0.9, p.pos.z - 0.7, 0.8)
  audio.thud(null, 0.4); G.camShake(0.5); ui.flash(0.4)
  await wait(0.4)
  G.lookLimit = { c: Math.atan2(R.target.x - p.pos.x, R.target.z - p.pos.z), w: 0.9 }
  await T('Chup. Awaaz mat kar.', 'Quiet. Don\'t make a sound.', { dur: 2 })
  await N('Tu kahan chala gaya tha?', 'Where did you go?', { dur: 2 })
  await T('Chup. Awaaz mat kar.', 'Shh. Not a sound.', { dur: 1.8 })
  await N('Woh kaun hai?', 'Who is that?', { dur: 1.6 })
  await T('Pata nahi. Bahut der se ek hi jagah maar raha hai.', 'No idea. He\'s been hitting one spot for ages.', { dur: 3 })
  await N('Samadhi toot kyun nahi rahi?', 'Why isn\'t the samadhi breaking?', { dur: 2.2 })
  await T('Aur usko thakaan bhi nahi ho rahi.', 'And he isn\'t getting tired.', { dur: 2.4 })
  await N('Kya hum phir kisi loop mein phans gaye?', 'Have we got stuck in another loop?', { dur: 2.6 })
  await T('Par ye shamshan hai. Yahan toh aisa nahi hona chahiye...', 'But this is a cremation ground. This shouldn\'t happen here...', { dur: 3.2 })
  // the branch point from story.txt: approach the man (Ending 2 / C) or stay hidden and watch (Ending 3 / B)
  const kk = s.pref === 1 ? 0 : 1
  if (kk === 0) {
    s.branch = 'C'
    await N('Chal, usse poochhte hain. Shayad usse raasta pata ho.', 'Come on, let\'s ask him. Maybe he knows the way.', { dur: 3.2 })
    await T('Yaar mat ja... mujhe theek nahi lag raha.', 'Don\'t, man... this doesn\'t feel right.', { dur: 2.8 })
    ui.toast('Aadmi ki taraf chalo · Walk towards the man', 5)
    const tg = R.target
    await gate(() => G.distToPlayer(tg.x, tg.z) < 11, () => snapTo(tg.x - 8, tg.z - 8), 0, [tg.x - 4, tg.z - 4, 'Aadmi ke paas jao · Walk to the man'])
    sw.on = false; audio.silence(true)
    await wait(0.8); audio.silence(false)
    fig.pose('stand'); fig.face(p.pos)
    await N('Bhaiya...? Suniye...', 'Brother...? Excuse me...', { dur: 2.2 })
    await wait(1.4)
    caption('[the digging has stopped]', 2.6)
    fear(0.9); audio.heartbeat(1)
    await wait(1.6)
    // he starts to turn... then runs. No face is ever clearly seen.
    fig.look(p.pos)
    await wait(1.0)
    await T('Bhaag!!', 'RUN!!', { dur: 1.2 })
    G.noRun = false; p.canMove = true; ui.fear(1)
    c.mode = 'hold'; c.holdPos = null
    c.walkTo(R.rest.x - 10, R.rest.z - 14, 4.2)
    ui.toast('Daudo! Shift + W · Run! Hold Shift + W', 5)
    let t = 0
    const step = loop(() => { audio.footstep('ash', 1.2, { x: fig.pos.x, y: 0.1, z: fig.pos.z }); G.camShake(0.25) }, 0.28)
    await G.until(() => {
      t += G.lastDt
      const dx = p.pos.x - fig.pos.x, dz = p.pos.z - fig.pos.z, d = Math.hypot(dx, dz)
      fig.path = [{ x: p.pos.x, z: p.pos.z }]; fig.walkSpeed = t < 7 ? 3.4 : 4.6
      if (t > 3.5) p.roll = Math.sin(t * 9) * 0.05
      return t > 9 || d < 1.6
    })
    // trip on a root, fall into the excavation
    step.on = false; p.roll = 0; p.canMove = false; fig.path = []
    audio.fall(p.pos); G.camShake(0.9); ui.flash(0.6)
    caption('[a heavy fall. Mud. Then nothing.]', 3)
    p.headDip = 1
    await wait(1.2)
    audio.silence(true)
    G.removeActor(fig); wl.visible = false
    await wait(1.4)
    audio.silence(false)
    p.headDip = 0
    return
  }
  // the voice behind
  const behind = { x: p.pos.x - Math.sin(p.yaw) * 3, y: 1.5, z: p.pos.z - Math.cos(p.yaw) * 3 }
  await say('Awaaz', 'Yahan kya kar rahe ho?', 'What are you doing here?', { pos: behind, id: 'awaaz_1', dur: 2.6 })
  await T('(fusfusakar) Peeche mat dekh.', '(whispering) Don\'t look back.', { dur: 2.2 })
  await N('(fusfusakar) Agar mudein toh wo nazar se hat jaayega.', '(whispering) If we turn, we might lose sight of him.', { dur: 2.8 })
  await wait(3)
  await say('Awaaz', 'Nishaan... Nishaant...', 'Nishan... Nishant...', { pos: behind, id: 'awaaz_2', dur: 2.8 })
  await T('Isne humare naam liye...', 'It said our names...', { dur: 2.2 })
  await N('Yahan kisi ko hamare naam nahi pata.', 'Nobody here knows our names.', { dur: 2.8 })
  await wait(3)
  // distant scream; when we look back, the figure is gone
  const sp = { x: 70, y: 1.5, z: 20 }
  audio.scream(sp)
  G.lookLimit = null
  await G.turnTo(V(sp.x, 1.5, sp.z), 0.7)
  await wait(1.6)
  await G.turnTo(R.target, 0.8)
  sw.on = false; fig.setVisible(false); G.removeActor(fig); wl.visible = false
  await wait(1.6)
  await N('Gayab...', 'Gone...', { dur: 1.8 })
  fear(0.7)
  await wait(2.2)
  await say('Awaaz', 'Bhai... rasta kho gaya hoon. Tum dono ko rasta pata hai kya?', 'Brother... I\'ve lost my way. Do you two know the way?', { pos: behind, id: 'awaaz_3', dur: 4.2 })
  await T('(fusfusakar) Mat mudna.', '(whispering) Don\'t turn.', { dur: 1.8 })
  await wait(2.4)
  await say('Awaaz', 'Bhai, sun rahe ho? Main rasta kho gaya hoon. Help kar do. Poochna hai toh muro.', 'Brother, are you listening? I\'ve lost my way. Help me. If you want to ask, turn around.', { pos: behind, voice: false, dur: 5 })
  await N('Insaan jaisa lag raha hai... par...', 'He sounds like a person... but...', { dur: 2.6 })
  await wait(1.6)
  // the hands
  audio.thud(null, 0.5); G.camShake(0.3)
  caption('[a rough hand settles on each shoulder]', 3)
  await wait(2.2)
  await T('Haath... asli lag rahe hain.', 'Hands... they feel real.', { dur: 2.2 })
  await N('Toh insaan hi hoga. Mudte hain.', 'Then it must be a person. Let\'s turn.', { dur: 2.4 })
  // the tall figure
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw)
  const tall = G.addActor('tall'); tall.sfx = false; tall.place(p.pos.x - fx * 1.15, p.pos.z - fz * 1.15, p.yaw)
  tall.P.hold(makePickaxe(), 1, [0.05, -0.2, 0.05]); tall.pose('stand')
  G.torchOn = true
  await G.turnTo(V(tall.pos.x, 2.1, tall.pos.z), 0.9)
  reveal('tall', 'samadhi')
  G.camShake(0.35)
  ui.fear(1)
  audio.heartbeat(1)
  await wait(3.4)
  // they faint: no chase, no attack
  await ui.fade(1, 1.8, true)
  audio.silence(true)
  G.removeActor(tall)
  await wait(2)
  audio.silence(false)
}

export async function ch13b(s) {
  setTime(5.3, 0, false, true)
  const L = await load('shamshan', { env: 'predawn', dog: 0 }, { dx: 1.2 })
  const c = G.comp, p = P(), R = L.refs
  G.hasSignal = false; G.torchOn = false; fear(0.2); tired(1)
  p.pos.set(R.rest.x + 0.2, 0, R.rest.z - 0.3); p.yaw = Math.PI * 0.5; p.canMove = false
  c.place(R.rest.x + 0.6, R.rest.z + 1.4, -0.6); c.pose('sit'); c.mode = 'hold'; c.holdPos = null
  const st = spawn('stranger', R.rest.x + 2.0, R.rest.z - 0.2, Math.PI / 2 + 0.3); st.face(p.pos)
  const lota = makeSteelGlass(); st.P.hold(lota, 1)
  G.clockRate = 20
  await startScene(2.4)
  ui.titleCard('ENDING B', 'Ajnabi', '5:20 AM', 3.2)
  audio.thud(null, 0.2)
  await say('Ajnabi', 'Utho bhai... utho. Paani chhidak raha hoon. Aankhein kholo.', 'Get up, brother... wake up. I\'m sprinkling water. Open your eyes.', { pos: st.pos, dur: 4 })
  await wait(0.6)
  await N('...kaun?', '...who?', { dur: 1.6 })
  await say('Ajnabi', 'Pehle ye batao - kahan se aaye ho? Shamshan mein raat ko kya kar rahe the?', 'First tell me - where have you come from? What were you doing in the cremation ground at night?', { pos: st.pos, dur: 4.4 })
  await T('Hum jungle mein bhatak gaye the... raat bhar.', 'We got lost in the forest... all night.', { dur: 3 })
  await say('Ajnabi', 'Kisi samadhi ko haath toh nahi lagaya? Chot toh nahi lagi? Khade ho sakte ho?', 'You didn\'t touch any samadhi? Are you hurt? Can you stand?', { pos: st.pos, dur: 4.4 })
  p.canMove = true
  await N('Nahi. Haan, uth sakte hain. Bas chheel gaya hai. Mere dost ko bukhaar lag raha hai.', 'No. Yes, we can stand. Just scrapes. My friend feels feverish.', { dur: 4.6 })
  c.pose('stand'); st.look(c)
  await wait(1.4)
  await say('Ajnabi', 'Haan, tap hai thoda. Cheelein bhi hain. Ab batao, poori raat ki baat, ek-ek karke.', 'Yes, a little fever. Scratches too. Now tell me the whole night, one thing at a time.', { pos: st.pos, dur: 5 })
  await wait(0.6)
  await N('(aap dono ne poori raat ki kahani sunayi...)', '(You both tell him everything, piece by piece...)', { voice: false, dur: 3.4 })
  // short, grounded explanations: player picks the questions
  const topics = [
    ['Aawazein: payal, fusfusahat, qadam, mummy-papa ki awaaz?', 'Baans mein hawa aawaz jaisi lagti hai. Patte-daaliyan ragadne se qadam jaisi aawaz. Baarish se disha aur doori ka andaaza bigad jaata hai. Door se suni jaani-pehchaani aawaz hum galat pehchaan lete hain. Payal jaisi aawaz chhoti cheezon, daaliyon ya girte patton se bhi aa sakti hai.', 'Wind in bamboo can sound like a voice. Leaves and branches rubbing sound like footsteps. Rain distorts direction and distance. A familiar voice from far away is easily misjudged. A payal-like jingle can come from small objects, branches or falling bits.'],
    ['Wo lamba aadmi aur safed aankhein?', 'Tedha ped, daaliyon ke beech koi insaan, haath mein aujaar jaisi shape, aur torch ki position - sab mil kar aisi tasveer bana sakte hain. Kam roshni mein khidki ki darar ya chamakte patte bhi safed aankhon jaise lagte hain. Main saabit nahi kar sakta.', 'A bent tree, a person seen through branches, a tool-like shape and the torch angle can add up to that image. In low light, pale gaps or shiny leaves look like white eyes. I can\'t prove it.'],
    ['Wo gaon aur uncle?', 'Jahan tum bata rahe ho, wahan koi gaon nahi hai. Thake, bheege, dare hue aur panaah dhoondhte logon ko aisa sapne jaisa anubhav ho sakta hai. Main us uncle ko nahi jaanta. Aur tumne kya piya tha, ye bhi main nahi jaanta.', 'There is no village where you describe one. Exhausted, cold, frightened people who badly need shelter can have a dream-like experience. I don\'t know that uncle. And I don\'t know what you drank.'],
    ['Samadhi tod raha aadmi?', 'Ho sakta hai koi tooti daali, dhila saaman, door koi kaam karta insaan, ya thaki aankhon ka dhokha. Main wahan nahi tha, isliye pakka nahi keh sakta.', 'Perhaps a broken branch, a loose object, someone working at a distance, or tired eyes. I wasn\'t there, so I can\'t say.'],
    ['Uncle ne jo disha batayi thi?', 'Agar tum us taraf chalte, toh ho sakta hai jungle mein aur andar chale jaate, road se door. Pakka nahi keh sakta. Itna zaroor kahunga - bhatakte rehne se bach gaye, ye tumhari kismat hai.', 'If you had gone that way you might have moved deeper in, away from the road. I can\'t be sure. But you were lucky not to keep wandering blindly.'],
    ['Itna sab ek saath kyun lag raha tha?', 'Raat, baarish, thakaan, bhookh aur dar milkar cheezon ko waisa dikhate hain jaisa wo hoti nahi. Dimaag alag-alag baaton ko jod kar ek daravni kahani bana leta hai. Aur ek jaise dikhte raaste mein log ghoom-ghoom kar wahin aa jaate hain.', 'Night, rain, exhaustion, hunger and fear make things look unlike what they are. The mind joins separate events into one frightening story. And people walking among similar paths do come back to the same place.']
  ]
  const asked = new Set()
  for (;;) {
    const opts = []; const idx = []
    topics.forEach((t, i) => { if (!asked.has(i)) { opts.push(t[0]); idx.push(i) } })
    opts.push('Bas, ab chalein')
    const need = Math.max(0, 4 - asked.size)
    const k = await choose('Ajnabi se kya poochhein?', opts, need > 0 ? 0 : opts.length - 1)
    if (k === opts.length - 1) break
    const t = topics[idx[k]]; asked.add(idx[k])
    await N(t[0], t[0].replace(/\?$/, '?'), { dur: 2.4, voice: false })
    await say('Ajnabi', t[1], t[2], { pos: st.pos, dur: 8.5 })
    if (asked.size === topics.length) break
  }
  await say('Ajnabi', 'Raat, baarish, thakaan aur andhera milkar cheezon ko waise dikhate hain jaise woh hoti nahi hain. Tum dono bahut der se bhatak rahe the.', 'Night, rain, tiredness and darkness together show you things as they are not. You two were wandering a long time.', { pos: st.pos, dur: 6 })
  reveal('village', 'eyes', 'samadhi', 'tall', 'laugh', 'again', 'light', 'microsleep')
  await say('Ajnabi', 'Chal sakte ho? Wo kachchi sadak seedhi road tak jaati hai. Subah ho rahi hai. Ghar waalon ko phone kar dena.', 'Can you walk? That dirt track leads straight to the road. It\'s getting light. Call your families.', { pos: st.pos, dur: 5.4 })
  st.look(null)
  await N('Shukriya bhaiya.', 'Thank you, brother.', { dur: 2 })
  await endScene(1.8)
}

export async function ch14b(s) {
  setTime(6.0, 0, false, true)
  const L = await load('tea', {}, { dx: 1.2 })
  const c = G.comp, p = P(), R = L.refs
  G.hasSignal = false; G.torchOn = false; fear(0); tired(0.9)
  G.clockRate = 15
  await startScene(2)
  ui.titleCard('ENDING B', 'Chai', '6:00 AM', 3)
  ui.toast('Road par seedha chalte raho', 4)
  await go(0, 40, 4)
  G.hasSignal = true; audio.signalUp(); audio.phoneRing(); ui.toast('📶 Network aa gaya', 3)
  await T('Network aa gaya! Ghar pe phone kar.', 'Network is back! Call home.', { dur: 2.4 })
  await wait(1)
  await N('Mummy, hum theek hain. Bas aa rahe hain. Aake sab batayenge.', 'Mom, we\'re fine. We\'re on our way. We\'ll explain everything when we arrive.', { dur: 4.2 })
  await say('Mummy', 'Kahan the tum log?! Seedhe ghar aao!', 'Where were you?! Come straight home!', { voice: true, dur: 3 })
  reveal('lost')
  await go(3.2, 176.6, 5)
  const cw = spawn('chaiwala', 5.9, 180.2, -Math.PI / 2); cw.pose('stand')
  await wait(1)
  await say('Chaiwala', 'Aao bhaiya, baitho. Do chai?', 'Come, sit, brothers. Two teas?', { pos: cw.pos, dur: 2.8 })
  await N('Haan, do chai.', 'Yes, two teas.', { dur: 1.6 })
  p.canMove = false; p.pos.set(R.sit1.x, 0, R.sit1.z); p.yaw = Math.PI / 2
  c.place(R.sit2.x, R.sit2.z, Math.PI / 2); c.pose('sit'); c.mode = 'hold'; c.holdPos = null
  await wait(3)
  caption('[the tea boils. A tractor passes in the distance.]', 3)
  await wait(3)
  await N('...', '(for a while you both sit quietly)', { voice: false, dur: 3 })
  await N('Ek baat bata...', 'Tell me something...', { dur: 2 })
  await T('Kya?', 'What?', { dur: 1.2 })
  await N('Us uncle ne humein kuch pilaya tha na?', 'That uncle gave us something to drink, didn\'t he?', { dur: 3 })
  await T('Haan... laal sa tha. Sharbat jaisa.', 'Yes... it was reddish. Like sharbat.', { dur: 3 })
  await N('Humne us aadmi ko ye bataya tha?', 'Did we tell that man (the stranger) this?', { dur: 2.8 })
  await T('Nahi.', 'No.', { dur: 1.4 })
  await N('Aur us stranger ne bhi toh nahi poocha ki humne kuch piya tha.', 'And that stranger never asked whether we\'d had anything to drink.', { dur: 4 })
  await T('Toh... humne piya kya tha?', 'So... what did we drink?', { dur: 3 })
  reveal('drink')
  await wait(3.4)
  // the ordinary sound interrupts
  const g1 = makeGlass(true, '#b4742c'), g2 = makeGlass(true, '#b4742c')
  g1.position.set(R.tableTop.x - 0.1, R.tableTop.y + 0.06, R.tableTop.z); g2.position.set(R.tableTop.x + 0.15, R.tableTop.y + 0.06, R.tableTop.z + 0.02)
  L.group.add(g1, g2); audio.teaGlass()
  await say('Chaiwala', 'Lo bhaiya, garam chai.', 'Here, brothers, hot tea.', { pos: cw.pos, dur: 2.6, gap: 0 })
  await wait(2.4)
  await endScene(2.8)
  s.onEnd('ENDING B — Chai ke saath ek sawaal', 'Zyadatar baaton ke saaf jawaab mil gaye. Par us laal sharbat ka koi jawaab nahi mila.')
}

/* ------------------------------------------------------------------ ENDING C (approach the man: the pit, the hospital) */
export async function ch13c(s) {
  setTime(8.0, 0, false, true)
  const L = await load('hospital', {}, { dx: 1.2 })
  const c = G.comp, p = P(), R = L.refs
  G.hasSignal = false; G.torchOn = false; fear(0); tired(0.8)
  p.pos.set(R.bed1.x, 0, R.bed1.z); p.yaw = 0; p.canMove = false; p.headDip = 0.9
  c.place(R.bed2.x, R.bed2.z, 0); c.pose('sit'); c.mode = 'hold'; c.holdPos = null
  const nurse = spawn('neighbor', R.inside.x - 0.8, R.inside.z, -0.4)
  G.clockRate = 4
  await startScene(1.6)
  ui.titleCard('ENDING C', 'Aspatal', 'Subah · Morning', 3)
  await wait(1.2)
  caption('[a ceiling fan. Distant voices. A trolley rolling down a corridor.]', 3.4)
  await wait(2.4)
  await N('...chhat. Safed chhat.', '...a ceiling. A white ceiling.', { dur: 2.4 })
  await say('Attendant', 'Hosh aa gaya. Hilo mat, drip lagi hai.', 'He\'s awake. Don\'t move, there\'s a drip in.', { pos: nurse.pos, dur: 3 })
  await N('Nishant? Nishant kahan hai?', 'Nishant? Where is Nishant?', { dur: 2.4 })
  await say('Attendant', 'Bagal wale bistar par. Zinda hai, ghabrao mat.', 'In the next bed. He\'s alive, don\'t panic.', { pos: nurse.pos, dur: 3 })
  p.canMove = true; p.headDip = 0.35
  nurse.walkTo(R.inside.x - 0.4, R.inside.z + 1.2, 1.3)
  await T('Bhai... tu theek hai?', 'Man... are you okay?', { dur: 2.2 })
  await N('Haan. Hum... kahan the?', 'Yes. Where... were we?', { dur: 2.2 })
  await say('Attendant', 'Subah gaon waalon ne tum dono ko khudai ke gadde mein paaya. Scooter bagal mein padi thi. Chot aur sadma, bas.', 'Villagers found you both this morning in the excavation pit. The scooter was beside you. Injuries and shock, that\'s all.', { pos: nurse.pos, dur: 6 })
  await N('Ek aadmi tha... wo bhaaga humare peeche...', 'There was a man... he ran after us...', { dur: 3 })
  await T('Mujhe sirf daudna yaad hai. Koi chehra nahi.', 'I only remember running. No face.', { dur: 3 })
  await say('Attendant', 'Raat mein ghaaon ke paas koi nahi jaata. Shayad gir gaye ho, ghabra gaye ho. Doctor sahab aayenge.', 'Nobody goes near that ground at night. Maybe you fell, got scared. The doctor will come.', { pos: nurse.pos, dur: 5 })
  reveal('samadhi', 'microsleep')
  nurse.walkTo(R.door.x, R.door.z + 3, 1.4)
  await wait(3)
  const mom = spawn('mother', R.door.x, R.door.z + 1.5, Math.PI)
  mom.walkTo(R.inside.x, R.inside.z - 0.6, 1.9)
  await say('Mummy', 'Beta! Dono ko dekho... Bhagwan ka shukar hai.', 'My boys! Thank God, thank God.', { pos: mom.pos, dur: 3.6 })
  await N('Mummy... hum shaam tak aana chahte the.', 'Mom... we meant to be back by evening.', { dur: 3 })
  await wait(4)
  // quiet unresolved beat: a muddy footprint and a heavy impact outside
  R.footprint.visible = true
  await wait(1)
  audio.thud({ x: R.door.x, y: 1, z: R.door.z + 9 }, 0.9)
  caption('[a heavy impact, outside the ward]', 3)
  fear(0.4)
  await wait(1.6)
  await T('Tune suna?', 'Did you hear that?', { dur: 1.8 })
  await wait(2.4)
  await endScene(2.6)
  s.onEnd('ENDING C — Khudai ka gadda', 'Dono zinda hain. Gadda asli tha. Peechha karne wala koi nahi mila.')
}
