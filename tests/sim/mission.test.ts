import { describe, expect, it } from 'vitest';
import { interactTarget } from '../../src/sim/doors';
import { intent, makeWorld, place, run } from './helpers';

const ROOMS = ['###########', '#...#.....#', '#...D.....#', '#...#.....#', '###########'];
const LEG = {
  '#': { solid: true },
  '.': { floor: 0, ceil: 3 },
  D: { floor: 0, ceil: 3 },
};

function mission(entities: unknown[], objectives: unknown[]) {
  return makeWorld(ROOMS, entities, 1, { mode: 'mission', legend: LEG, objectives });
}

describe('doors', () => {
  it('opens on interact, blocks while closed, closes again later', () => {
    const w = mission([{ type: 'door', id: 'd1', cell: [4, 2] }], []);
    const p = w.players[0]!;
    place(w, 0, 5, 5, 90);
    run(w, 120, [intent({ moveZ: 1 })]);
    expect(p.x).toBeLessThan(9); // blocked by the closed door
    expect(interactTarget(w, p)?.kind).toBe('door');
    run(w, 1, [intent({ interact: true })]);
    run(w, 60, [intent({})]);
    expect(w.doors[0]!.open).toBe(1);
    run(w, 90, [intent({ moveZ: 1 })]);
    expect(p.x).toBeGreaterThan(12);
    run(w, 60 * 6, [intent({})]);
    expect(w.doors[0]!.open).toBe(0);
  });

  it('a locked door needs the key', () => {
    const w = mission([{ type: 'door', id: 'd1', cell: [4, 2], requires: 'key_red' }], []);
    const p = w.players[0]!;
    place(w, 0, 7, 5, 90);
    run(w, 1, [intent({ interact: true })]);
    expect(w.events.some((e) => e.type === 'doorLocked')).toBe(true);
    run(w, 30, [intent({})]);
    expect(w.doors[0]!.open).toBe(0);
    p.inventory.push('key_red');
    run(w, 1, [intent({ interact: true })]);
    run(w, 60, [intent({})]);
    expect(w.doors[0]!.open).toBe(1);
  });

  it('guards open unlocked doors on their way', () => {
    const w = mission(
      [
        { type: 'door', id: 'd1', cell: [4, 2] },
        { type: 'guard', id: 'g', archetype: 'guard_basic', cell: [2, 2], yaw: 90, patrol: [[2, 2], [8, 2]] },
      ],
      [],
    );
    place(w, 0, 3, 3, 180);
    w.players[0]!.hp = 1e9;
    run(w, 60 * 10, [intent({})]);
    expect(w.guards[0]!.x).toBeGreaterThan(10);
  });
});

describe('objectives', () => {
  it('collect, destroy, interact and reach (with requires), then success', () => {
    const w = mission(
      [
        { type: 'pickup', item: 'key_red', cell: [2, 1] },
        { type: 'prop', id: 'console1', kind: 'console', cell: [8, 1] },
        { type: 'prop', id: 'term', kind: 'terminal', cell: [8, 3] },
        { type: 'zone', id: 'exit', cell: [9, 2], size: [1, 1] },
      ],
      [
        { id: 'o1', text: 'key', type: 'collect', target: 'key_red' },
        { id: 'o2', text: 'console', type: 'destroy', target: 'console1' },
        { id: 'o3', text: 'terminal', type: 'interact', target: 'term' },
        { id: 'o4', text: 'exit', type: 'reach', target: 'exit', requires: ['o1', 'o2', 'o3'] },
      ],
    );
    const m = w.mission!;
    const p = w.players[0]!;
    // Reaching the exit first does not count: requirements are missing.
    place(w, 0, 19, 5);
    run(w, 1, [intent()]);
    expect(m.objectives[3]!.done).toBe(false);
    place(w, 0, 5, 3);
    run(w, 2, [intent()]);
    expect(m.objectives[0]!.done).toBe(true);
    w.props[0]!.alive = false;
    run(w, 1, [intent()]);
    expect(m.objectives[1]!.done).toBe(true);
    place(w, 0, 17, 5, 180);
    p.pitch = -0.4;
    run(w, 1, [intent({ interact: true })]);
    run(w, 1, [intent()]);
    expect(m.objectives[2]!.done).toBe(true);
    expect(m.over).toBe(false);
    place(w, 0, 19, 5);
    run(w, 1, [intent()]);
    expect(m.objectives[3]!.done).toBe(true);
    expect(m.over).toBe(true);
    expect(m.success).toBe(true);
  });

  it('destroy also works on a guard id', () => {
    const w = mission([{ type: 'guard', id: 'boss', archetype: 'guard_basic', cell: [8, 2], yaw: 0 }], [{ id: 'o1', text: 'x', type: 'destroy', target: 'boss' }]);
    place(w, 0, 3, 3, 180);
    w.guards[0]!.state = 'dead';
    run(w, 1, [intent()]);
    expect(w.mission!.success).toBe(true);
  });

  it('the mission fails when the agent dies, and there is no respawn', () => {
    const w = mission([], [{ id: 'o1', text: 'x', type: 'collect', target: 'key_red' }]);
    const p = w.players[0]!;
    p.hp = 0;
    p.alive = false;
    p.deadTimer = 0;
    run(w, 200, [intent()]);
    expect(w.mission!.over).toBe(true);
    expect(w.mission!.success).toBe(false);
    expect(p.alive).toBe(false);
  });
});
