// Shop facades set into the station wall. Each shop has a static back
// (interior, frame, sign board — baked into the wall tiles), a front sprite
// (the counter), a neon or painted sign, and a shopkeeper drawn live between.
import {
  INK, shape, rect, rrect, ellipse, blob, stroke, tube, dot, text, drips, FONTS,
  mulberry32, shade, tint, mix, rgba, pathPts, measure,
} from '../ink.js';
import { drawProduct } from './products.js';
import { productsByShop } from '../data/catalog.js';
import { tag } from './station.js';

export const SF = { SIGN_Y: 122, SIGN_H: 44, TOP: 172, COUNTER: 372, BOTTOM: 420, KEEPER_Y: 396 };

const STYLE = {
  threads: { wall: '#5a2a5e', glow: '#ff7ac0', counter: '#ff4f9a', sign: 'neon', neon: '#ff5fb0' },
  topshelf: { wall: '#1f2c66', glow: '#ffe08a', counter: '#2a2238', sign: 'gold' },
  sole: { wall: '#1a5050', glow: '#9affe8', counter: '#ff8a3d', sign: 'board', board: '#ff8a3d' },
  cans: { wall: '#2c2a36', glow: '#c8ff9a', counter: '#3a3a46', sign: 'spray' },
  tracks: { wall: '#2e1a52', glow: '#7affea', counter: '#1d1830', sign: 'neon', neon: '#3ef0d8' },
  bodega: { wall: '#6a4a2a', glow: '#fff0b0', counter: '#e8456b', sign: 'bodega' },
};

export function shopStyle(id) { return STYLE[id] || STYLE.threads; }

// ---------------------------------------------------------------- back

export function storefrontBack(g, shop, x, w, name, seed = 1) {
  const st = shopStyle(shop);
  const top = SF.TOP, bot = SF.BOTTOM;
  const ix = x + 10, iw = w - 20;
  // recess shadow
  g.fillStyle = rgba('#05030c', 0.5);
  g.fillRect(x - 8, top - 8, w + 16, bot - top + 8);
  // interior wall with lamp falloff
  const ig = g.createRadialGradient(x + w / 2, top + 10, 20, x + w / 2, top + 80, w * 0.75);
  ig.addColorStop(0, tint(st.wall, 0.28));
  ig.addColorStop(1, shade(st.wall, 0.35));
  g.fillStyle = ig;
  g.fillRect(ix, top, iw, bot - top);
  g.save();
  g.beginPath();
  g.rect(ix, top, iw, bot - top);
  g.clip();
  INTERIOR[shop]?.(g, ix, top, iw, bot - top, seed, st);
  // ceiling lamp inside
  rrect(g, x + w / 2 - 40, top + 14, 80, 6, 3, { fill: '#fffaf0', lw: 2, seed: seed + 3 });
  g.restore();
  // frame
  const fc = '#2a2840';
  rect(g, x - 4, top - 10, w + 8, 14, { fill: fc, lw: 3, amp: 0.4, seed: seed + 4 });
  rect(g, x - 4, top - 10, 14, bot - top + 10, { fill: fc, lw: 3, amp: 0.4, seed: seed + 5 });
  rect(g, x + w - 10, top - 10, 14, bot - top + 10, { fill: fc, lw: 3, amp: 0.4, seed: seed + 6 });
  for (let yy = top + 10; yy < bot - 6; yy += 26) {
    dot(g, x + 3, yy, 1.5, rgba('#ffffff', 0.2));
    dot(g, x + w - 3, yy, 1.5, rgba('#ffffff', 0.2));
  }
  // rolled-up security gate
  rrect(g, x + 8, top + 2, w - 16, 18, 8, { fill: '#5a5872', shade: '#3e3c56', sdx: 0, sdy: 4, lw: 3, seed: seed + 7 });
  g.strokeStyle = rgba('#140f26', 0.45);
  g.lineWidth = 1.2;
  g.beginPath();
  for (let xx = x + 16; xx < x + w - 12; xx += 8) { g.moveTo(xx, top + 4); g.lineTo(xx, top + 18); }
  g.stroke();
  tag(g, x + w * 0.3, top + 16, { size: 13, seed: seed + 8, alpha: 0.85 });
  // sign board
  signBoard(g, shop, x, w, name, seed + 9, st);
}

