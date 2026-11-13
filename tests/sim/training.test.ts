import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../src/sim/events';
import { GUARD_REVIVE_TIME, TARGET_POP_TIME } from '../../src/sim/targets';
import type { World } from '../../src/sim/world';
import { intent, makeWorld, place, run } from './helpers';

const RANGE = ['#'.repeat(22), ...Array.from({ length: 8 }, () => '#' + '.'.repeat(20) + '#'), '#'.repeat(22)];
const secs = (s: number) => Math.round(s * 60);

/** Player at the west end facing east; targets face west (yaw 270), toward the player. */
function range(targets: unknown[], extra: unknown[] = []): World {
  const w = makeWorld(RANGE, [...targets, ...extra], 1, { mode: 'training', loadout: ['sniper', 'grenade'] });
  place(w, 0, 3, 9, 90);
  run(w, 40, [intent()]);
  return w;
}

/** Aims player 0 at a point and fires one round. */
function shootAt(w: World, x: number, y: number, z: number): SimEvent[] {
  const p = w.players[0]!;
  const ex = p.x;
  const ey = p.y + 1.6;
  const ez = p.z;
  p.yaw = Math.atan2(x - ex, -(z - ez));
  p.pitch = Math.atan2(y - ey, Math.hypot(x - ex, z - ez));
  // Scoped in, the rifle has no spread.
  run(w, 15, [intent({ aim: true })]);
  p.weapon.cooldown = 0;
  p.weapon.mag = 4;
  const out: SimEvent[] = [];
  run(w, 1, [intent({ fire: true, aim: true })]);
  out.push(...w.events);
  run(w, 1, [intent()]);
  return out;
}

describe('training targets', () => {
  it('fall when hit, report a bullseye in the centre, and pop up again', () => {
    const w = range([{ type: 'target', id: 't1', cell: [10, 4], yaw: 270 }]);
    const t = w.targets[0]!;
    const ev = shootAt(w, t.x, t.y, t.z);
    const hit = ev.find((e) => e.type === 'targetHit');
    expect(hit && hit.type === 'targetHit' && hit.bullseye).toBe(true);
    expect(t.standing).toBe(false);
    run(w, 20, [intent()]);
    expect(t.up).toBe(0);
    // Down, it cannot be hit.
    expect(shootAt(w, t.x, t.y - 0.6, t.z).some((e) => e.type === 'targetHit')).toBe(false);
    run(w, secs(TARGET_POP_TIME + 0.5), [intent()]);
    expect(t.standing).toBe(true);
    expect(t.up).toBe(1);
  });

  it('an off-centre hit is not a bullseye; a miss beside the board does nothing', () => {
    const w = range([{ type: 'target', cell: [10, 4], yaw: 270 }]);
    const t = w.targets[0]!;
    expect(shootAt(w, t.x, t.y + t.radius * 1.6, t.z).some((e) => e.type === 'targetHit')).toBe(false);
    const ev = shootAt(w, t.x, t.y + t.radius * 0.7, t.z);
    const hit = ev.find((e) => e.type === 'targetHit');
    expect(hit && hit.type === 'targetHit' && hit.bullseye).toBe(false);
  });

  it('moving targets slide back and forth on their rail', () => {
    const w = range([{ type: 'target', cell: [12, 1], to: [12, 7], speed: 3, yaw: 270 }]);
    const t = w.targets[0]!;
    const zs: number[] = [];
    for (let i = 0; i < secs(10); i++) {
      run(w, 1, [intent()]);
      zs.push(t.z);
    }
    expect(Math.min(...zs)).toBeCloseTo(3, 1);
    expect(Math.max(...zs)).toBeCloseTo(15, 1);
  });

  it('a grenade knocks down targets around it', () => {
    const w = range([
      { type: 'target', cell: [8, 4], yaw: 270 },
      { type: 'target', cell: [8, 5], yaw: 270 },
      { type: 'target', cell: [18, 4], yaw: 270 },
    ]);
    const p = w.players[0]!;
    p.weapon = p.weapons.find((x) => x.id === 'grenade')!;
    // Drop it right between the two near targets.
    place(w, 0, 15, 10, 90);
    p.pitch = -1.2;
    run(w, 1, [intent({ fire: true })]);
    run(w, secs(3), [intent()]);
    expect(w.targets.map((t) => t.standing)).toEqual([false, false, true]);
  });

  it('keeps reserves full', () => {
    const w = range([]);
    const p = w.players[0]!;
    p.ammo.pistol = 0;
    run(w, 1, [intent()]);
    expect(p.ammo.pistol ?? 0).toBe(0); // pools of weapons not carried are left alone
    p.ammo.rifle = 0;
    run(w, 1, [intent()]);
    expect(p.ammo.rifle).toBe(w.data.weapons.sniper!.maxReserve);
  });
});

