/**
 * CHROMA CLASH — audio.js
 * ---------------------------------------------------------------------------
 * Fully synthesized sound effects, ambience loops and procedural music.
 * No samples, no URLs, no imports: everything is built from WebAudio
 * oscillators, generated noise / impulse buffers, filters, waveshapers and
 * envelopes — including a distorted guitar rig and a formant "singer" that
 * sings playful nonsense syllables.
 *
 * Safe to import anywhere (Node, SSR, workers): nothing touches WebAudio
 * until init() is called, and every exported function is a silent no-op
 * when audio is unavailable. Nothing here throws.
 *
 *   import { audio } from './audio.js';
 *   addEventListener('pointerdown', () => audio.init());   // any user gesture
 *   audio.music('title');                // remembered and started on init()
 *   audio.sfx('shoot', { x, y, z });     // spatial one-shot (omit xyz for 2D/UI)
 *   const swim = audio.loop('swim');     // loops made before init() start on init()
 *   swim.setVolume(speed01); swim.stop();
 *
 * Graph:  sfx voices ──→ sfxBus ─────────────────────────────────┐
 *         tracks → musicBus → EQ → music comp → duck ────────────┼→ glue comp → limiter → soft clip → master → out
 *         (shared hall / room / sfx reverbs return into their buses)
 */

// ───────────────────────────── state ──────────────────────────────
const ROOT = typeof globalThis !== 'undefined' ? globalThis : {};
let ctx = null;
let master, sfxBus, musicBus, musicDuck, sfxRev, musicRev, roomRev;
let noiseBuf, pinkBuf, gritCurve, warmCurve, glottalWave;
const GTR = {}; // drive name -> { curve, cab, mid, out }
let muted = false;
const vol = { master: 0.8, sfx: 1, music: 0.7 };
const MASTER_TRIM = 1.0; // the soft clipper already ceilings at -0.2 dBFS
const SFX_TRIM = 1.0;
const MUSIC_TRIM = 0.42; // music sits under the sfx
const listener = { x: 0, y: 0, z: 0, yaw: 0 };
let warnCount = 0;
function warn(e) {
  if (warnCount++ < 5 && typeof console !== 'undefined') console.warn('[audio]', e);
}

// ───────────────────────────── small helpers ──────────────────────
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const semis = (p) => 12 * Math.log2(p); // pitch multiplier → semitones
const hz = (f) => clamp(f, 10, 18000);
const own = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
const hasPos = (o) => !!o && (o.x != null || o.y != null || o.z != null);
let _end = 0; // latest end time scheduled by the current generator
const mark = (e) => (e > _end ? (_end = e) : e);

/** Connect a → b → c …; returns the last node. */
function wire(...n) {
  for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]);
  return n[n.length - 1];
}
function unplug(nodes) {
  for (const n of nodes) {
    try { n.disconnect(); } catch { /* already gone */ }
  }
}
function halt(srcs, t) {
  for (const s of srcs) {
    try { s.stop(t); } catch { /* already stopped */ }
  }
}
/** Wrap a public function so it can never throw. */
function guard(fn, fallback) {
  return (...a) => {
    try {
      return fn(...a);
    } catch (e) {
      warn(e);
      return typeof fallback === 'function' ? fallback() : fallback;
    }
  };
}

function mkGain(v = 1) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}
function mkFilter(type, f, q = 0.7) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = hz(f);
  b.Q.value = q;
  return b;
}
function mkOsc(type, f, det = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = Math.min(hz(f), 16000);
  if (det) o.detune.value = det;
  return o;
}
function mkPan(v = 0) {
  if (!ctx.createStereoPanner) return mkGain(1); // very old browsers: no panning
  const p = ctx.createStereoPanner();
  p.pan.value = clamp(v, -1, 1);
  return p;
}
function mkComp(th, knee, ratio, atk, rel) {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = th;
  c.knee.value = knee;
  c.ratio.value = ratio;
  c.attack.value = atk;
  c.release.value = rel;
  return c;
}
function mkDelay(sec, max = 1) {
  const d = ctx.createDelay(max);
  d.delayTime.value = sec;
  return d;
}

/** Attack → hold → exponential decay. Returns the end time. */
function env(p, t, a, h, d, peak) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  if (h > 0) p.setValueAtTime(peak, t + a + h);
  p.exponentialRampToValueAtTime(0.0001, t + a + h + d);
  return t + a + h + d;
}
/** ADSR with gate length `dur`. Returns the time it is silent. */
function adsr(p, t, a, d, s, r, dur, peak) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  if (s < 1) p.setTargetAtTime(peak * s, t + a, d / 3);
  const off = Math.max(t + a, t + dur);
  p.setTargetAtTime(0, off, r / 5);
  return off + r * 1.25;
}

function noiseSrc(buf, t, dur, rate = 1, loop = false) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  if (loop) {
    s.loop = true;
    s.start(t, Math.random() * buf.duration * 0.9);
  } else {
    s.start(t, Math.random() * Math.max(0, buf.duration - dur * rate - 0.05));
    s.stop(t + dur);
  }
  return s;
}

/** Oscillator one-shot. o: { type, to, dt, a, h, d, g, det, lp, q, vib:[rateHz, depthHz] } */
function tone(dest, t, f, o = {}) {
  const a = o.a ?? 0.003, h = o.h || 0, dc = o.d ?? 0.15, g = o.g ?? 0.3;
  const os = mkOsc(o.type || 'sine', f, o.det), gn = mkGain(0);
  os.frequency.setValueAtTime(Math.min(hz(f), 16000), t);
  if (o.to) os.frequency.exponentialRampToValueAtTime(Math.min(hz(o.to), 16000), t + (o.dt || a + h + dc));
  const end = env(gn.gain, t, a, h, dc, g) + 0.015;
  if (o.vib) {
    const l = mkOsc('sine', o.vib[0]);
    wire(l, mkGain(o.vib[1]), os.frequency);
    l.start(t);
    l.stop(end);
  }
  if (o.lp) wire(os, mkFilter('lowpass', o.lp, o.q ?? 0.7), gn, dest);
  else wire(os, gn, dest);
  os.start(t);
  os.stop(end);
  os.onended = () => gn.disconnect();
  return mark(end);
}

/** Filtered noise one-shot. o: { ft, f, to, dt, sw:[[dt,f],..], q, a, h, d, g, rate, pink, am:[rateHz, depth] } */
function noise(dest, t, o = {}) {
  const a = o.a ?? 0.002, h = o.h || 0, dc = o.d ?? 0.1, g = o.g ?? 0.3;
  const dur = a + h + dc + 0.02, f0 = hz(o.f || 1000);
  const s = noiseSrc(o.pink ? pinkBuf : noiseBuf, t, dur, o.rate || 1);
  const fl = mkFilter(o.ft || 'bandpass', f0, o.q ?? 1), gn = mkGain(0);
  fl.frequency.setValueAtTime(f0, t);
  if (o.sw) for (const [dt, fv] of o.sw) fl.frequency.exponentialRampToValueAtTime(hz(fv), t + dt);
  else if (o.to) fl.frequency.exponentialRampToValueAtTime(hz(o.to), t + (o.dt || a + h + dc));
  env(gn.gain, t, a, h, dc, g);
  if (o.am) {
    // amplitude flutter (bristles, rattles): gain = 1 ± depth
    const am = mkGain(1 - o.am[1] / 2), l = mkOsc('square', o.am[0]);
    wire(l, mkGain(o.am[1] / 2), am.gain);
    wire(s, fl, am, gn, dest);
    l.start(t);
    l.stop(t + dur);
  } else wire(s, fl, gn, dest);
  s.onended = () => gn.disconnect();
  return mark(t + dur);
}

/** A tiny two-formant "syllable" (NPC talk, crowd chatter). */
const VOWELS = [[730, 1090], [270, 2290], [530, 1840], [570, 840], [300, 870], [660, 1720], [490, 1350], [400, 2000]];
function syllable(dest, t, f0, F1, F2, dur, g, pan = null) {
  const os = mkOsc('sawtooth', f0), gn = mkGain(0);
  os.frequency.setValueAtTime(hz(f0), t);
  os.frequency.linearRampToValueAtTime(hz(f0 * rnd(0.85, 1.2)), t + dur);
  env(gn.gain, t, 0.012, dur, 0.05, g);
  wire(os, mkFilter('bandpass', F1, 5), gn);
  wire(os, mkFilter('bandpass', F2, 7), gn);
  const last = pan != null ? wire(gn, mkPan(pan)) : gn;
  last.connect(dest);
  const end = t + 0.012 + dur + 0.07;
  os.start(t);
  os.stop(end);
  os.onended = () => last.disconnect();
  return mark(end);
}

/** Little ink droplets flying off a splash. */
function droplets(dest, t, n, span, lo, hi, g) {
  for (let i = 0; i < n; i++) {
    const f = rnd(lo, hi);
    tone(dest, t + Math.random() * span, f, { to: f * rnd(1.4, 2.2), dt: 0.035, a: 0.001, d: 0.045, g: g * rnd(0.5, 1) });
  }
}

// ───────────────────────────── generated buffers / curves ─────────
function makeNoise(sec, pink) {
  const sr = ctx.sampleRate, len = Math.floor(sr * sec);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (!pink) {
      d[i] = w;
      continue;
    }
    // Paul Kellet's pink filter
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}
/** Stereo noise tail that darkens as it decays: a cheap, smooth room. */
function makeImpulse(sec, decayPow, bright = 0.62) {
  const sr = ctx.sampleRate, len = Math.floor(sr * sec), pre = Math.floor(sr * 0.012);
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const k = i / len;
      lp += (Math.random() * 2 - 1 - lp) * (bright - 0.5 * bright * k);
      d[i] = i < pre ? 0 : lp * Math.pow(1 - k, decayPow);
    }
  }
  return buf;
}
/** tanh drive curve; asym adds even harmonics (tube-ish), normalised to ±1. */
function makeDrive(k, asym = 0) {
  const n = 2048, c = new Float32Array(n), off = Math.tanh(k * asym);
  let mx = 0;
  for (let i = 0; i < n; i++) {
    c[i] = Math.tanh(k * ((i * 2) / (n - 1) - 1 + asym)) - off;
    mx = Math.max(mx, Math.abs(c[i]));
  }
  for (let i = 0; i < n; i++) c[i] /= mx;
  return c;
}
/** Transparent below 0.8, soft knee up to a 0.98 ceiling. Input is pre-scaled by 0.5 (domain ±2). */
function makeClip() {
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = 2 * ((i * 2) / (n - 1) - 1), a = Math.abs(u);
    c[i] = Math.sign(u) * (a < 0.8 ? a : 0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18));
  }
  return c;
}
/** Glottal-ish pulse: harmonics falling a little faster than a saw. */
function makeGlottal() {
  const n = 56, re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 1; i < n; i++) im[i] = Math.pow(i, -1.15) * (i === 2 || i === 3 ? 1.15 : 1);
  return ctx.createPeriodicWave(re, im);
}

// ───────────────────────────── spatial ────────────────────────────
/** Distance gain (1 within 4 m → 0.1 at 40 m → 0 at 60 m), pan from yaw, air absorption. */
function spatial(x, y, z) {
  const dx = x - listener.x, dy = y - listener.y, dz = z - listener.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const g = dist <= 4 ? 1 : dist <= 40 ? 4 / dist : dist < 60 ? (0.1 * (60 - dist)) / 20 : 0;
  const hd = Math.sqrt(dx * dx + dz * dz);
  let pan = 0;
  if (hd > 0.001) {
    // forward = (-sin yaw, 0, -cos yaw)  →  right = (cos yaw, 0, -sin yaw)
    const rx = Math.cos(listener.yaw), rz = -Math.sin(listener.yaw);
    pan = ((dx * rx + dz * rz) / hd) * 0.8 * Math.min(1, hd / 2.5);
  }
  const lp = dist > 10 ? Math.max(1500, 18000 * Math.pow(10 / dist, 1.3)) : 18000;
  return { g, pan: clamp(pan, -1, 1), lp };
}

// ───────────────────────────── drum voices ────────────────────────
// Shared by the music engine and the musical sfx. All take a destination.

/** Kick: pitched sine body + beater click. `tight` = short double-kick variant. */
function vKick(d, t, v, tight = false) {
  const dec = tight ? 0.15 : 0.34;
  const o = mkOsc('sine', 160), g = mkGain(0);
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(58, t + 0.045);
  o.frequency.exponentialRampToValueAtTime(44, t + dec);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.002);
  g.gain.setValueAtTime(v, t + 0.025);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  wire(o, g, d);
  o.start(t);
  o.stop(t + dec + 0.02);
  o.onended = () => g.disconnect();
  mark(t + dec + 0.02);
  tone(d, t, 1600, { to: 300, dt: 0.012, a: 0.0005, d: 0.014, g: v * 0.12 });
  noise(d, t, { ft: 'lowpass', f: 4500, a: 0.0005, d: 0.012, g: v * 0.3 });
}
function vSnare(d, t, v) {
  tone(d, t, 205, { type: 'triangle', to: 175, dt: 0.04, a: 0.001, d: 0.08, g: v * 0.55 });
  tone(d, t, 330, { a: 0.001, d: 0.05, g: v * 0.22 });
  noise(d, t, { ft: 'highpass', f: 1500, q: 0.7, a: 0.001, d: 0.13, g: v * 0.48 });
  noise(d, t, { f: 4200, q: 0.9, a: 0.0005, d: 0.035, g: v * 0.28 });
}
function vClap(d, t, v) {
  v = Math.max(v, 0.001);
  const s = noiseSrc(noiseBuf, t, 0.3), g = mkGain(0), p = g.gain;
  p.setValueAtTime(0, t);
  for (let i = 0; i < 3; i++) {
    const ti = t + i * 0.011;
    p.setValueAtTime(v * 0.8, ti);
    p.exponentialRampToValueAtTime(v * 0.12, ti + 0.009);
  }
  p.setValueAtTime(v * 0.7, t + 0.033);
  p.exponentialRampToValueAtTime(0.0001, t + 0.22);
  wire(s, mkFilter('bandpass', 1250, 1.1), g, d);
  s.onended = () => g.disconnect();
  mark(t + 0.3);
}
const vHat = (d, t, v, open) =>
  noise(d, t, { ft: 'highpass', f: open ? 6800 : 7800, q: 0.6, a: 0.001, d: open ? 0.24 : 0.038, g: v * 0.5 });
function vCrash(d, t, v) {
  noise(d, t, { ft: 'highpass', f: 4300, q: 0.6, a: 0.002, d: 1.5, g: v * 0.45 });
  noise(d, t, { f: 8500, q: 0.8, a: 0.002, d: 0.6, g: v * 0.22 });
}
function vRide(d, t, v) {
  noise(d, t, { ft: 'highpass', f: 5500, a: 0.001, d: 0.35, g: v * 0.3 });
  tone(d, t, 3150, { type: 'triangle', a: 0.001, d: 0.25, g: v * 0.06 });
  tone(d, t, 4750, { a: 0.001, d: 0.18, g: v * 0.04 });
}
function vTom(d, t, v, f) {
  tone(d, t, f * 1.3, { to: f * 0.8, dt: 0.16, a: 0.002, d: 0.26, g: v * 0.85 });
  noise(d, t, { ft: 'lowpass', f: 1400, a: 0.001, d: 0.04, g: v * 0.15 });
}
function vRim(d, t, v) {
  tone(d, t, 1750, { type: 'triangle', a: 0.0005, d: 0.03, g: v * 0.3 });
  tone(d, t, 480, { a: 0.0005, d: 0.045, g: v * 0.4 });
}
const vShaker = (d, t, v) => noise(d, t, { f: 6200, q: 1.4, a: 0.014, d: 0.05, g: v * 0.55 });

// ───────────────────────────── tonal voices ───────────────────────

/** Bass: 'grit' (driven saws), 'slap' (thumb + pops), 'pick', 'funk' (round pluck), 'sub'. */
function vBass(d, t, m, dur, v, kind, pop = false) {
  const f = mtof(m), g = mkGain(0), fl = mkFilter('lowpass', 800, 1);
  wire(fl, g, d);
  let oscs, end;
  if (kind === 'grit') {
    oscs = [mkOsc('sawtooth', f, -9), mkOsc('sawtooth', f, 9), mkOsc('square', f)];
    fl.Q.value = 4;
    fl.frequency.setValueAtTime(hz(350 + 2600 * v), t);
    fl.frequency.setTargetAtTime(420, t + 0.01, 0.07);
    end = adsr(g.gain, t, 0.003, 0.12, 0.7, 0.05, dur, v * 0.5);
  } else if (kind === 'slap') {
    oscs = [mkOsc('sine', f), mkOsc('sawtooth', f, 4), mkOsc('square', f, -4)];
    fl.Q.value = 3;
    fl.frequency.setValueAtTime(hz((pop ? 5200 : 2600) * (0.6 + 0.4 * v)), t);
    fl.frequency.setTargetAtTime(420, t + 0.004, pop ? 0.07 : 0.045);
    end = adsr(g.gain, t, 0.002, 0.2, 0.45, 0.05, dur, v * 0.5);
    noise(d, t, { f: pop ? 3000 : 1600, q: 1.2, a: 0.0005, d: 0.012, g: v * (pop ? 0.4 : 0.28) }); // thumb / pop
  } else if (kind === 'funk') {
    oscs = [mkOsc('triangle', f), mkOsc('sine', f), mkOsc('sawtooth', f, 4)];
    fl.Q.value = 2.5;
    fl.frequency.setValueAtTime(hz(900 + 1000 * v), t);
    fl.frequency.setTargetAtTime(480, t + 0.005, 0.06);
    end = adsr(g.gain, t, 0.004, 0.35, 0.5, 0.06, dur, v * 0.55);
  } else if (kind === 'sub') {
    oscs = [mkOsc('sine', f), mkOsc('triangle', f)];
    fl.frequency.value = 600;
    end = adsr(g.gain, t, 0.006, 0.3, 0.75, 0.08, dur, v * 0.55);
  } else {
    oscs = [mkOsc('sawtooth', f), mkOsc('square', f, 6)];
    fl.Q.value = 2.5;
    fl.frequency.setValueAtTime(hz(600 + 1800 * v), t);
    fl.frequency.setTargetAtTime(520, t + 0.005, 0.08);
    end = adsr(g.gain, t, 0.003, 0.15, 0.6, 0.05, dur, v * 0.42);
    noise(d, t, { f: 2200, q: 1, a: 0.0005, d: 0.01, g: v * 0.15 }); // pick
  }
  for (const o of oscs) {
    if (kind === 'slap') {
      const base = o.detune.value; // string snaps sharp, then settles
      o.detune.setValueAtTime(base + (pop ? 60 : 30), t);
      o.detune.setTargetAtTime(base, t, 0.012);
    }
    o.connect(fl);
    o.start(t);
    o.stop(end);
  }
  oscs[0].onended = () => g.disconnect();
  mark(end);
}

const CHORD_KINDS = {
  stab: { o: [['sawtooth', -9], ['sawtooth', 9]], f0: 4200, f1: 900, q: 2, a: 0.003, d: 0.12, s: 0.35, r: 0.07, g: 0.55 },
  brass: { o: [['sawtooth', -12], ['sawtooth', 0], ['sawtooth', 12]], f0: 500, f1: 2000, swell: 1, q: 1.2, a: 0.03, d: 0.3, s: 0.75, r: 0.18, g: 0.5 },
  pad: { o: [['sawtooth', -13], ['sawtooth', 13]], f0: 450, f1: 1500, slow: 1, q: 0.8, a: 0.28, d: 0.6, s: 0.8, r: 0.5, g: 0.45 },
  soft: { o: [['triangle', -7], ['triangle', 7]], f0: 1800, f1: 1800, slow: 1, q: 0.5, a: 0.35, d: 0.6, s: 0.8, r: 0.7, g: 0.6 },
};
/** Chords: 'stab', 'brass', 'pad', 'soft', 'choir' (formant "aah") or 'ep'. */
function vChord(d, t, notes, dur, v, kind) {
  if (kind === 'ep') return vEP(d, t, notes, dur, v);
  if (kind === 'choir') return vChoir(d, t, notes, dur, v);
  const P = CHORD_KINDS[kind] || CHORD_KINDS.stab;
  const g = mkGain(0), fl = mkFilter('lowpass', P.f0, P.q);
  wire(fl, g, d);
  fl.frequency.setValueAtTime(P.f0, t);
  if (P.swell) {
    fl.frequency.linearRampToValueAtTime(P.f1 * 1.8, t + 0.07);
    fl.frequency.setTargetAtTime(P.f1, t + 0.07, 0.15);
  } else if (P.slow) fl.frequency.linearRampToValueAtTime(P.f1, t + Math.max(0.1, dur * 0.5));
  else fl.frequency.setTargetAtTime(P.f1, t + 0.01, 0.06);
  const end = adsr(g.gain, t, P.a, P.d, P.s, P.r, dur, (v * P.g) / Math.sqrt(notes.length * P.o.length));
  let first = null;
  for (const m of notes) {
    for (const [type, det] of P.o) {
      const o = mkOsc(type, mtof(m), det);
      o.connect(fl);
      o.start(t);
      o.stop(end);
      first = first || o;
    }
  }
  if (first) first.onended = () => g.disconnect();
  mark(end);
}
/** Saw stack through two "aah" formants: a cheap synthetic choir. */
function vChoir(d, t, notes, dur, v) {
  const g = mkGain(0), sum = mkGain(3.2), f1 = mkFilter('bandpass', 720, 5), f2 = mkFilter('bandpass', 1120, 7);
  wire(f1, sum);
  wire(f2, sum);
  wire(sum, mkFilter('lowpass', 3200, 0.7), g, d);
  const end = adsr(g.gain, t, 0.35, 0.6, 0.85, 0.7, dur, (v * 0.5) / Math.sqrt(notes.length));
  let first = null;
  for (const m of notes) {
    for (const det of [-11, 9]) {
      const o = mkOsc('sawtooth', mtof(m), det);
      o.connect(f1);
      o.connect(f2);
      o.start(t);
      o.stop(end);
      first = first || o;
    }
  }
  first.onended = () => g.disconnect();
  mark(end);
}
/** Two-operator FM electric piano. */
function vEP(d, t, notes, dur, v) {
  const nv = v / Math.sqrt(notes.length);
  for (const m of notes) {
    const f = mtof(m), car = mkOsc('sine', f), mod = mkOsc('sine', f), mg = mkGain(0), g = mkGain(0);
    mg.gain.setValueAtTime(f * (1.1 + v), t);
    mg.gain.setTargetAtTime(f * 0.15, t, 0.25);
    wire(mod, mg, car.frequency);
    wire(car, g, d);
    const end = adsr(g.gain, t, 0.002, 0.9, 0.3, 0.25, dur, nv * 0.45);
    car.start(t);
    mod.start(t);
    car.stop(end);
    mod.stop(end);
    car.onended = () => g.disconnect();
    mark(end);
  }
}
/** FM bell / music box / vibraphone. */
function vBell(d, t, m, dur, v, dec = 0.9) {
  const f = Math.min(mtof(m), 8000);
  const car = mkOsc('sine', f), mod = mkOsc('sine', f * 3), mg = mkGain(0), g = mkGain(0);
  mg.gain.setValueAtTime(f * 1.6 * v, t);
  mg.gain.setTargetAtTime(f * 0.08, t, 0.08);
  wire(mod, mg, car.frequency);
  wire(car, g, d);
  const end = env(g.gain, t, 0.002, Math.min(dur, 0.05), dec, v * 0.4) + 0.02;
  car.start(t);
  mod.start(t);
  car.stop(end);
  mod.stop(end);
  car.onended = () => g.disconnect();
  mark(end);
}

