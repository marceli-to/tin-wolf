import { el, esc } from './dom';

export interface LobbySlot {
  label: string | null;
}

/** "Press to join" screen. Purely presentational; the game decides who joins. */
export class LobbyView {
  readonly root = el('div', 'screen lobby');

  /** Called by the Back button. */
  onBack: () => void = () => {};

  constructor(parent: HTMLElement) {
    parent.appendChild(this.root);
    // Any click in the lobby joins keyboard + mouse, so the Back button acts on mousedown and keeps
    // the click from reaching the window listeners.
    this.root.addEventListener('mousedown', (e) => {
      if (!(e.target as HTMLElement).closest('[data-back]')) return;
      e.stopPropagation();
      e.preventDefault();
      this.onBack();
    });
  }

  render(title: string, slots: LobbySlot[], hint: string): void {
    const last = slots.reduce((n, s, i) => (s.label ? i : n), -1);
    const rows = slots
      .map(
        (s, i) => `<li class="${s.label ? 'joined' : ''}"><span class="slot">P${i + 1}</span>${
          s.label ? esc(s.label) : '<span class="blink">press to join</span>'
        }</li>`,
      )
      .join('');
    this.root.innerHTML = `
      <div class="panel">
        <h1>TIN FOX</h1>
        <h2>${esc(title)}</h2>
        <ul class="slots">${rows}</ul>
        <ul class="menu"><li data-back>${last >= 0 ? `Remove P${last + 1}` : 'Back'}</li></ul>
        <p class="hint">${hint}</p>
      </div>`;
  }

  show(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
