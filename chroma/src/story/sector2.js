// Sector 2: the Rinse Reservoir. Glossy tiles, water channels and big tanks.
//   l6  Sponge Sluice   sponge blocks (paint them to grow), Goopers, slick unpaintable tiles
//   l7  Rising Tide     gray floods that climb with you; paint drains to push them back. Splotches
//   l8  Bottling Line   conveyor belts and ink rails. Rumblers
//   l9  Pump Station    defend the Color Pump. Pilfers. Everything so far, mixed
//   l10 The Grimewyrm   boss arena: a goo pool, four drains, Agent Tint's cage
import * as THREE from 'three';
import { part } from './kit.js';
import { S2, sign, floor, walls, island, crates, tank, waterStrip, goo, valveWheel } from './build.js';
import { SAY } from './dialogue.js';

const SLICK = { mat: 'tiles', color: 0x7fbfdc, paintable: false };
const F = S2.floor, F2 = S2.floor2, WL = S2.wall;
// a sponge sitting on a pylon that disappears into the depths
function pillarSponge(c, x, z, base, full, o = {}) {
  const w = o.w ?? 1.2, d = o.d ?? 1.2;
  c.sponge([x - w, base, z - d], [x + w, base + full, z + d], o);
  c.column(x, z, w * 1.4, d * 1.4, base - 0.01, -60, 0x4a6a74);
}
function lamps(c, list, color = 0xbff4ff, o = {}) { for (const p of list) c.lamp(p, color, { intensity: o.i ?? 24, dist: o.d ?? 18, hang: o.hang ?? 3 }); }

