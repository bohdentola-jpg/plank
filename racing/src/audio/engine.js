// Synthesized car engines. No samples: for each layout we pre-render "engine
// cycle" loops — one 720° crank cycle holds every cylinder's exhaust pulse with
// the layout's real firing order, bank pairing and per-cylinder irregularity —
// many varied cycles back to back so the loop never sounds perfectly periodic.
//
// Like a sample-based engine, each car plays 4 loops rendered at different
// base rpms (on-load and off-load sets) and crossfades between them. Every loop
// is driven by ONE rpm signal (a ConstantSource feeding each playbackRate
// through a 1/baseRpm gain), so all layers stay phase-locked: pulse timing is in
// crank degrees, so a crossfade morphs the pulse shape instead of comb-filtering.
// Fixed-Hz exhaust acoustics (tailpipe ring, formant EQ) are real-time filters
// that the harmonics sweep through as rpm rises, as on a real car.
//
//   rpm ─┬→ ×1/base₀ → loop₀ on/off → g ┐
//        ├→ ×1/base₁ → loop₁ on/off → g ┼→ bus ─┬───────────────────────┐
//        ├→ …                           ┘       └→ drive → shaper → dist ┤
//        ├→ ×k → intake band + ×cyl/120 → intake pulsing               tone
//        └→ ×14/60 → supercharger whine       tone ─┬───────────────────┐
//                                                   └→ pipe resonance ──┤
//                                    body → EQ ×3 → lowpass → cut (limiter) → out
//   intake, turbo whistle, pops, blow-off ────────────────────────────────→ out
//   out → spatial gain → panner → sfxBus   (+ a little reverb)
//
// Player engines get everything; AI engines (player: false) use 3 on-load loops,
// fold to mono and skip grit/intake/induction to stay cheap.

import { audio } from './audio.js';
import {
  TAU, clamp, lerp, rng, hash, Biquad, modal, burst, alloc, normalize, fadeEdges,
  rms, peak, scale, toBuffer, shaperCurve, setSmooth, krate,
} from './synthkit.js';

// ---------------------------------------------------------------------------
// Layout table. ev = firing events [crank angle in the 720° cycle, bank].
// The unevenness in ev/amp/delay is what gives each layout its signature.
//  atk/dec   pulse attack/decay in ms [idle layer, top layer]
//  ring      [× firing freq, amount, decay in firing periods] rpm-tracking tone
//  noise     per-pulse combustion rasp [low, high]; nf/nq its band (Hz @3000rpm)
//  jit       cycle-to-cycle variation [low, high]; cylVar fixed per-cylinder spread
//  eq        real-time fixed-Hz exhaust formants [[Hz, dB, Q] ×3]; ex = rasp dB per exhaust
//  pipe      [Hz, gain] resonant tailpipe body: each pulse rings at a fixed pitch
//  drive/asym  load-dependent waveshaper grit; lp = lowpass range (Hz)
// ---------------------------------------------------------------------------
const even = (n, bank) => Array.from({ length: n }, (_, i) => [(i * 720) / n, bank(i)]);

