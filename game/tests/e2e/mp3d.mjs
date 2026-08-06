// two real browsers over a local peerjs-server: presence, movement, chat,
// boxes, blaster pops, pong, and host migration — in 3D.
import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, '..', 'qa', 'shots');
await fs.mkdir(SHOTS, { recursive: true });
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css' };
const server = http.createServer(async (req,res)=>{ try{ let p=new URL(req.url,'http://x').pathname; if(p==='/')p='/index.html';
  res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});
  res.end(await fs.readFile(path.join(ROOT,p)));}catch(e){res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(8899,r));
const peerServer = PeerServer({ host: '127.0.0.1', port: 9101, path: '/gp' });

let failed = 0;
const check = (n, c, extra='') => { if (c) console.log('  ok  ' + n); else { console.log('FAIL  ' + n + (extra?' — '+extra:'')); failed = 1; } };
const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

async function player(name) {
  const ctx = await browser.newContext({ viewport:{width:1000,height:640} });
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log(`PAGEERROR(${name}):`, e.message); failed = 1; });
  await page.addInitScript(() => {
    window.GAME_PEER_CONFIG = { host:'127.0.0.1', port:9101, path:'/gp', secure:false };
  });
  await page.goto('http://127.0.0.1:8899/', { waitUntil:'networkidle' });
  await page.fill('#name', name);
  return page;
}
const resume = async (p) => { await p.evaluate(() => { const s = window.__game.session; if (s && s.paused) s.setPaused(false); }); };
const settle = async (pages, ms) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { for (const p of pages) await resume(p); await pages[0].waitForTimeout(200); }
};

const A = await player('alice');
const B = await player('bob');

// A hosts a private lobby on the main world
await A.click('#btn-private');
await A.click('#btn-priv-make');
await A.waitForFunction(() => window.__game.session && window.__game.session.lobby, null, { timeout: 25000 });
const code = await A.evaluate(() => window.__game.session.lobby.code);
check('host got a 4-letter code', typeof code === 'string' && code.length === 4, String(code));

// B joins
await B.click('#btn-private');
await B.fill('#priv-code', code);
await B.click('#btn-priv-join');
await B.waitForFunction(() => window.__game.session && window.__game.session.lobby && !window.__game.session.lobby.isHost, null, { timeout: 25000 });
await settle([A, B], 2500);

const counts = await Promise.all([A, B].map(p => p.evaluate(() => window.__game.session.players.size)));
check('both see two players', counts[0] === 2 && counts[1] === 2, JSON.stringify(counts));

const bId = await B.evaluate(() => window.__game.session.me.id);
const aId = await A.evaluate(() => window.__game.session.me.id);

// movement sync
const before = await A.evaluate(id => { const p = window.__game.session.players.get(id); return p ? p.x : null; }, bId);
await B.evaluate(() => { window.__game.session.keys.add('w'); });
await settle([A, B], 1600);
await B.evaluate(() => { window.__game.session.keys.delete('w'); });
await settle([A, B], 1200);
const after = await A.evaluate(id => { const p = window.__game.session.players.get(id); return p ? { x: p.x, z: p.z } : null; }, bId);
const moved = after && Math.hypot(after.x - before, after.z) > 2;
check('the host sees the guest walk', moved, JSON.stringify({ before, after }));

// chat both ways
await A.evaluate(() => window.__game.session.sendChat('hi bob'));
await B.evaluate(() => window.__game.session.sendChat('hi alice'));
await settle([A, B], 1400);
const onB = await B.evaluate(id => { const p = window.__game.session.players.get(id); return p && p.bubbles.length ? p.bubbles[0].text : null; }, aId);
const onA = await A.evaluate(id => { const p = window.__game.session.players.get(id); return p && p.bubbles.length ? p.bubbles[0].text : null; }, bId);
check('chat reaches the guest', onB === 'hi bob', String(onB));
check('chat reaches the host', onA === 'hi alice', String(onA));
const bubbleEls = await B.evaluate(() => document.querySelectorAll('.bubble.theirs').length);
check('the bubble is drawn in the gray style', bubbleEls > 0, 'els=' + bubbleEls);

// the guest picks up a shared box; the host sees it carried
await B.evaluate(() => {
  const s = window.__game.session;
  const box = s.ents.find(e => e.model === 'box' && e.synced);
  s.me.x = box.x; s.me.z = box.z + 1.2; s.me.y = box.y;
});
await settle([A, B], 900);
await B.evaluate(() => window.__game.session.interact());
await settle([A, B], 1400);
const heldB = await B.evaluate(() => window.__game.session.me.holding && window.__game.session.me.holding.kind);
const heldSeen = await A.evaluate(id => window.__game.session.ents.some(e => e.heldBy === id), bId);
check('the guest carries a box', heldB === 'box', String(heldB));
check('the host sees it carried', heldSeen);

