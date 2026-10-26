// Every sound effect in HARD COUNT, synthesized. One-shots are rendered once
// (offline DSP in synthkit / vox) into cached AudioBuffers and replayed with a
// little random rate/gain so repeats never sound identical. Continuous effects
// (footsteps, rain, wind, venue ambience) are small node graphs, built lazily
// on the first non-zero call, smoothed every frame, and torn down after a few
// seconds at zero.
//
// API (everything is safe before audio.unlock(); calls before then are no-ops):
//   ui('move'|'select'|'back'|'tab'|'error'|'buy'|'unlock'), knob(), staticBurst(s), tvOn(), tvOff(), phone()
//   whistle('short'|'long'|'double')            referee's pea whistle (with the trill)
//   hit(strength 0..1, 'pads'|'helmet'|'ground'|'tackle')
//   catchBall('hands'|'body'|'bobble'), kickBall('kickoff'|'punt'|'fg'), snap()
//   cadence('set'|'hut'|'hard')                 the QB barking the count
//   ballBounce(strength)                         one bounce; call per ground contact
//   grunt(strength)                              a player's grunt / exhale on contact
//   pa('chime'|'horn'|'organ_charge'|'organ_defense'|'organ_letsgo')   stadium PA + organ
//   flagThrow(), chains()
//   footsteps(intensity 0..1)  rain(level)  wind(level)      loops: call every frame (or on change)
//   ambience('stadium'|'dome'|'park'|'bedroom'|null)          venue bed + acoustic (audio.setSpace)
//   stopAll()                                                 silence loops + bed (between screens)
//   prewarm()                                                 render every buffer now (loading screen)

import { audio } from './audio.js';
import {
  TAU, clamp, rng, hash, Biquad, modal, ping, burst, pinkGen, wanderGen,
  alloc, normalize, fadeEdges, loopify, toBuffer, setSmooth, rotStereo, krate,
  thump, nburst, modes, panInto,
} from './synthkit.js';
import { speak } from './vox.js';

// ===========================================================================
// One-shot renderers: (sr, R, variantIndex) → [Float32Array, …] (1–2 channels)
// ===========================================================================


// ---------------------------------------------------------------------------
// UI / TV (shared with the TV set this game inherits from MIDNIGHT FREQUENCY)

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

function rClick(o, sr, R, at, amp, modes) {
  const e = new Float32Array(o.length);
  burst(e, at * sr, 0.0009, 1, R, 0.00004, sr);
  const m = modal(e, new Float32Array(o.length), modes, sr);
  normalize([m], amp);
  for (let i = 0; i < o.length; i++) o[i] += m[i] + e[i] * amp * 0.25;
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

// ---------------------------------------------------------------------------
// building blocks

/** Stadium horn loudspeaker: band-limited, mid-forward, gently driven. */
function paVoice(chans, sr, drive = 1.8, hp = 260, lp = 6200) {
  normalize(chans, 1);
  for (const c of chans) {
    new Biquad('highpass', hp, 0.7, 0, sr).run(c);
    new Biquad('peaking', 1900, 0.9, 5, sr).run(c);
    new Biquad('lowpass', lp, 0.8, 0, sr).run(c);
    normalize([c], 1);
    const k = Math.tanh(drive);
    for (let i = 0; i < c.length; i++) c[i] = Math.tanh(drive * c[i]) / k;
  }
  return chans;
}

// ---------------------------------------------------------------------------
// the referee's pea whistle: a ~3 kHz jet tone, chopped by the spinning pea
// (fast AM + a little FM — the trill), pitch rising with breath pressure,
// breathy jet noise around the tone

function rWhistle(sr, R, kind) {
  const blasts = kind === 'long' ? [[0, 1.05 + R() * 0.2]]
    : kind === 'double' ? [[0, 0.16 + R() * 0.04], [0.28 + R() * 0.04, 0.22 + R() * 0.05]]
      : [[0, 0.28 + R() * 0.1]];
  const last = blasts[blasts.length - 1];
  const [L, Rt] = alloc(last[0] + last[1] + 0.15, sr, 2);
  const n = L.length;
  const f0 = 2700 + R() * 380;
  const mono = new Float32Array(n), jet = [new Float32Array(n), new Float32Array(n)];
  for (const [t0, d] of blasts) {
    const i0 = Math.round(t0 * sr), m = Math.round((d + 0.1) * sr);
    let ph = R() * TAU, tph = R() * TAU;
    const wander = wanderGen(R, 7, sr);
    const hard = kind === 'long' ? 0.9 : 1;
    for (let i = 0; i < m && i0 + i < n; i++) {
      const t = i / sr;
      const rise = 1 - Math.exp(-t / 0.011);
      const over = 1 + 0.15 * Math.exp(-t / 0.045) * rise;
      const sag = kind === 'long' ? 1 - 0.14 * Math.min(1, t / d) : 1;
      const rel = t < d ? 1 : Math.exp(-(t - d) / 0.016);
      const P = rise * over * sag * rel * hard;
      if (t > d && P < 1e-4) break;
      // the pea spins faster the harder you blow
      tph += (TAU * (22 + 14 * P) * (1 + 0.1 * wander())) / sr;
      const c = 0.5 + 0.5 * Math.cos(tph);
      const block = c * c * c;
      const f = f0 * (0.88 + 0.12 * Math.min(1.1, P)) * (1 - 0.05 * block);
      ph += (TAU * f) / sr;
      const tone = Math.sin(ph) + 0.17 * Math.sin(2 * ph + 0.5) + 0.04 * Math.sin(3 * ph + 1.1);
      mono[i0 + i] += tone * P * (1 - 0.6 * block);
      const jn = P * (0.55 + 0.45 * block);
      jet[0][i0 + i] += (R() * 2 - 1) * jn;
      jet[1][i0 + i] += (R() * 2 - 1) * jn;
    }
  }
  for (let c = 0; c < 2; c++) {
    const b = new Biquad('bandpass', f0, 6, 0, sr), b2 = new Biquad('bandpass', f0 * 0.5, 2, 0, sr), h = new Biquad('highpass', 5000, 0.7, 0, sr);
    const d = jet[c];
    for (let i = 0; i < n; i++) { const x = d[i]; d[i] = b.tick(x) * 0.4 + b2.tick(x) * 0.05 + h.tick(x) * 0.018; }
  }
  for (let i = 0; i < n; i++) { L[i] = mono[i] + jet[0][i]; Rt[i] = mono[i] + jet[1][i]; }
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.001, 0.02);
}

// ---------------------------------------------------------------------------
// contact

