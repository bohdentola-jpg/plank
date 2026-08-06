// geometry.test.mjs — checks the maths that can't be eyeballed from a screenshot:
// face winding (a wrong one renders solids inside-out), voxel/map round trips,
// physics, and the shape of the generated world.
//
// Run: node game/tests/geometry.test.mjs

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  emptyVoxels, setVox, getVox, validateVoxels, resizeVoxels, countVoxels,
  starterShape, voxelSize, MAX_DIM, VOXEL_UNIT,
} from '../js/voxel.js';
import { World, CHUNK, CELL, PLAZA_R, BIOMES, pushBox } from '../js/terrain.js';
import {
  emptyMap, validateMap, mapToCode, codeToMap, stepBody, bodyAABB, entAABB,
  aabbOverlap, createEntity, MAX_OBJECTS, MAX_MODELS,
} from '../js/world.js';
import { mainMap, sampleMap } from '../js/maps.js';
import { compile } from '../js/boxscript.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + (e && e.message || e)); }
}

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map(c => c / l);
};

// ================================================================ winding
// Every triangle's winding must agree with its stored normal, or three.js culls
// the outside of the model and raycasts hit the inside.
test('voxel mesh triangles wind outward', () => {
  const v = setVox(emptyVoxels(3, 3, 3), 1, 1, 1, 0);   // one lonely voxel
  // buildVoxelGeometry needs three.js; verify the raw face table instead by
  // rebuilding the same maths the mesher uses.
  const FACES = [
    { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  ];
  for (const f of FACES) {
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      const n = norm(cross(sub(f.c[b], f.c[a]), sub(f.c[c], f.c[a])));
      const dot = n[0] * f.n[0] + n[1] * f.n[1] + n[2] * f.n[2];
      assert.ok(dot > 0.99, `face ${f.n} winds the wrong way (dot ${dot.toFixed(2)})`);
    }
  }
  assert.strictEqual(countVoxels(v), 1);
});

test('the shipped voxel face table matches the verified one', () => {
  const src = readFileSync(new URL('../js/voxel.js', import.meta.url), 'utf8');
  const m = /const FACES = \[([\s\S]*?)\n\];/.exec(src);
  assert.ok(m, 'FACES table not found');
  const rows = [...m[1].matchAll(/n: \[([-\d, ]+)\], c: \[(.*?)\], shade/g)];
  assert.strictEqual(rows.length, 6, 'expected 6 faces');
  for (const row of rows) {
    const n = row[1].split(',').map(s => +s.trim());
    const corners = [...row[2].matchAll(/\[(\d), (\d), (\d)\]/g)].map(c => [+c[1], +c[2], +c[3]]);
    assert.strictEqual(corners.length, 4, 'a face needs 4 corners');
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      const tn = norm(cross(sub(corners[b], corners[a]), sub(corners[c], corners[a])));
      const dot = tn[0] * n[0] + tn[1] * n[1] + tn[2] * n[2];
      assert.ok(dot > 0.99, `shipped face ${n} winds inward (dot ${dot.toFixed(2)})`);
    }
  }
});

test('the prop cube face table winds outward too', () => {
  const src = readFileSync(new URL('../js/terrain.js', import.meta.url), 'utf8');
  const m = /const CUBE_FACES = \[([\s\S]*?)\n\];/.exec(src);
  assert.ok(m, 'CUBE_FACES not found');
  const rows = [...m[1].matchAll(/n: \[([-\d, ]+)\], v: \[(.*?)\], s:/g)];
  assert.strictEqual(rows.length, 6);
  for (const row of rows) {
    const n = row[1].split(',').map(s => +s.trim());
    const corners = [...row[2].matchAll(/\[(-?\d), (-?\d), (-?\d)\]/g)].map(c => [+c[1], +c[2], +c[3]]);
    assert.strictEqual(corners.length, 4);
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      const tn = norm(cross(sub(corners[b], corners[a]), sub(corners[c], corners[a])));
      const dot = tn[0] * n[0] + tn[1] * n[1] + tn[2] * n[2];
      assert.ok(dot > 0.99, `prop face ${n} winds inward`);
    }
  }
});

