// Story mode ("The Underside") scripted checks in headless Chromium.
//   node chroma/tools/storytest.mjs                 # every suite
//   node chroma/tools/storytest.mjs l2 l5 --shots   # some suites, with screenshots in chroma/qa/
// Suites: hub l1 l2 l3 l4 l5 cycle. Teleports the player through each level's
// objectives (checkpoints, jump pads, swatch, enemies, death + respawn, Hue Core,
// boss phases) and fails on any assertion or page error.
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
const ALL = ['hub', 'l1', 'l2', 'l3', 'l4', 'l5', 'cycle'];
const suites = args.filter((a) => !a.startsWith('--'));
const run = suites.length ? suites : ALL;
const ORDER = ['l1', 'l2', 'l3', 'l4', 'l5'];
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
const profile = (cleared = [], extra = {}) => ({ created: true, name: 'Tester', coins: 1000, story: { cleared, swatches: [] }, ...extra });

async function boot(level, prof) {
  await page.goto(`${BASE}index.html?qa&fast`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await ev(([k, p]) => { if (p) localStorage.setItem(k, JSON.stringify(p)); else localStorage.removeItem(k); }, [KEY, prof]);
  await page.goto(`${BASE}index.html?story=${level}&qa&fast`);
  const ok = await waitFor((lv) => { const a = window.__chroma; return a?.mode?.levelId === lv && !a.loadingNow && a.mode.player; }, level, 120000);
  check(`${level}: story mode loaded`, ok);
  await wait(400);
}
const tp = (x, y, z, yaw = 0) => ev(([x, y, z, yaw]) => {
  const m = window.__chroma.mode, p = m.player;
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

async function checkpointsAndPads(id) {
  const cps = await ev(() => window.__chroma.mode.checkpoints.map((c) => [...c.pos.toArray(), c.yaw]));
  for (let i = 0; i < cps.length; i++) {
    const [x, y, z, yaw] = cps[i];
    await tp(x + 0.4, y + 0.05, z, yaw);
    const ok = await waitFor((i) => window.__chroma.mode.cpIndex >= i, i, 6000);
    const sp = await ev(() => window.__chroma.mode.player.spawnPoint.toArray());
    check(`${id}: checkpoint ${i + 1} activates + moves the spawn`, ok && dist(sp, [x, y, z]) < 0.01, JSON.stringify(sp));
  }
  const pads = await ev(() => window.__chroma.mode.pads.map((p) => ({ from: p.pos.toArray(), to: p.def.to.toArray() })));
  for (let i = 0; i < pads.length; i++) {
    const { from, to } = pads[i];
    await tp(from[0], from[1] + 0.05, from[2]);
    const launched = await waitFor(() => !!window.__chroma.mode.flight, null, 5000);
    const landed = launched && await waitFor(() => !window.__chroma.mode.flight, null, 12000);
    await wait(400);
    const s = await state();
    check(`${id}: jump pad ${i + 1} launches and lands on target`, launched && landed && dist(s.pos, to) < 2.6, `launched=${launched} landed=${landed} pos=${s.pos.map((v) => v.toFixed(1))} to=${to}`);
  }
}

async function swatchCheck(id) {
  const sw = await ev(() => window.__chroma.mode.swatch?.pos.toArray());
  if (!sw) { check(`${id}: has a Lost Swatch`, false); return; }
  const before = (await state()).coins;
  await tp(sw[0], sw[1] - 0.9, sw[2]);
  const ok = await waitFor((id) => window.__chroma.profile.story?.swatches?.includes(id), id, 6000);
  const s = await state();
  check(`${id}: Lost Swatch pickup saves + pays 150`, ok && s.coins === before + 150, `coins ${before} -> ${s.coins}`);
  const saved = await ev(([k, id]) => JSON.parse(localStorage.getItem(k) || '{}').story?.swatches?.includes(id), [KEY, id]);
  check(`${id}: swatch persisted to localStorage`, !!saved);
}

async function deathCheck(id) {
  const sp = await ev(() => window.__chroma.mode.player.spawnPoint.toArray());
  await ev(() => { const m = window.__chroma.mode; m.player.takeDamage(999, m.enemies[0] || null, 'test'); });
  const died = !(await state()).alive;
  const back = await waitFor(() => window.__chroma.mode.player.alive, null, 12000);
  const s = await state();
  check(`${id}: splat -> respawn at last checkpoint`, died && back && dist(s.pos, sp) < 0.5, `pos=${s.pos.map((v) => v.toFixed(1))} sp=${sp}`);
  // falling into the void
  const killY = await ev(() => window.__chroma.mode.world.level.killY);
  await tp(sp[0], killY - 1, sp[2]);
  const fell = await waitFor(() => !window.__chroma.mode.player.alive, null, 4000);
  const back2 = await waitFor(() => window.__chroma.mode.player.alive, null, 12000);
  check(`${id}: falling out respawns too`, fell && back2);
}

async function killAll(id) {
  const n = await ev(() => { const m = window.__chroma.mode; const list = m.enemies.filter((e) => e.alive && e.group !== 'boss'); for (const e of list) e.takeDamage(9999, m.player, 'test'); return list.length; });
  await wait(300);
  const left = await ev(() => window.__chroma.mode.enemies.filter((e) => e.alive && e.group !== 'boss').length);
  check(`${id}: ${n} enemies pop when splashed`, n > 0 && left === 0, `left=${left}`);
}

async function coreCheck(id) {
  const core = await ev(() => { const c = window.__chroma.mode.core; return c && { pos: c.pos.toArray(), locked: c.locked }; });
  check(`${id}: Hue Core present and unsealed`, core && !core.locked, JSON.stringify(core));
  if (!core) return;
  const coins = (await state()).coins;
  const wasCleared = (await state()).story?.cleared?.includes(id);
  await tp(core.pos[0], core.pos[1] + 0.1, core.pos[2] - 1.2);
  const ok = await waitFor(() => window.__chroma.mode.state === 'clear', null, 6000);
  const s = await state();
  check(`${id}: touching the core clears the level`, ok && s.story.cleared.includes(id), JSON.stringify(s.story));
  check(`${id}: first clear pays 400`, wasCleared || s.coins === coins + 400, `${coins} -> ${s.coins}`);
  const overlay = await waitFor(() => !!(window.__chroma.mode.hud.clearOpen && document.querySelector('#story-hud .sh-clear.on')), null, 9000);
  check(`${id}: HUE CORE RECOVERED overlay shows`, overlay);
  await shot(`${id}_clear`);
  await wait(800);
  await page.keyboard.press('KeyE');
  const hub = await waitFor((id) => { const a = window.__chroma; return a.mode?.levelId === 'hub' && !a.loadingNow && a.mode.opts.from === id; }, id, 90000);
  check(`${id}: continue returns to the hub`, hub);
  if (hub) {
    await wait(500);
    const near = await ev((id) => { const m = window.__chroma.mode; const h = m.hatches.find((x) => x.id === id); return Math.hypot(h.pos.x - m.player.pos.x, h.pos.z - m.player.pos.z); }, id);
    check(`${id}: hub spawn is next to its hatch`, near < 4, near.toFixed(2));
    const i = ORDER.indexOf(id);
    if (i < 4) {
      const st = await ev((nid) => window.__chroma.mode.hatches.find((h) => h.id === nid).status, ORDER[i + 1]);
      check(`${id}: next hatch unlocked`, st === 'open', st);
    }
    const dc = await domCounts();
    check(`${id}: exactly one story HUD + style after the switch`, dc.hud === 1 && dc.style === 1, JSON.stringify(dc));
  }
}

// ------------------------------------------------------------------ suites
async function suiteHub() {
  console.log('\n== hub (first visit intro, hatches, Veil, lift)');
  await boot('hub', null);
  const dlg = await waitFor(() => window.__chroma.mode.hud.dialogBlocking, null, 20000);
  check('hub: intro dialogue opens on first visit', dlg);
  const name = await ev(() => document.querySelector('#story-hud .sh-dialog .who')?.textContent);
  check('hub: dialogue shows a speaker name', !!name, name);
  await wait(1500);
  await shot('hub_intro');
  for (let i = 0; i < 30; i++) {
    if (!(await ev(() => window.__chroma.mode.hud.dialogBlocking))) break;
    await page.keyboard.press('Space');
    await wait(350);
  }
  const st = await state();
  check('hub: intro can be advanced to the end', !(await ev(() => window.__chroma.mode.hud.dialogBlocking)));
  check('hub: profile.story created after the intro', st.story && Array.isArray(st.story.cleared) && Array.isArray(st.story.swatches), JSON.stringify(st.story));
  const statuses = await ev(() => window.__chroma.mode.hatches.map((h) => h.status));
  check('hub: hatch 1 open, others sealed', statuses.join() === 'open,locked,locked,locked,locked', statuses.join());
  // talk to Veil
  const v = await ev(() => window.__chroma.mode.veilPos.toArray());
  await tp(v[0], 0, v[2] - 2, 0);
  await wait(600);
  const prompt = await ev(() => document.querySelector('#story-hud .sh-prompt')?.textContent || '');
  check('hub: prompt to talk to Veil', /Veil/.test(prompt), prompt);
  await page.keyboard.press('KeyE');
  const talk = await waitFor(() => window.__chroma.mode.hud.dialogBlocking, null, 4000);
  check('hub: E talks to Captain Veil', talk);
  await shot('hub_veil');
  for (let i = 0; i < 6 && (await ev(() => window.__chroma.mode.hud.dialogBlocking)); i++) { await page.keyboard.press('KeyE'); await wait(350); }
  // locked hatch
  const h2 = await ev(() => window.__chroma.mode.hatches[1].pos.toArray());
  await tp(h2[0], 0, h2[2] + 0.5);
  await wait(500);
  await page.keyboard.press('KeyE');
  await wait(500);
  check('hub: sealed hatch stays shut', (await state()).level === 'hub');
  // open hatch -> level 1
  const h1 = await ev(() => window.__chroma.mode.hatches[0].pos.toArray());
  await tp(h1[0], 0, h1[2] + 0.5);
  await wait(600);
  const p1 = await ev(() => document.querySelector('#story-hud .sh-prompt')?.textContent || '');
  check('hub: prompt to enter hatch 1', /Enter hatch 1/.test(p1), p1);
  await shot('hub_hatch');
  await page.keyboard.press('KeyE');
  const entered = await waitFor(() => { const a = window.__chroma; return a.mode?.levelId === 'l1' && !a.loadingNow; }, null, 90000);
  check('hub: entering hatch 1 loads First Splash', entered);
}

async function suiteL1() {
  console.log('\n== l1 First Splash (tutorial)');
  await boot('l1', profile([]));
  const tips = await ev(() => window.__chroma.mode.course.tips.length);
  check('l1: tutorial tips defined', tips >= 5, tips);
  await wait(800);
  const tipOn = await ev(() => document.querySelector('#story-hud .sh-tip.on')?.textContent || '');
  check('l1: first tip is on screen', /paint/i.test(tipOn), tipOn);
  const lane = await ev(() => { const m = window.__chroma.mode, P = m.world.paint, p = m.player; const s = m.world.level.groundAt(0, 15, 0.1, 0.2, 0.5).solid; return P.ownerAt(s.sideFace.top, new p.pos.constructor(0, 0, 15)); });
  check('l1: pre-painted swim lane is player ink', lane === 1, lane);
  await shot('l1_start');
  // swim test: stand in own ink, hold SHIFT
  await fakeLock();
  await tp(0, 0, 15, 0);
  await wait(300);
  await page.keyboard.down('ShiftLeft');
  const swim = await waitFor(() => window.__chroma.mode.player.submerged, null, 4000);
  await page.keyboard.up('ShiftLeft');
  check('l1: SHIFT in own ink = submerged swim', swim);
  const gated = await ev(() => window.__chroma.mode.core.locked);
  check('l1: core sealed until the Smudges are splashed', gated);
  await checkpointsAndPads('l1');
  await swatchCheck('l1');
  // smudges hop + bite
  const smudge = await ev(() => window.__chroma.mode.enemies[0].pos.toArray());
  await tp(smudge[0], smudge[1], smudge[2] - 3, 0);
  const hp0 = (await state()).hp;
  const bit = await waitFor((hp) => window.__chroma.mode.player.hp < hp || !window.__chroma.mode.player.alive, hp0, 15000);
  check('l1: Smudges chase and bite', bit);
  await shot('l1_smudge');
  await wait(2500);
  await deathCheck('l1');
  await killAll('l1');
  const unsealed = await waitFor(() => !window.__chroma.mode.core.locked, null, 3000);
  check('l1: seal breaks after the Smudges pop', unsealed);
  await coreCheck('l1');
}

async function suiteL2() {
  console.log('\n== l2 Ghost Walk');
  await boot('l2', profile(['l1']));
  const g = await ev(() => { const m = window.__chroma.mode; const mesh = m.world.level.meshes.find((x) => x.name === 'level-ghost'); return { n: m.course.ghosts.length, mesh: !!mesh, shadow: mesh?.castShadow, key: mesh?.material.customProgramCacheKey?.() }; });
  check('l2: ghost floors built with their own material', g.n >= 8 && g.mesh && g.shadow === false && g.key === 'story-ghost-paintable', JSON.stringify(g));
  // invisible but solid: stand on an unpainted ghost slab
  await tp(7.5, 0.3, 19, 0);
  await wait(1200);
  const s = await state();
  check('l2: unpainted ghost floor still has collision', s.alive && Math.abs(s.pos[1]) < 0.05, s.pos.join());
  // painting reveals: paint is stored on the ghost face
  const painted = await ev(() => { const m = window.__chroma.mode, s = m.course.ghosts[0]; const p = m.player.pos.clone().set(0, 0.02, 8); m.world.paint.splat(p, 1.2, 1); return m.world.paint.ownerAt(s.sideFace.top, p); });
  check('l2: ink lands on ghost surfaces (reveals them)', painted === 1, painted);
  await tp(0, 0, -3, 0);
  await wait(1500);
  await shot('l2_reveal');
  await checkpointsAndPads('l2');
  await swatchCheck('l2');
  await deathCheck('l2');
  await killAll('l2');
  await coreCheck('l2');
}

async function suiteL3() {
  console.log('\n== l3 Turret Alley');
  await boot('l3', profile(['l1', 'l2']));
  await tp(0, 0, 14, 0);
  const fired = await waitFor(() => window.__chroma.mode.combat.proj.some((p) => p.alive && p.team === 2 && p.kind === 'blob'), null, 15000);
  check('l3: Blotters fire gray blobs at the player', fired);
  await wait(400);
  await shot('l3_turrets');
  const gray = await waitFor(() => window.__chroma.mode.world.paint.count[2] > 0, null, 8000);
  check('l3: gray ink lands in the alley', gray);
  // swimming ducks under blob shots: hitHeight shrinks when submerged
  const hh = await ev(() => { const p = window.__chroma.mode.player; return p.hitHeight(); });
  check('l3: standing hit height is tall enough to be shot', hh > 1);
  await swatchCheck('l3');
  await checkpointsAndPads('l3');
  await deathCheck('l3');
  const big = await ev(() => window.__chroma.mode.enemies.find((e) => e.big)?.name);
  check('l3: Big Blotter guards the core', big === 'Big Blotter', big);
  await killAll('l3');
  await coreCheck('l3');
}

async function suiteL4() {
  console.log('\n== l4 Drone Heights');
  await boot('l4', profile(['l1', 'l2', 'l3']));
  const d = await ev(() => window.__chroma.mode.enemies.filter((e) => e.name === 'Drab Drone').map((e) => e.pos.toArray()));
  check('l4: drones patrol the silo', d.length >= 4, d.length);
  await tp(0, 0, 8, 0);
  const dropped = await waitFor(() => window.__chroma.mode.combat.proj.some((p) => p.alive && p.team === 2) || window.__chroma.mode.enemies.some((e) => e.warn > 0), null, 20000);
  check('l4: a drone flies over and drops gray ink', dropped);
  await wait(600);
  await shot('l4_drone');
  await swatchCheck('l4');
  await checkpointsAndPads('l4');
  await deathCheck('l4');
  await killAll('l4');
  await coreCheck('l4');
}

async function suiteL5() {
  console.log('\n== l5 The Gray Engine (boss)');
  await boot('l5', profile(['l1', 'l2', 'l3', 'l4']));
  await swatchCheck('l5');
  await tp(0, 0, -14, 0);
  const intro = await waitFor(() => window.__chroma.mode.boss.state === 'intro', null, 5000);
  check('l5: entering the arena starts the boss intro', intro);
  check('l5: arena door slams shut', await ev(() => window.__chroma.mode.course.door.collide === true));
  await wait(1200);
  await shot('l5_intro');
  for (let i = 0; i < 20 && (await ev(() => window.__chroma.mode.boss.state)) === 'intro'; i++) { await page.keyboard.press('Space'); await wait(350); }
  check('l5: fight begins after the intro', (await ev(() => window.__chroma.mode.boss.state)) === 'p1');
  const bar = await ev(() => !!document.querySelector('#story-hud .sh-boss.on'));
  check('l5: big boss health bar visible', bar);
  const minions = await waitFor(() => window.__chroma.mode.enemies.some((e) => e.group === 'boss' && e.alive), null, 6000);
  check('l5: boss summons Smudges', minions);
  // valves can't be hit before their shutters are painted
  const hp0 = await ev(() => { const b = window.__chroma.mode.boss; return b.valveHp[0]; });
  await ev(() => { const m = window.__chroma.mode; m.world.combat.damage(m.boss.valves[0], 50, m.player, 'test'); });
  check('l5: closed valves are not exposed', !(await ev(() => window.__chroma.mode.boss.valves[0].alive)) && (await ev(() => window.__chroma.mode.boss.valveHp[0])) === hp0);
  // paint each shutter -> it opens -> burst the valve
  for (let i = 0; i < 4; i++) {
    await ev((i) => {
      const m = window.__chroma.mode, sh = m.course.shutters[i], f = sh.face;
      const c = f.center.clone().addScaledVector(f.n, 0.15);
      for (const [a, b] of [[0, 0], [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]]) m.world.paint.splat(c.clone().addScaledVector(f.u, a).addScaledVector(f.v, b), 1.0, 1);
    }, i);
    const open = await waitFor((i) => window.__chroma.mode.course.shutters[i].open && window.__chroma.mode.boss.valves[i].alive, i, 5000);
    check(`l5: painting shutter ${i + 1} exposes its valve`, open);
    if (i === 0) { await tp(9, 0, 0, -Math.PI / 2); await wait(900); await shot('l5_valve'); }
    await ev((i) => { const m = window.__chroma.mode; m.world.combat.damage(m.boss.valves[i], 999, m.player, 'drop'); }, i);
    await wait(150);
  }
  const p2 = await waitFor(() => window.__chroma.mode.boss.state === 'p2', null, 40000);
  check('l5: all valves burst -> phase 2 (heart exposed)', p2);
  const hearts = await ev(() => window.__chroma.mode.boss.hearts.every((h) => h.alive) && window.__chroma.mode.boss.shields.every((s) => s.alive));
  check('l5: heart hitboxes + orbiting shields live', hearts);
  const shieldBlock = await ev(() => { const m = window.__chroma.mode, b = m.boss; const h = b.heartHp; m.world.combat.damage(b.shields[0], 100, m.player, 'drop'); return b.heartHp === h; });
  check('l5: shields absorb hits', shieldBlock);
  await tp(0, 0, -12, 0);
  await wait(1200);
  await shot('l5_phase2');
  // sweep: unpainted floor -> hurt; own ink + SHIFT -> swim under it
  await fakeLock();
  const sweepHurt = await ev(() => new Promise((res) => {
    const m = window.__chroma.mode, b = m.boss, p = m.player;
    p.place(p.pos.clone().set(12, 0, 0), 0);
    p.invuln = 0; p.hp = 100;
    m.world.paint.splat(p.pos.clone().set(12, 0.02, 0), 2.6, 2); // gray under foot: no swimming possible
    b.sweepT = 99; b.startSweep(p); b.sweep.ang = 0.9; b.sweep.dir = -1;
    let t = 0; const iv = setInterval(() => { t += 100; if (p.hp < 100 || !p.alive || t > 9000) { clearInterval(iv); res(p.hp < 100 || !p.alive); } }, 100);
  }));
  check('l5: sweep beam hurts a player standing on the floor', sweepHurt);
  await waitFor(() => window.__chroma.mode.player.alive, null, 12000);
  await ev(() => { const m = window.__chroma.mode; m.boss.sweep = null; for (const b of m.boss.beams) b.visible = false; });
  await tp(-12, 0, 0, 0);
  await ev(() => { const m = window.__chroma.mode, p = m.player; for (let i = 0; i < 6; i++) m.world.paint.splat(p.pos.clone().set(-12 + (i - 3) * 0.6, 0.02, 0), 2.4, 1); });
  await page.keyboard.down('ShiftLeft');
  const sub = await waitFor(() => window.__chroma.mode.player.submerged, null, 5000);
  const dodged = sub && await ev(() => new Promise((res) => {
    const m = window.__chroma.mode, b = m.boss, p = m.player;
    p.hp = 100; p.invuln = 0; b.lobT = 99; b.lobQueue.length = 0; b.summonT = 99;
    for (const e of m.enemies) if (e.group === 'boss' && e.alive) e.die(p, 'clear');
    b.startSweep(p); b.sweep.ang = Math.PI + 0.9; b.sweep.dir = -1;
    let t = 0, minHp = 100; const iv = setInterval(() => { t += 100; minHp = Math.min(minHp, p.hp); if (!b.sweep || t > 9000) { clearInterval(iv); res(minHp >= 100 && p.alive); } }, 100);
  }));
  await page.keyboard.up('ShiftLeft');
  check('l5: swimming in own ink dodges the sweep', dodged, `submerged=${sub}`);
  // heart damage -> phase 3 -> defeat
  await ev(() => { const m = window.__chroma.mode, b = m.boss; m.world.combat.damage(b.hearts[0], 900, m.player, 'drop'); });
  const p3 = await waitFor(() => window.__chroma.mode.boss.state === 'p3', null, 3000);
  check('l5: heart below 45% -> phase 3 meltdown', p3);
  const ring = await ev(() => { const b = window.__chroma.mode.boss; b.launchRing(); return b.rings.length > 0; });
  check('l5: phase 3 shockwave rings', ring);
  const frac = await ev(() => window.__chroma.mode.boss.frac);
  check('l5: boss health bar fraction tracks damage', frac > 0 && frac < 0.4, frac.toFixed(3));
  await ev(() => { const m = window.__chroma.mode, b = m.boss; m.world.combat.damage(b.hearts[1], 99999, m.player, 'drop'); });
  const dead = await waitFor(() => window.__chroma.mode.boss.state === 'dead' && !!window.__chroma.mode.core, null, 20000);
  check('l5: boss defeated -> Prism Heart appears', dead);
  await wait(800);
  await shot('l5_defeated');
  await deathCheck('l5');
  await coreCheck('l5');
  const ending = await waitFor(() => window.__chroma.mode.hud.dialogBlocking, null, 15000);
  check('l5: ending dialogue plays back at the hub', ending);
  await shot('hub_ending');
}

async function suiteCycle() {
  console.log('\n== cycle: hub -> level -> hub -> plaza (leaks + cleanup)');
  await boot('hub', profile(['l1']));
  const mem = [];
  for (let k = 0; k < 2; k++) {
    await ev(() => window.__chroma.mode.leaveTo('l1', {}, 'test'));
    await waitFor(() => window.__chroma.mode?.levelId === 'l1' && !window.__chroma.loadingNow, null, 90000);
    let dc = await domCounts();
    check(`cycle ${k}: one HUD in level`, dc.hud === 1 && dc.style === 1, JSON.stringify(dc));
    // pause menu + quit to plaza
    await ev(() => window.__chroma.mode.setPaused(true));
    await wait(400);
    const label = await ev(() => document.querySelector('.pause [data-a="quit"]')?.textContent);
    check(`cycle ${k}: pause menu offers LEAVE THE UNDERSIDE`, label === 'LEAVE THE UNDERSIDE', label);
    await page.click('.pause [data-a="quit"]');
    const plaza = await waitFor(() => window.__chroma.mode?.constructor.name === 'Plaza' && !window.__chroma.loadingNow, null, 90000);
    dc = await domCounts();
    check(`cycle ${k}: quitting reaches the plaza with no story DOM left`, plaza && dc.hud === 0 && dc.style === 0, JSON.stringify(dc));
    await ev(() => window.__chroma.goStory('hub'));
    await waitFor(() => window.__chroma.mode?.levelId === 'hub' && !window.__chroma.loadingNow, null, 90000);
    // ride the lift up
    const lift = await ev(() => window.__chroma.mode.lifts[0].pos.toArray());
    await tp(lift[0], 0, lift[2]);
    await wait(500);
    await page.keyboard.press('KeyE');
    const up = await waitFor(() => window.__chroma.mode?.constructor.name === 'Plaza' && !window.__chroma.loadingNow, null, 90000);
    dc = await domCounts();
    check(`cycle ${k}: hub lift returns to the plaza cleanly`, up && dc.hud === 0 && dc.style === 0, JSON.stringify(dc));
    mem.push(await ev(() => ({ ...window.__chroma.renderer.info.memory })));
    await ev(() => window.__chroma.goStory('hub'));
    await waitFor(() => window.__chroma.mode?.levelId === 'hub' && !window.__chroma.loadingNow, null, 90000);
  }
  console.log('  renderer memory after each plaza return:', JSON.stringify(mem));
  check('cycle: GPU geometries/textures do not grow between cycles', mem[1].geometries <= mem[0].geometries + 8 && mem[1].textures <= mem[0].textures + 2, JSON.stringify(mem));
}

const SUITES = { hub: suiteHub, l1: suiteL1, l2: suiteL2, l3: suiteL3, l4: suiteL4, l5: suiteL5, cycle: suiteCycle };
const t0 = Date.now();
for (const s of run) {
  try { await SUITES[s](); } catch (e) { fails++; console.log(`  FAIL ${s} threw:`, e.message); }
}
check('no page errors', errors.length === 0, errors.slice(0, 5).join(' || '));
console.log(`\n${passes} passed, ${fails} failed (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
