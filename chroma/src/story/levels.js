// The Underside: hub cavern + five story levels, built from Level boxes/ramps.
// Coordinates: +z is "forward" along each course; floors sit at y = 0 unless noted.
import * as THREE from 'three';
import { signTexture } from '../world/textures.js';
import { rng } from '../util.js';
import { canvasTexture, HFONT, BFONT, std, part, rod } from './kit.js';

export const ORDER = ['l1', 'l2', 'l3', 'l4', 'l5'];
export const INFO = {
  l1: { id: 'l1', num: 1, name: 'First Splash', core: 'Rose Core', color: '#ff3d7f', swatch: 'Bubblegum Dawn', swatchColors: ['#ffc2d9', '#ff6fa5', '#d81b60'] },
  l2: { id: 'l2', num: 2, name: 'Ghost Walk', core: 'Tide Core', color: '#22d3ee', swatch: 'Phantom Teal', swatchColors: ['#b2f5ff', '#38d6e8', '#0f8a9c'] },
  l3: { id: 'l3', num: 3, name: 'Turret Alley', core: 'Sun Core', color: '#ffc83d', swatch: 'Turret Tangerine', swatchColors: ['#ffe0a3', '#ffa53d', '#e0601b'] },
  l4: { id: 'l4', num: 4, name: 'Drone Heights', core: 'Moss Core', color: '#5ee05a', swatch: 'Skyhigh Mint', swatchColors: ['#d4ffd1', '#7ff07a', '#2e9e3a'] },
  l5: { id: 'l5', num: 5, name: 'The Gray Engine', core: 'Prism Heart', color: '#b06bff', swatch: 'Baron\'s Bane', swatchColors: ['#ff5d5d', '#ffd21a', '#3cb4ff'] },
};
export const GRAY_INK = '#7d7a88';

const base = { cloud: 0x000000, cloudShade: 0x000000, clouds: 0 };
export const SKY = {
  hub: { ...base, zenith: 0x0c0a12, horizon: 0x3a2e42, ground: 0x1a1418, sun: 0xffd6a8, sunDir: [0.35, 1, 0.25], sunI: 2.6, hemiSky: 0xc0aed0, hemiGround: 0x5a4a48, hemiI: 1.5, fog: 0x1d1622, fogD: 0.018 },
  l1: { ...base, zenith: 0x0b080a, horizon: 0x3a2a26, ground: 0x140e0e, sun: 0xffcf9a, sunDir: [0.3, 1, -0.35], sunI: 2.8, hemiSky: 0xd8b8a8, hemiGround: 0x5a4438, hemiI: 1.4, fog: 0x2a2026, fogD: 0.015 },
  l2: { ...base, zenith: 0x050b10, horizon: 0x123540, ground: 0x061418, sun: 0xc8f2ff, sunDir: [0.25, 1, 0.45], sunI: 2.6, hemiSky: 0x9ad8e8, hemiGround: 0x2a4048, hemiI: 1.4, fog: 0x0f2a33, fogD: 0.02 },
  l3: { ...base, zenith: 0x0c0806, horizon: 0x40261a, ground: 0x140c08, sun: 0xffb878, sunDir: [-0.35, 1, 0.2], sunI: 2.8, hemiSky: 0xe0b498, hemiGround: 0x5a4030, hemiI: 1.35, fog: 0x2e1f19, fogD: 0.014 },
  l4: { ...base, zenith: 0x0b1220, horizon: 0x2e4058, ground: 0x0c121c, sun: 0xe4f0ff, sunDir: [0.18, 1, 0.12], sunI: 3.0, hemiSky: 0xb4cce8, hemiGround: 0x3a4258, hemiI: 1.4, fog: 0x1a2638, fogD: 0.013 },
  l5: { ...base, zenith: 0x0d0709, horizon: 0x40181a, ground: 0x120809, sun: 0xffc4a8, sunDir: [0.3, 1, -0.25], sunI: 2.6, hemiSky: 0xd8a8a0, hemiGround: 0x4a2a28, hemiI: 1.35, fog: 0x26110f, fogD: 0.014 },
};

