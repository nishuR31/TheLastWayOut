# BUGS / STATUS (honest)

## CURRENT STATUS (authoritative — this section supersedes the dated history below)
- Build: `npm run build` passes on Vite 8. `npm audit`: **0 vulnerabilities** (deps pinned exactly; `minimatch` overridden to 11.0.9 for the packaging toolchain).
- Voice: **265 Hinglish + 265 English** clips in `public/voice/{hi,en}` (the older "243/240" figure below is stale). Three silent manifest entries are intentional stage directions.
- F3 debug overlay **is built** (the older "not built" note below is stale).
- AppImage/deb are **not built in this checkout** (the older "rebuilt" notes below refer to a previous environment). Run `npm run dist` to produce them.
- Dead/duplicated code removed: `src/story/act2.js`, `src/levels/forest.js`, and the unused `ch5`/`ch6` copies in `act3.js`. The dead `tts` setting path was removed.
- Hardening: Electron sandbox is on by default (`TLWO_NO_SANDBOX=1` to opt out), `corsEnabled` removed from the `app://` scheme, path containment uses `path.resolve`/`path.relative`, DevTools gated to unpackaged builds.
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
