// Every sound effect in the racer, synthesized. One-shots are rendered once
// (offline DSP in synthkit) into cached AudioBuffers and replayed with a little
// random rate/gain so repeats never sound identical. Continuous effects are
// small node graphs, built lazily on the first non-zero call, smoothed every
// frame, and torn down after a few seconds of silence.

import { audio } from './audio.js';
import {
  TAU, clamp, rng, hash, Biquad, modal, ping, burst, pinkGen, wanderGen,
  alloc, normalize, fadeEdges, loopify, toBuffer, setSmooth, rotStereo, krate,
} from './synthkit.js';

// ===========================================================================
// One-shot renderers: (sr, R, variantIndex) → [Float32Array, …] (1–2 channels)
// ===========================================================================

function sweepSine(o, sr, at, dur, f0, f1, amp, tau, harm = null) {
  const i0 = Math.round(at * sr), n = Math.min(o.length - i0, Math.round(dur * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t / tau);
    ph += (TAU * f) / sr;
    let v = Math.sin(ph);
    if (harm) for (let k = 0; k < harm.length; k++) v += harm[k] * Math.sin(ph * (k + 2));
    o[i0 + i] += v * amp * Math.min(1, t / 0.002, (n - i) / (0.15 * n)) * Math.exp(-t / (dur * 0.35));
  }
}

function rImpact(sr, R, kind) {
  const obj = kind === 'object', wall = kind === 'wall';
  const [L, Rt] = alloc(obj ? 0.5 : 0.95, sr, 2);
  const n = L.length;
  // low body thud with a fast pitch drop
  const thud = new Float32Array(n);
  const f0 = wall ? 64 : obj ? 150 : 88;
  sweepSine(thud, sr, 0, wall ? 0.5 : 0.35, f0, f0 * 0.5, 1, 0.03);
  normalize([thud], 1);
  // crumple: a dense-then-sparse cluster of micro impacts per channel
  const exc = [new Float32Array(n), new Float32Array(n)];
  const grains = obj ? 10 : wall ? 24 : 34;
  const spread = obj ? 0.07 : 0.17;
  for (let g = 0; g < grains; g++) {
    const t = Math.pow(R(), 2.2) * spread;
    const a = Math.exp(-t / 0.07) * (0.3 + 0.7 * R());
    const c = R() < 0.5 ? 0 : 1;
    burst(exc[c], t * sr, 0.0004 + R() * 0.0012, a, R, 0.00005, sr);
    burst(exc[1 - c], (t + R() * 0.0008) * sr, 0.0004 + R() * 0.001, a * 0.6, R, 0.00005, sr);
  }
  // panel modes: inharmonic sheet metal (or hollow plastic for objects)
  const nm = obj ? 6 : 14;
  const modes = [];
  for (let k = 0; k < nm; k++) {
    const f = obj ? 300 * Math.pow(1.55, k) * (0.9 + 0.2 * R()) : 170 * Math.pow(5200 / 170, (k + R() * 0.8) / nm);
    // short decays: crumpled panels clunk rather than ring
    const d = obj ? 0.015 + 0.03 * R() : 0.012 + (wall ? 0.05 : 0.09) * R() * Math.pow(1 - k / nm, 0.8);
    modes.push([f, d, (0.4 + 0.6 * R()) / Math.sqrt(k + 1)]);
  }
  const met = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    modal(exc[c], met[c], modes.map(([f, d, a]) => [f * (1 + (R() - 0.5) * 0.012), d, a * (0.7 + 0.6 * R())]), sr);
  }
  normalize(met, 1);
  // crunch: broadband grit bursts
  const cr = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    for (let g = 0; g < grains * 3; g++) {
      const t = Math.pow(R(), 1.8) * (spread + 0.05);
      burst(cr[c], t * sr, 0.002 + R() * 0.006, Math.exp(-t / 0.08) * (0.2 + 0.8 * R()), R, 0.0002, sr);
    }
    new Biquad('bandpass', wall ? 1700 : obj ? 1200 : 2600, 0.6, 0, sr).run(cr[c]);
  }
  normalize(cr, 1);
  const wT = wall ? 0.95 : obj ? 0.5 : 0.75, wM = obj ? 0.6 : wall ? 0.35 : 0.45, wC = wall ? 0.75 : obj ? 0.3 : 0.65;
  for (let i = 0; i < n; i++) {
    L[i] = thud[i] * wT + met[0][i] * wM + cr[0][i] * wC;
    Rt[i] = thud[i] * wT + met[1][i] * wM + cr[1][i] * wC;
  }
  for (const c of [L, Rt]) new Biquad('highpass', 35, 0.7, 0, sr).run(c);
  normalize([L, Rt], 0.92);
  return fadeEdges([L, Rt], sr, 0.0003, 0.06);
}

function rGlass(sr, R) {
  const [L, Rt] = alloc(0.85, sr, 2);
  for (const c of [L, Rt]) {
    burst(c, 0, 0.014, 0.6, R, 0.0002, sr);
    new Biquad('highpass', 3200, 0.7, 0, sr).run(c);
  }
  for (let s = 0; s < 55; s++) {
    const t = 0.004 + Math.pow(R(), 1.7) * 0.65;
    const c = R() < 0.5 ? L : Rt;
    const f = 2800 + R() * 8500, a = (0.12 + 0.5 * R()) * Math.exp(-t / 0.3);
    ping(c, t * sr, f, 0.012 + R() * 0.05, a, sr, R() * TAU);
    ping(c, t * sr, f * (1.4 + R() * 0.9), 0.008 + R() * 0.02, a * 0.45, sr, R() * TAU);
  }
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.0003, 0.05);
}

function rLanding(sr, R) {
  const [o] = alloc(0.6, sr);
  sweepSine(o, sr, 0, 0.42, 74, 36, 1, 0.05);
  const k = new Float32Array(o.length);
  burst(k, 0, 0.03, 1, R, 0.001, sr);
  new Biquad('lowpass', 550, 0.8, 0, sr).run(k);
  normalize([k], 0.55);
  const sp = new Float32Array(o.length);
  sp[Math.round(0.004 * sr)] = 1;
  const strut = modal(sp, new Float32Array(o.length), [[185 + R() * 40, 0.1, 1], [520 + R() * 80, 0.03, 0.4]], sr);
  normalize([strut], 0.16);
  for (let i = 0; i < o.length; i++) o[i] += k[i] + strut[i];
  for (let j = 0; j < 8; j++) ping(o, (0.02 + R() * 0.2) * sr, 900 + R() * 2200, 0.004 + R() * 0.01, 0.04 + R() * 0.07, sr, R() * TAU);
  normalize([o], 0.9);
  return fadeEdges([o], sr, 0.0005, 0.05);
}

function rClick(o, sr, R, at, amp, modes) {
  const e = new Float32Array(o.length);
  burst(e, at * sr, 0.0009, 1, R, 0.00004, sr);
  const m = modal(e, new Float32Array(o.length), modes, sr);
  normalize([m], amp);
  for (let i = 0; i < o.length; i++) o[i] += m[i] + e[i] * amp * 0.25;
}

function rShift(sr, R) {
  const [o] = alloc(0.24, sr);
  const metal = () => [[2600 + R() * 900, 0.008, 1], [5100 + R() * 900, 0.004, 0.6], [1250 + R() * 300, 0.014, 0.5]];
  rClick(o, sr, R, 0.004, 0.8, metal());
  sweepSine(o, sr, 0.006, 0.07, 160, 95, 0.55, 0.02);
  rClick(o, sr, R, 0.04 + R() * 0.02, 0.6, metal());
  const w = new Float32Array(o.length);
  const bp = new Biquad('bandpass', 900, 0.7, 0, sr);
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    w[i] = bp.tick(R() * 2 - 1) * (1 - Math.exp(-t / 0.012)) * Math.exp(-t / 0.05);
  }
  normalize([w], 0.18);
  for (let i = 0; i < o.length; i++) o[i] += w[i];
  normalize([o], 0.85);
  return fadeEdges([o], sr, 0.0003, 0.03);
}

