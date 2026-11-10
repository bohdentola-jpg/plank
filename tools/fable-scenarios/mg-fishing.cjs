// QA for Fishing.
//   node tools/fable-qa.cjs --script tools/fable-scenarios/mg-fishing.cjs [--shots]
// An autopilot drives the real inputs: holds to wind up, releases to cast, hooks on the
// bite, reels while the fish is calm and eases off when it runs. Then a few deliberate
// mistakes (hook too early, never hook, hold through a run, never reel, pack up early).
module.exports = async (h, args) => {
  const shots = args.includes('--shots');
  const assert = (ok, msg) => { if (!ok) throw new Error(`ASSERT: ${msg}`); };

  /**
   * Play in the page until the session ends or a screenshot point is reached.
   * cfg: { power: [..per cast], style: 'good'|'early'|'sleepy'|'greedy'|'lazy', stopAt: phase name, quitAfter }
   */
  const play = (cfg) => h.ev(async (cfg) => {
    const F = window.__fable, G = F.G;
    const st = window.__fishBot || (window.__fishBot = { stops: {}, cast: 0, log: [] });
    let frames = 0;
    while (!G.debug.lastResult && frames < 60000) {
      const m = G.top();
      if (!m) break;
      const ph = m.ph;
      if (cfg.stopAt && ph === cfg.stopAt && !st.stops[`${ph}:${m.casts}`] && (!cfg.stopCast || m.casts === cfg.stopCast) && (ph !== 'reel' || m.reel.P > (cfg.stopP || 0.4)) && (ph !== 'charge' || m.power > 0.5) && true) {
        st.stops[`${ph}:${m.casts}`] = 1;
        return { stop: ph, cast: m.casts };
      }
      if (ph === 'idle') {
        if (cfg.quitAfter !== undefined && m.casts >= cfg.quitAfter) { F.hold('a', false); F.press('b'); }
        else F.hold('a', !m.needRelease);            // a fresh hold: let go first, like a person would
      } else if (ph === 'charge') {
        const want = cfg.power[m.casts % cfg.power.length];
        if ((m.pdir > 0 && m.power >= want) || m.pdir < 0) F.hold('a', false);
      } else if (ph === 'wait') {
        F.hold('a', false);
        if (cfg.style === 'early' && m.waited > 0.6) F.press('a');
      } else if (ph === 'bite') {
        if (cfg.style !== 'sleepy') F.press('a');
      } else if (ph === 'reel') {
        const r = m.reel;
        if (cfg.style === 'greedy') F.hold('a', true);
        else if (cfg.style === 'lazy') F.hold('a', false);
        else F.hold('a', r.mode === 'calm' && r.T < 0.8);
      } else if (ph === 'catch') {
        F.hold('a', false);
        if (m.pt < m.catchDur - 0.9) F.press('a');
      } else F.hold('a', false);
      await F.step(1);
      frames++;
    }
    F.hold('a', false);
    const S = G.S;
    const out = { result: G.debug.lastResult || null, frames, fish: { ...S.fish }, best: { ...(S.seen.fishBest || {}) }, coins: S.coins };
    window.__fishBot = null;
    return out;
  }, cfg);

  async function session(query, cfg, tag, shotPhases = []) {
    await h.open(query);
    if (cfg.realPace) await h.ev(() => { window.__fable.G.debug.fast = false; });   // real waits, so cards stay up long enough to photograph
    await h.step(6);
    if (shots && shotPhases.includes('idle')) await h.shot(`mg-fishing-${tag}-idle.png`);
    for (const ph of shotPhases.filter((p) => p !== 'idle')) {
      const r = await play({ ...cfg, stopAt: ph, stopCast: cfg.stopCast });
      if (r.stop) { await h.step(ph === 'catch' ? 62 : 2); if (shots) await h.shot(`mg-fishing-${tag}-${ph}.png`); } else return r;
    }
    return play(cfg);
  }
  const check = (r, what) => {
    assert(r.result, `${what}: session did not end (${r.frames} frames)`);
    const x = r.result;
    assert(x.id === 'fishing' && x.won === true && x.medal === 0, `${what}: bad result ${JSON.stringify(x)}`);
    assert(Array.isArray(x.extra.caught), `${what}: no caught list`);
  };
  const VAL = { bluegill: 6, perch: 9, catfish: 16, boot: 2, mouthguard: 4, koi: 30, whistle_fish: 22, ghost_carp: 45 };
  const report = {};

  // 1) a full, competent day session — screenshots along the way
  let r = await session(`mg=fishing&tod=day${shots ? '&shadows' : ''}`, { power: [0.9, 0.3, 0.6, 1, 0.2, 0.8, 0.5, 0.95], style: 'good', realPace: true }, 'day', shots ? ['idle', 'charge', 'wait', 'bite', 'reel', 'catch'] : []);
  check(r, 'day');
  const caught = r.result.extra.caught;
  assert(r.result.extra.casts === 8, `day: expected 8 casts, got ${r.result.extra.casts}`);
  assert(caught.length >= 5, `day: a careful angler should land most fish, got ${caught.length}/8`);
  assert(r.result.score === caught.reduce((a, c) => a + VAL[c.id], 0), 'day: score should be the coin value of the catch');
  assert(caught.every((c) => c.id !== 'koi' && c.id !== 'ghost_carp'), 'day: night-only fish showed up in daylight');
  const counts = {};
  for (const c of caught) counts[c.id] = (counts[c.id] || 0) + 1;
  assert(JSON.stringify(counts) === JSON.stringify(Object.fromEntries(Object.entries(r.fish).filter(([k]) => counts[k]))), `day: save counts ${JSON.stringify(r.fish)} do not match catch ${JSON.stringify(counts)}`);
  for (const c of caught) assert(r.best[c.id] >= c.size, `day: best size for ${c.id} not recorded`);
  assert(r.coins === 80, 'fishing must not hand out coins itself');
  report.day = { score: r.result.score, caught: caught.map((c) => `${c.id}:${c.size}`).join(' '), frames: r.frames };

  // 2) night: the rare ones can bite (cast far every time, a few sessions' worth of seeds)
  let nightRare = 0, nightAll = [];
  for (const seed of [3, 7, 19]) {
    r = await session(`mg=fishing&night=1&seed=${seed}${shots && seed === 3 ? '&shadows' : ''}`, { power: [1, 0.95, 0.9], style: 'good' }, 'night', shots && seed === 3 ? ['idle', 'reel'] : []);
    check(r, `night ${seed}`);
    for (const c of r.result.extra.caught) { nightAll.push(c.id); if (c.id === 'koi' || c.id === 'ghost_carp') nightRare++; }
  }
  assert(nightRare > 0, `night: no night-only fish in three far-casting sessions (${nightAll.join(',')})`);
  report.night = { nightRare, caught: nightAll.join(' ') };

  // 3) mistakes should cost you the fish, not break anything
  for (const style of ['early', 'sleepy', 'greedy', 'lazy']) {
    r = await session('mg=fishing&seed=5', { power: [0.7], style }, style);
    check(r, style);
    const n = r.result.extra.caught.length;
    // junk doesn't fight, so "greedy" can still land an old cleat; everything else should come up empty
    if (style !== 'greedy') assert(n === 0, `${style}: should catch nothing, caught ${n}`);
    else assert(r.result.extra.caught.every((c) => c.id === 'boot' || c.id === 'mouthguard'), `greedy: only junk should survive a death-grip reel (${JSON.stringify(r.result.extra.caught)})`);
    report[style] = { caught: n, frames: r.frames };
  }

  // 4) pack up early with b
  r = await session('mg=fishing&seed=9', { power: [0.5], style: 'good', quitAfter: 2 }, 'quit');
  check(r, 'quit');
  assert(r.result.extra.casts === 2, `quit: expected to stop after 2 casts, got ${r.result.extra.casts}`);
  report.quit = { casts: r.result.extra.casts, caught: r.result.extra.caught.length };

  // 5) real pacing (no test fast-forward) with the intro and results cards on screen
  await h.open(`mg=fishing&dialog&seed=11${shots ? '&shadows' : ''}`);
  await h.ev(() => { window.__fable.G.debug.fast = false; });
  await h.step(10);
  await h.sleep(500);
  if (shots) await h.shot('mg-fishing-card.png');
  await h.press('a');
  await h.step(200);                                   // 3-2-1-GO
  let st = await h.ev(() => { const m = window.__fable.G.top(); return { state: m.state, ph: m.ph }; });
  assert(st.state === 'play' && st.ph === 'idle', `intro card did not start the session: ${JSON.stringify(st)}`);
  r = await play({ power: [0.85, 0.4], style: 'good', quitAfter: 2 });
  check(r, 'paced');
  await h.step(70);
  await h.sleep(600);                                  // let the card's CSS pop-in finish
  const stray = await h.ev(() => [...document.querySelectorAll('.mg-card .panel-body')].some((b) => [...b.childNodes].some((n) => n.nodeType === 3 && /null|false/.test(n.nodeValue))));
  assert(!stray, 'results card has stray "null" text');
  if (shots) await h.shot('mg-fishing-results.png');
  await h.press('a');                                  // "Done"
  await h.step(60);
  const gone = await h.ev(() => window.__fable.G.top() === null);
  assert(gone, 'results card "Done" should leave the minigame');
  report.paced = { frames: r.frames, caught: r.result.extra.caught.length };

  // 6) the way the game really launches it: from the overworld through G.hooks.minigame
  await h.open('area=hollow&preset=ch2');
  await h.step(10);
  const before = await h.ev(() => ({ mode: window.__fable.mode(), coins: window.__fable.G.S.coins }));
  assert(before.mode === 'world', `expected to start in the world, got ${before.mode}`);
  await h.ev(() => { window.__res = null; window.__fable.G.hooks.minigame('fishing', { night: true, seed: 3 }).then((x) => { window.__res = x; }); });
  let mode = null;
  for (let i = 0; i < 80 && mode !== 'minigame'; i++) { await h.step(5); await h.sleep(40); mode = await h.ev(() => window.__fable.mode()); }   // the module is fetched on demand
  assert(mode === 'minigame', `fishing did not open from the hook (mode ${mode})`);
  assert(await h.ev(() => window.__fable.G.top().night === true), 'hook: { night: true } should give the night pond');
  r = await play({ power: [0.95], style: 'good' });
  await h.step(30);
  const after = await h.ev(() => ({ mode: window.__fable.mode(), res: window.__res, coins: window.__fable.G.S.coins, fish: window.__fable.G.S.fish }));
  assert(after.mode === 'world', `after fishing we should be back in the world, got ${after.mode}`);
  assert(after.res && after.res.id === 'fishing' && after.res.extra.caught.length > 0, `hook result wrong: ${JSON.stringify(after.res)}`);
  assert(after.coins === before.coins, 'fishing must not change coins');
  report.hook = { score: after.res.score, fish: after.fish };

  console.log('[fishing]', JSON.stringify(report, null, 1));
};