const WALL = { mat: 'container', color: 0xa8989f };
const WOOD = { mat: 'wood', color: 0xd8b892 };
const sign = (c, text, p, w, h, yaw, o = {}) => c.sign(signTexture(text, { w: 1024, h: Math.round(1024 * h / w), size: o.size || 120, bg: '#1b1530', fg: o.fg || '#f4f1ea', accent: o.accent || '#8b8794', font: HFONT }), p, w, h, yaw);

// ============================================================== HUB
function buildHub(c, story) {
  const R = rng(11);
  c.box([-22, -1, -16], [22, 0, 18], { mat: 'concrete', color: 0xc9a684 });
  c.wall([-23, 0, -17], [23, 9, -16], WALL);
  c.wall([-23, 0, 18], [23, 9, 19], WALL);
  c.wall([-23, 0, -16], [-22, 9, 18], WALL);
  c.wall([22, 0, -16], [23, 9, 18], WALL);
  // a raised gantry along the right wall (paintable, climbable)
  c.box([18, 0, -6], [22, 2.4, 6], { mat: 'grate', color: 0xb8b0bc });
  c.ramp([18, 0, 6], [22, 2.4, 10], '-z', { mat: 'grate', color: 0xb8b0bc });
  // crates
  c.box([-20, 0, -13.5], [-17.5, 1.2, -11], WOOD);
  c.box([-19.6, 1.2, -13], [-17.9, 2.4, -11.3], WOOD);
  c.box([9.5, 0, 10.5], [11.5, 1.1, 12.5], WOOD);
  c.box([-11.5, 0, 12.5], [-9.5, 1.1, 14.5], WOOD);
  // pigment vats (decor + collision)
  c.vat([16.5, 0, 13.4], 2.6, 5.2, 0x8f6b55, null);
  c.box([14.2, 0, 11.1], [18.8, 5.2, 15.7], { render: false, paintable: false });
  c.vat([17.5, 0, -11.5], 2.2, 4.2, 0x6d6a76, null);
  c.box([15.5, 0, -13.5], [19.5, 4.2, -9.5], { render: false, paintable: false });
  // Captain Veil's corner
  c.veilAt([0, 0, 12.6], Math.PI);
  c.box([-0.45, 0, 12.15], [0.45, 1.6, 13.05], { render: false, paintable: false });
  c.box([-3.7, 0, 15.6], [3.7, 0.9, 16.8], { render: false, paintable: false });
  c.shelfAt = new THREE.Vector3(0, 0, 16.2);
  // hatches in an arc facing the middle of the room
  const spots = [[-14, 2], [-8.5, -7], [0, -10.5], [8.5, -7], [14, 2]];
  spots.forEach(([x, z], i) => c.hatch(`l${i + 1}`, [x, 0, z], Math.atan2(0 - x, 5 - z)));
  // the lift back up to the plaza
  c.exit([-18.4, 0, 14.4], Math.PI / 2);
  c.spawnAt([-12.2, 0, 13.6], 1.66);
  // goo puddles
  for (const [x, z, r] of [[10, 5, 2.1], [-8, -12.5, 1.6], [15.5, -2.5, 2.2], [-5.5, 8.5, 1.2], [4, -14, 1.4], [-19, 4, 1.8]]) c.gooAt([x, 0.02, z], r);
  // lamps (warm work lights)
  c.lamp([0, 6.4, 7], 0xffc070, { intensity: 30, dist: 20, hang: 6 });
  c.lamp([-12, 6.4, -3], 0xffb060, { intensity: 26, dist: 18, hang: 6 });
  c.lamp([12, 6.4, -3], 0xffb060, { intensity: 26, dist: 18, hang: 6 });
  c.lamp([-17, 5.5, 12], 0x9fe0ff, { intensity: 14, dist: 10, hang: 7 });
  // pipes and girders
  c.pipe([[-22, 7.2, 17.4], [22, 7.2, 17.4]], 0.32, 0x8a8494);
  c.pipe([[-22, 6.2, 17.0], [-10, 6.2, 17.0], [-10, 0, 17.0]], 0.22, 0x9a7a62);
  c.pipe([[22, 6.2, 17.0], [10, 6.2, 17.0], [10, 0, 17.0]], 0.22, 0x9a7a62);
  c.pipe([[21.4, 8, -15], [21.4, 8, 10], [16.5, 8, 13.4], [16.5, 5.2, 13.4]], 0.3, 0x77727f);
  c.pipe([[-21.4, 4.5, -15], [-21.4, 4.5, 8]], 0.26, 0x77727f);
  for (let x = -18; x <= 18; x += 6) c.girder([x, 10.5, -16], [x, 10.5, 18]);
  c.girder([-22, 10.2, 2], [22, 10.2, 2]);
  for (let i = 0; i < 7; i++) c.chain([R.range(-18, 18), 10.4, R.range(-12, 14)], R.range(2, 5));
  // signage
  sign(c, '▲ PRISM PLAZA', [-18.4, 4.2, 16.8], 3.4, 0.85, Math.PI, { accent: '#7dff7a' });
  sign(c, 'CHROMATIC PAINT WORKS', [0, 7.6, -15.9], 9, 1.3, 0, { accent: '#ffc83d' });
  // the Chroma Guard mission board behind Veil
  const board = canvasTexture(1024, 512, (ctx, w, h) => drawBoard(ctx, w, h, story));
  c.sign(board, [0, 3.7, 17.92], 7.2, 3.6, Math.PI);
  part(c.decor, new THREE.BoxGeometry(7.6, 4, 0.06), std(0x2b2833, 0.6, 0.4), { pos: [0, 3.7, 17.97], shadow: false });
}

