// Offline audio QA for HARD COUNT. Renders every sound, crowd reaction, band
// piece, music theme and stinger through the real audio graph on an
// OfflineAudioContext in headless Chromium (audio.useContext), then measures
// each render and prints a table:
//
//   peak    sample peak after the master limiter + ceiling (dBFS, must be ≤ −1)
//   M-max   loudest 400 ms window, K-weighted (≈ LUFS momentary max)
//   I       gated integrated loudness (≈ LUFS) — what loops / music sit at
//   len     active length: first → last sample within 50 dB of the peak (s)
//   cent    spectral centroid (Hz), energy-weighted over the active frames
//   corr    L/R correlation (1 = mono, ~0 = wide)
//   bad     non-finite samples (NaN / Infinity)
//
// Each row carries plausibility bounds (centroid, length, loudness); misses
// are flagged. Also checks that every API is safe before audio is unlocked,
// that a late unlock still starts what was asked for, and that loops tear
// down to silence when set to 0.
//
//   node hardcount/tools/audiocheck.mjs [filter] [--wav dir] [--json file] [--list]
//     filter   only rows whose name contains this text (comma = several)
//     --wav    also write each render as a 16-bit WAV into dir (to listen)
//     --json   write all metrics as JSON
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const filter = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['wav', 'json', 'spec'].includes(args[i - 1].slice(2))));
const wavDir = flag('wav');
const specDir = flag('spec');
const jsonOut = flag('json');
const listOnly = args.includes('--list');

