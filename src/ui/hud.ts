import type { ViewRect } from '../render/views';
import type { Player, World } from '../sim/world';
import { el, esc } from './dom';

export interface HudExtras {
  /** HTML list of objectives, shown while non-empty. */
  objectives: string;
  /** Interaction prompt ("E  Open door"). */
  prompt: string;
  promptLocked: boolean;
  /** Short-lived message in the middle of the view (kills, pickups, objectives). */
  notice: string;
  /** Persistent line at the top (score, timer). */
  top: string;
  needsLock: boolean;
}

const HEART =
  '<svg class="heart" viewBox="0 0 32 30" aria-hidden="true"><path d="M16 27.5 4.6 16.4C1 12.9 1.4 7.1 5.6 4.6c3.2-1.9 7.2-1 9.4 1.9l1 1.3 1-1.3c2.2-2.9 6.2-3.8 9.4-1.9 4.2 2.5 4.6 8.3 1 11.8Z" fill="#e9453a" stroke="#1f2a44" stroke-width="3" stroke-linejoin="round"/><path d="M8 9.5c.6-1.6 2-2.5 3.6-2.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></svg>';

/** Item that grants each timed power, for its HUD colour and label. */
const POWER_ITEMS: Record<string, string> = { speed: 'power_speed', shield: 'power_shield', damage: 'power_damage', jump: 'power_jump', tiny: 'power_shrink' };

/** One chip per running power-up: its colour, short name and whole seconds left. */
function powerChips(world: World, p: Player): string {
  let out = '';
  for (const [k, t] of Object.entries(p.power)) {
    if (t <= 0) continue;
    const item = world.data.items[POWER_ITEMS[k] ?? ''];
    const label = k === 'tiny' ? 'Tiny!' : (item?.short ?? k);
    out += `<span class="power${k === 'tiny' ? ' bad' : ''}" style="--c:${item?.color ?? '#fff'}">${esc(label)} <b>${Math.ceil(t)}</b></span>`;
  }
  return out;
}

/** One absolutely positioned DOM layer per player view. */
export class PlayerHud {
  readonly root = el('div', 'hud');
  private crosshair = el('div', 'crosshair');
  private scope = el('div', 'scope');
  private lockHint = el('div', 'lock-hint chip', 'Click to play');
  private center = el('div', 'center-msg outlined');
  private notice = el('div', 'notice chip');
  private top = el('div', 'hud-top');
  private hurt = el('div', 'hurt');
  private shield = el('div', 'shield-tint');
  private powers = el('div', 'hud-powers');
  private health = el('div', 'hud-health chip');
  private ammo = el('div', 'hud-ammo chip');
  private objectives = el('div', 'hud-objectives chip');
  private prompt = el('div', 'prompt chip');
  private last = '';

  constructor(parent: HTMLElement) {
    this.root.append(this.hurt, this.shield, this.powers, this.scope, this.crosshair, this.top, this.objectives, this.notice, this.center, this.prompt, this.health, this.ammo, this.lockHint);
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
    const scoped = p.alive && (def?.zoom ?? 1) > 1 && p.zoom > 0.35;
    this.scope.classList.toggle('on', scoped);
    this.crosshair.style.display = p.alive && !scoped ? 'block' : 'none';
    this.lockHint.style.display = x.needsLock ? 'block' : 'none';
    const left = p.power.shield;
    this.shield.classList.toggle('on', p.alive && left > 0 && (left > 1.5 || Math.floor(left * 8) % 2 === 0));
    const reloading = p.weapon.reloadTimer > 0;
    const powers = p.alive ? powerChips(world, p) : '';
    // Only touch the DOM when something visible changed.
    const key = [
      Math.ceil(p.hp),
      Math.ceil(p.armor),
      p.weapon.id,
      p.weapon.mag,
      def ? p.ammo[def.ammo] ?? 0 : 0,
      p.switchTimer > 0,
      reloading,
      p.alive,
      Math.ceil(p.deadTimer),
      p.protect > 0,
      x.notice,
      x.top,
      x.objectives,
      x.prompt,
      world.level.mode,
      powers,
    ].join('|');
    if (key === this.last) return;
    this.last = key;
    const hpPct = Math.max(0, Math.min(100, p.hp));
    const armPct = Math.max(0, Math.min(100, p.armor));
    this.health.innerHTML = `${HEART}<span class="num">${Math.max(0, Math.ceil(p.hp))}</span>
      <span class="bars"><span class="bar"><span class="fill hp${hpPct <= 30 ? ' low' : ''}" style="display:block;width:${hpPct}%"></span></span>
      ${p.armor > 0 ? `<span class="bar armor"><span class="fill armor" style="display:block;width:${armPct}%"></span></span>` : ''}</span>`;
    const pool = def ? p.ammo[def.ammo] ?? 0 : 0;
    const rounds = !def ? '' : def.type === 'thrown' ? `<b>${pool}</b>` : `<b>${p.weapon.mag}</b> / ${pool}`;
    const status = !def || p.switchTimer > 0 || def.type === 'thrown' ? '' : reloading ? 'Reloading…' : p.weapon.mag === 0 ? 'Empty!' : '';
    this.ammo.innerHTML = def
      ? `<div class="wname">${esc(def.name)}</div><div class="rounds">${rounds}</div>${status ? `<div class="reloading${reloading ? '' : ' empty'}">${status}</div>` : ''}`
      : '';
    if (!p.alive) {
      this.center.innerHTML =
        world.level.mode === 'mission' ? 'Knocked out!' : `Knocked out!<small>back in ${Math.max(0, Math.ceil(p.deadTimer))}</small>`;
    } else {
      this.center.innerHTML = p.protect > 0 ? '<small>Spawn shield</small>' : '';
    }
    this.powers.innerHTML = powers;
    this.notice.innerHTML = x.notice;
    this.top.innerHTML = x.top;
    this.objectives.innerHTML = x.objectives;
    this.objectives.classList.toggle('show', !!x.objectives);
    // A leading "[E]" becomes a key cap.
    this.prompt.innerHTML = p.alive ? esc(x.prompt).replace(/^\[(\w+)\]\s*/, '<kbd>$1</kbd>') : '';
    this.prompt.classList.toggle('locked', x.promptLocked);
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
