// Clash Tower interior test: load the tower, walk into the elevator, ride
// between floors, use terminals (CPU lobby, queue, private, arcade), play the
// queue minigame, and exit to the plaza. Saves screenshots to chroma/qa/.
//   node chroma/tools/towertest.mjs
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('../..', import.meta.url));
const qa = fileURLToPath(new URL('../qa/', import.meta.url));
await mkdir(qa, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => { try { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/chroma/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
page.setDefaultTimeout(240000);
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) { pass++; console.log('  ok  ', name, extra); } else { fail++; console.log('  FAIL', name, extra); } };
const shot = (n) => page.screenshot({ path: join(qa, n), timeout: 240000 });
const mode = () => page.evaluate(() => window.__chroma.mode?.constructor.name);
const shots = process.argv.includes('--shots-only');

await page.goto(`${base}?tower&qa&fast&nonews&name=Tester`);
await page.waitForFunction(() => window.__chroma?.mode?.constructor.name === 'Tower' && !window.__chroma.loadingNow, null, { timeout: 180000 });
await page.waitForTimeout(2500);
check('tower loads', await mode() === 'Tower');
await shot('tower_lobby.png');
// a wide establishing view of the atrium
await page.evaluate(() => { const m = window.__chroma.mode; const V = m.player.pos.constructor; m.camOverride = { pos: new V(10, 3.0, 12), look: new V(0, 14, 0) }; });
await page.waitForTimeout(800);
await shot('tower_atrium.png');
await page.evaluate(() => { window.__chroma.mode.camOverride = null; });
// walk into the car on the lobby floor
await page.evaluate(() => { const m = window.__chroma.mode; m.player.place(new (m.player.pos.constructor)(0, 0, 0.3), 0); m.rig.snap(m.player, 0); });
await page.waitForTimeout(400);
const near = await page.evaluate(() => window.__chroma.mode.nearest()?.kind);
check('elevator panel offered in the car', near === 'panel', near);
// open the floor picker like a player would
await page.evaluate(() => window.__chroma.mode.openPanel());
await page.waitForSelector('.elevator-ui .fbtn', { timeout: 30000 });
await page.waitForTimeout(500);
await shot('tower_elevator_ui.png');
await page.click('.elevator-ui [data-f="2"]');
await page.waitForTimeout(1200);
const riding = await page.evaluate(() => ({ r: window.__chroma.mode.riding, s: window.__chroma.mode.elev.state }));
check('car leaves with the player', riding.r && (riding.s === 'closing' || riding.s === 'moving'), JSON.stringify(riding));
await page.waitForFunction(() => window.__chroma.mode.elev.state === 'moving', null, { timeout: 120000 });
await page.waitForTimeout(700);
await shot('tower_ride.png');
await page.waitForFunction(() => window.__chroma.mode.elev.state === 'idle', null, { timeout: 240000 });
await page.waitForTimeout(600);
const arr = await page.evaluate(() => { const m = window.__chroma.mode; return { y: +m.player.pos.y.toFixed(2), floor: m.elev.floor, hud: document.getElementById('tower-hud').textContent }; });
check('arrived on floor 3 with the player', arr.floor === 2 && Math.abs(arr.y - 16) < 0.3 && /PRIVATE/.test(arr.hud), JSON.stringify(arr));
// step out onto the floor and look at the terminal
await page.evaluate(() => { const m = window.__chroma.mode; m.player.place(new (m.player.pos.constructor)(0, 16, 8.7), 0); m.rig.snap(m.player, 0); });
await page.waitForTimeout(1500);
const kk = await page.evaluate(() => window.__chroma.mode.nearest());
check('private terminal offered', kk?.kind === 'kiosk' && kk.floor === 2, kk?.kind);
await shot('tower_private_floor.png');
await page.evaluate(() => { const m = window.__chroma.mode; m.interact(m.nearest()); });
await page.waitForSelector('.privmenu', { timeout: 30000 });
check('private menu opens from the terminal', true);
await page.click('.privmenu [data-back]');
await page.waitForTimeout(500);
// the empty shaft is blocked: car is here, so call it away, then try walking in
await page.evaluate(() => { const m = window.__chroma.mode; m.elev.floor = 0; m.elev.y = 0; m.elev.state = 'idle'; m.placeCar(); m.player.place(new (m.player.pos.constructor)(0, 16, 2.6), Math.PI); });
for (let i = 0; i < 25; i++) { await page.evaluate(() => { const m = window.__chroma.mode; m.player.pos.z -= 0.15; m.guardShaft(); }); }
const guard = await page.evaluate(() => window.__chroma.mode.player.pos.z);
check('cannot walk into an empty shaft', guard > 1.8, guard.toFixed(2));
// walking up to the doors calls the car
await page.waitForFunction(() => { const e = window.__chroma.mode.elev; return e.to === 2 && e.state !== 'idle'; }, null, { timeout: 60000 }).catch(() => {});
const called = await page.evaluate(() => window.__chroma.mode.elev);
check('the car comes when you walk up', called.to === 2 && called.state !== 'idle' || called.floor === 2, JSON.stringify({ to: called.to, s: called.state, f: called.floor }));
// Sky Deck arcade + minigame
await page.evaluate(() => { const m = window.__chroma.mode; m.elev.floor = 5; m.elev.y = 40; m.elev.state = 'idle'; m.placeCar(); m.player.place(new (m.player.pos.constructor)(0, 40, 8.9), 0); m.rig.snap(m.player, 0); });
await page.waitForTimeout(1500);
await shot('tower_deck.png');
await page.evaluate(() => { const m = window.__chroma.mode; const V = m.player.pos.constructor; m.camOverride = { pos: new V(-11, 42.5, 12), look: new V(30, 25, -40) }; });
await page.waitForTimeout(600);
await shot('tower_deck_view.png');
await page.evaluate(() => { window.__chroma.mode.camOverride = null; });
await page.evaluate(() => window.__chroma.mode.useKiosk(5));
await page.waitForSelector('.arcade .minigame canvas', { timeout: 30000 });
await page.click('.arcade [data-mg="play"]');
const cv = await page.$('.arcade .minigame canvas');
const bb = await cv.boundingBox();
for (let i = 0; i < 24; i++) { await page.mouse.click(bb.x + bb.width * (0.2 + Math.random() * 0.6), bb.y + bb.height * (0.15 + Math.random() * 0.5)); await page.waitForTimeout(160); }
await shot('tower_arcade.png');
const score = await page.evaluate(() => +document.querySelector('.arcade .mg-score').textContent);
check('minigame runs and scores', Number.isFinite(score), String(score));
await page.click('.arcade [data-back]');
await page.waitForTimeout(400);
// CPU lobby from the lobby terminal
await page.evaluate(() => { const m = window.__chroma.mode; m.player.place(m.tw.kiosks[0].spot.clone(), Math.PI); });
await page.waitForTimeout(300);
await page.evaluate(() => { const m = window.__chroma.mode; m.interact(m.nearest()); });
await page.waitForSelector('.lobby', { timeout: 30000 });
check('CPU lobby opens from the lobby terminal', true, await page.evaluate(() => String(window.__chroma.towerFloor)));
await page.click('.lobby [data-back]').catch(() => {});
await page.waitForTimeout(400);
// the Zone Clash and Hue Hoops floors open the lobby with their mode picked
for (const [f, md] of [[3, 'zones'], [4, 'hoops']]) {
  await page.evaluate((i) => window.__chroma.mode.useKiosk(i), f);
  await page.waitForSelector('.lobby', { timeout: 30000 });
  const sel = await page.evaluate(() => document.querySelector('.lobby [data-md].sel')?.dataset.md);
  check(`floor ${f + 1} lobby preselects ${md}`, sel === md, sel);
  await page.click('.lobby [data-back]').catch(() => {});
  await page.waitForTimeout(400);
}
// exit to the plaza
await page.evaluate(() => { const m = window.__chroma.mode; m.player.place(new (m.player.pos.constructor)(0, 0, 13.2), 0); });
await page.waitForTimeout(300);
const ex = await page.evaluate(() => window.__chroma.mode.nearest()?.kind);
check('exit offered at the lobby doors', ex === 'exit', ex);
await page.evaluate(() => { const m = window.__chroma.mode; m.interact(m.nearest()); });
await page.waitForFunction(() => window.__chroma.mode?.constructor.name === 'Plaza' && !window.__chroma.loadingNow, null, { timeout: 120000 });
const pp = await page.evaluate(() => window.__chroma.mode.player.pos.toArray().map((v) => +v.toFixed(1)));
check('back in the plaza at the tower door', Math.abs(pp[2] - -25.8) < 1.5, JSON.stringify(pp));
await page.waitForTimeout(1500);
await page.evaluate(() => { const m = window.__chroma.mode; const V = m.player.pos.constructor; m.uiOpen = true; m.shopCam = { pos: new V(-14, 2.2, 22), look: new V(0, 40, -38) }; m.camera.position.copy(m.shopCam.pos); });
await page.waitForTimeout(2500);
await shot('tower_exterior.png');
console.log('errors:', errors.length, errors.slice(0, 5));
console.log(`${pass} passed, ${fail} failed`);
void shots;
await browser.close(); server.close(); process.exit(fail || errors.length ? 1 : 0);
