// QA: Mascot Mayhem.
//   node tools/fable-qa.cjs --script tools/fable-scenarios/mg-mascot.cjs [--stats]
// 1) intro card renders  2) stage geometry self-check  3) a full run driven through
// the real input layer (axis + jump presses)  4) a deliberately sloppy run
// 5) a hard-mode run on the built-in autopilot.  --stats also prints score spreads.
module.exports = async (h, args) => {
  const assert = (ok, msg) => { if (!ok) throw new Error(`ASSERT: ${msg}`); };

  // ---- 1) intro card
  await h.open('mg=mascot&dialog&shadows');
  await h.step(30);
  const card = await h.ev(() => !!document.querySelector('.mg-card'));
  assert(card, 'intro card should be showing');
  await h.shot('mg-mascot-intro.png');

  // ---- 2) geometry: every tile's centre must map back to itself; arms line up with their maths
  await h.open('mg=mascot&seed=3&shadows');
  await h.step(3);
  const geo = await h.ev(() => {
    const m = window.__fable.G.top();
    let bad = 0;
    for (const t of m.tiles) if (m.tileAt(t.cx, t.cz) !== t) bad++;
    return { tiles: m.tiles.length, bad, mascots: m.cs.length, state: m.state };
  });
  assert(geo.tiles === 30 && geo.bad === 0, `tile lookup mismatch ${JSON.stringify(geo)}`);
  assert(geo.mascots === 4 && geo.state === 'play', `bad start state ${JSON.stringify(geo)}`);

  // ---- helper: run a game to the end with an in-page pilot using REAL inputs
  const play = async (label, sloppy, shots) => {
    const taken = new Set();
    for (let guard = 0; guard < 80; guard++) {
      const st = await h.ev(async ([sloppy, wantShots]) => {
        const F = window.__fable, G = F.G;
        const m = G.top();
        if (!m) return { done: true };
        for (let i = 0; i < 240; i++) {
          const p = m.player;
          if (m.phase === 'play' && !p.out) {
            const r = Math.hypot(p.x, p.z) || 1;
            // hang around the inner ring, keep off bad tiles, step out of ball lanes
            let gx = (p.x / r) * 3.2, gz = (p.z / r) * 3.2;
            const here = m.tileAt(p.x, p.z);
            if (!sloppy && here && here.state !== 'ok') {
              let best = null, bd = 99;
              for (const t of m.tiles) { if (t.state !== 'ok' || t.ring > 1) continue; const d = Math.hypot(t.cx - p.x, t.cz - p.z); if (d < bd) { bd = d; best = t; } }
              if (best) { gx = best.cx; gz = best.cz; }
            }
            let dx = gx - p.x, dz = gz - p.z;
            const d = Math.hypot(dx, dz);
            if (d > 0.35) { dx /= d; dz /= d; } else { dx = dz = 0; }
            if (!sloppy) for (const b of m.balls) {
              const lat = (p.x - b.nx * b.off) * b.nx + (p.z - b.nz * b.off) * b.nz;
              if (Math.abs(lat) < 1.9) { const s = Math.sign(lat) || 1; dx += b.nx * s * 2; dz += b.nz * s * 2; }
            }
            if (sloppy) {
              // drifts around the middle ring, ignores warnings, corrects late when near the edge
              const a = Math.atan2(p.z, p.x) + 0.9, rr = 4.6 + Math.sin(m.roundT * 0.9) * 1.6;
              dx = Math.cos(a) * rr - p.x; dz = Math.sin(a) * rr - p.z;
            }
            const l = Math.hypot(dx, dz) || 1;
            F.axis(dx / Math.max(1, l), dz / Math.max(1, l));
            const tti = m._tti(m.low, p, true);
            const lead = sloppy ? 0.43 + Math.sin(m.roundT * 7) * 0.22 : 0.43;
            if (p.grounded && tti < lead && tti > lead - 0.2 && !(sloppy && Math.sin(m.roundT * 3.1) > 0.75)) F.press('a');
          } else F.axis(0, 0);
          await F.step(1);
          if (!G.top()) return { done: true };
          const ev = m.balls.some((b) => b.state === 'warn') ? 'ball' : m.cannonShot ? 'cannon' : m.tiles.some((t) => t.state === 'warn') && m.roundIdx === 2 ? 'shrink' : m.high.active && m.phase === 'play' && m.roundT > 3 ? 'high' : m.phase === 'outro' ? 'outro' : null;
          if (ev && wantShots.includes(ev)) return { done: false, ev, round: m.roundIdx, t: m.roundT };
        }
        return { done: false, round: m.roundIdx, t: m.roundT, score: m.score, phase: m.phase };
      }, [sloppy, shots.filter((s) => !taken.has(s))]);
      if (st.ev && !taken.has(st.ev)) {
        taken.add(st.ev);
        if (st.ev === 'cannon' || st.ev === 'ball') await h.step(16);      // let the warning marker show
        await h.shot(`mg-mascot-${label}-${st.ev}.png`);
      }
      if (st.done) break;
    }
    const res = await h.ev(() => window.__fable.G.debug.lastResult);
    assert(res && res.id === 'mascot', `${label}: no result`);
    assert(Number.isFinite(res.score) && res.score >= 0 && res.score <= 560, `${label}: silly score ${res.score}`);
    assert(res.extra && res.extra.places.length === 3, `${label}: should play three rounds`);
    console.log(`[${label}] score ${res.score} medal ${res.medal} places ${res.extra.places.join('/')} wins ${res.extra.wins}`);
    return res;
  };

  // ---- 3) competent run through the real input path (also proves jump + steering are wired)
  await h.open('mg=mascot&seed=5&shadows');
  await h.step(70);            // past the "ROUND 1" beat
  const before = await h.ev(() => { const p = window.__fable.G.top().player; return { x: p.x, z: p.z }; });
  await h.ev(async () => { const F = window.__fable; F.axis(-1, 0); await F.step(30); F.press('a'); await F.step(6); });
  const after = await h.ev(() => { const p = window.__fable.G.top().player; return { x: p.x, z: p.z, y: p.y }; });
  assert(after.x < before.x - 0.5, 'stick left should move the mascot left');
  assert(after.y > 0.3, 'jump button should lift the mascot');
  const good = await play('run', false, ['ball', 'cannon', 'high', 'shrink', 'outro']);

  // ---- 4) deliberately sloppy run: wanders, mistimes jumps
  await h.open('mg=mascot&seed=9');
  await h.step(3);
  const bad = await play('sloppy', true, []);

  // ---- 5) hard mode on the built-in autopilot
  await h.open('mg=mascot&hard=1&auto=1&seed=4');
  for (let i = 0; i < 60; i++) { await h.step(300); if (await h.ev(() => !window.__fable.G.top())) break; }
  const hard = await h.ev(() => window.__fable.G.debug.lastResult);
  assert(hard && hard.hard === true && hard.extra.places.length === 3, 'hard run should finish');
  console.log(`[hard] score ${hard.score} medal ${hard.medal} places ${hard.extra.places.join('/')}`);
  void good; void bad;

  // ---- optional: score spread for tuning the medal goals
  if (args.includes('--stats')) {
    await h.open('mg=mascot&auto=1&seed=1');
    for (const [auto, hardMode] of [[0.5, false], [1, false], [2, false], [1, true]]) {
      const sc = await h.ev(async ([auto, hardMode]) => {
        const F = window.__fable, G = F.G;
        const mod = await import('/fable/src/minigames/mascot.js');
        const out = [];
        for (let seed = 1; seed <= 14; seed++) {
          while (G.modes.length) G.pop();
          G.debug.lastResult = null;
          G.push(new mod.default(), { auto, seed, hard: hardMode, noLeave: true });
          let guard = 0;
          while (!G.debug.lastResult && guard++ < 400) await F.step(60);
          out.push((G.debug.lastResult || {}).score);
        }
        return out.sort((a, b) => a - b);
      }, [auto, hardMode]);
      console.log(`[stats] auto=${auto}${hardMode ? ' hard' : ''}: ${sc.join(',')}  median ${sc[7]}`);
    }
  }
};
