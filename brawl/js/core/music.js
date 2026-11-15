// Music. Eight original tunes, written out below as notes and played by a
// little tracker-style sequencer: lead, chords, bass and a drum kit, the way
// module music for web games used to be put together.

const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function midi(name) {
  const m = /^([a-g])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  return 12 * (parseInt(m[3], 10) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9], mM7: [0, 3, 7, 11], dim: [0, 3, 6], sus4: [0, 5, 7], aug: [0, 4, 8],
};
function chord(sym) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
  const root = NOTE[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { root, iv: QUAL[m[3]] || QUAL[''] };
}

// ---------------------------------------------------------------- the tunes --
// lead: one string per bar; 8 tokens = eighth notes, 16 = sixteenths (waltzes: 3 / 6 / 12).
//   note name, '-' = hold the previous note, '.' = rest
const SONGS = {
  menu: {
    bpm: 126, vol: 0.9,
    chords: 'C Am F G C Am F G F G Em Am F G C C',
    lead: { inst: 'mallet', vol: 0.67, bars: [
      'e5 g5 . e5 g5 . c6 .', 'a5 . e5 . c5 e5 a5 -', 'f5 a5 . f5 a5 . c6 .', 'b5 . g5 . d5 g5 b5 -',
      'e5 g5 . e5 g5 . e6 .', 'c6 . a5 . e5 a5 c6 -', 'a5 c6 . a5 f5 . a5 .', 'g5 - - b5 d6 - - .',
      'c6 - a5 f5 a5 - c6 .', 'd6 - b5 g5 b5 - d6 .', 'b5 - g5 e5 g5 - b5 .', 'c6 - a5 e5 a5 - - .',
      'a5 a5 . c6 . a5 f5 .', 'b5 b5 . d6 . b5 g5 .', 'c6 . g5 . e5 . g5 .', 'c6 - - . g5 g5 c6 .'] },
    comp: { inst: 'organ', style: 'offbeat', vol: 0.37, oct: 4 },
    bass: { inst: 'bass', style: 'bounce', vol: 0.41 },
    drums: { style: 'rock', vol: 0.7, light: true },
  },
  lab: {
    bpm: 152, vol: 0.85,
    chords: 'Am Am F G Am Am F E C G Am F C G E E',
    lead: { inst: 'pulse', vol: 0.44, bars: [
      'a4 c5 e5 a5 . g5 e5 c5', 'd5 e5 . c5 a4 - . .', 'f4 a4 c5 f5 . e5 c5 a4', 'b4 d5 g5 - . d5 b4 g4',
      'a4 c5 e5 a5 . c6 a5 e5', 'g5 e5 . c5 d5 e5 - .', 'f5 - e5 f5 a5 - g5 f5', 'e5 - g#5 - b5 - - .',
      'c5 e5 g5 c6 - g5 e5 g5', 'b4 d5 g5 b5 - g5 d5 g5', 'a5 - e5 a5 c6 - b5 a5', 'f5 - c5 f5 a5 - g5 f5',
      'e5 g5 c6 e6 - c6 g5 e5', 'd5 g5 b5 d6 - b5 g5 d5', 'e5 g#5 b5 e6 . d6 b5 g#5', 'e5 - - . e5 e5 e5 .'] },
    comp: { inst: 'saw', style: 'stab', vol: 0.24, oct: 4 },
    bass: { inst: 'bass', style: 'octaves', vol: 0.42 },
    drums: { style: 'rock', vol: 0.8 },
  },
  cafeteria: {
    bpm: 132, vol: 0.9,
    chords: 'F F C7 C7 C7 C7 F F Bb Bb F F C7 C7 F F',
    lead: { inst: 'reed', vol: 0.41, bars: [
      'c5 f5 a5 c6 a5 f5 c5 f5', 'a5 . a5 . a5 g5 f5 .', 'e5 g5 bb5 c6 bb5 g5 e5 g5', 'bb5 . bb5 . bb5 a5 g5 .',
      'c5 e5 g5 bb5 g5 e5 c5 e5', 'g5 . bb5 . e6 d6 c6 .', 'f5 a5 c6 f6 c6 a5 f5 a5', 'f5 - . . c5 d5 e5 .',
      'd5 f5 bb5 d6 bb5 f5 d5 f5', 'bb5 . d6 . bb5 a5 g5 .', 'c5 f5 a5 c6 a5 f5 c5 f5', 'a5 . c6 . a5 g5 f5 .',
      'e5 g5 bb5 e6 d6 c6 bb5 g5', 'a5 g5 e5 g5 c6 bb5 g5 e5', 'f5 . a5 . c6 . f6 .', 'f5 - - . . . . .'] },
    comp: { inst: 'organ', style: 'pah', vol: 0.39, oct: 4 },
    bass: { inst: 'tuba', style: 'oompah', vol: 0.48 },
    drums: { style: 'polka', vol: 0.7 },
  },
  sneaky: {
    bpm: 104, vol: 0.95, swing: 0.3,
    chords: 'Dm DmmM7 Dm7 Dm6 Gm Gm A7 A7 Dm Dm Bb Bb Gm A7 Dm A7',
    lead: { inst: 'pluck', vol: 0.73, bars: [
      'd5 . f5 . a5 . . .', 'c#5 . f5 . a5 . . .', 'c5 . f5 . a5 . c6 .', 'b4 . f5 . a5 - . .',
      'g4 . bb4 . d5 . g5 .', 'f#5 g5 . bb5 . g5 d5 .', 'e5 . c#5 . a4 . e5 .', 'a5 - . . . g5 f5 e5',
      'd5 f5 a5 d6 . a5 f5 .', 'e5 f5 . d5 . . a4 .', 'bb4 d5 f5 bb5 . f5 d5 .', 'a5 bb5 . f5 . . d5 .',
      'g5 . bb5 . d6 . bb5 g5', 'a5 . c#6 . e6 . . .', 'd6 . a5 . f5 . d5 .', 'e5 . a4 . c#5 . e5 .'] },
    comp: { inst: 'mallet', style: 'charleston', vol: 0.24, oct: 4 },
    bass: { inst: 'upright', style: 'walk', vol: 0.51 },
    drums: { style: 'sneak', vol: 0.6 },
  },
  recess: {
    bpm: 118, vol: 0.9,
    chords: 'G C G D G C D G Em C G D Em C D D',
    lead: { inst: 'steel', vol: 0.61, bars: [
      'g5 . b5 g5 . b5 d6 .', 'e6 . c6 e6 . c6 g5 .', 'd6 . b5 d6 . b5 g5 .', 'a5 . f#5 a5 . d6 - .',
      'g5 . b5 g5 . b5 d6 .', 'e6 . g6 e6 . c6 e6 .', 'd6 . c6 b5 . a5 f#5 .', 'g5 - - . d5 g5 b5 .',
      'e5 . g5 b5 . g5 e6 .', 'e6 . c6 g5 . c6 e6 .', 'd6 . b5 g5 . b5 d6 .', 'f#6 . d6 a5 . d6 f#6 .',
      'g6 . e6 b5 . e6 g6 .', 'e6 . c6 g5 . e6 c6 .', 'd6 . a5 f#5 . a5 d6 .', 'd6 - c6 - a5 - f#5 .'] },
    comp: { inst: 'pluck', style: 'offbeat', vol: 0.37, oct: 4 },
    bass: { inst: 'bass', style: 'calypso', vol: 0.41 },
    drums: { style: 'calypso', vol: 0.65 },
  },
  hardest: {
    bpm: 140, vol: 0.85,
    chords: 'Am Am F G Am Am F E Dm Dm Am Am F F E E',
    lead: { inst: 'sawlead', vol: 0.46, bars: [
      'a4 . . a4 . . c5 . e5 . . e5 . . d5 .', 'c5 . . a4 . . g4 . a4 - - - . . . .', 'f4 . . f4 . . a4 . c5 . . c5 . . a4 .', 'g4 . . b4 . . d5 . g5 - - - . . . .',
      'a4 . . a4 . . c5 . e5 . . e5 . . g5 .', 'a5 . . g5 . . e5 . c5 - - - . . . .', 'f5 . . e5 . . c5 . a4 . . c5 . . f5 .', 'e5 . . g#5 . . b5 . e6 - - - . . . .',
      'd5 . f5 . a5 . d6 . a5 . f5 . d5 . f5 .', 'a5 . f5 . d5 . a4 . d5 - - - . . . .', 'e5 . a5 . c6 . e6 . c6 . a5 . e5 . a5 .', 'c6 . a5 . e5 . c5 . e5 - - - . . . .',
      'f5 . a5 . c6 . f6 . c6 . a5 . f5 . a5 .', 'c6 . a5 . f5 . c5 . f5 - - - . . . .', 'e5 . g#5 . b5 . e6 . b5 . g#5 . e5 . g#5 .', 'e6 - - - d6 - - - b5 - - - g#5 - - -'] },
    comp: { inst: 'saw', style: 'pump', vol: 0.20, oct: 4 },
    bass: { inst: 'bass', style: 'arp16', vol: 0.26 },
    drums: { style: 'four', vol: 0.8 },
  },
  doodle: {
    bpm: 160, vol: 0.95, steps: 12,
    chords: 'G G D7 D7 D7 D7 G G C C G G D7 D7 G G',
    lead: { inst: 'musicbox', vol: 0.67, bars: [
      'g5 b5 d6', 'b5 - g5', 'a5 c6 f#6', 'c6 - a5', 'f#5 a5 c6', 'e6 d6 c6', 'b5 d6 g6', 'g6 - .',
      'e6 c6 e6', 'g6 - e6', 'd6 b5 d6', 'g6 - d6', 'c6 a5 f#5', 'a5 c6 e6', 'd6 b5 g5', 'g5 - .'] },
    comp: { inst: 'pluck', style: 'waltz', vol: 0.44, oct: 4 },
    bass: { inst: 'upright', style: 'waltz', vol: 0.48 },
    drums: { style: 'waltz', vol: 0.45 },
  },
  results: {
    bpm: 120, vol: 0.9,
    chords: 'C F C G Am F G C',
    lead: { inst: 'reed', vol: 0.41, bars: [
      'c5 e5 g5 c6 - g5 e5 g5', 'a5 - f5 a5 c6 - a5 .', 'g5 - e5 g5 c6 - e6 .', 'd6 - b5 g5 b5 - d6 .',
      'c6 - a5 e5 a5 - c6 .', 'a5 - f5 c5 f5 - a5 .', 'b5 - g5 d5 g5 b5 d6 .', 'c6 - - . c6 c6 c6 .'] },
    comp: { inst: 'organ', style: 'stab', vol: 0.34, oct: 4 },
    bass: { inst: 'bass', style: 'octaves', vol: 0.41 },
    drums: { style: 'rock', vol: 0.7, clap: true },
  },
};
export const SONG_IDS = Object.keys(SONGS);

