// DOM overlay UI: dialogue, choices, modal layers with spatial focus
// navigation (keyboard / gamepad / mouse all work), toasts, banners, prompts.
import * as THREE from 'three';
import { G } from './game.js';
import { el, rich, clamp } from './util.js';

const _v = new THREE.Vector3();

export class UI {
  constructor(root) {
    this.root = root;
    this.hudRoot = el('div#hud');
    this.pops = el('div#pops');
    this.layerRoot = el('div#layers');
    this.toasts = el('div#toasts');
    this.bannerEl = el('div#banner');
    this.promptEl = el('div#prompt.hidden');
    this.cineEl = el('div#cine', el('div.bar.top'), el('div.bar.bot'));

    // dialogue box
    this.dPortrait = el('img.dlg-portrait');
    this.dName = el('div.dlg-name');
    this.dText = el('div.dlg-text');
    this.dNext = el('div.dlg-next', '▼');
    this.dChoices = el('div.dlg-choices');
    this.dlgEl = el('div#dlg.hidden', this.dPortrait, el('div.dlg-body', this.dName, this.dText, this.dNext), this.dChoices);
    this.dlgEl.addEventListener('pointerdown', () => { this._dlgClick = true; });

    root.append(this.hudRoot, this.pops, this.cineEl, this.bannerEl, this.promptEl, this.dlgEl, this.layerRoot, this.toasts);

    this.layers = [];
    this.dlg = null;         // active line
    this.dialogOpen = false; // box visible (between lines too)
    this._hideT = 0;
    this._popList = [];
    this.speakers = () => null; // set by the cast module: id → {name,color,portrait,pitch}
  }

  /** True while something modal is on screen — gameplay should ignore input. */
  get busy() { return this.dialogOpen || !!this.dlg || this.layers.some((l) => l.blocking); }

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    const inp = G.input;
    // dialogue typewriter
    const d = this.dlg;
    if (d) {
      if (!d.done) {
        d.shown += dt * d.cps;
        const n = Math.floor(d.shown);
        if (n !== d.lastN) {
          d.lastN = n;
          if (n >= d.tokens.length) { d.done = true; this._renderLine(d, d.tokens.length); this.dNext.classList.add('on'); } else {
            this._renderLine(d, n);
            const ch = d.tokens[n - 1];
            if (ch && /[a-z0-9]/i.test(ch.c) && n % 2 === 0) G.audio.blip(d.pitch, d.voice);
          }
        }
      }
      if (!(d.choices && d.choiceShown)) {
        const press = inp.take('a') || this._dlgClick || inp.take('b');
        if (press) {
          if (!d.done) {
            d.done = true; d.lastN = d.tokens.length;
            this._renderLine(d, d.tokens.length);
            if (!d.choices) this.dNext.classList.add('on');
          } else if (!d.choices) this._finishLine();
        } else if (d.auto && d.done && !d.choices) {
          d.autoT = (d.autoT || 0) + dt;
          if (d.autoT > d.auto) this._finishLine();
        }
      }
      if (this.dlg === d && d.choices && d.done && !d.choiceShown) this._showChoices(d);
    } else if (this.dialogOpen) {
      this._hideT -= dt;
      if (this._hideT <= 0) { this.dialogOpen = false; this.dlgEl.classList.add('hidden'); }
    }
    this._dlgClick = false;

    // top modal layer: focus navigation
    const top = this.layers[this.layers.length - 1];
    if (top && !(this.dlg && !top.isChoice)) {
      const dir = inp.nav();
      if (dir) this._moveFocus(top, dir);
      if (inp.take('a')) {
        const f = top.focus;
        if (f && f.isConnected && !f.classList.contains('disabled')) { G.audio.sfx('ok'); f.click(); } else if (f) G.audio.sfx('deny');
      } else if (inp.hit('back') || inp.hit('b')) {
        if (top.onCancel) { inp.consume('back', 'b', 'start'); G.audio.sfx('back'); top.onCancel(); }
      }
      if (top.onUpdate) top.onUpdate(dt);
    }

