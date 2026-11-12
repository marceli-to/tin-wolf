import { DT } from '../config';
import { EventBus } from '../core/events';
import { emptyIntent, type PlayerIntent } from '../core/intent';
import { startLoop, type RunningLoop } from './loop';
import { loadGameData, loadLevel, type GameData } from '../data';
import { deviceLabel, InputManager, type DeviceId } from '../input/manager';
import { GameRenderer, type ViewLook } from '../render/gameRenderer';
import type { SimEventMap } from '../sim/events';
import { stepWorld } from '../sim/step';
import { createWorld, type World } from '../sim/world';
import { DebugOverlay, PlayerHud } from '../ui/hud';
import { Sfx } from '../audio/sfx';
import { playSimEvent } from './audioBridge';
import type { SimEvent } from '../sim/events';
import { LobbyView } from '../ui/lobby';
import type { GameParams } from './params';

export type GameState = 'lobby' | 'playing' | 'paused';

/** Owns the loop and wires input → sim → render/ui/audio. */
export class Game {
  readonly data: GameData;
  readonly bus = new EventBus<SimEventMap>();
  readonly input: InputManager;
  readonly renderer: GameRenderer;
  state: GameState = 'lobby';
  world: World | null = null;
  levelId: string;
  playerCount: number;
  /** Debug overrides per slot; when set they replace device input. */
  debugIntents: (PlayerIntent | null)[] = [];
  /** When true the loop renders but does not tick; drive the sim with `step(n)`. */
  frozen = false;
  readonly sfx = new Sfx();
  private huds: PlayerHud[] = [];
  /** Per-slot transient notices ("You hit P2", objective done) with expiry time. */
  private notices: { text: string; until: number }[] = [];
  private clock = 0;
  private lobby: LobbyView;
  private debugOverlay: DebugOverlay | null = null;
  private loop: RunningLoop | null = null;
  private uiLayer: HTMLElement;

  constructor(
    private app: HTMLElement,
    readonly params: GameParams,
  ) {
    this.data = loadGameData();
    this.levelId = params.level ?? 'test_room';
    this.playerCount = params.players || 2;
    this.renderer = new GameRenderer(app);
    this.uiLayer = document.createElement('div');
    this.uiLayer.className = 'ui-layer';
    app.appendChild(this.uiLayer);
    this.input = new InputManager(this.renderer.canvas);
    this.lobby = new LobbyView(this.uiLayer);
    if (params.debug) this.debugOverlay = new DebugOverlay(this.uiLayer);
    window.addEventListener('resize', () => this.onResize());
    // Audio can only start after a user gesture.
    const unlock = (): void => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.renderer.canvas.addEventListener('click', () => this.onCanvasClick());
  }

  start(): void {
    this.enterLobby();
    this.loop = startLoop(DT, {
      frameStart: () => this.frameStart(),
      tick: () => this.tick(),
      render: (alpha, ft) => this.render(alpha, ft),
    });
  }

  stop(): void {
    this.loop?.stop();
  }

  // ---- states ------------------------------------------------------------

  enterLobby(): void {
    this.state = 'lobby';
    this.input.slots = new Array(this.playerCount).fill(null);
    this.lobby.show(true);
    if (this.params.autostart) {
      this.input.slots[0] = { kind: 'kbm' };
      for (let s = 1; s < this.playerCount; s++) this.input.slots[s] = { kind: 'pad', index: s - 1 };
      this.startLevel();
      return;
    }
    this.renderLobby();
  }

  private renderLobby(): void {
    const name = (() => {
      try {
        return loadLevel(this.levelId).name;
      } catch {
        return this.levelId;
      }
    })();
    this.lobby.render(
      `${name} — ${this.playerCount} player${this.playerCount > 1 ? 's' : ''}`,
      this.input.slots.map((d) => ({ label: d ? deviceLabel(d) : null })),
      this.playerCount > 1
        ? 'Keyboard + mouse: click or press any key.<br>Gamepad: press A / Cross.<br>Only one mouse can be captured, so the second player needs a gamepad.'
        : 'Click or press any key to start with keyboard + mouse, or press A on a gamepad.',
    );
  }

