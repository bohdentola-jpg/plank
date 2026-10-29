// Sound: everything is synthesized with WebAudio — no audio files.
// Instruments: plucked guitar (Karplus–Strong), marimba, bass, pad, flute,
// bells, light percussion. Original pieces for each place in the story.
const A4 = 440;
const mtof = (m) => A4 * Math.pow(2, (m - 69) / 12);
const NOTE = (() => {
  const names = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  return (s) => {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(s);
    return m ? names[m[1]] + (parseInt(m[2], 10) + 1) * 12 : null;
  };
})();
// chord name → midi notes (voicing around middle C)
const CHORDS = {
  C: ['C3', 'E4', 'G4', 'C5'], Am: ['A2', 'E4', 'A4', 'C5'], F: ['F2', 'F4', 'A4', 'C5'], G: ['G2', 'D4', 'G4', 'B4'],
  G7: ['G2', 'D4', 'F4', 'B4'], Dm: ['D3', 'D4', 'F4', 'A4'], D: ['D3', 'D4', 'F#4', 'A4'], D7: ['D3', 'C4', 'F#4', 'A4'],
  A7: ['A2', 'E4', 'G4', 'C#5'], E7: ['E2', 'D4', 'G#4', 'B4'], Bb: ['Bb2', 'D4', 'F4', 'Bb4'], C7: ['C3', 'E4', 'G4', 'Bb4'],
  Em: ['E2', 'E4', 'G4', 'B4'], 'G/B': ['B2', 'D4', 'G4', 'B4'], 'C/E': ['E3', 'E4', 'G4', 'C5'], 'Em/G': ['G2', 'E4', 'G4', 'B4'],
  A: ['A2', 'E4', 'A4', 'C#5'], E: ['E2', 'E4', 'G#4', 'B4'],
};
const chord = (name) => (CHORDS[name] || CHORDS.C).map(NOTE);