// ============================================================== L6: Sponge Sluice
export function buildL6(c) {
  // ---- A: the intake hall (sponge tutorial)
  floor(c, -8, 8, -4, 14.6, 0, F);
  walls(c, -8, 8, -4, 52, -10, 22, { n: [[-8, 8]] }, WL);
  c.box([-8, 0, 14], [8, 2.6, 14.6], SLICK);
  c.box([-8, -1.4, 14.6], [8, 2.6, 26], F2);
  c.sponge([-1.4, 0, 11.4], [1.4, 2.6, 14]);
  c.box([5.4, 0, -4], [8, 4.0, 0.6], SLICK);
  c.sponge([5.6, 0, 1.2], [7.6, 3.0, 3.2]);
  c.swatchAt([6.7, 5.3, -1.7]);
  c.shard([6.0, 4.1, -0.5], true);
  c.spawnAt([0, 0, -1.5], 0);
  waterStrip(c, -7.9, -6, -4, 14, 0.02);
  c.tip([-8, -4], [8, 9], 'Ink won\'t stick to <b>slick blue tiles</b>. See the yellow <b>sponge</b>? Paint it and it soaks up ink and <b>grows</b>!');
  c.tip([-8, 9], [8, 14], 'Paint the sponge all over, then hop up on it.', { maxY: 2 });
  c.shardLine([-4, 0.1, 2], [-4, 0.1, 10], 4);
  c.shardLine([-6, 2.7, 17], [6, 2.7, 17], 5);
  c.checkpoint([0, 2.6, 20], 0);
  // ---- B: the sluice channel: sponge pillars rise to make a path
  for (const [x, z] of [[-3, 29.4], [2, 33.4], [-2, 37.4], [3, 41.4], [0, 45.4]]) pillarSponge(c, x, z, 0, 2.6);
  goo(c, -8, 8, 26, 48, -2.4);
  c.box([-8, -1.4, 48], [8, 2.6, 52], F2);
  c.tip([-8, 22], [8, 28], 'The path is <b>sunk</b> in the channel. Shoot the sponges down there to raise them!', { minY: 2 });
  c.shardLine([-3, 3.1, 29.4], [0, 3.1, 45.4], 5);
  c.checkpoint([0, 2.6, 50], 0);
  // ---- C: the gooper courtyard (arena) and a sponge stair to the exit ledge
  floor(c, -12, 12, 52, 74, 2.6, F, { thick: 4 });
  walls(c, -12, 12, 52, 82, -1.4, 20, { s: [[-8, 8]], n: [[-3, 3]] }, WL);
  c.box([-3, 9.6, 82], [3, 18.6, 83], WL);
  c.door('l6in', [-8, 2.6, 52.2], [8, 6.6, 52.8], { dir: 'down', open: true });
  c.box([-12, -1.4, 74], [12, 5.6, 74.6], SLICK);
  c.box([-12, -1.4, 74.6], [12, 5.6, 82], F2);
  c.sponge([-1.2, 2.6, 69.4], [1.2, 4.3, 71.8]);
  c.sponge([-1.2, 2.6, 71.8], [1.2, 5.6, 74]);
  c.door('l6out', [-3, 5.6, 82], [3, 9.6, 82.6], { dir: 'up' });
  crates(c, [[-4, 2.6, 64, 1.6, 1.4], [4.5, 2.6, 60, 1.6, 1.4], [-8, 2.6, 70, 1.8, 1.6], [8, 2.6, 70, 1.8, 1.6]], S2.wood);
  // high box with a swatch, reached by a two-sponge chain
  c.box([9, 2.6, 56], [12, 7.3, 60], SLICK);
  c.sponge([7.4, 2.6, 60], [9, 5.0, 61.6]);
  c.sponge([9, 2.6, 60], [10.6, 6.2, 61.6]);
  c.swatchAt([10.5, 8.6, 58]);
  c.shard([10.5, 7.4, 57], true);
  c.checkpoint([0, 2.6, 54.5], 0);
  c.arena('court', [-11, 2, 56], [11, 9, 73], {
    name: 'Sluice Court', doors: ['l6in', 'l6out'], shards: 10,
    waves: [
      [{ kind: 'gooper', pos: [-6, 2.6, 63] }, { kind: 'gooper', pos: [6, 2.6, 67] }, { kind: 'smudge', pos: [-3, 2.6, 69] }, { kind: 'smudge', pos: [3, 2.6, 59] }],
      [{ kind: 'gooper', pos: [0, 2.6, 64] }, { kind: 'smudge', pos: [-8, 2.6, 58] }, { kind: 'smudge', pos: [8, 2.6, 64] }, { kind: 'smudge', pos: [-6, 2.6, 71] }],
    ],
  });
  c.say([-12, 52], [12, 57], SAY.l6_gooper, { minY: 2 });
  c.tip([-12, 56], [12, 73], 'A <b>Gooper</b> hides in its puddle. <b>Paint over the puddle</b> to flush it out, then splash it!', { minY: 2 });
  // ---- D: timed sponges over the drop (they drip dry!)
  walls(c, -8, 8, 82, 104, -10, 22, { s: [[-8, 8]], n: [[-6, 6]] }, WL);
  for (const z of [84.2, 88.0, 91.8, 95.0]) pillarSponge(c, 0, z, 1.6, 4.0, { shrink: 9 });
  goo(c, -8, 8, 82.6, 96, -2.4);
  c.box([-8, -1.4, 96], [8, 5.6, 104], F2);
  c.checkpoint([0, 5.6, 100], 0);
  c.tip([-8, 74.6], [8, 82.6], 'These sponges <b>drip dry</b> after a few seconds. Paint them all, then cross quickly!', { minY: 5 });
  c.shardLine([0, 6.1, 84.2], [0, 6.1, 95], 4);
  // hidden ledge under the bridge, a pad back up
  island(c, [-4.4, -4, 88], [-2.2, 2.0, 90.4], F2, 0x4a6a74);
  c.swatchAt([-3.3, 3.3, 88.6]);
  c.pad([-3.3, 2.0, 89.8], [0, 5.6, 99.5], 2.2);
  c.shard([-2.8, 2.1, 88.6], true);
  // ---- E: the final hall: a sponge staircase to the core
  floor(c, -12, 12, 104, 140, 5.6, F, { thick: 6 });
  walls(c, -12, 12, 104, 140, -0.4, 18, { s: [[-6, 6]] }, WL);
  c.box([-5, 5.6, 128], [5, 10.1, 138], F2);
  c.box([-5, 5.6, 127.6], [5, 10.1, 128], SLICK);
  c.sponge([-1.2, 5.6, 121.2], [1.2, 7.1, 123.6]);
  c.sponge([-1.2, 5.6, 123.6], [1.2, 8.6, 126]);
  c.sponge([-1.2, 5.6, 126], [1.2, 10.1, 127.6]);
  crates(c, [[-7, 5.6, 112, 1.6, 1.4], [7, 5.6, 114, 1.6, 1.4], [-3.5, 5.6, 118, 1.4, 1.2], [4, 5.6, 120, 1.4, 1.2]], S2.wood);
  c.enemy('gooper', [-7, 5.6, 118], { group: 'gate' });
  c.enemy('gooper', [7, 5.6, 124], { group: 'gate' });
  c.enemy('smudge', [-4, 5.6, 110], { group: 'gate' });
  c.enemy('smudge', [4, 5.6, 112], { group: 'gate' });
  c.enemy('smudge', [0, 5.6, 116], { group: 'gate' });
  c.coreAt([0, 10.1, 133], { gate: 'gate' });
  c.say([-12, 104], [12, 110], SAY.l6_tall, { minY: 5 });
  c.tip([-12, 104], [12, 120], 'Splash every Drab to break the seal, then build the <b>sponge stairs</b> up to the core.', { minY: 5 });
  c.shardLine([-6, 5.7, 106], [6, 5.7, 106], 5);
  c.shardRing([0, 10.2, 133], 3, 6);
  // decor
  tank(c, [-5.4, 0, 7.5], 1.3, 5.5); tank(c, [-10.2, 2.6, 64.5], 1.3, 5); tank(c, [-9, 5.6, 133], 1.8, 6); tank(c, [9, 5.6, 133], 1.8, 6);
  c.pipe([[-7.6, 7, -4], [-7.6, 7, 52]], 0.3, S2.pipe);
  c.pipe([[7.6, 8, -4], [7.6, 8, 52]], 0.26, 0x6a9aa6);
  c.pipe([[-11.6, 9, 52], [-11.6, 9, 82], [11.6, 9, 82], [11.6, 9, 52]], 0.3, S2.pipe);
  c.pipe([[-11.6, 12, 104], [-11.6, 12, 140], [11.6, 12, 140], [11.6, 12, 104]], 0.32, S2.pipe);
  for (const [x, y, z] of [[7.9, 2.2, 8], [-7.9, 4.6, 40], [11.9, 5, 66], [-11.9, 8, 120]]) valveWheel(c, [x, y, z], Math.PI / 2);
  lamps(c, [[0, 7.5, 4], [0, 10, 36], [0, 11, 63], [0, 12, 90], [0, 14, 122]]);
  sign(c, 'SPONGE SLUICE · GATE 3', [0, 6.5, -3.9], 6.5, 1.1, 0, { accent: '#ffd36b' });
  for (const [x, y, z, r] of [[-3, 0.02, 5, 1.4], [3, 2.62, 24, 1.2], [-5, 5.62, 101, 1.4], [7, 5.62, 130, 1.3]]) c.gooAt([x, y, z], r);
  // signposting: glowing floor arrows along the main route
  c.arrow([0, 0, 7.5], 0, { s: 1.2 });
  c.arrow([0, 2.6, 23.5], 0, { s: 1.2 });
  c.arrow([0, 2.6, 64], 0, { s: 1.2 });
  c.arrow([0, 5.6, 79], 0, { s: 1.2 });
  c.arrow([0, 5.6, 112], 0, { s: 1.2 });
  c.level.killY = -3;
}

