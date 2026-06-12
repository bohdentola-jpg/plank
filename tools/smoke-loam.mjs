// Node smoke test for LOAM: exercises the seed→world→light→mesh pipeline,
// crafting, physics, and the composer with DOM stubs — no browser needed.
function stubCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'canvas') return { width: 256, height: 256 };
      if (typeof prop === 'string') return () => {};
      return undefined;
    },
    set() { return true; },
  });
}
function stubCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => stubCtx(), toDataURL: () => 'data:,', appendChild() {} };
}
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? stubCanvas() : { style: {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } }),
  getElementById: () => null,
  addEventListener() {},
};
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.requestAnimationFrame = () => 0;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}`);
    console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  }
}

await step('util: seeded noise is deterministic and bounded', async () => {
  const { rng, Noise2, Noise3, hashStr } = await import('../loam/src/util.js');
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 50; i++) if (a() !== b()) throw new Error('rng diverged');
  const n2 = new Noise2(7), n2b = new Noise2(7), n3 = new Noise3(7);
  for (let i = 0; i < 200; i++) {
    const v = n2.at(i * 0.13, i * 0.07);
    if (v < -1.01 || v > 1.01) throw new Error('noise2 out of range: ' + v);
    if (v !== n2b.at(i * 0.13, i * 0.07)) throw new Error('noise2 nondeterministic');
    const w = n3.at(i * 0.11, i * 0.05, i * 0.09);
    if (w < -1.01 || w > 1.01) throw new Error('noise3 out of range: ' + w);
  }
  if (hashStr('loam') === hashStr('maol')) throw new Error('hash collision (suspicious)');
});

await step('blocks: registry + recipes are coherent', async () => {
  const m = await import('../loam/src/blocks.js');
  for (const [id, b] of Object.entries(m.BLOCKS)) {
    if (id != m.B.air && !b.tiles) throw new Error('no tiles for ' + b.name);
    if (!b.name) throw new Error('unnamed block ' + id);
  }
  const valid = (x) => typeof x === 'string' ? !!m.GROUPS[x] : !!(m.BLOCKS[x] || m.ITEMS[x]);
  for (const r of m.RECIPES) {
    if (!valid(r.out)) throw new Error('recipe out invalid: ' + r.out);
    for (const [what] of r.needs) if (!valid(what)) throw new Error('recipe needs invalid: ' + what);
  }
  const hand = m.breakInfo(m.B.stone, undefined);
  const pick = m.breakInfo(m.B.stone, m.I.woodPick);
  if (!(hand.time > pick.time)) throw new Error('pick should beat hand');
  if (hand.drops || !pick.drops) throw new Error('stone drop gating wrong');
  if (m.breakInfo(m.B.bedrock, m.I.diamondPick)) throw new Error('bedrock must be unbreakable');
  if (m.breakInfo(m.B.ironOre, m.I.woodPick).drops) throw new Error('iron needs stone pick');
});

await step('textures: atlas, icons, logo build with stub canvas', async () => {
  const m = await import('../loam/src/textures.js');
  const b = await import('../loam/src/blocks.js');
  const atlas = m.buildAtlas();
  for (const id of Object.values(b.B)) {
    if (id === b.B.air) continue;
    const t = m.tilesFor(id);
    for (const name of [t.top, t.side, t.bottom, t.front]) {
      if (!(name in atlas.index)) throw new Error('missing tile ' + name);
    }
    const c = m.avgColor(id);
    if (!(c[0] >= 0 && c[0] <= 1)) throw new Error('bad avg color for block ' + id);
  }
  const [u0, v0, u1, v1] = m.tileUV('grass_top');
  if (!(u1 > u0 && v1 > v0)) throw new Error('uv rect inverted');
  m.logoCanvas('LOAM');
  m.crackCanvases();
  for (const it of Object.values(b.ITEMS)) m.itemIconCanvas(it.icon);
});

await step('worldgen: deterministic chunks, sane strata, dry spawn', async () => {
  const { WorldGen, CH, WORLD_H, SEA, idx } = await import('../loam/src/worldgen.js');
  const { B } = await import('../loam/src/blocks.js');
  const g1 = new WorldGen(1337), g2 = new WorldGen(1337), g3 = new WorldGen(7);
  const c1 = g1.genChunk(0, 0), c2 = g2.genChunk(0, 0), c3 = g3.genChunk(0, 0);
  if (Buffer.compare(Buffer.from(c1), Buffer.from(c2)) !== 0) throw new Error('same seed differs');
  if (Buffer.compare(Buffer.from(c1), Buffer.from(c3)) === 0) throw new Error('different seeds identical');
  let bedrock = 0, surface = 0, ore = 0;
  for (let z = 0; z < CH; z++) {
    for (let x = 0; x < CH; x++) {
      if (c1[idx(x, 0, z)] === B.bedrock) bedrock++;
      for (let y = 1; y < WORLD_H; y++) {
        const b = c1[idx(x, y, z)];
        if (b === B.grass || b === B.sand || b === B.snowyGrass || b === B.gravel || b === B.snow || b === B.stone) surface = Math.max(surface, y);
        if (b === B.coalOre || b === B.ironOre) ore++;
      }
    }
  }
  if (bedrock !== 256) throw new Error('bedrock floor has holes');
  if (surface < 10 || surface > WORLD_H - 4) throw new Error('surface out of range: ' + surface);
  const s = g1.findSpawn();
  if (g1.biomeAt(Math.floor(s.x), Math.floor(s.z)) === 'ocean') throw new Error('spawned at sea');
  if (s.y <= SEA) throw new Error('spawn underwater');
});

await step('world: skylight pours, torch glows, edits stick', async () => {
  const { World, B } = { ...(await import('../loam/src/world.js')), ...(await import('../loam/src/blocks.js')) };
  const w = new World(1337);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.ensureChunk(dx, dz);
  for (const c of w.chunks.values()) w.relight(c);
  const x = 4, z = 4;
  const top = w.surfaceY(x, z);
  const skyAbove = (w.lightAt(x, top + 1, z) >> 4) & 15;
  if (skyAbove !== 15) throw new Error('open sky should be 15, got ' + skyAbove);
  // wall in a pocket and torch it
  const ty = 20;
  for (let dy = -1; dy <= 1; dy++) for (let dxx = -1; dxx <= 1; dxx++) for (let dzz = -1; dzz <= 1; dzz++) {
    w.setBlock(x + dxx, ty + dy, z + dzz, B.stone);
  }
  w.setBlock(x, ty, z, B.air);
  for (const c of w.chunks.values()) if (c.lightDirty) w.relight(c);
  if ((w.lightAt(x, ty, z) & 15) !== 0) throw new Error('sealed pocket should be dark');
  w.setBlock(x, ty, z, B.torch);
  for (const c of w.chunks.values()) if (c.lightDirty) w.relight(c);
  if ((w.lightAt(x, ty, z) & 15) !== 14) throw new Error('torch cell should be 14');
  w.setBlock(x, ty + 1, z, B.air);
  w.setBlock(x, ty + 2, z, B.air);
  for (const c of w.chunks.values()) if (c.lightDirty) w.relight(c);
  if ((w.lightAt(x, ty + 2, z) & 15) !== 12) throw new Error('torch light should fade by 1 per block');
  if (!w.diffs['0,0']) throw new Error('edits not recorded in diffs');
  const w2 = new World(1337, JSON.parse(JSON.stringify(w.diffs)));
  w2.ensureChunk(0, 0);
  if (w2.block(x, ty, z) !== B.torch) throw new Error('diff replay failed');
});

await step('mesher: a lone cube is 6 faces, buried is 0', async () => {
  const { buildChunkMesh } = await import('../loam/src/mesher.js');
  const { B } = await import('../loam/src/blocks.js');
  const uv = () => [0, 0, 1, 1];
  const mk = (blockFn) => buildChunkMesh(
    { block: blockFn, lightAt: () => 0xf0 },
    { cx: 0, cz: 0, blocks: (() => {
      const a = new Uint8Array(16 * 16 * 96);
      for (let y = 0; y < 96; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        a[x + (z << 4) + (y << 8)] = blockFn(x, y, z);
      }
      return a;
    })() },
    uv,
  );
  const lone = mk((x, y, z) => (x === 8 && y === 8 && z === 8 ? B.stone : B.air));
  if (lone.solid.count !== 36) throw new Error('lone cube: expected 36 indices, got ' + lone.solid.count);
  if (lone.solid.pos.length !== 24 * 3) throw new Error('lone cube: expected 24 verts');
  const buried = mk(() => B.stone);
  if (buried.solid.count !== 0) throw new Error('buried world should mesh empty (neighbors read as stone)');
  const flower = mk((x, y, z) => (x === 8 && y === 8 && z === 8 ? B.poppy : B.air));
  if (flower.solid.count !== 4 * 6) throw new Error('cross block should be 4 quads');
});

await step('inventory: stack, craft, smelt, wear, round-trip', async () => {
  const { Inventory, doCraft, canCraft } = await import('../loam/src/inventory.js');
  const { B, I, RECIPES } = await import('../loam/src/blocks.js');
  const inv = new Inventory();
  inv.add(B.log, 70);
  if (inv.slots[0].n !== 64 || inv.slots[1].n !== 6) throw new Error('stack split wrong');
  const planks = RECIPES.find((r) => r.out === B.planks);
  if (!canCraft(planks, inv)) throw new Error('should craft planks from logs');
  doCraft(planks, inv);
  if (inv.countOf(B.planks) !== 4 || inv.countOf(B.log) !== 69) throw new Error('craft math wrong');
  const sticks = RECIPES.find((r) => r.out === I.stick);
  doCraft(sticks, inv);
  const pick = RECIPES.find((r) => r.out === I.woodPick);
  doCraft(planks, inv); doCraft(planks, inv);
  if (!canCraft(pick, inv)) throw new Error('should afford wooden pick');
  doCraft(pick, inv);
  const slot = inv.slots.find((s) => s && s.id === I.woodPick);
  if (!slot || slot.uses !== 60) throw new Error('tool durability missing');
  // furnace needs fuel
  const glass = RECIPES.find((r) => r.out === B.glass);
  inv.add(B.sand, 2);
  if (!doCraft(glass, inv)) throw new Error('smelt failed with plank fuel available');
  const data = inv.serialize();
  const inv2 = Inventory.restore(data);
  if (inv2.countOf(B.planks) !== inv.countOf(B.planks)) throw new Error('serialize round-trip');
  inv2.sel = inv2.slots.findIndex((s) => s && s.id === I.woodPick);
  for (let i = 0; i < 59; i++) if (inv2.wearHeld()) throw new Error('tool died early');
  if (!inv2.wearHeld()) throw new Error('tool should shatter at zero');
});

await step('player: falls onto ground, raycast finds the floor', async () => {
  const { Player, raycast } = await import('../loam/src/player.js');
  const { B } = await import('../loam/src/blocks.js');
  const flat = { block: (x, y, z) => (y < 10 ? B.stone : B.air) };
  const p = new Player(flat, 'survival');
  p.pos = { x: 0.5, y: 14, z: 0.5 };
  const input = { fwd: 0, back: 0, left: 0, right: 0, jump: 0, sneak: 0, sprint: 0 };
  for (let i = 0; i < 240; i++) p.update(1 / 60, input);
  if (!p.onGround) throw new Error('never landed');
  if (Math.abs(p.pos.y - 10) > 0.05) throw new Error('rests at ' + p.pos.y + ', want 10');
  if (p.dead) throw new Error('died from a 4-block fall? hp=' + p.hp);
  const hit = raycast(flat, { x: 0.5, y: 12, z: 0.5 }, { x: 0, y: -1, z: 0 }, 5);
  if (!hit || hit.y !== 9) throw new Error('raycast missed the floor: ' + JSON.stringify(hit));
  if (hit.face[1] !== 1) throw new Error('hit face should be +y');
});

await step('composer: every mood writes a coherent piece', async () => {
  const { composePiece } = await import('../loam/src/audio.js');
  for (const mood of ['menu', 'day', 'night', 'cave']) {
    const p = composePiece(mood, 123);
    if (!p.events.length || !p.pads.length) throw new Error(mood + ': empty piece');
    if (!p.name) throw new Error(mood + ': unnamed');
    let last = 0;
    for (const e of p.events) {
      if (e.freq < 40 || e.freq > 4500) throw new Error(mood + ': note out of range ' + e.freq);
      if (e.vel <= 0 || e.vel > 1.2) throw new Error(mood + ': bad velocity');
      if (e.t < last - 0.2) throw new Error(mood + ': events badly out of order');
      last = Math.max(last, e.t);
    }
    if (p.length < 30) throw new Error(mood + ': piece too short ' + p.length);
  }
  const a = composePiece('menu', 1), b = composePiece('menu', 2);
  if (a.events.length !== b.events.length) throw new Error('menu theme must be deterministic');
});

await step('save: seed parsing', async () => {
  const { parseSeed } = await import('../loam/src/save.js');
  if (parseSeed('1337') !== 1337) throw new Error('numeric seed');
  if (parseSeed('herobrine') !== parseSeed('herobrine')) throw new Error('text seed unstable');
  const r = parseSeed('');
  if (!(r >= 0)) throw new Error('random seed broken');
});

await step('three-dependent modules parse (entities, mobs, render, ui)', async () => {
  await import('../loam/src/entities.js');
  await import('../loam/src/mobs.js');
  await import('../loam/src/render.js');
  await import('../loam/src/ui.js');
});

console.log(failures ? `\n${failures} failure(s)` : '\nall loam smoke checks passed');
process.exit(failures ? 1 : 0);
