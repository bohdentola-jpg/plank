// Canvas texture painter for the procedural cars. Every surface gets three
// layers drawn in lockstep:
//   albedo  (sRGB color, alpha = glass transparency on the cabin)
//   orm     (R clearcoat, G roughness, B metalness)
//   emissive(R headlight, G tail-light, B brake-light) — masks the light
//            shader multiplies by live intensities.
import { IDX, CIDX, CAB_GLASS_IDX, topIndexAt } from './hull.js';

export const FINISHES = {
  gloss: { metal: 0.0, rough: 0.32, coat: 1.0 },
  metallic: { metal: 0.55, rough: 0.34, coat: 1.0 },
  pearl: { metal: 0.45, rough: 0.28, coat: 1.0 },
  candy: { metal: 0.75, rough: 0.22, coat: 1.0 },
  matte: { metal: 0.15, rough: 0.78, coat: 0.0 },
  chrome: { metal: 1.0, rough: 0.07, coat: 0.3 },
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const ormColor = (coat, rough, metal) =>
  `rgb(${Math.round(coat * 255)},${Math.round(rough * 255)},${Math.round(metal * 255)})`;

export class Layers {
  constructor(w, h, withEmissive = true) {
    this.w = w;
    this.h = h;
    this.A = canvas(w, h);
    this.O = canvas(w, h);
    this.E = withEmissive ? canvas(w, h) : null;
    this.a = this.A.getContext('2d');
    this.o = this.O.getContext('2d');
    this.e = this.E ? this.E.getContext('2d') : null;
    if (this.e) { this.e.fillStyle = '#000'; this.e.fillRect(0, 0, w, h); }
  }
  all(fn) { fn(this.a, 'a'); fn(this.o, 'o'); if (this.e) fn(this.e, 'e'); }
  save() { this.all((c) => c.save()); }
  restore() { this.all((c) => c.restore()); }
  setTransform(a, b, c, d, e, f) { this.all((x) => x.setTransform(a, b, c, d, e, f)); }
  clip(path) { this.all((c) => { path(c); c.clip(); }); }
  /** paint a region. s = {a: albedoStyle, o: [coat,rough,metal], e: [h,t,b] (0..1)} */
  fill(path, s) {
    if (s.a !== undefined) { this.a.fillStyle = s.a; path(this.a); this.a.fill(); }
    if (s.o) { this.o.fillStyle = ormColor(...s.o); path(this.o); this.o.fill(); }
    if (s.e && this.e) {
      this.e.fillStyle = `rgb(${Math.round(s.e[0] * 255)},${Math.round(s.e[1] * 255)},${Math.round(s.e[2] * 255)})`;
      path(this.e);
      this.e.fill();
    }
  }
  stroke(path, s, lw) {
    const doIt = (c, style) => { c.lineWidth = lw; c.strokeStyle = style; path(c); c.stroke(); };
    if (s.a !== undefined) doIt(this.a, s.a);
    if (s.o) doIt(this.o, ormColor(...s.o));
    if (s.e && this.e) doIt(this.e, `rgb(${Math.round(s.e[0] * 255)},${Math.round(s.e[1] * 255)},${Math.round(s.e[2] * 255)})`);
  }
}

// --------------------------------------------------------------- patterns

let _carbon = null;
function carbonPattern(ctx) {
  if (!_carbon) {
    _carbon = canvas(16, 16);
    const c = _carbon.getContext('2d');
    c.fillStyle = '#16171a';
    c.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y += 4) {
      for (let x = 0; x < 16; x += 4) {
        const odd = ((x + y) / 4) % 2;
        const g = c.createLinearGradient(x, y, odd ? x + 4 : x, odd ? y : y + 4);
        g.addColorStop(0, '#2c2f35');
        g.addColorStop(1, '#0d0e10');
        c.fillStyle = g;
        c.fillRect(x, y, 4, 4);
      }
    }
  }
  return ctx.createPattern(_carbon, 'repeat');
}

let _mesh = null;
function meshPattern(ctx) {
  if (!_mesh) {
    _mesh = canvas(12, 10);
    const c = _mesh.getContext('2d');
    c.fillStyle = '#050505';
    c.fillRect(0, 0, 12, 10);
    c.strokeStyle = '#3a3c40';
    c.lineWidth = 1.2;
    const hex = (cx, cy) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        const x = cx + Math.cos(a) * 3.2, y = cy + Math.sin(a) * 3.2;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.closePath();
      c.stroke();
    };
    hex(3, 2.5); hex(9, 2.5); hex(0, 7.5); hex(6, 7.5); hex(12, 7.5);
  }
  return ctx.createPattern(_mesh, 'repeat');
}

function rrect(c, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}
function poly(c, pts) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
}
function ellipse(c, x, y, rx, ry) {
  c.beginPath();
  c.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
}

// --------------------------------------------------------------- body

/**
 * Body loft texture. u (canvas x) = distance from the front bumper / L.
 * v (canvas y, flipped) = index-mapped position around the ring (vs).
 */
