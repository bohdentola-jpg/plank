// Shared WebAudio core: one AudioContext, mix buses, a generated reverb, and
// cached noise buffers. Everything in the game is synthesized — no audio files.
//
//   sources → musicBus ─┐
//   sources → sfxBus  ──┼→ duck (lowpass, used by pause) → master → limiter → out
//   sources → uiBus   ──┘            (uiBus skips the duck filter)
//   any node → reverbSend → convolver → master
//
// Call audio.unlock() from the first user gesture (key / click / pad button).

const listeners = [];

class AudioCore {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.volumes = { master: 0.85, music: 0.7, sfx: 0.9 };
    this._noise = {};
  }

  /** Create/resume the context. Safe to call repeatedly. Returns true when live. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
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

  _build(ctx) {
    this.ctx = ctx;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;
    this.limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(this.limiter);

    // pause/menu duck: a lowpass the music + sfx run through
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
    this.uiBus = ctx.createGain();
    this.uiBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.4, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.reverbReturn).connect(this.master);

    this.applyVolumes();
    this.ready = true;
    for (const fn of listeners) {
      try { fn(this); } catch (e) { console.error(e); }
    }
    listeners.length = 0;
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
    this.uiBus.gain.setTargetAtTime(Math.min(1, this.volumes.sfx * 0.9 + 0.1), t, 0.03);
  }

  /** Muffle music + sfx (pause menu, crash daze). amount 0 = clear, 1 = heavily muffled. */
  duck(amount, time = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 22000 * Math.pow(400 / 22000, Math.max(0, Math.min(1, amount)));
    this.duckFilter.frequency.cancelScheduledValues(t);
    this.duckFilter.frequency.setTargetAtTime(f, t, time / 3);
    this.duckGain.gain.setTargetAtTime(1 - amount * 0.35, t, time / 3);
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

export const audio = new AudioCore();