function signBoard(g, shop, x, w, name, seed, st) {
  const y = SF.SIGN_Y, h = SF.SIGN_H;
  if (st.sign === 'neon') {
    // dark backing panel; the tubes are drawn live (they flicker)
    rrect(g, x + 14, y, w - 28, h, 6, { fill: '#17122a', lw: 3, seed });
    for (const sx of [x + 22, x + w - 22]) for (const sy of [y + 7, y + h - 7]) dot(g, sx, sy, 2, '#5a5476');
  } else if (st.sign === 'gold') {
    rrect(g, x + 10, y - 2, w - 20, h + 4, 4, { fill: '#2a2238', lw: 3, seed });
    rrect(g, x + 16, y + 4, w - 32, h - 8, 3, { fill: 'none', lw: 2, line: '#d4a83a', seed: seed + 1 });
    text(g, name, x + w / 2 + 14, y + h / 2 + 11, { size: 28, font: FONTS.sign, fill: '#ffd23f', lw: 4, extrude: [2, 3, 3, '#8a6a1a'] });
    // crown
    shape(g, [[x + w / 2 - 102, y + 32], [x + w / 2 - 102, y + 14], [x + w / 2 - 94, y + 22], [x + w / 2 - 87, y + 10], [x + w / 2 - 80, y + 22], [x + w / 2 - 72, y + 14], [x + w / 2 - 72, y + 32]], { fill: '#ffd23f', lw: 2.6, smooth: false, seed: seed + 2 });
  } else if (st.sign === 'board') {
    rrect(g, x + 10, y - 2, w - 20, h + 4, 5, { fill: st.board, shade: shade(st.board, 0.25), sdx: 0, sdy: 4, lw: 3, seed });
    text(g, name, x + w / 2 + 16, y + h / 2 + 10, { size: 26, font: FONTS.sign, fill: '#fffaf0', lw: 4 });
    ellipse(g, x + w / 2 - 104, y + h / 2, 15, 15, { fill: '#d4473f', lw: 2.6, seed: seed + 1 });
    text(g, '6', x + w / 2 - 104, y + h / 2 + 7, { size: 18, font: FONTS.sign, fill: '#fff', lw: 0 });
  } else if (st.sign === 'spray') {
    rect(g, x + 8, y - 4, w - 16, h + 8, { fill: '#c8b48a', lw: 3, seed, amp: 0.8 });
    g.strokeStyle = rgba('#140f26', 0.25);
    g.lineWidth = 1;
    g.beginPath();
    for (let yy = y + 6; yy < y + h; yy += 9) { g.moveTo(x + 10, yy); g.lineTo(x + w - 10, yy); }
    g.stroke();
    text(g, name, x + w / 2, y + h / 2 + 12, { size: 34, font: FONTS.tag, fill: '#7ed957', lw: 3, rot: -0.04, shadow: [3, 3, '#ff4f9a'] });
    drips(g, x + 40, y + h - 6, w - 80, '#7ed957', seed + 3, { count: 6, maxLen: 18, thick: 3 });
  } else if (st.sign === 'bodega') {
    // classic awning + lightbox
    rrect(g, x + 4, y - 6, w - 8, 32, 3, { fill: '#ffd23f', lw: 3, seed });
    text(g, 'DELI · GROCERY · 24/7', x + w / 2, y + 17, { size: 17, font: FONTS.sign, fill: '#d4473f', lw: 0 });
    // awning stripes
    const ay = y + 26, ah = 34;
    g.save();
    g.beginPath();
    g.moveTo(x - 6, ay); g.lineTo(x + w + 6, ay); g.lineTo(x + w + 16, ay + ah); g.lineTo(x - 16, ay + ah); g.closePath();
    g.clip();
    for (let i = 0; i < 20; i++) {
      g.fillStyle = i % 2 ? '#f4efe6' : '#2a8a4a';
      g.fillRect(x - 20 + i * 24, ay, 24, ah);
    }
    g.restore();
    shape(g, [[x - 6, ay], [x + w + 6, ay], [x + w + 16, ay + ah], [x - 16, ay + ah]], { fill: null, lw: 3, smooth: false, seed: seed + 1 });
    // scalloped edge
    for (let xx = x - 16; xx < x + w + 16; xx += 24) {
      blob(g, [['M', xx, ay + ah], ['Q', xx + 12, ay + ah + 12, xx + 24, ay + ah], ['Z']], { fill: ((xx - x + 16) / 24) % 2 ? '#2a8a4a' : '#f4efe6', lw: 2.4, seed: seed + xx });
    }
  }
}

// ---------------------------------------------------------------- interiors

