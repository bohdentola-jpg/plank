// Spoken words: the stadium PA announcer and the referee, through the
// browser's speech synthesis (speechSynthesis). Optional — it follows
// settings.announcer unless `voice.enabled` is set — and silent wherever
// speech synthesis is missing or fails. (Browsers don't route speech through
// WebAudio, so it can't take the stadium echo; the PA voice is slowed and
// pitched down instead, and `chime: true` rings the PA chime first.)
//
//   voice.say('Touchdown, Port Halcyon!', { kind: 'pa', chime: true })
//   voice.say('Holding, offense, number seventy-two', { kind: 'ref' })
//   voice.enabled = true | false      overrides settings.announcer
//   voice.available                    speech synthesis exists here
//   voice.cancel()

import { audio } from './audio.js';
import { settings } from '../core/settings.js';

const MALE = /male|david|daniel|guy|mark|george|fred|alex|ryan|christopher|eric|james|thomas|brian|aaron|arthur|oliver|rishi|lee|matthew|roger|steffan|andrew/i;
const FEMALE = /female|zira|samantha|victoria|karen|moira|tessa|fiona|susan|hazel|aria|jenny|libby|sonia|natasha|catherine|serena|ava|allison|nicky/i;

class Voice {
  constructor() {
    this._enabled = null;
    this._voices = [];
    this._pending = 0;
    if (this.available) {
      try {
        const load = () => { this._voices = window.speechSynthesis.getVoices() || []; this._pick = {}; };
        load();
        window.speechSynthesis.addEventListener?.('voiceschanged', load);
      } catch { /* ignore */ }
    }
  }

  get available() {
    return typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
  }

  get enabled() {
    if (this._enabled != null) return this._enabled;
    try { return !!settings.get('announcer'); } catch { return false; }
  }

  set enabled(v) { this._enabled = v == null ? null : !!v; }

  /** Speak `text`. kind 'pa' (deep, slow, interrupts) | 'ref' (brisk). Returns true if queued. */
  say(text, { kind = 'pa', interrupt, rate, pitch, volume, chime = false } = {}) {
    if (!text || !this.enabled || !this.available) return false;
    try {
      const ss = window.speechSynthesis;
      const pa = kind !== 'ref';
      if (interrupt ?? pa) { ss.cancel(); this._pending = 0; } else if (this._pending > 2) { ss.cancel(); this._pending = 0; }
      const u = new window.SpeechSynthesisUtterance(String(text));
      const v = this._voiceFor(pa ? 'pa' : 'ref');
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      u.rate = rate ?? (pa ? 0.82 : 1.04);
      u.pitch = pitch ?? (pa ? 0.62 : 0.9);
      const vol = (audio.volumes.master ?? 0.85) * (audio.volumes.sfx ?? 0.9);
      u.volume = Math.max(0, Math.min(1, volume ?? vol * (pa ? 1 : 0.9)));
      this._pending++;
      u.onend = u.onerror = () => { this._pending = Math.max(0, this._pending - 1); };
      const go = () => { try { ss.speak(u); } catch { this._pending = Math.max(0, this._pending - 1); } };
      if (chime && pa) {
        import('./sfx.js').then((m) => m.sfx.pa('chime')).catch(() => {});
        setTimeout(go, 900);
      } else go();
      return true;
    } catch {
      return false;
    }
  }

  cancel() {
    if (!this.available) return;
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    this._pending = 0;
  }

  // the deepest-sounding English voice for the PA; a different English one for the referee
  _voiceFor(kind) {
    this._pick ||= {};
    if (kind in this._pick) return this._pick[kind];
    const en = this._voices.filter((v) => /^en(-|_|$)/i.test(v.lang || ''));
    const score = (v) => (MALE.test(v.name) ? 3 : 0) - (FEMALE.test(v.name) ? 3 : 0) + (/en-(US|GB)/i.test(v.lang) ? 1 : 0) + (v.localService ? 0.5 : 0);
    const ranked = en.slice().sort((a, b) => score(b) - score(a));
    let v = ranked[0] || null;
    if (kind === 'ref' && ranked.length > 1) v = ranked.find((x) => x !== this._voiceFor('pa') && !FEMALE.test(x.name)) || ranked[1];
    this._pick[kind] = v;
    return v;
  }
}

export const voice = new Voice();
