import { describe, expect, it } from 'vitest';
import { loadLevel } from '../../src/data';
import { parseLevel } from '../../src/data/load';

describe('level loader', () => {
  it('loads the test room', () => {
    expect(loadLevel('test_room').map.length).toBeGreaterThan(3);
  });
  it('names the bad field', () => {
    expect(() => parseLevel({ id: 'x', name: 'x', legend: { '#': { solid: 'yes' } }, map: ['#'] })).toThrow(/legend\.#\.solid/);
  });
  it('names row and column of an unknown map char', () => {
    expect(() => parseLevel({ id: 'x', name: 'x', legend: { '#': { solid: true } }, map: ['##', '#x'] })).toThrow(/map\.1: char 'x' at column 1/);
  });
  it('rejects a roof outside the map', () => {
    expect(() => parseLevel({ id: 'x', name: 'x', legend: { '#': { solid: true } }, map: ['##'], roofs: [{ from: [0, 0], to: [2, 0], eave: 3, rise: 2 }] })).toThrow(
      /roofs\.0\.to: \[2, 0\] is outside the map/,
    );
  });
  it('reads the Snowfort roof and the range markers', () => {
    expect(loadLevel('arena_snowfort').roofs).toEqual([{ from: [8, 8], to: [13, 13], eave: 3.6, rise: 3.4, ridge: 'x', overhang: 0.4, mat: 'roof' }]);
    const markers = loadLevel('training').entities.filter((e) => e.type === 'marker');
    expect(markers.map((m) => m.type === 'marker' && m.text)).toEqual(['10 m', '20 m', '30 m', '40 m']);
  });
  it('rejects ragged rows and out-of-map entities', () => {
    expect(() =>
      parseLevel({ id: 'x', name: 'x', legend: { '#': { solid: true } }, map: ['##', '#'], entities: [{ type: 'spawn', cell: [5, 5] }] }),
    ).toThrow(/map\.1: row has 1 chars[\s\S]*entities\.0\.cell/);
  });
});

import { levelIds } from '../../src/data';
import { validateLevel } from '../../src/sim/validate';

describe('all shipped levels', () => {
  for (const id of levelIds()) {
    it(`${id} passes gameplay validation`, () => {
      expect(validateLevel(loadLevel(id))).toEqual([]);
    });
  }
});
