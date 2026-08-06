// Node smoke test for THE VAST: exercises the pure world logic hard
// (determinism, ranges, placement) and constructs every 3D system with
// scene stubs so reference errors surface without a browser.
// Run: npm run smoke:vast

globalThis.window = globalThis;
globalThis.self = globalThis;
try { globalThis.navigator ??= { userAgent: 'node' }; } catch { /* node 21+ getter */ }
globalThis.requestAnimationFrame = () => 0;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.document = {
  createElement: () => ({ style: {}, getContext: () => new Proxy({}, { get: () => () => ({}) }), width: 0, height: 0 }),
  getElementById: () => null,
  addEventListener() {},
};

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

const THREE = await import('../vendor/three.module.js');
const sceneStub = () => ({ add() {}, remove() {}, background: null, fog: null });

await step('noise: deterministic + bounded', async () => {
  const { noise2, fbm, ridged, hash2, mulberry32 } = await import('../src/vast/noise.js');
  for (const [x, y] of [[0.5, 0.5], [123.7, -45.2], [99999.1, 88888.8], [-5000.5, 12345.6]]) {
    const a = noise2(42, x, y), b = noise2(42, x, y);
    if (a !== b) throw new Error('noise2 not deterministic');
    if (Math.abs(a) > 1) throw new Error('noise2 out of range: ' + a);
    if (Math.abs(fbm(42, x, y, 5)) > 1.01) throw new Error('fbm out of range');
    const r = ridged(42, x, y);
    if (r < 0 || r > 1.01) throw new Error('ridged out of range: ' + r);
  }
  if (noise2(1, 5.5, 5.5) === noise2(2, 5.5, 5.5)) throw new Error('seeds should differ');
  const rng = mulberry32(7);
  const seq1 = [rng(), rng(), rng()];
  const rng2 = mulberry32(7);
  if (seq1[0] !== rng2() || seq1[1] !== rng2()) throw new Error('mulberry32 not reproducible');
  if (hash2(1, 10, 20) === hash2(1, 20, 10)) throw new Error('hash2 symmetric collision');
});

await step('world: heights, biomes, colors sane out to 100km', async () => {
  const { World, BIOMES } = await import('../src/vast/world.js');
  const w1 = new World(1234), w2 = new World(1234), w3 = new World(99);
  let sawLand = 0, sawSea = 0;
  for (let i = 0; i < 300; i++) {
    const x = (i * 733.7) % 100000 - 50000, z = (i * 1291.3) % 100000 - 50000;
    const h = w1.heightAt(x, z);
    if (!Number.isFinite(h)) throw new Error('height not finite');
    if (h < -60 || h > 220) throw new Error('height out of expected envelope: ' + h);
    if (h !== w2.heightAt(x, z)) throw new Error('world not deterministic');
    if (h > 0.5) sawLand++; else sawSea++;
    const b = w1.biomeAt(x, z, h);
    if (!BIOMES[b]) throw new Error('unknown biome: ' + b);
    const c = w1.colorAt(x, z, h);
    for (const v of c) if (!(v >= 0 && v <= 1)) throw new Error('color out of range');
  }
  if (!sawLand || !sawSea) throw new Error(`world lacks variety (land ${sawLand}, sea ${sawSea})`);
  if (w1.heightAt(777, 777) === w3.heightAt(777, 777)) throw new Error('different seeds identical');
  const s = w1.findSpawn();
  const hs = w1.heightAt(s.x, s.z);
  if (hs < 1 || hs > 30) throw new Error('spawn not on walkable land: h=' + hs);
});

await step('names: deterministic and shaped', async () => {
  const { properName, regionName, poiName } = await import('../src/vast/names.js');
  if (properName(42) !== properName(42)) throw new Error('properName not deterministic');
  for (let i = 0; i < 60; i++) {
    const n = properName(i * 977);
    if (n.length < 3) throw new Error('name too short: ' + n);
    const r = regionName(i * 313, ['plains', 'forest', 'desert', 'snow'][i % 4]);
    if (!r || r.length < 5) throw new Error('bad region name: ' + r);
    for (const t of ['shrine', 'ruin', 'camp', 'tower', 'stones', 'village', 'obelisk']) {
      if (!poiName(i * 71, t)) throw new Error('empty poi name');
    }
  }
});

