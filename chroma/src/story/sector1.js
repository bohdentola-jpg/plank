// Sector 1: the Paint Works. The original five levels, each extended with new
// sections (paint switches, moving catwalks, silo lifts, arenas), side paths,
// Hue Shards and three Lost Swatches. Level 5 is the Gray Engine.
import * as THREE from 'three';
import { rng } from '../util.js';
import { canvasTexture, HFONT, std, part, rod } from './kit.js';
import { WALL, WOOD, S1, sign, floor, walls, island, crates } from './build.js';
import { SAY } from './dialogue.js';

// ============================================================== L1: First Splash (tutorial)
export function buildL1(c) {
  const floorM = { mat: 'concrete', color: 0xd9b48c };
  c.box([-7, -1, -5], [7, 0, 24], floorM);
  c.wall([-8, 0, -6], [8, 8, -5], WALL);
  c.wall([-8, 0, -5], [-7, 8, 38], WALL);
  c.wall([7, 0, -5], [8, 8, 38], WALL);
  // paint barrels crate (swatch on top, climb it!)
  c.box([-7, 0, 15], [-4.4, 3.2, 19], { mat: 'container', color: 0x9a6b4f });
  // the climbing wall / upper deck
  c.box([-7, -1, 24], [7, 3.2, 38], { mat: 'concrete', color: 0xcfa985 });
  // pit walls
  c.wall([-8, -5, 38], [-7, 8, 47], WALL);
  c.wall([7, -5, 38], [8, 8, 47], WALL);
  // arena 1
  c.box([-10, -3, 47], [10, 3.2, 70], floorM);
  c.wall([-11, -3, 47], [-10, 10, 71], WALL);
  c.wall([10, -3, 47], [11, 10, 71], WALL);
  c.wall([-11, 3.2, 70], [-2.5, 10, 71], WALL);
  c.wall([2.5, 3.2, 70], [11, 10, 71], WALL);
  c.box([-2.5, 7.4, 70], [2.5, 10, 71], WALL);
  c.box([-5, 3.2, 55], [-3.4, 4.5, 56.6], WOOD);
  c.box([3.6, 3.2, 58], [5.2, 4.5, 59.6], WOOD);
  c.box([-2.4, 3.2, 64.3], [2.4, 3.55, 68.7], { mat: 'grate', color: 0xc0b8c4 });
  // the first paint switch opens the way on
  c.door('l1door', [-2.5, 3.2, 70], [2.5, 7.4, 71], { dir: 'up' });
  c.paintSwitch('l1sw', [-6.4, 4.0, 69.55], [-4.2, 6.2, 70], 'nz', { targets: ['l1door'], label: 'Door unlocked' });
  c.spawnAt([0, 0, -2.2], 0);
  c.gooAt([-3, 0.02, 7], 1.6); c.gooAt([3.4, 0.02, 8.6], 1.3); c.gooAt([0.5, 3.22, 60], 2.0); c.gooAt([-6, 3.22, 52], 1.4);
  c.inkLane([0, 0.05, 11], [0, 0.05, 22.5], 1.5);
  c.checkpoint([0, 3.2, 27.5], 0);
  c.checkpoint([0, 3.2, 51.5], 0);
  c.pad([0, 3.2, 34.5], [0, 3.2, 51], 4);
  c.swatchAt([-5.7, 4.5, 17]);
  c.enemy('smudge', [-3, 3.2, 61.5]);
  c.enemy('smudge', [3, 3.2, 63]);
  c.tip([-7, -5], [7, 5.5], '<b>WASD</b> move · <b>Mouse</b> aim · <b>LMB</b> paint · <b>SPACE</b> jump. Try painting the floor!');
  c.tip([-7, 5.5], [7, 10.5], 'Gray goo is <b>Drab ink</b>: it slows you down and wears you out. Paint over it!');
  c.tip([-7, 10.5], [7, 20.5], 'Hold <b>SHIFT</b> in your own ink to <b>swim</b>. It\'s fast, and it <b>refills your ink</b>!');
  c.tip([-7, 20.5], [7, 24.2], 'Paint the wall, then swim into it (<b>SHIFT + W</b>) to <b>climb</b> it!', { maxY: 2 });
  c.tip([-7, 29], [7, 38], 'Step on the <b>jump pad</b> to launch across the pit!', { minY: 2.5 });
  c.tip([-10, 49], [10, 60], 'Splash the <b>Smudges</b>! They hop at you and bite.', { minY: 2.5 });
  c.tip([-10, 60], [10, 70], 'See the <b>glowing frame</b> on the wall? Cover that <b>switch</b> in ink to open the door!', { minY: 2.5 });
  c.say([-10, 62], [10, 70], SAY.l1_switch, { minY: 2.5 });
  // shards: a trail that teaches "pick these up"
  c.shardLine([0, 0.1, 1], [0, 0.1, 9], 5);
  c.shardLine([-5.7, 3.3, 15.6], [-5.7, 3.3, 18.4], 2);
  c.shardLine([0, 3.3, 29], [0, 3.3, 33], 3);
  c.shardLine([0, 6.5, 38], [0, 6.5, 45], 4, { arc: 0 });
  c.shard([-7.8 + 0.9, 4.6, 48.5], true);
  // ---- section 4: the vat room (climb again, a crate-stair detour)
  c.box([-8, -3, 71], [8, 3.2, 107], floorM);
  c.wall([-9, 3.2, 71], [-8, 14, 107], WALL);
  c.wall([8, 3.2, 71], [9, 14, 107], WALL);
  c.box([-8, 3.2, 85], [8, 8.2, 101], { mat: 'concrete', color: 0xcfa985 });
  c.ramp([-3, 3.2, 101], [3, 8.2, 107], '-z', { mat: 'grate', color: 0xc0b8c4 });
  crates(c, [[-7, 3.2, 74.4, 1.6, 1.0], [-7, 3.2, 76.4, 1.6, 2.0], [-7, 3.2, 78.4, 1.6, 3.0], [-7, 3.2, 80.6, 1.6, 4.0]], WOOD);
  c.swatchAt([-7, 8.6, 80.6]);
  c.vat([5.6, 3.2, 76], 1.6, 3.6, 0x9a6b4f, null);
  c.box([4.2, 3.2, 74.6], [7, 6.8, 77.4], { render: false, paintable: false });
  c.vat([5.6, 3.2, 81.5], 1.4, 3.0, 0x7a6a62, null);
  c.box([4.3, 3.2, 80.2], [6.9, 6.2, 82.8], { render: false, paintable: false });
  c.checkpoint([0, 3.2, 74], 0);
  c.checkpoint([0, 8.2, 88.5], 0);
  c.shardLine([-1.5, 3.3, 76], [1.5, 3.3, 83], 5);
  c.shardLine([0, 8.3, 90], [0, 8.3, 99], 5);
  c.arrow([0, 3.2, 80], 0, { s: 1.4 });
  c.arrow([0, 3.2, 84.6], 0, { wall: Math.PI, s: 1.1 });
  c.tip([-8, 81], [8, 85], 'Another wall: paint it and <b>swim up</b>. Faster this time!', { maxY: 5 });
  c.tip([-8, 71], [-5, 82], 'Crates make good stairs. Is something shiny up there?', { maxY: 9 });
  // ---- section 5: the final mixing floor (arena lock, special meter)
  c.box([-12, -3, 107], [12, 3.2, 131], floorM);
  walls(c, -12, 12, 107, 131, 3.2, 9, { s: [[-3.2, 3.2]], n: [[-2.5, 2.5]] }, WALL);
  c.door('l1a2in', [-3.2, 3.2, 107.1], [3.2, 8.0, 107.7], { dir: 'down', open: true });
  c.door('l1a2out', [-2.5, 3.2, 131], [2.5, 7.4, 132], { dir: 'up' });
  c.box([-2.5, 7.4, 131], [2.5, 12.2, 132], WALL);
  c.box([-7, 3.2, 115], [-5, 4.6, 117], WOOD); c.box([5, 3.2, 115], [7, 4.6, 117], WOOD);
  c.box([-1.5, 3.2, 121.5], [1.5, 4.0, 123.5], { mat: 'grate', color: 0xc0b8c4 });
  c.box([8.5, 3.2, 127.5], [12, 7.4, 131], { mat: 'container', color: 0x8a6b5a });
  c.swatchAt([10.3, 8.8, 129.3]);
  c.shard([9.4, 7.5, 128.4], true);
  c.checkpoint([0, 3.2, 109.0], 0);
  c.arena('a2', [-11, 3.0, 110], [11, 8, 130], {
    name: 'Mixing Floor', doors: ['l1a2in', 'l1a2out'], shards: 8,
    waves: [
      [{ kind: 'smudge', pos: [-6, 3.2, 120] }, { kind: 'smudge', pos: [6, 3.2, 120] }, { kind: 'smudge', pos: [0, 3.2, 126] }],
      [{ kind: 'smudge', pos: [-9, 3.2, 113] }, { kind: 'smudge', pos: [9, 3.2, 113] }, { kind: 'smudge', pos: [-9, 3.2, 127] }, { kind: 'smudge', pos: [6, 3.2, 127] }],
    ],
  });
  c.say([-12, 109], [12, 112], SAY.l1_arena, { minY: 2.5 });
  c.tip([-12, 110], [12, 130], 'Your <b>special</b> meter fills as you paint. When it\'s full, press <b>Q</b>!', { minY: 2.5 });
  c.gooAt([-4, 3.22, 119], 2.2); c.gooAt([5, 3.22, 125], 2.0); c.gooAt([0, 3.22, 113], 1.6);
  // core alcove
  c.box([-5, -3, 131], [5, 3.2, 141], floorM);
  walls(c, -5, 5, 131, 141, 3.2, 8, { s: [[-6, 6]] }, WALL);
  c.coreAt([0, 3.2, 137]);
  c.shardRing([0, 3.3, 137], 3, 6);
  // decor
  c.lamp([0, 6.2, 3], 0xffc070, { intensity: 24, dist: 18 });
  c.lamp([0, 6.2, 17], 0xffc070, { intensity: 24, dist: 18 });
  c.lamp([0, 9.2, 31], 0xffb060, { intensity: 24, dist: 18 });
  c.lamp([0, 9.5, 58], 0xffc070, { intensity: 34, dist: 24 });
  c.lamp([0, 11.5, 90], 0xffc070, { intensity: 26, dist: 20 });
  c.lamp([0, 10.5, 120], 0xffb060, { intensity: 34, dist: 26 });
  c.pipe([[-6.6, 6.5, -5], [-6.6, 6.5, 38]], 0.26, 0x9a7a62);
  c.pipe([[6.6, 5.5, -5], [6.6, 5.5, 20], [6.6, 0, 20]], 0.22, 0x77727f);
  c.pipe([[-9.6, 8.5, 47], [-9.6, 8.5, 70], [9.6, 8.5, 70], [9.6, 8.5, 47]], 0.3, 0x8a8494);
  c.pipe([[-7.6, 12, 71], [-7.6, 12, 107]], 0.28, 0x9a7a62);
  c.pipe([[11.6, 9.5, 107], [11.6, 9.5, 131], [-11.6, 9.5, 131], [-11.6, 9.5, 107]], 0.3, 0x8a8494);
  // gray goo pool down in the pit
  const pool = part(c.decor, new THREE.PlaneGeometry(16, 10), new THREE.MeshPhysicalMaterial({ color: 0x7d7a88, roughness: 0.2, clearcoat: 1 }), { pos: [0, -3.2, 42.5], rot: [-Math.PI / 2, 0, 0], shadow: false, receive: true });
  pool.name = 'pool';
  sign(c, 'MIXING FLOOR · B1', [0, 5.6, -4.9], 6, 1.1, 0, { accent: '#ff3d7f' });
  sign(c, 'VAT ROOM', [0, 11.5, 106.9], 4, 0.9, Math.PI, { accent: '#ffc83d' });
  c.level.killY = -2.8;
}

