# BUGS / STATUS (honest)

## FIXED — performance / playability pass (2026-11-18)
Profiled live with CDP (`render` + `G.step` wrapped, CPU sampling profiler):
- Frame time was almost entirely rendering (~10.4 s/frame under SwiftShader);
  game logic was only ~5 ms. Build of the `road` level took ~19 s.
- `src/game.js`: camera far plane 1200→600 m (fog already hides >200 m, horizon
  silhouette is at 430 m); default graphics profile made cheaper — med pixel
  ratio 0.85→0.7, density 0.8→0.65, shadows only on `high`, alpha-tested foliage
  cards hidden on `low`; `setGfx()` only recompiles shaders when shadows actually
  change (was recompiling every material on every quality change).
- Added a one-shot FPS watchdog: a single >250 ms frame (or a 3 s window below
  20 fps) drops resolution/overdraw via `G.dropQuality()` and toasts the player;
  Settings can restore any tier.
- `src/world/nature.js`: cheap AABB reject before the 73-segment polyline
  projection in `scatterForest`, and undergrowth count 0.09→0.06 of area.
- Measured after: build 19.3 s→15.9 s, draw calls 2059→1755, triangles
  2.11 M→1.59 M, watchdog engages and switches to `low` with no errors.
- Note: absolute frame times above are from a CPU-only software WebGL
  environment; a real GPU is much faster, but the reduced draw calls / far
  plane / overdraw help everywhere.

## FIXED — visual walkthrough bugs (2026-11-18, bedroom / opening scene)
Reproduced live in a headless CDP walkthrough (`?dev=1`, real New Game + real key events).
- **Trees growing inside the house**: `src/levels/road.js` `side()` returned the
  fallback `{x:0,z:0}` (the exact centre of the bedroom) whenever a decoration
  loop asked for a distance past the road's real length (~845.5 m) while the
  loops run to `d<860`. A banyan (`varietyTree`) and crops landed at world origin,
  its canopy clipping through the bed/ceiling. `side()` now clamps `d` to the
  road length and returns a point along the final segment instead of the origin.
  Verified after fix: 0 banyans / 0 props near the house.
- **Traffic car parked in the bedroom**: `src/world/traffic.js` made a vehicle
  visible during its initial `wait` while its position was still the default
  (0,0,0) — a green car body filled the first-person view. Vehicles now carry a
  `placed` flag; they are hidden until positioned on the road and hide again on
  respawn. Verified after fix: no vehicle clipping in the house.
- **"Wake up in bed" opening was a close-up of mattress/phone glass**: the shot
  started ~0.3 m from the phone. `src/story/act1.js` now opens at pillow height
  further back, looking at the lit phone before drifting out into the room, so
  the beat reads as waking up. (Curtained window, tiffin and two helmets by the
  bed are all in place from the previous pass.)
- Speed-breaker/marking and wall/partition issues reported earlier were already
  addressed (flat painted road lines; full-height interior partitions with a
  proper lintel). No further geometry changes were needed.
- Build: `npm run build` PASS (Vite 8, 2.06 s). Verified screenshots:
  `shots/verify-01-room.png` after the fixes (clean bedroom, no tree/car).

