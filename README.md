# Tin Wolf

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

Levels: `depot` (mission, Halvard Depot), `arena_pumphouse` (versus), `test_room` (sandbox with two guards).

URL parameters:

- `?level=<id>` skips the menu (missions go to the briefing, versus to the lobby)
- `?players=1|2`
- `?autostart=1` skips lobby and briefing (slot 0 = keyboard + mouse, others = gamepads)
- `?seed=<n>` fixes the sim RNG
- `?art=kenney` swaps every model for Kenney's toy-like kits and draws level surfaces flat (art trial; same levels and gameplay)
- `?art=none` uses the code-built figures instead of the character models
- `?debug=1` shows FPS, collision boxes, guard vision cones / paths / states, and exposes `window.__game`

`window.__game` (debug only): `freeze()`, `step(n)`, `setIntent(slot, intent)`, `teleport(slot, x, z, yawDeg, pitchDeg)`, `look(slot, yawDeg, pitchDeg)`, `player(slot)`, `world`, and `autopilot(slot, [[col,row], …], { crouch, fight })`, which walks a route with the sim's own A*, opens doors and shoots visible guards. Example — the loud route through the depot:

```js
__game.autopilot(0, [[19,26],[19,23],[19,19],[19,15],[22,14],[23,16]], { fight: true })
```

## Weapons

Kestrel 9 pistol, Kestrel 9 SD (silenced: guards only hear it within 4 m), Vireo SMG (automatic) and frag grenades (bounce, 2.2 s fuse, blast blocked by walls, hurts the thrower too). Pistols share ammo. Guards drop pistol ammo; rifle guards drop their SMG. The depot starts you with both pistols; the arena with the Kestrel 9, and the rest lies around as pickups. Weapons, items and loadouts are data (`src/data/weapons.json`, `items.json`, a level's `loadout`).

## Controls

| | Keyboard + mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Look | Mouse | Right stick |
| Fire | Left click | RT |
| Reload | R | X / Square |
| Next / previous weapon | Q or mouse wheel | Y / Triangle, LB |
| Weapon by number | 1–4 | |
| Use | E | A / Cross |
| Crouch | C or Ctrl (hold) | B / Circle (toggle) |
| Objectives | Tab | Back / Select |
| Pause | Esc | Start |

Settings (menu or pause): mouse / gamepad sensitivity, invert look, split direction, volume, graphics (Smooth, or Retro 480–180p pixels). Saved in `localStorage`.

Third-party models are CC0 (Quaternius); see `CREDITS.md`. To trim a new glTF to the animations you need: `python3 tools/trim_gltf.py in.gltf out.glb Idle Walk Run`.

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
