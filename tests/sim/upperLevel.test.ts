import { describe, expect, it } from 'vitest';
import { loadLevel } from '../../src/data';
import { clearLine } from '../../src/sim/los';
import { placePlayer, createWorld, type World } from '../../src/sim/world';
import { data, intent, place, run } from './helpers';

// The Warehouse's second level: mezzanine at 3 m along the north and south walls, a bridge
// (x 34..36 m) between them and a platform in the middle with the sniper rifle on it.
const TOP = 3;
const secs = (s: number) => Math.round(s * 60);

function warehouse(): World {
  return createWorld(loadLevel('arena_warehouse'), data, { players: 1, seed: 1 });
}

function at(w: World, x: number, y: number, z: number, yaw: number): void {
  place(w, 0, x, z, yaw);
  const p = w.players[0]!;
  p.y = p.prev.y = y;
}

describe('warehouse mezzanine', () => {
  it('climbs the stairs onto the mezzanine', () => {
    const w = warehouse();
    at(w, 49, 0, 4, 270);
    run(w, secs(1.5), [intent({ moveZ: 1 })]);
    const p = w.players[0]!;
    expect(p.x).toBeLessThan(44);
    expect(p.y).toBeCloseTo(TOP, 2);
  });

  it('crosses the bridge to the centre platform and picks up the rifle', () => {
    const w = warehouse();
    at(w, 35, TOP, 4, 180);
    run(w, secs(5), [intent({ moveZ: 1 })]);
    const p = w.players[0]!;
    expect(p.z).toBeGreaterThan(27);
    expect(p.y).toBeCloseTo(TOP, 2);
    expect(p.weapons.some((wp) => wp.id === 'sniper')).toBe(true);
  });

  it('lets players walk under the bridge', () => {
    const w = warehouse();
    at(w, 30, 0, 16, 90);
    run(w, secs(2), [intent({ moveZ: 1 })]);
    const p = w.players[0]!;
    expect(p.x).toBeGreaterThan(38);
    expect(p.y).toBeCloseTo(0, 2);
  });

  it('railings keep players on the mezzanine', () => {
    const w = warehouse();
    at(w, 20, TOP, 4, 180);
    run(w, secs(2), [intent({ moveZ: 1 })]);
    const p = w.players[0]!;
    expect(p.z).toBeLessThan(6);
    expect(p.y).toBeCloseTo(TOP, 2);
  });

  it('a grenade comes to rest on the bridge, not the floor below', () => {
    const w = warehouse();
    w.projectiles.push({ id: 1, weapon: 'grenade', owner: { kind: 'player', slot: 0 }, x: 35, y: TOP + 1, z: 16, vx: 0, vy: 0, vz: 0, fuse: 10, prev: { x: 35, y: TOP + 1, z: 16 } });
    run(w, secs(2), [intent()]);
    const g = w.projectiles[0]!;
    expect(g.y).toBeGreaterThan(TOP);
    expect(g.y).toBeLessThan(TOP + 0.3);
    expect(Math.hypot(g.vx, g.vz)).toBeLessThan(0.05);
  });

  it('spawns players up on the mezzanine', () => {
    const w = warehouse();
    const sp = w.spawns.find((s) => s.y === TOP)!;
    expect(sp).toBeDefined();
    placePlayer(w, w.players[0]!, sp);
    run(w, 30, [intent()]);
    expect(w.players[0]!.y).toBeCloseTo(TOP, 2);
  });
});

describe('training ground deck and tower', () => {
  const ground = (): World => createWorld(loadLevel('training'), data, { players: 1, seed: 1 });

  it('climbs the deck stairs and the tower stairs', () => {
    const w = ground();
    at(w, 10, 0, 53, 0);
    run(w, secs(1.5), [intent({ moveZ: 1 })]);
    expect(w.players[0]!.y).toBeCloseTo(3, 2);
    at(w, 23, 0, 8, 270);
    run(w, secs(2), [intent({ moveZ: 1 })]);
    expect(w.players[0]!.y).toBeCloseTo(4.5, 2);
  });

  it('every target outside the grenade pit can be shot from the field or the deck', () => {
    const w = ground();
    const eyes: [number, number, number][] = [];
    for (let x = 6; x <= 66; x += 6) {
      eyes.push([x, 1.6, 80], [x, 1.6, 58], [x, 3 + 1.6, 45]);
    }
    const pit = (t: { z: number; x: number }) => t.z > 60 && t.z < 64 && t.x > 33 && t.x < 40;
    for (const t of w.targets) {
      if (pit(t)) continue;
      const seen = eyes.some(([x, y, z]) => clearLine(w, x, y, z, t.x, t.y, t.z));
      expect(seen, `target at ${t.x}, ${t.z}`).toBe(true);
    }
  });

  it('practice dummies walk their whole patrol without getting stuck', () => {
    const w = ground();
    expect(w.guards.length).toBe(5);
    const reached = w.guards.map(() => 0);
    for (let i = 0; i < secs(30); i++) {
      run(w, 1, [intent()]);
      w.guards.forEach((g, k) => {
        const far = g.patrol[0]!;
        if (Math.hypot(g.x - far.x, g.z - far.z) < 1) reached[k] = 1;
      });
    }
    expect(reached).toEqual([1, 1, 1, 1, 1]);
  });
});
