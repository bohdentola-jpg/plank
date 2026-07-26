// FOCUS GROUP — every surface in the flat, drawn on a canvas at load time.
// No image files anywhere on the shelf and none here either.
//
// The palette is 1974 and it is not apologising: mustard, ochre, avocado,
// burnt orange, walnut veneer, and a cream that has been in a room where
// people smoked.

import * as THREE from 'three';
import { rng, Noise2, clamp01 } from './util.js';

const SIZE = 256;

// ------------------------------------------------------------------ canvas kit

function mk(size, draw, h = null) {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = h || size;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  draw(ctx, size, h || size);
  return cv;
}

const rgba = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

function base(ctx, w, h, color) {
  ctx.fillStyle = typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
  ctx.fillRect(0, 0, w, h);
}

function grain(ctx, w, h, amount = 12, R = Math.random) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * amount * 2;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx, w, h, n, color, rMin, rMax, alpha, R) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, r = rMin + R() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function clouds(ctx, w, h, seed, scale, color, alpha, oct = 4) {
  const N = new Noise2(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = N.fbm((x / w) * scale, (y / h) * scale, oct);
      const i = (y * w + x) * 4;
      const a = v * alpha;
      d[i] += (color[0] - d[i]) * a;
      d[i + 1] += (color[1] - d[i + 1]) * a;
      d[i + 2] += (color[2] - d[i + 2]) * a;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function tiles(ctx, w, h, cols, colours, grout, groutW, R, jitter = 8) {
  base(ctx, w, h, grout);
  const cell = w / cols;
  for (let y = 0; y < cols; y++) {
    for (let x = 0; x < cols; x++) {
      const c = colours[Math.floor(R() * colours.length)];
      const j = (R() - 0.5) * jitter;
      ctx.fillStyle = `rgb(${c[0] + j},${c[1] + j},${c[2] + j})`;
      ctx.fillRect(x * cell + groutW, y * cell + groutW, cell - groutW * 2, cell - groutW * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x * cell + groutW, y * cell + groutW, cell - groutW * 2, 1.4);
    }
  }
}

function streaks(ctx, w, h, n, color, alpha, vertical, R, len = 1) {
  ctx.strokeStyle = `rgba(${color},${alpha})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const a = R() * (vertical ? w : h);
    const start = R() * (vertical ? h : w) * (1 - len);
    ctx.beginPath();
    let p = a;
    const steps = 26;
    for (let s = 0; s <= steps; s++) {
      const t = start + ((vertical ? h : w) * len * s) / steps;
      p += (R() - 0.5) * 1.6;
      if (vertical) { s ? ctx.lineTo(p, t) : ctx.moveTo(p, t); }
      else { s ? ctx.lineTo(t, p) : ctx.moveTo(t, p); }
    }
    ctx.stroke();
  }
}

function normalFrom(cv, strength = 2.0) {
  const w = cv.width, h = cv.height;
  const src = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const oc = out.getContext('2d');
  const img = oc.createImageData(w, h);
  const lum = (x, y) => {
    const xx = (x + w) % w, yy = (y + h) % h;
    const i = (yy * w + xx) * 4;
    return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (lum(x - 1, y) - lum(x + 1, y)) * strength;
      const dy = (lum(x, y - 1) - lum(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  oc.putImageData(img, 0, 0);
  return out;
}

// ------------------------------------------------------------------ recipes
//
// tile   = texture repeats per metre (the geometry bakes metre-scaled UVs)
// rough / metal / emissive / normal as in the rest of the shelf

export const RECIPES = {
  // ---------------------------------------------------------- living room
  // A big ochre medallion repeat. It was fashionable and then it was not, and
  // nobody has redecorated because nobody has been asked to.
  wallpaper: {
    tile: 2.0, rough: 0.92, normal: 1.0,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#ddd0ab');
      clouds(ctx, s, s, 21, 3, [201, 186, 148], 0.35);
      const motif = (cx, cy, r) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = 'rgba(168,118,42,0.72)';
        ctx.beginPath();
        for (let a = 0; a < 8; a++) {
          const t = (a / 8) * Math.PI * 2;
          ctx.ellipse(Math.cos(t) * r * 0.5, Math.sin(t) * r * 0.5, r * 0.34, r * 0.2, t, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = 'rgba(120,78,32,0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.19, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      for (let gy = 0; gy < 2; gy++) {
        for (let gx = 0; gx < 2; gx++) {
          motif(gx * (s / 2) + s / 4 + (gy % 2 ? s / 4 : 0), gy * (s / 2) + s / 4, s * 0.15);
        }
      }
      blotches(ctx, s, s, 5, '120,92,50', 20, 60, 0.06, R);
      grain(ctx, s, s, 7, R);
    },
  },
  // twenty years of a radiator under it
  wallpaperTired: {
    tile: 2.0, rough: 0.93, normal: 1.0,
    draw(ctx, s, h, R) {
      RECIPES.wallpaper.draw(ctx, s, h, R);
      const g = ctx.createLinearGradient(0, s, 0, s * 0.4);
      g.addColorStop(0, 'rgba(96,72,40,0.34)');
      g.addColorStop(1, 'rgba(96,72,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      streaks(ctx, s, s, 9, '92,70,42', 0.10, true, R, 0.6);
      grain(ctx, s, s, 8, R);
    },
  },
  // the bedroom got the quiet one
  wallpaperBed: {
    tile: 2.0, rough: 0.94, normal: 0.8,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#cfd3c2');
      clouds(ctx, s, s, 44, 4, [186, 192, 172], 0.3);
      ctx.strokeStyle = 'rgba(122,138,110,0.5)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 10; i++) {
        const x = (i / 10) * s + 6;
        ctx.beginPath();
        for (let y = 0; y <= s; y += 4) {
          ctx.lineTo(x + Math.sin(y * 0.09 + i) * 4, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 30; i++) {
        const x = R() * s, y = R() * s;
        ctx.fillStyle = 'rgba(150,116,64,0.45)';
        ctx.beginPath();
        ctx.ellipse(x, y, 3.4, 2.0, R() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      grain(ctx, s, s, 6, R);
    },
  },
  carpet: {
    tile: 2.6, rough: 0.99, normal: 1.4,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#6b4529');
      clouds(ctx, s, s, 7, 6, [126, 74, 36], 0.5);
      blotches(ctx, s, s, 26, '150,92,40', 8, 26, 0.18, R);
      streaks(ctx, s, s, 340, '48,30,18', 0.14, false, R);
      streaks(ctx, s, s, 220, '168,110,52', 0.10, false, R);
      grain(ctx, s, s, 15, R);
    },
  },
  carpetHall: {
    tile: 2.6, rough: 0.99, normal: 1.3,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#4c3a2c');
      clouds(ctx, s, s, 12, 5, [82, 62, 46], 0.45);
      streaks(ctx, s, s, 300, '34,26, 20', 0.16, false, R);
      // the strip down the middle where everybody walks
      const g = ctx.createLinearGradient(0, 0, s, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(24,18,12,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      grain(ctx, s, s, 13, R);
    },
  },
  lino: {
    tile: 1.7, rough: 0.42, normal: 0.5,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#ddd2b4');
      const cell = s / 4;
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if ((x + y) % 2) continue;
          ctx.fillStyle = 'rgba(178,120,52,0.45)';
          ctx.fillRect(x * cell + cell * 0.18, y * cell + cell * 0.18, cell * 0.64, cell * 0.64);
          ctx.fillStyle = 'rgba(120,84,40,0.5)';
          ctx.fillRect(x * cell + cell * 0.36, y * cell + cell * 0.36, cell * 0.28, cell * 0.28);
        }
      }
      blotches(ctx, s, s, 8, '90,70,44', 10, 34, 0.08, R);
      grain(ctx, s, s, 5, R);
    },
  },
  tileBath: {
    tile: 0.85, rough: 0.24, metal: 0.02, normal: 1.6,
    draw(ctx, s, _h, R) {
      tiles(ctx, s, s, 8, [[232, 230, 218], [226, 226, 214], [236, 232, 222]], '#b6b2a2', 1.6, R, 5);
      blotches(ctx, s, s, 6, '150,150,132', 8, 22, 0.10, R);
      grain(ctx, s, s, 4, R);
    },
  },
  ceiling: {
    tile: 2.0, rough: 0.97, normal: 1.6,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#e2ddce');
      // artex, applied by somebody in a hurry in about 1969
      for (let i = 0; i < 900; i++) {
        const x = R() * s, y = R() * s;
        ctx.fillStyle = R() > 0.5 ? 'rgba(255,255,250,0.32)' : 'rgba(176,170,152,0.28)';
        ctx.beginPath();
        ctx.ellipse(x, y, 1.6 + R() * 2.6, 1.2 + R() * 1.8, R() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      blotches(ctx, s, s, 4, '150,132,96', 24, 60, 0.07, R);
      grain(ctx, s, s, 6, R);
    },
  },
  woodVeneer: {
    tile: 1.4, rough: 0.36, metal: 0.03, normal: 0.7,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#6a4326');
      clouds(ctx, s, s, 31, 2.2, [116, 74, 40], 0.55);
      streaks(ctx, s, s, 150, '44,26,14', 0.22, false, R);
      streaks(ctx, s, s, 60, '148,104,58', 0.14, false, R);
      // a couple of knots, because veneer pretends
      for (let i = 0; i < 3; i++) {
        const x = R() * s, y = R() * s;
        for (let k = 8; k > 0; k--) {
          ctx.strokeStyle = `rgba(48,28,14,${0.05 * k / 8 + 0.04})`;
          ctx.beginPath();
          ctx.ellipse(x, y, k * 3.2, k * 1.5, 0.3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      grain(ctx, s, s, 8, R);
    },
  },
  woodDark: {
    tile: 1.4, rough: 0.42, normal: 0.7,
    draw(ctx, s, h, R) {
      RECIPES.woodVeneer.draw(ctx, s, h, R);
      ctx.fillStyle = 'rgba(24,12,6,0.42)';
      ctx.fillRect(0, 0, s, s);
      grain(ctx, s, s, 6, R);
    },
  },
  formica: {
    tile: 3.0, rough: 0.22, metal: 0.04, normal: 0.35,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#d8cfb6');
      for (let i = 0; i < 2600; i++) {
        const x = R() * s, y = R() * s;
        const c = R() > 0.6 ? '92,66,36' : R() > 0.4 ? '164,140,96' : '52,44,32';
        ctx.fillStyle = `rgba(${c},${0.25 + R() * 0.4})`;
        ctx.fillRect(x, y, 1 + R() * 1.6, 1 + R() * 1.2);
      }
      grain(ctx, s, s, 4, R);
    },
  },
  upholstery: {
    tile: 4.0, rough: 0.98, normal: 1.5,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#8a4a22');
      clouds(ctx, s, s, 61, 5, [150, 84, 34], 0.35);
      // a coarse weave, over and under
      for (let y = 0; y < s; y += 4) {
        for (let x = 0; x < s; x += 4) {
          ctx.fillStyle = ((x / 4 + y / 4) % 2) ? 'rgba(0,0,0,0.13)' : 'rgba(255,220,180,0.09)';
          ctx.fillRect(x, y, 4, 4);
        }
      }
      blotches(ctx, s, s, 8, '52,28,12', 10, 30, 0.14, R);
      grain(ctx, s, s, 10, R);
    },
  },
  gloss: {                       // door paint, skirting, window frame
    tile: 2.0, rough: 0.18, metal: 0.02, normal: 0.2,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#e4dcc6');
      clouds(ctx, s, s, 88, 3, [212, 202, 178], 0.3);
      streaks(ctx, s, s, 22, '190,178,150', 0.16, false, R);
      blotches(ctx, s, s, 4, '150,138,110', 12, 30, 0.07, R);
      grain(ctx, s, s, 3, R);
    },
  },

  // ---------------------------------------------------------- outside the flat
  corridorWall: {
    tile: 1.0, rough: 0.9, normal: 1.0,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#8e9384');
      clouds(ctx, s, s, 99, 4, [116, 122, 108], 0.4);
      // painted breeze block: the joints show through the paint, always
      const rows = 5, bh = s / rows;
      ctx.strokeStyle = 'rgba(80,86,74,0.55)';
      ctx.lineWidth = 1.6;
      for (let r = 0; r < rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * bh); ctx.lineTo(s, r * bh); ctx.stroke();
        const off = (r % 2) * (s / 4);
        for (let c = 0; c < 2; c++) {
          const x = off + c * (s / 2);
          ctx.beginPath(); ctx.moveTo(x, r * bh); ctx.lineTo(x, (r + 1) * bh); ctx.stroke();
        }
      }
      blotches(ctx, s, s, 8, '60,66,56', 14, 40, 0.10, R);
      grain(ctx, s, s, 8, R);
    },
  },
  concrete: {
    tile: 1.2, rough: 0.95, normal: 1.3,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#6d6a63');
      clouds(ctx, s, s, 5, 5, [98, 95, 88], 0.5);
      blotches(ctx, s, s, 24, '48,46,42', 6, 30, 0.16, R);
      blotches(ctx, s, s, 10, '128,124,116', 8, 22, 0.12, R);
      // shutter lines from the pour
      ctx.strokeStyle = 'rgba(46,44,40,0.28)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const y = (i / 3) * s + 12;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      }
      grain(ctx, s, s, 13, R);
    },
  },
  rust: {
    tile: 1.5, rough: 0.86, metal: 0.28, normal: 1.1,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#5a4a40');
      blotches(ctx, s, s, 40, '138,72,32', 6, 30, 0.28, R);
      blotches(ctx, s, s, 22, '82,44,22', 5, 20, 0.3, R);
      grain(ctx, s, s, 16, R);
    },
  },

  // ---------------------------------------------------------- the soundstage
  stageFloor: {
    tile: 1.0, rough: 0.72, normal: 0.4,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#22211f');
      clouds(ctx, s, s, 17, 4, [42, 40, 38], 0.5);
      streaks(ctx, s, s, 40, '80,78,74', 0.06, false, R);
      blotches(ctx, s, s, 14, '10,10,10', 8, 30, 0.3, R);
      grain(ctx, s, s, 7, R);
    },
  },
  acoustic: {
    tile: 1.25, rough: 0.99, normal: 1.8,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#26262a');
      // wedge foam, in a grid, absorbing everything including the will to leave
      const n = 8, cell = s / n;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const g = ctx.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
          g.addColorStop(0, 'rgba(70,70,78,0.9)');
          g.addColorStop(1, 'rgba(16,16,20,0.9)');
          ctx.fillStyle = g;
          ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
        }
      }
      grain(ctx, s, s, 6, R);
    },
  },
  blackDrape: {
    tile: 1.2, rough: 1.0, normal: 1.2,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#131316');
      streaks(ctx, s, s, 70, '46,46,54', 0.16, true, R);
      grain(ctx, s, s, 5, R);
    },
  },
  // the fourth wall of the set, painted with your view on it
  paintedView: {
    tile: 0.24, rough: 0.86, normal: 0.2,
    draw(ctx, s, _h, R) {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, '#2b3550');
      g.addColorStop(0.62, '#4a4257');
      g.addColorStop(1, '#2a2630');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      // the block opposite, flat, in three tones, with the windows wrong
      ctx.fillStyle = '#1d1c22';
      ctx.fillRect(s * 0.06, s * 0.42, s * 0.4, s * 0.58);
      ctx.fillRect(s * 0.54, s * 0.5, s * 0.4, s * 0.5);
      ctx.fillStyle = 'rgba(196,168,96,0.6)';
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 4; x++) {
          if ((x * 3 + y * 5) % 4 === 0) continue;
          ctx.fillRect(s * 0.09 + x * s * 0.09, s * 0.46 + y * s * 0.075, s * 0.05, s * 0.04);
          ctx.fillRect(s * 0.57 + x * s * 0.09, s * 0.54 + y * s * 0.065, s * 0.05, s * 0.035);
        }
      }
      // brush marks, because it is scenery
      streaks(ctx, s, s, 26, '210,200,180', 0.05, false, R);
      grain(ctx, s, s, 4, R);
    },
  },
  monitorBezel: {
    tile: 1.5, rough: 0.55, metal: 0.15, normal: 0.4,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#39393c');
      clouds(ctx, s, s, 71, 5, [58, 58, 62], 0.4);
      grain(ctx, s, s, 6, R);
    },
  },
  cardboard: {
    tile: 1.5, rough: 0.95, normal: 0.9,
    draw(ctx, s, _h, R) {
      base(ctx, s, s, '#b08a58');
      clouds(ctx, s, s, 23, 4, [150, 118, 76], 0.4);
      ctx.strokeStyle = 'rgba(120,90,54,0.35)';
      for (let y = 0; y < s; y += 6) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      }
      grain(ctx, s, s, 9, R);
    },
  },
};

// ------------------------------------------------------------------ caches

const texCache = new Map();
const matCache = new Map();

function textureFor(name) {
  if (texCache.has(name)) return texCache.get(name);
  const rec = RECIPES[name];
  if (!rec) throw new Error(`no such surface: ${name}`);
  // seeded off the name, so the flat looks the same every morning — which is
  // most of what is wrong with it
  const R = rng(1000 + name.length * 977 + name.charCodeAt(0) * 31);
  const size = rec.size || SIZE;
  const cv = mk(size, (ctx, w, h) => rec.draw(ctx, w, h, R));
  const map = new THREE.CanvasTexture(cv);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  let normal = null;
  if (rec.normal) {
    normal = new THREE.CanvasTexture(normalFrom(cv, rec.normal));
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  }
  const out = { map, normal, rec };
  texCache.set(name, out);
  return out;
}

/** Memoised lit material for a named surface. */
export function material(name) {
  if (matCache.has(name)) return matCache.get(name);
  const { map, normal, rec } = textureFor(name);
  const mat = new THREE.MeshStandardMaterial({
    map,
    normalMap: normal || undefined,
    roughness: rec.rough ?? 0.85,
    metalness: rec.metal ?? 0.02,
    emissive: new THREE.Color(rec.emissive ?? 0x000000),
    side: THREE.FrontSide,
  });
  mat.userData.tile = rec.tile ?? 0.4;
  matCache.set(name, mat);
  return mat;
}

export const tileScale = (name) => RECIPES[name]?.tile ?? 0.4;

/** Plain lit material for props. Not cached — props tint theirs. */
export function simple(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.8,
    metalness: opts.metal ?? 0.05,
    transparent: opts.opacity !== undefined && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    flatShading: !!opts.flat,
  });
}

export function clearCaches() {
  texCache.clear();
  matCache.clear();
}

// ------------------------------------------------------------------ VAL
//
// The mascot. A round cream head, a bowler hat, two dot eyes with a catchlight
// each, and a painted smile that goes further round the face than a smile
// goes. He has been on every Valco package since 1958 and nobody has ever
// asked to see the artwork he was drawn from.

/**
 * VAL's face wrapped for a sphere, rather than pasted on the front of one as a
 * flat plane — a plane big enough to read overhangs the silhouette and turns
 * the head into a white disc. Equirectangular: u = 0.25 is +Z on a three.js
 * sphere, so that is where the face goes.
 */
export function valHeadTexture(w = 512, h = 256) {
  return mk(w, (ctx, ww, hh) => {
    ctx.fillStyle = '#f2e6c8';
    ctx.fillRect(0, 0, ww, hh);
    // painted resin is never quite even
    const R0 = rng(58);
    blotches(ctx, ww, hh, 14, '208,190,150', 12, 46, 0.16, R0);

    const cx = ww * 0.25, cy = hh * 0.5;
    const R = hh * 0.30;

    ctx.fillStyle = 'rgba(214,110,92,0.5)';
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.ellipse(cx + s * R * 0.66, cy + R * 0.30, R * 0.26, R * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    [-1, 1].forEach((s) => {
      const ex = cx + s * R * 0.44;
      const ey = cy - R * 0.18;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, R * 0.21, R * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1410';
      ctx.lineWidth = R * 0.045;
      ctx.stroke();
      ctx.fillStyle = '#141014';
      ctx.beginPath();
      ctx.arc(ex + R * 0.02, ey + R * 0.03, R * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + R * 0.07, ey - R * 0.06, R * 0.038, 0, Math.PI * 2);
      ctx.fill();
    });

    // and the smile, which goes further round than a smile goes
    ctx.fillStyle = '#b03a30';
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.04, R * 0.66, 0.19 * Math.PI, 0.81 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = R * 0.075;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.04, R * 0.66, 0.17 * Math.PI, 0.83 * Math.PI);
    ctx.stroke();
  }, h);
}

/** A three.js head sphere with VAL printed on it, facing +Z. */
export function valHeadMaterial() {
  const tex = new THREE.CanvasTexture(valHeadTexture());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
}

export function valFace(size = 256, o = {}) {
  return mk(size, (ctx, s) => {
    ctx.fillStyle = o.bg || '#e8dcc0';
    ctx.fillRect(0, 0, s, s);
    const cx = s / 2, cy = s * 0.56, r = s * 0.33;

    // face
    ctx.fillStyle = '#f4e6c8';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = s * 0.022;
    ctx.stroke();

    // hat: brim then crown
    ctx.fillStyle = '#181418';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.82, r * 1.22, r * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 1.18, r * 0.72, r * 0.46, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - r * 0.72, cy - r * 1.18, r * 1.44, r * 0.4);
    ctx.fillStyle = '#8c2a24';
    ctx.fillRect(cx - r * 0.72, cy - r * 0.96, r * 1.44, r * 0.13);

    // cheeks
    ctx.fillStyle = 'rgba(214,110,92,0.55)';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.52, cy + r * 0.16, r * 0.20, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + r * 0.52, cy + r * 0.16, r * 0.20, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();

    // eyes — the only part of him that is ever dusted
    const eye = (ex) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(ex, cy - r * 0.20, r * 0.19, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1410';
      ctx.lineWidth = s * 0.012;
      ctx.stroke();
      ctx.fillStyle = '#141014';
      ctx.beginPath(); ctx.arc(ex + r * 0.02, cy - r * 0.17, r * 0.098, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex + r * 0.055, cy - r * 0.225, r * 0.032, 0, Math.PI * 2); ctx.fill();
    };
    eye(cx - r * 0.36);
    eye(cx + r * 0.36);

    // the smile. Note where it ends.
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = s * 0.028;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.06, r * 0.62, 0.16 * Math.PI, 0.84 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#b03a30';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.06, r * 0.62, 0.20 * Math.PI, 0.80 * Math.PI);
    ctx.closePath();
    ctx.fill();
  });
}

// ------------------------------------------------------------------ brand art

/** The starburst wordmark, as used on packaging since 1954. */
export function valcoLogo(w = 512, h = 256, o = {}) {
  return mk(w, (ctx, ww, hh) => {
    if (o.bg !== null) {
      ctx.fillStyle = o.bg || '#1a1206';
      ctx.fillRect(0, 0, ww, hh);
    }
    const cx = ww / 2, cy = hh / 2;
    // starburst
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = o.burst || '#c2622a';
    ctx.beginPath();
    const pts = 24;
    for (let i = 0; i <= pts * 2; i++) {
      const t = (i / (pts * 2)) * Math.PI * 2;
      const rr = (i % 2 ? 0.30 : 0.46) * ww;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(t) * rr, Math.sin(t) * rr * 0.58);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = o.disc || '#e8dcc0';
    ctx.beginPath();
    ctx.ellipse(cx, cy, ww * 0.30, hh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = o.ink || '#7a2018';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(hh * 0.40)}px Georgia, "Times New Roman", serif`;
    ctx.fillText('VALCO', cx, cy - hh * 0.02);
    ctx.font = `${Math.floor(hh * 0.085)}px Georgia, serif`;
    ctx.fillText('HOME PRODUCTS', cx, cy + hh * 0.22);
  }, h);
}

