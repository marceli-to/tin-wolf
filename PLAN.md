# PLAN.md – Tin Wolf

Working title so far: "Retro FPS". The game's name is **Tin Wolf**; use it for the page title, menu and `package.json` name (`tin-wolf`).

Planning document for the executing model. Work through it top to bottom. Check off tasks as they are done and record every deviation in the log at the end.

## 0. Decisions and assumptions

Decided by Marcel:

- Split-screen is in scope from the start, with 2 players first (4 is a later extension).
- Tech stack is free to choose.

Assumptions made by the planner (cheap to change before M3, expensive after):

- **Two players means versus (PvP) only. There is no co-op.** (Decided by Marcel.)
- **A1 – Two modes:** *Versus* is 2-player split-screen deathmatch on arena maps, without guards. *Mission* is single-player, full-screen, with guards and objectives. Versus is built first (M3), the mission after it (M4–M5).
- **A2 – View count follows the mode:** `players=2` gives two views, `players=1` one full-screen view. The single view also makes testing easier.
- **A3 – Input:** a browser can only pointer-lock one mouse. Player 1 uses keyboard + mouse, player 2 uses a gamepad. Gamepad support therefore moves from "optional" into M1. Two gamepads also work.
- **A4 – Levels are 2.5D:** a grid of cells with floor and ceiling heights (no room above another room). This is the single biggest simplification in the plan; see section 1.
- **A5 – No external assets:** geometry, textures, characters and sounds are generated in code. Nothing is downloaded, and nothing from GoldenEye or Bond is used (names, maps, music, sounds, character likenesses).

## 1. Tech stack

| Choice | Decision | Why |
|---|---|---|
| Language | TypeScript, `strict` | Data-driven design needs types; catches agent mistakes early |
| Build | Vite | Zero-config dev server, fast reload |
| Rendering | Three.js | Small API surface, we need little beyond meshes, cameras and render targets. Babylon.js brings a physics/GUI/scene stack we would not use |
| Physics | None. Own kinematic controller | Levels are a height grid, so collision is circle-vs-cell and raycasts are grid traversal. Deterministic and unit-testable |
| Navigation | A* on the level grid | Falls out of the level format for free; no navmesh, no hand-placed waypoints |
| Level format | JSON with an ASCII map + entity list | An agent can write and read it reliably; diffs are readable |
| Data validation | zod schemas | Bad level data fails at load with a clear message, not as a runtime mystery |
| Audio | Web Audio API, synthesized SFX | No asset files, no licensing questions |
| UI/HUD | DOM overlay, one container per viewport | Simpler than in-canvas UI; crisp text |
| Tests | Vitest for simulation code | Sim has no Three.js or DOM imports, so it runs in Node |

Install the latest stable versions at setup and pin them in `package.json`. Do not add further dependencies without asking.

**Known limit of A4:** no overlapping floors, no arbitrary angled walls. Free-standing props (crates, consoles) are axis-aligned boxes on top of the grid. If a level ever needs real 3D geometry, that is an architecture change: stop and ask.

## 2. Architecture

### Core rule
The **simulation** (`src/sim`) knows nothing about Three.js, the DOM or audio. It takes player intents in and produces world state plus events. Everything else reads state and listens to events. This keeps the sim testable and makes split-screen trivial: a view is just a camera attached to a player.

```
input ──intents──▶ sim (fixed 60 Hz) ──state──▶ render (per player view)
                      │                    └──▶ ui/hud (per player view)
                      └────events─────────────▶ audio, effects, ui
game (state machine) owns the loop and decides which of these run
```

### Modules

