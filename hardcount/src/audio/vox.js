// Formant voice synthesis, rendered offline into Float32Arrays: a small
// Klatt-style synthesizer. A glottal pulse source (Rosenberg flow, per-voice
// pitch contour, vibrato, jitter, shimmer, breath) feeds a cascade of four
// time-varying formant resonators; fricatives and stop bursts are noise
// through a parallel band-pass; radiation is a first difference at the end.
//
// One call renders one *phrase* (a phoneme string) for one or more voices that
// share the same mouth: a QB barking "HUT!", or a section of a crowd yelling
// "YEAH" together. Crowds are many such groups summed (see crowd.js).
//
//   speak({ sr, phones: 'h A:.17 t', voices: [{ f0: [[0, 190], [0.2, 160]] }], shout: 1 })
//
// Phone strings: space-separated symbols, each optionally ':seconds'.

import { Biquad, clamp } from './synthkit.js';

// male formant targets (Hz) — Peterson & Barney / Hillenbrand averages
const PH = {
  i: { v: 1, f: [270, 2290, 3010, 3600], d: 0.16 },
  I: { v: 1, f: [390, 1990, 2550, 3600], d: 0.12 },
  e: { v: 1, f: [560, 1800, 2480, 3600], d: 0.15 }, // ɛ
  ae: { v: 1, f: [690, 1700, 2410, 3600], d: 0.18 },
  a: { v: 1, f: [760, 1150, 2450, 3600], d: 0.2 }, // ɑ (shouted: open)
  o: { v: 1, f: [600, 880, 2410, 3500], d: 0.2 }, // ɔ
  O: { v: 1, f: [480, 900, 2350, 3500], d: 0.18 }, // o
  U: { v: 1, f: [440, 1020, 2240, 3500], d: 0.12 },
  u: { v: 1, f: [320, 820, 2240, 3400], d: 0.2 },
  A: { v: 1, f: [660, 1220, 2390, 3500], d: 0.14 }, // ʌ
  '@': { v: 1, f: [520, 1450, 2480, 3500], d: 0.1 },
  j: { v: 0.65, f: [290, 2150, 2900, 3600], d: 0.06, glide: 1 },
  w: { v: 0.6, f: [320, 680, 2200, 3400], d: 0.07, glide: 1 },
  l: { v: 0.6, f: [360, 1250, 2700, 3500], d: 0.06, glide: 1 },
  r: { v: 0.6, f: [430, 1100, 1550, 3300], d: 0.07, glide: 1 },
  n: { v: 0.3, f: [270, 1600, 2550, 3400], d: 0.07, nasal: 1 },
  m: { v: 0.3, f: [270, 1050, 2250, 3400], d: 0.07, nasal: 1 },
  s: { fr: [6200, 1.2, 0.9], d: 0.1 },
  sh: { fr: [3200, 1.5, 0.8], d: 0.1 },
  f: { fr: [4800, 0.5, 0.3], d: 0.08 },
  z: { fr: [5800, 1.2, 0.45], v: 0.35, d: 0.08 },
  zh: { fr: [3000, 1.5, 0.45], v: 0.35, d: 0.07 },
  h: { asp: 1, d: 0.06 },
  t: { stop: [4300, 0.9, 1.1], asp: 0.55, d: 0.07 },
  k: { stop: [2300, 1.4, 1], asp: 0.55, d: 0.07 },
  p: { stop: [1200, 0.7, 0.7], asp: 0.45, d: 0.07 },
  d: { stop: [3800, 0.9, 0.55], vb: 1, d: 0.045 },
  g: { stop: [2100, 1.4, 0.5], vb: 1, d: 0.05 },
  b: { stop: [1100, 0.7, 0.4], vb: 1, d: 0.045 },
  '?': { gap: 1, d: 0.03 },
  _: { gap: 1, d: 0.08 },
};
const BW = [80, 110, 150, 230];

/** Parse 'h A:.17 t' → [{ sym, p, dur, start }] */
export function parsePhones(str) {
  let t = 0;
  return str.trim().split(/\s+/).map((tok) => {
    const [sym, d] = tok.split(':');
    const p = PH[sym];
    if (!p) throw new Error(`vox: unknown phone ${sym}`);
    const dur = d ? parseFloat(d) : p.d;
    const o = { sym, p, dur, start: t };
    t += dur;
    return o;
  });
}

