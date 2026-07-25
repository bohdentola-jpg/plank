// Every surface in the game, drawn in code. No image files, nothing to load:
// each material is a canvas recipe plus how rough and metallic it is and how
// many times it tiles per metre. Materials build lazily — a level only pays for
// the six or eight surfaces it actually uses — and cache forever after.
//
// The one unusual thing here: level geometry carries baked irradiance in a
// vertex attribute (`abake`, see world.js). We inject four lines of GLSL into
// the standard material so that attribute is added to the lit result instead of
// tinting the albedo. That's what lets a flashlight read correctly in a room
// whose baked light is zero.

import * as THREE from 'three';
import { rng, Noise2, clamp01 } from './util.js';

const SIZE = 256;

// ------------------------------------------------------------------ canvas kit
function mk(size, draw) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, size);
  return cv;
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const rgba = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

// solid base coat
function base(ctx, size, color) {
  ctx.fillStyle = typeof color === 'number' ? hex(color) : color;
  ctx.fillRect(0, 0, size, size);
}

// fine film grain — the thing that stops a flat colour looking like plastic
function grain(ctx, size, amount = 12, R = Math.random) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * amount * 2;
    d[i] = clamp01((d[i] + n) / 255) * 255;
    d[i + 1] = clamp01((d[i + 1] + n) / 255) * 255;
    d[i + 2] = clamp01((d[i + 2] + n) / 255) * 255;
  }
  ctx.putImageData(img, 0, 0);
}

// soft irregular blotches: damp, mould, oil, rust, shadowed grime
function blotches(ctx, size, n, color, rMin, rMax, alpha, R) {
  for (let i = 0; i < n; i++) {
    const x = R() * size, y = R() * size, r = rMin + R() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
  }
}

// value-noise cloud layer, used for everything from concrete to snow
function clouds(ctx, size, seed, scale, color, alpha, octaves = 4) {
  const n = new Noise2(seed);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const [cr, cg, cb] = color;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = (n.fbm(x / scale, y / scale, octaves) + 1) * 0.5;
      const i = (y * size + x) * 4;
      const a = v * alpha;
      d[i] = d[i] * (1 - a) + cr * a;
      d[i + 1] = d[i + 1] * (1 - a) + cg * a;
      d[i + 2] = d[i + 2] * (1 - a) + cb * a;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// a tile field with grout lines; the workhorse of the poolrooms and hospital
function tiles(ctx, size, cols, tileColors, grout, groutW, R, jitter = 8) {
  base(ctx, size, grout);
  const step = size / cols;
  for (let ty = 0; ty < cols; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const c = tileColors[Math.floor(R() * tileColors.length)];
      const j = (R() - 0.5) * jitter;
      ctx.fillStyle = `rgb(${clamp01((c[0] + j) / 255) * 255},${clamp01((c[1] + j) / 255) * 255},${clamp01((c[2] + j) / 255) * 255})`;
      ctx.fillRect(tx * step + groutW, ty * step + groutW, step - groutW * 2, step - groutW * 2);
      // a highlight on the top-left edge reads as glaze under a light
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(tx * step + groutW, ty * step + groutW, step - groutW * 2, 1.5);
    }
  }
}

// running-bond masonry
function bricks(ctx, size, rows, color, mortar, R) {
  base(ctx, size, mortar);
  const h = size / rows, w = h * 2.2;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (w / 2);
    for (let x = -w; x < size + w; x += w) {
      const v = (R() - 0.5) * 22;
      ctx.fillStyle = `rgb(${clamp01((color[0] + v) / 255) * 255},${clamp01((color[1] + v * 0.7) / 255) * 255},${clamp01((color[2] + v * 0.5) / 255) * 255})`;
      ctx.fillRect(x + off + 1, r * h + 1, w - 2, h - 2);
    }
  }
}

