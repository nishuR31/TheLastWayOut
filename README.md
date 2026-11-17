# THE LAST WAY OUT

A grounded, first-person psychological horror game for **Ubuntu desktop** (Electron + Three.js).
You are **Nishan**. Your friend **Nishant** is lost with you on a scooter in a forest in rural India.

The game uses procedural geometry and synthesised audio, plus shipped assets under `public/`:
Poly-Haven CC0 PBR textures, recorded Hinglish/English voice clips, and bundled fonts. It is not
asset-free. See `FULL_STORY.md` for the complete story specification.

At the end, the game shows **Asli Sach** ("the real truth"). These cards explain the sounds, shapes and legends you met, in Hinglish and English.

## Run on Ubuntu

```bash
# one-time: Node.js 20.19+  (sudo apt install nodejs npm)
cd thelastwayout          # run from the project root (the directory containing run.sh)
./run.sh                  # installs deps on first run, builds, opens the desktop window
```

Other options:

| Command | What it does |
|---|---|
| `npm install && npm start` | build + open in Electron |
| `npm run web` | build + serve at http://localhost:3000 (any browser) |
| `npm run dist` | build `release/*.AppImage` and `release/*.deb` (electron-builder) |
| `the-last-way-out.desktop` | launcher entry; copy to `~/.local/share/applications/` |

Needs a GPU with WebGL2. In-game quality options are in Settings. **F11** toggles fullscreen.

Electron's Chromium sandbox is used when its helper is configured correctly. On many
Ubuntu/Debian installs `node_modules/electron/dist/chrome-sandbox` is **not** setuid-root, which
makes Chromium abort at startup. `run.sh` and `electron/main.cjs` now detect that case and
automatically relaunch with `--no-sandbox`, printing the proper one-time fix:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

After that, the sandbox stays on by default. You can force either behavior with
`TLWO_NO_SANDBOX=1` (off) or `TLWO_NO_SANDBOX=0` (on). Note: `npm install` may recreate the helper
with normal ownership, so re-apply the fix after reinstalling Electron. Wayland hosts may also
print harmless VAAPI/Vulkan GPU warnings; the game falls back to software rendering.

## Start page

The first-run flow is **splash → character select → menu**:
1. A short animated splash (auto-dismisses, or click / any key to skip).
2. A dedicated **character-select screen** with a live 3D preview of the chosen friend. Pick
   Nishan or Nishant by click, `A`/`D` or arrow keys, then press **Enter** / Continue.
3. The main menu (New Game, Chapters, Reality Log, Settings, Keys & Controls). Use
   "change character" (`V`) to return to the selector.

The choice swaps the two friends' on-screen dialogue names and is saved in settings; recorded
voice clips and lip-sync keep their original speaker ids. Backgrounds are opaque so the in-game
HUD never bleeds through, and buttons/cards lift and glow on hover. `?nosplash` skips the splash;
`?ch` / `?auto` skip the selector for automated tests.

The character-select and menu layouts are flex-centred and sized with `vh`-based clamps, so the
whole screen fits in the viewport without scrolling on short laptop displays. A shared set of
25 rotating tips (`src/core/tips.js`) covers controls, items, story beats and the strange rules
of the night; it shuffles an exhaustive deck every 6 seconds with a fade, and the same tip shows
on the character screen, main menu **and loading screen**.

## Controls

| Desktop | Action |
|---|---|
| W A S D / mouse | move / look |
| Shift + W | run (you will get tired) |
| C (hold) | crouch / hide |
| X | switch first-person / third-person camera |
| E | interact / pick up twigs / light or feed a fire |
| Shift + E | put key / phone / helmet back |
| E (while riding) | start / stop the engine (mounting alone does NOT start it) |
| F | torch |
| T | build a fire where you stand (needs twigs) |
| P | phone |
| B | ride the bike / get off |
| Shift + B | hang the helmet on the bike's rear holder by its chin strap, or take it back |
| G | take the handlebars and walk/steer the bike (no sitting) |
| Shift + W (while steering) | friend shoves from behind — noticeably faster |
| Left click (riding) | horn |
| V (helmet worn) | pull the visor down / up (animated); narrows vision further when down |
| Ctrl + V | save a screenshot (PNG) |
| I | inventory |
| M | map |
| H | hint; press twice to hop a few metres ahead if stuck |
| Space | bike brake |
| Esc | pause / settings |

