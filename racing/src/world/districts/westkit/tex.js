// PORT HALCYON — the west's canvas textures (drawn once, at load, in the
// packs' warm()): facade atlases (one storey per band, each band a different
// wall: logs, painted boards, brick, stucco, with windows that light at
// night in a matching emissive map), corrugated metal, roofing, bark, crops,
// the circuits' tyre walls, catch fence, crowds and sponsor boards, signs.
// Cached by key (a texture shared by several packs is drawn once).
import { toTex } from '../../../track/textures.js';
import { makeRng } from '../../../core/util.js';

const CACHE = new Map();
export const once = (key, fn) => { if (!CACHE.has(key)) CACHE.set(key, fn()); return CACHE.get(key); };

export function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export const FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';

/** Text that shrinks to fit (max px wide). */
export function text(x, s, px, py, size, col, o = {}) {
  let sz = size;
  const font = () => `${o.italic ? 'italic ' : ''}${o.w || 900} ${sz}px ${o.f || FONT}`;
  x.font = font();
  while (o.max && x.measureText(s).width > o.max && sz > 8) { sz -= 2; x.font = font(); }
  x.textAlign = o.align || 'center';
  x.textBaseline = 'middle';
  if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = o.blur || 14; }
  if (o.stroke) { x.lineWidth = o.stroke; x.strokeStyle = o.sc || '#000'; x.lineJoin = 'round'; x.strokeText(s, px, py); }
  x.fillStyle = col;
  x.fillText(s, px, py);
  x.shadowBlur = 0;
}

export function speckle(x, w, h, rng, n, cols, a0 = 0.15, a1 = 0.5, s0 = 1, s1 = 2) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = cols[(rng() * cols.length) | 0];
    x.globalAlpha = a0 + rng() * (a1 - a0);
    const s = s0 + rng() * (s1 - s0);
    x.fillRect(rng() * w, rng() * h, s, s);
  }
  x.globalAlpha = 1;
}

export function streaks(x, w, h, rng, n, col, a = 0.18, y0 = 0) {
  for (let i = 0; i < n; i++) {
    const sx = rng() * w, sw = 1 + rng() * 5, sy = y0 + rng() * h * 0.4;
    const g = x.createLinearGradient(0, sy, 0, h);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g;
    x.fillRect(sx, sy, sw, h - sy);
  }
}

/**
 * A facade atlas: bands stacked bottom-up, each one storey of a wall type.
 * bands: [(x, e, W, H, rng) → void] drawing into the band's own space (the
 * context is translated, y down from the band's top). Returns { map, emi,
 * n }: a wall uses band k as v0 = k / n with V = storey × n (see wall()).
 */
export function bandAtlas(key, W, bandH, bands) {
  return once('atlas:' + key, () => {
    const n = bands.length;
    const [c, x] = cvs(W, bandH * n);
    const [ce, e] = cvs(W, bandH * n);
    e.fillStyle = '#000';
    e.fillRect(0, 0, W, bandH * n);
    const rng = makeRng('atlas' + key);
    bands.forEach((fn, k) => {
      // band k from the bottom: canvas rows from the top
      const top = (n - 1 - k) * bandH;
      x.save(); e.save();
      x.translate(0, top); e.translate(0, top);
      x.beginPath(); x.rect(0, 0, W, bandH); x.clip();
      e.beginPath(); e.rect(0, 0, W, bandH); e.clip();
      fn(x, e, W, bandH, rng);
      x.restore(); e.restore();
    });
    return { map: toTex(c), emi: toTex(ce), n };
  });
}

