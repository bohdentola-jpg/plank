// Node smoke test for CHROMA CLASH core systems (no browser needed).
//   node chroma/tools/smoke.mjs
import { register } from 'node:module';
register('./three-loader.mjs', import.meta.url);
const THREE = await import('three');

let failures = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('ok  ', name); }
  catch (e) { failures++; console.log('FAIL', name, '-', e.message); console.log(e.stack.split('\n').slice(1, 3).join('\n')); }
};
// the game imports 'three' as a bare specifier; map it for node via a loader hook
const { PaintSystem, TEAM_A, TEAM_B } = await import('../src/world/paint.js');
const { Level } = await import('../src/world/level.js');
const { NavGrid } = await import('../src/actors/bot.js');

function recount(ps) {
  const c = [0, 0, 0];
  for (const f of ps.faces) {
    if (!f.isFloor || !f.paintable) continue;
    for (let j = 2; j < 2 + f.ch; j++) for (let i = 2; i < 2 + f.cw; i++) {
      const idx = ((f.y0 + j) * ps.size + f.x0 + i) * 4;
      const a = ps.data[idx], b = ps.data[idx + 1];
      c[a >= 128 ? 1 : b >= 128 ? 2 : 0]++;
    }
  }
  return c;
}

function testLevel() {
  const paint = new PaintSystem({ size: 1024, tpm: 8 });
  const lvl = new Level(paint);
  lvl.box([-10, -2, -10], [10, 0, 10], { mat: 'floor' });
  lvl.box([2, 0, -2], [4, 2, 2], { mat: 'concrete' });
  lvl.ramp([-6, 0, -2], [-3, 1.5, 2], '+x', { mat: 'concrete' });
  lvl.box([-3, 0, -2], [0, 1.5, 2], { mat: 'concrete' });
  lvl.build();
  paint.finalize();
  return { paint, lvl };
}

await step('paint: turf counts stay consistent', () => {
  const { paint } = testLevel();
  const p = new THREE.Vector3();
  for (let i = 0; i < 1500; i++) {
    p.set(Math.random() * 20 - 10, Math.random() * 2, Math.random() * 20 - 10);
    paint.splat(p, 0.3 + Math.random() * 2.5, Math.random() < 0.5 ? TEAM_A : TEAM_B, { drips: 2 });
  }
  const c = recount(paint);
  if (paint.count.some((v) => v < 0)) throw new Error('negative count ' + paint.count);
  if (c[1] !== paint.count[1] || c[2] !== paint.count[2]) throw new Error(`drift: incremental ${paint.count} vs actual ${c}`);
  const cov = paint.coverage();
  if (!(cov.a > 0.1 && cov.b > 0.1)) throw new Error('coverage too low ' + JSON.stringify(cov));
  paint.clear();
  if (paint.coverage().a !== 0) throw new Error('clear failed');
});

await step('level: ground, ramps, collision, raycast', () => {
  const { lvl } = testLevel();
  const g = lvl.groundAt(0, 5, 0.2, 0.2, 0.5);
  if (Math.abs(g.y) > 1e-6) throw new Error('floor height ' + g.y);
  const r = lvl.groundAt(-4.5, 0, 1, 0.2, 0.5);
  if (Math.abs(r.y - 0.75) > 0.05) throw new Error('ramp mid height ' + r.y);
  const pos = new THREE.Vector3(1.8, 0, 0), vel = new THREE.Vector3(5, 0, 0);
  const wall = lvl.collide(pos, vel, 0.36, 1.45, 0.45);
  if (!wall || pos.x > 2 - 0.35) throw new Error('wall push failed ' + pos.x);
  if (vel.x > 0) throw new Error('velocity into wall not removed');
  if (!wall.face) throw new Error('wall face missing');
  const hit = lvl.raycast(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), 20);
  if (!hit || Math.abs(hit.point.x - 2) > 1e-3) throw new Error('raycast x ' + hit?.point.x);
  const down = lvl.raycast(new THREE.Vector3(-4.5, 5, 0), new THREE.Vector3(0, -1, 0), 20);
  if (!down || Math.abs(down.point.y - 0.75) > 0.05 || !down.face) throw new Error('ramp raycast ' + down?.point.y);
  if (lvl.visible(new THREE.Vector3(0, 1, 0), new THREE.Vector3(6, 1, 0))) throw new Error('LOS through wall');
});

await step('nav: path over ramp + around wall', () => {
  const { lvl } = testLevel();
  const nav = new NavGrid(lvl, { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, 1);
  const path = nav.path(new THREE.Vector3(-8, 0, 0), new THREE.Vector3(-1.5, 1.5, 0));
  if (!path) throw new Error('no path onto platform');
  const p2 = nav.path(new THREE.Vector3(0, 0, -6), new THREE.Vector3(6, 0, 0));
  if (!p2) throw new Error('no path around wall');
});

await step('stage layouts are point-symmetric', async () => {
  const { stageInfo, STAGE_IDS } = await import('../src/world/stage.js');
  for (const id of STAGE_IDS) {
    const d = stageInfo(id);
    for (const [, mn, mx] of d.sym) if (Math.abs(mn[0] + mx[0]) > 1e-6 || Math.abs(mn[2] + mx[2]) > 1e-6) throw new Error(`${id}: sym entry not centred`);
  }
});

await step('all modules parse + import', async () => {
  const mods = ['util', 'engine/post', 'engine/input', 'world/env', 'world/textures', 'world/materials', 'world/plaza', 'world/stage',
    'actors/character', 'actors/gear', 'world/news', 'world/rotation', 'actors/fighter', 'actors/weapons', 'actors/player', 'fx/particles', 'ui/hud', 'ui/menus', 'modes/battle', 'modes/plaza', 'audio'];
  mods.push('story/kit', 'story/course', 'story/props', 'story/enemies', 'story/boss', 'story/levels', 'story/dialogue', 'story/hud', 'modes/story');
  mods.push('net/transport', 'net/room', 'net/netbattle', 'ui/minigame', 'world/tower', 'modes/tower');
  for (const m of mods) await import(`../src/${m}.js`);
});

console.log(failures ? `\n${failures} failure(s)` : '\nall smoke checks passed');
process.exit(failures ? 1 : 0);
