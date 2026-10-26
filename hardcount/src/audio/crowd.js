// The crowd: thousands of people, synthesized.
//
// Every voice is a formant-synthesized person (vox.js) — groups of a few
// people yelling the same thing at their own pitch, onset and vibrato, panned
// across the stands, far ones darker — plus clappers, finger whistles and
// bleacher stomps. That material is rendered offline (in idle-time slices, at
// a third of the context rate) into:
//   beds       looping murmur / buzz / roar layers, crossfaded by excitement
//   reactions  one-shot cheer, roar, ooh, aah, groan, boo, gasp, murmur (big + small crowds)
//   hits       unison claps, stomps and the DE-FENSE syllables, scheduled live in rhythm
// Live noise through moving formant filters adds the dense "mass" of a big
// crowd under the voices. Size sets level, density (mass vs individual
// voices) and room; excitement crossfades the beds and opens the tone;
// reactions swell the bed with an afterglow that decays naturally.
//
// API (all safe before audio.unlock()):
//   crowd.update(dt, { excitement 0..1, size 0..1, home 0..1, indoor })   every frame, any subset
//   crowd.react(kind, strength = 1, side)   kind: cheer | roar | ooh | aah | groan | boo | gasp |
//       murmur | clap | chant | stomp | charge (the yell after the organ's CHARGE!).
//       side: 'home' | 'away' | 'all' — whose fans react; the share of the crowd that is
//       theirs (from `home`) scales it. Defaults: cheer roar clap chant stomp boo groan
//       charge → 'home'; ooh aah gasp murmur → 'all'.
//   crowd.stop(fade)        fade out and tear down (between screens)
//   crowd.level             0..1 smoothed loudness, for animating the stands
//   crowd.prewarm()         render everything now (loading screen)

import { audio } from './audio.js';
import {
  clamp, rng, hash, Biquad, burst, normalize, loopify, toBuffer, fadeEdges, alloc, thump, modes, panInto, setSmooth, krate,
} from './synthkit.js';
import { speak, parsePhones } from './vox.js';

const DIV = 3; // crowd material renders at a third of the context rate (16 kHz at 48 kHz)

const phraseLen = (p) => { const ph = parsePhones(p); const l = ph[ph.length - 1]; return l.start + l.dur; };
const pick = (R, a) => a[(R() * a.length) | 0];
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// pitch contours: (base Hz, duration s, R) → [[t, Hz], …]

const CONTOUR = {
  cheer: (b, d, R) => [[0, b * 0.95], [0.1 + 0.08 * R(), b * (1.3 + 0.2 * R())], [d * 0.6, b * (1.22 + 0.2 * R())], [d, b * (0.95 + 0.1 * R())]],
  woo: (b, d, R) => [[0, b * 1.1], [0.15, b * 1.75], [d * 0.6, b * (1.85 + 0.2 * R())], [d, b * 1.4]],
  ooh: (b, d, R) => [[0, b * 0.95], [d * (0.35 + 0.2 * R()), b * (1.35 + 0.15 * R())], [d, b * 0.8]],
  swell: (b, d, R) => [[0, b * 0.9], [d * 0.8, b * (1.4 + 0.2 * R())], [d, b * 1.35]],
  groan: (b, d, R) => [[0, b * 1.25], [0.12, b * 1.32], [d, b * (0.66 + 0.08 * R())]],
  boo: (b, d) => [[0, b * 0.92], [0.12, b], [d * 0.7, b * 0.98], [d, b * 0.88]],
  oh: (b, d) => [[0, b * 1.2], [d, b * 0.9]],
  chant: (b, d) => [[0, b * 1.02], [d * 0.3, b * 1.04], [d, b * 0.9]],
  speech: (b, d, R) => {
    const pts = [];
    for (let t = 0; t <= d + 0.4; t += 0.16 + 0.2 * R()) pts.push([t, b * (0.82 + 0.42 * R())]);
    return pts;
  },
  yell: (b, d, R) => {
    const pts = [[0, b]];
    for (let t = 0.25; t < d; t += 0.35 + 0.5 * R()) pts.push([t, b * (1.1 + 0.4 * R())]);
    pts.push([d + 0.1, b]);
    return pts;
  },
};

// babble: random syllables in phrases with pauses (conversation, shouting)
const CONS = ['t', 'd', 'k', 'g', 'p', 'b', 's', 'f', 'sh', 'm', 'n', 'l', 'r', 'w', 'h', 'z', 'j'];
const VOW = ['i', 'I', 'e', 'ae', 'a', 'o', 'O', 'U', 'u', 'A', '@', '@', 'I'];
function babble(R, secs, { pause = [0.25, 0.9], syl = [2, 8], vdur = [0.07, 0.2] } = {}) {
  const out = [];
  let t = R() * 0.6;
  out.push(`_:${t.toFixed(3)}`);
  while (t < secs) {
    const n = syl[0] + Math.floor(R() * (syl[1] - syl[0] + 1));
    for (let s = 0; s < n; s++) {
      if (R() < 0.75) { const c = pick(R, CONS); out.push(c); t += 0.06; }
      const d = vdur[0] + R() * (vdur[1] - vdur[0]);
      out.push(`${pick(R, VOW)}:${d.toFixed(3)}`);
      t += d;
      if (R() < 0.25) { out.push(pick(R, ['n', 't', 's', 'l', 'k'])); t += 0.06; }
    }
    const p = pause[0] + R() * (pause[1] - pause[0]);
    out.push(`_:${p.toFixed(3)}`);
    t += p;
  }
  return out.join(' ');
}

