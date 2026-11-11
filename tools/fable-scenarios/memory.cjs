// GPU-memory regression check: hop between areas and play a couple of drives
// in one page, rendering as we go, and make sure three.js's live geometry and
// texture counts settle instead of climbing.
module.exports = async (h) => {
  await h.open('area=borough&preset=team');
  await h.step(10);
  const mem = () => h.ev(() => { window.__fable.render(); const m = window.__fable.G.renderer.info.memory; return [m.geometries, m.textures]; });
  await h.ev(() => {
    const g = window.__fable.G; g.debug.auto = true; window.__done = 0;
    (async () => { for (let i = 0; i < 2; i++) { await g.hooks.battle({ team: 'gnome_scouts', kind: 'drive', side: i ? 'def' : 'off', venue: 'backyard' }); window.__done++; } })();
  });
  for (let i = 0; i < 900; i++) { await h.step(60, 1 / 30); const d = await h.ev(() => { window.__fable.render(); return window.__done; }); if (d >= 2) break; }
  const seen = { hollow: [], borough: [] };
  for (let i = 0; i < 4; i++) {
    for (const [a, x, z] of [['hollow', 39, 40], ['borough', 42, 10]]) {
      await h.ev(([aa, xx, zz]) => window.__fable.G.world.goto(aa, xx, zz), [a, x, z]);
      await h.step(30);
      seen[a].push(await mem());
    }
  }
  console.log('hollow ', seen.hollow.map((m) => `${m[0]}g/${m[1]}t`).join('  '));
  console.log('borough', seen.borough.map((m) => `${m[0]}g/${m[1]}t`).join('  '));
  for (const a of ['hollow', 'borough']) {
    const first = seen[a][1], last = seen[a][3];      // skip the very first visit (caches warming up)
    if (last[0] - first[0] > 4 || last[1] - first[1] > 1) throw new Error(`${a}: GPU objects keep growing (${first} → ${last})`);
  }
  const errs = await h.ev(() => window.__fable.errors());
  if (errs.length) throw new Error(errs[0]);
  console.log('MEMORY OK');
};
