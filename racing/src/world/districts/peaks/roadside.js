// PORT HALCYON — the mountains' roadside: what stands along a mountain road
// in each district, placed per cell (in scatter) by walking the cell's own
// road samples, so it is deterministic and costs nothing until a cell is
// near: chevron boards round the tight bends, curve mirrors at the hairpins,
// a line of poles (Kaido's utility poles and their wires, the Summit's snow
// poles, delineators), and where the road is cut into the hillside a dressed
// slope over the cutting (Kaido's lattice frames, snowy rock, log cribbing).
import { cellRuns, isCountryRoad } from './util.js';

/**
 * Walk a cell's country roads inside the district: fn(road, i, s) for every
 * owned sample (its centre in the cell, inside the district).
 */
export function eachOwnedSample(S, fn, filter = isCountryRoad) {
  for (const run of cellRuns(S.net, S.cx, S.cz, filter)) {
    const r = run.road;
    for (let i = run.i0; i <= run.i1; i++) {
      if (!S.inside(r.X[i], r.Z[i])) continue;
      fn(r, i, r.S[i]);
    }
  }
}

const reachOf = (r) => r.rt.hw + r.rt.shoulder + r.rt.walk;
// trimmed ends (junction paving) are left alone
const inBody = (r, s, pad = 4) => s > r.trim0 + pad && s < r.length - r.trim1 - pad;

/**
 * Chevron boards on the outside of tight bends (radius under rMax), every
 * `every` m, and one curve mirror at each hairpin's apex. Returns items.
 */
export function bends(S, o = {}) {
  const out = [];
  const rMax = o.rMax ?? 60, every = o.every ?? 13, hairpin = o.hairpin ?? 34;
  const seenApex = new Set();
  eachOwnedSample(S, (r, i, s) => {
    if (!inBody(r, s, 10)) return;
    const k = r.Ks[i];
    if (Math.abs(k) < 1 / rMax) return;
    const out1 = k > 0 ? -1 : 1;           // the outside of the bend
    const lat = out1 * (reachOf(r) + 1.1);
    if (Math.floor(s / every) !== Math.floor((s - r.step) / every)) {
      out.push({ type: 'chev', x: r.X[i] + r.LX[i] * lat, z: r.Z[i] + r.LZ[i] * lat, y: r.roadY(i, 0, out1 * r.rt.hw), ry: Math.atan2(-r.TX[i], -r.TZ[i]), cell: k > 0 ? 1 : 0 });
    }
    // the apex of a hairpin: the sharpest sample of its run of tight samples
    if (o.mirrors && Math.abs(k) > 1 / hairpin) {
      const a = Math.max(0, i - 8), b = Math.min(r.N - 1, i + 8);
      let best = i;
      for (let j = a; j <= b; j++) if (Math.abs(r.Ks[j]) > Math.abs(r.Ks[best])) best = j;
      if (best === i && !seenApex.has(r.ri * 1e6 + i)) {
        seenApex.add(r.ri * 1e6 + i);
        const ml = out1 * (reachOf(r) + 1.6);
        // the mirror faces back into the bend (toward its centre)
        out.push({ type: 'mirror', x: r.X[i] + r.LX[i] * ml, z: r.Z[i] + r.LZ[i] * ml, y: r.roadY(i, 0, out1 * r.rt.hw), ry: Math.atan2(-out1 * r.LX[i], -out1 * r.LZ[i]) });
      }
    }
  });
  return out;
}

/**
 * A line of poles along the roads every `every` m (by distance along the
 * road, so it carries on seamlessly across cells), on `side` (+1 left, −1
 * right, 0 alternating per road), `off` m past the road's edge. Each item
 * knows where the next pole stands (for wires). type: the item type.
 */
