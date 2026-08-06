// All sound is synthesized WebAudio — wind and rain beds, footsteps by
// surface, hoofbeats, discovery bells, thunder that arrives late like real
// thunder, crickets after dark, birdsong after dawn, and a slow generative
// pad that changes scale with the time of day. No audio files.

class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._musicT = 0;
    this._cricketT = 0;
    this._birdT = 2;
    this._night = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    // one lowpass on the master doubles as the underwater muffle
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 19000;
    this.master.connect(this.muffle).connect(ctx.destination);

    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const bed = (freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return g;
    };
    this.windGain = bed(320, 0.5);
    this.rainGain = bed(2400, 0.3);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.1);
  }

  setUnderwater(u) {
    if (!this.ctx) return;
    this.muffle.frequency.setTargetAtTime(u ? 500 : 19000, this.ctx.currentTime, 0.15);
  }

  _env(node, t0, a, peak, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g).connect(this.master);
    return g;
  }

  _burst(freq, q, peak, dur, type = 'bandpass') {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq * (0.9 + Math.random() * 0.2);
    f.Q.value = q;
    src.connect(f);
    this._env(f, t0, 0.005, peak, dur);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  _tone(freq, peak, dur, type = 'sine', a = 0.01, when = 0) {
    if (!this.ctx) return null;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    this._env(o, t0, a, peak, dur);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
    return o;
  }

  // ---- world beds ------------------------------------------------------------
  update(dt, { wind = 0, rain = 0, night = 0 } = {}) {
    this._night = night;
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.03 + wind * 0.12, t, 0.4);
    this.rainGain.gain.setTargetAtTime(rain * 0.14, t, 0.7);

    // crickets
    this._cricketT -= dt;
    if (night > 0.5 && this._cricketT <= 0) {
      this._cricketT = 0.5 + Math.random() * 1.4;
      const base = 3800 + Math.random() * 900;
      for (let i = 0; i < 3; i++) this._tone(base, 0.012, 0.04, 'sine', 0.005, i * 0.07);
    }
    // birdsong
    this._birdT -= dt;
    if (night < 0.3 && this._birdT <= 0) {
      this._birdT = 3 + Math.random() * 7;
      const f0 = 2100 + Math.random() * 1200;
      const o = this._tone(f0, 0.02, 0.22, 'sine', 0.02);
      if (o) {
        o.frequency.setValueAtTime(f0, this.ctx.currentTime);
        o.frequency.linearRampToValueAtTime(f0 * (0.8 + Math.random() * 0.5), this.ctx.currentTime + 0.18);
      }
    }
    // generative pad
    this._musicT -= dt;
    if (this._musicT <= 0) {
      this._musicT = 9 + Math.random() * 5;
      this._padChord();
    }
  }

  _padChord() {
    const day = [130.8, 164.8, 196.0, 293.7, 220.0]; // C lydian-ish
    const nightScale = [110.0, 130.8, 164.8, 196.0, 246.9]; // A minor
    const scale = this._night > 0.5 ? nightScale : day;
    const n = 3 + (Math.random() * 2 | 0);
    const used = new Set();
    for (let i = 0; i < n; i++) {
      let idx = (Math.random() * scale.length) | 0;
      if (used.has(idx)) continue;
      used.add(idx);
      const f = scale[idx] * (Math.random() < 0.3 ? 2 : 1);
      const t0 = this.ctx.currentTime + Math.random() * 1.5;
      const o = this.ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.003);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 850;
      o.connect(lp);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.022, t0 + 3.5);
      g.gain.linearRampToValueAtTime(0.0001, t0 + 10);
      lp.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + 10.5);
    }
  }

  // ---- one-shots ---------------------------------------------------------------
  step(surface) {
    const P = {
      grass: [520, 1.2, 0.05, 0.09],
      dirt: [380, 1.4, 0.055, 0.09],
      sand: [280, 1.0, 0.05, 0.12],
      rock: [1300, 2.5, 0.045, 0.06],
      snow: [900, 0.6, 0.05, 0.13],
      mud: [240, 1.1, 0.06, 0.14],
      water: [700, 0.8, 0.05, 0.12],
      jump: [460, 1.0, 0.06, 0.1],
    }[surface] || [520, 1.2, 0.05, 0.09];
    this._burst(P[0], P[1], P[2], P[3]);
  }

  splash() {
    this._burst(900, 0.6, 0.12, 0.4);
    this._burst(2400, 0.5, 0.05, 0.5);
  }

  hoof(intensity = 0.5) {
    this._burst(210, 1.5, 0.05 + intensity * 0.05, 0.08, 'lowpass');
  }

  whistle() {
    const o = this._tone(880, 0.07, 0.5, 'sine', 0.03);
    if (o) {
      const t = this.ctx.currentTime;
      o.frequency.setValueAtTime(880, t);
      o.frequency.linearRampToValueAtTime(1310, t + 0.18);
      o.frequency.linearRampToValueAtTime(1180, t + 0.42);
    }
  }

  discover() { // region banner
    [523, 659, 784].forEach((f, i) => this._tone(f, 0.05, 1.4, 'sine', 0.02, i * 0.13));
  }

  landmark() { // POI discovered
    [659, 880, 987, 1318].forEach((f, i) => this._tone(f, 0.05, 1.6, 'sine', 0.02, i * 0.11));
  }

  relic() {
    [880, 1174, 1568, 2093].forEach((f, i) => this._tone(f, 0.045, 0.5, 'triangle', 0.01, i * 0.06));
  }

  shrine() {
    [220, 330, 440, 554].forEach((f, i) => this._tone(f, 0.06, 3.2, i % 2 ? 'triangle' : 'sine', 0.4, i * 0.12));
    const o = this._tone(1760, 0.03, 2.6, 'sine', 0.8, 0.4);
    if (o) o.frequency.linearRampToValueAtTime(2200, this.ctx.currentTime + 2.6);
  }

  thunder(delay = 1) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.35;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(320, t0);
    f.frequency.exponentialRampToValueAtTime(60, t0 + 2.2);
    src.connect(f);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    f.connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + 2.6);
  }

  rest() {
    [392, 523, 659, 784].forEach((f, i) => this._tone(f, 0.045, 2.2, 'sine', 0.5, i * 0.35));
  }

  survey() {
    [740, 880, 1108].forEach((f, i) => this._tone(f, 0.05, 0.9, 'triangle', 0.02, i * 0.14));
  }

  ui() { this._tone(660, 0.04, 0.09, 'square', 0.005); }
}

export const sfx = new Sfx();
