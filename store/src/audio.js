// All sound is synthesized with WebAudio — no files. A lo-fi boom-bap loop
// (with moods per station), tunnel reverb, and a bag of short effects.

let ac = null, master, musicBus, sfxBus, verb, verbSend, comp, noiseBuf = null;
let musicOn = true, sfxOn = true;
let mood = 'main', nextMood = 'main';
let schedTimer = null, nextNoteT = 0, step = 0;
const BPM = 86;
const S16 = 60 / BPM / 4;

export function init() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return true;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ac = new AC();
  } catch {
    return false;
  }
  comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  master = ac.createGain();
  master.gain.value = 0.85;
  master.connect(comp).connect(ac.destination);
  musicBus = ac.createGain();
  musicBus.gain.value = musicOn ? 0.5 : 0;
  musicBus.connect(master);
  sfxBus = ac.createGain();
  sfxBus.gain.value = sfxOn ? 0.75 : 0;
  sfxBus.connect(master);
  verb = ac.createConvolver();
  verb.buffer = impulse(2.6, 2.2);
  verbSend = ac.createGain();
  verbSend.gain.value = 0.32;
  verbSend.connect(verb).connect(master);
  noiseBuf = makeNoise(2);
  startScheduler();
  return true;
}

export const ready = () => !!ac;

function makeNoise(sec) {
  const len = Math.floor(ac.sampleRate * sec);
  const b = ac.createBuffer(1, len, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function impulse(sec, decay) {
  const len = Math.floor(ac.sampleRate * sec);
  const b = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

export function setMusic(on) {
  musicOn = on;
  if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ac.currentTime, 0.2);
}
export function setSfx(on) {
  sfxOn = on;
  if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.75 : 0, ac.currentTime, 0.05);
}
export const musicEnabled = () => musicOn;

// ---------------------------------------------------------------- primitives

function env(g, t, a, peak, d, sustain = 0, hold = 0) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  if (hold) g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + hold + d);
}

function osc(type, freq, t, dur, peak, dest, o = {}) {
  const o1 = ac.createOscillator();
  o1.type = type;
  o1.frequency.setValueAtTime(freq, t);
  if (o.to) o1.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
  if (o.detune) o1.detune.value = o.detune;
  const g = ac.createGain();
  env(g, t, o.a ?? 0.005, peak, dur, 0, o.hold || 0);
  let node = o1;
  if (o.lp) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);
  if (o.verb) g.connect(verbSend);
  o1.start(t);
  o1.stop(t + (o.a ?? 0.005) + (o.hold || 0) + dur + 0.05);
  return o1;
}

function noise(t, dur, peak, dest, o = {}) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq || 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  f.Q.value = o.q ?? 1;
  const g = ac.createGain();
  env(g, t, o.a ?? 0.003, peak, dur, 0, o.hold || 0);
  src.connect(f).connect(g).connect(dest);
  if (o.verb) g.connect(verbSend);
  if (o.pan != null && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = o.pan;
    g.disconnect();
    g.connect(p).connect(dest);
  }
  src.start(t, Math.random());
  src.stop(t + (o.a ?? 0.003) + (o.hold || 0) + dur + 0.05);
  return src;
}

const now = () => ac.currentTime;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ---------------------------------------------------------------- music

