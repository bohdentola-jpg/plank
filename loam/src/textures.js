// The look of the world: a 16px-tile texture atlas, item icons, crack decals,
// and the title logo — all drawn pixel-by-pixel, deterministically, in code.
import { hashStr, hash3, rng } from './util.js';
import { B, BLOCKS } from './blocks.js';

const TS = 16; // tile size in px

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}
const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Tile painter: every pixel goes through px() so we can track each tile's
// average color (for break particles) without reading the canvas back.
class Painter {
  constructor(ctx, ox, oy, seed) {
    this.ctx = ctx; this.ox = ox; this.oy = oy;
    this.seed = seed;
    this.sum = [0, 0, 0, 0];
  }
  px(x, y, hex, a = 1) {
    if (x < 0 || y < 0 || x >= TS || y >= TS) return;
    let f = hex;
    if (typeof hex === 'string') {
      if (hex[0] === '#') f = rgbOf(hex);
      else f = hex.match(/\d+/g).map(Number); // 'rgb(r,g,b)' from shade()
    }
    this.ctx.fillStyle = `rgba(${f[0] | 0},${f[1] | 0},${f[2] | 0},${a})`;
    this.ctx.fillRect(this.ox + x, this.oy + y, 1, 1);
    if (a > 0.4) {
      this.sum[0] += f[0]; this.sum[1] += f[1]; this.sum[2] += f[2]; this.sum[3]++;
    }
  }
  // per-pixel brightness jitter over a base color
  noise(hex, vary = 0.14, fn = null) {
    const c = rgbOf(hex);
    for (let y = 0; y < TS; y++) {
      for (let x = 0; x < TS; x++) {
        if (fn && !fn(x, y)) continue;
        const h = hash3(this.seed, x, y, 0);
        const f = 1 + (h - 0.5) * 2 * vary;
        this.px(x, y, [c[0] * f, c[1] * f, c[2] * f]);
      }
    }
  }
  rand(x, y, k = 0) { return hash3(this.seed ^ k, x, y, 1); }
  avg() {
    const s = this.sum;
    return s[3] ? [s[0] / s[3] / 255, s[1] / s[3] / 255, s[2] / s[3] / 255] : [0.5, 0.5, 0.5];
  }
}

// ------------------------------------------------------------ tile painters
const speckle = (p, hex, n, k = 7) => {
  for (let i = 0; i < n; i++) {
    const x = (p.rand(i, 0, k) * TS) | 0, y = (p.rand(i, 1, k) * TS) | 0;
    p.px(x, y, hex);
  }
};

const oreTile = (base, chip, hi) => (p) => {
  p.noise('#888a8f', 0.1);
  for (let i = 0; i < 4; i++) {
    const cx = 2 + ((p.rand(i, 2) * 12) | 0), cy = 2 + ((p.rand(i, 3) * 12) | 0);
    for (let d = 0; d < 4; d++) {
      const x = cx + ((p.rand(i, d + 4) * 3) | 0) - 1, y = cy + ((p.rand(i, d + 8) * 3) | 0) - 1;
      p.px(x, y, chip);
      if (p.rand(i, d + 12) < 0.4) p.px(x + 1, y, hi);
    }
  }
};

const metalTile = (base, hi, lo) => (p) => {
  p.noise(base, 0.04);
  for (let i = 0; i < TS; i++) { p.px(i, 0, hi); p.px(0, i, hi); p.px(i, TS - 1, lo); p.px(TS - 1, i, lo); }
  p.px(3, 3, hi); p.px(12, 3, hi); p.px(3, 12, hi); p.px(12, 12, hi);
};

