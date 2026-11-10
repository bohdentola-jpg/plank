// All sound is synthesized with WebAudio — no audio files.
//  - sfx(name): one-shot effects
//  - music(id): looping tunes played by a tiny step sequencer
//  - blip(pitch): dialogue voice chirps
import { clamp } from './util.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 0;
  let semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = semi + (parseInt(m[3], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
const CHORDS = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], dim: [0, 3, 6], sus: [0, 5, 7],
};
function chordFreqs(sym, octave = 3) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
  if (!m) return [];
  const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const iv = CHORDS[m[3]] || CHORDS[''];
  return iv.map((i) => 440 * Math.pow(2, (root + i + (octave + 1) * 12 - 69) / 12));
}
const parse = (s) => s.replace(/\|/g, ' ').trim().split(/\s+/);

// ---------------------------------------------------------------- songs
// Each melody token is one step (`div` steps per beat). "." holds, "-" rests.
const SONGS = {
  town: {
    bpm: 100, div: 2, bar: 8, lead: 'soft',
    chords: 'C Am F G C Am Dm G',
    melody: `E5 . G5 . C6 . B5 A5 | G5 . E5 . A5 . . . | F5 . A5 . C6 . A5 F5 | G5 . . D5 B4 D5 G5 . |
             E5 . G5 . C6 . D6 C6 | B5 . A5 . E5 . . . | F5 E5 D5 . G5 F5 D5 B4 | C5 . . . - . . .`,
    bass: 'r . . f . r . f', arp: '- c - c - c - c',
    drums: { k: 'x.......', s: '....x...', h: '..x...x.' },
  },
  indoors: {
    bpm: 88, div: 2, bar: 8, lead: 'bell',
    chords: 'F C Dm Bb F C Bb C',
    melody: `A5 . . C6 . . A5 . | G5 . . E5 . . . . | F5 . . A5 . . D6 . | D6 . C6 . Bb5 . . . |
             A5 . . C6 . . F6 . | E6 . . C6 . . . . | D6 . Bb5 . F5 . . . | G5 . . . - . . .`,
    bass: 'r . . . f . . .', arp: '- c c - - c c -',
    drums: { k: '........', s: '........', h: '..x...x.' },
  },
  borough: {
    bpm: 122, div: 2, bar: 8, lead: 'square', swing: 0.16,
    chords: 'G C G D Em C D G',
    melody: `B4 D5 G5 . D5 . B4 . | C5 E5 G5 . E5 . C5 . | B4 D5 G5 B5 A5 G5 D5 . | A5 . F#5 . D5 . . . |
             G5 . E5 . B4 . E5 . | G5 E5 C5 . E5 . G5 . | F#5 . A5 . D6 . C6 A5 | G5 . . . - . . .`,
    bass: 'r . f . r . f .', arp: '- c - c - c c -',
    drums: { k: 'x...x...', s: '..x...x.', h: 'xxxxxxxx' },
  },
  battle: {
    bpm: 140, div: 2, bar: 8, lead: 'square',
    chords: 'Am Am F G Am Am F G',
    melody: `A4 . C5 . E5 . D5 C5 | A4 . C5 . E5 . . . | F5 . E5 . C5 . A4 . | B4 . D5 . G5 . . . |
             A5 . G5 E5 . D5 C5 . | A4 . C5 E5 A5 . . . | F5 E5 C5 . F5 . A5 . | G5 . B5 . D6 . . .`,
    bass: 'r r f r r r f r', arp: 'c - c c - c c -',
    drums: { k: 'x..xx...', s: '..x...x.', h: 'xxxxxxxx' },
  },
  rival: {
    bpm: 152, div: 2, bar: 8, lead: 'brass',
    chords: 'Dm Bb C Dm Dm Bb C A',
    melody: `D5 . F5 . A5 . G5 F5 | D5 . Bb4 . F5 . . . | E5 . G5 . C6 . Bb5 G5 | A5 . . F5 D5 . . . |
             D5 D5 F5 . A5 . D6 . | Bb5 . A5 . F5 . D5 . | E5 . G5 . Bb5 . G5 E5 | C#5 . E5 . A5 . . .`,
    bass: 'r r r f r r f r', arp: 'c c - c c - c c',
    drums: { k: 'x.x.x.xx', s: '..x...x.', h: 'xxxxxxxx' },
  },
  night: {
    bpm: 74, div: 2, bar: 8, lead: 'bell',
    chords: 'Em C Am B',
    melody: `E5 . . G5 . . B5 . | . . C6 . B5 . G5 . | A5 . . E5 . . C5 . | B4 . . D#5 . . F#5 .`,
    bass: 'r . . . . . f .', arp: '- - c - - - c -',
    drums: { k: '........', s: '........', h: '....x...' },
  },
  minigame: {
    bpm: 164, div: 2, bar: 8, lead: 'square',
    chords: 'F Bb C F Dm Bb C F',
    melody: `F5 A5 C6 A5 F5 . C5 . | D5 F5 Bb5 F5 D5 . Bb4 . | E5 G5 C6 G5 E5 . C5 . | F5 . A5 . C6 . . . |
             D5 F5 A5 F5 D6 . A5 . | Bb5 A5 G5 F5 D5 . F5 . | E5 . G5 . Bb5 . G5 E5 | F5 . . . - . . .`,
    bass: 'r . f . r . f .', arp: 'c - c - c - c -',
    drums: { k: 'x...x...', s: '..x...x.', h: 'x.x.x.x.' },
  },
  fair: {
    bpm: 136, div: 2, bar: 6, lead: 'organ',
    chords: 'G D D G C G D G',
    melody: `D5 . G5 . B5 . | A5 . F#5 . D5 . | E5 . F#5 . A5 . | G5 . . . . . |
             E5 . G5 . C6 . | B5 . G5 . D5 . | F#5 . A5 . C6 . | B5 . G5 . . .`,
    bass: 'r . . . . .', arp: '- - c - c -',
    drums: { k: 'x.....', s: '......', h: '..x.x.' },
  },
  frost: {
    bpm: 96, div: 2, bar: 8, lead: 'bell',
    chords: 'D A Bm G D A G A',
    melody: `F#5 . A5 . D6 . A5 . | E5 . A5 . C#6 . A5 . | D5 . F#5 . B5 . F#5 . | D5 . G5 . B5 . . . |
             F#5 . A5 . D6 . F#6 . | E6 . C#6 . A5 . . . | B5 . G5 . D5 . G5 . | A5 . . . - . . .`,
    bass: 'r . . . f . . .', arp: 'c - c - c - c -',
    drums: { k: 'x.......', s: '....x...', h: '..x...x.' },
  },
  neon: {
    bpm: 112, div: 2, bar: 8, lead: 'saw',
    chords: 'Am F C G',
    melody: `E5 . . . . . D5 C5 | A4 . . . C5 . . . | E5 . . . G5 . . E5 | D5 . . . B4 . . .`,
    bass: 'r r r r r r r r', arp: 'c c c c c c c c',
    drums: { k: 'x...x...', s: '....x...', h: '.x.x.x.x' },
  },
  bowl: {
    bpm: 146, div: 2, bar: 8, lead: 'brass',
    chords: 'Cm Ab Bb G Cm Ab Bb G',
    melody: `C5 . Eb5 . G5 . . Eb5 | Ab5 . G5 . Eb5 . C5 . | D5 . F5 . Bb5 . . F5 | G5 . B4 . D5 . G5 . |
             C6 . Bb5 . G5 . Eb5 . | Ab5 . C6 . Eb6 . . . | D6 . Bb5 . F5 . D5 . | G5 . . B5 D6 . . .`,
    bass: 'r r f r r r f r', arp: 'c - c c c - c c',
    drums: { k: 'x..xx.x.', s: '..x...x.', h: 'xxxxxxxx' },
  },
};

