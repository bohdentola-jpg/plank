// Autopilot for everything outside the main story: the map, every Book chapter,
// the menu and language switch, a full Lotería game, and free mode end-to-end.
//   node tools/extras.mjs [--hq]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const hq = process.argv.includes('--hq');
await mkdir(join(root, 'qa', 'extras'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: hq ? { width: 1366, height: 768 } : { width: 1024, height: 600 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => {
  const txt = m.text();
  if (txt.startsWith('[x]')) console.log(txt);
  else if (m.type() === 'error' && !/GPU stall|GL Driver/.test(txt)) { errors.push(txt); console.log('[console.error]', txt); }
});
page.on('dialog', (d) => d.accept());
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('marigold-path-save-v1', JSON.stringify({ settings: { lang: 'en', music: false, sfx: false } })); });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?scene=home&cheat=ofrenda&fast${hq ? '' : '&lowq'}`);
let n = 0;
await page.exposeFunction('__shot', async (name) => { await page.screenshot({ path: join(root, 'qa', 'extras', `${String(++n).padStart(2, '0')}_${name}.png`) }); });
// window.print would open a dialog in a real browser; stub it
await page.evaluate(() => { window.print = () => console.log('[x] print called'); });

const res = await page.evaluate(async () => {
  const log = (...a) => console.log('[x]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, what, ms = 120000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error(`timeout: ${what}`); await sleep(150); } };
  await until(() => window.__game && window.__game.sceneId === 'home', 'home');
  const G = window.__game;
  const vis = (s) => { const e = document.querySelector(s); return e && !e.classList.contains('hidden'); };
  const auto = setInterval(() => {
    if (vis('#card')) { document.querySelector('#card .ok')?.click(); return; }
    if (vis('#dialog')) {
      const ch = [...document.querySelectorAll('#dialog .choices .choice')];
      if (ch.length) ch[0].click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    }
  }, 220);
  await sleep(1500);
  await until(() => !vis('#dialog'), 'quiet');
  await window.__shot('home_done_ofrenda');
  // map
  document.getElementById('btn-map').click();
  await until(() => document.querySelector('.townmap .loc img[src^="data:"]'), 'map images');
  await sleep(400);
  await window.__shot('map');
  log('map locations', document.querySelectorAll('.townmap .loc').length, 'locked', document.querySelectorAll('.townmap .loc.locked').length);
  document.querySelector('#modal .phead .x').click();
  // book: every chapter
  document.getElementById('btn-book').click();
  await until(() => document.querySelector('.book .toc button'), 'book');
  const chapters = [...document.querySelectorAll('.book .toc button')];
  for (const b of chapters) {
    b.click();
    await sleep(b.dataset.id === 'tarjetas' ? 2500 : 300);
    if (['que', 'ofrenda', 'mexico', 'tarjetas', 'glosario', 'fuentes', 'mitos'].includes(b.dataset.id)) await window.__shot(`book_${b.dataset.id}`);
    if (b.dataset.id === 'mexico') {
      document.querySelector('.mapfig .pin').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(300);
      document.querySelector('.mapinfo button')?.click();
      await sleep(800);
      await until(() => !vis('#card'), 'card closed');
    }
  }
  // Spanish word popover
  chapters[0].click();
  await sleep(300);
  document.querySelector('.book .page .es').click();
  await sleep(300);
  await window.__shot('es_popover');
  log('popover', document.getElementById('es-pop').textContent.slice(0, 60));
  document.querySelector('#modal .phead .x').click();
  // menu + language
  document.getElementById('btn-menu').click();
  await until(() => document.querySelector('#modal [data-a=lang]'), 'menu');
  await window.__shot('menu');
  document.querySelector('#modal [data-a=lang]').click();
  await sleep(500);
  log('lang now', document.documentElement.lang, document.getElementById('place-name').textContent);
  await window.__shot('home_es');
  G.toggleLang();
  // lotería: play it to a win
  await G.openLoteria();
  await until(() => document.querySelectorAll('.loteria .lcard').length === 16, 'lotería board');
  await sleep(800);
  await window.__shot('loteria');
  const { RIDDLES } = await import('./src/content/quiz.js');
  for (let i = 0; i < 16 && document.querySelector('[data-a=win]')?.disabled !== false; i++) {
    const riddle = document.querySelector('.caller .riddle').textContent;
    const id = Object.keys(RIDDLES).find((k) => riddle.includes(RIDDLES[k].en.slice(0, 30)));
    const el = document.querySelector(`.loteria .lcard[data-id="${id}"]`);
    if (!el) { log('riddle not on board?', riddle.slice(0, 40)); break; }
    el.click();
    await sleep(1100);
  }
  await window.__shot('loteria_line');
  document.querySelector('[data-a=win]').click();
  await until(() => document.querySelector('.cert'), 'certificate');
  document.querySelector('#modal .inp').value = 'Ana';
  document.querySelector('#modal .inp').dispatchEvent(new Event('input'));
  await sleep(300);
  await window.__shot('certificate');
  document.querySelector('#modal [data-a=print]').click();
  document.querySelector('#modal .phead .x').click();
  // free mode
  await G.startFree();
  await until(() => document.querySelector('#modal .bigchoice'), 'free setup');
  document.querySelector('#modal [data-k=mascota]').click();
  await sleep(200);
  const inp = document.querySelector('#modal .inp');
  inp.value = 'Canela';
  inp.dispatchEvent(new Event('input'));
  await window.__shot('free_setup');
  document.querySelector('#modal [data-a=go]').click();
  await until(() => document.querySelector('#modal canvas.board'), 'drawing pad');
  document.querySelector('#modal [data-y=paw]').click();
  const cv = document.querySelector('#modal canvas.board');
  const r = cv.getBoundingClientRect();
  cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + 40, clientY: r.top + 40, pointerId: 1, bubbles: true }));
  cv.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 120, clientY: r.top + 90, pointerId: 1, bubbles: true }));
  cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
  await window.__shot('free_draw');
  document.querySelector('#modal [data-a=done]').click();
  await until(() => G.sceneId === 'free' && G.engine.stage.builder?.tiers.length, 'free scene');
  await until(() => document.querySelector('#tray .titem'), 'free tray');
  const b = G.engine.stage.builder;
  for (const [id, tier, x] of [['foto', 0, 0], ['plato', 0, -0.5], ['vela', 0, -0.75], ['vela', 0, 0.75], ['cempasuchil', 0, 0.45], ['agua', 0, -0.25], ['balon', 0, 0.25], ['papel', 0, 0], ['arco', 0, 0]]) {
    if (b.pick(id) && b.holding) { const tr = b.tiers[tier]; b.holding.tier = tr; b.holding.obj.visible = true; b.holding.obj.position.set(x, tr.y, (tr.z0 + tr.z1) / 2); b.place(); }
    await sleep(250);
    await until(() => !vis('#card') && !vis('#dialog'), 'idle');
  }
  document.querySelector('#tray [data-a=light]').click();
  await sleep(2500);
  await window.__shot('free_lit');
  document.querySelector('#tray [data-a=photo]').click();
  await sleep(800);
  clearInterval(auto);
  return { cards: G.state.cards.length, petals: G.state.petals, scene: G.sceneId, wins: G.state.loteriaWins, name: G.state.playerName };
});
console.log('RESULT', JSON.stringify(res));
console.log(errors.length ? `${errors.length} error(s):\n${errors.join('\n')}` : 'no errors');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
