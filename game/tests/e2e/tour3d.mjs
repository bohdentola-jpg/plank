// fly the main world and photograph each biome, plus pong and a blaster pop.
import { chromium } from 'playwright';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, '..', 'qa', 'shots');
await fs.mkdir(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try { let p = new URL(req.url,'http://x').pathname; if (p==='/') p='/index.html';
    res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});
    res.end(await fs.readFile(path.join(ROOT,p))); } catch(e){res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(8899,r));
const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:760} });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto('http://127.0.0.1:8899/', { waitUntil: 'networkidle' });
// start the main world solo, straight through the module
await page.evaluate(() => {
  document.getElementById('name').value = 'tourist';
});
await page.click('#btn-private');
await page.click('#btn-priv-make');
await page.waitForFunction(() => window.__game.session, null, { timeout: 20000 });
await page.waitForTimeout(3000);

let failed = 0;
const check = (name, cond, extra='') => {
  if (cond) console.log('  ok  ' + name);
  else { console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); failed = 1; }
};

// the session must be live, not paused behind a failed pointer lock
await page.mouse.click(640, 380);
await page.waitForTimeout(500);
const live = await page.evaluate(() => {
  const s = window.__game.session;
  return { paused: s.paused, time: s.time };
});
check('session runs (not stuck paused)', !live.paused && live.time > 1, JSON.stringify(live));

// walking moves the body
const p0 = await page.evaluate(() => ({ x: window.__game.session.me.x, z: window.__game.session.me.z }));
await page.keyboard.down('w');
await page.waitForTimeout(1100);
await page.keyboard.up('w');
await page.waitForTimeout(300);
const p1 = await page.evaluate(() => ({ x: window.__game.session.me.x, z: window.__game.session.me.z }));
check('walking moves the player', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 3,
  JSON.stringify(p0) + ' → ' + JSON.stringify(p1));

// jumping leaves the ground
await page.evaluate(() => { const s = window.__game.session; s.me.x = 0; s.me.z = 0; s.me.y = 0; });
await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForTimeout(200);
const airborne = await page.evaluate(() => window.__game.session.me.y > 0.6);
check('jumping leaves the ground', airborne);

const teleport = async (x, z, camYaw, camPitch, dist) => {
  await page.evaluate(([x, z, y, p, d]) => {
    const s = window.__game.session;
    s.me.x = x; s.me.z = z; s.me.vx = 0; s.me.vz = 0;
    s.me.y = s.world.heightAt(x, z) + 1;
    s.view.cam.yaw = y; s.view.cam.pitch = p; s.view.cam.dist = d;
    if (s.terrain.prime) s.terrain.prime(x, z, 4);
  }, [x, z, camYaw, camPitch, dist]);
  await page.waitForTimeout(2600);
};

// losing the pointer lock pauses the game on purpose; automation has to resume
const ensureRunning = async () => {
  await page.evaluate(() => {
    const s = window.__game.session;
    if (s && s.paused) s.setPaused(false);
  });
  await page.waitForTimeout(120);
};

const shot = async (name) => {
  const info = await page.evaluate(() => {
    const s = window.__game.session;
    return { biome: s.world.biomeAt(s.me.x, s.me.z), y: Math.round(s.me.y), chunks: s.terrain.chunks ? s.terrain.chunks.size : 0 };
  });
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  console.log('  ' + name.padEnd(22) + ' biome=' + info.biome.padEnd(8) + ' y=' + String(info.y).padStart(4) + ' chunks=' + info.chunks);
};

