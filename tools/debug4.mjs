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
await page.waitForTimeout(1500);

let done = false;
const shotWatcher = (async () => {
  while (!done) {
    try {
      const m = await page.evaluate(() => {
        const m = window.__milestone;
        if (m) { window.__milestone = null; window.__ack = true; }
        return m;
      });
      if (m) { await page.screenshot({ path: `qa/m_${m}.png` }); console.log('📸', m); }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
})();

const transcript = await page.evaluate(async () => {
  const g = window.__fng.game;
  g.timeScale = 6;
  const log = [];
  const note = (s) => log.push(`[t=${g.t.toFixed(1)}] ${s}`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (code, k) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: k }));
  const waitFor = async (pred, label, maxReal = 50000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < maxReal) { if (pred()) return true; await sleep(50); }
    note(`TIMEOUT ${label} (phase=${g.phase})`);
    return false;
  };
  const milestone = async (name) => {
    window.__milestone = name; window.__ack = false;
    const t0 = performance.now();
    while (!window.__ack && performance.now() - t0 < 3500) await sleep(80);
  };

  // ---- pass completion stats: run slants/curls 8 times from the 50
  let comp = 0, inc = 0, pick = 0, sack = 0, other = 0;
  for (let i = 0; i < 8; i++) {
    await waitFor(() => g.phase === 'playcall', `pc${i}`);
    g.hud.hidePlaycall();
    g.match.poss = 'home'; g.match.dir = 1; g.match.losX = 0; g.match.down = 1; g.match.toGo = 10;
    g.offPlay = null;
    g.toPlaycall();
    await sleep(150);
    key(i % 2 ? 'Digit5' : 'Digit4', i % 2 ? '5' : '4');
    if (!(await waitFor(() => g.phase === 'set', `set${i}`, 30000))) break;
    key('Space', ' ');
    await waitFor(() => g.phase === 'live', `live${i}`, 20000);
    await waitFor(() => g.liveT > 1.0 || g.phase !== 'live', `pocket${i}`, 20000);
    // throw to whichever target is open
    const best = g.bestTarget(g.players.home.QB);
    const idx = g.targetsLive.indexOf(best?.a);
    key(`Digit${(idx >= 0 ? idx : 1) + 1}`, String((idx >= 0 ? idx : 1) + 1));
    await waitFor(() => ['playcall', 'td', 'kick', 'dead'].includes(g.phase) || (g.holder && g.holder.team === 'home' && g.holder.state === 'user-carry'), `res${i}`, 30000);
    if (g.holder?.state === 'user-carry') {
      comp++;
      note(`play ${i}: COMPLETE to ${g.holder.role}`);
      await waitFor(() => ['playcall', 'td', 'kick'].includes(g.phase), `end${i}`, 30000);
    } else {
      const r = g.playResult?.reason;
      if (r === 'incomplete') inc++; else if (r === 'sack') sack++; else other++;
      if ((g.match.poss === 'away')) pick++;
      note(`play ${i}: ${r || g.phase} ${g.match.poss === 'away' ? '(INT)' : ''}`);
    }
  }
  note(`STATS: ${comp} comp / ${inc} inc / ${sack} sack / ${pick} flips / ${other} other`);

  // ---- forced TD: toss from the 4 until it happens (max 4 tries)
  for (let tries = 0; tries < 4; tries++) {
    await waitFor(() => g.phase === 'playcall', 'pcTD', 60000);
    g.hud.hidePlaycall();
    g.match.poss = 'home'; g.match.dir = 1; g.match.losX = 46; g.match.down = 1; g.match.toGo = 4;
    g.offPlay = null; g.toPlaycall();
    await sleep(150);
    key('Digit2', '2'); // toss
    await waitFor(() => g.phase === 'set', 'setTD', 30000);
    key('Space', ' ');
    // steer the carrier upfield: hold W
    const hold = setInterval(() => {
      if (g.user && (g.user.state === 'user-carry')) g.keys.add('KeyW'), g.keys.add('ShiftLeft');
    }, 100);
    const got = await waitFor(() => g.phase === 'td', `tdTry${tries}`, 25000);
    clearInterval(hold);
    g.keys.clear();
    if (got) {
      note(`TOUCHDOWN! score=${g.match.home}-${g.match.away}`);
      await sleep(700);
      await milestone('td');
      await waitFor(() => g.phase === 'kick', 'xp', 30000);
      await sleep(1100);
      await milestone('xp');
      await waitFor(() => g.phase === 'playcall', 'afterxp', 50000);
      note(`after XP: ${g.match.home}-${g.match.away}`);
      break;
    }
    note(`try ${tries}: no TD (phase=${g.phase})`);
  }
  return log;
}).catch((e) => [`EVAL ERROR: ${e.message}`]);
done = true;
await shotWatcher;
for (const line of transcript) console.log(line);
await browser.close(); server.close(); process.exit(0);
