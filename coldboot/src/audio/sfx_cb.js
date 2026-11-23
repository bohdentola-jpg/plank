// COLD BOOT sound effects — offline renderers. Each returns 1–2 Float32Arrays that
// sfx.js caches as AudioBuffers (see SHOTS there), plus the periodic-wave shapes
// behind the rotor and engine loops. Pure DSP, no WebAudio graph.

import { TAU, clamp, Biquad, modal, ping, burst, wanderGen, alloc, normalize, fadeEdges } from './synthkit.js';

// ---- helpers -----------------------------------------------------------------------------

/** Sine thump whose pitch falls f0 → f1 (time constant tau), decaying with `decay`. */
function thump(o, sr, at, dur, f0, f1, amp, tau, decay = dur * 0.3) {
  const i0 = Math.round(at * sr), n = Math.min(o.length - i0, Math.round(dur * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-t / tau))) / sr;
    o[i0 + i] += Math.sin(ph) * amp * Math.min(1, t / 0.0015) * Math.exp(-t / decay);
  }
}

/** White noise shaped by env(t) (t local to `at`), then filtered, added into o. */
function noiseEnv(o, sr, R, at, dur, env, filters = []) {
  const i0 = Math.round(at * sr), n = Math.min(o.length - i0, Math.round(dur * sr));
  if (n <= 0) return;
  const tmp = new Float32Array(n);
  for (let i = 0; i < n; i++) tmp[i] = (R() * 2 - 1) * env(i / sr);
  for (const [type, f, q, g] of filters) new Biquad(type, f, q, g || 0, sr).run(tmp);
  for (let i = 0; i < n; i++) o[i0 + i] += tmp[i];
}

/** Downward chirp f0 → f1 (ice dispersion: highs arrive first). */
function chirp(o, sr, at, dur, f0, f1, amp, curve = 2.2) {
  const i0 = Math.round(at * sr), n = Math.min(o.length - i0, Math.round(dur * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / (dur * sr);
    ph += (TAU * (f1 + (f0 - f1) * Math.pow(1 - u, curve))) / sr;
    o[i0 + i] += Math.sin(ph) * amp * Math.min(1, i / (0.001 * sr)) * Math.pow(1 - u, 1.5);
  }
}

const both = (L, Rt, m, k = 1) => { for (let i = 0; i < L.length; i++) { L[i] += m[i]; Rt[i] += m[i] * k; } };

// ---- weapons -----------------------------------------------------------------------------

/** One machine-gun round: bullet crack (N-wave), muzzle blast, chesty thump, action clatter. */
export function rGun(sr, R) {
  const [L, Rt] = alloc(0.45, sr, 2);
  const n = L.length;
  const m = new Float32Array(n);
  const nw = Math.max(4, Math.round(sr * (0.00045 + 0.0002 * R())));
  for (let i = 0; i < nw; i++) m[8 + i] += 0.9 * (1 - (2 * i) / nw);
  noiseEnv(m, sr, R, 0.0015, 0.12, (t) => Math.min(1, t / 0.0004) * Math.exp(-t / (0.011 + 0.006 * R())), [['lowpass', 5200 + 2000 * R(), 0.7]]);
  thump(m, sr, 0.001, 0.16, 190 + 50 * R(), 70, 0.85, 0.01, 0.035);
  for (let k = 0; k < 5; k++) ping(m, (0.004 + R() * 0.03) * sr, 1800 + R() * 4200, 0.004 + R() * 0.008, 0.05 + 0.08 * R(), sr, R() * TAU);
  const side = [new Float32Array(n), new Float32Array(n)];
  for (const c of side) {
    noiseEnv(c, sr, R, 0.003, 0.4, (t) => Math.min(1, t / 0.003) * Math.exp(-t / 0.05), [['bandpass', 700 + 500 * R(), 0.6], ['lowpass', 3000, 0.7]]);
  }
  normalize(side, 0.3);
  for (let i = 0; i < n; i++) { L[i] = m[i] + side[0][i]; Rt[i] = m[i] + side[1][i]; }
  for (const c of [L, Rt]) new Biquad('highpass', 45, 0.7, 0, sr).run(c);
  normalize([L, Rt], 0.92);
  return fadeEdges([L, Rt], sr, 0.0001, 0.08);
}

/** Explosion: the crack, a fireball roar through a falling lowpass, a sub boom, debris, rumble. */
export function rExplosion(sr, R) {
  const [L, Rt] = alloc(4.4, sr, 2);
  const n = L.length;
  const m = new Float32Array(n);
  thump(m, sr, 0, 2.4, 78 + 14 * R(), 27, 1.1, 0.16, 0.75);
  const lp = new Biquad('lowpass', 8000, 0.8, 0, sr), lp2 = new Biquad('lowpass', 8000, 0.6, 0, sr);
  for (let i = 0; i < Math.min(n, sr * 2.8); i++) {
    const t = i / sr;
    if ((i & 63) === 0) {
      const f = 230 + 7800 * Math.exp(-t / 0.17);
      lp.set('lowpass', f, 0.8, 0, sr);
      lp2.set('lowpass', f * 1.25, 0.6, 0, sr);
    }
    const env = Math.min(1, t / 0.003) * (0.72 * Math.exp(-t / 0.24) + 0.28 * Math.exp(-t / 1.1));
    m[i] += lp2.tick(lp.tick(R() * 2 - 1)) * env * 1.5;
  }
  for (let k = 0; k < 110; k++) {
    const t = 0.06 + Math.pow(R(), 1.8) * 2.8;
    const a = 0.22 * Math.exp(-t / 1.2) * (0.3 + 0.7 * R());
    if (R() < 0.72) burst(m, t * sr, 0.0012 + R() * 0.004, a, R, 0.0001, sr);
    else ping(m, t * sr, 110 + R() * 420, 0.02 + R() * 0.05, a * 1.4, sr, R() * TAU);
  }
  burst(m, 0, 0.004, 1.3, R, 0.00005, sr);
  const tails = [new Float32Array(n), new Float32Array(n)];
  for (const c of tails) {
    const tl = new Biquad('lowpass', 150, 0.7, 0, sr);
    let b = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      b = (b + 0.02 * (R() * 2 - 1)) / 1.02;
      c[i] = tl.tick(b * 3.5) * Math.min(1, t / 0.06) * Math.exp(-t / 1.5);
    }
  }
  normalize(tails, 0.45);
  for (let i = 0; i < n; i++) { L[i] = m[i] + tails[0][i]; Rt[i] = m[i] + tails[1][i]; }
  for (const c of [L, Rt]) new Biquad('highpass', 24, 0.7, 0, sr).run(c);
  normalize([L, Rt], 1.5);
  for (const c of [L, Rt]) for (let i = 0; i < n; i++) c[i] = Math.tanh(c[i]); // a little grit
  normalize([L, Rt], 0.95);
  return fadeEdges([L, Rt], sr, 0.0001, 0.7);
}

