// Ink-splat dialogue box with talking portraits, typewriter text with voice
// blips, numbered choices, a text field (for passwords), and a phone-call
// layout for the Operator. Scripts are plain async functions:
//   await dlg.say('shelly', 'Mm... morning...');
//   const pick = await dlg.ask('shelly', 'What do you need?', ['Swipe in', 'Nothing']);
import { drawPortrait } from '../art/critters.js';
import { shape, rrectPts, ellipsePts, mulberry32, INK, rgba } from '../ink.js';
import * as audio from '../audio.js';

export const SPEAKERS = {
  shelly: { name: 'SHELLY', cast: 'tortoise', color: '#b8e07a', pitch: 0.55, wave: 'triangle', cps: 26 },
  operator: { name: 'UNKNOWN CALLER', phone: true, color: '#ff9a3c', pitch: 0.42, wave: 'sawtooth' },
  pigeon: { name: 'COCO COO', cast: 'pigeon', color: '#ff7ac0', pitch: 1.45, wave: 'triangle' },
  cheese: { name: 'BIG CHEESE', cast: 'cheese', color: '#ffd23f', pitch: 0.8, wave: 'square' },
  roach: { name: 'ROACHIE', cast: 'roach', color: '#ffa25c', pitch: 1.8, wave: 'square', cps: 60 },
  raccoon: { name: 'RASCAL', cast: 'raccoon', color: '#8aea6a', pitch: 1.05, wave: 'triangle' },
  bat: { name: 'DJ ECHO', cast: 'bat', color: '#5af0dc', pitch: 1.3, wave: 'sine' },
  cat: { name: 'MR. WHISKERS', cast: 'cat', color: '#f6b060', pitch: 0.7, wave: 'sine', cps: 24 },
  weasel: { name: '3-CUP CHARLIE', cast: 'weasel', color: '#e0b07a', pitch: 1.2, wave: 'square', cps: 52 },
  moth: { name: 'MADAME MOTHRA', cast: 'moth', color: '#c8a8ff', pitch: 1.0, wave: 'sine' },
  gator: { name: 'BIG AL', cast: 'gator', color: '#8aea6a', pitch: 0.42, wave: 'sawtooth' },
  ghost: { name: 'THE CONDUCTOR', cast: 'ghost', color: '#b8fff0', pitch: 0.85, wave: 'sine' },
  stranger: { name: 'STRANGER', cast: 'commuter', color: '#c8c0f0', pitch: 1.0, wave: 'triangle' },
  grabber: { name: 'THE GRABBER', cast: null, color: '#ff4f9a', pitch: 1.6, wave: 'square' },
  narrator: { name: '', cast: null, color: '#f6ecd2', pitch: 1, wave: null },
  me: { name: 'YOU', cast: 'rat', color: '#6dff9a', pitch: 1.1, wave: 'triangle' },
};

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

const escHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class Dialogue {
  constructor(root) {
    this.root = root;
    this.bg = root.querySelector('.dlg-bg');
    this.portrait = root.querySelector('.dlg-portrait');
    this.call = root.querySelector('.dlg-call');
    this.caller = root.querySelector('.dlg-caller');
    this.phone = root.querySelector('.dlg-phone');
    this.nameEl = root.querySelector('.dlg-name');
    this.textEl = root.querySelector('.dlg-text');
    this.choicesEl = root.querySelector('.dlg-choices');
    this.inputEl = root.querySelector('.dlg-input');
    this.nextEl = root.querySelector('.dlg-next');
    this.isOpen = false;
    this.who = null;
    this.segs = [];
    this.total = 0;
    this.shown = 0;
    this.resolve = null;
    this.mode = 'say';
    this.sel = 0;
    this.choices = [];
    this.playerLook = null;
    this.playerName = 'YOU';
    this.onOpenChange = () => {};
    this.lastBgSize = '';
    this.t = 0;
    this.blipAcc = 0;
    root.addEventListener('click', (e) => {
      if (e.target.closest('.dlg-choice') || e.target === this.inputEl) return;
      this.advance();
    });
    window.addEventListener('keydown', (e) => this.key(e), true);
    if ('ResizeObserver' in window) new ResizeObserver(() => this.drawBg()).observe(root);
  }

  get open() { return this.isOpen; }

  setPlayer(name, look) {
    this.playerName = name || 'YOU';
    this.playerLook = look;
  }

  show(who) {
    const sp = SPEAKERS[who] || SPEAKERS.narrator;
    if (!this.isOpen) {
      this.root.hidden = false;
      this.root.classList.remove('enter');
      void this.root.offsetWidth;
      this.root.classList.add('enter');
      this.isOpen = true;
      this.onOpenChange(true);
    }
    this.who = who;
    this.sp = sp;
    this.nameEl.textContent = who === 'me' ? this.playerName : sp.name;
    this.nameEl.style.color = sp.color;
    const phone = !!sp.phone;
    this.call.hidden = !phone;
    this.phone.hidden = !phone;
    this.portrait.hidden = phone || !sp.cast;
    this.root.style.paddingLeft = '';
    if (!sp.cast && !phone) this.root.classList.add('noportrait');
    else this.root.classList.remove('noportrait');
    this.drawBg();
  }

  drawBg() {
    if (!this.isOpen) return;
    const r = this.bg.getBoundingClientRect();
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    const key = `${w}x${h}`;
    if (key === this.lastBgSize) return;
    this.lastBgSize = key;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.bg.width = w * dpr;
    this.bg.height = h * dpr;
    const g = this.bg.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const ink = '#0b0818';
    const rnd = mulberry32(w * 7 + h);
    shape(g, rrectPts(12, 14, w - 24, h - 24, 30), { fill: ink, lw: 0, amp: 3.2, seed: 9, seg: 16 });
    // splats
    g.fillStyle = ink;
    for (let i = 0; i < 9; i++) {
      const side = i % 3;
      const x = side === 0 ? 8 + rnd() * 60 : side === 1 ? w - 70 + rnd() * 60 : 40 + rnd() * (w - 80);
      const y = side === 2 ? h - 14 + rnd() * 10 : 6 + rnd() * (h - 20);
      const rr = 3 + rnd() * 9;
      g.beginPath();
      g.arc(x, y, rr, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 5; i++) {
      const x = 60 + rnd() * (w - 120);
      const len = 8 + rnd() * 18;
      g.fillRect(x - 2.5, h - 18, 5, len);
      g.beginPath();
      g.arc(x, h - 18 + len, 4, 0, Math.PI * 2);
      g.fill();
    }
    // a thin cream rim on the inner edge
    g.strokeStyle = rgba('#f6ecd2', 0.12);
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect ? g.roundRect(22, 24, w - 44, h - 44, 22) : g.rect(22, 24, w - 44, h - 44);
    g.stroke();
  }

  // ---------------------------------------------------------- scripting

  say(who, text) {
    return this.run(who, text, 'say');
  }

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
    // ESC skips the rest of a conversation: everything resolves at once until end()
    if (this.skipAll) return Promise.resolve(mode === 'ask' ? this.cancelValue : null);
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r(null);
    }
    this.show(who);
    this.mode = mode;
    this.segs = parse(text);
    this.total = this.segs.reduce((a, s) => a + s.t.length, 0);
    this.shown = 0;
    this.blipAcc = 0;
    this.choicesEl.innerHTML = '';
    this.inputEl.hidden = true;
    this.root.classList.add('typing');
    this.root.classList.remove('choosing');
    this.renderText();
    return new Promise((res) => { this.resolve = res; });
  }

  renderText() {
    let left = Math.floor(this.shown);
    let html = '';
    for (const s of this.segs) {
      if (left <= 0) break;
      const part = s.t.slice(0, left);
      left -= part.length;
      html += s.cls ? `<span class="${s.cls}">${escHtml(part)}</span>` : escHtml(part);
    }
    this.textEl.innerHTML = html;
  }

  finishTyping() {
    this.shown = this.total;
    this.renderText();
    this.root.classList.remove('typing');
    if (this.mode === 'ask') this.showChoices();
    if (this.mode === 'input') this.showInput();
  }

  showChoices() {
    this.root.classList.add('choosing');
    this.choicesEl.innerHTML = '';
    this.sel = 0;
    this.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dlg-choice';
      b.disabled = !!c.disabled;
      b.innerHTML = `<span class="num">${i + 1}</span><span></span>`;
      b.lastChild.textContent = c.label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pick(i);
      });
      b.addEventListener('pointerenter', () => this.select(i));
      this.choicesEl.append(b);
    });
    this.select(0);
    const first = this.choicesEl.querySelector('.dlg-choice:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }

  showInput() {
    this.root.classList.add('choosing');
    this.inputEl.hidden = false;
    this.inputEl.focus({ preventScroll: true });
    const done = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.inputEl.removeEventListener('keydown', done);
        const v = this.inputEl.value;
        this.inputEl.hidden = true;
        this.complete(v);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.inputEl.removeEventListener('keydown', done);
        this.inputEl.hidden = true;
        this.complete(null);
      }
    };
    this.inputEl.addEventListener('keydown', done);
  }

  select(i) {
    this.sel = i;
    [...this.choicesEl.children].forEach((b, k) => b.classList.toggle('sel', k === i));
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
    this.choicesEl.innerHTML = '';
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
    if (!this.isOpen) return;
    if (e.target === this.inputEl) return;
    const k = e.code;
    if (k === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.skipAll = true;
      this.complete(this.mode === 'ask' ? this.cancelValue : null);
      return;
    }
    if (k === 'KeyE' || k === 'Enter' || k === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      if (this.mode === 'ask' && this.shown >= this.total) this.pick(this.sel);
      else this.advance();
      return;
    }
    if (this.mode === 'ask' && /^Digit[1-9]$/.test(k)) {
      e.preventDefault();
      e.stopPropagation();
      if (this.shown < this.total) this.finishTyping();
      this.pick(parseInt(k.slice(5), 10) - 1);
      return;
    }
    if (this.mode === 'ask' && this.shown >= this.total) {
      if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'KeyS' || k === 'KeyD') {
        e.preventDefault();
        e.stopPropagation();
        this.select((this.sel + 1) % this.choices.length);
        this.choicesEl.children[this.sel]?.focus({ preventScroll: true });
      } else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'KeyW' || k === 'KeyA') {
        e.preventDefault();
        e.stopPropagation();
        this.select((this.sel - 1 + this.choices.length) % this.choices.length);
        this.choicesEl.children[this.sel]?.focus({ preventScroll: true });
      }
    } else if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyW', 'ArrowUp'].includes(k)) {
      e.stopPropagation();
    }
  }

  end() {
    if (this.resolve) this.complete(null);
    this.skipAll = false;
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.hidden = true;
    this.lastBgSize = '';
    this.onOpenChange(false);
  }

  // called every frame by the main loop
  update(dt, t) {
    if (!this.isOpen) return;
    this.t = t;
    const sp = this.sp || SPEAKERS.narrator;
    if (this.shown < this.total) {
      const cps = sp.cps || 40;
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.total, this.shown + dt * cps);
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
    const talking = this.shown < this.total;
    if (sp.phone) drawCaller(this.caller, t, talking);
    else if (sp.cast && !this.portrait.hidden) {
      const blink = (t % 3.4) < 0.12 ? 1 : 0;
      drawPortrait(this.portrait, sp.cast, { t, talk: talking, blink, look: this.who === 'me' ? this.playerLook : undefined, boil: 11 + (Math.floor(t * 7) % 3) * 101 });
    }
  }
}

