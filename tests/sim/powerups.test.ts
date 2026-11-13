import { describe, expect, it } from 'vitest';
import { PLAYER, POWER } from '../../src/config';
import { applyDamage, damageProp } from '../../src/sim/combat';
import { applyPowerup } from '../../src/sim/powerups';
import { respawnPlayer } from '../../src/sim/spawn';
import type { World } from '../../src/sim/world';
import { data, intent, makeWorld, place, run } from './helpers';

const OPEN = ['##############', '#............#', '#............#', '#............#', '#............#', '##############'];
const idle = [intent(), intent()];
const box = data.props.surprise_box!;
const BOX = { type: 'prop', kind: 'surprise_box', id: 'box', cell: [5, 2] };

function world(mode: 'versus' | 'mission', entities: unknown[] = [BOX], players = mode === 'versus' ? 2 : 1, map = OPEN): World {
  const w = makeWorld(map, entities, players, { mode });
  place(w, 0, 3, 3, 90);
  if (players > 1) place(w, 1, 23, 9, 270);
  return w;
}
const boxIndex = (w: World) => w.props.findIndex((p) => p.id === 'box');
const give = (w: World, slot: number, item: string) => applyPowerup(w, w.players[slot]!, item, data.items[item]!);
const breakBox = (w: World) => damageProp(w, boxIndex(w), 100, { kind: 'player', slot: 0 });
/** Walks player 0 onto the box's spot (cell 5,2 → x 11, z 5) and back out. */
function collect(w: World): void {
  place(w, 0, 11, 5, 90);
  run(w, 1, idle);
  place(w, 0, 3, 3, 90);
}

describe('surprise box', () => {
  it('only holds power-ups that exist', () => {
    for (const [kind, def] of Object.entries(data.props)) {
      for (const id of def.loot ?? []) expect(data.items[id]?.kind, `${kind} → ${id}`).toBe('powerup');
    }
  });

  it('breaks with one shot and drops a power-up from its loot', () => {
    const w = world('mission');
    damageProp(w, boxIndex(w), 1, { kind: 'player', slot: 0 });
    expect(w.props[boxIndex(w)]!.alive).toBe(false);
    const drop = w.pickups.at(-1)!;
    expect(box.loot).toContain(drop.item);
    expect(drop.active).toBe(true);
    expect(drop.x).toBeCloseTo(11);
    expect(drop.z).toBeCloseTo(5);
  });

  it('a level can pin what a box gives', () => {
    const w = world('mission', [{ ...BOX, drop: 'power_jump' }]);
    breakBox(w);
    expect(w.pickups.at(-1)!.item).toBe('power_jump');
  });

  it('picks its prize at random, but the same way for the same seed', () => {
    const items = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const w = world('mission');
      w.rng.state = i * 7919 + 1;
      breakBox(w);
      items.add(w.pickups.at(-1)!.item);
    }
    expect(items.size).toBeGreaterThan(3);
    const a = world('mission');
    const b = world('mission');
    breakBox(a);
    breakBox(b);
    expect(a.pickups.at(-1)!.item).toBe(b.pickups.at(-1)!.item);
  });

  it('in versus it comes back a while after its prize was taken, not before', () => {
    const w = world('versus', [{ ...BOX, drop: 'power_speed' }]);
    breakBox(w);
    run(w, 60 * (box.respawn! + 5), idle);
    expect(w.props[boxIndex(w)]!.alive).toBe(false); // the prize is still lying there
    collect(w);
    expect(w.players[0]!.power.speed).toBeGreaterThan(0);
    run(w, 60 * (box.respawn! - 1), idle);
    expect(w.props[boxIndex(w)]!.alive).toBe(false);
    run(w, 60 * 2, idle);
    expect(w.props[boxIndex(w)]!.alive).toBe(true);
    expect(w.props[boxIndex(w)]!.hp).toBe(box.hp);
  });

  it('does not come back on top of someone standing there', () => {
    const w = world('versus', [{ ...BOX, drop: 'power_speed' }]);
    breakBox(w);
    place(w, 0, 11, 5, 90);
    run(w, 60 * (box.respawn! + 2), idle);
    expect(w.props[boxIndex(w)]!.alive).toBe(false);
    place(w, 0, 3, 3, 90);
    run(w, 2, idle);
    expect(w.props[boxIndex(w)]!.alive).toBe(true);
  });

  it('in a mission it is a one-time find', () => {
    const w = world('mission', [{ ...BOX, drop: 'power_speed' }]);
    breakBox(w);
    collect(w);
    run(w, 60 * 60, idle);
    expect(w.props[boxIndex(w)]!.alive).toBe(false);
  });
});