const TILE_PAINTERS = {
  grass_top(p) {
    p.noise('#71b03f', 0.13);
    speckle(p, '#8fcf5a', 14); speckle(p, '#5d9433', 10, 11);
  },
  dirt(p) { p.noise('#79553a', 0.16); speckle(p, '#8a6647', 8); speckle(p, '#5f4129', 7, 9); },
  grass_side(p) {
    p.noise('#79553a', 0.16);
    for (let x = 0; x < TS; x++) {
      const d = 2 + ((p.rand(x, 0) * 3) | 0);
      for (let y = 0; y < d; y++) p.px(x, y, shade('#71b03f', 0.85 + p.rand(x, y) * 0.3));
    }
  },
  stone(p) { p.noise('#8a8a8e', 0.09); speckle(p, '#77777b', 12); speckle(p, '#9a9a9e', 8, 5); },
  cobble(p) {
    p.noise('#7e7e82', 0.1);
    // pebbles: jittered 4x4 cells with bright tops and dark seams
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        const f = 0.82 + p.rand(cx, cy, 3) * 0.4;
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
          const ex = cx * 4 + x, ey = cy * 4 + y;
          const edge = x === 0 || y === 3;
          p.px(ex, ey, shade('#86868a', edge ? f * 0.62 : f * (y === 0 ? 1.12 : 1)));
        }
      }
    }
  },
  bedrock(p) {
    p.noise('#4a4a4e', 0.3);
    speckle(p, '#222226', 20); speckle(p, '#646468', 12, 5);
  },
  gravel(p) { p.noise('#827d78', 0.2); speckle(p, '#a59f98', 14); speckle(p, '#5d5852', 14, 9); },
  sand(p) { p.noise('#e3d6a0', 0.07); speckle(p, '#efe6bb', 10); speckle(p, '#cfc088', 8, 4); },
  sandstone(p) {
    p.noise('#dccf9a', 0.05);
    for (let y = 3; y < TS; y += 4) for (let x = 0; x < TS; x++) p.px(x, y, shade('#dccf9a', 0.86));
  },
  sandstone_top(p) { p.noise('#e0d49f', 0.05); },
  water(p) {
    const c = rgbOf('#3f66d4');
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const h = p.rand(x, y);
      const wave = (y % 5 === (x / 3 | 0) % 5) ? 1.25 : 1;
      p.px(x, y, [c[0] * wave, c[1] * wave, (c[2] * (0.9 + h * 0.2) * wave)], 0.62);
    }
  },
  lava(p) {
    p.noise('#cf4a0e', 0.25);
    for (let i = 0; i < 5; i++) {
      let x = (p.rand(i, 0) * TS) | 0, y = (p.rand(i, 1) * TS) | 0;
      for (let s = 0; s < 9; s++) {
        p.px(x & 15, y & 15, s % 3 ? '#ffb31f' : '#ffe26b');
        x += p.rand(i, s + 2) < 0.5 ? 1 : 0; y += p.rand(i, s + 7) < 0.5 ? 1 : 0;
      }
    }
  },
  ice(p) {
    const c = rgbOf('#a8c8ee');
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const f = 0.92 + p.rand(x, y) * 0.16;
      p.px(x, y, [c[0] * f, c[1] * f, c[2] * f], 0.9);
    }
    p.px(4, 3, '#e8f4ff'); p.px(5, 4, '#e8f4ff'); p.px(11, 9, '#e8f4ff'); p.px(12, 10, '#e8f4ff');
  },
  log(p) {
    for (let x = 0; x < TS; x++) {
      const f = 0.8 + p.rand(x, 0) * 0.45;
      for (let y = 0; y < TS; y++) {
        const knot = p.rand(x, y, 4) > 0.96;
        p.px(x, y, shade('#6b4a2b', knot ? 0.6 : f * (0.94 + p.rand(x, y, 2) * 0.12)));
      }
    }
  },
  spruce_log(p) {
    for (let x = 0; x < TS; x++) {
      const f = 0.75 + p.rand(x, 0) * 0.4;
      for (let y = 0; y < TS; y++) p.px(x, y, shade('#473322', f * (0.94 + p.rand(x, y, 2) * 0.12)));
    }
  },
  log_top(p) {
    p.noise('#6b4a2b', 0.08);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if ((d | 0) % 2 === 0) p.px(x, y, shade('#c79b5d', 0.92 + p.rand(x, y) * 0.16));
      else p.px(x, y, shade('#9c7544', 0.92 + p.rand(x, y) * 0.16));
    }
  },
  leaves(p) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const h = p.rand(x, y);
      if (h < 0.12) continue; // see-through holes
      p.px(x, y, shade(h > 0.82 ? '#62a83c' : '#3e7a24', 0.85 + p.rand(x, y, 3) * 0.3));
    }
  },
  spruce_leaves(p) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const h = p.rand(x, y);
      if (h < 0.1) continue;
      p.px(x, y, shade(h > 0.85 ? '#4d7d56' : '#2e5538', 0.85 + p.rand(x, y, 3) * 0.3));
    }
  },
  planks(p) {
    for (let y = 0; y < TS; y++) {
      const board = (y / 4) | 0;
      for (let x = 0; x < TS; x++) {
        const seam = y % 4 === 3 || (x === ((board * 7 + 3) % TS) && y % 4 !== 3);
        const grain = p.rand(x, board, 6) > 0.85;
        p.px(x, y, shade('#a37b46', seam ? 0.55 : grain ? 0.82 : 0.95 + p.rand(x, y) * 0.14));
      }
    }
  },
  glass(p) {
    for (let i = 0; i < TS; i++) {
      p.px(i, 0, '#dcecf2', 0.9); p.px(i, TS - 1, '#dcecf2', 0.9);
      p.px(0, i, '#dcecf2', 0.9); p.px(TS - 1, i, '#dcecf2', 0.9);
    }
    for (let i = 2; i < 7; i++) p.px(i, 8 - i, '#ffffff', 0.55);
    for (let i = 5; i < 12; i++) p.px(i, 17 - i, '#ffffff', 0.35);
  },
  coal_ore: oreTile('#888a8f', '#26262a', '#3c3c40'),
  iron_ore: oreTile('#888a8f', '#c98e6a', '#e8b894'),
  gold_ore: oreTile('#888a8f', '#e8b820', '#ffe27a'),
  diamond_ore: oreTile('#888a8f', '#35cfd4', '#9ef4f4'),
  snow(p) { p.noise('#f2f6fa', 0.04); speckle(p, '#ffffff', 8); },
  snowy_side(p) {
    p.noise('#79553a', 0.16);
    for (let x = 0; x < TS; x++) {
      const d = 2 + ((p.rand(x, 0) * 3) | 0);
      for (let y = 0; y < d; y++) p.px(x, y, shade('#f2f6fa', 0.94 + p.rand(x, y) * 0.1));
    }
  },
  cactus(p) {
    p.noise('#5d9440', 0.08, (x) => x > 0 && x < 15);
    for (let y = 0; y < TS; y++) {
      p.px(1, y, '#79b85c'); p.px(14, y, '#3d6b28');
      if (y % 4 === 1) { p.px(4, y, '#2f5520'); p.px(9, y, '#2f5520'); p.px(12, y, '#2f5520'); }
    }
  },
  cactus_top(p) { p.noise('#6aa84c', 0.07); for (let i = 0; i < TS; i++) { p.px(i, 0, '#79b85c'); p.px(i, 15, '#3d6b28'); } },
  poppy(p) {
    for (let y = 6; y < 15; y++) p.px(7 + (y > 11 ? 1 : 0), y, '#3e7a24');
    p.px(6, 9, '#4d9430');
    for (const [x, y] of [[6, 3], [7, 3], [8, 3], [6, 4], [7, 4], [8, 4], [7, 2], [5, 4], [9, 4], [7, 5]]) p.px(x, y, '#d43c2a');
    p.px(7, 3, '#2a2a2e');
  },
  dandelion(p) {
    for (let y = 7; y < 15; y++) p.px(8, y, '#3e7a24');
    for (const [x, y] of [[7, 4], [8, 4], [9, 4], [7, 5], [8, 5], [9, 5], [8, 3], [6, 5], [10, 4]]) p.px(x, y, '#f4d428');
    p.px(8, 4, '#fff292');
  },
  tallgrass(p) {
    for (let i = 0; i < 7; i++) {
      const x = 2 + i * 2, h = 6 + ((p.rand(i, 0) * 7) | 0);
      for (let y = 15; y > 15 - h; y--) p.px(x + (y < 11 ? (p.rand(i, y) > 0.5 ? 1 : 0) : 0), y, shade('#5d9433', 0.8 + p.rand(i, y) * 0.4));
    }
  },
  torch(p) {
    for (let y = 6; y < 16; y++) { p.px(7, y, '#7a5a30'); p.px(8, y, '#5e4424'); }
    p.px(7, 5, '#ffdc6a'); p.px(8, 5, '#ffdc6a');
    p.px(7, 4, '#fff4b8'); p.px(8, 4, '#ffc83c');
    p.px(7, 3, '#ffb428'); p.px(8, 3, '#fff4b8');
  },
  table_top(p) {
    TILE_PAINTERS.planks(p);
    for (let i = 0; i < TS; i++) { p.px(i, 0, '#6e4f28'); p.px(i, 15, '#6e4f28'); p.px(0, i, '#6e4f28'); p.px(15, i, '#6e4f28'); }
    for (let i = 4; i < 12; i++) { p.px(i, 4, '#54381c'); p.px(i, 11, '#54381c'); p.px(4, i, '#54381c'); p.px(11, i, '#54381c'); }
  },
  table_side(p) {
    TILE_PAINTERS.planks(p);
    p.px(3, 4, '#8c8c90'); p.px(4, 4, '#8c8c90'); p.px(3, 5, '#6e6e72'); p.px(4, 5, '#56361a');
    p.px(11, 4, '#d4a04a'); p.px(12, 4, '#d4a04a'); p.px(11, 5, '#56361a'); p.px(12, 5, '#56361a');
  },
  furnace(p) {
    TILE_PAINTERS.stone(p);
    for (let y = 7; y < 14; y++) for (let x = 4; x < 12; x++) p.px(x, y, '#2c2c30');
    for (let x = 5; x < 11; x++) { p.px(x, 12, '#ff9c1e'); p.px(x, 13, '#ffd45e'); }
    p.px(6, 11, '#ff9c1e'); p.px(9, 11, '#ffd45e');
  },
  furnace_side(p) { TILE_PAINTERS.stone(p); for (let i = 0; i < TS; i++) { p.px(i, 0, '#6e6e72'); p.px(0, i, '#6e6e72'); } },
  wool(p) {
    p.noise('#ece9e2', 0.06);
    for (let i = 0; i < 9; i++) {
      const x = (p.rand(i, 0) * 14) | 0, y = (p.rand(i, 1) * 14) | 0;
      p.px(x, y, '#f8f6f0'); p.px(x + 1, y, '#dcd8ce'); p.px(x, y + 1, '#dcd8ce');
    }
  },
  stone_brick(p) {
    p.noise('#86868a', 0.07);
    for (let x = 0; x < TS; x++) { p.px(x, 7, '#5c5c60'); p.px(x, 15, '#5c5c60'); p.px(x, 0, '#9a9a9e'); }
    for (let y = 0; y < 8; y++) p.px(7, y, '#5c5c60');
    for (let y = 8; y < 16; y++) { p.px(3, y, '#5c5c60'); p.px(11, y, '#5c5c60'); }
  },
  lantern(p) {
    p.noise('#46464c', 0.1);
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      p.px(x, y, d < 3 ? '#fff0a8' : '#ffc434');
    }
    for (let i = 3; i < 13; i += 3) { p.px(i, 2, '#2e2e34'); p.px(i, 13, '#2e2e34'); }
  },
  iron_block: metalTile('#d8d8dc', '#f4f4f6', '#a8a8ae'),
  gold_block: metalTile('#f0c63c', '#ffeb96', '#c09418'),
  diamond_block: metalTile('#5fd8dc', '#b8f8f8', '#2ba4ac'),
};