function tone(o, sr, at, dur, f, amp, partials, atk = 0.003, rel = 0.05, vib = 0) {
  const i0 = Math.round(at * sr), n = Math.min(o.length - i0, Math.round(dur * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (TAU * f * (1 + vib * Math.sin(TAU * 5.5 * t))) / sr;
    let v = 0;
    for (const [k, a] of partials) v += a * Math.sin(ph * k);
    const env = Math.min(1, t / atk) * Math.min(1, (dur - t) / rel);
    o[i0 + i] += v * amp * Math.max(0, env);
  }
}

function rBeep(sr, R, go) {
  const [o] = alloc(go ? 0.95 : 0.26, sr, 1);
  const p = [[1, 0.7], [2, 0.16], [3, 0.08], [4, 0.03]];
  if (go) {
    tone(o, sr, 0, 0.9, 1760, 0.6, p, 0.003, 0.35, 0.004);
    tone(o, sr, 0, 0.9, 2637, 0.32, p, 0.004, 0.35, 0.004);
    tone(o, sr, 0, 0.9, 880, 0.22, [[1, 1]], 0.004, 0.35);
  } else {
    tone(o, sr, 0, 0.22, 880, 0.75, p, 0.002, 0.07);
  }
  normalize([o], 0.8);
  return fadeEdges([o], sr, 0.001, 0.02);
}

// --- UI: crisp, slightly metallic 2000s menu blips -------------------------
const MET = [[1, 1], [2.76, 0.32], [5.4, 0.12]]; // inharmonic partials → metallic

function blip(o, sr, at, f, amp, tau, partials = MET, glideTo = 0) {
  const i0 = Math.round(at * sr), n = Math.min(o.length - i0, Math.round(tau * 7 * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ff = glideTo ? glideTo + (f - glideTo) * Math.exp(-t / (tau * 0.7)) : f;
    ph += (TAU * ff) / sr;
    let v = 0;
    for (const [k, a] of partials) v += a * Math.sin(ph * k) * Math.exp(-t * (k - 1) * 18);
    o[i0 + i] += v * amp * Math.min(1, t / 0.0008) * Math.exp(-t / tau);
  }
}

function rUi(sr, R, name) {
  const dur = { move: 0.09, select: 0.22, back: 0.16, error: 0.32, tab: 0.1, buy: 1.05, unlock: 1.0 }[name];
  const [L, Rt] = alloc(dur, sr, 2);
  const both = (fn) => { fn(L, 0); fn(Rt, 1); };
  switch (name) {
    case 'move':
      both((c) => { blip(c, sr, 0, 2093, 0.6, 0.012); burst(c, 0, 0.0006, 0.25, R, 0.00003, sr); });
      break;
    case 'select':
      both((c, i) => {
        blip(c, sr, 0, 1568, 0.45, 0.02);
        blip(c, sr, 0.045, 2349 * (i ? 1.003 : 1), 0.55, 0.035);
        sweepSine(c, sr, 0, 0.04, 240, 160, 0.3, 0.01);
      });
      break;
    case 'back':
      both((c) => blip(c, sr, 0, 1318, 0.55, 0.03, [[1, 1], [3, 0.18]], 820));
      break;
    case 'error': {
      const buzz = [[1, 1], [3, 0.33], [5, 0.2], [7, 0.14], [9, 0.11], [11, 0.09]];
      both((c) => { tone(c, sr, 0, 0.09, 150, 0.4, buzz, 0.004, 0.012); tone(c, sr, 0.13, 0.11, 140, 0.4, buzz, 0.004, 0.02); });
      for (const c of [L, Rt]) new Biquad('lowpass', 2200, 0.8, 0, sr).run(c);
      break;
    }
    case 'tab':
      both((c) => { burst(c, 0, 0.0007, 0.35, R, 0.00003, sr); blip(c, sr, 0.003, 1760, 0.45, 0.016, MET, 1661); });
      break;
    case 'buy': {
      // "cha": drawer ratchet + thunk, then "ching": bell, then coins
      const cha = new Float32Array(L.length);
      for (let k = 0; k < 4; k++) burst(cha, (0.004 + k * 0.016 + R() * 0.004) * sr, 0.003, 0.6 - k * 0.1, R, 0.0001, sr);
      burst(cha, 0.07 * sr, 0.02, 0.25, R, 0.002, sr);
      new Biquad('bandpass', 3200, 1.1, 0, sr).run(cha);
      normalize([cha], 0.5);
      sweepSine(cha, sr, 0.004, 0.06, 170, 110, 0.35, 0.02);
      both((c, i) => {
        for (let k = 0; k < c.length; k++) c[k] += cha[k];
        for (const [ratio, d] of [[1, 0.9], [2.32, 0.5], [4.25, 0.3], [6.63, 0.16]]) {
          ping(c, 0.085 * sr, 2093 * ratio * (i ? 1.002 : 1), d * 0.55, 0.4 / ratio, sr);
        }
        for (let k = 0; k < 6; k++) ping(c, (0.1 + R() * 0.3) * sr, 4200 + R() * 4000, 0.03 + R() * 0.04, 0.05 + R() * 0.08, sr, R() * TAU);
      });
      break;
    }
    case 'unlock': {
      const notes = [1046.5, 1318.5, 1568, 2093];
      both((c, i) => {
        notes.forEach((f, k) => fmBell(c, sr, 0.06 * k, f * (i ? 1.002 : 0.998), 0.35, 0.28));
        for (let k = 0; k < 10; k++) ping(c, (0.2 + R() * 0.6) * sr, 3500 + R() * 4500, 0.05 + R() * 0.08, 0.03 + R() * 0.04, sr, R() * TAU);
      });
      break;
    }
  }
  normalize([L, Rt], name === 'buy' || name === 'unlock' ? 0.8 : 0.7);
  return fadeEdges([L, Rt], sr, 0.0003, 0.02);
}

function fmBell(o, sr, at, f, amp, tau, ratio = 3.5, index = 2.5) {
  const i0 = Math.round(at * sr), n = Math.min(o.length - i0, Math.round(tau * 6 * sr));
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const I = index * Math.exp(-t / (tau * 0.4));
    o[i0 + i] += amp * Math.sin(TAU * f * t + I * Math.sin(TAU * f * ratio * t)) * Math.min(1, t / 0.002) * Math.exp(-t / tau);
  }
}

function rKnob(sr, R) {
  const [o] = alloc(0.04, sr);
  const snap = 0.004 + R() * 0.003;
  rClick(o, sr, R, 0.001, 0.35, [[2900 + R() * 600, 0.0025, 1], [6400 + R() * 800, 0.0012, 0.5], [430 + R() * 80, 0.005, 0.4]]);
  rClick(o, sr, R, 0.001 + snap, 0.7, [[3300 + R() * 500, 0.003, 1], [6900 + R() * 700, 0.0014, 0.5], [470 + R() * 80, 0.006, 0.5]]);
  normalize([o], 0.7);
  return fadeEdges([o], sr, 0.0002, 0.01);
}

function rTvOn(sr, R) {
  const [L, Rt] = alloc(2.3, sr, 2);
  const n = L.length;
  const mono = new Float32Array(n);
  rClick(mono, sr, R, 0.002, 0.35, [[1500, 0.01, 1], [3400, 0.004, 0.5]]); // relay
  // degauss "thwung": decaying 60 Hz hum + harmonics, wobbling, slightly buzzy
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr - 0.03;
    if (t < 0) continue;
    ph += (TAU * 60) / sr;
    const env = Math.min(1, t / 0.012) * Math.exp(-t / 0.38) * (0.75 + 0.25 * Math.cos(TAU * 7 * t));
    const v = Math.sin(ph) + 0.55 * Math.sin(2 * ph + 0.3) + 0.35 * Math.sin(3 * ph) + 0.15 * Math.sin(5 * ph);
    mono[i] += Math.tanh(v * 1.4) * 0.55 * env;
  }
  sweepSine(mono, sr, 0.03, 0.25, 90, 42, 0.5, 0.05);
  const bp = [new Biquad('bandpass', 2600, 0.5, 0, sr), new Biquad('bandpass', 2600, 0.5, 0, sr)];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // static swell
    const sw = t < 0.15 ? 0 : t < 0.6 ? (t - 0.15) / 0.45 : Math.exp(-(t - 0.6) / 0.35);
    // flyback whine ~15.7 kHz: present but quiet (≈ -44 dB)
    const wh = 0.006 * Math.min(1, Math.max(0, (t - 0.12) / 0.4)) * Math.min(1, (2.3 - t) / 0.5);
    const w = wh * Math.sin(TAU * 15734 * t);
    L[i] = mono[i] + bp[0].tick(R() * 2 - 1) * 0.5 * sw + w;
    Rt[i] = mono[i] + bp[1].tick(R() * 2 - 1) * 0.5 * sw + w;
  }
  normalize([L, Rt], 0.8);
  return fadeEdges([L, Rt], sr, 0.0005, 0.08);
}

function rTvOff(sr, R) {
  const [L, Rt] = alloc(0.7, sr, 2);
  const n = L.length;
  const m = new Float32Array(n);
  // collapsing zap: fast falling sweep with buzzy harmonics
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 60 + 2600 * Math.exp(-t / 0.045);
    ph += (TAU * f) / sr;
    m[i] = Math.tanh(2 * Math.sin(ph)) * 0.5 * Math.min(1, t / 0.002) * Math.exp(-t / 0.09);
  }
  burst(m, 0, 0.004, 0.6, R, 0.00005, sr);
  sweepSine(m, sr, 0.005, 0.3, 70, 40, 0.4, 0.08);
  const st = new Float32Array(n);
  burst(st, 0, 0.05, 0.35, R, 0.0005, sr);
  new Biquad('highpass', 1500, 0.7, 0, sr).run(st);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const w = 0.005 * Math.exp(-t / 0.15) * Math.sin(TAU * 15734 * t);
    L[i] = m[i] + st[i] + w;
    Rt[i] = m[i] + st[i] * 0.9 + w;
  }
  normalize([L, Rt], 0.75);
  return fadeEdges([L, Rt], sr, 0.0003, 0.05);
}

function rPhone(sr, R) {
  const [L, Rt] = alloc(1.75, sr, 2);
  const n = L.length;
  // vibration buzz: two rough 170 Hz bursts rattling on a table
  const vib = new Float32Array(n);
  const rattle = wanderGen(R, 60, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const on = (t > 0.0 && t < 0.2) || (t > 0.27 && t < 0.47);
    if (!on) continue;
    const local = t < 0.24 ? t : t - 0.27;
    const env = Math.min(1, local / 0.015) * Math.min(1, (0.2 - local) / 0.02);
    const sq = Math.sin(TAU * 172 * t) > 0 ? 1 : -1;
    vib[i] = sq * env * (0.6 + 0.4 * rattle());
  }
  new Biquad('lowpass', 1500, 0.9, 0, sr).run(vib);
  new Biquad('peaking', 340, 2, 5, sr).run(vib);
  normalize([vib], 0.45);
  // polyphonic FM chirp: quick rising arpeggio + answer, melody over a harmony a third below
  const mel = [[0.55, 1318.5], [0.62, 1661.2], [0.69, 1975.5], [0.76, 2637], [0.95, 2489], [1.04, 2637]];
  const har = [[0.55, 1046.5], [0.69, 1568], [0.95, 1975.5]];
  for (const c of [L, Rt]) for (let i = 0; i < n; i++) c[i] = vib[i];
  for (const [t, f] of mel) { fmBell(L, sr, t, f, 0.32, 0.09, 1, 1.2); fmBell(Rt, sr, t, f * 1.003, 0.32, 0.09, 1, 1.2); }
  for (const [t, f] of har) { fmBell(L, sr, t, f, 0.16, 0.12, 2, 0.8); fmBell(Rt, sr, t, f, 0.16, 0.12, 2, 0.8); }
  normalize([L, Rt], 0.75);
  return fadeEdges([L, Rt], sr, 0.0005, 0.05);
}

