# Retro FPS (GoldenEye-inspired) – Project Brief

## Goal
Build a browser-based first-person shooter in the spirit of the N64 classic *GoldenEye 007*: stealth-action levels, mission objectives, guards with simple AI, a low-poly retro look. It follows the earlier Bomber 3D project (a Bomberman clone).

**Important:** this game is *inspired by*, not a remake. Use no Bond names, original maps, music, sounds or ripped assets. Use your own setting, characters, levels and audio. Borrowing the gameplay ideas is fine.

## Feasibility (summary)
Doable, but much harder than Bomber 3D. Main differences:

| Area | Bomber 3D | Retro FPS |
|---|---|---|
| Movement | Grid-based | Free 3D movement, first-person camera |
| Collision | Tile checks | Capsule vs. level geometry, raycasts for hits |
| AI | Simple | Guards that patrol, detect, alert, take cover, shoot |
| Levels | Grid layout | 3D levels (low-poly, modelled or generated) |
| Controls | Keyboard | Mouse-look (Pointer Lock) + WASD, optional gamepad |
| Multiplayer | 2 players locally | Local split-screen possible; online = separate project |

## Workflow: plan with Fable 5.2, build with Opus 5.5
This split makes sense:

- **Fable 5.2 (planning):** architecture, tech choices, data structures, milestone breakdown, risks. The output is a short, concrete plan document (`PLAN.md`). This step uses few tokens, so the higher cost of the stronger model is worth it.
- **Opus 5.5 (execution):** implements the plan milestone by milestone, tests each one in the browser, and updates `PLAN.md` (check off tasks, note any deviations).
- Go back to Fable only if a milestone exposes a real architectural problem. Don't send every bug back to it.

### Instructions for the planning model (Fable 5.2)
Using this brief, write a `PLAN.md` that contains:
1. **Tech stack** with a short rationale (e.g. Three.js vs. Babylon.js, physics/collision approach, build tool, level format).
2. **Architecture:** modules (renderer, input, player controller, weapons, AI, level loader, game state, UI/HUD, audio) and how they talk to each other.
3. **Data formats:** levels, enemies, weapons and objectives, defined as data (JSON or similar) rather than hard-coded.
4. **Milestones** (see below), refined into small, independently testable tasks, each with clear acceptance criteria.
5. **Risks & open questions:** performance, collision quality, AI complexity, level creation workflow.
6. **Conventions** for the executing model: folder structure, coding style, how to test in the browser, when to stop and ask.

### Instructions for the executing model (Opus 5.5)
- Work strictly milestone by milestone, following `PLAN.md`.
- Each milestone must end in a playable state.
- Check off completed tasks in `PLAN.md` and document any deviations from the plan.
- Stop and ask before making architecture changes that go beyond the plan.

## Proposed milestones (to be refined by the planner)
1. **Foundation:** project setup, first-person camera, mouse-look, WASD movement, collision with a simple test room.
2. **Weapons:** one pistol, hitscan via raycast, muzzle flash, ammo, reloading, HUD.
3. **Enemies:** guards with patrol → detect → attack → death states, plus hit reactions.
4. **First level:** one complete small level with 2–3 objectives (e.g. "find the keycard", "destroy the console", "reach the exit"), with a mission briefing and mission end screen.
5. **Look & feel:** low-poly / pixelated retro style, fog, sound effects, simple menu.
6. **Extensions (optional):** more weapons, difficulty levels with extra objectives, local split-screen, gamepad support.

## Non-goals (for now)
- Online multiplayer
- Realistic graphics
- Using original GoldenEye content of any kind
