// Headless browser smoke test: boots the full game (?test=1 auto-deploys),
// simulates buying/fighting/grenades via the exposed __cs handle, and fails
// on any console error. Screenshots land in --shots dir (default scratch).
// Usage: node container-strike/test/smoke-browser.mjs [--shots DIR]
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { mkdirSync } from 'fs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const shotsIdx = process.argv.indexOf('--shots');
const SHOTS = shotsIdx > 0 ? process.argv[shotsIdx + 1] : join(ROOT, 'qa');
mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('nope');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

console.log('loading game...');
await page.goto(`http://localhost:${port}/container-strike/index.html?test=1`);
await page.waitForFunction(() => window.__cs && window.__cs.started, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: join(SHOTS, 'cs-01-spawn.png') });

// buy an AK/M4 + armor and inspect the viewmodel
await page.evaluate(() => {
  const G = window.__cs;
  G.player.money = 16000;
  const id = G.player.team === 'T' ? 'ak47' : 'm4a4';
  G.game.buyWeapon(G.player, id);
  G.game.buyArmor(G.player, true);
  G.game.buyGrenade(G.player, 'he');
  G.game.buyGrenade(G.player, 'smoke');
  G.game.buyGrenade(G.player, 'flash');
});
await page.waitForTimeout(700);
await page.screenshot({ path: join(SHOTS, 'cs-02-rifle.png') });

// skip freeze, walk forward and fire a burst
await page.evaluate(() => {
  const G = window.__cs;
  G.game.phaseEnd = G.time; // end freeze now
});
await page.waitForTimeout(400);
await page.evaluate(() => { window.__cs.player.keys.KeyW = true; });
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__cs.player.keys.KeyW = false; });
const burst = await page.evaluate(() => {
  const G = window.__cs;
  let fired = 0;
  return new Promise((done) => {
    const t = setInterval(() => {
      if (G.combat.tryFire(G.player, G.time)) fired++;
      if (fired >= 8) { clearInterval(t); done(fired); }
    }, 100);
    setTimeout(() => { clearInterval(t); done(fired); }, 3000);
  });
});
console.log('fired', burst, 'shots');
await page.screenshot({ path: join(SHOTS, 'cs-03-firing.png') });

// throw a smoke and an HE at mid
await page.evaluate(() => {
  const G = window.__cs;
  G.grenades.throwFrom(G.player, 'smoke', 15);
  G.grenades.throwFrom(G.player, 'he', 15);
});
await page.waitForTimeout(3500);
await page.screenshot({ path: join(SHOTS, 'cs-04-smoke.png') });

// molotov fire area
await page.evaluate(() => {
  const G = window.__cs;
  const pos = G.player.pos.clone(); pos.y += 1.4; pos.z -= 4;
  G.grenades.spawn(G.player, G.player.team === 'T' ? 'molotov' : 'incendiary', pos, pos.clone().set(0, -1, -4));
});
await page.waitForTimeout(2500);
await page.screenshot({ path: join(SHOTS, 'cs-05-fire.png') });

// let bots fight a while; verify they move and someone eventually dies or shoots
const botCheck = await page.evaluate(async () => {
  const G = window.__cs;
  const before = G.bots.map((b) => b.pos.clone());
  await new Promise((r) => setTimeout(r, 6000));
  const moved = G.bots.filter((b, i) => b.pos.distanceTo(before[i]) > 1).length;
  const shots = G.bots.filter((b) => b.lastShotTime > 0).length;
  return { moved, shots, aliveCT: G.game.aliveOf('CT').length, aliveT: G.game.aliveOf('T').length, phase: G.game.phase, round: G.game.round };
});
console.log('bots:', JSON.stringify(botCheck));
await page.screenshot({ path: join(SHOTS, 'cs-06-botfight.png') });

// third-person sanity: teleport camera high for an overview
await page.evaluate(() => {
  const G = window.__cs;
  G.player.pos.set(0, 30, 34);
  G.player.pitch = -0.6;
  G.player.vel.set(0, 0, 0);
});
await page.waitForTimeout(400);
await page.screenshot({ path: join(SHOTS, 'cs-07-overview.png') });

// force round end path
const roundFlow = await page.evaluate(async () => {
  const G = window.__cs;
  for (const b of G.bots) if (b.team !== G.player.team && b.alive) { b.health = 1; G.combat.applyDamage(b, 500, G.player, G.player.currentDef() || { id: 'ak47', armorPen: 1, headshotMult: 4 }, false, { x: 0, y: 0, z: 1 }); }
  await new Promise((r) => setTimeout(r, 2500));
  return { phase: G.game.phase, scores: G.game.scores, money: G.player.money };
});
console.log('round flow:', JSON.stringify(roundFlow));

const finalState = await page.evaluate(() => {
  const G = window.__cs;
  return { time: G.time.toFixed(1), started: G.started, weapons: Object.keys(G.player.weapons.grenades).length };
});
console.log('final:', JSON.stringify(finalState));

await browser.close();
server.close();

const uniq = [...new Set(errors)];
if (uniq.length) {
  console.log('\nCONSOLE ERRORS (' + uniq.length + '):');
  for (const e of uniq.slice(0, 20)) console.log('  -', e.slice(0, 300));
  process.exit(1);
}
console.log('\nsmoke test PASSED, no console errors');
