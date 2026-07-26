// Drive NO VACANCY in headless chromium and instrument World rebuilds.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const root = '/home/user/plank/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
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
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message, (e.stack || '').split('\n')[1] || ''));

await page.goto(`http://127.0.0.1:${port}/hotel/index.html?fresh&dev`);
await page.waitForTimeout(700);
await page.locator('#boot').dispatchEvent('click');
await page.waitForTimeout(1500);

const snap = async (label) => {
  const r = await page.evaluate(() => {
    const w = window.game.world || window.game.titleWorld;
    if (!w) return null;
    return {
      rebuilds: w.__rebuilds || 0,
      cars: w.cars ? w.cars.children.length : -1,
      pick: w.pickables.length,
      people: w.people.size,
      geo: w.renderer.info.memory.geometries,
      texs: w.renderer.info.memory.textures,
      calls: w.renderer.info.render.calls,
      staticKids: w.static.children.length,
      sceneKids: w.scene.children.length,
      floors: w.state.floors,
      elev: !!w.state.amenities.elevator,
      tiers: w.state.rooms.map((r) => (r.built ? r.tier : 0)).join(''),
    };
  });
  console.log(label, JSON.stringify(r));
  return r;
};

const instrument = () => page.evaluate(() => {
  const w = window.game.world || window.game.titleWorld;
  if (!w || w.__instr) return;
  w.__instr = true;
  w.__rebuilds = 0;
  const orig = w.rebuild.bind(w);
  w.rebuild = () => { w.__rebuilds++; orig(); };
});

// ---- title screen: does typing the hotel name pile up cars?
await page.locator('#t-new').dispatchEvent('click');
await page.waitForTimeout(600);
await instrument();
await snap('title/before-typing');
await page.evaluate(async () => {
  const inp = document.querySelector('#s-name');
  const target = 'Cardinal Arms Hotel';
  inp.value = '';
  for (const ch of target) {
    inp.value += ch;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  }
});
await page.waitForTimeout(900);
await snap('title/after-typing ');

// ---- start the game
await page.locator('#s-start').dispatchEvent('click');
await page.waitForTimeout(2000);
await instrument();
await snap('game/start        ');

await page.waitForTimeout(8000);
await snap('game/after-8s-idle');

// ---- buy the elevator through the real build panel button
await page.evaluate(() => { window.game.state.cash = 999999; window.game.hud._panelSig = ''; });
await page.waitForTimeout(400);
await page.locator('[data-act="am:elevator"]').dispatchEvent('click');
await page.waitForTimeout(1500);
await snap('game/+elevator    ');

// ---- build out every slot, then add a floor
await page.evaluate(() => { for (let i = 0; i < 12; i++) window.game.panelAction('room', null); });
await page.waitForTimeout(1200);
await snap('game/+rooms       ');
await page.evaluate(() => window.game.panelAction('floor', null));
await page.waitForTimeout(1800);
await snap('game/+floor       ');

// ---- upgrade a room to a suite
await page.evaluate(() => {
  const g = window.game;
  const r = g.state.rooms.find((x) => x.built && x.state !== 'occupied' && x.state !== 'reserved');
  g.panelAction(`upgrade:${r.id}`, null);
  g.panelAction(`upgrade:${r.id}`, null);
});
await page.waitForTimeout(1800);
await snap('game/+suite       ');

const pickTest = await page.evaluate(() => {
  const w = window.game.world;
  const kinds = {};
  for (const m of w.pickables) {
    const k = m.userData.pick.kind;
    kinds[k] = (kinds[k] || 0) + 1;
  }
  const inScene = w.pickables.filter((m) => { let o = m; while (o.parent) o = o.parent; return o === w.scene; }).length;
  return { kinds, total: w.pickables.length, inScene, roomVis: w.roomVis.size };
});
console.log('pick check       ', JSON.stringify(pickTest));

const nanCheck = await page.evaluate(() => {
  const w = window.game.world;
  const bad = [];
  w.scene.traverse((o) => {
    const p = o.position, r = o.rotation, s = o.scale;
    if (![p.x, p.y, p.z, r.x, r.y, r.z, s.x, s.y, s.z].every(Number.isFinite)) bad.push(o.type);
  });
  return { bad: bad.slice(0, 10), n: bad.length };
});
console.log('NaN sweep        ', JSON.stringify(nanCheck));

await page.screenshot({ path: '/tmp/claude-0/-home-user-plank/6ba8ae3a-9328-508b-86ed-de86fce64e21/scratchpad/wp_after.png' });
await browser.close();
server.close();
process.exit(0);
