// PORT HALCYON — drawing a planned building from its recipe (Downtown's
// towers, Uptown's deco towers and hotels share the language). A recipe:
//   { x, z, ry, gy (street level), y0 (foundation), seed, seedV,
//     parts: [{ s, w, d, c, r, n, dx, dz, rot, y0, y1, m, tint, slope, twist, led, lid }],
//     tops:  [{ k, ... }], screens: [...], canopy, base }
// part shapes: 'box' | 'cham' (cut corners) | 'cyl' | 'twist' (stacked,
// turning) | 'wedge' (sloped glass top) | 'pyr' (a pyramid) | 'drum'.
// M (the pack's materials): M.mats[key] (facades: with M.spec[key] = { uw, vh,
// floors }), M.roof, M.metal, M.steel, M.led, M.ledB, M.blink, M.screen, M.sign
// (and the sign atlas' uv lookup M.uv(name)); any of them may be a paint
// (geo.js). M.crownOf[key]: the facade a lit crown key shares its material with.
import { walls, lid, place, chamfer, circle, polyWalls, polyCap, apex, ring, panel, decal, under, toWorld, A } from './geo.js';
import { Builder } from '../builder.js';
import { Batch } from '../../build/geo.js';

/**
 * Rehearse a pack's build at load (its warm()): draw a sample of its own
 * planned items, a few of every kind, into throwaway batches (never
 * flushed, nothing reaches the GPU), so the draw code is compiled before
 * the first cell is built on the road instead of in it. A generator: a
 * slice at a time.
 */
export function* rehearse(B, pack, per = 8, rounds = 2) {
  const D = B.D;
  const byKind = new Map();
  for (const a of D.items.values()) {
    for (const it of a) {
      if (it.pack !== pack.id) continue;
      const k = `${it.type}:${it.kind || it.k || ''}`;
      const l = byKind.get(k) || [];
      if (l.length < (it.type === 'bldg' || it.type === 'row' ? per * 3 : per)) { l.push(it); byKind.set(k, l); }
    }
  }
  const items = [...byKind.values()].flat();
  for (let r = 0; r < rounds; r++) {
    const out = { batch: new Batch(), nearBatch: new Batch(), group: { add() {} }, colliders: [], lamps: [], anims: [] };
    const g = pack.build(new Builder(D, 0, 0, pack, out), items);
    if (g && g[Symbol.iterator]) for (let n = g.next(); !n.done; n = g.next()) yield;
    yield;
  }
}

const WHITE = [1, 1, 1];

function facade(B, M, key, tint) {
  const crown = M.crownOf && M.crownOf[key];
  const mat = M.mats[crown || key];
  if (mat.isPaint) return A(B, mat);
  const acc = A(B, mat);
  if (mat.vertexColors) {
    const t = tint || WHITE;
    // a lit crown: its windows all on (shaders.js windowMat's crown)
    acc.col = crown ? [t[0] + 2, t[1], t[2]] : t;
  }
  return acc;
}

/**
 * u/v offsets (tiles) for a part of a building made of material key. A
 * street-level band (p.band: the texture's row 0 or 1, each half its
 * height) is stretched to the band's height instead.
 */
function uvOf(M, it, key, y0, p) {
  const sp = M.spec[key];
  if (p && p.band !== undefined) return { uw: sp.uw, vh: (p.y1 - p.y0) * (sp.rows || 2), u0: (it.seed * 0.618) % 1, v0: p.band / (sp.rows || 2) };
  return { uw: sp.uw, vh: sp.vh, u0: it.seed * 8, v0: (y0 - it.gy) / sp.vh + (it.seedV % sp.floors) / sp.floors };
}

/** Outline (world [x, z]) of a part. */
export function outline(it, p) {
  const W = toWorld(it.x, it.z, it.ry);
  const [cx, cz] = W(p.dx || 0, p.dz || 0);
  const ry = it.ry + (p.rot || 0);
  if (p.s === 'poly') return place(p.poly, cx, cz, ry);
  if (p.s === 'cham' || (p.s === 'pyr' && p.c)) return place(chamfer(p.w, p.d, p.c || 0), cx, cz, ry);
  if (p.s === 'cyl' || p.s === 'drum') return place(circle(p.r, p.n || 20, p.a0 || 0), cx, cz, ry);
  return place([[-p.w / 2, -p.d / 2], [p.w / 2, -p.d / 2], [p.w / 2, p.d / 2], [-p.w / 2, p.d / 2]], cx, cz, ry);
}

