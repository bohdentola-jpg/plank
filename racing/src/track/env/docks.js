// Docks at night: an industrial harbor. Container stacks in faded liveries
// form canyons, ship-to-shore cranes straddle the quay, hulls sit moored in
// black water, warehouses show roll-up doors and the odd lit window, a rail
// spur crosses the road and oil tanks loom over a hairpin — all under sodium
// flood-light masts, with the city glittering across the bay.
// Scenery hints come from def.docks (see defs/docks.js).
import * as THREE from 'three';
import { stripMesh, glowMaterial } from '../build.js';
import { buildCenterline, smoothArray } from '../path.js';
import { concreteTexture, groundTexture, facadeTextures, toTex, glowTexture, streakTexture } from '../textures.js';
import { GeoBuilder, skyline, instanced } from './common.js';
import { makeRng, nextFrame, clamp } from '../../core/util.js';

export const terrain = false;

const WATER_Y = -3.4;   // harbor water (quay top = 0)
const GROUND_Y = -0.3;  // yard slab, below the road
const SODIUM = '#ff9a42';
const HALIDE = '#d8e4ff';
const WARM = '#ffc27a';
const C40 = 12.19, C20 = 6.06, CW = 2.44, CH = 2.59; // ISO container
// wall distance past the road edge per roadside kit
const KIT_WALL = { stack: 2.6, water: 4.2, shed: 3.4, rail: 3.0, fence: 3.0, tank: 2.6, open: 4.5 };
const FENCED = { rail: 1, fence: 1 };

// ------------------------------------------------------------------ textures

const texCache = new Map();
const cachedTex = (key, fn) => { if (!texCache.has(key)) texCache.set(key, fn()); return texCache.get(key); };
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function speckle(x, x0, y0, w, h, rng, n, a = 0.18, size = 1) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${rng() * a})` : `rgba(0,0,0,${rng() * a})`;
    x.fillRect(x0 + rng() * w, y0 + rng() * h, size, size);
  }
}
function blot(x, px, py, r, rgba) {
  const g = x.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, rgba);
  g.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)'));
  x.fillStyle = g;
  x.fillRect(px - r, py - r, r * 2, r * 2);
}
/** Rust streaks running down from y0, plus blotches near edges. */
function weather(x, x0, y0, w, h, rng, amount = 1) {
  for (let i = 0; i < 26 * amount; i++) {
    const px = x0 + rng() * w, py = y0 + (rng() < 0.6 ? rng() * h * 0.15 : rng() * h), len = 8 + rng() * h * 0.7;
    const g = x.createLinearGradient(0, py, 0, py + len);
    g.addColorStop(0, `rgba(${90 + rng() * 40},${40 + rng() * 20},${15 + rng() * 10},${0.2 + rng() * 0.3})`);
    g.addColorStop(1, 'rgba(60,30,10,0)');
    x.fillStyle = g;
    x.fillRect(px, py, 1 + rng() * 2.5, len);
  }
  for (let i = 0; i < 18 * amount; i++) {
    const edge = rng() < 0.5;
    blot(x, x0 + (edge ? (rng() < 0.5 ? rng() * 14 : w - rng() * 14) : rng() * w), y0 + (rng() < 0.5 ? h - rng() * 12 : rng() * h), 2 + rng() * 9, `rgba(${100 + rng() * 40},${45 + rng() * 25},${18},${0.25 + rng() * 0.35})`);
  }
  const g = x.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.addColorStop(0.8, 'rgba(20,16,12,0)');
  g.addColorStop(1, 'rgba(20,16,12,0.45)');
  x.fillStyle = g;
  x.fillRect(x0, y0, w, h);
}

/** Ballast with sleepers: u across the bed (3.8 m), one tile = 2.6 m along (4 sleepers). */
function trackbedTexture() {
  return cachedTex('trackbed', () => {
    const c = cnv(128, 256);
    const x = c.getContext('2d');
    const rng = makeRng('trackbed');
    x.fillStyle = '#5d5952';
    x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 2600; i++) { const v = 60 + rng() * 90; x.fillStyle = `rgba(${v},${v * 0.96},${v * 0.9},0.6)`; x.fillRect(rng() * 128, rng() * 256, 1 + rng() * 2, 1 + rng() * 2); }
    for (let k = 0; k < 4; k++) {
      const y = k * 64 + 20;
      x.fillStyle = '#3b3029';
      x.fillRect(8, y, 112, 16);
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.fillRect(8, y + 13, 112, 3);
      x.fillStyle = 'rgba(255,255,255,0.06)';
      x.fillRect(8, y, 112, 2);
    }
    for (let i = 0; i < 8; i++) blot(x, rng() * 128, rng() * 256, 6 + rng() * 14, 'rgba(25,20,15,0.35)');
    return toTex(c);
  });
}

// liveries: base, logo, logo color, emblem (fictional lines)
const SKINS = [
  ['#3b7ca6', 'NORDSKY', '#eef2f5', 'star'],
  ['#8a3422', 'KAITO', '#efe9df', 'wave'],
  ['#787d81', 'PELAGIC', '#203c6a', 'ring'],
  ['#c4621f', 'HALCYON', '#fbf3e6', 'bird'],
  ['#2d5a40', 'CORVUS', '#ecefe8', 'tri'],
  ['#1f3157', 'OSTRANDER', '#e6ebf3', 'bar'],
  ['#b0892d', 'VANTERRA', '#1b1b1b', 'none'],
  ['#d5d3c9', 'REEFLINE', '#2a4a8a', 'reefer'],
];
const SKIN_W = [1.2, 1.3, 1.1, 0.9, 0.8, 1.0, 0.7, 0.6];

/** 1024² atlas: 8 livery rows × [40ft side 640px | 20ft side 256px | doors 128px]. */
function containerAtlas() {
  return cachedTex('containers', () => {
    const c = cnv(1024, 1024);
    const x = c.getContext('2d');
    const rng = makeRng('container-atlas');
    const code = () => 'ABCDEFGHJKLMNPRSTUVWXZ'[Math.floor(rng() * 22)];
    SKINS.forEach(([base, logo, lc, emb], r) => {
      const y0 = r * 128;
      const owner = (logo.slice(0, 3) + 'U').toUpperCase();
      const side = (x0, w, big) => {
        x.fillStyle = base;
        x.fillRect(x0, y0, w, 128);
        // repaint patches
        for (let k = 0; k < 3; k++) {
          x.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
          x.fillRect(x0 + rng() * w, y0 + 10 + rng() * 80, 20 + rng() * 60, 14 + rng() * 40);
        }
        // corrugation
        const pitch = emb === 'reefer' ? 5 : 9;
        for (let px = x0 + 8; px < x0 + w - 8; px += pitch) {
          x.fillStyle = 'rgba(255,255,255,0.11)';
          x.fillRect(px, y0, 2, 128);
          x.fillStyle = 'rgba(0,0,0,0.2)';
          x.fillRect(px + Math.ceil(pitch / 2), y0, 2, 128);
        }
        // logo
        if (emb !== 'reefer' || big) {
          const fs = big ? 50 : 30;
          x.font = `900 ${fs}px Arial Black, Arial, sans-serif`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillStyle = lc;
          x.globalAlpha = 0.85;
          const cx = x0 + w / 2 + (emb !== 'none' ? fs * 0.45 : 0);
          x.fillText(logo, cx, y0 + 66, w - 70);
          const ex = cx - Math.min(w - 70, x.measureText(logo).width) / 2 - fs * 0.75, ey = y0 + 66;
          x.strokeStyle = lc;
          x.lineWidth = big ? 5 : 3;
          x.beginPath();
          if (emb === 'star') { for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? fs * 0.22 : fs * 0.5; x.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); } x.closePath(); x.fill(); }
          if (emb === 'ring') { x.arc(ex, ey, fs * 0.42, 0, Math.PI * 2); x.stroke(); }
          if (emb === 'tri') { x.moveTo(ex, ey - fs * 0.45); x.lineTo(ex + fs * 0.45, ey + fs * 0.4); x.lineTo(ex - fs * 0.45, ey + fs * 0.4); x.closePath(); x.fill(); }
          if (emb === 'wave') { for (let k = 0; k < 3; k++) { x.moveTo(ex - fs * 0.5, ey - fs * 0.25 + k * fs * 0.25); x.bezierCurveTo(ex - fs * 0.2, ey - fs * 0.45 + k * fs * 0.25, ex + fs * 0.2, ey - fs * 0.05 + k * fs * 0.25, ex + fs * 0.5, ey - fs * 0.25 + k * fs * 0.25); } x.stroke(); }
          if (emb === 'bird') { x.moveTo(ex - fs * 0.5, ey); x.quadraticCurveTo(ex - fs * 0.2, ey - fs * 0.45, ex, ey); x.quadraticCurveTo(ex + fs * 0.2, ey - fs * 0.45, ex + fs * 0.5, ey); x.stroke(); }
          if (emb === 'bar') { x.fillRect(ex - fs * 0.5, ey - fs * 0.3, fs, fs * 0.18); x.fillRect(ex - fs * 0.5, ey + fs * 0.1, fs, fs * 0.18); }
          x.globalAlpha = 1;
        }
        // ID code + plates
        x.font = 'bold 11px Arial, sans-serif';
        x.textAlign = 'right';
        x.fillStyle = emb === 'reefer' || emb === 'none' ? '#202020' : '#e8e8e8';
        x.fillText(`${owner} ${Math.floor(100000 + rng() * 899999)} ${Math.floor(rng() * 10)}`, x0 + w - 14, y0 + 20);
        x.fillText(rng() < 0.5 ? '45G1' : '42G1', x0 + w - 14, y0 + 33);
        x.fillStyle = 'rgba(230,230,225,0.7)';
        x.fillRect(x0 + 16, y0 + 92, 16, 12);
        weather(x, x0, y0, w, 128, rng, big ? 1.4 : 0.8);
        // rails + corner posts
        x.fillStyle = 'rgba(0,0,0,0.38)';
        x.fillRect(x0, y0, w, 6);
        x.fillRect(x0, y0 + 121, w, 7);
        x.fillStyle = 'rgba(0,0,0,0.3)';
        x.fillRect(x0, y0, 7, 128);
        x.fillRect(x0 + w - 7, y0, 7, 128);
        speckle(x, x0, y0, w, 128, rng, w * 4, 0.16);
      };
      side(0, 640, true);
      side(640, 256, false);
      // doors
      const d0 = 896;
      x.fillStyle = base;
      x.fillRect(d0, y0, 128, 128);
      if (emb === 'reefer') {
        // refrigeration unit: grille + fans
        x.fillStyle = '#3a3d40';
        x.fillRect(d0 + 10, y0 + 10, 108, 108);
        for (let k = 0; k < 2; k++) { x.fillStyle = '#1a1c1e'; x.beginPath(); x.arc(d0 + 64, y0 + 38 + k * 46, 18, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#555'; x.lineWidth = 2; for (let a = 0; a < 6; a++) { x.beginPath(); x.moveTo(d0 + 64, y0 + 38 + k * 46); x.lineTo(d0 + 64 + Math.cos(a) * 16, y0 + 38 + k * 46 + Math.sin(a) * 16); x.stroke(); } }
        x.fillStyle = '#9fb8c0';
        x.fillRect(d0 + 14, y0 + 100, 22, 12);
      } else {
        for (let px = d0 + 8; px < d0 + 120; px += 6) { x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(px, y0, 2, 128); }
        x.fillStyle = 'rgba(0,0,0,0.6)';
        x.fillRect(d0 + 63, y0, 2, 128);
        x.fillStyle = 'rgba(200,200,195,0.75)';
        for (const bx of [22, 48, 80, 106]) { x.fillRect(d0 + bx, y0 + 6, 2, 116); x.fillRect(d0 + bx - 3, y0 + 60, 8, 4); }
        x.fillStyle = 'rgba(0,0,0,0.5)';
        for (const hy of [16, 48, 80, 110]) { x.fillRect(d0 + 7, y0 + hy, 5, 6); x.fillRect(d0 + 116, y0 + hy, 5, 6); }
        x.font = 'bold 9px Arial, sans-serif';
        x.textAlign = 'left';
        x.fillStyle = emb === 'none' ? '#202020' : '#e8e8e8';
        x.fillText(`${owner} ${Math.floor(100000 + rng() * 899999)}`, d0 + 70, y0 + 22);
        x.fillText(`${code()}${code()}${code()}`, d0 + 70, y0 + 34);
      }
      weather(x, d0, y0, 128, 128, rng, 0.5);
      x.fillStyle = 'rgba(0,0,0,0.4)';
      x.fillRect(d0, y0, 128, 7);
      x.fillRect(d0, y0 + 121, 128, 7);
      x.fillRect(d0, y0, 8, 128);
      x.fillRect(d0 + 120, y0, 8, 128);
    });
    const t = toTex(c, { repeat: false });
    t.generateMipmaps = true;
    return t;
  });
}

/** Chain-link fence with a top rail and barbed wire (alpha). 3 m × 3 m tile. */
function fenceTexture() {
  return cachedTex('fence', () => {
    const c = cnv(256, 256);
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(168,172,176,0.95)';
    x.lineWidth = 1.6;
    const top = 52;
    for (let k = -256; k < 512; k += 12) {
      x.beginPath(); x.moveTo(k, top); x.lineTo(k + 204, 256); x.stroke();
      x.beginPath(); x.moveTo(k + 204, top); x.lineTo(k, 256); x.stroke();
    }
    x.fillStyle = 'rgba(120,124,128,1)';
    x.fillRect(0, top - 6, 256, 7);
    x.fillRect(0, 250, 256, 6);
    // barbed wire
    x.strokeStyle = 'rgba(140,140,140,1)';
    x.lineWidth = 1.5;
    for (const wy of [10, 24, 38]) {
      x.beginPath(); x.moveTo(0, wy); x.lineTo(256, wy + 1); x.stroke();
      for (let k = 6; k < 256; k += 16) { x.beginPath(); x.moveTo(k - 3, wy - 3); x.lineTo(k + 3, wy + 3); x.moveTo(k + 3, wy - 3); x.lineTo(k - 3, wy + 3); x.stroke(); }
    }
    const t = toTex(c);
    return t;
  });
}

/** Weathered jersey barrier: concrete with seams every tile, chipped paint stripe. */
function barrierTexture() {
  return cachedTex('jersey', () => {
    const c = cnv(256, 64);
    const x = c.getContext('2d');
    const rng = makeRng('jersey');
    x.fillStyle = '#9b9890';
    x.fillRect(0, 0, 256, 64);
    speckle(x, 0, 0, 256, 64, rng, 4000, 0.22);
    for (let i = 0; i < 12; i++) blot(x, rng() * 256, rng() * 64, 4 + rng() * 14, 'rgba(40,36,30,0.25)');
    // hazard stripe band near the top (faded)
    for (let k = 0; k < 256; k += 32) {
      x.fillStyle = 'rgba(214,170,40,0.55)';
      x.beginPath(); x.moveTo(k, 40); x.lineTo(k + 16, 40); x.lineTo(k + 24, 50); x.lineTo(k + 8, 50); x.fill();
    }
    x.fillStyle = 'rgba(25,25,25,0.4)';
    x.fillRect(0, 40, 256, 1);
    x.fillRect(0, 50, 256, 1);
    // tire scuffs low down
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(10,10,10,${0.2 + rng() * 0.3})`; x.fillRect(rng() * 256, 6 + rng() * 10, 20 + rng() * 60, 2 + rng() * 3); }
    // unit seams
    x.fillStyle = 'rgba(15,15,15,0.8)';
    x.fillRect(0, 0, 3, 64);
    x.fillRect(128, 0, 3, 64);
    return toTex(c);
  });
}

/** Dark concrete quay face: wet streaks, weed line at the water. */
function quayTexture() {
  return cachedTex('quay', () => {
    const c = cnv(256, 128);
    const x = c.getContext('2d');
    const rng = makeRng('quayface');
    x.fillStyle = '#56544e';
    x.fillRect(0, 0, 256, 128);
    speckle(x, 0, 0, 256, 128, rng, 5000, 0.25);
    for (let i = 0; i < 30; i++) {
      const px = rng() * 256, g = x.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(20,18,15,0)');
      g.addColorStop(1, `rgba(20,18,15,${0.3 + rng() * 0.4})`);
      x.fillStyle = g;
      x.fillRect(px, rng() * 60, 2 + rng() * 6, 128);
    }
    x.fillStyle = 'rgba(30,45,25,0.7)';
    x.fillRect(0, 100, 256, 28);
    x.fillStyle = 'rgba(0,0,0,0.45)';
    for (let k = 0; k < 256; k += 64) x.fillRect(k, 0, 2, 128);
    return toTex(c);
  });
}

/**
 * Warehouse facade atlas: 8×2 bays of 6 m × 12 m (128×256 px), drawn on light
 * neutral paint so vertex colors can tint each shed. Returns { map, emi }.
 *   0 wall · 1 roll-up · 2 roll-up half open (lit) · 3 office lit · 4 personnel door
 *   5 wall + hazard base · 6 roll-up rusty · 7 clerestory lit · 8 wall rusty
 *   9 dock door · 10 louvres · 11 office dark · 12 open dark · 13 shed number
 *   14 roll-up + NO PARKING · 15 wall dented
 */