// ================================================================ voxels
test('setVox / getVox round trip and bounds', () => {
  let v = emptyVoxels(4, 5, 6);
  assert.strictEqual(getVox(v, 0, 0, 0), -1);
  v = setVox(v, 3, 4, 5, 7);
  assert.strictEqual(getVox(v, 3, 4, 5), 7);
  assert.strictEqual(getVox(v, 4, 4, 5), -1);      // out of range reads empty
  assert.strictEqual(getVox(v, -1, 0, 0), -1);
  const same = setVox(v, 99, 0, 0, 3);             // out of range writes nothing
  assert.strictEqual(same, v);
  v = setVox(v, 3, 4, 5, -1);
  assert.strictEqual(getVox(v, 3, 4, 5), -1);
});

test('voxel data stays immutable so undo can keep old versions', () => {
  const a = setVox(emptyVoxels(3, 3, 3), 1, 1, 1, 2);
  const b = setVox(a, 2, 2, 2, 3);
  assert.notStrictEqual(a.data, b.data);
  assert.strictEqual(getVox(a, 2, 2, 2), -1);
  assert.strictEqual(getVox(b, 1, 1, 1), 2);
});

test('validateVoxels repairs junk', () => {
  const v = validateVoxels({ w: 999, h: -3, d: 'x', data: 'zz!!@@..' });
  assert.ok(v.w <= MAX_DIM && v.w >= 1);
  assert.ok(v.h >= 1 && v.d >= 1);
  assert.strictEqual(v.data.length, v.w * v.h * v.d);
  assert.ok(/^[0-9a-z.]*$/.test(v.data));
  assert.deepStrictEqual(validateVoxels(null).data.length > 0, true);
});

test('resize keeps the overlapping corner', () => {
  let v = setVox(emptyVoxels(8, 8, 8), 1, 2, 3, 5);
  v = resizeVoxels(v, 16, 16, 16);
  assert.strictEqual(v.w, 16);
  assert.strictEqual(getVox(v, 1, 2, 3), 5);
  v = resizeVoxels(v, 4, 4, 4);
  assert.strictEqual(getVox(v, 1, 2, 3), 5);
});

test('starter shapes are not empty and fit their cage', () => {
  for (const kind of ['cube', 'ball', 'box', 'tree', 'pillar']) {
    const v = starterShape(kind, 12, 12, 12);
    assert.ok(countVoxels(v) > 0, kind + ' came out empty');
    assert.strictEqual(v.data.length, 12 * 12 * 12);
  }
});

test('voxelSize scales with the cage', () => {
  const s = voxelSize(emptyVoxels(8, 4, 2));
  assert.deepStrictEqual([s.x, s.y, s.z], [8 * VOXEL_UNIT, 4 * VOXEL_UNIT, 2 * VOXEL_UNIT]);
});

// ================================================================ the world
test('the plaza is flat and the land outside it is not', () => {
  const w = new World(12345);
  for (const [x, z] of [[0, 0], [20, -20], [-40, 30], [60, 0]]) {
    assert.strictEqual(w.heightAt(x, z), 0, `plaza should be flat at ${x},${z}`);
  }
  let bumpy = 0;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const h = w.heightAt(Math.cos(a) * 320, Math.sin(a) * 320);
    if (Math.abs(h) > 1) bumpy++;
  }
  assert.ok(bumpy > 40, 'the land should be hilly, got ' + bumpy + '/60');
});

test('heightAt is stable (the same spot always has the same height)', () => {
  const w = new World(777);
  const a = w.heightAt(123, -456);
  const b = w.heightAt(123, -456);
  assert.strictEqual(a, b);
  const w2 = new World(777);
  assert.strictEqual(w2.heightAt(123, -456), a, 'same seed must give the same world');
  const w3 = new World(778);
  const far = [];
  for (let i = 0; i < 20; i++) far.push(w3.heightAt(i * 40 + 200, 260) !== w.heightAt(i * 40 + 200, 260));
  assert.ok(far.some(Boolean), 'a different seed should give a different world');
});

