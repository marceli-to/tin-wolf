import { describe, expect, it } from 'vitest';
import { applyDamage } from '../../src/sim/combat';
import type { SimEvent } from '../../src/sim/events';
import { SWITCH_TIME } from '../../src/sim/weapons';
import type { World } from '../../src/sim/world';
import { data, intent, makeWorld, place, run } from './helpers';

const OPEN = ['##############', '#............#', '#............#', '#............#', '#............#', '##############'];
const idle = [intent()];
const secs = (s: number) => Math.round(s * 60);
const grenade = data.weapons.grenade!;

function collect(w: World, ticks: number, intents: Parameters<typeof run>[2]): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    run(w, 1, intents);
    all.push(...w.events);
  }
  return all;
}

describe('arsenal: loadout and switching', () => {
  it('starts with the level loadout; weapons sharing a pool share reserve', () => {
    const w = makeWorld(OPEN, [], 1, { loadout: ['pistol_sd', 'pistol'] });
    const p = w.players[0]!;
    expect(p.weapons.map((x) => x.id)).toEqual(['pistol_sd', 'pistol']);
    expect(p.weapon.id).toBe('pistol_sd');
    expect(p.ammo.pistol).toBe(data.weapons.pistol_sd!.startReserve + data.weapons.pistol!.startReserve);
  });

  it('switches on a press, blocks fire while switching, and cycles back', () => {
    const w = makeWorld(OPEN, [], 1, { loadout: ['pistol_sd', 'pistol'] });
    const p = w.players[0]!;
    place(w, 0, 3, 3, 90);
    const ev = collect(w, 1, [intent({ weaponNext: true })]);
    expect(p.weapon.id).toBe('pistol');
    expect(ev.some((e) => e.type === 'weaponSwitched')).toBe(true);
    // Holding the button does not keep cycling.
    run(w, 10, [intent({ weaponNext: true })]);
    expect(p.weapon.id).toBe('pistol');
    run(w, 1, [intent({ fire: true })]);
    expect(p.shotsFired).toBe(0);
    run(w, secs(SWITCH_TIME), idle);
    run(w, 1, [intent({ fire: true })]);
    expect(p.shotsFired).toBe(1);
    run(w, 1, idle);
    run(w, 1, [intent({ weaponSlot: 1 })]);
    expect(p.weapon.id).toBe('pistol_sd');
  });

  it('a silenced shot is heard by a nearby guard but not one across the room', () => {
    const w = makeWorld(OPEN, [
      { type: 'guard', id: 'near', archetype: 'guard_basic', cell: [3, 2], yaw: 180 },
      { type: 'guard', id: 'far', archetype: 'guard_basic', cell: [12, 4], yaw: 0 },
    ], 1, { mode: 'mission', loadout: ['pistol_sd'] });
    place(w, 0, 5, 3, 0);
    run(w, 1, [intent({ fire: true })]);
    run(w, 2, idle);
    expect(w.guards[0]!.state).toBe('attack');
    expect(w.guards[1]!.state).toBe('patrol');
  });
});

describe('arsenal: pickups and drops', () => {
  it('a weapon pickup adds the gun, loads it and draws it; a second one only adds ammo', () => {
    const w = makeWorld(OPEN, [
      { type: 'pickup', item: 'weapon_smg', cell: [3, 1] },
      { type: 'pickup', item: 'weapon_smg', cell: [6, 1] },
    ]);
    const p = w.players[0]!;
    place(w, 0, 7, 3);
    run(w, 1, idle);
    expect(p.weapon.id).toBe('smg');
    expect(p.weapon.mag).toBe(Math.min(30, data.items.weapon_smg!.amount));
    const before = p.ammo.smg ?? 0;
    place(w, 0, 13, 3);
    run(w, 1, idle);
    expect(p.weapons.filter((x) => x.id === 'smg')).toHaveLength(1);
    expect(p.ammo.smg).toBe(before + data.items.weapon_smg!.amount);
  });

  it('the SMG fires while the trigger is held', () => {
    const w = makeWorld(OPEN, [], 1, { loadout: ['smg'] });
    const p = w.players[0]!;
    place(w, 0, 3, 5, 90);
    run(w, secs(0.5), [intent({ fire: true })]);
    expect(p.shotsFired).toBeGreaterThanOrEqual(5);
  });

  it('a dead guard drops its loot', () => {
    const w = makeWorld(OPEN, [{ type: 'guard', id: 'r', archetype: 'guard_rifle', cell: [8, 2], yaw: 0 }], 1, { mode: 'mission' });
    const g = w.guards[0]!;
    applyDamage(w, { kind: 'guard', index: 0 }, 999, 'torso', { kind: 'player', slot: 0 }, g);
    expect(w.pickups.some((pk) => pk.item === 'weapon_smg' && pk.active)).toBe(true);
  });
});

