// race_highway — uplifting trance: rolling offbeat bass under a heavy
// sidechain, gated pluck arps through a dotted delay, supersaw chords, an epic
// breakdown with the hook on piano, snare-roll build, supersaw lead drop.

import { Song } from './song.js';
import { Mono, Poly } from './inst.js';
import { pat, makeChase } from './util.js';

export class Highway extends Song {
  static kind = 'race';
  static intensity = 0.85;

  compose(r) {
    this.bpm = r.pick([136, 138, 138, 140]);
    this.keyPc = r.pick([9, 11, 0, 2, 4, 6]);
    this.scale = 'minor';
    this.progs.main = this.P(r.pick([
      'i:2 bVI:2 bIII:2 bVII:2',
      'bVI:2 bVII:2 i:4',
      'i:2 bVII:2 bVI:2 bVII:2',
      'iv:2 bVI:2 bVII:2 i:2',
      'i:2 bIII:2 bVII:2 bVI:2',
    ]));
    this.progs.countdown = this.P('bVII');
    this.form = [
      { type: 'intro', bars: 16 },
      { type: 'A', bars: 16 },
      { type: 'break', bars: 16 },
      { type: 'build', bars: 8 },
      { type: 'drop', bars: 16 },
      { type: 'A', bars: 16, var: 1 },
      { type: 'break', bars: 8, var: 1 },
      { type: 'build', bars: 8 },
      { type: 'drop', bars: 16, var: 1 },
    ];
    this.loopFrom = 1;
    this.sectionLayers.intro = 'pad fx cym hats kick bass perc';
    this.sectionLayers.break = 'pad fx cym chords arp lead extra';
    this.introLP = 2500;
    this.breakLP = 9000;
    this.kit = { ...this.kit, kick: 'kick_euro', clap: 'clap_big', snare: 'snare_tight', hat: 'hat_c', ohat: 'hat_o', ride: 'ride' };
    this.drums = {
      A: {
        kick: pat('X...X...X...X...'),
        clap: pat('....X.......X...'),
        ohat: pat('..x...x...x...x.'),
        hat: pat('g.o.g.o.g.o.g.o.'),
      },
      drop: {
        kick: pat('X...X...X...X...'),
        clap: pat('....X.......X...'),
        ohat: pat('..x...x...x...x.'),
        hat: pat('ogxgogxgogxgogxg'),
        ride: pat('..o...o...o...o.'),
      },
    };
    this.arpPat = r.pick([[0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 2, 4, 3, 1], [0, 1, 2, 4, 3, 2, 1, 2], [3, 2, 1, 0, 1, 2, 3, 4]]);
    this.mel = this.hook({ bars: 8, lo: 64, hi: 81, call: 'x--x--x-x--x--x-', resp: 'x--x--x-x-x-x---', end: 'x--x--x-x-------', leap: 0.4 });
    this.chase = makeChase(r, this.keyPc, 57);
    this.pumpBass = 0.6;
    this.pumpMusic = 0.5;
    this.pumpRel = 0.24;
    this.pumpOnKick = true;
    this.buildHP = 450;
    this.cdLevel = 0.65;
    this.kitGain.roll = 0.4;
    this.mix = {
      kick: { v: 0.22 }, snare: { v: 0.22, rev: 0.2 }, hats: { v: 0.13 }, perc: { v: 0.12 }, cym: { v: 0.2, rev: 0.12 },
      bass: { v: 0.6 }, pad: { v: 0.45, rev: 0.4 }, chords: { v: 0.5, rev: 0.25 }, arp: { v: 0.35, dly: 0.35, rev: 0.15 },
      lead: { v: 0.8, rev: 0.3, dly: 0.22 }, fx: { v: 0.6, rev: 0.3 }, extra: { v: 0.45, rev: 0.45 },
    };
    this.dlyTime = this.stepDur * 3;
    this.dlyFb = 0.45;
  }

  setup() {
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.5 }, { type: 'sawtooth', gain: 0.35, detune: 9 }], cut: 300, q: 3, env: 1500,
      fatk: 0.002, fdec: 0.06, keytrack: 1, atk: 0.002, sus: 0.5, dec: 0.08, rel: 0.03, level: 0.42, sub: 0.6, subMul: 1, drive: 1.3, post: 4000,
    });
    this.arp = new Poly(this, 'arp', 'pluck', { level: 0.45, rel: 0.06 });
    this.saws = new Poly(this, 'chords', 'saw', { level: 0.2, atk: 0.02, rel: 0.4, cut: 4200 });
    this.lead = new Poly(this, 'lead', 'saw', { level: 0.34, atk: 0.006, rel: 0.12, cut: 8000 });
    this.leadHi = new Poly(this, 'lead', 'square', { level: 0.1, atk: 0.006, rel: 0.1, cut: 6000 });
    this.piano = new Poly(this, 'lead', 'piano', { level: 0.5, rel: 0.4 });
    this.pad = new Poly(this, 'pad', 'pad', { level: 0.32, atk: 0.9, rel: 1.6, cut: 3000 });
    this.choir = new Poly(this, 'extra', 'choir', { level: 0.32, atk: 0.4, rel: 1 });
    this.fxStab = new Poly(this, 'fx', 'saw', { level: 0.3, rel: 0.4 });
  }

  cdStep(s, t, e) {
    const sub = (s & 3) !== 0;
    if (sub) this.bass.note(t, this.rootIn(this.chord, 33), this.stepDur * 0.7, 0.32 + e / 16, { force: true, cut: 180 + e * 90 });
  }

  onStep(s, t) {
    const ty = this.sec.type;
    const T = this.sw(s, t);
    if (this.on('pad')) this.padPlay(this.pad, s, t, { n: 4, lo: 52, hi: 76, vel: 0.5 });
    if (this.on('bass') && (s & 3) !== 0) {
      const root = this.rootIn(this.chordAt(s), 33);
      this.bass.note(T, root, this.stepDur * 0.85, (s & 3) === 1 ? 0.95 : 0.75);
    }
    if (this.on('chords') && ty !== 'intro') this.padPlay(this.saws, s, t, { n: 4, lo: 57, hi: 79, key: 'saws', vel: 0.55, vopts: { spread: 14 } });
    if (this.on('arp') && ty !== 'build') {
      if (this.leading || ty === 'break') this.arpPlay(this.arp, s, t, { rate: 1, pat: this.arpPat, lo: 64, hi: 86, vel: 0.55, gate: 0.5 });
      else this.melodyPlay(this.arp, this.chase, s, t, { vel: 0.55, gate: 0.4 });
    }
    if (this.on('lead')) {
      if (ty === 'break') this.melodyPlay(this.piano, this.mel, s, t, { vel: 0.7, gate: 1.2 });
      else if (ty === 'drop' && this.leading) {
        this.melodyPlay(this.lead, this.mel, s, t, { vel: 0.85 });
        this.melodyPlay(this.leadHi, this.mel, s, t, { vel: 0.7, oct: 1 });
      } else if (ty === 'A' && this.leading) this.melodyPlay(this.arp, this.mel, s, t, { vel: 0.6, gate: 0.6, oct: -1 });
    }
    if (this.on('extra')) this.padPlay(this.choir, s, t, { n: 3, lo: 64, hi: 81, key: 'choir', vel: 0.5 });
  }

  stab(t, ch, vel) { this.stabChord(this.fxStab, t, ch, vel, 57, 81, 0.8); }
}
