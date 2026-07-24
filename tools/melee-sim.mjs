// Headless test harness for MASCOT MELEE 64.
//
// The sim (fighters, hitboxes, stages, CPU) is deliberately free of three.js and
// the DOM, so a whole match plays here at thousands of frames per second. Three
// phases, cheapest first:
//
//   1. FRAME DATA  — static validation: hitbox windows inside the move, clips that
//                    actually exist, sane stats, stages that enclose themselves.
//   2. MOVE DRILL  — every move of every fighter is executed against a pinned
//                    dummy and must connect (or spawn its projectile / land its
//                    throw). Catches unreachable hitboxes and typo'd frames.
//   3. MATCHES     — CPU vs CPU across the roster and every stage, watching for
//                    stalls, NaN, broken collision, and whether kill percents and
//                    match lengths land where a platform fighter wants them.
//
// Usage: node tools/melee-sim.mjs [matches] [--verbose]
import { Match } from '../src/melee/match.js';
import { ROSTER, charById } from '../src/melee/roster.js';
import { STAGES } from '../src/melee/stages.js';
import { VirtualControls } from '../src/melee/input.js';
import { makeClips } from '../src/melee/poses.js';
import { UNIVERSAL } from '../src/melee/moves.js';

const args = process.argv.slice(2);
const N = parseInt(args.find((a) => /^\d+$/.test(a)) || '18', 10);
const VERBOSE = args.includes('--verbose');

let failures = 0;
let warnings = 0;
const fail = (msg) => { failures++; console.error(`FAIL ${msg}`); };
const warn = (msg) => { warnings++; console.log(`warn ${msg}`); };
const noopFx = new Proxy({}, { get: () => () => undefined });

const EXPECTED_MOVES = [
  'jab1', 'jab2', 'jab3', 'ftilt', 'utilt', 'dtilt', 'dashAttack',
  'fsmash', 'usmash', 'dsmash', 'nair', 'fair', 'bair', 'uair', 'dair',
  'nspecial', 'sspecial', 'uspecial', 'dspecial', 'finisher',
  'grab', 'pummel', 'throwF', 'throwB', 'throwU', 'throwD',
];

// ======================================================== 1. frame data
function checkFrameData() {
  const base = makeClips();
  let moves = 0;
  for (const def of ROSTER) {
    const clips = { ...base, ...(def.clips || {}) };
    for (const id of EXPECTED_MOVES) {
      if (!def.moves[id]) fail(`${def.id} is missing ${id}`);
    }
    for (const [id, m] of Object.entries(def.moves)) {
      moves++;
      if (!m || typeof m !== 'object') { fail(`${def.id}.${id} is not a move`); continue; }
      if (!(m.frames > 0)) fail(`${def.id}.${id} has no duration`);
      if (m.clip && !clips[m.clip]) fail(`${def.id}.${id} points at missing clip "${m.clip}"`);
      if (m.iasa > m.frames + 1) fail(`${def.id}.${id} iasa ${m.iasa} is past its ${m.frames} frames`);
      for (const h of m.hits) {
        if (h.start < 1) fail(`${def.id}.${id} hitbox starts at frame ${h.start}`);
        if (h.end < h.start) fail(`${def.id}.${id} hitbox ends before it starts`);
        if (h.end > m.frames) fail(`${def.id}.${id} hitbox is active on frame ${h.end} of a ${m.frames}-frame move`);
        if (h.dmg <= 0 && !h.grabHit) fail(`${def.id}.${id} hitbox does no damage`);
        if (h.dmg > 40) warn(`${def.id}.${id} hitbox does ${h.dmg} damage — huge`);
        if (h.r <= 0 || h.r > 4) fail(`${def.id}.${id} hitbox radius ${h.r} is out of range`);
        if (Math.abs(h.x) > 4 || h.y < -1 || h.y > 4) fail(`${def.id}.${id} hitbox sits at ${h.x},${h.y}`);
      }
      for (const s of m.spawn || []) {
        if (s.frame > m.frames) fail(`${def.id}.${id} spawns a projectile on frame ${s.frame} of ${m.frames}`);
        if (!s.proj) fail(`${def.id}.${id} spawn has no projectile`);
      }
      if (m.charge && !(m.charge.maxFrames > 0)) fail(`${def.id}.${id} has a broken charge`);
      // a move with no hitbox, no projectile and no defensive property does nothing
      const doesSomething = m.hits.length || m.spawn || m.counter || m.reflect || m.kind === 'throw';
      if (!doesSomething) fail(`${def.id}.${id} does nothing at all`);
    }
    const s = def.stats;
    if (!(s.weight >= 60 && s.weight <= 140)) fail(`${def.id} weight ${s.weight} out of band`);
    if (!(s.run >= 5 && s.run <= 12)) fail(`${def.id} run ${s.run} out of band`);
    if (!(s.jump >= 11 && s.jump <= 20)) fail(`${def.id} jump ${s.jump} out of band`);
    if (!(s.gravity >= 20 && s.gravity <= 50)) fail(`${def.id} gravity ${s.gravity} out of band`);
    // can this fighter get back to the stage from below the ledge?
    const apex = (s.jump * s.jump) / (2 * s.gravity) + (s.djump * s.djump) / (2 * s.gravity);
    if (apex < 4.5) fail(`${def.id} can only jump ${apex.toFixed(1)} units — cannot recover`);
    for (const t of ['power', 'speed', 'range', 'recovery', 'weight']) {
      const v = def.tier?.[t];
      if (!(v >= 1 && v <= 5)) fail(`${def.id} tier.${t} is ${v}`);
    }
    if (!def.bio || def.bio.length < 20) fail(`${def.id} has no bio`);
  }
  // stages
  for (const st of STAGES) {
    const main = st.solids?.[0];
    if (!main) { fail(`${st.id} has no ground`); continue; }
    if (!st.solids.some((p) => p.ledges?.length)) fail(`${st.id} has no grabbable ledges`);
    if (!(st.blast.left < main.x - main.w / 2 && st.blast.right > main.x + main.w / 2)) {
      fail(`${st.id} blast zones cut into the stage`);
    }
    if (st.blast.bottom > main.y - 4) fail(`${st.id} has no room under the stage to recover`);
    for (const sp of st.spawns) {
      if (sp.y < main.y) fail(`${st.id} spawn at y=${sp.y} is under the floor`);
    }
    for (const p of st.solids) {
      for (const lx of p.ledges || []) {
        const edge = Math.min(Math.abs(lx - (p.x - p.w / 2)), Math.abs(lx - (p.x + p.w / 2)));
        if (edge > 0.01) fail(`${st.id} ledge at ${lx} is not on a platform edge`);
      }
    }
    if (!st.music) fail(`${st.id} has no music track`);
    if (typeof st.thumb !== 'function') fail(`${st.id} has no thumbnail`);
    if (typeof st.build !== 'function') fail(`${st.id} has no build()`);
  }
  console.log(`1. frame data   ${moves} moves, ${ROSTER.length} fighters, ${STAGES.length} stages checked`);
}

