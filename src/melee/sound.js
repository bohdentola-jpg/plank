// Every sound in the game, synthesized: impacts, UI chirps, the announcer, and
// a little chiptune sequencer with one written-out loop per stage. No samples,
// no files. All of it is created lazily inside ensure() so this module imports
// cleanly in node.

const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12);

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.8;
    this._chargeNode = null;
    this._lastVoice = 0;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) return false;
      this.ctx = new AC();
    } catch { return false; }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    // a touch of compression keeps the chunky hits from clipping the mix
    try {
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp).connect(this.ctx.destination);
    } catch {
      this.master.connect(this.ctx.destination);
    }
    return true;
  }

  resume() { try { this.ctx?.resume?.(); } catch { /* autoplay policy */ } }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  // ------------------------------------------------------------- primitives
  _osc(type, f0, f1, dur, gain = 0.2, when = 0, detune = 0) {
    if (!this.ensure()) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    const t0 = ctx.currentTime + when;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  _noise(dur, gain = 0.3, freq = 1200, when = 0, q = 1, type = 'bandpass') {
    if (!this.ensure()) return;
    const ctx = this.ctx;
    const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  // ------------------------------------------------------------------ hits
  /** kind: punch|slash|heavy|burn|zap|thwack|bonk — power 0..1 scales it. */
  hit(kind = 'punch', power = 0.5) {
    if (!this.ensure()) return;
    const p = Math.max(0.15, Math.min(1, power));
    switch (kind) {
      case 'slash':
        this._noise(0.1 + p * 0.06, 0.22 + p * 0.2, 2600 - p * 700, 0, 1.6, 'highpass');
        this._osc('sawtooth', 900 + p * 500, 260, 0.1, 0.06 * p);
        break;
      case 'heavy':
        this._noise(0.13, 0.4 + p * 0.3, 220, 0, 0.7);
        this._osc('sine', 150, 44, 0.22, 0.34 * p);
        this._osc('square', 90, 40, 0.16, 0.14 * p);
        break;
      case 'burn':
        this._noise(0.3, 0.24 * p, 900, 0, 0.5, 'lowpass');
        this._osc('sawtooth', 420, 110, 0.28, 0.1 * p);
        break;
      case 'zap':
        this._osc('square', 1400 + p * 900, 320, 0.11, 0.12 * p);
        this._osc('sawtooth', 700, 180, 0.1, 0.08 * p, 0.01);
        break;
      case 'thwack':
        this._noise(0.07, 0.34 + p * 0.24, 1100, 0, 1.1);
        this._osc('triangle', 320 + p * 260, 90, 0.12, 0.2 * p);
        break;
      case 'bonk':
        this._osc('square', 620, 180, 0.12, 0.16 * p);
        this._noise(0.05, 0.2, 2200, 0, 2);
        break;
      default:
        this._noise(0.05 + p * 0.03, 0.3 + p * 0.3, 700, 0, 0.9);
        this._osc('sine', 240 + p * 180, 70, 0.13, 0.24 * p);
    }
  }

  shieldHit(p = 0.5) {
    this._osc('sine', 300, 520, 0.14, 0.12 + p * 0.1);
    this._noise(0.08, 0.12, 1800, 0, 3);
  }

  shieldBreak() {
    this._noise(0.4, 0.4, 2400, 0, 0.6, 'highpass');
    for (let i = 0; i < 5; i++) this._osc('square', 1600 - i * 200, 300, 0.18, 0.08, i * 0.05);
    this._osc('sine', 90, 40, 0.5, 0.3);
  }

  grab() { this._noise(0.06, 0.24, 500, 0, 1.4); this._osc('triangle', 180, 300, 0.08, 0.1); }
  pummel() { this._noise(0.04, 0.22, 900, 0, 1.2); }
  throwWhoosh() { this._noise(0.22, 0.2, 700, 0, 0.6, 'bandpass'); this._osc('sine', 400, 120, 0.2, 0.08); }
  jump() { this._osc('square', 320, 620, 0.1, 0.09); }
  doubleJump() { this._osc('square', 480, 900, 0.11, 0.08); this._noise(0.08, 0.1, 2600, 0, 2, 'highpass'); }
  land(p = 0.5) { this._noise(0.09, 0.16 + p * 0.28, 260 + p * 120, 0, 0.8); if (p > 0.8) this._osc('sine', 110, 45, 0.16, 0.22); }
  dodge() { this._noise(0.14, 0.16, 1500, 0, 0.7, 'bandpass'); }
  roll() { this._noise(0.2, 0.14, 900, 0, 0.5, 'bandpass'); this._osc('sine', 260, 160, 0.18, 0.05); }
  airdodge() { this._osc('triangle', 900, 400, 0.16, 0.07); this._noise(0.16, 0.1, 2000, 0, 1, 'highpass'); }

  /** Rising hum while a smash charges. Call charge(false) to stop it. */
  charge(on) {
    if (!this.ensure()) return;
    if (!on) {
      if (this._chargeNode) {
        const { o, g } = this._chargeNode;
        const t = this.ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0.0001, t + 0.08);
        o.stop(t + 0.12);
        this._chargeNode = null;
      }
      return;
    }
    if (this._chargeNode) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(140, t);
    o.frequency.linearRampToValueAtTime(560, t + 1.1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    this._chargeNode = { o, g };
  }

  ko() {
    this._osc('sawtooth', 900, 120, 0.4, 0.18);
    this._noise(0.36, 0.24, 1400, 0, 0.5, 'bandpass');
  }

  blastZone() {
    this._noise(0.5, 0.45, 180, 0, 0.5, 'lowpass');
    this._osc('sine', 160, 34, 0.55, 0.34);
    this._osc('square', 240, 60, 0.3, 0.12, 0.02);
  }

  star() {
    for (let i = 0; i < 6; i++) this._osc('triangle', 700 + i * 340, 1800 + i * 300, 0.1, 0.055, i * 0.045);
  }

  respawn() { for (let i = 0; i < 3; i++) this._osc('triangle', 400 + i * 220, 900 + i * 200, 0.12, 0.07, i * 0.06); }
  countdown(n) { this._osc('square', n === 1 ? 700 : 520, n === 1 ? 700 : 520, 0.16, 0.11); }
  go() { this._osc('square', 880, 1320, 0.3, 0.16); this._osc('square', 660, 990, 0.3, 0.1, 0.02); this.voice('Go!'); }
  timeUp() { for (let i = 0; i < 3; i++) this._osc('square', 900, 900, 0.14, 0.12, i * 0.2); }
  suddenDeath() { this._osc('sawtooth', 120, 60, 1.2, 0.16); this._noise(1.0, 0.16, 400, 0, 0.4, 'lowpass'); }
  heal() { for (let i = 0; i < 4; i++) this._osc('triangle', 520 + i * 180, 700 + i * 200, 0.12, 0.07, i * 0.05); }
  taunt() { this._osc('square', 520, 780, 0.16, 0.09); }
  explode(p = 0.8) { this._noise(0.42, 0.4 * p, 300, 0, 0.5, 'lowpass'); this._osc('sine', 180, 40, 0.4, 0.3 * p); }

  item(kind) {
    if (kind === 'orb') { for (let i = 0; i < 5; i++) this._osc('triangle', 600 + i * 200, 1400, 0.14, 0.06, i * 0.05); }
    else this._osc('square', 700, 1100, 0.12, 0.1);
  }

  /** kind: move|confirm|back|deny|ready|lock|page */
  ui(kind = 'move') {
    switch (kind) {
      case 'confirm': this._osc('square', 660, 990, 0.12, 0.11); break;
      case 'back': this._osc('square', 520, 320, 0.11, 0.1); break;
      case 'deny': this._osc('square', 200, 160, 0.14, 0.1); break;
      case 'ready': this._osc('triangle', 520, 780, 0.16, 0.12); this._osc('triangle', 780, 1170, 0.16, 0.08, 0.06); break;
      case 'lock': this._noise(0.06, 0.2, 1400, 0, 1.4); this._osc('square', 880, 660, 0.1, 0.1); break;
      case 'page': this._noise(0.08, 0.14, 2200, 0, 1.2, 'highpass'); break;
      default: this._osc('square', 900, 900, 0.045, 0.07);
    }
  }

  /** The announcer. Browser speech synthesis, pitched down to 64-era cheese. */
  voice(text) {
    if (this.muted || this.voiceOff || !text) return;
    try {
      const ss = typeof window !== 'undefined' ? window.speechSynthesis : null;
      if (!ss) return;
      const now = Date.now();
      if (now - this._lastVoice < 220) return;
      this._lastVoice = now;
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      u.pitch = 0.42;
      u.volume = Math.min(1, this.volume);
      ss.speak(u);
    } catch { /* no speech support — the game is fine without it */ }
  }
}

// ------------------------------------------------------------------- music
// Each track is a written 16-step-per-bar loop: MIDI notes (null = rest) for the
// lead and bass, plus a drum string (k=kick s=snare h=hat .=rest).
const R = null;
const TRACKS = {
  menu: {
    tempo: 132, lead: 'square', bassWave: 'triangle', gain: 1,
    melody: [76, R, 74, R, 71, R, 74, R, 76, R, 79, R, 76, R, 74, R, 71, R, 69, R, 67, R, 69, R, 71, R, 74, R, 71, R, R, R],
    bass: [40, R, 40, R, 47, R, 45, R, 40, R, 40, R, 43, R, 45, R, 38, R, 38, R, 45, R, 43, R, 40, R, 40, R, 47, R, 47, R],
    drums: 'k..hs..hk..hs..hk..hs..hk.khs.h',
  },
  select: {
    tempo: 146, lead: 'square', bassWave: 'triangle', gain: 0.95,
    melody: [72, 76, 79, 76, 72, 76, 81, 79, 72, 74, 77, 74, 71, 74, 79, 77, 72, 76, 79, 76, 84, 81, 79, 76, 74, 77, 81, 79, 76, 72, R, R],
    bass: [36, R, 43, R, 36, R, 43, R, 34, R, 41, R, 34, R, 41, R, 36, R, 43, R, 36, R, 43, R, 38, R, 45, R, 38, R, 45, R],
    drums: 'k.hhs.hhk.hhs.hhk.hhs.hhk.hhsshh',
  },
  gridiron: {
    tempo: 124, lead: 'square', bassWave: 'triangle', gain: 1.05,
    melody: [67, 67, 72, 72, 74, R, 76, R, 74, R, 72, R, 67, R, R, R, 65, 65, 69, 69, 72, R, 74, R, 72, R, 69, R, 67, R, R, R],
    bass: [36, 36, 43, 43, 36, 36, 43, 43, 41, 41, 48, 48, 41, 41, 48, 48, 34, 34, 41, 41, 34, 34, 41, 41, 36, 36, 43, 43, 43, 43, 36, 36],
    drums: 'k.s.k.s.k.s.kks.k.s.k.s.k.s.kkss',
  },
  arcade: {
    tempo: 150, lead: 'square', bassWave: 'triangle', gain: 0.95,
    melody: [69, 72, 76, 72, 69, 72, 76, 79, 77, 74, 71, 74, 77, 81, 79, 77, 69, 72, 76, 72, 81, 79, 76, 72, 71, 74, 77, 74, 71, 67, R, R],
    bass: [33, R, 40, R, 33, R, 40, R, 38, R, 45, R, 38, R, 45, R, 33, R, 40, R, 33, R, 40, R, 31, R, 38, R, 31, R, 38, R],
    drums: 'k.hhs.hhk.hhs.hhk.hhs.hhkkhhsshh',
  },
  volcano: {
    tempo: 164, lead: 'sawtooth', bassWave: 'square', gain: 1,
    melody: [64, 64, 67, 64, 70, R, 67, R, 64, 64, 67, 71, 70, R, 67, R, 62, 62, 65, 62, 69, R, 65, R, 60, 63, 67, 70, 71, R, R, R],
    bass: [28, 28, 28, 35, 28, 28, 31, 31, 28, 28, 28, 35, 30, 30, 33, 33, 26, 26, 26, 33, 26, 26, 29, 29, 24, 24, 31, 31, 35, 35, 34, 34],
    drums: 'kkhhs.hhkkhhs.hhkkhhs.hhkkhhssss',
  },
  blimp: {
    tempo: 116, lead: 'triangle', bassWave: 'triangle', gain: 0.95,
    melody: [72, R, 74, 76, R, 79, R, 76, 74, R, 72, R, 69, R, 72, R, 74, R, 76, 79, R, 81, R, 79, 76, R, 74, R, 72, R, R, R],
    bass: [43, R, R, 50, R, R, 47, R, 41, R, R, 48, R, R, 45, R, 43, R, R, 50, R, R, 47, R, 36, R, R, 43, R, R, 43, R],
    drums: 'k..h..s.k..h..s.k..h..s.k..hs.s.',
  },
  ice: {
    tempo: 138, lead: 'triangle', bassWave: 'triangle', gain: 0.9,
    melody: [84, R, 79, 81, 83, R, 79, R, 81, R, 76, 78, 79, R, 76, R, 84, R, 79, 81, 86, R, 83, R, 81, R, 79, 78, 76, R, R, R],
    bass: [40, R, R, 47, R, 52, R, R, 38, R, R, 45, R, 50, R, R, 40, R, R, 47, R, 52, R, R, 33, R, R, 40, R, 45, R, R],
    drums: 'k.....h.s.....h.k.....h.s...h.h.',
  },
  void: {
    tempo: 96, lead: 'square', bassWave: 'sawtooth', gain: 0.85,
    melody: [61, R, R, R, 64, R, R, R, 66, R, R, 68, R, R, 66, R, 61, R, R, R, 68, R, R, R, 71, R, R, 68, R, 66, R, R],
    bass: [25, R, R, R, 25, R, R, R, 28, R, R, R, 28, R, R, R, 25, R, R, R, 25, R, R, R, 23, R, R, R, 23, R, R, R],
    drums: 'k.......h.......k.......h...s...',
  },
  boss: {
    tempo: 172, lead: 'sawtooth', bassWave: 'square', gain: 1.05,
    melody: [59, 59, 62, 65, 64, 62, 59, R, 57, 57, 60, 64, 62, 60, 57, R, 59, 62, 66, 69, 68, 66, 62, R, 71, 69, 66, 62, 59, R, R, R],
    bass: [23, 23, 30, 30, 23, 23, 30, 30, 21, 21, 28, 28, 21, 21, 28, 28, 23, 23, 30, 30, 23, 23, 30, 30, 26, 26, 33, 33, 35, 35, 34, 34],
    drums: 'kkhhsshhkkhhsshhkkhhsshhkkssssss',
  },
  results: {
    tempo: 128, lead: 'square', bassWave: 'triangle', gain: 1,
    melody: [72, 76, 79, 84, 83, 79, 76, 79, 81, R, 79, R, 76, R, 72, R, 74, 77, 81, 86, 84, 81, 77, 81, 79, R, 76, R, 72, R, R, R],
    bass: [36, R, 43, R, 40, R, 47, R, 41, R, 48, R, 36, R, 43, R, 38, R, 45, R, 41, R, 48, R, 43, R, 50, R, 36, R, 36, R],
    drums: 'k.hhs.hhk.hhs.hhk.hhs.hhk.hhsshh',
  },
};

class Music {
  constructor(sfxRef) {
    this.sfx = sfxRef;
    this.trackId = null;
    this.track = null;
    this.muted = false;
    this.out = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.ducked = false;
    this.volume = 0.7;
    this.live = [];
  }

  isPlaying() { return !!this.track; }

  setMuted(m) {
    this.muted = m;
    if (this.out) this.out.gain.value = m ? 0 : this._level();
  }

  duck(on) {
    this.ducked = on;
    if (this.out && !this.muted) {
      const t = this.sfx.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.linearRampToValueAtTime(this._level(), t + 0.2);
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.out && !this.muted) this.out.gain.value = this._level();
  }

  _level() {
    const base = 0.28 * (this.volume ?? 0.7) * (this.track?.gain ?? 1);
    return this.ducked ? base * 0.35 : base;
  }

  play(id) {
    if (!TRACKS[id]) return;
    if (this.trackId === id && this.track) return;
    if (!this.sfx.ensure()) return;
    this.stop();
    const ctx = this.sfx.ctx;
    this.trackId = id;
    this.track = TRACKS[id];
    this.out = ctx.createGain();
    this.out.gain.value = this.muted ? 0 : this._level();
    this.out.connect(this.sfx.master);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this._schedule(), 40);
    this._schedule();
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    for (const n of this.live) { try { n.stop(); } catch { /* already stopped */ } }
    this.live.length = 0;
    if (this.out) {
      try {
        const t = this.sfx.ctx.currentTime;
        this.out.gain.cancelScheduledValues(t);
        this.out.gain.setValueAtTime(this.out.gain.value, t);
        this.out.gain.linearRampToValueAtTime(0.0001, t + 0.12);
        const dying = this.out;
        setTimeout(() => { try { dying.disconnect(); } catch { /* gone */ } }, 250);
      } catch { /* context died */ }
    }
    this.out = null;
    this.track = null;
    this.trackId = null;
  }

  /** Schedule every 16th note that falls inside the lookahead window. */
  _schedule() {
    const t = this.track;
    if (!t || !this.sfx.ctx) return;
    const ctx = this.sfx.ctx;
    const stepDur = 60 / t.tempo / 4;
    const horizon = ctx.currentTime + 0.35;
    let guard = 0;
    while (this.nextTime < horizon && guard++ < 40) {
      const s = this.step % t.melody.length;
      this._note(t.melody[s], this.nextTime, stepDur * 1.7, t.lead, 0.075, true);
      this._note(t.bass[s % t.bass.length], this.nextTime, stepDur * 1.9, t.bassWave, 0.085, false);
      this._drum(t.drums[s % t.drums.length], this.nextTime);
      this.nextTime += stepDur;
      this.step++;
    }
    // prune finished nodes
    if (this.live.length > 80) this.live.splice(0, this.live.length - 60);
  }

  _note(midi, when, dur, wave, gain, lead) {
    if (midi == null || !this.out) return;
    const ctx = this.sfx.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave || 'square';
    o.frequency.value = MIDI(lead ? midi : midi);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    o.connect(g).connect(this.out);
    o.start(when);
    o.stop(when + dur + 0.02);
    this.live.push(o);
  }

  _drum(ch, when) {
    if (!ch || ch === '.' || !this.out) return;
    const ctx = this.sfx.ctx;
    if (ch === 'k') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, when);
      o.frequency.exponentialRampToValueAtTime(46, when + 0.14);
      g.gain.setValueAtTime(0.16, when);
      g.gain.exponentialRampToValueAtTime(0.0008, when + 0.16);
      o.connect(g).connect(this.out);
      o.start(when); o.stop(when + 0.18);
      this.live.push(o);
      return;
    }
    const dur = ch === 's' ? 0.1 : 0.04;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = ch === 's' ? 1200 : 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(ch === 's' ? 0.1 : 0.045, when);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(when);
  }
}

export const sfx = new Sfx();
export const music = new Music(sfx);
export const TRACK_IDS = Object.keys(TRACKS);
