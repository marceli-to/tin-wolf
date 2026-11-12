/** Seeded PRNG (mulberry32). All sim randomness goes through this. */
export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * nextFloat(rng);
}

/** Roughly normal-distributed value in [-1, 1] (sum of two uniforms). */
export function spread(rng: Rng): number {
  return nextFloat(rng) + nextFloat(rng) - 1;
}
