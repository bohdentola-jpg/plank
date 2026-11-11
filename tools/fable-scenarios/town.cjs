// Clicks through the town systems' panels: notice board, shop, diner menu,
// uniform locker, decorating, the bed, the Route Lab and the binder.
module.exports = async (h) => {
  const ev = h.ev;
  const click = async (sel, nth = 0) => { const ok = await ev(([s, n]) => { const els = [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null && !e.classList.contains('disabled')); if (!els[n]) return false; els[n].click(); return true; }, [sel, nth]); await h.step(8); return ok; };
  const close = async () => { while (await click('.panel-x')) { /* close every open panel */ } };
  const S = () => ev(() => { const g = window.__fable.G; const s = g.S; return { coins: s.coins, parts: s.parts, town: s.town, flags: Object.keys(s.flags).filter((k) => s.flags[k]), meal: s.meal && s.meal.id, team: s.team, placed: s.decor.placed.length, owned: s.decor.owned, tod: s.tod, custom: s.customPlays.length, items: s.items, squads: s.squads, gear: s.chars.zip && s.chars.zip.gear, err: window.__fable.errors().slice(0, 3) }; });
  const must = (c, msg) => { if (!c) throw new Error(msg); };

  await h.open('area=hollow&preset=ch2');
  await h.step(10);
  await ev(() => { const g = window.__fable.G; g.S.coins = 3000; g.S.parts = 60; g.S.gear.push('sticky_gloves'); });

  // notice board: build everything, one project per visit
  for (let i = 0; i < 6; i++) {
    ev(() => { const g = window.__fable.G; g.hooks.board(g.world); });
    await h.step(10);
    must(await click('.panel .btn.small'), 'board: nothing to build on visit ' + i);
    await h.step(40);
    await close();
  }
  let s = await S();
  must(s.town.diner === 1 && s.town.arcade === 1 && s.town.field === 1 && s.town.stadium === 2 && s.flags.includes('clubhouse_fixed'), 'board: not everything built ' + JSON.stringify(s.town));
  console.log('built', JSON.stringify(s.town), 'coins', s.coins, 'parts', s.parts);

  // shop
  ev(() => { const g = window.__fable.G; g.hooks.shop(g.world); }); await h.step(10);
  must(await click('.panel .btn.small'), 'shop: no buy button');
  await click('.panel .btn.small', 6);
  await close();
  s = await S();
  must(Object.keys(s.items).length > 2 || s.items.orange > 3, 'shop: nothing bought ' + JSON.stringify(s.items));

  // diner menu
  ev(() => { const g = window.__fable.G; g.hooks.diner(g.world); }); await h.step(10);
  must(await click('.panel .btn.small', 1), 'diner: no meal button');
  await h.step(20); await close();
  s = await S(); must(!!s.meal, 'diner: no meal set');

  // uniforms
  const before = (await S()).team.jersey;
  ev(() => { const g = window.__fable.G; g.hooks.uniforms(g.world); }); await h.step(12);
  must(await click('[data-k="jersey"]', 8), 'uniforms: no swatch');
  await h.shot('town-uniforms.png');
  await close(); await h.step(10);
  s = await S(); must(s.team.jersey !== before, 'uniforms: jersey unchanged');

  // decorate (inside the clubhouse)
  await ev(() => window.__fable.G.world.goto('clubhouse', 6, 7)); await h.step(30);
  ev(() => { const g = window.__fable.G; g.hooks.decorate(g.world); }); await h.step(10);
  must(await click('.panel .card.focusable'), 'decorate: nothing to place');
  await h.step(20); await close();
  s = await S(); must(s.placed === 1, 'decorate: not placed');
  await h.shot('town-clubhouse.png');

  // bed: sleep until morning
  await ev(() => { window.__fable.G.debug.choices = [1]; });
  ev(() => { const g = window.__fable.G; g.hooks.bed(g.world); }); await h.step(40);
  s = await S(); must(s.tod === 'day', 'bed: time of day did not change (' + s.tod + ')');

  // Route Lab
  await ev(() => window.__fable.G.world.goto('hollow', 17, 26)); await h.step(30);
  await ev(() => { window.__fable.G.debug.choices = [0]; });
  ev(() => { const g = window.__fable.G; g.hooks.practice(g.world); }); await h.step(14);
  must(await click('.rt', 3), 'route lab: no route chips');
  await h.shot('town-routelab.png');
  must(await ev(() => { const b = [...document.querySelectorAll('.panel .btn')].find((x) => /Save to playbook/.test(x.textContent)); if (!b) return false; b.click(); return true; }), 'route lab: no save button');
  await h.step(10);
  s = await S(); must(s.custom === 1, 'route lab: play not saved');

  // binder: every tab, a squad swap, equip gear
  ev(() => { const g = window.__fable.G; g.hooks.menu(g.world, 'team'); }); await h.step(10);
  for (let t = 0; t < 6; t++) { must(await click('.tab', t), 'binder: tab ' + t); }
  await click('.tab', 1);
  must(await click('.sqm'), 'binder: no squad member');
  must(await click('.panel.small .sqm', 3), 'binder: swap list empty');
  await click('.tab', 0);
  await click('.rc', 3);
  must(await ev(() => { const b = [...document.querySelectorAll('.detail .btn')].find((x) => /Equip gear/.test(x.textContent)); if (!b) return false; b.click(); return true; }), 'binder: no gear button');
  await h.step(8);
  must(await click('.panel.small .bagrow', 1), 'binder: no gear to equip');
  await h.shot('town-binder.png');
  await close();
  s = await S();
  must(!s.err.length, 'errors: ' + s.err.join(' | '));
  console.log('TOWN OK', JSON.stringify({ coins: s.coins, meal: s.meal, custom: s.custom, placed: s.placed, tod: s.tod }));
};
