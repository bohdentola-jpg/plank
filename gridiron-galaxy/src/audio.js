// Synthesized audio: every sound effect and music track is generated with WebAudio. No files.
import { makeRng } from './util.js';

const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], penta: [0, 2, 4, 7, 9], blues: [0, 3, 5, 6, 7, 10] };
const TRACKS = {
  space:    { bpm: 78, scale: 'minor', pad: true, arp: true, bass: 'slow', drums: 'none', lead: false, wave: 'sine', root: 45 },
  hub:      { bpm: 92, scale: 'dorian', pad: true, arp: true, bass: 'slow', drums: 'soft', lead: false, wave: 'triangle', root: 48 },
  district: { bpm: 112, scale: 'major', pad: false, arp: true, bass: 'bounce', drums: 'soft', lead: true, wave: 'square', root: 50 },
  shop:     { bpm: 98, scale: 'major', pad: true, arp: false, bass: 'walk', drums: 'brush', lead: true, wave: 'triangle', root: 48 },
  game:     { bpm: 136, scale: 'minor', pad: false, arp: true, bass: 'drive', drums: 'rock', lead: true, wave: 'sawtooth', root: 43 },
  tense:    { bpm: 126, scale: 'blues', pad: true, arp: true, bass: 'drive', drums: 'rock', lead: true, wave: 'sawtooth', root: 41 },
  story:    { bpm: 84, scale: 'major', pad: true, arp: true, bass: 'slow', drums: 'none', lead: false, wave: 'triangle', root: 52 },
  victory:  { bpm: 120, scale: 'major', pad: true, arp: true, bass: 'bounce', drums: 'soft', lead: true, wave: 'square', root: 50 },
};