/** Missile: launch pop, a crackling motor roar that grows as it closes, then the pass. */
export function rMissile(sr, R) {
  const [L, Rt] = alloc(3.4, sr, 2);
  const n = L.length;
  const pass = 2.7;
  const m = new Float32Array(n);
  thump(m, sr, 0, 0.3, 140, 45, 0.7, 0.03, 0.08);
  burst(m, 0, 0.006, 0.6, R, 0.0001, sr);
  const lp = new Biquad('lowpass', 1200, 0.7, 0, sr), bp = new Biquad('bandpass', 2400, 1.5, 0, sr);
  let wph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const d = Math.abs(pass - t) * 1.6 + 0.12;
    const amp = Math.min(1, t / 0.08) * Math.min(1.7, 0.35 / d + 0.12) * (t > pass ? Math.exp(-(t - pass) / 0.22) : 1);
    if ((i & 63) === 0) lp.set('lowpass', 900 + 6800 * Math.min(1, 0.5 / d), 0.7, 0, sr);
    let x = R() * 2 - 1;
    if (R() < 0.004) x += (R() < 0.5 ? -1 : 1) * 6; // motor crackle
    wph += (TAU * 1650 * (t < pass ? 1.06 : 0.9) * (1 + 0.01 * Math.sin(TAU * 7 * t))) / sr;
    m[i] += (lp.tick(x) * 0.9 + bp.tick(x) * 0.25) * amp + Math.sin(wph) * 0.05 * amp;
  }
  for (let i = 0; i < n; i++) {
    const p = clamp(0.5 + (i / sr - pass) * 1.4, 0.15, 0.85);
    L[i] = m[i] * Math.cos((p * Math.PI) / 2);
    Rt[i] = m[i] * Math.sin((p * Math.PI) / 2);
  }
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.0002, 0.25);
}

