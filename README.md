# Tin Wolf

A browser first-person shooter in the spirit of late-90s console shooters: stealth missions with guards and objectives, plus 2-player split-screen versus. Everything (geometry, textures, sound) is generated in code. See `PLAN.md` for the plan and progress, `BRIEF.md` for the original brief.

## Run

```sh
npm install
npm run dev        # http://localhost:5181
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
- `?debug=1` shows FPS, collision boxes, guard vision cones / paths / states, and exposes `window.__game`

`window.__game` (debug only): `freeze()`, `step(n)`, `setIntent(slot, intent)`, `teleport(slot, x, z, yawDeg, pitchDeg)`, `look(slot, yawDeg, pitchDeg)`, `player(slot)`, `world`, and `autopilot(slot, [[col,row], …], { crouch, fight })`, which walks a route with the sim's own A*, opens doors and shoots visible guards. Example — the loud route through the depot:

```js
__game.autopilot(0, [[19,26],[19,23],[19,19],[19,15],[22,14],[23,16]], { fight: true })
```

## Controls

| | Keyboard + mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Look | Mouse | Right stick |
| Fire | Left click | RT |
| Reload | R | X / Square |
| Use | E | A / Cross |
| Crouch | C or Ctrl (hold) | B / Circle (toggle) |
| Objectives | Tab | Back / Select |
| Pause | Esc | Start |

Settings (menu or pause): mouse / gamepad sensitivity, invert look, split direction, volume, internal resolution. Saved in `localStorage`.

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