test('every biome exists somewhere reachable', () => {
  const w = new World(20260806);
  const found = new Set();
  for (let r = 90; r < 1000; r += 26) {
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      found.add(w.biomeAt(Math.cos(a) * r, Math.sin(a) * r));
    }
  }
  for (const need of ['meadow', 'forest', 'desert', 'snow', 'volcano', 'ash']) {
    assert.ok(found.has(need), 'never found the ' + need);
  }
  assert.strictEqual(w.biomeAt(0, 0), 'void');
});

test('every biome the generator can name has a look defined', () => {
  const w = new World(4);
  const seen = new Set();
  for (let r = 0; r < 1900; r += 37) {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      seen.add(w.biomeAt(Math.cos(a) * r, Math.sin(a) * r));
    }
  }
  for (const b of seen) assert.ok(BIOMES[b], 'biome "' + b + '" has no entry in BIOMES');
});

test('the volcano is a real hill with a crater and lava', () => {
  const w = new World(20260806);
  const c = w.volcanoCenter();
  const rim = w.heightAt(c.x + 120, c.z);
  const peakish = w.heightAt(c.x + 52, c.z);
  const middle = w.heightAt(c.x, c.z);
  assert.ok(peakish > rim + 10, `the cone should rise: rim ${rim.toFixed(1)} vs ${peakish.toFixed(1)}`);
  assert.ok(middle < peakish, 'the crater should dip below the cone');
  assert.ok(w.isLava(c.x, w.lavaLevel(), c.z), 'the crater should hold lava');
  assert.ok(!w.isLava(0, 0, 0), 'the plaza is not lava');
});

test('the outer void flattens out again', () => {
  const w = new World(9);
  const h = w.heightAt(2600, 2600);
  assert.ok(Math.abs(h) < 0.5, 'far out should be flat, got ' + h);
  assert.strictEqual(w.biomeAt(2600, 2600), 'outer');
});

test('chunk maths line up', () => {
  assert.strictEqual(CHUNK % CELL, 0);
  assert.ok(PLAZA_R > 40);
});

test('pushBox emits whole triangles', () => {
  const pos = [], nor = [], col = [];
  pushBox(pos, nor, col, { r: 1, g: 1, b: 1 }, 0, 0, 0, 2, 2, 2, 0.7);
  assert.strictEqual(pos.length, 6 * 6 * 3);       // 6 faces × 2 tris × 3 verts × 3
  assert.strictEqual(pos.length, nor.length);
  assert.strictEqual(pos.length, col.length);
  assert.ok(pos.every(Number.isFinite));
});

// ================================================================ physics
function makeBody(x, y, z) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, r: 0.5, h: 3, onGround: false };
}
const flatWorld = { heightAt: () => 0 };

test('a body falls and lands on the ground', () => {
  const b = makeBody(0, 10, 0);
  for (let i = 0; i < 120; i++) stepBody(b, 1 / 60, [], flatWorld, {});
  assert.ok(Math.abs(b.y) < 0.01, 'should rest at y=0, got ' + b.y);
  assert.ok(b.onGround);
  assert.strictEqual(b.vy, 0);
});

test('a body lands on a box instead of through it', () => {
  const box = { x0: -2, x1: 2, y0: 0, y1: 4, z0: -2, z1: 2 };
  const b = makeBody(0, 12, 0);
  for (let i = 0; i < 200; i++) stepBody(b, 1 / 60, [box], flatWorld, {});
  assert.ok(Math.abs(b.y - 4) < 0.02, 'should stand on top (y=4), got ' + b.y);
  assert.ok(b.onGround);
});

