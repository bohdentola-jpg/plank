// Overworld → visible opponent → battle → back. One real autopilot encounter,
// one forced loss (respawn at the last bench), and a Continue-from-save check.
module.exports = async (h) => {
  await h.open('area=borough&preset=team&auto=1');
  const ev = h.ev;
  await ev(() => { window.__fable.G.debug.auto = true; });
  await h.step(10);
  const info = () => ev(() => { const g = window.__fable.G; const w = g.world; return { mode: g.top().name, enemies: w.enemies.map((e) => e.id + ':' + e.state), area: g.S.area, x: +w.leader.x.toFixed(1), z: +w.leader.z.toFixed(1), coins: g.S.coins, lv: g.S.chars.captain && g.S.chars.captain.lv, xp: g.S.chars.captain && g.S.chars.captain.xp, err: window.__fable.errors().slice(0, 2) }; });
  console.log('start', JSON.stringify(await info()));
  // walk into the lane scout from behind (blindside)
  await ev(() => { const w = window.__fable.G.world; const e = w.enemies.find((x) => x.id === 'gn_lane'); w.tp(e.x - Math.sin(e.yaw) * 1.0, e.z - Math.cos(e.yaw) * 1.0); });
  for (let i = 0; i < 400; i++) { await h.step(40, 1 / 30); const s = await info(); if (s.err.length) throw new Error(s.err[0]); if (s.mode === 'world' && i > 3) break; }
  console.log('after real encounter', JSON.stringify(await info()));
  // forced loss → respawn
  await ev(() => { const g = window.__fable.G; g.hooks.encounter = async () => ({ won: false }); g.S.checkpoint = { area: 'borough', x: 45.6, z: 16.4 }; const w = g.world; const e = w.enemies[0]; if (e) w.tp(e.x + 0.4, e.z + 0.4); });
  await h.step(120);
  console.log('after forced loss', JSON.stringify(await info()));
  // save + continue
  await ev(() => { const g = window.__fable.G; g.S.coins = 777; localStorage.setItem('fourth-and-fable-save-v1', JSON.stringify(g.S)); });
  const origin = await ev(() => location.origin);
  await h.page.goto(`${origin}/fable/index.html?test`);
  await h.page.waitForFunction(() => window.__fable && window.__fable.G.top(), null, { timeout: 60000 });
  await h.step(20);
  await ev(() => { const b = [...document.querySelectorAll('.title-menu .btn')].find((x) => x.textContent === 'Continue'); if (!b) throw new Error('no Continue button'); b.click(); });
  await h.step(60);
  const s = await ev(() => { const g = window.__fable.G; return { mode: g.top().name, coins: g.S.coins, area: g.S.area, roster: g.S.roster.length, err: window.__fable.errors().slice(0, 2) }; });
  console.log('continue', JSON.stringify(s));
  if (s.coins !== 777 || s.mode !== 'world') throw new Error('continue failed');
  await ev(() => localStorage.clear());
};
