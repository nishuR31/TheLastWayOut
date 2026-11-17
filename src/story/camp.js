// Chapter 3-4 of the final script: the campsite (warm, funny, ordinary) and then THE LOOP (the bike is in plain sight and unreachable).
import { G, ui, audio, THREE, N, T, say, wait, load, startScene, setTime, reveal, fear, tired, gate, snapTo, go, use, caption, spawn, choose, compHold, compFollow, apparition, dread } from './helpers.js'
import { fire } from '../core/fire.js'
import { makeBiscuit, makeChai, makeMatchbox } from '../world/props.js'

const P = () => G.player
const V3 = (x, y, z) => new THREE.Vector3(x, y, z)
const sleepMs = (ms) => new Promise(r => setTimeout(r, ms))
const A = (hi, en, o) => say('Arunab', hi, en, o)
const K = (hi, en, o) => say('Karan', hi, en, o)
const M = (hi, en, o) => say('Aman', hi, en, o)
const Ro = (hi, en, o) => say('Rohan', hi, en, o)

export async function ch2(s) {
  setTime(14.75, 0, false, true)
  const L = await load('camp', { env: 'day' }, { dx: 1.2 })
  const c = G.comp, p = P()
  G.hasSignal = true; G.photos = 0; G.matches = 0; G.clockRate = 30
  p.pos.set(0, 0, -22); p.yaw = 0
  const FP = L.refs.firePit, bike = L.refs.bikePos, sc = G.scooter
  // the crew
  const arunab = spawn('arunab', -2.6, 58.4, 1.4), karan = spawn('karan', 2.8, 64.4, 3.6), aman = spawn('aman', 5.2, 62.0, 4.4), rohan = spawn('rohan', -1.2, 65.6, 0.3)
  arunab.pose('sit'); karan.pose('sit'); rohan.pose('sit')
  compHold(-3, 8); c.mode = 'follow'
  await startScene(1.2)
  ui.titleCard('CHAPTER 3', 'Campsite', '2:45 PM', 3.2)
  await wait(0.6)
  await T('Ye lo. Ho gaya. Bike yahin lagate hain, sabke saath.', 'Here we are. Let\'s park the bike with the others.', { dur: 3.2 })
  await N('Haan. Safe lagta hai.', 'Yes. Feels safe.', { dur: 2 })
  // the bike goes under the sal tree and stays in plain sight
  ui.objective('Camp tak chalo · Walk up to the campsite')
  ui.toast('Scooter sal ke ped ke neeche lag gayi. Camp tak chalo', 4)
  await gate(() => G.distToPlayer(0, 50) < 12, () => snapTo(0, 46), 0, [0, 50, 'Camp ki taraf · To the campsite'])
  // OBSERVE at the entrance (free, powerless)
  caption('[a board: "Jungle ke raaste ka dhyan rakhein". A fork behind you curves toward the bamboo. The stream runs downhill, away from camp.]', 6)
  await N('(dheere) Stream us taraf jaa rahi hai. Agar kabhi raasta bhoolein, toh paani ke saath chalo.', '(to himself) The stream flows that way. If we ever lose the path, follow the water.', { dur: 4.4 })
  await T('Bhai, tu kab se Bear Grylls ban gaya?', 'Since when are you Bear Grylls?', { dur: 2.4 })
  await N('Bas aise hi, dekh raha hoon.', 'Just looking around.', { dur: 2 })
  await gate(() => G.distToPlayer(FP.x, FP.z) < 8, () => snapTo(FP.x, FP.z - 6), 0, [FP.x, FP.z, 'Crew ke paas · Over to the crew'])
  K('Oye! Naye log! Antakshari mein ek banda kam pad raha hai. Tum dono mein se koi gaata hai?', 'Hey, newcomers! We are one short for antakshari. Does either of you sing?', { dur: 4.4 })
  await wait(4.6)
  await T('Bhai, ye gaata hai.', 'He sings.', { dur: 1.6 })
  await N('Main? Tu gaata hai. Ghar ke shower mein jo concert hota hai, uska kya?', 'Me? You sing. What about your shower concerts?', { dur: 3.4 })
  await K('Dono baitho. Chai lo.', 'Both of you sit. Have some tea.', { dur: 2 })
  await A('Thandi jagah hai, garam chai hi kaam aati hai. Pehli baar aaye ho?', 'It is a cold place, hot tea is what works. First time here?', { dur: 3.6 })
  await N('Haan. Dost ne bataya tha.', 'Yes. A friend told us.', { dur: 2 })
  await A('Achhi jagah hai. Bas ek baat yaad rakhna: din ke ujaale mein aana, din ke ujaale mein jaana. Shaam ko jungle thoda... alag ho jata hai.', 'Good place. One thing: come in daylight, leave in daylight. In the evening the forest gets a bit... different.', { dur: 6 })
  await N('Alag matlab?', 'Different how?', { dur: 1.6 })
  await A('Raasta bhoolna aasaan ho jata hai, bas. Main das saal se aa raha hoon, kabhi kuch nahi hua. Bas yaad rakhna.', 'It becomes easy to lose the way, that is all. Ten years and nothing ever happened. Just remember.', { dur: 5.4 })
  // ---------------- free roam: warm, optional, unhurried ----------------
  ui.objective('Camp mein ghoomo: chai, gaana, photo, antakshari (E). Bench par aaram karo to waqt guzarta hai · Roam, then rest on the bench to pass time')
  G.clockRate = 30
  const done = new Set(); let busy = false
  const act = (id, pos, label, fn, r = 2.6) => G.addInteract({ pos, label, r, cone: -1, key: 'E', once: false, enabled: () => !busy && !done.has(id), onUse: () => {
    if (busy || done.has(id)) return
    busy = true; p.canMove = false
    ;(async () => { try { await fn(); done.add(id) } finally { busy = false; p.canMove = true } })().catch(e => { if (e !== 'abort') console.error(e) })
  } })
  act('arunab', arunab.pos, 'Arunab se poochho: raat mein kaise bachein?', async () => {
    await N('Uncle, agar andhera ho jaye toh kaise bachein?', 'Uncle, how do we stay safe if it gets dark?', { dur: 3 })
    await A('Seekh lo toh seekh lo. Ek: bheege mat raho. Do: andhere mein chalna band kar do, subah tak ruko. Teen: aag jalao toh aad mein, khule mein nahi. Sookhi lakdi, sookhi patti, aur ek chingari. Bike ka plug bhi chingari de deta hai, par petrol door rakhna. Bahut door.', 'Learn it if you like. One: do not stay wet. Two: stop walking in the dark, wait for morning. Three: light a fire in cover, not in the open. Dry wood, dry leaves, a spark. A bike plug gives a spark too, but keep petrol far away.', { dur: 10 })
    await T('Theek hai uncle.', 'Okay, uncle.', { dur: 1.6 })
    await A('(haath hilakar) Ye sab kaam nahi aayega. Bas mazaak mein bata raha hoon.', '(waving it off) None of this will be needed. Just joking.', { dur: 3.4 })
    fire.count += 2; ui.toast('Arunab ne kuch sookhi lakdi di · Arunab gave you some dry twigs (E se utha sakte ho / T se aag)', 4)
  })
  act('karan', karan.pos, 'Karan ka guitar sunna', async () => {
    caption('[Karan plays something slow and plucked, half-humming along]', 4)
    await T('Ye konsa gaana hai?', 'Which song is this?', { dur: 2 })
    await K('Pata nahi yaar. Kal raat se dimaag mein atki hai. Naam yaad nahi aa raha.', 'No idea. It got stuck in my head last night. Cannot remember the name.', { dur: 4.4 })
    await wait(1.4)
  })
  act('aman', aman.pos, 'Aman ka drone: group photo', async () => {
    await M('Ek group photo kheenchte hain, sab line mein! Dekho, upar se kaisa lag raha hai!', 'Group photo, everyone in line! Look how it looks from above!', { dur: 4 })
    caption('[the drone screen: a green canopy, the stream like a thread of silver glass]', 4.4)
    await wait(2); audio.click(); G.photos++; ui.toast('Group photo li gayi [ic:camera] · Group photo taken', 3)
  })
  act('rohan', rohan.pos, 'Rohan se baat karo', async () => {
    await wait(0.4)
    await Ro('Bhaiya, wahan se kisi ne aawaz di thi na? Aapne suna?', 'Brother, someone called from there, didn\'t they? Did you hear?', { dur: 3.6 })
    await N('Kisne?', 'Who?', { dur: 1.2 })
    await Ro('Pata nahi. Shayad mere dost ne. (kaan mein phir earphone laga leta hai)', 'Not sure. Maybe my friend. (puts the earphone back in)', { dur: 3.4 })
    caption('[a single leaf drifts down and lands at his feet]', 3)
  })
  act('stream', L.refs.stream, 'Nadi ke paas jao', async () => {
    caption('[cold, glass-clear water. Your reflection... and for half a second, a second one standing behind it]', 5)
    await wait(1.4); G.camShake(0.15)
    await N('...', '(you turn. Nishant is far off, photographing a rock)', { voice: false, dur: 2.4 })
  }, 3.6)
  act('drawing', L.refs.drawing, 'Patthar par nishan dekho · photo lo', async () => {
    await N('Ye kisne banaya? Ek gaon... ek kuan... bargad ka ped.', 'Who drew this? A village... a well... a banyan tree.', { dur: 4 })
    audio.click(); G.photos++; G.drawingPhoto = true; ui.toast('Photo li gayi [ic:camera]', 2.4)
  })
  act('antakshari', new THREE.Vector3(0, 1, 62.4), 'Antakshari khelo', async () => {
    await K('Chalo antakshari! Karan aur Nishant ek team. Aman aur Nishan doosri. Arunab bhaiya judge.', 'Antakshari! Karan and Nishant one team, Aman and Nishan the other. Arunab is the judge.', { dur: 5 })
    await T('(gaata hai, galat gaana)', '(sings, wrong song)', { voice: false, dur: 2.4 })
    await A('Galat gaana! Ek point kata!', 'Wrong song! A point off!', { dur: 2 })
    await K('Nishant, teri apni team ne tujhe dhokha diya!', 'Nishant, your own team betrayed you!', { dur: 2.6 })
    await M('Shayari! Mohabbat ki... (doosri line bhool jaata hai)', 'A shayari! About love... (forgets the second line)', { dur: 3.2 })
    await A('Bhai, tum log sheher ka naam roshan karoge.', 'You lot will make the city proud.', { dur: 2.6 })
    caption('[laughter echoes off the trees; two birds startle up, then settle]', 3.4)
    setTime(Math.min(16.9, G.time + 0.6), 0, false, true); G.clockRate = 30
  })
  act('biscuit', L.refs.bench, 'Bench par aakhri biscuit: Rock-Paper-Scissors', async () => {
    const bic = makeBiscuit(); bic.position.set(L.refs.bench.x + 0.08, L.refs.bench.y + 0.01, L.refs.bench.z); L.group.add(bic)
    await T('Ek hi biscuit bacha hai. Rock-paper-scissors!', 'One biscuit left. Rock-paper-scissors!', { dur: 3 })
    const k = await choose('Tum kya dikhaoge?', ['Rock', 'Paper', 'Scissors'], 1)
    if (k === 1) { await T('Paper rock ko dhak leta hai. Tu jeeta.', 'Paper covers rock. You win.', { dur: 2.4 }); await N('Main jeeta!', 'I win!', { dur: 1.4 }) }
    else await T('Teen, do, ek, ab! Tu haar gaya!', 'Three, two, one, now! You lose!', { dur: 2.6 })
    await T('Bhai, tu toh rules hi badal deta hai.', 'You change the rules!', { dur: 2.2 })
    bic.visible = false; c.pose('eat'); await wait(1.8); c.pose('stand')
  })
  G.addInteract({ pos: L.refs.bench, label: 'Bench par aaram karo (waqt guzarta hai)', r: 2.4, cone: -1, key: 'E', once: false, enabled: () => !busy && G.time < 17, onUse: () => {
    busy = true; p.canMove = false
    ;(async () => { try { caption('[you sit a while. Birds. The creak of the bench. Time slides past...]', 4); await wait(3); setTime(Math.min(17, G.time + 0.55), 0, false, true); G.clockRate = 30 } finally { busy = false; p.canMove = true } })().catch(() => {})
  } })
  await gate(() => G.time >= 17, () => setTime(17, 0, false, true), 0)
  ui.objective(null); G.interacts = []; while (busy) await wait(0.3)
  // ---------------- THE CAMPFIRE, 5:00 PM ----------------
  p.canMove = false; G.env.set('evening'); G.clockRate = 6
  const pit = fire.fires[0]
  await A('Aag jalana ho toh. Teen teeli hain.', 'If you want a fire. Three matches.', { dur: 3 })
  const mb = makeMatchbox(); mb.position.set(arunab.pos.x + 0.35, 0.55, arunab.pos.z + 0.25); L.group.add(mb)
  G.matches = 3; audio.click(); ui.toast('Arunab ne matchbox diya [ic:matchbox] · Matchbox (3 teeli)', 3.6)
  await wait(0.6); G.matches = 2; mb.visible = false; fire.lightNow(pit, 400)
  caption('[one match. The fire catches on the first try]', 3)
  for (const [a, x, z] of [[arunab, -2.2, 58.6], [karan, 2.4, 63.4], [aman, 3.6, 60.6], [rohan, -0.6, 63.8]]) { a.walkTo(x, z, 1.6) }
  await wait(3); karan.pose('sit'); rohan.pose('sit'); arunab.pose('sit')
  // cups of chai within reach of the fire — the warmth the night will take away
  for (const [x, z] of [[-2.4, 59.1], [2.5, 63.2], [-0.5, 63.3], [3.4, 60.9]]) {
    const cup = makeChai(); cup.position.set(x, 0.44, z); L.group.add(cup)
  }
  await K('(guitar bajata hai) Sab saath mein! Wahi purana gaana!', '(plays) Everyone together! The old song!', { dur: 3 })
  caption('[six people singing in six different keys. Nishant is the loudest]', 4.6)
  await wait(4)
  await T('Bhai, ye toh perfect hai. Aise hi ruk jaate hain yahin.', 'This is perfect. Let\'s just stay here.', { dur: 3 })
  await N('Mummy ko kya bolenge?', 'What will we tell Mummy?', { dur: 2 })
  await T('Ki Bear Grylls ne roka tha.', 'That Bear Grylls stopped us.', { dur: 2.4 })
  audio.click(); G.photos++; ui.toast('Aakhri photo, sab aag ke saamne [ic:camera]', 3)
  await wait(2)
  // the crew leaves, one by one, Arunab last
  await K('Chalo bhai log, hum nikalte hain. Raasta lamba hai.', 'Right, we are off. It is a long way.', { dur: 3 })
  await M('Tum log bhi jaldi niklo, yaar.', 'You two leave soon as well.', { dur: 2.2 })
  setTime(17.17, 0, false, true)
  for (const a of [karan, aman, rohan]) { a.pose('stand'); a.walkTo(0, 14, 1.9); await wait(1.4) }
  caption('[Karan waves from the track, still humming that half-remembered tune. Rohan looks once more at the bamboo, then goes]', 5)
  await wait(4.2)
  setTime(17.42, 0, false, true)
  await A('Yaad hai na? Shaam se pehle.', 'You remember? Before evening.', { dur: 2.4 })
  await T('Haan uncle. Bas aag bujha ke nikalte hain.', 'Yes, uncle. We will put the fire out and leave.', { dur: 3 })
  arunab.pose('stand'); arunab.walkTo(0, 14, 1.6)
  await wait(5)
  for (const a of [arunab, karan, aman, rohan]) G.removeActor(a)
  caption('[the engines fade down the track. The clearing is empty for the first time all day. Somewhere behind the bench, unseen, one dry leaf drops]', 6)
  // a slow curved drift back toward the empty bench — the warmth is gone
  try {
    await G.shot({ from: V3(-6.4, 1.65, 66.8), to: V3(-3.1, 1.38, 64.6), lookFrom: V3(0, 0.95, 60), lookTo: V3(-4.5, 0.85, 63.5), dur: 3.0, fov: 52, fov1: 62, arc: { x: 0.55, y: 0.3, z: -0.35 }, handheld: 0.22, ease: 'out' })
  } finally { G.endShot() }
  G.horrorTurn(L.refs.bench, 1.6, 0.9, 0.12)
  apparition('shadow', { dist: 16, life: 5 }); dread(0.2)
  await wait(4)
  setTime(17.67, 0, false, true); G.clockRate = 0
  p.canMove = true
  await T('Bhai, 5:40 ho gaye. Nikalna chahiye.', 'It is 5:40. We should go.', { dur: 2.6 })
  await N('Haan. Aag bujha de. Chal.', 'Yes. Put the fire out. Come on.', { dur: 2.2 })
  ui.objective('Aag ko paani se bujhao (E) · Put the fire out')
  await use(new THREE.Vector3(FP.x, 0.6, FP.z), 'Aag ko stream ke paani se bujhao', { r: 3.4, cone: -1 })
  fire._out(pit); audio.puff && audio.puff(1); caption('[the hiss, the steam, the smell of wet ash]', 3.4)
  G.matches = 2; ui.objective(null)
  await wait(2.4)
  await N('Ab safe hai. Chal.', 'Safe now. Let\'s go.', { dur: 2 })
  return loopScene(L, c, p, s)
}