function drawBoard(ctx, w, h, story) {
  const cleared = story.progress.cleared;
  ctx.fillStyle = '#1e2a24'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#6b4a32'; ctx.lineWidth = 24; ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.fillStyle = '#f4f1ea'; ctx.font = `46px ${HFONT}`; ctx.textAlign = 'center';
  ctx.fillText('CHROMA GUARD · OPERATION UNDERSIDE', w / 2, 88, w - 80);
  const pts = ORDER.map((id, i) => [140 + i * 186, 270 + (i % 2 ? 70 : -30)]);
  ctx.setLineDash([16, 14]); ctx.strokeStyle = 'rgba(244,241,234,.55)'; ctx.lineWidth = 6;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.setLineDash([]);
  ORDER.forEach((id, i) => {
    const [x, y] = pts[i];
    const done = cleared.includes(id);
    ctx.fillStyle = done ? INFO[id].color : '#3a3742';
    ctx.beginPath(); ctx.arc(x, y, 50, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = '#f4f1ea'; ctx.stroke();
    ctx.fillStyle = done ? '#1b1530' : '#f4f1ea'; ctx.font = `60px ${HFONT}`;
    ctx.fillText(String(i + 1), x, y + 21);
    ctx.font = `800 26px ${BFONT}`; ctx.fillStyle = '#f4f1ea';
    ctx.fillText(INFO[id].name.toUpperCase(), x, y + 92);
    if (!done) { ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 28, y - 28); ctx.lineTo(x + 28, y + 28); ctx.stroke(); }
  });
  ctx.font = `800 28px ${BFONT}`; ctx.fillStyle = '#ffd21a';
  ctx.fillText(`${cleared.length} / 5 HUE CORES RECOVERED`, w / 2, h - 40);
}

