// Headless match runner. Plays matches with no screen to shake out crashes,
// NaNs and softlocks, and to gather balance numbers.
//
//   node brawl/tools/sim.mjs monkey [frames]        random button mashing, every fighter
//   node brawl/tools/sim.mjs cpu [matches] [level]   CPU vs CPU round-robin with stats
//   node brawl/tools/sim.mjs stages                  every stage, CPUs fighting

import { Match } from '../js/game/match.js';
import { FIGHTERS as ALL_F, fighterById } from '../js/fighters/index.js';
import { STAGES as ALL_S, stageById } from '../js/stages/index.js';
const pickList = (all, env, real) => { const want = (process.env[env] || '').split(',').filter(Boolean); const base = want.length ? all.filter((x) => want.includes(x.id)) : all.filter((x) => !x.stub || !real); return base.length ? base : all.slice(0, 1); };
const FIGHTERS = pickList(ALL_F, 'FIGHTERS', true), STAGES = pickList(ALL_S, 'STAGES', true);
import { blankSnap } from '../js/core/input.js';
import { RNG } from '../js/core/util.js';
import { HELPERS } from '../js/game/items.js';

let CPU = null;
try { ({ CPU } = await import('../js/game/ai.js')); } catch (e) { /* AI not built yet */ }

class Monkey {
  constructor(seed) { this.rng = new RNG(seed); this.snap = blankSnap(); this.isCPU = true; this.tapJump = true; this.hold = {}; this.dir = [0, 0]; this.dt = 0; }
  read() {
    const s = this.snap, r = this.rng;
    if (--this.dt <= 0) { this.dt = r.int(2, 40); const px = this.dir[0], py = this.dir[1]; this.dir = [r.pick([-1, 0, 0, 1]), r.pick([-1, 0, 0, 0, 1])]; s.tapX = this.dir[0] !== px ? this.dir[0] : 0; s.tapY = this.dir[1] !== py ? this.dir[1] : 0; }
    else { s.tapX = 0; s.tapY = 0; }
    s.x = this.dir[0]; s.y = this.dir[1];
    for (const a of ['attack', 'special', 'jump', 'shield', 'grab', 'strong', 'taunt']) {
      const was = s.h[a];
      if (this.hold[a] > 0) { this.hold[a]--; s.h[a] = true; }
      else { s.h[a] = false; if (r.chance(a === 'shield' ? 0.01 : a === 'taunt' ? 0.002 : 0.035)) this.hold[a] = r.int(1, a === 'strong' ? 40 : 12); }
      s.p[a] = s.h[a] && !was;
    }
    if (r.chance(0.01)) { s.x = 0; s.y = 0; s.tapX = 0; s.tapY = 0; if (!s.h.special) { s.h.special = true; s.p.special = true; this.hold.special = 2; } }
    return s;
  }
}

function check(m, label) {
  for (const f of m.fighters) {
    for (const k of ['x', 'y', 'vx', 'vy', 'kx', 'ky', 'pct']) {
      if (!Number.isFinite(f[k])) throw new Error(`${label}: ${f.def.id}.${k} is ${f[k]} at frame ${m.frame} (state ${f.state}/${f.moveId})`);
    }
  }
}

function run(opts, frames, label) {
  const m = new Match(Object.assign({ skipIntro: true, seed: 7 }, opts));
  let lastProgress = 0, lastSig = '';
  for (let i = 0; i < frames && !m.done; i++) {
    m.update();
    // hand out Gold Stars and helpers now and then so supers and helpers get exercised too
    if (opts.chaos && i % 420 === 200) { const f = m.fighters[(i / 420 | 0) % m.fighters.length]; if (!f.out && f.state !== 'dead') f.superReady = true; }
    if (opts.chaos && i % 700 === 350 && HELPERS.length) { const f = m.fighters[0]; if (!f.out) HELPERS[(i / 700 | 0) % HELPERS.length].spawn(m, f, f.x, f.y); }
    check(m, label);
    // softlock watch: someone stuck in one non-idle state for ages
    for (const f of m.fighters) {
      if (f.out) continue;
      if (f.sf > 1500 && !['idle', 'dead', 'crouch', 'shield', 'run', 'walk', 'air'].includes(f.state)) {
        throw new Error(`${label}: ${f.def.id} stuck in ${f.state}/${f.moveId} for ${f.sf} frames (frame ${m.frame})`);
      }
    }
  }
  return m;
}

const mode = process.argv[2] || 'monkey';
let failures = 0;

