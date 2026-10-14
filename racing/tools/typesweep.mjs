// Race-type sweep: every race type driven start to results by the autopilot,
// then the replay, failing on any page error.
//   node racing/tools/typesweep.mjs [type:track[:extra],…]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const cases = (process.argv[2] || 'circuit:oldtown,sprint:uptown,knockout:pier9,drag:drylake,drift:redwood,timeattack:summit,circuit:skyline:traffic=1').split(',');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let failed = 0;
for (const c of cases) {
  const [type, track, extra] = c.split(':');
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const t0 = Date.now();
  let status = 'ok';
  try {
    await page.goto(`http://127.0.0.1:${port}/racing/index.html?screen=race&track=${track}&car=m3&type=${type}&laps=${type === 'knockout' ? 3 : 1}&autopilot=1&sim=4${extra ? '&' + extra : ''}`);
    await page.waitForFunction(() => window.__race && window.__race.state === 'done' && window.__race.doneT > 3, null, { timeout: 900000, polling: 1000 });
    await page.waitForTimeout(2500);
    const res = await page.evaluate(() => ({ place: window.__race.player.place, out: !!window.__race.player.out, time: window.__race.player.finishTime, tape: window.__race.recorder.duration, canReplay: window.__race.canReplay }));
    // replay a few seconds
    await page.evaluate(() => window.__race.startReplay());
    await page.waitForTimeout(3000);
    const rp = await page.evaluate(() => (window.__race.replay ? `${window.__race.replay.shotName} t=${window.__race.replay.t.toFixed(1)}` : 'no replay'));
    await page.evaluate(() => window.__race.stopReplay('results_win'));
    status = `place ${res.place ?? (res.out ? 'OUT' : '-')} time ${res.time?.toFixed?.(1) ?? '-'} tape ${res.tape.toFixed(0)}s replay [${rp}]`;
  } catch (e) {
    status = 'FAILED ' + e.message.split('\n')[0];
    failed++;
  }
  if (errs.length) failed++;
  console.log(`${type.padEnd(10)} ${track.padEnd(9)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  ${status}  errors ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await page.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
