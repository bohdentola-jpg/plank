// QA for Snack Shack Rush: an in-game autopilot (?auto=1&skill=…) plays full
// 90-second shifts on normal and hard; we check the result and grab screenshots.
//   node tools/fable-qa.cjs --script tools/fable-scenarios/mg-snack.cjs            (smoke + screenshots)
//   node tools/fable-qa.cjs --script tools/fable-scenarios/mg-snack.cjs --tune     (score table across skills/seeds)
module.exports = async (h, args) => {
  const tune = args.includes('--tune');
  const play = async (query, shots = {}) => {
    await h.open(query);
    let frames = 0;
    for (;;) {
      await h.step(150);
      frames += 150;
      if (shots[frames]) await h.shot(shots[frames]);
      const res = await h.ev(() => window.__fable.G.debug.lastResult || null);
      if (res) return res;
      if (frames > 7500) throw new Error(`never finished: ${query}`);
    }
  };
  const check = (res, label) => {
    if (res.id !== 'snack') throw new Error(`${label}: wrong id ${res.id}`);
    if (!Number.isFinite(res.score) || res.score < 0) throw new Error(`${label}: bad score ${res.score}`);
    if (res.medal < 0 || res.medal > 3) throw new Error(`${label}: bad medal`);
    if (!res.extra || !(res.extra.served >= 0)) throw new Error(`${label}: missing extra`);
    console.log(`${label}: score ${res.score} medal ${res.medal} served ${res.extra.served} lost ${res.extra.lost}`);
  };

  if (tune) {
    for (const mode of ['', '&hard=1']) {
      for (const skill of [0.25, 0.55, 0.85, 1]) {
        const scores = [], notes = [];
        for (const seed of [1, 2, 3]) { const r = await play(`mg=snack&auto=1&skill=${skill}&seed=${seed}${mode}`); scores.push(r.score); notes.push(`${r.extra.served}/${r.extra.lost}`); }
        console.log(`${mode ? 'HARD  ' : 'NORMAL'} skill ${skill}: ${scores.join(', ')}  (avg ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)})  served/lost ${notes.join(' ')}`);
      }
    }
    return;
  }

  // 1) a full normal shift with screenshots along the way
  check(await play('mg=snack&auto=1&skill=0.7&seed=4&shadows', { 900: 'mg-snack-1.png', 2700: 'mg-snack-2.png', 4800: 'mg-snack-3.png' }), 'normal');
  // 2) a full hard shift
  check(await play('mg=snack&auto=1&skill=0.7&seed=5&hard=1&shadows', { 2400: 'mg-snack-hard.png' }), 'hard');
  // 3) no input at all: must still end cleanly with a low score and no medal
  const idle = await play('mg=snack&seed=6');
  check(idle, 'idle');
  if (idle.medal !== 0) throw new Error('idle run should not medal');
  // 4) manual input path: walk to the pretzel warmer, grab one, toss it
  await h.open('mg=snack&seed=7');
  await h.step(5);
  await h.ev(() => window.__fable.axis(1, 0.45));
  await h.step(70);
  await h.ev(() => { window.__fable.axis(0, 0); window.__fable.press('a'); });
  await h.step(3);
  const tray1 = await h.ev(() => window.__fable.G.top().tray.slice());
  await h.ev(() => window.__fable.press('b'));
  await h.step(3);
  const tray2 = await h.ev(() => window.__fable.G.top().tray.slice());
  if (tray1.join() !== 'pretzel' || tray2.length !== 0) throw new Error(`manual input failed: ${JSON.stringify(tray1)} → ${JSON.stringify(tray2)}`);
  console.log('manual grab + toss ok');
  // 5) the intro card
  await h.open('mg=snack&dialog&shadows');
  await h.step(20);
  await h.shot('mg-snack-intro.png');
};
