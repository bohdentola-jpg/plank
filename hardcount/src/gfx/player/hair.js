// Hair for when the helmet comes off: a cap over the scalp shaped per style
// (short, curly, twists, afro, flat-top, mohawk, dreads, braids, long), plus
// the pieces that hang below the helmet (dreads, braids, long hair) which stay
// visible with the helmet on. Buzz, fade and bald are painted on the scalp.
// Everything is appended into the body mesh, skinned to the head (hanging
// ends partly to the neck/chest so they drape when the head moves).
import * as THREE from 'three';
import { B } from './rig.js';
import { headPoint } from './body.js';
import { R, uvOf } from './layout.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

const HAIRLINE_HALF = [[0, 37], [16, 35.5], [32, 31], [50, 23], [66, 13], [78, 7], [90, 2], [104, -8], [125, -24], [150, -34], [180, -38]];
const HAIRLINE = (() => {
  const L = [];
  for (let i = HAIRLINE_HALF.length - 1; i >= 0; i--) L.push([-HAIRLINE_HALF[i][0], HAIRLINE_HALF[i][1]]);
  for (let i = 1; i < HAIRLINE_HALF.length; i++) L.push(HAIRLINE_HALF[i]);
  return L;
})();
function hairlineAt(c) {
  const f = c * (HAIRLINE.length - 1);
  const i = Math.min(HAIRLINE.length - 2, Math.floor(f));
  const t = f - i;
  return [lerp(HAIRLINE[i][0], HAIRLINE[i + 1][0], t), lerp(HAIRLINE[i][1], HAIRLINE[i + 1][1], t)];
}

let FLAT = null;
function flatBox() {
  if (FLAT) return FLAT;
  const p = new THREE.Vector3();
  headPoint(90, 0, p);
  const top = p.y;
  headPoint(35, 90, p);
  FLAT = { top: top + 0.042, side: Math.abs(p.x) + 0.014 };
  return FLAT;
}

// cap thickness (metres) per style at (λ, φ) and lateral x
// (the bumps go round the head a whole number of times, so the cap meets itself at the back)
const D2R = Math.PI / 180;
function thickness(style, lam, phi, x, y, z) {
  const top = sstep(20, 75, phi);
  const la = lam * D2R;
  switch (style) {
    case 'short': return 0.006 + 0.007 * top;
    case 'curly': return 0.013 + 0.006 * top + 0.0035 * Math.sin(la * 18) * Math.sin(phi * 0.42);
    case 'twists': return 0.017 + 0.006 * top + 0.006 * Math.abs(Math.sin(la * 32) * Math.sin(phi * 0.6));
    case 'afro': return 0.046 + 0.024 * top + 0.012 * sstep(-10, 30, phi) + 0.004 * Math.sin(la * 23) * Math.sin(phi * 0.5);
    case 'flat': {
      // high-top: the ray from the head centre stops at a flat top or at the straight sides
      const F = flatBox();
      const len = Math.hypot(x, y, z);
      const dy = y / len, dr = Math.hypot(x, z * 0.92) / len;
      // a soft minimum of the two: the top meets the sides in a rounded edge, not a box corner
      const a = dy > 0.02 ? F.top / dy : 9, b = dr > 0.02 ? F.side / dr : 9, k = 0.011;
      const m = Math.min(a, b);
      const d = m - k * Math.log(Math.exp(-(a - m) / k) + Math.exp(-(b - m) / k));
      return clamp(d - len, 0.004, 0.075) * sstep(-8, 22, phi) + 0.002;
    }
    case 'mohawk': return 0.001 + 0.042 * Math.exp(-((x / 0.017) ** 2)) * sstep(-25, 25, phi + (z < 0 ? 25 : 0));
    case 'dreads': return 0.012 + 0.004 * top;
    case 'braids': return 0.004;
    case 'long': return 0.011 + 0.006 * top;
    default: return 0;
  }
}

