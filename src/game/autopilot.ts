import { PLAYER } from '../config';
import { emptyIntent, type PlayerIntent } from '../core/intent';
import { angleDiff, clamp, yawTo } from '../core/math';
import { interactTarget } from '../sim/doors';
import { worldToCell } from '../sim/grid';
import { clearLine } from '../sim/los';
import { findPath } from '../sim/nav';
import type { World } from '../sim/world';

export interface AutopilotOptions {
  crouch?: boolean;
  /** Shoot at guards it can see. */
  fight?: boolean;
  maxSeconds?: number;
}

export interface AutopilotResult {
  reached: boolean;
  ticks: number;
  alive: boolean;
  log: string[];
}

/**
 * Debug-only test driver: walks a player through a list of cells using the sim's own A*,
 * opens doors on the way and optionally fights. Used to check that level routes are playable.
 */
export function autopilot(
  world: World,
  slot: number,
  goals: [number, number][],
  step: (intent: PlayerIntent) => void,
  opts: AutopilotOptions = {},
): AutopilotResult {
  const p = world.players[slot]!;
  const s = world.grid.size;
  const log: string[] = [];
  const maxTicks = (opts.maxSeconds ?? 120) * 60;
  let ticks = 0;
  let lastStates = world.guards.map((g) => g.state).join();
  for (const [gc, gr] of goals) {
    const gx = (gc + 0.5) * s;
    const gz = (gr + 0.5) * s;
    let path: { x: number; z: number }[] = [];
    let pi = 0;
    let replan = 0;
    let stuck = 0;
    let last = { x: p.x, z: p.z };
    while (Math.hypot(p.x - gx, p.z - gz) > 0.6) {
      if (!p.alive || ticks > maxTicks || world.mission?.over) return { reached: false, ticks, alive: p.alive, log };
      if (replan <= 0 || pi >= path.length) {
        const [sx, sz] = worldToCell(world.grid, p.x, p.z);
        const cells = findPath(world.grid, sx, sz, gc, gr, { height: opts.crouch ? PLAYER.crouchHeight : PLAYER.height }, 20000);
        if (!cells) {
          log.push(`no path to [${gc},${gr}]`);
          return { reached: false, ticks, alive: p.alive, log };
        }
        path = cells.slice(1).map(([c, r]) => ({ x: (c + 0.5) * s, z: (r + 0.5) * s }));
        path.push({ x: gx, z: gz });
        pi = 0;
        replan = 60;
      }
      const intent = emptyIntent();
      intent.crouch = !!opts.crouch;
      let target = path[pi]!;
      if (Math.hypot(p.x - target.x, p.z - target.z) < 0.5 && pi < path.length - 1) target = path[++pi]!;
      const moveYaw = yawTo(p.x, p.z, target.x, target.z);
      let desiredYaw = moveYaw;
      let pitch = 0;
      let shooting = false;
      if (opts.fight) {
        let best: { yaw: number; pitch: number; d: number } | null = null;
        for (const g of world.guards) {
          if (g.state === 'dead') continue;
          const d = Math.hypot(g.x - p.x, g.z - p.z);
          if (d > 24) continue;
          const eye = p.y + (opts.crouch ? 1.0 : 1.6);
          if (!clearLine(world, p.x, eye, p.z, g.x, g.y + 1.3, g.z)) continue;
          if (!best || d < best.d) best = { yaw: yawTo(p.x, p.z, g.x, g.z), pitch: Math.atan2(g.y + 1.25 - eye, d), d };
        }
        if (best) {
          desiredYaw = best.yaw;
          pitch = best.pitch;
          shooting = true;
        }
      }
      const turn = angleDiff(p.yaw, desiredYaw);
      intent.lookYaw = clamp(turn, -0.25, 0.25);
      intent.lookPitch = pitch - p.pitch;
      // Move toward the path target relative to where we are looking, so it can strafe while shooting.
      const rel = angleDiff(p.yaw, moveYaw);
      if (shooting) {
        intent.fire = Math.abs(turn) < 0.05 && ticks % 14 === 0;
        intent.reload = p.weapon.mag === 0;
        intent.moveZ = Math.cos(rel) * 0.6;
        intent.moveX = Math.sin(rel) * 0.6;
      } else {
        intent.moveZ = Math.abs(turn) < 0.6 ? 1 : 0;
      }
      const it = interactTarget(world, p);
      if (it?.kind === 'door' && !it.locked && ticks % 20 === 0) intent.interact = true;
      step(intent);
      ticks++;
      replan--;
      if (Math.hypot(p.x - last.x, p.z - last.z) > 0.3) {
        last = { x: p.x, z: p.z };
        stuck = 0;
      } else if (!shooting && ++stuck > 180) {
        log.push(`stuck near ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
        stuck = 0;
        replan = 0;
      }
      const states = world.guards.map((g) => g.state).join();
      if (states !== lastStates) {
        lastStates = states;
        const alerted = world.guards.filter((g) => g.state === 'attack').map((g) => g.id);
        if (alerted.length) log.push(`t=${(ticks / 60).toFixed(1)} attack: ${alerted.join(',')}`);
      }
    }
    log.push(`t=${(ticks / 60).toFixed(1)} at [${gc},${gr}] hp ${Math.ceil(p.hp)}`);
  }
  return { reached: true, ticks, alive: p.alive, log };
}