function shedAtlas() {
  return cachedTex('sheds', () => {
    const c = cnv(1024, 512), e = cnv(1024, 512);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, 1024, 512);
    const rng = makeRng('shed-atlas');
    const M = 128 / 6; // px per meter
    const Y = (y0, m) => y0 + 256 - m * M; // meters above ground → canvas y
    const rollup = (x0, y0, color, open, litIn) => {
      const dx = x0 + 0.5 * M, dw = 5 * M, top = Y(y0, 5.2);
      x.fillStyle = '#2a2b2d';
      x.fillRect(dx - 4, top - 10, dw + 8, 5.2 * M + 10);
      x.fillStyle = color;
      const openH = open * 5.2 * M;
      x.fillRect(dx, top, dw, 5.2 * M - openH);
      for (let y = top; y < top + 5.2 * M - openH; y += 4) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(dx, y, dw, 1); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(dx, y + 2, dw, 1); }
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.fillRect(dx, top - 9, dw, 8);
      if (open > 0) {
        const iy = top + 5.2 * M - openH;
        x.fillStyle = litIn ? '#6b5233' : '#0d0e10';
        x.fillRect(dx, iy, dw, openH);
        if (litIn) {
          const g = ex.createLinearGradient(0, iy, 0, iy + openH);
          g.addColorStop(0, '#5a4024');
          g.addColorStop(1, '#d8a060');
          ex.fillStyle = g;
          ex.fillRect(dx, iy, dw, openH);
          x.fillStyle = 'rgba(30,20,10,0.8)';
          for (let k = 0; k < 4; k++) { const pw = 10 + rng() * 14, ph = 8 + rng() * (openH - 8); x.fillRect(dx + 6 + rng() * (dw - 30), iy + openH - ph, pw, ph); ex.fillStyle = 'rgba(0,0,0,0.8)'; ex.fillRect(dx + 6 + rng() * (dw - 30), iy + openH - ph, pw, ph); }
        }
      }
    };
    const windows = (x0, y0, lit, rows) => {
      for (const [m0, m1] of rows) {
        for (let k = 0; k < 2; k++) {
          const wx = x0 + (0.5 + k * 2.75) * M, wy = Y(y0, m1), ww = 2.5 * M, wh = (m1 - m0) * M;
          x.fillStyle = '#3a3c3e';
          x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
          const on = lit && rng() < 0.7;
          const warm = rng() < 0.6;
          x.fillStyle = on ? (warm ? '#e9d8a8' : '#cfe0ee') : `rgb(${16 + rng() * 14},${22 + rng() * 14},${30 + rng() * 16})`;
          x.fillRect(wx, wy, ww, wh);
          x.fillStyle = 'rgba(0,0,0,0.5)';
          x.fillRect(wx + ww / 2 - 1, wy, 2, wh);
          if (on) {
            ex.fillStyle = warm ? '#ffd890' : '#c0dcff';
            ex.globalAlpha = 0.45 + rng() * 0.4;
            ex.fillRect(wx, wy, ww, wh);
            ex.globalAlpha = 1;
            if (rng() < 0.5) { x.fillStyle = 'rgba(40,30,20,0.35)'; x.fillRect(wx, wy, ww, wh * 0.35); }
          }
        }
      }
    };
    for (let t = 0; t < 16; t++) {
      const x0 = (t % 8) * 128, y0 = Math.floor(t / 8) * 256;
      x.fillStyle = '#bdbbb3';
      x.fillRect(x0, y0, 128, 256);
      // vertical ribs of the cladding
      for (let px = x0; px < x0 + 128; px += 6) { x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(px, y0, 2, 256); x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(px + 3, y0, 2, 256); }
      // concrete plinth + gutter
      x.fillStyle = '#7c7a74';
      x.fillRect(x0, Y(y0, 1.0), 128, 1.0 * M);
      x.fillStyle = 'rgba(0,0,0,0.4)';
      x.fillRect(x0, Y(y0, 1.0), 128, 2);
      x.fillRect(x0, y0, 128, 4);
      if (t === 1 || t === 14) rollup(x0, y0, '#7d8a96', 0, false);
      if (t === 2) rollup(x0, y0, '#7d8a96', 0.42, true);
      if (t === 6) rollup(x0, y0, '#9a5a3a', 0, false);
      if (t === 9) { x.fillStyle = '#111'; x.fillRect(x0 + 0.3 * M, Y(y0, 5.6), 5.4 * M, 4.6 * M); rollup(x0, y0, '#8a8f94', 0, false); }
      if (t === 12) rollup(x0, y0, '#6d7780', 0.55, false);
      if (t === 3) windows(x0, y0, true, [[1.3, 2.7], [4.6, 6.0]]);
      if (t === 11) windows(x0, y0, false, [[1.3, 2.7], [4.6, 6.0]]);
      if (t === 7) windows(x0, y0, true, [[8.6, 9.6]]);
      if (t === 4) {
        x.fillStyle = '#34465a';
        x.fillRect(x0 + 2 * M, Y(y0, 2.2), 1.1 * M, 2.2 * M);
        x.fillStyle = '#ddd';
        x.fillRect(x0 + 2.95 * M, Y(y0, 1.1), 3, 3);
        x.fillStyle = '#ffd890';
        x.fillRect(x0 + 2.3 * M, Y(y0, 2.8), 12, 6);
        ex.fillStyle = '#ffd890';
        ex.fillRect(x0 + 2.3 * M, Y(y0, 2.8), 12, 6);
        x.fillStyle = '#204a8a';
        x.fillRect(x0 + 3.6 * M, Y(y0, 2.4), 1.6 * M, 0.9 * M);
        x.fillStyle = '#fff';
        x.font = 'bold 9px Arial, sans-serif';
        x.fillText('OFFICE', x0 + 3.68 * M, Y(y0, 1.85));
      }
      if (t === 5 || t === 14) {
        for (let k = 0; k < 128; k += 16) { x.fillStyle = '#d4a425'; x.beginPath(); x.moveTo(x0 + k, Y(y0, 1.0)); x.lineTo(x0 + k + 8, Y(y0, 1.0)); x.lineTo(x0 + k + 16, Y(y0, 0.2)); x.lineTo(x0 + k + 8, Y(y0, 0.2)); x.fill(); }
      }
      if (t === 14) { x.fillStyle = '#c9c9c4'; x.font = 'bold 11px Arial, sans-serif'; x.fillText('NO PARKING', x0 + 26, Y(y0, 6.3)); }
      if (t === 10) for (let k = 0; k < 2; k++) { x.fillStyle = '#5a5c5e'; x.fillRect(x0 + (0.8 + k * 2.6) * M, Y(y0, 9.5), 2 * M, 1.6 * M); for (let y = 0; y < 1.6 * M; y += 4) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(x0 + (0.8 + k * 2.6) * M, Y(y0, 9.5) + y, 2 * M, 2); } }
      if (t === 13) { x.fillStyle = 'rgba(30,40,60,0.75)'; x.font = '900 120px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.fillText(String(3 + Math.floor(rng() * 14)), x0 + 64, Y(y0, 4.5)); x.textAlign = 'left'; }
      if (t === 15) for (let k = 0; k < 5; k++) blot(x, x0 + rng() * 128, y0 + 150 + rng() * 90, 6 + rng() * 10, 'rgba(0,0,0,0.25)');
      weather(x, x0, y0, 128, 256, rng, t === 8 ? 2.2 : 0.8);
    }
    return { map: toTex(c), emi: toTex(e) };
  });
}

function roofTexture() {
  return cachedTex('roof', () => {
    const c = cnv(128, 128);
    const x = c.getContext('2d');
    const rng = makeRng('roof');
    x.fillStyle = '#56585a';
    x.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 128; k += 8) { x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(k, 0, 2, 128); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(k + 4, 0, 2, 128); }
    for (let i = 0; i < 10; i++) blot(x, rng() * 128, rng() * 128, 6 + rng() * 18, 'rgba(110,60,25,0.3)');
    speckle(x, 0, 0, 128, 128, rng, 2000, 0.2);
    return toTex(c);
  });
}

/** Oil tank shell: painted plates, rust runs, logo band. One tile = 40 m around. */
function tankTexture() {
  return cachedTex('tank', () => {
    const c = cnv(512, 256);
    const x = c.getContext('2d');
    const rng = makeRng('tank');
    x.fillStyle = '#c6c3ba';
    x.fillRect(0, 0, 512, 256);
    for (let y = 0; y < 256; y += 32) {
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.fillRect(0, y, 512, 1.5);
      for (let k = (y / 32) % 2 ? 0 : 48; k < 512; k += 96) x.fillRect(k, y, 1.5, 32);
    }
    x.fillStyle = '#8e2a20';
    x.fillRect(0, 150, 512, 22);
    x.fillStyle = '#1e3a68';
    x.font = '900 46px Arial Black, Arial, sans-serif';
    x.textAlign = 'center';
    x.fillText('KESTREL', 180, 130);
    x.font = 'bold 22px Arial, sans-serif';
    x.fillStyle = '#f2efe6';
    x.fillText('KESTREL PETROLEUM · NO SMOKING', 256, 168);
    x.fillStyle = '#1e3a68';
    x.font = '900 40px Arial Black, Arial, sans-serif';
    x.fillText('No.' + (2 + Math.floor(rng() * 7)), 420, 120);
    weather(x, 0, 0, 512, 256, rng, 3);
    speckle(x, 0, 0, 512, 256, rng, 9000, 0.14);
    return toTex(c);
  });
}

/** Hull sides, one 256 px row per ship: hull color, boot-top, name, draft marks, rust. */
function hullAtlas(ships) {
  const key = 'hull|' + ships.map((s) => s[5]).join(',');
  return cachedTex(key, () => {
    const c = cnv(1024, 1024);
    const x = c.getContext('2d');
    const rng = makeRng(key);
    const names = [['KAITO LINES', 'KAITO HARMONY'], ['NORDSKY', 'NORDSKY VEGA'], ['OSTRANDER', 'OSTRANDER BAY'], ['PELAGIC', 'PELAGIC DAWN']];
    for (let r = 0; r < 4; r++) {
      const y0 = r * 256;
      x.fillStyle = ships[r]?.[5] || '#22262a';
      x.fillRect(0, y0, 1024, 256);
      for (let k = 0; k < 1024; k += 34) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(k, y0, 1.5, 256); }
      x.fillStyle = '#6e1d16';
      x.fillRect(0, y0 + 218, 1024, 38);
      x.fillStyle = 'rgba(255,255,255,0.75)';
      x.fillRect(0, y0, 1024, 5);
      const [big, name] = names[r];
      x.font = '900 92px Arial Black, Arial, sans-serif';
      x.textAlign = 'center';
      x.fillStyle = 'rgba(236,236,230,0.9)';
      x.fillText(big, 520, y0 + 140, 640);
      x.font = 'bold 30px Arial, sans-serif';
      x.fillText(name, 930, y0 + 60);
      x.fillText(name, 95, y0 + 60);
      x.font = 'bold 14px Arial, sans-serif';
      for (const dx of [26, 1000]) for (let m = 0; m < 6; m++) x.fillText(String(4 + m * 2), dx, y0 + 244 - m * 30);
      weather(x, 0, y0, 1024, 256, rng, 5);
      // hawse pipe rust run near the bow
      const g = x.createLinearGradient(0, y0 + 40, 0, y0 + 230);
      g.addColorStop(0, 'rgba(120,55,20,0.75)');
      g.addColorStop(1, 'rgba(120,55,20,0)');
      x.fillStyle = g;
      x.fillRect(975, y0 + 40, 10, 190);
      x.fillStyle = '#111';
      x.beginPath(); x.arc(980, y0 + 40, 7, 0, Math.PI * 2); x.fill();
    }
    return toTex(c, { repeat: false });
  });
}

/** Ship accommodation block: white decks with window rows (10 m tile). */
function deckhouseTextures() {
  return cachedTex('deckhouse', () => {
    const c = cnv(256, 256), e = cnv(256, 256);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('deckhouse');
    x.fillStyle = '#d9d8d0';
    x.fillRect(0, 0, 256, 256);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 4; r++) {
      const y = r * 64 + 22;
      x.fillStyle = 'rgba(0,0,0,0.15)';
      x.fillRect(0, r * 64 + 60, 256, 3);
      for (let k = 0; k < 7; k++) {
        const wx = 10 + k * 35, on = rng() < 0.45;
        x.fillStyle = on ? '#efe2b8' : '#1c2630';
        x.fillRect(wx, y, 20, 16);
        if (on) { ex.fillStyle = '#ffdca0'; ex.globalAlpha = 0.6 + rng() * 0.4; ex.fillRect(wx, y, 20, 16); ex.globalAlpha = 1; }
      }
    }
    weather(x, 0, 0, 256, 256, rng, 0.8);
    return { map: toTex(c), emi: toTex(e) };
  });
}

