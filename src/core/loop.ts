/**
 * Fixed-timestep accumulator. Kept pure so it can be unit-tested without timers.
 * Returns how many sim steps to run this frame and the interpolation alpha for rendering.
 */
export interface LoopState {
  accumulator: number;
}

export interface LoopAdvance {
  steps: number;
  alpha: number;
}

/** Clamp long frames (tab in background, debugger) so the sim does not spiral. */
export const MAX_FRAME_TIME = 0.25;

export function advanceLoop(state: LoopState, frameTime: number, dt: number): LoopAdvance {
  state.accumulator += Math.min(Math.max(frameTime, 0), MAX_FRAME_TIME);
  let steps = 0;
  // Epsilon absorbs float drift so 0.5dt + 0.5dt reliably yields a step.
  while (state.accumulator >= dt - 1e-9) {
    state.accumulator -= dt;
    steps++;
  }
  if (state.accumulator < 0) state.accumulator = 0;
  return { steps, alpha: state.accumulator / dt };
}

export interface RunningLoop {
  stop(): void;
}

/** Drives `tick` at a fixed rate and `render` once per animation frame. */
export function startLoop(
  dt: number,
  tick: () => void,
  render: (alpha: number, frameTime: number) => void,
): RunningLoop {
  const state: LoopState = { accumulator: 0 };
  let last = performance.now();
  let handle = 0;
  let running = true;
  const frame = (now: number): void => {
    if (!running) return;
    const frameTime = (now - last) / 1000;
    last = now;
    const { steps, alpha } = advanceLoop(state, frameTime, dt);
    for (let i = 0; i < steps; i++) tick();
    render(alpha, frameTime);
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
