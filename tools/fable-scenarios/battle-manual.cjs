// Plays a match through the REAL control path (no autopilot): an in-page bot
// presses the same virtual buttons a player would — picks plays in the huddle,
// times the snap, reads and throws, times catches, jukes, dives, kicks.
//   node tools/fable-qa.cjs --script tools/fable-scenarios/battle-manual.cjs --team gnomes --n 2 [--skill 0.7]
module.exports = async (h, args) => {
  const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
  const team = opt('team', 'gnomes'), n = parseInt(opt('n', '1'), 10), skill = parseFloat(opt('skill', '0.7'));
  const out = [];
  const plays = [];
  for (let i = 0; i < n; i++) {
    await h.open(`battle=${team}&kind=${opt('kind', 'match')}&side=${opt('side', 'off')}&venue=${opt('venue', 'backyard')}&drives=${opt('drives', '2')}&preset=${opt('preset', 'team')}`);
    await h.ev((sk) => {
      const F = window.__fable, G = F.G;
      const st = { calls: {}, t: 0 };
      const bot = () => {
        const b = G.top();
        if (!b || b.name !== 'battle') return;
        st.t++;
        const count = (k) => { st.calls[k] = (st.calls[k] || 0) + 1; };
        // panels (results etc.)
        const hud = document.querySelector('.huddle');
        if (hud) {
          if (st.t % 20) return;
          const fg = [...hud.querySelectorAll('.btn')].find((x) => /Field goal/.test(x.textContent) && !x.classList.contains('disabled'));
          const punt = [...hud.querySelectorAll('.btn')].find((x) => /Punt/.test(x.textContent));
          const chips = [...hud.querySelectorAll('.abchip:not(.disabled):not(.on)')];
          if (chips.length && Math.random() < 0.3) { chips[Math.floor(Math.random() * chips.length)].click(); count('ability'); return; }
          if (fg && b.kickDist() < 38) { fg.click(); count('fg'); return; }
          if (punt && b.los < 22) { punt.click(); count('punt'); return; }
          const cards = hud.querySelectorAll('.play');
          F.press(`t${1 + Math.floor(Math.random() * Math.min(5, cards.length))}`); count('play');
          return;
        }
        // one timing error per play, like a person: sk 1 = frame perfect, sk 0.4 = sloppy
        if (st.play !== b.stats.plays) { st.play = b.stats.plays; st.snapErr = (Math.random() - 0.5) * (1 - sk) * 1.1; st.catchErr = (Math.random() - 0.5) * 2 * (1 - sk) * 0.42; st.pickErr = (Math.random() - 0.5) * 2 * (1 - sk) * 0.5; }
        if (b.phase === 'snap' && b.snapBeat !== undefined && b.snapPress === null) { if (b.snapBeat >= 3 - 0.04 + st.snapErr) { F.press('a'); count('snap'); } return; }
        if (b.phase === 'kick' && b.hudUI.kickEl) {
          const nd = b.hudUI.kNeedle.style.left; const z = b.hudUI.kZone.style;
          const pos = parseFloat((nd.match(/([\d.]+)%/) || [0, 50])[1]) / 100, zc = (parseFloat(z.left) + parseFloat(z.width) / 2) / 100;
          if (Math.abs(pos - zc) < 0.04 + (1 - sk) * 0.1) { F.press('a'); count('kick'); }
          return;
        }
        if (b.phase !== 'live' || b.result) { F.axis(0, 0); return; }
        const u = b.userEnt; if (!u) return;
        const toScreen = (dx, dz) => { const m = Math.hypot(dx, dz) || 1; F.axis((b.flip ? -dx : dx) / m, (b.flip ? -dz : dz) / m); };
        if (b.userMode === 'qb' && b.sub === 'pocket') {
          toScreen(b.playT < 0.6 ? -1 : 0, 0); if (b.playT >= 0.6) F.axis(0, 0);
          if (b.playT > 1.0 + (1 - sk)) {
            let best = null, bo = -1;
            for (const r of b.off) { if (r.keyIdx < 0) continue; const o = b.openness(r); if (o > bo) { bo = o; best = r; } }
            if (best && (bo > 2.2 || b.playT > 2.6)) { F.press(`t${best.keyIdx + 1}`); count('throw'); }
          }
        } else if (b.userMode === 'air') {
          F.axis(0, 0);
          if (b.catchPress === null && b.ball.t >= b.ball.T - 0.02 + st.catchErr) { F.press('a'); count('catch'); }
        } else if (b.userMode === 'carrier') {
          let fz = 0;
          for (const d of b.opp(u)) {
            if (d.downT > 0) continue;
            const dx = d.x - u.x, dz = d.z - u.z; const dd = Math.hypot(dx, dz);
            if (dd < 6 && dx * b.goalDir() > -1) fz -= (dz / (dd || 1)) * 2 / (dd + 0.5);
            // decide once per tackle attempt whether you saw it coming
            if (d.wind > 0) {
              if (d._seen !== d.windTarget) { d._seen = d.windTarget; d._dodge = Math.random() < sk * 0.72; }
              if (d._dodge && d.wind < 0.13) { d._dodge = false; F.press(Math.random() < 0.7 ? 'a' : 'b'); count('dodge'); }
            } else d._seen = null;
          }
          if (Math.abs(u.z) > b.HW - 2) fz -= Math.sign(u.z) * 1.5;
          toScreen(b.goalDir(), Math.max(-1, Math.min(1, fz)));
        } else if (b.userMode === 'defender') {
          const c = b.carrier;
          if (b.sub === 'air' && b.ball.to) {
            toScreen(b.ball.to.x - u.x, b.ball.to.z - u.z);
            if (b.pickPress === null && b.ball.t >= b.ball.T - 0.02 + st.pickErr) { F.press('a'); count('pick'); }
          } else if (c) {
            const d = Math.hypot(c.x - u.x, c.z - u.z);
            toScreen(c.x + c.vx * 0.25 - u.x, c.z + c.vz * 0.25 - u.z);
            if (d < 2.2 && u.dive <= 0 && u.downT <= 0) { F.press('a'); count('dive'); } else if ((d > 8 || u.downT > 0) && st.t % 30 === 0) { F.press('y'); count('switch'); }
          } else { const q = b.ball.holder; if (q) toScreen(q.x - u.x, q.z - u.z); if (q && Math.hypot(q.x - u.x, q.z - u.z) < 2.2 && u.dive <= 0) { F.press('a'); count('rushdive'); } }
        }
      };
      const orig = G.tick.bind(G);
      G.tick = (dt) => { try { bot(); } catch (e) { G.debug.log.push('BOT ' + e.stack); } orig(dt); };
      window.__botStats = st;
    }, skill);
    let done = null;
    for (let k = 0; k < 500; k++) {
      await h.step(60, 1 / 30);
      const s = await h.ev(() => ({ res: window.__fable.G.debug.lastResult, err: window.__fable.errors().slice(0, 3), calls: window.__botStats.calls, phase: window.__fable.G.top() && window.__fable.G.top().phase }));
      if (s.err.length) throw new Error(s.err[0]);
      if (s.res) { done = s; break; }
      if (k === 499) throw new Error('manual battle timed out in phase ' + s.phase);
    }
    out.push(done);
    plays.push(...(await h.ev(() => window.__fable.G.debug.plays || [])));
    console.log(`game ${i + 1}: ${done.res.won ? 'WON ' : 'lost'} ${done.res.score.join('-')}  ${JSON.stringify(done.res.stats)}  inputs ${JSON.stringify(done.calls)}`);
  }
  // where the yards and points came from
  const by = {};
  for (const p of plays) { const k = `${p.poss ? 'CPU' : 'YOU'} ${p.type}${p.why ? ':' + p.why.slice(0, 14) : ''}`; by[k] = by[k] || { n: 0, gain: 0 }; by[k].n++; by[k].gain += p.gain; }
  console.log('PLAYS', Object.entries(by).sort().map(([k, v]) => `${k} ×${v.n}${v.gain ? ` (avg ${(v.gain / v.n).toFixed(1)})` : ''}`).join(' | '));
  const pts = out.reduce((a, r) => [a[0] + r.res.score[0], a[1] + r.res.score[1]], [0, 0]);
  console.log(`MANUAL ${team}: ${out.filter((r) => r.res.won).length}/${out.length} wins at skill ${skill} · avg score ${(pts[0] / out.length).toFixed(1)}-${(pts[1] / out.length).toFixed(1)}`);
};