**Why can't I…?** When an action is blocked (no key, bike stuck in mud / punctured, too far, wrong
scene, not enough twigs, etc.) the game now shows a **red explanation** saying what happened and
why — e.g. pushing works in the bamboo grove because the bike is stuck in wet mud, so riding is
impossible there. Near a blocked bike the reason repeats occasionally even without pressing a key.

The bike has an animated **kickstand**: it drops when parked or after you push/stop pushing, and
folds away when you mount or start pushing. The helmet can be hung from the bike's rear holder with
Shift+B. Pressing **E** is the only thing that plays the ignition-key animation; the **headlight is
on only while the engine is running**. The riding model has axle-based turning with lateral grip,
coasting momentum, straight-line yaw stabilisation, anti-spin in reverse and a top speed of about
**150 km/h** on tarmac (slower off-road but no longer a cliff-edge drop). Road signs auto-fit their
text and redraw once the web fonts load. Cinematic beats play at the temple bell, the petrol pump
and the dhaba; other traffic honks and changes lanes more often.

**Sound:** every horror beat now has a procedural cue — dry leaf footsteps, distant howls, pale-eye
shimmer, shadow whooshes, cloth rustles for vanishing companions, a faceless-figure moan, fire
burning out, the ignition/starter, kickstand and visor clacks, an echoing familiar voice from the
direction just left, and small diya chimes. The horror director's random beats draw from this whole
palette instead of silently failing on a missing `howl()` method.

Characters now use `src/world/humanRig.js`: a proper joint hierarchy (hips → spine → chest →
neck → head; shoulder → upper arm → elbow → forearm → wrist → hand; hip → thigh → knee → ankle →
foot). The face is a cached painted canvas texture (eyes, brows, nose, moustache, beard, bindi,
age lines) on a 22×16 head sphere, and hair is a capped partial sphere that actually wraps the
crown (short / bun / braids / turban / thin / bald). The torso is one tapered oval with a flat
pelvis taper and slimmer thighs — no more ball-joint hips or shirt/trouser crotch bulge. Clothing
uses fabric normal maps plus collar, placket, buttons, belt, buckle, pockets, watch and shaped
shoes. All of that is LOD-tiered. The animation set covers walk / idle / sit / steer / push / eat /
sip / photo / rub / strike and more, plus held objects that ride the hand up to the mouth.
Geometry and materials are cached.

**Dynamic LOD** (`src/world/lod.js`) updates at ~8 Hz with hysteresis:
- **NEAR (< 26 m)** — full rig: ~54 meshes with face texture, hair cap, fingers, tailoring and shaped shoes, full skeletal animation.
- **MID (26–72 m)** — the skeleton still animates, but all fine detail is hidden (~22 meshes).
- **FAR (> 72 m)** — a 3-mesh static silhouette; skeletal animation is skipped entirely.
The speaking character is pinned to NEAR regardless of distance. The debug overlay (`F3`) shows
`lod near/mid/far` counts. This applies to companions, story NPCs and traffic riders; static level
geometry is already frustum-culled by Three.js.

A parameterized model library (`src/world/variety.js`) generates humans with age (child / teen /
adult / elder), build, gender, skin, hair role and clothing options, plus ghosts, vehicle variants
(standard / sports / cruiser / dirt bikes; hatch / sedan / SUV), named multi-storey buildings with
awnings and balconies, tree species and terrain patches. It powers traffic riders, named shops,
overgrown field edges and the faceless apparitions. Storms now draw a real jagged lightning bolt.