// The Operator: an orange-lined silhouette on a scratchy brown panel.
function drawCaller(c, t, talking) {
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#2e1409';
  g.fillRect(0, 0, W, H);
  const r = mulberry32(5);
  g.strokeStyle = 'rgba(255,140,60,0.16)';
  g.lineWidth = 6;
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    const x = r() * W, y = r() * H;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (r() - 0.5) * 160, y + (r() - 0.5) * 160, x + (r() - 0.5) * 220, y + (r() - 0.5) * 220);
    g.stroke();
  }
  const bob = Math.sin(t * 1.6) * 3;
  const jaw = talking ? Math.max(0, Math.sin(t * 16)) * 10 : 0;
  g.save();
  g.translate(W * 0.36, H * 0.52 + bob);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const sil = (fn) => {
    g.beginPath();
    fn();
    g.fillStyle = '#000';
    g.fill();
    g.strokeStyle = '#ff9a3c';
    g.lineWidth = 5;
    g.stroke();
  };
  // shoulders + coat collar
  sil(() => {
    g.moveTo(-140, 260);
    g.quadraticCurveTo(-120, 90, -10, 70);
    g.quadraticCurveTo(110, 80, 150, 260);
    g.closePath();
  });
  // head with long snout (it's a gator... shh)
  sil(() => {
    g.moveTo(-60, 40);
    g.quadraticCurveTo(-80, -50, -10, -66);
    g.quadraticCurveTo(80, -62, 190, -36);
    g.quadraticCurveTo(206, -26, 190, -16);
    g.lineTo(40, -6);
    g.quadraticCurveTo(0, 30, -60, 40);
    g.closePath();
  });
  // lower jaw
  sil(() => {
    g.moveTo(-40, 30);
    g.lineTo(180, -6 + jaw * 0.3);
    g.quadraticCurveTo(170, 14 + jaw, 120, 18 + jaw);
    g.lineTo(-20, 50);
    g.closePath();
  });
  // teeth glints
  g.fillStyle = '#ff9a3c';
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(50 + i * 22, -10);
    g.lineTo(58 + i * 22, 2);
    g.lineTo(66 + i * 22, -10);
    g.fill();
  }
  // fedora
  sil(() => {
    g.moveTo(-110, -60);
    g.quadraticCurveTo(-20, -90, 100, -64);
    g.quadraticCurveTo(-10, -48, -110, -60);
    g.closePath();
  });
  sil(() => {
    g.moveTo(-60, -66);
    g.quadraticCurveTo(-70, -150, 0, -140);
    g.quadraticCurveTo(20, -132, 34, -140);
    g.quadraticCurveTo(80, -150, 64, -70);
    g.closePath();
  });
  // eye
  g.fillStyle = '#ff9a3c';
  g.beginPath();
  g.arc(10, -40, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#000';
  g.beginPath();
  g.arc(13, -40, 3.5, 0, Math.PI * 2);
  g.fill();
  // phone receiver at the ear
  sil(() => {
    g.moveTo(-70, -10);
    g.quadraticCurveTo(-100, 30, -80, 70);
    g.lineTo(-60, 64);
    g.quadraticCurveTo(-76, 30, -54, -4);
    g.closePath();
  });
  g.restore();
}