const LEAD_KINDS = {
  square: { o: [['square', 0, 0.7], ['sawtooth', 7, 0.5]], f0: 5200, f1: 2300, q: 2, a: 0.005, d: 0.2, s: 0.7, r: 0.07, g: 0.38, vib: 14 },
  saw: { o: [['sawtooth', -10, 0.5], ['sawtooth', 10, 0.5], ['square', 0, 0.25]], f0: 4200, f1: 2600, q: 1, a: 0.012, d: 0.3, s: 0.75, r: 0.14, g: 0.4, vib: 12 },
  chip: { o: [['square', 0, 0.8]], f0: 6000, f1: 4500, q: 0.7, a: 0.002, d: 0.08, s: 0.65, r: 0.03, g: 0.34, vib: 22 },
  soft: { o: [['triangle', 0, 1], ['sine', 1200, 0.18]], f0: 2600, f1: 2200, q: 0.7, a: 0.035, d: 0.3, s: 0.75, r: 0.18, g: 0.55, vib: 18 },
  brass: { o: [['sawtooth', -12, 0.45], ['sawtooth', 0, 0.45], ['sawtooth', 12, 0.45]], f0: 600, f1: 2400, swell: 1, q: 1.2, a: 0.025, d: 0.3, s: 0.8, r: 0.15, g: 0.4, vib: 10 },
};
/** Leads: 'square', 'saw', 'chip', 'soft', 'brass', 'bell' — with delayed vibrato on long notes. */
function vLead(d, t, m, dur, v, kind) {
  if (kind === 'bell') return vBell(d, t, m, dur, v);
  const P = LEAD_KINDS[kind] || LEAD_KINDS.square;
  const f = mtof(m), fl = mkFilter('lowpass', P.f0, P.q), g = mkGain(0);
  wire(fl, g, d);
  fl.frequency.setValueAtTime(P.f0, t);
  if (P.swell) {
    fl.frequency.linearRampToValueAtTime(P.f1 * 1.5, t + 0.06);
    fl.frequency.setTargetAtTime(P.f1, t + 0.06, 0.12);
  } else fl.frequency.setTargetAtTime(P.f1, t + 0.005, 0.08);
  const end = adsr(g.gain, t, P.a, P.d, P.s, P.r, dur, v * P.g);
  let lg = null;
  if (dur > 0.2) {
    const lfo = mkOsc('sine', 5.6); // per-note LFO so it dies with the note
    lg = wire(lfo, mkGain(0));
    lg.gain.setValueAtTime(0, t + Math.min(0.15, dur * 0.3));
    lg.gain.linearRampToValueAtTime(P.vib, t + Math.min(0.5, dur * 0.8));
    lfo.start(t);
    lfo.stop(end);
  }
  let first = null;
  for (const [type, det, lvl] of P.o) {
    const o = mkOsc(type, f, det);
    wire(o, mkGain(lvl), fl);
    if (lg) lg.connect(o.detune);
    o.start(t);
    o.stop(end);
    first = first || o;
  }
  first.onended = () => g.disconnect();
  mark(end);
}
function vArp(d, t, m, dur, v, kind) {
  if (kind === 'bell') vBell(d, t, m, dur, v * 0.8, 0.35);
  else tone(d, t, mtof(m), { type: 'square', lp: 3600, a: 0.002, h: dur * 0.35, d: 0.07, g: v * 0.45 });
}

// ───────────────────────────── guitar ─────────────────────────────
// Double-tracked rig (L/R): tight pre-HP → waveshaper drive → HP → mid-boost
// peak → two-stage cabinet lowpass. Notes are detuned saws with a pick
// transient and a string "bend-in"; the pre-drive filter/gain envelope is what
// makes a palm-muted chug vs an open, ringing power chord.
const GTR_DRIVES = {
  clean: { k: 1.4, asym: 0, cab: 5600, mid: 2, out: 0.75 },
  crunch: { k: 5, asym: 0.08, cab: 4600, mid: 4, out: 0.45 },
  heavy: { k: 14, asym: 0.12, cab: 4200, mid: 5, out: 0.3 },
};
function makeGtrRig(drive, N, dest) {
  const D = GTR[drive] || GTR.crunch, ins = [];
  for (const pan of [-0.6, 0.6]) {
    const inp = N(mkGain(1)), sh = N(ctx.createWaveShaper()), mid = N(mkFilter('peaking', 900, 0.9));
    sh.curve = D.curve;
    sh.oversample = '4x';
    mid.gain.value = D.mid;
    wire(inp, N(mkFilter('highpass', 110, 0.7)), sh, N(mkFilter('highpass', 85, 0.7)), mid,
      N(mkFilter('lowpass', D.cab, 1)), N(mkFilter('lowpass', D.cab * 1.35, 0.6)), N(mkGain(D.out)), N(mkPan(pan)), dest);
    ins.push(inp);
  }
  return { ins };
}
/**
 * Modes: 'm' palm-muted power chug, 'P' open power chord (root+5th+octave),
 * 'c' short chord chop, 'C' strummed chord.
 */
function vGtr(rig, t, root, chordNotes, mode, dur) {
  const power = mode === 'm' || mode === 'P';
  const notes = mode === 'm' ? [root, root + 7] : power ? [root, root + 7, root + 12] : chordNotes;
  const strum = mode === 'C' ? 0.012 : mode === 'c' ? 0.005 : 0.002, v = mode === 'm' ? 0.75 : 0.9;
  for (let si = 0; si < 2; si++) {
    const ts = t + si * 0.006 + Math.random() * 0.003, pre = mkFilter('lowpass', 3000, 0.7), g = mkGain(0), f = pre.frequency;
    wire(pre, g, rig.ins[si]);
    let end;
    if (mode === 'm') {
      f.setValueAtTime(1100, ts);
      f.setTargetAtTime(380, ts, 0.025);
      end = adsr(g.gain, ts, 0.002, 0.07, 0.3, 0.05, Math.min(dur, 0.14), v * 0.5);
    } else if (mode === 'P') {
      f.setValueAtTime(4200, ts);
      f.setTargetAtTime(1700, ts, 0.25);
      end = adsr(g.gain, ts, 0.003, 0.5, 0.7, 0.1, dur, v * 0.42);
    } else if (mode === 'c') {
      f.setValueAtTime(3400, ts);
      f.setTargetAtTime(1400, ts, 0.05);
      end = adsr(g.gain, ts, 0.002, 0.06, 0.25, 0.05, Math.min(dur, 0.12), v * 0.4);
    } else {
      f.setValueAtTime(3200, ts);
      f.setTargetAtTime(1500, ts, 0.3);
      end = adsr(g.gain, ts, 0.004, 0.6, 0.55, 0.15, dur, v * 0.38);
    }
    let first = null;
    notes.forEach((m, j) => {
      const tn = ts + j * strum, det = (si ? 6 : -6) + rnd(-2, 2), o = mkOsc('sawtooth', mtof(m), det);
      o.detune.setValueAtTime(det - 14, tn);
      o.detune.setTargetAtTime(det, tn, 0.02);
      o.connect(pre);
      o.start(tn);
      o.stop(end + 0.05);
      first = first || o;
    });
    first.onended = () => g.disconnect();
    noise(rig.ins[si], ts, { f: 2600, q: 0.9, a: 0.0008, d: mode === 'm' ? 0.01 : 0.016, g: v * 0.18 }); // pick
    mark(end + 0.05);
  }
}

// ───────────────────────────── singer ─────────────────────────────
// One persistent formant voice per vocal track: a glottal pulse (+ breath)
// through three gliding bandpass formants, plus a gated noise channel for
// consonants. Notes become automation on these few nodes, so it is cheap.
/** [F1, F2, F3, g1, g2, g3] — a bright, youthful voice. */
const VOWEL_F = {
  a: [800, 1250, 2700, 1, 0.6, 0.3],
  e: [520, 1900, 2650, 0.9, 0.55, 0.3],
  i: [320, 2300, 3000, 0.75, 0.42, 0.3],
  o: [520, 900, 2600, 1, 0.5, 0.18],
  u: [350, 780, 2500, 0.85, 0.35, 0.12],
};
/** Formant targets the onset glides out of (nasals / liquids / glides). */
const SEMI_F = {
  m: [270, 1000, 2500, 0.6, 0.1, 0.05],
  n: [280, 1500, 2600, 0.6, 0.12, 0.06],
  l: [360, 1150, 2700, 0.8, 0.3, 0.15],
  r: [420, 1250, 1750, 0.8, 0.35, 0.2],
  y: [300, 2250, 3000, 0.75, 0.4, 0.25],
  w: [320, 680, 2300, 0.8, 0.3, 0.1],
};
/** Consonants: k = plosive / fricative / nasal / liquid; f,q,d,g = noise burst. */
const CONS = {
  b: { k: 'plo', voiced: 1, f: 800, q: 1, d: 0.02, g: 0.22 },
  d: { k: 'plo', voiced: 1, f: 3200, q: 1.2, d: 0.018, g: 0.22 },
  g: { k: 'plo', voiced: 1, f: 2000, q: 1.2, d: 0.02, g: 0.22 },
  p: { k: 'plo', f: 900, q: 0.8, d: 0.03, g: 0.45 },
  t: { k: 'plo', f: 4300, q: 1.2, d: 0.03, g: 0.45 },
  k: { k: 'plo', f: 2300, q: 1.2, d: 0.035, g: 0.45 },
  s: { k: 'fri', f: 6500, q: 1.4, d: 0.07, g: 0.4 },
  sh: { k: 'fri', f: 3000, q: 1.6, d: 0.07, g: 0.45 },
  h: { k: 'fri', f: 1600, q: 0.5, d: 0.04, g: 0.14 },
  z: { k: 'fri', voiced: 1, f: 5500, q: 1.4, d: 0.05, g: 0.22 },
  m: { k: 'nas', d: 0.05 },
  n: { k: 'nas', d: 0.045 },
  l: { k: 'liq', d: 0.04 },
  r: { k: 'liq', d: 0.04 },
  y: { k: 'liq', d: 0.04 },
  w: { k: 'liq', d: 0.045 },
};
const SYL_C = ['b', 'd', 'l', 'n', 'm', 'y', 'p', 't', 'k', 's', 'sh', 'w', 'r', '', 'z', 'g', 'h', 'b', 'd', 'l', 'n', 't', 'k', 'y', ''];
const SYL_V = ['a', 'a', 'o', 'e', 'i', 'u', 'o', 'a', 'e', 'i'];
const SYL_OPEN = ['a', 'a', 'o', 'e', 'o', 'a'];
const SYL_BAN = new Set(['pu', 'fu', 'shi', 'ki', 'si']);

function makeSinger(voice, N, oscs, dest, now) {
  const src = N(ctx.createOscillator());
  src.setPeriodicWave(glottalWave);
  src.frequency.value = 330;
  const vib = N(mkOsc('sine', voice.rate || 5.4)), vibG = N(mkGain(0)), amp = N(mkGain(0)), sum = N(mkGain(1));
  wire(vib, vibG, src.detune);
  src.connect(amp);
  const br = N(noiseSrc(noiseBuf, now, 0, 1, true)); // breath, gated by the same amp
  wire(br, N(mkFilter('highpass', 1500, 0.5)), N(mkGain(0.05)), amp);
  const F = [6, 9, 12].map((q) => {
    const f = N(mkFilter('bandpass', 600, q)), g = N(mkGain(0));
    wire(amp, f, g, sum);
    return { f, g };
  });
  const cn = N(noiseSrc(noiseBuf, now, 0, 1, true)), cF = N(mkFilter('bandpass', 4000, 1.2)), cG = N(mkGain(0));
  wire(cn, cF, cG, sum);
  const pres = N(mkFilter('peaking', 3200, 1));
  pres.gain.value = 4;
  wire(sum, N(mkFilter('highpass', 160, 0.7)), pres, N(mkComp(-24, 8, 3, 0.004, 0.12)), N(mkGain(voice.gain || 2.5)), dest);
  src.start(now);
  vib.start(now);
  oscs.push(src, vib, br, cn);
  return { src, vibG, amp, F, cF, cG, lastEnd: 0, shift: voice.shift || 1.06, vib: voice.vib || 30 };
}
function setForm(S, V, t, tc) {
  for (let i = 0; i < 3; i++) {
    S.F[i].f.frequency.setTargetAtTime(Math.min(V[i] * S.shift, 9000), t, tc);
    S.F[i].g.gain.setTargetAtTime(V[i + 3], t, tc);
  }
}
/** Sing one syllable {c, v} on midi note m (scoop in or glide, vowel glide, vibrato on long notes). */
function sing(S, t, m, dur, vel, syl) {
  const f = Math.min(mtof(m), 1400), V = VOWEL_F[syl.v] || VOWEL_F.a, C = CONS[syl.c], semi = SEMI_F[syl.c];
  const tc = t - (C ? Math.min(0.05, C.d * 0.8) : 0.012);
  const P = S.src.frequency, A = S.amp.gain;
  if (tc - S.lastEnd < 0.04) P.setTargetAtTime(f, tc, 0.025); // legato glide
  else {
    P.setValueAtTime(f * Math.pow(2, -rnd(0.6, 1.8) / 12), tc); // scoop up into the note
    P.setTargetAtTime(f, t, 0.03);
  }
  S.vibG.gain.setTargetAtTime(0, tc, 0.02);
  if (dur > 0.28) S.vibG.gain.setTargetAtTime(S.vib, t + 0.15, 0.1);
  if (C && C.f) {
    S.cF.frequency.setValueAtTime(C.f, tc);
    S.cF.Q.setValueAtTime(C.q, tc);
    S.cG.gain.setValueAtTime(0, tc);
    S.cG.gain.linearRampToValueAtTime(C.g * vel, tc + 0.004);
    S.cG.gain.setTargetAtTime(0, tc + C.d * 0.45, C.d / 4);
  }
  if (semi) setForm(S, semi, tc, 0.006);
  setForm(S, V, semi ? t - 0.01 : tc, semi ? 0.028 : 0.014);
  if (!C) A.setTargetAtTime(vel, tc, 0.012);
  else if (C.k === 'plo') {
    A.setTargetAtTime(0, tc, 0.004);
    A.setTargetAtTime(vel, t - 0.004, C.voiced ? 0.008 : 0.012);
  } else if (C.k === 'fri' && !C.voiced) {
    A.setTargetAtTime(0, tc, 0.006);
    A.setTargetAtTime(vel, t, 0.012);
  } else {
    A.setTargetAtTime(vel * (C.k === 'nas' ? 0.5 : 0.75), tc, 0.008);
    A.setTargetAtTime(vel, t, 0.02);
  }
  const end = t + Math.max(0.05, dur - 0.045);
  if (dur > 0.5 && Math.random() < 0.25) P.setTargetAtTime(f * 0.97, end - 0.06, 0.04); // little fall-off
  A.setTargetAtTime(0, end, 0.025);
  S.lastEnd = end + 0.02;
}
/** Deterministic nonsense syllables: same melody bar → same "lyrics", so hooks repeat. */
function syllables(evs, seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  const r = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
  let prev = '';
  for (const ev of evs) {
    if (!ev) continue;
    let syl;
    for (let tries = 0; tries < 6; tries++) {
      const c = SYL_C[(r() * SYL_C.length) | 0];
      const v = ev.len >= 4 ? SYL_OPEN[(r() * SYL_OPEN.length) | 0] : SYL_V[(r() * SYL_V.length) | 0];
      syl = { c, v };
      const s = c + v;
      if (!SYL_BAN.has(s) && s !== prev) break;
    }
    prev = syl.c + syl.v;
    ev.syl = syl;
  }
  return evs;
}

// ───────────────────────────── SFX ────────────────────────────────
// Each generator: (out, t, pitch, opts). Spatial, volume, caps: see playSfx.

/** Monster growl: detuned saws with a rumbling AM through moving low formants. */
function growl(out, t, f0, dur, g, vA, vB) {
  const am = mkGain(0.6), lfo = mkOsc('sine', 29), sum = mkGain(3), gn = mkGain(0);
  wire(lfo, mkGain(0.4), am.gain);
  const A = VOWEL_F[vA], B = VOWEL_F[vB];
  for (let i = 0; i < 2; i++) {
    const f = mkFilter('bandpass', A[i] * 0.7, 4 + i * 2);
    f.frequency.setValueAtTime(A[i] * 0.7, t);
    f.frequency.linearRampToValueAtTime(B[i] * 0.7, t + dur);
    wire(am, f, sum);
  }
  wire(sum, gn, out);
  const end = env(gn.gain, t, Math.min(0.15, dur * 0.2), dur * 0.45, dur * 0.4, g) + 0.02;
  for (const det of [-30, 0, 22]) {
    const o = mkOsc('sawtooth', f0, det);
    o.frequency.setValueAtTime(f0 * 0.8, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.15, t + dur * 0.3);
    o.frequency.linearRampToValueAtTime(f0 * 0.7, t + dur);
    o.connect(am);
    o.start(t);
    o.stop(end);
  }
  lfo.start(t);
  lfo.stop(end);
  lfo.onended = () => gn.disconnect();
  return mark(end);
}

