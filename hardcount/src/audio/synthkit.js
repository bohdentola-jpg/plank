// Tiny offline DSP kit for the racing audio. Everything here renders straight
// into Float32Arrays (no WebAudio graph), so engine cycles and one-shot sfx can
// be synthesized once, cached as AudioBuffers and replayed cheaply.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const db = (d) => Math.pow(10, d / 20);

/** Mulberry32 seeded PRNG → () => [0, 1). */
export function rng(seed) {
  let a = (typeof seed === 'string' ? hash(seed) : seed >>> 0) || 0x9e3779b9;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.bi = () => r() * 2 - 1;
  // cheap approximately-normal deviate (σ ≈ 1)
  r.gauss = () => (r() + r() + r() + r() - 2) * 1.732;
  return r;
}

export function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** RBJ-cookbook biquad (transposed direct form II). */
export class Biquad {
  constructor(type = 'lowpass', freq = 1000, q = 0.707, gainDb = 0, sr = 48000) {
    this.z1 = 0;
    this.z2 = 0;
    this.set(type, freq, q, gainDb, sr);
  }

  set(type, freq, q, gainDb, sr) {
    const w = (TAU * clamp(freq, 5, sr * 0.47)) / sr;
    const cw = Math.cos(w), sw = Math.sin(w);
    const al = sw / (2 * Math.max(0.05, q));
    const A = Math.pow(10, (gainDb || 0) / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case 'highpass':
        b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0;
        a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
        break;
      case 'bandpass': // 0 dB peak
        b0 = al; b1 = 0; b2 = -al;
        a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
        break;
      case 'peaking':
        b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A;
        a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
        break;
      case 'notch':
        b0 = 1; b1 = -2 * cw; b2 = 1;
        a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
        break;
      default: // lowpass
        b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0;
        a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }

  tick(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  run(buf, from = 0, to = buf.length) {
    for (let i = from; i < to; i++) buf[i] = this.tick(buf[i]);
    return buf;
  }

  /** Filter a looping buffer: warm the state on its tail so the seam stays continuous. */
  runLoop(buf, warm = 4096) {
    const n = buf.length;
    for (let i = Math.max(0, n - warm); i < n; i++) this.tick(buf[i]);
    return this.run(buf);
  }
}

/** One-shot filter pass helper: filt(buf, 'lowpass', 2000, 0.7, 0, sr). */
export function filt(buf, type, freq, q, gainDb, sr, loop = false) {
  const f = new Biquad(type, freq, q, gainDb, sr);
  return loop ? f.runLoop(buf) : f.run(buf);
}

/** Damped 2-pole resonator; impulse response = amp·rⁿ·sin(ωn). Used for modal synthesis. */
export class Mode {
  constructor(freq, decay, amp, sr) {
    const w = (TAU * Math.min(freq, sr * 0.45)) / sr;
    const r = Math.exp(-1 / (Math.max(1e-4, decay) * sr));
    this.c1 = 2 * r * Math.cos(w);
    this.c2 = r * r;
    this.g = amp * Math.sin(w);
    this.y1 = 0; this.y2 = 0; this.x1 = 0;
  }

  tick(x) {
    const y = this.c1 * this.y1 - this.c2 * this.y2 + this.g * this.x1;
    this.y2 = this.y1; this.y1 = y; this.x1 = x;
    return y;
  }
}

/** Run an excitation through a bank of modes [[freq, decay, amp], …] and add into out. */
export function modal(exc, out, modes, sr) {
  for (const [f, d, a] of modes) {
    const m = new Mode(f, d, a, sr);
    for (let i = 0; i < exc.length; i++) out[i] += m.tick(exc[i]);
  }
  return out;
}

/** Add a decaying sine ping into buf at sample position `at` (damped-oscillator recurrence). */
export function ping(buf, at, freq, decay, amp, sr, phase = 0) {
  const i0 = Math.max(0, Math.round(at));
  const n = Math.min(buf.length - i0, Math.ceil(decay * sr * 6));
  if (n <= 2) return;
  const w = (TAU * Math.min(freq, sr * 0.45)) / sr;
  const r = Math.exp(-1 / (decay * sr));
  const c1 = 2 * r * Math.cos(w), c2 = r * r;
  let y2 = amp * Math.sin(phase), y1 = amp * r * Math.sin(phase + w);
  // ~0.25 ms attack ramp keeps the onset click-free
  const atk = Math.max(2, Math.round(sr * 0.00025));
  buf[i0 + 1] += y1 / atk; // y[0] is scaled to 0 by the ramp
  for (let i = 2; i < n; i++) {
    const y = c1 * y1 - c2 * y2;
    buf[i0 + i] += i < atk ? (y * i) / atk : y;
    y2 = y1;
    y1 = y;
  }
}

/** Add a burst of filtered-ish white noise with an exponential envelope. */
export function burst(buf, at, decay, amp, R, attack = 0.0004, sr = 48000) {
  const i0 = Math.max(0, Math.round(at));
  const n = Math.min(buf.length - i0, Math.ceil(decay * sr * 7));
  const ka = Math.exp(-1 / (attack * sr)), kd = Math.exp(-1 / (decay * sr));
  let a = 1, d = amp;
  for (let i = 0; i < n; i++) {
    buf[i0 + i] += (1 - a) * d * (R() * 2 - 1);
    a *= ka; d *= kd;
  }
}

/** Damped sine thump whose pitch drops from f0 to f1 (bodies, balls, boots, stomps). `at` in seconds. */
export function thump(o, sr, at, f0, f1, tau, decay, amp) {
  const i0 = Math.round(at * sr), n = Math.min(o.length - i0, Math.round(decay * 7 * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-t / tau))) / sr;
    o[i0 + i] += Math.sin(ph) * amp * Math.min(1, t / 0.0012) * Math.exp(-t / decay);
  }
}