const LAYOUTS = {
  // buzzy, raspy, high-revving; cam changeover ("VTEC") above vtec × redline
  i4: {
    ev: even(4, () => 0), amp: [1, 1], delay: [0, 0], bankLp: 0, width: 0.1,
    atk: [0.1, 0.04], dec: [1.5, 0.45], snap: 0.6, ring: [3, 0.35, 0.35],
    noise: [0.9, 1.0], nf: 2200, nq: 0.8, jit: [0.09, 0.03], cylVar: 0.05, tj: 1.2, tick: 0.05,
    sat: 1.7, eq: [[240, 1, 0.9], [980, 3, 1.3], [2700, 2.5, 1.5]], ex: 5,
    pipe: [260, 1.6], drive: 3.2, asym: 0.15, intake: 1.0, inF: 190, inK: 0.15, lp: [1300, 9000], vtec: 0.66, level: 0.86,
  },
  // silky, turbine-like: overlapping even pulses, strong clean harmonics
  i6: {
    ev: even(6, (i) => i % 2), amp: [1, 0.94], delay: [0, 1], bankLp: 0, width: 0.18,
    atk: [0.14, 0.06], dec: [2.0, 0.7], snap: 0.55, ring: [2, 0.45, 0.6],
    noise: [0.45, 0.45], nf: 1800, nq: 0.8, jit: [0.06, 0.02], cylVar: 0.03, tj: 0.7, tick: 0.02,
    sat: 1.3, eq: [[190, 2, 0.8], [720, 3, 1.0], [2000, 2, 1.3]], ex: 3,
    pipe: [230, 1.4], drive: 1.7, asym: 0.08, intake: 0.85, inF: 170, inK: 0.12, lp: [1200, 8500], level: 1.22,
  },
  // gruff: bank alternation + a touch of odd-fire
  v6: {
    ev: [[0, 0], [114, 1], [240, 0], [354, 1], [480, 0], [594, 1]], amp: [1, 0.8], delay: [0, 3],
    bankLp: 2200, width: 0.3,
    atk: [0.12, 0.05], dec: [2.0, 0.6], snap: 0.6, ring: [2, 0.3, 0.4],
    noise: [0.7, 0.75], nf: 1600, nq: 0.75, jit: [0.12, 0.04], cylVar: 0.08, tj: 1.5, tick: 0.02,
    sat: 2.0, eq: [[150, 2.5, 0.9], [520, 3.5, 1.2], [2100, 2, 1.5]], ex: 4,
    pipe: [190, 1.8], drive: 2.6, asym: 0.3, intake: 0.7, inF: 150, inK: 0.11, lp: [1000, 7000], level: 1.24,
  },
  // cross-plane V8 (1-8-4-3-6-5-7-2): each bank fires 270-180-90-180 → burble/lope
  v8: {
    ev: [[0, 0], [90, 1], [180, 1], [270, 0], [360, 1], [450, 0], [540, 0], [630, 1]],
    amp: [1, 0.76], delay: [0, 5], bankLp: 1500, width: 0.35,
    atk: [0.15, 0.06], dec: [2.4, 0.65], snap: 0.6, ring: [2.5, 0.25, 0.4],
    noise: [0.7, 0.7], nf: 1300, nq: 0.7, jit: [0.17, 0.05], cylVar: 0.13, tj: 2, tick: 0.015,
    sat: 1.9, eq: [[115, 3, 0.8], [420, 3, 1.1], [1600, 1, 1.2]], ex: 5,
    pipe: [150, 2.2], drive: 2.4, asym: 0.35, intake: 0.6, inF: 130, inK: 0.1, lp: [900, 6500], level: 1.0,
  },
  // angular, wailing: odd-fire 60/84 alternation across banks
  v10: {
    ev: [[0, 0], [84, 1], [144, 0], [228, 1], [288, 0], [372, 1], [432, 0], [516, 1], [576, 0], [660, 1]],
    amp: [1, 0.86], delay: [0, 2], bankLp: 3500, width: 0.3,
    atk: [0.1, 0.04], dec: [1.6, 0.5], snap: 0.6, ring: [2.5, 0.4, 0.5],
    noise: [0.5, 0.6], nf: 2400, nq: 0.8, jit: [0.08, 0.025], cylVar: 0.05, tj: 1, tick: 0.03,
    sat: 1.6, eq: [[260, 1.5, 0.9], [1100, 4, 1.6], [2900, 2, 1.8]], ex: 4,
    pipe: [300, 1.5], drive: 2.2, asym: 0.12, intake: 0.8, inF: 200, inK: 0.13, lp: [1400, 10000], level: 1.07,
  },
  // smooth soaring scream: 60° even fire, minimal irregularity
  v12: {
    ev: even(12, (i) => i % 2), amp: [1, 0.95], delay: [0, 1], bankLp: 0, width: 0.22,
    atk: [0.12, 0.05], dec: [1.6, 0.55], snap: 0.55, ring: [2, 0.35, 0.6],
    noise: [0.35, 0.4], nf: 2600, nq: 0.8, jit: [0.05, 0.015], cylVar: 0.03, tj: 0.6, tick: 0.02,
    sat: 1.3, eq: [[240, 1.5, 0.8], [1250, 3, 1.2], [3000, 2, 1.5]], ex: 3,
    pipe: [320, 1.2], drive: 1.5, asym: 0.05, intake: 0.9, inF: 220, inK: 0.14, lp: [1500, 11000], level: 1.06,
  },
  // 2 rotors, one exhaust pulse per rotor per e-shaft rev: sharp port opening,
  // long pulses, heavy rasp, "brap" misfires at low rpm
  rotary: {
    ev: even(4, (i) => i % 2), amp: [1, 0.92], delay: [0, 0], bankLp: 0, width: 0.12,
    atk: [0.08, 0.04], dec: [3.0, 1.0], snap: 0.6, ring: [3, 0.3, 0.3],
    noise: [0.9, 0.8], nf: 2400, nq: 0.7, jit: [0.2, 0.05], cylVar: 0.06, tj: 1.5, tick: 0, brap: 0.32,
    sat: 2.4, eq: [[300, 1, 0.9], [1300, 4, 1.5], [3300, 2, 1.6]], ex: 5,
    pipe: [280, 1.6], drive: 3.4, asym: 0.1, intake: 1.0, inF: 220, inK: 0.14, lp: [1500, 10000], level: 0.94,
  },
  // flat-six: bank alternation + rpm-tracking 3rd-harmonic ring + valvetrain → metallic howl
  flat6: {
    ev: even(6, (i) => i % 2), amp: [1, 0.85], delay: [0, 2], bankLp: 2600, width: 0.3,
    atk: [0.1, 0.045], dec: [1.6, 0.55], snap: 0.6, ring: [3, 0.55, 0.8],
    noise: [0.6, 0.65], nf: 2800, nq: 0.9, jit: [0.08, 0.025], cylVar: 0.04, tj: 1, tick: 0.12,
    sat: 1.8, eq: [[200, 2, 0.9], [950, 4, 2.2], [2300, 3, 2.5]], ex: 4,
    pipe: [250, 1.6], drive: 2.4, asym: 0.2, intake: 0.9, inF: 190, inK: 0.13, lp: [1300, 9500], level: 1.24,
  },
  // boxer four with unequal-length headers: pulses arrive in pairs → rumble
  boxer4: {
    ev: [[0, 0], [215, 1], [360, 0], [575, 1]], amp: [1, 0.78], delay: [0, 0], bankLp: 1400, width: 0.3,
    atk: [0.15, 0.06], dec: [2.4, 0.65], snap: 0.6, ring: [2, 0.3, 0.4],
    noise: [0.7, 0.7], nf: 1300, nq: 0.7, jit: [0.14, 0.04], cylVar: 0.08, tj: 1.6, tick: 0.02,
    sat: 1.8, eq: [[140, 1.5, 0.9], [480, 3, 1.2], [1500, 0, 1.4]], ex: 4,
    pipe: [170, 1.6], drive: 2.2, asym: 0.3, intake: 0.8, inF: 140, inK: 0.1, lp: [1000, 7000], level: 1.3,
  },
};

export const ENGINE_LAYOUTS = Object.freeze(Object.keys(LAYOUTS));

/** Exhaust pulse (firing) frequency in Hz for a layout at rpm (pitch 1). */
export function firingHz(layout, rpm) {
  return (rpm / 120) * (LAYOUTS[layout] || LAYOUTS.i4).ev.length;
}

const TC_RPM = 0.03, TC_GAIN = 0.035, TC_FILT = 0.05;
const OUT_LEVEL = 0.55; // overall engine trim
const AI_TRIM = 1.8; // AI chains are leaner (mono fold, no pipe/grit/intake); match the player at gain 1
const N_LAYERS = 4;
const AI_LAYERS = [0, 2, 3];

const num = (v, d) => (v !== null && v !== '' && Number.isFinite(+v) ? +v : d);