// drum patterns: step -> hits (k kick, s snare, h hat, o open hat, c clap, r rim, b cowbell, t shaker)
const DRUMS = {
  rock: (s, bar, o) => (s % 8 === 0 ? 'k' : '') + (s === 10 && bar % 2 ? 'k' : '') + (s % 8 === 4 ? (o.clap ? 'sc' : 's') : '') + (s % 2 === 0 ? (s === 14 ? 'o' : 'h') : (o.light ? '' : (bar % 4 === 3 && s > 11 ? 's' : ''))),
  four: (s, bar) => (s % 4 === 0 ? 'k' : '') + (s % 8 === 4 ? 'c' : '') + (s % 4 === 2 ? 'o' : 'h') + (bar % 8 === 7 && s > 11 ? 's' : ''),
  polka: (s) => (s % 8 === 0 ? 'k' : '') + (s % 8 === 4 ? 's' : '') + (s % 2 === 0 ? 'h' : ''),
  sneak: (s, bar) => (s === 0 ? 'k' : '') + (s === 10 && bar % 2 ? 'k' : '') + (s % 8 === 4 ? 'c' : '') + (s % 4 === 0 || s % 4 === 2 ? 't' : ''),
  calypso: (s) => (s === 0 || s === 6 || s === 12 ? 'k' : '') + (s === 3 || s === 10 ? 'r' : '') + (s % 4 === 0 ? 'b' : '') + 't',
  waltz: (s) => (s === 0 ? 'k' : '') + (s === 4 || s === 8 ? 'h' : ''),
};
// chord stab rhythms: steps on which the chord sounds, [step, length in steps]
const COMP = {
  offbeat: [[2, 2], [6, 2], [10, 2], [14, 2]],
  pah: [[4, 2], [12, 2]],
  stab: [[0, 2], [3, 2], [6, 3], [10, 2], [12, 3]],
  charleston: [[0, 3], [6, 5]],
  pump: [[2, 2], [6, 2], [10, 2], [14, 2]],
  waltz: [[4, 3], [8, 3]],
};
// bass lines from a chord: returns [[step, semitone offset from root, length]]
const BASS = {
  octaves: () => [[0, 0, 2], [2, 0, 2], [4, 12, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 12, 2], [14, 7, 2]],
  bounce: (c) => [[0, 0, 3], [4, c.iv[1], 2], [6, 7, 2], [8, 0, 3], [12, 7, 2], [14, c.iv[1], 2]],
  oompah: () => [[0, 0, 3], [8, 7, 3]],
  walk: (c, next) => [[0, 0, 4], [4, c.iv[1], 4], [8, 7, 4], [12, ((next.root - c.root + 12) % 12) + (((next.root - c.root + 12) % 12) > 6 ? 1 : -1), 4]],
  calypso: () => [[0, 0, 4], [6, 7, 4], [12, 12, 3]],
  arp16: () => [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 7, 0, 12, 7].map((n, i) => [i, n, 1]),
  waltz: () => [[0, 0, 8]],
};

