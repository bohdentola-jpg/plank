// PORT HALCYON — the west's props: parked pickups and cars, tractors,
// boats, picnic tables, benches, tents and campfires, hay bales, barrels,
// lamp posts, sign boards. Low-poly boxes and tubes in a vertex-coloured
// 'paint' material (pass the Acc), so a yard full of them is one draw call.
import { box, cylinder } from '../builder.js';
import { Fr, tube } from './geo.js';
import { lin } from './util.js';

const C = (hex) => (Array.isArray(hex) ? hex : lin(hex));
const set = (acc, hex) => { if (acc.c) acc.col = C(hex); return acc; };
const reset = (acc) => { if (acc.c) acc.col = [1, 1, 1]; };

/** A wheel (tube along the frame's x) at local (lx, ly, lz) of F, radius r, width w. */
function wheel(acc, F, lx, ly, lz, r, w, seg = 8) {
  const a = F.p(lx - w / 2, ly, lz), b = F.p(lx + w / 2, ly, lz);
  tube(acc, a, b, r, seg, { caps: true });
}

/** A pickup truck (≈5.3 × 2 m) facing local +z. */
export function pickup(acc, x, y, z, ry, body = '#8a2a22', o = {}) {
  const F = new Fr(x, y, z, ry);
  set(acc, '#1a1a1c');
  for (const [lx, lz] of [[-0.85, 1.6], [0.85, 1.6], [-0.85, -1.5], [0.85, -1.5]]) wheel(acc, F, lx, 0.42, lz, 0.42, 0.3);
  set(acc, body);
  F.box(acc, 0, 0.45, 0.2, 1.95, 0.55, 5.2, { u: 2 });          // the chassis/body sides
  F.box(acc, 0, 1.0, 1.75, 1.9, 0.42, 1.7, { u: 2 });           // the hood
  F.box(acc, 0, 1.0, 0.2, 1.9, 1.05, 1.5, { u: 2 });            // the cab
  // the bed: floor and walls
  F.box(acc, 0, 1.0, -1.45, 1.95, 0.1, 2.2, { u: 2 });
  F.box(acc, -0.93, 1.0, -1.45, 0.09, 0.5, 2.2, { u: 2 });
  F.box(acc, 0.93, 1.0, -1.45, 0.09, 0.5, 2.2, { u: 2 });
  F.box(acc, 0, 1.0, -2.52, 1.95, 0.5, 0.08, { u: 2 });
  set(acc, '#151a20');
  F.box(acc, 0, 1.55, 0.2, 1.8, 0.45, 1.3, { u: 2, top: false });  // windows band
  set(acc, body);
  F.box(acc, 0, 2.0, 0.2, 1.86, 0.08, 1.4, { u: 2 });           // the roof
  set(acc, '#d8d8d0');
  F.box(acc, 0, 0.62, 2.78, 1.9, 0.22, 0.12, { u: 2 });         // bumper
  if (o.load) { set(acc, o.load); F.box(acc, 0, 1.1, -1.5, 1.6, 0.6, 1.6, { u: 2 }); }
  reset(acc);
}

/** A sedan (≈4.6 × 1.8 m). */
export function sedan(acc, x, y, z, ry, body = '#3a4a6a') {
  const F = new Fr(x, y, z, ry);
  set(acc, '#1a1a1c');
  for (const [lx, lz] of [[-0.78, 1.4], [0.78, 1.4], [-0.78, -1.35], [0.78, -1.35]]) wheel(acc, F, lx, 0.33, lz, 0.33, 0.24);
  set(acc, body);
  F.box(acc, 0, 0.32, 0, 1.78, 0.62, 4.5, { u: 2 });
  set(acc, '#141820');
  F.box(acc, 0, 0.94, -0.15, 1.6, 0.48, 2.3, { u: 2, top: false });
  set(acc, body);
  F.box(acc, 0, 1.42, -0.2, 1.55, 0.07, 1.9, { u: 2 });
  reset(acc);
}

