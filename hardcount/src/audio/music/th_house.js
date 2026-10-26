// House family: showroom (filtered funky French-touch house: four-on-the-floor,
// a chopped disco chord loop through a sweeping resonant filter with sidechain
// pump, slap-octave bass, talkbox lead) and results_win (triumphant major
// house groove: piano stabs, octave bass, bright hook).

import { Song } from './song.js';
import { Mono, Poly, VOWELS } from './inst.js';
import { pat, rolePat } from './util.js';

const FUNK_BASS = {
  oscs: [{ type: 'sawtooth', gain: 0.5 }, { type: 'square', gain: 0.3, detune: 4 }], cut: 380, q: 6, poles: 2, env: 1800,
  fatk: 0.002, fdec: 0.11, keytrack: 1.2, atk: 0.003, sus: 0.6, dec: 0.25, rel: 0.05, glide: 0.04, level: 0.42,
  sub: 0.5, subMul: 1, drive: 1.5, post: 4000,
};

const HOUSE_DRUMS = {
  A: {
    kick: pat('X...X...X...X...'),
    clap: pat('....X.......X...'),
    ohat: pat('..x...x...x...x.'),
    hat: pat('o.g.o.g.o.g.o.g.'),
  },
  B: {
    kick: pat('X...X...X...X...'),
    clap: pat('....X.......X...'),
    ohat: pat('..x...x...x...x.'),
    hat: pat('ogxgogxgogxgogxg'),
    shaker: pat('o.o.o.o.o.o.o.o.'),
    tamb: pat('....x.......x...'),
  },
  break: { hat: pat('o.g.o.g.o.g.o.g.'), shaker: pat('o.o.o.o.o.o.o.o.') },
};

export class Showroom extends Song {
  static kind = 'menu';
  static intensity = 0.4;

  compose(r) {
    this.bpm = r.pick([122, 124, 124, 126]);
    this.swing = r.range(0.04, 0.12);
    this.keyPc = r.pick([9, 2, 4, 7, 5]);
    const opt = r.pick([
      ['dorian', 'i7:1 IV9:1'],
      ['major', 'IVM7 iii7 vi9:2'],
      ['major', 'ii7 V9 IM7 vi7'],
      ['dorian', 'i9:2 bVIIadd9:1 IV9:1'],
      ['major', 'vi9 IVM7 IM7 V'],
    ]);
    this.scale = opt[0];
    this.progs.main = this.P(opt[1]);
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers.break = 'pad fx cym chords lead hats perc';
    this.kit = { ...this.kit, kick: 'kick_house', clap: 'clap', hat: 'hat_c', ohat: 'hat_o' };
    this.drums = HOUSE_DRUMS;
    this.bassPat = rolePat(r.pick([
      'R.O..RR..R.O.RO.',
      'R..R.O.RR..R.O..',
      'R.r.O..rR.r.O.rA',
      'R..rO..rR.rO.R.o',
    ]));
    this.loopPat = r.pick([
      'x.x..x.x..x.x..x',
      'x..x..x.x..x..x.',
      'x-x-.x-x..x-x.x.',
      '.x.x.x..x.x..x.x',
    ]);
    this.talkMel = this.hook({ bars: 4, lo: 64, hi: 79, call: 'x..x.x..x..x.x..', resp: 'x.x..x..x-x-....', end: 'x..x.x..x-------', leap: 0.3 });
    this.pumpBass = 0.3;
    this.pumpMusic = 0.55;
    this.pumpRel = 0.3;
    this.pumpOnKick = true;
    this.mix = {
      kick: { v: 0.22 }, snare: { v: 0.2, rev: 0.12 }, hats: { v: 0.14 }, perc: { v: 0.12 }, cym: { v: 0.2 },
      bass: { v: 0.6 }, pad: { v: 0.35, rev: 0.25 }, chords: { v: 0.55, rev: 0.12 }, lead: { v: 0.6, rev: 0.25, dly: 0.22 },
      fx: { v: 0.45 },
    };
    this.dlyTime = this.stepDur * 3;
  }

  setup() {
    const sweep = { rate: this.bpm / 60 / 32, depth: 1400 };
    this.bass = new Mono(this, 'bass', FUNK_BASS);
    this.loopA = new Poly(this, 'chords', 'brass', { level: 0.35, rel: 0.05, cut: 1900, q: 7, lfo: sweep });
    this.loopB = new Poly(this, 'chords', 'saw3', { level: 0.22, rel: 0.05, cut: 1900, q: 7, lfo: sweep });
    this.pad = new Poly(this, 'pad', 'strings', { level: 0.25, atk: 0.4, rel: 1, cut: 3000 });
    this.talk = new Mono(this, 'lead', {
      oscs: [{ type: 'sawtooth', gain: 0.5 }, { type: 'square', gain: 0.25, detune: 6 }], cut: 6000, q: 0, env: 0,
      formant: [[700, 7, 1.2], [1200, 8, 0.9], [2600, 9, 0.5]], formDry: 0.12,
      atk: 0.01, sus: 0.9, dec: 0.3, rel: 0.06, glide: 0.05, level: 0.5,
    });
    this.fxStab = new Poly(this, 'fx', 'brass', { level: 0.4 });
  }

