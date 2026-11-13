// Injected into the page: helpers to drive players in real time through window.__game.
(() => {
  const G = () => window.__game;
  const W = () => G().world;
  const P = (s) => W().players[s];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wrap = (d) => ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const yawTo = (p, x, z) => Math.atan2(x - p.x, -(z - p.z));
  const pitchTo = (p, x, y, z) => Math.atan2(y - (p.y + 1.6), Math.hypot(x - p.x, z - p.z));
  const intents = {};
  const set = (s, i) => {
    intents[s] = i;
    G().setIntent(s, i);
  };
  const D = {
    sleep,
    frame,
    clean() {
      const r = G().game.renderer;
      if (r.debugGroup) r.debugGroup.visible = false;
      const st = document.createElement('style');
      st.textContent = '.debug-overlay,.lock-hint{display:none!important}';
      document.head.appendChild(st);
    },
    hideDebugAgain() {
      const r = G().game.renderer;
      if (r.debugGroup) r.debugGroup.visible = false;
    },
    idle(s) {
      set(s, {});
    },
    tp(s, x, y, z, yawDeg = 0, pitchDeg = 0) {
      G().teleport(s, x, z, yawDeg, pitchDeg);
      const p = P(s);
      p.y = p.prev.y = y;
      p.protect = 0;
      set(s, {});
    },
    async look(s, x, y, z, secs = 0.6) {
      const p = P(s);
      const y0 = p.yaw;
      const p0 = p.pitch;
      const t0 = performance.now();
      for (;;) {
        const t = Math.min(1, (performance.now() - t0) / (secs * 1000));
        const e = t * t * (3 - 2 * t);
        p.yaw = y0 + wrap(yawTo(p, x, z) - y0) * e;
        p.pitch = p0 + (pitchTo(p, x, y, z) - p0) * e;
        if (t >= 1) break;
        await frame();
      }
    },
    /** Keep looking at a moving point (fn returns [x,y,z]) for secs while holding an intent. */
    async track(s, fn, secs, intent = {}) {
      const p = P(s);
      const t0 = performance.now();
      set(s, intent);
      while (performance.now() - t0 < secs * 1000) {
        const [x, y, z] = fn();
        p.yaw += wrap(yawTo(p, x, z) - p.yaw) * 0.25;
        p.pitch += (pitchTo(p, x, y, z) - p.pitch) * 0.25;
        await frame();
      }
    },
    async walk(s, x, z, opts = {}) {
      const p = P(s);
      const t0 = performance.now();
      while (Math.hypot(p.x - x, p.z - z) > (opts.near ?? 0.6) && performance.now() - t0 < (opts.timeout ?? 15000)) {
        p.yaw += wrap(yawTo(p, x, z) - p.yaw) * (opts.turn ?? 0.12);
        if (opts.pitch !== undefined) p.pitch += (opts.pitch - p.pitch) * 0.1;
        set(s, { moveZ: 1, sprint: !!opts.sprint, crouch: !!opts.crouch });
        await frame();
      }
      set(s, {});
    },
    async hold(s, intent, secs) {
      set(s, intent);
      await sleep(secs * 1000);
      set(s, {});
    },
    async tap(s, intent, frames = 3) {
      set(s, intent);
      for (let i = 0; i < frames; i++) await frame();
      set(s, {});
      for (let i = 0; i < 2; i++) await frame();
    },
    /** Fire `n` shots, re-aiming at fn() before each; holding `aim` if scoped. */
    async shoot(s, fn, n = 1, opts = {}) {
      const p = P(s);
      for (let k = 0; k < n; k++) {
        const t0 = performance.now();
        while (performance.now() - t0 < (opts.settle ?? 250)) {
          const [x, y, z] = fn();
          p.yaw += wrap(yawTo(p, x, z) - p.yaw) * 0.35;
          p.pitch += (pitchTo(p, x, y, z) - p.pitch) * 0.35;
          set(s, { aim: !!opts.aim });
          await frame();
        }
        const [x, y, z] = fn();
        p.yaw = yawTo(p, x, z);
        p.pitch = pitchTo(p, x, y, z);
        set(s, { aim: !!opts.aim, fire: true });
        await frame();
        await frame();
        set(s, { aim: !!opts.aim });
        await sleep(opts.gap ?? 120);
      }
    },
    P,
    W,
  };
  window.D = D;
})();
