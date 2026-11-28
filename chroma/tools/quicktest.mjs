// Online quick-match test: two tabs press ONLINE MATCH and must land in the
// same public lobby, the countdown must start, and the host can start early.
//   node chroma/tools/quicktest.mjs           (BroadcastChannel transport)
//   node chroma/tools/quicktest.mjs --peerjs  (real PeerJS broker + WebRTC)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => { try { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/chroma/index.html`;
const real = process.argv.includes('--peerjs');
const transport = real ? '' : '&net=local';
const proxy = (real) && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
const errors = [];
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) { pass++; console.log('  ok  ', name, extra); } else { fail++; console.log('  FAIL', name, extra); } };
const mk = async (name) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errors.push(`${name}: ${e.message}`); console.log(`[${name} pageerror]`, e.message); });
  page.on('console', (m) => { if (m.type() === 'error' || /peer|net/i.test(m.text())) console.log(`[${name} ${m.type()}]`, m.text().slice(0, 200)); });
  await page.goto(`${base}?plaza&nonews&qa&fast${transport}&name=${name}`);
  await page.waitForFunction(() => window.__chroma?.mode?.constructor.name === 'Plaza' && !window.__chroma.loadingNow, null, { timeout: 180000 });
  return page;
};
const a = await mk('Alpha');
const b = await mk('Bravo');
for (const pg of [a, b]) {
  await pg.evaluate(() => window.__chroma.mode.openUI('tower'));
  await pg.waitForTimeout(600);
  await pg.click('.tower [data-a="online"]');
  await pg.waitForTimeout(real ? 4000 : 1500);
}
await Promise.all([a, b].map((pg) => pg.waitForSelector('.netroom', { timeout: 60000 })));
await a.waitForTimeout(3500);
const st = await Promise.all([a, b].map((pg) => pg.evaluate(() => { const r = window.__chroma.room; return { host: r?.isHost, kind: r?.kind, members: r?.members.map((m) => m.name), countdown: r?.countdown, btn: document.querySelector('.netroom [data-a="start"]')?.textContent || null }; })));
console.log(JSON.stringify(st));
check('both in a public lobby', st.every((s) => s.kind === 'quick' && s.members?.length === 2), JSON.stringify(st.map((s) => s.members)));
check('exactly one host', st.filter((s) => s.host).length === 1);
const hostPg = st[0].host ? a : b;
const hs = st[0].host ? st[0] : st[1];
check('countdown running', typeof hs.countdown === 'number' && hs.countdown <= 30 && hs.countdown > 20, String(hs.countdown));
const guestCd = await (hostPg === a ? b : a).evaluate(() => document.querySelector('.netroom')?.textContent.match(/\b(\d{1,2})\s*s\b/)?.[1] || window.__chroma.room?.countdown);
check('guest sees the countdown', guestCd != null, String(guestCd));
await hostPg.click('.netroom [data-a="start"]');
await Promise.all([a, b].map((pg) => pg.waitForFunction(() => window.__chroma?.mode?.constructor.name === 'Battle' && !window.__chroma.loadingNow, null, { timeout: 180000 })));
const roles = await Promise.all([a, b].map((pg) => pg.evaluate(() => ({ role: window.__chroma.mode.net?.role, stage: window.__chroma.mode.stage.name, n: window.__chroma.mode.world.fighters.length }))));
check('match started on both', roles.every((r) => r.n === 8) && roles[0].stage === roles[1].stage && roles.map((r) => r.role).sort().join() === 'client,host', JSON.stringify(roles));
await a.waitForFunction(() => window.__chroma.mode.state === 'play', null, { timeout: 120000 });
await b.waitForFunction(() => window.__chroma.mode.state === 'play', null, { timeout: 120000 });
check('both reached play', true);
console.log('errors:', errors.length, errors.slice(0, 5));
console.log(`${pass} passed, ${fail} failed`);
await browser.close(); server.close(); process.exit(fail || errors.length ? 1 : 0);
