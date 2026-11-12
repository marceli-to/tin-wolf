/** Keyboard + mouse state. Mouse movement is only collected while the pointer is locked. */
export class KeyboardMouse {
  private keys = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private buttons = new Set<number>();
  private clickedThisFrame = false;
  mouseDX = 0;
  mouseDY = 0;
  /** Wheel notches since last consumed (+ = down / next). */
  private wheel = 0;
  /** Any key or click since the last `endFrame`, for lobby joins. */
  anyInput = false;

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('wheel', this.onWheel);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.target;
  }

  requestLock(): void {
    if (this.locked) return;
    // Some browsers return a promise that rejects when the request is too soon after an exit.
    const r = this.target.requestPointerLock() as unknown;
    if (r instanceof Promise) r.catch(() => undefined);
  }

  exitLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  pressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  mouseDown(button: number): boolean {
    return this.buttons.has(button);
  }

  get clicked(): boolean {
    return this.clickedThisFrame;
  }

  consumeMouse(): { dx: number; dy: number } {
    const r = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return r;
  }

  /** -1, 0 or 1: one weapon step per call while notches remain. */
  consumeWheel(): number {
    if (this.wheel === 0) return 0;
    const d = Math.sign(this.wheel);
    this.wheel -= d;
    return d;
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.clickedThisFrame = false;
    this.anyInput = false;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) this.pressedThisFrame.add(e.code);
    this.keys.add(e.code);
    this.anyInput = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.buttons.add(e.button);
    this.clickedThisFrame = true;
    this.anyInput = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.buttons.delete(e.button);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.locked || e.deltaY === 0) return;
    // Cap queued notches so a fast spin does not cycle for seconds.
    this.wheel = Math.max(-2, Math.min(2, this.wheel + Math.sign(e.deltaY)));
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.buttons.clear();
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