    // world-anchored pops
    if (this._popList.length) {
      const m = G.top();
      for (let i = this._popList.length - 1; i >= 0; i--) {
        const p = this._popList[i];
        p.t -= dt;
        if (p.t <= 0 || !m) { p.el.remove(); this._popList.splice(i, 1); continue; }
        if (p.pos && m) {
          const s = this.project(p.pos, m.camera);
          p.el.style.left = `${s.x}px`;
          p.el.style.top = `${s.y}px`;
        }
      }
    }
  }

  /** World position → screen pixels. */
  project(pos, camera) {
    if (camera._projFrame !== G.frame) {
      camera._projFrame = G.frame;
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    }
    _v.set(pos.x, pos.y || 0, pos.z).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * G.W, y: (-_v.y * 0.5 + 0.5) * G.H, behind: _v.z > 1 };
  }

  // ---------------------------------------------------------------- dialogue
  _speaker(who) {
    if (!who) return null;
    if (typeof who === 'string') return this.speakers(who) || { name: who };
    return who;
  }

  /** Show one line of dialogue. Resolves when the player advances. */
  say(who, text, opts = {}) {
    if (G.debug.fastDialog) { G.debug.lastLine = text; return Promise.resolve(); }
    const sp = this._speaker(who);
    return new Promise((resolve) => {
      const tokens = [];
      let bold = false;
      for (const c of String(text)) {
        if (c === '*') { bold = !bold; continue; }
        tokens.push({ c, bold });
      }
      this.dlg = {
        tokens, shown: 0, lastN: -1, done: false, resolve, cps: opts.cps || 46,
        pitch: (sp && sp.pitch) || 1, voice: (sp && sp.voice) || 'triangle',
        choices: opts.choices || null, auto: opts.auto || 0, skippable: true,
      };
      this.dialogOpen = true;
      this.dlgEl.classList.remove('hidden');
      this.dlgEl.classList.toggle('narration', !sp);
      this.dlgEl.classList.toggle('big', !!opts.big);
      this.dNext.classList.remove('on');
      this.dChoices.innerHTML = '';
      if (sp) {
        this.dName.textContent = sp.name || '';
        this.dName.style.background = sp.color || '';
        this.dName.style.display = sp.name ? '' : 'none';
        const src = typeof sp.portrait === 'function' ? sp.portrait() : sp.portrait;
        if (src) { this.dPortrait.src = src; this.dPortrait.style.display = ''; } else this.dPortrait.style.display = 'none';
      } else {
        this.dName.style.display = 'none';
        this.dPortrait.style.display = 'none';
      }
      this._renderLine(this.dlg, 0);
    });
  }

  _renderLine(d, n) {
    let html = '';
    let open = false;
    const push = (t) => {
      const ch = t.c === '\n' ? '<br>' : t.c === '<' ? '&lt;' : t.c === '&' ? '&amp;' : t.c;
      html += t.bold ? `<b>${ch}</b>` : ch;
    };
    for (let i = 0; i < d.tokens.length; i++) {
      if (i === n) { html += '<span class="unseen">'; open = true; }
      push(d.tokens[i]);
    }
    if (open) html += '</span>';
    this.dText.innerHTML = html;
  }

  _finishLine() {
    const d = this.dlg;
    if (!d) return;
    this.dlg = null;
    this._hideT = 0.12;
    G.audio.sfx('page');
    d.resolve();
  }

  _showChoices(d) {
    d.choiceShown = true;
    this.dNext.classList.remove('on');
    const btns = d.choices.map((label, i) => el('button.btn.choice.focusable', {
      html: rich(label),
      onclick: () => {
        layer.close();
        this.dChoices.innerHTML = '';
        this.dlg = null;
        this._hideT = 0.12;
        d.resolveChoice(i);
      },
    }));
    this.dChoices.append(...btns);
    const layer = this.pushLayer({ el: this.dChoices, external: true, isChoice: true, blocking: true });
    if (d.cancelIndex !== undefined) layer.onCancel = () => btns[d.cancelIndex].click();
  }

  /** Ask a question with options; resolves to the chosen index. */
  async choose(who, text, options, opts = {}) {
    if (G.debug.fastDialog) {
      const q = G.debug.choices;
      const forced = q && q.length ? q.shift() : (opts.testPick ?? 0);
      return typeof forced === 'function' ? forced(options) : forced;
    }
    return new Promise((resolve) => {
      this.say(who, text, { ...opts, choices: options });
      this.dlg.resolveChoice = resolve;
      this.dlg.cancelIndex = opts.cancel;
      this.dlg.skippable = false;
    });
  }

  // ---------------------------------------------------------------- layers / focus
  /**
   * Push a modal layer. opts.el is appended to the screen (unless external).
   * Elements with class "focusable" can be reached with arrows / d-pad / stick.
   */
  pushLayer(opts) {
    const layer = {
      el: opts.el, blocking: opts.blocking !== false, onCancel: opts.onCancel || null,
      onUpdate: opts.onUpdate || null, isChoice: !!opts.isChoice, focus: null, external: !!opts.external,
      close: () => {
        const i = this.layers.indexOf(layer);
        if (i >= 0) this.layers.splice(i, 1);
        if (!layer.external) layer.el.remove();
        if (opts.onClose) opts.onClose();
      },
      refocus: (target) => this._setFocus(layer, target || this._focusables(layer)[0] || null),
    };
    if (!layer.external) this.layerRoot.appendChild(layer.el);
    layer.el.addEventListener('pointerover', (e) => {
      const t = e.target.closest && e.target.closest('.focusable');
      if (t && layer.el.contains(t) && t !== layer.focus) this._setFocus(layer, t, true);
    });
    this.layers.push(layer);
    const first = (opts.focus && layer.el.querySelector(opts.focus)) || this._focusables(layer)[0];
    this._setFocus(layer, first || null, true);
    return layer;
  }

  _focusables(layer) {
    return [...layer.el.querySelectorAll('.focusable')].filter((n) => n.offsetParent !== null);
  }

  _setFocus(layer, node, silent) {
    if (layer.focus && layer.focus !== node) layer.focus.classList.remove('focus');
    layer.focus = node;
    if (node) {
      node.classList.add('focus');
      if (node.scrollIntoView) { try { node.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { /* old browsers */ } }
      if (!silent) G.audio.sfx('move');
      node.dispatchEvent(new CustomEvent('focused'));
    }
  }

  _moveFocus(layer, dir) {
    const list = this._focusables(layer);
    if (!list.length) return;
    if (!layer.focus || !layer.focus.isConnected || layer.focus.offsetParent === null) { this._setFocus(layer, list[0]); return; }
    const cur = layer.focus.getBoundingClientRect();
    const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
    let best = null, bestScore = Infinity;
    for (const n of list) {
      if (n === layer.focus) continue;
      const r = n.getBoundingClientRect();
      const nx = r.left + r.width / 2, ny = r.top + r.height / 2;
      let primary, ortho;
      if (dir === 'left') { primary = cx - nx; ortho = Math.abs(ny - cy); if (r.right > cur.left + 4) continue; }
      else if (dir === 'right') { primary = nx - cx; ortho = Math.abs(ny - cy); if (r.left < cur.right - 4) continue; }
      else if (dir === 'up') { primary = cy - ny; ortho = Math.abs(nx - cx); if (r.bottom > cur.top + 4) continue; }
      else { primary = ny - cy; ortho = Math.abs(nx - cx); if (r.top < cur.bottom - 4) continue; }
      if (primary <= 0) continue;
      const score = primary + ortho * 2.6;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    if (best) this._setFocus(layer, best);
  }

  /** A centred panel. build(body, api) fills it; api.close(result) resolves the promise. */
  panel({ title, cls = '', build, closable = true, wide = false }) {
    return new Promise((resolve) => {
      const body = el('div.panel-body');
      const card = el(`div.panel${wide ? '.wide' : ''}`, title ? el('div.panel-title', { html: title }) : null, body);
      if (cls) card.classList.add(...cls.split(' '));
      const wrap = el('div.layer-wrap', card);
      let layer = null;
      const api = {
        close: (result) => { if (layer) layer.close(); resolve(result); },
        refocus: (sel) => layer && layer.refocus(sel ? card.querySelector(sel) : null),
        card, body,
        get layer() { return layer; },
      };
      build(body, api);
      if (closable) card.appendChild(el('button.panel-x.focusable', { text: '✕', onclick: () => api.close(null) }));
      layer = this.pushLayer({ el: wrap, onCancel: closable ? () => api.close(null) : null });
      const first = card.querySelector('.focusable.first') || card.querySelector('.panel-body .focusable');
      if (first) layer.refocus(first);
    });
  }

  /** Quick modal confirm. */
  async confirm(text, yes = 'Yes', no = 'No') {
    if (G.debug.fastDialog) return true;
    const r = await this.panel({
      cls: 'small', closable: false,
      build: (body, api) => {
        body.append(el('div.confirm-text', { html: rich(text) }), el('div.row.center',
          el('button.btn.focusable.first', { text: yes, onclick: () => api.close(true) }),
          el('button.btn.alt.focusable', { text: no, onclick: () => api.close(false) })));
        api.card.dataset.cancel = '1';
      },
    });
    return !!r;
  }

  button(label, onClick, cls = '') {
    const b = el('button.btn.focusable', { html: label, onclick: onClick });
    if (cls) b.classList.add(...cls.split(' '));
    return b;
  }

  // ---------------------------------------------------------------- misc widgets
  toast(html, ms = 2800) {
    if (G.debug.test) G.debug.lastToast = html;
    const t = el('div.toast', { html });
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }

  /** Big centre-screen announcement. */
  banner(main, sub = '', { dur = 1.6, cls = '' } = {}) {
    this.bannerEl.innerHTML = '';
    const b = el(`div.banner-card${cls ? '.' + cls.split(' ').join('.') : ''}`, el('div.main', { html: main }), sub ? el('div.sub', { html: sub }) : null);
    this.bannerEl.appendChild(b);
    const kill = () => { b.classList.add('out'); setTimeout(() => b.remove(), 350); };
    if (G.debug.fast) { b.remove(); return Promise.resolve(); }
    return G.sched.wait(dur).then(kill);
  }
  clearBanner() { this.bannerEl.innerHTML = ''; }

  /** Interaction hint at the bottom ("SPACE Talk"). Pass null to hide. */
  prompt(action, label) {
    if (!label) { this.promptEl.classList.add('hidden'); this._promptKey = null; return; }
    const key = `${action}|${label}|${G.input.device}`;
    if (key !== this._promptKey) {
      this._promptKey = key;
      this.promptEl.innerHTML = `<span class="key">${G.input.glyph(action)}</span> ${label}`;
    }
    this.promptEl.classList.remove('hidden');
  }

  /** Cinematic letterbox bars. */
  cine(on) { this.cineEl.classList.toggle('on', !!on); }

  /** Floating text anchored to a world position (or screen centre if pos is null). */
  pop(text, pos, cls = '', life = 1.1) {
    if (G.debug.noRender) return;
    const node = el(`div.pop${cls ? '.' + cls.split(' ').join('.') : ''}`, { html: text });
    this.pops.appendChild(node);
    const p = { el: node, pos: pos ? { x: pos.x, y: pos.y ?? 1.6, z: pos.z } : null, t: life };
    if (!pos) { node.style.left = '50%'; node.style.top = '42%'; }
    else {
      const m = G.top();
      if (m) { const s = this.project(p.pos, m.camera); node.style.left = `${s.x}px`; node.style.top = `${s.y}px`; }
    }
    node.style.animationDuration = `${life}s`;
    this._popList.push(p);
    return node;
  }

  /** Key hint chip markup. */
  key(action) { return `<span class="key">${G.input.glyph(action)}</span>`; }
}

export { clamp };