// shoulder pads: hard plastic shells under jerseys popping together over two
// bodies' low thump, a fabric smack, a rattle of equipment
function rPads(sr, R) {
  const [L, Rt] = alloc(0.55, sr, 2);
  const n = L.length, m = new Float32Array(n);
  const dt = 0.001 + R() * 0.005;
  thump(m, sr, 0, 150 + R() * 30, 72, 0.022, 0.065, 1);
  thump(m, sr, dt, 112 + R() * 25, 60, 0.03, 0.085, 0.75);
  nburst(m, sr, R, 0, 0.011, 0.7, [['bandpass', 850 + R() * 300, 0.8]]);
  nburst(m, sr, R, dt, 0.0045, 0.45, [['bandpass', 2300 + R() * 700, 1.1]]);
  modes(m, sr, R, 0.0008, [[430 + R() * 70, 0.02, 1], [760 + R() * 110, 0.016, 0.8], [1240 + R() * 160, 0.011, 0.55], [1980 + R() * 260, 0.007, 0.4]], 0.6);
  modes(m, sr, R, dt + 0.0005, [[520 + R() * 80, 0.016, 1], [910 + R() * 120, 0.012, 0.7], [1500 + R() * 200, 0.008, 0.45]], 0.4);
  for (let k = 0; k < 6; k++) modes(m, sr, R, 0.008 + R() * 0.08, [[1300 + R() * 2600, 0.003 + R() * 0.006, 1]], 0.04 + R() * 0.07);
  for (let c = 0; c < 2; c++) {
    const s = new Float32Array(n);
    nburst(s, sr, R, 0, 0.018, 0.14, [['bandpass', 1300, 0.6]]);
    const d = c ? Rt : L;
    for (let i = 0; i < n; i++) d[i] = m[i] + s[i];
  }
  for (const c of [L, Rt]) new Biquad('highpass', 45, 0.7, 0, sr).run(c);
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.0003, 0.05);
}

// helmet to helmet: two polycarbonate shells clack and ring briefly, steel
// facemasks tick, bodies thud underneath
function rHelmet(sr, R) {
  const [L, Rt] = alloc(0.6, sr, 2);
  const n = L.length;
  const shell = () => [690, 1210, 1880, 2640, 3520, 4700].map((f, k) => [f * (0.9 + 0.2 * R()), (0.012 + 0.05 * R()) * Math.pow(0.82, k), 1 / Math.sqrt(k + 1)]);
  const a = new Float32Array(n), b = new Float32Array(n), m = new Float32Array(n);
  modes(a, sr, R, 0, shell(), 1);
  modes(b, sr, R, 0.0012 + R() * 0.002, shell(), 0.85);
  nburst(m, sr, R, 0, 0.0012, 0.9, [['highpass', 1200, 0.7]]);
  nburst(m, sr, R, 0, 0.004, 0.45, [['bandpass', 1800, 0.8]]);
  modes(m, sr, R, 0.001, [[3000 + R() * 500, 0.04, 1], [5200 + R() * 600, 0.03, 0.6], [7400 + R() * 600, 0.02, 0.3]], 0.08);
  thump(m, sr, 0.002, 150, 85, 0.015, 0.035, 0.22);
  for (let i = 0; i < n; i++) {
    L[i] = m[i] + a[i] * 0.85 + b[i] * 0.45;
    Rt[i] = m[i] + a[i] * 0.45 + b[i] * 0.85;
  }
  for (const c of [L, Rt]) new Biquad('highpass', 50, 0.7, 0, sr).run(c);
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.0002, 0.05);
}

// bodies hitting the turf: heavy low whump (two bodies), crushed grass and dirt,
// pads clattering on landing
function rGround(sr, R) {
  const [L, Rt] = alloc(0.8, sr, 2);
  const n = L.length, m = new Float32Array(n);
  thump(m, sr, 0, 95 + R() * 15, 44, 0.04, 0.11, 1);
  const t2 = 0.03 + R() * 0.07;
  thump(m, sr, t2, 118 + R() * 15, 52, 0.03, 0.08, 0.55);
  modes(m, sr, R, 0.002, [[520 + R() * 80, 0.02, 1], [980 + R() * 120, 0.014, 0.6], [1700 + R() * 200, 0.009, 0.4]], 0.25);
  for (let k = 0; k < 5; k++) modes(m, sr, R, 0.03 + R() * 0.25, [[700 + R() * 1800, 0.003 + R() * 0.004, 1]], 0.03 + R() * 0.03);
  for (let c = 0; c < 2; c++) {
    const s = new Float32Array(n);
    nburst(s, sr, R, 0.004, 0.06, 0.26, [['lowpass', 1300, 0.6], ['lowpass', 1800, 0.7], ['highpass', 200, 0.7]], 0.004);
    nburst(s, sr, R, t2 + 0.01, 0.05, 0.15, [['lowpass', 1100, 0.6], ['lowpass', 1600, 0.7], ['highpass', 180, 0.7]], 0.006);
    const d = c ? Rt : L;
    for (let i = 0; i < n; i++) d[i] = m[i] + s[i];
  }
  for (const c of [L, Rt]) new Biquad('highpass', 32, 0.7, 0, sr).run(c);
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.0003, 0.06);
}

// a full tackle: the hit, then both bodies down on the turf, a slide
function rTackle(sr, R) {
  const [L, Rt] = alloc(1.3, sr, 2);
  const add = (src, at, g) => { const i0 = Math.round(at * sr); for (let i = 0; i < src[0].length && i0 + i < L.length; i++) { L[i0 + i] += src[0][i] * g; Rt[i0 + i] += src[1][i] * g; } };
  add(rPads(sr, R), 0, 1);
  const tg = 0.3 + R() * 0.16;
  add(rGround(sr, R), tg, 0.85);
  add(rGround(sr, R), tg + 0.05 + R() * 0.06, 0.45);
  for (let c = 0; c < 2; c++) nburst(c ? Rt : L, sr, R, tg + 0.06, 0.12, 0.13, [['lowpass', 1200, 0.6], ['lowpass', 1600, 0.7], ['highpass', 220, 0.7]], 0.03);
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.0003, 0.08);
}

// a player's grunt / exhale on contact
function rGrunt(sr, R, vi) {
  const sets = ['h:.03 A:.11 ?:.02 h:.05', 'A:.12 h:.06', 'h:.04 U:.09 f:.05', '?:.01 A:.08 h:.08', 'h:.05 o:.1 h:.04'];
  const f0 = 108 + R() * 40;
  const o = speak({
    sr, R, phones: sets[vi % sets.length], shout: 0.85, breath: 0.3, tilt: 3200, len: 0.36, formantJit: 20,
    voices: [{ f0: [[0, f0 * 1.18], [0.07, f0], [0.25, f0 * 0.78]], jit: 0.035, vib: [6, 0] }],
  });
  normalize([o], 0.8);
  return fadeEdges([o], sr, 0.002, 0.04);
}

// ---------------------------------------------------------------------------
// the ball

