// editor.js — the map editor: place models, paint new ones, script anything.

import { clamp, uid, COLORS, playSound } from './util.js';
import {
  BUILTIN_MODELS, modelInfo, emptyMap, validateMap, mapToCode, codeToMap,
  PALETTE_KEYS,
} from './world.js';
import { drawGround, drawEntity, drawSpawnMarker, worldLabel } from './render.js';
import { compile } from './boxscript.js';
import { saveMap } from './maps.js';

const SNAP = 4;

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

export class Editor {
  constructor(opts) {
    this.renderer = opts.renderer;
    this.root = opts.root;
    this.map = validateMap(opts.map) || emptyMap();
    this.mapId = opts.mapId || uid();
    this.onExit = opts.onExit;
    this.onTest = opts.onTest;
    this.onHost = opts.onHost;

    this.tool = 'select';
    this.currentModel = 'box';
    this.selected = null;
    this.undoStack = [];
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0, down: false, panning: false, dragging: false };
    this.running = true;
    this.statusT = 0;
    this.status = '';

    this.renderer.cam.x = this.map.spawn.x;
    this.renderer.cam.y = this.map.spawn.y - 20;
    this.buildUI();
    this.bind();
    this.refreshPalette();
    this.last = performance.now();
    this.raf = requestAnimationFrame(() => this.frame());
  }

  // ------------------------------------------------------------- UI build
  buildUI() {
    this.root.innerHTML = '';
    this.root.style.display = 'block';

    const top = h('div', 'ed-top');
    this.nameInput = h('input');
    this.nameInput.value = this.map.name;
    this.nameInput.maxLength = 40;
    this.nameInput.addEventListener('input', () => { this.map.name = this.nameInput.value || 'untitled'; });
    const backBtn = h('button', 'ed-btn', '← menu');
    backBtn.addEventListener('click', () => this.exit());
    const saveBtn = h('button', 'ed-btn', 'save');
    saveBtn.addEventListener('click', () => { this.save(); this.flash('saved'); });
    const testBtn = h('button', 'ed-btn ed-primary', '▶ test');
    testBtn.addEventListener('click', () => { this.save(); this.onTest(this.map, this.mapId); });
    const hostBtn = h('button', 'ed-btn', 'host lobby');
    hostBtn.addEventListener('click', () => { this.save(); this.onHost(this.map, this.mapId); });
    const shareBtn = h('button', 'ed-btn', 'share');
    shareBtn.addEventListener('click', () => this.shareModal());
    const helpBtn = h('button', 'ed-btn', 'boxscript help');
    helpBtn.addEventListener('click', () => this.helpModal());
    const groundLab = h('label', 'ed-check');
    this.groundCheck = h('input');
    this.groundCheck.type = 'checkbox';
    this.groundCheck.checked = this.map.groundY != null;
    this.groundCheck.addEventListener('change', () => {
      this.pushUndo();
      this.map.groundY = this.groundCheck.checked ? 0 : null;
    });
    groundLab.append(this.groundCheck, document.createTextNode(' ground'));
    const bgLab = h('label', 'ed-check');
    this.bgSelect = h('select');
    for (const [label, val] of [['white', '#ffffff'], ['paper', '#f3f1ec'], ['fog', '#e9e9e9'], ['dusk', '#c9c9cf'], ['dark', '#3a3a3a'], ['night', '#191919'], ['backrooms', '#d8cf9f']]) {
      const opt = h('option', null, label);
      opt.value = val;
      this.bgSelect.appendChild(opt);
    }
    this.bgSelect.value = this.map.bg;
    if (this.bgSelect.value !== this.map.bg) this.bgSelect.value = '#ffffff';
    this.bgSelect.addEventListener('change', () => { this.pushUndo(); this.map.bg = this.bgSelect.value; });
    bgLab.append(document.createTextNode('bg '), this.bgSelect);
    top.append(backBtn, this.nameInput, groundLab, bgLab, saveBtn, shareBtn, helpBtn, hostBtn, testBtn);

    this.left = h('div', 'ed-left');
    this.right = h('div', 'ed-right');
    this.right.style.display = 'none';
    this.statusEl = h('div', 'ed-status');
    this.modalHost = h('div');
    this.root.append(top, this.left, this.right, this.statusEl, this.modalHost);
  }

  refreshPalette() {
    this.left.innerHTML = '';
    this.left.appendChild(h('div', 'ed-h', 'tools'));
    const tools = h('div', 'ed-tools');
    for (const [t, label] of [['select', '↖ select'], ['erase', '✕ erase'], ['spawn', '⌂ spawn point']]) {
      const b = h('button', 'ed-tool' + (this.tool === t ? ' on' : ''), label);
      b.addEventListener('click', () => { this.tool = t; this.refreshPalette(); });
      tools.appendChild(b);
    }
    this.left.appendChild(tools);

    this.left.appendChild(h('div', 'ed-h', 'place'));
    const addModelBtn = (name, label) => {
      const b = h('button', 'ed-model' + (this.tool === 'place' && this.currentModel === name ? ' on' : ''));
      const cv = document.createElement('canvas');
      cv.width = 36; cv.height = 30;
      this.drawThumb(cv, name);
      b.appendChild(cv);
      b.appendChild(h('span', null, label));
      b.addEventListener('click', () => { this.tool = 'place'; this.currentModel = name; this.refreshPalette(); });
      this.left.appendChild(b);
    };
    for (const [name, m] of Object.entries(BUILTIN_MODELS)) addModelBtn(name, m.label);
    this.left.appendChild(h('div', 'ed-h', 'my models'));
    for (const name of Object.keys(this.map.models)) {
      const row = h('div', 'ed-model-row');
      const b = h('button', 'ed-model' + (this.tool === 'place' && this.currentModel === name ? ' on' : ''));
      const cv = document.createElement('canvas');
      cv.width = 36; cv.height = 30;
      this.drawThumb(cv, name);
      b.appendChild(cv);
      b.appendChild(h('span', null, name));
      b.addEventListener('click', () => { this.tool = 'place'; this.currentModel = name; this.refreshPalette(); });
      const edit = h('button', 'ed-mini', '✎');
      edit.title = 'edit model';
      edit.addEventListener('click', () => this.painterModal(name));
      row.append(b, edit);
      this.left.appendChild(row);
    }
    const newModel = h('button', 'ed-btn ed-wide', '+ paint a model');
    newModel.addEventListener('click', () => this.painterModal(null));
    this.left.appendChild(newModel);
  }

  drawThumb(cv, name) {
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const info = modelInfo(this.map, name);
    const scale = Math.min(30 / info.w, 26 / info.h, 2);
    c.save();
    c.translate(cv.width / 2, cv.height / 2);
    c.scale(scale, scale);
    const fake = { model: name, x: 0, y: 0, scale: 100, visible: true, color: null, heldBy: null };
    drawEntity(c, this.map, fake, { armed: true });
    c.restore();
  }

  refreshInspector() {
    const spec = this.selected;
    if (!spec) { this.right.style.display = 'none'; return; }
    this.right.style.display = 'block';
    this.right.innerHTML = '';
    this.right.appendChild(h('div', 'ed-h', modelInfo(this.map, spec.model).label || spec.model));

    const row = (label, el) => {
      const r = h('div', 'ed-row');
      r.appendChild(h('span', null, label));
      r.appendChild(el);
      this.right.appendChild(r);
    };

    const scale = h('input');
    scale.type = 'range'; scale.min = 25; scale.max = 400; scale.value = spec.scale || 100;
    scale.addEventListener('input', () => { spec.scale = +scale.value; });
    row('size', scale);

    const solid = h('input'); solid.type = 'checkbox';
    const info = modelInfo(this.map, spec.model);
    solid.checked = spec.solid != null ? spec.solid : info.solid;
    solid.addEventListener('change', () => { spec.solid = solid.checked; });
    row('solid (blocks you)', solid);

    const phys = h('input'); phys.type = 'checkbox';
    phys.checked = spec.physical != null ? spec.physical : info.physical;
    phys.addEventListener('change', () => { spec.physical = phys.checked; });
    row('physical (falls, throwable)', phys);

    const color = h('select');
    const defOpt = h('option', null, 'default'); defOpt.value = '';
    color.appendChild(defOpt);
    for (const name of Object.keys(COLORS)) {
      const opt = h('option', null, name); opt.value = name;
      color.appendChild(opt);
    }
    color.value = spec.color || '';
    color.addEventListener('change', () => { spec.color = color.value || null; });
    row('tint', color);

    const scriptBtn = h('button', 'ed-btn ed-wide',
      spec.script ? '✎ edit script' : '+ add script');
    if (spec.script) {
      const res = compile(spec.script);
      if (!res.ok) scriptBtn.textContent = '⚠ script has errors';
    }
    scriptBtn.addEventListener('click', () => this.scriptModal(
      spec.script || '', (src) => { this.pushUndo(); spec.script = src || null; this.refreshInspector(); },
      'script on this ' + spec.model,
    ));
    this.right.appendChild(scriptBtn);

    const dup = h('button', 'ed-btn ed-wide', 'duplicate');
    dup.addEventListener('click', () => {
      this.pushUndo();
      const copy = { ...spec, id: uid(), x: spec.x + 20, y: spec.y };
      this.map.objects.push(copy);
      this.selected = copy;
      this.refreshInspector();
    });
    this.right.appendChild(dup);

    const del = h('button', 'ed-btn ed-wide ed-danger', 'delete');
    del.addEventListener('click', () => {
      this.pushUndo();
      this.map.objects = this.map.objects.filter(o => o !== spec);
      this.selected = null;
      this.refreshInspector();
    });
    this.right.appendChild(del);
  }

  // ------------------------------------------------------------- modals
  modal(title) {
    this.modalHost.innerHTML = '';
    const back = h('div', 'ed-modal-back');
    const box = h('div', 'ed-modal');
    box.appendChild(h('div', 'ed-modal-title', title));
    back.appendChild(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) this.closeModal(); });
    this.modalHost.appendChild(back);
    return box;
  }

  closeModal() { this.modalHost.innerHTML = ''; }

  scriptModal(source, onSave, title, onCancel) {
    const box = this.modal(title || 'boxscript');
    box.classList.add('ed-modal-wide');
    const wrap = h('div', 'ed-script-wrap');
    const ta = h('textarea', 'ed-script');
    ta.value = source;
    ta.spellcheck = false;
    ta.placeholder = 'when touched\n  say "hello!"\nend';
    const side = h('div', 'ed-cheat');
    side.innerHTML = CHEATSHEET_HTML;
    wrap.append(ta, side);
    const errBox = h('div', 'ed-errors');
    const bar = h('div', 'ed-modal-bar');
    const check = h('button', 'ed-btn', 'check');
    const doCheck = () => {
      const res = compile(ta.value);
      if (res.ok) { errBox.textContent = ta.value.trim() ? '✓ looks good' : ''; errBox.className = 'ed-errors ok'; }
      else {
        errBox.className = 'ed-errors';
        errBox.textContent = res.errors.slice(0, 6).map(e => 'line ' + e.line + ': ' + e.msg).join('\n');
      }
      return res.ok;
    };
    check.addEventListener('click', doCheck);
    const save = h('button', 'ed-btn ed-primary', 'save script');
    save.addEventListener('click', () => { doCheck(); onSave(ta.value.trim()); this.closeModal(); });
    const cancel = h('button', 'ed-btn', 'cancel');
    cancel.addEventListener('click', () => { this.closeModal(); if (onCancel) onCancel(); });
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + 2;
      }
    });
    bar.append(check, cancel, save);
    box.append(wrap, errBox, bar);
    ta.focus();
  }

  painterModal(existingName) {
    const model = existingName ? this.map.models[existingName] : null;
    let W = model ? model.w : 16, H = model ? model.h : 16;
    let grid = model ? model.d.split('') : new Array(W * H).fill('.');
    let colorIdx = 0; // gray
    let tool = 'pen';
    let mirror = false;
    let script = model ? model.script : null;

    const box = this.modal(existingName ? 'edit model: ' + existingName : 'paint a model');
    box.classList.add('ed-modal-wide');

    const nameRow = h('div', 'ed-row');
    nameRow.appendChild(h('span', null, 'name'));
    const nameIn = h('input');
    nameIn.value = existingName || '';
    nameIn.maxLength = 24;
    nameIn.placeholder = 'e.g. lamp';
    nameRow.appendChild(nameIn);
    const sizeSel = h('select');
    for (const s of [8, 12, 16, 24, 32, 48]) {
      const o = h('option', null, s + '×' + s); o.value = s;
      sizeSel.appendChild(o);
    }
    sizeSel.value = String(W);
    nameRow.appendChild(sizeSel);
    box.appendChild(nameRow);

    const body = h('div', 'ed-paint-wrap');
    const cv = document.createElement('canvas');
    cv.className = 'ed-paint';
    const PXS = () => Math.floor(Math.min(340 / W, 340 / H));
    const sizeCanvas = () => { cv.width = W * PXS(); cv.height = H * PXS(); };
    sizeCanvas();
    const cx = cv.getContext('2d');

    const redraw = () => {
      const s = PXS();
      cx.imageSmoothingEnabled = false;
      // checkerboard = transparent
      for (let r = 0; r < H; r++) {
        for (let q = 0; q < W; q++) {
          cx.fillStyle = (r + q) % 2 ? '#f2f2f2' : '#fafafa';
          cx.fillRect(q * s, r * s, s, s);
          const ch = grid[r * W + q];
          if (ch !== '.') {
            const key = PALETTE_KEYS[parseInt(ch, 36)];
            if (key) { cx.fillStyle = COLORS[key]; cx.fillRect(q * s, r * s, s, s); }
          }
        }
      }
      cx.strokeStyle = 'rgba(0,0,0,0.06)';
      for (let q = 0; q <= W; q++) { cx.beginPath(); cx.moveTo(q * s, 0); cx.lineTo(q * s, H * s); cx.stroke(); }
      for (let r = 0; r <= H; r++) { cx.beginPath(); cx.moveTo(0, r * s); cx.lineTo(W * s, r * s); cx.stroke(); }
    };

    const paintAt = (e) => {
      const rect = cv.getBoundingClientRect();
      const q = Math.floor((e.clientX - rect.left) / rect.width * W);
      const r = Math.floor((e.clientY - rect.top) / rect.height * H);
      if (q < 0 || r < 0 || q >= W || r >= H) return;
      const ch = tool === 'eraser' ? '.' : colorIdx.toString(36);
      if (tool === 'fill') {
        const target = grid[r * W + q];
        if (target === ch) return;
        const stack = [[q, r]];
        let guard = 0;
        while (stack.length && guard++ < 10000) {
          const [a, b] = stack.pop();
          if (a < 0 || b < 0 || a >= W || b >= H || grid[b * W + a] !== target) continue;
          grid[b * W + a] = ch;
          stack.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
        }
      } else {
        grid[r * W + q] = ch;
        if (mirror) grid[r * W + (W - 1 - q)] = ch;
      }
      redraw();
    };
    let painting = false;
    cv.addEventListener('mousedown', (e) => { painting = true; paintAt(e); });
    window.addEventListener('mousemove', (e) => { if (painting) paintAt(e); });
    window.addEventListener('mouseup', () => { painting = false; });

    sizeSel.addEventListener('change', () => {
      const n = +sizeSel.value;
      const old = grid, ow = W, oh = H;
      W = n; H = n;
      grid = new Array(W * H).fill('.');
      for (let r = 0; r < Math.min(oh, H); r++) {
        for (let q = 0; q < Math.min(ow, W); q++) grid[r * W + q] = old[r * ow + q];
      }
      sizeCanvas(); redraw();
    });

    const side = h('div', 'ed-paint-side');
    side.appendChild(h('div', 'ed-h', 'colors'));
    const swatches = h('div', 'ed-swatches');
    PALETTE_KEYS.forEach((key, i) => {
      const sw = h('button', 'ed-swatch' + (i === colorIdx ? ' on' : ''));
      sw.style.background = COLORS[key];
      sw.title = key;
      sw.addEventListener('click', () => {
        colorIdx = i; tool = tool === 'eraser' ? 'pen' : tool;
        [...swatches.children].forEach((el, j) => el.classList.toggle('on', j === i));
        toolBtns.forEach(([t, b]) => b.classList.toggle('on', t === tool));
      });
      swatches.appendChild(sw);
    });
    side.appendChild(swatches);
    side.appendChild(h('div', 'ed-h', 'tools'));
    const toolBtns = [];
    for (const [t, label] of [['pen', '✏ pen'], ['fill', '▨ fill'], ['eraser', '◻ eraser']]) {
      const b = h('button', 'ed-tool' + (t === 'pen' ? ' on' : ''), label);
      b.addEventListener('click', () => {
        tool = t;
        toolBtns.forEach(([, bb]) => bb.classList.remove('on'));
        b.classList.add('on');
      });
      toolBtns.push([t, b]);
      side.appendChild(b);
    }
    const mirrorLab = h('label', 'ed-check');
    const mirrorIn = h('input'); mirrorIn.type = 'checkbox';
    mirrorIn.addEventListener('change', () => { mirror = mirrorIn.checked; });
    mirrorLab.append(mirrorIn, document.createTextNode(' mirror'));
    side.appendChild(mirrorLab);
    const clearBtn = h('button', 'ed-tool', 'clear');
    clearBtn.addEventListener('click', () => { grid.fill('.'); redraw(); });
    side.appendChild(clearBtn);

    side.appendChild(h('div', 'ed-h', 'behavior'));
    const solidLab = h('label', 'ed-check');
    const solidIn = h('input'); solidIn.type = 'checkbox';
    solidIn.checked = model ? model.solid !== false : true;
    solidLab.append(solidIn, document.createTextNode(' solid'));
    side.appendChild(solidLab);
    const physLab = h('label', 'ed-check');
    const physIn = h('input'); physIn.type = 'checkbox';
    physIn.checked = model ? !!model.physical : false;
    physLab.append(physIn, document.createTextNode(' physical'));
    side.appendChild(physLab);
    const scriptBtn = h('button', 'ed-btn ed-wide', script ? '✎ model script' : '+ model script');
    scriptBtn.addEventListener('click', () => {
      // the script modal replaces the painter modal, so stash the unsaved
      // pixels and reopen the painter afterwards (save or cancel alike)
      this.tempPainter = { W, H, grid: [...grid], name: nameIn.value, solid: solidIn.checked, phys: physIn.checked, script };
      this.scriptModal(script || '', (src) => {
        this.tempPainter.script = src || null;
        this.painterModal(existingName);
      }, 'script for every ' + (nameIn.value || 'model'), () => this.painterModal(existingName));
    });
    side.appendChild(scriptBtn);

    body.append(cv, side);
    box.appendChild(body);

    const bar = h('div', 'ed-modal-bar');
    const cancel = h('button', 'ed-btn', 'cancel');
    cancel.addEventListener('click', () => this.closeModal());
    const save = h('button', 'ed-btn ed-primary', 'save model');
    save.addEventListener('click', () => {
      const name = (nameIn.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!name) { this.flash('give the model a name'); nameIn.focus(); return; }
      if (BUILTIN_MODELS[name]) { this.flash('"' + name + '" is a built-in name'); return; }
      this.pushUndo();
      if (existingName && existingName !== name) {
        delete this.map.models[existingName];
        for (const o of this.map.objects) if (o.model === existingName) o.model = name;
      }
      this.map.models[name] = {
        w: W, h: H, d: grid.join(''),
        solid: solidIn.checked, physical: physIn.checked,
        script: script || null,
      };
      this.closeModal();
      this.currentModel = name;
      this.tool = 'place';
      this.refreshPalette();
      playSound('ding');
    });
    bar.append(cancel, save);
    box.appendChild(bar);

    // restore stash if we bounced through the script modal
    if (this.tempPainter) {
      const t = this.tempPainter;
      this.tempPainter = null;
      W = t.W; H = t.H; grid = t.grid;
      nameIn.value = t.name;
      solidIn.checked = t.solid;
      physIn.checked = t.phys;
      script = t.script;
      sizeSel.value = String(W);
      sizeCanvas();
    }
    redraw();
  }

  shareModal() {
    const box = this.modal('share this map');
    box.appendChild(h('p', 'ed-p', 'send this code to a friend — they paste it in "create map → import".'));
    const ta = h('textarea', 'ed-share');
    ta.readOnly = true;
    ta.value = mapToCode(this.map);
    box.appendChild(ta);
    const bar = h('div', 'ed-modal-bar');
    const copy = h('button', 'ed-btn ed-primary', 'copy');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(ta.value); this.flash('copied'); }
      catch (e) { ta.select(); document.execCommand('copy'); this.flash('copied'); }
    });
    const done = h('button', 'ed-btn', 'done');
    done.addEventListener('click', () => this.closeModal());
    bar.append(copy, done);
    box.appendChild(bar);
    ta.addEventListener('click', () => ta.select());
  }

  helpModal() {
    const box = this.modal('boxscript — the language');
    box.classList.add('ed-modal-wide');
    const div = h('div', 'ed-help');
    div.innerHTML = HELP_HTML;
    box.appendChild(div);
    const bar = h('div', 'ed-modal-bar');
    const done = h('button', 'ed-btn ed-primary', 'got it');
    done.addEventListener('click', () => this.closeModal());
    bar.appendChild(done);
    box.appendChild(bar);
  }

  // ------------------------------------------------------------- editing
  pushUndo() {
    this.undoStack.push(JSON.stringify(this.map));
    if (this.undoStack.length > 60) this.undoStack.shift();
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) { this.flash('nothing to undo'); return; }
    this.map = validateMap(JSON.parse(prev));
    this.selected = null;
    this.refreshPalette();
    this.refreshInspector();
  }

  save() {
    this.map.name = this.nameInput.value.trim() || 'untitled';
    saveMap(this.mapId, this.map);
  }

  flash(text) { this.status = text; this.statusT = 2.5; }

  specAt(wx, wy) {
    for (let i = this.map.objects.length - 1; i >= 0; i--) {
      const o = this.map.objects[i];
      const info = modelInfo(this.map, o.model);
      const w = info.w * (o.scale || 100) / 100, hh = info.h * (o.scale || 100) / 100;
      if (wx >= o.x - w / 2 && wx <= o.x + w / 2 && wy >= o.y - hh / 2 && wy <= o.y + hh / 2) return o;
    }
    return null;
  }

  bind() {
    this.onMouseDown = (e) => {
      if (!this.running) return;
      if (e.target !== this.renderer.canvas && e.target !== this.renderer.overlay) return;
      const w = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.mouse.down = true;
      if (e.button === 1 || e.button === 2 || this.spaceHeld) { this.mouse.panning = true; return; }
      if (this.tool === 'place') {
        this.pushUndo();
        const info = modelInfo(this.map, this.currentModel);
        const spec = {
          id: uid(), model: this.currentModel,
          x: Math.round(w.x / SNAP) * SNAP,
          y: Math.round((w.y) / SNAP) * SNAP,
          scale: 100, solid: null, physical: null, color: null, script: null,
        };
        // rest on ground if placing near it
        if (this.map.groundY != null && Math.abs(w.y - this.map.groundY) < 14) {
          spec.y = this.map.groundY - (info.h / 2);
        }
        this.map.objects.push(spec);
        this.selected = spec;
        this.refreshInspector();
        playSound('pip');
      } else if (this.tool === 'erase') {
        const spec = this.specAt(w.x, w.y);
        if (spec) {
          this.pushUndo();
          this.map.objects = this.map.objects.filter(o => o !== spec);
          if (this.selected === spec) { this.selected = null; this.refreshInspector(); }
          playSound('thud');
        }
      } else if (this.tool === 'spawn') {
        this.pushUndo();
        this.map.spawn = { x: Math.round(w.x / SNAP) * SNAP, y: Math.round(w.y / SNAP) * SNAP };
        this.flash('spawn point set');
      } else {
        const spec = this.specAt(w.x, w.y);
        this.selected = spec;
        this.refreshInspector();
        if (spec) {
          this.mouse.dragging = true;
          this.dragOff = { x: spec.x - w.x, y: spec.y - w.y };
          this.dragStarted = false;
        }
      }
    };
    this.onMouseMove = (e) => {
      const prev = { ...this.mouse };
      this.mouse.sx = e.clientX; this.mouse.sy = e.clientY;
      const w = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.mouse.x = w.x; this.mouse.y = w.y;
      if (this.mouse.panning && this.mouse.down) {
        this.renderer.cam.x -= (e.clientX - prev.sx) / this.renderer.px;
        this.renderer.cam.y -= (e.clientY - prev.sy) / this.renderer.px;
      } else if (this.mouse.dragging && this.selected) {
        if (!this.dragStarted) { this.pushUndo(); this.dragStarted = true; }
        this.selected.x = Math.round((w.x + this.dragOff.x) / SNAP) * SNAP;
        this.selected.y = Math.round((w.y + this.dragOff.y) / SNAP) * SNAP;
      }
    };
    this.onMouseUp = () => { this.mouse.down = false; this.mouse.panning = false; this.mouse.dragging = false; };
    this.onWheel = (e) => {
      if (e.target !== this.renderer.canvas && e.target !== this.renderer.overlay) return;
      e.preventDefault();
      this.renderer.setZoom(this.renderer.px + (e.deltaY < 0 ? 1 : -1));
    };
    this.onKeyDown = (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ') { this.spaceHeld = true; e.preventDefault(); }
      if (e.key === 'Escape') {
        if (this.modalHost.childElementCount) this.closeModal();
        else this.exit();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
        this.pushUndo();
        this.map.objects = this.map.objects.filter(o => o !== this.selected);
        this.selected = null;
        this.refreshInspector();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); this.undo(); }
      const nudge = e.shiftKey ? SNAP * 4 : SNAP;
      if (this.selected) {
        if (e.key === 'ArrowLeft') { this.selected.x -= nudge; e.preventDefault(); }
        if (e.key === 'ArrowRight') { this.selected.x += nudge; e.preventDefault(); }
        if (e.key === 'ArrowUp') { this.selected.y -= nudge; e.preventDefault(); }
        if (e.key === 'ArrowDown') { this.selected.y += nudge; e.preventDefault(); }
      } else {
        const pan = 30 / this.renderer.px * 3;
        if (e.key === 'ArrowLeft' || e.key === 'a') this.renderer.cam.x -= pan;
        if (e.key === 'ArrowRight' || e.key === 'd') this.renderer.cam.x += pan;
        if (e.key === 'ArrowUp' || e.key === 'w') this.renderer.cam.y -= pan;
        if (e.key === 'ArrowDown' || e.key === 's') this.renderer.cam.y += pan;
      }
    };
    this.onKeyUp = (e) => { if (e.key === ' ') this.spaceHeld = false; };
    this.onCtx = (e) => { if (e.target === this.renderer.canvas || e.target === this.renderer.overlay) e.preventDefault(); };
    this.onResize = () => this.renderer.resize();
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('resize', this.onResize);
  }

  unbind() {
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('contextmenu', this.onCtx);
    window.removeEventListener('resize', this.onResize);
  }

  // ------------------------------------------------------------- render
  frame() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    const c = this.renderer.begin(this.map.bg, dt);
    const view = this.renderer.viewBounds();
    drawGround(c, this.map.groundY, view);

    // origin cross
    c.fillStyle = 'rgba(0,0,0,0.08)';
    c.fillRect(-6, -0.5, 12, 1);
    c.fillRect(-0.5, -6, 1, 12);

    for (const o of this.map.objects) {
      const fake = {
        model: o.model, x: o.x, y: o.y, scale: o.scale || 100,
        visible: true, color: o.color, heldBy: null,
      };
      drawEntity(c, this.map, fake, { armed: true });
      if (o.script) {
        c.fillStyle = 'rgba(120,150,200,0.9)';
        const info = modelInfo(this.map, o.model);
        c.fillRect(o.x + (info.w * (o.scale || 100) / 100) / 2 - 2, o.y - (info.h * (o.scale || 100) / 100) / 2 - 3, 3, 3);
      }
    }

    drawSpawnMarker(c, this.map.spawn.x, this.map.spawn.y - 12);

    // selection box
    if (this.selected) {
      const o = this.selected;
      const info = modelInfo(this.map, o.model);
      const w = info.w * (o.scale || 100) / 100, hh = info.h * (o.scale || 100) / 100;
      c.strokeStyle = 'rgba(90,140,220,0.9)';
      c.lineWidth = 1;
      c.strokeRect(o.x - w / 2 - 2, o.y - hh / 2 - 2, w + 4, hh + 4);
    }

    // ghost preview for placement
    if (this.tool === 'place' && !this.mouse.panning) {
      c.globalAlpha = 0.5;
      const fake = {
        model: this.currentModel,
        x: Math.round(this.mouse.x / SNAP) * SNAP,
        y: Math.round(this.mouse.y / SNAP) * SNAP,
        scale: 100, visible: true, color: null, heldBy: null,
      };
      drawEntity(c, this.map, fake, { armed: true });
      c.globalAlpha = 1;
    }

    const o = this.renderer.end();
    o.font = '12px ui-monospace, Menlo, Consolas, monospace';
    o.fillStyle = 'rgba(150,150,150,0.9)';
    o.textBaseline = 'top';
    o.fillText('scroll: zoom · right-drag/space: pan · ctrl+z: undo · esc: leave', 190, this.renderer.h - 24);
    if (this.statusT > 0) {
      this.statusT -= dt;
      o.textAlign = 'center';
      o.fillText(this.status, this.renderer.w / 2, 54);
      o.textAlign = 'left';
    }

    this.raf = requestAnimationFrame(() => this.frame());
  }

  exit() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.save();
    this.unbind();
    this.root.style.display = 'none';
    this.root.innerHTML = '';
    this.onExit();
  }
}

