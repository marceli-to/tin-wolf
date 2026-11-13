import { el, esc } from './dom';

export interface LobbySlot {
  /** Device label of a joined person, or null for an open slot. */
  label: string | null;
  /** A computer player. */
  bot?: boolean;
}

export interface LobbyOptions {
  /** Show "Add computer". */
  addBot: boolean;
  /** Show "Start" (with computer players the match starts on request, not when the last slot fills). */
  start: boolean;
  /** Computer skill name, shown as a pill while there are computer players. */
  skill: string | null;
}

/** "Press to join" screen. Purely presentational; the game decides who joins. */
export class LobbyView {
  readonly root = el('div', 'screen lobby');

  /** Called by the Back button. */
  onBack: () => void = () => {};
  onAddBot: () => void = () => {};
  onStart: () => void = () => {};
  onSkill: () => void = () => {};

  constructor(parent: HTMLElement) {
    parent.appendChild(this.root);
    // Any click in the lobby joins keyboard + mouse, so the buttons act on mousedown and keep the
    // click from reaching the window listeners.
    this.root.addEventListener('mousedown', (e) => {
      const t = e.target as HTMLElement;
      const action = t.closest('[data-back]') ? this.onBack : t.closest('[data-add-bot]') ? this.onAddBot : t.closest('[data-start]') ? this.onStart : t.closest('[data-skill]') ? this.onSkill : null;
      if (!action) return;
      e.stopPropagation();
      e.preventDefault();
      action();
    });
  }

  render(title: string, slots: LobbySlot[], hint: string, opts: LobbyOptions = { addBot: false, start: false, skill: null }): void {
    const any = slots.some((s) => s.label || s.bot);
    const rows = slots
      .map((s, i) => {
        const body = s.bot
          ? `<span class="bot-tag">🤖</span>Computer`
          : s.label
            ? esc(s.label)
            : '<span class="blink">press to join</span>';
        return `<li class="${s.label || s.bot ? 'joined' : ''}${s.bot ? ' bot' : ''}"><span class="slot">P${i + 1}</span>${body}</li>`;
      })
      .join('');
    const lastBot = slots.some((s) => s.bot);
    const skill = opts.skill
      ? `<p class="difficulty">Computer skill <button type="button" class="pill" data-skill title="Change how good the computer is">◂ ${esc(opts.skill)} ▸</button></p>`
      : '';
    this.root.innerHTML = `
      <div class="panel">
        <h1>TIN FOX</h1>
        <h2>${esc(title)}</h2>
        <ul class="slots">${rows}</ul>
        ${skill}
        <ul class="menu">
          ${opts.start ? '<li class="sel" data-start>Start</li>' : ''}
          ${opts.addBot ? '<li data-add-bot>Add computer</li>' : ''}
          <li data-back>${any ? (lastBot ? 'Remove computer' : 'Remove last player') : 'Back'}</li>
        </ul>
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
