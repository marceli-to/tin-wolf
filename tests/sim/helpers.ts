import { emptyIntent, type PlayerIntent } from '../../src/core/intent';
import { loadGameData } from '../../src/data';
import { parseLevel } from '../../src/data/load';
import { stepWorld } from '../../src/sim/step';
import { createWorld, type World } from '../../src/sim/world';

export const data = loadGameData();

export const LEGEND = {
  '#': { solid: true },
  '.': { floor: 0, ceil: 3 },
  '_': { floor: 0.3, ceil: 3 },
  H: { floor: 1, ceil: 4 },
  '+': { floor: 1.2, ceil: 4 },
  '>': { ramp: 'e', floor: 0, floorTo: 1.2, ceil: 4 },
  '=': { floor: 0, ceil: 1.4 },
};

export function makeWorld(map: string[], entities: unknown[] = [], players = 1, extra: Record<string, unknown> = {}): World {
  const level = parseLevel({ id: 't', name: 't', legend: LEGEND, map, entities, ...extra });
  return createWorld(level, data, { players, seed: 7 });
}

export function intent(p: Partial<PlayerIntent> = {}): PlayerIntent {
  return { ...emptyIntent(), ...p };
}

export function run(world: World, ticks: number, intents: PlayerIntent[] | ((tick: number) => PlayerIntent[])): void {
  for (let i = 0; i < ticks; i++) stepWorld(world, typeof intents === 'function' ? intents(i) : intents);
}

export function place(world: World, slot: number, x: number, z: number, yawDeg = 0): void {
  const p = world.players[slot]!;
  p.x = p.prev.x = x;
  p.z = p.prev.z = z;
  p.yaw = (yawDeg * Math.PI) / 180;
  p.vx = p.vz = 0;
}
