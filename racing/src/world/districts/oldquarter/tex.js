// PORT HALCYON — the old quarter's canvas textures (shared by OLD TOWN and
// CHINATOWN): plaster, brick, dressed stone, slate and barrel tiles (drawn
// light so a building's vertex colour gives it its own shade), the
// wrought-iron and fire-escape metalwork (cut out by alpha), and the helpers
// the two districts' own atlases (windows, shopfronts, signs) are drawn with.
// Everything is drawn on first use (in a pack's warm), never at import, so
// the headless tools can plan without a canvas.
import { toTex } from '../../../track/textures.js';
import { makeRng } from '../../../core/util.js';

const CACHE = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** One cached canvas texture: draw(ctx, w, h, rng). */
export function canvasTex(key, w, h, draw, opts) {
  if (CACHE.has(key)) return CACHE.get(key);
  const c = canvas(w, h);
  draw(c.getContext('2d'), w, h, makeRng('oq:' + key));
  const t = toTex(c, opts);
  CACHE.set(key, t);
  return t;
}

/** A colour map and its night (emissive) map drawn together: draw(x, e, w, h, rng) → { map, emi }. */
export function canvasPair(key, w, h, draw) {
  if (CACHE.has(key)) return CACHE.get(key);
  const c = canvas(w, h), e = canvas(w, h);
  const x = c.getContext('2d'), ex = e.getContext('2d');
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, w, h);
  draw(x, ex, w, h, makeRng('oq:' + key));
  const out = { map: toTex(c), emi: toTex(e) };
  CACHE.set(key, out);
  return out;
}

// ------------------------------------------------------------------ painting helpers

export function grain(x, w, h, rng, n, a = 0.12, size = 1.5) {
  for (let i = 0; i < n; i++) {
    const v = rng() < 0.5 ? 255 : 0;
    x.fillStyle = `rgba(${v},${v},${v},${rng() * a})`;
    x.fillRect(rng() * w, rng() * h, size, size);
  }
}

export function blot(x, w, h, rng, n, rgb, r0, r1, a) {
  for (let i = 0; i < n; i++) {
    const px = rng() * w, py = rng() * h, r = r0 + rng() * (r1 - r0);
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
      const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g;
      x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
    }
  }
}

/** A tile's rect in an atlas → [u0, v0, u1, v1] for quadP (canvas y down, texture v up). */
export function tileUV(W, H, px, py, pw, ph, inset = 1.5) {
  return [(px + inset) / W, 1 - (py + ph - inset) / H, (px + pw - inset) / W, 1 - (py + inset) / H];
}

/** Rounded or plain rect path. */
export function rrect(x, px, py, w, h, r) {
  x.beginPath();
  if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h);
}

// ------------------------------------------------------------------ surfaces

/** Smooth lime plaster: near white (the vertex colour paints it). 2 m a repeat. */
export function plasterTex() {
  return canvasTex('plaster', 512, 512, (x, w, h, rng) => {
    x.fillStyle = '#dedad3';
    x.fillRect(0, 0, w, h);
    blot(x, w, h, rng, 26, '120,110,95', 20, 90, 0.07);
    blot(x, w, h, rng, 14, '255,255,255', 20, 70, 0.08);
    grain(x, w, h, rng, 9000, 0.1, 1.5);
    // a few hairline cracks and a faint render line every metre
    x.strokeStyle = 'rgba(80,70,60,0.18)';
    x.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      let px = rng() * w, py = rng() * h;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += (rng() - 0.5) * 30; py += 6 + rng() * 14; x.lineTo(px, py); }
      x.stroke();
    }
    x.fillStyle = 'rgba(0,0,0,0.05)';
    x.fillRect(0, 0, w, 2); x.fillRect(0, h / 2, w, 2);
  });
}

