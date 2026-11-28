// Sector 3: Grisaille Manor. Monochrome halls, parquet, portraits and chandeliers.
//   l11 Lights Out          darkness: your ink glows; paint under lanterns to light them. Glints
//   l12 Crumbling Gallery   cracked floors that give way, updraft fans over the gaps. Wardens
//   l13 Chroma Locks        membranes you swim through, timed switch runs, rotating platforms
//   l14 The Grand Ascent    everything at once, with the gray flooding up the tower behind you
//   l15 Baron Grisaille     the throne room: three easels, three drains, one Baron
import * as THREE from 'three';
import { std, glowMat, part, rod } from './kit.js';
import { S3, sign, floor, walls, island, crates, chandelier, portrait, carpet, curtain, bust, goo } from './build.js';
import { SAY } from './dialogue.js';

const F = S3.floor, F2 = S3.floor2, WL = S3.wall, ST = S3.stone, WD = S3.wood;
const MARBLE = { mat: 'tiles', color: 0xd8d4dc };
const BLACKM = { mat: 'tiles', color: 0x6e6a78 };
function portraits(c, list) { for (const [x, y, z, yaw, s] of list) portrait(c, [x, y, z], yaw, s || 1); }
function pillar(c, x, z, y0, h, w = 1.2, m = ST) { c.box([x - w / 2, y0, z - w / 2], [x + w / 2, y0 + h, z + w / 2], m); }

