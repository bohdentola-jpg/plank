// Screenshot harness: serves the repo, drives a game in headless Chromium,
// captures frames into qa/. The first argument is a page path plus an optional
// query; bare "?..." means the launcher at the repo root. Usage:
//   node tools/shot.mjs "varsity/?gallery" gallery.png --wait 2500
//   node tools/shot.mjs "varsity/?quick" game.png --wait 6000 --keys "Space@4000"
//   node tools/shot.mjs "hotel/?fresh" lobby.png --click "#hud-day@1200"
//   node tools/shot.mjs "" library.png --eval "..." --series 3@1500
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
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

const [target = '', out = 'shot.png', ...rest] = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : dflt;
};
const qAt = target.indexOf('?');
let pagePath = qAt >= 0 ? target.slice(0, qAt) : target;
const query = qAt >= 0 ? target.slice(qAt) : '';
if (!pagePath || pagePath.endsWith('/')) pagePath += 'index.html';
const wait = parseInt(opt('wait', '2500'), 10);
const width = parseInt(opt('w', '1366'), 10);
const height = parseInt(opt('h', '820'), 10);
const evalJs = opt('eval', null);
const keys = opt('keys', null);     // "Space@4000,Digit1@5000"
const clicks = opt('click', null);  // "#btn@1200,.card@2400"
const series = opt('series', null); // "4@1200" → 4 shots every 1200ms

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://127.0.0.1:${port}/${pagePath}${query}`);

// Keys and clicks run on one sorted timeline so each action completes before
// the next is issued — concurrent Playwright actions fight over actionability.
const timeline = [];
const parse = (spec, kind) => {
  for (const item of spec.split(',')) {
    const [what, atRaw] = item.split('@');
    timeline.push({ at: parseInt(atRaw || '0', 10), kind, what: what.trim() });
  }
};
if (keys) parse(keys, 'key');
if (clicks) parse(clicks, 'click');
timeline.sort((a, b) => a.at - b.at);

let clockAt = 0;
for (const ev of timeline) {
  if (ev.at > clockAt) { await page.waitForTimeout(ev.at - clockAt); clockAt = ev.at; }
  if (ev.kind === 'key') {
    await page.keyboard.press(ev.what).catch((e) => console.log('[key miss]', ev.what, e.message.split('\n')[0]));
  } else {
    // dispatchEvent, not click(): under software WebGL the compositor is too
    // busy for Playwright's hit test to ever resolve.
    await page.locator(ev.what).first().dispatchEvent('click', { timeout: 8000 })
      .catch((e) => console.log('[click miss]', ev.what, e.message.split('\n')[0]));
  }
}
if (wait > clockAt) await page.waitForTimeout(wait - clockAt);
if (evalJs) {
  const result = await page.evaluate(evalJs);
  if (result !== undefined) console.log('[eval]', JSON.stringify(result));
}

await mkdir(join(root, 'qa'), { recursive: true });

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