function normProfile(p = {}) {
  const idle = clamp(num(p.idle, 850), 400, 2500);
  return {
    layout: LAYOUTS[p.layout] ? p.layout : 'i4',
    idle,
    redline: clamp(num(p.redline, 7500), idle * 2.5, 12000),
    turbo: clamp(num(p.turbo, 0), 0, 1),
    supercharger: !!p.supercharger,
    exhaust: clamp(num(p.exhaust, 0), 0, 1),
    pitch: clamp(num(p.pitch, 1) || 1, 0.7, 1.3),
  };
}

// ---------------------------------------------------------------------------
// Pre-rendered material, cached per AudioContext.
// ---------------------------------------------------------------------------
const CACHE = new WeakMap();
function cacheFor(ctx) {
  let c = CACHE.get(ctx);
  if (!c) CACHE.set(ctx, (c = new Map()));
  return c;
}

/** Geometric rpm layer plan; each loop holds an integer number of cycles. */
function layerPlan(idle, redline, sr) {
  const lo = idle * 1.1, hi = redline * 0.92;
  const secs = [1.7, 1.15, 0.85, 0.65];
  return secs.map((sec, i) => {
    const want = lo * Math.pow(hi / lo, i / (N_LAYERS - 1));
    const cyc = 120 / want;
    const K = Math.max(6, Math.round(sec / cyc));
    const L = Math.round(K * cyc * sr);
    const base = (K * 120 * sr) / L; // exact: L samples = K cycles
    return { K, L, base, frac: clamp((base - idle) / (redline - idle), 0, 1) };
  });
}

// Pulse shape table: steep front, fast "snap" decay (the crack) over a slower body
// decay, plus an rpm-tracking ring. Every pulse in a loop shares it.
function pulseTable(atk, dec, snap, rw, ra, rd) {
  const len = Math.ceil(Math.max(dec, rd) * 6.5) + 2;
  const tbl = new Float32Array(len + 1);
  const tf = dec * 0.16;
  let pk = 0;
  for (let i = 0; i <= len; i++) {
    const e = (1 - Math.exp(-i / atk)) * (snap * Math.exp(-i / tf) + (1 - snap) * Math.exp(-i / dec));
    tbl[i] = e;
    if (e > pk) pk = e;
  }
  for (let i = 0; i <= len; i++) {
    tbl[i] = tbl[i] / pk + (1 - Math.exp(-i / atk)) * ra * Math.exp(-i / rd) * Math.sin(rw * i);
  }
  return tbl;
}

// add a table at a fractional position into a circular buffer (linear interpolation)
function addTable(buf, pos, amp, tbl) {
  const L = buf.length, n = tbl.length - 1;
  const i0 = Math.ceil(pos);
  const fr = i0 - pos;
  let idx = i0 % L;
  if (idx < 0) idx += L;
  for (let k = 0; k < n; k++) {
    const v0 = tbl[k];
    buf[idx] += amp * (v0 + (tbl[k + 1] - v0) * fr);
    if (++idx === L) idx = 0;
  }
}

// combustion/turbulence noise burst under an envelope table
function addNoise(buf, pos, amp, env, R) {
  const L = buf.length, n = env.length;
  let idx = Math.ceil(pos) % L;
  if (idx < 0) idx += L;
  for (let k = 0; k < n; k++) {
    buf[idx] += amp * env[k] * (R() * 2 - 1);
    if (++idx === L) idx = 0;
  }
}

function envTable(atk, dec) {
  const n = Math.ceil(dec * 6) + 2;
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) e[i] = (1 - Math.exp(-i / atk)) * Math.exp(-i / dec);
  return e;
}

// short metallic valvetrain tick
function addTick(buf, pos, amp, w, dec) {
  const L = buf.length;
  const i0 = Math.ceil(pos);
  const len = Math.ceil(dec * 6);
  const kd = Math.exp(-1 / dec);
  let D = amp;
  let idx = i0 % L;
  if (idx < 0) idx += L;
  for (let k = 0; k < len; k++) {
    buf[idx] += D * Math.sin(w * k) * (k < 3 ? k / 3 : 1);
    D *= kd;
    if (++idx === L) idx = 0;
  }
}

