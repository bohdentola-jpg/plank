// QA: a screenshot at every camera cut. Opens /coldboot/index.html?<query> in
// headless Chromium and, each time any Director cuts to a new shot, waits for
// the shot to settle and saves qa/<prefix>/<n>.jpg, labelled with the line being
// spoken. Writes qa/<prefix>/index.json; tools/contact.py makes contact sheets.
//   node coldboot/tools/shotlog.mjs "screen=warehouse&ff=1" wh --secs 600
//   node coldboot/tools/shotlog.mjs "screen=town&ff=1&day=2" d2 --secs 1500 --autopilot
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.webp': 'image/webp' };
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

const [query = '', prefix = 'cuts', ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d; };
const secs = +opt('secs', '600');
const autopilot = rest.includes('--autopilot');
const outDir = join(root, 'qa', prefix);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (m.text().startsWith('[ap]')) console.log(m.text()); });
await page.addInitScript(() => { window.__qaAuto = true; });
await page.goto(`http://127.0.0.1:${port}/coldboot/index.html?${query}`);
const t0 = Date.now();
if (autopilot) {
  page.evaluate(() => import('/coldboot/tools/autopilot.js').then((m) => m.run(100000))).catch(() => {});
}
const index = [];
let seen = 0, n = 0;
while (Date.now() - t0 < secs * 1000) {
  await new Promise((r) => setTimeout(r, 250));
  let st;
  try {
    st = await page.evaluate(() => {
      const g = window.__game;
      return { cuts: window.__cuts || 0, at: window.__cutAt || 0, dur: window.__cutDur || 0, now: performance.now(), screen: g?.screen?.name };
    });
  } catch { continue; }
  if (st.screen === 'title' && Date.now() - t0 > 20000) break;
  if (st.cuts === seen) continue;
  // settle: past the move (if any) and a beat more
  if (st.now - st.at < Math.max(700, st.dur * 1000 + 350)) continue;
  seen = st.cuts;
  n++;
  const file = `${String(n).padStart(3, '0')}.jpg`;
  try {
    await page.screenshot({ path: join(outDir, file), type: 'jpeg', quality: 70, timeout: 120000 });
  } catch (e) {
    console.log(`[cut ${n}] screenshot failed (${String(e.message || e).split('\n')[0]}); carrying on`);
    n--;
    continue;
  }
  const info = await page.evaluate(async () => {
    const G = window.__cb?.G;
    const sub = (await import('/coldboot/src/audio/voice.js')).voice.subtitle;
    return {
      screen: window.__game?.screen?.name,
      line: sub ? { who: sub.who, en: sub.en } : null,
      day: G?.state?.day, hour: G?.state?.hour?.toFixed?.(2), obj: G?.hud?.objective?.text || null,
      dof: window.__game?.renderer?.dof ? +window.__game.renderer.dof.focus.toFixed(2) : null,
    };
  }).catch(() => ({}));
  index.push({ n, file, t: ((Date.now() - t0) / 1000).toFixed(0), ...info });
  console.log(`[cut ${n}] ${info.screen} d${info.day ?? '-'} ${info.line ? info.line.who + ': ' + info.line.en.slice(0, 70) : ''}`);
  await writeFile(join(outDir, 'index.json'), JSON.stringify({ query, errors, index }, null, 1));
}
await writeFile(join(outDir, 'index.json'), JSON.stringify({ query, errors, index }, null, 1));
console.log(`${n} cuts, ${errors.length} errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 5).join(' | ') : ''}`);
await browser.close();
server.close();