/** A window in a facade band (dark or lit, with its emissive), frame and sill. */
export function windowPane(x, e, wx, wy, ww, wh, lit, rng, o = {}) {
  const warm = o.warm ?? '#ffcc88';
  x.fillStyle = o.frame || '#e8e2d4';
  x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  if (lit) {
    const g = x.createLinearGradient(0, wy, 0, wy + wh);
    g.addColorStop(0, o.litTop || '#ffe2a8');
    g.addColorStop(1, o.litBot || '#e8a860');
    x.fillStyle = g;
  } else x.fillStyle = o.dark || `rgb(${20 + rng() * 14},${26 + rng() * 14},${34 + rng() * 16})`;
  x.fillRect(wx, wy, ww, wh);
  if (lit) {
    e.globalAlpha = o.glow ?? (0.55 + rng() * 0.4);
    e.fillStyle = warm;
    e.fillRect(wx, wy, ww, wh);
    e.globalAlpha = 1;
    // a curtain / a figure
    if (rng() < 0.35) { x.fillStyle = 'rgba(80,40,20,0.35)'; x.fillRect(wx, wy, ww * (0.2 + rng() * 0.3), wh); }
  } else {
    // reflections on dark glass
    x.fillStyle = 'rgba(255,255,255,0.08)';
    x.beginPath(); x.moveTo(wx + ww * 0.2, wy); x.lineTo(wx + ww * 0.45, wy); x.lineTo(wx + ww * 0.15, wy + wh); x.lineTo(wx, wy + wh); x.fill();
  }
  if (o.bars !== false) {
    x.fillStyle = o.frame || '#e8e2d4';
    const nb = o.panes ?? 2;
    for (let k = 1; k < nb; k++) x.fillRect(wx + (ww * k) / nb - 1.5, wy, 3, wh);
    if (o.cross !== false) x.fillRect(wx, wy + wh * 0.5 - 1.5, ww, 3);
  }
  if (o.sill !== false) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(wx - 4, wy + wh + 3, ww + 8, 4); }
}

/** Corrugated sheet (greyscale: tint by vertex colour): u across ribs, rust streaks. */
export function corrugatedTex(key = 'c', o = {}) {
  return once('corr:' + key, () => {
    const S = 256;
    const [c, x] = cvs(S, S);
    const rng = makeRng('corr' + key);
    const base = o.base || '#c8c8c8';
    x.fillStyle = base;
    x.fillRect(0, 0, S, S);
    const rib = o.rib || 16;
    for (let px = 0; px < S; px += rib) {
      const g = x.createLinearGradient(px, 0, px + rib, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.28)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.22)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.28)');
      x.fillStyle = g;
      x.fillRect(px, 0, rib, S);
    }
    speckle(x, S, S, rng, 2500, ['#000000', '#ffffff', '#6a4a30'], 0.04, 0.16);
    if (o.rust) {
      streaks(x, S, S, rng, o.rust, '120,62,30', 0.35);
      for (let i = 0; i < o.rust; i++) {
        const px = rng() * S, py = rng() * S, r = 4 + rng() * 22;
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, 'rgba(110,50,20,0.45)');
        g.addColorStop(1, 'rgba(110,50,20,0)');
        x.fillStyle = g;
        x.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }
    // panel laps
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(0, S - 3, S, 3);
    for (let i = 0; i < 18; i++) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(rng() * S, (rng() < 0.5 ? 4 : S - 8), 2, 2); }
    return toTex(c);
  });
}

/** Roofing (greyscale, tinted): 'shingle' | 'tile' (barrel tiles) | 'seam' (standing seam) | 'tar'. */
export function roofTex(kind) {
  return once('roof:' + kind, () => {
    const S = 256;
    const [c, x] = cvs(S, S);
    const rng = makeRng('roof' + kind);
    x.fillStyle = '#bdbdbd';
    x.fillRect(0, 0, S, S);
    if (kind === 'shingle') {
      const rh = 16;
      for (let y = 0, row = 0; y < S; y += rh, row++) {
        let px = row % 2 ? -10 : 0;
        while (px < S) {
          const w = 14 + rng() * 14;
          const t = 150 + rng() * 70;
          x.fillStyle = `rgb(${t},${t},${t})`;
          x.fillRect(px + 1, y + 1, w - 2, rh - 1);
          x.fillStyle = 'rgba(0,0,0,0.35)';
          x.fillRect(px, y + rh - 3, w, 3);
          px += w;
        }
      }
    } else if (kind === 'tile') {
      // barrel tiles in rows (u across 0.4 m tiles, v down the slope)
      const tw = 21, th = 32;
      for (let y = 0; y < S; y += th) {
        for (let px = 0; px < S; px += tw) {
          const g = x.createLinearGradient(px, 0, px + tw, 0);
          const t = 0.85 + rng() * 0.3;
          g.addColorStop(0, `rgba(60,60,60,${0.5 * t})`);
          g.addColorStop(0.45, `rgba(255,255,255,${0.35 * t})`);
          g.addColorStop(1, `rgba(40,40,40,${0.55 * t})`);
          x.fillStyle = `rgb(${190 * t},${190 * t},${190 * t})`;
          x.fillRect(px, y, tw, th);
          x.fillStyle = g;
          x.fillRect(px, y, tw, th);
          x.fillStyle = 'rgba(0,0,0,0.4)';
          x.fillRect(px, y + th - 4, tw, 4);
        }
      }
      speckle(x, S, S, rng, 1500, ['#000', '#fff', '#5a6a3a'], 0.04, 0.2);
    } else if (kind === 'seam') {
      for (let px = 0; px < S; px += 32) {
        x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(px, 0, 3, S);
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px + 3, 0, 3, S);
      }
      speckle(x, S, S, rng, 1500, ['#000', '#fff'], 0.03, 0.12);
    } else {
      speckle(x, S, S, rng, 9000, ['#555', '#999', '#777', '#ccc'], 0.2, 0.6);
    }
    speckle(x, S, S, rng, 1200, ['#000000', '#ffffff'], 0.03, 0.12);
    return toTex(c);
  });
}