function rCatch(sr, R, kind) {
  if (kind === 'bobble') {
    const [L, Rt] = alloc(0.65, sr, 2);
    const add = (src, at, g) => { const i0 = Math.round(at * sr); for (let i = 0; i < src[0].length && i0 + i < L.length; i++) { L[i0 + i] += src[0][i] * g; Rt[i0 + i] += src[1][i] * g; } };
    add(rCatch(sr, R, 'hands'), 0, 0.7);
    add(rCatch(sr, R, 'tip'), 0.09 + R() * 0.05, 0.5);
    add(rCatch(sr, R, 'tip'), 0.17 + R() * 0.05, 0.35);
    add(rCatch(sr, R, R() < 0.5 ? 'hands' : 'body'), 0.27 + R() * 0.08, 0.95);
    normalize([L, Rt], 0.85);
    return fadeEdges([L, Rt], sr, 0.0003, 0.04);
  }
  const [L, Rt] = alloc(0.32, sr, 2);
  const n = L.length, m = new Float32Array(n);
  if (kind === 'hands') {
    nburst(m, sr, R, 0, 0.006, 1, [['bandpass', 1400 + R() * 400, 0.9]]); // leather on gloves
    nburst(m, sr, R, 0, 0.0022, 0.35, [['highpass', 3500, 0.7]]); // tacky glove snap
    modes(m, sr, R, 0.0005, [[400 + R() * 60, 0.03, 1], [960 + R() * 80, 0.012, 0.45], [1650 + R() * 120, 0.006, 0.25]], 0.55); // hollow ball
    thump(m, sr, 0, 230, 150, 0.01, 0.025, 0.25);
  } else if (kind === 'tip') {
    nburst(m, sr, R, 0, 0.003, 0.7, [['bandpass', 1900 + R() * 400, 1]]);
    modes(m, sr, R, 0.0003, [[430 + R() * 60, 0.02, 1], [1020 + R() * 80, 0.008, 0.4]], 0.45);
  } else { // into the chest
    thump(m, sr, 0, 170 + R() * 20, 105, 0.02, 0.05, 0.9);
    nburst(m, sr, R, 0, 0.014, 0.5, [['lowpass', 1300, 0.7]]);
    modes(m, sr, R, 0.001, [[360 + R() * 40, 0.025, 1], [620 + R() * 50, 0.015, 0.5]], 0.35);
    modes(m, sr, R, 0.002, [[700 + R() * 80, 0.012, 1], [1250 + R() * 120, 0.009, 0.6]], 0.2); // pads
  }
  for (let c = 0; c < 2; c++) {
    const d = c ? Rt : L;
    for (let i = 0; i < n; i++) d[i] = m[i];
    nburst(d, sr, R, 0, 0.004, 0.06, [['highpass', 2000, 0.7]]);
  }
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.0002, 0.03);
}

// boot on leather: a crack, the ball's compressed-air "thwock", leg thump,
// then the whoosh of the ball leaving (punts wobble)
function rKick(sr, R, kind) {
  const [L, Rt] = alloc(1.5, sr, 2);
  const n = L.length, m = new Float32Array(n);
  const bf = kind === 'punt' ? 255 + R() * 30 : 192 + R() * 25;
  nburst(m, sr, R, 0, 0.0016, 0.9, [['highpass', 900, 0.7]]);
  nburst(m, sr, R, 0, 0.006, 0.6, [['bandpass', 2100, 1]]);
  modes(m, sr, R, 0.0003, [[bf, 0.034, 1], [bf * 2.35, 0.014, 0.42], [bf * 4.1, 0.006, 0.2]], 0.9);
  thump(m, sr, 0, kind === 'punt' ? 150 : 128, 70, 0.02, 0.05, kind === 'punt' ? 0.4 : 0.7);
  const W = [new Float32Array(n), new Float32Array(n)];
  const life = kind === 'punt' ? 0.3 : kind === 'fg' ? 0.22 : 0.26;
  for (let c = 0; c < 2; c++) {
    const bp = new Biquad('bandpass', 1500, 1.5, 0, sr), lp = new Biquad('lowpass', 2200, 0.7, 0, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr - 0.008;
      if (t < 0) continue;
      if ((i & 31) === 0) bp.set('bandpass', 380 + 1300 * Math.exp(-t / 0.22), 1.5, 0, sr);
      const env = Math.min(1, t / 0.035) * Math.exp(-t / life);
      if (env < 1e-4 && t > 0.1) break;
      const flut = kind === 'punt' ? 0.72 + 0.28 * Math.sin(TAU * 8.5 * t) : 0.9 + 0.1 * Math.sin(TAU * 13 * t);
      W[c][i] = lp.tick(bp.tick(R() * 2 - 1)) * env * flut;
    }
  }
  normalize(W, kind === 'punt' ? 0.34 : 0.28);
  for (let i = 0; i < n; i++) {
    const t = i / sr, p = Math.min(1, t / 0.6) * 0.5; // drifts off to one side as it leaves
    L[i] = m[i] + W[0][i] * (1 - p);
    Rt[i] = m[i] + W[1][i] * (1 + p * 0.6);
  }
  normalize([L, Rt], 0.9);
  return fadeEdges([L, Rt], sr, 0.0002, 0.06);
}

// the snap: ball slapped up into the QB's hands, then the line fires off
function rSnap(sr, R) {
  const [L, Rt] = alloc(0.7, sr, 2);
  const n = L.length, m = new Float32Array(n);
  nburst(m, sr, R, 0, 0.004, 0.85, [['bandpass', 1700, 0.9]]);
  modes(m, sr, R, 0.0005, [[420 + R() * 40, 0.02, 1], [990 + R() * 60, 0.008, 0.4]], 0.45);
  for (let i = 0; i < n; i++) { L[i] = m[i]; Rt[i] = m[i]; }
  for (let k = 0; k < 10; k++) {
    const t = 0.06 + Math.pow(R(), 1.4) * 0.32;
    const p = new Float32Array(Math.round(0.2 * sr));
    const a = 0.25 + 0.3 * R();
    thump(p, sr, 0, 140 + R() * 40, 80, 0.015, 0.035, a);
    modes(p, sr, R, 0.0005, [[480 + R() * 300, 0.012, 1], [1100 + R() * 500, 0.008, 0.5]], a * 0.5);
    nburst(p, sr, R, 0.002, 0.018, a * 0.35, [['bandpass', 2400 + R() * 1200, 0.9]]);
    panInto(L, Rt, p, R() * 1.6 - 0.8, 0.7, t * sr);
  }
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.0002, 0.05);
}

// the QB barking the count through his facemask
function rCadence(sr, R, kind, vi) {
  const base = 176 + vi * 9 + R() * 8;
  let phones, f0, shout = 0.9, jit = 0.014, vib = 8, len;
  if (kind === 'set') {
    phones = 's:.1 e:.17 t:.075';
    f0 = [[0, base * 1.02], [0.15, base * 1.13], [0.32, base * 0.86]];
    len = 0.5;
  } else if (kind === 'hut') {
    phones = 'h:.05 A:.16 t:.075';
    f0 = [[0, base], [0.08, base * 1.15], [0.26, base * 0.85]];
    len = 0.45;
  } else { // the hard count: a long, strained, rising HUUUT!
    phones = 'h:.06 A:.34 t:.08';
    f0 = [[0, base * 1.05], [0.14, base * 1.45], [0.42, base * 1.12]];
    shout = 1; jit = 0.028; vib = 22; len = 0.65;
  }
  const o = speak({ sr, R, phones, voices: [{ f0, jit, vib: [5.5, vib] }], shout, breath: 0.12, formantJit: 12, len });
  new Biquad('lowpass', 7200, 0.7, 0, sr).run(o);
  new Biquad('highpass', 110, 0.7, 0, sr).run(o);
  normalize([o], 0.9);
  return fadeEdges([o], sr, 0.001, 0.04);
}