// ============================================================== L11: Lights Out
export function buildL11(c) {
  // ---- A: the dark foyer (lantern tutorial)
  floor(c, -7, 7, -4, 24, 0, F);
  walls(c, -7, 7, -4, 24, 0, 8, { n: [[-7, 7]] }, WL);
  c.inkLane([0, 0.03, -2.5], [0, 0.03, 3], 1.4, 0.8);
  c.lantern([-5, 0, 6]); c.lantern([5, 0, 13]); c.lantern([-5, 0, 20]);
  c.spawnAt([0, 0, -2], 0);
  c.tip([-7, -4], [7, 9], 'It\'s pitch dark, but your <b>ink glows</b>! Paint as you go to light your way. Paint the floor under a <b>lantern</b> to light it.');
  c.shardLine([3, 0.1, 2], [3, 0.1, 10], 4);
  c.shardLine([-3, 0.1, 14], [-3, 0.1, 22], 4);
  carpet(c, -1.6, 1.6, -4, 24, 0, 0x3a2030);
  portraits(c, [[-6.9, 3.2, 10, Math.PI / 2], [6.9, 3.2, 18, -Math.PI / 2]]);
  c.checkpoint([0, 0, 22], 0);
  // ---- B: the long gallery: a Glint at the far end, pillars for cover
  floor(c, -8, 8, 24, 64, 0, F);
  walls(c, -8, 8, 24, 64, 0, 9, { s: [[-7, 7]], n: [[-2, 2]], w: [[47, 53]] }, WL);
  c.box([-8, 0, 23], [-7, 9, 24], WL); c.box([7, 0, 23], [8, 9, 24], WL);
  for (const z of [32, 40, 48, 56]) { pillar(c, -3.5, z, 0, 5); pillar(c, 3.5, z, 0, 5); }
  c.box([-6, 0, 60], [6, 3, 64], ST);
  c.enemy('glint', [0, 3, 62.5], { yaw: Math.PI });
  c.enemy('smudge', [-5, 0, 44]);
  c.enemy('smudge', [5, 0, 52]);
  c.lantern([-6.5, 0, 30]); c.lantern([6.5, 0, 38]); c.lantern([-6.5, 0, 50]); c.lantern([6.5, 0, 58]);
  c.say([-8, 24], [8, 30], SAY.l11_glint);
  c.tip([-8, 26], [8, 58], 'A <b>Glint</b> sniper! Hide behind pillars. When its laser flashes <b>red</b>, dive or duck!');
  c.shardLine([0, 0.1, 30], [0, 0.1, 56], 7);
  portraits(c, [[-7.9, 3.4, 36, Math.PI / 2], [7.9, 3.4, 44, -Math.PI / 2], [-7.9, 3.4, 52, Math.PI / 2]]);
  // side alcove with a swatch, behind the third lantern
  c.box([-12, -1, 46], [-8, 0, 54], F);
  walls(c, -12, -8, 46, 54, 0, 5, { e: [[46, 54]] }, WL);
  c.box([-9, 5, 47], [-8, 9, 53], WL);
  c.box([-12, 5, 46], [-8, 5.6, 54], WL);
  c.swatchAt([-10.5, 1.3, 50]);
  c.lantern([-11, 0, 47]);
  c.ramp([-6, 0, 56], [-4, 3, 60], '+z', WD);
  c.checkpoint([-3.5, 3, 61.5], 0);
  // ---- C: the servants' passages: a dark little maze
  floor(c, -16, 16, 64, 96, 3, F2, { thick: 4 });
  walls(c, -16, 16, 64, 96, -1, 9, { s: [[-2, 2]], n: [[-2, 2]], w: [[77, 79]] }, WL);
  const wallM = { mat: 'wallpaper', color: 0x8a8496 };
  const mz = (x0, z0, x1, z1) => c.wall([x0, 3, z0], [x1, 8, z1], wallM);
  mz(-16, 70, -6, 71); mz(-2, 70, 10, 71); mz(6, 70, 7, 80); mz(-10, 75, -9, 86); mz(-9, 80, 2, 81); mz(2, 76, 16, 77);
  mz(-16, 86, -3, 87); mz(3, 86, 12, 87); mz(-3, 81, -2, 86); mz(11, 81, 12, 86);
  c.enemy('smudge', [-12, 3, 78]); c.enemy('smudge', [8, 3, 82]); c.enemy('pilfer', [12, 3, 92]); c.enemy('smudge', [-6, 3, 92]);
  c.lantern([0, 3, 67]); c.lantern([-13, 3, 73]); c.lantern([13, 3, 73]); c.lantern([-5, 3, 84]); c.lantern([8, 3, 90]);
  c.checkpoint([0, 3, 66.5], 0);
  c.say([-16, 64], [16, 70], SAY.l11_baron);
  c.tip([-16, 64], [16, 72], 'The servants\' passages. Dead ends hide <b>shards</b>. Light the lanterns to find your way.', { minY: 2 });
  for (const [x, z] of [[-14, 66], [-14, 84], [14, 84], [14, 66], [-7, 78]]) c.shard([x, 3.1, z], true);
  c.shardLine([-4, 3.1, 73], [4, 3.1, 73], 4);
  // a vent in the west wall: swim under it to a hidden pantry
  c.box([-17, 3.75, 77], [-16, 12, 79], { mat: 'grate', color: 0x5a5662 });
  floor(c, -21, -17, 74, 82, 3, F2);
  walls(c, -21, -17, 74, 82, 3, 4, { e: [[74, 82]] }, WL);
  c.box([-21, 7, 74], [-17, 7.6, 82], WL);
  c.swatchAt([-19, 4.3, 78]);
  c.shard([-20, 3.1, 75.5], true); c.shard([-20, 3.1, 80.5], true);
  c.lantern([-20, 3, 81]);
  // ---- D: the ballroom (Glints on the balconies, then the lights come on)
  floor(c, -14, 14, 96, 134, 3, MARBLE, { thick: 4 });
  walls(c, -14, 14, 96, 134, -1, 12, { s: [[-2, 2]] }, WL);
  c.door('l11in', [-2, 3, 96.2], [2, 7, 96.8], { dir: 'down', open: true });
  c.box([-14, 3, 120], [-9, 7, 124], ST); c.box([9, 3, 120], [14, 7, 124], ST);
  c.box([-6, 3, 126], [6, 4.2, 134], { mat: 'woodFloor', color: 0x8a5a4a });
  for (const [x, z] of [[-8, 104], [8, 104], [-8, 114], [8, 114]]) pillar(c, x, z, 3, 7, 1.4);
  c.lantern([-11, 3, 100]); c.lantern([11, 3, 100]); c.lantern([-11, 3, 116]); c.lantern([11, 3, 116]);
  c.checkpoint([0, 3, 98.5], 0);
  c.arena('ball', [-13, 2, 100], [13, 10, 125], {
    name: 'The Ballroom', doors: ['l11in'], shards: 12,
    waves: [
      [{ kind: 'glint', pos: [-11.5, 7, 122], yaw: Math.PI }, { kind: 'smudge', pos: [-5, 3, 110] }, { kind: 'smudge', pos: [5, 3, 110] }, { kind: 'smudge', pos: [0, 3, 116] }],
      [{ kind: 'glint', pos: [11.5, 7, 122], yaw: Math.PI }, { kind: 'pilfer', pos: [-8, 3, 118] }, { kind: 'smudge', pos: [8, 3, 106] }, { kind: 'smudge', pos: [-8, 3, 106] }],
    ],
  });
  c.coreAt([0, 4.2, 130], { need: ['arena:ball'] });
  c.shardRing([0, 4.3, 130], 3, 6);
  c.lantern([-4, 4.2, 132.5]); c.lantern([4, 4.2, 132.5]);
  // swatch up on the west balcony
  c.swatchAt([-11.5, 8.3, 123]);
  c.tip([-14, 116], [-9, 126], 'Paint the balcony wall and climb. Something glints up there.', { minY: 2.5, maxY: 6 });
  portraits(c, [[-13.9, 6, 108, Math.PI / 2, 1.3], [13.9, 6, 108, -Math.PI / 2, 1.3], [0, 7.5, 133.9, Math.PI, 1.6]]);
  curtain(c, [-4.5, 7.5, 133.8], 3, 6, Math.PI, 0x3a2a40); curtain(c, [4.5, 7.5, 133.8], 3, 6, Math.PI, 0x3a2a40);
  chandelier(c, [0, 10.5, 112], 0xffe0b0, { light: false });
  c.lamp([0, 6.4, -2.5], 0xffc890, { intensity: 10, dist: 9, hang: 1.2 });
  for (const [x, y, z, r] of [[2, 0.02, 12, 1.2], [-3, 0.02, 40, 1.5], [3, 3.02, 78, 1.3], [-6, 3.02, 108, 1.6]]) c.gooAt([x, y, z], r);
  // signposting: glowing floor arrows along the main route
  c.arrow([0, 0, 4.5], 0, { s: 1.2 });
  c.arrow([-3.5, 0, 55], 0, { s: 1.2 });
  c.arrow([0, 3, 68], 0, { s: 1.2 });
  c.arrow([0, 3, 99.5], 0, { s: 1.2 });
  c.level.killY = -6;
}

