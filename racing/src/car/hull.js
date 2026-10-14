// The car body as math. A body spec (see bodies.js) describes a car the way a
// designer's blueprint does — side profile lines, plan-view taper, cross-section
// character — and this turns it into lofted rings:
//
//  lower body: rings perpendicular to the length, 47 points each, running
//    bottom-center → left side (+x) → top-center → right side (−x) → bottom.
//    Wheel arches are carved by clamping every point outboard of the wheel-well
//    depth up to the arch circle, which also forms the well's ceiling + liner.
//  cabin: open rings from the left beltline over the roof to the right belt.
//  caps: the front and rear fascias, fanned from the last bevel ring.
//
// Local frame: +z forward, +y up, +x = the car's LEFT side. Ground at y=0.
import * as THREE from 'three';
import { monotone, bump, smooth01, loft, fan } from './geom.js';

const lerp = (a, b, t) => a + (b - a) * t;

export const SEC_DEFAULT = { bulge: 0.02, tumble: 0.05, rs: 0.09, rb: 0.06, crown: 0.025 };
export const PLAN_DEFAULT = { front: 0.84, frontR: 0.32, rear: 0.88, rearR: 0.26, flare: 0.025, waist: 0.0 };
export const CAB_DEFAULT = { inset: 0.05, tumble: 0.2, rr: 0.075, crown: 0.035, bulge: 0.012 };

/** Precomputed shape functions for a spec (cheap; used by hull + parts + painter). */
/** Beltline drop: real cars carry less body above the wheels than the
 *  blueprints imply — pull the top line (and lamp boxes) down a touch. */
const BELT_K = 0.085, BELT_Y0 = 0.35;
const belt = (y) => (y > BELT_Y0 ? y - (y - BELT_Y0) * BELT_K : y);

export function shapeOf(b) {
  if (!b._belt) {
    b._belt = true;
    b.top = b.top.map(([u, y]) => [u, belt(y)]);
    for (const k of ['headBox', 'tailBox']) if (b[k]) b[k] = { ...b[k], y0: belt(b[k].y0), y1: belt(b[k].y1) };
  }
  const L = b.L, W = b.W;
  const sec = { ...SEC_DEFAULT, ...(b.section || {}) };
  const plan = { ...PLAN_DEFAULT, ...(b.plan || {}) };
  const cab = { ...CAB_DEFAULT, ...(b.cabin || {}) };
  const uF = b.fo;
  const uR = b.fo + b.wb;
  const wheelR = b.wheelR;
  const archR = wheelR + (b.archGap ?? 0.035);
  const topF = monotone(b.top);
  const botF = monotone(b.bot);
  // the greenhouse starts and ends flush with the body's top line
  if (b.roof) {
    b.roof = b.roof.map((p) => p.slice());
    b.roof[0] = [b.cowl, topF(b.cowl)];
    b.roof[b.roof.length - 1] = [b.deck, topF(b.deck)];
  }
  const roofF = b.roof ? monotone(b.roof) : null;
  const wellD = Math.min(0.42, b.tireW + 0.1);
  const archTop = wheelR + archR;

  const hwAt = (u) => {
    let hw = W / 2 - plan.flare;
    hw += plan.flare * Math.max(bump((u - uF) / (archR * 1.9)), bump((u - uR) / (archR * 1.9)));
    hw -= plan.waist * bump((u - (uF + uR) / 2) / (b.wb * 0.42));
    if (u < plan.frontR) {
      const t = Math.max(0, u / plan.frontR);
      hw *= plan.front + (1 - plan.front) * Math.pow(1 - Math.pow(1 - t, 2.4), 1 / 2.4);
    }
    if (u > L - plan.rearR) {
      const t = Math.max(0, (L - u) / plan.rearR);
      hw *= plan.rear + (1 - plan.rear) * Math.pow(1 - Math.pow(1 - t, 2.4), 1 / 2.4);
    }
    return hw;
  };

  const archAt = (u) => {
    let y = -Infinity;
    for (const ua of [uF, uR]) {
      const d = u - ua;
      if (Math.abs(d) < archR) y = Math.max(y, wheelR + Math.sqrt(archR * archR - d * d));
    }
    return y;
  };

  // fenders rise over the wheels when the hood/deck line is lower than the arch
  const fenderLift = (u) => {
    let lift = 0;
    for (const ua of [uF, uR]) {
      const need = archTop + (b.fenderClear ?? 0.06) - topF(ua);
      if (need > 0) lift = Math.max(lift, need * bump((u - ua) / (archR * 1.75)));
    }
    return lift;
  };

  const hwTopAt = (u) => {
    const yb = botF(u), yt = topF(u);
    return hwAt(u) - sec.tumble * (yt - yb);
  };

  const beltHalf = (u) => {
    const yb = botF(u), yt = topF(u);
    const rs = Math.min(sec.rs, (yt - yb) * 0.4);
    return hwTopAt(u) - rs * 0.75 - cab.inset;
  };

  const roofY = b.roof ? Math.max(...b.roof.map((p) => p[1])) : b.H;
  return { b, L, W, sec, plan, cab, uF, uR, wheelR, archR, archTop, topF, botF, roofF, roofY, wellD, hwAt, archAt, fenderLift, hwTopAt, beltHalf, z: (u) => L / 2 - u };
}

