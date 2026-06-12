// The sound of LOAM, synthesized from nothing: a generative score that
// composes itself around the time of day and where you're standing — felt
// piano over slow chord beds in daylight, sparse bells after dark, long
// reverb drones underground — plus every footstep, dig, splash, groan and
// chime, and an ambience layer of wind, birdsong, crickets and cave drips.
// No audio files anywhere.
import { rng, hashStr } from './util.js';

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// chord colors as semitone stacks
const CHORDS = {
  maj9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14], maj7: [0, 4, 7, 11],
  min9: [0, 3, 7, 10, 14], minadd9: [0, 3, 7, 14], min7: [0, 3, 7, 10],
  sus2: [0, 2, 7, 12], six9: [0, 4, 9, 14],
};

const MOODS = {
  menu: {
    keys: [62], bpm: [64, 64], rest: 0.40, bells: 0.10, gap: [3, 6], padLp: 1100,
    scale: [0, 2, 4, 7, 9], verb: 0.5, fixedSeed: 1727,
    progs: [[[0, 'maj9'], [9, 'min9'], [5, 'six9'], [7, 'sus2']]],
    names: [['Overture:'], ['Loam']],
  },
  day: {
    keys: [57, 59, 60, 62, 64], bpm: [64, 78], rest: 0.42, bells: 0.06, gap: [14, 30], padLp: 1000,
    scale: [0, 2, 4, 7, 9], verb: 0.45,
    progs: [
      [[0, 'maj9'], [5, 'six9'], [9, 'min9'], [7, 'sus2']],
      [[0, 'add9'], [7, 'maj7'], [9, 'min7'], [5, 'maj9']],
      [[0, 'maj9'], [2, 'min9'], [5, 'maj7'], [7, 'sus2']],
    ],
    names: [['Sun', 'Meadow', 'Clover', 'Amber', 'Warm', 'Golden', 'Soft', 'Tall'], ['field', 'light', 'wind', 'hill', 'morning', 'bloom', 'river', 'grass']],
  },
  night: {
    keys: [55, 57, 60, 62], bpm: [54, 64], rest: 0.58, bells: 0.30, gap: [12, 26], padLp: 760,
    scale: [0, 3, 5, 7, 10], verb: 0.62,
    progs: [
      [[0, 'min9'], [8, 'maj7'], [3, 'maj9'], [10, 'sus2']],
      [[0, 'minadd9'], [5, 'min7'], [8, 'maj9'], [10, 'maj7']],
    ],
    names: [['Moon', 'Star', 'Quiet', 'Pale', 'Silver', 'Dusk', 'Hollow', 'Blue'], ['fall', 'veil', 'watch', 'glow', 'hush', 'tide', 'mist', 'vale']],
  },
  cave: {
    keys: [50, 52, 55], bpm: [46, 54], rest: 0.74, bells: 0.34, gap: [10, 22], padLp: 520,
    scale: [0, 3, 5, 7, 10], verb: 0.85,
    progs: [
      [[0, 'minadd9'], [0, 'min7'], [3, 'maj7'], [0, 'minadd9']],
      [[0, 'min9'], [10, 'sus2'], [0, 'min7'], [8, 'maj7']],
    ],
    names: [['Deep', 'Under', 'Stone', 'Echo', 'Iron', 'Cold', 'Old', 'Glow'], ['hollow', 'song', 'root', 'vein', 'drip', 'depth', 'heart', 'sleep']],
  },
};

