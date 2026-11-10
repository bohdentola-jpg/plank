// QA for Field Goal Golf.
//   node tools/fable-qa.cjs --script tools/fable-scenarios/mg-golf.cjs [--shots] [--only casual|skilled|planner|hard|card]
// Plays whole rounds three ways and checks the result the shell hands back:
//   casual  — drives the REAL inputs (stick to aim, ▲▼ for the kick, two presses for the meter):
//             works the ball to the open side of the uprights, sloppy aim and power
//   skilled — takes the game's own best-kick search, then adds a human amount of wobble
//   planner — takes the best kick exactly (near-perfect golf; a floor for what is possible)
module.exports = async (h, args) => {
  const only = (() => { const i = args.indexOf('--only'); return i >= 0 ? args[i + 1] : null; })();
  const shots = args.includes('--shots');
  const want = (k) => !only || only === k;
  const assert = (ok, msg) => { if (!ok) throw new Error(`ASSERT: ${msg}`); };

  /**
   * Run (or continue) a round in the page. Stops early when it reaches a hole listed in
   * `pauseAt` (before its first kick) or just after kick number `pauseKick` so we can screenshot.
   */
  const drive = (cfg) => h.ev(async (cfg) => {
    const F = window.__fable, G = F.G;
    const st = window.__golfBot || (window.__golfBot = { seed: cfg.seed, paused: {}, kicks: 0, log: [], slowest: 0 });
    const rnd = () => { st.seed = (st.seed * 16807) % 2147483647; return st.seed / 2147483647; };
    const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const REACH = [11.6, 19.2, 15];
    let frames = 0, plan = null;
    while (!G.debug.lastResult && frames < 120000) {
      const m = G.top();
      if (!m) break;
      if (m.phase === 'aim') {
        if ((cfg.pauseAt || []).includes(m.holeIndex) && m.strokes === 0 && !st.paused[m.holeIndex]) { st.paused[m.holeIndex] = 1; F.axis(0, 0); return { pause: 'hole', hole: m.holeIndex }; }
        if (cfg.mode !== 'casual') {
          const t0 = performance.now();
          const p = m.plan();
          st.slowest = Math.max(st.slowest, performance.now() - t0);
          let aim = p.aim, power = p.power;
          if (cfg.mode === 'skilled') { aim += (rnd() - 0.5) * 2 * cfg.aimErr; power = Math.max(0, Math.min(1, power + (rnd() - 0.5) * 2 * cfg.powErr)); }
          st.log.push([m.holeIndex + 1, m.strokes + 1, p.lofti, +power.toFixed(2), p.made ? 1 : 0]);
          m.debugKick(aim, p.lofti, power);
          st.kicks++;
          await F.step(1); frames++;
          if (cfg.pauseKick && st.kicks === cfg.pauseKick) { await F.step(cfg.pauseFrames || 30); return { pause: 'kick' }; }
          continue;
        }
        if (!plan) {
          const g = m.hole.goal, lie = m.lie;
          const dx = g.x - lie.x, dz = g.z - lie.z, d = Math.hypot(dx, dz);
          const front = Math.abs(dx * g.nx + dz * g.nz) / Math.max(d, 1e-6);
          let tx = g.x, tz = g.z, through = true;
          if (front < 0.72) {                               // not in front of the opening: work round to it
            const side = (lie.x - g.x) * g.nx + (lie.z - g.z) * g.nz >= 0 ? 1 : -1;
            tx = g.x + g.nx * 7 * side; tz = g.z + g.nz * 7 * side; through = false;
            tx = Math.max(2, Math.min(m.hole.L - 2, tx)); tz = Math.max(2, Math.min(m.hole.D - 2, tz));
          }
          const td = Math.hypot(tx - lie.x, tz - lie.z) + (through ? 3 : 0);
          const loft = td < 9 ? 0 : 1;
          const f = Math.sqrt(Math.min(1, td / REACH[loft]));
          plan = { aim: Math.atan2(tz - lie.z, tx - lie.x) + (rnd() - 0.5) * 2 * cfg.aimErr, loft, power: Math.max(0.03, Math.min(1, (f - 0.2) / 0.8 + (rnd() - 0.5) * 2 * cfg.powErr)) };
        }
        if (m.loft !== plan.loft) { F.axis(0, 0); F.hold(m.loft < plan.loft ? 'up' : 'down', true); await F.step(1); F.hold('up', false); F.hold('down', false); await F.step(1); frames += 2; continue; }
        const da = wrap(plan.aim - m.aim);
        if (Math.abs(da) > 0.012) { F.axis(da > 0 ? 1 : -1, 0); F.hold('b', Math.abs(da) < 0.1); }
        else { F.axis(0, 0); F.hold('b', false); F.press('a'); }
      } else if (m.phase === 'power') {
        F.axis(0, 0); F.hold('b', false);
        // the press lands next frame, so lead it by one frame of meter travel
        if (plan && m.meterDir > 0 && m.meter + 1.15 / 60 >= plan.power) {
          F.press('a'); plan = null; st.kicks++;
          if (cfg.pauseKick && st.kicks === cfg.pauseKick) { await F.step(cfg.pauseFrames || 34); return { pause: 'kick' }; }
        }
      } else { F.axis(0, 0); F.hold('b', false); }
      await F.step(1);
      frames++;
    }
    const m = G.top();
    const out = { result: G.debug.lastResult || null, phase: m ? m.phase : null, hole: m ? m.holeIndex : null, frames, kicks: st.kicks, slowestPlanMs: Math.round(st.slowest), log: st.log };
    window.__golfBot = null;
    return out;
  }, cfg);

  async function round(query, cfg, tag) {
    await h.open(query);
    await h.step(4);
    for (let guard = 0; guard < 40; guard++) {
      const r = await drive(cfg);
      if (r.pause === 'hole') { await h.step(24); await h.shot(`mg-golf-${tag}-hole${r.hole + 1}.png`); continue; }
      if (r.pause === 'kick') { await h.shot(`mg-golf-${tag}-kick.png`); continue; }
      return r;
    }
    throw new Error('round never finished');
  }
  const brief = (r) => ({ score: r.result.score, medal: r.result.medal, card: r.result.extra.card, kicks: r.kicks });
  const checkResult = (r, what) => {
    assert(r.result, `${what}: round did not finish (phase ${r.phase}, hole ${r.hole}, frames ${r.frames})`);
    const x = r.result;
    assert(x.id === 'golf' && Number.isInteger(x.score) && x.score >= 6 && x.score <= 42, `${what}: bad result ${JSON.stringify(x)}`);
    assert(x.extra && x.extra.card.length === 6 && x.extra.card.reduce((a, b) => a + b, 0) === x.score, `${what}: card does not add up`);
    assert(x.medal >= 0 && x.medal <= 3, `${what}: bad medal`);
  };

  const report = {};
  if (want('casual')) {
    report.casual = [];
    for (const [seed, aimErr, powErr] of [[11, 0.07, 0.12], [23, 0.07, 0.12], [37, 0.04, 0.07], [51, 0.1, 0.16], [77, 0.07, 0.12]]) {
      const first = seed === 11 && shots;
      const r = await round(`mg=golf${first ? '&shadows' : ''}`, { mode: 'casual', seed, aimErr, powErr, pauseKick: first ? 1 : 0, pauseFrames: 30 }, 'casual');
      checkResult(r, `casual ${seed}`);
      report.casual.push({ seed, aimErr, ...brief(r), frames: r.frames });
    }
  }
  if (want('skilled')) {
    report.skilled = [];
    for (const [seed, aimErr, powErr] of [[3, 0.03, 0.05], [8, 0.03, 0.05], [15, 0.03, 0.05], [29, 0.05, 0.08], [42, 0.05, 0.08]]) {
      const r = await round('mg=golf', { mode: 'skilled', seed, aimErr, powErr }, 'skilled');
      checkResult(r, `skilled ${seed}`);
      report.skilled.push({ seed, aimErr, ...brief(r) });
    }
  }
  if (want('planner')) {
    const r = await round(`mg=golf${shots ? '&shadows' : ''}`, { mode: 'planner', seed: 1, pauseAt: shots ? [0, 1, 2, 3, 4, 5] : [] }, 'n');
    checkResult(r, 'planner');
    report.planner = { ...brief(r), slowestPlanMs: r.slowestPlanMs, log: r.log.map((l) => l.join('/')).join(' ') };
  }
  if (want('hard')) {
    const r = await round(`mg=golf&hard=1${shots ? '&shadows' : ''}`, { mode: 'planner', seed: 1, pauseAt: shots ? [0, 1, 2, 3, 4, 5] : [] }, 'h');
    checkResult(r, 'hard planner');
    assert(r.result.hard === true, 'hard flag missing from result');
    report.hardPlanner = { ...brief(r), log: r.log.map((l) => l.join('/')).join(' ') };
    report.hardSkilled = [];
    for (const seed of [4, 9, 21]) {
      const s = await round('mg=golf&hard=1', { mode: 'skilled', seed, aimErr: 0.03, powErr: 0.05 }, 'hs');
      checkResult(s, `hard skilled ${seed}`);
      report.hardSkilled.push({ seed, ...brief(s) });
    }
    report.hardCasual = [];
    for (const seed of [5, 9]) {
      const c = await round('mg=golf&hard=1', { mode: 'casual', seed, aimErr: 0.07, powErr: 0.12 }, 'hc');
      checkResult(c, `hard casual ${seed}`);
      report.hardCasual.push({ seed, ...brief(c) });
    }
  }
  if (want('card')) {
    // the real intro card, then make sure "Play!" actually starts the game
    await h.open('mg=golf&dialog&shadows');
    await h.step(10);
    await h.shot('mg-golf-card.png');
    await h.press('a');
    await h.step(10);
    const st = await h.ev(() => { const m = window.__fable.G.top(); return { state: m.state, phase: m.phase }; });
    assert(st.state === 'play', `intro card did not start the game: ${JSON.stringify(st)}`);
    // by hand: start the meter, cancel it, start again, kick
    await h.step(120);
    await h.press('a'); await h.step(20);
    let ph = await h.ev(() => window.__fable.G.top().phase);
    assert(ph === 'power', `meter did not start (phase ${ph})`);
    await h.shot('mg-golf-meter.png');
    await h.press('b'); await h.step(3);
    ph = await h.ev(() => window.__fable.G.top().phase);
    assert(ph === 'aim', `b should cancel the meter (phase ${ph})`);
    await h.press('a'); await h.step(44); await h.press('a'); await h.step(36);
    const fl = await h.ev(() => { const m = window.__fable.G.top(); return { phase: m.phase, strokes: m.strokes }; });
    assert(fl.strokes === 1, `kick did not register: ${JSON.stringify(fl)}`);
    await h.shot('mg-golf-flight.png');
    report.card = 'ok';
  }
  console.log('[golf]', JSON.stringify(report, null, 1));
};