// ---------------------------------------------------------------- docs
const CHEATSHEET_HTML = `
<b>events</b>
<pre>when start
when tick
when touched
when clicked
when hit
when key e
when message go
when button "play"
every 2 seconds</pre>
<b>do things</b>
<pre>say "hi" for 2 seconds
move up 10
goto 100, 50
set x to 0   set y to 0
grow 25
color red
show   hide
solid off
spawn box at 100, 0
vanish
push up 200
sound pop
wait 0.5
broadcast go
broadcast go to everyone
teleport player to 0, 0
freeze player
shake 0.5
write "score" at 50, 10 size 4 as hud
button "play" at 50, 60</pre>
<b>logic</b>
<pre>set lives to 3
change lives by -1
if lives = 0
  say "gone!"
else
  say lives + " left"
end
repeat 10 … end
while … end
forever … end</pre>
<b>values</b>
<pre>my x, my y, my size
player x, player y
mouse x, mouse y
distance to player
touching player
key space down
random 1 to 10
count of box
shared score
time · yes · no</pre>`;

const HELP_HTML = `
<p><b>boxscript</b> is the little language of this game. every object can carry a
script. scripts are lists of <b>when</b>-blocks that end with <b>end</b>. lines starting
with <b>#</b> are comments.</p>
<pre>when touched
  say "ouch!"
  wait 1
  vanish
end</pre>
<p><b>positions:</b> x grows right, y grows UP. y 0 is the ground. an object's x,y is
the middle of its feet. <code>goto 100, 0</code> stands it on the ground, 100 to the right
of the start.</p>
<p><b>screen text &amp; buttons</b> use percent of the screen: <code>write "hi" at 50, 10</code>
is top-middle. name what you write (<code>as hud</code>) to update it later.</p>
<p><b>events:</b> <code>when start</code> (map loads) · <code>when tick</code> (every frame) ·
<code>when touched</code> (player walks into me) · <code>when clicked</code> · <code>when hit</code> (blaster bolt) ·
<code>when key e</code> · <code>when message NAME</code> (from broadcast) · <code>when button "label"</code> ·
<code>every N seconds</code>.</p>
<p><b>variables:</b> <code>set score to 0</code>, <code>change score by 1</code>. plain variables belong to
one object. <code>shared</code> variables (<code>set shared score to 1</code>, read with
<code>shared score</code>) are seen by every object in the map.</p>
<p><b>multiplayer:</b> each player runs their own copy of the map's scripts — like
everyone gets their own puzzle. to make something happen for <i>everyone</i>, use
<code>broadcast go to everyone</code> and catch it with <code>when message go</code>.</p>
<p><b>models</b> you paint can carry a script too — every copy you place or
<code>spawn</code> runs it.</p>
<p>make anything. a backrooms maze (walls + dark bg + a lurking model), a
block-blast board (grid of clickable blocks + shared score + buttons), a lava
floor, an npc that talks. if it fits in boxes, it fits in here.</p>`;
