// race_mountain — EUROBEAT (touge homage): four-on-the-floor at ~155, octave-
// jumping bass, supersaw lead hook doubled by a square an octave up, piano and
// brass stabs, dramatic minor verse → rising pre-chorus → chorus structure.

import { Song } from './song.js';
import { Mono, Poly } from './inst.js';
import { pat, makeChase } from './util.js';

export class Mountain extends Song {
  static kind = 'race';
  static intensity = 0.85;

  compose(r) {
    this.bpm = r.pick([152, 154, 155, 156, 158]);
    this.keyPc = r.pick([9, 11, 1, 2, 4, 6]);
    this.scale = 'minor';
    this.progs.chorus = this.P(r.pick(['bVI bVII i i', 'i bVI bVII i', 'bVI bVII v i', 'iv bVII bIII bVI', 'i bVII bVI V']));
    this.progs.verse = this.P(r.pick(['i i bVI bVII', 'i bVII bVI bVII', 'i iv bVII bIII']));
    this.progs.pre = this.P(r.pick(['iv v bVI bVII', 'bVI bVII bVI V', 'iv bVI bVII V']));
    this.progs.main = this.progs.chorus;
    this.progs.countdown = this.P('V');
    this.form = [
      { type: 'intro', bars: 8, prog: 'chorus' },
      { type: 'A', bars: 16, prog: 'verse' },
      { type: 'B', bars: 8, prog: 'pre' },
      { type: 'drop', bars: 16, prog: 'chorus' },
      { type: 'A', bars: 8, prog: 'chorus', var: 1 },
      { type: 'A', bars: 16, prog: 'verse', var: 1 },
      { type: 'B', bars: 8, prog: 'pre' },
      { type: 'drop', bars: 16, prog: 'chorus', var: 1 },
      { type: 'break', bars: 8, prog: 'chorus' },
      { type: 'build', bars: 4, prog: 'pre' },
      { type: 'drop', bars: 16, prog: 'chorus' },
    ];
    this.loopFrom = 1;
    this.sectionLayers.intro = 'pad fx cym hats kick snare bass lead';
    this.climaxForm = [{ type: 'drop', bars: 8, prog: 'chorus' }, { type: 'drop', bars: 8, prog: 'chorus', var: 1 }];
    this.kit = { ...this.kit, kick: 'kick_euro', snare: 'snare_tight', clap: 'clap_big', hat: 'hat_c', ohat: 'hat_o' };
    this.drums = {
      A: {
        kick: pat('X...X...X...X...'),
        snare: pat('....X.......X...'),
        clap: pat('....x.......x...'),
        ohat: pat('..x...x...x...x.'),
        hat: pat('o.g.o.g.o.g.o.g.'),
      },
      B: {
        kick: pat('X...X...X...X...'),
        snare: pat('....X.......X...' + '....X.......X.xx'),
        clap: pat('....x.......x...'),
        ohat: pat('..x...x...x...x.'),
        hat: pat('ogogogogogogogog'),
      },
      drop: {
        kick: pat('X...X...X...X...'),
        snare: pat('....X.......X...'),
        clap: pat('....X.......X...'),
        ohat: pat('..x...x...x...x.'),
        hat: pat('xgogxgogxgogxgog'),
        tamb: pat('....x.......x...'),
      },
    };
    this.fills = ['toms', 'mix', 'snare', 'toms'];
    this.kitGain.roll = 0.5;
    const riff = { call: 'x.xxx.x.x.xxx.x.', resp: 'x.xxx.x.x-x-x---', end: 'x.x.x.x.x-------' };
    this.hookMel = this.hook({ bars: 4, prog: this.progs.chorus, lo: 69, hi: 86, ...riff, leap: 0.35 });
    this.verseMel = this.hook({ bars: 4, prog: this.progs.verse, lo: 67, hi: 83, call: 'x.x.x---x.x.x---', resp: 'x.x.x.x.x-------', end: 'x---x---x-------', leap: 0.25 });
    this.preMel = this.hook({ bars: 4, prog: this.progs.pre, lo: 69, hi: 86, call: 'x-x-x-x-x-x-x-x-', resp: 'x-x-x-x-x-x-x-x-', end: 'x-x-x-x-x-------', leap: 0.2 });
    this.pianoPat = r.pick(['..x...x...x...x.', 'x..x..x...x..x..', '..x..x..x..x..x.']);
    this.chase = makeChase(r, this.keyPc, 55);
    this.pumpBass = 0.35;
    this.pumpMusic = 0.25;
    this.pumpOnKick = true;
    this.mix = {
      kick: { v: 0.2 }, snare: { v: 0.22, rev: 0.15 }, hats: { v: 0.13 }, perc: { v: 0.12 }, cym: { v: 0.2, rev: 0.1 },
      bass: { v: 0.55 }, pad: { v: 0.45, rev: 0.3 }, chords: { v: 0.5, rev: 0.18 }, lead: { v: 0.8, rev: 0.22, dly: 0.16 },
      fx: { v: 0.6, rev: 0.25 }, extra: { v: 0.45, rev: 0.4 }, arp: { v: 0.4, rev: 0.2 },
    };
    this.dlyTime = this.stepDur * 3;
  }

