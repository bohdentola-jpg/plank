// Headless CPU-vs-CPU games: box scores and sanity numbers for tuning the sim.
//   node hardcount/tools/simgame.mjs [games=1] [home=pht] [away=det] [--seed 7] [--log] [--q 4]
import { Match } from '../src/sim/match.js';
import { getTeam, TEAMS } from '../src/data/teams.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--log', '--verbose'].includes(args[i - 1])));
const games = parseInt(pos[0] || '1', 10);
const homeId = pos[1] || 'pht', awayId = pos[2] || 'det';
const seed0 = parseInt(opt('seed', '1'), 10);
const qlen = parseFloat(opt('q', '4'));
const LOG = flag('log');

const agg = { plays: 0, pass: 0, comp: 0, passYds: 0, run: 0, runYds: 0, td: 0, ints: 0, fum: 0, sacks: 0, laterals: 0, pts: 0, flags: 0, longPlays: 0, stuck: 0, games: 0, punts: 0, fga: 0, fgm: 0, playsPerGame: 0, wall: 0 };

for (let g = 0; g < games; g++) {
  const t0 = Date.now();
  const home = getTeam(homeId), away = getTeam(awayId);
  const m = new Match({ home, away, users: { home: null, away: null }, autoCalls: true, seed: seed0 + g * 101, settings: { quarterLen: qlen } });
  const ev = { pass: 0, comp: 0, run: 0, td: 0, int: 0, fum: 0, lat: 0, flags: [] };
  m.on((e) => {
    if (e.type === 'throw' && e.forward) ev.pass++;
    if (e.type === 'catch') ev.comp++;
    if (e.type === 'interception') ev.int++;
    if (e.type === 'fumble') ev.fum++;
    if (e.type === 'lateral') ev.lat++;
    if (e.type === 'flag') ev.flags.push(e.name);
    if (LOG && e.type === 'whistle') {
      const r = e.result;
      console.log(`Q${m.quarter} ${fmt(m.clock)} ${m.offSide.padEnd(4)} ${m.down}&${Math.round(m.toGo)} @${m.field.spotText(m.los, m.offDir).padEnd(9)} ${String(m.play?.name || m.playKind).padEnd(16)} vs ${String(m.dplay?.name || '').padEnd(14)} → ${r.type}${r.sack ? ' SACK' : ''} ${r.yards >= 0 ? '+' : ''}${r.yards} (${r.side})  ${m.score.home}-${m.score.away}`);
    }
    if (LOG && (e.type === 'score' || e.type === 'turnover' || e.type === 'interception' || e.type === 'fumble' || e.type === 'flag' || e.type === 'quarterEnd' || e.type === 'overtime' || e.type === 'turnoverOnDowns')) console.log('   ·', e.type, e.kind || e.name || e.side || '', e.pts || '');
  });
  m.start({ kicking: 'away' });
  let simT = 0, liveT = 0;
  const DT = 1 / 60;
  while (m.phase !== 'final' && simT < 60 * 120) {
    m.step(DT);
    simT += DT;
    if (m.phase === 'live') {
      liveT += DT;
      if (liveT > 30) {
        agg.stuck++;
        const c = m.ball.carrier;
        console.log(`!! stuck play: ${m.play?.name || m.playKind} ball=${m.ball.state}/${m.ball.kind} carrier=${c ? c.role + ' ' + c.state : '-'} at ${m.ball.x.toFixed(1)},${m.ball.z.toFixed(1)} t=${m.playT.toFixed(1)}`);
        m.whistle('tackle', { e: c || undefined, side: c?.side || m.offSide, z: m.ball.z, x: m.ball.x });
        liveT = 0;
      }
    } else liveT = 0;
    if (m.phase === 'penalty') m.choosePenalty?.(true);
  }
  const s = m.stats;
  const sum = (k) => s.home[k] + s.away[k];
  console.log(`\n${home.abbr} ${m.score.home} – ${away.abbr} ${m.score.away}${m.ot ? ' (OT)' : ''}   [${m.phase}] sim ${Math.round(simT)}s, ${((Date.now() - t0) / 1000).toFixed(1)}s wall`);
  for (const side of ['home', 'away']) {
    const t = s[side];
    console.log(`  ${(side === 'home' ? home : away).abbr}: ${t.plays} plays, ${t.yards} yds (pass ${t.passYds} ${t.comp}/${t.att}, rush ${t.rushYds}), 1st ${t.firstDowns}, 3rd ${t.thirdConv}/${t.third}, TO ${t.ints}int ${t.fumblesLost}fum, sacks ${t.sacks}, pen ${t.penalties}-${t.penYds}, lat ${t.laterals}, punts ${t.punts}, FG ${t.fgm}/${t.fga}`);
  }
  const players = [...s.players.values()].sort((a, b) => (b.passYds || 0) + (b.rushYds || 0) + (b.recYds || 0) - ((a.passYds || 0) + (a.rushYds || 0) + (a.recYds || 0))).slice(0, 6);
  for (const p of players) console.log(`    ${p.pos} ${p.name.padEnd(20)} ${p.att ? `pass ${p.comp || 0}/${p.att} ${p.passYds || 0}y ${p.passTd || 0}td ${p.intsThrown || 0}int ` : ''}${p.car ? `rush ${p.car}-${p.rushYds}y ` : ''}${p.rec ? `rec ${p.rec}-${p.recYds || 0}y ` : ''}${p.td ? p.td + 'td' : ''}`);
  if (ev.flags.length) console.log('  flags:', ev.flags.join(', '));
  agg.games++;
  agg.pts += m.score.home + m.score.away;
  agg.plays += sum('plays'); agg.pass += sum('att'); agg.comp += sum('comp'); agg.passYds += sum('passYds');
  agg.runYds += sum('rushYds'); agg.ints += sum('ints'); agg.sacks += sum('sacks'); agg.laterals += sum('laterals');
  agg.flags += ev.flags.length; agg.punts += sum('punts'); agg.fga += sum('fga'); agg.fgm += sum('fgm');
  agg.wall += Date.now() - t0;
}
if (agg.games > 1) {
  const g = agg.games;
  console.log(`\n== ${g} games: ${(agg.pts / g).toFixed(1)} pts/g, ${(agg.plays / g).toFixed(0)} plays/g, comp ${(100 * agg.comp / Math.max(1, agg.pass)).toFixed(0)}% ${(agg.passYds / Math.max(1, agg.comp)).toFixed(1)} y/c, ${(agg.ints / g).toFixed(1)} int/g, ${(agg.sacks / g).toFixed(1)} sacks/g, ${(agg.laterals / g).toFixed(1)} lat/g, ${(agg.flags / g).toFixed(1)} flags/g, punts ${(agg.punts / g).toFixed(1)}/g, FG ${agg.fgm}/${agg.fga}, stuck ${agg.stuck}, ${(agg.wall / g / 1000).toFixed(1)}s/game`);
}

function fmt(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }
void TEAMS;