test('a wall stops sideways movement but you keep sliding along it', () => {
  const wall = { x0: 2, x1: 3, y0: 0, y1: 6, z0: -20, z1: 20 };
  const b = makeBody(0, 0, 0);
  b.vx = 8; b.vz = 8;
  for (let i = 0; i < 60; i++) { b.vx = 8; b.vz = 8; stepBody(b, 1 / 60, [wall], flatWorld, {}); }
  assert.ok(b.x < 2, 'should not pass the wall, x=' + b.x);
  assert.ok(b.z > 4, 'should still slide along it, z=' + b.z);
});

test('a low ledge is stepped up, a high one is not', () => {
  const low = { x0: 1, x1: 4, y0: 0, y1: 0.5, z0: -4, z1: 4 };
  const b = makeBody(0, 0, 0);
  for (let i = 0; i < 40; i++) { b.vx = 6; stepBody(b, 1 / 60, [low], flatWorld, { stepUp: 0.9 }); }
  assert.ok(b.x > 2, 'should have climbed the low ledge, x=' + b.x);

  const high = { x0: 1, x1: 4, y0: 0, y1: 3, z0: -4, z1: 4 };
  const c = makeBody(0, 0, 0);
  for (let i = 0; i < 40; i++) { c.vx = 6; stepBody(c, 1 / 60, [high], flatWorld, { stepUp: 0.9 }); }
  assert.ok(c.x < 1, 'should be blocked by the high one, x=' + c.x);
});

test('a bouncy body bounces and settles', () => {
  const b = makeBody(0, 8, 0);
  let maxUp = 0;
  for (let i = 0; i < 400; i++) {
    stepBody(b, 1 / 60, [], flatWorld, { bounce: 0.5, friction: 4 });
    if (b.vy > 0) maxUp = Math.max(maxUp, b.vy);
  }
  assert.ok(maxUp > 1, 'should have bounced at least once');
  assert.ok(Math.abs(b.y) < 0.05, 'should settle on the floor, y=' + b.y);
});

test('the body follows a hilly ground', () => {
  const hill = { heightAt: (x) => Math.max(0, x) * 0.2 };
  const b = makeBody(0, 1, 0);
  for (let i = 0; i < 120; i++) { b.vx = 5; stepBody(b, 1 / 60, [], hill, {}); }
  assert.ok(b.y > 1, 'should have walked uphill, y=' + b.y);
  assert.ok(Math.abs(b.y - hill.heightAt(b.x)) < 0.2, 'should hug the slope');
});

test('AABB overlap and entity boxes', () => {
  const map = emptyMap();
  const ent = createEntity(map, { model: 'box', x: 0, y: 0, z: 0 });
  const b = entAABB(ent);
  assert.ok(b.y0 === 0 && b.y1 > 0, 'entities sit on their base');
  assert.ok(Math.abs(b.x0 + b.x1) < 1e-9, 'and are centred on x/z');
  const body = bodyAABB(makeBody(0, 0, 0));
  assert.ok(aabbOverlap(b, body));
  assert.ok(!aabbOverlap(b, bodyAABB(makeBody(40, 0, 0))));
});

// ================================================================ map format
test('validateMap fills in and clamps everything', () => {
  const m = validateMap({
    name: 'x'.repeat(90), seed: 'nope', spawn: { x: 1e9, y: 'a', z: -5 },
    objects: [{ model: 'box', x: 1, scale: 99999 }, { nope: 1 }, null],
    models: { ok: { vox: { w: 4, h: 4, d: 4, data: '0'.repeat(64) } } },
  });
  assert.ok(m.name.length <= 40);
  assert.ok(Number.isFinite(m.seed));
  assert.ok(m.spawn.x <= 100000 && m.spawn.y === 0 && m.spawn.z === -5);
  assert.strictEqual(m.objects.length, 1);
  assert.ok(m.objects[0].scale <= 1000);
  assert.ok(m.models.ok);
});

