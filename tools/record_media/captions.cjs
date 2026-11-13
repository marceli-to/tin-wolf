// Renders the caption cards overlaid on each clip (cap_<clip>.png). Usage: node captions.cjs <outDir>
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const out = process.argv[2];
const font = fs.readFileSync(require('path').join(__dirname, '../../public/assets/fonts/Fredoka.ttf')).toString('base64');
const caps = {
  '01_menu': ['Tin Fox', 'A toy-box shooter for the couch'],
  '02_toyfactory': ['Split-screen versus', 'Toy Factory: catwalks, a bridge and the Heron LR'],
  '07_space': ['Versus the computer', 'Space Station: up to three computer players'],
  '03_depot': ['Mission: Halvard Depot', 'One shot, one red barrel'],
  '04_training_course': ['Training Ground', 'Timed course, practice dummies and the grenade pit'],
  '05_training_deck': ['Shooting deck', 'Moving targets and the tower, 4× scope'],
  '06_castle': ['Castle', 'Towers, a catapult and a keep in the middle'],
};
(async () => {
  const b = await chromium.launch({ channel: process.env.CHANNEL });
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [k, [title, sub]] of Object.entries(caps)) {
    await pg.setContent(`<html><head><style>
      @font-face { font-family: F; src: url(data:font/ttf;base64,${font}); font-weight: 300 700; }
      html,body { margin:0; background: transparent; }
      .cap { position:absolute; left:64px; bottom:120px; font-family:F; background:#fff7ea; color:#1f2a44;
        border:5px solid #1f2a44; border-radius:26px; box-shadow:0 8px 0 #1f2a44; padding:18px 30px 20px; }
      h1 { margin:0; font-size:54px; font-weight:700; color:#ff7a2f; -webkit-text-stroke: 2px #1f2a44; letter-spacing: 1px; }
      p { margin:6px 0 0; font-size:30px; font-weight:600; }
    </style></head><body><div class="cap"><h1>${title}</h1><p>${sub}</p></div></body></html>`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: `${out}/cap_${k}.png`, omitBackground: true });
  }
  await b.close();
})();
