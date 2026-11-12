import { describe, expect, it } from 'vitest';
import { advanceLoop, MAX_FRAME_TIME } from '../../src/core/loop';

describe('advanceLoop', () => {
  const dt = 1 / 60;
  it('runs one step per dt and carries the remainder', () => {
    const s = { accumulator: 0 };
    const r = advanceLoop(s, dt * 2.5, dt);
    expect(r.steps).toBe(2);
    expect(r.alpha).toBeCloseTo(0.5, 5);
    const r2 = advanceLoop(s, dt * 0.5, dt);
    expect(r2.steps).toBe(1);
    expect(r2.alpha).toBeCloseTo(0, 5);
  });
  it('clamps huge frames', () => {
    const s = { accumulator: 0 };
    const r = advanceLoop(s, 10, dt);
    expect(r.steps).toBe(Math.floor(MAX_FRAME_TIME / dt + 1e-9));
  });
  it('ignores negative frame times', () => {
    const s = { accumulator: 0 };
    expect(advanceLoop(s, -1, dt).steps).toBe(0);
  });
});
