# AI-Agent Development Harness (opt-in)

A development-only feature that lets an AI agent **see, watch, interact, control, and play**
*The Last Way Out* in a real browser, and collect evidence of bugs. It is loaded **only** when
the URL contains `?dev=1`, so it is invisible and inactive during normal play. Nothing in the
harness changes gameplay logic.

## What gets loaded

When `?dev=1` is present, `main.js` dynamically imports `src/dev/harness.js`. It provides:

- `window.__dev` — a structured, agent-friendly API (below).
- `window.__dev.cmd(name, ...args)` — drive the game without needing UI clicks.
- An event ring buffer capturing **page errors, unhandled rejections, console errors, failed
  resource loads, level changes, goal changes, and issued commands**.
- `checks()` — automated invariant checks (NaN positions, missing renderer, render failure,
  stuck run, errors) that turn symptoms into named bug findings.
- A small visible `#dev-hud` panel so state is readable in screenshots.

## 1. Start a testable session

```bash
cd /home/nishu/Techstack/codes/thelastwayout
npm run build
npm run preview &                     # serves http://127.0.0.1:3000
```

Launch a browser with a loopback CDP endpoint (use any real Chrome/Chromium binary):

```bash
CHROME=/home/nishu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome
"$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage \
  --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader \
  --remote-debugging-port=9222 --user-data-dir=/tmp/tlwo-cdp-profile \
  'http://127.0.0.1:3000/?dev=1&ch=0&auto=1&fast=6' &
```

Then point the driver at it: `export CDP_ENDPOINT=http://127.0.0.1:9222`.

## 2. Driver (zero dependencies — Node 22+ built-in WebSocket)

```bash
node tools/agent-driver.mjs targets
node tools/agent-driver.mjs state          # SEE: full structured snapshot
node tools/agent-driver.mjs events 50      # WATCH: recent event log
node tools/agent-driver.mjs errors         # WATCH: only errors/rejections
node tools/agent-driver.mjs checks         # FIND BUGS: invariant checks
node tools/agent-driver.mjs report         # state + checks + errors + recent events
node tools/agent-driver.mjs screenshot shots/ch1.png
node tools/agent-driver.mjs press KeyW 1200
node tools/agent-driver.mjs cmd play 5 b
node tools/agent-driver.mjs eval 'window.__dev.state().level'
node tools/agent-driver.mjs run tools/scenarios/smoke.json
```

All commands print one JSON object on stdout. `run` also writes `<scenario>.report.json`.

## 3. REA browser tools (alternative, no CDP driver needed)

If you have the REA browser tools, you can drive the same page with
`capture_browser_scenario`:

- `browser`: `{ mode: "connect", cdp_endpoint: "http://127.0.0.1:9222", target_id: "<id>" }`
  (get the id with `list_browser_targets`), or `mode: "launch"` with an absolute
  `executable_path` to a Chrome binary.
- `start_url.url`: `http://127.0.0.1:3000/`, with query `dev=1`, `ch=0`, `auto=1`, `fast=6`.
- `actions`: `goto`, `click`, `fill`, `press`, `select_option`, `check`, `wait_for`,
  `wait_for_timeout` — e.g. `press` on `#c` (the canvas) with `KeyW`, or `click` on `#m-start`.
- `capture.at_end`: `["screenshot", "dom", "url"]`; `capture.events`: `["console",
  "page-errors", "network"]` — these are the agent's *watch* channel for bugs.
- `inspect_web_page` and `capture_web_screenshot` work on the same target for passive
  observation; `observe_web_execution` can capture JS coverage for a fixed window.

## 4. `window.__dev` API reference

| Method | Returns |
|---|---|
| `state()` | `{ ready, running, paused, level, clock, player{x,z,yaw}, camera{x,y,z}, scooter, goal, interacts[], fear, flags, render{calls,triangles}, autoplay, fastSim, errorCount }` |
| `events(n=30)` | Last `n` events from the ring buffer |
| `errors()` | All error/rejection/console-error/resource-error events |
| `checks()` | `[{name, ok, detail}]` invariants |
| `report()` | `{state, checks, errors, recent}` — one-call observability |
| `dom()` | Visible UI text: subs, objective, prompt, toast, title |
| `screenshot()` | PNG data URL of the game canvas |
| `cmd(name, ...args)` | Run a command (below) |
| `help()` | List commands and API methods |

### Commands

