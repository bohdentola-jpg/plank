// Read-aloud with the browser's built-in voices. In English mode the Spanish
// words marked [[like this]] are spoken by a Spanish (Mexico) voice when the
// computer has one, so kids hear them pronounced properly.
export class Speech {
  constructor() {
    this.ok = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.voices = [];
    this.enabled = false;
    if (this.ok) {
      const load = () => { this.voices = window.speechSynthesis.getVoices(); };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  voice(lang) {
    if (!this.voices.length && this.ok) this.voices = window.speechSynthesis.getVoices();
    const v = this.voices;
    if (lang === 'es') {
      return v.find((x) => /es[-_]MX/i.test(x.lang)) || v.find((x) => /es[-_](US|419)/i.test(x.lang))
        || v.find((x) => /^es/i.test(x.lang)) || null;
    }
    return v.find((x) => /en[-_]US/i.test(x.lang) && /natural|google|samantha|aria|jenny/i.test(x.name))
      || v.find((x) => /en[-_]US/i.test(x.lang)) || v.find((x) => /^en/i.test(x.lang)) || null;
  }

  hasSpanish() { return !!this.voice('es'); }

  stop() {
    if (this.ok) window.speechSynthesis.cancel();
  }

  // speak a single phrase in one language
  word(text, lang = 'es', rate = 0.85) {
    if (!this.ok) return;
    this.stop();
    const u = new SpeechSynthesisUtterance(text);
    const v = this.voice(lang);
    if (v) u.voice = v;
    u.lang = v?.lang || (lang === 'es' ? 'es-MX' : 'en-US');
    u.rate = rate;
    window.speechSynthesis.speak(u);
  }

  // speak dialogue text with markup; uiLang is the game's language
  line(raw, uiLang) {
    if (!this.ok || !this.enabled) return;
    this.stop();
    const parts = [];
    const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let last = 0, m;
    while ((m = re.exec(raw))) {
      if (m.index > last) parts.push([raw.slice(last, m.index), uiLang]);
      parts.push([m[1], 'es']);
      last = m.index + m[0].length;
    }
    if (last < raw.length) parts.push([raw.slice(last), uiLang]);
    // in Spanish mode everything is one voice; merge for smoother speech
    const merged = uiLang === 'es' ? [[parts.map((p) => p[0]).join(''), 'es']] : parts;
    for (const [text, lang] of merged) {
      const clean = text.replace(/\*\*/g, '').trim();
      if (!clean) continue;
      const u = new SpeechSynthesisUtterance(clean);
      const v = this.voice(lang);
      if (v) u.voice = v;
      u.lang = v?.lang || (lang === 'es' ? 'es-MX' : 'en-US');
      u.rate = lang === 'es' && uiLang === 'en' ? 0.85 : 0.98;
      u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    }
  }
}