const SFX = {
  // — weapons & combat —
  shoot(out, t, p) {
    const r = p * rnd(0.92, 1.08);
    tone(out, t, 900 * r, { type: 'triangle', to: 240 * r, dt: 0.055, a: 0.002, d: 0.07, g: 0.36 });
    tone(out, t, 300 * r, { to: 110 * r, dt: 0.05, a: 0.002, d: 0.06, g: 0.42 });
    noise(out, t, { f: 3400 * r, to: 900 * r, dt: 0.06, q: 2.2, a: 0.001, d: 0.065, g: 0.6 });
  },
  shoot_heavy(out, t, p) {
    const r = p * rnd(0.94, 1.06);
    tone(out, t, 520 * r, { to: 110 * r, dt: 0.12, a: 0.002, d: 0.16, g: 0.5 });
    tone(out, t, 180 * r, { type: 'square', to: 70 * r, dt: 0.1, lp: 900, a: 0.002, d: 0.1, g: 0.14 });
    noise(out, t, { ft: 'lowpass', f: 2600 * r, to: 500 * r, dt: 0.12, q: 4, a: 0.002, d: 0.14, g: 0.55 });
    noise(out, t + 0.01, { f: 1200 * r, to: 600 * r, q: 3, a: 0.005, d: 0.1, g: 0.3 });
  },
  charge_shot(out, t, p) {
    noise(out, t, { f: 700 * p, to: 6000 * p, dt: 0.05, q: 1.2, a: 0.035, d: 0.03, g: 0.35 }); // fwip
    const c = t + 0.045; // crack
    noise(out, c, { ft: 'highpass', f: 1800, q: 0.7, a: 0.001, d: 0.07, g: 0.7 });
    tone(out, c, 2400 * p, { type: 'square', to: 500 * p, dt: 0.12, lp: 6000, a: 0.001, d: 0.12, g: 0.1 });
    tone(out, c, 3200 * p, { to: 1200 * p, dt: 0.2, a: 0.001, d: 0.25, g: 0.13 });
    tone(out, c, 150 * p, { to: 45, dt: 0.2, a: 0.002, d: 0.3, g: 0.5 });
  },
  roller_flick(out, t, p) {
    noise(out, t, { f: 350 * p, sw: [[0.12, 2600 * p], [0.3, 800 * p]], q: 1.8, a: 0.06, h: 0.05, d: 0.2, g: 0.55 });
    noise(out, t + 0.17, { ft: 'lowpass', f: 1800 * p, q: 1.5, a: 0.002, d: 0.09, g: 0.3 });
    tone(out, t + 0.17, 260 * p, { to: 90 * p, dt: 0.07, a: 0.002, d: 0.08, g: 0.3 });
    droplets(out, t + 0.15, 3, 0.15, 700 * p, 1600 * p, 0.08);
  },
  splat(out, t, p) {
    const r = p * rnd(0.88, 1.12);
    noise(out, t, { ft: 'lowpass', f: 3000 * r, to: 600 * r, dt: 0.07, q: 2, a: 0.001, d: 0.09, g: 0.55 });
    noise(out, t, { f: 900 * r, q: 4, a: 0.002, d: 0.12, g: 0.35 });
    tone(out, t, 320 * r, { to: 70 * r, dt: 0.07, a: 0.001, d: 0.08, g: 0.42 });
  },
  hit(out, t, p) {
    tone(out, t, 2093 * p, { a: 0.001, d: 0.1, g: 0.32 });
    tone(out, t, 3136 * p, { type: 'triangle', a: 0.001, d: 0.06, g: 0.14 });
    noise(out, t, { ft: 'highpass', f: 6000, a: 0.0005, d: 0.015, g: 0.22 });
  },
  hurt(out, t, p) {
    tone(out, t, 150 * p, { to: 55 * p, dt: 0.15, a: 0.002, d: 0.22, g: 0.7 });
    noise(out, t, { ft: 'lowpass', f: 700 * p, to: 200, dt: 0.18, q: 1, a: 0.002, d: 0.2, g: 0.6 });
    noise(out, t + 0.01, { f: 500 * p, q: 3, a: 0.01, d: 0.15, g: 0.3 });
  },
  splatted(out, t, p) {
    tone(out, t, 700 * p, { to: 120 * p, dt: 0.05, a: 0.001, d: 0.07, g: 0.45 }); // pop
    tone(out, t, 110 * p, { to: 38, dt: 0.35, a: 0.003, d: 0.5, g: 0.85 }); // boom
    noise(out, t, { f: 2800 * p, to: 500 * p, dt: 0.4, q: 1.2, a: 0.003, d: 0.45, g: 0.55 }); // splash
    noise(out, t, { ft: 'lowpass', f: 1200 * p, to: 150, dt: 0.5, a: 0.002, d: 0.5, g: 0.65 });
    droplets(out, t + 0.06, 7, 0.45, 600 * p, 2000 * p, 0.12);
  },
  ko_confirm(out, t, p) {
    tone(out, t, 300 * p, { to: 1200 * p, dt: 0.04, a: 0.001, d: 0.05, g: 0.35 });
    const n1 = t + 0.02, n2 = t + 0.12;
    tone(out, n1, 1046.5 * p, { type: 'triangle', a: 0.003, h: 0.06, d: 0.2, g: 0.32 });
    tone(out, n1, 2093 * p, { a: 0.003, h: 0.03, d: 0.15, g: 0.1 });
    tone(out, n2, 1568 * p, { type: 'triangle', a: 0.003, h: 0.1, d: 0.35, g: 0.36 });
    tone(out, n2, 3136 * p, { a: 0.003, h: 0.05, d: 0.25, g: 0.09 });
  },
  bomb_throw(out, t, p) {
    noise(out, t, { f: 300 * p, sw: [[0.15, 1800 * p], [0.38, 500 * p]], q: 1.5, a: 0.12, d: 0.26, g: 0.5 });
    tone(out, t, 500 * p, { to: 900 * p, dt: 0.08, a: 0.003, d: 0.08, g: 0.12 });
  },
  bomb_beep(out, t, p) {
    tone(out, t, 1760 * p, { type: 'triangle', a: 0.002, h: 0.05, d: 0.04, g: 0.3 });
    tone(out, t, 3520 * p, { a: 0.002, h: 0.04, d: 0.03, g: 0.07 });
  },
  explode(out, t, p) {
    const r = p * rnd(0.92, 1.08);
    tone(out, t, 130 * r, { to: 32, dt: 0.45, a: 0.003, d: 0.7, g: 1.0 }); // thump
    noise(out, t, { ft: 'lowpass', f: 5000 * r, to: 250, dt: 0.7, q: 1, a: 0.002, d: 0.8, g: 0.75 }); // boom
    noise(out, t + 0.02, { f: 1800 * r, to: 600 * r, dt: 0.5, q: 1.5, a: 0.01, d: 0.45, g: 0.45 }); // splash
    droplets(out, t + 0.08, 9, 0.6, 500 * r, 1900 * r, 0.11);
  },
  jump(out, t, p) {
    const r = p * rnd(0.95, 1.05);
    tone(out, t, 320 * r, { to: 760 * r, dt: 0.09, a: 0.004, d: 0.1, g: 0.32 });
    noise(out, t, { f: 1500, to: 3000, q: 1, a: 0.005, d: 0.06, g: 0.12 });
  },
  land(out, t, p) {
    const r = p * rnd(0.9, 1.1);
    tone(out, t, 130 * r, { to: 65 * r, dt: 0.06, a: 0.002, d: 0.08, g: 0.38 });
    noise(out, t, { ft: 'lowpass', f: 900 * r, a: 0.002, d: 0.06, g: 0.28 });
  },
  land_heavy(out, t, p) {
    tone(out, t, 110 * p, { to: 38, dt: 0.15, a: 0.002, d: 0.25, g: 0.85 });
    noise(out, t, { ft: 'lowpass', f: 1800 * p, to: 200, dt: 0.2, a: 0.002, d: 0.22, g: 0.55 });
    noise(out, t + 0.01, { f: 800 * p, q: 2, a: 0.002, d: 0.12, g: 0.3 });
  },
  goo_in(out, t, p) {
    tone(out, t, 750 * p, { to: 140 * p, dt: 0.28, a: 0.005, h: 0.1, d: 0.2, g: 0.3, vib: [22, 60] });
    noise(out, t, { f: 1400 * p, to: 300 * p, dt: 0.3, q: 6, a: 0.01, h: 0.08, d: 0.2, g: 0.36 });
    tone(out, t + 0.05, 200 * p, { to: 90 * p, dt: 0.2, a: 0.01, d: 0.2, g: 0.22 });
  },
  goo_out(out, t, p) {
    tone(out, t, 240 * p, { to: 900 * p, dt: 0.1, a: 0.003, d: 0.1, g: 0.36 });
    tone(out, t + 0.06, 700 * p, { to: 1400 * p, dt: 0.05, a: 0.002, d: 0.06, g: 0.2 });
    tone(out, t + 0.11, 1000 * p, { to: 1800 * p, dt: 0.04, a: 0.002, d: 0.05, g: 0.14 });
    noise(out, t, { f: 600 * p, to: 2500 * p, dt: 0.1, q: 3, a: 0.004, d: 0.1, g: 0.2 });
  },
  climb_step(out, t, p) {
    const r = p * rnd(0.85, 1.15);
    noise(out, t, { f: 1300 * r, q: 4, a: 0.002, d: 0.05, g: 0.32 });
    tone(out, t, 420 * r, { to: 180 * r, dt: 0.04, a: 0.002, d: 0.05, g: 0.16 });
  },
  ink_empty(out, t) {
    for (const [dt, g] of [[0, 1], [0.075, 0.6]]) {
      noise(out, t + dt, { ft: 'highpass', f: 3300, a: 0.0005, d: 0.012, g: 0.4 * g });
      tone(out, t + dt, 1300 - dt * 4000, { type: 'square', lp: 3000, a: 0.0005, d: 0.016, g: 0.08 * g });
    }
  },
  ink_full(out, t, p) {
    tone(out, t, 500 * p, { to: 800 * p, dt: 0.04, a: 0.002, d: 0.05, g: 0.13 });
    tone(out, t + 0.05, 700 * p, { to: 1100 * p, dt: 0.04, a: 0.002, d: 0.05, g: 0.13 });
    tone(out, t + 0.1, 1318.5 * p, { a: 0.003, d: 0.45, g: 0.2 });
    tone(out, t + 0.1, 1975.5 * p, { a: 0.003, d: 0.3, g: 0.07 });
  },
  special_ready(out, t, p) {
    [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => {
      const f = mtof(m) * p, ti = t + i * 0.045;
      tone(out, ti, f, { type: 'square', lp: 5000, a: 0.002, d: 0.12, g: 0.06 });
      tone(out, ti, f, { type: 'triangle', a: 0.002, d: 0.25, g: 0.14 });
    });
    noise(out, t, { ft: 'highpass', f: 7000, a: 0.3, d: 0.3, g: 0.06 });
    tone(out, t + 0.32, mtof(96) * p, { a: 0.005, h: 0.1, d: 0.5, g: 0.07, vib: [7, 15] });
  },
  special_go(out, t, p) {
    noise(out, t, { f: 250, to: 5000, dt: 0.4, q: 1.1, a: 0.32, d: 0.35, g: 0.45 });
    const c = t + 0.3, root = Math.round(semis(p));
    vChord(out, c, [60, 64, 67, 72, 76].map((m) => m + root), 0.55, 1, 'brass');
    vBass(out, c, 36 + root, 0.5, 1, 'pick');
    tone(out, c, 110, { to: 40, dt: 0.4, a: 0.003, d: 0.55, g: 0.65 });
    noise(out, c, { ft: 'highpass', f: 3000, a: 0.002, d: 0.6, g: 0.1 });
  },
  respawn(out, t, p) {
    tone(out, t, 2400 * p, { to: 220 * p, dt: 0.5, a: 0.02, h: 0.15, d: 0.38, g: 0.15, vib: [26, 60] });
    tone(out, t, 1200 * p, { type: 'triangle', to: 110 * p, dt: 0.5, a: 0.02, h: 0.1, d: 0.4, g: 0.1 });
    noise(out, t, { f: 6000, to: 500, dt: 0.5, q: 2.5, a: 0.08, h: 0.2, d: 0.25, g: 0.28 });
    const l = t + 0.52; // touch down
    tone(out, l, 170, { to: 55, dt: 0.15, a: 0.002, d: 0.22, g: 0.5 });
    noise(out, l, { ft: 'lowpass', f: 1600, to: 300, a: 0.002, d: 0.15, g: 0.28 });
    for (let i = 0; i < 4; i++) tone(out, l + 0.03 + i * 0.05, mtof(84 + i * 4) * p, { type: 'triangle', a: 0.003, d: 0.2, g: 0.06 });
  },
  enemy_ink(out, t, p) {
    noise(out, t, { f: 260 * p, sw: [[0.06, 900 * p], [0.2, 320 * p]], q: 8, a: 0.008, h: 0.05, d: 0.16, g: 0.65 });
    tone(out, t, 170 * p, { type: 'triangle', to: 110 * p, dt: 0.2, a: 0.01, d: 0.2, g: 0.22, vib: [22, 25] });
  },
  slosh(out, t, p) {
    noise(out, t, { f: 300 * p, sw: [[0.14, 1400 * p], [0.36, 500 * p]], q: 1.4, a: 0.08, h: 0.06, d: 0.22, g: 0.5 }); // bucket swing
    tone(out, t + 0.05, 220 * p, { to: 360 * p, dt: 0.15, a: 0.02, h: 0.08, d: 0.15, g: 0.22, vib: [16, 40] }); // glug
    noise(out, t + 0.12, { ft: 'lowpass', f: 2400 * p, to: 500, dt: 0.3, q: 2, a: 0.02, d: 0.3, g: 0.4 }); // liquid arc
    droplets(out, t + 0.15, 5, 0.3, 600 * p, 1500 * p, 0.09);
  },
  dualie_shot(out, t, p) {
    const r = p * rnd(0.93, 1.07);
    tone(out, t, 1300 * r, { type: 'triangle', to: 420 * r, dt: 0.04, a: 0.001, d: 0.05, g: 0.28 });
    noise(out, t, { f: 4500 * r, to: 1500 * r, dt: 0.04, q: 2.5, a: 0.001, d: 0.045, g: 0.42 });
    tone(out, t, 380 * r, { to: 150 * r, dt: 0.03, a: 0.001, d: 0.04, g: 0.25 });
  },
  dodge_roll(out, t, p) {
    noise(out, t, { f: 600 * p, sw: [[0.09, 2500 * p], [0.22, 700 * p]], q: 1.6, a: 0.03, h: 0.04, d: 0.16, g: 0.5 });
    tone(out, t, 260 * p, { to: 520 * p, dt: 0.08, a: 0.004, d: 0.08, g: 0.15 });
    noise(out, t + 0.18, { ft: 'lowpass', f: 1800 * p, to: 400, q: 2, a: 0.002, d: 0.1, g: 0.35 }); // wet landing
    tone(out, t + 0.18, 200 * p, { to: 80 * p, dt: 0.06, a: 0.002, d: 0.08, g: 0.3 });
  },
  brush_swish(out, t, p) {
    const r = p * rnd(0.92, 1.08);
    noise(out, t, { f: 2000 * r, sw: [[0.08, 5000 * r], [0.2, 2500 * r]], q: 0.9, a: 0.04, h: 0.04, d: 0.12, g: 0.5, am: [38 * r, 0.7] });
    noise(out, t + 0.06, { ft: 'lowpass', f: 1200 * r, a: 0.002, d: 0.06, g: 0.15 });
  },
  brella_shot(out, t, p) {
    const r = p * rnd(0.95, 1.05);
    tone(out, t, 170 * r, { to: 50, dt: 0.12, a: 0.002, d: 0.18, g: 0.75 });
    noise(out, t, { ft: 'lowpass', f: 6000 * r, to: 700, dt: 0.18, q: 1, a: 0.001, d: 0.2, g: 0.7 });
    noise(out, t, { f: 1500 * r, q: 2, a: 0.002, d: 0.12, g: 0.35 });
    droplets(out, t + 0.02, 8, 0.12, 700 * r, 2200 * r, 0.1);
  },
  brella_open(out, t, p) {
    noise(out, t, { f: 1200 * p, to: 2600 * p, dt: 0.1, q: 1.2, a: 0.03, d: 0.1, g: 0.35 }); // fabric
    noise(out, t + 0.1, { ft: 'highpass', f: 2500, a: 0.0005, d: 0.02, g: 0.4 }); // snap
    tone(out, t + 0.1, 900 * p, { to: 600 * p, dt: 0.06, a: 0.001, d: 0.08, g: 0.25 });
    tone(out, t + 0.1, 140 * p, { to: 90 * p, dt: 0.1, a: 0.003, d: 0.14, g: 0.35, vib: [14, 10] }); // fwump
  },
  shield_break(out, t, p) {
    for (let i = 0; i < 7; i++) tone(out, t + i * rnd(0.008, 0.02), rnd(2400, 6200) * p, { type: 'triangle', a: 0.0005, d: rnd(0.08, 0.25), g: rnd(0.05, 0.11) });
    noise(out, t, { ft: 'highpass', f: 3000, a: 0.0005, d: 0.25, g: 0.4 });
    tone(out, t, 160 * p, { to: 55, dt: 0.2, a: 0.002, d: 0.3, g: 0.6 });
    noise(out, t + 0.02, { ft: 'lowpass', f: 1500, to: 200, a: 0.002, d: 0.3, g: 0.35 });
  },
  bow_release(out, t, p) {
    tone(out, t, 196 * p, { type: 'sawtooth', lp: 1800, a: 0.001, d: 0.35, g: 0.18, vib: [28, 12] }); // string twang
    tone(out, t, 392 * p, { type: 'triangle', a: 0.001, d: 0.2, g: 0.12 });
    noise(out, t + 0.01, { f: 2600 * p, to: 700 * p, dt: 0.3, q: 1.4, a: 0.01, d: 0.3, g: 0.4 }); // arrow whoosh
    noise(out, t, { ft: 'highpass', f: 3000, a: 0.0005, d: 0.015, g: 0.25 });
  },
  blade_slash(out, t, p) {
    const r = p * rnd(0.94, 1.06);
    noise(out, t, { f: 1200 * r, sw: [[0.06, 5200 * r], [0.16, 1800 * r]], q: 2, a: 0.02, h: 0.02, d: 0.13, g: 0.55 });
    tone(out, t + 0.04, 3100 * r, { a: 0.001, d: 0.18, g: 0.06 });
    tone(out, t + 0.04, 4700 * r, { a: 0.001, d: 0.12, g: 0.04 });
    noise(out, t + 0.09, { ft: 'lowpass', f: 2000 * r, q: 2, a: 0.002, d: 0.08, g: 0.3 });
  },
  blade_charge_slash(out, t, p) {
    noise(out, t, { f: 400 * p, sw: [[0.15, 6000 * p], [0.4, 1500 * p]], q: 1.6, a: 0.05, h: 0.05, d: 0.3, g: 0.6 });
    for (const [f, g] of [[2093, 0.08], [3136, 0.06], [4186, 0.04]]) tone(out, t + 0.12, f * p, { a: 0.002, d: 0.5, g });
    tone(out, t + 0.12, 120 * p, { to: 40, dt: 0.3, a: 0.003, d: 0.45, g: 0.7 });
    noise(out, t + 0.14, { f: 1500 * p, to: 500 * p, q: 1.4, a: 0.005, d: 0.35, g: 0.4 });
    droplets(out, t + 0.15, 6, 0.3, 600 * p, 1800 * p, 0.1);
  },
  splatling_fire(out, t, p) {
    const r = p * rnd(0.95, 1.05);
    noise(out, t, { ft: 'highpass', f: 3500, a: 0.0005, d: 0.008, g: 0.3 });
    tone(out, t, 640 * r, { type: 'square', to: 230 * r, dt: 0.04, lp: 2200, a: 0.001, d: 0.05, g: 0.14 });
    noise(out, t, { f: 2200 * r, to: 900 * r, dt: 0.04, q: 2.5, a: 0.001, d: 0.05, g: 0.35 });
  },

  // — subs —
  sticky_attach(out, t, p) {
    tone(out, t, 320 * p, { to: 120 * p, dt: 0.08, a: 0.002, d: 0.1, g: 0.4 });
    noise(out, t, { f: 650 * p, q: 6, a: 0.003, d: 0.12, g: 0.45 });
    noise(out, t + 0.06, { ft: 'highpass', f: 3000, a: 0.0005, d: 0.01, g: 0.25 }); // latch click
    tone(out, t + 0.06, 2200 * p, { type: 'square', lp: 4000, a: 0.0005, d: 0.02, g: 0.05 });
  },
  pop_bomb(out, t, p) {
    const r = p * rnd(0.94, 1.06);
    tone(out, t, 520 * r, { to: 90 * r, dt: 0.05, a: 0.001, d: 0.08, g: 0.5 });
    tone(out, t, 110 * r, { to: 40, dt: 0.2, a: 0.002, d: 0.28, g: 0.6 });
    noise(out, t, { ft: 'lowpass', f: 3200 * r, to: 300, dt: 0.25, a: 0.001, d: 0.28, g: 0.55 });
    droplets(out, t + 0.03, 5, 0.25, 700 * r, 1900 * r, 0.09);
  },
  skid_bomb_launch(out, t, p) {
    tone(out, t, 130 * p, { to: 70 * p, dt: 0.08, a: 0.002, d: 0.12, g: 0.45 }); // thunk
    noise(out, t, { f: 500 * p, to: 2500 * p, dt: 0.12, q: 1.5, a: 0.01, d: 0.14, g: 0.35 }); // launch whoosh
    noise(out, t + 0.1, { f: 3200 * p, q: 1.2, a: 0.03, h: 0.25, d: 0.2, g: 0.18, am: [26, 0.5] }); // skitter
    tone(out, t + 0.06, 600 * p, { to: 1100 * p, dt: 0.06, a: 0.003, d: 0.06, g: 0.1 });
  },
  sprinkler_place(out, t, p) {
    tone(out, t, 180 * p, { to: 90 * p, dt: 0.05, a: 0.002, d: 0.1, g: 0.45 });
    noise(out, t, { ft: 'highpass', f: 2500, a: 0.0005, d: 0.02, g: 0.3 });
    tone(out, t + 0.01, 1900 * p, { type: 'square', lp: 5000, a: 0.0005, d: 0.03, g: 0.05 });
    for (let i = 0; i < 3; i++) noise(out, t + 0.15 + i * 0.09, { f: 5000, q: 1, a: 0.004, d: 0.05, g: 0.18 });
  },

  // — specials —
  camo_on(out, t, p) {
    tone(out, t, 1800 * p, { type: 'triangle', to: 380 * p, dt: 0.45, a: 0.02, h: 0.1, d: 0.35, g: 0.12, vib: [9, 40] });
    tone(out, t, 2400 * p, { to: 500 * p, dt: 0.5, a: 0.02, h: 0.1, d: 0.35, g: 0.06, vib: [11, 60] });
    noise(out, t, { f: 8000, to: 1500, dt: 0.5, q: 3, a: 0.05, h: 0.1, d: 0.35, g: 0.15 });
  },
  camo_off(out, t, p) {
    tone(out, t, 400 * p, { type: 'triangle', to: 1800 * p, dt: 0.25, a: 0.01, d: 0.2, g: 0.12, vib: [10, 40] });
    noise(out, t, { f: 1500, to: 7000, dt: 0.25, q: 3, a: 0.03, d: 0.2, g: 0.15 });
    tone(out, t + 0.22, 300 * p, { to: 900 * p, dt: 0.06, a: 0.002, d: 0.08, g: 0.25 }); // pop
  },
  shield_up(out, t, p) {
    for (const [f, det] of [[200, -8], [300, 6], [400, 0]]) {
      tone(out, t, f * p, { type: 'sawtooth', to: f * 2 * p, dt: 0.35, det, lp: 1500, a: 0.05, h: 0.2, d: 0.4, g: 0.08 });
    }
    tone(out, t + 0.3, 1568 * p, { a: 0.003, d: 0.6, g: 0.12 });
    tone(out, t + 0.3, 2349 * p, { a: 0.003, d: 0.5, g: 0.06 });
    noise(out, t, { f: 400, to: 3000, dt: 0.35, q: 1.2, a: 0.25, d: 0.2, g: 0.25 });
  },
  jetpack_start(out, t, p) {
    noise(out, t, { ft: 'highpass', f: 3000, a: 0.0005, d: 0.015, g: 0.35 }); // igniter
    noise(out, t + 0.03, { ft: 'lowpass', f: 300 * p, to: 2500 * p, dt: 0.4, q: 1, a: 0.2, h: 0.15, d: 0.3, g: 0.6 }); // roar rise
    tone(out, t + 0.03, 55 * p, { to: 90 * p, dt: 0.4, a: 0.15, h: 0.15, d: 0.3, g: 0.5 }); // sub
    noise(out, t + 0.03, { f: 600 * p, to: 3500 * p, dt: 0.4, q: 1.5, a: 0.25, d: 0.25, g: 0.25 });
  },
  rain_start(out, t, p) {
    noise(out, t, { ft: 'lowpass', f: 200, to: 1200, dt: 0.6, q: 0.7, pink: true, a: 0.3, h: 0.3, d: 0.8, g: 0.45 }); // rumble
    noise(out, t + 0.1, { ft: 'highpass', f: 1500, a: 0.6, h: 0.2, d: 0.5, g: 0.25 }); // hiss rise
    droplets(out, t + 0.2, 12, 1.0, 900 * p, 2800 * p, 0.08);
  },

  // — story —
  pickup(out, t, p) {
    tone(out, t, 1568 * p, { type: 'triangle', a: 0.002, d: 0.12, g: 0.22 });
    tone(out, t + 0.06, 2349 * p, { type: 'triangle', a: 0.002, d: 0.25, g: 0.22 });
    tone(out, t + 0.06, 4698 * p, { a: 0.002, d: 0.12, g: 0.04 });
    noise(out, t + 0.05, { ft: 'highpass', f: 7000, a: 0.01, d: 0.15, g: 0.05 });
  },
  checkpoint(out, t, p) {
    const s = semis(p);
    [72, 76, 79, 84, 88].forEach((m, i) => vBell(out, t + i * 0.07, m + s, 0.2, 0.8, 0.8));
    vChord(out, t + 0.28, [60, 67, 72, 76].map((m) => m + s), 0.9, 0.6, 'pad');
    noise(out, t, { f: 400, to: 4000, dt: 0.4, q: 1, a: 0.3, d: 0.3, g: 0.12 });
  },
  enemy_hit(out, t, p) {
    const r = p * rnd(0.93, 1.07);
    noise(out, t, { f: 1500 * r, q: 1.5, a: 0.001, d: 0.06, g: 0.5 });
    tone(out, t, 420 * r, { type: 'square', to: 180 * r, dt: 0.07, lp: 2500, a: 0.001, d: 0.08, g: 0.18 });
    tone(out, t, 150 * r, { to: 70, dt: 0.06, a: 0.001, d: 0.08, g: 0.4 });
  },
  enemy_pop(out, t, p) {
    noise(out, t, { ft: 'highpass', f: 1500, a: 0.0005, d: 0.04, g: 0.55 }); // balloon pop
    tone(out, t, 900 * p, { to: 150 * p, dt: 0.07, a: 0.001, d: 0.1, g: 0.4 });
    noise(out, t, { ft: 'lowpass', f: 2500 * p, to: 300, dt: 0.3, a: 0.002, d: 0.3, g: 0.45 });
    droplets(out, t + 0.03, 6, 0.3, 700 * p, 2000 * p, 0.1);
    tone(out, t + 0.12, 1046 * p, { type: 'triangle', to: 2093 * p, dt: 0.08, a: 0.002, d: 0.12, g: 0.12 }); // reward blip
  },
  boss_roar(out, t, p) {
    growl(out, t, 78 * p, 1.4, 0.55, 'a', 'o');
    noise(out, t, { f: 900 * p, q: 0.8, pink: true, a: 0.15, h: 0.8, d: 0.45, g: 0.25 }); // breath
    tone(out, t, 45, { a: 0.1, h: 0.9, d: 0.4, g: 0.5 }); // sub rumble
  },
  boss_hurt(out, t, p) {
    growl(out, t, 110 * p, 0.55, 0.5, 'e', 'u');
    tone(out, t, 150 * p, { to: 50, dt: 0.15, a: 0.002, d: 0.25, g: 0.6 });
    noise(out, t, { ft: 'lowpass', f: 2000, to: 300, a: 0.002, d: 0.25, g: 0.35 });
  },
  launch(out, t, p) {
    tone(out, t, 150 * p, { to: 620 * p, dt: 0.25, a: 0.003, d: 0.35, g: 0.4, vib: [13, 35] }); // boing
    noise(out, t + 0.05, { f: 400, to: 3500, dt: 0.45, q: 1.2, a: 0.15, d: 0.35, g: 0.35 }); // whoosh up
    tone(out, t, 90, { to: 45, dt: 0.1, a: 0.002, d: 0.15, g: 0.45 }); // pad thump
  },
  core_get(out, t, p) {
    const s = semis(p);
    [72, 76, 79, 83, 84, 88, 91, 96].forEach((m, i) => vBell(out, t + i * 0.06, m + s, 0.2, 0.75, 0.9));
    vChord(out, t + 0.45, [60, 64, 67, 71, 74].map((m) => m + s), 1.4, 0.9, 'brass');
    vChord(out, t + 0.45, [48, 55, 64, 72].map((m) => m + s), 1.6, 0.7, 'pad');
    noise(out, t, { ft: 'highpass', f: 6000, a: 0.4, h: 0.4, d: 0.8, g: 0.07 });
    vCrash(out, t + 0.45, 0.6);
  },
  dialog_blip(out, t, p) {
    tone(out, t, 1200 * p, { type: 'square', lp: 3000, a: 0.002, h: 0.015, d: 0.03, g: 0.08 });
    tone(out, t, 1800 * p, { a: 0.002, h: 0.01, d: 0.03, g: 0.1 });
  },
  door_heavy(out, t, p) {
    noise(out, t, { ft: 'lowpass', f: 180 * p, pink: true, q: 1, a: 0.1, h: 0.5, d: 0.3, g: 0.8 }); // grinding rumble
    noise(out, t, { f: 900 * p, q: 3, a: 0.1, h: 0.5, d: 0.3, g: 0.1 }); // metal scrape
    tone(out, t, 90 * p, { to: 60 * p, dt: 0.1, a: 0.002, d: 0.25, g: 0.6 }); // unlatch clunk
    tone(out, t + 0.85, 75 * p, { to: 40, dt: 0.15, a: 0.002, d: 0.4, g: 0.8 }); // slam
    noise(out, t + 0.85, { ft: 'lowpass', f: 1500, to: 200, a: 0.001, d: 0.3, g: 0.4 });
    noise(out, t + 0.9, { ft: 'highpass', f: 3000, a: 0.05, d: 0.35, g: 0.08 }); // pneumatic hiss
  },
  tongue(out, t, p) {
    const r = p * rnd(0.95, 1.05);
    tone(out, t, 320 * r, { to: 2200 * r, dt: 0.06, a: 0.002, d: 0.07, g: 0.3 }); // thwip out
    noise(out, t, { f: 1500 * r, to: 5000 * r, dt: 0.06, q: 2, a: 0.002, d: 0.06, g: 0.25 });
    tone(out, t + 0.09, 1600 * r, { to: 260 * r, dt: 0.14, a: 0.003, d: 0.16, g: 0.25, vib: [24, 80] }); // stretchy return
    noise(out, t + 0.22, { ft: 'lowpass', f: 1500, q: 3, a: 0.001, d: 0.05, g: 0.3 }); // smack
  },
  news_sting(out, t, p) {
    const s = semis(p);
    vTom(out, t, 0.6, 110);
    vTom(out, t + 0.14, 0.6, 130);
    vLead(out, t, 70 + s, 0.12, 0.9, 'brass');
    vLead(out, t + 0.14, 74 + s, 0.12, 0.9, 'brass');
    vLead(out, t + 0.28, 77 + s, 0.6, 1, 'brass');
    vChord(out, t + 0.28, [58, 62, 65, 70].map((m) => m + s), 0.6, 0.9, 'brass');
    for (const [m, dt] of [[82, 0.28], [86, 0.36], [89, 0.44]]) vBell(out, t + dt, m + s, 0.1, 0.6, 0.7);
    vKick(out, t + 0.28, 0.8);
    vCrash(out, t + 0.28, 0.5);
  },

  // — UI & match flow —
  ui_move(out, t, p) {
    tone(out, t, 1900 * p, { a: 0.001, d: 0.025, g: 0.16 });
    tone(out, t, 950 * p, { type: 'triangle', a: 0.001, d: 0.02, g: 0.07 });
  },
  ui_select(out, t, p) {
    tone(out, t, 880 * p, { type: 'triangle', a: 0.002, h: 0.03, d: 0.08, g: 0.26 });
    tone(out, t + 0.06, 1318.5 * p, { type: 'triangle', a: 0.002, h: 0.04, d: 0.14, g: 0.26 });
    tone(out, t + 0.06, 2637 * p, { a: 0.002, d: 0.1, g: 0.05 });
  },
  ui_back(out, t, p) {
    tone(out, t, 784 * p, { type: 'triangle', a: 0.002, h: 0.03, d: 0.07, g: 0.24 });
    tone(out, t + 0.06, 523.25 * p, { type: 'triangle', a: 0.002, h: 0.03, d: 0.12, g: 0.24 });
  },
  ui_error(out, t, p) {
    for (const dt of [0, 0.13]) {
      tone(out, t + dt, 150 * p, { type: 'square', lp: 1400, a: 0.004, h: 0.07, d: 0.04, g: 0.14 });
      tone(out, t + dt, 157 * p, { type: 'sawtooth', lp: 1400, a: 0.004, h: 0.07, d: 0.04, g: 0.1 });
    }
  },
  coin(out, t, p) {
    [1318.5, 1975.5, 2637].forEach((f, i) => {
      tone(out, t + i * 0.05, f * p, { type: 'triangle', a: 0.002, d: 0.3 + i * 0.1, g: 0.18 });
      tone(out, t + i * 0.05, f * 2 * p, { a: 0.002, d: 0.15, g: 0.05 });
    });
    noise(out, t, { ft: 'highpass', f: 8000, a: 0.01, d: 0.25, g: 0.05 });
  },
  buy(out, t, p) {
    noise(out, t, { f: 2500, q: 2, a: 0.002, d: 0.05, g: 0.32 }); // register "ka"
    tone(out, t, 220, { type: 'square', to: 180, lp: 1200, a: 0.002, d: 0.04, g: 0.1 });
    for (const f of [2400, 3150, 4020]) tone(out, t + 0.07, f, { a: 0.001, d: 0.4, g: 0.06 }); // "ching"
    SFX.coin(out, t + 0.08, p);
  },
  countdown(out, t, p) {
    tone(out, t, 880 * p, { type: 'square', lp: 2500, a: 0.003, h: 0.09, d: 0.08, g: 0.1 });
    tone(out, t, 880 * p, { a: 0.003, h: 0.09, d: 0.1, g: 0.22 });
  },
  go(out, t, p) {
    for (const f of [880, 1108.7, 1318.5]) tone(out, t, f * p, { type: 'square', lp: 4000, a: 0.005, h: 0.28, d: 0.3, g: 0.07 });
    tone(out, t, 1760 * p, { a: 0.005, h: 0.25, d: 0.3, g: 0.12 });
    tone(out, t, 440 * p, { type: 'sawtooth', lp: 2000, a: 0.005, h: 0.25, d: 0.3, g: 0.08 });
    noise(out, t, { f: 1500, to: 6000, dt: 0.3, a: 0.02, d: 0.3, g: 0.1 });
    vKick(out, t, 0.7);
  },
  one_minute(out, t, p) {
    [[81, 0, 0.09], [85, 0.1, 0.09], [88, 0.2, 0.09], [93, 0.34, 0.4]].forEach(([m, dt, len]) => {
      const f = mtof(m) * p;
      tone(out, t + dt, f, { type: 'square', lp: 3500, a: 0.004, h: len * 0.6, d: len * 0.6 + 0.1, g: 0.08 });
      tone(out, t + dt, f, { type: 'triangle', a: 0.004, h: len * 0.6, d: len * 0.6 + 0.15, g: 0.2 });
    });
    vSnare(out, t + 0.34, 0.5);
  },
  whistle(out, t, p) {
    const blast = (t0, len, g) => {
      // pea-whistle: sine with a fast trill + breathy band of noise
      const os = mkOsc('sine', 2750 * p), l = mkOsc('sine', 32), gn = mkGain(0);
      os.frequency.setValueAtTime(Math.min(hz(2750 * p), 16000), t0);
      wire(l, mkGain(110), os.frequency);
      const e = env(gn.gain, t0, 0.015, len, 0.08, g) + 0.02;
      wire(os, gn, out);
      os.start(t0);
      l.start(t0);
      os.stop(e);
      l.stop(e);
      os.onended = () => gn.disconnect();
      mark(e);
      noise(out, t0, { f: 2750 * p, q: 3, a: 0.015, h: len, d: 0.08, g: g * 0.6 });
      tone(out, t0, 5500 * p, { a: 0.015, h: len, d: 0.08, g: g * 0.08 });
    };
    blast(t, 0.16, 0.22);
    blast(t + 0.26, 0.75, 0.24);
  },
  judge_drum(out, t) {
    // accelerating, swelling snare roll over a timpani rumble, then the reveal hit at ~2.45 s
    for (let x = 0, i = 0; x < 2.4; i++) {
      const k = x / 2.4, v = 0.15 + 0.6 * k * k;
      noise(out, t + x, { f: 2200, q: 0.8, a: 0.001, d: 0.07, g: v * (i % 2 ? 0.75 : 1) });
      x += 0.075 - 0.038 * k;
    }
    tone(out, t, 72, { a: 2.3, d: 0.15, g: 0.35, vib: [16, 4] });
    noise(out, t, { ft: 'lowpass', f: 300, pink: true, a: 2.3, d: 0.1, g: 0.3 });
    const hitT = t + 2.45;
    vKick(out, hitT, 1);
    vSnare(out, hitT, 0.9);
    vCrash(out, hitT, 0.9);
  },
  win_fanfare(out, t) {
    const s = 60 / 132 / 4; // 16th note at 132 bpm
    for (const [m, at, len] of [[72, 0, 1.5], [72, 2, 1.5], [72, 4, 1.5], [79, 6, 3.5], [76, 10, 1.5], [79, 12, 3.5], [84, 16, 14]]) {
      vLead(out, t + at * s, m, len * s, 0.95, 'brass');
    }
    vChord(out, t, [60, 64, 67], 9 * s, 0.8, 'brass');
    vChord(out, t + 10 * s, [62, 67, 71], 6 * s, 0.8, 'brass');
    vChord(out, t + 16 * s, [60, 64, 67, 72], 14 * s, 1, 'brass');
    vBass(out, t, 36, 9 * s, 0.9, 'pick');
    vBass(out, t + 10 * s, 43, 6 * s, 0.9, 'pick');
    vBass(out, t + 16 * s, 36, 14 * s, 1, 'pick');
    vKick(out, t, 0.8);
    for (let i = 6; i < 16; i++) vSnare(out, t + i * s, 0.2 + (i - 6) * 0.05);
    vKick(out, t + 16 * s, 1);
    vCrash(out, t + 16 * s, 0.9);
  },
  lose_sting(out, t) {
    // Fmaj7 → E7: bittersweet, still cute
    vChord(out, t, [65, 69, 72, 76], 0.6, 0.55, 'soft');
    vChord(out, t + 0.62, [64, 68, 71, 74], 1.1, 0.55, 'soft');
    for (const [m, dt] of [[81, 0], [76, 0.16], [72, 0.32]]) vBell(out, t + dt, m, 0.15, 0.7, 0.6);
    vLead(out, t + 0.62, 71, 0.9, 0.7, 'soft');
    vBass(out, t, 41, 0.55, 0.6, 'funk');
    vBass(out, t + 0.62, 40, 1.0, 0.6, 'funk');
  },
  door(out, t, p) {
    noise(out, t, { f: 600 * p, sw: [[0.18, 2400 * p], [0.38, 900 * p]], q: 1.3, a: 0.06, h: 0.12, d: 0.2, g: 0.35 });
    noise(out, t, { ft: 'highpass', f: 5000, a: 0.03, h: 0.15, d: 0.15, g: 0.05 });
    tone(out, t + 0.36, 140 * p, { to: 70 * p, dt: 0.08, a: 0.002, d: 0.1, g: 0.3 });
    noise(out, t + 0.36, { ft: 'lowpass', f: 1200, a: 0.001, d: 0.05, g: 0.15 });
  },
  talk(out, t, p) {
    const F = pick(VOWELS), s = Math.sqrt(p);
    syllable(out, t, 340 * p * rnd(0.92, 1.12), F[0] * s, F[1] * s, rnd(0.04, 0.08), 0.6);
    tone(out, t, 340 * p, { type: 'triangle', a: 0.006, h: 0.03, d: 0.04, g: 0.08 });
  },
};
const SFX_REV = {
  charge_shot: 0.15, splatted: 0.3, ko_confirm: 0.2, explode: 0.35, special_ready: 0.3, special_go: 0.3,
  respawn: 0.3, go: 0.25, one_minute: 0.2, whistle: 0.2, judge_drum: 0.25, win_fanfare: 0.3, lose_sting: 0.3,
  coin: 0.2, buy: 0.2, ink_full: 0.15, door: 0.1, countdown: 0.15, hit: 0.05, bomb_beep: 0.1,
  bow_release: 0.1, blade_charge_slash: 0.2, shield_break: 0.2, camo_on: 0.25, camo_off: 0.2, shield_up: 0.25,
  jetpack_start: 0.15, rain_start: 0.3, pickup: 0.15, checkpoint: 0.3, enemy_pop: 0.15, boss_roar: 0.35,
  boss_hurt: 0.25, launch: 0.15, core_get: 0.35, door_heavy: 0.3, news_sting: 0.3, pop_bomb: 0.15, brella_shot: 0.1,
};
const SFX_CAP = {
  shoot: 6, shoot_heavy: 5, splat: 8, hit: 3, climb_step: 3, talk: 2, bomb_beep: 4, explode: 5, splatted: 4,
  enemy_ink: 2, ui_move: 2, jump: 4, land: 4, countdown: 2, judge_drum: 1, win_fanfare: 1, lose_sting: 1,
  whistle: 1, one_minute: 1, go: 1, special_ready: 1, special_go: 2, ink_empty: 2, ink_full: 1,
  dualie_shot: 8, splatling_fire: 8, brush_swish: 4, blade_slash: 3, dialog_blip: 2, pickup: 3, enemy_hit: 4,
  enemy_pop: 4, sticky_attach: 3, pop_bomb: 4, boss_roar: 1, boss_hurt: 2, news_sting: 1, core_get: 1,
  checkpoint: 1, launch: 2, tongue: 3, brella_shot: 4, slosh: 4, door_heavy: 1, camo_on: 2, camo_off: 2,
};
/** [depth, hold seconds]: briefly lowers the music under big moments. */
const SFX_DUCK = {
  explode: [0.3, 0.3], splatted: [0.2, 0.25], whistle: [0.5, 1.0], one_minute: [0.45, 1.0], win_fanfare: [0.6, 3.2],
  lose_sting: [0.5, 1.6], go: [0.3, 0.5], special_go: [0.3, 0.6], judge_drum: [0.55, 2.8],
  boss_roar: [0.4, 1.2], core_get: [0.55, 1.6], checkpoint: [0.3, 0.8], news_sting: [0.5, 1.0], rain_start: [0.15, 0.5],
};
const MAX_VOICES = 48;
const voices = new Map(); // name -> [{ out, end, chain, released }]