export function drawParts(B, it, M) {
  const W = toWorld(it.x, it.z, it.ry);
  for (const p of it.parts) {
    const [cx, cz] = W(p.dx || 0, p.dz || 0);
    const ry = it.ry + (p.rot || 0);
    const key = p.m;
    if (p.s === 'twist') {
      // a stack of slabs, each turned a little more: the tower twists
      const n = Math.max(2, Math.round((p.y1 - p.y0) / p.step));
      const hh = (p.y1 - p.y0) / n;
      for (let k = 0; k < n; k++) {
        const y = p.y0 + k * hh;
        const a = ry + p.twist * (k / (n - 1));
        const crown = k >= n - (p.crownN || 0);
        const mk = crown ? (p.crownM || 'crown') : key;
        const uv = uvOf(M, it, mk, y);
        walls(facade(B, M, mk, crown ? p.crownTint || p.tint : p.tint), cx, y, cz, p.w, hh, p.d, a, uv.uw, uv.vh, uv.u0, uv.v0);
        // each slab's lip shows where it overhangs the one below
        lid(A(B, M.roof), cx, y + hh, cz, p.w, p.d, a, 6);
        if (p.led && k % p.led === p.led - 1) ledBox(B, M, cx, y + hh, cz, p.w, p.d, a, p.ledM);
      }
      continue;
    }
    if (p.s === 'pyr') {
      const pts = p.c ? place(chamfer(p.w, p.d, p.c), cx, cz, ry) : place([[-p.w / 2, -p.d / 2], [p.w / 2, -p.d / 2], [p.w / 2, p.d / 2], [-p.w / 2, p.d / 2]], cx, cz, ry);
      apex(A(B, p.m === 'steel' ? M.steel : p.m === 'roof' ? M.roof : M.mats[p.m] || M.metal), pts, p.y0, cx, p.y1, cz, 4);
      continue;
    }
    if (p.s === 'cone') {
      const pts = place(circle(p.r, p.n || 12), cx, cz, ry);
      apex(A(B, p.m === 'steel' ? M.steel : M.mats[p.m] || M.metal), pts, p.y0, cx, p.y1, cz, 4);
      continue;
    }
    const uv = M.spec[key] ? uvOf(M, it, key, p.y0, p) : { uw: 4, vh: 4, u0: 0, v0: 0 };
    const acc = M.mats[key] ? facade(B, M, key, p.tint) : A(B, M[key] || M.metal);
    if (p.s === 'box' && !p.slope) {
      walls(acc, cx, p.y0, cz, p.w, p.y1 - p.y0, p.d, ry, uv.uw, uv.vh, uv.u0, uv.v0, p.faces || 'fblr');
      if (p.lid !== false) lid(A(B, p.lidM ? M[p.lidM] : M.roof), cx, p.y1, cz, p.w, p.d, ry, 6);
    } else {
      const pts = outline(it, p);
      if (p.slope) {
        // a wedge: the top slopes up across the local x (p.slope metres rise)
        const c = Math.cos(ry), s = Math.sin(ry);
        const topY = (q) => {
          const lx = (q[0] - cx) * c - (q[1] - cz) * s;
          return p.y1 + (lx / p.w + 0.5) * p.slope;
        };
        polyWalls(acc, pts, p.y0, topY, uv.uw, uv.vh, uv.u0, uv.v0);
        polyCap(facade(B, M, p.slopeM || 'crown', p.tint), pts, topY, true, 6);
      } else {
        polyWalls(acc, pts, p.y0, p.y1, uv.uw, uv.vh, uv.u0, uv.v0);
        if (p.lid !== false) polyCap(A(B, p.lidM ? M[p.lidM] : M.roof), pts, p.y1, true, 6);
      }
    }
    if (p.led) {
      if (p.s === 'cyl' || p.s === 'drum') ring(A(B, p.ledM === 'b' ? M.ledB : M.led), cx, p.y1 - 0.5, cz, p.r - 0.05, p.r + 0.35, 0.6, p.n || 20);
      else if (p.s === 'cham' || p.s === 'poly') ledLoop(B, M, outline(it, p), p.y1, p.ledM);
      else ledBox(B, M, cx, p.y1, cz, p.w, p.d, ry, p.ledM);
    }
  }
}

