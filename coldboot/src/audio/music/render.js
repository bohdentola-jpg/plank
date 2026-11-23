// Offline renderers: drum hits, Karplus–Strong strings and synth multisamples,
// written with plain JS loops into AudioBuffers the first time they're needed
// and cached per AudioContext (LRU-bounded). Triggered later as
// AudioBufferSourceNodes, so a drum hit or a supersaw note costs ~2 nodes.
//
// Looped multisamples (supersaw, pads, strings, choir, square) are built in the
// frequency domain: every partial sits exactly on an FFT bin, so one inverse
// FFT gives a perfectly seamless, alias-free loop; filters and vocal formants
// are just spectral weights. Left/right are packed into one complex iFFT.

import { mtof } from './util.js';

const TAU = Math.PI * 2;
const banks = new WeakMap();
const BUDGET = 56 * 1024 * 1024; // bytes of cached sample data per context

export function bank(ctx) {
  let b = banks.get(ctx);
  if (!b) { b = new Bank(ctx); banks.set(ctx, b); }
  return b;
}

// --- tiny DSP helpers ------------------------------------------------------

function coefs(type, f, q, sr, gainDb = 0) {
  const w = (TAU * Math.min(f, sr * 0.45)) / sr;
  const cw = Math.cos(w), sw = Math.sin(w), a = sw / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + a; a1 = -2 * cw; a2 = 1 - a; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + a; a1 = -2 * cw; a2 = 1 - a; }
  else if (type === 'bp') { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * cw; a2 = 1 - a; }
  else { // peaking
    const A = Math.pow(10, gainDb / 40);
    b0 = 1 + a * A; b1 = -2 * cw; b2 = 1 - a * A; a0 = 1 + a / A; a1 = -2 * cw; a2 = 1 - a / A;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function biq(x, type, f, q, sr, g) {
  const [b0, b1, b2, a1, a2] = coefs(type, f, q, sr, g);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

// state-variable filter (TPT), cheap to modulate
class SVF {
  constructor(sr) { this.sr = sr; this.ic1 = 0; this.ic2 = 0; this.bp = 0; this.set(1000, 0.7); }
  set(f, q) {
    const g = Math.tan((Math.PI * Math.min(f, this.sr * 0.45)) / this.sr);
    this.k = 1 / q; this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  run(x) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    this.bp = v1;
    return v2; // lowpass
  }
}

function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

const SIN_N = 4096;
const SIN = new Float32Array(SIN_N + 1);
for (let i = 0; i <= SIN_N; i++) SIN[i] = Math.sin((TAU * i) / SIN_N);
const tsin = (ph) => SIN[((ph - Math.floor(ph)) * SIN_N) | 0]; // phase in cycles

function fadeOut(d, sr, sec) {
  const n = Math.min(d.length, Math.floor(sr * sec));
  for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n;
}
function fadeIn(d, sr, sec) {
  const n = Math.min(d.length, Math.floor(sr * sec));
  for (let i = 0; i < n; i++) d[i] *= i / n;
}
function peakOf(buf) {
  let p = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; }
  }
  return p;
}
function rmsOf(buf) {
  let s = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    n += d.length;
  }
  return Math.sqrt(s / Math.max(1, n));
}
function scale(buf, k) {
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return buf;
}
const normPeak = (buf, p = 0.9) => scale(buf, p / Math.max(1e-6, peakOf(buf)));
const normRms = (buf, r = 0.2) => scale(buf, r / Math.max(1e-6, rmsOf(buf)));
const sat = (x, k) => Math.tanh(k * x) / k;

// --- FFT (iterative radix-2, inverse) -------------------------------------------
const fftTabs = new Map();
function fftTables(n) {
  let t = fftTabs.get(n);
  if (!t) {
    const bits = Math.log2(n);
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0, x = i;
      for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; }
      rev[i] = r;
    }
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((TAU * i) / n); sin[i] = Math.sin((TAU * i) / n); }
    t = { rev, cos, sin };
    fftTabs.set(n, t);
  }
  return t;
}

