// Procedural canvas textures: the field paint job, masonry, asphalt, dusk sky.
import * as THREE from 'three';

export function mkCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

export function tex(canvas, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = aniso;
  return t;
}

export function speckle(ctx, x, y, w, h, n, colors, rMin = 1, rMax = 2.6) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.globalAlpha = 0.06 + Math.random() * 0.10;
    const r = rMin + Math.random() * (rMax - rMin);
    ctx.fillRect(x + Math.random() * w, y + Math.random() * h, r, r);
  }
  ctx.globalAlpha = 1;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function contrastText(hex) { return luminance(hex) > 0.55 ? '#16181d' : '#f6f6f4'; }

// ---------------------------------------------------------------- masonry
export function brickCanvas(base = '#9a4a32') {
  const cv = mkCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = shade(base, -34); // mortar
  ctx.fillRect(0, 0, 256, 256);
  const bw = 42, bh = 16, gap = 3;
  for (let row = 0; row * (bh + gap) < 256 + bh; row++) {
    const off = row % 2 ? -bw / 2 : 0;
    for (let col = -1; col * (bw + gap) < 256 + bw; col++) {
      const jitter = Math.random() * 14 - 7;
      ctx.fillStyle = shade(base, jitter);
      ctx.fillRect(off + col * (bw + gap), row * (bh + gap), bw, bh);
    }
  }
  speckle(ctx, 0, 0, 256, 256, 500, ['#000', '#fff'], 1, 1.6);
  return cv;
}

export function concreteCanvas(base = '#b7b4ac') {
  const cv = mkCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 0, 0, 256, 256, 1400, ['#6e6c66', '#fffef8', '#8a877f'], 0.8, 1.8);
  ctx.strokeStyle = shade(base, -42);
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  return cv;
}

export function asphaltCanvas(base = '#3a3b40') {
  const cv = mkCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 0, 0, 256, 256, 1600, ['#15161a', '#74767e', '#52545c'], 0.7, 1.7);
  return cv;
}

export function grassTileCanvas(base = '#2e6b2f') {
  const cv = mkCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    ctx.strokeStyle = Math.random() < 0.5 ? shade(base, 16) : shade(base, -18);
    ctx.globalAlpha = 0.16;
    const x = Math.random() * 256, y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 3 - 1.5, y - 2 - Math.random() * 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return cv;
}