const YELLS = ['h e:.35', 'g O:.45', 'l e t s:.12 g O:.4', 'k A m:.06 O n:.3', 'd i:.2 f e n s', 'j e:.5', 'w u:.45', 'g O:.25 g O:.3', 'h e j:.08 r e f:.3'];

// ---------------------------------------------------------------------------
// render building blocks (generators: they yield between groups so rendering
// can be sliced into idle time)

/** A layer of voice groups. density < 1 → a small crowd (fewer groups, fewer voices each). */
function* voiceLayer(L, Rt, sr, R, o, density = 1) {
  const groups = Math.max(1, Math.round(o.groups * density));
  for (let g = 0; g < groups; g++) {
    const female = R() < (o.female ?? 0.3);
    const scale = (female ? 1.16 : 1) * (0.95 + 0.1 * R());
    const base = (o.f0[0] + (o.f0[1] - o.f0[0]) * R()) * (female ? 1.55 : 1);
    const phones = typeof o.phones === 'function' ? o.phones(R, g) : Array.isArray(o.phones) ? pick(R, o.phones) : o.phones;
    const speed = o.speed ? o.speed[0] + R() * (o.speed[1] - o.speed[0]) : 1;
    const dur = phraseLen(phones) * speed;
    const vmin = density < 1 ? 1 : o.voices[0], vmax = density < 1 ? Math.max(1, Math.round(o.voices[1] * 0.4)) : o.voices[1];
    const nv = vmin + Math.floor(R() * (vmax - vmin + 1));
    const spread = o.spread ?? 0.2;
    const voices = [];
    for (let v = 0; v < nv; v++) {
      const b = base * (0.88 + 0.24 * R());
      voices.push({ f0: CONTOUR[o.contour](b, dur, R), gain: 0.55 + 0.45 * R(), delay: R() * spread, jit: 0.014 + 0.02 * R(), vib: [4 + 3 * R(), 8 + 30 * R()] });
    }
    const at = o.at[0] + R() * (o.at[1] - o.at[0]);
    const br = o.breath ? o.breath[0] + R() * (o.breath[1] - o.breath[0]) : 0.2;
    const mono = speak({ sr, R, phones, voices, shout: o.shout ?? 0.8, breath: br, speed, scale, tilt: o.tilt, formantJit: 25, len: dur + spread + 0.2 });
    const dist = R();
    if (dist > 0.35) new Biquad('lowpass', 6000 - 4200 * dist, 0.6, 0, sr).run(mono);
    if (o.am) { // pulsing (a booing crowd, a chanting section)
      const rate = o.am[0] + R() * (o.am[1] - o.am[0]), ph = R() * 6.28;
      for (let i = 0; i < mono.length; i++) mono[i] *= 0.72 + 0.28 * Math.sin(ph + (6.2832 * rate * i) / sr);
    }
    if (o.loop) { // beds: wrap the tail around so the loop has no gap
      const n = L.length, i0 = Math.round(at * sr) % n;
      const a = ((clamp((R() * 2 - 1) * (o.pan ?? 0.95), -1, 1) + 1) * Math.PI) / 4, gg = (o.gain ?? 1) * (1 - 0.45 * dist) * Math.SQRT2;
      const gl = Math.cos(a) * gg, gr = Math.sin(a) * gg;
      for (let i = 0; i < mono.length; i++) { const j = (i0 + i) % n; L[j] += mono[i] * gl; Rt[j] += mono[i] * gr; }
    } else {
      panInto(L, Rt, mono, (R() * 2 - 1) * (o.pan ?? 0.95), (o.gain ?? 1) * (1 - 0.45 * dist), at * sr);
    }
    yield;
  }
}

/** A few hand-clap timbres (palm cavity resonance varies per person). */
function clapKernels(sr, R, k = 10) {
  const ks = [];
  for (let i = 0; i < k; i++) {
    const d = new Float32Array(Math.round(0.035 * sr));
    burst(d, 0, 0.003 + R() * 0.005, 1, R, 0.0003, sr);
    new Biquad('bandpass', 800 + R() * 1900, 1.2 + R() * 1.8, 0, sr).run(d);
    new Biquad('highpass', 400, 0.7, 0, sr).run(d);
    normalize([d], 1);
    ks.push(d);
  }
  return ks;
}

/** Applause: n independent clappers at ~rate claps/s, following env(u) over dur. */
function* applause(L, Rt, sr, R, o) {
  const ks = clapKernels(sr, R);
  const n = L.length;
  for (let p = 0; p < o.n; p++) {
    const pan = R() * 2 - 1, a = ((pan + 1) * Math.PI) / 4, gl = Math.cos(a), gr = Math.sin(a);
    const rate = o.rate * (0.75 + 0.5 * R()), kern = pick(R, ks);
    const amp = (0.35 + 0.65 * R()) * (o.gain ?? 1) * (R() < 0.6 ? 1 : 0.55);
    let t = o.at + R() / rate + (o.lag ?? 0.3) * R();
    while (t < o.at + o.dur) {
      const e = o.env(clamp((t - o.at) / o.dur, 0, 1));
      if (R() < e) {
        const i0 = Math.round(t * sr), g = amp * (0.6 + 0.4 * e);
        for (let i = 0; i < kern.length; i++) {
          const j = o.loop ? (i0 + i) % n : i0 + i;
          if (j >= n) break;
          L[j] += kern[i] * g * gl; Rt[j] += kern[i] * g * gr;
        }
      }
      t += (1 / rate) * (0.88 + 0.24 * R());
    }
    if (p % 25 === 24) yield;
  }
}