function renderCycle(sr, key, spec, on) {
  const def = LAYOUTS[key];
  const { L, K, base, frac } = spec;
  const spc = L / K, sDeg = spc / 720;
  const R = rng(hash(`${key}|${base.toFixed(3)}|${on ? 'on' : 'off'}`));
  const RC = rng(hash(`${key}|cyl`)); // per-cylinder bias, identical in every layer → stable lope
  const ev = def.ev, nEv = ev.length;
  const bias = ev.map(() => 1 + RC.gauss() * def.cylVar * lerp(1, 0.45, frac));
  const b0 = new Float32Array(L), b1 = new Float32Array(L);
  const n1 = new Float32Array(L), n2 = new Float32Array(L), mt = new Float32Array(L);
  // pulse widths in ms, idle layer → top layer (log interpolated): steep fronts at any
  // rpm, but relatively wider pulses up top so they overlap into a continuous roar
  const msToS = sr / 1000;
  const atk = def.atk[0] * Math.pow(def.atk[1] / def.atk[0], frac) * (on ? 1 : 1.7) * msToS;
  const dec = def.dec[0] * Math.pow(def.dec[1] / def.dec[0], frac) * (on ? 1 : 1.25) * msToS;
  const jit = lerp(def.jit[0], def.jit[1], frac) * (on ? 1 : 1.6);
  const nAmt = lerp(def.noise[0], def.noise[1], frac) * (on ? 1 : 1.5);
  const fp = spc / nEv; // mean firing period (samples)
  // the rpm-tracking ring (howl/wail) develops with revs
  const ra = def.ring[1] * lerp(0.35, 1, frac) * (on ? 1 : 0.6);
  const shape = pulseTable(atk, dec, def.snap * (on ? 1 : 0.5), (TAU * def.ring[0]) / fp, ra, def.ring[2] * fp);
  const nEnv = envTable(atk * 0.6, dec * 1.4);
  const tickW = (TAU * 3600 * (1 + 0.25 * frac)) / sr, tickD = 0.0005 * sr;
  let carry = 1;
  for (let k = 0; k < K; k++) {
    const cyc = 1 + R.gauss() * jit * 0.5;
    for (let j = 0; j < nEv; j++) {
      const [ang, bank] = ev[j];
      let a = def.amp[bank] * bias[j] * cyc * (1 + R.gauss() * jit);
      if (on && def.brap && frac < 0.35) {
        a *= carry;
        carry = 1;
        if (R() < def.brap * (1 - frac / 0.35)) { a *= 0.25; carry = 1.5; }
      }
      if (!on) a *= R() < 0.16 ? 0.12 : 0.55 + 0.7 * R(); // overrun: weak, ragged burns
      a = Math.max(0, a);
      const pos = (k * 720 + ang + def.delay[bank] + R.gauss() * def.tj) * sDeg;
      addTable(bank ? b1 : b0, pos, a, shape);
      const na = a * nAmt;
      addNoise(n1, pos, na, nEnv, R);
      addNoise(n2, pos, na, nEnv, R);
      if (def.tick) addTick(mt, pos + 200 * sDeg, def.tick * (0.6 + 0.4 * R()), tickW, tickD);
    }
  }
  const rs = base / 3000;
  if (def.bankLp) new Biquad('lowpass', def.bankLp * Math.pow(rs, 0.4), 0.7, 0, sr).runLoop(b1, 8192);
  const nfc = def.nf * Math.pow(rs, 0.45);
  new Biquad('bandpass', nfc, def.nq, 0, sr).runLoop(n1, 8192);
  new Biquad('bandpass', nfc, def.nq, 0, sr).runLoop(n2, 8192);
  // banks spread across the stereo field (dual exhaust), rasp decorrelated
  const w = def.width;
  const chL = new Float32Array(L), chR = new Float32Array(L);
  const nw = 2.2; // bandpass loses level; bring the rasp back up
  for (let i = 0; i < L; i++) {
    const c = n1[i] * 0.89 * nw, d = n2[i] * 0.45 * nw;
    chL[i] = b0[i] * (1 + w) + b1[i] * (1 - w) + c + d + mt[i];
    chR[i] = b0[i] * (1 - w) + b1[i] * (1 + w) + c - d + mt[i];
  }
  for (const ch of [chL, chR]) {
    new Biquad('highpass', 28, 0.7, 0, sr).runLoop(ch, 8192);
    new Biquad('lowpass', 11500, 0.54, 0, sr).runLoop(ch, 8192);
    new Biquad('lowpass', 11500, 1.31, 0, sr).runLoop(ch, 8192);
  }
  if (on && def.sat > 1) {
    const p = peak(chL, chR) || 1, g = def.sat / p, n = Math.tanh(def.sat);
    for (const ch of [chL, chR]) for (let i = 0; i < L; i++) ch[i] = Math.tanh(ch[i] * g) / n;
  }
  // equal loudness across layers: RMS 0.16, peak capped
  const r = rms(chL, chR) || 1;
  scale([chL, chR], 0.16 / r);
  const pk = peak(chL, chR);
  if (pk > 0.97) scale([chL, chR], 0.97 / pk);
  return [chL, chR];
}

function cycleBuffer(ctx, key, spec, on) {
  const c = cacheFor(ctx);
  const id = `cyc|${key}|${on ? 1 : 0}|${spec.L}|${spec.K}|${spec.frac.toFixed(3)}`;
  let b = c.get(id);
  if (!b) c.set(id, (b = toBuffer(ctx, renderCycle(ctx.sampleRate, key, spec, on))));
  return b;
}

// exhaust pops: bright (aftermarket) or muffled (stock); some are crackle clusters
function renderPop(sr, R, bright, crackle) {
  const [out] = alloc(crackle ? 0.3 : 0.17, sr);
  const exc = new Float32Array(out.length);
  const bangs = crackle ? 3 + Math.floor(R() * 4) : 1;
  let at = Math.round(0.002 * sr);
  for (let b = 0; b < bangs && at < out.length - 0.06 * sr; b++) {
    const a = b === 0 ? 1 : 0.25 + 0.6 * R();
    const w = Math.round(sr * (0.0003 + R() * 0.0006));
    for (let i = 0; i < w; i++) exc[at + i] += a * Math.sin((Math.PI * i) / w);
    burst(exc, at, 0.0015 + R() * 0.003, a * (bright ? 0.9 : 0.5), R, 0.0001, sr);
    at += Math.round(sr * (0.012 + R() * 0.045));
  }
  const body = modal(exc, new Float32Array(exc.length), [
    [70 + R() * 80, 0.035 + R() * 0.03, 1],
    [220 + R() * 200, 0.015, 0.6],
    [900 + R() * 700, 0.006, 0.35],
  ], sr);
  normalize([body], 1);
  for (let i = 0; i < out.length; i++) out[i] = exc[i] * (bright ? 0.7 : 0.35) + body[i] * (bright ? 0.6 : 0.9);
  if (bright) new Biquad('lowpass', 8500, 0.7, 0, sr).run(out);
  else {
    new Biquad('lowpass', 1700, 0.7, 0, sr).run(out);
    new Biquad('peaking', 120, 1, 4, sr).run(out);
  }
  new Biquad('highpass', 40, 0.7, 0, sr).run(out);
  normalize([out], 0.9);
  return fadeEdges([out], sr, 0.0003, 0.02);
}

function popBuffers(ctx) {
  const c = cacheFor(ctx);
  let s = c.get('pops');
  if (!s) {
    const sr = ctx.sampleRate, R = rng(0x9091);
    s = { bright: [], dull: [] };
    for (let i = 0; i < 8; i++) s.bright.push(toBuffer(ctx, renderPop(sr, R, true, i >= 5)));
    for (let i = 0; i < 5; i++) s.dull.push(toBuffer(ctx, renderPop(sr, R, false, i >= 3)));
    c.set('pops', s);
  }
  return s;
}

