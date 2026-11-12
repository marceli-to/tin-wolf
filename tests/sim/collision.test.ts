import { describe, expect, it } from 'vitest';
import { cellAt } from '../../src/sim/grid';
import { moveBody } from '../../src/sim/collision';
import { intent, makeWorld, place, run } from './helpers';

const ROOM = ['#######', '#.....#', '#.....#', '#..#..#', '#.....#', '#.....#', '#######'];

function insideOpen(world: ReturnType<typeof makeWorld>, x: number, z: number, r: number): boolean {
  const s = world.grid.size;
  // The circle may not overlap any solid cell (small tolerance for float error).
  for (let cz = 0; cz < world.grid.h; cz++) {
    for (let cx = 0; cx < world.grid.w; cx++) {
      if (!cellAt(world.grid, cx, cz)!.solid) continue;
      const px = Math.min(Math.max(x, cx * s), cx * s + s);
      const pz = Math.min(Math.max(z, cz * s), cz * s + s);
      if (Math.hypot(x - px, z - pz) < r - 1e-6) return false;
    }
  }
  return true;
}

describe('collision', () => {
  it('never passes through walls at any angle, even at 4x speed', () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const w = makeWorld(ROOM);
      const p = w.players[0]!;
      place(w, 0, 3, 3, deg);
      // 4x walking speed applied directly as a displacement per tick.
      for (let i = 0; i < 180; i++) {
        const a = p.yaw;
        moveBody(w.terrain, p, Math.sin(a) * (20 / 60), -Math.cos(a) * (20 / 60));
        expect(insideOpen(w, p.x, p.z, p.radius)).toBe(true);
      }
    }
  });

  it('a single huge displacement does not tunnel through a wall', () => {
    const w = makeWorld(ROOM);
    const p = w.players[0]!;
    place(w, 0, 3, 3);
    moveBody(w.terrain, p, 0, -50);
    expect(p.z).toBeGreaterThanOrEqual(2 + p.radius - 1e-6);
  });

  it('slides along a wall instead of stopping', () => {
    const w = makeWorld(ROOM);
    const p = w.players[0]!;
    place(w, 0, 3, 2 + p.radius + 0.01, 45); // hugging the north wall, facing north-east
    run(w, 30, [intent({ moveZ: 1 })]);
    expect(p.x).toBeGreaterThan(4);
    expect(p.z).toBeCloseTo(2 + p.radius, 2);
  });

  it('walks over a small step', () => {
    const w = makeWorld(['#####', '#.__#', '#####']);
    place(w, 0, 3, 3, 90);
    run(w, 60, [intent({ moveZ: 1 })]);
    const p = w.players[0]!;
    expect(p.x).toBeGreaterThan(5);
    expect(p.y).toBeCloseTo(0.3, 5);
  });

  it('climbs a ramp onto a platform', () => {
    const w = makeWorld(['######', '#..>+#', '######']);
    place(w, 0, 3, 3, 90);
    run(w, 120, [intent({ moveZ: 1 })]);
    const p = w.players[0]!;
    expect(p.x).toBeGreaterThan(8);
    expect(p.y).toBeCloseTo(1.2, 5);
  });

  it('does not climb a 1 m ledge', () => {
    const w = makeWorld(['#####', '#..H#', '#####']);
    place(w, 0, 3, 3, 90);
    run(w, 120, [intent({ moveZ: 1 })]);
    const p = w.players[0]!;
    expect(p.x).toBeLessThanOrEqual(6 - p.radius + 1e-6);
    expect(p.y).toBe(0);
  });

  it('falls off a ledge and lands', () => {
    const w = makeWorld(['#####', '#..H#', '#####']);
    const p = w.players[0]!;
    place(w, 0, 7, 3, -90);
    p.y = 1;
    run(w, 120, [intent({ moveZ: 1 })]);
    expect(p.x).toBeLessThan(6);
    expect(p.y).toBe(0);
    expect(p.grounded).toBe(true);
  });

  it('needs to crouch to enter a low passage, and cannot stand up inside it', () => {
    const w = makeWorld(['#######', '#..===#', '#######']);
    const p = w.players[0]!;
    place(w, 0, 3, 3, 90);
    run(w, 90, [intent({ moveZ: 1 })]);
    expect(p.x).toBeLessThanOrEqual(6 - p.radius + 1e-6);
    run(w, 150, [intent({ moveZ: 1, crouch: true })]);
    expect(p.x).toBeGreaterThan(9);
    run(w, 30, [intent({})]);
    expect(p.crouch).toBe(1);
  });

  it('collides with props and other players', () => {
    const w = makeWorld(['#######', '#.....#', '#######'], [{ type: 'prop', kind: 'crate', cell: [3, 1] }], 2);
    const [a, b] = w.players;
    place(w, 0, 3, 3, 90);
    place(w, 1, 11, 3, -90);
    run(w, 120, [intent({ moveZ: 1 }), intent({ moveZ: 1 })]);
    // The crate (1.2 m wide at x 7) stops player 0; player 1 ends up against player 0 or the crate.
    expect(a!.x).toBeLessThanOrEqual(7 - 0.6 - a!.radius + 1e-6);
    expect(b!.x).toBeGreaterThanOrEqual(7 + 0.6 + b!.radius - 1e-6);
  });
});
