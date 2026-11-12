import { describe, expect, it } from 'vitest';
import { rayBox, rayCylinder, rayGrid } from '../../src/sim/raycast';
import { makeWorld } from './helpers';

describe('rayGrid', () => {
  const w = makeWorld(['#######', '#....H#', '#######']);
  it('hits a wall at the right distance with the right normal', () => {
    const hit = rayGrid(w.grid, { ox: 3, oy: 1.5, oz: 3, dx: -1, dy: 0, dz: 0 }, 100);
    expect(hit!.t).toBeCloseTo(1, 6);
    expect(hit!.nx).toBe(1);
  });
  it('hits the step face of a raised cell', () => {
    const hit = rayGrid(w.grid, { ox: 3, oy: 0.5, oz: 3, dx: 1, dy: 0, dz: 0 }, 100);
    expect(hit!.t).toBeCloseTo(7, 6);
    expect(hit!.nx).toBe(-1);
  });
  it('passes over the raised cell and hits the far wall', () => {
    const hit = rayGrid(w.grid, { ox: 3, oy: 1.5, oz: 3, dx: 1, dy: 0, dz: 0 }, 100);
    expect(hit!.t).toBeCloseTo(9, 6);
  });
  it('hits the floor when aiming down', () => {
    const d = Math.SQRT1_2;
    const hit = rayGrid(w.grid, { ox: 3, oy: 1, oz: 3, dx: d, dy: -d, dz: 0 }, 100);
    expect(hit!.ny).toBe(1);
    expect(hit!.t).toBeCloseTo(Math.SQRT2, 5);
  });
  it('returns null when out of range', () => {
    expect(rayGrid(w.grid, { ox: 3, oy: 1.5, oz: 3, dx: 1, dy: 0, dz: 0 }, 2)).toBeNull();
  });
});

describe('rayBox / rayCylinder', () => {
  it('rayBox reports entry face', () => {
    const hit = rayBox({ ox: 0, oy: 0.5, oz: 0, dx: 1, dy: 0, dz: 0 }, { minX: 2, maxX: 3, minY: 0, maxY: 1, minZ: -1, maxZ: 1 }, 10);
    expect(hit!.t).toBeCloseTo(2);
    expect(hit!.nx).toBe(-1);
  });
  it('rayCylinder hits side and cap', () => {
    expect(rayCylinder({ ox: 0, oy: 1, oz: 0, dx: 1, dy: 0, dz: 0 }, 5, 0, 0.5, 0, 2, 100)).toBeCloseTo(4.5);
    expect(rayCylinder({ ox: 5, oy: 5, oz: 0, dx: 0, dy: -1, dz: 0 }, 5, 0, 0.5, 0, 2, 100)).toBeCloseTo(3);
    expect(rayCylinder({ ox: 0, oy: 3, oz: 0, dx: 1, dy: 0, dz: 0 }, 5, 0, 0.5, 0, 2, 100)).toBeNull();
  });
});