// ---------------------------------------------------------------------------
// In-page code: the test list + metrics. Served as a module.
const PAGE_JS = String.raw`
const SR = 48000;
const A = {};
async function load() {
  const imp = async (path, key) => { try { return (await import(path))[key]; } catch (e) { console.error('load ' + path + ': ' + e.message); return null; } };
  A.audio = await imp('/hardcount/src/audio/audio.js', 'audio');
  A.sfx = await imp('/hardcount/src/audio/sfx.js', 'sfx');
  A.crowd = await imp('/hardcount/src/audio/crowd.js', 'crowd');
  A.band = await imp('/hardcount/src/audio/band.js', 'band');
  A.music = await imp('/hardcount/src/audio/music.js', 'music');
  A.voice = await imp('/hardcount/src/audio/voice.js', 'voice');
  A.THEMES = (await imp('/hardcount/src/audio/music/themes.js', 'THEMES')) || {};
}

// spectrogram (log frequency 40 Hz – 14 kHz, 60 dB range relative to the
// render's own maximum) with a peak-level strip on top, as a PNG data URL
function spectrogram(buf, w = 900, h = 300) {
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const N = 2048, n = L.length;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h + 40;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h + 40);
  const img = g.createImageData(w, h);
  const han = new Float32Array(N);
  for (let i = 0; i < N; i++) han[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const fmin = 40, fmax = 14000;
  const fy = (y) => fmin * Math.pow(fmax / fmin, (h - 1 - y) / (h - 1));
  const cols = [];
  let top = -200;
  for (let x = 0; x < w; x++) {
    const s0 = Math.max(0, Math.floor((x / w) * n - N / 2));
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let j = 0; j < N && s0 + j < n; j++) re[j] = (L[s0 + j] + R[s0 + j]) * 0.5 * han[j];
    fft(re, im);
    const col = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      const k0 = Math.max(1, Math.floor(fy(y + 0.5) / (sr / N))), k1 = Math.max(k0, Math.floor(fy(y - 0.5) / (sr / N)));
      let p = 0;
      for (let k = k0; k <= k1; k++) p = Math.max(p, re[k] * re[k] + im[k] * im[k]);
      col[y] = 10 * Math.log10(p + 1e-18);
      if (col[y] > top) top = col[y];
    }
    cols.push(col);
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const v = Math.max(0, Math.min(1, (cols[x][y] - top + 60) / 60));
      const o = (y * w + x) * 4;
      img.data[o] = 255 * Math.min(1, v * 2); img.data[o + 1] = 255 * Math.max(0, v * 2 - 1); img.data[o + 2] = 255 * Math.max(0, 0.6 - v); img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 40);
  g.fillStyle = '#fff'; g.font = '11px monospace';
  for (const f of [100, 300, 1000, 3000, 10000]) g.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), 2, 40 + (h - 1) * (1 - Math.log(f / fmin) / Math.log(fmax / fmin)));
  // level strip
  g.strokeStyle = '#6f6'; g.beginPath();
  for (let x = 0; x < w; x++) {
    const a = Math.floor((x / w) * n), b = Math.floor(((x + 1) / w) * n);
    let p = 0;
    for (let i = a; i < b; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
    const db = 20 * Math.log10(p + 1e-9);
    const y = 38 - Math.max(0, (db + 60) / 60) * 36;
    if (x) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.stroke();
  g.fillText((n / sr).toFixed(2) + 's', w - 40, 12);
  return cv.toDataURL('image/png');
}

// ---- metrics ------------------------------------------------------------------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

function kweight(x, sr) {
  // ITU-R BS.1770 pre-filter (coefficients for 48 kHz)
  const st = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1, -2, 1, -1.99004745483398, 0.99007225036621]];
  let y = Float32Array.from(x);
  for (const [b0, b1, b2, a1, a2] of st) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const xi = y[i];
      const v = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = xi; y2 = y1; y1 = v; y[i] = v;
    }
  }
  return y;
}

function measure(buf, from = 0) {
  const sr = buf.sampleRate;
  const s0 = Math.floor(from * sr);
  const L = buf.getChannelData(0).subarray(s0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1).subarray(s0) : L;
  const n = L.length;
  let peak = 0, bad = 0, ss = 0, sLR = 0, sLL = 0, sRR = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i], r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) { bad++; continue; }
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
    ss += l * l + r * r; sLR += l * r; sLL += l * l; sRR += r * r;
  }
  const db = (v) => (v > 0 ? 20 * Math.log10(v) : -200);
  // perceived length: 10 ms RMS envelope within 30 dB of its maximum (ignores faint echo tails)
  const hop10 = Math.round(0.01 * sr), env10 = [];
  for (let i = 0; i + hop10 <= n; i += hop10) {
    let e = 0;
    for (let j = i; j < i + hop10; j++) e += L[j] * L[j] + R[j] * R[j];
    env10.push(e / hop10);
  }
  const emax10 = Math.max(0, ...env10), thr = emax10 * 1e-3;
  let first = -1, last = -1;
  for (let i = 0; i < env10.length; i++) if (env10[i] > thr) { if (first < 0) first = i; last = i; }
  if (first >= 0) { first *= hop10; last = (last + 1) * hop10; }
  // loudness
  const kL = kweight(L, sr), kR = kweight(R, sr);
  const win = Math.round(0.4 * sr), hop = Math.round(0.1 * sr);
  const blocks = [];
  for (let i = 0; i + win <= n; i += hop) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += kL[j] * kL[j] + kR[j] * kR[j];
    blocks.push(e / win);
  }
  if (!blocks.length) { let e = 0; for (let j = 0; j < n; j++) e += kL[j] * kL[j] + kR[j] * kR[j]; blocks.push(e / Math.max(1, n)); }
  const lufs = (e) => (e > 0 ? -0.691 + 10 * Math.log10(e) : -200);
  const mmax = Math.max(...blocks.map(lufs));
  let gated = blocks.filter((e) => lufs(e) > -70);
  if (gated.length) {
    const rel = lufs(gated.reduce((a, b) => a + b, 0) / gated.length) - 10;
    gated = gated.filter((e) => lufs(e) > rel);
  }
  const integ = gated.length ? lufs(gated.reduce((a, b) => a + b, 0) / gated.length) : -200;
  // spectral centroid over frames within 30 dB of the loudest
  const N = 2048, hopF = 1024, han = new Float32Array(N);
  for (let i = 0; i < N; i++) han[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const frames = [];
  for (let i = 0; i + N <= n; i += hopF) {
    const re = new Float64Array(N), im = new Float64Array(N);
    let e = 0;
    for (let j = 0; j < N; j++) { const v = (L[i + j] + R[i + j]) * 0.5; re[j] = v * han[j]; e += v * v; }
    if (e <= 1e-12) continue;
    fft(re, im);
    // power-weighted: robust to a low broadband noise floor
    let num = 0, den = 0;
    for (let k = 1; k < N / 2; k++) { const m = re[k] * re[k] + im[k] * im[k]; num += m * k * sr / N; den += m; }
    if (den > 0) frames.push({ e, c: num / den });
  }
  let cent = 0;
  if (frames.length) {
    const emax = Math.max(...frames.map((f) => f.e));
    let w = 0;
    for (const f of frames) if (f.e > emax * 1e-3) { cent += f.c * f.e; w += f.e; }
    cent = w > 0 ? cent / w : 0;
  }
  const corr = sLL > 0 && sRR > 0 ? sLR / Math.sqrt(sLL * sRR) : 1;
  return {
    peak: db(peak), rms: db(Math.sqrt(ss / Math.max(1, 2 * n))), mmax, integ,
    len: first >= 0 ? (last - first) / sr : 0, start: first >= 0 ? first / sr : 0,
    cent, corr, bad,
  };
}

function tailRms(buf, secs) {
  const sr = buf.sampleRate, n = Math.round(secs * sr);
  let s = 0, c = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = Math.max(0, d.length - n); i < d.length; i++) { s += d[i] * d[i]; c++; }
  }
  const r = Math.sqrt(s / Math.max(1, c));
  return r > 0 ? 20 * Math.log10(r) : -200;
}

// Frame-stepped helper: call fn(t, dt) every dt seconds of render time.
function frames(ctx, dur, dt, fn) {
  for (let t = dt; t < dur - 1e-6; t += dt) {
    const tt = Math.round(t * SR / 128) * 128 / SR; // suspend needs render-quantum boundaries
    ctx.suspend(tt).then(() => { try { fn(tt, dt); } catch (e) { console.error(e); } ctx.resume(); });
  }
}

// ---- the test list ------------------------------------------------------------------
// expect: { cent: [lo, hi] Hz, len: [lo, hi] s, mmax: [lo, hi] LUFS, integ: [lo, hi] LUFS }
const T = [];
const add = (name, cat, dur, run, expect = {}, opts = {}) => T.push({ name, cat, dur, run, expect, ...opts });

function sfxTests() {
  const S = () => A.sfx;
  for (const k of ['short', 'long', 'double']) add('whistle:' + k, 'sfx', 2.5, () => S().whistle(k), { cent: [2000, 4500], len: k === 'long' ? [0.9, 2] : k === 'double' ? [0.35, 1.1] : [0.2, 0.8], mmax: [-26, -9] });
  for (const k of ['pads', 'helmet', 'ground', 'tackle']) {
    const c = { pads: [150, 1300], helmet: [700, 3500], ground: [80, 900], tackle: [120, 1500] }[k];
    add('hit:' + k + ':1', 'sfx', 2, () => S().hit(1, k), { cent: c, len: [0.1, k === 'tackle' ? 1.6 : 1.2], mmax: [-24, -9] });
    add('hit:' + k + ':.3', 'sfx', 2, () => S().hit(0.3, k), { cent: [c[0] * 0.6, c[1]], mmax: [-36, -14] });
  }
  for (const k of ['hands', 'body', 'bobble']) add('catch:' + k, 'sfx', 1.5, () => S().catchBall(k), { cent: [200, 3000], len: [0.04, 0.9], mmax: [-30, -12] });
  for (const k of ['kickoff', 'punt', 'fg']) add('kick:' + k, 'sfx', 2.5, () => S().kickBall(k), { cent: [200, 2500], len: [0.3, 1.8], mmax: [-26, -9] });
  add('snap', 'sfx', 1.5, () => S().snap(), { cent: [200, 3000], len: [0.05, 1], mmax: [-32, -12] });
  for (const k of ['set', 'hut', 'hard']) add('cadence:' + k, 'sfx', 1.5, () => S().cadence(k), { cent: [600, 3200], len: [0.15, 1.2], mmax: [-26, -9] });
  add('ballBounce:1', 'sfx', 1.5, () => S().ballBounce(1), { cent: [150, 2000], len: [0.04, 0.8], mmax: [-30, -10] });
  add('ballBounce:series', 'sfx', 3, (ctx) => {
    const seq = [[0, 1], [0.42, 0.62], [0.71, 0.4], [0.86, 0.28], [0.95, 0.15], [1.02, 0.08]];
    for (const [t, s] of seq) { if (t === 0) S().ballBounce(s); else ctx.suspend(Math.round(t * SR / 128) * 128 / SR).then(() => { S().ballBounce(s); ctx.resume(); }); }
  }, { cent: [150, 2000], len: [0.8, 1.6] });
  add('flagThrow', 'sfx', 1.5, () => S().flagThrow(), { cent: [200, 3000], len: [0.2, 1.2], mmax: [-36, -12] });
  add('chains', 'sfx', 2, () => S().chains(), { cent: [1500, 6000], len: [0.3, 1.8], mmax: [-34, -12] });
  for (const k of ['chime', 'horn', 'organ_charge', 'organ_defense', 'organ_letsgo']) {
    add('pa:' + k, 'pa', 7, () => S().pa(k), { cent: k === 'chime' ? [500, 3500] : k === 'horn' ? [300, 2500] : [300, 2500], len: [0.8, 7], mmax: [-24, -9] });
  }
  for (const k of ['move', 'select', 'back', 'tab', 'error', 'buy', 'unlock']) add('ui:' + k, 'ui', 1.4, () => S().ui(k), { mmax: [-34, -12] });
  add('staticBurst', 'ui', 1.2, () => S().staticBurst(0.5), { cent: [1500, 6000], mmax: [-30, -10] });
  add('tvOn', 'ui', 3, () => S().tvOn(), { mmax: [-30, -10] });
  add('tvOff', 'ui', 1.2, () => S().tvOff(), { mmax: [-30, -10] });
  add('knob', 'ui', 0.5, () => S().knob(), { mmax: [-40, -14] });
  add('phone', 'ui', 2.2, () => S().phone(), { mmax: [-30, -12] });
  // loops (measured after a 1 s settle) and teardown: run 4 s, set 0, check silence at the end
  const loop = (name, fn, expect) => add(name, 'loop', 9, (ctx) => {
    fn(1);
    frames(ctx, 9, 0.05, (t) => fn(t < 4 ? 1 : 0));
  }, expect, { from: 1, until: 4, tail: 1.2, teardown: () => !Object.keys(A.sfx._loops || {}).length });
  loop('footsteps', (v) => S().footsteps(v), { cent: [300, 3000], integ: [-36, -16] });
  loop('rain', (v) => S().rain(v), { cent: [1500, 7000], integ: [-34, -16] });
  loop('wind', (v) => S().wind(v), { cent: [200, 2500], integ: [-38, -16] });
  for (const k of ['stadium', 'dome', 'park', 'bedroom']) {
    add('ambience:' + k, 'loop', 12, (ctx) => {
      S().ambience(k);
      ctx.suspend(Math.round(8 * SR / 128) * 128 / SR).then(() => { S().ambience(null); ctx.resume(); });
    }, { integ: [-52, -24] }, { from: 1.5, until: 8, tail: 1, teardown: () => !A.sfx._bed });
  }
}

function crowdTests() {
  const C = () => A.crowd;
  const bed = (name, st, expect) => add(name, 'crowd', 8, (ctx) => {
    C().update(0.05, st);
    frames(ctx, 8, 0.05, (t, dt) => C().update(dt, st));
  }, expect, { from: 3 });
  bed('crowd:bed calm small', { excitement: 0.1, size: 0.15, home: 0.7, indoor: false }, { integ: [-44, -24], cent: [300, 2500] });
  bed('crowd:bed calm big', { excitement: 0.15, size: 1, home: 0.7, indoor: false }, { integ: [-36, -18], cent: [300, 2500] });
  bed('crowd:bed loud big', { excitement: 0.9, size: 1, home: 0.7, indoor: false }, { integ: [-28, -12], cent: [400, 3000] });
  bed('crowd:bed loud dome', { excitement: 0.9, size: 1, home: 0.7, indoor: true }, { integ: [-28, -12], cent: [300, 3000] });
  const lens = { cheer: [1.2, 6], roar: [3, 12], ooh: [0.8, 4], aah: [1, 4.5], groan: [0.8, 4], boo: [1.2, 5], gasp: [0.3, 2.5], murmur: [1.5, 6], clap: [2, 10], chant: [3, 12], stomp: [2, 10] };
  for (const k of Object.keys(lens)) {
    add('crowd:' + k, 'crowd', 12, (ctx) => {
      const st = { excitement: 0.25, size: 0.9, home: 0.8 };
      C().update(0.05, st);
      frames(ctx, 12, 0.05, (t, dt) => C().update(dt, st));
      ctx.suspend(Math.round(1.0 * SR / 128) * 128 / SR).then(() => { C().react(k, 1); ctx.resume(); });
    }, { cent: [250, 3500], mmax: [-26, -9] }, { from: 0.9, reaction: true, lenExpect: lens[k] });
  }
}

function bandTests() {
  const B = () => A.band;
  for (const k of ['cadence', 'fight', 'charge']) {
    const dur = k === 'charge' ? 8 : k === 'fight' ? 40 : 16;
    add('band:' + k, 'band', dur, (ctx) => {
      B().play(k);
      frames(ctx, dur, 0.05, () => B().update());
      if (k === 'cadence') ctx.suspend(Math.round((dur - 4) * SR / 128) * 128 / SR).then(() => { B().play(null); ctx.resume(); });
    }, { cent: k === 'cadence' ? [500, 4500] : [400, 3500], integ: [-30, -12] }, { tail: k === 'cadence' ? 1 : 0, teardown: k === 'cadence' ? () => !B().playing : null });
  }
}

function musicTests() {
  const M = () => A.music;
  const names = Object.keys(A.THEMES);
  for (const th of names) {
    add('music:' + th, 'music', 24, (ctx) => {
      M().play(th, { fade: 0.05 });
      M()._schedule(24);
    }, { integ: [-26, -12] }, { from: 0.5 });
  }
  for (const st of ['td', 'turnover', 'bigplay', 'kickoff', 'win', 'lose', 'twominute']) {
    add('stinger:' + st, 'stinger', 6, () => { M().stop(0.01); M().stinger(st); }, { mmax: [-24, -9], len: [0.6, 6] });
  }
  add('stinger:td over playcall', 'stinger', 10, (ctx) => {
    M().play('playcall', { fade: 0.05 });
    M()._schedule(10);
    ctx.suspend(Math.round(4 * SR / 128) * 128 / SR).then(() => { M().stinger('td'); M()._schedule(10); ctx.resume(); });
  }, { integ: [-26, -12] });
  add('music:gamestate', 'music', 20, (ctx) => {
    M().play('playcall', { fade: 0.05 });
    M().setGameState({ quarter: 1, clock: 600, scoreDiff: 0, redZone: false, twoMinute: false, playLive: false });
    M()._schedule(20);
    ctx.suspend(Math.round(6 * SR / 128) * 128 / SR).then(() => { M().setGameState({ quarter: 4, clock: 110, scoreDiff: -4, redZone: true, twoMinute: true }); M()._schedule(20); ctx.resume(); });
    ctx.suspend(Math.round(13 * SR / 128) * 128 / SR).then(() => { M().setGameState({ playLive: true }); M()._schedule(20); ctx.resume(); });
  }, { integ: [-30, -12] });
}

const GROUPS = { sfx: sfxTests, crowd: crowdTests, band: bandTests, music: musicTests };

// ---- safety: every API before unlock, then a late unlock --------------------------
async function preUnlockCheck() {
  const errs = [];
  const tryit = (label, fn) => { try { fn(); } catch (e) { errs.push(label + ': ' + e.message); } };
  const { sfx, crowd, band, music, voice } = A;
  tryit('sfx.whistle', () => sfx.whistle('short'));
  tryit('sfx.hit', () => sfx.hit(0.8, 'pads'));
  tryit('sfx.catchBall', () => sfx.catchBall('hands'));
  tryit('sfx.kickBall', () => sfx.kickBall('punt'));
  tryit('sfx.snap', () => sfx.snap());
  tryit('sfx.cadence', () => sfx.cadence('hut'));
  tryit('sfx.ballBounce', () => sfx.ballBounce(0.5));
  tryit('sfx.footsteps', () => sfx.footsteps(0.7));
  tryit('sfx.pa', () => sfx.pa('horn'));
  tryit('sfx.flagThrow', () => sfx.flagThrow());
  tryit('sfx.chains', () => sfx.chains());
  tryit('sfx.rain', () => sfx.rain(0.5));
  tryit('sfx.wind', () => sfx.wind(0.5));
  tryit('sfx.ambience', () => sfx.ambience('stadium'));
  tryit('sfx.ui', () => sfx.ui('move'));
  tryit('sfx.staticBurst', () => sfx.staticBurst(0.3));
  tryit('sfx.tvOn', () => sfx.tvOn());
  tryit('crowd.update', () => crowd.update(0.016, { excitement: 0.5, size: 0.8, home: 0.6, indoor: false }));
  tryit('crowd.react', () => crowd.react('cheer', 1));
  tryit('band.play', () => band.play('cadence'));
  tryit('band.update', () => band.update());
  tryit('music.play', () => music.play('hud_glory'));
  tryit('music.setGameState', () => music.setGameState({ quarter: 2, clock: 100, scoreDiff: 3, twoMinute: true }));
  tryit('music.stinger', () => music.stinger('td'));
  tryit('music.update', () => music.update());
  tryit('music.beatInfo', () => music.beatInfo());
  tryit('voice.say', () => voice.say('Touchdown', { kind: 'pa' }));
  // late unlock: what was asked before must start now
  const ctx = new OfflineAudioContext(2, SR * 6, SR);
  A.audio.useContext(ctx);
  frames(ctx, 6, 0.05, (t, dt) => { crowd.update(dt, { excitement: 0.5, size: 0.8, home: 0.6 }); band.update(); music.update(); });
  music._schedule(6);
  const buf = await ctx.startRendering();
  const m = measure(buf, 2);
  return { errs, lateUnlock: { music: music.theme, band: band.current, loudness: m.integ, bad: m.bad } };
}

async function runOne(t, withWav) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * t.dur), SR);
  A.audio.useContext(ctx);
  // fresh engine state per test
  try { A.music.stop(0.01); } catch { /* */ }
  const c0 = performance.now();
  await t.run(ctx);
  const c1 = performance.now();
  const buf = await ctx.startRendering();
  const c2 = performance.now();
  let span = buf;
  const from = t.from || 0;
  const until = t.until;
  if (until) {
    const n = Math.round((until - from) * SR);
    span = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: SR });
    for (let ch = 0; ch < 2; ch++) span.getChannelData(ch).set(buf.getChannelData(ch).subarray(Math.round(from * SR), Math.round(from * SR) + n));
  }
  const m = measure(span, until ? 0 : from);
  const full = measure(buf);
  m.peak = full.peak; // the ceiling applies to the whole render
  m.bad = full.bad;
  if (t.reaction) m.len = measureReaction(buf, from);
  m.setupMs = c1 - c0;
  m.renderMs = c2 - c1;
  if (t.tail) m.tail = tailRms(buf, t.tail);
  if (t.teardown) m.torn = !!t.teardown();
  let wav = null, spec = null;
  if (withWav === true || withWav === 'wav') wav = toWav(buf);
  if (withWav === 'spec') spec = spectrogram(buf);
  return { m, wav, spec };
}

// reaction length: time the reaction stays within 20 dB of its own peak above the bed
function measureReaction(buf, from) {
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1);
  const hop = Math.round(0.05 * sr), env = [];
  for (let i = Math.round(from * sr); i + hop <= L.length; i += hop) {
    let e = 0;
    for (let j = i; j < i + hop; j++) e += L[j] * L[j] + R[j] * R[j];
    env.push(10 * Math.log10(e / hop + 1e-12));
  }
  const base = Math.min(...env.slice(0, 2));
  let pk = -Infinity, pi = 0;
  env.forEach((v, i) => { if (v > pk) { pk = v; pi = i; } });
  const thr = Math.max(base + 3, pk - 20);
  let a = pi, b = pi;
  while (a > 0 && env[a - 1] > thr) a--;
  while (b < env.length - 1 && env[b + 1] > thr) b++;
  return (b - a + 1) * 0.05;
}

function toWav(buf) {
  const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i] || 0)); out.setInt16(o, v * 32767, true); o += 2; }
  const bytes = new Uint8Array(out.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

window.__ac = {
  async list() {
    await load();
    T.length = 0;
    for (const g of Object.values(GROUPS)) g();
    return T.map((t) => ({ name: t.name, cat: t.cat }));
  },
  async run(name, withWav) {
    const t = T.find((x) => x.name === name);
    const r = await runOne(t, withWav);
    return { name, cat: t.cat, expect: t.expect, lenExpect: t.lenExpect || null, ...r };
  },
  async pre() { return preUnlockCheck(); },
};
window.__acReady = true;
`;