// the funny football bounce: a hollow "boink" from the air inside, leather
// slap, turf; end-over-end variants hit twice (point, then belly)
function rBounce(sr, R, vi) {
  const [o] = alloc(0.4, sr);
  const point = vi % 2 === 0;
  const f = point ? 330 + R() * 60 : 205 + R() * 40;
  const hit = (at, a, ff) => {
    thump(o, sr, at, ff * 1.4, ff, 0.006, 0.03, a);
    modes(o, sr, R, at, [[ff * 2.9, 0.012, 1], [ff * 5.2, 0.005, 0.5]], a * 0.3);
    nburst(o, sr, R, at, 0.004, a * 0.3, [['bandpass', 1300, 0.8]]);
    nburst(o, sr, R, at, 0.012, a * 0.22, [['lowpass', 1500, 0.7]]);
  };
  hit(0, 1, f);
  if (vi >= 2) hit(0.02 + R() * 0.025, 0.6, f * (point ? 0.68 : 1.45));
  normalize([o], 0.85);
  return fadeEdges([o], sr, 0.0002, 0.03);
}

// penalty flag: the weighted cloth spins through the air, then plops on the turf
function rFlag(sr, R) {
  const [L, Rt] = alloc(0.85, sr, 2);
  const n = L.length;
  const land = 0.4 + R() * 0.08;
  for (let c = 0; c < 2; c++) {
    const d = c ? Rt : L;
    const bp = new Biquad('bandpass', 700, 0.9, 0, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if ((i & 31) === 0) bp.set('bandpass', 650 + 600 * Math.sin(Math.PI * Math.min(1, t / land)), 0.9, 0, sr);
      const x = (t - 0.12) / (t < 0.12 ? 0.06 : 0.12);
      const env = Math.exp(-x * x) * (0.7 + 0.3 * Math.sin(TAU * 21 * t));
      d[i] = bp.tick(R() * 2 - 1) * env;
    }
  }
  normalize([L, Rt], 0.45);
  const m = new Float32Array(n);
  thump(m, sr, land, 150, 95, 0.01, 0.025, 0.7);
  nburst(m, sr, R, land, 0.012, 0.4, [['lowpass', 1400, 0.7]]);
  for (let i = 0; i < n; i++) { L[i] += m[i]; Rt[i] += m[i]; }
  normalize([L, Rt], 0.8);
  return fadeEdges([L, Rt], sr, 0.003, 0.04);
}

// the chain crew: links rattle as the chain is dragged, snap taut, the stick goes in
function rChains(sr, R) {
  const [L, Rt] = alloc(1.1, sr, 2);
  let t = 0.01;
  while (t < 0.66) {
    t += 0.004 + Math.pow(R(), 2) * 0.03;
    const a = (0.15 + 0.5 * R()) * (t < 0.5 ? 1 : 0.6);
    const near = R() < 0.5;
    for (let k = 0; k < 2; k++) {
      const f = 2300 + R() * 5400, d = 0.003 + R() * 0.011, ph = R() * TAU;
      ping(near ? L : Rt, t * sr, f, d, a * (k ? 0.5 : 1), sr, ph);
      ping(near ? Rt : L, (t + 0.0004) * sr, f, d, a * (k ? 0.25 : 0.5), sr, ph);
    }
  }
  const taut = 0.7 + R() * 0.02;
  for (let k = 0; k < 9; k++) {
    const f = 2800 + R() * 4500, d = 0.006 + R() * 0.02;
    ping(L, (taut + R() * 0.008) * sr, f, d, 0.35, sr, R() * TAU);
    ping(Rt, (taut + R() * 0.008) * sr, f * 1.01, d, 0.35, sr, R() * TAU);
  }
  const m = new Float32Array(L.length);
  thump(m, sr, taut + 0.07, 210, 160, 0.01, 0.03, 0.5);
  ping(m, (taut + 0.07) * sr, 880 + R() * 120, 0.07, 0.12, sr);
  for (let i = 0; i < L.length; i++) { L[i] += m[i]; Rt[i] += m[i]; }
  normalize([L, Rt], 0.8);
  return fadeEdges([L, Rt], sr, 0.0005, 0.05);
}

// ---------------------------------------------------------------------------
// stadium PA: attention chime, air horn, the organ riffs

function rChime(sr, R) {
  const [L, Rt] = alloc(2.8, sr, 2);
  const notes = [[0, 783.99], [0.3, 1046.5], [0.6, 1318.5]];
  const P = [[1, 1, 1], [2.0, 0.35, 0.6], [2.76, 0.25, 0.4], [4.07, 0.12, 0.25], [5.4, 0.06, 0.15]];
  for (const [t, f] of notes) {
    for (const [r, a, d] of P) {
      ping(L, t * sr, f * r, 1.15 * d, a * 0.4, sr, R() * TAU);
      ping(Rt, t * sr, f * r * 1.0015, 1.15 * d, a * 0.4, sr, R() * TAU);
    }
  }
  paVoice([L, Rt], sr, 1.4, 300, 6500);
  normalize([L, Rt], 0.8);
  return fadeEdges([L, Rt], sr, 0.001, 0.1);
}

// the stadium's air horn: three brassy reeds, a pressure build at the start
function rAirHorn(sr, R) {
  const dur = 1.75;
  const [L, Rt] = alloc(dur + 0.25, sr, 2);
  const freqs = [277.2, 349.2, 415.3];
  for (let c = 0; c < 2; c++) {
    const d = c ? Rt : L;
    const phs = freqs.map(() => R() * TAU);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const sag = 1 - 0.07 * Math.exp(-t / 0.07);
      const vib = 1 + 0.003 * Math.sin(TAU * 5.5 * t + c);
      let v = 0;
      freqs.forEach((f, k) => {
        phs[k] += (TAU * f * sag * vib * (c ? 1.0012 : 1)) / sr;
        v += Math.tanh(3.4 * Math.sin(phs[k]));
      });
      const env = Math.min(1, t / 0.05) * (t < dur ? 1 - 0.08 * (t / dur) : Math.exp(-(t - dur) / 0.06));
      d[i] = v * env;
    }
    new Biquad('peaking', 1500, 1, 6, sr).run(d);
    new Biquad('lowpass', 5200, 0.7, 0, sr).run(d);
    new Biquad('highpass', 160, 0.7, 0, sr).run(d);
  }
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.002, 0.05);
}

