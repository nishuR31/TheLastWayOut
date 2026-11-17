# THE LAST WAY OUT — Quality Recovery Plan (target: 10/10)

Rated by the user at 1/20 for UI, graphics and audio. This plan fixes bugs first, then voice, then graphics, then UI, then QA.
Rule for every phase: reproduce with a real-input headless test, fix, re-test, screenshot, commit. Nothing is marked "done" without a test or a screenshot.

## What "GTA 5 level" can honestly mean here
GTA 5 uses motion-captured, scanned characters and a team of 1000+ artists. A browser game built here cannot match that.
What can be done well, using only legally free (CC0 / CC-BY) assets and real-time techniques:
- Photo-scanned PBR materials (Poly Haven, CC0): mud, bark, plaster, brick, tile, cloth, roof, cement.
- Real HDRI sky and image-based lighting, filmic tone-mapping, SSAO, bloom, vignette, film grain, volumetric-style fog, proper shadows.
- Real 3D tree, rock, plant and prop models (CC0 glTF), instead of boxes and blobs.
- Skinned, animated human characters (glTF rigs) with Indian clothing (kurta, lungi, saree, gamchha) and PBR skin and cloth.
The result will look like a modern indie realistic game, not like GTA 5. I will say clearly what is still short.

## Phase 0 — Audit and reproduction (first)
Write a real-input test harness (real key events, not teleport autopilot) and record every bug in `BUGS.md`.
- ch1: cannot leave the house door. Test by holding W from spawn to the street.
- Scooter keeps falling or tipping: test mount, ride, turn, brake, and push on all terrains.
- Black screen in the 4th chapter and level. Test each of c1..c11 and both endings for first-frame luminance and console errors.
- Night horizon "comb" artifact.
- Anything else found: stuck colliders, unreachable interactions, bad subtitles, UI overlaps, soft-locks.

## Phase 1 — Blocking bugs
- Door and collision rework: replace the 2D "walk corridor" hack at doorways with explicit door and threshold zones. Add a debug overlay (F3) that shows walk zones and colliders.
- Scooter: raise suspension stiffness and damping, lower the centre of mass, add an anti-roll and self-righting clamp, and a ground snap. Add a physics test that drives each level's route.
- Black screen: find the cause (level build, lights count, fog, exposure, shader compile) and fix it. Add a "first frame is not black" test.
- Soft-lock guards: every interact gate gets a hint, a timeout hint, and a skip fallback.
- Fog and horizon: match fog to the sky horizon colour, add a far fog wall.

## Phase 2 — Voice (replace the sped-up babble)
Problem: current "voice" is a synthesised tick pattern, and there is no real Hindi or English speech.
- Use offline neural TTS (Piper, free, runs here) to pre-render every dialogue line to audio files shipped with the game.
- Two languages: Hindi voice (Devanagari text, authentic pronunciation) and English voice. Settings option: Hinglish voice / English voice / subtitles only.
- Distinct voices per character: Nishan, Nishant, Uncle, Daughter, Mother, Chacha, Stranger, Chaiwala, Dost. Use different Piper models and pitch / speed shifts via ffmpeg.
- Extract all lines from the story scripts into one `lines.json` with ids, Devanagari for the Hindi voice, and English. Build script `tools/make_voice.py`. The game plays `audio/<lang>/<id>.ogg`, and subtitle timing comes from the real clip duration.
- 3D positional playback for off-screen voices (uncle behind you, parents calling). Add reverb and low-pass for "far" voices.
- Real sound design pass: rain on leaves, thunder, wind in bamboo, crickets, owl, dog, footsteps by surface. Source CC0 recordings if reachable, otherwise improve the synthesis. Mix: ducking under speech, master limiter.
- Quality check by transcribing the generated clips back (audio_transcribe) to confirm they are intelligible.

## Phase 3 — Graphics pass 1: world
- Replace procedural canvas textures with Poly Haven CC0 PBR sets (diffuse, normal, roughness) at 1k.
- HDRI sky per mood (dusk, night, storm, dawn) plus a procedural star and cloud layer.
- Post-processing chain: ACES, SSAO, bloom, vignette, grain, mild chromatic aberration, rain-on-lens at storm. Quality tiers: Low / Medium / High / Ultra.
- Real vegetation: CC0 glTF trees (peepal / banyan style, teak, bamboo), ferns, grass, rocks. Use instancing and LOD.
- Terrain with height variation, mud, puddle reflections, wet-surface roughness.
- Village houses: proper Indian rural architecture (mud-brick walls, clay tile roofs, thatch, courtyard, charpai, matka, chulha, lantern light), modelled at higher detail with trim, windows with shutters, doors with frames, roof overhangs and beams, and wall wear decals.
- Fix: ceiling and wall texture smear, the cow model, street dressing.

## Phase 4 — Graphics pass 2: characters
- Replace the box/capsule humans with skinned glTF humanoids (idle, walk, run, sit, talk, point, fall), retextured with Indian clothing: kurta, lungi, saree, gamchha, turban, jeans/shirt for the friends.
- Real face and skin textures, eye and hair shaders, subsurface-like skin shading.
- Lip and head motion synced to the voice clip amplitude.
- Special characters (shadow figure, tall figure) done with proper silhouette shaders. Keep the story rules: no glow on the drink, no portal effects.
- First-person arms and torch, and a proper scooter model (instead of primitives) with working lights.

## Phase 5 — UI / UX overhaul
- Main menu with a real 3D background scene, a proper logo and a loading screen with tips.
- HUD: subtle clock, interaction prompt with icons, objective hint line, stamina and torch indicators.
- Subtitle redesign: speaker colours, size options, background opacity, sync with real audio.
- Settings: quality tier, resolution scale, FOV, mouse sensitivity, voice language, subtitle size, volumes, reduce shake/flash, key rebinding.
- Pause screen, chapter select with thumbnails, end cards, and the "Asli Sach" reality report redesigned as a gallery.
- Controller (gamepad) and touch support checks.

## Phase 6 — QA, performance, packaging
- Scripted real-input playthroughs of both branches with screenshots per scene and automatic black-frame and error detection.
- Performance budget: target 60 fps on a mid laptop iGPU at Medium (triangles under 400k, draw calls under 250). Measure and report.
- Build the Electron AppImage and deb, and test launch with xvfb here if possible.
- README, BUGS.md final status, ProjectBackup.

## Order of work (each step ends in a commit)
1. Audit harness + BUGS.md
2. Door / scooter / black-screen fixes
3. Voice pipeline (biggest user complaint after the blockers)
4. World graphics (textures, sky, post, vegetation, houses)
5. Characters
6. UI overhaul
7. Full QA and packaging

## Known risks (to be honest about)
- Headless software rendering is about 1 fps, so frame rate and real GPU look can't be measured here. I will use a budget and a quality tier system instead.
- Free realistic human characters in Indian clothing do not exist as a ready download. Characters will be a free rigged humanoid with retextured Indian clothing. Quality will be good but not photoreal.
- Piper's Hindi voices are neural and clear but are not actor performances. The voices are acceptable, not cinematic.
