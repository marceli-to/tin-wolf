import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/data/load';
import { traceShot } from '../../src/sim/combat';
import { BODY_HEIGHT } from '../../src/sim/hitbox';
import { createWorld, type World } from '../../src/sim/world';
import { data, intent, LEGEND, run } from './helpers';

const OPEN = ['##############', '#............#', '#............#', '#............#', '##############'];

function world(guardBodies: Record<string, 'human' | 'chibi' | 'tinfox'>): World {
  const level = parseLevel({
    id: 't',
    name: 't',
    legend: LEGEND,
    map: OPEN,
    mode: 'mission',
    entities: [
      { type: 'guard', id: 'a', archetype: 'guard_basic', cell: [10, 2], yaw: 0 },
      { type: 'guard', id: 'o', archetype: 'guard_officer', cell: [10, 1], yaw: 0 },
      { type: 'guard', id: 'w', archetype: 'guard_basic', look: 'worker', cell: [10, 3], yaw: 0 },
    ],
  });
  return createWorld(level, data, { players: 1, seed: 7, body: 'chibi', guardBodies });
}

/** Zone hit by a level shot at height y straight at guard `i`. */
function zoneAt(w: World, i: number, y: number): string | null {
  const g = w.guards[i]!;
  const ox = g.x - 6;
  const hit = traceShot(w, { ox, oy: g.y + y, oz: g.z, dx: 1, dy: 0, dz: 0 }, 20, null);
  return hit?.target.kind === 'actor' ? hit.target.zone : null;
}

describe('body shapes per figure', () => {
  it('guards take the body of the figure the art set gives them, players keep theirs', () => {
    const w = world({ guard_basic: 'tinfox', guard_officer: 'chibi', 'look:worker': 'chibi' });
    expect(w.body).toBe('chibi');
    expect(w.guards.map((g) => g.body)).toEqual(['tinfox', 'chibi', 'chibi']);
    expect(w.guards[0]!.height).toBe(BODY_HEIGHT.tinfox);
    expect(w.guards[1]!.height).toBe(BODY_HEIGHT.chibi);
  });

  it('Tin Fox guards are taller and stay taller after the AI runs', () => {
    const w = world({ guard_basic: 'tinfox' });
    run(w, 5, [intent()]);
    expect(w.guards[0]!.height).toBeCloseTo(1.9, 5);
    expect(w.guards[1]!.height).toBeCloseTo(1.75, 5);
  });

  it('a Tin Fox head starts at the neck; a human-zoned guard of the same size would call it torso', () => {
    const tin = world({ guard_basic: 'tinfox' });
    // 1.55 m: the chin and mouth of a 1.9 m Tin Fox figure.
    expect(zoneAt(tin, 0, 1.55)).toBe('head');
    expect(zoneAt(tin, 0, 1.3)).toBe('torso');
    expect(zoneAt(tin, 0, 0.5)).toBe('limb');
    const human = world({ guard_basic: 'human' });
    human.guards[0]!.height = 1.9;
    expect(zoneAt(human, 0, 1.55)).toBe('torso');
  });
});

describe('prop sizes per art set', () => {
  const level = () =>
    parseLevel({
      id: 't',
      name: 't',
      legend: LEGEND,
      map: OPEN,
      mode: 'mission',
      entities: [
        { type: 'prop', id: 'b', kind: 'barrel_red', cell: [5, 2] },
        { type: 'prop', id: 'r', kind: 'barrel_red', cell: [8, 2], yaw: 90 },
      ],
    });

  it('an art set can give a prop kind its own collider', () => {
    const w = createWorld(level(), data, { players: 1, propSizes: { barrel_red: [0.56, 0.9, 0.56] } });
    for (const p of w.props) {
      expect(p.box.maxX - p.box.minX).toBeCloseTo(0.56, 5);
      expect(p.box.maxZ - p.box.minZ).toBeCloseTo(0.56, 5);
      expect(p.box.maxY - p.box.minY).toBeCloseTo(0.9, 5);
    }
  });

  it('without one the data size stays', () => {
    const w = createWorld(level(), data, { players: 1 });
    const [sx, , sz] = data.props.barrel_red!.size;
    expect(w.props[0]!.box.maxX - w.props[0]!.box.minX).toBeCloseTo(sx, 5);
    expect(w.props[1]!.box.maxX - w.props[1]!.box.minX).toBeCloseTo(sz, 5);
  });
});
