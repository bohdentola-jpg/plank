// Voice lines: decoded once from assets/vo/<id>.ogg (tools/build_voice.py),
// played through an optional earpiece filter (band-passed, a little grit and
// squelch) into an analyser that drives the speaker's lips.
//   const h = voice.play('w.dmitri.enough', { radio: false });
//   await h.done;   h.features → {open, wide, round}
import { audio } from './audio.js';
import { ALL_LINES } from '../data/script/index.js';
import { voiceFeatures } from '../human/anim.js';
import { settings, store } from '../core/settings.js';

const BASE = new URL('../../assets/vo/', import.meta.url);

class Voice {
  constructor() {
    this.manifest = null;
    this.cache = new Map();
    this.active = new Set();
    this.subtitle = null;  // {who, en, ru, t, dur}
    this._loadManifest = fetch(new URL('manifest.json', BASE)).then((r) => r.json()).then((m) => { this.manifest = m; }).catch(() => { this.manifest = {}; });
  }

  line(id) { return ALL_LINES[id]; }

  duration(id) {
    const m = this.manifest?.[id];
    if (m) return m.d;
    const L = ALL_LINES[id] || ALL_LINES[id.replace(/_f$/, '')];
    const txt = L ? (L.ru || L.en || '') : '';
    return Math.max(1.2, txt.length / 14);
  }

  async _buffer(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const p = (async () => {
      await this._loadManifest;
      if (!this.manifest[id] || !audio.ctx) return null;
      try {
        const res = await fetch(new URL(id + '.ogg', BASE));
        if (!res.ok) return null;
        return await audio.ctx.decodeAudioData(await res.arrayBuffer());
      } catch { return null; }
    })();
    this.cache.set(id, p);
    return p;
  }

  /** Warm the cache for a scene. */
  preload(ids) { for (const id of ids) this._buffer(id); }

  _bus() {
    const ctx = audio.ctx;
    if (!this.bus || this.bus.context !== ctx) {
      this.bus = ctx.createGain();
      this.bus.connect(audio.master);
    }
    this.bus.gain.value = settings.get('volVoice') ?? 1;
    return this.bus;
  }

  /**
   * Play a line. opts: { radio: earpiece filter, gain, onStart }
   * Returns { done: Promise, features, stop(), id, line }
   */
  /** Lines addressed to the player have feminine Russian forms (ru_f, rendered as id_f). */
  fem() {
    try { const p = store.load('profile'); return !!p?.dna && p.dna.sex < 0.5; } catch { return false; }
  }

  play(id, opts = {}) {
    const L0 = ALL_LINES[id] || { who: '?', en: id };
    const L = L0.ru_f && this.fem() ? { ...L0, ru: L0.ru_f } : L0;
    if (L !== L0) id = id + '_f';
    const h = { id, line: L, features: { open: 0, wide: 0, round: 0 }, playing: true, t: 0 };
    const dur = this.duration(id);
    h.dur = dur;
    this.subtitle = { who: L.who, en: L.en || '', ru: L.ru || '', t: 0, dur, radio: !!opts.radio };
    let resolveDone;
    h.done = new Promise((r) => { resolveDone = r; });
    const finish = () => {
      if (!h.playing) return;
      h.playing = false;
      this.active.delete(h);
      if (this.subtitle && this.subtitle.who === L.who && this.subtitle.en === (L.en || '')) this.subtitle.fading = true;
      resolveDone();
    };
    h.stop = () => { try { h.src?.stop(); } catch { /* */ } finish(); };
    this.active.add(h);
    (async () => {
      const buf = await this._buffer(id);
      if (!h.playing) return;
      const ctx = audio.ctx;
      if (!buf || !ctx) {
        // no audio: fake mouth movement for the line's length
        h.fake = true;
        setTimeout(finish, dur * 1000);
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      h.src = src;
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      an.smoothingTimeConstant = 0.5;
      h.analyser = an;
      h.fbuf = new Float32Array(an.frequencyBinCount);
      const g = ctx.createGain();
      g.gain.value = opts.gain ?? 1;
      let head = src;
      if (opts.radio) {
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 420; hp.Q.value = 0.7;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.9;
        const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1700; pk.gain.value = 5; pk.Q.value = 1.1;
        const sh = ctx.createWaveShaper();
        const curve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
        sh.curve = curve;
        head.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(sh);
        head = sh;
        g.gain.value *= 0.9;
        // squelch clicks + hiss bed
        this._squelch(ctx, ctx.currentTime);
        this._squelch(ctx, ctx.currentTime + buf.duration + 0.05);
        const hiss = this._noise(ctx);
        const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 2500; hf.Q.value = 0.6;
        const hg = ctx.createGain(); hg.gain.value = 0.012;
        hiss.connect(hf).connect(hg).connect(this._bus());
        hiss.stop(ctx.currentTime + buf.duration + 0.15);
      }
      head.connect(an);
      an.connect(g).connect(this._bus());
      src.onended = finish;
      src.start();
      opts.onStart?.(h);
    })();
    return h;
  }

  _noise(ctx) {
    const src = ctx.createBufferSource();
    src.buffer = audio.noise('white');
    src.loop = true;
    src.start(ctx.currentTime, Math.random() * 1.5);
    return src;
  }

  _squelch(ctx, at) {
    const n = this._noise(ctx);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.08, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, at + 0.07);
    n.connect(f).connect(g).connect(this._bus());
    n.stop(at + 0.1);
  }

  /** Per frame: update lip-sync features + subtitle timer. */
  update(dt) {
    for (const h of this.active) {
      h.t += dt;
      if (h.analyser) voiceFeatures(h.analyser, h.fbuf, h.features);
      else if (h.fake) {
        const s = Math.sin(h.t * 14) * Math.sin(h.t * 3.3);
        h.features.open = Math.max(0, s) * 0.42;
        h.features.wide = 0.4;
        h.features.round = 0.2;
      }
    }
    if (this.subtitle) {
      this.subtitle.t += dt;
      if (this.subtitle.fading) {
        this.subtitle.fadeT = (this.subtitle.fadeT || 0) + dt;
        if (this.subtitle.fadeT > 0.6) this.subtitle = null;
      }
    }
  }

  stopAll() {
    for (const h of [...this.active]) h.stop();
    this.subtitle = null;
  }
}

export const voice = new Voice();
