// arcade3d.mjs — the cabinets, in the real game: walk up, press E, play SNAKE
// on the overlay, step away, and check the avatar looks like somebody.
//
// This headless environment has a broken compositor (SwiftShader, frames are
// produced but never consumed), which brings two rules learned the hard way:
//   1. never let the game's own rAF loop free-run — the browser balloons until
//      the cgroup OOM-kills it. We cancel it and hand-crank sim+render.
//   2. never use page.keyboard / page.screenshot while the play overlay is up —
//      CDP input + starved task queues can strand the calls forever. The whole
//      scenario runs inside ONE page.evaluate, with synthetic KeyboardEvents
//      and canvas.toDataURL for the pictures.
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
  try {
    let p = new URL(req.url, 'http://x').pathname;
    if (p === '/') p = '/index.html';
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(await fs.readFile(path.join(ROOT, p)));
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8899, r));

let failed = 0;
const check = (n, c, extra = '') => {
  if (c) console.log('  ok  ' + n);
  else { console.log('FAIL  ' + n + (extra ? ' — ' + extra : '')); failed = 1; }
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('pageerror', e => { console.log('PAGEERROR:', e.message); failed = 1; });
page.on('crash', () => { console.log('PAGE CRASHED'); failed = 1; });

await page.goto('http://127.0.0.1:8899/', { waitUntil: 'networkidle' });
await page.click('#btn-private');
await page.click('#btn-priv-make');
await page.waitForFunction(() => window.__game.session, null, { timeout: 25000 });
await page.waitForTimeout(1200);

const out = await page.evaluate(() => {
  const s = window.__game.session;
  s.setPaused(false);
  cancelAnimationFrame(s.raf);           // rule 1: no free-running frames

  const results = [];
  const shots = {};
  const say = (name, cond, extra = '') => results.push({ name, cond: !!cond, extra: String(extra) });
  const pump = (n) => { for (let i = 0; i < n; i++) { s.simulate(1 / 60); s.render(1 / 60); } };
  const snap = (name) => { s.render(1 / 60); shots[name] = s.view.renderer.domElement.toDataURL('image/png'); };
  const key = (k, type = 'keydown') =>
    window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
  const tap = (k) => { key(k); key(k, 'keyup'); };
  const prompt = () => document.getElementById('prompt').textContent;

  // ---- portrait: the avatar up close, idle then walking. Clear ground, and
  // the avatar turned to look into the lens (yaw matching cam.yaw does that).
  s.me.x = 12; s.me.z = 20; s.me.y = s.world.heightAt(12, 20);
  s.view.cam.yaw = 0.6; s.view.cam.pitch = 0.12; s.view.cam.dist = 5.5;
  pump(20);
  s.me.yaw = 0.6 + Math.PI;              // turn to look into the lens
  pump(1);
  snap('a01-avatar');
  key('s'); pump(22);                    // backpedal = walks toward the camera
  snap('a02-avatar-walk');
  key('s', 'keyup'); pump(5);

  // ---- the prompt system: stand by a box
  const box = s.ents.find(e => e.model === 'box' && e.synced);
  s.me.x = box.x + 1; s.me.z = box.z; s.me.y = box.y;
  pump(10);
  say('a prompt appears at a box', /pick up/.test(prompt() || ''), prompt());

  // ---- the arcade corner
  const cab = s.ents.find(e => e.id === 'arc1');
  const fy = cab.yaw * Math.PI / 180;
  s.me.x = cab.x + Math.sin(fy) * 3;
  s.me.z = cab.z + Math.cos(fy) * 3;
  s.me.y = s.world.heightAt(s.me.x, s.me.z);
  s.view.cam.yaw = Math.atan2(cab.x - s.me.x, cab.z - s.me.z);
  s.view.cam.pitch = 0.1; s.view.cam.dist = 8;
  if (s.terrain.prime) s.terrain.prime(s.me.x, s.me.z, 3);
  pump(15);
  say('the cabinet invites you', /play/.test(prompt() || ''), prompt());
  snap('a03-arcade-corner');

  // ---- press E: the overlay opens and SNAKE deals a board
  tap('e'); pump(30);
  say('the play overlay opens', document.getElementById('screen-overlay').style.display !== 'none');
  say('SNAKE dealt a board on the cabinet',
    s.playingEnt === cab && cab.screen.active && cab.screen.sprites.has('s1'),
    `ent=${s.playingEnt && s.playingEnt.id} sprites=${cab.screen.sprites.size}`);
  cab.screen.draw(1 / 60);
  shots['a04-snake-board'] = cab.screen.canvas.toDataURL('image/png');
  snap('a05-at-the-controls');

  // ---- it plays: steer and watch the head move
  const h0 = { ...cab.screen.sprites.get('s1') };
  tap('ArrowDown'); pump(45);
  const h1 = { ...cab.screen.sprites.get('s1') };
  say('arrows steer the snake', h1.y > h0.y, `${h0.x},${h0.y} -> ${h1.x},${h1.y}`);

  // movement keys stay in the game while playing
  const before = { x: s.me.x, z: s.me.z };
  key('w'); pump(30); key('w', 'keyup');
  say('you stay at the controls while playing',
    Math.hypot(s.me.x - before.x, s.me.z - before.z) < 0.5);

  // ---- step away
  tap('e'); pump(10);
  say('E steps away again',
    document.getElementById('screen-overlay').style.display === 'none' && !s.playingEnt,
    `playing=${!!s.playingEnt}`);

  // ---- trampoline
  const t = s.ents.find(e => e.id === 'tramp');
  s.me.x = t.x; s.me.z = t.z; s.me.y = t.y + t.size.y + 2;
  s.me.vx = s.me.vz = s.me.vy = 0;
  let peak = 0;
  for (let i = 0; i < 260; i++) { s.simulate(1 / 60); peak = Math.max(peak, s.me.y - t.y); }
  say('the trampoline sends you flying', peak > 6, 'peak=' + peak.toFixed(1));

  // ---- the door to nowhere opens on click
  const d = s.ents.find(e => e.id === 'nowhere');
  const doorBefore = { yaw: d.yaw, solid: d.solid };
  d.scriptInst.trigger('clicked');
  for (let i = 0; i < 40; i++) s.simulate(1 / 60);
  say('the door opens', d.yaw !== doorBefore.yaw && d.solid === false,
    `yaw ${doorBefore.yaw} -> ${d.yaw} solid=${d.solid}`);

  return { results, shots };
});

for (const r of out.results) check(r.name, r.cond, r.extra);
for (const [name, data] of Object.entries(out.shots)) {
  await fs.writeFile(path.join(SHOTS, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
}

await browser.close();
server.close();
process.exit(failed);
