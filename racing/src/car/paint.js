// Canvas texture painter for the procedural cars. Every surface gets three
// layers drawn in lockstep:
//   albedo  (sRGB color, alpha = glass transparency on the cabin)
//   orm     (R clearcoat, G roughness, B metalness)
//   emissive(R headlight, G tail-light, B brake-light) — masks the light
//            shader multiplies by live intensities.
import { IDX, CIDX } from './hull.js';

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
    g.addColorStop(0, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    P.a.fillStyle = g;
    P.a.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
  };
  shadeBand(IDX.cornerEnd, IDX.cornerEnd + 4, false);
  shadeBand(IDX.cornerEnd, IDX.cornerEnd + 4, true);

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
  const hs = b.head || 'rect';
  const glass = [1, 0.05, 0.2];
  const black = { a: '#08090a', o: [0, 0.75, 0] };
  const trim = { a: '#1a1b1e', o: [0.2, 0.5, 0.1] };
  const kit = look.kit || 'stock';

  // --- lower bumper: intakes
  const lowY = bot + (top - bot) * 0.12;
  const intakeH = (top - bot) * (kit === 'race' ? 0.42 : 0.34);
  const intake = b.intake || 'center';
  if (intake === 'mouth' || kit === 'race') {
    P.fill((c) => rrectPath(c, -hw * 0.62, lowY, hw * 1.24, intakeH, 0.05), { a: meshPattern(P.a), o: [0, 0.8, 0] });
  } else if (intake === 'center') {
    P.fill((c) => rrectPath(c, -hw * 0.42, lowY, hw * 0.84, intakeH * 0.8, 0.04), { a: meshPattern(P.a), o: [0, 0.8, 0] });
  } else if (intake === 'triple') {
    P.fill((c) => rrectPath(c, -hw * 0.3, lowY, hw * 0.6, intakeH, 0.04), { a: meshPattern(P.a), o: [0, 0.8, 0] });
    for (const s of [-1, 1]) P.fill((c) => rrectPath(c, s > 0 ? hw * 0.42 : -hw * 0.78, lowY, hw * 0.36, intakeH * 0.7, 0.04), { a: meshPattern(P.a), o: [0, 0.8, 0] });
  } else if (intake === 'slot') {
    P.fill((c) => rrectPath(c, -hw * 0.7, lowY + intakeH * 0.2, hw * 1.4, intakeH * 0.35, 0.03), black);
  }
  // fog lights
  if (b.fog !== false) {
    for (const s of [-1, 1]) {
      const fx = s * hw * 0.74, fy = lowY + intakeH * 0.35;
      P.fill((c) => ellipsePath(c, fx, fy, 0.055, 0.04), { a: LENS(P.a, fx - 0.05, fy + 0.04, fx + 0.05, fy - 0.04, '#e9e4c8'), o: glass, e: [0.35, 0, 0] });
    }
  }
  // splitter lip
  if (kit !== 'stock') P.fill((c) => rrectPath(c, -hw * 0.98, bot - 0.01, hw * 1.96, 0.035, 0.01), { a: kit === 'race' ? carbonPattern(P.a) : '#111214', o: [0.3, 0.45, 0.1] });

  // --- grille
  const gs = b.grille || 'mesh';
  const gy0 = top - (top - bot) * 0.48, gy1 = top - (top - bot) * 0.12;
  if (gs === 'mesh' || gs === 'evo') {
    const gw = gs === 'evo' ? hw * 0.55 : hw * 0.42;
    P.fill((c) => poly(c, [[-gw, gy1], [gw, gy1], [gw * 0.82, gy0], [-gw * 0.82, gy0]]), { a: meshPattern(P.a), o: [0, 0.8, 0] });
    P.stroke((c) => poly(c, [[-gw, gy1], [gw, gy1], [gw * 0.82, gy0], [-gw * 0.82, gy0]]), { a: '#9ea3ab', o: [0.5, 0.2, 1] }, 0.012);
  } else if (gs === 'bars') {
    const gw = hw * 0.4;
    P.fill((c) => rrectPath(c, -gw, gy0, gw * 2, gy1 - gy0, 0.03), black);
    for (let k = 1; k < 4; k++) {
      const y = gy0 + (gy1 - gy0) * k / 4;
      P.fill((c) => rrectPath(c, -gw * 0.95, y - 0.008, gw * 1.9, 0.016, 0.005), { a: '#8b9098', o: [0.6, 0.25, 0.9] });
    }
  } else if (gs === 'kidney') {
    for (const s of [-1, 1]) {
      P.fill((c) => rrectPath(c, s > 0 ? 0.02 : -0.17, gy0 - 0.02, 0.15, gy1 - gy0 + 0.04, 0.04), black);
      P.stroke((c) => rrectPath(c, s > 0 ? 0.02 : -0.17, gy0 - 0.02, 0.15, gy1 - gy0 + 0.04, 0.04), { a: '#c9cdd3', o: [0.6, 0.15, 1] }, 0.012);
    }
  } else if (gs === 'muscle') {
    P.fill((c) => rrectPath(c, -hw * 0.7, gy0 - 0.03, hw * 1.4, gy1 - gy0 + 0.02, 0.04), { a: meshPattern(P.a), o: [0, 0.8, 0] });
  }
  // badge
  if (gs !== 'none') {
    P.fill((c) => ellipsePath(c, 0, (gy0 + gy1) / 2 + 0.01, 0.045, 0.03), { a: '#d5d9df', o: [0.6, 0.15, 1] });
  }

  // --- pop-up headlight cars: parking lamps live in the bumper
  if (hs === 'popup') {
    for (const s of [-1, 1]) {
      P.fill((c) => rrectPath(c, s > 0 ? hw * 0.52 : -hw * 0.52 - 0.18, lowY + intakeH + 0.03, 0.18, 0.05, 0.015), { a: LENS(P.a, 0, 0, 0.1, 0.05, '#f0c070'), o: glass, e: [0.3, 0, 0] });
    }
  }
  // front plate (JDM cars carry one)
  if (b.frontPlate) drawPlate(P, 0, lowY + intakeH + 0.08, look, 0.38, 0.1);
}

