# PLAN.md – Tin Fox

Working title so far: "Retro FPS". The game's name is **Tin Fox** (renamed from Tin Wolf on 2026-11-12 to fit the toy look); use it for the page title, menu and `package.json` name (`tin-fox`). The repository, folder and Herd site keep `tin-wolf`.

Planning document for the executing model. Work through it top to bottom. Check off tasks as they are done and record every deviation in the log at the end.

## Status (2026-11-12)

M0–M6 are done. M7 is done except 4-player split-screen: more weapons, gamepad aim assist, difficulty levels, guard cover and alarm panels, two more arenas with a map picker, and synthesised music (all asked for by Marcel). Everything is on `master` and pushed (last commit `fe6ef28`). 97 unit tests, typecheck and build pass. `npm run build` updates `dist/`, which Herd serves at https://tin-wolf.test (linked and secured; see README).

Verified by script in the browser (headless Chrome via a throwaway playwright-core script outside the repo; the in-app preview cannot capture the WebGL canvas): movement and collision, split-screen, weapons and damage, full versus match → results → rematch, every guard state transition in the test room, the depot's stealth route and loud route end to end (debug autopilot), mission fail → debrief → retry, settings surviving a reload, draw calls.

Art direction changed after M6 (see deviation log, "Art" rows): the default look is Kenney CC0 (Mini Characters, Blaster Kit, furniture and prop kits) with flat level textures. The earlier Quaternius set has been removed. Smooth rendering by default.

Repository: https://github.com/marceli-to/tin-wolf (`master`). Live: https://tinfox.kimiyu.ch (upload the contents of `dist/` to the subdomain root).

Audience: Marcel plays this with his kids, so the look is deliberately toy-like (Kenney) and Easy difficulty exists for them.

Next (ask first): 4-player split-screen is the only open M7 item. Other ideas not yet raised: difficulty adding objectives (the M7 item only tunes guard values so far), a second mission, a proper roof on the Snowfort hut (its walls rise to the 7 m sky ceiling), first-person SMG held two-handed (third-person figures already use the two-handed pose).

Still needs a human:

- Mouse-look feel with pointer lock, and sensitivity defaults
- A real gamepad as player 2 (dead zones, look curve, button mapping). Marcel uses a Switch Pro Controller on a MacBook; A/B and X/Y now follow its labels. Aim-assist strength (`AIM_ASSIST` in `src/config.ts`) has not been felt on a real pad yet
- The sound mix and the music (all synthesised; the executor cannot hear them). Music levels are per voice in `src/audio/music.ts`
- 60 fps on a laptop with integrated graphics, and Firefox / Safari
- Playing the depot by hand: is the corridor timing on the stealth route fair, are guards too sharp or too dull per difficulty (`src/data/difficulty.json`), is the alarm runner too punishing, does cover feel natural
- Weapon feel: SMG recoil and spread, grenade arc, bounce and blast radius (all in `src/data/weapons.json`)

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
- [x] Vite + TypeScript strict + Three.js + zod + Vitest; scripts `dev`, `build`, `test`, `typecheck`.
- [x] Folder structure from section 6, with the import rule from section 2 written into `README.md`.
- [x] Fixed-timestep loop (60 Hz sim, interpolated render) and typed event bus, both with unit tests.
- [x] Debug hooks from section 6 (`?level=`, `?players=`, `?debug=1`, `window.__game`).

**Done when:** `npm run dev` shows a spinning cube; `npm test` and `npm run typecheck` pass.

### M1 – Foundation (two players in a test room)
- [x] Level schema + loader; load `test_room.json`. Invalid data produces a readable error naming the field.
- [x] Level mesh builder: floors, ceilings, walls and ramps from the grid, merged into one mesh per material.
- [x] `sim/collision`: circle-vs-grid movement with wall sliding, step-up ≤ 0.4 m, ramps, gravity. Unit tests: cannot pass through walls at any angle or at 4× normal speed; slides along walls; climbs a ramp; does not climb a 1 m ledge.
- [x] Player controller: walk, strafe, crouch. No jumping.
- [x] Input: keyboard + mouse with Pointer Lock; gamepad with dead zones and look-sensitivity curve; both map to `PlayerIntent`.
- [x] Lobby screen: "press a key / press a button to join", assigns devices to slots 0 and 1.
- [x] Split-screen renderer: two cameras, two view rectangles; `players=1` gives one full view.
- [x] Each player sees the other as a placeholder actor.

