// NO VACANCY is meant to be left open for hours, so anything that grows per
// rebuild or per guest eventually matters. This drives the real page in headless
// Chromium and asserts the scene graph and the renderer's GPU tables stay flat
// across repeated structural rebuilds and a stretch of guest churn.
//   node tools/hotel-leakcheck.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/hotel/index.html`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 720 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

let failures = 0;
const check = (name, ok, detail) => {
  if (ok) console.log(`ok   ${name}`);
  else { failures++; console.error(`FAIL ${name}: ${detail}`); }
};

await page.goto(`${base}?showcase&fresh`);
await page.waitForTimeout(1500);
await page.keyboard.press('Space');
await page.waitForTimeout(8000);

// ---- structural rebuilds: buying anything rebuilds the whole building
const rebuilds = await page.evaluate(() => {
  const w = window.game.world;
  window.game.paused = true;                 // freeze arrivals so this measures rebuilds alone
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const snap = () => {
    let meshes = 0;
    w.scene.traverse((o) => { if (o.isMesh || o.isSprite) meshes++; });
    return { meshes, geo: w.renderer.info.memory.geometries, tex: w.renderer.info.memory.textures };
  };
  return (async () => {
    await frame();
    const trail = [];
    for (let i = 0; i < 6; i++) {
      window.game.state.accent = i % 2 ? '#e0a92b' : '#5fb0c9';
      w.rebuild();
      await frame();
      trail.push(snap());
    }
    return trail;
  })();
});
const first = rebuilds[1];
const last = rebuilds[rebuilds.length - 1];
const per = (k) => (last[k] - first[k]) / (rebuilds.length - 2);
check('scene mesh count is flat across rebuilds', per('meshes') === 0, `${per('meshes')} meshes leaked per rebuild`);
check('renderer geometries are flat across rebuilds', per('geo') <= 0, `${per('geo')} geometries leaked per rebuild`);
check('renderer textures are flat across rebuilds', per('tex') <= 0.5, `${per('tex')} textures leaked per rebuild`);

// ---- guest churn. Rig geometry is a shared cache that fills up over the first
// few dozen people, so measure three windows and require the last to be flat
// rather than the first — a warming cache is not a leak.
const churn = await page.evaluate(() => {
  const w = window.game.world, g = window.game;
  g.paused = false;
  g.state.speed = 4;
  const snap = () => ({ people: w.people.size, geo: w.renderer.info.memory.geometries, guests: g.state.guests.length, served: g.state.totals.guests });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  return (async () => {
    const marks = [snap()];
    for (let i = 0; i < 3; i++) { await wait(14000); marks.push(snap()); }
    return marks;
  })();
});
const lastWindow = churn[3].geo - churn[2].geo;
const firstWindow = churn[1].geo - churn[0].geo;
check('rig geometry cache saturates instead of growing',
  lastWindow <= 4,
  `still adding ${lastWindow} geometries per window (first window added ${firstWindow}) after ${churn[3].served} guests`);
check('people are removed when they leave',
  churn[3].people <= churn[3].guests + 12,
  `${churn[3].people} rigs for ${churn[3].guests} guests plus staff`);

// ---- the title screen's renderer must be gone once the game starts
await page.goto(`${base}?fresh`);
await page.waitForTimeout(1500);
await page.keyboard.press('Space');
await page.waitForTimeout(4000);
await page.locator('#t-new').dispatchEvent('click');
await page.waitForTimeout(800);
await page.locator('#s-start').dispatchEvent('click');
await page.locator('#s-start').dispatchEvent('click');     // a fumbled double-click
await page.waitForTimeout(4000);
const shell = await page.evaluate(() => ({
  titleCanvases: document.querySelectorAll('#title-3d canvas').length,
  gameCanvases: document.querySelectorAll('#game-holder canvas').length,
  titleWorld: !!window.game.titleWorld,
}));
check('title renderer is torn down', shell.titleCanvases === 0 && !shell.titleWorld, JSON.stringify(shell));
check('double-clicking start makes one game', shell.gameCanvases === 1, `${shell.gameCanvases} canvases`);
check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));

console.log(failures ? `\n${failures} failure(s)` : '\nno leaks found');
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
