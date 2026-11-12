import { installDebugHooks } from './game/debug';
import { Game } from './game/game';
import { readParams } from './game/params';

const app = document.getElementById('app')!;
try {
  const game = new Game(app, readParams(location.search));
  if (game.params.debug) installDebugHooks(game);
  game.start();
} catch (err) {
  const box = document.createElement('div');
  box.className = 'error-box';
  box.textContent = err instanceof Error ? err.message : String(err);
  app.appendChild(box);
  throw err;
}
