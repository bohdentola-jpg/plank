// Synthesized Friday-night sound: crowd bed, whistle, hits, horn, UI chirps.
// Everything is generated — no audio assets.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.crowdGain = null;
    this.muted = false;
    this._excite = 0.25;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);
    // crowd bed: looped filtered noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.97 + w * 0.03; // brown-ish murmur
      data[i] = last * 6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 480;
    bp.Q.value = 0.5;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.05;
    src.connect(bp).connect(this.crowdGain).connect(this.master);
    src.start();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }

  crowd(excite) {
    if (!this.ctx) return;
    this._excite = Math.max(this._excite, excite);
    const target = 0.04 + this._excite * 0.22;
    this.crowdGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.crowdGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.18);
    this.crowdGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 4.5);
    this._excite *= 0.55;
  }

  _osc(type, f0, f1, t, gain = 0.2, when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    const t0 = ctx.currentTime + when;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + t);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + t + 0.02);
  }

  _noise(t, gain = 0.3, freq = 1200, when = 0, q = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const len = Math.ceil(ctx.sampleRate * t);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  whistle() {
    // pea whistle: warbling high tone
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 2350;
    lfo.frequency.value = 38;
    lfoG.gain.value = 240;
    lfo.connect(lfoG).connect(o.frequency);
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.13, t0);
    g.gain.setValueAtTime(0.13, t0 + 0.42);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
    o.connect(g).connect(this.master);
    o.start(t0); lfo.start(t0);
    o.stop(t0 + 0.6); lfo.stop(t0 + 0.6);
  }

  hike() { this._noise(0.09, 0.25, 900, 0, 0.8); this._osc('square', 220, 140, 0.1, 0.08); }
  thud() { this._noise(0.12, 0.5, 240, 0, 0.7); this._osc('sine', 110, 45, 0.16, 0.4); }
  catchPop() { this._noise(0.05, 0.3, 1800, 0, 1.2); }
  horn() {
    for (const f of [233, 311, 466]) this._osc('sawtooth', f, f * 0.985, 1.6, 0.09);
  }
  chime() { this._osc('triangle', 880, 1320, 0.12, 0.12); }
  back() { this._osc('triangle', 660, 440, 0.12, 0.12); }
  firstDown() { this._osc('triangle', 523, 784, 0.18, 0.12); }
  kickThump() { this._noise(0.08, 0.5, 300, 0, 0.8); this._osc('sine', 140, 60, 0.12, 0.3); }

  /** ~22s cinematic cue: low drone, building pulse, snare rolls, brass
   * swells, final stinger. Returns a stop() handle. */
  introScore() {
    if (!this.ensure()) return { stop() {} };
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(this.master);
    const t0 = ctx.currentTime + 0.05;
    const alive = [];
    const osc = (type, freq, from, to, g0, g1, detune = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq; o.detune.value = detune;
      g.gain.setValueAtTime(0.0001, t0 + from);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, g0), t0 + from + 0.6);
      g.gain.setValueAtTime(Math.max(0.0001, g0), t0 + to - 0.8);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, g1), t0 + to);
      o.connect(g).connect(out);
      o.start(t0 + from); o.stop(t0 + to + 0.1);
      alive.push(o);
    };
    // drone: D minor bed the whole way
    osc('sawtooth', 36.7, 0, 22, 0.05, 0.0001);          // D1
    osc('sawtooth', 73.4, 0, 22, 0.04, 0.0001, 8);       // D2
    osc('sine', 110, 0, 22, 0.05, 0.0001);               // A2
    // timpani pulse, accelerating
    const thud = (at, vol = 0.5, f = 73) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f, t0 + at);
      o.frequency.exponentialRampToValueAtTime(40, t0 + at + 0.28);
      g.gain.setValueAtTime(vol, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.5);
      o.connect(g).connect(out); o.start(t0 + at); o.stop(t0 + at + 0.55);
      alive.push(o);
    };
    let at = 1.2, gap = 1.6;
    while (at < 14) { thud(at); at += gap; gap = Math.max(0.42, gap * 0.86); }
    for (let i = 0; i < 8; i++) thud(14 + i * 0.5, 0.42);
    // snare rolls into the hits
    const roll = (from, dur, vol) => {
      const len = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (i / len);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
      const g = ctx.createGain(); g.gain.value = vol;
      s.connect(f).connect(g).connect(out); s.start(t0 + from);
    };
    roll(4.2, 1.6, 0.10); roll(9.0, 1.8, 0.13); roll(15.6, 2.2, 0.17);
    // brass swells: detuned saw stacks rising at section changes (D, F, A→D)
    const swell = (from, dur, freqs, vol) => {
      for (const f of freqs) {
        osc('sawtooth', f, from, from + dur, vol, 0.0001, -6);
        osc('sawtooth', f * 1.005, from, from + dur, vol, 0.0001, 6);
      }
    };
    swell(6, 4, [146.8, 220, 293.7], 0.035);          // D minor
    swell(11, 4, [174.6, 261.6, 349.2], 0.045);       // F major lift
    swell(16, 5.5, [146.8, 220, 293.7, 440], 0.06);   // home, bigger
    // final stinger + cymbal wash at ~18s
    thud(18, 0.8, 90); thud(18.06, 0.7, 60);
    roll(18, 2.5, 0.12);
    const stop = () => {
      try {
        out.gain.cancelScheduledValues(ctx.currentTime);
        out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
        out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        setTimeout(() => { try { alive.forEach((o) => o.stop()); out.disconnect(); } catch {} }, 700);
      } catch { /* already done */ }
    };
    return { stop };
  }
}

export const sfx = new Sfx();
