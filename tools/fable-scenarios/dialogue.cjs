// The clubhouse intro with the REAL dialogue UI (typewriter, choices, cinematic
// bars) advanced by button presses — no fast-forwarding.
module.exports = async (h) => {
  const ev = h.ev;
  await h.open('area=hollow&preset=fresh&dialog&shadows');
  await h.step(10);
  await ev(() => window.__fable.G.world.goto('clubhouse', 8, 9.6)); await h.step(40);
  await ev(() => window.__fable.axis(0, -1)); await h.step(30); await ev(() => window.__fable.axis(0, 0));
  let shots = 0, sawChoice = false, lines = new Set();
  for (let i = 0; i < 400; i++) {
    await h.step(18);
    const s = await ev(() => { const g = window.__fable.G; const u = g.ui; return { open: u.dialogOpen, text: u.dText.textContent, choices: [...document.querySelectorAll('.dlg-choices .choice')].map((c) => c.textContent), roster: g.S.roster.join(','), ball: !!g.S.flags.has_ball, busy: g.world.busy, err: window.__fable.errors().slice(0, 2) }; });
    if (s.err.length) throw new Error(s.err[0]);
    if (s.text) lines.add(s.text);
    if (s.choices.length && !sawChoice) { sawChoice = true; await h.shot('dialogue-choice.png'); await ev(() => window.__fable.G.input.press('down')); }
    if (s.open && shots < 1 && lines.size === 3) { shots++; await h.shot('dialogue-line.png'); }
    if (!s.open && !s.busy && s.roster.includes('hollow')) { console.log('lines seen:', lines.size, '· roster:', s.roster, '· ball:', s.ball, '· choice shown:', sawChoice); break; }
    await ev(() => window.__fable.press('a'));
    if (i === 399) throw new Error('dialogue never finished: ' + JSON.stringify(s));
  }
  if (!sawChoice) throw new Error('the choice prompt never appeared');
  console.log('DIALOGUE OK');
};