/** Fans' finger whistles: bright sine glides with a fast wobble. */
function whistles(L, Rt, sr, R, count, at, span, gain, loop = false) {
  const n = L.length;
  for (let k = 0; k < count; k++) {
    const t0 = at + R() * span, d = 0.35 + R() * 0.75, f0 = 2100 + R() * 1300;
    const up = R() < 0.6 ? 0.22 : -0.12;
    const pan = R() * 2 - 1, a = ((pan + 1) * Math.PI) / 4, g = gain * (0.35 + 0.65 * R());
    let ph = 0;
    const m = Math.round(d * sr), i0 = Math.round(t0 * sr);
    for (let i = 0; i < m; i++) {
      const u = i / m, s = u * u * (3 - 2 * u);
      ph += (6.2832 * f0 * (1 + up * s) * (1 + 0.012 * Math.sin((6.2832 * 7 * i) / sr))) / sr;
      const v = Math.sin(ph) * Math.pow(Math.sin(Math.PI * u), 0.6) * g;
      const j = loop ? (i0 + i) % n : i0 + i;
      if (j >= n) break;
      L[j] += v * Math.cos(a); Rt[j] += v * Math.sin(a);
    }
  }
}

/** Everyone's feet at once on the bleachers (aluminium rattle for small venues). */
function stompHit(sr, R, people = 140, spread = 0.028, metal = 0.5) {
  const [L, Rt] = alloc(0.7, sr, 2);
  const kern = [];
  for (let k = 0; k < 6; k++) {
    const d = new Float32Array(Math.round(0.35 * sr));
    thump(d, sr, 0, 85 + R() * 30, 52 + R() * 12, 0.02, 0.07 + R() * 0.05, 1);
    if (metal > 0) modes(d, sr, R, 0.001, [[230 + R() * 90, 0.09, 1], [520 + R() * 120, 0.06, 0.6], [910 + R() * 160, 0.04, 0.4]], 0.35 * metal);
    const nz = new Float32Array(d.length);
    burst(nz, 0, 0.025, 0.3, R, 0.002, sr);
    new Biquad('lowpass', 900, 0.7, 0, sr).run(nz);
    for (let i = 0; i < d.length; i++) d[i] += nz[i];
    kern.push(d);
  }
  for (let p = 0; p < people; p++) {
    const t = 0.06 + clamp(R.gauss ? R.gauss() * spread : (R() - 0.5) * spread * 3, -0.06, 0.2);
    panInto(L, Rt, pick(R, kern), R() * 2 - 1, 0.4 + 0.6 * R(), t * sr);
  }
  for (const c of [L, Rt]) new Biquad('highpass', 35, 0.7, 0, sr).run(c);
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.002, 0.08);
}

/** Everyone clapping at once (a rhythmic clap). */
function clapHit(sr, R, people = 180, spread = 0.02) {
  const [L, Rt] = alloc(0.32, sr, 2);
  const ks = clapKernels(sr, R, 14);
  for (let p = 0; p < people; p++) {
    const t = 0.05 + clamp(R.gauss() * spread, -0.045, 0.12);
    panInto(L, Rt, pick(R, ks), R() * 2 - 1, 0.3 + 0.7 * R(), t * sr);
  }
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.002, 0.05);
}

// ---------------------------------------------------------------------------
// reaction & bed specs

