import { forwardFromAngles } from '../core/math';
import type { PlayerIntent } from '../core/intent';
import { playerEyeHeight } from './player';
import { rayBox } from './raycast';
import { doorBox, emit, type Door, type Player, type Prop, type World } from './world';

const OPEN_SPEED = 1.8;
const STAY_OPEN = 4;
const REACH = 2.2;
const GUARD_OPEN_RADIUS = 1.8;

export function doorCenter(world: World, d: Door): { x: number; z: number } {
  const s = world.grid.size;
  return { x: (d.cx + 0.5) * s, z: (d.cz + 0.5) * s };
}

export type InteractTarget = { kind: 'door'; door: Door; locked: boolean } | { kind: 'prop'; prop: Prop } | null;

/** What the player is looking at within reach: a door or a usable prop. */
export function interactTarget(world: World, p: Player): InteractTarget {
  const dir = forwardFromAngles(p.yaw, p.pitch);
  const ray = { ox: p.x, oy: p.y + playerEyeHeight(p), oz: p.z, dx: dir.x, dy: dir.y, dz: dir.z };
  let best: InteractTarget = null;
  let bestT = REACH;
  for (const d of world.doors) {
    if (d.open > 0.5) continue;
    const h = rayBox(ray, doorBox(world, d), bestT);
    if (h) {
      bestT = h.t;
      best = { kind: 'door', door: d, locked: d.requires !== null && !p.inventory.includes(d.requires) };
    }
  }
  for (const pr of world.props) {
    if (!pr.alive || !pr.usable || pr.used) continue;
    const h = rayBox(ray, pr.box, bestT);
    if (h) {
      bestT = h.t;
      best = { kind: 'prop', prop: pr };
    }
  }
  return best;
}

function openDoor(world: World, d: Door): void {
  if (d.target === 1) return;
  d.target = 1;
  d.closeTimer = 0;
  const c = doorCenter(world, d);
  emit(world, { type: 'doorOpened', id: d.id, x: c.x, y: d.floor + 1, z: c.z });
}

export function updateInteraction(world: World, p: Player, intent: PlayerIntent): void {
  const pressed = intent.interact && !p.interactPrev;
  p.interactPrev = intent.interact;
  if (!pressed || !p.alive) return;
  const t = interactTarget(world, p);
  if (!t) return;
  if (t.kind === 'door') {
    if (t.locked) {
      emit(world, { type: 'doorLocked', id: t.door.id, slot: p.slot, requires: t.door.requires! });
      return;
    }
    // A key opens the door for good.
    t.door.requires = null;
    openDoor(world, t.door);
  } else {
    t.prop.used = true;
    emit(world, { type: 'used', id: t.prop.id, slot: p.slot });
  }
}

export function updateDoors(world: World, dt: number): void {
  for (const d of world.doors) {
    const c = doorCenter(world, d);
    const near = (r: number): boolean =>
      world.players.some((p) => p.alive && Math.hypot(p.x - c.x, p.z - c.z) < r) ||
      world.guards.some((g) => g.state !== 'dead' && Math.hypot(g.x - c.x, g.z - c.z) < r);
    // Guards open unlocked doors they walk up to.
    if (d.requires === null && d.target === 0) {
      if (world.guards.some((g) => g.state !== 'dead' && g.path.length > g.pathIndex && Math.hypot(g.x - c.x, g.z - c.z) < GUARD_OPEN_RADIUS)) {
        openDoor(world, d);
      }
    }
    if (d.target === 1 && d.open >= 1) {
      d.closeTimer += dt;
      if (d.closeTimer > STAY_OPEN && !near(1.4)) {
        d.target = 0;
        d.closeTimer = 0;
      }
    }
    // Never close on someone standing in the doorway.
    if (d.target === 0 && d.open > 0 && near(1.1)) d.target = 1;
    const step = OPEN_SPEED * dt;
    d.open = d.target > d.open ? Math.min(d.target, d.open + step) : Math.max(d.target, d.open - step);
  }
}