function ifft(re, im) {
  const n = re.length, { rev, cos, sin } = fftTables(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cos[k], wi = sin[k];
        const a = i + j, b = a + half;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

// --- the bank ---------------------------------------------------------------

class Bank {
  constructor(ctx) {
    this.ctx = ctx;
    this.sr = ctx.sampleRate;
    this.c = new Map();
    this.bytes = 0;
    this.s = 0x2545f491;
  }

  noise() { // xorshift32 → [-1, 1)
    let x = this.s;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 2147483648 - 1;
  }

  make(chs, secs, rate = this.sr) {
    return this.ctx.createBuffer(chs, Math.max(32, Math.round(secs * rate)), rate);
  }

  _put(key, val) {
    const b = val.buf || val;
    val._bytes = b.length * b.numberOfChannels * 4;
    this.c.set(key, val);
    this.bytes += val._bytes;
    if (this.bytes > BUDGET) {
      for (const [k, v] of this.c) {
        if (this.bytes <= BUDGET * 0.8) break;
        if (k === key || v._keep) continue;
        this.c.delete(k);
        this.bytes -= v._bytes;
      }
    }
    return val;
  }

  _get(key) {
    const v = this.c.get(key);
    if (v && !v._keep) { this.c.delete(key); this.c.set(key, v); } // LRU touch
    return v;
  }

  has(key) { return this.c.has(key); }

  /** Drum / fx one-shot by name. */
  get(name) {
    let b = this._get(name);
    if (!b) {
      const fn = DRUMS[name];
      if (!fn) throw new Error(`no sample ${name}`);
      b = fn(this);
      b._keep = true;
      this._put(name, b);
    }
    return b;
  }

  msKey(kind, midi) {
    const spec = MS[kind];
    return `${kind}:${Math.ceil(midi / spec.step) * spec.step}`;
  }

  /** Synth multisample: returns { buf, rate, loop } for a MIDI note. */
  ms(kind, midi) {
    const spec = MS[kind];
    const ref = Math.ceil(midi / spec.step) * spec.step;
    const key = `${kind}:${ref}`;
    let e = this._get(key);
    if (!e) e = this._put(key, spec.fn(this, ref));
    return { buf: e.buf, rate: mtof(midi) / e.f, loop: !!spec.loop };
  }

  /** Karplus–Strong string (exact pitch). variant: gtr mute pow powm twang upright */
  ks(variant, midi) {
    const key = `ks:${variant}:${midi}`;
    let b = this._get(key);
    if (!b) b = this._put(key, KS[variant](this, midi));
    return b;
  }
}

export const DRUM_NAMES = () => Object.keys(DRUMS);
export const MS_KINDS = () => Object.keys(MS);

// --- drums --------------------------------------------------------------------

function kick(B, o) {
  const { f0 = 150, f1 = 50, pd = 0.035, ad = 0.2, len = 0.55, click = 0.5, drive = 1.8, tail = 0.3, lp = 0 } = o;
  const sr = B.sr, buf = B.make(1, len), d = buf.getChannelData(0);
  let ph = 0, pn = 0;
  const kp = Math.exp(-1 / (pd * sr)), ka = Math.exp(-1 / (ad * sr)), kt = Math.exp(-1 / (ad * 3 * sr));
  const kc = Math.exp(-1 / (0.0011 * sr)), kb = Math.exp(-1 / (0.0028 * sr));
  let ep = 1, ea = 1, et = 1, ec = 1, eb = 1;
  const nd = Math.tanh(drive);
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * ep;
    ph += f / sr;
    const env = Math.min(1, t / 0.0012) * ((1 - tail) * ea + tail * et);
    let s = tsin(ph) * env;
    const n = B.noise();
    s += click * ((n - pn) * 0.22 * ec + 0.3 * tsin(1600 * t) * eb);
    pn = n;
    d[i] = Math.tanh(drive * s) / nd;
    ep *= kp; ea *= ka; et *= kt; ec *= kc; eb *= kb;
  }
  if (lp) biq(d, 'lp', lp, 0.7, sr);
  fadeOut(d, sr, 0.03);
  return normPeak(buf, 0.95);
}

function snare(B, o) {
  const {
    body = [185, 330], bd = 0.055, hp = 1200, bright = 5000, nd = 0.1, n2 = 0.2, nd2 = 0.22,
    len = 0.45, drive = 1.8, bodyAmt = 0.55, noiseAmt = 0.9, lp = 0, stereo = false,
  } = o;
  const sr = B.sr, chs = stereo ? 2 : 1, buf = B.make(chs, len);
  const n = buf.length;
  const bodyArr = new Float32Array(n);
  const ph = body.map(() => 0);
  let eb = 1;
  const kb = Math.exp(-1 / (bd * sr));
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let b = 0;
    const bend = 1 + 0.12 * Math.exp(-t / 0.012);
    for (let k = 0; k < body.length; k++) {
      ph[k] += (body[k] * bend) / sr;
      b += tsin(ph[k]) * (k ? 0.6 : 1);
    }
    bodyArr[i] = bodyAmt * b * eb * Math.min(1, t / 0.0006);
    eb *= kb;
  }
  const dn = Math.tanh(drive);
  for (let c = 0; c < chs; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = B.noise();
    biq(d, 'hp', hp, 0.7, sr);
    biq(d, 'peak', bright, 0.8, sr, 6);
    let e1 = 1, e2 = 1;
    const k1 = Math.exp(-1 / (nd * sr)), k2 = Math.exp(-1 / (nd2 * sr));
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / (sr * 0.0006));
      const s = bodyArr[i] + noiseAmt * d[i] * (e1 + n2 * e2) * env;
      d[i] = Math.tanh(drive * s) / dn;
      e1 *= k1; e2 *= k2;
    }
    if (lp) biq(d, 'lp', lp, 0.7, sr);
    fadeOut(d, sr, 0.04);
  }
  return normPeak(buf, 0.9);
}

function clap(B, o = {}) {
  const { len = 0.45, decay = 0.11, f = 1200, q = 1.1, spread = 0.0095, bursts = 4, lp = 9000 } = o;
  const sr = B.sr, buf = B.make(2, len);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = B.noise();
    biq(d, 'bp', f * (c ? 1.06 : 1), q, sr);
    biq(d, 'hp', 500, 0.7, sr);
    biq(d, 'lp', lp, 0.7, sr);
    const sp = spread * (c ? 1.12 : 1);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      let e = 0;
      for (let k = 0; k < bursts; k++) {
        const tk = k * sp;
        if (t >= tk) e = Math.max(e, Math.exp(-(t - tk) / 0.0055) * (k === bursts - 1 ? 1 : 0.8));
      }
      const tl = (bursts - 1) * sp;
      if (t >= tl) e = Math.max(e, 0.7 * Math.exp(-(t - tl) / decay));
      d[i] *= e;
    }
    fadeOut(d, sr, 0.03);
  }
  return normPeak(buf, 0.9);
}

function metal(B, o) {
  // 808-style six-square cluster, band-passed: hats
  const { len = 0.3, decay = 0.045, tune = 1, hp = 7000, bp = 10000, bq = 0.9, noiseAmt = 0.35, lp = 0, attack = 0.0004 } = o;
  const F = [205.3, 304.4, 369.6, 522.7, 540, 800];
  const sr = B.sr, buf = B.make(2, len);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const ph = F.map(() => B.noise() * 0.5 + 0.5);
    const inc = F.map((f) => (f * tune * (c ? 1.004 : 1) * 1.7) / sr);
    const ke = Math.exp(-1 / (decay * sr));
    let e = 1;
    for (let i = 0; i < d.length; i++) {
      let s = 0;
      for (let k = 0; k < 6; k++) {
        ph[k] += inc[k]; if (ph[k] >= 1) ph[k] -= 1;
        s += ph[k] < 0.5 ? 1 : -1;
      }
      d[i] = s / 6 + noiseAmt * B.noise();
    }
    biq(d, 'bp', bp, bq, sr);
    biq(d, 'hp', hp, 0.7, sr);
    if (lp) biq(d, 'lp', lp, 0.7, sr);
    const an = attack * sr;
    for (let i = 0; i < d.length; i++) { d[i] *= Math.min(1, i / an) * e; e *= ke; }
    fadeOut(d, sr, 0.01);
  }
  return normPeak(buf, 0.85);
}

