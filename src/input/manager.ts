import { emptyIntent, type PlayerIntent } from '../core/intent';
import { Gamepads, PAD, shapeStick } from './gamepad';
import { KeyboardMouse } from './keyboardMouse';
import { DEFAULT_INPUT_SETTINGS, type InputSettings } from './settings';

export type DeviceId = { kind: 'kbm' } | { kind: 'pad'; index: number };

const PAD_YAW_RATE = 3.4;
const PAD_PITCH_RATE = 2.2;

export function sameDevice(a: DeviceId, b: DeviceId): boolean {
  return a.kind === b.kind && (a.kind === 'kbm' || a.index === (b as { index: number }).index);
}

export function deviceLabel(d: DeviceId): string {
  return d.kind === 'kbm' ? 'Keyboard + mouse' : `Gamepad ${d.index + 1}`;
}

/** Menu-level actions, independent of slot. */
export interface MenuInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  pause: boolean;
  objectives: boolean;
  confirm: boolean;
  back: boolean;
}

/** Maps devices to player slots and turns their state into `PlayerIntent`s. */
export class InputManager {
  readonly kbm: KeyboardMouse;
  readonly pads = new Gamepads();
  slots: (DeviceId | null)[] = [];
  settings: InputSettings = { ...DEFAULT_INPUT_SETTINGS };
  private padCrouch = new Map<number, boolean>();

  constructor(target: HTMLElement) {
    this.kbm = new KeyboardMouse(target);
  }

  /** Call once per animation frame before sampling. */
  poll(): void {
    this.pads.poll();
  }

  /** Call once per animation frame after all sampling. */
  endFrame(): void {
    this.kbm.endFrame();
  }

  /** A device that pressed a join button this frame and is not yet assigned. */
  pollJoin(): DeviceId | null {
    const kbm: DeviceId = { kind: 'kbm' };
    if (this.kbm.anyInput && !this.isAssigned(kbm)) return kbm;
    for (const index of this.pads.connected()) {
      const pad: DeviceId = { kind: 'pad', index };
      if ((this.pads.pressed(index, PAD.A) || this.pads.pressed(index, PAD.START)) && !this.isAssigned(pad)) return pad;
    }
    return null;
  }

  isAssigned(d: DeviceId): boolean {
    return this.slots.some((s) => s && sameDevice(s, d));
  }

  slotUsesMouse(slot: number): boolean {
    return this.slots[slot]?.kind === 'kbm';
  }

  /** Look offset not yet applied by the sim, so the camera can turn at render rate. */
  pendingLook(slot: number): { yaw: number; pitch: number } {
    if (!this.slotUsesMouse(slot)) return { yaw: 0, pitch: 0 };
    const s = this.settings;
    return { yaw: this.kbm.mouseDX * s.mouseSens, pitch: -this.kbm.mouseDY * s.mouseSens * (s.invertY ? -1 : 1) };
  }

  sample(slot: number, dt: number): PlayerIntent {
    const dev = this.slots[slot];
    const intent = emptyIntent();
    if (!dev) return intent;
    const s = this.settings;
    if (dev.kind === 'kbm') {
      const k = this.kbm;
      if (!k.locked) return intent;
      intent.moveZ = (k.down('KeyW') || k.down('ArrowUp') ? 1 : 0) - (k.down('KeyS') || k.down('ArrowDown') ? 1 : 0);
      intent.moveX = (k.down('KeyD') || k.down('ArrowRight') ? 1 : 0) - (k.down('KeyA') || k.down('ArrowLeft') ? 1 : 0);
      const m = k.consumeMouse();
      intent.lookYaw = m.dx * s.mouseSens;
      intent.lookPitch = -m.dy * s.mouseSens * (s.invertY ? -1 : 1);
      intent.fire = k.mouseDown(0);
      intent.reload = k.down('KeyR');
      intent.interact = k.down('KeyE') || k.down('KeyF');
      intent.crouch = k.down('KeyC') || k.down('ControlLeft') || k.down('ShiftLeft');
      return intent;
    }
    const i = dev.index;
    const p = this.pads;
    if (!p.has(i)) return intent;
    const move = shapeStick(p.axis(i, 0), p.axis(i, 1), 0.2, 1);
    intent.moveX = move.x;
    intent.moveZ = -move.y;
    const look = shapeStick(p.axis(i, 2), p.axis(i, 3), 0.15, 2);
    intent.lookYaw = look.x * PAD_YAW_RATE * s.padSens * dt;
    intent.lookPitch = -look.y * PAD_PITCH_RATE * s.padSens * dt * (s.invertY ? -1 : 1);
    intent.fire = p.down(i, PAD.RT) || p.down(i, PAD.RB);
    intent.reload = p.down(i, PAD.X);
    intent.interact = p.down(i, PAD.A);
    if (p.pressed(i, PAD.B) || p.pressed(i, PAD.LS)) this.padCrouch.set(i, !this.padCrouch.get(i));
    intent.crouch = this.padCrouch.get(i) ?? false;
    return intent;
  }

  /** Edge-triggered menu actions from any device. */
  menu(): MenuInput {
    const k = this.kbm;
    const m: MenuInput = {
      up: k.pressed('ArrowUp') || k.pressed('KeyW'),
      down: k.pressed('ArrowDown') || k.pressed('KeyS'),
      left: k.pressed('ArrowLeft') || k.pressed('KeyA'),
      right: k.pressed('ArrowRight') || k.pressed('KeyD'),
      pause: k.pressed('Escape') || k.pressed('KeyP'),
      objectives: k.pressed('Tab'),
      confirm: k.pressed('Enter') || k.pressed('Space'),
      back: k.pressed('Escape') || k.pressed('Backspace'),
    };
    for (const i of this.pads.connected()) {
      m.up ||= this.pads.pressed(i, PAD.UP) || this.stickEdge(i, -1);
      m.down ||= this.pads.pressed(i, PAD.DOWN) || this.stickEdge(i, 1);
      m.left ||= this.pads.pressed(i, PAD.LEFT);
      m.right ||= this.pads.pressed(i, PAD.RIGHT);
      m.pause ||= this.pads.pressed(i, PAD.START);
      m.objectives ||= this.pads.pressed(i, PAD.BACK);
      m.confirm ||= this.pads.pressed(i, PAD.A);
      m.back ||= this.pads.pressed(i, PAD.B);
    }
    return m;
  }

  private stickHeld = new Map<number, number>();

  /** Left stick flicked up (-1) or down (1) since it was last centred. */
  private stickEdge(i: number, dir: -1 | 1): boolean {
    const y = this.pads.axis(i, 1);
    const held = this.stickHeld.get(i) ?? 0;
    const now = y < -0.6 ? -1 : y > 0.6 ? 1 : 0;
    if (now !== held) this.stickHeld.set(i, now);
    return now === dir && held !== dir;
  }

  /** The device that pressed confirm this frame (for "press to start" screens). */
  confirmDevice(): DeviceId | null {
    const k = this.kbm;
    if (k.pressed('Enter') || k.pressed('Space') || k.clicked) return { kind: 'kbm' };
    for (const i of this.pads.connected()) if (this.pads.pressed(i, PAD.A) || this.pads.pressed(i, PAD.START)) return { kind: 'pad', index: i };
    return null;
  }

  /** Pads keep their own crouch toggle; clear it on respawn or level start. */
  resetToggles(): void {
    this.padCrouch.clear();
  }
}
