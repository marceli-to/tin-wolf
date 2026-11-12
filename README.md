# Tin Fox

A browser first-person shooter in the spirit of late-90s console shooters: stealth missions with guards and objectives, plus 2-player split-screen versus. Level geometry, textures and sound are generated in code; characters, the pistol and furniture are CC0 models. See `PLAN.md` for the plan and progress, `BRIEF.md` for the original brief.

## Run

```sh
npm install
npm run dev        # http://localhost:5181 (live reload)
npm run build      # dist/, served by Herd at https://tin-wolf.test (cd dist && herd link tin-wolf && herd secure tin-wolf)
npm test           # sim + core unit tests (Vitest, Node)
npm run typecheck
npm run build
```

## Deploy

`./deploy.sh` publishes the committed state to https://tinfox.kimiyu.ch (Hostpoint, same account as the other kimiyu sites, over SSH with your own key). It refuses to run with uncommitted changes, runs the tests, builds, and mirrors `dist/` (including `.htaccess`) into `www/tinfox.kimiyu.ch/public`, deleting files that are no longer part of the build.

Levels: `depot` (mission, Halvard Depot), versus arenas `arena_pumphouse`, `arena_warehouse` (raised corner platforms, pillar blocks) and `arena_snowfort` (outdoors, a hut in the middle), `training` (Training Ground: target practice, see below), `test_room` (sandbox with two guards). Versus in the menu lets you pick the map. The two new arenas are point-symmetric so neither start is better; they were generated with a small script and are plain level JSON.

URL parameters:

- `?level=<id>` skips the menu (missions go to the briefing, versus to the lobby)
- `?players=1|2`
- `?autostart=1` skips lobby and briefing (slot 0 = keyboard + mouse, others = gamepads)
- `?seed=<n>` fixes the sim RNG
- `?art=none` uses the code-built figures instead of the character models
- `?debug=1` shows FPS, collision boxes, guard vision cones / paths / states, and exposes `window.__game`

`window.__game` (debug only): `freeze()`, `step(n)`, `setIntent(slot, intent)`, `teleport(slot, x, z, yawDeg, pitchDeg)`, `look(slot, yawDeg, pitchDeg)`, `player(slot)`, `world`, and `autopilot(slot, [[col,row], …], { crouch, fight })`, which walks a route with the sim's own A*, opens doors and shoots visible guards. Example — the loud route through the depot:

```js
__game.autopilot(0, [[19,26],[19,23],[19,19],[19,15],[22,14],[23,16]], { fight: true })
```

## Training

Menu → Training (one or two players). An outdoor range with 17 round targets: close, mid and far lanes (the far ones are for the Heron LR), two moving targets on rails, a couple up on crates, and three small ones hidden behind tall crates that need a grenade lobbed over from close up. Targets tip over when hit (a centre hit is a *Bullseye!*) and stand up again after 2.5 s. You carry every weapon and reserves never run out.

The yellow button on the crate in front of the start runs a timed course: all targets stand up, hit ones stay down, and when the last one falls you get your time and hit rate. The best time is kept in the browser (`localStorage`) and shown on the range and in the Training menu. Targets are level entities (`"type": "target"`, optional `size: "small"`, `elevation`, and `to` + `speed` for a rail); the button is the `start_panel` prop.

## Weapons

Kestrel 9 pistol, Kestrel 9 SD (silenced: guards only hear it within 4 m), Vireo SMG (automatic), Heron LR sniper rifle (hold right click / LT to scope in: 4× zoom, no spread, slower look; in every arena, and in the depot yard behind a rock near the start) and frag grenades (bounce, 2.2 s fuse, blast blocked by walls, hurts the thrower too). Pistols share ammo. Guards drop pistol ammo; rifle guards drop their SMG. The depot starts you with both pistols; the arena with the Kestrel 9, and the rest lies around as pickups. Weapons, items and loadouts are data (`src/data/weapons.json`, `items.json`, a level's `loadout`).

## Controls

| | Keyboard + mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Sprint | Shift (hold) | Click left stick (lasts while pushing forward) |
| Jump | Space | A / Cross (uses a door instead if you face one) |
| Look | Mouse | Right stick |
| Fire | Left click | RT |
| Scope (Heron LR) | Right click (hold) | LT (hold) |
| Reload | R | X / Square |
| Next / previous weapon | Q or mouse wheel | Y / Triangle, LB |
| Weapon by number | 1–4 | |
| Use | E | A / Cross |
| Crouch | C or Ctrl (hold) | B / Circle (toggle) |
| Objectives | Tab | Back / Select |
| Pause | Esc | Start |

Nintendo controllers (Switch Pro) follow their printed labels: A jumps or uses, B crouches, X/Y as in the table, like in Switch games.

Guards fight smarter: after a burst, or when badly hurt, they may duck behind a crate or a wall corner, crouch for a moment and pop out again (`cover` chance per archetype in `enemies.json`). The first guard to spot you runs for the nearest yellow **alarm panel** (props with `"alarm": true`) instead of shooting — stop him, or shoot the panel first. If he gets there a siren sounds, every guard hunts you, and the level's reinforcements (guard entities with `"reserve": true`) arrive. Guards no longer hit each other.

Missions have three difficulties (left / right on the briefing, or Settings): Easy guards notice and react slower, miss more, hit softer and have less health; Hard is the reverse. The multipliers are data (`src/data/difficulty.json`).

Gamepads get aim assist: turning slows down over a visible enemy, and while you move or turn the aim drifts gently toward it (it never aims for you when you stand still). Mouse aiming is untouched.

Music is synthesised too (`src/audio/music.ts`, a small step sequencer): a menu theme, a quiet track while sneaking, a driving one while guards are fighting you or the alarm is up, and an upbeat versus track. It has its own volume.

Settings (menu or pause): mouse / gamepad sensitivity, invert look, gamepad aim assist, difficulty, music volume, split direction, volume, graphics (Smooth, or Retro 480–180p pixels). Saved in `localStorage`.

Third-party models are CC0 (Kenney); see `CREDITS.md`. To trim a new glTF to the animations you need: `python3 tools/trim_gltf.py in.gltf out.glb Idle Walk Run`.

Only one mouse can be pointer-locked in a browser, so in split-screen player 1 uses keyboard + mouse and player 2 a gamepad (or both use gamepads).

## Import rule

```
core/   imports nothing
data/   imports core
sim/    imports core, data         — never three, DOM or audio
input/  imports core
render/ imports core, sim (read-only)
audio/  imports core
ui/     imports core, sim (read-only)
game/   imports everything
```

Check before a milestone sign-off:

```sh
grep -rnE "from 'three'|document\.|window\.|AudioContext" src/sim src/core src/data
```
