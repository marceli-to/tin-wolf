import { describe, expect, it } from 'vitest';
import { loadLevel } from '../../src/data';
import { botNav, findBotPath, nodeAt } from '../../src/sim/botnav';
import { stepWorld } from '../../src/sim/step';
import { createWorld, type World } from '../../src/sim/world';
import { data, intent, makeWorld, place, run } from './helpers';

const ARENAS = ['arena_pumphouse', 'arena_snowfort', 'arena_warehouse'];

function arena(id: string, people: number, bots: number, skill = 'normal', seed = 5): World {
  return createWorld(loadLevel(id), data, { players: people, bots, seed, difficulty: skill });
}

/** Runs a match of `seconds` with idle people; returns how often each bot was found not moving. */
function play(w: World, seconds: number): number[] {
  const still = w.players.map(() => 0);
  let last = w.players.map((p) => ({ x: p.x, z: p.z }));
  for (let i = 0; i < seconds * 60 && !w.match?.over; i++) {
    stepWorld(w, []);
    if (i % 120 === 119) {
      w.players.forEach((p, k) => {
        if (p.bot && p.alive && Math.hypot(p.x - last[k]!.x, p.z - last[k]!.z) < 0.5) still[k]!++;
      });
      last = w.players.map((p) => ({ x: p.x, z: p.z }));
    }
  }
  return still;
}

describe('computer players', () => {
  it('come after the people, each at its own spawn', () => {
    const w = arena('arena_warehouse', 1, 3);
    expect(w.players.map((p) => p.bot)).toEqual([false, true, true, true]);
    const spots = new Set(w.players.map((p) => `${p.x},${p.z}`));
    expect(spots.size).toBe(4);
  });

  it('walk map: the Warehouse platform is reachable up the stairs', () => {
    const w = arena('arena_warehouse', 1, 1);
    const nav = botNav(w);
    const p = w.players[0]!;
    // The Heron LR lies on the 3 m centre platform.
    const rifle = w.pickups.find((pk) => pk.item === 'weapon_sniper')!;
    const path = findBotPath(nav, nodeAt(nav, p.x, p.y, p.z), nodeAt(nav, rifle.x, rifle.y, rifle.z));
    expect(path).not.toBeNull();
    expect(path!.at(-1)!.y).toBeCloseTo(rifle.y, 1);
    // Up in steps no higher than a stair, never a climb up a wall.
    for (let i = 1; i < path!.length; i++) expect(path![i]!.y - path![i - 1]!.y).toBeLessThanOrEqual(0.41);
  });

  it('walk map: goes round crates instead of through them', () => {
    const map = ['##########', '#........#', '#........#', '#........#', '##########'];
    const w = makeWorld(map, [{ type: 'prop', kind: 'cargo', cell: [4.5, 2], yaw: 90 }], 1, { mode: 'versus' });
    const nav = botNav(w);
    const path = findBotPath(nav, nodeAt(nav, 3, 0, 5), nodeAt(nav, 15, 0, 5))!;
    const cargo = w.props[0]!.box;
    for (const pt of path) expect(pt.x > cargo.minX - 0.3 && pt.x < cargo.maxX + 0.3 && pt.z > cargo.minZ - 0.3 && pt.z < cargo.maxZ + 0.3).toBe(false);
  });

  it('finds and knocks out a player standing still', () => {
    for (const id of ARENAS) {
      const w = arena(id, 1, 1, 'normal');
      let down = -1;
      for (let i = 0; i < 60 * 90 && down < 0; i++) {
        stepWorld(w, [intent()]);
        if (w.players[0]!.deaths > 0) down = i / 60;
      }
      expect(down, id).toBeGreaterThan(0);
    }
  });

  it('a match of three keeps moving and scoring on every arena and skill', () => {
    for (const id of ARENAS) {
      for (const skill of ['easy', 'normal', 'hard']) {
        const w = arena(id, 0, 3, skill);
        const still = play(w, 90);
        const kills = w.players.reduce((n, p) => n + p.kills, 0);
        expect(kills, `${id} ${skill}`).toBeGreaterThan(2);
        // Checked every 2 s; standing still in a fight is fine, standing still for most of a match is not.
        for (const s of still) expect(s, `${id} ${skill}`).toBeLessThan(30);
      }
    }
  }, 60000);

  it('a harder computer shoots straighter', () => {
    const acc = (skill: string): number => {
      let fired = 0;
      let hit = 0;
      for (const seed of [1, 2, 3]) {
        const w = arena('arena_pumphouse', 0, 2, skill, seed);
        play(w, 90);
        for (const p of w.players) {
          fired += p.shotsFired;
          hit += p.shotsHit;
        }
      }
      return hit / Math.max(1, fired);
    };
    expect(acc('hard')).toBeGreaterThan(acc('easy') + 0.1);
  }, 60000);

  it('plays the same way again with the same seed', () => {
    const a = arena('arena_snowfort', 1, 2);
    const b = arena('arena_snowfort', 1, 2);
    play(a, 30);
    play(b, 30);
    expect(a.players.map((p) => [p.x, p.z, p.kills])).toEqual(b.players.map((p) => [p.x, p.z, p.kills]));
  });

  it('people still steer themselves', () => {
    const w = makeWorld(['########', '#......#', '#......#', '########'], [], 1, { mode: 'versus' });
    place(w, 0, 3, 3, 90);
    run(w, 30, [intent({ moveZ: 1 })]);
    expect(w.players[0]!.x).toBeGreaterThan(4);
  });
});
