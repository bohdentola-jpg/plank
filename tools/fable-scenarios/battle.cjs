// Drive battles with the autopilot and report results (+ per-play log with --log).
//   node tools/fable-qa.cjs --script tools/fable-scenarios/battle.cjs --team gnomes --kind match --side off --n 3 --shots --log
module.exports = async (h, args) => {
  const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
  const team = opt('team', 'gnome_scouts'), kind = opt('kind', 'drive'), side = opt('side', 'off'), venue = opt('venue', 'backyard');
  const n = parseInt(opt('n', '1'), 10);
  const shots = args.includes('--shots');
  const out = [];
  const plays = [];
  for (let i = 0; i < n; i++) {
    await h.open(`battle=${team}&kind=${kind}&side=${side}&venue=${venue}&auto=1${shots ? '&shadows' : ''}${opt('extra', '') ? '&' + opt('extra', '') : ''}`);
    let frames = 0, shot = 0;
    for (;;) {
      await h.step(40, 1 / 30);
      frames += 40;
      const st = await h.ev(() => { const g = window.__fable.G; const m = g.top(); return { done: !!g.debug.lastResult, res: g.debug.lastResult, phase: m && m.phase, sub: m && m.sub, t: m && m.playT, plays: g.debug.plays || [], err: window.__fable.errors() }; });
      if (st.err.length) { console.log('ERRORS', st.err.slice(0, 3)); break; }
      if (shots && st.phase === 'live' && shot < 6 && frames % 80 === 0) { await h.shot(`bt-${team}-${side}-${shot++}.png`); }
      if (st.done) { out.push(st.res); plays.push(...st.plays); break; }
      if (frames > 30 * 60 * 14) { console.log('TIMEOUT', JSON.stringify({ phase: st.phase, sub: st.sub, t: st.t })); break; }
    }
  }
  const wins = out.filter((r) => r && r.won).length;
  console.log(`RESULT ${team} ${kind} ${side}: ${wins}/${out.length} wins`, JSON.stringify(out.map((r) => r && { won: r.won, score: r.score, plays: r.stats && r.stats.plays, yards: r.stats && r.stats.yards })));
  const by = {};
  for (const p of plays) { const k = `${p.poss ? 'CPU' : 'YOU'} ${p.type}`; by[k] = by[k] || { n: 0, gain: 0 }; by[k].n++; by[k].gain += p.gain; }
  console.log('SUMMARY', Object.entries(by).map(([k, v]) => `${k}: ${v.n} (avg ${(v.gain / v.n).toFixed(1)})`).join(' | '));
  if (args.includes('--log')) for (const p of plays) console.log(`  ${p.poss ? 'CPU' : 'YOU'} d${p.down} ${p.play} vs ${p.def} → ${p.type} ${p.gain} (${p.t}s, snap ${p.snap})`);
};
