// Screenshot harness: serves the game folder, drives it in headless Chromium,
// saves frames into qa/. Usage:
//   node tools/shot.mjs "?scene=home" home.png --wait 3000
//   node tools/shot.mjs "" title.png --eval "window.__game.go('market')" --series 3@1500
//   node tools/shot.mjs "?scene=home" click.png --click 640,400@2500
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// playwright may be global (QA box) or local (npm install): require() finds both
const { chromium } = createRequire(import.meta.url)('playwright');

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
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

const [query = '', out = 'shot.png', ...rest] = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : dflt;
};
const wait = parseInt(opt('wait', '2500'), 10);
const width = parseInt(opt('w', '1366'), 10);
const height = parseInt(opt('h', '768'), 10);
const evalJs = opt('eval', null);
const evalAt = parseInt(opt('evalat', '0'), 10);
const clicks = opt('click', null);  // "640,400@2500;700,300@4000"
const series = opt('series', null); // "4@1200" → 4 shots every 1200ms
const page_ = opt('page', 'index.html');

await mkdir(join(root, 'qa'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width, height } });
page.on('console', (m) => {
  if (!['error', 'warning'].includes(m.type()) || /GPU stall|GL Driver/.test(m.text())) return;
  console.log(`[page ${m.type()}]`, m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://127.0.0.1:${port}/${page_}${query}`);
const t0 = Date.now();
const timers = [];
if (clicks) {
  for (const spec of clicks.split(';')) {
    const [xy, atRaw] = spec.split('@');
    const [x, y] = xy.split(',').map(Number);
    timers.push(new Promise((r) => setTimeout(() => page.mouse.click(x, y).catch(() => {}).then(r), parseInt(atRaw || '0', 10))));
  }
}
if (evalJs && evalAt) {
  timers.push(new Promise((r) => setTimeout(async () => {
    const result = await page.evaluate(evalJs).catch((e) => `ERR ${e.message}`);
    if (result !== undefined) console.log('[eval]', JSON.stringify(result));
    r();
  }, evalAt)));
}
await page.waitForTimeout(wait);
await Promise.all(timers);
if (evalJs && !evalAt) {
  const result = await page.evaluate(evalJs).catch((e) => `ERR ${e.message}`);
  if (result !== undefined) console.log('[eval]', JSON.stringify(result));
  await page.waitForTimeout(400);
}
if (series) {
  const [nRaw, gapRaw] = series.split('@');
  const n = parseInt(nRaw, 10), gap = parseInt(gapRaw || '1000', 10);
  for (let i = 0; i < n; i++) {
    await page.screenshot({ path: join(root, 'qa', `${out.replace('.png', '')}_${i}.png`) });
    await page.waitForTimeout(gap);
  }
} else {
  await page.screenshot({ path: join(root, 'qa', out) });
}
console.log('saved', out, `(${Date.now() - t0}ms)`);
await browser.close();
server.close();
process.exit(0);