/** A farm tractor (big rear wheels, small front, a cab) facing +z. */
export function tractor(acc, x, y, z, ry, body = '#2f7a3a', o = {}) {
  const F = new Fr(x, y, z, ry);
  set(acc, '#141416');
  wheel(acc, F, -1.0, 0.85, -0.9, 0.85, 0.5, 10);
  wheel(acc, F, 1.0, 0.85, -0.9, 0.85, 0.5, 10);
  wheel(acc, F, -0.75, 0.48, 1.6, 0.48, 0.3);
  wheel(acc, F, 0.75, 0.48, 1.6, 0.48, 0.3);
  set(acc, o.rims || '#e8c21a');
  for (const sx of [-1, 1]) wheel(acc, F, sx * 1.27, 0.85, -0.9, 0.45, 0.04);
  set(acc, body);
  F.box(acc, 0, 0.7, 0.9, 0.9, 0.9, 2.3, { u: 2 });            // the hood/engine
  F.box(acc, 0, 0.6, -0.9, 1.3, 0.9, 1.4, { u: 2 });           // the body over the axle
  for (const sx of [-1, 1]) F.box(acc, sx * 1.0, 1.5, -0.9, 0.6, 0.12, 1.7, { u: 2 });  // fenders
  set(acc, '#1e2226');
  F.box(acc, 0, 1.5, -0.9, 1.2, 1.3, 1.2, { u: 2, top: false });   // the cab glass
  set(acc, body);
  F.box(acc, 0, 2.8, -0.9, 1.4, 0.1, 1.4, { u: 2 });
  set(acc, '#2a2a2a');
  cylinder(acc, F.wx(0.3, 1.6), y + 1.55, F.wz(0.3, 1.6), 0.07, 1.4, 5);   // exhaust
  reset(acc);
}

/**
 * A boat on the water at y (the waterline): kind 'row' (≈4 m), 'motor'
 * (≈7 m, a cabin), 'sail' (≈8 m, a mast); facing +z (bow).
 */
export function boat(acc, x, y, z, ry, kind = 'motor', hull = '#f2f2ee', o = {}) {
  const F = new Fr(x, y, z, ry);
  const L = kind === 'row' ? 4 : kind === 'sail' ? 8.4 : 7.2;
  const W = kind === 'row' ? 1.5 : kind === 'sail' ? 2.7 : 2.6;
  const H = kind === 'row' ? 0.6 : 1.1;
  // the hull: a pointed prism (bow at +z), its bottom just under the water
  set(acc, hull);
  const pts = [[-W / 2, -L / 2], [W / 2, -L / 2], [W / 2, L * 0.15], [0, L / 2], [-W / 2, L * 0.15]];
  const P = pts.map(([lx, lz]) => [F.wx(lx, lz), F.wz(lx, lz)]);
  const y0 = y - 0.35, y1 = y + H - 0.35;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    acc.quadP([b[0], y0, b[1]], [a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]]);
  }
  // the deck
  set(acc, o.deck || (kind === 'row' ? '#7a5a3a' : '#d8d2c2'));
  const c = acc.v(F.wx(0, 0), y1 - 0.05, F.wz(0, 0));
  const ids = P.map((p) => acc.v(p[0], y1 - 0.05, p[1]));
  for (let i = 0; i < ids.length; i++) acc.tri(c, ids[(i + 1) % ids.length], ids[i]);
  // a stripe
  set(acc, o.stripe || '#2a5a9a');
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    acc.quadP([b[0], y1 - 0.32, b[1]], [a[0], y1 - 0.32, a[1]], [a[0], y1 - 0.2, a[1]], [b[0], y1 - 0.2, b[1]]);
  }
  if (kind === 'motor') {
    set(acc, '#e8e8e2');
    F.box(acc, 0, H - 0.4, -0.4, W * 0.7, 1.0, L * 0.35, { u: 2 });
    set(acc, '#1a2430');
    F.box(acc, 0, H + 0.2, -0.4 + L * 0.06, W * 0.66, 0.35, L * 0.24, { u: 2, top: false });
  } else if (kind === 'sail') {
    set(acc, '#d0d0c8');
    cylinder(acc, F.wx(0, 0.6), y1, F.wz(0, 0.6), 0.07, 10, 5);
    F.box(acc, 0, H + 0.6, -1.4, 0.1, 0.1, 4.0, { u: 2 });     // the boom
    set(acc, o.cover || '#2a4a7a');
    F.box(acc, 0, H + 0.62, -1.4, 0.4, 0.3, 3.6, { u: 2 });    // the furled sail cover
  } else {
    set(acc, '#6a4a2a');
    F.box(acc, 0, H - 0.45, 0, W * 0.9, 0.06, 0.25, { u: 2 }); // a thwart
  }
  reset(acc);
}

/** A picnic table (≈1.8 m) in wood. */
export function picnicTable(acc, x, y, z, ry, hex = '#7a5634') {
  const F = new Fr(x, y, z, ry);
  set(acc, hex);
  F.box(acc, 0, 0.72, 0, 1.8, 0.06, 0.8, { u: 2 });
  for (const sz of [-0.68, 0.68]) F.box(acc, 0, 0.42, sz, 1.8, 0.05, 0.28, { u: 2 });
  for (const sx of [-0.7, 0.7]) { F.box(acc, sx, 0, 0, 0.08, 0.72, 0.08, { u: 2 }); F.box(acc, sx, 0.36, 0, 0.08, 0.06, 1.6, { u: 2 }); }
  reset(acc);
}