if (mode === 'monkey') {
  const frames = +process.argv[3] || 6000;
  for (const a of FIGHTERS) {
    for (const stage of STAGES) {
      const b = FIGHTERS[(FIGHTERS.indexOf(a) + 1 + STAGES.indexOf(stage)) % FIGHTERS.length];
      const label = `${a.id} vs ${b.id} on ${stage.id}`;
      try {
        const m = run({ stageDef: stage, players: [{ def: a, ctl: new Monkey(11) }, { def: b, ctl: new Monkey(23) }, { def: a, ctl: new Monkey(5), costume: 1 }], rules: { stocks: 99, time: 0, items: true }, chaos: true }, frames, label);
        const st = m.fighters.map((f) => `${f.def.id}: ${f.stats.kos}ko ${f.stats.falls}falls ${Math.round(f.stats.dealt)}dmg`).join(' | ');
        console.log('ok  ', label.padEnd(44), st);
      } catch (e) { failures++; console.log('FAIL', label, '\n     ', e.stack.split('\n').slice(0, 4).join('\n      ')); }
    }
  }
} else if (mode === 'cpu' || mode === 'stages') {
  if (!CPU) { console.log('AI module not present'); process.exit(1); }
  const n = +process.argv[3] || 1, level = +process.argv[4] || 7;
  const table = new Map();
  const rec = (id) => table.get(id) || table.set(id, { w: 0, l: 0, t: 0, sd: 0, falls: 0, dmg: 0, frames: 0, n: 0 }).get(id);
  const pairs = [];
  if (mode === 'stages') { for (const st of STAGES) pairs.push([FIGHTERS[STAGES.indexOf(st) % FIGHTERS.length], FIGHTERS[(STAGES.indexOf(st) * 3 + 1) % FIGHTERS.length], st]); }
  else for (let i = 0; i < FIGHTERS.length; i++) for (let j = FIGHTERS.length > 1 ? i + 1 : i; j < FIGHTERS.length; j++) pairs.push([FIGHTERS[i], FIGHTERS[j], null]);
  let seed = 100;
  for (const [a, b, st] of pairs) {
    for (let k = 0; k < n; k++) {
      const stage = st || STAGES[(seed) % STAGES.length];
      const label = `${a.id} vs ${b.id} on ${stage.id}`;
      try {
        const m = run({ stageDef: stage, seed: seed++, players: [{ def: a, ctl: new CPU(level), cpuLevel: level }, { def: b, ctl: new CPU(level), cpuLevel: level }], rules: { stocks: 3, time: 0, items: mode === 'stages' } }, 60 * 60 * 8, label);
        const ra = rec(a.id), rb = rec(b.id);
        if (!m.result) { ra.t++; rb.t++; console.log('TIMEOUT', label, m.fighters.map((f) => `${f.stocks}st ${Math.round(f.pct)}%`).join(' / ')); }
        else {
          const w = m.result.order[0];
          (w === 0 ? ra : rb).w++; (w === 0 ? rb : ra).l++;
          if (process.env.VERBOSE) console.log('    ', label.padEnd(40), `winner P${w + 1} in ${(m.frame / 60).toFixed(0)}s  kos ${m.fighters.map((f) => f.stats.kos).join('/')} sds ${m.fighters.map((f) => f.stats.sds).join('/')} dmg ${m.fighters.map((f) => Math.round(f.stats.dealt)).join('/')}`);
          if (mode === 'stages') console.log('ok  ', label.padEnd(40), `winner ${m.fighters[w].def.id} in ${(m.frame / 60).toFixed(0)}s  sds ${m.fighters.map((f) => f.stats.sds).join('/')}`);
        }
        for (const [r, f] of [[ra, m.fighters[0]], [rb, m.fighters[1]]]) { r.sd += f.stats.sds; r.falls += f.stats.falls; r.dmg += f.stats.dealt; r.frames += m.frame; r.n++; }
      } catch (e) { failures++; console.log('FAIL', label, '\n     ', e.stack.split('\n').slice(0, 5).join('\n      ')); }
    }
  }
  if (mode === 'cpu') {
    console.log('\nfighter          win  loss  t/o   SDs/match  dmg/min  avg match');
    for (const [id, r] of [...table.entries()].sort((x, y) => y[1].w / (y[1].n || 1) - x[1].w / (x[1].n || 1))) {
      console.log(id.padEnd(15), String(r.w).padStart(4), String(r.l).padStart(5), String(r.t).padStart(4), (r.sd / r.n).toFixed(2).padStart(10), (r.dmg / (r.frames / 3600)).toFixed(0).padStart(9), ((r.frames / r.n) / 60).toFixed(0).padStart(8) + 's');
    }
  }
}
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall clear');
process.exit(failures ? 1 : 0);