  setup() {
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.5 }, { type: 'square', gain: 0.25, detune: 5 }], cut: 420, q: 4, env: 2200,
      fatk: 0.002, fdec: 0.09, keytrack: 1, atk: 0.003, sus: 0.6, dec: 0.15, rel: 0.04, level: 0.4, sub: 0.45, subMul: 1, drive: 1.5, post: 5000,
    });
    this.lead = new Poly(this, 'lead', 'saw', { level: 0.32, atk: 0.004, rel: 0.07, cut: 7000 });
    this.leadHi = new Poly(this, 'lead', 'square', { level: 0.12, atk: 0.004, rel: 0.06, cut: 6000 });
    this.piano = new Poly(this, 'chords', 'piano', { level: 0.4, rel: 0.1 });
    this.brass = new Poly(this, 'arp', 'brass', { level: 0.4, rel: 0.1 });
    this.strings = new Poly(this, 'pad', 'strings', { level: 0.3, atk: 0.3, rel: 0.8, cut: 4500 });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.32, atk: 0.3, rel: 0.8 });
  }

  cdStep(s, t, e) {
    if ((s & 1) === 0) this.bass.note(t, this.rootIn(this.chord, 33) + ((s & 2) ? 12 : 0), this.stepDur * 1.5, 0.5 + e / 10, { force: true, cut: 250 + e * 150 });
  }

  melFor() {
    const p = this.sec.prog;
    if (this.sec.type === 'drop' || this.sec.type === 'intro' || (p === 'chorus' && this.sec.type === 'A')) return this.hookMel;
    return p === 'pre' ? this.preMel : this.verseMel;
  }

  onStep(s, t) {
    const ty = this.sec.type;
    const T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.strings, s, t, { n: 4, lo: 57, hi: 79, vel: 0.45 });
    if (this.on('bass') && (s & 1) === 0) {
      const root = this.rootIn(this.chordSoon(s), 33);
      this.bass.note(T, (s & 2) ? root + 12 : root, this.stepDur * 1.5, (s & 2) ? 0.75 : 0.95);
    }
    if (this.on('chords') && this.pianoPat[s] === 'x') {
      const v = this.voicing(this.chordSoon(s), 4, 62, 81, 'pno');
      this.piano.chord(T, v, this.stepDur * 1.6, 0.55);
    }
    if (this.on('arp') && (ty === 'B' || ty === 'drop') && (s === 0 || s === 6 || s === 12) && (this.barInSec & 1) === 1) {
      const v = this.voicing(this.chordAt(s), 3, 60, 76, 'brass');
      this.brass.chord(T, v, this.stepDur * (s === 12 ? 3 : 2), 0.6);
    }
    if (this.on('lead')) {
      if (this.leading || ty === 'break') {
        const mel = this.melFor();
        this.melodyPlay(this.lead, mel, s, t, { vel: 0.85, gate: 0.85 });
        if (ty === 'drop' || ty === 'intro') this.melodyPlay(this.leadHi, mel, s, t, { vel: 0.75, gate: 0.8, oct: 1 });
      } else this.melodyPlay(this.brass, this.chase, s, t, { vel: 0.6, gate: 0.6, oct: 1 });
    }
    if (this.on('extra')) this.padPlay(this.choir, s, t, { n: 3, lo: 64, hi: 81, key: 'choir', vel: 0.5 });
  }

  stab(t, ch, vel) {
    const v = this.voicing(ch, 4, 60, 79, 'stab');
    for (const m of v) { this.brass.note(t, m, 0.4, vel * 0.7, { force: true }); this.piano.note(t, m, 0.6, vel * 0.6, { force: true }); }
  }
}