function shelf(g, x, y, w, seed) {
  rrect(g, x, y, w, 7, 2, { fill: '#8a6a4a', shade: '#5a4430', sdx: 0, sdy: 2, lw: 2.6, seed });
  stroke(g, [[x + 10, y + 7], [x + 14, y + 16]], { lw: 2.2, color: '#3a3050' });
  stroke(g, [[x + w - 10, y + 7], [x + w - 14, y + 16]], { lw: 2.2, color: '#3a3050' });
}

const INTERIOR = {
  threads(g, x, y, w, h, seed, st) {
    const items = productsByShop('threads').filter((p) => ['hoodie', 'tee', 'jacket', 'windbreaker'].includes(p.art.type));
    // mirror
    rrect(g, x + w - 70, y + 40, 50, 150, 22, { fill: '#ff4f9a', lw: 3, seed });
    rrect(g, x + w - 64, y + 46, 38, 138, 17, { fill: '#c8d8ff', lw: 2, seed: seed + 1 });
    stroke(g, [[x + w - 56, y + 60], [x + w - 40, y + 90]], { lw: 3, color: rgba('#ffffff', 0.7) });
    // rail
    stroke(g, [[x + 16, y + 52], [x + w - 86, y + 52]], { lw: 4, color: '#c8c8e0' });
    stroke(g, [[x + 22, y + 52], [x + 22, y + 24]], { lw: 3, color: '#c8c8e0' });
    stroke(g, [[x + w - 92, y + 52], [x + w - 92, y + 24]], { lw: 3, color: '#c8c8e0' });
    const n = Math.min(5, items.length);
    const span = w - 130;
    for (let i = 0; i < n; i++) {
      const cx = x + 44 + (span / (n - 1)) * i;
      stroke(g, pathPts([['M', cx, y + 64], ['Q', cx, y + 48, cx + 4, y + 50]]), { lw: 2, color: '#c8c8e0' });
      drawProduct(g, items[i].art, cx, y + 100, 0.68, items[i].seed);
    }
    // folded tees stack
    for (let i = 0; i < 3; i++) rrect(g, x + 30, y + 160 - i * 9, 54, 10, 3, { fill: ['#ffc93d', '#f4efe6', '#7ed957'][i], lw: 2.2, seed: seed + 10 + i });
    tagSticker(g, x + 100, y + 160, 'NEW IN', '#ffd23f', seed + 20);
  },
  topshelf(g, x, y, w, h, seed) {
    const items = productsByShop('topshelf');
    const rows = [y + 74, y + 134];
    rows.forEach((ry, r) => {
      shelf(g, x + 14, ry, w - 28, seed + r);
      const row = items.slice(r * 4, r * 4 + 4);
      row.forEach((p, i) => drawProduct(g, p.art, x + 54 + i * ((w - 90) / 3), ry - 22, 0.46, p.seed));
    });
    // spotlights
    for (let i = 0; i < 4; i++) {
      const lx = x + 50 + i * ((w - 90) / 3);
      const lg = g.createLinearGradient(0, y + 20, 0, y + 74);
      lg.addColorStop(0, rgba('#ffe08a', 0.3));
      lg.addColorStop(1, rgba('#ffe08a', 0));
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(lx - 6, y + 22); g.lineTo(lx + 6, y + 22); g.lineTo(lx + 28, y + 74); g.lineTo(lx - 28, y + 74); g.fill();
    }
  },
  sole(g, x, y, w, h, seed) {
    const shoes = productsByShop('sole').filter((p) => ['low', 'high'].includes(p.art.type));
    const all = [...shoes, ...shoes, ...shoes];
    for (let r = 0; r < 3; r++) {
      const ry = y + 70 + r * 52;
      shelf(g, x + 14, ry, w - 28, seed + r);
      for (let i = 0; i < 4; i++) {
        const p = all[(r * 4 + i + r) % all.length];
        drawProduct(g, p.art, x + 54 + i * ((w - 92) / 3), ry - 13, 0.4, p.seed + r);
      }
    }
  },
  cans(g, x, y, w, h, seed) {
    const r = mulberry32(seed);
    // splatter
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rgba(['#ff4f9a', '#ffd23f', '#3ec7b0', '#7ed957', '#7b5cff'][i % 5], 0.35);
      g.beginPath();
      g.arc(x + r() * w, y + r() * h, 2 + r() * 6, 0, Math.PI * 2);
      g.fill();
    }
    const cols = ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7ed957', '#7b5cff', '#ff8a3d', '#5aa0ff', '#f4efe6'];
    for (let row = 0; row < 3; row++) {
      const ry = y + 76 + row * 50;
      shelf(g, x + 14, ry, w - 28, seed + row);
      for (let i = 0; i < 11; i++) {
        const cx = x + 32 + i * ((w - 64) / 10);
        const c = cols[(i + row * 3) % cols.length];
        rrect(g, cx - 7, ry - 30, 14, 30, 4, { fill: c, shade: shade(c, 0.3), sdx: 1.5, sdy: 0, lw: 2.2, seed: seed + row * 20 + i });
        rrect(g, cx - 3, ry - 36, 6, 6, 1.5, { fill: '#c8c8e0', lw: 1.6, seed: seed + row * 40 + i });
      }
    }
  },
  tracks(g, x, y, w, h, seed) {
    // album covers on the wall
    const covers = ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7b5cff', '#ff8a3d'];
    covers.forEach((c, i) => {
      const cx = x + 26 + i * 54;
      rect(g, cx, y + 36, 44, 44, { fill: c, lw: 2.6, seed: seed + i, amp: 0.4 });
      ellipse(g, cx + 22, y + 58, 12, 12, { fill: '#140f26', lw: 1.6, seed: seed + 10 + i });
      dot(g, cx + 22, y + 58, 3, c);
    });
    // speaker stack
    for (let i = 0; i < 2; i++) {
      rrect(g, x + w - 76, y + 92 + i * 64, 60, 62, 4, { fill: '#1d1830', lw: 3, seed: seed + 20 + i });
      ellipse(g, x + w - 46, y + 124 + i * 64, 20, 20, { fill: '#2e2a48', lw: 2.4, seed: seed + 30 + i });
      ellipse(g, x + w - 46, y + 124 + i * 64, 8, 8, { fill: '#5a5276', lw: 2, seed: seed + 40 + i });
    }
    // record crates
    for (let i = 0; i < 2; i++) {
      rrect(g, x + 18 + i * 70, y + 150, 62, 44, 3, { fill: '#a0623a', lw: 3, seed: seed + 50 + i });
      for (let k = 0; k < 6; k++) rect(g, x + 22 + i * 70 + k * 9, y + 132 + (k % 2) * 3, 8, 22, { fill: covers[(k + i) % 5], lw: 1.6, amp: 0.2, seed: seed + 60 + k + i * 6 });
    }
  },
  bodega(g, x, y, w, h, seed) {
    const r = mulberry32(seed);
    // fridge
    rrect(g, x + w - 96, y + 30, 82, 180, 4, { fill: '#d8e8f0', lw: 3, seed });
    rrect(g, x + w - 90, y + 36, 70, 168, 3, { fill: '#bfefff', lw: 2, seed: seed + 1 });
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 4; i++) {
        const c = ['#3ec7b0', '#ff4f9a', '#ffd23f', '#7ed957'][(i + row) % 4];
        rrect(g, x + w - 86 + i * 16, y + 44 + row * 40, 12, 28, 3, { fill: c, lw: 1.8, seed: seed + row * 10 + i });
      }
      stroke(g, [[x + w - 90, y + 74 + row * 40], [x + w - 20, y + 74 + row * 40]], { lw: 2, color: '#8ab0c0' });
    }
    // snack shelves
    for (let row = 0; row < 3; row++) {
      const ry = y + 66 + row * 50;
      shelf(g, x + 12, ry, w - 124, seed + 30 + row);
      for (let i = 0; i < 7; i++) {
        const cx = x + 26 + i * ((w - 150) / 6);
        const kind = (i + row) % 3;
        const c = ['#ff8a3d', '#ffd23f', '#e8456b', '#5aa0ff', '#7ed957'][(i * 3 + row) % 5];
        if (kind === 0) rrect(g, cx - 9, ry - 30, 18, 30, 3, { fill: c, lw: 2, seed: seed + 50 + row * 10 + i });
        else if (kind === 1) rrect(g, cx - 8, ry - 22, 16, 22, 2, { fill: c, lw: 2, seed: seed + 50 + row * 10 + i });
        else rrect(g, cx - 6, ry - 26, 12, 26, 5, { fill: c, lw: 2, seed: seed + 50 + row * 10 + i });
      }
    }
    // lottery sign + clock
    rrect(g, x + 24, y + 20, 90, 26, 3, { fill: '#e8456b', lw: 2.4, seed: seed + 90 });
    text(g, 'NO CREDIT', x + 69, y + 38, { size: 11, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
    void r;
  },
};