function cymbal(B, o) {
  const { len = 2.6, decay = 0.9, hp = 3000, n = 10, fmin = 340, fmax = 9500, noiseAmt = 0.55, ping = 0, pingF = 3100, pingDecay = 0.3, tone = 7500, tg = 4, atk = 0.0015, fast = 0.4 } = o;
  const sr = B.sr, buf = B.make(2, len), N = buf.length;
  // shared metallic cluster (+ ride ping); noise is per channel for width
  const met = new Float32Array(N);
  const fr = [], ph = [];
  for (let k = 0; k < n; k++) {
    const u = B.noise() * 0.5 + 0.5;
    fr.push((fmin * Math.pow(fmax / fmin, u)) / sr);
    ph.push(B.noise() * 0.5 + 0.5);
  }
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = 0; k < n; k++) {
      ph[k] += fr[k]; if (ph[k] >= 1) ph[k] -= 1;
      s += ph[k] < 0.5 ? 1 : -1;
    }
    met[i] = s / n;
  }
  const pingArr = new Float32Array(N);
  if (ping) {
    const R = [1, 1.47, 2.09, 2.56];
    let ep = ping;
    const kp = Math.exp(-1 / (pingDecay * sr));
    const pp = R.map(() => 0);
    for (let i = 0; i < N; i++) {
      let p = 0;
      for (let k = 0; k < 4; k++) { pp[k] += (pingF * R[k]) / sr; p += tsin(pp[k]) / (k + 1); }
      pingArr[i] = p * ep;
      ep *= kp;
    }
  }
  const k1 = Math.exp(-1 / (decay * sr)), k2 = Math.exp(-1 / (0.06 * sr));
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let e1 = 1, e2 = 1;
    const an = atk * sr;
    for (let i = 0; i < N; i++) {
      const env = Math.min(1, i / an) * ((1 - fast) * e1 + fast * e2);
      d[i] = (met[i] + noiseAmt * B.noise()) * env + pingArr[i];
      e1 *= k1; e2 *= k2;
    }
    biq(d, 'hp', hp * (c ? 1.05 : 1), 0.7, sr);
    biq(d, 'peak', tone, 0.7, sr, tg);
    fadeOut(d, sr, 0.3);
  }
  return normPeak(buf, 0.85);
}

function tom(B, f, o = {}) {
  const { len = 0.6, decay = 0.24, drop = 0.7 } = o;
  const sr = B.sr, buf = B.make(1, len), d = buf.getChannelData(0);
  let ph = 0, lpn = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    const ff = f * (drop + (1 - drop) * Math.exp(-t / 0.12));
    ph += ff / sr;
    lpn += 0.25 * (B.noise() - lpn);
    const s = tsin(ph) * Math.exp(-t / decay) + lpn * 0.5 * Math.exp(-t / 0.02);
    d[i] = Math.tanh(1.6 * s * Math.min(1, t / 0.001));
  }
  fadeOut(d, sr, 0.05);
  return normPeak(buf, 0.9);
}

function noiseHit(B, o) {
  // shaker / tambourine / brushes / snaps: shaped noise bursts
  const { len = 0.2, f = 6500, q = 1.2, hp = 3000, atk = 0.005, decay = 0.035, curve = 1, stereo = true, jingle = 0, lp = 0, thump = 0 } = o;
  const sr = B.sr, chs = stereo ? 2 : 1, buf = B.make(chs, len);
  for (let c = 0; c < chs; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = B.noise();
    biq(d, 'bp', f * (c ? 1.05 : 1), q, sr);
    if (hp) biq(d, 'hp', hp, 0.7, sr);
    if (lp) biq(d, 'lp', lp, 0.7, sr);
    const jf = [7100, 9300, 11200, 8300];
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const e = t < atk ? Math.pow(t / atk, curve) : Math.exp(-(t - atk) / decay);
      let s = d[i];
      if (jingle) {
        let j = 0;
        for (let k = 0; k < 4; k++) j += tsin(jf[k] * (c ? 1.01 : 1) * t + k * 0.17);
        s += jingle * j * 0.25 * Math.abs(B.noise());
      }
      if (thump) s += thump * tsin(170 * t) * Math.exp(-t / 0.03);
      d[i] = s * e;
    }
    fadeOut(d, sr, 0.01);
  }
  return normPeak(buf, 0.85);
}

function rim(B) {
  const sr = B.sr, buf = B.make(1, 0.12), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    d[i] = (tsin(1720 * t) * 0.6 + tsin(830 * t) * 0.5) * Math.exp(-t / 0.011) + B.noise() * 0.5 * Math.exp(-t / 0.0035);
  }
  biq(d, 'hp', 300, 0.7, sr);
  fadeOut(d, sr, 0.01);
  return normPeak(buf, 0.9);
}

function conga(B, f) {
  const sr = B.sr, buf = B.make(1, 0.45), d = buf.getChannelData(0);
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    ph += (f * (1 + 0.08 * Math.exp(-t / 0.02))) / sr;
    d[i] = tsin(ph) * Math.exp(-t / 0.13) + B.noise() * 0.25 * Math.exp(-t / 0.004);
  }
  fadeOut(d, sr, 0.03);
  return normPeak(buf, 0.9);
}

function impact(B, o = {}) {
  const { len = 2.4, f0 = 85, f1 = 30, decay = 0.75, noiseAmt = 0.6 } = o;
  const sr = B.sr, buf = B.make(2, len), N = buf.length;
  const sub = new Float32Array(N), nz = new Float32Array(N);
  let ph = 0, e = 1, ep = 1, en = 1;
  const ke = Math.exp(-1 / (decay * sr)), kp = Math.exp(-1 / (0.35 * sr)), kn = Math.exp(-1 / (0.5 * sr));
  const lp = new SVF(sr);
  for (let i = 0; i < N; i++) {
    ph += (f1 + (f0 - f1) * ep) / sr;
    sub[i] = tsin(ph) * e * Math.min(1, i / (sr * 0.002));
    if ((i & 31) === 0) lp.set(150 + 5000 * Math.exp(-i / (sr * 0.08)), 0.8);
    nz[i] = lp.run(B.noise()) * noiseAmt * en;
    e *= ke; ep *= kp; en *= kn;
  }
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const off = c ? Math.round(sr * 0.007) : 0; // Haas width on the noise
    for (let i = 0; i < N; i++) d[i] = Math.tanh(1.8 * (sub[i] + (i >= off ? nz[i - off] : 0))) / 1.4;
    fadeOut(d, sr, 0.4);
  }
  return normPeak(buf, 0.95);
}

