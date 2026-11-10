// QA for Lawn Dash: an in-game autopilot (?auto=1&skill=…) runs full races
// against Zip; we check the result, exercise real input, and grab screenshots.
//   node tools/fable-qa.cjs --script tools/fable-scenarios/mg-dash.cjs            (smoke + screenshots)
//   node tools/fable-qa.cjs --script tools/fable-scenarios/mg-dash.cjs --tune     (times / win rates across skill and ease)
module.exports = async (h, args) => {
  const tune = args.includes('--tune');
  const play = async (query, shots = {}) => {
    await h.open(query);
    let frames = 0;
    for (;;) {
      await h.step(60);
      frames += 60;
      if (shots[frames]) await h.shot(shots[frames]);
      const res = await h.ev(() => window.__fable.G.debug.lastResult || null);
      if (res) return res;
      if (frames > 6000) throw new Error(`never finished: ${query}`);
    }
  };
  const check = (res, label) => {
    if (res.id !== 'dash') throw new Error(`${label}: wrong id ${res.id}`);
    if (!Number.isFinite(res.score) || res.score < 15 || res.score > 100) throw new Error(`${label}: bad time ${res.score}`);
    if (typeof res.won !== 'boolean') throw new Error(`${label}: won must be boolean`);
    console.log(`${label}: time ${res.score}s  won=${res.won}  medal ${res.medal}  zip ${res.extra.zip}s  hits ${res.extra.hits}/${res.extra.zipHits}`);
  };

  if (tune) {
    for (const mode of ['', '&hard=1']) {
      for (const skill of [0.3, 0.55, 0.8, 1]) {
        for (const ease of mode ? [0] : [0, 1, 2, 3]) {
          const times = [], zips = []; let wins = 0;
          for (const seed of [1, 2, 3, 4, 5, 6]) {
            const r = await play(`mg=dash&auto=1&skill=${skill}&ease=${ease}&seed=${seed}${mode}`);
            times.push(r.score); if (r.won) wins++; zips.push(r.extra.zip || 0);
          }
          const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
          console.log(`${mode ? 'HARD  ' : 'NORMAL'} skill ${skill} ease ${ease}: you ${avg(times)}s (${Math.min(...times)}–${Math.max(...times)})  zip ~${avg(zips.filter(Boolean))}s  wins ${wins}/6`);
        }
      }
    }
    return;
  }

  // 1) a clean race with screenshots
  check(await play('mg=dash&auto=1&skill=0.9&seed=3&shadows', { 60: 'mg-dash-1.png', 480: 'mg-dash-2.png', 1080: 'mg-dash-3.png' }), 'normal');
  // 2) hard course
  check(await play('mg=dash&auto=1&skill=0.9&seed=4&hard=1&shadows', { 900: 'mg-dash-hard.png' }), 'hard');
  // 3) story call shape (rival + ease) with a clumsy runner — must still finish
  check(await play('mg=dash&rival=zip&ease=3&auto=1&skill=0.3&seed=5'), 'story ease 3');
  // 4) no input at all: you plough through everything but still cross the line
  const idle = await play('mg=dash&seed=6');
  check(idle, 'idle');
  if (idle.won) throw new Error('a runner who never steers should not beat Zip at ease 0');
  // 5) real input: lane change + hop
  await h.open('mg=dash&seed=7');
  await h.step(10);
  const lane0 = await h.ev(() => window.__fable.G.top().P.lane);
  await h.ev(() => window.__fable.axis(0, 1));
  await h.step(3);
  await h.ev(() => window.__fable.axis(0, 0));
  await h.step(3);
  const lane1 = await h.ev(() => window.__fable.G.top().P.lane);
  await h.ev(() => window.__fable.press('a'));
  await h.step(12);
  const y = await h.ev(() => window.__fable.G.top().P.y);
  if (lane1 !== lane0 + 1) throw new Error(`lane change failed: ${lane0} → ${lane1}`);
  if (!(y > 0.5)) throw new Error(`hop failed: y=${y}`);
  console.log('manual lane change + hop ok');
  // 6) the intro card
  await h.open('mg=dash&dialog&shadows');
  await h.step(20);
  await h.shot('mg-dash-intro.png');
};