await step('poi field: deterministic placement on land', async () => {
  const { World, SEA_LEVEL } = await import('../src/vast/world.js');
  const { POIField, CELL } = await import('../src/vast/poi.js');
  const w = new World(555);
  const f1 = new POIField(w), f2 = new POIField(w);
  let count = 0;
  for (let cz = -8; cz <= 8; cz++) {
    for (let cx = -8; cx <= 8; cx++) {
      const a = f1.poiForCell(cx, cz), b = f2.poiForCell(cx, cz);
      if ((a === null) !== (b === null)) throw new Error('poi determinism');
      if (!a) continue;
      count++;
      if (a.id !== b.id || a.x !== b.x || a.type !== b.type) throw new Error('poi mismatch');
      if (w.heightAt(a.x, a.z) < SEA_LEVEL + 1) throw new Error('poi under water');
      if (!a.name) throw new Error('poi unnamed');
      if (Math.floor(a.x / CELL) !== cx) throw new Error('poi outside its cell');
    }
  }
  if (count < 20) throw new Error('too few POIs in 17x17 cells: ' + count);
  const near = f1.poisNear(0, 0, 2000);
  for (const p of near) {
    if (Math.hypot(p.x, p.z) > 2000) throw new Error('poisNear returned far poi');
  }
  const r = f1.regionAt(1234, -9876);
  if (!r.name || !r.id) throw new Error('bad region');
});

await step('flora: library + scatter builds instanced chunks', async () => {
  const { World } = await import('../src/vast/world.js');
  const { POIField } = await import('../src/vast/poi.js');
  const { makeFloraLib, makeScatterer } = await import('../src/vast/flora.js');
  const lib = makeFloraLib();
  for (const k of ['conifer', 'broadleaf', 'palm', 'cactus', 'grass', 'rock', 'flower', 'reed']) {
    if (!lib[k] || !lib[k].geo.getAttribute('position').count) throw new Error('bad species ' + k);
  }
  const w = new World(321);
  const scatter = makeScatterer(w, new POIField(w), lib);
  const s = w.findSpawn();
  let any = null;
  for (let d = 0; d < 6 && !any; d++) any = scatter(Math.floor(s.x / 64) + d, Math.floor(s.z / 64));
  if (!any) throw new Error('no flora near spawn');
  if (!any.children.some((m) => m.isInstancedMesh && m.count > 0)) throw new Error('no instances');
});

await step('terrain: chunk + far tiles + water build headless', async () => {
  const { World } = await import('../src/vast/world.js');
  const { Terrain } = await import('../src/vast/terrain.js');
  globalThis.performance ??= { now: () => Date.now() };
  const w = new World(777);
  const t = new Terrain(sceneStub(), w, { radius: 1, floraRadius: 0 });
  t.pregenerate(0, 0, 1);
  if (t.chunkCount() !== 9) throw new Error('expected 9 chunks, got ' + t.chunkCount());
  for (const rec of t.chunks.values()) {
    const pos = rec.mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      if (!Number.isFinite(pos.getY(i))) throw new Error('NaN vertex');
    }
  }
  t.update(200, 200, 50);
  t.dispose();
});

await step('structures: every POI type builds', async () => {
  const { World } = await import('../src/vast/world.js');
  const { POIField } = await import('../src/vast/poi.js');
  const { POIManager } = await import('../src/vast/structures.js');
  const w = new World(11);
  const state = { discovered: new Set(), litShrines: new Set(), relics: new Set(), rumors: new Set() };
  const mgr = new POIManager(sceneStub(), w, new POIField(w), state);
  for (const type of ['shrine', 'ruin', 'camp', 'stones', 'tower', 'village', 'obelisk']) {
    const rec = mgr._build({ id: 'poi_0_0', type, x: 10, z: 10, y: 5, name: 'Test', hasRelic: true, variant: 0.4 });
    if (!rec.group.children.length) throw new Error('empty structure: ' + type);
  }
  // discovery + interact flow
  const poi = { id: 'poi_1_1', type: 'shrine', x: 0, z: 0, y: 5, name: 'S', hasRelic: false, variant: 0.1 };
  mgr.active.set(poi.id, mgr._build(poi));
  let discovered = null;
  mgr.onDiscover = (p) => (discovered = p);
  mgr.update(1, 1, 0.016, false);
  if (!discovered) throw new Error('no discovery at 1m');
  if (!mgr.prompt || mgr.prompt.kind !== 'awaken') throw new Error('no awaken prompt');
  mgr.interact();
  if (!state.litShrines.has(poi.id)) throw new Error('shrine not lit');
});