// vertical or horizontal streaks: carpet nap, wood grain, brushed metal
function streaks(ctx, size, n, color, alpha, vertical, R, len = 1) {
  ctx.strokeStyle = `rgba(${color},${alpha})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const p = R() * size, a = R() * size, b = a + R() * size * len;
    ctx.beginPath();
    if (vertical) { ctx.moveTo(p, a); ctx.lineTo(p + (R() - 0.5) * 3, b); }
    else { ctx.moveTo(a, p); ctx.lineTo(b, p + (R() - 0.5) * 3); }
    ctx.stroke();
  }
}

// A cheap normal map: read luminance as height, take gradients. Used sparingly
// on the surfaces you get close to — tile, brick, concrete, grate.
function normalFrom(cv, strength = 2.2) {
  const size = cv.width;
  const src = cv.getContext('2d').getImageData(0, 0, size, size).data;
  const out = mk(size, () => {});
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const lum = (x, y) => {
    const xi = (x + size) % size, yi = (y + size) % size;
    const i = (yi * size + xi) * 4;
    return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
      const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      d[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / len) * 0.5 * 255 + 127;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// ------------------------------------------------------------------ recipes
// draw(ctx, size, R, N)  R = seeded random, N = seeded noise
// tile: how many texture repeats per metre. rough/metal/normal as you'd expect.
export const RECIPES = {
  // ---------------------------------------------------------- the yellow rooms
  wallpaper: {
    tile: 0.5, rough: 0.86,
    draw(ctx, s, R) {
      base(ctx, s, 0xd8c877);
      // the vertical stripe everyone remembers, barely there
      for (let x = 0; x < s; x += 16) {
        ctx.fillStyle = 'rgba(120,100,40,0.10)';
        ctx.fillRect(x, 0, 7, s);
      }
      clouds(ctx, s, 11, 40, [190, 172, 108], 0.35);
      blotches(ctx, s, 14, '120,104,44', 12, 46, 0.10, R);
      grain(ctx, s, 9, R);
    },
  },
  wallpaperDamp: {
    tile: 0.5, rough: 0.72,
    draw(ctx, s, R) {
      RECIPES.wallpaper.draw(ctx, s, R);
      blotches(ctx, s, 26, '86,74,34', 18, 70, 0.28, R);
      blotches(ctx, s, 10, '52,58,32', 10, 34, 0.30, R);
      // tide lines where the water climbed and gave up
      for (let i = 0; i < 4; i++) {
        const y = R() * s;
        ctx.fillStyle = 'rgba(70,60,28,0.22)';
        ctx.fillRect(0, y, s, 2 + R() * 3);
      }
      grain(ctx, s, 10, R);
    },
  },
  wallpaperTorn: {
    tile: 0.5, rough: 0.8,
    draw(ctx, s, R) {
      RECIPES.wallpaperDamp.draw(ctx, s, R);
      // strips peeled back to the grey board underneath
      for (let i = 0; i < 5; i++) {
        const x = R() * s, w = 10 + R() * 34;
        ctx.fillStyle = 'rgba(150,146,138,0.9)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= s; y += 16) ctx.lineTo(x + (R() - 0.5) * 14, y);
        for (let y = s; y >= 0; y -= 16) ctx.lineTo(x + w + (R() - 0.5) * 14, y);
        ctx.closePath();
        ctx.fill();
      }
      grain(ctx, s, 12, R);
    },
  },
  carpet: {
    tile: 0.6, rough: 0.98,
    draw(ctx, s, R) {
      base(ctx, s, 0x9a8b3e);
      clouds(ctx, s, 5, 22, [118, 104, 44], 0.5, 5);
      streaks(ctx, s, 900, '70,62,26', 0.18, true, R, 0.12);
      streaks(ctx, s, 900, '186,170,96', 0.10, false, R, 0.12);
      grain(ctx, s, 16, R);
    },
    normal: 1.1,
  },
  carpetDamp: {
    tile: 0.6, rough: 0.99,
    draw(ctx, s, R) {
      RECIPES.carpet.draw(ctx, s, R);
      blotches(ctx, s, 22, '44,44,24', 16, 64, 0.42, R);
      blotches(ctx, s, 8, '28,34,22', 10, 30, 0.5, R);
      grain(ctx, s, 12, R);
    },
  },
  ceilTile: {
    tile: 0.5, rough: 0.95,
    draw(ctx, s, R) {
      base(ctx, s, 0xdedbc8);
      // 2x2 acoustic panels with a fine pinhole texture
      ctx.strokeStyle = 'rgba(120,116,100,0.7)';
      ctx.lineWidth = 2;
      for (const p of [0, s / 2, s]) {
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke();
      }
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = `rgba(140,136,120,${0.25 + R() * 0.4})`;
        ctx.fillRect(R() * s, R() * s, 1.4, 1.4);
      }
      blotches(ctx, s, 10, '150,132,80', 14, 44, 0.22, R);   // water stains
      grain(ctx, s, 8, R);
    },
    normal: 1.4,
  },
  ceilPanel: {
    tile: 0.5, rough: 0.4, emissive: 0x2a2820,
    draw(ctx, s, R) {
      base(ctx, s, 0xf6f2e2);
      ctx.strokeStyle = 'rgba(180,178,166,0.9)';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, s - 4, s - 4);
      // the diffuser's egg-crate
      ctx.strokeStyle = 'rgba(200,198,186,0.6)';
      ctx.lineWidth = 1;
      for (let i = 8; i < s; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
      }
      grain(ctx, s, 4, R);
    },
  },

  // ---------------------------------------------------------- concrete country
  concrete: {
    tile: 0.35, rough: 0.9,
    draw(ctx, s, R) {
      base(ctx, s, 0x8e8d88);
      clouds(ctx, s, 3, 34, [110, 110, 106], 0.55, 5);
      clouds(ctx, s, 9, 9, [70, 70, 68], 0.18, 3);
      blotches(ctx, s, 18, '60,60,58', 10, 50, 0.14, R);
      for (let i = 0; i < 5; i++) {   // form-board seams
        const y = R() * s;
        ctx.fillStyle = 'rgba(60,60,58,0.25)';
        ctx.fillRect(0, y, s, 1.5);
      }
      grain(ctx, s, 14, R);
    },
    normal: 1.6,
  },
  concreteWet: {
    tile: 0.35, rough: 0.32,
    draw(ctx, s, R) {
      RECIPES.concrete.draw(ctx, s, R);
      blotches(ctx, s, 24, '40,44,48', 16, 70, 0.35, R);
      grain(ctx, s, 8, R);
    },
    normal: 1.2,
  },
  concretePaint: {
    tile: 0.35, rough: 0.7,
    draw(ctx, s, R) {
      RECIPES.concrete.draw(ctx, s, R);
      ctx.fillStyle = 'rgba(190,196,190,0.55)';
      ctx.fillRect(0, 0, s, s);
      // paint that flaked back to the grey
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = 'rgba(120,120,116,0.5)';
        ctx.beginPath();
        ctx.ellipse(R() * s, R() * s, 3 + R() * 12, 2 + R() * 8, R() * 3, 0, 7);
        ctx.fill();
      }
      grain(ctx, s, 10, R);
    },
  },
  cinder: {
    tile: 0.28, rough: 0.92,
    draw(ctx, s, R) {
      base(ctx, s, 0x76736c);
      const rows = 4, h = s / rows, w = s / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 2; c++) {
          const v = (R() - 0.5) * 18;
          ctx.fillStyle = `rgb(${138 + v},${136 + v},${128 + v})`;
          ctx.fillRect(c * w + 2, r * h + 2, w - 4, h - 4);
          ctx.fillStyle = 'rgba(60,58,54,0.16)';
          for (let i = 0; i < 60; i++) ctx.fillRect(c * w + 2 + R() * (w - 6), r * h + 2 + R() * (h - 6), 2, 2);
        }
      }
      grain(ctx, s, 12, R);
    },
    normal: 2.0,
  },
  asphalt: {
    tile: 0.3, rough: 0.95,
    draw(ctx, s, R) {
      base(ctx, s, 0x2e2e30);
      for (let i = 0; i < 5000; i++) {
        const g = 40 + R() * 70;
        ctx.fillStyle = `rgba(${g},${g},${g + 4},${0.25 + R() * 0.4})`;
        ctx.fillRect(R() * s, R() * s, 1.6, 1.6);
      }
      blotches(ctx, s, 10, '20,20,22', 20, 60, 0.3, R);
      grain(ctx, s, 10, R);
    },
    normal: 1.4,
  },
  sidewalk: {
    tile: 0.25, rough: 0.9,
    draw(ctx, s, R) {
      base(ctx, s, 0x9c9a94);
      clouds(ctx, s, 21, 26, [120, 118, 112], 0.4);
      ctx.strokeStyle = 'rgba(70,70,66,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2); ctx.stroke();
      grain(ctx, s, 12, R);
    },
  },
  metalPlate: {
    tile: 0.5, rough: 0.45, metal: 0.75,
    draw(ctx, s, R) {
      base(ctx, s, 0x6d7076);
      streaks(ctx, s, 400, '40,42,46', 0.2, false, R, 0.4);
      // diamond tread
      ctx.strokeStyle = 'rgba(160,166,172,0.5)';
      ctx.lineWidth = 3;
      for (let i = -s; i < s * 2; i += 22) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i + s, 0); ctx.lineTo(i, s); ctx.stroke();
      }
      blotches(ctx, s, 8, '90,60,30', 8, 26, 0.25, R);
      grain(ctx, s, 8, R);
    },
    normal: 2.2,
  },
  grate: {
    tile: 0.5, rough: 0.5, metal: 0.8,
    draw(ctx, s, R) {
      base(ctx, s, 0x1b1c1e);
      ctx.strokeStyle = '#7a7d82';
      ctx.lineWidth = 5;
      for (let i = 0; i < s; i += 26) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      }
      ctx.lineWidth = 3;
      for (let i = 0; i < s; i += 52) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
      }
      grain(ctx, s, 10, R);
    },
    normal: 2.6,
  },
  pipeWall: {
    tile: 0.4, rough: 0.6, metal: 0.4,
    draw(ctx, s, R) {
      base(ctx, s, 0x4a4742);
      clouds(ctx, s, 31, 20, [70, 64, 58], 0.5);
      // pipe runs across the wall
      for (let i = 0; i < 6; i++) {
        const y = R() * s, r = 6 + R() * 12;
        const g = ctx.createLinearGradient(0, y - r, 0, y + r);
        g.addColorStop(0, 'rgba(120,116,108,0.9)');
        g.addColorStop(0.35, 'rgba(160,155,145,0.95)');
        g.addColorStop(1, 'rgba(50,48,44,0.95)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y - r, s, r * 2);
      }
      blotches(ctx, s, 14, '120,70,30', 8, 30, 0.3, R);
      grain(ctx, s, 12, R);
    },
    normal: 1.8,
  },
  rust: {
    tile: 0.4, rough: 0.85, metal: 0.3,
    draw(ctx, s, R) {
      base(ctx, s, 0x6b4526);
      clouds(ctx, s, 41, 18, [128, 74, 34], 0.6, 5);
      blotches(ctx, s, 30, '40,26,16', 8, 40, 0.4, R);
      blotches(ctx, s, 14, '176,104,48', 6, 22, 0.35, R);
      grain(ctx, s, 16, R);
    },
    normal: 1.7,
  },
  ductWall: {
    tile: 0.4, rough: 0.5, metal: 0.6,
    draw(ctx, s, R) {
      base(ctx, s, 0x9096a0);
      for (let x = 0; x < s; x += 32) {
        ctx.fillStyle = 'rgba(60,66,74,0.35)';
        ctx.fillRect(x, 0, 4, s);
        ctx.fillStyle = 'rgba(200,208,218,0.25)';
        ctx.fillRect(x + 5, 0, 2, s);
      }
      streaks(ctx, s, 200, '50,54,60', 0.15, false, R, 0.5);
      grain(ctx, s, 8, R);
    },
    normal: 1.5,
  },
  breakerWall: {
    tile: 0.4, rough: 0.55, metal: 0.5,
    draw(ctx, s, R) {
      base(ctx, s, 0x5a5f63);
      // cabinet doors with louvres and a warning label
      for (let i = 0; i < 2; i++) {
        const x = i * (s / 2);
        ctx.fillStyle = 'rgba(120,126,130,0.9)';
        ctx.fillRect(x + 6, 8, s / 2 - 12, s - 16);
        ctx.fillStyle = 'rgba(40,44,48,0.6)';
        for (let y = 20; y < s - 30; y += 10) ctx.fillRect(x + 14, y, s / 2 - 28, 3);
        ctx.fillStyle = '#c8b028';
        ctx.fillRect(x + s / 4 - 12, s - 40, 24, 14);
      }
      grain(ctx, s, 10, R);
    },
    normal: 1.6,
  },
  brick: { tile: 0.3, rough: 0.9, draw(ctx, s, R) { bricks(ctx, s, 8, [140, 72, 56], '#8e8478', R); grain(ctx, s, 12, R); }, normal: 2.2 },
  plywood: {
    tile: 0.35, rough: 0.85,
    draw(ctx, s, R) {
      base(ctx, s, 0xb08b52);
      streaks(ctx, s, 120, '120,88,44', 0.35, false, R, 1);
      clouds(ctx, s, 61, 30, [160, 122, 70], 0.3);
      grain(ctx, s, 14, R);
    },
    normal: 1.2,
  },

  // ---------------------------------------------------------- workplaces
  carpetOffice: {
    tile: 0.6, rough: 0.97,
    draw(ctx, s, R) {
      base(ctx, s, 0x4a5058);
      clouds(ctx, s, 7, 18, [60, 68, 78], 0.45, 5);
      streaks(ctx, s, 800, '30,34,40', 0.16, true, R, 0.1);
      streaks(ctx, s, 500, '96,104,116', 0.08, false, R, 0.1);
      grain(ctx, s, 12, R);
    },
    normal: 1.0,
  },
  cubicleFabric: {
    tile: 0.5, rough: 0.98,
    draw(ctx, s, R) {
      base(ctx, s, 0x6d7060);
      for (let i = 0; i < s; i += 3) {
        ctx.fillStyle = `rgba(40,44,36,${0.10 + R() * 0.08})`;
        ctx.fillRect(0, i, s, 1);
        ctx.fillRect(i, 0, 1, s);
      }
      blotches(ctx, s, 8, '30,34,28', 10, 30, 0.2, R);
      grain(ctx, s, 10, R);
    },
    normal: 1.2,
  },
  drywall: {
    tile: 0.4, rough: 0.9,
    draw(ctx, s, R) {
      base(ctx, s, 0xcfcbc0);
      clouds(ctx, s, 13, 40, [190, 186, 176], 0.3);
      // taped joints and a couple of patched dents
      ctx.fillStyle = 'rgba(200,196,186,0.7)';
      ctx.fillRect(0, s * 0.5 - 4, s, 8);
      blotches(ctx, s, 6, '150,146,138', 8, 26, 0.3, R);
      grain(ctx, s, 9, R);
    },
  },
  linoleum: {
    tile: 0.35, rough: 0.35,
    draw(ctx, s, R) {
      tiles(ctx, s, 4, [[214, 210, 196], [186, 182, 168]], '#b6b2a4', 1, R, 6);
      clouds(ctx, s, 17, 30, [160, 158, 146], 0.25);
      blotches(ctx, s, 10, '120,118,108', 8, 30, 0.18, R);
      grain(ctx, s, 8, R);
    },
    normal: 0.9,
  },
  lockerWall: {
    tile: 0.32, rough: 0.5, metal: 0.5,
    draw(ctx, s, R) {
      base(ctx, s, 0x2c4a52);
      for (let i = 0; i < 3; i++) {
        const x = i * (s / 3);
        ctx.fillStyle = 'rgba(58,96,104,0.95)';
        ctx.fillRect(x + 3, 4, s / 3 - 6, s - 8);
        ctx.fillStyle = 'rgba(20,34,38,0.8)';
        for (let y = 16; y < 40; y += 6) ctx.fillRect(x + 12, y, s / 3 - 24, 2);   // vents
        ctx.fillStyle = 'rgba(160,170,174,0.8)';
        ctx.fillRect(x + s / 3 - 18, s * 0.45, 6, 12);                              // latch
      }
      blotches(ctx, s, 10, '20,30,34', 6, 20, 0.3, R);
      grain(ctx, s, 10, R);
    },
    normal: 1.8,
  },
  chalkboard: {
    tile: 0.4, rough: 0.85,
    draw(ctx, s, R) {
      base(ctx, s, 0x27352e);
      clouds(ctx, s, 23, 24, [50, 66, 58], 0.4);
      streaks(ctx, s, 60, '200,208,200', 0.12, false, R, 0.6);
      grain(ctx, s, 8, R);
    },
  },
  tileHospital: {
    tile: 0.4, rough: 0.35,
    draw(ctx, s, R) {
      tiles(ctx, s, 8, [[176, 196, 178], [166, 188, 170], [182, 200, 184]], '#8ca08e', 2, R);
      blotches(ctx, s, 12, '90,110,94', 8, 30, 0.2, R);
      grain(ctx, s, 6, R);
    },
    normal: 1.8,
  },
  tileHospitalFloor: {
    tile: 0.3, rough: 0.3,
    draw(ctx, s, R) {
      tiles(ctx, s, 4, [[196, 200, 192], [186, 192, 182]], '#9aa096', 2, R, 5);
      blotches(ctx, s, 14, '120,126,116', 10, 40, 0.16, R);
      grain(ctx, s, 6, R);
    },
    normal: 1.2,
  },
  shelfWall: {
    tile: 0.3, rough: 0.85,
    draw(ctx, s, R) {
      base(ctx, s, 0x4a3a28);
      // book spines, hundreds of them, all unreadable
      for (let y = 0; y < s; y += 42) {
        ctx.fillStyle = 'rgba(30,24,16,0.9)';
        ctx.fillRect(0, y + 36, s, 6);
        let x = 0;
        while (x < s) {
          const w = 4 + R() * 10;
          const h = 30 + R() * 6;
          ctx.fillStyle = `hsl(${R() * 40 + 10}, ${20 + R() * 30}%, ${18 + R() * 28}%)`;
          ctx.fillRect(x, y + 36 - h, w - 1, h);
          x += w;
        }
      }
      grain(ctx, s, 10, R);
    },
    normal: 1.6,
  },
  woodPanel: {
    tile: 0.35, rough: 0.5,
    draw(ctx, s, R) {
      base(ctx, s, 0x5a3a20);
      streaks(ctx, s, 200, '40,24,12', 0.3, false, R, 1);
      clouds(ctx, s, 71, 26, [110, 70, 38], 0.3);
      for (let x = 0; x < s; x += 64) {
        ctx.fillStyle = 'rgba(20,12,6,0.5)';
        ctx.fillRect(x, 0, 3, s);
      }
      grain(ctx, s, 10, R);
    },
    normal: 1.1,
  },
  acousticWall: {
    tile: 0.4, rough: 0.95,
    draw(ctx, s, R) {
      base(ctx, s, 0x3c3c40);
      for (let y = 0; y < s; y += 8) {
        for (let x = 0; x < s; x += 8) {
          ctx.fillStyle = `rgba(20,20,24,${0.2 + R() * 0.3})`;
          ctx.beginPath(); ctx.arc(x + 4, y + 4, 2.4, 0, 7); ctx.fill();
        }
      }
      grain(ctx, s, 8, R);
    },
    normal: 1.6,
  },

  // ---------------------------------------------------------- the poolrooms
  tileWhite: {
    tile: 0.55, rough: 0.18,
    draw(ctx, s, R) {
      tiles(ctx, s, 10, [[236, 238, 234], [228, 232, 228], [240, 242, 238]], '#c8cec8', 2, R, 4);
      blotches(ctx, s, 8, '150,170,168', 10, 34, 0.10, R);
      grain(ctx, s, 4, R);
    },
    normal: 2.0,
  },
  tileBlue: {
    tile: 0.55, rough: 0.14,
    draw(ctx, s, R) {
      tiles(ctx, s, 10, [[64, 138, 168], [58, 124, 154], [76, 152, 180]], '#8fb9c8', 2, R, 8);
      grain(ctx, s, 4, R);
    },
    normal: 2.0,
  },
  tilePool: {
    tile: 0.45, rough: 0.12,
    draw(ctx, s, R) {
      tiles(ctx, s, 8, [[186, 214, 214], [176, 206, 208], [196, 222, 220]], '#a8c4c4', 2, R, 6);
      blotches(ctx, s, 6, '120,160,160', 12, 40, 0.12, R);
      grain(ctx, s, 3, R);
    },
    normal: 1.8,
  },
  tileMosaic: {
    tile: 0.7, rough: 0.16,
    draw(ctx, s, R) {
      tiles(ctx, s, 16, [[210, 230, 226], [150, 196, 202], [96, 160, 178], [232, 236, 228]], '#9ab4b8', 1, R, 10);
      grain(ctx, s, 4, R);
    },
    normal: 2.4,
  },
  poolTrim: {
    tile: 0.6, rough: 0.2,
    draw(ctx, s, R) {
      base(ctx, s, 0x2f6f8c);
      ctx.fillStyle = 'rgba(240,244,240,0.9)';
      ctx.fillRect(0, 0, s, s * 0.35);
      ctx.fillStyle = 'rgba(20,60,80,0.35)';
      ctx.fillRect(0, s * 0.35, s, 3);
      grain(ctx, s, 5, R);
    },
  },
  wetTileFloor: {
    tile: 0.4, rough: 0.08,
    draw(ctx, s, R) {
      tiles(ctx, s, 6, [[206, 216, 212], [196, 208, 204]], '#b0bcb8', 2, R, 5);
      // standing water films
      blotches(ctx, s, 16, '120,150,155', 14, 50, 0.22, R);
      grain(ctx, s, 3, R);
    },
    normal: 1.4,
  },
  marble: {
    tile: 0.3, rough: 0.15,
    draw(ctx, s, R) {
      base(ctx, s, 0xe8e6e0);
      clouds(ctx, s, 91, 44, [190, 188, 184], 0.5, 5);
      ctx.strokeStyle = 'rgba(120,118,116,0.35)';
      for (let i = 0; i < 18; i++) {
        ctx.lineWidth = 0.6 + R() * 1.6;
        ctx.beginPath();
        let x = R() * s, y = 0;
        ctx.moveTo(x, y);
        while (y < s) { x += (R() - 0.5) * 26; y += 12; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      grain(ctx, s, 5, R);
    },
  },

  // ---------------------------------------------------------- hotels & houses
  wallpaperHotel: {
    tile: 0.45, rough: 0.8,
    draw(ctx, s, R) {
      base(ctx, s, 0x6d2a2e);
      // damask-ish medallions
      ctx.strokeStyle = 'rgba(198,168,110,0.5)';
      ctx.lineWidth = 2;
      for (let y = 0; y < s; y += 64) {
        for (let x = 0; x < s; x += 64) {
          const ox = x + ((y / 64) % 2) * 32;
          ctx.beginPath();
          ctx.ellipse(ox + 32, y + 32, 16, 24, 0, 0, 7);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(ox + 32, y + 32, 7, 12, 0, 0, 7);
          ctx.stroke();
        }
      }
      clouds(ctx, s, 101, 34, [50, 20, 22], 0.35);
      grain(ctx, s, 10, R);
    },
  },
  carpetHotel: {
    tile: 0.5, rough: 0.96,
    draw(ctx, s, R) {
      base(ctx, s, 0x59202a);
      // the pattern that makes hotel corridors feel infinite
      ctx.strokeStyle = 'rgba(190,150,80,0.35)';
      ctx.lineWidth = 3;
      for (let i = 0; i < s; i += 32) {
        ctx.beginPath();
        ctx.arc(i, i % 64 ? 24 : s - 24, 18, 0, 7);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(30,10,14,0.4)';
      for (let i = 16; i < s; i += 32) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
      }
      streaks(ctx, s, 600, '20,8,10', 0.14, true, R, 0.1);
      grain(ctx, s, 12, R);
    },
    normal: 1.0,
  },
  woodFloor: {
    tile: 0.35, rough: 0.4,
    draw(ctx, s, R) {
      base(ctx, s, 0x6b4726);
      const h = s / 6;
      for (let r = 0; r < 6; r++) {
        const off = (r % 2) * (s / 3);
        for (let x = -s; x < s * 2; x += s / 1.5) {
          const v = (R() - 0.5) * 26;
          ctx.fillStyle = `rgb(${132 + v},${92 + v * 0.7},${52 + v * 0.4})`;
          ctx.fillRect(x + off, r * h + 1, s / 1.5 - 2, h - 2);
        }
        ctx.fillStyle = 'rgba(30,18,8,0.45)';
        ctx.fillRect(0, r * h, s, 1.5);
      }
      streaks(ctx, s, 300, '50,30,14', 0.2, false, R, 0.6);
      grain(ctx, s, 10, R);
    },
    normal: 1.1,
  },
  wallpaperParty: {
    tile: 0.45, rough: 0.78,
    draw(ctx, s, R) {
      base(ctx, s, 0xf0d8b0);
      for (let i = 0; i < s; i += 24) {
        ctx.fillStyle = i % 48 ? 'rgba(240,150,170,0.55)' : 'rgba(150,200,230,0.5)';
        ctx.fillRect(i, 0, 12, s);
      }
      // confetti, ground into the paper
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = `hsla(${R() * 360},70%,60%,0.5)`;
        ctx.fillRect(R() * s, R() * s, 3, 3);
      }
      clouds(ctx, s, 111, 40, [200, 170, 130], 0.25);
      grain(ctx, s, 9, R);
    },
  },
  curtain: {
    tile: 0.5, rough: 0.95,
    draw(ctx, s, R) {
      base(ctx, s, 0x5c4a52);
      for (let x = 0; x < s; x += 14) {
        const g = ctx.createLinearGradient(x, 0, x + 14, 0);
        g.addColorStop(0, 'rgba(20,14,18,0.5)');
        g.addColorStop(0.5, 'rgba(150,130,140,0.25)');
        g.addColorStop(1, 'rgba(20,14,18,0.5)');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 14, s);
      }
      grain(ctx, s, 10, R);
    },
    normal: 1.6,
  },
  stucco: {
    tile: 0.35, rough: 0.92,
    draw(ctx, s, R) {
      base(ctx, s, 0xbeb5a2);
      for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = `rgba(${140 + R() * 60},${134 + R() * 56},${118 + R() * 50},0.5)`;
        ctx.beginPath(); ctx.arc(R() * s, R() * s, 1 + R() * 2.4, 0, 7); ctx.fill();
      }
      clouds(ctx, s, 121, 30, [150, 142, 126], 0.3);
      grain(ctx, s, 12, R);
    },
    normal: 2.2,
  },
  siding: {
    tile: 0.3, rough: 0.75,
    draw(ctx, s, R) {
      base(ctx, s, 0xc9cbc0);
      const h = s / 8;
      for (let r = 0; r < 8; r++) {
        const g = ctx.createLinearGradient(0, r * h, 0, (r + 1) * h);
        g.addColorStop(0, 'rgba(255,255,250,0.35)');
        g.addColorStop(1, 'rgba(120,124,116,0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(0, r * h, s, h);
        ctx.fillStyle = 'rgba(70,74,68,0.4)';
        ctx.fillRect(0, (r + 1) * h - 2, s, 2);
      }
      grain(ctx, s, 8, R);
    },
    normal: 1.5,
  },

  // ---------------------------------------------------------- the outdoors
  grassDry: {
    tile: 0.5, rough: 0.95,
    draw(ctx, s, R) {
      base(ctx, s, 0x5c5c32);
      clouds(ctx, s, 131, 20, [90, 88, 48], 0.5, 5);
      streaks(ctx, s, 1200, '116,112,58', 0.2, true, R, 0.05);
      streaks(ctx, s, 400, '40,44,26', 0.2, true, R, 0.04);
      grain(ctx, s, 14, R);
    },
    normal: 1.2,
  },
  wheat: {
    tile: 0.5, rough: 0.9,
    draw(ctx, s, R) {
      base(ctx, s, 0xa08c46);
      streaks(ctx, s, 1600, '210,186,110', 0.28, true, R, 0.08);
      streaks(ctx, s, 700, '110,92,40', 0.24, true, R, 0.06);
      clouds(ctx, s, 141, 26, [180, 158, 90], 0.3);
      grain(ctx, s, 12, R);
    },
    normal: 1.4,
  },
  dirt: {
    tile: 0.4, rough: 0.96,
    draw(ctx, s, R) {
      base(ctx, s, 0x5a4530);
      clouds(ctx, s, 151, 18, [82, 62, 42], 0.55, 5);
      for (let i = 0; i < 700; i++) {
        ctx.fillStyle = `rgba(${90 + R() * 60},${70 + R() * 40},${50 + R() * 30},0.5)`;
        ctx.fillRect(R() * s, R() * s, 2, 2);
      }
      grain(ctx, s, 14, R);
    },
    normal: 1.6,
  },
  gravel: {
    tile: 0.45, rough: 0.95,
    draw(ctx, s, R) {
      base(ctx, s, 0x63625c);
      for (let i = 0; i < 2400; i++) {
        const g = 70 + R() * 90;
        ctx.fillStyle = `rgba(${g},${g - 4},${g - 10},0.7)`;
        ctx.beginPath(); ctx.ellipse(R() * s, R() * s, 1.5 + R() * 3, 1.2 + R() * 2.4, R() * 3, 0, 7); ctx.fill();
      }
      grain(ctx, s, 12, R);
    },
    normal: 2.4,
  },
  rock: {
    tile: 0.3, rough: 0.88,
    draw(ctx, s, R) {
      base(ctx, s, 0x6a6660);
      clouds(ctx, s, 161, 40, [92, 88, 82], 0.6, 5);
      clouds(ctx, s, 167, 12, [50, 48, 44], 0.25, 3);
      ctx.strokeStyle = 'rgba(30,28,26,0.4)';
      for (let i = 0; i < 22; i++) {
        ctx.lineWidth = 0.8 + R() * 2;
        ctx.beginPath();
        let x = R() * s, y = R() * s;
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      grain(ctx, s, 14, R);
    },
    normal: 2.6,
  },
  moss: {
    tile: 0.5, rough: 0.98,
    draw(ctx, s, R) {
      base(ctx, s, 0x2c3a22);
      clouds(ctx, s, 171, 14, [58, 82, 40], 0.6, 5);
      for (let i = 0; i < 1800; i++) {
        ctx.fillStyle = `rgba(${40 + R() * 60},${70 + R() * 70},${30 + R() * 40},0.5)`;
        ctx.beginPath(); ctx.arc(R() * s, R() * s, 1 + R() * 2, 0, 7); ctx.fill();
      }
      grain(ctx, s, 12, R);
    },
    normal: 2.0,
  },
  sand: {
    tile: 0.5, rough: 0.95,
    draw(ctx, s, R) {
      base(ctx, s, 0xb8a274);
      clouds(ctx, s, 181, 30, [166, 146, 104], 0.35);
      for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = `rgba(${190 + R() * 50},${170 + R() * 40},${130 + R() * 40},0.4)`;
        ctx.fillRect(R() * s, R() * s, 1.4, 1.4);
      }
      grain(ctx, s, 10, R);
    },
    normal: 1.0,
  },
  snow: {
    tile: 0.4, rough: 0.55,
    draw(ctx, s, R) {
      base(ctx, s, 0xe8eef4);
      clouds(ctx, s, 191, 34, [200, 214, 228], 0.4);
      for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.5})`;
        ctx.fillRect(R() * s, R() * s, 1.6, 1.6);
      }
      grain(ctx, s, 6, R);
    },
    normal: 0.8,
  },
  ice: {
    tile: 0.35, rough: 0.1,
    draw(ctx, s, R) {
      base(ctx, s, 0xa8c4d4);
      clouds(ctx, s, 201, 40, [150, 186, 208], 0.5);
      ctx.strokeStyle = 'rgba(240,250,255,0.4)';
      for (let i = 0; i < 26; i++) {
        ctx.lineWidth = 0.6 + R() * 1.4;
        ctx.beginPath();
        let x = R() * s, y = R() * s;
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 70; y += (R() - 0.5) * 70; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      grain(ctx, s, 5, R);
    },
    normal: 1.2,
  },
  mud: {
    tile: 0.4, rough: 0.4,
    draw(ctx, s, R) {
      base(ctx, s, 0x39301f);
      clouds(ctx, s, 211, 22, [56, 46, 30], 0.55, 5);
      blotches(ctx, s, 20, '20,18,12', 10, 40, 0.4, R);
      blotches(ctx, s, 8, '90,86,70', 8, 20, 0.2, R);   // standing water sheen
      grain(ctx, s, 10, R);
    },
    normal: 1.8,
  },

  // ---------------------------------------------------------- odds and ends
  // Pool glazing: no wire, no frost, just thick clean glass with the water line dried
  // on it and a chlorine bloom in the corners. What matters is that you can see the next
  // flooded room through it long before you can work out how to get in there.
  glassPool: {
    tile: 0.5, rough: 0.04, metal: 0.05, opacity: 0.16,
    draw(ctx, s, R) {
      base(ctx, s, 0xbfe4ec);
      clouds(ctx, s, 77, 70, [220, 245, 250], 0.4);
      // dried water lines and runs
      streaks(ctx, s, 26, '255,255,255', 0.12, true, R, 0.9);
      for (let i = 0; i < 5; i++) {
        const y = R() * s;
        ctx.strokeStyle = `rgba(230,250,255,${(0.06 + R() * 0.1).toFixed(2)})`;
        ctx.lineWidth = 1 + R() * 2.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < s; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.07 + i) * 2);
        ctx.stroke();
      }
      blotches(ctx, s, 10, '210,240,246', 6, 26, 0.16, R);
      grain(ctx, s, 4, R);
    },
  },
  glass: {
    tile: 0.4, rough: 0.05, metal: 0.1, opacity: 0.28,
    draw(ctx, s, R) {
      base(ctx, s, 0x9fb4c0);
      clouds(ctx, s, 221, 60, [200, 220, 230], 0.35);
      streaks(ctx, s, 40, '255,255,255', 0.1, true, R, 0.8);
      // wired safety glass
      ctx.strokeStyle = 'rgba(120,130,136,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < s; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
      }
    },
  },
  mirror: {
    tile: 0.4, rough: 0.06, metal: 0.95,
    draw(ctx, s, R) {
      base(ctx, s, 0xb8c4cc);
      clouds(ctx, s, 231, 50, [150, 166, 176], 0.3);
      blotches(ctx, s, 10, '90,100,108', 10, 30, 0.2, R);   // the silvering going
    },
  },
  void: { tile: 0.2, rough: 1, draw(ctx, s) { base(ctx, s, 0x000000); } },
  blackout: {
    tile: 0.3, rough: 1,
    draw(ctx, s, R) {
      base(ctx, s, 0x0a0a0c);
      grain(ctx, s, 6, R);
    },
  },
  fleshWall: {
    tile: 0.4, rough: 0.55,
    draw(ctx, s, R) {
      base(ctx, s, 0x6a3a38);
      clouds(ctx, s, 241, 20, [110, 60, 56], 0.5, 5);
      // capillary tracery, not gore
      ctx.strokeStyle = 'rgba(150,80,74,0.35)';
      for (let i = 0; i < 40; i++) {
        ctx.lineWidth = 0.5 + R() * 1.2;
        ctx.beginPath();
        let x = R() * s, y = R() * s;
        ctx.moveTo(x, y);
        for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      grain(ctx, s, 12, R);
    },
    normal: 2.0,
  },
  paper: {
    tile: 0.4, rough: 0.9,
    draw(ctx, s, R) {
      base(ctx, s, 0xd8d2c0);
      // pinned pages, layer on layer
      for (let i = 0; i < 26; i++) {
        ctx.save();
        ctx.translate(R() * s, R() * s);
        ctx.rotate((R() - 0.5) * 0.5);
        ctx.fillStyle = `rgba(${226 + R() * 20},${222 + R() * 16},${206 + R() * 14},0.9)`;
        ctx.fillRect(-22, -30, 44, 60);
        ctx.fillStyle = 'rgba(90,86,74,0.35)';
        for (let l = 0; l < 8; l++) ctx.fillRect(-16, -22 + l * 6, 30 * R(), 1.4);
        ctx.restore();
      }
      grain(ctx, s, 8, R);
    },
    normal: 1.0,
  },
  foam: {
    tile: 0.4, rough: 0.98,
    draw(ctx, s, R) {
      base(ctx, s, 0x3a3630);
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = `rgba(${20 + R() * 40},${18 + R() * 36},${16 + R() * 32},0.6)`;
        ctx.beginPath(); ctx.arc(R() * s, R() * s, 2 + R() * 5, 0, 7); ctx.fill();
      }
      grain(ctx, s, 10, R);
    },
    normal: 2.4,
  },
};

