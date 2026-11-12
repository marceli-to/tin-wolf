import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/data/load';
import { createWorld } from '../../src/sim/world';
import { data, LEGEND } from './helpers';

const level = parseLevel({
  id: 't',
  name: 't',
  mode: 'mission',
  legend: LEGEND,
  map: ['######', '#....#', '######'],
  entities: [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [3, 1], yaw: 0 }],
});
const make = (difficulty?: string) => createWorld(level, data, { players: 1, seed: 1, difficulty });

describe('difficulty', () => {
  it('normal leaves guard archetypes unchanged', () => {
    const w = make();
    expect(w.enemies.guard_basic).toEqual(data.enemies.guard_basic);
    expect(w.guards[0]!.hp).toBe(data.enemies.guard_basic!.hp);
  });

  it('easy guards are slower to notice and react, miss more, hit softer and have less hp', () => {
    const base = data.enemies.guard_basic!;
    const easy = make('easy');
    const e = easy.enemies.guard_basic!;
    expect(e.noticeTime).toBeGreaterThan(base.noticeTime);
    expect(e.reactionTime).toBeGreaterThan(base.reactionTime);
    expect(e.aimSpreadDeg).toBeGreaterThan(base.aimSpreadDeg);
    expect(e.damageScale).toBeLessThan(base.damageScale);
    expect(easy.guards[0]!.hp).toBeLessThan(base.hp);
  });

  it('hard guards are sharper than normal', () => {
    const h = make('hard').enemies.guard_basic!;
    const base = data.enemies.guard_basic!;
    expect(h.reactionTime).toBeLessThan(base.reactionTime);
    expect(h.damageScale).toBeGreaterThan(base.damageScale);
  });

  it('an unknown difficulty falls back to normal', () => {
    expect(make('nightmare').enemies.guard_basic).toEqual(data.enemies.guard_basic);
  });
});
