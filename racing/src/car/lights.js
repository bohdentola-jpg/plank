// Head/tail light unit graphics, drawn for projected patches (see hull.js).
// Box space: x 0 (inner) → 1 (outer), y 0 (bottom) → 1 (top), in meters via
// the patch's real width/height so circles stay round. Alpha cuts the shape.
import { Layers } from './paint.js';

function shapePath(style, w, h, kind) {
  // returns (ctx) => path in meter space (origin bottom-left of box)
  const P = (pts) => (c) => {
    c.beginPath();
    c.moveTo(pts[0][0] * w, pts[0][1] * h);
    for (const p of pts.slice(1)) c.lineTo(p[0] * w, p[1] * h);
    c.closePath();
  };
  const RR = (x, y, ww, hh, r) => (c) => {
    c.beginPath();
    c.roundRect ? c.roundRect(x * w, y * h, ww * w, hh * h, r) : c.rect(x * w, y * h, ww * w, hh * h);
  };
  const E = (cx, cy, rx, ry, rot = 0) => (c) => { c.beginPath(); c.ellipse(cx * w, cy * h, rx * w, ry * h, rot, 0, Math.PI * 2); };
  const circles = (n, r) => (c) => {
    c.beginPath();
    for (let k = 0; k < n; k++) {
      const cx = w - (r + 0.01 + k * (2 * r + 0.025));
      c.moveTo(cx + r, h / 2);
      c.arc(cx, h / 2, r, 0, Math.PI * 2);
    }
  };
  if (kind === 'head') {
    switch (style) {
      case 'slant': return P([[0.0, 0.08], [0.04, 0.62], [0.55, 0.88], [1.0, 1.0], [0.97, 0.3], [0.62, 0.2], [0.5, 0.0]]);
      case 'rect': return RR(0.02, 0.06, 0.96, 0.88, Math.min(w, h) * 0.18);
      case 'round2': case 'quad': return circles(2, Math.min(h * 0.46, w * 0.24));
      case 'oval': return E(0.5, 0.5, 0.48, 0.44);
      case 'teardrop': return E(0.55, 0.5, 0.42, 0.4, -0.25);
      case 'thin': return P([[0, 0.1], [0.08, 0.55], [1, 1], [0.95, 0.55]]);
      case 'squint': return P([[0.0, 0.0], [0.08, 0.95], [1.0, 1.0], [0.96, 0.15]]);
      case 'swoop': return P([[0, 0.3], [0.1, 0.85], [0.7, 1.0], [1.0, 0.9], [0.92, 0.1], [0.4, 0.0]]);
      default: return RR(0.02, 0.06, 0.96, 0.88, Math.min(w, h) * 0.15);
    }
  }
  switch (style) {
    case 'wrap': return P([[0.0, 0.55], [0.05, 0.95], [1.0, 1.0], [1.0, 0.0], [0.55, 0.05]]);
    case 'round2': return circles(2, Math.min(h * 0.46, w * 0.23));
    case 'round3': return circles(3, Math.min(h * 0.44, w * 0.155));
    case 'bar': return RR(0.0, 0.08, 1.0, 0.84, Math.min(w, h) * 0.12);
    case 'vbar3': return (c) => { c.beginPath(); for (let k = 0; k < 3; k++) c.rect(w * (0.05 + k * 0.33), h * 0.05, w * 0.24, h * 0.9); };
    case 'L': return P([[0, 0.45], [0, 1], [1, 1], [1, 0], [0.62, 0], [0.62, 0.45]]);
    case 'boomerang': return P([[0, 0.55], [0.02, 0.98], [1, 1], [1, 0.0], [0.82, 0.0], [0.8, 0.52]]);
    case 'oval': return E(0.5, 0.5, 0.48, 0.42);
    case 'strip': return RR(0.0, 0.2, 1.0, 0.6, h * 0.2);
    case 'vertical': return RR(0.25, 0.0, 0.75, 1.0, w * 0.1);
    default: return RR(0, 0.1, 1, 0.8, h * 0.1);
  }
}

/**
 * Paint a light unit. kind 'head' | 'tail'. w/h in meters.
 * Returns Layers (albedo with alpha cut, orm, emissive channels).
 */
