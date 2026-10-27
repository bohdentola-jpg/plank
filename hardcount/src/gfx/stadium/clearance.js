// Where the broadcast cameras can stand. Big stadiums build their stands right
// behind the sidelines, and a camera placed by the yard (the press box angle,
// the reverse angle, the end zone) can land inside the concrete: the picture
// fills with seat backs, beams and railings. Once per venue the structure's
// triangles are binned into columns on a two-yard grid, and every frame the
// shot's line of sight, from the play out to the lens, is traced through them.
// A high camera with something solid in the way first climbs over it (the way
// the press box looks down past the rows in front of it); failing that, any
// camera comes in along the line of sight to stand in open air in front of it.
// Thin things (a light pole, a truss, a rail) are let through: a real camera
// shoots past them, and a lens that dollied in and out every time one swept
// across the picture would be worse.
import * as THREE from 'three';

/**
 * Build the clearance test for a venue.
 *   root: the venue's group; skip: objects to leave out (the field, the sideline, the crowd…)
 *   half: the area the cameras can be in, |x| and |z| (yards)
 * Returns { clearView(look, cam, opts) → distance ratio (1 = untouched; cam is moved),
 *           blockedAt(look, cam) → how far out from look the line of sight is blocked (Infinity: clear),
 *           tris: how many triangles it traces against }.
 */