// ============================================================== L1: First Splash (tutorial)
function buildL1(c) {
  const floor = { mat: 'concrete', color: 0xd9b48c };
  c.box([-7, -1, -5], [7, 0, 24], floor);
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
  // arena
  c.box([-10, -3, 47], [10, 3.2, 70], floor);
  c.wall([-11, -3, 47], [-10, 10, 71], WALL);
  c.wall([10, -3, 47], [11, 10, 71], WALL);
  c.wall([-11, 3.2, 70], [11, 10, 71], WALL);
  c.box([-5, 3.2, 55], [-3.4, 4.5, 56.6], WOOD);
  c.box([3.6, 3.2, 58], [5.2, 4.5, 59.6], WOOD);
  c.box([-2.4, 3.2, 64.3], [2.4, 3.55, 68.7], { mat: 'grate', color: 0xc0b8c4 });
  c.spawnAt([0, 0, -2.2], 0);
  c.gooAt([-3, 0.02, 7], 1.6); c.gooAt([3.4, 0.02, 8.6], 1.3); c.gooAt([0.5, 3.22, 60], 2.0); c.gooAt([-6, 3.22, 52], 1.4);
  c.inkLane([0, 0.05, 11], [0, 0.05, 22.5], 1.5);
  c.checkpoint([0, 3.2, 27.5], 0);
  c.checkpoint([0, 3.2, 51.5], 0);
  c.pad([0, 3.2, 34.5], [0, 3.2, 51], 4);
  c.swatchAt([-5.7, 4.5, 17]);
  c.enemy('smudge', [-3, 3.2, 61.5], { group: 'gate' });
  c.enemy('smudge', [3, 3.2, 63], { group: 'gate' });
  c.coreAt([0, 3.55, 66.5], { gate: 'gate' });
  c.tip([-7, -5], [7, 5.5], '<b>WASD</b> move · <b>Mouse</b> aim · <b>LMB</b> paint · <b>SPACE</b> jump. Try painting the floor!');
  c.tip([-7, 5.5], [7, 10.5], 'Gray goo is <b>Drab ink</b>: it slows you down and wears you out. Paint over it!');
  c.tip([-7, 10.5], [7, 20.5], 'Hold <b>SHIFT</b> in your own ink to <b>swim</b>. It\'s fast, and it <b>refills your ink</b>!');
  c.tip([-7, 20.5], [7, 24.2], 'Paint the wall, then swim into it (<b>SHIFT + W</b>) to <b>climb</b> it!', { maxY: 2 });
  c.tip([-7, 29], [7, 38], 'Step on the <b>jump pad</b> to launch across the pit!', { minY: 2.5 });
  c.tip([-10, 49], [10, 60], 'Splash the <b>Smudges</b> to break the seal on the <b>Hue Core</b>!', { minY: 2.5 });
  // decor
  c.lamp([0, 6.2, 3], 0xffc070, { intensity: 24, dist: 18 });
  c.lamp([0, 6.2, 17], 0xffc070, { intensity: 24, dist: 18 });
  c.lamp([0, 9.2, 31], 0xffb060, { intensity: 24, dist: 18 });
  c.lamp([0, 9.5, 58], 0xffc070, { intensity: 34, dist: 24 });
  c.pipe([[-6.6, 6.5, -5], [-6.6, 6.5, 38]], 0.26, 0x9a7a62);
  c.pipe([[6.6, 5.5, -5], [6.6, 5.5, 20], [6.6, 0, 20]], 0.22, 0x77727f);
  c.pipe([[-9.6, 8.5, 47], [-9.6, 8.5, 70], [9.6, 8.5, 70], [9.6, 8.5, 47]], 0.3, 0x8a8494);
  // gray goo pool down in the pit
  const pool = part(c.decor, new THREE.PlaneGeometry(16, 10), new THREE.MeshPhysicalMaterial({ color: 0x7d7a88, roughness: 0.2, clearcoat: 1 }), { pos: [0, -3.2, 42.5], rot: [-Math.PI / 2, 0, 0], shadow: false, receive: true });
  pool.name = 'pool';
  sign(c, 'MIXING FLOOR · B1', [0, 5.6, -4.9], 6, 1.1, 0, { accent: '#ff3d7f' });
  c.level.killY = -2.8;
}