  onStep(s, t) {
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 4, lo: 57, hi: 79, vel: 0.4 });
    if (this.on('bass')) this.rolePlay(this.bass, this.bassPat, s, t, { lo: 28, gate: 0.7 });
    if (this.on('chords')) {
      const c = this.loopPat[s];
      if (c === 'x') {
        let len = 1;
        while (s + len < 16 && this.loopPat[s + len] === '-') len++;
        const v = this.voicing(this.chordSoon(s), 4, 57, 76, 'loop');
        const T = this.sw(s, t), d = this.stepDur * (len * 0.8);
        this.loopA.chord(T, v, d, 0.55);
        this.loopB.chord(T, v, d, 0.5);
      }
    }
    if (this.on('lead')) {
      const k = (this.barInSec % this.talkMel.bars) * 16 + s;
      const nt = this.talkMel.idx[k];
      if (nt) {
        const v1 = (k >> 2) & 1 ? VOWELS.o : VOWELS.a, v2 = (k >> 2) & 1 ? VOWELS.a : VOWELS.e;
        this.talk.note(this.sw(s, t), nt.m, nt.len * this.stepDur * 0.9, 0.85 * nt.v, { vowel: v1.map((f, i) => [f, v2[i]]) });
      }
    }
  }

  stab(t, ch, vel) { this.stabChord(this.fxStab, t, ch, vel, 57, 79, 0.3); }
}

// ============================================================================
export class Win extends Song {
  static kind = 'results';
  static intensity = 0.7;

  compose(r) {
    this.bpm = r.pick([122, 124, 126]);
    this.swing = 0.06;
    this.keyPc = r.pick([0, 2, 3, 5, 7]);
    this.scale = 'major';
    this.progs.main = this.P(r.pick([
      'I V vi IV',
      'IV V iii vi',
      'Iadd9 V vi7 IVM7',
      'vi IV I V',
      'I iii IV V',
    ]));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers.break = 'pad fx cym chords lead hats perc';
    this.kit = { ...this.kit, kick: 'kick_house', clap: 'clap_big', hat: 'hat_c', ohat: 'hat_o' };
    this.drums = HOUSE_DRUMS;
    this.pianoPat = r.pick(['x..x..x.x..x..x.', 'x.x..x.x..x.x...', 'x..x..x...x..x..']);
    this.mel = this.hook({ bars: 4, lo: 72, hi: 88, call: 'x.x.x..x.x.x.x..', resp: 'x.x.x..x.x--x---', end: 'x.x.x.x.x-------', leap: 0.35 });
    this.pumpBass = 0.3;
    this.pumpMusic = 0.35;
    this.pumpRel = 0.25;
    this.pumpOnKick = true;
    this.mix = {
      kick: { v: 0.22 }, snare: { v: 0.2, rev: 0.15 }, hats: { v: 0.14 }, perc: { v: 0.12 }, cym: { v: 0.2 },
      bass: { v: 0.55 }, pad: { v: 0.4, rev: 0.3 }, chords: { v: 0.6, rev: 0.15 }, lead: { v: 0.55, rev: 0.25, dly: 0.2 },
      fx: { v: 0.45 },
    };
    this.dlyTime = this.stepDur * 3;
  }

  setup() {
    this.bass = new Mono(this, 'bass', { ...FUNK_BASS, cut: 500, env: 1200, level: 0.4 });
    this.piano = new Poly(this, 'chords', 'piano', { level: 0.45, rel: 0.12 });
    this.pad = new Poly(this, 'pad', 'strings', { level: 0.28, atk: 0.4, rel: 1, cut: 4000 });
    this.leadI = new Poly(this, 'lead', 'square', { level: 0.3, atk: 0.005, rel: 0.08, cut: 5000 });
    this.leadB = new Poly(this, 'lead', 'saw', { level: 0.18, atk: 0.005, rel: 0.1, cut: 6000 });
  }

  onStep(s, t) {
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 4, lo: 60, hi: 81, vel: 0.45 });
    if (this.on('bass') && (s & 1) === 0) {
      const ch = this.chordSoon(s);
      const root = this.rootIn(ch, 31);
      this.bass.note(this.sw(s, t), (s & 2) ? root + 12 : root, this.stepDur * 1.4, (s & 2) ? 0.75 : 0.9);
    }
    if (this.on('chords') && this.pianoPat[s] === 'x') {
      const v = this.voicing(this.chordSoon(s), 4, 60, 79, 'pno');
      this.piano.chord(this.sw(s, t), v.concat([v[0] - 12]), this.stepDur * 1.5, 0.5);
    }
    if (this.on('lead')) {
      this.melodyPlay(this.leadI, this.mel, s, t, { vel: 0.8, gate: 0.8 });
      this.melodyPlay(this.leadB, this.mel, s, t, { vel: 0.7, gate: 0.8, oct: -1 });
    }
  }
}
