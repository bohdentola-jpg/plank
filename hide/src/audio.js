// All sound is synthesized with WebAudio: rain on the roof, the store's hum,
// your breathing and heartbeat, and everything the monster does.
import { clamp, lerp } from './util.js';

export class Audio {
  constructor(cfg) {
    this.cfg = cfg;
    this.ready = false;
    this.muted = false;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.3;
    this.master.connect(comp).connect(ctx.destination);

    // world bus -> muffle (when hidden) -> master; reverb send in parallel
    this.world = ctx.createGain();
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    this.muffle.Q.value = 0.4;
    this.world.connect(this.muffle).connect(this.master);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.6, 2.4);
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.32;
    this.verbSend.connect(this.verb).connect(this.muffle);
    this.body = ctx.createGain();
    this.body.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.9;
    this.music.connect(this.master);

    this.white = this.noiseBuf('white');
    this.pink = this.noiseBuf('pink');
    this.brown = this.noiseBuf('brown');

    // monster voice bus with its own panner + occlusion filter
    this.mPan = this.panner(0, 0, 0, 2, 1.1, 80);
    this.mOcc = ctx.createBiquadFilter();
    this.mOcc.type = 'lowpass';
    this.mOcc.frequency.value = 16000;
    this.mBus = ctx.createGain();
    this.mBus.connect(this.mOcc).connect(this.mPan);