// ============================================================== L2: Ghost Walk
function buildL2(c) {
  const isl = { mat: 'concrete', color: 0xb8a48e, bottom: true };
  const island = (min, max) => {
    c.box(min, max, isl);
    c.column((min[0] + max[0]) / 2, (min[2] + max[2]) / 2, (max[0] - min[0]) * 0.55, (max[2] - min[2]) * 0.55, min[1] + 0.01, -70);
  };
  island([-5, -3, -6], [5, 0, 4]);
  c.ghost([-1.5, -0.6, 4], [1.5, 0, 12]);
  c.ghost([-1.5, -0.6, 12], [9, 0, 15]);
  c.ghost([6, -0.6, 15], [9, 0, 23]);
  island([3, -3, 23], [12, 0, 31]);
  // hidden branch to the swatch
  c.ghost([12, -0.6, 26.5], [17, 0, 28.5]);
  c.ghost([17, -0.6, 24.5], [21, 0, 30.5]);
  c.swatchAt([19, 1.3, 27.5]);
  // stepping stones with gaps
  for (const x0 of [-1.0, -5.2, -9.4, -13.6]) c.ghost([x0, -0.6, 26], [x0 + 2.6, 0, 29]);
  island([-24, -3, 23], [-15, 0, 32]);
  c.pad([-21.5, 0, 30], [-19.5, 3, 43.5], 3.5);
  island([-24, -3, 40], [-15, 3, 48]);
  c.ghost([-15, 2.4, 43], [-9, 3, 45.5]);
  c.ghost([-7.4, 2.4, 43], [-1, 3, 45.5]);
  c.ghost([-3.5, 2.4, 45.5], [-1, 3, 52]);
  island([-6, -3, 52], [4, 3, 62]);
  c.spawnAt([0, 0, -3], 0);
  c.inkLane([0, 0.02, 3.2], [0, 0.02, 6.2], 1.3, 0.8);
  c.checkpoint([7.5, 0, 25], -Math.PI / 2);
  c.checkpoint([-19.5, 0, 25.5], 0);
  c.checkpoint([-19.5, 3, 42], Math.PI / 2);
  c.enemy('smudge', [9.5, 0, 29.5]);
  c.enemy('smudge', [-22, 0, 25]);
  c.enemy('smudge', [-17, 0, 29.5]);
  c.enemy('smudge', [2, 3, 60]);
  c.coreAt([-1, 3, 58]);
  c.tip([-5, -6], [5, 4], 'These catwalks are coated in invisible primer. <b>Shoot ink ahead</b> to reveal the path!');
  c.tip([-2, 23], [12, 31], 'Gaps ahead! Paint each step before you jump.');
  c.tip([-24, 23], [-15, 32], 'Ride the <b>jump pad</b> up to the high ledge.');
  for (const [x, y, z] of [[3.5, 0, -4.5], [-3.5, 0, 2.5], [11, 0, 24], [-16, 0, 31], [-16, 3, 41], [3, 3, 53]]) {
    const post = part(c.decor, new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), std(0x2b2833, 0.5, 0.6), { pos: [x, y + 1.3, z] });
    void post;
    c.lamp([x, y + 2.75, z], 0x7ff0ff, { intensity: 10, dist: 10, hang: false, light: !(x === -3.5 || x === 11) });
  }
  const R = rng(5);
  for (let i = 0; i < 9; i++) c.chain([R.range(-24, 20), 16, R.range(-6, 62)], R.range(4, 9));
  // mist far below
  part(c.decor, new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x0b2028 }), { pos: [0, -30, 30], rot: [-Math.PI / 2, 0, 0], shadow: false });
  c.level.killY = -7;
}

// ============================================================== L3: Turret Alley
function buildL3(c) {
  const floor = { mat: 'concrete', color: 0xc99d78 };
  const low = { mat: 'concreteDark', color: 0xb9a8a0 };
  c.box([-12, -1, 0], [12, 0, 76], floor);
  c.wall([-13, 0, -1], [-12, 9, 77], WALL);
  c.wall([12, 0, -1], [13, 9, 77], WALL);
  c.wall([-13, 0, -1], [13, 9, 0], WALL);
  c.wall([-13, 0, 76], [13, 9, 77], WALL);
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
  // section 3: the Big Blotter
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
  c.enemy('blotter', [0, 1, 68], { yaw: Math.PI, big: true, group: 'gate' });
  c.coreAt([0, 0, 73.3], { gate: 'gate' });
  c.spawnAt([0, 0, 3], 0);
  c.gooAt([-3, 0.02, 24], 2.2); c.gooAt([5, 0.02, 37], 1.8); c.gooAt([-6, 0.02, 57], 2.4); c.gooAt([3, 0.02, 63], 2.2);
  c.tip([-12, 0], [12, 9], 'Blotter turrets ahead! Hide behind <b>cover</b>, or take the <b>catwalk</b> on the left to flank them.');
  c.tip([-12, 33], [7.5, 40], 'Blotter shots fly high: <b>swim in your ink</b> and they sail right over you.');
  c.tip([7.5, 31], [12, 38], 'This <b>jump pad</b> drops you right next to the tower turret. Splash it up close!');
  c.tip([-12, 56], [12, 60], 'The <b>Big Blotter</b> guards the core. The side ledges give you an angle on it.');
  for (const z of [8, 24, 40, 56, 70]) c.lamp([0, 7.5, z], 0xffb070, { intensity: 26, dist: 20, hang: 2 });
  c.pipe([[-11.6, 7, 0], [-11.6, 7, 76]], 0.3, 0x9a7a62);
  c.pipe([[11.6, 6, 0], [11.6, 6, 76]], 0.26, 0x77727f);
  c.pipe([[11.6, 6, 30], [11.6, 0, 30]], 0.26, 0x77727f);
  for (let z = 4; z < 76; z += 12) c.girder([-12, 8.6, z], [12, 8.6, z]);
  sign(c, 'TURRET ALLEY', [0, 6.2, 0.1], 6, 1.1, 0, { accent: '#ffc83d' });
}

