// Station architecture: ceiling, tiled walls, platform, track pit, plus the
// generic wall dressing (mosaic name tablets, posters, graffiti, columns,
// benches, bins). All static — baked into background tiles by the stage.
import {
  INK, shape, rect, rrect, ellipse, blob, stroke, tube, dot, text, drips, FONTS,
  mulberry32, hashStr, shade, tint, mix, rgba, rectPts, ellipsePts, pathPts, measure,
} from '../ink.js';

export const Y = {
  CEIL: 70,       // underside of the ceiling beam
  TRIM: 104,      // colored trim line
  WALL_LOW: 360,  // grimy wainscot starts
  FLOOR_BACK: 420,
  FEET: 440,
  FLOOR_FRONT: 452,
  EDGE: 461,      // bottom of yellow tactile strip
  FACE: 520,      // bottom of platform face
  RAIL_FAR: 560,
  RAIL_NEAR: 598,
};

export const PALETTES = {
  token: {
    wall: '#4a4190', tile: '#554a9e', grout: '#2e2760', trim: '#d4473f', trim2: '#e8b84a',
    ceil: '#141027', beam: '#221c40', floor: '#4e477a', face: '#2a2452', pit: '#100c20',
    light: '#e6e0ff', mosaic: '#9c2f2a', mosaicText: '#f6ecd2',
  },
  drip: {
    wall: '#3a4a8c', tile: '#44559c', grout: '#24305e', trim: '#2fb8a0', trim2: '#e8b84a',
    ceil: '#0f1226', beam: '#1a1f3e', floor: '#47507e', face: '#252b52', pit: '#0c0e1e',
    light: '#dff5ff', mosaic: '#1f7a6a', mosaicText: '#f6ecd2',
  },
  bodega: {
    wall: '#4f3e86', tile: '#5b4893', grout: '#33275e', trim: '#ff8a3d', trim2: '#3ec7b0',
    ceil: '#151024', beam: '#241a3c', floor: '#544675', face: '#2c234d', pit: '#110c1e',
    light: '#fff0dc', mosaic: '#b8561e', mosaicText: '#f6ecd2',
  },
  sewer: {
    wall: '#2e4a3e', tile: '#355446', grout: '#1c3028', trim: '#7ed957', trim2: '#c8a050',
    ceil: '#0a1410', beam: '#142a20', floor: '#3a5446', face: '#1e3428', pit: '#081210',
    light: '#c8ffd8', mosaic: '#2e6a3a', mosaicText: '#e8ffe0',
  },
  ghost: {
    wall: '#3e6a72', tile: '#4a7a80', grout: '#25484e', trim: '#d8c48a', trim2: '#9ad8c8',
    ceil: '#0e1c22', beam: '#1a3238', floor: '#466a70', face: '#203a40', pit: '#0a161a',
    light: '#c8fff0', mosaic: '#2a5a5e', mosaicText: '#e8fff6',
  },
};

// ---------------------------------------------------------------- architecture

// Draw ceiling + wall + floor + pit for the world rect [x0,x1]×[y0,y1].
export function drawArchitecture(g, pal, x0, x1, y0, y1, o = {}) {
  if (o.variant === 'sewer') return drawSewer(g, pal, x0, x1, y0, y1, o);
  if (o.variant === 'ghost') return drawGhostHall(g, pal, x0, x1, y0, y1, o);
  const top = Math.min(y0, -400), bottom = Math.max(y1, 1100);
  // ceiling void
  const cg = g.createLinearGradient(0, -400, 0, Y.CEIL);
  cg.addColorStop(0, '#05030c');
  cg.addColorStop(1, pal.ceil);
  g.fillStyle = cg;
  g.fillRect(x0, top, x1 - x0, Y.CEIL - top);
  drawCeiling(g, pal, x0, x1, o);
  if (o.wall !== false) drawWall(g, pal, x0, x1, o);
  drawFloor(g, pal, x0, x1, o);
  drawPit(g, pal, x0, x1, bottom, o);
}

function drawCeiling(g, pal, x0, x1, o) {
  // upper void: ducts and cable trays (seen on tall phone screens)
  const duct = (y, h, col) => {
    g.fillStyle = INK;
    g.fillRect(x0, y - 2, x1 - x0, h + 4);
    g.fillStyle = col;
    g.fillRect(x0, y, x1 - x0, h);
    g.fillStyle = rgba('#ffffff', 0.05);
    g.fillRect(x0, y, x1 - x0, 3);
    g.fillStyle = rgba('#000000', 0.3);
    for (let x = Math.floor(x0 / 96) * 96; x < x1; x += 96) g.fillRect(x, y, 3, h);
  };
  duct(-250, 34, '#1a1630');
  duct(-150, 18, '#201a38');
  for (let x = Math.floor(x0 / 180) * 180 - 180; x < x1 + 180; x += 180) {
    // sagging cable bundles between hangers
    g.strokeStyle = '#0a0714';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, -108);
    g.quadraticCurveTo(x + 90, -84, x + 180, -108);
    g.moveTo(x, -100);
    g.quadraticCurveTo(x + 90, -70, x + 180, -100);
    g.stroke();
    g.fillStyle = '#2a2444';
    g.fillRect(x - 3, -116, 6, 20);
  }
  // ribbed ceiling: shallow vaults between beams
  const step = 140;
  const i0 = Math.floor(x0 / step) - 1, i1 = Math.ceil(x1 / step) + 1;
  for (let i = i0; i <= i1; i++) {
    const x = i * step;
    g.fillStyle = rgba('#000000', 0.25);
    g.fillRect(x - 6, -120, 12, Y.CEIL + 120);
    g.fillStyle = pal.beam;
    g.fillRect(x - 5, -120, 10, Y.CEIL + 120);
    g.fillStyle = rgba('#ffffff', 0.05);
    g.fillRect(x - 5, -120, 2, Y.CEIL + 120);
  }
  // main beam
  g.fillStyle = pal.beam;
  g.fillRect(x0, Y.CEIL - 22, x1 - x0, 22);
  g.fillStyle = rgba('#ffffff', 0.06);
  g.fillRect(x0, Y.CEIL - 22, x1 - x0, 3);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, Y.CEIL);
  g.lineTo(x1, Y.CEIL);
  g.moveTo(x0, Y.CEIL - 22);
  g.lineTo(x1, Y.CEIL - 22);
  g.stroke();
  // rivets
  g.fillStyle = shade(pal.beam, -0.6);
  for (let x = Math.floor(x0 / 30) * 30; x < x1; x += 30) {
    dot(g, x + 6, Y.CEIL - 11, 1.6, rgba('#ffffff', 0.12));
  }
  // pipes
  const pipe = (y, w, col, seed) => {
    g.lineCap = 'butt';
    g.strokeStyle = INK;
    g.lineWidth = w + 5;
    g.beginPath(); g.moveTo(x0 - 10, y); g.lineTo(x1 + 10, y); g.stroke();
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x0 - 10, y); g.lineTo(x1 + 10, y); g.stroke();
    g.strokeStyle = rgba('#ffffff', 0.14);
    g.lineWidth = w * 0.25;
    g.beginPath(); g.moveTo(x0 - 10, y - w * 0.22); g.lineTo(x1 + 10, y - w * 0.22); g.stroke();
    // joints + brackets
    for (let x = Math.floor(x0 / 220) * 220 - 220 + (seed % 90); x < x1 + 220; x += 220) {
      rect(g, x - 4, y - w / 2 - 3, 8, w + 6, { fill: shade(col, 0.2), lw: 2, amp: 0.2, seed: seed + x });
      stroke(g, [[x, y - w / 2 - 3], [x, -140]], { lw: 2, color: '#0a0716', amp: 0 });
    }
  };
  pipe(-8, 16, '#3a3456', 11);
  pipe(22, 10, '#5a3a3a', 47);
  // conduit with a drip stain
  pipe(38, 5, '#2e2a48', 83);
}