// ------------------------------------------------------------ atlas
let _atlas = null;

export function buildAtlas() {
  if (_atlas) return _atlas;
  const names = Object.keys(TILE_PAINTERS);
  const cols = 8, rows = Math.ceil(names.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * TS; canvas.height = rows * TS;
  const ctx = canvas.getContext('2d');
  const index = {}, avg = {};
  names.forEach((name, i) => {
    const tx = i % cols, ty = (i / cols) | 0;
    const p = new Painter(ctx, tx * TS, ty * TS, hashStr(name));
    TILE_PAINTERS[name](p);
    index[name] = [tx, ty];
    avg[name] = p.avg();
  });
  _atlas = { canvas, cols, rows, index, avg, ts: TS };
  return _atlas;
}

// uv rect for a tile, inset a hair to stop atlas bleeding
export function tileUV(name) {
  const a = buildAtlas();
  const [tx, ty] = a.index[name] || [0, 0];
  const e = 0.02;
  return [(tx + e) / a.cols, 1 - (ty + 1 - e) / a.rows, (tx + 1 - e) / a.cols, 1 - (ty + e) / a.rows];
}

export function tilesFor(blockId) {
  const t = BLOCKS[blockId]?.tiles || {};
  const all = t.all || 'stone';
  return {
    top: t.top || all, bottom: t.bottom || all,
    side: t.side || all, front: t.front || t.side || all,
  };
}

export function avgColor(blockId) {
  const a = buildAtlas();
  return a.avg[tilesFor(blockId).side] || [0.5, 0.5, 0.5];
}

// ------------------------------------------------------------ crack decals
export function crackCanvases() {
  const out = [];
  for (let stage = 0; stage < 10; stage++) {
    const c = document.createElement('canvas');
    c.width = c.height = TS;
    const ctx = c.getContext('2d');
    const r = rng(977 + stage);
    ctx.fillStyle = 'rgba(20,16,12,0.85)';
    const cracks = 3 + stage;
    for (let i = 0; i < cracks; i++) {
      let x = 8, y = 8;
      const len = 3 + stage + ((r() * 4) | 0);
      let dx = r() < 0.5 ? 1 : -1, dy = r() < 0.5 ? 1 : -1;
      for (let s = 0; s < len; s++) {
        ctx.fillRect((x + 16) % 16, (y + 16) % 16, 1, 1);
        if (r() < 0.6) x += dx; else y += dy;
        if (r() < 0.18) dx = -dx;
        if (r() < 0.18) dy = -dy;
      }
    }
    out.push(c);
  }
  return out;
}

// ------------------------------------------------------------ item icons
// 16px pixel art per icon name; UI scales them up with pixelated rendering.
const TOOL_MATS = {
  wood: ['#a37b46', '#c79b5d'], stone: ['#8a8a8e', '#a8a8ac'],
  iron: ['#d8d8dc', '#f2f2f4'], diamond: ['#4fd0d4', '#a4f0f0'],
};
const HANDLE = ['#7a5a30', '#5e4424'];

function drawTool(ctx, kind, mat) {
  const [m0, m1] = TOOL_MATS[mat], [h0, h1] = HANDLE;
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
  // diagonal handle, head at upper-right
  for (let i = 0; i < 8; i++) { px(3 + i, 12 - i, h0); px(4 + i, 12 - i, h1); }
  if (kind === 'pick') {
    for (let i = 0; i < 7; i++) { px(5 + i, 2 + (i > 3 ? i - 3 : 0), m0); }
    px(5, 3, m0); px(4, 4, m0); px(3, 5, m1); px(12, 6, m0); px(13, 7, m1); px(11, 3, m1); px(6, 2, m1);
  } else if (kind === 'axe') {
    for (let y = 1; y < 6; y++) for (let x = 7; x < 12; x++) if (x + y < 15) px(x, y, (x + y) % 3 ? m0 : m1);
    px(7, 6, m0); px(8, 6, m1);
  } else if (kind === 'shovel') {
    for (let y = 1; y < 5; y++) for (let x = 9; x < 13; x++) px(x, y, (x + y) % 3 ? m0 : m1);
    px(10, 5, m0); px(11, 5, m0);
  } else { // sword: longer blade, small guard
    for (let i = 0; i < 9; i++) { px(5 + i, 11 - i, m0); px(6 + i, 11 - i, m1); }
    px(4, 10, h1); px(6, 12, h1); px(5, 13, h0); px(4, 12, h1); px(6, 10, h1);
  }
}

const ICON_PAINTERS = {
  stick(ctx) { for (let i = 0; i < 9; i++) { ctx.fillStyle = '#7a5a30'; ctx.fillRect(4 + i, 12 - i, 1, 1); ctx.fillStyle = '#5e4424'; ctx.fillRect(5 + i, 12 - i, 1, 1); } },
  coal(ctx) { blob(ctx, '#2c2c30', '#46464c'); },
  charcoal(ctx) { blob(ctx, '#332a22', '#54463a'); },
  iron_ingot(ctx) { ingot(ctx, '#d8d8dc', '#f4f4f6', '#a8a8ae'); },
  gold_ingot(ctx) { ingot(ctx, '#f0c63c', '#ffeb96', '#c09418'); },
  diamond(ctx) {
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    for (let y = 0; y < 5; y++) for (let x = -y; x <= y; x++) px(8 + x, 4 + y, y < 2 ? '#b8f8f8' : '#4fd0d4');
    for (let y = 0; y < 5; y++) for (let x = -(4 - y); x <= 4 - y; x++) px(8 + x, 9 + y, '#2ba4ac');
    px(7, 5, '#ffffff'); px(8, 6, '#ffffff');
  },
  porkchop(ctx) { chop(ctx, '#f0959e', '#f8c4c8', '#e87c88'); },
  porkchop_cooked(ctx) { chop(ctx, '#b8743c', '#d49a60', '#96582a'); },
  mutton(ctx) { chop(ctx, '#d4544a', '#ee8a80', '#aa3c34'); },
  mutton_cooked(ctx) { chop(ctx, '#a05a30', '#c08050', '#7e4422'); },
  apple(ctx) {
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    for (let y = 5; y < 13; y++) for (let x = 4; x < 12; x++) {
      const d = Math.hypot(x - 7.5, y - 8.5);
      if (d < 4) px(x, y, d < 2 ? '#e84a3c' : '#c83228');
    }
    px(8, 4, '#5e4424'); px(8, 3, '#5e4424'); px(9, 3, '#4d9430'); px(10, 3, '#4d9430');
    px(6, 6, '#ff9a8e'); px(5, 7, '#ff9a8e');
  },
  bedroll(ctx) {
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    for (let y = 8; y < 13; y++) for (let x = 2; x < 14; x++) px(x, y, y === 8 ? '#7da653' : '#5c8338');
    for (let y = 4; y < 9; y++) for (let x = 9; x < 14; x++) {
      const d = Math.hypot(x - 11, y - 6.5);
      if (d < 2.6) px(x, y, d < 1.2 ? '#e8e2d2' : '#7da653');
    }
    px(4, 10, '#48652c'); px(5, 10, '#48652c'); px(4, 11, '#48652c');
  },
};
function blob(ctx, c0, c1) {
  for (let y = 4; y < 13; y++) for (let x = 4; x < 13; x++) {
    if (Math.hypot(x - 8, y - 8.5) < 4.2) { ctx.fillStyle = (x * 7 + y * 3) % 5 ? c0 : c1; ctx.fillRect(x, y, 1, 1); }
  }
}
function ingot(ctx, c, hi, lo) {
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  for (let y = 0; y < 5; y++) for (let x = 3 - y / 2 | 0; x < 13 + y / 2; x++) px(x, 6 + y, y === 0 ? hi : y === 4 ? lo : c);
  px(4, 6, '#ffffff'); px(5, 6, '#ffffff');
}
function chop(ctx, c, hi, lo) {
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  for (let y = 3; y < 11; y++) for (let x = 6; x < 14; x++) {
    if (Math.hypot(x - 9.5, y - 6.5) < 4) px(x, y, Math.hypot(x - 10.5, y - 5.5) < 1.8 ? hi : c);
  }
  for (let i = 0; i < 4; i++) { px(6 - i, 10 + i, '#f2ead8'); px(5 - i, 11 + i, lo); }
}
for (const mat of ['wood', 'stone', 'iron', 'diamond']) {
  for (const kind of ['pick', 'axe', 'shovel', 'sword']) {
    ICON_PAINTERS[`${kind}_${mat}`] = (ctx) => drawTool(ctx, kind, mat);
  }
}

const _icons = new Map();
export function itemIconCanvas(iconName) {
  if (_icons.has(iconName)) return _icons.get(iconName);
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  const ctx = c.getContext('2d');
  ICON_PAINTERS[iconName]?.(ctx);
  _icons.set(iconName, c);
  return c;
}

// isometric mini-cube icon for a block, drawn from its atlas tiles
export function blockIconCanvas(blockId) {
  const key = `b${blockId}`;
  if (_icons.has(key)) return _icons.get(key);
  const a = buildAtlas();
  const t = tilesFor(blockId);
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const src = (name) => {
    const [tx, ty] = a.index[name] || [0, 0];
    return [tx * TS, ty * TS];
  };
  const def = BLOCKS[blockId];
  if (def?.cross) { // plants/torch: just the flat tile, bigger
    const [sx, sy] = src(t.side);
    ctx.drawImage(a.canvas, sx, sy, TS, TS, 2, 2, 28, 28);
  } else {
    const w = 14, h = 16;
    let [sx, sy] = src(t.top); // top rhombus
    ctx.setTransform(1, 0.5, -1, 0.5, 16, 1);
    ctx.drawImage(a.canvas, sx, sy, TS, TS, 0, 0, w, w);
    [sx, sy] = src(t.side); // left face, darkened
    ctx.setTransform(1, 0.5, 0, 1.1, 2, 8);
    ctx.drawImage(a.canvas, sx, sy, TS, TS, 0, 0, w, h - 3);
    ctx.fillStyle = 'rgba(8,8,16,0.28)';
    ctx.fillRect(0, 0, w, h);
    [sx, sy] = src(t.front); // right face, darker
    ctx.setTransform(1, -0.5, 0, 1.1, 16, 15);
    ctx.drawImage(a.canvas, sx, sy, TS, TS, 0, 0, w, h - 3);
    ctx.fillStyle = 'rgba(8,8,16,0.42)';
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  _icons.set(key, c);
  return c;
}

// ------------------------------------------------------------ logo
// LOAM in chunky block letters: grass-capped dirt, like the world itself.
const GLYPHS = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
};

export function logoCanvas(word = 'LOAM', cell = 12) {
  const letters = word.split('');
  const W = letters.length * 6 * cell + cell, H = 8 * cell;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const seed = hashStr('logo' + word);
  let ox = cell / 2;
  for (const ch of letters) {
    const g = GLYPHS[ch] || GLYPHS.O;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] !== '1') continue;
        const x = ox + col * cell, y = cell / 2 + r * cell;
        const topExposed = r === 0 || g[r - 1][col] !== '1';
        const h = hash3(seed, ox + col, r, 0);
        ctx.fillStyle = 'rgba(12,10,8,0.55)'; // drop shadow
        ctx.fillRect(x + cell * 0.22, y + cell * 0.22, cell, cell);
        ctx.fillStyle = topExposed ? shade('#71b03f', 0.86 + h * 0.34) : shade('#79553a', 0.8 + h * 0.36);
        ctx.fillRect(x, y, cell, cell);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x, y, cell, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, y + cell - 2, cell, 2);
        if (topExposed) { ctx.fillStyle = shade('#8fcf5a', 1); ctx.fillRect(x + cell * 0.2, y + 1, cell * 0.25, 2); }
      }
    }
    ox += 6 * cell;
  }
  return c;
}
