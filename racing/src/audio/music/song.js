// Song: one playing theme ("deck"). Owns its sub-mix, a 16th-note transport,
// the arrangement (sections, layers, fills, builds) and the generic dynamic
// behaviours (countdown build → GO slam, final-lap key lift, airborne
// filter-drop, lead/chase switching). Themes subclass it and fill in
// compose() / setup() / onBar() / onStep().

import { audio } from '../audio.js';
import { Rng, hashStr, mix32, prog, voice, clamp, makeMelody, rhythm, indexNotes } from './util.js';
import { bank, driveCurve } from './render.js';
import { LEVELS } from './levels.js';

// layer → mix group: r rhythm (air-filtered), b bass (ducked + air), m music (ducked), l lead, f fx
const GROUP = {
  kick: 'r', snare: 'r', hats: 'r', perc: 'r', cym: 'r', bass: 'b',
  pad: 'm', chords: 'm', arp: 'm', gtr: 'm', extra: 'm', lead: 'l', fx: 'f',
};

// drum role → layer
const ROLE_LAYER = {
  kick: 'kick', kick2: 'kick', snare: 'snare', roll: 'snare', ghost: 'snare', clap: 'snare', rim: 'snare', snap: 'snare',
  brush: 'snare', tomh: 'snare', tomm: 'snare', toml: 'snare', tomf: 'snare',
  hat: 'hats', hat2: 'hats', ohat: 'hats', phat: 'hats', ride: 'hats', bell: 'hats', sweep: 'hats',
  crash: 'cym', crash2: 'cym', china: 'cym', splash: 'cym',
  shaker: 'perc', tamb: 'perc', conga: 'perc', congal: 'perc', clank: 'perc', perc: 'perc',
  impact: 'fx', boom: 'fx', down: 'fx', up: 'fx', revcrash: 'fx', zap: 'fx',
};

const KIT = {
  kick: 'kick_dnb', kick2: 'kick_dnb', snare: 'snare_dnb', ghost: 'snare_ghost', clap: 'clap', rim: 'rim',
  snap: 'snap', brush: 'brush', tomh: 'tom_h', tomm: 'tom_m', toml: 'tom_l', tomf: 'tom_f',
  hat: 'hat_c', hat2: 'hat_c2', ohat: 'hat_o', phat: 'hat_p', ride: 'ride', bell: 'ride_bell', sweep: 'sweep',
  crash: 'crash', crash2: 'crash2', china: 'china', splash: 'splash', shaker: 'shaker', tamb: 'tamb',
  conga: 'conga_h', congal: 'conga_l', clank: 'clank', impact: 'impact', boom: 'boom', down: 'down',
  up: 'up', revcrash: 'revcrash', zap: 'zap',
};

// minimum intensity per layer: pad only → +bass+hats → full drums+chords → +lead+perc
const TIERS = {
  race: { pad: 0, fx: 0, extra: 0, cym: 0.1, bass: 0.2, hats: 0.2, kick: 0.45, snare: 0.45, chords: 0.45, gtr: 0.45, arp: 0.45, lead: 0.66, perc: 0.75 },
  menu: { pad: 0, fx: 0, extra: 0, cym: 0, bass: 0, hats: 0, kick: 0.08, snare: 0.08, chords: 0, gtr: 0, arp: 0.15, lead: 0.26, perc: 0.5 },
};
TIERS.results = TIERS.menu;

const ALL = Object.keys(GROUP).join(' ');
const SECTIONS = {
  intro: 'pad fx cym hats arp perc',
  A: 'pad fx cym hats kick snare bass chords arp gtr lead',
  B: 'pad fx cym hats kick snare bass chords arp gtr lead perc',
  break: 'pad fx cym chords arp lead',
  build: 'pad fx cym hats snare kick chords arp gtr',
  drop: ALL,
  outro: 'pad fx cym chords hats',
  countdown: 'pad fx cym hats kick snare bass',
};

export class Song {
  static kind = 'race';
  static intensity = 0.85;

  constructor(m, id, seed, opts = {}) {
    this.m = m;
    this.ctx = m.ctx;
    this.B = bank(this.ctx);
    this.id = id;
    this.seed = seed >>> 0;
    this.kind = this.constructor.kind;
    this.r = new Rng(mix32(hashStr(id), this.seed));
    this.hr = new Rng(mix32(this.seed, 0x51ed));
    this.nodes = [];
    this.srcs = [];
    this.recent = [];
    this.monos = [];
    this.layers = {};
    this.dead = false;
    this.dying = false;

    // musical defaults — compose() overrides
    this.bpm = 120;
    this.swing = 0;      // 16th swing, fraction of a step (0.33 ≈ triplet feel)
    this.swing8 = 0;     // 8th swing (jazz), fraction (0.33 ≈ triplet)
    this.humanize = 0;   // seconds of timing jitter
    this.velJitter = 0.08;
    this.keyPc = 9;
    this.scale = 'minor';
    this.progs = {};
    this.form = [{ type: 'A', bars: 8 }];
    this.loopFrom = 0;
    this.kit = { ...KIT };
    this.kitGain = { impact: 0.4, boom: 0.4, down: 0.35, up: 0.35, revcrash: 0.4, zap: 0.4 };
    this.mix = {};
    this.drums = {};
    this.fills = null;
    this.tiers = { ...TIERS[this.kind] };
    this.sectionLayers = { ...SECTIONS };
    this.pumpBass = 0;
    this.pumpMusic = 0;
    this.pumpRel = 0.18;
    this.pumpOnKick = false;
    this.transpose = 0;
    this.liftBy = 0;
    this.fillRate = 0.5; // chance of a small fill every 4 bars
    this.buildHP = 320;
    this.introLP = 0;
    this.breakLP = 0;

    this.trim = 1;
    this.compose(this.r);
    if (!this.kit.roll) this.kit.roll = this.kit.snare; // build / countdown rolls (own gain)
    if (this.kitGain.roll == null) this.kitGain.roll = 0.75;
    const lv = LEVELS[id];
    if (lv) {
      for (const k in lv) {
        if (k === 'trim') this.trim = lv.trim;
        else (this.mix[k] ||= {}).v = lv[k];
      }
    }
    this.stepDur = 60 / this.bpm / 4;
    this.beatDur = this.stepDur * 4;
    this.barDur = this.beatDur * 4;
    for (const k in this.progs) if (typeof this.progs[k] === 'string') this.progs[k] = prog(this.progs[k]);
    this._secSets = {};

    this._graph();
    this.setup();
    for (const k in GROUP) this.layer(k); // every switchable layer exists
    if (m._log) this._wrapLog(m._log);

    const race = opts.race || {};
    this.intensity = this.targetIntensity = clamp(opts.intensity ?? this.constructor.intensity, 0, 1);
    this.leading = race.position == null || race.position <= 1;
    this.wantLead = this.leading;
    this.lastLeadSwitch = -99;
    this.cdWanted = !!race.countdown && this.kind === 'race';
    this.climax = false;
    this.mode = 'normal';
    this.solo = m._solo || null; // debug: only these layers
  }