export function paintBody(S, look, vs, res = 1024) {
  const W = res, H = res / 2;
  const L = S.L;
  const P = new Layers(W, H, false);
  const fin = FINISHES[look.finish] || FINISHES.metallic;
  const paintO = [fin.coat, fin.rough, fin.metal];
  const X = (u) => (u / L) * W;
  const Y = (v) => (1 - v) * H;
  const vL = (i) => vs[i];            // left half index → v
  const vR = (i) => vs[46 - i];       // right half index → v

  // base paint
  P.fill((c) => { c.beginPath(); c.rect(0, 0, W, H); }, { a: look.paint, o: paintO });
  // subtle paint depth: darker toward the bottom of the sides
  const shadeBand = (i0, i1, right) => {
    const y0 = Y(right ? vR(i0) : vL(i0)), y1 = Y(right ? vR(i1) : vL(i1));
    const g = P.a.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    P.a.fillStyle = g;
    P.a.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
  };
  // rocker/sill falls into shadow: gives the sides visual weight at the bottom
  shadeBand(IDX.cornerEnd - 1, IDX.cornerEnd + 5, false);
  shadeBand(IDX.cornerEnd - 1, IDX.cornerEnd + 5, true);

  // two-tone / vinyls that live on the body
  drawBodyVinyl(P, S, look, X, Y, vL, vR, W, H, paintO);

  // underbody + rocker underside
  const under = { a: '#0b0b0c', o: [0, 0.9, 0] };
  P.fill((c) => { c.beginPath(); c.rect(0, Y(vL(IDX.bottomEnd)), W, H - Y(vL(IDX.bottomEnd))); }, under);
  P.fill((c) => { c.beginPath(); c.rect(0, 0, W, Y(vR(IDX.bottomEnd))); }, under);
  // wheel wells (liners) — black where the arches carve
  for (const ua of [S.uF, S.uR]) {
    const x0 = X(ua - S.archR * 1.02), x1 = X(ua + S.archR * 1.02);
    P.fill((c) => { c.beginPath(); c.rect(x0, Y(vL(IDX.cornerEnd + 1)), x1 - x0, H); }, { a: '#070707', o: [0, 0.95, 0] });
    P.fill((c) => { c.beginPath(); c.rect(x0, 0, x1 - x0, Y(vR(IDX.cornerEnd + 1))); }, { a: '#070707', o: [0, 0.95, 0] });
  }
  // side skirts on kits: darker lower rocker strip
  if (look.kit === 'race' || look.kit === 'wide') {
    for (const right of [false, true]) {
      const y0 = Y(right ? vR(IDX.cornerEnd) : vL(IDX.cornerEnd));
      const y1 = Y(right ? vR(IDX.cornerEnd + 1) : vL(IDX.cornerEnd + 1));
      P.fill((c) => { c.beginPath(); c.rect(X(S.uF + S.archR), Math.min(y0, y1), X(S.uR - S.archR) - X(S.uF + S.archR), Math.abs(y1 - y0)); }, { a: '#151618', o: [0.2, 0.5, 0] });
    }
  }

  const b = S.b;
  const lineCol = 'rgba(0,0,0,0.55)';
  const seam = (x0, y0, x1, y1, w = 1.6) => P.stroke((c) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); }, { a: lineCol }, w);

  // ---- sides: door gaps, handles, markers, fuel door
  const doors = b.doors || 2;
  const dFront = b.cowl - 0.02;
  const dRear = doors === 4 ? (b.cowl + b.deck) / 2 + 0.05 : Math.min(b.deck - 0.05, b.cowl + 1.12);
  const dRear2 = doors === 4 ? Math.min(b.deck + 0.05, S.uR - S.archR - 0.02) : null;
  for (const right of [false, true]) {
    const vlo = right ? vR(IDX.cornerEnd) : vL(IDX.cornerEnd);
    const vhi = right ? vR(IDX.sideEnd + 4) : vL(IDX.sideEnd + 4);
    const y0 = Y(vlo), y1 = Y(vhi);
    seam(X(dFront), y0, X(dFront + 0.03), y1);
    seam(X(dRear), y0, X(dRear - 0.02), y1);
    if (dRear2) seam(X(dRear2), y0, X(dRear2 - 0.06), y1);
    // door handle(s)
    const hy = Y(right ? vR(IDX.sideEnd - 1) : vL(IDX.sideEnd - 1));
    const hx = X(dRear - 0.2);
    const hw = (0.14 / L) * W, hh = Math.max(3, H * 0.012);
    P.fill((c) => rrect(c, hx - hw / 2, hy - hh / 2, hw, hh, 2), { a: '#1d1e21', o: [0.5, 0.4, 0.6] });
    if (dRear2) P.fill((c) => rrect(c, X(dRear2 - 0.2) - hw / 2, hy - hh / 2, hw, hh, 2), { a: '#1d1e21', o: [0.5, 0.4, 0.6] });
    // fuel door on the rear quarter
    if (!right) {
      const fx = X(S.uR - S.archR - 0.18), fy = Y(vL(IDX.sideEnd));
      P.stroke((c) => { c.beginPath(); c.arc(fx, fy, (0.07 / L) * W, 0, Math.PI * 2); }, { a: lineCol }, 1.4);
    }
    // amber side marker near the front corner
    const mx = X(0.12), my = Y(right ? vR(IDX.cornerEnd + 3) : vL(IDX.cornerEnd + 3));
    P.fill((c) => rrect(c, mx - 6, my - 3, 12, 6, 2), { a: '#d9821a', o: [1, 0.1, 0] });
    // side mirrors' shadow, beltline highlight
    const by = Y(right ? vR(IDX.shoulderEnd - 2) : vL(IDX.shoulderEnd - 2));
    P.a.fillStyle = 'rgba(255,255,255,0.06)';
    P.a.fillRect(0, by - 1, W, 2);
    // fender vents on supercars / kits
    if (b.sideVent) {
      const vx = X(b.sideVent[0]), vy = Y(right ? vR(9) : vL(9));
      const vw = (b.sideVent[1] / L) * W;
      P.fill((c) => rrect(c, vx, vy - H * 0.025, vw, H * 0.05, 4), { a: '#060606', o: [0, 0.8, 0] });
    }
    // side badge (model name) on the front fender
    if (b.badge) {
      const bx = X(S.uF + S.archR + 0.1);
      const byy = Y(right ? vR(IDX.sideEnd - 2) : vL(IDX.sideEnd - 2));
      drawSideText(P, b.badge, bx, byy, H * 0.03, right, '#cfd3da');
    }
  }

  // ---- top: hood seams, cowl, trunk
  const vTopL = vL(IDX.shoulderEnd - 1), vTopR = vR(IDX.shoulderEnd - 1);
  const yTopL = Y(vTopL), yTopR = Y(vTopR);
  const hoodFront = b.hoodFront ?? 0.16;
  // hood outline
  seam(X(hoodFront), yTopL, X(hoodFront), yTopR, 1.4);
  seam(X(hoodFront), yTopL, X(b.cowl - 0.08), yTopL, 1.4);
  seam(X(hoodFront), yTopR, X(b.cowl - 0.08), yTopR, 1.4);
  // cowl / wiper panel
  {
    const cy0 = H / 2 - (yTopL - yTopR) * 0.36, cy1 = H / 2 + (yTopL - yTopR) * 0.36;
    P.fill((c) => { c.beginPath(); c.rect(X(b.cowl - 0.07), cy0, X(b.cowl + 0.02) - X(b.cowl - 0.07), cy1 - cy0); }, { a: '#101114', o: [0, 0.7, 0] });
  }
  // hood treatments
  const hoodPath = (c) => { c.beginPath(); c.rect(X(hoodFront + 0.01), yTopR + 2, X(b.cowl - 0.09) - X(hoodFront + 0.01), yTopL - yTopR - 4); };
  if (look.hood === 'carbon') {
    P.fill(hoodPath, { a: carbonPattern(P.a), o: [1, 0.35, 0.2] });
  }
  if (look.hood === 'vented' || look.hood === 'carbon') {
    for (const side of [-1, 1]) {
      const cy = H / 2 + side * (yTopL - yTopR) * 0.24;
      for (let k = 0; k < 5; k++) {
        const x = X(b.cowl - 0.5 + k * 0.07);
        P.fill((c) => rrect(c, x, cy - H * 0.035, (0.035 / L) * W, H * 0.07, 2), { a: '#050505', o: [0, 0.9, 0] });
      }
    }
  }
  // big louvered hood vents (Viper-style), either side of the centre bulge
  if (b.hoodVents) {
    const u0 = hoodFront + (b.cowl - hoodFront) * 0.3, u1 = hoodFront + (b.cowl - hoodFront) * 0.62;
    for (const side of [-1, 1]) {
      const cy = H / 2 + side * (yTopL - yTopR) * 0.21;
      const hh = (yTopL - yTopR) * 0.09;
      P.fill((c) => rrect(c, X(u0), cy - hh, X(u1) - X(u0), hh * 2, 6), { a: '#060607', o: [0, 0.85, 0] });
      for (let k = 1; k < 7; k++) {
        const x = X(u0) + (X(u1) - X(u0)) * k / 7;
        P.fill((c) => { c.beginPath(); c.rect(x - 1.5, cy - hh * 0.85, 3, hh * 1.7); }, { a: '#2a2c30', o: [0.3, 0.4, 0.2] });
      }
    }
  }
  // trunk lid
  const trunkEnd = S.L - (b.trunkEnd ?? 0.1);
  if (b.deck < S.L - 0.25) {
    seam(X(b.deck + 0.03), yTopL, X(b.deck + 0.03), yTopR, 1.4);
    seam(X(b.deck + 0.03), yTopL, X(trunkEnd), yTopL, 1.4);
    seam(X(b.deck + 0.03), yTopR, X(trunkEnd), yTopR, 1.4);
  }
  // engine cover louvers (mid/rear engine)
  if (b.louvers) {
    for (let k = 0; k < 7; k++) {
      const x = X(b.deck + 0.12 + k * 0.08);
      P.fill((c) => { c.beginPath(); c.rect(x, H / 2 - (yTopL - yTopR) * 0.3, (0.03 / L) * W, (yTopL - yTopR) * 0.6); }, { a: '#0a0a0a', o: [0, 0.8, 0] });
    }
  }
  // top-surface vinyl (stripes) last so they cross seams like real vinyl
  drawTopVinyl(P, S, look, X, Y, vL, vR, W, H, paintO);
  const vf = (fi, right) => {
    const i = right ? 46 - fi : fi;
    const i0 = Math.max(0, Math.min(45, Math.floor(i)));
    return vs[i0] + (vs[i0 + 1] - vs[i0]) * (i - i0);
  };
  // roadster cockpit tub: dark trim/carpet inside the rolled door tops
  if (b.roadster && b.header) {
    const u0 = b.header - 0.03, u1 = b.deck + 0.01;
    const yl = Y(vf(IDX.shoulderEnd + 0.35, false)), yr = Y(vf(IDX.shoulderEnd + 0.35, true));
    P.fill((c) => rrect(c, X(u0), yr, X(u1) - X(u0), yl - yr, 10), { a: '#1d1e22', o: [0, 0.8, 0] });
    const g = P.a.createLinearGradient(0, yr, 0, yl);
    g.addColorStop(0, 'rgba(0,0,0,0.1)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0.1)');
    P.a.fillStyle = g;
    P.a.fillRect(X(u0) + 4, yr, X(u1) - X(u0) - 8, yl - yr);
  }
  // pop-up headlamp wells (dark; read as shut lines around the closed lids)
  if (b.head === 'popup') {
    const pu = b.popup || {};
    const uC = pu.u ?? 0.34, len = pu.len ?? 0.26, wid = pu.w ?? 0.36;
    const x = S.hwTopAt(uC) - (pu.inset ?? 0.27);
    const i0 = topIndexAt(S, uC, x + wid / 2 + 0.006), i1 = topIndexAt(S, uC, Math.max(0, x - wid / 2 - 0.006));
    for (const right of [false, true]) {
      const ya = Y(vf(i0, right)), yb = Y(vf(i1, right));
      P.fill((c) => rrect(c, X(uC - len / 2 - 0.006), Math.min(ya, yb), X(len + 0.012), Math.abs(yb - ya), 3), { a: '#070708', o: [0, 0.9, 0] });
    }
  }
  return P;
}

