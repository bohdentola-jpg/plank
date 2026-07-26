// Does tabbing away and back permanently degrade World.quality?
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const root = '/home/user/plank/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
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
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });

await page.goto(`http://127.0.0.1:${port}/hotel/index.html?fresh&dev`);
await page.waitForTimeout(600);
await page.locator('#boot').dispatchEvent('click');
await page.waitForTimeout(1200);
await page.locator('#t-new').dispatchEvent('click');
await page.waitForTimeout(400);
await page.locator('#s-start').dispatchEvent('click');
await page.waitForTimeout(3000);

// Make document.hidden scriptable so we can emulate tab switching precisely.
await page.evaluate(() => {
  window.__hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__hidden ? 'hidden' : 'visible') });
});

const q = () => page.evaluate(() => {
  const w = window.game.world;
  return { quality: w.quality, slow: w._slow, pr: w.renderer.getPixelRatio(), shadows: w.renderer.shadowMap.enabled };
});

console.log('baseline (3s of normal rendering):', JSON.stringify(await q()));
await page.waitForTimeout(4000);
console.log('after 4 more visible seconds:     ', JSON.stringify(await q()));

// Six short visits, each preceded by 20 s "in another tab".
for (let i = 1; i <= 6; i++) {
  await page.evaluate(() => { window.__hidden = true; });
  await page.waitForTimeout(20000);
  await page.evaluate(() => { window.__hidden = false; });
  await page.waitForTimeout(900);           // glance at the tab for under a second
  console.log(`after visit ${i} (20s away, 0.9s looking):`, JSON.stringify(await q()));
}

// Now stay for a long, comfortably fast stretch and see whether it ever recovers.
await page.waitForTimeout(15000);
console.log('after 15s of solid 60fps:         ', JSON.stringify(await q()));

await browser.close();
server.close();
process.exit(0);