// boards: shed numbers 0–7, then port signage
const SIGNS = [
  ['SHED 2'], ['SHED 5'], ['SHED 7'], ['SHED 9'], ['SHED 11'], ['SHED 14'], ['SHED 17'], ['SHED 21'],
  ['PIER 9', '#1d4f8f'], ['BERTH 4', '#1d4f8f'], ['DANGER · CONTAINER HANDLING', '#d8a823', '#111'], ['SPEED LIMIT 15', '#e8e8e2', '#111'],
  ['HALCYON PORT AUTHORITY', '#20262e'], ['KESTREL PETROLEUM', '#8e2a20'], ['NO UNAUTHORISED ENTRY', '#b22a1e'], ['CUSTOMS · BONDED STORE', '#2a4a3a'],
];
function signAtlas() {
  return cachedTex('signs', () => {
    const c = cnv(1024, 512);
    const x = c.getContext('2d');
    const rng = makeRng('signs');
    SIGNS.forEach(([text, bg = '#244a7a', fg = '#f2f2ee'], k) => {
      const x0 = (k % 2) * 512, y0 = Math.floor(k / 2) * 64;
      x.fillStyle = bg;
      x.fillRect(x0, y0, 512, 64);
      x.strokeStyle = fg;
      x.lineWidth = 3;
      x.strokeRect(x0 + 6, y0 + 6, 500, 52);
      x.fillStyle = fg;
      x.font = `900 ${text.length > 14 ? 30 : 40}px Arial Black, Arial, sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(text, x0 + 256, y0 + 34, 480);
      weather(x, x0, y0, 512, 64, rng, 0.6);
    });
    return toTex(c, { repeat: false });
  });
}
const signUV = (k) => { const u0 = (k % 2) / 2, v1 = 1 - Math.floor(k / 2) / 8; return [u0 + 0.002, v1 - 0.125 + 0.004, u0 + 0.498, v1 - 0.004]; };

/** Sign board facing (fx, fz) centered at (x, y, z), w × h meters. */
function board(X, x, y, z, fx, fz, w, h, k) {
  const rx = fz, rz = -fx;
  wallQuad(X.G.sign, x - rx * w / 2 + fx * 0.06, z - rz * w / 2 + fz * 0.06, x + rx * w / 2 + fx * 0.06, z + rz * w / 2 + fz * 0.06, y - h / 2, y + h / 2, signUV(k));
  X.G.steel.setColor(0.2, 0.21, 0.22);
  X.G.steel.box(x, y - h / 2 - 0.05, z, w + 0.2, h + 0.1, 0.1, Math.atan2(-rz, rx));
}

/** Soft rubber strip for skid marks (alpha across u). */
function skidTexture() {
  return cachedTex('skid', () => {
    const c = cnv(32, 64);
    const x = c.getContext('2d');
    const rng = makeRng('skid');
    for (let px = 0; px < 32; px++) {
      const a = Math.sin((px / 31) * Math.PI) ** 0.7;
      for (let py = 0; py < 64; py++) { x.fillStyle = `rgba(0,0,0,${a * (0.55 + rng() * 0.45)})`; x.fillRect(px, py, 1, 1); }
    }
    return toTex(c);
  });
}

// ------------------------------------------------------------------ geometry helpers

/**
 * Container at base center (x, y, z), long axis rotated by ry. row: livery
 * 0–7; tiers > 1 makes a whole stack in one box (consecutive liveries).
 * faces: bitmask +z −z +x −x top.
 */
function containerBox(gb, x, y, z, ry, row, len, faces = 31, tiers = 1) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const hl = len / 2, hw = CW / 2, h = CH * tiers;
  const P = (lx, ly, lz) => new THREE.Vector3(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
  const v0 = 1 - (row + tiers) / 8 + 0.002, v1 = 1 - row / 8 - 0.002;
  const side = len > 8 ? [0.002, v0, 0.623, v1] : [0.627, v0, 0.873, v1];
  const end = [0.877, v0, 0.998, v1];
  if (faces & 1) gb.quad(P(-hl, 0, hw), P(hl, 0, hw), P(hl, h, hw), P(-hl, h, hw), side);
  if (faces & 2) gb.quad(P(hl, 0, -hw), P(-hl, 0, -hw), P(-hl, h, -hw), P(hl, h, -hw), side);
  if (faces & 4) gb.quad(P(hl, 0, hw), P(hl, 0, -hw), P(hl, h, -hw), P(hl, h, hw), end);
  if (faces & 8) gb.quad(P(-hl, 0, -hw), P(-hl, 0, hw), P(-hl, h, hw), P(-hl, h, -hw), end);
  const vt = 1 - (row + 1) / 8 + 0.004;
  if (faces & 16) gb.quad(P(-hl, h, hw), P(hl, h, hw), P(hl, h, -hw), P(-hl, h, -hw), [side[0], vt, side[2], vt + 0.03]);
}

/** Quad with its winding fixed so the normal points along (ox, oy, oz). */
function quadOut(gb, a, b, c, d, uv, ox, oy, oz) {
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
  if (n.x * ox + n.y * oy + n.z * oz < 0) gb.quad(b, a, d, c, uv ? [uv[2], uv[1], uv[0], uv[3]] : undefined);
  else gb.quad(a, b, c, d, uv || undefined);
}

/** Wall panel seen from outside: (x0,z0) left → (x1,z1) right, outward normal. */
function wallQuad(gb, x0, z0, x1, z1, yb, yt, uv) {
  gb.quad(new THREE.Vector3(x0, yb, z0), new THREE.Vector3(x1, yb, z1), new THREE.Vector3(x1, yt, z1), new THREE.Vector3(x0, yt, z0), uv);
}

/** Tube (prism) between two points. */
function tube(gb, A, B, r, seg = 8) {
  const d = new THREE.Vector3().subVectors(B, A).normalize();
  const up = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(d, up).normalize(), v = new THREE.Vector3().crossVectors(u, d).normalize();
  const at = (P, a) => P.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r);
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
    gb.quad(at(A, a0), at(A, a1), at(B, a1), at(B, a0), [k / seg, 0, (k + 1) / seg, 1]);
  }
}

/** Oriented box between two points (beams, braces, stays); long ones split every ~8 m. */
function beam(gb, ax, ay, az, bx, by, bz, w, h = w, caps = false, split = true) {
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  if (split && len > 10) {
    const n = Math.ceil(len / 8);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      beam(gb, ax + (bx - ax) * t0, ay + (by - ay) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, az + (bz - az) * t1, w, h, caps && (k === 0 || k === n - 1));
    }
    return;
  }
  const A = new THREE.Vector3(ax, ay, az), B = new THREE.Vector3(bx, by, bz);
  const d = new THREE.Vector3().subVectors(B, A).normalize();
  const up = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const sd = new THREE.Vector3().crossVectors(d, up).normalize().multiplyScalar(w / 2);
  const u = new THREE.Vector3().crossVectors(sd, d).normalize().multiplyScalar(h / 2);
  const corner = (P, a, b) => P.clone().addScaledVector(sd, a).addScaledVector(u, b);
  const a00 = corner(A, -1, -1), a10 = corner(A, 1, -1), a11 = corner(A, 1, 1), a01 = corner(A, -1, 1);
  const b00 = corner(B, -1, -1), b10 = corner(B, 1, -1), b11 = corner(B, 1, 1), b01 = corner(B, -1, 1);
  gb.quad(a01, a11, b11, b01);
  gb.quad(a10, a00, b00, b10);
  gb.quad(a11, a10, b10, b11);
  gb.quad(a00, a01, b01, b00);
  if (caps) { gb.quad(a00, a10, a11, a01); gb.quad(b10, b00, b01, b11); }
}

/** Ring band (cylinder wall) with explicit uv repeat around. */
function ring(gb, x, y, z, r, h, seg, uRep = 1, r2 = r, inward = false) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const A = new THREE.Vector3(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r);
    const B = new THREE.Vector3(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r);
    const C = new THREE.Vector3(x + Math.cos(a1) * r2, y + h, z + Math.sin(a1) * r2);
    const D = new THREE.Vector3(x + Math.cos(a0) * r2, y + h, z + Math.sin(a0) * r2);
    const uv = [(i / seg) * uRep, 0, ((i + 1) / seg) * uRep, 1];
    // outside: angle grows to the viewer's left, so u runs the other way
    if (inward) gb.quad(A, B, C, D, uv); else gb.quad(B, A, D, C, [-uv[2], 0, -uv[0], 1]);
  }
}

function meshOf(gb, mat, color = false) {
  const m = new THREE.Mesh(gb.build(color), mat);
  m.matrixAutoUpdate = false;
  return m;
}

// ------------------------------------------------------------------ light

/** Per-vertex light from lamps with a facing term (n·l), into a 'glow' attribute. */
function bakeLit(meshes, lamps) {
  const cell = 40;
  const grid = new Map();
  for (const L of lamps) {
    const r = L.radius;
    for (let cx = Math.floor((L.x - r) / cell); cx <= Math.floor((L.x + r) / cell); cx++) {
      for (let cz = Math.floor((L.z - r) / cell); cz <= Math.floor((L.z + r) / cell); cz++) {
        const k = cx * 65536 + cz;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(L);
      }
    }
  }
  for (const m of meshes) {
    const g = m.geometry;
    const p = g.attributes.position, n = g.attributes.normal;
    const out = new Float32Array(p.count * 3);
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
      const list = grid.get(Math.floor(x / cell) * 65536 + Math.floor(z / cell));
      if (!list) continue;
      const nx = n.getX(v), ny = n.getY(v), nz = n.getZ(v);
      let r = 0, gg = 0, b = 0;
      for (const L of list) {
        const dx = L.x - x, dz = L.z - z, d2 = dx * dx + dz * dz;
        if (d2 > L.radius * L.radius) continue;
        const dy = L.y - y;
        // same falloff as the road bake below the lamp; above it, full distance and dimmer
        const d = dy > 0 ? Math.sqrt(d2 + Math.max(1, dy) ** 2 * 0.3) : Math.sqrt(d2 + dy * dy + 1);
        const f = 1 - d / L.radius;
        if (f <= 0) continue;
        const ndl = (nx * dx + ny * dy + nz * dz) / Math.sqrt(d2 + dy * dy + 1e-4);
        const k = f * f * L.intensity * (0.18 + 0.82 * Math.max(0, ndl)) * (dy > 0 ? 1 : 0.45);
        r += L.color.r * k; gg += L.color.g * k; b += L.color.b * k;
      }
      out[v * 3] = Math.min(r, 3); out[v * 3 + 1] = Math.min(gg, 3); out[v * 3 + 2] = Math.min(b, 3);
    }
    g.setAttribute('glow', new THREE.BufferAttribute(out, 3));
  }
}

/** Camera-facing additive glows (lamp heads, warning lights), one draw call. */
function haloField(world, list, fogK = 1) {
  if (!list.length) return null;
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const n = list.length;
  const ipos = new Float32Array(n * 3), icol = new Float32Array(n * 3), iprm = new Float32Array(n * 3);
  list.forEach((h, k) => {
    const c = new THREE.Color(h.color).multiplyScalar(h.i ?? 1);
    ipos.set([h.x, h.y, h.z], k * 3);
    icol.set([c.r, c.g, c.b], k * 3);
    iprm.set([h.size, h.blink || 0, h.phase || 0], k * 3);
  });
  geo.setAttribute('ipos', new THREE.InstancedBufferAttribute(ipos, 3));
  geo.setAttribute('icol', new THREE.InstancedBufferAttribute(icol, 3));
  geo.setAttribute('iprm', new THREE.InstancedBufferAttribute(iprm, 3));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: glowTexture() }, time: { value: 0 }, fogD: { value: (world.scene.fog?.density ?? 0.002) * Math.sqrt(fogK) } },
    vertexShader: `
      attribute vec3 ipos; attribute vec3 icol; attribute vec3 iprm;
      uniform float time, fogD; varying vec2 vUv; varying vec3 vCol;
      void main(){
        vec4 mv = modelViewMatrix * vec4(ipos, 1.0);
        float d = -mv.z;
        float on = iprm.y > 0.0 ? step(0.55, fract(time / iprm.y + iprm.z)) : 1.0;
        float fog = exp(-fogD * fogD * d * d * 0.55);
        float sz = iprm.x * (1.0 + smoothstep(150.0, 900.0, d) * 1.5);
        mv.xy += position.xy * sz;
        vUv = uv; vCol = icol * on * fog * smoothstep(1.5, 6.0, d);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; varying vec2 vUv; varying vec3 vCol;
      void main(){ float a = texture2D(map, vUv).a; gl_FragColor = vec4(vCol * a * a, 1.0); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 4;
  world.add(m);
  world.animators.push((dt) => { mat.uniforms.time.value += dt; });
  return m;
}

/** Light reflections on the harbor water: shimmering streaks toward the camera. */
function waterStreaks(world, list, fogK = 1) {
  if (!list.length) return null;
  const base = new THREE.PlaneGeometry(1, 1);
  base.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const n = list.length;
  const ipos = new Float32Array(n * 3), icol = new Float32Array(n * 3), iprm = new Float32Array(n * 3);
  list.forEach((h, k) => {
    const c = new THREE.Color(h.color).multiplyScalar(h.i ?? 1);
    ipos.set([h.x, WATER_Y + 0.05, h.z], k * 3);
    icol.set([c.r, c.g, c.b], k * 3);
    iprm.set([h.w ?? 1.5, h.len ?? 1, (k * 0.618) % 1], k * 3);
  });
  geo.setAttribute('ipos', new THREE.InstancedBufferAttribute(ipos, 3));
  geo.setAttribute('icol', new THREE.InstancedBufferAttribute(icol, 3));
  geo.setAttribute('iprm', new THREE.InstancedBufferAttribute(iprm, 3));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: streakTexture() }, camPos: { value: new THREE.Vector3() }, time: { value: 0 }, fogD: { value: (world.scene.fog?.density ?? 0.002) * Math.sqrt(fogK) } },
    vertexShader: `
      attribute vec3 ipos; attribute vec3 icol; attribute vec3 iprm;
      uniform vec3 camPos; uniform float fogD; varying vec2 vUv; varying vec3 vCol; varying float vSeed;
      void main(){
        vec3 toCam = camPos - ipos; toCam.y = 0.0;
        float dist = length(toCam);
        vec3 dir = toCam / max(dist, 0.001);
        vec3 side = vec3(dir.z, 0.0, -dir.x);
        float len = min(dist * 0.8, 70.0 * iprm.y);
        float w = iprm.x * (1.0 + dist / 400.0);
        vec3 p = ipos + side * (position.x * w) + dir * (position.y * len);
        vUv = uv; vSeed = iprm.z;
        vCol = icol * exp(-fogD * fogD * dist * dist * 0.35) * smoothstep(4.0, 25.0, dist);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float time; varying vec2 vUv; varying vec3 vCol; varying float vSeed;
      float h1(float x){ return fract(sin(x * 91.17 + vSeed * 17.3) * 43758.5453); }
      void main(){
        float a = texture2D(map, vUv).a;
        float b = vUv.y * 46.0 - time * 2.2 + vSeed * 9.0;
        float sh = mix(h1(floor(b)), h1(floor(b) + 1.0), smoothstep(0.0, 1.0, fract(b)));
        float x = abs(vUv.x - 0.5) * 2.0;
        float jit = smoothstep(1.0, 0.2, x + (sh - 0.5) * 0.6);
        gl_FragColor = vec4(vCol * a * (0.25 + 1.1 * sh * sh) * jit, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 3;
  world.add(m);
  world.animators.push((dt, cam) => { mat.uniforms.time.value += dt; mat.uniforms.camPos.value.copy(cam.position); });
  return m;
}

/** Harbor water: dark, rippled, fresnel sky reflection, fogged. */
function waterMesh(world, cx, cz) {
  const at = world.at;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      deep: { value: new THREE.Color('#03070c') },
      sky: { value: new THREE.Color(at.sky[1]) },
      hor: { value: new THREE.Color(at.sky[2]).lerp(new THREE.Color(at.glowHorizon), 0.25) },
      fogColor: { value: new THREE.Color(at.fog) },
      fogD: { value: world.scene.fog?.density ?? 0.002 },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vW; varying float vD;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform vec3 deep, sky, hor, fogColor; uniform float fogD, time; varying vec3 vW; varying float vD;
      float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec2 p = vW.xz;
        float a = vn(p * 0.09 + vec2(time * 0.05, time * 0.03));
        float b = vn(p * 0.31 - vec2(time * 0.11, -time * 0.07));
        float c = vn(p * 1.3 + vec2(time * 0.2, time * 0.15));
        vec3 N = normalize(vec3((a - 0.5) * 0.3 + (b - 0.5) * 0.18 + (c - 0.5) * 0.06, 1.0, (b - 0.5) * 0.3 - (a - 0.5) * 0.12 + (c - 0.5) * 0.06));
        float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 refl = mix(hor, sky, smoothstep(0.0, 0.35, R.y));
        vec3 col = deep * (0.7 + 0.6 * b) + refl * (0.05 + fres * 0.85);
        float f = 1.0 - exp(-fogD * fogD * vD * vD);
        gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
      }`,
  });
  const g = new THREE.PlaneGeometry(9000, 9000, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(cx, WATER_Y, cz);
  m.frustumCulled = false;
  m.renderOrder = -1;
  world.add(m);
  world.animators.push((dt) => { mat.uniforms.time.value += dt; });
  return m;
}

/**
 * Reflection environment for the docks: dark sky, a ring of sodium masts, a few
 * halide crane floods and the faint glow of the city across the water (instead
 * of the city preset's neon). Cached per renderer.
 */
const envCache = new WeakMap();
function docksEnv(renderer) {
  if (!renderer) return null;
  if (envCache.has(renderer)) return envCache.get(renderer);
  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#04060b') }, hor: { value: new THREE.Color('#1a1e2a') }, bot: { value: new THREE.Color('#060606') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top, hor, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.45)) : mix(hor, bot, pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0); }',
  }));
  scene.add(dome);
  const glow = (color, i, w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(i), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.2;
    glow(k % 4 === 3 ? '#ffb070' : '#ff9a42', 6, 1.4, 0.8, Math.cos(a) * 24, 10 + (k % 3) * 3, Math.sin(a) * 24);
  }
  for (const a of [0.9, 2.6, 4.4]) glow('#d8e4ff', 5, 2.5, 0.6, Math.cos(a) * 20, 20, Math.sin(a) * 20);
  glow('#ffb070', 0.5, 70, 2.5, 0, 1.2, 32);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 100);
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  envCache.set(renderer, rt.texture);
  return rt.texture;
}

// ------------------------------------------------------------------ layout

/** Legs, roadside kits, corner centers, occupancy and placement queries. */
function layout(def, track) {
  const D = def.docks || {};
  const n = def.points.length;
  const c = buildCenterline(def);
  const anchors = c.anchorS.map((s) => s ?? 0);
  const N = track.N;
  const leg = new Int16Array(N);
  for (let i = 0; i < N; i++) {
    const s = track.S[i];
    let k = n - 1;
    for (let j = 0; j < n; j++) if (anchors[j] <= s) k = j;
    leg[i] = s < anchors[0] ? n - 1 : k;
  }
  const sides = D.sides || [];
  const kit = (i, side) => (sides[leg[i]] || ['stack', 'stack'])[side > 0 ? 0 : 1];
  const corner = (k) => {
    const i = track.idx(Math.round(anchors[k] / track.step));
    const K = track.K[i];
    if (Math.abs(K) < 1e-6) return null;
    return { x: track.X[i] + track.LX[i] / K, z: track.Z[i] + track.LZ[i] / K, r: 1 / Math.abs(K), i, left: K > 0 };
  };
  const land = D.land || [[-5000, -5000, 5000, 5000]];
  const onLand = (x, z, pad = 0) => land.some(([x0, z0, x1, z1]) => x >= x0 + pad && x <= x1 - pad && z >= z0 + pad && z <= z1 - pad);
  // occupancy (2 m cells)
  const occ = new Set();
  const OC = 2;
  const key = (x, z) => Math.floor(x / OC) * 100003 + Math.floor(z / OC);
  /** Is (x, z) at least `pad` past the road edge and clear of the wall line on its side? */
  const roadClear = (x, z, pad) => {
    const i = track.nearestIndex(x, z, 1);
    if (i < 0) return true;
    const lat = (x - track.X[i]) * track.LX[i] + (z - track.Z[i]) * track.LZ[i];
    const wall = lat > 0 ? track.WL[i] : track.WR[i];
    return track.distToRoad(x, z) > Math.max(track.W[i] + pad, wall + 0.6);
  };
  /** Footprint (center, heading ang, half length/width) clear of roads, water and other props? */
  const rectFree = (cx, cz, ang, hl, hw, pad = 3, landPad = 1) => {
    const tx = Math.sin(ang), tz = Math.cos(ang), lx = tz, lz = -tx;
    const cells = [];
    for (let a = -hl; a <= hl + 0.01; a += Math.min(OC, hl)) {
      for (let b = -hw; b <= hw + 0.01; b += Math.min(OC, Math.max(hw, 0.5))) {
        const x = cx + tx * a + lx * b, z = cz + tz * a + lz * b;
        const k = key(x, z);
        if (occ.has(k)) return null;
        cells.push(k);
      }
    }
    for (const [a, b] of [[-hl, -hw], [hl, -hw], [-hl, hw], [hl, hw], [0, 0]]) {
      const x = cx + tx * a + lx * b, z = cz + tz * a + lz * b;
      if (!roadClear(x, z, pad) || !onLand(x, z, landPad)) return null;
    }
    return cells;
  };
  const claim = (cells) => { for (const k of cells) occ.add(k); };
  const claimRect = (cx, cz, ang, hl, hw) => {
    const tx = Math.sin(ang), tz = Math.cos(ang);
    for (let a = -hl; a <= hl; a += OC) for (let b2 = -hw; b2 <= hw; b2 += OC) occ.add(key(cx + tx * a + tz * b2, cz + tz * a - tx * b2));
  };
  const claimCircle = (x, z, r) => {
    for (let a = -r; a <= r; a += OC) for (let b = -r; b <= r; b += OC) if (a * a + b * b <= r * r + OC) occ.add(key(x + a, z + b));
  };
  const at = (i, lat) => ({ x: track.X[i] + track.LX[i] * lat, z: track.Z[i] + track.LZ[i] * lat });
  return { D, n, anchors, leg, kit, corner, land, onLand, rectFree, claim, claimRect, claimCircle, roadClear, occ, key, at };
}