const RX = {
  cheer: {
    len: 4.4,
    layers: [
      { groups: 14, voices: [2, 5], phones: ['j:.08 e:1.3 @:.3', 'j:.07 ae:1.5', 'h:.06 e:1.1', 'j:.06 e:.7 ae:.8'], at: [0.02, 0.3], spread: 0.3, f0: [175, 265], contour: 'cheer', shout: 1, breath: [0.15, 0.45], speed: [0.75, 1.45] },
      { groups: 6, voices: [2, 4], phones: 'w:.08 u:1.4', at: [0.05, 0.45], spread: 0.25, f0: [230, 320], female: 0.5, contour: 'woo', shout: 0.9, breath: [0.2, 0.4], speed: [0.7, 1.3], gain: 0.7 },
      { groups: 6, voices: [2, 5], phones: 'a:1.6', at: [0, 0.4], spread: 0.3, f0: [170, 250], contour: 'cheer', shout: 1, breath: [0.2, 0.5], speed: [0.7, 1.4], gain: 0.85 },
    ],
    claps: { n: 90, at: 0.25, dur: 3.8, rate: 4, gain: 0.32, env: (u) => Math.min(1, u * 6) * Math.pow(1 - u, 1.3) },
    whistles: [3, 0.3, 1.6, 0.07],
  },
  roar: {
    len: 8,
    layers: [
      { groups: 18, voices: [4, 7], phones: ['j:.08 e:2.2 @:.4', 'j:.07 ae:2.6', 'a:2.8', 'j:.06 e:1.2 ae:1.4'], at: [0, 0.35], spread: 0.35, f0: [180, 280], contour: 'yell', shout: 1, breath: [0.2, 0.5], speed: [0.8, 1.6] },
      { groups: 8, voices: [2, 4], phones: 'w:.08 u:1.6', at: [0.1, 1.4], spread: 0.3, f0: [240, 330], female: 0.55, contour: 'woo', shout: 0.95, breath: [0.2, 0.4], speed: [0.7, 1.3], gain: 0.7 },
      { groups: 10, voices: [3, 6], phones: ['a:2.4', 'e:2.2', 'ae:2.5'], at: [1.4, 3.2], spread: 0.4, f0: [180, 270], contour: 'yell', shout: 1, breath: [0.25, 0.5], speed: [0.8, 1.4], gain: 0.85 },
    ],
    claps: { n: 160, at: 0.3, dur: 7.2, rate: 4.6, gain: 0.36, env: (u) => Math.min(1, u * 8) * (u < 0.55 ? 1 : Math.pow((1 - u) / 0.45, 1.3)) },
    whistles: [8, 0.3, 5.5, 0.08],
    rumble: 0.35,
  },
  ooh: {
    len: 2.4,
    layers: [{ groups: 22, voices: [3, 6], phones: ['u:.35 O:.55', 'u:.45 o:.45', 'O:.8'], at: [0, 0.1], spread: 0.12, f0: [140, 220], contour: 'ooh', shout: 0.65, breath: [0.2, 0.5], speed: [0.85, 1.35] }],
  },
  aah: {
    len: 3.2,
    layers: [{ groups: 22, voices: [3, 6], phones: ['a:1.7', 'ae:1.6', 'a:1.2 o:.4'], at: [0, 0.6], spread: 0.45, f0: [150, 230], contour: 'swell', shout: 0.75, breath: [0.2, 0.45], speed: [0.85, 1.3] }],
  },
  groan: {
    len: 2.8,
    layers: [{ groups: 18, voices: [3, 6], phones: ['o:.6 u:.5', 'A:.4 o:.7', 'n:.06 O:1.0', 'ae:.3 o:.6'], at: [0, 0.18], spread: 0.2, f0: [140, 210], contour: 'groan', shout: 0.55, breath: [0.3, 0.6], speed: [0.85, 1.3] }],
  },
  boo: {
    len: 3.8,
    layers: [{ groups: 22, voices: [4, 7], phones: 'b:.05 u:2.2', at: [0, 0.4], spread: 0.35, f0: [110, 170], female: 0.2, contour: 'boo', shout: 0.75, breath: [0.2, 0.4], speed: [0.7, 1.2], am: [1.8, 3.4] }],
  },
  gasp: {
    len: 1.4,
    layers: [
      { groups: 14, voices: [1, 3], phones: ['h:.2 A:.06', 'h:.16 a:.08', 'h:.22 o:.05'], at: [0, 0.08], spread: 0.08, f0: [150, 220], contour: 'oh', shout: 0.5, breath: [0.9, 1], speed: [0.8, 1.2], tilt: 4000 },
      { groups: 6, voices: [2, 4], phones: ['O:.18', 'o:.2'], at: [0.05, 0.15], spread: 0.08, f0: [160, 230], contour: 'oh', shout: 0.6, breath: [0.3, 0.5], speed: [0.8, 1.3], gain: 0.6 },
    ],
  },
  murmur: {
    len: 4.6,
    layers: [{ groups: 22, voices: [1, 1], phones: (R) => babble(R, 3.6, { pause: [0.15, 0.6] }), at: [0, 0.9], spread: 0, f0: [100, 145], female: 0.45, contour: 'speech', shout: 0.2, breath: [0.15, 0.3], gain: 0.8 }],
    env: (u) => Math.min(1, u * 4) * (u < 0.6 ? 1 : (1 - u) / 0.4),
  },
  scream: {
    len: 6.8,
    layers: [{ groups: 26, voices: [3, 6], phones: ['a:5', 'e:5', 'i:4.6', 'ae:5', 'a:2.4 e:2.4'], at: [0, 0.9], spread: 0.5, f0: [190, 290], female: 0.4, contour: 'yell', shout: 1, breath: [0.3, 0.6], speed: [0.85, 1.15] }],
    whistles: [9, 0.2, 5.5, 0.09],
  },
  'chant:de': {
    len: 0.8,
    layers: [{ groups: 24, voices: [4, 7], phones: 'd:.05 i:.27', at: [0, 0.035], spread: 0.06, f0: [205, 245], female: 0.3, contour: 'chant', shout: 0.95, breath: [0.15, 0.35] }],
  },
  'chant:fense': {
    len: 1,
    layers: [{ groups: 24, voices: [4, 7], phones: 'f:.08 e:.3 n:.07 s:.13', at: [0, 0.035], spread: 0.06, f0: [172, 205], female: 0.3, contour: 'chant', shout: 0.95, breath: [0.15, 0.35] }],
  },
  // the answer to the organ's CHARGE! riff
  'chant:charge': {
    len: 1.3,
    layers: [{ groups: 26, voices: [4, 7], phones: 't:.03 sh:.07 a:.36 r:.08 zh:.09', at: [0, 0.06], spread: 0.1, f0: [190, 245], female: 0.3, contour: 'chant', shout: 1, breath: [0.2, 0.4] }],
    whistles: [3, 0.3, 0.5, 0.06],
  },
};

