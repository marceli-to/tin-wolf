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
  // Sounds that belong to one player's own head (hurt, reload, pickups) are for people, not bots.
  const human = (slot: number): boolean => !world.players[slot]?.bot;
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
      if (e.target.kind === 'player' && human(e.target.slot)) sfx.play('hurt', 0.8);
      if (e.shooter?.kind === 'player' && human(e.shooter.slot)) sfx.play('hit_marker', 0.5);
      break;
    case 'died':
      if (e.target.kind === 'player' && human(e.target.slot)) sfx.play('death', 0.8);
      else at('death', e.x ?? 0, e.z ?? 0, 0.6);
      break;
    case 'reloadStart': {
      if (!human(e.slot)) break;
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
      if (human(e.slot)) sfx.play('switch', 0.5);
      break;
    case 'dryFire':
      if (human(e.slot)) sfx.play('dry', 0.6);
      break;
    case 'footstep':
      at('footstep', e.x, e.z, e.loud ? 0.5 : 0.35);
      break;
    case 'guardStep':
      at('guard_step', e.x, e.z, e.running ? 0.5 : 0.3);
      break;
    case 'pickup':
      // Power-ups have their own fanfare (the 'powerup' event).
      if (human(e.slot) && world.data.items[e.item]?.kind !== 'powerup') sfx.play('pickup', 0.6);
      break;
    case 'powerup':
      if (human(e.slot)) sfx.play('powerup', 0.7);
      else at('powerup', e.x, e.z, 0.5);
      break;
    case 'powerEnded':
      if (human(e.slot)) sfx.play(e.power === 'tiny' ? 'grow' : 'power_end', 0.5);
      break;
    case 'shrunk':
      if (e.target.kind === 'player' && human(e.target.slot)) sfx.play('shrink', 0.7);
      else at('shrink', e.x, e.z, 0.6);
      break;
    case 'shieldBlock':
      if (human(e.slot)) sfx.play('shield_block', 0.5);
      break;
    case 'propRespawned':
      at('box_back', e.x, e.z, 0.6);
      break;
    case 'targetHit':
      // Not positional: a far target must still ring clearly for the shooter.
      sfx.play(e.bullseye ? 'bullseye' : 'target_hit', 0.7);
      break;
    case 'courseStarted':
      sfx.play('objective', 0.6);
      break;
    case 'courseDone':
      sfx.play('mission_success', 0.6);
      break;
    case 'doorOpened':
      at('door', e.x, e.z, 0.7);
      break;
    case 'doorLocked':
      sfx.play('locked', 0.6);
      break;
    case 'propDestroyed': {
      // Explosive props make their bang with the blast a moment later.
      const prop = world.props.find((p) => p.id === e.id);
      const kind = world.data.props[prop?.kind ?? ''];
      if (kind?.loot) at('box_pop', e.x, e.z, 0.9);
      else if (!kind?.blast) at('explosion', e.x, e.z, 1);
      break;
    }
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
