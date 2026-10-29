// Full-story autopilot: plays the whole game headlessly from the title screen to
// the ending, taking a screenshot at each beat. Usage:
//   node tools/story.mjs            (low quality, fast clock)
//   node tools/story.mjs --hq       (full quality screenshots; much slower)
//   node tools/story.mjs --lang es
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
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const args = process.argv.slice(2);
const hq = args.includes('--hq');
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'en';
await mkdir(join(root, 'qa', 'story'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: hq ? { width: 1366, height: 768 } : { width: 1024, height: 600 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => {
  const txt = m.text();
  if (txt.startsWith('[story]')) console.log(txt);
  else if (m.type() === 'error' && !/GPU stall|GL Driver/.test(txt)) { errors.push(txt); console.log('[console.error]', txt); }
});
page.on('dialog', (d) => d.accept());
await page.addInitScript((l) => { localStorage.clear(); localStorage.setItem('marigold-path-save-v1', JSON.stringify({ settings: { lang: l, music: false, sfx: false } })); }, lang);
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?fast${hq ? '' : '&lowq'}`);

// screenshots on request from the page
let shots = 0;
await page.exposeFunction('__shot', async (name) => {
  await page.screenshot({ path: join(root, 'qa', 'story', `${String(++shots).padStart(2, '0')}_${name}.png`) });
});

const result = await page.evaluate(async () => {
  const log = (...a) => console.log('[story]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, what, ms = 180000) => {
    const t0 = Date.now();
    while (!fn()) {
      if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
      await sleep(150);
    }
  };
  await until(() => window.__game, 'game');
  const G = window.__game;
  const S = () => G.engine.stage;
  const vis = (s) => { const e = document.querySelector(s); return e && !e.classList.contains('hidden'); };
  // autopilot: advance dialogue, pick choices (first time: first option; repeated menu: last option), close cards
  const seenQ = new Map();
  let autopilot = true;
  setInterval(() => {
    if (!autopilot) return;
    if (vis('#card') && document.querySelector('#card .ok')) { document.querySelector('#card .ok').click(); return; }
    if (vis('#dialog')) {
      const ch = [...document.querySelectorAll('#dialog .choices .choice')];
      if (ch.length) {
        const q = document.querySelector('#dialog .text').textContent;
        const n = seenQ.get(q) || 0;
        seenQ.set(q, n + 1);
        const pick = window.__pick ? window.__pick(q, ch.map((c) => c.textContent), n) : (n === 0 ? 0 : ch.length - 1);
        ch[Math.min(pick, ch.length - 1)].click();
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })), 40);
      }
    }
  }, 220);
  const idle = () => !vis('#dialog') && !vis('#card') && !G.busy;
  const settle = async (ms = 500) => { await sleep(ms); await until(idle, 'idle'); };
  // click one live mini-game hotspot (like a player would)
  const clickNested = () => {
    const h = G.engine.hotspots.find((x) => x.nested && x.enabled() && !(x.label?.() || '').startsWith('Move'));
    if (h) h.onClick({ point: null });
    return !!h;
  };
  const shot = async (name) => { await window.__shot(name); };

  // ---- title → home intro
  await until(() => G.sceneId === 'title', 'title');
  await sleep(1500);
  await shot('title');
  S().start();
  await until(() => G.sceneId === 'home', 'home');
  await sleep(1200);
  await shot('home_intro');
  await until(() => G.has('intro'), 'intro flag');
  await settle(800);
  await shot('home_explore');
  log('intro done, cards:', G.state.cards.join(','));
  // explore a few things at home
  for (const f of ['talkChispa', 'talkNico', 'talkMama', 'talkPhoto']) { await S()[f](); await settle(200); }

  // ---- market
  G.go('market');
  await until(() => G.sceneId === 'market' && !G.busy, 'market');
  await settle(800);
  await shot('market');
  for (const f of ['chela', 'tomas', 'fruit', 'mago', 'paper', 'pottery']) { await S()[f](); await settle(200); }
  await shot('market_done');
  log('market bag:', G.state.bag.join(','));

  // ---- bakery
  G.go('bakery');
  await until(() => G.sceneId === 'bakery' && !G.busy, 'bakery');
  await settle(600);
  await shot('bakery');
  const baking = S().bake();
  await sleep(1500);
  await until(idle, 'ingredients');
  await shot('bakery_ingredients');
  while (!S().kneading) { clickNested(); await sleep(700); }
  await settle(300);
  S().kneading.resolve();
  await until(() => S().boneMode, 'bones');
  S().addBone(0); S().addBone(Math.PI / 2); S().addBone(Math.PI / 4); S().addBone(-Math.PI / 4);
  await shot('bakery_bones');
  S().boneMode.resolve();
  await baking;
  await settle(300);
  await shot('bakery_done');
  log('pan:', JSON.stringify(G.state.pan));

  // ---- workshop
  G.go('workshop');
  await until(() => G.sceneId === 'workshop' && !G.busy, 'workshop');
  await settle(600);
  await shot('workshop');
  const pap = S().papel();
  await until(() => document.querySelector('#modal .board'), 'papel panel');
  await sleep(500);
  await shot('papel_choose');
  document.querySelector('#modal .ctrl .btn.rosa').click();
  await sleep(500);
  const { PATTERNS } = await import('./src/games/papel.js');
  const cv = document.querySelector('#modal canvas.board');
  for (const sh of PATTERNS.calavera.shapes) {
    for (let i = 0; i < sh.taps; i++) {
      const r = cv.getBoundingClientRect();
      cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + sh.x / 360 * r.width, clientY: r.top + sh.y / 450 * r.height, bubbles: true }));
      await sleep(40);
    }
  }
  await sleep(1600);
  await shot('papel_lifted');
  [...document.querySelectorAll('#modal .ctrl .btn')].pop().click();
  await pap;
  await settle(400);
  await shot('workshop_papel');
  const dec = S().decorate();
  await until(() => document.querySelector('#tray [data-a=done]'), 'skull tools');
  const W = S();
  W.paintAt({ x: 220, y: 90 }); W.brush.mode = 'flower'; W.paintAt({ x: 300, y: 80 }); W.paintAt({ x: 180, y: 200 });
  W.brush.mode = 'foil'; W.brush.color = '#16b3ac'; W.paintAt({ x: 0, y: 0 });
  W.writeName('BETO');
  await sleep(600);
  await shot('skull');
  document.querySelector('#tray [data-a=done]').click();
  await dec;
  await settle(400);
  log('workshop flags:', G.has('papel'), G.has('skull'));

  // ---- home: build the ofrenda (choose 3 levels)
  window.__pick = (q, opts, n) => (/levels|niveles/i.test(q) ? 2 : (n === 0 ? 0 : opts.length - 1));
  G.go('home');
  await until(() => G.sceneId === 'home' && S().builder && document.querySelector('#tray .titem'), 'builder tray');
  await settle(300);
  await shot('build_start');
  const b = S().builder;
  const plan = [['foto', 2, 0, 0], ['agua', 1, -0.3, 0], ['sal', 1, 0.3, 0], ['velas', 0, -0.75, 0.25], ['velas', 0, 0.75, 0.25], ['velas', 0, -0.4, 0.3], ['velas', 0, 0.4, 0.3],
    ['cempasuchil', 0, -0.6, 0.1], ['cempasuchil', 0, 0.6, 0.1], ['pan', 1, 0, 0.05], ['fruta', 0, 0.05, 0.2], ['calavera', 2, 0.35, 0], ['guitarra', 0, -0.25, 0.05],
    ['copal', 0, 0.2, 0.32], ['tamales', 1, -0.55, 0.05], ['cafe', 1, 0.55, 0.05], ['xolo', 2, -0.35, 0], ['arco', 0, 0, 0], ['papel', 0, 0, 0]];
  for (const [id, tier, x, z] of plan) {
    if (!b.pick(id)) { log('could not pick', id); continue; }
    if (b.holding) {
      const tr = b.tiers[Math.min(tier, b.tiers.length - 1)];
      b.holding.tier = tr;
      b.holding.obj.visible = true;
      b.holding.obj.position.set(x, tr.y, Math.min(tr.z1, Math.max(tr.z0, tr.z0 + (tr.z1 - tr.z0) * (0.5 + z))));
      b.place();
    }
    await sleep(250);
    await until(idle, 'after place');
  }
  await sleep(600);
  await shot('build_full');
  await until(() => !document.querySelector('#tray [data-a=done]')?.disabled, 'wishes met');
  document.querySelector('#tray [data-a=done]').click();
  while (!S().petalMode) { clickNested(); await sleep(600); }
  await settle(300);
  await shot('petal_path');
  S().petals.count = S().petals.userData.total;
  S().petalDone();
  await sleep(4000);
  await shot('finale');
  await until(() => G.sceneId === 'plaza', 'plaza', 400000);
  log('ofrenda saved:', JSON.stringify(G.state.ofrenda).slice(0, 120));

  // ---- plaza
  window.__pick = (q, opts, n) => {
    if (/learn about|aprender/i.test(q)) return n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : opts.length - 1;
    if (/ready to go|Nos vamos/i.test(q)) return 0;
    return n === 0 ? 0 : opts.length - 1;
  };
  await settle(800);
  await shot('plaza');
  await S().mateo(); await settle(200);
  await S().catrinas(); await settle(200);
  await S().community(); await settle(200);
  await S().erendira(); await settle(200);
  await shot('plaza_casa');
  const pp = S().pancho();
  await until(() => document.querySelector('#modal .poem'), 'poem');
  await sleep(500);
  await shot('poem');
  document.querySelector('#modal [data-a=done]').click();
  await pp;
  await until(() => G.sceneId === 'cemetery', 'cemetery', 400000);

  // ---- cemetery
  await sleep(1500);
  await shot('cemetery');
  while (!S().washing) { clickNested(); await sleep(600); }
  await settle(200);
  S().washing.resolve();
  await sleep(1500);
  for (let i = 0; i < 40 && !G.has('panteon'); i++) { clickNested(); await sleep(700); if (i === 12) await shot('cemetery_candles'); }
  await sleep(1000);
  await shot('vigil');
  await until(() => G.sceneId === 'home' && G.has('ending'), 'ending', 400000);
  await sleep(800);
  await shot('ending');
  autopilot = false;
  return { flags: G.state.flags, cards: G.state.cards.length, petals: G.state.petals, bag: G.state.bag, poems: G.state.poems.length };
});
console.log('RESULT', JSON.stringify(result));
console.log(errors.length ? `${errors.length} error(s):\n${errors.join('\n')}` : 'no errors');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