// Cm9 – Fm9 – Abmaj7 – G7b9, one bar each
const CHORDS = [
  [48, [60, 63, 67, 70, 74]],
  [53, [60, 63, 65, 68, 72]],
  [44, [60, 63, 67, 72, 74]],
  [43, [59, 62, 65, 68, 71]],
];
const BASS = [0, null, null, 0, null, null, 7, null, 0, null, 10, null, null, 7, 5, null];
const KICK = [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const KICK_B = [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const HAT = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0];

export function setMood(m) { nextMood = m; }

function startScheduler() {
  nextNoteT = ac.currentTime + 0.1;
  step = 0;
  schedTimer = setInterval(() => {
    if (!ac) return;
    while (nextNoteT < ac.currentTime + 0.15) {
      if (step % 64 === 0) mood = nextMood;
      if (musicOn) playStep(step, nextNoteT);
      const swing = step % 2 === 1 ? S16 * 0.18 : -S16 * 0.18;
      nextNoteT += S16 + swing;
      step++;
    }
  }, 40);
}

function kick(t, peak = 0.9) {
  const o1 = ac.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(130, t);
  o1.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = ac.createGain();
  env(g, t, 0.002, peak, 0.32);
  o1.connect(g).connect(musicBus);
  o1.start(t);
  o1.stop(t + 0.4);
}

function snare(t, peak = 0.32) {
  noise(t, 0.16, peak, musicBus, { freq: 1900, q: 0.7, verb: true });
  osc('triangle', 190, t, 0.08, peak * 0.5, musicBus, { to: 150 });
}

function hat(t, peak = 0.06) {
  noise(t, 0.035, peak, musicBus, { type: 'highpass', freq: 7500, q: 0.5 });
}

function keys(t, notes, dur, peak = 0.05, lp = 1700) {
  for (const n of notes) {
    const f = midi(n);
    osc('triangle', f, t, dur, peak, musicBus, { a: 0.03, lp, detune: -6, verb: true });
    osc('sine', f * 2, t, dur * 0.6, peak * 0.3, musicBus, { a: 0.02, lp, detune: 5 });
  }
}

function playStep(s, t) {
  const bar = Math.floor(s / 16) % 4;
  const i = s % 16;
  const [root, chord] = CHORDS[bar];
  const crackle = Math.random() < 0.35;
  if (crackle) noise(t, 0.01, 0.025, musicBus, { type: 'highpass', freq: 3000 });
  if (mood === 'ghost') {
    // music box arpeggio, no drums
    if (i % 2 === 0) {
      const n = chord[(i / 2 + bar) % chord.length] + 12;
      osc('sine', midi(n), t, 0.6, 0.06, musicBus, { verb: true });
      osc('sine', midi(n) * 3, t, 0.2, 0.01, musicBus, { verb: true });
    }
    if (i === 0) osc('sine', midi(root), t, 1.6, 0.08, musicBus, { a: 0.2, verb: true });
    return;
  }
  const dark = mood === 'sewer';
  if ((bar % 2 ? KICK_B : KICK)[i]) kick(t, dark ? 1 : 0.85);
  if (SNARE[i]) snare(t, dark ? 0.22 : 0.3);
  if (HAT[i] && !dark) hat(t, i % 4 === 0 ? 0.07 : 0.045);
  if (dark && i % 4 === 2) noise(t, 0.05, 0.05, musicBus, { freq: 700, q: 4, verb: true });
  const b = BASS[i];
  if (b != null) osc('triangle', midi(root - 12 + b), t, S16 * 2.4, dark ? 0.24 : 0.2, musicBus, { lp: dark ? 380 : 600, a: 0.01 });
  if (i === 0) keys(t, chord, S16 * 7, dark ? 0.035 : 0.05, dark ? 900 : 1700);
  if (i === 10 && bar % 2 === 1) keys(t, chord.slice(2), S16 * 3, dark ? 0.025 : 0.035, dark ? 900 : 1700);
}

// ---------------------------------------------------------------- effects

const ok = () => ac && sfxOn;

export function blip(pitch = 1, wave = 'square') {
  if (!ok()) return;
  const t = now();
  osc(wave, 280 * pitch * (0.92 + Math.random() * 0.16), t, 0.05, 0.05, sfxBus, { lp: 2400 });
}

export function click() {
  if (!ok()) return;
  osc('square', 900, now(), 0.03, 0.04, sfxBus, { lp: 3000 });
}

export function coin(big = false) {
  if (!ok()) return;
  const t = now();
  osc('square', big ? 988 : 1318, t, 0.07, 0.07, sfxBus, { lp: 4000 });
  osc('square', big ? 1318 : 1760, t + 0.07, big ? 0.3 : 0.18, 0.07, sfxBus, { lp: 4000, verb: true });
  if (big) osc('square', 1976, t + 0.16, 0.3, 0.06, sfxBus, { lp: 4000, verb: true });
}

export function step2() {
  if (!ok()) return;
  noise(now(), 0.05, 0.035, sfxBus, { freq: 280, q: 1.2 });
}

export function jump() {
  if (!ok()) return;
  osc('triangle', 300, now(), 0.16, 0.08, sfxBus, { to: 620, glide: 0.12 });
}

export function land() {
  if (!ok()) return;
  noise(now(), 0.06, 0.06, sfxBus, { freq: 200, q: 1 });
}

export function chime() {
  // stand clear of the closing doors
  if (!ok()) return;
  const t = now();
  for (const [n, dt] of [[76, 0], [72, 0.42]]) {
    osc('sine', midi(n), t + dt, 0.9, 0.12, sfxBus, { verb: true });
    osc('sine', midi(n) * 2.01, t + dt, 0.4, 0.03, sfxBus, { verb: true });
  }
}

export function train(kind = 'arrive', dur = 3) {
  if (!ok()) return;
  const t = now();
  // rumble
  const r = noise(t, dur, 0.35, sfxBus, { type: 'lowpass', freq: kind === 'arrive' ? 500 : 180, to: kind === 'arrive' ? 160 : 600, q: 0.8, a: kind === 'arrive' ? 0.8 : 0.1, hold: dur * 0.3 });
  void r;
  osc('sawtooth', kind === 'arrive' ? 70 : 50, t, dur, 0.06, sfxBus, { lp: 200, a: 0.5, to: kind === 'arrive' ? 40 : 90 });
  if (kind === 'arrive') {
    // brake screech near the end
    noise(t + dur * 0.55, dur * 0.4, 0.06, sfxBus, { freq: 3800, to: 2600, q: 12, a: 0.1, verb: true });
  }
}

export function whoosh() {
  if (!ok()) return;
  noise(now(), 0.9, 0.3, sfxBus, { freq: 300, to: 2400, q: 0.7, a: 0.2 });
}

export function swipeSound() {
  if (!ok()) return;
  noise(now(), 0.18, 0.12, sfxBus, { freq: 1200, to: 3200, q: 2 });
}

export function beepGood() {
  if (!ok()) return;
  const t = now();
  osc('square', 880, t, 0.08, 0.06, sfxBus, { lp: 3000 });
  osc('square', 1320, t + 0.09, 0.14, 0.06, sfxBus, { lp: 3000 });
}

export function beepBad() {
  if (!ok()) return;
  osc('sawtooth', 140, now(), 0.35, 0.08, sfxBus, { lp: 900 });
}

export function clunk() {
  if (!ok()) return;
  const t = now();
  noise(t, 0.12, 0.25, sfxBus, { freq: 180, q: 2 });
  osc('square', 90, t, 0.1, 0.08, sfxBus, { lp: 400 });
  noise(t + 0.08, 0.04, 0.1, sfxBus, { freq: 2600, q: 3 });
}

export function register() {
  if (!ok()) return;
  const t = now();
  noise(t, 0.05, 0.12, sfxBus, { freq: 1600, q: 2 });
  osc('sine', 2093, t + 0.06, 0.6, 0.09, sfxBus, { verb: true });
  osc('sine', 2637, t + 0.06, 0.5, 0.05, sfxBus, { verb: true });
}

export function fanfare() {
  if (!ok()) return;
  const t = now();
  [72, 76, 79, 84].forEach((n, i) => osc('square', midi(n), t + i * 0.09, 0.22, 0.05, sfxBus, { lp: 3200, verb: true }));
}

export function sad() {
  if (!ok()) return;
  const t = now();
  [67, 63, 60].forEach((n, i) => osc('triangle', midi(n), t + i * 0.16, 0.3, 0.07, sfxBus, { lp: 1800 }));
}

export function spark() {
  if (!ok()) return;
  noise(now(), 0.12, 0.05, sfxBus, { type: 'highpass', freq: 4000, q: 0.5, pan: Math.random() * 2 - 1 });
}

export function ring() {
  if (!ok()) return;
  const t = now();
  for (let k = 0; k < 2; k++) {
    const t0 = t + k * 0.5;
    const o1 = ac.createOscillator();
    const o2 = ac.createOscillator();
    o1.frequency.value = 440;
    o2.frequency.value = 480;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 20;
    const lg = ac.createGain();
    lg.gain.value = 0.5;
    const g = ac.createGain();
    env(g, t0, 0.01, 0.05, 0.32, 0, 0.05);
    lfo.connect(lg).connect(g.gain);
    o1.connect(g); o2.connect(g);
    g.connect(sfxBus);
    for (const o of [o1, o2, lfo]) { o.start(t0); o.stop(t0 + 0.45); }
  }
}

export function knock() {
  if (!ok()) return;
  const t = now();
  for (let k = 0; k < 3; k++) {
    noise(t + k * 0.16, 0.06, 0.3, sfxBus, { freq: 420, q: 6 });
    osc('sine', 160, t + k * 0.16, 0.08, 0.1, sfxBus);
  }
}

export function sax() {
  if (!ok()) return;
  const t = now();
  [62, 65, 67, 70, 67, 65].forEach((n, i) => {
    const o1 = osc('sawtooth', midi(n), t + i * 0.16, 0.18, 0.05, sfxBus, { lp: 1400, a: 0.02, verb: true });
    void o1;
  });
}

let sprayNode = null;
export function spray(on) {
  if (!ac) return;
  if (on && !sprayNode && sfxOn) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 5200;
    f.Q.value = 0.6;
    const g = ac.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.09, ac.currentTime + 0.05);
    src.connect(f).connect(g).connect(sfxBus);
    src.start();
    sprayNode = { src, g };
  } else if (!on && sprayNode) {
    const { src, g } = sprayNode;
    g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.03);
    src.stop(ac.currentTime + 0.15);
    sprayNode = null;
  }
}

