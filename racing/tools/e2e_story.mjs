// End-to-end story check: new game → buy a car → race an event on autopilot →
// results → back in the garage with the payout, REP and rival records applied.
//   node racing/tools/e2e_story.mjs [eventId=dt2] [sim=10] [carId=civica]
// Event ids are the story's (dt2, ct4, bs_boss, …); the old v1 ids (c1e2, …)
// still work and map to their v2 events. A cup runs its first round.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const [evArg = 'dt2', sim = '10', carId = 'civica'] = process.argv.slice(2);
await mkdir(join(root, 'qa'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
let pageErrors = 0;
page.on('pageerror', (e) => { pageErrors++; console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/racing/index.html?screen=story&newGame=1&autopilot=1&sim=${sim}`);
await page.waitForFunction(() => window.__story, null, { timeout: 120000 });
const t0 = Date.now();
const evId = await page.evaluate(([id, car]) => {
  const W = window.__story;
  const S = W.story;
  S.addCar(car, {});
  S.save();
  const all = W.EVENTS || W.CHAPTERS.flatMap((_, c) => S.events(c));
  const ev = all.find((e) => e.id === id) || all.find((e) => e.id === W.V1_EVENTS?.[id]);
  if (!ev) throw new Error(`no story event ${id}`);
  S.s.chapter = Math.max(S.s.chapter, ev.ch);
  W.raceEvent(ev);
  return ev.id;
}, [evArg, carId]);
console.log('event', evId);
await page.waitForFunction(() => window.__race && window.__race.state === 'done' && window.__game.screen?.name === 'race' && window.__race.doneT > 3.5, null, { timeout: 1500000, polling: 1000 });
console.log('race done in', ((Date.now() - t0) / 1000).toFixed(0), 's');
await page.screenshot({ path: join(root, 'qa', 'e2e_results.png') });
const res = await page.evaluate(() => {
  const r = window.__race;
  return { place: r.player.place, time: r.player.finishTime, best: r.player.bestLap, target: r.target, order: r.sim.finishOrder.map((x) => `${x.name}:${x.spec.id}`) };
});
console.log('result', JSON.stringify(res));
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.screen?.name === 'story' && window.__story?.page, null, { timeout: 120000, polling: 500 });
await page.waitForTimeout(8000);
const st = await page.evaluate((id) => {
  const W = window.__story;
  const s = W.story.s;
  return { page: W.page, cash: s.cash, rep: s.rep, rank: s.rank, event: s.events[id], cup: s.cup, rivals: s.rivals, unread: s.unread };
}, evId);
console.log('story', JSON.stringify(st));
await page.screenshot({ path: join(root, 'qa', 'e2e_story.png') });
console.log('page errors', pageErrors);
await browser.close();
server.close();
