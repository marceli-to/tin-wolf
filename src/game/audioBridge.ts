import type { Sfx, SfxName } from '../audio/sfx';
import { angleDiff, yawTo } from '../core/math';
import type { SimEvent } from '../sim/events';
import type { World } from '../sim/world';

/** Turns sim events into positioned sound, relative to the nearest living player. */
export function playSimEvent(sfx: Sfx, world: World, e: SimEvent): void {
  const at = (name: SfxName, x: number, z: number, base = 1, delay = 0): void => {
    let best = Infinity;
    let pan = 0;
    for (const p of world.players) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) {
        best = d;
        pan = world.players.length === 1 && d > 0.5 ? Math.sin(angleDiff(p.yaw, yawTo(p.x, p.z, x, z))) * 0.7 : 0;
      }
    }
    const vol = base / (1 + best / 7);
    sfx.play(name, vol, pan, delay);
  };
  switch (e.type) {
    case 'shotFired': {
      const def = world.data.weapons[e.weapon];
      at((def?.sfx as SfxName) ?? 'pistol_shot', e.x, e.z, 0.9);
      break;
    }
    case 'impact':
      if (e.surface === 'flesh') at('hit_flesh', e.x, e.z, 0.8);
      else at('impact', e.x, e.z, 0.5);
      break;
    case 'hit':
      if (e.target.kind === 'player') sfx.play('hurt', 0.8);
      if (e.shooter?.kind === 'player') sfx.play('hit_marker', 0.5);
      break;
    case 'died':
      if (e.target.kind === 'player') sfx.play('death', 0.8);
      else at('death', e.x ?? 0, e.z ?? 0, 0.6);
      break;
    case 'reloadStart': {
      const p = world.players[e.slot];
      const def = p && world.data.weapons[p.weapon.id];
      sfx.play('reload_out', 0.6);
      if (def) sfx.play('reload_in', 0.6, 0, def.reloadTime * 0.75);
      break;
    }
    case 'thrown':
      at('throw', e.x, e.z, 0.7);
      break;
    case 'bounce':
      at('bounce', e.x, e.z, 0.6);
      break;
    case 'explosion':
      at('explosion', e.x, e.z, 1.4);
      break;
    case 'weaponSwitched':
      sfx.play('switch', 0.5);
      break;
    case 'dryFire':
      sfx.play('dry', 0.6);
      break;
    case 'footstep':
      at('footstep', e.x, e.z, e.loud ? 0.5 : 0.35);
      break;
    case 'guardStep':
      at('guard_step', e.x, e.z, e.running ? 0.5 : 0.3);
      break;
    case 'pickup':
      sfx.play('pickup', 0.6);
      break;
    case 'doorOpened':
      at('door', e.x, e.z, 0.7);
      break;
    case 'doorLocked':
      sfx.play('locked', 0.6);
      break;
    case 'propDestroyed':
      at('explosion', e.x, e.z, 1);
      break;
    case 'guardAlerted':
      at('alert', e.x, e.z, 0.5);
      break;
    case 'objectiveCompleted':
      sfx.play('objective', 0.7);
      break;
    case 'missionEnded':
      sfx.play(e.success ? 'mission_success' : 'mission_fail', 0.7, 0, 0.4);
      break;
    case 'matchEnded':
      sfx.play('mission_success', 0.6);
      break;
    case 'used':
      sfx.play('ui_select', 0.6);
      break;
    default:
      break;
  }
}
