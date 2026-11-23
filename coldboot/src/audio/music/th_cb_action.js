// COLD BOOT — action cues.
//   cb_tension  surveillance / stealth, driven by intensity 0..1 and re-read on every
//               beat (music.setIntensity(x)):
//                 0     a dark pedal drone, a muted E-pedal ostinato with a b2 rub, a
//                       ticking hat — sneaking
//                 0.3   dissonant string swells (minor-major 7th, 7b9), a rim "clock"
//                 0.4   a high tremolo cluster (E/F)
//                 0.5   a heartbeat kick, the ostinato goes to 16ths
//                 0.62  a staccato synth arp     0.7  half-time snare
//                 0.82+ burned: the bass follows the chords, driving kick, backbeat,
//                       brass stabs and a chase figure, crash on the way in.
//   cb_chase    the finale: 146 bpm D minor, gallop riff, spiccato strings, brass, big
//               drums and taiko toms; the leitmotif becomes the hook (harmonic-minor
//               leading tone), doubled by a tremolo balalaika; a choir on the drops.

import { CBSong, tune, MOTIF, MOTIF_PROG, Plucker, Drone } from './cb_common.js';
import { Mono, Poly } from './inst.js';
import { pat, makeChase, clamp } from './util.js';

const ALL = 'pad fx cym hats kick snare bass chords arp gtr lead perc';

// ========================================================================== cb_tension
export class CBTension extends CBSong {
  static kind = 'cb_tension';
  static intensity = 0.3;