// ============================================================== L12: Crumbling Gallery
export function buildL12(c) {
  // ---- A: the cracked hall: tiles give way a moment after you land
  floor(c, -8, 8, -4, 8, 0, F);
  walls(c, -8, 8, -4, 60, -12, 22, { n: [[-8, 8]] }, WL);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const x = -6 + j * 3.2, z = 8.4 + i * 3.2;
    if ((i === 2 && j === 1) || (i === 4 && j === 2)) continue;
    c.crumble([x - 1.5, -0.5, z], [x + 1.5, 0, z + 3.0], { delay: 0.55, back: 4 });
  }
  island(c, [-2, -6, 15], [2, 0, 18.6], F2, 0x3a3644);
  floor(c, -8, 8, 28, 36, 0, F2);
  goo(c, -8, 8, 8, 28, -6);
  c.spawnAt([0, 0, -2], 0);
  c.say([-8, -4], [8, 4], SAY.l12_story);
  c.tip([-8, -4], [8, 8.4], 'The floor ahead is <b>rotten</b>. Cracked tiles <b>crumble</b> a moment after you land. Keep moving!');
  c.shardLine([0, 0.2, 9.5], [0, 0.2, 26.5], 6);
  c.checkpoint([0, 0, 31], 0);
  // ---- B: updraft fans up to the balconies
  floor(c, -8, 8, 36, 60, 0, F);
  c.fan([-4, 0, 40], { r: 1.6, h: 11, lift: 10 });
  c.box([-8, 0, 44], [8, 6, 48], F2);
  for (let k = 0; k < 4; k++) c.crumble([-6 + k * 3.2 - 1.5, 5.5, 48], [-6 + k * 3.2 + 1.5, 6, 51], { delay: 0.6, back: 4 });
  c.fan([4, 6, 54], { r: 1.6, h: 9, lift: 10 });
  c.box([-8, 0, 56.5], [8, 12, 60], F2);
  c.box([-8, 0, 51], [8, 6, 56.5], F2);
  c.say([-8, 36], [8, 42], SAY.l12_fans);
  c.tip([-8, 36], [8, 44], 'An <b>updraft fan</b>! Step in, ride it up and steer onto the balcony.', { maxY: 2 });
  c.tip([-8, 44], [8, 56], 'Another fan, up past the cracked boards. Don\'t stand still!', { minY: 5 });
  c.shardLine([-4, 2, 40], [-4, 7, 40], 4);
  c.shardLine([4, 8, 54], [4, 13, 54], 4);
  c.checkpoint([0, 6, 46.5], 0);
  c.checkpoint([0, 12, 58], 0);
  // a swatch on a chandelier platform, high above the first fan (the updraft reaches it)
  c.box([-7.8, 9.5, 41.6], [-5.8, 10, 43.8], { mat: 'grate', color: 0x8a7a5a });
  c.swatchAt([-6.8, 11.3, 42.7]);
  chandelier(c, [-6.8, 10.1, 42.7], 0xffe0b0, { light: false, hang: 6 });
  // ---- C: the Warden hall (arena)
  floor(c, -13, 13, 60, 92, 12, F, { thick: 4 });
  walls(c, -13, 13, 60, 92, 8, 12, { s: [[-8, 8]], n: [[-2.5, 2.5]] }, WL);
  c.door('l12in', [-8, 12, 60.2], [8, 16, 60.8], { dir: 'down', open: true });
  c.door('l12out', [-2.5, 12, 92], [2.5, 16, 92.6], { dir: 'up' });
  c.box([-2.5, 16, 92], [2.5, 20, 93], WL);
  for (const [x, z] of [[-6, 70], [6, 70], [-6, 82], [6, 82], [0, 76]]) pillar(c, x, z, 12, 5, 1.6);
  c.checkpoint([0, 12, 62.5], 0);
  c.arena('wardens', [-12, 11, 64], [12, 18, 90], {
    name: 'Warden Hall', doors: ['l12in', 'l12out'], shards: 12,
    waves: [
      [{ kind: 'warden', pos: [0, 12, 86], yaw: Math.PI }, { kind: 'smudge', pos: [-8, 12, 78] }, { kind: 'smudge', pos: [8, 12, 78] }],
      [{ kind: 'warden', pos: [-7, 12, 87], yaw: Math.PI }, { kind: 'warden', pos: [7, 12, 87], yaw: Math.PI }, { kind: 'gooper', pos: [0, 12, 70] }],
    ],
  });
  c.say([-13, 60], [13, 66], SAY.l12_warden, { minY: 11 });
  c.tip([-13, 64], [13, 90], 'A <b>Warden</b> blocks shots from the front. <b>Circle around</b> it (swim!) or lob a <b>bomb</b> over the shield.', { minY: 11 });
  // swatch in a Warden hall niche, up a painted pillar
  pillar(c, 11, 90, 12, 4.5, 2);
  c.swatchAt([11, 17.8, 90]);
  portraits(c, [[-12.9, 15, 68, Math.PI / 2], [-12.9, 15, 84, Math.PI / 2], [12.9, 15, 68, -Math.PI / 2], [12.9, 15, 80, -Math.PI / 2]]);
  // ---- D: the collapsed atrium: crumbling bridge, a fan, a Glint, the core up top
  walls(c, -10, 10, 93, 140, -6, 32, { s: [[-2.5, 2.5]] }, WL);
  floor(c, -10, 10, 93, 98, 12, F2);
  for (let i = 0; i < 6; i++) c.crumble([-1.5, 11.5, 98.2 + i * 3.2], [1.5, 12, 101.2 + i * 3.2], { delay: 0.5, back: 3.5 });
  goo(c, -10, 10, 98, 140, -4);
  floor(c, -10, 10, 117.6, 124, 12, F2);
  c.fan([0, 12, 121.8], { r: 1.6, h: 10, lift: 10.5 });
  c.box([-10, 12, 124], [10, 20, 140], F2);
  c.enemy('glint', [6, 20, 136], { yaw: Math.PI });
  c.enemy('warden', [-4, 20, 132], { yaw: Math.PI });
  c.coreAt([0, 20, 134]);
  c.checkpoint([0, 12, 95], 0);
  c.checkpoint([-5, 12, 120], 0);
  c.shardLine([0, 12.2, 99], [0, 12.2, 116], 5);
  c.shardRing([0, 20.1, 134], 3, 6);
  // hidden: a ledge under the crumbling bridge with a fan back up
  island(c, [4, -6, 104], [8, 6, 110], F2, 0x3a3644);
  c.swatchAt([6, 7.3, 107]);
  c.fan([6, 6, 108.4], { r: 1.3, h: 7, lift: 9 });
  c.shard([5, 6.1, 105], true);
  c.tip([-10, 93], [10, 98], 'Rotten boards all the way across. A brave rookie might spot something <b>below</b>…', { minY: 11 });
  // decor
  chandelier(c, [0, 7.5, 18], 0xffd6a0, { intensity: 18, dist: 16 });
  chandelier(c, [0, 21, 76], 0xffd6a0, { intensity: 22, dist: 20 });
  chandelier(c, [0, 28, 130], 0xffd6a0, { intensity: 20, dist: 18 });
  portraits(c, [[-7.9, 4, 30, Math.PI / 2], [7.9, 4, 34, -Math.PI / 2], [-7.9, 9, 52, Math.PI / 2], [7.9, 14, 58, -Math.PI / 2], [-9.9, 18, 110, Math.PI / 2], [9.9, 18, 120, -Math.PI / 2]]);
  bust(c, [-6.5, 0, 33], 0.5); bust(c, [6.5, 0, 33], -0.5);
  c.box([-6.9, 0, 32.6], [-6.1, 1.9, 33.4], { render: false, paintable: false }); c.box([6.1, 0, 32.6], [6.9, 1.9, 33.4], { render: false, paintable: false });
  sign(c, 'THE GRISAILLE COLLECTION', [0, 5.5, -3.9], 7, 1.1, 0, { accent: '#ff8fab', bg: '#141018' });
  for (const [x, y, z, r] of [[3, 0.02, 2, 1.3], [-3, 0.02, 32, 1.2], [5, 12.02, 74, 1.4], [-5, 12.02, 86, 1.4], [4, 20.02, 128, 1.4]]) c.gooAt([x, y, z], r);
  // signposting: glowing floor arrows along the main route
  c.arrow([0, 0, 5], 0, { s: 1.2 });
  c.arrow([-4, 0, 37.2], 0, { s: 1.2 });
  c.arrow([4, 6, 52.2], 0, { s: 1.2 });
  c.arrow([0, 12, 95.5], 0, { s: 1.2 });
  c.level.killY = -5;
}

