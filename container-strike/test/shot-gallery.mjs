// Screenshot the model gallery. Usage: node container-strike/test/shot-gallery.mjs out.png [ids]
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, resolve } from 'path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const out = process.argv[2] || 'gallery.png';
const ids = process.argv[3] || '';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const body = await readFile(join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    res.writeHead(200, { 'content-type': MIME[extname(req.url.split('?')[0])] || 'text/plain' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/container-strike/test/gallery.html${ids ? '?ids=' + ids : ''}`);
await page.waitForFunction(() => window.__galleryReady, null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
server.close();
if (errors.length) { console.log('ERRORS:', errors.join(' | ')); process.exit(1); }
console.log('saved', out);