export function paintLight(kind, style, w, h, opts = {}) {
  const res = opts.res || 256;
  const cw = res, ch = Math.max(32, Math.round(res * Math.min(1, h / w) * 1.0));
  const L = new Layers(cw, ch, true);
  L.a.clearRect(0, 0, cw, ch);
  // meters → px, y up
  L.setTransform(cw / w, 0, 0, -ch / h, 0, ch);
  const clear = style.endsWith('-clear');
  const st = clear ? style.replace('-clear', '') : style;
  const path = shapePath(st, w, h, kind);
  const glassO = [1, 0.05, 0.25];

  if (kind === 'head') {
    // housing + chrome reflector + lens
    L.fill(path, { a: '#0d0f12', o: [1, 0.1, 0.6] });
    L.save();
    L.clip(path);
    const g = L.a.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, '#9aa3ae');
    g.addColorStop(0.3, '#e7edf5');
    g.addColorStop(0.55, '#7a828d');
    g.addColorStop(1, '#dbe2ea');
    L.fill((c) => { c.beginPath(); c.rect(0, 0, w, h); }, { a: g, o: [1, 0.06, 1], e: [0.12, 0, 0] });
    // projector bowls along the unit
    const n = st === 'round2' || st === 'quad' ? 2 : (w > 0.34 ? 2 : 1);
    const r = Math.min(h * 0.32, w * 0.16);
    for (let k = 0; k < n; k++) {
      const cx = st === 'round2' || st === 'quad' ? w - (Math.min(h * 0.46, w * 0.24) + 0.01 + k * (2 * Math.min(h * 0.46, w * 0.24) + 0.025)) : w * (0.66 - k * 0.32);
      const cy = h * (st === 'slant' ? 0.55 + k * 0.05 : 0.5);
      L.fill((c) => { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); }, { a: '#1a1d22', o: glassO, e: [0.5, 0, 0] });
      const lg = L.a.createRadialGradient(cx - r * 0.3, cy + r * 0.3, 0, cx, cy, r * 0.8);
      lg.addColorStop(0, '#ffffff');
      lg.addColorStop(0.6, '#cfd8e8');
      lg.addColorStop(1, '#4b5260');
      L.fill((c) => { c.beginPath(); c.arc(cx, cy, r * 0.78, 0, Math.PI * 2); }, { a: lg, o: glassO, e: [1, 0, 0] });
    }
    // amber indicator strip at the outer end
    if (opts.amber !== false && st !== 'round2' && st !== 'quad') {
      L.fill((c) => { c.beginPath(); c.rect(w * 0.88, 0, w * 0.12, h); }, { a: '#e8962a', o: glassO });
    }
    L.restore();
    L.stroke(path, { a: '#c8ced6', o: [0.8, 0.1, 1] }, Math.max(0.004, h * 0.04));
  } else {
    L.fill(path, { a: '#1a0406', o: [1, 0.08, 0.2] });
    L.save();
    L.clip(path);
    const g = L.a.createLinearGradient(0, h, 0, 0);
    if (clear) {
      g.addColorStop(0, '#f4f6f9'); g.addColorStop(0.5, '#a4abb5'); g.addColorStop(1, '#e8ecf1');
    } else {
      g.addColorStop(0, '#ff6a64'); g.addColorStop(0.4, '#c3141c'); g.addColorStop(1, '#5d0509');
    }
    L.fill((c) => { c.beginPath(); c.rect(0, 0, w, h); }, { a: g, o: glassO, e: [0, clear ? 0.2 : 1, clear ? 0.3 : 1] });
    // inner ring details
    if (st === 'round2' || st === 'round3' || clear) {
      const n = st === 'round3' ? 3 : 2;
      const rr = st === 'round3' ? Math.min(h * 0.44, w * 0.155) : Math.min(h * 0.46, w * 0.23);
      for (let k = 0; k < n; k++) {
        const cx = w - (rr + 0.01 + k * (2 * rr + 0.025));
        L.fill((c) => { c.beginPath(); c.arc(cx, h / 2, rr * 0.62, 0, Math.PI * 2); }, { a: '#ff2a2a', o: glassO, e: [0, 1, 1] });
        L.stroke((c) => { c.beginPath(); c.arc(cx, h / 2, rr * 0.85, 0, Math.PI * 2); }, { a: 'rgba(255,190,190,0.6)' }, rr * 0.08);
      }
    } else {
      // horizontal lens ribs
      for (let k = 1; k < 4; k++) {
        L.a.fillStyle = 'rgba(255,255,255,0.12)';
        L.a.fillRect(0, h * k / 4, w, h * 0.03);
      }
    }
    // reverse lamp at the inner end
    if (st === 'bar' || st === 'wrap' || st === 'L' || st === 'boomerang') {
      L.fill((c) => { c.beginPath(); c.rect(0, 0, w * 0.18, h); }, { a: '#e3e7ec', o: glassO });
    }
    L.restore();
    L.stroke(path, { a: '#260608', o: [0.3, 0.3, 0] }, Math.max(0.004, h * 0.035));
  }
  // alpha cut: everything outside the shape (plus its rim stroke) transparent
  const mask = document.createElement('canvas');
  mask.width = cw;
  mask.height = ch;
  const m = mask.getContext('2d');
  m.setTransform(cw / w, 0, 0, -ch / h, 0, ch);
  m.fillStyle = '#000';
  m.strokeStyle = '#000';
  m.lineWidth = Math.max(0.004, h * 0.04);
  path(m);
  m.fill();
  m.stroke();
  L.a.save();
  L.a.setTransform(1, 0, 0, 1, 0, 0);
  L.a.globalCompositeOperation = 'destination-in';
  L.a.drawImage(mask, 0, 0);
  L.a.restore();
  // white-on-black shape mask (alphaMap for a clear lens cover over the unit)
  const M = document.createElement('canvas');
  M.width = cw;
  M.height = ch;
  const mc = M.getContext('2d');
  mc.fillStyle = '#000';
  mc.fillRect(0, 0, cw, ch);
  mc.setTransform(cw / w, 0, 0, -ch / h, 0, ch);
  mc.fillStyle = '#fff';
  path(mc);
  mc.fill();
  L.M = M;
  return L;
}