await step('player + horse: physics ticks stay finite', async () => {
  const { World } = await import('../src/vast/world.js');
  const { Player } = await import('../src/vast/player.js');
  const { Horse } = await import('../src/vast/horse.js');
  globalThis.performance ??= { now: () => Date.now() };
  const w = new World(2024);
  const p = new Player(sceneStub(), w, { step() {}, splash() {} });
  const s = w.findSpawn();
  p.pos.set(s.x, w.heightAt(s.x, s.z) + 0.5, s.z);
  const inp = { moveX: 0, moveZ: -1, sprint: true, jump: false, lookDX: 2, lookDY: 1, wheel: 0 };
  for (let i = 0; i < 400; i++) p.update(0.016, inp, false);
  if (!Number.isFinite(p.pos.x + p.pos.y + p.pos.z)) throw new Error('player pos NaN');
  if (Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 5) throw new Error('player never moved');
  if (p.stamina >= 1) throw new Error('sprint should drain stamina');
  const cam = { position: new THREE.Vector3(), lookAt() {} };
  p.applyCamera(cam, 0.016);
  if (!Number.isFinite(cam.position.y)) throw new Error('camera NaN');

  const h = new Horse(sceneStub(), w, {});
  h.whistle(p.pos.x, p.pos.z, 0);
  for (let i = 0; i < 300; i++) h.update(0.016, inp, 0, p.pos.x, p.pos.z);
  if (!Number.isFinite(h.pos.x + h.pos.y + h.pos.z)) throw new Error('horse pos NaN');
  if (h.state !== 'grazing' && h.distTo(p.pos.x, p.pos.z) > 60) throw new Error('horse never came: ' + h.state);
  const seat = h.seatWorld();
  if (!Number.isFinite(seat.y)) throw new Error('seat NaN');
});

await step('sky + fauna: tick without a renderer', async () => {
  const { Sky } = await import('../src/vast/sky.js');
  const { Fauna } = await import('../src/vast/fauna.js');
  const { World } = await import('../src/vast/world.js');
  const scene = sceneStub();
  const sky = new Sky(scene, 5);
  for (let t = 0; t < 1; t += 0.05) sky.update(0.1, t, 0, 10, 0);
  if (!Number.isFinite(sky.sun.intensity)) throw new Error('sun intensity NaN');
  if (!scene.fog || !Number.isFinite(scene.fog.near)) throw new Error('fog broken');
  const fauna = new Fauna(sceneStub(), new World(3));
  for (let i = 0; i < 120; i++) fauna.update(0.05, 0, 0, i % 2 === 0, 10);
});

await step('audio module parses (no context in node)', async () => {
  const { sfx } = await import('../src/vast/audio.js');
  sfx.update(0.016, { wind: 0.5, rain: 0.2, night: 1 }); // must not throw without ctx
  sfx.step('grass');
});

await step('save: roundtrip through localStorage', async () => {
  const { saveGame, loadGame, clearGame } = await import('../src/vast/save.js');
  const ok = saveGame({
    seed: 42, pos: { x: 1, y: 2, z: 3 }, camYaw: 0.5, dayT: 0.4, day: 3, stamina: 0.8,
    discovered: new Set(['poi_1_2']), litShrines: new Set(), relics: new Set(['poi_1_2']),
    rumors: new Set(), explored: new Set(['0,0']), stats: { dist: 1234, playTime: 60 },
    horse: { state: 'away', x: 0, z: 0 }, muted: false,
  });
  if (!ok) throw new Error('save failed');
  const d = loadGame();
  if (d.seed !== 42 || d.pos[2] !== 3 || d.discovered[0] !== 'poi_1_2') throw new Error('bad roundtrip');
  clearGame();
  if (loadGame() !== null) throw new Error('clear failed');
});

console.log(failures ? `\n${failures} failure(s)` : '\nall VAST smoke checks passed');
process.exit(failures ? 1 : 0);
