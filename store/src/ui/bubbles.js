// Comic speech bubbles that pop out of whoever is talking, with a typewriter
// and voice blips. Choices are big sticker buttons at the bottom of the screen
// (thumb reach on a phone). Scripts are plain async functions:
//   await talk.say('signal', 'Morning!');
//   const pick = await talk.ask('signal', 'Punch in?', ['Yes', 'Later']);
import * as audio from '../audio.js';

export const SPEAKERS = {
  signal: { name: 'SIGNAL', color: '#ff4f4f', pitch: 0.9, wave: 'square', cps: 46 },
  drippy: { name: 'DRIPPY', color: '#ff4f9a', pitch: 1.3, wave: 'triangle', cps: 50 },
  lace: { name: 'LACE', color: '#ff8a3d', pitch: 1.1, wave: 'square', cps: 52 },
  cone: { name: 'CONE', color: '#ff9a3c', pitch: 0.75, wave: 'triangle', cps: 40 },
  mira: { name: 'MIRA', color: '#2fb8a0', pitch: 1.45, wave: 'sine', cps: 42 },
  joy: { name: 'JOY', color: '#7b5cff', pitch: 1.6, wave: 'square', cps: 58 },
  plug: { name: 'PLUG', color: '#e8456b', pitch: 0.55, wave: 'sawtooth', cps: 38 },
  static: { name: 'STATIC', color: '#2a9484', pitch: 0.8, wave: 'sine', cps: 30 },
  eight: { name: 'EIGHT', color: '#140f26', pitch: 1.2, wave: 'square', cps: 54 },
  grabber: { name: 'THE GRABBER', color: '#ff4f9a', pitch: 1.7, wave: 'square', cps: 50 },
  me: { name: 'YOU', color: '#3ec7b0', pitch: 1.05, wave: 'triangle', cps: 46 },
  narrator: { name: '', color: '#140f26', pitch: 1, wave: null, cps: 60 },
};

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function parse(text) {
  // *highlight* and _green_
  const out = [];
  const re = /(\*[^*]+\*|_[^_]+_)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), cls: null });
    out.push({ t: m[0].slice(1, -1), cls: m[0][0] === '*' ? 'hl' : 'hl-g' });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), cls: null });
  return out;
}

export class Bubbles {
  constructor(root, choicesRoot) {
    this.root = root;
    this.choicesRoot = choicesRoot;
    this.tag = root.querySelector('.bub-name');
    this.textEl = root.querySelector('.bub-text');
    this.inputEl = root.querySelector('.bub-input');
    this.tail = root.querySelector('.bub-tail');
    this.isOpen = false;
    this.resolve = null;
    this.mode = 'say';
    this.segs = [];
    this.total = 0;
    this.shown = 0;
    this.blipAcc = 0;
    this.sel = 0;
    this.choices = [];
    this.who = null;
    this.playerName = 'YOU';
    this.anchorOf = () => null;   // set by the scene: who -> {x, y} (screen px, top of head)
    this.onOpenChange = () => {};
    this.skipAll = false;
    root.addEventListener('click', (e) => {
      if (e.target === this.inputEl) return;
      this.advance();
    });
    window.addEventListener('keydown', (e) => this.key(e), true);
  }

  get open() { return this.isOpen; }
  setPlayerName(n) { this.playerName = n || 'YOU'; }

  say(who, text) { return this.run(who, text, 'say'); }

  ask(who, text, choices, opts = {}) {
    this.choices = choices.map((c, i) => (typeof c === 'string' ? { label: c, value: i } : { value: i, ...c }));
    this.cancelValue = opts.cancel ?? null;
    return this.run(who, text, 'ask');
  }

  input(who, text, placeholder = '') {
    this.inputEl.value = '';
    this.inputEl.placeholder = placeholder;
    return this.run(who, text, 'input');
  }

