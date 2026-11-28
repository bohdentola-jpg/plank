// Hubs: the hideout (sector 1's five hatches, Captain Veil, Dabble's shop, the
// Swatch Book, sector gates) and the two sector hubs (Rinse Reservoir pump hall,
// Grisaille Manor servants' stair). The hideout regains color as cores return.
import * as THREE from 'three';
import { rng } from '../util.js';
import { INFO, ORDER, SECTORS } from './info.js';
import { canvasTexture, HFONT, BFONT, std, glowMat, part, rod } from './kit.js';
import { WALL, WOOD, S2, S3, sign, floor, walls, tank, waterStrip, valveWheel, chandelier, portrait, carpet, curtain, bust } from './build.js';

const hatchArc = (c, ids, spots) => spots.forEach(([x, z], i) => c.hatch(ids[i], [x, 0, z], Math.atan2(0 - x, 6 - z)));

// ============================================================== the hideout
export function buildHub(c, story) {
  const R = rng(11);
  const st = story.progress;
  const done = st.cleared.length / ORDER.length;
  c.box([-22, -1, -16], [22, 0, 18], { mat: 'concrete', color: 0xc9a684 });
  c.wall([-23, 0, -17], [23, 9, -16], WALL);
  c.wall([-23, 0, 18], [23, 9, 19], WALL);
  c.wall([-23, 0, -16], [-22, 9, 18], WALL);
  c.wall([22, 0, -16], [23, 9, 18], WALL);
  // a raised gantry along the right wall (paintable, climbable) up to the manor gate
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
  // sector 1 hatches in an arc facing the middle of the room
  hatchArc(c, ORDER.slice(0, 5), [[-14, 2], [-8.5, -7], [0, -10.5], [8.5, -7], [14, 2]]);
  // the gates to sectors 2 and 3
  c.sectorGate([-21.55, 0, -4], Math.PI / 2, 'hub2', 'l5');
  c.sectorGate([21.55, 2.4, 0], -Math.PI / 2, 'hub3', 'l10');
  // the lift back up to the plaza
  c.exit([-18.4, 0, 14.4], Math.PI / 2, 'plaza');
  c.spawnAt([-12.2, 0, 13.6], 1.66);
  // friends
  c.npc('dabble', [-7.0, 0, 14.6], Math.PI, { when: (s) => s.cleared.includes('l1') });
  c.box([-8.3, 0, 13.3], [-5.7, 1.0, 16.0], { render: false, paintable: false });
  c.npc('book', [6.4, 0, 14.8], Math.PI);
  c.box([6.0, 0, 14.4], [6.8, 1.2, 15.2], { render: false, paintable: false });
  c.npc('tint', [9.6, 0, 13.6], Math.PI + 0.35, { when: (s) => s.cleared.includes('l10') });
  // the Drab's goo puddles dry up as cores come home
  const puddles = [[10, 5, 2.1], [-8, -12.5, 1.6], [15.5, -2.5, 2.2], [-5.5, 8.5, 1.2], [4, -14, 1.4], [-19, 4, 1.8]];
  puddles.slice(0, Math.max(0, Math.ceil(6 * (1 - done)))).forEach(([x, z, r]) => c.gooAt([x, 0.02, z], r));
  // lamps (warm work lights; colorful once the cores are back)
  const lc = (warm, i) => (done >= 1 ? [0xff7ab0, 0x7ad8ff, 0xffd27a, 0x9aff8a][i % 4] : warm);
  c.lamp([0, 6.4, 7], lc(0xffc070, 0), { intensity: 30, dist: 20, hang: 6 });
  c.lamp([-12, 6.4, -3], lc(0xffb060, 1), { intensity: 26, dist: 18, hang: 6 });
  c.lamp([12, 6.4, -3], lc(0xffb060, 2), { intensity: 26, dist: 18, hang: 6 });
  c.lamp([-17, 5.5, 12], 0x9fe0ff, { intensity: 14, dist: 10, hang: 7 });
  // pipes and girders
  c.pipe([[-22, 7.2, 17.4], [22, 7.2, 17.4]], 0.32, 0x8a8494);
  c.pipe([[-22, 6.2, 17.0], [-10, 6.2, 17.0], [-10, 0, 17.0]], 0.22, 0x9a7a62);
  c.pipe([[22, 6.2, 17.0], [10, 6.2, 17.0], [10, 0, 17.0]], 0.22, 0x9a7a62);
  c.pipe([[21.4, 9.6, -15], [21.4, 9.6, 10], [16.5, 9.6, 13.4], [16.5, 5.2, 13.4]], 0.3, 0x77727f);
  c.pipe([[-21.4, 4.5, -15], [-21.4, 4.5, -7.6]], 0.26, 0x77727f);
  c.pipe([[-21.4, 4.5, -0.4], [-21.4, 4.5, 8]], 0.26, 0x77727f);
  for (let x = -18; x <= 18; x += 6) c.girder([x, 10.5, -16], [x, 10.5, 18]);
  c.girder([-22, 10.2, 2], [22, 10.2, 2]);
  for (let i = 0; i < 7; i++) c.chain([R.range(-18, 18), 10.4, R.range(-12, 14)], R.range(2, 5));
  // signage
  sign(c, '▲ PRISM PLAZA', [-18.4, 4.2, 16.8], 3.4, 0.85, Math.PI, { accent: '#7dff7a' });
  sign(c, 'CHROMATIC PAINT WORKS', [0, 7.6, -15.9], 9, 1.3, 0, { accent: '#ffc83d' });
  // the Chroma Guard mission board behind Veil
  const board = canvasTexture(1024, 512, (ctx, w, h) => drawBoard(ctx, w, h, st));
  c.sign(board, [0, 3.7, 17.92], 7.2, 3.6, Math.PI);
  part(c.decor, new THREE.BoxGeometry(7.6, 4, 0.06), std(0x2b2833, 0.6, 0.4), { pos: [0, 3.7, 17.97], shadow: false });
  // the color bar under the big sign: one glass cell per Hue Core
  const cellOff = std(0x2b2833, 0.3, 0.4);
  part(c.decor, new THREE.BoxGeometry(14.6, 0.8, 0.14), std(0x1b1530, 0.5, 0.5), { pos: [0, 6.25, -15.93], shadow: false });
  ORDER.forEach((id, i) => {
    const on = st.cleared.includes(id);
    part(c.decor, new THREE.BoxGeometry(0.78, 0.5, 0.14), on ? glowMat(INFO[id].color, 1.8) : cellOff, { pos: [-6.86 + i * 0.98, 6.25, -15.86], shadow: false });
  });
  // bunting across the room: gray flags take on color as the cores come home
  buildBunting(c, done, st.flags?.ending);
}

