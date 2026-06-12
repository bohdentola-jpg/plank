// HUD and screens: hotbar, pixel hearts/hunger/bubbles, the inventory with a
// cursor-stack (click to lift, click to drop), list-style crafting, the
// creative palette, toasts. DOM in, callbacks out — no game logic here.
import { B, I, BLOCKS, ITEMS, isBlock, nameOf, STACK_MAX } from './blocks.js';
import { blockIconCanvas, itemIconCanvas } from './textures.js';
import { recipesFor, canCraft, hasFuel } from './inventory.js';

const $ = (id) => document.getElementById(id);

function iconFor(id) {
  if (isBlock(id)) return blockIconCanvas(id);
  return itemIconCanvas(ITEMS[id]?.icon);
}

// 8x8 pixel glyphs for the stat bar
const GLYPH = {
  heart: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
  drum: ['...XXX.', '..XXXXX', '..XXXX.', '.XX....', 'XX.....', 'X......'],
  bubble: ['.XXX...', 'X...X..', 'X...X..', 'X...X..', '.XXX...', '.......'],
};

function drawGlyphRow(canvas, kind, value, max, colors) {
  const cell = 8, n = max / 2;
  canvas.width = n * cell; canvas.height = 7;
  const g = canvas.getContext('2d');
  const glyph = GLYPH[kind];
  for (let i = 0; i < n; i++) {
    const state = value >= (i + 1) * 2 ? 2 : value >= i * 2 + 1 ? 1 : 0;
    for (let r = 0; r < glyph.length; r++) {
      for (let c = 0; c < 7; c++) {
        if (glyph[r][c] !== 'X') continue;
        const full = state === 2 || (state === 1 && c < 3);
        g.fillStyle = full ? colors[0] : colors[1];
        if (state === 0 && kind === 'bubble') continue;
        g.fillRect(i * cell + c, r, 1, 1);
      }
    }
  }
}

export class UI {
  constructor() {
    this.cursor = null; // stack being dragged between slots
    this.onCraft = null; this.onSlotsChanged = null; this.onClose = null;
    this.station = null;
    this.inv = null;
    this.mode = 'survival';
    this._cursorEl = $('cursor-item');
    this._buildHotbar();
    document.addEventListener('mousemove', (e) => {
      if (!this.cursor) return;
      this._cursorEl.style.left = e.clientX + 'px';
      this._cursorEl.style.top = e.clientY + 'px';
    });
  }

