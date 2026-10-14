// Centerline construction. A track is authored as a polyline of vertices
// [x, z, radius?, y?, halfWidth?]; every vertex gets a circular fillet of the
// given radius (clamped to fit), giving real-road geometry: straights joined
// by constant-radius corners. Elevation/width are interpolated along arc
// length. The result is a dense, evenly spaced sample list.
//
// Heading convention matches the cars: direction d = (dx, dz), left = (dz, −dx).

const STEP = 2.0;

function norm(x, z) {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

/**
 * pts: [[x, z, r, y, w], …]; closed: loop back to the first vertex.
 * Returns { pieces } — a list of {type:'line'|'arc', …} plus vertex anchors.
 */
function fillet(pts, closed, defaultR) {
  const n = pts.length;
  const out = [];
  const anchors = []; // s-position anchors for each vertex's y/w (filled later)
  const get = (i) => pts[(i + n) % n];
  const corners = [];
  for (let i = 0; i < n; i++) {
    const B = get(i);
    if (!closed && (i === 0 || i === n - 1)) {
      corners.push({ i, p1: [B[0], B[1]], p2: [B[0], B[1]], arc: null, B });
      continue;
    }
    const A = get(i - 1), Cc = get(i + 1);
    const d1 = norm(B[0] - A[0], B[1] - A[1]);
    const d2 = norm(Cc[0] - B[0], Cc[1] - B[1]);
    const lenA = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const lenC = Math.hypot(Cc[0] - B[0], Cc[1] - B[1]);
    const dot = Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1]));
    const phi = Math.acos(dot);
    if (phi < 1e-4) {
      corners.push({ i, p1: [B[0], B[1]], p2: [B[0], B[1]], arc: null, B });
      continue;
    }
    // left of d1 = (d1z, -d1x); turning left if d2 leans that way
    const left1 = [d1[1], -d1[0]];
    const turnLeft = d2[0] * left1[0] + d2[1] * left1[1] > 0;
    let r = B[2] ?? defaultR;
    const maxT = Math.min(lenA, lenC) * 0.49;
    let t = r * Math.tan(phi / 2);
    if (t > maxT) { t = maxT; r = t / Math.tan(phi / 2); }
    const p1 = [B[0] - d1[0] * t, B[1] - d1[1] * t];
    const p2 = [B[0] + d2[0] * t, B[1] + d2[1] * t];
    const sgn = turnLeft ? 1 : -1;
    const c = [p1[0] + left1[0] * r * sgn, p1[1] + left1[1] * r * sgn];
    corners.push({ i, p1, p2, arc: { c, r, phi, left: turnLeft, a0: Math.atan2(p1[1] - c[1], p1[0] - c[0]) }, B });
  }
  // assemble: corner arcs with straights between them
  const count = closed ? n : n;
  for (let k = 0; k < count; k++) {
    const cur = corners[k];
    if (cur.arc) out.push({ type: 'arc', ...cur.arc, vertex: k });
    else out.push({ type: 'point', p: cur.p1, vertex: k });
    const nxt = closed ? corners[(k + 1) % n] : corners[k + 1];
    if (!nxt) break;
    out.push({ type: 'line', a: cur.p2, b: nxt.p1 });
  }
  void anchors;
  return out;
}

/**
 * Build dense samples. def: { points, closed, radius, width, startOffset, bank }
 * Returns typed arrays + metadata.
 */