// stadium organ: tonewheel drawbars (16' 8' 5⅓' 4' 2⅔' 2' 1⅗' 1⅓' 1'), key
// click, a fast Leslie, through the PA
const DRAW = [[0.5, 0.55], [1, 1], [1.5, 0.45], [2, 0.8], [3, 0.35], [4, 0.55], [5, 0.16], [6, 0.24], [8, 0.38]];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function organRiff(sr, R, notes, total) {
  const n = Math.ceil(total * sr);
  const dry = new Float32Array(n);
  for (const [t, midi, d, v = 1] of notes) {
    const f = mtof(midi);
    const i0 = Math.round(t * sr), len = Math.round((d + 0.06) * sr);
    for (const [h, a] of DRAW) {
      let fh = f * h;
      while (fh > sr * 0.4) fh /= 2; // foldback
      const w = (TAU * fh) / sr;
      let ph = R() * TAU;
      for (let i = 0; i < len && i0 + i < n; i++) {
        const tt = i / sr;
        const env = Math.min(1, tt / 0.004) * (tt < d ? 1 : Math.exp(-(tt - d) / 0.022));
        dry[i0 + i] += Math.sin(ph) * a * env * v;
        ph += w;
      }
    }
    nburst(dry, sr, R, t, 0.002, 0.35 * v, [['bandpass', 2600, 0.6]]);
  }
  // Leslie: horn rotor doppler (modulated delay) + amplitude, quadrature L/R
  const L = new Float32Array(n), Rt = new Float32Array(n);
  const rate = 6.4;
  for (let i = 0; i < n; i++) {
    const ph = (TAU * rate * i) / sr;
    for (let c = 0; c < 2; c++) {
      const md = Math.sin(ph + c * 1.7);
      const dl = (0.0012 + 0.0006 * md) * sr;
      const x = i - dl, x0 = Math.floor(x);
      const s = x0 >= 0 ? dry[x0] + (dry[x0 + 1] - dry[x0]) * (x - x0) : 0;
      (c ? Rt : L)[i] = s * (0.78 + 0.22 * Math.cos(ph + c * 1.7)) + dry[i] * 0.35;
    }
  }
  paVoice([L, Rt], sr, 1.5, 120, 7000);
  normalize([L, Rt], 0.85);
  return fadeEdges([L, Rt], sr, 0.002, 0.1);
}

// CHARGE!: the old cavalry bugle call — G C E G, E G (crowd yells "CHARGE!")
function rOrganCharge(sr, R) {
  const e = 0.16;
  const mel = [[0, 67, e * 0.8], [e, 72, e * 0.8], [2 * e, 76, e * 0.8], [3 * e, 79, e * 2.6], [6 * e, 76, e * 0.8], [7 * e, 79, e * 6]];
  const notes = [];
  for (const [t, m, d] of mel) { notes.push([t, m, d, 0.9], [t, m - 12, d, 0.6]); }
  for (const m of [48, 60, 64, 67]) notes.push([7 * e, m, e * 6, m === 48 ? 0.8 : 0.45]);
  notes.push([3 * e, 48, e * 2.6, 0.7], [3 * e, 64, e * 2.6, 0.4]);
  return organRiff(sr, R, notes, 7 * e + e * 6 + 0.5);
}

// DE-FENSE: two stomping low stabs, then the chant's two notes, twice
function rOrganDefense(sr, R) {
  const q = 0.38, notes = [];
  for (let k = 0; k < 2; k++) {
    const t0 = k * q * 4;
    notes.push([t0, 36, q * 0.3, 0.9], [t0, 48, q * 0.3, 0.7], [t0 + q * 0.5, 36, q * 0.3, 0.9], [t0 + q * 0.5, 48, q * 0.3, 0.7]);
    notes.push([t0 + q * 1.5, 64, q * 0.8, 0.9], [t0 + q * 1.5, 67, q * 0.8, 0.6], [t0 + q * 1.5, 52, q * 0.8, 0.6]);
    notes.push([t0 + q * 2.5, 60, q * 1.2, 0.9], [t0 + q * 2.5, 64, q * 1.2, 0.6], [t0 + q * 2.5, 48, q * 1.2, 0.7]);
  }
  return organRiff(sr, R, notes, q * 8 + 0.5);
}

// LET'S GO (clap clap clap), twice, the second a step higher, then a held chord
function rOrganLetsGo(sr, R) {
  const e = 0.17, notes = [];
  [0, 2].forEach((tr, k) => {
    const t0 = k * e * 8;
    notes.push([t0, 67 + tr, e * 0.8, 0.85], [t0 + e, 72 + tr, e * 0.8, 0.9]);
    for (const j of [3, 4, 5]) for (const m of [72, 76, 79]) notes.push([t0 + j * e, m + tr, e * 0.55, j === 5 ? 0.85 : 0.65]);
    notes.push([t0 + 3 * e, 48 + tr, e * 2.6, 0.7]);
  });
  const tEnd = e * 16;
  for (const m of [50, 62, 66, 69, 74]) notes.push([tEnd, m, e * 4, 0.55]);
  return organRiff(sr, R, notes, tEnd + e * 4 + 0.5);
}

// ---------------------------------------------------------------------------
// loops

// cleats on turf: `players` runners at their own cadence, distance and side
function rSteps(sr, R, players) {
  const secs = 4, F = 0.12;
  const ch = alloc(secs + F, sr, 2);
  const n = ch[0].length;
  for (let p = 0; p < players; p++) {
    const rate = 2.7 + R() * 0.9;
    const pan = R() * 1.7 - 0.85, dist = 0.3 + 0.7 * R();
    const m = new Float32Array(n);
    let t = R() / rate, k = 0;
    while (t < secs + F - 0.06) {
      const a = (0.6 + 0.4 * R()) * dist;
      thump(m, sr, t, 105 + R() * 25, 65, 0.01, 0.022, a * 0.7);
      nburst(m, sr, R, t + 0.002, 0.008 + R() * 0.014, a * 0.42, [['bandpass', 1700 + R() * 1700, 0.9]]);
      if (k % 2 === 0) modes(m, sr, R, t + 0.004, [[900 + R() * 300, 0.01, 1], [1700 + R() * 300, 0.006, 0.5]], 0.1 * a);
      t += (1 / rate) * (0.93 + 0.14 * R());
      k++;
    }
    new Biquad('lowpass', 2200 + 6000 * dist, 0.7, 0, sr).run(m);
    panInto(ch[0], ch[1], m, pan, 1);
  }
  return normalize(loopify(ch, sr, F), 0.9);
}

// ---------------------------------------------------------------------------
// venue ambience events

function rTrainHorn(sr, R) {
  const [o] = alloc(4.2, sr);
  const fr = [311, 370, 466];
  const phs = fr.map(() => R() * TAU);
  const blasts = [[0, 1.5], [1.75, 2.0]];
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    let env = 0;
    for (const [a, d] of blasts) if (t > a) env = Math.max(env, Math.min(1, (t - a) / 0.15) * (t < a + d ? 1 : Math.exp(-(t - a - d) / 0.25)));
    let v = 0;
    fr.forEach((f, k) => { phs[k] += (TAU * f) / sr; v += Math.tanh(2.2 * Math.sin(phs[k])); });
    o[i] = v * env;
  }
  new Biquad('lowpass', 1400, 0.7, 0, sr).run(o);
  new Biquad('lowpass', 2000, 0.7, 0, sr).run(o);
  return [normalize(fadeEdges([o], sr, 0.01, 0.2), 0.9)[0]];
}

function rCarHorn(sr, R) {
  const [o] = alloc(0.6, sr);
  const freqs = [415, 523], phs = freqs.map(() => R() * TAU);
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    let v = 0;
    freqs.forEach((f, k) => { phs[k] += (TAU * f) / sr; v += Math.tanh(3.2 * Math.sin(phs[k])); });
    o[i] = v * Math.min(1, t / 0.012) * Math.min(1, Math.max(0, (0.5 - t) / 0.04));
  }
  new Biquad('peaking', 2200, 1.2, 6, sr).run(o);
  new Biquad('lowpass', 3000, 0.7, 0, sr).run(o);
  return [normalize(fadeEdges([o], sr, 0.002, 0.02), 0.8)[0]];
}

