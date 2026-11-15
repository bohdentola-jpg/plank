// Screenshot helper for checking the game by eye.
//   node brawl/tools/shot.mjs "<query string>" out.png [frames to wait] [keys...]
// Serves the repo on a throwaway port, opens brawl/index.html?<query>, optionally
// presses keys, lets the game run, and saves a PNG.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.png': 'image/png', '.json': 'application/json' };
export function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const file = path.join(root, p);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rsp.writeHead(404); rsp.end('nope'); return; }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [query = '', out = 'shot.png', waitFrames = '120', ...keys] = process.argv.slice(2);
  const srv = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 880, height: 680 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto(`http://127.0.0.1:${srv.address().port}/brawl/index.html?${query}`);
  await page.waitForTimeout(600);
  for (const k of keys) {
    const [key, hold] = k.split(':');
    if (key === 'wait') { await page.waitForTimeout(+hold); continue; }
    await page.keyboard.down(key); await page.waitForTimeout(+hold || 60); await page.keyboard.up(key); await page.waitForTimeout(60);
  }
  await page.waitForTimeout((+waitFrames / 60) * 1000);
  await page.locator('#game').screenshot({ path: out });
  if (errors.length) console.log(errors.slice(0, 12).join('\n')); else console.log('no console errors');
  await browser.close(); srv.close();
}