/** LED strips along the four top edges of a box. */
export function ledBox(B, M, x, y, z, w, d, ry, which) {
  const acc = A(B, which === 'b' ? M.ledB : M.led);
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const hw = w / 2 + 0.12, hd = d / 2 + 0.12;
  const C = [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)];
  for (let k = 0; k < 4; k++) {
    const a = C[k], b = C[(k + 1) % 4];
    acc.beam(a[0], y - 0.25, a[1], b[0], y - 0.25, b[1], 0.35, 0.5);
  }
}

/** LED strips round a polygon's top edge. */
export function ledLoop(B, M, pts, y, which) {
  const acc = A(B, which === 'b' ? M.ledB : M.led);
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    acc.beam(a[0], y - 0.25, a[1], b[0], y - 0.25, b[1], 0.35, 0.5);
  }
}

/** Rooftop things: mechanical penthouses, masts with warning lights, helipads, logos, spires. */
export function drawTops(B, it, M) {
  const W = toWorld(it.x, it.z, it.ry);
  for (const t of it.tops || []) {
    const [cx, cz] = W(t.dx || 0, t.dz || 0);
    const ry = it.ry + (t.rot || 0);
    switch (t.k) {
      case 'mech': {
        const acc = A(B, M.metal);
        walls(acc, cx, t.y, cz, t.w, t.h, t.d, ry, 3, 3);
        lid(A(B, M.roof), cx, t.y + t.h, cz, t.w, t.d, ry, 4);
        break;
      }
      case 'screenwall': {
        // the facade carried up past the roof, hiding the plant
        const uv = uvOf(M, it, t.m, t.y);
        walls(facade(B, M, t.m, t.tint), cx, t.y, cz, t.w, t.h, t.d, ry, uv.uw, uv.vh, uv.u0, uv.v0);
        break;
      }
      case 'mast': {
        const st = A(B, M.steel);
        st.cyl(cx, t.y, cz, t.r, t.h, 8, t.r * 0.35);
        // a ring of struts at its foot, the lights up it
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + ry;
          st.beam(cx + Math.cos(a) * t.r * 4, t.y, cz + Math.sin(a) * t.r * 4, cx, t.y + t.h * 0.18, cz, 0.25, 0.25);
        }
        const bl = A(B, M.blink);
        for (const f of t.lights || [0.35, 0.7, 1.0]) {
          const yy = t.y + t.h * f, rr = t.r * (1 - f * 0.65) + 0.25;
          for (let k = 0; k < 4; k++) {
            const a = k * Math.PI / 2 + ry + Math.PI / 4;
            bl.box(cx + Math.cos(a) * rr, yy - 0.3, cz + Math.sin(a) * rr, 0.55, 0.55, 0.55);
          }
        }
        break;
      }
      case 'antennas': {
        const st = A(B, M.steel);
        for (const [ax, az, h] of t.list) {
          const [px, pz] = W(ax, az);
          st.cyl(px, t.y, pz, 0.18, h, 5, 0.08);
          A(B, M.blink).box(px, t.y + h, pz, 0.45, 0.45, 0.45);
        }
        break;
      }
      case 'spire': {
        const pts = place(circle(t.r, 8), cx, cz, ry);
        apex(A(B, M.steel), pts, t.y, cx, t.y + t.h, cz, 4);
        A(B, M.blink).box(cx, t.y + t.h, cz, 0.5, 0.5, 0.5);
        break;
      }
      case 'heli': {
        const acc = A(B, M.roof);
        walls(acc, cx, t.y, cz, t.w, 0.5, t.w, ry, 4, 4);
        decal(A(B, M.signPlain || M.sign), cx, t.y + 0.52, cz, t.w * 0.94, t.w * 0.94, ry, M.uv('heli'));
        const gl = A(B, M.ledG || M.led);
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2;
          gl.box(cx + Math.cos(a) * t.w * 0.5, t.y + 0.5, cz + Math.sin(a) * t.w * 0.5, 0.3, 0.2, 0.3);
        }
        break;
      }
      case 'logo': {
        // the owner's name high on the crown, lit, on each face that has one
        const uv = M.uv(t.name);
        const c = Math.cos(ry), s = Math.sin(ry);
        for (const f of t.faces || 'fb') {
          const [ox, oz, fr, half] = f === 'f' ? [0, 1, 0, t.d] : f === 'b' ? [0, -1, Math.PI, t.d] : f === 'r' ? [1, 0, Math.PI / 2, t.w] : [-1, 0, -Math.PI / 2, t.w];
          const off = (half / 2) + 0.35;
          const lx = ox * off, lz = oz * off;
          const px = cx + lx * c + lz * s, pz = cz - lx * s + lz * c;
          const span = f === 'f' || f === 'b' ? t.w : t.d;
          const lw = Math.min(span * 0.8, t.h * 3.2);
          panel(A(B, M.sign), px, t.y, pz, lw, lw / 3.2, ry + fr, uv);
        }
        break;
      }
      case 'crownring': {
        ring(A(B, t.m === 'b' ? M.ledB : M.led), cx, t.y, cz, t.r - 0.6, t.r, t.h, t.n || 20);
        break;
      }
      case 'fins': {
        // vertical fins up the corners of a crown (lit edges at night)
        const c = Math.cos(ry), s = Math.sin(ry);
        const acc = A(B, t.m === 'b' ? M.ledB : M.led);
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const lx = sx * (t.w / 2 + 0.1), lz = sz * (t.d / 2 + 0.1);
          acc.box(cx + lx * c + lz * s, t.y, cz - lx * s + lz * c, 0.4, t.h, 0.4, ry);
        }
        break;
      }
      default: break;
    }
  }
}

