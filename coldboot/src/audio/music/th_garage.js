// HALL OF FAME 97.9 — UK garage / 2-step: shuffled hats, skippy kicks, M1-style
// organ stabs, warm sub bass and chopped "vocal" formant hits.

import { Song } from './song.js';
import { Mono, Poly } from './inst.js';
import { pat, rolePat } from './util.js';

export class Records extends Song {
  static kind = 'menu';
  static intensity = 0.4;

  compose(r) {
    this.bpm = r.pick([130, 132, 132, 134]);
    this.swing = r.range(0.3, 0.38);
    this.velJitter = 0.1;
    this.keyPc = r.pick([5, 7, 9, 10, 0]);
    this.scale = 'dorian';
    this.progs.main = this.P(r.pick([
      'i9 iv9 i9 iv9',
      'i7 bVIM7 bVII iv7',
      'i9 bVII6 bVIM7 v7',
      'iv9 v7 i9:2',
      'i9:2 bVIIadd9 iv9',
    ]));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers.break = 'pad fx cym chords lead hats perc';
    this.kit = { ...this.kit, kick: 'kick_house', snare: 'snare_tight', clap: 'clap', hat: 'hat_c', ohat: 'hat_o', rim: 'rim' };
    const kicks = ['X.........X.....', 'X......x..X.....', 'X.....x....X....', 'X.........x..x..'];
    const k1 = r.pick(kicks), k2 = r.pick(kicks);
    this.drums = {
      A: {
        kick: pat(k1 + k2),
        clap: pat('....X.......X...'),
        snare: pat('....o.......o...'),
        hat: pat('x.ox.ox.x.ox.ox.'),
        ohat: pat('..o...o...o...o.'),
        rim: pat(r.pick(['...x..x....x..x.', '..x..x....x..x..', '.......x..x....x'])),
      },
      B: {
        kick: pat(k1 + k1),
        clap: pat('....X.......X...'),
        snare: pat('....o.......o..g'),
        hat: pat('xoxxoxxoxoxxoxxo'),
        ohat: pat('..o...o...o...o.'),
        rim: pat('...x..x....x..x.'),
        shaker: pat('o.o.o.o.o.o.o.o.'),
      },
      break: { hat: pat('x.ox.ox.x.ox.ox.'), shaker: pat('o.o.o.o.o.o.o.o.') },
    };
    this.bassPat = rolePat(r.pick([
      'R..r..R.....r.O.' + 'R..r..R.....a-..',
      'R.....r.R.....A.' + 'R.....r.R...o-r.',
      'R..R.....rO...r.' + 'R..R.....r..n...',
    ]));
    this.organPat = r.pick([
      'x..x..x...x..x..',
      '..x..x..x..x..x.',
      'x..x...x..x..x..',
    ]);
    this.stabPat = r.pick(['......x.......x.', '...x.......x....', '..........x..x..']);
    this.chops = this.hook({ bars: 4, lo: 69, hi: 84, call: 'x..x..x...x.x...', resp: 'x.x..x..x..x....', end: 'x..x..x.x-------', leap: 0.35 });
    this.pumpBass = 0.25;
    this.pumpMusic = 0.2;
    this.pumpOnKick = true;
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.22, rev: 0.15 }, hats: { v: 0.14 }, perc: { v: 0.12 }, cym: { v: 0.2 },
      bass: { v: 0.55 }, pad: { v: 0.4, rev: 0.3 }, chords: { v: 0.5, rev: 0.15 }, lead: { v: 0.55, rev: 0.3, dly: 0.25 },
      fx: { v: 0.5 },
    };
    this.dlyTime = this.stepDur * 3;
  }

  setup() {
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sine', gain: 0.8 }, { type: 'triangle', gain: 0.3 }, { type: 'square', gain: 0.06, mul: 2 }],
      cut: 900, q: 1, env: 600, fdec: 0.15, drive: 1.6, atk: 0.004, sus: 0.8, dec: 0.4, rel: 0.06, glide: 0.06, level: 0.55,
    });
    this.organ = new Poly(this, 'chords', 'organ', { level: 0.38, rel: 0.06, cut: 5000 });
    this.stabs = new Poly(this, 'chords', 'strings', { level: 0.25, atk: 0.01, rel: 0.15, cut: 3000 });
    this.pad = new Poly(this, 'pad', 'strings', { level: 0.28, atk: 0.5, rel: 1.2, cut: 2600 });
    this.vox = new Poly(this, 'lead', 'choir', { level: 0.5, atk: 0.006, rel: 0.07, cut: 4200, hp: 250 });
    this.fxStab = new Poly(this, 'fx', 'organ', { level: 0.4 });
  }

  onStep(s, t) {
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 3, lo: 57, hi: 76, vel: 0.45 });
    if (this.on('bass')) this.rolePlay(this.bass, this.bassPat, s, t, { lo: 31, gate: 0.8 });
    if (this.on('chords')) {
      this.compPlay(this.organ, this.organPat + this.organPat, s, t, { n: 4, lo: 58, hi: 77, vel: 0.6, gate: 0.5 });
      if (this.sec.type === 'B') this.compPlay(this.stabs, this.stabPat, s, t, { n: 3, lo: 64, hi: 82, key: 'stab', vel: 0.5, gate: 0.6 });
    }
    if (this.on('lead')) this.melodyPlay(this.vox, this.chops, s, t, { vel: 0.75, gate: 0.55 });
  }

  stab(t, ch, vel) { this.stabChord(this.fxStab, t, ch, vel, 58, 77, 0.3); }
}