// ======================================================== 2. move drill
/** A two-fighter match with nobody driving, used as a test rig. */
function drillMatch(def, dummyDef = charById('tusk')) {
  const match = new Match({
    stage: STAGES[0],
    entrants: [
      { def, alt: 0, controls: new VirtualControls(), cpu: 0 },
      { def: dummyDef, alt: 1, controls: new VirtualControls(), cpu: 0 },
    ],
    rules: { mode: 'stock', stocks: 99, timeLimit: 0, items: false },
    fx: noopFx,
  });
  match.started = true;
  match.countdown = 0;
  const [a, d] = match.fighters;
  a.spawn(0, 0, 1);
  d.spawn(1.2, 0, -1);
  a.setState('idle');
  d.setState('idle');
  a.grounded = true;
  d.grounded = true;
  // spawning grants respawn invincibility — the dummy is here to be hit
  a.respawnInvuln = 0;
  d.respawnInvuln = 0;
  d.invuln = 0;
  return { match, a, d };
}

function drillMove(def, id) {
  const m = def.moves[id];
  const { match, a, d } = drillMatch(def);
  const aerial = ['nair', 'fair', 'bair', 'uair', 'dair'].includes(id);
  if (aerial) {
    a.y = 4;
    a.grounded = false;
    a.setState('air');
  }
  const before = d.percent;
  // count spawns and grabs as they happen — a projectile can be born, connect and
  // die inside a single frame, and a grab releases itself after its timer
  let projSpawned = 0;
  let grabbedEver = false;
  const origSpawn = match.spawnProjectile.bind(match);
  match.spawnProjectile = (owner, pdef) => { projSpawned++; return origSpawn(owner, pdef); };

  // throws need a grab first
  if (id.startsWith('throw') || id === 'pummel') {
    a.startGrab(d, { hold: true });
    a.startMove(id);
    if (id !== 'pummel') a.setState('throwing');
  } else {
    a.startMove(id);
    if (m.charge) {
      // release the charge immediately: charge state → attack on the next frame
      a.input.set(0, 0, {});
    }
  }

  const total = m.frames + (m.charge ? m.charge.maxFrames : 0) + 60;
  for (let f = 0; f < total; f++) {
    // pin the dummy onto the live hitbox so the test measures frame data, not spacing
    if (a.move && a.state === 'attack') {
      const hb = a.move.hits.find((h) => a.moveFrame >= h.start - 1 && a.moveFrame <= h.end);
      if (hb) {
        d.x = a.x + hb.x * a.facing * a.stats.size;
        d.y = a.y + hb.y * a.stats.size - d.height * 0.54;
        d.vx = 0; d.vy = 0;
        d.hitstun = 0;
        d.setState('idle');
      }
    }
    // and keep projectiles fed a target
    if (match.projectiles.length && !a.move?.hits?.length) {
      const p = match.projectiles[0];
      d.x = p.x + Math.sign(p.vx || 1) * 0.2;
      d.y = p.y - d.height * 0.5;
    }
    match.step();
    if (d.state === 'held' || d.heldBy === a) grabbedEver = true;
    if (d.percent > before && (projSpawned || !m.spawn)) break;
  }
  const dealt = d.percent - before;
  const launched = Math.abs(d.vx) + Math.abs(d.vy) > 0.5;
  return { dealt, grabbed: grabbedEver, launched, projSeen: projSpawned, m };
}