/** Brick in stretcher bond, real brick colours (the vertex colour shades it). 2 m a repeat. */
export function brickTex() {
  return canvasTex('brick', 512, 512, (x, w, h, rng) => {
    x.fillStyle = '#b9afa2';
    x.fillRect(0, 0, w, h);
    const rows = 26, per = 9;
    const rh = h / rows, bw = w / per;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let k = -1; k <= per; k++) {
        const bx = k * bw + off;
        const t = rng();
        const R = 150 + t * 40 + (rng() - 0.5) * 16, G = 66 + t * 26 + (rng() - 0.5) * 10, B = 50 + t * 18;
        x.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
        x.fillRect(bx + 1.2, r * rh + 1.2, bw - 2.4, rh - 2.4);
        // burnt headers now and then, a lighter face on others
        if (rng() < 0.12) { x.fillStyle = 'rgba(40,20,15,0.35)'; x.fillRect(bx + 1.2, r * rh + 1.2, bw - 2.4, rh - 2.4); }
        x.fillStyle = 'rgba(255,230,210,0.08)';
        x.fillRect(bx + 2, r * rh + 2, bw - 4, 2);
      }
    }
    grain(x, w, h, rng, 12000, 0.14, 1.4);
    blot(x, w, h, rng, 10, '30,20,15', 30, 80, 0.12);
  });
}

/** Dressed stone (ashlar) in courses: pale limestone. 2.4 m a repeat. */
export function stoneTex() {
  return canvasTex('ashlar', 512, 512, (x, w, h, rng) => {
    x.fillStyle = '#9c9488';
    x.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const per = 4, bw = w / per;
      const off = r % 2 ? bw / 2 : 0;
      for (let k = -1; k <= per; k++) {
        const t = 206 + (rng() - 0.5) * 22;
        x.fillStyle = `rgb(${t | 0},${(t - 7) | 0},${(t - 20) | 0})`;
        x.fillRect(k * bw + off + 1.5, r * rh + 1.5, bw - 3, rh - 3);
        x.fillStyle = 'rgba(255,255,255,0.10)';
        x.fillRect(k * bw + off + 2, r * rh + 2, bw - 4, 3);
        x.fillStyle = 'rgba(0,0,0,0.08)';
        x.fillRect(k * bw + off + 2, r * rh + rh - 6, bw - 4, 4);
      }
    }
    grain(x, w, h, rng, 14000, 0.1, 1.5);
    blot(x, w, h, rng, 18, '60,55,45', 16, 60, 0.1);
    // rain streaks
    for (let i = 0; i < 18; i++) {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(40,36,30,0.12)');
      g.addColorStop(1, 'rgba(40,36,30,0)');
      x.fillStyle = g;
      x.fillRect(rng() * w, rng() * h * 0.3, 2 + rng() * 5, h * (0.3 + rng() * 0.5));
    }
  });
}

/** Slates (and zinc, by tint) in staggered courses. 2 m a repeat. */
export function slateTex() {
  return canvasTex('slate', 512, 512, (x, w, h, rng) => {
    x.fillStyle = '#3e4146';
    x.fillRect(0, 0, w, h);
    const rows = 11, per = 8, rh = h / rows, bw = w / per;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let k = -1; k <= per; k++) {
        const t = 150 + (rng() - 0.5) * 36;
        x.fillStyle = `rgb(${t | 0},${(t + 3) | 0},${(t + 9) | 0})`;
        rrect(x, k * bw + off + 1, r * rh + 1, bw - 2, rh - 1.5, 3);
        x.fill();
        x.fillStyle = 'rgba(0,0,0,0.22)';
        x.fillRect(k * bw + off + 1, r * rh + rh - 5, bw - 2, 4);
      }
    }
    grain(x, w, h, rng, 9000, 0.12, 1.4);
    blot(x, w, h, rng, 12, '255,255,255', 30, 90, 0.05);
  });
}

