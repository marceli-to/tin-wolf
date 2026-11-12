import { clamp } from '../core/math';

/** Standard-mapping button indices. */
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  LS: 10,
  RS: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

export interface StickValue {
  x: number;
  y: number;
}

/**
 * Radial dead zone, rescaled so output starts at 0 just past the dead zone,
 * then shaped by an exponent so small deflections give fine control.
 */
export function shapeStick(x: number, y: number, deadZone: number, exponent: number): StickValue {
  const mag = Math.hypot(x, y);
  if (mag <= deadZone) return { x: 0, y: 0 };
  const n = clamp((mag - deadZone) / (1 - deadZone), 0, 1);
  const shaped = Math.pow(n, exponent);
  return { x: (x / mag) * shaped, y: (y / mag) * shaped };
}

/** Snapshot of all connected pads with edge detection, polled once per frame. */
export class Gamepads {
  private prev = new Map<number, boolean[]>();
  private cur = new Map<number, boolean[]>();
  private pads = new Map<number, Gamepad>();

  poll(): void {
    this.prev = this.cur;
    this.cur = new Map();
    this.pads.clear();
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of list) {
      if (!gp || !gp.connected) continue;
      this.pads.set(gp.index, gp);
      this.cur.set(
        gp.index,
        gp.buttons.map((b) => b.pressed || b.value > 0.5),
      );
    }
  }

  connected(): number[] {
    return [...this.pads.keys()];
  }

  has(index: number): boolean {
    return this.pads.has(index);
  }

  down(index: number, button: number): boolean {
    return this.cur.get(index)?.[button] ?? false;
  }

  pressed(index: number, button: number): boolean {
    return this.down(index, button) && !(this.prev.get(index)?.[button] ?? false);
  }

  axis(index: number, axis: number): number {
    return this.pads.get(index)?.axes[axis] ?? 0;
  }
}