/** Tyre wall: u along (4 stacks per repeat), v 0..0.72 the face, top above. */
export function tyreTex() {
  return once('tyres', () => {
    const [c, x] = cvs(256, 128);
    const rng = makeRng('tyres');
    x.fillStyle = '#121214';
    x.fillRect(0, 0, 256, 128);
    const paint = ['#dcdcd6', '#1e1f22', '#c41c22', '#1e1f22'];
    const top = 36, rowH = (128 - top) / 3;
    for (let s = 0; s < 4; s++) {
      for (let r = 0; r < 3; r++) {
        const y0 = top + r * rowH;
        const g = x.createLinearGradient(0, y0, 0, y0 + rowH);
        const col = paint[s];
        g.addColorStop(0, '#0a0a0b'); g.addColorStop(0.25, col); g.addColorStop(0.75, col); g.addColorStop(1, '#0a0a0b');
        x.fillStyle = g;
        x.fillRect(s * 64 + 2, y0 + 1, 60, rowH - 2);
        x.fillStyle = 'rgba(0,0,0,0.35)';
        for (let t = 0; t < 6; t++) x.fillRect(s * 64 + 4 + t * 10, y0 + 4, 2, rowH - 8);
      }
      x.fillStyle = '#2a2b2e';
      x.beginPath(); x.ellipse(s * 64 + 32, 18, 30, 16, 0, 0, 6.283); x.fill();
      x.fillStyle = '#050505';
      x.beginPath(); x.ellipse(s * 64 + 32, 18, 15, 8, 0, 0, 6.283); x.fill();
    }
    speckle(x, 256, 128, rng, 900, ['#000', '#555', '#8a7a60'], 0.05, 0.3);
    return toTex(c);
  });
}

/** Chain-link catch fence (alpha): diamonds. */
export function meshFenceTex() {
  return once('meshfence', () => {
    const [c, x] = cvs(64, 64);
    x.clearRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(150,156,162,0.95)';
    x.lineWidth = 2.2;
    for (let k = -64; k <= 64; k += 16) {
      x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 64, 64); x.stroke();
      x.beginPath(); x.moveTo(k + 64, 0); x.lineTo(k, 64); x.stroke();
    }
    return toTex(c);
  });
}

