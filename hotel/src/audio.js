// Every noise NO VACANCY makes, synthesized at runtime: the front-desk bell,
// ringing phones, doors, housekeeping, the register, and the lobby muzak that
// never, ever stops. No audio files — it is all oscillators and noise buffers.

const MASTER = 0.7;

// --- tiny pure helpers ------------------------------------------------------
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pos = (v) => (v > 0.0001 ? v : 0.0001);
const jitter = (v, amt) => v * (1 + (Math.random() * 2 - 1) * amt);
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

// --- lobby muzak ------------------------------------------------------------
// Fmaj7 - Dm7 - Gm7 - C7 at 72bpm: warm, going absolutely nowhere, which is the
// entire point of lobby music. Voicings move by a step or two so the pad never
// jumps. `mel` is the pool the lazy top line draws from.
const BPM = 72;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const MUZAK_GAIN = 0.05;
const LOOKAHEAD = 0.9;   // seconds of notes kept scheduled ahead of the clock
const TICK_MS = 220;     // how often the scheduler wakes up

const PROG = [
  { bass: 41, voices: [57, 60, 64, 65], mel: [72, 76, 77, 81] }, // Fmaj7
  { bass: 38, voices: [57, 60, 62, 65], mel: [69, 72, 74, 77] }, // Dm7
  { bass: 43, voices: [58, 60, 62, 65], mel: [70, 74, 77, 79] }, // Gm7
  { bass: 36, voices: [58, 60, 64, 67], mel: [72, 74, 76, 79] }, // C7
];

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._unavailable = false;
    this._bufs = {};
    // beds
    this._busyGain = null;
    this._vacGain = null;
    this._busy = 0;
    this._vacOn = false;
    // muzak
    this._muzakOn = false;
    this._muzakOut = null;
    this._muzakBus = null;
    this._muzakChain = null;
    this._muzakTimer = null;
    this._muzakAt = 0;
    this._muzakBar = 0;
    this._muzakVoices = [];
    this._muzakGen = 0;
    this._muzakWant = false;
  }

  /** Build the context on the first user gesture. Cheap to call every frame. */
  ensure() {
    if (this.ctx) return true;
    if (this._unavailable) return false;
    try {
      const AC = typeof window !== 'undefined' &&
        (window.AudioContext || window.webkitAudioContext);
      if (!AC) { this._unavailable = true; return false; }
      const ctx = new AC();
      this.ctx = ctx;
      this._bufs = {};
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER;
      this.master.connect(ctx.destination);
      this._buildBeds();
    } catch {
      this.ctx = null;
      this.master = null;
      return false;
    }
    // replay whatever the game asked for before the gesture landed
    if (this._busy > 0) this.setBusy(this._busy);
    if (this._vacOn) this.vacuum(true);
    if (this._muzakWant) { this._muzakWant = false; this.muzak(true); }
    return true;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) {
      try { this.master.gain.value = this.muted ? 0 : MASTER; } catch { /* dead ctx */ }
    }
  }

  resume() {
    if (!this.ctx) return;
    try { if (this.ctx.state === 'suspended') this.ctx.resume(); } catch { /* ignore */ }
  }

  _ok() {
    return !!(this.ctx && this.master && this.ctx.state !== 'closed');
  }

  // --- plumbing -------------------------------------------------------------

  /** Cached noise. 'white' for hiss and impacts, 'brown' for room rumble. */
  _buf(kind) {
    if (this._bufs[kind]) return this._bufs[kind];
    const ctx = this.ctx;
    const secs = kind === 'brown' ? 3 : 2;
    const len = Math.ceil(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
        d[i] = last * 6;
      }
      // taper the seam so the loop point does not tick
      const fade = 256;
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        d[i] *= k;
        d[len - 1 - i] *= k;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    this._bufs[kind] = buf;
    return buf;
  }

  /** Free the graph the instant a one-shot finishes so long sessions stay flat. */
  _reap(node, ...chain) {
    try {
      node.onended = () => {
        try { node.disconnect(); } catch { /* already gone */ }
        for (const n of chain) { try { n.disconnect(); } catch { /* already gone */ } }
      };
    } catch { /* no onended */ }
  }

  /** Decaying oscillator, optionally gliding f0 -> f1. */
  _osc(type, f0, f1, t, gain = 0.2, when = 0, dest = null) {
    if (!this._ok()) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    const t0 = ctx.currentTime + when;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + t);
    g.gain.setValueAtTime(pos(gain), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    o.connect(g).connect(dest || this.master);
    o.start(t0);
    o.stop(t0 + t + 0.02);
    this._reap(o, g);
  }

  /** Struck partial: 4ms attack then a long exponential tail. Bells, mallets. */
  _ping(freq, t, gain, when = 0, type = 'sine', dest = null) {
    if (!this._ok()) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    const t0 = ctx.currentTime + when;
    o.frequency.setValueAtTime(Math.max(1, freq), t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(pos(gain), t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    o.connect(g).connect(dest || this.master);
    o.start(t0);
    o.stop(t0 + t + 0.02);
    this._reap(o, g);
  }

  /**
   * Filtered noise burst. opts: { type, q, when, sweepTo, kind, dest, attack }
   * sweepTo glides the filter cutoff across the burst — that is what turns hiss
   * into a spray can or a splash.
   */
  _noise(t, gain, freq, opts = {}) {
    if (!this._ok()) return;
    const ctx = this.ctx;
    const kind = opts.kind || 'white';
    const buf = this._buf(kind);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.Q.value = opts.q == null ? 1 : opts.q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + (opts.when || 0);
    f.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (opts.sweepTo) {
      f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), t0 + t);
    }
    const atk = opts.attack || 0.002;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(pos(gain), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    src.connect(f).connect(g).connect(opts.dest || this.master);
    const off = Math.random() * (buf.duration - t - 0.05);
    src.start(t0, Math.max(0, off), t + 0.05);
    this._reap(src, f, g);
  }

  /** Persistent beds: lobby murmur and the vacuum motor, both parked at zero. */
  _buildBeds() {
    const ctx = this.ctx;
    // crowd murmur — brown noise through a vowel-ish bandpass, plus a whisper of
    // high clatter so it reads as "people and luggage" not "wind".
    const mSrc = ctx.createBufferSource();
    mSrc.buffer = this._buf('brown');
    mSrc.loop = true;
    const mBp = ctx.createBiquadFilter();
    mBp.type = 'bandpass';
    mBp.frequency.value = 420;
    mBp.Q.value = 0.55;
    const clat = ctx.createBufferSource();
    clat.buffer = this._buf('white');
    clat.loop = true;
    const cHp = ctx.createBiquadFilter();
    cHp.type = 'highpass';
    cHp.frequency.value = 2400;
    const cG = ctx.createGain();
    cG.gain.value = 0.012;
    this._busyGain = ctx.createGain();
    this._busyGain.gain.value = 0;
    mSrc.connect(mBp).connect(this._busyGain);
    clat.connect(cHp).connect(cG).connect(this._busyGain);
    this._busyGain.connect(this.master);
    mSrc.start();
    clat.start();

    // vacuum — low motor drone plus roaring lowpassed noise
    const vSrc = ctx.createBufferSource();
    vSrc.buffer = this._buf('brown');
    vSrc.loop = true;
    const vLp = ctx.createBiquadFilter();
    vLp.type = 'lowpass';
    vLp.frequency.value = 340;
    vLp.Q.value = 3.2;
    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.value = 58;
    const mLp = ctx.createBiquadFilter();
    mLp.type = 'lowpass';
    mLp.frequency.value = 480;
    const motorG = ctx.createGain();
    motorG.gain.value = 0.35;
    this._vacGain = ctx.createGain();
    this._vacGain.gain.value = 0;
    vSrc.connect(vLp).connect(this._vacGain);
    motor.connect(mLp).connect(motorG).connect(this._vacGain);
    this._vacGain.connect(this.master);
    vSrc.start();
    motor.start();
  }

  _ramp(param, to, secs) {
    if (!this._ok() || !param) return;
    const now = this.ctx.currentTime;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(to, now + secs);
    } catch { /* dead ctx */ }
  }

  // --- front of house -------------------------------------------------------

  /** Call bell. Struck brass: inharmonic partials over a very long tail. */
  bell() {
    if (!this._ok()) return;
    const f = jitter(2244, 0.01);
    this._noise(0.012, 0.30, 5200, { type: 'highpass', q: 0.7 }); // hammer click
    this._ping(f, 2.6, 0.100);
    this._ping(f * 1.0034, 2.4, 0.090);       // detuned twin: slow shimmer beat
    this._ping(f * 1.503, 1.5, 0.045);
    this._ping(f * 2.617, 0.9, 0.028);
    this._ping(f * 3.94, 0.45, 0.016);
    this._ping(f * 0.501, 1.8, 0.030);        // body ring under the strike
  }

  /** Desk phone. Two bursts; 440+480 beat against each other into the warble. */
  phone() {
    if (!this._ok()) return;
    for (const at of [0, 0.72]) {
      for (const f of [440, 480]) {
        this._osc('triangle', f, f, 0.42, 0.075, at);
        this._osc('sine', f * 2, f * 2, 0.42, 0.022, at);
      }
      this._noise(0.42, 0.010, 3000, { q: 0.8, when: at }); // bell-clapper rattle
    }
  }

  /** Elevator arrival: soft descending two-note mallet, G5 down to C5. */
  ding() {
    if (!this._ok()) return;
    this._ping(hz(79), 1.1, 0.085, 0, 'sine');
    this._ping(hz(79) * 2.01, 0.5, 0.022, 0, 'sine');
    this._ping(hz(72), 1.6, 0.085, 0.30, 'sine');
    this._ping(hz(72) * 2.01, 0.7, 0.024, 0.30, 'sine');
    this._ping(hz(72) * 3.02, 0.35, 0.010, 0.30, 'sine');
  }

  /** Room door: dull body thunk, then the latch tongue clicking home. */
  door() {
    if (!this._ok()) return;
    this._noise(0.20, 0.34, 170, { type: 'lowpass', q: 1.1 });
    this._osc('sine', 96, 44, 0.19, 0.30);
    this._noise(0.03, 0.16, 1900, { q: 3.5, when: 0.035 });
    this._noise(0.008, 0.12, 4600, { type: 'highpass', q: 0.7, when: 0.055 });
  }

  /** Keycard reader: accepted beep-beep, then the deadbolt clunk. */
  keycard() {
    if (!this._ok()) return;
    this._osc('square', 2093, 2093, 0.045, 0.045, 0);
    this._osc('square', 2793, 2793, 0.055, 0.045, 0.10);
    this._noise(0.11, 0.26, 240, { type: 'lowpass', q: 1.4, when: 0.20 });
    this._osc('sine', 130, 62, 0.12, 0.18, 0.20);
  }

  // --- housekeeping ---------------------------------------------------------

  /** Trigger spray: hiss with the cutoff falling as the bottle pressure drops. */
  spray() {
    if (!this._ok()) return;
    this._noise(0.02, 0.10, 900, { q: 2.2 }); // trigger snap
    this._noise(0.34, 0.20, 5400, { type: 'bandpass', q: 0.9, sweepTo: 1500, attack: 0.012, when: 0.015 });
    this._noise(0.22, 0.06, 8000, { type: 'highpass', q: 0.7, when: 0.02 });
  }

  /** Upright vacuum. Toggled bed — ramped so it never clicks on or off. */
  vacuum(on) {
    this._vacOn = !!on;
    if (!this._ok() || !this._vacGain) return;
    this._ramp(this._vacGain.gain, this._vacOn ? 0.16 : 0, this._vacOn ? 0.30 : 0.45);
  }

  /** Maintenance: three taps, never quite evenly spaced or equally hard. */
  hammer() {
    if (!this._ok()) return;
    let at = 0;
    for (let i = 0; i < 3; i++) {
      const v = jitter(1, 0.22);
      this._noise(0.045, 0.26 * v, jitter(2500, 0.18), { q: 2.4, when: at });
      this._ping(jitter(1430, 0.12), 0.14, 0.055 * v, at, 'triangle');
      this._osc('sine', jitter(185, 0.12), 88, 0.10, 0.16 * v, at);
      at += 0.15 + Math.random() * 0.09;
    }
  }

  // --- money ----------------------------------------------------------------

  /** Register: drawer clunk, then two bright partials ringing over the top. */
  cash() {
    if (!this._ok()) return;
    this._noise(0.09, 0.34, 430, { type: 'lowpass', q: 1.2 });
    this._osc('sine', 150, 70, 0.11, 0.22);
    this._ping(1568, 0.85, 0.075, 0.03);
    this._ping(1568 * 1.004, 0.80, 0.060, 0.03);
    this._ping(2637, 0.65, 0.055, 0.09);
    this._ping(3136, 0.35, 0.026, 0.09);
    this._noise(0.16, 0.10, 2100, { q: 0.8, sweepTo: 900, when: 0.20 }); // drawer slide
  }

  /** A tip hitting the counter. */
  coin() {
    if (!this._ok()) return;
    this._ping(jitter(1760, 0.03), 0.10, 0.070, 0, 'triangle');
    this._ping(jitter(2637, 0.03), 0.22, 0.055, 0.045, 'triangle');
    this._noise(0.05, 0.07, 6200, { type: 'highpass', q: 0.7, when: 0.045 });
  }

  // --- interface ------------------------------------------------------------

  chime() {
    if (!this._ok()) return;
    this._osc('triangle', 1046, 1046, 0.09, 0.075);
    this._osc('triangle', 1568, 1568, 0.22, 0.075, 0.07);
  }

  click() {
    if (!this._ok()) return;
    this._noise(0.010, 0.13, 3800, { type: 'highpass', q: 0.7 });
    this._osc('sine', 1250, 900, 0.025, 0.035);
  }

  /** Rejected: flat, buzzy, gated twice so it sounds like a machine saying no. */
  nope() {
    if (!this._ok()) return;
    for (const at of [0, 0.13]) {
      this._osc('square', 148, 118, 0.10, 0.075, at);
      this._osc('sawtooth', 74, 62, 0.10, 0.045, at);
    }
  }

  /** Star rating up: F major arpeggio, last note held with a fifth on top. */
  fanfare() {
    if (!this._ok()) return;
    const notes = [65, 69, 72, 77];
    notes.forEach((n, i) => {
      const at = i * 0.11;
      const long = i === notes.length - 1;
      this._ping(hz(n), long ? 1.5 : 0.42, 0.085, at, 'triangle');
      this._ping(hz(n) * 2, long ? 1.1 : 0.28, 0.030, at, 'sine');
    });
    this._ping(hz(84), 1.6, 0.045, 0.44, 'sine');  // C6 sparkle over the last F
    this._ping(hz(89), 1.3, 0.022, 0.48, 'sine');
    this._noise(0.55, 0.045, 5000, { type: 'highpass', q: 0.7, attack: 0.18, when: 0.34 });
  }

  /** Pool. Rising bloop for the body of water, hiss for the spray coming down. */
  splash() {
    if (!this._ok()) return;
    this._osc('sine', 380, 1150, 0.13, 0.16);
    this._noise(0.30, 0.24, 700, { type: 'bandpass', q: 0.6, sweepTo: 3400, attack: 0.008 });
    this._noise(0.55, 0.10, 5200, { type: 'highpass', q: 0.7, when: 0.10 }); // droplets
    this._osc('sine', 190, 120, 0.24, 0.09, 0.02);
  }

  // --- beds -----------------------------------------------------------------

  /** 0..1 crowd murmur for a busy lobby. */
  setBusy(level) {
    this._busy = clamp01(level);
    if (!this._ok() || !this._busyGain) return;
    this._ramp(this._busyGain.gain, this._busy * 0.10, 0.9);
  }

  // --- muzak ----------------------------------------------------------------

  /**
   * The lounge bed. A scheduler wakes every TICK_MS and fills LOOKAHEAD seconds
   * of bars ahead of ctx.currentTime, so nothing depends on timer accuracy.
   * Turning it off clears the timer and stops every note already queued.
   */
  muzak(on) {
    if (on) {
      if (this._muzakOn) return;
      // no context yet: remember, and ensure() will start it on the first gesture
      if (!this.ensure() || !this._ok()) { this._muzakWant = true; return; }
      this._muzakOn = true;
      const ctx = this.ctx;
      // piped through ceiling speakers: no deep bass, no air on top
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 95;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3000;
      lp.Q.value = 0.6;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, ctx.currentTime);
      out.gain.linearRampToValueAtTime(MUZAK_GAIN, ctx.currentTime + 1.6);
      hp.connect(lp).connect(out).connect(this.master);
      this._muzakOut = hp;
      this._muzakBus = out;
      this._muzakChain = [hp, lp, out];
      this._muzakVoices = [];
      this._muzakBar = 0;
      this._muzakAt = ctx.currentTime + 0.12;
      this._muzakGen++;
      const gen = this._muzakGen;
      this._muzakTimer = setInterval(() => {
        if (gen !== this._muzakGen) return;
        this._muzakTick();
      }, TICK_MS);
      this._muzakTick();
      return;
    }

    this._muzakWant = false;
    if (!this._muzakOn) return;
    this._muzakOn = false;
    this._muzakGen++;
    if (this._muzakTimer != null) { clearInterval(this._muzakTimer); this._muzakTimer = null; }
    const voices = this._muzakVoices;
    const chain = this._muzakChain || [];
    const bus = this._muzakBus;
    this._muzakVoices = [];
    this._muzakOut = null;
    this._muzakBus = null;
    this._muzakChain = null;
    if (!this._ok()) return;
    const ctx = this.ctx;
    const off = ctx.currentTime + 0.7;
    try {
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(0.0001, off);
    } catch { /* dead ctx */ }
    // kill queued notes too — a note scheduled to start after its stop time
    // never sounds, so nothing keeps firing once the bed is off
    for (const v of voices) {
      try { v.gain.gain.cancelScheduledValues(ctx.currentTime); } catch { /* ignore */ }
      try { v.node.stop(off); } catch { /* already stopped */ }
    }
    setTimeout(() => {
      for (const v of voices) { try { v.node.disconnect(); v.gain.disconnect(); } catch { /* gone */ } }
      for (const n of chain) { try { n.disconnect(); } catch { /* gone */ } }
    }, 900);
  }

  _muzakTick() {
    if (!this._muzakOn || !this._ok() || !this._muzakOut) return;
    const ctx = this.ctx;
    // A backgrounded tab throttles setInterval to a crawl while ctx.currentTime
    // keeps running, so _muzakAt can wake up far behind the clock. Never try to
    // play the missed bars: every one of them would start immediately and land
    // as a single clipped wall of oscillators. Drop them and resync to the next
    // bar line, keeping the bar count in step so the progression stays where it
    // would have been.
    if (this._muzakAt < ctx.currentTime) {
      const missed = Math.ceil((ctx.currentTime - this._muzakAt) / BAR);
      this._muzakAt += missed * BAR;
      this._muzakBar += missed;
    }
    const until = ctx.currentTime + LOOKAHEAD;
    let guard = 0;
    while (this._muzakAt < until && guard++ < 8) {
      this._muzakScheduleBar(this._muzakAt, this._muzakBar);
      this._muzakAt += BAR;
      this._muzakBar++;
    }
    const now = ctx.currentTime;
    this._muzakVoices = this._muzakVoices.filter((v) => {
      if (v.end > now) return true;
      try { v.node.disconnect(); v.gain.disconnect(); } catch { /* gone */ }
      return false;
    });
  }

  /** One bar: pad, bass, a plucked comp on the off-beats, brush, lazy top line. */
  _muzakScheduleBar(t0, bar) {
    const ch = pick(PROG, bar);

    // sustained pad, voices staggered by a few ms so the attack is not a wall
    ch.voices.forEach((n, i) => {
      this._mVoice('triangle', n, t0 + i * 0.014, BAR * 0.96, 0.055, i % 2 ? 6 : -6, 0.35);
    });

    // upright bass: root on 1, fifth or octave on 3
    this._mVoice('sine', ch.bass, t0, BEAT * 1.8, 0.20, 0, 0.02);
    this._mVoice('sine', ch.bass + (bar % 2 ? 7 : 12), t0 + BEAT * 2, BEAT * 1.4, 0.13, 0, 0.02);

    // electric piano comp, pushed behind the beat
    for (const b of [1.55, 3.05]) {
      ch.voices.slice(1).forEach((n, i) => {
        this._mVoice('sine', n + 12, t0 + BEAT * b + i * 0.008, BEAT * 0.9, 0.030, 0, 0.006);
      });
    }

    // brushes on 2 and 4, barely there
    for (const b of [1, 3]) {
      this._noise(0.07, 0.020, 7000, {
        type: 'highpass', q: 0.7, when: (t0 - this.ctx.currentTime) + BEAT * b, dest: this._muzakOut,
      });
    }

    // top line: two notes a bar, sometimes only one, never in a hurry
    const spots = [0.5, 2.5];
    spots.forEach((b, k) => {
      if (k === 1 && Math.random() < 0.35) return;
      const n = pick(ch.mel, bar * 2 + k + (Math.random() < 0.3 ? 1 : 0));
      const at = t0 + BEAT * b;
      this._mVoice('triangle', n, at, BEAT * 1.3, 0.048, -4, 0.06);
      this._mVoice('triangle', n, at + 0.01, BEAT * 1.2, 0.036, 7, 0.06);
    });
  }

  _mVoice(type, midi, at, dur, gain, detune = 0, attack = 0.05) {
    if (!this._ok() || !this._muzakOut) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = hz(midi);
    try { o.detune.value = detune; } catch { /* no detune */ }
    const a = Math.min(attack, dur * 0.4);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(pos(gain), at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this._muzakOut);
    o.start(at);
    o.stop(at + dur + 0.05);
    this._muzakVoices.push({ node: o, gain: g, end: at + dur + 0.1 });
  }
}

export const sfx = new Sfx();