function rWhoosh(sr, R, dir) {
  const [L, Rt] = alloc(0.8, sr, 2);
  const n = L.length;
  const bp = new Biquad('bandpass', 1500, 1.1, 0, sr), lp = new Biquad('lowpass', 250, 0.7, 0, sr);
  const peakT = 0.32 + R() * 0.06;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if ((i & 31) === 0) bp.set('bandpass', 2300 * Math.exp(-t * 2.2) + 450, 1.1, 0, sr);
    const x = (t - peakT) / (t < peakT ? 0.16 : 0.1);
    const env = Math.exp(-x * x);
    const w = R() * 2 - 1;
    const v = (bp.tick(w) * 1.4 + lp.tick(w) * 0.9) * env;
    // pass from one side to the other around the peak
    const p = clamp(0.5 + (t - peakT) * 3 * (dir ? 1 : -1), 0, 1);
    L[i] = v * Math.cos((p * Math.PI) / 2);
    Rt[i] = v * Math.sin((p * Math.PI) / 2);
  }
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.002, 0.04);
}

function rCheckpoint(sr, R) {
  const [L, Rt] = alloc(1.1, sr, 2);
  const bell = (c, at, f, a, d) => {
    for (const [k, amp, dd] of [[1, 1, 1], [2, 0.32, 0.5], [3.01, 0.14, 0.35], [4.2, 0.07, 0.2]]) ping(c, at * sr, f * k, d * dd, a * amp, sr);
  };
  bell(L, 0, 1318.5, 0.5, 0.5); bell(Rt, 0, 1318.5 * 1.002, 0.5, 0.5);
  bell(L, 0.09, 1975.5, 0.55, 0.65); bell(Rt, 0.09, 1975.5 * 0.998, 0.55, 0.65);
  for (let k = 0; k < 6; k++) ping(k % 2 ? L : Rt, (0.1 + k * 0.03) * sr, 5274 + R() * 800, 0.06, 0.05, sr);
  normalize([L, Rt], 0.8);
  return fadeEdges([L, Rt], sr, 0.0005, 0.05);
}

function rHorn(sr, R, truck) {
  const dur = truck ? 1.35 : 0.55;
  const [o] = alloc(dur, sr);
  const n = o.length;
  const freqs = truck ? [164.8, 196, 246.9] : [415, 523];
  const phs = freqs.map(() => R() * TAU);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const sag = truck ? 1 - 0.07 * Math.exp(-t / 0.06) : 1 - 0.02 * Math.exp(-t / 0.02);
    let v = 0;
    freqs.forEach((f, k) => {
      phs[k] += (TAU * f * sag) / sr;
      // buzzy diaphragm / brassy reed: clipped sine
      v += Math.tanh((truck ? 2.4 : 3.2) * Math.sin(phs[k]));
    });
    const atk = truck ? 0.06 : 0.012, rel = truck ? 0.15 : 0.04;
    o[i] = v * Math.min(1, t / atk) * Math.min(1, Math.max(0, (dur - t) / rel));
  }
  if (truck) {
    new Biquad('lowpass', 2600, 0.7, 0, sr).run(o);
    new Biquad('peaking', 700, 1, 4, sr).run(o);
  } else {
    new Biquad('peaking', 2200, 1.2, 6, sr).run(o);
    new Biquad('highpass', 250, 0.7, 0, sr).run(o);
    new Biquad('lowpass', 5000, 0.7, 0, sr).run(o);
  }
  normalize([o], 0.8);
  return fadeEdges([o], sr, 0.002, 0.02);
}

// starter cranks the engine over (compression strokes slow it down), then it catches
function rEngineStart(sr, R) {
  const [o] = alloc(2.8, sr);
  const n = o.length;
  rClick(o, sr, R, 0.005, 0.4, [[1800, 0.01, 1], [3900, 0.004, 0.5]]); // solenoid
  const nz = new Float32Array(n);
  const pulses = new Float32Array(n);
  let crank = 0, whPh = 0, prevFire = 0;
  const catchT = 1.05 + R() * 0.15;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let rpm;
    if (t < 0.05) rpm = 0;
    else if (t < catchT) rpm = 240 * (1 - 0.32 * Math.cos(crank * 2)) * Math.min(1, (t - 0.05) / 0.08);
    else if (t < catchT + 0.3) rpm = 260 + 1700 * Math.pow((t - catchT) / 0.3, 0.7);
    else rpm = 900 + 1060 * Math.exp(-(t - catchT - 0.3) / 0.25);
    crank += (TAU * rpm) / 60 / sr;
    // starter whine while cranking
    if (t > 0.05 && t < catchT + 0.04) {
      whPh += (TAU * rpm * 1.55) / sr;
      const fade = Math.min(1, (catchT + 0.04 - t) / 0.04);
      o[i] += (Math.sin(whPh) * 0.12 + Math.sin(whPh * 2.02) * 0.06) * fade * (0.7 + 0.3 * Math.cos(crank * 2));
      nz[i] += (R() * 2 - 1) * 0.12 * Math.max(0, Math.cos(crank * 2)) * fade;
    }
    // 4-cylinder firing events every 180° once it catches
    const fire = Math.floor(crank / Math.PI);
    if (t >= catchT && fire !== prevFire) {
      const a = 0.6 + 0.5 * R();
      burst(pulses, i, 0.0018, a, R, 0.00012, sr);
      pulses[i] += a;
    }
    prevFire = fire;
  }
  const body = modal(pulses, new Float32Array(n), [[95, 0.03, 1], [310, 0.012, 0.6], [820, 0.005, 0.3]], sr);
  normalize([body], 0.8);
  new Biquad('lowpass', 900, 0.7, 0, sr).run(nz);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    o[i] += body[i] + nz[i] * 2 + pulses[i] * 0.08;
    o[i] *= t > 2.2 ? Math.max(0, 1 - (t - 2.2) / 0.6) : 1;
  }
  new Biquad('highpass', 40, 0.7, 0, sr).run(o);
  normalize([o], 0.85);
  return fadeEdges([o], sr, 0.001, 0.05);
}

function rAirWrench(sr, R) {
  const [o] = alloc(1.15, sr);
  const n = o.length;
  const bursts = [[0.02, 0.36], [0.5, 0.58]];
  const hammer = new Float32Array(n);
  const whine = new Float32Array(n);
  const hp = new Biquad('highpass', 3500, 0.7, 0, sr);
  let ph = 0;
  for (const [t0, d] of bursts) {
    let next = t0 + 0.03;
    for (let i = Math.round(t0 * sr); i < Math.min(n, Math.round((t0 + d) * sr)); i++) {
      const t = i / sr - t0;
      const spd = Math.min(1, t / 0.05) * Math.min(1, (d - t) / 0.07);
      ph += (TAU * (900 + 900 * spd)) / sr;
      whine[i] += (Math.sin(ph) + 0.4 * Math.sin(2 * ph)) * 0.14 * spd + hp.tick(R() * 2 - 1) * 0.22 * spd;
      if (i / sr >= next && spd > 0.3) {
        hammer[i] += 0.6 + 0.4 * R();
        next = i / sr + 1 / (24 + 4 * spd + R() * 2);
      }
    }
  }
  const met = modal(hammer, new Float32Array(n), [[1850, 0.012, 1], [3700, 0.008, 0.7], [5200, 0.006, 0.5], [7900, 0.004, 0.3], [310, 0.01, 0.5]], sr);
  normalize([met], 0.8);
  for (let i = 0; i < n; i++) o[i] = met[i] + whine[i];
  normalize([o], 0.85);
  return fadeEdges([o], sr, 0.001, 0.04);
}

function rSpray(sr, R) {
  const [L, Rt] = alloc(1.5, sr, 2);
  const n = L.length;
  // can shake: rattle ball clicks
  const rat = new Float32Array(n);
  for (const t of [0.0, 0.085, 0.18, 0.27]) {
    rClick(rat, sr, R, t + 0.005, 0.35 + 0.15 * R(), [[2400 + R() * 800, 0.02, 1], [4100 + R() * 600, 0.012, 0.6]]);
  }
  const bp = [new Biquad('highpass', 2600, 0.7, 0, sr), new Biquad('highpass', 2600, 0.7, 0, sr)];
  const pk = [new Biquad('peaking', 7000, 1, 6, sr), new Biquad('peaking', 7000, 1, 6, sr)];
  const lo = new Biquad('bandpass', 1100, 1, 0, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr - 0.42;
    let env = 0;
    if (t > 0) env = Math.min(1, t / 0.025) * (0.85 + 0.15 * Math.exp(-t / 0.3)) * Math.min(1, Math.max(0, (0.95 - t) / 0.08));
    const puff = t > 0 ? Math.exp(-t / 0.04) : 0;
    const w0 = R() * 2 - 1, w1 = R() * 2 - 1;
    const p = lo.tick(w0) * puff * 0.5;
    L[i] = rat[i] + pk[0].tick(bp[0].tick(w0)) * 0.35 * env + p;
    Rt[i] = rat[i] + pk[1].tick(bp[1].tick(w1)) * 0.35 * env + p;
  }
  normalize([L, Rt], 0.75);
  return fadeEdges([L, Rt], sr, 0.0005, 0.05);
}

function rNitroStart(sr, R) {
  const [L, Rt] = alloc(0.75, sr, 2);
  const n = L.length;
  const bp = [new Biquad('bandpass', 600, 0.9, 0, sr), new Biquad('bandpass', 600, 0.9, 0, sr)];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if ((i & 31) === 0) for (const b of bp) b.set('bandpass', 500 + 4500 * Math.min(1, t / 0.35), 0.9, 0, sr);
    const env = Math.min(1, t / 0.1) * Math.exp(-Math.max(0, t - 0.15) / 0.22);
    L[i] = bp[0].tick(R() * 2 - 1) * env;
    Rt[i] = bp[1].tick(R() * 2 - 1) * env;
  }
  const th = new Float32Array(n);
  sweepSine(th, sr, 0.01, 0.25, 85, 45, 0.5, 0.05);
  for (let i = 0; i < n; i++) { L[i] += th[i] * 0.3; Rt[i] += th[i] * 0.3; }
  normalize([L, Rt], 0.8);
  return fadeEdges([L, Rt], sr, 0.002, 0.05);
}