function crackle(B) {
  const sr = B.sr, len = 4, buf = B.make(2, len);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let hiss = 0, rum = 0;
    for (let i = 0; i < d.length; i++) {
      const n = B.noise();
      hiss = n - hiss * 0.2;
      rum += 0.004 * (B.noise() - rum);
      d[i] = hiss * 0.012 + rum * 0.4;
    }
    const count = Math.floor(len * 26);
    for (let k = 0; k < count; k++) {
      const pos = Math.floor((B.noise() * 0.5 + 0.5) * (d.length - 400));
      const big = B.noise() > 0.85;
      const amp = (big ? 0.5 : 0.12) * (0.4 + 0.6 * Math.abs(B.noise()));
      const tau = big ? 40 : 6 + 8 * Math.abs(B.noise());
      const sgn = B.noise() > 0 ? 1 : -1;
      for (let j = 0; j < 300; j++) d[pos + j] += sgn * amp * Math.exp(-j / tau) * (j % 2 ? -0.6 : 1);
    }
    biq(d, 'hp', 40, 0.7, sr);
    biq(d, 'lp', 7000, 0.7, sr);
    const x = Math.floor(sr * 0.05);
    for (let i = 0; i < x; i++) { // seamless loop: crossfade the tail into the head
      const k = i / x;
      d[i] = d[i] * k + d[d.length - x + i] * (1 - k);
    }
  }
  const b2 = B.make(2, len - 0.05);
  for (let c = 0; c < 2; c++) b2.getChannelData(c).set(buf.getChannelData(c).subarray(0, b2.length));
  return normPeak(b2, 0.6);
}

function shepard(B) {
  // Shepard–Risset glissando: endlessly rising, one octave per 4 s, loops seamlessly
  const sr = B.sr, T = 4, K = 7, fmin = 55;
  const n = Math.round(sr * T), x = Math.round(sr * 0.25), total = n + x;
  const tmp = new Float32Array(total);
  const ratio = Math.pow(2, 1 / (T * sr)), wrap = Math.pow(2, K);
  const dOct = 1 / (T * sr * K);
  const f = [], ph = [], oct = [];
  for (let k = 0; k < K; k++) { f.push(fmin * Math.pow(2, k)); ph.push(k * 0.37); oct.push(k / K); }
  for (let i = 0; i < total; i++) {
    let s = 0;
    for (let k = 0; k < K; k++) {
      f[k] *= ratio;
      oct[k] += dOct;
      if (oct[k] >= 1) { oct[k] -= 1; f[k] /= wrap; }
      ph[k] += f[k] / sr;
      const w = tsin(oct[k] * 0.5);
      s += w * w * (tsin(ph[k]) + 0.45 * tsin(2 * ph[k]));
    }
    tmp[i] = s;
  }
  const buf = B.make(2, T);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) L[i] = tmp[i];
  for (let i = 0; i < x; i++) { const k = i / x; L[i] = tmp[n + i] * (1 - k) + tmp[i] * k; }
  const off = Math.round(sr * 0.006);
  for (let i = 0; i < n; i++) R[i] = L[(i - off + n) % n];
  return normPeak(buf, 0.7);
}

function clank(B) {
  const sr = B.sr, buf = B.make(2, 1.2), N = buf.length;
  const P = [1, 2.76, 5.4, 8.93, 13.34, 17.2], D = [0.55, 0.32, 0.2, 0.12, 0.08, 0.05];
  const mono = new Float32Array(N);
  P.forEach((p, k) => {
    const w = (TAU * 172 * p) / sr, c2 = 2 * Math.cos(w);
    let y1 = Math.sin(-w + k), y2 = Math.sin(-2 * w + k);
    let e = 1 / (1 + k * 0.4);
    const kd = Math.exp(-1 / (D[k] * sr));
    for (let i = 0; i < N; i++) {
      const y = c2 * y1 - y2; y2 = y1; y1 = y;
      mono[i] += y * e;
      e *= kd;
    }
  });
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < N; i++) d[i] = Math.tanh(1.5 * (mono[i] + B.noise() * 0.6 * Math.exp(-i / (sr * 0.01))));
    biq(d, 'hp', 120 * (c ? 1.1 : 1), 0.7, sr);
    fadeIn(d, sr, 0.001);
    fadeOut(d, sr, 0.2);
  }
  return normPeak(buf, 0.9);
}

function zap(B) {
  const sr = B.sr, buf = B.make(1, 0.4), d = buf.getChannelData(0);
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    ph += (2600 * Math.exp(-t / 0.05) + 90) / sr;
    const p = ph % 1;
    d[i] = (tsin(p) * 0.7 + (p < 0.5 ? 0.3 : -0.3)) * Math.exp(-t / 0.11);
  }
  fadeIn(d, sr, 0.001);
  fadeOut(d, sr, 0.05);
  return normPeak(buf, 0.8);
}

function sweep(B, o) {
  // noise sweep (downlifter / uplifter) with a resonant band-pass
  const { len = 2.5, f0 = 7000, f1 = 160, q = 2.2, up = false } = o;
  const sr = B.sr, buf = B.make(2, len);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const svf = new SVF(sr);
    for (let i = 0; i < d.length; i++) {
      const u = i / d.length;
      if ((i & 31) === 0) svf.set(f0 * Math.pow(f1 / f0, u), q);
      svf.run(B.noise());
      const e = up ? u * u : Math.pow(1 - u, 1.6);
      d[i] = svf.bp * e * Math.min(1, i / (sr * 0.01));
    }
    fadeOut(d, sr, 0.05);
  }
  return normPeak(buf, 0.8);
}

function reverseOf(B, name, secs) {
  const src = B.get(name);
  const n = Math.min(src.length, Math.round(secs * B.sr));
  const buf = B.make(src.numberOfChannels, n / B.sr);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const s = src.getChannelData(c), d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = s[n - 1 - i];
    fadeIn(d, B.sr, 0.05);
    fadeOut(d, B.sr, 0.004);
  }
  return buf;
}

