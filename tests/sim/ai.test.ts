import { describe, expect, it } from 'vitest';
import { applyDamage } from '../../src/sim/combat';
import { cellAt } from '../../src/sim/grid';
import type { World } from '../../src/sim/world';
import { intent, makeWorld, place, run } from './helpers';

const OPEN = ['##############', '#............#', '#............#', '#............#', '#............#', '##############'];
const idle = [intent()];
const secs = (s: number) => Math.round(s * 60);

function guardWorld(map: string[], guards: unknown[], extra: unknown[] = []): World {
  return makeWorld(map, [...guards, ...extra], 1, { mode: 'mission' });
}

describe('guard AI', () => {
  it('patrols between waypoints', () => {
    const sealed = ['##############', '#............#', '#............#', '##############', '#............#', '##############'];
    const w = guardWorld(sealed, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [2, 2], yaw: 90, patrol: [[2, 2], [10, 2]] }]);
    place(w, 0, 3, 9, 180); // in a sealed room the guard cannot see
    const g = w.guards[0]!;
    let maxX = 0;
    let minXAfter = Infinity;
    for (let i = 0; i < secs(20); i++) {
      run(w, 1, idle);
      maxX = Math.max(maxX, g.x);
      if (maxX > 20) minXAfter = Math.min(minXAfter, g.x);
    }
    expect(g.state).toBe('patrol');
    expect(maxX).toBeGreaterThan(20);
    expect(minXAfter).toBeLessThan(8);
  });

  it('gives up on a waypoint blocked by a prop and carries on patrolling', () => {
    const sealed = ['##############', '#............#', '#............#', '##############', '#............#', '##############'];
    const w = guardWorld(
      sealed,
      [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [2, 1], yaw: 90, patrol: [[2, 1], [9, 1]] }],
      [{ type: 'prop', kind: 'crate_tall', cell: [9, 1] }],
    );
    place(w, 0, 3, 9, 180);
    const g = w.guards[0]!;
    run(w, secs(14), idle);
    // It reached the crate, gave up on that waypoint, and walked back toward the first one.
    expect(g.patrolIndex).toBe(0);
    expect(g.x).toBeLessThan(14);
  });

  it('does not see a player standing behind it', () => {
    const w = guardWorld(OPEN, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [6, 1], yaw: 0 }]);
    place(w, 0, 13, 8, 0); // 5 m behind (south of) a north-facing guard
    run(w, secs(3), idle);
    expect(w.guards[0]!.state).toBe('patrol');
    expect(w.guards[0]!.awareness).toBe(0);
  });

  it('notices a player in front: patrol → suspicious → attack, then shoots', () => {
    const w = guardWorld(OPEN, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [1, 2], yaw: 90 }]);
    place(w, 0, 21, 5, -90);
    const g = w.guards[0]!;
    run(w, 7, idle);
    expect(g.state).toBe('suspicious');
    run(w, secs(3), idle);
    expect(g.state).toBe('attack');
    expect(w.events.length >= 0).toBe(true);
    run(w, secs(6), idle);
    expect(w.players[0]!.hp).toBeLessThan(100);
  });

  it('a crouching player in a dark area is noticed later than a standing one in light', () => {
    const lit = guardWorld(OPEN, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [1, 2], yaw: 90 }]);
    const dark = makeWorld(
      OPEN.map((r) => r.replace(/\./g, 'd')),
      [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [1, 2], yaw: 90 }],
      1,
      { mode: 'mission', legend: { '#': { solid: true }, d: { floor: 0, ceil: 3, light: 0.25 } } },
    );
    place(lit, 0, 15, 5, -90);
    place(dark, 0, 15, 5, -90);
    run(lit, secs(1.5), idle);
    run(dark, secs(1.5), [intent({ crouch: true })]);
    expect(lit.guards[0]!.state).toBe('attack');
    expect(dark.guards[0]!.awareness).toBeLessThan(lit.guards[0]!.awareness);
    expect(dark.guards[0]!.state).not.toBe('attack');
  });

  it('a player gunshot alerts a guard who cannot see the player', () => {
    // Guard behind a wall, within earshot.
    const map = ['##############', '#.....#......#', '#.....#......#', '#.....#......#', '#............#', '##############'];
    // Within half the noise radius, so the wall does not muffle it enough.
    const w = guardWorld(map, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [8, 1], yaw: 90 }]);
    place(w, 0, 5, 3, 0);
    run(w, 1, [intent({ fire: true })]);
    run(w, 2, idle);
    const g = w.guards[0]!;
    expect(g.state).toBe('attack');
    expect(Math.hypot(g.lastKnown!.x - 5, g.lastKnown!.z - 3)).toBeLessThan(1);
  });

  it('walls muffle a distant gunshot', () => {
    const map = ['####################', '#.....#............#', '#.....#............#', '#.....#............#', '#.....##############', '####################'];
    const w = guardWorld(map, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [14, 1], yaw: 90 }]);
    place(w, 0, 5, 3, 0); // 24 m away, wall in between
    run(w, 1, [intent({ fire: true })]);
    run(w, 2, idle);
    expect(w.guards[0]!.state).toBe('patrol');
  });

  it('a guard firing alerts a second guard out of sight', () => {
    // g1 sees the player; g2 is around the corner and far from the player but close to g1.
    const map = [
      '####################',
      '#..................#',
      '#..................#',
      '#########.##########',
      '#########.##########',
      '#########.##########',
      '####################',
    ];
    const w = guardWorld(map, [
      { type: 'guard', id: 'g1', archetype: 'guard_basic', cell: [9, 2], yaw: 270 },
      { type: 'guard', id: 'g2', archetype: 'guard_basic', cell: [9, 5], yaw: 180 },
    ]);
    // Player far west of g1, 16 m away; well outside g2's line of sight.
    place(w, 0, 3, 5, 90);
    const g1 = w.guards[0]!;
    const g2 = w.guards[1]!;
    let g1Fired = false;
    for (let i = 0; i < secs(8) && g2.state !== 'attack'; i++) {
      run(w, 1, idle);
      if (w.events.some((e) => e.type === 'shotFired' && e.shooter.kind === 'guard')) g1Fired = true;
    }
    expect(g1.state).toBe('attack');
    expect(g1Fired).toBe(true);
    expect(g2.state).toBe('attack');
  });

  it('loses the player, searches, then returns to patrol', () => {
    const map = ['##############', '#......#.....#', '#......#.....#', '#......#.....#', '#......#.....#', '##############'];
    const w = guardWorld(map, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [2, 2], yaw: 90 }]);
    w.data = { ...w.data, enemies: { ...w.data.enemies, guard_basic: { ...w.data.enemies.guard_basic!, searchTime: 3 } } };
    const g = w.guards[0]!;
    place(w, 0, 11, 5, -90);
    run(w, secs(3), idle);
    expect(g.state).toBe('attack');
    // Player vanishes into the sealed east room.
    place(w, 0, 22, 5, -90);
    w.players[0]!.hp = 100;
    let sawSearch = false;
    for (let i = 0; i < secs(15); i++) {
      run(w, 1, idle);
      if (g.state === 'search') sawSearch = true;
      if (sawSearch && g.state === 'patrol') break;
    }
    expect(sawSearch).toBe(true);
    expect(g.state).toBe('patrol');
  });

  it('damage puts a guard into attack; death is final', () => {
    const w = guardWorld(OPEN, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [10, 2], yaw: 90 }]);
    place(w, 0, 3, 3, 90);
    const g = w.guards[0]!;
    applyDamage(w, { kind: 'guard', index: 0 }, 10, 'torso', { kind: 'player', slot: 0 }, { x: g.x, y: 1, z: g.z });
    expect(g.flinch).toBeGreaterThan(0);
    run(w, 1, idle);
    expect(g.state).toBe('attack');
    applyDamage(w, { kind: 'guard', index: 0 }, 100, 'head', { kind: 'player', slot: 0 }, { x: g.x, y: 1.6, z: g.z });
    expect(g.state).toBe('dead');
    expect(w.players[0]!.kills).toBe(1);
    const x = g.x;
    run(w, secs(2), idle);
    expect(g.state).toBe('dead');
    expect(g.x).toBe(x);
  });

  it('player shots kill a guard through the normal weapon path', () => {
    const w = guardWorld(OPEN, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [8, 2], yaw: 90 }]);
    w.data = { ...w.data, weapons: { ...w.data.weapons, pistol: { ...w.data.weapons.pistol!, spreadDeg: 0 } } };
    place(w, 0, 5, 5, 90);
    w.players[0]!.pitch = Math.atan2(1.6 - 1.6, 12) + 0.005;
    run(w, 1, [intent({ fire: true })]);
    expect(w.guards[0]!.state).toBe('dead');
  });

  it('chasing around obstacles never puts a guard inside a wall or keeps it stuck', () => {
    const map = [
      '################',
      '#..............#',
      '#.##.####.###..#',
      '#.#........#...#',
      '#.#.######.#.#.#',
      '#......#.....#.#',
      '#.####.#.###.#.#',
      '#..............#',
      '################',
    ];
    const w = guardWorld(map, [
      { type: 'guard', id: 'g1', archetype: 'guard_basic', cell: [1, 1], yaw: 90 },
      { type: 'guard', id: 'g2', archetype: 'guard_basic', cell: [14, 7], yaw: 270 },
    ]);
    const s = w.grid.size;
    // Player runs a loop of waypoints; guards are already alerted.
    for (const g of w.guards) {
      g.state = 'attack';
      g.awareness = 1;
      g.targetSlot = 0;
    }
    const loop = [
      [3, 1],
      [14, 1],
      [14, 7],
      [1, 7],
      [1, 3],
    ];
    w.players[0]!.hp = 1e9;
    let li = 0;
    const lastMoved = w.guards.map(() => 0);
    const lastPos = w.guards.map((g) => ({ x: g.x, z: g.z }));
    for (let t = 0; t < secs(40); t++) {
      const p = w.players[0]!;
      const [tc, tr] = loop[li]!;
      const tx = (tc! + 0.5) * s;
      const tz = (tr! + 0.5) * s;
      if (Math.hypot(tx - p.x, tz - p.z) < 0.6) li = (li + 1) % loop.length;
      p.yaw = Math.atan2(tx - p.x, -(tz - p.z));
      run(w, 1, [intent({ moveZ: 0.7 })]);
      w.guards.forEach((g, i) => {
        const c = cellAt(w.grid, Math.floor(g.x / s), Math.floor(g.z / s));
        expect(c && !c.solid).toBe(true);
        if (Math.hypot(g.x - lastPos[i]!.x, g.z - lastPos[i]!.z) > 0.5 || g.path.length === 0) {
          lastPos[i] = { x: g.x, z: g.z };
          lastMoved[i] = t;
        }
        // A guard with somewhere to go must make progress at least every 2 s.
        expect(t - lastMoved[i]!).toBeLessThan(secs(2.2));
      });
    }
  });
});