  private join(dev: DeviceId): void {
    const free = this.input.slots.indexOf(null);
    if (free < 0) return;
    this.input.slots[free] = dev;
    if (dev.kind === 'kbm') this.input.kbm.requestLock();
    if (this.input.slots.every((s) => s)) this.startLevel();
    else this.renderLobby();
  }

  startLevel(): void {
    const level = loadLevel(this.levelId);
    this.world = createWorld(level, this.data, { players: this.playerCount, seed: this.params.seed });
    this.renderer.load(this.world, this.params.debug);
    this.huds.forEach((h) => h.dispose());
    this.huds = this.world.players.map(() => new PlayerHud(this.uiLayer));
    this.debugIntents = [];
    this.input.resetToggles();
    this.lobby.show(false);
    this.state = 'playing';
    this.onResize();
  }

  // ---- loop --------------------------------------------------------------

  private frameStart(): void {
    this.input.poll();
    if (this.state === 'lobby') {
      const dev = this.input.pollJoin();
      if (dev) this.join(dev);
    }
  }

  private tick(): void {
    if (this.state !== 'playing' || this.frozen || !this.world) return;
    this.simStep();
  }

  /** One sim tick with current intents; also used by the debug `step` hook. */
  simStep(): void {
    const world = this.world;
    if (!world) return;
    const intents = world.players.map((p) => {
      const dbg = this.debugIntents[p.slot];
      if (dbg) {
        const copy = { ...dbg };
        // Look deltas are one-shot so a debug intent does not spin the camera forever.
        dbg.lookYaw = 0;
        dbg.lookPitch = 0;
        return copy;
      }
      return this.input.sample(p.slot, DT);
    });
    stepWorld(world, intents);
    for (const e of world.events) {
      this.bus.emit(e.type, e as never);
      this.renderer.onSimEvent(e);
      playSimEvent(this.sfx, world, e);
      this.noticeFor(e);
    }
  }

  notify(slot: number, text: string, seconds = 2.5): void {
    this.notices[slot] = { text, until: this.clock + seconds };
  }

  private noticeFor(e: SimEvent): void {
    if (e.type === 'died' && e.target.kind === 'player') {
      const victim = e.target.slot;
      const k = e.killer;
      if (k?.kind === 'player' && k.slot !== victim) {
        this.notify(k.slot, `You took down P${victim + 1}`);
        this.notify(victim, `P${k.slot + 1} got you`);
      }
    }
  }

  private render(alpha: number, frameTime: number): void {
    const world = this.world;
    if (world && this.state !== 'lobby') {
      const looks: ViewLook[] = world.players.map((p) =>
        this.debugIntents[p.slot] || this.state !== 'playing' ? { yaw: 0, pitch: 0 } : this.input.pendingLook(p.slot),
      );
      this.renderer.render(world, this.frozen ? 1 : alpha, looks, frameTime);
      this.clock += frameTime;
      this.huds.forEach((h, i) => {
        const p = world.players[i];
        if (!p) return;
        const needsLock = this.state === 'playing' && this.input.slotUsesMouse(i) && !this.input.kbm.locked && !this.debugIntents[i];
        const n = this.notices[i];
        h.update(world, p, { notice: n && n.until > this.clock ? n.text : '', top: this.hudTop(i), needsLock });
      });
      if (this.debugOverlay) {
        const p = world.players[0];
        this.debugOverlay.frame(
          frameTime,
          p ? `tick ${world.tick}  p0 ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}  yaw ${((p.yaw * 180) / Math.PI).toFixed(0)}` : '',
        );
      }
    } else if (this.debugOverlay) {
      this.debugOverlay.frame(frameTime, this.state);
    }
    this.input.endFrame();
  }

  /** Top-of-view line; versus adds score and timer in M3. */
  protected hudTop(_slot: number): string {
    return '';
  }

  private onResize(): void {
    this.renderer.resize();
    const rects = this.renderer.viewRects();
    this.huds.forEach((h, i) => {
      const r = rects[i];
      if (r) h.place(r);
    });
  }

  private onCanvasClick(): void {
    if (this.state === 'playing' && this.input.isAssigned({ kind: 'kbm' })) this.input.kbm.requestLock();
  }

  setDebugIntent(slot: number, intent: Partial<PlayerIntent> | null): void {
    this.debugIntents[slot] = intent ? { ...emptyIntent(), ...intent } : null;
  }
}