  compose(r) {
    this.bpm = 104;
    this.keyPc = 4; // E minor (phrygian colour in the ostinato)
    this.scale = 'minor';
    this.humanize = 0.003;
    this.velJitter = 0.08;
    this.progs.main = 'imM7:2 bVI:1 bII:1 imM7:2 iv:1 V7b9:1';
    this.progs.alt = 'bVI:2 bII:2 iv:2 V7b9:2';
    this.form = [
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8, prog: 'alt' },
      { type: 'A', bars: 8, var: 1 },
      { type: 'C', bars: 8 },
    ];
    this.sectionLayers = { A: ALL, B: ALL, C: ALL };
    this.tiers = { pad: 0, fx: 0, bass: 0, hats: 0, chords: 0.28, perc: 0.3, gtr: 0.4, kick: 0.5, arp: 0.62, snare: 0.7, cym: 0.82, lead: 0.82, extra: 2 };
    this.cbo = { beatIntensity: true, crash: 0.7, iSmooth: 0.18 };
    this.kit = { ...this.kit, kick: 'kick_bb', snare: 'snare_tight', hat: 'hat_c2', ohat: 'hat_o', rim: 'rim', shaker: 'shaker', toml: 'tom_l', tomf: 'tom_f' };
    this.drums = {}; // all drums are played by intensity in onStep
    this.chase = makeChase(r, this.keyPc, 64);
    this.mix = {
      pad: { v: 0.32 }, bass: { v: 0.5 }, hats: { v: 0.34 }, perc: { v: 0.26, rev: 0.15 },
      chords: { v: 0.3, rev: 0.4 }, gtr: { v: 0.16, rev: 0.35 }, kick: { v: 0.3 }, arp: { v: 0.2, dly: 0.3, rev: 0.12 },
      snare: { v: 0.3, rev: 0.18 }, cym: { v: 0.22 }, lead: { v: 0.42, rev: 0.2 }, fx: { v: 0.5, rev: 0.3 },
    };
    this.pumpBass = 0.25;
    this.pumpRel = 0.2;
    this.trim = 0.78;
  }

  setup() {
    this.dlyTime = this.stepDur * 3;
    this.dlyFb = 0.3;
    this.drone = new Drone(this, 'pad', { level: 0.3, cut: 220, lfoDepth: 70, lfoRate: 0.06, detune: 11, sub: 0.35, atk: 2 });
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.5 }, { type: 'square', gain: 0.3, detune: 7 }], cut: 220, q: 5, env: 1100,
      fatk: 0.002, fdec: 0.09, keytrack: 0.4, atk: 0.002, dec: 0.12, sus: 0.45, rel: 0.04, glide: 0.03, level: 0.42,
      sub: 0.5, subMul: 1, drive: 1.6, post: 3000,
    });
    this.str = new Poly(this, 'chords', 'strings', { level: 0.26, atk: 1.3, rel: 1.4, cut: 1600 });
    this.trem = new Poly(this, 'gtr', 'strings', { level: 0.3, atk: 0.6, rel: 0.8, cut: 5200 });
    this.lfo(13, 0.5, this.trem.bus.gain); // bowed tremolo: 13 Hz amplitude flutter
    this.trem.bus.gain.value = 0.5;
    this.arp = new Poly(this, 'arp', 'pluck', { level: 0.28, rel: 0.05, cut: 2400 });
    this.brass = new Poly(this, 'lead', 'brass', { level: 0.34, rel: 0.2 });
    this.lead = new Poly(this, 'lead', 'saw3', { level: 0.16, atk: 0.005, rel: 0.06, cut: 3800 });
  }

  onSection(t) {
    this.drone.set(t, 40, 1, 0.1); // E2 pedal; its sub partial sits an octave lower
  }

  onIntensity(prev, next, t) {
    if (prev < 0.82 && next >= 0.82) { // burned: slam in
      this.hit('crash', t, 0.85, { force: true });
      this.hit('impact', t, 0.55, { force: true, layer: 'fx' });
      this.pump(t, 1, 0.4);
      this.stabChord(this.brass, t, this.chordAt(0) || this.chord, 0.9, 55, 76, 0.5);
    } else if (prev >= 0.5 && next < 0.3) {
      this.hit('down', t, 0.35, { force: true, layer: 'fx' });
    }
  }

  onStep(s, t) {
    const I = this.intensity, iS = this.iS;
    const T = this.sw(s, t);
    const E2 = 40;
    if ((s & 3) === 0) { this.drone.cutoff(t, 160 + 420 * iS, 0.4); this.drone.set(t, 40, 0.6 + 0.4 * iS, 0.1); }
    // --- bass ostinato
    if (this.on('bass')) {
      const cut = 150 + 1300 * Math.pow(iS, 1.4);
      if (I >= 0.82) this.rolePlay(this.bass, 'RrorRrorRrorRrOr', s, t, { lo: 28, gate: 0.6, vel: 0.9, slides: false, nopts: () => ({ cut }) });
      else if (I >= 0.5) this.ostinato(this.bass, this.sec.type === 'C' ? 'R.rrb.rrR.rrt.rb' : 'R.rrr.rbR.rrt.rb', s, t, E2, { gate: 0.55, vel: 0.5 + 0.4 * I, nopts: { cut } });
      else this.ostinato(this.bass, this.sec.type === 'C' ? 'R...r.b.R...t.b.' : 'R.r.r.b.R.r.t.b.', s, t, E2, { gate: 0.45, vel: 0.45 + 0.5 * I, nopts: { cut } });
    }
    // --- ticking hats
    if (this.on('hats')) {
      if (I >= 0.8) this.hit('hat', T, (s & 3) === 2 ? 0.75 : (s & 1) ? 0.32 : 0.5);
      else if (I >= 0.5) { if (!(s & 1)) this.hit('hat', T, (s & 3) === 2 ? 0.7 : 0.38); }
      else if ((s & 3) === 2) this.hit('hat', T, 0.55 + 0.3 * I);
    }
    if (this.on('perc')) {
      if ((s & 7) === 0) this.hit('rim', T, 0.32 + 0.2 * I, { layer: 'perc' });
      if (I >= 0.82 && (s & 1)) this.hit('shaker', T, 0.4);
    }
    // --- kick: heartbeat, then drive
    if (this.on('kick')) {
      const p = I >= 0.82 ? 'X...X...X...X.x.' : 'X..x....X..x....';
      const c = p[s];
      const k = I >= 0.82 ? 1 : 0.42 + 0.5 * clamp((I - 0.5) / 0.32, 0, 1); // the heartbeat grows with the danger
      if (c !== '.') this.hit('kick', T, (c === 'X' ? 0.95 : 0.6) * k);
    }
    if (this.on('snare')) {
      if (I >= 0.85) {
        if (s === 4 || s === 12) this.hit('snare', T, 0.9);
        if (this.barInSec === this.sec.bars - 1 && s >= 12) this.hit(s & 1 ? 'toml' : 'tomf', T, 0.5 + 0.1 * (s - 12), { layer: 'snare' });
      } else if (s === 8) this.hit('snare', T, 0.8);
    }
    // --- strings
    if (this.on('chords')) this.padPlay(this.str, s, t, { n: 4, lo: 52, hi: 71, vel: 0.35 + 0.25 * iS, key: 'str' });
    if (this.on('gtr') && s === 0 && (this.barInSec & 1) === 0) {
      const d = this.barDur * 2 + 0.1;
      this.trem.note(t, 76, d, 0.4 + 0.2 * iS);
      this.trem.note(t, 77, d, 0.32 + 0.2 * iS);
    }
    if (this.on('arp')) this.arpPlay(this.arp, s, t, { rate: 1, pat: [0, 1, 2, 1, 3, 1, 2, 1], lo: 64, hi: 83, vel: 0.35 + 0.25 * iS, gate: 0.35 });
    // --- burned: brass stabs on the changes and the chase figure
    if (this.on('lead')) {
      if ((s & 3) === 0 && this.changes[s >> 2]) this.stabChord(this.brass, T, this.barChords[s >> 2], 0.75, 55, 76, 0.32);
      this.melodyPlay(this.lead, this.chase, s, t, { vel: 0.7, gate: 0.5 });
    }
  }
}