// ------------------------------------------------------------------ set pieces
// Every builder takes the shared context X: { world, track, L, rng, G (geometry
// accumulators), halos, refl (water streaks), wash (bake-only lamps), pool }.

const CRANE_PAINT = [
  [[0.56, 0.13, 0.09], [0.84, 0.82, 0.76]],
  [[0.17, 0.33, 0.52], [0.82, 0.82, 0.8]],
  [[0.62, 0.6, 0.55], [0.7, 0.16, 0.1]],
];

/**
 * Ship-to-shore gantry crane. Origin on the ground between the rails, a = along
 * the quay, w = toward the water (the boom reaches out over the berth).
 */
function crane(X, ox, oz, ax, az, wx, wz, style, overRoad) {
  const { G, rng, halos, refl, wash, world } = X;
  const P = (lx, ly, lz) => [ox + ax * lx + wx * lz, ly, oz + az * lx + wz * lz];
  const bm = (a, b, w, h, caps = true) => { const A = P(...a), B = P(...b); beam(G.steel, A[0], A[1], A[2], B[0], B[1], B[2], w, h ?? w, caps); };
  const [legC, girC] = CRANE_PAINT[style % CRANE_PAINT.length];
  const y0 = GROUND_Y, tip = 62, back = -30;
  const ry = Math.atan2(-az, ax);
  G.steel.setColor(...legC);
  for (const sx of [-9, 9]) for (const sz of [-15, 15]) bm([sx, y0, sz], [sx, 45, sz], 1.5);
  for (const sz of [-15, 15]) {
    bm([-9, 3, sz], [9, 3, sz], 1.0, 1.4);
    bm([-9, 42.5, sz], [9, 42.5, sz], 1.2, 1.6);
    bm([-9, 5, sz], [9, 19, sz], 0.55, 0.55, false);
    bm([9, 5, sz], [-9, 19, sz], 0.55, 0.55, false);
  }
  for (const sx of [-9, 9]) { bm([sx, 21, -15], [sx, 21, 15], 1.4, 2.6); bm([sx, 43, -15], [sx, 43, 15], 1.0, 1.4); }
  G.steel.setColor(0.18, 0.18, 0.19);
  for (const sx of [-9, 9]) for (const sz of [-15, 15]) bm([sx - 2.2, y0 + 1, sz], [sx + 2.2, y0 + 1, sz], 1.6, 1.9);
  // girders (boom + backreach), A-frame and stays
  G.steel.setColor(...girC);
  for (const gx of [-4.5, 4.5]) bm([gx, 46.6, back], [gx, 46.6, tip], 1.5, 3.0);
  for (let lz = back + 2; lz <= tip; lz += 10) bm([-4.5, 45.4, lz], [4.5, 45.4, lz], 0.45, 0.45, false);
  G.steel.setColor(...legC);
  for (const gx of [-4.5, 4.5]) {
    bm([gx, 48, -15], [gx, 76, -3], 1.1);
    bm([gx, 48, 15], [gx, 76, -3], 1.1);
  }
  bm([-5.4, 76.2, -3], [5.4, 76.2, -3], 1.3);
  G.steel.setColor(...girC);
  for (const gx of [-4.5, 4.5]) {
    bm([gx, 76, -3], [gx, 48, tip - 2], 0.3, 0.3, false);
    bm([gx, 76, -3], [gx, 48, 30], 0.3, 0.3, false);
    bm([gx, 76, -3], [gx, 48, back + 1], 0.3, 0.3, false);
  }
  // machinery house, trolley, cab, spreader
  const mh = P(0, 48, -23);
  G.steel.box(mh[0], 48, mh[2], 11.5, 6, 12, ry);
  const tz = 24 + rng() * 22;
  const tr = P(0, 48, tz);
  G.steel.box(tr[0], 47.5, tr[2], 9.5, 3, 7, ry);
  G.steel.setColor(0.12, 0.15, 0.18);
  const cab = P(0, 0, tz + 2);
  G.steel.box(cab[0], 42.5, cab[2], 2.6, 3, 3, ry);
  G.lamps.setColor(1.6, 1.5, 1.2);
  G.lamps.box(cab[0], 43.8, cab[2], 2.7, 1.0, 3.1, ry, { top: false });
  G.steel.setColor(0.25, 0.25, 0.26);
  const spY = 22 + rng() * 14;
  for (const [dx, dz] of [[-3, -1], [3, -1], [-3, 1], [3, 1]]) bm([dx, 47.5, tz + dz], [dx * 1.6, spY + 0.6, tz + dz], 0.08, 0.08, false);
  G.steel.setColor(0.75, 0.62, 0.15);
  const sp = P(0, 0, tz);
  G.steel.box(sp[0], spY, sp[2], 12.4, 0.6, 2.5, ry);
  if (rng() < 0.7) { G.cont.setColor(0.9, 0.9, 0.9); containerBox(G.cont, sp[0], spY - CH, sp[2], ry, Math.floor(rng() * 8), C40); }
  // lights: floods under the girders, warning lights
  const floodZ = overRoad ? [-9, -1, 7, 22, 38, 52] : [-6, 10, 24, 40, 54];
  for (const fz of floodZ) {
    for (const gx of [-3, 3]) {
      const f = P(gx, 0, fz);
      G.lamps.setColor(4.5, 4.6, 5);
      G.lamps.box(f[0], 44.6, f[2], 1.1, 0.25, 0.8, ry, { top: false, bottom: true });
      if (gx < 0) halos.push({ x: f[0] + ax * 3, y: 44.2, z: f[2] + az * 3, color: HALIDE, i: 2.4, size: 7 });
    }
    const c = P(0, 0, fz);
    if (fz > 16) {
      refl.push({ x: c[0], z: c[2], color: HALIDE, i: 1.5, w: 2.2, len: 1.6 });
      wash.push({ x: c[0], y: 40, z: c[2], color: new THREE.Color(HALIDE), radius: 60, intensity: 1.1 });
    } else if (overRoad) {
      world.addLamp(c[0], 43, c[2], HALIDE, 30, 0.45);
      X.pool(c[0], 15, c[2], HALIDE, 28, 1.25);
    } else {
      wash.push({ x: c[0], y: 30, z: c[2], color: new THREE.Color(HALIDE), radius: 50, intensity: 1.2 });
    }
  }
  const apex = P(0, 0, -3), tipP = P(0, 0, tip), bk = P(0, 0, back);
  const ph = rng();
  halos.push({ x: apex[0], y: 77.5, z: apex[2], color: '#ff2a18', i: 7, size: 5, blink: 1.6, phase: ph });
  halos.push({ x: tipP[0], y: 47, z: tipP[2], color: '#ff2a18', i: 6, size: 4, blink: 1.6, phase: ph + 0.3 });
  halos.push({ x: bk[0], y: 47, z: bk[2], color: '#ff2a18', i: 5, size: 3.5, blink: 1.6, phase: ph + 0.6 });
  refl.push({ x: tipP[0], z: tipP[2], color: '#ff2a18', i: 0.9, w: 1.2, len: 2.2 });
  for (const sx of [-9, 9]) for (const sz of [-15, 15]) { const q = P(sx, 0, sz); halos.push({ x: q[0], y: 2.8, z: q[2], color: '#ffae2a', i: 3, size: 1.6 }); }
  X.L.claimCircle(P(-9, 0, -15)[0], P(-9, 0, -15)[2], 3);
  X.L.claimCircle(P(9, 0, -15)[0], P(9, 0, -15)[2], 3);
  X.L.claimCircle(P(-9, 0, 15)[0], P(-9, 0, 15)[2], 3);
  X.L.claimCircle(P(9, 0, 15)[0], P(9, 0, 15)[2], 3);
}

/** Moored container ship: hull, deck cargo, accommodation, funnel, lights, lines. */
function ship(X, spec, idx) {
  const { G, rng, halos, refl, wash, world } = X;
  const [sx, sz, ry, len, B] = spec;
  const ax = Math.cos(ry), az = -Math.sin(ry), wx = Math.sin(ry), wz = Math.cos(ry);
  const P = (u, y, v) => new THREE.Vector3(sx + ax * u + wx * v, y, sz + az * u + wz * v);
  const fb = Math.max(7, len * 0.044);
  const deck = (t) => WATER_Y + fb + 2.8 * Math.max(0, (t - 0.86) / 0.14) ** 2;
  const hb = (t) => {
    if (t < 0.035) return B / 2 * (0.8 + 0.2 * t / 0.035);
    if (t < 0.68) return B / 2;
    const k = (t - 0.68) / 0.32;
    return B / 2 * Math.sqrt(Math.max(0, 1 - k ** 2.3));
  };
  const ts = [0, 0.012, 0.035, 0.08, 0.2, 0.35, 0.5, 0.62, 0.68, 0.74, 0.8, 0.85, 0.89, 0.93, 0.96, 0.98, 0.995, 1];
  const row = idx % 4;
  const vb = 1 - (row + 1) / 4 + 0.003, vt = 1 - row / 4 - 0.003;
  const bot = WATER_Y - 0.8, hullH = fb + 3.6;
  const V = (y) => vb + (vt - vb) * clamp((y - bot) / hullH, 0, 1);
  G.steel.setColor(0.2, 0.21, 0.2);
  for (let k = 0; k < ts.length - 1; k++) {
    const t0 = ts[k], t1 = ts[k + 1];
    const u0 = -len / 2 + t0 * len, u1 = -len / 2 + t1 * len;
    const h0 = hb(t0), h1 = hb(t1), d0 = deck(t0), d1 = deck(t1);
    const top = V(Math.max(d0, d1));
    // starboard (+w) reads bow-right, port mirrored so names read from the quay
    quadOut(G.hull, P(u0, bot, h0), P(u1, bot, h1), P(u1, d1, h1), P(u0, d0, h0), [t0, vb, t1, top], wx, 0, wz);
    quadOut(G.hull, P(u1, bot, -h1), P(u0, bot, -h0), P(u0, d0, -h0), P(u1, d1, -h1), [1 - t1, vb, 1 - t0, top], -wx, 0, -wz);
    quadOut(G.steel, P(u0, d0, -h0), P(u1, d1, -h1), P(u1, d1, h1), P(u0, d0, h0), null, 0, 1, 0);
  }
  quadOut(G.hull, P(-len / 2, bot, B * 0.4), P(-len / 2, bot, -B * 0.4), P(-len / 2, deck(0), -B * 0.4), P(-len / 2, deck(0), B * 0.4), [0.0, vb, 0.08, V(deck(0))], -ax, 0, -az);
  // accommodation block + bridge + funnel near the stern
  const aU0 = -len / 2 + len * 0.075, aU1 = aU0 + Math.max(10, len * 0.06);
  const aH = Math.max(12, len * 0.085), dY = deck(0.1);
  const cU = (aU0 + aU1) / 2, hw = B * 0.42;
  const C = P(cU, 0, 0);
  G.house.box(C.x, dY, C.z, aU1 - aU0, aH, hw * 2, ry, { uw: 10, uh: 10, topUv: [0, 0, 0.1, 0.1] });
  G.house.box(C.x, dY + aH, C.z, aU1 - aU0 + 1, 3.2, B + 2, ry, { uw: 10, uh: 10, topUv: [0, 0, 0.1, 0.1] });
  G.steel.setColor(0.1, 0.12, 0.14);
  const br = P(aU1 + 0.55, 0, 0);
  G.steel.box(br.x, dY + aH + 1.2, br.z, 0.15, 1.4, B * 0.9, ry);
  const fU = aU0 - 5;
  const F = P(fU, 0, 0);
  G.steel.setColor(0.62, 0.12, 0.08);
  G.steel.box(F.x, dY, F.z, 6, aH * 0.92, 7, ry);
  G.steel.setColor(0.08, 0.08, 0.08);
  G.steel.box(F.x, dY + aH * 0.92, F.z, 6.2, 2.2, 7.2, ry);
  G.steel.setColor(0.7, 0.7, 0.68);
  const m = P(cU, 0, 0);
  beam(G.steel, m.x, dY + aH + 3.2, m.z, m.x, dY + aH + 10, m.z, 0.35);
  beam(G.steel, m.x + wx * -3, dY + aH + 8, m.z + wz * -3, m.x + wx * 3, dY + aH + 8, m.z + wz * 3, 0.25);
  const portL = P(cU, 0, -(B / 2 + 1)), stbd = P(cU, 0, B / 2 + 1);
  halos.push({ x: portL.x, y: dY + aH + 2, z: portL.z, color: '#ff2a20', i: 4, size: 2.5 });
  halos.push({ x: stbd.x, y: dY + aH + 2, z: stbd.z, color: '#20ff6a', i: 4, size: 2.5 });
  halos.push({ x: m.x, y: dY + aH + 10.4, z: m.z, color: '#ffffff', i: 4, size: 2.4 });
  const bow = P(len / 2 - 6, 0, 0);
  halos.push({ x: bow.x, y: deck(0.98) + 6, z: bow.z, color: '#ffffff', i: 3.5, size: 2.2 });
  beam(G.steel, bow.x, deck(0.97), bow.z, bow.x, deck(0.97) + 6, bow.z, 0.25);
  for (const q of [portL, stbd]) refl.push({ x: q.x, z: q.z, color: q === portL ? '#ff3020' : '#30ff70', i: 0.7, w: 1, len: 1.8 });
  for (let k = 0; k < 4; k++) {
    const q = P(cU + (rng() - 0.5) * 8, 0, (rng() - 0.5) * B);
    refl.push({ x: q.x, z: q.z, color: WARM, i: 0.6 + rng() * 0.5, w: 1.4, len: 1.4 });
  }
  // deck cargo: bays of stacks on hatch covers
  const rows = Math.floor(B * 0.9 / 2.5);
  for (let u = aU1 + 4; u < len / 2 - 26; u += C40 + 1.3) {
    const t = (u + len / 2) / len;
    const tEnd = (u + C40 + len / 2) / len;
    const halfW = Math.min(hb(t), hb(Math.min(1, tEnd))) - 1.2;
    if (halfW < 3) break;
    const n = Math.min(rows, Math.floor(halfW * 2 / 2.5));
    const base = deck(Math.max(t, tEnd)) + 1.6;
    const cc = P(u + C40 / 2, 0, 0);
    G.steel.setColor(0.24, 0.3, 0.27);
    G.steel.box(cc.x, deck(t) - 0.2, cc.z, C40 + 0.6, base - deck(t) + 0.2, n * 2.5 + 0.4, ry);
    if (rng() < 0.08) continue;
    const prof = 0.55 + 0.45 * Math.sin(Math.min(1, (t - 0.18) / 0.7) * Math.PI);
    const tiers = [];
    for (let r = 0; r < n; r++) tiers.push(rng() < 0.06 ? 0 : Math.max(1, Math.round((2 + rng() * 5) * prof)));
    for (let r = 0; r < n; r++) {
      if (!tiers[r]) continue;
      const v = (r - (n - 1) / 2) * 2.5;
      const q = P(u + C40 / 2, 0, v);
      // local +z is starboard (next row), −z port (previous row)
      let faces = 31;
      if ((tiers[r - 1] || 0) >= tiers[r]) faces &= ~2;
      if ((tiers[r + 1] || 0) >= tiers[r]) faces &= ~1;
      const t0 = Math.min(tiers[r], 8);
      G.cont.setColor(0.8 + rng() * 0.2, 0.8 + rng() * 0.2, 0.8 + rng() * 0.2);
      containerBox(G.cont, q.x, base, q.z, ry, Math.floor(rng() * (9 - t0)), C40, faces, t0);
    }
  }
  // light on deck and spill on the quay
  wash.push({ x: P(aU1 + 20, 0, 0).x, y: dY + aH, z: P(aU1 + 20, 0, 0).z, color: new THREE.Color(HALIDE), radius: 70, intensity: 1.0 });
  // mooring lines to the quay side (nearest land)
  const quaySide = X.L.onLand(P(0, 0, -B / 2 - 4).x, P(0, 0, -B / 2 - 4).z) ? -1 : 1;
  G.steel.setColor(0.08, 0.08, 0.08);
  for (const [t, dl] of [[0.03, -16], [0.12, 8], [0.85, -6], [0.97, 16]]) {
    const u = -len / 2 + t * len;
    const A = P(u, deck(t) + 0.5, quaySide * hb(t) * 0.9);
    const Bq = P(u + dl, GROUND_Y + 0.7, quaySide * (B / 2 + 5));
    beam(G.steel, A.x, A.y, A.z, Bq.x, Bq.y, Bq.z, 0.12, 0.12, false);
  }
  for (const t of [0.25, 0.5, 0.75]) {
    const q = P(-len / 2 + t * len, 0, quaySide * (B / 2 + 2));
    world.addLamp(q.x, deck(t) + 4, q.z, WARM, 28, 0.55);
  }
}

