// Character emblems: chunky canvas icons for the select grid, the HUD panels,
// and the stock counters. Drawn in code with hard edges and no gradients so they
// sit next to the low-res 3D without looking out of place.
import { mkCanvas, shade } from './paint.js';

/** One glyph per fighter — a silhouette you can read at 40px. */
const GLYPHS = {
  blitz(ctx, s, c) {                       // falcon head: beak + swept crest
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.moveTo(s * 0.28, s * 0.72); ctx.lineTo(s * 0.34, s * 0.3); ctx.lineTo(s * 0.6, s * 0.24);
    ctx.lineTo(s * 0.72, s * 0.44); ctx.lineTo(s * 0.6, s * 0.74);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.trim;
    ctx.beginPath();
    ctx.moveTo(s * 0.68, s * 0.44); ctx.lineTo(s * 0.92, s * 0.54); ctx.lineTo(s * 0.66, s * 0.6);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.36, s * 0.28); ctx.lineTo(s * 0.16, s * 0.14); ctx.lineTo(s * 0.44, s * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#11131a';
    ctx.fillRect(s * 0.5, s * 0.38, s * 0.09, s * 0.09);
  },
  tusk(ctx, s, c) {                        // boar: snout + tusks
    ctx.fillStyle = c.main;
    ctx.fillRect(s * 0.26, s * 0.3, s * 0.48, s * 0.42);
    ctx.fillStyle = c.skin;
    ctx.fillRect(s * 0.38, s * 0.5, s * 0.24, s * 0.2);
    ctx.fillStyle = '#f4f2e8';
    ctx.beginPath(); ctx.moveTo(s * 0.34, s * 0.7); ctx.lineTo(s * 0.28, s * 0.5); ctx.lineTo(s * 0.4, s * 0.62); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.66, s * 0.7); ctx.lineTo(s * 0.72, s * 0.5); ctx.lineTo(s * 0.6, s * 0.62); ctx.fill();
    ctx.fillStyle = '#11131a';
    ctx.fillRect(s * 0.34, s * 0.4, s * 0.08, s * 0.07);
    ctx.fillRect(s * 0.58, s * 0.4, s * 0.08, s * 0.07);
  },
  chip(ctx, s, c) {                        // chipmunk: round ears + acorn
    ctx.fillStyle = c.main;
    ctx.beginPath(); ctx.arc(s * 0.46, s * 0.5, s * 0.22, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.3, s * 0.28, s * 0.09, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.62, s * 0.28, s * 0.09, 0, 6.3); ctx.fill();
    ctx.fillStyle = c.skin;
    ctx.beginPath(); ctx.arc(s * 0.46, s * 0.58, s * 0.1, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#8a5a28';
    ctx.beginPath(); ctx.arc(s * 0.76, s * 0.66, s * 0.12, 0, 6.3); ctx.fill();
    ctx.fillRect(s * 0.7, s * 0.5, s * 0.12, s * 0.08);
    ctx.fillStyle = '#11131a';
    ctx.fillRect(s * 0.38, s * 0.44, s * 0.07, s * 0.07);
    ctx.fillRect(s * 0.52, s * 0.44, s * 0.07, s * 0.07);
  },
  volt(ctx, s, c) {                        // robot: boxy head + antenna + visor
    ctx.fillStyle = c.main;
    ctx.fillRect(s * 0.28, s * 0.32, s * 0.44, s * 0.4);
    ctx.fillStyle = c.glow || c.trim;
    ctx.fillRect(s * 0.33, s * 0.42, s * 0.34, s * 0.11);
    ctx.fillStyle = '#4a4f5a';
    ctx.fillRect(s * 0.48, s * 0.14, s * 0.04, s * 0.18);
    ctx.fillStyle = c.trim;
    ctx.beginPath(); ctx.arc(s * 0.5, s * 0.14, s * 0.06, 0, 6.3); ctx.fill();
    ctx.fillStyle = shade(c.main, -40);
    ctx.fillRect(s * 0.33, s * 0.6, s * 0.34, s * 0.06);
  },
  crunch(ctx, s, c) {                      // dino: snout + teeth + crest
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.moveTo(s * 0.22, s * 0.66); ctx.lineTo(s * 0.32, s * 0.3); ctx.lineTo(s * 0.62, s * 0.32);
    ctx.lineTo(s * 0.84, s * 0.52); ctx.lineTo(s * 0.62, s * 0.72);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.trim;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * (0.3 + i * 0.1), s * 0.3); ctx.lineTo(s * (0.34 + i * 0.1), s * 0.16); ctx.lineTo(s * (0.4 + i * 0.1), s * 0.3);
      ctx.fill();
    }
    ctx.fillStyle = '#f4f2e8';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(s * (0.6 + i * 0.06), s * 0.6); ctx.lineTo(s * (0.63 + i * 0.06), s * 0.72); ctx.lineTo(s * (0.66 + i * 0.06), s * 0.6);
      ctx.fill();
    }
    ctx.fillStyle = c.eye || '#e8433f';
    ctx.fillRect(s * 0.5, s * 0.4, s * 0.08, s * 0.08);
  },
  ribbit(ctx, s, c) {                       // frog: wide head + stalk eyes + band
    ctx.fillStyle = c.main;
    ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.58, s * 0.28, s * 0.2, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#f4f2e8';
    ctx.beginPath(); ctx.arc(s * 0.36, s * 0.34, s * 0.1, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.64, s * 0.34, s * 0.1, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#11131a';
    ctx.fillRect(s * 0.33, s * 0.31, s * 0.07, s * 0.07);
    ctx.fillRect(s * 0.61, s * 0.31, s * 0.07, s * 0.07);
    ctx.fillStyle = c.trim;
    ctx.fillRect(s * 0.2, s * 0.44, s * 0.6, s * 0.08);
    ctx.fillStyle = shade(c.main, -50);
    ctx.fillRect(s * 0.38, s * 0.66, s * 0.24, s * 0.04);
  },
  plancha(ctx, s, c) {                      // luchador mask
    ctx.fillStyle = c.main;
    ctx.beginPath(); ctx.arc(s * 0.5, s * 0.5, s * 0.26, 0, 6.3); ctx.fill();
    ctx.fillStyle = c.trim;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.24); ctx.lineTo(s * 0.62, s * 0.5); ctx.lineTo(s * 0.5, s * 0.76); ctx.lineTo(s * 0.38, s * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#11131a';
    ctx.beginPath(); ctx.ellipse(s * 0.41, s * 0.46, s * 0.05, s * 0.04, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.59, s * 0.46, s * 0.05, s * 0.04, 0, 0, 6.3); ctx.fill();
    ctx.fillRect(s * 0.42, s * 0.62, s * 0.16, s * 0.04);
  },
  zorb(ctx, s, c) {                         // blob alien with stalk eyes
    ctx.fillStyle = c.main;
    ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.6, s * 0.26, s * 0.22, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = shade(c.main, 26);
    ctx.beginPath(); ctx.ellipse(s * 0.5, s * 0.54, s * 0.16, s * 0.1, 0, 0, 6.3); ctx.fill();
    ctx.strokeStyle = c.main;
    ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.44); ctx.lineTo(s * 0.34, s * 0.26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.6, s * 0.44); ctx.lineTo(s * 0.66, s * 0.26); ctx.stroke();
    ctx.fillStyle = '#f4f2e8';
    ctx.beginPath(); ctx.arc(s * 0.34, s * 0.23, s * 0.07, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.66, s * 0.23, s * 0.07, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#11131a';
    ctx.fillRect(s * 0.32, s * 0.21, s * 0.05, s * 0.05);
    ctx.fillRect(s * 0.64, s * 0.21, s * 0.05, s * 0.05);
  },
  clank(ctx, s, c) {                        // knight helm
    ctx.fillStyle = c.metal || c.main;
    ctx.fillRect(s * 0.3, s * 0.28, s * 0.4, s * 0.46);
    ctx.fillStyle = shade(c.metal || c.main, -50);
    ctx.fillRect(s * 0.34, s * 0.44, s * 0.32, s * 0.08);
    ctx.fillStyle = c.trim;
    ctx.fillRect(s * 0.46, s * 0.12, s * 0.08, s * 0.18);
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.12); ctx.lineTo(s * 0.74, s * 0.06); ctx.lineTo(s * 0.54, s * 0.24);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(c.metal || c.main, 30);
    ctx.fillRect(s * 0.3, s * 0.62, s * 0.4, s * 0.05);
  },
  spirit(ctx, s, c) {                       // megaphone + pom-pom
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.moveTo(s * 0.28, s * 0.4); ctx.lineTo(s * 0.56, s * 0.26); ctx.lineTo(s * 0.56, s * 0.7); ctx.lineTo(s * 0.28, s * 0.56);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.trim;
    ctx.fillRect(s * 0.18, s * 0.42, s * 0.12, s * 0.12);
    ctx.fillStyle = c.main;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.28;
      ctx.beginPath();
      ctx.arc(s * 0.74 + Math.cos(a) * s * 0.08, s * 0.5 + Math.sin(a) * s * 0.08, s * 0.07, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = c.trim;
    ctx.beginPath(); ctx.arc(s * 0.74, s * 0.5, s * 0.08, 0, 6.3); ctx.fill();
  },
  coach(ctx, s, c) {                        // cap + whistle
    ctx.fillStyle = c.main;
    ctx.beginPath(); ctx.arc(s * 0.5, s * 0.46, s * 0.2, Math.PI, 0); ctx.fill();
    ctx.fillRect(s * 0.3, s * 0.46, s * 0.4, s * 0.06);
    ctx.fillStyle = c.trim;
    ctx.fillRect(s * 0.28, s * 0.52, s * 0.5, s * 0.06);
    ctx.fillStyle = '#d8d8d0';
    ctx.fillRect(s * 0.56, s * 0.64, s * 0.16, s * 0.1);
    ctx.fillRect(s * 0.68, s * 0.66, s * 0.08, s * 0.05);
    ctx.strokeStyle = c.trim;
    ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.moveTo(s * 0.56, s * 0.64); ctx.lineTo(s * 0.34, s * 0.72); ctx.stroke();
  },
  pixel(ctx, s, c) {                        // a glitched sprite grid
    const cells = [
      '..XX..', '.XXXX.', 'X.XX.X', 'XXXXXX', '.X..X.', 'X....X',
    ];
    const px = s * 0.11;
    for (let r = 0; r < cells.length; r++) {
      for (let col = 0; col < 6; col++) {
        if (cells[r][col] !== 'X') continue;
        ctx.fillStyle = (r + col) % 5 === 0 ? c.trim : c.main;
        ctx.fillRect(s * 0.22 + col * px, s * 0.2 + r * px, px * 0.94, px * 0.94);
      }
    }
    ctx.fillStyle = c.trim;
    ctx.fillRect(s * 0.14, s * 0.44, s * 0.1, px * 0.9);
    ctx.fillRect(s * 0.8, s * 0.56, s * 0.08, px * 0.9);
  },
};

