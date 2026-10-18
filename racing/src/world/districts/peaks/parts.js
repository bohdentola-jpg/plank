// PORT HALCYON — the mountains' small parts: sign boards from an atlas
// (front textured, back plain, or both faces textured for chevrons, which
// read the right way from either direction), posts, curve mirrors, a lamp
// post with its glowing head, utility poles with their crossarms and sagging
// wires, railings, benches. Accumulators come from the pack (B.acc / B.near).
import { box, cylinder } from '../builder.js';
import { frame } from './util.js';

/** An atlas cell's uv rect [u0, v0, u1, v1] (cols × rows cells, row 0 at the top). */
export function cellUV(k, cols = 4, rows = 2, inset = 0.01) {
  const cx = k % cols, cy = Math.floor(k / cols);
  return [cx / cols + inset, 1 - (cy + 1) / rows + inset, (cx + 1) / cols - inset, 1 - cy / rows - inset];
}

/**
 * A flat board w × h centred at (x, y, z), facing ry (its front's normal is
 * (sin ry, cos ry)). uv: front rect; back: rect for the back (null: the
 * same rect, which reads mirrored — right for chevrons).
 */
export function board(acc, x, y, z, w, h, ry, uv, back = null, thick = 0.04) {
  const P = frame(x, y, z, ry);
  const hw = w / 2, hh = h / 2, t = thick / 2;
  acc.quadP(P(-hw, -hh, t), P(hw, -hh, t), P(hw, hh, t), P(-hw, hh, t), uv);
  const b = back || uv;
  acc.quadP(P(hw, -hh, -t), P(-hw, -hh, -t), P(-hw, hh, -t), P(hw, hh, -t), back ? b : [uv[2], uv[1], uv[0], uv[3]]);
}

/** A square post from the ground up (props material, current colour). */
export function post(acc, x, y0, z, w, h, ry = 0) {
  box(acc, x, y0, z, w, h, w, ry);
}

/** Curve mirror: an orange post, a round convex mirror facing ry, an orange rim. */
export function curveMirror(props, glass, x, y, z, ry, colPost, colRim) {
  props.col = colPost;
  cylinder(props, x, y - 0.4, z, 0.06, 3.9, 6);
  const P = frame(x, y + 3.2, z, ry);
  props.col = colRim;
  // a hood and rim round the mirror
  const n = 10, R = 0.42;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    const A = P(Math.cos(a0) * R, Math.sin(a0) * R, 0.12), Bq = P(Math.cos(a1) * R, Math.sin(a1) * R, 0.12);
    const C = P(Math.cos(a1) * R, Math.sin(a1) * R, -0.02), D = P(Math.cos(a0) * R, Math.sin(a0) * R, -0.02);
    props.quadP(D, C, Bq, A);
    props.quadP(A, Bq, C, D);
  }
  // the bulging glass (a shallow cone toward the viewer)
  const tip = P(0, 0, 0.16);
  const ti = glass.v(tip[0], tip[1], tip[2], 0.5, 0.5);
  const ring = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const q = P(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94, 0.08); ring.push(glass.v(q[0], q[1], q[2], 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5)); }
  for (let k = 0; k < n; k++) glass.tri(ring[k], ring[(k + 1) % n], ti);
  // the back plate
  props.col = colPost;
  const back = P(0, 0, -0.04);
  const bi = props.v(back[0], back[1], back[2]);
  const br = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const q = P(Math.cos(a) * R, Math.sin(a) * R, -0.02); br.push(props.v(q[0], q[1], q[2])); }
  for (let k = 0; k < n; k++) props.tri(br[(k + 1) % n], br[k], bi);
}

/**
 * A lamp post: a pole at (x, y, z) h tall, an arm reaching to (hx, hz) over
 * the road, a head there (glow accumulator). ry is the arm's direction.
 */
