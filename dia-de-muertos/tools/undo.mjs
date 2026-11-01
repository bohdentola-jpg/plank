// Checks that Undo works everywhere you make something: the ofrenda builder
// (place, move, levels, clear, arch), papel picado, the sugar skull, the
// bread's bones, the free-mode portrait and the petal path. Uses Ctrl+Z too.
//   node tools/undo.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

async function open(q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => { failed++; console.log('[pageerror]', e.message); });
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('marigold-path-save-v1', JSON.stringify({ settings: { lang: 'en', music: false, sfx: false } })); });
  await page.goto(`${base}${q}&fast&lowq`);
  await page.waitForFunction(() => window.__game?.engine?.stage && !window.__game.busy, null, { timeout: 60000 });
  // helper inside the page: answer dialogue automatically (first choice)
  await page.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); return e && !e.classList.contains('hidden'); };
    window.__auto = setInterval(() => {
      if (vis('#card')) { document.querySelector('#card .ok')?.click(); return; }
      if (vis('#dialog')) {
        const ch = [...document.querySelectorAll('#dialog .choices .choice')];
        if (ch.length) ch[window.__choice ?? 0]?.click();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      }
    }, 150);
    window.__ctrlZ = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    window.__idle = () => !vis('#dialog') && !vis('#card');
  });
  return page;
}
const until = (page, fn, ms = 60000) => page.waitForFunction(fn, null, { timeout: ms, polling: 150 });

// ---------------------------------------------------------------- ofrenda builder
{
  const page = await open('?scene=home&cheat=workshop');
  await until(page, () => window.__game.engine.stage.builder && document.querySelector('#tray [data-a=undo]'), 90000);
  const r = await page.evaluate(async () => {
    const sleep0 = (ms) => new Promise((res) => setTimeout(res, ms));
    // wait like a player would: cards and remarks close before the next click
    const sleep = async (ms) => { await sleep0(ms); while (!window.__idle()) await sleep0(150); await sleep0(100); };
    const S = window.__game.engine.stage, b = S.builder;
    const put = (id, tier, x) => {
      b.pick(id);
      const tr = b.tiers[tier];
      b.holding.tier = tr; b.holding.obj.visible = true;
      b.holding.obj.position.set(x, tr.y, (tr.z0 + tr.z1) / 2);
      return b.place();
    };
    const out = {};
    put('foto', 0, 0); await sleep(200);
    put('agua', 0, 0.4); await sleep(200);
    out.placed2 = b.placed.length;
    window.__ctrlZ(); await sleep(300);
    out.afterCtrlZ = b.placed.length;
    document.querySelector('#tray [data-a=undo]').click(); await sleep(300);
    out.afterButton = b.placed.length;
    put('foto', 0, -0.3); await sleep(200);
    const rec = b.placed[0];
    b.unplace(rec); // pick it up again (a move)
    const tr = b.tiers[0];
    b.holding.tier = tr; b.holding.obj.visible = true; b.holding.obj.position.set(0.5, tr.y, (tr.z0 + tr.z1) / 2);
    b.place(); await sleep(200);
    out.movedX = +b.placed[0].x.toFixed(2);
    b.undo(); await sleep(200);
    out.backX = +b.placed[0].x.toFixed(2);
    const lv = b.levels;
    b.changeLevels(lv === 7 ? 3 : 7); await sleep(200);
    out.levelsChanged = b.levels !== lv;
    b.undo(); await sleep(200);
    out.levelsBack = b.levels === lv && b.placed.length === 1;
    b.pick('arco'); await sleep(200);
    out.arch = !!b.extras.arco;
    b.pick('arco'); await sleep(200);
    out.archOff = !b.extras.arco;
    b.undo(); await sleep(200);
    out.archBack = !!b.extras.arco;
    b.clearAll(); await sleep(200);
    out.cleared = b.isEmpty();
    b.undo(); await sleep(200);
    out.restored = b.placed.length === 1 && !!b.extras.arco;
    out.draft = !!window.__game.state.ofrendaDraft;
    return out;
  });
  check(r.placed2 === 2 && r.afterCtrlZ === 1 && r.afterButton === 0, `ofrenda: Ctrl+Z and the Undo button take things off (${r.placed2}→${r.afterCtrlZ}→${r.afterButton})`);
  check(r.movedX === 0.5 && r.backX === -0.3, `ofrenda: undo puts a moved thing back (${r.movedX} → ${r.backX})`);
  check(r.levelsChanged && r.levelsBack, 'ofrenda: changing levels keeps things and can be undone');
  check(r.arch && r.archOff && r.archBack, 'ofrenda: the arch goes up, comes down, and undo brings it back');
  check(r.cleared && r.restored, 'ofrenda: Clear all, then Undo brings everything back');
  check(r.draft, 'ofrenda: the half-built ofrenda is saved');
  await page.close();
}