// ============================================================== L13: Chroma Locks
export function buildL13(c) {
  // ---- A: the first membrane
  floor(c, -6, 6, -4, 30, 0, MARBLE);
  walls(c, -6, 6, -4, 30, 0, 9, { n: [[-6, 6]], e: [[16, 20]] }, WL);
  c.box([6, 4, 16], [7, 9, 20], WL);
  c.membrane([-6, 0, 12], [6, 9, 12.6]);
  c.inkLane([0, 0.03, 8], [0, 0.03, 16], 1.6, 0.9);
  c.membrane([-6, 0, 22], [6, 9, 22.6]);
  c.spawnAt([0, 0, -2], 0);
  c.say([-6, 2], [6, 10], SAY.l13_membrane);
  c.tip([-6, -4], [6, 12], 'A shimmering <b>chroma membrane</b>: solid to walkers, but <b>dive</b> into your ink (hold SHIFT) and swim right through!');
  c.tip([-6, 13], [6, 22], 'Paint the floor first, then dive and swim through the next one.');
  c.shardLine([0, 0.1, 2], [0, 0.1, 10], 4);
  c.shardLine([0, 0.1, 15], [0, 0.1, 20], 3);
  c.checkpoint([0, 0, 26], 0);
  // a swatch behind a membrane in a side closet
  c.box([6, -1, 16], [10, 0, 20], MARBLE);
  walls(c, 6, 10, 16, 20, 0, 4, { w: [[16, 20]] }, WL);
  c.box([6, 4, 16], [10, 4.6, 20], WL);
  c.membrane([5.8, 0, 16], [6.2, 4, 20]);
  c.swatchAt([8.5, 1.3, 18]);
  // ---- B: the rotating vault: platforms orbit a pillar over a pit
  walls(c, -14, 14, 30, 62, -8, 24, { s: [[-6, 6]], n: [[-3, 3]] }, WL);
  floor(c, -14, 14, 30, 34, 0, F2);
  goo(c, -14, 14, 34, 58, -6);
  pillar(c, 0, 46, -8, 9, 3, BLACKM);
  for (const ph of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
    const cx = Math.cos(ph) * 9, cz = 46 + Math.sin(ph) * 9;
    c.mover([cx - 1.5, -0.4, cz - 1.5], [cx + 1.5, 0, cz + 1.5], { orbit: { r: 9.0, w: 0.5 }, phase: ph, color: 0x9a8aa8 });
  }
  floor(c, -14, 14, 58, 62, 0, F2);
  // a marble plinth on the far ledge with a swatch on top (paint it, climb it)
  c.box([10, 0, 58.2], [13, 4.4, 61.2], MARBLE);
  c.swatchAt([11.5, 5.7, 59.7]);
  c.say([-14, 30], [14, 34], SAY.l13_spin);
  c.tip([-14, 30], [14, 34], '<b>Rotating platforms</b>! Hop on as one swings by, ride it round to the far side.');
  c.shard([5, 0.2, 60], true);
  c.checkpoint([0, 0, 60], 0);
  // ---- C: the timed lock: paint the switch, then race through before the door shuts
  floor(c, -10, 10, 62, 96, 0, MARBLE, { thick: 4 });
  walls(c, -10, 10, 62, 96, -4, 14, { s: [[-3, 3]], n: [[-2, 2]] }, WL);
  c.paintSwitch('l13t', [-10, 1.2, 66], [-9.6, 3.4, 69], 'px', { targets: ['l13door'], timed: 13, label: 'Lock open' });
  c.wall([-10, 0, 76], [-1.5, 10, 77], WL); c.wall([1.5, 0, 76], [10, 10, 77], WL);
  c.membrane([-1.5, 0, 76], [1.5, 10, 77]);
  c.box([-6, 0, 80], [6, 1.2, 82], ST);
  c.membrane([-10, 0, 86], [10, 10, 86.6]);
  c.box([-2, 4.5, 96], [2, 10, 97], WL);
  c.door('l13door', [-2, 0, 96], [2, 4.5, 97], { dir: 'up' });
  c.enemy('warden', [0, 0, 91], { yaw: Math.PI });
  c.enemy('smudge', [-5, 0, 72]);
  c.inkLane([0, 0.03, 70], [0, 0.03, 95], 1.3, 1.0);
  c.say([-10, 62], [10, 66], SAY.l13_timer);
  c.tip([-10, 62], [10, 70], 'Paint the <b>timed switch</b> to open the far door, then race through the membranes before it shuts! (Pre-paint your path!)');
  c.shardLine([0, 0.1, 78], [0, 0.1, 94], 5);
  c.checkpoint([0, 0, 64], 0);
  // ---- D: the vault (arena) and the core
  floor(c, -14, 14, 96, 132, 0, MARBLE, { thick: 4 });
  walls(c, -14, 14, 97, 132, -4, 14, { s: [[-2, 2]], w: [[112.4, 116.6]] }, WL);
  c.box([-15, 4, 112.4], [-14, 14, 116.6], WL);
  c.door('l13in', [-2, 0, 97.6], [2, 4, 98.2], { dir: 'down', open: true });
  for (const [x, z] of [[-7, 108], [7, 108], [-7, 120], [7, 120]]) pillar(c, x, z, 0, 6, 1.6, BLACKM);
  c.box([-4, 0, 126], [4, 1.5, 132], ST);
  c.checkpoint([0, 0, 101], 0);
  c.arena('vault', [-13, -1, 103], [13, 8, 125], {
    name: 'The Vault', doors: ['l13in'], shards: 12,
    waves: [
      [{ kind: 'warden', pos: [-6, 0, 116] }, { kind: 'pilfer', pos: [6, 0, 112] }, { kind: 'smudge', pos: [0, 0, 120] }],
      [{ kind: 'rumbler', pos: [0, 0, 122] }, { kind: 'glint', pos: [9, 0, 122], yaw: Math.PI }, { kind: 'splotch', size: 'M', pos: [-8, 0, 110] }],
    ],
  });
  c.coreAt([0, 1.5, 129], { need: ['arena:vault'] });
  c.shardRing([0, 1.6, 129], 3, 6);
  // swatch: a membrane in the vault floor's west wall hides a strongbox
  c.box([-18, -1, 112], [-14, 0, 117], MARBLE);
  walls(c, -18, -14, 112, 117, 0, 4, { e: [[112, 117]] }, WL);
  c.box([-18, 4, 112], [-14, 4.6, 117], WL);
  c.membrane([-14.2, 0, 112.4], [-13.8, 4, 116.6]);
  c.swatchAt([-16, 1.3, 114.5]);
  c.shard([-17, 0.2, 113], true); c.shard([-17, 0.2, 116], true);
  // decor
  chandelier(c, [0, 8, 14], 0xf0e0ff, { intensity: 16, dist: 14 });
  chandelier(c, [0, 18, 46], 0xe0d0ff, { intensity: 22, dist: 22 });
  chandelier(c, [0, 11, 116], 0xf0e0ff, { light: false });
  portraits(c, [[-5.9, 3.5, 5, Math.PI / 2], [5.9, 3.5, 8, -Math.PI / 2], [-9.9, 4, 72, Math.PI / 2], [9.9, 4, 90, -Math.PI / 2], [-13.9, 5, 106, Math.PI / 2], [13.9, 5, 106, -Math.PI / 2]]);
  carpet(c, -1.5, 1.5, -4, 30, 0, 0x2a2040);
  sign(c, 'VAULT LEVEL · LOCKED BY ORDER OF THE BARON', [0, 6, -3.9], 8, 1.1, 0, { accent: '#7c5cff', bg: '#141018' });
  for (const [x, z, r] of [[-3, 4, 1.2], [4, 70, 1.3], [-5, 110, 1.5], [6, 118, 1.4]]) c.gooAt([x, 0.02, z], r);
  // signposting: glowing floor arrows along the main route
  c.arrow([0, 0, 8.5], 0, { s: 1.2 });
  c.arrow([0, 0, 32], 0, { s: 1.2 });
  c.arrow([-6, 0, 67.5], -1.5707963, { s: 1.2 });
  c.arrow([0, 0, 101.5], 0, { s: 1.2 });
  c.level.killY = -5;
}