export function lampPost(props, glow, x, y, z, h, hx, hz, colPole) {
  props.col = colPole;
  cylinder(props, x, y - 0.3, z, 0.14, h + 0.3, 6, { r2: 0.1 });
  props.beam(x, y + h - 0.1, z, hx, y + h + 0.2, hz, 0.12, 0.12);
  const ry = Math.atan2(hx - x, hz - z);
  box(props, hx, y + h + 0.05, hz, 0.45, 0.24, 0.9, ry);
  box(glow, hx, y + h - 0.02, hz, 0.36, 0.08, 0.7, ry);
}

/**
 * A utility pole (concrete, 10 m) with a crossarm and three insulators, an
 * optional transformer can, and three wires sagging to the next pole.
 * wires: accumulator for the wires (thin dark beams).
 */
export function utilityPole(props, wires, it, y, ny, colPole, colArm, colWire, colIns, transformer) {
  const { x, z } = it;
  const H = 10;
  props.col = colPole;
  cylinder(props, x, y - 0.5, z, 0.17, H + 0.5, 6, { r2: 0.12 });
  // the crossarm, square to the road
  const ry = it.ry;
  const ax = Math.cos(ry), az = -Math.sin(ry);
  props.col = colArm;
  props.beam(x - ax * 1.1, y + H - 0.6, z - az * 1.1, x + ax * 1.1, y + H - 0.6, z + az * 1.1, 0.12, 0.12);
  props.col = colIns;
  const tops = [];
  for (const o of [-0.95, 0, 0.95]) {
    const px = x + ax * o, pz = z + az * o;
    cylinder(props, px, y + H - 0.54, pz, 0.06, 0.22, 5);
    tops.push([px, y + H - 0.3, pz]);
  }
  if (transformer) {
    props.col = colPole;
    cylinder(props, x + Math.sin(ry) * 0.45, y + H - 3.2, z + Math.cos(ry) * 0.45, 0.32, 1.1, 8, { top: true });
  }
  // a step bolt or two and a little sign band
  props.col = colArm;
  box(props, x, y + 2.2, z, 0.38, 0.5, 0.38, ry);
  if (it.nx === undefined) return;
  wires.col = colWire;
  const dx = it.nx - x, dz = it.nz - z;
  const ny2 = ny + H - 0.3;
  for (const [px, py, pz] of tops) {
    const qx = px + dx, qz = pz + dz, qy = ny2;
    const sag = Math.hypot(dx, dz) * 0.03;
    let prev = [px, py, pz];
    for (let k = 1; k <= 4; k++) {
      const t = k / 4;
      const p = [px + (qx - px) * t, py + (qy - py) * t - Math.sin(t * Math.PI) * sag, pz + (qz - pz) * t];
      wires.beam(prev[0], prev[1], prev[2], p[0], p[1], p[2], 0.035, 0.035);
      prev = p;
    }
  }
}

/** A simple post-and-rail fence/railing from a to b (points [x, y, z]), h tall. */
export function railing(acc, a, b, h, col, every = 2.2, bar = 0.08) {
  acc.col = col;
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(1, Math.round(L / every));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
    box(acc, x, y - 0.2, z, bar * 1.4, h + 0.2, bar * 1.4);
  }
  acc.beam(a[0], a[1] + h, a[2], b[0], b[1] + h, b[2], bar, bar);
  acc.beam(a[0], a[1] + h * 0.5, a[2], b[0], b[1] + h * 0.5, b[2], bar * 0.8, bar * 0.8);
}

/** A bench (slats and legs), w long, facing ry. */
export function bench(acc, x, y, z, ry, w, colSeat, colLeg) {
  const P = frame(x, y, z, ry);
  acc.col = colLeg;
  for (const lx of [-w / 2 + 0.15, w / 2 - 0.15]) { const q = P(lx, 0, 0); box(acc, q[0], y, q[2], 0.08, 0.45, 0.4, ry); }
  acc.col = colSeat;
  const s = P(0, 0.45, 0);
  box(acc, s[0], s[1], s[2], w, 0.06, 0.42, ry);
  const bk = P(0, 0.55, -0.22);
  box(acc, bk[0], bk[1], bk[2], w, 0.35, 0.05, ry);
}
