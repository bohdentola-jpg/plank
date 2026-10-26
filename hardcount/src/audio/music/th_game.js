// In-game and career beds:
//   playcall     the low-key beat under the play-call screen. A 'game' theme: music.setGameState
//                adds layers late in close games, in the red zone and in the two-minute drill
//                (which also lifts the key into a climax), and swaps the hook for a tense
//                ostinato while the player's team is behind.
//   career_hub   late-night lo-fi R&B in a teenager's bedroom: swung dusty drums, Rhodes with
//                extended chords, sub bass that slides, a hummed "ooh" lead, vinyl crackle.

import { Song } from './song.js';
import { Mono, Poly, Rhodes } from './inst.js';
import { pat, rolePat, makeChase } from './util.js';

const SUB808 = {
  oscs: [{ type: 'sine', gain: 0.9 }, { type: 'triangle', gain: 0.15, mul: 2 }], ftype: 'lowpass', cut: 1600, q: 0, env: 0,
  drive: 2.2, atk: 0.003, sus: 0.85, dec: 1.2, rel: 0.1, glide: 0.07, level: 0.55,
};

export class Playcall extends Song {
  static kind = 'game';
  static intensity = 0.42;

  compose(r) {
    this.bpm = r.pick([90, 92, 94, 96]);
    this.swing = r.range(0.14, 0.22);
    this.humanize = 0.004;
    this.keyPc = r.pick([1, 4, 6, 9, 11]);
    this.scale = 'minor';
    this.progs.main = this.P(r.pick(['i9:2 bVIM7:2', 'i:2 iv:2', 'i7 bVII bVI bVII', 'i9:2 bIIIM7 bVII']));
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'A', bars: 8, var: 1 },
      { type: 'break', bars: 4 },
    ];
    this.climaxForm = [{ type: 'drop', bars: 8 }, { type: 'drop', bars: 8, var: 1 }];
    this.sectionLayers.break = 'pad fx cym hats arp chords bass';
    this.kit = { ...this.kit, kick: 'kick_bb', snare: 'snare_bb', clap: 'clap', hat: 'hat_c', ohat: 'hat_o' };
    this.drums = {
      A: { kick: pat('X......x..X.....' + 'X.....x...X..x..'), snare: pat('....X.......X...'), hat: pat('x.x.x.x.x.x.x.x.') },
      B: { kick: pat('X......x..X.....' + 'X.....x...X.x...'), snare: pat('....X.......X...'), clap: pat('....x.......x...'), hat: pat('x.xxx.x.x.xxx.x.'), ohat: pat('..............x.') },
      drop: { kick: pat('X......x.xX.....'), snare: pat('....X.......X...'), clap: pat('....X.......X...'), hat: pat('xxxxxxxxxxxxxxxx'), ohat: pat('..x...x...x...x.') },
    };
    this.bassPat = rolePat(r.pick(['R-------...R-.r-' + 'R-------..r-O-a-', 'R-----..r-R-----' + 'R-----..R---.n--']));
    this.mel = this.hook({ bars: 4, lo: 67, hi: 82, call: 'x.....x...x.x...', resp: 'x---x-----x-x---', end: 'x-----x-x-------', leap: 0.4 });
    this.chase = makeChase(r, this.keyPc, 60);
    this.pumpBass = 0.2;
    this.pumpOnKick = true;
    this.mix = {
      kick: { v: 0.22 }, snare: { v: 0.24, rev: 0.12 }, hats: { v: 0.14 }, perc: { v: 0.15 }, cym: { v: 0.18 },
      bass: { v: 0.32 }, pad: { v: 0.45, rev: 0.3 }, chords: { v: 0.6, rev: 0.18 }, arp: { v: 0.32, dly: 0.25 },
      lead: { v: 0.5, rev: 0.3, dly: 0.25 }, fx: { v: 0.5 }, extra: { v: 0.4, rev: 0.4 },
    };
    this.dlyTime = this.beatDur * 0.75;
  }

  setup() {
    this.bass = new Mono(this, 'bass', SUB808);
    this.pad = new Poly(this, 'pad', 'strings', { level: 0.28, atk: 0.8, rel: 1.4, cut: 1400, q: 3, lfo: { rate: this.bpm / 60 / 8, depth: 400 } });
    this.rh = new Rhodes(this, 'chords', { level: 0.18, tone: 3600, trem: 0.3, tremRate: 3.6, bright: 0.8 });
    this.pluck = new Poly(this, 'arp', 'pluck', { level: 0.22, rel: 0.2, cut: 2200 });
    this.lead = new Poly(this, 'lead', 'bell', { level: 0.3, rel: 0.3 });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.26, atk: 0.4, rel: 1 });
  }

  onStep(s, t) {
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 3, lo: 53, hi: 72, vel: 0.5 });
    if (this.on('bass')) this.rolePlay(this.bass, this.bassPat, s, t, { lo: 31 });
    if (this.on('chords') && (s === 0 || s === 10)) {
      const v = this.voicing(this.chordAt(s), 4, 55, 74, 'rh', { rootless: true });
      this.rh.chord(this.sw(s, t), v, this.stepDur * (s ? 5 : 9), s ? 0.4 : 0.5);
    }
    if (this.on('arp')) this.arpPlay(this.pluck, s, t, { rate: 2, n: 3, lo: 62, hi: 79, pat: [0, 1, 2, 1, 2, 0, 1, 2], gate: 0.4, vel: 0.5 });
    if (this.on('lead')) {
      if (this.leading) this.melodyPlay(this.lead, this.mel, s, t, { vel: 0.7, gate: 0.9 });
      else this.melodyPlay(this.lead, this.chase, s, t, { vel: 0.55, gate: 0.5 });
    }
    if (this.on('extra')) this.padPlay(this.choir, s, t, { n: 3, lo: 62, hi: 79, key: 'choir', vel: 0.5 });
  }

  stab(t, ch, vel) { this.stabChord(this.pluck, t, ch, vel, 55, 74, 0.3); }
}