function drawWall(g, pal, x0, x1, o) {
  const wy0 = Y.CEIL, wy1 = Y.FLOOR_BACK;
  g.fillStyle = pal.tile;
  g.fillRect(x0, wy0, x1 - x0, wy1 - wy0);
  // tiles: running bond 24x12
  const tw = 24, th = 12;
  const r0 = Math.floor((wy0 - wy0) / th), r1 = Math.ceil((wy1 - wy0) / th);
  // tile tint variation
  for (let r = r0; r < r1; r++) {
    const y = wy0 + r * th;
    const off = (r % 2) * (tw / 2);
    const c0 = Math.floor((x0 - off) / tw) - 1, c1 = Math.ceil((x1 - off) / tw) + 1;
    for (let c = c0; c < c1; c++) {
      const h = hashStr(`${c},${r},${o.seed || 0}`);
      const v = (h % 1000) / 1000;
      if (v < 0.09) {
        g.fillStyle = v < 0.045 ? rgba('#ffffff', 0.06) : rgba('#000000', 0.12);
        g.fillRect(c * tw + off, y, tw, th);
      } else if (v > 0.997 && y > wy0 + 40 && y < Y.WALL_LOW) {
        // missing tile
        g.fillStyle = shade(pal.grout, 0.3);
        g.fillRect(c * tw + off + 1, y + 1, tw - 2, th - 2);
      }
    }
  }
  // grout
  g.strokeStyle = pal.grout;
  g.lineWidth = 1.2;
  g.beginPath();
  for (let r = r0; r <= r1; r++) {
    const y = wy0 + r * th + 0.5;
    g.moveTo(x0, y);
    g.lineTo(x1, y);
  }
  for (let r = r0; r < r1; r++) {
    const y = wy0 + r * th;
    const off = (r % 2) * (tw / 2);
    const c0 = Math.floor((x0 - off) / tw), c1 = Math.ceil((x1 - off) / tw);
    for (let c = c0; c <= c1; c++) {
      const x = c * tw + off + 0.5;
      g.moveTo(x, y);
      g.lineTo(x, y + th);
    }
  }
  g.stroke();
  // glaze: light top edge + dark bottom edge on every row reads as glossy ceramic
  g.strokeStyle = rgba('#ffffff', 0.11);
  g.lineWidth = 2;
  g.beginPath();
  for (let r = r0; r < r1; r++) {
    const y = wy0 + r * th + 2.2;
    g.moveTo(x0, y);
    g.lineTo(x1, y);
  }
  g.stroke();
  g.strokeStyle = rgba('#0a0618', 0.16);
  g.beginPath();
  for (let r = r0; r < r1; r++) {
    const y = wy0 + r * th + th - 1.6;
    g.moveTo(x0, y);
    g.lineTo(x1, y);
  }
  g.stroke();
  // trim band (station color) + thin second line
  g.fillStyle = pal.trim;
  g.fillRect(x0, Y.TRIM, x1 - x0, 10);
  g.fillStyle = pal.trim2;
  g.fillRect(x0, Y.TRIM + 14, x1 - x0, 4);
  g.strokeStyle = rgba('#140f26', 0.6);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x0, Y.TRIM); g.lineTo(x1, Y.TRIM);
  g.moveTo(x0, Y.TRIM + 10); g.lineTo(x1, Y.TRIM + 10);
  g.stroke();
  // top shadow under the beam
  const sg = g.createLinearGradient(0, wy0, 0, wy0 + 50);
  sg.addColorStop(0, rgba('#05030c', 0.55));
  sg.addColorStop(1, rgba('#05030c', 0));
  g.fillStyle = sg;
  g.fillRect(x0, wy0, x1 - x0, 50);
  // grime rising from the floor
  const gg = g.createLinearGradient(0, Y.WALL_LOW - 40, 0, wy1);
  gg.addColorStop(0, rgba('#120a24', 0));
  gg.addColorStop(1, rgba('#120a24', 0.55));
  g.fillStyle = gg;
  g.fillRect(x0, Y.WALL_LOW - 40, x1 - x0, wy1 - Y.WALL_LOW + 40);
  // water stains dripping from the trim
  const sx0 = Math.floor(x0 / 90) - 1, sx1 = Math.ceil(x1 / 90) + 1;
  for (let i = sx0; i <= sx1; i++) {
    const r = mulberry32(hashStr(`stain${i}${o.seed || 0}`));
    if (r() < 0.45) continue;
    const x = i * 90 + r() * 80;
    const len = 40 + r() * 160;
    const w = 6 + r() * 16;
    const st = g.createLinearGradient(0, Y.TRIM + 18, 0, Y.TRIM + 18 + len);
    st.addColorStop(0, rgba('#1a1030', 0.28));
    st.addColorStop(1, rgba('#1a1030', 0));
    g.fillStyle = st;
    g.beginPath();
    g.moveTo(x - w / 2, Y.TRIM + 18);
    g.quadraticCurveTo(x - w * 0.3, Y.TRIM + 18 + len * 0.6, x, Y.TRIM + 18 + len);
    g.quadraticCurveTo(x + w * 0.3, Y.TRIM + 18 + len * 0.6, x + w / 2, Y.TRIM + 18);
    g.fill();
  }
  // cracks
  for (let i = sx0; i <= sx1; i++) {
    const r = mulberry32(hashStr(`crack${i}${o.seed || 0}`));
    if (r() < 0.8) continue;
    let x = i * 90 + r() * 80, y = Y.TRIM + 30 + r() * 180;
    const pts = [[x, y]];
    for (let k = 0; k < 5; k++) {
      x += (r() - 0.3) * 14;
      y += 8 + r() * 12;
      pts.push([x, y]);
    }
    stroke(g, pts, { lw: 1.6, color: rgba('#140f26', 0.75), amp: 0.3, smooth: false, seed: i });
  }
  // wall/floor seam
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, wy1);
  g.lineTo(x1, wy1);
  g.stroke();
}

