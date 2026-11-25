// QA screenshot harness: serves the repo root, opens a chroma page in headless
// Chromium, optionally runs JS / presses keys, and saves PNGs to chroma/qa/.
//   node chroma/tools/shot.mjs "qa.html?scene=stage" stage.png --wait 4000
//   node chroma/tools/shot.mjs "index.html?quick" battle.png --wait 8000 --eval "..."
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = fileURLToPath(new URL('../..', import.meta.url));
const qaDir = fileURLToPath(new URL('../qa/', import.meta.url));
await mkdir(qaDir, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const [page0 = 'index.html', out = 'shot.png', ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d; };
const wait = parseInt(opt('wait', '3000'), 10);
const width = parseInt(opt('w', '1280'), 10), height = parseInt(opt('h', '720'), 10);
const evals = rest.reduce((a, v, i) => (v === '--eval' ? [...a, rest[i + 1]] : a), []);
const series = opt('series', null);
const keys = opt('keys', null);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width, height } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`[page ${m.type()}]`, m.text().slice(0, 400)); else if (m.text().startsWith('[qa]')) console.log(m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')));
await page.goto(`http://127.0.0.1:${port}/chroma/${page0}`);
if (keys) for (const spec of keys.split(',')) {
  const [key, at] = spec.split('@');
  setTimeout(() => page.keyboard.press(key.trim()).catch(() => {}), parseInt(at || '0', 10));
}
await page.waitForTimeout(wait);
for (const e of evals) {
  try {
    const r = await page.evaluate(e);
    if (r !== undefined) console.log('[eval]', typeof r === 'string' ? r : JSON.stringify(r));
  } catch (err) { console.log('[eval error]', err.message); }
  await page.waitForTimeout(parseInt(opt('evalwait', '500'), 10));
}
if (series) {
  const [n, gap] = series.split('@').map(Number);
  for (let i = 0; i < n; i++) { await page.screenshot({ path: join(qaDir, out.replace('.png', `_${i}.png`)) }); await page.waitForTimeout(gap); }
} else await page.screenshot({ path: join(qaDir, out) });
console.log('saved', out);
await browser.close();
server.close();
process.exit(0);