**Done when:** two people walk around the test room at the same time, one on mouse+keyboard and one on gamepad, each in their own view, cannot leave the level, and see each other move. Holds 60 fps on a laptop with integrated graphics.

### M2 – Weapons
- [x] Weapon schema + loader; pistol from data.
- [x] `sim/weapons`: fire rate, spread, magazine, reload, reserve ammo. Unit tests for ammo counting and the reload timer.
- [x] Hitscan: ray-vs-grid (grid traversal) and ray-vs-hitbox with zones head / torso / limb. Unit tests: wall blocks shot; correct zone reported.
- [x] Damage, health, death and respawn in the test room.
- [x] View model: pistol built from primitives, per-player layer, recoil kick and reload motion.
- [x] Effects: muzzle flash, impact puff on walls, hit flash on the damaged player's view.
- [x] HUD per view: health, magazine / reserve, crosshair.
- [x] Placeholder synth SFX for shot, reload, empty click, hit.

**Done when:** the two players can shoot each other in the test room; head shots do more damage than limb shots; ammo and reload behave as the data says; each HUD shows only its own player's values.

### M3 – Versus mode
- [x] `mode` field, `spawn` entities and `match` block in the level schema; loader checks that every spawn can reach every other spawn.
- [x] Pickups: ammo and health, with respawn timers.
- [x] Spawn selection: the spawn farthest from the opponent without line of sight to them; 1.5 s spawn protection.
- [x] Match rules: first to the kill limit or highest score at the time limit; unit tests for scoring, tie and time-out.
- [x] Arena 1, original design, about 20×20 cells: two height levels joined by ramps, several loops, no dead ends, props for cover.
- [x] HUD additions per view: score of both players, match timer, kill notice.
- [x] Flow: lobby → match → result screen → rematch or back to lobby.

**Done when:** two people play a complete match from lobby to result screen and start a rematch, without the debug flag. Nobody spawns in the opponent's sights. This is the first shippable game.

### M4 – Enemies (single-player from here to M5; test with `?players=1`)
- [x] Enemy schema + loader; guard actor built from primitives (head, torso, limbs) with procedural walk animation.
- [x] Pathfinding: A* on the grid respecting heights and closed doors, with path smoothing. Unit tests on a fixed map.
- [x] Perception: vision cone with line-of-sight ray; hearing of `noiseRadius` events.
- [x] State machine: `patrol → suspicious → attack → search → patrol`, plus `dead`. Reaction delay before the first shot. Unit tests for each transition.
- [x] Guards alert other guards within earshot of a shot.
- [x] Hit reactions by zone (flinch interrupts aiming), death fall, body stays.
- [x] Guards shoot with spread from the archetype; the player takes damage.
- [x] AI decisions run at 10 Hz, staggered across guards; movement stays at 60 Hz.
- [x] Debug overlay: vision cones, current state and path per guard.

**Done when:** in the test room, a patrolling guard can be approached unseen from behind, notices the player in front of him, alerts a second guard by gunfire, loses the player and returns to patrol, and can be killed. Guards never walk through walls or get stuck for more than 2 seconds.

### M5 – First mission level
- [x] Doors (open on interact, optionally locked by item), keycard pickup, destructible props, zones.
- [x] `sim/objectives` with the four types and `requires`; unit tests for each type.
- [x] Mission fails when the player dies.
- [x] Level 1, a snowed-in research depot (original design), about 40×40 cells, 8–12 guards, 3 objectives (find keycard, destroy console, reach exit).
- [x] Game state machine: menu (Mission / Versus) → briefing → playing ⇄ paused → debrief (success / failure, time, shots fired, accuracy) → retry or menu. The versus flow from M3 hangs off the same menu.
- [x] HUD: objective list on a key press, "objective completed" notice.

**Done when:** one player can complete level 1 from menu to debrief without the debug flag; the mission can also be failed and retried; a stealthy route and a loud route both work. Versus still works from the same menu.