// ============================================================================
export class CareerHub extends Song {
  static kind = 'menu';
  static intensity = 0.55;

  compose(r) {
    this.bpm = r.pick([72, 74, 76, 78]);
    this.swing = r.range(0.28, 0.36);
    this.humanize = 0.008;
    this.velJitter = 0.18;
    this.keyPc = r.pick([1, 3, 6, 8, 10]);
    const opt = r.pick([['major', 'IVM9 iii7 vi9 ii9'], ['dorian', 'i9 bIIIM7 bVIM7 v7'], ['major', 'ii9 V7#9 IM9:2'], ['dorian', 'i9:2 iv9:2']]);
    this.scale = opt[0];
    this.progs.main = this.P(opt[1]);
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8 },
      { type: 'break', bars: 4 },
      { type: 'B', bars: 8, var: 1 },
    ];
    this.sectionLayers.break = 'pad fx cym chords lead';
    this.kit = { ...this.kit, kick: 'kick_bb', snare: 'snare_lofi', hat: 'hat_dusty', ohat: 'hat_odusty', snap: 'snap', rim: 'rim' };
    this.drums = {
      A: { kick: pat('X.......x.X.....' + 'X.......x...x...'), snap: pat('....X.......X...'), hat: pat('x.o.x.o.x.o.x.o.') },
      B: { kick: pat('X.......x.X.....' + 'X......xx...x...'), snare: pat('....X.......X...'), snap: pat('....x.......x...'), hat: pat('xgoxxgoxxgoxxgox'), rim: pat('..........o.....') },
    };
    this.kitGain.snap = 0.6;
    this.bassPat = rolePat(r.pick(['R-------..r-R---' + 'R-------....A---', 'R-----..r-R-----' + 'R---------..n---']));
    this.compPat = r.pick(['x-------..x-----' + '......x-----x---', 'x-----x---------' + 'x-------..x-----']);
    this.mel = this.hook({ bars: 4, lo: 64, hi: 79, call: 'x-----x---x-----', resp: 'x---x---x-------', end: 'x-----x-x-------', leap: 0.3 });
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.24, rev: 0.15 }, hats: { v: 0.13 }, perc: { v: 0.12 }, cym: { v: 0.16 },
      bass: { v: 0.3 }, pad: { v: 0.32, rev: 0.35 }, chords: { v: 0.95, rev: 0.2 }, lead: { v: 0.5, rev: 0.4, dly: 0.25 }, fx: { v: 0.55 },
    };
    this.dlyTime = this.beatDur * 0.75;
  }

  setup() {
    this.bass = new Mono(this, 'bass', { ...SUB808, drive: 0.8, level: 0.5, glide: 0.11 });
    this.rh = new Rhodes(this, 'chords', { level: 0.22, tone: 3200, trem: 0.45, tremRate: 3.1, bright: 0.85, drive: 1.4 });
    this.pad = new Poly(this, 'pad', 'strings', { level: 0.2, atk: 1.2, rel: 1.8, cut: 1500 });
    this.ooh = new Poly(this, 'lead', 'choir', { level: 0.36, atk: 0.12, rel: 0.5, cut: 2600, hp: 220 });
    this.bed(this.B.get('crackle'), 'fx', 0.45, [['highpass', 250, 0]]);
  }

  onStep(s, t) {
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 3, lo: 55, hi: 74, vel: 0.4, vopts: { spread: 10 } });
    if (this.on('bass')) this.rolePlay(this.bass, this.bassPat, s, t, { lo: 31 });
    if (this.on('chords')) this.compPlay(this.rh, this.compPat, s, t, { n: 4, lo: 53, hi: 74, vel: 0.6, vopts: { rootless: true } });
    if (this.on('lead')) this.melodyPlay(this.ooh, this.mel, s, t, { vel: 0.7, gate: 1 });
  }
}