const LEADS = {
  soft: { type: 'triangle', gain: 0.085, a: 0.012, r: 0.16, vib: 4 },
  square: { type: 'square', gain: 0.04, a: 0.006, r: 0.09, vib: 0, lp: 2600 },
  brass: { type: 'sawtooth', gain: 0.042, a: 0.02, r: 0.1, vib: 5, lp: 1900 },
  saw: { type: 'sawtooth', gain: 0.036, a: 0.03, r: 0.3, vib: 4, lp: 1500 },
  organ: { type: 'square', gain: 0.03, a: 0.01, r: 0.06, vib: 6, lp: 3200, oct: true },
  bell: { type: 'sine', gain: 0.09, a: 0.003, r: 0.7, vib: 0, bell: true },
};

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.vol = { master: 0.8, music: 0.55, sfx: 0.9 };
    this.muted = false;
    this.song = null;      // currently playing id
    this.wanted = null;    // requested before the context existed
    this._timer = null;
    this._step = 0;
    this._next = 0;
    this._crowd = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.vol.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.vol.music; this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
    this._noiseBuf = this._makeNoise(1.5);
    if (this.wanted) { const w = this.wanted; this.wanted = null; this.music(w); }
    return true;
  }

  _makeNoise(sec) {
    const ctx = this.ctx;
    const len = Math.ceil(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setVolume(kind, v) {
    this.vol[kind] = clamp(v, 0, 1);
    if (!this.ctx) return;
    if (kind === 'master') this.master.gain.value = this.muted ? 0 : this.vol.master;
    if (kind === 'music') this.musicBus.gain.value = this.vol.music;
    if (kind === 'sfx') this.sfxBus.gain.value = this.vol.sfx;
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.vol.master;
    return this.muted;
  }

  // ------------------------------------------------------------ primitives
  tone(type, f0, f1, dur, gain = 0.15, when = 0, bus = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    const t0 = ctx.currentTime + when;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  noise(dur, gain = 0.2, freq = 1200, q = 1, when = 0, type = 'bandpass', bus = null, sweepTo = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    const t0 = ctx.currentTime + when;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(f).connect(g).connect(bus || this.sfxBus);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.03);
  }

  /** Play a little run of notes: seq('triangle', ['C5','E5','G5'], 0.08, 0.12) */
  seq(type, notes, step = 0.09, gain = 0.12, dur = 0.14, when = 0) {
    notes.forEach((n, i) => {
      const f = typeof n === 'number' ? n : noteFreq(n);
      if (f) this.tone(type, f, f, dur, gain, when + i * step);
    });
  }

  // ------------------------------------------------------------ sound effects
  sfx(name, p = 1) {
    if (!this.ctx) return;
    const T = (...a) => this.tone(...a);
    const N = (...a) => this.noise(...a);
    switch (name) {
      case 'move': T('triangle', 620, 700, 0.05, 0.06); break;
      case 'ok': T('triangle', 700, 1050, 0.09, 0.1); T('triangle', 1050, 1400, 0.09, 0.07, 0.06); break;
      case 'back': T('triangle', 620, 420, 0.1, 0.09); break;
      case 'deny': T('square', 190, 150, 0.14, 0.07); T('square', 150, 120, 0.16, 0.07, 0.1); break;
      case 'step': N(0.05, 0.035 * p, 500 + Math.random() * 300, 0.8); break;
      case 'stepSnow': N(0.07, 0.04, 1800, 0.6); break;
      case 'door': T('sine', 180, 120, 0.16, 0.14); N(0.1, 0.08, 400, 0.8, 0.05); break;
      case 'coin': this.seq('square', ['B5', 'E6'], 0.07, 0.06, 0.16); break;
      case 'item': this.seq('triangle', ['C5', 'E5', 'G5', 'C6'], 0.06, 0.1, 0.14); break;
      case 'quest': this.seq('triangle', ['G4', 'C5', 'E5', 'G5', 'E5', 'G5'], 0.09, 0.1, 0.18); break;
      case 'recruit': this.seq('square', ['C5', 'C5', 'E5', 'G5', 'E5', 'G5', 'C6'], 0.11, 0.06, 0.2); this.seq('triangle', ['C4', 'G3', 'C4', 'E4', 'G4', 'G4', 'C5'], 0.11, 0.1, 0.2); break;
      case 'levelup': this.seq('square', ['E5', 'G5', 'B5', 'E6', 'G6'], 0.07, 0.055, 0.2); break;
      case 'whistle': {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'square'; o.frequency.value = 2300; l.frequency.value = 36; lg.gain.value = 220;
        l.connect(lg).connect(o.frequency);
        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0.07, t0); g.gain.setValueAtTime(0.07, t0 + 0.32); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
        o.connect(g).connect(this.sfxBus); o.start(t0); l.start(t0); o.stop(t0 + 0.5); l.stop(t0 + 0.5);
        break;
      }
      case 'hut': N(0.06, 0.2, 1900, 1.2); T('square', 330, 300, 0.05, 0.05); break;
      case 'hike': N(0.1, 0.3, 900, 0.8); T('square', 440, 660, 0.08, 0.08); break;
      case 'throw': N(0.22, 0.16, 500, 0.7, 0, 'bandpass', null, 2400); break;
      case 'catch': N(0.05, 0.3, 1700, 1.2); T('sine', 300, 200, 0.07, 0.15); break;
      case 'perfect': this.seq('triangle', ['E6', 'G6', 'B6', 'E7'], 0.045, 0.08, 0.18); N(0.2, 0.05, 6000, 0.5, 0.02, 'highpass'); break;
      case 'good': this.seq('triangle', ['C6', 'E6'], 0.06, 0.08, 0.14); break;
      case 'miss': T('square', 220, 110, 0.22, 0.08); N(0.08, 0.15, 300, 0.8); break;
      case 'bonk': T('sine', 520, 260, 0.12, 0.2); T('triangle', 780, 390, 0.1, 0.1); break;
      case 'tackle': N(0.16, 0.5, 260, 0.7); T('sine', 120, 42, 0.2, 0.42); N(0.09, 0.2, 2400, 0.8, 0.02); break;
      case 'thud': N(0.1, 0.3, 200, 0.7); T('sine', 100, 50, 0.14, 0.3); break;
      case 'juke': N(0.12, 0.14, 1400, 1.5, 0, 'bandpass', null, 3600); break;
      case 'spin': N(0.3, 0.12, 700, 2, 0, 'bandpass', null, 2800); T('sine', 400, 900, 0.25, 0.04); break;
      case 'lateral': T('triangle', 500, 800, 0.1, 0.08); N(0.1, 0.1, 1200, 1); break;
      case 'firstdown': this.seq('triangle', ['G5', 'C6', 'E6'], 0.08, 0.1, 0.16); break;
      case 'td': this.seq('square', ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'], 0.1, 0.065, 0.24); this.seq('triangle', ['C4', 'C4', 'G3', 'C4', 'E4', 'G4', 'C5'], 0.1, 0.12, 0.24); this.cheer(1); break;
      case 'sad': this.seq('triangle', ['E5', 'D#5', 'D5', 'C#5'], 0.16, 0.09, 0.3); break;
      case 'int': this.seq('square', ['A5', 'F5', 'D5', 'A4'], 0.07, 0.06, 0.16); break;
      case 'win': this.seq('square', ['G4', 'C5', 'E5', 'G5', '-', 'E5', 'G5', 'C6'], 0.12, 0.065, 0.3); this.seq('triangle', ['C3', 'G3', 'C4', 'E4', '-', 'G3', 'B3', 'C4'], 0.12, 0.13, 0.3); break;
      case 'lose': this.seq('triangle', ['G4', 'F4', 'Eb4', 'D4', 'C4'], 0.2, 0.1, 0.4); break;
      case 'kick': N(0.08, 0.5, 320, 0.8); T('sine', 150, 55, 0.14, 0.34); break;
      case 'doink': T('sine', 880, 860, 0.5, 0.16); T('sine', 1320, 1300, 0.4, 0.08); break;
      case 'splash': N(0.35, 0.22, 900, 0.6, 0, 'bandpass', null, 300); break;
      case 'sprinkler': N(0.08, 0.05, 5200, 2); break;
      case 'switch': T('triangle', 880, 1320, 0.1, 0.12); T('sine', 1760, 1760, 0.3, 0.06, 0.08); break;
      case 'bell': T('sine', 1568, 1560, 0.9, 0.14); T('sine', 3136, 3120, 0.5, 0.05); break;
      case 'push': N(0.3, 0.18, 180, 0.6); T('sawtooth', 70, 55, 0.3, 0.06); break;
      case 'ghost': T('sine', 420, 640, 0.5, 0.05); T('sine', 630, 430, 0.6, 0.04, 0.12); break;
      case 'spook': T('sawtooth', 110, 60, 0.6, 0.06); T('sine', 880, 660, 0.5, 0.03, 0.05); break;
      case 'buzz': T('sawtooth', 110, 104, 0.3, 0.08); break;
      case 'zap': T('sawtooth', 1400, 200, 0.14, 0.07); N(0.1, 0.1, 3200, 2); break;
      case 'pop': T('sine', 500, 1100, 0.06, 0.14); break;
      case 'squeak': T('sine', 1300, 1900, 0.07, 0.07); T('sine', 1900, 1500, 0.07, 0.05, 0.07); break;
      case 'syrup': T('sine', 240, 120, 0.3, 0.12); N(0.25, 0.07, 500, 3); break;
      case 'flutter': for (let i = 0; i < 5; i++) N(0.03, 0.05, 2600, 2, i * 0.045); break;
      case 'hop': T('sine', 330, 560, 0.09, 0.09); break;
      case 'land': N(0.06, 0.12, 300, 0.8); break;
      case 'ding': T('sine', 1318, 1318, 0.5, 0.12); T('sine', 2637, 2637, 0.3, 0.04); break;
      case 'sizzle': N(0.4, 0.06, 5000, 1, 0, 'highpass'); break;
      case 'fizz': N(0.3, 0.05, 7000, 1, 0, 'highpass'); T('sine', 900, 1500, 0.25, 0.02); break;
      case 'tick': T('square', 1000, 1000, 0.025, 0.04); break;
      case 'tock': T('square', 700, 700, 0.03, 0.04); break;
      case 'alarm': this.seq('square', ['A5', 'E5', 'A5', 'E5'], 0.1, 0.06, 0.1); break;
      case 'power': T('sawtooth', 60, 240, 0.7, 0.07); T('sine', 120, 480, 0.7, 0.06); break;
      case 'lightOn': T('sine', 196, 196, 0.6, 0.08); N(0.05, 0.2, 3000, 2); T('sine', 2093, 2093, 0.4, 0.03, 0.05); break;
      case 'reel': for (let i = 0; i < 4; i++) T('square', 900 + i * 30, 900, 0.02, 0.03, i * 0.04); break;
      case 'bite': T('sine', 700, 350, 0.1, 0.14); break;
      case 'boing': T('sine', 180, 520, 0.22, 0.14); break;
      case 'crowd': this.cheer(p); break;
      case 'page': N(0.07, 0.07, 2600, 1.4); break;
      case 'talk': T('triangle', 480 * p, 520 * p, 0.045, 0.05); break;
      default: T('triangle', 600, 600, 0.05, 0.05);
    }
  }

  /** Dialogue chirp; pitch is a multiplier around 1. */
  blip(pitch = 1, type = 'triangle') {
    if (!this.ctx) return;
    const f = 430 * pitch * (0.94 + Math.random() * 0.12);
    this.tone(type, f, f * 1.06, 0.05, 0.05);
  }

  cheer(amount = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.4;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.1 * amount, t0 + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.6 + amount);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0); src.stop(t0 + 2 + amount);
  }

  // ------------------------------------------------------------ music
  music(id, { restart = false } = {}) {
    if (!this.ctx) { this.wanted = id; return; }
    if (id === this.song && !restart) return;
    this.stopMusic(0.5);
    if (!id || !SONGS[id]) { this.song = null; return; }
    const song = SONGS[id];
    const comp = this._compile(song);
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
    bus.connect(this.musicBus);
    this.song = id;
    this._bus = bus;
    this._step = 0;
    this._next = ctx.currentTime + 0.12;
    const stepDur = 60 / song.bpm / song.div;
    this._timer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      while (this._next < this.ctx.currentTime + 0.2) {
        this._playStep(song, comp, this._step, this._next, stepDur, bus);
        let d = stepDur;
        if (song.swing) d = stepDur * (this._step % 2 === 0 ? 1 + song.swing : 1 - song.swing);
        this._next += d;
        this._step = (this._step + 1) % comp.len;
      }
    }, 40);
  }

  stopMusic(fade = 0.5) {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    const bus = this._bus;
    if (bus && this.ctx) {
      const t = this.ctx.currentTime;
      try {
        bus.gain.cancelScheduledValues(t);
        bus.gain.setValueAtTime(bus.gain.value, t);
        bus.gain.linearRampToValueAtTime(0.0001, t + fade);
      } catch { /* ignore */ }
      setTimeout(() => { try { bus.disconnect(); } catch { /* gone */ } }, fade * 1000 + 400);
    }
    this._bus = null;
    this.song = null;
  }

  _compile(song) {
    const mel = parse(song.melody);
    const chords = parse(song.chords);
    const bass = parse(song.bass), arp = parse(song.arp);
    const len = mel.length;
    // note lengths: count trailing holds
    const notes = mel.map((tok, i) => {
      if (tok === '.' || tok === '-') return null;
      let n = 1;
      while (i + n < len && mel[i + n] === '.') n++;
      return { f: noteFreq(tok), n };
    });
    return { len, notes, chords, bass, arp };
  }

  _playStep(song, comp, step, t, stepDur, bus) {
    const ctx = this.ctx;
    const bar = Math.floor(step / song.bar) % comp.chords.length;
    const inBar = step % song.bar;
    const chord = comp.chords[bar];
    const lead = LEADS[song.lead] || LEADS.soft;
    // melody
    const note = comp.notes[step];
    if (note && note.f) {
      const dur = note.n * stepDur * 0.92;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = lead.type; o.frequency.setValueAtTime(note.f, t);
      if (lead.vib) {
        const l = ctx.createOscillator(), lg = ctx.createGain();
        l.frequency.value = 5.5; lg.gain.value = lead.vib;
        l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + lead.r + 0.05);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(lead.gain, t + lead.a);
      if (lead.bell) g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(dur, 0.25) + lead.r);
      else {
        g.gain.setValueAtTime(lead.gain * 0.8, t + Math.max(lead.a, dur - 0.02));
        g.gain.exponentialRampToValueAtTime(0.0008, t + dur + lead.r);
      }
      let node = o;
      if (lead.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lead.lp; o.connect(f); node = f; }
      node.connect(g).connect(bus);
      o.start(t); o.stop(t + dur + lead.r + 0.08);
      if (lead.bell || lead.oct) {
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.type = lead.bell ? 'sine' : 'square'; o2.frequency.value = note.f * 2;
        g2.gain.setValueAtTime(lead.gain * 0.3, t);
        g2.gain.exponentialRampToValueAtTime(0.0008, t + (lead.bell ? 0.3 : dur));
        o2.connect(g2).connect(bus); o2.start(t); o2.stop(t + (lead.bell ? 0.35 : dur + 0.05));
      }
    }
    // bass: r = root, f = fifth
    const b = comp.bass[inBar % comp.bass.length];
    if (b === 'r' || b === 'f') {
      const fr = chordFreqs(chord, 1);
      const f = b === 'r' ? fr[0] : fr[2] || fr[0];
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.7);
      o.connect(g).connect(bus); o.start(t); o.stop(t + stepDur * 1.8);
    }
    // comping: short chord plucks
    const a = comp.arp[inBar % comp.arp.length];
    if (a === 'c') {
      const fr = chordFreqs(chord, 3);
      const which = (step >> 0) % fr.length;
      for (const f of song.lead === 'saw' || song.lead === 'bell' ? [fr[which]] : fr) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.028, t);
        g.gain.exponentialRampToValueAtTime(0.0008, t + stepDur * 0.9);
        o.connect(g).connect(bus); o.start(t); o.stop(t + stepDur);
      }
    }
    // drums
    const d = song.drums;
    if (d) {
      if (d.k[inBar % d.k.length] === 'x') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.26, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        o.connect(g).connect(bus); o.start(t); o.stop(t + 0.18);
      }
      if (d.s[inBar % d.s.length] === 'x') this.noise(0.09, 0.1, 1900, 0.8, t - ctx.currentTime, 'bandpass', bus);
      if (d.h[inBar % d.h.length] === 'x') this.noise(0.03, 0.035, 7500, 1, t - ctx.currentTime, 'highpass', bus);
    }
  }
}