/** High-mast flood light: tapered pole, crown of sodium lamps, halo, light. */
function mast(X, x, z, roadside) {
  const { G, rng, L, world } = X;
  L.claimCircle(x, z, 3);
  const H = 24 + rng() * 6;
  G.pole.setColor(0.36, 0.37, 0.39);
  G.pole.cylinder(x, GROUND_Y, z, 0.42, H + 0.3, 8, 0.2);
  G.steel.setColor(0.4, 0.41, 0.43);
  G.steel.box(x, H, z, 3.4, 0.3, 3.4, rng() * Math.PI);
  G.steel.box(x, H + 0.3, z, 0.5, 1.2, 0.5, 0);
  const ry0 = rng() * Math.PI;
  G.lamps.setColor(6, 3.6, 1.6);
  for (let k = 0; k < 6; k++) {
    const a = ry0 + k * Math.PI / 3, hx = x + Math.cos(a) * 1.5, hz = z + Math.sin(a) * 1.5;
    G.steel.box(hx, H - 0.45, hz, 0.75, 0.45, 0.6, -a);
    G.lamps.box(hx, H - 0.5, hz, 0.62, 0.06, 0.5, -a, { top: false, bottom: true });
  }
  X.halos.push({ x, y: H - 0.6, z, color: SODIUM, i: 2.2, size: 12 });
  if (roadside) world.addLamp(x, H - 1, z, SODIUM, 30, 1.0);
  else X.pool(x, H - 1, z, SODIUM, 30, 1.0);
  X.wash.push({ x, y: H - 4, z, color: new THREE.Color(SODIUM), radius: 58, intensity: 1.25 });
  return H;
}

const SHED_TINTS = [[0.96, 0.93, 0.86], [0.78, 0.85, 0.9], [0.8, 0.86, 0.78], [0.93, 0.86, 0.74], [0.7, 0.7, 0.69], [0.86, 0.6, 0.52], [0.62, 0.69, 0.75]];
const DOOR_BAYS = [1, 2, 6, 9, 12, 14, 1, 9];
const WALL_BAYS = [0, 5, 4, 0, 15, 8, 0, 10, 13];
const bayUV = (t, h) => {
  const col = t % 8, vb = t < 8 ? 0.5 : 0;
  return [col / 8 + 0.002, vb + 0.002, (col + 1) / 8 - 0.002, vb + 0.5 * Math.min(1, h / 12) - 0.002];
};

/**
 * Warehouse: corrugated walls from the facade atlas, shallow gable roof, loading
 * dock + canopy, wall packs over the doors, trailers backed in. (t = along the
 * road, f = facade normal pointing at the road.)
 */
function warehouse(X, cx, cz, tx, tz, fx, fz, bays, sideBays, h, kit) {
  const { G, rng, halos, world, L } = X;
  const w = bays * 6, d = sideBays * 6;
  const tint = SHED_TINTS[Math.floor(rng() * SHED_TINTS.length)];
  const lampC = rng() < 0.6 ? '#ffb45e' : '#e2ebff';
  const facade = (nx, nz, half, len, types) => {
    const c = [cx + nx * half, cz + nz * half], r = [nz, -nx];
    types.forEach((t, k) => {
      const a = -len / 2 + k * 6;
      wallQuad(G.shed, c[0] + r[0] * a, c[1] + r[1] * a, c[0] + r[0] * (a + 6), c[1] + r[1] * (a + 6), GROUND_Y, h, bayUV(t, h));
    });
  };
  // front pattern: office block at one end, doors between wall bays
  const office = rng() < 0.65 ? (rng() < 0.5 ? 0 : bays - 2) : -9;
  const front = [];
  for (let k = 0; k < bays; k++) {
    if (k === office || k === office + 1) front.push(rng() < 0.6 ? 3 : 11);
    else if (k % 2 === 1 || rng() < 0.25) front.push(DOOR_BAYS[Math.floor(rng() * DOOR_BAYS.length)]);
    else front.push(WALL_BAYS[Math.floor(rng() * WALL_BAYS.length)]);
  }
  G.shed.setColor(...tint);
  facade(fx, fz, d / 2, w, front);
  facade(-fx, -fz, d / 2, w, Array.from({ length: bays }, () => [0, 8, 15, 10, 7][Math.floor(rng() * 5)]));
  facade(tx, tz, w / 2, d, Array.from({ length: sideBays }, () => [0, 10, 8, 4, 1][Math.floor(rng() * 5)]));
  facade(-tx, -tz, w / 2, d, Array.from({ length: sideBays }, () => [0, 10, 8, 4, 1][Math.floor(rng() * 5)]));
  // gable ends + roof (ridge along t)
  const rise = d * 0.08;
  const V = (a, b, y) => new THREE.Vector3(cx + tx * a + fx * b, y, cz + tz * a + fz * b);
  for (const sd of [-1, 1]) {
    const u = bayUV(0, 12);
    quadOut(G.shed, V(sd * w / 2, -d / 2, h), V(sd * w / 2, d / 2, h), V(sd * w / 2, 0, h + rise), V(sd * w / 2, 0, h + rise), [u[0], u[3] - 0.04, u[2], u[3]], sd * tx, 0, sd * tz);
  }
  const o = 0.5;
  for (const sd of [-1, 1]) {
    quadOut(G.roof, V(-w / 2 - o, sd * (d / 2 + o), h - 0.05), V(w / 2 + o, sd * (d / 2 + o), h - 0.05), V(w / 2 + o, 0, h + rise), V(-w / 2 - o, 0, h + rise), [0, 0, w / 6, d / 12], 0, 1, 0);
  }
  G.steel.setColor(0.35, 0.36, 0.37);
  for (let k = 0; k < bays / 3; k++) { const p = V((rng() - 0.5) * w * 0.8, (rng() - 0.5) * d * 0.5, 0); G.steel.box(p.x, h + rise * 0.6, p.z, 1.6, 1.4, 1.6, Math.atan2(-tz, tx)); }
  // dock platform + canopy along the facade
  const ry = Math.atan2(-tz, tx);
  const fr = (a, out) => [cx + tx * a + fx * (d / 2 + out), cz + tz * a + fz * (d / 2 + out)];
  if (kit !== 'transit') {
    const dock = fr(0, 1.7);
    G.conc.box(dock[0], GROUND_Y, dock[1], w - 2, 1.5, 3.4, ry, { uw: 4, uh: 2 });
  }
  const can = fr(0, 2.0);
  if (h > 8) { G.steel.setColor(0.3, 0.31, 0.32); G.steel.box(can[0], 5.6, can[1], w - 2, 0.3, kit === 'transit' ? 2.5 : 4, ry); }
  // wall packs over doors, trailers at some docks
  const lampCol = new THREE.Color(lampC);
  front.forEach((t, k) => {
    const a = -w / 2 + k * 6 + 3;
    const isDoor = DOOR_BAYS.includes(t);
    if (isDoor && k % 2 === 1) {
      const p = fr(a, 0.35);
      G.lamps.setColor(lampCol.r * 5, lampCol.g * 5, lampCol.b * 5);
      G.lamps.box(p[0], Math.min(h - 1.5, 6.2), p[1], 0.55, 0.3, 0.4, ry);
      halos.push({ x: p[0] + fx * 0.3, y: Math.min(h - 1.5, 6.2), z: p[1] + fz * 0.3, color: lampC, i: 1.8, size: 3.2 });
      const q = fr(a, 3);
      world.addLamp(q[0], 6, q[1], lampC, 20, 1.15);
    }
    if (isDoor && kit === 'shed' && rng() < 0.45) {
      const q = fr(a, 0.6 + 6.9);
      const cells = L.rectFree(q[0], q[1], Math.atan2(fx, fz), 6.9, 1.4, 1.0, 0);
      if (!cells) return;
      L.claim(cells);
      trailer(X, q[0], q[1], Math.atan2(-fz, fx), rng);
    }
    if (rng() < 0.3) X.pallets.push(...palletStack(fr(a + (rng() - 0.5) * 3, 4.3 + rng() * 2), ry, rng));
  });
  if (kit === 'rail') G.conc.box(fr(0, 1.4)[0], GROUND_Y, fr(0, 1.4)[1], w, 1.3, 2.8, ry, { uw: 4, uh: 2 });
  const sb = fr(office === 0 ? w / 2 - 9 : -w / 2 + 9, 0);
  board(X, sb[0], h - 1.4, sb[1], fx, fz, 7, 0.9, X.signs.next().value);
}

/** Semi-trailer: box body (container atlas), chassis, wheels, landing legs. */
function trailer(X, x, z, ry, rng, onlyChassis = false) {
  const { G } = X;
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (a) => [x + c * a, z - s * a];
  G.steel.setColor(0.13, 0.13, 0.14);
  G.steel.box(x, GROUND_Y + 0.75, z, 13.4, 0.35, 2.3, ry);
  for (const a of [-5.2, -3.9]) { const p = P(a); G.steel.box(p[0], GROUND_Y, p[1], 1.0, 1.05, 2.5, ry); }
  const lg = P(3.2);
  G.steel.box(lg[0], GROUND_Y, lg[1], 0.3, 0.8, 2.0, ry);
  if (onlyChassis) return;
  G.cont.setColor(0.85 + rng() * 0.15, 0.85 + rng() * 0.15, 0.85 + rng() * 0.15);
  containerBox(G.cont, x, GROUND_Y + 1.1, z, ry, [7, 2, 5, 0][Math.floor(rng() * 4)], 13.4);
}

function palletStack(p, ry, rng) {
  const n = 2 + Math.floor(rng() * 7);
  return [{ x: p[0], y: GROUND_Y, z: p[1], ry: ry + (rng() - 0.5) * 0.3, sy: n }];
}

/** Oil tank: shell, cone roof, rim railing, stair steps, bund wall, beacons. */
function oilTank(X, x, z, r, h, bund) {
  const { G, rng, halos, wash, L } = X;
  const seg = Math.max(22, Math.round(r * 2.2));
  ring(G.tank, x, GROUND_Y, z, r, h - GROUND_Y, seg, Math.max(1, Math.round(2 * Math.PI * r / 40)));
  const apexY = h + r * 0.12;
  G.steel.setColor(0.52, 0.52, 0.5);
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
    const A = new THREE.Vector3(x + Math.cos(a0) * r, h, z + Math.sin(a0) * r), B = new THREE.Vector3(x + Math.cos(a1) * r, h, z + Math.sin(a1) * r), C = new THREE.Vector3(x, apexY, z);
    quadOut(G.steel, A, B, C, C.clone(), null, Math.cos(a0) * 0.2, 1, Math.sin(a0) * 0.2);
  }
  G.steel.setColor(0.72, 0.72, 0.68);
  ring(G.steel, x, h, z, r + 0.05, 1.1, seg);
  ring(G.steel, x, h, z, r - 0.05, 1.1, seg, 1, r - 0.05, true);
  const a0 = rng() * Math.PI * 2, steps = Math.round(h / 0.55);
  G.steel.setColor(0.58, 0.58, 0.55);
  for (let k = 0; k < steps; k++) {
    const a = a0 + (k / steps) * Math.PI * 0.9, y = GROUND_Y + (h - GROUND_Y) * (k / steps);
    G.steel.box(x + Math.cos(a) * (r + 0.6), y, z + Math.sin(a) * (r + 0.6), 0.6, 0.1, 1.1, -a);
  }
  if (bund > 0) {
    ring(G.conc, x, GROUND_Y, z, bund, 1.5, seg + 6, Math.round(bund * 0.8));
    ring(G.conc, x, GROUND_Y, z, bund - 0.3, 1.5, seg + 6, Math.round(bund * 0.8), bund - 0.3, true);
  }
  halos.push({ x, y: apexY + 0.5, z, color: '#ff2a18', i: 5, size: 3, blink: 2.2, phase: rng() });
  for (const a of [a0, a0 + 2.6]) halos.push({ x: x + Math.cos(a) * r, y: h + 1.4, z: z + Math.sin(a) * r, color: SODIUM, i: 2.2, size: 3.2 });
  wash.push({ x: x + Math.cos(a0) * (r + 6), y: h + 3, z: z + Math.sin(a0) * (r + 6), color: new THREE.Color(SODIUM), radius: r * 2 + 30, intensity: 1.0 });
  L.claimCircle(x, z, Math.max(r, bund) + 2);
  for (let k = 0; k < 8; k++) {
    const a = rng() * Math.PI * 2, rr = r + 2 + rng() * 2;
    X.drums.push({ x: x + Math.cos(a) * rr, y: GROUND_Y, z: z + Math.sin(a) * rr, color: ['#2a4a8a', '#8a2a1a', '#6a5a3a', '#3a5a3a'][k % 4] });
  }
}

/** Sample a rail polyline (filleted) every 2 m: { X, Z, TX, TZ, N, len }. */
function railPath(pts) {
  const c = buildCenterline({ points: pts.map((p) => [p[0], p[1], p[2] ?? 30]), type: 'sprint' });
  const TX = new Float32Array(c.N), TZ = new Float32Array(c.N);
  for (let i = 0; i < c.N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(c.N - 1, i + 1);
    const dx = c.X[b] - c.X[a], dz = c.Z[b] - c.Z[a], l = Math.hypot(dx, dz) || 1;
    TX[i] = dx / l; TZ[i] = dz / l;
  }
  return { X: c.X, Z: c.Z, TX, TZ, N: c.N, step: c.step, len: c.length };
}

