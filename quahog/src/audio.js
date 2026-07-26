// All sound is synthesised on the fly: a big-band-ish street cue, a V8 that
// tracks the throttle, cartoon bonks, and the harp that means a cutaway.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engine = null;
    this.music = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.musicBus.connect(this.master);
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  _env(node, t0, dur, peak = 0.2, attack = 0.008) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g).connect(this.master);
    return g;
  }

  tone(type, f0, f1, dur, peak = 0.18, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    this._env(o, t0, dur, peak);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  noise(dur, peak = 0.25, freq = 1200, when = 0, q = 1, type = 'bandpass') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  // ---------------------------------------------------------------- one-shots
  ui() { this.tone('triangle', 660, 990, 0.09, 0.14); }
  back() { this.tone('triangle', 660, 400, 0.1, 0.12); }
  coin() { this.tone('square', 1200, 1800, 0.07, 0.10); this.tone('square', 1800, 2400, 0.09, 0.08, 0.06); }
  bonk() { this.tone('sine', 420, 90, 0.18, 0.28); this.noise(0.08, 0.2, 500, 0, 0.8); }
  crash() {
    this.noise(0.35, 0.45, 900, 0, 0.6);
    this.noise(0.5, 0.25, 2600, 0.02, 0.5, 'highpass');
    this.tone('sine', 160, 50, 0.3, 0.3);
  }
  punch() { this.noise(0.09, 0.35, 320, 0, 1.2); this.tone('square', 200, 70, 0.12, 0.16); }
  smash() { this.noise(0.28, 0.3, 1800, 0, 0.4, 'highpass'); this.tone('square', 300, 80, 0.14, 0.14); }
  horn() { this.tone('sawtooth', 392, 392, 0.42, 0.10); this.tone('sawtooth', 494, 494, 0.42, 0.08); }
  skid() { this.noise(0.32, 0.14, 2400, 0, 1.6, 'bandpass'); }
  siren() {
    for (let i = 0; i < 2; i++) {
      this.tone('sawtooth', 700, 1150, 0.32, 0.05, i * 0.34);
      this.tone('sawtooth', 1150, 700, 0.32, 0.05, i * 0.34 + 0.17);
    }
  }
  jump() { this.tone('square', 300, 700, 0.12, 0.12); }
  land() { this.noise(0.1, 0.18, 260, 0, 0.9); }
  ray() { this.tone('sawtooth', 1400, 180, 0.25, 0.16); this.noise(0.2, 0.1, 2400, 0, 0.7, 'highpass'); }
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.tone('triangle', n, n, 0.22, 0.16, i * 0.11));
  }
  fail() {
    [392, 349, 294, 233].forEach((n, i) => this.tone('sawtooth', n, n, 0.26, 0.13, i * 0.13));
  }
  /** The harp glissando that means we are cutting away to something stupid. */
  harp() {
    if (!this.ctx) return;
    const scale = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
    scale.forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.09, i * 0.045));
  }
  whoosh() { this.noise(0.5, 0.2, 700, 0, 0.5, 'bandpass'); }

  /** Voice blip: a short pitched chirp per line, per character. */
  blip(pitch = 140, len = 0.7) {
    if (!this.ctx) return;
    const n = Math.max(2, Math.round(len * 9));
    for (let i = 0; i < n; i++) {
      const f = pitch * (0.85 + Math.random() * 0.4);
      this.tone('square', f, f * 1.06, 0.05, 0.035, i * (len / n));
    }
  }

  // ---------------------------------------------------------------- engine
  startEngine() {
    if (!this.ensure() || this.engine) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 30;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    osc.connect(lp);
    sub.connect(lp);
    lp.connect(g).connect(this.master);
    osc.start(); sub.start();
    this.engine = { osc, sub, g, lp };
  }

  stopEngine() {
    if (!this.engine) return;
    const { osc, sub, g } = this.engine;
    try {
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      setTimeout(() => { try { osc.stop(); sub.stop(); } catch { /* gone */ } }, 260);
    } catch { /* never mind */ }
    this.engine = null;
  }

  engineState(speed, maxSpeed, throttle) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const r = Math.min(1, Math.abs(speed) / Math.max(1, maxSpeed));
    const rev = 0.22 + r * 0.78 + (throttle > 0 ? 0.12 : 0);
    this.engine.osc.frequency.setTargetAtTime(52 + rev * 150, t, 0.08);
    this.engine.sub.frequency.setTargetAtTime(26 + rev * 74, t, 0.08);
    this.engine.lp.frequency.setTargetAtTime(400 + rev * 1500, t, 0.1);
    this.engine.g.gain.setTargetAtTime(0.035 + r * 0.05, t, 0.12);
  }

  // ----------------------------------------------------------------- music
  /** A looping street cue: walking bass, comping chords, a brass hit or two. */
  startMusic(mood = 'town') {
    if (!this.ensure() || this.music) return;
    const ctx = this.ctx;
    const bpm = mood === 'chase' ? 168 : mood === 'menu' ? 116 : 132;
    const beat = 60 / bpm;
    const bus = ctx.createGain();
    bus.gain.value = mood === 'chase' ? 0.5 : 0.34;
    bus.connect(this.musicBus);

    // ii–V–I with a cheeky flat-six: the show's brass never sits still either
    const PROG = mood === 'chase'
      ? [[110, 'min'], [116.5, 'min'], [123.5, 'dom'], [110, 'min']]
      : [[130.8, 'maj'], [174.6, 'maj'], [146.8, 'min'], [196, 'dom']];
    const CH = { maj: [0, 4, 7, 11], min: [0, 3, 7, 10], dom: [0, 4, 7, 10] };
    const semi = (f, n) => f * Math.pow(2, n / 12);

    let bar = 0;
    let stopped = false;
    const playBar = () => {
      if (stopped) return;
      const t0 = ctx.currentTime + 0.04;
      const [root, quality] = PROG[bar % PROG.length];
      const chord = CH[quality];
      // walking bass, one note a beat
      for (let b = 0; b < 4; b++) {
        const n = chord[(b === 3 ? 2 : b) % chord.length] + (b === 3 ? -5 : 0);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = semi(root / 2, n);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0 + b * beat);
        g.gain.linearRampToValueAtTime(0.20, t0 + b * beat + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + b * beat + beat * 0.9);
        o.connect(g).connect(bus);
        o.start(t0 + b * beat);
        o.stop(t0 + b * beat + beat);
      }
      // off-beat comp chords
      for (let b = 0; b < 4; b++) {
        const at = t0 + b * beat + beat * 0.5;
        for (const n of chord) {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = semi(root, n);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, at);
          g.gain.linearRampToValueAtTime(0.035, at + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, at + beat * 0.35);
          o.connect(g).connect(bus);
          o.start(at);
          o.stop(at + beat * 0.4);
        }
      }
      // brass stab at the top of every other bar
      if (bar % 2 === 0) {
        for (const n of chord) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = semi(root * 2, n);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.045, t0 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + beat * 0.8);
          o.connect(g).connect(bus);
          o.start(t0);
          o.stop(t0 + beat);
        }
      }
      // brushed hats
      for (let b = 0; b < 8; b++) {
        this.noise(0.05, b % 2 ? 0.02 : 0.035, 6000, b * beat * 0.5 + 0.04, 0.6, 'highpass');
      }
      bar++;
      this.music.timer = setTimeout(playBar, beat * 4 * 1000 - 60);
    };
    this.music = { bus, stop: () => { stopped = true; clearTimeout(this.music?.timer); }, mood };
    playBar();
  }

  stopMusic() {
    if (!this.music) return;
    this.music.stop();
    try {
      this.music.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      const bus = this.music.bus;
      setTimeout(() => bus.disconnect(), 900);
    } catch { /* fine */ }
    this.music = null;
  }

  setMusic(mood) {
    if (this.music?.mood === mood) return;
    this.stopMusic();
    this.startMusic(mood);
  }
}

export const sfx = new Sfx();