export function poles(S, type, o = {}) {
  const out = [];
  const every = o.every ?? 36, off = o.off ?? 2.2;
  eachOwnedSample(S, (r, i, s) => {
    if (!inBody(r, s, 6)) return;
    if (Math.floor(s / every) === Math.floor((s - r.step) / every)) return;
    const k = Math.floor(s / every);
    const sides = o.both ? [1, -1] : [o.side || (r.ri % 2 ? 1 : -1)];
    for (const sd of sides) {
      const lat = sd * (reachOf(r) + off);
      const x = r.X[i] + r.LX[i] * lat, z = r.Z[i] + r.LZ[i] * lat;
      if (o.free && !S.free(x, z, 1.5, false)) continue;
      const it = { type, x, z, y: r.roadY(i, 0, sd * r.rt.hw), ry: Math.atan2(r.TX[i], r.TZ[i]), k, sd };
      if (o.wires) {
        // the next pole stands one spacing on (at the same offset from its mark)
        const s2 = s + every;
        if (s2 < r.length - r.trim1 - 6) {
          const p = r.posAt(s2, lat);
          it.nx = p.x; it.nz = p.z; it.ny = r.roadY(p.i, p.t, sd * r.rt.hw);
        }
      }
      out.push(it);
    }
  });
  return out;
}

/**
 * Where a road is cut into the hillside (the ground rises `minRise` m within
 * a few metres of its edge), runs of samples per side for a dressed slope:
 * items { type, road (index), i0, i1, sd, x, z } — the cell owning their
 * first sample builds them.
 */
export function cuts(S, type, o = {}) {
  const out = [];
  const minRise = o.minRise ?? 3.5, minLen = o.minLen ?? 8;
  const gy = S.groundY;
  for (const run of cellRuns(S.net, S.cx, S.cz, o.filter || isCountryRoad)) {
    const r = run.road;
    if (r.flags[run.i0] & 3) continue;
    const off = reachOf(r) + 7, hw = r.rt.hw;
    for (const sd of [1, -1]) {
      let start = -1;
      const flush = (end) => {
        if (start >= 0 && end - start + 1 >= minLen) {
          out.push({ type, road: r.ri, i0: start, i1: end, sd, x: r.X[start], z: r.Z[start] });
        }
        start = -1;
      };
      for (let i = run.i0; i <= run.i1; i++) {
        let cut = false;
        if (inBody(r, r.S[i], 2) && !(r.flags[i] & 3) && S.inside(r.X[i], r.Z[i])) {
          const x = r.X[i] + r.LX[i] * sd * off, z = r.Z[i] + r.LZ[i] * sd * off;
          cut = gy(x, z) - r.roadY(i, 0, sd * hw) > minRise;
        }
        if (cut) { if (start < 0) start = i; } else flush(i - 1);
      }
      flush(run.i1);
    }
  }
  return out;
}

/**
 * Build a dressed cut: a sheet draped over the graded slope beside the road
 * from just past its edge up the cutting (until the ground stops rising or
 * `maxW` m out), uv in metres / tile. acc: the slope material's accumulator.
 */
export function drapeCut(B, acc, it, o = {}) {
  const r = B.net.roads[it.road];
  if (!r) return;
  const sd = it.sd, reach = reachOf(r);
  const tile = o.tile ?? 4, maxW = o.maxW ?? 34, step = o.step ?? 3, lift = o.lift ?? 0.12;
  const i1 = Math.min(r.N - 1, it.i1 + 1);
  const cols = Math.ceil(maxW / step) + 1;
  const rows = [];
  for (let i = it.i0; i <= i1; i += 2) rows.push(i);
  if (rows[rows.length - 1] !== i1) rows.push(i1);
  const base = acc.count;
  // per column: lateral offset; per row: stop where the slope tops out
  for (const i of rows) {
    const ey = r.roadY(i, 0, sd * r.rt.hw);
    let prevH = ey;
    for (let c = 0; c < cols; c++) {
      const lat = sd * (reach + 0.9 + c * step);
      const x = r.X[i] + r.LX[i] * lat, z = r.Z[i] + r.LZ[i] * lat;
      let h = B.groundY(x, z);
      // past the top of the cutting the sheet lies down flat (hidden under the ground)
      if (h < prevH - 0.05) h = prevH - 0.3;
      prevH = Math.max(prevH, h);
      acc.v(x, h + lift, z, (c * step) / tile, r.S[i] / tile);
    }
  }
  for (let k = 0; k < rows.length - 1; k++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = base + k * cols + c, b = a + 1, d = a + cols, e = d + 1;
      // facing up and toward the road: wind by side
      if (sd > 0) { acc.tri(a, d, b); acc.tri(b, d, e); } else { acc.tri(a, b, d); acc.tri(b, e, d); }
    }
  }
}