  /** QA hook: record every played note as [inst, layer, time, midi, dur, vel, chordRootPc, chordPcs]. */
  _wrapLog(log) {
    for (const [name, inst] of Object.entries(this)) {
      if (!inst || typeof inst !== 'object' || typeof inst.layer !== 'string' || inst === this) continue;
      for (const fn of ['note', 'play']) {
        if (typeof inst[fn] !== 'function') continue;
        const orig = inst[fn].bind(inst);
        inst[fn] = (t, midi, a, b, o) => {
          const opts = fn === 'play' && typeof a === 'object' ? a : o || {};
          if (this.isOn(inst.layer) || opts.force) {
            const ch = this.barChords ? this.chordAt(Math.floor(((t - this.anchorT) / this.stepDur) % 16)) : null;
            log.push([this.id, name, inst.layer, +t.toFixed(3), midi + this.transpose, typeof a === 'number' ? a : 0, typeof b === 'number' ? b : 0,
              ch ? (this.keyPc + ch.root + this.transpose) % 12 : -1, ch ? ch.iv.map((i) => (this.keyPc + ch.root + i + this.transpose) % 12) : [], this.mode, this.sec?.type]);
          }
          return orig(t, midi, a, b, o);
        };
      }
    }
  }

  // ---- theme hooks (override) -------------------------------------------------
  compose() {}
  setup() {}
  onBar() {}
  onStep() {}
  stab() {}
  onCountdown() {}
  cdStep() {}
  onGo() {}

  /** Parse a progression string (usable inside compose()). */
  P(str) { return prog(str); }

  /** Generate a hook over the main (or given) progression. */
  hook(o) {
    const p = o.prog || this.progs.main;
    const chordAt = (bar, s) => p.chords[p.beats[(bar * 4 + (s >> 2)) % p.len]];
    const notes = makeMelody({
      r: o.r || this.r, bars: o.bars, chordAt, keyPc: this.keyPc, scale: o.scale || this.scale,
      lo: o.lo, hi: o.hi, leap: o.leap,
      rhythms: { call: rhythm(o.call), resp: rhythm(o.resp ?? o.call), end: rhythm(o.end ?? o.resp ?? o.call) },
    });
    return { idx: indexNotes(notes, o.bars), bars: o.bars, notes };
  }