/** Countermeasure flare: ejection pop, then the bright flickering fizz of burning magnesium. */
export function rFlare(sr, R) {
  const [L, Rt] = alloc(2.4, sr, 2);
  const n = L.length;
  const m = new Float32Array(n);
  thump(m, sr, 0, 0.12, 320, 120, 0.6, 0.01, 0.025);
  burst(m, 0, 0.008, 0.7, R, 0.0002, sr);
  const fl = wanderGen(R, 30, sr), slow = wanderGen(R, 3, sr);
  const hp = [new Biquad('highpass', 2500, 0.7, 0, sr), new Biquad('highpass', 2500, 0.7, 0, sr)];
  const pk = [new Biquad('peaking', 6000, 0.8, 5, sr), new Biquad('peaking', 6000, 0.8, 5, sr)];
  const fall = [new Biquad('lowpass', 12000, 0.7, 0, sr), new Biquad('lowpass', 12000, 0.7, 0, sr)];
  for (let i = 0; i < n; i++) {
    const t = i / sr - 0.03;
    if (t < 0) continue;
    if ((i & 127) === 0) for (const f of fall) f.set('lowpass', 2500 + 9500 * Math.exp(-t / 1.1), 0.7, 0, sr); // falling away
    const env = Math.min(1, t / 0.06) * Math.exp(-t / 0.9) * (0.65 + 0.35 * fl()) * (0.85 + 0.15 * slow());
    const pop = R() < 0.0012 ? (R() * 2 - 1) * 4 : 0;
    L[i] += fall[0].tick(pk[0].tick(hp[0].tick(R() * 2 - 1 + pop))) * env * 0.5;
    Rt[i] += fall[1].tick(pk[1].tick(hp[1].tick(R() * 2 - 1 + pop))) * env * 0.5;
  }
  both(L, Rt, m);
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.0002, 0.3);
}

// ---- bells ---------------------------------------------------------------------------------

/**
 * Russian church bell, struck by its clapper: hum, prime, minor-third tierce, quint,
 * nominal and the upper partials, each a pair of modes a fraction of a hertz apart
 * (the slow "wah" of a big bell), plus the clang of the strike.
 */
export function rBell(sr, R, prime, o = {}) {
  const { len = 8, decay = 1, bright = 1 } = o;
  const [L, Rt] = alloc(len, sr, 2);
  const P = [
    [0.5, 0.55, 7.5], [1.0, 0.8, 5.2], [1.19, 0.7, 4.1], [1.5, 0.32, 2.6], [2.0, 1.0, 3.3], [2.52, 0.36, 1.9],
    [2.66, 0.24, 1.5], [3.01, 0.28, 1.3], [4.07, 0.2, 0.85], [5.23, 0.14, 0.55], [6.32, 0.09, 0.38], [7.46, 0.06, 0.26],
  ];
  const detune = P.map(() => 1 + (R() - 0.5) * 0.005); // an untuned, Russian-cast bell
  [L, Rt].forEach((ch) => {
    P.forEach(([r, a, d], k) => {
      const f = prime * r * detune[k];
      if (f > sr * 0.44) return;
      const beat = 0.25 + R() * 0.9;
      const amp = a * (r > 2.6 ? bright : 1) * (0.85 + 0.3 * R());
      ping(ch, 0, f, d * decay, amp * 0.62, sr, R() * TAU);
      ping(ch, 0, f + beat, d * decay * 0.92, amp * 0.38, sr, R() * TAU);
    });
    for (let k = 0; k < 7; k++) ping(ch, 0, prime * (8 + R() * 14), 0.02 + R() * 0.05, 0.12 * bright, sr, R() * TAU);
    burst(ch, 0, 0.004, 0.25 * bright, R, 0.0002, sr);
  });
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.0005, Math.min(1.2, len * 0.15));
}

// ---- footsteps, doors, objects -----------------------------------------------------------------