// turbo blow-off valve "pssh" (some with compressor-surge flutter)
function renderBov(sr, R, flutter) {
  const [o] = alloc(0.6 + R() * 0.2, sr);
  const bp = new Biquad('bandpass', 3500, 0.9, 0, sr);
  const hp = new Biquad('highpass', 5200, 0.7, 0, sr);
  const lo = new Biquad('bandpass', 900, 1.2, 0, sr);
  const fr = 16 + R() * 6, decay = 0.15 + R() * 0.08;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    if ((i & 31) === 0) bp.set('bandpass', 3600 * Math.exp(-t * 2) + 1000, 0.9, 0, sr);
    const env = (1 - Math.exp(-t / 0.005)) * Math.exp(-t / decay);
    const w = R() * 2 - 1;
    let v = bp.tick(w) + hp.tick(w) * 0.35;
    if (flutter && t < 0.34) {
      const am = 0.5 + 0.5 * Math.sin(TAU * fr * t);
      v = v * (0.35 + 0.65 * am) + lo.tick(w) * 1.6 * am * (1 - t / 0.34);
    }
    o[i] = v * env;
  }
  normalize([o], 0.85);
  return fadeEdges([o], sr, 0.001, 0.05);
}

function bovBuffers(ctx) {
  const c = cacheFor(ctx);
  let s = c.get('bov');
  if (!s) {
    const R = rng(0xb0b);
    s = [false, true, false, true].map((f) => toBuffer(ctx, renderBov(ctx.sampleRate, R, f)));
    c.set('bov', s);
  }
  return s;
}

// slow periodic random curve (±1) for subtle level wander; 6 s at 8 kHz
function wobbleBuffer(ctx) {
  const c = cacheFor(ctx);
  let b = c.get('wob');
  if (!b) {
    const sr = 8000, n = sr * 6, R = rng(0x30b);
    const d = new Float32Array(n);
    for (let k = 1; k <= 14; k++) {
      const ph = R() * TAU, a = 1 / k;
      for (let i = 0; i < n; i++) d[i] += a * Math.sin(ph + (TAU * k * i) / n * 3);
    }
    normalize([d], 1);
    b = ctx.createBuffer(1, n, sr);
    b.getChannelData(0).set(d);
    c.set('wob', b);
  }
  return b;
}

function whineWave(ctx) {
  const c = cacheFor(ctx);
  let w = c.get('whine');
  if (!w) {
    const imag = new Float32Array([0, 1, 0.45, 0.6, 0.2, 0.18, 0.08]);
    w = ctx.createPeriodicWave(new Float32Array(imag.length), imag);
    c.set('whine', w);
  }
  return w;
}

// ---------------------------------------------------------------------------

export class EngineSound {
  constructor(profile, { player = true } = {}) {
    this.player = !!player;
    this.profile = normProfile(profile);
    this.spatial = { gain: 1, pan: 0, doppler: 1 };
    this.ctx = null;
    this.core = null;
    this._dead = false;
    this._memo = new Float64Array(24).fill(NaN);
    this._pops = 0;
    this._lim = false;
    this._limT = 0;
    this._vt = 0;
    this._boost = 0;
    this._lastBoost = 0;
    this._lastBov = -1;
    this._rpmEff = 0;
    audio.onReady(() => {
      if (!this._dead && !this.ctx) this._build();
    });
  }

  /** Render (and cache) a profile's loops ahead of time, e.g. on a loading screen. */
  static prewarm(profile, { player = true } = {}) {
    const ctx = audio.ctx;
    if (!ctx) return;
    const p = normProfile(profile);
    const plan = layerPlan(p.idle, p.redline, ctx.sampleRate);
    for (const i of player ? [0, 1, 2, 3] : AI_LAYERS) {
      cycleBuffer(ctx, p.layout, plan[i], true);
      if (player) cycleBuffer(ctx, p.layout, plan[i], false);
    }
    popBuffers(ctx);
    if (p.turbo > 0) bovBuffers(ctx);
  }

  /** Persistent node count (for leak checks). */
  get nodeCount() {
    return (this._nodes ? this._nodes.length : 0) + (this.core ? this.core.nodes.length : 0);
  }

  get activeVoices() { return this._pops; }

  _build() {
    const ctx = (this.ctx = audio.ctx);
    this._nodes = [];
    const mk = (n) => { this._nodes.push(n); return n; };
    this.out = mk(ctx.createGain());
    this.spat = mk(ctx.createGain());
    this.spat.gain.value = 0; // ramps in on the first update — no start click
    this.panner = mk(ctx.createStereoPanner());
    this.out.connect(this.spat).connect(this.panner).connect(audio.sfxBus);
    // post-distance reverb send, so far-away cars stay wet-but-quiet
    this.rev = mk(ctx.createGain());
    this.rev.gain.value = this.player ? 0.05 : 0.07;
    this.spat.connect(this.rev).connect(audio.reverbSend);
    this.popBus = mk(ctx.createGain());
    this.popBus.gain.value = 0.75;
    this.popBus.connect(this.out);
    this.core = this._buildCore(ctx.currentTime + 0.005);
  }