export function buildClearance(root, { skip = [], cell = 2, half = [170, 190] } = {}) {
  root.updateMatrixWorld(true);
  const skipSet = new Set(skip.filter(Boolean));

  // ---- the solid triangles, in world space: a corner and the two edges from it
  let tri = new Float32Array(9 * 32768), n = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const M = new THREE.Matrix4(), IM = new THREE.Matrix4();
  const addMesh = (o) => {
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    if (!pos) return;
    const count = idx ? idx.count : pos.count;
    const insts = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < insts; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, IM); M.multiplyMatrices(o.matrixWorld, IM); } else M.copy(o.matrixWorld);
      for (let i = 0; i + 2 < count; i += 3) {
        a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(M);
        b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(M);
        c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(M);
        if (Math.min(a.x, b.x, c.x) > half[0] || Math.max(a.x, b.x, c.x) < -half[0] ||
            Math.min(a.z, b.z, c.z) > half[1] || Math.max(a.z, b.z, c.z) < -half[1]) continue;
        if (9 * (n + 1) > tri.length) { const t = new Float32Array(tri.length * 2); t.set(tri); tri = t; }
        const q = 9 * n++;
        tri[q] = a.x; tri[q + 1] = a.y; tri[q + 2] = a.z;
        tri[q + 3] = b.x - a.x; tri[q + 4] = b.y - a.y; tri[q + 5] = b.z - a.z;
        tri[q + 6] = c.x - a.x; tri[q + 7] = c.y - a.y; tri[q + 8] = c.z - a.z;
      }
    }
  };
  // light itself doesn't block a lens: beams, glows, haze and anything else see-through
  const walk = (o) => {
    if (!o.visible || skipSet.has(o)) return;
    if (o.isMesh) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!(m && (m.transparent || m.blending !== THREE.NormalBlending || m.depthWrite === false))) addMesh(o);
    }
    for (const ch of o.children) walk(ch);
  };
  walk(root);

  // ---- binned into columns by their footprint (a big triangle sits in every column it covers)
  const x0 = -half[0], z0 = -half[1];
  const NX = Math.ceil((2 * half[0]) / cell), NZ = Math.ceil((2 * half[1]) / cell);
  const colRange = (q, out) => {
    const ax = tri[q], az = tri[q + 2];
    const bx = ax + tri[q + 3], bz = az + tri[q + 5], cx = ax + tri[q + 6], cz = az + tri[q + 8];
    out[0] = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / cell));
    out[1] = Math.min(NX - 1, Math.floor((Math.max(ax, bx, cx) - x0) / cell));
    out[2] = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / cell));
    out[3] = Math.min(NZ - 1, Math.floor((Math.max(az, bz, cz) - z0) / cell));
  };
  const start = new Int32Array(NX * NZ + 1);
  const r = [0, 0, 0, 0];
  for (let t = 0; t < n; t++) {
    colRange(9 * t, r);
    for (let j = r[2]; j <= r[3]; j++) for (let i = r[0]; i <= r[1]; i++) start[j * NX + i + 1]++;
  }
  for (let k = 0; k < NX * NZ; k++) start[k + 1] += start[k];
  const items = new Int32Array(start[NX * NZ]);
  const fill = start.slice(0, NX * NZ);
  for (let t = 0; t < n; t++) {
    colRange(9 * t, r);
    for (let j = r[2]; j <= r[3]; j++) for (let i = r[0]; i <= r[1]; i++) items[fill[j * NX + i]++] = t;
  }
  const seen = new Int32Array(n);
  let stamp = 0;

  // the ray o + d·t (d unit) against triangle t, either face (Möller–Trumbore)
  const rayTri = (t, ox, oy, oz, dx, dy, dz) => {
    const q = 9 * t;
    const e1x = tri[q + 3], e1y = tri[q + 4], e1z = tri[q + 5], e2x = tri[q + 6], e2y = tri[q + 7], e2z = tri[q + 8];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-9 && det < 1e-9) return Infinity;
    const inv = 1 / det;
    const sx = ox - tri[q], sy = oy - tri[q + 1], sz = oz - tri[q + 2];
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) return Infinity;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) return Infinity;
    return (e2x * qx + e2y * qy + e2z * qz) * inv;
  };

  /** The first t in [tA, tB] where o + d·t meets the structure, or Infinity. Walks the columns in order. */
  function hit(ox, oy, oz, dx, dy, dz, tA, tB) {
    if (++stamp > 2e9) { seen.fill(0); stamp = 1; }
    const px = ox + dx * tA, pz = oz + dz * tA;
    let i = Math.floor((px - x0) / cell), j = Math.floor((pz - z0) / cell);
    const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
    const ex = Math.abs(dx) > 1e-9, ez = Math.abs(dz) > 1e-9;
    let tx = ex ? tA + (x0 + (i + (dx > 0 ? 1 : 0)) * cell - px) / dx : Infinity;
    let tz = ez ? tA + (z0 + (j + (dz > 0 ? 1 : 0)) * cell - pz) / dz : Infinity;
    const stx = ex ? cell / Math.abs(dx) : Infinity, stz = ez ? cell / Math.abs(dz) : Infinity;
    let best = Infinity;
    for (;;) {
      const tOut = Math.min(tx, tz, tB);
      if (i >= 0 && j >= 0 && i < NX && j < NZ) {
        const col = j * NX + i;
        for (let k = start[col], e = start[col + 1]; k < e; k++) {
          const t = items[k];
          if (seen[t] === stamp) continue;
          seen[t] = stamp;
          const h = rayTri(t, ox, oy, oz, dx, dy, dz);
          if (h >= tA && h <= tB && h < best) best = h;
        }
      }
      // anything met further on sits in a later column, so a hit inside this one is the first
      if (best <= tOut || tOut >= tB) return best;
      if (tx < tz) { i += si; tx += stx; } else { j += sj; tz += stz; }
    }
  }

  // is what the line of sight met at t thin? Sight lines a yard and a half to either
  // side get round a post; ones above and below it both get past a beam or a rail
  const S = new THREE.Vector3(), U = new THREE.Vector3();
  function thin(look, d, t, len) {
    S.set(-d.z, 0, d.x);
    if (S.lengthSq() < 1e-8) S.set(1, 0, 0);
    S.normalize();
    U.crossVectors(S, d).normalize();
    const W = 1.6, tA = Math.max(0.5, t - 3);
    const clear = (v, k) => hit(look.x + v.x * k, look.y + v.y * k, look.z + v.z * k, d.x, d.y, d.z, tA, len) === Infinity;
    return clear(S, W) || clear(S, -W) || (clear(U, W) && clear(U, -W));
  }

  const _d = new THREE.Vector3(), _q = new THREE.Vector3();
  /** How far out from `look` the line of sight to P first meets something solid (Infinity: it doesn't). */
  function blockedAt(look, P, extra = 0) {
    if (!n) return Infinity;
    _d.subVectors(P, look);
    const len = _d.length();
    if (len < 1) return Infinity;
    _d.multiplyScalar(1 / len);
    const end = len + extra;
    let t0 = 0.5;
    for (let k = 0; k < 6; k++) {
      const t = hit(look.x, look.y, look.z, _d.x, _d.y, _d.z, t0, end);
      if (t === Infinity || !thin(look, _d, t, end)) return t;
      t0 = t + 0.4;
    }
    return Infinity;
  }
  // a lens needs air around it: nothing just behind it on the line of sight, nothing right under it
  const AIR = 1.5, UNDER = 2.5;
  const roomAt = (look, P) => blockedAt(look, P, AIR) === Infinity && hit(P.x, P.y, P.z, 0, -1, 0, 0, UNDER) === Infinity;

  /**
   * Keep the camera at P (moved in place) out of the structure, looking at `look`.
   *   raise: how much higher a high camera may go to see over what's in the way (yards)
   * Returns the new distance over the old: 1 untouched, under 1 pulled in.
   */
  function clearView(look, P, { margin = 1.2, raise = 0 } = {}) {
    if (!n || roomAt(look, P)) return 1;
    const len0 = look.distanceTo(P);
    if (len0 < 1) return 1;
    for (let up = 2; up <= raise + 1e-6; up += 2) {
      _q.copy(P); _q.y += up;
      if (roomAt(look, _q)) { P.copy(_q); return 1; }
    }
    // in along the line of sight, to stand in front of whatever is in the way
    const t = blockedAt(look, P, AIR);
    const d = Math.max(Math.min(len0, 6), Math.min(len0, t) - margin - AIR);
    _d.subVectors(P, look).normalize();
    P.copy(look).addScaledVector(_d, d);
    return d / len0;
  }

  return { clearView, blockedAt, tris: n };
}
