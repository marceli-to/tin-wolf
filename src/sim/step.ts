import { DT } from '../config';
import { emptyIntent, type PlayerIntent } from '../core/intent';
import { separateBodies } from './collision';
import { updatePlayerMovement } from './player';
import { rebuildBoxes, type World } from './world';

/** Advances the world by one fixed tick. Events from this tick are left in `world.events`. */
export function stepWorld(world: World, intents: readonly PlayerIntent[]): void {
  world.events.length = 0;
  rebuildBoxes(world);
  for (const p of world.players) {
    p.prev.x = p.x;
    p.prev.y = p.y;
    p.prev.z = p.z;
    p.prev.crouch = p.crouch;
  }
  for (const p of world.players) {
    const intent = intents[p.slot] ?? emptyIntent();
    if (p.alive) updatePlayerMovement(world, p, intent, DT);
  }
  const ps = world.players;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]!;
      const b = ps[j]!;
      if (a.alive && b.alive) separateBodies(world.terrain, a, b);
    }
  }
  world.tick++;
  world.time += DT;
}