// ============================================================== L7: Rising Tide
export function buildL7(c) {
  // ---- A: the basin (flood + drain tutorial)
  floor(c, -8, 8, -4, 30, 0, F);
  walls(c, -8, 8, -4, 30, -3, 14, { n: [[-8, 8]] }, WL);
  c.drain('a1', [-8, 1.2, 18], [-7.6, 3.2, 21], 'px');
  c.flood({ y0: -1, ymax: 1.0, rate: 0.16, min: [-8, -4], max: [8, 30], drains: ['a1'], drop: 3, start: [[-8, -1, 8], [8, 4, 14]] });
  crates(c, [[4, 0, 22, 1.8, 1.0], [5.5, 0, 24.5, 1.8, 2.0], [4, 0, 27, 1.8, 3.0]], S2.wood);
  c.box([-8, -1, 27], [8, 3, 30], F2);
  c.spawnAt([0, 0, -1.5], 0);
  c.say([-8, 8], [8, 14], SAY.l7_rise);
  c.tip([-8, 8], [8, 24], 'The gray is rising! Paint the <b>drain</b> (a grille in a glowing frame) on the wall to push it back down.', { maxY: 2 });
  c.shardLine([-4, 0.1, 2], [-4, 0.1, 12], 5);
  c.shard([-6.6, 0.2, 26], true);
  // a ledge on the basin wall (paint it and climb before the tide comes in)
  c.box([-8, 0, 3], [-6, 3.6, 7], { mat: 'container', color: 0x5f8a96 });
  c.swatchAt([-7, 4.9, 5]);
  c.checkpoint([0, 3, 28.5], 0);
  // ---- B: the cistern shaft: climb while the tide follows you up
  floor(c, -14, 14, 32, 60, 0, F, { thick: 3 });
  walls(c, -14, 14, 30, 60, -3, 36, { s: [[-8, 8]], n: [[-3, 3]] }, WL);
  c.box([-3, -3, 60], [3, 22.5, 61], WL);
  c.box([-8, -1, 30], [8, 3, 32], F2);
  c.box([-3, 0, 43], [3, 14, 49], { mat: 'concreteDark', color: 0x9ab4bc });
  const GR = { mat: 'grate', color: 0xb4c8cc };
  c.ramp([8, 0, 32], [14, 2.5, 36], '+z', GR);
  c.box([8, 0, 36], [14, 2.5, 44], F2);                       // P1
  c.pad([11, 2.5, 42.5], [11, 5, 53], 2.4);
  c.box([8, 0, 50], [14, 5, 58], F2);                         // P2
  c.sponge([8, 5, 54], [10, 7.5, 56]);
  c.box([-2, 0, 54], [8, 7.5, 60], F2);                       // P3
  c.pad([-1, 7.5, 57], [-10, 10, 55], 2.2);
  c.box([-14, 0, 50], [-6, 10, 60], F2);                      // P4
  c.ramp([-14, 10, 44], [-8, 12.5, 50], '-z', GR);
  c.box([-14, 0, 36], [-8, 12.5, 44], F2);                    // P5
  c.sponge([-10, 12.5, 36], [-8, 15, 38]);
  c.box([-8, 13, 32], [2, 15, 38], F2);                       // P6 (floating)
  c.box([2, 13, 33], [4, 16.2, 37], GR);
  c.box([4, 15.5, 32], [14, 17.4, 40], F2);                   // P7 (floating)
  c.pad([11, 17.4, 38.6], [10, 20, 46], 2.4);
  c.box([6, 18, 42], [14, 20, 50], F2);                       // P8 (floating)
  c.ramp([2, 20, 46], [6, 22.5, 50], '-x', GR);
  c.box([-4, 20.5, 46], [2, 22.5, 60], F2);                   // top walkway
  c.drain('b1', [13.6, 3.6, 46], [14, 5.6, 48.6], 'nx');
  c.drain('b2', [-14, 11.6, 45.6], [-13.6, 13.6, 48.6], 'px');
  c.drain('b3', [5, 21, 59.6], [7.6, 23.2, 60], 'nz');
  c.flood({ y0: -1, ymax: 22, rate: 0.2, min: [-14, 30], max: [14, 60], drains: ['b1', 'b2', 'b3'], drop: 7, start: [[-12, -1, 33], [12, 5, 42]] });
  c.enemy('splotch', [3, 7.5, 57], { size: 'L' });
  c.enemy('smudge', [-11, 12.5, 40]);
  c.enemy('splotch', [12, 20, 44], { size: 'M' });
  c.checkpoint([11, 2.5, 39], 0);
  c.checkpoint([-10, 10, 56.5], Math.PI);
  c.checkpoint([-3, 15, 35], Math.PI / 2);
  c.checkpoint([10, 20, 47.5], Math.PI);
  c.checkpoint([-1, 22.5, 55], 0);
  c.say([-8, 32], [8, 40], SAY.l7_split, { minY: 1 });
  c.tip([8, 32], [14, 44], 'Up, up, up! Three <b>drains</b> on the shaft walls each push the tide down a level.', { maxY: 4 });
  c.tip([-2, 52], [8, 60], 'Splotches <b>split</b> when splashed. Then hop the pad to the far ledge.', { minY: 6 });
  c.tip([-8, 32], [4, 38], 'Climb on! The step leads to the next ledge.', { minY: 14 });
  c.shardLine([11, 2.6, 37], [11, 2.6, 41], 3);
  c.shardLine([9, 5.1, 52], [13, 5.1, 56], 3);
  c.shardLine([-12, 10.1, 52], [-8, 10.1, 58], 3);
  c.shardLine([-6, 15.1, 35], [0, 15.1, 35], 3);
  c.shardLine([8, 20.1, 44], [12, 20.1, 48], 3);
  c.shard([1, 14.1, 47.5], true);
  // a swatch on top of the central column (climb it, or drop from the walkway above)
  c.swatchAt([0, 15.3, 45]);
  c.tip([-3, 43], [3, 49], 'Paint the column and climb. Something shiny is up here.', { maxY: 12 });
  // ---- C: the overflow chamber (splotch arena) and the core
  floor(c, -12, 12, 60, 96, 22.5, F, { thick: 4 });
  walls(c, -12, 12, 60, 96, 18.5, 14, { s: [[-3, 3]], e: [[67, 69]] }, WL);
  c.door('l7in', [-3, 22.5, 60.2], [3, 26.5, 60.8], { dir: 'down', open: true });
  c.wall([-12, 22.5, 87.4], [-3, 32.5, 88], WL); c.wall([3, 22.5, 87.4], [12, 32.5, 88], WL);
  c.box([-3, 26.5, 87.4], [3, 32.5, 88], WL);
  c.door('l7out', [-3, 22.5, 87.4], [3, 26.5, 88], { dir: 'up' });
  c.box([-6, 22.5, 72], [-4, 24, 74], S2.wood); c.box([4, 22.5, 76], [6, 24, 78], S2.wood);
  c.checkpoint([0, 22.5, 62.5], 0);
  c.arena('overflow', [-11, 21, 64], [11, 29, 86], {
    name: 'Overflow Chamber', doors: ['l7in', 'l7out'], shards: 10,
    waves: [
      [{ kind: 'splotch', size: 'L', pos: [-5, 22.5, 76] }, { kind: 'smudge', pos: [5, 22.5, 70] }, { kind: 'smudge', pos: [6, 22.5, 82] }],
      [{ kind: 'splotch', size: 'L', pos: [5, 22.5, 78] }, { kind: 'gooper', pos: [-6, 22.5, 82] }, { kind: 'smudge', pos: [0, 22.5, 84] }],
    ],
  });
  c.coreAt([0, 22.5, 92.5]);
  c.shardRing([0, 22.6, 92.5], 3, 6);
  // hidden: a vent in the east wall only a swimmer fits under, into a little overflow tank
  c.box([12, 23.25, 67], [13, 32.5, 69], { mat: 'grate', color: 0x6a8088 });
  floor(c, 13, 17, 64.5, 71.5, 22.5, F2, { thick: 4 });
  walls(c, 13, 17, 64.5, 71.5, 22.5, 5, { w: [[64.5, 71.5]] }, WL);
  c.box([13, 27.5, 64.5], [17, 28.1, 71.5], WL);
  c.swatchAt([15, 23.8, 68]);
  c.shard([16, 22.6, 66], true); c.shard([16, 22.6, 70], true);
  c.tip([8, 64], [12, 72], 'That grate is low enough to <b>swim</b> under…', { minY: 21 });
  // decor
  tank(c, [-5.5, 0, 4], 1.3, 6); tank(c, [5.5, 0, 6], 1.1, 5);
  c.pipe([[-7.6, 9, -4], [-7.6, 9, 30]], 0.3, S2.pipe);
  c.pipe([[-13.6, 30, 30], [13.6, 30, 30]], 0.4, S2.pipe);
  c.pipe([[13.5, 28, 32], [13.5, 28, 60]], 0.32, 0x6a9aa6);
  c.pipe([[-11.6, 30, 60], [-11.6, 30, 96]], 0.3, S2.pipe);
  lamps(c, [[0, 9, 10], [0, 26, 46], [0, 30, 74]]);
  for (const [x, y, z] of [[13.9, 8, 34], [-13.9, 16, 54], [13.9, 24, 56]]) valveWheel(c, [x, y, z], Math.PI / 2);
  sign(c, 'CISTERN 2 · FLOOD RISK', [0, 6.5, -3.9], 6.5, 1.1, 0, { accent: '#1fb5ff' });
  for (const [x, y, z, r] of [[2, 0.02, 6, 1.4], [-4, 0.02, 22, 1.2], [10, 2.52, 40, 1.2], [-10, 10.02, 54, 1.2], [0, 22.52, 70, 1.6]]) c.gooAt([x, y, z], r);
  // signposting: glowing floor arrows along the main route
  c.arrow([-4.5, 0, 19.5], -1.5707963, { s: 1.2 });
  c.arrow([10.5, 0, 31], 0, { s: 1.2 });
  c.arrow([0, 22.5, 64], 0, { s: 1.2 });
  c.level.killY = -6;
}

