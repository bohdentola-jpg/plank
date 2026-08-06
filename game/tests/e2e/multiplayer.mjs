// Real two-browser multiplayer test: local peerjs-server + two pages.
// Host opens a private lobby, guest joins by code; verify presence, movement
// sync, chat, box pickup/throw, blaster pop, and ping pong join.
import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, '..', 'qa', 'shots');
await fs.mkdir(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    let p = new URL(req.url, 'http://x').pathname;
    if (p === '/') p = '/index.html';
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(await fs.readFile(path.join(ROOT, p)));
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8899, r));
const peerServer = PeerServer({ host: '127.0.0.1', port: 9101, path: '/gp' });

let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log('  ok  ' + name);
  else { console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); failed = 1; }
};

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream'] });

async function newPlayer(name) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`PAGEERROR(${name}):`, e.message));
  await page.addInitScript(() => {
    window.GAME_PEER_CONFIG = { host: '127.0.0.1', port: 9101, path: '/gp', secure: false };
  });
  await page.goto('http://127.0.0.1:8899/', { waitUntil: 'networkidle' });
  await page.fill('#name', name);
  return page;
}

const A = await newPlayer('alice');
const B = await newPlayer('bob');

// --- A hosts a private lobby on the MAIN map
await A.click('#btn-private');
await A.click('#btn-priv-make');
await A.waitForFunction(() => window.__game.session && window.__game.session.lobby, null, { timeout: 15000 });
const code = await A.evaluate(() => window.__game.session.lobby.code);
check('host got a lobby code', typeof code === 'string' && code.length === 4, String(code));

// --- B joins with the code
await B.click('#btn-private');
await B.fill('#priv-code', code);
await B.click('#btn-priv-join');
await B.waitForFunction(() => window.__game.session && window.__game.session.lobby && !window.__game.session.lobby.isHost, null, { timeout: 15000 });
await A.waitForTimeout(1500);

const aPlayers = await A.evaluate(() => window.__game.session.players.size);
const bPlayers = await B.evaluate(() => window.__game.session.players.size);
check('both see 2 players', aPlayers === 2 && bPlayers === 2, `A=${aPlayers} B=${bPlayers}`);

// --- movement sync: B walks right, A should see B move
const bId = await B.evaluate(() => window.__game.session.me.id);
const before = await A.evaluate((id) => { const p = window.__game.session.players.get(id); return p ? p.x : null; }, bId);
await B.keyboard.down('d');
await B.waitForTimeout(1000);
await B.keyboard.up('d');
await B.waitForTimeout(700);
const after = await A.evaluate((id) => { const p = window.__game.session.players.get(id); return p ? p.x : null; }, bId);
check('movement syncs to host', before != null && after != null && after - before > 30, `${before} → ${after}`);

// --- chat: A talks, B sees the bubble on A's player
await A.keyboard.press('t');
await A.fill('#chatinput', 'hi bob!');
await A.keyboard.press('Enter');
await A.waitForTimeout(700);
const aId = await A.evaluate(() => window.__game.session.me.id);
const bubbleOnB = await B.evaluate((id) => {
  const p = window.__game.session.players.get(id);
  return p && p.bubbles && p.bubbles.length ? p.bubbles[0].text : null;
}, aId);
check('chat crosses the wire', bubbleOnB === 'hi bob!', String(bubbleOnB));

// --- box pickup: A teleports to a box and grabs it
await A.evaluate(() => {
  const s = window.__game.session;
  const box = s.ents.find(e => e.model === 'box');
  s.me.x = box.x; s.me.y = box.y - 10;
});
await A.keyboard.press('e');
await A.waitForTimeout(700);
const held = await A.evaluate(() => window.__game.session.me.holding && window.__game.session.me.holding.kind);
check('picked up a box', held === 'box', String(held));
const heldOnB = await B.evaluate((id) => {
  const s = window.__game.session;
  return s.ents.some(e => e.heldBy === id);
}, aId);
check('guest sees the held box', heldOnB === true);

// throw it
await A.mouse.move(900, 300);
await A.mouse.down(); await A.mouse.up();
await A.waitForTimeout(400);
const heldAfter = await A.evaluate(() => window.__game.session.me.holding);
check('box thrown', heldAfter === null);

// --- blaster: A grabs from stand and pops B
await A.evaluate(() => {
  const s = window.__game.session;
  const stand = s.ents.find(e => e.model === 'blasterstand');
  s.me.x = stand.x; s.me.y = stand.y - 10;
});
await A.keyboard.press('e');
await A.waitForTimeout(300);
const gun = await A.evaluate(() => window.__game.session.me.holding && window.__game.session.me.holding.kind);
check('grabbed blaster from stand', gun === 'blaster', String(gun));

// duel on empty ground far from any boxes, then A shoots at B
await A.evaluate(() => { const s = window.__game.session; s.me.x = 1000; s.me.y = -12; s.me.vx = 0; });
await B.evaluate(() => { const s = window.__game.session; s.me.x = 1070; s.me.y = -12; s.me.vx = 0; });
await B.waitForTimeout(900); // let state + camera settle
const screen = await A.evaluate((id) => {
  const s = window.__game.session;
  const p = s.players.get(id);
  return s.renderer.worldToScreen(p.x, p.y);
}, bId);
await A.mouse.move(screen.x, screen.y);
await A.waitForTimeout(250);
await A.mouse.down(); await A.mouse.up();
await A.waitForTimeout(1500);
const bDead = await B.evaluate(() => window.__game.session.me.dead || window.__game.session.me.deadT > 0 || window.__game.session.bursts.length > 0 || true);
const popped = await B.evaluate(() => window.__game.session.me.dead);
const burstsSeen = await A.evaluate(() => window.__game.session.bursts.length);
check('blaster pop lands (dead or cardboard burst seen)', popped || burstsSeen > 0, `dead=${popped} bursts=${burstsSeen}`);
await A.screenshot({ path: path.join(SHOTS, 'mp-pop.png') });
await B.waitForTimeout(3000); // respawn

// --- ping pong: both join the table (A first — still holding the blaster,
// which should be stashed automatically; then B on the synced free side)
for (const [P] of [[A], [B]]) {
  await P.evaluate(() => {
    const s = window.__game.session;
    const t = s.pong;
    const side = !t.sides.L || t.sides.L === 'bot' ? 'L' : 'R';
    s.me.x = t.stationX(side);
    s.me.y = t.groundY - 12;
  });
  await P.keyboard.press('e');
  await P.waitForTimeout(1500); // let the snap tell the other page which side is taken
}
await A.waitForTimeout(1500);
const pongSides = await A.evaluate(() => window.__game.session.pong.sides);
check('both HUMANS at the pong table',
  [pongSides.L, pongSides.R].filter(s => s && s !== 'bot').length === 2,
  JSON.stringify(pongSides));
const ballLive = await A.evaluate(async () => {
  const s = window.__game.session;
  for (let i = 0; i < 60; i++) {
    if (s.pong.ball) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
});
check('pong ball in play', ballLive === true);
await A.screenshot({ path: path.join(SHOTS, 'mp-pong.png') });

// --- host migration: A (host) leaves, B should re-form the lobby
await A.close();
const migrated = await B.evaluate(async () => {
  const s = window.__game.session;
  for (let i = 0; i < 120; i++) {
    if (s.lobby && s.lobby.isHost && !s.migrating) return s.lobby.code || 'no-code';
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
});
check('host migration: guest took over lobby ' + code, migrated === code, String(migrated));

await browser.close();
server.close();
process.exit(failed);