function drawSideText(P, str, x, y, size, right, color) {
  P.a.save();
  P.a.translate(x, y);
  if (right) P.a.rotate(Math.PI);
  P.a.font = `italic 800 ${size}px Arial, sans-serif`;
  P.a.textAlign = 'left';
  P.a.textBaseline = 'middle';
  P.a.fillStyle = color;
  P.a.fillText(str, 0, 0);
  P.a.restore();
}

/** Side-band coordinate helper: (u meters, f 0..1 from rocker to shoulder) → canvas px. */
function sideXY(S, X, Y, vL, vR, right, u, f) {
  const i0 = IDX.cornerEnd, i1 = IDX.sideEnd + 3;
  const fi = i0 + (i1 - i0) * Math.min(1, Math.max(0, f));
  const lo = Math.floor(fi), hi = Math.min(46, lo + 1), t = fi - lo;
  const vv = right ? vR(lo) + (vR(hi) - vR(lo)) * t : vL(lo) + (vL(hi) - vL(lo)) * t;
  return [X(u), Y(vv)];
}

function drawBodyVinyl(P, S, look, X, Y, vL, vR, W, H, paintO) {
  const v = look.vinyl;
  if (!v || v === 'none' || v === 'stripes') return;
  const col = look.paint2 || '#111';
  const o = paintO;
  const L = S.L;
  for (const right of [false, true]) {
    const sp = (u, f) => sideXY(S, X, Y, vL, vR, right, u, f);
    if (v === 'twotone') {
      const a = sp(0, 0), bb = sp(L, 0.42);
      P.fill((c) => { c.beginPath(); c.rect(0, Math.min(a[1], bb[1]), W, Math.abs(bb[1] - a[1])); }, { a: col, o });
    } else if (v === 'side') {
      const p0 = sp(0.25, 0.38), p1 = sp(L - 0.2, 0.62);
      const t = Math.abs(sp(0, 0.5)[1] - sp(0, 0.62)[1]);
      P.fill((c) => poly(c, [[p0[0], p0[1]], [p1[0], p1[1] + (right ? 1 : -1) * t * 0.2], [p1[0], p1[1] + (right ? -1 : 1) * t], [p0[0], p0[1] + (right ? -1 : 1) * t * 0.6]]), { a: col, o });
    } else if (v === 'flames') {
      // licks of flame from the front wheel back
      for (let k = 0; k < 5; k++) {
        const base = 0.15 + k * 0.14;
        const len = 1.2 + ((k * 37) % 5) * 0.25;
        const pa = sp(0.05, base), pb = sp(0.05, base + 0.12);
        const tip = sp(0.05 + len, base + 0.02 + (k % 2) * 0.05);
        const c1 = sp(0.05 + len * 0.55, base + 0.22), c2 = sp(0.05 + len * 0.45, base - 0.06);
        P.fill((c) => {
          c.beginPath();
          c.moveTo(pa[0], pa[1]);
          c.quadraticCurveTo(c2[0], c2[1], tip[0], tip[1]);
          c.quadraticCurveTo(c1[0], c1[1], pb[0], pb[1]);
          c.closePath();
        }, { a: col, o });
        const inner = look.paint3 || '#ffcc33';
        const pa2 = sp(0.05, base + 0.04), tip2 = sp(0.05 + len * 0.65, base + 0.05);
        P.fill((c) => {
          c.beginPath();
          c.moveTo(pa2[0], pa2[1]);
          c.quadraticCurveTo((pa2[0] + tip2[0]) / 2, tip2[1] + (right ? -3 : 3), tip2[0], tip2[1]);
          c.quadraticCurveTo((pa2[0] + tip2[0]) / 2, pa2[1] + (right ? 6 : -6), pa2[0], pa2[1] + (right ? 5 : -5));
          c.closePath();
        }, { a: inner, o });
      }
    } else if (v === 'tribal') {
      const spikes = 6;
      for (let k = 0; k < spikes; k++) {
        const u0 = 0.4 + k * (L - 0.9) / spikes;
        const a = sp(u0, 0.35), bb = sp(u0 + 0.75, 0.75 + (k % 2) * 0.15), cc = sp(u0 + 0.55, 0.42), d = sp(u0 + 0.35, 0.15);
        P.fill((c) => {
          c.beginPath();
          c.moveTo(a[0], a[1]);
          c.quadraticCurveTo(cc[0], a[1], bb[0], bb[1]);
          c.quadraticCurveTo(cc[0], cc[1], d[0], d[1]);
          c.quadraticCurveTo(a[0] + 4, d[1], a[0], a[1]);
          c.closePath();
        }, { a: col, o });
      }
    } else if (v === 'number') {
      const [cx, cy] = sp((S.b.cowl + S.b.deck) / 2 - 0.1, 0.5);
      const uMid = (S.uF + S.uR) / 2;
      const sideH = (S.topF(uMid) - S.botF(uMid)) * 0.78;
      const span = Math.abs(sp(0, 0)[1] - sp(0, 1)[1]);
      const R = 0.2;
      const r = R * span / sideH;
      P.fill((c) => ellipse(c, cx, cy, R * W / L, r), { a: '#f4f4f0', o: [1, 0.4, 0] });
      P.a.save();
      P.a.translate(cx, cy);
      if (right) P.a.rotate(Math.PI);
      P.a.scale(1, 1);
      P.a.font = `900 ${r * 1.5}px Arial Black, Arial, sans-serif`;
      P.a.textAlign = 'center';
      P.a.textBaseline = 'middle';
      P.a.fillStyle = '#111';
      P.a.fillText(String(look.number ?? 7), 0, r * 0.05);
      P.a.restore();
    } else if (v === 'checker') {
      const a = sp(0.2, 0.1), bb = sp(1.3, 0.6);
      const x0 = a[0], x1 = bb[0], y0 = Math.min(a[1], bb[1]), y1 = Math.max(a[1], bb[1]);
      const cs = (y1 - y0) / 4;
      for (let yy = 0; yy < 4; yy++) {
        for (let xx = 0; xx * cs < x1 - x0; xx++) {
          if ((xx + yy) % 2) continue;
          const fade = 1 - xx * cs / (x1 - x0);
          P.a.globalAlpha = Math.max(0, fade);
          P.fill((c) => { c.beginPath(); c.rect(x0 + xx * cs, y0 + yy * cs, cs, cs); }, { a: col, o });
          P.a.globalAlpha = 1;
        }
      }
    } else if (v === 'splash') {
      for (let k = 0; k < 9; k++) {
        const [cx, cy] = sp(L * 0.55 + Math.sin(k * 7.1) * L * 0.25, 0.4 + Math.cos(k * 3.3) * 0.3);
        const r = 6 + ((k * 13) % 9) * 3;
        P.fill((c) => { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); }, { a: col, o });
      }
    } else if (v === 'sponsor') {
      const tags = ['KUROSHIO', 'STATIC TIRES', 'RAZOR FUEL', 'MIDNIGHT FM'];
      for (let k = 0; k < 3; k++) {
        const [x, y] = sp(S.uF + S.archR + 0.25 + k * 0.85, 0.3 + (k % 2) * 0.12);
        drawSideText(P, tags[(k + (right ? 1 : 0)) % tags.length], x, y, H * 0.032, right, k % 2 ? col : '#f2f2f2');
      }
    } else if (v === 'kanji') {
      const [x, y] = sp(S.uR - S.archR - 0.55, 0.55);
      drawSideText(P, '真夜中', x, y, H * 0.06, right, col);
    }
  }
}