function capGrid(mb, style, C, hs, lod) {
  const nc = lod === 'high' ? 22 : 10, ns = lod === 'high' ? 7 : 3;
  // how far in from the hairline the hair reaches its full height (big styles round over)
  const ramp = style === 'afro' ? 0.42 : style === 'curly' || style === 'twists' ? 0.22 : 0.12;
  const p = new THREE.Vector3(), q = new THREE.Vector3(), r = new THREE.Vector3(), n = new THREE.Vector3();
  const base = mb.count;
  const pos = (c, s, out) => {
    const [lam, phi0] = hairlineAt(c);
    const phi = Math.min(89.5, lerp(phi0, 90, s));
    headPoint(phi, lam, out);
    const len = out.length();
    const t = thickness(style, lam, phi, out.x, out.y, out.z) * sstep(0, ramp, s + 0.02);
    out.multiplyScalar((len + t) / len);
    return out;
  };
  const uv = [0, 0];
  for (let k = 0; k <= ns; k++) {
    for (let j = 0; j <= nc; j++) {
      const c = j / nc, s = Math.pow(k / ns, 1.1);
      pos(c, s, p);
      // round the cap (it closes at the back): wrap, so the seam's two sides get the same normal
      pos((c + 0.01) % 1, s, q).sub(pos((c + 0.99) % 1, s, r));
      const tc = q.clone();
      pos(c, Math.min(1, s + 0.02), q).sub(pos(c, Math.max(0, s - 0.02), r));
      n.crossVectors(tc, q).normalize();
      if (!(n.lengthSq() > 0.5) || s > 0.98) n.copy(p).normalize();
      if (n.dot(p) < 0) n.negate();
      uvOf(R.HAIR, c, 0.05 + s * 0.9, uv);
      mb.vert(C.x + p.x * hs, C.y + p.y * hs, C.z + p.z * hs, n.x, n.y, n.z, uv[0], uv[1], [B.head, 1]);
    }
  }
  for (let k = 0; k < ns; k++) for (let j = 0; j < nc; j++) {
    const a = base + k * (nc + 1) + j, b = a + 1, c = a + nc + 2, d = a + nc + 1;
    // orient outward: check with the first quad
    mb.tri(a, c, b); mb.tri(a, d, c);
  }
  // make sure the winding faces out (test the first triangle against its vertex normal)
  const I = mb.I, P = mb.P, N = mb.N;
  const t0 = I.length - ns * nc * 6;
  const ia = I[t0], ib = I[t0 + 1], ic = I[t0 + 2];
  const ax = P[ia * 3], ay = P[ia * 3 + 1], az = P[ia * 3 + 2];
  const ux = P[ib * 3] - ax, uy = P[ib * 3 + 1] - ay, uz = P[ib * 3 + 2] - az;
  const vx = P[ic * 3] - ax, vy = P[ic * 3 + 1] - ay, vz = P[ic * 3 + 2] - az;
  const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
  if (fx * N[ia * 3] + fy * N[ia * 3 + 1] + fz * N[ia * 3 + 2] < 0) {
    for (let i = t0; i < I.length; i += 3) { const tmp = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = tmp; }
  }
}