function compile(song) {
  const steps = song.steps || 16;
  const chords = song.chords.split(' ').map(chord);
  const bars = chords.length;
  const lead = [];
  song.lead.bars.forEach((str, bi) => {
    const tok = str.trim().split(/\s+/), per = steps / tok.length;
    let cur = null;
    tok.forEach((t, i) => {
      if (t === '-') { if (cur) cur.len += per; return; }
      if (t === '.') { cur = null; return; }
      cur = { bar: bi, step: i * per, len: per, n: midi(t) };
      lead.push(cur);
    });
  });
  return { steps, chords, bars, lead };
}

// ------------------------------------------------------------------ player --
export class Music {
  constructor(audio) {
    this.audio = audio; this.id = null; this.song = null; this.c = null;
    this.timer = null; this.bar = 0; this.step = 0; this.next = 0; this.out = null; this.noise = null;
    this._duck = 1;
  }
  get ctx() { return this.audio.ctx; }
  level() { return (this.song.vol || 1) * 0.42; }      // the mix runs hot; this leaves room for sound effects

  play(id) {
    if (!SONGS[id]) id = 'lab';
    this.want = id;
    if (!this.ctx || !this.audio.ready) return;      // will start once audio is unlocked
    if (this.id === id && this.timer) return;
    this.halt();
    const ctx = this.ctx;
    this.id = id; this.song = SONGS[id]; this.c = compile(this.song);
    this.out = ctx.createGain(); this.out.gain.value = 0.0001;
    this.out.gain.exponentialRampToValueAtTime(this.level(), ctx.currentTime + 0.25);
    // a touch of echo on the tune so it doesn't sound bone dry
    this.echo = ctx.createDelay(1); this.echo.delayTime.value = (60 / this.song.bpm) * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.22; const wet = ctx.createGain(); wet.gain.value = 0.16;
    this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(wet); wet.connect(this.out);
    this.out.connect(this.audio.musicGain);
    if (!this.noise) {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    this.bar = 0; this.step = 0; this.next = ctx.currentTime + 0.12;
    this.timer = setInterval(() => this.pump(), 25);
  }
  resume() { if (this.want && !this.timer) this.play(this.want); }
  halt() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.out) { const o = this.out; try { o.gain.cancelScheduledValues(0); o.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05); } catch (e) { /* closing */ } setTimeout(() => { try { o.disconnect(); } catch (e) { /* gone */ } }, 600); }
    this.out = null; this.id = null;
  }
  stop() { this.want = null; this.halt(); }
  duck() {
    if (!this.out) return;
    const t = this.ctx.currentTime, g = this.out.gain;
    g.cancelScheduledValues(t); g.setTargetAtTime(this.level() * 0.25, t, 0.15); g.setTargetAtTime(this.level(), t + 3.2, 0.5);
  }

  pump() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05;   // tab was asleep
    const s = this.song, c = this.c, sd = 60 / s.bpm / 4;
    while (this.next < ctx.currentTime + 0.14) {
      let t = this.next;
      if (s.swing && this.step % 4 >= 2) t += sd * 2 * s.swing * (this.step % 4 === 2 ? 1 : 0.6);
      this.tick(this.bar, this.step, t, sd);
      this.next += sd;
      if (++this.step >= c.steps) { this.step = 0; this.bar = (this.bar + 1) % c.bars; }
    }
  }

  tick(bar, step, t, sd) {
    const s = this.song, c = this.c, ch = c.chords[bar], nx = c.chords[(bar + 1) % c.bars];
    for (const n of c.lead) if (n.bar === bar && n.step === step) this.voice(s.lead.inst, hz(n.n), t, n.len * sd, s.lead.vol, true);
    if (s.comp) {
      const pat = COMP[s.comp.style] || COMP.stab;
      for (const p of pat) if (p[0] === step) {
        const base = 12 * (s.comp.oct + 1) + ch.root;
        for (let i = 0; i < Math.min(3, ch.iv.length); i++) {
          const iv = ch.iv.length > 3 && i === 0 ? ch.iv[3] - 12 : ch.iv[i];   // 7th chords: drop the root for the 7th
          this.voice(s.comp.inst, hz(base + iv), t, p[1] * sd * 0.9, s.comp.vol * 0.6, false);
        }
      }
    }
    if (s.bass) {
      for (const b of BASS[s.bass.style](ch, nx)) if (b[0] === step) {
        let n = 36 + ch.root + b[1]; if (n > 50) n -= 12;
        this.voice(s.bass.inst, hz(n), t, b[2] * sd * 0.92, s.bass.vol, false);
      }
    }
    if (s.drums) {
      const hits = DRUMS[s.drums.style](step, bar, s.drums);
      for (let i = 0; i < hits.length; i++) this.drum(hits[i], t, s.drums.vol);
    }
  }

  // ---- instruments ----
  osc(type, f, t, dur, detune = 0) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    o.start(t); o.stop(t + dur + 0.05); return o;
  }
  env(t, dur, peak, a = 0.005, rel = 0.05, sus = 1) {
    const g = this.ctx.createGain(), p = g.gain;
    p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a);
    if (sus < 1) p.setTargetAtTime(peak * sus, t + a, Math.max(0.01, dur * 0.3));
    p.setTargetAtTime(0.0001, t + Math.max(a, dur - rel), rel / 3);
    return g;
  }
  lp(freq, q = 0.7) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q; return f; }

  voice(inst, f, t, dur, vol, echo) {
    const ctx = this.ctx, dest = this.out;
    let g, tail = dur;
    switch (inst) {
      case 'pulse': {          // two slightly detuned squares with a late vibrato: the chip lead
        g = this.env(t, dur, vol, 0.004, 0.04, 0.7);
        const f1 = this.lp(4200), o1 = this.osc('square', f, t, dur), o2 = this.osc('square', f, t, dur, 9);
        const l = this.osc('sine', 5.5, t, dur), lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.3);
        l.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
        const m = ctx.createGain(); m.gain.value = 0.5; o1.connect(m); o2.connect(m); m.connect(f1); f1.connect(g); break;
      }
      case 'sawlead': {
        g = this.env(t, dur, vol, 0.006, 0.06, 0.8);
        const fl = this.lp(900, 3); fl.frequency.setValueAtTime(700, t); fl.frequency.exponentialRampToValueAtTime(3600, t + 0.04); fl.frequency.setTargetAtTime(1500, t + 0.05, 0.12);
        for (const d of [-11, 0, 11]) { const o = this.osc('sawtooth', f, t, dur, d); const m = ctx.createGain(); m.gain.value = 0.34; o.connect(m); m.connect(fl); }
        fl.connect(g); break;
      }
      case 'saw': {            // chord stabs
        g = this.env(t, dur, vol, 0.006, 0.05, 0.5);
        const fl = this.lp(2200, 1.2); fl.frequency.setValueAtTime(2600, t); fl.frequency.setTargetAtTime(700, t, 0.09);
        const o1 = this.osc('sawtooth', f, t, dur, -7), o2 = this.osc('sawtooth', f, t, dur, 7);
        o1.connect(fl); o2.connect(fl); fl.connect(g); break;
      }
      case 'organ': {          // cheesy drawbar organ
        g = this.env(t, dur, vol, 0.006, 0.03);
        for (const [mul, a] of [[1, 0.6], [2, 0.3], [3, 0.16], [4, 0.1]]) { const o = this.osc('sine', f * mul, t, dur); const m = ctx.createGain(); m.gain.value = a; o.connect(m); m.connect(g); }
        break;
      }
      case 'reed': {           // nasal clarinet/kazoo sort of lead
        g = this.env(t, dur, vol, 0.012, 0.05, 0.85);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(2400, f * 2.2 + 500); bp.Q.value = 1.1;
        const o1 = this.osc('square', f, t, dur), o2 = this.osc('sawtooth', f, t, dur, 5);
        const l = this.osc('sine', 5.8, t, dur), lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.01, t + 0.22);
        l.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
        const m = ctx.createGain(); m.gain.value = 0.9; o1.connect(m); o2.connect(m); m.connect(bp); bp.connect(g);
        const dry = ctx.createGain(); dry.gain.value = 0.25; m.connect(dry); const lp2 = this.lp(1800); dry.connect(lp2); lp2.connect(g); break;
      }
      case 'mallet': case 'steel': case 'musicbox': {   // struck bar: a sine with a bright, quickly dying overtone
        tail = Math.max(dur, inst === 'musicbox' ? 0.9 : 0.45);
        g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.01, inst === 'musicbox' ? 0.3 : inst === 'steel' ? 0.2 : 0.16);
        const o = this.osc('sine', f, t, tail); o.connect(g);
        const ratio = inst === 'steel' ? 2.0 : inst === 'musicbox' ? 5.4 : 3.98, amt = inst === 'steel' ? 0.5 : 0.42;
        const o2 = this.osc('sine', f * ratio, t, tail), g2 = ctx.createGain(); g2.gain.setValueAtTime(amt, t); g2.gain.setTargetAtTime(0.0001, t, inst === 'steel' ? 0.09 : 0.04);
        o2.connect(g2); g2.connect(g);
        if (inst === 'steel') { const o3 = this.osc('sine', f * 3.01, t, tail), g3 = ctx.createGain(); g3.gain.setValueAtTime(0.22, t); g3.gain.setTargetAtTime(0.0001, t, 0.06); o3.connect(g3); g3.connect(g); }
        break;
      }
      case 'pluck': {          // pizzicato
        tail = Math.max(dur, 0.25);
        g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.085);
        const fl = this.lp(3000, 1); fl.frequency.setValueAtTime(3200, t); fl.frequency.setTargetAtTime(500, t, 0.05);
        const o = this.osc('sawtooth', f, t, tail), o2 = this.osc('triangle', f, t, tail); o.connect(fl); o2.connect(fl); fl.connect(g); break;
      }
      case 'upright': {        // plucked double bass
        tail = Math.max(dur, 0.3);
        g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.16);
        const fl = this.lp(900, 1); fl.frequency.setValueAtTime(1400, t); fl.frequency.setTargetAtTime(260, t, 0.07);
        const o = this.osc('triangle', f, t, tail), o2 = this.osc('sawtooth', f, t, tail); const m = ctx.createGain(); m.gain.value = 0.35; o2.connect(m); m.connect(fl); o.connect(fl); fl.connect(g); break;
      }
      case 'tuba': {
        g = this.env(t, dur, vol, 0.02, 0.06, 0.8);
        const fl = this.lp(420, 1.5); const o = this.osc('sawtooth', f, t, dur), o2 = this.osc('square', f, t, dur); const m = ctx.createGain(); m.gain.value = 0.5;
        o.connect(m); o2.connect(m); m.connect(fl); fl.connect(g); break;
      }
      default: {               // 'bass': punchy synth bass
        g = this.env(t, dur, vol, 0.004, 0.04, 0.6);
        const fl = this.lp(700, 2); fl.frequency.setValueAtTime(1500, t); fl.frequency.setTargetAtTime(380, t, 0.06);
        const o = this.osc('sawtooth', f, t, dur), o2 = this.osc('square', f, t, dur, 4), sub = this.osc('sine', f, t, dur);
        const m = ctx.createGain(); m.gain.value = 0.55; o.connect(m); o2.connect(m); m.connect(fl); fl.connect(g); const sg = ctx.createGain(); sg.gain.value = 0.3; sub.connect(sg); sg.connect(g);
      }
    }
    g.connect(dest);
    if (echo) g.connect(this.echo);
  }

  nz(t, dur, vol, type, freq, q = 0.8) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }
  blip(t, f0, f1, dur, vol, type = 'sine') {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  drum(k, t, v) {
    switch (k) {
      case 'k': this.blip(t, 160, 48, 0.13, v * 0.6); this.nz(t, 0.012, v * 0.3, 'lowpass', 2500); break;
      case 's': this.nz(t, 0.14, v * 0.5, 'highpass', 1500); this.blip(t, 240, 170, 0.07, v * 0.4, 'triangle'); break;
      case 'h': this.nz(t, 0.035, v * 0.2, 'highpass', 7500); break;
      case 'o': this.nz(t, 0.16, v * 0.2, 'highpass', 6500); break;
      case 'c': this.nz(t, 0.02, v * 0.4, 'bandpass', 1300, 1.2); this.nz(t + 0.012, 0.02, v * 0.4, 'bandpass', 1300, 1.2); this.nz(t + 0.024, 0.11, v * 0.45, 'bandpass', 1300, 1.2); break;
      case 'r': this.blip(t, 1700, 1500, 0.03, v * 0.35, 'square'); break;
      case 'b': this.blip(t, 800, 790, 0.09, v * 0.16, 'square'); this.blip(t, 540, 535, 0.09, v * 0.16, 'square'); break;
      case 't': this.nz(t, 0.045, v * 0.1, 'bandpass', 6000, 2); break;
    }
  }
}
