// Small 2D helpers for the sim (ground plane x/z). No three.js.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const sq = (v) => v * v;

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** heading convention: atan2(dx, dz) — 0 faces +z, π/2 faces +x */
export const headingOf = (dx, dz) => Math.atan2(dx, dz);
export const dirOf = (h) => ({ x: Math.sin(h), z: Math.cos(h) });

export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const dist2 = (a, b) => sq(a.x - b.x) + sq(a.z - b.z);
export const len = (x, z) => Math.hypot(x, z);

export function norm(x, z) {
  const l = Math.hypot(x, z);
  return l > 1e-9 ? { x: x / l, z: z / l, l } : { x: 0, z: 0, l: 0 };
}

/** Turn `cur` toward `target` by at most `maxStep` radians. */
export function turnToward(cur, target, maxStep) {
  const d = wrapAngle(target - cur);
  if (Math.abs(d) <= maxStep) return target;
  return wrapAngle(cur + Math.sign(d) * maxStep);
}

/**
 * Earliest time t ≥ 0 at which a pursuer starting at p with top speed s can
 * meet a target at q moving with constant velocity v. Returns { t, x, z } or
 * null when it can't catch up.
 */
export function intercept(p, s, q, v) {
  const dx = q.x - p.x, dz = q.z - p.z;
  const a = v.x * v.x + v.z * v.z - s * s;
  const b = 2 * (dx * v.x + dz * v.z);
  const c = dx * dx + dz * dz;
  let t;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) < 1e-9) return null;
    t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const r = Math.sqrt(disc);
    const t1 = (-b - r) / (2 * a), t2 = (-b + r) / (2 * a);
    t = Math.min(t1, t2) >= 0 ? Math.min(t1, t2) : Math.max(t1, t2);
  }
  if (!(t >= 0) || !isFinite(t)) return null;
  return { t, x: q.x + v.x * t, z: q.z + v.z * t };
}

/** Closest point on segment ab to p, and the parameter. */
export function closestOnSeg(p, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z;
  const l2 = abx * abx + abz * abz;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2 : 0;
  t = clamp(t, 0, 1);
  return { x: a.x + abx * t, z: a.z + abz * t, t };
}

/**
 * Seconds for player e to get within `reach` of (x, z), given where he is,
 * which way and how fast he's already moving, how quick he is and how fast
 * he can get going. Turning back the other way costs a plant.
 */
export function timeToReach(e, x, z, reach = 0.6) {
  const dx = x - e.x, dz = z - e.z;
  const dRaw = Math.hypot(dx, dz);
  const d = Math.max(0, dRaw - reach - e.radius);
  if (d <= 0) return 0;
  const sp = Math.hypot(e.vx, e.vz);
  const nx = dx / dRaw, nz = dz / dRaw;
  const toward = sp > 0.1 ? (e.vx * nx + e.vz * nz) : 0;
  let v0 = Math.max(0, toward);
  let extra = 0;
  // going the wrong way: brake, plant, turn (more time the faster he was going)
  if (sp > 1 && toward < sp * 0.3) extra = 0.18 + (sp - Math.max(0, toward)) / Math.max(6, e.brake || 10);
  const vmax = e.vTop || 9, a = Math.max(3, (e.a0 || 8) * 0.75);
  const ta = Math.max(0, (vmax - v0) / a);
  const da = (v0 + vmax) / 2 * ta;
  let t;
  if (d <= da) t = (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a;
  else t = ta + (d - da) / vmax;
  return t + extra;
}
