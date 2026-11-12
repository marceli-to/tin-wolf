import { describe, expect, it } from 'vitest';
import { applyAimAssist, assistTarget } from '../../src/sim/aimAssist';
import type { World } from '../../src/sim/world';
import { intent, makeWorld, place } from './helpers';

const OPEN = ['##############', '#............#', '#............#', '#............#', '##############'];
const DEG = Math.PI / 180;

/** One guard in the right half; the player stands in the left half, facing it (east). */
function world(map = OPEN): World {
  const w = makeWorld(map, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [10, 2], yaw: 0 }], 1, { mode: 'mission' });
  const g = w.guards[0]!;
  place(w, 0, g.x - (g.x / 10) * 7, g.z, 90);
  w.players[0]!.pitch = 0;
  return w;
}

describe('aim assist', () => {
  it('finds a visible target near the crosshair, not one behind a wall or far off-axis', () => {
    const w = world();
    expect(assistTarget(w, w.players[0]!)).not.toBeNull();
    w.players[0]!.yaw += 40 * DEG;
    expect(assistTarget(w, w.players[0]!)).toBeNull();
    const walled = world(['##############', '#.....#......#', '#.....#......#', '#.....#......#', '##############']);
    expect(assistTarget(walled, walled.players[0]!)).toBeNull();
  });

  it('slows turning over a target', () => {
    const w = world();
    const i = intent({ lookYaw: 0.02, aimAssist: true });
    applyAimAssist(w, w.players[0]!, i, 1 / 60);
    // Slowed, plus at most a tiny pull back toward the target.
    expect(i.lookYaw).toBeLessThan(0.02);
  });

  it('pulls toward the target while moving, but never aims by itself when idle', () => {
    const w = world();
    const p = w.players[0]!;
    p.yaw += 3 * DEG;
    const idle = intent({ aimAssist: true });
    applyAimAssist(w, p, idle, 1 / 60);
    expect(idle.lookYaw).toBe(0);

    const moving = intent({ moveZ: 1, aimAssist: true });
    applyAimAssist(w, p, moving, 1 / 60);
    // The player turned 3° past the target to the right, so the pull turns left.
    expect(moving.lookYaw).toBeLessThan(0);
  });

  it('does nothing without the aimAssist flag (mouse)', () => {
    const w = world();
    w.players[0]!.yaw += 3 * DEG;
    const i = intent({ lookYaw: 0.02, moveZ: 1 });
    applyAimAssist(w, w.players[0]!, i, 1 / 60);
    expect(i.lookYaw).toBe(0.02);
  });
});