function releaseVoice(v) {
  if (v.released) return;
  v.released = true;
  unplug(v.chain);
}
function killVoice(v, now) {
  if (v.released) return;
  v.out.gain.setTargetAtTime(0, now, 0.01);
  v.end = now;
  setTimeout(() => releaseVoice(v), 90);
}
function playSfx(name, gen, o) {
  const now = ctx.currentTime, t = now + 0.004;
  let g = clamp(num(o.volume, 1), 0, 1.5);
  const p = clamp(num(o.pitch, 1), 0.25, 4);
  let sp = null;
  if (hasPos(o)) {
    sp = spatial(num(o.x, listener.x), num(o.y, listener.y), num(o.z, listener.z));
    g *= sp.g;
  }
  if (g < 0.003) return; // out of earshot

  // voice caps: per name (drop the oldest), plus a global ceiling
  let total = 0;
  for (const list of voices.values()) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].end <= now) list.splice(i, 1);
    total += list.length;
  }
  let list = voices.get(name);
  if (!list) voices.set(name, (list = []));
  while (list.length >= (SFX_CAP[name] || 4)) killVoice(list.shift(), now);
  if (total >= MAX_VOICES && !name.startsWith('ui_')) return;

  const out = mkGain(g), chain = [out];
  let tail = out;
  if (sp && sp.lp < 16000) chain.push((tail = wire(tail, mkFilter('lowpass', sp.lp, 0.6))));
  if (sp && Math.abs(sp.pan) > 0.01) chain.push((tail = wire(tail, mkPan(sp.pan))));
  tail.connect(sfxBus);
  if (SFX_REV[name]) {
    const send = mkGain(SFX_REV[name]);
    wire(out, send, sfxRev);
    chain.push(send);
  }
  _end = t;
  gen(out, t, p, o);
  const v = { out, end: _end + 0.05, chain, released: false };
  list.push(v);
  setTimeout(() => releaseVoice(v), (v.end - now) * 1000 + 150);
  if (SFX_DUCK[name]) duck(SFX_DUCK[name][0] * Math.min(1, g), SFX_DUCK[name][1]);
}

let duckUntil = 0, duckDepth = 0;
function duck(depth, hold) {
  if (depth < 0.02) return;
  const now = ctx.currentTime, p = musicDuck.gain;
  if (now < duckUntil) {
    depth = Math.max(depth, duckDepth);
    hold = Math.max(hold, duckUntil - now);
  }
  duckDepth = depth;
  duckUntil = now + hold;
  p.cancelScheduledValues(now);
  p.setTargetAtTime(1 - clamp(depth, 0, 0.8), now, 0.03);
  p.setTargetAtTime(1, now + hold, 0.25);
}

// ───────────────────────────── loops ──────────────────────────────
// Builders: (out, t, st) → { srcs, nodes, timers?, setPitch(p, t) }