// ============================================================== L14: The Grand Ascent
export function buildL14(c) {
  // ---- A: the tower gate: an ink rail over the moat, a Gooper ambush
  floor(c, -8, 8, -4, 10, 0, F);
  walls(c, -8, 8, -4, 10, 0, 9, { n: [[-8, 8]] }, WL);
  c.spawnAt([0, 0, -2], 0);
  island(c, [-8, -4, 10], [8, 0, 14], F2, 0x3a3644);
  c.rail([[0, 1.6, 13.2], [0, 2.6, 24], [0, 1.7, 37.5]], { speed: 10 });
  goo(c, -12, 12, 14, 36, -6);
  floor(c, -12, 12, 36, 52, 0, MARBLE, { thick: 4 });
  walls(c, -12, 12, 36, 52, -4, 10, { s: [[-8, 8]], n: [[-4, 4]] }, WL);
  c.enemy('gooper', [-6, 0, 46]); c.enemy('gooper', [6, 0, 46]); c.enemy('warden', [0, 0, 49], { yaw: Math.PI });
  c.tip([-8, -4], [8, 10], 'The <b>Grand Ascent</b>. Everything you\'ve learned, all the way to the top.');
  c.shardLine([0, 1.2, 16], [0, 1.6, 33], 6);
  c.checkpoint([0, 0, 38.5], 0);
  // ---- B: the tower shaft: the gray floods up behind you
  walls(c, -10, 10, 52, 76, -4, 52, { s: [[-4, 4]], n: [[-3, 3]] }, WL);
  c.box([-3, -4, 76], [3, 36, 77], WL);
  floor(c, -10, 10, 52, 76, 0, F, { thick: 4 });
  c.flood({ y0: -1, ymax: 40, rate: 0.28, min: [-10, 52], max: [10, 76], drains: [], start: [[-8, -1, 54], [8, 4, 60]] });
  c.say([-10, 52], [10, 58], SAY.l14_flood);
  const GR = { mat: 'grate', color: 0xa8a4b0 };
  // ledge 1: a lift
  c.mover([-9, -0.25, 66], [-5, 0.15, 70], { trigger: 'ride', path: [[0, 0, 0], [0, 6.85, 0]], speed: 2.6 });
  c.box([-10, 4, 70.5], [-2, 7, 76], F2);
  // ledge 2: crumbling boards to a fan
  for (let k = 0; k < 3; k++) c.crumble([-2 + k * 3.0, 6.5, 71], [0.8 + k * 3.0, 7, 75], { delay: 0.6, back: 4 });
  c.box([6, 4, 64.5], [10, 7, 76], F2);
  c.fan([8, 7, 66.5], { r: 1.5, h: 9, lift: 10 });
  c.box([2, 12, 58], [10, 14, 63.4], F2);
  // ledge 3: a sponge step and a climbable brick wall
  c.sponge([2, 14, 58.2], [4.5, 16.5, 61]);
  c.box([-10, 14, 58], [2, 16.5, 62], F2);
  c.box([-10, 0, 62], [-4, 24, 66], { mat: 'brick', color: 0x9e9aa6 });
  // ledge 4: a moving platform across to the top ledge
  c.mover([-3.5, 23.6, 62], [-0.5, 24, 65], { path: [[0, 0, 0], [0, 8, 6.5]], speed: 2.2, wait: 1.2 });
  c.box([-8, 30, 70], [8, 32, 76], F2);
  c.ramp([-3, 32, 70], [3, 36, 73], '+z', GR);
  c.box([-3, 32, 73], [3, 36, 76], F2);
  c.checkpoint([-6, 7, 73], 0);
  c.checkpoint([6, 14, 60.5], 0);
  c.checkpoint([-7, 24, 64], 0);
  c.checkpoint([0, 36, 74.5], 0);
  c.tip([-10, 62], [-2, 72], 'Ride the <b>lift</b> up, and don\'t look down!', { maxY: 3 });
  c.tip([-10, 70], [10, 76], 'Over the cracked boards, into the <b>updraft</b>!', { minY: 6, maxY: 9 });
  c.tip([-10, 56], [10, 63.4], 'Grow the <b>sponge</b>, then paint the brick wall and <b>climb</b>!', { minY: 13, maxY: 18 });
  c.shardLine([-8, 7.1, 72], [-3, 7.1, 72], 3);
  c.shardLine([3, 14.1, 59.5], [9, 14.1, 59.5], 3);
  c.shardLine([-9, 24.1, 63], [-5, 24.1, 65], 3);
  c.shard([9, 14.2, 62.6], true);
  // a swatch on a perch beside the fan's column
  c.box([6.2, 15.2, 69], [10, 15.6, 71.5], GR);
  c.swatchAt([8.1, 16.9, 70.25]);
  // ---- C: the mid-tower hall (arena)
  floor(c, -13, 13, 77, 104, 36, MARBLE, { thick: 4 });
  walls(c, -13, 13, 77, 104, 32, 12, { s: [[-3, 3]], n: [[-2.5, 2.5]], e: [[90, 92]] }, WL);
  c.door('l14in', [-3, 36, 77.2], [3, 40, 77.8], { dir: 'down', open: true });
  c.door('l14out', [-2.5, 36, 104], [2.5, 40, 104.6], { dir: 'up' });
  c.box([-2.5, 40, 104], [2.5, 44, 105], WL);
  for (const [x, z] of [[-6, 86], [6, 86], [-6, 96], [6, 96]]) pillar(c, x, z, 36, 5, 1.6, BLACKM);
  c.checkpoint([0, 36, 79.5], 0);
  c.arena('mid', [-12, 35, 81], [12, 44, 102], {
    name: 'Mid-Tower Hall', doors: ['l14in', 'l14out'], shards: 14,
    waves: [
      [{ kind: 'warden', pos: [0, 36, 99], yaw: Math.PI }, { kind: 'glint', pos: [-10, 36, 101], yaw: Math.PI }, { kind: 'smudge', pos: [6, 36, 92] }],
      [{ kind: 'rumbler', pos: [0, 36, 100] }, { kind: 'pilfer', pos: [-8, 36, 88] }, { kind: 'splotch', size: 'L', pos: [8, 36, 96] }],
      [{ kind: 'warden', pos: [-6, 36, 100], yaw: Math.PI }, { kind: 'warden', pos: [6, 36, 100], yaw: Math.PI }, { kind: 'gooper', pos: [0, 36, 90] }, { kind: 'glint', pos: [10, 36, 101], yaw: Math.PI }],
    ],
  });
  // ---- D: the last stretch: membrane, timed lock, rail to the throne-room door
  floor(c, -8, 8, 105, 124, 36, F, { thick: 4 });
  walls(c, -8, 8, 105, 124, 32, 12, { s: [[-2.5, 2.5]], n: [[-8, 8]] }, WL);
  c.membrane([-8, 36, 110], [8, 44, 110.6]);
  c.inkLane([0, 36.03, 106], [0, 36.03, 122], 1.3, 1.0);
  c.paintSwitch('l14t', [7.6, 37.4, 113], [8, 39.6, 116], 'nx', { targets: ['l14door'], timed: 9, label: 'Throne lock open' });
  c.wall([-8, 36, 120], [-1.5, 44, 121], WL); c.wall([1.5, 36, 120], [8, 44, 121], WL);
  c.door('l14door', [-1.5, 36, 120], [1.5, 40, 121], { dir: 'up' });
  c.box([-1.5, 40, 120], [1.5, 44, 121], WL);
  island(c, [-6, 30, 124], [6, 36, 128], F2, 0x3a3644);
  c.rail([[0, 37.6, 127.4], [0, 39, 140], [0, 38.2, 152.4]], { speed: 10 });
  goo(c, -14, 14, 128, 152, 28);
  island(c, [-8, 30, 152], [8, 36.5, 164], MARBLE, 0x3a3644);
  c.coreAt([0, 36.5, 160]);
  c.say([-8, 152], [8, 158], SAY.l14_top, { minY: 35 });
  c.checkpoint([0, 36, 107], 0);
  c.checkpoint([0, 36, 125.5], 0);
  c.tip([-8, 105], [8, 112], 'Membrane, then a <b>timed lock</b>. Swim through, hit the switch, sprint for the door!', { minY: 35 });
  c.shardLine([0, 37.4, 130], [0, 38.6, 150], 6);
  c.shardRing([0, 36.6, 160], 3, 6);
  // hidden: an alcove behind the mid-tower hall, through a vent
  c.box([13, 36.75, 90], [14, 48, 92], { mat: 'grate', color: 0x5a5662 });
  floor(c, 14, 18, 87, 95, 36, F2);
  walls(c, 14, 18, 87, 95, 36, 4, { w: [[87, 95]] }, WL);
  c.box([14, 40, 87], [18, 40.6, 95], WL);
  c.swatchAt([16, 37.3, 91]);
  c.shard([17, 36.2, 88.5], true); c.shard([17, 36.2, 93.5], true);
  // and a swatch for brave rail riders: a ledge below the final rail
  island(c, [4, 26, 138], [8, 32.4, 142], F2, 0x3a3644);
  c.swatchAt([6, 33.7, 140]);
  c.pad([6, 32.4, 141.4], [0, 36.5, 156], 3);
  // decor
  chandelier(c, [0, 47, 64], 0xffd6a0, { intensity: 22, dist: 26, hang: 4 });
  chandelier(c, [0, 45, 90], 0xffd6a0, { intensity: 20, dist: 20 });
  chandelier(c, [0, 44, 160], 0xfff0c0, { light: false });
  portraits(c, [[-11.9, 4, 44, Math.PI / 2], [11.9, 4, 44, -Math.PI / 2], [-9.9, 20, 66, Math.PI / 2], [9.9, 30, 58, -Math.PI / 2], [-12.9, 40, 92, Math.PI / 2]]);
  carpet(c, -1.5, 1.5, 36, 52, 0, 0x5a2a36);
  sign(c, 'THE GRAND ASCENT', [0, 6, -3.9], 6, 1.1, 0, { accent: '#ff5d3d', bg: '#141018' });
  for (const [x, y, z, r] of [[-4, 0.02, 40, 1.4], [3, 36.02, 84, 1.5], [-5, 36.02, 96, 1.4]]) c.gooAt([x, y, z], r);
  // signposting: glowing floor arrows along the main route
  c.arrow([0, 0, 8], 0, { s: 1.2 });
  c.arrow([-7, 0, 63], 0, { s: 1.2 });
  c.arrow([0, 36, 107.5], 0, { s: 1.2 });
  c.level.killY = -5;
}