// and throwing it registers on the host
const boxId = await B.evaluate(() => window.__game.session.me.holding.id);
await B.evaluate(() => window.__game.session.primary());
await settle([A, B], 900);
const thrown = await A.evaluate(id => {
  const e = window.__game.session.ents.find(x => x.id === id);
  return e ? { held: e.heldBy, speed: Math.hypot(e.vx, e.vy, e.vz) } : null;
}, boxId);
check('the host registers the throw', thrown && !thrown.held, JSON.stringify(thrown));

// blaster: the host pops the guest, and only the host may say so
await A.evaluate(() => {
  const s = window.__game.session;
  const stand = s.ents.find(e => e.model === 'blasterstand');
  s.me.x = stand.x + 1.5; s.me.z = stand.z; s.me.y = stand.y;
});
await settle([A, B], 700);
await A.evaluate(() => window.__game.session.interact());
await settle([A, B], 700);
const armed = await A.evaluate(() => window.__game.session.me.holding && window.__game.session.me.holding.kind);
check('the host grabbed a blaster', armed === 'blaster', String(armed));

// put the guest in the open, in their own session, and let it sync over
const spot = await A.evaluate(() => ({ x: window.__game.session.me.x, y: window.__game.session.me.y, z: window.__game.session.me.z }));
await B.evaluate((s0) => {
  const s = window.__game.session;
  s.me.x = s0.x + 9; s.me.z = s0.z; s.me.y = s0.y;
  s.me.vx = 0; s.me.vz = 0;
}, spot);
await settle([A, B], 1600);
const popped = await A.evaluate(async (id) => {
  const s = window.__game.session;
  for (let i = 0; i < 40; i++) {
    const t = s.players.get(id);
    if (!t) return false;
    if (t.dead) return true;
    // look straight at them through the real camera, then fire
    s.view.cam.yaw = Math.atan2(t.x - s.me.x, t.z - s.me.z);
    s.view.cam.pitch = 0.02;
    s.view.updateCamera({ x: s.me.x, y: s.me.y + 2.1, z: s.me.z, lerp: () => {}, copy: () => {} }, 1, null, {});
    s.view.camera.position.set(s.me.x, s.me.y + 2.4, s.me.z);
    s.view.camera.lookAt(t.x, t.y + 1.8, t.z);
    s.shootCool = 0;
    s.primary();
    await new Promise(r => setTimeout(r, 130));
  }
  return !!(s.players.get(id) && s.players.get(id).dead);
}, bId);
check('a blaster bolt pops the other player', popped);
await settle([A, B], 600);
const guestKnows = await B.evaluate(() => window.__game.session.me.dead || window.__game.session.bursts.length > 0);
check('the guest is told they popped', guestKnows);
await A.screenshot({ path: path.join(SHOTS, 'mp-pop.png') });

// a client cannot forge a death for the host
const forged = await B.evaluate(async (hostId) => {
  const s = window.__game.session;
  s.lobby.send({ t: 'ev', k: 'pop', id: hostId, by: s.me.id, x: 0, y: 0, z: 0 });
  await new Promise(r => setTimeout(r, 900));
  return true;
}, aId);
await settle([A, B], 900);
const hostAlive = await A.evaluate(() => !window.__game.session.me.dead);
check('a forged death event is ignored by the host', forged && hostAlive);

await settle([A, B], 3500);   // let the guest respawn

// pong for two
for (const [p, side] of [[A, 'L'], [B, 'R']]) {
  await p.evaluate((side) => {
    const s = window.__game.session;
    s.me.holding = null;
    const st = s.pong.station(side);
    s.me.x = st.x; s.me.z = st.z; s.me.y = s.world.heightAt(st.x, st.z);
  }, side);
  await settle([A, B], 800);
  await p.evaluate(() => window.__game.session.interact());
  await settle([A, B], 1400);
}
const sides = await A.evaluate(() => window.__game.session.pong.sides);
check('two humans hold the table', [sides.L, sides.R].filter(s => s && s !== 'bot').length === 2, JSON.stringify(sides));
const ball = await A.evaluate(async () => {
  const s = window.__game.session;
  for (let i = 0; i < 50; i++) { if (s.pong.ball) return true; await new Promise(r => setTimeout(r, 120)); }
  return false;
});
check('the ball is served', ball);
const ballOnGuest = await B.evaluate(() => !!window.__game.session.pong.ball);
check('the guest sees the same ball', ballOnGuest);
await A.screenshot({ path: path.join(SHOTS, 'mp-pong.png') });

// host migration
await A.close();
const migrated = await B.evaluate(async () => {
  const s = window.__game.session;
  for (let i = 0; i < 160; i++) {
    if (s.paused) s.setPaused(false);
    if (s.lobby && s.lobby.isHost && !s.migrating) return { code: s.lobby.code, seat: s.me.pongSide, held: s.ents.filter(e => e.heldBy).length };
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
});
check('the guest takes over the lobby, same code', migrated && migrated.code === code, JSON.stringify(migrated));
check('no ghost seats or held boxes survive the handover', migrated && migrated.held === 0, JSON.stringify(migrated));
const soloAgain = await B.evaluate(() => window.__game.session.players.size);
check('the roster is rebuilt from scratch', soloAgain === 1, 'players=' + soloAgain);

await browser.close();
server.close();
process.exit(failed);
