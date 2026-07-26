// FOCUS GROUP — everything you hear, made on the spot.
//
// Three things live in here that the rest of the shelf does not have:
//
//   the jingle      eight bars of 1974 optimism that get a little slower, a
//                   little flatter and finally a little minor across six
//                   mornings, without ever changing tune
//   the announcer   a warm man talking through a wall. No words: three
//                   band-passed formants and a syllable envelope. Captions do
//                   the talking. It is friendlier than a voice and much worse
//   the audience    one titter you can barely hear on Wednesday, a full house
//                   on Sunday

import { clamp, clamp01, rng } from './util.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CENTS = (c) => Math.pow(2, c / 1200);

// ------------------------------------------------------------------ the jingle
//
// [midi, beat, beats] at 120bpm. Eight beats, four seconds, and if you have
// heard it twice you will be humming it for the rest of the week. That is the
// job of a jingle and Valco paid for a good one.

const JINGLE_TUNE = [
  [74, 0.0, 0.5],   // VAL-
  [79, 0.5, 1.0],   // -CO
  [83, 1.5, 0.5],
  [81, 2.0, 0.5],
  [79, 2.5, 1.0],
  [76, 3.5, 0.5],   // we're
  [78, 4.0, 0.5],   // part
  [79, 4.5, 0.5],   // of
  [81, 5.0, 0.5],   // your
  [83, 5.5, 1.5],   // MOR-
  [79, 7.0, 1.0],   // -ning
];

// G  G  C  C  G  Em Am D  — one root a beat, walked
const JINGLE_BASS = [43, 43, 48, 48, 43, 40, 45, 50];

// the chord under each beat, as intervals above the bass root
const JINGLE_CHORD = [
  [0, 7, 16], [0, 7, 16], [0, 7, 16], [0, 7, 16],
  [0, 7, 16], [0, 7, 15], [0, 7, 15], [0, 7, 16],
];

// how the jingle decays over six mornings. Nobody remixed it. It is the same
// tape, played on a deck that is very slowly giving up.
const JINGLE_VARIANTS = {
  jingle: { rate: 1.0, cents: 0, minor: false, choir: 0, wow: 0.0015 },
  'jingle-slow': { rate: 0.965, cents: -7, minor: false, choir: 0, wow: 0.004 },
  'jingle-minor': { rate: 0.925, cents: -14, minor: true, choir: 0.18, wow: 0.008 },
  'jingle-final': { rate: 0.88, cents: -22, minor: true, choir: 0.45, wow: 0.013 },
};