// ------------------------------------------------------------------ bake hook
// Level geometry carries per-vertex irradiance in `abake`. Four injected lines
// add it to the lit result — so baked room light and a dynamic flashlight can
// coexist without one cancelling the other.
export function attachBake(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute vec3 abake;\nvarying vec3 vBake;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBake = abake;');
    shader.fragmentShader = `varying vec3 vBake;\n${shader.fragmentShader}`
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vBake * diffuseColor.rgb;',
      );
  };
  mat.customProgramCacheKey = () => 'ebbake';
  return mat;
}

// ------------------------------------------------------------------ cache
const texCache = new Map();
const matCache = new Map();

function textureFor(name) {
  if (texCache.has(name)) return texCache.get(name);
  const rec = RECIPES[name];
  if (!rec) throw new Error(`no texture recipe for "${name}"`);
  const R = rng(1000 + name.length * 977 + name.charCodeAt(0) * 31);
  const size = rec.size || SIZE;
  const cv = mk(size, (ctx, s) => rec.draw(ctx, s, R, new Noise2(name.length * 13 + 7)));
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

// One material per surface name, with `abake` support wired in. `repeatScale`
// converts the recipe's tiles-per-metre into UV repeats for the geometry, which
// builds its UVs in metres.
export function material(name) {
  if (matCache.has(name)) return matCache.get(name);
  const { map, normal, rec } = textureFor(name);
  const mat = new THREE.MeshStandardMaterial({
    map,
    normalMap: normal || undefined,
    normalScale: normal ? new THREE.Vector2(0.8, 0.8) : undefined,
    roughness: rec.rough ?? 0.85,
    metalness: rec.metal ?? 0.02,
    vertexColors: false,
    transparent: rec.opacity !== undefined,
    opacity: rec.opacity ?? 1,
    // Two-sided on purpose: level geometry is single-quad walls, and a wall that
    // vanishes when you slide along it ruins the room. Backface culling saves
    // nothing here — the whole level is eight draw calls.
    side: THREE.DoubleSide,
    emissive: new THREE.Color(rec.emissive ?? 0x000000),
  });
  mat.name = name;
  mat.userData.tile = rec.tile ?? 0.4;
  attachBake(mat);
  matCache.set(name, mat);
  return mat;
}

// How many texture repeats per metre this surface wants.
export const tileScale = (name) => (RECIPES[name]?.tile ?? 0.4);

// A plain lit material for props and creatures, with the same bake hook so a
// chair sits in the same light as the floor under it.
export function simple(color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.8,
    metalness: opts.metal ?? 0.05,
    transparent: opts.opacity !== undefined,
    opacity: opts.opacity ?? 1,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    flatShading: !!opts.flat,
  });
  if (opts.bake !== false) attachBake(mat);
  return mat;
}

