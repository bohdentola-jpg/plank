// Your house (Prism Heights): scripted end-to-end checks in headless Chromium.
//   node chroma/tools/housetest.mjs            # all checks
//   node chroma/tools/housetest.mjs --shots    # also save screenshots to chroma/qa/house_*.png
// Covers: ?house loads unarmed, walking, the door refusing you empty-handed,
// grabbing + swapping weapons, leaving to the plaza with the weapon, the plaza's
// home door, buying from the catalog, placing in decorate mode (valid + invalid),
// rotate / put away, colliders, persistence after reload, and first-time
// character creation from the title screen. Fails on any page error.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = fileURLToPath(new URL('../..', import.meta.url));
const qaDir = fileURLToPath(new URL('../qa/', import.meta.url));
await mkdir(qaDir, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(join(root, p))); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}/chroma/`;
const SHOTS = process.argv.includes('--shots');
const KEY = 'chroma-clash-profile-v1';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('  [pageerror]', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('  [console.error]', m.text().slice(0, 300)); } });

let fails = 0, passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passes++; console.log(`  ok   ${name}`); }
  else { fails++; console.log(`  FAIL ${name} ${detail}`); }
};
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const waitFor = async (fn, arg, timeout = 20000) => { try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; } };
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(qaDir, `house_${name}.png`) }); };
const modeIs = (name) => waitFor((n) => { const a = window.__chroma; return a?.mode?.constructor.name === n && !a.loadingNow; }, name, 150000);
// keep the game thinking the mouse is captured so PlayerControl writes intents
const fakeLock = () => ev(() => { const i = window.__chroma.input; i.lock = () => {}; i.locked = true; });
const tp = (x, z, yaw, pitch = -0.12) => ev(([x, z, yaw, pitch]) => {
  const m = window.__chroma.mode, p = m.player;
  p.place(new p.pos.constructor(x, 0, z), yaw);
  m.rig.snap(p, yaw); m.rig.pitch = pitch;
}, [x, z, yaw, pitch]);
const near = () => ev(() => { const n = window.__chroma.mode.nearest(); return n ? { kind: n.kind, id: n.slot?.id || n.inst?.def.id || null, use: n.inst?.def.use || null } : null; });
const pressE = async () => { await page.keyboard.press('KeyE'); await wait(400); };
// direct DOM clicks: software GL can render so slowly that Playwright's "stable" wait times out
const clickSel = async (sel) => { const ok = await ev((sel) => { const e = document.querySelector(sel); if (!e) return false; e.click(); return true; }, sel); if (!ok) console.log('  (missing element)', sel); await wait(250); return ok; };
const face = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);
// screen position of a world point (for mouse clicks in decorate mode)
const screenOf = (x, y, z) => ev(([x, y, z]) => {
  const m = window.__chroma.mode, v = new m.player.pos.constructor(x, y, z).project(m.camera);
  return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
}, [x, y, z]);

console.log('house: boot ?house');
await page.goto(`${BASE}index.html?qa&nonews`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await ev(([k]) => localStorage.setItem(k, JSON.stringify({ created: true, name: 'Tester', coins: 3000, owned: ['spritzer', 'roller'], weapon: 'roller' })), [KEY]);
await page.goto(`${BASE}index.html?house&qa&nonews`);
check('house mode loads from ?house', await modeIs('House'));
await wait(800);
await fakeLock();
let s = await ev(() => { const m = window.__chroma.mode, p = m.player; return { held: m.held, wid: p.model.weaponId, fight: p.canFight, wname: document.querySelector('.ph-weapon')?.textContent, slots: m.armory.slots.filter((x) => x.owned).map((x) => x.id), house: !!window.__chroma.profile.house, items: window.__chroma.profile.house.items.length, inst: m.inst.size, paint: m.world.paint }; });
check('spawns unarmed (no weapon model, cannot fight)', s.held === null && s.wid === null && s.fight === false && s.paint === null, JSON.stringify(s));
check('HUD says hands free', /Hands free/.test(s.wname || ''), s.wname);
check('weapon display shows owned weapons', s.slots.includes('spritzer') && s.slots.includes('roller') && s.slots.length === 2, JSON.stringify(s.slots));
check('starter furniture is placed', s.house && s.items >= 8 && s.inst === s.items, JSON.stringify(s));
await shot('start');

console.log('house: walking');
const p0 = await ev(() => window.__chroma.mode.player.pos.toArray());
// software GL can be slow: hold W until we've walked a bit (or give up after 8 s)
await page.keyboard.down('KeyW');
await waitFor((p0) => { const p = window.__chroma.mode.player.pos; return Math.hypot(p.x - p0[0], p.z - p0[2]) > 1.2; }, p0, 8000);
await page.keyboard.up('KeyW');
await wait(300);
const p1 = await ev(() => window.__chroma.mode.player.pos.toArray());
check('WASD walks the player', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 1.0, JSON.stringify([p0, p1]));
await page.mouse.down(); await wait(400); await page.mouse.up();
check('clicking indoors paints nothing (no combat world)', await ev(() => window.__chroma.mode.world.combat === null && window.__chroma.mode.player.canFight === false));

console.log('house: the door refuses an empty-handed exit');
const D = await ev(() => { const m = window.__chroma.mode; return { door: [-3.6, 6], x: -3.6 }; });
await tp(D.x, 4.9, 0, -0.05);
await wait(500);
let n = await near();
check('door prompt in front of the door', n?.kind === 'door', JSON.stringify(n));
await pressE();
await waitFor(() => /Grab your weapon first/i.test(document.getElementById('toast').innerText), null, 15000);
await wait(600);
s = await ev(() => ({ mode: window.__chroma.mode.constructor.name, toast: document.getElementById('toast').innerText }));
check('door refuses without a weapon', s.mode === 'House' && /Grab your weapon first/i.test(s.toast), JSON.stringify(s));

console.log('house: grab + swap weapons');
const slot = async (id) => ev((id) => { const sl = window.__chroma.mode.armory.slots.find((x) => x.id === id); return { front: [sl.front.x, sl.front.z], center: [sl.center.x, sl.center.y, sl.center.z], visible: sl.model.visible }; }, id);
const sp = await slot('spritzer');
await tp(sp.front[0], sp.front[1], face(sp.front, [sp.center[0], sp.center[2]]), -0.15);
await wait(600);
await shot('weapon_wall');
n = await near();
check('aiming at the pegboard targets the Spritzer', n?.kind === 'weapon' && n.id === 'spritzer', JSON.stringify(n));
await pressE();
await waitFor(() => window.__chroma.mode.held === 'spritzer', null, 15000);
s = await ev(() => { const m = window.__chroma.mode, a = window.__chroma; return { held: m.held, wid: m.player.model.weaponId, prof: a.profile.weapon, saved: JSON.parse(localStorage.getItem('chroma-clash-profile-v1')).weapon, vis: m.armory.slots.find((x) => x.id === 'spritzer').model.visible, hud: document.querySelector('.ph-weapon')?.textContent }; });
check('E grabs the Spritzer into the hand', s.held === 'spritzer' && s.wid === 'spritzer', JSON.stringify(s));
check('grab sets + saves profile.weapon', s.prof === 'spritzer' && s.saved === 'spritzer', JSON.stringify(s));
check('the display slot is now empty', s.vis === false && /Spritzer/.test(s.hud), JSON.stringify(s));
await shot('grabbed');
const rl = await slot('roller');
await tp(rl.front[0], rl.front[1], face(rl.front, [rl.center[0], rl.center[2]]), -0.3);
await wait(600);
n = await near();
check('the leaning roller is targetable', n?.kind === 'weapon' && n.id === 'roller', JSON.stringify(n));
await pressE();
await waitFor(() => window.__chroma.mode.held === 'roller', null, 15000);
s = await ev(() => { const m = window.__chroma.mode; return { held: m.held, wid: m.player.model.weaponId, sv: m.armory.slots.find((x) => x.id === 'spritzer').model.visible, rv: m.armory.slots.find((x) => x.id === 'roller').model.visible, prof: window.__chroma.profile.weapon }; });
check('swap: roller in hand, spritzer back on the wall', s.held === 'roller' && s.wid === 'roller' && s.sv && !s.rv && s.prof === 'roller', JSON.stringify(s));

console.log('house: leave through the front door');
await tp(-3.6, 4.9, 0, -0.05);
await wait(400);
n = await near();
check('door now offers the plaza', n?.kind === 'door', JSON.stringify(n));
await pressE();
check('door leads to the Plaza', await modeIs('Plaza'));
await wait(800);
s = await ev(() => { const m = window.__chroma.mode, a = window.__chroma; return { from: m.opts.from, weapon: m.player.weapon.id, prof: a.profile.weapon, pos: m.player.pos.toArray() }; });
check('arrived in the plaza armed with the roller', s.weapon === 'roller' && s.prof === 'roller', JSON.stringify(s));
check('spawned just outside the Prism Heights door', s.from === 'house' && Math.hypot(s.pos[0] - 25.0, s.pos[2] - 29.5) < 1.0, JSON.stringify(s.pos));
await fakeLock();
await shot('plaza_door');
await ev(() => { const m = window.__chroma.mode, p = m.player; p.place(p.pos.clone().set(26.2, 0, 29.5), Math.PI / 2); m.rig.snap(p, Math.PI / 2); });
await wait(600);
n = await ev(() => window.__chroma.mode.nearest()?.kind);
check('plaza shows "Enter your home" at the door', n === 'home', String(n));
await pressE();
check('plaza home door leads back into the house', await modeIs('House'));
await wait(600);
await fakeLock();
s = await ev(() => { const m = window.__chroma.mode; return { from: m.opts.from, held: m.held, pos: m.player.pos.toArray(), wid: m.player.model.weaponId }; });
check('back home: inside the door, unarmed again', s.from === 'plaza' && s.held === null && s.wid === null && s.pos[2] > 3.5, JSON.stringify(s));

console.log('house: buy from the NEST & NOOK catalog');
const desk = await ev(() => { const m = window.__chroma.mode; const d = [...m.inst.values()].find((i) => i.def.id === 'desk'); const b = d.box; return [(b.min.x + b.max.x) / 2, b.min.z]; });
await tp(desk[0], desk[1] - 0.7, 0, -0.3);
await wait(500);
n = await near();
check('desk laptop offers the catalog', n?.kind === 'use' && n.use === 'catalog', JSON.stringify(n));
await pressE();
check('catalog opens', await waitFor(() => !!document.querySelector('.hcat.on'), null, 5000));
await clickSel('.hcat [data-tab="sit"]');
await wait(200);
await clickSel('.hcat [data-id="sofa"]');
await wait(200);
const coins0 = await ev(() => window.__chroma.profile.coins);
await clickSel('.hcat [data-buy]');
await waitFor(() => (window.__chroma.profile.house.owned.sofa || 0) > 0, null, 10000);
s = await ev(() => ({ coins: window.__chroma.profile.coins, owned: window.__chroma.profile.house.owned.sofa || 0 }));
check('buying a Puff Sofa spends 1400 coins and adds it to storage', s.coins === coins0 - 1400 && s.owned === 1, JSON.stringify(s));
await waitFor(() => document.querySelectorAll('.hcat img.hthumb.ready').length > 3, null, 60000); // thumbnails render
await shot('catalog');
const thumbs = await ev(() => [...document.querySelectorAll('.hcat img.hthumb.ready')].length);
check('catalog shows rendered 3D thumbnails', thumbs > 3, String(thumbs));
await clickSel('.hcat [data-place]');
check('PLACE IT opens decorate mode holding the sofa', await waitFor(() => { const m = window.__chroma.mode; return m.deco.active && m.deco.hold?.def.id === 'sofa'; }, null, 5000));
await wait(1500);

console.log('house: decorate mode');
// fixed overhead view from the south-east so screen positions are deterministic
await ev(() => { const d = window.__chroma.mode.deco; d.cam.yaw = d.cam.yawT = Math.PI / 4; d.cam.target.set(0, 0, 0); d.cam.dist = d.cam.distT = 18; });
await wait(1500);
// a reserved spot (the strip in front of the weapon wall) is invalid
let xy = await screenOf(-7.2, 0, 2.0);
await page.mouse.move(xy[0], xy[1]);
await waitFor(() => !!window.__chroma.mode.deco.hold?.place, null, 10000);
s = await ev(() => window.__chroma.mode.deco.hold?.place);
check('ghost is red over the weapon-wall strip', s && s.valid === false, JSON.stringify(s));
await page.mouse.click(xy[0], xy[1]); await wait(300);
check('clicking an invalid spot does not place', await ev(() => !window.__chroma.profile.house.items.some((i) => i.id === 'sofa') && !!window.__chroma.mode.deco.hold));
xy = await screenOf(2.0, 0, -2.0);
await page.mouse.move(xy[0], xy[1]); await wait(500);
await page.keyboard.press('KeyR');
await waitFor(() => window.__chroma.mode.deco.hold?.r === 1, null, 10000);
await page.mouse.move(xy[0] + 2, xy[1] + 1);
await waitFor(() => window.__chroma.mode.deco.hold?.place?.valid === true && window.__chroma.mode.deco.hold.place.r === 1, null, 10000);
s = await ev(() => window.__chroma.mode.deco.hold?.place);
check('ghost is green on open floor (rotated)', s && s.valid === true && s.r === 1, JSON.stringify(s));
await shot('deco_ghost');
await page.mouse.click(xy[0] + 2, xy[1] + 1);
await waitFor(() => window.__chroma.profile.house.items.some((i) => i.id === 'sofa'), null, 10000);
const placed = await ev(() => window.__chroma.profile.house.items.find((i) => i.id === 'sofa'));
check('click places the sofa', !!placed && placed.r === 1 && Math.abs(placed.x - 2) < 1 && Math.abs(placed.z + 2) < 1.3, JSON.stringify(placed));
await shot('deco_placed');
// put the beanbag away with X, then bring it back from storage
const bean = await ev(() => { const it = window.__chroma.profile.house.items.find((i) => i.id === 'beanbag'); return [it.x, it.z]; });
xy = await screenOf(bean[0], 0.25, bean[1]);
await page.mouse.move(xy[0], xy[1]);
await waitFor(() => window.__chroma.mode.deco.hover?.def.id === 'beanbag', null, 10000);
const hov = await ev(() => window.__chroma.mode.deco.hover?.def.id);
check('hovering highlights the beanbag', hov === 'beanbag', String(hov));
await page.keyboard.press('KeyX');
await waitFor(() => !window.__chroma.profile.house.items.some((i) => i.id === 'beanbag'), null, 10000);
check('X puts it in storage', await ev(() => !window.__chroma.profile.house.items.some((i) => i.id === 'beanbag') && !!document.querySelector('#house-deco [data-id="beanbag"]')));
await clickSel('#house-deco [data-id="beanbag"]'); await wait(300);
xy = await screenOf(-0.5, 0, 1.5);
await page.mouse.move(xy[0], xy[1]);
await waitFor(() => window.__chroma.mode.deco.hold?.place?.valid === true, null, 10000);
await page.mouse.click(xy[0], xy[1]);
await waitFor(() => window.__chroma.profile.house.items.some((i) => i.id === 'beanbag'), null, 10000);
check('…and back out of storage onto the floor', await ev(() => window.__chroma.profile.house.items.some((i) => i.id === 'beanbag' && Math.abs(i.x + 0.5) < 1 && Math.abs(i.z - 1.5) < 1)));
// wallpaper swap from the tray (only owned styles: cream) + done
await page.keyboard.press('KeyF');
await waitFor(() => !window.__chroma.mode.deco.active, null, 10000);
s = await ev(() => { const m = window.__chroma.mode, sofa = window.__chroma.profile.house.items.find((i) => i.id === 'sofa'); return { deco: m.deco.active, h: m.level.groundAt(sofa.x, sofa.z, 3, 0.1, 0).y }; });
check('F leaves decorate mode; the sofa now blocks movement', !s.deco && s.h > 0.4, JSON.stringify(s));

console.log('house: persistence');
await page.reload();
check('reload lands in the house again', await modeIs('House'));
await wait(600);
s = await ev(() => { const a = window.__chroma, m = a.mode; const sofa = a.profile.house.items.find((i) => i.id === 'sofa'); return { sofa, inst: sofa && !!m.inst.get(sofa.uid)?.group.parent, coins: a.profile.coins, weapon: a.profile.weapon, owned: a.profile.house.owned.sofa }; });
check('sofa persists after reload (same spot + rotation)', s.sofa && s.inst && s.sofa.x === placed.x && s.sofa.z === placed.z && s.sofa.r === placed.r, JSON.stringify(s));
check('coins + weapon persisted', s.coins === coins0 - 1400 && s.weapon === 'roller' && s.owned === 1, JSON.stringify(s));

console.log('house: first-time creation from the title');
await ev(() => localStorage.clear());
await page.goto(`${BASE}index.html?qa&nonews`);
check('title loads', await modeIs('Plaza'));
await wait(1200);
await page.keyboard.press('Enter');
await waitFor(() => !!document.querySelector('.title-screen.armed'), null, 20000);
const label = await page.textContent('.title-menu [data-a="plaza"]');
await clickSel('.title-menu [data-a="plaza"]');
check('PLAY (create) goes to the house', await modeIs('House'));
check('character creator opens in the house', await waitFor(() => !!document.querySelector('.locker.on'), null, 8000), label);
await ev(() => { document.querySelector('.name-in').value = 'Homey'; });
await wait(600);
await shot('create');
await clickSel('.locker [data-back]');
await waitFor(() => window.__chroma.profile.created && !window.__chroma.mode.uiOpen, null, 90000);
s = await ev(() => { const a = window.__chroma, m = a.mode; return { created: a.profile.created, name: a.profile.name, mode: m.constructor.name, held: m.held, house: a.profile.house.items.length }; });
check('created + saved, still home and unarmed', s.created && s.name === 'Homey' && s.mode === 'House' && s.held === null && s.house >= 8, JSON.stringify(s));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${passes} passed, ${fails} failed`);
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
