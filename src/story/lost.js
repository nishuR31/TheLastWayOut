// Chapters 5-7 of the final script: riding into the lost forest, THE FIRE (twigs, petrol, plug, spark) and the village that returns.
import { G, ui, audio, THREE, N, T, say, wait, load, startScene, endScene, setTime, reveal, fear, tired, use, gate, snapTo, go, goTrail, trailD, trailLen, lookFor, lookedAway, around, stepsAt, spawn, caption, choose, compHold, compFollow, pushOff } from './helpers.js'
import { fire } from '../core/fire.js'

const P = () => G.player
const V = (x, y, z) => new THREE.Vector3(x, y, z)
const bg = (fn) => { fn().catch(e => { if (e !== 'abort') console.error(e) }) }

/* ------------------------------------------------------------------ CHAPTER 5 */
export async function ch5(s) {
  setTime(18.67, 0, false, true)
  const L = await load('night', { env: 'dusk', scooter: true, push: false }, { dx: 1.2 })
  const c = G.comp, p = P(), sc = G.scooter, W = L.walkPts
  G.hasSignal = false; G.torchOn = false; G.clockRate = 4; fear(0.3); tired(0.4)
  sc.dead = false
  G.mount(sc)
  L.sealBack()                       // the track behind the bike will close
  await startScene(1.2)
  ui.titleCard('CHAPTER 5', 'Riding into the lost forest', '6:40 PM', 3.4)
  ui.objective('Wahi kachha raasta, aage chalo · Ride on the dirt track')
  G.rideHint = 'W — aage · A/D — mudo · Space — brake'
  await T('Pehli kick pe? Aaj pakka kuch hone wala hai.', 'First kick? Something is definitely going to happen today.', { dur: 3 })
  await N('Shukar kar aur chal. Entry board tak zyada door nahi hoga.', 'Be thankful and ride. The entry board cannot be far.', { dur: 3.2 })
  await goTrail(W, 36)
  caption('[the birdsong is gone completely. The mossy signboard that should mark the edge never appears. The track tilts downhill instead of up. Mist rises off the ground in slow sheets]', 7)
  await N('Board abhi tak nahi aaya?', 'The board has not come yet?', { dur: 2.2 })
  await goTrail(W, 62)
  // the fork: both ends are the same
  G.env.set('rain')
  const k = await choose('Raaste mein fork hai. Kaun sa?', ['Left (ghane ped)', 'Right (ghoom ke wahin)'], 0)
  if (k === 1) { await wait(0.6); caption('[five minutes later you are at the same fork, with one new broken branch lying across the ground. Then the track goes on, deeper anyway]', 6); await T('Ye toh wahi fork hai... ye daali pehle nahi thi.', 'This is the same fork... that branch was not here before.', { dur: 3.4 }) }
  else { await wait(0.6); caption('[a tunnel of close-leaning trees]', 3.4) }
  await N('Bhai, wapas chalte hain. Ye theek nahi lag raha.', 'Let us go back. This does not feel right.', { dur: 2.8 })
  ui.toast('Chahe toh wapas jaake dekho · Try turning back if you like', 4)
  await G.until(() => G.auto || G.distToPlayer(0, -4) < 36 || trailD(W) > 112)
  if (!G.auto && G.distToPlayer(0, -4) < 36) {
    caption('[behind you, where the track plainly was thirty seconds ago, there is only a solid wall of trees and undisturbed mud. No tyre marks]', 6)
    await T('Wo raasta... abhi yahin tha.', 'That track... was right here.', { dur: 2.4 })
    await N('Haan.', 'Yes.', { dur: 1 })
    await T('Matlab wapas jaane ka option hi nahi hai?', 'So there is no going back?', { dur: 2.4 })
    await N('Aage hi jaana hai.', 'Only forward.', { dur: 1.8 })
  }
  // the leaf-footsteps run alongside the bike
  let run = true
  bg(async () => { while (run) { const f = sc.fwd(), sp = Math.abs(sc.speed); if (sp > 0.5) audio.footstep('mud', 0.8, { x: sc.chassis.position.x - f.z * 2.6 * (Math.random() < 0.5 ? 1 : -1), y: 0.1, z: sc.chassis.position.z + f.x * 2.6 }); await wait(Math.max(0.22, 0.9 / (sp + 0.5))) } })
  await goTrail(W, 74)
  caption('[the headlight cuts a small, shrinking cone through thickening mist. The footsteps are running beside the bike, matching its speed exactly]', 7)
  await N('Speedometer bees kilometre dikha raha hai. Aur awaaz utni hi tez hai.', 'Twenty kilometres an hour. And the footsteps keep exactly the same pace.', { dur: 4 })
  await T('Bhai, aage kya hoga?', 'What will happen ahead?', { dur: 1.8 })
  await N('Kuch nahi. Hum bahar nikal jayenge.', 'Nothing. We will get out.', { dur: 2.4 })
  await T('Tu hamesha ye bolta hai.', 'You always say that.', { dur: 2 })
  await N('Aur hamesha sahi hota hoon.', 'And I am always right.', { dur: 2 })
  await T('Ek baar bhi nahi.', 'Not even once.', { dur: 1.6 })
  await goTrail(W, 100)
  caption('[a stump with a handprint pressed into the mud beside it. Ten minutes later: the same stump, the same handprint, a little deeper. Neither of them says it out loud]', 7)
  reveal('shadow')
  await goTrail(W, 118)
  { const q = around(7, Math.PI, 0.5); audio.crack && audio.crack(q, 1); G.horrorTurn(V(q.x, 1.2, q.z), 1.2, 0.6, 0.3) }
  caption('[when Nishan brakes, the footsteps stop a full second later than they should]', 4)
  await goTrail(W, 130)
  // the bike dies in the mud
  run = false
  G.keyBusy = true; audio.st.engine = 0; sc.dead = true
  caption('[the rear wheel sinks into thick, sucking mud. The engine coughs twice and dies. Nishan kicks the starter. Nothing. Again. Nothing]', 6)
  for (const on of [true, false, true, false]) { sc.light(on); await wait(0.25) }
  await wait(0.3)
  caption('[the headlight throws one last beam across the dark. It lands for a single second on a bamboo grove, twenty metres ahead, on firmer ground. Then the light goes out]', 7)
  G.rideHint = null; ui.objective(null)
  await T('Bhai, petrol khatam?', 'Is the petrol gone?', { dur: 2 })
  await N('Nahi, tank mein hai. Plug geela ho gaya hoga.', 'No, there is petrol. The plug must be wet.', { dur: 3 })
  G.dismount(); G.keyBusy = false; G.scooter.dead = true; G.torchOn = true
  // OBSERVE (free, powerless)
  caption('[no stars, no moon. The mud is soft everywhere; the bamboo sits on firm ground. The leaf-footsteps have gone quiet, as though they are waiting for something. Phone: 56%, no signal]', 8)
  await N('Is mud mein bike nahi chalegi. Aur hum geele hain.', 'The bike is not going anywhere in this mud. And we are soaked.', { dur: 3.4 })
  await T('Haan. Mere haath sunn ho rahe hain.', 'Yes. My hands are going numb.', { dur: 2.4 })
  await N('Wo bamboo ka jhund, ooncha hai. Wahan paani nahi rukega.', 'That bamboo grove is on high ground. Water will not stand there.', { dur: 3.2 })
  await T('Wahi ek jagah hai jo dikh rahi hai. Chal.', 'It is the only place in sight. Come on.', { dur: 2.4 })
  await endScene(1.4)
}

