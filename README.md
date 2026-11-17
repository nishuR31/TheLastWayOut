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

Electron's Chromium sandbox is enabled by default. On hosts that block unprivileged user
namespaces, opt out deliberately with `TLWO_NO_SANDBOX=1 ./run.sh` (or the same env var with
`npm start`).

## Controls

| Desktop | Action |
|---|---|
| W A S D / mouse | move / look |
| Shift + W | run (you will get tired) |
| Shift (hold, no W) | crouch / hide |
| C | switch first-person / third-person camera |
| E | interact / pick up twigs / light or feed a fire |
| F | torch |
| T | build a fire where you stand (needs twigs) |
| P | phone |
| B / Shift + B | ride the scooter / push it by hand |
| I | inventory |
| M | map |
| H | hint; press twice to hop a few metres ahead if stuck |
| Space | scooter brake |
| Esc | pause / settings |

Touch controls are also included. Accessibility options: bilingual subtitles (Hinglish + English), sound captions, volume sliders, reduced shake and flash.

## Story (target 60–90 minutes)

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

- Vite 8 + Three.js 0.170 + cannon-es (scooter `RaycastVehicle`). Plain JS ES modules.
- `three`, `cannon-es` and fonts are split into cacheable vendor chunks; levels are lazy-loaded
  by `import.meta.glob` in `src/game.js`. Chapters (`src/story/*.js`) are async scripts run by
  `story.js`, a state machine with branches A/B/C.
- Headless test hooks: `?ch=<chapter index>&auto=1` (or `auto=b` for branch B), `&fast=6` (simulate faster than real time). These are used for Playwright smoke tests.
- Dependency versions are pinned exactly in `package.json`; `npm audit` reports 0 vulnerabilities.

## Status

- Verified in headless Chromium (software WebGL): every chapter and all three endings run to the end card with no console errors. Autopilot, not a human playthrough.
- `npm run build` passes with Vite 8 (vendor chunks + lazy levels). `npm audit`: 0 vulnerabilities.
- **Not built in this checkout:** the AppImage/deb (`npm run dist`) have not been regenerated here — build them locally if you want the installers.
- **Not verified:** the Electron window was not launched in this environment, and no real-GPU frame-rate test was run. Test on your machine. If the window fails, `./run.sh` with a browser fallback is available.
- Visuals are stylised, not photoreal; no skinned humans, SSAO/bloom or HDRI. UI has FOV and subtitle-size sliders, a loading overlay and an F3 debug overlay; key rebinding and a 3D menu background are not implemented.
- For a low-RAM box, build the deb with `TMPDIR=$HOME/tmpbuild npx electron-builder --linux deb`.

## Navigation

- `M` full map (you, facing cone, route, goal, Nishant, scooter; wheel/+/- zoom), minimap + compass always on HUD, gold diamond in the world.
- `H` hint, `H` twice = hop a few metres ahead along the route if you are ever stuck. `Shift` sprint with stamina bar.
- Settings > Navigation aid to choose full / compass only / off.
