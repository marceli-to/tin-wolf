import { Sfx } from '../audio/sfx';
import { DT } from '../config';
import { EventBus } from '../core/events';
import { emptyIntent, type PlayerIntent } from '../core/intent';
import { loadGameData, loadLevel, type GameData } from '../data';
import { DataError } from '../data/load';
import type { LevelDef } from '../data/schema';
import { deviceLabel, InputManager, type DeviceId } from '../input/manager';
import { GameRenderer, type ViewLook } from '../render/gameRenderer';
import { interactTarget } from '../sim/doors';
import type { SimEvent, SimEventMap } from '../sim/events';
import { stepWorld } from '../sim/step';
import { validateLevel } from '../sim/validate';
import { createWorld, type World } from '../sim/world';
import { esc } from '../ui/dom';
import { DebugOverlay, PlayerHud } from '../ui/hud';
import { LobbyView } from '../ui/lobby';
import { ScreenView } from '../ui/screen';
import { playSimEvent } from './audioBridge';
import { startLoop, type RunningLoop } from './loop';
import { loadSettings, RESOLUTIONS, saveSettings, type Settings } from './settings';
import { DEFAULT_INPUT_SETTINGS } from '../input/settings';
import type { GameParams } from './params';

export type GameState = 'menu' | 'lobby' | 'briefing' | 'playing' | 'paused' | 'results' | 'debrief';

const MISSION_LEVEL = 'depot';
const VERSUS_LEVEL = 'arena_pumphouse';
/** Seconds between the mission ending and the debrief, so the moment can land. */
const DEBRIEF_DELAY = 1.8;

/** Owns the loop and wires input → sim → render/ui/audio. */
export class Game {
  readonly data: GameData;
  readonly bus = new EventBus<SimEventMap>();
  readonly input: InputManager;
  readonly renderer: GameRenderer;
  readonly sfx = new Sfx();
  state: GameState = 'menu';
  world: World | null = null;
  levelId = VERSUS_LEVEL;
  playerCount = 2;
  /** Debug overrides per slot; when set they replace device input. */
  debugIntents: (PlayerIntent | null)[] = [];
  /** When true the loop renders but does not tick; drive the sim with `step(n)`. */
  frozen = false;
  private huds: PlayerHud[] = [];
  private notices: { text: string; until: number }[] = [];
  private objectivesUntil: number[] = [];
  private clock = 0;
  private endTimer = 0;
  private lobby: LobbyView;
  private screen: ScreenView;
  private debugOverlay: DebugOverlay | null = null;
  private loop: RunningLoop | null = null;
  private uiLayer: HTMLElement;
  settings: Settings = loadSettings();

  constructor(
    private app: HTMLElement,
    readonly params: GameParams,
  ) {
    this.data = loadGameData();
    this.renderer = new GameRenderer(app);
    this.uiLayer = document.createElement('div');
    this.uiLayer.className = 'ui-layer';
    app.appendChild(this.uiLayer);
    this.input = new InputManager(this.renderer.canvas);
    this.lobby = new LobbyView(this.uiLayer);
    this.lobby.show(false);
    this.screen = new ScreenView(this.uiLayer);
    this.screen.onMove = () => this.sfx.play('ui_move', 0.4);
    if (params.debug) this.debugOverlay = new DebugOverlay(this.uiLayer);
    window.addEventListener('resize', () => this.onResize());
    // Audio can only start after a user gesture.
    const unlock = (): void => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.renderer.canvas.addEventListener('click', () => this.onCanvasClick());
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    this.applySettings();
  }

  private applySettings(): void {
    const s = this.settings;
    this.input.settings = {
      mouseSens: DEFAULT_INPUT_SETTINGS.mouseSens * s.mouseSens,
      padSens: s.padSens,
      invertY: s.invertY,
    };
    this.sfx.setVolume(s.volume);
    this.renderer.split = s.split;
    this.renderer.internalHeight = s.resolution;
    this.onResize();
  }