// ---------------------------------------------------------------- lower body

const HALF = 24; // points per half ring, including both centers
export const RING = HALF * 2 - 1; // 47 (first == last at the bottom seam)
// semantic index ranges in the half ring (for painters)
export const IDX = { bottomEnd: 3, cornerEnd: 6, sideEnd: 12, shoulderEnd: 19, top: 23 };

function halfSection(S, u) {
  const { sec } = S;
  const yb = S.botF(u);
  const yt = S.topF(u);
  const hw = S.hwAt(u);
  const h = Math.max(0.05, yt - yb);
  const rb = Math.min(sec.rb, h * 0.22);
  const rs = Math.min(sec.rs, h * 0.4);
  const hwTop = hw - sec.tumble * h;
  const pts = [];
  // bottom (4): center, well inner pair, corner start
  pts.push([0, yb]);
  pts.push([Math.max(0.02, hw - S.wellD - 0.012), yb]);
  pts.push([Math.max(0.03, hw - S.wellD + 0.012), yb]);
  pts.push([hw - rb, yb]);
  // bottom corner (3)
  for (let i = 1; i <= 3; i++) {
    const a = -Math.PI / 2 + (i / 3) * (Math.PI / 2);
    pts.push([hw - rb + Math.cos(a) * rb, yb + rb + Math.sin(a) * rb]);
  }
  // side (6 interior)
  const ys0 = yb + rb, ys1 = yt - rs;
  for (let i = 1; i <= 6; i++) {
    const s = i / 7;
    pts.push([lerp(hw, hwTop, s) + sec.bulge * Math.sin(Math.PI * s), lerp(ys0, ys1, s)]);
  }
  // shoulder (7: 0°..90°)
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push([hwTop - rs + Math.cos(a) * rs, ys1 + Math.sin(a) * rs]);
  }
  // top (3 interior + center)
  const xt = hwTop - rs;
  for (let i = 1; i <= 3; i++) {
    const f = i / 4;
    const x = xt * (1 - f);
    pts.push([x, yt + sec.crown * (1 - (x / xt) * (x / xt))]);
  }
  pts.push([0, yt + sec.crown]);

  // fender ridges: hood sits a little lower than the fender tops
  const ridge = S.b.fender || 0;
  if (ridge > 0) {
    const fu = u < S.b.cowl ? smooth01(0, 0.25, u) : (u > S.b.deck ? smooth01(S.L, S.b.deck + 0.2, u) * (S.b.deckRidge ?? 0.6) : 0);
    if (fu > 0) {
      const xt = hwTop - rs;
      for (let i = IDX.sideEnd + 1; i < pts.length; i++) {
        const p = pts[i];
        const f = p[0] / Math.max(0.01, xt);
        p[1] += ridge * fu * smooth01(0.55, 0.92, f);
      }
    }
  }
  // fender humps over the wheels
  const lift = S.fenderLift(u);
  if (lift > 0) {
    for (let i = IDX.sideEnd - 2; i < pts.length; i++) {
      const p = pts[i];
      p[1] += lift * smooth01(0.3 * hw, 0.86 * hw, p[0]);
    }
  }
  // wheel arches: clamp everything outboard of the well up to the arch
  const ay = S.archAt(u);
  if (ay > -Infinity) {
    const xin = hw - S.wellD;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p[0] > xin && p[1] < ay) p[1] = ay;
    }
  }
  return pts;
}

