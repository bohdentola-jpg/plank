// Scripted interaction test: leave the spot, take batteries and a comfort
// item, come back, check the lantern refills and the item appears.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const mobile = process.argv.includes('--mobile');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('file://' + join(root, mobile ? 'hide-mobile.html' : 'hide.html') + '?debug');
await page.waitForFunction(() => window.__hide && window.__hide.state === 'title', null, { timeout: 180000 });
const out = await page.evaluate(() => {
  const g = window.__hide, pl = g.player, log = [];
  g.render = () => {};
  const step = (n = 1) => { for (let i = 0; i < n; i++) g.update(0.05); };
  const press = (k) => { g.input.edges.add(k); step(1); };
  const ok = (cond, msg) => log.push((cond ? 'PASS ' : 'FAIL ') + msg);
  g.dbgStart();
  step(10);
  ok(pl.hidden && pl.hidden.kind === 'hole', 'starts hidden in the hole');
  press('KeyE'); step(40);
  ok(!pl.hidden && !pl.trans, 'E crawls out');
  // face a battery from 1.2 m away
  const b = g.batteries.find((x) => x.active);
  const s = b.spot;
  const fx = s.face !== undefined ? s.x + s.face * 1.2 : s.x, fz = s.face !== undefined ? s.z : s.z - 1.2;
  g.dbgTeleport(fx, fz, Math.atan2(-(s.x - fx), -(s.z - fz)), -0.45);
  pl.collide();
  step(4);
  const it = g.findInteract();
  ok(it && it.kind === 'battery', 'battery is targetable (' + (it ? it.kind : 'none') + ')');
  press('KeyE');
  ok(pl.carry.batteries === 1, 'took batteries');
  // a comfort item
  const c = g.comfortItems[0];
  g.dbgTeleport(c.spot.x + (c.spot.x > g.lvl.W / 2 ? -1.1 : 1.1), c.spot.z, 0, -0.6);
  pl.yaw = Math.atan2(-(c.spot.x - pl.pos.x), -(c.spot.z - pl.pos.z));
  pl.collide();
  pl.yaw = Math.atan2(-(c.spot.x - pl.pos.x), -(c.spot.z - pl.pos.z));
  step(4);
  const it2 = g.findInteract();
  ok(it2 && it2.kind === 'comfort', 'comfort item targetable: ' + c.key + ' (' + (it2 ? it2.kind : 'none') + ')');
  press('KeyE');
  ok(c.state === 'carried', 'carrying ' + c.key);
  // home
  g.lantern = 0.3;
  const h = g.hole;
  g.dbgTeleport(h.enter.x, h.enter.z, h.yaw + Math.PI, 0);
  step(2);
  const it3 = g.findInteract();
  ok(it3 && it3.kind === 'hide', 'hole is targetable (' + (it3 ? it3.kind : 'none') + ')');
  press('KeyE'); step(40);
  ok(pl.hidden === h, 'crawled back in');
  ok(g.lantern > 0.95 && pl.carry.batteries === 0, 'lantern refilled (' + g.lantern.toFixed(2) + ')');
  ok(c.state === 'placed' && g.slots[c.key].visible, c.key + ' placed in the spot');
  // other hiding spots
  for (const hs of g.lvl.hides.filter((x) => x.kind !== 'hole')) {
    press('KeyE'); step(40);
    g.dbgTeleport(hs.enter.x, hs.enter.z, Math.atan2(-(hs.cam.x - hs.enter.x), -(hs.cam.z - hs.enter.z)), 0);
    step(2);
    const i4 = g.findInteract();
    ok(i4 && i4.kind === 'hide' && i4.h === hs, hs.id + ' targetable');
    press('KeyE'); step(40);
    ok(pl.hidden === hs, 'hid in ' + hs.id);
  }
  // flashlight toggle + breath
  press('KeyE'); step(40);
  const f0 = pl.flashlight; press('KeyF'); ok(pl.flashlight !== f0, 'F toggles flashlight');
  g.input.keys.add('Space'); step(60); ok(pl.breath.amount < 0.8, 'holding breath drains air'); g.input.keys.delete('Space'); step(5);
  ok(g.state === 'play', 'still playing: ' + g.state);
  return log;
});
console.log(out.join('\n'));
await browser.close();
