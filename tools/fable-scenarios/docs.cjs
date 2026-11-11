// Regenerates the README screenshots in fable/docs/ (JPEG, 1280x720).
const path = require('path');
module.exports = async (h) => {
  const out = path.join(h.root, 'fable', 'docs');
  require('fs').mkdirSync(out, { recursive: true });
  const snap = async (name) => { await h.ev(() => window.__fable.render()); await h.page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 84 }); console.log('doc', name); };
  const tp = (x, z) => h.ev(([a, b]) => window.__fable.G.world.tp(a, b), [x, z]);

  await h.open('shadows'); await h.step(60); await snap('title');

  await h.open('area=hollow&preset=team&shadows&tod=dusk'); await h.step(5); await tp(14.5, 49); await h.step(50); await snap('hollow-dusk');
  await h.open('area=hollow&preset=ch2&shadows'); await h.step(5); await tp(39, 17); await h.step(60); await snap('scoreboard');
  await h.open('area=borough&preset=start&shadows&tod=day'); await h.step(5); await tp(26, 17.5); await h.step(50); await snap('borough-rooftop');
  await h.open('area=borough&preset=team&shadows&tod=day'); await h.step(5); await tp(42, 44); await h.step(50); await snap('crooked-field');
  const freeze = () => h.ev(() => { window.__fable.G.world.busy++; });
  await h.open('area=fair&preset=fair&shadows&tod=day'); await h.step(5); await freeze(); await tp(47.2, 27.1); await h.step(50); await snap('corn-maze');
  await h.open('area=fair&preset=fair&shadows&tod=day'); await h.step(5); await freeze(); await tp(17, 30.4); await h.step(50); await snap('fairgrounds');
  await h.open('area=frost&preset=frost&shadows&tod=day'); await h.step(5); await freeze(); await tp(39, 29); await h.step(50); await snap('frozen-river');
  await h.open('area=neon&preset=neon&shadows'); await h.step(5); await freeze(); await tp(30, 22); await h.step(50); await snap('boardwalk');
  await h.open('area=clubhouse&preset=ch2&shadows'); await h.step(40); await snap('clubhouse');
  await h.open('area=hollow&preset=frost&dialog&shadows&tod=day'); await h.step(10);
  await h.ev(() => { const g = window.__fable.G; g.hooks.menu(g.world, 'squads'); }); await h.step(12); await snap('binder');

  // a drive in progress: huddle, then a pass in the air
  await h.open('battle=gnomes&kind=match&side=off&dialog&shadows&tod=day');
  for (let i = 0; i < 60; i++) { await h.step(5); if (await h.ev(() => !!document.querySelector('.huddle'))) break; }
  await h.step(6); await snap('huddle');
  await h.ev(() => window.__fable.press('t1')); await h.step(60);
  for (let i = 0; i < 60; i++) { await h.step(2); const b = await h.ev(() => window.__fable.G.top().snapBeat); if (b >= 2.97) break; }
  await h.ev(() => window.__fable.press('a')); await h.step(58);
  await snap('pocket');
  await h.ev(() => window.__fable.press('t1')); await h.step(14); await snap('catch');

  for (const [mg, steps] of [['golf', 30], ['mascot', 420], ['lights', 300], ['snack', 520]]) {
    await h.open(`mg=${mg}&shadows&auto=1&seed=3`); await h.step(steps, 1 / 30); await snap(`mg-${mg}`);
  }
};
