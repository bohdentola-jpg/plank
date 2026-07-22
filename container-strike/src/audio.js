// Fully procedural positional audio (WebAudio, no assets). Every gameplay
// sound also registers a "sound event" that bot AI can hear, which is what
// makes noise discipline (walking, holding fire) tactically meaningful.
import * as THREE from './three.js';
import { G } from './state.js';
import { rand } from './util.js';

const WEAPON_VOICE = {
  // [bodyHz, crackAmt, thumpAmt, gain, decay]
  pistol:  [1400, 0.5, 0.5, 0.8, 0.11],
  smg:     [1700, 0.5, 0.45, 0.75, 0.09],
  rifle:   [1100, 1.0, 0.7, 1.0, 0.13],
  sniper:  [700, 1.2, 1.1, 1.3, 0.22],
  shotgun: [500, 0.4, 1.3, 1.2, 0.18],
  mg:      [1000, 0.8, 0.8, 1.0, 0.12],
  knife:   [2600, 0, 0.1, 0.25, 0.04],
};

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.earRing = null;
    this.fireLoops = new Map();
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = G.settings.volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 8;
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { if (this.master) this.master.gain.value = v; }

  syncListener() {
    if (!this.ctx || !G.camera) return;
    const l = this.ctx.listener;
    const p = G.camera.position;
    const t = this.ctx.currentTime;
    const fwd = G.camera.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.02);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.setTargetAtTime(0, t, 0.02); l.upY.setTargetAtTime(1, t, 0.02); l.upZ.setTargetAtTime(0, t, 0.02);
    } else if (l.setPosition) {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  // Build an output node: positional panner or direct (for first-person sounds).
  _out(pos, refDist = 4, maxDist = 90) {
    if (!pos) return this.master;
    const pan = this.ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = refDist;
    pan.maxDistance = maxDist;
    pan.rolloffFactor = 1.1;
    pan.positionX ? (pan.positionX.value = pos.x, pan.positionY.value = pos.y, pan.positionZ.value = pos.z)
                  : pan.setPosition(pos.x, pos.y, pos.z);
    pan.connect(this.master);
    return pan;
  }

  _noise(out, { gain = 0.5, dur = 0.1, freq = 1200, q = 1, type = 'bandpass', when = 0, attack = 0.001 }) {
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = rand(0.92, 1.08);
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, rand(0, 0.8));
    src.stop(t + dur + 0.05);
  }

  _tone(out, { gain = 0.4, dur = 0.2, from = 200, to = 50, type = 'sine', when = 0 }) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _click(out, { gain = 0.3, freq = 2500, dur = 0.03, when = 0 }) {
    this._noise(out, { gain, dur, freq, q: 3, when });
  }

  registerEvent(pos, loudness, source) {
    G.soundEvents.push({ pos: { x: pos.x, y: pos.y, z: pos.z }, loudness, source, time: G.time });
  }

  shot(weapon, pos, firstPerson) {
    if (!this.ctx) return;
    const cls = weapon.class || 'rifle';
    let [freq, crack, thump, gain, decay] = WEAPON_VOICE[cls] || WEAPON_VOICE.rifle;
    let loud = 55;
    if (weapon.suppressed) { gain *= 0.36; crack *= 0.25; freq *= 0.7; loud = 18; }
    const out = firstPerson ? this.master : this._out(pos, 7, 160);
    const g = firstPerson ? gain * 0.55 : gain;
    this._noise(out, { gain: g * 0.9, dur: decay, freq, q: 0.8 });
    if (crack > 0) this._noise(out, { gain: g * 0.5 * crack, dur: decay * 0.5, freq: 4200, q: 1.5 });
    this._tone(out, { gain: g * 0.7 * thump, dur: decay * 2.2, from: 130, to: 40, type: 'triangle' });
    if (!weapon.suppressed && (cls === 'rifle' || cls === 'sniper'))
      this._noise(out, { gain: g * 0.2, dur: 0.4, freq: 900, q: 0.5, when: 0.02 });
    if (pos) this.registerEvent(pos, loud, 'shot');
  }

  dryFire() { if (this.ctx) this._click(this.master, { gain: 0.25, freq: 3000 }); }

  footstep(pos, walking, firstPerson) {
    if (!this.ctx || walking) return; // walking is silent — that's the point of shift
    const out = firstPerson ? this.master : this._out(pos, 2.5, 26);
    this._noise(out, { gain: firstPerson ? 0.12 : 0.3, dur: 0.07, freq: rand(300, 480), q: 1.2 });
    this._click(out, { gain: firstPerson ? 0.05 : 0.12, freq: rand(900, 1300), dur: 0.02 });
    if (pos && !walking) this.registerEvent(pos, 14, 'footstep');
  }

  land(pos, firstPerson) {
    if (!this.ctx) return;
    const out = firstPerson ? this.master : this._out(pos, 3, 30);
    this._noise(out, { gain: 0.35, dur: 0.12, freq: 260, q: 1 });
    this._tone(out, { gain: 0.2, dur: 0.12, from: 120, to: 60 });
    if (pos) this.registerEvent(pos, 18, 'land');
  }

  reload(weapon, pos, firstPerson) {
    if (!this.ctx) return;
    const out = firstPerson ? this.master : this._out(pos, 3, 22);
    const T = weapon.reloadTime || 2.5;
    this._click(out, { gain: 0.3, freq: 1800, dur: 0.04, when: 0.15 });          // mag release
    this._noise(out, { gain: 0.18, dur: 0.1, freq: 700, q: 2, when: 0.35 });     // mag out
    this._noise(out, { gain: 0.22, dur: 0.09, freq: 900, q: 2, when: T * 0.55 });// mag in
    this._click(out, { gain: 0.35, freq: 2400, dur: 0.05, when: T * 0.8 });      // slide/bolt
    if (pos) this.registerEvent(pos, 12, 'reload');
  }

  boltCycle(pos, firstPerson) {
    if (!this.ctx) return;
    const out = firstPerson ? this.master : this._out(pos, 3, 20);
    this._click(out, { gain: 0.3, freq: 2100, dur: 0.04, when: 0.25 });
    this._click(out, { gain: 0.3, freq: 1700, dur: 0.05, when: 0.42 });
  }

  drawWeapon() {
    if (!this.ctx) return;
    this._click(this.master, { gain: 0.18, freq: 1500, dur: 0.04 });
    this._click(this.master, { gain: 0.14, freq: 2200, dur: 0.03, when: 0.09 });
  }

  pickup(pos, firstPerson) {
    if (!this.ctx) return;
    const out = firstPerson ? this.master : this._out(pos, 3, 20);
    this._noise(out, { gain: 0.25, dur: 0.08, freq: 1200, q: 1.5 });
    this._click(out, { gain: 0.2, freq: 2000, dur: 0.03, when: 0.06 });
    if (pos) this.registerEvent(pos, 12, 'pickup');
  }

  bounce(pos) {
    if (!this.ctx) return;
    const out = this._out(pos, 3, 45);
    this._tone(out, { gain: 0.22, dur: 0.09, from: rand(700, 900), to: 300, type: 'triangle' });
    this._click(out, { gain: 0.15, freq: 2600, dur: 0.02 });
    this.registerEvent(pos, 20, 'grenade');
  }

  pinPull() { if (this.ctx) this._click(this.master, { gain: 0.2, freq: 3200, dur: 0.03 }); }

  explosion(pos) {
    if (!this.ctx) return;
    const out = this._out(pos, 12, 220);
    this._noise(out, { gain: 1.2, dur: 0.5, freq: 300, q: 0.4, type: 'lowpass' });
    this._noise(out, { gain: 0.5, dur: 0.25, freq: 2500, q: 0.6 });
    this._tone(out, { gain: 1.0, dur: 0.7, from: 90, to: 28 });
    this.registerEvent(pos, 90, 'explosion');
  }

  flashBang(pos, intensity) {
    if (!this.ctx) return;
    const out = this._out(pos, 10, 200);
    this._noise(out, { gain: 0.9, dur: 0.15, freq: 3500, q: 0.7 });
    this._tone(out, { gain: 0.7, dur: 0.3, from: 1600, to: 900, type: 'square' });
    this.registerEvent(pos, 80, 'explosion');
    if (intensity > 0.25) this.startEarRing(intensity);
  }

  startEarRing(intensity) {
    this.stopEarRing();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = 3800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5 + intensity * 2);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 3 + intensity * 2);
    this.earRing = o;
    // duck the world briefly
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(G.settings.volume * 0.25, t);
    this.master.gain.linearRampToValueAtTime(G.settings.volume, t + 1.6 + intensity);
  }

  stopEarRing() { try { this.earRing && this.earRing.stop(); } catch (e) { /* already stopped */ } this.earRing = null; }

  smokePop(pos) {
    if (!this.ctx) return;
    const out = this._out(pos, 5, 70);
    this._noise(out, { gain: 0.5, dur: 0.6, freq: 500, q: 0.6, type: 'lowpass', attack: 0.05 });
    this.registerEvent(pos, 30, 'smoke');
  }

  fireIgnite(pos) {
    if (!this.ctx) return;
    const out = this._out(pos, 6, 80);
    this._noise(out, { gain: 0.7, dur: 0.4, freq: 800, q: 0.5, attack: 0.01 });
    this._tone(out, { gain: 0.3, dur: 0.4, from: 200, to: 60 });
    this.registerEvent(pos, 45, 'fire');
  }

  startFireLoop(id, pos) {
    if (!this.ctx || this.fireLoops.has(id)) return;
    const out = this._out(pos, 4, 55);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.6;
    const g = this.ctx.createGain(); g.gain.value = 0.22;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 7; lfo.type = 'triangle';
    const lg = this.ctx.createGain(); lg.gain.value = 0.09;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(out);
    src.start(); lfo.start();
    this.fireLoops.set(id, { src, lfo, g });
  }

  stopFireLoop(id) {
    const l = this.fireLoops.get(id);
    if (!l) return;
    try { l.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15); l.src.stop(this.ctx.currentTime + 0.5); l.lfo.stop(this.ctx.currentTime + 0.5); } catch (e) { /* noop */ }
    this.fireLoops.delete(id);
  }

  decoyShot(pos, weapon) { this.shot(weapon || { class: 'rifle' }, pos, false); }

  hitConfirm() { if (this.ctx) this._click(this.master, { gain: 0.1, freq: 1400, dur: 0.03 }); }

  takeDamage() {
    if (!this.ctx) return;
    this._noise(this.master, { gain: 0.3, dur: 0.15, freq: 500, q: 1 });
    this._tone(this.master, { gain: 0.2, dur: 0.2, from: 300, to: 90 });
  }

  bulletWhiz(pos) {
    if (!this.ctx) return;
    const out = this._out(pos, 1.5, 14);
    this._noise(out, { gain: 0.25, dur: 0.09, freq: 3000, q: 4 });
  }

  bulletImpact(pos, material) {
    if (!this.ctx) return;
    const out = this._out(pos, 3, 50);
    if (material === 'metal') {
      this._tone(out, { gain: 0.3, dur: 0.12, from: rand(1400, 2200), to: 500, type: 'triangle' });
      this._click(out, { gain: 0.2, freq: 3400, dur: 0.02 });
    } else if (material === 'wood') {
      this._noise(out, { gain: 0.3, dur: 0.07, freq: 700, q: 1.5 });
    } else {
      this._noise(out, { gain: 0.28, dur: 0.08, freq: 1000, q: 1 });
    }
  }

  ui(kind) {
    if (!this.ctx) return;
    if (kind === 'buy') { this._click(this.master, { gain: 0.25, freq: 1900, dur: 0.04 }); this._click(this.master, { gain: 0.15, freq: 2600, dur: 0.03, when: 0.05 }); }
    else if (kind === 'deny') this._tone(this.master, { gain: 0.2, dur: 0.15, from: 220, to: 160, type: 'square' });
    else this._click(this.master, { gain: 0.15, freq: 2200, dur: 0.03 });
  }

  announce(kind) {
    if (!this.ctx) return;
    if (kind === 'start') {
      this._tone(this.master, { gain: 0.2, dur: 0.15, from: 660, to: 660, type: 'sine' });
      this._tone(this.master, { gain: 0.2, dur: 0.25, from: 880, to: 880, type: 'sine', when: 0.18 });
    } else if (kind === 'win') {
      [523, 659, 784].forEach((f, i) => this._tone(this.master, { gain: 0.18, dur: 0.3, from: f, to: f, when: i * 0.16 }));
    } else if (kind === 'lose') {
      [392, 330, 262].forEach((f, i) => this._tone(this.master, { gain: 0.18, dur: 0.35, from: f, to: f, when: i * 0.18 }));
    }
  }
}
