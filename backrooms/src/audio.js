// Every sound in the game is synthesised at runtime: the hum of the tubes, the
// footstep on wet carpet, the thing breathing behind you, the muzak in Level
// Fun. No audio files, so nothing to load and nothing to stream — and the room
// tone can bend with the level instead of looping.
//
// Three layers: ROOM TONE (a continuous bed per level), MUSIC (a slow generative
// score that reacts to dread), and ONE-SHOTS (a small synth vocabulary that the
// bestiary and the scares call by name).

import { clamp, clamp01, rng } from './util.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.master = null;
    this.volSfx = 0.9;
    this.volMusic = 0.55;
    this.muted = false;
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.tone = null;
    this.music = null;
    this.dread = 0;
    this.heart = null;
    this.rand = rng(20260724);
  }

  // Browsers want a gesture first; every entry point calls this.
  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    // a short generated impulse gives every level a plausible tail
    this.verb = this.ctx.createConvolver();
    this.verb.buffer = this.impulse(2.4, 0.6);
    this.verbGain = this.ctx.createGain();
    this.verbGain.gain.value = 0.3;
    this.dry = this.ctx.createGain();
    this.dry.gain.value = 1;
    this.bus = this.ctx.createGain();
    this.bus.connect(this.dry).connect(this.master);
    this.bus.connect(this.verb);
    this.verb.connect(this.verbGain).connect(this.master);
    this.master.connect(this.ctx.destination);
    this.ready = true;
    return this.ctx;
  }

  resume() { this.ctx?.resume?.(); }
  suspend() { this.ctx?.suspend?.(); }

  setReverb(amount) {
    if (!this.ready) return;
    this.verbGain.gain.value = clamp(amount, 0, 1.2) * 0.55;
  }

  setMuted(m) {
    this.muted = m;
    if (this.ready) this.master.gain.value = m ? 0 : 0.9;
  }

  // ---------------------------------------------------------------- helpers
  impulse(dur = 2.2, decay = 0.6) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2 + decay * 4);
      }
    }
    return buf;
  }

  noiseBuf(dur = 1) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.72 + w * 0.28;      // gently brown, easier on the ears
      d[i] = last;
    }
    return buf;
  }

  // gain node with a fade envelope, wired to the bus (or a target)
  env(t0, attack, hold, release, peak, target = null) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    g.connect(target || this.bus);
    return g;
  }

  osc(type, f0, f1, t0, dur, gain, target) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = this.env(t0, Math.min(0.02, dur * 0.2), dur * 0.3, dur * 0.6, gain, target);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  noise(t0, dur, gain, filter = {}, target) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf(Math.max(0.2, dur));
    const bq = this.ctx.createBiquadFilter();
    bq.type = filter.type || 'bandpass';
    bq.frequency.setValueAtTime(filter.f ?? 900, t0);
    if (filter.f2) bq.frequency.exponentialRampToValueAtTime(Math.max(40, filter.f2), t0 + dur);
    bq.Q.value = filter.q ?? 1;
    const g = this.env(t0, filter.attack ?? 0.005, dur * 0.2, dur * 0.8, gain, target);
    src.connect(bq).connect(g);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
    return src;
  }

  // Distance/direction: a cheap stereo placement good enough for corridors.
  place(at, gain = 1) {
    if (!at) return { gain, pan: 0 };
    const dx = at.x - this.listener.x, dz = at.z - this.listener.z;
    const dist = Math.hypot(dx, dz);
    const att = 1 / (1 + dist * dist * 0.006);
    const rel = Math.atan2(-dx, -dz) - this.listener.yaw;
    return { gain: gain * att, pan: clamp(Math.sin(rel), -1, 1) };
  }

  panner(pan) {
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; p.connect(this.bus); }
    return p || this.bus;
  }

  // ---------------------------------------------------------------- one-shots
  // Names are the vocabulary the bestiary and fx.js call. Each is a couple of
  // oscillators and a band of noise; the shape is what carries the character.
  oneShot(name, gain = 1, at = null) {
    if (!this.ready || this.muted || name === 'none') return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const p = this.place(at, gain * this.volSfx);
    const out = this.panner(p.pan);
    const G = p.gain;
    const R = this.rand;
    switch (name) {
      // ---- creatures
      case 'houndBark':
        for (let i = 0; i < 3; i++) {
          this.osc('sawtooth', 210 - i * 30, 70, t + i * 0.13, 0.12, 0.5 * G, out);
          this.noise(t + i * 0.13, 0.12, 0.4 * G, { f: 700, f2: 260, q: 0.7 }, out);
        }
        break;
      case 'houndSnarl':
        this.osc('sawtooth', 120, 60, t, 0.5, 0.45 * G, out);
        this.noise(t, 0.55, 0.5 * G, { f: 500, f2: 180, q: 0.6 }, out);
        break;
      case 'houndBreath':
      case 'facelingBreath':
      case 'breathClose':
        this.noise(t, 0.5, 0.5 * G, { type: 'bandpass', f: 420, f2: 260, q: 0.9, attack: 0.12 }, out);
        this.noise(t + 0.62, 0.42, 0.34 * G, { f: 300, f2: 500, q: 0.9, attack: 0.1 }, out);
        break;
      case 'clawStep':
        this.noise(t, 0.06, 0.3 * G, { f: 2600, q: 2 }, out);
        break;
      case 'smilerHum':
        this.osc('sine', 58, 54, t, 1.4, 0.3 * G, out);
        break;
      case 'smilerShriek':
      case 'partyShriek':
      case 'facelingScream':
        this.osc('sawtooth', 900, 2400, t, 0.5, 0.4 * G, out);
        this.osc('square', 1300, 700, t + 0.05, 0.4, 0.25 * G, out);
        this.noise(t, 0.55, 0.4 * G, { f: 2400, f2: 900, q: 0.8 }, out);
        break;
      case 'facelingClick':
      case 'glassTick':
        this.noise(t, 0.03, 0.4 * G, { f: 3400, q: 4 }, out);
        break;
      case 'stealerHello':
        this.osc('triangle', 220, 190, t, 0.5, 0.22 * G, out);
        this.osc('triangle', 330, 300, t + 0.18, 0.4, 0.16 * G, out);
        break;
      case 'stealerWrong':
        this.osc('triangle', 210, 96, t, 0.9, 0.3 * G, out);
        this.osc('sawtooth', 104, 60, t + 0.1, 0.8, 0.2 * G, out);
        break;
      case 'stealerTear':
      case 'clumpGrab':
      case 'dullerGrab':
      case 'crawlerBite':
      case 'mothBite':
      case 'partyBite':
      case 'nurseCut':
      case 'wretchPull':
        this.noise(t, 0.3, 0.6 * G, { f: 1400, f2: 300, q: 0.7 }, out);
        this.osc('sawtooth', 150, 60, t, 0.3, 0.4 * G, out);
        break;
      case 'clumpWet':
      case 'wretchGurgle':
        this.noise(t, 0.7, 0.35 * G, { type: 'lowpass', f: 500, f2: 220, q: 1 }, out);
        break;
      case 'clumpMoan':
      case 'dullerMoan':
        this.osc('sawtooth', 110, 92, t, 1.3, 0.3 * G, out);
        this.osc('sine', 55, 48, t, 1.5, 0.24 * G, out);
        break;
      case 'mothFlutter':
        for (let i = 0; i < 6; i++) this.noise(t + i * 0.06, 0.05, 0.14 * G, { f: 900 + R() * 700, q: 2 }, out);
        break;
      case 'partyGiggle':
        for (let i = 0; i < 5; i++) this.osc('triangle', 500 + R() * 400, 300, t + i * 0.11, 0.09, 0.22 * G, out);
        break;
      case 'bacteriaHiss':
        this.noise(t, 1.2, 0.2 * G, { f: 5200, q: 0.8, attack: 0.3 }, out);
        break;
      case 'bacteriaBurn':
        this.noise(t, 0.4, 0.4 * G, { f: 3200, f2: 800, q: 1 }, out);
        break;
      case 'wretchSurface':
      case 'waterHeave':
        this.noise(t, 0.8, 0.6 * G, { type: 'lowpass', f: 900, f2: 200, q: 1, attack: 0.02 }, out);
        this.osc('sine', 70, 40, t, 0.9, 0.3 * G, out);
        break;
      case 'howlerWheeze':
        this.noise(t, 0.6, 0.3 * G, { f: 1200, f2: 600, q: 1.4 }, out);
        break;
      case 'howlerScream':
        this.osc('sawtooth', 420, 1800, t, 1.1, 0.45 * G, out);
        this.osc('sawtooth', 640, 1500, t + 0.06, 1.0, 0.3 * G, out);
        this.noise(t, 1.2, 0.35 * G, { f: 2000, q: 0.6 }, out);
        break;
      case 'crawlerScrape':
      case 'mannequinScrape':
        this.noise(t, 0.5, 0.3 * G, { f: 2200, f2: 3000, q: 3 }, out);
        break;
      case 'crawlerChitter':
        for (let i = 0; i < 8; i++) this.noise(t + i * 0.045, 0.03, 0.22 * G, { f: 2600 + R() * 1200, q: 5 }, out);
        break;
      case 'mannequinStrike':
        this.noise(t, 0.2, 0.7 * G, { f: 1800, f2: 400, q: 1 }, out);
        this.osc('square', 300, 80, t, 0.2, 0.4 * G, out);
        break;
      case 'nurseHeels':
        this.noise(t, 0.05, 0.35 * G, { f: 2800, q: 6 }, out);
        break;
      case 'nurseSigh':
        this.noise(t, 0.9, 0.3 * G, { f: 700, f2: 400, q: 1.2, attack: 0.2 }, out);
        break;
      case 'levDeep':
        this.osc('sine', 38, 30, t, 2.6, 0.5 * G, out);
        this.noise(t, 2.4, 0.2 * G, { type: 'lowpass', f: 180, q: 0.7, attack: 0.6 }, out);
        break;
      case 'levRush':
        this.noise(t, 1.6, 0.7 * G, { type: 'lowpass', f: 400, f2: 1200, q: 0.8 }, out);
        this.osc('sine', 44, 90, t, 1.6, 0.5 * G, out);
        break;
      case 'levTake':
        this.osc('sine', 60, 24, t, 1.4, 0.7 * G, out);
        this.noise(t, 1.4, 0.7 * G, { type: 'lowpass', f: 900, f2: 120 }, out);
        break;
      case 'dullerShuffle':
        this.noise(t, 0.3, 0.2 * G, { f: 600, q: 1.2 }, out);
        break;
      case 'shepherdHum': {
        const base = NOTE(48);
        for (const m of [1, 1.5, 2]) this.osc('sine', base * m, base * m * 0.995, t, 3.2, 0.14 * G, out);
        break;
      }
      case 'watcherGone':
        this.noise(t, 0.25, 0.25 * G, { f: 300, f2: 90, q: 0.8 }, out);
        break;

      // ---- the world
      case 'stingerLow':
        this.osc('sine', 90, 40, t, 1.1, 0.55 * G, out);
        this.noise(t, 0.7, 0.3 * G, { type: 'lowpass', f: 260, q: 0.8 }, out);
        break;
      case 'stingerHigh':
        this.osc('sawtooth', 1600, 260, t, 0.7, 0.35 * G, out);
        this.noise(t, 0.5, 0.4 * G, { f: 3000, f2: 700, q: 0.7 }, out);
        break;
      case 'glassPop':
        this.noise(t, 0.25, 0.6 * G, { f: 5000, f2: 1200, q: 1.2 }, out);
        this.osc('square', 2400, 400, t, 0.08, 0.3 * G, out);
        break;
      case 'glassKnock':
        for (let i = 0; i < 3; i++) this.noise(t + i * 0.16, 0.07, 0.4 * G, { f: 2200, q: 3 }, out);
        break;
      case 'breakerThunk':
        this.osc('square', 90, 40, t, 0.18, 0.6 * G, out);
        this.noise(t, 0.2, 0.4 * G, { f: 400, f2: 120, q: 1 }, out);
        break;
      case 'doorSlam':
        this.osc('sine', 120, 44, t, 0.3, 0.7 * G, out);
        this.noise(t, 0.28, 0.6 * G, { type: 'lowpass', f: 900, f2: 200 }, out);
        break;
      case 'tileCrack':
      case 'floorCrack':
        this.noise(t, 0.4, 0.6 * G, { f: 1800, f2: 500, q: 1.4 }, out);
        this.osc('square', 200, 70, t, 0.2, 0.35 * G, out);
        break;
      case 'bodyThud':
        this.osc('sine', 80, 34, t, 0.4, 0.7 * G, out);
        this.noise(t, 0.3, 0.4 * G, { type: 'lowpass', f: 400, q: 0.9 }, out);
        break;
      case 'screamFar':
        this.osc('sawtooth', 700, 1300, t, 1.2, 0.14 * G, out);
        this.noise(t, 1.3, 0.1 * G, { f: 1400, q: 0.8, attack: 0.3 }, out);
        break;
      case 'crowdLaugh':
        for (let i = 0; i < 14; i++) {
          this.osc('triangle', 300 + R() * 500, 220 + R() * 200, t + R() * 1.4, 0.12, 0.09 * G, out);
        }
        break;
      case 'whisper':
        this.noise(t, 1.4, 0.35 * G, { f: 1700, f2: 1100, q: 2.4, attack: 0.2 }, out);
        break;
      case 'stepsAway':
      case 'stepBehind':
        this.noise(t, 0.09, 0.3 * G, { f: 700, q: 1.6 }, out);
        break;
      case 'phoneRing':
        for (let i = 0; i < 2; i++) {
          for (let k = 0; k < 12; k++) {
            this.osc('sine', k % 2 ? 1050 : 800, k % 2 ? 1050 : 800, t + i * 1.2 + k * 0.045, 0.04, 0.16 * G, out);
          }
        }
        break;
      case 'tapeChew':
        this.noise(t, 0.9, 0.5 * G, { f: 1200, f2: 300, q: 0.6 }, out);
        this.osc('sawtooth', 240, 90, t, 0.6, 0.2 * G, out);
        break;
      case 'staticHit':
        this.noise(t, 0.35, 0.5 * G, { type: 'highpass', f: 1800, q: 0.5 }, out);
        break;

      // ---- you
      case 'pickup':
        this.osc('triangle', 660, 990, t, 0.12, 0.3 * G, out);
        break;
      case 'noteOpen':
        this.noise(t, 0.3, 0.25 * G, { f: 3000, f2: 1500, q: 1.5 }, out);
        break;
      case 'objectiveDone':
        this.osc('sine', 520, 520, t, 0.18, 0.25 * G, out);
        this.osc('sine', 780, 780, t + 0.14, 0.3, 0.2 * G, out);
        break;
      case 'exitOpen':
        this.osc('sine', 200, 400, t, 1.2, 0.3 * G, out);
        this.noise(t, 1.4, 0.25 * G, { type: 'lowpass', f: 800, f2: 2000, attack: 0.4 }, out);
        break;
      case 'hurt':
        this.osc('sawtooth', 180, 70, t, 0.3, 0.4 * G, out);
        this.noise(t, 0.25, 0.4 * G, { f: 500, f2: 200 }, out);
        break;
      case 'die':
        this.osc('sine', 120, 30, t, 2.4, 0.6 * G, out);
        this.noise(t, 2.2, 0.5 * G, { type: 'lowpass', f: 1200, f2: 90 }, out);
        break;
      case 'tapeStart':
        this.noise(t, 0.5, 0.3 * G, { f: 900, f2: 2600, q: 0.8 }, out);
        this.osc('square', 60, 90, t, 0.4, 0.15 * G, out);
        break;
      case 'tapeStop':
        this.noise(t, 0.4, 0.3 * G, { f: 2200, f2: 500, q: 0.8 }, out);
        break;
      case 'splash':
        this.noise(t, 0.35, 0.4 * G, { type: 'highpass', f: 900, q: 0.7 }, out);
        break;
      case 'swim':
        this.noise(t, 0.6, 0.3 * G, { type: 'lowpass', f: 700, f2: 300, attack: 0.1 }, out);
        break;
      default:
        this.noise(t, 0.2, 0.25 * G, { f: 1200, q: 1 }, out);
    }
  }

  // Footsteps: the material decides the timbre, and everybody hears it but you.
  footstep(mat, force = 0.6) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + 0.005;
    const G = 0.4 * force * this.volSfx;
    const soft = { f: 420, f2: 220, q: 1.2 };
    const table = {
      carpet: soft, carpetDamp: { f: 300, f2: 160, q: 1.4 }, carpetOffice: soft, carpetHotel: soft,
      concrete: { f: 1500, f2: 500, q: 1.6 }, concreteWet: { f: 1200, f2: 400, q: 1.4 },
      tilePool: { f: 2200, f2: 700, q: 2 }, wetTileFloor: { f: 2400, f2: 800, q: 2.2 },
      tileWhite: { f: 2400, f2: 900, q: 2 }, linoleum: { f: 1900, f2: 700, q: 1.8 },
      metalPlate: { f: 2800, f2: 900, q: 3 }, grate: { f: 3200, f2: 1100, q: 4 },
      woodFloor: { f: 900, f2: 400, q: 1.6 }, gravel: { f: 2600, f2: 900, q: 1.2 },
      snow: { f: 700, f2: 300, q: 1.1 }, water: { type: 'highpass', f: 1000, q: 0.7 },
      dirt: { f: 800, f2: 300, q: 1.3 }, rock: { f: 1700, f2: 600, q: 1.8 },
      wheat: { f: 2000, f2: 1200, q: 1.1 }, asphalt: { f: 1300, f2: 500, q: 1.5 },
    };
    const f = table[mat] || soft;
    this.noise(t, 0.09, G, f);
    this.osc('sine', 90, 55, t, 0.07, G * 0.5);
  }

  // ---------------------------------------------------------------- room tone
  startTone(spec) {
    this.stopTone();
    if (!this.ready) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    g.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 2.5);
    const nodes = [];
    const kind = spec.room;
    const hum = spec.hum ?? 0.5;

    const drone = (freq, gain, type = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const og = ctx.createGain();
      og.gain.value = gain;
      o.connect(og).connect(g);
      o.start();
      nodes.push(o, og);
      return o;
    };
    const bed = (f, q, gain, type = 'bandpass') => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf(4);
      src.loop = true;
      const bq = ctx.createBiquadFilter();
      bq.type = type;
      bq.frequency.value = f;
      bq.Q.value = q;
      const ng = ctx.createGain();
      ng.gain.value = gain;
      src.connect(bq).connect(ng).connect(g);
      src.start();
      nodes.push(src, bq, ng);
      return { src, bq, ng };
    };

    switch (kind) {
      case 'buzz':
        drone(60, 0.035 * hum);
        drone(120, 0.022 * hum, 'triangle');
        drone(180.5, 0.012 * hum, 'sawtooth');
        bed(3600, 3, 0.008 * hum, 'bandpass');
        break;
      case 'drone':
        drone(42, 0.05 * hum);
        drone(63, 0.02 * hum);
        bed(220, 1, 0.012);
        break;
      case 'silence':
        bed(1200, 0.6, 0.004);
        break;
      case 'machinery':
        drone(38, 0.05);
        bed(300, 1.2, 0.03);
        this.pulse = setInterval(() => this.oneShot('breakerThunk', 0.12), 3400);
        break;
      case 'water':
        bed(500, 0.8, 0.03, 'lowpass');
        bed(2600, 1.5, 0.012);
        break;
      case 'drips':
        bed(800, 0.7, 0.008);
        break;
      case 'wind':
        bed(420, 0.5, 0.05, 'lowpass');
        break;
      case 'cave':
        drone(30, 0.04);
        bed(260, 0.7, 0.018, 'lowpass');
        break;
      case 'crowd':
        bed(700, 0.8, 0.02);
        bed(1800, 1.2, 0.01);
        break;
      case 'static':
        bed(2400, 0.4, 0.03, 'highpass');
        break;
      case 'hospital':
        drone(58, 0.02);
        bed(900, 1, 0.01);
        break;
      case 'rain':
        bed(3000, 0.5, 0.05, 'highpass');
        bed(600, 0.8, 0.02, 'lowpass');
        break;
      case 'trainYard':
        drone(34, 0.04);
        bed(500, 0.9, 0.02, 'lowpass');
        break;
      case 'schoolBell':
        bed(1400, 0.8, 0.008);
        break;
      default:
        bed(900, 0.7, 0.008);
    }
    this.tone = { g, nodes, spec };
    // drips and gusts, on their own clocks
    if ((spec.drip ?? 0) > 0.02) {
      this.dripTimer = setInterval(() => {
        if (Math.random() < spec.drip) {
          const t = ctx.currentTime + Math.random() * 0.4;
          this.noise(t, 0.06, 0.12 * spec.drip, { f: 2600 + Math.random() * 1800, q: 6 });
        }
      }, 900);
    }
    if ((spec.wind ?? 0) > 0.02) {
      this.windTimer = setInterval(() => {
        const t = ctx.currentTime;
        this.noise(t, 3.2, 0.05 * spec.wind, { type: 'lowpass', f: 500, f2: 260, attack: 1.1 });
      }, 5200);
    }
    this.setReverb(spec.reverb ?? 0.35);
  }

  stopTone() {
    clearInterval(this.dripTimer);
    clearInterval(this.windTimer);
    clearInterval(this.pulse);
    if (!this.tone) return;
    const { g, nodes } = this.tone;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(() => {
      for (const n of nodes) { try { n.stop?.(); n.disconnect?.(); } catch { /* already gone */ } }
      try { g.disconnect(); } catch { /* fine */ }
    }, 800);
    this.tone = null;
  }

  // ---------------------------------------------------------------- music
  // A slow generative score. Each bed is a chord set, a timbre and a pace; the
  // dread value pushes tempo and dissonance up without changing tracks.
  startMusic(bed) {
    this.stopMusic();
    if (!this.ready || bed === 'none') return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    g.gain.linearRampToValueAtTime(this.volMusic * 0.5, ctx.currentTime + 4);
    this.music = { g, bed, step: 0, timer: null };
    const BEDS = {
      dread: { root: 41, scale: [0, 1, 3, 6, 8], every: 3.4, wave: 'sine', pad: true },
      drone: { root: 38, scale: [0, 5, 7], every: 6.0, wave: 'sine', pad: true },
      calm: { root: 53, scale: [0, 4, 7, 11, 14], every: 4.2, wave: 'triangle', pad: true },
      muzak: { root: 60, scale: [0, 4, 7, 9, 12], every: 0.42, wave: 'triangle', pad: false },
      choir: { root: 45, scale: [0, 3, 7, 10], every: 5.0, wave: 'sawtooth', pad: true },
      chase: { root: 33, scale: [0, 1, 5, 6], every: 0.28, wave: 'square', pad: false },
      lullaby: { root: 72, scale: [0, 2, 4, 7, 9], every: 0.85, wave: 'sine', pad: false },
      wrong: { root: 60, scale: [0, 3.5, 6.5, 9], every: 0.5, wave: 'triangle', pad: false },
    };
    const b = BEDS[bed] || BEDS.drone;
    const R = this.rand;
    const tick = () => {
      if (!this.music) return;
      const t = ctx.currentTime + 0.02;
      const step = this.music.step++;
      const dread = this.dread;
      const deg = b.scale[Math.floor(R() * b.scale.length)];
      const oct = b.pad ? 0 : Math.floor(R() * 2) * 12;
      const f = NOTE(b.root + deg + oct + (dread > 0.6 ? 1 : 0));
      if (b.pad) {
        const dur = b.every * 2.2;
        for (const mul of [1, 1.5, 2.02]) {
          const o = ctx.createOscillator();
          o.type = b.wave;
          o.frequency.value = f * mul * (1 + (R() - 0.5) * 0.004);
          const og = this.env(t, dur * 0.4, dur * 0.2, dur * 0.5, 0.06 * (mul === 1 ? 1 : 0.5), g);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 700 + dread * 1800;
          o.connect(lp).connect(og);
          o.start(t);
          o.stop(t + dur + 0.2);
        }
      } else {
        // pulsed patterns: muzak, chase, a music box that is slightly out
        const dur = b.every * (bed === 'chase' ? 0.9 : 1.6);
        const o = ctx.createOscillator();
        o.type = b.wave;
        o.frequency.value = f;
        const og = this.env(t, 0.01, dur * 0.2, dur * 0.7, bed === 'chase' ? 0.05 + dread * 0.05 : 0.045, g);
        o.connect(og);
        o.start(t);
        o.stop(t + dur + 0.1);
        if (bed === 'chase' && step % 4 === 0) this.osc('sine', 60, 40, t, 0.14, 0.08, g);
      }
      const every = b.every * (bed === 'chase' ? 1 - this.dread * 0.35 : 1);
      this.music.timer = setTimeout(tick, every * 1000);
    };
    tick();
  }

  stopMusic() {
    if (!this.music) return;
    clearTimeout(this.music.timer);
    const { g } = this.music;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 1.2);
    setTimeout(() => { try { g.disconnect(); } catch { /* fine */ } }, 1500);
    this.music = null;
  }

  setMusicVolume(v) {
    this.volMusic = clamp01(v);
    if (this.music) this.music.g.gain.value = this.volMusic * 0.5;
  }

  // ---------------------------------------------------------------- pulse
  // The heartbeat is the game's only honest UI: it tells you something is close
  // before you can see it.
  updateHeart(dt, closeness) {
    if (!this.ready || this.muted) return;
    this.heartT = (this.heartT ?? 0) - dt;
    if (closeness <= 0.05) return;
    const rate = 1.05 - closeness * 0.62;
    if (this.heartT <= 0) {
      this.heartT = rate;
      const t = this.ctx.currentTime;
      const g = 0.14 * closeness * this.volSfx;
      this.osc('sine', 62, 40, t, 0.14, g);
      this.osc('sine', 54, 34, t + rate * 0.32, 0.12, g * 0.7);
    }
  }

  setListener(x, z, yaw) {
    this.listener.x = x;
    this.listener.z = z;
    this.listener.yaw = yaw;
  }
}