function rClank(sr, R) {
  const [o] = alloc(1.4, sr);
  modes(o, sr, R, 0, [[180 + R() * 60, 0.4, 1], [496 + R() * 80, 0.25, 0.6], [930 + R() * 120, 0.15, 0.45], [1540 + R() * 200, 0.09, 0.3]], 0.9, 0.001);
  modes(o, sr, R, 0.12 + R() * 0.1, [[210 + R() * 60, 0.3, 1], [560, 0.2, 0.5]], 0.4, 0.001);
  new Biquad('lowpass', 2500, 0.7, 0, sr).run(o);
  return [normalize(fadeEdges([o], sr, 0.001, 0.2), 0.85)[0]];
}

function rBird(sr, R) {
  const [o] = alloc(0.9, sr);
  const notes = 2 + Math.floor(R() * 4);
  let t = 0;
  for (let k = 0; k < notes; k++) {
    const d = 0.05 + R() * 0.09, f0 = 2600 + R() * 2400, f1 = f0 * (0.6 + R() * 0.9);
    let ph = 0;
    for (let i = 0; i < d * sr; i++) {
      const u = i / (d * sr);
      ph += (TAU * (f0 + (f1 - f0) * u + 300 * Math.sin(TAU * 35 * i / sr))) / sr;
      o[Math.round(t * sr) + i] += Math.sin(ph) * Math.sin(Math.PI * u) * (0.6 + 0.4 * R());
    }
    t += d + 0.03 + R() * 0.08;
    if (t > 0.8) break;
  }
  return [normalize(fadeEdges([o], sr, 0.002, 0.02), 0.7)[0]];
}

function rDog(sr, R, vi) {
  const o = new Float32Array(Math.ceil(1.1 * sr));
  const barks = vi ? 2 : 3;
  for (let k = 0; k < barks; k++) {
    const f0 = 380 + R() * 140;
    speak({
      sr, R, out: o, at: k * (0.24 + R() * 0.1), phones: 'w:.02 a:.07 f:.03', shout: 1, breath: 0.4, scale: 1.25, formantJit: 40,
      voices: [{ f0: [[0, f0 * 0.9], [0.04, f0 * 1.2], [0.12, f0 * 0.8]], jit: 0.08 }],
    });
  }
  new Biquad('lowpass', 2800, 0.7, 0, sr).run(o);
  return [normalize(fadeEdges([o], sr, 0.002, 0.05), 0.8)[0]];
}

function rCarPass(sr, R) {
  const dur = 5;
  const [L, Rt] = alloc(dur, sr, 2);
  const lp = [new Biquad('lowpass', 500, 0.7, 0, sr), new Biquad('lowpass', 500, 0.7, 0, sr)];
  const pk = [pinkGen(R), pinkGen(R)];
  const tc = 2.2 + R() * 0.6, dir = R() < 0.5 ? 1 : -1;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const x = (t - tc) / 1.1;
    const env = 1 / (1 + x * x * 2.5);
    if ((i & 63) === 0) for (const f of lp) f.set('lowpass', 250 + 900 * env, 0.7, 0, sr);
    const p = clamp(0.5 + x * 0.3 * dir, 0, 1);
    L[i] = lp[0].tick(pk[0]()) * env * Math.cos(p * Math.PI / 2);
    Rt[i] = lp[1].tick(pk[1]()) * env * Math.sin(p * Math.PI / 2);
  }
  normalize([L, Rt], 0.8);
  return fadeEdges([L, Rt], sr, 0.05, 0.2);
}



// name → [variants, renderer, sample-rate divisor for band-limited material]
const SHOTS = {
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
  crackle: [1, rCrackle],
  'whistle:short': [3, (sr, R) => rWhistle(sr, R, 'short')],
  'whistle:long': [2, (sr, R) => rWhistle(sr, R, 'long')],
  'whistle:double': [2, (sr, R) => rWhistle(sr, R, 'double')],
  'hit:pads': [4, rPads],
  'hit:helmet': [3, rHelmet],
  'hit:ground': [3, rGround],
  'hit:tackle': [3, rTackle],
  grunt: [5, rGrunt, 2],
  'catch:hands': [3, (sr, R) => rCatch(sr, R, 'hands')],
  'catch:body': [2, (sr, R) => rCatch(sr, R, 'body')],
  'catch:bobble': [2, (sr, R) => rCatch(sr, R, 'bobble')],
  'kick:kickoff': [2, (sr, R) => rKick(sr, R, 'kickoff')],
  'kick:punt': [2, (sr, R) => rKick(sr, R, 'punt')],
  'kick:fg': [2, (sr, R) => rKick(sr, R, 'fg')],
  snap: [3, rSnap],
  'cadence:set': [2, (sr, R, i) => rCadence(sr, R, 'set', i)],
  'cadence:hut': [3, (sr, R, i) => rCadence(sr, R, 'hut', i)],
  'cadence:hard': [2, (sr, R, i) => rCadence(sr, R, 'hard', i)],
  bounce: [4, rBounce],
  flag: [2, rFlag],
  chains: [2, rChains],
  'pa:chime': [1, rChime, 2],
  'pa:horn': [1, rAirHorn, 2],
  'pa:organ_charge': [1, rOrganCharge, 2],
  'pa:organ_defense': [1, rOrganDefense, 2],
  'pa:organ_letsgo': [1, rOrganLetsGo, 2],
  'steps:few': [1, (sr, R) => rSteps(sr, R, 4), 2],
  'steps:many': [1, (sr, R) => rSteps(sr, R, 14), 2],
  rain: [1, rRain, 2],
  trainHorn: [1, rTrainHorn, 4],
  carHorn: [1, rCarHorn, 2],
  siren: [1, rSiren, 4],
  clank: [2, rClank, 2],
  bird: [3, rBird, 2],
  dog: [2, rDog, 2],
  carPass: [2, rCarPass, 4],
};

// warm-up order: menu sounds first, then the game essentials, then beds
const WARM_ORDER = [
  'ui:move', 'ui:select', 'ui:back', 'ui:tab', 'knob', 'crackle', 'ui:error', 'tvOn', 'tvOff', 'phone', 'ui:buy', 'ui:unlock',
  'whistle:short', 'cadence:hut', 'cadence:set', 'snap', 'hit:pads', 'hit:tackle', 'hit:ground', 'hit:helmet', 'grunt',
  'catch:hands', 'catch:body', 'catch:bobble', 'whistle:long', 'whistle:double', 'cadence:hard', 'bounce',
  'kick:kickoff', 'kick:punt', 'kick:fg', 'steps:few', 'steps:many', 'flag', 'chains',
  'pa:chime', 'pa:horn', 'pa:organ_charge', 'pa:organ_defense', 'pa:organ_letsgo',
  'rain', 'bird', 'carHorn', 'siren', 'trainHorn', 'clank', 'dog', 'carPass',
];

const HIT_KINDS = ['pads', 'helmet', 'ground', 'tackle'];