// ---------------------------------------------------------------- day sky
export function daySkyCanvas() {
  const cv = mkCanvas(1024, 512);
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.00, '#3d7edb');
  g.addColorStop(0.45, '#74a8e8');
  g.addColorStop(0.75, '#aecdf0');
  g.addColorStop(1.00, '#dce8f4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  // puffy cumulus
  for (let i = 0; i < 14; i++) {
    const y = 120 + Math.random() * 220, x = Math.random() * 1024;
    const s = 30 + Math.random() * 70;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let j = 0; j < 5; j++) {
      ctx.beginPath();
      ctx.ellipse(x + (j - 2) * s * 0.45, y + Math.abs(j - 2) * 6, s * (0.6 - Math.abs(j - 2) * 0.08), s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(180,200,225,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.22, s * 1.05, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return cv;
}

// ---------------------------------------------------------------- dusk sky
export function skyCanvas() {
  const cv = mkCanvas(1024, 512);
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.00, '#060a1e');
  g.addColorStop(0.42, '#0d1838');
  g.addColorStop(0.62, '#22315e');
  g.addColorStop(0.78, '#5e4a6e');
  g.addColorStop(0.88, '#c4683f');
  g.addColorStop(1.00, '#e8965a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  // stars
  for (let i = 0; i < 420; i++) {
    const y = Math.random() * 300;
    ctx.globalAlpha = (1 - y / 320) * (0.35 + Math.random() * 0.6);
    ctx.fillStyle = Math.random() < 0.12 ? '#ffe9c4' : '#ffffff';
    const r = Math.random() < 0.08 ? 1.8 : 1.0;
    ctx.fillRect(Math.random() * 1024, y, r, r);
  }
  ctx.globalAlpha = 1;
  // thin horizon clouds
  for (let i = 0; i < 7; i++) {
    const y = 360 + Math.random() * 90;
    ctx.fillStyle = 'rgba(40,30,60,0.30)';
    const w = 140 + Math.random() * 320;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 1024, y, w, 7 + Math.random() * 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return cv;
}

// ---------------------------------------------------------------- the field
// Canvas X = field length (120 yds incl. end zones), canvas Y = field width (53.33 yds).
export function fieldCanvas({ schoolName, mascot, rivalName, primary, secondary, logo }) {
  const W = 4096, H = 1820;
  const cv = mkCanvas(W, H);
  const ctx = cv.getContext('2d');
  const sx = W / 120, sy = H / (160 / 3);
  const X = (yd) => yd * sx, Y = (yd) => yd * sy;

  // grass with mow stripes every 5 yds
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = i % 2 ? '#2c6a2e' : '#367c36';
    ctx.fillRect(X(i * 5), 0, X(5) + 1, H);
  }
  for (let i = 0; i < 9000; i++) {
    ctx.globalAlpha = 0.05 + Math.random() * 0.07;
    ctx.fillStyle = Math.random() < 0.5 ? '#1d4d20' : '#4a9a48';
    ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
  }
  ctx.globalAlpha = 1;

  // painted end zones
  const ezText = (x0, name, flip) => {
    ctx.fillStyle = primary;
    ctx.fillRect(X(x0), 0, X(10), H);
    speckle(ctx, X(x0), 0, X(10), H, 900, ['#000', '#fff'], 1.5, 3);
    // diagonal corner wedges
    ctx.fillStyle = secondary;
    const xx = X(x0), ww = X(10);
    [[xx, 0], [xx + ww, 0], [xx, H], [xx + ww, H]].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (px === xx ? 60 : -60), py);
      ctx.lineTo(px, py + (py === 0 ? 60 : -60));
      ctx.closePath();
      ctx.fill();
    });
    ctx.save();
    ctx.translate(X(x0 + 5), H / 2);
    ctx.rotate(flip ? Math.PI / 2 : -Math.PI / 2);
    const label = name.toUpperCase();
    const size = Math.min(300, (H * 0.82) / Math.max(1, label.length * 0.52));
    ctx.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f5f5f0';
    ctx.lineWidth = size * 0.10;
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = secondary;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  };
  ezText(0, schoolName, false);
  ezText(110, mascot, true);

  // midfield logo, painted into the turf
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.93;
    const d = X(16);
    ctx.translate(X(60), H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(logo, -d / 2, -d / 2, d, d);
    ctx.restore();
  }

  const white = 'rgba(248,248,244,0.96)';
  // sidelines + end lines
  ctx.strokeStyle = white;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  // yard lines every 5
  for (let yd = 10; yd <= 110; yd += 5) {
    const isGoal = yd === 10 || yd === 110;
    ctx.fillStyle = white;
    ctx.fillRect(X(yd) - (isGoal ? 6 : 3.5), 8, isGoal ? 12 : 7, H - 16);
  }

  // hash marks: HS hashes are 53'4" apart → ±8.89 yds from center; plus sideline ticks
  const hashRows = [H / 2 - Y(8.89), H / 2 + Y(8.89)];
  for (let yd = 11; yd < 110; yd++) {
    if (yd % 5 === 0) continue;
    for (const hy of hashRows) {
      ctx.fillStyle = white;
      ctx.fillRect(X(yd) - 2.2, hy - Y(0.33), 4.4, Y(0.66));
    }
    ctx.fillRect(X(yd) - 2.2, 8, 4.4, Y(0.66));
    ctx.fillRect(X(yd) - 2.2, H - 8 - Y(0.66), 4.4, Y(0.66));
  }

  // yard numbers + arrows (both sides, far side rotated)
  const numAt = (yd, label, arrow) => {
    for (const side of [0, 1]) {
      ctx.save();
      const ny = side === 0 ? H - Y(11) : Y(11);
      ctx.translate(X(yd), ny);
      if (side === 1) ctx.rotate(Math.PI);
      ctx.font = `700 ${Y(3.4)}px 'Arial Narrow', Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = white;
      ctx.fillText(label, 0, 0);
      if (arrow) {
        const dir = arrow === 'left' ? -1 : 1;
        ctx.beginPath();
        const ax = dir * Y(3.3);
        ctx.moveTo(ax, -Y(0.7));
        ctx.lineTo(ax + dir * Y(1.1), 0);
        ctx.lineTo(ax, Y(0.7));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  };
  for (let i = 1; i <= 9; i++) {
    const yd = 10 + i * 10;
    const n = i <= 5 ? i * 10 : (10 - i) * 10;
    const label = n === 50 ? '50' : `${n / 10} 0`;
    numAt(yd, label, n === 50 ? null : (i < 5 ? 'left' : 'right'));
  }
  return cv;
}

// ---------------------------------------------------------------- decals
export function numberCanvas(num, fill, stroke) {
  const cv = mkCanvas(256, 256);
  const ctx = cv.getContext('2d');
  ctx.font = `900 196px 'Arial Narrow', Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 26;
  ctx.strokeText(String(num), 128, 140);
  ctx.fillStyle = fill;
  ctx.fillText(String(num), 128, 140);
  return cv;
}

export function bannerCanvas(text, bg, fg, w = 1024, h = 128) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.font = `900 ${h * 0.55}px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.fillText(text.toUpperCase(), w / 2, h / 2 + 4);
  return cv;
}
