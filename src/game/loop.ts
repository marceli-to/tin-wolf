import { advanceLoop, type LoopState } from '../core/loop';

export interface RunningLoop {
  stop(): void;
}

export interface LoopCallbacks {
  /** Once per animation frame, before any ticks (poll input here). */
  frameStart(frameTime: number): void;
  tick(): void;
  render(alpha: number, frameTime: number): void;
}

/** Drives `tick` at a fixed rate and `render` once per animation frame. */
export function startLoop(dt: number, cb: LoopCallbacks): RunningLoop {
  const state: LoopState = { accumulator: 0 };
  let last = performance.now();
  let handle = 0;
  let running = true;
  const frame = (now: number): void => {
    if (!running) return;
    const frameTime = (now - last) / 1000;
    last = now;
    cb.frameStart(frameTime);
    const { steps, alpha } = advanceLoop(state, frameTime, dt);
    for (let i = 0; i < steps; i++) cb.tick();
    cb.render(alpha, frameTime);
    handle = requestAnimationFrame(frame);
  };
  handle = requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
      cancelAnimationFrame(handle);
    },
  };
}
