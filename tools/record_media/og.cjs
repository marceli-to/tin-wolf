// Renders public/og-image.png (1200x630): a screenshot with the logo card. Usage: node og.cjs <screenshot.png>
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const root = require('path').join(__dirname, '../..');
const font = fs.readFileSync(root + '/public/assets/fonts/Fredoka.ttf').toString('base64');
const shot = fs.readFileSync(process.argv[2]).toString('base64');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await pg.setContent(`<html><head><style>
    @font-face { font-family: F; src: url(data:font/ttf;base64,${font}); font-weight: 300 700; }
    html,body { margin:0; width:1200px; height:630px; overflow:hidden; font-family:F; }
    .bg { position:absolute; inset:0; background:url(data:image/png;base64,${shot}) center/cover; }
    .card { position:absolute; left:48px; bottom:52px; background:#fff8e8; border:6px solid #1f2a44; border-radius:30px;
      box-shadow:0 9px 0 #1f2a44, 0 24px 50px rgba(31,42,68,.45); padding:22px 36px 26px; transform: rotate(-1.5deg); }
    h1 { margin:0; font-size:104px; line-height:.95; font-weight:700; letter-spacing:.03em; color:#ff7a2f;
      -webkit-text-stroke:12px #1f2a44; paint-order:stroke fill; text-shadow:0 8px 0 #1f2a44; }
    p { margin:16px 0 0; font-size:32px; font-weight:700; color:#1f2a44; }
    .chips { margin-top:12px; display:flex; gap:10px; }
    .chips span { font-size:20px; font-weight:700; padding:3px 16px; border:4px solid #1f2a44; border-radius:999px; background:#fff; color:#1f2a44; }
  </style></head><body><div class="bg"></div><div class="card"><h1>TIN FOX</h1><p>A toy-box spy shooter for the couch</p>
  <div class="chips"><span>Free</span><span>In the browser</span><span>2-player split-screen</span></div></div></body></html>`);
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: root + '/public/og-image.png' });
  await b.close();
})();