function drawFloor(g, pal, x0, x1, o) {
  const fy0 = Y.FLOOR_BACK, fy1 = Y.FLOOR_FRONT;
  g.fillStyle = pal.floor;
  g.fillRect(x0, fy0, x1 - x0, fy1 - fy0);
  // contact shadow at the wall
  const sg = g.createLinearGradient(0, fy0, 0, fy0 + 12);
  sg.addColorStop(0, rgba('#0a0618', 0.45));
  sg.addColorStop(1, rgba('#0a0618', 0));
  g.fillStyle = sg;
  g.fillRect(x0, fy0, x1 - x0, 12);
  // speckle + gum spots
  const r = mulberry32(hashStr(`floor${Math.floor(x0 / 512)}${o.seed || 0}`));
  for (let i = 0; i < (x1 - x0) / 6; i++) {
    const x = x0 + r() * (x1 - x0), y = fy0 + 3 + r() * (fy1 - fy0 - 5);
    g.fillStyle = r() < 0.5 ? rgba('#ffffff', 0.06) : rgba('#000000', 0.14);
    g.fillRect(x, y, 1.6, 1.2);
  }
  for (let i = 0; i < (x1 - x0) / 120; i++) {
    const x = x0 + r() * (x1 - x0), y = fy0 + 8 + r() * 18;
    g.fillStyle = rgba('#140f26', 0.25);
    g.beginPath();
    g.ellipse(x, y, 2.5 + r() * 2, 1.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  // tactile edge strip
  g.fillStyle = '#e8b830';
  g.fillRect(x0, fy1, x1 - x0, Y.EDGE - fy1);
  g.fillStyle = rgba('#7a5a10', 0.55);
  for (let x = Math.floor(x0 / 7) * 7; x < x1; x += 7) {
    g.fillRect(x + 1, fy1 + 2, 2.4, 1.6);
    g.fillRect(x + 4.5, fy1 + 5.5, 2.4, 1.6);
  }
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, fy1);
  g.lineTo(x1, fy1);
  g.moveTo(x0, Y.EDGE);
  g.lineTo(x1, Y.EDGE);
  g.stroke();
  // platform face
  g.fillStyle = pal.face;
  g.fillRect(x0, Y.EDGE, x1 - x0, Y.FACE - Y.EDGE);
  const fg = g.createLinearGradient(0, Y.EDGE, 0, Y.FACE);
  fg.addColorStop(0, rgba('#ffffff', 0.05));
  fg.addColorStop(1, rgba('#000000', 0.3));
  g.fillStyle = fg;
  g.fillRect(x0, Y.EDGE, x1 - x0, Y.FACE - Y.EDGE);
  g.strokeStyle = rgba('#0a0618', 0.7);
  g.lineWidth = 2;
  g.beginPath();
  for (let x = Math.floor(x0 / 160) * 160; x <= x1; x += 160) {
    g.moveTo(x, Y.EDGE + 2);
    g.lineTo(x + 1, Y.FACE);
  }
  g.stroke();
  // stencil every so often
  for (let x = Math.floor(x0 / 640) * 640 - 340; x < x1 + 100; x += 640) {
    text(g, 'STAND BACK', x, Y.EDGE + 34, { size: 13, font: FONTS.sign, fill: rgba('#e8b830', 0.55), lw: 0 });
  }
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, Y.FACE);
  g.lineTo(x1, Y.FACE);
  g.stroke();
}