const DRUMS = {
  kick_dnb: (B) => kick(B, { f0: 175, f1: 52, pd: 0.028, ad: 0.15, tail: 0.25, click: 0.7, drive: 2.4, len: 0.45 }),
  kick_house: (B) => kick(B, { f0: 135, f1: 47, pd: 0.045, ad: 0.2, tail: 0.32, click: 0.45, drive: 1.9, len: 0.6 }),
  kick_bb: (B) => kick(B, { f0: 115, f1: 47, pd: 0.05, ad: 0.17, tail: 0.38, click: 0.25, drive: 2.8, len: 0.6, lp: 3500 }),
  kick_rock: (B) => kick(B, { f0: 125, f1: 57, pd: 0.024, ad: 0.12, tail: 0.18, click: 1.1, drive: 1.7, len: 0.45 }),
  kick_808: (B) => kick(B, { f0: 92, f1: 43, pd: 0.06, ad: 0.45, tail: 0.5, click: 0.15, drive: 1.5, len: 1.4 }),
  kick_metal: (B) => kick(B, { f0: 175, f1: 62, pd: 0.018, ad: 0.085, tail: 0.15, click: 1.3, drive: 2.1, len: 0.3 }),
  kick_euro: (B) => kick(B, { f0: 185, f1: 50, pd: 0.032, ad: 0.17, tail: 0.3, click: 0.9, drive: 2.6, len: 0.5 }),
  kick_soft: (B) => kick(B, { f0: 95, f1: 52, pd: 0.035, ad: 0.13, tail: 0.2, click: 0.1, drive: 1.2, len: 0.4, lp: 2500 }),

  snare_dnb: (B) => snare(B, { body: [195, 345], bd: 0.045, hp: 1500, bright: 5200, nd: 0.085, n2: 0.25, nd2: 0.17, drive: 2.3, len: 0.38 }),
  snare_bb: (B) => snare(B, { body: [168, 285], bd: 0.07, hp: 900, bright: 3300, nd: 0.13, n2: 0.35, nd2: 0.32, drive: 2.6, len: 0.6, lp: 6500 }),
  snare_rock: (B) => snare(B, { body: [176, 315], bd: 0.08, hp: 650, bright: 3800, nd: 0.15, n2: 0.4, nd2: 0.42, drive: 1.7, len: 0.8, stereo: true }),
  snare_tight: (B) => snare(B, { body: [225, 410], bd: 0.035, hp: 2000, bright: 7000, nd: 0.07, n2: 0.18, nd2: 0.14, drive: 1.9, len: 0.32 }),
  snare_ghost: (B) => snare(B, { body: [205, 360], bd: 0.025, hp: 1600, bright: 5000, nd: 0.045, n2: 0, drive: 1.1, len: 0.14, lp: 6500, bodyAmt: 0.4 }),
  snare_soft: (B) => snare(B, { body: [180, 300], bd: 0.06, hp: 1000, bright: 3000, nd: 0.12, n2: 0.3, nd2: 0.3, drive: 1.3, len: 0.55, lp: 5000 }),

  clap: (B) => clap(B, {}),
  clap_big: (B) => clap(B, { decay: 0.2, bursts: 5, spread: 0.011, f: 1050, len: 0.65 }),

  hat_c: (B) => metal(B, { decay: 0.038, len: 0.2 }),
  hat_c2: (B) => metal(B, { decay: 0.022, len: 0.14, tune: 1.18, hp: 8000 }),
  hat_o: (B) => metal(B, { decay: 0.26, len: 0.7, noiseAmt: 0.45 }),
  hat_p: (B) => metal(B, { decay: 0.018, len: 0.12, hp: 5000, bp: 7500, noiseAmt: 0.25 }),
  hat_dusty: (B) => metal(B, { decay: 0.035, len: 0.18, lp: 7500, hp: 5500, bp: 8500, noiseAmt: 0.6 }),
  hat_odusty: (B) => metal(B, { decay: 0.2, len: 0.55, lp: 7500, hp: 5500, bp: 8500, noiseAmt: 0.6 }),

  crash: (B) => cymbal(B, { len: 2.6, decay: 0.95 }),
  crash2: (B) => cymbal(B, { len: 1.7, decay: 0.55, hp: 4000, tone: 9000, fmin: 500 }),
  ride: (B) => cymbal(B, { len: 1.6, decay: 0.65, hp: 2500, n: 8, fmin: 2500, fmax: 7000, noiseAmt: 0.25, ping: 0.35, pingF: 3300, pingDecay: 0.35, fast: 0.15, tg: 2 }),
  ride_bell: (B) => cymbal(B, { len: 1.4, decay: 0.5, hp: 1800, n: 6, fmin: 2000, fmax: 5000, noiseAmt: 0.1, ping: 0.9, pingF: 2400, pingDecay: 0.6, fast: 0.1 }),
  china: (B) => cymbal(B, { len: 1.5, decay: 0.45, hp: 1800, n: 14, fmin: 400, fmax: 6000, noiseAmt: 0.8, tone: 3500, tg: 6, fast: 0.5 }),
  splash: (B) => cymbal(B, { len: 1.0, decay: 0.28, hp: 5000, tone: 10000, fmin: 800 }),

  tom_h: (B) => tom(B, 210),
  tom_m: (B) => tom(B, 155),
  tom_l: (B) => tom(B, 108, { decay: 0.3 }),
  tom_f: (B) => tom(B, 78, { decay: 0.38, len: 0.8 }),

  rim: (B) => rim(B),
  shaker: (B) => noiseHit(B, { len: 0.16, f: 6800, q: 1.3, hp: 4000, atk: 0.008, decay: 0.03, curve: 2 }),
  tamb: (B) => noiseHit(B, { len: 0.3, f: 8500, q: 0.9, hp: 5000, atk: 0.0015, decay: 0.09, jingle: 1.4 }),
  snap: (B) => noiseHit(B, { len: 0.15, f: 2300, q: 2.2, hp: 900, atk: 0.0008, decay: 0.014, stereo: false }),
  brush: (B) => noiseHit(B, { len: 0.25, f: 3200, q: 0.6, hp: 900, lp: 9000, atk: 0.002, decay: 0.055, thump: 0.4 }),
  sweep: (B) => noiseHit(B, { len: 0.6, f: 4200, q: 0.5, hp: 1500, lp: 9000, atk: 0.2, decay: 0.15, curve: 2 }),
  conga_h: (B) => conga(B, 395),
  conga_l: (B) => conga(B, 285),

  impact: (B) => impact(B, {}),
  boom: (B) => impact(B, { len: 1.2, f0: 110, f1: 45, decay: 0.3, noiseAmt: 0.45 }),
  crackle: (B) => crackle(B),
  shepard: (B) => shepard(B),
  clank: (B) => clank(B),
  zap: (B) => zap(B),
  down: (B) => sweep(B, { len: 2.4, f0: 7000, f1: 160 }),
  up: (B) => sweep(B, { len: 2.0, f0: 300, f1: 9000, up: true }),
  revcrash: (B) => reverseOf(B, 'crash', 1.3),
};

// --- looped multisamples (spectral) ------------------------------------------------

function loopSize(ref) { return ref < 60 ? 65536 : 32768; }

/**
 * Build a stereo loop from partials. partials(add, D, snap) calls
 * add(ch, freqHz, amp, phase) with ch 0 = left, 1 = right, 2 = both.
 */
