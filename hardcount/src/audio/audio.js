// Shared WebAudio core: one AudioContext, mix buses, generated reverbs, and
// cached noise buffers. Everything in the game is synthesized — no audio files.
//
//   sources → musicBus ─┐
//   sources → sfxBus  ──┼→ duck (lowpass, used by pause) → master → limiter → ceiling → out
//   sources → crowdBus ─┤            (uiBus skips the duck filter)
//   space ─→ venue convolver ─┘      (the stadium / dome / park / bedroom acoustic)
//   sources → uiBus ───────────────→ master
//   any node → reverbSend → plate convolver → master
//
// `space` is the venue's own acoustic — slap echoes off the far stands and a
// dark tail outdoors, a long dense wash in a dome — shared by the crowd, the
// band, the PA and the field sounds. `setSpace(kind)` crossfades between them.
// The ceiling is a soft clipper whose curve never exceeds −1.2 dBFS, so no
// combination of sounds can peak above −1 dBFS.
//
// Call audio.unlock() from the first user gesture (key / click / pad button).
// Every other module is safe to call before that: they no-op (or remember the
// request) until the context exists.

const listeners = [];

// venue acoustics: early reflections [s, gain], slap echoes off the far stands
// [s, gain], diffuse tail (RT60, onset, darkening), and the return level
const SPACES = {
  stadium: {
    len: 3.4, rt: 2.4, onset: 0.05, tail: 0.55, lp0: 6500, lp1: 1300, ret: 0.42,
    early: [[0.019, 0.32], [0.031, 0.26], [0.044, 0.3], [0.058, 0.2], [0.077, 0.18], [0.095, 0.14]],
    slaps: [[0.17, 0.34], [0.265, 0.26], [0.38, 0.19], [0.52, 0.12], [0.68, 0.07]],
  },
  dome: {
    len: 5, rt: 4.2, onset: 0.02, tail: 1, lp0: 8000, lp1: 2200, ret: 0.5,
    early: [[0.009, 0.3], [0.016, 0.28], [0.024, 0.3], [0.033, 0.25], [0.046, 0.22], [0.061, 0.2], [0.08, 0.18]],
    slaps: [[0.12, 0.18], [0.24, 0.12], [0.36, 0.08]],
  },
  park: {
    len: 1.6, rt: 0.75, onset: 0.02, tail: 0.18, lp0: 7000, lp1: 2500, ret: 0.3,
    early: [[0.011, 0.35], [0.027, 0.18]],
    slaps: [[0.145, 0.3], [0.31, 0.1]],
  },
  bedroom: {
    len: 0.7, rt: 0.34, onset: 0.002, tail: 0.7, lp0: 9000, lp1: 3800, ret: 0.24,
    early: [[0.0035, 0.5], [0.0062, 0.42], [0.0094, 0.36], [0.013, 0.3], [0.018, 0.22], [0.025, 0.16]],
    slaps: [],
  },
};

