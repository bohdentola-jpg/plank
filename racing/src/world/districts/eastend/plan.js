// THE WORKS and EASTSIDE — planning helpers both packs use (headless: no
// THREE meshes, no canvas). frontLots is a quicker P.lots: it finds how deep
// a lot can go by walking three lines back from its front through the
// occupancy grid, then checks the footprint once (P.lots tries every depth).
import { ROAD, ITEM, RESERVED } from '../occ.js';

/**
 * Lots along the roads (both sides unless o.sides), fronting the sidewalk:
 * o: { roads(filter), width: fn(P, road) | [a, b], depth: [min, max],
 * gap: [a, b], setback: [a, b] | fn(P, road), ends, pad, test(x, z, road) }
 * → [{ x, z, w, d, ry, road, side, s, setback }] (claimed).
 */
export function frontLots(P, o = {}) {
  const out = [];
  const val = (v, r) => (typeof v === 'function' ? v(P, r) : Array.isArray(v) ? P.range(v[0], v[1]) : v);
  const [dMin, dMax] = o.depth || [12, 30];
  const G = o.gap || [0, 0], SB = o.setback ?? 0, ends = o.ends ?? 3, pad = o.pad ?? 0.4;
  const mask = ROAD | ITEM | RESERVED;
  const occ = P.occ;
  for (const r of P.roads(o.roads)) {
    const reach = r.rt.hw + r.rt.shoulder + r.rt.walk + 0.4;
    for (const sd of o.sides || [1, -1]) {
      let s = (r.closed ? 0 : r.trim0) + ends;
      const s1 = r.closed ? r.length : r.length - r.trim1 - ends;
      let guard = 0;
      while (s < s1 && guard++ < 2000) {
        const w = val(o.width || [12, 24], r);
        if (s + w > s1) break;
        const p = r.posAt(s + w / 2);
        const i = p.i;
        const lx = r.LX[i] * sd, lz = r.LZ[i] * sd, tx = r.TX[i], tz = r.TZ[i];
        const sb = val(SB, r);
        const f0 = reach + sb;
        // how deep is it free, along the lot's two sides and its middle?
        let dFree = dMax;
        for (const a of [-w / 2 + 0.6, 0, w / 2 - 0.6]) {
          const bx = p.x + tx * a, bz = p.z + tz * a;
          for (let d = 1.5; d <= dFree + 0.01; d += 2) {
            const px = bx + lx * (f0 + d), pz = bz + lz * (f0 + d);
            if ((occ.get(px, pz) & mask) || !P.inside(px, pz)) { dFree = Math.min(dFree, d - 1.6 - pad); break; }
          }
          if (dFree < dMin) break;
        }
        if (dFree < dMin) { s += 3; continue; }
        const d = Math.floor(dFree);
        const off = f0 + d / 2;
        const x = p.x + lx * off, z = p.z + lz * off, ry = Math.atan2(-lx, -lz);
        if ((!o.test || o.test(x, z, r)) && P.isFree(x, z, w, d, ry, { pad, front: sb < 1.5 ? 1.6 - sb : 0 })) {
          P.claim(x, z, w, d, ry);
          out.push({ x, z, w, d, ry, road: r, side: sd, s: s + w / 2, setback: sb });
          s += w + val(G, r);
        } else s += 3;
      }
    }
  }
  return out;
}

/** A local frame's point → world (box convention), without allocating a Frame. */
export function lp(x, z, ry, lx, lz) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}