function drawPit(g, pal, x0, x1, bottom, o) {
  g.fillStyle = pal.pit;
  g.fillRect(x0, Y.FACE, x1 - x0, bottom - Y.FACE);
  // under-platform shadow
  const sg = g.createLinearGradient(0, Y.FACE, 0, Y.FACE + 30);
  sg.addColorStop(0, rgba('#000000', 0.6));
  sg.addColorStop(1, rgba('#000000', 0));
  g.fillStyle = sg;
  g.fillRect(x0, Y.FACE, x1 - x0, 30);
  // third rail + cover board, on insulators
  const r = mulberry32(hashStr(`pit${Math.floor(x0 / 512)}${o.seed || 0}`));
  for (let x = Math.floor(x0 / 90) * 90 - 90; x < x1 + 90; x += 90) {
    rect(g, x + 20, 536, 8, 12, { fill: '#6a5a40', lw: 2, amp: 0 });
  }
  g.fillStyle = '#3a3230';
  g.fillRect(x0, 530, x1 - x0, 7);
  g.fillStyle = '#c9a43a';
  g.fillRect(x0, 528, x1 - x0, 3);
  g.strokeStyle = INK;
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(x0, 527); g.lineTo(x1, 527);
  g.moveTo(x0, 537.5); g.lineTo(x1, 537.5);
  g.stroke();
  // ties (perspective trapezoids)
  for (let x = Math.floor(x0 / 34) * 34 - 34; x < x1 + 34; x += 34) {
    const k = hashStr(`tie${x}`) % 7;
    g.fillStyle = k === 0 ? '#3a2a22' : '#2e221c';
    g.beginPath();
    g.moveTo(x, 550);
    g.lineTo(x + 18, 550);
    g.lineTo(x + 22, 612);
    g.lineTo(x - 2, 612);
    g.closePath();
    g.fill();
    g.strokeStyle = rgba('#000000', 0.55);
    g.lineWidth = 1.5;
    g.stroke();
  }
  // gravel
  for (let i = 0; i < (x1 - x0) / 3; i++) {
    const x = x0 + r() * (x1 - x0), y = 545 + r() * 90;
    g.fillStyle = r() < 0.5 ? rgba('#ffffff', 0.05) : rgba('#000000', 0.3);
    g.fillRect(x, y, 2, 1.5);
  }
  // rails
  const rail = (y, w) => {
    g.fillStyle = INK;
    g.fillRect(x0, y - w / 2 - 2, x1 - x0, w + 4);
    g.fillStyle = '#4a4660';
    g.fillRect(x0, y - w / 2, x1 - x0, w);
    g.fillStyle = '#c8c8e0';
    g.fillRect(x0, y - w / 2, x1 - x0, 2.2);
  };
  rail(Y.RAIL_FAR, 7);
  rail(Y.RAIL_NEAR, 9);
  // trash in the pit
  for (let i = 0; i < (x1 - x0) / 260; i++) {
    const x = x0 + r() * (x1 - x0), y = 570 + r() * 40;
    const kind = r();
    if (kind < 0.35) ellipse(g, x, y, 6, 4, { fill: '#e8e0cc', lw: 2, seed: Math.floor(x) });
    else if (kind < 0.6) rrect(g, x, y - 5, 10, 6, 2, { fill: '#c84040', lw: 2, seed: Math.floor(x), rot: 0.3 });
    else if (kind < 0.75) {
      g.fillStyle = rgba('#7a8cff', 0.18);
      g.beginPath();
      g.ellipse(x, y + 6, 26, 5, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // the near platform (where the "camera" stands), seen on tall screens
  const ny = 656;
  g.fillStyle = shade(pal.face, 0.25);
  g.fillRect(x0, ny, x1 - x0, 52);
  g.fillStyle = rgba('#ffffff', 0.04);
  for (let x = Math.floor(x0 / 160) * 160 + 80; x <= x1; x += 160) g.fillRect(x, ny, 2, 52);
  g.fillStyle = '#c99a28';
  g.fillRect(x0, ny + 52, x1 - x0, 9);
  g.fillStyle = shade(pal.floor, 0.35);
  g.fillRect(x0, ny + 61, x1 - x0, bottom - ny - 61);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, ny); g.lineTo(x1, ny);
  g.moveTo(x0, ny + 52); g.lineTo(x1, ny + 52);
  g.moveTo(x0, ny + 61); g.lineTo(x1, ny + 61);
  g.stroke();
  const bg = g.createLinearGradient(0, ny + 61, 0, ny + 360);
  bg.addColorStop(0, rgba('#000000', 0.15));
  bg.addColorStop(1, rgba('#000000', 0.85));
  g.fillStyle = bg;
  g.fillRect(x0, ny + 61, x1 - x0, bottom - ny - 61);
}

// ---------------------------------------------------------------- wall dressing

// NYC-style mosaic name tablet.
export function mosaic(g, x, y, w, h, name, pal, seed = 1) {
  rect(g, x - 6, y - 6, w + 12, h + 12, { fill: pal.trim2, lw: 3, amp: 0.3, seed });
  // meander border
  g.save();
  g.beginPath();
  g.rect(x - 6, y - 6, w + 12, h + 12);
  g.clip();
  g.fillStyle = shade(pal.trim2, 0.35);
  for (let i = x - 6; i < x + w + 6; i += 12) {
    g.fillRect(i, y - 6, 6, 3);
    g.fillRect(i + 6, y + h + 3, 6, 3);
  }
  g.restore();
  rect(g, x, y, w, h, { fill: pal.mosaic, lw: 2.6, amp: 0.3, seed: seed + 1 });
  // little tile grid
  g.strokeStyle = rgba('#000000', 0.18);
  g.lineWidth = 0.8;
  g.beginPath();
  for (let i = x + 6; i < x + w; i += 6) { g.moveTo(i, y); g.lineTo(i, y + h); }
  for (let j = y + 6; j < y + h; j += 6) { g.moveTo(x, j); g.lineTo(x + w, j); }
  g.stroke();
  const size = Math.min(h * 0.62, (w * 0.86) / Math.max(4, name.length * 0.72));
  text(g, name, x + w / 2, y + h / 2 + size * 0.38, { size, font: FONTS.sign, fill: pal.mosaicText, lw: 0, spacing: 2 });
}

// Hanging station sign (black band with white letters, like the real ones).
export function hangingSign(g, x, y, w, label, sub, seed = 1) {
  stroke(g, [[x + 14, y], [x + 14, -140]], { lw: 2.4, color: '#0a0716', amp: 0 });
  stroke(g, [[x + w - 14, y], [x + w - 14, -140]], { lw: 2.4, color: '#0a0716', amp: 0 });
  rrect(g, x, y, w, 34, 3, { fill: '#121018', lw: 3, seed });
  text(g, label, x + 12, y + 23, { size: 15, font: FONTS.sign, fill: '#f6f2ea', lw: 0, align: 'left' });
  if (sub) {
    let bx = x + w - 20;
    for (let i = sub.length - 1; i >= 0; i--) {
      const [ch, col] = sub[i];
      ellipse(g, bx, y + 17, 10, 10, { fill: col, lw: 2, seed: seed + i });
      text(g, ch, bx, y + 22.5, { size: 12, font: FONTS.sign, fill: col === '#ffd23f' ? INK : '#ffffff', lw: 0 });
      bx -= 24;
    }
  }
}

export function column(g, x, pal, seed = 1) {
  // riveted steel I-beam pilaster
  const top = Y.CEIL - 22, bot = Y.FLOOR_BACK + 6;
  rect(g, x - 15, top, 30, bot - top, { fill: '#2b3a3a', lw: 3, amp: 0.4, seed });
  g.fillStyle = rgba('#ffffff', 0.08);
  g.fillRect(x - 12, top, 5, bot - top);
  g.fillStyle = rgba('#000000', 0.25);
  g.fillRect(x + 6, top, 6, bot - top);
  rect(g, x - 20, bot - 16, 40, 16, { fill: '#223030', lw: 3, amp: 0.3, seed: seed + 1 });
  rect(g, x - 20, top, 40, 12, { fill: '#223030', lw: 3, amp: 0.3, seed: seed + 2 });
  for (let y = top + 24; y < bot - 20; y += 22) dot(g, x - 8, y, 1.6, rgba('#ffffff', 0.18));
  for (let y = top + 24; y < bot - 20; y += 22) dot(g, x + 8, y, 1.6, rgba('#000000', 0.4));
  // peeling paint
  g.fillStyle = '#5a2a2a';
  g.fillRect(x - 13, bot - 70, 9, 14);
}

export function bench(g, x, seed = 1) {
  const y = Y.FLOOR_BACK;
  rect(g, x + 10, y - 26, 8, 30, { fill: '#2a2638', lw: 2.4, amp: 0.2, seed });
  rect(g, x + 132, y - 26, 8, 30, { fill: '#2a2638', lw: 2.4, amp: 0.2, seed: seed + 1 });
  rrect(g, x, y - 34, 150, 10, 3, { fill: '#a0623a', shade: '#7a4a2a', sdx: 0, sdy: 3, lw: 3, seed: seed + 2 });
  rrect(g, x + 4, y - 62, 142, 9, 3, { fill: '#a0623a', shade: '#7a4a2a', sdx: 0, sdy: 3, lw: 3, seed: seed + 3 });
  rrect(g, x + 4, y - 50, 142, 9, 3, { fill: '#a0623a', shade: '#7a4a2a', sdx: 0, sdy: 3, lw: 3, seed: seed + 4 });
  stroke(g, [[x + 14, y - 34], [x + 14, y - 62]], { lw: 4, color: '#2a2638' });
  stroke(g, [[x + 136, y - 34], [x + 136, y - 62]], { lw: 4, color: '#2a2638' });
  text(g, '3R', x + 75, y - 53.5, { size: 6, font: FONTS.sign, fill: rgba('#140f26', 0.5), lw: 0 });
}

export function bin(g, x, seed = 1, overflow = true) {
  const y = Y.FLOOR_BACK + 4;
  if (overflow) {
    ellipse(g, x - 6, y - 52, 9, 6, { fill: '#e8e0cc', lw: 2.4, seed: seed + 5 });
    rrect(g, x + 4, y - 58, 8, 12, 2, { fill: '#e8456b', lw: 2.4, seed: seed + 6, rot: 0.4 });
    ellipse(g, x + 10, y - 50, 7, 5, { fill: '#3ec7b0', lw: 2.4, seed: seed + 7 });
  }
  blob(g, [['M', x - 17, y - 50], ['L', x + 17, y - 50], ['L', x + 14, y], ['L', x - 14, y], ['Z']], { fill: '#3a4a5a', lw: 3, seed });
  g.save();
  g.beginPath();
  g.moveTo(x - 17, y - 50); g.lineTo(x + 17, y - 50); g.lineTo(x + 14, y); g.lineTo(x - 14, y); g.closePath();
  g.clip();
  g.strokeStyle = rgba('#140f26', 0.55);
  g.lineWidth = 1.2;
  g.beginPath();
  for (let i = -30; i < 30; i += 6) { g.moveTo(x + i, y - 50); g.lineTo(x + i + 18, y); }
  for (let i = -30; i < 30; i += 6) { g.moveTo(x + i + 18, y - 50); g.lineTo(x + i, y); }
  g.stroke();
  g.restore();
  rrect(g, x - 19, y - 54, 38, 6, 2, { fill: '#4a5a6a', lw: 2.6, seed: seed + 1 });
}

// Parody ads and flyers pasted on the walls.
export const POSTERS = [
  { title: 'LEARN TO DJ', sub: 'in 3 days or ur money back', bg: '#ffd23f', fg: '#140f26', art: 'vinyl' },
  { title: 'MISSING', sub: 'my pizza. last seen on these stairs', bg: '#f4efe6', fg: '#140f26', art: 'pizza' },
  { title: 'DR. CHEDDAR', sub: 'cheese therapy · 2nd floor', bg: '#3ec7b0', fg: '#140f26', art: 'cheese' },
  { title: 'KNOW YOUR RIGHTS', sub: 'rats are people too', bg: '#e8456b', fg: '#f6ecd2', art: 'rat' },
  { title: 'SHOWTIME', sub: 'pole dancing · next car', bg: '#7b5cff', fg: '#f6ecd2', art: 'star' },
  { title: 'LOST CAT', sub: 'nvm found him. he runs the bodega', bg: '#f4efe6', fg: '#140f26', art: 'cat' },
  { title: 'WET PAINT', sub: '(it has been wet since 1987)', bg: '#ff8a3d', fg: '#140f26', art: 'drip' },
  { title: 'SEE SOMETHING?', sub: 'say nothing. mind ur business', bg: '#5aa0ff', fg: '#140f26', art: 'eye' },
];

export function poster(g, x, y, w, h, p, seed = 1) {
  const r = mulberry32(seed);
  const rot = (r() - 0.5) * 0.08;
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.rotate(rot);
  // torn edge: jagged polygon
  const pts = [];
  const jag = (ax, ay, bx, by, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push([ax + (bx - ax) * t + (r() - 0.5) * 3, ay + (by - ay) * t + (r() - 0.5) * 3]);
    }
  };
  jag(-w / 2, -h / 2, w / 2, -h / 2, 8);
  jag(w / 2, -h / 2, w / 2, h / 2, 10);
  jag(w / 2, h / 2, -w / 2, h / 2, 8);
  jag(-w / 2, h / 2, -w / 2, -h / 2, 10);
  shape(g, pts, { fill: p.bg, lw: 2.4, amp: 0, smooth: false, seed });
  text(g, p.title, 0, -h / 2 + 22, { size: Math.min(17, (w * 0.9) / (p.title.length * 0.66)), font: FONTS.sign, fill: p.fg, lw: 0 });
  // art
  const ay = -2;
  if (p.art === 'vinyl') {
    ellipse(g, 0, ay, 22, 22, { fill: '#140f26', lw: 2, seed });
    ellipse(g, 0, ay, 7, 7, { fill: '#e8456b', lw: 1.6, seed: seed + 1 });
  } else if (p.art === 'pizza') {
    blob(g, [['M', -14, ay - 18], ['L', 14, ay - 18], ['L', 0, ay + 20], ['Z']], { fill: '#ffcf5a', lw: 2.4, seed });
    dot(g, -3, ay - 8, 3, '#e8456b'); dot(g, 5, ay - 4, 3, '#e8456b');
  } else if (p.art === 'cheese') {
    blob(g, [['M', -20, ay + 14], ['L', 20, ay + 14], ['L', 20, ay - 2], ['L', -20, ay - 14], ['Z']], { fill: '#ffd23f', lw: 2.4, seed });
    dot(g, -6, ay + 4, 3, '#d49a12'); dot(g, 8, ay + 8, 2.5, '#d49a12');
  } else if (p.art === 'rat') {
    ellipse(g, 0, ay, 16, 13, { fill: '#b8b0d8', lw: 2.4, seed });
    ellipse(g, -12, ay - 12, 7, 7, { fill: '#b8b0d8', lw: 2.4, seed: seed + 1 });
    ellipse(g, 12, ay - 12, 7, 7, { fill: '#b8b0d8', lw: 2.4, seed: seed + 2 });
    dot(g, -5, ay - 2, 2.2, INK); dot(g, 5, ay - 2, 2.2, INK); dot(g, 0, ay + 5, 2.6, '#ff8fb8');
  } else if (p.art === 'star') {
    const s = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 9 : 21;
      s.push([Math.cos(a) * rr, ay + Math.sin(a) * rr]);
    }
    shape(g, s, { fill: '#ffd23f', lw: 2.4, seed, smooth: false });
  } else if (p.art === 'cat') {
    ellipse(g, 0, ay, 16, 14, { fill: '#f0a050', lw: 2.4, seed });
    blob(g, [['M', -14, ay - 6], ['L', -12, ay - 22], ['L', -4, ay - 12], ['Z']], { fill: '#f0a050', lw: 2.2, seed: seed + 1 });
    blob(g, [['M', 14, ay - 6], ['L', 12, ay - 22], ['L', 4, ay - 12], ['Z']], { fill: '#f0a050', lw: 2.2, seed: seed + 2 });
    stroke(g, [[-7, ay - 2], [-3, ay - 1]], { lw: 2 }); stroke(g, [[3, ay - 1], [7, ay - 2]], { lw: 2 });
  } else if (p.art === 'drip') {
    rect(g, -22, ay - 14, 44, 10, { fill: '#140f26', lw: 0, amp: 0 });
    drips(g, -20, ay - 6, 40, '#140f26', seed, { count: 5, maxLen: 22, line: null });
  } else if (p.art === 'eye') {
    shape(g, pathPts([['M', -22, ay], ['Q', 0, ay - 20, 22, ay], ['Q', 0, ay + 20, -22, ay]]), { fill: '#fffaf0', lw: 2.4, seed });
    dot(g, 0, ay, 7, '#140f26');
  }
  // small print
  g.font = `11px ${FONTS.hand}`;
  g.fillStyle = p.fg;
  g.textAlign = 'center';
  wrapLines(g, p.sub, w - 14).slice(0, 2).forEach((ln, i) => g.fillText(ln, 0, h / 2 - 20 + i * 12));
  // tape
  g.fillStyle = rgba('#f4ead0', 0.7);
  g.save(); g.translate(-w / 2 + 6, -h / 2 + 2); g.rotate(-0.6); g.fillRect(-10, -4, 20, 8); g.restore();
  g.save(); g.translate(w / 2 - 6, -h / 2 + 2); g.rotate(0.6); g.fillRect(-10, -4, 20, 8); g.restore();
  g.restore();
}