class AudioCore {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.volumes = { master: 0.85, music: 0.7, sfx: 0.9, crowd: 0.85 };
    this.spaceKind = 'stadium';
    this._noise = {};
  }

  /** Create/resume the context. Safe to call repeatedly. Returns true when live. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume().catch(() => {});
      return true;
    }
    let ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    } catch {
      return false;
    }
    this._build(ctx);
    return true;
  }

  /** Test hook: run the whole audio graph on a given (e.g. Offline) context. */
  useContext(ctx) {
    this._noise = {};
    this._build(ctx);
  }

  /** True for OfflineAudioContext (tests): no timers, no idle warm-up. */
  get offline() {
    return !!this.ctx && typeof this.ctx.startRendering === 'function';
  }

  _build(ctx) {
    this.ctx = ctx;

    // final stage: a soft clipper that can't exceed −1.2 dBFS
    this.ceiling = ctx.createWaveShaper();
    this.ceiling.curve = ceilingCurve();
    this.ceiling.oversample = 'none';
    this.ceiling.connect(ctx.destination);
    this._meter = null;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;
    this.limiter.connect(this.ceiling);

    this.master = ctx.createGain();
    this.master.connect(this.limiter);

    // pause/menu duck: a lowpass the music + sfx + crowd run through
    this.duckFilter = ctx.createBiquadFilter();
    this.duckFilter.type = 'lowpass';
    this.duckFilter.frequency.value = 22000;
    this.duckFilter.Q.value = 0.5;
    this.duckGain = ctx.createGain();
    this.duckFilter.connect(this.duckGain).connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.duckFilter);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.duckFilter);
    this.crowdBus = ctx.createGain();
    this.crowdBus.connect(this.duckFilter);
    this.uiBus = ctx.createGain();
    this.uiBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.4, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.reverbReturn).connect(this.master);

    // venue acoustic: one convolver per space, built on first use, crossfaded
    this.space = ctx.createGain();
    this._spaces = {};
    this._setSpaceNow(this.spaceKind);

    this.applyVolumes();
    this.ready = true;
    const fns = listeners.splice(0);
    for (const fn of fns) {
      try { fn(this); } catch (e) { console.error(e); }
    }
  }

  /** Run fn(core) once the context exists (immediately if it already does). */
  onReady(fn) {
    if (this.ready) fn(this);
    else listeners.push(fn);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.volumes.music, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.03);
    this.crowdBus.gain.setTargetAtTime(this.volumes.crowd ?? 0.85, t, 0.03);
    this.uiBus.gain.setTargetAtTime(Math.min(1, this.volumes.sfx * 0.9 + 0.1), t, 0.03);
  }

  /** Muffle music + sfx + crowd (pause menu). amount 0 = clear, 1 = heavily muffled. */
  duck(amount, time = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 22000 * Math.pow(400 / 22000, Math.max(0, Math.min(1, amount)));
    this.duckFilter.frequency.cancelScheduledValues(t);
    this.duckFilter.frequency.setTargetAtTime(f, t, time / 3);
    this.duckGain.gain.setTargetAtTime(1 - amount * 0.35, t, time / 3);
  }

  /**
   * Venue acoustic for everything that sends to `audio.space`:
   * 'stadium' | 'dome' | 'park' | 'bedroom' (null keeps the current one).
   * Remembered before unlock.
   */
  setSpace(kind) {
    if (!SPACES[kind] || kind === this.spaceKind) return;
    this.spaceKind = kind;
    if (this.ctx) this._setSpaceNow(kind);
  }

  _setSpaceNow(kind) {
    const ctx = this.ctx, t = ctx.currentTime;
    let s = this._spaces[kind];
    if (!s) {
      const def = SPACES[kind];
      s = { conv: ctx.createConvolver(), send: ctx.createGain(), ret: ctx.createGain() };
      s.conv.buffer = this._spaceIR(def);
      s.send.gain.value = 0;
      s.ret.gain.value = def.ret;
      s.send.connect(s.conv).connect(s.ret).connect(this.duckFilter);
      this._spaces[kind] = s;
    }
    if (!s.linked) { this.space.connect(s.send); s.linked = true; }
    for (const [k, o] of Object.entries(this._spaces)) {
      o.send.gain.cancelScheduledValues(t);
      o.send.gain.setTargetAtTime(k === kind ? 1 : 0, t, 0.25);
      // unhook faded-out spaces so their convolvers stop running
      if (k !== kind && o.linked && !this.offline && typeof setTimeout === 'function') {
        const ctx0 = ctx;
        setTimeout(() => {
          if (this.ctx === ctx0 && this.spaceKind !== k && o.linked) { this.space.disconnect(o.send); o.linked = false; }
        }, 2500);
      }
    }
  }

  _spaceIR(d) {
    const ctx = this.ctx, sr = ctx.sampleRate;
    const len = Math.floor(sr * d.len);
    const buf = ctx.createBuffer(2, len, sr);
    let seed = 0x1234567;
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296) * 2 - 1; };
    for (let ch = 0; ch < 2; ch++) {
      const o = buf.getChannelData(ch);
      // diffuse tail: noise, exponential decay, a one-pole lowpass that darkens
      let lp = 0;
      const k60 = 6.91 / d.rt;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const fc = d.lp0 * Math.pow(d.lp1 / d.lp0, Math.min(1, t / d.rt));
        const a = Math.exp(-2 * Math.PI * fc / sr);
        lp = lp * a + rnd() * (1 - a);
        const on = t < d.onset ? 0 : Math.min(1, (t - d.onset) / (d.onset * 2 + 0.01));
        o[i] = lp * Math.exp(-k60 * t) * on * d.tail * 2.2;
      }
      // early reflections and slap echoes: short smeared bursts, darker with distance
      const refl = (at, g, smear, cut) => {
        const i0 = Math.floor(at * sr);
        const n = Math.floor(smear * sr * 5);
        const a = Math.exp(-2 * Math.PI * cut / sr);
        let y = 0;
        for (let j = 0; j < n && i0 + j < len; j++) {
          const x = (j === 0 ? 4 : 0) + rnd() * Math.exp(-j / (smear * sr)) * 0.8;
          y = y * a + x * (1 - a);
          o[i0 + j] += y * g;
        }
      };
      for (const [at, g] of d.early) refl(at * (1 + 0.06 * rnd()), g * (0.85 + 0.15 * rnd()), 0.0015, 6000);
      for (const [at, g] of d.slaps) refl(at + (ch ? 0.009 : 0) * rnd(), g, 0.006, 3200 - at * 2400);
      for (let i = 0; i < 48 && i < len; i++) o[i] *= i / 48;
    }
    return buf;
  }

  /** Lazily created AnalyserNode on the final output (meters, QA screens). */
  meter() {
    if (!this.ctx) return null;
    if (!this._meter) {
      this._meter = this.ctx.createAnalyser();
      this._meter.fftSize = 2048;
      this._meter.smoothingTimeConstant = 0.6;
      this.ceiling.connect(this._meter);
    }
    return this._meter;
  }

  /**
   * Cached looping noise buffer. color: 'white' | 'pink' | 'brown'.
   * Two seconds, stereo-decorrelated, normalized to ~±1.
   */
  noise(color = 'white') {
    if (this._noise[color]) return this._noise[color];
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (color === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else if (color === 'brown') {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else {
          d[i] = w;
        }
      }
      // fade the loop seam
      const fade = 256;
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        d[i] *= k;
        d[len - 1 - i] *= k;
      }
    }
    this._noise[color] = buf;
    return buf;
  }

  /** Start a looping noise source routed into `dest`. Returns the source node. */
  noiseSource(color, dest) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise(color);
    src.loop = true;
    src.loopStart = Math.random();
    src.connect(dest);
    src.start(this.ctx.currentTime, Math.random() * 1.5);
    return src;
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // darker tail: one-pole lowpass whose cutoff falls over time
        const a = 0.35 + 0.6 * t;
        lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
        d[i] = lp * Math.pow(1 - t, decay) * (i < 40 ? i / 40 : 1);
      }
    }
    return buf;
  }
}

// linear to ±0.7, then a tanh knee that tops out at 0.871 (−1.2 dBFS) at full scale
function ceilingCurve(n = 4096) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= 0.7 ? a : 0.7 + 0.185 * Math.tanh((a - 0.7) / 0.185));
  }
  return c;
}

export const audio = new AudioCore();