function fullRing(half, z, scaleX = 1, cx = 0, cy = 0, k = 0) {
  const ring = [];
  const tf = (p, sgn) => {
    // optional shrink toward (cx, cy) for bevel rings
    const x = sgn * p[0] * scaleX;
    const y = p[1];
    return new THREE.Vector3(lerp(x, cx, k), lerp(y, cy, k), z);
  };
  for (let i = 0; i < HALF; i++) ring.push(tf(half[i], 1));
  for (let i = HALF - 2; i >= 0; i--) ring.push(tf(half[i], -1));
  return ring;
}

/** v texture coordinate per ring index from a reference section's arc length. */
function ringVs(S) {
  const ref = halfSection(S, (S.uF + S.uR) / 2);
  const ring = fullRing(ref, 0);
  const d = [0];
  for (let i = 1; i < ring.length; i++) d.push(d[i - 1] + ring[i].distanceTo(ring[i - 1]) + 1e-4);
  const total = d[d.length - 1];
  return d.map((x) => x / total);
}

export function buildLowerBody(S) {
  const { L } = S;
  // stations
  const st = [];
  for (let u = 0; u <= L + 1e-6; u += 0.075) st.push(u);
  for (const ua of [S.uF, S.uR]) {
    for (let k = -14; k <= 14; k++) st.push(ua + (k / 14) * S.archR * 1.04);
    st.push(ua - S.archR * 1.12, ua + S.archR * 1.12);
  }
  for (const e of [0.004, 0.012, 0.025, 0.045, 0.07, 0.1, 0.14, 0.19]) { st.push(e, L - e); }
  st.push(S.b.cowl, S.b.deck, L);
  st.sort((a, b) => a - b);
  const us = [];
  for (const u of st) {
    if (u < 0 || u > L) continue;
    if (us.length && u - us[us.length - 1] < 0.007) continue;
    us.push(u);
  }
  if (us[us.length - 1] < L) us.push(L);

  const rings = [];
  const tex = [];
  // front bevel rings (beyond u=0, shrinking toward the fascia center)
  const bevel = S.b.bevel ?? [[0.014, 0.05], [0.026, 0.11], [0.034, 0.17]];
  const frontHalf = halfSection(S, 0);
  const fcY = (S.botF(0) + S.topF(0)) / 2;
  for (let i = bevel.length - 1; i >= 0; i--) {
    const [dz, k] = bevel[i];
    rings.push(fullRing(frontHalf, L / 2 + dz, 1, 0, fcY, k * 0.55));
    tex.push(-dz / L);
  }
  for (const u of us) {
    rings.push(fullRing(halfSection(S, u), L / 2 - u));
    tex.push(u / L);
  }
  const rearHalf = halfSection(S, L);
  const rcY = (S.botF(L) + S.topF(L)) / 2;
  for (let i = 0; i < bevel.length; i++) {
    const [dz, k] = bevel[i];
    rings.push(fullRing(rearHalf, -L / 2 - dz, 1, 0, rcY, k * 0.55));
    tex.push(1 + dz / L);
  }
  const vs = ringVs(S);
  const g = loft(rings, tex, vs);
  S.rings = rings;
  fixWinding(g, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, S.topF(L * 0.3) + 0.5, L / 2 - L * 0.3));

  // caps
  const front = rings[0].slice(0, RING - 1);
  const rear = rings[rings.length - 1].slice(0, RING - 1);
  const capFront = makeCap(front, new THREE.Vector3(0, 0, 1), S.b.capBulge ?? 0.025, false);
  const capRear = makeCap(rear, new THREE.Vector3(0, 0, -1), S.b.capBulgeRear ?? 0.02, true);
  return { geometry: g, capFront, capRear, vs, us: tex };
}

