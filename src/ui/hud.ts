import type { ViewRect } from '../render/views';
import { el } from './dom';

/** One absolutely positioned DOM layer per player view. */
export class PlayerHud {
  readonly root = el('div', 'hud');
  readonly crosshair = el('div', 'crosshair');
  readonly lockHint = el('div', 'lock-hint', 'Click to capture mouse');
  readonly center = el('div', 'center-msg');

  constructor(parent: HTMLElement) {
    this.root.append(this.crosshair, this.lockHint, this.center);
    parent.appendChild(this.root);
  }

  place(r: ViewRect): void {
    const s = this.root.style;
    s.left = `${r.x}px`;
    s.top = `${r.y}px`;
    s.width = `${r.w}px`;
    s.height = `${r.h}px`;
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