function drawRear(P, m, b, look, paintO) {
  const { hw, top, bot } = m;
  const glass = [1, 0.06, 0.15];
  const kit = look.kit || 'stock';

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
  const span = b.deck - b.cowl;
  const U = (u) => ((u - b.cowl) / span) * W; // u in meters from the front
  const Y = (v) => (1 - v) * H;
  const vi = (i) => vs[i];
  const win = { a: 0.06, b: 0.52, c: 0.86, ...(b.win || {}) };
  const roofF = b.roof[1][0], roofR = b.roof[b.roof.length - 2][0];
  const tintA = [0.62, 0.74, 0.85, 0.93][look.tint ?? 1];
  const glassA = `rgba(18,22,28,${tintA})`;
  const glassO = [1, 0.04, 0.0];
  const trimO = [0.2, 0.45, 0.1];

  // everything starts as paint
  P.fill((c) => { c.beginPath(); c.rect(0, 0, W, H); }, { a: look.paint, o: paintO });
  if (look.roof === 'black' || b.blackRoof) P.fill((c) => { c.beginPath(); c.rect(U(roofF), Y(vi(20)), U(roofR) - U(roofF), Y(vi(8)) - Y(vi(20))); }, { a: '#121316', o: [1, 0.2, 0.2] });
  if (look.vinyl === 'stripes') {
    const half = H * 0.03, gap = H * 0.016;
    for (const s of [-1, 1]) {
      P.fill((c) => { c.beginPath(); c.rect(0, H / 2 + s * (gap + half) - half, W, half * 2); }, { a: look.paint2 || '#111', o: paintO });
    }
  }

  // glass areas (paths in px)
  // the glass runs from the belt right up into the roof corner (thin roof rail)
  const topIdx = CIDX.sideEnd + 2;
  const sideTop = (right) => Y(right ? vi(28 - topIdx) : vi(topIdx));
  const beltY = (right) => Y(right ? vi(28) : vi(0));
  const pillarIn = (right) => Y(right ? vi(28 - 7) : vi(7));
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
  const sideWin = (right) => (c) => {
    const yt = sideTop(right) + (right ? -2 : 2);
    const yb = beltY(right) + (right ? 3 : -3);
    const uc = b.cowl + span * win.c;
    c.beginPath();
    c.moveTo(U(b.cowl) + 1, yb);
    c.lineTo(U(b.cowl) + 1, yt);
    c.lineTo(U(uc) - 10, yt);
    c.quadraticCurveTo(U(uc) + 2, yt, U(uc) + (win.cSlant ?? 14), yb);
    c.closePath();
  };
  const glass = { a: glassA, o: glassO };
  if (b.roadster) {
    // just a framed windshield: all glass, black frame + header
    P.fill((c) => { c.beginPath(); c.rect(0, 0, W, H); }, { a: `rgba(18,22,28,${Math.min(0.55, tintA)})`, o: glassO });
    P.stroke((c) => { c.beginPath(); c.rect(2, 2, W - 4, H - 4); }, { a: '#0b0b0c', o: trimO }, 10);
    P.fill((c) => { c.beginPath(); c.rect(W * 0.86, 0, W * 0.14, H); }, { a: '#0b0b0c', o: trimO });
    return P;
  }
  P.fill(windshield, glass);
  P.fill(rearWin, glass);
  for (const right of [false, true]) {
    P.fill(sideWin(right), glass);
    // B-pillar (black)
    const ub = U(b.cowl + span * win.b);
    P.fill((c) => { c.beginPath(); c.rect(ub - W * 0.018, Math.min(sideTop(right), beltY(right)), W * 0.036, Math.abs(beltY(right) - sideTop(right))); }, { a: '#0c0d0f', o: [0.6, 0.25, 0.1] });
    // window trim (black rubber) along the belt and top
    P.fill((c) => { c.beginPath(); c.rect(U(b.cowl), Math.min(beltY(right) - 3, beltY(right) + 3), U(b.cowl + span * win.c) - U(b.cowl) + 14, 6); }, { a: '#0b0b0c', o: trimO });
    // A-pillar band
    void pillarIn;
  }
  // black frit + wipers on the windshield
  P.stroke(windshield, { a: 'rgba(5,5,6,0.95)', o: trimO }, 6);
  P.stroke(rearWin, { a: 'rgba(5,5,6,0.95)', o: trimO }, 5);
  for (const k of [0, 1]) {
    const y = H / 2 + (k ? -1 : 1) * H * 0.12;
    P.stroke((c) => { c.beginPath(); c.moveTo(U(b.cowl) + 5, y); c.lineTo(U(b.cowl) + 5 + W * 0.05, y + (k ? -1 : 1) * H * 0.1); }, { a: '#050505' }, 2.5);
  }
  // rear defroster lines
  for (let k = 1; k < 7; k++) {
    const x = U(roofR) + (U(b.deck) - U(roofR)) * k / 7;
    P.a.strokeStyle = 'rgba(120,60,30,0.35)';
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