// ============================================================== L2: Ghost Walk
export function buildL2(c) {
  const isl = { mat: 'concrete', color: 0xb8a48e };
  const isle = (min, max) => island(c, min, max, isl);
  isle([-5, -3, -6], [5, 0, 4]);
  c.ghost([-1.5, -0.6, 4], [1.5, 0, 12]);
  c.ghost([-1.5, -0.6, 12], [9, 0, 15]);
  c.ghost([6, -0.6, 15], [9, 0, 23]);
  isle([3, -3, 23], [12, 0, 31]);
  // hidden branch to the first swatch
  c.ghost([12, -0.6, 26.5], [17, 0, 28.5]);
  c.ghost([17, -0.6, 24.5], [21, 0, 30.5]);
  c.swatchAt([19, 1.3, 27.5]);
  // stepping stones with gaps
  for (const x0 of [-1.0, -5.2, -9.4, -13.6]) c.ghost([x0, -0.6, 26], [x0 + 2.6, 0, 29]);
  isle([-24, -3, 23], [-15, 0, 32]);
  c.pad([-21.5, 0, 30], [-19.5, 3, 43.5], 3.5);
  isle([-24, -3, 40], [-15, 3, 48]);
  c.ghost([-15, 2.4, 43], [-9, 3, 45.5]);
  c.ghost([-7.4, 2.4, 43], [-1, 3, 45.5]);
  c.ghost([-3.5, 2.4, 45.5], [-1, 3, 52]);
  isle([-6, -3, 52], [4, 3, 62]);
  c.spawnAt([0, 0, -3], 0);
  c.inkLane([0, 0.02, 3.2], [0, 0.02, 6.2], 1.3, 0.8);
  c.checkpoint([7.5, 0, 25], -Math.PI / 2);
  c.checkpoint([-19.5, 0, 25.5], 0);
  c.checkpoint([-19.5, 3, 42], Math.PI / 2);
  c.checkpoint([-1, 3, 55], 0);
  c.enemy('smudge', [9.5, 0, 29.5]);
  c.enemy('smudge', [-22, 0, 25]);
  c.enemy('smudge', [-17, 0, 29.5]);
  c.enemy('smudge', [2, 3, 60]);
  c.tip([-5, -6], [5, 4], 'These catwalks are coated in invisible primer. <b>Shoot ink ahead</b> to reveal the path!');
  c.tip([-2, 23], [12, 31], 'Gaps ahead! Paint each step before you jump.');
  c.tip([-24, 23], [-15, 32], 'Ride the <b>jump pad</b> up to the high ledge.');
  c.shardLine([0, 0.1, 5], [0, 0.1, 11], 3);
  c.shardLine([7.5, 0.1, 16], [7.5, 0.1, 22], 3);
  c.shardLine([-0.5, 0.1, 27.5], [-12, 0.1, 27.5], 4);
  c.shardLine([-13, 3.1, 44.2], [-4, 3.1, 44.2], 4);
  // ---- section 4: a drifting ghost catwalk
  const mv = c.mover([-2.5, 2.4, 62.2], [0.5, 3.0, 65.2], { mat: 'ghost', path: [[0, 0, 0], [0, 0, 6.8]], speed: 2.0, wait: 1.0 });
  void mv;
  isle([-6, -3, 72], [4, 3, 80]);
  c.checkpoint([-1, 3, 76], 0);
  c.say([-6, 58], [4, 62], SAY.l2_mover, { minY: 2.5 });
  c.tip([-6, 56], [4, 62], 'That catwalk <b>moves</b>! Paint it, hop on, and ride it across.', { minY: 2.5 });
  c.shardLine([-1, 3.6, 66], [-1, 3.6, 70], 3);
  // ---- section 5: the ghost maze (dead ends hide shards and a swatch)
  const cell = (gx, gz) => { const x = -1 + gx * 2.5, z = 81.25 + gz * 2.5; c.ghost([x - 1.25, 2.4, z - 1.25], [x + 1.25, 3.0, z + 1.25]); return [x, z]; };
  for (const [gx, gz] of [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2], [2, 3], [1, 3], [0, 3], [-1, 3], [-1, 4], [-1, 5]]) cell(gx, gz);
  for (const [gx, gz] of [[-1, 1], [-2, 1], [-2, 2]]) { const [x, z] = cell(gx, gz); c.shard([x, 3.1, z]); }
  c.shard([-6, 3.1, 86.25], true);
  for (const [gx, gz] of [[3, 3], [4, 3], [4, 4], [4, 5]]) cell(gx, gz);
  isle([7.5, -2, 94.5], [10.5, 3, 97.5]);
  c.swatchAt([9, 4.3, 96]);
  isle([-8, -3, 94], [2, 3, 102]);
  c.checkpoint([-3, 3, 96], 0);
  c.say([-4, 80], [6, 92], SAY.l2_maze, { minY: 2 });
  c.tip([-6, 80], [6, 94], 'A maze of invisible paths. Dead ends often hide <b>Hue Shards</b>.', { minY: 2 });
  c.enemy('smudge', [-6, 3, 99]);
  c.enemy('smudge', [0, 3, 100]);
  c.enemy('smudge', [-3, 3, 98]);
  // ---- section 6: ghost stairs up to the high island
  for (let i = 0; i < 6; i++) c.ghost([-4, 2.4 + 0.9 * (i + 1), 102 + 2.2 * i], [0, 3.0 + 0.9 * (i + 1), 104.2 + 2.2 * i]);
  isle([-6, -3, 115], [2, 8.4, 124]);
  c.checkpoint([-2, 8.4, 117], 0);
  c.enemy('smudge', [-4, 8.4, 121]);
  c.enemy('smudge', [0, 8.4, 122]);
  c.tip([-6, 102], [2, 115], 'Ghost <b>stairs</b>. Paint a few steps ahead, then climb.', { minY: 2.5 });
  for (let i = 0; i < 6; i++) c.shard([-2, 3.7 + 0.9 * (i + 1), 103.1 + 2.2 * i]);
  // a well hidden ledge below the high island, with a pad back up
  c.ghost([-11.5, 4.6, 117], [-7.5, 5.2, 121]);
  c.swatchAt([-9.5, 6.5, 118]);
  c.pad([-9.5, 5.2, 120.2], [-3, 8.4, 120.5], 2.2);
  c.shard([-10.6, 5.3, 120.2], true);
  // ---- final stretch: stepping stones and a second drifting catwalk
  c.ghost([-3.5, 7.8, 126], [-0.5, 8.4, 128.5]);
  c.ghost([-3.5, 7.8, 130], [-0.5, 8.4, 132.4]);
  c.mover([-3.5, 7.8, 133.4], [-0.5, 8.4, 136.4], { mat: 'ghost', path: [[0, 0, 0], [0, 0, 6.2]], speed: 2.2, wait: 0.9 });
  isle([-6, -3, 142.5], [2, 8.4, 152]);
  c.coreAt([-2, 8.4, 148]);
  c.shardRing([-2, 8.5, 148], 3, 6);
  for (const [x, y, z] of [[3.5, 0, -4.5], [-3.5, 0, 2.5], [11, 0, 24], [-16, 0, 31], [-16, 3, 41], [3, 3, 53], [3, 3, 79], [1.5, 3, 101], [1.5, 8.4, 123], [1.5, 8.4, 151]]) {
    part(c.decor, new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), std(0x2b2833, 0.5, 0.6), { pos: [x, y + 1.3, z] });
    c.lamp([x, y + 2.75, z], 0x7ff0ff, { intensity: 10, dist: 10, hang: false, light: !(x === -3.5 || x === 11) && z < 60 });
  }
  const R = rng(5);
  for (let i = 0; i < 14; i++) c.chain([R.range(-24, 20), 20, R.range(-6, 150)], R.range(4, 9));
  // mist far below
  part(c.decor, new THREE.PlaneGeometry(500, 500), new THREE.MeshBasicMaterial({ color: 0x0b2028 }), { pos: [0, -30, 70], rot: [-Math.PI / 2, 0, 0], shadow: false });
  c.level.killY = -7;
}

