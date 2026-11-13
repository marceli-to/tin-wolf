// Records scripted gameplay clips (CDP screencast frames) and screenshots of the built game.
// Usage: node record.cjs <outDir> [sceneName...]   (see README.md in this folder)
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const OUT = process.argv[2];
const ONLY = process.argv.slice(3);
const BASE = process.env.BASE || 'http://localhost:4173/play/';
const W = 1920;
const H = 1080;
const DIRECTOR = fs.readFileSync(path.join(__dirname, 'director.js'), 'utf8');

async function open(browser, query, state = 'playing') {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(DIRECTOR);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('  pageerror:', e.message));
  await pg.goto(BASE + query);
  await pg.waitForFunction((s) => window.__game && window.__game.state === s, state, { timeout: 30000 });
  await pg.evaluate(() => window.D.clean());
  await pg.waitForTimeout(1500);
  return { ctx, pg };
}

/** Starts a screencast; returns stop() which writes the frames and an ffconcat list. */
async function startClip(pg, name) {
  const dir = path.join(OUT, 'frames', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await pg.context().newCDPSession(pg);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  return async () => {
    await cdp.send('Page.stopScreencast');
    await new Promise((r) => setTimeout(r, 200));
    const lines = ['ffconcat version 1.0'];
    frames.forEach((f, i) => {
      const next = frames[i + 1];
      lines.push(`file '${f.file}'`, `duration ${next ? Math.max(0.001, next.t - f.t).toFixed(4) : '0.0333'}`);
    });
    if (frames.length) lines.push(`file '${frames[frames.length - 1].file}'`);
    fs.writeFileSync(path.join(dir, 'list.ffconcat'), lines.join('\n') + '\n');
    const span = frames.length ? frames[frames.length - 1].t - frames[0].t : 0;
    console.log(`  clip ${name}: ${frames.length} frames, ${span.toFixed(1)} s`);
  };
}

async function shot(pg, name) {
  await pg.screenshot({ path: path.join(OUT, 'shots', `${name}.png`) });
  console.log(`  shot ${name}`);
}

const ev = (pg, fn, ...args) => pg.evaluate(fn, args);

const scenes = {
  async menu(browser) {
    const { ctx, pg } = await open(browser, '?debug=1', 'menu');
    const stop = await startClip(pg, '01_menu');
    await pg.waitForTimeout(800);
    for (const label of ['Versus', 'Mission', 'Training', 'Versus']) {
      const li = pg.locator(`.menu li:has-text("${label}")`).first();
      if (await li.count()) await li.hover();
      await pg.waitForTimeout(650);
    }
    await shot(pg, '01_menu');
    await stop();
    await ctx.close();
  },

  async warehouse(browser) {
    const { ctx, pg } = await open(browser, '?level=arena_warehouse&players=2&debug=1&autostart=1&seed=3');
    await ev(pg, () => {
      D.tp(0, 50, 0, 4, 270, 0);
      D.tp(1, 22, 0, 44, 90, 0);
    });
    const stop = await startClip(pg, '02_warehouse');
    await ev(pg, async () => {
      const p2 = (async () => {
        await D.walk(1, 52, 44);
        await D.walk(1, 52, 36);
        await D.walk(1, 42, 36);
        await D.walk(1, 42, 46);
        await D.walk(1, 30, 46);
      })();
      await D.walk(0, 41, 4, { sprint: true });
      await D.walk(0, 35.2, 4.5, { sprint: true, turn: 0.2 });
      await D.walk(0, 35, 29, { sprint: true, turn: 0.2 });
      await D.sleep(400);
      const q = D.P(1);
      await D.look(0, q.x, q.y + 1.2, q.z, 0.7);
      await D.track(0, () => [D.P(1).x, D.P(1).y + 1.45, D.P(1).z], 1.0, { aim: true });
      window.__shotNow = true;
      await D.shoot(0, () => [D.P(1).x, D.P(1).y + 1.45, D.P(1).z], 1, { aim: true, settle: 200 });
      await D.sleep(300);
      if (D.P(1).alive) await D.shoot(0, () => [D.P(1).x, D.P(1).y + 1.2, D.P(1).z], 1, { aim: true, settle: 900 });
      D.idle(0);
      await D.sleep(2200);
      void p2;
    });
    await stop();
    // Stills: split-screen from the mezzanine and from under the bridge.
    await ev(pg, () => {
      D.tp(0, 12, 3, 4, 120, -12);
      D.tp(1, 30, 0, 16, 60, 8);
    });
    await pg.waitForTimeout(700);
    await shot(pg, '02_warehouse_split');
    await ctx.close();
  },

  async depot(browser) {
    const { ctx, pg } = await open(browser, '?level=depot&players=1&debug=1&autostart=1&seed=3');
    await ev(pg, () => {
      D.tp(0, 23, 0, 76, 10, 0);
      const g = D.W().guards.find((x) => x.id === 'y1');
      g.x = g.prev.x = 31;
      g.z = g.prev.z = 54.2;
      g.patrol = [{ x: 14, z: 54.2 }, { x: 31, z: 54.2 }];
      g.patrolIndex = 0;
      g.path = [];
      g.pathGoal = null;
    });
    const stop = await startClip(pg, '03_depot');
    await ev(pg, async () => {
      await D.walk(0, 27, 69.2);
      await D.sleep(300);
      await D.walk(0, 35, 70, { near: 0.3 });
      const g = () => D.W().guards.find((x) => x.id === 'y1');
      await D.look(0, g().x, 1.2, g().z, 0.8);
      await D.track(0, () => [g().x, g().y + 1.2, g().z], 0.6, { aim: true, crouch: true });
      const t0 = performance.now();
      while (g().x > 17.25 && performance.now() - t0 < 12000) {
        const p = D.P(0);
        const gx = g().x;
        p.yaw += (Math.atan2(gx - p.x, -(g().z - p.z)) - p.yaw) * 0.2;
        p.pitch += (Math.atan2(g().y + 1.2 - (p.y + 1.6), Math.hypot(gx - p.x, g().z - p.z)) - p.pitch) * 0.2;
        D.P(0) && window.__game.setIntent(0, { aim: true, crouch: true });
        await D.frame();
      }
      await D.shoot(0, () => [17, 0.45, 53], 1, { aim: true, settle: 60 });
      D.idle(0);
      await D.sleep(300);
      window.__game.setIntent(0, { crouch: true });
      await D.sleep(2600);
    });
    await stop();
    await ev(pg, () => {
      D.tp(0, 30, 0, 66, 330, 4);
    });
    await pg.waitForTimeout(600);
    await shot(pg, '03_depot_yard');
    await ctx.close();
  },

  async training(browser) {
    const { ctx, pg } = await open(browser, '?level=training&players=1&debug=1&autostart=1&seed=3');
    await ev(pg, () => D.tp(0, 33, 0, 86.5, 330, 0));
    const stopA = await startClip(pg, '04_training_course');
    await ev(pg, async () => {
      await D.sleep(400);
      await D.look(0, 31, 0.9, 83.85, 0.6);
      await D.walk(0, 31.2, 85.3, { near: 0.3 });
      await D.look(0, 31, 0.9, 83.85, 0.3);
      await D.tap(0, { interact: true });
      await D.sleep(600);
      await D.tap(0, { weaponSlot: 3 });
      await D.sleep(500);
      // Warm-up targets on the west side, from up close.
      await D.walk(0, 22, 74, { sprint: true });
      const west = D.W().targets.filter((t) => t.x < 25 && t.z > 52 && t.z < 70);
      west.sort((a, b) => Math.hypot(a.x - 22, a.z - 74) - Math.hypot(b.x - 22, b.z - 74));
      for (const t of west) {
        for (let k = 0; k < 6 && t.standing; k++) await D.shoot(0, () => [t.x, t.y, t.z], 1, { settle: k ? 40 : 260, gap: 60 });
        await D.sleep(120);
      }
      await D.sleep(300);
      // The grenade pit.
      await D.walk(0, 37, 70.2, { sprint: true, near: 0.15 });
      await D.tap(0, { weaponSlot: 5 });
      await D.sleep(500);
      const p = D.P(0);
      // Calibrated: 50° up from right at the crates drops the grenade behind them.
      const y0 = p.yaw;
      const p0 = p.pitch;
      for (let i = 1; i <= 24; i++) {
        p.yaw = y0 + ((((0 - y0 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * (i / 24);
        p.pitch = p0 + (50 * Math.PI / 180 - p0) * (i / 24);
        await D.frame();
      }
      p.x = p.prev.x = 37;
      p.z = p.prev.z = 70.2;
      await D.tap(0, { fire: true }, 3);
      await D.sleep(250);
      for (let i = 1; i <= 30; i++) {
        p.pitch = 50 * Math.PI / 180 + (-2 * Math.PI / 180 - 50 * Math.PI / 180) * (i / 30);
        await D.frame();
      }
      await D.sleep(2600);
    });
    await stopA();
    await ev(pg, () => D.tp(0, 30, 3, 45, 345, -4));
    await pg.waitForTimeout(500);
    const stopB = await startClip(pg, '05_training_deck');
    await ev(pg, async () => {
      await D.tap(0, { weaponSlot: 4 });
      await D.sleep(700);
      const rail = D.W().targets.find((t) => t.rail && t.z < 35);
      await D.look(0, rail.x, rail.y, rail.z, 0.7);
      await D.track(0, () => [rail.x, rail.y, rail.z], 1.2, { aim: true });
      await D.shoot(0, () => [rail.x, rail.y, rail.z], 1, { aim: true, settle: 150 });
      await D.sleep(900);
      const tower = D.W().targets.filter((t) => t.baseY > 4);
      for (const t of tower) {
        await D.track(0, () => [t.x, t.y, t.z], 0.9, { aim: true });
        await D.shoot(0, () => [t.x, t.y, t.z], 1, { aim: true, settle: 150 });
        await D.sleep(900);
      }
      D.idle(0);
      await D.look(0, 20, 1.2, 34, 0.9);
      await D.sleep(1600);
    });
    await stopB();
    await ev(pg, () => D.tp(0, 30, 3, 45.5, 340, -6));
    await pg.waitForTimeout(700);
    await shot(pg, '04_training_deck');
    await ev(pg, () => D.tp(0, 22, 0, 54, 20, 2));
    await pg.waitForTimeout(700);
    await shot(pg, '05_training_dummies');
    await ctx.close();
  },

  async snowfort(browser) {
    const { ctx, pg } = await open(browser, '?level=arena_snowfort&players=1&debug=1&autostart=1&seed=3');
    await ev(pg, () => D.tp(0, 6, 0, 6, 110, 0));
    const stop = await startClip(pg, '06_snowfort');
    await ev(pg, async () => {
      const p = D.P(0);
      const t0 = performance.now();
      window.__game.setIntent(0, { moveZ: 0.55 });
      while (performance.now() - t0 < 4500) {
        p.yaw += 0.0045;
        await D.frame();
      }
      D.idle(0);
    });
    await stop();
    await shot(pg, '06_snowfort');
    await ctx.close();
  },
};

(async () => {
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  for (const [name, fn] of Object.entries(scenes)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    console.log(name);
    try {
      await fn(browser);
    } catch (e) {
      console.log('  FAILED', e.message);
    }
  }
  await browser.close();
})();