const BEDS = {
  // a handful of people: individual conversations you can almost follow (small crowds)
  'bed:few': {
    secs: 9,
    layers: [{ groups: 7, voices: [1, 1], phones: (R) => babble(R, 9.4, { pause: [0.4, 1.6] }), at: [0, 0], spread: 0, f0: [100, 145], female: 0.45, contour: 'speech', shout: 0.3, breath: [0.15, 0.3], gain: 0.8, loop: true, pan: 0.8 }],
    claps: { n: 3, at: 0, dur: 9, rate: 0.4, gain: 0.3, env: () => 0.2, loop: true },
  },
  'bed:murmur': {
    secs: 9,
    layers: [{ groups: 26, voices: [1, 1], phones: (R) => babble(R, 9.4), at: [0, 0], spread: 0, f0: [100, 150], female: 0.4, contour: 'speech', shout: 0.25, breath: [0.15, 0.35], gain: 0.75, loop: true }],
    claps: { n: 8, at: 0, dur: 9, rate: 0.6, gain: 0.25, env: () => 0.25, loop: true },
  },
  'bed:buzz': {
    secs: 9,
    layers: [
      { groups: 26, voices: [1, 2], phones: (R) => babble(R, 9.4, { pause: [0.1, 0.5], vdur: [0.08, 0.24] }), at: [0, 0], spread: 0.05, f0: [125, 185], female: 0.4, contour: 'speech', shout: 0.55, breath: [0.15, 0.35], gain: 0.75, loop: true },
      { groups: 16, voices: [1, 3], phones: (R) => YELLS[(R() * YELLS.length) | 0], at: [0, 9], spread: 0.1, f0: [170, 250], contour: 'yell', shout: 0.95, breath: [0.2, 0.4], gain: 0.6, loop: true },
    ],
    claps: { n: 30, at: 0, dur: 9, rate: 1.5, gain: 0.3, env: () => 0.45, loop: true },
    whistles: [3, 0, 8.5, 0.05, true],
  },
  'bed:roar': {
    secs: 7,
    layers: [
      { groups: 28, voices: [3, 6], phones: ['j:.08 e:1.6 @:.3', 'a:1.9', 'j:.07 ae:1.7', 'w:.08 u:1.3', 'e:1.5 a:.6'], at: [0, 7], spread: 0.35, f0: [180, 280], female: 0.35, contour: 'yell', shout: 1, breath: [0.25, 0.5], speed: [0.8, 1.6], loop: true },
    ],
    claps: { n: 120, at: 0, dur: 7, rate: 3.8, gain: 0.32, env: () => 0.85, loop: true },
    whistles: [6, 0, 6.5, 0.07, true],
  },
};

function* gReaction(sr, R, spec, density) {
  const [L, Rt] = alloc(spec.len, sr, 2);
  for (const lay of spec.layers) yield* voiceLayer(L, Rt, sr, R, lay, density);
  if (spec.claps) yield* applause(L, Rt, sr, R, { ...spec.claps, n: Math.round(spec.claps.n * (density < 1 ? 0.25 : 1)) });
  if (spec.whistles) { const [c, at, span, g] = spec.whistles; whistles(L, Rt, sr, R, Math.max(1, Math.round(c * density)), at, span, g); }
  if (spec.rumble) { // a big crowd's chest-deep rumble under the roar
    const lp = [new Biquad('lowpass', 160, 0.7, 0, sr), new Biquad('lowpass', 160, 0.7, 0, sr)];
    for (let i = 0; i < L.length; i++) {
      const u = i / L.length, e = Math.min(1, u * 10) * Math.pow(1 - u, 1.5) * spec.rumble;
      L[i] += lp[0].tick(R() * 2 - 1) * e; Rt[i] += lp[1].tick(R() * 2 - 1) * e;
    }
  }
  if (spec.env) for (let i = 0; i < L.length; i++) { const e = spec.env(i / L.length); L[i] *= e; Rt[i] *= e; }
  for (const c of [L, Rt]) new Biquad('highpass', 70, 0.7, 0, sr).run(c);
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.004, 0.25);
}

function* gBed(sr, R, spec) {
  const [L, Rt] = alloc(spec.secs, sr, 2);
  for (const lay of spec.layers) yield* voiceLayer(L, Rt, sr, R, lay, 1);
  if (spec.claps) yield* applause(L, Rt, sr, R, spec.claps);
  if (spec.whistles) { const [c, at, span, g] = spec.whistles; whistles(L, Rt, sr, R, c, at, span, g, true); }
  for (const c of [L, Rt]) new Biquad('highpass', 70, 0.7, 0, sr).runLoop(c);
  return normalize([L, Rt], 0.9);
}

// name → generator factory (sr, R) — everything the crowd can play
const BUFS = {};
for (const k of Object.keys(BEDS)) BUFS[k] = (sr, R) => gBed(sr, R, BEDS[k]);
for (const k of ['cheer', 'roar', 'ooh', 'aah', 'groan', 'boo', 'gasp', 'murmur', 'scream', 'chant:de', 'chant:fense', 'chant:charge']) {
  BUFS[k] = (sr, R) => gReaction(sr, R, RX[k], 1);
}
for (const k of ['cheer', 'roar', 'ooh', 'groan', 'boo', 'aah']) BUFS[k + ':small'] = (sr, R) => gReaction(sr, R, RX[k], 0.3);
for (let v = 0; v < 3; v++) {
  BUFS['clap:' + v] = function* (sr, R) { yield; return clapHit(sr, R); };
  BUFS['stomp:' + v] = function* (sr, R) { yield; return stompHit(sr, R, 140, 0.028, v === 2 ? 0.9 : 0.35); };
}
// warm order: what a game needs first
const WARM = ['bed:murmur', 'bed:buzz', 'bed:few', 'cheer', 'ooh', 'groan', 'roar', 'bed:roar', 'boo', 'clap:0', 'clap:1', 'stomp:0', 'stomp:1',
  'chant:de', 'chant:fense', 'aah', 'gasp', 'murmur', 'scream', 'chant:charge', 'cheer:small', 'ooh:small', 'groan:small', 'roar:small', 'boo:small',
  'aah:small', 'clap:2', 'stomp:2'];