/** Schedules one-shots ~150 ms ahead; fn(atTime) returns the gap to the next one. */
function randomEvents(st, every, fn) {
  let next = ctx.currentTime + 0.02;
  return setInterval(() => {
    try {
      if (!ctx || st.stopped) return;
      const now = ctx.currentTime;
      if (next < now) next = now + 0.01;
      while (next < now + 0.15) next += fn(next);
    } catch (e) {
      warn(e);
    }
  }, every);
}
/** Looping noise → filter → gain → out (a common loop layer). */
function bed(out, t, buf, type, f, q, g) {
  const s = noiseSrc(buf, t, 0, 1, true), fl = mkFilter(type, f, q), gn = mkGain(g);
  wire(s, fl, gn, out);
  return { s, fl, gn, nodes: [s, fl, gn] };
}
const LOOPS = {
  swim(out, t, st) {
    const B = bed(out, t, pinkBuf, 'bandpass', 520, 2.5, 0.9), lfo = mkOsc('sine', 3.2), lg = mkGain(260), bub = mkGain(1.4);
    wire(lfo, lg, B.fl.frequency);
    bub.connect(out);
    lfo.start(t);
    const timer = randomEvents(st, 50, (at) => {
      const f = rnd(170, 480) * st.pitch;
      tone(bub, at, f, { to: f * rnd(1.7, 2.6), dt: 0.045, a: 0.003, d: 0.05, g: rnd(0.06, 0.16) });
      return rnd(0.035, 0.12);
    });
    return {
      srcs: [B.s, lfo], nodes: [...B.nodes, lfo, lg, bub], timers: [timer],
      setPitch(p, tt) {
        B.fl.frequency.setTargetAtTime(hz(520 * p), tt, 0.05);
        lfo.frequency.setTargetAtTime(3.2 * p, tt, 0.05);
      },
    };
  },
  roll(out, t) {
    // low rumble + a squishy band pulsed by an LFO + a faint motor hum
    const src = noiseSrc(pinkBuf, t, 0, 1, true);
    const lp = mkFilter('lowpass', 420, 1.2), lg = mkGain(0.5), bp = mkFilter('bandpass', 1100, 1.8), am = mkGain(0.15);
    const lfo = mkOsc('triangle', 8.5), lfoG = mkGain(0.13), hum = mkOsc('triangle', 58), hg = mkGain(0.05);
    wire(lfo, lfoG, am.gain);
    wire(src, lp, lg, out);
    wire(src, bp, am, out);
    wire(hum, hg, out);
    lfo.start(t);
    hum.start(t);
    return {
      srcs: [src, lfo, hum], nodes: [src, lp, lg, bp, am, lfo, lfoG, hum, hg],
      setPitch(p, tt) {
        lfo.frequency.setTargetAtTime(8.5 * p, tt, 0.05);
        bp.frequency.setTargetAtTime(hz(1100 * p), tt, 0.05);
        hum.frequency.setTargetAtTime(58 * p, tt, 0.05);
        lp.frequency.setTargetAtTime(hz(420 * p), tt, 0.05);
      },
    };
  },
  charge(out, t) {
    const base = 300;
    const o1 = mkOsc('sawtooth', base), o2 = mkOsc('sine', base * 2, 5), o3 = mkOsc('triangle', base * 4.01);
    const vib = mkOsc('sine', 9), vg = wire(vib, mkGain(14)), f = mkFilter('lowpass', 1500, 5);
    for (const o of [o1, o2, o3]) vg.connect(o.detune);
    const g1 = mkGain(0.09), g2 = mkGain(0.12), g3 = mkGain(0.03);
    wire(o1, f, g1, out);
    wire(o2, g2, out);
    wire(o3, g3, out);
    const N = bed(out, t, noiseBuf, 'highpass', 5000, 0.7, 0.02);
    for (const o of [o1, o2, o3, vib]) o.start(t);
    return {
      srcs: [o1, o2, o3, vib, N.s], nodes: [o1, o2, o3, vib, vg, f, g1, g2, g3, ...N.nodes],
      setPitch(p, tt) {
        o1.frequency.setTargetAtTime(base * p, tt, 0.03);
        o2.frequency.setTargetAtTime(base * 2 * p, tt, 0.03);
        o3.frequency.setTargetAtTime(Math.min(base * 4.01 * p, 16000), tt, 0.03);
        f.frequency.setTargetAtTime(hz(1500 * p * p), tt, 0.05);
        vib.frequency.setTargetAtTime(9 + 8 * clamp(p - 1, 0, 2), tt, 0.05);
        N.gn.gain.setTargetAtTime(0.02 + 0.05 * clamp(p - 1, 0, 1), tt, 0.05);
      },
    };
  },
  fountain(out, t, st) {
    const src = noiseSrc(noiseBuf, t, 0, 1, true);
    const hp = mkFilter('highpass', 400, 0.5), bp = mkFilter('bandpass', 2000, 0.5), g = mkGain(0.32);
    const l1 = mkOsc('sine', 0.31), l1g = mkGain(700), l2 = mkOsc('sine', 0.73), l2g = mkGain(0.08);
    const lowF = mkFilter('lowpass', 700, 0.7), lowG = mkGain(0.2), drops = mkGain(1);
    wire(l1, l1g, bp.frequency);
    wire(l2, l2g, g.gain);
    wire(src, hp, bp, g, out);
    wire(src, lowF, lowG, out);
    drops.connect(out);
    l1.start(t);
    l2.start(t);
    const timer = randomEvents(st, 60, (at) => {
      const f = rnd(900, 2600) * st.pitch;
      tone(drops, at, f, { to: f * 1.5, dt: 0.03, a: 0.002, d: 0.04, g: rnd(0.02, 0.06) });
      return rnd(0.04, 0.16);
    });
    return {
      srcs: [src, l1, l2], nodes: [src, hp, bp, g, l1, l1g, l2, l2g, lowF, lowG, drops], timers: [timer],
      setPitch(p, tt) {
        bp.frequency.setTargetAtTime(hz(2000 * p), tt, 0.05);
      },
    };
  },
  crowd(out, t, st) {
    // distant murmur bed + occasional formant "chatter" from passers-by
    const B = bed(out, t, pinkBuf, 'lowpass', 600, 0.6, 0.3);
    const lfo = mkOsc('sine', 0.17), lg = mkGain(0.08), cb = mkFilter('lowpass', 1500, 0.5), cg = mkGain(1);
    wire(lfo, lg, B.gn.gain);
    wire(cb, cg, out);
    lfo.start(t);
    const timer = randomEvents(st, 80, (at) => {
      const f0 = rnd(110, 260), n = 1 + ((Math.random() * 4) | 0), pan = rnd(-0.6, 0.6);
      let x = at;
      for (let i = 0; i < n; i++) {
        const F = pick(VOWELS), dur = rnd(0.05, 0.12);
        syllable(cb, x, f0 * rnd(0.9, 1.1) * st.pitch, F[0], F[1], dur, rnd(0.02, 0.05), pan);
        x += dur + rnd(0.03, 0.08);
      }
      return x - at + rnd(0.1, 0.6);
    });
    return {
      srcs: [B.s, lfo], nodes: [...B.nodes, lfo, lg, cb, cg], timers: [timer],
      setPitch(p, tt) {
        B.fl.frequency.setTargetAtTime(hz(600 * p), tt, 0.05);
      },
    };
  },
  splatling_spin(out, t) {
    // spin-up whine with a mechanical rattle; setPitch 1 → 2 as it charges
    const base = 160, o1 = mkOsc('sawtooth', base), o2 = mkOsc('square', base * 1.5, 4), bp = mkFilter('bandpass', 900, 3);
    const am = mkGain(0.65), rat = mkOsc('square', 24), rg = mkGain(0.35), g = mkGain(0.28);
    wire(rat, rg, am.gain);
    o1.connect(bp);
    o2.connect(bp);
    wire(bp, am, g, out);
    const N = bed(out, t, noiseBuf, 'bandpass', 3000, 1, 0.05);
    for (const o of [o1, o2, rat]) o.start(t);
    return {
      srcs: [o1, o2, rat, N.s], nodes: [o1, o2, bp, am, rat, rg, g, ...N.nodes],
      setPitch(p, tt) {
        o1.frequency.setTargetAtTime(base * p, tt, 0.04);
        o2.frequency.setTargetAtTime(base * 1.5 * p, tt, 0.04);
        bp.frequency.setTargetAtTime(hz(900 * p * p), tt, 0.05);
        rat.frequency.setTargetAtTime(24 * p * 1.5, tt, 0.05);
        N.gn.gain.setTargetAtTime(0.05 + 0.06 * clamp(p - 1, 0, 1), tt, 0.05);
      },
    };
  },
  bow_draw(out, t) {
    // creaky tension: an uneven slow click-train through resonant filters + a rising string hum
    const ck = mkOsc('sawtooth', 32), jit = mkOsc('sine', 3.3), jg = mkGain(8), bp = mkFilter('bandpass', 1400, 4), cg = mkGain(0.5);
    const hum = mkOsc('triangle', 110), hf = mkFilter('lowpass', 600), hg = mkGain(0.06);
    wire(jit, jg, ck.frequency);
    wire(ck, mkFilter('highpass', 700, 0.7), bp, cg, out);
    wire(hum, hf, hg, out);
    for (const o of [ck, jit, hum]) o.start(t);
    return {
      srcs: [ck, jit, hum], nodes: [ck, jit, jg, bp, cg, hum, hf, hg],
      setPitch(p, tt) {
        ck.frequency.setTargetAtTime(32 * p, tt, 0.05);
        bp.frequency.setTargetAtTime(hz(1400 * p), tt, 0.05);
        hum.frequency.setTargetAtTime(110 * p, tt, 0.05);
        hg.gain.setTargetAtTime(0.06 + 0.06 * clamp(p - 1, 0, 1), tt, 0.05);
      },
    };
  },
  jetpack(out, t) {
    const R = bed(out, t, pinkBuf, 'lowpass', 900, 0.8, 0.6), H = bed(out, t, noiseBuf, 'bandpass', 2200, 0.7, 0.12);
    const sub = mkOsc('sine', 55), sg = mkGain(0.25), fl = mkOsc('sine', 13), fg = mkGain(0.1);
    wire(fl, fg, sg.gain);
    wire(sub, sg, out);
    sub.start(t);
    fl.start(t);
    return {
      srcs: [R.s, H.s, sub, fl], nodes: [...R.nodes, ...H.nodes, sub, sg, fl, fg],
      setPitch(p, tt) {
        R.fl.frequency.setTargetAtTime(hz(900 * p), tt, 0.05);
        H.fl.frequency.setTargetAtTime(hz(2200 * p), tt, 0.05);
        sub.frequency.setTargetAtTime(55 * p, tt, 0.05);
        fl.frequency.setTargetAtTime(13 * p, tt, 0.05);
      },
    };
  },
  rain(out, t, st) {
    const H = bed(out, t, noiseBuf, 'bandpass', 5000, 0.4, 0.22), W = bed(out, t, pinkBuf, 'lowpass', 500, 0.7, 0.2), drops = mkGain(1);
    drops.connect(out);
    const timer = randomEvents(st, 40, (at) => {
      const f = rnd(1500, 4000) * st.pitch;
      tone(drops, at, f, { to: f * 0.7, dt: 0.02, a: 0.001, d: 0.03, g: rnd(0.02, 0.07) });
      return rnd(0.015, 0.06);
    });
    return {
      srcs: [H.s, W.s], nodes: [...H.nodes, ...W.nodes, drops], timers: [timer],
      setPitch(p, tt) {
        H.fl.frequency.setTargetAtTime(hz(5000 * p), tt, 0.05);
      },
    };
  },
  sprinkler(out, t, st) {
    // rhythmic "tch-tch-tch" spritz + ratchet clicks over a faint mist (setPitch scales the rate)
    const M = bed(out, t, noiseBuf, 'highpass', 6000, 0.6, 0.03), sp = mkGain(1);
    sp.connect(out);
    const timer = randomEvents(st, 40, (at) => {
      noise(sp, at, { f: 5200, q: 0.9, a: 0.004, d: 0.06, g: 0.3 });
      noise(sp, at, { ft: 'highpass', f: 3000, a: 0.0005, d: 0.006, g: 0.12 });
      return 0.15 / st.pitch;
    });
    return { srcs: [M.s], nodes: [...M.nodes, sp], timers: [timer], setPitch() {} };
  },
  skid(out, t) {
    const S = bed(out, t, noiseBuf, 'bandpass', 1800, 1.2, 0.35), R = bed(out, t, pinkBuf, 'lowpass', 250, 0.7, 0.25);
    const lfo = mkOsc('sine', 5), lg = mkGain(300);
    wire(lfo, lg, S.fl.frequency);
    lfo.start(t);
    return {
      srcs: [S.s, R.s, lfo], nodes: [...S.nodes, ...R.nodes, lfo, lg],
      setPitch(p, tt) {
        S.fl.frequency.setTargetAtTime(hz(1800 * p), tt, 0.05);
        R.fl.frequency.setTargetAtTime(hz(250 * p), tt, 0.05);
      },
    };
  },
  shop_ambience(out, t, st) {
    // indoor room tone + faint mains hum + the street muffled through the window
    const R = bed(out, t, pinkBuf, 'lowpass', 260, 0.5, 0.25), hum = mkOsc('sine', 60), hg = mkGain(0.012);
    const street = mkFilter('lowpass', 700, 0.5), sg = mkGain(1);
    wire(hum, hg, out);
    wire(street, sg, out);
    hum.start(t);
    const timer = randomEvents(st, 120, (at) => {
      if (Math.random() < 0.15) {
        noise(street, at, { f: 300, sw: [[1.2, 700], [2.6, 250]], q: 0.8, pink: true, a: 1.2, d: 1.4, g: 0.15 }); // car passing
      } else {
        const F = pick(VOWELS);
        syllable(street, at, rnd(120, 240), F[0], F[1], rnd(0.06, 0.12), rnd(0.015, 0.03), rnd(-0.5, 0.5));
      }
      return rnd(0.3, 1.2);
    });
    return {
      srcs: [R.s, hum], nodes: [...R.nodes, hum, hg, street, sg], timers: [timer],
      setPitch(p, tt) {
        R.fl.frequency.setTargetAtTime(hz(260 * p), tt, 0.05);
      },
    };
  },
};

const liveLoops = new Set();
const pendingLoops = [];
const MAX_LOOPS = 24;

function startLoop(st) {
  const t = ctx.currentTime;
  const fade = mkGain(0), lvl = mkGain(0), lp = mkFilter('lowpass', 18000, 0.5), pan = mkPan(0);
  wire(fade, lvl, lp, pan, sfxBus);
  fade.gain.setValueAtTime(0, t);
  fade.gain.linearRampToValueAtTime(1, t + 0.08); // ~80 ms fade in
  const L = { st, fade, lvl, lp, pan, fadeEnd: t + 0.08, last: null, dead: false };
  L.inner = LOOPS[st.name](fade, t, st);
  if (st.pitch !== 1) L.inner.setPitch(st.pitch, t);
  applyLoop(L);
  liveLoops.add(L);
  if (liveLoops.size > MAX_LOOPS) stopLoop(liveLoops.values().next().value); // leak guard
  return L;
}
/** Push volume / distance / pan into a live loop (skips tiny changes, so per-frame calls are cheap). */
function applyLoop(L) {
  let g = L.st.vol, p = 0, f = 18000;
  if (L.st.pos) {
    const s = spatial(L.st.pos[0], L.st.pos[1], L.st.pos[2]);
    g *= s.g;
    p = s.pan;
    f = s.lp;
  }
  const t = ctx.currentTime, last = L.last;
  if (!last) {
    L.lvl.gain.setValueAtTime(g, t);
    if (L.pan.pan) L.pan.pan.setValueAtTime(p, t);
    L.lp.frequency.setValueAtTime(f, t);
  } else {
    if (Math.abs(last.g - g) > 0.002) L.lvl.gain.setTargetAtTime(g, t, 0.04);
    if (L.pan.pan && Math.abs(last.p - p) > 0.01) L.pan.pan.setTargetAtTime(p, t, 0.04);
    if (Math.abs(last.f - f) / f > 0.04) L.lp.frequency.setTargetAtTime(f, t, 0.05);
  }
  L.last = { g, p, f };
}
function stopLoop(L) {
  if (L.dead) return;
  L.dead = true;
  L.st.stopped = true;
  liveLoops.delete(L);
  const t = ctx.currentTime, ts = Math.max(t, L.fadeEnd), end = ts + 0.15;
  L.fade.gain.setTargetAtTime(0, ts, 0.025); // ~80 ms fade out
  halt(L.inner.srcs, end);
  for (const id of L.inner.timers || []) clearInterval(id);
  setTimeout(() => unplug([...L.inner.nodes, L.fade, L.lvl, L.lp, L.pan]), (end - t) * 1000 + 120);
}
const dummyHandle = () => ({ setVolume() {}, setPitch() {}, setPos() {}, stop() {} });

