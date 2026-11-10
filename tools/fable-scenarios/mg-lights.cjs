// QA: Midnight Maintenance.
//   node tools/fable-qa.cjs --script tools/fable-scenarios/mg-lights.cjs [--stats]
// 1) intro card  2) scripted checks of the rules (repair, miss → noise, hide,
// getting caught → strike + respawn)  3) a careful run to the end driven through
// the real input layer  4) a sloppy run (runs everywhere, mashes the splice)
// 5) hard mode.  --stats prints score spreads over many seeds.

// Runs inside the page: one frame of "player" decisions using only public input calls.
const PILOT = `
window.__mlPilot = (m, F, sloppy) => {
  const p = m.p, w = m.w, S = (window.__mlS = window.__mlS || {});
  if (S.game !== m) { for (const k of Object.keys(S)) delete S[k]; S.game = m; S.t = 0; S.px = p.x; S.pz = p.z; }
  S.t += 1 / 60;
  const idle = () => { F.axis(0, 0); F.hold('a', false); F.hold('b', false); };
  if (m.ending || p.caughtT > 0 || !m.playing) { idle(); return; }
  const R = m.cfg.range;
  const dW = Math.hypot(w.x - p.x, w.z - p.z) || 0.01;
  const ang = Math.atan2(p.x - w.x, p.z - w.z) - w.yaw;
  const aimed = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));          // how squarely his lantern points at us
  const go = (tx, tz, run) => {
    let dx = tx - p.x, dz = tz - p.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    // unstick: if we are not getting anywhere, sidestep for a moment
    if (S.t - (S.chk || 0) > 0.5) { const mv = Math.hypot(p.x - S.px, p.z - S.pz); S.px = p.x; S.pz = p.z; S.chk = S.t; if (mv < 0.5 && d > 1.2) { S.side = (S.side || 1) * -1; S.sideT = S.t + 0.7; } }
    if (S.t < (S.sideT || 0)) { const sx = -dz * S.side, sz = dx * S.side; dx = dx * 0.3 + sx; dz = dz * 0.3 + sz; }
    F.axis(dx, dz); F.hold('b', !!run);
    return d;
  };
  const hideSpot = (maxMine) => {
    let best = null, bd = 1e9;
    for (const h of m.hides) { const mine = Math.hypot(h.x - p.x, h.z - p.z), his = Math.hypot(h.x - w.x, h.z - w.z); if (mine < his - 4.5 && mine < bd && mine < maxMine) { bd = mine; best = h; } }
    return best;
  };
  if (sloppy) {
    // charges at the nearest panel at a run, mashes the splice button, never hides
    if (p.hidden) { F.press('a'); return; }
    const t = m.towers.filter((k) => !k.fixed).sort((a, b) => Math.hypot(a.px - p.x, a.pz - p.z) - Math.hypot(b.px - p.x, b.pz - p.z))[0];
    if (m.repair) { idle(); if (Math.floor(S.t * 60) % 22 === 0) F.press('a'); return; }
    if (!t) { idle(); return; }
    const d = go(t.px, t.pz + 0.95, true);
    F.hold('a', d < 1.3);
    return;
  }
  // ---- choose a panel: close to us, far from the lantern; drop one he is standing over
  const clear = (t) => Math.hypot(t.px - w.x, t.pz - w.z) > R + 3.5;
  if (!S.target || S.target.fixed || S.t > (S.pickT || 0) || (!clear(S.target) && !m.repair)) {
    S.pickT = S.t + 4;
    let best = null, bs = 1e9;
    for (const t of m.towers) { if (t.fixed) continue; const sc = Math.hypot(t.px - p.x, t.pz - p.z) - 0.9 * Math.hypot(t.px - w.x, t.pz - w.z) - (t === S.target ? 5 : 0) + (clear(t) ? 0 : 40); if (sc < bs) { bs = sc; best = t; } }
    S.target = best;
  }
  const t = S.target;
  if (p.hidden) {
    idle();
    const calm = w.state === 'patrol' || w.state === 'look' || w.state === 'admire';
    if (p.hidT > 1.5 && calm && dW > R + 4 && t && (clear(t) || p.hidT > 30)) F.press('a');
    return;
  }
  if (m.repair) {
    const r = m.repair;
    idle();
    if (w.state === 'chase' || w.state === 'alert' || (dW < R + 3 && aimed < m.cfg.half + 0.6) || (w.state === 'investigate' && Math.hypot(w.tx - p.x, w.tz - p.z) < 6 && dW < R + 6)) { F.axis((p.x - w.x) / dW, (p.z - w.z) / dW); return; }
    if (r.armed && r.lock <= 0 && Math.abs(r.x - r.zone) < r.width / 2 - 0.035) F.press('a');
    return;
  }
  F.hold('a', false);
  if (w.state === 'chase') {
    const h = hideSpot(22);
    if (h) { const d = go(h.x, h.z, true); if (d < 1.1) F.press('a'); } else go(p.x + ((p.x - w.x) / dW) * 6, p.z + ((p.z - w.z) / dW) * 6, true);
    return;
  }
  if (w.state === 'alert' || (dW < R + 3 && aimed < m.cfg.half + 0.55)) {
    // slip out of the beam sideways, quietly
    const fx = Math.sin(w.yaw), fz = Math.cos(w.yaw);
    const side = Math.sign((p.x - w.x) * fz - (p.z - w.z) * fx) || 1;
    go(p.x + fz * side * 4 + ((p.x - w.x) / dW) * 2.5, p.z - fx * side * 4 + ((p.z - w.z) / dW) * 2.5, false);
    return;
  }
  if (w.state === 'investigate' && Math.hypot(w.tx - p.x, w.tz - p.z) < 7 && dW < R + 8) {
    // he is coming to look at something we did: be somewhere else
    const h = hideSpot(9);
    if (h) { const d = go(h.x, h.z, false); if (d < 1.1) F.press('a'); } else go(p.x + ((p.x - w.x) / dW) * 6, p.z + ((p.z - w.z) / dW) * 6, false);
    return;
  }
  if (!t) { idle(); return; }
  if (!clear(t)) {
    // every panel left is being watched: get out of sight and wait for him to move on
    const h = hideSpot(14);
    if (h) { const d = go(h.x, h.z, false); if (d < 1.1) F.press('a'); } else if (dW < R + 5) go(p.x + ((p.x - w.x) / dW) * 6, p.z + ((p.z - w.z) / dW) * 6, false); else idle();
    return;
  }
  const d = go(t.px, t.pz + 0.95, false);
  if (d < 1.25) { F.axis(0, 0); F.hold('a', true); }
};`;

