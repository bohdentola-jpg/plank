// (a) title-screen resize, (b) guests clipping the lobby shell, (c) long soak leak check.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const root = '/home/user/plank/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()); });

await page.goto(`http://127.0.0.1:${port}/hotel/index.html?fresh&dev`);
await page.waitForTimeout(600);
await page.locator('#boot').dispatchEvent('click');
await page.waitForTimeout(1500);

// ---------- (a) does the title world react to a window resize?
const before = await page.evaluate(() => {
  const w = window.game.titleWorld;
  return { canvas: [w.renderer.domElement.width, w.renderer.domElement.height], holder: [w.holder.clientWidth, w.holder.clientHeight], aspect: +w.camera.aspect.toFixed(3) };
});
await page.setViewportSize({ width: 700, height: 900 });
await page.waitForTimeout(1200);
const after = await page.evaluate(() => {
  const w = window.game.titleWorld;
  return { canvas: [w.renderer.domElement.width, w.renderer.domElement.height], holder: [w.holder.clientWidth, w.holder.clientHeight], aspect: +w.camera.aspect.toFixed(3) };
});
console.log('title resize before', JSON.stringify(before));
console.log('title resize after ', JSON.stringify(after));
await page.setViewportSize({ width: 1366, height: 820 });
await page.waitForTimeout(600);

// same check once the game world exists
await page.locator('#t-new').dispatchEvent('click');
await page.waitForTimeout(400);
await page.locator('#s-start').dispatchEvent('click');
await page.waitForTimeout(2500);
const g1 = await page.evaluate(() => { const w = window.game.world; return { canvas: [w.renderer.domElement.width, w.renderer.domElement.height], aspect: +w.camera.aspect.toFixed(3) }; });
await page.setViewportSize({ width: 700, height: 900 });
await page.waitForTimeout(1200);
const g2 = await page.evaluate(() => { const w = window.game.world; return { canvas: [w.renderer.domElement.width, w.renderer.domElement.height], aspect: +w.camera.aspect.toFixed(3) }; });
console.log('game  resize before', JSON.stringify(g1));
console.log('game  resize after ', JSON.stringify(g2));
await page.setViewportSize({ width: 1366, height: 820 });
await page.waitForTimeout(600);

// ---------- (b) watch every guest for a frame spent inside the lobby shell
await page.evaluate(() => {
  const w = window.game.world;
  window.__clip = { glass: 0, sideWall: 0, samples: 0, worst: null };
  const HALF_W = 13.2, RAIL_Z = 2.7, LOBBY_BACK = -5.2;
  setInterval(() => {
    const s = window.game.state;
    window.__clip.samples++;
    for (const g of s.guests) {
      // inside the +x side wall slab (x within 0.4 of 13.2, z inside the wall span)
      if (Math.abs(g.x - HALF_W) < 0.5 && g.z > LOBBY_BACK - 0.1 && g.z < RAIL_Z + 0.1 && g.y < 1) {
        window.__clip.sideWall++;
        window.__clip.worst = { kind: 'sideWall', x: +g.x.toFixed(2), z: +g.z.toFixed(2), state: g.state };
      }
      // inside a glass pane (z within 0.3 of RAIL_Z, x not in the door gap)
      if (Math.abs(g.z - RAIL_Z) < 0.35 && g.y < 1 && !(g.x > 4.3 && g.x < 8.1) && Math.abs(g.x) < HALF_W) {
        window.__clip.glass++;
        window.__clip.worst = { kind: 'glass', x: +g.x.toFixed(2), z: +g.z.toFixed(2), state: g.state };
      }
    }
  }, 40);
  window.game.state.speed = 4;
});

// ---------- (c) soak: churn the building and run hot for a while
const snap = async (label) => {
  const r = await page.evaluate(() => {
    const w = window.game.world;
    return {
      geo: w.renderer.info.memory.geometries, tex: w.renderer.info.memory.textures,
      progs: w.renderer.info.programs.length, people: w.people.size,
      pick: w.pickables.length, sceneKids: w.scene.children.length,
      cars: w.cars.children.length, staticKids: w.static.children.length,
      dom: document.getElementsByTagName('*').length,
      toasts: document.querySelector('#toasts').children.length,
      guests: window.game.state.guests.length, tasks: window.game.state.tasks.length,
      log: window.game.state.log.length, reviews: window.game.state.reviews.length,
      day: window.game.state.day, quality: w.quality,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1,
    };
  });
  console.log(label, JSON.stringify(r));
};

await page.evaluate(() => { window.game.state.cash = 1e9; window.game.state.youAuto = true; });
await snap('soak t=0    ');
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => {
    const g = window.game;
    g.state.cash = 1e9;
    for (let k = 0; k < 8; k++) g.panelAction('room', null);
    g.panelAction('floor', null);
    const r = g.state.rooms.find((x) => x.built && x.tier < 3 && x.state !== 'occupied' && x.state !== 'reserved');
    if (r) g.panelAction(`upgrade:${r.id}`, null);
    const am = ['wifi', 'vending', 'coffee', 'pool', 'bar', 'gym', 'spa', 'elevator', 'chandelier', 'signneon'][i % 10];
    g.panelAction(`am:${am}`, null);
  });
  await page.waitForTimeout(6000);
  await snap(`soak pass ${i} `);
}
await page.waitForTimeout(25000);
await snap('soak end    ');
console.log('clip counters', JSON.stringify(await page.evaluate(() => window.__clip)));

await page.screenshot({ path: '/tmp/claude-0/-home-user-plank/6ba8ae3a-9328-508b-86ed-de86fce64e21/scratchpad/wp_soak.png' });
await browser.close();
server.close();
process.exit(0);