/** A filtered noise burst, normalized to `amp` peak, added into o at `at` seconds. filters: [[type, f, q], …] */
export function nburst(o, sr, R, at, decay, amp, filters = [], attack = 0.0004) {
  const i0 = Math.round(at * sr);
  const n = Math.min(o.length - i0, Math.ceil((decay * 7 + attack * 4) * sr) + 64);
  if (n <= 4) return;
  const tmp = new Float32Array(n);
  burst(tmp, 0, decay, 1, R, attack, sr);
  for (const [type, f, q] of filters) new Biquad(type, f, q, 0, sr).run(tmp);
  normalize([tmp], amp);
  for (let i = 0; i < n; i++) o[i0 + i] += tmp[i];
}

/** Modal ring (plastic shells, a ball's air cavity, steel, bleachers) excited by a click, normalized to `amp`. */
export function modes(o, sr, R, at, list, amp, excite = 0.0003) {
  const i0 = Math.round(at * sr);
  const longest = Math.max(...list.map((m) => m[1]));
  const n = Math.min(o.length - i0, Math.ceil(longest * 7 * sr) + 64);
  if (n <= 4) return;
  const exc = new Float32Array(n);
  burst(exc, 0, excite, 1, R, 0.00004, sr);
  const m = modal(exc, new Float32Array(n), list, sr);
  normalize([m], amp);
  for (let i = 0; i < n; i++) o[i0 + i] += m[i];
}

/** Add mono m into a stereo pair with a constant-power pan, starting at sample `at`. */
export function panInto(L, Rt, m, pan, gain = 1, at = 0) {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * gain * Math.SQRT2, gr = Math.sin(a) * gain * Math.SQRT2;
  const i0 = Math.round(at);
  const i1 = Math.min(m.length, L.length - i0);
  for (let i = Math.max(0, -i0); i < i1; i++) { L[i0 + i] += m[i] * gl; Rt[i0 + i] += m[i] * gr; }
}

/** Pink-noise generator (Paul Kellet's economy filter) driven by R. */
export function pinkGen(R) {
  let b0 = 0, b1 = 0, b2 = 0;
  return () => {
    const w = R() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    return (b0 + b1 + b2 + w * 0.1848) * 0.25;
  };
}

/** Smooth random curve generator: a value in [-1, 1] that wanders at ~rate Hz. */
export function wanderGen(R, rate, sr) {
  let cur = R.bi(), next = R.bi(), ph = 0;
  const inc = rate / sr;
  return () => {
    ph += inc;
    if (ph >= 1) { ph -= 1; cur = next; next = R.bi(); }
    const s = ph * ph * (3 - 2 * ph);
    return cur + (next - cur) * s;
  };
}

