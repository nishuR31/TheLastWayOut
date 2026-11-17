// Chapter 1: A normal day. Home -> ride.
import { items } from '../core/items.js'

import { baseGoal, G, caption, choose, ui, audio, THREE, N, T, say, wait, load, startScene, endScene, setTime, compHold, compFollow, reveal, reach, fear, use, gate, snapTo, go } from './helpers.js'

export async function ch1(s) {
  G.clockRate = 0
  setTime(10.25, 0, false, true); G.sparePlug = false; G.tankFull = false; G.money = 0; G.hasTiffin = false; G.petrol = false; G.brand = false; G.photos = 0; G.batteryOverride = 0; G.matches = 0; G.photos = 0
  const L = await load('road', { home: true }, { dx: 1.4, dz: 1.2 })
  const H = L.house, c = G.comp
  c.place(...H.local(2.4, 0, -1.6).toArray().filter((v, i) => i !== 1), Math.PI)
  c.pose('sit'); c.mode = 'hold'; c.holdPos = null
  const mom = G.addActor('mother'); const mp = H.local(-3.1, 0, -1.4); mom.place(mp.x, mp.z, 0.5); mom.sfx = false
  mom.P.setPose('stand')
  G.clockRate = 30
  // ---- opening shot: the ceiling fan turning, a slow drift across the room, then down to Nishan's own eyes (Space skips) ----
  const p0 = G.player; p0.canMove = false; p0.canLook = false
  const fanP = H.local(0, 2.95, 0.5), friend = H.local(2.4, 1.0, -1.6), tbl = L.refs.homeTable
  const eye = new THREE.Vector3(p0.pos.x, p0.eyeH, p0.pos.z), V3 = (x, y, z) => new THREE.Vector3(x, y, z)
  await startScene(0.2)
  ui.titleCard('THE LAST WAY OUT', 'Ek aam din', '10:15 AM · Sunday', 5.2)
  try {
    await G.shot({ from: fanP.clone().add(V3(0.35, -0.55, 1.1)), to: H.local(1.0, 2.0, 2.2), lookFrom: fanP, lookTo: friend, dur: 4.2, fov: 52, fov1: 62 })
    await G.shot({ from: H.local(1.0, 2.0, 2.2), to: eye, lookFrom: friend, lookTo: V3(tbl.x, 0.9, tbl.z), dur: 3.4, fov: 62, fov1: G.cfg.fov || 70 })
  } finally { G.endShot(); p0.canMove = true; p0.canLook = true }
  await wait(0.8)
  ui.toast('WASD — chalo · Mouse — dekho · E — baat / use', 5)
  // 1. talk to Mummy
  ui.objective('Mummy se baat karo · Talk to Mummy')
  const t1 = use(H.local(-2.6, 1.2, -0.9), 'Mummy se baat karo', { r: 3.2, cone: 0.1 })
  await t1
  mom.face(G.player.pos); mom.look(G.camera.position)
  await N('Mummy, hum Nishant ke saath thoda ghoomne ja rahe hain.', 'Mom, Nishant and I are going out for a ride.')
  await say('Mummy', 'Jao, lekin shaam hone se pehle aa jaana. Zyada der mat karna.', 'Go, but be back before evening. Don\'t be late.')
  await N('Shaam tak aa jayenge. Zyada late nahi hoga.', 'Back by evening. Won\'t be late.')
  await say('Mummy', 'Helmet pehenna, dhyaan se chalana. Aur phone charged rakhna.', 'Wear your helmets, ride carefully. And keep your phone charged.')
  G.hasTiffin = true; ui.toast('Mummy ne biscuit ka tiffin diya 🍪 (I — inventory)', 3.4)
  await N('Theek hai.', 'Okay.')
  mom.look(null); mom.face(null)
  // 2a. the phone lies on the kitchen table, the scooter key hangs on a nail by the wall (E at either; E at any table or hook leaves them again)
  items.stageHome(G, L.refs.homeTable.x, L.refs.homeTable.z)
  ui.objective('Phone (mez par) aur scooter ki chabi (deewar ke hook par) jeb mein rakh lo · Take your phone (table) and key (wall hook)')
  ui.toast('E — mez se phone, deewar ke hook se chabi', 5)
  ui.toast('P — phone nikalo, F — torch · B — scooter start/band', 5)
  // 2. helmets: taken from the rack with E. Nothing forces it; if you step out without anything, Mummy calls once
  const takeHelmet = () => { G.hasHelmet = true; audio.clang(L.refs.helmetPos, 0.5); if (L.refs.rack) L.refs.rack.userData.helmets.forEach(h => { h.visible = false }); ui.toast('Dono helmet le liye 🪖 · Took both helmets', 2.6) }
  G.hasHelmet = false
  G.addInteract({ pos: L.refs.helmetPos, label: 'Helmet utha lo · Take the helmets', r: 3.2, cone: -1, key: 'E', once: true, onUse: takeHelmet })
  ui.objective('Phone (mez), chabi (hook) aur helmet (rack) le lo · Take your phone, key and helmets')
  ui.toast('E — phone, chabi, helmet uthao', 4)
  c.mode = 'follow'; c.pose('stand')
  // stepping out without something: Mummy calls once, naming exactly what was forgotten
  await gate(() => !H.inside(G.player.pos.x, G.player.pos.z) && G.player.pos.z > 3.6, () => snapTo(0.6, 4.6), 0)
  const missing = () => { const m = [], e = []; if (!G.hasPhone) { m.push('phone'); e.push('phone') } if (!G.hasKey) { m.push('scooter ki chabi'); e.push('scooter key') } if (!G.hasHelmet) { m.push('helmet'); e.push('helmets') } return { hi: m.join(' aur '), en: e.join(' and '), n: m.length } }
  if (missing().n) {
    const w = missing()
    await say('Mummy', `Nishan! Tu ${w.hi} bhool gaya! Andar aake le ja!`, `Nishan! You forgot your ${w.en}! Come and get it!`, { pos: mom.pos, dur: 3.6 })
    ui.objective(`Bhool gaye: ${w.hi} · Forgot: ${w.en}`)
    await gate(() => G.hasPhone && G.hasKey && G.hasHelmet, () => { items.giveAll(G); if (!G.hasHelmet) takeHelmet() }, 0, [L.refs.homeTable.x, L.refs.homeTable.z, 'Jo bhool gaye wo utha lo · Pick up what you forgot'])
    await say('Mummy', 'Ab theek hai. Dhyaan se jaana.', 'There. Now go safely.', { pos: mom.pos, dur: 2.4 })
    await gate(() => !H.inside(G.player.pos.x, G.player.pos.z) && G.player.pos.z > 3.6, () => snapTo(0.6, 4.6), 0)
  }
  await T('Chal, chal. Sab set? Petrol bhi full karwaya tha kal.', 'Come on. All set? Filled up the tank yesterday.')
  await N('Haan, bas thoda ghoomke aate hain.', 'Yeah, just a little roam.')
  ui.objective('Bahar chacha apni bike theek kar rahe hain, unse baat karo · Talk to Chacha outside')
  const ch = L.refs.chacha
  ui.toast('Bahar nikalo, chacha se E — baat karo', 4)
  await use(L.refs.chachaPos, 'Chacha se baat karo', { r: 3.4, cone: -1 })
  ch.P.setPose('stand'); ch.P.crouch = 0; ch.face(G.player.pos); ch.look(G.camera.position)
  await say('Chacha', 'Arre Nishan, Nishant! Helmet pehen ke kahan chale?', 'Hey Nishan, Nishant! Helmets on, where are you two off to?', { pos: ch.pos })
  await N('Bas ghoomne, chacha. Ek jungle ki taraf, ek achhi jagah hai.', 'Just out for a ride, uncle. A nice spot near the forest.')
  await say('Chacha', 'Jungle? Theek hai, par shaam tak aa jaana. Ye le, kuch paise rakh le.', 'The forest? Fine, but be back by evening. Here, keep some money.', { pos: ch.pos })
  audio.clang(ch.pos, 0.2); G.money = 500; ui.toast('Chacha ne paise diye ₹500 · Chacha gave you some money', 3)
  await say('Chacha', 'Sambhal ke jaana. Aur time se aa jaana.', 'Ride safe. And come back on time.', { pos: ch.pos })
  await N('Ji chacha, shaam tak aa jayenge.', 'Yes uncle, we\'ll be back by evening.')
  ch.look(null); ch.face(null); ch.P.setPose('rub'); ch.P.crouch = 0.55
  // optional: Chacha's open toolbox has a spare, dry spark plug (matters on the cold night in the forest)
  G.addInteract({ pos: new THREE.Vector3(1.6, 0.3, 7.2), label: 'Chacha ka toolbox dekho', r: 2.6, cone: -1, key: 'E', once: true, onUse: () => { (async () => {
    ch.P.setPose('stand'); ch.P.crouch = 0; ch.face(G.player.pos)
    await say('Chacha', 'Ye? Spare plug hai, bike ka. Kabhi kabhi plug hi dhokha de deta hai beech raaste mein.', 'This? A spare spark plug for the bike. Sometimes the plug itself lets you down halfway.', { pos: ch.pos })
    await N('Chacha, wo de do na. Rakh lete hain.', 'Chacha, give it to us. We will keep it.')
    await say('Chacha', 'Ye lo. Dhyaan se. Sab kuch maangta hai tu.', 'Here. Careful. You ask for everything.', { pos: ch.pos })
    G.sparePlug = true; audio.click(); ui.toast('Spare spark plug mil gaya 🔧 · Got a spare spark plug', 3.6)
    ch.face(null); ch.P.setPose('rub'); ch.P.crouch = 0.55
  })().catch(() => {}) } })
  // (the scooter is parked on the veranda, inside the gate)
  ui.objective('Veranda mein khadi scooter ke paas jao · Go to the scooter on the veranda')
  // 4. scooter (B or E near it) and then ONE long road: the lane flows into the highway; stop, talk and eat along it
  const sc = G.scooter, proj = L.projDist
  await use(sc.chassis.position, 'Scooter start karo (B)', { r: 3.2 })
  audio.init()
  G.rideHint = 'W — aage · A/D — mudo · Space — brake · B — utro, kahin bhi ruko'
  G.mount(sc); setTime(10.5, 0, false, true); G.clockRate = 22
  G.rideMax = 11
  ui.titleCard('CHAPTER 2', 'The Ride', '10:30 AM', 3)
  ui.objective('Sadak par chalo. Raaste mein ruko, khao, baatein karo (B se utro) · Follow the road. Stop, eat, talk along the way (B to get off)')
  await wait(0.4)
  await T('Chal chal, nikal.', 'Come on, let us go.', { dur: 1.8 })
  const P = () => proj(sc.chassis.position.x, sc.chassis.position.z)
  // optional stops along the road (get off with B, then E)
  let busy = false; const done = new Set(); let lunch = false
  const act = (id, pos, label, fn, r = 9) => G.addInteract({ pos, label, r, cone: -1, key: 'E', once: false, enabled: () => !busy && !done.has(id), onUse: () => {
    if (busy || done.has(id)) return; busy = true; const pp = G.player; pp.canMove = false
    ;(async () => { try { await fn(); done.add(id) } finally { busy = false; pp.canMove = true } })().catch(e => { if (e !== 'abort') console.error(e) })
  } })
  act('selfie', L.refs.jam, 'Selfie lo (jam mein)', async () => {
    await T('Ruk, ek second. (selfie leta hai, dono ke helmet ek frame mein)', 'Wait a second. (takes a selfie, both helmets crammed into frame)', { dur: 3.4 })
    audio.click(); G.photos = (G.photos || 0) + 1; ui.toast('Selfie 📷 · "Last ride before the adventure."', 3)
    await T('Ye photo ban gayi. "Last ride before the adventure."', '"Last ride before the adventure."', { dur: 2.8 })
    await N('Adventure? Hum bas ek jungle ja rahe hain.', 'Adventure? We are just going to a forest.', { dur: 2.6 })
    await T('Adventure bol ke dekh. Sab sahi lagta hai.', 'Say "adventure". Everything sounds better.', { dur: 2.6 }); setTime(Math.max(G.time, 11.1), 0, false, true); G.clockRate = 22
  })
  act('pump', L.refs.pump, 'Petrol pump: tank full karwao?', async () => {
    await T('Bhai, yahin tank full karwa le.', 'Fill the tank right here.', { dur: 2.2 })
    const fill = await choose('Tank full karwayein?', ['Haan, full karwa lo', 'Nahi, half bahut hai'], 1)
    G.tankFull = fill === 0
    if (fill === 0) { audio.click(); ui.toast('Tank full ⛽ · aage kaam aayega', 3); await N('Chal theek hai. Poora bhar do.', 'Fine. Fill it up.', { dur: 2 }) }
    else { await N('Half bahut hai.', 'Half is plenty.', { dur: 1.6 }); await T('Tu hamesha yahi bolta hai.', 'You always say that.', { dur: 2 }) }
    setTime(Math.max(G.time, 11.4), 0, false, true); G.clockRate = 22
  })
  act('tyre', L.refs.tyre, 'Puncture shop: hawa check karwao', async () => {
    await say('Dukaandar', 'Hawa free hai bhaiya. Aage jungle ka raasta kachha hai, tyre check kara lo.', 'Air is free. The forest road ahead is rough, get the tyres checked.', { pos: L.refs.tyreMan.pos, dur: 4 })
    await N('Theek hai chacha, ek baar dekh lo.', 'Okay uncle, have a look.', { dur: 2 }); audio.click(); ui.toast('Tyre ki hawa theek 🛞', 2.4)
  })
  act('temple', L.refs.temple, 'Mandir: ghanti bajao', async () => {
    audio.clang && audio.clang(L.refs.temple, 1.4); caption('[the bell, tied in red cloth, rings out over the fields]', 3)
    await N('(haath jodkar) Bhagwan, sab theek rakhna.', '(folding his hands) Keep us safe.', { dur: 2.6 })
    await T('Arre itna serious kyun? Hum bas ghoomne ja rahe hain.', 'Why so serious? We are only going for a ride.', { dur: 3 })
  })
  // the dhaba is the real lunch stop (1:00 PM). Nishant's cousin's tip about the campsite lives here.
  act('dhaba', L.refs.dhabaTable, 'Dhaba: khana khao (paratha, lassi)', async () => {
    setTime(13.0, 0, false, true); G.clockRate = 14
    const dm = L.refs.dhabaMan
    await say('Dhabewala', 'Aao aao, baitho! Garam paratha, thandi lassi!', 'Come in, sit! Hot parathas, cold lassi!', { pos: dm.pos, dur: 3 })
    await N('Do paratha, do lassi, extra achaar.', 'Two parathas, two lassis, extra pickle.', { dur: 2.6 })
    caption('[parathas, two lassis and a bowl of pickle land on the table. The old transistor plays something scratchy and cheerful]', 5)
    await wait(2.4); audio.click()
    await T('Mere cousin ne ek spot bataya tha. Camp site, jungle ke andar. Chhota jharna bhi hai, aur ek bamboo ka jhund.', 'My cousin told me about a spot. A campsite deep in the forest. A small stream, and a bamboo grove.', { dur: 5.4 })
    await N('Wo jo drone chalata hai?', 'The one who flies the drone?', { dur: 1.8 })
    await T('Haan wahi. Bol raha tha ghane jungle mein jaane ki zarurat nahi, bas camp site tak jao, wahin se sab dikh jata hai.', 'Yes. He said no need to go deep, just get to the campsite; you see everything from there.', { dur: 5.4 })
    await N('Theek hai, wahin chalte hain.', 'Fine, we go there.', { dur: 2 })
    await T('Aur wapas aate waqt, yahin paratha round two. Promise?', 'And on the way back, paratha round two right here. Promise?', { dur: 3.2 })
    await N('Pakka.', 'Promise.', { dur: 1.2 })
    lunch = true; setTime(13.4, 0, false, true); G.clockRate = 22
    ui.objective('Sadak ke aakhir tak, jungle ke mod par · Ride on to the forest turn')
  })
  // beats along the road
  await gate(() => P() > 60, () => rsnap(L, 60), 0)
  await T('(gaata hai, besura)', '(sings, off-key)', { voice: false, dur: 1.8 })
  await N('Bhai, teri awaaz se jungle ke janwar bhaag jaayenge.', 'Your voice will make the jungle animals run.', { dur: 3 })
  await T('Isiliye toh jungle chun raha hoon. Wahan koi complaint nahi karega.', 'That is why I picked the jungle. No complaints there.', { dur: 3.2 })
  await gate(() => P() > 120, () => rsnap(L, 120), 0)
  await N('Petrol dalwaya tha na kal?', 'Did you fill up yesterday?', { dur: 2 })
  await T('Haan, half tank hai.', 'Yes, half a tank.', { dur: 1.8 })
  await N('Half? Aur agar wapas aate waqt khatam ho gaya?', 'Half? And if it runs out on the way back?', { dur: 2.6 })
  await T('Toh tu dhakka lagayega.', 'Then you will push.', { dur: 1.8 })
  await gate(() => P() > 190, () => rsnap(L, 190), 0)
  caption('[a jammed crossing. A stuck truck. A constable whistling uselessly at nobody in particular. School kids crossing badly. Heat haze off the tarmac]', 6)
  ui.toast('Jam hai. B se utro aur selfie lo (E), ya nikal jao', 4)
  await gate(() => P() > 262, () => rsnap(L, 262), 0)
  setTime(Math.max(G.time, 11.3), 0, false, true)
  ui.toast('Petrol pump aa gaya. Chaho toh B se utro, tank full karwao', 4)
  await gate(() => P() > 378, () => rsnap(L, 378), 0)
  caption('[a puncture shop, a pile of old tyres; further on, a roadside temple with a bell tied in red cloth]', 5)
  await gate(() => P() > 540, () => rsnap(L, 540), 0)
  if (!lunch) { ui.objective('Dhaba par ruko (B), khana khao (E) · Stop at the dhaba and eat'); ui.toast('Dhaba aa gaya! B se utro, khana khao', 5) }
  await gate(() => lunch || P() > 610, () => { lunch = true }, 0, !lunch ? [L.refs.dhabaPark.x, L.refs.dhabaPark.z, 'Dhaba par ruko aur khana khao · Stop at the dhaba'] : undefined)
  if (!lunch || !done.has('dhaba')) { lunch = true; await T('Mere cousin ne ek camp site bataya tha. Jhaarna aur bamboo ka jhund. Chalo wahin.', 'My cousin told me about a campsite, with a stream and a bamboo grove. Let us go there.', { dur: 4.4 }) }
  G.interacts = G.interacts.filter(i => i.label && i.label.startsWith('Dhaba') === false)
  ui.objective('Sadak ke aakhir tak, jungle ke mod par · Ride on to the forest turn')
  baseGoal(L.refs.edge.x, L.refs.edge.z, 'Jungle ke mod tak · To the forest turn', L.pts, L.roadLen - 75)
  await gate(() => P() > L.roadLen - 100, () => rsnap(L, L.roadLen - 100), 0)
  setTime(14.25, 0, false, true)
  caption('[fields give way to trees. The temperature drops a few degrees in a minute. A mossy signboard: "JUNGLE RESERVE. ENTRY ALLOWED TILL 5:00 PM."]', 6)
  await T('Paanch baje tak entry hai.', 'Entry is till five.', { dur: 2 })
  await N('Hum chaar tak wapas nikal jayenge. Aaram se.', 'We will be out by four. Easily.', { dur: 2.4 })
  await T('Haan haan, chaar se pehle.', 'Yes yes, before four.', { dur: 1.8 })
  await gate(() => P() > L.roadLen - 30, () => rsnap(L, L.roadLen - 30), 0)
  while (busy) await wait(0.3)
  G.rideHint = null; ui.objective(null); G.goal = null
}

import { ptAt } from '../world/common.js'
const rsnap = (L, d) => { const q = ptAt(L.pts, d + 1); snapTo(q.x, q.z) }
// the ride is now part of ch1 (one continuous level); kept so older chapter lists still work
export async function ch1b(s) {}