| Module | Responsibility | May import |
|---|---|---|
| `core/` | Game loop (fixed timestep + render interpolation), typed event bus, seeded RNG, vector maths | nothing |
| `data/` | zod schemas, loaders, JSON files for levels, weapons, enemies | `core` |
| `sim/world` | World state: grid, players, guards, doors, pickups, props, objectives | `core`, `data` |
| `sim/collision` | Circle-vs-grid movement with step-up, ray-vs-grid, ray-vs-hitbox | `core` |
| `sim/player` | Movement, crouch, health, inventory, interaction | `sim/*` |
| `sim/weapons` | Fire, spread, ammo, reload, damage by hit zone | `sim/*` |
| `sim/ai` | Guard state machine, perception, pathfinding | `sim/*` |
| `sim/objectives` | Objective tracking, mission success/failure | `sim/*` |
| `input/` | Devices (keyboard+mouse, gamepad) → `PlayerIntent` per player slot | `core` |
| `render/` | Three.js scene, level mesh builder, actor meshes, view models, effects, split-screen views | `core`, `sim` (read-only) |
| `audio/` | Synth SFX, positional playback relative to the nearest listener | `core` |
| `ui/` | HUD per view, menu, lobby, briefing, debrief | `core`, `sim` (read-only) |
| `game/` | State machine: menu → lobby → briefing → playing ⇄ paused → debrief | everything |

### Communication
- **Intents in:** each tick, `input` gives the sim one `PlayerIntent` per player: `{ move: {x, z}, look: {yaw, pitch}, fire, reload, interact, crouch }`. The sim never reads devices.
- **State out:** render and UI read the world state directly, read-only.
- **Events out:** one-shot things go over the event bus: `shotFired`, `hit`, `guardAlerted`, `doorOpened`, `pickup`, `objectiveCompleted`, `playerDied`, `missionEnded`. Audio, effects and HUD subscribe.

### Split-screen
- One `WebGLRenderer`, one scene, one camera per player.
- Each view renders to its own low-resolution render target (fixed internal height of about 240 px, see M6), then is drawn to its screen rectangle with nearest-neighbour scaling.
- 2 players: left/right split by default, top/bottom as a setting.
- Each player's own weapon model is on a per-player render layer so it only appears in that player's view. The other player's body is visible as a normal actor.
- HUD: one absolutely positioned DOM container per view rectangle.

## 3. Data formats

All game content lives in `src/data/*.json`. Code holds mechanics, never content values.

### Level (`data/levels/<id>.json`)
```json
{
  "id": "test_room",
  "name": "Test Room",
  "cellSize": 2,
  "legend": {
    "#": { "solid": true, "wall": "concrete" },
    ".": { "floor": 0, "ceil": 3, "floorMat": "tile", "wall": "concrete" },
    "+": { "floor": 1, "ceil": 4, "floorMat": "metal", "wall": "panel" },
    "^": { "ramp": "n", "floor": 0, "floorTo": 1, "ceil": 4, "floorMat": "metal" }
  },
  "map": [
    "##########",
    "#....#+++#",
    "#....^+++#",
    "#....#+++#",
    "##########"
  ],
  "entities": [
    { "type": "playerStart", "slot": 0, "cell": [1, 1], "yaw": 90 },
    { "type": "playerStart", "slot": 1, "cell": [1, 3], "yaw": 90 },
    { "type": "guard", "id": "g1", "archetype": "guard_basic", "cell": [7, 1], "patrol": [[7, 1], [7, 3]] },
    { "type": "door", "id": "d1", "cell": [5, 2], "requires": "key_red" },
    { "type": "pickup", "id": "p1", "item": "key_red", "cell": [3, 3] },
    { "type": "prop", "id": "console1", "kind": "console", "cell": [8, 2], "hp": 50 },
    { "type": "zone", "id": "exit", "cell": [8, 3], "size": [1, 1] }
  ],
  "objectives": [
    { "id": "o1", "text": "Find the red keycard", "type": "collect", "target": "key_red" },
    { "id": "o2", "text": "Destroy the console", "type": "destroy", "target": "console1" },
    { "id": "o3", "text": "Reach the exit", "type": "reach", "target": "exit", "requires": ["o1", "o2"] }
  ],
  "briefing": "Short mission text shown before the level starts."
}
```
Rules: units are metres; `cell` is `[column, row]` and may be fractional; a height difference of up to 0.4 m between neighbouring cells is walkable, anything higher is a wall; ramps connect two heights.