// ============================================================== L8: Bottling Line
export function buildL8(c) {
  // ---- A: the belt walk (walk against the belts, sideways belts over pits)
  floor(c, -6, 6, -4, 10, 0, F);
  walls(c, -6, 6, -4, 96, -12, 20, { n: [[-6, 6]] }, WL);
  c.conveyor([-1.5, -0.5, 10], [1.5, 0, 30], [0, 0, -1], 3.2);
  goo(c, -6, 6, 10, 30, -3);
  floor(c, -6, 6, 30, 36, 0, F2);
  c.conveyor([-4, -0.5, 36], [4, 0, 39], [1, 0, 0], 2.6);
  c.conveyor([-4, -0.5, 41], [4, 0, 44], [-1, 0, 0], 2.6);
  c.conveyor([-4, -0.5, 46], [4, 0, 49], [1, 0, 0], 3.2);
  goo(c, -6, 6, 36, 49, -3);
  floor(c, -6, 6, 49, 56, 0, F2);
  c.spawnAt([0, 0, -1.5], 0);
  c.tip([-6, -4], [6, 12], 'This <b>conveyor belt</b> runs against you. Keep walking (or swim in your ink to go faster)!');
  c.tip([-6, 30], [6, 36], 'Sideways belts push you toward the edge. Lean into them and hop the gaps!');
  // a crate stack by the start, with a swatch on the top crate
  c.box([3.6, 0, 0.5], [6, 1.4, 3], S2.wood); c.box([4.2, 1.4, 1], [6, 2.8, 2.8], S2.wood);
  c.swatchAt([5.1, 4.1, 1.9]);
  c.shardLine([0, 0.1, 12], [0, 0.1, 28], 6);
  c.shardLine([0, 0.1, 37.5], [0, 0.1, 47.5], 3);
  c.checkpoint([0, 0, 32.5], 0);
  c.checkpoint([0, 0, 52], 0);
  // ---- B: the first ink rail across the bottling pit
  island(c, [-6, -4, 56], [6, 0, 60], F2, 0x4a6a74);
  c.rail([[0, 1.6, 59.2], [0, 0.6, 72], [0, 0.0, 86.8]], { speed: 10 });
  goo(c, -6, 6, 60, 86, -6);
  island(c, [-6, -4, 86], [6, -1.5, 96], F2, 0x4a6a74);
  c.say([-6, 50], [6, 58], SAY.l8_rail);
  c.tip([-6, 54], [6, 60], 'Walk into the glowing <b>ink rail</b> hook. It whisks you across!');
  c.shardLine([0, 0.6, 64], [0, 0, 82], 6);
  c.checkpoint([0, -1.5, 90], 0);
  // ---- C: the bottling hall: Rumbler arena (belts carry bottles across)
  floor(c, -14, 14, 96, 134, -1.5, F, { thick: 3 });
  walls(c, -14, 14, 96, 134, -4.5, 18, { s: [[-6, 6]], n: [[-3, 3]] }, WL);
  c.door('l8in', [-6, -1.5, 96.2], [6, 2.5, 96.8], { dir: 'down', open: true });
  c.wall([-14, -1.5, 127.4], [-3, 13.5, 128], WL); c.wall([3, -1.5, 127.4], [14, 13.5, 128], WL);
  c.box([-3, 2.5, 127.4], [3, 13.5, 128], WL);
  c.door('l8out', [-3, -1.5, 127.4], [3, 2.5, 128], { dir: 'up' });
  c.conveyor([-14, -1.5, 104], [14, -1.38, 106], [1, 0, 0], 2.0);
  c.conveyor([-14, -1.5, 118], [14, -1.38, 120], [-1, 0, 0], 2.0);
  c.box([-10, -1.5, 110], [-8, 0.2, 113], S2.wood); c.box([8, -1.5, 110], [10, 0.2, 113], S2.wood);
  c.box([-1.5, -1.5, 111], [1.5, 1.5, 113], { mat: 'concreteDark', color: 0x9ab4bc });
  c.checkpoint([0, -1.5, 98.5], 0);
  c.arena('hall', [-13, -3, 100], [13, 5, 126], {
    name: 'Bottling Hall', doors: ['l8in', 'l8out'], shards: 12,
    waves: [
      [{ kind: 'rumbler', pos: [0, -1.5, 122] }, { kind: 'smudge', pos: [-8, -1.5, 115] }, { kind: 'smudge', pos: [8, -1.5, 115] }],
      [{ kind: 'rumbler', pos: [-9, -1.5, 123] }, { kind: 'rumbler', pos: [9, -1.5, 123] }, { kind: 'gooper', pos: [0, -1.5, 116] }],
    ],
  });
  c.say([-14, 99], [14, 103], SAY.l8_rumbler, { minY: -3 });
  c.tip([-14, 100], [14, 126], 'A <b>Rumbler</b> revs up, then charges in a straight line. Sidestep, let it hit a wall, then splash it!', { minY: -3 });
  // a swatch up on the belt machinery (climb the container by the east belt)
  c.box([11, -1.5, 108], [14, 4.5, 111], { mat: 'container', color: 0x5f8a96 });
  c.swatchAt([12.5, 5.8, 109.5]);
  c.shard([12, 4.6, 110.4], true);
  // ---- D: the rail chain to the core
  c.checkpoint([0, -1.5, 130.5], 0);
  c.rail([[-3, 0.2, 133.4], [-6, 3, 146], [-4, 6, 158.4]], { speed: 9 });
  island(c, [-8, -4, 158], [0, 4.5, 166], F2, 0x4a6a74);
  c.rail([[-2, 6.1, 165.6], [3, 5.6, 174], [9, 4.2, 186.6]], { speed: 10 });
  island(c, [4, -4, 186], [16, 2, 198], F2, 0x4a6a74);
  goo(c, -20, 26, 134, 200, -8);
  c.enemy('gooper', [12, 2, 194.5]);
  c.enemy('pilfer', [7, 2, 196]);
  c.coreAt([10, 2, 192]);
  c.checkpoint([-4, 4.5, 162], 0);
  c.shardLine([-5.5, 3.4, 146], [-4.5, 5.8, 156], 4);
  c.shardLine([3.6, 5.0, 175], [8, 3.6, 184], 4);
  // hidden: an island below the second rail; drop off early to reach it, then ride back
  island(c, [2, -4, 170], [6, 0, 174.5], F2, 0x4a6a74);
  c.swatchAt([4, 1.3, 171]);
  c.shard([3, 0.1, 173.5], true);
  c.rail([[4, 1.6, 174.2], [7, 3.0, 180], [8, 3.6, 187.6]], { speed: 9 });
  c.tip([-8, 158], [0, 166], 'Jumping off a rail early (<b>SPACE</b>) can take you places. Look down on the way…', { minY: 4 });
  // decor: bottles riding the belts
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fe0c0, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.6, depthWrite: false });
  const bottles = [];
  for (let i = 0; i < 14; i++) {
    const b = part(c.decor, new THREE.CylinderGeometry(0.18, 0.2, 0.6, 10), glass, { shadow: false });
    part(b, new THREE.CylinderGeometry(0.07, 0.1, 0.25, 8), glass, { pos: [0, 0.42, 0], shadow: false });
    bottles.push({ b, lane: i % 2, u: i / 14 });
  }
  c.updaters.push((dt) => { for (const o of bottles) { o.u = (o.u + dt * 0.07) % 1; const x = o.lane ? 14 - o.u * 28 : -14 + o.u * 28; o.b.position.set(x, -1.38 + 0.3, o.lane ? 119 : 105); } });
  tank(c, [-11, -1.5, 99.8], 1.3, 6); tank(c, [11, -1.5, 124.5], 1.3, 6);
  c.pipe([[-5.6, 9, -4], [-5.6, 9, 96]], 0.3, S2.pipe);
  c.pipe([[-13.6, 10, 96], [-13.6, 10, 134], [13.6, 10, 134], [13.6, 10, 96]], 0.32, S2.pipe);
  lamps(c, [[0, 8, 4], [0, 8, 40], [0, 9, 70], [0, 11, 112], [-4, 12, 160]], 0xcfffe0);
  sign(c, 'BOTTLING LINE 7', [0, 6.5, -3.9], 6, 1.1, 0, { accent: '#c6ff3d' });
  for (const [x, y, z, r] of [[3, 0.02, 4, 1.2], [-3, 0.02, 53, 1.3], [5, -1.48, 101, 1.4]]) c.gooAt([x, y, z], r);
  // signposting: glowing floor arrows along the main route
  c.arrow([0, 0, 5], 0, { s: 1.2 });
  c.arrow([0, 0, 57.4], 0, { s: 1.2 });
  c.arrow([0, -1.5, 129.6], 0, { s: 1.2 });
  c.level.killY = -7;
}

