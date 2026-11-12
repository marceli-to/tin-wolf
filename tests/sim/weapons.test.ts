import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../src/sim/events';
import type { World } from '../../src/sim/world';
import { PLAYER } from '../../src/config';
import { data, intent, makeWorld, place, run } from './helpers';

const pistol = data.weapons.pistol!;

function noSpread(w: World): void {
  w.data = { ...w.data, weapons: { ...w.data.weapons, pistol: { ...pistol, spreadDeg: 0 } } };
}

function events(w: World, ticks: number, intents: Parameters<typeof run>[2]): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    run(w, 1, typeof intents === 'function' ? [intents(i)].flat() : intents);
    all.push(...w.events);
  }
  return all;
}

const OPEN = ['############', '#..........#', '#..........#', '############'];

describe('weapons: ammo and reload', () => {
  it('semi-auto fires once per trigger press and counts ammo', () => {
    const w = makeWorld(OPEN);
    const p = w.players[0]!;
    run(w, 30, [intent({ fire: true })]);
    expect(p.weapon.mag).toBe(pistol.magSize - 1);
    // Three separate presses, spaced beyond the fire interval.
    for (let i = 0; i < 3; i++) {
      run(w, 1, [intent({})]);
      run(w, 20, [intent({ fire: true })]);
    }
    expect(p.weapon.mag).toBe(pistol.magSize - 4);
    expect(p.shotsFired).toBe(4);
  });

  it('respects the fire interval', () => {
    const w = makeWorld(OPEN);
    const p = w.players[0]!;
    // Press every other tick: only one shot per fireInterval gets through.
    run(w, 60, (i) => [intent({ fire: i % 2 === 0 })]);
    expect(p.shotsFired).toBe(Math.ceil(1 / pistol.fireInterval));
  });

  it('reload takes reloadTime and moves rounds from reserve', () => {
    const w = makeWorld(OPEN);
    const p = w.players[0]!;
    run(w, 1, [intent({ fire: true })]);
    run(w, 1, [intent({})]);
    run(w, 1, [intent({ reload: true })]);
    const ticks = Math.round(pistol.reloadTime * 60);
    run(w, ticks - 3, [intent({})]);
    expect(p.weapon.mag).toBe(pistol.magSize - 1);
    run(w, 3, [intent({})]);
    expect(p.weapon.mag).toBe(pistol.magSize);
    expect(p.ammo.pistol).toBe(pistol.startReserve - 1);
  });

  it('cannot fire while reloading; empty mag dry-fires and auto-reloads', () => {
    const w = makeWorld(OPEN);
    const p = w.players[0]!;
    p.weapon.mag = 0;
    const ev = events(w, 2, [intent({ fire: true })]);
    expect(ev.some((e) => e.type === 'dryFire')).toBe(true);
    expect(ev.some((e) => e.type === 'reloadStart')).toBe(true);
    expect(p.weapon.reloadTimer).toBeGreaterThan(0);
    run(w, 1, [intent({})]);
    run(w, 1, [intent({ fire: true })]);
    expect(p.shotsFired).toBe(0);
  });

  it('does not reload with an empty reserve', () => {
    const w = makeWorld(OPEN);
    const p = w.players[0]!;
    p.weapon.mag = 2;
    p.ammo.pistol = 0;
    run(w, 1, [intent({ reload: true })]);
    expect(p.weapon.reloadTimer).toBe(0);
  });
});

describe('weapons: hitscan', () => {
  function duel(map: string[], pitchDeg: number): World {
    const w = makeWorld(map, [], 2);
    noSpread(w);
    place(w, 0, 3, 3, 90);
    place(w, 1, 9, 3, -90);
    w.players[0]!.pitch = (pitchDeg * Math.PI) / 180;
    return w;
  }

  it('a wall blocks the shot', () => {
    const w = duel(['############', '#..#.......#', '############'], 0);
    const ev = events(w, 1, [intent({ fire: true }), intent({})]);
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
    expect(ev.some((e) => e.type === 'impact' && e.surface === 'world')).toBe(true);
    expect(w.players[1]!.hp).toBe(PLAYER.maxHp);
  });

  it('reports head and limb zones; head does more damage', () => {
    const head = duel(OPEN, Math.atan2(1.6 - 1.6, 6) * (180 / Math.PI) + 0.5);
    const evH = events(head, 1, [intent({ fire: true }), intent({})]);
    const hitH = evH.find((e) => e.type === 'hit');
    expect(hitH && hitH.type === 'hit' && hitH.zone).toBe('head');

    const legs = duel(OPEN, Math.atan2(0.4 - 1.6, 6) * (180 / Math.PI));
    const evL = events(legs, 1, [intent({ fire: true }), intent({})]);
    const hitL = evL.find((e) => e.type === 'hit');
    expect(hitL && hitL.type === 'hit' && hitL.zone).toBe('limb');

    const torso = duel(OPEN, Math.atan2(1.15 - 1.6, 6) * (180 / Math.PI));
    const evT = events(torso, 1, [intent({ fire: true }), intent({})]);
    const hitT = evT.find((e) => e.type === 'hit');
    expect(hitT && hitT.type === 'hit' && hitT.zone).toBe('torso');

    const dmgHead = PLAYER.maxHp - head.players[1]!.hp;
    const dmgLegs = PLAYER.maxHp - legs.players[1]!.hp;
    expect(dmgHead).toBeGreaterThan(dmgLegs);
    expect(dmgLegs).toBe(pistol.damage * pistol.zoneMultiplier.limb);
  });

  it('kills, credits the shooter, and respawns the victim', () => {
    const w = duel(OPEN, 0);
    w.players[1]!.hp = 10;
    const ev = events(w, 1, [intent({ fire: true }), intent({})]);
    expect(ev.some((e) => e.type === 'died')).toBe(true);
    expect(w.players[1]!.alive).toBe(false);
    expect(w.players[0]!.kills).toBe(1);
    expect(w.players[1]!.deaths).toBe(1);
    run(w, Math.ceil(PLAYER.respawnDelay * 60) + 1, [intent({}), intent({})]);
    expect(w.players[1]!.alive).toBe(true);
    expect(w.players[1]!.hp).toBe(PLAYER.maxHp);
  });

  it('shots damage destructible props', () => {
    const w = makeWorld(OPEN, [{ type: 'prop', id: 'c1', kind: 'console', cell: [4, 1] }]);
    noSpread(w);
    place(w, 0, 3, 3, 90);
    w.players[0]!.pitch = Math.atan2(0.6 - 1.6, 6);
    const prop = w.props[0]!;
    for (let i = 0; i < 6; i++) {
      run(w, 1, [intent({ fire: true })]);
      run(w, 20, [intent({})]);
    }
    expect(prop.alive).toBe(false);
  });
});
