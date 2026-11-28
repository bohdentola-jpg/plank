// Two-player online test in one headless browser (BroadcastChannel transport:
// ?net=local). Host creates a private room, guest joins by code, host starts,
// both sides autoplay; asserts that the guest's actions reach the host and the
// host's world (paint, players, timer, results) reaches the guest.
//   node chroma/tools/nettest.mjs
//   node chroma/tools/nettest.mjs --mode zones   (or hoops: a private match in that
//     mode; also checks both screens agree on the mode state and the result)
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
const transport = process.argv.includes('--peerjs') ? '' : '&net=local';
const argv = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const MODE = argv('mode', 'turf');
const SIM = +argv('sim', MODE === 'turf' ? '1' : '4');
const MATCH_T = +argv('time', MODE === 'turf' ? '25' : '45');
const proxy = (!transport) && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
ctx.setDefaultTimeout(180000); // software GL on a busy machine can take a long time per frame
const errors = [];
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) { pass++; console.log('  ok  ', name, extra); } else { fail++; console.log('  FAIL', name, extra); } };
const mk = async (name) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errors.push(`${name}: ${e.message}`); console.log(`[${name} pageerror]`, e.message); });
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name} console]`, m.text().slice(0, 200)); });
  await page.goto(`${base}?plaza&nonews&qa&fast&autoplay&skipintro${transport}&name=${name}${SIM > 1 ? `&sim=${SIM}` : ''}`);
  await page.waitForFunction(() => window.__chroma?.mode?.constructor.name === 'Plaza' && !window.__chroma.loadingNow, null, { timeout: 180000 });
  return page;
};
const host = await mk('Hosty');
const guest = await mk('Guesty');
console.log('-- both in plaza');
await host.evaluate(() => window.__chroma.mode.openUI('tower'));
await host.waitForTimeout(800);
await host.click('.tower [data-a="private"]');
await host.waitForTimeout(500);
await host.click('.privmenu [data-a="create"]');
await host.waitForSelector('.netroom .room-code b', { timeout: 30000 });
const code = await host.evaluate(() => document.querySelector('.netroom .room-code b').textContent);
check('host created a room', /^[A-Z]{4}$/.test(code), code);
await guest.evaluate(() => window.__chroma.mode.openUI('tower'));
await guest.waitForTimeout(800);
await guest.click('.tower [data-a="private"]');
await guest.waitForTimeout(500);
await guest.fill('.code-in', code);
await guest.click('.privmenu [data-a="join"]');
await guest.waitForSelector('.netroom', { timeout: 30000 });
await host.waitForTimeout(1500);
const hm = await host.evaluate(() => window.__chroma.room.members.map((m) => m.name));
const gm = await guest.evaluate(() => window.__chroma.room.members.map((m) => m.name));
check('host sees both players', hm.length === 2 && hm.includes('Guesty'), JSON.stringify(hm));
check('guest sees the room', gm.length === 2 && gm.includes('Hosty'), JSON.stringify(gm));
// host settings: 1 minute
await host.selectOption('.netroom [data-set="time"]', '60');
await host.waitForTimeout(800);
const gset = await guest.evaluate(() => window.__chroma.room.settings.time);
check('settings sync to guest', gset === 60, String(gset));
// headless software rendering runs at a few fps, so play a short match
await host.evaluate((t) => window.__chroma.room.setSettings({ time: t }), MATCH_T);
if (MODE !== 'turf') {
  await host.selectOption('.netroom [data-set="mode"]', MODE);
  await host.waitForTimeout(800);
  const gm2 = await guest.evaluate(() => window.__chroma.room.settings.mode);
  check('mode setting syncs to guest', gm2 === MODE, String(gm2));
}
await host.waitForTimeout(500);
await host.screenshot({ path: join(qa, 'net_room.png') });
await host.click('.netroom [data-a="start"]');
await Promise.all([host, guest].map((pg) => pg.waitForFunction(() => window.__chroma?.mode?.constructor.name === 'Battle' && !window.__chroma.loadingNow, null, { timeout: 180000 })));
console.log('-- match loaded');
const roles = await Promise.all([host, guest].map((pg) => pg.evaluate(() => { const m = window.__chroma.mode; return { role: m.net?.role, n: m.world.fighters.length, puppets: m.world.fighters.filter((f) => f.puppet).length, me: m.player.name, stage: m.stage.name }; })));
check('host role + puppets', roles[0].role === 'host' && roles[0].puppets === 1 && roles[0].n === 8, JSON.stringify(roles[0]));
check('guest role + puppets', roles[1].role === 'client' && roles[1].puppets === 7 && roles[1].n === 8, JSON.stringify(roles[1]));
check('same stage', roles[0].stage === roles[1].stage, roles[0].stage);
const modeOf = await Promise.all([host, guest].map((pg) => pg.evaluate(() => window.__chroma.mode.rules?.kind || 'turf')));
check('both run the chosen mode', modeOf.every((k) => k === MODE), JSON.stringify(modeOf));
// play for a while
await guest.waitForFunction(() => window.__chroma.mode.state === 'play', null, { timeout: 120000 });
// mode state must agree on both screens while the match runs
const modeProbe = () => {
  const r = window.__chroma.mode.rules;
  if (!r) return null;
  if (r.kind === 'zones') return { ctrl: r.ctrl, count: [r.count[1], r.count[2]], cov: [r.cov[1], r.cov[2]], stats: { ...r.stats } };
  const bw = r.ballWorld(r.ball.pos.clone());
  return { st: r.ball.st, carrier: r.ball.carrier?.name || null, score: [r.score[1], r.score[2]], open: [r.hoops[1].open, r.hoops[2].open], ball: bw.toArray().map((v) => +v.toFixed(1)), stats: { ...r.stats } };
};
const agree = { n: 0, ok: 0, last: null };
if (MODE !== 'turf') {
  for (let i = 0; i < 6; i++) {
    await host.waitForTimeout(4000);
    const [h, g] = await Promise.all([host, guest].map((pg) => pg.evaluate(modeProbe)));
    if (!h || !g) continue;
    agree.n++;
    let ok;
    if (MODE === 'zones') ok = h.ctrl === g.ctrl && Math.abs(h.count[0] - g.count[0]) < 3 && Math.abs(h.count[1] - g.count[1]) < 3;
    else ok = h.score[0] === g.score[0] && h.score[1] === g.score[1] && h.open[0] === g.open[0] && h.open[1] === g.open[1]; // ball state can lag a frame
    if (ok) agree.ok++;
    agree.last = [h, g];
    console.log('   mode host :', JSON.stringify(h));
    console.log('   mode guest:', JSON.stringify(g));
  }
  check('mode state agrees on both screens', agree.n > 0 && agree.ok >= agree.n - 1, `${agree.ok}/${agree.n}`);
} else await host.waitForTimeout(25000);
const st = await Promise.all([host, guest].map((pg) => pg.evaluate(() => { const m = window.__chroma.mode; return { state: m.state, t: m.timeLeft, cov: m.stage.paint.coverage(), turf: m.world.fighters.map((f) => Math.round(f.stats.turf)), guestPos: m.world.fighters.find((f) => f.name === 'Guesty').pos.toArray().map((v) => +v.toFixed(1)) }; })));
console.log('   host :', JSON.stringify(st[0]));
console.log('   guest:', JSON.stringify(st[1]));
const gi = roles[0].n ? st[0].turf.length : 0; void gi;
const hostGuestTurf = await host.evaluate(() => Math.round(window.__chroma.mode.world.fighters.find((f) => f.name === 'Guesty').stats.turf));
check('guest painting reaches the host', hostGuestTurf > 0, `guest turf on host = ${hostGuestTurf}`);
check('paint matches on both screens', Math.abs(st[0].cov.a - st[1].cov.a) < 0.03 && Math.abs(st[0].cov.b - st[1].cov.b) < 0.03, JSON.stringify([st[0].cov, st[1].cov]));
check('guest position replicated on host', st[0].guestPos.every((v, i) => Math.abs(v - st[1].guestPos[i]) < 3), JSON.stringify([st[0].guestPos, st[1].guestPos]));
check('timer synced', Math.abs(st[0].t - st[1].t) < 3 && st[0].t < MATCH_T, `${st[0].t} vs ${st[1].t}`);
await guest.screenshot({ path: join(qa, MODE === 'turf' ? 'net_guest.png' : `net_${MODE}_guest.png`) });
await host.screenshot({ path: join(qa, MODE === 'turf' ? 'net_host.png' : `net_${MODE}_host.png`) });
// wait for the end + results
await Promise.all([host, guest].map((pg) => pg.waitForFunction(() => window.__chroma.mode.state === 'results' || document.querySelector('.results'), null, { timeout: 900000 })));
const res = await Promise.all([host, guest].map((pg) => pg.evaluate(() => window.__chroma.mode.result)));
check('both got the same result', res[0] && res[1] && res[0].winner === res[1].winner && Math.abs(res[0].a - res[1].a) < 0.01 && Math.abs(res[0].b - res[1].b) < 0.01 && (res[0].mode || 'turf') === (res[1].mode || 'turf'), JSON.stringify(res));
if (MODE !== 'turf') {
  check('result is a ' + MODE + ' result', res.every((r) => r.mode === MODE), JSON.stringify(res.map((r) => r.mode)));
  const shown = await Promise.all([host, guest].map((pg) => pg.evaluate(() => document.querySelector('.rs-pct')?.textContent || '')));
  check('results screens show the same score line', shown[0] && shown[0] === shown[1], JSON.stringify(shown));
  const fin = await Promise.all([host, guest].map((pg) => pg.evaluate(() => window.__chroma.mode.rules.stats)));
  console.log('   final mode stats host/guest:', JSON.stringify(fin));
  if (MODE === 'hoops') check('ball was grabbed + thrown during the match', fin[0].grabs > 0 && fin[0].throws > 0, JSON.stringify(fin[0]));
  else check('zone was captured during the match', fin[0].captures > 0, JSON.stringify(fin[0]));
}
// back to the room
await guest.click('.results [data-a="again"]');
await host.click('.results [data-a="again"]');
await Promise.all([host, guest].map((pg) => pg.waitForSelector('.netroom', { timeout: 180000 })));
const back = await Promise.all([host, guest].map((pg) => pg.evaluate(() => ({ members: window.__chroma.room?.members.length, phase: window.__chroma.room?.phase }))));
check('both back in the room', back.every((b) => b.members === 2), JSON.stringify(back));
console.log('errors:', errors.length, errors.slice(0, 5));
console.log(`${pass} passed, ${fail} failed`);
await browser.close(); server.close(); process.exit(fail || errors.length ? 1 : 0);