// ============================================================== L3: Turret Alley
export function buildL3(c) {
  const floorM = { mat: 'concrete', color: 0xc99d78 };
  const low = { mat: 'concreteDark', color: 0xb9a8a0 };
  c.box([-12, -1, 0], [12, 0, 76], floorM);
  c.wall([-13, 0, -1], [-12, 9, 77], WALL);
  c.wall([12, 0, -1], [13, 9, 77], WALL);
  c.wall([-13, 0, -1], [13, 9, 0], WALL);
  c.wall([-13, 0, 76], [-3, 9, 77], WALL);
  c.wall([3, 0, 76], [13, 9, 77], WALL);
  c.box([-3, 5.2, 76], [3, 9, 77], WALL);
  // section 1: staggered cover, the bunker, left catwalk
  c.box([-6, 0, 12], [-2, 1.3, 12.8], low);
  c.box([2, 0, 16], [6, 1.3, 16.8], low);
  c.box([-3, 0, 21], [1, 1.3, 21.8], low);
  c.box([7, 0, 19.5], [8.6, 1.5, 21.1], WOOD);
  c.box([8.6, 0, 19.5], [10.2, 1.5, 21.1], WOOD);
  c.box([-5, 0, 26], [5, 1.6, 30], { mat: 'concreteDark', color: 0xa89c98 });
  c.box([-5, 1.6, 26], [5, 2.4, 26.4], low);
  c.ramp([-8, 0, 26], [-5, 1.6, 30], '+x', { mat: 'grate' });
  c.ramp([5, 0, 26], [8, 1.6, 30], '-x', { mat: 'grate' });
  c.ramp([-12, 0, 6], [-9, 2.4, 10], '+z', { mat: 'grate' });
  c.box([-12, 0, 10], [-9, 2.4, 32], { mat: 'grate', color: 0xc8c0c8 });
  c.box([-11.6, 2.4, 17], [-10, 3.4, 18], WOOD);
  c.enemy('blotter', [-2.5, 1.6, 28.6], { yaw: Math.PI });
  c.enemy('blotter', [2.5, 1.6, 28.6], { yaw: Math.PI });
  c.checkpoint([0, 0, 33.5], 0);
  // section 2: the gate, cross-fire towers (a jump pad flings you up beside the right one)
  c.pad([10, 0, 34.5], [9.2, 4.5, 40.7], 2.4);
  c.box([-12, 0, 40], [-8, 4.5, 44], { mat: 'concreteDark', color: 0xa89c98 });
  c.box([8, 0, 40], [12, 4.5, 44], { mat: 'concreteDark', color: 0xa89c98 });
  c.enemy('blotter', [-10, 4.5, 42], { yaw: Math.PI });
  c.enemy('blotter', [10, 4.5, 42], { yaw: Math.PI });
  c.box([-12, 0, 46], [-2, 2.6, 47], { mat: 'concrete', color: 0xb08a6c });
  c.box([2, 0, 46], [12, 2.6, 47], { mat: 'concrete', color: 0xb08a6c });
  c.inkLane([0, 0.02, 35], [0, 0.02, 52], 1.4);
  c.enemy('smudge', [-4, 0, 50]);
  c.enemy('smudge', [4, 0, 51.5]);
  c.box([8, 0, 49], [12, 5.5, 53], { mat: 'container', color: 0x5b8a9a });
  c.swatchAt([10, 6.7, 51]);
  c.checkpoint([0, 0, 55.5], 0);
  // section 3: the Big Blotter and the two-switch gate
  c.box([-5, 0, 60], [-3.5, 2.6, 61.5], low);
  c.box([3.5, 0, 60], [5, 2.6, 61.5], low);
  c.ramp([-12, 0, 54], [-9.5, 1.8, 58], '+z', { mat: 'grate' });
  c.box([-12, 0, 58], [-9.5, 1.8, 72], { mat: 'grate', color: 0xc8c0c8 });
  c.ramp([9.5, 0, 54], [12, 1.8, 58], '+z', { mat: 'grate' });
  c.box([9.5, 0, 58], [12, 1.8, 72], { mat: 'grate', color: 0xc8c0c8 });
  c.box([-8.5, 0, 63.5], [-5.5, 1.2, 64.2], low);
  c.box([5.5, 0, 63.5], [8.5, 1.2, 64.2], low);
  c.enemy('blotter', [-7, 0, 66.2], { yaw: Math.PI });
  c.enemy('blotter', [7, 0, 66.2], { yaw: Math.PI });
  c.box([-2, 0, 66], [2, 1, 70], { mat: 'concreteDark', color: 0x8f8798 });
  c.enemy('blotter', [0, 1, 68], { yaw: Math.PI, big: true });
  c.door('l3gate', [-3, 0, 76], [3, 5.2, 77], { dir: 'up', need: ['switch:l3a', 'switch:l3b'] });
  c.paintSwitch('l3a', [-12, 2.8, 67.5], [-11.6, 4.8, 70.5], 'px', { label: 'Left lock open' });
  c.paintSwitch('l3b', [11.6, 2.8, 67.5], [12, 4.8, 70.5], 'nx', { label: 'Right lock open' });
  c.say([-12, 56], [12, 62], SAY.l3_switch);
  c.tip([-12, 62], [12, 76], 'Paint <b>both</b> wall switches (glowing frames) to open the gate. The side ledges give you an angle.');
  // ---- section 4: the back alley (flank catwalk, a container to climb, a vent only a swimmer fits)
  c.box([-6, -1, 77], [6, 0, 112], floorM);
  walls(c, -6, 6, 77, 112, 0, 9, { s: [[-6, 6]], n: [[-6, 6]] }, WALL);
  c.box([-3, 0, 82], [-1.4, 1.4, 83.6], WOOD);
  c.box([1.6, 0, 86.5], [3.2, 1.4, 88.1], WOOD);
  c.ramp([3, 0, 84], [6, 2.4, 88], '+z', { mat: 'grate' });
  c.box([3, 0, 88], [6, 2.4, 108], { mat: 'grate', color: 0xc8c0c8 });
  c.box([-6, 0, 94], [-3.5, 4.5, 99], { mat: 'container', color: 0x8a5b4a });
  c.swatchAt([-4.75, 5.8, 96.5]);
  c.box([-2, 0, 99], [0.4, 1.3, 99.8], low);
  c.box([-6, 0, 106], [-3, 3, 110], { mat: 'concreteDark', color: 0xa89c98 });
  c.enemy('blotter', [-4.5, 3, 108], { yaw: Math.PI });
  c.enemy('blotter', [4.5, 2.4, 106.5], { yaw: Math.PI });
  c.enemy('smudge', [-2, 0, 90]);
  c.enemy('smudge', [1, 0, 95]);
  c.enemy('smudge', [-1, 0, 103]);
  c.checkpoint([0, 0, 79], 0);
  c.say([-6, 77], [6, 84], SAY.l3_alley);
  c.tip([3, 84], [6, 108], 'The <b>catwalk</b> lets you shoot down at the turrets.', { minY: 1.5 });
  c.gooAt([0, 0.02, 92], 1.8); c.gooAt([-2, 0.02, 101], 1.6); c.gooAt([4, 2.42, 98], 1.2);
  c.shardLine([4.5, 2.5, 90], [4.5, 2.5, 104], 6);
  c.shardLine([0, 0.1, 80], [0, 0.1, 88], 4);
  // ---- section 5: the courtyard and the second Big Blotter
  c.box([-14, -1, 112], [14, 0, 142], floorM);
  walls(c, -14, 14, 112, 142, 0, 9, { s: [[-6, 6]], w: [[120.5, 122.5]] }, WALL);
  c.box([-3, 0, 129], [3, 1.2, 135], { mat: 'concreteDark', color: 0x8f8798 });
  c.enemy('blotter', [0, 1.2, 132], { yaw: Math.PI, big: true, group: 'gate' });
  c.box([-11.5, 0, 124.5], [-8.5, 3, 127.5], { mat: 'concreteDark', color: 0xa89c98 });
  c.box([8.5, 0, 124.5], [11.5, 3, 127.5], { mat: 'concreteDark', color: 0xa89c98 });
  c.enemy('blotter', [-10, 3, 126], { yaw: Math.PI, group: 'gate' });
  c.enemy('blotter', [10, 3, 126], { yaw: Math.PI, group: 'gate' });
  for (const [x, z] of [[-6, 118], [6, 118], [-4, 124], [4, 124]]) c.box([x - 0.9, 0, z - 0.4], [x + 0.9, 1.3, z + 0.4], low);
  c.enemy('smudge', [-7, 0, 121], { group: 'gate' });
  c.enemy('smudge', [7, 0, 121], { group: 'gate' });
  c.coreAt([0, 0, 139], { gate: 'gate' });
  c.checkpoint([0, 0, 114], 0);
  c.tip([-14, 112], [14, 120], 'The second <b>Big Blotter</b> guards the core. Splash every turret to break the seal!');
  // the vent: a low gap only a swimming Chromeleon fits through
  c.box([-15, 0.75, 120.5], [-14, 9, 122.5], { mat: 'grate', color: 0x6a6070 });
  c.box([-14.6, 0, 117], [-12.6, 1.6, 119.6], WOOD); c.box([-14.6, 0, 123.4], [-12.6, 1.6, 126], WOOD);
  c.box([-19, -1, 118.5], [-15, 0, 124.5], floorM);
  walls(c, -19, -15, 118.5, 124.5, 0, 5, { e: [[118.5, 124.5]] }, WALL);
  c.box([-19, 5, 118.5], [-15, 5.6, 124.5], WALL);
  c.swatchAt([-17, 1.3, 121.5]);
  c.shard([-17.8, 0.2, 119.5], true); c.shard([-17.8, 0.2, 123.5], true);
  c.tip([-14, 117], [-11, 126], 'A low <b>vent</b>! Only a swimming Chromeleon fits under it. Paint the floor and <b>dive</b>.');
  c.gooAt([-5, 0.02, 128], 2.2); c.gooAt([5, 0.02, 120], 2.0); c.gooAt([0, 0.02, 138], 1.6);
  c.spawnAt([0, 0, 3], 0);
  c.gooAt([-3, 0.02, 24], 2.2); c.gooAt([5, 0.02, 37], 1.8); c.gooAt([-6, 0.02, 57], 2.4); c.gooAt([3, 0.02, 63], 2.2);
  c.tip([-12, 0], [12, 9], 'Blotter turrets ahead! Hide behind <b>cover</b>, or take the <b>catwalk</b> on the left to flank them.');
  c.tip([-12, 33], [7.5, 40], 'Blotter shots fly high: <b>swim in your ink</b> and they sail right over you.');
  c.tip([7.5, 31], [12, 38], 'This <b>jump pad</b> drops you right next to the tower turret. Splash it up close!');
  c.shardLine([-10.5, 2.5, 12], [-10.5, 2.5, 30], 6);
  c.shardLine([0, 0.1, 36], [0, 0.1, 44], 4);
  c.shard([-10.8, 3.5, 17.5], true);
  for (const z of [8, 24, 40, 56, 70, 92, 108, 126, 138]) c.lamp([0, 7.5, z], 0xffb070, { intensity: 26, dist: 20, hang: 2 });
  c.pipe([[-11.6, 7, 0], [-11.6, 7, 76]], 0.3, 0x9a7a62);
  c.pipe([[11.6, 6, 0], [11.6, 6, 76]], 0.26, 0x77727f);
  c.pipe([[11.6, 6, 30], [11.6, 0, 30]], 0.26, 0x77727f);
  c.pipe([[-5.6, 7.5, 77], [-5.6, 7.5, 112]], 0.26, 0x9a7a62);
  c.pipe([[-13.6, 8, 112], [-13.6, 8, 142], [13.6, 8, 142], [13.6, 8, 112]], 0.3, 0x8a8494);
  for (let z = 4; z < 76; z += 12) c.girder([-12, 8.6, z], [12, 8.6, z]);
  for (let z = 80; z < 112; z += 10) c.girder([-6, 8.6, z], [6, 8.6, z]);
  sign(c, 'TURRET ALLEY', [0, 6.2, 0.1], 6, 1.1, 0, { accent: '#ffc83d' });
  sign(c, 'BACK ALLEY', [0, 7.2, 76.95], 4, 0.9, 0, { accent: '#ffc83d' });
}

