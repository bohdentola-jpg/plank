// DOM side of the game: HUD, dialogue, learning cards, toasts, panels, fades.
import { ICONS, icon, hydrateIcons } from './icons.js';
import { t, rich, UI as S, getLang } from './i18n.js';
import { lookup } from './content/glossary.js';

const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('#hud'), goal: $('#goal'), goalText: $('#goal-text'), petals: $('#petals'), petalCount: $('#petal-count'),
      bagCount: $('#bag-count'), bookNew: $('#book-new'), placeName: $('#place-name'), placeDay: $('#place-day'),
      dialog: $('#dialog'), card: $('#card'), modal: $('#modal'), toasts: $('#toasts'), fade: $('#fade'),
      tray: $('#tray'), back: $('#back-btn'), esPop: $('#es-pop'), title: $('#title'), loading: $('#loading'),
    };
    hydrateIcons();
    this.modalStack = [];
    this.dialogBusy = false;
    this.wireHud();
    this.wireSpanishWords();
    document.addEventListener('keydown', (e) => this.onKey(e));
  }

  // ---------------------------------------------------------------- HUD
  wireHud() {
    const g = this.game;
    $('#btn-bag').onclick = () => { g.sfx('tap'); this.openBag(); };
    $('#btn-book').onclick = () => { g.sfx('tap'); g.openBook(); };
    $('#btn-map').onclick = () => { g.sfx('tap'); g.openMap(); };
    $('#btn-hint').onclick = () => { g.sfx('sparkle'); g.hint(); };
    $('#btn-sound').onclick = () => { g.toggleSound(); };
    $('#btn-menu').onclick = () => { g.sfx('tap'); g.openMenu(); };
    this.relabel();
  }

  relabel() {
    const set = (id, k) => { const b = $(id); b.title = t(S[k]); b.setAttribute('aria-label', t(S[k])); };
    set('#btn-bag', 'bag'); set('#btn-book', 'book'); set('#btn-map', 'map');
    set('#btn-hint', 'hint'); set('#btn-sound', 'sound'); set('#btn-menu', 'menu');
    this.el.petals.title = t(S.marigolds);
  }

  showHud(on) { this.el.hud.classList.toggle('hidden', !on); }

  setPlace(name, day) {
    this.el.placeName.textContent = t(name) || '';
    this.el.placeDay.textContent = t(day) || '';
  }

  setPetals(n, bump = false) {
    this.el.petalCount.textContent = n;
    if (bump) {
      this.el.petals.classList.remove('bump');
      void this.el.petals.offsetWidth;
      this.el.petals.classList.add('bump');
    }
  }

  setBagCount(n) { this.el.bagCount.textContent = n; this.el.bagCount.classList.toggle('hidden', !n); }

  setBookNew(on) { this.el.bookNew.classList.toggle('hidden', !on); }

  setSoundIcon(on) {
    const b = $('#btn-sound .ico');
    b.innerHTML = on ? ICONS.sound : ICONS.mute;
  }

  setGoal(text) {
    if (!text) { this.el.goal.classList.add('hidden'); this._goal = null; return; }
    const s = t(text);
    if (s === this._goal) return;
    this._goal = s;
    this.el.goalText.innerHTML = rich(text);
    this.el.goal.classList.remove('hidden', 'flash');
    void this.el.goal.offsetWidth;
    this.el.goal.classList.add('flash');
  }

  pulse(id, on) { $(id)?.classList.toggle('pulse', on); }

  back(label, fn) {
    const b = this.el.back;
    if (!fn) { b.classList.add('hidden'); b.onclick = null; return; }
    b.querySelector('.lbl').textContent = t(label || S.back);
    b.onclick = () => { this.game.sfx('tap'); fn(); };
    b.classList.remove('hidden');
  }

  // ---------------------------------------------------------------- dialogue
  // lines: [{ who, text, emote, anim, look, choices: [{ label, value }] , then }]
  // resolves with the value of the last choice made (if any)
  async say(lines) {
    if (!Array.isArray(lines)) lines = [lines];
    const g = this.game;
    this.dialogBusy = true;
    g.engine.lock();
    const d = this.el.dialog;
    let result;
    for (const line of lines) {
      if (!line) continue;
      if (typeof line === 'function') { await line(); continue; }
      if (line.if && !line.if()) continue;
      const who = line.who || null;
      const ch = who ? g.chars?.[who] : null;
      const name = who ? (g.names[who] ? t(g.names[who]) : who) : '';
      d.classList.toggle('nopic', !who);
      d.querySelector('.who').textContent = name;
      d.querySelector('.who').classList.toggle('hidden', !name);
      if (who) {
        const img = d.querySelector('.portrait img');
        const src = await g.portrait(who);
        if (img.getAttribute('src') !== src) img.src = src;
      }
      d.classList.remove('hidden');
      if (ch) {
        if (line.emote) ch.emote(line.emote);
        if (line.anim) ch.play(line.anim, { restart: true, dur: line.dur });
        if (line.look !== undefined) ch.look(line.look);
        ch.say(true);
      }
      line.do?.();
      const textEl = d.querySelector('.text');
      const html = rich(line.text, line.vars);
      g.speech.line(t(line.text, line.vars), getLang());
      const choicesEl = d.querySelector('.choices');
      choicesEl.innerHTML = '';
      d.classList.toggle('choosing', !!line.choices);
      await this.typewrite(textEl, html, ch);
      if (ch) ch.say(false);
      if (line.choices) {
        result = await this.choose(choicesEl, line.choices);
        if (typeof line.then === 'function') {
          const more = line.then(result);
          if (more) await this.say(more);
        }
      } else {
        await this.waitAdvance(d);
      }
      if (ch && line.emote && line.keepEmote !== true) ch.emote('smile');
    }
    d.classList.add('hidden');
    g.speech.stop();
    g.engine.unlock();
    this.dialogBusy = false;
    return result;
  }

  // type the text; a click finishes it instantly
  typewrite(el, html, ch) {
    return new Promise((resolve) => {
      el.innerHTML = html;
      if (this.game.state.settings.calm) { resolve(); return; }
      // reveal by characters using a clip on text nodes
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push({ n: walker.currentNode, full: walker.currentNode.nodeValue });
      for (const o of nodes) o.n.nodeValue = '';
      let i = 0, k = 0, done = false;
      const total = nodes.reduce((a, o) => a + o.full.length, 0);
      const finish = () => {
        if (done) return;
        done = true;
        for (const o of nodes) o.n.nodeValue = o.full;
        this.el.dialog.removeEventListener('pointerdown', skip);
        clearInterval(timer);
        resolve();
      };
      const skip = (e) => { if (!e.target.closest('.es')) { e.stopPropagation(); finish(); } };
      this._skipTyping = finish;
      this.el.dialog.addEventListener('pointerdown', skip, { once: true });
      // time-based, so slow computers don't slow the text down
      const cps = total > 160 ? 110 : 80;
      const t0 = performance.now();
      const timer = setInterval(() => {
        const want = Math.floor(((performance.now() - t0) / 1000) * cps);
        let shown = 0;
        for (const o of nodes) {
          const n = Math.max(0, Math.min(o.full.length, want - shown));
          if (o.n.nodeValue.length !== n) o.n.nodeValue = o.full.slice(0, n);
          shown += o.full.length;
        }
        i = want >= total ? nodes.length : 0;
        k = want;
        if (want >= total) finish();
      }, 30);
      void ch;
    });
  }

  waitAdvance(d) {
    return new Promise((resolve) => {
      const next = d.querySelector('.next');
      const go = (e) => {
        if (e?.target?.closest?.('.es')) return;
        cleanup();
        this.game.sfx('tick');
        resolve();
      };
      const cleanup = () => {
        d.removeEventListener('click', go);
        this._advance = null;
      };
      setTimeout(() => d.addEventListener('click', go), 120);
      this._advance = go;
      next.focus({ preventScroll: true });
    });
  }

  choose(el, choices) {
    return new Promise((resolve) => {
      el.innerHTML = '';
      choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice';
        b.innerHTML = rich(c.label);
        b.onclick = (e) => {
          e.stopPropagation();
          this.game.sfx('tap');
          el.innerHTML = '';
          this.el.dialog.classList.remove('choosing');
          resolve(c.value ?? i);
        };
        el.appendChild(b);
        if (i === 0) setTimeout(() => b.focus({ preventScroll: true }), 50);
      });
    });
  }

  onKey(e) {
    if (e.key === 'Escape') {
      if (!this.el.esPop.classList.contains('hidden')) { this.hidePop(); return; }
      if (this.modalStack.length) { this.modalStack[this.modalStack.length - 1].close(); return; }
      if (!this.el.card.classList.contains('hidden')) { this._cardClose?.(); return; }
    }
    if ((e.key === ' ' || e.key === 'Enter') && !this.el.dialog.classList.contains('hidden') && !this.el.dialog.classList.contains('choosing')) {
      if (document.activeElement?.tagName === 'INPUT') return;
      e.preventDefault();
      if (this._skipTyping) { const f = this._skipTyping; this._skipTyping = null; f(); return; }
      this._advance?.();
    }
  }

  // ---------------------------------------------------------------- Spanish words
  wireSpanishWords() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.es');
      if (b) {
        e.stopPropagation();
        e.preventDefault();
        this.showPop(b);
        return;
      }
      if (!e.target.closest('#es-pop')) this.hidePop();
    }, true);
  }

  showPop(btn) {
    const key = btn.dataset.w;
    const entry = lookup(key);
    const pop = this.el.esPop;
    const word = entry ? entry.w : key;
    pop.innerHTML = `<div class="w">${word}</div>${entry?.say ? `<div class="p">${t(S.sayIt)}: ${entry.say}</div>` : ''}${entry ? `<div class="m">${rich(entry.m)}</div>` : ''}<button type="button">${icon('speak')} ${t(S.hear)}</button>`;
    pop.querySelector('button').onclick = (e) => { e.stopPropagation(); this.game.speech.word(word, 'es'); };
    pop.classList.remove('hidden');
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = r.left + r.width / 2 - pw / 2, y = r.top - ph - 10;
    if (y < 8) y = r.bottom + 10;
    x = Math.max(8, Math.min(window.innerWidth - pw - 8, x));
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    this.game.speech.word(word, 'es');
    this.game.sfx('tick');
  }

  hidePop() { this.el.esPop.classList.add('hidden'); }

  // ---------------------------------------------------------------- cards
  // a Lotería-style card for a card definition (from content/cards.js)
  async cardEl(card, { small = false, locked = false, dot = false } = {}) {
    const el = document.createElement('div');
    el.className = `lcard${small ? ' small' : ''}${locked ? ' locked' : ''}`;
    const img = locked ? '' : `<img alt="" src="${await this.game.cardImage(card)}">`;
    el.innerHTML = `<div class="num">${card.num}</div><div class="pic" style="background:${card.bg || '#ffe9b8'}">${img}</div><div class="name">${locked ? '???' : (card.title || card.term)}</div>${dot ? '<i class="dot"></i>' : ''}`;
    return el;
  }

  // show a learning card; resolves when closed
  async showCard(card, { isNew = true, reward = 1 } = {}) {
    const g = this.game;
    g.engine.lock();
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    const lc = await this.cardEl(card);
    wrap.appendChild(lc);
    const info = document.createElement('div');
    info.className = 'cinfo';
    const say = card.say ? `<div class="say">${t(S.sayIt)}: ${card.say} <button type="button" class="hear">${icon('speak')} ${t(S.hear)}</button></div>` : '';
    info.innerHTML = `
      <span class="tag">${isNew ? t(S.newCard) : t(card.catName)}</span>
      <h2>${card.term}</h2>
      ${getLang() === 'en' && card.en ? `<div class="en">${t(card.en)}</div>` : ''}
      ${say}
      ${card.text.map((p) => `<p>${rich(p)}</p>`).join('')}
      ${card.dyk ? `<div class="dyk"><b>${t(S.didYouKnow)}</b>${rich(card.dyk)}</div>` : ''}
      <div class="reward">${isNew && reward ? `<span class="plus">+${reward} ${icon('marigold')}</span>` : '<span></span>'}<button type="button" class="btn rosa ok">${icon('check')} ${t(S.gotIt)}</button></div>`;
    wrap.appendChild(info);
    const host = this.el.card;
    host.innerHTML = '';
    host.appendChild(wrap);
    host.classList.remove('hidden');
    const hear = info.querySelector('.hear');
    if (hear) hear.onclick = () => g.speech.word(card.term, 'es');
    if (g.speech.enabled) g.speech.line(card.text.map((p) => t(p)).join(' '), getLang());
    g.sfx(isNew ? 'card' : 'tap');
    await new Promise((resolve) => {
      const close = () => {
        host.classList.add('hidden');
        host.innerHTML = '';
        this._cardClose = null;
        g.speech.stop();
        resolve();
      };
      this._cardClose = close;
      info.querySelector('.ok').onclick = () => { g.sfx('tap'); close(); };
      host.onclick = (e) => { if (e.target === host) close(); };
      setTimeout(() => info.querySelector('.ok').focus({ preventScroll: true }), 60);
    });
    g.engine.unlock();
  }

  // ---------------------------------------------------------------- toasts
  toast(html, { img = null, ico = 'marigold', ms = 2600 } = {}) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${img ? `<img alt="" src="${img}">` : icon(ico)}<span>${html}</span>`;
    this.el.toasts.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, ms);
  }

  // an item image flies from a screen point into the backpack button
  fly(img, from) {
    const b = $('#btn-bag').getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'flyer';
    f.innerHTML = `<img alt="" src="${img}">`;
    const x0 = from?.x ?? window.innerWidth / 2, y0 = from?.y ?? window.innerHeight / 2;
    f.style.left = `${x0 - 35}px`;
    f.style.top = `${y0 - 35}px`;
    document.body.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      f.style.transform = `translate(${b.left + b.width / 2 - x0}px, ${b.top + b.height / 2 - y0}px) scale(.35)`;
      f.style.opacity = '0.4';
    }));
    setTimeout(() => {
      f.remove();
      this.pulse('#btn-bag', true);
      setTimeout(() => this.pulse('#btn-bag', false), 1300);
    }, 720);
  }

  // ---------------------------------------------------------------- panels
  // opens a panel; body may be an element or HTML. Returns { el, body, close, done }
  modal({ title, ico = null, body = '', foot = null, cls = '', onClose = null, closable = true }) {
    const g = this.game;
    const host = this.el.modal;
    const panel = document.createElement('div');
    panel.className = `panel ${cls}`;
    panel.innerHTML = `<div class="phead">${ico ? icon(ico, 'big') : ''}<h2></h2>${closable ? `<button type="button" class="x" aria-label="${t(S.close)}">${icon('close')}</button>` : ''}</div><div class="pbody"></div>`;
    panel.querySelector('h2').textContent = t(title);
    const pb = panel.querySelector('.pbody');
    if (typeof body === 'string') pb.innerHTML = body; else if (body) pb.appendChild(body);
    if (foot) {
      const pf = document.createElement('div');
      pf.className = 'pfoot';
      if (typeof foot === 'string') pf.innerHTML = foot; else pf.appendChild(foot);
      panel.appendChild(pf);
    }
    // stacked panels: only the top one shows
    const prev = this.modalStack[this.modalStack.length - 1];
    if (prev) prev.el.classList.add('hidden');
    host.appendChild(panel);
    host.classList.remove('hidden');
    if (!this.modalStack.length) g.engine.lock();
    let resolveDone;
    const done = new Promise((r) => { resolveDone = r; });
    const m = {
      el: panel, body: pb, done,
      close: (val) => {
        if (m.closed) return;
        m.closed = true;
        panel.remove();
        this.modalStack = this.modalStack.filter((x) => x !== m);
        const top = this.modalStack[this.modalStack.length - 1];
        if (top) top.el.classList.remove('hidden');
        if (!this.modalStack.length) {
          host.classList.add('hidden');
          g.engine.unlock();
        }
        onClose?.(val);
        resolveDone(val);
      },
    };
    if (closable) {
      panel.querySelector('.x').onclick = () => { g.sfx('tap'); m.close(); };
      host.onclick = (e) => { if (e.target === host && this.modalStack.length) this.modalStack[this.modalStack.length - 1].close(); };
    } else {
      host.onclick = null;
    }
    this.modalStack.push(m);
    hydrateIcons(panel);
    return m;
  }

  closeAllModals() { for (const m of [...this.modalStack]) m.close(); }

  async openBag() {
    const g = this.game;
    const body = document.createElement('div');
    const items = g.state.bag;
    if (!items.length) {
      body.innerHTML = `<div class="empty">${t(S.emptyBag)}</div>`;
    } else {
      const grid = document.createElement('div');
      grid.className = 'bag-grid';
      for (const id of items) {
        const it = g.itemInfo(id);
        const d = document.createElement('div');
        d.className = 'bag-item';
        d.innerHTML = `<img alt="" src="${await g.itemImage(id)}"><b>${t(it.name)}</b><span>${t(it.desc || '')}</span>`;
        grid.appendChild(d);
      }
      body.appendChild(grid);
    }
    this.modal({ title: S.bag, ico: 'bag', body });
  }

  // ---------------------------------------------------------------- fades
  async fadeOut(dayCard = null) {
    const f = this.el.fade;
    f.innerHTML = dayCard ? `<div class="daycard"><div><b>${t(dayCard.title)}</b><span>${t(dayCard.sub || '')}</span></div></div>` : '';
    f.classList.add('on');
    await sleep(dayCard ? 1700 : 480);
  }

  async fadeIn() {
    this.el.fade.classList.remove('on');
    await sleep(420);
  }

  loading(on, msg) {
    this.el.loading.classList.toggle('hidden', !on);
    if (msg) this.el.loading.querySelector('.msg').textContent = t(msg);
  }

  // ---------------------------------------------------------------- tray
  // items: [{ id, label, img, count, used }]; onPick(id). extra: HTML/element for the side
  showTray({ label, items, onPick, side = null, active = null }) {
    const tr = this.el.tray;
    tr.innerHTML = `<div class="lbl"></div><div class="items"></div>`;
    tr.querySelector('.lbl').textContent = t(label);
    const list = tr.querySelector('.items');
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `titem${it.used ? ' used' : ''}${it.id === active ? ' on' : ''}`;
      b.dataset.id = it.id;
      b.innerHTML = `<img alt="" src="${it.img}">${t(it.label)}${it.count > 1 ? `<span class="cnt">×${it.count}</span>` : ''}`;
      b.title = t(it.label);
      b.onclick = () => onPick(it.id, b);
      list.appendChild(b);
    }
    if (side) {
      const s = document.createElement('div');
      s.className = 'side';
      if (typeof side === 'string') s.innerHTML = side; else s.appendChild(side);
      tr.appendChild(s);
      hydrateIcons(s);
    }
    tr.classList.remove('hidden');
    return tr;
  }

  setTrayActive(id) {
    this.el.tray.querySelectorAll('.titem').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
  }

  hideTray() { this.el.tray.classList.add('hidden'); this.el.tray.innerHTML = ''; this.sidePanel(null); }

  // a small floating panel (the ofrenda's wishes & elements)
  sidePanel(html) {
    const el = document.getElementById('sidepanel');
    if (!el) return;
    if (!html) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.innerHTML = html;
    el.classList.remove('hidden');
    hydrateIcons(el);
  }
}
