import { describe, expect, it } from 'vitest';
import { zoomFactor } from '../../src/sim/player';
import { data, intent, makeWorld, place, run } from './helpers';

const LONG = ['#'.repeat(42), '#' + '.'.repeat(40) + '#', '#' + '.'.repeat(40) + '#', '#' + '.'.repeat(40) + '#', '#'.repeat(42)];
const sniper = data.weapons.sniper!;

function armed(loadout: string[], players = 1) {
  const w = makeWorld(LONG, [], players, { loadout });
  run(w, 40, [intent(), intent()]); // let the draw finish
  return w;
}

describe('sniper rifle', () => {
  it('is in the data with a scope', () => {
    expect(sniper.zoom).toBeGreaterThan(1);
    expect(data.items.weapon_sniper?.weapon).toBe('sniper');
  });

  it('scopes in while aiming and out when released', () => {
    const w = armed(['sniper']);
    const p = w.players[0]!;
    run(w, 30, [intent({ aim: true })]);
    expect(p.zoom).toBe(1);
    expect(zoomFactor(w, p)).toBe(sniper.zoom);
    run(w, 30, [intent()]);
    expect(p.zoom).toBe(0);
  });

  it('other weapons ignore aim', () => {
    const w = armed(['pistol']);
    run(w, 30, [intent({ aim: true })]);
    expect(w.players[0]!.zoom).toBe(0);
  });

  it('turns slower by the magnification while scoped', () => {
    const w = armed(['sniper']);
    const p = w.players[0]!;
    run(w, 30, [intent({ aim: true })]);
    const before = p.yaw;
    run(w, 1, [intent({ aim: true, lookYaw: 0.4 })]);
    expect(p.yaw - before).toBeCloseTo(0.4 / sniper.zoom, 5);
  });

  it('stops sprinting while scoped', () => {
    const w = armed(['sniper']);
    run(w, 30, [intent({ aim: true, moveZ: 1, sprint: true })]);
    expect(w.players[0]!.sprinting).toBe(false);
  });

  it('scoped, it hits a far target dead centre every time; from the hip it scatters', () => {
    const hits = (scoped: boolean): number => {
      let n = 0;
      for (let k = 0; k < 8; k++) {
        const w = armed(['sniper'], 2);
        const [a, b] = [w.players[0]!, w.players[1]!];
        place(w, 0, 3, 5, 90);
        place(w, 1, 75, 5, 270);
        b.hp = 1e6;
        b.protect = 0;
        a.pitch = Math.atan2(1.3 - 1.6, 72); // at the target's chest
        run(w, 30, [intent({ aim: scoped }), intent()]);
        a.weapon.cooldown = 0;
        const hp = b.hp;
        run(w, 1, [intent({ aim: scoped, fire: true }), intent()]);
        if (b.hp < hp) n++;
      }
      return n;
    };
    expect(hits(true)).toBe(8);
    expect(hits(false)).toBeLessThan(8);
  });
});