function drawTopVinyl(P, S, look, X, Y, vL, vR, W, H, paintO) {
  if (look.vinyl !== 'stripes' && look.vinyl !== 'checker') return;
  const col = look.paint2 || '#111';
  if (look.vinyl === 'stripes') {
    const half = H * 0.022, gap = H * 0.012;
    for (const s of [-1, 1]) {
      const y = H / 2 + s * (gap + half);
      P.fill((c) => { c.beginPath(); c.rect(0, y - half, W, half * 2); }, { a: col, o: paintO });
    }
  }
}

// --------------------------------------------------------------- caps

/**
 * Front/rear fascia. Drawing happens in meters: x across (car's right → left
 * on the front, left → right on the rear, i.e. as you look at it), y height.
 */
export function paintCap(S, cap, look, which, res = 512) {
  const cw = res, ch = res / 2;
  const P = new Layers(cw, ch, true);
  const fin = FINISHES[look.finish] || FINISHES.metallic;
  const paintO = [fin.coat, fin.rough, fin.metal];
  const w = cap.w, h = cap.h, minY = cap.minY, maxY = cap.maxY;
  // clip to the cap outline (pixel space)
  P.fill((c) => { c.beginPath(); c.rect(0, 0, cw, ch); }, { a: look.paint, o: paintO });
  P.save();
  // meters → px
  const sx = cw / w, sy = ch / h;
  P.setTransform(sx, 0, 0, -sy, cw / 2, ch + minY * sy);
  const m = { w, h, minY, maxY, top: maxY, bot: minY, hw: w / 2 };
  const b = S.b;
  if (which === 'front') drawFront(P, m, b, look, paintO);
  else drawRear(P, m, b, look, paintO);
  P.restore();
  // vinyl stripes continue over the fascia
  if (look.vinyl === 'stripes') {
    const half = cw * 0.035, gap = cw * 0.018;
    for (const s of [-1, 1]) {
      const x = cw / 2 + s * (gap + half);
      P.a.fillStyle = look.paint2 || '#111';
      P.a.fillRect(x - half, 0, half * 2, ch * 0.32);
    }
  }
  return P;
}

const LENS = (c, x0, y0, x1, y1, tint = '#cfd8e6') => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, tint);
  g.addColorStop(0.7, '#6f7783');
  g.addColorStop(1, '#e8eef6');
  return g;
};

