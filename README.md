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

URL parameters: `?level=<id>` skips the menu, `?players=1|2`, `?debug=1` shows FPS, collision outlines and the AI overlay and exposes `window.__game`.

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