/** One row of spectators per 0.5 of v (transparent gaps), ~16 people across. */
export function crowdTex() {
  return once('crowd', () => {
    const [c, x] = cvs(512, 128);
    const rng = makeRng('west-crowd');
    const shirts = ['#c8252c', '#2a4f9a', '#e8e8e4', '#d8b81a', '#2f7a44', '#1b1b1d', '#3a3a40', '#5a6a7a', '#7a2a2a', '#f0f0f0', '#253045', '#8a8a8a', '#e06a1a'];
    const skin = ['#f1c7a5', '#d9a07a', '#b07850', '#7a4e32', '#e8b896'];
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 16; k++) {
        if (rng() < 0.1) continue;
        const cx = k * 32 + 16 + (rng() - 0.5) * 6 + (row ? 16 : 0), by = row ? 128 : 64;
        const sh = shirts[(rng() * shirts.length) | 0];
        x.fillStyle = sh;
        x.beginPath();
        x.moveTo(cx - 12, by); x.lineTo(cx - 11, by - 34); x.quadraticCurveTo(cx, by - 40, cx + 11, by - 34); x.lineTo(cx + 12, by);
        x.fill();
        if (rng() < 0.15) { x.strokeStyle = sh; x.lineWidth = 5; x.beginPath(); x.moveTo(cx - 9, by - 32); x.lineTo(cx - 14, by - 58); x.moveTo(cx + 9, by - 32); x.lineTo(cx + 14, by - 58); x.stroke(); }
        x.fillStyle = skin[(rng() * skin.length) | 0];
        x.beginPath(); x.arc(cx, by - 46, 8, 0, 6.283); x.fill();
        x.fillStyle = rng() < 0.3 ? shirts[(rng() * shirts.length) | 0] : '#2a1a10';
        x.beginPath(); x.arc(cx, by - 49, 8.3, Math.PI, 0); x.fill();
      }
    }
    return toTex(c);
  });
}

/**
 * A sign atlas: slots of 512 × 128 (n rows, 2 across) each drawn by fn(x,
 * e, w, h) (e the emissive: what glows at night). → { map, emi, uv(k) }.
 */
export function signAtlas(key, slots) {
  return once('signs:' + key, () => {
    const rows = Math.ceil(slots.length / 2);
    const H = Math.max(128, rows * 128);
    const [c, x] = cvs(1024, H);
    const [ce, e] = cvs(1024, H);
    e.fillStyle = '#000'; e.fillRect(0, 0, 1024, H);
    x.fillStyle = '#222'; x.fillRect(0, 0, 1024, H);
    slots.forEach((fn, k) => {
      const ox = (k % 2) * 512, oy = Math.floor(k / 2) * 128;
      x.save(); e.save();
      x.translate(ox, oy); e.translate(ox, oy);
      x.beginPath(); x.rect(0, 0, 512, 128); x.clip();
      e.beginPath(); e.rect(0, 0, 512, 128); e.clip();
      fn(x, e, 512, 128);
      x.restore(); e.restore();
    });
    const uv = (k) => {
      const u0 = (k % 2) * 0.5, r = Math.floor(k / 2);
      const v1 = 1 - (r * 128) / H, v0 = 1 - ((r + 1) * 128) / H;
      return [u0 + 0.002, v0 + 0.004, u0 + 0.498, v1 - 0.004];
    };
    return { map: toTex(c, { repeat: false }), emi: toTex(ce, { repeat: false }), uv };
  });
}

/** Sponsor boards (5 brands, 512 × 128 each, stacked): shared by the circuits. */
export const BRANDS = ['KUROSHIO', 'RAZOR FUEL', 'NITRO-X', 'STATIC TIRES', 'MIDNIGHT 88.1'];
export function sponsorTex() {
  return once('sponsors', () => {
    const [c, x] = cvs(512, 640);
    const looks = [['#0c0c0e', '#ffffff', '#e0242c'], ['#ff7a00', '#111111', '#111111'], ['#0b2a6a', '#ffd400', '#ffffff'], ['#f4f4f2', '#1d4fa8', '#d0231f'], ['#1a0a2a', '#ff4fb0', '#40e0ff']];
    for (let k = 0; k < 5; k++) {
      const [bg, fg, ac] = looks[k];
      const y0 = k * 128;
      x.fillStyle = bg; x.fillRect(0, y0, 512, 128);
      x.fillStyle = ac; x.fillRect(0, y0 + 108, 512, 20);
      text(x, BRANDS[k], 256, y0 + 56, 70, fg, { italic: true, max: 480, glow: k === 4 ? '#ff4fb0' : null });
    }
    return toTex(c);
  });
}

/** Soft round puff (alpha) — mist, smoke, steam. */
export function puffTex() {
  return once('puff', () => {
    const [c, x] = cvs(128, 128);
    const rng = makeRng('puff');
    x.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 14; i++) {
      const px = 30 + rng() * 68, py = 34 + rng() * 60, r = 18 + rng() * 30;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    return toTex(c, { repeat: false });
  });
}
