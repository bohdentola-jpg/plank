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

// node side: watch for milestones and screenshot them
let done = false;
const shotWatcher = (async () => {
  while (!done) {
    try {
      const m = await page.evaluate(() => {
        const m = window.__milestone;
        if (m) { window.__milestone = null; window.__ack = true; }
        return m;
      });
      if (m) {
        await page.screenshot({ path: `qa/m_${m}.png` });
        console.log('📸', m);
      }
    } catch { /* page busy */ }
    await new Promise((r) => setTimeout(r, 300));
  }
})();

const transcript = await page.evaluate(async () => {
  const g = window.__fng.game;
  g.timeScale = 5;
  const log = [];
  const note = (s) => log.push(`[t=${g.t.toFixed(1)}] ${s}`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (code, k) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: k }));
  const waitFor = async (pred, label, maxReal = 45000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < maxReal) {
      if (pred()) return true;
      await sleep(60);
    }
    note(`TIMEOUT waiting ${label} (phase=${g.phase})`);
    return false;
  };
  const milestone = async (name) => {
    window.__milestone = name;
    window.__ack = false;
    const t0 = performance.now();
    while (!window.__ack && performance.now() - t0 < 4000) await sleep(100);
  };
  const snap = () => key('Space', ' ');
  const phase = (p) => () => g.phase === p;

  // --- PASS: slants, throw to #2
  await waitFor(phase('playcall'), 'playcall0');
  key('Digit4', '4');
  await waitFor(phase('set'), 'set0');
  snap();
  await waitFor(phase('live'), 'live0');
  await waitFor(() => g.liveT > 0.8, 'pocket time');
  note(`throwing... holder=${g.holder?.role}`);
  key('Digit2', '2');
  await waitFor(() => g.ballMode === 'flight' || g.phase !== 'live', 'flight');
  await milestone('pass_flight');
  await waitFor(() => g.phase !== 'live' && g.phase !== 'dead', 'pass resolve');
  note(`pass result: phase=${g.phase} down=${g.match.down} toGo=${g.match.toGo} los=${g.match.losX.toFixed(1)}`);

  // --- PUNT
  await waitFor(phase('playcall'), 'playcall1');
  g.hud.hidePlaycall();
  g.startPunt();
  await waitFor(() => g.phase === 'playcall' && g.match.poss === 'away', 'punt done', 50000);
  note(`after punt: poss=${g.match.poss} los=${g.match.losX.toFixed(1)} (away ball — DEFENSE)`);

  // --- DEFENSE x2
  for (let i = 0; i < 2; i++) {
    if (!(g.phase === 'playcall' && g.match.poss === 'away')) break;
    key('Digit1', '1');
    await waitFor(phase('live'), `D live ${i}`, 50000);
    note(`defense live: user=${g.user?.role} cpu play=${g.offPlay?.id}`);
    if (i === 0) await milestone('defense_live');
    key('KeyE', 'e');
    await sleep(300);
    key('Space', ' ');
    await waitFor(() => ['playcall', 'td', 'kick'].includes(g.phase), `D resolve ${i}`, 50000);
    note(`D play done: phase=${g.phase} score=${g.match.home}-${g.match.away} poss=${g.match.poss} down=${g.match.down}`);
    if (g.phase === 'kick' || g.phase === 'td') {
      await waitFor(() => g.phase === 'playcall', 'cpu score seq', 60000);
      note(`cpu scored: ${g.match.home}-${g.match.away}`);
    }
  }

  // --- force our TD: 1st & goal at the 3
  await waitFor(phase('playcall'), 'playcall2', 60000);
  g.hud.hidePlaycall();
  g.match.poss = 'home'; g.match.dir = 1; g.match.losX = 47; g.match.down = 1; g.match.toGo = 3;
  g.toPlaycall();
  await sleep(200);
  key('Digit1', '1');
  await waitFor(phase('set'), 'set TD', 50000);
  snap();
  const sawTd = await waitFor(() => g.phase === 'td', 'TD', 30000);
  if (sawTd) {
    note(`TOUCHDOWN ${g.match.home}-${g.match.away}`);
    await milestone('td');
    await waitFor(phase('kick'), 'xp scene', 30000);
    await sleep(900);
    await milestone('xp');
    await waitFor(phase('playcall'), 'after xp', 50000);
    note(`after XP: ${g.match.home}-${g.match.away} poss=${g.match.poss}`);
  } else {
    note(`no TD — phase=${g.phase} down=${g.match.down} toGo=${g.match.toGo} los=${g.match.losX.toFixed(1)}`);
  }

  // --- FG from the 20 (37 yarder)
  await waitFor(phase('playcall'), 'playcall3', 60000);
  g.hud.hidePlaycall();
  g.match.poss = 'home'; g.match.dir = 1; g.match.losX = 30; g.match.down = 4; g.match.toGo = 8;
  g.startKick('FG');
  await sleep(600);
  await milestone('fg');
  await waitFor(phase('playcall'), 'after fg', 50000);
  note(`after FG try: ${g.match.home}-${g.match.away} poss=${g.match.poss}`);
  note(`clock=${g.match.clock.toFixed(0)} qtr=${g.match.qtr} fps=${g._fpsEma.toFixed(1)} lowSpec=${g.lowSpec}`);
  return log;
}).catch((e) => [`EVAL ERROR: ${e.message}`]);

done = true;
await shotWatcher;
for (const line of transcript) console.log(line);
await browser.close(); server.close(); process.exit(0);