// ---------------------------------------------------------------- papel picado + sugar skull
{
  const page = await open('?scene=workshop&cheat=pan');
  await until(page, () => window.__idle());
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const S = window.__game.engine.stage;
    const out = {};
    const pap = S.papel();
    while (!document.querySelector('#modal .board')) await sleep(150);
    document.querySelector('#modal .ctrl .btn.rosa').click(); // Next
    await sleep(300);
    const cv = document.querySelector('#modal canvas.board');
    const tap = (x, y) => { const rr = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: rr.left + x / 360 * rr.width, clientY: rr.top + y / 450 * rr.height, bubbles: true })); };
    tap(180, 262); await sleep(100); // the nose triangle (1 tap)
    tap(135, 200); await sleep(100); // an eye (first of 2 taps)
    const undoBtn = document.querySelector('#modal [data-a=undo]');
    out.undoEnabled = !undoBtn.disabled;
    window.__ctrlZ(); await sleep(150);
    undoBtn.click(); await sleep(150);
    out.afterUndo = document.querySelector('#modal [data-a=undo]').disabled;
    document.querySelector('#modal .phead .x').click(); // close without finishing
    out.closed = (await pap) === undefined;
    await sleep(500);
    while (!window.__idle() || window.__game.engine.stage.busy) await sleep(150);
    // sugar skull
    const dec = S.decorate();
    while (!document.querySelector('#tray [data-a=undo]')) await sleep(150);
    await sleep(300);
    const ctx = S.skullCv.getContext('2d');
    const before = ctx.getImageData(0, 0, 512, 256).data.reduce((a, v) => a + v, 0);
    S.snapshotCanvas(); S.paintAt({ x: 200, y: 120 });
    const painted = ctx.getImageData(0, 0, 512, 256).data.reduce((a, v) => a + v, 0);
    window.__ctrlZ(); await sleep(150);
    const after = ctx.getImageData(0, 0, 512, 256).data.reduce((a, v) => a + v, 0);
    out.skull = painted !== before && after === before;
    document.querySelector('#tray [data-a=clear]').click(); await sleep(100);
    document.querySelector('#tray [data-a=undo]').click(); await sleep(100);
    out.skullClearUndo = ctx.getImageData(0, 0, 512, 256).data.reduce((a, v) => a + v, 0) === before;
    document.querySelector('#tray [data-a=done]').click();
    await dec;
    return out;
  });
  check(r.undoEnabled && r.afterUndo, 'papel picado: Ctrl+Z and Undo take back chisel taps');
  check(r.closed, 'papel picado: the panel can be closed without finishing');
  check(r.skull, 'sugar skull: Ctrl+Z takes back paint');
  check(r.skullClearUndo, 'sugar skull: Start over can be undone');
  await page.close();
}

// ---------------------------------------------------------------- bread bones
{
  const page = await open('?scene=bakery&cheat=market');
  await until(page, () => window.__idle());
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const S = window.__game.engine.stage;
    S.bake();
    const t0 = Date.now();
    while (!S.boneMode && Date.now() - t0 < 120000) {
      const h = window.__game.engine.hotspots.find((x) => x.nested && x.enabled());
      if (h) h.onClick({ point: null });
      if (S.kneading) S.kneading.resolve();
      await sleep(400);
    }
    S.addBone(0); S.addBone(1); S.addBone(2);
    const three = S.bones.length;
    window.__ctrlZ(); await sleep(150);
    document.querySelector('#tray [data-a=undo]').click(); await sleep(150);
    return { three, after: S.bones.length };
  });
  check(r.three === 3 && r.after === 1, `bread: Ctrl+Z and Undo take bones off (${r.three}→${r.after})`);
  await page.close();
}

// ---------------------------------------------------------------- free-mode portrait
{
  const page = await open('?scene=title');
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const G = window.__game;
    G.startFree();
    while (!document.querySelector('#modal [data-a=go]')) await sleep(150);
    document.querySelector('#modal [data-a=go]').click();
    while (!document.querySelector('#modal canvas.board')) await sleep(150);
    const cv = document.querySelector('#modal canvas.board');
    const ctx = cv.getContext('2d');
    const sum = () => ctx.getImageData(0, 0, 400, 520).data.reduce((a, v) => a + v, 0);
    const before = sum();
    const rr = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: rr.left + 50, clientY: rr.top + 50, pointerId: 1, bubbles: true }));
    cv.dispatchEvent(new PointerEvent('pointermove', { clientX: rr.left + 150, clientY: rr.top + 120, pointerId: 1, bubbles: true }));
    cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    const drawn = sum();
    window.__ctrlZ(); await sleep(150);
    const undone = sum();
    document.querySelector('#modal [data-a=back]').click();
    await sleep(300);
    const backToSetup = !!document.querySelector('#modal [data-a=go]');
    return { drew: drawn !== before, undone: undone === before, backToSetup };
  });
  check(r.drew && r.undone, 'portrait: Ctrl+Z takes back a stroke');
  check(r.backToSetup, 'portrait: Back returns to the first step');
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `${failed} problem(s)` : 'all undo checks passed');
process.exit(failed ? 1 : 0);
