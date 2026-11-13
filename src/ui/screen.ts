import { el } from './dom';

export interface ScreenItem {
  label: string;
  action: () => void;
  hint?: string;
  /** Left/right adjustment for settings rows. */
  adjust?: (dir: -1 | 1) => void;
}

export interface ScreenSpec {
  title: string;
  subtitle?: string;
  /** Trusted HTML built by the game (escape any data before passing it in). */
  body?: string;
  items: ScreenItem[];
  footer?: string;
  /** Darken the game behind instead of a full backdrop. */
  overlay?: boolean;
  wide?: boolean;
  /** Clicks inside the body (outside the menu items), e.g. on an inline control. */
  onBodyClick?: (target: HTMLElement) => void;
}

/** One full-screen menu panel; keyboard, gamepad and mouse all drive the same selection. */
export class ScreenView {
  readonly root = el('div', 'screen');
  private spec: ScreenSpec | null = null;
  private selected = 0;
  onMove: () => void = () => undefined;

  constructor(parent: HTMLElement) {
    parent.appendChild(this.root);
    this.root.style.display = 'none';
    this.root.addEventListener('mousemove', (e) => {
      const li = (e.target as HTMLElement).closest('li[data-i]');
      if (li) this.select(Number((li as HTMLElement).dataset.i));
    });
    this.root.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest('li[data-i]');
      if (li) {
        this.select(Number((li as HTMLElement).dataset.i));
        // The ◂ ▸ arrows on a settings row step it down or up; anywhere else activates the row.
        const arrow = (e.target as HTMLElement).closest<HTMLElement>('[data-dir]');
        const it = this.spec?.items[this.selected];
        if (arrow && it?.adjust) this.adjust(Number(arrow.dataset.dir) < 0 ? -1 : 1);
        else this.activate();
        return;
      }
      const body = (e.target as HTMLElement).closest('.body');
      if (body) this.spec?.onBodyClick?.(e.target as HTMLElement);
    });
  }

  get visible(): boolean {
    return this.spec !== null;
  }

  show(spec: ScreenSpec): void {
    this.spec = spec;
    this.selected = 0;
    this.root.className = `screen${spec.overlay ? ' overlay' : ''}`;
    this.root.style.display = '';
    this.render();
  }

  hide(): void {
    this.spec = null;
    this.root.style.display = 'none';
  }

  move(d: number): void {
    if (!this.spec || !this.spec.items.length) return;
    const n = this.spec.items.length;
    this.select((this.selected + d + n) % n);
    this.onMove();
  }

  adjust(dir: -1 | 1): void {
    const it = this.spec?.items[this.selected];
    if (it?.adjust) {
      it.adjust(dir);
      this.render();
    }
  }

  /** Re-render after item labels changed. */
  refresh(spec: ScreenSpec): void {
    this.spec = spec;
    this.render();
  }

  activate(): void {
    this.spec?.items[this.selected]?.action();
  }

  private select(i: number): void {
    if (i === this.selected) return;
    this.selected = i;
    this.render();
  }

  private render(): void {
    const s = this.spec;
    if (!s) return;
    const items = s.items
      .map((it, i) => `<li data-i="${i}" class="${i === this.selected ? 'sel' : ''}">${it.label}${it.hint ? `<small>${it.hint}</small>` : ''}</li>`)
      .join('');
    this.root.innerHTML = `
      <div class="panel${s.wide ? ' wide' : ''}">
        <h1>${s.title}</h1>
        ${s.subtitle ? `<h2>${s.subtitle}</h2>` : ''}
        ${s.body ? `<div class="body">${s.body}</div>` : ''}
        ${items ? `<ul class="menu${s.items.length > 6 ? ' dense' : ''}">${items}</ul>` : ''}
        ${s.footer ? `<p class="hint">${s.footer}</p>` : ''}
      </div>`;
  }
}