/** LED screens on a building's faces: { f: 'f'|'b'|'l'|'r', y, h, w, off, ph } (off: along the face). */
export function drawScreens(B, it, M) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  for (const sc of it.screens || []) {
    const [ox, oz, fr, half] = sc.f === 'f' ? [0, 1, 0, it.d] : sc.f === 'b' ? [0, -1, Math.PI, it.d] : sc.f === 'r' ? [1, 0, Math.PI / 2, it.w] : [-1, 0, -Math.PI / 2, it.w];
    const along = sc.off || 0;
    // the face's own x axis (to slide the screen along it)
    const fx = Math.cos(it.ry + fr), fz = -Math.sin(it.ry + fr);
    const out = (sc.dist ?? half / 2) + 0.45;
    const lx = ox * out, lz = oz * out;
    const px = it.x + lx * c + lz * s + fx * along, pz = it.z - lx * s + lz * c + fz * along;
    panel(A(B, M.screen), px, sc.y, pz, sc.w, sc.h, it.ry + fr, [sc.ph + 0.002, 0, sc.ph + 0.998, 1]);
    // the frame behind it
    const bx = px - Math.sin(it.ry + fr) * 0.25, bz = pz - Math.cos(it.ry + fr) * 0.25;
    A(B, M.metal).box(bx, sc.y - 0.4, bz, sc.w + 0.8, sc.h + 0.8, 0.4, it.ry + fr);
  }
}

/** An entrance canopy over the sidewalk, lit underneath. */
export function drawCanopy(B, it, M) {
  const cp = it.canopy;
  if (!cp) return;
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  const lz = it.d / 2 + cp.d / 2, lx = cp.off || 0;
  const px = it.x + lx * c + lz * s, pz = it.z - lx * s + lz * c;
  A(B, M.metal).box(px, cp.y, pz, cp.w, 0.45, cp.d, it.ry);
  under(A(B, M.led), px, cp.y - 0.02, pz, cp.w - 0.6, cp.d - 0.6, it.ry);
}
