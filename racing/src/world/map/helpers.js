// Map authoring helpers. An AREA is { id, nodes: { id: [x, z, y?] }, roads:
// [ spec ] } where a road spec is
//   { id, type, a: nodeId, b: nodeId, pts?: [[x, z, r?, y?], ...] (between
//     the nodes), radius?, name?, elevated?: [[s0, s1, h]] (m along the
//     road, deck height over the ground), bridge?: [[s0, s1, y?]] (forced
//     deck), noBridge?, tunnel?: [[s0, s1]], profile?: 'terrain'|'flat'|'pts',
//     clear?: deck clearance over water }
// Junctions are only ever at nodes: roads that cross at the same level must
// share a node there (the validator reports ones that don't).
import { rot } from '../geom.js';

/**
 * A street grid. cols/rows: offsets (m) of the street lines from the origin
 * along the grid's own axes (u east-ish, v south-ish, rotated by `angle`).
 * colType / rowType: road type per line (function of index or a string).
 * skip(kind, i, j) → true leaves out the segment from (i, j) to the next
 * node along that line ('h' runs along u, 'v' along v). Node ids are
 * `${id}_${i}_${j}`; road ids `${id}_h_${i}_${j}` / `${id}_v_${i}_${j}`.
 */
export function grid(id, o) {
  const nodes = {};
  const roads = [];
  const at = (i, j) => {
    const [dx, dz] = rot(o.cols[i], o.rows[j], o.angle || 0);
    return [o.x + dx, o.z + dz];
  };
  const keep = (i, j) => !o.hole || !o.hole(i, j);
  for (let i = 0; i < o.cols.length; i++) for (let j = 0; j < o.rows.length; j++) if (keep(i, j)) nodes[`${id}_${i}_${j}`] = at(i, j);
  // (types can depend on both the line and the segment along it: a column
  // that is an avenue downtown narrows to a street further on)
  const typeOf = (t, k, m) => (typeof t === 'function' ? t(k, m) : t);
  for (let j = 0; j < o.rows.length; j++) {
    for (let i = 0; i < o.cols.length - 1; i++) {
      if (!keep(i, j) || !keep(i + 1, j)) continue;
      if (o.skip && o.skip('h', i, j)) continue;
      const type = typeOf(o.rowType, j, i);
      if (!type) continue;
      roads.push({ id: `${id}_h_${i}_${j}`, type, a: `${id}_${i}_${j}`, b: `${id}_${i + 1}_${j}`, name: o.rowNames?.[j], district: o.district });
    }
  }
  for (let i = 0; i < o.cols.length; i++) {
    for (let j = 0; j < o.rows.length - 1; j++) {
      if (!keep(i, j) || !keep(i, j + 1)) continue;
      if (o.skip && o.skip('v', i, j)) continue;
      const type = typeOf(o.colType, i, j);
      if (!type) continue;
      roads.push({ id: `${id}_v_${i}_${j}`, type, a: `${id}_${i}_${j}`, b: `${id}_${i}_${j + 1}`, name: o.colNames?.[i], district: o.district });
    }
  }
  return { nodes, roads };
}

/** Even offsets: n lines `pitch` apart starting at 0. */
export const lines = (n, pitch, start = 0) => Array.from({ length: n }, (_, k) => start + k * pitch);

/** Merge areas' nodes and roads (later ones may not reuse ids). */
export function merge(...parts) {
  const out = { nodes: {}, roads: [], landmarks: [], courses: {} };
  for (const p of parts) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p.nodes || {})) {
      if (out.nodes[k]) throw new Error(`node ${k} defined twice`);
      out.nodes[k] = v;
    }
    out.roads.push(...(p.roads || []));
    out.landmarks.push(...(p.landmarks || []));
    Object.assign(out.courses, p.courses || {});
  }
  return out;
}

/** Points along a circular arc (for authoring curves): center, radius, a0→a1 (radians, math angle in x/z). */
export function arcPts(cx, cz, r, a0, a1, n = 8) {
  const out = [];
  for (let k = 1; k < n; k++) {
    const a = a0 + (a1 - a0) * (k / n);
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
}
