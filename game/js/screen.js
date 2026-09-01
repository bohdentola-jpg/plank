// screen.js — the 2D screen inside an arcade cabinet.
//
// A little retained-mode display: boxscript stamps named rectangles and prints
// named pixel text; this draws them onto a 240×180 canvas that lives in two
// places at once — as a texture on the cabinet's 3D screen, and blown up in
// the play overlay when you step up to it. Screen space is 100 × 75, origin
// top left. When nobody's playing, it dims and blinks its own invitation.

import * as THREE from '../vendor/three.module.js';
import { COLORS, clamp } from './util.js';

export const SCREEN_W = 100;
export const SCREEN_H = 75;
const SCALE = 2.4;              // canvas px per screen unit
const MAX_SPRITES = 500;

// 3×5 pixel font, the same lettering the rest of the game speaks
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011',
  D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111',
  J: '001001001101010', K: '101110100110101', L: '100100100100111',
  M: '101111111101101', N: '101111111111101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110110101',
  S: '011100010001110', T: '111010010010010', U: '101101101101011',
  V: '101101101010010', W: '101101111111101', X: '101010010010101',
  Y: '101101010010010', Z: '111001010100111',
  0: '010101101101010', 1: '010110010010111', 2: '110001010100111',
  3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100110101010', 7: '111001010010010', 8: '010101010101010',
  9: '010101011001110', ' ': '000000000000000', '-': '000000111000000',
  ':': '000010000010000', '.': '000000000000010', '!': '010010010000010',
  '?': '110001010000010', '+': '000010111010000', "'": '010010000000000',
  ',': '000000000010100', '/': '001001010100100', '—': '000000111000000',
  '_': '000000000000111', '=': '000111000111000', '>': '100010001010100',
  '<': '001010100010001', '"': '101101000000000', '(': '001010010010001',
  ')': '100010010010100',
};

function css(name, fallback = '#e8e8e8') {
  if (name == null) return fallback;
  const key = String(name).toLowerCase().trim();
  if (key === 'black') return '#141418';
  const hex = COLORS[key];
  if (hex == null) return fallback;
  return '#' + hex.toString(16).padStart(6, '0');
}

export class Screen {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(SCREEN_W * SCALE);
    this.canvas.height = Math.round(SCREEN_H * SCALE);
    this.canvas.className = 'arcade-canvas';
    this.ctx = this.canvas.getContext('2d');
    this.sprites = new Map();      // id → {kind:'rect'|'text', …} in insertion order
    this.bg = '#141418';
    this.active = false;           // the local player is at the controls
    this.dirty = true;
    this.blinkT = 0;
    this.lastBlink = null;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  clear(color) {
    this.sprites.clear();
    if (color != null) this.bg = css(color, '#141418');
    this.dirty = true;
  }

  stamp(id, x, y, w, h, color) {
    if (!this.sprites.has(id) && this.sprites.size >= MAX_SPRITES) return;
    const prev = this.sprites.get(id);
    // keep insertion order (draw order) stable when a sprite just moves
    const spr = prev && prev.kind === 'rect' ? prev : { kind: 'rect' };
    spr.x = x; spr.y = y; spr.w = w; spr.h = h;
    spr.color = color != null && color !== '' && color !== '0' ? css(color) : (spr.color || '#e8e8e8');
    if (!prev || prev.kind !== 'rect') this.sprites.delete(id);
    this.sprites.set(id, spr);
    this.dirty = true;
  }

  print(id, text, x, y, size, color) {
    if (!this.sprites.has(id) && this.sprites.size >= MAX_SPRITES) return;
    const prev = this.sprites.get(id);
    const spr = prev && prev.kind === 'text' ? prev : { kind: 'text' };
    spr.text = String(text).slice(0, 80);
    spr.x = x; spr.y = y;
    spr.size = clamp(size || 3, 1, 30);
    spr.color = color != null && color !== '' && color !== '0' ? css(color) : (spr.color || '#e8e8e8');
    if (!prev || prev.kind !== 'text') this.sprites.delete(id);
    this.sprites.set(id, spr);
    this.dirty = true;
  }

  unstamp(id) {
    if (id === 'all') this.sprites.clear();
    else this.sprites.delete(id);
    this.dirty = true;
  }

  // draw pixel text; size = glyph height in screen units (5 dots tall)
  drawText(text, x, y, size, color) {
    const c = this.ctx;
    const dot = (size / 5) * SCALE;
    c.fillStyle = color;
    let cx = x * SCALE;
    const cy = y * SCALE;
    for (const raw of String(text).toUpperCase()) {
      const g = FONT[raw] || FONT['?'];
      for (let i = 0; i < 15; i++) {
        if (g[i] === '1') {
          c.fillRect(
            Math.round(cx + (i % 3) * dot),
            Math.round(cy + Math.floor(i / 3) * dot),
            Math.ceil(dot), Math.ceil(dot),
          );
        }
      }
      cx += 4 * dot;
    }
  }

  draw(dt) {
    this.blinkT += dt;
    const blink = this.active ? false : Math.sin(this.blinkT * 2.6) > -0.3;
    if (!this.dirty && blink === this.lastBlink) return;
    this.lastBlink = blink;
    this.dirty = false;

    const c = this.ctx;
    c.fillStyle = this.bg;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (const spr of this.sprites.values()) {
      if (spr.kind === 'rect') {
        c.fillStyle = spr.color;
        c.fillRect(
          Math.round(spr.x * SCALE), Math.round(spr.y * SCALE),
          Math.max(1, Math.round(spr.w * SCALE)), Math.max(1, Math.round(spr.h * SCALE)),
        );
      } else {
        this.drawText(spr.text, spr.x, spr.y, spr.size, spr.color);
      }
    }
    if (!this.active) {
      c.fillStyle = 'rgba(16,16,20,0.45)';
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      if (blink) this.drawText('press e to play', 22, 64, 3.4, '#d8dce0');
    }
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.canvas.remove();
  }
}