function tagSticker(g, x, y, label, color, seed) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.12);
  rrect(g, -30, -12, 60, 24, 5, { fill: color, lw: 2.6, seed });
  text(g, label, 0, 6, { size: 12, font: FONTS.sign, fill: INK, lw: 0 });
  g.restore();
}

// ---------------------------------------------------------------- front (counter)

export function counterBounds(x, w) { return [x - 10, SF.COUNTER - 40, w + 20, SF.BOTTOM - SF.COUNTER + 46]; }

export function storefrontFront(g, shop, x, w, seed = 1) {
  const st = shopStyle(shop);
  const cx = x + 16, cw = w - 32, cy = SF.COUNTER;
  // counter body
  rect(g, cx, cy + 8, cw, SF.BOTTOM - cy - 6, { fill: st.counter, shade: shade(st.counter, 0.3), sdx: 0, sdy: 6, lw: 3, amp: 0.5, seed });
  // stripes / details
  if (shop === 'threads') {
    for (let i = 0; i < 3; i++) stroke(g, [[cx + 4, cy + 22 + i * 8], [cx + cw - 4, cy + 22 + i * 8]], { lw: 2.6, color: i === 1 ? '#ffd23f' : '#fffaf0', seed: seed + i });
  } else if (shop === 'topshelf') {
    // glass display case
    rect(g, cx + 10, cy + 14, cw - 20, 26, { fill: rgba('#bfe9ff', 0.25), lw: 2.4, seed: seed + 1 });
    for (let i = 0; i < 5; i++) {
      const px = cx + 34 + i * ((cw - 68) / 4);
      stroke(g, pathPts([['M', px - 10, cy + 20], ['Q', px, cy + 36, px + 10, cy + 20]]), { lw: 2.4, color: '#ffd23f', seed: seed + 10 + i });
    }
  } else if (shop === 'sole') {
    text(g, 'FRESH KICKS DAILY', x + w / 2, cy + 34, { size: 13, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
  } else if (shop === 'cans') {
    for (let i = 0; i < 5; i++) dot(g, cx + 20 + i * (cw / 5), cy + 28, 4 + (i % 2) * 2, ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7b5cff', '#7ed957'][i]);
    tag(g, x + w * 0.62, cy + 36, { size: 16, seed: seed + 5, word: 'RASCAL', color: '#ffd23f' });
  } else if (shop === 'tracks') {
    // turntables on the counter
    for (const tx of [x + w * 0.3, x + w * 0.7]) {
      rrect(g, tx - 34, cy - 6, 68, 16, 3, { fill: '#2e2a48', lw: 2.6, seed: seed + tx });
      ellipse(g, tx - 4, cy - 2, 24, 5, { fill: '#140f26', lw: 2, seed: seed + tx + 1 });
    }
    rrect(g, x + w / 2 - 16, cy - 4, 32, 12, 2, { fill: '#5a5276', lw: 2.2, seed: seed + 9 });
  } else if (shop === 'bodega') {
    text(g, 'WE GOT IT', x + w / 2, cy + 34, { size: 14, font: FONTS.sign, fill: '#ffd23f', lw: 0 });
    // register
    rrect(g, x + w - 110, cy - 22, 44, 26, 3, { fill: '#c8c8e0', lw: 2.6, seed: seed + 3 });
    rrect(g, x + w - 104, cy - 34, 30, 12, 2, { fill: '#2a2238', lw: 2.2, seed: seed + 4 });
    text(g, '$', x + w - 89, cy - 24, { size: 10, font: FONTS.sign, fill: '#7ed957', lw: 0 });
  }
  // counter top slab
  rrect(g, cx - 8, cy, cw + 16, 12, 3, { fill: tint(st.counter, 0.2), shade: shade(st.counter, 0.2), sdx: 0, sdy: 3, lw: 3, seed: seed + 20 });
}

// ---------------------------------------------------------------- neon

export function neonText(g, str, x, y, size, color, on = 1) {
  g.save();
  g.font = `${size}px ${FONTS.sign}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  if (on > 0) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 3; i >= 1; i--) {
      g.strokeStyle = rgba(color, 0.12 * on);
      g.lineWidth = size * 0.18 * i * 1.6;
      g.strokeText(str, x, y);
    }
    g.globalCompositeOperation = 'source-over';
  }
  g.strokeStyle = on > 0 ? tint(color, 0.35) : shade(color, 0.55);
  g.lineWidth = size * 0.11;
  g.strokeText(str, x, y);
  if (on > 0) {
    g.strokeStyle = rgba('#ffffff', 0.85 * on);
    g.lineWidth = size * 0.035;
    g.strokeText(str, x, y);
  }
  g.restore();
}
