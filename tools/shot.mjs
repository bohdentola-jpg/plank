// Screenshot harness: serves the repo, drives a game in headless Chromium,
// captures frames into qa/. The first argument is a page (plus query) inside the
// library — the launcher is index.html, the games are varsity.html and melee.html.
// Usage:
//   node tools/shot.mjs "" kiosk.png --wait 1200
//   node tools/shot.mjs "melee.html?quick" fight.png --wait 6000 --keys "KeyJ@4000"
//   node tools/shot.mjs "varsity.html?gallery" gallery.png --wait 2500
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('nope');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const [pageArg = '', out = 'shot.png', ...rest] = process.argv.slice(2);
// bare query strings still mean the launcher; anything else is a page path
const target = pageArg.startsWith('?') || pageArg === '' ? `index.html${pageArg}` : pageArg;
const opt = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : dflt;
};
const wait = parseInt(opt('wait', '2500'), 10);
const width = parseInt(opt('w', '1366'), 10);
const height = parseInt(opt('h', '820'), 10);
const evalJs = opt('eval', null);
const keys = opt('keys', null);     // "Space@4000,Digit1@5000"
const series = opt('series', null); // "4@1200" → 4 shots every 1200ms

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://127.0.0.1:${port}/${target}`);

if (keys) {
  // hold each key for ~140 ms: the length of a real keypress, and long enough
  // for the game's 60 Hz input poll to see it either way
  for (const spec of keys.split(',')) {
    const [key, atRaw] = spec.split('@');
    const [atStr, holdStr] = (atRaw || '0').split(':');
    const at = parseInt(atStr, 10);
    const hold = parseInt(holdStr || '140', 10);
    const code = key.trim();
    setTimeout(() => {
      page.keyboard.down(code).catch(() => {});
      setTimeout(() => page.keyboard.up(code).catch(() => {}), hold);
    }, at);
  }
}
await page.waitForTimeout(wait);
if (evalJs) {
  const result = await page.evaluate(evalJs);
  if (result !== undefined) console.log('[eval]', JSON.stringify(result));
}

if (series) {
  const [nRaw, gapRaw] = series.split('@');
  const n = parseInt(nRaw, 10), gap = parseInt(gapRaw || '1000', 10);
  for (let i = 0; i < n; i++) {
    await page.screenshot({ path: `qa/${out.replace('.png', '')}_${i}.png` });
    await page.waitForTimeout(gap);
  }
} else {
  await page.screenshot({ path: `qa/${out}` });
}
console.log('saved', out);
await browser.close();
server.close();
process.exit(0);