Traffic vehicles now carry visible riders/drivers with seeded variety in height, build, skin and
clothing (`makeVariety` / `makeRandomPerson`), and the riders lean into turns. Wearing a helmet
narrows peripheral vision; press **V** to slide the visor down for a tighter, rain-blocked view.

The forest reserve board is explained on screen: **entry closes at 5:00 PM**, so enter now or turn
back — the objective states it and the friends discuss what the board means. Forest trails are wider
and use a rideable surface, so the bike turns properly instead of fighting the trees. The house has
interior room dividers and a low compound wall with a gap at the front door, the companion sits
properly on the sofa, the phone starts on the coffee table, and the approach road is lined with
pavements, lanes into fields, crops, orchards and roadside homes. Items you have picked up are never
auto-re-granted by story safety nets.

Touch controls are also included. Accessibility options: bilingual subtitles (Hinglish + English), sound captions, volume sliders, reduced shake and flash.

## Story (target 60–90 minutes)

A new game starts with **nothing** — the phone, key and helmets are picked up during Chapter 1
(matching the definitive script). Chapter-select starts already equipped. All three are
**two-way stations**: press **E** at the table / wall hook / helmet rack to take an item, or
**Shift+E** to put it back — a plain E near a station you already emptied will never silently
empty your pocket. Item state is reconciled every frame and across level changes, so nothing can
end up in neither the world nor your pocket. There is no always-on inventory strip in the corner; use **I** to see your
items. The player rides the same red motorbike model Chacha
works on (the original scooter body was replaced; physics and controls are unchanged).

c1 a normal morning, permission, the ride; c2 the sunlit campsite and the loop where the bike is
visible but unreachable; c5 riding into the lost forest; c6 the bamboo shelter and the fire;
c7 the village that returns and the uncle's house; c9 his two friends; c10 the shadow;
c11 the cremation ground, where the uncle vanishes.

At c11 **you choose** between three endings:

- **Ending A** — follow the direction the uncle pointed. A long stuck night, released at sunrise; a lift home and the scooter returned later.
- **Ending B** — stay and hide. The faceless tall figure; an ordinary stranger finds you, a shortcut leads to a tea stall, and a phone call brings you home.
- **Ending C** — stay and approach the pickaxe figure. A chase and a muddy pit; both friends survive and wake up in hospital.

Nobody dies in any ending. The red sharbat and the village stay unexplained, and the uncle is never confirmed to be a ghost.

## Reality cards (the post-game report)

21 cards cover the following:
- walking in circles (Souman 2009)
- bamboo "voices" and wind
- familiar voices heard from far away (auditory pareidolia)
- payal sounds from rattling siris pods
- footsteps and echoes
- the cold gust
- shadows and the autokinetic effect
- the Third Man factor
- repeating lights
- eyeshine and tapetum lucidum
- microsleep and fatigue
- peepal and banyan CO2 myth versus reality
- storm, animal and "if you are lost" safety tips (STOP, 112)

A few cards are marked as **unknown**: the village, the laugh, the samadhi, the drink. These are deliberately not explained.
Cards unlock as you meet each event and are saved in localStorage.

## Tech

- Vite 8 + Three.js 0.170 + cannon-es (`RaycastVehicle`). Plain JS ES modules.
- **Physics**: 120 Hz fixed substeps (up to 8 per frame), a `SplitSolver` wrapping a 20-iteration
  GS solver with tight tolerance, firm contact/friction equations, and SAP broadphase with
  bounding-box checks. Collision groups separate ground / static walls / vehicle / loose props,
  so props stop jittering against each other and the swept-collision ray can target walls only.
  The bike runs **swept CCD**: at speed it raycasts its previous→current position and is backed
  off the hit surface instead of tunnelling through thin walls. Impacts play a thud and shake the
  camera with a cooldown, and wheel grip drops on mud/water. The debug overlay reports live body
  and contact counts.