// ------------------------------------------------------------------ specials
// Water surface: two scrolling wave layers, drawn once and animated by UV
// offset in world.js. Cheap, and reads exactly right at waist height.
export function waterTexture(seed = 7) {
  const n = new Noise2(seed);
  const cv = mk(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = n.fbm(x / 26, y / 26, 4) * 0.5 + 0.5;
        const w = n.fbm(x / 7 + 40, y / 7, 3) * 0.5 + 0.5;
        const i = (y * s + x) * 4;
        const l = 0.55 + v * 0.35 + w * 0.1;
        img.data[i] = 120 * l;
        img.data[i + 1] = 190 * l;
        img.data[i + 2] = 205 * l;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function waterNormal(seed = 11) {
  const n = new Noise2(seed + 3);
  const cv = mk(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = (n.fbm(x / 18, y / 18, 4) * 0.5 + 0.5) * 255;
        const i = (y * s + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(normalFrom(cv, 3.4));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Caustics for pool floors: bright interlocking cells that scroll and breathe.
export function causticTexture(seed = 5) {
  const n = new Noise2(seed);
  const cv = mk(256, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const a = n.fbm(x / 20, y / 20, 3);
        const b = n.fbm(x / 13 + 30, y / 13 - 12, 3);
        let v = 1 - Math.min(1, Math.abs(a - b) * 6);
        v = Math.pow(v, 3);
        const i = (y * s + x) * 4;
        img.data[i] = 255 * v;
        img.data[i + 1] = 255 * v;
        img.data[i + 2] = 240 * v;
        img.data[i + 3] = 255 * v;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The tape's own damage: dust, hairs and scratches on the lens, composited by
// the camcorder pass so it sits over everything.
export function lensDirtTexture() {
  const cv = mk(512, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const R = rng(4242);
    for (let i = 0; i < 90; i++) {
      const x = R() * s, y = R() * s, r = 1 + R() * 4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.05 + R() * 0.12})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 6; i++) {
      ctx.lineWidth = 0.6 + R();
      ctx.beginPath();
      let x = R() * s, y = R() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 120; y += (R() - 0.5) * 120; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The title-card logo, drawn as a canvas so the boot screen needs no font file
// beyond the browser's own.
export function logoCanvas(text = 'NOCLIP', w = 1024, h = 260) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.font = `bold ${Math.floor(h * 0.62)}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // chromatic split, like a tape that has been paused too many times
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#ff2a2a';
  ctx.fillText(text, w / 2 - 5, h / 2);
  ctx.fillStyle = '#22e0ff';
  ctx.fillText(text, w / 2 + 5, h / 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f4f2e8';
  ctx.fillText(text, w / 2, h / 2);
  // scanline chew
  ctx.globalCompositeOperation = 'destination-out';
  const R = rng(99);
  for (let y = 0; y < h; y += 3) {
    if (R() < 0.12) ctx.fillRect(0, y, w, 1 + R() * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  return cv;
}

export function clearCaches() {
  texCache.clear();
  matCache.clear();
}