const PAGE_HTML = '<!doctype html><meta charset="utf-8"><title>audiocheck</title><script type="module" src="/__audiocheck.js"></script>';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/__audiocheck.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE_HTML); return; }
  if (p === '/__audiocheck.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(PAGE_JS); return; }
  try {
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('nope');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/__audiocheck.html`);
await page.waitForFunction(() => window.__acReady === true, null, { timeout: 20000 });

const all = await page.evaluate(() => window.__ac.list());
const wanted = filter ? all.filter((t) => filter.split(',').some((f) => t.name.includes(f))) : all;
if (listOnly) {
  for (const t of wanted) console.log(t.cat.padEnd(8), t.name);
  await browser.close();
  server.close();
  process.exit(0);
}

const fmt = (v, d = 1) => (v <= -199 ? '  -inf' : v.toFixed(d).padStart(6));
const inRange = (v, r) => !r || (v >= r[0] && v <= r[1]);
const rows = [];
let fails = 0;
if (wavDir) await mkdir(resolve(wavDir), { recursive: true });
if (specDir) await mkdir(resolve(specDir), { recursive: true });
console.log('name'.padEnd(30), '  peak', ' M-max', '     I', '  len', '   cent', ' corr', ' ms(set/ren)', ' notes');
for (const t of wanted) {
  let r;
  try {
    r = await page.evaluate(([n, w]) => window.__ac.run(n, w), [t.name, specDir ? 'spec' : wavDir ? 'wav' : false]);
  } catch (e) {
    console.log(t.name.padEnd(30), 'ERROR', e.message.split('\n')[0]);
    fails++;
    continue;
  }
  const m = r.m, ex = r.expect || {};
  const notes = [];
  if (m.bad) notes.push(`${m.bad} NaN/Inf`);
  if (m.peak > -1.0) notes.push('PEAK>-1');
  if (m.integ < -60) notes.push('SILENT');
  if (!inRange(m.cent, ex.cent)) notes.push(`cent∉[${ex.cent}]`);
  const lenR = r.lenExpect || ex.len;
  if (!inRange(m.len, lenR)) notes.push(`len∉[${lenR}]`);
  if (!inRange(m.mmax, ex.mmax)) notes.push(`M∉[${ex.mmax}]`);
  if (!inRange(m.integ, ex.integ)) notes.push(`I∉[${ex.integ}]`);
  if (m.tail != null && m.tail > -70) notes.push(`tail ${m.tail.toFixed(0)}dB`);
  if (m.torn === false) notes.push('NOT TORN DOWN');
  if (notes.length) fails++;
  rows.push({ name: t.name, cat: t.cat, ...m, notes });
  console.log(t.name.padEnd(30), fmt(m.peak), fmt(m.mmax), fmt(m.integ), m.len.toFixed(2).padStart(5), String(Math.round(m.cent)).padStart(7),
    m.corr.toFixed(2).padStart(5), `${m.setupMs.toFixed(0).padStart(5)}/${m.renderMs.toFixed(0).padEnd(5)}`, notes.join(' '));
  if (wavDir && r.wav) await writeFile(join(resolve(wavDir), t.name.replace(/[^a-z0-9_.-]+/gi, '_') + '.wav'), Buffer.from(r.wav, 'base64'));
  if (specDir && r.spec) await writeFile(join(resolve(specDir), t.name.replace(/[^a-z0-9_.-]+/gi, '_') + '.png'), Buffer.from(r.spec.split(',')[1], 'base64'));
}

if (!filter || filter.includes('pre')) {
  const pre = await page.evaluate(() => window.__ac.pre());
  console.log('\nbefore-unlock API calls:', pre.errs.length ? pre.errs.join('; ') : 'all safe');
  console.log('late unlock:', JSON.stringify(pre.lateUnlock));
  if (pre.errs.length || !pre.lateUnlock.music || pre.lateUnlock.loudness < -60) fails++;
}
if (errors.length) console.log('\n' + errors.slice(0, 30).join('\n'));
if (jsonOut) await writeFile(resolve(jsonOut), JSON.stringify(rows, null, 1));
console.log(`\n${rows.length} renders, ${fails} with notes`);
await browser.close();
server.close();
process.exit(0);
