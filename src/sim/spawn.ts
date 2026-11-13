import { PLAYER } from '../config';
import { clearLine } from './los';
import { giveLoadout, noPowers, placePlayer, type Player, type SpawnPoint, type World } from './world';

function spawnCandidates(world: World): SpawnPoint[] {
  return world.spawns.length ? world.spawns : world.starts.filter(Boolean);
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
      if (clearLine(world, sp.x, (sp.y ?? 0) + 1.6, sp.z, o.x, o.y + 1.6, o.z)) seen = true;
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
  placePlayer(world, p, chooseSpawn(world, p));
  p.alive = true;
  p.hp = PLAYER.maxHp;
  p.armor = 0;
  p.protect = PLAYER.spawnProtection;
  p.hurtTimer = 0;
  p.inventory = [];
  p.power = noPowers();
  giveLoadout(p, world.level.loadout, world.data);
  world.events.push({ type: 'spawned', slot: p.slot });
}