/** Barrel tiles (pantiles), light: terracotta or glazed green by tint. 2 m a repeat. */
export function tileTex() {
  return canvasTex('tiles', 512, 512, (x, w, h, rng) => {
    x.fillStyle = '#5a5a5a';
    x.fillRect(0, 0, w, h);
    const cols = 9, rows = 7, cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const t = 0.9 + (rng() - 0.5) * 0.18;
        const g = x.createLinearGradient(k * cw, 0, k * cw + cw, 0);
        g.addColorStop(0, `rgb(${110 * t | 0},${110 * t | 0},${110 * t | 0})`);
        g.addColorStop(0.45, `rgb(${235 * t | 0},${235 * t | 0},${235 * t | 0})`);
        g.addColorStop(1, `rgb(${120 * t | 0},${120 * t | 0},${120 * t | 0})`);
        x.fillStyle = g;
        x.fillRect(k * cw + 1, r * rh, cw - 2, rh + 2);
        // the lap of the next course
        x.fillStyle = 'rgba(0,0,0,0.35)';
        x.fillRect(k * cw + 1, r * rh + rh - 6, cw - 2, 6);
      }
    }
    grain(x, w, h, rng, 8000, 0.12, 1.4);
    blot(x, w, h, rng, 10, '30,30,30', 30, 80, 0.14);
  });
}

/**
 * Metalwork cut out by alpha (alphaTest), mid grey (tinted dark): rows —
 * 0: wrought-iron balcony railing (scrolls), 1: plain bar railing (fire
 * escapes), 2: open grating, 3: a ladder. Each row tiles across (u repeats).
 */
export const METAL_ROWS = 4;
export function metalTex() {
  return canvasTex('metal', 512, 512, (x, w) => {
    x.clearRect(0, 0, w, 512);
    const col = '#8a8a8a';
    x.fillStyle = col;
    x.strokeStyle = col;
    // row 0: balcony railing, 128 px tall, a 0.5 m pattern repeats 4 times across
    {
      const y0 = 0, H = 128;
      x.fillRect(0, y0 + 4, w, 9); x.fillRect(0, y0 + H - 12, w, 8);
      x.fillRect(0, y0 + 40, w, 4);
      for (let k = 0; k < 16; k++) {
        const px = k * 32;
        x.fillRect(px + 14, y0 + 8, 4, H - 16);
        x.lineWidth = 3.5;
        x.beginPath(); x.arc(px + 16, y0 + 26, 9, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.ellipse(px + 32, y0 + 80, 10, 26, 0, 0, Math.PI * 2); x.stroke();
      }
    }
    // row 1: bar railing (top rail, mid rail, bars)
    {
      const y0 = 128, H = 128;
      x.fillRect(0, y0 + 3, w, 10); x.fillRect(0, y0 + 60, w, 6); x.fillRect(0, y0 + H - 10, w, 8);
      for (let k = 0; k < 16; k++) x.fillRect(k * 32 + 14, y0 + 6, 4, H - 10);
    }
    // row 2: grating
    {
      const y0 = 256, H = 128;
      for (let k = 0; k < 32; k++) x.fillRect(k * 16, y0, 4, H);
      for (let k = 0; k < 8; k++) x.fillRect(0, y0 + k * 16, w, 3);
    }
    // row 3: ladder (two stiles, rungs)
    {
      const y0 = 384, H = 128;
      for (let k = 0; k < 4; k++) {
        const px = k * 128;
        x.fillRect(px + 8, y0, 10, H); x.fillRect(px + 110, y0, 10, H);
        for (let r = 0; r < 4; r++) x.fillRect(px + 8, y0 + 12 + r * 32, 112, 7);
      }
    }
  });
}

/** uv rect of a metalwork row: [u0, v0, u1, v1] for a run `len` metres long, `rep` metres a pattern repeat. */
export function metalUV(row, len, rep = 2) {
  const v1 = 1 - (row * 128 + 2) / 512, v0 = 1 - (row * 128 + 126) / 512;
  return [0, v0, len / rep, v1];
}

// ------------------------------------------------------------------ type

/** Draw text squeezed to fit maxW (canvas maxWidth squashes it). */
export function fitText(x, s, cx, cy, maxW, font, fill, stroke, lw = 3) {
  x.font = font;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (stroke) { x.lineWidth = lw; x.strokeStyle = stroke; x.strokeText(s, cx, cy, maxW); }
  if (fill) { x.fillStyle = fill; x.fillText(s, cx, cy, maxW); }
  x.textAlign = 'left';
  x.textBaseline = 'alphabetic';
}