/* ------------------------------------------------------------------ CHAPTER 6: THE FIRE */
export async function ch6(s) {
  setTime(19.58, 0, false, true)
  const L = await load('bamboo', { env: 'storm', scooter: true, story: true }, { dx: 1.2 })
  const c = G.comp, p = P(), sc = G.scooter, R = L.refs
  sc.dead = true; sc.light(true); G.torchOn = true; G.hasSignal = false; G.clockRate = 6; fear(0.3); tired(0.85)
  G.noBuild = true; fire.count = 0
  s.fire = { made: false, best: false, ring: false }
  await startScene(1.2)
  ui.titleCard('CHAPTER 6', 'The Fire', '7:40 PM', 3.4)
  ui.objective('Scooter ko bamboo ke jhund tak dhakelo · Push the bike up to the bamboo grove')
  ui.toast('Akele dhakka dheere lagta hai. Shift+W dabao to Nishant bhi dhakka lagayega. F — bike ki headlight', 6)
  await T('Bhai, ye bahut bhaari hai. Dhakka lagate hain, dono milkar.', 'This is heavy. Let us push together.', { dur: 3 })
  await gate(() => G.distToPlayer(5.6, 46) < 4.5, () => { snapTo(5.6, 44); }, 0, [5.6, 46, 'Bamboo ke paas, ooncha pakka zameen · Up onto the firm ground by the bamboo'])
  G.stopPush(); G.noRun = false; sc.place(7.6, 52.4, 0.8); sc.park(); G.torchOn = true; ui.objective(null)
  caption('[a natural shelter of leaning bamboo, a dry patch of ground just inside. Rain hammers on the leaves above]', 5)
  await T('Bhai, mujhe bahut thand lag rahi hai.', 'I am so cold.', { dur: 2.2 })
  await N('Aag chahiye.', 'We need a fire.', { dur: 1.6 })
  await T('Arunab bhaiya ka matchbox!', 'Arunab\'s matchbox!', { dur: 2 })
  G.matches = 0; ui.toast('Matchbox geela hai. Teeliyan toot gayin 🔥✗', 4)
  await N('Bike ka plug. Arunab ne kaha tha chingari deta hai. Aur tank mein petrol hai.', 'The bike plug. Arunab said it gives a spark. And there is petrol in the tank.', { dur: 4.4 })
  await T('Petrol door rakhna. Wo bhi bola tha.', 'Keep petrol far. He said that too.', { dur: 2.6 })
  await N('Pehle plan banate hain.', 'First, a plan.', { dur: 1.8 })

  // ---- STEP 1: dry material (tinder, kindling, fuel) ----
  const got = { tinder: 0, kindling: 0, fuel: 0 }
  const pick = (kind, label, x, z) => G.addInteract({ pos: V(x, 0.4, z), label, r: 2.2, cone: -1, key: 'E', once: true, onUse: () => {
    got[kind]++; fire.count++; audio.rustle(V(x, 0.3, z), 0.5); ui.toast(`${kind === 'tinder' ? 'Bhusi/tinder' : kind === 'kindling' ? 'Patli lakdi/kindling' : 'Moti lakdi/fuel'}: ${got[kind]}/3`, 1.6)
    if (kind === 'tinder' && got.tinder === 2) bg(async () => { stepsAt(around(7, Math.PI, 0.5), 4, 0.6); await wait(0.5); await T('(fusfusakar) Bhai, tune suna?', '(whisper) Did you hear that?', { dur: 2 }); await N('(fusfusakar) Haan. Kaam karte raho. Mat ruk. Agar ruk gaye toh darr jaayenge.', '(whisper) Yes. Keep working. Do not stop, or we will freeze up with fear.', { dur: 3.6 }) })
  } })
  ui.objective('Sookha saaman jama karo: tinder (bhusi), kindling (patli lakdi), fuel (moti lakdi) · Gather dry material')
  ui.toast('Geeli patti bekaar hai. Bamboo ke neeche, log ke neeche aur khokhle tane mein dhundo', 5)
  for (const [x, z] of [[-4.7, 44.6], [-5.4, 46.4], [-3.9, 43.2]]) pick('tinder', 'Sookhi bhusi uthao', x, z)
  for (const [x, z] of [[-3.6, 49.4], [-2.6, 48.6], [-3.4, 50.6]]) pick('kindling', 'Patli sookhi lakdi uthao', x, z)
  for (const [x, z] of [[-10.3, 62.5], [-8.8, 61.4], [-9.5, 63.3]]) pick('fuel', 'Moti sookhi lakdi uthao', x, z)
  await gate(() => got.tinder >= 3 && got.kindling >= 3 && got.fuel >= 3, () => { got.tinder = got.kindling = got.fuel = 3; fire.count = 9 }, 0, [-6, 47, 'Bamboo ke neeche, log aur khokhle tane ke paas · Under the bamboo, the log and the stump'])
  G.interacts = []
  await T('Bhai, ye itni dry kaise hai? Kisi ne yahan rakhi hain kya?', 'How is this so dry? Did someone put it here?', { dur: 3.4 })
  await N('Jungle hai yaar. Utha, chal.', 'It is a forest. Pick it up, come on.', { dur: 2.2 })

  // ---- STEP 2: choosing the fire spot ----
  ui.objective(null)
  caption('[wind from the left: smoke will drift into the bamboo. The dry patch under the overhang is flat. A rock sits off to the right. The bike is ten steps away; a faint petrol smell. Dry bamboo burns hot and cracks loudly]', 8)
  await wait(2)
  const spot = await choose('Aag kahan jalayein?', ['Bamboo ke overhang ke neeche (sabse sookha, par bamboo chingari udata hai)', 'Khule mein, patthar ke paas (geela, jalana mushkil, par bamboo se door)', 'Shelter ke munh par, pathar ka ghera banake (sabse accha, par 6 pathar nadi se laane honge)'], 2)
  const pos = [[-5.2, 43.6], [5.6, 44.4], [0.4, 45.4]][spot]
  if (spot === 0) await T('Bhai, bamboo jalne mein tez hota hai. Agar jhund mein aag lag gayi toh?', 'Bamboo burns fast. What if the grove catches?', { dur: 3.4 })
  else if (spot === 1) await N('Khule mein. Hawa se aag bujh na jaaye.', 'In the open. Hope the wind does not kill it.', { dur: 2.4 })
  if (spot === 2) {
    await T('Bhai, bamboo jalne mein tez hota hai. Agar jhund mein aag lag gayi toh?', 'Bamboo burns fast. What if the grove catches?', { dur: 3.4 })
    await N('Isiliye pathar ka ghera banate hain.', 'That is why we build a ring of stones.', { dur: 2.4 })
    let stones = 0
    ui.objective('Nadi se 6 chikne pathar laao · Fetch six smooth stones from the stream')
    for (const [x, z] of R.stones) G.addInteract({ pos: V(x, 0.2, z), label: 'Pathar uthao', r: 2, cone: -1, key: 'E', once: true, onUse: () => { stones++; audio.clang(V(x, 0.2, z), 0.2); ui.toast(`Pathar: ${stones}/6`, 1.4); if (stones === 6) bg(async () => { caption('[on the bank, a single wet footprint. It leads into the water. It does not come out the other side]', 6); await wait(2.4); await N('(apne aap se) Maine kuch nahi dekha.', '(to himself) I saw nothing.', { dur: 2.4 }) }) } })
    await gate(() => stones >= 6, () => { stones = 6 }, 0, [R.stones[0][0], R.stones[0][1], 'Nadi ke kinare chikne pathar · Smooth stones on the bank'])
    G.interacts = []; ui.objective(null)
  }
  s.fire.ring = spot === 2
  const pit = fire.addPit(L, pos[0], pos[1], spot === 2)
  c.mode = 'hold'; c.holdPos = { x: pos[0] - 1.8, z: pos[1] + 0.6 }

  // ---- STEP 3: petrol ----
  const bikePos = sc.chassis.position
  ui.objective('Bike se thoda petrol nikalo (ek dhakkan jitna) · Take a little petrol')
  await use(V(bikePos.x, 0.6, bikePos.z), 'Tank se thoda petrol nikalo', { r: 3.2, cone: -1 })
  G.torchOn = false; sc.light(false)
  await N('Bas ek dhakkan jitna. Tiffin ka dhakkan. Aur ek kapda chahiye.', 'Just a capful. The tiffin lid. And a cloth.', { dur: 3 })
  await T('Mera rumaal? Bhai, ye mera favourite hai.', 'My handkerchief? It is my favourite.', { dur: 2.4 })
  await N('Jaan bachaani hai ya rumaal?', 'Do you want to save your life or the hankie?', { dur: 2.2 })
  await T('...Le le.', '...Take it.', { dur: 1.4 })
  await N('Torch tank se door rakh. Mobile bhi. Koi spark nahi.', 'Keep the torch away from the tank. The phone too. No sparks.', { dur: 3 })
  await T('Haan, mera phone pocket mein hai.', 'Yes, my phone is in my pocket.', { dur: 2 })
  await N('Aur zyada mat daalna. Zyada hoga toh aag bhadkegi. Hamara kaam chhoti aag se hai.', 'Do not pour too much. A big flare is not what we want.', { dur: 3.4 })
  caption('[a few careful drops on a dry tiffin lid, soaked into the cloth. The cap closed tight. The bike moved a few steps further away]', 5)
  sc.place(bikePos.x + 3, bikePos.z + 1.5, 0.8); sc.park()
  await wait(1.4)
  if (G.tankFull) ui.toast('Tank mein zyada hai · There is plenty of petrol', 3); G.petrol = true
  G.torchOn = true
  // ---- STEP 4: the spark ----
  ui.objective('Bike se spark plug nikalo · Take out the spark plug')
  await use(V(sc.chassis.position.x, 0.6, sc.chassis.position.z), 'Spark plug nikalo', { r: 3.2, cone: -1 })
  if (G.sparePlug) { await T('Chacha wala plug? Waah. Kamaal ka dimaag hai.', 'Chacha\'s plug? Brilliant thinking.', { dur: 2.8 }); await N('Aaj pehli baar tune tareef ki.', 'First time you ever praised me.', { dur: 2 }) }
  else { await N('Bike ka apna plug geela hai. Kapde aur garm haath se sukhana padega.', 'The bike\'s own plug is wet. I have to dry it against cloth and warm skin.', { dur: 3.6 }); caption('[drying the plug takes a while]', 3); await wait(3) }
  ui.objective('Plug ko engine ke dhaatu se lagao, Nishant kick maarega · Hold the plug to the engine; Nishant kicks')
  await use(V(sc.chassis.position.x, 0.6, sc.chassis.position.z), 'Kick (1/3)', { r: 3.2, cone: -1 }); caption('[first kick: nothing]', 1.6)
  await use(V(sc.chassis.position.x, 0.6, sc.chassis.position.z), 'Kick (2/3)', { r: 3.2, cone: -1 }); caption('[second kick: a weak blue flicker]', 1.6)
  await use(V(sc.chassis.position.x, 0.6, sc.chassis.position.z), 'Kick (3/3)', { r: 3.2, cone: -1 }); audio.click(); audio.crack && audio.crack(sc.chassis.position, 0.6)
  ui.objective(null)
  const fuel = 120 + (G.petrol ? 50 : 0) + (G.tankFull ? 50 : 0) + (spot === 2 ? 40 : 0) + (G.sparePlug ? 20 : 0)
  fire.lightNow(pit, fuel)
  s.fire.made = true; s.fire.best = spot === 2 && !!G.sparePlug
  caption('[the petrol-soaked cloth smokes, and catches]', 3)
  // the rain pauses for exactly three seconds as the flame appears
  G.env.set('still'); audio.silence(true); await wait(3); audio.silence(false); G.env.set('storm')
  await T('Bhai... baarish ruk gayi thi na?', 'The rain stopped, didn\'t it?', { dur: 2.4 })
  await N('Ek second ke liye.', 'For a second.', { dur: 1.6 })
  await T('Ek second ke liye. Haan.', 'For a second. Yes.', { dur: 2 })
  // ---- STEP 5: feeding it ----
  ui.toast('Aag mein tinder, phir kindling, phir fuel daalo (E)', 4)
  const fpos = V(pos[0], 0.5, pos[1])
  await use(fpos, 'Tinder daalo', { r: 3, cone: -1 }); caption('[tinder first]', 1.4)
  await use(fpos, 'Kindling daalo', { r: 3, cone: -1 }); caption('[then kindling. Nishant fans it with the tiffin lid]', 2.4)
  await use(fpos, 'Fuel daalo', { r: 3, cone: -1 }); audio.crackle && audio.crackle(fpos, 1.5)
  fire.count = Math.max(0, fire.count - 9); G.noBuild = false
  caption('[a warm orange glow. Steam rises off their wet clothes]', 4)
  G.tiredT = 0.35
  await T('Bhai! Hum aag jala diye! Hum sach mein aag jala diye!', 'We lit a fire! We actually lit a fire!', { dur: 3 })
  await N('Haan! Plug ka kamaal. Chacha ko bolunga.', 'Yes! The plug did it. I will tell Chacha.', { dur: 2.6 })
  c.mode = 'follow'

  // ---- BY THE FIRE: the warm scene ----
  ui.objective('Aag ke paas baitho, thoda aaram karo · Sit by the fire and warm up')
  await gate(() => G.distToPlayer(pos[0], pos[1]) < 2.6, () => snapTo(pos[0] - 1.6, pos[1] + 0.4), 0)
  await wait(1.2)
  p.canMove = false
  await T('Bhai, bachpan mein main andhere se bahut darr jaata tha. Mat bata kisi ko.', 'As a kid I was terrified of the dark. Do not tell anyone.', { dur: 4 })
  await N('Nahi bataunga. Mujhe paani se darr lagta tha. Talab ke paas jaane se.', 'I will not. I was scared of water. Of going near the pond.', { dur: 3.6 })
  await T('Haan, yaad hai. Tu ab bhi nahi tairta.', 'I remember. You still do not swim.', { dur: 2.4 })
  await N('Ab bhi nahi.', 'Still not.', { dur: 1.4 })
  await wait(1.6)
  await T('Mujhe ghar ki yaad aa rahi hai.', 'I miss home.', { dur: 2.2 })
  await N('Mujhe bhi. Mummy chai banati hongi, baar baar phone dekh rahi hongi.', 'Me too. Mummy is making tea and checking her phone again and again.', { dur: 3.6 })
  await T('Karan ka wo gaana yaad hai? Jo uske dimaag mein atka tha?', 'Remember Karan\'s song, the one stuck in his head?', { dur: 3.2 })
  await N('Haan... ab mujhe bhi wahi dhun yaad aa rahi hai.', 'Yes... now I can remember that tune too.', { dur: 2.8 })
  caption('[Nishant hums a few bars without thinking, then stops, surprised at himself]', 4)
  await wait(2.5)
  caption('[beyond the bamboo, a woman hums the same tune back. Very faint. Then gone]', 4)
  G.camShake(0.15); fear(0.45)
  await wait(3)
  p.canMove = true
  const choice = await choose('Aag kab tak? Agle kadam ka faisla', ['Subah tak aag ke paas rukein', 'Jalti hui lakdi ko mashaal banake abhi aage badhein', 'Ek ghanta ruk ke dekhein aur sunein'], 0)
  s.fire.choice = choice
  // OBSERVE: listen for sixty seconds
  caption('[if you sit quietly: the leaf-footsteps circle at exactly ten paces outside the firelight; a woman humming; a child laughing, once; then nothing]', 7)
  bg(async () => { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; audio.footstep('mud', 0.9, { x: pos[0] + Math.sin(a) * 6.5, y: 0.1, z: pos[1] + Math.cos(a) * 6.5 }); await wait(0.7) } })
  await wait(7.5)
  await T('Bhai, aag ke paas koi nahi aa raha.', 'Nobody is coming near the fire.', { dur: 2.4 })
  await N('Haan.', 'Yes.', { dur: 1 })
  await T('Matlab... aag se darta hai?', 'Meaning... it is afraid of the fire?', { dur: 2 })
  await N('Ya shayad intezaar kar raha hai.', 'Or maybe it is waiting.', { dur: 2.2 })
  await T('Bhai, aisa mat bol.', 'Do not say that.', { dur: 1.8 })
  // ---- FIRE EVENTS (spread out, never all at once) ----
  const flames = pit.flames, cols = ['#ff7a1c', '#ffb23c', '#fff0b0']
  pit.lean = 0.9; pit.leanZ = -0.5; caption('[the flame leans slowly toward the bamboo, with no wind. It holds the lean, then straightens]', 5); await wait(4.5); pit.lean = 0; pit.leanZ = 0
  await wait(3)
  flames.forEach(f => f.material.color.set('#38ffb0')); caption('[the fire\'s colour dips to a dull blue-green...]', 3); await wait(1.8); flames.forEach((f, i) => f.material.color.set(cols[i])); caption('[...and returns to orange]', 2)
  await wait(3.4)
  { const sh = spawn('shadow', pos[0] + (pos[0] - p.pos.x) * 0.9, pos[1] + (pos[1] - p.pos.z) * 0.9, 0); sh.pose('sit'); caption('[a shadow sits across the fire, with no source]', 3); await G.until(() => G.auto || !lookedAway(sh.pos, 0.93), 9); G.removeActor(sh) }
  await wait(3)
  caption('[the stacked sticks shift, one at a time, as though something were slowly counting them]', 4); audio.rustle(pit.g.position, 0.6); await wait(4)
  { const q = around(5, -1.3, 0.2); audio.crack && audio.crack(q, 1); caption('[a branch snaps loudly to the left]', 2.4); G.horrorTurn(V(q.x, 1, q.z), 1.2, 0.5, 0.35); await wait(1.4) }
  await T('Hawa kahan hai bhai?', 'Where is the wind, brother?', { dur: 2 }); caption('[when he sits back down, the branch lies across his own shoe]', 3.4); await N('...Haan.', '...Yes.', { dur: 1.4 })
  await wait(3)
  G.horrorTurn(V(pos[0] - 8, 1.4, pos[1] - 6), 3.5, 1.1, 0.15)
  await say('Mummy', 'Nishaan... aag se door aaja beta... thand lag jayegi...', 'Nishan... come away from the fire, beta... you will catch a chill...', { pos: V(pos[0] - 8, 1.4, pos[1] - 6), id: 'awaaz_1', dur: 4.4 })
  await N('Mummy?', 'Mummy?', { dur: 1.4 })
  await T('Bhai, hilna mat. Ye mummy nahi hai. Hum unhe bata ke aaye the.', 'Do not move. That is not Mummy. We told her we would be back.', { dur: 3.6 })
  await wait(3)
  audio.payal && audio.payal(pit.g.position, 0); caption('[an anklet jingles once near the fire. A small, faint footprint has appeared in the ash]', 5)
  G.horrorTurn(V(pos[0] + 0.5, 0.1, pos[1] - 0.3), 2.4, 0.8, 0.1)
  { const fp = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), new THREE.MeshBasicMaterial({ color: '#141210', transparent: true, opacity: 0.8 })); fp.rotation.x = -Math.PI / 2; fp.scale.set(0.7, 1.2, 1); fp.position.set(pos[0] + 0.5, 0.045, pos[1] - 0.3); L.add(fp); L.refs.ashPrint = fp }
  await wait(3.4)
  caption('[a whisper rides inside the crackle of the fire itself: "Mat jao."]', 4); await wait(3.4)
  pit.fuel = Math.min(pit.fuel, 55); caption('[the fire dims on its own. The wood you pick up to feed it feels faintly damp now, though it was dry a minute ago]', 5); await wait(4)
  await T('Hum bhi yahin the.', 'We were here too.', { voice: false, dur: 2.4 })
  await N('...Nishant? Tune kuch bola?', '...Nishant? Did you say something?', { dur: 2 })
  await T('Maine kuch bola?', 'Did I say something?', { dur: 1.6 })
  await N('...Nahi.', '...No.', { dur: 1.4 })
  reveal('steps', 'payal')
  // ---- HOW IT ENDS ----
  fear(0.55)
  if (choice === 0) {
    pit.fuel = 6; await wait(5)
    caption('[the fire shrinks to a dull red glow. The footsteps stop completely. No rain, no wind. Something tall and motionless stands at the very edge of the firelight, twelve steps away, visible only when the fire flickers]', 8)
    const tl = spawn('tall', pos[0] - 8, pos[1] + 8, 0.8); G.horrorTurn(tl.pos, 2.6, 1.4, 0.2); await wait(2.6); G.removeActor(tl)
    audio.crack && audio.crack(pit.g.position, 1); fire._out(pit); pit.ember.visible = false
    caption('[a single dry crack, and the fire goes out all at once. No smoke. No embers. As if a hand had simply covered it]', 5)
    await N('Nikalna padega. Abhi.', 'We have to go. Now.', { dur: 2.2 })
  } else if (choice === 1) {
    G.brand = true; G.torch.color.set('#ff9a46'); G.torchOn = true
    await T('Aag peeche kyun ja rahi hai?', 'Why is the flame pointing backward?', { dur: 2.6 }); await N('Hawa hai shayad.', 'The wind, maybe.', { dur: 1.6 }); await T('Hawa aage se aa rahi hai.', 'The wind is coming from the front.', { dur: 2.2 })
    fire._out(pit)
  } else {
    L.setLight(true); caption('[far off between the bamboo stalks, a steady orange glow appears. Unflickering, unlike any fire]', 5)
    await N('Aag hilti hai. Ye diya hai, ya lantern.', 'A fire flickers. This is a lamp or a lantern.', { dur: 3.2 })
    fire._out(pit); caption('[you put your fire out carefully with sand and stream water]', 3.4)
  }
  G.noBuild = false; G.torchOn = true
  caption('[in every path, Nishan tucks a fragment of the burnt stick into his pocket. It stays warm for an unusually long time]', 5)
  c.mode = 'follow'; p.canMove = true; G.hasSignal = false
  // ---------------- CHAPTER 7: THE VILLAGE THAT RETURNS (same ground, no cut) ----------------
  await wait(1.6)
  ui.titleCard('CHAPTER 7', 'The village that returns', '9:15 PM', 3.2)
  setTime(21.25, 0, false, true); G.clockRate = 3; G.env.set('rain')
  if (!L.mirage.group.visible) L.setLight(true)
  const OUT = L.trails.find(t => t.name === 'out').pts
  ui.objective('Door ki roshni ki taraf chalo · Walk towards the far glow')
  await goTrail(OUT, 34)
  L.mirage.placeAhead(48)
  G.horrorTurn(L.mirage.group.position, 2.4, 1.3, 0)
  await T('Bhai, gaon!', 'Brother, a village!', { dur: 1.8 })
  await N('Ruk. Door se dekh pehle.', 'Wait. Look from far first.', { dur: 2 })
  c.look(L.mirage.group.position)
  caption('[about twenty houses of mud, stone and tin. A narrow lane, a well, a banyan tree. No smoke rising. No dogs. No cattle. No electric poles, no wires strung between roofs]', 9)
  await wait(5)
  await N('Pole bhi nahi hai. Ek tar bhi nahi.', 'No poles. Not a single wire.', { dur: 2.6 })
  await T('Mujhe achha nahi lag raha.', 'I do not like it.', { dur: 2 })
  c.look(null)
  L.mirage.auto = true; L.mirage.travel = 0
  ui.toast('Ulta chalo, gaon ke peeche', 4)
  ui.objective('Gaon ki taraf peeth karke chalo · Turn your back on it and walk')
  await gate(() => L.mirage.count >= 1, () => L.mirage.relocate(), 0)
  await T('Aath minute baad... phir gaon aage hai.', 'Eight minutes later, the village is ahead again.', { dur: 3 })
  ui.toast('Ab baayen mudo · Try turning left', 3.6); L.mirage.travel = 0
  await gate(() => L.mirage.count >= 2, () => L.mirage.relocate(), 0)
  await N('Baayen mude, phir bhi aage. Alag disha se.', 'We turned left. Still ahead of us. From a new direction.', { dur: 3.4 })
  ui.toast('Ek baar aur koshish karo · One more direction', 3.6); L.mirage.travel = 0
  await gate(() => L.mirage.count >= 3, () => L.mirage.relocate(), 0)
  G.batteryOverride = 40; audio.clang(P().pos, 1.6); caption('[the phone\'s battery drops suddenly to 40%. A single distant bell rings once]', 5)
  reveal('light', 'again')
  await N('Do hi raaste hain. Jungle mein ghoomte rahein, ya gaon mein jaayein.', 'There are only two ways. Keep wandering the forest, or go in.', { dur: 4 })
  await T('Kam se kam chhat toh milegi.', 'At least there will be a roof.', { dur: 2.4 })
  L.mirage.auto = false
  const enter = await choose('Gaon mein jaayein?', ['Haan, andar chalte hain', 'Ek aur disha try karte hain'], 0)
  if (enter === 1) { G.env.set('storm'); await T('Bhai, aasman aur kaala ho gaya hai. Hum andar hi chalte hain.', 'The sky is even darker. We are going in.', { dur: 3.6 }) }
  ui.toast('Gaon ki taraf chalo · Walk to the village', 4)
  L.mirage.placeAhead(46); L.mirage.show(true)
  await goTrail(OUT, trailLen(OUT) - 4)
  await endScene(1.4)
}