function rNitroPuff(sr, R) {
  const [o] = alloc(0.4, sr);
  const bp = new Biquad('bandpass', 1800, 0.8, 0, sr);
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    if ((i & 31) === 0) bp.set('bandpass', 2000 * Math.exp(-t * 4) + 700, 0.8, 0, sr);
    o[i] = bp.tick(R() * 2 - 1) * Math.min(1, t / 0.004) * Math.exp(-t / 0.09);
  }
  normalize([o], 0.8);
  return fadeEdges([o], sr, 0.001, 0.04);
}

// --- loop beds -------------------------------------------------------------

function rSqueal(sr, R) {
  const secs = 3.2, F = 0.15;
  const ch = alloc(secs + F, sr, 2);
  ch.forEach((o, c) => {
    const base = c ? 960 : 830; // two tyres: a slightly different pitch each
    const wander = wanderGen(R, 1.6, sr), wob = wanderGen(R, 8 + R() * 4, sr);
    const amp = wanderGen(R, 3.2, sr), flut = wanderGen(R, 26, sr);
    const bp = new Biquad('bandpass', base * 2, 6, 0, sr), hp = new Biquad('highpass', 2500, 0.7, 0, sr);
    let ph = 0, jump = 0, jt = 0;
    for (let i = 0; i < o.length; i++) {
      if (jt <= 0 && R() < 2 / sr) { jump = (R() < 0.5 ? 1 : -0.6) * (0.04 + R() * 0.08); jt = 0.05 + R() * 0.15; }
      if (jt > 0) jt -= 1 / sr; else jump *= 0.9995;
      const f = base * (1 + 0.06 * wander() + 0.016 * wob() + jump);
      ph += (TAU * f) / sr;
      // harmonics 1–4 via multiple-angle identities (two trig calls per sample)
      const sn = Math.sin(ph), cs = Math.cos(ph), s2 = sn * sn;
      const v = sn + 0.5 * sn * cs + 0.1 * sn * (3 - 4 * s2) + 0.2 * sn * cs * (1 - 2 * s2);
      if ((i & 63) === 0) bp.set('bandpass', 2 * f, 6, 0, sr);
      const w = R() * 2 - 1;
      const a = Math.max(0.15, 0.6 + 0.4 * amp());
      o[i] = (v * 0.55 * (1 + 0.2 * flut()) + bp.tick(w) * 1.6 + hp.tick(w) * 0.07) * a;
    }
  });
  return normalize(loopify(ch, sr, F), 0.9);
}

function rGravel(sr, R) {
  const secs = 2.6, F = 0.1;
  const ch = alloc(secs + F, sr, 1);
  ch.forEach((o) => {
    const count = Math.round((secs + F) * 950);
    for (let s = 0; s < count; s++) {
      const a = Math.pow(R(), 3) * 0.6 + 0.02;
      ping(o, R() * (o.length - 400), 800 + Math.pow(R(), 1.5) * 5200, 0.0015 + R() * 0.004, a, sr, R() * TAU);
    }
    const lp = new Biquad('lowpass', 380, 0.7, 0, sr), pk = pinkGen(R);
    for (let i = 0; i < o.length; i++) o[i] += lp.tick(pk()) * 0.9;
  });
  return normalize(rotStereo(loopify(ch, sr, F)[0], 0.47), 0.9);
}

function rGrind(sr, R) {
  const secs = 2.4, F = 0.12;
  const ch = alloc(secs + F, sr, 1);
  const modes = [1130, 1720, 2450, 3310, 4580, 5900, 7240, 8800].map((f, k) => [f * (0.97 + 0.06 * R()), 0.03 + 0.06 * R(), 1 / Math.sqrt(k + 1)]);
  ch.forEach((o) => {
    const n = o.length;
    const exc = new Float32Array(n);
    const slip = wanderGen(R, 34, sr), slow = wanderGen(R, 2.5, sr);
    for (let i = 0; i < n; i++) {
      const g = Math.max(0, slip() * 0.8 + 0.35 + 0.25 * slow());
      exc[i] = (R() * 2 - 1) * g * g;
    }
    for (let s = 0; s < (secs + F) * 260; s++) burst(exc, R() * (n - 200), 0.0003 + R() * 0.0008, 1.5 + R() * 2, R, 0.00002, sr); // sparks
    const met = modal(exc, new Float32Array(n), modes.map(([f, d, a]) => [f * (1 + (R() - 0.5) * 0.01), d, a]), sr);
    normalize([met], 1);
    const gr = new Biquad('bandpass', 3000, 0.8, 0, sr);
    const sw = wanderGen(R, 1.2, sr), sa = wanderGen(R, 4, sr);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const f = 2300 * (1 + 0.1 * sw());
      ph += (TAU * f) / sr;
      const scr = (Math.sin(ph) + 0.3 * Math.sin(2 * ph)) * 0.12 * Math.max(0, 0.4 + 0.6 * sa());
      o[i] = met[i] * 0.8 + gr.tick(exc[i]) * 0.9 + scr;
    }
  });
  return normalize(rotStereo(loopify(ch, sr, F)[0], 0.41), 0.9);
}

function rRain(sr, R) {
  const secs = 3, F = 0.15;
  const ch = alloc(secs + F, sr, 1);
  ch.forEach((o) => {
    const n = o.length;
    const pk = pinkGen(R), hp = new Biquad('highpass', 900, 0.7, 0, sr), lp = new Biquad('lowpass', 9000, 0.7, 0, sr);
    for (let i = 0; i < n; i++) o[i] = lp.tick(hp.tick(pk())) * 0.9;
    for (let s = 0; s < (secs + F) * 380; s++) {
      ping(o, R() * (n - 800), 2500 + R() * 4500, 0.0008 + R() * 0.002, Math.pow(R(), 2) * 0.25, sr, R() * TAU);
    }
    for (let s = 0; s < (secs + F) * 45; s++) {
      ping(o, R() * (n - 3000), 650 + R() * 1000, 0.006 + R() * 0.012, 0.08 + R() * 0.2, sr, R() * TAU);
    }
  });
  return normalize(rotStereo(loopify(ch, sr, F)[0], 0.5), 0.9);
}

function rCrowd(sr, R) {
  const secs = 6, F = 0.3;
  const ch = alloc(secs + F, sr, 1);
  ch.forEach((o) => {
    const n = o.length;
    // babble: speech-band noise in 6 bands, each with its own syllabic rhythm
    const bands = [300, 480, 760, 1150, 1700, 2600].map((f) => ({
      bp: new Biquad('bandpass', f * (0.9 + 0.2 * R()), 2.2, 0, sr), am: wanderGen(R, 3.5 + R() * 3.5, sr),
    }));
    const roar = new Biquad('bandpass', 700, 0.6, 0, sr), swell = wanderGen(R, 0.18, sr), rp = pinkGen(R);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (const b of bands) {
        const a = Math.max(0, 0.25 + 0.75 * b.am());
        v += b.bp.tick(R() * 2 - 1) * a * a * 1.2;
      }
      v += roar.tick(rp()) * (0.7 + 0.3 * swell()) * 1.2;
      o[i] = v;
    }
    // a few voices: buzzy glottal pulse through a moving vowel formant
    for (let k = 0; k < 5; k++) {
      const f0 = 110 + R() * 160, t0 = R() * secs, d = 0.4 + R() * 1.2;
      const fm = new Biquad('bandpass', 700, 4, 0, sr);
      const pw = wanderGen(R, 2.5, sr), vw = wanderGen(R, 4, sr);
      let ph = 0;
      for (let i = Math.round(t0 * sr), e = Math.min(n, Math.round((t0 + d) * sr)); i < e; i++) {
        const t = i / sr - t0;
        ph += (TAU * f0 * (1 + 0.08 * pw())) / sr;
        if ((i & 63) === 0) fm.set('bandpass', 900 + 600 * vw(), 4, 0, sr);
        const saw = (ph / TAU) % 1 * 2 - 1;
        o[i] += fm.tick(saw) * 0.25 * Math.min(1, t / 0.08, (d - t) / 0.12);
      }
    }
    // the odd whistle and a scatter of claps
    for (let k = 0; k < 2; k++) {
      const t0 = R() * (secs - 1);
      let ph = 0;
      for (let i = 0; i < 0.45 * sr; i++) {
        const t = i / sr;
        ph += (TAU * (2100 + 700 * Math.sin(Math.PI * t / 0.45))) / sr;
        o[Math.round(t0 * sr) + i] += Math.sin(ph) * 0.05 * Math.sin(Math.PI * t / 0.45);
      }
    }
    for (let k = 0; k < 40; k++) burst(o, R() * (n - 2000), 0.004, 0.15 * R(), R, 0.0002, sr);
  });
  return normalize(rotStereo(loopify(ch, sr, F)[0], 0.43), 0.85);
}

function rCrackle(sr, R) {
  const secs = 2, F = 0.05;
  const [o] = alloc(secs + F, sr);
  const n = o.length;
  let t = 0;
  while (t < secs + F - 0.01) {
    t += -Math.log(1 - R()) / 55;
    const dense = R() < 0.08;
    const cnt = dense ? 8 + Math.floor(R() * 20) : 1;
    for (let k = 0; k < cnt; k++) {
      const at = (t + (dense ? R() * 0.06 : 0)) * sr;
      if (at >= n - 200) continue;
      const a = Math.pow(R(), 2.5) * (dense ? 0.5 : 1);
      o[Math.round(at)] += a * (R() < 0.5 ? -1 : 1);
      ping(o, at, 2500 + R() * 4000, 0.0003 + R() * 0.0005, a * 0.6, sr, R() * TAU);
    }
  }
  new Biquad('highpass', 700, 0.7, 0, sr).run(o);
  return normalize(loopify([o], sr, F), 0.9);
}

