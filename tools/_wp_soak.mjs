// (a) title-screen resize, (b) guests clipping the lobby shell, (c) long soak leak check.
// ?hq pins render quality so checkQuality() never calls resize() behind our back.
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

await page.goto(`http://127.0.0.1:${port}/hotel/index.html?fresh&dev&hq`);
await page.waitForTimeout(600);
await page.locator('#boot').dispatchEvent('click');
await page.waitForTimeout(1500);

const shape = (which) => page.evaluate((k) => {
  const w = window.game[k];
  return { canvas: [w.renderer.domElement.width, w.renderer.domElement.height], holder: [w.holder.clientWidth, w.holder.clientHeight], aspect: +w.camera.aspect.toFixed(3), pinned: w.pinQuality };
}, which);

console.log('title before resize', JSON.stringify(await shape('titleWorld')));
await page.setViewportSize({ width: 700, height: 900 });
await page.waitForTimeout(1500);
console.log('title after  resize', JSON.stringify(await shape('titleWorld')));
await page.setViewportSize({ width: 1366, height: 820 });
await page.waitForTimeout(800);

await page.locator('#t-new').dispatchEvent('click');
await page.waitForTimeout(400);
await page.locator('#s-start').dispatchEvent('click');
await page.waitForTimeout(2500);
console.log('game  before resize', JSON.stringify(await shape('world')));
await page.setViewportSize({ width: 700, height: 900 });
await page.waitForTimeout(1500);
console.log('game  after  resize', JSON.stringify(await shape('world')));
await page.setViewportSize({ width: 1366, height: 820 });
await page.waitForTimeout(800);

// ---------- (b) clipping + (c) marching-in-place check
await page.evaluate(() => {
  window.__clip = { glass: 0, sideWall: 0, samples: 0, worst: null };
  window.__march = { frames: 0, worst: 0, who: null };
  const HALF_W = 13.2, RAIL_Z = 2.7, LOBBY_BACK = -5.2;
  setInterval(() => {
    const s = window.game.state;
    const w3 = window.game.world;
    window.__clip.samples++;
    for (const g of s.guests) {
      if (Math.abs(g.x - HALF_W) < 0.5 && g.z > LOBBY_BACK - 0.1 && g.z < RAIL_Z + 0.1 && g.y < 1) {
        window.__clip.sideWall++;
        window.__clip.worst = { kind: 'sideWall', x: +g.x.toFixed(2), z: +g.z.toFixed(2), state: g.state };
      }
      if (Math.abs(g.z - RAIL_Z) < 0.35 && g.y < 1 && !(g.x > 4.3 && g.x < 8.1) && Math.abs(g.x) < HALF_W) {
        window.__clip.glass++;
        window.__clip.worst = { kind: 'glass', x: +g.x.toFixed(2), z: +g.z.toFixed(2), state: g.state };
      }
    }
    // a worker standing still (no path) whose rig is running the walk cycle
    for (const w of [s.you, ...s.staff]) {
      if (w.action !== 'carry') continue;
      if (w.path && w.path.length) continue;
      const rig = w3.people.get(w.id);
      if (!rig || !rig.j) continue;
      const swing = Math.abs(rig.j.legL.rotation.x - rig.j.legR.rotation.x);
      window.__march.frames++;
      if (swing > window.__march.worst) { window.__march.worst = +swing.toFixed(3); window.__march.who = w.role + '/' + (w.job && w.job.phase); }
    }
  }, 40);
  window.game.state.speed = 4;
  window.game.state.cash = 1e9;
  window.game.state.youAuto = true;
});

const AMS = ['wifi', 'vending', 'coffee', 'pool', 'bar', 'gym', 'spa', 'elevator', 'chandelier', 'signneon'];
const snap = async (label) => {
  const r = await page.evaluate(() => {
    const w = window.game.world;
    return {
      geo: w.renderer.info.memory.geometries, tex: w.renderer.info.memory.textures,
      progs: w.renderer.info.programs.length, people: w.people.size,
      pick: w.pickables.length, sceneKids: w.scene.children.length,
      cars: w.cars.children.length, staticKids: w.static.children.length,
      dom: document.getElementsByTagName('*').length,
      guests: window.game.state.guests.length, tasks: window.game.state.tasks.length,
      log: window.game.state.log.length, reviews: window.game.state.reviews.length,
      day: window.game.state.day, rooms: window.game.state.rooms.length, floors: window.game.state.floors,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1,
    };
  });
  console.log(label, JSON.stringify(r));
};

await snap('soak t=0    ');
for (let i = 0; i < 6; i++) {
  await page.evaluate((am) => {
    const g = window.game;
    g.state.cash = 1e9;
    for (let k = 0; k < 8; k++) g.panelAction('room', null);
    g.panelAction('floor', null);
    const r = g.state.rooms.find((x) => x.built && x.tier < 3 && x.state !== 'occupied' && x.state !== 'reserved');
    if (r) g.panelAction(`upgrade:${r.id}`, null);
    g.panelAction(`am:${am}`, null);
  }, AMS[i]);
  await page.waitForTimeout(7000);
  await snap(`soak pass ${i} `);
}
await page.waitForTimeout(30000);
await snap('soak end    ');
console.log('clip counters ', JSON.stringify(await page.evaluate(() => window.__clip)));
console.log('march counters', JSON.stringify(await page.evaluate(() => window.__march)));

await page.screenshot({ path: '/tmp/claude-0/-home-user-plank/6ba8ae3a-9328-508b-86ed-de86fce64e21/scratchpad/wp_soak.png' });
await browser.close();
server.close();
process.exit(0);