test('validateMap refuses dangerous model and map keys', () => {
  const evil = JSON.parse('{"name":"e","objects":[],"models":{"__proto__":{"vox":{}},"ok":{"vox":{}},"BAD NAME":{"vox":{}}}}');
  const m = validateMap(evil);
  assert.deepStrictEqual(Object.keys(m.models), ['ok']);
  assert.strictEqual(Object.getPrototypeOf(m.models), Object.prototype);
  assert.strictEqual(({}).vox, undefined, 'Object.prototype must be untouched');
});

test('object and model counts are capped', () => {
  const objects = [];
  for (let i = 0; i < MAX_OBJECTS + 200; i++) objects.push({ model: 'box', x: i });
  const models = {};
  for (let i = 0; i < MAX_MODELS + 20; i++) models['m' + i] = { vox: { w: 2, h: 2, d: 2, data: '0'.repeat(8) } };
  const m = validateMap({ name: 'big', objects, models });
  assert.strictEqual(m.objects.length, MAX_OBJECTS);
  assert.strictEqual(Object.keys(m.models).length, MAX_MODELS);
});

test('share codes round trip, including unicode names and scripts', () => {
  const m = emptyMap('naïve — 🎲 map');
  m.objects.push({ id: 'a1', model: 'box', x: 1.5, y: 2, z: -3, yaw: 90, scale: 150, script: 'when start\n  say "héllo"\nend' });
  m.models.thing = { vox: setVox(emptyVoxels(4, 4, 4), 1, 1, 1, 3), solid: true, physical: false, script: null };
  const back = codeToMap(mapToCode(m));
  assert.ok(back, 'should decode');
  assert.strictEqual(back.objects[0].script, m.objects[0].script);
  assert.strictEqual(back.objects[0].yaw, 90);
  assert.strictEqual(back.models.thing.vox.data, m.models.thing.vox.data);
  assert.strictEqual(back.seed, m.seed);
});

test('bad share codes are rejected, not thrown', () => {
  for (const bad of ['', 'nope', 'GM3.!!!!', 'GM3.' + btoa('{oops'), 'GM1.' + btoa('{}')]) {
    assert.strictEqual(codeToMap(bad), null, 'should reject ' + JSON.stringify(bad.slice(0, 12)));
  }
});

// ================================================================ shipped maps
test('the main map is valid and stocked', () => {
  const m = mainMap();
  assert.ok(m.objects.length > 20, 'should be furnished');
  assert.ok(m.objects.some(o => o.model === 'pongtable'), 'needs the ping pong table');
  assert.strictEqual(m.objects.filter(o => o.model === 'blasterstand').length, 2);
  assert.ok(m.objects.filter(o => o.model === 'box' || o.model === 'bigbox').length >= 15, 'needs cardboard');
  assert.notStrictEqual(m.terrain, false, 'the main map has the world switched on');
  // everything sits inside the plaza, so nothing spawns halfway up a mountain
  for (const o of m.objects) {
    assert.ok(Math.hypot(o.x, o.z) < PLAZA_R + 4, `${o.model} at ${o.x},${o.z} is outside the plaza`);
  }
});

test('every script in every shipped map compiles', () => {
  for (const m of [mainMap(), sampleMap()]) {
    for (const o of m.objects) {
      if (!o.script) continue;
      const res = compile(o.script);
      assert.ok(res.ok, `${m.name}/${o.model}: ` + res.errors.map(e => 'L' + e.line + ' ' + e.msg).join(' | '));
    }
    for (const [name, mm] of Object.entries(m.models)) {
      if (!mm.script) continue;
      const res = compile(mm.script);
      assert.ok(res.ok, `${m.name}/model ${name}: ` + res.errors.map(e => 'L' + e.line + ' ' + e.msg).join(' | '));
    }
  }
});

test('the sample map is a void map with a painted model', () => {
  const m = sampleMap();
  assert.strictEqual(m.terrain, false);
  assert.ok(Object.keys(m.models).length >= 1);
  assert.ok(countVoxels(Object.values(m.models)[0].vox) > 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