  _buildCore(t0) {
    const ctx = this.ctx, p = this.profile, def = LAYOUTS[p.layout], P = this.player;
    const core = { nodes: [], srcs: [], free: new Set(), layers: [], eq: [], def };
    const mk = (n) => { core.nodes.push(n); return n; };
    const src = (n, free = false) => {
      core.srcs.push(n);
      if (free) core.free.add(n);
      return mk(n);
    };
    const gain = (v) => { const g = mk(ctx.createGain()); g.gain.value = v; return g; };
    const plan = layerPlan(p.idle, p.redline, ctx.sampleRate);

    core.rpm = src(ctx.createConstantSource());
    // a rebuilt core (garage change) starts at the current rpm — no pitch swoop
    core.rpm.offset.value = this._rpmEff || p.idle * p.pitch;
    core.bus = gain(1);
    if (!P) {
      // AI cars: fold to mono before the filter chain; the panner places them
      core.bus.channelCount = 1;
      core.bus.channelCountMode = 'explicit';
    }
    for (const i of P ? [0, 1, 2, 3] : AI_LAYERS) {
      const spec = plan[i];
      const sc = gain(1 / spec.base);
      core.rpm.connect(sc);
      const layer = { base: spec.base, on: null, off: null };
      for (const on of P ? [true, false] : [true]) {
        const s = src(ctx.createBufferSource());
        s.buffer = cycleBuffer(ctx, p.layout, spec, on);
        s.loop = true;
        s.playbackRate.value = 0;
        sc.connect(s.playbackRate);
        const g = gain(0);
        s.connect(g).connect(core.bus);
        layer[on ? 'on' : 'off'] = g;
      }
      core.layers.push(layer);
    }

    const tone = gain(1);
    core.bus.connect(tone);
    if (P) {
      // parallel grit path: load-dependent distortion mixed under the clean signal
      const drv = gain(def.drive);
      const ws = mk(ctx.createWaveShaper());
      ws.curve = shaperCurve(def.asym);
      ws.oversample = '2x';
      const dc = mk(ctx.createBiquadFilter());
      dc.type = 'highpass';
      dc.frequency.value = 30;
      core.dist = gain(0);
      core.bus.connect(drv).connect(ws).connect(dc).connect(core.dist).connect(tone);
    }
    let node = tone;
    if (P) {
      // tailpipe resonance in parallel: pulses "bwop" instead of ticking
      const body = mk(ctx.createGain());
      tone.connect(body);
      const rb = mk(ctx.createBiquadFilter());
      rb.type = 'bandpass';
      rb.frequency.value = def.pipe[0];
      rb.Q.value = 4;
      core.pipe = gain(def.pipe[1]);
      tone.connect(rb).connect(core.pipe).connect(body);
      node = body;
    }
    for (const [f, g, q] of P ? def.eq : [def.eq[1]]) {
      const b = mk(ctx.createBiquadFilter());
      b.type = 'peaking';
      b.frequency.value = f;
      b.gain.value = g;
      b.Q.value = q;
      node.connect(b);
      node = b;
      core.eq.push(krate(b));
    }
    core.lp = krate(mk(ctx.createBiquadFilter()));
    core.lp.type = 'lowpass';
    core.lp.Q.value = 0.6;
    core.lp.frequency.value = def.lp[0];
    core.cut = gain(1); // rev-limiter fuel-cut stutter
    core.mod = gain(1); // slow level wander so loops never sound static
    node.connect(core.lp).connect(core.cut).connect(core.mod).connect(this.out);

    if (P) {
      const wob = src(ctx.createBufferSource(), true);
      wob.buffer = wobbleBuffer(ctx);
      wob.loop = true;
      wob.connect(gain(0.06)).connect(core.mod.gain);

      // intake roar: pink noise through an rpm-tracking band, pulsed at firing frequency
      const nz = src(ctx.createBufferSource(), true);
      nz.buffer = audio.noise('pink');
      nz.loop = true;
      const bp = krate(mk(ctx.createBiquadFilter()));
      bp.type = 'bandpass';
      bp.frequency.value = def.inF;
      bp.Q.value = 1.1;
      core.rpm.connect(gain(def.inK)).connect(bp.frequency);
      const am = gain(1);
      const lfo = krate(src(ctx.createOscillator()));
      lfo.frequency.value = 0;
      core.rpm.connect(gain(def.ev.length / 120)).connect(lfo.frequency);
      lfo.connect(gain(0.6)).connect(am.gain);
      core.intake = gain(0);
      nz.connect(bp).connect(am).connect(core.intake).connect(this.out);

      if (p.turbo > 0) {
        // spool whistle: two inharmonic partials + a breathy band, frequency from one control
        const f = src(ctx.createConstantSource());
        f.offset.value = 2000;
        const w1 = krate(src(ctx.createOscillator())), w2 = krate(src(ctx.createOscillator()));
        w1.frequency.value = 0;
        w2.frequency.value = 0;
        f.connect(w1.frequency);
        f.connect(gain(1.48)).connect(w2.frequency);
        const wg = gain(0);
        w1.connect(wg);
        w2.connect(gain(0.3)).connect(wg);
        const tn = src(ctx.createBufferSource(), true);
        tn.buffer = audio.noise('white');
        tn.loop = true;
        const tb = krate(mk(ctx.createBiquadFilter()));
        tb.type = 'bandpass';
        tb.Q.value = 1.6;
        tb.frequency.value = 0;
        f.connect(gain(0.75)).connect(tb.frequency);
        const sg = gain(0);
        tn.connect(tb).connect(sg);
        wg.connect(this.out);
        sg.connect(this.out);
        core.turbo = { f, whistle: wg, spool: sg };
      }
      if (p.supercharger) {
        // roots-blower whine locked to crank speed
        const o = krate(src(ctx.createOscillator()));
        o.setPeriodicWave(whineWave(ctx));
        o.frequency.value = 0;
        core.rpm.connect(gain(14 / 60)).connect(o.frequency);
        const hp = mk(ctx.createBiquadFilter());
        hp.type = 'highpass';
        hp.frequency.value = 350;
        core.sc = gain(0);
        o.connect(hp).connect(core.sc).connect(this.out);
      }
    }

    // engine loops start at offset 0 together (phase alignment); noise beds anywhere
    for (const s of core.srcs) {
      if (core.free.has(s)) s.start(t0, Math.random() * s.buffer.duration * 0.9);
      else s.start(t0);
    }
    this._applyTone(core);
    this._memo.fill(NaN);
    return core;
  }

  _applyTone(core) {
    const p = this.profile, def = core.def;
    const ps = Math.sqrt(p.pitch);
    if (core.pipe) core.pipe.gain.value = def.pipe[1] * (0.7 + 0.6 * p.exhaust);
    const bands = this.player ? def.eq : [def.eq[1]];
    core.eq.forEach((b, i) => {
      b.frequency.value = bands[i][0] * ps;
      // exhaust upgrade adds rasp on the top band and a little body
      const add = this.player ? (i === 2 ? def.ex * p.exhaust : i === 0 ? 1.5 * p.exhaust : 0) : 1.5 * p.exhaust;
      b.gain.value = bands[i][1] + add;
    });
    core.eqBase = core.eq.length > 2 ? core.eq[2].gain.value : 0;
  }

