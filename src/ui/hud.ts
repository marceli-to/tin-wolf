import type { ViewRect } from '../render/views';
import type { Player, World } from '../sim/world';
import { el, esc } from './dom';

export interface HudExtras {
  /** Short-lived message in the middle of the view (kills, pickups, objectives). */
  notice: string;
  /** Persistent line at the top (score, timer). */
  top: string;
  needsLock: boolean;
}

/** One absolutely positioned DOM layer per player view. */
export class PlayerHud {
  readonly root = el('div', 'hud');
  private crosshair = el('div', 'crosshair');
  private lockHint = el('div', 'lock-hint', 'Click to capture mouse');
  private center = el('div', 'center-msg');
  private notice = el('div', 'notice');
  private top = el('div', 'hud-top');
  private hurt = el('div', 'hurt');
  private health = el('div', 'hud-health');
  private ammo = el('div', 'hud-ammo');
  private last = '';

  constructor(parent: HTMLElement) {
    this.root.append(this.hurt, this.crosshair, this.top, this.notice, this.center, this.health, this.ammo, this.lockHint);
    parent.appendChild(this.root);
  }

  place(r: ViewRect): void {
    const s = this.root.style;
    s.left = `${r.x}px`;
    s.top = `${r.y}px`;
    s.width = `${r.w}px`;
    s.height = `${r.h}px`;
    this.root.classList.toggle('small', r.w < 700 || r.h < 450);
  }

  update(world: World, p: Player, x: HudExtras): void {
    const def = world.data.weapons[p.weapon.id];
    this.hurt.style.opacity = String(Math.min(0.55, p.hurtTimer * 1.6) + (p.alive ? 0 : 0.25));
    this.crosshair.style.display = p.alive ? 'block' : 'none';
    this.lockHint.style.display = x.needsLock ? 'block' : 'none';
    const reloading = p.weapon.reloadTimer > 0;
    // Only touch the DOM when something visible changed.
    const key = [
      Math.ceil(p.hp),
      Math.ceil(p.armor),
      p.weapon.mag,
      p.weapon.reserve,
      reloading,
      p.alive,
      Math.ceil(p.deadTimer),
      p.protect > 0,
      x.notice,
      x.top,
      world.level.mode,
    ].join('|');
    if (key === this.last) return;
    this.last = key;
    const hpPct = Math.max(0, Math.min(100, p.hp));
    const armPct = Math.max(0, Math.min(100, p.armor));
    this.health.innerHTML = `
      <div class="bar"><div class="fill hp" style="width:${hpPct}%"></div></div>
      ${p.armor > 0 ? `<div class="bar"><div class="fill armor" style="width:${armPct}%"></div></div>` : ''}
      <div class="label">${Math.ceil(p.hp)}</div>`;
    this.ammo.innerHTML = def
      ? `<div class="wname">${esc(def.name)}</div><div class="rounds"><b>${p.weapon.mag}</b> / ${p.weapon.reserve}</div>${
          reloading ? '<div class="reloading">RELOADING</div>' : p.weapon.mag === 0 ? '<div class="reloading">EMPTY</div>' : ''
        }`
      : '';
    if (!p.alive) {
      this.center.innerHTML =
        world.level.mode === 'mission' ? 'YOU ARE DOWN' : `YOU ARE DOWN<br><small>back in ${Math.max(0, Math.ceil(p.deadTimer))}</small>`;
    } else {
      this.center.innerHTML = p.protect > 0 ? '<small>spawn protection</small>' : '';
    }
    this.notice.innerHTML = x.notice;
    this.top.innerHTML = x.top;
  }

  dispose(): void {
    this.root.remove();
  }
}

export class DebugOverlay {
  readonly root = el('div', 'debug-overlay');
  private frames = 0;
  private acc = 0;

  constructor(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  frame(dt: number, extra: string): void {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      const fps = this.frames / this.acc;
      this.root.textContent = `${fps.toFixed(0)} fps  ${extra}`;
      this.frames = 0;
      this.acc = 0;
    }
  }
}
