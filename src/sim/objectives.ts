import type { ObjectiveDef } from '../data/schema';
import { emit, type World } from './world';

export interface ObjectiveState {
  def: ObjectiveDef;
  done: boolean;
}

export interface MissionState {
  objectives: ObjectiveState[];
  over: boolean;
  success: boolean;
  reason: string;
  time: number;
}

export function createMission(defs: readonly ObjectiveDef[]): MissionState {
  return { objectives: defs.map((def) => ({ def, done: false })), over: false, success: false, reason: '', time: 0 };
}

function check(world: World, o: ObjectiveDef): boolean {
  const target = o.target;
  switch (o.type) {
    case 'collect':
      return world.players.some((p) => p.inventory.includes(target));
    case 'destroy': {
      const prop = world.props.find((p) => p.id === target);
      if (prop) return !prop.alive;
      const guard = world.guards.find((g) => g.id === target);
      return guard ? guard.state === 'dead' : false;
    }
    case 'reach': {
      const z = world.zones.find((zz) => zz.id === target);
      return !!z && world.players.some((p) => p.alive && p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ);
    }
    case 'interact':
      return world.props.some((p) => p.id === target && p.used);
  }
}

export function updateObjectives(world: World, dt: number): void {
  const m = world.mission;
  if (!m || m.over) return;
  m.time += dt;
  for (const o of m.objectives) {
    if (o.done) continue;
    const ready = o.def.requires.every((id) => m.objectives.find((x) => x.def.id === id)?.done);
    if (!ready || !check(world, o.def)) continue;
    o.done = true;
    emit(world, { type: 'objectiveCompleted', id: o.def.id, text: o.def.text });
  }
  if (m.objectives.length && m.objectives.every((o) => o.done)) {
    m.over = true;
    m.success = true;
    m.reason = 'All objectives complete';
    emit(world, { type: 'missionEnded', success: true, reason: m.reason });
    return;
  }
  // A destroy target lost some other way is still fine; a dead agent is not.
  if (world.players.length && world.players.every((p) => !p.alive)) {
    m.over = true;
    m.success = false;
    m.reason = 'Agent down';
    emit(world, { type: 'missionEnded', success: false, reason: m.reason });
  }
}