module.exports = async (h, args) => {
  const assert = (ok, msg) => { if (!ok) throw new Error(`ASSERT: ${msg}`); };

  // ---- 1) intro card
  await h.open('mg=lights&dialog&shadows');
  await h.step(30);
  assert(await h.ev(() => !!document.querySelector('.mg-card')), 'intro card should be showing');
  await h.shot('mg-lights-intro.png');

  // ---- 2) rules, step by step (Wick is parked out of the way first)
  await h.open('mg=lights&seed=2&shadows');
  await h.step(5);
  const rules = await h.ev(async () => {
    const F = window.__fable, m = F.G.top();
    const out = {};
    const p = m.p, w = m.w;
    const park = () => { w.x = 50; w.z = 12; w.state = 'look'; w.t = 999; w.lookYaw = 0; w.yaw = 0; };
    park();
    // walk to the SW panel using the stick
    const t = m.towers.find((k) => k.id === 'SW');
    p.x = t.px + 3; p.z = t.pz + 1;
    for (let i = 0; i < 200 && Math.hypot(p.x - t.px, p.z - (t.pz + 0.95)) > 1.1; i++) { const dx = t.px - p.x, dz = t.pz + 0.95 - p.z, d = Math.hypot(dx, dz); F.axis(dx / d, dz / d); await F.step(1); }
    F.axis(0, 0);
    out.reached = Math.hypot(p.x - t.px, p.z - (t.pz + 0.95)) < 1.3;
    // hold to open
    F.hold('a', true); await F.step(40); F.hold('a', false); await F.step(2);
    out.opened = !!m.repair;
    // deliberate miss → buzz + noise
    const r = m.repair;
    for (let i = 0; i < 300 && Math.abs(r.x - r.zone) < r.width / 2 + 0.1; i++) await F.step(1);
    const noises = m.stats.noises;
    F.press('a'); await F.step(2);
    out.missCounted = m.stats.misses === 1 && m.stats.noises === noises + 1 && r.beat === 0;
    park();
    await F.step(30);
    // three good splices
    for (let n = 0; n < 3; n++) {
      for (let i = 0; i < 400; i++) { const q = m.repair; if (!q) break; if (q.lock <= 0 && Math.abs(q.x - q.zone) < q.width / 2 - 0.03) { F.press('a'); await F.step(2); break; } await F.step(1); }
    }
    await F.step(5);
    out.fixed = t.fixed && m.fixed === 1 && t.light.visible;
    park();
    await F.step(90);
    out.lit = t.light.intensity > 30 && t.on.visible;
    // hide in the nearby locker
    const hsp = m.hides[0];
    p.x = hsp.x; p.z = hsp.z + 0.3;
    await F.step(2);
    F.press('a'); await F.step(3);
    out.hidden = p.hidden === hsp && !m._sees();
    await F.step(30);
    F.press('a'); await F.step(3);
    out.unhidden = !p.hidden;
    // lockers block his line of sight
    w.state = 'patrol'; w.x = p.x; w.z = p.z - 6; w.yaw = 0; w.wp = 4;
    await F.step(2);
    out.cover = !m._sees() && w.state === 'patrol';
    // get caught on purpose: stand in the beam out on the grass
    p.x = 20; p.z = 28; w.state = 'patrol'; w.x = 20; w.z = 22; w.yaw = 0; w.wp = 4;
    let caught = false;
    for (let i = 0; i < 600; i++) { await F.step(1); if (m.strikes === 1) { caught = true; break; } }
    out.caught = caught && m.stats.alerts >= 1;
    await F.step(130);
    out.respawned = Math.hypot(p.x - 30, p.z - 38.6) < 0.5 && p.caughtT <= 0;
    out.score = m._score();
    return out;
  });
  console.log('[rules]', JSON.stringify(rules));
  for (const k of ['reached', 'opened', 'missCounted', 'fixed', 'lit', 'hidden', 'unhidden', 'cover', 'caught', 'respawned']) assert(rules[k], `rule check failed: ${k}`);
  assert(rules.score === 60, `one light and one strike should be 100 - 40 = 60, got ${rules.score}`);

  // ---- helper: full run with the pilot; takes screenshots on interesting events
  const play = async (label, query, sloppy, shots) => {
    await h.open(query);
    await h.step(3);
    await h.ev(PILOT);
    const taken = new Set();
    for (let guard = 0; guard < 200; guard++) {
      const st = await h.ev(async ([sloppy, want]) => {
        const F = window.__fable, G = F.G, m = G.top();
        if (!m) return { done: true };
        for (let i = 0; i < 300; i++) {
          window.__mlPilot(m, F, sloppy);
          await F.step(1);
          if (!G.top()) return { done: true };
          const ev = m.repair && m.repair.time > 0.6 ? 'splice' : m.p.hidden && m.p.hidT > 0.5 ? 'hide' : m.w.state === 'chase' ? 'chase' : m.fixed === 2 && m.towers.some((t) => t.fixed && t.glow > 0.95) ? 'lit' : m.ending === 'win' && m.endT < 1.6 ? 'win' : null;
          if (ev && want.includes(ev)) return { ev };
          if (m.elapsed > 420) { m.strikes = 3; m.ending = 'out'; m.endT = 0.1; }     // safety net
        }
        return { t: m.elapsed, fixed: m.fixed, strikes: m.strikes };
      }, [sloppy, shots.filter((s) => !taken.has(s))]);
      if (st.ev) { taken.add(st.ev); await h.step(2); await h.shot(`mg-lights-${label}-${st.ev}.png`); }
      if (st.done) break;
    }
    const res = await h.ev(() => window.__fable.G.debug.lastResult);
    assert(res && res.id === 'lights', `${label}: no result`);
    assert(Number.isFinite(res.score) && res.score >= 0 && res.score <= 650, `${label}: silly score ${res.score}`);
    console.log(`[${label}] score ${res.score} medal ${res.medal} fixed ${res.extra.fixed}/${res.extra.total} strikes ${res.extra.strikes} time ${Math.round(res.extra.time)}s`);
    return res;
  };

  // ---- 3) careful run, 4) sloppy run, 5) hard mode
  const good = await play('run', 'mg=lights&seed=5&shadows', false, ['splice', 'lit', 'hide', 'chase', 'win']);
  assert(good.extra.fixed === good.extra.total, 'the careful pilot should finish every light');
  const bad = await play('sloppy', 'mg=lights&seed=6', true, []);
  assert(bad.score <= good.score, 'sloppy should not beat careful');
  const hard = await play('hard', 'mg=lights&hard=1&seed=7&shadows', false, ['chase', 'lit']);
  assert(hard.extra.total === 7 && hard.hard === true, 'hard mode has seven panels');

  // ---- optional: score spread for tuning the medal goals
  if (args.includes('--stats')) {
    await h.open('mg=lights&seed=1');
    await h.ev(PILOT);
    for (const [sloppy, hardMode] of [[false, false], [true, false], [false, true], [true, true]]) {
      const rows = await h.ev(async ([sloppy, hardMode]) => {
        const F = window.__fable, G = F.G;
        const mod = await import('/fable/src/minigames/lights.js');
        const out = [];
        for (let seed = 1; seed <= 12; seed++) {
          while (G.modes.length) G.pop();
          G.debug.lastResult = null;
          const m = new mod.default();
          G.push(m, { seed, hard: hardMode, noLeave: true });
          let guard = 0;
          while (!G.debug.lastResult && guard++ < 40000) { window.__mlPilot(m, F, sloppy); await F.step(1); if (m.elapsed > 420) { m.strikes = 3; m.ending = 'out'; m.endT = 0.1; } }
          await F.step(4);                       // let the finished game leave before the next one starts
          const r = G.debug.lastResult || { extra: {} };
          out.push(`${r.score}(${r.extra.fixed}/${r.extra.total},x${r.extra.strikes},${Math.round(r.extra.time)}s)`);
        }
        return out;
      }, [sloppy, hardMode]);
      console.log(`[stats] ${sloppy ? 'sloppy' : 'careful'}${hardMode ? ' hard' : ''}: ${rows.join(' ')}`);
    }
  }
};