export function wrapLines(g, str, maxW) {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (g.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- graffiti

const TAG_WORDS = ['RIZO', 'KAPS', 'NEKO', 'SKUM', 'VYBE', 'ZEEK', 'MOTOR', 'RATZ', 'BOLT', 'GRIME', 'TOKN', 'LUXE', 'YUM', 'OKAY', 'PEZ', 'DUST', 'NOVA', 'CHEZ', 'BLIP', 'SOOT', 'WHYS', 'DEUX', 'FOMO', 'MUNK'];
const SPRAY = ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7ed957', '#ff8a3d', '#5aa0ff', '#b48cff', '#f4efe6'];

export function tag(g, x, y, o = {}) {
  const r = mulberry32(o.seed || 1);
  const word = o.word || TAG_WORDS[Math.floor(r() * TAG_WORDS.length)];
  const col = o.color || SPRAY[Math.floor(r() * SPRAY.length)];
  const size = o.size || 26 + r() * 16;
  const rot = o.rot ?? (r() - 0.5) * 0.35;
  g.save();
  g.globalAlpha *= o.alpha ?? 0.92;
  text(g, word, x, y, { size, font: FONTS.tag, fill: col, lw: size * 0.06, line: rgba('#140f26', 0.8), rot, skewX: -0.15 });
  if (r() < 0.6) {
    const w = measure(g, word, size, FONTS.tag);
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    drips(g, -w * 0.4, -size * 0.1, w * 0.8, col, (o.seed || 1) + 9, { count: 2 + Math.floor(r() * 3), maxLen: 18, thick: 2.2, line: null });
    g.restore();
  }
  g.restore();
}

// Bubble-letter throw-up: thick outline, fill, 3D shadow, shine dots.
export function throwup(g, x, y, o = {}) {
  const r = mulberry32(o.seed || 2);
  const word = o.word || TAG_WORDS[Math.floor(r() * TAG_WORDS.length)];
  const fill = o.fill || SPRAY[Math.floor(r() * SPRAY.length)];
  const out = o.outline || '#140f26';
  const size = o.size || 44;
  const rot = o.rot ?? (r() - 0.5) * 0.18;
  text(g, word, x, y, {
    size, font: o.font || FONTS.drip, fill, line: out, lw: size * 0.2, rot,
    extrude: [size * 0.07, size * 0.09, 4, shade(fill, 0.6)],
  });
  // shine dots
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const w = measure(g, word, size, o.font || FONTS.drip);
  for (let i = 0; i < 3; i++) dot(g, -w / 2 + w * (0.15 + i * 0.3) + r() * 8, -size * 0.55 + r() * 6, 2.4, rgba('#ffffff', 0.85));
  g.restore();
}

// Big multi-color piece (for legal walls + logos).
export function piece(g, x, y, word, o = {}) {
  const size = o.size || 72;
  const fill = o.fill || '#ff4f9a';
  const fill2 = o.fill2 || '#ffd23f';
  const rot = o.rot ?? -0.04;
  const font = o.font || FONTS.drip;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.font = `${size}px ${font}`;
  const w = g.measureText(word).width;
  // glow cloud behind
  if (o.cloud !== false) {
    const r = mulberry32(o.seed || 3);
    for (let i = 0; i < 14; i++) {
      const cx = -w / 2 + r() * w, cy = -size * 0.35 + (r() - 0.5) * size * 0.8;
      g.fillStyle = rgba(o.cloudColor || '#b48cff', 0.22);
      g.beginPath();
      g.arc(cx, cy, size * (0.25 + r() * 0.3), 0, Math.PI * 2);
      g.fill();
    }
  }
  const grad = g.createLinearGradient(0, -size * 0.8, 0, size * 0.1);
  grad.addColorStop(0, fill2);
  grad.addColorStop(1, fill);
  text(g, word, 0, 0, {
    size, font, fill: grad, line: o.outline || '#140f26', lw: size * 0.16,
    extrude: [size * 0.06, size * 0.08, 5, o.extrudeColor || '#2a1a4a'],
  });
  // highlight line along letter tops
  g.save();
  g.beginPath();
  g.rect(-w, -size * 0.85, w * 2, size * 0.18);
  g.clip();
  text(g, word, 0, 0, { size, font, fill: rgba('#ffffff', 0.55), lw: 0 });
  g.restore();
  if (o.drips !== false) drips(g, -w * 0.45, -size * 0.04, w * 0.9, fill, (o.seed || 3) + 1, { count: Math.round(w / 40), maxLen: size * 0.4, thick: size * 0.06 });
  // sparkles
  const sp = (sx, sy, s) => {
    g.fillStyle = '#fffaf0';
    g.beginPath();
    g.moveTo(sx, sy - s); g.lineTo(sx + s * 0.25, sy - s * 0.25); g.lineTo(sx + s, sy);
    g.lineTo(sx + s * 0.25, sy + s * 0.25); g.lineTo(sx, sy + s); g.lineTo(sx - s * 0.25, sy + s * 0.25);
    g.lineTo(sx - s, sy); g.lineTo(sx - s * 0.25, sy - s * 0.25); g.closePath();
    g.fill();
  };
  sp(-w * 0.52, -size * 0.75, size * 0.12);
  sp(w * 0.5, -size * 0.2, size * 0.09);
  g.restore();
}

// A cluster of stickers slapped on a wall/column.
export function stickers(g, x, y, n, seed = 5) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const sx = x + (r() - 0.5) * 50, sy = y + (r() - 0.5) * 40;
    const w = 14 + r() * 14, h = 9 + r() * 10;
    const col = SPRAY[Math.floor(r() * SPRAY.length)];
    g.save();
    g.translate(sx, sy);
    g.rotate((r() - 0.5) * 0.7);
    rrect(g, -w / 2, -h / 2, w, h, 2, { fill: '#fffaf0', lw: 1.6, amp: 0.2, seed: seed + i });
    rrect(g, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 1.5, { fill: col, lw: 0, amp: 0, seed: seed + i });
    if (r() < 0.5) text(g, TAG_WORDS[Math.floor(r() * TAG_WORDS.length)], 0, h * 0.2, { size: h * 0.55, font: FONTS.sign, fill: '#140f26', lw: 0 });
    g.restore();
  }
}