function buildBunting(c, done, ending) {
  const strings = [[[-22, 8.6, -8], [22, 8.6, -8]], [[-22, 8.3, 4], [22, 8.3, 4]], [[-22, 8.8, 12], [22, 8.8, 12]]];
  const flags = [];
  for (const [a, b] of strings) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * 1.1;
      flags.push(p);
    }
    const pts = Array.from({ length: 13 }, (_, k) => { const t = k / 12; const p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * 1.1 - 0.02; return p; });
    for (let k = 0; k < 12; k++) rod(c.decor, pts[k].toArray(), pts[k + 1].toArray(), 0.015, c.mat('buntCord', () => std(0x2b2833, 0.8)), { shadow: false, seg: 4 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.32, 0, 0, 0.32, 0, 0, 0, -0.62, 0], 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, flags.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  const palette = ORDER.map((id) => INFO[id].color);
  const setColors = (k) => {
    const lit = Math.floor(flags.length * k);
    flags.forEach((p, i) => {
      // scatter which flags light first so the colour spreads around the room
      const order = (i * 37) % flags.length;
      if (order < lit) col.set(palette[i % palette.length]); else col.set(0x77737f);
      mesh.setColorAt(i, col);
    });
    mesh.instanceColor.needsUpdate = true;
  };
  flags.forEach((p, i) => { m.makeRotationY((i % 2) * 0.2 - 0.1).setPosition(p); mesh.setMatrixAt(i, m); });
  setColors(ending ? 1 : done);
  mesh.castShadow = false;
  c.decor.add(mesh);
  c.hubColor = setColors;
  if (ending) {
    // the hideout keeps celebrating
    c.updaters.push((dt, S) => { if (Math.random() < dt * 3) S.fx.spawn(new THREE.Vector3((Math.random() - 0.5) * 36, 9, (Math.random() - 0.5) * 28), new THREE.Vector3(0, -0.6, 0), new THREE.Color().setHSL(Math.random(), 0.9, 0.62), 0.06, 4, { grav: 0.08, drag: 0.4 }); });
  }
}