// ------------------------------------------------------------------ tracks
// Each track: bpm, beats per bar, chords per bar, a strum/arpeggio style and a
// melody as [note|null, beats] pairs that loops with the chords.
const TRACKS = {
  title: {
    bpm: 126, beats: 3, style: 'waltz', gain: 0.9,
    chords: ['G', 'G', 'D7', 'D7', 'D7', 'D7', 'G', 'G', 'C', 'C', 'G', 'G', 'D7', 'D7', 'G', 'G'],
    lead: 'marimba',
    melody: [['B4', 2], ['D5', 1], ['G5', 2], ['F#5', 1], ['A5', 2], ['G5', 1], ['F#5', 1], ['E5', 1], ['D5', 1],
      ['C5', 2], ['A4', 1], ['F#4', 1], ['A4', 1], ['C5', 1], ['B4', 3], ['G4', 1], ['A4', 1], ['B4', 1],
      ['C5', 2], ['E5', 1], ['G5', 2], ['E5', 1], ['D5', 2], ['B4', 1], ['G4', 1], ['A4', 1], ['B4', 1],
      ['A4', 2], ['C5', 1], ['F#5', 2], ['E5', 1], ['G5', 3], [null, 3]],
  },
  home: {
    bpm: 96, beats: 3, style: 'arp3', gain: 0.75,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G7'],
    lead: 'marimba', soft: true,
    melody: [['E5', 2], ['G5', 1], ['A5', 2], ['E5', 1], ['F5', 2], ['A5', 1], ['G5', 3],
      ['E5', 2], ['C5', 1], ['A4', 2], ['C5', 1], ['D5', 1], ['F5', 1], ['A5', 1], ['G5', 2], [null, 1]],
  },
  market: {
    bpm: 132, beats: 6, unit: 0.5, style: 'son', gain: 0.85,
    chords: ['D', 'A7', 'A7', 'D', 'G', 'D', 'A7', 'D'],
    lead: 'marimba',
    melody: [['F#5', 1], ['A5', 1], ['F#5', 1], ['D5', 1.5], ['E5', 1.5], ['C#5', 1], ['E5', 1], ['G5', 1], ['E5', 3],
      ['A4', 1], ['C#5', 1], ['E5', 1], ['G5', 1.5], ['F#5', 1.5], ['F#5', 1], ['E5', 1], ['D5', 1], ['D5', 3],
      ['B4', 1], ['D5', 1], ['G5', 1], ['B5', 1.5], ['A5', 1.5], ['A5', 1], ['F#5', 1], ['D5', 1], ['A4', 3],
      ['C#5', 1], ['E5', 1], ['G5', 1], ['F#5', 1.5], ['E5', 1.5], ['D5', 3], [null, 3]],
  },
  workshop: {
    bpm: 108, beats: 4, style: 'pop', gain: 0.75,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C7'],
    lead: 'marimba',
    melody: [['A4', 1], ['C5', 1], ['F5', 1.5], ['E5', 0.5], ['E5', 1], ['G5', 1], ['C5', 2], ['D5', 1], ['F5', 1], ['A5', 1.5], ['G5', 0.5],
      ['F5', 2], ['D5', 2], ['A4', 1], ['C5', 1], ['F5', 1], ['A5', 1], ['G5', 1.5], ['E5', 0.5], ['C5', 2], ['D5', 1], ['F5', 1], ['E5', 1], ['D5', 1], ['C5', 2], [null, 2]],
  },
  plaza: {
    bpm: 112, beats: 3, style: 'waltz', gain: 0.9, bassy: true,
    chords: ['F', 'F', 'C7', 'C7', 'C7', 'C7', 'F', 'F', 'Bb', 'Bb', 'F', 'F', 'C7', 'C7', 'F', 'F'],
    lead: 'flute',
    melody: [['C5', 1], ['F5', 1], ['A5', 1], ['C6', 2], ['A5', 1], ['G5', 1], ['E5', 1], ['C5', 1], ['G5', 3],
      ['Bb4', 1], ['C5', 1], ['E5', 1], ['G5', 2], ['Bb5', 1], ['A5', 3], [null, 3],
      ['D5', 1], ['F5', 1], ['Bb5', 1], ['D6', 2], ['Bb5', 1], ['A5', 1], ['F5', 1], ['C5', 1], ['F5', 3],
      ['E5', 1], ['G5', 1], ['Bb5', 1], ['A5', 1], ['G5', 1], ['E5', 1], ['F5', 3], [null, 3]],
  },
  cemetery: {
    bpm: 68, beats: 3, style: 'arp6', gain: 0.6,
    chords: ['Am', 'Am', 'E7', 'E7', 'Dm', 'Am', 'E7', 'Am', 'F', 'C', 'G', 'C', 'Dm', 'Am', 'E7', 'Am'],
    lead: 'flute', soft: true, sparse: true,
    melody: [['E5', 2], ['C5', 1], ['B4', 3], ['D5', 2], ['B4', 1], ['G#4', 3], ['F4', 2], ['A4', 1], ['C5', 3], ['B4', 2], ['G#4', 1], ['A4', 3],
      ['A4', 2], ['C5', 1], ['E5', 3], ['D5', 2], ['B4', 1], ['C5', 3], ['A4', 2], ['F4', 1], ['E4', 3], ['G#4', 2], ['B4', 1], ['A4', 3]],
  },
  ofrenda: {
    bpm: 72, beats: 4, style: 'arp8', gain: 0.7,
    chords: ['C', 'G/B', 'Am', 'Em/G', 'F', 'C/E', 'Dm', 'G'],
    lead: 'marimba', soft: true,
    melody: [['E5', 2], ['D5', 1], ['C5', 1], ['D5', 2], ['G4', 2], ['C5', 2], ['B4', 1], ['A4', 1], ['G4', 4],
      ['A4', 2], ['C5', 1], ['F5', 1], ['E5', 3], ['C5', 1], ['D5', 2], ['E5', 1], ['F5', 1], ['D5', 4]],
  },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.track = null;
    this.wanted = null;
    this.pluckCache = new Map();
    this.ambient = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.55 : 0;
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
    // a warm room reverb shared by everything
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.reverb.connect(wet).connect(this.master);
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.reverb);
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(this.reverb);
    this.noiseBuf = this.makeNoise(1.5);
    if (this.wanted) this.music(this.wanted, true);
    this._timer = setInterval(() => this.schedule(), 50);
    return true;
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.2);
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  impulse(sec) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  makeNoise(sec) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------------------------------------------------------------- instruments
  pluckBuffer(midi, bright = 0.5) {
    const key = `${midi}|${bright}`;
    if (this.pluckCache.has(key)) return this.pluckCache.get(key);
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const f = mtof(midi);
    const period = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * 1.5);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = (Math.random() * 2 - 1) * (1 - bright * 0.5 + bright * Math.random());
    // soften the excitation so it sounds like a nylon string
    for (let k = 0; k < 2; k++) for (let i = 1; i < period; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5;
    const decay = 0.996 - (midi > 72 ? 0.004 : 0);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % period;
      const v = ring[idx];
      d[i] = v;
      ring[idx] = (v + ring[next]) * 0.5 * decay;
      idx = next;
    }
    this.pluckCache.set(key, buf);
    return buf;
  }

  guitar(midi, when, vel = 0.3, bus = this.musicBus) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.pluckBuffer(midi, 0.4);
    const g = ctx.createGain();
    g.gain.value = vel;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    src.connect(lp).connect(g).connect(bus);
    src.start(when);
    src.stop(when + 1.5);
  }

  marimba(midi, when, vel = 0.25, bus = this.musicBus, len = 0.9) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    g.connect(bus);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = f;
    o1.connect(g);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vel * 0.35, when);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 3.93;
    o2.connect(g2).connect(bus);
    for (const o of [o1, o2]) { o.start(when); o.stop(when + len + 0.05); }
  }

  flute(midi, when, dur, vel = 0.12, bus = this.musicBus) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.value = f * 0.006;
    vib.connect(vg).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.08);
    g.gain.setValueAtTime(vel, when + Math.max(0.1, dur - 0.12));
    g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.05);
    o.connect(lp).connect(g).connect(bus);
    o.start(when); vib.start(when);
    o.stop(when + dur + 0.1); vib.stop(when + dur + 0.1);
  }

  bass(midi, when, dur = 0.5, vel = 0.3) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(this.musicBus);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  pad(notes, when, dur, vel = 0.05) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vel, when + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    lp.connect(g).connect(this.musicBus);
    for (const m of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        o.connect(lp);
        o.start(when);
        o.stop(when + dur + 0.05);
      }
    }
  }

  bell(midi, when, vel = 0.2, bus = this.sfxBus, len = 2.2) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.2, when);
    mg.gain.exponentialRampToValueAtTime(1, when + len);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    car.connect(g).connect(bus);
    car.start(when); mod.start(when);
    car.stop(when + len + 0.05); mod.stop(when + len + 0.05);
  }

  noise(when, dur, { freq = 1200, q = 1, type = 'bandpass', vel = 0.2, bus = this.sfxBus, sweep = null } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, when);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, when + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel, when + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(when, Math.random() * 0.5);
    src.stop(when + dur + 0.05);
  }

  tone(type, f0, f1, when, dur, vel = 0.2, bus = this.sfxBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(bus);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  // ---------------------------------------------------------------- music
  music(name, force = false) {
    this.wanted = name;
    if (!this.ctx) return;
    if (this.track?.name === name && !force) return;
    const tr = TRACKS[name];
    if (!tr) { this.track = null; return; }
    const now = this.ctx.currentTime + 0.15;
    this.track = { name, def: tr, bar: 0, next: now, mel: 0, melT: now, melBeat: 0 };
    // gentle fade-in
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.musicBus.gain.linearRampToValueAtTime(this.musicOn ? 0.55 : 0, this.ctx.currentTime + 1.2);
  }

  stopMusic() {
    this.wanted = null;
    this.track = null;
  }

  schedule() {
    if (!this.ctx || !this.track) { this.ambientTick(); return; }
    const ctx = this.ctx;
    const tr = this.track;
    const d = tr.def;
    const beat = 60 / d.bpm * (d.unit || 1);
    const ahead = ctx.currentTime + 0.3;
    while (tr.next < ahead) {
      const bar = tr.bar % d.chords.length;
      const notes = chord(d.chords[bar]);
      this.playBar(d, notes, tr.next, beat);
      tr.next += beat * d.beats;
      tr.bar++;
    }
    // melody runs on its own clock so phrases can cross bar lines
    const totalBeats = d.chords.length * d.beats;
    while (tr.melT < ahead) {
      const [n, len] = d.melody[tr.mel % d.melody.length];
      if (n && !(d.sparse && Math.floor(tr.mel / d.melody.length) % 2 === 1)) {
        const m = NOTE(n);
        if (d.lead === 'flute') this.flute(m, tr.melT, len * beat * 0.95, d.soft ? 0.07 : 0.1);
        else this.marimba(m, tr.melT, (d.soft ? 0.12 : 0.18) * d.gain, this.musicBus, Math.min(1.2, len * beat + 0.3));
      }
      tr.melT += len * beat;
      tr.melBeat += len;
      tr.mel++;
      if (tr.mel % d.melody.length === 0) {
        // re-align the melody to the chord loop
        const loops = Math.ceil(tr.melBeat / totalBeats);
        tr.melBeat = loops * totalBeats;
      }
    }
    this.ambientTick();
  }

  playBar(d, notes, t0, beat) {
    const [root, ...upper] = notes;
    const v = 0.22 * d.gain;
    if (d.style === 'waltz') {
      this.guitar(root, t0, v * 1.2);
      if (d.bassy) this.bass(root - 12, t0, beat * 0.9, 0.22);
      for (const b of [1, 2]) upper.forEach((m, i) => this.guitar(m, t0 + b * beat + i * 0.012, v * 0.7));
    } else if (d.style === 'arp3') {
      const seq = [root, upper[1], upper[2], upper[0], upper[1], upper[2]];
      seq.forEach((m, i) => this.guitar(m, t0 + i * beat * 0.5, v * (i === 0 ? 1.1 : 0.7)));
    } else if (d.style === 'arp6' || d.style === 'arp8') {
      const n = d.style === 'arp6' ? 6 : 8;
      const seq = [root, upper[0], upper[1], upper[2], upper[1], upper[0], upper[1], upper[2]];
      for (let i = 0; i < n; i++) this.guitar(seq[i % seq.length], t0 + i * beat * (d.beats / n), v * (i === 0 ? 1.0 : 0.6));
      if (d.soft) this.pad(upper.map((m) => m - 12), t0, beat * d.beats, 0.025);
    } else if (d.style === 'son') {
      // 6/8 with accents on 1 and 4, strums in between
      this.bass(root - 12, t0, beat * 2.5, 0.26);
      this.bass(root - 5, t0 + beat * 3, beat * 2.5, 0.2);
      for (let i = 0; i < 6; i++) {
        const acc = i === 0 || i === 3;
        upper.forEach((m, k) => this.guitar(m, t0 + i * beat + k * 0.008, v * (acc ? 0.9 : 0.45)));
        if (i % 3 === 2) this.noise(t0 + i * beat, 0.05, { freq: 7000, type: 'highpass', vel: 0.035, bus: this.musicBus });
      }
    } else if (d.style === 'pop') {
      this.bass(root - 12, t0, beat * 0.9, 0.24);
      this.bass(root - 12, t0 + beat * 2, beat * 0.9, 0.2);
      for (let i = 0; i < d.beats * 2; i++) {
        if (i % 2 === 1) upper.forEach((m, k) => this.guitar(m, t0 + i * beat * 0.5 + k * 0.01, v * 0.55));
      }
      this.noise(t0 + beat, 0.06, { freq: 5000, type: 'highpass', vel: 0.03, bus: this.musicBus });
      this.noise(t0 + beat * 3, 0.06, { freq: 5000, type: 'highpass', vel: 0.03, bus: this.musicBus });
    }
  }

  // night ambience: crickets + an occasional far-off church bell
  setAmbient(kind) { this.ambient = kind ? { kind, next: 0 } : null; }

  ambientTick() {
    if (!this.ctx || !this.ambient || !this.musicOn) return;
    const now = this.ctx.currentTime;
    if (now < this.ambient.next) return;
    if (this.ambient.kind === 'night') {
      const base = 4200 + Math.random() * 600;
      for (let i = 0; i < 3; i++) this.tone('sine', base, base * 0.98, now + i * 0.07, 0.04, 0.012, this.musicBus);
      if (Math.random() < 0.05) this.bell(NOTE('G3'), now + 0.2, 0.05, this.musicBus, 4);
      this.ambient.next = now + 0.6 + Math.random() * 1.6;
    } else if (this.ambient.kind === 'crowd') {
      this.noise(now, 1.4, { freq: 500, q: 0.6, vel: 0.02, bus: this.musicBus });
      this.ambient.next = now + 1.1;
    } else if (this.ambient.kind === 'birds') {
      const f = 2600 + Math.random() * 1500;
      this.tone('sine', f, f * 1.4, now, 0.09, 0.02, this.musicBus);
      this.tone('sine', f * 1.2, f * 0.9, now + 0.12, 0.08, 0.016, this.musicBus);
      this.ambient.next = now + 2 + Math.random() * 4;
    }
  }

  // ---------------------------------------------------------------- effects
  sfx(name) {
    if (!this.ensure() || !this.sfxOn) return;
    const t = this.ctx.currentTime + 0.01;
    const B = this.sfxBus;
    switch (name) {
      case 'tap':
        this.tone('sine', 880, 560, t, 0.06, 0.18);
        this.noise(t, 0.03, { freq: 3000, vel: 0.05 });
        break;
      case 'tick':
        this.tone('sine', 1500, 1200, t, 0.03, 0.08);
        break;
      case 'card':
        ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => this.marimba(NOTE(n), t + i * 0.07, 0.22, B, 0.8));
        this.bell(NOTE('C7'), t + 0.3, 0.06, B, 1.6);
        break;
      case 'pickup':
        this.marimba(NOTE('G5'), t, 0.25, B);
        this.marimba(NOTE('D6'), t + 0.09, 0.25, B);
        this.noise(t + 0.05, 0.3, { freq: 8000, type: 'highpass', vel: 0.04 });
        break;
      case 'sparkle':
        for (let i = 0; i < 5; i++) this.bell(NOTE('C6') + [0, 4, 7, 12, 16][i], t + i * 0.05, 0.05, B, 1.0);
        break;
      case 'chime':
        this.bell(NOTE('E6'), t, 0.12, B, 1.8);
        break;
      case 'success':
        ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => this.marimba(NOTE(n), t + i * 0.1, 0.25, B, 1.0));
        chord('C').forEach((m, i) => this.guitar(m + 12, t + 0.42 + i * 0.02, 0.25, B));
        this.bell(NOTE('G6'), t + 0.45, 0.06, B, 2);
        break;
      case 'loteria':
        ['G5', 'C6', 'E6', 'G6', 'E6', 'G6', 'C7'].forEach((n, i) => this.marimba(NOTE(n), t + i * 0.09, 0.25, B, 0.9));
        break;
      case 'tok':
        this.tone('sine', 220, 90, t, 0.12, 0.35);
        this.noise(t, 0.08, { freq: 2200, q: 2, vel: 0.25 });
        break;
      case 'snip':
        this.noise(t, 0.05, { freq: 5000, q: 3, vel: 0.2 });
        this.noise(t + 0.06, 0.05, { freq: 6000, q: 3, vel: 0.15 });
        break;
      case 'whoosh':
        this.noise(t, 0.5, { freq: 400, sweep: 3000, q: 1.2, vel: 0.12 });
        break;
      case 'petal':
        this.noise(t, 0.4, { freq: 6000, type: 'highpass', vel: 0.05 });
        this.bell(NOTE('A6') + Math.floor(Math.random() * 5), t, 0.03, B, 0.8);
        break;
      case 'strike':
        this.noise(t, 0.12, { freq: 3500, q: 1.5, vel: 0.25 });
        this.noise(t + 0.1, 0.5, { freq: 700, sweep: 300, q: 0.8, vel: 0.12 });
        break;
      case 'bark':
        for (const dt of [0, 0.22]) {
          this.tone('sawtooth', 620, 380, t + dt, 0.11, 0.12);
          this.noise(t + dt, 0.1, { freq: 900, q: 3, vel: 0.12 });
        }
        break;
      case 'ding':
        this.bell(NOTE('A6'), t, 0.2, B, 2.4);
        break;
      case 'page':
        this.noise(t, 0.18, { freq: 2500, sweep: 900, q: 0.7, vel: 0.08 });
        break;
      case 'bean':
        this.tone('sine', 700, 420, t, 0.07, 0.2);
        this.noise(t, 0.04, { freq: 1800, q: 2, vel: 0.1 });
        break;
      case 'knead':
        this.noise(t, 0.16, { freq: 300, q: 0.7, vel: 0.12 });
        break;
      case 'pour':
        this.noise(t, 0.6, { freq: 1200, sweep: 600, q: 0.5, vel: 0.07 });
        break;
      case 'oops':
        this.tone('sine', 400, 300, t, 0.15, 0.12);
        break;
      case 'brush':
        this.noise(t, 0.25, { freq: 1600, q: 0.6, vel: 0.08 });
        break;
      default:
        break;
    }
  }
}