describe('arsenal: grenades', () => {
  function thrower(entities: unknown[] = [], map = OPEN): World {
    const w = makeWorld(map, entities, 2, { mode: 'versus', loadout: ['grenade'] });
    return w;
  }

  it('flies, bounces off a wall, explodes after the fuse and hurts in radius', () => {
    const w = thrower();
    const [a, b] = w.players as [World['players'][0], World['players'][0]];
    place(w, 0, 3, 3, 90); // facing +x along the room
    place(w, 1, 24, 7, 0);
    b.protect = a.protect = 0;
    const ev = collect(w, 1, [intent({ fire: true }), intent()]);
    expect(ev.some((e) => e.type === 'thrown')).toBe(true);
    expect(w.projectiles).toHaveLength(1);
    expect(a.ammo.grenade).toBe(grenade.startReserve - 1);
    const all = collect(w, secs(grenade.fuse) + 2, [intent(), intent()]);
    expect(w.projectiles).toHaveLength(0);
    const boom = all.find((e) => e.type === 'explosion');
    expect(boom).toBeTruthy();
    // It stays inside the room.
    if (boom?.type === 'explosion') {
      expect(boom.x).toBeGreaterThan(2);
      expect(boom.x).toBeLessThan(26);
    }
    expect(a.hp).toBe(100);
  });

  it('blast damage falls off with distance and walls block it', () => {
    const w = thrower([], ['##############', '#......#.....#', '#......#.....#', '##############']);
    const [a, b] = w.players as [World['players'][0], World['players'][0]];
    place(w, 0, 3, 3, 90);
    place(w, 1, 17, 3, 0); // behind the wall
    a.protect = b.protect = 0;
    w.projectiles.push({ id: 99, weapon: 'grenade', owner: { kind: 'player', slot: 0 }, x: 5, y: 0.1, z: 3, vx: 0, vy: 0, vz: 0, fuse: 0.01, prev: { x: 5, y: 0.1, z: 3 } });
    run(w, 2, [intent(), intent()]);
    expect(a.hp).toBeLessThan(100);
    expect(b.hp).toBe(100);
  });

  it('the last grenade thrown puts the hand away', () => {
    const w = makeWorld(OPEN, [], 1, { loadout: ['pistol', 'grenade'] });
    const p = w.players[0]!;
    p.ammo.grenade = 1;
    run(w, 1, [intent({ weaponSlot: 2 })]);
    expect(p.weapon.id).toBe('grenade');
    run(w, secs(SWITCH_TIME) + 1, idle);
    run(w, 1, [intent({ fire: true })]);
    expect(p.weapon.id).toBe('pistol');
    // With none left, grenades cannot be drawn.
    run(w, secs(SWITCH_TIME) + 1, idle);
    run(w, 1, [intent({ weaponSlot: 2 })]);
    expect(p.weapon.id).toBe('pistol');
  });

  it('an explosion alerts guards in earshot', () => {
    const w = makeWorld(OPEN, [{ type: 'guard', id: 'g', archetype: 'guard_basic', cell: [11, 4], yaw: 0 }], 1, { mode: 'mission' });
    w.projectiles.push({ id: 1, weapon: 'grenade', owner: { kind: 'player', slot: 0 }, x: 4, y: 0.1, z: 3, vx: 0, vy: 0, vz: 0, fuse: 0.01, prev: { x: 4, y: 0.1, z: 3 } });
    place(w, 0, 3, 9, 180);
    run(w, 3, idle);
    expect(w.guards[0]!.state).toBe('attack');
  });
});