await page.evaluate(() => {
  const s = window.__game.session;
  s.view.cam.pitch = 0.3; s.view.cam.yaw = 0.35; s.view.cam.dist = 11;
});
await page.waitForTimeout(600);
await shot('t01-void-plaza');
await teleport(0, -260, 0.2, 0.25, 12);   await shot('t02-meadow-north');
await teleport(0, -620, 0.1, 0.25, 12);   await shot('t03-forest-deep');
await teleport(420, 40, 1.4, 0.22, 12);   await shot('t04-desert-east');
await teleport(-420, 40, -1.4, 0.22, 12); await shot('t05-snow-west');
await teleport(40, 330, 3.0, 0.18, 14);   await shot('t06-ash-flats');
await teleport(40, 470, 3.1, 0.05, 16);   await shot('t07-volcano-approach');
await teleport(40, 498, 0.0, 0.30, 13);   await shot('t08-volcano-rim');
const lavaKills = await page.evaluate(async () => {
  const s = window.__game.session;
  const c = s.world.volcanoCenter();
  s.me.x = c.x; s.me.z = c.z;
  s.me.y = s.world.heightAt(c.x, c.z);       // the crater floor, under the lake
  for (let i = 0; i < 40; i++) {
    if (s.me.dead) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
});
check('the lava lake kills you', lavaKills);
for (let i = 0; i < 10; i++) { await ensureRunning(); await page.waitForTimeout(400); }

await teleport(1700, 1700, 0.6, 0.2, 12); await shot('t09-outer-void');

// pong: stand at the table and press E
await teleport(6, 6, 1.2, 0.2, 11);
await page.mouse.click(640, 380);      // pointer lock
await page.waitForTimeout(300);
await page.evaluate(() => {
  const s = window.__game.session;
  const st = s.pong.station('L');
  s.me.x = st.x; s.me.z = st.z; s.me.y = s.world.heightAt(st.x, st.z);
  s.view.cam.yaw = Math.PI / 2; s.view.cam.pitch = 0.25; s.view.cam.dist = 10;
});
await page.waitForTimeout(700);
await ensureRunning();
await page.keyboard.press('e');
for (let i = 0; i < 12; i++) { await ensureRunning(); await page.waitForTimeout(500); }
await shot('t10-pong');
const pong = await page.evaluate(() => {
  const p = window.__game.session.pong;
  return { sides: p.sides, ball: !!p.ball, score: p.score, msg: p.msg };
});
check('joined the pong table', !!pong.sides.L || !!pong.sides.R, JSON.stringify(pong.sides));
check('the box-bot took the other end', pong.sides.L === 'bot' || pong.sides.R === 'bot', JSON.stringify(pong.sides));
// serves pause between points, so wait for a ball rather than sampling once
const sawBall = await page.evaluate(async () => {
  const s = window.__game.session;
  for (let i = 0; i < 60; i++) {
    if (s.pong.ball) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
});
check('a ball gets served', sawBall, JSON.stringify(pong));
// swinging returns the ball
const rally = await page.evaluate(async () => {
  const s = window.__game.session;
  for (let i = 0; i < 120; i++) {
    const b = s.pong.ball;
    if (b && Math.hypot(b.x - s.me.x, b.z - s.me.z) < 3 && Math.abs(b.y - s.pong.paddleY()) < 2) {
      const before = b.vx;
      s.act({ k: 'swing', dx: s.me.x < s.pong.cx ? 1 : -1, dz: 0 });
      if (s.pong.ball && Math.sign(s.pong.ball.vx) !== Math.sign(before)) return true;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
});
check('swinging sends the ball back', rally);

// blaster: grab from the stand and shoot a box
await page.evaluate(() => {
  const s = window.__game.session;
  s.act({ k: 'pongleave' }); s.me.pongSide = null;
  const stand = s.ents.find(e => e.model === 'blasterstand');
  s.me.x = stand.x + 1; s.me.z = stand.z; s.me.y = s.world.heightAt(s.me.x, s.me.z);
  s.view.cam.yaw = 1.5; s.view.cam.pitch = 0.1;
});
await page.waitForTimeout(600);
await page.keyboard.press('e');
await page.waitForTimeout(300);
await ensureRunning();
const boltPeak = await page.evaluate(async () => {
  const s = window.__game.session;
  s.primary();                       // fire
  let peak = 0;
  for (let i = 0; i < 30; i++) {
    peak = Math.max(peak, s.bolts.length + s.myBolts.length);
    await new Promise(r => setTimeout(r, 30));
  }
  return peak;
});
await shot('t11-blaster');
const held = await page.evaluate(() => ({
  holding: window.__game.session.me.holding && window.__game.session.me.holding.kind,
}));
check('grabbed the blaster', held.holding === 'blaster', JSON.stringify(held));
check('a bolt flew', boltPeak > 0, 'peak=' + boltPeak);

// carry and throw a box
await page.evaluate(() => {
  const s = window.__game.session;
  s.me.holding = null;
  const box = s.ents.find(e => e.model === 'box');
  s.me.x = box.x + 1; s.me.z = box.z; s.me.y = s.world.heightAt(s.me.x, s.me.z);
  s.view.cam.yaw = 2.2; s.view.cam.pitch = 0.15;
});
await page.waitForTimeout(500);
await page.keyboard.press('e');
await page.waitForTimeout(500);
await shot('t12-carry-box');
const carry = await page.evaluate(() => window.__game.session.me.holding);
check('picked up a box', carry && carry.kind === 'box', JSON.stringify(carry));
// throwing it launches the box
const thrown = await page.evaluate(() => {
  const s = window.__game.session;
  const id = s.me.holding.id;
  s.primary();
  const ent = s.ents.find(e => e.id === id);
  return { released: !s.me.holding, speed: ent ? Math.hypot(ent.vx, ent.vy, ent.vz) : 0 };
});
check('throwing launches it', thrown.released && thrown.speed > 8, JSON.stringify(thrown));

// death burst
await page.evaluate(() => {
  const s = window.__game.session;
  s.hostPop(s.me.id, null, s.me.x, s.me.y + 1.5, s.me.z);
});
await page.waitForTimeout(420);
await shot('t13-box-burst');
const burst = await page.evaluate(() => ({
  bursts: window.__game.session.bursts.length,
  parts: window.__game.session.bursts[0] ? window.__game.session.bursts[0].parts.length : 0,
  dead: window.__game.session.me.dead,
}));
check('dying bursts into cardboard boxes', burst.bursts > 0 && burst.parts >= 8 && burst.dead, JSON.stringify(burst));
// and you come back
for (let i = 0; i < 10; i++) { await ensureRunning(); await page.waitForTimeout(400); }
const alive = await page.evaluate(() => !window.__game.session.me.dead);
check('and you respawn', alive);

await browser.close();
server.close();
process.exit(failed);