// ---------------------------------------------------------------- sewer

function bricks(g, x0, x1, y0, y1, col, mortar, seed, bw = 30, bh = 13) {
  g.fillStyle = col;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const r0 = Math.floor(y0 / bh), r1 = Math.ceil(y1 / bh);
  for (let r = r0; r < r1; r++) {
    const off = (r % 2 + 2) % 2 ? bw / 2 : 0;
    const c0 = Math.floor((x0 - off) / bw) - 1, c1 = Math.ceil((x1 - off) / bw) + 1;
    for (let c = c0; c < c1; c++) {
      const v = (hashStr(`b${c},${r},${seed}`) % 1000) / 1000;
      if (v < 0.22) {
        g.fillStyle = v < 0.1 ? rgba('#ffffff', 0.05) : rgba('#000000', 0.16);
        g.fillRect(c * bw + off, r * bh, bw, bh);
      }
    }
  }
  g.strokeStyle = mortar;
  g.lineWidth = 1.6;
  g.beginPath();
  for (let r = r0; r <= r1; r++) { g.moveTo(x0, r * bh + 0.5); g.lineTo(x1, r * bh + 0.5); }
  for (let r = r0; r < r1; r++) {
    const off = (r % 2 + 2) % 2 ? bw / 2 : 0;
    const c0 = Math.floor((x0 - off) / bw), c1 = Math.ceil((x1 - off) / bw);
    for (let c = c0; c <= c1; c++) { const x = c * bw + off + 0.5; g.moveTo(x, r * bh); g.lineTo(x, r * bh + bh); }
  }
  g.stroke();
}

