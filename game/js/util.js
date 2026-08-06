// util.js — shared helpers: math, pixel font, synth sounds, ids.

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function uid() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export function lobbyCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1 lookalikes
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ---------------------------------------------------------------- palette
export const PAL = {
  bg: '#ffffff',
  ground: '#ececec',
  groundEdge: '#d2d2d2',
  stick: '#787878',
  stickDark: '#5c5c5c',
  card: '#c9a06b',   // cardboard
  cardDark: '#a87f4f',
  cardLight: '#e2c295',
  tape: '#ddd0ae',
  bolt: '#b8b8b8',
  ink: '#9a9a9a',
  imBlue: '#0b93f6',
  imGray: '#e5e5ea',
};

// Editor / boxscript color names → css. Mostly grays plus a few muted accents.
export const COLORS = {
  gray: '#9a9a9a', darkgray: '#5c5c5c', lightgray: '#d6d6d6', silver: '#c0c4c8',
  white: '#ffffff', black: '#2b2b2b', cardboard: '#c9a06b',
  red: '#d96b5f', blue: '#5f8fd9', green: '#7fb069', yellow: '#e0c26a',
  purple: '#a07fd9', orange: '#dd9a5b', pink: '#e39cc0', brown: '#8a6a4a',
};

// ---------------------------------------------------------------- pixel font
// 3x5 caps font for in-world text (scores, signs, labels).
const F = {
  'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011',
  'D': '110101101101110', 'E': '111100110100111', 'F': '111100110100100',
  'G': '011100101101011', 'H': '101101111101101', 'I': '111010010010111',
  'J': '001001001101010', 'K': '101110100110101', 'L': '100100100100111',
  'M': '101111111101101', 'N': '101111111111101', 'O': '010101101101010',
  'P': '110101110100100', 'Q': '010101101110011', 'R': '110101110110101',
  'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101011',
  'V': '101101101010010', 'W': '101101111111101', 'X': '101010010010101',
  'Y': '101101010010010', 'Z': '111001010100111',
  '0': '010101101101010', '1': '010110010010111', '2': '110001010100111',
  '3': '110001010001110', '4': '101101111001001', '5': '111100110001110',
  '6': '011100110101010', '7': '111001010010010', '8': '010101010101010',
  '9': '010101011001110', ' ': '000000000000000', '-': '000000111000000',
  ':': '000010000010000', '.': '000000000000010', '!': '010010010000010',
  '?': '110001010000010', '+': '000010111010000', "'": '010010000000000',
  ',': '000000000010100', '/': '001001010100100', '(': '001010010010001',
  ')': '100010010010100', '"': '101101000000000', '_': '000000000000111',
  '=': '000111000111000', '>': '100010001010100', '<': '001010100010001',
};

// Draw pixel text at (x,y) top-left, in world-pixel units. scale = px per dot.
export function pixelText(ctx, str, x, y, scale = 1, color = PAL.ink) {
  ctx.fillStyle = color;
  str = String(str).toUpperCase();
  let cx = x;
  for (const ch of str) {
    const g = F[ch] || F['?'];
    for (let i = 0; i < 15; i++) {
      if (g[i] === '1') {
        ctx.fillRect(cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
      }
    }
    cx += 4 * scale;
  }
  return cx - x;
}

export function pixelTextWidth(str, scale = 1) {
  return String(str).length * 4 * scale - scale;
}

// Hand-drawn lowercase "game" title, 1 = pixel. Each letter is a grid; g has a descender.
export const TITLE_LETTERS = {
  g: ['011110', '110011', '110011', '110011', '011111', '000011', '110011', '011110'],
  a: ['011110', '000011', '011111', '110011', '110011', '011111', '000000', '000000'],
  m: ['111110', '110101', '110101', '110101', '110101', '110101', '000000', '000000'],
  e: ['011110', '110011', '111111', '110000', '110011', '011110', '000000', '000000'],
};

export function drawTitle(ctx, word, x, y, scale, color) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of word) {
    const g = TITLE_LETTERS[ch];
    if (!g) { cx += 7 * scale; continue; }
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[r].length; c++) {
        if (g[r][c] === '1') ctx.fillRect(cx + c * scale, y + (r - 5) * scale, scale, scale);
      }
    }
    cx += 7 * scale;
  }
  return cx - x - scale;
}

export function titleWidth(word, scale) { return word.length * 7 * scale - scale; }

// ---------------------------------------------------------------- sounds
// All audio is synthesized — no asset files. Tiny, dry, toy-like.
let AC = null;
function ac() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

function env(g, t, a, d, peak = 0.3) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.001, t + a + d);
}

function tone(freq, dur, type = 'square', peak = 0.15, slide = 0) {
  try {
    const c = ac(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    env(g, t, 0.005, dur, peak);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) { /* no audio available */ }
}

function noise(dur, peak = 0.2, lowpass = 2000) {
  try {
    const c = ac(), t = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = c.createGain(); env(g, t, 0.002, dur, peak);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  } catch (e) { /* no audio available */ }
}

export const SFX = {
  pop() { noise(0.09, 0.25, 3500); tone(320, 0.08, 'square', 0.1, -200); },
  bigpop() { noise(0.18, 0.3, 2500); tone(180, 0.15, 'square', 0.14, -120); },
  blast() { tone(880, 0.12, 'square', 0.12, -700); noise(0.05, 0.08, 5000); },
  beep() { tone(660, 0.09, 'square', 0.12); },
  boop() { tone(330, 0.12, 'square', 0.12); },
  ding() { tone(1040, 0.25, 'sine', 0.14); tone(1560, 0.2, 'sine', 0.06); },
  crunch() { noise(0.12, 0.22, 900); },
  tock() { tone(240, 0.05, 'square', 0.16, -60); },
  pip() { tone(920, 0.05, 'sine', 0.1); },
  thud() { noise(0.07, 0.14, 500); },
  pickup() { tone(520, 0.06, 'square', 0.09, 180); },
  score() { tone(520, 0.09, 'square', 0.1); setTimeout(() => tone(780, 0.12, 'square', 0.1), 90); },
};

export function playSound(name) { (SFX[name] || SFX.beep)(); }

// word wrap for canvas text
export function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