/** One footstep on snow (cold squeaky crunch), wood (hollow boards, sometimes a creak) or concrete. */
export function rStep(sr, R, surface, v) {
  const [o] = alloc(surface === 'wood' ? 0.45 : 0.32, sr);
  const n = o.length;
  if (surface === 'snow') {
    const grains = 45 + Math.floor(R() * 30);
    for (let g = 0; g < grains; g++) {
      const heel = R() < 0.55;
      const t = heel ? 0.005 + Math.pow(R(), 1.5) * 0.07 : 0.07 + Math.pow(R(), 1.2) * 0.12;
      burst(o, t * sr, 0.0006 + R() * 0.0018, (0.15 + 0.85 * R()) * (heel ? 1 : 0.7), R, 0.00005, sr);
    }
    new Biquad('bandpass', 2600 + R() * 1400, 0.7, 0, sr).run(o);
    for (let k = 0, c = 3 + Math.floor(R() * 4); k < c; k++) ping(o, (0.02 + R() * 0.15) * sr, 900 + R() * 1600, 0.006 + R() * 0.012, 0.12 + 0.15 * R(), sr, R() * TAU);
    thump(o, sr, 0.004, 0.12, 110, 60, 0.35, 0.02, 0.03);
  } else if (surface === 'wood') {
    const exc = new Float32Array(n);
    burst(exc, 0.002 * sr, 0.004, 1, R, 0.0003, sr);
    burst(exc, (0.045 + R() * 0.03) * sr, 0.003, 0.5, R, 0.0003, sr);
    modal(exc, o, [[95 + R() * 25, 0.07, 1], [170 + R() * 40, 0.05, 0.7], [260 + R() * 50, 0.035, 0.5], [410 + R() * 80, 0.02, 0.35], [1200 + R() * 400, 0.008, 0.2]], sr);
    normalize([o], 0.8);
    const click = new Float32Array(n);
    burst(click, 0.002 * sr, 0.0012, 0.35, R, 0.00005, sr);
    new Biquad('highpass', 1500, 0.7, 0, sr).run(click);
    for (let i = 0; i < n; i++) o[i] += click[i];
    if (v === 2 || v === 4) { // a board that creaks
      let ph = 0;
      const t0 = Math.round(0.06 * sr), d = 0.18 + R() * 0.1, f0 = 380 + R() * 200;
      for (let i = 0; i < d * sr && t0 + i < n; i++) {
        const t = i / sr;
        ph += (TAU * f0 * (1 + (0.25 * t) / d)) / sr;
        const saw = ((ph / TAU) % 1) * 2 - 1;
        o[t0 + i] += saw * 0.08 * Math.sin((Math.PI * t) / d) * (0.6 + 0.4 * Math.sin(TAU * 31 * t));
      }
    }
  } else {
    burst(o, 0.001 * sr, 0.0025, 1, R, 0.00004, sr);
    burst(o, (0.05 + R() * 0.03) * sr, 0.002, 0.6, R, 0.00004, sr);
    new Biquad('highpass', 700, 0.7, 0, sr).run(o);
    new Biquad('peaking', 2800 + R() * 1200, 1, 6, sr).run(o);
    noiseEnv(o, sr, R, 0.01, 0.12, (t) => Math.sin(Math.PI * Math.min(1, t / 0.09)) * 0.25, [['bandpass', 3500, 0.6]]);
    thump(o, sr, 0.001, 0.06, 160, 90, 0.35, 0.01, 0.015);
  }
  normalize([o], 0.85);
  return fadeEdges([o], sr, 0.0002, 0.03);
}

