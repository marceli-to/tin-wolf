import { describe, expect, it } from 'vitest';
import { createRng, nextFloat } from '../../src/core/rng';

describe('rng', () => {
  it('is deterministic per seed and in [0,1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const x = nextFloat(a);
      expect(x).toBe(nextFloat(b));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
