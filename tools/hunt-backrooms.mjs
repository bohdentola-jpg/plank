// Does the thing actually find you?
//
// Stand still on the spawn, touch nothing, and time how long the floor's monster takes
// to reach you. A floor where it never arrives is a floor with nothing on it, however
// good the model is; a floor where it arrives in ten seconds is not a game. Budget is
// in-game seconds (headless software GL runs at a few frames a second, so wall clock
// measures the renderer, not the AI).
//
//   node tools/hunt-backrooms.mjs [levelId ...] [--all] [--secs 180] [--noise]
//
// NOTE ON SPEED: this steps the real game loop, so it needs one frame per 50ms of game
// time — a two-minute hunt is 2,400 frames. On a machine with a GPU that is under a
// minute. Under software rasterisation (a headless container with swiftshader) a frame
// can cost a second or more and this becomes unusable; the canvas is shrunk to 64x48 for
// the duration to claw most of that back, but budget accordingly.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/backrooms/index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const secs = parseInt(opt('secs', '180'), 10);
const noisy = argv.includes('--noise');
const levels = argv.includes('--all')
  ? (await readdir(join(root, 'backrooms/src/levels')))
      .filter((f) => f.endsWith('.js') && f !== 'index.js').map((f) => f.replace(/\.js$/, '')).sort()
  : (argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a)).length
      ? argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a)) : ['level0']);

let failures = 0;
const ok = (m) => console.log(`ok   ${m}`);
const fail = (m) => { failures++; console.error(`FAIL ${m}`); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 360, height: 240 } });
page.on('pageerror', (e) => console.log('ERR', e.message));

const HUNT = `(async (budget, makeNoise) => {
  const g = window.NOCLIP;
  const w = g.world, p = g.player;
  const start = w.liftBearing(p.pos.x, p.pos.z)?.dist ?? -1;
  const m = g.entities.monster;
  const startDist = m ? m.dist : -1;
  let t = 0, closest = Infinity;
  const seen = {};
  let firstNotice = null, firstHunt = null;
  while (t < budget && !g.dead) {
    // stand still (or shuffle in place if we are meant to be making noise)
    Object.assign(g.input, { fwd: 0, back: 0, left: 0, right: 0, sprint: 0, crouch: 0, jump: 0 });
    if (makeNoise) { g.input.fwd = 1; g.input.sprint = 1; }
    await new Promise((r) => requestAnimationFrame(r));
    t += Math.min(0.05, g.lastDt || 0.05);
    const mm = g.entities.monster;
    if (!mm) break;
    seen[mm.state] = (seen[mm.state] || 0) + 1;
    if (mm.alert > 0.35 && firstNotice === null) firstNotice = +t.toFixed(1);
    if (mm.state === 'hunt' && firstHunt === null) firstHunt = +t.toFixed(1);
    closest = Math.min(closest, mm.dist);
  }
  return {
    caught: !!g.dead, secs: +t.toFixed(1), startDist: Math.round(startDist),
    closest: Math.round(closest), firstNotice, firstHunt,
    states: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, +(v / Math.max(1, Object.values(seen).reduce((a, b) => a + b, 0)) * 100).toFixed(0)])),
  };
})`;

for (const level of levels) {
  await page.goto(`http://127.0.0.1:${port}/backrooms/index.html?quick&level=${level}`);
  await page.mouse.click(180, 120);
  await page.waitForFunction(() => window.NOCLIP?.state === 'play', { timeout: 60000 });
  await page.waitForTimeout(700);
  const r = await page.evaluate(`(${HUNT})(${secs}, ${noisy})`);
  const line = `${level.padEnd(15)} started ${String(r.startDist).padStart(3)}m away · closest ${String(r.closest).padStart(3)}m`
    + ` · noticed ${r.firstNotice === null ? '—' : r.firstNotice + 's'} · hunting ${r.firstHunt === null ? '—' : r.firstHunt + 's'}`
    + ` · ${Object.entries(r.states).map(([k, v]) => `${k} ${v}%`).join(' ')}`;
  if (r.caught) ok(`${line} · REACHED YOU at ${r.secs}s`);
  else if (r.closest < 20) ok(`${line} · closed to ${r.closest}m in ${r.secs}s`);
  else fail(`${line} · never got near in ${r.secs}s`);
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} floor(s) where nothing came for you` : `\nevery floor's monster came looking`);
process.exit(failures ? 1 : 0);