function drawSewer(g, pal, x0, x1, y0, y1, o) {
  const top = Math.min(y0, -400), bottom = Math.max(y1, 1100);
  g.fillStyle = '#040806';
  g.fillRect(x0, top, x1 - x0, bottom - top);
  bricks(g, x0, x1, -60, Y.FLOOR_BACK, pal.tile, pal.grout, 3);
  // arched recesses between pilasters
  const step = 460;
  for (let i = Math.floor(x0 / step) - 1; i <= Math.ceil(x1 / step) + 1; i++) {
    const cx = i * step + step / 2;
    g.save();
    g.beginPath();
    g.moveTo(cx - 180, Y.FLOOR_BACK);
    g.lineTo(cx - 180, 150);
    g.arc(cx, 150, 180, Math.PI, 0);
    g.lineTo(cx + 180, Y.FLOOR_BACK);
    g.closePath();
    g.fillStyle = rgba('#000000', 0.28);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = INK;
    g.stroke();
    g.restore();
    // arch voussoirs
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI + (k / 12) * Math.PI;
      const ax = cx + Math.cos(a) * 180, ay = 150 + Math.sin(a) * 180;
      const bx = cx + Math.cos(a) * 204, by = 150 + Math.sin(a) * 204;
      stroke(g, [[ax, ay], [bx, by]], { lw: 2, color: pal.grout, amp: 0 });
    }
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, 150, 204, Math.PI, 0);
    g.stroke();
    // slime drips from the arch crown
    drips(g, cx - 60, -50, 120, rgba('#7ed957', 0.5), i * 7 + 3, { count: 5, maxLen: 40, thick: 4, line: null });
  }
  // grime + slime line
  const gg = g.createLinearGradient(0, 300, 0, Y.FLOOR_BACK);
  gg.addColorStop(0, rgba('#0a1a0a', 0));
  gg.addColorStop(1, rgba('#2a4a10', 0.55));
  g.fillStyle = gg;
  g.fillRect(x0, 300, x1 - x0, Y.FLOOR_BACK - 300);
  // ceiling vault shadow
  const cg = g.createLinearGradient(0, -400, 0, 60);
  cg.addColorStop(0, '#000000');
  cg.addColorStop(1, rgba('#000000', 0));
  g.fillStyle = cg;
  g.fillRect(x0, -400, x1 - x0, 460);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(x0, Y.FLOOR_BACK); g.lineTo(x1, Y.FLOOR_BACK); g.stroke();
  // walkway
  g.fillStyle = pal.floor;
  g.fillRect(x0, Y.FLOOR_BACK, x1 - x0, Y.FLOOR_FRONT - Y.FLOOR_BACK);
  const r = mulberry32(hashStr(`sw${Math.floor(x0 / 512)}`));
  for (let i = 0; i < (x1 - x0) / 5; i++) {
    g.fillStyle = r() < 0.5 ? rgba('#ffffff', 0.05) : rgba('#000000', 0.18);
    g.fillRect(x0 + r() * (x1 - x0), Y.FLOOR_BACK + 2 + r() * 28, 2, 1.4);
  }
  // mossy curb
  g.fillStyle = '#4a7a3a';
  g.fillRect(x0, Y.FLOOR_FRONT, x1 - x0, Y.EDGE - Y.FLOOR_FRONT);
  g.strokeStyle = INK;
  g.beginPath(); g.moveTo(x0, Y.FLOOR_FRONT); g.lineTo(x1, Y.FLOOR_FRONT); g.moveTo(x0, Y.EDGE); g.lineTo(x1, Y.EDGE); g.stroke();
  bricks(g, x0, x1, Y.EDGE, Y.FACE, pal.face, '#0e1a14', 9, 34, 15);
  g.strokeStyle = INK;
  g.beginPath(); g.moveTo(x0, Y.FACE); g.lineTo(x1, Y.FACE); g.stroke();
  // the channel (water surface animated live)
  const wg = g.createLinearGradient(0, Y.FACE, 0, 700);
  wg.addColorStop(0, '#1e4a2e');
  wg.addColorStop(1, '#06140c');
  g.fillStyle = wg;
  g.fillRect(x0, Y.FACE, x1 - x0, bottom - Y.FACE);
}

