// Scripted run through chapter 1 (dialogue auto-advanced, battles on autopilot).
// Walks the story by teleporting next to each beat and pressing the action button.
module.exports = async (h, args) => {
  await h.open('area=hollow&preset=fresh&auto=1');
  const ev = h.ev;
  const act = async (x, z, steps = 30) => { await ev(([a, b]) => window.__fable.G.world.tp(a, b), [x, z]); await h.step(6); await ev(() => window.__fable.press('a')); await h.step(steps); };
  const state = () => ev(() => { const g = window.__fable.G; const S = g.S; return { mode: g.top() && g.top().name, area: S.area, roster: S.roster, chapter: S.chapter, tod: S.tod, flags: Object.keys(S.flags).filter((k) => S.flags[k]).length, quests: S.quests, err: window.__fable.errors().slice(0, 3), toast: g.debug.lastToast }; });
  const until = async (pred, max = 6000, label = '') => { for (let i = 0; i < max / 30; i++) { await h.step(30, 1 / 30); const s = await state(); if (s.err.length) { console.log('ERR', label, s.err); return s; } if (pred(s)) return s; } console.log('TIMEOUT', label, JSON.stringify(await state())); return null; };
  await ev(() => { const g = window.__fable.G; g.debug.auto = true; g.hooks.minigame = async () => ({ won: true, score: 20 }); });
  await h.step(20);
  let s = await state(); console.log('start', s.area, s.roster.join(','));
  // arrival trigger fires by standing at the bus stop
  await ev(() => window.__fable.G.world.tp(68.5, 33.5)); await h.step(40);
  // clubhouse: door, then walk into the intro trigger
  await act(13, 46.2, 40);
  s = await state(); console.log('after door', s.area);
  await ev(() => window.__fable.G.world.tp(8, 8.2)); await h.step(60);
  s = await state(); console.log('after intro', s.roster.join(','), 'ball', s.flags);
  // out, down to the Borough
  await ev(() => window.__fable.G.world.goto('borough', 42, 3.4)); await h.step(30);
  // Pip: throw at the target (face it first)
  await ev(() => { const w = window.__fable.G.world; w.tp(29.2, 16); w.leader.ch.face(Math.PI); w.throwBall(); }); await h.step(120);
  s = await state(); console.log('after pip', s.roster.join(','));
  await h.shot('ch1-borough.png');
  // Zip
  await act(53.4, 58.2, 80);
  s = await state(); console.log('after zip', s.roster.join(','));
  // Waffle in the diner
  await ev(() => window.__fable.G.world.goto('diner', 4, 9)); await h.step(30);
  await act(8.15, 4.3, 30);
  s = await until((x) => x.roster.includes('waffle') && x.mode === 'world', 20000, 'waffle drill');
  console.log('after waffle', s && s.roster.join(','), s && s.tod);
  // June at the clubhouse porch at dusk
  await ev(() => window.__fable.G.world.goto('hollow', 14.5, 48.6)); await h.step(40);
  await h.shot('ch1-dusk.png');
  await act(14.5, 48.2, 30);
  s = await until((x) => x.roster.includes('june') && x.mode === 'world' && x.chapter >= 1, 20000, 'june drill');
  console.log('after june', s && s.roster.join(','), 'chapter', s && s.chapter);
  // the first match
  await ev(() => window.__fable.G.world.goto('borough', 44.4, 44.4)); await h.step(30);
  for (let tries = 0; tries < 4; tries++) {
    await act(44.6, 43.6, 30);
    s = await until((x) => x.mode === 'world' && (x.chapter >= 2 || true), 60000, 'first match');
    const st = await state();
    console.log('match try', tries, 'chapter', st.chapter, 'tod', st.tod);
    if (st.chapter >= 2) break;
  }
  // walk up to the stadium gate: the scoreboard scene
  await ev(() => window.__fable.G.world.goto('hollow', 39, 18)); await h.step(30);
  await ev(() => window.__fable.axis(0, -1)); await h.step(50); await ev(() => window.__fable.axis(0, 0)); await h.step(60);
  s = await state();
  console.log('after scoreboard', JSON.stringify({ chapter: s.chapter, tod: s.tod, quests: s.quests }));
  await h.shot('ch1-scoreboard.png');
  if (!s.quests.welcome_back) throw new Error('scoreboard scene did not run');
  // Gus → the bus → Harvest Fairgrounds
  await act(67.6, 32.6, 80);
  s = await state();
  console.log('end', JSON.stringify({ area: s.area, quests: s.quests }));
  if (s.area !== 'fair' || !s.quests.fair) throw new Error('bus to the fairgrounds failed');
  console.log('CHAPTER 1 OK');
};
