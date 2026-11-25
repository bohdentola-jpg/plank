// Logic soak test: runs the game loop headless (no rendering) for a simulated
// night and reports monster state changes, pathing failures and exceptions.
//   node tools/sim.mjs [--mobile] [--secs 400] [--mode hole|roam]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const mobile = args.includes('--mobile');
const secs = +opt('secs', 400);
const mode = opt('mode', 'hole');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 300)); });
await page.goto('file://' + join(root, mobile ? 'hide-mobile.html' : 'hide.html') + '?debug');
await page.waitForFunction(() => window.__hide && window.__hide.state === 'title', null, { timeout: 180000 });
const res = await page.evaluate(({ secs, mode }) => {
  const g = window.__hide;
  g.render = () => {};
  g.dbgStart();
  const log = [];
  let last = '', t = 0, deaths = 0, minD = 99, checks = 0, chases = 0;
  const pl = g.player;
  // a scripted "player": roam mode walks between random points, hole mode stays hidden & holds breath when checked
  let wp = null;
  const inp0 = g.input.read.bind(g.input);
  let holdBreath = false;
  g.input.read = () => {
    const r = inp0();
    r.breath = holdBreath;
    if (mode === 'roam' && !pl.hidden && !pl.trans && g.state === 'play') {
      if (!wp || Math.hypot(wp.x - pl.pos.x, wp.z - pl.pos.z) < 1) {
        const p = g.lvl.pois[Math.floor(Math.random() * g.lvl.pois.length)];
        wp = g.nav.path(pl.pos.x, pl.pos.z, p.x, p.z);
        wp = wp && wp.length ? wp : null;
        if (wp) wp = wp[0];
      }
      if (wp) {
        const want = Math.atan2(-(wp.x - pl.pos.x), -(wp.z - pl.pos.z));
        pl.yaw = want;
        r.y = 1;
        r.x = 0;
      }
    }
    return r;
  };
  if (mode === 'roam') g.dbgTeleport(g.hole.enter.x, g.hole.enter.z, Math.PI / 2);
  const dt = 0.05;
  for (let i = 0; i < secs / dt; i++) {
    t += dt;
    const m = g.monster;
    holdBreath = mode === 'hole' && m.state === 'check' && pl.hidden === m.spot && pl.breath.amount > 0.05;
    try { g.update(dt); } catch (e) { log.push('EXC ' + e.message + ' ' + e.stack.split('\n')[1]); break; }
    const st = m.state;
    if (st !== last) {
      log.push(`${t.toFixed(1)}s ${last} -> ${st}  m=(${m.pos.x.toFixed(1)},${m.pos.z.toFixed(1)}) d=${(m.distToPlayer ?? 0).toFixed(1)} fear=${g.fear.toFixed(2)} lantern=${g.lantern.toFixed(2)}`);
      if (st === 'check') checks++;
      if (st === 'chase') chases++;
      last = st;
    }
    minD = Math.min(minD, m.distToPlayer ?? 99);
    if (g.state === 'dying' || g.state === 'dead') {
      deaths++;
      log.push(`${t.toFixed(1)}s DEATH (susp=${m.suspicion.toFixed(2)})`);
      g.restart();
      if (mode === 'roam') g.dbgTeleport(g.hole.enter.x, g.hole.enter.z, Math.PI / 2);
      last = '';
    }
    if (g.state === 'won') { log.push(`${t.toFixed(1)}s WON`); break; }
  }
  return { log, deaths, minD, checks, chases, hour: g.hour, clock: g.fmtTime() };
}, { secs, mode });
console.log(res.log.join('\n'));
console.log(JSON.stringify({ deaths: res.deaths, minD: res.minD.toFixed(2), checks: res.checks, chases: res.chases, clock: res.clock }));
await browser.close();
