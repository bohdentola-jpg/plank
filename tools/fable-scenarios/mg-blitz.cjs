// Backyard Blitz (2-on-2 on the battle engine) on autopilot.
module.exports = async (h, args) => {
  for (const hard of [false, true]) {
    await h.open(`mg=blitz&auto=1&shadows${hard ? '&hard=1' : ''}`);
    let shot = 0;
    for (let i = 0; i < 400; i++) {
      await h.step(40, 1 / 30);
      const st = await h.ev(() => { const g = window.__fable.G; const m = g.top(); return { done: !!g.debug.lastResult && g.debug.lastResult.id === 'blitz', res: g.debug.lastResult, mode: m && m.name, phase: m && m.phase, score: m && m.score, err: window.__fable.errors().slice(0, 2) }; });
      if (st.err.length) throw new Error(st.err[0]);
      if (st.mode === 'battle' && st.phase === 'live' && shot < 2 && i % 3 === 0) await h.shot(`mg-blitz-${hard ? 'h' : 'n'}${shot++}.png`);
      if (st.done) { console.log(hard ? 'hard' : 'normal', JSON.stringify({ score: st.res.score, medal: st.res.medal, won: st.res.won, detail: st.res.detail })); break; }
      if (i === 399) throw new Error('blitz timed out: ' + JSON.stringify(st));
    }
  }
};