  /** Looping buffer source routed to a layer (beds: rain, vinyl crackle). */
  bed(buffer, layer, level, filters = []) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    this.src(s);
    let last = s;
    for (const [type, f, q] of filters) { const n = this.filter(type, f, q); last.connect(n); last = n; }
    const g = this.gain(level, this.dest(layer));
    last.connect(g);
    return g;
  }

  drumSet() {
    const ty = this.sec.drums || this.sec.type;
    if (this.drums[ty]) return this.drums[ty];
    if (ty === 'build' || ty === 'break') return null;
    return this.drums.A || null;
  }

  // ---- node helpers -----------------------------------------------------------
  gain(v = 1, dest) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    this.nodes.push(g);
    return g;
  }

  filter(type, f, q = 0, dest, db = 0) {
    const n = this.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    if (db) n.gain.value = db;
    if (dest) n.connect(dest);
    this.nodes.push(n);
    return n;
  }

  panner(p = 0, dest) {
    const n = this.ctx.createStereoPanner();
    n.pan.value = p;
    if (dest) n.connect(dest);
    this.nodes.push(n);
    return n;
  }

  shaper(curve, os = '2x', dest) {
    const n = this.ctx.createWaveShaper();
    n.curve = curve;
    n.oversample = os;
    if (dest) n.connect(dest);
    this.nodes.push(n);
    return n;
  }

  delayNode(t, max = 2) {
    const n = this.ctx.createDelay(max);
    n.delayTime.value = t;
    this.nodes.push(n);
    return n;
  }

  /** Long-lived source (oscillator/constant/looping buffer): started now, stopped on teardown. */
  src(node) {
    this.nodes.push(node);
    this.srcs.push(node);
    node.start(this.ctx.currentTime);
    return node;
  }

  lfo(rate, depth, param, type = 'sine') {
    const o = this.src(this.ctx.createOscillator());
    o.type = type;
    o.frequency.value = rate;
    const g = this.gain(depth);
    o.connect(g);
    g.connect(param);
    return { osc: o, depth: g };
  }

  // ---- graph ------------------------------------------------------------------------
  _graph() {
    this.out = this.gain(0, this.m.input);
    this.revOut = this.gain(0, this.m.revIn);
    this.lpF = this.filter('lowpass', 22000, 0.5, this.out);
    this.hpF = this.filter('highpass', 10, 0.5, this.lpF);
    this.post = this.gain(this.trim, this.hpF);
    this.airG = this.gain(1, this.post);
    this.airF = this.filter('lowpass', 22000, 0, this.airG);
    this.rhythm = this.gain(1, this.airF);
    this.bassDuck = this.gain(1, this.rhythm);
    this.musicDuck = this.gain(1, this.post);
    this.leadBus = this.gain(1, this.post);
    this.fxBus = this.gain(1, this.post);
    this.rev = this.gain(1, this.revOut);
  }

  /** Tempo-synced ping-pong delay (created on first use). */
  delayIn() {
    if (this._dly) return this._dly;
    const t = this.dlyTime || this.beatDur * 0.75;
    const inp = this.gain(1);
    const dl = this.delayNode(t), dr = this.delayNode(t);
    const fb = this.gain(this.dlyFb ?? 0.38), damp = this.filter('lowpass', 3800, 0);
    const hp = this.filter('highpass', 260, 0);
    const pl = this.panner(-0.75, this.post), pr = this.panner(0.75, this.post);
    inp.connect(hp); hp.connect(dl);
    dl.connect(pl); dl.connect(dr);
    dr.connect(pr); dr.connect(damp); damp.connect(fb); fb.connect(dl);
    this._dly = inp;
    return inp;
  }

  layer(name) {
    let L = this.layers[name];
    if (L) return L;
    const g = GROUP[name] || 'm';
    const dest = g === 'r' ? this.rhythm : g === 'b' ? this.bassDuck : g === 'm' ? this.musicDuck : g === 'l' ? this.leadBus : this.fxBus;
    const mx = this.mix[name] || {};
    const bus = this.gain(0, dest);
    L = this.layers[name] = {
      name, bus, level: mx.v ?? 1, on: false, pans: new Map(),
      fade: mx.fade ?? (g === 'm' || g === 'l' ? 0.08 : g === 'f' ? 0.05 : 0.004),
    };
    if (mx.rev) bus.connect(this.gain(mx.rev, this.rev));
    if (mx.dly) bus.connect(this.gain(mx.dly, this.delayIn()));
    return L;
  }

  dest(name, pan = 0) {
    const L = this.layer(name);
    if (!pan) return L.bus;
    const key = Math.round(clamp(pan, -1, 1) * 10);
    let p = L.pans.get(key);
    if (!p) { p = this.panner(key / 10, L.bus); L.pans.set(key, p); }
    return p;
  }

  isOn(name) {
    const L = this.layers[name];
    return !!L && L.on;
  }
  on(name) { return this.isOn(name); }

  // ---- event tracking (GO rewinds, voice cap, teardown) ------------------------
  track(src, g, t0, t1) { this.recent.push({ src, g, t0, t1 }); }

  _prune(now) {
    let j = 0;
    for (let i = 0; i < this.recent.length; i++) {
      const e = this.recent[i];
      if (e.t1 > now - 0.05) this.recent[j++] = e;
    }
    this.recent.length = j;
  }

  _cancelAfter(t) {
    for (const e of this.recent) {
      if (e.t0 >= t - 1e-4) {
        try { e.src.stop(t); } catch { /* already stopped */ }
      } else if (e.t1 > t && e.g) {
        e.g.gain.cancelScheduledValues(t);
        e.g.gain.setTargetAtTime(0, t, 0.012);
        try { e.src.stop(t + 0.1); } catch { /* */ }
      }
    }
    for (const mo of this.monos) mo.cut(t);
  }

  // ---- playing samples -----------------------------------------------------------
  /** Trigger a drum/fx sample by role (kit-mapped) or by sample name. */
  hit(role, t, vel = 1, o = {}) {
    const layer = o.layer || ROLE_LAYER[role] || 'perc';
    const L = this.layers[layer];
    if (!o.force && (!L || !L.on)) return null;
    if (vel < 0.5 && this.recent.length > 150) return null; // voice cap: ghosts go first
    if (this.recent.length > 260 && role !== 'kick') return null;
    const name = this.kit[role] || role;
    const buf = this.B.get(name);
    const ctx = this.ctx;
    t = Math.max(t, ctx.currentTime + 0.002);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const rate = o.rate || 1;
    if (rate !== 1) src.playbackRate.value = rate;
    const g = ctx.createGain();
    const lvl = vel * (o.gain ?? 1) * (this.kitGain[role] ?? 1);
    g.gain.value = lvl;
    src.connect(g);
    g.connect(this.dest(layer, o.pan || 0));
    src.start(t);
    let end = t + buf.duration / rate;
    if (o.dur) {
      g.gain.setValueAtTime(lvl, t + o.dur);
      g.gain.setTargetAtTime(0, t + o.dur, 0.012);
      end = Math.min(end, t + o.dur + 0.08);
      src.stop(end);
    }
    this.track(src, g, t, end);
    if (role === 'hat' || role === 'phat' || role === 'hat2') { // open-hat choke
      const oh = this._ohat;
      if (oh && oh.end > t && t > oh.t + 0.01) {
        oh.g.gain.setTargetAtTime(0, t, 0.008);
        oh.end = t;
      }
    } else if (role === 'ohat') this._ohat = { g, end, t };
    if (role === 'kick') { // one kick voice: a new hit chokes the previous tail
      const k = this._kick;
      if (k && k.end > t && k.t < t - 0.01) k.g.gain.setTargetAtTime(0, Math.max(k.t, t - 0.004), 0.0015);
      this._kick = { g, end, t };
      if (this.pumpOnKick) this.pump(t);
    }
    return g;
  }

  /** Sidechain-style ducking of the bass/music buses (gain automation). */
  pump(t, depth = 1, rel = this.pumpRel) {
    if (this.pumpBass > 0) {
      const g = this.bassDuck.gain;
      g.setTargetAtTime(1 - Math.min(0.95, this.pumpBass * depth), t, 0.003);
      g.setTargetAtTime(1, t + 0.01, rel / 3.2);
    }
    if (this.pumpMusic > 0) {
      const g = this.musicDuck.gain;
      g.setTargetAtTime(1 - Math.min(0.95, this.pumpMusic * depth), t, 0.004);
      g.setTargetAtTime(1, t + 0.012, rel / 2.8);
    }
  }

  /** Noise riser into a downbeat. */
  riser(t, dur, o = {}) {
    if (!this.isOn('fx')) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = audio.noise('white');
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = o.q ?? 1.3;
    bp.frequency.setValueAtTime(o.f0 ?? 350, t);
    bp.frequency.exponentialRampToValueAtTime(o.f1 ?? 9000, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.level ?? 0.1, t + dur * 0.98);
    g.gain.setTargetAtTime(0, t + dur, 0.01);
    src.connect(bp); bp.connect(g); g.connect(this.dest('fx', o.pan || 0));
    src.start(t, this.hr.next());
    src.stop(t + dur + 0.08);
    this.track(src, g, t, t + dur + 0.08);
  }

  // ---- timing helpers -------------------------------------------------------------
  sw(s, t) {
    let o = 0;
    if (this.swing && (s & 1)) o += this.swing * this.stepDur;
    if (this.swing8 && (s & 3) === 2) o += this.swing8 * 2 * this.stepDur;
    if (this.humanize) o += (this.hr.next() - 0.5) * 2 * this.humanize;
    return Math.max(t + o, this.ctx.currentTime + 0.002);
  }

  hv(v) { return clamp(v * (1 + (this.hr.next() - 0.5) * 2 * this.velJitter), 0.05, 1.1); }

  /** Per-bar deterministic RNG (independent of what else consumed randomness). */
  barRng(salt = 0) { return new Rng(mix32(mix32(this.seed, this.barAbs * 131 + salt), hashStr(this.id))); }

  nextStepTime(t) {
    const k = Math.ceil((Math.max(t, this.ctx.currentTime + 0.006) - this.anchorT) / this.stepDur - 1e-6);
    return this.anchorT + k * this.stepDur;
  }

  beatInfo(now) {
    const pos = Math.max(0, (now - this.anchorT) / this.stepDur);
    const beats = pos / 4;
    return { bpm: this.bpm, bar: Math.floor(beats / 4), beat: Math.floor(beats) % 4, phase: beats - Math.floor(beats) };
  }

  // ---- harmony helpers --------------------------------------------------------------
  chordAt(s) { return this.barChords[(s >> 2) & 3]; }

  /** Beats until the chord after beat b of this bar changes (looks ahead through the progression). */
  chordBeats(b) {
    if (this.mode === 'countdown') return 64;
    const p = this.prog;
    const base = this.barInSec * 4 + b;
    const idx = p.beats[base % p.len];
    let n = 1;
    while (n < p.len && p.beats[(base + n) % p.len] === idx) n++;
    return n;
  }

  /** Voice-led voicing, cached per key while the chord stays the same. */
  voicing(ch, n, lo, hi, key = 'v', opts = {}) {
    const cache = (this._vc ||= {});
    const c = cache[key];
    if (c && c.ch === ch && c.n === n) return c.v;
    const v = voice(ch, this.keyPc, n, lo, hi, c && c.v, opts);
    cache[key] = { ch, n, v };
    return v;
  }

  /** MIDI note of the chord root in [lo, lo+11]. */
  rootIn(ch, lo) {
    const pc = (this.keyPc + ch.root) % 12;
    return lo + ((pc - lo) % 12 + 12) % 12;
  }

  /** Chord tone by index (0 root, 1 third, 2 fifth...) above rootIn(ch, lo). */
  toneOf(ch, lo, idx) {
    const r = this.rootIn(ch, lo);
    const iv = ch.iv;
    return r + iv[idx % iv.length] + 12 * Math.floor(idx / iv.length);
  }

  // ---- transport ---------------------------------------------------------------------
  start(t0) {
    this.t0 = t0;
    this._rewind(t0);
    this.barAbs = -1;
    this.secIdx = 0;
    this.barInSec = -1;
    this.sec = this.form[0];
    this.fill = null;
    this.barChords = null;
    this.changes = [false, false, false, false];
    this.forceIntensityUntil = -1;
    if (this.m._startSec) { // debug/QA: start in a given section type
      const i = this.form.findIndex((f) => f.type === this.m._startSec);
      if (i >= 0) { this.secIdx = i; this.sec = this.form[i]; }
    }
    if (this.cdWanted) this._enterCountdown(t0);
  }

  fadeIn(t0, fade) {
    for (const p of [this.out.gain, this.revOut.gain]) {
      p.cancelScheduledValues(0);
      p.setValueAtTime(0, t0);
      p.setTargetAtTime(1, t0, Math.max(0.006, fade / 3.5));
    }
  }

  retire(fade) {
    if (this.dying) return;
    const now = this.ctx.currentTime;
    this.dying = true;
    fade = Math.max(0.03, fade);
    for (const p of [this.out.gain, this.revOut.gain]) {
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now);
      else { const v = p.value; p.cancelScheduledValues(now); p.setValueAtTime(v, now); }
      p.setTargetAtTime(0, now, fade / 4.5);
    }
    this.stopSchedAt = now + fade * 0.8;
    this.killAt = now + fade * 1.25 + 0.05;
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    for (const e of this.recent) { try { e.src.stop(); } catch { /* */ } }
    for (const s of this.srcs) { try { s.stop(); } catch { /* */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* */ } }
    if (this._cdFx) for (const f of this._cdFx) { try { f.src.stop(); } catch { /* */ } }
    this.nodes = [];
    this.srcs = [];
    this.recent = [];
    this.monos = [];
    this.layers = {};
  }

  schedule(until) {
    if (this.dead) return;
    const now = this.ctx.currentTime;
    if (this.dying && now > this.stopSchedAt) return;
    if (this.nextT < now - 0.04) {
      // fell behind (main thread stalled): skip to the next bar line instead of bursting notes
      const behind = Math.ceil((now - this.nextT) / this.stepDur);
      let idx = this.stepIdx + behind;
      idx = Math.ceil(idx / 16) * 16;
      this.stepIdx = idx;
      this.nextT = this.anchorT + (this.stepIdx - this.anchorStep) * this.stepDur;
    }
    while (this.nextT < until && !this.dead) {
      const t = this.nextT;
      const s = this.stepIdx & 15;
      if (this.cdWanted && this.mode !== 'countdown' && (s & 3) === 0) {
        this._enterCountdown(t);
        continue; // re-run this slot as countdown step 0
      }
      if (s === 0) this._bar(t);
      this._step(s, t);
      this.stepIdx++;
      this.nextT = this.anchorT + (this.stepIdx - this.anchorStep) * this.stepDur;
    }
  }

  _rewind(t) {
    this.anchorT = t;
    this.anchorStep = 0;
    this.stepIdx = 0;
    this.nextT = t;
  }

  // ---- arrangement -----------------------------------------------------------------
  _secSet(sec) {
    const key = sec.type + '|' + (sec.plus || '') + '|' + (sec.minus || '');
    let set = this._secSets[key];
    if (!set) {
      set = new Set((this.sectionLayers[sec.type] || ALL).split(' '));
      if (sec.plus) for (const l of sec.plus.split(' ')) set.add(l);
      if (sec.minus) for (const l of sec.minus.split(' ')) set.delete(l);
      this._secSets[key] = set;
    }
    return set;
  }

  _advance() {
    this.barInSec = 0;
    if (this.mode === 'outro') return;
    if (this.climax) {
      this.climaxN = (this.climaxN || 0) + 1;
      this.sec = this.climaxForm[this.climaxN % this.climaxForm.length];
      return;
    }
    this.secIdx++;
    if (this.secIdx >= this.form.length) { this.secIdx = this.loopFrom; this.cycle = (this.cycle || 0) + 1; }
    this.sec = this.form[this.secIdx];
  }

  _nextSec() {
    if (this.mode === 'outro') return this.sec;
    if (this.liftAt != null) return this.climaxForm ? this.climaxForm[0] : { type: 'drop' };
    if (this.climax) return this.climaxForm[((this.climaxN || 0) + 1) % this.climaxForm.length];
    const i = this.secIdx + 1 >= this.form.length ? this.loopFrom : this.secIdx + 1;
    return this.form[i];
  }

  _bar(t) {
    this.barAbs++;
    this._prune(this.ctx.currentTime);
    let startFx = false;
    if (this.mode === 'countdown') {
      this.cdBar++;
    } else {
      this.barInSec++;
      if (this.barInSec >= this.sec.bars) { this._advance(); startFx = true; }
      if (this.barInSec === 0) startFx = true;
      if (this.finishPending) {
        this.finishPending = false;
        this.mode = 'outro';
        this.climax = false;
        this.sec = { type: 'outro', bars: 4 };
        this.barInSec = 0;
        startFx = false;
      }
      if (this.liftAt === this.barAbs) { this._doLift(t); startFx = false; }
      if (this._slamAt != null && Math.abs(this._slamAt - t) < 1e-4) startFx = false;
      if (this.wantLead !== this.leading && this.barAbs - this.lastLeadSwitch >= 2) {
        this.leading = this.wantLead;
        this.lastLeadSwitch = this.barAbs;
        if (this.leading && this.kind === 'race' && this.mode === 'normal') this.hit('crash', t, 0.7);
      }
    }
    const forced = this.climax || this.mode === 'countdown' || this.barAbs < this.forceIntensityUntil;
    this.intensity = forced ? 1 : this.targetIntensity;
    this._applyLayers(t);
    this._harmony();
    this.fill = null;
    if (startFx && this.mode === 'normal') this._sectionStart(t, this.barAbs === 0);
    if (this.mode === 'normal') this._planFill(t);
    this.onBar(t);
    if (this._slamAt != null && Math.abs(this._slamAt - t) < 1e-4) {
      this._slamAt = null;
      this._slam(t);
    }
  }

  _applyLayers(t) {
    const set = this._secSet(this.mode === 'countdown' ? { type: 'countdown' } : this.sec);
    const I = this.intensity;
    for (const name in this.layers) {
      const L = this.layers[name];
      let want = set.has(name) && I >= (this.tiers[name] ?? 0);
      if (name === 'extra') want = want && this.climax;
      if (this.solo) want = want && this.solo.includes(name);
      if (want !== L.on) {
        L.on = want;
        L.justOn = want;
        const g = L.bus.gain;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(want ? L.level : 0, t, want ? L.fade : L.fade * 2 + 0.02);
      }
    }
  }

  _harmony() {
    let p;
    if (this.mode === 'countdown') p = this.progs.countdown || this.progs.main;
    else p = this.progs[this.sec.prog || 'main'] || this.progs.main;
    this.prog = p;
    const base = this.mode === 'countdown' ? 0 : this.barInSec * 4;
    const prev = this.barChords ? this.barChords[3] : null;
    this.barChords = [0, 1, 2, 3].map((b) => p.chords[p.beats[(base + b) % p.len]]);
    this.chord = this.barChords[0];
    const force = this._forceChange || (this.mode === 'countdown' ? this.cdBar === 0 : this.barInSec === 0);
    this._forceChange = false;
    this.changes = this.barChords.map((c, i) => (i === 0 ? force || c !== prev : c !== this.barChords[i - 1]));
  }

  _sectionStart(t, first) {
    const ty = this.sec.type;
    if (!first && (ty === 'A' || ty === 'B' || ty === 'drop')) {
      this.hit('crash', t, ty === 'drop' ? 1 : 0.8);
      if (ty === 'drop') { this.hit('impact', t, 0.55); this.pump(t, 1, 0.4); }
    }
    if (ty === 'break' && !first) {
      this.hit('crash', t, 0.75);
      this.hit('down', t, 0.5);
    }
    const hp = this.hpF.frequency, lp = this.lpF.frequency;
    if (ty === 'build') {
      const dur = this.sec.bars * this.barDur;
      this.riser(t, dur, { level: 0.09 });
      hp.cancelScheduledValues(t);
      hp.setValueAtTime(10, t);
      hp.exponentialRampToValueAtTime(this.buildHP, t + dur);
      lp.cancelScheduledValues(t);
      lp.setTargetAtTime(22000, t, 0.3);
      return;
    }
    hp.cancelScheduledValues(t);
    hp.setTargetAtTime(10, t, 0.006);
    lp.cancelScheduledValues(t);
    if (ty === 'intro' && this.introLP) {
      const dur = this.sec.bars * this.barDur;
      lp.setValueAtTime(this.introLP, t);
      lp.exponentialRampToValueAtTime(20000, t + dur);
    } else if (ty === 'break' && this.breakLP) {
      lp.setTargetAtTime(this.breakLP, t, 0.4);
    } else {
      lp.setTargetAtTime(22000, t, 0.05);
    }
  }

  _planFill(t) {
    if (!this.isOn('snare') && !this.isOn('kick')) return;
    const last = this.barInSec === this.sec.bars - 1;
    const r = this.barRng(7);
    if (last) {
      const next = this._nextSec();
      if (next === this.sec) return;
      if (this.sec.type === 'build') {
        if (r.chance(0.45)) this.fill = { from: 12, style: 'stop' };
        return;
      }
      let style = r.pick(this.fills || ['snare', 'toms', 'mix', 'roll']);
      if (next.type === 'break' || next.type === 'drop') style = r.chance(0.4) ? 'stop' : style;
      this.fill = { from: r.chance(0.35) ? 8 : 12, style };
      if (next.type === 'drop' || next.type === 'A' || next.type === 'B') {
        this.hit('revcrash', t + this.barDur - this.B.get('revcrash').duration, 0.4, { layer: 'fx' });
      }
    } else if ((this.barInSec & 3) === 3 && r.chance(this.fillRate)) {
      this.fill = { from: 14, style: r.pick(['snare', 'snare', 'toms', 'roll']) };
    }
  }

  _fillStep(s, t) {
    const f = this.fill;
    if (!f || s < f.from || f.style === 'stop') return;
    const i = s - f.from, n = 16 - f.from;
    const v = 0.5 + (0.5 * (i + 1)) / n;
    const T = this.sw(s, t);
    switch (f.style) {
      case 'toms': {
        const seq = ['tomh', 'tomh', 'tomm', 'tomm', 'toml', 'toml', 'tomf', 'tomf'];
        this.hit(seq[Math.floor((i / n) * 8)], T, v);
        if (i === 0) this.hit('snare', T, v);
        break;
      }
      case 'mix':
        this.hit(i % 3 === 2 ? 'tomm' : 'snare', T, v * (i % 2 ? 0.8 : 1));
        if (i === n - 1) this.hit('kick', T, 0.9);
        break;
      case 'roll':
        this.hit('snare', T, v * 0.85);
        this.hit('snare', T + this.stepDur / 2, v * 0.65);
        break;
      default:
        this.hit('snare', T, v * (i % 2 ? 0.75 : 1));
        if (n > 4 && i % 4 === 0) this.hit('kick', T, 0.8);
    }
    if (f.lift && i === 0) this.riser(T, n * this.stepDur, { level: 0.08, f0: 1200 });
  }

  _buildStep(s, t) {
    const bars = this.sec.bars, b = this.barInSec;
    const pos = (b * 16 + s) / (bars * 16); // 0..1 through the build
    let every = pos < 0.5 ? 4 : pos < 0.75 ? 2 : 1;
    if (bars <= 4) every = pos < 0.5 ? 2 : 1;
    if (this.fill && this.fill.style === 'stop' && s >= this.fill.from) return;
    if (s % every === 0) {
      const v = 0.3 + 0.55 * pos;
      this.hit('roll', t, v);
      if (pos > 0.875 && this.stepDur > 0.075) this.hit('roll', t + this.stepDur / 2, v * 0.75);
    }
    if ((s & 3) === 0 && pos < 0.75) this.hit('kick', t, 0.8);
    if ((s & 1) === 0) this.hit('hat', t, 0.35 + 0.3 * pos);
  }

  _drums(s, t) {
    const set = this.drumSet();
    if (!set) return;
    const fill = this.fill && s >= this.fill.from ? this.fill : null;
    if (fill && fill.style === 'stop') return;
    for (const role in set) {
      const p = set[role];
      const v = p[(this.barInSec * 16 + s) % p.length];
      if (!v) continue;
      if (fill && (role === 'kick' || role === 'snare' || role === 'clap' || role === 'ghost')) continue;
      this.hit(role, this.sw(s, t), this.hv(v));
    }
  }

  _step(s, t) {
    if (this.mode === 'countdown') { this._cdStep(s, t); return; }
    if (this.liftPending && this.liftAt == null && s <= 12) {
      this.liftAt = this.barAbs + 1;
      this.fill = { from: Math.max(12, s), style: 'snare', lift: true };
    }
    this._drums(s, t);
    if (this.fill) this._fillStep(s, t);
    if (this.sec.type === 'build' && this.mode === 'normal') this._buildStep(s, t);
    // final-lap climax: double-time hats on top of the groove
    if (this.climax && (s & 1) && this.isOn('extra') && !(this.fill && s >= this.fill.from)) {
      this.hit('hat2', this.sw(s, t), (s & 2) ? 0.42 : 0.3, { layer: 'perc', force: true });
    }
    this.onStep(s, t);
  }

  // ---- countdown → GO ---------------------------------------------------------------
  _enterCountdown(t) {
    this.mode = 'countdown';
    this.cdT = t;
    this.cdBar = -1;
    this.fill = null;
    this._rewind(t);
    if (this.barAbs < 0) this.barAbs = 0;
    const ctx = this.ctx;
    // endless Shepard riser + rising noise band
    const sh = ctx.createBufferSource();
    sh.buffer = this.B.get('shepard');
    sh.loop = true;
    const shg = ctx.createGain();
    shg.gain.setValueAtTime(0, t);
    shg.gain.setTargetAtTime(this.cdShepard ?? 0.12, t, 1.4);
    sh.connect(shg); shg.connect(this.fxBus);
    sh.start(t);
    const nz = ctx.createBufferSource();
    nz.buffer = audio.noise('white');
    nz.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.setTargetAtTime(9000, t, 2.6);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.setTargetAtTime(0.08, t, 2);
    nz.connect(bp); bp.connect(ng); ng.connect(this.fxBus);
    nz.start(t, this.hr.next());
    this._cdFx = [{ src: sh, g: shg, nodes: [shg] }, { src: nz, g: ng, nodes: [bp, ng] }];
    this._harmony(); // the tension chord must exist before onCountdown()
    // tense, filtered build on the whole deck, held a little under the drop level
    const pg = this.post.gain;
    pg.cancelScheduledValues(t);
    pg.setTargetAtTime(this.trim * (this.cdLevel ?? 0.7), t, 0.05);
    const hp = this.hpF.frequency, lp = this.lpF.frequency;
    hp.cancelScheduledValues(t); hp.setValueAtTime(10, t); hp.setTargetAtTime(240, t, 2.2);
    lp.cancelScheduledValues(t); lp.setValueAtTime(1400, t); lp.setTargetAtTime(15000, t + 0.3, 2.2);
    this.onCountdown(t);
  }

  _cdStep(s, t) {
    const e = t - this.cdT;
    if ((s & 3) === 0) this.hit('kick', t, 0.75, { force: true });
    const every = e < 1.1 ? 4 : e < 2.2 ? 2 : 1;
    if (s % every === 0) {
      const v = clamp(0.2 + e / 8, 0.2, 0.75);
      this.hit('roll', t, v, { force: true });
      if (e > 3.3 && this.stepDur > 0.07) this.hit('roll', t + this.stepDur / 2, v * 0.75, { force: true });
    }
    if ((s & 3) === 2) this.hit('hat', t, 0.45, { force: true });
    this.cdStep(s, t, e);
  }

  countdown(on) {
    if (this.kind !== 'race') return;
    if (on) {
      if (this.mode !== 'countdown') this.cdWanted = true;
    } else {
      this.cdWanted = false;
      if (this.mode === 'countdown') this._go(this.nextStepTime(this.ctx.currentTime), false); // aborted
    }
  }

  /** GO: slam into the drop on the next 16th, rewinding anything already scheduled. */
  go() {
    this._go(this.nextStepTime(this.ctx.currentTime + 0.004), true);
  }

  _go(t, slam) {
    this.cdWanted = false;
    this._cancelAfter(t);
    if (this._cdFx) {
      for (const f of this._cdFx) {
        f.g.gain.cancelScheduledValues(t);
        f.g.gain.setTargetAtTime(0, t, 0.006);
        try { f.src.stop(t + 0.08); } catch { /* */ }
        const nodes = f.nodes;
        f.src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch { /* */ } } };
      }
      this._cdFx = null;
    }
    const hp = this.hpF.frequency, lp = this.lpF.frequency;
    hp.cancelScheduledValues(t); hp.setTargetAtTime(10, t, 0.004);
    lp.cancelScheduledValues(t); lp.setTargetAtTime(22000, t, 0.004);
    const pg = this.post.gain;
    pg.cancelScheduledValues(t); pg.setTargetAtTime(this.trim, t, 0.003);
    this._rewind(t);
    this.mode = 'normal';
    let i;
    if (slam) {
      i = this.form.findIndex((s) => s.type === 'drop');
      if (i < 0) i = this.form.findIndex((s) => s.type === 'B');
    } else i = this.form.findIndex((s) => s.type === 'A');
    if (i < 0) i = 0;
    this.secIdx = i;
    this.sec = this.form[i];
    this.barInSec = -1;
    this._forceChange = true;
    if (slam) {
      this.forceIntensityUntil = this.barAbs + 1 + this.sec.bars;
      this._slamAt = t;
    }
  }

  _slam(t) {
    this.lastSlam = t;
    this.hit('crash', t, 1, { pan: -0.4, force: true });
    this.hit('crash2', t + 0.006, 0.9, { pan: 0.4, force: true });
    this.hit('impact', t, 1, { force: true });
    this.hit('clap', t, 0.7, { force: true });
    this.stab(t, this.chord, 1);
    this.pump(t, 1, 0.45);
    this.onGo(t);
  }

  // ---- race reactions ----------------------------------------------------------------
  setLeading(lead) { this.wantLead = !!lead; }

  finalLap() {
    if (this.liftPending || this.climax || this.kind !== 'race' || this.mode === 'outro') return;
    this.liftPending = true;
    this.liftAt = null;
  }

  _doLift(t) {
    this.liftPending = false;
    this.liftAt = null;
    this.transpose += this.liftBy || (this.r.chance(0.5) ? 1 : 2);
    this.climax = true;
    this.climaxN = 0;
    if (!this.climaxForm) this.climaxForm = [{ type: 'drop', bars: 8 }, { type: 'drop', bars: 8, var: 1 }];
    this.sec = this.climaxForm[0];
    this.barInSec = 0;
    this._forceChange = true;
    this.hit('crash', t, 1, { pan: -0.3, force: true });
    this.hit('crash2', t, 0.8, { pan: 0.3, force: true });
    this.hit('impact', t, 0.7, { force: true });
    const f = this.hpF.frequency, l = this.lpF.frequency;
    f.cancelScheduledValues(t); f.setTargetAtTime(10, t, 0.005);
    l.cancelScheduledValues(t); l.setTargetAtTime(22000, t, 0.005);
    this.pump(t, 1, 0.35);
  }

  finish() {
    if (this.kind !== 'race') return;
    this.finishPending = true;
    this.liftPending = false;
    this.liftAt = null;
  }

  accent(t) {
    this.hit('crash', t, 0.75, { force: true });
    this.stab(t, this.chordAt(0) || this.chord, 0.6);
  }

  airborne(on) {
    const now = this.ctx.currentTime;
    const f = this.airF.frequency, g = this.airG.gain;
    if (on) {
      this._airT = now;
      f.cancelScheduledValues(now); f.setTargetAtTime(340, now, 0.06);
      g.cancelScheduledValues(now); g.setTargetAtTime(0.4, now, 0.06);
    } else {
      const long = this._airT != null && now - this._airT > 0.35;
      const t = long ? this.nextStepTime(now) : now;
      f.cancelScheduledValues(now); f.setTargetAtTime(22000, t, long ? 0.006 : 0.05);
      g.cancelScheduledValues(now); g.setTargetAtTime(1, t, long ? 0.004 : 0.05);
      if (long && this.mode !== 'countdown') {
        this.hit('crash', t, 0.85, { force: true });
        this.hit('kick', t, 1, { force: true });
        this.hit('boom', t, 0.6, { force: true });
        this.pump(t, 1, 0.3);
      }
      this._airT = null;
    }
  }

  // ---- shared musical building blocks ------------------------------------------------
  /** The next different chord after step s (for anticipations and approach notes). */
  chordAfter(s) {
    const p = this.prog;
    if (this.mode === 'countdown' || !p) return this.chord;
    const beat = this.barInSec * 4 + (s >> 2);
    const cur = p.beats[beat % p.len];
    for (let k = 1; k <= p.len; k++) {
      const i = p.beats[(beat + k) % p.len];
      if (i !== cur) return p.chords[i];
    }
    return p.chords[cur];
  }

  /** Chord for a hit at step s, anticipating the next chord on the last 8th before a change. */
  chordSoon(s) {
    if ((s & 3) < 2 || this.mode === 'countdown') return this.chordAt(s);
    const p = this.prog;
    const beat = this.barInSec * 4 + (s >> 2);
    const nxt = p.chords[p.beats[(beat + 1) % p.len]];
    return nxt;
  }

  /**
   * Role-pattern line (bass, riffs) on a mono/poly instrument. One char per 16th:
   * '.' rest, '-' hold, r root, o octave, f fifth, t third, s seventh, 9 ninth,
   * n next chord's root, a approach (semitone under the next root), l low root,
   * h high root, 4 fourth, b flat-two (tension). UPPERCASE = slide + accent.
   */
  rolePlay(inst, pat, s, t, o = {}) {
    const n = pat.length, i = (this.barInSec * 16 + s) % n, c = pat[i];
    if (c === '.' || c === '-') return;
    let len = 1;
    while (len < n && pat[(i + len) % n] === '-') len++;
    const lc = c.toLowerCase();
    const ch = lc === 'n' || lc === 'a' ? this.chordAfter(s) : this.chordAt(s);
    const r = this.rootIn(ch, o.lo ?? 31);
    let m = r;
    switch (lc) {
      case 'o': m = r + 12; break;
      case 'f': m = r + 7; break;
      case 't': m = r + ch.iv[1]; break;
      case 's': m = r + (ch.iv[3] && ch.iv[3] < 12 ? ch.iv[3] : 10); break;
      case '9': m = r + 14; break;
      case 'a': m = r - 1; break;
      case 'l': m = r - 12; break;
      case 'h': m = r + 24; break;
      case '4': m = r + 5; break;
      case 'b': m = r + 1; break;
      default: break;
    }
    const up = c !== lc;
    const T = o.noSwing ? t : this.sw(s, t);
    inst.note(T, m + (o.oct ?? 0) * 12, len * this.stepDur * (o.gate ?? 0.92), (o.vel ?? 0.85) * (up ? 1 : 0.88), {
      slide: up && o.slides !== false, accent: up, ...(o.nopts ? o.nopts(i, c) : null),
    });
    return m;
  }

  /** Chord comping: 'x' hit, 'X' accent, '-' hold, '.' rest. */
  compPlay(inst, pat, s, t, o = {}) {
    const n = pat.length, i = (this.barInSec * 16 + s) % n, c = pat[i];
    if (c !== 'x' && c !== 'X') return;
    let len = 1;
    while (len < n && pat[(i + len) % n] === '-') len++;
    const ch = o.anticipate === false ? this.chordAt(s) : this.chordSoon(s);
    const v = this.voicing(ch, o.n ?? 4, o.lo ?? 55, o.hi ?? 76, o.key ?? 'comp', o.vopts);
    const dur = len * this.stepDur * (o.gate ?? 0.9);
    const vel = (o.vel ?? 0.7) * (c === 'X' ? 1.15 : 1);
    const T = this.sw(s, t);
    if (inst.chord) inst.chord(T, v, dur, vel);
    else for (const m of v) inst.note(T, m, dur, vel);
    if (o.bass != null) inst.note(T, this.rootIn(ch, o.bass), dur, vel * 0.8);
  }

  /** Sustained chord on every chord change (and when the layer comes in). */
  padPlay(inst, s, t, o = {}) {
    if ((s & 3) !== 0) return;
    const b = s >> 2;
    const L = this.layers[inst.layer];
    const fresh = b === 0 && L && L.justOn;
    if (fresh) L.justOn = false;
    if (!this.changes[b] && !fresh) return;
    const ch = this.barChords[b];
    const v = this.voicing(ch, o.n ?? 4, o.lo ?? 52, o.hi ?? 74, o.key ?? 'pad', o.vopts ?? { spread: 14 });
    const dur = this.chordBeats(b) * this.beatDur + (o.overlap ?? 0.04);
    const vel = (o.vel ?? 0.6) / Math.sqrt(v.length / 3);
    for (const m of v) inst.note(t, m, dur, vel, o.nopts || {});
    if (o.bass != null) inst.note(t, this.rootIn(ch, o.bass), dur, vel * 0.8, o.nopts || {});
  }

  /** Play an indexed melody ({ idx, bars }) at step s. */
  melodyPlay(inst, mel, s, t, o = {}) {
    if (!mel) return;
    const k = ((this.barInSec + (o.barOffset || 0)) % mel.bars) * 16 + s;
    const nt = mel.idx[k];
    if (!nt) return;
    const T = this.sw(s, t);
    const dur = nt.len * this.stepDur * (o.gate ?? 0.9);
    const legato = o.legato && inst._lastEnd != null && Math.abs(T - inst._lastEnd) < this.stepDur * 0.7;
    inst._lastEnd = T + nt.len * this.stepDur;
    inst.note(T, nt.m + (o.oct ?? 0) * 12, dur, (o.vel ?? 0.8) * nt.v, { slide: legato });
  }

  /** Arpeggiate the current chord. o.rate = steps per note, o.pat = voicing indices. */
  arpPlay(inst, s, t, o = {}) {
    const rate = o.rate ?? 1;
    if (s % rate) return;
    const ch = this.chordAt(s);
    const v = this.voicing(ch, o.n ?? 4, o.lo ?? 60, o.hi ?? 84, o.key ?? 'arp', o.vopts);
    const pat = o.pat ?? [0, 1, 2, 3];
    const i = Math.floor((this.barInSec * 16 + s) / rate);
    const idx = pat[i % pat.length];
    const m = v[((idx % v.length) + v.length) % v.length] + 12 * Math.floor(idx / v.length);
    const acc = (s & 3) === 0 ? 1 : 0.78;
    inst.note(this.sw(s, t), m, rate * this.stepDur * (o.gate ?? 0.6), (o.vel ?? 0.6) * acc);
  }

  /** Chord stab (slam / lap accent): voiced chord + low root on a Poly. */
  stabChord(inst, t, ch, vel, lo = 55, hi = 79, dur = 0.35) {
    if (!inst || !ch) return;
    const v = this.voicing(ch, 4, lo, hi, 'stab');
    for (const m of v) inst.note(t, m, dur, vel * 0.75, { force: true });
    inst.note(t, this.rootIn(ch, lo - 12), dur, vel * 0.7, { force: true });
  }

  drive(k = 3) { return driveCurve(k); }
}