// ============================================================== L4: Drone Heights
export function buildL4(c) {
  const t = (min, max, col = 0x9fa8b8) => {
    c.box(min, max, { mat: 'concrete', color: col, bottom: true });
    c.column((min[0] + max[0]) / 2, (min[2] + max[2]) / 2, (max[0] - min[0]) * 0.6, (max[2] - min[2]) * 0.6, min[1] + 0.01, -70, 0x4a5262);
  };
  t([-8, -3, 0], [8, 0, 12], 0xa9b0bf);
  t([-8, -3, 12], [8, 4, 22]);
  t([-8, -3, 22], [-2, 8, 32], 0xa9b0bf);
  t([1, -3, 30], [9, 12, 40]);
  t([-3, -3, 40], [9, 16, 48], 0xa9b0bf);
  t([-14, -3, 48], [1, 20, 58]);
  t([14, -3, 50], [17, 19, 53], 0xb8a9c0);
  c.box([-7.5, 0, 1], [-5.5, 1.2, 3], WOOD);
  c.box([-2.4, 20, 55.4], [1, 21, 58], WOOD);
  c.pad([5, 0, 8.5], [5, 4, 16], 2.5);
  c.pad([-5, 8, 29.6], [4.5, 12, 34], 2.6);
  c.pad([7.6, 16, 46.6], [15.5, 19, 51.5], 2.2);
  c.swatchAt([15.5, 20.3, 51.5]);
  c.spawnAt([0, 0, 2.5], 0);
  c.checkpoint([0, 4, 14.5], 0);
  c.checkpoint([5, 12, 33], 0);
  c.checkpoint([2, 16, 42.5], 0);
  c.checkpoint([-1.5, 20, 50.5], -Math.PI / 2);
  c.enemy('drone', [0, 7.5, 10], { radius: 3 });
  c.enemy('drone', [-5, 11.5, 27], { radius: 2.5 });
  c.enemy('drone', [5, 15.5, 36], { radius: 3 });
  c.enemy('drone', [3, 19.5, 44], { radius: 3 });
  c.enemy('drone', [-8, 23.5, 53], { radius: 3.5 });
  c.enemy('smudge', [-9, 20, 55]);
  c.enemy('smudge', [-5, 20, 51]);
  c.gooAt([0, 4.02, 18], 1.8); c.gooAt([-5, 8.02, 26], 1.4); c.gooAt([5, 12.02, 38], 1.6);
  c.tip([-8, 0], [8, 12], 'Drones drop gray bombs. Watch for the <b>warning ring</b> under you and keep moving!', { maxY: 1 });
  c.tip([-8, 12], [8, 22], 'Paint the wall ahead and <b>swim straight up</b> it.', { minY: 3, maxY: 5 });
  c.tip([-8, 22], [-2, 32], 'Jump pad! It flings you over to the next tower.', { minY: 7 });
  c.shardLine([-5, 0.1, 4], [-5, 0.1, 10], 3);
  c.shardLine([-5, 4.1, 15], [5, 4.1, 15], 4);
  c.shardLine([-6, 8.1, 24], [-3, 8.1, 30], 3);
  c.shardLine([2, 12.1, 32], [8, 12.1, 38], 3);
  c.shardLine([0, 16.1, 41], [8, 16.1, 41], 4);
  c.shard([-7, 1.3, 2], true);
  // ---- section 5: the old silo lift up the shaft (with a ledge to hop off at)
  c.mover([-12, 19.6, 58.5], [-9, 20, 61.5], { trigger: 'ride', path: [[0, 0, 0], [0, 8, 0]], speed: 2.0 });
  t([-16.2, -3, 59], [-13, 24.6, 61.6], 0xb0a8c0);
  c.swatchAt([-14.6, 25.9, 60.3]);
  c.shard([-15.5, 24.7, 59.6], true);
  c.say([-14, 50], [1, 58], SAY.l4_lift, { minY: 19 });
  c.tip([-14, 54], [-6, 62], 'Step onto the <b>lift</b> (yellow trim) and it carries you up the shaft.', { minY: 19 });
  // ---- section 6: the drone nest
  t([-16, -3, 62], [0, 28, 74]);
  c.checkpoint([-8, 28, 63.5], 0);
  c.door('l4gate', [-14, 28, 74], [-2, 31.6, 74.6], { dir: 'up' });
  c.arena('nest', [-15, 27, 63], [-1, 34, 73.5], {
    name: 'Drone Nest', doors: ['l4gate'], shards: 10,
    waves: [
      [{ kind: 'drone', pos: [-12, 32, 68], radius: 2.5 }, { kind: 'drone', pos: [-4, 32, 68], radius: 2.5 }, { kind: 'drone', pos: [-8, 33, 71], radius: 2 }],
      [{ kind: 'smudge', pos: [-13, 28, 70] }, { kind: 'smudge', pos: [-3, 28, 70] }, { kind: 'drone', pos: [-8, 32.5, 66], radius: 3 }, { kind: 'drone', pos: [-11, 33, 72], radius: 2 }],
    ],
  });
  c.say([-16, 62], [0, 66], SAY.l4_nest, { minY: 27 });
  c.box([-12.5, 28, 66], [-11, 29.4, 67.5], WOOD);
  c.box([-5, 28, 69], [-3.5, 29.4, 70.5], WOOD);
  c.gooAt([-8, 28.02, 68], 2.2);
  // ---- section 7: drifting platforms across the silo to the core
  c.mover([-10, 27.6, 75], [-7, 28, 78], { path: [[0, 0, 0], [0, 0, 8]], speed: 2.4, wait: 1.0 });
  t([-11, -3, 86.5], [-6, 28, 90.5]);
  c.checkpoint([-8.5, 28, 88.5], Math.PI / 2);
  c.mover([-5.5, 27.6, 87], [-2.5, 28, 90], { path: [[0, 0, 0], [10, 2, 0]], speed: 2.2, wait: 1.0 });
  t([8, -3, 84], [16, 30, 94]);
  c.enemy('drone', [12, 34, 89], { radius: 3 });
  c.enemy('smudge', [14, 30, 92]);
  c.coreAt([12, 30, 89]);
  c.shardLine([-8.5, 28.7, 79], [-8.5, 28.7, 84], 3);
  c.shardLine([-2, 29, 88.5], [6, 31, 88.5], 4);
  // a hidden ledge under the core platform, pad back up
  t([12, -3, 95], [15, 25.2, 97.4], 0xb0a8c0);
  c.swatchAt([13.5, 26.5, 96.2]);
  c.pad([13.5, 25.2, 96.8], [10, 30, 92], 2.4);
  c.shard([12.6, 25.3, 95.6], true);
  c.tip([8, 84], [16, 94], 'Something glints below the edge of this platform…', { minY: 29 });
  c.gooAt([0, 4.02, 18], 1.8);
  // silo shell, light shafts
  const shell = new THREE.MeshStandardMaterial({ color: 0x3a4456, roughness: 0.8, metalness: 0.3, side: THREE.BackSide });
  part(c.decor, new THREE.CylinderGeometry(52, 52, 160, 48, 1, true), shell, { pos: [0, 20, 46], shadow: false, receive: true });
  for (let y = -40; y < 90; y += 9) part(c.decor, new THREE.TorusGeometry(51.6, 0.5, 6, 64), std(0x2a3240, 0.6, 0.5), { pos: [0, y, 46], rot: [Math.PI / 2, 0, 0], shadow: false });
  const beam = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const [x, z] of [[-10, 20], [8, 44], [0, 6], [-8, 68], [12, 89]]) part(c.decor, new THREE.CylinderGeometry(2.5, 6, 80, 20, 1, true), beam, { pos: [x, 45, z], shadow: false });
  for (const [x, y, z] of [[-7, 2.6, 11], [7, 6.6, 21], [-3, 10.6, 31], [8.5, 14.6, 39], [-13, 22.6, 57], [-1, 30.6, 73], [15, 32.6, 85]]) c.lamp([x, y, z], 0xbfe0ff, { intensity: 14, dist: 12, hang: false });
  c.level.killY = -9;
}

