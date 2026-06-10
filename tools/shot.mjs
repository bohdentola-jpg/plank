// Screenshot harness: serves the repo, drives the game in headless Chromium,
// captures frames into qa/. Usage:
//   node tools/shot.mjs "?gallery" gallery.png --wait 2500
//   node tools/shot.mjs "?quick" game.png --wait 6000 --keys "Space@4000"
//   node tools/shot.mjs "" title.png --eval "..." --series 3@1500
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

const [query = '', out = 'shot.png', ...rest] = process.argv.slice(2);
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

await page.goto(`http://127.0.0.1:${port}/index.html${query}`);

if (keys) {
  for (const spec of keys.split(',')) {
    const [key, atRaw] = spec.split('@');
    const at = parseInt(atRaw || '0', 10);
    setTimeout(() => page.keyboard.press(key.trim()).catch(() => {}), at);
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