/** Roll-up corrugated door: latch, rattling slats over the drum, the coil rumble, the stop / slam. */
export function rRollDoor(sr, R, open) {
  const [L, Rt] = alloc(open ? 3.2 : 3.0, sr, 2);
  const n = L.length;
  const m = new Float32Array(n);
  const t0 = open ? 0.25 : 0.05, t1 = open ? 2.85 : 2.35;
  const ex = new Float32Array(n);
  burst(ex, (open ? 0.02 : 0) * sr, 0.003, 1, R, 0.0001, sr);
  for (let t = t0; t < t1;) {
    const u = (t - t0) / (t1 - t0);
    const rate = open ? 18 + 14 * Math.min(1, u * 3) - 6 * u : 22 + 18 * u;
    const a = (0.25 + 0.5 * R()) * Math.min(1, (t - t0) / 0.2) * Math.min(1, (t1 - t) / 0.15);
    burst(ex, t * sr, 0.0008 + R() * 0.0015, a, R, 0.0001, sr);
    if (R() < 0.35) burst(ex, (t + 0.006 + R() * 0.01) * sr, 0.0006, a * 0.5, R, 0.0001, sr);
    t += (1 / rate) * (0.85 + 0.3 * R());
  }
  const modes = [];
  for (let k = 0; k < 16; k++) modes.push([140 * Math.pow(38, k / 15) * (0.95 + 0.1 * R()), 0.01 + 0.05 * R() * (1 - k / 16), 1 / Math.sqrt(k + 1)]);
  modal(ex, m, modes, sr);
  normalize([m], 0.8);
  const rum = new Float32Array(n);
  const lp = new Biquad('lowpass', 180, 0.8, 0, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = t > t0 && t < t1 ? Math.min(1, (t - t0) / 0.3) * Math.min(1, (t1 - t) / 0.2) : 0;
    rum[i] = lp.tick(R() * 2 - 1) * env;
  }
  normalize([rum], 0.35);
  const end = new Float32Array(n);
  if (open) {
    thump(end, sr, t1, 0.25, 120, 70, 0.4, 0.02, 0.05);
    for (let k = 0; k < 5; k++) ping(end, (t1 + R() * 0.02) * sr, 600 + R() * 2400, 0.03 + R() * 0.06, 0.08, sr, R() * TAU);
  } else {
    thump(end, sr, t1, 0.6, 95, 40, 1.0, 0.04, 0.12);
    const sl = new Float32Array(n);
    burst(sl, t1 * sr, 0.03, 1, R, 0.0003, sr);
    for (let k = 0; k < 40; k++) burst(sl, (t1 + Math.pow(R(), 2) * 0.45) * sr, 0.001 + R() * 0.002, 0.4 * R(), R, 0.0001, sr);
    modal(sl, end, modes.map(([f, d, a]) => [f, d * 3, a]), sr);
  }
  normalize([end], open ? 0.45 : 0.95);
  for (let i = 0; i < n; i++) m[i] += rum[i] + end[i];
  const off = Math.round(sr * 0.0045);
  for (let i = 0; i < n; i++) { L[i] = m[i]; Rt[i] = i >= off ? m[i - off] * 0.92 : 0; }
  for (const c of [L, Rt]) new Biquad('highpass', 50, 0.7, 0, sr).run(c);
  normalize([L, Rt], 0.88);
  return fadeEdges([L, Rt], sr, 0.0002, 0.15);
}

/** Laptop key (scissor switch): down tap and soft return; `big` = space bar with its rattle. */
export function rKey(sr, R, big) {
  const [o] = alloc(big ? 0.16 : 0.1, sr);
  const n = o.length;
  const e = new Float32Array(n);
  burst(e, 0.0005 * sr, 0.0009, 1, R, 0.00003, sr);
  burst(e, (big ? 0.06 : 0.045 + R() * 0.02) * sr, 0.0006, 0.35, R, 0.00003, sr);
  if (big) burst(e, (0.064 + R() * 0.004) * sr, 0.0005, 0.25, R, 0.00003, sr);
  const modes = big
    ? [[260 + R() * 40, 0.018, 1], [720 + R() * 90, 0.01, 0.6], [2100 + R() * 300, 0.004, 0.5], [4200 + R() * 500, 0.002, 0.3]]
    : [[520 + R() * 120, 0.008, 0.8], [1800 + R() * 400, 0.004, 1], [3900 + R() * 600, 0.0025, 0.7], [6800 + R() * 900, 0.0015, 0.3]];
  modal(e, o, modes, sr);
  normalize([o], 0.8);
  for (let i = 0; i < n; i++) o[i] += e[i] * 0.2;
  new Biquad('highpass', big ? 120 : 250, 0.7, 0, sr).run(o);
  normalize([o], 0.8);
  return fadeEdges([o], sr, 0.0001, 0.01);
}

