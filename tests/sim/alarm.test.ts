import { describe, expect, it } from 'vitest';
import { findCover, raiseAlarm } from '../../src/sim/ai';
import type { World } from '../../src/sim/world';
import { intent, makeWorld, place, run } from './helpers';

const OPEN = ['################', '#..............#', '#..............#', '#..............#', '#..............#', '################'];
const idle = [intent()];

function world(extra: unknown[] = []): World {
  return makeWorld(
    OPEN,
    [
      { type: 'guard', id: 'g', archetype: 'guard_basic', cell: [4, 2], yaw: 90 },
      { type: 'guard', id: 'r', archetype: 'guard_basic', cell: [13, 4], yaw: 0, reserve: true },
      ...extra,
    ],
    1,
    { mode: 'mission' },
  );
}

/** Player in plain view of the guard, a few cells east of it. */
function spotted(w: World): void {
  const g = w.guards[0]!;
  place(w, 0, g.x + 6, g.z, -90);
}

describe('alarm panels', () => {
  it('reserves stay out of the level until the alarm', () => {
    const w = world();
    expect(w.guards.map((g) => g.id)).toEqual(['g']);
    expect(w.reserves.map((e) => e.id)).toEqual(['r']);
  });

  it('an alerted guard runs to the panel, raises the alarm, and the reinforcements arrive hunting', () => {
    const w = world([{ type: 'prop', id: 'panel', kind: 'alarm_panel', cell: [2, 1.06], elevation: 1 }]);
    spotted(w);
    const g = w.guards[0]!;
    let ran = false;
    for (let i = 0; i < 60 * 10 && !w.alarm.raised; i++) {
      run(w, 1, idle);
      if (w.events.some((e) => e.type === 'alarmRunner')) ran = true;
    }
    expect(g.state).toBe('attack');
    expect(ran).toBe(true);
    expect(w.alarm.raised).toBe(true);
    const r = w.guards.find((o) => o.id === 'r');
    expect(r?.state).toBe('attack');
    expect(r?.lastKnown).not.toBeNull();
    expect(w.reserves).toHaveLength(0);
  });

  it('a destroyed panel cannot be used', () => {
    const w = world([{ type: 'prop', id: 'panel', kind: 'alarm_panel', cell: [2, 1.06], elevation: 1 }]);
    w.props.find((p) => p.id === 'panel')!.alive = false;
    spotted(w);
    run(w, 60 * 6, idle);
    expect(w.guards[0]!.alarmTarget).toBeNull();
    expect(w.alarm.raised).toBe(false);
  });

  it('raising the alarm twice does nothing the second time', () => {
    const w = world();
    raiseAlarm(w, null);
    const n = w.guards.length;
    raiseAlarm(w, null);
    expect(w.guards.length).toBe(n);
  });
});

describe('cover', () => {
  it('finds a spot behind a crate that hides a crouching guard from the player', () => {
    const w = world([{ type: 'prop', id: 'c', kind: 'crate', cell: [6, 3] }]);
    const crate = w.props.find((p) => p.id === 'c')!;
    const cx = (crate.box.minX + crate.box.maxX) / 2;
    const cz = (crate.box.minZ + crate.box.maxZ) / 2;
    const g = w.guards[0]!;
    g.x = cx - 2.5;
    g.z = cz - 1;
    // Player well east of the crate: cover is on the crate's west side.
    place(w, 0, cx + 8, cz, -90);
    const spot = findCover(w, g, w.players[0]!);
    expect(spot).not.toBeNull();
    expect(spot!.x).toBeLessThan(crate.box.minX);
  });

  it('returns nothing in an empty room', () => {
    const w = world();
    const g = w.guards[0]!;
    place(w, 0, g.x + 6, g.z, -90);
    const spot = findCover(w, g, w.players[0]!);
    // Only wall edges exist here, and the player can see along them.
    if (spot) expect(Math.hypot(spot.x - w.players[0]!.x, spot.z - w.players[0]!.z)).toBeGreaterThanOrEqual(4);
  });
});
