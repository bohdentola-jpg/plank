// Two real clients, one real WebRTC data channel, one local signalling server.
//
// The PeerJS cloud is not reachable from a sandbox, and a multiplayer game that has never
// had a second client attached is a coin flip — so this stands up peerjs-server on
// localhost, opens two browser pages against the built one-file port, hosts on one, joins
// on the other, starts the descent, and then checks the things that actually matter:
//
//   · they end up on the SAME floor built from the SAME seed (the level never goes over
//     the wire, so if the seeds disagree they are in different buildings)
//   · each one can see the other's hazmat suit in its own scene, in the right place
//   · the monster the guest sees is the one the host is simulating
//   · a death on one side shows up on the other
//
//   node tools/net-noclip.mjs [--head]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PeerServer } from 'peer';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const files = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/qa/noclip-online.local.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => files.listen(0, r));
const port = files.address().port;

// the signalling server: introductions only, the media never touches it
const SIG = 9411;
// IPv6 is not available in the sandbox, so bind v4 explicitly
const sig = PeerServer({ port: SIG, host: '127.0.0.1', path: '/', allow_discovery: true });
await new Promise((r) => setTimeout(r, 400));

let failures = 0;
const ok = (m) => console.log(`ok   ${m}`);
const fail = (m) => { failures++; console.error(`FAIL ${m}`); };

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist',
    '--allow-file-access-from-files', '--disable-web-security'],
});
const ctx = await browser.newContext({ viewport: { width: 900, height: 560 } });
const A = await ctx.newPage();          // the host
const B = await ctx.newPage();          // the guest
const errsA = [], errsB = [];
A.on('pageerror', (e) => errsA.push(e.message));
B.on('pageerror', (e) => errsB.push(e.message));

// point both pages at the local signalling server before the bundle runs
const boot = async (page, name) => {
  await page.addInitScript(`window.NOCLIP_PEER_OPTS = { host: '127.0.0.1', port: ${SIG}, path: '/', secure: false };`);
  await page.goto(`http://127.0.0.1:${port}/qa/noclip-online.local.html`);
  await page.waitForFunction(() => !!window.NOCLIP_ONLINE, { timeout: 60000 });
  await page.fill('#name', name);
  await page.evaluate((n) => { window.NOCLIP_ONLINE.me.name = n; }, name);
};
await boot(A, 'HOSTY');
await boot(B, 'GUESTY');
ok('both clients booted the one-file build');

// ---------------------------------------------------------------- host + join
await A.click('#d-host');
await A.waitForFunction(() => document.getElementById('scr-lobby')?.classList.contains('on'), { timeout: 40000 })
  .catch(() => fail('host never reached the lobby'));
const code = await A.textContent('#lobby-code');
if (!code || code.length !== 4) fail(`host lobby code looks wrong: "${code}"`);
else ok(`hosting on ${code}`);

await B.fill('#code', code.trim());
await B.click('#d-join');
await B.waitForFunction(() => document.getElementById('scr-lobby')?.classList.contains('on'), { timeout: 40000 })
  .catch(() => fail('guest never reached the lobby'));
await A.waitForFunction(() => window.NOCLIP_ONLINE.party.size >= 1, { timeout: 30000 })
  .catch(() => fail('host never saw the guest arrive'));
const roster = await A.evaluate(() => [...window.NOCLIP_ONLINE.party.values()].map((p) => p.name));
ok(`the party is ${JSON.stringify(roster)} on the host's side`);

// ---------------------------------------------------------------- the descent
await A.click('#lobby-go');
for (const [p, who] of [[A, 'host'], [B, 'guest']]) {
  await p.waitForFunction(() => window.NOCLIP_ONLINE.state === 'play', { timeout: 90000 })
    .catch(() => fail(`${who} never reached the floor`));
}
const sameFloor = async () => ({
  a: await A.evaluate(() => ({ id: window.NOCLIP_ONLINE.levelId, seed: window.NOCLIP_ONLINE.seeds[window.NOCLIP_ONLINE.floorIndex], cells: window.NOCLIP_ONLINE.world.data.stats.walkable, at: window.NOCLIP_ONLINE.floorIndex })),
  b: await B.evaluate(() => ({ id: window.NOCLIP_ONLINE.levelId, seed: window.NOCLIP_ONLINE.seeds[window.NOCLIP_ONLINE.floorIndex], cells: window.NOCLIP_ONLINE.world.data.stats.walkable, at: window.NOCLIP_ONLINE.floorIndex })),
});
const f = await sameFloor();
if (f.a.id !== f.b.id || f.a.seed !== f.b.seed || f.a.cells !== f.b.cells) {
  fail(`they are in different buildings: ${JSON.stringify(f)}`);
} else ok(`both on floor ${f.a.at + 1} — ${f.a.id} seed ${f.a.seed}, ${f.a.cells} identical cells`);