const KINDS = ['cheer', 'roar', 'ooh', 'aah', 'groan', 'boo', 'gasp', 'murmur', 'clap', 'chant', 'stomp', 'charge'];
const SIDE = { cheer: 'home', roar: 'home', clap: 'home', chant: 'home', stomp: 'home', boo: 'home', groan: 'home', charge: 'home', ooh: 'all', aah: 'all', gasp: 'all', murmur: 'all' };
// how much each reaction lifts the bed afterwards, and its level
const GLOW = { cheer: 0.35, roar: 0.8, ooh: 0.18, aah: 0.3, groan: 0.1, boo: 0.3, gasp: 0.12, murmur: 0.05, clap: 0.25, chant: 0.4, stomp: 0.55, charge: 0.4 };
const LEVEL = { cheer: 0.8, roar: 1, ooh: 0.75, aah: 0.62, groan: 0.62, boo: 0.75, gasp: 0.62, murmur: 0.6, clap: 0.8, chant: 0.8, stomp: 0.78, charge: 0.85 };

// ===========================================================================

class Crowd {
  static WARM = WARM;

  constructor() {
    this.ctx = null;
    this.state = { excitement: 0.2, size: 0.8, home: 0.6, indoor: false };
    this.level = 0;
    this._E = 0.2;
    this._glow = 0;
    this._act = 0;
  }

  _ok() {
    const ctx = audio.ctx;
    if (!ctx) return false;
    if (ctx !== this.ctx) this._setup(ctx);
    return true;
  }

  _setup(ctx) {
    this._kill(0.01);
    this._out = this._send = this._rxBus = null;
    this.ctx = ctx;
    this._bufs = new Map();
    this._tasks = new Map();
    this._rx = new Set();
    this._bed = null;
    this._memo = new Float64Array(24).fill(NaN);
    this._rng = rng(0xc20d);
    this.sr = ctx.sampleRate / DIV;
    this._warmIdx = 0;
    if (!audio.offline && typeof setTimeout === 'function') setTimeout(() => this._warm(ctx), 600);
  }

  // ---- buffers: generator tasks, sliced into idle time, or drained on demand ----
  _task(name) {
    let t = this._tasks.get(name);
    if (!t) {
      t = { gen: BUFS[name](this.sr, rng(hash('crowd:' + name))), done: false };
      this._tasks.set(name, t);
    }
    return t;
  }

  _step(name, budgetMs) {
    const t = this._task(name);
    const t0 = performance.now();
    while (!t.done) {
      const r = t.gen.next();
      if (r.done) {
        t.done = true;
        this._bufs.set(name, toBuffer(this.ctx, r.value, this.sr));
        break;
      }
      if (performance.now() - t0 > budgetMs) break;
    }
    return t.done;
  }

  _buf(name) {
    if (!BUFS[name]) return null;
    if (!this._bufs.has(name)) this._step(name, Infinity);
    return this._bufs.get(name);
  }