  update(dt, s = {}) {
    const core = this.core;
    if (!core || this._dead) return;
    const t = this.ctx.currentTime;
    const p = this.profile, def = core.def, sp = this.spatial, P = this.player, m = this._memo;
    dt = clamp(num(dt, 1 / 60), 0, 0.1);

    setSmooth(m, 17, this.spat.gain, sp.gain, t, 0.05, 0.01);
    setSmooth(m, 18, this.panner.pan, sp.pan, t, 0.05, 0.01);
    if (!P && sp.gain < 0.002) return; // inaudible AI car: skip the rest

    const rpm = clamp(num(s.rpm, p.idle), p.idle * 0.3, p.redline * 1.12);
    let thr = clamp(num(s.throttle, 0), 0, 1);
    let load = clamp(num(s.load, thr), -1, 1);
    const shifting = !!s.shifting;
    if (shifting) { thr = Math.min(thr, 0.05); load = Math.min(load, -0.2); }
    const nr = clamp((rpm - p.idle) / (p.redline - p.idle), 0, 1.15);
    const nr1 = Math.min(nr, 1);

    // one automation moves every loop's playbackRate together
    this._rpmEff = rpm * p.pitch * sp.doppler;
    setSmooth(m, 0, core.rpm.offset, this._rpmEff, t, TC_RPM, 0.0005);

    // combustion intensity: pedal, or the idle controller's fuel near idle
    const idleFuel = 0.8 * clamp(1 - (rpm - p.idle) / (0.5 * p.idle), 0, 1);
    const comb = Math.max(thr, idleFuel);
    const wOn = Math.sqrt(comb);
    const pull = Math.max(0, load);
    const loud = OUT_LEVEL * def.level * (P ? 1 : AI_TRIM) * (0.7 + 0.3 * Math.pow(nr1, 0.9));
    const dip = shifting ? 0.62 : 1;
    const lvOn = loud * (0.68 + 0.32 * thr * (0.6 + 0.4 * pull)) * dip;
    const lvOff = loud * (0.5 + 0.1 * Math.max(0, -load)) * dip;

    // rpm crossfade between neighbouring loops (log-rpm, phase-locked)
    const L = core.layers, n = L.length;
    let j = 0;
    while (j < n - 2 && rpm >= L[j + 1].base) j++;
    const x = clamp(Math.log(rpm / L[j].base) / Math.log(L[j + 1].base / L[j].base), 0, 1);
    const bump = 1 + 0.15 * Math.sin(Math.PI * x);
    for (let i = 0; i < n; i++) {
      const w = (i === j ? 1 - x : i === j + 1 ? x : 0) * bump;
      if (L[i].off) {
        setSmooth(m, 1 + i * 2, L[i].on.gain, w * wOn * lvOn, t, TC_GAIN);
        setSmooth(m, 2 + i * 2, L[i].off.gain, w * (1 - wOn) * lvOff, t, TC_GAIN);
      } else {
        setSmooth(m, 1 + i * 2, L[i].on.gain, w * (wOn * lvOn + (1 - wOn) * lvOff), t, TC_GAIN);
      }
    }

    // grit: distortion under load
    if (core.dist) {
      const d = clamp(thr * (0.3 + 0.7 * pull) * (0.55 + 0.45 * nr1) + 0.25 * p.exhaust * thr, 0, 1);
      setSmooth(m, 9, core.dist.gain, d * 0.3 * OUT_LEVEL * dip, t, TC_FILT);
    }

    // brightness: opens with rpm and load, closes on overrun
    const bright = clamp(0.25 + 0.3 * nr1 + 0.45 * thr * (0.45 + 0.55 * pull), 0, 1);
    let fc = def.lp[0] * Math.pow(def.lp[1] / def.lp[0], bright) * (1 + 0.3 * p.exhaust);
    if (!P) fc *= 0.35 + 0.65 * Math.sqrt(sp.gain); // distance darkens AI cars
    if (shifting) fc *= 0.7;
    setSmooth(m, 10, core.lp.frequency, fc, t, TC_FILT, 0.01);

    if (core.intake) {
      const vtecOn = def.vtec && rpm > def.vtec * p.redline && thr > 0.6 ? 1 : 0;
      this._vt += (vtecOn - this._vt) * Math.min(1, dt * 12);
      const lvl = def.intake * 0.1 * (0.05 + 0.95 * Math.pow(thr, 1.4)) * (0.3 + 0.7 * nr1) * (1 + 0.9 * this._vt) * dip;
      setSmooth(m, 11, core.intake.gain, lvl, t, TC_GAIN);
      if (def.vtec) setSmooth(m, 16, core.eq[2].gain, core.eqBase + 4 * this._vt, t, 0.03, 0.02);
    }

    if (core.turbo) {
      let boost;
      if (num(s.boost, null) !== null) boost = clamp(+s.boost, 0, 1);
      else {
        // no boost from the game: crude spool model
        const target = thr * clamp((nr - 0.2) / 0.45, 0, 1);
        this._boost += (target - this._boost) * Math.min(1, dt * (target > this._boost ? 2.2 : 7));
        boost = this._boost;
      }
      this._lastBoost = boost;
      setSmooth(m, 12, core.turbo.f.offset, (1500 + 4600 * Math.pow(boost, 0.85)) * sp.doppler, t, 0.06, 0.003);
      setSmooth(m, 13, core.turbo.whistle.gain, p.turbo * 0.026 * Math.pow(boost, 1.6) * (0.35 + 0.65 * thr), t, TC_GAIN);
      setSmooth(m, 14, core.turbo.spool.gain, p.turbo * 0.05 * boost * thr, t, TC_GAIN);
    }
    if (core.sc) {
      setSmooth(m, 15, core.sc.gain, 0.02 * (0.2 + 0.8 * thr) * (0.15 + 0.85 * nr1) * dip, t, TC_GAIN);
    }

    // rev limiter: rhythmic fuel-cut stutter scheduled ahead in audio time
    if (s.limiter && !shifting) {
      if (!this._lim) { this._lim = true; this._limT = t; }
      while (this._limT < t + 0.1) {
        const at = Math.max(this._limT, t);
        const per = 1 / (14 + 4 * Math.random());
        core.cut.gain.setTargetAtTime(0.16, at, 0.0035);
        core.cut.gain.setTargetAtTime(1, at + per * 0.42, 0.005);
        if (p.exhaust > 0.35 && Math.random() < 0.3 * p.exhaust) {
          this._pop((0.15 + 0.35 * Math.random()) * p.exhaust * loud, at + 0.004, true);
        }
        this._limT = at + per;
      }
    } else if (this._lim) {
      this._lim = false;
      core.cut.gain.cancelScheduledValues(t);
      core.cut.gain.setTargetAtTime(1, t, 0.008);
    }

    // decel crackle on the overrun for loud exhausts
    if (p.exhaust > 0.3 && load < -0.05 && thr < 0.1 && nr > 0.18 && !this._lim && (P || sp.gain > 0.1)) {
      const rate = ((p.exhaust - 0.3) / 0.7) * (3 + 10 * nr1);
      if (Math.random() < rate * dt) {
        this._pop((0.3 + 0.5 * Math.random()) * p.exhaust * (0.6 + 0.4 * nr1), t + Math.random() * 0.015, Math.random() < 0.6);
      }
    }
  }

