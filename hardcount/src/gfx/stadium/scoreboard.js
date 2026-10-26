// Scoreboards drawn into canvases: the classic small-town bulb board (painted
// header with the school's name, HOME / GUESTS, amber bulb digits, DOWN /
// TO GO / BALL ON / QTR) and the video board (logos, scores, clock, down &
// distance, play clock, big messages). One canvas texture per board, shared
// by every face that shows it; redrawn only when the state changes.
import * as THREE from 'three';
import { cv, tex } from './tex.js';
import { blockText } from './blockfont.js';
import { vText } from '../../core/font.js';
import { logoCanvas } from '../logos.js';

const DOTS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
};

/** Bulb digits: `str` right-aligned in `n` cells; box (x, y, w, h). */
function bulbs(x, str, n, bx, by, bw, bh, lit = '#ffb02a', dim = '#2a1606') {
  const s = String(str ?? '').slice(-n).padStart(n, ' ');
  const cw = bw / n;
  const pitch = Math.min((cw * 0.86) / 5, bh / 7);
  const r = pitch * 0.36;
  for (let k = 0; k < n; k++) {
    const g = DOTS[s[k]] || DOTS[' '];
    const ox = bx + k * cw + (cw - pitch * 5) / 2, oy = by + (bh - pitch * 7) / 2;
    for (let j = 0; j < 7; j++) {
      for (let i = 0; i < 5; i++) {
        const on = g[j][i] === '1';
        x.fillStyle = on ? lit : dim;
        if (on) { x.shadowColor = lit; x.shadowBlur = r * 2.2; } else x.shadowBlur = 0;
        x.beginPath();
        x.arc(ox + (i + 0.5) * pitch, oy + (j + 0.5) * pitch, r, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  x.shadowBlur = 0;
}

function panelText(x, s, cx, y, size, col = '#f2f2ea', opts = {}) {
  blockText(x, s, cx, y, size, { align: 'center', weight: 1.0, gap: 1.0, color: col, ...opts });
}

export const DEFAULT_STATE = {
  home: { abbr: 'HOME', score: 0, timeouts: 3 }, away: { abbr: 'AWAY', score: 0, timeouts: 3 },
  quarter: 1, clock: '12:00', playClock: 25, down: 1, toGo: 10, ballOn: 25, possession: 'home', msg: null,
};

function ballOnNum(b) {
  if (b === undefined || b === null) return '';
  const m = String(b).match(/\d+/);
  return m ? m[0] : '';
}

// ------------------------------------------------------------------ boards

function drawHS(x, W, H, st, o) {
  const home = o.home;
  x.fillStyle = '#0b0d0c';
  x.fillRect(0, 0, W, H);
  // header: painted sign with the school's name
  const hh = H * 0.24;
  x.fillStyle = home.colors.primary;
  x.fillRect(0, 0, W, hh);
  x.fillStyle = home.colors.secondary;
  x.fillRect(0, hh - 8, W, 8);
  panelText(x, o.title || 'HOME', W / 2, hh * 0.62, hh * 0.46, '#ffffff', { outline: 3, outlineColor: home.colors.dark || '#000', squeeze: 1 });
  if (o.sub) panelText(x, o.sub, W / 2, hh * 0.9, hh * 0.15, home.colors.secondary === '#ffffff' ? '#ffffff' : '#f2f2ea');
  // body
  const y0 = hh + 16;
  x.fillStyle = '#e8e8e0';
  panelText(x, 'HOME', W * 0.19, y0 + 34, 30);
  panelText(x, 'GUESTS', W * 0.81, y0 + 34, 30);
  bulbs(x, st.home.score, 2, W * 0.06, y0 + 46, W * 0.26, H * 0.27);
  bulbs(x, st.away.score, 2, W * 0.68, y0 + 46, W * 0.26, H * 0.27);
  // clock
  const clk = String(st.clock || '').replace(':', '');
  bulbs(x, clk.slice(0, -2), 2, W * 0.355, y0 + 20, W * 0.13, H * 0.2, '#ff3a1a', '#200606');
  bulbs(x, clk.slice(-2), 2, W * 0.515, y0 + 20, W * 0.13, H * 0.2, '#ff3a1a', '#200606');
  x.fillStyle = '#ff3a1a';
  x.shadowColor = '#ff3a1a'; x.shadowBlur = 8;
  x.beginPath(); x.arc(W * 0.5, y0 + 20 + H * 0.07, 5, 0, 7); x.fill();
  x.beginPath(); x.arc(W * 0.5, y0 + 20 + H * 0.13, 5, 0, 7); x.fill();
  x.shadowBlur = 0;
  // possession arrows
  for (const [side, cx] of [['home', W * 0.36], ['away', W * 0.64]]) {
    const on = st.possession === side;
    x.fillStyle = on ? '#ffb02a' : '#2a1606';
    if (on) { x.shadowColor = '#ffb02a'; x.shadowBlur = 10; }
    x.beginPath();
    const d = side === 'home' ? -1 : 1;
    x.moveTo(cx + d * 14, y0 + H * 0.36); x.lineTo(cx - d * 10, y0 + H * 0.36 - 12); x.lineTo(cx - d * 10, y0 + H * 0.36 + 12);
    x.closePath(); x.fill();
    x.shadowBlur = 0;
  }
  // bottom row
  const by = H * 0.8;
  const cols = [['BALL ON', ballOnNum(st.ballOn), 2], ['DOWN', st.down || '', 1], ['TO GO', st.toGo ?? '', 2], ['QTR', st.quarter || '', 1]];
  cols.forEach(([lbl, v, n], k) => {
    const cx = W * (0.14 + k * 0.24);
    panelText(x, lbl, cx, by - 4, 20);
    bulbs(x, v, n, cx - (n === 2 ? 60 : 30), by + 6, n === 2 ? 120 : 60, H * 0.15);
  });
  // timeouts left
  for (const [side, cx] of [['home', W * 0.19], ['away', W * 0.81]]) {
    const t = st[side]?.timeouts ?? 3;
    for (let k = 0; k < 3; k++) {
      x.fillStyle = k < t ? '#ffb02a' : '#2a1606';
      x.beginPath(); x.arc(cx - 30 + k * 30, y0 + H * 0.32 + 52, 7, 0, 7); x.fill();
    }
  }
  if (st.msg) {
    x.fillStyle = 'rgba(0,0,0,0.0)';
  }
  // frame
  x.strokeStyle = '#3a3c3a';
  x.lineWidth = 10;
  x.strokeRect(5, 5, W - 10, H - 10);
}

function drawVideo(x, W, H, st, o) {
  const home = o.home, away = o.away;
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0d16');
  g.addColorStop(1, '#03050a');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  // team colour wedges
  for (const [team, side] of [[home, -1], [away, 1]]) {
    x.save();
    x.fillStyle = team.colors.primary;
    x.beginPath();
    const cx = W / 2 + side * W * 0.5;
    x.moveTo(cx, 0); x.lineTo(W / 2 + side * W * 0.16, 0); x.lineTo(W / 2 + side * W * 0.2, H * 0.62); x.lineTo(cx, H * 0.62);
    x.closePath(); x.fill();
    x.fillStyle = team.colors.secondary;
    x.globalAlpha = 0.9;
    x.fillRect(side < 0 ? 0 : W / 2 + W * 0.2, H * 0.62 - 10, W * 0.3, 10);
    x.restore();
  }
  const ys = H * 0.42;
  for (const [team, s, side] of [[home, st.home, -1], [away, st.away, 1]]) {
    const cx = W / 2 + side * W * 0.34;
    const lg = logoCanvas(team, 256);
    x.drawImage(lg, cx - side * W * 0.09 - 70, H * 0.06, 140, 140);
    vText(x, s.abbr || team.abbr, cx + side * W * 0.06, H * 0.24, 46, { align: 'center', color: '#ffffff', weight: 0.18 });
    vText(x, String(s.score ?? 0), cx + side * W * 0.04, ys + 60, 120, { align: 'center', color: '#ffffff', weight: 0.16, glow: 12, glowColor: 'rgba(255,255,255,0.5)' });
    // timeouts
    const t = s.timeouts ?? 3;
    for (let k = 0; k < 3; k++) {
      x.fillStyle = k < t ? '#ffd23a' : 'rgba(255,255,255,0.15)';
      x.fillRect(cx + side * W * 0.04 - 45 + k * 32, ys + 84, 24, 8);
    }
    if (st.possession === (side < 0 ? 'home' : 'away')) {
      x.fillStyle = '#ffd23a';
      x.beginPath(); x.ellipse(cx + side * W * 0.04 + side * 95, ys + 18, 14, 9, side * 0.6, 0, 7); x.fill();
    }
  }
  // centre: quarter + clock + play clock
  const q = st.quarter > 4 ? 'OT' : ['1ST', '2ND', '3RD', '4TH'][Math.max(0, (st.quarter || 1) - 1)];
  vText(x, q, W / 2, H * 0.16, 34, { align: 'center', color: '#ffb21e' });
  vText(x, st.clock || '0:00', W / 2, H * 0.38, 76, { align: 'center', color: '#ffffff', weight: 0.15 });
  x.fillStyle = 'rgba(255,40,30,0.18)';
  x.fillRect(W / 2 - 46, H * 0.44, 92, 50);
  vText(x, String(st.playClock ?? ''), W / 2, H * 0.44 + 42, 38, { align: 'center', color: '#ff4a3a' });
  // ticker: down & distance, ball on
  x.fillStyle = 'rgba(255,255,255,0.06)';
  x.fillRect(0, H * 0.72, W, H * 0.2);
  const dn = ['', '1ST', '2ND', '3RD', '4TH'][st.down || 0] || '';
  const dd = dn ? `${dn} & ${st.toGo === 0 ? 'GOAL' : st.toGo ?? ''}` : '';
  const bo = st.ballOn !== undefined && st.ballOn !== null ? `BALL ON ${st.ballOn}` : '';
  vText(x, dd, W * 0.3, H * 0.86, 46, { align: 'center', color: '#ffd23a' });
  vText(x, bo, W * 0.7, H * 0.86, 40, { align: 'center', color: '#e8eef8' });
  if (st.msg) {
    x.fillStyle = 'rgba(0,0,0,0.72)';
    x.fillRect(0, 0, W, H);
    x.fillStyle = home.colors.primary;
    x.fillRect(0, H * 0.3, W, H * 0.4);
    vText(x, String(st.msg).toUpperCase(), W / 2, H * 0.6, 92, { align: 'center', color: '#ffffff', outline: 4, outlineColor: home.colors.dark || '#000', weight: 0.17, glow: 18, glowColor: home.colors.secondary });
  }
  // LED pixel grid
  x.fillStyle = 'rgba(0,0,0,0.22)';
  for (let yy = 0; yy < H; yy += 4) x.fillRect(0, yy, W, 1);
  for (let xx = 0; xx < W; xx += 4) x.fillRect(xx, 0, 1, H);
}

/**
 * kind: 'hs' | 'video'. opts: { home, away, title, sub, w, h, intensity }
 * Returns { texture, material, draw(state), state }.
 */
export function createScoreboard(kind, opts) {
  const W = opts.w || 1024, H = opts.h || (kind === 'hs' ? 512 : 576);
  const [c, x] = cv(W, H);
  const t = tex(c, { repeat: false, aniso: 8 });
  const k = opts.intensity ?? 1.6;
  const material = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(k, k, k), toneMapped: false });
  const board = {
    kind, texture: t, material, canvas: c,
    state: JSON.parse(JSON.stringify(DEFAULT_STATE)),
    draw(st) {
      const s = { ...this.state, ...st, home: { ...this.state.home, ...(st?.home || {}) }, away: { ...this.state.away, ...(st?.away || {}) } };
      this.state = s;
      const key = JSON.stringify(s);
      if (key === this._last) return;
      this._last = key;
      x.save();
      x.setTransform(1, 0, 0, 1, 0, 0);
      if (kind === 'hs') drawHS(x, W, H, s, opts); else drawVideo(x, W, H, s, opts);
      x.restore();
      t.needsUpdate = true;
    },
  };
  board.state.home.abbr = opts.home.abbr;
  board.state.away.abbr = opts.away.abbr;
  board.draw({});
  return board;
}

/** Scrolling LED ribbon (u offset animates): 8 panels of 512 × 128. */
export function ribbonTexture(home, lines, opts = {}) {
  const W = 4096, H = 128;
  const [c, x] = cv(W, H);
  x.fillStyle = '#05060a';
  x.fillRect(0, 0, W, H);
  const n = lines.length;
  const seg = W / n;
  const sec = home.colors.secondary === '#ffffff' ? '#ffd23a' : home.colors.secondary;
  lines.forEach((s, k) => {
    const x0 = k * seg;
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, k % 2 ? home.colors.primary : '#0b0e18');
    g.addColorStop(1, k % 2 ? (home.colors.dark || '#000') : '#05060a');
    x.fillStyle = g;
    x.fillRect(x0, 0, seg, H);
    const size = Math.min(H * 0.56, (seg * 0.86) / Math.max(4, s.length) * 1.25);
    vText(x, s, x0 + seg / 2, H * 0.5 + size / 2, size, { align: 'center', color: k % 2 ? '#ffffff' : sec, weight: 0.17, skew: -0.12 });
    x.fillStyle = sec;
    x.fillRect(x0, 0, seg, 4);
    x.fillRect(x0, H - 4, seg, 4);
  });
  x.fillStyle = 'rgba(0,0,0,0.32)';
  for (let xx = 0; xx < W; xx += 3) x.fillRect(xx, 0, 1, H);
  for (let yy = 0; yy < H; yy += 3) x.fillRect(0, yy, W, 1);
  const t = tex(c, { aniso: 8 });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