function drawBoard(ctx, w, h, st) {
  const cleared = st.cleared;
  ctx.fillStyle = '#1e2a24'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#6b4a32'; ctx.lineWidth = 24; ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.fillStyle = '#f4f1ea'; ctx.font = `42px ${HFONT}`; ctx.textAlign = 'center';
  ctx.fillText('CHROMA GUARD · OPERATION UNDERSIDE', w / 2, 70, w - 80);
  SECTORS.forEach((s, si) => {
    const y = 140 + si * 112;
    ctx.textAlign = 'left'; ctx.font = `800 22px ${BFONT}`; ctx.fillStyle = s.color;
    ctx.fillText(`S${s.num}`, 48, y + 8);
    const pts = s.levels.map((id, i) => [190 + i * 172, y]);
    ctx.setLineDash([12, 10]); ctx.strokeStyle = 'rgba(244,241,234,.45)'; ctx.lineWidth = 5;
    ctx.beginPath(); pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy))); ctx.stroke();
    ctx.setLineDash([]);
    s.levels.forEach((id, i) => {
      const [x, yy] = pts[i];
      const dn = cleared.includes(id);
      ctx.fillStyle = dn ? INFO[id].color : '#3a3742';
      ctx.beginPath(); ctx.arc(x, yy, 30, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = '#f4f1ea'; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = dn ? '#1b1530' : '#f4f1ea'; ctx.font = `36px ${HFONT}`;
      ctx.fillText(String(i + 1), x, yy + 13);
      ctx.font = `800 16px ${BFONT}`; ctx.fillStyle = '#f4f1ea';
      ctx.fillText(INFO[id].name.toUpperCase(), x, yy + 52, 168);
      if (!dn) { ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 17, yy - 17); ctx.lineTo(x + 17, yy + 17); ctx.stroke(); }
    });
  });
  ctx.textAlign = 'center'; ctx.font = `800 26px ${BFONT}`; ctx.fillStyle = '#ffd21a';
  ctx.fillText(`${cleared.length} / ${ORDER.length} HUE CORES RECOVERED`, w / 2, h - 30);
}

// ============================================================== sector 2 hub: the pump hall
export function buildHub2(c, story) {
  const st = story.progress;
  const F = S2.floor, Wm = S2.wall;
  floor(c, -16, 16, -6, 14, 0, F);
  // the rinse pool along the back
  floor(c, -16, 16, -12, -6, -1.0, { mat: 'tiles', color: 0x9fd0dc });
  waterStrip(c, -16, 16, -12, -6.05, -0.45, 0x2aa8c0);
  c.box([-16, -1, -6.2], [16, 0.25, -6], { mat: 'concreteDark', color: 0x8fb0b8 });
  walls(c, -16, 16, -12, 14, -1, 10, {}, Wm);
  hatchArc(c, SECTORS[1].levels, [[-11, 4], [-7, -2.6], [0, -4.2], [7, -2.6], [11, 4]]);
  c.exit([-13.4, 0, 11.4], Math.PI / 2, 'hub', 'Ride the lift back up to the <b>hideout</b>');
  c.spawnAt([-10.6, 0, 9.6], 2.3);
  c.npc('terminal', [12.6, 0, 11.2], Math.PI - 0.6);
  c.box([11.7, 0, 10.3], [13.5, 1.3, 12.1], { render: false, paintable: false });
  c.npc('book', [8.6, 0, 12.8], Math.PI);
  c.box([8.2, 0, 12.4], [9.0, 1.2, 13.2], { render: false, paintable: false });
  c.shelfAt = new THREE.Vector3(0, 0, 12.9);
  c.box([-3.7, 0, 12.3], [3.7, 0.9, 13.5], { render: false, paintable: false });
  tank(c, [13.2, 0, -2.5], 1.8, 5.5);
  tank(c, [-13.2, 0, -2.5], 1.8, 5.5);
  tank(c, [14, 0, 5.5], 1.3, 4);
  c.pipe([[-16, 7.5, 13.4], [16, 7.5, 13.4]], 0.32, S2.pipe);
  c.pipe([[-15.4, 6, -12], [-15.4, 6, 14]], 0.26, S2.pipe);
  c.pipe([[15.4, 6, -12], [15.4, 6, 14]], 0.26, S2.pipe);
  c.pipe([[-8, 9, -12], [-8, 9, 0], [-8, 0.3, 0]], 0.3, 0x6a9aa6);
  c.pipe([[8, 9, -12], [8, 9, 0], [8, 0.3, 0]], 0.3, 0x6a9aa6);
  for (const [x, y, z] of [[-15.3, 2.4, 3], [15.3, 2.4, -6], [-15.3, 2.4, -8]]) valveWheel(c, [x, y, z], Math.PI / 2);
  c.lamp([0, 7.2, 4], 0xbff4ff, { intensity: 28, dist: 22, hang: 3 });
  c.lamp([-9, 7.2, -6], 0x9fe8ff, { intensity: 20, dist: 16, hang: 3 });
  c.lamp([9, 7.2, -6], 0x9fe8ff, { intensity: 20, dist: 16, hang: 3 });
  for (let x = -12; x <= 12; x += 8) c.girder([x, 9.6, -12], [x, 9.6, 14], 0x3e5a62);
  sign(c, 'RINSE RESERVOIR · PUMP HALL', [0, 6.6, -11.9], 9, 1.3, 0, { accent: '#3fd8e6' });
  sign(c, '▲ HIDEOUT', [-15.9, 3.6, 11.4], 2.6, 0.8, Math.PI / 2, { accent: '#ffc83d' });
  for (const [x, z, r] of [[5, 6, 1.4], [-4, 8, 1.2], [10, -1, 1.1]]) if (st.cleared.length < 10) c.gooAt([x, 0.02, z], r);
  c.level.killY = -6;
}

