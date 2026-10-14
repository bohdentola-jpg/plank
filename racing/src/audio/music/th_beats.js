// Downtempo family: THE UNDERGROUND 92.7 (dark boom-bap / trip-hop with dusty
// Rhodes, 808 slides, vinyl crackle and a filtered string loop) and
// results_lose (melancholy downtempo).

import { Song } from './song.js';
import { Mono, Rhodes, Poly, Breath } from './inst.js';
import { pat, rolePat } from './util.js';

const SUB808 = {
  oscs: [{ type: 'sine', gain: 0.9 }, { type: 'triangle', gain: 0.15, mul: 2 }], ftype: 'lowpass', cut: 1600, q: 0, env: 0,
  drive: 2.2, atk: 0.003, sus: 0.85, dec: 1.2, rel: 0.1, glide: 0.07, level: 0.55,
};

export class Underground extends Song {
  static kind = 'menu';
  static intensity = 0.4;

  compose(r) {
    this.bpm = r.pick([86, 88, 90, 92]);
    this.swing = r.range(0.26, 0.36);
    this.humanize = 0.006;
    this.velJitter = 0.14;
    this.keyPc = r.pick([0, 2, 3, 4, 7]);
    this.scale = r.chance(0.5) ? 'dorian' : 'minor';
    this.progs.main = this.P(r.pick([
      'i9:2 iv9:2',
      'i7 bVIM7 iv7 v7',
      'i9 bIIIM7 bVIM7 v7',
      'i7:2 bVIIadd9 bVIM7',
      'i9:2 iiø V7b9',
    ]));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers.break = 'pad fx cym chords lead hats';
    this.kit = { ...this.kit, kick: 'kick_bb', snare: 'snare_bb', hat: 'hat_dusty', ohat: 'hat_odusty', ghost: 'snare_ghost' };
    const kicks = ['X......x..x.....', 'X.....x...x..x..', 'X..x......x.....', 'X......x.x......'];
    const k1 = r.pick(kicks), k2 = r.pick(kicks);
    this.drums = {
      A: {
        kick: pat(k1 + k2),
        snare: pat('....X.......X...'),
        hat: pat('xgogxgogxgogxgog'),
      },
      B: {
        kick: pat(k1 + k1.slice(0, 12) + '..x.'),
        snare: pat('....X.......X...' + '....X.......X..g'),
        ghost: pat('.......g......g.'),
        hat: pat('xgogxgogxgogxg..'),
        ohat: pat('..............o.'),
        shaker: pat('..o...o...o...o.'),
      },
    };
    this.bassPat = rolePat(r.pick([
      'R-------...R-.r-' + 'R-------..r-O-a-',
      'R-----..r-R-----' + 'R-----..R---.n--',
      'R-------r-..R-..' + 'R-------....A---',
    ]));
    this.compPat = r.pick([
      'x-------..x-----' + '..x-----x-------',
      'x-----x---------' + 'x-------..x-----',
      '..x-------x-----' + '..x---------x---',
    ]);
    this.mel = this.hook({ bars: 4, lo: 67, hi: 84, call: 'x.....x...x.....', resp: 'x---x-------x---', end: 'x-------x-------', leap: 0.4 });
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.24, rev: 0.12 }, hats: { v: 0.14 }, perc: { v: 0.12 }, cym: { v: 0.2 },
      bass: { v: 0.5 }, pad: { v: 0.55, rev: 0.3 }, chords: { v: 0.9, rev: 0.18 }, lead: { v: 0.6, rev: 0.35, dly: 0.3 },
      fx: { v: 0.5 },
    };
    this.dlyTime = this.beatDur * 0.75;
  }

  setup() {
    this.bass = new Mono(this, 'bass', SUB808);
    this.rh = new Rhodes(this, 'chords', { level: 0.22, tone: 3800, trem: 0.4, tremRate: 3.6, bright: 0.85, drive: 1.6 });
    this.strings = new Poly(this, 'pad', 'strings', { level: 0.32, atk: 0.8, rel: 1.4, cut: 1500, q: 4, lfo: { rate: this.bpm / 60 / 8, depth: 500 } });
    this.vib = new Poly(this, 'lead', 'mallet', { level: 0.4, rel: 0.6 });
    this.bed(this.B.get('crackle'), 'fx', 0.35, [['highpass', 300, 0]]);
  }

  onStep(s, t) {
    if (this.on('pad')) this.padPlay(this.strings, s, t, { n: 3, lo: 55, hi: 74, vel: 0.5, vopts: { spread: 10 } });
    if (this.on('bass')) this.rolePlay(this.bass, this.bassPat, s, t, { lo: 31 });
    if (this.on('chords')) this.compPlay(this.rh, this.compPat, s, t, { n: 4, lo: 53, hi: 74, vel: 0.62, vopts: { rootless: true } });
    if (this.on('lead')) this.melodyPlay(this.vib, this.mel, s, t, { vel: 0.7, gate: 1 });
    if (this.on('perc') && s === 12 && (this.barInSec & 3) === 3) this.hit('snap', this.sw(s, t) + 0.02, 0.5, { layer: 'perc' });
  }
}

