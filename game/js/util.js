// util.js — math, palette, ids, synthesized sound.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const smooth = (t) => t * t * (3 - 2 * t);
export const DEG = Math.PI / 180;

// shortest signed angle from a to b, radians
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function approachAngle(a, b, maxStep) {
  const d = angleDelta(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

export function uid() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export function lobbyCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no lookalikes
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// deterministic hash → [0,1), for procedural worlds
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function hash3(x, y, z, seed = 0) {
  return hash2(Math.imul(x | 0, 31) + (z | 0), (y | 0) * 7 + (z | 0), seed);
}

// ---------------------------------------------------------------- palette
// The world is gray; biomes get muted, faded color. Names are the boxscript
// `color` vocabulary and the voxel-model palette (index order matters — voxel
// data stores base-36 indices into PALETTE_KEYS).
export const COLORS = {
  gray: 0x9a9a9a, darkgray: 0x5c5c5c, lightgray: 0xd6d6d6, silver: 0xc0c4c8,
  white: 0xffffff, black: 0x2b2b2b, cardboard: 0xc9a06b, tape: 0xddd0ae,
  red: 0xc4685c, blue: 0x5f89bd, green: 0x7ba368, yellow: 0xd8bc66,
  orange: 0xd1904f, purple: 0x9179b8, pink: 0xd394b4, brown: 0x8a6a4a,
  sand: 0xd8cba4, grass: 0x86a86b, leaf: 0x6f9159, stone: 0xa8a8a8,
  lava: 0xd4622e, ash: 0x6d6a68, snow: 0xf0f2f4, ice: 0xc8dbe4,
  water: 0x7d9db0,
};

export const PALETTE_KEYS = Object.keys(COLORS);
export const PALETTE_HEX = PALETTE_KEYS.map(k => COLORS[k]);

export function colorOf(name, fallback = COLORS.gray) {
  if (typeof name === 'number') return name;
  return COLORS[String(name).toLowerCase()] ?? fallback;
}

export function shade(hex, amt) {
  const r = clamp(((hex >> 16) & 255) + amt, 0, 255);
  const g = clamp(((hex >> 8) & 255) + amt, 0, 255);
  const b = clamp((hex & 255) + amt, 0, 255);
  return (r << 16) | (g << 8) | b;
}

// ---------------------------------------------------------------- sound
let AC = null;
function ac() {
  if (!AC) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    AC = new C();
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

export function unlockAudio() { try { ac(); } catch (e) { /* no audio */ } }

function tone(freq, dur, type = 'square', peak = 0.14, slide = 0) {
  try {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) { /* ignore */ }
}

function noise(dur, peak = 0.18, lowpass = 2200) {
  try {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = c.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  } catch (e) { /* ignore */ }
}

export const SFX = {
  pop() { noise(0.08, 0.22, 3600); tone(330, 0.07, 'square', 0.09, -200); },
  bigpop() { noise(0.2, 0.28, 2400); tone(180, 0.16, 'square', 0.13, -120); },
  blast() { tone(900, 0.11, 'square', 0.11, -720); noise(0.05, 0.07, 5200); },
  beep() { tone(660, 0.08, 'square', 0.11); },
  boop() { tone(320, 0.11, 'square', 0.11); },
  ding() { tone(1040, 0.24, 'sine', 0.12); tone(1560, 0.18, 'sine', 0.05); },
  crunch() { noise(0.13, 0.2, 850); },
  tock() { tone(240, 0.05, 'square', 0.15, -60); },
  pip() { tone(920, 0.05, 'sine', 0.09); },
  thud() { noise(0.07, 0.13, 460); },
  pickup() { tone(520, 0.06, 'square', 0.08, 180); },
  jump() { tone(400, 0.07, 'square', 0.07, 180); },
  land() { noise(0.05, 0.08, 380); },
  step() { noise(0.03, 0.035, 700); },
  score() { tone(520, 0.09, 'square', 0.09); setTimeout(() => tone(780, 0.12, 'square', 0.09), 90); },
  whoosh() { noise(0.18, 0.09, 1400); },
  hurt() { tone(220, 0.14, 'sawtooth', 0.09, -90); },
};

export function playSound(name) { (SFX[String(name).toLowerCase()] || SFX.beep)(); }