function drawFront(P, m, b, look, paintO) {
  const { hw, top, bot } = m;
  const H = top - bot;
  const hs = b.head || 'rect';
  const glass = [1, 0.05, 0.2];
  const black = { a: '#08090a', o: [0, 0.75, 0] };
  const mesh = () => ({ a: meshPattern(P.a), o: [0, 0.8, 0] });
  const frame = { a: '#16171a', o: [0.3, 0.45, 0.1] };
  const chromeS = { a: '#c9cdd3', o: [0.6, 0.15, 1] };
  const kit = look.kit || 'stock';
  void paintO;

  // bumper AO: the lower valance falls into shadow under the nose
  {
    const g = P.a.createLinearGradient(0, bot, 0, bot + H * 0.32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    P.a.fillStyle = g;
    P.a.fillRect(-hw * 1.2, bot - 0.05, hw * 2.4, H * 0.32 + 0.05);
  }

  // --- lower bumper: intakes (style per car; race kits open the mouth up)
  const lowY = bot + H * 0.1;
  const intakeH = H * (kit === 'race' ? 0.42 : 0.36);
  let intake = b.intake || 'center';
  if (kit === 'race' && (intake === 'center' || intake === 'slot' || intake === 'wide')) intake = 'mouth';
  let fogs = [[-hw * 0.74, lowY + intakeH * 0.35], [hw * 0.74, lowY + intakeH * 0.35]];
  const trap = (x0, x1, y0, y1, k = 0.85) => (c) => poly(c, [[x0, y1], [x1, y1], [x1 - (x1 - x0) * (1 - k) / 2, y0], [x0 + (x1 - x0) * (1 - k) / 2, y0]]);
  const opening = (path, style = mesh()) => {
    P.fill(path, frame);
    P.save();
    P.clip(path);
    P.fill((c) => { c.beginPath(); c.rect(-hw * 2, bot - 1, hw * 4, 3); }, style);
    // depth: darker toward the top edge of the opening (bumper overhang shadow)
    const g = P.a.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, 'rgba(0,0,0,0.65)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.15)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    P.a.fillStyle = g;
    P.a.fillRect(-hw * 2, bot - 1, hw * 4, 3);
    P.restore();
  };
  if (intake === 'mouth') {
    opening((c) => rrectPath(c, -hw * 0.64, lowY, hw * 1.28, intakeH, 0.06));
  } else if (intake === 'center') {
    opening((c) => rrectPath(c, -hw * 0.44, lowY, hw * 0.88, intakeH * 0.8, 0.04));
  } else if (intake === 'wide') {
    // hot-hatch bumper: one wide honeycomb slot, fogs at its ends
    opening((c) => rrectPath(c, -hw * 0.7, lowY + intakeH * 0.08, hw * 1.4, intakeH * 0.62, 0.03));
    fogs = [[-hw * 0.6, lowY + intakeH * 0.39], [hw * 0.6, lowY + intakeH * 0.39]];
  } else if (intake === 'oval' || intake === 'fd') {
    const rx = hw * (intake === 'fd' ? 0.42 : 0.56);
    opening((c) => ellipsePath(c, 0, lowY + intakeH * 0.52, rx, intakeH * 0.56));
    if (intake === 'fd') for (const s of [-1, 1]) opening((c) => ellipsePath(c, s * hw * 0.74, lowY + intakeH * 0.42, hw * 0.13, intakeH * 0.3));
  } else if (intake === 'triple') {
    opening((c) => rrectPath(c, -hw * 0.32, lowY, hw * 0.64, intakeH * 1.02, 0.05));
    for (const s of [-1, 1]) opening(trap(s > 0 ? hw * 0.44 : -hw * 0.86, s > 0 ? hw * 0.86 : -hw * 0.44, lowY, lowY + intakeH * 0.9, 0.8));
    fogs = [];
  } else if (intake === 'gtr') {
    // R34-style: a huge intercooler mouth across the bumper + corner ducts
    opening((c) => rrectPath(c, -hw * 0.66, lowY, hw * 1.32, intakeH * 1.05, 0.04));
    for (const s of [-1, 1]) opening(trap(s > 0 ? hw * 0.74 : -hw * 0.93, s > 0 ? hw * 0.93 : -hw * 0.74, lowY, lowY + intakeH * 0.6, 0.75), black);
    fogs = [];
  } else if (intake === 'evo') {
    // Evo VIII: gaping trapezoid mouth, side pockets carrying the fogs
    opening(trap(-hw * 0.52, hw * 0.52, lowY - H * 0.04, lowY + intakeH * 1.2, 0.78));
    for (const s of [-1, 1]) opening(trap(s > 0 ? hw * 0.6 : -hw * 0.94, s > 0 ? hw * 0.94 : -hw * 0.6, lowY, lowY + intakeH * 0.8, 0.8), black);
    fogs = [[-hw * 0.77, lowY + intakeH * 0.42], [hw * 0.77, lowY + intakeH * 0.42]];
  } else if (intake === 'sti') {
    opening(trap(-hw * 0.5, hw * 0.5, lowY + intakeH * 0.05, lowY + intakeH * 0.85, 0.85));
    for (const s of [-1, 1]) opening((c) => rrectPath(c, s > 0 ? hw * 0.62 : -hw * 0.9, lowY + intakeH * 0.12, hw * 0.28, intakeH * 0.56, 0.04), black);
    fogs = [[-hw * 0.76, lowY + intakeH * 0.4], [hw * 0.76, lowY + intakeH * 0.4]];
  } else if (intake === 'z') {
    opening(trap(-hw * 0.7, hw * 0.7, lowY, lowY + intakeH * 1.08, 0.88));
    P.fill((c) => rrectPath(c, -hw * 0.66, lowY + intakeH * 0.5, hw * 1.32, 0.022, 0.008), frame);
    fogs = [[-hw * 0.82, lowY + intakeH * 0.3], [hw * 0.82, lowY + intakeH * 0.3]];
  } else if (intake === 'lambo') {
    opening((c) => rrectPath(c, -hw * 0.34, lowY + intakeH * 0.2, hw * 0.68, intakeH * 0.36, 0.02));
    for (const s of [-1, 1]) opening((c) => poly(c, s > 0
      ? [[hw * 0.42, lowY], [hw * 0.98, lowY], [hw * 0.98, lowY + intakeH * 1.15], [hw * 0.58, lowY + intakeH * 0.75]]
      : [[-hw * 0.42, lowY], [-hw * 0.98, lowY], [-hw * 0.98, lowY + intakeH * 1.15], [-hw * 0.58, lowY + intakeH * 0.75]]));
  } else if (intake === 'slot') {
    P.fill((c) => rrectPath(c, -hw * 0.7, lowY + intakeH * 0.2, hw * 1.4, intakeH * 0.35, 0.03), black);
  }
  // fog lights
  if (b.fog !== false) {
    for (const [fx, fy] of fogs) {
      P.fill((c) => ellipsePath(c, fx, fy, 0.05, 0.038), { a: '#0b0c0e', o: [0.2, 0.4, 0] });
      P.fill((c) => ellipsePath(c, fx, fy, 0.042, 0.031), { a: LENS(P.a, fx - 0.05, fy + 0.04, fx + 0.05, fy - 0.04, '#e9e4c8'), o: glass, e: [0.35, 0, 0] });
    }
  }
  // splitter lip
  if (kit !== 'stock') P.fill((c) => rrectPath(c, -hw * 0.98, bot - 0.01, hw * 1.96, 0.035, 0.01), { a: kit === 'race' ? carbonPattern(P.a) : '#111214', o: [0.3, 0.45, 0.1] });

  // --- grille
  const gs = b.grille || 'mesh';
  const gy0 = top - H * 0.48, gy1 = top - H * 0.12;
  let badgeY = (gy0 + gy1) / 2 + 0.01;
  if (gs === 'mesh' || gs === 'evo') {
    const gw = gs === 'evo' ? hw * 0.55 : hw * 0.42;
    P.fill((c) => poly(c, [[-gw, gy1], [gw, gy1], [gw * 0.82, gy0], [-gw * 0.82, gy0]]), mesh());
    P.stroke((c) => poly(c, [[-gw, gy1], [gw, gy1], [gw * 0.82, gy0], [-gw * 0.82, gy0]]), { a: '#9ea3ab', o: [0.5, 0.2, 1] }, 0.012);
  } else if (gs === 'gtr') {
    // wide, shallow mesh between the lamps, badge on the left
    const gw = hw * 0.5, y0 = top - H * 0.36, y1 = top - H * 0.08;
    P.fill((c) => poly(c, [[-gw, y1], [gw, y1], [gw * 0.9, y0], [-gw * 0.9, y0]]), mesh());
    P.stroke((c) => poly(c, [[-gw, y1], [gw, y1], [gw * 0.9, y0], [-gw * 0.9, y0]]), { a: '#2a2c30', o: [0.4, 0.3, 0.5] }, 0.014);
    P.fill((c) => rrectPath(c, gw * 0.35, (y0 + y1) / 2 - 0.016, 0.11, 0.032, 0.008), { a: '#b3141c', o: [0.8, 0.2, 0.3] });
    badgeY = null;
  } else if (gs === 'golf') {
    // narrow horizontal grille spanning between the headlamps, chrome bar + roundel
    const gw = hw * 0.48, y0 = top - H * 0.34, y1 = top - H * 0.1;
    P.fill((c) => rrectPath(c, -gw, y0, gw * 2, y1 - y0, 0.02), black);
    for (let k = 1; k < 4; k++) P.fill((c) => rrectPath(c, -gw * 0.96, y0 + (y1 - y0) * k / 4 - 0.004, gw * 1.92, 0.008, 0.003), { a: '#2b2d31', o: [0.3, 0.4, 0.2] });
    P.fill((c) => rrectPath(c, -gw, (y0 + y1) / 2 - 0.007, gw * 2, 0.014, 0.004), chromeS);
    badgeY = (y0 + y1) / 2;
  } else if (gs === 'sti') {
    const gw = hw * 0.36, y0 = top - H * 0.46, y1 = top - H * 0.12;
    const hex = (c) => poly(c, [[-gw, y1], [gw, y1], [gw * 1.08, (y0 + y1) / 2], [gw * 0.75, y0], [-gw * 0.75, y0], [-gw * 1.08, (y0 + y1) / 2]]);
    P.fill(hex, mesh());
    P.stroke(hex, chromeS, 0.012);
    P.fill((c) => rrectPath(c, -gw * 1.05, (y0 + y1) / 2 - 0.009, gw * 2.1, 0.018, 0.006), chromeS);
  } else if (gs === 'bars') {
    const gw = hw * 0.4;
    P.fill((c) => rrectPath(c, -gw, gy0, gw * 2, gy1 - gy0, 0.03), black);
    for (let k = 1; k < 4; k++) {
      const y = gy0 + (gy1 - gy0) * k / 4;
      P.fill((c) => rrectPath(c, -gw * 0.95, y - 0.008, gw * 1.9, 0.016, 0.005), { a: '#8b9098', o: [0.6, 0.25, 0.9] });
    }
  } else if (gs === 'kidney') {
    // tall twin kidneys with chrome surrounds and vertical slats
    const kh = H * 0.52, ky = top - H * 0.06 - kh;
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 0.018 : -0.168;
      const path = (c) => rrectPath(c, x0, ky, 0.15, kh, 0.045);
      P.fill(path, black);
      for (let k = 1; k < 6; k++) P.fill((c) => { c.beginPath(); c.rect(x0 + 0.15 * k / 6 - 0.003, ky + 0.01, 0.006, kh - 0.02); }, { a: '#3a3c40', o: [0.4, 0.3, 0.6] });
      P.stroke(path, chromeS, 0.014);
    }
    badgeY = top + 0.01;
  } else if (gs === 'muscle') {
    // upright pony-car grille: dark trapezoid, round fog lamps in its corners
    const gw = hw * 0.66, y0 = gy0 - H * 0.06, y1 = gy1 + H * 0.02;
    const path = (c) => poly(c, [[-gw, y1], [gw, y1], [gw * 0.92, y0], [-gw * 0.92, y0]]);
    P.fill(path, mesh());
    P.stroke(path, { a: '#2a2c30', o: [0.4, 0.3, 0.5] }, 0.016);
    for (const s of [-1, 1]) {
      const fx = s * gw * 0.72, fy = (y0 + y1) / 2;
      P.fill((c) => ellipsePath(c, fx, fy, 0.05, 0.05), { a: '#0b0c0e', o: [0.2, 0.4, 0] });
      P.fill((c) => ellipsePath(c, fx, fy, 0.04, 0.04), { a: LENS(P.a, fx - 0.04, fy + 0.04, fx + 0.04, fy - 0.04, '#e9e4c8'), o: glass, e: [0.5, 0, 0] });
    }
    // galloping-horse badge stand-in
    P.fill((c) => poly(c, [[-0.06, (y0 + y1) / 2 - 0.02], [0.05, (y0 + y1) / 2 + 0.03], [0.07, (y0 + y1) / 2 + 0.01], [-0.03, (y0 + y1) / 2 - 0.03]]), chromeS);
    badgeY = null;
  }
  // badge
  if (gs !== 'none' && badgeY !== null) {
    P.fill((c) => ellipsePath(c, 0, badgeY, 0.045, 0.03), { a: '#d5d9df', o: [0.6, 0.15, 1] });
  }

  // --- pop-up headlight cars: parking lamps live in the bumper
  if (hs === 'popup') {
    for (const s of [-1, 1]) {
      P.fill((c) => rrectPath(c, s > 0 ? hw * 0.52 : -hw * 0.52 - 0.18, lowY + intakeH + 0.03, 0.18, 0.05, 0.015), { a: LENS(P.a, 0, 0, 0.1, 0.05, '#f0c070'), o: glass, e: [0.3, 0, 0] });
    }
  }
  // front plate (JDM cars carry one)
  if (b.frontPlate) drawPlate(P, 0, b.frontPlateY ?? (lowY + intakeH + 0.06), look, 0.38, 0.1);
}