### M6 – Look & feel
- [x] Low-resolution render targets with nearest-neighbour upscale; resolution setting.
- [x] Procedural pixel textures (generated on canvas, `NearestFilter`) for the materials named in level legends.
- [x] Vertex-colour lighting baked at level build (per-cell light values); distance fog; no realtime shadows.
- [x] Final synth SFX set: shots, reload, footsteps, door, pickup, guard alert, hit, death, objective. Positional volume from the nearest player.
- [x] Menu and settings: mouse and gamepad sensitivity, invert Y, split direction, volume. Stored in `localStorage` with try/catch.
- [x] Performance pass: under 300 draw calls per view, steady 60 fps in level 1 and in the arena with two views.

**Done when:** the game reads as a late-90s console shooter at first glance, has sound for every action, and settings survive a reload.

### M7 – Extensions (optional, ask before starting)
- [x] More weapons (silenced pistol, automatic rifle, something thrown), also as arena pickups
- [x] More arena maps (Warehouse, Snowfort; map picker under Versus)
- [x] Difficulty levels that tune guard values (Easy / Normal / Hard; no extra objectives yet)
- [ ] 4-player split-screen
- [x] Gamepad aim assist
- [x] Guards use cover; alarm panels that guards run to
- [x] Music (synthesized, original)