function checkMoveDrill() {
  let tested = 0;
  const dead = [];
  for (const def of ROSTER) {
    for (const [id, m] of Object.entries(def.moves)) {
      if (m.counter || m.reflect) continue;              // tested separately below
      tested++;
      const r = drillMove(def, id);
      if (id === 'grab') {
        if (!r.grabbed) fail(`${def.id}.grab never grabs`);
        continue;
      }
      if (id.startsWith('throw')) {
        if (r.dealt <= 0 || !r.launched) fail(`${def.id}.${id} does not launch the victim (dealt ${r.dealt})`);
        continue;
      }
      if (m.hits.some((h) => h.grabHit)) {
        if (!r.grabbed && r.dealt <= 0) fail(`${def.id}.${id} (command grab) never connects`);
        continue;
      }
      if (m.spawn && !m.hits.length) {
        if (!r.projSeen) fail(`${def.id}.${id} spawns no projectile`);
        continue;
      }
      if (r.dealt <= 0) { dead.push(`${def.id}.${id}`); fail(`${def.id}.${id} never connects with a pinned dummy`); }
    }
    // counters must actually counter
    const dsp = def.moves.dspecial;
    if (dsp?.counter) {
      const { match, a, d } = drillMatch(def);
      a.startMove('dspecial');
      match.step();
      match.step();
      const before = d.percent;
      d.startMove('ftilt');
      for (let f = 0; f < 40; f++) match.step();
      if (d.percent <= before) fail(`${def.id} down-special counter never fires`);
    }
    // reflectors must send a projectile back
    const refl = Object.entries(def.moves).find(([, m]) => m.reflect);
    if (refl) {
      const { match, a, d } = drillMatch(def, charById('volt'));
      d.x = 6;
      a.facing = 1; d.facing = -1;
      a.startMove(refl[0]);
      match.spawnProjectile(d, { kind: 'bolt', r: 0.25, speed: 12, life: 200, dmg: 6, angle: 361, kbBase: 20, kbGrowth: 40, color: '#fff' });
      let flipped = false;
      for (let f = 0; f < 60; f++) {
        match.step();
        const p = match.projectiles[0];
        if (p && p.owner === a) { flipped = true; break; }
      }
      if (!flipped) fail(`${def.id} ${refl[0]} never reflects a projectile`);
    }
  }
  console.log(`2. move drill    ${tested} moves executed${dead.length ? `, ${dead.length} dead` : ', all connected'}`);
}

// ======================================================== 3. matches
const koPercents = [];
const movesSeen = new Map();
let ledgeGrabs = 0;
let totalFrames = 0;
let matchesFinished = 0;
let shieldBreaks = 0;

function runMatch(aId, bId, stage, { stocks = 2, cap = 60 * 60 * 5 } = {}) {
  const entrants = [
    { def: charById(aId), alt: 0, cpu: 7, controls: new VirtualControls(), name: aId },
    { def: charById(bId), alt: 1, cpu: 6, controls: new VirtualControls(), name: bId },
  ];
  const match = new Match({
    stage, entrants, fx: noopFx,
    rules: { mode: 'stock', stocks, timeLimit: 0, items: true, itemRate: 1, damageRatio: 1 },
    seed: (aId.length * 977 + bId.length * 31 + stage.id.length) | 0,
  });
  for (const f of match.fighters) {
    if (!movesSeen.has(f.def.id)) movesSeen.set(f.def.id, new Set());
    const orig = f.takeHit.bind(f);
    f.takeHit = (hb, from, opts) => {
      const r = orig(hb, from, opts);
      if (r && from?.moveId) movesSeen.get(from.def.id).add(from.moveId);
      return r;
    };
  }

  let frames = 0;
  const seenLedge = new Set();
  while (!match.over && frames < cap) {
    match.step();
    frames++;
    for (const f of match.fighters) {
      if (![f.x, f.y, f.vx, f.vy, f.percent].every(Number.isFinite)) {
        fail(`${f.def.name} went non-finite on ${stage.id} at frame ${frames} (${f.state})`);
        return { frames, match, broken: true };
      }
      if (f.state === 'ledge' && !seenLedge.has(f.uid)) { seenLedge.add(f.uid); ledgeGrabs++; }
      if (f.state === 'shieldBreak' && !f._sbCounted) { f._sbCounted = true; shieldBreaks++; }
      if (f.grounded && match.world.groundYAt(f.x, f.y + 0.2) < f.y - 0.3) {
        fail(`${f.def.name} grounded in mid-air on ${stage.id}`
          + ` (state=${f.state} x=${f.x.toFixed(2)} y=${f.y.toFixed(2)} frame=${frames})`);
        return { frames, match, broken: true };
      }
      if (f.percent > 900) fail(`${f.def.name} reached ${Math.round(f.percent)}% without dying`);
    }
    for (const e of match.events) {
      if (e.type === 'ko' && !e.self) koPercents.push(match.fighters[e.who]._koAt ?? 0);
    }
    for (const f of match.fighters) if (f.state !== 'dead') f._koAt = f.percent;
    match.events.length = 0;
  }
  totalFrames += frames;
  if (match.over) matchesFinished++;
  else fail(`${aId} vs ${bId} on ${stage.id} never finished in ${(cap / 60) | 0}s`);
  return { frames, match };
}