/** Old brass cash register: key clunk, crank ratchet, the bell, drawer release, slide and stop, coins. */
export function rRegister(sr, R) {
  const [L, Rt] = alloc(1.6, sr, 2);
  const n = L.length;
  const m = new Float32Array(n);
  const k = new Float32Array(n);
  burst(k, 0, 0.004, 1, R, 0.0002, sr);
  modal(k, m, [[210, 0.03, 1], [530, 0.02, 0.6], [1350, 0.01, 0.4], [2900, 0.006, 0.3]], sr);
  const ra = new Float32Array(n);
  for (let j = 0; j < 6; j++) burst(ra, (0.09 + j * 0.028 + R() * 0.004) * sr, 0.0012, 0.6 - j * 0.05, R, 0.0001, sr);
  modal(ra, m, [[1900, 0.006, 1], [3400, 0.004, 0.6], [760, 0.01, 0.4]], sr);
  normalize([m], 0.6);
  const bell = [new Float32Array(n), new Float32Array(n)];
  bell.forEach((c, i) => {
    for (const [r, a, d] of [[1, 1, 0.55], [1.003, 0.6, 0.5], [2.32, 0.5, 0.35], [4.25, 0.32, 0.2], [6.63, 0.14, 0.12]]) {
      ping(c, 0.27 * sr, 2380 * r * (i ? 1.0015 : 1), d, a, sr, R() * TAU);
    }
  });
  normalize(bell, 0.55);
  const dr = new Float32Array(n);
  burst(dr, 0.29 * sr, 0.01, 0.5, R, 0.0005, sr);
  noiseEnv(dr, sr, R, 0.3, 0.32, (t) => Math.sin(Math.PI * Math.min(1, t / 0.3)) * 0.35, [['lowpass', 900, 0.7], ['peaking', 300, 1, 6]]);
  thump(dr, sr, 0.62, 0.2, 140, 70, 0.6, 0.02, 0.05);
  const dk = new Float32Array(n);
  burst(dk, 0.62 * sr, 0.004, 1, R, 0.0002, sr);
  modal(dk, dr, [[350, 0.04, 1], [900, 0.02, 0.6], [2200, 0.01, 0.3]], sr);
  for (let j = 0; j < 7; j++) ping(dr, (0.64 + R() * 0.25) * sr, 3500 + R() * 4500, 0.02 + R() * 0.05, 0.06 + 0.05 * R(), sr, R() * TAU);
  normalize([dr], 0.6);
  for (let i = 0; i < n; i++) { const v = m[i] + dr[i]; L[i] = v + bell[0][i]; Rt[i] = v + bell[1][i]; }
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.0002, 0.08);
}

/** SLR shutter: mirror slap, two curtains, mirror return; optionally the motor winder. */
export function rShutter(sr, R, wind) {
  const [o] = alloc(wind ? 0.75 : 0.25, sr);
  const n = o.length;
  const e = new Float32Array(n);
  burst(e, 0.001 * sr, 0.0015, 1, R, 0.00005, sr);
  burst(e, 0.009 * sr, 0.001, 0.7, R, 0.00005, sr);
  burst(e, (0.045 + R() * 0.01) * sr, 0.0012, 0.9, R, 0.00005, sr);
  burst(e, (0.075 + R() * 0.01) * sr, 0.002, 0.6, R, 0.0001, sr);
  modal(e, o, [[2600, 0.004, 1], [4800, 0.003, 0.7], [1100, 0.008, 0.6], [380, 0.02, 0.5]], sr);
  normalize([o], 0.8);
  if (wind) {
    const w = new Float32Array(n), t0 = 0.16, d = 0.36;
    let ph = 0;
    for (let i = Math.round(t0 * sr); i < Math.min(n, Math.round((t0 + d) * sr)); i++) {
      const t = i / sr - t0;
      ph += (TAU * (150 + (20 * t) / d)) / sr;
      w[i] = ((Math.sin(ph) > 0 ? 0.5 : -0.5) + (R() * 2 - 1) * 0.5) * Math.min(1, t / 0.02) * Math.min(1, (d - t) / 0.03);
    }
    new Biquad('bandpass', 1800, 0.8, 0, sr).run(w);
    normalize([w], 0.3);
    for (let i = 0; i < n; i++) o[i] += w[i];
  }
  normalize([o], 0.85);
  return fadeEdges([o], sr, 0.0001, 0.02);
}

/** Phone on a table: two vibration bursts, rattling. */
export function rBuzz(sr, R) {
  const [o] = alloc(1.05, sr);
  const n = o.length;
  const rat = wanderGen(R, 70, sr);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (TAU * (175 + 8 * Math.sin(TAU * 3 * t))) / sr;
    const on = t < 0.38 ? t : t > 0.6 && t < 0.98 ? t - 0.6 : -1;
    if (on < 0) continue;
    const env = Math.min(1, on / 0.025) * Math.min(1, (0.38 - on) / 0.03);
    o[i] = (Math.sin(ph) > 0 ? 1 : -1) * env * (0.65 + 0.35 * rat());
  }
  new Biquad('lowpass', 1600, 0.8, 0, sr).run(o);
  new Biquad('peaking', 360, 2, 5, sr).run(o);
  new Biquad('highpass', 90, 0.7, 0, sr).run(o);
  normalize([o], 0.8);
  return fadeEdges([o], sr, 0.001, 0.02);
}