    this.loops();
    this.ready = true;
    this.nextBeat = ctx.currentTime + 0.5;
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
  }
  setMuted(m) {
    this.muted = m;
    if (this.ready) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  // ------------------------------------------------------------ building blocks
  noiseBuf(kind, secs = 3) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
    }
    return buf;
  }
  impulse(secs, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 800 ? i / 800 : 1);
      }
    }
    return buf;
  }
  panner(x, y, z, ref = 1.5, roll = 1.2, max = 60) {
    const p = this.ctx.createPanner();
    p.panningModel = this.cfg.hrtf ? 'HRTF' : 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = roll;
    p.maxDistance = max;
    this.setPos(p, x, y, z);
    p.connect(this.world);
    p.connect(this.verbSend);
    return p;
  }
  setPos(p, x, y, z) {
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else p.setPosition(x, y, z);
  }
  noise(buf = this.white, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = loop;
    if (!loop) s.loopStart = 0;
    return s;
  }
  filt(type, freq, Q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    return f;
  }
  gain(v = 0) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }
  osc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }
  env(g, t, a, peak, d, sustain = 0) {
    const p = g.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
  }
  shaper(amount = 20) {
    const ws = this.ctx.createWaveShaper();
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 2 - 1;
      c[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    ws.curve = c;
    return ws;
  }
  // one-shot noise burst through a filter into dest
  burst(dest, t, { buf = this.white, type = 'bandpass', freq = 1000, Q = 1, a = 0.002, d = 0.08, peak = 0.5, sweep = null, offset = Math.random() * 2 } = {}) {
    const s = this.noise(buf);
    const f = this.filt(type, freq, Q);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + a + d);
    const g = this.gain();
    s.connect(f).connect(g).connect(dest);
    this.env(g, t, a, peak, d);
    s.start(t, offset);
    s.stop(t + a + d + 0.05);
  }
  tone(dest, t, { type = 'sine', freq = 100, to = null, a = 0.002, d = 0.2, peak = 0.4 } = {}) {
    const o = this.osc(type, freq);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
    const g = this.gain();
    o.connect(g).connect(dest);
    this.env(g, t, a, peak, d);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }
  at(x, y, z, ref = 1.5, roll = 1.2) {
    // temporary panner for a positioned one-shot (auto-collected)
    return this.panner(x, y, z, ref, roll);
  }

  // ------------------------------------------------------------ continuous beds
  loops() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // rain on the roof: hiss + low drum, decorrelated stereo
    const rainHiss = this.noise(this.pink, true);
    const rh = this.filt('bandpass', 3800, 0.5);
    this.rainHissG = this.gain(0.05);
    rainHiss.connect(rh).connect(this.rainHissG).connect(this.world);
    rainHiss.start(t, 0.3);
    const rainLow = this.noise(this.brown, true);
    const rl = this.filt('lowpass', 420, 0.7);
    this.rainLowG = this.gain(0.07);
    rainLow.connect(rl).connect(this.rainLowG).connect(this.world);
    rainLow.start(t, 1.1);
    // electrical hum of the lit fixtures
    this.humG = this.gain(0);
    const h1 = this.osc('sawtooth', 120), hf = this.filt('lowpass', 360, 1);
    const h2 = this.osc('sine', 240);
    const h2g = this.gain(0.35);
    h1.connect(hf).connect(this.humG);
    h2.connect(h2g).connect(this.humG);
    this.humG.connect(this.world);
    h1.start(t); h2.start(t);
    // buzz/crackle of the flickering tube (driven per frame)
    this.buzzG = this.gain(0);
    const bz = this.osc('square', 120), bzf = this.filt('bandpass', 2400, 2);
    bz.connect(bzf).connect(this.buzzG);
    this.buzzPan = this.panner(0, 4, 0, 1.2, 1.4, 30);
    this.buzzG.connect(this.buzzPan);
    bz.start(t);
    // refrigeration drone near the freezers
    this.fridgePan = this.panner(0, 1, 0, 2.5, 1.0, 40);
    const f1 = this.osc('sine', 58), f2 = this.osc('sine', 116.5);
    const fn = this.noise(this.pink, true), fnf = this.filt('bandpass', 280, 1.5);
    this.fridgeG = this.gain(0.045);
    const f2g = this.gain(0.4), fng = this.gain(0.5);
    f1.connect(this.fridgeG);
    f2.connect(f2g).connect(this.fridgeG);
    fn.connect(fnf).connect(fng).connect(this.fridgeG);
    this.fridgeG.connect(this.fridgePan);
    f1.start(t); f2.start(t); fn.start(t, 0.7);
    // lantern: a faint electronic whine
    this.lanternPan = this.panner(0, 0, 0, 0.6, 2, 10);
    this.lanternG = this.gain(0);
    const l1 = this.osc('sine', 2950), l1g = this.gain(0.15);
    const l2 = this.noise(this.pink, true), l2f = this.filt('highpass', 6000, 0.5);
    l1.connect(l1g).connect(this.lanternG);
    l2.connect(l2f).connect(this.lanternG);
    this.lanternG.connect(this.lanternPan);
    l1.start(t); l2.start(t, 2);
    // tension drone
    this.droneF = this.filt('lowpass', 200, 5);
    this.droneG = this.gain(0);
    const d1 = this.osc('sawtooth', 55), d2 = this.osc('sawtooth', 58.27), d3 = this.osc('sawtooth', 41.2);
    d1.connect(this.droneF); d2.connect(this.droneF); d3.connect(this.droneF);
    this.droneF.connect(this.droneG).connect(this.music);
    d1.start(t); d2.start(t); d3.start(t);
    // high nerve cluster
    this.nerveG = this.gain(0);
    const n1 = this.osc('sine', 1975.5), n2 = this.osc('sine', 2093), trem = this.osc('sine', 5.3), tremG = this.gain(0.5);
    trem.connect(tremG).connect(this.nerveG.gain);
    n1.connect(this.nerveG); n2.connect(this.nerveG);
    this.nerveG.connect(this.music);
    n1.start(t); n2.start(t); trem.start(t);
    // comfort pad: warm, slow, soft
    this.padG = this.gain(0);
    const padF = this.filt('lowpass', 850, 0.6);
    [174.61, 220, 261.63, 329.63, 392].forEach((f, i) => {
      const o = this.osc(i % 2 ? 'triangle' : 'sine', f);
      const v = this.osc('sine', 0.13 + i * 0.05), vg = this.gain(f * 0.004);
      v.connect(vg).connect(o.frequency);
      const og = this.gain(i === 4 ? 0.35 : 0.8);
      o.connect(og).connect(padF);
      o.start(t); v.start(t);
    });
    const padLfo = this.osc('sine', 0.07), padLfoG = this.gain(0.25);
    this.padAmp = this.gain(0.75);
    padLfo.connect(padLfoG).connect(this.padAmp.gain);
    padLfo.start(t);
    padF.connect(this.padAmp).connect(this.padG).connect(this.music);
    // breathing (body): two noise bands with JS-driven envelopes
    const br = this.noise(this.pink, true);
    this.breathHi = this.filt('bandpass', 1300, 1.1);
    this.breathLo = this.filt('bandpass', 480, 1.4);
    this.breathG = this.gain(0);
    const bLoG = this.gain(0.7);
    br.connect(this.breathHi).connect(this.breathG);
    br.connect(this.breathLo).connect(bLoG).connect(this.breathG);
    this.breathG.connect(this.body);
    br.start(t, 0.5);
  }

  // ------------------------------------------------------------ per-frame mix
  listener(pos, fwd, up) {
    if (!this.ready) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
      L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z;
      L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z;
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }
  mix(m) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const k = 0.15;
    this.muffle.frequency.setTargetAtTime(lerp(17000, m.hiddenKind === 'locker' ? 1400 : 700, m.hidden), t, k);
    this.rainHissG.gain.setTargetAtTime(lerp(0.02, 0.055, m.stock) * (1 - m.dawn * 0.7), t, 0.5);
    this.rainLowG.gain.setTargetAtTime(lerp(0.035, 0.085, m.stock) * (1 - m.dawn * 0.7), t, 0.5);
    this.humG.gain.setTargetAtTime(m.hum * 0.022, t, 0.3);
    this.droneG.gain.setTargetAtTime(m.tension * 0.11, t, 0.4);
    this.droneF.frequency.setTargetAtTime(160 + m.tension * 520, t, 0.4);
    this.nerveG.gain.setTargetAtTime(Math.pow(m.tension, 2) * 0.01 + m.suspicion * 0.012, t, 0.3);
    this.padG.gain.setTargetAtTime(m.comfort * 0.05, t, 1.2);
    this.lanternG.gain.setTargetAtTime(m.lantern * 0.01, t, 0.3);
    this.mOcc.frequency.setTargetAtTime(m.occluded ? 900 : 16000, t, 0.15);
    // breathing envelope
    const b = m.breath; // {level, phase(0..1), holding}
    const ph = b.phase;
    const inh = ph < 0.4 ? Math.sin((ph / 0.4) * Math.PI) : 0;
    const exh = ph >= 0.45 ? Math.sin(((ph - 0.45) / 0.55) * Math.PI) : 0;
    const e = b.holding ? 0 : inh * 0.8 + exh;
    this.breathG.gain.setTargetAtTime(e * b.level * 0.11, t, 0.04);
    this.breathHi.frequency.setTargetAtTime(inh > exh ? 1600 : 1050, t, 0.05);
    // heartbeat
    if (m.heart > 0.02) {
      while (this.nextBeat < t + 0.1) {
        this.beat(this.nextBeat, m.heart);
        this.nextBeat += 60 / m.bpm;
      }
    } else this.nextBeat = t + 0.2;
  }
  setPositions(p) {
    if (!this.ready) return;
    if (p.monster) this.setPos(this.mPan, p.monster.x, 1.6, p.monster.z);
    if (p.lantern) this.setPos(this.lanternPan, p.lantern.x, p.lantern.y, p.lantern.z);
    if (p.fridge) this.setPos(this.fridgePan, p.fridge.x, 1.2, p.fridge.z);
    if (p.buzz) this.setPos(this.buzzPan, p.buzz.x, p.buzz.y, p.buzz.z);
  }
  buzz(v) {
    if (this.ready) this.buzzG.gain.setTargetAtTime(v * 0.05, this.ctx.currentTime, 0.01);
  }

  beat(t, level) {
    const g = level * 0.9;
    this.tone(this.body, t, { freq: 62, to: 38, a: 0.006, d: 0.13, peak: 0.55 * g });
    this.burst(this.body, t, { buf: this.brown, type: 'lowpass', freq: 120, d: 0.08, peak: 0.4 * g });
    this.tone(this.body, t + 0.26, { freq: 56, to: 36, a: 0.006, d: 0.12, peak: 0.38 * g });
  }

  // ------------------------------------------------------------ player sounds
  footstep(surface, vol) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (surface === 'tile') {
      this.burst(this.world, t, { freq: 2400, Q: 1.4, d: 0.05, peak: 0.22 * vol });
      this.burst(this.world, t + 0.012, { freq: 900, Q: 0.9, d: 0.07, peak: 0.12 * vol });
    } else {
      this.burst(this.world, t, { buf: this.pink, freq: 1100, Q: 0.8, d: 0.08, peak: 0.26 * vol });
      this.burst(this.world, t, { freq: 4200, Q: 2, d: 0.03, peak: 0.05 * vol });
    }
    this.tone(this.world, t, { freq: 90, to: 50, d: 0.06, peak: 0.12 * vol });
  }
  rustle(vol = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) this.burst(this.body, t + i * 0.07 + Math.random() * 0.04, { buf: this.pink, freq: 2600 + Math.random() * 1500, Q: 0.6, a: 0.02, d: 0.12, peak: 0.09 * vol });
    this.burst(this.body, t, { buf: this.brown, type: 'lowpass', freq: 300, a: 0.05, d: 0.4, peak: 0.12 * vol });
  }
  click() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.burst(this.body, t, { freq: 3500, Q: 3, d: 0.012, peak: 0.25 });
    this.tone(this.body, t, { freq: 2200, d: 0.015, peak: 0.05 });
  }
  pickup() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.burst(this.body, t, { buf: this.pink, freq: 2200, Q: 0.7, a: 0.01, d: 0.15, peak: 0.12 });
    this.burst(this.body, t + 0.12, { freq: 3800, Q: 3, d: 0.015, peak: 0.12 });
  }
  gasp() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.burst(this.body, t, { buf: this.pink, freq: 900, Q: 1.2, a: 0.03, d: 0.45, peak: 0.55, sweep: 1900 });
    this.burst(this.body, t + 0.5, { buf: this.pink, freq: 1200, Q: 1, a: 0.08, d: 0.6, peak: 0.3, sweep: 700 });
  }
  exhale(shaky = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const s = this.noise(this.pink);
    const f = this.filt('bandpass', 950, 1);
    const g = this.gain();
    const trem = this.osc('sine', 9), tg = this.gain(0.06 * shaky);
    trem.connect(tg).connect(g.gain);
    s.connect(f).connect(g).connect(this.body);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    f.frequency.exponentialRampToValueAtTime(600, t + 1.5);
    s.start(t, Math.random());
    trem.start(t);
    s.stop(t + 1.6);
    trem.stop(t + 1.6);
  }

  // ------------------------------------------------------------ monster sounds
  monsterStep(pos, run, surface) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const v = run > 0.5 ? 1 : 0.6;
    this.tone(this.mBus, t, { freq: 70, to: 34, a: 0.004, d: 0.16, peak: 0.6 * v });
    this.burst(this.mBus, t, { buf: this.brown, type: 'lowpass', freq: 260, d: 0.12, peak: 0.5 * v });
    // claws ticking on the floor
    const clk = surface === 'tile' ? 3200 : 2200;
    for (let i = 0; i < 3; i++) this.burst(this.mBus, t + 0.03 + i * 0.028 + Math.random() * 0.01, { freq: clk + Math.random() * 800, Q: 6, d: 0.008, peak: 0.25 * v });
  }
  monsterBreath(pos, intensity) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const v = 0.35 + intensity * 0.4;
    this.burst(this.mBus, t, { buf: this.pink, freq: 520, Q: 3.5, a: 0.25, d: 0.5, peak: 0.5 * v, sweep: 700 });
    this.burst(this.mBus, t + 0.75, { buf: this.pink, freq: 380, Q: 3, a: 0.1, d: 0.9, peak: 0.6 * v, sweep: 260 });
    // wet click in the throat
    this.burst(this.mBus, t + 0.7, { freq: 1800, Q: 8, d: 0.01, peak: 0.25 * v });
    const o = this.osc('sawtooth', 48 + Math.random() * 8);
    const jit = this.osc('sine', 23), jg = this.gain(6);
    jit.connect(jg).connect(o.frequency);
    const f = this.filt('bandpass', 420, 4), g = this.gain();
    o.connect(f).connect(g).connect(this.mBus);
    this.env(g, t + 0.75, 0.1, 0.18 * v, 0.9);
    o.start(t + 0.7); jit.start(t + 0.7);
    o.stop(t + 1.8); jit.stop(t + 1.8);
  }
  monsterSniff(pos) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      this.burst(this.mBus, t + i * 0.13, { buf: this.pink, type: 'bandpass', freq: 2300 + Math.random() * 600, Q: 1.6, a: 0.015, d: last ? 0.25 : 0.07, peak: last ? 0.5 : 0.38 });
    }
  }
  monsterGrowl(pos, intensity = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.osc('sawtooth', 52 + Math.random() * 12);
    const jit = this.osc('sine', 17 + Math.random() * 10), jg = this.gain(9);
    jit.connect(jg).connect(o.frequency);
    const ws = this.shaper(12);
    const f1 = this.filt('bandpass', 340, 5), f2 = this.filt('bandpass', 820, 6);
    const g = this.gain();
    o.connect(ws);
    ws.connect(f1).connect(g);
    ws.connect(f2).connect(g);
    g.connect(this.mBus);
    const dur = 0.8 + intensity * 0.8;
    this.env(g, t, 0.15, 0.35 * intensity, dur);
    o.frequency.linearRampToValueAtTime(40, t + dur);
    o.start(t); jit.start(t);
    o.stop(t + dur + 0.3); jit.stop(t + dur + 0.3);
  }
  monsterScream(pos, close = false) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const dest = close ? this.body : this.mBus;
    const v = close ? 0.9 : 1;
    const o = this.osc('sawtooth', 280), o2 = this.osc('square', 287);
    o.frequency.linearRampToValueAtTime(820, t + 0.25);
    o.frequency.exponentialRampToValueAtTime(190, t + 1.5);
    o2.frequency.linearRampToValueAtTime(760, t + 0.3);
    o2.frequency.exponentialRampToValueAtTime(150, t + 1.5);
    const ws = this.shaper(30);
    const f = this.filt('bandpass', 1400, 1.5);
    f.frequency.linearRampToValueAtTime(2600, t + 0.3);
    f.frequency.exponentialRampToValueAtTime(700, t + 1.5);
    const g = this.gain();
    o.connect(ws); o2.connect(ws);
    ws.connect(f).connect(g).connect(dest);
    this.env(g, t, 0.04, 0.5 * v, 1.5);
    o.start(t); o2.start(t);
    o.stop(t + 1.7); o2.stop(t + 1.7);
    this.burst(dest, t, { buf: this.pink, freq: 2500, Q: 0.8, a: 0.03, d: 1.2, peak: 0.45 * v, sweep: 900 });
  }
  stinger() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [110, 116.5, 164.8, 174.6, 233.1, 311.1].forEach((f, i) => {
      const o = this.osc('sawtooth', f * (1 + (Math.random() - 0.5) * 0.01));
      const fl = this.filt('bandpass', 900 + i * 200, 2);
      const g = this.gain();
      o.connect(fl).connect(g).connect(this.music);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.start(t);
      o.stop(t + 2.5);
    });
    this.tone(this.music, t, { freq: 55, to: 28, a: 0.01, d: 1.6, peak: 0.6 });
    this.burst(this.music, t, { buf: this.brown, type: 'lowpass', freq: 200, d: 1.2, peak: 0.5 });
  }
  jumpscare() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.monsterScream(null, true);
    this.burst(this.body, t, { buf: this.white, type: 'highpass', freq: 600, a: 0.005, d: 0.9, peak: 0.7 });
    this.tone(this.body, t, { freq: 48, to: 24, a: 0.005, d: 1.4, peak: 1 });
  }

  // ------------------------------------------------------------ environment
  distantBang(x = null, z = null) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const dest = x === null ? this.verbSend : this.at(x, 2, z, 3, 0.8);
    [1, 2.76, 5.4, 8.93].forEach((m, i) => this.tone(dest, t, { freq: 180 * m, a: 0.002, d: 1.4 / (i + 1), peak: 0.18 / (i + 1) }));
    this.burst(dest, t, { buf: this.brown, type: 'lowpass', freq: 400, d: 0.3, peak: 0.5 });
  }
  creak(x, z) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const dest = this.at(x, 3, z, 3, 0.9);
    const o = this.osc('sawtooth', 36);
    const fm = this.osc('sine', 7), fmg = this.gain(9);
    fm.connect(fmg).connect(o.frequency);
    const f = this.filt('bandpass', 700, 9);
    f.frequency.linearRampToValueAtTime(1100, t + 1.4);
    const g = this.gain();
    o.connect(f).connect(g).connect(dest);
    this.env(g, t, 0.3, 0.28, 1.4);
    o.start(t); fm.start(t);
    o.stop(t + 1.9); fm.stop(t + 1.9);
  }
  door(x, z, hard) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const dest = this.at(x, 1.2, z, 2, 1);
    this.burst(dest, t, { buf: this.brown, type: 'lowpass', freq: 500, d: 0.18, peak: hard ? 0.8 : 0.35 });
    this.tone(dest, t, { type: 'triangle', freq: 640, to: 430, a: 0.05, d: 0.35, peak: 0.05 });
    this.burst(dest, t + 0.32, { buf: this.brown, type: 'lowpass', freq: 420, d: 0.12, peak: hard ? 0.4 : 0.15 });
  }
  thunder(dist = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + dist * 1.2;
    const v = clamp(1.2 - dist * 0.4, 0.3, 1);
    this.burst(this.world, t, { buf: this.white, type: 'lowpass', freq: 2400, a: 0.01, d: 0.35, peak: 0.25 * v, sweep: 300 });
    const s = this.noise(this.brown);
    const f = this.filt('lowpass', 260, 0.9);
    f.frequency.exponentialRampToValueAtTime(70, t + 5);
    const g = this.gain();
    s.connect(f).connect(g).connect(this.world);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9 * v, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.25 * v, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    s.start(t, Math.random());
    s.stop(t + 5.6);
  }
  chime() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.tone(this.verbSend, t, { type: 'triangle', freq: 659.25, a: 0.01, d: 1.6, peak: 0.12 });
    this.tone(this.verbSend, t + 0.6, { type: 'triangle', freq: 523.25, a: 0.01, d: 2.2, peak: 0.12 });
  }
  dawn() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [261.63, 329.63, 392, 523.25].forEach((f, i) => {
      const o = this.osc('triangle', f);
      const g = this.gain();
      o.connect(g).connect(this.music);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.04, t + 2 + i * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
      o.start(t);
      o.stop(t + 9.2);
    });
  }
}
