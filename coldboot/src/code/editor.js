// A code editor drawn in the TV picture. Typing goes to a hidden <textarea>
// (#code-input) so selection, paste, undo and keyboard layouts all behave like
// a real editor; we read its value/selection every frame and draw it with
// Python syntax highlighting, line numbers and a blinking cursor.
import { input } from '../core/input.js';
import { MONO_FONT } from '../core/ui.js';

const KW = new Set(['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'is', 'None', 'True', 'False', 'break', 'continue', 'pass', 'import', 'from', 'as', 'lambda', 'global', 'try', 'except', 'del', 'assert', 'class', 'with']);
const BI = new Set(['print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'sorted', 'reversed', 'enumerate', 'zip', 'min', 'max', 'sum', 'abs', 'round', 'chr', 'ord', 'hex', 'bin', 'any', 'all', 'map', 'filter', 'isinstance', 'type', 'bool', 'send']);
const COL = { kw: '#ff7ab6', bi: '#7fe6ff', str: '#c3e88d', num: '#f78c6c', com: '#6a7a6a', op: '#89ddff', def: '#ffd166', txt: '#e8f0e8' };

function tokenize(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '#') { out.push([line.slice(i), 'com']); break; }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) { if (line[j] === '\\') j++; j++; }
      out.push([line.slice(i, j + 1), 'str']);
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) { let j = i; while (j < line.length && /[0-9._xa-fA-F]/.test(line[j])) j++; out.push([line.slice(i, j), 'num']); i = j; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i; while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
      const w = line.slice(i, j);
      const prev = out.length ? out[out.length - 1][0] : '';
      out.push([w, KW.has(w) ? 'kw' : BI.has(w) ? 'bi' : /def\s*$/.test(prev) ? 'def' : 'txt']);
      i = j;
      continue;
    }
    if (/[+\-*/%=<>!&|^~:()[\]{},.]/.test(ch)) { out.push([ch, 'op']); i++; continue; }
    out.push([ch, 'txt']);
    i++;
  }
  return out;
}

export class CodeEditor {
  constructor() {
    this.ta = document.getElementById('code-input');
    this.focused = false;
    this.scroll = 0;
    this.blink = 0;
    this.lastValue = '';
    this.fs = 15;
    this.lh = 21;
    this.box = { x: 0, y: 0, w: 600, h: 400 };
    this._onKey = (e) => {
      if (!this.focused) return;
      const ta = this.ta;
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart, en = ta.selectionEnd;
        ta.setRangeText('    ', s, en, 'end');
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const s = ta.selectionStart;
        const before = ta.value.slice(0, s);
        const line = before.slice(before.lastIndexOf('\n') + 1);
        let ind = line.match(/^\s*/)[0];
        if (/:\s*(#.*)?$/.test(line)) ind += '    ';
        ta.setRangeText('\n' + ind, s, ta.selectionEnd, 'end');
      } else if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
        // delete a whole indent level at once
        const s = ta.selectionStart;
        const before = ta.value.slice(0, s);
        const line = before.slice(before.lastIndexOf('\n') + 1);
        if (line.length >= 4 && /^ +$/.test(line) && line.length % 4 === 0) {
          e.preventDefault();
          ta.setRangeText('', s - 4, s, 'end');
        }
      } else if (e.key === 'Escape') {
        this.blur();
      }
      e.stopPropagation();
    };
    this.ta.addEventListener('keydown', this._onKey);
  }

  get value() { return this.ta.value; }
  set value(v) { this.ta.value = v; this.ta.selectionStart = this.ta.selectionEnd = v.length; this.scroll = 0; }

  focus() {
    this.focused = true;
    input.textCapture = true;
    input.releasePointer();
    this.ta.focus({ preventScroll: true });
  }

  blur() {
    this.focused = false;
    input.textCapture = null;
    this.ta.blur();
  }

  dispose() { this.blur(); this.ta.removeEventListener('keydown', this._onKey); }