let motorNode = null;
export function motor(on) {
  if (!ac) return;
  if (on && !motorNode && sfxOn) {
    const o1 = ac.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 95;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 9;
    const lg = ac.createGain();
    lg.gain.value = 8;
    lfo.connect(lg).connect(o1.frequency);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = ac.createGain();
    g.gain.value = 0.04;
    o1.connect(f).connect(g).connect(sfxBus);
    o1.start();
    lfo.start();
    motorNode = { o1, lfo, g };
  } else if (!on && motorNode) {
    motorNode.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.03);
    motorNode.o1.stop(ac.currentTime + 0.15);
    motorNode.lfo.stop(ac.currentTime + 0.15);
    motorNode = null;
  }
}

export function shuffleTick() {
  if (!ok()) return;
  noise(now(), 0.04, 0.12, sfxBus, { freq: 900 + Math.random() * 400, q: 5 });
}

export function pop() {
  if (!ok()) return;
  osc('sine', 600, now(), 0.08, 0.1, sfxBus, { to: 1200, glide: 0.06 });
}

export function ghostWail() {
  if (!ok()) return;
  const t = now();
  osc('sine', 520, t, 1.6, 0.06, sfxBus, { a: 0.4, to: 380, glide: 1.6, verb: true });
  osc('sine', 780, t + 0.2, 1.2, 0.03, sfxBus, { a: 0.4, to: 560, glide: 1.2, verb: true });
}