/** The game's own logo — a stencilled title on a strip of film leader. */
export function logoCanvas(text = 'FOCUS GROUP', w = 1024, h = 260) {
  return mk(w, (ctx, ww, hh) => {
    ctx.clearRect(0, 0, ww, hh);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(hh * 0.56)}px "Courier New", Courier, monospace`;

    // the plate is printed three times and only nearly lines up
    ctx.fillStyle = 'rgba(196,80,60,0.55)';
    ctx.fillText(text, ww / 2 - 4, hh / 2 + 1);
    ctx.fillStyle = 'rgba(90,170,190,0.5)';
    ctx.fillText(text, ww / 2 + 4, hh / 2 - 1);
    ctx.fillStyle = '#efe6ce';
    ctx.fillText(text, ww / 2, hh / 2);

    // a soft focus ring around it, because of the name
    ctx.strokeStyle = 'rgba(239,230,206,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(ww / 2, hh / 2, ww * 0.44, hh * 0.40, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(239,230,206,0.10)';
    ctx.beginPath();
    ctx.ellipse(ww / 2, hh / 2, ww * 0.47, hh * 0.46, 0, 0, Math.PI * 2);
    ctx.stroke();

    // and the scanline chew
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    for (let y = 0; y < hh; y += 4) ctx.fillRect(0, y, ww, 1.3);
    ctx.globalCompositeOperation = 'source-over';
  }, h);
}

// ------------------------------------------------------------------ live canvases
//
// A few surfaces have to change while you are looking at them: the television,
// the wall of monitors, the checklist on the notepad. Those get a canvas the
// game keeps a handle on.

/**
 * A canvas + CanvasTexture pair you can redraw. Call `.touch()` after drawing.
 * @returns {{cv:HTMLCanvasElement, ctx:CanvasRenderingContext2D, tex:THREE.CanvasTexture, touch:Function}}
 */
export function liveCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return { cv, ctx, tex, touch: () => { tex.needsUpdate = true; } };
}

/** Television snow, for a set that is on but has nothing to say. */
export function drawSnow(ctx, w, h, R = Math.random) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = R() * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // the roll bar
  const y = (Date.now() * 0.12) % (h * 1.4) - h * 0.2;
  const g = ctx.createLinearGradient(0, y, 0, y + h * 0.18);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.20)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, w, h * 0.18);
}

/** Grain, scanlines and a stamp, for anything meant to look like footage. */
export function agedPass(ctx, w, h, o = {}) {
  const R = o.rand || Math.random;
  if (o.grain !== 0) {
    const amt = o.grain ?? 16;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (R() - 0.5) * amt;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${o.vign ?? 0.55})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
