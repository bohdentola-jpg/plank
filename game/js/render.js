// render.js — chunky-pixel renderer.
//
// The world draws onto a small offscreen canvas (1 canvas px = 1 world px),
// then scales up with smoothing off → everything comes out pixelated, even
// plain lines and circles. Crisp things (chat bubbles, names, UI) go on a
// separate hi-res overlay canvas.

import { PAL, COLORS, pixelText } from './util.js';
import { modelInfo, entW, entH, PALETTE_KEYS } from './world.js';

export class Renderer {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = canvas.getContext('2d');
    this.octx = overlay.getContext('2d');
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    this.px = 3;               // device px per world px
    this.cam = { x: 0, y: -40 };
    this.shakeT = 0;
    this.shakeAmt = 0;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.w = w; this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.overlay.width = Math.round(w * dpr);
    this.overlay.height = Math.round(h * dpr);
    this.off.width = Math.ceil(w / this.px) + 2;
    this.off.height = Math.ceil(h / this.px) + 2;
  }

  setZoom(px) {
    this.px = Math.max(1, Math.min(8, px));
    this.resize();
  }

  shake(secs) { this.shakeT = Math.max(this.shakeT, secs); this.shakeAmt = 3; }

  // begin a frame; returns the world-space ctx (translated so cam is centered)
  begin(bg, dt) {
    const c = this.offCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = bg || PAL.bg;
    c.fillRect(0, 0, this.off.width, this.off.height);
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      sx = (Math.random() - 0.5) * 2 * this.shakeAmt;
      sy = (Math.random() - 0.5) * 2 * this.shakeAmt;
    }
    c.translate(
      Math.round(this.off.width / 2 - this.cam.x + sx),
      Math.round(this.off.height / 2 - this.cam.y + sy)
    );
    return c;
  }

  // blit offscreen → main canvas, prep overlay ctx
  end() {
    const g = this.ctx;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, this.w, this.h);
    g.drawImage(this.off, 0, 0, this.off.width * this.px, this.off.height * this.px);
    const o = this.octx;
    o.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    o.clearRect(0, 0, this.w, this.h);
    return o;
  }

  worldToScreen(x, y) {
    return {
      x: (x - this.cam.x) * this.px + (this.off.width / 2) * this.px,
      y: (y - this.cam.y) * this.px + (this.off.height / 2) * this.px,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - (this.off.width / 2) * this.px) / this.px + this.cam.x,
      y: (sy - (this.off.height / 2) * this.px) / this.px + this.cam.y,
    };
  }

  viewBounds(pad = 40) {
    const hw = (this.off.width / 2 + pad), hh = (this.off.height / 2 + pad);
    return { x0: this.cam.x - hw, y0: this.cam.y - hh, x1: this.cam.x + hw, y1: this.cam.y + hh };
  }
}

// ---------------------------------------------------------------- ground
export function drawGround(c, groundY, view) {
  if (groundY == null) return;
  c.fillStyle = PAL.ground;
  c.fillRect(view.x0, groundY, view.x1 - view.x0, view.y1 - groundY);
  c.fillStyle = PAL.groundEdge;
  c.fillRect(view.x0, groundY, view.x1 - view.x0, 1);
  // faint mile markers so an empty void still reads as movement
  c.fillStyle = 'rgba(0,0,0,0.045)';
  const step = 90;
  for (let x = Math.floor(view.x0 / step) * step; x < view.x1; x += step) {
    c.fillRect(x, groundY + 4, 2, 1);
  }
}

