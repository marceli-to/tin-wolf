import type { PlayerIntent } from '../core/intent';
import { DEG } from '../core/math';
import { floorAtWorld } from '../sim/grid';
import { autopilot, type AutopilotOptions } from './autopilot';
import type { Game } from './game';

/** `window.__game` in debug mode: drive the game without real input devices. */
export function installDebugHooks(game: Game): void {
  const api = {
    get game() {
      return game;
    },
    get world() {
      return game.world;
    },
    get state() {
      return game.state;
    },
    setIntent(slot: number, intent: Partial<PlayerIntent> | null) {
      game.setDebugIntent(slot, intent);
    },
    /** Stop automatic ticking so `step` is deterministic. */
    freeze(v = true) {
      game.frozen = v;
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) game.simStep();
      return game.world?.tick;
    },
    teleport(slot: number, x: number, z: number, yawDeg?: number, pitchDeg?: number) {
      const p = game.world?.players[slot];
      if (!p) return;
      p.x = p.prev.x = x;
      p.z = p.prev.z = z;
      p.y = p.prev.y = floorAtWorld(game.world!.grid, x, z) ?? p.y;
      p.vx = p.vz = p.vy = 0;
      if (yawDeg !== undefined) p.yaw = yawDeg * DEG;
      if (pitchDeg !== undefined) p.pitch = pitchDeg * DEG;
    },
    look(slot: number, yawDeg: number, pitchDeg = 0) {
      const p = game.world?.players[slot];
      if (!p) return;
      p.yaw = yawDeg * DEG;
      p.pitch = pitchDeg * DEG;
    },
    player(slot = 0) {
      const p = game.world?.players[slot];
      return p ? JSON.parse(JSON.stringify(p)) : null;
    },
    /** Walk slot through cells with A* (debug test driver). Freezes the loop while it runs. */
    autopilot(slot: number, goals: [number, number][], opts: AutopilotOptions = {}) {
      const w = game.world;
      if (!w) return null;
      game.frozen = true;
      return autopilot(w, slot, goals, (intent) => {
        game.setDebugIntent(slot, intent);
        game.simStep();
      }, opts);
    },
    events: [] as unknown[],
  };
  (window as unknown as { __game: typeof api }).__game = api;
}