// ============================================================== L5: The Gray Engine
export function buildL5(c) {
  const R = rng(23);
  // antechamber
  c.box([-5, -1, -36], [5, 0, -22], { mat: 'grate', color: 0xb0a8b4 });
  c.wall([-6, 0, -37], [6, 9, -36], WALL);
  c.wall([-6, 0, -36], [-5, 9, -23], WALL);
  c.wall([5, 0, -36], [6, 9, -23], WALL);
  c.box([-5, 0, -31], [-3, 4, -27], { mat: 'container', color: 0x6d5f86 });
  c.swatchAt([-4, 5.3, -29]);
  c.shardLine([2, 0.1, -34], [2, 0.1, -25], 5);
  c.shard([-4, 4.1, -27.6], true);
  // arena
  c.box([-22, -1, -22], [22, 0, 22], { mat: 'concrete', color: 0xd0c0b4 });
  c.wall([-23, 0, 22], [23, 10, 23], WALL);
  c.wall([22, 0, -23], [23, 10, 22], WALL);
  c.wall([-23, 0, -23], [-22, 10, 22], WALL);
  c.wall([-22, 0, -23], [-5, 10, -22], WALL);
  c.wall([5, 0, -23], [22, 10, -22], WALL);
  c.door = c.box([-5, 0, -23], [5, 40, -22], { render: false, paintable: false, collide: false });
  for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) c.box([x - 1.2, 0, z - 1.2], [x + 1.2, 3.5, z + 1.2], { mat: 'concreteDark', color: 0x9a8f9e });
  // engine collision (octagon-ish) + plinth step
  for (const [a, b] of [[4.5, 2], [2, 4.5], [3.6, 3.6]]) c.box([-a, 0, -b], [a, 6, b], { render: false, paintable: false });
  for (const [a, b] of [[5.4, 2.3], [2.3, 5.4], [4.2, 4.2]]) c.box([-a, 0, -b], [a, 0.5, b], { render: false, paintable: false });
  // valve shutters (order matches the boss: +x, -x, +z, -z)
  c.shutter([4.5, 0.5, -1.3], [4.85, 3.1, 1.3], 'px');
  c.shutter([-4.85, 0.5, -1.3], [-4.5, 3.1, 1.3], 'nx');
  c.shutter([-1.3, 0.5, 4.5], [1.3, 3.1, 4.85], 'pz');
  c.shutter([-1.3, 0.5, -4.85], [1.3, 3.1, -4.5], 'nz');
  // jump pads up onto all four pillars: perches above the sweep beam and shockwaves
  // (in overdrive the coolant tanks sit up there)
  c.pad([-18.5, 0, -5], [-13, 3.5, -13], 2.2);
  c.pad([18.5, 0, -5], [13, 3.5, -13], 2.2);
  c.pad([-18.5, 0, 5], [-13, 3.5, 13], 2.2);
  c.pad([18.5, 0, 5], [13, 3.5, 13], 2.2);
  c.spawnAt([0, 0, -33], 0);
  c.checkpoint([0, 0, -30.5], 0);
  for (let i = 0; i < 26; i++) {
    const a = R.range(0, Math.PI * 2), r = R.range(7, 20);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) > 21 || Math.abs(z) > 21) continue;
    c.gooAt([x, 0.02, z], R.range(1.4, 2.8));
  }
  c.zone([-22, -1, -20.5], [22, 12, 22], 'arena');
  // decor: corner drains the Smudges crawl out of, red work lights, Grisaille banners
  for (const [x, z] of [[-21.4, 21.4], [21.4, 21.4], [-21.4, -21.4], [21.4, -21.4]]) {
    const a = Math.atan2(-z, -x);
    rod(c.decor, [x, 1.1, z], [x + Math.cos(a) * 2.2, 1.1, z + Math.sin(a) * 2.2], 0.95, std(0x3a3742, 0.5, 0.7));
    part(c.decor, new THREE.CircleGeometry(0.85, 20), std(0x0d0b10, 1), { pos: [x + Math.cos(a) * 2.21, 1.1, z + Math.sin(a) * 2.21], rot: [0, Math.PI / 2 - a, 0], shadow: false });
  }
  // the floor vents the Engine vents gray geysers through (phase 2+)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * 11, 0.02, Math.sin(a) * 11); c.decor.add(g);
    part(g, new THREE.CylinderGeometry(1.1, 1.1, 0.06, 20), std(0x2b2833, 0.5, 0.7), { shadow: false });
    for (let k = -2; k <= 2; k++) part(g, new THREE.BoxGeometry(1.6, 0.08, 0.12), std(0x15131a, 0.6, 0.4), { pos: [0, 0.03, k * 0.35], shadow: false });
  }
  c.lamp([0, 6.5, -29], 0xffc070, { intensity: 20, dist: 14, hang: 2 });
  for (const [x, z] of [[-17, 17], [17, 17], [-17, -17], [17, -17]]) c.lamp([x, 8.5, z], 0xff7a50, { intensity: 30, dist: 22, hang: 3 });
  const crest = canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#2b2833'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8b8794';
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w / 2, h - 60); ctx.lineTo(w, h); ctx.fill();
    ctx.fillStyle = '#1b1530';
    ctx.fillRect(78, 70, 100, 120); ctx.fillRect(48, 186, 160, 22);
    ctx.fillStyle = '#6d5f86'; ctx.fillRect(78, 160, 100, 18);
    ctx.fillStyle = '#b9b5c4'; ctx.font = `64px ${HFONT}`; ctx.textAlign = 'center'; ctx.fillText('G', w / 2, 290);
  });
  for (const [x, z, yaw] of [[-10, 22.4, Math.PI], [10, 22.4, Math.PI], [-22.4, 0, Math.PI / 2], [22.4, 0, -Math.PI / 2]]) {
    const m = new THREE.MeshStandardMaterial({ map: crest, roughness: 0.8, side: THREE.DoubleSide });
    part(c.decor, new THREE.PlaneGeometry(2.6, 3.9), m, { pos: [x, 6.5, z], rot: [0, yaw, 0], shadow: false });
  }
  c.pipe([[-22, 8.6, -22.4], [22, 8.6, -22.4]], 0.3, 0x77727f);
  for (let x = -16; x <= 16; x += 8) c.girder([x, 11, -22], [x, 11, 22]);
  sign(c, 'ENGINE ROOM · KEEP GRAY', [0, 6.4, -35.9], 6.5, 1.1, 0, { accent: '#8b8794' });
  c.level.killY = -5;
}