  _warm(ctx) {
    if (ctx !== this.ctx) return;
    while (this._warmIdx < WARM.length && this._bufs.has(WARM[this._warmIdx])) this._warmIdx++;
    if (this._warmIdx >= WARM.length) return;
    const go = (dl) => {
      if (ctx !== this.ctx) return;
      const budget = dl && dl.timeRemaining ? Math.max(4, Math.min(12, dl.timeRemaining() - 1)) : 8;
      this._step(WARM[this._warmIdx], budget);
      this._warm(ctx);
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 400 });
    else setTimeout(go, 25);
  }

  /** Render everything now (behind a loading screen). */
  prewarm() {
    if (!this._ok()) return;
    for (const k of WARM) this._buf(k);
  }

  // ---- graph ----
  _graph() {
    if (this._out) return;
    const ctx = this.ctx;
    this._out = ctx.createGain();
    this._out.gain.value = 1;
    // anti-imaging: the material is rendered at a third of the rate; keep its
    // resampling images (mirrored above the old Nyquist) out of the mix
    const aa = [ctx.createBiquadFilter(), ctx.createBiquadFilter()];
    for (const f of aa) { f.type = 'lowpass'; f.frequency.value = (ctx.sampleRate / DIV) * 0.44; f.Q.value = 0.6; }
    this._out.connect(aa[0]).connect(aa[1]).connect(audio.crowdBus);
    this._send = ctx.createGain();
    this._send.gain.value = 0.3;
    aa[1].connect(this._send).connect(audio.space);
    this._rxBus = ctx.createGain();
    this._rxBus.connect(this._out);
  }

  _ensureBed() {
    if (this._bed) return this._bed;
    this._graph();
    const ctx = this.ctx, t = ctx.currentTime;
    const B = { nodes: [], srcs: [], layers: {} };
    const mk = (n) => { B.nodes.push(n); return n; };
    B.gain = mk(ctx.createGain());
    B.gain.gain.value = 0;
    B.gain.gain.setTargetAtTime(1, t, 0.4);
    B.lp = krate(mk(ctx.createBiquadFilter()));
    B.lp.type = 'lowpass';
    B.lp.frequency.value = 4000;
    B.lp.Q.value = 0.5;
    B.lp.connect(B.gain).connect(this._out);
    // the mass: noise through two moving vowel-ish formants (a crowd too big to hear voices in)
    const src = mk(ctx.createBufferSource());
    src.buffer = audio.noise('pink');
    src.loop = true;
    src.start(t, Math.random() * 1.5);
    B.srcs.push(src);
    B.f1 = krate(mk(ctx.createBiquadFilter()));
    B.f1.type = 'bandpass'; B.f1.frequency.value = 600; B.f1.Q.value = 1.1;
    B.f2 = krate(mk(ctx.createBiquadFilter()));
    B.f2.type = 'bandpass'; B.f2.frequency.value = 1500; B.f2.Q.value = 1.4;
    B.massG = mk(ctx.createGain());
    B.massG.gain.value = 0;
    const g2 = mk(ctx.createGain());
    g2.gain.value = 0.55;
    const hp = krate(mk(ctx.createBiquadFilter()));
    hp.type = 'highpass'; hp.frequency.value = 190; hp.Q.value = 0.6;
    src.connect(hp);
    hp.connect(B.f1).connect(B.massG);
    hp.connect(B.f2).connect(g2).connect(B.massG);
    // slow swells in the mass
    const sw = mk(ctx.createGain());
    sw.gain.value = 0.8;
    B.massG.connect(sw).connect(B.lp);
    for (const [r, d] of [[0.07, 0.12], [0.19, 0.08]]) {
      const o = mk(ctx.createOscillator());
      o.frequency.value = r;
      o.start(t);
      B.srcs.push(o);
      const depth = mk(ctx.createGain());
      depth.gain.value = d;
      o.connect(depth).connect(sw.gain);
    }
    this._bed = B;
    this._idleT = null;
    return B;
  }

  _bedLayer(B, name) {
    if (B.layers[name] || !this._bufs.has(name)) return B.layers[name] || null;
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this._bufs.get(name);
    s.loop = true;
    s.playbackRate.value = 0.97 + Math.random() * 0.06;
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(g).connect(B.lp);
    s.start(ctx.currentTime, Math.random() * s.buffer.duration);
    B.srcs.push(s);
    B.nodes.push(s, g);
    return (B.layers[name] = g);
  }

  _killBed(B, fade) {
    if (!B) return;
    const t = this.ctx.currentTime;
    B.gain.gain.cancelScheduledValues(t);
    B.gain.gain.setTargetAtTime(0, t, Math.max(0.005, fade / 4));
    for (const s of B.srcs) { try { s.stop(t + fade + 0.1); } catch { /* */ } }
    const nodes = B.nodes;
    if (B.srcs[0]) B.srcs[0].onended = () => { for (const n of nodes) { try { n.disconnect(); } catch { /* */ } } };
  }

  _kill(fade) {
    if (!this.ctx) return;
    this._killBed(this._bed, fade);
    this._bed = null;
    const t = this.ctx.currentTime;
    for (const r of this._rx || []) {
      try { r.g.gain.cancelScheduledValues(t); r.g.gain.setTargetAtTime(0, t, Math.max(0.005, fade / 4)); r.src.stop(t + fade + 0.05); } catch { /* */ }
    }
  }

  // ---- public API ----
  update(dt = 0.016, st = {}) {
    const S = this.state;
    for (const k of ['excitement', 'size', 'home']) if (st[k] != null && Number.isFinite(+st[k])) S[k] = clamp(+st[k], 0, 1);
    if (st.indoor != null) S.indoor = !!st.indoor;
    dt = clamp(+dt || 0, 0, 0.5);
    // excitement swells fast and settles slowly; reactions leave an afterglow
    this._glow *= Math.exp(-dt / 5);
    const target = clamp(S.excitement + this._glow, 0, 1);
    this._E += (target - this._E) * (1 - Math.exp(-dt / (target > this._E ? 0.5 : 2.2)));
    this._act *= Math.exp(-dt / 1.6);
    const sizeG = this._sizeGain();
    this.level = clamp(Math.max(this._E * (0.35 + 0.65 * S.size), this._act), 0, 1);
    if (!this._ok()) return;
    const B = this._bed || (S.size > 0.002 ? this._ensureBed() : null);
    if (!B) return;
    // tear down after a while at size 0
    const now = this.ctx.currentTime;
    if (S.size <= 0.002) {
      if (this._idleT == null) this._idleT = now;
      else if (now - this._idleT > 2.5) { this._killBed(B, 0.3); this._bed = null; return; }
    } else this._idleT = null;
    const e = this._E, size = S.size, M = this._memo, set = (i, p, v, tc) => setSmooth(M, i, p, v, now, tc, 0.01);
    const wm = 1 - smooth(0.18, 0.55, e), wr = smooth(0.52, 0.92, e), wb = Math.max(0, 1 - wm - wr);
    const few = 1 - smooth(0.12, 0.55, size); // small crowds: individual conversations
    const bed = 0.5 * sizeG * (0.3 + 0.7 * Math.pow(e, 0.9)) * (1 - 0.3 * size) * (S.indoor ? 1.15 : 1);
    const layers = [['bed:murmur', wm * (1 - few)], ['bed:buzz', wb], ['bed:roar', wr], ['bed:few', wm * few]];
    layers.forEach(([name, w], i) => {
      let g = B.layers[name];
      if (!g && w > 0.001) {
        if (!this._bufs.has(name) && audio.offline) this._buf(name);
        g = this._bedLayer(B, name);
      }
      if (g) set(i, g.gain, bed * Math.sqrt(w), 0.25);
    });
    set(4, B.massG.gain, 0.5 * sizeG * Math.pow(size, 1.3) * (0.25 + 0.75 * e), 0.3);
    set(5, B.f1.frequency, 520 + 380 * e, 0.4);
    set(6, B.f2.frequency, 1300 + 900 * e, 0.4);
    set(7, B.lp.frequency, (2300 + 6500 * e) * (S.indoor ? 0.85 : 1), 0.3);
    set(8, this._send.gain, (S.indoor ? 0.55 : 0.28) * (0.45 + 0.55 * size), 0.5);
  }

  _sizeGain() {
    return Math.pow(10, (-15 * Math.pow(1 - this.state.size, 1.2)) / 20);
  }

  react(kind, strength = 1, side) {
    if (!KINDS.includes(kind)) return;
    const s = clamp(+strength || 0, 0, 1);
    if (s <= 0.01) return;
    const S = this.state;
    side = side === 'home' || side === 'away' || side === 'all' ? side : SIDE[kind];
    const share = side === 'away' ? 1 - S.home : side === 'all' ? 1 : S.home;
    const g = LEVEL[kind] * Math.pow(s, 0.7) * Math.sqrt(clamp(share, 0.05, 1)) * this._sizeGain() * 0.55 * (S.indoor ? 1.12 : 1);
    this._glow = Math.max(this._glow, GLOW[kind] * s * clamp(share * 1.4, 0, 1));
    this._act = Math.max(this._act, clamp(g * 1.6, 0, 1));
    if (!this._ok()) return;
    this._graph();
    const now = this.ctx.currentTime + 0.01;
    const lp = 2500 + 10000 * s;
    if (kind === 'clap') this._rhythm(now, g, 'clap', 0.42, 12, lp);
    else if (kind === 'chant') this._chant(now, g, lp);
    else if (kind === 'charge') this._play('chant:charge', now, g, lp);
    else if (kind === 'stomp') {
      this._play('scream', now, g * 0.85, lp, 0.6);
      this._rhythm(now + 0.15, g * 1.1, 'stomp', 0.44, 13, lp);
    } else {
      const big = Math.pow(S.size, 0.7), small = BUFS[kind + ':small'] ? Math.pow(1 - S.size, 0.8) : 0;
      if (big > 0.02 || !small) this._play(kind, now, g * (small ? big : 1), lp);
      if (small > 0.02) this._play(kind + ':small', now, g * small * 1.3, lp);
    }
  }

  _play(name, when, gain, lp, fadeIn = 0, hit = false) {
    const buf = this._buf(name);
    if (!buf) return;
    const ctx = this.ctx;
    // keep it bounded: retire the oldest reaction if too many overlap (rhythmic
    // hits are scheduled ahead and short, so they don't count)
    if (!hit) {
      const live = [...this._rx].filter((r) => !r.hit);
      if (live.length > 6) {
        const old = live[0];
        old.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        try { old.src.stop(ctx.currentTime + 0.5); } catch { /* */ }
        this._rx.delete(old);
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.96 + Math.random() * 0.08;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    f.Q.value = 0.5;
    const g = ctx.createGain();
    if (fadeIn) { g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + fadeIn); } else g.gain.value = gain;
    src.connect(f).connect(g).connect(this._rxBus);
    const r = { src, g, hit };
    this._rx.add(r);
    src.onended = () => { this._rx.delete(r); src.disconnect(); f.disconnect(); g.disconnect(); };
    src.start(when);
  }

  // rhythmic claps / stomps: a build, a peak, then the crowd loses interest; the tempo drifts up
  _rhythm(t0, gain, what, beat, count, lp) {
    let t = t0;
    for (let k = 0; k < count; k++) {
      const u = k / (count - 1);
      const arc = Math.min(1, 0.45 + u * 1.6) * (u > 0.7 ? 1 - (u - 0.7) * 1.4 : 1);
      this._play(`${what}:${k % 3}`, t + (Math.random() - 0.5) * 0.012, gain * arc, lp, 0, true);
      t += beat * (1 - 0.06 * u);
    }
  }

  // DE-FENSE (stomp stomp), five times, building then fading
  _chant(t0, gain, lp) {
    const arcs = [0.55, 0.85, 1, 0.95, 0.7];
    let t = t0, beat = 0.4;
    arcs.forEach((a) => {
      this._play('chant:de', t, gain * a, lp, 0, true);
      this._play('chant:fense', t + beat, gain * a, lp, 0, true);
      this._play('stomp:' + ((Math.random() * 2) | 0), t + beat * 2.1, gain * a * 0.9, lp, 0, true);
      this._play('stomp:' + ((Math.random() * 2) | 0), t + beat * 3, gain * a * 0.9, lp, 0, true);
      t += beat * 4;
      beat *= 0.985;
    });
  }

  /** Fade out and tear everything down (bed + reactions). */
  stop(fade = 0.8) {
    this._glow = 0;
    if (!this.ctx) return;
    this._kill(Math.max(0.01, fade));
  }

  /** Number of reaction voices playing (leak checks). */
  get activeReactions() { return this._rx ? this._rx.size : 0; }
  get playing() { return !!this._bed; }
}

export const crowd = new Crowd();