/** Rail spur: track bed, rails (flush across the road), crossing signals, cars. */
function railway(X, R, ri) {
  const { G, track, L, rng, halos, world } = X;
  const near = new Uint8Array(R.N);
  for (let i = 0; i < R.N; i++) near[i] = L.roadClear(R.X[i], R.Z[i], 1.5) ? 0 : 1;
  const g = 0.7175;
  // segment ends: every sample on curves / near roads, otherwise up to 16 m apart
  const ends = [0];
  for (let i = 1; i < R.N; i++) {
    const last = ends[ends.length - 1];
    const turn = Math.abs(R.TX[i] * R.TZ[last] - R.TZ[i] * R.TX[last]) > 0.004;
    if (i === R.N - 1 || near[i] !== near[last] || near[i] || turn || i - last >= 8) ends.push(i);
  }
  for (let e = 0; e < ends.length - 1; e++) {
    const i = ends[e], j = ends[e + 1];
    const lx0 = R.TZ[i], lz0 = -R.TX[i], lx1 = R.TZ[j], lz1 = -R.TX[j];
    const Pt = (k, lx, lz, off, y) => new THREE.Vector3(R.X[k] + lx * off, y, R.Z[k] + lz * off);
    const onRoad = near[i] || near[j];
    const y = onRoad ? 0.03 : GROUND_Y + 0.27;
    if (!onRoad) {
      quadOut(G.ballast, Pt(i, lx0, lz0, -1.9, GROUND_Y + 0.08), Pt(i, lx0, lz0, 1.9, GROUND_Y + 0.08), Pt(j, lx1, lz1, 1.9, GROUND_Y + 0.08), Pt(j, lx1, lz1, -1.9, GROUND_Y + 0.08), [0, i * R.step / 2.6, 1, j * R.step / 2.6], 0, 1, 0);
    } else {
      G.steel.setColor(0.07, 0.07, 0.07);
      quadOut(G.steel, Pt(i, lx0, lz0, -1.4, 0.02), Pt(i, lx0, lz0, 1.4, 0.02), Pt(j, lx1, lz1, 1.4, 0.02), Pt(j, lx1, lz1, -1.4, 0.02), null, 0, 1, 0);
    }
    for (const sd of [-1, 1]) {
      // rail head (top) + inner web
      quadOut(G.rails, Pt(i, lx0, lz0, sd * g - 0.04, y), Pt(i, lx0, lz0, sd * g + 0.04, y), Pt(j, lx1, lz1, sd * g + 0.04, y), Pt(j, lx1, lz1, sd * g - 0.04, y), null, 0, 1, 0);
      if (!onRoad) quadOut(G.rails, Pt(i, lx0, lz0, sd * (g - 0.04), y - 0.15), Pt(j, lx1, lz1, sd * (g - 0.04), y - 0.15), Pt(j, lx1, lz1, sd * (g - 0.04), y), Pt(i, lx0, lz0, sd * (g - 0.04), y), null, -sd * lx0, 0, -sd * lz0);
    }
  }
  // crossing signals where the rail meets the road
  for (let i = 1; i < R.N - 1; i++) {
    if (!near[i] || near[i - 1]) continue;
    // first near sample: walk across to find both wall lines
    const p = track.project(R.X[i], R.Z[i], -1);
    for (const sd of [1, -1]) {
      const wl = (sd > 0 ? track.WL[p.i] : track.WR[p.i]) + 0.9;
      const base = L.at(p.i, sd * wl);
      const along = track.step * 2.2 * (sd > 0 ? 1 : -1);
      const x = base.x + track.TX[p.i] * along, z = base.z + track.TZ[p.i] * along;
      G.steel.setColor(0.85, 0.85, 0.82);
      beam(G.steel, x, GROUND_Y, z, x, 4.2, z, 0.14);
      const ry = Math.atan2(-track.LX[p.i] * sd, -track.LZ[p.i] * sd);
      const ux = Math.cos(ry) * 0.9, uz = -Math.sin(ry) * 0.9;
      beam(G.steel, x - ux, 3.1, z - uz, x + ux, 4.3, z + uz, 0.22, 0.05);
      beam(G.steel, x - ux, 4.3, z - uz, x + ux, 3.1, z + uz, 0.22, 0.05);
      G.steel.setColor(0.08, 0.08, 0.08);
      G.steel.box(x, 2.3, z, 1.3, 0.45, 0.25, ry);
      for (const k of [-1, 1]) halos.push({ x: x + ux * 0.6 * k - track.LX[p.i] * sd * 0.3, y: 2.52, z: z + uz * 0.6 * k - track.LZ[p.i] * sd * 0.3, color: '#ff2010', i: 5, size: 1.8, blink: 1.1, phase: k > 0 ? 0 : 0.5 });
      world.addStreak(x, 2.5, z, '#ff2010', 0.5);
    }
  }
  // rolling stock away from the road
  const cars = ri === 0 ? 7 : 5;
  let s0 = 30 + rng() * Math.max(10, R.len * 0.3);
  for (let k = 0; k < cars; k++) {
    const s = s0 + k * 15.8;
    const i = Math.floor(s / R.step);
    if (i >= R.N - 4) break;
    if (near[i] || near[Math.min(R.N - 1, i + 4)] || near[Math.max(0, i - 4)]) { s0 += 60; continue; }
    const x = R.X[i], z = R.Z[i], ry = Math.atan2(-R.TZ[i], R.TX[i]);
    if (!L.rectFree(x, z, Math.atan2(R.TX[i], R.TZ[i]), 7.6, 1.6, 2.5, 0) && k > 0) break;
    G.steel.setColor(0.12, 0.12, 0.12);
    for (const a of [-5.2, 5.2]) G.steel.box(x + Math.cos(ry) * a, GROUND_Y + 0.2, z - Math.sin(ry) * a, 2.6, 0.9, 2.3, ry);
    G.steel.box(x, GROUND_Y + 1.0, z, 15, 0.35, 2.7, ry);
    const kind = ri === 0 ? (k < 4 ? 'box' : 'tank') : 'flat';
    if (kind === 'box') {
      G.cont.setColor(0.75, 0.62, 0.55);
      containerBox(G.cont, x, GROUND_Y + 1.35, z, ry, [1, 5, 1, 6][k % 4], 14.6);
    } else if (kind === 'flat') {
      G.cont.setColor(0.9, 0.9, 0.9);
      containerBox(G.cont, x, GROUND_Y + 1.35, z, ry, Math.floor(rng() * 8), C40);
    } else {
      G.steel.setColor(0.09, 0.09, 0.1);
      const dx = Math.cos(ry) * 7, dz = -Math.sin(ry) * 7;
      tube(G.steel, new THREE.Vector3(x - dx, GROUND_Y + 2.9, z - dz), new THREE.Vector3(x + dx, GROUND_Y + 2.9, z + dz), 1.45, 10);
    }
  }
}

/** Blocks of container stacks filling the yard away from the road. */
function yardFill(X, maxBlocks) {
  const { G, track, L, rng } = X;
  const b = track.bounds;
  const cand = [];
  for (let gx = b.minX - 140; gx < b.maxX + 140; gx += 44) {
    for (let gz = b.minZ - 140; gz < b.maxZ + 140; gz += 40) {
      const x = gx + (rng() - 0.5) * 12, z = gz + (rng() - 0.5) * 12;
      if (!L.onLand(x, z, 20)) continue;
      const i = track.nearestIndex(x, z, 4);
      if (i < 0) continue;
      const d = track.distToRoad(x, z);
      if (d > 190) continue;
      cand.push([x, z, i, d + rng() * 30]);
    }
  }
  cand.sort((p, q) => p[3] - q[3]);
  let n = 0;
  for (const [x, z, i] of cand) {
    if (n >= maxBlocks) break;
    const ang = Math.atan2(track.TX[i], track.TZ[i]);
    const slots = 2 + Math.floor(rng() * 3), rows = 5 + Math.floor(rng() * 5);
    const cells = L.rectFree(x, z, ang, slots * 6.4 + 1, rows * 1.38 + 1, 10, 4);
    if (!cells) continue;
    L.claim(cells);
    n++;
    const tx = Math.sin(ang), tz = Math.cos(ang), lx = tz, lz = -tx;
    if (n % 3 === 1) {
      const mx = x + tx * (slots * 6.4 + 5), mz = z + tz * (slots * 6.4 + 5);
      if (L.rectFree(mx, mz, ang, 1.5, 1.5, 6, 2)) mast(X, mx, mz, false);
    }
    const cap = 2 + Math.floor(rng() * 4);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < slots; k++) {
        if (rng() < 0.12) continue;
        const tiers = 1 + Math.floor(rng() * cap);
        const a = (k - (slots - 1) / 2) * 12.8, bb = (r - (rows - 1) / 2) * 2.76;
        const kk = 0.7 + rng() * 0.35;
        G.cont.setColor(kk, kk * (0.97 + rng() * 0.06), kk * (0.95 + rng() * 0.08));
        containerBox(G.cont, x + tx * a + lx * bb, GROUND_Y, z + tz * a + lz * bb, ang - Math.PI / 2 + (rng() - 0.5) * 0.01, Math.floor(rng() * (9 - tiers)), C40, 31, tiers);
      }
    }
  }
  return n;
}

/** Container handlers parked around the yard. */
function reachStacker(X, x, z, ang, rng) {
  const { G, halos } = X;
  const tx = Math.sin(ang), tz = Math.cos(ang), lx = tz, lz = -tx;
  const P = (a, b) => [x + tx * a + lx * b, z + tz * a + lz * b];
  const ry = ang - Math.PI / 2;
  const col = rng() < 0.5 ? [0.85, 0.6, 0.1] : [0.7, 0.15, 0.1];
  G.steel.setColor(0.08, 0.08, 0.08);
  for (const a of [-2.6, 2.4]) for (const b of [-1.5, 1.5]) { const p = P(a, b); G.steel.box(p[0], GROUND_Y, p[1], 1.7, 1.7, 0.8, ry); }
  G.steel.setColor(...col);
  G.steel.box(x, GROUND_Y + 0.8, z, 8, 1.6, 3.2, ry);
  const cb = P(-0.5, 0);
  G.steel.setColor(0.1, 0.12, 0.14);
  G.steel.box(cb[0], GROUND_Y + 2.4, cb[1], 2, 2.4, 2, ry);
  G.steel.setColor(...col);
  const r0 = P(-3.5, 0), r1 = P(5.5, 0);
  beam(G.steel, r0[0], GROUND_Y + 3.2, r0[1], r1[0], GROUND_Y + 9, r1[1], 0.9, 1.1, true);
  G.steel.setColor(0.75, 0.62, 0.15);
  G.steel.box(r1[0], GROUND_Y + 8.2, r1[1], 2.4, 0.5, 12.2, ry);
  halos.push({ x: cb[0], y: GROUND_Y + 5.1, z: cb[1], color: '#ffaa20', i: 3, size: 1.6, blink: 0.8, phase: rng() });
}

function straddleCarrier(X, x, z, ang, rng) {
  const { G, halos } = X;
  const tx = Math.sin(ang), tz = Math.cos(ang), lx = tz, lz = -tx;
  const P = (a, b) => [x + tx * a + lx * b, z + tz * a + lz * b];
  const ry = ang - Math.PI / 2;
  const col = rng() < 0.5 ? [0.75, 0.16, 0.12] : [0.82, 0.8, 0.74];
  G.steel.setColor(...col);
  for (const a of [-4.4, 4.4]) for (const b of [-2.4, 2.4]) { const p = P(a, b); beam(G.steel, p[0], GROUND_Y + 0.9, p[1], p[0], 13.6, p[1], 0.7); }
  for (const b of [-2.4, 2.4]) { const p0 = P(-4.8, b), p1 = P(4.8, b); beam(G.steel, p0[0], 13.6, p0[1], p1[0], 13.6, p1[1], 0.8, 1.2, true); beam(G.steel, p0[0], 1.4, p0[1], p1[0], 1.4, p1[1], 0.5, 0.9, true); }
  G.steel.box(x, 13.4, z, 9, 1.6, 5.4, ry);
  G.steel.setColor(0.1, 0.12, 0.14);
  const cb = P(4.2, 1.6);
  G.steel.box(cb[0], 11.2, cb[1], 1.8, 2.2, 1.8, ry);
  G.steel.setColor(0.08, 0.08, 0.08);
  for (const a of [-4.4, 4.4]) for (const b of [-2.4, 2.4]) { const p = P(a, b); G.steel.box(p[0], GROUND_Y, p[1], 1.4, 1.2, 0.7, ry); }
  halos.push({ x, y: 15.4, z, color: '#ffaa20', i: 3, size: 1.8, blink: 0.9, phase: rng() });
}

function tractor(X, x, z, ang, rng) {
  const { G } = X;
  const tx = Math.sin(ang), tz = Math.cos(ang);
  const ry = ang - Math.PI / 2;
  const cab = [x + tx * 8.8, z + tz * 8.8];
  G.steel.setColor(...[[0.85, 0.75, 0.2], [0.2, 0.35, 0.6], [0.75, 0.2, 0.15]][Math.floor(rng() * 3)]);
  G.steel.box(cab[0], GROUND_Y + 0.6, cab[1], 3.2, 2.6, 2.5, ry);
  G.steel.setColor(0.1, 0.11, 0.12);
  G.steel.box(cab[0] + tx * 0.6, GROUND_Y + 2.1, cab[1] + tz * 0.6, 1.4, 0.9, 2.3, ry);
  trailer(X, x, z, ry, rng, rng() < 0.3);
}

// ------------------------------------------------------------------ effects