function specLoop(B, ref, partials) {
  const sr = B.sr, n = loopSize(ref), D = n / sr;
  const re = new Float64Array(n), im = new Float64Array(n);
  const half = n / 2;
  const add = (ch, f, a, ph) => {
    const k = Math.round(f * D);
    if (k <= 0 || k >= half || a === 0) return;
    const c = a * Math.cos(ph), s = a * Math.sin(ph);
    if (ch !== 1) { re[k] += c; im[k] += s; re[n - k] += c; im[n - k] -= s; }
    if (ch !== 0) { re[k] -= s; im[k] += c; re[n - k] += s; im[n - k] += c; }
  };
  const snap = (f) => Math.max(1, Math.round(f * D)) / D;
  const fc = partials(add, D, snap, sr);
  ifft(re, im);
  const buf = B.ctx.createBuffer(2, n, sr);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) { L[i] = re[i]; R[i] = im[i]; }
  return { buf: normRms(buf, 0.2), f: fc };
}

const lpResp = (f, fc, order = 2, q = 0.8) => {
  const x = f / fc;
  const m = 1 / Math.sqrt((1 - x * x) * (1 - x * x) + (x / q) * (x / q));
  return order === 4 ? m * m : m;
};

/** Detuned saw (or square) ensemble with an optional spectral lowpass. */
function ensemble(B, ref, o) {
  const { voices = 7, spread = 22, cg = 1, sg = 0.6, lp = 0, lpo = 2, lpq = 0.75, hp = 0, square = false } = o;
  return specLoop(B, ref, (add, D, snap, sr) => {
    const f0 = mtof(ref), fc = snap(f0), nyq = sr * 0.47;
    for (let ch = 0; ch < 2; ch++) {
      const used = new Set();
      for (let v = 0; v < voices; v++) {
        const u = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1;
        const center = Math.abs(u) < 1e-6;
        if (center && ch === 1) continue; // centre voice added to both channels once
        const cents = u * spread * (ch ? -1 : 1) * (0.85 + 0.3 * (v % 2));
        let f = snap(f0 * Math.pow(2, cents / 1200));
        while (!center && (used.has(f) || f === fc)) f += (u < 0 ? -1 : 1) / D;
        used.add(f);
        const g = center ? cg : sg;
        const th = (B.noise() * 0.5 + 0.5) * TAU;
        for (let h = 1; h * f < nyq; h += square ? 2 : 1) {
          let a = g / h;
          const fh = h * f;
          if (lp) a *= lpResp(fh, lp, lpo, lpq);
          if (hp && fh < hp * 2) a *= Math.min(1, (fh / hp) * (fh / hp));
          add(center ? 2 : ch, fh, a, h * th);
        }
      }
    }
    return fc;
  });
}

/** Formant 'aah' choir: saw voices weighted by vocal-tract resonances. */
function choir(B, ref) {
  const F = [[780, 6, 1], [1150, 7, 0.55], [2700, 9, 0.22], [3300, 10, 0.12]];
  const form = (f) => {
    let s = 0;
    for (const [ff, q, g] of F) { const x = f / ff - ff / f; s += g / Math.sqrt(1 + q * q * x * x); }
    return s;
  };
  return specLoop(B, ref, (add, D, snap, sr) => {
    const f0 = mtof(ref), fc = snap(f0), nyq = sr * 0.45;
    for (let ch = 0; ch < 2; ch++) {
      [-10, -3, 4, 11].forEach((cents) => {
        const f = snap(f0 * Math.pow(2, (cents * (ch ? -1 : 1)) / 1200));
        const th = (B.noise() * 0.5 + 0.5) * TAU;
        for (let h = 1; h * f < nyq; h++) add(ch, h * f, (form(h * f) / h) * (h * f < 140 ? 0.3 : 1), h * th);
      });
    }
    return fc;
  });
}

// --- one-shot multisamples (half sample rate: cheaper, still ~11 kHz bandwidth) ----

function piano(B, ref) {
  const f0 = mtof(ref), sr = B.sr / 2;
  const len = ref < 60 ? 2.2 : ref < 76 ? 1.7 : 1.3;
  const buf = B.make(2, len, sr), n = buf.length;
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const Bi = 0.00018 * Math.pow(2, (ref - 60) / 24);
  const T0 = (ref < 60 ? 2.6 : 1.7) * Math.pow(2, -(ref - 60) / 36);
  for (let k = 1; k <= 18; k++) {
    const fk = k * f0 * Math.sqrt(1 + Bi * k * k);
    if (fk > sr * 0.42) break;
    const amp = ((Math.abs(Math.sin(Math.PI * k * 0.125)) + 0.08) / Math.pow(k, 1.05)) * Math.exp(-k * 0.07);
    const tauF = (T0 / (1 + 0.35 * (k - 1))) * 0.35, tauS = T0 / (1 + 0.12 * (k - 1));
    for (let s = 0; s < 2; s++) {
      const det = 1 + (s ? 1 : -1) * 0.00045 * (1 + k * 0.05);
      const w = (TAU * fk * det) / sr;
      const c2 = 2 * Math.cos(w);
      let y1 = Math.sin(-w + s), y2 = Math.sin(-2 * w + s);
      const df = Math.exp(-1 / (sr * tauF)), ds = Math.exp(-1 / (sr * tauS));
      let ef = 0.65 * amp, es = 0.35 * amp;
      const gl = s ? 0.55 : 1, gr = s ? 1 : 0.55;
      for (let i = 0; i < n; i++) {
        const y = c2 * y1 - y2; y2 = y1; y1 = y;
        const v = y * (ef + es);
        ef *= df; es *= ds;
        L[i] += v * gl; R[i] += v * gr;
      }
    }
  }
  const hl = new SVF(sr); hl.set(2600, 0.7);
  for (let i = 0; i < Math.min(n, sr * 0.03); i++) {
    const h = hl.run(B.noise()) * 0.25 * Math.exp(-i / (sr * 0.004));
    L[i] += h; R[i] += h;
  }
  for (let i = 0; i < 32; i++) { L[i] *= i / 32; R[i] *= i / 32; }
  fadeOut(L, sr, 0.2); fadeOut(R, sr, 0.2);
  return { buf: normPeak(buf, 0.8), f: f0 };
}