  setSpatial({ gain = 1, pan = 0, doppler = 1 } = {}) {
    this.spatial.gain = clamp(num(gain, 0), 0, 1);
    this.spatial.pan = clamp(num(pan, 0), -1, 1);
    this.spatial.doppler = clamp(num(doppler, 1), 0.5, 2);
    if (this.core && !this._dead) {
      const t = this.ctx.currentTime;
      setSmooth(this._memo, 17, this.spat.gain, this.spatial.gain, t, 0.05, 0.01);
      setSmooth(this._memo, 18, this.panner.pan, this.spatial.pan, t, 0.05, 0.01);
    }
  }

  _pop(amp, when, bright = true) {
    if (this._pops >= 10 || !(amp > 0.002)) return;
    const ctx = this.ctx, set = popBuffers(ctx);
    const list = bright ? set.bright : set.dull;
    const s = ctx.createBufferSource();
    s.buffer = list[(Math.random() * list.length) | 0];
    s.playbackRate.value = 0.85 + Math.random() * 0.35;
    const g = ctx.createGain();
    g.gain.value = Math.min(1, amp);
    s.connect(g).connect(this.popBus);
    this._pops++;
    s.onended = () => { this._pops--; s.disconnect(); g.disconnect(); };
    s.start(Math.max(when, ctx.currentTime));
  }

  /** Exhaust pop/crackle burst. Louder and longer with an aftermarket exhaust. */
  backfire(strength = 1) {
    if (!this.core || this._dead) return;
    const st = clamp(num(strength, 0), 0, 1);
    if (st <= 0) return;
    const ex = this.profile.exhaust;
    const count = 1 + Math.round(st * (1 + 4 * ex) * (0.5 + 0.5 * Math.random()));
    const amp = st * (0.35 + 0.65 * ex);
    let at = this.ctx.currentTime + 0.005;
    for (let i = 0; i < count; i++) {
      this._pop(amp * (i === 0 ? 1 : 0.3 + 0.55 * Math.random()), at, ex > 0.35 || Math.random() < ex);
      at += 0.025 + Math.random() * (0.05 + 0.08 * ex);
    }
  }

  /** Turbo blow-off valve. No-op on naturally aspirated engines. */
  blowOff() {
    if (!this.core || this._dead || !(this.profile.turbo > 0)) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (t - this._lastBov < 0.35) return;
    this._lastBov = t;
    const list = bovBuffers(ctx);
    const s = ctx.createBufferSource();
    s.buffer = list[(Math.random() * list.length) | 0];
    s.playbackRate.value = (0.9 + 0.2 * Math.random()) * this.spatial.doppler;
    const g = ctx.createGain();
    g.gain.value = 0.42 * (0.45 + 0.55 * this.profile.turbo) * (0.55 + 0.45 * Math.max(this._lastBoost, 0.5));
    s.connect(g).connect(this.out);
    this._pops++;
    s.onended = () => { this._pops--; s.disconnect(); g.disconnect(); };
    s.start(t);
  }

  /** Live garage changes. Layout/rpm range/induction changes rebuild the loops with a short crossfade. */
  setProfile(profile = {}) {
    const old = this.profile;
    const np = normProfile({ ...old, ...profile });
    this.profile = np;
    if (!this.core || this._dead) return;
    const structural = np.layout !== old.layout || np.idle !== old.idle || np.redline !== old.redline ||
      (np.turbo > 0) !== (old.turbo > 0) || np.supercharger !== old.supercharger;
    if (!structural) {
      this._applyTone(this.core);
      return;
    }
    const t = this.ctx.currentTime;
    const prev = this.core;
    this.core = this._buildCore(t + 0.005);
    prev.cut.gain.cancelScheduledValues(t);
    prev.cut.gain.setTargetAtTime(0, t, 0.03);
    this._retire(prev, t + 0.25);
    this._lim = false;
  }

  _retire(core, at) {
    for (const s of core.srcs) {
      try { s.stop(at); } catch { /* already stopped */ }
    }
    core.srcs[0].onended = () => {
      for (const n of core.nodes) n.disconnect();
    };
  }

  /** Fade out and release everything. */
  stop() {
    if (this._dead) return;
    this._dead = true;
    if (!this.core) return;
    const t = this.ctx.currentTime;
    this.spat.gain.cancelScheduledValues(t);
    this.spat.gain.setTargetAtTime(0, t, 0.04);
    const core = this.core;
    this._retire(core, t + 0.3);
    const prevEnded = core.srcs[0].onended;
    core.srcs[0].onended = () => {
      prevEnded();
      for (const n of this._nodes) n.disconnect();
      this.core = null;
    };
  }
}

// exposed for the offline QA harness (qa/audio)
export const _internals = { LAYOUTS, layerPlan, renderCycle };