/** Drifting low mist (soft billboards, normal blending). */
function mistField(world, list) {
  if (!list.length) return;
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const n = list.length;
  const ipos = new Float32Array(n * 3), iprm = new Float32Array(n * 3);
  list.forEach((m, k) => { ipos.set([m.x, m.y, m.z], k * 3); iprm.set([m.size, m.a, m.seed], k * 3); });
  geo.setAttribute('ipos', new THREE.InstancedBufferAttribute(ipos, 3));
  geo.setAttribute('iprm', new THREE.InstancedBufferAttribute(iprm, 3));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: glowTexture() }, time: { value: 0 }, col: { value: new THREE.Color('#6d7484') }, fogColor: { value: new THREE.Color(world.at.fog) }, fogD: { value: world.scene.fog?.density ?? 0.002 } },
    vertexShader: `
      attribute vec3 ipos; attribute vec3 iprm; uniform float time, fogD; varying vec2 vUv; varying float vA; varying float vFog;
      void main(){
        float s = iprm.z * 6.2831;
        vec3 p = ipos + vec3(sin(time * 0.05 + s) * 7.0, sin(time * 0.11 + s * 2.0) * 0.6, cos(time * 0.04 + s * 1.3) * 7.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        mv.xy += position.xy * iprm.x * (1.0 + 0.15 * sin(time * 0.2 + s));
        vUv = uv;
        vA = iprm.y * smoothstep(3.0, 18.0, d) * (0.75 + 0.25 * sin(time * 0.13 + s * 3.0));
        vFog = 1.0 - exp(-fogD * fogD * d * d);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 col, fogColor; varying vec2 vUv; varying float vA; varying float vFog;
      void main(){ float a = texture2D(map, vUv).a; gl_FragColor = vec4(mix(col, fogColor, vFog), a * a * vA); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 5;
  world.add(m);
  world.animators.push((dt) => { mat.uniforms.time.value += dt; });
}

/** City across the bay: skyline, a dark far shore with a string of lights, beacons. */
function bayCity(X, spec) {
  const { world, rng } = X;
  const [cx, cz, r, count] = spec;
  const night = !!world.at.lamps;
  const sk = facadeTextures('dark', 'bay');
  const m = skyline(world, cx, cz, r, count, { tex: sk, maxH: 230, minH: 25, y: WATER_Y });
  m.material.fog = false;
  m.material.color = new THREE.Color(0x1a1f2c);
  m.material.emissiveIntensity = night ? 1.25 : 0;
  // far shore: low land in front of the towers
  const gb = new GeoBuilder();
  const fz = cz - r - 40;
  gb.box(cx, WATER_Y - 1, fz + 160, 6400, 7, 320, 0, { uw: 50, uh: 7 });
  const shore = new THREE.Mesh(gb.build(), new THREE.MeshBasicMaterial({ color: 0x07090e, fog: false }));
  world.add(shore);
  const far = [], farRefl = [];
  for (let x = cx - 2600; x < cx + 2600; x += 26 + rng() * 30) {
    const warm = rng() < 0.75;
    const c = warm ? (rng() < 0.6 ? SODIUM : WARM) : '#cfe0ff';
    far.push({ x, y: WATER_Y + 7 + rng() * 3, z: fz + rng() * 6, color: c, i: 1.6 + rng(), size: 7 });
    if (rng() < 0.55) farRefl.push({ x, z: fz - 2, color: c, i: 0.7, w: 3.5, len: 4 });
  }
  for (let k = 0; k < 14; k++) {
    const a = rng() * Math.PI * 2, rr = r * (0.3 + rng() * 0.7);
    far.push({ x: cx + Math.cos(a) * rr, y: 120 + rng() * 120, z: cz + Math.sin(a) * rr, color: '#ff2a18', i: 4, size: 12, blink: 1.8 + rng(), phase: rng() });
  }
  for (let k = 0; k < 40; k++) {
    const x = cx + (rng() - 0.5) * r * 2;
    farRefl.push({ x, z: fz - 4, color: rng() < 0.5 ? WARM : '#e8d8b8', i: 0.5 + rng() * 0.5, w: 5, len: 5 });
  }
  if (night) {
    const h = haloField(world, far, 0.12);
    void h;
    waterStreaks(world, farRefl, 0.12);
  }
}

// ------------------------------------------------------------------ build

export async function build(world, def, track, progress) {
  const rng = makeRng('docks' + def.id);
  const night = !!world.at.lamps;
  const wet = def.weather === 'wet' || def.weather === 'rain';
  const N = track.N;
  const L = layout(def, track);
  const D = L.D;
  const b = track.bounds;
  const cx0 = (b.minX + b.maxX) / 2, cz0 = (b.minZ + b.maxZ) / 2;
  const G = {
    cont: new GeoBuilder(), steel: new GeoBuilder(), pole: new GeoBuilder(), conc: new GeoBuilder(),
    shed: new GeoBuilder(), roof: new GeoBuilder(), hull: new GeoBuilder(), house: new GeoBuilder(),
    tank: new GeoBuilder(), lamps: new GeoBuilder(), ballast: new GeoBuilder(), rails: new GeoBuilder(), sign: new GeoBuilder(),
  };
  const X = {
    world, track, L, rng, G, halos: [], refl: [], wash: [], pallets: [], drums: [], tires: [],
    signs: (function* () { for (let k = 0; ; k++) yield k % 8; })(),
    pool: (x, y, z, color, radius, intensity) => world.lamps.push({ x, y, z, color: new THREE.Color(color), radius, intensity }),
  };
  const lit = [];
  const env = docksEnv(world.renderer);
  if (env) world.scene.environment = env;

  // ---- walls: per-side kit offsets, smoothed, clamped inside tight corners
  {
    const oL = new Float32Array(N), oR = new Float32Array(N);
    for (let i = 0; i < N; i++) { oL[i] = KIT_WALL[L.kit(i, 1)] ?? 4; oR[i] = KIT_WALL[L.kit(i, -1)] ?? 4; }
    const sL = smoothArray(oL, 4, track.closed, 2), sR = smoothArray(oR, 4, track.closed, 2);
    for (let i = 0; i < N; i++) {
      const k = track.Ks[i];
      const lim = Math.abs(k) > 1e-4 ? 1 / Math.abs(k) - track.W[i] - 2.5 : 99;
      track.WL[i] = track.W[i] + clamp(sL[i], 1.5, k > 0 ? Math.max(1.5, lim) : 99);
      track.WR[i] = track.W[i] + clamp(sR[i], 1.5, k < 0 ? Math.max(1.5, lim) : 99);
    }
  }
  track.shoulder = 0.8;
  track.offSurface = 'sidewalk';
  track.def.shoulderSurface = 'road';
  track.def.shoulderLift = 0;
  const wallAt = (i, side) => (side > 0 ? track.WL[i] : track.WR[i]);

  // ---- rail paths first: crossings open gaps in the barriers
  const rails = (D.rail || []).map(railPath);
  const gap = new Set();
  for (const R of rails) {
    for (let i = 0; i < R.N; i++) {
      if (L.roadClear(R.X[i], R.Z[i], 1.5)) continue;
      const p = track.project(R.X[i], R.Z[i], -1);
      for (let k = -3; k <= 3; k++) gap.add(track.idx(p.i + k));
    }
    for (let i = 0; i < R.N; i += 2) L.claimCircle(R.X[i], R.Z[i], 2.6);
  }

  // ---- yard ground (lit grid: dense near the track, sparse far out)
  {
    const gb = new GeoBuilder();
    const span = (a0, a1, d0, d1) => {
      const out = [];
      const pushR = (from, to, step) => { const k = Math.max(1, Math.ceil((to - from) / step)); for (let j = 0; j < k; j++) out.push(from + (to - from) * j / k); };
      const lo = clamp(d0, a0, a1), hi = clamp(d1, a0, a1);
      if (lo > a0) pushR(a0, lo, 120);
      if (hi > lo) pushR(lo, hi, 12);
      if (a1 > hi) pushR(hi, a1, 120);
      out.push(a1);
      return out;
    };
    for (const [x0, z0, x1, z1] of L.land) {
      const xs = span(x0, x1, b.minX - 180, b.maxX + 180), zs = span(z0, z1, b.minZ - 180, b.maxZ + 180);
      const base = gb.count;
      for (const z of zs) for (const x of xs) { gb.p.push(x, GROUND_Y, z); gb.n.push(0, 1, 0); gb.uv.push(x / 8, -z / 8); gb.c.push(1, 1, 1); }
      const nx = xs.length;
      for (let j = 0; j < zs.length - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const a = base + j * nx + i;
          gb.idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
        }
      }
    }
    const mat = glowMaterial(new THREE.MeshStandardMaterial({ map: concreteTexture('#5d5c58', 'dockyard'), color: 0x8a8a86, roughness: wet ? 0.55 : 0.92, envMapIntensity: wet ? 0.7 : 0.25 }), 1.3);
    const m = meshOf(gb, mat);
    world.add(m);
    lit.push(m);
  }

  // ---- concrete aprons from the road edge to just past the barrier line
  {
    const mat = glowMaterial(new THREE.MeshStandardMaterial({ map: concreteTexture('#72716b', 'apron'), color: 0xa09e98, roughness: wet ? 0.42 : 0.88, envMapIntensity: wet ? 0.9 : 0.3 }), 1.6);
    const W = (i) => track.W[i];
    const left = stripMesh(track, [
      { lat: (i) => W(i), dy: 0, u: 0 },
      { lat: (i) => track.WL[i] + 1.2, dy: 0, u: (i) => (track.WL[i] + 1.2 - W(i)) / 4 },
      { lat: (i) => track.WL[i] + 1.6, dy: -0.34, u: (i) => (track.WL[i] + 1.6 - W(i)) / 4 },
    ], mat, 4);
    const right = stripMesh(track, [
      { lat: (i) => -track.WR[i] - 1.6, dy: -0.34, u: (i) => -(track.WR[i] + 1.6 - W(i)) / 4 },
      { lat: (i) => -track.WR[i] - 1.2, dy: 0, u: (i) => -(track.WR[i] + 1.2 - W(i)) / 4 },
      { lat: (i) => -W(i), dy: 0, u: 0 },
    ], mat, 4);
    for (const m of [left, right]) { world.add(m); world.glowMeshes.push(m); }
  }
  progress(0.06, 'POURING THE QUAY');

  // ---- quay edges: concrete faces down to the water, coping, fenders, bollards
  const bollards = [];
  {
    const gb = new GeoBuilder(), cap = new GeoBuilder();
    for (const [x0, z0, x1, z1] of L.land) {
      const edges = [[x0, z1, x1, z1, 0, 1], [x1, z0, x0, z0, 0, -1], [x1, z1, x1, z0, 1, 0], [x0, z0, x0, z1, -1, 0]];
      for (const [ax, az, bx, bz, nx, nz] of edges) {
        const len = Math.hypot(bx - ax, bz - az);
        let run = null;
        const flush = (t1) => {
          if (run === null) return;
          const t0 = run;
          run = null;
          if (t1 - t0 < 1) return;
          const lo = WATER_Y - 2.5;
          const ry = Math.atan2(bx - ax, bz - az) - Math.PI / 2;
          const pieces = Math.max(1, Math.round((t1 - t0) / 10));
          const nearTrack = (x, z) => x > b.minX - 700 && x < b.maxX + 700 && z > b.minZ - 700 && z < b.maxZ + 700;
          for (let k = 0; k < pieces; k++) {
            const ta = t0 + (t1 - t0) * k / pieces, tb = t0 + (t1 - t0) * (k + 1) / pieces;
            const pa = [ax + (bx - ax) * ta / len, az + (bz - az) * ta / len], pb = [ax + (bx - ax) * tb / len, az + (bz - az) * tb / len];
            if (!nearTrack(pa[0], pa[1])) continue;
            quadOut(gb, new THREE.Vector3(pa[0], lo, pa[1]), new THREE.Vector3(pb[0], lo, pb[1]), new THREE.Vector3(pb[0], GROUND_Y, pb[1]), new THREE.Vector3(pa[0], GROUND_Y, pa[1]), [ta / 8, 0, tb / 8, 1], nx, 0, nz);
            cap.box((pa[0] + pb[0]) / 2 - nx * 0.4, GROUND_Y, (pa[1] + pb[1]) / 2 - nz * 0.4, tb - ta, 0.55, 0.8, ry, { uw: 4, uh: 1 });
          }
          for (let t = t0 + 6; t < t1 - 3; t += 14) {
            const fx = ax + (bx - ax) * t / len, fz = az + (bz - az) * t / len;
            if (track.distToRoad(fx, fz) > 420) continue;
            gb.box(fx + nx * 0.35, WATER_Y - 0.6, fz + nz * 0.35, nx ? 0.7 : 1.6, 3.2, nz ? 0.7 : 1.6, 0, { uw: 2, uh: 2 });
            if ((Math.round(t / 14) % 2) === 0) bollards.push({ x: fx - nx * 0.9, y: GROUND_Y + 0.55, z: fz - nz * 0.9 });
          }
        };
        for (let t = 0; t <= len; t += 1) {
          const px = ax + (bx - ax) * t / len, pz = az + (bz - az) * t / len;
          const water = !L.onLand(px + nx * 1.5, pz + nz * 1.5);
          if (water && run === null) run = t;
          if (!water) flush(t);
        }
        flush(len);
      }
    }
    const face = meshOf(gb, glowMaterial(new THREE.MeshStandardMaterial({ map: quayTexture(), roughness: 0.8, color: 0x8a8880 }), 1.2));
    const copeM = meshOf(cap, glowMaterial(new THREE.MeshStandardMaterial({ map: concreteTexture('#b8a254', 'coping'), roughness: 0.75, color: 0xb0a070 }), 1.4));
    world.add(face); world.add(copeM);
    lit.push(face, copeM);
  }
  waterMesh(world, cx0, cz0);

  // ---- barriers along the wall lines (jersey) and chain-link where fenced
  {
    const jersey = [[0, 0], [0.05, 0.08], [0.17, 0.28], [0.22, 0.8], [0.38, 0.8], [0.43, 0.28], [0.55, 0.08], [0.6, 0]];
    const gb = new GeoBuilder(), fence = new GeoBuilder(), curb = new GeoBuilder();
    // one segment per sample on curves, up to 4 samples on straights
    const straight = (i) => Math.abs(track.K[i]) < 1e-6 && Math.abs(track.Ks[i]) < 1e-4;
    for (const side of [1, -1]) {
      for (let i = 0, step = 1; i < N; i += step) {
        step = 1;
        while (step < 4 && i + step < N && straight(track.idx(i + step)) && straight(i) && !gap.has(track.idx(i + step)) &&
          L.kit(track.idx(i + step), side) === L.kit(i, side) && Math.abs(wallAt(track.idx(i + step), side) - wallAt(i, side)) < 0.02) step++;
        const j = track.idx(i + step);
        if (!track.closed && i + step > N - 1) break;
        if (gap.has(i) || gap.has(j)) continue;
        const fenced = FENCED[L.kit(i, side)];
        const wi = wallAt(i, side), wj = wallAt(j, side);
        const P = (k, w, dl, y) => new THREE.Vector3(track.X[k] + track.LX[k] * side * (w + dl), y, track.Z[k] + track.LZ[k] * side * (w + dl));
        const s0 = i * track.step, s1 = s0 + track.step * step;
        if (!fenced) {
          for (let q = 0; q < jersey.length - 1; q++) {
            const [d0, y0] = jersey[q], [d1, y1] = jersey[q + 1];
            const a = P(i, wi, d0, y0), bb = P(i, wi, d1, y1), c = P(j, wj, d1, y1), d = P(j, wj, d0, y0);
            const v0 = q / (jersey.length - 1), v1 = (q + 1) / (jersey.length - 1);
            if (side > 0) gb.quad(a, d, c, bb, [s0 / 8, v0, s1 / 8, v1]); else gb.quad(d, a, bb, c, [s1 / 8, v0, s0 / 8, v1]);
          }
        } else {
          const a = P(i, wi, 0.15, 0.02), d = P(j, wj, 0.15, 0.02);
          fence.quad(a, d, P(j, wj, 0.15, 3.0), P(i, wi, 0.15, 3.0), [s0 / 3, 0, s1 / 3, 1]);
          curb.box((a.x + d.x) / 2, 0, (a.z + d.z) / 2, track.step * step + 0.05, 0.25, 0.4, Math.atan2(d.x - a.x, d.z - a.z) - Math.PI / 2, { uw: 2, uh: 1 });
          G.pole.setColor(0.45, 0.47, 0.5);
          for (let k = 0; k < step; k += 2) { const q = P(track.idx(i + k), wallAt(track.idx(i + k), side), 0.15, 0); G.pole.cylinder(q.x, 0, q.z, 0.05, 3.05, 4); }
        }
      }
    }
    const bm = meshOf(gb, glowMaterial(new THREE.MeshStandardMaterial({ map: barrierTexture(), roughness: 0.85 }), 1.5));
    world.add(bm);
    lit.push(bm);
    if (fence.count) {
      const fm = meshOf(fence, glowMaterial(new THREE.MeshStandardMaterial({ map: fenceTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.6 }), 1.2));
      const cm = meshOf(curb, glowMaterial(new THREE.MeshStandardMaterial({ map: concreteTexture('#8a8780', 'curb'), roughness: 0.85 }), 1.4));
      world.add(fm); world.add(cm);
      lit.push(fm, cm);
    }
  }
  progress(0.14, 'RIGGING THE CRANES');
  await nextFrame();

  // ---- landmarks: tanks, cranes, ships, rail
  for (const t of D.tanks || []) {
    if (Array.isArray(t)) { oilTank(X, t[0], t[1], t[2], t[3], t[2] + 5); continue; }
    const c = L.corner(t.corner);
    if (!c) continue;
    const inner = c.r - track.W[c.i] - KIT_WALL.tank - 0.8;
    const r = Math.min(t.r, inner - 1.6);
    oilTank(X, c.x, c.z, r, t.h, inner - 0.4);
    // floods on the bund wall light the hairpin
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3, fx = c.x + Math.cos(a) * (inner - 0.6), fz = c.z + Math.sin(a) * (inner - 0.6);
      G.pole.setColor(0.4, 0.41, 0.43);
      G.pole.cylinder(fx, GROUND_Y, fz, 0.12, 7.2, 6);
      G.lamps.setColor(6, 3.6, 1.6);
      G.lamps.box(fx + Math.cos(a) * 0.3, 7, fz + Math.sin(a) * 0.3, 0.6, 0.35, 0.6, -a, { top: false, bottom: true });
      X.halos.push({ x: fx + Math.cos(a) * 0.4, y: 6.9, z: fz + Math.sin(a) * 0.4, color: SODIUM, i: 2, size: 4 });
      world.addLamp(fx + Math.cos(a) * 5, 7, fz + Math.sin(a) * 5, SODIUM, 26, 1.2);
    }
  }
  (D.cranes || []).forEach((s, k) => {
    const p = track.posAt(s, 0);
    const i = p.i;
    crane(X, p.x, p.z, track.TX[i], track.TZ[i], -track.LX[i], -track.LZ[i], k, true);
  });
  (D.farCranes || []).forEach(([x, z, ry], k) => crane(X, x, z, Math.cos(ry), -Math.sin(ry), Math.sin(ry), Math.cos(ry), k + 1, false));
  (D.ships || []).forEach((sp, k) => ship(X, sp, k));
  rails.forEach((R, k) => railway(X, R, k));
  // crane rails along the quay under the gantries
  if (D.cranes?.length) {
    const s0 = Math.min(...D.cranes) - 80, s1 = Math.max(...D.cranes) + 80;
    for (const lat of [-15, 15]) {
      for (let s = s0; s < s1; s += 12) {
        const a = track.posAt(s, lat), c = track.posAt(s + 12, lat);
        beam(G.rails, a.x, GROUND_Y + 0.04, a.z, c.x, GROUND_Y + 0.04, c.z, 0.12, 0.1, false, false);
      }
    }
  }
  progress(0.3, 'OPENING THE WAREHOUSES');

  // ---- flood-light masts (sodium), every ~75 m on the landside
  {
    let side = 1;
    for (let s = 20 + rng() * 20; s < track.length - 10; s += 62 + rng() * 26) {
      const i = track.posAt(s, 0).i;
      let sd = side;
      side = -side;
      if (L.kit(i, sd) === 'water') sd = -sd;
      if (L.kit(i, sd) === 'water') continue;
      const lat = sd * (wallAt(i, sd) + 1.6);
      const { x, z } = L.at(i, lat);
      if (!L.roadClear(x, z, 2.2) || L.occ.has(L.key(x, z))) continue;
      const H = mast(X, x, z, true);
      const r = L.at(i, sd * Math.max(0, track.W[i] - 3));
      X.pool(r.x, 11, r.z, SODIUM, 30, 1.55);
      void H;
    }
  }

  // ---- warehouses on 'shed' / 'rail' sides
  for (const side of [1, -1]) {
    let s = 0;
    while (s < track.length) {
      const kit = L.kit(track.posAt(s).i, side);
      if (kit !== 'shed' && kit !== 'rail') { s += 8; continue; }
      const bays = 6 + Math.floor(rng() * 8);
      const w = bays * 6, h = 9 + rng() * 3;
      const k = track.posAt(s + w / 2).i;
      if (L.kit(k, side) !== kit) { s += 8; continue; }
      const tx = track.TX[k], tz = track.TZ[k], fx = -side * track.LX[k], fz = -side * track.LZ[k];
      // full shed with a truck apron, else a compact transit shed close to the road
      let placed = null;
      for (const [set, sideBays] of kit === 'rail' ? [[13.5, 5 + Math.floor(rng() * 3)]] : [[16, 5 + Math.floor(rng() * 3)], [3.5, 4], [3.5, 3]]) {
        const d = sideBays * 6;
        const c = L.at(k, side * (wallAt(k, side) + set + d / 2));
        const cells = L.rectFree(c.x, c.z, Math.atan2(tx, tz), w / 2 + 1, d / 2 + 1, set - 1.5, 2);
        if (cells) { placed = { c, set, sideBays, cells }; break; }
      }
      if (!placed) { s += 9; continue; }
      L.claim(placed.cells);
      warehouse(X, placed.c.x, placed.c.z, tx, tz, fx, fz, bays, placed.sideBays, placed.set < 5 ? Math.min(h, 9.5) : h, placed.set < 5 ? 'transit' : kit);
      const fzc = L.at(k, side * (wallAt(k, side) + placed.set / 2));
      L.claimRect(fzc.x, fzc.z, Math.atan2(tx, tz), w / 2, placed.set / 2 - 0.5);
      s += w + 4 + rng() * 16;
    }
  }
  progress(0.45, 'STACKING CONTAINERS');

  // ---- tire walls on the outside of the big corners (drift venues)
  if (D.tires) {
    let run = null;
    for (let i = 0; i <= N; i++) {
      const k = track.K[track.idx(i)];
      const on = Math.abs(k) > 1e-6 && i < N;
      if (on && !run) run = { i0: i, sign: Math.sign(k) };
      if ((!on || i === N) && run) {
        const span = i - run.i0;
        if (span * track.step * Math.abs(track.K[track.idx(run.i0 + (span >> 1))]) > 1.0) {
          const side = -run.sign;
          for (let q = run.i0 + Math.floor(span * 0.1); q < i - Math.floor(span * 0.1); q++) {
            for (let t = 0; t < 1; t += 0.55) {
              const ii = track.idx(q);
              const lat = side * (wallAt(ii, side) + 1.35);
              const pp = L.at(ii, lat);
              const x = pp.x + track.TX[ii] * t * track.step, z = pp.z + track.TZ[ii] * t * track.step;
              const cells = L.rectFree(x, z, Math.atan2(track.TX[ii], track.TZ[ii]), 0.5, 0.5, 0.5, 0);
              if (!cells) continue;
              L.claim(cells);
              const paint = (q + Math.floor(t * 2)) % 4;
              X.tires.push({ x, y: GROUND_Y, z, ry: rng() * 3, sy: 0.8 + rng() * 0.4, color: paint === 0 ? '#c8c8c0' : paint === 2 ? '#a02018' : '#151515' });
            }
          }
        }
        run = null;
      }
    }
  }
  // ---- port signage: overhead gate + boards behind the barriers
  for (const [gs, k] of D.gates || []) {
    const p = track.posAt(gs, 0);
    const i = p.i;
    const fx = -track.TX[i], fz = -track.TZ[i];
    G.steel.setColor(0.32, 0.33, 0.35);
    for (const sd of [-1, 1]) { const q = L.at(i, sd * (wallAt(i, sd) + 0.9)); beam(G.steel, q.x, GROUND_Y, q.z, q.x, 7.6, q.z, 0.45); }
    const l = L.at(i, track.WL[i] + 0.9), r = L.at(i, -(track.WR[i] + 0.9));
    beam(G.steel, l.x, 7.3, l.z, r.x, 7.3, r.z, 0.5, 0.8, true);
    board(X, p.x + fx * 0.3, 7.3, p.z + fz * 0.3, fx, fz, Math.min(14, track.W[i] * 1.6), 1.6, k);
    for (const sd of [-0.4, 0.4]) { const q = L.at(i, sd * track.W[i]); X.halos.push({ x: q.x + fx * 1.2, y: 8.2, z: q.z + fz * 1.2, color: HALIDE, i: 1.6, size: 2.2 }); world.addLamp(q.x + fx * 1.5, 8, q.z + fz * 1.5, HALIDE, 16, 0.7); }
  }
  for (let s = 140 + rng() * 80; s < track.length - 50; s += 260 + rng() * 200) {
    const i = track.posAt(s, 0).i;
    const side = L.kit(i, 1) === 'water' ? -1 : 1;
    const q = L.at(i, side * (wallAt(i, side) + 1.1));
    const cells = L.rectFree(q.x, q.z, 0, 1.4, 1.4, 1, 0);
    if (!cells) continue;
    L.claim(cells);
    const fx = -track.TX[i] * 0.9 - side * track.LX[i] * 0.45, fz = -track.TZ[i] * 0.9 - side * track.LZ[i] * 0.45;
    const fl = Math.hypot(fx, fz);
    G.pole.setColor(0.5, 0.5, 0.52);
    const rx = fz / fl, rz = -fx / fl;
    for (const sd of [-1, 1]) G.pole.cylinder(q.x + rx * sd * 1.0, GROUND_Y, q.z + rz * sd * 1.0, 0.05, 2.6, 5);
    board(X, q.x, 2.3, q.z, fx / fl, fz / fl, 2.6, 0.55, [10, 11, 14, 11, 10, 12][Math.floor(rng() * 6)]);
  }

  // ---- containers: rows of stacks behind the barrier on 'stack' sides
  let nCont = 0;
  {
    const ROWS = 4;
    const skin = () => { let t = rng() * SKIN_W.reduce((a, c) => a + c, 0); for (let k = 0; k < 8; k++) { t -= SKIN_W[k]; if (t <= 0) return k; } return 0; };
    for (const side of [1, -1]) {
      let s = 0;
      const slots = [];
      while (s < track.length) {
        const i = track.posAt(s, 0).i;
        if (L.kit(i, side) !== 'stack') { s += 6; continue; }
        const len = rng() < 0.18 ? C20 : C40;
        const k = track.posAt(s + len / 2, 0).i;
        const ang = Math.atan2(track.TX[k], track.TZ[k]);
        const slot = [];
        for (let r = 0; r < ROWS; r++) {
          const q = L.at(k, side * (wallAt(k, side) + 1.15 + CW / 2 + r * (CW + 0.32)));
          const cells = L.rectFree(q.x, q.z, ang, len / 2, CW / 2, 2.4);
          const roll = rng();
          let tiers = r === 0 ? (roll < 0.07 ? 0 : roll < 0.3 ? 2 : roll < 0.6 ? 3 : roll < 0.86 ? 4 : 5) : (roll < 0.14 ? 0 : 1 + Math.floor(rng() * 5));
          if (r === ROWS - 1) tiers = Math.min(tiers, 3);
          if (!cells || !tiers) { slot.push(null); continue; }
          L.claim(cells);
          slot.push({ x: q.x, z: q.z, ang, tiers, len });
        }
        slots.push(slot);
        s += len + 0.35 + (rng() < 0.06 ? 4 + rng() * 8 : 0);
      }
      for (const slot of slots) {
        slot.forEach((st, r) => {
          if (!st) return;
          const toward = slot[r - 1]?.tiers || 0, away = slot[r + 1]?.tiers || 0;
          // container local +z faces the road on the left side, away from it on the right
          const front = side > 0 ? toward : away, back = side > 0 ? away : toward;
          const ry = st.ang - Math.PI / 2;
          if (r >= 2) {
            let faces = 31;
            if (front >= st.tiers) faces &= ~1;
            if (back >= st.tiers) faces &= ~2;
            const kk = 0.72 + rng() * 0.3;
            G.cont.setColor(kk, kk, kk * (0.95 + rng() * 0.08));
            containerBox(G.cont, st.x, GROUND_Y, st.z, ry, Math.floor(rng() * (9 - st.tiers)), st.len, faces, st.tiers);
            nCont += st.tiers;
            return;
          }
          for (let t = 0; t < st.tiers; t++) {
            let faces = 31;
            if (t < st.tiers - 1) faces &= ~16;
            if (front > t) faces &= ~1;
            if (back > t) faces &= ~2;
            const kk = 0.72 + rng() * 0.36;
            G.cont.setColor(kk * (0.97 + rng() * 0.06), kk, kk * (0.95 + rng() * 0.08));
            const off = t > 0 && rng() < 0.12 ? (rng() - 0.5) * 0.25 : 0;
            containerBox(G.cont, st.x + Math.sin(st.ang) * off, GROUND_Y + t * CH, st.z + Math.cos(st.ang) * off, ry + (rng() - 0.5) * 0.012, skin(), st.len, faces);
            nCont++;
          }
        });
      }
    }
  }

  // ---- yard equipment in open areas and gaps, then fill blocks further back
  {
    for (let s = 10; s < track.length; s += 34 + rng() * 30) {
      const i = track.posAt(s, 0).i;
      for (const side of [1, -1]) {
        const kit = L.kit(i, side);
        if (kit !== 'open' && !(kit === 'stack' && rng() < 0.12) && !(kit === 'fence' && rng() < 0.5)) continue;
        const lat = side * (wallAt(i, side) + (kit === 'open' ? 7 + rng() * 6 : 15 + rng() * 6));
        const q = L.at(i, lat);
        const ang = Math.atan2(track.TX[i], track.TZ[i]) + (rng() < 0.5 ? 0 : Math.PI);
        const pick = rng();
        const big = pick < 0.35;
        const cells = L.rectFree(q.x, q.z, ang, big ? 5.5 : 7.5, big ? 3.2 : 2.2, 3, 2);
        if (!cells) continue;
        L.claim(cells);
        if (pick < 0.35) straddleCarrier(X, q.x, q.z, ang, rng);
        else if (pick < 0.6) reachStacker(X, q.x, q.z, ang, rng);
        else tractor(X, q.x, q.z, ang, rng);
      }
    }
    yardFill(X, D.fill ?? 70);
  }
  progress(0.65, 'MOORING THE SHIPS');
  await nextFrame();

  // ---- skyline across the bay
  if (D.skyline) bayCity(X, D.skyline);

  // ---- surface dressing: puddles (wet) or rubber (dry)
  {
    const gb = new GeoBuilder();
    if (wet) {
      for (let k = 0; k < 140; k++) {
        const s = rng() * track.length;
        const i = track.posAt(s).i;
        const edge = rng() < 0.7;
        const lat = edge ? (rng() < 0.5 ? 1 : -1) * (track.W[i] - 1.5 + rng() * 3.5) : (rng() - 0.5) * track.W[i] * 1.6;
        const c = L.at(i, lat);
        const r0 = 0.8 + rng() * 2.6, sx = 1 + rng() * 1.6;
        const ang = rng() * Math.PI;
        const pts = [];
        for (let q = 0; q < 9; q++) { const a = (q / 9) * Math.PI * 2, rr = r0 * (0.75 + rng() * 0.4); pts.push([Math.cos(a) * rr * sx, Math.sin(a) * rr]); }
        const P = ([u, v]) => new THREE.Vector3(c.x + Math.cos(ang) * u - Math.sin(ang) * v, 0.012, c.z + Math.sin(ang) * u + Math.cos(ang) * v);
        const C = new THREE.Vector3(c.x, 0.012, c.z);
        for (let q = 0; q < 9; q++) quadOut(gb, C, P(pts[q]), P(pts[(q + 1) % 9]), C.clone(), null, 0, 1, 0);
      }
      const mat = glowMaterial(new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.04, metalness: 0.1, envMapIntensity: 2.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 2.4);
      const pm = meshOf(gb, mat);
      pm.geometry.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(gb.count * 3), 3));
      world.add(pm);
      world.glowMeshes.push(pm);
    } else {
      // skid marks through every corner (drift venue)
      let run = null;
      const corners = [];
      for (let i = 0; i <= N; i++) {
        const k = track.K[track.idx(i)];
        const on = Math.abs(k) > 1e-6 && i < N;
        if (on && !run) run = { i0: i, sign: Math.sign(k) };
        if (!on && run) { run.i1 = i; corners.push(run); run = null; }
      }
      for (const cr of corners) {
        const span = cr.i1 - cr.i0;
        for (let m = 0; m < 4; m++) {
          const i0 = cr.i0 - 8 - Math.floor(rng() * 6), i1 = cr.i1 + 6 + Math.floor(rng() * 8);
          const jitter = (rng() - 0.5) * 3;
          const sw = 0.6 + rng() * 0.6;
          for (const tire of [-0.8, 0.8]) {
            for (let i = i0; i < i1; i++) {
              const t0 = (i - i0) / (i1 - i0), t1 = (i + 1 - i0) / (i1 - i0);
              const lat = (t) => {
                const apex = Math.sin(t * Math.PI);
                const w = track.W[track.idx(cr.i0 + Math.floor(span / 2))];
                return -cr.sign * (w - 2.2) * (1 - apex) * 0.9 + cr.sign * (w - 2.6) * apex * 0.85 + jitter + tire + Math.sin(t * 9 + m) * 0.3 * sw;
              };
              const ia = track.idx(i), ib = track.idx(i + 1);
              const la = lat(t0), lb = lat(t1);
              const a = L.at(ia, la), bb = L.at(ib, lb);
              const ww = 0.13;
              quadOut(gb, new THREE.Vector3(a.x - track.LX[ia] * ww, 0.01, a.z - track.LZ[ia] * ww), new THREE.Vector3(a.x + track.LX[ia] * ww, 0.01, a.z + track.LZ[ia] * ww),
                new THREE.Vector3(bb.x + track.LX[ib] * ww, 0.01, bb.z + track.LZ[ib] * ww), new THREE.Vector3(bb.x - track.LX[ib] * ww, 0.01, bb.z - track.LZ[ib] * ww),
                [0, t0 * 6, 1, t1 * 6], 0, 1, 0);
            }
          }
        }
      }
      const mat = new THREE.MeshBasicMaterial({ map: skidTexture(), transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const m = meshOf(gb, mat);
      m.renderOrder = 1;
      world.add(m);
    }
  }

  // ---- mist low over the water along the quays and drifting into the yard
  {
    const list = [];
    for (const [x0, z0, x1, z1] of L.land) {
      for (const [ax, az, bx, bz, nx, nz] of [[x0, z1, x1, z1, 0, 1], [x1, z0, x1, z1, 1, 0], [x0, z0, x0, z1, -1, 0]]) {
        const len = Math.hypot(bx - ax, bz - az);
        for (let t = 0; t < len; t += 16 + rng() * 20) {
          const x = ax + (bx - ax) * t / len + nx * (6 + rng() * 40), z = az + (bz - az) * t / len + nz * (6 + rng() * 40);
          if (L.onLand(x, z) || track.distToRoad(x, z) > 260) continue;
          list.push({ x, y: WATER_Y + 1 + rng() * 3, z, size: 26 + rng() * 26, a: 0.16 + rng() * 0.12, seed: rng() });
        }
      }
    }
    for (let k = 0; k < 26; k++) {
      const p = track.posAt(rng() * track.length, (rng() - 0.5) * 30);
      list.push({ x: p.x, y: 1.5 + rng() * 3, z: p.z, size: 16 + rng() * 14, a: 0.08 + rng() * 0.07, seed: rng() });
    }
    if (night) mistField(world, list.slice(0, 220));
  }
  progress(0.85, 'SWITCHING ON THE YARD');

  // ---- assemble merged meshes
  const tex = containerAtlas();
  const add = (gb, mat, color = false, bake = true) => {
    if (!gb.count) return null;
    const m = meshOf(gb, mat, color);
    world.add(m);
    if (bake) lit.push(m);
    return m;
  };
  add(G.cont, glowMaterial(new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.72, metalness: 0.2, envMapIntensity: wet ? 0.6 : 0.3 }), 1.5), true);
  add(G.steel, glowMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.4 }), 0.85), true);
  add(G.pole, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.5 }), true, false);
  add(G.conc, glowMaterial(new THREE.MeshStandardMaterial({ map: concreteTexture('#8f8c84', 'dock'), roughness: 0.85 }), 1.4));
  const sh = shedAtlas();
  add(G.shed, glowMaterial(new THREE.MeshStandardMaterial({ map: sh.map, vertexColors: true, emissive: 0xffffff, emissiveMap: sh.emi, emissiveIntensity: night ? 1.4 : 0, roughness: 0.7, metalness: 0.25 }), 1.5), true);
  add(G.roof, glowMaterial(new THREE.MeshStandardMaterial({ map: roofTexture(), roughness: 0.6, metalness: 0.4 }), 1.2));
  if (D.ships?.length) add(G.hull, glowMaterial(new THREE.MeshStandardMaterial({ map: hullAtlas(D.ships), roughness: 0.6, metalness: 0.3 }), 1.4));
  const dh = deckhouseTextures();
  add(G.house, glowMaterial(new THREE.MeshStandardMaterial({ map: dh.map, emissive: 0xffffff, emissiveMap: dh.emi, emissiveIntensity: night ? 1.6 : 0, roughness: 0.6 }), 1.3));
  add(G.sign, glowMaterial(new THREE.MeshStandardMaterial({ map: signAtlas(), roughness: 0.6 }), 1.5));
  add(G.tank, glowMaterial(new THREE.MeshStandardMaterial({ map: tankTexture(), color: 0xc8c4bc, roughness: 0.7, metalness: 0.2 }), 1.0));
  add(G.lamps, new THREE.MeshBasicMaterial({ vertexColors: true, color: night ? 0xffffff : 0x222222 }), true, false);
  add(G.ballast, glowMaterial(new THREE.MeshStandardMaterial({ map: trackbedTexture(), roughness: 0.95 }), 1.3));
  add(G.rails, new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.3, metalness: 0.9 }), false, false);
  if (bollards.length) {
    const bg = new GeoBuilder();
    bg.cylinder(0, 0, 0, 0.22, 0.55, 6, 0.18);
    bg.cylinder(0, 0.55, 0, 0.3, 0.12, 6, 0.3);
    world.add(instanced(bg.build(), new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.5, metalness: 0.4 }), bollards));
  }
  if (X.pallets.length) {
    const pg = new THREE.BoxGeometry(1.2, 0.15, 1.0);
    pg.translate(0, 0.075, 0);
    world.add(instanced(pg, new THREE.MeshStandardMaterial({ color: 0x7a6040, roughness: 0.9, emissive: 0x2a1a08, emissiveIntensity: night ? 1 : 0 }), X.pallets));
  }
  if (X.tires.length) {
    const tg = new THREE.CylinderGeometry(0.55, 0.55, 1.25, 10, 1);
    tg.translate(0, 0.625, 0);
    world.add(instanced(tg, new THREE.MeshStandardMaterial({ roughness: 0.85, emissive: 0x1a0c04, emissiveIntensity: night ? 1 : 0 }), X.tires));
  }
  if (X.drums.length) {
    const dg = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10);
    dg.translate(0, 0.45, 0);
    world.add(instanced(dg, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.3 }), X.drums));
  }
  haloField(world, night ? X.halos : []);
  waterStreaks(world, night ? X.refl : []);
  bakeLit(lit, [...world.lamps, ...X.wash]);
  progress(1, 'DOCKS READY');
  void nCont; void HALIDE;
}

export default { terrain: false, build };