class AudioSys {
  constructor() { this.ctx = null; this.musicVol = 0.6; this.sfxVol = 0.8; this.track = null; this.pending = null; this.timer = null; this.step = 0; this.nextT = 0; this.seed = 1; this.lastSfx = {}; }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicVol * 0.5; this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
      this.comp = this.ctx.createDynamicsCompressor(); this.master.disconnect(); this.master.connect(this.comp); this.comp.connect(this.ctx.destination);
      if (this.pending) { const p = this.pending; this.pending = null; this.music(p.name, p.seed); }
    } catch (e) { console.warn('audio unavailable', e); }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  applySettings(s) { this.musicVol = s.music; this.sfxVol = s.sfx; if (this.ctx) { this.musicGain.gain.value = this.musicVol * 0.5; this.sfxGain.gain.value = this.sfxVol; } }

  // ---- primitives ----
  tone({ f = 440, f2 = null, dur = 0.2, type = 'sine', vol = 0.3, a = 0.005, d = null, dest = null, t = 0, detune = 0 }) {
    const c = this.ctx; if (!c) return; const t0 = c.currentTime + t;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur); o.detune.value = detune;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (d || dur));
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t0); o.stop(t0 + (d || dur) + 0.05);
    return o;
  }
  noise({ dur = 0.2, vol = 0.3, f = 1000, q = 1, type = 'bandpass', f2 = null, dest = null, t = 0, a = 0.005 }) {
    const c = this.ctx; if (!c) return; const t0 = c.currentTime + t;
    const n = Math.floor(c.sampleRate * dur) + 1; const buf = c.createBuffer(1, n, c.sampleRate); const data = buf.getChannelData(0); for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t0); if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur); flt.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(g); g.connect(dest || this.sfxGain); src.start(t0); src.stop(t0 + dur + 0.05);
  }

  sfx(name, opt = {}) {
    if (!this.ctx) return; const now = performance.now(); if (this.lastSfx[name] && now - this.lastSfx[name] < 40) return; this.lastSfx[name] = now;
    const T = (o) => this.tone(o), N = (o) => this.noise(o);
    switch (name) {
      case 'blip': T({ f: 900, f2: 1300, dur: 0.06, type: 'square', vol: 0.12 }); break;
      case 'confirm': T({ f: 660, dur: 0.08, type: 'square', vol: 0.15 }); T({ f: 990, dur: 0.14, type: 'square', vol: 0.15, t: 0.07 }); break;
      case 'back': T({ f: 520, f2: 300, dur: 0.14, type: 'square', vol: 0.12 }); break;
      case 'error': T({ f: 140, f2: 110, dur: 0.22, type: 'sawtooth', vol: 0.18 }); break;
      case 'coin': T({ f: 1250, dur: 0.07, type: 'square', vol: 0.15 }); T({ f: 1680, dur: 0.22, type: 'square', vol: 0.15, t: 0.07 }); break;
      case 'buy': [0, 0.08, 0.16, 0.24].forEach((t, i) => T({ f: [880, 1100, 1320, 1760][i], dur: 0.16, type: 'square', vol: 0.14, t })); break;
      case 'whistle': T({ f: 2350, dur: 0.45, type: 'sine', vol: 0.22 }); T({ f: 2480, dur: 0.45, type: 'sine', vol: 0.18 }); N({ dur: 0.45, vol: 0.05, f: 2400, q: 8 }); break;
      case 'snap': N({ dur: 0.08, vol: 0.25, f: 1800, q: 1.5 }); break;
      case 'thud': T({ f: 90, f2: 40, dur: 0.18, type: 'sine', vol: 0.5 }); N({ dur: 0.12, vol: 0.28, f: 400, q: 0.8, type: 'lowpass' }); break;
      case 'bigthud': T({ f: 70, f2: 30, dur: 0.3, type: 'sine', vol: 0.7 }); N({ dur: 0.2, vol: 0.4, f: 300, q: 0.8, type: 'lowpass' }); break;
      case 'catch': N({ dur: 0.07, vol: 0.2, f: 900, q: 1 }); T({ f: 320, f2: 260, dur: 0.1, type: 'triangle', vol: 0.18 }); break;
      case 'drop': T({ f: 300, f2: 120, dur: 0.25, type: 'triangle', vol: 0.2 }); break;
      case 'throw': N({ dur: 0.25, vol: 0.14, f: 600, f2: 2400, q: 1 }); break;
      case 'cheer': N({ dur: 1.6, vol: 0.32, f: 900, q: 0.6, a: 0.25 }); N({ dur: 1.4, vol: 0.18, f: 2200, q: 0.8, a: 0.3 }); break;
      case 'bigcheer': N({ dur: 2.8, vol: 0.45, f: 800, q: 0.6, a: 0.3 }); N({ dur: 2.4, vol: 0.25, f: 2400, q: 0.8, a: 0.4 }); [0, 0.12, 0.24, 0.36].forEach((t, i) => T({ f: [523, 659, 784, 1046][i], dur: 0.5, type: 'square', vol: 0.12, t })); break;
      case 'boo': N({ dur: 1.2, vol: 0.25, f: 350, q: 1.2, a: 0.2 }); T({ f: 180, f2: 150, dur: 1.0, type: 'sawtooth', vol: 0.06, a: 0.2 }); break;
      case 'kick': N({ dur: 0.1, vol: 0.3, f: 500, q: 1 }); T({ f: 200, f2: 60, dur: 0.15, type: 'sine', vol: 0.4 }); break;
      case 'ufo': for (let i = 0; i < 4; i++) T({ f: 420 + i * 120, f2: 900 + i * 100, dur: 0.6, type: 'sine', vol: 0.12, t: i * 0.5 }); T({ f: 60, dur: 2.4, type: 'sawtooth', vol: 0.08 }); break;
      case 'beam': for (let i = 0; i < 10; i++) T({ f: 1200 + (i % 3) * 300, dur: 0.2, type: 'triangle', vol: 0.08, t: i * 0.12 }); T({ f: 200, f2: 1400, dur: 1.4, type: 'sine', vol: 0.12 }); break;
      case 'rocket': N({ dur: 3.2, vol: 0.5, f: 120, f2: 900, q: 0.7, type: 'lowpass', a: 0.4 }); T({ f: 40, f2: 90, dur: 3.0, type: 'sawtooth', vol: 0.18, a: 0.3 }); break;
      case 'td': [0, 0.1, 0.2, 0.3, 0.5].forEach((t, i) => T({ f: [523, 659, 784, 1046, 1318][i], dur: i === 4 ? 0.7 : 0.18, type: 'square', vol: 0.16, t })); break;
      case 'buzzer': T({ f: 220, dur: 0.9, type: 'sawtooth', vol: 0.2 }); T({ f: 224, dur: 0.9, type: 'square', vol: 0.12 }); break;
      case 'swoosh': N({ dur: 0.3, vol: 0.18, f: 300, f2: 3000, q: 1.5 }); break;
      case 'pop': T({ f: 600, f2: 900, dur: 0.06, type: 'sine', vol: 0.2 }); break;
      case 'juke': N({ dur: 0.15, vol: 0.15, f: 1500, f2: 400, q: 1.5 }); break;
      case 'fumble': T({ f: 300, f2: 90, dur: 0.3, type: 'square', vol: 0.15 }); N({ dur: 0.15, vol: 0.2, f: 500, type: 'lowpass' }); break;
      case 'firstdown': T({ f: 784, dur: 0.1, type: 'square', vol: 0.12 }); T({ f: 1046, dur: 0.22, type: 'square', vol: 0.12, t: 0.1 }); break;
      case 'tick': T({ f: 1500, dur: 0.03, type: 'square', vol: 0.08 }); break;
      case 'type': T({ f: 1800 + Math.random() * 400, dur: 0.025, type: 'square', vol: 0.05 }); break;
      case 'land': N({ dur: 1.2, vol: 0.3, f: 800, f2: 100, q: 0.7, type: 'lowpass' }); T({ f: 120, f2: 50, dur: 0.6, type: 'sine', vol: 0.3, t: 0.9 }); break;
      case 'warp': T({ f: 200, f2: 2400, dur: 1.2, type: 'sawtooth', vol: 0.15 }); N({ dur: 1.4, vol: 0.2, f: 400, f2: 4000, q: 2 }); break;
      case 'lateral': N({ dur: 0.18, vol: 0.15, f: 900, f2: 1800, q: 1.2 }); break;
      case 'crowd_gasp': N({ dur: 0.6, vol: 0.2, f: 1200, q: 1, a: 0.05 }); break;
      case 'goal': T({ f: 440, dur: 0.12, type: 'square', vol: 0.12 }); T({ f: 554, dur: 0.12, type: 'square', vol: 0.12, t: 0.12 }); T({ f: 659, dur: 0.4, type: 'square', vol: 0.12, t: 0.24 }); break;
    }
  }

  // ---- generative music ----
  music(name, seed = 1) {
    if (!this.ctx) { this.pending = { name, seed }; return; }
    if (this.track === name && this.seed === seed) return;
    this.stopMusic(); this.track = name; this.seed = seed; const def = TRACKS[name]; if (!def) return;
    const rnd = makeRng(seed * 7919 + 13); this.rnd = rnd; this.def = def;
    const scale = SCALES[def.scale];
    // chord progression as scale degrees (4 bars)
    const progs = [[0, 5, 3, 4], [0, 3, 4, 4], [0, 4, 5, 3], [5, 3, 0, 4], [0, 2, 3, 4]];
    this.prog = rnd.pick(progs); this.scale = scale;
    this.arpPat = rnd.pick([[0, 2, 4, 2, 0, 2, 4, 6], [0, 4, 2, 4, 0, 4, 2, 4], [0, 2, 4, 6, 4, 2, 0, 2], [4, 2, 0, 2, 4, 6, 4, 2]]);
    this.leadPat = Array.from({ length: 16 }, () => (rnd.chance(0.55) ? rnd.int(0, 7) : null));
    this.bassVar = rnd.int(0, 2);
    this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
    this.padNodes = [];
    this.timer = setInterval(() => this._schedule(), 40);
  }
  stopMusic() { if (this.timer) clearInterval(this.timer); this.timer = null; this.track = null; if (this.padNodes) { for (const n of this.padNodes) { try { n.stop(); } catch (e) { /* */ } } this.padNodes = []; } }
  _deg(deg, oct = 0) { const s = this.scale; const o = Math.floor(deg / s.length) + oct; const n = s[((deg % s.length) + s.length) % s.length]; return this.def.root + n + o * 12; }
  _freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  _schedule() {
    const c = this.ctx; if (!c || !this.def) return;
    const spb = 60 / this.def.bpm / 4; // seconds per 16th
    while (this.nextT < c.currentTime + 0.18) {
      const step = this.step, bar = Math.floor(step / 16) % 4, s16 = step % 16; const t = this.nextT - c.currentTime;
      const chord = this.prog[bar]; const def = this.def; const dest = this.musicGain;
      // pad at bar start
      if (def.pad && s16 === 0) {
        for (const iv of [0, 2, 4]) { const f = this._freq(this._deg(chord + iv, 0)); const o = this.tone({ f, dur: spb * 16, type: def.wave === 'sawtooth' ? 'sawtooth' : 'triangle', vol: def.wave === 'sawtooth' ? 0.035 : 0.06, a: spb * 4, dest, t, detune: iv * 3 }); if (o) this.padNodes.push(o); }
        this.padNodes = this.padNodes.slice(-12);
      }
      // bass
      const bassOn = def.bass === 'slow' ? (s16 === 0 || s16 === 8) : def.bass === 'bounce' ? (s16 % 4 === 0 || s16 === 6 || s16 === 14) : def.bass === 'walk' ? (s16 % 4 === 0) : (s16 % 2 === 0);
      if (bassOn && def.bass !== 'none') { const d = def.bass === 'walk' ? chord + [0, 2, 4, 5][(s16 / 4) | 0] : chord + (s16 === 6 || s16 === 14 ? 4 : 0); this.tone({ f: this._freq(this._deg(d, -1)), dur: spb * (def.bass === 'drive' ? 1.6 : 3), type: def.bass === 'drive' ? 'sawtooth' : 'triangle', vol: 0.16, a: 0.005, dest, t }); }
      // arp
      if (def.arp && s16 % 2 === 0) { const d = chord + this.arpPat[(s16 / 2) % 8]; this.tone({ f: this._freq(this._deg(d, 1)), dur: spb * 1.8, type: def.wave === 'sine' ? 'sine' : 'square', vol: def.wave === 'sine' ? 0.07 : 0.045, a: 0.004, dest, t }); }
      // lead (every other bar phrase)
      if (def.lead && bar >= 2) { const d = this.leadPat[s16]; if (d !== null) this.tone({ f: this._freq(this._deg(chord + d, 1)), dur: spb * 1.5, type: def.wave === 'sawtooth' ? 'square' : 'triangle', vol: 0.06, a: 0.01, dest, t }); }
      // drums
      if (def.drums !== 'none') {
        const kick = def.drums === 'rock' ? (s16 === 0 || s16 === 8 || s16 === 10) : (s16 === 0 || s16 === 8);
        const snare = def.drums === 'rock' ? (s16 === 4 || s16 === 12) : def.drums === 'soft' ? (s16 === 4 || s16 === 12) : false;
        const hat = def.drums === 'rock' ? (s16 % 2 === 0) : def.drums === 'brush' ? (s16 % 2 === 1) : (s16 % 4 === 2);
        if (kick) this.tone({ f: 150, f2: 45, dur: 0.15, type: 'sine', vol: def.drums === 'rock' ? 0.35 : 0.2, dest, t });
        if (snare) this.noise({ dur: 0.12, vol: def.drums === 'rock' ? 0.16 : 0.08, f: 1800, q: 0.7, dest, t });
        if (hat) this.noise({ dur: 0.04, vol: def.drums === 'brush' ? 0.03 : 0.05, f: 8000, q: 1, type: 'highpass', dest, t });
      }
      this.nextT += spb; this.step++;
    }
  }
}
export const audio = new AudioSys();