| Command | Args | Effect |
|---|---|---|
| `play` | `chapterIndex, branch?` | Start a chapter; branch `b`/`c` enables autoplay and that choice |
| `chapter` | `index` | Start a chapter (no branch) |
| `flag` | `name, value` | Set a story flag |
| `teleport` | `x, z, yaw?` | Move the player |
| `time` | `hours` | Set the in-game clock |
| `mood` | `name` | Set weather/lighting preset |
| `item` | `name` | Give an item flag (e.g. `hasPhone`) |
| `speed` | `n` | Set fast-simulation multiplier (0 = off) |
| `auto` | `true/false` | Toggle autoplay |
| `pause` | `true/false` | Pause/resume |
| `skip` | — | Resolve all pending interactions (skip a wait/gate) |
| `toast` | `message` | Show a UI toast |
| `reset` | — | Reload the page |

## 5. F2 Dev AI-Agent Chatbox

With `?dev=1`, press **F2** in the game to open the dev chat panel (bottom-right). It is part of
the dev harness only; normal play never shows it.

- **You (human):** type an issue and press Enter (or Send). It is stored as an ISSUE entry with a
  timestamp and the current level, and persists across reloads in `localStorage`.
- **Agent:** can post its own findings with `node tools/agent-driver.mjs issue "..."`, or run
  `analyze` to auto-triage the current state (`report()` → failed checks + errors) into an agent
  issue. `cmd chat-toggle` opens/closes the panel from the agent side.
- The panel has **Auto-analyze**, **Save file** and **Clear** buttons. Save downloads
  `fixNeeded.txt` in a plain browser, or writes it directly to the project root when running in
  Electron with a `saveDevIssues` bridge.

### Flushing issues to the project root

The reliable path is the agent driver (it runs in Node, in the project):

```bash
node tools/agent-driver.mjs issues                 # list queued issues
node tools/agent-driver.mjs issue "bike stuck at camp"
node tools/agent-driver.mjs analyze                # agent self-diagnoses current state
node tools/agent-driver.mjs save-issues fixNeeded.txt
```

`save-issues` renders the whole chat log into a structured **`/fixNeeded.txt`** (in the current
working directory = project root) with `## [n]` entries, source (HUMAN/AGENT), level, the message
and `Status: OPEN`. Use it later as the work queue for fixes.

New `__dev` members: `chat`, `issues()`, `chatText()`. New commands: `issue`, `agent`, `analyze`,
`chat-toggle`, `chat-clear`.

### Horror controls
`__dev.state().horror` reports `{ value, level, figures }` (dread, current baseline, visible
apparitions). Trigger effects with:
```bash
node tools/agent-driver.mjs cmd scare sting        # jump scare (flash + sting + shake)
node tools/agent-driver.mjs cmd scare creature     # tall figure right in front
node tools/agent-driver.mjs cmd scare silence      # 2 s of dead ambience + low drone
node tools/agent-driver.mjs cmd apparition eyes 12 # peripheral eye-shine at 12 m
node tools/agent-driver.mjs eval 'window.__dev.horror.kick(0.8)'  # spike dread
```
Apparitions fade in only in the peripheral 25°–130° arc and dissolve when looked at directly.

## 6. Agent playbook

1. **SEE** — `state` + `screenshot`. Confirm `ready:true`, note `level`, `goal`, `player`.
2. **WATCH** — `events`/`errors` after each action; `dom()` for what the player is told.
3. **INTERACT** — `press KeyW` to move, `press KeyE` to interact, `cmd skip` to unblock a gate,
   `cmd teleport` to reach a landmark. Use `dom().prompt` to learn what `E` will do.
4. **CONTROL** — `cmd flag/mood/time/item/speed/auto/pause` to set up a specific scenario.
5. **PLAY** — `cmd play <index> b/c` or the URL hooks `?ch=N&auto=1&fast=6` to run chapters
   and endings unattended. Use `fast=6` to compress hours of in-game time.
6. **FIND BUGS** — run `checks` after each step and `report` at the end. Treat any of these as a
   finding: `ok:false` check, any error event, `NaN`/`Infinity` in state, stuck run (no movement
   for 45 s), missing level after start, zero draw calls, or a screenshot that does not match the
   expected scene. Each finding should record the step, `state`, and `errors` that preceded it.

## 7. Scenario files

`tools/scenarios/*.json` are arrays of steps. One key per step:

```json
[
  { "eval": "window.__dev.cmd('play', 0, 'b')" },
  { "wait": 3000 },
  { "check": "level-loaded" },
  { "screenshot": "shots/ch1.png" },
  { "cmd": "teleport", "args": [0, 10], "after": false },
  { "press": "KeyW", "ms": 1000 },
  { "eval": "window.__dev.report()" }
]
```

Supported step keys: `cmd`, `eval`, `press` (+ `ms`), `click` (CSS selector), `navigate`,
`wait` (ms), `screenshot` (path), `check` (check name). `{ "after": false }` suppresses the
state appendix on that step. The runner verdict is `PASS` only when there are no failed steps,
no failed checks, and no captured errors.