/** A bench. */
export function bench(acc, x, y, z, ry, hex = '#6a4a30') {
  const F = new Fr(x, y, z, ry);
  set(acc, hex);
  F.box(acc, 0, 0.42, 0, 1.6, 0.06, 0.42, { u: 2 });
  F.box(acc, 0, 0.5, -0.2, 1.6, 0.45, 0.05, { u: 2 });
  set(acc, '#2a2a2a');
  for (const sx of [-0.7, 0.7]) F.box(acc, sx, 0, 0, 0.06, 0.42, 0.4, { u: 2 });
  reset(acc);
}

/** A ridge tent (≈2.6 × 2 m, 1.4 m tall). */
export function tent(acc, x, y, z, ry, hex = '#d86a2a') {
  const F = new Fr(x, y, z, ry);
  set(acc, hex);
  const h = 1.4, hw = 1.0, hd = 1.3;
  const A = F.p(-hw, 0, -hd), B = F.p(-hw, 0, hd), Cc = F.p(hw, 0, hd), D = F.p(hw, 0, -hd);
  const R0 = F.p(0, h, -hd), R1 = F.p(0, h, hd);
  acc.quadP(A, B, R1, R0);
  acc.quadP(Cc, D, R0, R1);
  set(acc, '#2a2018');
  const t1 = [acc.v(...B), acc.v(...Cc), acc.v(...R1)];
  acc.tri(t1[0], t1[1], t1[2]);
  set(acc, hex);
  const t2 = [acc.v(...D), acc.v(...A), acc.v(...R0)];
  acc.tri(t2[0], t2[1], t2[2]);
  reset(acc);
}

/** A round hay bale lying on its side (r ≈ 0.75 m) along local x. */
export function hayRound(acc, x, y, z, ry, r = 0.75, hex = '#c8a54e') {
  const F = new Fr(x, y, z, ry);
  set(acc, hex);
  tube(acc, F.p(-0.65, r, 0), F.p(0.65, r, 0), r, 9, { caps: true, u: 1 });
  reset(acc);
}

/** A square bale (1.1 × 0.45 × 0.35), or a stack of them. */
export function hayBlock(acc, x, y, z, ry, hex = '#d4b25a') {
  set(acc, hex);
  box(acc, x, y - 0.05, z, 1.1, 0.45, 0.5, ry, { u: 1 });
  reset(acc);
}

/** An oil drum. */
export function drum(acc, x, y, z, hex = '#3a5a8a') {
  set(acc, hex);
  cylinder(acc, x, y, z, 0.3, 0.9, 7, { top: true });
  reset(acc);
}

/** A wooden crate (s m). */
export function crate(acc, x, y, z, ry, s = 1, hex = '#8a6a42') {
  set(acc, hex);
  box(acc, x, y, z, s, s, s, ry, { u: 1 });
  reset(acc);
}

/** A camper trailer (≈6 × 2.3 m) with a lit window band (glow Acc, or null). */
export function camper(acc, glow, x, y, z, ry, hex = '#e8e2d0', stripe = '#c85a2a') {
  const F = new Fr(x, y, z, ry);
  set(acc, '#1a1a1c');
  for (const sx of [-1.05, 1.05]) wheel(acc, F, sx, 0.38, -0.4, 0.38, 0.25);
  set(acc, hex);
  F.box(acc, 0, 0.45, 0, 2.3, 2.3, 6.0, { u: 2 });
  set(acc, stripe);
  F.box(acc, 0, 1.1, 0, 2.32, 0.25, 6.02, { u: 2, top: false });
  set(acc, '#3a3a3a');
  F.box(acc, 0, 0.5, 3.6, 0.15, 0.15, 1.3, { u: 2 });            // the tow bar
  reset(acc);
  if (glow) F.box(glow, 1.17, 1.55, 0.6, 0.02, 0.45, 1.4, { u: 2, top: false });
}

/** A rowing-boat-sized canoe upside down on the shore (or rack). */
export function canoe(acc, x, y, z, ry, hex = '#c83a2a') {
  const F = new Fr(x, y, z, ry);
  set(acc, hex);
  const L = 4.6, W = 0.85;
  const pts = [[0, -L / 2], [W / 2, -L * 0.25], [W / 2, L * 0.25], [0, L / 2], [-W / 2, L * 0.25], [-W / 2, -L * 0.25]];
  const P = pts.map(([lx, lz]) => [F.wx(lx, lz), F.wz(lx, lz)]);
  const top = y + 0.38;
  const c = acc.v(F.wx(0, 0), top, F.wz(0, 0));
  const ids = P.map((p) => acc.v(p[0], y, p[1]));
  for (let i = 0; i < ids.length; i++) acc.tri(c, ids[(i + 1) % ids.length], ids[i]);
  reset(acc);
}