export function peak(...chans) {
  let p = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > p) p = a; }
  return p;
}

export function rms(...chans) {
  let s = 0, n = 0;
  for (const c of chans) { for (let i = 0; i < c.length; i++) s += c[i] * c[i]; n += c.length; }
  return Math.sqrt(s / Math.max(1, n));
}

export function scale(chans, g) {
  for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= g;
  return chans;
}

/** Normalize channels to a target peak. */
export function normalize(chans, target = 0.9) {
  const p = peak(...chans);
  return p > 0 ? scale(chans, target / p) : chans;
}

/** Fade the first/last samples (seconds) so a one-shot starts and ends at zero. */
export function fadeEdges(chans, sr, fin = 0.002, fout = 0.01) {
  const ni = Math.round(fin * sr), no = Math.round(fout * sr);
  for (const c of chans) {
    const n = c.length;
    for (let i = 0; i < ni && i < n; i++) c[i] *= i / ni;
    for (let i = 0; i < no && i < n; i++) c[n - 1 - i] *= i / no;
  }
  return chans;
}

/**
 * Make noisy material loop seamlessly: the last `fade` seconds are cross-faded
 * (equal power) into the head, then trimmed off.
 */
export function loopify(chans, sr, fade = 0.12) {
  const f = Math.round(fade * sr);
  return chans.map((c) => {
    const n = c.length - f;
    const o = c.slice(0, n);
    for (let i = 0; i < f; i++) {
      const x = i / f;
      o[i] = c[i] * Math.sin(x * Math.PI / 2) + c[n + i] * Math.cos(x * Math.PI / 2);
    }
    return o;
  });
}

/** Float32Array(s) → AudioBuffer on ctx (optionally at a lower sample rate for band-limited beds). */
export function toBuffer(ctx, chans, rate = ctx.sampleRate) {
  const list = Array.isArray(chans) ? chans : [chans];
  const buf = ctx.createBuffer(list.length, list[0].length, rate);
  list.forEach((c, i) => buf.getChannelData(i).set(c));
  return buf;
}

/** A decorrelated stereo pair from one looping channel: R is L rotated by `frac` of its length. */
export function rotStereo(mono, frac = 0.5) {
  const n = mono.length, off = Math.floor(n * frac);
  const r = new Float32Array(n);
  r.set(mono.subarray(off));
  r.set(mono.subarray(0, off), n - off);
  return [mono, r];
}

/** Allocate n channels of `secs` seconds. */
export function alloc(secs, sr, chans = 1) {
  const n = Math.max(1, Math.ceil(secs * sr));
  return Array.from({ length: chans }, () => new Float32Array(n));
}

/** WaveShaper curve: soft tanh clip with optional asymmetry (even harmonics, "growl"). */
export function shaperCurve(asym = 0, n = 2048) {
  const c = new Float32Array(n);
  const norm = Math.tanh(1.6);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(1.6 * (x + asym * (x * x - 0.33))) / norm;
  }
  // remove the static offset the asymmetry adds at x = 0
  const mid = c[(n - 1) >> 1];
  for (let i = 0; i < n; i++) c[i] -= mid;
  return c;
}

/**
 * Make a node's params k-rate (one value per 128-frame block). Chrome otherwise
 * recomputes biquad coefficients every sample while a param is automated or
 * modulated — needless for slow sweeps. Silently ignored where unsupported.
 */
export function krate(node) {
  for (const k of ['frequency', 'detune', 'Q', 'gain']) {
    const p = node[k];
    if (p && typeof p === 'object' && 'automationRate' in p) {
      try { p.automationRate = 'k-rate'; } catch { /* not settable here */ }
    }
  }
  return node;
}

/**
 * Smoothed AudioParam setter that skips redundant automation calls. `memo` is a
 * Float64Array of last targets, `i` this param's slot.
 */
export function setSmooth(memo, i, param, v, t, tc, rel = 0.004) {
  if (!Number.isFinite(v)) return false;
  const last = memo[i];
  if (Math.abs(v - last) <= rel * Math.abs(last) + 1e-6) return false;
  memo[i] = v;
  param.setTargetAtTime(v, t, tc);
  return true;
}
