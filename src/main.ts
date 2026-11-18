import { installDebugHooks } from './game/debug';
import { Game } from './game/game';
import { readParams } from './game/params';
import { ModelLibrary } from './render/models';
import { useTextureStyle } from './render/textures';
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
  // Tin Fox's own art (Kenney fills in where it has no model yet); ?art=none shows the code-built figures and shapes.
  const art = game.params.art === 'none' ? 'none' : 'tinfox';
  game.params.art = art;
  if (art in PROFILES) {
    // Load every model the data refers to before the first level starts.
    useTextureStyle(PROFILES[art]!.textures ?? 'detailed');
    const lib = new ModelLibrary(`${import.meta.env.BASE_URL}assets/`);
    const paths = [...Object.values(game.data.props), ...Object.values(game.data.items), ...Object.values(game.data.weapons)].flatMap((k) => (k.model ? [k.model] : []));
    await lib.load([...new Set([...paths, ...profileModels(art)])]);
    game.renderer.models = lib;
    game.renderer.art = art;
  }
  if (game.params.debug) installDebugHooks(game);
  game.start();
}

boot().catch(fail);
