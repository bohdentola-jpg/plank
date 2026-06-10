import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';
const root = '/home/user/plank';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, (e.stack || '').split('\n')[1] || ''));
await page.goto(`http://127.0.0.1:${port}/index.html?quick`);
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__fng.game.timeScale = 10; });
const state = () => page.evaluate(() => {
  const g = window.__fng.game;
  return { phase: g.phase, t: +g.t.toFixed(1), down: g.match.down, toGo: g.match.toGo, los: +g.match.losX.toFixed(1), score: `${g.match.home}-${g.match.away}`, holder: g.holder ? `${g.holder.team}.${g.holder.role}.${g.holder.state}` : null, ball: g.ballMode, poss: g.match.poss, user: g.user?.role || null, qtr: g.match.qtr, clock: +g.match.clock.toFixed(0) };
});
const waitPhase = async (names, timeout = 40000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await state();
    if (names.includes(s.phase)) return s;
    await page.waitForTimeout(220);
  }
  throw new Error(`timeout for ${names}: ${JSON.stringify(await state())}`);
};
try {
  // ---- PASS PLAY
  await waitPhase(['playcall']);
  await page.keyboard.press('Digit4'); // slants
  await waitPhase(['set']);
  await page.keyboard.press('Space');
  await waitPhase(['live']);
  await page.waitForTimeout(700);
  console.log('pre-throw:', JSON.stringify(await state()));
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(500);
  console.log('post-throw:', JSON.stringify(await state()));
  await page.screenshot({ path: 'qa/pass_flight.png' });
  const r1 = await waitPhase(['playcall', 'td', 'kick'], 30000);
  console.log('PASS RESULT →', JSON.stringify(r1));

  // ---- PUNT (force 4th down via eval)
  await waitPhase(['playcall']);
  await page.evaluate(() => { const g = window.__fng.game; g.hud.hidePlaycall(); g.startPunt(); });
  const r2 = await waitPhase(['playcall'], 40000);
  console.log('AFTER PUNT →', JSON.stringify(r2));

  // ---- DEFENSE: user picks D, CPU runs offense
  for (let play = 0; play < 3; play++) {
    const s0 = await waitPhase(['playcall', 'td', 'kick', 'final'], 40000);
    if (s0.poss !== 'away' || s0.phase !== 'playcall') { console.log('skip D loop:', JSON.stringify(s0)); break; }
    await page.keyboard.press('Digit1'); // 4-3 base
    await waitPhase(['live'], 30000);
    await page.waitForTimeout(400);
    if (play === 0) await page.screenshot({ path: 'qa/defense_live.png' });
    await page.keyboard.press('KeyE'); // switch defender
    await page.waitForTimeout(300);
    await page.keyboard.press('Space'); // dive
    const sD = await waitPhase(['playcall', 'td', 'kick', 'dead'], 35000);
    console.log(`D play ${play} →`, JSON.stringify(sD));
  }

  // ---- TD path: give user ball at the 3
  await waitPhase(['playcall', 'td', 'kick'], 40000);
  await page.evaluate(() => {
    const g = window.__fng.game;
    g.hud.hidePlaycall();
    g.match.poss = 'home'; g.match.dir = 1; g.match.losX = 47; g.match.down = 1; g.match.toGo = 3;
    g.offPlay = null; g.toPlaycall();
  });
  await waitPhase(['playcall']);
  await page.keyboard.press('Digit1'); // dive
  await waitPhase(['set']);
  await page.keyboard.press('Space');
  const r3 = await waitPhase(['td', 'playcall', 'kick'], 35000);
  console.log('GOAL LINE →', JSON.stringify(r3));
  if (r3.phase === 'td') {
    await page.screenshot({ path: 'qa/td.png' });
    const r4 = await waitPhase(['kick'], 30000);
    console.log('XP SCENE →', JSON.stringify(r4));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'qa/xp.png' });
    const r5 = await waitPhase(['playcall'], 40000);
    console.log('AFTER XP →', JSON.stringify(r5));
  }
  console.log('FINAL STATE:', JSON.stringify(await state()));
} catch (e) {
  console.log('ERROR', e.message);
  await page.screenshot({ path: 'qa/flow_err.png' });
}
await browser.close(); server.close(); process.exit(0);