function drawRear(P, m, b, look, paintO) {
  const { hw, top, bot } = m;
  const glass = [1, 0.06, 0.15];
  const kit = look.kit || 'stock';

  // bumper AO: the lower valance falls into shadow
  {
    const g = P.a.createLinearGradient(0, bot, 0, bot + (top - bot) * 0.35);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    P.a.fillStyle = g;
    P.a.fillRect(-hw * 1.2, bot - 0.05, hw * 2.4, (top - bot) * 0.35 + 0.05);
  }
  // lights garnish: a dark panel joining the tail lamps (AE86, 996, Viper…)
  if (b.garnish) {
    const [gy0, gy1, gw] = b.garnish;
    P.fill((c) => rrectPath(c, -hw * gw, gy0, hw * gw * 2, gy1 - gy0, 0.02), { a: '#0d0d0f', o: [1, 0.12, 0.1] });
  }
  // lower bumper / diffuser
  const diffH = (top - bot) * (kit === 'race' ? 0.32 : 0.2);
  P.fill((c) => rrectPath(c, -hw * 0.86, bot, hw * 1.72, diffH, 0.04), { a: kit === 'race' ? carbonPattern(P.a) : '#121315', o: [0.2, 0.55, 0.05] });
  if (kit === 'race' || kit === 'wide') {
    for (let k = -3; k <= 3; k++) P.fill((c) => { c.beginPath(); c.rect(k * hw * 0.2 - 0.008, bot, 0.016, diffH); }, { a: '#2a2c30', o: [0.3, 0.4, 0.3] });
  }
  // reflectors
  for (const s of [-1, 1]) P.fill((c) => rrectPath(c, s > 0 ? hw * 0.66 : -hw * 0.66 - 0.12, bot + diffH + 0.03, 0.12, 0.03, 0.01), { a: '#7a0b10', o: glass });

  // exhaust cut-outs
  const ex = b.exhaust || 'single';
  const exY = bot + diffH * 0.55;
  const exhausts = exhaustLayout(ex, hw);
  for (const x of exhausts) P.fill((c) => ellipsePath(c, x, exY, 0.065, 0.055), { a: '#020202', o: [0, 0.9, 0] });

  // plate
  const plateY = bot + diffH + (top - bot) * 0.14;
  drawPlate(P, 0, plateY, look, 0.36, 0.12, true);
  // plate lights
  P.fill((c) => rrectPath(c, -0.06, plateY + 0.135, 0.12, 0.015, 0.005), { a: '#dfe6f0', o: glass, e: [0.35, 0, 0] });

  // trunk badge + model script
  P.fill((c) => ellipsePath(c, 0, top - (top - bot) * 0.18, 0.04, 0.028), { a: '#d5d9df', o: [0.6, 0.15, 1] });
  if (b.script) {
    P.a.save();
    P.a.scale(1, -1);
    P.a.font = 'italic 800 0.045px Arial, sans-serif';
    P.a.textAlign = 'left';
    P.a.fillStyle = '#d8dce2';
    P.a.fillText(b.script, hw * 0.28, -(top - (top - bot) * 0.42));
    P.a.restore();
  }

}