// ---------------------------------------------------------------- ghost station

function drawGhostHall(g, pal, x0, x1, y0, y1, o) {
  const top = Math.min(y0, -400), bottom = Math.max(y1, 1100);
  g.fillStyle = '#081418';
  g.fillRect(x0, top, x1 - x0, Y.CEIL - top);
  // guastavino vaults: big shallow arches with herringbone tile
  const step = 420;
  for (let i = Math.floor(x0 / step) - 1; i <= Math.ceil(x1 / step) + 1; i++) {
    const cx = i * step + step / 2;
    g.save();
    g.beginPath();
    g.moveTo(cx - 210, Y.CEIL);
    g.quadraticCurveTo(cx, -260, cx + 210, Y.CEIL);
    g.closePath();
    g.clip();
    g.fillStyle = '#c8b88a';
    g.fillRect(cx - 220, -280, 440, 360);
    g.strokeStyle = rgba('#5a4a2a', 0.55);
    g.lineWidth = 1.2;
    g.beginPath();
    for (let yy = -260; yy < Y.CEIL; yy += 10) {
      for (let xx = cx - 220; xx < cx + 220; xx += 20) {
        const k = ((yy / 10) | 0) % 2 ? 10 : 0;
        g.moveTo(xx + k, yy); g.lineTo(xx + k + 10, yy + 10);
        g.moveTo(xx + k + 20, yy); g.lineTo(xx + k + 10, yy + 10);
      }
    }
    g.stroke();
    // skylight: leaded glass oval at the crown
    g.fillStyle = '#9ad8c8';
    g.beginPath();
    g.ellipse(cx, -150, 70, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1d3a3a';
    g.lineWidth = 3;
    g.stroke();
    g.lineWidth = 1.6;
    g.beginPath();
    for (let k = -3; k <= 3; k++) { g.moveTo(cx + k * 20, -178); g.lineTo(cx + k * 20, -122); }
    g.moveTo(cx - 70, -150); g.lineTo(cx + 70, -150);
    g.stroke();
    // darken toward the edges
    const vg = g.createRadialGradient(cx, -150, 40, cx, -60, 260);
    vg.addColorStop(0, rgba('#000000', 0));
    vg.addColorStop(1, rgba('#000000', 0.55));
    g.fillStyle = vg;
    g.fillRect(cx - 220, -280, 440, 360);
    g.restore();
    // rib outline
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - 210, Y.CEIL);
    g.quadraticCurveTo(cx, -260, cx + 210, Y.CEIL);
    g.stroke();
    // cream band at the springing line
    rect(g, cx - 214, Y.CEIL - 10, 18, 20, { fill: '#d8c48a', lw: 2.6, amp: 0.3, seed: i });
  }
  drawWall(g, pal, x0, x1, o);
  // arched plaque bands
  g.fillStyle = rgba('#d8c48a', 0.9);
  g.fillRect(x0, Y.CEIL, x1 - x0, 8);
  drawFloor(g, pal, x0, x1, o);
  drawPit(g, pal, x0, x1, bottom, o);
  // dust over everything
  const r = mulberry32(hashStr(`dust${Math.floor(x0 / 512)}`));
  for (let i = 0; i < (x1 - x0) / 10; i++) {
    g.fillStyle = rgba('#e8fff6', 0.05 + r() * 0.05);
    g.fillRect(x0 + r() * (x1 - x0), Y.CEIL + r() * 340, 3, 2);
  }
}

export function plaque(g, x, label, pal, seed = 1) {
  const w = Math.max(160, label.length * 30), h = 62;
  rect(g, x - w / 2 - 8, 160 - 8, w + 16, h + 16, { fill: '#d8c48a', lw: 3, amp: 0.3, seed });
  rect(g, x - w / 2, 160, w, h, { fill: '#2a5a5e', lw: 2.6, amp: 0.3, seed: seed + 1 });
  // garland ornaments
  for (let i = 0; i < 6; i++) dot(g, x - w / 2 + 10 + i * ((w - 20) / 5), 156, 3, '#9a7a3a');
  text(g, label, x, 160 + h / 2 + 12, { size: 32, font: FONTS.sign, fill: '#e8fff6', lw: 0, spacing: 3 });
}