function rWater(sr, R) {
  const secs = 6, F = 0.3;
  const ch = alloc(secs + F, sr, 1);
  ch.forEach((o) => {
    const n = o.length;
    const env = new Float32Array(n);
    let t = R() * 0.5;
    while (t < secs + F) {
      const a = 0.08 + R() * 0.2, d = 0.25 + R() * 0.45, g = 0.4 + 0.6 * R();
      for (let i = Math.round(t * sr), e = Math.min(n, Math.round((t + a + d * 5) * sr)); i < e; i++) {
        const x = i / sr - t;
        env[i] += g * (x < a ? Math.sin((Math.PI / 2) * (x / a)) : Math.exp(-(x - a) / d));
      }
      t += 0.35 + R() * 0.8;
    }
    const pk = pinkGen(R), bp = new Biquad('bandpass', 420, 0.8, 0, sr), lp = new Biquad('lowpass', 1300, 0.7, 0, sr);
    const sw = new Biquad('lowpass', 120, 0.7, 0, sr), slow = wanderGen(R, 0.3, sr);
    for (let i = 0; i < n; i++) {
      const w = pk();
      o[i] = lp.tick(bp.tick(w * env[i])) * 2.2 + sw.tick(w) * (0.5 + 0.4 * slow());
    }
    for (let k = 0; k < 28; k++) {
      // bubbly plips: short rising chirps
      const at = Math.round(R() * (n - 6000));
      const f0 = 380 + R() * 500, d = 0.012 + R() * 0.018;
      let ph = 0;
      for (let i = 0; i < d * 4 * sr; i++) {
        const x = i / sr;
        ph += (TAU * f0 * (1 + x / d * 0.6)) / sr;
        o[at + i] += Math.sin(ph) * 0.08 * Math.exp(-x / d);
      }
    }
  });
  return normalize(rotStereo(loopify(ch, sr, F)[0], 0.5), 0.85);
}

function rSiren(sr) {
  const [o] = alloc(7, sr);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    const f = (700 + 750 * (0.5 - 0.5 * Math.cos((TAU * t) / 3.1))) * (1 - 0.015 * t / 7);
    ph += (TAU * f) / sr;
    const env = Math.min(1, t / 1.5) * Math.min(1, (7 - t) / 2);
    o[i] = (Math.sin(ph) + 0.3 * Math.sin(3 * ph) + 0.12 * Math.sin(5 * ph)) * env;
  }
  new Biquad('bandpass', 1200, 0.7, 0, sr).run(o);
  new Biquad('lowpass', 2200, 0.7, 0, sr).run(o);
  return [normalize([o], 0.9)[0]];
}

function rFoghorn(sr, R) {
  const [o] = alloc(5.5, sr);
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    const vib = 1 + 0.004 * Math.sin(TAU * 4.5 * t);
    a += (87 * vib) / sr; b += (87.7 * vib) / sr; c += (174.3 * vib) / sr;
    const saw = (p) => 2 * (p % 1) - 1;
    const env = Math.min(1, t / 0.35) * (t < 3.3 ? 1 : Math.exp(-(t - 3.3) / 0.5));
    o[i] = (saw(a) + saw(b) + 0.5 * saw(c)) * env;
  }
  new Biquad('lowpass', 480, 0.9, 0, sr).run(o);
  new Biquad('lowpass', 900, 0.7, 0, sr).run(o);
  return [normalize(fadeEdges([o], sr, 0.01, 0.2), 0.9)[0]];
}

function rHawk(sr, R) {
  const [o] = alloc(1.5, sr);
  let ph = 0;
  const br = wanderGen(R, 45, sr);
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    const f = t < 0.08 ? 2550 + 450 * (t / 0.08) : 3000 - 800 * Math.min(1, (t - 0.08) / 1.0);
    ph += (TAU * f * (1 + 0.025 * Math.sin(TAU * 38 * t))) / sr;
    const env = Math.min(1, t / 0.04) * Math.min(1, Math.max(0, (1.25 - t) / 0.3));
    o[i] = (Math.sin(ph) + 0.3 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph)) * env * (0.75 + 0.25 * br());
  }
  new Biquad('lowpass', 6500, 0.7, 0, sr).run(o);
  return [normalize([o], 0.9)[0]];
}

// distant PA announcer: buzzy voice through moving vowel formants, horn-limited
function rPa(sr, R) {
  const [o] = alloc(3.4, sr);
  const n = o.length;
  const V = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [660, 1720]];
  const f1 = new Biquad('bandpass', 700, 5, 0, sr), f2 = new Biquad('bandpass', 1200, 6, 0, sr);
  let ph = 0, syl = 0, sylEnd = 0, cur = V[0], prev = V[0], sylStart = 0;
  const phrases = [[0.1, 1.3], [1.6, 3.1]];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const inPhrase = phrases.some(([a, b]) => t > a && t < b);
    if (t >= sylEnd) { prev = cur; cur = V[(R() * V.length) | 0]; sylStart = t; sylEnd = t + 0.11 + R() * 0.14; syl++; }
    const k = Math.min(1, (t - sylStart) / 0.04);
    const F1 = prev[0] + (cur[0] - prev[0]) * k, F2 = prev[1] + (cur[1] - prev[1]) * k;
    if ((i & 31) === 0) { f1.set('bandpass', F1, 5, 0, sr); f2.set('bandpass', F2, 6, 0, sr); }
    const pitch = 125 * (1 + 0.12 * Math.sin(t * 2.1) - 0.08 * ((t % 1.5) / 1.5));
    ph += (TAU * pitch) / sr;
    const src = ((ph / TAU) % 1) * 2 - 1;
    const se = Math.sin(Math.PI * Math.min(1, (t - sylStart) / (sylEnd - sylStart)));
    const cons = (t - sylStart) < 0.03 ? (R() * 2 - 1) * 0.4 : 0;
    o[i] = inPhrase ? (f1.tick(src) * 1.6 + f2.tick(src) + cons) * se : f1.tick(0) + f2.tick(0);
  }
  new Biquad('highpass', 400, 0.7, 0, sr).run(o);
  new Biquad('lowpass', 3200, 0.7, 0, sr).run(o);
  for (let i = 0; i < n; i++) o[i] = Math.tanh(o[i] * 3);
  return [normalize(fadeEdges([o], sr, 0.01, 0.1), 0.85)[0]];
}

// name → [variants, renderer, sample-rate divisor for band-limited material]
const SHOTS = {
  'impact:car': [3, (sr, R) => rImpact(sr, R, 'car')],
  'impact:wall': [3, (sr, R) => rImpact(sr, R, 'wall')],
  'impact:object': [3, (sr, R) => rImpact(sr, R, 'object')],
  glass: [3, rGlass],
  landing: [2, rLanding],
  shift: [3, rShift],
  beep: [1, (sr, R) => rBeep(sr, R, false)],
  go: [1, (sr, R) => rBeep(sr, R, true)],
  'ui:move': [1, (sr, R) => rUi(sr, R, 'move')],
  'ui:select': [1, (sr, R) => rUi(sr, R, 'select')],
  'ui:back': [1, (sr, R) => rUi(sr, R, 'back')],
  'ui:error': [1, (sr, R) => rUi(sr, R, 'error')],
  'ui:tab': [1, (sr, R) => rUi(sr, R, 'tab')],
  'ui:buy': [1, (sr, R) => rUi(sr, R, 'buy')],
  'ui:unlock': [1, (sr, R) => rUi(sr, R, 'unlock')],
  knob: [3, rKnob],
  tvOn: [1, rTvOn],
  tvOff: [1, rTvOff],
  phone: [1, rPhone, 2],
  whoosh: [4, (sr, R, i) => rWhoosh(sr, R, i % 2)],
  checkpoint: [1, rCheckpoint],
  'horn:car': [1, (sr, R) => rHorn(sr, R, false)],
  'horn:truck': [1, (sr, R) => rHorn(sr, R, true)],
  engineStart: [1, rEngineStart, 2],
  airWrench: [1, rAirWrench],
  spray: [1, rSpray],
  nitroStart: [1, rNitroStart],
  nitroPuff: [1, rNitroPuff],
  squeal: [1, rSqueal, 2],
  gravel: [1, rGravel, 2],
  grind: [1, rGrind],
  rain: [1, rRain, 2],
  crowd: [1, rCrowd, 2],
  crackle: [1, rCrackle],
  water: [1, rWater, 4],
  siren: [1, rSiren, 4],
  foghorn: [1, rFoghorn, 4],
  hawk: [1, rHawk],
  pa: [1, rPa, 2],
};

// warm-up order: menu sounds first, then race essentials, then beds
const WARM_ORDER = [
  'ui:move', 'ui:select', 'ui:back', 'ui:tab', 'knob', 'crackle', 'ui:error', 'tvOn', 'tvOff', 'phone', 'ui:buy', 'ui:unlock',
  'beep', 'go', 'shift', 'squeal', 'gravel', 'impact:car', 'impact:wall', 'impact:object', 'glass', 'whoosh', 'landing',
  'grind', 'nitroStart', 'nitroPuff', 'checkpoint', 'horn:car', 'horn:truck', 'rain', 'crowd', 'water', 'siren', 'foghorn',
  'hawk', 'pa', 'engineStart', 'airWrench', 'spray',
];

const SURF = {
  dirt: { lp: 5200, hp: 160, g: 1, rate: 1 },
  sand: { lp: 2300, hp: 90, g: 0.8, rate: 0.75 },
  grass: { lp: 7500, hp: 1100, g: 0.55, rate: 1.3 },
};