export function buildCenterline(def) {
  const closed = def.closed !== false && def.type !== 'sprint' && def.type !== 'drag';
  const pieces = fillet(def.points, closed, def.radius ?? 40);
  const xs = [], zs = [], ks = [], vtx = [];
  const vertexS = new Array(def.points.length).fill(null);
  let s = 0;
  const push = (x, z, k, vi = -1) => {
    if (xs.length) {
      const dx = x - xs[xs.length - 1], dz = z - zs[zs.length - 1];
      const d = Math.hypot(dx, dz);
      if (d < 1e-6) return;
      s += d;
    }
    xs.push(x); zs.push(z); ks.push(k);
    vtx.push(vi);
  };
  for (const pc of pieces) {
    if (pc.type === 'point') {
      push(pc.p[0], pc.p[1], 0);
      vertexS[pc.vertex] = s;
    } else if (pc.type === 'line') {
      const len = Math.hypot(pc.b[0] - pc.a[0], pc.b[1] - pc.a[1]);
      const n = Math.max(1, Math.ceil(len / STEP));
      for (let i = (xs.length ? 1 : 0); i <= n; i++) {
        const t = i / n;
        push(pc.a[0] + (pc.b[0] - pc.a[0]) * t, pc.a[1] + (pc.b[1] - pc.a[1]) * t, 0);
      }
    } else {
      const { c, r, phi, left, a0 } = pc;
      const len = r * phi;
      const n = Math.max(2, Math.ceil(len / (STEP * 0.75)));
      const k = (left ? 1 : -1) / r;
      // angle direction: left turn = counterclockwise in (x,z)? left of d is (dz,-dx),
      // which is clockwise in standard (x,z) axes → left turns decrease the polar angle
      const dir = left ? -1 : 1;
      for (let i = (xs.length ? 1 : 0); i <= n; i++) {
        const a = a0 + dir * phi * (i / n);
        push(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, k);
        if (i === Math.floor(n / 2)) vertexS[pc.vertex] = s;
      }
    }
  }
  if (closed) {
    // drop the duplicated closing sample if it lands on the first
    const dx = xs[xs.length - 1] - xs[0], dz = zs[zs.length - 1] - zs[0];
    if (Math.hypot(dx, dz) < STEP * 0.5) { xs.pop(); zs.pop(); ks.pop(); vtx.pop(); }
  }
  // resample evenly at STEP
  const raw = xs.length;
  const cum = new Float64Array(raw);
  for (let i = 1; i < raw; i++) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
  const closingLen = closed ? Math.hypot(xs[0] - xs[raw - 1], zs[0] - zs[raw - 1]) : 0;
  const total = cum[raw - 1] + closingLen;
  const N = Math.max(8, Math.round(total / STEP));
  const step = total / (closed ? N : N - 1);
  const X = new Float32Array(N), Z = new Float32Array(N), K = new Float32Array(N), S = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const si = i * step;
    while (j < raw - 1 && cum[j + 1] < si) j++;
    let x0, z0, x1, z1, k0, k1, sa, sb;
    if (j >= raw - 1) {
      x0 = xs[raw - 1]; z0 = zs[raw - 1]; k0 = ks[raw - 1]; sa = cum[raw - 1];
      if (closed) { x1 = xs[0]; z1 = zs[0]; k1 = ks[0]; sb = total; } else { x1 = x0; z1 = z0; k1 = k0; sb = sa + 1; }
    } else {
      x0 = xs[j]; z0 = zs[j]; k0 = ks[j]; sa = cum[j];
      x1 = xs[j + 1]; z1 = zs[j + 1]; k1 = ks[j + 1]; sb = cum[j + 1];
    }
    const t = Math.max(0, Math.min(1, (si - sa) / Math.max(1e-6, sb - sa)));
    X[i] = x0 + (x1 - x0) * t;
    Z[i] = z0 + (z1 - z0) * t;
    K[i] = Math.abs(k0) > Math.abs(k1) ? k0 : k1;
    S[i] = si;
  }
  // scale vertex anchor s to the resampled length
  const scale = total / Math.max(1e-6, s + closingLen);
  const anchorS = vertexS.map((v) => (v === null ? null : v * scale));
  return { X, Z, K, S, N, length: total, closed, anchorS, step };
}

/** Smooth periodic/clamped interpolation of per-vertex values along s. */
export function interpAnchors(anchorS, values, length, closed, N, step, fallback) {
  const pts = [];
  for (let i = 0; i < anchorS.length; i++) {
    if (anchorS[i] === null || values[i] === undefined || values[i] === null) continue;
    pts.push([anchorS[i], values[i]]);
  }
  const out = new Float32Array(N);
  if (!pts.length) { out.fill(fallback); return out; }
  pts.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < N; i++) {
    const s = i * step;
    // find bracketing anchors (with wrap)
    let a = null, b = null;
    for (let k = 0; k < pts.length; k++) {
      if (pts[k][0] <= s) a = pts[k];
      if (pts[k][0] > s) { b = pts[k]; break; }
    }
    if (closed) {
      if (!a) a = [pts[pts.length - 1][0] - length, pts[pts.length - 1][1]];
      if (!b) b = [pts[0][0] + length, pts[0][1]];
    } else {
      if (!a) { out[i] = pts[0][1]; continue; }
      if (!b) { out[i] = pts[pts.length - 1][1]; continue; }
    }
    const t = (s - a[0]) / Math.max(1e-6, b[0] - a[0]);
    const e = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep: flat at anchors
    out[i] = a[1] + (b[1] - a[1]) * e;
  }
  return out;
}

/** Box-filter an array (wrap if closed). */
export function smoothArray(arr, radius, closed, passes = 1) {
  let a = arr;
  const n = a.length;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0, cnt = 0;
      for (let k = -radius; k <= radius; k++) {
        let j = i + k;
        if (closed) j = (j + n) % n;
        else if (j < 0 || j >= n) continue;
        sum += a[j];
        cnt++;
      }
      out[i] = sum / cnt;
    }
    a = out;
  }
  return a;
}