function filtered(B, ref, o) {
  // one-shot saw/pulse voice through an enveloped SVF lowpass (brass, pluck, stabs)
  const { len = 1, saws = [-8, 0, 7], pulse = 0, fBase = 1.2, fEnv = 4000, fAtk = 0.02, fDec = 0.25, fSus = 0.5, q = 0.9,
    aAtk = 0.01, aDec = 0.4, aSus = 0.75, scoop = 0, drive = 0, sub = 0 } = o;
  const f0 = mtof(ref), sr = B.sr / 2, buf = B.make(2, len, sr), n = buf.length;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const phs = saws.map(() => B.noise() * 0.5 + 0.5);
    const det = saws.map((x) => Math.pow(2, (x * (c ? -1 : 1)) / 1200) * f0 / sr);
    const svf = new SVF(sr), svf2 = new SVF(sr);
    const norm = 1 / Math.sqrt(saws.length);
    let sp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const pitch = scoop ? 1 - scoop * Math.exp(-t / 0.035) : 1;
      let s = 0;
      for (let k = 0; k < saws.length; k++) {
        const inc = det[k] * pitch;
        let p = phs[k] + inc; if (p >= 1) p -= 1; phs[k] = p;
        s += 2 * p - 1 - blep(p, inc);
        if (pulse) {
          let p2 = p + 0.5; if (p2 >= 1) p2 -= 1;
          s -= pulse * (2 * p2 - 1 - blep(p2, inc));
        }
      }
      s *= norm;
      if (sub) { sp += (f0 * 0.5 * pitch) / sr; s += sub * tsin(sp); }
      if ((i & 7) === 0) {
        const fe = (1 - Math.exp(-t / fAtk)) * ((1 - fSus) * Math.exp(-t / fDec) + fSus);
        const fc = f0 * fBase + fEnv * fe;
        svf.set(fc, q); svf2.set(fc * 1.3, 0.6);
      }
      let y = svf2.run(svf.run(s));
      if (drive) y = sat(y, drive);
      const ae = Math.min(1, t / aAtk) * ((1 - aSus) * Math.exp(-t / aDec) + aSus);
      d[i] = y * ae;
    }
    fadeOut(d, sr, Math.min(0.3, len * 0.3));
  }
  return { buf: normPeak(buf, 0.8), f: f0 };
}

function fmOne(B, ref, o) {
  const { len = 2.5, ratio = 3.5, i0 = 4, i1 = 0.3, id = 0.5, ad = 1.4, partials = null, trem = 0 } = o;
  const f0 = mtof(ref), sr = B.sr / 2, buf = B.make(2, len, sr), n = buf.length;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let pc = 0, pm = 0;
    const ka = Math.exp(-1 / (ad * sr)), ki = Math.exp(-1 / (id * sr));
    let ea = 1, ei = 1;
    const pe = partials ? partials.map(([, a]) => a) : null;
    const pk = partials ? partials.map(([, , dd]) => Math.exp(-1 / (dd * sr))) : null;
    const pf = partials ? partials.map(([r]) => (f0 * r * (c ? 1.0007 : 1)) / sr) : null;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let s;
      if (partials) {
        s = 0;
        for (let k = 0; k < pe.length; k++) { s += tsin(pf[k] * i) * pe[k]; pe[k] *= pk[k]; }
        if (i < sr * 0.02) s += B.noise() * 0.05 * Math.exp(-t / 0.003);
      } else {
        pm += (f0 * ratio) / sr; pc += (f0 * (c ? 1.0008 : 1)) / sr;
        const idx = i1 + (i0 - i1) * ei;
        s = tsin(pc + (idx * tsin(pm)) / TAU) * ea;
      }
      if (trem) s *= 1 - trem * (0.5 + 0.5 * tsin(5.5 * t + c * 0.2));
      d[i] = s * Math.min(1, t / 0.0015);
      ea *= ka; ei *= ki;
    }
    fadeOut(d, sr, 0.3);
  }
  return { buf: normPeak(buf, 0.8), f: f0 };
}

function organ(B, ref) {
  // M1-style percussive house organ
  const f0 = mtof(ref), sr = B.sr / 2, len = 1.4, buf = B.make(2, len, sr), n = buf.length;
  const H = [[1, 1, 0], [2, 0.75, 0], [3, 0.55, 1], [4, 0.45, 0], [6, 0.18, 0], [8, 0.22, 0]];
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (const [h, a, perc] of H) {
      const fk = f0 * h * (c ? 1.0015 : 1);
      if (fk > sr * 0.42) continue;
      const w = (TAU * fk) / sr, c2 = 2 * Math.cos(w);
      let y1 = Math.sin(-w + h), y2 = Math.sin(-2 * w + h);
      const kp = Math.exp(-1 / (0.13 * sr));
      let ep = 1;
      for (let i = 0; i < n; i++) {
        const y = c2 * y1 - y2; y2 = y1; y1 = y;
        d[i] += y * a * (perc ? 0.35 + 0.65 * ep : 1);
        ep *= kp;
      }
    }
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = d[i] * Math.min(1, t / 0.002) * (0.82 + 0.18 * Math.exp(-t / 0.25)) + B.noise() * 0.12 * Math.exp(-t / 0.003);
    }
    biq(d, 'lp', 7000, 0.7, sr);
    fadeOut(d, sr, 0.3);
  }
  return { buf: normPeak(buf, 0.8), f: f0 };
}

const MS = {
  saw: { step: 6, loop: true, fn: (B, r) => ensemble(B, r, { voices: 7, spread: 24 }) },
  saw3: { step: 6, loop: true, fn: (B, r) => ensemble(B, r, { voices: 3, spread: 9, sg: 0.8 }) },
  pad: { step: 6, loop: true, fn: (B, r) => ensemble(B, r, { voices: 5, spread: 16, lp: Math.min(5200, mtof(r) * 7), lpo: 4, hp: 90 }) },
  strings: { step: 6, loop: true, fn: (B, r) => ensemble(B, r, { voices: 6, spread: 11, lp: Math.min(4200, mtof(r) * 6), lpo: 2, lpq: 1.1, hp: 120, sg: 0.85 }) },
  square: { step: 6, loop: true, fn: (B, r) => ensemble(B, r, { voices: 3, spread: 6, square: true, sg: 0.7, lp: Math.min(9000, mtof(r) * 14) }) },
  choir: { step: 6, loop: true, fn: choir },
  piano: { step: 4, fn: piano },
  brass: { step: 5, fn: (B, r) => filtered(B, r, { len: 1.1, saws: [-9, 0, 8], fBase: 1.3, fEnv: 3600, fAtk: 0.03, fDec: 0.3, fSus: 0.45, q: 1, aAtk: 0.014, aDec: 0.35, aSus: 0.7, scoop: 0.025 }) },
  pluck: { step: 6, fn: (B, r) => filtered(B, r, { len: 0.8, saws: [-5, 6], pulse: 0.5, fBase: 1, fEnv: 6500, fAtk: 0.001, fDec: 0.07, fSus: 0, q: 1.4, aAtk: 0.002, aDec: 0.3, aSus: 0 }) },
  stab: { step: 6, fn: (B, r) => filtered(B, r, { len: 0.7, saws: [-14, -5, 0, 6, 13], fBase: 1.4, fEnv: 8000, fAtk: 0.001, fDec: 0.06, fSus: 0.05, q: 2, aAtk: 0.002, aDec: 0.22, aSus: 0, drive: 1.6, sub: 0.3 }) },
  bell: { step: 6, fn: (B, r) => fmOne(B, r, { len: 2.2, ratio: 3.5, i0: 3.2, i1: 0.25, id: 0.45, ad: 1.1 }) },
  mallet: { step: 6, fn: (B, r) => fmOne(B, r, { len: 2.2, partials: [[1, 1, 1.6], [3.98, 0.22, 0.45], [9.9, 0.05, 0.1]], trem: 0.35 }) },
  organ: { step: 5, fn: organ },
};

