// Framing check: screenshots every named camera view of every place at several
// screen sizes, with a dialogue box open, so you can see what gets cut off.
//   node tools/views.mjs                       (all places, default sizes)
//   node tools/views.mjs --scenes cemetery --sizes 1366x657,1024x768
// Output: qa/views/<place>_<view>_<size>.png and a contact sheet per size.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : dflt);
const PLACES = { title: '', home: 'intro', market: 'intro', bakery: 'market', workshop: 'pan', plaza: 'ofrenda', cemetery: 'plaza', free: 'ofrenda' };
const scenes = opt('scenes', Object.keys(PLACES).join(',')).split(',');
const sizes = opt('sizes', '1366x657,1024x768,844x390').split(',').map((s) => s.split('x').map(Number));
const withDialog = !args.includes('--nodialog');
const onlyViews = opt('views', null)?.split(',');
const hq = args.includes('--hq');
const outDir = join(root, 'qa', 'views');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const made = {};
for (const scene of scenes) {
  const page = await browser.newPage({ viewport: { width: sizes[0][0], height: sizes[0][1] } });
  page.on('pageerror', (e) => { errors.push(`${scene}: ${e.message}`); console.log('[pageerror]', e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|GL Driver/.test(m.text())) errors.push(`${scene}: ${m.text()}`); });
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('marigold-path-save-v1', JSON.stringify({ settings: { lang: 'en', music: false, sfx: false } })); });
  const cheat = PLACES[scene] ? `&cheat=${PLACES[scene]}` : '';
  const q = scene === 'free' ? '' : `?scene=${scene}${cheat}&fast${hq ? '' : '&lowq'}`;
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html${q || `?cheat=ofrenda&fast${hq ? '' : '&lowq'}`}`);
  // let the place's opening play out (auto-advance dialogue, close cards)
  const views = await page.evaluate(async ({ scene }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const vis = (s) => { const e = document.querySelector(s); return e && !e.classList.contains('hidden'); };
    const until = async (fn, ms = 90000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await sleep(150); } return true; };
    await until(() => window.__game?.engine?.stage);
    const G = window.__game;
    window.__auto = true;
    setInterval(() => {
      if (!window.__auto) return;
      if (vis('#card')) { document.querySelector('#card .ok')?.click(); return; }
      if (vis('#dialog')) {
        const ch = [...document.querySelectorAll('#dialog .choices .choice')];
        if (ch.length) ch[ch.length - 1].click();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      }
    }, 200);
    if (scene === 'free') {
      G.startFree();
      await until(() => document.querySelector('#modal [data-k=familia]'));
      document.querySelector('#modal [data-k=familia]').click();
      const inp = document.querySelector('#modal .inp');
      inp.value = 'Ana'; inp.dispatchEvent(new Event('input'));
      document.querySelector('#modal [data-a=go]').click();
      await until(() => document.querySelector('#modal [data-a=done]'));
      document.querySelector('#modal [data-a=done]').click();
    }
    await until(() => G.sceneId === scene);
    await sleep(1500);
    await until(() => !vis('#dialog') && !vis('#card') && !G.busy && !G.engine.stage.busy, 60000);
    await sleep(500);
    window.__auto = false;
    return Object.keys(G.engine.stage.views || {});
  }, { scene });
  if (onlyViews) views.splice(0, views.length, ...views.filter((v) => onlyViews.includes(v)));
  console.log(scene, 'views:', views.join(', '));
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    for (const v of views) {
      await page.evaluate(({ v, withDialog }) => {
        const G = window.__game;
        const S = G.engine.stage;
        S.view(v, { dur: 0, back: false });
        G.engine.par.tx = G.engine.par.ty = G.engine.par.x = G.engine.par.y = 0;
        if (withDialog) G.ui.say([{ who: 'abuela', text: { en: 'This is a test line so you can see how much of the view the dialogue box covers.', es: 'Línea de prueba.' } }]);
      }, { v, withDialog });
      await page.waitForTimeout(hq ? 1600 : 700);
      const file = join(outDir, `${scene}_${v}_${w}x${h}.png`);
      await page.screenshot({ path: file });
      (made[`${w}x${h}`] ||= []).push(file);
      if (withDialog) await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); });
      await page.waitForTimeout(150);
    }
  }
  await page.close();
}
await browser.close();
server.close();
// one contact sheet per size
for (const [size, files] of Object.entries(made)) {
  try {
    execFileSync('montage', [...files.flatMap((f) => ['-label', f.split('/').pop().replace('.png', ''), f]), '-tile', '3x', '-geometry', '640x+4+4', '-pointsize', '16', join(outDir, `_sheet_${size}.jpg`)]);
  } catch (e) { console.log('montage failed', e.message); }
}
console.log(errors.length ? `${errors.length} error(s):\n${errors.join('\n')}` : 'no errors');
process.exit(0);