  private settingsSpec(back: () => void): import('../ui/screen').ScreenSpec {
    const s = this.settings;
    const change = (fn: () => void): void => {
      fn();
      saveSettings(s);
      this.applySettings();
      this.screen.refresh(this.settingsSpec(back));
    };
    const step = (v: number, d: number, min: number, max: number): number => Math.round(Math.min(max, Math.max(min, v + d)) * 10) / 10;
    const resLabel = (r: number): string => (r ? `Retro ${r}p` : 'Smooth');
    const cycleRes = (d: number): void => {
      const i = RESOLUTIONS.indexOf(s.resolution);
      s.resolution = RESOLUTIONS[(i + d + RESOLUTIONS.length) % RESOLUTIONS.length]!;
    };
    const row = (name: string, value: string): string => `${name}<small>◂ ${value} ▸</small>`;
    return {
      title: 'SETTINGS',
      overlay: this.state === 'paused',
      items: [
        { label: row('Mouse sensitivity', s.mouseSens.toFixed(1)), action: () => undefined, adjust: (d) => change(() => (s.mouseSens = step(s.mouseSens, d * 0.1, 0.2, 4))) },
        { label: row('Gamepad sensitivity', s.padSens.toFixed(1)), action: () => undefined, adjust: (d) => change(() => (s.padSens = step(s.padSens, d * 0.1, 0.2, 4))) },
        { label: row('Invert look', s.invertY ? 'On' : 'Off'), action: () => change(() => (s.invertY = !s.invertY)), adjust: () => change(() => (s.invertY = !s.invertY)) },
        {
          label: row('Split screen', s.split === 'vertical' ? 'Side by side' : 'Top and bottom'),
          action: () => change(() => (s.split = s.split === 'vertical' ? 'horizontal' : 'vertical')),
          adjust: () => change(() => (s.split = s.split === 'vertical' ? 'horizontal' : 'vertical')),
        },
        { label: row('Volume', `${Math.round(s.volume * 100)}%`), action: () => undefined, adjust: (d) => change(() => (s.volume = step(s.volume, d * 0.1, 0, 1))) },
        { label: row('Graphics', resLabel(s.resolution)), action: () => change(() => cycleRes(1)), adjust: (d) => change(() => cycleRes(d)) },
        { label: 'Back', action: back },
      ],
      footer: 'Left / right to change',
    };
  }

  start(): void {
    const p = this.params;
    if (p.level) {
      const level = this.tryLoad(p.level);
      if (!level) return;
      this.levelId = p.level;
      if (level.mode === 'mission') this.enterBriefing();
      else this.enterLobby(p.players || (level.mode === 'versus' ? 2 : 1));
    } else this.enterMenu();
    this.loop = startLoop(DT, {
      frameStart: () => this.frameStart(),
      tick: () => this.tick(),
      render: (alpha, ft) => this.render(alpha, ft),
    });
  }

  stop(): void {
    this.loop?.stop();
  }

  private tryLoad(id: string): LevelDef | null {
    try {
      const level = loadLevel(id);
      const problems = validateLevel(level);
      if (problems.length) throw new DataError(`Level ${level.id} failed validation:\n  ${problems.join('\n  ')}`);
      return level;
    } catch (err) {
      this.showError(err);
      return null;
    }
  }

  private showError(err: unknown): void {
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = err instanceof Error ? err.message : String(err);
    this.app.appendChild(box);
    console.error(err);
  }

  // ---- states ------------------------------------------------------------

  enterMenu(): void {
    this.state = 'menu';
    this.world = null;
    this.clearHuds();
    this.renderer.clear();
    this.lobby.show(false);
    this.input.kbm.exitLock();
    const depot = this.tryLoad(MISSION_LEVEL);
    this.screen.show({
      title: 'TIN WOLF',
      body: '<p class="title-art">a field agent · a snowed-in depot · a pistol</p>',
      items: [
        {
          label: 'Mission',
          hint: depot ? esc(depot.name) : '',
          action: () => {
            this.levelId = MISSION_LEVEL;
            this.enterBriefing();
          },
        },
        {
          label: 'Versus',
          hint: 'Two players, split-screen',
          action: () => {
            this.levelId = VERSUS_LEVEL;
            this.enterLobby(2);
          },
        },
        { label: 'Settings', action: () => this.screen.show(this.settingsSpec(() => this.enterMenu())) },
        { label: 'Controls', action: () => this.showControls() },
      ],
      footer: 'Arrows / W S / D-pad to choose · Enter / click / A to select',
    });
  }

  private showControls(): void {
    this.screen.show({
      title: 'CONTROLS',
      wide: true,
      body: `<div class="statgrid">
        <span>Move</span><span>WASD · left stick</span>
        <span>Look</span><span>Mouse · right stick</span>
        <span>Fire</span><span>Left click · RT</span>
        <span>Reload</span><span>R · X</span>
        <span>Use / open</span><span>E · A</span>
        <span>Crouch</span><span>C or Ctrl (hold) · B (toggle)</span>
        <span>Objectives</span><span>Tab · Back</span>
        <span>Pause</span><span>Esc · Start</span>
      </div>`,
      items: [{ label: 'Back', action: () => this.enterMenu() }],
    });
  }

