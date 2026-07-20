// Synthesized arena sound: crowd bed, ball thumps, sneaker squeaks, rim metal,
// glass thud, dunk boom, buzzers, organ riffs, a title-screen beat — and the
// announcer, who is the browser's own speech synth with his coffee replaced
// by an airhorn. Everything is generated; no audio assets.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.crowdGain = null;
    this.muted = false;
    this.voiceOn = true;
    this._excite = 0.25;
    this._lastLine = '';
    this._voice = null;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);
    // crowd bed: looped filtered noise, brighter than an outdoor crowd —
    // gym acoustics, everything slaps back off the ceiling.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.96 + w * 0.04;
      data[i] = last * 5.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 640;
    bp.Q.value = 0.4;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.05;
    src.connect(bp).connect(this.crowdGain).connect(this.master);
    src.start();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
    if (m) { try { window.speechSynthesis?.cancel(); } catch { /* fine */ } }
  }

  crowd(excite) {
    if (!this.ctx) return;
    this._excite = Math.max(this._excite, excite);
    const target = 0.045 + this._excite * 0.26;
    this.crowdGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.crowdGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.15);
    this.crowdGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 4.0);
    this._excite *= 0.55;
  }

  _osc(type, f0, f1, t, gain = 0.2, when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    const t0 = ctx.currentTime + when;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + t);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + t + 0.02);
  }

  _noise(t, gain = 0.3, freq = 1200, when = 0, q = 1, type = 'bandpass') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const len = Math.ceil(ctx.sampleRate * t);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  // ---------------------------------------------------------- court sounds
  bounce(vol = 0.5) {
    this._osc('sine', 95, 55, 0.10, 0.30 * vol);
    this._noise(0.03, 0.12 * vol, 900, 0, 0.8);
  }

  squeak() {
    const f = 2200 + Math.random() * 1400;
    this._noise(0.05 + Math.random() * 0.05, 0.05, f, 0, 8);
  }

  swish() {
    this._noise(0.16, 0.30, 900, 0, 0.7);
    this._noise(0.22, 0.18, 420, 0.04, 0.7);
  }

  rimClank() {
    this._osc('triangle', 540, 480, 0.30, 0.16);
    this._osc('triangle', 1280, 1180, 0.16, 0.07);
    this._noise(0.05, 0.18, 2400, 0, 2);
  }

  boardThud() {
    this._osc('sine', 220, 130, 0.12, 0.22);
    this._noise(0.07, 0.20, 500, 0, 1);
  }

  dunkBoom() {
    this._osc('sine', 130, 32, 0.40, 0.85);
    this._noise(0.18, 0.5, 300, 0, 0.6);
    this._osc('triangle', 700, 500, 0.2, 0.1);
  }

  catchPop() { this._noise(0.04, 0.22, 1500, 0, 1.2); }
  steal() { this._noise(0.06, 0.32, 1900, 0, 1.5); this._osc('square', 300, 180, 0.07, 0.07); }
  shove() { this._noise(0.12, 0.5, 240, 0, 0.7); this._osc('sine', 110, 45, 0.16, 0.4); }
  whooshUp() { this._noise(0.45, 0.25, 500, 0, 2); this._osc('sawtooth', 180, 980, 0.45, 0.05); }

  buzzer() {
    if (!this.ctx) return;
    for (const f of [310, 155]) this._osc('square', f, f * 0.99, 0.95, 0.10);
  }

  horn() {
    for (const f of [233, 311, 466]) this._osc('sawtooth', f, f * 0.985, 1.4, 0.09);
  }

  chime() { this._osc('triangle', 880, 1320, 0.12, 0.12); }
  back() { this._osc('triangle', 660, 440, 0.12, 0.12); }

  /** Ballpark organ "charge" riff — dead balls, big runs. */
  organ() {
    if (!this.ctx) return;
    const notes = [392, 523, 659, 784, 659, 784];
    const dur = [0.16, 0.16, 0.16, 0.28, 0.14, 0.5];
    let at = 0;
    for (let i = 0; i < notes.length; i++) {
      this._osc('square', notes[i], notes[i], dur[i] * 0.92, 0.05, at);
      this._osc('square', notes[i] * 2, notes[i] * 2, dur[i] * 0.92, 0.025, at);
      at += dur[i];
    }
  }

  /** Looping title beat: boom-bap drums + a dark bass riff. Returns {stop}. */
  titleLoop() {
    if (!this.ensure()) return { stop() {} };
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(this.master);
    const BPM = 92;
    const step = 60 / BPM / 4;       // 16th note
    const barLen = step * 16;
    let nextBar = ctx.currentTime + 0.1;
    let stopped = false;

    const kick = (at) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, at);
      o.frequency.exponentialRampToValueAtTime(38, at + 0.12);
      g.gain.setValueAtTime(0.5, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
      o.connect(g).connect(out); o.start(at); o.stop(at + 0.25);
    };
    const snare = (at) => {
      const len = Math.ceil(ctx.sampleRate * 0.16);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.value = 0.32;
      s.connect(f).connect(g).connect(out); s.start(at);
      const o = ctx.createOscillator(); const g2 = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 190;
      g2.gain.setValueAtTime(0.12, at); g2.gain.exponentialRampToValueAtTime(0.001, at + 0.1);
      o.connect(g2).connect(out); o.start(at); o.stop(at + 0.12);
    };
    const hat = (at, open = false) => {
      const len = Math.ceil(ctx.sampleRate * (open ? 0.12 : 0.04));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.value = open ? 0.10 : 0.07;
      s.connect(f).connect(g).connect(out); s.start(at);
    };
    const bass = (at, freq, dur) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'square'; o.frequency.value = freq;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      g.gain.setValueAtTime(0.16, at);
      g.gain.setValueAtTime(0.16, at + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, at + dur);
      o.connect(f).connect(g).connect(out); o.start(at); o.stop(at + dur + 0.02);
    };
    const stab = (at) => {
      for (const f of [146.8, 174.6, 220]) {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = Math.random() * 10 - 5;
        g.gain.setValueAtTime(0.05, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.5);
        o.connect(g).connect(out); o.start(at); o.stop(at + 0.55);
      }
    };
    // D minor riff over two bars
    const D2 = 73.4, F2 = 87.3, G2 = 98, C3 = 130.8;
    const scheduleBar = (t0, barIdx) => {
      kick(t0); kick(t0 + step * 7); kick(t0 + step * 10);
      snare(t0 + step * 4); snare(t0 + step * 12);
      for (let i = 0; i < 16; i += 2) hat(t0 + step * i, i === 14);
      if (barIdx % 2 === 0) {
        bass(t0, D2, step * 3); bass(t0 + step * 4, D2, step * 2);
        bass(t0 + step * 7, F2, step * 2); bass(t0 + step * 10, D2, step * 4);
      } else {
        bass(t0, G2, step * 3); bass(t0 + step * 4, F2, step * 2);
        bass(t0 + step * 7, C3, step * 2); bass(t0 + step * 10, D2, step * 5);
        stab(t0 + step * 8);
      }
    };
    let barIdx = 0;
    const pump = setInterval(() => {
      if (stopped) return;
      while (nextBar < ctx.currentTime + 0.6) {
        scheduleBar(nextBar, barIdx++);
        nextBar += barLen;
      }
    }, 180);
    return {
      stop: () => {
        stopped = true;
        clearInterval(pump);
        try {
          out.gain.cancelScheduledValues(ctx.currentTime);
          out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
          out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
          setTimeout(() => { try { out.disconnect(); } catch { /* done */ } }, 500);
        } catch { /* already done */ }
      },
    };
  }

  // ---------------------------------------------------------- the announcer
  _pickVoice() {
    if (this._voice) return this._voice;
    try {
      const all = window.speechSynthesis?.getVoices?.() || [];
      const want = ['Google US English', 'Microsoft David', 'Daniel', 'Alex', 'Fred'];
      for (const name of want) {
        const v = all.find((x) => x.name?.includes(name));
        if (v) { this._voice = v; return v; }
      }
      this._voice = all.find((v) => v.lang?.startsWith('en')) || all[0] || null;
    } catch { /* no speech */ }
    return this._voice;
  }

  /** Announcer bark. priority 0 chatter · 1 events · 2 must-say (buzzer, fire). */
  say(text, priority = 1) {
    if (this.muted || !this.voiceOn) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      if (synth.speaking || synth.pending) {
        if (priority < 2) return;   // don't talk over himself unless it's big
        synth.cancel();
      }
      if (text === this._lastLine && priority < 2) return;
      this._lastLine = text;
      const u = new SpeechSynthesisUtterance(text);
      const v = this._pickVoice();
      if (v) u.voice = v;
      u.rate = 1.12;
      u.pitch = 0.72;
      u.volume = 1;
      synth.speak(u);
    } catch { /* speech unavailable — the game plays fine mute */ }
  }
}

export const sfx = new Sfx();
