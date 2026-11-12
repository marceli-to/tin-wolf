import type { HitZone } from './events';

export interface ZoneCylinder {
  zone: HitZone;
  r: number;
  y0: number;
  y1: number;
}

/** Hit zones of a standing humanoid of height h, as fractions of height. Feet at y = 0. */
export function humanoidZones(h: number): ZoneCylinder[] {
  return [
    { zone: 'limb', r: 0.24, y0: 0, y1: 0.48 * h },
    { zone: 'torso', r: 0.3, y0: 0.48 * h, y1: 0.82 * h },
    { zone: 'head', r: 0.15, y0: 0.82 * h, y1: h },
  ];
}