### Weapon (`data/weapons.json`)
```json
{
  "pistol": {
    "name": "P9 Pistol", "type": "hitscan",
    "damage": 25, "zoneMultiplier": { "head": 4, "torso": 1, "limb": 0.5 },
    "fireInterval": 0.25, "auto": false, "spreadDeg": 1.0,
    "magSize": 8, "reloadTime": 1.4, "range": 60,
    "noiseRadius": 25, "sfx": "pistol_shot"
  }
}
```

### Enemy archetype (`data/enemies.json`)
```json
{
  "guard_basic": {
    "hp": 60, "weapon": "pistol", "walkSpeed": 1.6, "runSpeed": 4.0,
    "visionRange": 22, "visionFovDeg": 110, "hearingScale": 1.0,
    "reactionTime": 0.6, "aimSpreadDeg": 6, "burstPause": [0.6, 1.4]
  }
}
```

### Versus maps
Same level format with `"mode": "versus"` (mission levels use `"mode": "mission"`). No guards, objectives or briefing. Instead: at least four `{ "type": "spawn", "cell": [c, r], "yaw": 0 }` entities, and pickups may carry `"respawn": <seconds>`. Match rules sit in a `"match"` block: `{ "killLimit": 10, "timeLimit": 300 }`.

### Objective types
`collect` (item in the player's inventory), `destroy` (prop or guard hp ≤ 0), `reach` (player inside a zone), `interact` (use a prop). Optional `requires` lists objectives that must be done first. New types need a schema entry and a handler in `sim/objectives`, nothing else.

## 4. Milestones

Each milestone ends playable. Each task is testable alone. Run `npm test` and the browser check before ticking a milestone off.

### M0 – Setup
- [ ] Vite + TypeScript strict + Three.js + zod + Vitest; scripts `dev`, `build`, `test`, `typecheck`.
- [ ] Folder structure from section 6, with the import rule from section 2 written into `README.md`.
- [ ] Fixed-timestep loop (60 Hz sim, interpolated render) and typed event bus, both with unit tests.
- [ ] Debug hooks from section 6 (`?level=`, `?players=`, `?debug=1`, `window.__game`).

**Done when:** `npm run dev` shows a spinning cube; `npm test` and `npm run typecheck` pass.

### M1 – Foundation (two players in a test room)
- [ ] Level schema + loader; load `test_room.json`. Invalid data produces a readable error naming the field.
- [ ] Level mesh builder: floors, ceilings, walls and ramps from the grid, merged into one mesh per material.
- [ ] `sim/collision`: circle-vs-grid movement with wall sliding, step-up ≤ 0.4 m, ramps, gravity. Unit tests: cannot pass through walls at any angle or at 4× normal speed; slides along walls; climbs a ramp; does not climb a 1 m ledge.
- [ ] Player controller: walk, strafe, crouch. No jumping.
- [ ] Input: keyboard + mouse with Pointer Lock; gamepad with dead zones and look-sensitivity curve; both map to `PlayerIntent`.
- [ ] Lobby screen: "press a key / press a button to join", assigns devices to slots 0 and 1.
- [ ] Split-screen renderer: two cameras, two view rectangles; `players=1` gives one full view.
- [ ] Each player sees the other as a placeholder actor.

**Done when:** two people walk around the test room at the same time, one on mouse+keyboard and one on gamepad, each in their own view, cannot leave the level, and see each other move. Holds 60 fps on a laptop with integrated graphics.

### M2 – Weapons
- [ ] Weapon schema + loader; pistol from data.
- [ ] `sim/weapons`: fire rate, spread, magazine, reload, reserve ammo. Unit tests for ammo counting and the reload timer.
- [ ] Hitscan: ray-vs-grid (grid traversal) and ray-vs-hitbox with zones head / torso / limb. Unit tests: wall blocks shot; correct zone reported.
- [ ] Damage, health, death and respawn in the test room.
- [ ] View model: pistol built from primitives, per-player layer, recoil kick and reload motion.
- [ ] Effects: muzzle flash, impact puff on walls, hit flash on the damaged player's view.
- [ ] HUD per view: health, magazine / reserve, crosshair.
- [ ] Placeholder synth SFX for shot, reload, empty click, hit.

**Done when:** the two players can shoot each other in the test room; head shots do more damage than limb shots; ammo and reload behave as the data says; each HUD shows only its own player's values.

### M3 – Versus mode
- [ ] `mode` field, `spawn` entities and `match` block in the level schema; loader checks that every spawn can reach every other spawn.
- [ ] Pickups: ammo and health, with respawn timers.
- [ ] Spawn selection: the spawn farthest from the opponent without line of sight to them; 1.5 s spawn protection.
- [ ] Match rules: first to the kill limit or highest score at the time limit; unit tests for scoring, tie and time-out.
- [ ] Arena 1, original design, about 20×20 cells: two height levels joined by ramps, several loops, no dead ends, props for cover.
- [ ] HUD additions per view: score of both players, match timer, kill notice.
- [ ] Flow: lobby → match → result screen → rematch or back to lobby.

**Done when:** two people play a complete match from lobby to result screen and start a rematch, without the debug flag. Nobody spawns in the opponent's sights. This is the first shippable game.

### M4 – Enemies (single-player from here to M5; test with `?players=1`)
- [ ] Enemy schema + loader; guard actor built from primitives (head, torso, limbs) with procedural walk animation.
- [ ] Pathfinding: A* on the grid respecting heights and closed doors, with path smoothing. Unit tests on a fixed map.
- [ ] Perception: vision cone with line-of-sight ray; hearing of `noiseRadius` events.
- [ ] State machine: `patrol → suspicious → attack → search → patrol`, plus `dead`. Reaction delay before the first shot. Unit tests for each transition.
- [ ] Guards alert other guards within earshot of a shot.
- [ ] Hit reactions by zone (flinch interrupts aiming), death fall, body stays.
- [ ] Guards shoot with spread from the archetype; the player takes damage.
- [ ] AI decisions run at 10 Hz, staggered across guards; movement stays at 60 Hz.
- [ ] Debug overlay: vision cones, current state and path per guard.

**Done when:** in the test room, a patrolling guard can be approached unseen from behind, notices the player in front of him, alerts a second guard by gunfire, loses the player and returns to patrol, and can be killed. Guards never walk through walls or get stuck for more than 2 seconds.

### M5 – First mission level
- [ ] Doors (open on interact, optionally locked by item), keycard pickup, destructible props, zones.
- [ ] `sim/objectives` with the four types and `requires`; unit tests for each type.
- [ ] Mission fails when the player dies.
- [ ] Level 1, a snowed-in research depot (original design), about 40×40 cells, 8–12 guards, 3 objectives (find keycard, destroy console, reach exit).
- [ ] Game state machine: menu (Mission / Versus) → briefing → playing ⇄ paused → debrief (success / failure, time, shots fired, accuracy) → retry or menu. The versus flow from M3 hangs off the same menu.
- [ ] HUD: objective list on a key press, "objective completed" notice.

**Done when:** one player can complete level 1 from menu to debrief without the debug flag; the mission can also be failed and retried; a stealthy route and a loud route both work. Versus still works from the same menu.

### M6 – Look & feel
- [ ] Low-resolution render targets with nearest-neighbour upscale; resolution setting.
- [ ] Procedural pixel textures (generated on canvas, `NearestFilter`) for the materials named in level legends.
- [ ] Vertex-colour lighting baked at level build (per-cell light values); distance fog; no realtime shadows.
- [ ] Final synth SFX set: shots, reload, footsteps, door, pickup, guard alert, hit, death, objective. Positional volume from the nearest player.
- [ ] Menu and settings: mouse and gamepad sensitivity, invert Y, split direction, volume. Stored in `localStorage` with try/catch.
- [ ] Performance pass: under 300 draw calls per view, steady 60 fps in level 1 and in the arena with two views.

**Done when:** the game reads as a late-90s console shooter at first glance, has sound for every action, and settings survive a reload.

### M7 – Extensions (optional, ask before starting)
- [ ] More weapons (silenced pistol, automatic rifle, something thrown), also as arena pickups
- [ ] More arena maps
- [ ] Difficulty levels that add objectives and tune guard values
- [ ] 4-player split-screen
- [ ] Gamepad aim assist
- [ ] Guards use cover; alarm panels that guards run to
- [ ] Music (synthesized, original)

## 5. Risks and open questions

| Risk | Impact | Mitigation |
|---|---|---|
| Two views double the render cost | Frame drops on weak machines | Low internal resolution, merged level meshes, no shadows; measure at the end of M1, not M6 |
| Collision glitches (stuck in corners, tunnelling) | Game feels broken | Sim-only unit tests incl. high-speed cases; sub-step movement when a step exceeds half the player radius |
| AI scope creep | M4 never finishes | Exactly the five states listed. Cover and alarms are M7 |
| One pistol makes versus monotonous | Matches get dull quickly | Accepted for M3; more weapons are the first M7 item to pull forward |
| Guards feel unfair or dumb | Stealth does not work | All tuning values live in `enemies.json`; debug overlay makes perception visible |
| 2.5D grid looks too blocky | Levels feel like a maze | Vary floor and ceiling heights, ramps, props, lighting. Judge after level 1 before considering another format |
| Pointer Lock and gamepads need a user gesture; browsers differ | Input fails silently | Lobby screen requires a click / button press; target current Chrome first, then check Firefox and Safari |
| Automated browser testing cannot pointer-lock | Executor cannot self-test | `window.__game.setIntent()` debug hook bypasses devices |
| Level authoring by an agent produces unplayable layouts | Wasted iterations | Loader validates: all starts, objective targets and the exit are reachable via A*; fail loudly otherwise |

Open question for Marcel (does not block M0–M3):
1. A1 assumes the single-player mission stays in scope after versus. If the game should be versus only, M4 and M5 are dropped and M6 follows M3.

## 6. Conventions for the executing model

### Folder structure
```
src/
  main.ts
  config.ts          # engine constants (tick rate, player radius, step height)
  core/  data/  sim/  input/  render/  audio/  ui/  game/
  data/levels/*.json  data/weapons.json  data/enemies.json
tests/               # mirrors src/sim and src/core
PLAN.md  README.md
```

### Coding style
- TypeScript strict, no `any`, no default exports.
- Sim: plain data objects and pure-ish functions (`update(world, intents, dt)`); no classes holding hidden state.
- No Three.js, DOM or audio imports under `src/sim`, `src/core` or `src/data`. Check with a grep before each milestone sign-off.
- No content values in code. Tunable numbers go into the JSON files; engine constants into `config.ts`.
- Randomness only through the seeded RNG in `core`.
- Small files, one responsibility each. Comment the why, not the what.
- One commit per task, message prefixed with the milestone (`M2: hitscan ray-vs-hitbox`).

### Testing
- Every `sim/` task ships with Vitest tests. `npm test` and `npm run typecheck` must pass before a task is ticked.
- Browser check per milestone against its "Done when" line.
- URL parameters: `?level=<id>` skips the menu, `?players=1|2`, `?debug=1` shows the FPS counter, collision outlines and the AI overlay.
- `window.__game` in debug mode exposes `world` (read-only), `setIntent(slot, intent)` and `step(n)` so the game can be driven without real input devices.

### Updating this file
- Tick tasks as they are completed.
- Anything done differently from the plan gets one line in the deviation log: date, milestone, what changed, why.

### Stop and ask before
- Adding a dependency or changing one named in section 1.
- Changing the level format beyond adding entity or objective types.
- Breaking the import rule in section 2.
- Starting any M7 item.
- Using any asset not generated in code.
- Spending more than about two attempts on a problem that looks architectural (collision model, split-screen rendering, sim/render separation). That goes back to the planner.

## Deviation log
| Date | Milestone | Deviation | Reason |
|---|---|---|---|
| | | | |
