// QA driver: open a screen, then run a script of steps against the live page.
//   node hardcount/tools/drive.mjs "<query>" script.json
// steps: { wait: ms } | { key: 'KeyK', hold?: ms } | { eval: 'js' } | { shot: 'name.png' }
//        | { until: 'js expr', timeout: ms } (poll until truthy)
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
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const [query = '', scriptPath] = process.argv.slice(2);
const steps = JSON.parse(await readFile(scriptPath, 'utf8'));
await mkdir(join(root, 'qa'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[qa]')) console.log(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}\n${e.stack}`));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/hardcount/index.html?${query}`);
for (const st of steps) {
  if (st.wait) await page.waitForTimeout(st.wait);
  if (st.key) {
    if (st.hold) { await page.keyboard.down(st.key); await page.waitForTimeout(st.hold); await page.keyboard.up(st.key); } else await page.keyboard.press(st.key);
  }
  if (st.until) {
    const end = Date.now() + (st.timeout || 20000);
    let ok = false;
    while (Date.now() < end) { try { ok = await page.evaluate(st.until); } catch { ok = false; } if (ok) break; await page.waitForTimeout(150); }
    console.log(`[until] ${st.until} → ${ok} @${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  if (st.eval) { try { const r = await page.evaluate(st.eval); console.log('[eval]', JSON.stringify(r)); } catch (e) { console.log('[eval error]', e.message); } }
  if (st.shot) await page.screenshot({ path: join(root, 'qa', st.shot) });
}
console.log(`done (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
await browser.close();
server.close();
process.exit(0);
