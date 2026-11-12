import { el, esc } from './dom';

export interface LobbySlot {
  label: string | null;
}

/** "Press to join" screen. Purely presentational; the game decides who joins. */
export class LobbyView {
  readonly root = el('div', 'screen lobby');

  constructor(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  render(title: string, slots: LobbySlot[], hint: string): void {
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
