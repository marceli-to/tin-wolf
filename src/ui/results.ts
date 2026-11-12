import type { World } from '../sim/world';
import { el } from './dom';

/** Versus match result screen. */
export class ResultsView {
  readonly root = el('div', 'screen results');

  constructor(parent: HTMLElement) {
    parent.appendChild(this.root);
    this.show(false);
  }

  render(world: World): void {
    const m = world.match;
    const title = !m || m.winner === null ? 'DRAW' : `PLAYER ${m.winner + 1} WINS`;
    const rows = world.players
      .map((p) => {
        const acc = p.shotsFired ? Math.round((100 * p.shotsHit) / p.shotsFired) : 0;
        const win = m?.winner === p.slot ? ' class="win"' : '';
        return `<tr${win}><td>P${p.slot + 1}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${acc}%</td></tr>`;
      })
      .join('');
    this.root.innerHTML = `
      <div class="panel">
        <h1>${title}</h1>
        <h2>${world.level.name}</h2>
        <table class="stats"><thead><tr><th></th><th>Kills</th><th>Deaths</th><th>Accuracy</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="hint">Enter / A: rematch &nbsp;·&nbsp; Esc / B: back</p>
      </div>`;
  }

  show(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }
}
