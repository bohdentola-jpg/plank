// Sound. Effects are recorded samples (see sounds.js for where each came
// from) played through Web Audio; music is sequenced by music.js.

import { SOUNDS, SFX_BASE } from './sounds.js';

export class AudioSys {
  constructor() {
    this.ctx = null; this.ready = false;
    this.buf = new Map();          // file -> AudioBuffer
    this.volSfx = 0.8; this.volMusic = 0.6; this.muted = false;
    this.lastPlay = new Map();
    this.music = null;             // set by main once music.js is loaded
    this.loaded = 0; this.total = 0;
    this._pending = [];
  }

  // Must be called from a click/keypress: browsers won't start audio otherwise.
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      // a gentle limiter so ten things hitting at once doesn't crackle
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 12; this.comp.ratio.value = 6; this.comp.attack.value = 0.003; this.comp.release.value = 0.18;
      this.comp.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.comp);
      this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.comp);
      this.applyVolumes();
      for (const [file, data] of this._pending) this.decode(file, data);
      this._pending = [];
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.ready = true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfxGain.gain.value = this.volSfx;
    this.musicGain.gain.value = this.volMusic * 0.8;
  }
  setMuted(m) { this.muted = m; this.applyVolumes(); }

  // Fetch every sample. Decoding waits for unlock() if the context isn't up yet.
  async load(onProgress) {
    const files = new Set();
    for (const k in SOUNDS) for (const f of SOUNDS[k].files) files.add(f);
    this.total = files.size; this.loaded = 0;
    const jobs = [...files].map(async (file) => {
      try {
        const r = await fetch(SFX_BASE + file);
        if (!r.ok) throw new Error(r.status);
        const data = await r.arrayBuffer();
        if (this.ctx) await this.decode(file, data); else this._pending.push([file, data]);
      } catch (e) { console.warn('sound missing:', file, e.message); }
      this.loaded++;
      if (onProgress) onProgress(this.loaded / this.total);
    });
    await Promise.all(jobs);
  }
  decode(file, data) {
    return new Promise((res) => {
      try { this.ctx.decodeAudioData(data, (b) => { this.buf.set(file, b); res(); }, () => res()); } catch (e) { res(); }
    });
  }

  // o: { vol, rate, pan (-1..1), delay (seconds) }
  sfx(name, o) {
    if (!this.ready || !this.ctx || this.muted) return;
    const def = SOUNDS[name];
    if (!def) return;
    const now = this.ctx.currentTime;
    const gap = def.gap === undefined ? 0.03 : def.gap;
    const last = this.lastPlay.get(name) || -1;
    if (now - last < gap) return;
    this.lastPlay.set(name, now);
    const file = def.files[(Math.random() * def.files.length) | 0];
    const b = this.buf.get(file);
    if (!b) return;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    const spread = def.spread === undefined ? 0.06 : def.spread;
    src.playbackRate.value = (def.rate || 1) * ((o && o.rate) || 1) * (1 + (Math.random() * 2 - 1) * spread);
    const g = this.ctx.createGain();
    g.gain.value = (def.vol === undefined ? 1 : def.vol) * (o && o.vol !== undefined ? o.vol : 1);
    src.connect(g);
    if (o && o.pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); p.connect(this.sfxGain);
    } else g.connect(this.sfxGain);
    src.start(now + ((o && o.delay) || 0), def.start || 0);
    return src;
  }

  playMusic(id) { if (this.music) this.music.play(id); }
  stopMusic(fade) { if (this.music) this.music.stop(fade); }
  duck() { if (this.music) this.music.duck(); }
}
