import { describe, expect, it } from 'vitest';
import { loadLevel } from '../../src/data';
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
