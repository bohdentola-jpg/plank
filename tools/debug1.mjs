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
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
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
  return { phase: g.phase, t: +g.t.toFixed(1), down: g.match.down, toGo: g.match.toGo, los: +g.match.losX.toFixed(1), score: `${g.match.home}-${g.match.away}`, holder: g.holder?.role || null, holderTeam: g.holder?.team || null, ball: g.ballMode, poss: g.match.poss, user: g.user?.role || null };
});
const waitPhase = async (names, timeout = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await state();
    if (names.includes(s.phase)) return s;
    await page.waitForTimeout(250);
  }
  throw new Error(`timeout waiting for ${names}: ${JSON.stringify(await state())}`);
};
try {
  console.log('wait playcall...', JSON.stringify(await waitPhase(['playcall'])));
  await page.keyboard.press('Digit1'); // HB Dive
  console.log('wait set...', JSON.stringify(await waitPhase(['set'])));
  await page.keyboard.press('Space');
  console.log('snapped:', JSON.stringify(await waitPhase(['live'])));
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(600);
    const s = await state();
    console.log('live...', JSON.stringify(s));
    if (s.phase !== 'live') break;
  }
  const after = await waitPhase(['playcall', 'dead', 'td', 'kick'], 25000);
  console.log('PLAY OVER →', JSON.stringify(after));
  await page.screenshot({ path: 'qa/flow1.png' });
} catch (e) {
  console.log('ERROR', e.message);
  await page.screenshot({ path: 'qa/flow_err.png' });
}
await browser.close(); server.close(); process.exit(0);
