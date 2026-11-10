// Scripted run through chapters 2-4 and the finale. Battles are skipped
// (G.debug.autoWin) — this checks the story wiring, flags, areas and recruits.
module.exports = async (h, args) => {
  await h.open('area=hollow&preset=ch2');
  const ev = h.ev;
  await ev(() => { const g = window.__fable.G; g.debug.autoWin = true; g.hooks.minigame = async (id) => { if (id === 'mascot') { g.S.best.mascot = { normal: 500, medal: 2 }; if (!g.S.roster.includes('cheese')) { g.S.roster.push('cheese'); } } return { won: true, medal: 2, score: 1 }; }; });
  const st = () => ev(() => { const g = window.__fable.G; const S = g.S; return { mode: g.top() && g.top().name, area: S.area, roster: S.roster.join(','), chapter: S.chapter, wins: S.wins, coins: S.coins, parts: S.parts, town: S.town, err: window.__fable.errors().slice(0, 3), q: Object.entries(S.quests).filter(([, v]) => !v.done).map(([k, v]) => `${k}:${v.stage}`).join(' ') }; });
  const act = async (x, z, steps = 40) => { await ev(([a, b]) => window.__fable.G.world.tp(a, b), [x, z]); await h.step(6); await ev(() => window.__fable.press('a')); await h.step(steps); };
  const go = async (area, x, z) => { await ev(([a, b, c]) => window.__fable.G.world.goto(a, b, c), [area, x, z]); await h.step(30); };
  const log = async (label) => { const s = await st(); console.log(label, JSON.stringify(s)); if (s.err.length) throw new Error('game error: ' + s.err[0]); return s; };
  await h.step(20);
  // ---- Harvest Fairgrounds
  await go('fair', 8, 31); await h.step(40);
  await log('fair arrive');
  await act(14.6, 44.8, 60);            // Ringmaster → mascot (stubbed) → Big Cheese
  await log('after mascot');
  await act(90, 33.4, 80);              // Old Stitch
  await log('after haymakers');
  await h.shot('ch-fair.png');
  // ---- Frostbite Falls
  await go('frost', 9, 47); await h.step(40);
  await ev(() => { const w = window.__fable.G.world; w.tp(66, 18.6); w.leader.ch.face(0); w.throwBall(); }); await h.step(150);
  await log('after slush');
  await ev(() => { const w = window.__fable.G.world; w.tp(53.4, 14); w.leader.ch.face(0); w.throwBall(); }); await h.step(100);
  await act(79, 12, 80);                // Flurry
  await log('after flurries');
  await h.shot('ch-frost.png');
  // ---- Neon Boardwalk
  await go('neon', 7, 25); await h.step(40);
  await act(22, 27.6, 40); await act(58, 31.6, 40); await act(40, 41.6, 60);   // chase Sal
  await log('after sal');
  await ev(() => { const w = window.__fable.G.world; w.tp(40, 38); w.leader.ch.face(0); w.throwBall(); }); await h.step(100);   // breaker 1
  await ev(() => { const g = window.__fable.G; g.S.flags.neon_b2 = true; g.S.flags.neon_b3 = true; g.world.rebuild(); }); await h.step(10);
  await act(88, 14.2, 80);              // the dome
  await log('after buzzers');
  await h.shot('ch-neon.png');
  // ---- home: finish the stadium, wait for night, play the Midnight Bowl
  await ev(() => { const g = window.__fable.G; g.S.coins = 2000; g.S.parts = 60; g.S.town.stadium = 2; g.S.tod = 'night'; });
  await go('stadium', 30, 37); await h.step(30);
  await h.shot('ch-bowl-before.png');
  await act(30, 21.6, 200);
  const end = await log('after bowl');
  await h.shot('ch-bowl-after.png');
  if (!end.wins.graveyard) throw new Error('finale did not complete');
  console.log('CHAPTERS OK');
};
