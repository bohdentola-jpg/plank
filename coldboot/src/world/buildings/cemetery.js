// Orthodox cemetery: a white picket fence with a roofed lych-gate crowned by a
// three-bar cross, rows of graves under the snow — wooden three-bar crosses,
// fenced graves and painted spirit houses (an Alaska Native Orthodox
// tradition), a few granite headstones — a memorial cross, a bench, and one
// freshly dug plot.
import { makeCtx, finish, sign, weather, rgb, LIGHT, PI, HALF_PI } from './common.js';
import { addProp, orthodoxCross } from '../props.js';

export function build(opts = {}) {
  const ctx = makeCtx('cemetery', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 38, D = 28;
  ctx.footprint = { w: W + 2, d: D + 4 };
  const white = weather('#f0ece2', wear * 0.6);
  // picket fence (flat double-sided pickets keep it light), gap for the gate at the front centre
  const fence = (x0, z0, x1, z1, gap) => {
    const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    const n = Math.floor(len / 0.21);
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * len;
      if (gap && Math.abs(t - len / 2) < gap / 2) continue;
      const x = x0 + dx * t, z = z0 + dz * t;
      const h = 1.0 + ((i % 2) ? -0.06 : 0);
      if (wear > 0.5 && r() < (wear - 0.45) * 0.3) continue;
      const px = -dz * 0.0, pz = dx * 0.0;
      b.quad2('paint', [x - dx * 0.04 + px, 0, z - dz * 0.04 + pz], [x + dx * 0.04, 0, z + dz * 0.04], [x + dx * 0.04, h - 0.05, z + dz * 0.04], [x - dx * 0.04, h - 0.05, z - dz * 0.04], { color: white });
      b.poly('paint', [[x - dx * 0.04, h - 0.05, z - dz * 0.04], [x + dx * 0.04, h - 0.05, z + dz * 0.04], [x, h + 0.04, z]], { color: white, want: [-dz, 0, dx] });
      b.poly('paint', [[x + dx * 0.04, h - 0.05, z + dz * 0.04], [x - dx * 0.04, h - 0.05, z - dz * 0.04], [x, h + 0.04, z]], { color: white, want: [dz, 0, -dx] });
      if (i % 12 === 0) b.box('paint', x, 0, z, 0.1, 1.15, 0.1, { color: white });
    }
    for (const y of [0.25, 0.75]) {
      if (gap) {
        const half = len / 2 - gap / 2;
        b.beam('paint', [x0, y, z0], [x0 + dx * half, y, z0 + dz * half], 0.07, 0.05, { color: rgb(white, 0.92) });
        b.beam('paint', [x1 - dx * half, y, z1 - dz * half], [x1, y, z1], 0.07, 0.05, { color: rgb(white, 0.92) });
      } else b.beam('paint', [x0, y, z0], [x1, y, z1], 0.07, 0.05, { color: rgb(white, 0.92) });
    }
  };
  fence(-W / 2, D / 2, W / 2, D / 2, 2.4);
  fence(W / 2, D / 2, W / 2, -D / 2);
  fence(W / 2, -D / 2, -W / 2, -D / 2);
  fence(-W / 2, -D / 2, -W / 2, D / 2);
  for (const [x, z, w, d] of [[-W / 4 - 0.6, D / 2, W / 2 - 1.2, 0.15], [W / 4 + 0.6, D / 2, W / 2 - 1.2, 0.15], [W / 2, 0, 0.15, D], [0, -D / 2, W, 0.15], [-W / 2, 0, 0.15, D]]) ctx.col(x, z, w, d, 1.1);
  // lych-gate: two posts, a little gable roof, a three-bar cross on top
  b.push().translate(0, 0, D / 2);
  for (const sx of [-1.3, 1.3]) b.box('wood_weathered', sx, 0, 0, 0.2, 2.5, 0.2, { color: '#8a7a64' });
  b.box('wood_weathered', 0, 2.45, 0, 3.0, 0.18, 0.3, { color: '#8a7a64' });
  for (const s of [-1, 1]) b.poly('wood_weathered', [[-1.7, 2.6, s * 0.75], [1.7, 2.6, s * 0.75], [1.7, 3.25, 0], [-1.7, 3.25, 0]], { color: weather('#4a5a6a', wear * 0.5), want: [0, 1, s] });
  for (const sx of [-1.7, 1.7]) b.poly('wood_weathered', [[sx, 2.6, -0.75], [sx, 2.6, 0.75], [sx, 3.25, 0]], { color: '#8a7a64', want: [sx, 0, 0] });
  b.push().translate(0, 3.25, 0);
  orthodoxCross(b, 'gold_dull', 1.0, st > 0.5 ? '#e8c060' : '#8a7a54', { t: 0.06 });
  b.pop();
  sign(ctx, 'cemetery_gate', 0, 2.25, 0.16, 2.2, 0.3, { kind: 'paint', ppm: 120, bg: '#f0ece2', fade: wear * 0.8, seed: 2, lines: [{ text: 'ВЕЧНАЯ ПАМЯТЬ · MEMORY ETERNAL', size: 0.5, color: '#2a3a5a', font: 'Georgia, serif', weight: 'bold' }] }, { back: true });
  b.pop();
  ctx.doors.push({ id: 'gate', x: 0, z: D / 2, rot: 0, w: 2.4, leadsTo: 'exterior' });
  ctx.point('gate', 0, 0, D / 2 + 1.6, PI);
  // central path (packed snow) to the memorial cross
  b.box('snow_dirty', 0, -0.02, 0, 2.0, 0.04, D - 1, { color: '#e8e8e4' });
  b.push().translate(0, 0, -D / 2 + 2.2);
  b.box('concrete', 0, 0, 0, 1.6, 0.4, 1.6, { color: '#8a8a86' });
  b.box('concrete', 0, 0.4, 0, 1.0, 0.4, 1.0, { color: '#9a9a94' });
  b.push().translate(0, 0.8, 0);
  orthodoxCross(b, 'paint', 3.4, white, { t: 0.14 });
  b.pop();
  b.pop();
  ctx.col(0, -D / 2 + 2.2, 1.6, 1.6, 4);
  ctx.point('memorial', 0, 0, -D / 2 + 4.2, PI);
  // bench by the path
  b.at(2.4, 0, -D / 2 + 5, -HALF_PI);
  addProp(b, 'bench', { color: '#5a4a3a' }, r);
  b.pop();
  ctx.point('bench', 2.0, 0, -D / 2 + 5, HALF_PI);
  // graves in rows either side of the path; crosses face east (+x)… we orient by row
  const rows = 5, perRow = 7;
  let fresh = null;
  for (const side of [-1, 1]) {
    for (let row = 0; row < rows; row++) {
      for (let k = 0; k < perRow; k++) {
        const x = side * (3.2 + k * 2.15), z = -D / 2 + 3.5 + row * 4.6 + (r() - 0.5) * 0.4;
        if (Math.abs(x) > W / 2 - 1.2) continue;
        if (!fresh && side > 0 && row === rows - 1 && k === 1) { fresh = [x, z]; continue; }
        if (r() < 0.12) continue;
        const kind = r();
        b.push().translate(x, 0, z).rotateY(HALF_PI + (r() - 0.5) * 0.06);
        // snow mound over the grave
        b.sphere('snow', 0, -0.05, 0, 1.0, { sx: 0.5, sy: 0.25, rings: 4, segs: 8, phiBottom: HALF_PI, color: '#ffffff' });
        if (kind < 0.4) {
          addProp(b, 'graveHouse', { wear: wear * 0.8 + r() * 0.2, len: 2.0, w: 1.0 }, r);
        } else if (kind < 0.85) {
          b.push().translate(-1.1, 0, 0).rotateY(HALF_PI);
          orthodoxCross(b, r() < 0.6 ? 'paint' : 'wood_weathered', 1.3 + r() * 0.5, r() < 0.6 ? weather('#f0ece2', wear * 0.5 + r() * 0.3) : '#8a7a64', { t: 0.06 });
          if (r() < 0.5) {
            b.translate(0, 1.55, 0);
            for (const s of [-1, 1]) b.box('wood_weathered', s * 0.12, 0, 0, 0.3, 0.02, 0.22, { color: '#6a5a48', rz: -s * 0.6 });
          }
          b.pop();
        } else {
          b.push().translate(-1.0, 0, 0).rotateY(HALF_PI);
          b.box('stone', 0, 0, 0, 0.6, 0.75, 0.15, { color: '#7a7a7e' });
          b.box('stone', 0, 0, 0, 0.8, 0.12, 0.4, { color: '#6a6a6e' });
          b.pop();
        }
        b.pop();
        ctx.col(x, z, 1.1, 2.2, 0.8);
      }
    }
  }
  // the freshly dug plot (Koshkin's): dark earth mound + a temporary cross with a wreath
  if (fresh) {
    const [x, z] = fresh;
    b.push().translate(x, 0, z).rotateY(HALF_PI);
    b.sphere('gravel', 0, -0.1, 0, 1.0, { sx: 0.5, sy: 0.35, rings: 4, segs: 8, phiBottom: HALF_PI, color: '#4a3a2a' });
    b.push().translate(-1.1, 0, 0).rotateY(HALF_PI);
    orthodoxCross(b, 'wood_raw', 1.5, '#b89a74', { t: 0.06 });
    b.push().translate(0, 0.95, 0.06).rotateX(HALF_PI);
    b.lathe('fabric', 0, -0.04, 0, [[0.18, 0], [0.26, 0.04], [0.18, 0.08]], { segs: 12, color: '#2a5a2a' });
    b.pop();
    for (let i = 0; i < 5; i++) b.sphere('plastic', (r() - 0.5) * 0.3, 0.92 + (r() - 0.5) * 0.3, 0.08, 0.035, { rings: 2, segs: 5, color: '#c81a2a' });
    b.pop();
    b.pop();
    ctx.point('freshGrave', x - 1.6, 0, z, HALF_PI);
  }
  // a lantern (memorial candle) at the gate + light
  if (st > 0.3) {
    b.box('glass_cold', 1.6, 0.9, D / 2 + 0.1, 0.12, 0.2, 0.12, { color: [0.2, 0.2, 0.2] });
    b.sphere('neon', 1.6, 1.0, D / 2 + 0.1, 0.03, { rings: 2, segs: 4, color: [8, 3, 1] });
    ctx.light(1.6, 1.1, D / 2 + 0.3, 0xff9040, 0.8, 5);
  }
  return finish(ctx);
}
