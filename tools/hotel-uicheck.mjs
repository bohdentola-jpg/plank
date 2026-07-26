// The parts of NO VACANCY that only break in a real browser: an input the HUD
// re-renders out from under your thumb, a button destroyed between mousedown and
// mouseup, a modal that leaves the game paused, a build button that charges you
// for the wrong room. Drives the actual page.
//   node tools/hotel-uicheck.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
    const d = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(d);
  } catch { res.writeHead(404); res.end('no'); }
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
let bad = 0;
const check = (n, ok, d) => { if (ok) console.log('ok  ', n); else { bad++; console.error('FAIL', n + ':', d); } };

await page.goto(`http://127.0.0.1:${server.address().port}/hotel/index.html?showcase&fresh`);
await page.waitForTimeout(1500);
await page.keyboard.press('Space');
await page.waitForTimeout(7000);

// 1. the rate slider survives being dragged
const slider = await page.evaluate(async () => {
  window.game.hud.tab = 'rates'; window.game.hud._panelSig = '';
  window.game.hud.render(window.game.state, false);
  await new Promise((r) => setTimeout(r, 400));
  const el0 = document.querySelector('#rate-slider');
  const seen = [];
  for (const v of [110, 125, 140, 155]) {
    const el = document.querySelector('#rate-slider');
    if (!el) return { died: true };
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    seen.push({ sameNode: document.querySelector('#rate-slider') === el0, rateMult: window.game.state.rateMult, readout: document.querySelector('#rate-pct')?.textContent });
  }
  return { seen };
});
check('rate slider is not replaced mid-drag', slider.seen && slider.seen.every((x) => x.sameNode), JSON.stringify(slider));
check('rate readout follows the slider', slider.seen && slider.seen[3].readout === '155%', JSON.stringify(slider.seen?.[3]));

// 2. the AUTO button survives a real mousedown/mouseup pair
const auto0 = await page.evaluate(() => window.game.state.youAuto);
const box = await page.locator('#you-auto').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(450);          // long enough for several HUD repaints
await page.mouse.up();
await page.waitForTimeout(400);
const auto1 = await page.evaluate(() => window.game.state.youAuto);
check('AUTO button survives a slow click', auto0 !== auto1, `youAuto stayed ${auto1}`);

// 3. Escape out of the pause menu must not leave the game frozen
await page.evaluate(() => window.game.pauseMenu());
await page.waitForTimeout(500);
const pausedInMenu = await page.evaluate(() => window.game.paused);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const afterEsc = await page.evaluate(() => ({ paused: window.game.paused, overlay: document.querySelector('#overlay').classList.contains('show') }));
check('Escape closes the office and unpauses', pausedInMenu && !afterEsc.paused && !afterEsc.overlay, JSON.stringify({ pausedInMenu, afterEsc }));

// 4. the inspector builds the shell you clicked, not the first free one
const built = await page.evaluate(async () => {
  const g = window.game, s = g.state;
  s.cash = 500000;
  g.hud._panelSig = '';
  if (!s.rooms.some((r) => !r.built)) { const { addFloor } = await import('./src/sim.js'); addFloor(s); }
  const shells = s.rooms.filter((r) => !r.built);
  const target = shells[shells.length - 1];        // deliberately NOT the first free slot
  g.onPick({ kind: 'slot', id: target.id });
  g.hud._inspSig = '';
  g.hud.render(s, false);
  await new Promise((r) => setTimeout(r, 300));
  const btn = document.querySelector('#inspector [data-act^="room"]');
  const act = btn?.dataset.act;
  btn?.click();
  await new Promise((r) => setTimeout(r, 300));
  return { act, targetId: target.id, targetBuilt: s.rooms.find((r) => r.id === target.id).built, firstShell: shells[0].id, firstBuilt: s.rooms.find((r) => r.id === shells[0].id).built };
});
check('inspector builds the room you clicked', built.targetBuilt && !built.firstBuilt, JSON.stringify(built));
check('no page errors', errs.length === 0, errs.slice(0, 4).join(' | '));
console.log(bad ? `\n${bad} failure(s)` : '\nUI checks passed');
await browser.close(); server.close(); process.exit(bad ? 1 : 0);
