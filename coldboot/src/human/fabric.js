// Procedural fabric textures (tileable canvases): colour + a height map turned
// into a normal map. Patterns: plain, knit, rib, plaid (flannel), denim, duck
// (work canvas), nylon (quilted down), wool, fleece, fur, leather, camo,
// stripes. Cached by key.
import * as THREE from 'three';
import { makeRng } from '../core/util.js';

const cache = new Map();

function hex(c) { return new THREE.Color(c); }

function heightToNormal(hctx, size, strength = 2.0) {
  const src = hctx.getImageData(0, 0, size, size).data;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const out = ctx.createImageData(size, size);
  const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return cv;
}

/**
 * fabric({ pattern, color, color2, color3, scale }) → { map, normalMap, rough, sheen, repeat }
 * repeat = texture tiles per metre (garment UVs are in metres).
 */
export function fabric(o = {}) {
  const key = JSON.stringify(o);
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const pat = o.pattern || 'plain';
  const c1 = hex(o.color || '#555');
  const c2 = hex(o.color2 || '#222');
  const c3 = hex(o.color3 || '#999');
  const rng = makeRng(key);
  const col = document.createElement('canvas');
  col.width = col.height = size;
  const g = col.getContext('2d');
  const hcv = document.createElement('canvas');
  hcv.width = hcv.height = size;
  const h = hcv.getContext('2d');
  h.fillStyle = '#808080';
  h.fillRect(0, 0, size, size);
  const css = (c, k = 1) => `rgb(${Math.min(255, c.r * 255 * k) | 0},${Math.min(255, c.g * 255 * k) | 0},${Math.min(255, c.b * 255 * k) | 0})`;
  g.fillStyle = css(c1);
  g.fillRect(0, 0, size, size);
  let repeat = 8, rough = 0.85, sheen = 0.3, nstr = 2.5;

  const noiseDots = (n, alpha, kmin = 0.85, kmax = 1.15, r = 1.2, ctx = g) => {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = css(c1, kmin + (kmax - kmin) * rng());
      ctx.globalAlpha = alpha;
      ctx.fillRect(rng() * size, rng() * size, r, r);
    }
    ctx.globalAlpha = 1;
  };

  if (pat === 'knit' || pat === 'rib') {
    // V-shaped stitches in columns
    const cols = pat === 'rib' ? 16 : 20, rows = 26;
    const cw = size / cols, rh = size / rows;
    for (let cx = 0; cx < cols; cx++) {
      for (let ry = 0; ry < rows; ry++) {
        const x = cx * cw, y = ry * rh;
        const k = 0.9 + rng() * 0.2;
        for (const side of [0, 1]) {
          g.fillStyle = css(c1, k * (side ? 0.92 : 1.05));
          g.beginPath();
          g.ellipse(x + cw * (side ? 0.72 : 0.28), y + rh * 0.5, cw * 0.3, rh * 0.62, side ? -0.5 : 0.5, 0, Math.PI * 2);
          g.fill();
          h.fillStyle = 'rgb(210,210,210)';
          h.beginPath();
          h.ellipse(x + cw * (side ? 0.72 : 0.28), y + rh * 0.5, cw * 0.26, rh * 0.55, side ? -0.5 : 0.5, 0, Math.PI * 2);
          h.fill();
        }
        if (pat === 'rib' && cx % 2) { h.fillStyle = 'rgba(40,40,40,0.5)'; h.fillRect(x, y, cw, rh); }
      }
    }
    if (o.color2 && o.stripe) {
      for (let y = 0; y < size; y += size / 4) { g.fillStyle = css(c2); g.globalAlpha = 0.85; g.fillRect(0, y, size, size / 16); g.globalAlpha = 1; }
    }
    repeat = 9; rough = 0.95; sheen = 0.6; nstr = 3.5;
  } else if (pat === 'plaid') {
    // flannel: two crossing band systems, twill texture
    g.fillStyle = css(c1);
    g.fillRect(0, 0, size, size);
    const bands = [[0, 64, c2, 0.85], [96, 16, c3, 0.6], [150, 40, c2, 0.7], [210, 8, c3, 0.5]];
    for (const [p, w, c, a] of bands) {
      g.globalAlpha = a;
      g.fillStyle = css(c);
      g.fillRect(p, 0, w, size);
      g.fillRect(0, p, size, w);
    }
    g.globalAlpha = 1;
    for (let i = -size; i < size; i += 3) {
      g.strokeStyle = 'rgba(0,0,0,0.08)';
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + size, size); g.stroke();
      h.strokeStyle = 'rgba(255,255,255,0.25)';
      h.beginPath(); h.moveTo(i, 0); h.lineTo(i + size, size); h.stroke();
    }
    noiseDots(3000, 0.25, 0.9, 1.1, 1.5);
    repeat = 3.2; rough = 0.92; sheen = 0.7; nstr = 1.2;
  } else if (pat === 'denim') {
    for (let i = -size; i < size; i += 2) {
      g.strokeStyle = `rgba(255,255,255,${0.05 + rng() * 0.08})`;
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + size, size); g.stroke();
      h.strokeStyle = 'rgba(255,255,255,0.35)';
      h.beginPath(); h.moveTo(i, 0); h.lineTo(i + size, size); h.stroke();
    }
    noiseDots(6000, 0.35, 0.8, 1.25, 1.2);
    repeat = 10; rough = 0.9; sheen = 0.2; nstr = 2;
  } else if (pat === 'duck') {
    // heavy work canvas: tight weave + wear
    for (let y = 0; y < size; y += 2) { g.fillStyle = `rgba(0,0,0,${0.04 + rng() * 0.05})`; g.fillRect(0, y, size, 1); h.fillStyle = 'rgba(255,255,255,0.3)'; h.fillRect(0, y, size, 1); }
    for (let x = 0; x < size; x += 2) { g.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.04})`; g.fillRect(x, 0, 1, size); }
    noiseDots(5000, 0.3, 0.75, 1.2, 2);
    repeat = 9; rough = 0.95; sheen = 0.1; nstr = 1.5;
  } else if (pat === 'nylon') {
    // ripstop grid with a satin sheen
    for (let i = 0; i < size; i += 16) {
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(i, 0, 1, size); g.fillRect(0, i, size, 1);
      h.fillStyle = 'rgba(255,255,255,0.35)'; h.fillRect(i, 0, 1, size); h.fillRect(0, i, size, 1);
    }
    noiseDots(1500, 0.12, 0.95, 1.05, 2);
    repeat = 12; rough = 0.42; sheen = 0.15; nstr = 0.8;
  } else if (pat === 'wool') {
    noiseDots(16000, 0.35, 0.82, 1.18, 1.5);
    for (let i = 0; i < 3000; i++) { h.fillStyle = `rgba(${rng() > 0.5 ? 255 : 0},${0},0,0.2)`; h.fillRect(rng() * size, rng() * size, 2, 2); }
    repeat = 7; rough = 0.97; sheen = 0.8; nstr = 1.2;
  } else if (pat === 'fleece') {
    noiseDots(20000, 0.25, 0.85, 1.12, 2.5);
    repeat = 6; rough = 1; sheen = 1; nstr = 0.8;
  } else if (pat === 'fur') {
    for (let i = 0; i < 9000; i++) {
      const x = rng() * size, y = rng() * size, l = 4 + rng() * 10;
      g.strokeStyle = css(rng() > 0.5 ? c1 : c2, 0.8 + rng() * 0.5);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 3, y + l); g.stroke();
      h.strokeStyle = `rgba(255,255,255,${0.2 + rng() * 0.4})`;
      h.beginPath(); h.moveTo(x, y); h.lineTo(x, y + l); h.stroke();
    }
    repeat = 5; rough = 1; sheen = 1; nstr = 3;
  } else if (pat === 'leather') {
    noiseDots(4000, 0.25, 0.85, 1.1, 3);
    for (let i = 0; i < 1600; i++) { h.fillStyle = `rgba(0,0,0,${0.1 + rng() * 0.2})`; h.fillRect(rng() * size, rng() * size, 1 + rng() * 3, 1); }
    repeat = 5; rough = 0.55; sheen = 0; nstr = 1.5;
  } else if (pat === 'camo') {
    for (let i = 0; i < 70; i++) {
      g.fillStyle = css([c1, c2, c3][i % 3], 0.9 + rng() * 0.2);
      g.beginPath();
      g.ellipse(rng() * size, rng() * size, 10 + rng() * 30, 6 + rng() * 18, rng() * 3, 0, Math.PI * 2);
      g.fill();
    }
    repeat = 3; rough = 0.9; sheen = 0.2;
  } else if (pat === 'stripes') {
    for (let y = 0; y < size; y += 32) { g.fillStyle = css(c2); g.fillRect(0, y, size, 12); }
    noiseDots(3000, 0.2);
    repeat = 4; rough = 0.9; sheen = 0.4;
  } else {
    noiseDots(5000, 0.2, 0.92, 1.08, 1.5);
    repeat = 8; rough = o.rough ?? 0.85; sheen = 0.3; nstr = 1;
  }
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const normalMap = new THREE.CanvasTexture(heightToNormal(h, size, nstr));
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  const res = { map, normalMap, rough, sheen, repeat: o.repeat || repeat };
  cache.set(key, res);
  return res;
}