function checkMatches() {
  const pairs = [];
  for (let i = 0; i < N; i++) {
    const a = ROSTER[i % ROSTER.length].id;
    let b = ROSTER[(i * 5 + 3) % ROSTER.length].id;
    if (b === a) b = ROSTER[(i + 1) % ROSTER.length].id;
    pairs.push([a, b, STAGES[i % STAGES.length]]);
  }
  const t0 = Date.now();
  for (const [a, b, stage] of pairs) {
    const { frames, match } = runMatch(a, b, stage);
    if (VERBOSE) {
      const win = match.result?.order?.[0];
      console.log(`   ${a} vs ${b} @ ${stage.id}: ${(frames / 60).toFixed(1)}s`
        + `${win ? ` — ${win.name} wins ${win.kos}-${win.falls}` : ''}`);
    }
  }
  const secs = Math.max(0.01, (Date.now() - t0) / 1000);
  const avgLen = totalFrames / pairs.length / 60;
  const avgKo = koPercents.length ? koPercents.reduce((s, v) => s + v, 0) / koPercents.length : 0;
  const sorted = [...koPercents].sort((x, y) => x - y);
  const median = sorted.length ? sorted[sorted.length >> 1] : 0;
  console.log(`3. matches       ${pairs.length} run, ${matchesFinished} finished`
    + ` (${(totalFrames / secs / 60).toFixed(0)}x realtime)`);
  console.log(`   length        avg ${avgLen.toFixed(1)}s for 2 stocks`);
  console.log(`   KO damage     avg ${avgKo.toFixed(0)}%  median ${median.toFixed(0)}%  n=${koPercents.length}`);
  console.log(`   recovery      ${ledgeGrabs} ledge grabs · ${shieldBreaks} shield breaks`);

  if (matchesFinished < pairs.length) fail(`${pairs.length - matchesFinished} matches stalled`);
  if (koPercents.length < pairs.length) fail('fewer KOs than matches — nobody is dying');
  if (avgKo < 45) fail(`KOs far too cheap (avg ${avgKo.toFixed(0)}%) — knockback too strong`);
  if (avgKo > 260) fail(`KOs take forever (avg ${avgKo.toFixed(0)}%) — knockback too weak`);
  if (avgLen < 8) fail(`matches end in ${avgLen.toFixed(1)}s — far too fast`);
  if (avgLen > 240) fail(`matches drag on for ${avgLen.toFixed(0)}s — the CPU cannot close`);
  if (!ledgeGrabs) fail('no ledge grabbed in any match — recovery is broken');

  if (VERBOSE) {
    console.log('\n   CPU move usage:');
    for (const def of ROSTER) {
      const seen = movesSeen.get(def.id);
      if (!seen) continue;
      const all = Object.keys(def.moves).filter((k) => def.moves[k]?.hits?.length || def.moves[k]?.spawn);
      console.log(`     ${def.name.padEnd(12)} ${String(seen.size).padStart(2)}/${all.length}`);
    }
  }
}

// ======================================================== run
console.log('MASCOT MELEE 64 — headless harness\n');
checkFrameData();
checkMoveDrill();
checkMatches();
console.log(`\nshield max ${UNIVERSAL.shieldMax} · jumpsquat ${UNIVERSAL.jumpsquat}f · roll ${UNIVERSAL.rollFrames}f`);
console.log(failures ? `\n${failures} FAILURES (${warnings} warnings)` : `\nall checks passed (${warnings} warnings)`);
process.exit(failures ? 1 : 0);