- `three`, `cannon-es` and fonts are split into cacheable vendor chunks; levels are lazy-loaded
  by `import.meta.glob` in `src/game.js`. Chapters (`src/story/*.js`) are async scripts run by
  `story.js`, a state machine with branches A/B/C.
- Headless test hooks: `?ch=<chapter index>&auto=1` (or `auto=b` for branch B), `&fast=6` (simulate faster than real time). These are used for Playwright smoke tests.
- Dependency versions are pinned exactly in `package.json`. `npm audit` currently reports 10 high
  advisories, all from one **dev-tooling-only** chain: `picomatch` ReDoS (GHSA-fc5q-39xc-vjpf),
  used by Vite 8's globbing and by electron-builder's build tooling. There is no patched
  `picomatch` release; npm's only suggestion is downgrading Vite to 6.2.7, which reintroduces older
  Vite advisories. These packages are not shipped in the game bundle and are not reachable from
  gameplay (no attacker-controlled glob input).

## Horror systems

The game combines three horror styles:
- **Atmospheric dread** — a `horror` director (`src/core/horror.js`) raises a 0–1 dread value from
  the current location and `G.fear`. It narrows the FOV, darkens the edges (`#dread`), muffles the
  ambience, speeds up breathing and adds random spatial beats (whispers, knocks, footsteps,
  anklet, branch cracks, a breath close to the ear).
- **Jump scares** — a restrained director fires a sting + black flash + camera jolt and, sometimes,
  a shape almost on top of the player. A "silence" variant drops all ambience for a couple of
  seconds. These are spaced minutes apart, never stacked.
- **Creature glimpses** — peripheral shadow figures, pale eye-shines at windows, a low crawler and
  a tall pickaxe silhouette appear at the edge of vision and **vanish when looked at directly**.

Story beats can call `dread(v)`, `scare(kind, intensity)` and `apparition(kind, opts)` from
`src/story/helpers.js`. In dev mode (`?dev=1`) the agent can trigger them with
`cmd scare sting|creature|silence` and `cmd apparition shadow|eyes|crawler|tall`.

## Development / AI-agent testing

Add `?dev=1` to the URL to enable the opt-in agent harness (visible `#dev-hud` + `window.__dev`).
It is dynamically imported only with that flag and is absent from normal play. See
`DEV_HARNESS.md` for the full playbook, the zero-dependency CDP driver
(`node tools/agent-driver.mjs ...`), and example scenarios in `tools/scenarios/`.
Press **F2** in dev mode to open the AI-agent chatbox; issues you type there (or that the agent
adds with `issue`/`analyze`) are flushed to `fixNeeded.txt` with `save-issues`.

## Status

- Verified in headless Chromium (software WebGL): every chapter and all three endings run to the end card with no console errors. Autopilot, not a human playthrough.
- `npm run build` passes with Vite 8 (vendor chunks + lazy levels). `npm audit`: 10 high dev-tooling advisories (unpatched upstream `picomatch` ReDoS; see Tech section).
- **Not built in this checkout:** the AppImage/deb (`npm run dist`) have not been regenerated here — build them locally if you want the installers.
- **Not verified:** the Electron window was not launched in this environment, and no real-GPU frame-rate test was run. Test on your machine. If the window fails, `./run.sh` with a browser fallback is available.
- Visuals are stylised, not photoreal; no skinned humans, SSAO/bloom or HDRI. UI has FOV and subtitle-size sliders, a loading overlay and an F3 debug overlay; key rebinding and a 3D menu background are not implemented.
- For a low-RAM box, build the deb with `TMPDIR=$HOME/tmpbuild npx electron-builder --linux deb`.

## Navigation

- `M` full map (you, facing cone, route, goal, Nishant, scooter; wheel/+/- zoom), minimap + compass always on HUD, gold diamond in the world.
- `H` hint, `H` twice = hop a few metres ahead along the route if you are ever stuck. `Shift` sprint with stamina bar.
- Settings > Navigation aid to choose full / compass only / off.