// ---------------------------------------------------------------- stickman
// pose: {x, y (center), face, walkPhase, onGround, vy, holding ('box'|'blaster'|null),
//        aim (radians, world), pong (bool), swingT, frozen, sit}
export function drawStickman(c, p, color) {
  const col = color || PAL.stick;
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const feetY = p.y + 12;
  const pelvis = { x: p.x, y: p.y + 3 };
  const neck = { x: p.x, y: p.y - 4 };
  const headC = { x: p.x, y: p.y - 8 };

  const t = p.walkPhase || 0;
  const moving = Math.abs(p.vx || 0) > 6;
  let l1 = { x: p.x - 3, y: feetY }, l2 = { x: p.x + 3, y: feetY };
  if (!p.onGround) {
    l1 = { x: p.x - 4, y: feetY - 4 };
    l2 = { x: p.x + 3, y: feetY - 2 };
  } else if (moving) {
    const s = Math.sin(t) * 5;
    l1 = { x: p.x + s, y: feetY - Math.max(0, Math.sin(t)) * 2 };
    l2 = { x: p.x - s, y: feetY - Math.max(0, -Math.sin(t)) * 2 };
  }

  // legs
  c.beginPath();
  c.moveTo(pelvis.x, pelvis.y); c.lineTo(l1.x, l1.y);
  c.moveTo(pelvis.x, pelvis.y); c.lineTo(l2.x, l2.y);
  // spine
  c.moveTo(pelvis.x, pelvis.y); c.lineTo(neck.x, neck.y);
  c.stroke();

  // arms
  c.beginPath();
  if (p.holding === 'box') {
    // both arms up holding a box overhead
    c.moveTo(neck.x, neck.y); c.lineTo(p.x - 4, p.y - 13);
    c.moveTo(neck.x, neck.y); c.lineTo(p.x + 4, p.y - 13);
  } else if (p.holding === 'blaster') {
    const a = p.aim != null ? p.aim : (p.face > 0 ? 0 : Math.PI);
    const hx = neck.x + Math.cos(a) * 8, hy = neck.y + 1 + Math.sin(a) * 8;
    c.moveTo(neck.x, neck.y + 1); c.lineTo(hx, hy);
    const off = p.face > 0 ? -3 : 3;
    c.moveTo(neck.x, neck.y + 1); c.lineTo(neck.x + off, neck.y + 6);
    c.stroke();
    drawBlaster(c, hx, hy, a);
    c.beginPath();
  } else if (p.pong) {
    // paddle arm toward the table, other arm back
    const dir = p.face > 0 ? 1 : -1;
    const swing = p.swingT > 0 ? Math.sin(p.swingT * Math.PI / 0.18) * 5 : 0;
    const hx = neck.x + dir * (7 + swing), hy = neck.y + 3 - swing;
    c.moveTo(neck.x, neck.y + 1); c.lineTo(hx, hy);
    c.moveTo(neck.x, neck.y + 1); c.lineTo(neck.x - dir * 4, neck.y + 6);
    c.stroke();
    drawPaddle(c, hx, hy, dir);
    c.beginPath();
  } else if (moving && p.onGround) {
    const s = Math.sin(t) * 4;
    c.moveTo(neck.x, neck.y + 1); c.lineTo(p.x - s, neck.y + 8);
    c.moveTo(neck.x, neck.y + 1); c.lineTo(p.x + s, neck.y + 8);
  } else if (!p.onGround) {
    c.moveTo(neck.x, neck.y + 1); c.lineTo(p.x - 5, neck.y + 2);
    c.moveTo(neck.x, neck.y + 1); c.lineTo(p.x + 5, neck.y + 2);
  } else {
    const sway = Math.sin((p.idleT || 0) * 2) * 0.7;
    c.moveTo(neck.x, neck.y + 1); c.lineTo(p.x - 3 + sway, neck.y + 8);
    c.moveTo(neck.x, neck.y + 1); c.lineTo(p.x + 3 + sway, neck.y + 8);
  }
  c.stroke();

  // head — filled circle goes chunky when upscaled
  c.beginPath();
  c.arc(headC.x, headC.y, 3.5, 0, Math.PI * 2);
  c.fill();

  if (p.frozen) {
    c.fillStyle = 'rgba(120,160,220,0.25)';
    c.fillRect(p.x - 7, p.y - 13, 14, 26);
  }
}

export function drawBlaster(c, x, y, angle) {
  c.save();
  c.translate(x, y);
  c.rotate(angle || 0);
  c.fillStyle = PAL.stickDark;
  c.fillRect(0, -1.5, 7, 3);        // barrel
  c.fillRect(-1, 0, 3, 5);          // grip
  c.fillStyle = PAL.bolt;
  c.fillRect(5, -1, 2, 2);          // muzzle
  c.restore();
}

export function drawPaddle(c, x, y, dir) {
  c.fillStyle = PAL.cardDark;
  c.fillRect(x - 1, y - 1, dir * 3, 2);    // handle
  c.fillStyle = '#b55c5c';
  c.beginPath();
  c.arc(x + dir * 4, y - 1, 3.5, 0, Math.PI * 2);
  c.fill();
}

// ---------------------------------------------------------------- models
export function drawEntity(c, map, ent, opts = {}) {
  if (!ent.visible) return;
  const w = entW(map, ent), h = entH(map, ent);
  const x0 = Math.round(ent.x - w / 2), y0 = Math.round(ent.y - h / 2);
  const info = modelInfo(map, ent.model);
  const tint = ent.color ? COLORS[ent.color] : null;

  if (info.custom) {
    drawCustomModel(c, info.custom, x0, y0, ent.scale / 100, tint);
  } else {
    switch (ent.model) {
      case 'box': case 'bigbox': drawCardboardBox(c, x0, y0, w, h, tint); break;
      case 'platform': drawSlab(c, x0, y0, w, h, tint || '#cccccc', '#b5b5b5'); break;
      case 'block': drawSlab(c, x0, y0, w, h, tint || '#c4c4c4', '#adadad'); break;
      case 'wall': drawSlab(c, x0, y0, w, h, tint || '#d0d0d0', '#bababa'); break;
      case 'blasterstand': drawBlasterStand(c, x0, y0, w, h, opts.armed); break;
      case 'pongtable': drawPongTable(c, x0, y0, w, h, tint); break;
      case 'sign': drawSign(c, x0, y0, w, h, tint); break;
      default: drawSlab(c, x0, y0, w, h, tint || '#d99', '#b77'); break;
    }
  }
}