// ============================================================== sector 3 hub: the servants' stair
export function buildHub3(c, story) {
  const st = story.progress;
  floor(c, -15, 15, -12, 14, 0, S3.floor);
  walls(c, -15, 15, -12, 14, 0, 10, {}, S3.wall);
  // wainscot + a grand (locked) double door at the back
  c.box([-15, 0, -12], [15, 1.2, -11.6], S3.stone);
  for (const s of [-1, 1]) part(c.decor, new THREE.BoxGeometry(2.2, 5, 0.2), c.mat('manorDoor', () => std(0x3a2a2a, 0.6, 0.2)), { pos: [s * 1.15, 3.7, -11.5], shadow: false });
  part(c.decor, new THREE.BoxGeometry(5.2, 0.4, 0.3), c.mat('brass', () => std(0x8a7a5a, 0.35, 0.8)), { pos: [0, 6.4, -11.5], shadow: false });
  hatchArc(c, SECTORS[2].levels, [[-10.5, 4], [-6.8, -3], [0, -5], [6.8, -3], [10.5, 4]]);
  c.exit([-12.4, 0, 11.4], Math.PI / 2, 'hub', 'Ride the lift back down to the <b>hideout</b>');
  c.spawnAt([-9.8, 0, 9.6], 2.3);
  c.npc('terminal', [11.8, 0, 11.2], Math.PI - 0.6);
  c.box([10.9, 0, 10.3], [12.7, 1.3, 12.1], { render: false, paintable: false });
  c.npc('book', [8.2, 0, 12.8], Math.PI);
  c.box([7.8, 0, 12.4], [8.6, 1.2, 13.2], { render: false, paintable: false });
  c.shelfAt = new THREE.Vector3(0, 0, 12.9);
  c.box([-3.7, 0, 12.3], [3.7, 0.9, 13.5], { render: false, paintable: false });
  carpet(c, -2.2, 2.2, -11, 12, 0, 0x5a2a36);
  carpet(c, -13, 13, 6.5, 9, 0, 0x5a2a36);
  chandelier(c, [0, 7.5, 3], 0xffe0b0, { intensity: 26, dist: 22 });
  chandelier(c, [0, 7.5, -6], 0xffd090, { intensity: 18, dist: 16 });
  for (const [x, z, yaw] of [[-14.9, -6, Math.PI / 2], [-14.9, 2, Math.PI / 2], [14.9, -6, -Math.PI / 2], [14.9, 2, -Math.PI / 2]]) portrait(c, [x, 4.2, z], yaw);
  for (const [x, z] of [[-13.4, -10], [13.4, -10]]) bust(c, [x, 0, z], 0);
  c.box([-13.8, 0, -10.4], [-13, 1.9, -9.6], { render: false, paintable: false });
  c.box([13, 0, -10.4], [13.8, 1.9, -9.6], { render: false, paintable: false });
  curtain(c, [-9, 5.5, -11.5], 4, 6, 0, 0x4a3a50);
  curtain(c, [9, 5.5, -11.5], 4, 6, 0, 0x4a3a50);
  sign(c, 'GRISAILLE MANOR · SERVANTS\' STAIR', [0, 8.2, -11.55], 9, 1.2, 0, { accent: '#b9a6ff', bg: '#141018' });
  sign(c, '▼ HIDEOUT', [-14.9, 3.6, 11.4], 2.6, 0.8, Math.PI / 2, { accent: '#ffc83d' });
  if (st.cleared.length < 15) for (const [x, z, r] of [[6, 5, 1.3], [-6, 7, 1.1]]) c.gooAt([x, 0.02, z], r);
  c.level.killY = -6;
}