// ───────────────────────────── music: data ────────────────────────
// Notation (one bar = 16 sixteenth-steps):
//   drums / rhythm: 16-char strings. 'X' accent, 'x' normal, '-' ghost (drums)
//                   or sustain (rhythm strings), '.' rest. Arrays = one per bar.
//   gtr:   16-char string: 'm' palm-muted chug, 'P' open power chord, 'c' chord chop,
//          'C' strummed chord, '-' sustain, '.' rest.
//   bass:  16 tokens, semitones above the bar's chord root in the bass register
//          ('12!' = accented / slap pop), '-' sustain, '.' rest.
//   lead / vox: 16 tokens, note names (c5, f#4, bb5), '-' sustain, '.' rest.
//          vox is sung by the formant singer on nonsense syllables.
//   chords: one symbol per bar, or two separated by a space (half a bar each).
// Section flags: crash, pad, arp (+arpRate), harm (3rd-below lead harmony),
// sweep [fromHz, toHz], fill (drum lanes for the last bar), drop [bar, step]
// (band stops, drums + vocals carry on), level (section volume), leadVel,
// leadInst / compInst / leadOct / voxOct / gtrOct overrides.
// Drum lanes: k kick, q tight double-kick, s snare, c clap, h hat, o open hat,
// t tom, r rim, sh shaker, cr crash, rd ride.
const FILL_SN = { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX', h: '', o: '' };
const FILL_TOM = { k: 'X.......X.......', s: '....X...........', t: '........X.x.X.xX', h: 'x.x.x.x.........', o: '', c: '' };
const FILL_FUNK = { k: 'X.....x.X.......', s: '....X..x.xX.x.XX', o: '' };
const INTENSE_H = 'x-Xxx-Xxx-Xxx-Xx';
const FOUR = { k: 'X...X...X...X...', s: '....X.......X...', c: '....X.......X...', h: 'x-.-x-.-x-.-x-.-', o: '..x...x...x...x.' };

// BATTLE — E minor, 140 bpm: skate-punk drive, gritty bass, heavy guitars, sung verse + chorus
const B1_A = [
  'e5 . . e5 g5 . a5 . b5 - . . a5 . g5 .',
  'f#5 - . . d5 . . . a4 . d5 . f#5 . a5 .',
  'g5 - . . e5 . g5 . b5 - . . c6 . b5 .',
  'a5 - . f#5 - . d5 . f#5 - - - . . . .',
  'e5 . . e5 g5 . a5 . b5 - . . d6 . b5 .',
  'a5 - . . f#5 . . . d5 . e5 . f#5 . a5 .',
  'g5 - . e5 - . c5 . e5 . g5 . b5 - . .',
  'a5 - g5 - f#5 - d#5 - f#5 - - - b4 . . .',
];
const B1_B = [
  'c6 - - - b5 - a5 - . . e5 . . . . .',
  'd6 - - - b5 - f#5 - . . d5 . . . . .',
  'e6 - - - d6 - c6 - . . g5 . . . c6 .',
  'd6 - - - - - . . f#5 . a5 . d6 . e6 .',
  'c6 - - - b5 - a5 - . . e5 . a5 . c6 .',
  'd6 - - - b5 - f#5 - . . a5 . b5 . d6 .',
  'e6 - - - g6 - - - e6 - d6 - c6 - b5 -',
  'a5 - - - - - - - . . . . . . . .',
];
const B1_C = [
  'g5 . g5 . e6 - . d6 - . c6 . b5 . c6 .',
  'd6 - - . a5 . d6 . f#6 - . e6 - . d6 .',
  'd6 - - . b5 . . . f#5 . a5 . b5 - . .',
  'g5 - - - - - . . e5 . f#5 . g5 . b5 .',
  'g5 . g5 . e6 - . d6 - . c6 . b5 . c6 .',
  'd6 - - . a5 . d6 . f#6 - . g6 - . a6 .',
  'a6 - - . f#6 . e6 . f#6 - . e6 - . b5 .',
  'd#6 - - - - - . . f#6 - - - . . . .',
];
const BATTLE = {
  bpm: 140, key: 0, swing: 0, fadeIn: 0.35, pump: 0.45,
  inst: { bass: 'grit', comp: 'stab', pad: 'pad', lead: 'square', arp: 'chip', gtr: 'heavy' },
  voice: { shift: 1.06 },
  mix: { bass: 0.7, comp: 0.12, pad: 0.06, lead: 0.18, arp: 0.06, gtr: 0.3, vox: 0.55 },
  mini: { s: '....X.......X.xx', o: '..............x.' },
  intro: ['in'],
  loop: ['A', 'B', 'C', 'A2', 'C2', 'brk'],
  sections: {
    in: {
      bars: 4, chords: ['Em7', 'D', 'Cmaj7', 'B7'], sweep: [350, 16000], pad: true,
      drums: { k: 'X.......X.......', h: 'x.x.x.x.x.x.x.x.' },
      fill: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX' },
      bass: '0 - - - - - - - 0 - - - - - - -',
      comp: 'x-.x-.x-.x-.x-..',
      lead: [B1_A[0], B1_A[1], B1_A[2], '. . . . . . . . . . . . . . . .'], leadVel: 0.7,
      gtr: ['m.......m.......', 'm...m...m...m...', 'm.m.m.m.m.m.m.m.', 'P-------P-------'],
    },
    A: {
      bars: 8, crash: true, chords: ['Em7', 'D', 'Cmaj7', 'Bm7', 'Em7', 'D', 'Cmaj7', 'B7'],
      drums: { k: 'X.....x.X.x...x.', s: '....X..-....X.-.', h: 'x-x-x-x-x-x-x-x-' },
      fill: FILL_FUNK,
      bass: '0 - . 0 12 . 0 . 0 - . 0 12 . 7 12',
      comp: '..x-..x-..x-..x-',
      gtr: 'm.mm..m.m.mm..m.',
      vox: B1_A, voxOct: -1,
    },
    B: {
      bars: 8, pad: true, chords: ['Am7', 'Bm7', 'Cmaj7', 'D', 'Am7', 'Bm7', 'Cmaj7', 'D'], drop: [7, 8],
      drums: { k: 'X..x....X..x....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.', o: '..............x.' },
      fill: FILL_SN,
      bass: '0 . 0 . 12 . 0 . 0 . 0 . 12 . 7 .',
      comp: 'x---....x---....',
      gtr: 'P-----..P-----..',
      lead: B1_B,
    },
    C: {
      bars: 8, crash: true, pad: true, chords: ['C', 'D', 'Bm7', 'Em7', 'C', 'D', 'B7sus4', 'B7'],
      drums: FOUR,
      fill: FILL_TOM,
      bass: '0 . 12 0 . 0 12 . 0 . 12 0 . 7 12 .',
      comp: 'x-.x-.x.x-.x-.x.',
      gtr: 'P-.P-.P-P-.P-.P-',
      vox: B1_C, voxOct: -1,
    },
    brk: {
      bars: 4, chords: ['Em7', 'Em7', 'Cmaj7', 'B7'], sweep: [700, 16000], pad: true, arp: true,
      drums: { k: 'X.......X.......' },
      fill: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX', h: 'x.x.x.x.x.x.x.x.' },
      bass: '0 - - - . . . . 0 - - - . . 12 .',
      gtr: ['P---------------', '................', 'P---------------', 'm.m.m.m.mmmmmmmm'],
      vox: [
        'b4 - - - - - - - - - - - g4 - a4 -',
        'b4 - - - - - - - . . . . . . . .',
        'c5 - - - - - - - b4 - - - g4 - - -',
        'a4 - - - - - - - f#4 - - - d#4 - - -',
      ],
    },
  },
};
// post-chorus: the hook on synth over chugs; final chorus: vocals doubled by the synth an octave up
BATTLE.sections.A2 = { ...BATTLE.sections.A, vox: null, lead: B1_A, arp: true, gtr: 'm.m.m.m.m.m.m.m.', drums: { ...BATTLE.sections.A.drums, o: '..............x.' } };
BATTLE.sections.C2 = { ...BATTLE.sections.C, lead: B1_C, leadVel: 0.5, arp: true };

// BATTLE_B — G minor, 136 bpm: funk-rock — slap-bass verse, punk two-beat chorus, synth post-hook
const BB_V = [
  'g4 . g4 bb4 . g4 . f4 g4 - . . d4 . f4 .',
  'g4 - . . bb4 . c5 . d5 - . c5 - . bb4 .',
  'g4 - . . g4 . bb4 . d5 - . . bb4 . g4 .',
  'a4 - - . f4 . a4 . c5 - - - . . . .',
  'g4 . g4 bb4 . g4 . f4 g4 - . . d4 . f4 .',
  'g4 - . . bb4 . d5 . f5 - . d5 - . c5 .',
  'eb5 - . . c5 . bb4 . g4 - . . bb4 . c5 .',
  'd5 - - - c5 - - - a4 - - - f#4 - - -',
];
const BB_P = [
  'bb4 - - - c5 - - - d5 - - - eb5 - d5 -',
  'c5 - - - - - . . a4 . c5 . f5 - - .',
  'd5 - - - bb4 - - - g4 - - - bb4 - d5 -',
  'g5 - - - - - - - f#5 - - - . . . .',
];
const BB_C = [
  'd5 - . d5 - . f5 - d5 - . bb4 - . c5 .',
  'c5 - - . a4 - . f4 - - - . . . c5 .',
  'd5 - . d5 - . g5 - f5 - . d5 - . bb4 .',
  'bb4 - - - - - . . g4 . bb4 . eb5 - d5 -',
  'd5 - . d5 - . f5 - d5 - . bb4 - . c5 .',
  'c5 - - . a4 - . c5 - - . f5 - - . .',
  'eb5 - - . d5 - . c5 - - . bb4 - . g4 .',
  'a4 - - - - - - - . . . . f#4 - a4 -',
];
const BB_POST = [
  'g5 . bb5 . d6 . bb5 . f6 - . d6 - . bb5 .',
  'g5 - . bb5 - . eb6 . d6 - - - bb5 . g5 .',
  'f5 . bb5 . d6 . f6 . g6 - . f6 - . d6 .',
  'c6 - - - a5 - - - f5 - - - . . . .',
  'g5 . bb5 . d6 . bb5 . f6 - . d6 - . bb5 .',
  'g5 - . bb5 - . eb6 . d6 - - - bb5 . g5 .',
  'f5 . bb5 . d6 . f6 . g6 - . f6 - . d6 .',
  'c6 - - - a5 - c6 - eb6 - - - d6 - - -',
];
const SLAP_V = '0 . 12! . . 0 . 12! 0 . 0 . 12! . 7 .';
const BATTLE_B = {
  bpm: 136, key: 0, swing: 0.03, fadeIn: 0.35, pump: 0.35,
  inst: { bass: 'slap', comp: 'stab', pad: 'pad', lead: 'square', arp: 'chip', gtr: 'crunch' },
  voice: { shift: 1.1 },
  mix: { bass: 0.5, comp: 0.12, pad: 0.07, lead: 0.18, arp: 0.06, gtr: 0.32, vox: 0.55 },
  mini: { s: '....X.......X..x', o: '..............x.' },
  intro: ['in'],
  loop: ['V', 'P', 'Ch', 'Post', 'V2', 'P', 'Ch2', 'brk'],
  sections: {
    in: {
      bars: 4, chords: ['Gm7', 'Gm7', 'Ebmaj7', 'D7'],
      drums: { h: 'x-x-x-x-x-x-x-x-', k: ['................', 'X..x....X.x.....', 'X..x....X.x.....', 'X..x....X.x.....'] },
      fill: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX' },
      bass: SLAP_V,
      gtr: ['................', '................', 'P---------------', 'P-------P-------'],
    },
    V: {
      bars: 8, crash: true, chords: ['Gm7', 'Gm7', 'Ebmaj7', 'F', 'Gm7', 'Gm7', 'Cm7', 'D7'],
      drums: { k: 'X..x....X.x..x..', s: '....X..-.-..X..-', h: 'x-x-x-x-x-x-x-x-' },
      fill: FILL_FUNK,
      bass: SLAP_V,
      gtr: 'P-..........m.m.',
      vox: BB_V,
    },
    P: {
      bars: 4, pad: true, chords: ['Ebmaj7', 'F', 'Gm7', 'D7sus4 D7'], drop: [3, 12],
      drums: { k: 'X.......X.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
      fill: FILL_SN,
      bass: '0 - . 0 . . 7 . 0 - . 0 . . 12! .',
      gtr: 'P-------P-------',
      vox: BB_P,
    },
    Ch: {
      bars: 8, crash: true, pad: true, chords: ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Cm7', 'D7'],
      drums: { k: 'X...X...X...X...', s: '..X...X...X...X.', h: '..x...x...x...x.', o: 'x...x...x...x...' },
      fill: FILL_TOM,
      bass: '0 . 0 . 12! . 0 . 0 . 0 . 12! . 7 .',
      gtr: 'P-P-P-P-P-P-P-P-',
      vox: BB_C,
    },
    Post: {
      bars: 8, chords: ['Gm7', 'Ebmaj7', 'Bb', 'F', 'Gm7', 'Ebmaj7', 'Bb', 'F'],
      drums: { k: 'X.....x.X.x...x.', s: '....X.......X...', h: 'x-x-x-x-x-x-x-x-', o: '..............x.' },
      fill: FILL_FUNK,
      bass: SLAP_V,
      comp: '..x...x...x...x.',
      gtr: 'm.mm.mm.m.mm.mm.',
      lead: BB_POST,
    },
    brk: {
      bars: 4, chords: ['Gm7', 'Gm7', 'Ebmaj7', 'D7'], pad: true, arp: true,
      drums: { k: 'X.......X.......', c: '....X.......X...' },
      fill: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX', h: 'x.x.x.x.x.x.x.x.' },
      bass: '0 - - - . . . . 0 . 12! . 0 . . .',
      vox: [
        'g4 - - - - - - - bb4 - - - - - - -',
        'd5 - - - - - - - c5 - - - bb4 - - -',
        'g4 - - - - - - - bb4 - - - - - - -',
        'a4 - - - - - - - f#4 - - - - - - -',
      ],
    },
  },
};
BATTLE_B.sections.V2 = { ...BATTLE_B.sections.V, comp: '..x...x...x...x.', gtr: 'P-..m.m.....m.m.' };
BATTLE_B.sections.Ch2 = { ...BATTLE_B.sections.Ch, lead: BB_C, leadOct: 1, leadVel: 0.45, arp: true };

// BATTLE_C — D major (mixolydian), 166 bpm: fast pop-punk — palm-muted verse, open chorus, synth solo, half-time bridge
const BC_V = [
  'f#4 . f#4 . a4 . f#4 . e4 . d4 . e4 - f#4 -',
  'g4 - - . e4 . g4 . c5 - - . b4 - g4 -',
  'd5 - . d5 - . b4 . g4 - . a4 - . b4 .',
  'a4 - - - - - . . . . d4 . e4 . f#4 .',
  'f#4 . f#4 . a4 . d5 . c#5 . a4 . f#4 - e4 -',
  'e4 - - . g4 . c5 . e5 - - . d5 - c5 -',
  'b4 - . g4 - . d5 - . b4 - . g4 . a4 .',
  'a4 - - - - - - - c#5 - - - e5 - - -',
];
const BC_C = [
  'b4 - . d5 - . g5 - - - f#5 - e5 - d5 -',
  'e5 - - - c#5 - - - a4 - - - . . a4 .',
  'c#5 - . e5 - . a5 - - - f#5 - e5 - c#5 -',
  'd5 - - - - - . . b4 . c#5 . d5 . f#5 .',
  'g5 - . f#5 - . e5 - - - d5 - e5 - d5 -',
  'c#5 - - - e5 - - - a5 - - - g5 - f#5 -',
  'f#5 - - - - - - - e5 - - - d5 - - -',
  'd5 - - - - - - - . . . . . . . .',
];
const BC_SOLO = [
  'd6 a5 f#5 a5 d6 a5 f#5 a5 e6 - d6 - a5 - f#5 -',
  'e6 c6 g5 c6 e6 c6 g5 c6 g6 - e6 - c6 - g5 -',
  'd6 b5 g5 b5 d6 b5 g5 b5 g6 - f#6 - d6 - b5 -',
  'a5 - - - f#5 - - - d5 - - - . . . .',
  'd6 a5 f#5 a5 d6 a5 f#5 a5 e6 - d6 - a5 - f#5 -',
  'e6 c6 g5 c6 e6 c6 g5 c6 g6 - e6 - c6 - g5 -',
  'b5 - d6 - g6 - d6 - b5 - g5 - b5 - d6 -',
  'c#6 - - - e6 - - - a6 - - - - - - -',
];
const BC_BR = [
  'g4 - - - - - - - b4 - - - - - - -',
  'a4 - - - - - - - c#5 - - - - - - -',
  'b4 - - - - - - - d5 - - - - - - -',
  'c#5 - - - - - - - e5 - - - - - - -',
  'e5 - - - d5 - - - b4 - - - g4 - - -',
  'f#4 - - - a4 - - - c#5 - - - e5 - - -',
  'd5 - - - - - - - g5 - - - - - - -',
  'e5 - - - - - - - - - - - . . . .',
];
const EIGHTHS = '0 . 0 . 0 . 0 . 0 . 0 . 0 . 0 .';
const BATTLE_C = {
  bpm: 166, key: 0, swing: 0, fadeIn: 0.3, pump: 0.3,
  inst: { bass: 'pick', comp: 'stab', pad: 'pad', lead: 'saw', arp: 'chip', gtr: 'heavy' },
  voice: { shift: 1.04 },
  mix: { bass: 0.5, comp: 0.1, pad: 0.07, lead: 0.17, arp: 0.05, gtr: 0.32, vox: 0.55 },
  mini: { s: '....X.......X.XX' },
  intro: ['in'],
  loop: ['V', 'Ch', 'Solo', 'V2', 'Ch2', 'Br'],
  sections: {
    in: {
      bars: 4, chords: ['D', 'C', 'G', 'A'],
      drums: { k: 'X.......X.......', cr: ['X...............', 'X...............', 'X...............', '................'] },
      fill: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX', cr: '' },
      bass: '0 - - - - - - - - - - - - - - -',
      gtr: 'P---------------',
    },
    V: {
      bars: 8, crash: true, chords: ['D', 'C', 'G', 'D', 'D', 'C', 'G', 'A'],
      drums: { k: 'X.....X.X.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
      fill: FILL_SN,
      bass: EIGHTHS,
      gtr: 'm.m.m.m.m.m.m.m.',
      vox: BC_V,
    },
    Ch: {
      bars: 8, crash: true, pad: true, chords: ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'], drop: [7, 4],
      drums: { k: 'X...X...X...X...', s: '....X.......X...', c: '....X.......X...', o: 'x.x.x.x.x.x.x.x.' },
      fill: FILL_TOM,
      bass: '0 . 0 . 0 . 0 . 0 . 0 . 7 . 12 .',
      gtr: 'P-P-P-P-P-P-P-P-',
      vox: BC_C,
    },
    Solo: {
      bars: 8, crash: true, arp: true, chords: ['D', 'C', 'G', 'D', 'D', 'C', 'G', 'A'],
      drums: { k: 'X...X...X...X...', s: '..X...X...X...X.', h: 'x.x.x.x.x.x.x.x.' },
      fill: FILL_SN,
      bass: EIGHTHS,
      gtr: 'P---P---P---P---',
      lead: BC_SOLO,
    },
    Br: {
      bars: 8, pad: true, arp: true, arpRate: 2, chords: ['Em', 'F#m', 'G', 'A', 'Em', 'F#m', 'G', 'A'],
      drums: { k: 'X.......X.......', s: '........X.......', h: 'x.x.x.x.x.x.x.x.' },
      fill: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX', h: '' },
      bass: '0 - - - - - - - 0 - - - - - - -',
      gtr: 'P---------------',
      vox: BC_BR,
    },
  },
};
BATTLE_C.sections.V2 = { ...BATTLE_C.sections.V, gtr: 'P-..m.m.P-..m.m.', comp: '..x...x...x...x.' };
BATTLE_C.sections.Ch2 = { ...BATTLE_C.sections.Ch, lead: BC_C, leadOct: 1, leadVel: 0.45, arp: true };

// TITLE — D major, 120 bpm: anthemic theme, sung first time, then synth + vocal together
const TITLE_A = [
  'a5 - - - f#5 - a5 - d6 - - - c#6 - d6 -',
  'e6 - - - - - c#6 - a5 - - - . . . .',
  'b5 - - - d6 - - - f#6 - - - e6 - d6 -',
  'd6 - - - b5 - - - - - . . g5 - a5 -',
  'a5 - - - f#5 - a5 - d6 - - - e6 - f#6 -',
  'g6 - - - f#6 - e6 - d6 - - - b5 - - -',
  'e6 - - - d6 - - - b5 - - - g5 - b5 -',
  'a5 - - - - - - - - - - - . . . .',
];
const TITLE = {
  bpm: 120, key: 0, swing: 0, fadeIn: 1.0, pump: 0.3,
  inst: { bass: 'pick', comp: 'stab', pad: 'pad', lead: 'saw', arp: 'bell', gtr: 'crunch' },
  voice: { shift: 1.08 },
  mix: { lead: 0.2, arp: 0.09, comp: 0.13, pad: 0.1, bass: 0.45, gtr: 0.3, vox: 0.55 },
  mini: { s: '....X.......X.xx' },
  intro: ['in'],
  loop: ['A', 'B', 'A2', 'brk'],
  sections: {
    in: {
      bars: 4, chords: ['D', 'Bm7', 'Gmaj7', 'Asus4 A'], sweep: [500, 16000], pad: true, arp: true,
      drums: {}, fill: { s: 'x.x.x.x.xxxxXXXX', k: 'X...X...X...X...' },
      bass: '0 - - - - - - - - - - - - - - -',
      gtr: ['................', '................', '................', 'P-------P-------'],
    },
    A: {
      bars: 8, crash: true, pad: true, chords: ['D', 'A/C#', 'Bm7', 'G', 'D/F#', 'G', 'Em7', 'A'],
      drums: { k: 'X.......X.x.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
      fill: FILL_TOM,
      bass: '0 . 0 . 0 . 0 . 0 . 0 . 12 . 0 .',
      comp: 'x..x..x...x..x..',
      gtr: 'P-..m.m.m.m.m.m.',
      vox: TITLE_A, voxOct: -1,
    },
    B: {
      bars: 8, pad: true, arp: true, chords: ['Gmaj7', 'A', 'F#m7', 'Bm7', 'Gmaj7', 'A', 'Bm7 A/C#', 'D'],
      drums: { k: 'X...X...X...X...', c: '....X.......X...', h: 'x-.-x-.-x-.-x-.-', o: '..x...x...x...x.' },
      fill: FILL_SN,
      bass: '0 . 12 . 0 . 12 . 0 . 12 . 0 . 12 .',
      gtr: 'P-------P-------',
      lead: [
        'b5 . b5 . a5 . b5 - - - d6 . . . b5 .',
        'c#6 - - - a5 - - - e5 - - - . . . .',
        'a5 . a5 . f#5 . a5 - - - c#6 . . . a5 .',
        'b5 - - - f#5 - - - d5 - - - . . . .',
        'b5 . b5 . a5 . b5 - - - d6 . . . e6 .',
        'f#6 - - - e6 - - - c#6 - - - a5 - - -',
        'd6 - - - f#6 - - - e6 - - - c#6 - - -',
        'd6 - - - - - - - . . . . . . . .',
      ],
    },
    brk: {
      bars: 4, chords: ['D', 'Bm7', 'Gmaj7', 'A'], sweep: [900, 16000], pad: true, arp: true,
      drums: { k: 'X.......X.......' }, fill: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX' },
      bass: '0 - - - - - - - 0 - - - - - - -',
      gtr: ['P---------------', '................', 'P---------------', 'm.m.m.m.mmmmmmmm'],
    },
  },
};
TITLE.sections.A2 = {
  ...TITLE.sections.A, lead: TITLE_A, leadVel: 0.45, arp: true, gtr: 'P-.P-.P-P-.P-.P-',
  drums: { ...TITLE.sections.A.drums, o: '..............x.' },
};

// PLAZA — F major, 100 bpm swung: city-pop / lo-fi funk — FM e-piano, slap bass, clean guitar chops
const PLAZA = {
  bpm: 100, key: 0, swing: 0.16, fadeIn: 1.2, arpPat: 'updown',
  inst: { bass: 'slap', comp: 'ep', pad: 'soft', lead: 'soft', arp: 'bell', gtr: 'clean' },
  mix: { k: 0.75, s: 0.32, r: 0.3, h: 0.11, o: 0.08, sh: 0.1, bass: 0.48, comp: 0.17, pad: 0.05, lead: 0.18, arp: 0.05, gtr: 0.3 },
  mini: { r: '....x.......x.xx' },
  intro: ['in'],
  loop: ['A', 'B', 'A2', 'C'],
  sections: {
    in: { bars: 2, chords: ['Fmaj7', 'C7sus4'], comp: 'x-------------..', drums: { sh: '.-.-.-.-.-.-.-.-' } },
    A: {
      bars: 8, chords: ['Fmaj7', 'Em7 A7', 'Dm9', 'Cm7 F7', 'Bbmaj7', 'Am7', 'Gm7', 'C7sus4'],
      drums: { k: 'X......x..X.....', r: '....x.......x...', h: 'x.-.x.-.x.-.x.-.', sh: '.-.-.-.-.-.-.-.-' },
      fill: { r: '....x.......x.xx', o: '..............x.' },
      bass: '0 - - . . 0 . 7 0 - - . . 12! . 7',
      comp: 'x-----x---x---x-',
      gtr: '..c..c....c..c..',
      lead: [
        '. . a5 - c6 - e6 - - - - - d6 - c6 -',
        'd6 - - - b5 - . . c#6 - - - e6 - . .',
        'f6 - - - e6 - - - - - - - . . . .',
        '. . eb6 - d6 - c6 - . . a5 - c6 - eb6 -',
        'd6 - - - - - c6 - a5 - - - f5 - - -',
        '. . e5 - g5 - c6 - - - - - b5 - a5 -',
        'bb5 - - - a5 - - - g5 - - - f5 - - -',
        'g5 - - - - - - - . . . . . . . .',
      ],
    },
    B: {
      bars: 8, chords: ['Bbmaj7', 'C9', 'Am7', 'Dm9', 'Gm7', 'Am7', 'Bbmaj7', 'C7sus4'],
      drums: { k: 'X......x..X..x..', s: '....x.......x...', r: '....x.......x...', h: 'x.-.x.-.x.-.x.-.', o: '..............x.', sh: '.-.-.-.-.-.-.-.-' },
      fill: { r: '....x.......x.xx', s: '....x.......x.x-' },
      bass: '0 - - . . 0 . 7 0 - - . . 12! . 7',
      comp: 'x-----x---x---x-',
      gtr: '..c..c.c..c..c.c',
      lead: [
        'f6 - - - d6 - . . a5 . c6 - - - d6 -',
        'e6 - - - - - d6 - - - c6 - bb5 - g5 -',
        'a5 - - - - - - - . . e5 . g5 . a5 .',
        'c6 - - - a5 - . . e6 - - - d6 - . .',
        'd6 - - - bb5 - - - f6 - - - d6 - - -',
        'c6 - - - - - - - e6 - - - g6 - - -',
        'f6 - - - - - d6 - - - c6 - - - a5 -',
        'g5 - - - - - - - - - - - . . . .',
      ],
    },
    C: {
      bars: 4, chords: ['Bbmaj7', 'Am7', 'Gm7', 'C7sus4'], pad: true,
      drums: { h: 'x.-.x.-.x.-.x.-.', r: '....x.......x...' },
      bass: '0 - - - - - - . . . . . 7 - . .',
      comp: 'x-------x-------',
      gtr: 'C-------C-------',
    },
  },
};
PLAZA.sections.A2 = { ...PLAZA.sections.A, lead: null, arp: true, arpRate: 2, gtr: '..c..c.c..c..c.c' };

// LOBBY — A major, 126 bpm: short, bouncy four-on-the-floor with chiptune arp / lead and crunchy guitars
const LOBBY = {
  bpm: 126, key: 0, swing: 0, fadeIn: 0.6, pump: 0.4,
  inst: { bass: 'pick', comp: 'stab', pad: 'pad', lead: 'chip', arp: 'chip', gtr: 'crunch' },
  mix: { lead: 0.19, arp: 0.07, comp: 0.13, bass: 0.45, gtr: 0.28 },
  intro: [],
  loop: ['A', 'B', 'C'],
  sections: {
    A: {
      bars: 8, crash: true, arp: true, chords: ['Dmaj7', 'E', 'C#m7', 'F#m7', 'Bm7', 'C#m7', 'Dmaj7', 'E'],
      drums: FOUR,
      fill: FILL_SN,
      bass: '0 . 12 . 0 . 12 . 0 . 12 . 0 12 0 12',
      comp: '..x...x...x...x.',
      gtr: 'm.m.m.m.m.m.m.m.',
    },
    C: {
      bars: 4, chords: ['Bm7', 'C#m7', 'Dmaj7', 'E'], pad: true, arp: true,
      drums: { k: 'X.......X.......', c: '....X.......X...' },
      fill: FILL_SN,
      bass: '0 - - - - - - - 0 - - - - - - -',
      gtr: 'P---------------',
    },
  },
};
LOBBY.sections.B = {
  ...LOBBY.sections.A, arp: false, fill: FILL_TOM, gtr: 'P-.P-.P-P-.P-.P-',
  lead: [
    'f#5 . a5 . c#6 . a5 . e6 - . c#6 - . a5 .',
    'e6 - - . b5 - . . g#5 . b5 . e6 . f#6 .',
    'e6 - - . c#6 - . . g#5 . b5 . c#6 . e6 .',
    'f#6 - - - - - . . e6 - c#6 - a5 - . .',
    'd6 . f#6 . d6 . b5 . a5 - . b5 - . d6 .',
    'e6 - - . c#6 - . . b5 . c#6 . e6 . g#6 .',
    'a6 - - . f#6 - . . e6 . c#6 . e6 . f#6 .',
    'e6 - - - - - - - . . b5 . c#6 . d6 .',
  ],
};

// RESULTS_WIN — C major, 128 bpm: brass + guitar fanfare intro, then a happy bouncing loop
const RESULTS_WIN = {
  bpm: 128, key: 0, swing: 0, fadeIn: 0.05, pump: 0.25,
  inst: { bass: 'pick', comp: 'stab', pad: 'pad', lead: 'square', arp: 'bell', gtr: 'crunch' },
  mix: { lead: 0.2, comp: 0.14, bass: 0.42, arp: 0.08, cr: 0.3, gtr: 0.28 },
  intro: ['fan'],
  loop: ['A', 'B'],
  sections: {
    fan: {
      bars: 4, chords: ['C', 'F G', 'C', 'C'], leadInst: 'brass', compInst: 'brass',
      drums: {
        k: ['X.....X.X.......', 'X.......X.......', 'X...............', '................'],
        s: ['................', 'x.x.x.x.xxxxXXXX', '................', '................'],
        cr: ['X...............', '................', 'X...............', '................'],
        t: ['................', '................', '................', '........X.x.X.xX'],
      },
      bass: ['0 - - . 0 - - . 0 - - - - - - -', '0 - - - - - - - 0 - - - - - - -', '0 - - - - - - - - - - - - - - -', '. . . . . . . . . . . . . . . .'],
      comp: ['x-.x-.x---------', 'x-------x-------', 'x---------------', '................'],
      gtr: ['P-.P-.P---------', 'P-------P-------', 'P---------------', '................'],
      lead: ['g4 . c5 . e5 . g5 - - - e5 . g5 - - -', 'a5 - - - - - . . b5 - - - - - . .', 'c6 - - - - - - - - - - - - - - -', '. . . . . . . . . . . . . . . .'],
    },
    A: {
      bars: 8, crash: true, leadOct: -1, chords: ['C', 'Am7', 'Dm7', 'G', 'Em7', 'A7', 'Dm7 G7', 'C'],
      drums: { k: 'X.....x.X.....x.', s: '....X.......X...', c: '....X.......X...', h: 'x.x.x.x.x.x.x.x.', o: '..............x.' },
      fill: FILL_FUNK,
      bass: '0 . . 12 . . 0 . 7 . . 12 . . 7 .',
      comp: '..x...x...x...x.',
      gtr: '..c...c...c...c.',
      lead: [
        'c6 . e6 . g6 - e6 . c6 . d6 . e6 - . .',
        'c6 - . a5 - . e5 . g5 . a5 . c6 - . .',
        'd6 . f6 . a6 - f6 . d6 . e6 . f6 - . .',
        'g6 - - - d6 - - - b5 - - - . . . .',
        'e6 . g6 . b6 - g6 . e6 . d6 . e6 - . .',
        'c#6 - . e6 - . g6 . a6 - - - g6 - . .',
        'f6 - - - a6 - - - g6 - - - f6 - - -',
        'e6 - - - - - - - c6 . . . . . . .',
      ],
    },
  },
};
RESULTS_WIN.sections.B = { ...RESULTS_WIN.sections.A, crash: false, leadInst: 'bell', leadOct: 0, arp: true, arpRate: 2, fill: FILL_TOM, gtr: null };

// RESULTS_LOSE — C major / A minor, 104 bpm swung: bittersweet "royal road" changes, music-box lead
const LOSE_LEAD = [
  'a5 - - - g5 - - - e5 - - - c5 - - -',
  'd5 - - - - - . . g5 . a5 . b5 . d6 .',
  'e6 - - - d6 - - - b5 - - - g5 - - -',
  'a5 - - - - - - - . . . . e5 . g5 .',
  'f5 - . a5 - . c6 - d6 - - - c6 - a5 -',
  'g5 - - - - - . . b5 - - - g5 - e5 -',
  'a5 - - - c6 - - - e6 - - - - - d6 -',
  'd6 - - - - - - - b5 - - - . . . .',
];
const RESULTS_LOSE = {
  bpm: 104, key: 0, swing: 0.12, fadeIn: 0.3, arpPat: 'updown',
  inst: { bass: 'funk', comp: 'ep', pad: 'soft', lead: 'bell', arp: 'bell', gtr: 'clean' },
  mix: { k: 0.65, r: 0.3, h: 0.09, bass: 0.5, comp: 0.15, lead: 0.22, arp: 0.06, pad: 0.05, gtr: 0.24 },
  intro: [],
  loop: ['A', 'B'],
  sections: {
    A: {
      bars: 8, chords: ['Fmaj7', 'G', 'Em7', 'Am7', 'Dm7', 'Em7', 'Fmaj7', 'G7'],
      drums: { k: 'X.....x.X.......', r: '....x.......x...', h: 'x.-.x.-.x.-.x.-.' },
      fill: { r: '....x.......x.xx', k: 'X.....x.X.x.....' },
      bass: '0 . . 7 0 . . . 0 . . 7 12 . 7 .',
      comp: '..x-..x-..x-..x-',
      lead: LOSE_LEAD,
    },
  },
};
RESULTS_LOSE.sections.B = { ...RESULTS_LOSE.sections.A, leadInst: 'soft', leadOct: -1, arp: true, arpRate: 2, pad: true, gtr: 'C-------C-------' };

// SHOP — G major, 118 bpm: lounge bossa-funk — rim clave, shaker, e-piano pads, clean guitar, vibraphone
const SHOP_A = [
  '. . b5 - d6 - f#6 - - - - - e6 - d6 -',
  'b5 - - - - - - - . . . . a5 . b5 .',
  'c6 - - - e6 - - - g6 - - - e6 - c6 -',
  'f#6 - - - - - e6 - d6 - - - c6 - - -',
  'd6 - - - - - b5 - a5 - - - f#5 - - -',
  'g#5 - - - b5 - - - d6 - - - e6 - - -',
  'c6 - - - - - - - b5 - - - a5 - - -',
  'g5 - - - - - - - f#5 - - - - - - -',
];
const SHOP_B = [
  'e5 - - - g5 - - - b5 - - - - - - -',
  'eb5 - - - g5 - - - a5 - - - - - - -',
  'd5 - - - f#5 - - - a5 - - - b5 - - -',
  'g#5 - - - - - - - b5 - d6 - - - . .',
  'c6 - - - - - b5 - a5 - - - e5 - - -',
  'e5 - - - f#5 - - - a5 - - - c6 - - -',
  'b5 - - - - - - - - - - - a5 - - -',
  'b5 - - - - - - - . . . . . . . .',
];
const BOSSA = { k: 'X.....x.X.....x.', r: '...x..x....x..x.', sh: '-x-x-x-x-x-x-x-x' };
const SHOP = {
  bpm: 118, key: 0, swing: 0.1, fadeIn: 1.2, arpPat: 'updown',
  inst: { bass: 'funk', comp: 'ep', pad: 'soft', lead: 'bell', arp: 'bell', gtr: 'clean' },
  mix: { k: 0.55, r: 0.32, sh: 0.12, h: 0.07, bass: 0.5, comp: 0.13, pad: 0.05, lead: 0.22, gtr: 0.3, arp: 0.05 },
  intro: ['in'],
  loop: ['A', 'B', 'A2', 'B2'],
  sections: {
    in: { bars: 2, chords: ['Gmaj7', 'D7sus4 D7'], comp: 'x---------------', gtr: 'c..c..c...c..c..', drums: { sh: BOSSA.sh } },
    A: {
      bars: 8, chords: ['Gmaj7', 'Gmaj7', 'Am7', 'D7', 'Bm7', 'E7', 'Am7', 'D7sus4 D7'],
      drums: BOSSA, fill: { r: '...x..x...x.x.xx' },
      bass: '0 - - - - - 7 - 0 - - - - - 7 -',
      comp: 'x-------x-------',
      gtr: 'c..c..c...c..c..',
      lead: SHOP_A,
    },
    B: {
      bars: 8, chords: ['Cmaj7', 'Cm6', 'Bm7', 'E7', 'Am7', 'D9', 'Gmaj7', 'Gmaj7'],
      drums: { ...BOSSA, h: '..x...x...x...x.' }, fill: { r: '...x..x...x.x.xx' },
      bass: '0 - - - - - 7 - 0 - - - - - 7 -',
      comp: 'x-------x-------',
      gtr: 'c..c..c...c..c..',
      lead: SHOP_B,
    },
  },
};
SHOP.sections.A2 = { ...SHOP.sections.A, lead: null, arp: true, arpRate: 2, gtr: 'C-------C-------' };
SHOP.sections.B2 = { ...SHOP.sections.B, leadInst: 'soft' };

// NEWS — Bb major, 124 bpm: brass + sung jingle, then a light bed to talk over
const NEWS = {
  bpm: 124, key: 0, swing: 0, fadeIn: 0.05, pump: 0.2, arpPat: 'updown',
  inst: { bass: 'pick', comp: 'brass', pad: 'soft', lead: 'brass', arp: 'bell', gtr: 'crunch' },
  voice: { shift: 1.12 },
  mix: { comp: 0.16, lead: 0.2, vox: 0.6, arp: 0.06, pad: 0.08, bass: 0.4, gtr: 0.25 },
  intro: ['jingle'],
  loop: ['bed'],
  sections: {
    jingle: {
      bars: 4, chords: ['Bb', 'Eb F', 'Gm7 C9', 'Bb'],
      drums: {
        k: ['X.....X.X.......', 'X.......X.......', 'X.......X.......', 'X...............'],
        s: ['................', '....X.......X...', 'x.x.x.x.xxxxXXXX', '................'],
        cr: ['X...............', '................', '................', 'X...............'],
      },
      bass: ['0 . 0 . 0 - . 0 - - - . . . . .', '0 - - - - - - - 0 - - - - - - -', '0 - - - - - - - 0 - - - - - - -', '0 - - - - - - - - - - - . . . .'],
      comp: ['x.x.x-.x---.....', 'x-------x-------', 'x-------x-------', 'x-----------....'],
      lead: ['f5 . f5 . bb5 - . d6 - - - . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 'bb5 . d6 . f6 - - - - - - - - - . .'],
      vox: ['. . . . . . . . . . . . . . . .', 'g4 - . f4 - . eb4 . f4 - - . c5 - - .', 'd5 - . c5 - . bb4 . c5 - - - e5 - - -', '. . . . . . . . . . . . . . . .'],
      gtr: ['................', '................', '................', 'P-----------....'],
    },
    bed: {
      bars: 8, level: 0.55, pad: true, arp: true, arpRate: 2, compInst: 'ep',
      chords: ['Bbmaj7', 'Gm7', 'Ebmaj7', 'F7sus4', 'Bbmaj7', 'Gm7', 'Cm7', 'F7sus4'],
      drums: { k: 'X.......X.......', h: '..x...x...x...x.', sh: '.-.-.-.-.-.-.-.-' },
      bass: '0 - - - - - - . 0 - - - 7 - - .',
      comp: 'x-----x---x-----',
    },
  },
};

// STORY_HUB — F minor, 92 bpm swung: mysterious underground groove — sub bass, rim clicks, sparse bells
const HUB_A = [
  '. . . . c6 - - - ab5 - - - g5 - - -',
  'f5 - - - - - - - . . . . . . . .',
  '. . . . c6 - - - f5 - - - ab5 - - -',
  '. . . . . . . . . . . . . . . .',
  '. . . . db6 - - - c6 - - - f5 - - -',
  'ab5 - - - - - - - . . . . . . . .',
  '. . . . bb5 - - - db6 - - - f6 - - -',
  'f6 - - - - - - - e6 - - - - - - -',
];
const STORY_HUB = {
  bpm: 92, key: 0, swing: 0.12, fadeIn: 1.5,
  inst: { bass: 'sub', comp: 'ep', pad: 'soft', lead: 'bell', arp: 'bell', gtr: 'clean' },
  mix: { k: 0.8, r: 0.3, sh: 0.08, h: 0.08, bass: 0.65, comp: 0.12, pad: 0.07, lead: 0.2, arp: 0.05, gtr: 0.2 },
  intro: [],
  loop: ['A', 'B', 'A2', 'C'],
  sections: {
    A: {
      bars: 8, chords: ['Fm9', 'Fm9', 'Dbmaj7', 'Dbmaj7', 'Bbm9', 'Bbm9', 'Gm7b5', 'C7sus4 C7'], pad: true,
      drums: { k: 'X......x..X.....', r: '....x.......x...', sh: '..-...-...-...-.' },
      fill: { r: '....x.......x.x.', k: 'X......x..X..x..' },
      bass: '0 - - . . 0 . 12 . . 7 . 0 - . .',
      comp: 'x-----......x---',
      lead: HUB_A,
    },
    C: {
      bars: 4, chords: ['Dbmaj7', 'Bbm9', 'Gm7b5', 'C7sus4 C7'], pad: true,
      drums: { r: '....x.......x...' },
      bass: '0 - - - - - - - - - - - . . . .',
    },
  },
};
STORY_HUB.sections.B = {
  ...STORY_HUB.sections.A, lead: null, arp: true, arpRate: 4, gtr: '..c...c...c...c.',
  drums: { ...STORY_HUB.sections.A.drums, h: '..x...x...x...x.' },
};
STORY_HUB.sections.A2 = { ...STORY_HUB.sections.A, drums: { ...STORY_HUB.sections.A.drums, h: 'x.-.x.-.x.-.x.-.' } };

// STORY_LEVEL — D minor, 132 bpm: adventurous action — galloping bass + guitars, heroic saw / brass leads
const LVL_A = [
  'd5 - - . a4 . d5 . f5 - - . e5 - d5 -',
  'a5 - - - - - . . g5 . f5 . e5 . f5 .',
  'd5 - - . bb4 . d5 . f5 - - . g5 - f5 -',
  'e5 - - - - - . . c5 . d5 . e5 . g5 .',
  'a5 - - . f5 . a5 . d6 - - . c6 - a5 -',
  'f5 - - - - - . . e5 . d5 . c5 . d5 .',
  'bb5 - - . g5 . bb5 . d6 - - . c6 - bb5 -',
  'a5 - - - - - - - c#5 - - - e5 - - -',
];
const LVL_B = [
  'f5 - - - d5 - f5 - bb5 - - - a5 - f5 -',
  'g5 - - - e5 - g5 - c6 - - - bb5 - g5 -',
  'a5 - - - - - - - f5 - - - d5 - - -',
  'e5 - - - f5 - - - a5 - - - d6 - - -',
  'd6 - - - - - c6 - bb5 - - - a5 - - -',
  'g5 - - - - - a5 - bb5 - - - c6 - - -',
  'c#6 - - - - - - - e6 - - - - - - -',
  'a5 - - - - - - - - - - - . . . .',
];
const GALLOP = '0 . 0 0 0 . 0 0 0 . 0 0 0 . 0 0';
const STORY_LEVEL = {
  bpm: 132, key: 0, swing: 0, fadeIn: 0.6, pump: 0.3,
  inst: { bass: 'pick', comp: 'stab', pad: 'pad', lead: 'saw', arp: 'chip', gtr: 'heavy' },
  mix: { lead: 0.2, gtr: 0.3, bass: 0.5, comp: 0.1, pad: 0.1, arp: 0.06, t: 0.6 },
  mini: { s: '....X.......X.xx' },
  intro: ['in'],
  loop: ['A', 'B', 'A2', 'B2', 'brk'],
  sections: {
    in: {
      bars: 4, chords: ['Dm', 'Bb', 'C', 'A'], sweep: [500, 16000],
      drums: { k: 'X.......X.......', t: 'X..x..x.X..x..x.' },
      fill: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX', t: '' },
      bass: GALLOP,
      gtr: ['................', 'm.mmm.mmm.mmm.mm', 'm.mmm.mmm.mmm.mm', 'P-------P-------'],
    },
    A: {
      bars: 8, crash: true, pad: true, chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'],
      drums: { k: 'X.....x.X.x.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
      fill: FILL_TOM,
      bass: GALLOP,
      gtr: 'm.mmm.mmm.mmm.mm',
      lead: LVL_A,
    },
    B: {
      bars: 8, crash: true, pad: true, chords: ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'], leadInst: 'brass',
      drums: FOUR,
      fill: FILL_SN,
      bass: '0 . 0 . 0 . 0 . 0 . 0 . 0 . 12 .',
      comp: 'x---....x---....',
      gtr: 'P---P---P---P---',
      lead: LVL_B,
    },
    brk: {
      bars: 4, chords: ['Dm', 'Bb', 'Gm', 'A'], sweep: [800, 16000], pad: true, arp: true,
      drums: { k: 'X.......X.......', t: 'X.......X.....x.' },
      fill: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX' },
      bass: '0 - - - - - - - 0 - - - - - - -',
      gtr: ['P---------------', '................', 'P---------------', 'm.m.m.m.mmmmmmmm'],
    },
  },
};
STORY_LEVEL.sections.A2 = { ...STORY_LEVEL.sections.A, harm: true, arp: true };
STORY_LEVEL.sections.B2 = { ...STORY_LEVEL.sections.B, harm: true, arp: true };

// STORY_BOSS — C minor, 156 bpm: double-kick chugs, synth choir, brass stabs, menacing chromatic lead
const BOSS_A = [
  'c5 - - - - - - - g4 - - - ab4 - g4 -',
  'c5 - - - eb5 - - - d5 - - - db5 - - -',
  'f5 - - - - - - - ab5 - - - - - f5 -',
  'g5 - - - - - - - - - - - . . . .',
  'c6 - - - - - - - g5 - - - ab5 - g5 -',
  'eb6 - - - d6 - - - c6 - - - b5 - - -',
  'c6 - - - - - - - eb6 - - - - - - -',
  'd6 - - - - - - - b5 - - - g5 - - -',
];
const BOSS_B = [
  'eb5 - - - ab5 - - - c6 - - - - - bb5 -',
  'd6 - - - - - - - f5 - - - bb5 - - -',
  'c6 - - - - - - - g5 - - - eb6 - - -',
  'd6 - - - - - - - c6 - - - - - - -',
  'c6 - - - eb6 - - - ab6 - - - g6 - - -',
  'f6 - - - - - - - d6 - - - bb5 - - -',
  'b5 - - - d6 - - - g6 - - - f6 - - -',
  'd6 - - - - - - - - - - - . . . .',
];
const STORY_BOSS = {
  bpm: 156, key: 0, swing: 0, fadeIn: 0.4, pump: 0.25,
  inst: { bass: 'grit', comp: 'brass', pad: 'choir', lead: 'saw', arp: 'chip', gtr: 'heavy' },
  mix: { q: 0.55, k: 0.85, gtr: 0.32, bass: 0.6, comp: 0.12, pad: 0.16, lead: 0.19, arp: 0.05, rd: 0.12 },
  intro: ['in'],
  loop: ['A', 'B', 'A2', 'B2', 'brk'],
  sections: {
    in: {
      bars: 4, chords: ['Cm', 'Cm', 'Db', 'G'], sweep: [400, 16000], pad: true,
      drums: { t: ['X...............', 'X...............', 'X.......X.......', 'X.X.X.X.XXXXXXXX'] },
      bass: '0 - - - - - - - - - - - - - - -',
      gtr: ['P---------------', '................', 'P---------------', 'mmmmmmmmmmmmmmmm'],
    },
    A: {
      bars: 8, crash: true, pad: true, chords: ['Cm', 'Cm', 'Db', 'Cm', 'Cm', 'Cm', 'Ab', 'G'],
      drums: { q: 'xxx.xx.xxx.x.xx.', s: '....X.......X...', rd: 'x...x...x...x...' },
      fill: { q: 'xxxxxxxxxxxxxxxx', s: '....X.....x.XxXX' },
      bass: '0 0 0 . 0 0 . 0 0 0 . 0 . 0 0 .',
      gtr: 'mmm.mm.mmm.m.mm.',
      lead: BOSS_A,
    },
    B: {
      bars: 8, crash: true, pad: true, chords: ['Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'Bb', 'G', 'G'], leadInst: 'brass',
      drums: { k: 'X...X...X...X...', s: '....X.......X...', c: '....X.......X...', rd: 'x.x.x.x.x.x.x.x.' },
      fill: FILL_TOM,
      bass: EIGHTHS,
      comp: 'x-..x-..x-..x-..',
      gtr: 'P-P-P-P-P-P-P-P-',
      lead: BOSS_B,
    },
    brk: {
      bars: 4, chords: ['Cm', 'Db', 'Cm', 'G'], pad: true,
      drums: { k: 'X.......X.......', s: '........X.......' },
      fill: { q: 'xxxxxxxxxxxxxxxx', s: 'x.x.x.x.xxxxXXXX' },
      bass: '0 - - - - - - - - - - - - - - -',
      gtr: 'm.......m.......',
    },
  },
};
STORY_BOSS.sections.A2 = { ...STORY_BOSS.sections.A, harm: true, arp: true };
STORY_BOSS.sections.B2 = { ...STORY_BOSS.sections.B, arp: true };

// STORY_CLEAR — F major, 112 bpm: short victory jingle, then a calm, warm loop
const STORY_CLEAR = {
  bpm: 112, key: 0, swing: 0.08, fadeIn: 0.05, arpPat: 'updown',
  inst: { bass: 'funk', comp: 'ep', pad: 'soft', lead: 'bell', arp: 'bell', gtr: 'crunch' },
  mix: { comp: 0.15, lead: 0.22, bass: 0.5, pad: 0.06, arp: 0.05, gtr: 0.28, k: 0.7, r: 0.3 },
  intro: ['jingle'],
  loop: ['calm', 'calm2'],
  sections: {
    jingle: {
      bars: 2, chords: ['F', 'Bb C'], leadInst: 'brass', compInst: 'brass',
      drums: { k: ['X.......X.......', 'X.......X.......'], s: ['................', 'x.x.x.x.xxxxXXXX'], cr: ['X...............', '................'] },
      lead: ['c5 . f5 . a5 . c6 - - - a5 . c6 - - -', 'd6 - - - - - - - e6 - - - - - - -'],
      comp: ['x-..x-..x-------', 'x-------x-------'],
      bass: ['0 - - - - - - - 0 - - - - - - -', '0 - - - - - - - 0 - - - - - - -'],
      gtr: ['P-..P-..P-------', 'P-------P-------'],
    },
    calm: {
      bars: 8, crash: true, chords: ['Fmaj7', 'Am7', 'Bbmaj7', 'C7sus4', 'Fmaj7', 'Dm7', 'Gm7', 'C7sus4'],
      drums: { k: 'X.........X.....', r: '....x.......x...', sh: '.-.-.-.-.-.-.-.-' },
      fill: { r: '....x.......x.xx' },
      bass: '0 - - - - - 7 . 0 - - - - - 12 .',
      comp: 'x-----x---x-----',
      lead: [
        'a5 - - - c6 - - - e6 - - - - - - -',
        'e6 - - - - - - - c6 - - - - - - -',
        'd6 - - - - - - - a5 - - - f5 - - -',
        'g5 - - - - - - - . . . . . . . .',
        'c6 - - - a5 - - - e5 - - - f5 - - -',
        'a5 - - - - - - - f5 - - - c6 - - -',
        'bb5 - - - - - - - a5 - - - g5 - - -',
        'f5 - - - - - - - - - - - . . . .',
      ],
    },
  },
};
STORY_CLEAR.sections.calm2 = { ...STORY_CLEAR.sections.calm, crash: false, lead: null, arp: true, arpRate: 2, pad: true };

const TRACKS = {
  title: TITLE,
  plaza: PLAZA,
  lobby: LOBBY,
  battle: BATTLE,
  // final minute: same song, faster, a step up, busier hats, arp layer throughout, starts on the chorus
  battle_final: { ...BATTLE, bpm: 150, key: 2, intense: true, fadeIn: 0.25, pump: 0.5, intro: [], loop: ['C2', 'A2', 'B', 'C2'] },
  battle_b: BATTLE_B,
  battle_b_final: { ...BATTLE_B, bpm: 146, key: 1, intense: true, fadeIn: 0.25, pump: 0.45, intro: [], loop: ['Ch2', 'Post', 'P', 'Ch2'] },
  battle_c: BATTLE_C,
  battle_c_final: { ...BATTLE_C, bpm: 176, key: 2, intense: true, fadeIn: 0.25, pump: 0.4, intro: [], loop: ['Ch2', 'Solo', 'Ch2', 'Br'] },
  results_win: RESULTS_WIN,
  results_lose: RESULTS_LOSE,
  shop: SHOP,
  news: NEWS,
  story_hub: STORY_HUB,
  story_level: STORY_LEVEL,
  story_boss: STORY_BOSS,
  story_clear: STORY_CLEAR,
};

// ───────────────────────────── music: parsing ─────────────────────
const NOTE_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14], 9: [0, 4, 7, 10, 14], add9: [0, 4, 7, 14], sus4: [0, 5, 7], sus2: [0, 2, 7],
  '7sus4': [0, 5, 7, 10], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], dim: [0, 3, 6], m7b5: [0, 3, 6, 10], aug: [0, 4, 8],
};
const acc = (x) => (x === '#' ? 1 : x === 'b' ? -1 : 0);
function noteToMidi(s) {
  const m = /^([a-g])([#b]?)(-?\d)$/.exec(s);
  return m ? 12 * (parseInt(m[3], 10) + 1) + NOTE_PC[m[1]] + acc(m[2]) : null;
}
function parseChord(sym) {
  const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(sym);
  if (!m || !QUAL[m[3]]) warn(`bad chord "${sym}"`);
  if (!m) return { root: 0, bass: 0, iv: QUAL[''], cache: {} };
  const root = (NOTE_PC[m[1].toLowerCase()] + acc(m[2]) + 12) % 12;
  const bass = m[4] ? (NOTE_PC[m[4].toLowerCase()] + acc(m[5]) + 12) % 12 : root;
  return { root, bass, iv: QUAL[m[3]] || QUAL[''], cache: {} };
}
/** Token bar → 16 slots of {v, len, acc} | null. */
function parseSeq(str, isNote) {
  const tk = str.trim().split(/\s+/), ev = new Array(16).fill(null);
  if (tk.length !== 16) warn(`bar needs 16 steps, got ${tk.length}: "${str}"`);
  for (let i = 0; i < 16; i++) {
    const s = tk[i];
    if (!s || s === '-' || s === '.') continue;
    const v = isNote ? noteToMidi(s) : parseInt(s, 10);
    if (v == null || Number.isNaN(v)) {
      warn(`bad token "${s}"`);
      continue;
    }
    let len = 1;
    while (i + len < 16 && tk[i + len] === '-') len++;
    ev[i] = { v, len, acc: s.endsWith('!') };
  }
  return ev;
}
/** Char rhythm → 16 slots of {mode, len, v} | null (mode = the starting char). */
function parseRhythm(str, starts = 'xX') {
  if (str.length !== 16) warn(`rhythm needs 16 steps: "${str}"`);
  const ev = new Array(16).fill(null);
  for (let i = 0; i < 16; i++) {
    if (!starts.includes(str[i] || '_')) continue;
    let len = 1;
    while (i + len < 16 && str[i + len] === '-') len++;
    ev[i] = { mode: str[i], len, v: str[i] === 'X' ? 1 : 0.8 };
  }
  return ev;
}
function checkLanes(obj) {
  for (const k in obj || {}) for (const s of [].concat(obj[k])) if (s && s.length !== 16) warn(`drum lane ${k} needs 16 steps: "${s}"`);
}
function prepSection(s) {
  if (s._p) return;
  s._p = true;
  const list = (v) => (Array.isArray(v) ? v : [v]);
  if (s.chords.length !== s.bars) warn(`section has ${s.bars} bars but ${s.chords.length} chords`);
  s.chordsP = s.chords.map((c) => c.split(/\s+/).map(parseChord));
  s.bassP = s.bass ? list(s.bass).map((b) => parseSeq(b, false)) : null;
  s.leadP = s.lead ? list(s.lead).map((b) => parseSeq(b, true)) : null;
  s.voxP = s.vox ? list(s.vox).map((b) => syllables(parseSeq(b, true), b + (s.voxSeed || ''))) : null;
  s.compP = s.comp ? list(s.comp).map((r) => parseRhythm(r)) : null;
  s.gtrP = s.gtr ? list(s.gtr).map((r) => parseRhythm(r, 'mPcC')) : null;
  s.drums = s.drums || {};
  checkLanes(s.drums);
  checkLanes(s.fill);
}
for (const name in TRACKS) {
  const tr = TRACKS[name];
  for (const k in tr.sections) prepSection(tr.sections[k]);
  checkLanes(tr.mini);
  tr.introS = tr.intro.map((n) => tr.sections[n]);
  tr.loopS = tr.loop.map((n) => tr.sections[n]);
  tr.hasVox = tr.introS.concat(tr.loopS).some((s) => s.voxP);
}

/** Close voicing in A3..G#4 with extensions on top (cached per transposition). */
function voicing(ch, key) {
  const id = 'v' + key;
  if (ch.cache[id]) return ch.cache[id];
  const out = [];
  for (const i of ch.iv) {
    const n = 57 + ((((ch.root + key + i) % 12) - 9 + 12) % 12) + (i >= 12 ? 12 : 0);
    if (!out.includes(n)) out.push(n);
  }
  return (ch.cache[id] = out.sort((a, b) => a - b));
}
const bassNote = (ch, key) => 36 + ((ch.bass + key) % 12);
/** Nearest chord tone a third-ish below the melody note. */
function harmNote(m, ch, key) {
  for (let n = m - 3; n >= m - 9; n--) {
    const pc = ((n % 12) + 12) % 12;
    if (ch.iv.some((i) => (ch.root + key + i) % 12 === pc)) return n;
  }
  return m - 5;
}
function arpSeq(ch, key, pat) {
  const id = 'a' + key + pat;
  if (ch.cache[id]) return ch.cache[id];
  const v = voicing(ch, key).filter((n) => n < 69);
  let seq = v.concat(v.map((n) => n + 12));
  if (pat === 'updown') seq = seq.concat(seq.slice(1, -1).reverse());
  return (ch.cache[id] = seq);
}

// ───────────────────────────── music: engine ──────────────────────
// Lookahead scheduler ("A Tale of Two Clocks"): a 25 ms timer schedules every
// 16th-step that falls within the next ~120 ms of the audio clock.
const LANES = ['k', 'q', 's', 'c', 'h', 'o', 't', 'r', 'sh', 'cr', 'rd'];
const VEL = { X: 1, x: 0.75, '-': 0.4 };
const MIX = {
  k: 0.9, q: 0.55, s: 0.55, c: 0.4, h: 0.16, o: 0.12, t: 0.5, r: 0.3, sh: 0.12, cr: 0.22, rd: 0.14,
  bass: 0.42, comp: 0.16, pad: 0.1, lead: 0.2, arp: 0.07, gtr: 0.3, vox: 0.5,
};
const XFADE = 1.0;
const insts = [];
let schedTimer = null;
let wantTrack = null;

function playDrum(lane, d, t, v, step) {
  if (!(v > 0.001)) return;
  switch (lane) {
    case 'k': return vKick(d, t, v);
    case 'q': return vKick(d, t, v, true);
    case 's': return vSnare(d, t, v);
    case 'c': return vClap(d, t, v);
    case 'h': return vHat(d, t, v, false);
    case 'o': return vHat(d, t, v, true);
    case 't': return vTom(d, t, v, 230 - step * 7);
    case 'r': return vRim(d, t, v);
    case 'sh': return vShaker(d, t, v);
    case 'cr': return vCrash(d, t, v);
    case 'rd': return vRide(d, t, v);
  }
}

/** One playing track: its own channels, buses, FX, guitar rig, singer and crossfade gains. */
function createInst(name) {
  const tr = TRACKS[name], mix = Object.assign({}, MIX, tr.mix);
  const now = ctx.currentTime, sd = 15 / tr.bpm, fadeIn = tr.fadeIn ?? 0.9;
  const nodes = [], oscs = [];
  const N = (n) => (nodes.push(n), n);
  const out = N(mkGain(0)), wet = N(mkGain(0)), room = N(mkGain(0));
  out.connect(musicBus);
  wet.connect(musicRev);
  room.connect(roomRev);
  for (const g of [out.gain, wet.gain, room.gain]) {
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime(1, now + fadeIn);
  }
  const filt = N(mkFilter('lowpass', 18000, 0.7)), secLvl = N(mkGain(1)); // section sweeps / levels
  wire(filt, secLvl, out);

  // tempo-synced dotted-8th delay with filtered feedback
  const dIn = N(mkGain(1)), dl = N(mkDelay(sd * 3, 2)), dLP = N(mkFilter('lowpass', 2800));
  wire(dIn, N(mkFilter('highpass', 300)), dl, dLP, N(mkGain(0.32)), dl);
  wire(dLP, N(mkGain(0.5)), filt);

  // stereo chorus for keys / pads, with a sidechain-style "pump" in front of it
  const pump = N(mkGain(1)), chIn = N(mkGain(1)), lfo = N(mkOsc('sine', 0.8));
  wire(pump, chIn, filt);
  for (const [base, depth, pan] of [[0.011, 0.0022, -0.7], [0.017, -0.0022, 0.7]]) {
    const dly = N(mkDelay(base, 0.05));
    wire(lfo, N(mkGain(depth)), dly.delayTime);
    wire(chIn, dly, N(mkGain(0.5)), N(mkPan(pan)), filt);
  }
  lfo.start(now);
  oscs.push(lfo);

  const chan = (lvl, dest, rev = 0, dly = 0, rm = 0) => {
    const g = N(mkGain(lvl));
    g.connect(dest);
    if (rev) wire(g, N(mkGain(rev)), wet);
    if (dly) wire(g, N(mkGain(dly)), dIn);
    if (rm) wire(g, N(mkGain(rm)), room);
    return g;
  };
  // drum bus: punchy compression + room send. (Bus compressors add automatic makeup
  // gain in every browser, so each one is trimmed back down after the fact.)
  const drumBus = N(mkComp(-16, 6, 4, 0.004, 0.09));
  wire(drumBus, N(mkGain(0.75)), filt);
  // bass bus: drive (heavy for 'grit', just warmth otherwise) → tone → compressor
  const grit = tr.inst.bass === 'grit', bsh = N(ctx.createWaveShaper());
  bsh.curve = grit ? gritCurve : warmCurve;
  bsh.oversample = '2x';
  wire(bsh, N(mkFilter('lowpass', grit ? 3000 : 5000)), N(mkGain(grit ? 0.42 : 0.6)), N(mkComp(-18, 6, 4, 0.003, 0.1)), N(mkGain(0.5)), filt);
  const ch = {
    drums: chan(1, drumBus, 0.04, 0, 0.22),
    bass: chan(mix.bass, bsh),
    comp: chan(mix.comp * 3, pump, 0.22),
    pad: chan(mix.pad * 3, pump, 0.45),
    lead: chan(mix.lead * 3.5, filt, 0.2, 0.24),
    arp: chan(mix.arp * 3, filt, 0.25, 0.3),
  };
  const I = {
    tr, mix, nodes, oscs, out, wet, room, filt, secLvl, level: 1, pump, ch, sd, fadeStart: now, fadeEnd: now + fadeIn,
    inIntro: tr.introS.length > 0, idx: 0, bar: 0, step: 0, nextTime: now + 0.06, stopAt: 0,
  };
  I.list = I.inIntro ? tr.introS : tr.loopS;
  I.sec = I.list[0];
  if (tr.inst.gtr) I.gtr = makeGtrRig(tr.inst.gtr, N, chan(mix.gtr * 3, filt, 0.08, 0, 0.08));
  if (tr.hasVox) {
    const vox = chan(mix.vox, filt, 0.22, 0.16);
    wire(vox, N(mkDelay(0.023, 0.1)), N(mkGain(0.25)), N(mkPan(0.45)), filt); // doubler
    I.singer = makeSinger(tr.voice || {}, N, oscs, vox, now);
  }
  return I;
}

function advance(I) {
  I.nextTime += I.sd;
  if (++I.step < 16) return;
  I.step = 0;
  if (++I.bar < I.sec.bars) return;
  I.bar = 0;
  if (++I.idx >= I.list.length) {
    I.idx = 0;
    if (I.inIntro) {
      I.inIntro = false;
      I.list = I.tr.loopS;
    }
  }
  I.sec = I.list[I.idx];
}

function playStep(I, t0) {
  const tr = I.tr, sec = I.sec, bar = I.bar, step = I.step, sd = I.sd, key = tr.key || 0, mix = I.mix, C = I.ch;
  const t = t0 + (step & 1 ? (tr.swing || 0) * sd : 0);
  const chs = sec.chordsP[bar % sec.chordsP.length], two = chs.length > 1;
  const ch = chs[two && step >= 8 ? 1 : 0];
  const at = (arr) => arr && arr[bar % arr.length][step];

  if (bar === 0 && step === 0) {
    const fq = I.filt.frequency;
    if (sec.sweep) {
      fq.setValueAtTime(sec.sweep[0], t0);
      fq.exponentialRampToValueAtTime(sec.sweep[1], t0 + sec.bars * 16 * sd);
    } else fq.setValueAtTime(18000, t0);
    const lv = sec.level ?? 1;
    if (lv !== I.level) I.secLvl.gain.setTargetAtTime((I.level = lv), t0, 0.15);
    if (sec.crash) vCrash(C.drums, t0, mix.cr);
  }

  // drums, with end-of-section fills and a small mid-phrase variation
  const kit = !!(sec.drums.k || sec.drums.q);
  const fillBar = !!sec.fill && bar === sec.bars - 1;
  const miniBar = !fillBar && !!tr.mini && kit && sec.bars >= 8 && bar % 8 === 3;
  for (const lane of LANES) {
    let pat = sec.drums[lane];
    if (fillBar && sec.fill[lane] !== undefined) pat = sec.fill[lane];
    else if (miniBar && tr.mini[lane] !== undefined) pat = tr.mini[lane];
    if (tr.intense && lane === 'h' && kit && !(fillBar && sec.fill.h !== undefined)) pat = INTENSE_H;
    if (!pat) continue;
    if (Array.isArray(pat)) pat = pat[bar % pat.length];
    const v = VEL[pat[step]];
    if (!v) continue;
    playDrum(lane, C.drums, t, v * (mix[lane] ?? 0.5) * (lane === 'h' || lane === 'sh' ? rnd(0.85, 1) : 1), step);
    if ((lane === 'k' || lane === 'q') && tr.pump && step % 4 === 0) {
      I.pump.gain.setTargetAtTime(1 - tr.pump * v, t, 0.004);
      I.pump.gain.setTargetAtTime(1, t + 0.04, 0.07);
    }
  }

  // the band (a section "drop" stops everything but drums and vocals)
  if (!(sec.drop && bar === sec.drop[0] && step >= sec.drop[1])) {
    const accent = step % 4 === 0 ? 1 : step % 2 === 0 ? 0.85 : 0.75;
    let ev = at(sec.bassP);
    if (ev) vBass(C.bass, t, bassNote(ch, key) + ev.v, ev.len * sd * 0.92, (ev.acc ? 1 : 0.92) * accent, tr.inst.bass, ev.acc);
    ev = at(sec.compP);
    if (ev) vChord(C.comp, t, voicing(ch, key), ev.len * sd * 0.95, ev.v, sec.compInst || tr.inst.comp);
    if (sec.pad && (step === 0 || (two && step === 8))) vChord(C.pad, t, voicing(ch, key), (two ? 8 : 16) * sd, 0.8, tr.inst.pad);
    ev = at(sec.gtrP);
    if (ev && I.gtr) vGtr(I.gtr, t, 40 + ((ch.root + key) % 12) + 12 * (sec.gtrOct || 0), voicing(ch, key), ev.mode, ev.len * sd * 0.95);
    const rate = sec.arpRate || 1;
    if ((sec.arp || (tr.intense && kit)) && step % rate === 0) {
      const seq = arpSeq(ch, key, tr.arpPat || 'up'), i = ((bar * 16 + step) / rate) | 0;
      vArp(C.arp, t, seq[i % seq.length] + 12, rate * sd * 0.8, step % 4 === 0 ? 0.9 : 0.65, tr.inst.arp);
    }
  }
  let ev = at(sec.leadP);
  if (ev) {
    const m = ev.v + key + 12 * (sec.leadOct || 0), v = (step % 4 === 0 ? 0.95 : 0.8) * (sec.leadVel ?? 1);
    const kind = sec.leadInst || tr.inst.lead, len = ev.len * sd * 0.92;
    vLead(C.lead, t, m, len, v, kind);
    if (sec.harm) vLead(C.lead, t, harmNote(m, ch, key), len, v * 0.5, kind);
  }
  ev = at(sec.voxP);
  if (ev && I.singer) sing(I.singer, t, ev.v + key + 12 * (sec.voxOct || 0), ev.len * sd, step % 4 === 0 ? 1 : 0.88, ev.syl);
}

function schedTick() {
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const hidden = typeof document !== 'undefined' && document.hidden;
    const horizon = now + (hidden ? 1.2 : 0.12); // background tabs throttle timers to ~1 Hz
    for (let i = insts.length - 1; i >= 0; i--) {
      const I = insts[i];
      if (I.stopAt && now > I.stopAt + 2.5) {
        halt(I.oscs);
        unplug(I.nodes);
        insts.splice(i, 1);
        continue;
      }
      if (I.nextTime < now - 0.25) while (I.nextTime < now) advance(I); // fell behind: skip, don't burst
      while (I.nextTime < horizon && !(I.stopAt && I.nextTime >= I.stopAt)) {
        try {
          playStep(I, I.nextTime);
        } catch (e) {
          warn(e); // lose one step, never the whole track
        }
        advance(I);
      }
    }
    if (!insts.length && schedTimer) {
      clearInterval(schedTimer);
      schedTimer = null;
    }
  } catch (e) {
    warn(e);
  }
}

/** Fade every playing track out over XFADE and start `name` (or nothing). */
function startMusic(name) {
  const now = ctx.currentTime;
  for (const I of insts) {
    if (I.stopAt) continue;
    const cur = now < I.fadeEnd ? clamp((now - I.fadeStart) / (I.fadeEnd - I.fadeStart), 0, 1) : 1;
    for (const g of [I.out.gain, I.wet.gain, I.room.gain]) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(cur, now);
      g.linearRampToValueAtTime(0, now + XFADE);
    }
    I.stopAt = now + XFADE;
  }
  if (name && TRACKS[name]) insts.push(createInst(name));
  if (insts.length && !schedTimer) schedTimer = setInterval(schedTick, 25);
  schedTick();
}

// ───────────────────────────── setup ──────────────────────────────
function build() {
  noiseBuf = makeNoise(3, false);
  pinkBuf = makeNoise(4, true);
  gritCurve = makeDrive(2.4);
  warmCurve = makeDrive(1.2);
  for (const k in GTR_DRIVES) GTR[k] = { ...GTR_DRIVES[k], curve: makeDrive(GTR_DRIVES[k].k, GTR_DRIVES[k].asym) };
  glottalWave = makeGlottal();

  // master: glue compressor → brickwall-ish limiter → transparent soft clipper (ceiling 0.98) → volume
  const glue = mkComp(-10, 8, 2.5, 0.006, 0.2), clip = ctx.createWaveShaper();
  clip.curve = makeClip();
  clip.oversample = '2x';
  master = mkGain(muted ? 0 : vol.master * MASTER_TRIM);
  wire(glue, mkComp(-1.5, 0, 20, 0.0015, 0.08), mkGain(0.5), clip, master, ctx.destination);

  sfxBus = mkGain(vol.sfx * SFX_TRIM);
  sfxBus.connect(glue);
  // music: gentle smile EQ + its own bus compressor, then the duck for big sfx moments
  const lo = mkFilter('lowshelf', 110), hi = mkFilter('highshelf', 8000);
  lo.gain.value = 2;
  hi.gain.value = 1.5;
  musicBus = mkGain(vol.music * MUSIC_TRIM);
  musicDuck = mkGain(1);
  wire(musicBus, lo, hi, mkComp(-20, 10, 2.5, 0.01, 0.25), musicDuck, glue);

  musicRev = ctx.createConvolver();
  musicRev.buffer = makeImpulse(2.4, 2.6);
  wire(musicRev, mkGain(0.5), musicBus);
  roomRev = ctx.createConvolver();
  roomRev.buffer = makeImpulse(0.7, 4, 0.8);
  wire(roomRev, mkGain(0.6), musicBus);
  sfxRev = ctx.createConvolver();
  sfxRev.buffer = makeImpulse(1.3, 3);
  wire(sfxRev, mkGain(0.5), sfxBus);
}
function applyLevels() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(muted ? 0 : vol.master * MASTER_TRIM, t, 0.03);
  sfxBus.gain.setTargetAtTime(vol.sfx * SFX_TRIM, t, 0.03);
  musicBus.gain.setTargetAtTime(vol.music * MUSIC_TRIM, t, 0.05);
}
const webAudioCtor = () => ROOT.AudioContext || ROOT.webkitAudioContext || null;

// ───────────────────────────── public API ─────────────────────────
const init = guard(() => {
  if (ctx) {
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
    return;
  }
  const AC = webAudioCtor();
  if (!AC) return;
  let c;
  try {
    c = new AC({ latencyHint: 'interactive' });
  } catch {
    c = new AC();
  }
  ctx = c;
  try {
    build();
  } catch (e) {
    warn(e);
    try { c.close(); } catch { /* ignore */ }
    ctx = null;
    return;
  }
  if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
  for (const st of pendingLoops.splice(0)) if (!st.stopped) st.live = startLoop(st);
  if (wantTrack) startMusic(wantTrack);
});

const setMuted = guard((m) => {
  muted = !!m;
  applyLevels();
  return muted;
}, () => muted);

const setVolume = guard((v) => {
  if (!v || typeof v !== 'object') return;
  for (const k of ['master', 'sfx', 'music']) if (v[k] != null) vol[k] = clamp(num(v[k], vol[k]), 0, 1);
  applyLevels();
});

const setListener = guard((x, y, z, yaw) => {
  listener.x = num(x, listener.x);
  listener.y = num(y, listener.y);
  listener.z = num(z, listener.z);
  listener.yaw = num(yaw, listener.yaw);
  if (ctx) for (const L of liveLoops) if (L.st.pos) applyLoop(L);
});

const sfx = guard((name, opts) => {
  if (!ctx || ctx.state !== 'running' || muted || vol.master <= 0 || vol.sfx <= 0) return;
  if (own(SFX, name)) playSfx(name, SFX[name], opts || {});
});

const loop = guard((name, opts) => {
  if (!own(LOOPS, name)) return dummyHandle();
  const o = opts || {};
  const st = {
    name, stopped: false, live: null,
    vol: clamp(num(o.volume, 1), 0, 1.5),
    pitch: clamp(num(o.pitch, 1), 0.25, 4),
    pos: hasPos(o) ? [num(o.x, 0), num(o.y, 0), num(o.z, 0)] : null,
  };
  if (ctx && ctx.state !== 'closed') st.live = startLoop(st);
  else if (webAudioCtor()) {
    pendingLoops.push(st); // not initialised yet: starts on init()
    if (pendingLoops.length > 16) pendingLoops.shift().stopped = true;
  } else return dummyHandle();
  const live = () => st.live && !st.live.dead;
  return {
    setVolume: guard((v) => {
      st.vol = clamp(num(v, st.vol), 0, 1.5);
      if (live()) applyLoop(st.live);
    }),
    setPitch: guard((p) => {
      st.pitch = clamp(num(p, st.pitch), 0.25, 4);
      if (live()) st.live.inner.setPitch(st.pitch, ctx.currentTime);
    }),
    setPos: guard((x, y, z) => {
      st.pos = [num(x, 0), num(y, 0), num(z, 0)];
      if (live()) applyLoop(st.live);
    }),
    stop: guard(() => {
      if (st.stopped) return;
      st.stopped = true;
      if (st.live) stopLoop(st.live);
      else if (pendingLoops.includes(st)) pendingLoops.splice(pendingLoops.indexOf(st), 1);
    }),
  };
}, dummyHandle);

const music = guard((track) => {
  const name = track == null ? null : String(track);
  if (name !== null && !own(TRACKS, name)) return; // unknown names are ignored
  if (name === wantTrack) return;
  wantTrack = name;
  if (ctx) startMusic(name);
});

export const audio = {
  init,
  get ready() {
    return !!ctx && ctx.state === 'running';
  },
  setMuted,
  toggleMute: () => setMuted(!muted),
  get muted() {
    return muted;
  },
  setVolume,
  setListener,
  sfx,
  loop,
  music,
};

export default audio;