// in the minor version the third and the sixth go down a semitone. It is the
// only edit, and it is enough.
const flatten = (midi) => {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 11 || pc === 4 ? midi - 1 : midi;
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volSfx = 0.9;
    this.volMusic = 0.6;
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.rand = rng(19740305);
    this.tone = null;
    this.jingle = null;
    this.timers = [];
  }

  // ---------------------------------------------------------------- plumbing

  ensure() {
    if (this.ctx) return this.ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(ctx.destination);

      // one-shots and the room go through a small, dry-ish plaster reverb —
      // a flat, not a cathedral
      this.bus = ctx.createGain();
      this.dry = ctx.createGain();
      this.dry.gain.value = 1;
      this.bus.connect(this.dry).connect(this.master);

      this.verb = ctx.createConvolver();
      this.verb.buffer = this.impulse(1.1, 0.9);
      this.verbGain = ctx.createGain();
      this.verbGain.gain.value = 0.16;
      this.bus.connect(this.verb).connect(this.verbGain).connect(this.master);

      // the television is its own little speaker: everything on it is band
      // limited and slightly boxy, which is most of why old ads sound old
      this.tv = ctx.createGain();
      this.tv.gain.value = 1;
      const tvLo = ctx.createBiquadFilter();
      tvLo.type = 'highpass';
      tvLo.frequency.value = 260;
      const tvHi = ctx.createBiquadFilter();
      tvHi.type = 'lowpass';
      tvHi.frequency.value = 4200;
      const tvPeak = ctx.createBiquadFilter();
      tvPeak.type = 'peaking';
      tvPeak.frequency.value = 1500;
      tvPeak.gain.value = 5;
      tvPeak.Q.value = 0.9;
      this.tv.connect(tvLo).connect(tvPeak).connect(tvHi).connect(this.master);

      this.ready = true;
    } catch {
      this.ready = false;
    }
    return this.ctx;
  }

  resume() { this.ctx?.resume?.(); }
  suspend() { this.ctx?.suspend?.(); }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.9;
  }

  setListener(x, z, yaw) {
    this.listener.x = x;
    this.listener.z = z;
    this.listener.yaw = yaw;
  }

  /** Full-band or television? Everything Valco says comes out of a set. */
  out(onTv) { return onTv ? this.tv : this.bus; }

  impulse(dur = 1.1, decay = 0.9) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay * 4);
      }
    }
    return buf;
  }

  noiseBuf(dur = 1, brown = 0.72) {
    const ctx = this.ctx;
    const len = Math.max(64, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * brown + w * (1 - brown);
      d[i] = last;
    }
    return buf;
  }

  env(t0, attack, hold, release, peak, target = null) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const p = Math.max(0.0002, peak);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(p, t0 + attack);
    g.gain.setValueAtTime(p, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    g.connect(target || this.bus);
    return g;
  }

  osc(type, f0, f1, t0, dur, gain, target) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = this.env(t0, Math.min(0.02, dur * 0.2), dur * 0.3, dur * 0.6, gain, target);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  noise(t0, dur, gain, filter = {}, target) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf(Math.max(0.2, dur), filter.brown ?? 0.72);
    const bq = this.ctx.createBiquadFilter();
    bq.type = filter.type || 'bandpass';
    bq.frequency.setValueAtTime(filter.f ?? 900, t0);
    if (filter.f2) bq.frequency.exponentialRampToValueAtTime(Math.max(40, filter.f2), t0 + dur);
    bq.Q.value = filter.q ?? 1;
    const g = this.env(t0, filter.attack ?? 0.005, dur * 0.2, dur * 0.8, gain, target);
    src.connect(bq).connect(g);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
    return src;
  }

  /** Distance + pan for a sound with a world position. */
  place(at, gain = 1) {
    if (!at) return { gain, pan: 0 };
    const dx = at.x - this.listener.x;
    const dz = at.z - this.listener.z;
    const d = Math.hypot(dx, dz);
    return {
      gain: gain / (1 + d * d * 0.05),
      pan: clamp(Math.sin(Math.atan2(-dx, -dz) - this.listener.yaw), -1, 1),
    };
  }

  panner(pan, target) {
    const dest = target || this.bus;
    if (!this.ctx.createStereoPanner || Math.abs(pan) < 0.02) return dest;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(dest);
    return p;
  }

  later(fn, ms) {
    const id = setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
    return id;
  }

  clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  // ---------------------------------------------------------------- room tone
  //
  // A flat is never silent. It is a fridge, a boiler, and a road far enough
  // away to be weather. On the last morning it is an air handler and forty
  // monitors, which is a different kind of quiet.

  startTone(kind) {
    this.stopTone();
    if (!this.ready) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    g.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 2.0);
    const nodes = [];

    const drone = (freq, gain, type = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const og = ctx.createGain();
      og.gain.value = gain;
      o.connect(og).connect(g);
      o.start();
      nodes.push(o, og);
      return { o, og };
    };
    const bed = (f, q, gain, type = 'bandpass') => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf(4);
      src.loop = true;
      const bq = ctx.createBiquadFilter();
      bq.type = type;
      bq.frequency.value = f;
      bq.Q.value = q;
      const ng = ctx.createGain();
      ng.gain.value = gain;
      src.connect(bq).connect(ng).connect(g);
      src.start();
      nodes.push(src, bq, ng);
      return { src, bq, ng };
    };

    switch (kind) {
      case 'flat':
        drone(50, 0.020);                 // the fridge
        drone(100, 0.009, 'triangle');
        bed(340, 0.6, 0.011, 'lowpass');  // the road, four streets off
        bed(2400, 1.2, 0.0035);
        break;
      case 'hall':
        drone(50, 0.012);
        bed(500, 0.5, 0.008, 'lowpass');
        break;
      case 'basement':
        drone(50, 0.045);                 // a transformer, and it is not small
        drone(100, 0.030, 'triangle');
        drone(150.7, 0.014, 'sawtooth');
        bed(180, 1.4, 0.010, 'lowpass');
        break;
      case 'studio':
        bed(1800, 0.4, 0.010, 'highpass');  // air handling
        drone(60, 0.014);
        drone(15734 / 8, 0.0028, 'sine');   // forty line-scan whines, an octave down
        break;
      default:
        bed(900, 0.7, 0.006);
    }
    this.tone = { g, nodes, kind };
  }

  stopTone() {
    if (!this.tone) return;
    const { g, nodes } = this.tone;
    this.tone = null;
    try {
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    } catch { /* context already gone */ }
    setTimeout(() => {
      nodes.forEach((n) => { try { n.stop?.(); n.disconnect(); } catch { /* fine */ } });
      try { g.disconnect(); } catch { /* fine */ }
    }, 700);
  }

  // ---------------------------------------------------------------- the jingle

  /**
   * Play the Valco jingle once.
   * @param {string} variant one of JINGLE_VARIANTS
   * @param {boolean} onTv    through the television speaker, or in the room
   * @param {number} gain
   * @returns {number} how long it runs, in seconds
   */
  playJingle(variant = 'jingle', onTv = true, gain = 1) {
    if (!this.ready || this.muted) return 4;
    const v = JINGLE_VARIANTS[variant] || JINGLE_VARIANTS.jingle;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    const beat = 0.5 / v.rate;
    const out = this.out(onTv);
    const tune = v.cents;
    const G = gain * this.volMusic;

    const fq = (midi) => NOTE(v.minor ? flatten(midi) : midi) * CENTS(tune);

    // ---- the melody: a chord organ, three drawbars and a bit of wobble
    for (const [midi, at, len] of JINGLE_TUNE) {
      const t = t0 + at * beat;
      const dur = len * beat * 0.96;
      const f = fq(midi);
      [[1, 0.26], [2, 0.13], [3, 0.055], [4, 0.03]].forEach(([mul, amp]) => {
        const o = ctx.createOscillator();
        o.type = mul === 1 ? 'triangle' : 'sine';
        o.frequency.value = f * mul;
        // tape wow: the deck is not quite holding pitch, and it holds it less
        // every morning
        if (v.wow > 0) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.7;
          const lg = ctx.createGain();
          lg.gain.value = f * mul * v.wow;
          lfo.connect(lg).connect(o.frequency);
          lfo.start(t);
          lfo.stop(t + dur + 0.1);
        }
        const eg = this.env(t, 0.012, dur * 0.62, dur * 0.36, amp * G, out);
        o.connect(eg);
        o.start(t);
        o.stop(t + dur + 0.1);
      });
    }

    // ---- bass and chords, one root a beat
    JINGLE_BASS.forEach((root, i) => {
      const t = t0 + i * beat;
      const bf = fq(root);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = bf;
      o.connect(this.env(t, 0.01, beat * 0.35, beat * 0.5, 0.20 * G, out));
      o.start(t);
      o.stop(t + beat + 0.1);

      JINGLE_CHORD[i].forEach((iv, k) => {
        const c = ctx.createOscillator();
        c.type = 'sine';
        c.frequency.value = fq(root + 12 + (v.minor && k === 2 ? iv - 1 : iv));
        c.connect(this.env(t + 0.02, 0.02, beat * 0.3, beat * 0.45, 0.055 * G, out));
        c.start(t + 0.02);
        c.stop(t + beat + 0.1);
      });
    });

    // ---- a shaker on the eighths, because it is 1974
    for (let i = 0; i < 16; i++) {
      const t = t0 + i * beat * 0.5;
      this.noise(t, 0.045, (i % 2 ? 0.028 : 0.045) * G, { f: 6800, q: 1.2, brown: 0.1 }, out);
    }

    // ---- and on the bad mornings, the room hums along with it
    if (v.choir > 0) {
      for (const [midi, at, len] of JINGLE_TUNE) {
        const t = t0 + at * beat;
        const dur = len * beat * 1.3;
        const f = fq(midi) / 2;
        for (const det of [-7, 4, 11]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f * CENTS(det);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 620;
          bp.Q.value = 3.2;
          o.connect(bp).connect(this.env(t, dur * 0.4, dur * 0.2, dur * 0.5, 0.05 * v.choir * G, out));
          o.start(t);
          o.stop(t + dur + 0.2);
        }
      }
    }

    return 8 * beat;
  }

  /** Two notes of it, as a sting. Used when the checklist ticks. */
  jingleSting(gain = 0.6) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + 0.01;
    this.osc('triangle', NOTE(74), NOTE(74), t, 0.16, 0.16 * gain * this.volSfx, this.bus);
    this.osc('triangle', NOTE(79), NOTE(79), t + 0.13, 0.34, 0.14 * gain * this.volSfx, this.bus);
    this.osc('sine', NOTE(91), NOTE(91), t + 0.13, 0.34, 0.05 * gain * this.volSfx, this.bus);
  }

  // ---------------------------------------------------------------- announcer
  //
  // Three band-passed formants over a sawtooth larynx. No words — the captions
  // are the words. What this gives you is the shape of a man being warm at you,
  // which is the part of an advertisement that actually does the work.

  /**
   * @param {string} text the caption, used only for its rhythm
   * @param {object} o    { gain, onTv, pitch, warm }
   * @returns {number} seconds of babble
   */
  announce(text, o = {}) {
    if (!this.ready || this.muted || !text) return 0;
    const ctx = this.ctx;
    const out = this.out(o.onTv !== false);
    const G = (o.gain ?? 1) * this.volSfx;
    const R = this.rand;
    const base = o.pitch ?? 112;         // a reassuring baritone
    const words = String(text).replace(/[^\w' ]/g, ' ').split(/\s+/).filter(Boolean);
    let t = ctx.currentTime + 0.04;

    // vowel formant pairs, roughly: ah, ee, oh, uh, eh
    const VOWELS = [[730, 1090], [270, 2290], [570, 840], [520, 1190], [530, 1840]];

    for (let w = 0; w < words.length; w++) {
      const syll = Math.max(1, Math.round(words[w].length / 2.6));
      for (let s = 0; s < syll; s++) {
        const dur = 0.10 + R() * 0.07;
        const [f1, f2] = VOWELS[Math.floor(R() * VOWELS.length)];
        // a sentence falls at the end and an advertisement falls further
        const fall = 1 - (w / Math.max(1, words.length)) * 0.22;
        const f0 = base * fall * (0.95 + R() * 0.12);

        const larynx = ctx.createOscillator();
        larynx.type = 'sawtooth';
        larynx.frequency.setValueAtTime(f0 * 1.03, t);
        larynx.frequency.linearRampToValueAtTime(f0, t + dur);

        const eg = ctx.createGain();
        eg.gain.setValueAtTime(0.0001, t);
        eg.gain.exponentialRampToValueAtTime(0.9, t + 0.022);
        eg.gain.setValueAtTime(0.9, t + dur * 0.62);
        eg.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        larynx.connect(eg);
        [[f1, 6, 0.5], [f2, 9, 0.34], [2550, 12, 0.14]].forEach(([f, q, amp]) => {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = f * (0.96 + R() * 0.08);
          bp.Q.value = q;
          const ag = ctx.createGain();
          ag.gain.value = amp * 0.5 * G;
          eg.connect(bp).connect(ag).connect(out);
        });
        larynx.start(t);
        larynx.stop(t + dur + 0.05);

        t += dur + 0.012;
      }
      t += 0.055 + R() * 0.05;   // between words
    }
    return t - ctx.currentTime;
  }

  // ---------------------------------------------------------------- audience

  /**
   * @param {'titter'|'laugh'|'applause-small'|'applause'|'hum'} kind
   */
  audience(kind, gain = 1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    const R = this.rand;
    const G = gain * this.volSfx;
    const out = this.bus;

    // one voice going "ha": a short vowel burst on a sawtooth
    const ha = (t, f0, amp, dur = 0.075) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * 1.15, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.88, t + dur);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700 + R() * 500;
      bp.Q.value = 4;
      o.connect(bp).connect(this.env(t, 0.008, dur * 0.4, dur * 0.6, amp, out));
      o.start(t);
      o.stop(t + dur + 0.05);
    };

    switch (kind) {
      // barely there. You will decide it was the pipes.
      case 'titter':
        for (let i = 0; i < 4; i++) {
          ha(t0 + i * (0.075 + R() * 0.04), 150 + R() * 130, 0.014 * G, 0.055);
        }
        this.noise(t0, 0.5, 0.006 * G, { f: 1400, q: 0.7 }, out);
        break;

      // a room. Not a big one, but definitely a room, and definitely people.
      case 'laugh':
        for (let v = 0; v < 9; v++) {
          const start = t0 + R() * 0.14;
          const f0 = 120 + R() * 190;
          const n = 3 + Math.floor(R() * 3);
          for (let i = 0; i < n; i++) {
            ha(start + i * (0.088 + R() * 0.035), f0 * (1 - i * 0.04), (0.035 + R() * 0.02) * G);
          }
        }
        this.noise(t0, 1.5, 0.020 * G, { f: 1100, q: 0.5 }, out);
        break;

      case 'applause-small':
        this.clap(t0, 0.9, 9, 0.5 * G);
        break;

      case 'applause':
        this.clap(t0, 3.4, 60, 1.0 * G);
        for (let v = 0; v < 6; v++) {
          ha(t0 + 0.2 + R() * 1.2, 150 + R() * 200, 0.03 * G, 0.14);
        }
        break;

      // they know the tune. Of course they know the tune.
      case 'hum':
        for (const midi of [55, 62, 67, 71]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = NOTE(midi) * CENTS(R() * 12 - 6);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 560;
          bp.Q.value = 3;
          o.connect(bp).connect(this.env(t0, 1.4, 2.0, 2.2, 0.045 * G, out));
          o.start(t0);
          o.stop(t0 + 6);
        }
        break;
      default:
        break;
    }
  }

  /** n pairs of hands, for dur seconds, thinning out the way applause does. */
  clap(t0, dur, n, gain) {
    const R = this.rand;
    const out = this.bus;
    for (let i = 0; i < n; i++) {
      // dense at the front, ragged at the back
      const u = Math.pow(R(), 0.55);
      const t = t0 + u * dur;
      const claps = 3 + Math.floor(R() * 5);
      for (let c = 0; c < claps; c++) {
        const ct = t + c * (0.16 + R() * 0.1);
        if (ct > t0 + dur) break;
        this.noise(ct, 0.035, (0.05 + R() * 0.04) * gain * (1 - (ct - t0) / (dur * 1.4)),
          { f: 1600 + R() * 2400, q: 0.8, brown: 0.15, attack: 0.001 }, out);
      }
    }
  }

  // ---------------------------------------------------------------- one-shots

  oneShot(name, gain = 1, at = null) {
    if (!this.ready || this.muted || name === 'none') return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const p = this.place(at, gain * this.volSfx);
    const out = this.panner(p.pan);
    const G = p.gain;
    const R = this.rand;

    switch (name) {
      // ---- the flat
      case 'click':                       // a switch, a dial, a plastic thing
        this.noise(t, 0.03, 0.5 * G, { f: 2400, q: 2, brown: 0.1, attack: 0.001 }, out);
        this.osc('square', 320, 180, t, 0.025, 0.10 * G, out);
        break;
      case 'radioOff':
        this.oneShot('click', gain, at);
        this.osc('sine', 240, 60, t + 0.02, 0.22, 0.07 * G, out);
        break;
      case 'blinds':
        for (let i = 0; i < 11; i++) {
          this.noise(t + i * 0.036, 0.05, 0.10 * G * (1 - i / 16),
            { f: 1500 + R() * 900, q: 3, brown: 0.2 }, out);
        }
        break;
      case 'kettle':                      // twelve seconds of water making up its mind
        this.noise(t, 8.0, 0.10 * G, { type: 'lowpass', f: 500, f2: 2600, attack: 3.2 }, out);
        for (let i = 0; i < 26; i++) {
          this.noise(t + 1.5 + R() * 6, 0.05, 0.03 * G, { f: 900 + R() * 2200, q: 6 }, out);
        }
        break;
      case 'pour':
        this.noise(t, 1.6, 0.13 * G, { type: 'bandpass', f: 620, f2: 1500, q: 1.4, attack: 0.15 }, out);
        break;
      case 'cupdown':
        this.noise(t, 0.07, 0.28 * G, { f: 2100, q: 3, brown: 0.2, attack: 0.001 }, out);
        this.osc('sine', 700, 500, t, 0.09, 0.10 * G, out);
        break;
      case 'fumble':                      // something hits the floor and rolls
        this.noise(t, 0.09, 0.4 * G, { f: 900, q: 1.5, attack: 0.001 }, out);
        for (let i = 0; i < 5; i++) {
          this.noise(t + 0.13 + i * 0.09, 0.05, 0.14 * G / (1 + i), { f: 1300, q: 2 }, out);
        }
        break;
      case 'door':
        this.noise(t, 0.16, 0.28 * G, { type: 'lowpass', f: 340, attack: 0.01 }, out);
        this.osc('sine', 92, 62, t + 0.04, 0.2, 0.14 * G, out);
        break;
      case 'knock':
        for (let i = 0; i < 3; i++) {
          this.noise(t + i * 0.21, 0.10, 0.42 * G, { type: 'lowpass', f: 280, attack: 0.002 }, out);
          this.osc('sine', 130, 78, t + i * 0.21, 0.11, 0.16 * G, out);
        }
        break;
      case 'bell':                        // the service bell in the basement
        [1, 2.76, 5.4].forEach((mul, i) => {
          this.osc('sine', 1180 * mul, 1178 * mul, t, 2.4 - i * 0.5, (0.16 / (i + 1)) * G, out);
        });
        break;
      case 'lift':
        this.osc('sine', 46, 44, t, 3.2, 0.10 * G, out);
        this.noise(t, 3.2, 0.03 * G, { type: 'lowpass', f: 240, attack: 0.6 }, out);
        break;

      // ---- the apparatus
      case 'relay':                       // a camera taking over. Very small. Very close.
        this.noise(t, 0.018, 0.30 * G, { f: 3600, q: 4, brown: 0.05, attack: 0.001 }, out);
        break;
      case 'iris':
        this.noise(t, 0.14, 0.10 * G, { type: 'bandpass', f: 2200, f2: 900, q: 5, attack: 0.01 }, out);
        break;
      case 'lightbank':                   // a contactor the size of a fist, then fluoro
        this.noise(t, 0.05, 0.5 * G, { type: 'lowpass', f: 200, attack: 0.001 }, out);
        this.osc('sine', 70, 50, t, 0.3, 0.2 * G, out);
        this.noise(t + 0.1, 1.4, 0.05 * G, { type: 'highpass', f: 5200, attack: 0.5 }, out);
        break;
      case 'tape':
        this.noise(t, 0.35, 0.16 * G, { type: 'highpass', f: 3800, attack: 0.01 }, out);
        break;
      case 'static':
        this.noise(t, 0.6, 0.20 * G, { type: 'highpass', f: 1800, brown: 0.05 }, out);
        break;
      case 'projector':
        for (let i = 0; i < 22; i++) {
          this.noise(t + i * 0.0417, 0.02, 0.05 * G, { f: 520, q: 3, brown: 0.3 }, out);
        }
        break;

      // ---- Valco is pleased with you
      case 'praise':
        this.osc('sine', NOTE(79), NOTE(79), t, 0.14, 0.13 * G, out);
        this.osc('sine', NOTE(83), NOTE(83), t + 0.1, 0.3, 0.11 * G, out);
        this.osc('sine', NOTE(86), NOTE(86), t + 0.2, 0.42, 0.08 * G, out);
        break;
      case 'noticed':
        this.osc('triangle', NOTE(86), NOTE(86), t, 0.1, 0.09 * G, out);
        this.osc('triangle', NOTE(81), NOTE(81), t + 0.08, 0.26, 0.07 * G, out);
        break;
      case 'stingSoft':                   // he is at the end of the hall
        this.osc('sine', 74, 58, t, 2.6, 0.10 * G, out);
        this.noise(t, 2.2, 0.028 * G, { type: 'lowpass', f: 300, attack: 0.9 }, out);
        break;
      case 'stingHard':
        this.osc('sawtooth', 160, 42, t, 1.4, 0.16 * G, out);
        this.noise(t, 0.9, 0.10 * G, { type: 'lowpass', f: 900, f2: 160, attack: 0.005 }, out);
        break;

      default:
        this.noise(t, 0.18, 0.16 * G, { f: 1200, q: 1 }, out);
    }
  }

  footstep(mat = 'carpet', force = 0.6) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + 0.005;
    const G = force * 0.32 * this.volSfx;
    const K = {
      carpet: { f: 320, q: 0.8, dur: 0.075, brown: 0.8 },
      lino: { f: 1500, q: 1.4, dur: 0.05, brown: 0.25 },
      tile: { f: 2400, q: 2.0, dur: 0.055, brown: 0.15 },
      concrete: { f: 900, q: 1.0, dur: 0.07, brown: 0.4 },
      stage: { f: 240, q: 0.9, dur: 0.09, brown: 0.6 },   // hollow. It is a set.
    }[mat] || { f: 500, q: 1, dur: 0.07, brown: 0.6 };
    this.noise(t, K.dur, G, { f: K.f, q: K.q, brown: K.brown, attack: 0.002 }, this.bus);
    if (mat === 'stage') this.osc('sine', 96, 66, t, 0.13, G * 0.5, this.bus);
  }

  dispose() {
    this.clearTimers();
    this.stopTone();
    try { this.ctx?.close?.(); } catch { /* fine */ }
    this.ctx = null;
    this.ready = false;
  }
}