// ============================================================== L9: Pump Station
export function buildL9(c) {
  // ---- A: the intake: Pilfers and a moving barge over the channel
  floor(c, -8, 8, -4, 24, 0, F);
  walls(c, -8, 8, -4, 52, -6, 16, { n: [[-8, 8]] }, WL);
  crates(c, [[-5, 0, 8, 1.6, 1.3], [5, 0, 12, 1.6, 1.3], [-3, 0, 17, 1.6, 1.3]], S2.wood);
  c.enemy('pilfer', [4, 0, 18]);
  c.enemy('pilfer', [-5, 0, 20]);
  c.enemy('smudge', [0, 0, 14]);
  c.spawnAt([0, 0, -1.5], 0);
  c.say([-8, 2], [8, 10], SAY.l9_pilfer);
  c.tip([-8, 4], [8, 24], 'A <b>Pilfer</b> steals half your ink and runs. Splash it first, or chase it down to get your ink back!');
  c.shardLine([-6, 0.1, 2], [-6, 0.1, 12], 4);
  c.checkpoint([0, 0, 21.5], 0);
  // the channel: a barge ferries you across
  waterStrip(c, -8, 8, 24, 48, -1.0, 0x2aa8c0);
  c.mover([-2, -0.6, 24.4], [2, 0, 28.4], { path: [[0, 0, 0], [0, 0, 19]], speed: 2.6, wait: 1.2, color: 0x8a6a4a, mat: 'wood' });
  floor(c, -8, 8, 48, 52, 0, F2);
  c.tip([-8, 22], [8, 25], 'Hop on the <b>barge</b>. It ferries you over the channel.');
  c.shardLine([0, 0.6, 30], [0, 0.6, 44], 5);
  c.say([-8, 24], [8, 30], SAY.l9_distress);
  // ---- B: the valve gallery: two switches, two doors, sponges and a rail
  floor(c, -12, 12, 52, 84, 0, F, { thick: 4 });
  walls(c, -12, 12, 52, 84, -4, 16, { s: [[-8, 8]], n: [[-3, 3]] }, WL);
  c.wall([-12, 0, 66], [-1.5, 12, 67], WL); c.wall([1.5, 0, 66], [12, 12, 67], WL);
  c.box([-1.5, 4.5, 66], [1.5, 12, 67], WL);
  c.door('l9d1', [-1.5, 0, 66], [1.5, 4.5, 67], { dir: 'up' });
  c.paintSwitch('l9s1', [-12, 1.4, 58], [-11.6, 3.4, 61], 'px', { targets: ['l9d1'], label: 'Valve door open' });
  c.wall([-12, 0, 76], [-1.5, 12, 77], WL); c.wall([1.5, 0, 76], [12, 12, 77], WL);
  c.box([-1.5, 4.5, 76], [1.5, 12, 77], WL);
  c.door('l9d2', [-1.5, 0, 76], [1.5, 4.5, 77], { dir: 'up' });
  c.box([7, 0, 70], [12, 4.0, 75], SLICK);
  c.sponge([5, 0, 71], [7, 3.0, 73]);
  c.paintSwitch('l9s2', [9, 4.0, 71.5], [11, 4.12, 73.5], 'top', { targets: ['l9d2'], label: 'Second valve door open' });
  c.enemy('gooper', [-6, 0, 72]);
  c.enemy('smudge', [4, 0, 62]);
  c.enemy('pilfer', [-8, 0, 81]);
  c.enemy('rumbler', [6, 0, 81], { yaw: Math.PI });
  c.checkpoint([0, 0, 54.5], 0);
  c.tip([-12, 52], [12, 66], 'Locked! Find the <b>switch</b> to open the valve door.');
  c.tip([-12, 67], [12, 76], 'The next switch is on <b>top</b> of the slick block. Grow the sponge and paint it from up there.');
  c.shardLine([-4, 0.1, 54], [9, 0.1, 54], 5);
  c.shard([10, 4.2, 74.4], true);
  // a swatch up on a ledge: sponges onto the slick block, then the rail
  c.box([-12, 0, 52], [-8, 5, 56], SLICK);
  c.sponge([-8, 0, 52.4], [-6.4, 2.6, 54]);
  c.sponge([-8, 0, 54], [-6.4, 4.0, 55.6]);
  c.rail([[-10, 6.4, 55.6], [-9, 7.2, 59], [-6, 8.0, 62.8]], { speed: 8 });
  c.box([-8, 0, 61.5], [-4, 6.4, 64.5], F2);
  c.swatchAt([-6, 7.7, 63]);
  // ---- C: the pump platform (defend it!)
  floor(c, -16, 16, 84, 124, 0, F, { thick: 4 });
  walls(c, -16, 16, 84, 124, -4, 18, { s: [[-3, 3]], e: [[98, 100.5]] }, WL);
  c.box([-5, 0, 96], [5, 0.6, 106], { mat: 'grate', color: 0xb4c8cc });
  c.pump([0, 0.6, 101], {
    hp: 700, time: 60, zone: [[-4.5, 0, 96.5], [4.5, 3, 105.5]],
    waves: [
      { t: 1, list: [{ kind: 'smudge', pos: [-13, 0, 88] }, { kind: 'smudge', pos: [13, 0, 88] }, { kind: 'smudge', pos: [0, 0, 113] }] },
      { t: 12, list: [{ kind: 'gooper', pos: [-11, 0, 110], atPump: false }, { kind: 'splotch', size: 'M', pos: [12, 0, 112] }, { kind: 'smudge', pos: [-13, 0, 100] }] },
      { t: 24, list: [{ kind: 'rumbler', pos: [12, 0, 90] }, { kind: 'smudge', pos: [-12, 0, 112] }, { kind: 'pilfer', pos: [-13, 0, 92], atPump: false }] },
      { t: 36, list: [{ kind: 'splotch', size: 'L', pos: [-12, 0, 89] }, { kind: 'smudge', pos: [13, 0, 108] }, { kind: 'smudge', pos: [0, 0, 87] }] },
      { t: 47, list: [{ kind: 'rumbler', pos: [-12, 0, 112] }, { kind: 'gooper', pos: [11, 0, 90], atPump: false }, { kind: 'smudge', pos: [13, 0, 100] }, { kind: 'smudge', pos: [-13, 0, 106] }] },
    ],
  });
  for (const [x, z] of [[-9, 92], [9, 92], [-9, 110], [9, 110]]) c.box([x - 1, 0, z - 1], [x + 1, 1.4, z + 1], S2.wood);
  c.box([12.5, 0, 84.5], [16, 4.2, 88], { mat: 'container', color: 0x5f8a96 });
  c.swatchAt([14.2, 5.5, 86.2]);
  c.checkpoint([0, 0, 88], 0);
  c.say([-16, 86], [16, 94], SAY.l9_pump);
  c.tip([-16, 84], [16, 96], 'Step onto the <b>pump platform</b> to start it. Keep the Drab off it until the tank is full!');
  // ---- D: the core alcove (sealed until the pump is done)
  c.coreAt([0, 0, 120], { need: ['pump'] });
  c.shardRing([0, 0.1, 120], 3, 6);
  // hidden: a low grate in the east wall into a storeroom
  c.box([16, 0.75, 98], [17, 18, 100.5], { mat: 'grate', color: 0x6a8088 });
  floor(c, 17, 22, 96, 103, 0, F2);
  walls(c, 17, 22, 96, 103, 0, 5, { w: [[96, 103]] }, WL);
  c.box([17, 5, 96], [22, 5.6, 103], WL);
  c.swatchAt([20, 1.3, 99.5]);
  c.shard([21, 0.2, 97.5], true); c.shard([21, 0.2, 101.5], true);
  c.tip([12, 94], [16, 104], 'That grate is low enough to <b>swim</b> under…');
  // decor
  tank(c, [-12.5, 0, 98], 1.8, 7); tank(c, [12.5, 0, 108], 1.8, 7); tank(c, [-12.5, 0, 114], 1.3, 5);
  c.pipe([[0, 9, 101], [0, 9, 86], [-15.6, 9, 86]], 0.45, 0x5f9aa8);
  c.pipe([[0, 9, 101], [0, 9, 116], [15.6, 9, 116]], 0.45, 0x5f9aa8);
  c.pipe([[-7.6, 8, -4], [-7.6, 8, 52]], 0.3, S2.pipe);
  c.pipe([[-11.6, 9, 52], [-11.6, 9, 84]], 0.3, S2.pipe);
  lamps(c, [[0, 8, 8], [0, 9, 36], [0, 9, 60], [0, 12, 100]]);
  sign(c, 'PUMP STATION · AUTHORIZED GRAY ONLY', [0, 6.5, -3.9], 8, 1.1, 0, { accent: '#2ee6a8' });
  for (const [x, z, r] of [[2, 4, 1.2], [-6, 72, 1.6], [6, 90, 1.5], [-7, 108, 1.4]]) c.gooAt([x, 0.02, z], r);
  // signposting: glowing floor arrows along the main route
  c.arrow([0, 0, 22.5], 0, { s: 1.2 });
  c.arrow([-6, 0, 59.5], -1.5707963, { s: 1.2 });
  c.arrow([0, 0, 89.5], 0, { s: 1.2 });
  c.level.killY = -5;
}