// ============================================================================
export class Lose extends Song {
  static kind = 'results';
  static intensity = 0.6;

  compose(r) {
    this.bpm = r.pick([76, 78, 80, 82]);
    this.swing = 0.18;
    this.humanize = 0.005;
    this.velJitter = 0.12;
    this.keyPc = r.pick([2, 4, 5, 9, 11]);
    this.scale = 'minor';
    this.progs.main = this.P(r.pick([
      'i:2 bVI:2 bIII:2 bVII:2',
      'i9:2 v7:2 bVIM7:2 iv9:2',
      'bVIM7:2 v7:2 i9:4',
      'i9:2 bVIIadd9:2 bVIM7:2 v7:2',
    ]));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers.break = 'pad fx cym chords lead';
    this.kit = { ...this.kit, kick: 'kick_soft', snare: 'snare_soft', hat: 'hat_dusty', ohat: 'hat_odusty' };
    this.drums = {
      A: { kick: pat('X.......X.x.....'), snare: pat('........X.......'), hat: pat('x.o.x.o.x.o.x.o.') },
      B: { kick: pat('X.......X.x...x.'), snare: pat('........X.......'), hat: pat('x.o.x.oox.o.x.o.'), rim: pat('....o.......o...') },
    };
    this.mel = this.hook({ bars: 8, lo: 64, hi: 81, call: 'x-------x---x---', resp: 'x-----x-x-------', end: 'x---x---x-------', leap: 0.25 });
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.22, rev: 0.4 }, hats: { v: 0.1 }, perc: { v: 0.1 }, cym: { v: 0.18 },
      bass: { v: 0.42 }, pad: { v: 0.5, rev: 0.4 }, chords: { v: 0.62, rev: 0.3 }, lead: { v: 0.75, rev: 0.4, dly: 0.25 },
      fx: { v: 0.4 },
    };
    this.dlyTime = this.beatDur * 0.75;
  }

  setup() {
    this.bass = new Mono(this, 'bass', { ...SUB808, drive: 0, level: 0.5, glide: 0.1 });
    this.piano = new Poly(this, 'chords', 'piano', { level: 0.42, rel: 0.6, cut: 3500 });
    this.strings = new Poly(this, 'pad', 'strings', { level: 0.3, atk: 1.2, rel: 2, cut: 2200 });
    this.lead = new Breath(this, 'lead', { wave: 'sine', level: 0.3, lp: 2400, vib: 16, vibRate: 4.6, breath: 0.12, glide: 0.08, atk: 0.12, rel: 0.4 });
    this.bed(this.B.get('crackle'), 'fx', 0.3, [['highpass', 400, 0]]);
  }

  onStep(s, t) {
    if (this.on('pad')) this.padPlay(this.strings, s, t, { n: 4, lo: 55, hi: 76, vel: 0.5 });
    if (this.on('bass') && (s & 3) === 0 && this.changes[s >> 2]) {
      this.bass.note(t, this.rootIn(this.barChords[s >> 2], 33), this.chordBeats(s >> 2) * this.beatDur * 0.9, 0.8);
    }
    if (this.on('chords') && (s === 0 || s === 10)) {
      const v = this.voicing(this.chordAt(s), 4, 55, 76, 'pno');
      this.piano.chord(this.sw(s, t), v, this.stepDur * (s ? 6 : 10), s ? 0.32 : 0.42);
    }
    if (this.on('lead')) this.melodyPlay(this.lead, this.mel, s, t, { vel: 0.8, gate: 0.95, legato: true });
  }
}