// Rosenberg glottal-flow tables for a few open quotients
const GT_N = 2048;
const GT = {};
function glottalTable(oq) {
  const key = Math.round(oq * 20) / 20;
  if (GT[key]) return GT[key];
  const tab = new Float64Array(GT_N + 1);
  const tp = key * 0.68, tn = key * 0.32;
  for (let i = 0; i <= GT_N; i++) {
    const p = i / GT_N;
    tab[i] = p < tp ? 0.5 * (1 - Math.cos(Math.PI * p / tp)) : p < tp + tn ? Math.cos(Math.PI * (p - tp) / (2 * tn)) : 0;
  }
  GT[key] = tab;
  return tab;
}

/** Klatt resonator (unity DC gain), coefficients settable per control frame. */
class Res {
  constructor() { this.y1 = 0; this.y2 = 0; this.a = 1; this.b = 0; this.c = 0; }
  set(f, bw, sr) {
    const T = 1 / sr;
    const c = -Math.exp(-2 * Math.PI * bw * T);
    const b = 2 * Math.exp(-Math.PI * bw * T) * Math.cos(2 * Math.PI * Math.min(f, sr * 0.45) * T);
    this.c = c; this.b = b; this.a = 1 - b - c;
  }
  tick(x) {
    const y = this.a * x + this.b * this.y1 + this.c * this.y2;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * Render a phrase. Returns a mono Float32Array (or adds into o.out at o.at).
 * o: {
 *   sr, phones (string), R (rng from synthkit), len (s, default phrase + 0.15),
 *   voices: [{ f0: [[t, hz], …] (t relative to phrase start), gain = 1, delay = 0,
 *              vib = [rate, cents], jit = 0.012, oq, breath }],
 *   scale (formant scale: 1 male, ~1.16 female), shout 0..1 (raised F1, wider
 *   bandwidths, pressed phonation), breath 0..1, tilt (extra source lowpass Hz),
 *   speed (phrase time scale), fric (frication gain), formantJit (Hz wander)
 * }
 */
export function speak(o) {
  const sr = o.sr, R = o.R;
  const ph = parsePhones(o.phones);
  const speed = o.speed || 1;
  for (const p of ph) { p.dur *= speed; p.start *= speed; }
  const phraseLen = ph.length ? ph[ph.length - 1].start + ph[ph.length - 1].dur : 0;
  const len = o.len ?? phraseLen + 0.15;
  const n = Math.max(1, Math.ceil(len * sr));
  const out = o.out || new Float32Array(n);
  const at = o.out ? Math.round((o.at || 0) * sr) : 0;
  const scale = o.scale || 1, shout = o.shout ?? 0.5, breath = o.breath ?? 0.08;
  const K = 32; // control period (samples)
  const frames = Math.ceil(n / K) + 1;

  // ---- control tracks ----
  const F = [new Float32Array(frames), new Float32Array(frames), new Float32Array(frames), new Float32Array(frames)];
  const AV = new Float32Array(frames), AH = new Float32Array(frames), AF = new Float32Array(frames);
  const FC = new Float32Array(frames), FQ = new Float32Array(frames);
  const target = (i) => {
    // formant target for phone i; consonants borrow from the nearest vocalic neighbour
    const p = ph[i]?.p;
    if (!p) return null;
    if (p.f) return p.f;
    for (let k = i + 1; k < ph.length; k++) if (ph[k].p.f) return ph[k].p.f;
    for (let k = i - 1; k >= 0; k--) if (ph[k].p.f) return ph[k].p.f;
    return PH['@'].f;
  };
  const fj = o.formantJit ?? 0;
  const wob = [0, 0, 0, 0];
  let pi = 0;
  for (let k = 0; k < frames; k++) {
    const t = (k * K) / sr;
    while (pi < ph.length - 1 && t >= ph[pi].start + ph[pi].dur) pi++;
    const cur = ph[pi];
    const inPhrase = cur && t >= cur.start && t < cur.start + cur.dur;
    const u = cur ? t - cur.start : 0;
    const T1 = target(pi) || PH['@'].f, T0 = target(pi - 1) || T1;
    const prevGlide = pi > 0 && ph[pi - 1].p.glide;
    const tr = Math.min(prevGlide ? 0.085 : 0.05, (cur?.dur || 0.1) * 0.6);
    const x = clamp(u / tr, 0, 1), s = x * x * (3 - 2 * x);
    for (let j = 0; j < 4; j++) {
      if (fj) wob[j] = wob[j] * 0.97 + (R() * 2 - 1) * fj * 0.03 * (j + 1);
      let f = (T0[j] + (T1[j] - T0[j]) * s) * scale;
      if (j === 0) f *= 1 + 0.18 * shout; // open jaw when shouting
      F[j][k] = f + wob[j];
    }
    if (!inPhrase) continue;
    const p = cur.p;
    const next = ph[pi + 1]?.p;
    if (p.v && !p.stop) AV[k] = p.v;
    if (p.asp && !p.stop) AH[k] = p.asp;
    if (p.fr) {
      const e = Math.min(1, u / 0.018, (cur.dur - u) / 0.02);
      AF[k] = p.fr[2] * Math.max(0, e);
      FC[k] = p.fr[0] * Math.min(1.25, scale);
      FQ[k] = p.fr[1];
      if (p.v) AV[k] = p.v;
    }
    if (p.stop) {
      const rel = cur.dur * (p.vb ? 0.55 : 0.6); // closure, then release
      if (u < rel) {
        if (p.vb) AV[k] = 0.1; // voice bar
      } else {
        const ub = u - rel;
        AF[k] = p.stop[2] * Math.exp(-ub / 0.009);
        FC[k] = p.stop[0];
        FQ[k] = p.stop[1];
        if (p.asp) AH[k] = p.asp * (next && (next.v || next.f) ? 1 : 0.55) * Math.exp(-ub / 0.035);
        if (p.vb && next && next.f) AV[k] = Math.min(1, ub / 0.012);
      }
    }
  }

  // ---- source: glottal pulses of every voice + aspiration noise ----
  const src = new Float64Array(n);
  const avS = new Float64Array(n);
  let sm = 0;
  const kA = Math.exp(-1 / (0.006 * sr));
  for (let i = 0; i < n; i++) { // smoothed voicing envelope at audio rate
    const k0 = (i / K) | 0, fr = (i - k0 * K) / K;
    const v = AV[k0] + (AV[Math.min(frames - 1, k0 + 1)] - AV[k0]) * fr;
    sm = v + (sm - v) * kA;
    avS[i] = sm;
  }
  const invK = 1 / K, invSr = 1 / sr;
  const fK = new Float64Array(frames + 1);
  let vFirst = n, vLast = -1;
  for (let i = 0; i < n; i++) if (avS[i] >= 1e-4) { if (i < vFirst) vFirst = i; vLast = i; }
  for (const vc of o.voices) {
    const tab = glottalTable(vc.oq ?? (0.6 - 0.18 * shout));
    const g = vc.gain ?? 1;
    const d = Math.round((vc.delay || 0) * sr);
    const f0 = vc.f0;
    const jit = vc.jit ?? 0.012, [vr, vcnt] = vc.vib || [5.2, 0];
    const vDepth = Math.pow(2, vcnt / 1200) - 1, vph0 = R() * 6.28, vIncK = (2 * Math.PI * vr * K) / sr;
    // pitch contour + vibrato at the control rate; interpolated per sample below
    let bi = 0;
    for (let k = 0; k <= frames; k++) {
      const t = Math.max(0, k * K - d) / sr / speed;
      while (bi < f0.length - 2 && t > f0[bi + 1][0]) bi++;
      const a = f0[bi], b = f0[Math.min(f0.length - 1, bi + 1)];
      const fr = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
      fK[k] = a[1] * Math.pow(b[1] / a[1], fr) * (1 + vDepth * Math.sin(vph0 + vIncK * k)) * invSr;
    }
    let ph0 = R(), drift = 0, gs = g;
    // only the voiced span (shifted by this voice's delay); the phase increment
    // ramps linearly across each control frame
    const iA = Math.max(d, vFirst + d), iB = Math.min(n, vLast + d + 1);
    for (let k = (iA / K) | 0; k * K < iB; k++) {
      const j0 = Math.max(iA, k * K), j1 = Math.min(iB, (k + 1) * K);
      const m = 1 + drift;
      let inc = (fK[k] + ((fK[k + 1] - fK[k]) * (j0 - k * K)) * invK) * m;
      const dinc = (fK[k + 1] - fK[k]) * invK * m;
      for (let i = j0; i < j1; i++) {
        const e = avS[i - d];
        if (e < 1e-4) { if (avS[i - d - 1] >= 1e-4) ph0 = 0; inc += dinc; continue; }
        ph0 += inc;
        inc += dinc;
        if (ph0 >= 1) { // new glottal period: jitter + shimmer
          ph0 -= 1;
          drift = clamp(drift * 0.7 + (R() * 2 - 1) * jit, -0.06, 0.06);
          gs = g * (1 + (R() * 2 - 1) * 0.08);
        }
        src[i] += tab[(ph0 * GT_N) | 0] * e * gs;
      }
    }
  }
  // breath + aspiration (noise through the same vocal tract). The noise is
  // pre-integrated (one-pole lowpass) so the radiation difference at the end
  // leaves it roughly flat instead of blue.
  let ahS = 0, nl = 0;
  const totalG = o.voices.reduce((a, v) => a + (v.gain ?? 1), 0);
  const kN = Math.exp(-2 * Math.PI * 1800 / sr), nG = 2.2 * Math.sqrt(totalG) * (1 - kN);
  for (let i = 0; i < n; i++) {
    const k0 = (i / K) | 0;
    const ah = AH[k0] + (AH[Math.min(frames - 1, k0 + 1)] - AH[k0]) * ((i - k0 * K) / K);
    ahS = ah + (ahS - ah) * kA;
    const amt = ahS * 0.6 + breath * avS[i] * 0.5;
    if (amt < 1e-5) { nl *= kN; continue; }
    nl = nl * kN + (R() * 2 - 1) * nG;
    src[i] += nl * amt;
  }
  // optional spectral tilt (softer, rounder voices)
  if (o.tilt) new Biquad('lowpass', o.tilt, 0.6, 0, sr).run(src);

  // ---- cascade formants ----
  const res = [new Res(), new Res(), new Res(), new Res()];
  const bwK = 1 + 0.35 * shout;
  let prev = 0;
  const y = new Float64Array(n);
  for (let k = 0; k < frames; k++) {
    for (let j = 0; j < 4; j++) res[j].set(F[j][k], BW[j] * bwK * (j === 0 ? 1 + 0.4 * shout : 1), sr);
    const i1 = Math.min(n, (k + 1) * K);
    for (let i = k * K; i < i1; i++) {
      let v = src[i];
      v = res[0].tick(v); v = res[1].tick(v); v = res[2].tick(v); v = res[3].tick(v);
      y[i] = v - prev; // radiation
      prev = v;
    }
  }
  // vocal effort: shouting tilts the spectrum up (pre-emphasis)
  const pre = 0.6 * shout;
  if (pre > 0) { let p = 0; for (let i = 0; i < n; i++) { const v = y[i]; y[i] = v - pre * p; p = v; } }
  // calibrate the voiced/aspirated part to a fixed level (vowel RMS ≈ 0.1) so
  // the parallel frication branch below has a known balance against it
  let vs = 0, vc = 0, as = 0;
  for (let i = 0; i < n; i++) { as += y[i] * y[i]; if (avS[i] > 0.5) { vs += y[i] * y[i]; vc++; } }
  const ref = vc > sr * 0.02 ? Math.sqrt(vs / vc) : Math.sqrt(as / n) * 2;
  if (ref > 1e-9) { const g = 0.1 / ref; for (let i = 0; i < n; i++) y[i] *= g; }
  // ---- parallel frication / bursts ----
  const bp = new Biquad('bandpass', 4000, 1, 0, sr);
  let lastFc = 0, lastQ = 0, afS = 0;
  const kF = Math.exp(-1 / (0.0015 * sr));
  const fg = (o.fric ?? 1) * 0.13;
  let anyF = false;
  for (let k = 0; k < frames; k++) if (AF[k] > 0) { anyF = true; break; }
  for (let i = 0; anyF && i < n; i++) {
    const k = (i / K) | 0;
    const af = AF[k];
    if (af > 0 && (FC[k] !== lastFc || FQ[k] !== lastQ)) { bp.set('bandpass', FC[k], FQ[k], 0, sr); lastFc = FC[k]; lastQ = FQ[k]; }
    afS = af + (afS - af) * kF;
    if (afS < 1e-5 && af === 0) { bp.z1 = bp.z2 = 0; continue; }
    y[i] += bp.tick(R() * 2 - 1) * afS * fg;
  }
  for (let i = 0; i < n && at + i < out.length; i++) out[at + i] += y[i] * (o.gain ?? 1);
  return out;
}

/** Pitch contour helper: rise-fall shout over `dur` seconds around base hz. */
export function shoutContour(base, dur, { rise = 1.12, fall = 0.82, peakAt = 0.3 } = {}) {
  return [[0, base * 0.92], [dur * peakAt, base * rise], [dur, base * fall]];
}

export { PH as PHONES };