// ---------------------------------------------------------------- seeing each other
// walk the guest somewhere and check the host's copy of them moves to match
await B.evaluate(async () => {
  const g = window.NOCLIP_ONLINE;
  g.player.spawn(g.player.pos.x + 6, g.player.pos.z + 3, 1.2);
  g.lampOn = false;
  await new Promise((r) => setTimeout(r, 900));
});
await new Promise((r) => setTimeout(r, 1600));
const seen = await A.evaluate(() => {
  const g = window.NOCLIP_ONLINE;
  const rows = [...g.crowd.people.entries()].map(([id, p]) => ({
    id, name: p.name, suit: p.suit, torch: p.torch,
    at: [Math.round(p.to.x), Math.round(p.to.z)],
    inScene: !!p.mesh.parent, meshes: p.mesh.children.length,
  }));
  return { count: rows.length, rows };
});
const where = await B.evaluate(() => [Math.round(window.NOCLIP_ONLINE.player.pos.x), Math.round(window.NOCLIP_ONLINE.player.pos.z)]);
if (!seen.count) fail('the host cannot see the guest at all');
else {
  const r = seen.rows[0];
  const close = Math.abs(r.at[0] - where[0]) <= 2 && Math.abs(r.at[1] - where[1]) <= 2;
  if (!close) fail(`the host has the guest at ${r.at} but they are at ${where}`);
  else ok(`host sees ${r.name} in a ${r.suit} suit at ${r.at} (${r.meshes} parts, torch ${r.torch})`);
}
const seenB = await B.evaluate(() => window.NOCLIP_ONLINE.crowd.people.size);
if (!seenB) fail('the guest cannot see the host');
else ok('the guest sees the host too');

// ---------------------------------------------------------------- the monster
await new Promise((r) => setTimeout(r, 1200));
const mon = {
  a: await A.evaluate(() => { const m = window.NOCLIP_ONLINE.entities.monster; return m ? [Math.round(m.pos.x), Math.round(m.pos.z), m.state] : null; }),
  b: await B.evaluate(() => { const m = window.NOCLIP_ONLINE.entities.monster; return m ? [Math.round(m.pos.x), Math.round(m.pos.z), m.state] : null; }),
};
if (!mon.a || !mon.b) fail(`somebody has no monster: ${JSON.stringify(mon)}`);
else if (Math.abs(mon.a[0] - mon.b[0]) > 4 || Math.abs(mon.a[1] - mon.b[1]) > 4) {
  fail(`the guest's monster is somewhere else: host ${mon.a} guest ${mon.b}`);
} else ok(`the thing is at ${mon.a[0]},${mon.a[1]} (${mon.a[2]}) on both sides`);

// ---------------------------------------------------------------- a death
await B.evaluate(() => window.NOCLIP_ONLINE.onCaught({ sp: { name: 'FACELING' } }, null));
await new Promise((r) => setTimeout(r, 1200));
const deathSeen = await A.evaluate(() => ({
  downed: [...window.NOCLIP_ONLINE.downed],
  alive: window.NOCLIP_ONLINE.aliveCount(),
}));
if (!deathSeen.downed.length) fail('the host never heard that the guest died');
else ok(`host knows somebody is down — ${deathSeen.alive} still alive`);

// ---------------------------------------------------------------- screenshots
// stand the host next to the guest and look at them, so the suit is actually in frame
await A.evaluate(async () => {
  const g = window.NOCLIP_ONLINE;
  const other = [...g.crowd.people.values()][0];
  if (!other) return;
  const t = other.mesh.position;
  const a = 2.6;
  g.player.spawn(t.x + Math.sin(a) * 3.4, t.z + Math.cos(a) * 3.4, Math.atan2(-(t.x - (t.x + Math.sin(a) * 3.4)), -(t.z - (t.z + Math.cos(a) * 3.4))));
  g.player.pitch = 0;
  g.lampOn = true;
  g.dead = false;
});
await new Promise((r) => setTimeout(r, 1400));
await A.evaluate(() => { window.NOCLIP_ONLINE.player.pitch = 0; });
await new Promise((r) => setTimeout(r, 600));
await A.screenshot({ path: join(root, 'qa/net-suit.png') });
await A.screenshot({ path: join(root, 'qa/net-host.png') });
await B.screenshot({ path: join(root, 'qa/net-guest.png') });

for (const [errs, who] of [[errsA, 'host'], [errsB, 'guest']]) {
  for (const e of [...new Set(errs)].slice(0, 5)) fail(`${who} threw: ${e.split('\n')[0]}`);
}

await browser.close();
files.close();
sig.close?.();
console.log(failures ? `\n${failures} failure(s)` : '\ntwo clients, one building, everybody visible');
process.exit(failures ? 1 : 0);