// ============================================================== L4: Drone Heights
function buildL4(c) {
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
  c.coreAt([-9, 20, 53]);
  c.gooAt([0, 4.02, 18], 1.8); c.gooAt([-5, 8.02, 26], 1.4); c.gooAt([5, 12.02, 38], 1.6);
  c.tip([-8, 0], [8, 12], 'Drones drop gray bombs. Watch for the <b>warning ring</b> under you and keep moving!', { maxY: 1 });
  c.tip([-8, 12], [8, 22], 'Paint the wall ahead and <b>swim straight up</b> it.', { minY: 3, maxY: 5 });
  c.tip([-8, 22], [-2, 32], 'Jump pad! It flings you over to the next tower.', { minY: 7 });
  // silo shell, light shafts
  const shell = new THREE.MeshStandardMaterial({ color: 0x3a4456, roughness: 0.8, metalness: 0.3, side: THREE.BackSide });
  part(c.decor, new THREE.CylinderGeometry(46, 46, 140, 48, 1, true), shell, { pos: [0, 10, 28], shadow: false, receive: true });
  for (let y = -40; y < 70; y += 9) part(c.decor, new THREE.TorusGeometry(45.6, 0.5, 6, 64), std(0x2a3240, 0.6, 0.5), { pos: [0, y, 28], rot: [Math.PI / 2, 0, 0], shadow: false });
  const beam = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const [x, z] of [[-10, 20], [8, 44], [0, 6]]) part(c.decor, new THREE.CylinderGeometry(2.5, 6, 70, 20, 1, true), beam, { pos: [x, 35, z], shadow: false });
  for (const [x, y, z] of [[-7, 2.6, 11], [7, 6.6, 21], [-3, 10.6, 31], [8.5, 14.6, 39], [-13, 22.6, 57]]) c.lamp([x, y, z], 0xbfe0ff, { intensity: 14, dist: 12, hang: false });
  c.level.killY = -9;
}

// ============================================================== L5: The Gray Engine
function buildL5(c) {
  const R = rng(23);
  // antechamber
  c.box([-5, -1, -36], [5, 0, -22], { mat: 'grate', color: 0xb0a8b4 });
  c.wall([-6, 0, -37], [6, 9, -36], WALL);
  c.wall([-6, 0, -36], [-5, 9, -23], WALL);
  c.wall([5, 0, -36], [6, 9, -23], WALL);
  c.box([-5, 0, -31], [-3, 4, -27], { mat: 'container', color: 0x6d5f86 });
  c.swatchAt([-4, 5.3, -29]);
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

export const LEVELS = {
  hub: { id: 'hub', sky: SKY.hub, build: buildHub, tpm: 7, music: 'story_hub' },
  l1: { id: 'l1', sky: SKY.l1, build: buildL1, music: 'story_level' },
  l2: { id: 'l2', sky: SKY.l2, build: buildL2, music: 'story_level' },
  l3: { id: 'l3', sky: SKY.l3, build: buildL3, music: 'story_level' },
  l4: { id: 'l4', sky: SKY.l4, build: buildL4, music: 'story_level' },
  l5: { id: 'l5', sky: SKY.l5, build: buildL5, music: 'story_level', boss: true },
};

