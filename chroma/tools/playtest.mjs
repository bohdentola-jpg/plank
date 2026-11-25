// Scripted input playtest: drives the real player controls in headless Chromium.
//   node chroma/tools/playtest.mjs plaza
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = fileURLToPath(new URL('../..', import.meta.url));
const qaDir = fileURLToPath(new URL('../qa/', import.meta.url));
await mkdir(qaDir, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(join(root, p))); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
const scenario = process.argv[2] || 'plaza';
const url = scenario === 'plaza' ? 'index.html?plaza&qa&fast' : 'index.html?quick&qa&fast&skipintro&time=200';
await page.goto(`http://127.0.0.1:${server.address().port}/chroma/${url}`);
await page.waitForFunction(() => window.__chroma?.mode && !window.__chroma.loadingNow, null, { timeout: 120000 });
const state = () => page.evaluate(() => {
  const m = window.__chroma.mode, p = m.player;
  return { pos: [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(2)), form: p.form, sub: p.submerged, climb: p.climbing, ink: +p.ink.toFixed(2), turf: +p.stats.turf.toFixed(1), locked: window.__chroma.input.locked, ground: p.onGround, special: +p.special.toFixed(0) };
});
const log = async (label) => console.log(label.padEnd(26), JSON.stringify(await state()));
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k); };
await page.waitForTimeout(3000);
await page.mouse.move(400, 225);
await page.mouse.click(400, 225);
await page.waitForTimeout(800);
await page.evaluate(() => { window.__chroma.input.sensitivity = 0; });
await log('start');
await hold(['KeyW'], 4000); await log('walk forward 4s');
// paint: hold mouse while looking down
await page.evaluate(() => { const m = window.__chroma.mode; m.rig.pitch = -0.6; window.__chroma.input.locked = true; });
await page.mouse.down(); await page.waitForTimeout(3500); await page.mouse.up();
await log('painted 3.5s');
await page.screenshot({ path: join(qaDir, `pt_${scenario}_paint.png`) });
await hold(['ShiftLeft'], 2500); await log('goo in ink 2.5s');
await hold(['ShiftLeft', 'KeyS'], 1500); await log('swim back 1.5s');
await page.screenshot({ path: join(qaDir, `pt_${scenario}_swim.png`) });
await hold(['Space'], 200); await page.waitForTimeout(600); await log('jump');
// wall climb: face a wall, paint it, swim into it
const wallSetup = await page.evaluate(() => {
  const m = window.__chroma.mode, p = m.player;
  if (m.pz) { p.place(new (p.pos.constructor)(11, 0.6, 42.5), 0); m.rig.yaw = 0; } // plaza: facing the yard's back wall (+z)
  else { p.place(new (p.pos.constructor)(-12, 0, -33.8), Math.PI * 1.5); m.rig.yaw = -Math.PI / 2; }
  m.rig.pitch = 0.12;
  return true;
});
void wallSetup;
await page.waitForTimeout(500);
await page.mouse.down(); await page.waitForTimeout(3000); await page.mouse.up();
await log('painted wall');
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); await log('climbing ' + i); }
await page.screenshot({ path: join(qaDir, `pt_${scenario}_climb.png`) });
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
await page.screenshot({ path: join(qaDir, `pt_${scenario}_climb.png`) });
await page.mouse.click(400, 225, { button: 'right' }); await page.waitForTimeout(3500); await log('bomb thrown');
await page.screenshot({ path: join(qaDir, `pt_${scenario}_bomb.png`) });
console.log('errors:', errors.length);
await browser.close(); server.close(); process.exit(0);
