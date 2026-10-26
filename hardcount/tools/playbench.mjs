// Run one kind of play many times from midfield and tally the outcomes.
//   node hardcount/tools/playbench.mjs [pass|run|all] [n=200] [--off id] [--def id] [--home pht] [--away det]
import { Match } from '../src/sim/match.js';
import { getTeam } from '../src/data/teams.js';
import { OFFENSE } from '../src/sim/plays/offense.js';
import { DEFENSE } from '../src/sim/plays/defense.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const kind = args[0] || 'pass';
const N = parseInt(args[1] || '200', 10);
const offId = opt('off', null), defId = opt('def', null);
const home = getTeam(opt('home', 'pht')), away = getTeam(opt('away', 'det'));

const offPool = OFFENSE.filter((p) => (offId ? p.id === offId : kind === 'all' ? !['kneel', 'spike'].includes(p.kind) : kind === 'pass' ? (p.kind === 'pass' && !p.hail) : (p.kind === 'run' || p.kind === 'option' || p.kind === 'qbrun')));
const defPool = DEFENSE.filter((d) => (defId ? d.id === defId : d.id !== 'prevent' && d.id !== 'goal'));
const T = { n: 0, att: 0, comp: 0, int: 0, sack: 0, yds: 0, td: 0, fum: 0, inc: 0, throwT: 0, throws: 0, big: 0, neg: 0, scr: 0, lat: 0, stuck: 0 };
const byPlay = new Map();
for (let k = 0; k < N; k++) {
  const m = new Match({ home, away, users: { home: null, away: null }, seed: 1000 + k });
  m.possession = 'home'; m.dirHome = 1;
  m.newSeries('home', -5, 0);
  const op = offPool[k % offPool.length], dp = defPool[Math.floor(k / offPool.length) % defPool.length];
  let threw = false, tThrow = 0, int = false, fum = false, sack = false, lat = 0;
  m.on((e) => {
    if (e.type === 'throw' && e.forward) { threw = true; tThrow = m.playT; }
    if (e.type === 'interception') int = true;
    if (e.type === 'fumble') fum = true;
    if (e.type === 'lateral') lat++;
  });
  m.callPlays(op.id, dp.id, { flip: k % 2 === 1, noRunoff: true });
  for (let i = 0; i < 60 * 8 && m.phase === 'presnap'; i++) m.step(1 / 60);   // the CPU snaps on its own (motion plays time it)
  if (m.phase === 'presnap') m.snap();
  for (let i = 0; i < 60 * 20 && m.phase === 'live'; i++) m.step(1 / 60);
  if (m.phase === 'live') { T.stuck++; const c = m.ball.carrier; console.log(`!! stuck: ${op.id} vs ${dp.id} seed ${1000 + k} flip ${k % 2} ball=${m.ball.state}/${m.ball.kind} carrier=${c ? c.role + ' ' + c.state + ' ' + (c.mem.phase || '') : '-'} t=${m.playT.toFixed(1)}`); continue; }
  const r = m.result;
  T.n++;
  if (r.sack) { T.sack++; sack = true; }
  if (threw) { T.att++; T.throwT += tThrow; T.throws++; }
  if (m.passCompleted) T.comp++;
  if (int) T.int++;
  if (fum && r.side !== 'home') T.fum++;
  if (r.type === 'incomplete') T.inc++;
  const y = r.side === 'home' ? (r.type === 'incomplete' ? 0 : r.yards) : 0;
  T.yds += y;
  if (r.type === 'td' && r.side === 'home') T.td++;
  if (y >= 20) T.big++;
  if (y < 0) T.neg++;
  T.lat += lat;
  const s = byPlay.get(op.name) || { n: 0, yds: 0, comp: 0, att: 0, int: 0 };
  s.n++; s.yds += y; if (threw) s.att++; if (m.passCompleted) s.comp++; if (int) s.int++;
  byPlay.set(op.name, s);
}
const p = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%';
console.log(`${T.n} plays (${kind}${offId ? ' ' + offId : ''}${defId ? ' vs ' + defId : ''}): ${(T.yds / T.n).toFixed(2)} yd/play, comp ${p(T.comp, T.att)} of ${T.att} att, INT ${p(T.int, T.att)}, sack ${p(T.sack, T.n)}, TD ${p(T.td, T.n)}, 20+ ${p(T.big, T.n)}, neg ${p(T.neg, T.n)}, fum lost ${T.fum}, laterals ${T.lat}, time to throw ${(T.throwT / Math.max(1, T.throws)).toFixed(2)}s, stuck ${T.stuck}`);
for (const [name, s] of [...byPlay.entries()].sort((a, b) => b[1].yds / b[1].n - a[1].yds / a[1].n)) {
  console.log(`  ${name.padEnd(18)} ${(s.yds / s.n).toFixed(1).padStart(5)} yd  ${s.att ? `${s.comp}/${s.att} ${s.int}int` : ''}`);
}