function makeCap(outline, dir, push, mirrorU) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of outline) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const uvFn = (p) => {
    let u = (p.x - minX) / (maxX - minX);
    if (mirrorU) u = 1 - u;
    return [u, (p.y - minY) / (maxY - minY)];
  };
  const g = fan(outline, uvFn, dir, push);
  fixWinding(g, dir, outline[0].clone().addScaledVector(dir, 5));
  // outline in cap texture space (0..1), for the painter to clip to
  const shape = outline.map((p) => uvFn(p));
  return { geometry: g, shape, w: maxX - minX, h: maxY - minY, minY, maxY };
}

/** Make sure the face nearest `probe` has a normal agreeing with `want`; flip all if not. */
export function fixWinding(g, want, probe) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - probe.x, dy = pos.getY(i) - probe.y, dz = pos.getZ(i) - probe.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  const n = new THREE.Vector3(nor.getX(best), nor.getY(best), nor.getZ(best));
  if (n.dot(want) < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
  }
}

// ---------------------------------------------------------------- cabin

const CHALF = 15;
export const CRING = CHALF * 2 - 1; // 29
export const CIDX = { sideEnd: 5, cornerEnd: 10, top: 14 };

function cabinHalf(S, u) {
  const { cab } = S;
  const yb = S.topF(u) - 0.004;
  const ytop = Math.max(yb + 0.002, S.roofF(u));
  const h = ytop - yb;
  const hwB = S.beltHalf(u);
  const fullH = Math.max(0.2, S.roofY - S.topF((S.b.cowl + S.b.deck) / 2));
  const hwR = hwB - cab.tumble * Math.min(1.2, h / fullH);
  const rr = Math.min(cab.rr, h * 0.45);
  const pts = [];
  // side: s = 0..5/6 (6 points from the belt)
  for (let i = 0; i < 6; i++) {
    const s = i / 6;
    pts.push([lerp(hwB, hwR, s) + cab.bulge * Math.sin(Math.PI * s), lerp(yb, ytop - rr, s)]);
  }
  // corner 0°..90° (5)
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push([hwR - rr + Math.cos(a) * rr, ytop - rr + Math.sin(a) * rr]);
  }
  // roof (3 interior + center)
  const xt = Math.max(0.01, hwR - rr);
  for (let i = 1; i <= 3; i++) {
    const f = i / 4;
    const x = xt * (1 - f);
    pts.push([x, ytop + cab.crown * (1 - (x / xt) * (x / xt)) * Math.min(1, h / 0.25)]);
  }
  pts.push([0, ytop + cab.crown * Math.min(1, h / 0.25)]);
  return pts;
}

export function buildCabin(S) {
  const b = S.b;
  const u0 = b.cowl, u1 = b.deck;
  const st = [];
  for (let u = u0; u <= u1 + 1e-6; u += 0.045) st.push(u);
  // extra density where the roof bends
  for (const [ru] of b.roof) for (let k = -3; k <= 3; k++) st.push(ru + k * 0.02);
  st.push(u1);
  st.sort((a, c) => a - c);
  const us = [];
  for (const u of st) {
    if (u < u0 || u > u1) continue;
    if (us.length && u - us[us.length - 1] < 0.01) continue;
    us.push(u);
  }
  if (us[us.length - 1] < u1 - 1e-4) us.push(u1);
  const rings = [], tex = [];
  for (const u of us) {
    const half = cabinHalf(S, u);
    const ring = [];
    const z = S.z(u);
    for (let i = 0; i < CHALF; i++) ring.push(new THREE.Vector3(half[i][0], half[i][1], z));
    for (let i = CHALF - 2; i >= 0; i--) ring.push(new THREE.Vector3(-half[i][0], half[i][1], z));
    rings.push(ring);
    tex.push((u - u0) / (u1 - u0));
  }
  // v by arc length at the roof's widest ring
  const mid = cabinHalf(S, (b.roof[2]?.[0] ?? (u0 + u1) / 2) + 0.15);
  const ringPts = [];
  for (let i = 0; i < CHALF; i++) ringPts.push(mid[i]);
  for (let i = CHALF - 2; i >= 0; i--) ringPts.push([-mid[i][0], mid[i][1]]);
  const d = [0];
  for (let i = 1; i < ringPts.length; i++) d.push(d[i - 1] + Math.hypot(ringPts[i][0] - ringPts[i - 1][0], ringPts[i][1] - ringPts[i - 1][1]) + 1e-4);
  const vs = d.map((x) => x / d[d.length - 1]);
  const g = loft(rings, tex, vs);
  const roofU = (b.roof[2]?.[0] ?? (u0 + u1) / 2) + 0.1;
  fixWinding(g, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 5, S.z(roofU)));
  return { geometry: g, vs, us: tex };
}

