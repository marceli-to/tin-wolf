import type { HitZone } from './events';

export interface ZoneCylinder {
  zone: HitZone;
  r: number;
  y0: number;
  y1: number;
}

/**
 * Body proportions the hit zones follow: 'human' for realistic figures, 'chibi' for the Kenney
 * figures (short legs, small torso, a head over half the height), 'tinfox' for Tin Fox's own
 * figures (about five heads tall, a cap on top), 'tinfox_f' for the women's body (`hero-f`, the worker:
 * 1.70 m to the skull, a tall hard hat on top).
 */
export type BodyShape = 'human' | 'chibi' | 'tinfox' | 'tinfox_f';

/** Standing height per body shape, metres. Tin Fox figures are modelled at 1.80 m to the skull, 1.90 m with the cap;
 * the worker 1.858 m with her hard hat, so both are drawn at the scale they were modelled at. */
export const BODY_HEIGHT: Record<BodyShape, number> = { human: 1.75, chibi: 1.75, tinfox: 1.9, tinfox_f: 1.86 };

/**
 * Scale on a weapon's extra head damage: a chibi head is so large that a centred shot nearly always
 * lands on it, so the bonus is halved (head ×4 becomes ×2.5).
 */
export const HEAD_BONUS_SCALE: Record<BodyShape, number> = { human: 1, chibi: 0.5, tinfox: 1, tinfox_f: 1 };

/** Hit zones of a standing humanoid of height h, as fractions of height. Feet at y = 0. */
export function humanoidZones(h: number, shape: BodyShape = 'human'): ZoneCylinder[] {
  if (shape === 'chibi') {
    return [
      { zone: 'limb', r: 0.22, y0: 0, y1: 0.25 * h },
      { zone: 'torso', r: 0.34, y0: 0.25 * h, y1: 0.44 * h },
      { zone: 'head', r: 0.36, y0: 0.44 * h, y1: h },
    ];
  }
  if (shape === 'tinfox' || shape === 'tinfox_f') {
    // Measured on the guard model: legs to the crotch at 0.45, the neck (head bone) at 0.775; the
    // head zone runs from there over the cap, as wide as the head with its brim. The worker's neck sits
    // at 0.737 (her hard hat is taller than the cap), the crotch the same.
    const neck = shape === 'tinfox_f' ? 0.737 : 0.775;
    return [
      { zone: 'limb', r: 0.24, y0: 0, y1: 0.45 * h },
      { zone: 'torso', r: 0.3, y0: 0.45 * h, y1: neck * h },
      { zone: 'head', r: 0.19, y0: neck * h, y1: h },
    ];
  }
  return [
    { zone: 'limb', r: 0.24, y0: 0, y1: 0.48 * h },
    { zone: 'torso', r: 0.3, y0: 0.48 * h, y1: 0.82 * h },
    { zone: 'head', r: 0.15, y0: 0.82 * h, y1: h },
  ];
}

/** Damage multiplier for a zone hit, after the body shape's head-bonus scale. */
export function zoneDamage(multiplier: number, zone: HitZone, shape: BodyShape): number {
  return zone === 'head' ? 1 + (multiplier - 1) * HEAD_BONUS_SCALE[shape] : multiplier;
}
