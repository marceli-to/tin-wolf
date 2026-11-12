import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/sim/match';
import { chooseSpawn } from '../../src/sim/spawn';
import { findPath } from '../../src/sim/nav';
import { intent, makeWorld, place, run } from './helpers';

const MAP = ['##########', '#........#', '#........#', '##########'];
const versus = (extra: Record<string, unknown> = {}) =>
  makeWorld(
    MAP,
    [
      { type: 'spawn', cell: [1, 1] },
      { type: 'spawn', cell: [8, 1] },
      { type: 'spawn', cell: [1, 2] },
      { type: 'spawn', cell: [8, 2] },
    ],
    2,
    { mode: 'versus', match: { killLimit: 3, timeLimit: 10 }, ...extra },
  );

describe('match rules', () => {
  it('ends when a player reaches the kill limit', () => {
    const w = versus();
    w.players[1]!.kills = 3;
    run(w, 1, [intent(), intent()]);
    expect(w.match!.over).toBe(true);
    expect(w.match!.winner).toBe(1);
    expect(w.events.some((e) => e.type === 'matchEnded')).toBe(true);
  });

  it('time-out gives the win to the higher score', () => {
    const w = versus();
    w.players[0]!.kills = 2;
    w.players[1]!.kills = 1;
    run(w, 10 * 60 + 1, [intent(), intent()]);
    expect(w.match!.over).toBe(true);
    expect(w.match!.winner).toBe(0);
  });

  it('time-out with equal scores is a draw', () => {
    const w = versus();
    w.players[0]!.kills = 1;
    w.players[1]!.kills = 1;
    run(w, 10 * 60 + 1, [intent(), intent()]);
    expect(w.match!.over).toBe(true);
    expect(w.match!.winner).toBeNull();
  });

  it('a finished match freezes the world', () => {
    const w = versus();
    w.match = createMatch(3, 10);
    w.match.over = true;
    const x = w.players[0]!.x;
    run(w, 30, [intent({ moveZ: 1 }), intent()]);
    expect(w.players[0]!.x).toBe(x);
  });
});

describe('spawns', () => {
  it('picks the spawn the opponent cannot see, farthest away', () => {
    const w = makeWorld(
      ['##########', '#....#...#', '#....#...#', '#........#', '##########'],
      [
        { type: 'spawn', cell: [1, 3] },
        { type: 'spawn', cell: [8, 3] },
        { type: 'spawn', cell: [7, 1] },
        { type: 'spawn', cell: [1, 1] },
      ],
      2,
      { mode: 'versus', match: { killLimit: 3, timeLimit: 10 } },
    );
    place(w, 1, 3, 7, 0); // opponent in the bottom-left corridor, sees [1,3] and [8,3] and [1,1]
    const sp = chooseSpawn(w, w.players[0]!);
    expect([Math.floor(sp.x / 2), Math.floor(sp.z / 2)]).toEqual([7, 1]);
  });
});

describe('pickups', () => {
  it('heals, respects max, and respawns after its timer', () => {
    const w = makeWorld(MAP, [{ type: 'pickup', item: 'medkit', cell: [3, 1], respawn: 2 }], 1);
    const p = w.players[0]!;
    place(w, 0, 7, 3);
    run(w, 1, [intent()]);
    expect(w.pickups[0]!.active).toBe(true); // full health: not taken
    p.hp = 30;
    run(w, 1, [intent()]);
    expect(p.hp).toBe(70);
    expect(w.pickups[0]!.active).toBe(false);
    place(w, 0, 15, 3);
    run(w, 2 * 60 + 1, [intent()]);
    expect(w.pickups[0]!.active).toBe(true);
  });

  it('ammo stops at maxReserve; keys go to the inventory', () => {
    const w = makeWorld(MAP, [
      { type: 'pickup', item: 'ammo_pistol', cell: [3, 1] },
      { type: 'pickup', item: 'key_red', cell: [5, 1] },
    ]);
    const p = w.players[0]!;
    p.ammo.pistol = 90;
    place(w, 0, 7, 3);
    run(w, 1, [intent()]);
    expect(p.ammo.pistol).toBe(96);
    place(w, 0, 11, 3);
    run(w, 1, [intent()]);
    expect(p.inventory).toContain('key_red');
  });
});

describe('pathfinding', () => {
  it('finds a path around a wall and refuses to climb a ledge', () => {
    const w = makeWorld(['#######', '#..#..#', '#..#..#', '#.....#', '#######']);
    const path = findPath(w.grid, 1, 1, 5, 1, { height: 1.75 });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual([1, 1]);
    expect(path![path!.length - 1]).toEqual([5, 1]);
    expect(path!.every(([c, r]) => !w.grid.cells[r * w.grid.w + c]!.solid)).toBe(true);

    const ledge = makeWorld(['######', '#..HH#', '######']);
    expect(findPath(ledge.grid, 1, 1, 4, 1, { height: 1.75 })).toBeNull();
    // Dropping down is fine.
    expect(findPath(ledge.grid, 4, 1, 1, 1, { height: 1.75 })).not.toBeNull();
    const ramp = makeWorld(['######', '#..>+#', '######']);
    expect(findPath(ramp.grid, 1, 1, 4, 1, { height: 1.75 })).not.toBeNull();
  });

  it('respects headroom: guards cannot use crawl spaces', () => {
    const w = makeWorld(['#######', '#..=..#', '#######']);
    expect(findPath(w.grid, 1, 1, 5, 1, { height: 1.75 })).toBeNull();
    expect(findPath(w.grid, 1, 1, 5, 1, { height: 1.15 })).not.toBeNull();
  });
});