/** Surface point helpers for placing parts. */
export function bodyPoint(S, u, side = 1, which = 'shoulder') {
  const half = halfSection(S, u);
  const i = which === 'shoulder' ? IDX.sideEnd + 3 : which === 'side' ? 9 : which === 'top' ? IDX.top : 5;
  const p = half[i];
  return new THREE.Vector3(side * p[0], p[1], S.z(u));
}

// ---------------------------------------------------------------- projection

function polyDist(ring, x, y) {
  // signed distance from (x,y) to a closed ring polygon (negative inside)
  let inside = false;
  let best = Infinity;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y + 1e-12) + a.x) inside = !inside;
    const ex = b.x - a.x, ey = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / (ex * ex + ey * ey + 1e-12)));
    const dx = a.x + ex * t - x, dy = a.y + ey * t - y;
    best = Math.min(best, dx * dx + dy * dy);
  }
  const d = Math.sqrt(best);
  return inside ? -d : d;
}

/**
 * Where does a ray along -z (front) / +z (rear) at (x, y) first hit the hull?
 * Returns z, or null if the point misses the silhouette.
 */
export function projectZ(S, x, y, front = true) {
  const R = S.rings;
  const n = R.length;
  const order = front ? [...Array(n).keys()] : [...Array(n).keys()].reverse();
  let prevD = null, prevZ = null;
  for (let k = 0; k < Math.min(n, 60); k++) {
    const ring = R[order[k]];
    const d = polyDist(ring, x, y);
    const z = ring[0].z;
    if (d <= 0) {
      if (prevD === null) {
        // on the fascia cap: slight bulge toward the center
        const bul = front ? (S.b.capBulge ?? 0.025) : -(S.b.capBulgeRear ?? 0.02);
        return z + bul * Math.min(1, -d / 0.25);
      }
      const t = prevD / (prevD - d);
      return prevZ + (z - prevZ) * t;
    }
    prevD = d;
    prevZ = z;
  }
  return null;
}

/**
 * A conforming patch over the front/rear silhouette box [x0,x1]×[y0,y1]
 * (car's +x side; mirror for the other). UVs follow the box so the light
 * graphic is drawn in plain front-view coordinates.
 */
export function projectedPatch(S, x0, x1, y0, y1, front = true, side = 1, nx = 12, ny = 7, lift = 0.006) {
  const pos = [], uv = [], idx = [];
  const dir = front ? 1 : -1;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const fx = i / nx, fy = j / ny;
      const ax = x0 + (x1 - x0) * fx, y = y0 + (y1 - y0) * fy;
      let z = projectZ(S, ax, y, front);
      if (z === null) z = projectZ(S, ax * 0.96, y, front) ?? (front ? S.L / 2 : -S.L / 2);
      pos.push(side * ax, y, z);
      uv.push(fx, fy);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  fixWinding(g, new THREE.Vector3(0, 0, dir), new THREE.Vector3(side * (x0 + x1) / 2, (y0 + y1) / 2, dir * 10));
  // nudge every vertex out along its normal so lights sit proud of the paint
  const p = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + nrm.getX(i) * lift, p.getY(i) + nrm.getY(i) * lift, p.getZ(i) + nrm.getZ(i) * lift);
  }
  return g;
}