// venue beds: level, acoustic, rare events [name, minGap, maxGap, gain, wet]
const BEDS = {
  stadium: { level: 0.2, space: 'stadium', events: [['trainHorn', 70, 160, 0.05, 1.3], ['carHorn', 25, 70, 0.018, 0.9], ['siren', 60, 150, 0.025, 1]] },
  dome: { level: 0.22, space: 'dome', events: [['clank', 18, 50, 0.035, 1.4]] },
  park: { level: 0.22, space: 'park', events: [['bird', 2.5, 8, 0.045, 0.4], ['dog', 25, 70, 0.035, 0.8], ['siren', 50, 120, 0.03, 0.9], ['carHorn', 20, 55, 0.022, 0.7]] },
  bedroom: { level: 0.12, space: 'bedroom', events: [['carPass', 16, 45, 0.06, 0.3], ['dog', 40, 100, 0.012, 0.4]] },
};

// ===========================================================================

class Sfx {
  static WARM = WARM_ORDER;

  constructor() {
    this._ctx = null;
    this._loops = {};
    this._bed = null;
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
    this._live = 0;
    this._last = {};
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
    // never the same variant twice in a row
    let i = (Math.random() * v.length) | 0;
    const k = this._last[name];
    if (v.length > 1 && i === k) i = (i + 1) % v.length;
    this._last[name] = i;
    return v[i];
  }

  /** Fire-and-forget buffer playback; every node is released when it ends. */
  _play(name, { bus = audio.sfxBus, gain = 1, rate = 1, pan = 0, rev = 0, space = 0, lp = 0, hp = 0, when = 0 } = {}) {
    const ctx = this._ctx;
    const s = ctx.createBufferSource();
    s.buffer = typeof name === 'string' ? this._pick(name) : name;
    s.playbackRate.value = rate;
    const nodes = [s];
    let node = s;
    for (const [type, f] of [['lowpass', lp], ['highpass', hp]]) {
      if (!f) continue;
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      node = node.connect(b);
      nodes.push(b);
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
    for (const [amt, dest] of [[rev, audio.reverbSend], [space, audio.space]]) {
      if (!amt) continue;
      const r = ctx.createGain();
      r.gain.value = amt;
      node.connect(r).connect(dest);
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

  /** Cleats on turf. intensity 0..1 ≈ how many players are running (0 = none, 1 = all 14 sprinting). */
  footsteps(intensity = 0) {
    if (!this._ok()) return;
    const a = clamp(+intensity || 0, 0, 1);
    let L = this._loops.steps;
    if (!L) {
      if (a < 0.002) return;
      L = this._loop('steps', audio.sfxBus, (L) => {
        L.lp = L.filt('lowpass', 5000, 0.6);
        L.lp.connect(L.out);
        L.few = L.src(this._get('steps:few')[0]);
        L.gFew = L.gain();
        L.few.connect(L.gFew).connect(L.lp);
        L.many = L.src(this._get('steps:many')[0]);
        L.gMany = L.gain();
        L.many.connect(L.gMany).connect(L.lp);
      });
    }
    const dense = clamp((a - 0.2) / 0.5, 0, 1);
    const lvl = 0.34 * Math.pow(a, 0.6);
    this._set(L, 0, L.gFew.gain, lvl * Math.cos(dense * Math.PI / 2), 0.12);
    this._set(L, 1, L.gMany.gain, lvl * Math.sin(dense * Math.PI / 2), 0.12);
    const rate = 0.9 + 0.2 * a;
    this._set(L, 2, L.few.playbackRate, rate, 0.2, 0.01);
    this._set(L, 3, L.many.playbackRate, rate, 0.2, 0.01);
    this._set(L, 4, L.lp.frequency, 2800 + 5200 * a, 0.2, 0.02);
    this._idle(L, a > 0.002);
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
        // heavy rain: the roar of it on the stands and the turf
        L.gRoar = L.gain();
        L.noise('pink').connect(L.filt('lowpass', 900, 0.5)).connect(L.gRoar).connect(L.out);
      });
    }
    this._set(L, 0, L.g.gain, Math.pow(a, 0.8) * 0.3, 0.15);
    this._set(L, 1, L.lp.frequency, 2500 + 8500 * a, 0.2, 0.02);
    this._set(L, 2, L.gRoar.gain, a * a * 0.12, 0.3);
    this._idle(L, a > 0.002);
  }

  /** Gusting wind. level 0..1 (calm → a gale whistling through the stands). */
  wind(level = 0) {
    if (!this._ok()) return;
    const a = clamp(+level || 0, 0, 1);
    let L = this._loops.wind;
    if (!L) {
      if (a < 0.002) return;
      L = this._loop('wind', audio.sfxBus, (L) => {
        L.bp = L.filt('bandpass', 400, 0.55);
        L.gust = L.gain(0.75);
        L.g = L.gain();
        L.noise('pink').connect(L.bp).connect(L.gust).connect(L.g).connect(L.out);
        L.osc('sine', 0.11).connect(L.gain(0.18)).connect(L.gust.gain);
        L.osc('sine', 0.29).connect(L.gain(0.09)).connect(L.gust.gain);
        L.osc('sine', 0.07).connect(L.gain(90)).connect(L.bp.frequency);
        // whistling through the stands and the goalposts
        L.wb = L.filt('bandpass', 1300, 9);
        L.gW = L.gain();
        L.noise('white').connect(L.wb).connect(L.gW).connect(L.gust);
        L.osc('sine', 0.05).connect(L.gain(220)).connect(L.wb.frequency);
        // low buffeting on the mics
        L.gLo = L.gain();
        L.noise('brown').connect(L.filt('lowpass', 140, 0.7)).connect(L.gLo).connect(L.gust);
      });
    }
    this._set(L, 0, L.g.gain, 0.26 * Math.pow(a, 1.1), 0.15);
    this._set(L, 1, L.bp.frequency, 300 + 500 * a, 0.3, 0.01);
    this._set(L, 2, L.gW.gain, 0.5 * a * a, 0.3);
    this._set(L, 3, L.gLo.gain, 0.9 * a * a, 0.3);
    this._idle(L, a > 0.002);
  }