// ============================================================================ cb_chase
export class CBChase extends CBSong {
  static kind = 'cb_chase';
  static intensity = 1;

  compose() {
    this.bpm = 146;
    this.keyPc = 2; // D minor, the title's key
    this.scale = 'harmonic';
    this.humanize = 0.002;
    this.velJitter = 0.07;
    this.progs.main = 'i bVI bVII i i bVI iv V';
    this.progs.hook = MOTIF_PROG.chase;
    this.progs.brk = 'bVI:2 bVII:2';
    this.progs.build = 'iv:2 V:2';
    this.form = [
      { type: 'intro', bars: 4 },
      { type: 'A', bars: 8 },
      { type: 'B', bars: 8, prog: 'hook' },
      { type: 'break', bars: 4, prog: 'brk' },
      { type: 'build', bars: 4, prog: 'build' },
      { type: 'drop', bars: 8, prog: 'hook' },
      { type: 'A', bars: 8, var: 1 },
      { type: 'drop', bars: 8, prog: 'hook', var: 1 },
    ];
    this.loopFrom = 1;
    this.introLP = 900;
    this.sectionLayers = {
      intro: 'kick hats perc bass fx',
      A: 'kick snare hats perc cym bass arp chords fx',
      B: 'kick snare hats perc cym bass arp chords lead gtr pad fx',
      break: 'snare perc pad gtr cym fx bass',
      build: 'kick snare hats bass chords arp fx cym',
      drop: ALL,
    };
    this.tiers = { pad: 0, fx: 0, cym: 0.1, bass: 0.15, hats: 0.2, perc: 0.3, kick: 0.4, snare: 0.4, chords: 0.45, arp: 0.45, gtr: 0.55, lead: 0.6, extra: 2 };
    this.cbo = { crash: 0.85, fills: true, riser: 0.09 };
    this.fills = ['toms', 'snare', 'mix', 'roll'];
    this.fillRate = 0.3;
    this.kit = {
      ...this.kit, kick: 'kick_rock', snare: 'snare_rock', clap: 'clap_big', hat: 'hat_c', ohat: 'hat_o', ride: 'ride',
      tomh: 'tom_h', tomm: 'tom_m', toml: 'tom_l', tomf: 'tom_f', boom: 'boom',
    };
    this.kitGain = { ...this.kitGain, clap: 0.55, boom: 0.5, tomf: 1, toml: 0.9 };
    const groove = {
      kick: pat('X.....x.X.x.....'), snare: pat('....X.......X...'), hat: pat('x.x.x.x.x.x.x.x.'), ohat: pat('..............x.'),
      tomf: pat('x...............'),
    };
    this.drums = {
      intro: { kick: pat('X.......X.......'), hat: pat('x.x.x.x.x.x.x.x.'), tomf: pat('x.....x.........') },
      A: groove,
      B: { ...groove, kick: pat('X.....x.X.x...x.'), clap: pat('....x.......x...'), hat: pat('xgxgxgxgxgxgxgxg') },
      break: { tomf: pat('X..x..x.X...x.x.'), toml: pat('....x.......x..x'), boom: pat('x...............') },
      drop: {
        kick: pat('X...X...X...X.x.'), snare: pat('....X.......X..x'), clap: pat('....x.......x...'),
        hat: pat('xgxgxgxgxgxgxgxg'), ride: pat('..x...x...x...x.'), tomf: pat('x.......x.......'),
      },
    };
    this.hook = tune(MOTIF.chase, 74, 'minor');
    this.frag = tune("1:6 3:2 5:4 4:2 5:2 | #6:8 5:8 | 1:6 3:2 5:4 4:2 5:2 | 7:8 1':8", 74, 'minor');
    this.pumpBass = 0.3;
    this.pumpMusic = 0.15;
    this.pumpRel = 0.16;
    this.pumpOnKick = true;
    this.mix = {
      kick: { v: 0.3 }, snare: { v: 0.3, rev: 0.16 }, hats: { v: 0.15 }, perc: { v: 0.22, rev: 0.2 }, cym: { v: 0.2, rev: 0.1 },
      bass: { v: 0.44 }, arp: { v: 0.24, rev: 0.12 }, chords: { v: 0.3, rev: 0.2 }, lead: { v: 0.5, rev: 0.25, dly: 0.14 },
      gtr: { v: 0.3, rev: 0.2 }, pad: { v: 0.34, rev: 0.4 }, fx: { v: 0.5, rev: 0.3 },
    };
    this.buildHP = 380;
    this.trim = 0.6;
  }