describe('training course', () => {
  it('starts at the panel, keeps hit targets down, and finishes with time and accuracy', () => {
    const w = range(
      [
        { type: 'target', id: 'a', cell: [10, 3], yaw: 270 },
        { type: 'target', id: 'b', cell: [10, 5], yaw: 270 },
      ],
      [{ type: 'prop', kind: 'start_panel', id: 'start', cell: [2, 4], elevation: 0.8 }],
    );
    const p = w.players[0]!;
    // Free practice: knock one down first; the run must stand it up again.
    shootAt(w, w.targets[0]!.x, w.targets[0]!.y, w.targets[0]!.z);
    expect(w.targets[0]!.standing).toBe(false);
    // Use the panel (it is right in front, to the north-west).
    const panel = w.props.find((x) => x.id === 'start')!;
    const pb = panel.box;
    p.yaw = Math.atan2((pb.minX + pb.maxX) / 2 - p.x, -((pb.minZ + pb.maxZ) / 2 - p.z));
    p.pitch = Math.atan2((pb.minY + pb.maxY) / 2 - 1.6, Math.hypot((pb.minX + pb.maxX) / 2 - p.x, (pb.minZ + pb.maxZ) / 2 - p.z));
    run(w, 1, [intent({ interact: true })]);
    expect(w.events.some((e) => e.type === 'courseStarted')).toBe(true);
    expect(w.course?.running).toBe(true);
    expect(w.targets.every((t) => t.standing)).toBe(true);
    run(w, 30, [intent()]);
    // One miss, two hits.
    shootAt(w, 30, 1.4, 1);
    const [a, b] = w.targets;
    shootAt(w, a!.x, a!.y, a!.z);
    run(w, secs(TARGET_POP_TIME + 1), [intent()]);
    expect(a!.standing).toBe(false); // stays down during the run
    const ev = shootAt(w, b!.x, b!.y, b!.z);
    const done = ev.find((e) => e.type === 'courseDone');
    expect(done && done.type === 'courseDone' && done.accuracy).toBeCloseTo(2 / 3, 5);
    expect(done && done.type === 'courseDone' && done.time).toBeGreaterThan(3);
    expect(w.course?.running).toBe(false);
    run(w, secs(3), [intent()]);
    expect(w.targets.every((t) => t.standing)).toBe(true);
  });
});

describe('practice dummies', () => {
  const dummy = (extra: Record<string, unknown> = {}) => ({ type: 'guard', id: 'd', archetype: 'guard_dummy', cell: [12, 2], yaw: 270, ...extra });

  it('walk their patrol in plain view and never notice or shoot', () => {
    const w = range([], [dummy({ patrol: [[18, 2], [12, 2]] })]);
    const g = w.guards[0]!;
    const x0 = g.x;
    let farthest = 0;
    for (let i = 0; i < secs(8); i++) {
      run(w, 1, [intent()]);
      farthest = Math.max(farthest, g.x - x0);
      expect(g.state).toBe('patrol');
    }
    expect(farthest).toBeGreaterThan(6);
    expect(g.sinceShot).toBeGreaterThan(7);
    expect(w.players[0]!.hp).toBe(100);
  });

  it('go down when shot and are back at their post a few seconds later', () => {
    const w = range([], [dummy()]);
    const g = w.guards[0]!;
    shootAt(w, g.x, g.y + 1.2, g.z);
    expect(w.guards[0]!.state).toBe('dead');
    run(w, secs(GUARD_REVIVE_TIME + 0.5), [intent()]);
    const back = w.guards[0]!;
    expect(back.state).toBe('patrol');
    expect(back.hp).toBeGreaterThan(0);
    expect(back.x).toBeCloseTo(25, 1);
  });

  it('count toward the course, and a new run brings them back', () => {
    const w = range(
      [{ type: 'target', id: 'a', cell: [10, 6], yaw: 270 }],
      [dummy(), { type: 'prop', kind: 'start_panel', id: 'start', cell: [2, 4], elevation: 0.8 }],
    );
    const p = w.players[0]!;
    // Down before the run: the run stands it up again.
    shootAt(w, w.guards[0]!.x, w.guards[0]!.y + 1.2, w.guards[0]!.z);
    expect(w.guards[0]!.state).toBe('dead');
    const pb = w.props.find((x) => x.id === 'start')!.box;
    p.yaw = Math.atan2((pb.minX + pb.maxX) / 2 - p.x, -((pb.minZ + pb.maxZ) / 2 - p.z));
    p.pitch = Math.atan2((pb.minY + pb.maxY) / 2 - 1.6, Math.hypot((pb.minX + pb.maxX) / 2 - p.x, (pb.minZ + pb.maxZ) / 2 - p.z));
    run(w, 1, [intent({ interact: true })]);
    expect(w.course?.total).toBe(2);
    expect(w.guards[0]!.state).toBe('patrol');
    run(w, 30, [intent()]);
    const t = w.targets[0]!;
    shootAt(w, t.x, t.y, t.z);
    expect(w.course?.running).toBe(true);
    // The last one down finishes the run.
    const g = w.guards[0]!;
    const ev = shootAt(w, g.x, g.y + 1.2, g.z);
    expect(ev.some((e) => e.type === 'courseDone')).toBe(true);
  });
});