  /** Venue bed + acoustic: 'stadium' | 'dome' | 'park' | 'bedroom' | null. */
  ambience(env) {
    const name = BEDS[env] ? env : null;
    if (name) audio.setSpace(BEDS[name].space); // remembered before unlock
    if (!this._ok()) return;
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
    const osc = (f, type = 'sine') => { const o = krate(mk(ctx.createOscillator())); o.type = type; o.frequency.value = f; o.start(); B.srcs.push(o); return o; };
    B.out = gain(0);
    B.out.connect(audio.sfxBus);
    B.wet = gain(0); // event echo follows the bed fade
    B.wet.connect(audio.space);
    B.ev = gain(1);
    B.ev.connect(B.out);
    const t = ctx.currentTime;
    switch (name) {
      case 'stadium': {
        // the town around the stadium, and the light towers' ballast hum
        src(audio.noise('brown')).connect(filt('lowpass', 220)).connect(gain(0.6)).connect(B.out);
        const am = gain(0.8);
        osc(0.13).connect(gain(0.2)).connect(am.gain);
        src(audio.noise('pink')).connect(filt('bandpass', 600, 0.5)).connect(am).connect(gain(0.22)).connect(B.out);
        osc(120, 'sawtooth').connect(filt('bandpass', 240, 4)).connect(gain(0.012)).connect(B.out);
        src(audio.noise('white')).connect(filt('highpass', 5500)).connect(gain(0.008)).connect(B.out);
        break;
      }
      case 'dome':
        // air handlers, the building's low roar, vents
        src(audio.noise('pink')).connect(filt('lowpass', 350)).connect(gain(0.8)).connect(B.out);
        src(audio.noise('brown')).connect(filt('lowpass', 100)).connect(gain(0.55)).connect(B.out);
        osc(120).connect(gain(0.012)).connect(B.out);
        src(audio.noise('white')).connect(filt('highpass', 6000)).connect(gain(0.012)).connect(B.out);
        break;
      case 'park': {
        // leaves in the wind, distant traffic
        const gust = gain(0.7);
        src(audio.noise('pink')).connect(filt('bandpass', 1600, 0.6)).connect(gust).connect(gain(0.35)).connect(B.out);
        osc(0.09).connect(gain(0.25)).connect(gust.gain);
        osc(0.23).connect(gain(0.12)).connect(gust.gain);
        src(audio.noise('brown')).connect(filt('lowpass', 300)).connect(gain(0.45)).connect(B.out);
        break;
      }
      case 'bedroom':
        // room tone, the PC fan, traffic far off
        src(audio.noise('pink')).connect(filt('lowpass', 2500)).connect(gain(0.08)).connect(B.out);
        src(audio.noise('white')).connect(filt('bandpass', 170, 1.6)).connect(gain(0.45)).connect(B.out);
        src(audio.noise('white')).connect(filt('bandpass', 2100, 0.8)).connect(gain(0.03)).connect(B.out);
        osc(120).connect(gain(0.006)).connect(B.out);
        src(audio.noise('brown')).connect(filt('lowpass', 120)).connect(gain(0.3)).connect(B.out);
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
    if (this._bed) this._killBed(this._bed, 0.4);
    this._bed = null;
    this._bedName = null;
  }

  // ---- one-shots -------------------------------------------------------------

  _rateLimit(key, s, gap = 0.06) {
    const t = this._ctx.currentTime, L = this._last['t:' + key];
    if (L && t - L.t < gap && s < L.s * 1.3) return true;
    this._last['t:' + key] = { t, s };
    return false;
  }

  /** Referee's whistle: 'short' (play dead), 'long' (end of quarter / dead ball), 'double'. */
  whistle(kind = 'short') {
    if (!this._ok()) return;
    const k = kind === 'long' || kind === 'double' ? kind : 'short';
    this._play(`whistle:${k}`, { gain: 0.26, rate: 0.98 + Math.random() * 0.04, pan: (Math.random() - 0.5) * 0.4, space: 0.22 });
  }

  /** Contact. strength 0..1; kind 'pads' | 'helmet' | 'ground' | 'tackle'. */
  hit(strength = 0.5, kind = 'pads') {
    if (!this._ok()) return;
    const s = clamp(+strength || 0, 0, 1);
    if (s <= 0.01) return;
    const k = HIT_KINDS.includes(kind) ? kind : 'pads';
    if (this._rateLimit('hit:' + k, s)) return;
    const kg = { pads: 1, helmet: 1.3, ground: 0.9, tackle: 0.85 }[k];
    this._play(`hit:${k}`, {
      gain: (0.16 + 0.62 * Math.pow(s, 0.85)) * kg,
      rate: 0.93 + (1 - s) * 0.12 + Math.random() * 0.06,
      lp: 1600 + 17000 * s * s,
      pan: (Math.random() - 0.5) * 0.5,
      space: 0.04 + 0.08 * s,
    });
    if (k !== 'ground' && s > 0.45 && Math.random() < 0.35 + 0.5 * s) this.grunt(s * 0.9, 0.01 + Math.random() * 0.04);
  }

  /** A player's grunt / exhale (also fired by big hits). */
  grunt(strength = 0.7, delay = 0) {
    if (!this._ok()) return;
    const s = clamp(+strength || 0, 0, 1);
    this._play('grunt', { gain: 0.12 + 0.3 * s, rate: 0.9 + Math.random() * 0.2, pan: (Math.random() - 0.5) * 0.5, space: 0.06, when: this._ctx.currentTime + delay });
  }

  catchBall(kind = 'hands') {
    if (!this._ok()) return;
    const k = kind === 'body' || kind === 'bobble' ? kind : 'hands';
    this._play(`catch:${k}`, { gain: 0.42, rate: 0.95 + Math.random() * 0.1, pan: (Math.random() - 0.5) * 0.3, space: 0.05 });
  }

  kickBall(kind = 'kickoff') {
    if (!this._ok()) return;
    const k = kind === 'punt' || kind === 'fg' ? kind : 'kickoff';
    this._play(`kick:${k}`, { gain: 0.6, rate: 0.96 + Math.random() * 0.08, space: 0.22 });
  }

  snap() {
    if (!this._ok()) return;
    this._play('snap', { gain: 0.45, rate: 0.96 + Math.random() * 0.08, space: 0.06 });
  }

  /** The QB's count: 'set' | 'hut' | 'hard' (the hard count). */
  cadence(kind = 'hut') {
    if (!this._ok()) return;
    const k = kind === 'set' || kind === 'hard' ? kind : 'hut';
    this._play(`cadence:${k}`, { gain: k === 'hard' ? 0.6 : 0.5, rate: 0.985 + Math.random() * 0.03, space: 0.28, hp: 90 });
  }

  /** One bounce of the ball on the turf; strength 0..1 (call per ground contact). */
  ballBounce(strength = 0.6) {
    if (!this._ok()) return;
    const s = clamp(+strength || 0, 0, 1);
    if (s <= 0.01) return;
    this._play('bounce', {
      gain: 0.12 + 0.48 * Math.pow(s, 0.8), rate: 1.08 - 0.16 * s + Math.random() * 0.1,
      lp: 1800 + 12000 * s, pan: (Math.random() - 0.5) * 0.4, space: 0.08,
    });
  }

  /** Stadium PA: 'chime' | 'horn' | 'organ_charge' | 'organ_defense' | 'organ_letsgo'. */
  pa(kind = 'chime') {
    if (!this._ok()) return;
    const key = `pa:${kind}`;
    if (!SHOTS[key]) return;
    const horn = kind === 'horn';
    this._play(key, { gain: horn ? 0.42 : 0.36, space: horn ? 0.55 : 0.75, lp: 9000 });
  }

  flagThrow() {
    if (!this._ok()) return;
    this._play('flag', { gain: 0.45, rate: 0.95 + Math.random() * 0.1, pan: (Math.random() - 0.5) * 0.4, space: 0.05 });
  }

  chains() {
    if (!this._ok()) return;
    this._play('chains', { gain: 0.35, rate: 0.95 + Math.random() * 0.1, pan: (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.3), space: 0.12 });
  }

  // ---- UI / TV -------------------------------------------------------------------

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
}

export const sfx = new Sfx();