export function exhaustLayout(ex, hw) {
  switch (ex) {
    case 'dual': return [-hw * 0.62, hw * 0.62];
    case 'dual-right': return [-hw * 0.5, -hw * 0.68];
    case 'dual-center': return [-0.09, 0.09];
    case 'quad': return [-hw * 0.72, -hw * 0.55, hw * 0.55, hw * 0.72];
    case 'center': return [0];
    case 'side': return [];
    case 'single-left': return [hw * 0.6];
    default: return [-hw * 0.6];
  }
}

function drawPlate(P, x, y, look, w = 0.36, h = 0.12, rear = false) {
  const plateCol = '#f0efe6';
  P.fill((c) => rrectPath(c, x - w / 2, y, w, h, 0.012), { a: '#1a1b1d', o: [0, 0.6, 0.2] });
  P.fill((c) => rrectPath(c, x - w / 2 + 0.008, y + 0.008, w - 0.016, h - 0.016, 0.01), { a: plateCol, o: [0.6, 0.35, 0] });
  P.a.save();
  P.a.translate(x, y + h * 0.3);
  P.a.scale(1, -1);
  P.a.font = `800 ${h * 0.62}px "Arial Narrow", Arial, sans-serif`;
  P.a.textAlign = 'center';
  P.a.textBaseline = 'alphabetic';
  P.a.fillStyle = '#1c2a6b';
  P.a.fillText(String(look.plate || 'MIDNITE').slice(0, 8), 0, 0);
  P.a.font = `600 ${h * 0.16}px Arial, sans-serif`;
  P.a.fillStyle = '#9b1c1c';
  P.a.fillText(rear ? 'PORT HALCYON' : '', 0, -h * 0.55);
  P.a.restore();
}

function rrectPath(c, x, y, w, h, r) { rrect(c, x, y, w, h, r); }
function ellipsePath(c, x, y, rx, ry) { ellipse(c, x, y, rx, ry); }

// --------------------------------------------------------------- cabin

/**
 * Greenhouse texture: u = cowl→deck (0..1), v = left belt → roof → right belt.
 * Alpha < 1 = glass (tint), alpha 1 = pillars/roof.
 */