// --- Karplus–Strong strings -----------------------------------------------------

function ksString(B, midi, o) {
  const { bright = 0.6, t60 = 2, len = 2, pick = 0.14, gain = 1 } = o;
  const sr = B.sr, f = mtof(midi), N = sr / f;
  let Ni = Math.floor(N - 0.5 - 0.1);
  if (Ni < 2) Ni = 2;
  const fr = N - 0.5 - Ni;
  const apc = (1 - fr) / (1 + fr);
  const g = Math.pow(10, -3 / (t60 * f));
  const total = Math.round(len * sr);
  const out = new Float32Array(total);
  // excitation: one period of filtered noise with a pick-position comb
  const exc = new Float32Array(Ni + 1);
  let lp = 0;
  const a = 0.08 + 0.9 * bright;
  for (let i = 0; i < exc.length; i++) { lp += a * (B.noise() - lp); exc[i] = lp; }
  const pd = Math.max(1, Math.round(pick * N));
  for (let i = exc.length - 1; i >= pd; i--) exc[i] -= exc[i - pd];
  let mean = 0;
  for (let i = 0; i < exc.length; i++) mean += exc[i];
  mean /= exc.length;
  for (let i = 0; i < exc.length; i++) exc[i] = (exc[i] - mean) * gain;
  const L = Ni + 2, ring = new Float32Array(L);
  let w = 0, ax = 0, ay = 0;
  let r1 = L - Ni, r2 = L - Ni - 1; // read heads trail the write head
  for (let n = 0; n < total; n++) {
    const avg = 0.5 * (ring[r1] + ring[r2]);
    const ap = apc * avg + ax - apc * ay; ax = avg; ay = ap;
    const y = (n < exc.length ? exc[n] : 0) + g * ap;
    ring[w] = y;
    if (++w === L) w = 0;
    if (++r1 === L) r1 = 0;
    if (++r2 === L) r2 = 0;
    out[n] = y;
  }
  return out;
}

function ksBuf(B, parts, o) {
  const { len = 2, lp = 0, hp = 60, peak = 0.85, fade = 0.25 } = o;
  const sr = B.sr, buf = B.make(1, len), d = buf.getChannelData(0);
  for (const [arr, off, amp] of parts) {
    const o0 = Math.round(off * sr);
    for (let i = 0; i + o0 < d.length && i < arr.length; i++) d[i + o0] += arr[i] * amp;
  }
  if (lp) biq(d, 'lp', lp, 0.7, sr);
  if (hp) biq(d, 'hp', hp, 0.7, sr);
  fadeOut(d, sr, fade);
  return normPeak(buf, peak);
}

const KS = {
  gtr: (B, m) => ksBuf(B, [[ksString(B, m, { bright: 0.62, t60: 3, len: 2, pick: 0.13 }), 0, 1]], { len: 2 }),
  mute: (B, m) => ksBuf(B, [[ksString(B, m, { bright: 0.3, t60: 0.22, len: 0.4, pick: 0.18 }), 0, 1]], { len: 0.4, lp: 1800, fade: 0.1 }),
  pow: (B, m) => ksBuf(B, [
    [ksString(B, m, { bright: 0.6, t60: 3, len: 2, pick: 0.13 }), 0, 1],
    [ksString(B, m + 7, { bright: 0.6, t60: 2.8, len: 2, pick: 0.13 }), 0.006, 0.85],
    [ksString(B, m + 12, { bright: 0.6, t60: 2.6, len: 2, pick: 0.13 }), 0.012, 0.65],
  ], { len: 2 }),
  powm: (B, m) => ksBuf(B, [
    [ksString(B, m, { bright: 0.3, t60: 0.2, len: 0.4, pick: 0.18 }), 0, 1],
    [ksString(B, m + 7, { bright: 0.3, t60: 0.18, len: 0.4, pick: 0.18 }), 0.004, 0.8],
    [ksString(B, m + 12, { bright: 0.3, t60: 0.16, len: 0.4, pick: 0.18 }), 0.008, 0.55],
  ], { len: 0.4, lp: 2000, fade: 0.1 }),
  twang: (B, m) => ksBuf(B, [[ksString(B, m, { bright: 0.8, t60: 3.4, len: 2.4, pick: 0.09 }), 0, 1]], { len: 2.4, hp: 90, fade: 0.4 }),
  upright: (B, m) => {
    const s = ksString(B, m, { bright: 0.18, t60: 1.6, len: 1.6, pick: 0.28 });
    const sr = B.sr, f = mtof(m);
    for (let i = 0; i < sr * 0.2; i++) s[i] += 0.35 * Math.sin((TAU * f * i) / sr) * Math.exp(-i / (sr * 0.06));
    return ksBuf(B, [[s, 0, 1]], { len: 1.6, lp: 1400, hp: 35, fade: 0.3 });
  },
};

/** Distortion transfer curve (tanh), optionally asymmetric for even harmonics. */
export function driveCurve(k = 20, asym = 0, n = 4096) {
  const c = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    c[i] = Math.tanh(k * (x + asym * x * x)) / norm;
  }
  return c;
}

/** Soft clipper: linear to ±0.8 of `range`, saturating to 0.98 (input pre-scaled by 1/range). */
export function clipCurve(range = 2, n = 8192) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = ((i * 2) / (n - 1) - 1) * range;
    const a = Math.abs(u);
    const y = a <= 0.8 ? a : 0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18);
    c[i] = Math.sign(u) * y;
  }
  return c;
}