// ============================================================== L15: Baron Grisaille (final boss)
export function buildL15(c) {
  // entry hall
  floor(c, -4, 4, -34, -21, 0, F);
  walls(c, -4, 4, -34, -21, 0, 9, { n: [[-4, 4]] }, WL);
  c.spawnAt([0, 0, -31.5], 0);
  c.checkpoint([0, 0, -29], 0);
  c.box([2.6, 0, -28], [4, 3.6, -25], ST);
  c.swatchAt([3.3, 4.9, -26.5]);
  c.shardLine([-2, 0.1, -32], [-2, 0.1, -24], 5);
  c.shard([3.3, 3.7, -27.4], true);
  carpet(c, -1.4, 1.4, -34, -21, 0, 0x5a2a36);
  portraits(c, [[-3.9, 3.5, -27, Math.PI / 2, 1.2], [3.9, 3.5, -24, -Math.PI / 2, 1.2]]);
  c.door('baronDoor', [-4, 0, -21.6], [4, 6, -21], { dir: 'up', open: true });
  c.box([-4, 6, -21.6], [4, 14, -21], WL);
  // the throne room
  floor(c, -20, 20, -20, 20, 0, MARBLE, { thick: 3 });
  walls(c, -20, 20, -20, 20, -3, 16, { s: [[-4, 4]] }, WL);
  // easels (phase 1): paint all three to break the Baron's shield
  const easel = (id, min, max, face, lx, lz) => {
    c.paintSwitch(id, min, max, face, { disabled: true });
    const g = new THREE.Group(); g.position.set(lx, 0, lz); c.decor.add(g);
    const wood = c.mat('easelWood', () => std(0x6b4a32, 0.8));
    for (const [a, b] of [[-0.7, 0.4], [0.7, 0.4], [0, -0.6]]) rod(g, [a, 0, b], [0, 3.2, 0], 0.06, wood, { seg: 6 });
  };
  easel('e1', [-1.1, 0.8, 13], [1.1, 3.0, 13.4], 'nz', 0, 13.8);
  easel('e2', [-13.4, 0.8, -5.1], [-13, 3.0, -2.9], 'px', -13.8, -4);
  easel('e3', [13, 0.8, -5.1], [13.4, 3.0, -2.9], 'nx', 13.8, -4);
  // drains (phase 3)
  c.drain('d1', [-1.2, 0.6, 19.6], [1.2, 2.6, 20], 'nz', { disabled: true });
  c.drain('d2', [-20, 0.6, 5], [-19.6, 2.6, 7.4], 'px', { disabled: true });
  c.drain('d3', [19.6, 0.6, 5], [20, 2.6, 7.4], 'nx', { disabled: true });
  // plinths to stand on when the gray floods in, and pillars at the corners
  for (const [x, z] of [[-11, -12], [11, -12], [-11, 10], [11, 10]]) c.box([x - 1.6, 0, z - 1.6], [x + 1.6, 1.2, z + 1.6], ST);
  for (const [x, z] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) pillar(c, x, z, 0, 4.2, 2.2, BLACKM);
  c.zone([-20, -1, -19], [20, 12, 20], 'arena');
  // decor: the empty throne, curtains, chandeliers, portraits everywhere
  // (the throne itself belongs to the boss: it flies in phase 2)
  part(c.decor, new THREE.CylinderGeometry(2.4, 2.6, 0.3, 24), c.mat('dais', () => std(0x3b3745, 0.6, 0.3)), { pos: [0, 0.15, 18.2], shadow: false, receive: true });
  curtain(c, [-6, 8, 19.8], 5, 10, Math.PI, 0x3a3644); curtain(c, [6, 8, 19.8], 5, 10, Math.PI, 0x3a3644);
  chandelier(c, [-8, 12.5, 0], 0xf0e8ff, { intensity: 26, dist: 26, hang: 3 });
  chandelier(c, [8, 12.5, 0], 0xf0e8ff, { intensity: 26, dist: 26, hang: 3 });
  portraits(c, [[-19.9, 6, -10, Math.PI / 2, 1.6], [-19.9, 6, 12, Math.PI / 2, 1.6], [19.9, 6, -10, -Math.PI / 2, 1.6], [19.9, 6, 12, -Math.PI / 2, 1.6], [-10, 7, 19.9, Math.PI, 1.8], [10, 7, 19.9, Math.PI, 1.8]]);
  for (const [x, z] of [[-6, -18.5], [6, -18.5]]) bust(c, [x, 0, z], 0);
  sign(c, 'THE THRONE ROOM', [0, 6.2, -33.9], 5, 1, 0, { accent: '#ffffff', bg: '#141018' });
  for (const [x, z, r] of [[-6, 4, 1.6], [7, -6, 1.6], [3, 12, 1.4], [-8, -10, 1.4]]) c.gooAt([x, 0.02, z], r);
  c.level.killY = -5;
}