export function paintCabin(S, look, vs, res = 512) {
  const W = res, H = res / 2;
  const P = new Layers(W, H, true);
  const b = S.b;
  const fin = FINISHES[look.finish] || FINISHES.metallic;
  const paintO = [fin.coat, fin.rough, fin.metal];
  const uEnd = b.roadster ? (b.header ?? b.deck) : b.deck;
  const span = uEnd - b.cowl;
  const U = (u) => ((u - b.cowl) / span) * W; // u in meters from the front
  const Y = (v) => (1 - v) * H;
  const vi = (i) => vs[i];
  // fractional ring index → v (left half 0..14, right half mirrored)
  const vf = (fi, right) => {
    const i = right ? 28 - fi : fi;
    const i0 = Math.max(0, Math.min(27, Math.floor(i)));
    return vs[i0] + (vs[i0 + 1] - vs[i0]) * (i - i0);
  };
  const win = { a: 0.06, b: 0.52, c: 0.86, ...(b.win || {}) };
  const roofF = b.roof[1][0], roofR = b.roof[b.roof.length - 2][0];
  const tintA = [0.62, 0.74, 0.85, 0.93][look.tint ?? 1];
  const glassO = [1, 0.04, 0.0];
  const trimO = [0.2, 0.45, 0.1];
  const frameS = { a: '#0c0d0f', o: [0.6, 0.3, 0.1] };

  /**
   * Real glass: punch the area out of the opaque paint, then refill it with a
   * translucent dark tint (alpha = tint) that carries a faint sky reflection
   * toward its upper edge (gradient from (x0,y0) = top to (x1,y1) = bottom).
   */
  const glassFill = (path, x0, y0, x1, y1, alpha = tintA) => {
    P.a.save();
    P.a.globalCompositeOperation = 'destination-out';
    P.a.fillStyle = '#000';
    path(P.a);
    P.a.fill();
    P.a.restore();
    const g = P.a.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(86,98,114,${alpha})`);
    g.addColorStop(0.3, `rgba(30,36,44,${alpha})`);
    g.addColorStop(1, `rgba(9,11,14,${alpha})`);
    P.fill(path, { a: g, o: glassO });
  };

  // everything starts as paint
  P.fill((c) => { c.beginPath(); c.rect(0, 0, W, H); }, { a: look.paint, o: paintO });

  if (b.roadster) {
    // open windshield frame: the side triangles under the A-pillars are cut
    // away (alpha 0, discarded by alphaTest), thin black A-pillars + header,
    // see-through screen between them
    P.a.clearRect(0, 0, W, H);
    const aIn = 8.4, aOut = 5.3;
    const screen = (c) => {
      c.beginPath();
      c.rect(U(b.cowl) + 1, Y(vf(aIn, false)), U(uEnd - 0.035) - U(b.cowl) - 1, Y(vf(aIn, true)) - Y(vf(aIn, false)));
    };
    glassFill(screen, U(uEnd), 0, U(b.cowl), 0, Math.min(0.42, tintA * 0.6));
    for (const right of [false, true]) {
      P.fill((c) => { c.beginPath(); c.rect(0, Y(vf(aOut, right)), W, Y(vf(aIn, right)) - Y(vf(aOut, right))); }, frameS);
    }
    P.fill((c) => { c.beginPath(); c.rect(U(uEnd - 0.035), Y(vf(aOut, true)), W - U(uEnd - 0.035), Y(vf(aOut, false)) - Y(vf(aOut, true))); }, frameS);
    P.fill((c) => { c.beginPath(); c.rect(0, Y(vf(aOut, true)), U(b.cowl + 0.02), Y(vf(aOut, false)) - Y(vf(aOut, true))); }, frameS);
    return P;
  }

  if (look.roof === 'black' || b.blackRoof) P.fill((c) => { c.beginPath(); c.rect(U(roofF), Y(vi(20)), U(roofR) - U(roofF), Y(vi(8)) - Y(vi(20))); }, { a: '#121316', o: [1, 0.2, 0.2] });
  if (look.vinyl === 'stripes') {
    const half = H * 0.03, gap = H * 0.016;
    for (const s of [-1, 1]) {
      P.fill((c) => { c.beginPath(); c.rect(0, H / 2 + s * (gap + half) - half, W, half * 2); }, { a: look.paint2 || '#111', o: paintO });
    }
  }

  // glass areas (paths in px)
  // the glass runs from just above the foot fillet up into the roof corner
  const topIdx = CIDX.sideEnd + 2;
  const sideTop = (right) => Y(right ? vi(28 - topIdx) : vi(topIdx));
  const beltY = (right) => Y(right ? vi(28 - CAB_GLASS_IDX) : vi(CAB_GLASS_IDX));
  const windshield = (c) => {
    c.beginPath();
    c.moveTo(U(b.cowl) + 2, Y(vi(8)));
    c.lineTo(U(roofF) - 3, Y(vi(9)));
    c.lineTo(U(roofF) - 3, Y(vi(19)));
    c.lineTo(U(b.cowl) + 2, Y(vi(20)));
    c.closePath();
  };
  const rearWin = (c) => {
    c.beginPath();
    c.moveTo(U(roofR) + 3, Y(vi(9)));
    c.lineTo(U(b.deck) - 2, Y(vi(8)));
    c.lineTo(U(b.deck) - 2, Y(vi(20)));
    c.lineTo(U(roofR) + 3, Y(vi(19)));
    c.closePath();
  };
  // side DLO. win.c = rear end of the top edge (fraction cowl→deck), cSlant =
  // how far further back (px) the bottom corner runs. win.arc > 0 bows the
  // top edge down toward a pointed rear tip (350Z / 996 teardrop windows).
  const sideWin = (right) => (c) => {
    const yb = beltY(right) + (right ? 3 : -3);
    const uc = b.cowl + span * win.c;
    const x0 = U(b.cowl) + 1;
    c.beginPath();
    c.moveTo(x0, yb);
    if (win.arc) {
      const tip = U(uc) + (win.cSlant ?? 14);
      const xa = U(b.cowl + span * (win.arcFrom ?? 0.45));
      const n = 14;
      c.lineTo(x0, Y(vf(topIdx, right)) + (right ? -2 : 2));
      for (let k = 0; k <= n; k++) {
        const x = xa + (tip - xa) * (k / n);
        const t = Math.pow(k / n, 1.6);
        const fi = topIdx - (topIdx - CAB_GLASS_IDX - 0.4) * Math.min(1, t * (1 + win.arc) - win.arc * t * t);
        c.lineTo(x, Y(vf(Math.max(CAB_GLASS_IDX + 0.25, fi), right)) + (right ? -2 : 2));
      }
      c.lineTo(tip, yb);
    } else {
      const yt = sideTop(right) + (right ? -2 : 2);
      c.lineTo(x0, yt);
      c.lineTo(U(uc) - 10, yt);
      c.quadraticCurveTo(U(uc) + 2, yt, U(uc) + (win.cSlant ?? 14), yb);
    }
    c.closePath();
  };
  // windshield: sky toward the header; rear glass: sky toward the roof
  glassFill(windshield, U(roofF), 0, U(b.cowl), 0);
  if (b.engineCover) {
    // mid-engine: a painted cover with louvers behind a small upright rear glass
    const r0 = U(roofR) + 3, r1 = U(b.deck) - 2;
    glassFill((c) => { c.beginPath(); c.rect(r0, Y(vi(9)), (r1 - r0) * 0.18, Y(vi(19)) - Y(vi(9))); }, r0, 0, r1, 0);
    for (let k = 0; k < 7; k++) {
      const x = r0 + (r1 - r0) * (0.28 + k * 0.095);
      P.fill((c) => { c.beginPath(); c.rect(x, Y(vi(10)), (r1 - r0) * 0.05, Y(vi(18)) - Y(vi(10))); }, { a: '#0a0a0b', o: [0, 0.8, 0] });
    }
  } else glassFill(rearWin, U(roofR), 0, U(b.deck), 0);
  for (const right of [false, true]) {
    glassFill(sideWin(right), 0, sideTop(right), 0, beltY(right));
    // B-pillar (black)
    if (win.b < 0.98) {
      const ub = U(b.cowl + span * win.b);
      P.fill((c) => { c.beginPath(); c.rect(ub - W * 0.018, Math.min(sideTop(right), beltY(right)), W * 0.036, Math.abs(beltY(right) - sideTop(right))); }, frameS);
    }
    // window trim (black rubber) along the belt
    P.fill((c) => { c.beginPath(); c.rect(U(b.cowl), Math.min(beltY(right) - 3, beltY(right) + 3), U(b.cowl + span * win.c) - U(b.cowl) + 14, 6); }, { a: '#0b0b0c', o: trimO });
  }
  // black frit + wipers on the windshield
  P.stroke(windshield, { a: 'rgba(5,5,6,0.95)', o: trimO }, 6);
  if (!b.engineCover) P.stroke(rearWin, { a: 'rgba(5,5,6,0.95)', o: trimO }, 5);
  for (const k of [0, 1]) {
    const y = H / 2 + (k ? -1 : 1) * H * 0.12;
    P.stroke((c) => { c.beginPath(); c.moveTo(U(b.cowl) + 5, y); c.lineTo(U(b.cowl) + 5 + W * 0.05, y + (k ? -1 : 1) * H * 0.1); }, { a: '#050505' }, 2.5);
  }
  // rear defroster lines
  for (let k = 1; k < 7 && !b.engineCover; k++) {
    const x = U(roofR) + (U(b.deck) - U(roofR)) * k / 7;
    P.a.strokeStyle = `rgba(120,60,30,${0.3 * tintA})`;
    P.a.lineWidth = 1;
    P.a.beginPath();
    P.a.moveTo(x, Y(vi(10)));
    P.a.lineTo(x, Y(vi(18)));
    P.a.stroke();
  }
  // third brake light at the top of the rear window
  P.fill((c) => { c.beginPath(); c.rect(U(roofR) + 4, H / 2 - H * 0.06, W * 0.012, H * 0.12); }, { a: '#5a0a0e', o: glassO, e: [0, 0.2, 1] });
  // windshield banner (2000s tuner staple)
  if (look.banner) {
    P.a.save();
    P.fill((c) => { c.beginPath(); c.rect(U(roofF) - W * 0.06, Y(vi(19)), W * 0.05, Y(vi(9)) - Y(vi(19))); }, { a: '#0c0c0c', o: trimO });
    P.a.translate(U(roofF) - W * 0.035, H / 2);
    P.a.rotate(Math.PI / 2);
    P.a.font = `900 ${W * 0.035}px Arial, sans-serif`;
    P.a.textAlign = 'center';
    P.a.textBaseline = 'middle';
    P.a.fillStyle = look.paint2 && look.paint2 !== '#111' ? look.paint2 : '#f2f2f2';
    P.a.fillText(String(look.banner).toUpperCase(), 0, 0);
    P.a.restore();
  }
  return P;
}

// --------------------------------------------------------------- tires

let _tire = null;
export function tireCanvas() {
  if (_tire) return _tire;
  const W = 512, H = 64;
  const c = canvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = '#141414';
  x.fillRect(0, 0, W, H);
  // tread band in the middle rows (lathe v runs across the tire profile)
  x.fillStyle = '#0c0c0c';
  for (let i = 0; i < W; i += 8) {
    x.fillRect(i, H * 0.3, 3, H * 0.4);
  }
  x.fillStyle = '#070707';
  x.fillRect(0, H * 0.42, W, 2);
  x.fillRect(0, H * 0.58, W, 2);
  // sidewall lettering on both walls
  x.font = 'bold 9px Arial, sans-serif';
  x.fillStyle = '#5a5a5a';
  for (const y of [H * 0.12, H * 0.92]) {
    for (let k = 0; k < 4; k++) x.fillText('KUMORI  SPORT-R  235/40ZR18', k * 128 + 6, y);
  }
  _tire = c;
  return c;
}