// One self-contained generated piece: melody with motif memory, pad bed,
// bass roots, optional bell sparkle. Pure data until scheduled.
export function composePiece(mood, seed) {
  const M = MOODS[mood] || MOODS.day;
  const r = rng(M.fixedSeed ?? seed);
  const key = M.keys[(r() * M.keys.length) | 0];
  const bpm = M.bpm[0] + r() * (M.bpm[1] - M.bpm[0]);
  const beat = 60 / bpm;
  const prog = M.progs[(r() * M.progs.length) | 0];
  const cycles = mood === 'cave' ? 2 : 2 + ((r() * 2) | 0);
  const chordBeats = 8;
  const events = [], pads = [], basses = [], bells = [];
  let motif = null;
  let deg = 2 + ((r() * 3) | 0); // melodic position in scale steps

  let t = 0.5;
  for (let cyc = 0; cyc < cycles; cyc++) {
    prog.forEach(([off, color], ci) => {
      const root = key + off;
      const chord = CHORDS[color].map((s) => root + s);
      const dur = chordBeats * beat;
      pads.push({ t, freqs: chord.map((m) => midiHz(m - 12)), dur });
      basses.push({ t, freq: midiHz(root - 24), dur: dur * 0.9, vel: 0.5 });
      if (r() < 0.5) basses.push({ t: t + dur * 0.5, freq: midiHz(root - 24 + 7), dur: dur * 0.4, vel: 0.3 });

      // melody: replay the opening motif on chords 3+ of even cycles
      const replay = motif && ci >= 2 && cyc % 2 === 1;
      const grid = chordBeats * 2; // 8th notes
      const recorded = [];
      for (let g = 0; g < grid; g++) {
        const tt = t + g * beat * 0.5;
        if (replay) {
          const hit = motif.find((m) => m.g === g);
          if (hit) {
            const m2 = key + off + hit.step;
            events.push({ t: tt + (r() - 0.5) * 0.024, freq: midiHz(m2 + 12), vel: hit.vel * (0.85 + r() * 0.2), dur: hit.dur * beat });
          }
          continue;
        }
        if (r() < M.rest) continue;
        // wander the pentatonic, lean on chord tones at strong beats
        deg += r() < 0.5 ? -1 : 1;
        if (r() < 0.16) deg += r() < 0.5 ? -2 : 2;
        deg = Math.max(-2, Math.min(9, deg));
        let step = M.scale[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5);
        if (g % 4 === 0 && r() < 0.6) { // settle on a chord tone
          const tones = CHORDS[color];
          step = tones[(r() * tones.length) | 0];
        }
        const phrase = Math.sin((g / grid) * Math.PI);
        const vel = 0.34 + phrase * 0.3 + r() * 0.18;
        const dur = (r() < 0.22 ? 2 : r() < 0.6 ? 1 : 0.5) * beat;
        events.push({ t: tt + (r() - 0.5) * 0.024, freq: midiHz(key + off + step + 12), vel, dur });
        recorded.push({ g, step, vel, dur: dur / beat });
        if (r() < 0.18) g++; // breathe
      }
      if (!motif && recorded.length > 2) motif = recorded;

      if (r() < M.bells) {
        const step = M.scale[(r() * 5) | 0];
        bells.push({ t: t + (1 + ((r() * 6) | 0)) * beat, freq: midiHz(key + off + step + 24), vel: 0.1 + r() * 0.1 });
      }
      t += dur;
    });
  }

  const N = MOODS[mood].names;
  const name = mood === 'menu' ? 'Overture: Loam'
    : N[0][(r() * N[0].length) | 0] + N[1][(r() * N[1].length) | 0];
  return { events, pads, basses, bells, length: t + 4, name, mood, padLp: M.padLp, verb: M.verb };
}

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicVol = 0.8; this.sfxVol = 0.9;
    this.mood = 'menu';
    this.onTrack = null; // (name) → "now playing" toast
    this._piece = null; this._pieceAt = 0; this._cursor = { e: 0, p: 0, b: 0, l: 0 };
    this._gapUntil = 0;
    this._amb = {};
  }

  ensure() {
    if (this.ctx) return true;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.ratio.value = 5; this.comp.knee.value = 18;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.4;
    this.muffle.connect(this.comp).connect(this.master).connect(ctx.destination);
    this.master.gain.value = 0.85;

    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol;
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol;
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.5;
    this.musicBus.connect(this.muffle); this.sfxBus.connect(this.muffle); this.ambBus.connect(this.muffle);

    // a long soft hall, conjured from shaped noise
    const len = (ctx.sampleRate * 3.2) | 0;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      const rr = rng(811 + ch);
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        d[i] = (rr() * 2 - 1) * Math.exp(-t * 2.1) * (i < 900 ? i / 900 : 1);
      }
    }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.5;
    this.verb.connect(this.verbGain).connect(this.muffle);
    this.musicSend = ctx.createGain(); this.musicSend.gain.value = 0.5; this.musicSend.connect(this.verb);
    this.sfxSend = ctx.createGain(); this.sfxSend.gain.value = 0.12; this.sfxSend.connect(this.verb);

    this._startAmbience();
    return true;
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.85; }
  setMusicVol(v) { this.musicVol = v; if (this.musicBus) this.musicBus.gain.value = v; }
  setSfxVol(v) { this.sfxVol = v; if (this.sfxBus) this.sfxBus.gain.value = v; this.ambBus && (this.ambBus.gain.value = v * 0.55); }
  setUnderwater(u) {
    if (!this.ctx) return;
    const f = this.muffle.frequency;
    f.cancelScheduledValues(this.ctx.currentTime);
    f.setTargetAtTime(u ? 540 : 20000, this.ctx.currentTime, 0.18);
  }

  // ---------------------------------------------------------- music
  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this._piece) this._fadePiece(2.4);
    this._gapUntil = this.ctx ? this.ctx.currentTime + 1.2 : 0;
  }

  _fadePiece(t) {
    const p = this._piece;
    if (!p) return;
    const g = p.gain.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(0.0001, this.ctx.currentTime + t);
    const node = p.gain;
    setTimeout(() => { try { node.disconnect(); } catch { } }, t * 1000 + 200);
    this._piece = null;
  }

  update() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (!this._piece) {
      if (now < this._gapUntil) return;
      const data = composePiece(this.mood, (Math.random() * 1e9) | 0);
      const gain = this.ctx.createGain();
      gain.gain.value = 1;
      gain.connect(this.musicBus);
      const send = this.ctx.createGain(); send.gain.value = data.verb;
      gain.connect(send); send.connect(this.verb);
      this._piece = { data, gain, t0: now + 0.2 };
      this._cursor = { e: 0, p: 0, b: 0, l: 0 };
      this.onTrack?.(data.name);
      return;
    }
    // pump events a beat-and-a-half ahead of the clock
    const P = this._piece, d = P.data, horizon = now + 1.6;
    const c = this._cursor;
    while (c.p < d.pads.length && P.t0 + d.pads[c.p].t < horizon) {
      const ev = d.pads[c.p++];
      this._pad(ev.freqs, P.t0 + ev.t, ev.dur, d.padLp, P.gain);
    }
    while (c.b < d.basses.length && P.t0 + d.basses[c.b].t < horizon) {
      const ev = d.basses[c.b++];
      this._bass(ev.freq, P.t0 + ev.t, ev.dur, ev.vel, P.gain);
    }
    while (c.e < d.events.length && P.t0 + d.events[c.e].t < horizon) {
      const ev = d.events[c.e++];
      this._keys(ev.freq, P.t0 + ev.t, ev.vel, ev.dur, P.gain);
    }
    while (c.l < d.bells.length && P.t0 + d.bells[c.l].t < horizon) {
      const ev = d.bells[c.l++];
      this._bellNote(ev.freq, P.t0 + ev.t, ev.vel, P.gain);
    }
    if (now > P.t0 + d.length) {
      this._fadePiece(0.5);
      const M = MOODS[this.mood] || MOODS.day;
      this._gapUntil = now + M.gap[0] + Math.random() * (M.gap[1] - M.gap[0]);
    }
  }

  // felt piano: 2-op FM, detuned twin, octave ghost
  _keys(freq, t, vel, dur, out) {
    const ctx = this.ctx;
    const end = t + Math.max(dur * 1.5, 1.6) + 1.4;
    const mk = (f, detune, amp) => {
      const o = ctx.createOscillator(); o.frequency.value = f; o.detune.value = detune;
      const mod = ctx.createOscillator(); mod.frequency.value = f * 2;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(f * 2.1 * vel, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.5);
      mod.connect(mg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      o.connect(g).connect(out);
      o.start(t); o.stop(end + 0.05); mod.start(t); mod.stop(end + 0.05);
    };
    mk(freq, 0, vel * 0.34);
    mk(freq, 2.7, vel * 0.13);
    const ghost = ctx.createOscillator(); ghost.frequency.value = freq * 2;
    const gg = ctx.createGain();
    gg.gain.setValueAtTime(vel * 0.05, t);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    ghost.connect(gg).connect(out);
    ghost.start(t); ghost.stop(t + 0.9);
  }

  _pad(freqs, t, dur, lp, out) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
    g.gain.setValueAtTime(0.05, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.15);
    f.connect(g).connect(out);
    for (const fq of freqs) {
      for (const det of [-5, 4]) {
        const o = ctx.createOscillator();
        o.type = det > 0 ? 'triangle' : 'sine';
        o.frequency.value = fq; o.detune.value = det;
        o.connect(f);
        o.start(t); o.stop(t + dur * 1.2);
      }
    }
  }

  _bass(freq, t, dur, vel, out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.16, t + 0.3);
    g.gain.setValueAtTime(vel * 0.16, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.1);
  }

  _bellNote(freq, t, vel, out) {
    const ctx = this.ctx;
    for (const [ratio, amp, dec] of [[1, 1, 2.4], [2.76, 0.28, 1.1], [5.4, 0.1, 0.5]]) {
      const o = ctx.createOscillator(); o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel * 0.2 * amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + dec + 0.05);
    }
  }

  // ---------------------------------------------------------- ambience
  _startAmbience() {
    const ctx = this.ctx;
    const noise = (() => {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = last * 0.98 + (Math.random() * 2 - 1) * 0.02; d[i] = last * 18; }
      return buf;
    })();
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    const g = ctx.createGain(); g.gain.value = 0.06;
    src.connect(lp).connect(g).connect(this.ambBus);
    src.start();
    this._amb.windGain = g;

    const cr = ctx.createOscillator(); cr.frequency.value = 4260;
    const cg = ctx.createGain(); cg.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6.2;
    const lg = ctx.createGain(); lg.gain.value = 0;
    lfo.connect(lg).connect(cg.gain);
    cr.connect(cg).connect(this.ambBus);
    cr.start(); lfo.start();
    this._amb.cricketDepth = lg;
    this._amb.birdT = 4; this._amb.dripT = 5;
  }

  // mood-aware background life; call every frame with dt
  ambient(dt, { day, cave, raining = false }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this._amb.windGain.gain.setTargetAtTime(cave ? 0.02 : 0.07 + (1 - day) * 0.02, ctx.currentTime, 1.5);
    this._amb.cricketDepth.gain.setTargetAtTime(!cave && day < 0.3 ? 0.011 : 0, ctx.currentTime, 2);

    if (!cave && day > 0.55) {
      this._amb.birdT -= dt;
      if (this._amb.birdT <= 0) {
        this._amb.birdT = 3 + Math.random() * 9;
        const t0 = ctx.currentTime + 0.05;
        const base = 2300 + Math.random() * 1800;
        const n = 2 + (Math.random() * 4 | 0);
        for (let i = 0; i < n; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          const t = t0 + i * (0.09 + Math.random() * 0.07);
          o.frequency.setValueAtTime(base * (1 + Math.random() * 0.25), t);
          o.frequency.exponentialRampToValueAtTime(base * (0.8 + Math.random() * 0.5), t + 0.07);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.025, t + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
          o.connect(g).connect(this.ambBus);
          o.start(t); o.stop(t + 0.12);
        }
      }
    }
    if (cave) {
      this._amb.dripT -= dt;
      if (this._amb.dripT <= 0) {
        this._amb.dripT = 2 + Math.random() * 7;
        const t = ctx.currentTime + 0.02;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(900 + Math.random() * 700, t);
        o.frequency.exponentialRampToValueAtTime(420, t + 0.09);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        o.connect(g).connect(this.sfxSend);
        o.connect(g).connect(this.ambBus);
        o.start(t); o.stop(t + 0.12);
      }
    }
  }

  // ---------------------------------------------------------- sfx
  _noise(t, gain, freq, q = 1, type = 'bandpass', when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const len = Math.ceil(ctx.sampleRate * t);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    src.connect(f).connect(g).connect(this.sfxBus);
    g.connect(this.sfxSend);
    src.start(t0);
  }

  _osc(type, f0, f1, t, gain, when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type;
    const t0 = ctx.currentTime + when;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + t);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    o.connect(g).connect(this.sfxBus);
    o.start(t0); o.stop(t0 + t + 0.02);
  }

  // material-flavoured surface sounds
  _surface(mat, gain, dur) {
    const j = 0.9 + Math.random() * 0.25;
    switch (mat) {
      case 'grass': this._noise(dur, gain * 0.8, 700 * j, 0.6); break;
      case 'gravel': this._noise(dur, gain, 480 * j, 0.8); break;
      case 'sand': this._noise(dur * 1.2, gain * 0.7, 1500 * j, 0.5); break;
      case 'snow': this._noise(dur, gain * 0.8, 350 * j, 0.5, 'lowpass'); break;
      case 'wood': this._noise(dur * 0.7, gain * 0.7, 320 * j, 1.4); this._osc('sine', 190 * j, 110, dur, gain * 0.5); break;
      case 'glass': this._noise(dur * 0.6, gain, 2400 * j, 1.2, 'highpass'); break;
      case 'wool': this._noise(dur, gain * 0.6, 260 * j, 0.6, 'lowpass'); break;
      case 'water': this._noise(dur * 1.4, gain * 0.8, 900 * j, 0.4); break;
      default: this._noise(dur * 0.7, gain, 900 * j, 1); this._osc('triangle', 220 * j, 140, dur * 0.7, gain * 0.3);
    }
  }

  step(mat) { this._surface(mat, 0.10, 0.085); }
  dig(mat) { this._surface(mat, 0.22, 0.11); }
  breakBlock(mat) {
    this._surface(mat, 0.5, 0.16);
    if (mat === 'stone') this._osc('square', 160, 70, 0.12, 0.1);
    if (mat === 'glass') { this._osc('sine', 1900, 1400, 0.22, 0.07); this._osc('sine', 2600, 2100, 0.18, 0.05); }
  }
  place(mat) { this._surface(mat, 0.3, 0.09); }
  swish() { this._noise(0.09, 0.1, 2600, 0.4, 'highpass'); }
  thunk() { this._noise(0.08, 0.22, 700, 1); this._osc('sine', 240, 90, 0.1, 0.22); }
  splash() { this._noise(0.3, 0.4, 950, 0.4); this._noise(0.5, 0.18, 500, 0.4, 'lowpass', 0.06); }
  pop() { this._osc('sine', 520, 1050, 0.09, 0.16); }
  chime() { this._osc('triangle', 880, 1320, 0.14, 0.12); }
  click() { this._osc('triangle', 1150, 900, 0.045, 0.08); }
  back() { this._osc('triangle', 660, 440, 0.1, 0.1); }
  hurt() { this._osc('square', 220, 130, 0.14, 0.16); this._noise(0.1, 0.2, 500, 1); }
  toolBreak() { this._noise(0.14, 0.3, 1700, 1); this._osc('square', 700, 200, 0.18, 0.12); }
  eat() { for (let i = 0; i < 3; i++) this._noise(0.07, 0.2, 800 + Math.random() * 300, 1, 'bandpass', i * 0.16); this._osc('sine', 380, 160, 0.16, 0.1, 0.5); }
  burp() { this._osc('sawtooth', 110, 70, 0.18, 0.1, 0); }
  sleep() { this._noise(1.6, 0.12, 300, 0.4, 'lowpass'); }
  wake() { this._osc('triangle', 660, 990, 0.3, 0.08); this._osc('triangle', 990, 1320, 0.4, 0.06, 0.25); }
  xpDing() { this._osc('sine', 1180, 1760, 0.1, 0.08); }

  mob(name) {
    const j = 0.9 + Math.random() * 0.2;
    if (name.startsWith('zombie')) {
      const ctx = this.ctx; if (!ctx) return;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const t0 = ctx.currentTime;
      const dur = name === 'zombieBite' ? 0.25 : 0.9 + Math.random() * 0.4;
      o.frequency.setValueAtTime(95 * j, t0);
      o.frequency.linearRampToValueAtTime(70 * j, t0 + dur);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.2;
      f.frequency.setValueAtTime(320, t0);
      f.frequency.linearRampToValueAtTime(560, t0 + dur * 0.6);
      f.frequency.linearRampToValueAtTime(300, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.16, t0 + dur * 0.2);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      o.connect(f).connect(g).connect(this.sfxBus);
      g.connect(this.sfxSend);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } else if (name.startsWith('sheep')) {
      const ctx = this.ctx; if (!ctx) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(430 * j, t0);
      o.frequency.linearRampToValueAtTime(360 * j, t0 + 0.4);
      const am = ctx.createOscillator(); am.frequency.value = 9;
      const ag = ctx.createGain(); ag.gain.value = 0.035;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      am.connect(ag).connect(g.gain);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.07, t0 + 0.06);
      g.gain.linearRampToValueAtTime(0.0001, t0 + 0.45);
      o.connect(g).connect(this.sfxBus);
      o.start(t0); o.stop(t0 + 0.5); am.start(t0); am.stop(t0 + 0.5);
    } else if (name.startsWith('pig')) {
      this._osc('sawtooth', 260 * j, 130 * j, 0.16, 0.14);
      if (Math.random() < 0.4) this._osc('sawtooth', 280 * j, 150 * j, 0.14, 0.12, 0.22);
    }
  }
}

export const audio = new GameAudio();
