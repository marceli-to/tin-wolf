import { describe, expect, it } from 'vitest';
import { damageProp } from '../../src/sim/combat';
import type { World } from '../../src/sim/world';
import { data, intent, makeWorld, place, run } from './helpers';

const OPEN = ['##############', '#............#', '#............#', '#............#', '#............#', '##############'];
const WALLED = ['##############', '#.....#......#', '#.....#......#', '#.....#......#', '#.....#......#', '##############'];
const idle = [intent()];
const red = data.props.barrel_red!;

function world(map: string[], entities: unknown[]): World {
  const w = makeWorld(map, entities, 1, { mode: 'mission' });
  place(w, 0, 3, 3, 90);
  return w;
}
const barrelIndex = (w: World, id: string) => w.props.findIndex((p) => p.id === id);

describe('explosive barrels', () => {
  it('blow up a moment after they break, not before', () => {
    const w = world(OPEN, [{ type: 'prop', kind: 'barrel_red', id: 'b', cell: [8, 2] }]);
    damageProp(w, barrelIndex(w, 'b'), red.hp! - 1, { kind: 'player', slot: 0 });
    run(w, 30, idle);
    expect(w.props[barrelIndex(w, 'b')]!.alive).toBe(true);
    damageProp(w, barrelIndex(w, 'b'), 1, { kind: 'player', slot: 0 });
    expect(w.props[barrelIndex(w, 'b')]!.alive).toBe(false);
    run(w, 1, idle);
    expect(w.events.some((e) => e.type === 'explosion')).toBe(false);
    let boom = false;
    for (let i = 0; i < 10 && !boom; i++) {
      run(w, 1, idle);
      boom = w.events.some((e) => e.type === 'explosion');
    }
    expect(boom).toBe(true);
  });

  it('a plain barrel does not explode (it cannot even break)', () => {
    const w = world(OPEN, [{ type: 'prop', kind: 'barrel', id: 'b', cell: [8, 2] }]);
    damageProp(w, barrelIndex(w, 'b'), 1000);
    run(w, 20, idle);
    expect(w.props[barrelIndex(w, 'b')]!.alive).toBe(true);
    expect(w.blasts.length).toBe(0);
  });

  it('hurts a guard standing next to it, and the player who set it off gets the takedown', () => {
    const w = world(OPEN, [
      { type: 'prop', kind: 'barrel_red', id: 'b', cell: [8, 2] },
      { type: 'guard', id: 'g', archetype: 'guard_basic', cell: [9, 2], yaw: 90 },
    ]);
    const g = w.guards[0]!;
    damageProp(w, barrelIndex(w, 'b'), 100, { kind: 'player', slot: 0 });
    run(w, 20, idle);
    expect(g.state).toBe('dead');
    expect(w.players[0]!.kills).toBe(1);
  });

  it('hurts less further away, and not at all out of range', () => {
    const hpAt = (cell: number): number => {
      const w = world(OPEN, [{ type: 'prop', kind: 'barrel_red', id: 'b', cell: [2, 2] }]);
      place(w, 0, cell * 2 + 1, 5, 90);
      damageProp(w, barrelIndex(w, 'b'), 100, null);
      run(w, 20, idle);
      return w.players[0]!.alive ? w.players[0]!.hp : 0;
    };
    const near = hpAt(3); // 2 m
    const far = hpAt(4); // 4 m (the edge)
    const out = hpAt(6); // 8 m
    expect(near).toBeLessThan(far);
    expect(out).toBe(100);
  });

  it('sets off a neighbouring red barrel: a chain', () => {
    const w = world(OPEN, [
      { type: 'prop', kind: 'barrel_red', id: 'a', cell: [6, 2] },
      { type: 'prop', kind: 'barrel_red', id: 'b', cell: [7, 2] },
      { type: 'prop', kind: 'barrel_red', id: 'c', cell: [8, 2] },
    ]);
    damageProp(w, barrelIndex(w, 'a'), 100, { kind: 'player', slot: 0 });
    let explosions = 0;
    for (let i = 0; i < 60; i++) {
      run(w, 1, idle);
      explosions += w.events.filter((e) => e.type === 'explosion').length;
    }
    expect(explosions).toBe(3);
    expect(w.props.every((p) => !p.alive)).toBe(true);
  });

  it('a wall shields whoever is behind it', () => {
    const w = world(WALLED, [{ type: 'prop', kind: 'barrel_red', id: 'b', cell: [5, 2] }]);
    place(w, 0, 15, 5, 90); // just the other side of the wall, about 4 m from the barrel
    damageProp(w, barrelIndex(w, 'b'), 100, null);
    run(w, 20, idle);
    expect(w.players[0]!.hp).toBe(100);
  });

  it('can be shot', () => {
    const w = makeWorld(OPEN, [{ type: 'prop', kind: 'barrel_red', id: 'b', cell: [8, 2] }], 1, { mode: 'mission', loadout: ['sniper'] });
    place(w, 0, 3, 5, 90);
    const p = w.players[0]!;
    run(w, 40, idle);
    p.pitch = Math.atan2(0.5 - 1.6, 14);
    for (let i = 0; i < 4 && w.props[0]!.alive; i++) {
      run(w, 15, [intent({ aim: true })]);
      p.weapon.cooldown = 0;
      run(w, 1, [intent({ aim: true, fire: true })]);
    }
    expect(w.props[0]!.alive).toBe(false);
  });
});