### M8 – Movement, weapons, levels, online (asked for by Marcel, 2026-11-12)
Order: sprint, jump, sniper rifle; the rest after asking.
- [x] Sprint (Shift / left-stick click): faster forward run, louder footsteps that guards hear from further away, slight FOV kick
- [x] Jump (Space / A when nothing to use); re-check the depot routes for crates and fences that become hoppable
- [x] Sniper rifle (Heron LR, Kenney `blaster-e` with a scope): long blaster, zoom while aiming (right click / LT), scope overlay, slower look while zoomed, works in split-screen and with aim assist; arena pickup
- [ ] More levels: more versus arenas (quick), a second mission (a day or more)
- [ ] Online versus: peer-to-peer over WebRTC with PeerJS, lockstep on the deterministic sim (players exchange intents), host/join with a room code, input delay or prediction, disconnect handling; TURN relay for strict networks

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
| 2026-11-12 | M0 | Pinned latest stable: TypeScript 7.0.2 (native compiler), Vite 8.3.8, Vitest 5.1.0, zod 4.6.7, Three.js 0.187.0 | "Install the latest stable versions" |
| 2026-11-12 | M0 | One commit per milestone step group instead of strictly one per task | Tasks within M0/M1 are tightly coupled; history stays readable |
| 2026-11-12 | M1 | `PlayerIntent` look is a per-tick delta (`lookYaw`, `lookPitch`, radians) instead of absolute `look: {yaw, pitch}`; move is `moveX`/`moveZ` | Mouse and stick both produce deltas; the sim owns the absolute angles |
| 2026-11-12 | M1 | Added `?autostart=1` (skips the lobby) and debug hooks `freeze`, `teleport`, `look`, `player` next to `setIntent`/`step` | Deterministic browser checks without devices |
| 2026-11-12 | M1 | Level format additions: cell `sky`, `light`, `ceilMat`; level `fog`; entity `light`; `ramp` is the direction of ascent with `floor` = low end, `floorTo` = high end | Needed for outdoor areas and M6 lighting; plan example left ramp semantics open |
| 2026-11-12 | M1 | New data files `items.json` and `props.json` (prop sizes, materials, hp; item kinds) | Keeps content values out of code, as the plan requires |
| 2026-11-12 | M1 | Doors are thin slabs that slide up (collision boxes), not cell blockers | Players can stand right at a door; also how it renders |
| 2026-11-12 | M1 | Gamepad crouch is a toggle kept in the input layer; the sim only sees `crouch: boolean` | Keeps the sim free of device-specific state |
| 2026-11-12 | M2 | Weapon data gains `startReserve`/`maxReserve`; head shot with the pistol is 100 dmg (one-shot kill) | Matches the plan's 4x head multiplier; tune in `weapons.json` if too harsh |
| 2026-11-12 | M2 | Armour field on players (soaks 2/3 of damage) and `items.json` armour item | Cheap now, used by M3 pickups |
| 2026-11-12 | M2 | Spawn selection (no line of sight, then farthest) and bullet-hole decals done in M2 | Respawn was needed for M2's death loop; decals are part of the impact effect |
| 2026-11-12 | M2 | `startLoop` (requestAnimationFrame) moved from `core/` to `game/loop.ts`; `core/loop.ts` keeps only the pure accumulator | Import rule: no DOM APIs in core |
| 2026-11-12 | M3 | Reachability checks live in `sim/validate.ts` (uses the sim's nav), run by the game before a level starts and by a Vitest test over every shipped level, not inside `data/` | `data/` may not import `sim/`; the test makes bad levels fail `npm test` |
| 2026-11-12 | M3 | A* (`sim/nav.ts`) written in M3 instead of M4 | Needed for the spawn reachability check; M4 reuses it |
| 2026-11-12 | M3 | Arena 1 is "Pumphouse" (20×20); a draw is shown as "DRAW" (no sudden death); a finished match freezes the sim | Simplest rule that satisfies "tie" |
| 2026-11-12 | M3 | Until the M5 menu exists, the default URL opens the versus lobby on Pumphouse | Versus is the first shippable mode |
| 2026-11-12 | M4 | Enemy archetypes gain `damageScale`, `burst`, `legs`; a second archetype `guard_officer` | Guards at full pistol damage were too lethal; officer gives the level variety |
| 2026-11-12 | M4 | Vision range scales with the target cell's `light` and with crouching | Makes the stealth route a real choice; uses the cell light already in the format |
| 2026-11-12 | M4 | Guard-made noises carry over one tick (`world.noiseCarry`) | Guards act after noises are collected, so their own shots would otherwise never be heard |
| 2026-11-12 | M4 | Combat writes `flinch` / `lastHurtBy` on the guard and the AI reacts on its next update (no callback registry) | Keeps sim free of hidden mutable state |
| 2026-11-12 | M4 | Blood particles are skipped for hits on the local player in single view | They burst right in front of the camera; the hurt overlay already signals the hit |
| 2026-11-12 | M5 | Level 1 is "Halvard Depot" (40×40, 11 guards incl. 2 officers). Stealth route: maintenance duct → generator room → time the corridor patrol → office; loud route: front door | Both verified end to end with the debug autopilot (`__game.autopilot`), see below |
| 2026-11-12 | M5 | Sound through walls or closed doors only carries half its radius | Without it one shot alerted the whole building and stealth was impossible |
| 2026-11-12 | M5 | A key unlocks its door for good; guards open unlocked doors they walk up to; doors close after 4 s unless someone stands in them | Simplest door rules that make the level read clearly |
| 2026-11-12 | M5 | Solid cells may set `wall` to override the look of the room they face (cell field `wall` is optional now) | Exterior brick / rock walls without a legend entry per room |
| 2026-11-12 | M5 | Debug-only autopilot (`src/game/autopilot.ts`) walks a route with the sim's A*, opens doors and fights | Lets an agent check "both routes work" without a human |
| 2026-11-12 | M5 | Pause also triggers when the mouse is released (pointer-lock loss), since browsers swallow Esc while locked | Esc would otherwise only free the mouse |
| 2026-11-12 | M5 | Objectives show for 5 s at mission start and toggle with Tab / Back; the interaction prompt names the missing key | Discoverability |
| 2026-11-12 | M6 | Low resolution is done by rendering the whole canvas at the internal height (default 240 px; stacked split doubles it) and upscaling with CSS `image-rendering: pixelated`, not one render target per view | Same result, no extra pass; the DOM HUD stays sharp |
| 2026-11-12 | M6 | Textures use nearest magnification but nearest-mipmap minification | Pure nearest shimmered badly on distant walls |
| 2026-11-12 | M6 | Baked light is a bilinear field over cell `light` values plus `light` entities (lamps), sampled per vertex; actors are tinted by the field where they stand | Smooth pools of light instead of per-cell blocks |
| 2026-11-12 | M6 | Added falling snow over open-sky cells, guard footsteps (`guardStep` event, not heard by other guards), mission success/fail jingles | Atmosphere; lets players hear patrols coming |
| 2026-11-12 | M6 | Settings also include a resolution option (180/240/360/480/native); `noUnusedLocals` enabled | Weak machines and personal taste; keeps the code tidy |
| 2026-11-12 | M6 | Measured in Chrome on the dev machine: Pumphouse 2 views ≈ 45 draw calls per view, Depot ≈ 170 per view, 60 fps. Not yet measured on integrated graphics | Needs a human on a weaker laptop |
| 2026-11-12 | Art | **A5 overridden by Marcel:** free CC0 asset packs are allowed. Guards are Quaternius characters (SWAT for guards, suit for officers) with their animations; players use a tinted SWAT model; the pistol (world and first person) is the Quaternius Toon Shooter pistol; office furniture is Kenney's Furniture Kit, desaturated. `?art=none` restores the code-built figures | The code-built boxes looked too crude; Kenney's characters were too cartoonish for the setting (trial on branch `trial/kenney`) |
| 2026-11-12 | Art | Default rendering is now smooth: native resolution at the device pixel ratio, MSAA, filtered textures. "Retro" 480/360/240/180p with nearest filtering stays as the Graphics setting | Marcel found the 240p pixel look too heavy |
| 2026-11-12 | Art | Procedural textures redrawn at 128 px (grime noise, bevels, rivets, per-brick and per-tile variation) | 32 px pixel art looked blurry once filtered |
| 2026-11-12 | Art | Props may carry a `model`, `modelScale` and `solid: false` (decoration); prop entities take `elevation`. Models load once at boot (`render/models.ts`) | Level-format addition needed for furniture |
| 2026-11-12 | Art | `tools/trim_gltf.py` strips unused animations and repacks models as binary GLB (characters 6.4 MB → 2.4 MB) | Download size; no new npm dependency |
| 2026-11-12 | Art | Depot hall now ≈ 250 draw calls per view (each character has 7 materials); still under the 300 budget | Merging materials per character is the next step if it gets tight |
| 2026-11-12 | Art | Characters use the pistol built into the Quaternius model (skinned, follows every gun animation); first-person arms are the player's own SWAT model in the aiming pose with the head collapsed; muzzle flashes sit on the barrel tip found from the mesh | The separately attached pistol ended up at the feet (three.js strips '.' from bone names, so `Wrist.R` is `WristR`); the box hand looked wrong next to the new art |
| 2026-11-12 | Art | Every depot room is furnished with Kenney CC0 kits (furniture, factory, space station, survival, car, city industrial): lab gear, tanks and pipes, bunks and lockers, vehicles, containers, fences, rocks. Yard and garage guards wear a winter uniform (`uniform` colour on enemies and guard entities). Cell `step` look keeps hazard stripes on platform edges only; explicit solid-wall looks only face outdoors | Bare rooms were the biggest visual gap; Quaternius' Drive hit its download quota, Kenney downloads reliably |
| 2026-11-12 | Art | Static props are merged into one mesh per material at load (`render/staticBatch.ts`); characters are culled per view by frustum and by grid rays (hidden when walls block head, waist and feet). Worst draw calls across 60 random depot views: 107 (was 438) | Without occlusion culling, everything behind the building walls was drawn |
| 2026-11-12 | Art | Model props are centred on their collision box and stood on its floor automatically; collision sizes come from the measured model bounds (`tools/glb_bounds.py`) | Kits use different origins (corner vs. centre) |
| 2026-11-12 | Art | All Kenney props replaced with Quaternius (Sci-Fi Essentials Kit, Ultimate Furniture): crates, barrels, lockers, shelves, lab desks, satellite dish, beds, tables, chairs; pickups use the kit's health pack, ammo box and keycard. Vehicles, containers and tanks became tarp-covered cargo; props with no counterpart (monitors, plants, lamps, cones, rocks, fences, pipes) were dropped (140 → 107 entities). Guards hold the Ultimate Gun Pack pistol (`swapHeldGun`, also in first person); depot staff (`look: "worker"`) wear the Worker outfit. Kit textures are shared PNGs (`tools/gltf_pack.py --shared-tex`). Worst view ≈ 154 draw calls (was 107) | Marcel disliked the Kenney/Quaternius style mix; one author keeps the look consistent. Both depot routes re-checked with the autopilot |
| 2026-11-12 | Art | Model props get metalness capped at 0.15 and a little more baked light | glTF defaults metalness to 1; without an environment map the kit props rendered near-black |
| 2026-11-12 | Art | Kenney trial again, behind `?art=kenney`, for a kid-friendly toy look from one author: Mini Characters (security guard, suit officer, worker; soldier and a second figure as players), Blaster Kit guns and grenade, Kenney furniture, space-station, factory and survival props. Art sets now carry model overrides for props, items and weapons (`ArtSet.overrides`), so levels and sim stay identical; props can fit their collision box (`modelFit: footprint / stretch`). Kenney figures have no gun of their own: guns attach to the empty hand (`grip`) and the arm pose is layered over walk/run (`armed`). Level textures get a flat style (`useFlatTextures`). Keycards and medkit use the code-built shapes. The Space Kit satellite dish is squat (≈1.3 m), so the top of its 4.3 m collision box is invisible | Marcel wants a less realistic look the kids can play; models total 2 MB instead of 12 MB |
| 2026-11-12 | Art | Kenney is now the default art set; first person shows the blaster alone (figure meshes hidden, `gunOnly`). Quaternius stays loadable with `?art=quaternius` | Marcel chose the Kenney look |
| 2026-11-12 | Art | Kenney polish: hit zones follow the figure (`World.body`: 'chibi' with Kenney, head from 44 % of height, head bonus halved so a centred shot is not always ×4); weapons carry `hold: one / two` and figures switch to Kenney's two-handed pose for the SMG; lab desks use the furniture desk (the space-station tables are solid pedestals); art sets can set a `mood` (baked light lifted to 0.5, fog lightened and pushed back) | Kenney heads fill over half the figure; Marcel asked for the rough edges to be fixed |
| 2026-11-12 | M7 | **More weapons** (asked for by Marcel): Kestrel 9 SD (silenced, 4 m noise), Vireo SMG (automatic) and frag grenades (projectile with bounces, rolling drag, fuse, line-of-sight blast, self-damage, alerts guards like a shot). Players own several weapons with shared ammo pools (`ammo` per weapon); switch with Q / wheel / 1–4 / pad Y and LB (0.4 s, no firing). Levels set a `loadout` (depot: both pistols). Items gain `weapon` and `ammo` kinds; a new gun is drawn on pickup. Guards drop loot (`drop` on archetypes); new `guard_rifle` archetype with the SMG guards the yard and garage | Plan item; the SMG is a submachine gun rather than a rifle because the pose is one-handed |
| 2026-11-12 | M7 | Held weapons: every pack gun is placed with `swapHeldGun` relative to the reference pistol (`ref`), so sizes stay true; the silenced pistol is Pistol_5 with the pack's short silencer merged in. Grenades in hand are scaled to the palm (`fit: 'hand'`) | One rig, one pose, several guns |
| 2026-11-12 | M7 | Grenades update before guards in the tick so the AI hears an explosion the same tick | Found by test: explosions after `updateGuards` were never heard |
| 2026-11-12 | M7 | `swapHeldGun` maps gun-pack axes (barrel +x, up +y) onto the built-in pistol mesh (barrel -x, up +z) with a fixed basis instead of a half-turn about y | Every swapped gun lay on its side; Marcel spotted it once the SMG made it obvious |
| 2026-11-12 | M7 | Guards: cover (after a burst with archetype `cover` chance, or below half health: nearest spot behind a ≥0.8 m prop or a wall edge that hides a crouching body from the target; crouch 1.2–2.6 s, then fight on) and alarm panels (first alerted guard runs to the nearest intact panel within 30 m; reaching it raises the alarm: all guards hunt, `reserve` guards spawn). Guard shots pass through other guards. Depot: five panels, three reserves | Requested by Marcel; friendly fire killed guards once the alarm made them converge |
| 2026-11-12 | Input | Nintendo pads (browser id contains Nintendo / Pro Controller / Joy-Con / 057e) get A/B and X/Y swapped in `Gamepads.poll`, so the printed labels match the game's buttons | Browsers report face buttons by position; Marcel's Switch Pro Controller had A and B the wrong way round |
| 2026-11-12 | M7 | Gamepad aim assist runs in the sim (`sim/aimAssist.ts`) on intents with `aimAssist` (set by the gamepad device, toggle in Settings): look slowed to 45 % over a visible target in a 6° cone (+ target width), pull up to 0.9 rad/s toward it only while moving or turning | Deterministic and testable; never aims for an idle player |
| 2026-11-12 | M7 | Difficulty: `data/difficulty.json` multipliers applied to every enemy archetype at world creation (`World.enemies`, read by `guardDef`); picked with left/right on the briefing or in Settings. Briefing body max-height raised to 60vh so the difficulty line and objectives fit | Plan item; no extra objectives per difficulty yet |
| 2026-11-12 | M7 | Arenas `arena_warehouse` and `arena_snowfort`, point-symmetric (generated by a throwaway script, committed as plain JSON); Versus in the main menu lists every `mode: versus` level, Esc / B backs out | Plan item |
| 2026-11-12 | M7 | Music: `audio/music.ts`, a Web Audio step sequencer sharing the SFX context; moods menu / sneak / alert / versus, alert while any guard attacks or the alarm is up (held 6 s), changes at bar lines; separate music volume | Plan item; original tunes, nothing from Bond / GoldenEye |
| 2026-11-12 | UI | Menus and HUD restyled to match the Kenney toy look: Fredoka (OFL, self-hosted in `public/assets/fonts/`), cream cards with navy outlines, pill buttons, sky backdrop; HUD as chips (heart + health bar, ammo card, key-cap prompts, P1 blue / P2 red score badges, ring crosshair); "Knocked out!" instead of "YOU ARE DOWN". Settings rows show their value inline; menus with more than six items get a compact layout | The dark Courier panels no longer fitted the bright Kenney art. Kenney Fonts could not be fetched (kenney.nl gates zips); Fredoka can be swapped for it if Marcel downloads the pack |
| 2026-11-12 | Art | Quaternius set removed (12 MB): the Kenney models now sit directly in `props.json`, `items.json` and `weapons.json`; art-set overrides, the built-in-gun swap (`swapHeldGun`), `gunRef`, `viewGun` and model tinting are gone. `?art=none` still shows the code-built figures | Marcel settled on Kenney; the site went live and the old models were dead weight |
| 2026-11-12 | Name | Game renamed Tin Wolf → **Tin Fox** (menu, lobby, page title, `package.json`). Settings keep the `tin-wolf.settings.v2` storage key so they survive | Marcel's pick to fit the toy look; live at tinfox.kimiyu.ch |
| 2026-11-12 | Site | `public/.htaccess` (HTTPS redirect, `.glb`/`.ttf` types, gzip incl. models, `index.html` no-cache, hashed bundle cached a year, models/font/icons a week), fox favicon (`favicon.svg` + 32 px PNG + apple-touch icon), OpenGraph/Twitter card `og-image.png` (1200×630, depot yard screenshot with the logo card) and description meta. Settings: Difficulty wraps round when clicked | Live site at tinfox.kimiyu.ch (Hostpoint, Apache); clicking Difficulty got stuck on Hard |
| 2026-11-12 | M8 | Sprint: `sprint` intent (Shift held; pad: left-stick click starts it, it lasts while the stick stays forward and clears pad crouch). 7.5 m/s forward only, standing; sprint footsteps reach guards at 11 m instead of 6; +7° FOV eased in the renderer. Shift no longer crouches (C / Ctrl do) | Marcel's list |
| 2026-11-12 | M8 | Jump: `jump` intent, edge-triggered, from the ground, not crouched; apex `PLAYER.jumpHeight` 0.85 m (plus the 0.4 m step-up: crates, barrels, desks, consoles and the arenas' 1.2 m platforms are reachable, tall crates, cargo and lockers are not). `updateVertical` only snaps to the ground while not rising; head bump under low ceilings; landings make footsteps. Pad A jumps unless a door or usable prop is in front | Kids can climb crates; depot routes unchanged (walls and doors are full height) |
| 2026-11-12 | M8 | Sniper rifle `sniper` (Heron LR, rifle ammo, 70 damage ×3 head, 4-round mag, 6° hip spread): weapons get `zoom` (magnification). `aim` intent (right mouse / LT) scopes in over 1/6 s when not switching or reloading; scoped: spread gone, moving spread reduced, look (sim and the render-rate mouse look) scaled by 1/zoom, sprint off, aim-assist cone narrowed by the zoom; renderer narrows the FOV and hides the gun, HUD shows a scope. Pickups: centre of Pumphouse (replaces the centre medkit), one per platform in Warehouse, one per corner fort in Snowfort, plus rifle ammo. Depot: behind the rock near the start (cell 13,34), spare rounds in the guard quarters (30,8); sniping the yard is a loud-route option (noise radius 40 m). Digit 5 selects a fifth weapon | Model: Kenney Blaster Kit `blaster-e` (the long one with a scope), downloaded by Marcel |