  run(who, text, mode) {
    if (this.skipAll) return Promise.resolve(mode === 'ask' ? this.cancelValue : null);
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r(null);
    }
    const sp = SPEAKERS[who] || SPEAKERS.narrator;
    this.who = who;
    this.sp = sp;
    if (!this.isOpen) {
      this.isOpen = true;
      this.root.hidden = false;
      this.onOpenChange(true);
    }
    this.root.classList.toggle('narrator', !sp.name);
    this.root.classList.remove('pop');
    void this.root.offsetWidth;
    this.root.classList.add('pop');
    this.tag.textContent = who === 'me' ? this.playerName : sp.name;
    this.tag.style.background = sp.color;
    this.tag.hidden = !sp.name;
    this.mode = mode;
    this.segs = parse(text);
    this.total = this.segs.reduce((a, s) => a + s.t.length, 0);
    this.shown = 0;
    this.blipAcc = 0;
    this.choicesRoot.innerHTML = '';
    this.choicesRoot.hidden = true;
    this.inputEl.hidden = true;
    this.root.classList.add('typing');
    this.renderText();
    this.place();
    return new Promise((res) => { this.resolve = res; });
  }

  renderText() {
    let left = Math.floor(this.shown);
    let html = '';
    for (const s of this.segs) {
      if (left <= 0) break;
      const part = s.t.slice(0, left);
      left -= part.length;
      html += s.cls ? `<span class="${s.cls}">${esc(part)}</span>` : esc(part);
    }
    // reserve the full size up front so the bubble doesn't grow while typing
    let rest = '';
    let skip = Math.floor(this.shown);
    for (const s of this.segs) {
      const part = s.t.slice(Math.max(0, skip));
      skip = Math.max(0, skip - s.t.length);
      rest += esc(part);
    }
    this.textEl.innerHTML = `${html}<span class="bub-ghost">${rest}</span>`;
  }

  // keep the bubble on screen, pointing at its speaker
  place() {
    if (!this.isOpen) return;
    const W = window.innerWidth, H = window.innerHeight;
    const a = this.sp && this.sp.name ? this.anchorOf(this.who) : null;
    const r = this.root;
    const bw = r.offsetWidth, bh = r.offsetHeight;
    const top0 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) || 90;
    let x, y, tail = null;
    this.tailHidden = false;
    if (a) {
      x = Math.max(12, Math.min(W - bw - 12, a.x - bw / 2));
      y = a.y - bh - 26;
      let below = false;
      if (y < top0) {
        y = Math.min(H - bh - 140, a.y + 40);
        below = true;
      }
      y = Math.max(top0, y);
      tail = { x: Math.max(22, Math.min(bw - 22, a.x - x)), below };
    } else {
      // narration sits a third of the way down, clear of the reward toasts under the HUD
      x = Math.max(12, (W - bw) / 2);
      y = Math.max(top0 + 8, Math.min(H * 0.34, H - bh - 160));
    }
    // never sit under the answer buttons
    if (!this.choicesRoot.hidden && this.choicesRoot.childElementCount) {
      const ct = this.choicesRoot.getBoundingClientRect().top;
      if (y + bh > ct - 12) {
        y = Math.max(Math.min(top0, ct - 12 - bh), ct - 12 - bh);
        if (tail) tail.below = false;
        this.tailHidden = !!a && y + bh > a.y;
      }
    }
    r.style.left = `${Math.round(x)}px`;
    r.style.top = `${Math.round(y)}px`;
    if (tail && !this.tailHidden) {
      this.tail.hidden = false;
      this.tail.style.left = `${Math.round(tail.x)}px`;
      this.tail.classList.toggle('up', tail.below);
    } else this.tail.hidden = true;
  }

  finishTyping() {
    this.shown = this.total;
    this.renderText();
    this.root.classList.remove('typing');
    if (this.mode === 'ask') this.showChoices();
    if (this.mode === 'input') this.showInput();
  }

  showChoices() {
    const box = this.choicesRoot;
    box.innerHTML = '';
    box.hidden = false;
    this.sel = 0;
    this.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.disabled = !!c.disabled;
      b.innerHTML = '<span class="num"></span><span class="lbl"></span>';
      b.querySelector('.num').textContent = String(i + 1);
      b.querySelector('.lbl').textContent = c.label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pick(i);
      });
      b.addEventListener('pointerenter', () => this.select(i));
      box.append(b);
    });
    this.select(0);
    const first = box.querySelector('.choice:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }

  showInput() {
    this.inputEl.hidden = false;
    this.place();
    this.inputEl.focus({ preventScroll: true });
    const done = (e) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      this.inputEl.removeEventListener('keydown', done);
      const v = e.key === 'Enter' ? this.inputEl.value : null;
      this.inputEl.hidden = true;
      this.complete(v);
    };
    this.inputEl.addEventListener('keydown', done);
  }

  select(i) {
    this.sel = i;
    [...this.choicesRoot.children].forEach((b, k) => b.classList.toggle('sel', k === i));
  }

  pick(i) {
    const c = this.choices[i];
    if (!c || c.disabled) return;
    audio.click();
    this.complete(c.value);
  }

  complete(v) {
    const r = this.resolve;
    this.resolve = null;
    this.choicesRoot.innerHTML = '';
    this.choicesRoot.hidden = true;
    if (r) r(v);
  }

  advance() {
    if (!this.isOpen || !this.resolve) return;
    if (this.shown < this.total) {
      this.finishTyping();
      return;
    }
    if (this.mode === 'say') {
      audio.click();
      this.complete(true);
    }
  }

  key(e) {
    if (!this.isOpen || e.target === this.inputEl) return;
    const k = e.code;
    if (k === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.skipAll = true;
      this.complete(this.mode === 'ask' ? this.cancelValue : null);
      return;
    }
    if (this.mode === 'ask' && /^Digit[1-9]$/.test(k)) {
      e.preventDefault();
      e.stopPropagation();
      if (this.shown < this.total) this.finishTyping();
      this.pick(parseInt(k.slice(5), 10) - 1);
      return;
    }
    if (k === 'KeyE' || k === 'Enter' || k === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      if (this.mode === 'ask' && this.shown >= this.total) this.pick(this.sel);
      else this.advance();
      return;
    }
    if (this.mode === 'ask' && this.shown >= this.total) {
      const n = this.choices.length;
      if (['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        this.select((this.sel + 1) % n);
        this.choicesRoot.children[this.sel]?.focus({ preventScroll: true });
      } else if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        this.select((this.sel - 1 + n) % n);
        this.choicesRoot.children[this.sel]?.focus({ preventScroll: true });
      }
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(k)) {
      e.stopPropagation();
    }
  }

  end() {
    if (this.resolve) this.complete(null);
    this.skipAll = false;
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.hidden = true;
    this.choicesRoot.hidden = true;
    this.onOpenChange(false);
  }

  // every frame
  update(dt) {
    if (!this.isOpen) return;
    const sp = this.sp || SPEAKERS.narrator;
    if (this.shown < this.total) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.total, this.shown + dt * (sp.cps || 44));
      const after = Math.floor(this.shown);
      if (after !== before) {
        this.renderText();
        this.blipAcc += after - before;
        if (sp.wave && this.blipAcc >= 2) {
          this.blipAcc = 0;
          audio.blip(sp.pitch, sp.wave);
        }
      }
      if (this.shown >= this.total) this.finishTyping();
    }
    this.place();
  }

  get talking() { return this.isOpen && this.shown < this.total ? this.who : null; }
}
