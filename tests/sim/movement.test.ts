import { describe, expect, it } from 'vitest';
import { PLAYER } from '../../src/config';
import type { World } from '../../src/sim/world';
import { intent, makeWorld, place, run } from './helpers';

const HALL = ['#'.repeat(42), '#' + '.'.repeat(40) + '#', '#' + '.'.repeat(40) + '#', '#' + '.'.repeat(40) + '#', '#'.repeat(42)];
const secs = (s: number) => Math.round(s * 60);

function speedAfter(w: World, ticks: number, i: ReturnType<typeof intent>): number {
  run(w, ticks, [i]);
  const p = w.players[0]!;
  return Math.hypot(p.vx, p.vz);
}

describe('sprint', () => {
  it('runs faster than walking, forward only', () => {
    const w = makeWorld(HALL);
    place(w, 0, 6, 4, 90);
    expect(speedAfter(w, 30, intent({ moveZ: 1, sprint: true }))).toBeCloseTo(PLAYER.sprintSpeed, 1);
    expect(w.players[0]!.sprinting).toBe(true);
    place(w, 0, 6, 4, 90);
    expect(speedAfter(w, 30, intent({ moveZ: 1 }))).toBeCloseTo(PLAYER.walkSpeed, 1);
    place(w, 0, 30, 4, 90);
    // Backwards or sideways, sprint does nothing.
    expect(speedAfter(w, 30, intent({ moveZ: -1, sprint: true }))).toBeCloseTo(PLAYER.walkSpeed, 1);
    expect(speedAfter(w, 30, intent({ moveX: 1, sprint: true }))).toBeCloseTo(PLAYER.walkSpeed, 1);
    expect(w.players[0]!.sprinting).toBe(false);
  });

  it('does not sprint while crouched', () => {
    const w = makeWorld(HALL);
    place(w, 0, 6, 4, 90);
    expect(speedAfter(w, 30, intent({ moveZ: 1, sprint: true, crouch: true }))).toBeCloseTo(PLAYER.crouchSpeed, 1);
    expect(w.players[0]!.sprinting).toBe(false);
  });

  it('is heard by a guard from further away than walking', () => {
    const heard = (sprint: boolean): boolean => {
      const s = makeWorld(HALL, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [3, 2], yaw: 270 }], 1, { mode: 'mission' });
      const g = s.guards[0]!;
      // Behind the guard (it faces west), 6.5 m away, running further east.
      place(s, 0, g.x + 6.5, g.z, 90);
      run(s, secs(1.2), [intent({ moveZ: 1, sprint })]);
      return g.state !== 'patrol';
    };
    expect(heard(false)).toBe(false);
    expect(heard(true)).toBe(true);
  });
});

describe('jump', () => {
  const jumpPeak = (w: World, extra: Partial<ReturnType<typeof intent>> = {}): number => {
    const p = w.players[0]!;
    let peak = p.y;
    for (let t = 0; t < secs(1); t++) {
      run(w, 1, [intent({ jump: t < 3, ...extra })]);
      peak = Math.max(peak, p.y);
    }
    return peak;
  };

  it('reaches the jump height and lands again', () => {
    const w = makeWorld(HALL);
    place(w, 0, 6, 4, 90);
    expect(jumpPeak(w)).toBeCloseTo(PLAYER.jumpHeight, 1);
    expect(w.players[0]!.y).toBe(0);
    expect(w.players[0]!.grounded).toBe(true);
  });

  it('needs a fresh press for every jump', () => {
    const w = makeWorld(HALL);
    place(w, 0, 6, 4, 90);
    const p = w.players[0]!;
    let jumps = 0;
    let wasGrounded = true;
    for (let t = 0; t < secs(3); t++) {
      run(w, 1, [intent({ jump: true })]);
      if (wasGrounded && !p.grounded) jumps++;
      wasGrounded = p.grounded;
    }
    expect(jumps).toBe(1);
  });

  it('does not jump while crouched', () => {
    const w = makeWorld(HALL);
    place(w, 0, 6, 4, 90);
    run(w, 30, [intent({ crouch: true })]);
    expect(jumpPeak(w, { crouch: true })).toBe(0);
  });

  it('hops onto a crate but not onto a tall crate', () => {
    const onto = (kind: string): number => {
      const w = makeWorld(HALL, [{ type: 'prop', kind, cell: [6, 2] }]);
      place(w, 0, 9, 5, 90);
      // Run at it and jump on the way.
      run(w, secs(1.5), (t) => [intent({ moveZ: t < 52 ? 1 : 0, jump: t >= 26 && t < 30 })]);
      return w.players[0]!.y;
    };
    expect(onto('crate')).toBeGreaterThan(0.9);
    expect(onto('crate_tall')).toBe(0);
  });

  it('bumps its head under a low ceiling', () => {
    const DUCT = ['#######', '#.....#', '#.===.#', '#.....#', '#######'];
    const w = makeWorld(DUCT);
    // In the middle '=' cell (1.4 m ceiling), crouched.
    place(w, 0, 7, 5, 90);
    run(w, 40, [intent({ crouch: true })]);
    const p = w.players[0]!;
    run(w, secs(1), [intent({ crouch: true, jump: true })]);
    expect(p.y).toBe(0);
  });

  it('on a gamepad A opens a door in front instead of jumping', () => {
    const ROOMS = ['###########', '#...#.....#', '#...D.....#', '#...#.....#', '###########'];
    const legend = { '#': { solid: true }, '.': { floor: 0, ceil: 3 }, D: { floor: 0, ceil: 3 } };
    const w = makeWorld(ROOMS, [{ type: 'door', id: 'd1', cell: [4, 2] }], 1, { mode: 'mission', legend });
    place(w, 0, 7, 5, 90);
    run(w, 60, [intent({ moveZ: 1 })]);
    let peak = 0;
    for (let t = 0; t < 40; t++) {
      run(w, 1, [intent({ interact: t < 2, jump: t < 2 })]);
      peak = Math.max(peak, w.players[0]!.y);
    }
    expect(peak).toBe(0);
    expect(w.doors[0]!.open).toBeGreaterThan(0);
  });
});
