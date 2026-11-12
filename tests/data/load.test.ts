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
  it('rejects ragged rows and out-of-map entities', () => {
    expect(() =>
      parseLevel({ id: 'x', name: 'x', legend: { '#': { solid: true } }, map: ['##', '#'], entities: [{ type: 'spawn', cell: [5, 5] }] }),
    ).toThrow(/map\.1: row has 1 chars[\s\S]*entities\.0\.cell/);
  });
});
