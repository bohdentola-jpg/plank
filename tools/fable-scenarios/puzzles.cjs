// Input-driven checks of the region puzzles: the ice-sliding river, the corn
// maze bale, the squeeze gap, and the boardwalk breakers.
module.exports = async (h) => {
  const ev = h.ev;
  const pos = () => ev(() => { const w = window.__fable.G.world; const c = w.ctrl; return { x: +c.x.toFixed(2), z: +c.z.toFixed(2), solo: !!w.solo, err: window.__fable.errors().slice(0, 2) }; });
  const move = async (x, y, frames) => { await ev(([a, b]) => window.__fable.axis(a, b), [x, y]); await h.step(frames); await ev(() => window.__fable.axis(0, 0)); await h.step(8); };
  const press = async (k, frames = 30) => { await ev((a) => window.__fable.press(a), k); await h.step(frames); };
  const tp = (x, z) => ev(([a, b]) => window.__fable.G.world.tp(a, b), [x, z]);

  // ---- ice: follow a known solution with real stick input
  await h.open('area=frost&preset=frost&tod=day');
  await ev(() => { const w = window.__fable.G.world; for (const e of w.enemies) e.state = 'stun', e.t = 1e9; });
  await tp(31, 35.2);
  const seq = [[0, -1], [1, 0], [0, 1], [1, 0], [0, -1], [1, 0], [0, 1], [-1, 0], [0, -1]];
  const cells = [];
  for (const [x, y] of seq) { await move(x, y, 70); const p = await pos(); cells.push(`${Math.floor((p.x - 30) / 2)},${Math.floor((p.z - 20) / 2)}`); }
  let p = await pos();
  console.log('ice path cells', cells.join(' → '), 'end', JSON.stringify(p));
  if (p.z > 20) throw new Error('ice puzzle: did not reach the north bank');
  await h.shot('pz-ice-done.png');
  // and back again
  await tp(45, 18.6);
  for (const [x, y] of [[0, 1], [1, 0], [0, -1], [-1, 0], [0, 1], [-1, 0], [0, 1]]) await move(x, y, 70);
  p = await pos();
  console.log('ice return', JSON.stringify(p));
  if (p.z < 34) throw new Error('ice puzzle: could not get back');

  // ---- corn maze: shove the bale twice, walk out the far side
  await h.open('area=fair&preset=fair&tod=day');
  await ev(() => { const w = window.__fable.G.world; for (const e of w.enemies) { e.ch.dispose(); e.minis.forEach((m) => m.ch.dispose()); } w.enemies = []; });
  const cx = (c) => 38 + (c + 0.5) * 2.6, cz = (r) => 18 + (r + 0.5) * 2.6;
  await tp(cx(11), cz(3));
  await move(0, 1, 30);                  // walk up to the bale
  await press('a', 80);                  // shove #1 (from the north)
  await move(0, 1, 40);
  await press('a', 80);                  // shove #2
  await move(0, 1, 50);
  await move(1, 0, 70);
  p = await pos();
  console.log('maze exit', JSON.stringify(p));
  if (p.x < 72) throw new Error('corn maze: could not get past the bale');
  // squeeze gap → crate
  await tp(cx(7), cz(3));
  await press('a', 60);
  p = await pos();
  if (!p.solo) throw new Error('gap: nobody went through');
  await move(1, 0, 62);
  await press('a', 40);
  const got = await ev(() => window.__fable.G.S.gear.includes('rocket_cleats'));
  console.log('gap solo', JSON.stringify(p), 'cleats', got);
  if (!got) throw new Error('gap: crate not opened');
  await press('y', 40);
  // walking around the maze must be impossible
  await tp(36.6, 0.5); await move(1, 0, 200); p = await pos();
  if (p.x > 40) throw new Error('fair: can sneak along the north edge');
  await tp(36.6, 59.5); await move(1, 0, 200); p = await pos();
  if (p.x > 40) throw new Error('fair: can sneak along the south edge');

  // ---- boardwalk: breaker 3 needs the cabinet shoved; breaker 2 needs someone small
  await h.open('area=neon&preset=neon');
  await ev(() => { const w = window.__fable.G.world; for (const e of w.enemies) { e.ch.dispose(); e.minis.forEach((m) => m.ch.dispose()); } w.enemies = []; });
  await tp(74, 10.6);
  let near = await ev(() => { const w = window.__fable.G.world; return w.near && w.near.label; });
  if (near === 'Flip the breaker') throw new Error('neon: breaker 3 reachable without moving the cabinet');
  await tp(72.8, 9.8);
  await press('a', 90);                  // shove east
  await tp(74, 9.75); await h.step(4);
  await press('a', 40);
  let flags = await ev(() => { const f = window.__fable.G.S.flags; return [f.neon_b1, f.neon_b2, f.neon_b3]; });
  console.log('after cabinet', JSON.stringify(flags));
  if (!flags[2]) throw new Error('neon: breaker 3 did not flip');
  await tp(58.4, 10); await press('a', 60);
  p = await pos();
  if (!p.solo) throw new Error('neon: nobody fit through the vent ' + JSON.stringify(p));
  await move(1, 0, 52); await move(0, -1, 30);
  await press('a', 60);
  flags = await ev(() => { const f = window.__fable.G.S.flags; return [f.neon_b1, f.neon_b2, f.neon_b3]; });
  console.log('after cage', JSON.stringify(flags));
  if (!flags[1]) throw new Error('neon: breaker 2 did not flip');
  await tp(40, 43.4); await ev(() => { const w = window.__fable.G.world; w.leader.ch.face(0); w.throwBall(); }); await h.step(90);
  flags = await ev(() => { const f = window.__fable.G.S.flags; return [f.neon_b1, f.neon_b2, f.neon_b3]; });
  if (!flags[0]) throw new Error('neon: breaker 1 did not flip');
  const e = (await pos()).err;
  if (e.length) throw new Error(e[0]);
  console.log('PUZZLES OK');
};
