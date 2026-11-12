import { installDebugHooks } from './game/debug';
import { Game } from './game/game';
import { readParams } from './game/params';
import { ModelLibrary } from './render/models';
import { profileModels, PROFILES } from './render/modelCharacter';

const app = document.getElementById('app')!;

function fail(err: unknown): void {
  const box = document.createElement('div');
  box.className = 'error-box';
  box.textContent = err instanceof Error ? err.message : String(err);
  app.appendChild(box);
  console.error(err);
}

async function boot(): Promise<void> {
  const game = new Game(app, readParams(location.search));
  const art = game.params.art;
  if (art in PROFILES) {
    // Art trial: load every model the data refers to before the first level starts.
    const lib = new ModelLibrary(`${import.meta.env.BASE_URL}assets/`);
    const paths = Object.values(game.data.props).flatMap((k) => (k.model ? [k.model] : []));
    await lib.load([...paths, ...profileModels(art)]);
    game.renderer.models = lib;
    game.renderer.art = art;
  }
  if (game.params.debug) installDebugHooks(game);
  game.start();
}

boot().catch(fail);
