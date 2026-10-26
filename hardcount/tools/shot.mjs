// QA screenshot harness for HARD COUNT. Serves the repo root, opens
// /hardcount/index.html?<query> in headless Chromium, waits, captures into qa/.
//   node hardcount/tools/shot.mjs "screen=dev" dev.png --wait 3000
//   node hardcount/tools/shot.mjs "screen=race&track=downtown" race.png --keys "ArrowUp@500:4000"
//   --series 4@800  (4 shots, 800ms apart)   --eval "js expr"   --w 1280 --h 960
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('nope');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const [query = '', out = 'shot.png', ...rest] = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : dflt;
};
const wait = parseInt(opt('wait', '3000'), 10);
const width = parseInt(opt('w', '1280'), 10);
const height = parseInt(opt('h', '900'), 10);
const evalJs = opt('eval', null);
const keys = opt('keys', null);     // "ArrowUp@500:3000,Space@4000" → key@start[:holdMs]
const series = opt('series', null);
const quiet = rest.includes('--quiet');

await mkdir(join(root, 'qa'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width, height } });
const logs = [];
page.on('console', (m) => { if (!quiet || m.type() === 'error') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));

const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/hardcount/index.html?${query}`);

const timers = [];
if (keys) {
  for (const spec of keys.split(',')) {
    const [key, timing] = spec.split('@');
    const [startRaw, holdRaw] = (timing || '0').split(':');
    const start = parseInt(startRaw, 10);
    const hold = holdRaw ? parseInt(holdRaw, 10) : 0;
    timers.push(setTimeout(async () => {
      try {
        if (hold) {
          await page.keyboard.down(key.trim());
          setTimeout(() => page.keyboard.up(key.trim()).catch(() => {}), hold);
        } else {
          await page.keyboard.press(key.trim());
        }
      } catch { /* page closed */ }
    }, start));
  }
}
await page.waitForTimeout(wait);
if (evalJs) {
  const result = await page.evaluate(evalJs);
  if (result !== undefined) console.log('[eval]', typeof result === 'string' ? result : JSON.stringify(result));
}
if (series) {
  const [nRaw, gapRaw] = series.split('@');
  const n = parseInt(nRaw, 10), gap = parseInt(gapRaw || '1000', 10);
  for (let i = 0; i < n; i++) {
    await page.screenshot({ path: join(root, 'qa', `${out.replace('.png', '')}_${i}.png`) });
    if (i < n - 1) await page.waitForTimeout(gap);
  }
} else {
  await page.screenshot({ path: join(root, 'qa', out) });
}
for (const l of logs.slice(0, 40)) console.log(l);
console.log('saved', out, `(${Date.now() - t0}ms)`);
for (const t of timers) clearTimeout(t);
await browser.close();
server.close();
process.exit(0);