  /** Map a UI-space click to a caret position. */
  click(mx, my) {
    const b = this.box;
    if (mx < b.x || mx > b.x + b.w || my < b.y || my > b.y + b.h) return false;
    const lines = this.ta.value.split('\n');
    const row = Math.max(0, Math.min(lines.length - 1, Math.floor((my - b.y - 8) / this.lh) + this.scroll));
    const cw = this.fs * 0.6;
    const col = Math.max(0, Math.min(lines[row].length, Math.round((mx - b.x - 48) / cw)));
    let pos = 0;
    for (let i = 0; i < row; i++) pos += lines[i].length + 1;
    pos += col;
    this.focus();
    this.ta.selectionStart = this.ta.selectionEnd = pos;
    return true;
  }

  draw(ctx, x, y, w, h, dt, opts = {}) {
    this.box = { x, y, w, h };
    this.blink += dt;
    const ta = this.ta;
    const text = ta.value;
    const lines = text.split('\n');
    const visible = Math.floor((h - 16) / this.lh);
    // caret line
    const caret = ta.selectionStart;
    const caretRow = text.slice(0, caret).split('\n').length - 1;
    const caretCol = caret - (text.lastIndexOf('\n', caret - 1) + 1);
    if (caretRow < this.scroll) this.scroll = caretRow;
    if (caretRow >= this.scroll + visible) this.scroll = caretRow - visible + 1;
    if (text !== this.lastValue) { this.blink = 0; this.lastValue = text; }
    ctx.save();
    ctx.fillStyle = '#05100c';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = this.focused ? 'rgba(93,255,176,0.7)' : 'rgba(93,255,176,0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.font = `${this.fs}px ${MONO_FONT}`;
    ctx.textBaseline = 'alphabetic';
    const cw = ctx.measureText('M').width;
    const selA = Math.min(ta.selectionStart, ta.selectionEnd), selB = Math.max(ta.selectionStart, ta.selectionEnd);
    let off = 0;
    for (let i = 0; i < this.scroll; i++) off += lines[i].length + 1;
    for (let r = this.scroll; r < Math.min(lines.length, this.scroll + visible); r++) {
      const ly = y + 8 + (r - this.scroll) * this.lh;
      const line = lines[r];
      if (r === caretRow && this.focused) { ctx.fillStyle = 'rgba(93,255,176,0.06)'; ctx.fillRect(x + 1, ly, w - 2, this.lh); }
      if (opts.errorLine === r + 1) { ctx.fillStyle = 'rgba(255,64,72,0.18)'; ctx.fillRect(x + 1, ly, w - 2, this.lh); }
      // selection
      const ls = off, le = off + line.length;
      if (selB > selA && selB > ls && selA <= le) {
        const a = Math.max(selA, ls) - ls, b = Math.min(selB, le + 1) - ls;
        ctx.fillStyle = 'rgba(127,230,255,0.28)';
        ctx.fillRect(x + 48 + a * cw, ly + 2, Math.max(4, (b - a) * cw), this.lh - 2);
      }
      ctx.fillStyle = 'rgba(160,200,170,0.35)';
      ctx.textAlign = 'right';
      ctx.fillText(String(r + 1), x + 36, ly + this.fs + 1);
      ctx.textAlign = 'left';
      let cx = x + 48;
      for (const [tok, kind] of tokenize(line)) {
        ctx.fillStyle = COL[kind];
        ctx.fillText(tok, cx, ly + this.fs + 1);
        cx += tok.length * cw;
      }
      if (r === caretRow && this.focused && Math.floor(this.blink * 2) % 2 === 0) {
        ctx.fillStyle = '#5dffb0';
        ctx.fillRect(x + 48 + caretCol * cw, ly + 3, 2, this.lh - 4);
      }
      off += line.length + 1;
    }
    if (!this.focused && !text) {
      ctx.fillStyle = 'rgba(160,200,170,0.4)';
      ctx.fillText('click here and type…', x + 48, y + 8 + this.fs + 1);
    }
    ctx.restore();
  }
}
