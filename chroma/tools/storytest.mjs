// Story mode ("The Underside") scripted checks in headless Chromium.
//   node chroma/tools/storytest.mjs                 # every suite
//   node chroma/tools/storytest.mjs l2 l5 --shots   # some suites, with screenshots in chroma/qa/
// Suites: hub shop migrate l1..l15 cycle ending (also: s1 s2 s3 = that sector's levels).
// Teleports the player through each level's objectives (checkpoints, jump pads,
// swatches, shards, every mechanic in the level, death + respawn, seals, the Hue
// Core), forces the bosses through their phases, and fails on any assertion or
// page error. Headless Chromium runs at a few fps, so waits are generous.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = fileURLToPath(new URL('../..', import.meta.url));
const qaDir = fileURLToPath(new URL('../qa/', import.meta.url));
await mkdir(qaDir, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(join(root, p))); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}/chroma/`;
const args = process.argv.slice(2);
const SHOTS = args.includes('--shots');
const ORDER = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10', 'l11', 'l12', 'l13', 'l14', 'l15'];
const BOSSES = ['l5', 'l10', 'l15'];
const GROUPS = { s1: ORDER.slice(0, 5), s2: ORDER.slice(5, 10), s3: ORDER.slice(10) };
const ALL = ['hub', 'shop', 'migrate', ...ORDER, 'cycle', 'ending'];
const run = args.filter((a) => !a.startsWith('--')).flatMap((a) => GROUPS[a] || [a]);
const suites = run.length ? run : ALL;
const KEY = 'chroma-clash-profile-v1';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('  [pageerror]', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('  [console.error]', m.text().slice(0, 300)); } });

let fails = 0, passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passes++; console.log(`  ok   ${name}`); }
  else { fails++; console.log(`  FAIL ${name} ${detail}`); }
};
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const waitFor = async (fn, arg, timeout = 15000) => { try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; } };
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(qaDir, `st_${name}.png`) }); };
const before = (id) => ORDER.slice(0, ORDER.indexOf(id));
// v2 profile (sector progress up to a level)
const profile = (cleared = [], extra = {}) => ({ created: true, name: 'Tester', coins: 1000, story: { v: 2, cleared, swatches: [], shards: 0, shardsTotal: 0, got: {}, up: {}, best: {}, flags: { intro: true, dabble: true, dabbleTalk: true, s1done: true, tintJoined: true, seen_hub2: true, seen_hub3: true }, deaths: 0 }, ...extra });
// the original v1 layout (no version, two arrays)
const profileV1 = (cleared = [], swatches = []) => ({ created: true, name: 'Tester', coins: 1000, story: { cleared, swatches } });

async function boot(level, prof) {
  await page.goto(`${BASE}index.html?qa&fast`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  if (prof !== undefined) await ev(([k, p]) => { if (p) localStorage.setItem(k, JSON.stringify(p)); else localStorage.removeItem(k); }, [KEY, prof]);
  await page.goto(`${BASE}index.html?story=${level}&qa&fast`);
  const ok = await waitFor((lv) => { const a = window.__chroma; return a?.mode?.levelId === lv && !a.loadingNow && a.mode.player; }, level, 150000);
  check(`${level}: story mode loaded`, ok);
  await wait(400);
  return ok;
}
const tp = (x, y, z, yaw = 0) => ev(([x, y, z, yaw]) => {
  const m = window.__chroma.mode, p = m.player;
  if (!p.alive) { p.respawn(); m.hud.splatted(false); }
  p.place(new p.pos.constructor(x, y, z), yaw);
  m.rig.snap(p, yaw);
}, [x, y, z, yaw]);
const state = () => ev(() => {
  const m = window.__chroma.mode, p = m.player;
  return { level: m.levelId, pos: p.pos.toArray(), alive: p.alive, hp: p.hp, cp: m.cpIndex, flight: !!m.flight, st: m.state, story: window.__chroma.profile.story, coins: window.__chroma.profile.coins };
});
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const domCounts = () => ev(() => ({ hud: document.querySelectorAll('#story-hud').length, style: document.querySelectorAll('#story-style').length }));
// keep the game thinking the mouse is captured so PlayerControl writes intents
const fakeLock = () => ev(() => { const i = window.__chroma.input; i.lock = () => {}; i.locked = true; });
const godMode = (on) => ev((on) => { window.__chroma.mode.player.invuln = on ? 999 : 0; }, on);
const advanceDialog = async (max = 40) => { for (let i = 0; i < max && (await ev(() => window.__chroma.mode.hud.dialogBlocking)); i++) { await page.keyboard.press('Space'); await wait(300); } };

// ------------------------------------------------------------------ generic level checks
async function checkpoints(id) {
  const cps = await ev(() => window.__chroma.mode.checkpoints.map((c) => [...c.pos.toArray(), c.yaw]));
  check(`${id}: has checkpoints`, cps.length >= 2, cps.length);
  for (let i = 0; i < cps.length; i++) {
    const [x, y, z, yaw] = cps[i];
    await tp(x + 0.4, y + 0.05, z, yaw);
    const ok = await waitFor((i) => window.__chroma.mode.cpIndex >= i, i, 15000);
    const sp = await ev(() => window.__chroma.mode.player.spawnPoint.toArray());
    check(`${id}: checkpoint ${i + 1} activates + moves the spawn`, ok && dist(sp, [x, y, z]) < 0.01, JSON.stringify(sp));
    if (SHOTS) { await wait(1800); await shot(`${id}_cp${i + 1}`); }
  }
}

async function pads(id) {
  const list = await ev(() => window.__chroma.mode.pads.map((p) => ({ from: p.pos.toArray(), to: p.def.to.toArray() })));
  for (let i = 0; i < list.length; i++) {
    const { from, to } = list[i];
    await tp(from[0], from[1] + 0.05, from[2]);
    const launched = await waitFor(() => !!window.__chroma.mode.flight, null, 6000);
    const landed = launched && await waitFor(() => !window.__chroma.mode.flight, null, 30000);
    await wait(400);
    const s = await state();
    check(`${id}: jump pad ${i + 1} launches and lands on target`, launched && landed && dist(s.pos, to) < 2.6, `launched=${launched} landed=${landed} pos=${s.pos.map((v) => v.toFixed(1))} to=${to}`);
  }
}

async function swatches(id) {
  const list = await ev(() => window.__chroma.mode.swatches.map((s) => ({ pos: s.pos.toArray(), sid: s.sid })));
  check(`${id}: has its Lost Swatches (${list.length})`, list.length >= 1 && list.length === (BOSSES.includes(id) ? 1 : 3), list.length);
  for (const { pos, sid } of list) {
    const s0 = await state();
    const before = s0.coins, already = s0.story.swatches.includes(sid);
    await tp(pos[0], pos[1] - 0.9, pos[2]);
    const ok = await waitFor((sid) => window.__chroma.profile.story?.swatches?.includes(sid), sid, 15000);
    const s = await state();
    // a swatch next to a jump pad may already have been grabbed by the pad check
    check(`${id}: swatch ${sid} pickup saves${already ? ' (picked up earlier)' : ' + pays 150'}`, ok && (already || s.coins === before + 150), `coins ${before} -> ${s.coins}`);
  }
  const saved = await ev(([k, ids]) => { const st = JSON.parse(localStorage.getItem(k) || '{}').story; return ids.every((i) => st?.swatches?.includes(i)); }, [KEY, list.map((l) => l.sid)]);
  check(`${id}: swatches persisted to localStorage`, !!saved);
  const hud = await ev(() => document.querySelector('#story-hud .sh-sw small')?.textContent || '');
  check(`${id}: HUD shows the swatch count`, hud.startsWith(`${list.length} / ${list.length}`), hud);
}

async function shards(id) {
  const info = await ev(() => { const M = window.__chroma.mode.mech; return { n: M.shards.length, big: M.shards.filter((s) => s.big).length, first: M.shards.find((s) => !s.echo && !s.taken && !s.big)?.pos.toArray(), idx: M.shards.find((s) => !s.echo && !s.taken && !s.big)?.i }; });
  check(`${id}: Hue Shards placed (${info.n}, ${info.big} big)`, info.n >= (BOSSES.includes(id) ? 4 : 18), info.n);
  if (!info.first) return;
  const before = (await state()).story.shards;
  await tp(info.first[0], info.first[1] + 0.05, info.first[2]);
  const ok = await waitFor(([b, id, i]) => window.__chroma.profile.story.shards > b && (window.__chroma.profile.story.got[id] || []).includes(i), [before, id, info.idx], 20000);
  const got = await ev((id) => window.__chroma.profile.story.got[id] || [], id);
  check(`${id}: picking up a shard pays + remembers it`, ok && got.includes(info.idx), `got=${JSON.stringify(got)} idx=${info.idx}`);
}

async function deathCheck(id) {
  await godMode(false);
  const sp = await ev(() => window.__chroma.mode.player.spawnPoint.toArray());
  await ev(() => { const m = window.__chroma.mode; m.player.takeDamage(9999, m.enemies[0] || null, 'test'); });
  const died = !(await state()).alive;
  const back = await waitFor(() => window.__chroma.mode.player.alive, null, 40000);
  const s = await state();
  check(`${id}: splat -> respawn at last checkpoint`, died && back && dist(s.pos, sp) < 0.6, `pos=${s.pos.map((v) => v.toFixed(1))} sp=${sp}`);
  const killY = await ev(() => window.__chroma.mode.world.level.killY);
  await tp(sp[0], killY - 1, sp[2]);
  const fell = await waitFor(() => !window.__chroma.mode.player.alive, null, 5000);
  const back2 = await waitFor(() => window.__chroma.mode.player.alive, null, 40000);
  check(`${id}: falling out respawns too`, fell && back2);
}

// ------------------------------------------------------------------ mechanics
async function mechanics(id) {
  const n = await ev(() => { const M = window.__chroma.mode.mech; return { movers: M.movers.length, crumbles: M.crumbles.length, sponges: M.sponges.length, switches: M.switches.filter((s) => !s.disabled).length, rails: M.rails.length, fans: M.fans.length, conveyors: M.conveyors.length, floods: M.floods.length, gates: M.gates.length, arenas: M.arenas.length, pumps: M.pumps.length, lanterns: M.lanterns.length, doors: M.doors.length }; });
  console.log(`  mechanics: ${JSON.stringify(n)}`);
  await godMode(true);
  for (let i = 0; i < n.movers; i++) await moverCheck(id, i);
  for (let i = 0; i < Math.min(2, n.crumbles); i++) await crumbleCheck(id, i);
  for (let i = 0; i < n.sponges; i++) await spongeCheck(id, i);
  for (let i = 0; i < n.floods; i++) await floodCheck(id, i);
  const plain = await ev(() => window.__chroma.mode.mech.switches.filter((s) => !s.disabled && !s.drain).length);
  for (let i = 0; i < plain; i++) await switchCheck(id, i);
  const needDoors = await ev(() => window.__chroma.mode.mech.doors.filter((d) => d.need).map((d) => ({ id: d.id, open: d.open })));
  if (needDoors.length) check(`${id}: doors that need several switches open once all are painted`, needDoors.every((d) => d.open), JSON.stringify(needDoors));
  for (let i = 0; i < n.rails; i++) await railCheck(id, i);
  for (let i = 0; i < n.fans; i++) await fanCheck(id, i);
  for (let i = 0; i < n.conveyors; i++) await conveyorCheck(id, i);
  for (let i = 0; i < n.gates; i++) await membraneCheck(id, i);
  for (let i = 0; i < n.lanterns; i++) await lanternCheck(id, i, i === 0);
  for (let i = 0; i < n.pumps; i++) await pumpCheck(id, i);
  for (let i = 0; i < n.arenas; i++) await arenaCheck(id, i);
  await godMode(false);
  return n;
}

async function moverCheck(id, i) {
  const r = await ev((i) => new Promise((res) => {
    const m = window.__chroma.mode, mv = m.mech.movers[i], s = mv.dyn.solid, p = m.player;
    // start in the middle of its route so it has somewhere to go
    p.place(s.center.clone().setY(s.max.y + 0.05), 0);
    const off0 = mv.dyn.offset.clone();
    let n = 0;
    const iv = setInterval(() => {
      n++;
      const moved = mv.dyn.offset.distanceTo(off0);
      if (moved > 1.2 || n > 140) {
        clearInterval(iv);
        const dx = Math.abs(p.pos.x - s.center.x), dz = Math.abs(p.pos.z - s.center.z);
        res({ moved, onIt: dx < (s.max.x - s.min.x) / 2 + 0.2 && dz < (s.max.z - s.min.z) / 2 + 0.2 && Math.abs(p.pos.y - s.max.y) < 0.35, kind: mv.orbit ? 'orbit' : mv.trigger || 'path' });
      }
    }, 100);
  }), i);
  check(`${id}: moving platform ${i + 1} (${r.kind}) moves and carries the player`, r.moved > 1.2 && r.onIt, JSON.stringify(r));
}

async function crumbleCheck(id, i) {
  const s0 = await ev((i) => { const m = window.__chroma.mode, k = m.mech.crumbles[i], s = k.dyn.solid; m.player.place(s.center.clone().setY(s.max.y + 0.05), 0); return k.state; }, i);
  const fell = await waitFor((i) => window.__chroma.mode.mech.crumbles[i].state === 'fall' && !window.__chroma.mode.mech.crumbles[i].dyn.solid.collide, i, 20000);
  await ev(() => { const m = window.__chroma.mode; m.player.place(m.player.spawnPoint.clone(), 0); });
  const back = await waitFor((i) => window.__chroma.mode.mech.crumbles[i].state === 'idle' && window.__chroma.mode.mech.crumbles[i].dyn.solid.collide, i, 60000);
  check(`${id}: crumbling floor ${i + 1} gives way under you, then comes back`, s0 === 'idle' && fell && back, `${s0} fell=${fell} back=${back}`);
}

async function spongeCheck(id, i) {
  const h0 = await ev((i) => {
    const m = window.__chroma.mode, sp = m.mech.sponges[i], so = sp.dyn.solid, f = so.sideFace.top;
    for (const [a, b] of [[0, 0], [0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) m.world.paint.splat(f.center.clone().addScaledVector(f.u, a * f.w * 0.5).addScaledVector(f.v, b * f.h * 0.5).setY(so.max.y + 0.2), Math.max(f.w, f.h) * 0.45, 1);
    return so.max.y;
  }, i);
  const grown = await waitFor((i) => { const sp = window.__chroma.mode.mech.sponges[i]; return sp.grown && sp.k >= 1; }, i, 40000);
  const r = await ev((i) => { const sp = window.__chroma.mode.mech.sponges[i], so = sp.dyn.solid; return { h: sp.dyn.h, full: sp.hFull, small: sp.h0, top: so.max.y, bottom: so.min.y, shrink: sp.shrink }; }, i);
  check(`${id}: sponge ${i + 1} grows from ${r.small} m to its full ${r.full.toFixed(1)} m when painted`, grown && Math.abs(r.h - r.full) < 0.01 && Math.abs(r.top - r.bottom - r.full) < 0.01, JSON.stringify({ h0, ...r }));
  if (r.shrink && i === (await ev(() => window.__chroma.mode.mech.sponges.findIndex((s) => s.shrink > 0)))) {
    const dried = await waitFor((i) => !window.__chroma.mode.mech.sponges[i].grown, i, 150000);
    check(`${id}: timed sponge ${i + 1} drips dry again`, dried);
  }
}

async function switchCheck(id, i) {
  const info = await ev((i) => {
    const m = window.__chroma.mode, sw = m.mech.switches.filter((s) => !s.disabled && !s.drain)[i], f = sw.faceObj;
    const c = f.center.clone().addScaledVector(f.n, 0.15);
    for (const [a, b] of [[0, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) m.world.paint.splat(c.clone().addScaledVector(f.u, a * f.w * 0.5).addScaledVector(f.v, b * f.h * 0.5), Math.max(f.w, f.h) * 0.45, 1);
    return { id: sw.id, targets: sw.targets, timed: sw.timed, drain: sw.drain };
  }, i);
  const on = await waitFor((sid) => window.__chroma.mode.mech.switches.find((s) => s.id === sid).active, info.id, 15000);
  let doorsOk = true;
  for (const t of info.targets) {
    const isDoor = await ev((t) => window.__chroma.mode.mech.doors.some((d) => d.id === t), t);
    if (isDoor) doorsOk = doorsOk && await waitFor((t) => window.__chroma.mode.mech.doors.filter((d) => d.id === t).every((d) => d.open && d.k > 0.9), t, 25000);
  }
  check(`${id}: paint switch ${info.id} activates${info.targets.length ? ' and opens ' + info.targets.join(',') : ''}`, on && doorsOk, JSON.stringify(info));
  if (info.timed) {
    const timer = await ev(() => !!document.querySelector('#story-hud .sh-timer.on'));
    const reset = await waitFor((sid) => !window.__chroma.mode.mech.switches.find((s) => s.id === sid).active, info.id, 180000);
    const closed = await waitFor((t) => window.__chroma.mode.mech.doors.filter((d) => d.id === t).every((d) => !d.open), info.targets[0], 20000);
    check(`${id}: timed switch ${info.id} shows a countdown, then resets and the door shuts`, timer && reset && closed, `timer=${timer} reset=${reset} closed=${closed}`);
  }
}

async function railCheck(id, i) {
  const r = await ev((i) => new Promise((res) => {
    const m = window.__chroma.mode, M = m.mech, rl = M.rails[i], p = m.player;
    M.rideCool = 0; M.ride = null;
    const a = rl.pts[0], b = rl.pts[1];
    const st = a.clone().lerp(b, 0.15);
    p.place(st.clone().setY(st.y - 1.25), 0);
    const end = rl.pts[rl.pts.length - 1];
    let rode = false, n = 0;
    const iv = setInterval(() => {
      n++;
      if (M.riding) rode = true;
      if ((rode && !M.riding && p.onGround) || n > 220) { clearInterval(iv); res({ rode, d: Math.hypot(p.pos.x - end.x, p.pos.z - end.z), alive: p.alive }); }
    }, 100);
  }), i);
  check(`${id}: ink rail ${i + 1} grabs the player and carries them to the far end`, r.rode && r.d < 6 && r.alive, JSON.stringify(r));
}

async function fanCheck(id, i) {
  const r = await ev((i) => new Promise((res) => {
    const m = window.__chroma.mode, f = m.mech.fans[i], p = m.player;
    const was = f.on; f.on = true;
    p.place(f.pos.clone().setY(f.pos.y + 0.4), 0);
    const y0 = p.pos.y;
    let top = y0, n = 0;
    const iv = setInterval(() => { n++; top = Math.max(top, p.pos.y); if (top - y0 > 4 || n > 100) { clearInterval(iv); f.on = was; res({ rise: top - y0 }); } }, 100);
  }), i);
  check(`${id}: updraft fan ${i + 1} lifts the player`, r.rise > 4, JSON.stringify(r));
}

async function conveyorCheck(id, i) {
  const r = await ev((i) => new Promise((res) => {
    const m = window.__chroma.mode, cv = m.mech.conveyors[i], p = m.player, s = cv.solid;
    const c = s.center.clone().setY(s.max.y + 0.05);
    // stand a little upstream so the belt has room to carry us
    c.addScaledVector(cv.dir, -Math.min(2, cv.len * 0.25));
    p.place(c, 0);
    const p0 = p.pos.clone();
    let n = 0;
    const iv = setInterval(() => { n++; const d = p.pos.clone().sub(p0); const along = d.dot(cv.dir); if (along > 0.6 || n > 120) { clearInterval(iv); res({ along, alive: p.alive }); } }, 100);
  }), i);
  check(`${id}: conveyor belt ${i + 1} pushes the player along`, r.along > 0.6, JSON.stringify(r));
}

async function floodCheck(id, i) {
  const r = await ev((i) => new Promise((res) => {
    const m = window.__chroma.mode, M = m.mech, f = M.floods[i];
    f.on = true;
    const y0 = f.y;
    setTimeout(() => {
      const rose = f.y > y0 + 0.05;
      const t0 = M.floodTarget(f);
      for (const d of f.drains) { const sw = M.switches.find((s) => s.id === d); if (sw && !sw.active) M.activateSwitch(sw); }
      const t1 = M.floodTarget(f);
      res({ rose, y0, y: f.y, t0, t1, drains: f.drains.length });
    }, 6000);
  }), i);
  const lowered = r.drains === 0 || r.t1 < r.t0;
  check(`${id}: gray flood ${i + 1} rises${r.drains ? ' and painting the drains pulls it down' : ' (a chase, no drains)'}`, r.rose && lowered, JSON.stringify(r));
  if (r.drains) {
    const receded = await waitFor((i) => { const M = window.__chroma.mode.mech, f = M.floods[i]; return f.y <= M.floodTarget(f) + 0.05; }, i, 90000);
    check(`${id}: flood ${i + 1} recedes once drained`, receded);
  } else await ev((i) => { const f = window.__chroma.mode.mech.floods[i]; f.on = false; f.y = f.y0; }, i);
}

async function membraneCheck(id, i) {
  await fakeLock();
  await waitFor((i) => window.__chroma.mode.mech.gates[i].solid.collide, i, 15000);
  const solid = await ev((i) => { const m = window.__chroma.mode, g = m.mech.gates[i]; if (!m.player.alive) m.player.respawn(); const c = g.min.clone().add(g.max).multiplyScalar(0.5); m.player.place(c.clone().setY(g.min.y + 0.05).addScaledVector(g.axis === 'x' ? new c.constructor(1, 0, 0) : new c.constructor(0, 0, 1), -1.4), g.axis === 'x' ? Math.PI / 2 : 0); return g.solid.collide; }, i);
  await wait(300);
  const solidNow = await ev((i) => window.__chroma.mode.mech.gates[i].solid.collide, i);
  await ev(() => { const inp = window.__chroma.input; inp._act = inp._act || inp.action.bind(inp); inp.action = (n) => (n === 'goo' ? true : inp._act(n)); });
  const pass = await waitFor((i) => !window.__chroma.mode.mech.gates[i].solid.collide, i, 15000);
  await ev(() => { const inp = window.__chroma.input; inp.action = inp._act; });
  await waitFor((i) => window.__chroma.mode.mech.gates[i].solid.collide, i, 15000);
  check(`${id}: chroma membrane ${i + 1} is solid to walkers, open to swimmers`, solid && solidNow && pass, `solid=${solid}/${solidNow} pass=${pass}`);
}

async function lanternCheck(id, i, verbose) {
  const r = await ev((i) => { const m = window.__chroma.mode, l = m.mech.lanterns[i]; m.world.paint.splat(l.pos.clone().setY(l.pos.y + 0.05), 1.6, 1); return l.lit; }, i);
  const lit = await waitFor((i) => window.__chroma.mode.mech.lanterns[i].lit, i, 5000);
  if (verbose || !lit) check(`${id}: painting under lantern ${i + 1} lights it`, !r && lit);
}

async function arenaCheck(id, i) {
  const info = await ev((i) => { const m = window.__chroma.mode, a = m.mech.arenas[i]; const c = a.min.clone().add(a.max).multiplyScalar(0.5); const g = m.world.level.groundAt(c.x, c.z, a.max.y, 0.3, 30); m.player.place(c.clone().setY(Number.isFinite(g.y) ? g.y + 0.05 : a.min.y + 1), 0); return { id: a.id, waves: a.waves.length, doors: a.doors }; }, i);
  const active = await waitFor((i) => window.__chroma.mode.mech.arenas[i].state === 'active', i, 6000);
  await wait(800);
  const closed = info.doors.length === 0 || await ev((ids) => window.__chroma.mode.mech.doors.filter((d) => ids.includes(d.id)).every((d) => !d.open), info.doors);
  const spawned = await ev((g) => window.__chroma.mode.enemies.filter((e) => e.alive && e.group === g).length, 'arena:' + info.id);
  if (i === 0) await shot(`${id}_arena`);
  // splash every wave
  for (let k = 0; k < 40; k++) {
    if ((await ev((i) => window.__chroma.mode.mech.arenas[i].state, i)) === 'done') break;
    await ev((g) => { const m = window.__chroma.mode; for (const e of m.enemies) if (e.alive && e.group === g) e.die(m.player, 'test'); }, 'arena:' + info.id);
    await wait(1500);
  }
  const done = await waitFor((i) => window.__chroma.mode.mech.arenas[i].state === 'done', i, 40000);
  const flag = await ev((f) => window.__chroma.mode.mech.flag(f), 'arena:' + info.id);
  const opened = info.doors.length === 0 || await waitFor((ids) => window.__chroma.mode.mech.doors.filter((d) => ids.includes(d.id)).every((d) => d.open), info.doors, 20000);
  check(`${id}: arena "${info.id}" locks, spawns ${info.waves} waves, unlocks when cleared`, active && closed && spawned > 0 && done && flag && opened, JSON.stringify({ active, closed, spawned, done, flag, opened }));
}

async function pumpCheck(id, i) {
  const r = await ev((i) => { const m = window.__chroma.mode, pm = m.mech.pumps[i]; const c = pm.zone.min.clone().add(pm.zone.max).multiplyScalar(0.5); m.player.place(c.clone().setY(pm.pos.y + 0.05), 0); return pm.state; }, i);
  const running = await waitFor((i) => window.__chroma.mode.mech.pumps[i].state === 'run', i, 6000);
  await waitFor(() => window.__chroma.mode.enemies.some((e) => e.alive && e.group === 'pump' && e.foe), null, 15000);
  const hit = await ev((i) => { const m = window.__chroma.mode, pm = m.mech.pumps[i]; const before = pm.hp; m.world.combat.damage(pm.proxy, 40, m.enemies.find((e) => e.alive) || null, 'test'); return { before, after: pm.hp, inFighters: m.world.fighters.includes(pm.proxy), enemies: m.enemies.filter((e) => e.alive && e.group === 'pump').length, targeted: m.enemies.some((e) => e.alive && e.foe === pm.proxy) }; }, i);
  const bar = await ev(() => !!document.querySelector('#story-hud .sh-boss.on'));
  // fast-forward the pumping
  await ev((i) => { const pm = window.__chroma.mode.mech.pumps[i]; pm.t = pm.time - 0.2; }, i);
  const done = await waitFor((i) => window.__chroma.mode.mech.pumps[i].state === 'done', i, 10000);
  const flag = await ev(() => window.__chroma.mode.mech.flag('pump'));
  check(`${id}: defend-the-pump starts, takes Drab damage, completes`, r === 'idle' && running && hit.after < hit.before && hit.inFighters && hit.enemies > 0 && hit.targeted && bar && done && flag, JSON.stringify({ r, running, ...hit, bar, done, flag }));
}

// ------------------------------------------------------------------ core / clear
async function sealAndCore(id) {
  // splash any remaining guards, then whatever flags the seal still needs
  await ev(() => { const m = window.__chroma.mode; for (const e of m.enemies) if (e.alive && e.group !== 'boss') e.die(m.player, 'test'); });
  await wait(600);
  const need = await ev(() => { const m = window.__chroma.mode; return (m.course.core?.need || []).filter((f) => !m.mech.flag(f)); });
  check(`${id}: every seal requirement was met by playing (${need.join(',') || 'none left'})`, need.length === 0, JSON.stringify(need));
  await ev(() => { const m = window.__chroma.mode; for (const f of m.course.core?.need || []) m.mech.setFlag(f); m.checkSeal(); });
  await coreCheck(id);
}

async function coreCheck(id) {
  const core = await ev(() => { const c = window.__chroma.mode.core; return c && { pos: c.pos.toArray(), locked: c.locked }; });
  check(`${id}: Hue Core present and unsealed`, core && !core.locked, JSON.stringify(core));
  if (!core) return;
  const s0 = await state();
  const wasCleared = s0.story?.cleared?.includes(id);
  await tp(core.pos[0], core.pos[1] + 0.1, core.pos[2] - 1.2);
  const ok = await waitFor(() => window.__chroma.mode.state === 'clear', null, 25000);
  const s = await state();
  check(`${id}: touching the core clears the level`, ok && s.story.cleared.includes(id), JSON.stringify(s.story.cleared));
  check(`${id}: first clear pays 400 coins + bonus shards`, wasCleared || (s.coins === s0.coins + 400 && s.story.shards >= s0.story.shards + 30), `${s0.coins} -> ${s.coins}, shards ${s0.story.shards} -> ${s.story.shards}`);
  const overlay = await waitFor(() => !!(window.__chroma.mode.hud.clearOpen && document.querySelector('#story-hud .sh-clear.on')), null, 45000);
  check(`${id}: HUE CORE RECOVERED overlay shows`, overlay);
  await shot(`${id}_clear`);
  await waitFor(() => window.__chroma.mode.clearT > 3.2, null, 45000);
  for (let k = 0; k < 10 && !(await ev(() => window.__chroma.mode.leaving || window.__chroma.loadingNow)); k++) { await page.keyboard.press('KeyE'); await wait(700); }
  const i0 = ORDER.indexOf(id);
  const expectHub = BOSSES.includes(id) || i0 < 5 ? 'hub' : i0 < 10 ? 'hub2' : 'hub3';
  const hub = await waitFor(([id, h]) => { const a = window.__chroma; return a.mode?.levelId === h && !a.loadingNow && a.mode.opts.from === id; }, [id, expectHub], 120000);
  check(`${id}: continue returns to ${expectHub}`, hub);
  if (!hub) return;
  await wait(500);
  const near = await ev((id) => {
    const m = window.__chroma.mode;
    const h = m.hatches.find((x) => x.id === id) || m.gates.find((g) => g.sector.levels.includes(id));
    return h ? Math.hypot(h.pos.x - m.player.pos.x, h.pos.z - m.player.pos.z) : 99;
  }, id);
  check(`${id}: spawn is next to its hatch / gate`, near < 4.5, near.toFixed(2));
  const i = ORDER.indexOf(id);
  if (i < ORDER.length - 1) {
    const st = await ev((nid) => window.__chroma.mode.hatchStatus(nid), ORDER[i + 1]);
    check(`${id}: next level unlocked`, st === 'open', st);
  }
  const dc = await domCounts();
  check(`${id}: exactly one story HUD + style after the switch`, dc.hud === 1 && dc.style === 1, JSON.stringify(dc));
}

// ------------------------------------------------------------------ suites
async function suiteLevel(id) {
  console.log(`\n== ${id}`);
  if (!(await boot(id, profile(before(id))))) return;
  await godMode(true);
  await shot(`${id}_start`);
  const objective = await ev(() => document.querySelector('#story-hud .sh-obj')?.textContent || '');
  check(`${id}: objective shown`, objective.length > 4, objective);
  const tips = await ev(() => window.__chroma.mode.course.tips.length);
  check(`${id}: has signposting tips`, tips >= 3, tips);
  if (id === 'l1') {
    await fakeLock();
    await tp(0, 0, 15, 0);
    await wait(300);
    await page.keyboard.down('ShiftLeft');
    const swim = await waitFor(() => window.__chroma.mode.player.submerged, null, 5000);
    await page.keyboard.up('ShiftLeft');
    check('l1: SHIFT in own ink = submerged swim', swim);
    // real weapon fire pops a Smudge
    const target = await ev(() => { const m = window.__chroma.mode; const e = m.enemies.find((x) => x.alive); m.player.place(e.pos.clone().setZ(e.pos.z - 4.5), 0); m.rig.snap(m.player, 0); m.player.invuln = 99; return m.enemies.indexOf(e); });
    await ev((i) => { const m = window.__chroma.mode; window.__aim = setInterval(() => { const e = m.enemies[i], p = m.player; if (!e) return; m.rig.yaw = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z); m.rig.pitch = -0.32; }, 30); }, target);
    await page.mouse.move(480, 270);
    await page.mouse.down();
    const popped = await waitFor((i) => !window.__chroma.mode.enemies[i].alive, target, 25000);
    await page.mouse.up();
    await ev(() => { clearInterval(window.__aim); window.__chroma.mode.player.invuln = 0; });
    check('l1: shooting a Smudge with the real weapon pops it', popped);
    const drop = await waitFor(() => window.__chroma.mode.mech.drops.length > 0 || window.__chroma.mode.runShards > 0, null, 5000);
    check('l1: splashed Drab drop Hue Shards', drop);
  }
  if (id === 'l2') {
    const g = await ev(() => { const m = window.__chroma.mode; const mesh = m.world.level.meshes.find((x) => x.name === 'level-ghost'); return { n: m.course.ghosts.length, mesh: !!mesh, shadow: mesh?.castShadow }; });
    check('l2: ghost floors built with their own material', g.n >= 20 && g.mesh && g.shadow === false, JSON.stringify(g));
    await tp(7.5, 0.3, 19, 0);
    await wait(1500);
    const s = await state();
    check('l2: unpainted ghost floor still has collision', s.alive && Math.abs(s.pos[1]) < 0.05, s.pos.join());
  }
  if (id === 'l3') {
    await tp(0, 0, 14, 0);
    const fired = await waitFor(() => window.__chroma.mode.combat.proj.some((p) => p.alive && p.team === 2 && p.kind === 'blob'), null, 20000);
    check('l3: Blotters fire gray blobs at the player', fired);
  }
  if (id === 'l11') {
    const dark = await ev(() => { const m = window.__chroma.mode; return { light: !!m.playerLight, glow: m.course.def.glowInk > 0, sun: m.env.sun.intensity }; });
    check('l11: darkness: player glow light, glowing ink, dim sun', dark.light && dark.glow && dark.sun < 1, JSON.stringify(dark));
  }
  await enemyTells(id);
  await godMode(true);
  await checkpoints(id);
  await pads(id);
  await swatches(id);
  await shards(id);
  await mechanics(id);
  await deathCheck(id);
  await sealAndCore(id);
}

// every new enemy type shows its tell / counter in at least one level
async function enemyTells(id) {
  const kinds = await ev(() => [...new Set(window.__chroma.mode.enemies.map((e) => e.name))]);
  const ws = await ev(() => { const m = window.__chroma.mode; const k = new Set(); for (const a of m.mech.arenas) for (const w of a.waves) for (const e of w) k.add(e.kind); for (const p of m.mech.pumps) for (const w of p.waves) for (const e of w.list) k.add(e.kind); return [...k]; });
  console.log(`  enemies: ${kinds.join(', ')}${ws.length ? ' | waves: ' + ws.join(', ') : ''}`);
  await godMode(true);
  const revive = () => ev(() => { const m = window.__chroma.mode, p = m.player; if (!p.alive) { p.respawn(); m.hud.splatted(false); } p.invuln = 999; p.hp = 100; });
  if (kinds.includes('Gooper')) {
    await revive();
    const r = await ev(() => new Promise((res) => {
      const m = window.__chroma.mode, g = m.enemies.find((e) => e.name === 'Gooper' && e.alive);
      m.player.place(g.pos.clone().add(new g.pos.constructor(0, 0.1, -6)), 0);
      // let it wake up (and lay its puddle) before testing
      setTimeout(() => {
        const hp0 = g.hp; g.state = 'hidden'; g.k = 0; m.world.combat.damage(g, 50, m.player, 'drop');
        const immune = g.hp === hp0;
        m.world.paint.splat(g.pos.clone().setY(g.pos.y + 0.05), 2.6, 1);
        let n = 0; const iv = setInterval(() => { n++; if (g.state === 'exposed' || n > 60) { clearInterval(iv); res({ immune, exposed: g.state === 'exposed' }); } }, 100);
      }, 3000);
    }));
    check(`${id}: Gooper is immune in its puddle, painting the puddle flushes it out`, r.immune && r.exposed, JSON.stringify(r));
  }
  if (kinds.includes('Warden')) {
    await revive();
    const r = await ev(() => { const m = window.__chroma.mode, w = m.enemies.find((e) => e.name === 'Warden' && e.alive), p = m.player; const hp0 = w.hp; p.place(w.pos.clone().add(new w.pos.constructor(Math.sin(w.yaw) * 4, 0, Math.cos(w.yaw) * 4)), 0); m.world.combat.damage(w, 40, p, 'drop'); const front = w.hp; p.place(w.pos.clone().add(new w.pos.constructor(-Math.sin(w.yaw) * 4, 0, -Math.cos(w.yaw) * 4)), 0); m.world.combat.damage(w, 40, p, 'drop'); const back = w.hp; m.world.combat.damage(w, 20, p, 'blast'); return { hp0, front, back, blast: w.hp }; });
    check(`${id}: Warden blocks frontal shots, takes extra from behind and from blasts`, r.front === r.hp0 && r.back < r.front - 40 && r.blast < r.back, JSON.stringify(r));
  }
  if (kinds.includes('Glint')) {
    await revive();
    const r = await ev(() => new Promise((res) => {
      const m = window.__chroma.mode, g = m.enemies.find((e) => e.name === 'Glint' && e.alive), p = m.player;
      p.place(g.pos.clone().add(new g.pos.constructor(Math.sin(g.yaw) * 10, 0, Math.cos(g.yaw) * 10)).setY(g.pos.y), 0);
      p.invuln = 999; p.hp = 100; const seen = new Set(); let n = 0;
      const iv = setInterval(() => { n++; seen.add(g.state); if (g.laser.visible) seen.add('laser'); if ((seen.has('lock') && g.state === 'idle') || n > 150) { clearInterval(iv); p.invuln = 999; res([...seen]); } }, 100);
    }));
    check(`${id}: Glint tracks with a visible laser, locks (red), then fires`, r.includes('aim') && r.includes('lock') && r.includes('laser'), JSON.stringify(r));
  }
  if (kinds.includes('Pilfer')) {
    await revive();
    const r = await ev(() => new Promise((res) => {
      const m = window.__chroma.mode, f = m.enemies.find((e) => e.name === 'Pilfer' && e.alive), p = m.player;
      p.ink = 1; p.place(f.pos.clone().add(new f.pos.constructor(0.9, 0, 0)), 0); f.aggro = true; f.losT = 0;
      let n = 0;
      const iv = setInterval(() => { n++; if (f.stolen > 0 || n > 120) { clearInterval(iv); const ink = p.ink; f.takeDamage(9999, p, 'test'); setTimeout(() => res({ stolen: f.stolen, inkAfterTheft: ink, inkBack: p.ink }), 300); } }, 100);
    }));
    check(`${id}: Pilfer steals ink, splashing it gives the ink back`, r.stolen > 0.2 && r.inkBack > r.inkAfterTheft + 0.2, JSON.stringify(r));
  }
  if (kinds.includes('Splotch')) {
    await revive();
    const r = await ev(() => new Promise((res) => {
      const m = window.__chroma.mode, s = m.enemies.find((e) => e.name === 'Splotch' && e.alive);
      const n0 = m.enemies.filter((e) => e.alive).length; s.takeDamage(99999, m.player, 'test');
      setTimeout(() => res({ n0, n1: m.enemies.filter((e) => e.alive).length, kids: m.enemies.filter((e) => e.alive && e.name === 'Splotchling').length }), 300);
    }));
    check(`${id}: Splotch splits into two Splotchlings`, r.kids >= 2 && r.n1 === r.n0 + 1, JSON.stringify(r));
  }
  if (kinds.includes('Rumbler')) {
    await revive();
    const r = await ev(() => new Promise((res) => {
      const m = window.__chroma.mode, u = m.enemies.find((e) => e.name === 'Rumbler' && e.alive), p = m.player;
      p.place(u.pos.clone().add(new u.pos.constructor(0, 0, -9)), 0); u.aggro = true; u.cool = 0; const seen = new Set(); let n = 0;
      const iv = setInterval(() => { n++; seen.add(u.state); if (seen.has('charge') || n > 150) { clearInterval(iv); res([...seen]); } }, 100);
    }));
    check(`${id}: Rumbler revs up then charges`, r.includes('rev') && r.includes('charge'), JSON.stringify(r));
  }
  await godMode(false);
}

// ------------------------------------------------------------------ bosses
async function bossIntro(id) {
  const b = await ev(() => { const m = window.__chroma.mode; return { title: m.boss.title, z: m.course.zones.find((z) => z.id === 'arena') }; });
  const z = b.z;
  await tp((z.min.x + z.max.x) / 2, 0.05, z.min.z + 3, 0);
  const intro = await waitFor(() => window.__chroma.mode.boss.state === 'intro', null, 6000);
  check(`${id}: entering the arena starts the boss intro`, intro);
  await wait(1500);
  await shot(`${id}_intro`);
  await advanceDialog();
  const began = await waitFor(() => window.__chroma.mode.boss.fighting, null, 8000);
  check(`${id}: fight begins after the intro`, began, await ev(() => window.__chroma.mode.boss.state));
  const bar = await ev(() => document.querySelector('#story-hud .sh-boss.on .nm')?.textContent || '');
  check(`${id}: boss health bar with name "${bar}"`, bar === b.title, bar);
}
async function bossFinish(id) {
  const dead = await waitFor(() => window.__chroma.mode.boss.state === 'dead' && !!window.__chroma.mode.core, null, 180000);
  check(`${id}: boss defeated -> finishing cinematic -> core appears`, dead, await ev(() => window.__chroma.mode.boss.state));
  await wait(800);
  await shot(`${id}_defeated`);
  await deathCheck(id);
  await coreCheck(id);
}

async function suiteL5() {
  console.log('\n== l5 The Gray Engine (boss)');
  if (!(await boot('l5', profile(before('l5'))))) return;
  await swatches('l5'); await shards('l5');
  await bossIntro('l5');
  check('l5: arena door slams shut', await ev(() => window.__chroma.mode.course.door.collide === true));
  await godMode(true);
  await pads('l5');
  const minions = await waitFor(() => window.__chroma.mode.enemies.some((e) => e.group === 'boss' && e.alive), null, 8000);
  check('l5: boss summons Smudges', minions);
  const closed = await ev(() => { const m = window.__chroma.mode, b = m.boss; const h = b.valveHp[0]; m.world.combat.damage(b.valves[0], 50, m.player, 'test'); return !b.valves[0].alive && b.valveHp[0] === h; });
  check('l5: closed valves are not exposed', closed);
  for (let i = 0; i < 4; i++) {
    await ev((i) => { const m = window.__chroma.mode, f = m.course.shutters[i].face; const c = f.center.clone().addScaledVector(f.n, 0.15); for (const [a, b] of [[0, 0], [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]]) m.world.paint.splat(c.clone().addScaledVector(f.u, a).addScaledVector(f.v, b), 1.0, 1); }, i);
    const open = await waitFor((i) => window.__chroma.mode.course.shutters[i].open && window.__chroma.mode.boss.valves[i].alive, i, 6000);
    check(`l5: painting shutter ${i + 1} exposes its valve`, open);
    await ev((i) => { const m = window.__chroma.mode; m.world.combat.damage(m.boss.valves[i], 999, m.player, 'test'); }, i);
    await wait(150);
  }
  const p2 = await waitFor(() => window.__chroma.mode.boss.state === 'p2', null, 60000);
  check('l5: all valves burst -> phase 2 (heart exposed)', p2);
  const shieldBlock = await ev(() => { const m = window.__chroma.mode, b = m.boss; const h = b.heartHp; m.world.combat.damage(b.shields[0], 100, m.player, 'test'); return b.heartHp === h && b.hearts.every((x) => x.alive); });
  check('l5: heart hitboxes live, shields absorb hits', shieldBlock);
  await ev(() => { window.__chroma.mode.boss.ventT = 0; });
  const vents = await waitFor(() => window.__chroma.mode.boss.vents.length > 0, null, 15000);
  check('l5: phase 2 floor vents bubble (telegraph) then erupt', vents);
  await tp(0, 0, -12, 0); await wait(1200); await shot('l5_phase2');
  // sweep: standing gets hit, swimming in own ink dodges
  await fakeLock();
  const sweepHurt = await ev(() => new Promise((res) => {
    const m = window.__chroma.mode, b = m.boss, p = m.player;
    b.lobT = 99; b.lobQueue.length = 0; b.summonT = 99; b.sweepT = 99; b.ventT = 99;
    for (const e of m.enemies) if (e.group === 'boss' && e.alive) e.die(p, 'clear');
    p.place(p.pos.clone().set(12, 0, 0), 0); p.invuln = 0; p.hp = 100;
    m.world.paint.splat(p.pos.clone().set(12, 0.02, 0), 2.6, 1);
    b.sweepHitT = 0; b.startSweep(p); b.sweep.ang = 0.9; b.sweep.dir = -1;
    let t = 0; const iv = setInterval(() => { t += 100; if (b.sweepHitT > 0 || t > 50000) { clearInterval(iv); res(b.sweepHitT > 0 && (p.hp < 100 || !p.alive)); } }, 50);
  }));
  check('l5: sweep beam hits a player standing on the floor', sweepHurt);
  await waitFor(() => window.__chroma.mode.player.alive, null, 15000);
  await ev(() => { const m = window.__chroma.mode; m.boss.sweep = null; for (const b of m.boss.beams) b.visible = false; });
  await tp(-12, 0, 0, 0);
  await ev(() => { const m = window.__chroma.mode, p = m.player; for (let i = 0; i < 6; i++) m.world.paint.splat(p.pos.clone().set(-12 + (i - 3) * 0.6, 0.02, 0), 2.4, 1); });
  await page.keyboard.down('ShiftLeft');
  const sub = await waitFor(() => window.__chroma.mode.player.submerged, null, 6000);
  const dodged = sub && await ev(() => new Promise((res) => {
    const m = window.__chroma.mode, b = m.boss, p = m.player;
    p.hp = 100; p.invuln = 0; b.lobT = 99; b.lobQueue.length = 0; b.summonT = 99; b.ventT = 99;
    for (const e of m.enemies) if (e.group === 'boss' && e.alive) e.die(p, 'clear');
    b.startSweep(p); b.sweep.ang = Math.PI + 0.9; b.sweep.dir = -1;
    let t = 0, hit = false; b.sweepHitT = 0; const iv = setInterval(() => { t += 50; hit = hit || b.sweepHitT > 0; if (!b.sweep || t > 50000) { clearInterval(iv); res(!hit && p.alive && t <= 50000); } }, 50);
  }));
  await page.keyboard.up('ShiftLeft');
  check('l5: swimming in own ink dodges the sweep', dodged, `submerged=${sub}`);
  await godMode(true);
  // heart to 60% -> overdrive: tanks on the pillars
  await ev(() => { const m = window.__chroma.mode, b = m.boss; m.world.combat.damage(b.hearts[0], 900, m.player, 'test'); });
  const p3 = await waitFor(() => window.__chroma.mode.boss.state === 'p3', null, 30000);
  const tanks = await ev(() => window.__chroma.mode.boss.tanks.filter((t) => t.alive).length);
  check('l5: heart at 60% -> overdrive: coolant tanks rise on the 4 pillars', p3 && tanks === 4, `p3=${p3} tanks=${tanks}`);
  const heartSafe = await ev(() => { const m = window.__chroma.mode, b = m.boss; const h = b.heartHp; m.world.combat.damage(b.hearts[1], 300, m.player, 'test'); return b.heartHp === h; });
  check('l5: the heart is hidden during overdrive', heartSafe);
  await tp(-13, 3.6, -13, 0); await wait(1500); await shot('l5_tanks');
  for (let i = 0; i < 4; i++) await ev((i) => { const m = window.__chroma.mode; m.world.combat.damage(m.boss.tanks[i], 999, m.player, 'test'); }, i);
  const vent = await waitFor(() => window.__chroma.mode.boss.state === 'vent', null, 8000);
  const exposed = await ev(() => { const m = window.__chroma.mode, b = m.boss; const h = b.heartHp; m.world.combat.damage(b.hearts[0], 200, m.player, 'test'); return { hit: b.heartHp < h, shields: b.shields.some((s) => s.alive) }; });
  check('l5: all tanks burst -> overheated: heart exposed without shields (punish window)', vent && exposed.hit && !exposed.shields, JSON.stringify(exposed));
  const p4 = await waitFor(() => window.__chroma.mode.boss.state === 'p4', null, 120000);
  const ring = await ev(() => { const b = window.__chroma.mode.boss; b.launchRing(); return b.rings.length > 0; });
  check('l5: punish window ends -> phase 4 meltdown with shockwave rings', p4 && ring);
  const frac = await ev(() => window.__chroma.mode.boss.frac);
  check('l5: boss health bar fraction tracks damage', frac > 0 && frac < 0.34, frac.toFixed(3));
  await ev(() => { const m = window.__chroma.mode, b = m.boss; m.world.combat.damage(b.hearts[1], 99999, m.player, 'test'); });
  const cine = await waitFor(() => !!window.__chroma.mode.cine, null, 5000);
  check('l5: the finish plays as a cinematic', cine);
  await godMode(false);
  await bossFinish('l5');
  await advanceDialog();
}

async function suiteL10() {
  console.log('\n== l10 The Grimewyrm (boss)');
  if (!(await boot('l10', profile(before('l10'))))) return;
  await swatches('l10'); await shards('l10');
  await bossIntro('l10');
  const door = await waitFor(() => window.__chroma.mode.mech.doors.find((d) => d.id === 'wyrmDoor').k < 0.05, null, 15000);
  check('l10: the reservoir door slams shut', door);
  await godMode(true);
  const lunge = await ev(() => new Promise((res) => {
    const m = window.__chroma.mode, b = m.boss, p = m.player;
    p.place(p.pos.clone().set(0, 0, -15), 0);
    b.act = { kind: 'rise', t: 0, at: new p.pos.constructor(0, 0, -10) };
    const seen = new Set(); let n = 0;
    const iv = setInterval(() => { n++; seen.add(b.act?.kind); if (b.eye.alive) seen.add('eye'); if (seen.has('eye') || n > 250) { clearInterval(iv); res([...seen]); } }, 100);
  }));
  check('l10: the Wyrm rises (telegraph), aims (line), lunges, gets stuck with its eye exposed', ['rise', 'aim', 'lunge', 'stuck', 'eye'].every((k) => lunge.includes(k)), JSON.stringify(lunge));
  await wait(400); await shot('l10_stuck');
  const drainsOff = await ev(() => window.__chroma.mode.mech.switches.filter((s) => s.drain).every((s) => s.disabled));
  check('l10: drains stay inactive in phase 1', drainsOff);
  await ev(() => { const m = window.__chroma.mode, b = m.boss; b.eye.alive = true; m.world.combat.damage(b.eye, 9999, m.player, 'test'); });
  const p2 = await waitFor(() => window.__chroma.mode.boss.state === 'p2', null, 20000);
  const tideUp = await waitFor(() => window.__chroma.mode.boss.tide > 0.3, null, 120000);
  const drainsOn = await ev(() => window.__chroma.mode.mech.switches.filter((s) => s.drain).every((s) => !s.disabled));
  check('l10: eye beaten -> high tide floods the walkway, drains enabled', p2 && tideUp && drainsOn, JSON.stringify({ p2, tideUp, drainsOn }));
  const tideHurts = await ev(() => new Promise((res) => { const m = window.__chroma.mode, p = m.player; p.invuln = 0; p.place(p.pos.clone().set(-16, 0, 0), 0); const h = p.hp; setTimeout(() => { const hurt = p.hp < h; p.invuln = 999; res(hurt); }, 1200); }));
  check('l10: the gray tide hurts, the refuges are safe ground', tideHurts);
  await tp(16.5, 2.45, 16.5, Math.PI); await wait(1200); await shot('l10_tide');
  for (const id of ['w1', 'w2', 'w3', 'w4']) await ev((id) => { const M = window.__chroma.mode.mech; M.activateSwitch(M.switches.find((s) => s.id === id)); }, id);
  const beached = await waitFor(() => window.__chroma.mode.boss.state === 'beached', null, 90000);
  check('l10: all drains painted -> the tide drains away and the Wyrm is beached', beached);
  await ev(() => { const m = window.__chroma.mode, b = m.boss; m.world.combat.damage(b.eye, 9999, m.player, 'test'); });
  const p3 = await waitFor(() => window.__chroma.mode.boss.state === 'p3', null, 8000);
  check('l10: beached window -> phase 3 frenzy', p3);
  await ev(() => { window.__chroma.mode.boss.splitT = 0; window.__chroma.mode.boss.waveT = 0; });
  const frenzy = await waitFor(() => window.__chroma.mode.enemies.some((e) => e.group === 'boss' && e.alive && e.name === 'Splotchling') && window.__chroma.mode.boss.waves.length > 0, null, 10000);
  check('l10: frenzy sheds Splotches and sends goo shockwaves', frenzy);
  await ev(() => { const m = window.__chroma.mode, b = m.boss; b.eye.alive = true; m.world.combat.damage(b.eye, 99999, m.player, 'test'); });
  const cage = await waitFor(() => window.__chroma.mode.boss.opened === true, null, 150000);
  check('l10: the Wyrm bursts and Tint\'s cage comes down', cage);
  await godMode(false);
  await bossFinish('l10');
  // Tint rescue scene in the hideout
  const scene = await waitFor(() => window.__chroma.mode.hud.dialogBlocking, null, 20000);
  const who = await ev(() => document.querySelector('#story-hud .sh-dialog .who')?.textContent || '');
  check('l10: Tint-rescued scene plays at the hideout', scene && /Tint|Veil/.test(who), who);
  await advanceDialog();
  const tint = await ev(() => window.__chroma.mode.npcs.some((n) => n.kind === 'tint') || window.__chroma.profile.story.flags.tintJoined);
  check('l10: Agent Tint joins (flag saved)', tint);
}

async function suiteL15() {
  console.log('\n== l15 Baron Grisaille (final boss)');
  if (!(await boot('l15', profile(before('l15'))))) return;
  await swatches('l15'); await shards('l15');
  await bossIntro('l15');
  await godMode(true);
  const blocked = await ev(() => { const m = window.__chroma.mode, b = m.boss; const h = b.hp[0]; m.world.combat.damage(b.body, 200, m.player, 'test'); return b.hp[0] === h && b.shielded; });
  check('l15: the Baron is shielded in phase 1', blocked);
  const atk = await ev(() => new Promise((res) => {
    const m = window.__chroma.mode, b = m.boss, p = m.player;
    p.place(p.pos.clone().set(0, 0, -8), 0);
    const seen = new Set(); let n = 0;
    b.act = { kind: 'glide', t: 0, dur: 0 };
    const iv = setInterval(() => { n++; seen.add(b.act?.kind); if ((seen.has('dash') && seen.has('volley')) || n > 300) { clearInterval(iv); res([...seen]); } if (b.act?.kind === 'glide' && b.act.dur > 0.2) b.act.dur = 0.1; }, 100);
  }));
  check('l15: phase 1 attacks: cane volleys and telegraphed dashes', atk.includes('volley') && atk.includes('dashWind') && atk.includes('dash'), JSON.stringify(atk));
  for (const id of ['e1', 'e2', 'e3']) {
    await ev((id) => { const m = window.__chroma.mode, sw = m.mech.switches.find((s) => s.id === id), f = sw.faceObj; const c = f.center.clone().addScaledVector(f.n, 0.15); for (const [a, b] of [[0, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) m.world.paint.splat(c.clone().addScaledVector(f.u, a * f.w * 0.5).addScaledVector(f.v, b * f.h * 0.5), Math.max(f.w, f.h) * 0.45, 1); }, id);
  }
  const dazed = await waitFor(() => window.__chroma.mode.boss.dazed, null, 30000);
  check('l15: painting all three easels breaks his shield (dazed)', dazed);
  await shot('l15_dazed');
  await ev(() => { const m = window.__chroma.mode, b = m.boss; m.world.combat.damage(b.body, 99999, m.player, 'test'); });
  const p2 = await waitFor(() => window.__chroma.mode.boss.state === 'p2', null, 90000);
  const glints = await ev(() => window.__chroma.mode.enemies.filter((e) => e.alive && e.name === 'Glint').length);
  check('l15: phase 2: the flying throne, Glints on the pillars', p2 && glints >= 2, `p2=${p2} glints=${glints}`);
  const laser = await waitFor(() => { const b = window.__chroma.mode.boss; if (b.act?.kind === 'cool') b.act.t = 99; return b.laser.visible || b.act?.kind === 'bombs'; }, null, 40000);
  check('l15: the throne attacks (laser sight / bomb run)', laser);
  await wait(1500); await shot('l15_throne');
  for (let i = 0; i < 4; i++) await ev((i) => { const m = window.__chroma.mode; m.world.combat.damage(m.boss.tanks[i], 999, m.player, 'test'); }, i);
  const p3 = await waitFor(() => window.__chroma.mode.boss.state === 'p3', null, 120000);
  const tide = await waitFor(() => window.__chroma.mode.boss.tide > 0.2, null, 120000);
  check('l15: all pigment tanks burst -> crash -> phase 3: the gray floods in', p3 && tide);
  const safe = await ev(() => { const m = window.__chroma.mode, b = m.boss; const h = b.hp[2]; m.world.combat.damage(b.body, 300, m.player, 'test'); return b.hp[2] === h; });
  check('l15: he can\'t be hurt until the drains are painted', safe);
  for (const id of ['d1', 'd2', 'd3']) await ev((id) => { const M = window.__chroma.mode.mech; M.activateSwitch(M.switches.find((s) => s.id === id)); }, id);
  const exhausted = await waitFor(() => window.__chroma.mode.boss.exhausted, null, 30000);
  check('l15: all drains -> the gray drains away, he\'s exhausted', exhausted);
  await shot('l15_exhausted');
  await ev(() => { const m = window.__chroma.mode, b = m.boss; m.world.combat.damage(b.body, 99999, m.player, 'test'); });
  const colored = await waitFor(() => { const b = window.__chroma.mode.boss; return b.state === 'dying' && b.stateT > 3 && b.mats.suit.color.r > 0.8; }, null, 120000);
  check('l15: the finish: the Baron is splashed with color', colored);
  await godMode(false);
  await bossFinish('l15');
}

// ------------------------------------------------------------------ hub, shop, migration, cycle, ending
async function suiteHub() {
  console.log('\n== hub (first visit intro, hatches, Veil, gates, lift)');
  await boot('hub', null);
  const dlg = await waitFor(() => window.__chroma.mode.hud.dialogBlocking, null, 25000);
  check('hub: intro dialogue opens on first visit', dlg);
  await wait(1500);
  await shot('hub_intro');
  await advanceDialog();
  const st = await state();
  check('hub: intro can be advanced to the end', !(await ev(() => window.__chroma.mode.hud.dialogBlocking)));
  check('hub: profile.story v2 created after the intro', st.story && st.story.v === 2 && Array.isArray(st.story.cleared) && st.story.flags.intro === true, JSON.stringify(st.story));
  const statuses = await ev(() => window.__chroma.mode.hatches.map((h) => h.status));
  check('hub: sector 1 hatch 1 open, others sealed', statuses.join() === 'open,locked,locked,locked,locked', statuses.join());
  const gates = await ev(() => window.__chroma.mode.gates.map((g) => `${g.to}:${g.open}`));
  check('hub: sector 2/3 gates sealed', gates.join() === 'hub2:false,hub3:false', gates.join());
  const v = await ev(() => window.__chroma.mode.veilPos.toArray());
  await tp(v[0], 0, v[2] - 2, 0);
  await wait(800);
  const prompt = await ev(() => document.querySelector('#story-hud .sh-prompt')?.textContent || '');
  check('hub: prompt to talk to Veil', /Veil/.test(prompt), prompt);
  await page.keyboard.press('KeyE');
  check('hub: E talks to Captain Veil', await waitFor(() => window.__chroma.mode.hud.dialogBlocking, null, 5000));
  await advanceDialog();
  const g2 = await ev(() => window.__chroma.mode.gates[0].pos.toArray());
  await tp(g2[0] + 2.2, 0, g2[2], -Math.PI / 2);
  await wait(600);
  await page.keyboard.press('KeyE');
  await wait(600);
  check('hub: sealed sector gate stays shut', (await state()).level === 'hub');
  const h2 = await ev(() => window.__chroma.mode.hatches[1].pos.toArray());
  await tp(h2[0], 0, h2[2] + 0.5);
  await wait(600);
  await page.keyboard.press('KeyE');
  await wait(600);
  check('hub: sealed hatch stays shut', (await state()).level === 'hub');
  const h1 = await ev(() => window.__chroma.mode.hatches[0].pos.toArray());
  await tp(h1[0], 0, h1[2] + 0.5);
  await wait(800);
  const p1 = await ev(() => document.querySelector('#story-hud .sh-prompt')?.textContent || '');
  check('hub: prompt to enter hatch 1', /Enter hatch 1/.test(p1), p1);
  await shot('hub_hatch');
  await page.keyboard.press('KeyE');
  const entered = await waitFor(() => { const a = window.__chroma; return a.mode?.levelId === 'l1' && !a.loadingNow; }, null, 120000);
  check('hub: entering hatch 1 loads First Splash', entered);
  // sector hubs
  for (const [hub, cleared, gate] of [['hub2', ORDER.slice(0, 5), 0], ['hub3', ORDER.slice(0, 10), 1]]) {
    await boot('hub', profile(cleared));
    const open = await ev((i) => window.__chroma.mode.gates[i].open, gate);
    check(`hub: gate to ${hub} opens once the previous boss is down`, open);
    const gp = await ev((i) => { const g = window.__chroma.mode.gates[i]; return [g.pos.x, g.pos.y, g.pos.z, g.root.rotation.y]; }, gate);
    await tp(gp[0] + Math.sin(gp[3]) * 2.2, gp[1] + 0.05, gp[2] + Math.cos(gp[3]) * 2.2, gp[3] + Math.PI);
    await wait(800);
    const pr = await ev(() => document.querySelector('#story-hud .sh-prompt')?.textContent || '');
    check(`hub: prompt to go to sector ${gate + 2}`, /Sector/.test(pr), pr);
    await page.keyboard.press('KeyE');
    const there = await waitFor((h) => { const a = window.__chroma; return a.mode?.levelId === h && !a.loadingNow; }, hub, 120000);
    check(`hub: the gate leads to ${hub}`, there);
    if (!there) continue;
    await wait(1200);
    await shot(`${hub}`);
    const hs = await ev(() => window.__chroma.mode.hatches.map((h) => h.status).join());
    check(`${hub}: first hatch open, rest sealed`, hs === 'open,locked,locked,locked,locked', hs);
    const npcs = await ev(() => window.__chroma.mode.npcs.map((n) => n.kind).sort().join());
    check(`${hub}: has a supply terminal + swatch book`, npcs === 'book,terminal', npcs);
    const lift = await ev(() => window.__chroma.mode.lifts[0].pos.toArray());
    await tp(lift[0], 0, lift[2]);
    await wait(700);
    await page.keyboard.press('KeyE');
    const back = await waitFor(() => { const a = window.__chroma; return a.mode?.levelId === 'hub' && !a.loadingNow; }, null, 120000);
    const nearGate = back && await ev((i) => { const m = window.__chroma.mode, g = m.gates[i]; return Math.hypot(g.pos.x - m.player.pos.x, g.pos.z - m.player.pos.z); }, gate);
    check(`${hub}: the lift goes back to the hideout, next to the gate`, back && nearGate < 4.5, `${back} ${nearGate}`);
  }
}

async function suiteShop() {
  console.log('\n== shop + swatch book + upgrades');
  const prof = profile(['l1'], {});
  prof.story.shards = 120; prof.story.swatches = ['l1', 'l1.2'];
  await boot('hub', prof);
  const dab = await ev(() => window.__chroma.mode.npcs.find((n) => n.kind === 'dabble')?.pos.toArray());
  check('shop: Dabble runs a shop in the hideout after level 1', !!dab);
  await tp(dab[0], 0, dab[2] - 2.0, 0);
  await wait(800);
  const pr = await ev(() => document.querySelector('#story-hud .sh-prompt')?.textContent || '');
  check('shop: prompt to shop with Dabble', /Dabble/.test(pr), pr);
  await page.keyboard.press('KeyE');
  const open = await waitFor(() => window.__chroma.mode.hud.shopOpen, null, 6000);
  check('shop: E opens the upgrade shop', open);
  await wait(800);
  await shot('shop');
  const rows = await ev(() => document.querySelectorAll('#story-hud .sh-shop .row').length);
  check('shop: lists 6 upgrades', rows === 6, rows);
  // buy Tough Scales with the keyboard (first row)
  await page.keyboard.press('Enter');
  await wait(600);
  const after = await ev(() => { const st = window.__chroma.profile.story; return { shards: st.shards, armor: st.up.armor, eff: window.__chroma.mode.effects.armor }; });
  check('shop: buying Tough Scales spends 30 shards and applies armor', after.shards === 90 && after.armor === 1 && after.eff < 1, JSON.stringify(after));
  const saved = await ev((k) => JSON.parse(localStorage.getItem(k)).story.up.armor, KEY);
  check('shop: the upgrade is saved', saved === 1, saved);
  // buy Bold Hues by clicking (row 5)
  await page.click('#story-hud .sh-shop [data-b="4"]');
  await wait(600);
  const power = await ev(() => ({ up: window.__chroma.profile.story.up.power, mul: window.__chroma.mode.world.dmgMul }));
  check('shop: clicking buys Bold Hues (+12% damage)', power.up === 1 && Math.abs(power.mul - 1.12) < 1e-6, JSON.stringify(power));
  // can't afford
  await ev(() => { window.__chroma.profile.story.shards = 5; });
  await page.keyboard.press('KeyS'); await page.keyboard.press('Enter');
  await wait(400);
  check('shop: not enough shards = no purchase', (await ev(() => window.__chroma.profile.story.up.refill || 0)) === 0);
  await page.keyboard.press('Escape');
  const closed = await waitFor(() => !window.__chroma.mode.hud.shopOpen, null, 4000);
  check('shop: Esc closes the shop (and does not pause)', closed && !(await ev(() => window.__chroma.mode.paused)));
  // armor really reduces damage
  const dmg = await ev(() => { const p = window.__chroma.mode.player; p.hp = 100; p.invuln = 0; p.takeDamage(50, null, 'test'); return 100 - p.hp; });
  check('shop: Tough Scales reduces damage taken', dmg < 45, dmg.toFixed(1));
  // swatch book
  const bk = await ev(() => window.__chroma.mode.npcs.find((n) => n.kind === 'book').pos.toArray());
  await ev(() => { window.__chroma.mode.player.hp = 100; });
  await tp(bk[0], 0, bk[2] - 1.6, 0);
  await wait(800);
  await page.keyboard.press('KeyE');
  const book = await waitFor(() => window.__chroma.mode.hud.bookOpen, null, 6000);
  await wait(600);
  const got = await ev(() => document.querySelectorAll('#story-hud .sh-book .sw.got').length);
  const all = await ev(() => document.querySelectorAll('#story-hud .sh-book .sw').length);
  check('book: the Swatch Book opens and lists every swatch (2 found of 39)', book && got === 2 && all === 39, `${got}/${all}`);
  await shot('book');
  await page.keyboard.press('Escape');
  check('book: closes again', await waitFor(() => !window.__chroma.mode.hud.bookOpen, null, 4000));
  // upgrades carry into levels
  await boot('l2', undefined);
  const eff = await ev(() => { const m = window.__chroma.mode; return { armor: m.effects.armor, dmg: m.world.dmgMul, refill: m.player.mods.inkRecover }; });
  check('shop: upgrades apply inside levels', eff.armor < 1 && eff.dmg > 1.1, JSON.stringify(eff));
  // prism burst: special triggers a shockwave that hurts nearby Drab
  await ev(() => { const st = window.__chroma.profile.story; st.up.burst = 1; window.__chroma.save(); });
  await boot('l2', undefined);
  const burst = await ev(() => new Promise((res) => {
    const m = window.__chroma.mode, p = m.player, e = m.enemies.find((x) => x.alive);
    p.place(e.pos.clone().add(new e.pos.constructor(1.5, 0.1, 0)), 0);
    const h = e.hp; m.world.onSpecial(p);
    setTimeout(() => res({ before: h, after: e.alive ? e.hp : 0 }), 1500);
  }));
  check('shop: Prism Burst blasts nearby Drab when a special fires', burst.after < burst.before, JSON.stringify(burst));
}

async function suiteMigrate() {
  console.log('\n== save migration (v1 -> v2)');
  await boot('hub', profileV1(['l1', 'l2'], ['l1', 'l3', 'bogus']));
  const st = await ev(() => window.__chroma.profile.story);
  check('migrate: v1 save upgraded to v2', st.v === 2, JSON.stringify(st));
  check('migrate: cleared levels kept', st.cleared.join() === 'l1,l2', st.cleared.join());
  check('migrate: swatch ids kept (unknown ids dropped)', st.swatches.join() === 'l1,l3', st.swatches.join());
  check('migrate: shards granted for already-cleared levels', st.shards === 90, st.shards);
  check('migrate: intro marked as seen (no replay)', st.flags.intro === true && !(await ev(() => window.__chroma.mode.introT != null)));
  const hs = await ev(() => window.__chroma.mode.hatches.map((h) => h.status).join());
  check('migrate: hatches reflect the old progress', hs === 'cleared,cleared,open,locked,locked', hs);
  await ev(() => window.__chroma.save());
  await boot('hub', undefined);
  const st2 = await ev(() => window.__chroma.profile.story);
  check('migrate: migration is stable on reload (no double grant)', st2.shards === 90 && st2.v === 2, st2.shards);
  // old swatches show on the hatch signs / book
  const swN = await ev(() => document.querySelector('#story-hud .sh-sw small')?.textContent || '');
  check('migrate: HUD swatch count includes old swatches', swN.startsWith('2 / 39'), swN);
}

async function suiteCycle() {
  console.log('\n== cycle: hub <-> levels <-> sector hubs <-> plaza (leaks + cleanup)');
  await boot('hub', profile(ORDER.slice(0, 12)));
  // pause in a level offers a retreat to the hideout; in the hub, leaving the Underside
  await ev(() => window.__chroma.mode.leaveTo('l1', {}, 'test'));
  await waitFor(() => window.__chroma.mode?.levelId === 'l1' && !window.__chroma.loadingNow, null, 120000);
  await ev(() => window.__chroma.mode.setPaused(true));
  await wait(500);
  let label = await ev(() => document.querySelector('.pause [data-a="quit"]')?.textContent);
  check('cycle: level pause offers RETREAT TO THE HIDEOUT', label === 'RETREAT TO THE HIDEOUT', label);
  await page.click('.pause [data-a="quit"]');
  const retreat = await waitFor(() => window.__chroma.mode?.levelId === 'hub' && !window.__chroma.loadingNow, null, 120000);
  check('cycle: retreating returns to the hideout', retreat);
  await ev(() => window.__chroma.mode.setPaused(true));
  await wait(500);
  label = await ev(() => document.querySelector('.pause [data-a="quit"]')?.textContent);
  check('cycle: hub pause offers LEAVE THE UNDERSIDE', label === 'LEAVE THE UNDERSIDE', label);
  await page.click('.pause [data-a="quit"]');
  const plaza = await waitFor(() => window.__chroma.mode?.constructor.name === 'Plaza' && !window.__chroma.loadingNow, null, 120000);
  let dc = await domCounts();
  check('cycle: quitting reaches the plaza with no story DOM left', plaza && dc.hud === 0 && dc.style === 0, JSON.stringify(dc));
  await ev(() => window.__chroma.goStory('hub'));
  await waitFor(() => window.__chroma.mode?.levelId === 'hub' && !window.__chroma.loadingNow, null, 120000);
  const lift = await ev(() => window.__chroma.mode.lifts[0].pos.toArray());
  await tp(lift[0], 0, lift[2]);
  await wait(600);
  await page.keyboard.press('KeyE');
  const up = await waitFor(() => window.__chroma.mode?.constructor.name === 'Plaza' && !window.__chroma.loadingNow, null, 120000);
  dc = await domCounts();
  check('cycle: hub lift returns to the plaza cleanly', up && dc.hud === 0 && dc.style === 0, JSON.stringify(dc));
  await ev(() => window.__chroma.goStory('hub'));
  await waitFor(() => window.__chroma.mode?.levelId === 'hub' && !window.__chroma.loadingNow, null, 120000);
  // many story-only hops must not leak textures; geometries may grow by the 2 PMREM
  // source meshes world/env.js never disposes (per Environment)
  const hubMem = [];
  const hops = ['l2', 'hub', 'l9', 'hub2', 'l13', 'hub3', 'hub', 'l5', 'hub', 'l12', 'hub', 'l7', 'hub', 'l15', 'hub'];
  for (const lv of hops) {
    await ev((lv) => window.__chroma.mode.leaveTo(lv, {}, 'test'), lv);
    const ok = await waitFor((lv) => window.__chroma.mode?.levelId === lv && !window.__chroma.loadingNow, lv, 150000);
    if (!ok) { check(`cycle: hop to ${lv}`, false); break; }
    await wait(1000);
    if (lv === 'hub') hubMem.push(await ev(() => ({ ...window.__chroma.renderer.info.memory, progs: window.__chroma.renderer.info.programs?.length || 0 })));
  }
  console.log('  renderer memory at the hub after story-only hops:', JSON.stringify(hubMem));
  const last = hubMem[hubMem.length - 1], first = hubMem[0];
  check('cycle: no texture growth across many hub <-> level hops', last.textures <= first.textures, JSON.stringify(hubMem));
  check('cycle: geometry growth bounded (env.js PMREM meshes only)', last.geometries - first.geometries <= 4 * (hubMem.length + 4), JSON.stringify(hubMem));
  dc = await domCounts();
  check('cycle: still exactly one story HUD', dc.hud === 1 && dc.style === 1, JSON.stringify(dc));
}

async function suiteEnding() {
  console.log('\n== ending: the hideout regains its colour');
  const desat = [];
  for (const n of [0, 7, 14]) {
    await boot('hub', profile(ORDER.slice(0, n)));
    await wait(2500);
    desat.push(await ev(() => ({ desat: window.__chroma.post.uniforms.uDesat.value, puddles: window.__chroma.mode.course.goo.length })));
  }
  check('ending: the hideout is less washed out the more cores come home', desat[0].desat > desat[1].desat && desat[1].desat > desat[2].desat && desat[0].puddles > desat[2].puddles, JSON.stringify(desat));
  // the finale scene after the last core
  const prof = profile(ORDER.slice(0, 15));
  await page.goto(`${BASE}index.html?qa&fast`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await ev(([k, p]) => localStorage.setItem(k, JSON.stringify(p)), [KEY, prof]);
  await page.goto(`${BASE}index.html?story=hub&qa&fast`);
  await waitFor(() => window.__chroma?.mode?.levelId === 'hub' && !window.__chroma.loadingNow, null, 150000);
  await ev(() => { const a = window.__chroma; a.mode.leaveTo('hub', { from: 'l15', justCleared: true }, 'test'); });
  await waitFor(() => window.__chroma.mode?.opts?.from === 'l15' && !window.__chroma.loadingNow, null, 150000);
  const wave = await waitFor(() => window.__chroma.mode.colorWave != null, null, 15000);
  check('ending: the colour wave starts', wave);
  await wait(2500);
  await shot('ending_wave');
  const dlg = await waitFor(() => window.__chroma.mode.hud.dialogBlocking, null, 30000);
  check('ending: the final scene plays', dlg);
  await advanceDialog(60);
  const credits = await waitFor(() => window.__chroma.mode.hud.creditsOpen, null, 15000);
  check('ending: THE END credits show', credits);
  await wait(800);
  await shot('ending_credits');
  const flag = await ev(() => window.__chroma.profile.story.flags.ending === true);
  check('ending: the ending is saved', flag);
  await waitFor(() => { const m = window.__chroma.mode; return m.time - (m.creditsAt || 0) > 2.3; }, null, 60000);
  await page.keyboard.press('Enter');
  const closed = await waitFor(() => !window.__chroma.mode.hud.creditsOpen, null, 15000);
  check('ending: credits close and you can keep playing', closed);
  const desatEnd = await ev(() => window.__chroma.post.uniforms.uDesat.value);
  check('ending: the hideout is in full colour', desatEnd < 0.05, desatEnd);
}

const SUITES = { hub: suiteHub, shop: suiteShop, migrate: suiteMigrate, cycle: suiteCycle, ending: suiteEnding, l5: suiteL5, l10: suiteL10, l15: suiteL15 };
const t0 = Date.now();
for (const s of suites) {
  try { await (SUITES[s] || (() => suiteLevel(s)))(); } catch (e) { fails++; console.log(`  FAIL ${s} threw:`, e.message); }
}
check('no page errors', errors.length === 0, errors.slice(0, 5).join(' || '));
console.log(`\n${passes} passed, ${fails} failed (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