## CURRENT STATUS (authoritative — this section supersedes the dated history below)
- Build: `npm run build` passes on Vite 8. `npm audit`: **10 high advisories**, all from the unpatched upstream `picomatch` ReDoS (GHSA-fc5q-39xc-vjpf) via Vite 8 / electron-builder build tooling — dev-time only, not shipped, not reachable from gameplay. All earlier findings (critical tar, Electron, Vite server, minimatch) were fixed by pinning exact versions + `minimatch` override; no patched `picomatch` exists and npm's suggested Vite 6.2.7 downgrade just reintroduces older Vite advisories.
- Voice: **265 Hinglish + 265 English** clips in `public/voice/{hi,en}` (the older "243/240" figure below is stale). Three silent manifest entries are intentional stage directions.
- F3 debug overlay **is built** (the older "not built" note below is stale).
- AppImage/deb are **not built in this checkout** (the older "rebuilt" notes below refer to a previous environment). Run `npm run dist` to produce them.
- Dead/duplicated code removed: `src/story/act2.js`, `src/levels/forest.js`, and the unused `ch5`/`ch6` copies in `act3.js`. The dead `tts` setting path was removed.
- Hardening: Electron sandbox auto-detects a misconfigured `chrome-sandbox` helper and falls back to `--no-sandbox` with a warning; `corsEnabled` removed from the `app://` scheme, path containment uses `path.resolve`/`path.relative`, DevTools gated to unpackaged builds.
- New game starts with no phone/key/helmet (collected in Chapter 1 per the definitive script); `items.scan()` no longer re-grants them on level load. Chapter-select still starts equipped.
- Fixed the missing-key bug: `items.scan()` now sets `keyOn:true` on the hook. Phone, key and helmet stations are two-way: plain **E** takes, **Shift+E** puts back (a stray E can no longer silently drop the key / phone / helmet). The one-time helmet interact was removed. Verified live: E takes, E-again does nothing, Shift+E returns, and taking the phone never changes `hasKey`.
- Removed the always-visible bottom-left inventory strip (`#twigs`); the **I** inventory panel remains.
- Fixed items vanishing from BOTH world and pocket: `items.scan()` no longer wipes a placed phone on level change (it returns to the pocket), key/rack meshes are rebuilt from the flags on every scan, and `items.reconcile()` runs every frame plus after each interaction / level load to guarantee every item is in exactly one place. `giveAll()` is now idempotent (sets flags instead of toggling) so the story safety-net can never strip items regardless of pickup order; `stageHome()` no longer clears an already-held key. Verified live: both pickup orders, repeated safety-net calls, and a deliberately corrupted "nowhere" state.
- **Shift+B** hangs the helmet on the bike's rear holder (chin-strap mesh on the bike model) or takes it back; `helmetOnBike` persists across levels and reconcile keeps it exclusive with `hasHelmet`.
- Key remap: **C** = crouch, **X** = camera, **G** = push bike, **Shift+B** = helmet, **Shift+E** = put item back. Removed the old Shift+E crouch side-effect (C is now the only crouch key). Controls UI and README updated.
- `ui.reason()` shows blocked actions in **red with the reason** (CSS `#toast.reason`). Added `G.boardBlock()` / `G.pushBlock()` and wired reasons into bike riding/pushing, helmet, torch, crouch, running, fire-building, item placement, path/pit warnings. Verified live: dead bike → red "stuck in wet mud, push with G", then G pushes successfully; no-key → red "key is on the hook".
- Bike physics: speed ceiling 11→16 m/s, gentler high-speed steering, lower drag/coast brake to preserve momentum, straight-line yaw stabilisation and anti-spin in reverse. Verified 24 km/h in 5 s with straight tracking (yaw≈0).
- Left click = horn while riding; E = engine on/off. Kickstand mesh with animation: down when parked/dismounted/stopped pushing, up when mounted/pushing. Verified mount/dismount/push cycle.
- Cinematic camera beats added to the temple bell, petrol pump and dhaba scenes in Chapter 1; traffic honks on lane changes and pass-bys more often.
- Engine no longer auto-starts on mounting: **E** alone plays the ignition animation (start/stop), and the headlight follows engine state. Dismounting a running engine still plays the stop animation. Verified mount (off/no anim/light off) → E (on/light on) → E (off/light off).
- Top speed raised to ~150 km/h on road (road cap 42 m/s; off-road caps raised so it doesn't cliff-drop). Steering now uses lateral grip so the bike rotates about its axle instead of sliding diagonally; high-speed steering taper softened and momentum preserved. Sign textures auto-fit text and redraw when web fonts finish loading.
- Forest riding: night-forest trails widened 1.5→2.8 m and surface changed from `mud` to `dirt` (rideable), mud cap raised 12→18 m/s — no more tree-shoving resistance when turning.
- Human model rework after visual review of the character-select screenshot: the geometric face was buried inside the skull (blank face, bald-nub hair) and the round hip ball plus wide thigh capsules read as a crotch bulge. Fixed by reusing the proven painted-face canvas texture on a 22×16 head sphere, a partial-sphere hair cap that wraps the crown, a single tapered flat torso, a short flattened pelvis taper, slimmer thighs, a belt, and shaped shoes. Added fabric normal-mapped clothing with collar, placket, buttons, pockets and watch. All new detail is in the NEAR LOD tier, so the far proxy is unchanged.
- New `src/world/humanRig.js` human rig replaces the old stick-figure rig for companions, the first-person body and traffic riders: full joint hierarchy with tapered capsule limbs, anatomical masses, face features, layered clothing, hands/fingers and feet, plus damped walk/idle/sit/steer/push/crouch/look/tremble/eat/sip/photo/rub/strike animation and `hold()` for props that ride the hand. The old rig's `mouthM` marker and `hold()` API are preserved so lip-sync and story beats still work.
- Dynamic LOD (`src/world/lod.js`): ~8 Hz throttled, hysteresis-based 3 tiers — NEAR (<26 m, 47 meshes + animation), MID (26–72 m, 25 meshes, animation kept), FAR (>72 m, 3-mesh static proxy, no animation). Speaker pinned to NEAR. Registered for all actors and traffic riders; unregistered on dispose / level change. Debug overlay shows near/mid/far counts. Headless tier test passed (47→25→3→47 meshes, focus override works).
- Physics upgrade: `G.world` now uses a SplitSolver(GS, 20 iters, tolerance 1e-3), SAP + bounding boxes, firm contact/friction equations, and a 120 Hz fixed clock (`step(1/120, dt, 8)`). Collision groups were added (GROUND/STATIC/VEHICLE/PROP) to `Level.solid`, `Level.dynamic`, the ground plane and the bike chassis; loose props no longer collide with each other. The bike has manual swept CCD (raycast previous→current position against STATIC bodies at >12 m/s) plus impact thud/camera-shake with a 300 ms cooldown, and surface-aware wheel grip (mud/water slipperier). Debug overlay shows body/contact counts. Headless tests confirmed a stable finite RaycastVehicle under the new solver and that CCD stops a 300 m/s body that tunnels without it.
- UI fit: `.screen` / `.menu-inner` / `.cs-inner` are now flex-centred with viewport-height-based clamps on title, spacing, button padding and 3D preview height, so the main menu and character select fit without vertical scrolling on shorter screens. Removed a late duplicate `.menu-char` rule that was overriding the compact margin.
- Added `src/core/tips.js`: 25 rotating gameplay/story tips with `<kbd>` markup, shuffled deck (no immediate repeats) and a faded swap every 6 s. One rotation feeds the `.rot-tip` slots on the character screen, main menu and loading screen. Headless rotation test passed (24 unique in 30 draws, all elements synced).
- Story source is `the_last_way_out_final.md` in this directory (synthesized into `FULL_STORY.md`); the old `TheLastWayOut/story.txt` draft is not used. Fixed a stale comment in `act4.js` that still referenced it.
- G (bike walking) reworked: the controlled character now walks at the handlebars with a new `steer` pose (hands forward on the bars) and steers the front wheel; the bike sits just ahead/right of them instead of being shoved from far behind. Holding Shift+W calls the companion to push from behind (assist state) and raises speed 1.4→2.75 m/s with a clearer toast.
- New `src/world/variety.js` model library: parameterized humans (age/build/gender/role/clothing/hair), ghosts with void faces and tattered cloth, vehicle variants, named multi-storey buildings with awnings/balconies, tree species and terrain+crop patches. Wired into traffic riders, town shops, countryside and horror apparitions (replacing the old capsule figures). Storm lightning now renders a jagged bolt.
- Full horror sound palette added: `leaves`, `howl` (was called by the director but missing — silent until now), `eyeShimmer`, `shadowWhoosh`, `figureMoan`, `cloth`, `fireOut`, `blueFlare`, `metalClack`, `ignition`, `echoCall`, `diyaChime`. Wired into the horror director's ambient beats/scares, white-eye and temple beats, vanishing companions, fire burnout, visor/kickstand and engine start/stop. Static check confirms every `audio.*` call resolves.
- Traffic now has visible drivers/riders: `makeRandomPerson(seed)` builds varied height/build/skin/clothing from `makeVariety()`, riders are seated correctly per vehicle kind and lean into lane changes. `makePerson` accepts `fat` for body-width variety; idle animation adds breathing, sway and head drift.
- Helmet: wearing it narrows peripheral vision (`#helmetvision`), **V** animates the visor down/up (`#visor`) for a tighter view, and visor state resets when the helmet is removed. **Ctrl+V** saves a PNG screenshot.
- The 5 PM forest-reserve board is now explicit: a clear objective ("entry till 5 PM — enter now or turn back"), a toast and dialogue explaining the rule. House got interior partitions + compound boundary, companion seated on the sofa, phone moved to the coffee table, and the approach road filled with pavements, field lanes, crops, orchards, extra trees and roadside homes. Picked-up items can never be auto-re-granted (`G.itemTaken` respected by `giveAll()` / reconcile).
- Player vehicle is now Chacha's red motorbike model (`motorbike()` from build.js), keeping the existing RaycastVehicle physics. UI prompts say "bike".
- Character selection moved to its own first-run screen with a live 3D model preview (`src/core/charpreview.js`); flow is splash → character select → menu, with "change character" (V) from the menu. Fixed preview showing the same outfit for both characters (OUTFITS keys are lowercase).
- Horror director added: dread-driven vision/audio, spaced jump scares, peripheral apparitions that vanish when looked at.
- Fallbacks: guarded dynamic level loading with a user-facing toast, `getUnlocked()` shape validation, bound rain loop, cached per-frame temporaries, vendor chunk splitting, 13 MB of unreferenced textures removed.
- Still open (honest): no real-GPU frame-rate test, no human playthrough, no Electron window launch in this environment, no key rebinding / 3D menu / post-processing / skinned characters.

## Fixed and verified (headless, real key events)
- **Ch1 cannot leave the house**: the door-approach walk zone was ~0.26 m wide after the 0.35 m player radius. It is now widened. Spawn faces the door and an OBJECTIVE HUD was added. Verified: real W key + steering reaches z=11.6 (the gate).
- **Chapter 4 (bamboo/storm) near-black**: mean luminance was ~11/255. Night/storm/rain/deep/still moods were brightened (ambient, hemisphere, horizon, moon). Re-measured ~13.5 only, so it is still very dark. Not fully fixed; see Open.
- **Scooter keeps falling**: wheel track was 0.14 m, so it tipped over. Now 0.48 m track, lower centre of mass, angular factor limits, anti-roll self-righting, stiffer suspension. Test: 7 manoeuvres (steer left/right, brake, reverse) at 60 Hz, 0 falls, min up-vector 0.9998. Autopilot-style steering along the ch2 road also ran with no fall.

## Voice
- The old fake "babble" (voiceTick) is replaced by real recorded clips: Piper neural TTS, Hindi (Devanagari via tools/lexicon.txt) and English, a different voice per character, whisper filter, subtitle timing from real clip length.
- Settings: Voice language (Hinglish voices / English voices / none).
- Regenerate: `python3 tools/extract_lines.mjs` (node) then `python3 tools/make_voice.py` (models in tools/models, not committed).
- Not verified: how it sounds. Hindi quality of Piper is mid-level and the Devanagari lexicon was hand-written, so some pronunciations may be off. I did not run a transcription check.

## Open (NOT done)
- Graphics are still the procedural low-poly look (no PBR textures, HDRI, post-processing, glTF characters or detailed houses). This is the biggest gap against the "GTA 5" request and cannot be matched in this stack.
- Ch4 still very dark; night horizon "comb" artifact; cow looks like a sheep; ceiling/wall texture smear.
- UI overhaul (menu 3D background, loading screen, settings polish) not started; only the objective HUD and the voice-language option were added.
- No soft-lock guards on the other chapters' interact gates; the full real-input playthrough of all chapters was not run.
- Voice clips: see /tmp/mv.log status in the summary.


## Status update (latest session)
### Fixed / done
- Voice: 265 Hinglish + 265 English neural clips rendered (updated count; the rest are silent "..." / stage-direction lines by design). Transcribed samples back word-for-word in both languages; both languages load and play in-browser with no errors. Settings > Voice language (Hinglish / English / None).
- Lip-sync: the speaking character's mouth opens from the clip amplitude.
- Chapter 4 (bamboo/storm) no longer black: per-mood exposure is now wired to the renderer, ambient raised, torch wider/brighter (mean luminance 12 -> ~19/255; bamboo, path and torch pool are readable).
- Graphics: 17 Poly Haven CC0 PBR sets (diffuse + normal + roughness) now drive plaster, mud, brick, roof tile, tin, wood, cement, floor tile, earth, stone, bark, grass, road; world-scaled UVs on boxes; MSAA; soft sun shadows (Medium/High); woven-cloth normal map on clothes; capsule limbs and smoother heads.
- Earlier: ch1 door exit, scooter tipping, objective HUD.
### Still open (honest)
- Not GTA-5 fidelity: characters are still procedural (smoother, but stylised). No skinned glTF humans, no post-processing (SSAO/bloom), no HDRI sky, no glTF vegetation.
- Chapters 3-6 are still dark by design (~12-23/255); no UI overhaul (menu 3D bg, loading screen, rebinding); F3 debug overlay not built.
- Night horizon "comb", cow looks like a sheep, ceiling/wall smear, bare street in home.js.
- No soft-lock hints on later gates; no full real-input playthrough beyond ch1 (autopilot runs verified).
- AppImage/deb not rebuilt this session (`npm run dist`); texture/voice assets add ~50 MB.


## Update: navigation, sprint, road end (latest)
- **Map / direction**: minimap (heading-up, rim arrow to goal), compass strip with gold waypoint, in-world gold diamond with distance, full map on `M` (north-up, you + facing cone, route, goal, Nishant, scooter, zoom). Goal is fed automatically by `go/goTrail/use/gate` and a base goal for the road ride. Setting: Navigation aid (full / compass only / off).
- **Shift+W cutting out**: (1) stamina hysteresis + visible stamina bar, (2) Shift state is now read from every key/mouse event's `shiftKey` (a lost keyup or focus change can no longer leave sprint dead), (3) a toast explains when running is disabled (pushing the scooter).
- **Stuck where the road ends**: drivable corridor extended 45 m past the last road point; wall contact now slides instead of braking to a halt; verified with an async real-step run road -> forest -> dismount. New safety nets: toast after 18 s without progress; `H` = hint, `H` twice = hop ahead along the route.
- Still open: night horizon comb, cow model, procedural (not photoreal) characters, post-processing, UI polish, AppImage/deb rebuild.

## Update: final pass
- Ending A and Ending B autoplay both reach their end cards, no errors.
- Done: night horizon (screenshot-checked), zebu cow, FOV + subtitle size settings, loading overlay, F3 debug, AppImage + deb rebuilt.
- NOT done (honest): key rebinding, menu 3D background, post-processing, skinned/realistic characters, more detailed houses, home street dressing, any human-played test, Electron window launch test.
