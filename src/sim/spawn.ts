import { PLAYER } from '../config';
import { rayGrid } from './raycast';
import { placePlayer, type Player, type SpawnPoint, type World } from './world';

function spawnCandidates(world: World): SpawnPoint[] {
  return world.spawns.length ? world.spawns : world.starts.filter(Boolean);
}

export function hasLineOfSight(world: World, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return true;
  const hit = rayGrid(world.grid, { ox: ax, oy: ay, oz: az, dx: dx / d, dy: dy / d, dz: dz / d }, d);
  return hit === null;
}

/**
 * Prefer spawns no living opponent can see; among those, the one farthest from the nearest opponent.
 */
export function chooseSpawn(world: World, p: Player): SpawnPoint {
  const cands = spawnCandidates(world);
  const opponents = world.players.filter((o) => o !== p && o.alive);
  let best: SpawnPoint | null = null;
  let bestScore = -Infinity;
  for (const sp of cands) {
    let nearest = Infinity;
    let seen = false;
    for (const o of opponents) {
      nearest = Math.min(nearest, Math.hypot(o.x - sp.x, o.z - sp.z));
      if (hasLineOfSight(world, sp.x, 1.6, sp.z, o.x, o.y + 1.6, o.z)) seen = true;
    }
    if (!opponents.length) nearest = 0;
    const score = (seen ? 0 : 1000) + nearest;
    if (score > bestScore) {
      bestScore = score;
      best = sp;
    }
  }
  return best ?? world.starts[p.slot] ?? { x: 3, z: 3, yaw: 0 };
}

export function respawnPlayer(world: World, p: Player): void {
  const def = world.data.weapons[p.weapon.id];
  placePlayer(world, p, chooseSpawn(world, p));
  p.alive = true;
  p.hp = PLAYER.maxHp;
  p.armor = 0;
  p.protect = PLAYER.spawnProtection;
  p.hurtTimer = 0;
  p.inventory = [];
  if (def) {
    p.weapon.mag = def.magSize;
    p.weapon.reserve = def.startReserve;
  }
  p.weapon.cooldown = 0;
  p.weapon.reloadTimer = 0;
  world.events.push({ type: 'spawned', slot: p.slot });
}
