/**
 * Generates the Open Graph / social-share image (1200×630) for LifeHub.
 *
 * Usage:
 *   node scripts/generate-og-image.cjs
 *
 * Output: assets/og-image.png (referenced by index.html and the SEO service).
 * Re-run after any brand change. Requires a Chromium install (Playwright):
 *   npx playwright install chromium
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'assets', 'og-image.png');

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    background: #faf6ec;
    color: #1a1a1a;
    position: relative;
  }
  /* dotted grid */
  body::before {
    content: '';
    position: absolute; inset: 0;
    background-image: radial-gradient(#1a1a1a 1.5px, transparent 1.5px);
    background-size: 24px 24px;
    opacity: 0.28;
  }
  .wrap { position: relative; padding: 44px 56px; height: 100%; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo {
    width: 52px; height: 52px; border-radius: 14px; background: #ffd600;
    border: 3px solid #1a1a1a; box-shadow: 4px 4px 0 0 #1a1a1a;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Archivo Black', sans-serif; font-size: 20px;
  }
  .brand-name { font-family: 'Archivo Black', sans-serif; font-size: 30px; letter-spacing: 0.5px; }
  .brand-tag { font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #57534a; text-transform: uppercase; margin-top: 2px; }
  .main { flex: 1; display: flex; align-items: center; gap: 44px; }
  .left { flex: 1; }
  .h1 { font-family: 'Archivo Black', sans-serif; font-size: 74px; line-height: 1.02; letter-spacing: -1px; }
  .highlight {
    display: inline-block; position: relative; background: #ffd600;
    border: 3px solid #1a1a1a; box-shadow: 8px 8px 0 0 #1a1a1a;
    padding: 2px 16px; transform: rotate(-1deg);
  }
  .sub { margin-top: 26px; font-size: 20px; font-weight: 500; color: #57534a; max-width: 460px; line-height: 1.4; }
  .chips { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 10px; }
  .chip {
    border: 2.5px solid #1a1a1a; background: #ffffff; border-radius: 10px;
    padding: 8px 14px; font-size: 15px; font-weight: 700; box-shadow: 3px 3px 0 0 #1a1a1a;
  }
  .right { width: 400px; }
  .window {
    background: #ffffff; border: 3px solid #1a1a1a; border-radius: 16px;
    box-shadow: 10px 10px 0 0 #1a1a1a; overflow: hidden; transform: rotate(1.5deg);
  }
  .chrome { background: #f0ead9; border-bottom: 3px solid #1a1a1a; padding: 12px 16px; display: flex; gap: 7px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid #1a1a1a; }
  .dot-r { background: #ff4d4d; } .dot-y { background: #ff9f1c; } .dot-g { background: #00c2a8; }
  .body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .row { display: flex; gap: 10px; }
  .stat {
    flex: 1; border: 2.5px solid #1a1a1a; border-radius: 10px; background: #faf6ec;
    padding: 10px 12px; box-shadow: 3px 3px 0 0 #1a1a1a;
  }
  .stat .l { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #9c9687; }
  .stat .v { font-family: 'Archivo Black', sans-serif; font-size: 19px; margin-top: 2px; }
  .task {
    border: 2.5px solid #1a1a1a; border-radius: 10px; background: #faf6ec;
    padding: 10px 12px; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600;
  }
  .task .box { width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid #1a1a1a; }
  .task .box.done { background: #00c2a8; }
  .task .txt.done { text-decoration: line-through; color: #9c9687; }
  .foot {
    display: flex; align-items: center; justify-content: space-between;
    border-top: 3px solid #1a1a1a; padding-top: 20px;
  }
  .foot-left { font-family: 'Archivo Black', sans-serif; font-size: 18px; }
  .foot-right { font-size: 14px; font-weight: 700; color: #57534a; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div class="logo">LH</div>
      <div>
        <div class="brand-name">LIFEHUB</div>
        <div class="brand-tag">Personal Life Management Platform</div>
      </div>
    </div>

    <div class="main">
      <div class="left">
        <div class="h1">Life,<br><span class="highlight">organized.</span></div>
        <div class="sub">Finance, tasks, habits, goals, notes &amp; an AI assistant — one brutal-simple workspace for your whole life.</div>
        <div class="chips">
          <span class="chip">✅ Tasks</span>
          <span class="chip">💰 Finance</span>
          <span class="chip">🔥 Habits</span>
          <span class="chip">🎯 Goals</span>
          <span class="chip">✨ AI</span>
        </div>
      </div>

      <div class="right">
        <div class="window">
          <div class="chrome"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span></div>
          <div class="body">
            <div class="row">
              <div class="stat"><div class="l">Balance</div><div class="v">Rp 12.4jt</div></div>
              <div class="stat"><div class="l">Income</div><div class="v" style="color:#00c2a8">+8jt</div></div>
              <div class="stat"><div class="l">Expense</div><div class="v" style="color:#ff4d4d">-4.5jt</div></div>
            </div>
            <div class="task"><span class="box done"></span><span class="txt done">Finish API documentation</span></div>
            <div class="task"><span class="box done"></span><span class="txt done">Complete financial review</span></div>
            <div class="task"><span class="box"></span><span class="txt">Plan weekend trip</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="foot">
      <div class="foot-left">Life, organized.</div>
      <div class="foot-right">lifehub.id</div>
    </div>
  </div>
</body>
</html>`;

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

  try {
    await page.setContent(HTML, { waitUntil: 'networkidle', timeout: 15000 });
  } catch {
    // Offline — render with fallback fonts instead of failing.
    await page.setContent(HTML);
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: OUT });
  await browser.close();

  const bytes = fs.statSync(OUT).size;
  console.log(`OG image written to ${OUT} (${Math.round(bytes / 1024)} KB)`);
})().catch((err) => {
  console.error('Failed to generate OG image:', err.message);
  process.exit(1);
});