/** Earpiece: on = crisp click, a squelch and a tiny roger tone; off = duller click and a static tail. */
export function rEar(sr, R, on) {
  const [L, Rt] = alloc(on ? 0.22 : 0.3, sr, 2);
  const n = L.length;
  const m = new Float32Array(n);
  burst(m, 0.0005 * sr, on ? 0.0007 : 0.0012, 1, R, 0.00003, sr);
  new Biquad('highpass', on ? 1800 : 900, 0.7, 0, sr).run(m);
  noiseEnv(m, sr, R, on ? 0.004 : 0.003, on ? 0.12 : 0.25, (t) => (on ? 0.35 : 0.3) * Math.min(1, t / 0.003) * Math.exp(-t / (on ? 0.035 : 0.08)),
    [['bandpass', 2700, 0.9], ['highpass', 900, 0.7]]);
  if (on) {
    let ph = 0;
    const i0 = Math.round(0.012 * sr), d = Math.round(0.04 * sr);
    for (let i = 0; i < d; i++) { ph += (TAU * 1150) / sr; m[i0 + i] += Math.sin(ph) * 0.06 * Math.sin((Math.PI * i) / d); }
  }
  for (let i = 0; i < n; i++) { L[i] = m[i] * 0.85; Rt[i] = m[i]; } // the earpiece sits a touch to the right
  normalize([L, Rt], 0.7);
  return fadeEdges([L, Rt], sr, 0.0001, 0.02);
}

/** One knuckle knock on a wooden door: panel modes, the knuckle click, a little rattle in the frame. */
export function rKnock(sr, R) {
  const [o] = alloc(0.35, sr);
  const n = o.length;
  const e = new Float32Array(n);
  burst(e, 0.0005 * sr, 0.0018, 1, R, 0.0001, sr);
  modal(e, o, [[88 + R() * 15, 0.06, 1], [142 + R() * 20, 0.045, 0.8], [215 + R() * 30, 0.03, 0.6], [330 + R() * 40, 0.022, 0.45],
    [610 + R() * 80, 0.012, 0.3], [1500 + R() * 300, 0.005, 0.25]], sr);
  normalize([o], 0.85);
  const k = new Float32Array(n);
  burst(k, 0.0005 * sr, 0.0009, 0.35, R, 0.00004, sr);
  new Biquad('bandpass', 2600, 0.8, 0, sr).run(k);
  for (let i = 0; i < n; i++) o[i] += k[i];
  for (let j = 0; j < 3; j++) ping(o, (0.008 + R() * 0.02) * sr, 1800 + R() * 2000, 0.004, 0.03, sr, R() * TAU);
  normalize([o], 0.85);
  return fadeEdges([o], sr, 0.0001, 0.04);
}

/** A body or a box hitting the floor: low thud, a small bounce, cloth / cardboard. */
export function rThud(sr, R) {
  const [o] = alloc(0.7, sr);
  thump(o, sr, 0, 0.35, 105 + 25 * R(), 48, 1, 0.03, 0.09);
  noiseEnv(o, sr, R, 0, 0.15, (t) => Math.min(1, t / 0.002) * Math.exp(-t / 0.03) * 0.6, [['lowpass', 900, 0.7]]);
  thump(o, sr, 0.07 + R() * 0.05, 0.2, 90, 50, 0.3, 0.02, 0.05);
  noiseEnv(o, sr, R, 0.005, 0.25, (t) => Math.min(1, t / 0.01) * Math.exp(-t / 0.06) * 0.18, [['bandpass', 1600 + R() * 1200, 0.7]]);
  new Biquad('highpass', 35, 0.7, 0, sr).run(o);
  normalize([o], 0.9);
  return fadeEdges([o], sr, 0.0002, 0.08);
}

