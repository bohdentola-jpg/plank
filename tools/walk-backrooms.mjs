// Can you actually WALK to the lift?
//
// The data harness proves the lift is reachable by flooding the cell grid, but the
// grid is not the player: it does not know about collision radius, step height,
// deep water you cannot climb out of, or a door that does not open. This drives the
// real player with real input, following the chalk gradient the way a person would,
// and reports where it gets stuck and what is around it when it does.
//
//   node tools/walk-backrooms.mjs [levelId ...] [--all] [--secs 240] [--shots]
import { createServer } from 'node:http';
import { readFile, mkdir, readdir } from 'node:fs/promises';
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
await mkdir(join(root, 'qa'), { recursive: true });

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const secs = parseInt(opt('secs', '240'), 10);
const shots = argv.includes('--shots');
const levels = argv.includes('--all')
  ? (await readdir(join(root, 'backrooms/src/levels')))
      .filter((f) => f.endsWith('.js') && f !== 'index.js').map((f) => f.replace(/\.js$/, '')).sort()
  : (argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a)).length
      ? argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a)) : ['level0']);

let failures = 0;
const ok = (m) => console.log(`ok   ${m}`);
const fail = (m) => { failures++; console.error(`FAIL ${m}`); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Phase one, and the cheap one: walk the gradient cell by cell from the spawn to the
// lift and check each step against the rules the PLAYER obeys, not the ones the flood
// fill obeys. Any step that fails here is a place the chalk points and a person cannot
// follow — which is exactly the complaint worth catching.
const PATH_AUDIT = `(() => {
  const g = window.NOCLIP;
  const w = g.world, p = g.player;
  const S = w.cell;
  const lift = (w.data.exits || []).find((e) => e.kind === 'elevator');
  const dist = w.liftDist;
  const at = (cx, cz) => (w.inside(cx, cz) ? dist[w.idx(cx, cz)] : -1);
  let [cx, cz] = w.toCell(p.pos.x, p.pos.z);
  const bad = [];
  const path = [];
  let guard = 0;
  while (guard++ < 6000) {
    const here = at(cx, cz);
    if (here <= 1) break;
    const step = w.downhill(cx, cz);
    if (!step) { bad.push({ why: 'gradient dead end', cell: [cx, cz], dist: here }); break; }
    const [nx, nz] = [cx + step[0], cz + step[1]];
    path.push([cx, cz]);
    // Ask the player's own collision function, standing where the chalk stands: this
    // is the same call movement makes, so anything it refuses is a wall to a person.
    const sy = w.cellFloor(cx, cz);
    const keep = { x: p.pos.x, z: p.pos.z, y: p.pos.y };
    p.pos.x = cx * S; p.pos.z = cz * S; p.pos.y = sy;
    const r = p.radius;
    // A body fits somewhere in the doorway if any lateral offset across it admits the
    // body — a person walks round the car parked on the centre line, they do not stop.
    const perp = [step[1], -step[0]];
    const fits = (bx, bz) => !(
      p._blocked(bx, bz, sy) || p._blocked(bx + r, bz, sy) || p._blocked(bx - r, bz, sy)
      || p._blocked(bx, bz + r, sy) || p._blocked(bx, bz - r, sy)
    );
    const anyLane = (ax, az) => {
      for (const off of [0, 0.55, -0.55, 1.05, -1.05]) {
        if (fits(ax + perp[0] * off, az + perp[1] * off)) return true;
      }
      return false;
    };
    const okEnd = anyLane(nx * S, nz * S);
    const okMid = anyLane((cx + nx) / 2 * S, (cz + nz) / 2 * S);
    Object.assign(p.pos, keep);
    const rise = w.cellFloor(nx, nz) - w.cellFloor(cx, cz);
    const cNext = w.code(nx, nz);
    if (!okMid || !okEnd) {
      // say which rule actually refused, or the report is useless
      const hit = [];
      const headroom = w.cellCeil(nx, nz) - w.cellFloor(nx, nz);
      if (w.code(nx, nz) === 9) hit.push('HALF cell');
      if (headroom < p.h * 0.72) hit.push('headroom ' + headroom.toFixed(2) + 'm');
      if (rise > 0.72) hit.push('rise ' + rise.toFixed(2) + 'm');
      const cols = w.colliders.filter((c) => nx * S >= c.x0 - 1.5 && nx * S <= c.x1 + 1.5 && nz * S >= c.z0 - 1.5 && nz * S <= c.z1 + 1.5);
      if (cols.length) hit.push(cols.length + ' collider(s) y ' + cols[0].y0.toFixed(1) + '-' + cols[0].y1.toFixed(1));
      bad.push({
        why: (okMid ? 'body does not fit' : 'doorway solid') + ' — ' + (hit.join(', ') || 'unknown'),
        cell: [cx, cz], to: [nx, nz], code: cNext,
      });
    }
    cx = nx; cz = nz;
  }
  return {
    steps: path.length, bad: bad.slice(0, 8), badCount: bad.length,
    reachedLift: at(cx, cz) <= 1,
    liftCell: lift ? [Math.round(lift.x), Math.round(lift.z)] : null,
    endedAt: [cx, cz],
  };
})`;

// The autopilot lives in the page: it steers with the same input object the keyboard
// writes to, so it is subject to every rule a player is subject to.
const AUTOPILOT = `(async (routeCells) => {
  const g = window.NOCLIP;
  const w = g.world, p = g.player;
  const S = w.cell;
  const lift = g.exitObjs[0]?.mesh.position;
  const startDist = w.liftBearing(p.pos.x, p.pos.z)?.dist ?? -1;
  const trail = [];
  let stuckAt = null, arrived = false, unstickTries = 0;
  let bestDist = Infinity, sinceProgress = 0, sideways = 0, side = 1;
  let path = [], repath = 0;
  let frames = 0, blocked = 0, travel = 0, sumDy = 0;
  const t0 = performance.now();

  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const clearInput = () => Object.assign(g.input, { fwd: 0, back: 0, left: 0, right: 0, sprint: 0, crouch: 0, jump: 0 });

  // Budget in METRES WALKED, not wall-clock: headless software GL renders this at a
  // few frames a second, so a stopwatch here measures the renderer, not the level. A
  // route you cannot finish in three and a half times its own length is a route you
  // cannot follow.
  const allowance = routeCells * S * 3.5;
  const FRAME_CAP = 24000;
  while (frames < FRAME_CAP && travel < allowance) {
    if (g.dead) { g.dead = false; g.hud.hideDeath?.(); }        // the monster is not the point here
    if (g.entities.monster) g.entities.monster.frozen = true;    // ...so freeze it
    if (g.state !== 'play') break;

    const [pcx0, pcz0] = w.toCell(p.pos.x, p.pos.z);
    const b = w.liftBearing(p.pos.x, p.pos.z);
    const d = lift ? Math.hypot(lift.x - p.pos.x, lift.z - p.pos.z) : Infinity;
    if (d < 2.6) { arrived = true; break; }

    // Follow the route cell by cell: aim at the next cell centre and pop it when we
    // get there. Aiming several cells ahead cuts corners and walks into walls, which
    // is a harness bug that looks exactly like a level bug.
    if (!path.length || repath <= 0) {
      path = [];
      let ax = pcx0, az = pcz0;
      for (let hop = 0; hop < 400; hop++) {
        const st = w.downhill(ax, az);
        if (!st) break;
        ax += st[0]; az += st[1];
        path.push([ax, az]);
      }
      repath = 120;
    }
    repath--;
    while (path.length && Math.hypot(path[0][0] * S - p.pos.x, path[0][1] * S - p.pos.z) < 1.4) path.shift();

    let want;
    if (path.length) want = Math.atan2(-(path[0][0] * S - p.pos.x), -(path[0][1] * S - p.pos.z));
    else if (b && b.dist > 2) want = b.angle;
    else want = Math.atan2(-(lift.x - p.pos.x), -(lift.z - p.pos.z));

    if (sideways > 0) { want += side * 1.25; sideways--; }

    let dy = want - p.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    p.yaw += Math.max(-0.14, Math.min(0.14, dy));

    clearInput();
    g.input.fwd = 1;
    if (Math.abs(dy) < 0.7) g.input.sprint = 1;
    if (p.submerged) g.input.jump = 1;                          // swim up out of the deep

    const before = { x: p.pos.x, z: p.pos.z };
    await frame();
    const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z);
    frames++; travel += moved; sumDy += Math.abs(dy);
    if (moved < 0.02) blocked++;

    const cur = b ? b.dist : d / S;
    if (cur < bestDist - 0.5) { bestDist = cur; sinceProgress = 0; }
    else sinceProgress++;

    if (trail.length < 4000 && trail.length % 6 === 0) trail.push([+p.pos.x.toFixed(1), +p.pos.z.toFixed(1)]);
    else trail.push([+p.pos.x.toFixed(1), +p.pos.z.toFixed(1)]);

    // wedged: no progress for a long stretch, and barely moving
    if (sinceProgress > 400) {
      unstickTries++;
      if (unstickTries > 6) {
        const [cx, cz] = w.toCell(p.pos.x, p.pos.z);
        const around = [];
        for (let dz2 = -1; dz2 <= 1; dz2++) {
          let row = '';
          for (let dx2 = -1; dx2 <= 1; dx2++) row += w.isOpenCell(cx + dx2, cz + dz2) ? '.' : '#';
          around.push(row);
        }
        stuckAt = {
          cell: [cx, cz], pos: [+p.pos.x.toFixed(1), +p.pos.z.toFixed(1)],
          code: w.code(cx, cz), around,
          gradientDist: b ? b.dist : -1, straightDist: +d.toFixed(1),
          submerged: !!p.submerged, floorY: +w.floorAtWorld(p.pos.x, p.pos.z).toFixed(2),
          nextStep: b ? +b.angle.toFixed(2) : null,
        };
        break;
      }
      // try the other way round the obstacle, and hop
      side = -side; sideways = 40; sinceProgress = 0;
      g.input.jump = 1;
      await frame();
    }
  }
  clearInput();
  return {
    arrived, stuckAt, startDist, allowance: Math.round(allowance),
    gaveUp: travel >= allowance,
    endDist: w.liftBearing(p.pos.x, p.pos.z)?.dist ?? -1,
    secs: +((performance.now() - t0) / 1000).toFixed(1),
    frames, blockedPct: frames ? +(100 * blocked / frames).toFixed(0) : 0,
    travel: +travel.toFixed(0), meanDy: frames ? +(sumDy / frames).toFixed(2) : 0,
    waypoints: path.length,
    trail: trail.slice(-40),
  };
})`;

for (const level of levels) {
  errors.length = 0;
  console.log(`\n=== ${level} ===`);
  await page.goto(`http://127.0.0.1:${port}/backrooms/index.html?quick&level=${level}`);
  await page.mouse.click(450, 280);
  await page.waitForFunction(() => window.NOCLIP?.state === 'play', { timeout: 60000 })
    .catch(() => fail(`${level}: never reached play`));
  await page.waitForTimeout(800);

  const audit = await page.evaluate(`(${PATH_AUDIT})()`);
  if (!audit.reachedLift) fail(`${level}: the chalk gradient does not reach the lift — ended at ${audit.endedAt}, lift at ${audit.liftCell}`);
  else if (audit.badCount) {
    fail(`${level}: ${audit.badCount} step(s) on the route to the lift a player cannot take`);
    for (const b of audit.bad) console.log(`     ${b.cell} → ${b.to || '—'}  ${b.why}  (code ${b.code ?? '?'})`);
  } else ok(`${level}: ${audit.steps} steps of chalk to the lift, every one of them passable`);

  if (argv.includes('--auditonly')) continue;

  // A body sprints about 4.4 m/s, a cell is ~3.2 m, and a route is never a straight
  // line — so give the walk a budget scaled to the actual route rather than a flat one.
  const r = await page.evaluate(`(${AUTOPILOT})(${audit.steps})`);
  if (r.arrived) ok(`${level}: walked to the lift — ${r.travel}m of walking for a ${r.startDist}-cell route`);
  else if (r.stuckAt) {
    fail(`${level}: wedged at cell ${r.stuckAt.cell} (${r.stuckAt.pos}), ${r.stuckAt.gradientDist} cells from the lift`);
    console.log(`     code ${r.stuckAt.code} · floorY ${r.stuckAt.floorY} · submerged ${r.stuckAt.submerged}`);
    for (const row of r.stuckAt.around) console.log(`     ${row}`);
    console.log(`     last positions: ${r.trail.slice(-6).map((t) => t.join(',')).join(' → ')}`);
  } else {
    fail(`${level}: ${r.gaveUp ? 'walked ' + r.travel + 'm (allowance ' + r.allowance + 'm) and' : 'hit the frame cap'} still ${r.endDist} cells from the lift (started ${r.startDist})`);
    console.log(`     ${r.frames} frames · ${r.blockedPct}% blocked · ${r.travel}m travelled · mean turn ${r.meanDy} rad · ${r.waypoints} waypoints left`);
    console.log(`     last positions: ${r.trail.slice(-6).map((t) => t.join(',')).join(' → ')}`);
  }
  if (shots) await page.screenshot({ path: join(root, `qa/walk-${level}.png`) });
  for (const e of [...new Set(errors)].slice(0, 4)) fail(`${level} threw: ${e.split('\n')[0]}`);
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} floor(s) you cannot walk` : `\nall ${levels.length} floor(s) walkable to the lift`);
process.exit(failures ? 1 : 0);