  setup() {
    this.dlyTime = this.stepDur * 3;
    this.dlyFb = 0.28;
    this.bass = new Mono(this, 'bass', {
      oscs: [{ type: 'sawtooth', gain: 0.5 }, { type: 'sawtooth', gain: 0.35, detune: 10 }], cut: 320, q: 3.5, env: 1600,
      fatk: 0.002, fdec: 0.07, keytrack: 1, atk: 0.002, dec: 0.1, sus: 0.55, rel: 0.03, glide: 0.03, level: 0.4,
      sub: 0.55, subMul: 1, drive: 1.8, post: 3800,
    });
    this.spic = new Poly(this, 'arp', 'strings', { level: 0.32, atk: 0.004, rel: 0.05, cut: 5000 });
    this.brass = new Poly(this, 'chords', 'brass', { level: 0.36, rel: 0.12 });
    this.lead = new Poly(this, 'lead', 'saw', { level: 0.3, atk: 0.006, rel: 0.1, cut: 6500 });
    this.leadLo = new Poly(this, 'lead', 'brass', { level: 0.24, rel: 0.1 });
    this.bala = new Plucker(this, 'gtr', { variant: 'bala', level: 0.42, trem: 1 / this.stepDur * 1.2, tremMin: 0.2, lp: 7500, pan: 0.25 });
    this.choir = new Poly(this, 'pad', 'choir', { level: 0.3, atk: 0.35, rel: 0.9 });
    this.str = new Poly(this, 'pad', 'strings', { level: 0.22, atk: 0.4, rel: 0.8, cut: 4200 });
    this.stabP = new Poly(this, 'fx', 'brass', { level: 0.4, rel: 0.3 });
  }

  onStep(s, t) {
    const ty = this.sec.type, v = this.sec.var || 0;
    if (this.on('bass')) {
      const p = ty === 'break' ? 'R...........R...' : ty === 'intro' ? 'R.rrR.rrR.rrR.rr' : 'R.rrR.rrR.rrO.oo';
      this.rolePlay(this.bass, p, s, t, { lo: 33, gate: 0.7, vel: 0.85, slides: false });
    }
    if (this.on('arp') && ty !== 'break') this.arpPlay(this.spic, s, t, { rate: 1, pat: [0, 2, 1, 2, 3, 2, 1, 2], lo: 62, hi: 81, vel: 0.5, gate: 0.42 });
    if (this.on('chords')) {
      const p = ty === 'drop' ? 'X..x..x.X..x..x.' : 'X.....x.X.......';
      this.compPlay(this.brass, p, s, t, { n: 4, lo: 55, hi: 74, gate: 0.6, vel: 0.55, key: 'brass' });
    }
    if (this.on('pad')) {
      if (ty === 'drop' || ty === 'break') this.padPlay(this.choir, s, t, { n: 4, lo: 50, hi: 69, key: 'choir', vel: 0.55 });
      else this.padPlay(this.str, s, t, { n: 4, lo: 57, hi: 76, key: 'str', vel: 0.45 });
    }
    if (this.on('lead') && (ty === 'B' || ty === 'drop')) {
      const up = ty === 'drop' && v ? 12 : 0;
      this.tunePlay(this.lead, this.hook, s, t, { vel: 0.85, gate: 0.9, oct: up / 12 });
      this.tunePlay(this.leadLo, this.hook, s, t, { vel: 0.6, gate: 0.85, oct: -1 + up / 12, orn: false });
    }
    if (this.on('gtr')) {
      if (ty === 'break') this.tunePlay(this.bala, this.frag, s, t, { vel: 0.8 });
      else if (ty === 'B' || ty === 'drop') this.tunePlay(this.bala, this.hook, s, t, { vel: 0.62, orn: false });
    }
  }

  stab(t, ch, vel) { this.stabChord(this.stabP, t, ch, vel, 57, 79, 0.4); }
}
