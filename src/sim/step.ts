import { DT } from '../config';
import { emptyIntent, type PlayerIntent } from '../core/intent';
import { separateBodies } from './collision';
import { updatePlayerMovement } from './player';
import { updateGuards } from './ai';
import { updateDoors, updateInteraction } from './doors';
import { updateMatch } from './match';
import { updateObjectives } from './objectives';
import { updatePickups } from './pickups';
import { updateProjectiles } from './projectiles';
import { updateTargets } from './targets';
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
      updateInteraction(world, p, intent);
    } else {
      p.deadTimer -= DT;
      // Missions end on death (M5); everything else respawns.
      if (p.deadTimer <= 0 && world.level.mode !== 'mission') respawnPlayer(world, p);
    }
  }
  // Before guards, so they hear this tick's explosions.
  updateProjectiles(world, DT);
  updateGuards(world, DT);
  // Push overlapping living bodies apart (players and guards alike).
  const bodies = [...world.players.filter((p) => p.alive), ...world.guards.filter((g) => g.state !== 'dead')];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) separateBodies(world.terrain, bodies[i]!, bodies[j]!);
  }
  updateDoors(world, DT);
  updatePickups(world, DT);
  updateMatch(world, DT);
  updateObjectives(world, DT);
  updateTargets(world, DT);
  world.tick++;
  world.time += DT;
}