// ============================================================== L10: The Grimewyrm (boss)
export function buildL10(c) {
  // entry corridor
  floor(c, -4, 4, -34, -22, 0, F2);
  walls(c, -4, 4, -34, -22, 0, 9, { n: [[-4, 4]] }, WL);
  c.spawnAt([0, 0, -31.5], 0);
  c.checkpoint([0, 0, -29], 0);
  c.box([-4, 0, -28], [-2.6, 3.4, -25], { mat: 'container', color: 0x5f8a96 });
  c.swatchAt([-3.3, 4.7, -26.5]);
  c.shardLine([2, 0.1, -32], [2, 0.1, -24], 5);
  c.shard([-3.3, 3.5, -27.4], true);
  c.door('wyrmDoor', [-4, 0, -23], [4, 6, -22.4], { dir: 'up', open: true });
  c.box([-4, 6, -23], [4, 14, -22.4], WL);
  // the reservoir: a square ring walkway around a deep goo pool
  const R0 = 10, R1 = 23;
  c.box([-R1, -3, -R1], [R1, 0, -R0], F); c.box([-R1, -3, R0], [R1, 0, R1], F);
  c.box([-R1, -3, -R0], [-R0, 0, R0], F); c.box([R0, -3, -R0], [R1, 0, R0], F);
  walls(c, -R1, R1, -R1, R1, -3, 17, { s: [[-4, 4]] }, WL);
  c.box([-R0, -10, -R0], [R0, -9, R0], { mat: 'concreteDark', color: 0x4a5a60 });
  goo(c, -R0, R0, -R0, R0, -0.6, 0x7d7a88);
  // raised refuges for the high tide
  for (const [x, z] of [[-16.5, -16.5], [16.5, -16.5], [-16.5, 16.5], [16.5, 16.5]]) c.box([x - 2.2, 0, z - 2.2], [x + 2.2, 2.4, z + 2.2], { mat: 'concreteDark', color: 0x8fa8b0 });
  for (const [x, z] of [[-16.5, -12], [16.5, -12], [-16.5, 12], [16.5, 12]]) c.ramp([x - 1.2, 0, z < 0 ? z - 2.3 : z], [x + 1.2, 2.4, z < 0 ? z : z + 2.3], z < 0 ? '-z' : '+z', { mat: 'grate', color: 0xb4c8cc });
  // drains on the outer walls (phase 2)
  c.drain('w1', [-1.2, 0.6, R1 - 0.4], [1.2, 2.6, R1], 'nz', { disabled: true });
  c.drain('w2', [-R1, 0.6, -1.2], [-R1 + 0.4, 2.6, 1.2], 'px', { disabled: true });
  c.drain('w3', [R1 - 0.4, 0.6, -1.2], [R1, 2.6, 1.2], 'nx', { disabled: true });
  c.drain('w4', [-13, 0.6, -R1], [-10.6, 2.6, -R1 + 0.4], 'pz', { disabled: true });
  c.zone([-R1, -1, -R1 + 1.5], [R1, 10, R1], 'arena');
  c.cageAt = new THREE.Vector3(0, 10, 0);
  // decor
  for (const [x, z] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) c.lamp([x, 10.5, z], 0x9fe8ff, { intensity: 26, dist: 22, hang: 3 });
  c.pipe([[-22.6, 11, -22.6], [22.6, 11, -22.6], [22.6, 11, 22.6], [-22.6, 11, 22.6], [-22.6, 11, -22.6]], 0.4, S2.pipe);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; c.pipe([[Math.cos(a) * 22.6, 13, Math.sin(a) * 22.6], [Math.cos(a) * 8.5, 13, Math.sin(a) * 8.5], [Math.cos(a) * 8.5, -0.8, Math.sin(a) * 8.5]], 0.3, 0x6a9aa6); }
  sign(c, 'MAIN RESERVOIR · DO NOT FEED', [0, 6, -33.9], 7, 1.1, 0, { accent: '#f0e6ff' });
  for (const [x, z, r] of [[-15, 6, 1.6], [14, -7, 1.6], [6, 16, 1.4], [-6, -16, 1.4]]) c.gooAt([x, 0.02, z], r);
  c.level.killY = -8;
}