/** Hanging strands (dreads / braids) and the long-hair fall, from the nape downward. */
function hanging(mb, style, C, hs, lod) {
  if (!['dreads', 'braids', 'long'].includes(style)) return;
  const uv = uvOf(R.HAIR, 0.5, 0.5, [0, 0]);
  const p = new THREE.Vector3();
  if (style === 'long') {
    const rings = [];
    const n = 8;
    const steps = 4;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      headPoint(-30 - t * 4, 180, p);
      const y = C.y + (p.y - t * 0.17) * hs;
      const z = C.z + (p.z - 0.012 - t * 0.03) * hs;
      rings.push({ y, z, w: lerp(0.07, 0.085, t) * hs, d: lerp(0.03, 0.015, t) * hs, t });
    }
    const base = mb.count;
    for (const r of rings) {
      for (let j = 0; j <= n; j++) {
        const a = (j / n) * Math.PI * 2;
        const x = Math.sin(a) * r.w, dz = Math.cos(a) * r.d;
        const nn = new THREE.Vector3(Math.sin(a) / r.w, 0, Math.cos(a) / r.d).normalize();
        const w = [B.head, 1 - r.t * 0.6, B.neck, r.t * 0.35, B.chest, r.t * 0.25];
        mb.vert(x, r.y, r.z + dz, nn.x, nn.y, nn.z, uv[0] + j * 0.002, uv[1] - r.t * 0.05, w);
      }
    }
    for (let k = 0; k < steps; k++) for (let j = 0; j < n; j++) {
      const a = base + k * (n + 1) + j, b = a + 1, c = a + n + 2, d = a + n + 1;
      mb.tri(a, b, c); mb.tri(a, c, d);
    }
    return;
  }
  const count = style === 'dreads' ? (lod === 'high' ? 15 : 6) : 6;
  const len = style === 'dreads' ? 0.2 : 0.12;
  const rad = style === 'dreads' ? 0.0072 : 0.0055;
  const steps = lod === 'high' ? 6 : 3, sides = lod === 'high' ? 6 : 4;
  const tan = new THREE.Vector3(), X = new THREE.Vector3(), Z = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0 : i / (count - 1) - 0.5;
    const lam = 180 + f * (style === 'dreads' ? 150 : 70) + (style === 'dreads' ? 4 * Math.sin(i * 4.1) : 0);
    headPoint(-34 + (style === 'dreads' ? 3 * Math.sin(i * 1.7) : 0), lam, p);
    const start = new THREE.Vector3(C.x + p.x * hs * 1.02, C.y + p.y * hs, C.z + p.z * hs * 1.02);
    const out = new THREE.Vector3(p.x, 0, p.z).normalize();
    const L = len * (0.85 + 0.3 * Math.abs(Math.sin(i * 2.3))) * hs;
    const r0 = rad * hs * (0.85 + 0.3 * Math.abs(Math.sin(i * 3.7)));
    const pts = [
      start,
      start.clone().add(new THREE.Vector3(out.x * 0.02, -L * 0.35, out.z * 0.03 - 0.01)),
      start.clone().add(new THREE.Vector3(out.x * 0.035, -L * 0.7, out.z * 0.045 - 0.025)),
      start.clone().add(new THREE.Vector3(out.x * 0.045, -L, out.z * 0.05 - 0.04)),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const py = start.y;
    const w = (x, y) => {
      const t = clamp((py - y) / L, 0, 1);
      return [B.head, 1 - t * 0.6, B.neck, t * 0.3, B.chest, t * 0.3];
    };
    // a round strand, thinning a little to a rounded end (not an open, square tube)
    const rings = [];
    for (let k = 0; k <= steps + 1; k++) {
      const t = Math.min(1, k / steps);
      curve.getTangentAt(t, tan);
      X.crossVectors(up, tan).normalize();
      if (X.lengthSq() < 0.5) X.set(1, 0, 0);
      Z.crossVectors(tan, X).normalize();
      const c = curve.getPointAt(t);
      if (k > steps) c.addScaledVector(tan, r0 * 0.8);
      const r = r0 * (1 - 0.18 * t);
      rings.push({ c, X: X.clone(), Z: Z.clone(), sec: k > steps ? { pole: true } : { rx: r, rzF: r, rzB: r, sq: 2 }, v: 0.5 + 0.4 * (1 - t), w: (th, x, y) => w(x, y) });
    }
    mb.loft(rings, { X: rings[0].X, Z: rings[0].Z, A: curve.getTangentAt(0, new THREE.Vector3()), n: sides, rect: R.HAIR, th0: 0, uMap: (u) => 0.05 + 0.04 * u + (i % 6) * 0.15 });
  }
}

/** Geometry callbacks for buildBody: { always: [fn], off: [fn] }. */
export function hairParts(look, C, hs, lod) {
  const style = look?.hair || 'short';
  const capStyles = ['short', 'curly', 'twists', 'afro', 'flat', 'mohawk', 'dreads', 'braids', 'long'];
  return {
    always: [(mb) => hanging(mb, style, C, hs, lod)],
    off: capStyles.includes(style) && style !== 'braids' ? [(mb) => capGrid(mb, style, C, hs, lod)] : [],
  };
}