  // -------------------------------------------------- hotbar + stats
  _buildHotbar() {
    const bar = $('hotbar');
    bar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      s.innerHTML = '<canvas width="32" height="32"></canvas><span class="n"></span><div class="dur"><i></i></div>';
      bar.appendChild(s);
    }
  }

  renderSlot(el, stack) {
    const cv = el.querySelector('canvas');
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 32, 32);
    const n = el.querySelector('.n');
    const dur = el.querySelector('.dur');
    if (stack) {
      g.imageSmoothingEnabled = false;
      const icon = iconFor(stack.id);
      g.drawImage(icon, icon.width === 16 ? 0 : 0, 0, icon.width, icon.height, 2, 2, 28, 28);
      n.textContent = stack.n > 1 ? stack.n : '';
      const tool = ITEMS[stack.id]?.tool;
      if (tool && stack.uses < tool.uses) {
        dur.style.display = 'block';
        const f = stack.uses / tool.uses;
        dur.firstChild.style.width = (f * 100) + '%';
        dur.firstChild.style.background = f > 0.5 ? '#7ec850' : f > 0.2 ? '#e8c83c' : '#e05a3c';
      } else dur.style.display = 'none';
    } else { n.textContent = ''; dur.style.display = 'none'; }
  }

  renderHotbar(inv) {
    const kids = $('hotbar').children;
    for (let i = 0; i < 9; i++) {
      this.renderSlot(kids[i], inv.slots[i]);
      kids[i].classList.toggle('sel', i === inv.sel);
    }
    const held = inv.held();
    $('held-name').textContent = held ? nameOf(held.id) : '';
    $('held-name').classList.remove('show');
    void $('held-name').offsetWidth; // restart the fade animation
    if (held) $('held-name').classList.add('show');
  }

  renderStats(p) {
    const wrap = $('stats');
    wrap.style.display = p.mode === 'creative' ? 'none' : '';
    if (p.mode === 'creative') return;
    drawGlyphRow($('hearts'), 'heart', Math.ceil(p.hp), 20, ['#e8342c', '#3a1416']);
    drawGlyphRow($('hunger'), 'drum', Math.ceil(p.hunger), 20, ['#c87a30', '#3a2a14']);
    const bub = $('bubbles');
    if (p.headInWater || p.air < 10) {
      bub.style.display = '';
      drawGlyphRow(bub, 'bubble', Math.ceil(p.air * 2), 20, ['#9cd4f4', 'transparent']);
    } else bub.style.display = 'none';
  }

  toast(msg, music = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (music ? ' music' : '');
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), music ? 5200 : 2600);
    setTimeout(() => t.remove(), music ? 6000 : 3400);
  }

  // -------------------------------------------------- inventory screens
  open(inv, mode, station = null) {
    this.inv = inv; this.mode = mode; this.station = station;
    $('inv').classList.add('show');
    $('inv-title').textContent = station === 'furnace' ? 'FURNACE'
      : station === 'table' ? 'CRAFTING TABLE'
      : mode === 'creative' ? 'BLOCKS' : 'INVENTORY';
    this.refresh();
  }

  close() {
    if (this.cursor && this.inv) { // never eat a held stack
      const { id, n } = this.cursor;
      const left = this.inv.add(id, n);
      this.cursor = null;
      this._cursorEl.style.display = 'none';
      if (left > 0) this.onDropCursor?.(id, left);
    }
    $('inv').classList.remove('show');
    this.onClose?.();
  }

  isOpen() { return $('inv').classList.contains('show'); }

  refresh() {
    if (!this.isOpen()) return;
    this._renderGrid();
    if (this.mode === 'creative' && !this.station) this._renderPalette();
    else this._renderRecipes();
    this._cursorEl.style.display = this.cursor ? 'block' : 'none';
    if (this.cursor) {
      const g = this._cursorEl.querySelector('canvas').getContext('2d');
      g.clearRect(0, 0, 32, 32);
      g.imageSmoothingEnabled = false;
      g.drawImage(iconFor(this.cursor.id), 2, 2, 28, 28);
      this._cursorEl.querySelector('.n').textContent = this.cursor.n > 1 ? this.cursor.n : '';
    }
  }

  _renderGrid() {
    const grid = $('inv-grid');
    grid.innerHTML = '';
    // backpack rows first, hotbar row visually separated at the bottom
    const order = [];
    for (let i = 9; i < 36; i++) order.push(i);
    for (let i = 0; i < 9; i++) order.push(i);
    order.forEach((idx) => {
      const el = document.createElement('div');
      el.className = 'slot' + (idx < 9 ? ' hot' : '');
      el.innerHTML = '<canvas width="32" height="32"></canvas><span class="n"></span><div class="dur"><i></i></div>';
      this.renderSlot(el, this.inv.slots[idx]);
      el.onclick = () => this._slotClick(idx, false);
      el.oncontextmenu = (e) => { e.preventDefault(); this._slotClick(idx, true); };
      grid.appendChild(el);
    });
  }

  _slotClick(idx, half) {
    const s = this.inv.slots[idx];
    if (!this.cursor) {
      if (!s) return;
      if (half && s.n > 1) {
        const take = Math.ceil(s.n / 2);
        s.n -= take;
        this.cursor = { ...s, n: take };
      } else {
        this.cursor = s;
        this.inv.slots[idx] = null;
      }
    } else if (!s) {
      if (half && this.cursor.n > 1 && this.cursor.uses === undefined) {
        this.inv.slots[idx] = { id: this.cursor.id, n: 1 };
        this.cursor.n--;
      } else {
        this.inv.slots[idx] = this.cursor;
        this.cursor = null;
      }
    } else if (s.id === this.cursor.id && s.uses === undefined && this.cursor.uses === undefined) {
      const max = STACK_MAX(s.id);
      const move = half ? 1 : this.cursor.n;
      const take = Math.min(move, max - s.n);
      s.n += take; this.cursor.n -= take;
      if (this.cursor.n <= 0) this.cursor = null;
    } else {
      this.inv.slots[idx] = this.cursor;
      this.cursor = s;
    }
    this.onSlotsChanged?.();
    this.refresh();
  }

  _renderRecipes() {
    const panel = $('inv-side');
    panel.innerHTML = `<div class="side-head">${this.station === 'furnace' ? 'SMELTING — needs fuel' : 'CRAFT'}</div>`;
    const list = document.createElement('div');
    list.className = 'recipes';
    for (const r of recipesFor(this.station)) {
      const ok = canCraft(r, this.inv) && (r.station !== 'furnace' || hasFuel(this.inv));
      const el = document.createElement('div');
      el.className = 'recipe' + (ok ? '' : ' no');
      const needs = r.needs.map(([what, n]) => {
        const label = typeof what === 'string' ? what : nameOf(what);
        return `${n} ${label}`;
      }).join(' + ') + (r.station === 'furnace' ? ' + fuel' : '');
      el.innerHTML = `<canvas width="32" height="32"></canvas>
        <div class="r-txt"><b>${nameOf(r.out)}${r.count > 1 ? ' ×' + r.count : ''}</b><span>${needs}</span></div>`;
      const g = el.querySelector('canvas').getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(iconFor(r.out), 2, 2, 28, 28);
      if (ok) el.onclick = () => { this.onCraft?.(r); this.refresh(); };
      list.appendChild(el);
    }
    panel.appendChild(list);
    if (!this.station) {
      const hint = document.createElement('div');
      hint.className = 'side-hint';
      hint.textContent = 'More recipes at a crafting table. Furnaces smelt ore and cook food.';
      panel.appendChild(hint);
    }
  }

  _renderPalette() {
    const panel = $('inv-side');
    panel.innerHTML = '<div class="side-head">EVERY BLOCK — click to grab a stack</div>';
    const grid = document.createElement('div');
    grid.className = 'palette';
    const ids = [];
    for (const id of Object.values(B)) if (id !== B.air) ids.push(id);
    for (const id of [I.bedroll, I.diamondSword, I.diamondPick, I.diamondAxe, I.diamondShovel, I.porkchop, I.cookedPorkchop, I.apple]) ids.push(id);
    for (const id of ids) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.title = nameOf(id);
      el.innerHTML = '<canvas width="32" height="32"></canvas><span class="n"></span><div class="dur"></div>';
      const g = el.querySelector('canvas').getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(iconFor(id), 2, 2, 28, 28);
      el.onclick = () => {
        const tool = ITEMS[id]?.tool;
        this.cursor = tool ? { id, n: 1, uses: tool.uses } : { id, n: STACK_MAX(id) };
        this.refresh();
      };
      el.oncontextmenu = (e) => { e.preventDefault(); this.cursor = null; this.refresh(); };
      grid.appendChild(el);
    }
    panel.appendChild(grid);
  }

  // -------------------------------------------------- overlays
  showDeath(cause) {
    $('death-cause').textContent = cause;
    $('death').classList.add('show');
  }
  hideDeath() { $('death').classList.remove('show'); }

  damageFlash() {
    const v = $('vignette');
    v.classList.remove('hurt');
    void v.offsetWidth;
    v.classList.add('hurt');
  }

  setDebug(text) {
    const d = $('debug');
    d.style.display = text ? 'block' : 'none';
    if (text) d.textContent = text;
  }
}
