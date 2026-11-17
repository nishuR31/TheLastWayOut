// Chapters 5-8: deeper into the forest, the peepal + the light, the village, inside the house.
import { G, ui, audio, THREE, N, T, U, say, wait, load, startScene, endScene, setTime, compHold, compFollow, reveal, fear, tired, use, gate, snapTo, go, goTrail, trailD, trailLen, lookFor, lookedAway, focus, around, stepsAt, spawn, caption, enableTrail, pushOff, pushOn } from './helpers.js'
import { makeGlass } from '../world/people.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const P = () => G.player
// freeze the player's feet (not the camera) for the length of a scene
async function still(fn) { const p = P(); p.canMove = false; try { await fn() } finally { p.canMove = true } }

/* ------------------------------------------------------------------ CH 7 + 8 */
export async function ch7(s) {
  setTime(3.3, 0, false, true)
  const L = await load('village', {}, { dx: 1.2 })
  const H = L.house, c = G.comp, p = P()
  G.hasSignal = false; G.torchOn = true; G.env.set('still')
  await startScene(1.8)
  ui.titleCard('CHAPTER 7', 'Gaon', '3:20 AM', 3.4)
  G.clockRate = 6; fear(0.35); tired(0.85)
  await wait(1)
  // ANY door can be knocked on. Only one house (picked at random) ever opens: the uncle comes out of that one.
  const cand = [...(L.doorHouses || []), H]
  const pick = cand[Math.floor(Math.random() * cand.length)]
  const nk = new Map(); let answered = null, knocks = 0
  for (const hs of cand) {
    const kpos = hs === H ? L.refs.knock : hs.doorWorld
    G.addInteract({ pos: kpos, label: 'Darwaza khatkhatao', r: 3, cone: 0.2, key: 'E', once: false, onUse: () => {
      if (answered) return
      const n = (nk.get(hs) || 0) + 1; nk.set(hs, n); knocks++
      audio.knock(kpos, n > 1 ? 5 : 3, n > 1 ? 1.3 : 1); caption('[knock, knock]', 1.4); if (hs !== H) { L.flashEyes(hs); G.horrorTurn(V(hs.doorWorld.x, 1.7, hs.doorWorld.z), 0.5, 0.45, 0.1) }
      if (hs === pick && n >= 2) { answered = hs; return }
      if (knocks === 1) T('Koi nahi khol raha...', 'Nobody is opening...', { dur: 2 })
      else if (knocks === 3) N('Andar roshni hai. Fir bhi koi aawaz nahi.', 'There is light inside. Still no sound.', { dur: 2.6 })
      else if (knocks === 5) T('Koi toh hoga. Doosra ghar try karte hain.', 'Somebody must be home. Try another house.', { dur: 2.8 })
    } })
  }
  await N('Gaon hi hai. Ghar, gali, lalten.', 'It is a village. Houses, lanes, lanterns.', { dur: 3 })
  await T('Na khambe, na taar. Bijli nahi lagti yahan.', 'No poles, no wires. They don\'t seem to have electricity.', { dur: 3.2 })
  await gate(() => trailD(L.lanePts) > 20, () => snapTo(0, 22), 0, [0, 22, 'Gali mein aage chalo · Walk down the lane'])
  caption('[no traffic, no TV, no dogs - only the dripping of rain from the roofs]', 3.6)
  await wait(2)
  await N('Us khidki mein... kuch safed sa tha. Aankhon jaisa.', 'In that window... something white. Like eyes.', { dur: 3.2 })
  await T('Mat dekh. Pehle madad dhoondh.', 'Don\'t look. Find help first.', { dur: 2.4 })
  reveal('village', 'eyes')
  ui.toast('Kisi bhi ghar ka darwaza khatkhatao (E) · Knock on any door', 5)
  ui.objective('Madad ke liye kisi ghar ka darwaza khatkhatao · Knock on a door for help')
  await gate(() => !!answered, () => { answered = pick }, 0)
  ui.objective(null); pushOff(); G.noRun = false; c.mode = 'follow'
  await wait(2.2)
  // the uncle opens (whichever house it was)
  let din = L.refs.doorIn, dout = L.refs.doorOut, door = L.refs.knock
  if (pick !== H) { const f = { x: Math.sin(pick.rot), z: Math.cos(pick.rot) }; door = pick.doorWorld; din = { x: door.x - f.x * 1.0, z: door.z - f.z * 1.0 }; dout = { x: door.x + f.x * 1.6, z: door.z + f.z * 1.6 } }
  const un = spawn('uncle', din.x, din.z, Math.atan2(dout.x - din.x, dout.z - din.z))
  un.pose('stand'); un.face(dout)
  pick.setDoor(true); audio.door(door, true)
  await wait(2.2)
  un.look(G.camera.position)
  await U('Kaun hai? Itni raat ko?', 'Who is it? At this hour?', { pos: un.pos, dur: 2.6 })
  await N('Namaste uncle. Hum log raasta bhatak gaye hain.', 'Namaste, uncle. We\'ve lost our way.', { dur: 3 })
  await T('Jungle mein aa gaye the. Ab bahar nikalne ka raasta nahi mil raha.', 'We came into the forest. Now we can\'t find the way out.', { dur: 3.6 })
  await N('Phone mein network bhi nahi hai. Ghar pe bata nahi paaye.', 'There\'s no phone network either. We couldn\'t tell home.', { dur: 3.6 })
  if (pick === H) {
    await U('Andar aao. Pehle baitho. Bahar bahut baarish hai.', 'Come in. Sit first. It is raining hard outside.', { pos: un.pos, dur: 3.4 })
    un.look(null)
  } else {
    await U('Yeh mera ghar nahi, main yahan baitha tha. Mera ghar gali ke aakhir mein hai. Chalo, wahan baithte hain.', 'This isn\'t my house, I was just sitting here. Mine is at the end of the lane. Come, we\'ll sit there.', { pos: un.pos, dur: 5 })
    un.look(null); ui.toast('Uncle ke peeche chalo · Follow the uncle', 4)
    un.walkTo(L.refs.doorOut.x, L.refs.doorOut.z, 1.5)
    await gate(() => G.distToPlayer(L.refs.doorOut.x, L.refs.doorOut.z) < 4.5, () => snapTo(L.refs.doorOut.x, L.refs.doorOut.z - 3), 0, [L.refs.doorOut.x, L.refs.doorOut.z, 'Uncle ke ghar tak · To the uncle\'s house'])
    un.place(L.refs.doorOut.x, L.refs.doorOut.z, Math.atan2(L.refs.doorIn.x - L.refs.doorOut.x, L.refs.doorIn.z - L.refs.doorOut.z))
    H.setDoor(true); audio.door(L.refs.knock, true)
    await U('Andar aao. Pehle baitho. Bahar bahut baarish hai.', 'Come in. Sit first. It is raining hard outside.', { pos: un.pos, dur: 3.4 })
  }
  // ---------------- CH 8: inside
  ui.toast('Andar chalo', 3)
  un.walkTo(L.refs.uncleSpot.x, L.refs.uncleSpot.z, 1.2)
  await gate(() => H.inside(p.pos.x, p.pos.z), () => snapTo(L.refs.doorIn.x, L.refs.doorIn.z), 0, [L.refs.doorIn.x, L.refs.doorIn.z, 'Ghar ke andar chalo · Go inside'])
  await wait(0.5)
  ui.titleCard('CHAPTER 8', 'Ghar ke andar', '3:30 AM', 3)
  G.clockRate = 5
  const dg = spawn('daughter', L.refs.daughterSpot.x, L.refs.daughterSpot.z, Math.PI * 0.7)
  c.mode = 'hold'; c.holdPos = { x: L.refs.sit1.x, z: L.refs.sit1.z }
  un.face(p.pos)
  await wait(2.4)
  p.canMove = false
  await U('Ye meri beti hai. Maa isse bachpan mein chhod gayi... ek bimari mein.', 'This is my daughter. Her mother passed away... after an illness.', { pos: un.pos, dur: 4 })
  await N('Maaf kijiye uncle.', 'I\'m sorry, uncle.')
  await T('Yahan aas-paas koi doctor ya hospital hai kya?', 'Is there a doctor or hospital nearby?', { dur: 2.8 })
  await U('Nahi beta. Sabse paas ka shehar bahut door hai.', 'No, son. The nearest town is very far.', { pos: un.pos, dur: 3 })
  await N('Aur bijli? Phone?', 'And electricity? Phones?', { dur: 2 })
  await U('Gaon mein gine-chune phone hain. Bijli ke taar jungle se laane mein bahut dikkat thi - board waale maane nahi.', 'Very few phones in the village. Bringing power lines through the forest was a problem - the board never agreed.', { pos: un.pos, dur: 5.4 })
  await U('Humne kam mein jeena seekh liya. Bahar waale technology ke naam par jungle ko nuksaan hi dete dekhe hain.', 'We learned to live with less. We have seen outsiders only harm the forest in the name of technology.', { pos: un.pos, dur: 5.6 })
  await T('...', '(Nishant glances at you. The man hasn\'t done anything wrong.)', { voice: false, dur: 2.8 })
  // the red sharbat
  await U('Tum dono bheeg gaye ho. Pehle kuch piyo, thand utar jaayegi.', 'You are both drenched. Drink something first, the chill will go.', { pos: un.pos, dur: 3.6 })
  dg.walkTo(L.refs.tray.x + 0.4, L.refs.tray.z + 0.6, 1.0)
  audio.pour(L.refs.tray, 1.4); caption('[liquid poured into glasses]', 2)
  await wait(2.4)
  const g1 = makeGlass(true), g2 = makeGlass(true)
  g1.position.set(L.refs.tray.x - 0.08, L.refs.tray.y, L.refs.tray.z); g2.position.set(L.refs.tray.x + 0.1, L.refs.tray.y, L.refs.tray.z + 0.04)
  L.group.add(g1, g2)
  p.canMove = true
  dg.face(null)
  ui.toast('E — gilaas uthao', 4)
  await use(L.refs.tray, 'Sharbat lo', { r: 3.2, cone: -1 })
  g1.visible = false; g2.visible = false
  p.canMove = false
  await wait(0.5); audio.gulp(3); c.pose('drink'); await wait(2.4); c.pose('stand')
  const e1 = makeGlass(false), e2 = makeGlass(false); e1.position.copy(g1.position); e2.position.copy(g2.position); L.group.add(e1, e2)
  await T('Accha laga. Garm sa.', 'That was good. Warming.', { dur: 2.2 })
  await N('Shukriya uncle.', 'Thank you, uncle.', { dur: 1.8 })
  if (s.fire && s.fire.made) {
    await U('(Nishan ki jeb ki taraf dekhkar) Aag jalayi thi?', '(looking at Nishan\'s pocket) You lit a fire?', { pos: un.pos, dur: 3 })
    await N('Haan uncle. Bike ke plug se.', 'Yes, uncle. With the bike\'s spark plug.', { dur: 2.4 })
    await U('Aag achhi cheez hai. Par aag ko yahan lekar mat aana.', 'Fire is a good thing. But do not bring fire here.', { pos: un.pos, dur: 3.6 })
    await N('Kyun?', 'Why?', { dur: 1.2 })
    await U('Bas aise hi. Chai peeyoge?', 'No reason. Will you have tea?', { pos: un.pos, dur: 2.4 })
    reveal('drink')
  }
  // the request
  await N('Uncle, aapke paas phone hai? Hum ghar par bata dein.', 'Uncle, do you have a phone? We need to tell home.', { dur: 3.2 })
  await U('Phone toh kisi ke paas nahi hai abhi.', 'Nobody has a phone available right now.', { pos: un.pos, dur: 2.6 })
  await N('Uncle, aap humein abhi road tak chhod dijiye. Ghar pe sab pareshan ho rahe honge.', 'Uncle, please take us to the road now. Everyone at home will be worried.', { dur: 4.4 })
  await U('Itni raat ko jungle ka raasta theek nahi hai. Subah chale jaana.', 'The forest path at this hour is not good. Go in the morning.', { pos: un.pos, dur: 3.8 })
  await T('Lekin ghar pe kisi ko pata nahi hum kahan hain.', 'But nobody at home knows where we are.', { dur: 3 })
  await U('Aaj raat yahin ruk jao. Subah main khud chhod dunga.', 'Stay here tonight. I\'ll take you myself in the morning.', { pos: un.pos, dur: 3.6 })
  await N('Nahi uncle, please. Abhi jaana zaroori hai.', 'No uncle, please. We have to go now.', { dur: 3 })
  await wait(1)
  tired(0.95)
  await T('Yaar... kitni thakaan ho rahi hai. Pair bhaari ho gaye.', 'Man... so tired. My legs feel heavy.', { dur: 3 })
  await N('Bheeg ke aaye hain, thand lagi hogi. Chalna padega.', 'We came soaked, it\'s the cold. We have to move.', { dur: 3 })
  await wait(0.8)
  await U('Theek hai. Main khud chalta hoon tumhare saath. Do dost ko bhi bula leta hoon.', 'All right. I\'ll come with you myself. I\'ll call two friends too.', { pos: un.pos, dur: 4 })
  await U('Beta, tum aaj ek galti kar rahe ho.', 'Child, you are making a mistake tonight.', { pos: un.pos, dur: 3 })
  await T('Kaisi galti?', 'What mistake?', { dur: 1.6 })
  await U('(muskurakar) Kuch nahi. Chalo.', '(smiling) Nothing. Come.', { pos: un.pos, dur: 2 })
  await say('Beti', 'Jaldi aana.', 'Come back soon.', { pos: dg.pos, dur: 2 })
  await N('Kya?', 'What?', { dur: 1.2 })
  await say('Beti', 'Kuch nahi.', 'Nothing.', { pos: dg.pos, dur: 1.6 })
  p.canMove = true
  await wait(1.2)
  await endScene(1.8)
}