// ambience beds: level + builder + rare events [name, minGap, maxGap, gain, wet]
const BEDS = {
  city: { level: 0.22, events: [['siren', 30, 75, 0.07, 1.2], ['horn:car', 12, 35, 0.035, 0.9]] },
  docks: { level: 0.26, events: [['foghorn', 28, 65, 0.1, 1.4]] },
  mountain: { level: 0.22, events: [] },
  desert: { level: 0.2, events: [['hawk', 35, 90, 0.05, 0.9]] },
  highway: { level: 0.22, events: [['whoosh', 5, 14, 0.1, 0.25]] },
  circuit: { level: 0.2, events: [['pa', 22, 55, 0.08, 1.4]] },
};

// ===========================================================================

class Sfx {
  constructor() {
    this._ctx = null;
  }

  /** True when an AudioContext exists; (re)initialises per-context state. */
  _ok() {
    const ctx = audio.ctx;
    if (!ctx) return false;
    if (ctx !== this._ctx) this._setup(ctx);
    return true;
  }

  _setup(ctx) {
    if (this._bed) this._bed.alive = false; // a previous context's bed must not reschedule
    this._ctx = ctx;
    this._bufs = new Map();
    this._loops = {};
    this._bed = null;
    this._bedName = null;
    this._nitroOn = false;
    this._speed = 0;
    this._live = 0;
    this._lastImpact = -1;
    this._lastImpactS = 0;
    this._lastKnob = -1;
    this._warmIdx = 0;
    // offline (test) contexts don't background-warm; realtime ones fill the cache when idle
    if (typeof ctx.startRendering !== 'function' && typeof setTimeout === 'function') {
      setTimeout(() => this._warmStep(ctx), 400);
    }
  }

  _warmStep(ctx) {
    if (ctx !== this._ctx) return;
    while (this._warmIdx < WARM_ORDER.length && this._ready(WARM_ORDER[this._warmIdx])) this._warmIdx++;
    if (this._warmIdx >= WARM_ORDER.length) return;
    this._renderOne(WARM_ORDER[this._warmIdx]); // one variant per slice keeps each task short
    const next = () => this._warmStep(ctx);
    if (typeof requestIdleCallback === 'function') requestIdleCallback(next, { timeout: 500 });
    else setTimeout(next, 30);
  }

  /** Render every buffer now (e.g. behind a loading screen). */
  prewarm() {
    if (!this._ok()) return;
    for (const k of WARM_ORDER) this._get(k);
  }

  // variants render one at a time from a per-name seeded generator
  _renderOne(name) {
    let e = this._bufs.get(name);
    if (!e) this._bufs.set(name, (e = { list: [], R: rng(hash(name)) }));
    const [count, fn, div = 1] = SHOTS[name];
    const rate = this._ctx.sampleRate / div;
    if (e.list.length < count) e.list.push(toBuffer(this._ctx, fn(rate, e.R, e.list.length), rate));
    return e;
  }

  _ready(name) {
    const e = this._bufs.get(name);
    return !!e && e.list.length >= SHOTS[name][0];
  }

  _get(name) {
    let e = this._bufs.get(name);
    while (!e || e.list.length < SHOTS[name][0]) e = this._renderOne(name);
    return e.list;
  }

  _pick(name) {
    const v = this._get(name);
    return v[(Math.random() * v.length) | 0];
  }