describe('power-ups', () => {
  it('Zoom Boots: faster, until they run out', () => {
    const dist = (power: boolean): number => {
      const w = world('mission', []);
      if (power) give(w, 0, 'power_speed');
      run(w, 30, [intent({ moveZ: 1 })]);
      return w.players[0]!.x - 3;
    };
    expect(dist(true)).toBeGreaterThan(dist(false) * 1.4);
    const w = world('mission', []);
    give(w, 0, 'power_speed');
    run(w, 60 * data.items.power_speed!.duration + 2, idle);
    expect(w.players[0]!.power.speed).toBe(0);
  });

  it('Moon Jump: jumps much higher', () => {
    const apex = (power: boolean): number => {
      // Open sky: the test room's 3 m ceiling would stop the jump.
      const w = makeWorld(OPEN, [], 1, { mode: 'mission', legend: { '#': { solid: true }, '.': { floor: 0, ceil: 8 } } });
      place(w, 0, 3, 3, 90);
      if (power) give(w, 0, 'power_jump');
      let top = 0;
      run(w, 90, (t) => {
        top = Math.max(top, w.players[0]!.y);
        return [intent({ jump: t === 0 })];
      });
      return top;
    };
    expect(apex(false)).toBeCloseTo(PLAYER.jumpHeight, 1);
    expect(apex(true)).toBeCloseTo(POWER.jumpHeight, 1);
  });

  it('Bubble Shield: blocks all damage, then wears off', () => {
    const w = world('versus', []);
    const p = w.players[0]!;
    give(w, 0, 'power_shield');
    applyDamage(w, { kind: 'player', slot: 0 }, 500, 'head', { kind: 'player', slot: 1 }, p);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(w.events.some((e) => e.type === 'shieldBlock')).toBe(true);
    run(w, 60 * data.items.power_shield!.duration + 2, idle);
    applyDamage(w, { kind: 'player', slot: 0 }, 30, 'torso', { kind: 'player', slot: 1 }, p);
    expect(p.hp).toBe(PLAYER.maxHp - 30);
  });

  it('Double Blast: twice the damage', () => {
    const w = world('versus', []);
    give(w, 1, 'power_damage');
    applyDamage(w, { kind: 'player', slot: 0 }, 20, 'torso', { kind: 'player', slot: 1 }, w.players[0]!);
    expect(w.players[0]!.hp).toBe(PLAYER.maxHp - 40);
  });

  it('Full Refill: health and every gun topped up; left lying if there is nothing to fill', () => {
    const w = world('mission', []);
    const p = w.players[0]!;
    give(w, 0, 'power_refill'); // the start loadout is not full
    expect(give(w, 0, 'power_refill')).toBe(false);
    p.hp = 20;
    p.weapon.mag = 0;
    const pool = data.weapons[p.weapon.id]!.ammo;
    p.ammo[pool] = 0;
    expect(give(w, 0, 'power_refill')).toBe(true);
    expect(p.hp).toBe(PLAYER.maxHp);
    expect(p.weapon.mag).toBe(data.weapons[p.weapon.id]!.magSize);
    expect(p.ammo[pool]).toBe(data.weapons[p.weapon.id]!.maxReserve);
  });

  it('Shrink Ray: the other player goes tiny, slow and weak, then grows back', () => {
    const w = world('versus', []);
    const [a, b] = [w.players[0]!, w.players[1]!];
    give(w, 0, 'power_shrink');
    expect(a.power.tiny).toBe(0);
    expect(b.power.tiny).toBeGreaterThan(0);
    run(w, 1, idle);
    expect(b.height).toBeCloseTo(PLAYER.height * POWER.tinyScale);
    applyDamage(w, { kind: 'player', slot: 0 }, 20, 'torso', { kind: 'player', slot: 1 }, a);
    expect(a.hp).toBe(PLAYER.maxHp - 20 * POWER.tinyDamage);
    run(w, 60 * data.items.power_shrink!.duration + 2, idle);
    expect(b.power.tiny).toBe(0);
    expect(b.height).toBeCloseTo(PLAYER.height);
  });

  it('Shrink Ray: a Bubble Shield protects', () => {
    const w = world('versus', []);
    give(w, 1, 'power_shield');
    give(w, 0, 'power_shrink');
    expect(w.players[1]!.power.tiny).toBe(0);
  });

  it('Shrink Ray: growing back in a low duct comes back crouched', () => {
    const map = ['##############', '#.....======.#', '#............#', '##############'];
    const w = world('versus', [], 2, map);
    place(w, 1, 15, 3, 90); // under the 1.4 m ceiling
    give(w, 0, 'power_shrink');
    run(w, 60 * data.items.power_shrink!.duration + 2, idle);
    const b = w.players[1]!;
    expect(b.power.tiny).toBe(0);
    expect(b.crouch).toBe(1);
    expect(b.height).toBeLessThan(1.4);
  });

  it('Shrink Ray: shrinks nearby guards in a mission, and they hit softer', () => {
    const w = world('mission', [
      { type: 'guard', id: 'near', archetype: 'guard_basic', cell: [6, 2] },
      { type: 'guard', id: 'far', archetype: 'guard_basic', cell: [12, 4] },
    ]);
    w.guards[1]!.x = 3 + POWER.shrinkRadius + 1;
    give(w, 0, 'power_shrink');
    expect(w.guards[0]!.tiny).toBeGreaterThan(0);
    expect(w.guards[1]!.tiny).toBe(0);
    applyDamage(w, { kind: 'player', slot: 0 }, 20, 'torso', { kind: 'guard', index: 0 }, w.players[0]!);
    expect(w.players[0]!.hp).toBe(PLAYER.maxHp - 20 * POWER.tinyDamage);
  });

  it('dying ends every power-up', () => {
    const w = world('versus', []);
    const p = w.players[0]!;
    give(w, 0, 'power_damage');
    give(w, 1, 'power_shrink');
    respawnPlayer(w, p);
    expect(Object.values(p.power).every((t) => t === 0)).toBe(true);
  });
});