// ---------------- CHAPTER 4: THE LOOP ----------------
async function loopScene(L, c, p, s) {
  const FP = L.refs.firePit, bike = L.refs.bikePos, sc = G.scooter, pit = fire.fires[0]
  const toBike = Math.atan2(bike.x - FP.x, bike.z - FP.z)
  G.env.set('storm'); G.env.strike(1.4); G.hasSignal = false; fear(0.35); G.clockRate = 0
  ui.titleCard('CHAPTER 4', 'The Loop', '5:45 PM', 3)
  setTime(17.75, 0, true, true)
  await wait(0.8)
  G.horrorTurn(V3(FP.x, 22, FP.z + 30), 1.8, 1.2, 0.3)
  caption('[the sky rolls over like spilled ink. The birds stop mid-call. Their breath shows. Thunder, far off]', 5)
  await T('Ye achanak kya hua? Baadal kahan se aa gaye?', 'What was that? Where did these clouds come from?', { dur: 3.2 })
  await N('Jaldi chal. Bike tak.', 'Quick. To the bike.', { dur: 1.8 })
  const back = async () => {
    p.canMove = false
    await G.blink(1.0)
    p.pos.set(FP.x + 1.6, 0, FP.z - 2.2); p.yaw = toBike; p.pitch = 0
    c.place(FP.x - 1.2, FP.z - 2.8, toBike)
    await G.unblink(0.9); p.canMove = true
  }
  const trig = (r) => G.until(() => G.auto || G.distToPlayer(bike.x, bike.z) < r)
  ui.toast('Bike saaf dikh rahi hai, sal ke ped ke neeche. Seedha chalo', 5)
  baseGoalTo(bike, 'Bike tak jao · To the bike')
  // ATTEMPT 1
  await trig(24); await back()
  await T('(ghabrayi hansi) Bhai, hum ghoom gaye.', '(nervous laugh) We went round in a circle.', { dur: 2.6 })
  await N('Seedha toh chale the.', 'We walked straight.', { dur: 2 })
  // ATTEMPT 2
  ui.toast('Dobara. Is baar gin ke chalo', 4)
  c.mode = 'hold'; c.holdPos = { x: FP.x - 1.2, z: FP.z - 2.8 }
  await trig(24); await back()
  await T('Bhai, tu wahan se kyun aaya? Main toh tujhe udhar dekh raha tha!', 'Why did you come from there? I was watching you the other way!', { dur: 4 })
  await N('Maine tujhe wahan jaate dekha tha...', 'I saw you walk off that way...', { dur: 2.6 })
  c.mode = 'follow'
  // ATTEMPT 3: follow the water, as Nishan said earlier
  ui.toast('Nishan ne kaha tha: paani ke saath chalo. Nadi ke saath chalo', 5)
  const far = { x: -40, z: 98 }
  baseGoalTo(new THREE.Vector3(far.x, 1, far.z), 'Nadi ke saath chalo · Follow the stream')
  await G.until(() => G.auto || G.distToPlayer(far.x, far.z) < 9)
  await back()
  L.refs.drawStone.scale.set(1.6, 1, 1.6); L.refs.drawMark.scale.setScalar(1.7)
  await T('Tu Bear Grylls ban gaya tha na? Ab bata.', 'You were Bear Grylls, weren\'t you? Now tell me.', { dur: 3 })
  caption('[the scratched village on the stone is bigger now. More houses. And in the fireplace, doused with water, a single ember glows red under the wet ash]', 7)
  await wait(3)
  await T('Ye pehle itna bada tha?', 'Was this this big before?', { dur: 2.2 })
  await N('Nahi.', 'No.', { dur: 1.2 })
  for (const h of [18.03, 17.68, 18.25]) { setTime(h, 0, true, true); await wait(0.5) }
  reveal('microsleep')
  // OBSERVE (free, powerless)
  ui.objective('Ruko. Suno. (observe karna free hai) · Stop and listen')
  await wait(3)
  caption('[the bike is still there, under the sal tree, its reflector gleaming. Every time you hurry, the path closes behind a bend. The leaf-footsteps, behind you a minute ago, are now ahead]', 8)
  await N('Nishant. Sun. Ye awaaz aage ja rahi hai. Peeche nahi.', 'Nishant. Listen. This sound is going ahead. Not behind.', { dur: 3.6 })
  await T('Matlab?', 'Meaning?', { dur: 1.2 })
  await N('Matlab... ya toh ye humein bike tak le jayega, ya bike ki jagah le jayega.', 'Either it leads us to the bike... or to wherever the bike is meant to be.', { dur: 4.6 })
  await T('Bhai, ye options kaun deta hai?', 'Who gives these options?', { dur: 2.2 })
  await N('Koi nahi. Aur koi doosra option bhi nahi hai.', 'Nobody. And there is no other option.', { dur: 3 })
  // walk behind the sound, slowly
  ui.objective('Awaaz ke peeche, dheere dheere · Follow the footsteps, slowly'); ui.toast('Daudo mat. Awaaz ke peeche chalo', 5)
  baseGoalTo(bike, 'Awaaz ke peeche · Follow the sound')
  let k = 0, on = true
  ;(async () => { try { while (on) { const f = Math.min(1, k / 24); audio.footstep('mud', 0.9, { x: FP.x + (bike.x - FP.x) * f, y: 0.1, z: FP.z + (bike.z - FP.z) * f }); k++; await wait(0.8) } } catch (e) {} })()
  await G.until(() => G.auto || G.distToPlayer(bike.x, bike.z) < 3.2)
  on = false
  G.goal = null; ui.objective(null)
  setTime(18.63, 0, false, true); G.clockRate = 0
  caption('[on the seat: small, wet, bare, pressed into the leather, a footprint]', 5)
  await T('Kisi bachche ka hoga.', 'Must be some kid\'s.', { dur: 2 })
  await N('Is jungle mein?', 'In this forest?', { dur: 1.6 })
  await T('Bhai, bas chal. Bike chala.', 'Come on. Start the bike.', { dur: 2 })
  reveal('steps')
  G.noBoard = false
}

function baseGoalTo(v, label) { G.goal = { x: v.x, z: v.z, label, skip: () => snapTo(v.x - 2, v.z - 2) } }
