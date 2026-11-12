import { installDebugHooks } from './game/debug';
import { Game } from './game/game';
import { readParams } from './game/params';
import { ModelLibrary } from './render/models';

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
  if (game.params.art === 'kenney') {
    // Art trial: load every model the data refers to before the first level starts.
    const lib = new ModelLibrary(`${import.meta.env.BASE_URL}assets/`);
    const paths = Object.values(game.data.props).flatMap((k) => (k.model ? [k.model] : []));
    await lib.load([...paths, 'kenney/characters/character-soldier.glb']);
    game.renderer.models = lib;
  }
  if (game.params.debug) installDebugHooks(game);
  game.start();
}

boot().catch(fail);