/** Sea ice cracking: the snap, dispersive "pew" chirps (highs first), the sheet's groan, splinters. */
export function rIce(sr, R) {
  const [L, Rt] = alloc(2.2, sr, 2);
  const n = L.length;
  const m = new Float32Array(n);
  burst(m, 0, 0.003, 1, R, 0.00005, sr);
  const d = 0.18 + R() * 0.2;
  chirp(m, sr, 0.002, d, 5200 + R() * 2000, 180 + R() * 120, 0.5);
  chirp(m, sr, 0.02 + R() * 0.03, d * 1.3, 4200 + R() * 1500, 140, 0.25);
  chirp(m, sr, 0.09 + R() * 0.08, d * 1.6, 3000 + R() * 1000, 120, 0.12);
  thump(m, sr, 0.005, 1.2, 70 + R() * 30, 38, 0.45, 0.2, 0.35);
  for (let k = 0; k < 14; k++) ping(m, (0.005 + Math.pow(R(), 2) * 0.4) * sr, 2500 + R() * 6000, 0.004 + R() * 0.01, 0.05 + 0.1 * R(), sr, R() * TAU);
  const off = Math.round(sr * (0.002 + R() * 0.004));
  for (let i = 0; i < n; i++) { L[i] = m[i]; Rt[i] = i >= off ? m[i - off] : 0; }
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.0001, 0.3);
}

/** Ambience events: stick–slip creaks of pack ice and pilings (even variants), distant settling cracks (odd). */
export function rCreak(sr, R, v) {
  const dur = 0.7 + R() * 0.9;
  const [o] = alloc(dur + 0.4, sr);
  if (v % 2 === 0) {
    const exc = new Float32Array(o.length);
    const r0 = 25 + R() * 40, r1 = r0 * (0.6 + R() * 1.2);
    for (let t = 0.02; t < dur;) {
      const u = t / dur;
      exc[Math.round(t * sr)] += (0.5 + 0.5 * R()) * Math.sin(Math.PI * u);
      t += 1 / Math.max(8, r0 + (r1 - r0) * u + 6 * Math.sin(TAU * 1.3 * t));
    }
    const f = 220 + R() * 380;
    modal(exc, o, [[f, 0.03, 1], [f * 2.3, 0.02, 0.5], [f * 3.9, 0.012, 0.3], [f * 0.55, 0.05, 0.4]], sr);
    new Biquad('lowpass', 1800, 0.7, 0, sr).run(o);
  } else {
    burst(o, 0.01 * sr, 0.002, 0.6, R, 0.0001, sr);
    chirp(o, sr, 0.012, 0.3 + R() * 0.3, 2600 + R() * 1500, 120, 0.4);
    thump(o, sr, 0.015, 0.9, 60 + R() * 25, 35, 0.5, 0.25, 0.3);
    new Biquad('lowpass', 2400, 0.7, 0, sr).run(o);
  }
  normalize([o], 0.8);
  return fadeEdges([o], sr, 0.002, 0.15);
}

// ---- periodic waves for the loops --------------------------------------------------------------

/** Fourier series of one period of shape(φ), φ ∈ [0, 1) → { real, imag } for createPeriodicWave. */
export function seriesOf(shape, K = 48, N = 4096) {
  const x = new Float32Array(N);
  for (let i = 0; i < N; i++) x[i] = shape(i / N);
  const real = new Float32Array(K + 1), imag = new Float32Array(K + 1);
  for (let k = 1; k <= K; k++) {
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) {
      const w = (TAU * k * i) / N;
      a += x[i] * Math.cos(w);
      b += x[i] * Math.sin(w);
    }
    real[k] = (2 * a) / N;
    imag[k] = (2 * b) / N;
  }
  return { real, imag };
}

/** Rotor blade pass: a sharp "whup" with an exponential tail, smoothed back into the next one. */
export function bladeShape(phi) {
  const v = Math.exp(-phi / 0.09);
  if (phi < 0.95) return v;
  const s = (phi - 0.95) / 0.05;
  const k = s * s * (3 - 2 * s);
  return v * (1 - k) + k;
}

/**
 * One engine cycle: `pulses` exhaust pulses (alpha-shaped, `width` of a cycle), each a
 * little early / late and louder / softer — the irregularity is what makes a V8 burble.
 */
export function engineShape(R, pulses, width, jitter, ampVar) {
  const P = [];
  for (let j = 0; j < pulses; j++) P.push([j / pulses + (R() - 0.5) * jitter, 1 - ampVar * R()]);
  return (phi) => {
    let v = 0;
    for (const [p0, a] of P) {
      let d = phi - p0;
      d -= Math.floor(d);
      const x = d / width;
      v += a * x * Math.exp(1 - x);
    }
    return v;
  };
}