export function drawCardboardBox(c, x, y, w, h, tint) {
  c.fillStyle = tint || PAL.card;
  c.fillRect(x, y, w, h);
  c.fillStyle = tint ? shade(tint, -25) : PAL.cardDark;
  c.fillRect(x, y, w, 1);
  c.fillRect(x, y, 1, h);
  c.fillRect(x + w - 1, y, 1, h);
  c.fillRect(x, y + h - 1, w, 1);
  // tape line down the middle
  c.fillStyle = tint ? shade(tint, 25) : PAL.tape;
  c.fillRect(x + Math.floor(w / 2) - 1, y + 1, 2, h - 2);
}

function drawSlab(c, x, y, w, h, fill, edge) {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
  c.fillStyle = edge;
  c.fillRect(x, y, w, 1);
  c.fillRect(x, y + h - 1, w, 1);
  c.fillRect(x, y, 1, h);
  c.fillRect(x + w - 1, y, 1, h);
}

function drawBlasterStand(c, x, y, w, h, armed) {
  // pedestal
  c.fillStyle = '#c0c0c0';
  c.fillRect(x + Math.floor(w / 2) - 1, y + 6, 3, h - 8);
  c.fillRect(x + 1, y + h - 2, w - 2, 2);
  c.fillStyle = '#a8a8a8';
  c.fillRect(x + 2, y + 5, w - 4, 2);
  if (armed) drawBlaster(c, x + w / 2 - 3, y + 3, 0);
}

export function drawPongTable(c, x, y, w, h, tint) {
  const top = y + 6;
  // legs
  c.fillStyle = '#9b9b9b';
  c.fillRect(x + 4, top + 3, 2, h - 9);
  c.fillRect(x + w - 6, top + 3, 2, h - 9);
  // table top
  c.fillStyle = tint || '#7f9f8a';       // a faded table green, the one splash of color
  c.fillRect(x, top, w, 4);
  c.fillStyle = '#ffffff';
  c.fillRect(x, top, w, 1);
  // net
  c.fillStyle = '#e6e6e6';
  c.fillRect(x + Math.floor(w / 2) - 1, top - 6, 1, 6);
  c.fillStyle = '#c9c9c9';
  c.fillRect(x + Math.floor(w / 2), top - 6, 1, 6);
}

function drawSign(c, x, y, w, h, tint) {
  c.fillStyle = '#b9b9b9';
  c.fillRect(x + Math.floor(w / 2) - 1, y + 6, 2, h - 6);
  c.fillStyle = tint || PAL.card;
  c.fillRect(x, y, w, 9);
  c.fillStyle = PAL.cardDark;
  c.fillRect(x, y, w, 1); c.fillRect(x, y + 8, w, 1);
  c.fillRect(x, y, 1, 9); c.fillRect(x + w - 1, y, 1, 9);
  c.fillStyle = '#8d7350';
  c.fillRect(x + 2, y + 3, w - 4, 1);
  c.fillRect(x + 2, y + 5, w - 6, 1);
}

export function drawCustomModel(c, m, x0, y0, scale, tint) {
  const s = scale;
  for (let r = 0; r < m.h; r++) {
    for (let q = 0; q < m.w; q++) {
      const ch = m.d[r * m.w + q];
      if (!ch || ch === '.') continue;
      const idx = parseInt(ch, 36);
      const key = PALETTE_KEYS[idx];
      if (!key) continue;
      c.fillStyle = tint || COLORS[key];
      // round edges so scaled pixels don't leave seams
      const px = x0 + q * s, py = y0 + r * s;
      c.fillRect(Math.floor(px), Math.floor(py), Math.ceil(s), Math.ceil(s));
    }
  }
}

// ---------------------------------------------------------------- extras
export function drawBolt(c, b) {
  const a = Math.atan2(b.vy, b.vx);
  c.save();
  c.translate(b.x, b.y);
  c.rotate(a);
  c.fillStyle = PAL.bolt;
  c.fillRect(-4, -1, 8, 2);
  c.fillStyle = '#dcdcdc';
  c.fillRect(-7, -1, 3, 2);
  c.restore();
}

// box-burst particles for deaths
export function drawBurstBox(c, p) {
  c.save();
  c.translate(p.x, p.y);
  c.rotate(p.rot);
  const s = p.size;
  c.globalAlpha = Math.max(0, Math.min(1, p.life / 0.5));
  drawCardboardBox(c, -s / 2, -s / 2, s, s, null);
  c.globalAlpha = 1;
  c.restore();
}

export function drawSpawnMarker(c, x, y) {
  c.strokeStyle = '#a8c5a8';
  c.lineWidth = 1;
  c.strokeRect(x - 5, y - 12, 10, 24);
  c.fillStyle = '#a8c5a8';
  c.fillRect(x - 1, y - 16, 2, 3);
}

// in-world pixel text helper (already world-space): centered
export function worldLabel(c, text, x, y, scale = 1, color) {
  const w = String(text).length * 4 * scale - scale;
  pixelText(c, text, Math.round(x - w / 2), Math.round(y), scale, color || PAL.ink);
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