function backdrop(ctx, s, c) {
  ctx.fillStyle = shade(c.main, -62);
  ctx.fillRect(0, 0, s, s);
  // diagonal trim band
  ctx.save();
  ctx.translate(s * 0.5, s * 0.5);
  ctx.rotate(-0.5);
  ctx.fillStyle = shade(c.main, -34);
  ctx.fillRect(-s, -s * 0.22, s * 2, s * 0.44);
  ctx.fillStyle = shade(c.trim, -46);
  ctx.fillRect(-s, s * 0.22, s * 2, s * 0.08);
  ctx.restore();
  // corner ticks, arcade-cabinet style
  ctx.fillStyle = shade(c.trim, 0);
  for (const [x, y] of [[0, 0], [s - 6, 0], [0, s - 6], [s - 6, s - 6]]) ctx.fillRect(x, y, 6, 6);
}

/** The square emblem used on select cells and HUD panels. */
export function emblemCanvas(def, size = 96) {
  const cv = mkCanvas(size, size);
  const ctx = cv.getContext('2d');
  const c = def.colors || {};
  backdrop(ctx, size, c);
  (GLYPHS[def.id] || GLYPHS.blitz)(ctx, size, c);
  return cv;
}

/** A wider card for the character-select detail pane. */
export function nameplateCanvas(def, w = 320, h = 96) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  const c = def.colors || {};
  ctx.fillStyle = shade(c.main, -58);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = shade(c.main, -30);
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.fillStyle = c.trim;
  ctx.fillRect(0, h * 0.52, w, 4);
  ctx.font = `700 ${Math.round(h * 0.42)}px Impact, 'Arial Black', sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f6f6f0';
  ctx.fillText(def.name, 12, h * 0.3);
  ctx.font = `700 ${Math.round(h * 0.17)}px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillStyle = c.trim;
  ctx.fillText(def.title, 12, h * 0.75);
  return cv;
}

/** Tiny head icon for the stock counters. */
export function stockIconCanvas(def, size = 32) {
  const cv = mkCanvas(size, size);
  const ctx = cv.getContext('2d');
  const c = def.colors || {};
  ctx.fillStyle = shade(c.main, -20);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, 6.3);
  ctx.fill();
  ctx.save();
  ctx.scale(0.78, 0.78);
  ctx.translate(size * 0.14, size * 0.14);
  (GLYPHS[def.id] || GLYPHS.blitz)(ctx, size, c);
  ctx.restore();
  return cv;
}

export const GLYPH_IDS = Object.keys(GLYPHS);
