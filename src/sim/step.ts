import { DT } from '../config';
import { emptyIntent, type PlayerIntent } from '../core/intent';
import { separateBodies } from './collision';
import { updatePlayerMovement } from './player';
import { updateMatch } from './match';
import { updatePickups } from './pickups';
import { respawnPlayer } from './spawn';
import { updatePlayerWeapon } from './weapons';
import { rebuildBoxes, type World } from './world';

/** Advances the world by one fixed tick. Events from this tick are left in `world.events`. */
export function stepWorld(world: World, intents: readonly PlayerIntent[]): void {
  world.events.length = 0;
  // A finished match freezes the world for the results screen.
  if (world.match?.over) return;
  rebuildBoxes(world);
  for (const p of world.players) {
    p.prev.x = p.x;
    p.prev.y = p.y;
    p.prev.z = p.z;
    p.prev.crouch = p.crouch;
  }
  for (const p of world.players) {
    const intent = intents[p.slot] ?? emptyIntent();
    p.hurtTimer = Math.max(0, p.hurtTimer - DT);
    p.protect = Math.max(0, p.protect - DT);
    if (p.alive) {
      updatePlayerMovement(world, p, intent, DT);
      updatePlayerWeapon(world, p, intent, DT);
    } else {
      p.deadTimer -= DT;
      // Missions end on death (M5); everything else respawns.
      if (p.deadTimer <= 0 && world.level.mode !== 'mission') respawnPlayer(world, p);
    }
  }
  const ps = world.players;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]!;
      const b = ps[j]!;
      if (a.alive && b.alive) separateBodies(world.terrain, a, b);
    }
  }
  updatePickups(world, DT);
  updateMatch(world, DT);
  world.tick++;
  world.time += DT;
}
