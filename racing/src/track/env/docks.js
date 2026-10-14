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
        speckle(x, x0, y0, w, 128, rng, w * 10, 0.16);
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
  else gb.quad(a, b, c, d, uv);
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

/** Oriented box between two points (beams, braces, stays). */
function beam(gb, ax, ay, az, bx, by, bz, w, h = w, caps = false) {
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
    if (inward) gb.quad(A, B, C, D, uv); else gb.quad(B, A, D, C, [uv[2], 0, uv[0], 1]);
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
        const hy = Math.max(1, dy);
        const d = Math.sqrt(d2 + hy * hy * 0.3);
        const f = 1 - d / L.radius;
        if (f <= 0) continue;
        const ndl = (nx * dx + ny * dy + nz * dz) / Math.sqrt(d2 + dy * dy + 1e-4);
        const k = f * f * L.intensity * (0.22 + 0.78 * Math.max(0, ndl));
        r += L.color.r * k; gg += L.color.g * k; b += L.color.b * k;
      }
      out[v * 3] = Math.min(r, 3); out[v * 3 + 1] = Math.min(gg, 3); out[v * 3 + 2] = Math.min(b, 3);
    }
    g.setAttribute('glow', new THREE.BufferAttribute(out, 3));
  }
}

/** Camera-facing additive glows (lamp heads, warning lights), one draw call. */
function haloField(world, list) {
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
    uniforms: { map: { value: glowTexture() }, time: { value: 0 }, fogD: { value: world.scene.fog?.density ?? 0.002 } },
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
function waterStreaks(world, list) {
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
    uniforms: { map: { value: streakTexture() }, camPos: { value: new THREE.Vector3() }, time: { value: 0 }, fogD: { value: world.scene.fog?.density ?? 0.002 } },
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
  const claimCircle = (x, z, r) => {
    for (let a = -r; a <= r; a += OC) for (let b = -r; b <= r; b += OC) if (a * a + b * b <= r * r + OC) occ.add(key(x + a, z + b));
  };
  const at = (i, lat) => ({ x: track.X[i] + track.LX[i] * lat, z: track.Z[i] + track.LZ[i] * lat });
  return { D, n, anchors, leg, kit, corner, land, onLand, rectFree, claim, claimCircle, roadClear, occ, key, at };
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
