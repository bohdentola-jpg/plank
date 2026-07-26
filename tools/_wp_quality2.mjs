// Isolate the fps sample that checkQuality() takes on the first frame back from
// a hidden tab: is the hidden interval charged to the frame rate?
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const root = '/home/user/plank/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://127.0.0.1:${port}/hotel/index.html?fresh&dev`);
await page.waitForTimeout(600);
await page.locator('#boot').dispatchEvent('click');
await page.waitForTimeout(1200);
await page.locator('#t-new').dispatchEvent('click');
await page.waitForTimeout(400);
await page.locator('#s-start').dispatchEvent('click');
await page.waitForTimeout(2500);

await page.evaluate(() => {
  window.__hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden });
  const w = window.game.world;
  w.pinQuality = true;                 // freeze quality so samples keep flowing unchanged
  w.__samples = [];
  const orig = w.checkQuality.bind(w);
  w.checkQuality = function () {
    const atBefore = w._fpsAt, nBefore = w._fpsN || 0;
    orig();
    if (w._fpsAt !== atBefore) {
      const elapsed = (w._fpsAt - atBefore) / 1000;
      w.__samples.push({
        reportedFps: +((nBefore + 1) / elapsed).toFixed(2),
        frames: nBefore + 1,
        wallSecs: +elapsed.toFixed(2),
        visibleSecs: +(w.__visible / 1000).toFixed(2),
        trueFps: +((nBefore + 1) / (w.__visible / 1000)).toFixed(2),
      });
      w.__visible = 0;
    }
  };
  // Track how much of the window the page was actually rendering for.
  w.__visible = 0;
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    if (!window.__hidden) w.__visible += now - last;
    last = now;
  }, 20);
});

const dump = async (label) => {
  const s = await page.evaluate(() => { const a = window.game.world.__samples.slice(); window.game.world.__samples.length = 0; return a; });
  for (const x of s) console.log(label, JSON.stringify(x));
};

await page.waitForTimeout(7000);
await dump('visible-only  ');

for (let i = 1; i <= 3; i++) {
  await page.evaluate(() => { window.__hidden = true; });
  await page.waitForTimeout(20000);
  await page.evaluate(() => { window.__hidden = false; });
  await page.waitForTimeout(1200);
  await dump(`after-away-${i} `);
}

await browser.close();
server.close();
process.exit(0);