  /** Fire-and-forget buffer playback; every node is released when it ends. */
  _play(name, { bus = audio.sfxBus, gain = 1, rate = 1, pan = 0, rev = 0, lp = 0, when = 0 } = {}) {
    const ctx = this._ctx;
    const s = ctx.createBufferSource();
    s.buffer = typeof name === 'string' ? this._pick(name) : name;
    s.playbackRate.value = rate;
    const nodes = [s];
    let node = s;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      node = node.connect(f);
      nodes.push(f);
    }
    const g = ctx.createGain();
    g.gain.value = gain;
    node = node.connect(g);
    nodes.push(g);
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      node = node.connect(p);
      nodes.push(p);
    }
    node.connect(bus);
    if (rev) {
      const r = ctx.createGain();
      r.gain.value = rev;
      node.connect(r).connect(audio.reverbSend);
      nodes.push(r);
    }
    this._live++;
    s.onended = () => {
      this._live--;
      for (const x of nodes) x.disconnect();
    };
    s.start(Math.max(when, ctx.currentTime));
    return s;
  }

  /** Number of one-shot voices currently playing (for leak checks). */
  get activeVoices() { return this._live || 0; }

  // ---- continuous-loop plumbing -------------------------------------------

  _loop(name, bus, build) {
    let L = this._loops[name];
    if (L) return L;
    const ctx = this._ctx;
    L = { name, nodes: [], srcs: [], memo: new Float64Array(16).fill(NaN), idle: null };
    L.out = this._n(L, ctx.createGain());
    L.out.gain.value = 0;
    L.out.connect(bus);
    L.src = (buf, rate = 1) => {
      const s = this._n(L, ctx.createBufferSource());
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      s.start(ctx.currentTime, Math.random() * buf.duration * 0.9);
      L.srcs.push(s);
      return s;
    };
    L.filt = (type, f, q = 0.707) => {
      const b = krate(this._n(L, ctx.createBiquadFilter()));
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      return b;
    };
    L.gain = (v = 0) => {
      const g = this._n(L, ctx.createGain());
      g.gain.value = v;
      return g;
    };
    L.noise = (color) => L.src(audio.noise(color));
    L.osc = (type, f) => {
      const o = krate(this._n(L, ctx.createOscillator()));
      o.type = type;
      o.frequency.value = f;
      o.start();
      L.srcs.push(o);
      return o;
    };
    build(L, ctx);
    L.out.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
    this._loops[name] = L;
    return L;
  }

  _n(L, node) {
    L.nodes.push(node);
    return node;
  }

  _drop(L, fade = 0.1) {
    if (!L || L.dead) return;
    L.dead = true;
    if (this._loops[L.name] === L) delete this._loops[L.name];
    const t = this._ctx.currentTime;
    L.out.gain.cancelScheduledValues(t);
    L.out.gain.setTargetAtTime(0, t, fade / 5);
    const end = t + fade + 0.05;
    for (const s of L.srcs) {
      try { s.stop(end); } catch { /* not started */ }
    }
    const done = () => { for (const n of L.nodes) n.disconnect(); };
    if (L.srcs.length) L.srcs[0].onended = done;
    else done();
  }

  // drop loops that have been silent a while (they rebuild on the next non-zero call)
  _idle(L, active) {
    if (active) { L.idle = null; return; }
    const t = this._ctx.currentTime;
    if (L.idle == null) L.idle = t;
    else if (t - L.idle > 2.5) this._drop(L, 0.05);
  }

  _set(L, i, param, v, tc = 0.05, rel = 0.004) {
    setSmooth(L.memo, i, param, v, this._ctx.currentTime, tc, rel);
  }

  // ---- continuous effects --------------------------------------------------

  skid(amount = 0, surface = 'asphalt') {
    if (!this._ok()) return;
    const a = clamp(+amount || 0, 0, 1);
    let L = this._loops.skid;
    if (!L) {
      if (a < 0.002) return;
      L = this._loop('skid', audio.sfxBus, (L) => {
        L.sq = L.src(this._get('squeal')[0]);
        L.sqLp = L.filt('lowpass', 4000, 0.6);
        L.gSq = L.gain();
        L.sq.connect(L.sqLp).connect(L.gSq).connect(L.out);
        L.lo = L.src(this._get('gravel')[0]);
        L.loHp = L.filt('highpass', 150);
        L.loLp = L.filt('lowpass', 5000);
        L.gLo = L.gain();
        L.lo.connect(L.loHp).connect(L.loLp).connect(L.gLo).connect(L.out);
        L.wander = 0;
      });
    }
    const s = SURF[surface];
    L.wander = clamp(L.wander * 0.96 + (Math.random() - 0.5) * 0.12, -1, 1);
    this._set(L, 0, L.gSq.gain, s ? 0 : Math.pow(a, 1.3) * 0.5);
    this._set(L, 1, L.sq.playbackRate, (0.9 + 0.18 * a) * (1 + 0.035 * L.wander), 0.08, 0.002);
    this._set(L, 2, L.sqLp.frequency, 2500 + 7000 * a, 0.08, 0.02);
    this._set(L, 3, L.gLo.gain, s ? Math.pow(a, 1.1) * 0.6 * s.g : 0);
    if (s) {
      this._set(L, 4, L.lo.playbackRate, s.rate * (0.8 + 0.45 * a), 0.08, 0.004);
      this._set(L, 5, L.loLp.frequency, s.lp, 0.1, 0.02);
      this._set(L, 6, L.loHp.frequency, s.hp, 0.1, 0.02);
    }
    this._idle(L, a > 0.002);
  }

  wind(speedMps = 0) {
    if (!this._ok()) return;
    const v = Math.max(0, +speedMps || 0);
    this._speed = v; // rumble() takes its rhythm from the latest speed
    const lvl = 0.3 * Math.pow(clamp((v - 6) / 64, 0, 1.4), 2.2);
    let L = this._loops.wind;
    if (!L) {
      if (lvl < 0.0005) return;
      L = this._loop('wind', audio.sfxBus, (L) => {
        const nz = L.noise('pink');
        L.bp = L.filt('bandpass', 400, 0.5);
        L.gust = L.gain(0.8);
        L.g = L.gain();
        nz.connect(L.bp).connect(L.gust).connect(L.g).connect(L.out);
        L.osc('sine', 0.13).connect(L.gain(0.14)).connect(L.gust.gain);
        L.osc('sine', 0.31).connect(L.gain(0.07)).connect(L.gust.gain);
        L.osc('sine', 0.07).connect(L.gain(90)).connect(L.bp.frequency);
      });
    }
    this._set(L, 0, L.g.gain, lvl, 0.08);
    this._set(L, 1, L.bp.frequency, 280 + v * 13, 0.15, 0.01);
    this._idle(L, lvl >= 0.0005);
  }

  roll(speedMps = 0, surface = 'asphalt') {
    if (!this._ok()) return;
    const v = Math.max(0, +speedMps || 0);
    this._speed = v;
    const s = SURF[surface];
    const road = 0.22 * Math.pow(clamp(v / 45, 0, 1.5), 1.2) * (s ? 0.5 : 1);
    const hum = s ? 0 : 0.05 * Math.pow(clamp(v / 40, 0, 1.5), 1.5);
    const loose = s ? 0.42 * s.g * Math.pow(clamp(v / 22, 0, 1), 0.7) : 0;
    let L = this._loops.roll;
    if (!L) {
      if (road + loose < 0.0005) return;
      L = this._loop('roll', audio.sfxBus, (L) => {
        L.lp = L.filt('lowpass', 300, 0.7);
        L.gRoad = L.gain();
        L.noise('brown').connect(L.lp).connect(L.gRoad).connect(L.out);
        L.hb = L.filt('bandpass', 600, 1.2);
        L.gHum = L.gain();
        L.noise('pink').connect(L.hb).connect(L.gHum).connect(L.out);
        L.gr = L.src(this._get('gravel')[0]);
        L.grHp = L.filt('highpass', 150);
        L.grLp = L.filt('lowpass', 5000);
        L.gLo = L.gain();
        L.gr.connect(L.grHp).connect(L.grLp).connect(L.gLo).connect(L.out);
      });
    }
    this._set(L, 0, L.gRoad.gain, road);
    this._set(L, 1, L.lp.frequency, 140 + v * 8, 0.1, 0.01);
    this._set(L, 2, L.gHum.gain, hum);
    this._set(L, 3, L.hb.frequency, 450 + v * 7, 0.1, 0.01);
    this._set(L, 4, L.gLo.gain, loose);
    if (s) {
      this._set(L, 5, L.gr.playbackRate, s.rate * (0.6 + clamp(v / 40, 0, 1) * 0.7), 0.1);
      this._set(L, 6, L.grLp.frequency, s.lp * 0.8, 0.1, 0.02);
      this._set(L, 7, L.grHp.frequency, s.hp, 0.1, 0.02);
    }
    this._idle(L, road + loose >= 0.0005);
  }

  rumble(amount = 0) {
    if (!this._ok()) return;
    const a = clamp(+amount || 0, 0, 1);
    let L = this._loops.rumble;
    if (!L) {
      if (a < 0.002) return;
      L = this._loop('rumble', audio.sfxBus, (L, ctx) => {
        // thump train: narrow pulses (flat harmonics) at curb-block rate
        L.o = L.osc('sine', 40);
        const imag = new Float32Array([0, 1, 1, 0.9, 0.8, 0.65, 0.5, 0.35, 0.2]);
        L.o.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(imag.length), imag));
        L.amt = L.gain(0);
        L.amt.connect(L.out);
        L.o.connect(L.filt('lowpass', 320, 0.9)).connect(L.gain(0.6)).connect(L.amt);
        // chassis rattle chopped by the same rhythm
        const am = L.gain(0.35);
        L.o.connect(L.gain(0.4)).connect(am.gain);
        L.noise('brown').connect(L.filt('bandpass', 170, 1)).connect(am).connect(L.gain(0.9)).connect(L.amt);
      });
    }
    this._set(L, 0, L.o.frequency, clamp(this._speed / 0.6, 6, 110), 0.05, 0.01);
    this._set(L, 1, L.amt.gain, a * 0.38);
    this._idle(L, a > 0.002);
  }

  scrape(amount = 0) {
    if (!this._ok()) return;
    const a = clamp(+amount || 0, 0, 1);
    let L = this._loops.scrape;
    if (!L) {
      if (a < 0.002) return;
      L = this._loop('scrape', audio.sfxBus, (L) => {
        L.s = L.src(this._get('grind')[0]);
        L.g = L.gain();
        L.s.connect(L.filt('highpass', 250)).connect(L.g).connect(L.out);
        L.w = 0;
      });
    }
    L.w = clamp(L.w * 0.95 + (Math.random() - 0.5) * 0.15, -1, 1);
    this._set(L, 0, L.g.gain, Math.pow(a, 1.2) * 0.42, 0.04);
    this._set(L, 1, L.s.playbackRate, (0.85 + 0.3 * a) * (1 + 0.04 * L.w), 0.06, 0.002);
    this._idle(L, a > 0.002);
  }

  nitro(on) {
    if (!this._ok()) return;
    on = !!on;
    let L = this._loops.nitro;
    if (on && !this._nitroOn) {
      this._play('nitroStart', { gain: 0.55, rev: 0.05 });
      if (!L) {
        L = this._loop('nitro', audio.sfxBus, (L) => {
          L.g = L.gain();
          const fl = L.gain(0.85);
          L.osc('sine', 11).connect(L.gain(0.12)).connect(fl.gain);
          L.noise('white').connect(L.filt('highpass', 2200)).connect(L.filt('peaking', 6500, 1)).connect(fl).connect(L.g).connect(L.out);
        });
      }
    } else if (!on && this._nitroOn) {
      this._play('nitroPuff', { gain: 0.4 });
    }
    this._nitroOn = on;
    if (L) {
      this._set(L, 0, L.g.gain, on ? 0.13 : 0, on ? 0.08 : 0.04);
      this._idle(L, on);
    }
  }

  rain(level = 0) {
    if (!this._ok()) return;
    const a = clamp(+level || 0, 0, 1);
    let L = this._loops.rain;
    if (!L) {
      if (a < 0.002) return;
      L = this._loop('rain', audio.sfxBus, (L) => {
        L.lp = L.filt('lowpass', 6000, 0.6);
        L.g = L.gain();
        L.src(this._get('rain')[0]).connect(L.lp).connect(L.g).connect(L.out);
      });
    }
    this._set(L, 0, L.g.gain, Math.pow(a, 0.8) * 0.3, 0.15);
    this._set(L, 1, L.lp.frequency, 2500 + 8500 * a, 0.2, 0.02);
    this._idle(L, a > 0.002);
  }

  crowd(level = 0) {
    if (!this._ok()) return;
    const a = clamp(+level || 0, 0, 1);
    let L = this._loops.crowd;
    if (!L) {
      if (a < 0.002) return;
      L = this._loop('crowd', audio.sfxBus, (L) => {
        L.g = L.gain();
        const sw = L.gain(0.85);
        L.osc('sine', 0.05).connect(L.gain(0.1)).connect(sw.gain);
        L.osc('sine', 0.13).connect(L.gain(0.06)).connect(sw.gain);
        L.src(this._get('crowd')[0]).connect(sw).connect(L.g).connect(L.out);
      });
    }
    this._set(L, 0, L.g.gain, a * 0.32, 0.2);
    this._idle(L, a > 0.002);
  }

  radioStatic(level = 0) {
    if (!this._ok()) return;
    const a = clamp(+level || 0, 0, 1);
    let L = this._loops.radio;
    if (!L) {
      if (a < 0.002) return;
      L = this._loop('radio', audio.uiBus, (L) => {
        const am = L.gain(0.75);
        L.osc('sine', 5.3).connect(L.gain(0.18)).connect(am.gain);
        L.noise('white').connect(L.filt('bandpass', 2400, 0.35)).connect(am).connect(L.gain(0.9)).connect(L.out);
        L.src(this._get('crackle')[0]).connect(L.filt('highpass', 700)).connect(L.gain(0.5)).connect(L.out);
        // heterodyne whistle drifting around ~1.6 kHz
        const wh = L.osc('sine', 1650);
        L.osc('sine', 0.23).connect(L.gain(90)).connect(wh.frequency);
        L.osc('sine', 0.71).connect(L.gain(25)).connect(wh.frequency);
        wh.connect(L.gain(0.035)).connect(L.out); // out carries the level
      });
    }
    this._set(L, 0, L.out.gain, a * 0.3, 0.06);
    this._idle(L, a > 0.002);
  }

  ambience(env) {
    if (!this._ok()) return;
    const name = BEDS[env] ? env : null;
    if (name === this._bedName) return;
    if (this._bed) this._killBed(this._bed, 1.5);
    this._bedName = name;
    this._bed = name ? this._makeBed(name) : null;
  }

  _makeBed(name) {
    const ctx = this._ctx;
    const def = BEDS[name];
    const B = { name, alive: true, nodes: [], srcs: [], pending: new Set() };
    const mk = (n) => { B.nodes.push(n); return n; };
    const gain = (v) => { const g = mk(ctx.createGain()); g.gain.value = v; return g; };
    const filt = (type, f, q = 0.707) => {
      const b = krate(mk(ctx.createBiquadFilter()));
      b.type = type; b.frequency.value = f; b.Q.value = q;
      return b;
    };
    const src = (buf) => {
      const s = mk(ctx.createBufferSource());
      s.buffer = buf; s.loop = true;
      s.start(ctx.currentTime, Math.random() * buf.duration * 0.9);
      B.srcs.push(s);
      return s;
    };
    const osc = (f) => { const o = krate(mk(ctx.createOscillator())); o.frequency.value = f; o.start(); B.srcs.push(o); return o; };
    B.out = gain(0);
    B.out.connect(audio.sfxBus);
    B.wet = gain(0); // event reverb follows the bed fade
    B.wet.connect(audio.reverbSend);
    B.ev = gain(1);
    B.ev.connect(B.out);
    const t = ctx.currentTime;
    // wind with slow gusts plus a thin whistling band
    const wind = (center, whistle) => {
      const bp = filt('bandpass', center, 0.6);
      const gust = gain(0.7);
      src(audio.noise('pink')).connect(bp).connect(gust);
      gust.connect(gain(1.1)).connect(B.out);
      osc(0.09).connect(gain(0.2)).connect(gust.gain);
      osc(0.21).connect(gain(0.12)).connect(gust.gain);
      osc(0.06).connect(gain(center * 0.3)).connect(bp.frequency);
      const wb = filt('bandpass', whistle, 9);
      src(audio.noise('white')).connect(wb).connect(gain(0.35)).connect(gust);
      osc(0.05).connect(gain(whistle * 0.2)).connect(wb.frequency);
    };
    switch (name) {
      case 'city': {
        src(audio.noise('brown')).connect(filt('lowpass', 200)).connect(gain(0.7)).connect(B.out);
        const am = gain(0.8);
        osc(0.17).connect(gain(0.2)).connect(am.gain);
        src(audio.noise('pink')).connect(filt('bandpass', 650, 0.5)).connect(am).connect(gain(0.35)).connect(B.out);
        break;
      }
      case 'docks':
        src(this._get('water')[0]).connect(gain(0.8)).connect(B.out);
        src(audio.noise('pink')).connect(filt('lowpass', 300)).connect(gain(0.25)).connect(B.out);
        break;
      case 'mountain': wind(420, 1100); break;
      case 'desert': wind(650, 1500); break;
      case 'highway':
        src(audio.noise('pink')).connect(filt('bandpass', 520, 0.4)).connect(gain(0.8)).connect(B.out);
        src(audio.noise('brown')).connect(filt('lowpass', 150)).connect(gain(0.5)).connect(B.out);
        break;
      case 'circuit':
        src(this._get('crowd')[0]).connect(filt('lowpass', 900)).connect(gain(0.55)).connect(B.out);
        src(audio.noise('pink')).connect(filt('lowpass', 300)).connect(gain(0.15)).connect(B.out);
        break;
    }
    B.out.gain.setTargetAtTime(def.level, t, 0.6);
    B.wet.gain.setTargetAtTime(1, t, 0.6);
    for (const ev of def.events) this._bedEvent(B, ...ev);
    return B;
  }

  // schedule one rare event in the future; when it ends, schedule the next
  _bedEvent(B, name, minGap, maxGap, gain, wet) {
    if (!B.alive) return;
    const ctx = this._ctx;
    const s = ctx.createBufferSource();
    s.buffer = this._pick(name);
    s.playbackRate.value = 0.92 + Math.random() * 0.16;
    const g = ctx.createGain();
    g.gain.value = gain * (0.6 + 0.4 * Math.random());
    const p = ctx.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2500 + Math.random() * 2500; // distance
    const w = ctx.createGain();
    w.gain.value = wet * gain;
    s.connect(lp).connect(g).connect(p).connect(B.ev);
    lp.connect(w).connect(B.wet);
    B.pending.add(s);
    s.onended = () => {
      B.pending.delete(s);
      for (const n of [s, lp, g, p, w]) n.disconnect();
      this._bedEvent(B, name, minGap, maxGap, gain, wet);
    };
    s.start(ctx.currentTime + minGap + Math.random() * (maxGap - minGap));
  }

  _killBed(B, fade) {
    if (!B.alive) return;
    B.alive = false;
    const t = this._ctx.currentTime;
    for (const g of [B.out.gain, B.wet.gain]) {
      g.cancelScheduledValues(t);
      g.setTargetAtTime(0, t, fade / 5);
    }
    const end = t + fade + 0.05;
    for (const s of B.pending) {
      try { s.stop(end); } catch { /* ignore */ }
    }
    for (const s of B.srcs) s.stop(end);
    B.srcs[0].onended = () => { for (const n of B.nodes) n.disconnect(); };
  }

  /** Silence every continuous loop and the ambience bed (between screens). */
  stopAll() {
    if (!this._ok()) return;
    for (const L of Object.values(this._loops)) this._drop(L, 0.12);
    this._nitroOn = false;
    if (this._bed) this._killBed(this._bed, 0.4);
    this._bed = null;
    this._bedName = null;
  }

  // ---- one-shots -------------------------------------------------------------

  impact(strength = 0.5, kind = 'car') {
    if (!this._ok()) return;
    const s = clamp(+strength || 0, 0, 1);
    if (s <= 0.01) return;
    const t = this._ctx.currentTime;
    // rate-limit scraping contact spam: only a clearly harder hit retriggers quickly
    if (t - this._lastImpact < 0.07 && s < this._lastImpactS * 1.3) return;
    this._lastImpact = t;
    this._lastImpactS = s;
    const k = kind === 'wall' || kind === 'object' ? kind : 'car';
    this._play(`impact:${k}`, {
      gain: 0.18 + 0.57 * Math.pow(s, 0.8),
      rate: (k === 'object' ? 1.05 : 0.95) + (1 - s) * 0.12 + Math.random() * 0.08,
      lp: 1800 + 16000 * s * s,
      pan: (Math.random() - 0.5) * 0.3,
      rev: 0.12 + 0.12 * s,
    });
    if (s > 0.55 && k !== 'object') {
      this._play('glass', { gain: 0.2 + 0.3 * (s - 0.55) / 0.45, rate: 0.9 + Math.random() * 0.2, pan: (Math.random() - 0.5) * 0.6, rev: 0.12, when: t + 0.01 });
    }
  }

  landing(strength = 0.5) {
    if (!this._ok()) return;
    const s = clamp(+strength || 0, 0, 1);
    if (s <= 0.01) return;
    this._play('landing', { gain: 0.25 + 0.7 * s, rate: 0.9 + Math.random() * 0.15, lp: 900 + 9000 * s, rev: 0.05 });
  }

  shift() {
    if (!this._ok()) return;
    this._play('shift', { gain: 0.45, rate: 0.92 + Math.random() * 0.16 });
  }

  countdown(n) {
    if (!this._ok()) return;
    this._play(n > 0 ? 'beep' : 'go', { gain: 0.6, rev: 0.12 });
  }

  ui(name = 'move') {
    if (!this._ok()) return;
    const key = `ui:${name}`;
    if (!SHOTS[key]) return;
    this._play(key, { bus: audio.uiBus, gain: name === 'buy' || name === 'unlock' ? 0.6 : 0.5, rate: name === 'move' ? 0.98 + Math.random() * 0.04 : 1 });
  }

  knob() {
    if (!this._ok()) return;
    const t = this._ctx.currentTime;
    if (t - this._lastKnob < 0.025) return;
    this._lastKnob = t;
    this._play('knob', { bus: audio.uiBus, gain: 0.55, rate: 0.95 + Math.random() * 0.1 });
  }

  /** TV static "channel change" whoosh for `seconds`. */
  staticBurst(seconds = 0.35) {
    if (!this._ok()) return;
    const ctx = this._ctx, t = ctx.currentTime;
    const d = clamp(+seconds || 0.35, 0.05, 6);
    const s = ctx.createBufferSource();
    s.buffer = audio.noise('white');
    s.loop = true;
    const bp = krate(ctx.createBiquadFilter());
    bp.type = 'bandpass';
    bp.Q.value = 0.55;
    bp.frequency.setValueAtTime(1300, t);
    bp.frequency.exponentialRampToValueAtTime(4800, t + Math.min(0.12, d * 0.4));
    bp.frequency.exponentialRampToValueAtTime(2400, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.42, t + 0.015);
    g.gain.setTargetAtTime(0.3, t + 0.03, 0.05);
    g.gain.setTargetAtTime(0, t + d * 0.8, Math.min(0.08, Math.max(0.004, d * 0.06)));
    const c = ctx.createBufferSource();
    c.buffer = this._pick('crackle');
    c.loop = true;
    const cg = ctx.createGain();
    cg.gain.value = 0.45;
    s.connect(bp).connect(g).connect(audio.uiBus);
    c.connect(cg).connect(g);
    s.start(t, Math.random());
    c.start(t, Math.random());
    s.stop(t + d + 0.25);
    c.stop(t + d + 0.25);
    this._live++;
    s.onended = () => { this._live--; for (const n of [s, bp, g, c, cg]) n.disconnect(); };
  }

  tvOn() { if (this._ok()) this._play('tvOn', { bus: audio.uiBus, gain: 0.6 }); }
  tvOff() { if (this._ok()) this._play('tvOff', { bus: audio.uiBus, gain: 0.6 }); }
  phone() { if (this._ok()) this._play('phone', { bus: audio.uiBus, gain: 0.55 }); }

  whoosh(strength = 0.5) {
    if (!this._ok()) return;
    const s = clamp(+strength || 0, 0, 1);
    if (s <= 0.01) return;
    this._play('whoosh', { gain: 0.15 + 0.55 * s, rate: 0.85 + 0.35 * s + Math.random() * 0.08, rev: 0.08 });
  }

  checkpoint() { if (this._ok()) this._play('checkpoint', { gain: 0.5, rev: 0.15 }); }

  /** Kart-style drift: the mini-turbo charging up a level, and firing. */
  driftCharge(level = 1) {
    if (!this._ok()) return;
    this._play('nitroPuff', { gain: 0.18 + 0.06 * level, rate: 1.25 + 0.25 * level });
  }

  miniTurbo(level = 1) {
    if (!this._ok()) return;
    const k = clamp(level / 3, 0, 1);
    this._play('nitroStart', { gain: 0.35 + 0.3 * k, rate: 1.15 - 0.15 * k, rev: 0.06 });
    this._play('whoosh', { gain: 0.25 + 0.3 * k, rate: 1.1 + 0.2 * k, rev: 0.06 });
  }

  horn(kind = 'car') {
    if (!this._ok()) return;
    this._play(kind === 'truck' ? 'horn:truck' : 'horn:car', { gain: 0.45, rate: 0.98 + Math.random() * 0.04, rev: 0.2 });
  }

  engineStart() { if (this._ok()) this._play('engineStart', { gain: 0.6, rev: 0.06 }); }
  airWrench() { if (this._ok()) this._play('airWrench', { gain: 0.5, rate: 0.95 + Math.random() * 0.1, rev: 0.08 }); }
  spray() { if (this._ok()) this._play('spray', { gain: 0.45, rate: 0.97 + Math.random() * 0.06, rev: 0.05 }); }
}

export const sfx = new Sfx();