  enterLobby(players: number): void {
    this.state = 'lobby';
    this.playerCount = players;
    this.world = null;
    this.clearHuds();
    this.renderer.clear();
    this.screen.hide();
    this.input.kbm.exitLock();
    this.input.slots = new Array(players).fill(null);
    if (this.params.autostart) {
      this.input.slots[0] = { kind: 'kbm' };
      for (let s = 1; s < players; s++) this.input.slots[s] = { kind: 'pad', index: s - 1 };
      this.startLevel();
      return;
    }
    this.lobby.show(true);
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
      (this.playerCount > 1
        ? 'Keyboard + mouse: click or press any key.<br>Gamepad: press A / Cross.<br>Only one mouse can be captured, so the second player needs a gamepad.'
        : 'Click or press any key to start with keyboard + mouse, or press A on a gamepad.') +
        '<br>Esc / B on an empty slot: back to the menu.',
    );
  }

  private join(dev: DeviceId): void {
    const free = this.input.slots.indexOf(null);
    if (free < 0) return;
    this.input.slots[free] = dev;
    this.sfx.play('ui_select', 0.5);
    if (dev.kind === 'kbm') this.input.kbm.requestLock();
    if (this.input.slots.every((s) => s)) this.startLevel();
    else this.renderLobby();
  }

  enterBriefing(): void {
    this.playerCount = 1;
    this.world = null;
    this.clearHuds();
    this.renderer.clear();
    this.lobby.show(false);
    this.input.kbm.exitLock();
    const level = this.tryLoad(this.levelId);
    if (!level) return;
    if (this.params.autostart) {
      this.input.slots = [{ kind: 'kbm' }];
      this.screen.hide();
      this.startLevel();
      return;
    }
    this.state = 'briefing';
    const paras = level.briefing
      .split(/\n\s*\n/)
      .map((p) => `<p>${esc(p)}</p>`)
      .join('');
    const objs = level.objectives.map((o) => `<li>${esc(o.text)}</li>`).join('');
    this.screen.show({
      title: 'BRIEFING',
      subtitle: esc(level.name),
      wide: true,
      body: `${paras}<h3>Objectives</h3><ul class="objlist">${objs}</ul>`,
      items: [],
      footer: 'Click, press Enter, or press A on a gamepad to begin · Esc / B: back',
    });
  }

  startLevel(): void {
    const level = this.tryLoad(this.levelId);
    if (!level) return;
    this.world = createWorld(level, this.data, { players: this.playerCount, seed: this.params.seed });
    this.renderer.load(this.world, this.params.debug);
    this.clearHuds();
    this.huds = this.world.players.map(() => new PlayerHud(this.uiLayer));
    this.notices = [];
    this.objectivesUntil = [];
    this.debugIntents = [];
    this.endTimer = 0;
    this.input.resetToggles();
    this.lobby.show(false);
    this.screen.hide();
    this.state = 'playing';
    if (this.input.isAssigned({ kind: 'kbm' })) this.input.kbm.requestLock();
    // Show the objectives briefly at the start of a mission.
    if (this.world.mission) this.objectivesUntil[0] = this.clock + 5;
    this.onResize();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.kbm.exitLock();
    const mission = !!this.world?.mission;
    this.screen.show({
      title: 'PAUSED',
      overlay: true,
      body: mission ? this.objectivesHtml() : '',
      items: [
        { label: 'Resume', action: () => this.resume() },
        { label: 'Restart', action: () => this.startLevel() },
        {
          label: 'Settings',
          action: () =>
            this.screen.show(
              this.settingsSpec(() => {
                this.state = 'playing';
                this.pause();
              }),
            ),
        },
        { label: 'Quit to menu', action: () => this.enterMenu() },
      ],
    });
  }

  private resume(): void {
    this.screen.hide();
    this.state = 'playing';
    if (this.input.isAssigned({ kind: 'kbm' })) this.input.kbm.requestLock();
  }

  private showResults(): void {
    const w = this.world;
    if (!w) return;
    this.state = 'results';
    this.input.kbm.exitLock();
    const m = w.match;
    const title = !m || m.winner === null ? 'DRAW' : `PLAYER ${m.winner + 1} WINS`;
    const rows = w.players
      .map((p) => {
        const acc = p.shotsFired ? Math.round((100 * p.shotsHit) / p.shotsFired) : 0;
        return `<tr${m?.winner === p.slot ? ' class="win"' : ''}><td>P${p.slot + 1}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${acc}%</td></tr>`;
      })
      .join('');
    this.screen.show({
      title,
      subtitle: esc(w.level.name),
      overlay: true,
      body: `<table class="stats"><thead><tr><th></th><th>Kills</th><th>Deaths</th><th>Accuracy</th></tr></thead><tbody>${rows}</tbody></table>`,
      items: [
        { label: 'Rematch', action: () => this.startLevel() },
        { label: 'Change players', action: () => this.enterLobby(this.playerCount) },
        { label: 'Menu', action: () => this.enterMenu() },
      ],
    });
  }

  private showDebrief(): void {
    const w = this.world;
    const m = w?.mission;
    if (!w || !m) return;
    this.state = 'debrief';
    this.input.kbm.exitLock();
    const p = w.players[0]!;
    const acc = p.shotsFired ? Math.round((100 * p.shotsHit) / p.shotsFired) : 0;
    const t = Math.floor(m.time);
    const time = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const guards = w.guards.length;
    const downed = w.guards.filter((g) => g.state === 'dead').length;
    this.screen.show({
      title: m.success ? 'MISSION COMPLETE' : 'MISSION FAILED',
      subtitle: esc(m.success ? w.level.name : m.reason),
      overlay: true,
      wide: true,
      body: `<div class="statgrid">
          <span>Time</span><span>${time}</span>
          <span>Shots fired</span><span>${p.shotsFired}</span>
          <span>Accuracy</span><span>${acc}%</span>
          <span>Guards down</span><span>${downed} / ${guards}</span>
        </div>${this.objectivesHtml(!m.success)}`,
      items: [
        { label: m.success ? 'Play again' : 'Retry', action: () => this.startLevel() },
        { label: 'Menu', action: () => this.enterMenu() },
      ],
    });
  }

  private objectivesHtml(markFailed = false): string {
    const m = this.world?.mission;
    if (!m) return '';
    const items = m.objectives
      .map((o) => `<li class="${o.done ? 'done' : markFailed ? 'failed' : ''}">${esc(o.def.text)}</li>`)
      .join('');
    return `<h3>Objectives</h3><ul class="objlist">${items}</ul>`;
  }

  private clearHuds(): void {
    this.huds.forEach((h) => h.dispose());
    this.huds = [];
  }

  // ---- loop --------------------------------------------------------------

  private frameStart(): void {
    this.input.poll();
    const m = this.input.menu();
    switch (this.state) {
      case 'lobby': {
        if (m.back && this.input.slots.every((s) => !s)) {
          this.enterMenu();
          break;
        }
        const dev = this.input.pollJoin();
        if (dev) this.join(dev);
        break;
      }
      case 'briefing': {
        if (m.back) {
          this.enterMenu();
          break;
        }
        const dev = this.input.confirmDevice();
        if (dev) {
          this.input.slots = [dev];
          this.sfx.play('ui_select', 0.5);
          this.startLevel();
        }
        break;
      }
      case 'menu':
      case 'paused':
      case 'results':
      case 'debrief': {
        if (m.up) this.screen.move(-1);
        if (m.down) this.screen.move(1);
        if (m.left) this.screen.adjust(-1);
        if (m.right) this.screen.adjust(1);
        if (m.confirm) {
          this.sfx.play('ui_select', 0.5);
          this.screen.activate();
        } else if (m.back || (this.state === 'paused' && m.pause)) {
          if (this.state === 'paused') this.resume();
          else if (this.state === 'results' || this.state === 'debrief') this.enterMenu();
        }
        break;
      }
      case 'playing': {
        const w = this.world;
        if (m.pause) {
          this.pause();
          break;
        }
        if (m.objectives && w?.mission) {
          const now = this.clock;
          this.objectivesUntil[0] = (this.objectivesUntil[0] ?? 0) > now ? 0 : now + 5;
        }
        if (w?.match?.over) this.showResults();
        break;
      }
    }
  }

  private tick(): void {
    if (this.state !== 'playing' || this.frozen || !this.world) return;
    this.simStep();
    const m = this.world.mission;
    if (m?.over) {
      this.endTimer += DT;
      if (this.endTimer >= DEBRIEF_DELAY) this.showDebrief();
    }
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
    const w = this.world;
    if (!w) return;
    switch (e.type) {
      case 'pickup': {
        const item = w.data.items[e.item];
        if (item) this.notify(e.slot, esc(item.name), 1.5);
        break;
      }
      case 'doorLocked': {
        const item = w.data.items[e.requires];
        this.notify(e.slot, `Locked — needs the ${esc(item?.name ?? e.requires)}`, 2);
        break;
      }
      case 'objectiveCompleted':
        w.players.forEach((p) => this.notify(p.slot, `Objective complete<br><small>${esc(e.text)}</small>`, 3.5));
        break;
      case 'missionEnded':
        w.players.forEach((p) => this.notify(p.slot, e.success ? 'MISSION COMPLETE' : '', 3));
        break;
      case 'died':
        if (e.target.kind === 'player') {
          const victim = e.target.slot;
          const k = e.killer;
          if (k?.kind === 'player' && k.slot !== victim) {
            this.notify(k.slot, `You took down P${victim + 1}`);
            this.notify(victim, `P${k.slot + 1} got you`);
          }
        }
        break;
      default:
        break;
    }
  }

  private render(alpha: number, frameTime: number): void {
    this.clock += frameTime;
    const world = this.world;
    if (world && this.state !== 'lobby' && this.state !== 'menu' && this.state !== 'briefing') {
      const looks: ViewLook[] = world.players.map((p) =>
        this.debugIntents[p.slot] || this.state !== 'playing' ? { yaw: 0, pitch: 0 } : this.input.pendingLook(p.slot),
      );
      this.renderer.render(world, this.frozen ? 1 : alpha, looks, frameTime);
      this.huds.forEach((h, i) => {
        const p = world.players[i];
        if (!p) return;
        const needsLock = this.state === 'playing' && this.input.slotUsesMouse(i) && !this.input.kbm.locked && !this.debugIntents[i];
        const n = this.notices[i];
        const showObj = !!world.mission && (this.objectivesUntil[i] ?? 0) > this.clock;
        const target = p.alive ? interactTarget(world, p) : null;
        let prompt = '';
        let locked = false;
        if (target?.kind === 'door') {
          locked = target.locked;
          const key = target.door.requires ? world.data.items[target.door.requires]?.name : null;
          prompt = locked ? `Locked — needs the ${key ?? 'key'}` : `${this.useKey(i)}  Open door`;
        } else if (target?.kind === 'prop') prompt = `${this.useKey(i)}  Use`;
        h.update(world, p, {
          notice: n && n.until > this.clock ? n.text : '',
          top: this.hudTop(i),
          needsLock,
          objectives: showObj ? this.objectivesHtml() : '',
          prompt,
          promptLocked: locked,
        });
      });
      if (this.debugOverlay) {
        const p = world.players[0];
        const guards = world.guards.map((g) => `${g.id}:${g.state} ${g.awareness.toFixed(2)}`).join('  ');
        this.debugOverlay.frame(
          frameTime,
          (p ? `tick ${world.tick}  p0 ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}  yaw ${((p.yaw * 180) / Math.PI).toFixed(0)}` : '') +
            (guards ? `\n${guards}` : ''),
        );
      }
    } else if (this.debugOverlay) {
      this.debugOverlay.frame(frameTime, this.state);
    }
    this.input.endFrame();
  }

  private useKey(slot: number): string {
    return this.input.slots[slot]?.kind === 'pad' ? '[A]' : '[E]';
  }

  /** Score and timer in versus. */
  private hudTop(slot: number): string {
    const w = this.world;
    if (!w?.match) return '';
    const scores = w.players.map((p) => `<span class="${p.slot === slot ? 'me' : ''}">P${p.slot + 1} ${p.kills}</span>`).join(' &nbsp; ');
    const t = Math.ceil(w.match.timeLeft);
    const clock = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    return `<span class="score">${scores}<span class="timer">${clock}</span></span>`;
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

  /** Losing the mouse (Esc in most browsers) pauses the game. */
  private onPointerLockChange(): void {
    if (this.input.kbm.locked || this.state !== 'playing') return;
    if (!this.input.isAssigned({ kind: 'kbm' }) || this.debugIntents.some(Boolean)) return;
    this.pause();
  }

  setDebugIntent(slot: number, intent: Partial<PlayerIntent> | null): void {
    this.debugIntents[slot] = intent ? { ...emptyIntent(), ...intent } : null;
  }
}
