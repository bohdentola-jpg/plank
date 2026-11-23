// SNAKE LAB — the app: editor, PIXEL-8 console, lesson runner and the Snake engine
// that plays the game with the player's own Python functions.
const { PyVM, PyTuple } = window.Py;

const N = 16;
const COLORS = {
  black: null, off: null, none: null,
  white: '#f4f4ef', gray: '#8b93a0', grey: '#8b93a0', silver: '#c3c9d1',
  red: '#ff4f4f', orange: '#ff9a3d', yellow: '#ffd93b', gold: '#e6b53a',
  green: '#46cf5b', lime: '#b8f24b', teal: '#2fb5a4', cyan: '#4fd9e8',
  blue: '#4f7fff', navy: '#3a48a8', purple: '#9f6cff', pink: '#ff7ac6',
  brown: '#9c6a44', beige: '#e9d8b4',
};
const COLOR_NAMES = Object.keys(COLORS).filter((k) => COLORS[k] && k !== 'grey');
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ storage
const KEY = 'snakelab.v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
const S = Object.assign({ at: 0, done: {}, code: {}, kit: {}, best: 0, sound: true, shown: {} }, load() || {});
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode: progress lasts this visit */ } }

// -------------------------------------------------------------------- sound
let AC = null;
function beep(kind) {
  if (!S.sound) return;
  try {
    AC ||= new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime;
    const tone = (f, at, dur, type = 'square', vol = 0.06, f2) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + at);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + dur);
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(vol, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(AC.destination);
      o.start(t + at); o.stop(t + at + dur + 0.02);
    };
    if (kind === 'run') tone(660, 0, 0.06, 'square', 0.035);
    if (kind === 'ok') { tone(523, 0, 0.1); tone(659, 0.09, 0.1); tone(784, 0.18, 0.18); }
    if (kind === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14, 'square', 0.05)); }
    if (kind === 'err') tone(180, 0, 0.22, 'sawtooth', 0.045, 110);
    if (kind === 'eat') tone(880, 0, 0.07, 'square', 0.045, 1320);
    if (kind === 'crash') tone(300, 0, 0.45, 'sawtooth', 0.06, 60);
    if (kind === 'turn') tone(440, 0, 0.025, 'triangle', 0.02);
  } catch { /* no audio: that's fine */ }
}

// ------------------------------------------------------------------- screen
const screen = new Array(N * N).fill(null);   // hex colour or null (off)
let ghost = null;          // Map idx -> hex: the picture a draw lesson wants
let blink = [];            // cells to flash (a mismatch)
let blinkT = 0;
let sweepT = -1;           // celebration sweep
let hover = -1;
let flashRed = 0;
const cv = $('screen'), cx = cv.getContext('2d');

function idx(x, y) { return y * N + x; }
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k), g = Math.min(255, ((n >> 8) & 255) * k), b = Math.min(255, (n & 255) * k);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function drawScreen(now) {
  const W = cv.width, pad = 6, gap = 5;
  const cell = (W - pad * 2 - gap * (N - 1)) / N;
  cx.fillStyle = '#07090b';
  cx.fillRect(0, 0, W, W);
  const sweep = sweepT >= 0 ? (now - sweepT) / 900 : -1;
  if (sweep > 1.4) sweepT = -1;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      const px = pad + x * (cell + gap), py = pad + y * (cell + gap);
      let c = screen[i];
      const g = ghost && ghost.get(i);
      cx.save();
      roundRect(px, py, cell, cell, 6);
      if (c) {
        let k = 1;
        if (sweep >= 0) { const d = Math.abs(sweep * 2.2 - (x + y) / 15); if (d < 0.25) k = 1.25 + (0.25 - d) * 3; }
        cx.shadowColor = c; cx.shadowBlur = 16;
        cx.fillStyle = k !== 1 ? shade(c, k) : c;
        cx.fill();
        cx.shadowBlur = 0;
        // a little highlight
        cx.fillStyle = 'rgba(255,255,255,0.16)';
        roundRect(px + 3, py + 3, cell - 6, cell * 0.32, 4);
        cx.fill();
      } else {
        let base = '#121820';
        if (sweep >= 0) { const d = Math.abs(sweep * 2.2 - (x + y) / 15); if (d < 0.18) base = '#2a3a2f'; }
        cx.fillStyle = base;
        cx.fill();
        if (g) {
          cx.globalAlpha = 0.18; cx.fillStyle = g; cx.fill();
          cx.globalAlpha = 0.85; cx.lineWidth = 3; cx.setLineDash([7, 5]); cx.strokeStyle = g;
          roundRect(px + 2.5, py + 2.5, cell - 5, cell - 5, 5); cx.stroke();
          cx.setLineDash([]); cx.globalAlpha = 1;
        }
      }
      if (blink.length && now < blinkT && blink.includes(i) && Math.floor(now / 180) % 2 === 0) {
        cx.lineWidth = 4; cx.strokeStyle = '#ff6b6b';
        roundRect(px + 1, py + 1, cell - 2, cell - 2, 6); cx.stroke();
      }
      if (i === hover) {
        cx.lineWidth = 2.5; cx.strokeStyle = 'rgba(255,255,255,0.65)';
        roundRect(px + 1, py + 1, cell - 2, cell - 2, 6); cx.stroke();
      }
      cx.restore();
    }
  }
  if (flashRed > 0) { cx.fillStyle = `rgba(255,60,60,${flashRed * 0.35})`; cx.fillRect(0, 0, W, W); }
}
function roundRect(x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y); cx.lineTo(x + w - r, y); cx.quadraticCurveTo(x + w, y, x + w, y + r);
  cx.lineTo(x + w, y + h - r); cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  cx.lineTo(x + r, y + h); cx.quadraticCurveTo(x, y + h, x, y + h - r);
  cx.lineTo(x, y + r); cx.quadraticCurveTo(x, y, x + r, y); cx.closePath();
}
function cellAt(ev) {
  const r = cv.getBoundingClientRect();
  const fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
  const x = Math.floor(fx * N), y = Math.floor(fy * N);
  return x >= 0 && x < N && y >= 0 && y < N ? [x, y] : null;
}
cv.addEventListener('pointermove', (e) => {
  const c = cellAt(e);
  hover = c ? idx(c[0], c[1]) : -1;
  if (!game.on) $('statusL').textContent = c ? `x ${c[0]}, y ${c[1]}` : 'x –, y –';
});
cv.addEventListener('pointerleave', () => { hover = -1; if (!game.on) $('statusL').textContent = 'x –, y –'; });

const READY = '<b>Ready</b><small>Press Play, then steer with the arrow keys</small>';
function overlay(html) { $('overlay').innerHTML = html ? `<div>${html}</div>` : ''; }
function led(state) { $('led').className = 'led' + (state ? ' ' + state : ''); }

// ------------------------------------------------------------------- python
let rec = null;   // when set, pixel()/clear() are recorded for the drawing animation
class HostError extends Error { constructor(type, msg) { super(msg); this.pyType = type; } }
function colorOf(c) {
  if (c === null || c === undefined) return COLORS.white;
  if (typeof c !== 'string') throw new HostError('TypeError', `the colour should be text in quotes, like "red", not ${typeof c === 'number' ? c : 'that'}`);
  const k = c.trim().toLowerCase();
  if (k in COLORS) return COLORS[k];
  if (/^#[0-9a-f]{6}$/.test(k)) return k;
  if (/^#[0-9a-f]{3}$/.test(k)) return '#' + k.slice(1).split('').map((d) => d + d).join('');
  const near = COLOR_NAMES.map((n) => [n, editDistance(k, n)]).sort((a, b) => a[1] - b[1])[0];
  throw new HostError('ValueError', `the PIXEL-8 doesn't know the colour "${c}"${near && near[1] <= 2 ? `. Did you mean "${near[0]}"?` : `. Try one of: ${COLOR_NAMES.join(', ')}`}`);
}
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function coord(v, which) {
  if (v === undefined) throw new HostError('TypeError', `pixel() is missing its ${which}. Write it like pixel(3, 4, "red")`);
  if (typeof v === 'bigint') throw new HostError('ValueError', `${which} must be between 0 and 15, but it was ${v}`);
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new HostError('TypeError', `pixel() needs whole numbers for x and y, but ${which} was ${typeof v === 'number' ? v : typeof v === 'string' ? `the text "${v}"` : typeof v === 'boolean' ? (v ? 'True' : 'False') : 'not a number'}`);
  }
  if (v < 0 || v > 15) throw new HostError('ValueError', `${which} must be between 0 and 15, but it was ${v}`);
  return v;
}
function newVM(opts = {}) {
  const vm = new PyVM({ maxSteps: 400000, onPrint: opts.quiet ? null : (line) => printLine(line) });
  vm.defineNative('pixel', (x, y, color, ...extra) => {
    if (extra.length) throw new HostError('TypeError', `pixel() takes 3 arguments (x, y and the colour) but got ${3 + extra.length}`);
    const i = idx(coord(x, 'x'), coord(y, 'y'));
    const c = colorOf(color);
    if (rec) rec.push([i, c]); else screen[i] = c;
    return null;
  }, { params: ['x', 'y', 'color'], doc: 'pixel(x, y, color="white")\nLight the pixel at column x and row y (0 to 15) in a colour, like "red" or "#ff8800".' });
  vm.defineNative('clear', () => {
    if (rec) rec.push(['clear']); else screen.fill(null);
    return null;
  }, { doc: 'clear()\nTurn every pixel off.' });
  return vm;
}
const T = (p) => new PyTuple([p[0], p[1]]);   // a JS [x, y] as a Python tuple

// ------------------------------------------------------------------- editor
const src = $('src'), hl = $('hl'), gutter = $('gutter');
const KW = new Set('and as assert break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
const CONST = new Set(['True', 'False', 'None']);
const BI = new Set('print range len min max abs int str float list tuple dict set sorted sum enumerate zip round type isinstance bool reversed any all map filter input help repr'.split(' '));
const API = new Set(['pixel', 'clear']);
let errLine = null;
function hlLine(line) {
  const re = /(#.*$)|([fFrRbB]{0,2}"(?:[^"\\]|\\.)*"?|[fFrRbB]{0,2}'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|([^\sA-Za-z0-9_#'"]+)/g;
  let out = '', m, prevDef = false;
  while ((m = re.exec(line))) {
    const t = m[0], e = esc(t);
    if (m[1]) out += `<span class="t-com">${e}</span>`;
    else if (m[2]) out += `<span class="t-str">${e}</span>`;
    else if (m[3]) out += `<span class="t-num">${e}</span>`;
    else if (m[4]) {
      if (prevDef) { out += `<span class="t-def">${e}</span>`; prevDef = false; continue; }
      if (CONST.has(t)) out += `<span class="t-const">${e}</span>`;
      else if (KW.has(t)) { out += `<span class="t-kw">${e}</span>`; if (t === 'def') prevDef = true; continue; }
      else if (API.has(t)) out += `<span class="t-api">${e}</span>`;
      else if (BI.has(t)) out += `<span class="t-bi">${e}</span>`;
      else out += e;
    } else if (m[6]) out += `<span class="t-op">${e}</span>`;
    else out += e;
    if (!m[5]) prevDef = false;
  }
  return out;
}
function renderEditor() {
  const lines = src.value.split('\n');
  // one spare line keeps the highlight layer at least as tall as the textarea, so scrolls stay in step
  hl.innerHTML = lines.map((l, i) => `<span class="ln${errLine === i + 1 ? ' err' : ''}">${hlLine(l) || ' '}</span>`).join('') + '<span class="ln"> </span>';
  gutter.innerHTML = `<div>${lines.map((_, i) => `<div${errLine === i + 1 ? ' class="err"' : ''}>${i + 1}</div>`).join('')}</div>`;
  syncScroll();
}
function syncScroll() {
  hl.scrollTop = src.scrollTop;
  hl.scrollLeft = src.scrollLeft;
  const g = gutter.firstChild;
  if (g) g.style.transform = `translateY(${-src.scrollTop}px)`;
}
function setErr(line) { errLine = line; renderEditor(); }
let saveTimer = null;
src.addEventListener('input', () => {
  if (errLine) errLine = null;
  renderEditor();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { S.code[LESSONS[S.at].id] = src.value; save(); }, 300);
});
src.addEventListener('scroll', syncScroll);
function insertText(text) {
  src.focus();
  if (!document.execCommand || !document.execCommand('insertText', false, text)) {
    const a = src.selectionStart, b = src.selectionEnd;
    src.setRangeText(text, a, b, 'end');
    src.dispatchEvent(new Event('input'));
  }
}
src.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
  const v = src.value, a = src.selectionStart, b = src.selectionEnd;
  const lineStart = v.lastIndexOf('\n', a - 1) + 1;
  if (e.key === 'Tab') {
    e.preventDefault();
    if (a !== b && v.slice(a, b).includes('\n')) {
      // indent or dedent every selected line
      const s0 = lineStart, endLine = v.indexOf('\n', b - 1 >= s0 ? b - 1 : b);
      const s1 = endLine < 0 ? v.length : endLine;
      const block = v.slice(s0, s1).split('\n');
      const out = block.map((l) => (e.shiftKey ? l.replace(/^ {1,4}/, '') : '    ' + l)).join('\n');
      src.setSelectionRange(s0, s1);
      insertText(out);
      src.setSelectionRange(s0, s0 + out.length);
    } else if (e.shiftKey) {
      const m = /^ {1,4}/.exec(v.slice(lineStart));
      if (m) { src.setSelectionRange(lineStart, lineStart + m[0].length); insertText(''); src.setSelectionRange(Math.max(lineStart, a - m[0].length), Math.max(lineStart, a - m[0].length)); }
    } else {
      const col = a - lineStart;
      insertText(' '.repeat(4 - (col % 4)));
    }
    return;
  }
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    e.preventDefault();
    const line = v.slice(lineStart, a);
    let ind = /^ */.exec(line)[0].length;
    const code = line.replace(/#.*$/, '').trimEnd();
    if (code.endsWith(':')) ind += 4;
    else if (/^\s*(return\b|pass\s*$|break\s*$|continue\s*$)/.test(line)) ind = Math.max(0, ind - 4);
    insertText('\n' + ' '.repeat(ind));
    return;
  }
  if (e.key === 'Backspace' && a === b && a > lineStart) {
    const before = v.slice(lineStart, a);
    if (/^ +$/.test(before)) {
      e.preventDefault();
      const n = before.length % 4 || 4;
      src.setSelectionRange(a - n, a);
      insertText('');
    }
  }
});

// ------------------------------------------------------------------ console
const con = $('console');
function cnode(cls, html) {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  con.appendChild(d);
  con.scrollTop = con.scrollHeight;
  return d;
}
let printed = 0;
function printLine(line) {
  if (++printed > 400) { if (printed === 401) cnode('c-sys', '… (more output hidden)'); return; }
  cnode('c-out', esc(line) || '&nbsp;');
}
function clearConsole() { con.innerHTML = ''; printed = 0; }
$('clearBtn').onclick = clearConsole;

function defNames(code) { return new Set([...code.matchAll(/^[ \t]*(?:def|class)\s+([A-Za-z_]\w*)/gm)].map((m) => m[1])); }
/**
 * Show a Python error, and highlight its line when it's in the code on screen.
 * Every load() is compiled separately, so an error's line number belongs to whichever
 * piece raised it: the editor, a function from an earlier lesson, or a test call.
 */
function showError(err, ctx = {}) {
  led('err');
  beep('err');
  const mine = defNames(src.value);
  let where = (err.where || '<module>').split('.')[0];
  if (where.startsWith('<')) where = '<module>';
  const inEditor = ctx.inEditor !== false && (where !== '<module>' ? mine.has(where) : ctx.moduleIsEditor !== false);
  const lineTxt = err.line ? (inEditor ? ` on line ${err.line}` : where !== '<module>' ? ` in your ${where}() from an earlier lesson (line ${err.line} of it)` : '') : '';
  cnode('c-err', `${esc(err.text)}${lineTxt}${ctx.during ? `<br><span class="c-sys">while running ${esc(ctx.during)}</span>` : ''}`);
  if (err.hint) cnode('c-hint', '💡 ' + esc(err.hint));
  if (inEditor && err.line) setErr(err.line);
}
function pass(L, extra = '') {
  led('on');
  const first = !S.done[L.id];
  S.done[L.id] = true;
  save();
  sweepT = performance.now();
  beep(first ? 'win' : 'ok');
  const last = S.at === LESSONS.length - 1;
  cnode('c-win', `<b>${L.kind === 'sandbox' ? 'It runs!' : 'Lesson complete!'}</b> ${extra}`);
  $('nextBtn').hidden = last;
  if (first) toast(L.kind === 'sandbox' ? 'Your game is ready to play' : `Lesson ${S.at + 1} done`);
  renderMap();
}
function fail(msg) {
  led('err');
  beep('err');
  cnode('c-fail', msg);
}
let toastT = null;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ------------------------------------------------------------------ lessons
const KIT_ORDER = LESSONS.filter((l) => l.provides).map((l) => l.provides);
function unlocked(i) { return i === 0 || !!S.done[LESSONS[i - 1].id] || !!S.done[LESSONS[i].id]; }
function renderMap() {
  const map = $('map');
  map.innerHTML = '';
  let chap = null, group = null;
  LESSONS.forEach((L, i) => {
    if (L.chapter !== chap) {
      chap = L.chapter;
      group = document.createElement('div');
      group.className = 'chap';
      group.innerHTML = `<span>${esc(chap)}</span>`;
      map.appendChild(group);
    }
    const b = document.createElement('button');
    b.className = 'dot' + (S.done[L.id] ? ' done' : '') + (i === S.at ? ' cur' : '');
    b.textContent = i + 1;
    b.title = `${i + 1}. ${L.title}${unlocked(i) ? '' : ' (locked)'}`;
    b.disabled = !unlocked(i);
    b.onclick = () => showLesson(i);
    group.appendChild(b);
  });
}
/** How many brackets a line leaves open (strings and comments skipped). */
function bracketDelta(line) {
  let d = 0, q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '#') break;
    if (c === '"' || c === "'") q = c;
    else if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) d--;
  }
  return d;
}
/**
 * The reusable part of a lesson's code: its top-level defs, classes, imports and
 * assignments (with the comments right above them), leaving out the calls and
 * prints that were only there to try things out.
 */
function kitCode(code) {
  const blocks = [];
  let cur = null, pending = [], depth = 0;
  for (const line of code.replace(/\s+$/, '').split('\n')) {
    if (depth > 0 && cur) { cur.push(...pending, line); pending = []; }
    else if (!line.trim() || line.startsWith('#')) { pending.push(line); continue; }
    else if (/^\s/.test(line)) { if (cur) cur.push(...pending, line); pending = []; }
    else {
      let k = pending.length;
      while (k > 0 && pending[k - 1].startsWith('#')) k--;
      if (cur) cur.push(...pending.slice(0, k));
      cur = [...pending.slice(k), line];
      blocks.push(cur);
      pending = [];
    }
    depth = Math.max(0, depth + bracketDelta(line));
  }
  const first = (b) => b.find((l) => !l.startsWith('#')) || '';
  const keep = blocks.filter((b) => /^(def|class|import|from|@)/.test(first(b)) || /^[A-Za-z_]\w*(\s*,\s*[A-Za-z_]\w*)*\s*(:[^=]*)?=(?!=)/.test(first(b)));
  const out = keep.map((b) => { while (b.length && !b[b.length - 1].trim()) b.pop(); return b.join('\n'); }).join('\n\n');
  return out || code;
}
function kitPiece(name) {
  if (S.kit[name]) return S.kit[name];
  const L = LESSONS.find((l) => l.provides === name);
  return kitCode(L.solution);
}
/** Function names earlier lessons hand to lesson i. */
function kitFor(i) {
  return KIT_ORDER.filter((name) => LESSONS.findIndex((l) => l.provides === name) < i);
}
function loadKit(vm, i) {
  for (const name of kitFor(i)) {
    const r = vm.load(kitPiece(name));
    if (!r.ok) return { name, error: r.error };
  }
  return null;
}
function sandboxStarter() {
  const titles = { draw: 'paints the screen', step: 'where the head goes next', hits_wall: 'is that spot off the screen?', move: 'the snake slithers (and grows)', bites_itself: 'did it bite itself?', speed: 'moves per second' };
  return '# Your SNAKE: every function you wrote, in one place.\n# Change the rules, press Run, then Play.\n\n' +
    KIT_ORDER.map((n) => `# ---- ${n}: ${titles[n] || ''}\n${kitPiece(n)}`).join('\n\n\n') + '\n';
}
function starterFor(L) { return L.kind === 'sandbox' ? sandboxStarter() : L.starter; }

function showLesson(i) {
  if (i < 0 || i >= LESSONS.length || !unlocked(i)) return;
  stopGame(true);
  S.at = i;
  save();
  const L = LESSONS[i];
  $('eyebrow').textContent = `Lesson ${i + 1} of ${LESSONS.length} · ${L.chapter}`;
  $('title').textContent = L.title;
  $('story').innerHTML = L.story;
  $('task').innerHTML = L.task;
  const cc = $('concept');
  cc.querySelector('summary').textContent = L.concept[0];
  cc.querySelector('div').innerHTML = L.concept[1];
  $('hints').innerHTML = '';
  const shown = S.shown[L.id] || 0;
  for (let h = 0; h < shown; h++) addHint(L, h);
  $('hintBtn').hidden = shown >= L.hints.length;
  $('solveBtn').hidden = !(shown >= L.hints.length && L.solution);
  $('nextBtn').hidden = !S.done[L.id] || i === LESSONS.length - 1;
  $('prevBtn').disabled = i === 0;
  const kit = kitFor(i);
  $('toolkitNote').innerHTML = L.kind === 'func' && kit.length ? `also loaded: ${kit.map((n) => `<code>${n}()</code>`).join(' ')}` : '';
  src.value = S.code[L.id] ?? starterFor(L);
  errLine = null;
  src.scrollTop = 0;
  renderEditor();
  clearConsole();
  // the device
  screen.fill(null);
  sweepT = -1;
  ghost = L.kind === 'draw' ? new Map(L.target.map(([x, y, c]) => [idx(x, y), COLORS[c]])) : null;
  blink = [];
  led(null);
  playReady = (L.kind === 'func' || L.kind === 'sandbox') && !!S.done[L.id];
  updatePlay();
  if (L.kind === 'func' || L.kind === 'sandbox') overlay(playReady ? READY : `<b>${L.kind === 'sandbox' ? 'Run your game' : 'Pass the tests'}</b><small>then you can Play it here</small>`);
  else if (L.kind === 'output') overlay(S.done[L.id] ? '' : '<b>Listening…</b><small>What you print() appears in the console</small>');
  else overlay('');
  if (L.kind === 'output' && S.done[L.id]) showOff(L, true);
  $('statusR').textContent = L.play ? `best ${S.best}` : '';
  renderMap();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function addHint(L, h) {
  const d = document.createElement('div');
  d.className = 'hint';
  d.innerHTML = `<b>Hint ${h + 1}.</b> ${L.hints[h]}`;
  $('hints').appendChild(d);
}
$('hintBtn').onclick = () => {
  const L = LESSONS[S.at];
  const n = S.shown[L.id] || 0;
  if (n >= L.hints.length) return;
  addHint(L, n);
  S.shown[L.id] = n + 1;
  save();
  $('hintBtn').hidden = n + 1 >= L.hints.length;
  $('solveBtn').hidden = !(n + 1 >= L.hints.length && L.solution);
};
$('solveBtn').onclick = () => {
  const L = LESSONS[S.at];
  if (!L.solution) return;
  const d = document.createElement('div');
  d.className = 'hint';
  d.innerHTML = `<b>One way to do it:</b><pre>${esc(L.solution)}</pre><button class="btn" id="useSol">Put this in the editor</button>`;
  $('hints').appendChild(d);
  $('solveBtn').hidden = true;
  d.querySelector('#useSol').onclick = () => { src.value = L.solution; S.code[L.id] = src.value; save(); setErr(null); src.focus(); };
};
$('prevBtn').onclick = () => showLesson(S.at - 1);
$('nextBtn').onclick = () => showLesson(S.at + 1);
$('resetBtn').onclick = () => {
  const L = LESSONS[S.at];
  if (src.value !== starterFor(L) && !confirm('Put the starting code back? Your changes in this lesson will be lost.')) return;
  src.value = starterFor(L);
  delete S.code[L.id];
  save();
  setErr(null);
};
$('soundBtn').onclick = () => { S.sound = !S.sound; save(); $('soundBtn').textContent = `Sound: ${S.sound ? 'on' : 'off'}`; };
$('runBtn').onclick = () => run();

// ---------------------------------------------------------------- the runner
let anim = null;   // the drawing animation in progress
function run() {
  stopGame(true);
  if (anim) { anim.cancel(); anim = null; }
  clearConsole();
  setErr(null);
  blink = [];
  sweepT = -1;
  led('busy');
  beep('run');
  showDevice();
  const L = LESSONS[S.at];
  S.code[L.id] = src.value;
  save();
  try {
    if (L.kind === 'output') runOutput(L);
    else if (L.kind === 'draw') runDraw(L);
    else if (L.kind === 'drawfn') runDrawFn(L);
    else if (L.kind === 'func') runFunc(L);
    else runSandbox(L);
  } catch (e) {
    console.error(e);
    cnode('c-err', 'Something went wrong inside Snake Lab itself: ' + esc(String(e && e.message || e)));
  }
}

/** In the one-column (phone) layout the PIXEL-8 and the console sit below the editor: bring them into view. */
function showDevice() {
  if (window.innerWidth >= 1180) return;
  const d = $('device').getBoundingClientRect();
  if (d.top < 0 || d.top > window.innerHeight * 0.5) $('device').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function runOutput(L) {
  const vm = newVM();
  const r = vm.load(src.value);
  if (!r.ok) return showError(r.error);
  if (!r.output.length) cnode('c-sys', '(nothing was printed)');
  const problem = L.expect(r.output, vm);
  if (problem) fail(problem);
  else { overlay(''); pass(L, 'The PIXEL-8 understood you.'); showOff(L); }
}
const SMILE = [[5, 4], [5, 5], [5, 6], [10, 4], [10, 5], [10, 6], [3, 9], [4, 10], [5, 11], [6, 12], [7, 12], [8, 12], [9, 12], [10, 11], [11, 10], [12, 9]];
const RAINBOW = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'purple', 'pink'];
/** A little light show when an output lesson passes: a smile, or (for "256 pixels") every light at once. */
function showOff(L, instant) {
  const ops = [];
  if (L.id === 'count') {
    for (let d = 0; d < 31; d++) for (let y = 0; y < N; y++) { const x = d - y; if (x >= 0 && x < N) ops.push([idx(x, y), COLORS[RAINBOW[Math.floor(d / 3.1)]]]); }
  } else {
    for (const [x, y] of SMILE) ops.push([idx(x, y), COLORS[L.id === 'name' ? 'cyan' : 'yellow']]);
  }
  screen.fill(null);
  if (instant) { for (const [i, c] of ops) screen[i] = c; return; }
  if (anim) anim.cancel();
  anim = animate(ops, () => { anim = null; });
}

function runDraw(L) {
  screen.fill(null);
  rec = [];
  const vm = newVM();
  let r;
  try { r = vm.load(src.value); } finally { var ops = rec; rec = null; }
  anim = animate(ops, () => {
    anim = null;
    if (!r.ok) return showError(r.error);
    const { wrong, missing, extra } = compareTarget(L.target);
    if (!wrong.length && !missing.length && !extra.length) return pass(L, 'Exactly the picture it wanted.');
    blink = [...wrong, ...missing, ...extra];
    blinkT = performance.now() + 2600;
    fail(describeDiff(wrong, missing, extra, L.target));
  });
}
function animate(ops, done) {
  let i = 0, cancelled = false;
  const per = Math.max(6, Math.min(140, 900 / Math.max(1, ops.length)));
  let last = performance.now();
  const stepFn = (now) => {
    if (cancelled) return;
    const n = Math.max(1, Math.floor((now - last) / per));
    if (now - last >= per || i === 0) {
      last = now;
      for (let k = 0; k < n && i < ops.length; k++, i++) {
        const op = ops[i];
        if (op[0] === 'clear') screen.fill(null); else screen[op[0]] = op[1];
      }
    }
    if (i < ops.length) requestAnimationFrame(stepFn);
    else done();
  };
  if (!ops.length) setTimeout(done, 60); else requestAnimationFrame(stepFn);
  return { cancel() { cancelled = true; for (; i < ops.length; i++) { const op = ops[i]; if (op[0] === 'clear') screen.fill(null); else screen[op[0]] = op[1]; } } };
}
function compareTarget(target) {
  const want = new Map(target.map(([x, y, c]) => [idx(x, y), COLORS[c]]));
  const wrong = [], missing = [], extra = [];
  for (let i = 0; i < N * N; i++) {
    const w = want.get(i) || null, c = screen[i];
    if (w && !c) missing.push(i);
    else if (!w && c) extra.push(i);
    else if (w && c && w !== c) wrong.push(i);
  }
  return { wrong, missing, extra };
}
const nameOf = (hex) => Object.keys(COLORS).find((k) => COLORS[k] === hex && k !== 'grey') || hex;
const xy = (i) => `(${i % N}, ${Math.floor(i / N)})`;
function describeDiff(wrong, missing, extra, target) {
  const want = new Map(target.map(([x, y, c]) => [idx(x, y), c]));
  const right = target.length - wrong.length - missing.length;
  const parts = [`<b>${right} of ${target.length}</b> pixels are right.`];
  if (missing.length) parts.push(`Still dark: ${missing.slice(0, 4).map(xy).join(', ')}${missing.length > 4 ? ` and ${missing.length - 4} more` : ''}.`);
  if (wrong.length) { const i = wrong[0]; parts.push(`${xy(i)} should be ${want.get(i)}, but it's ${nameOf(screen[i])}${wrong.length > 1 ? ` (and ${wrong.length - 1} more in the wrong colour)` : ''}.`); }
  if (extra.length) parts.push(`Lit but not wanted: ${extra.slice(0, 4).map(xy).join(', ')}${extra.length > 4 ? ` and ${extra.length - 4} more` : ''}.`);
  parts.push('The flashing squares show where.');
  return parts.join(' ');
}

function runDrawFn(L) {
  screen.fill(null);
  const vm = newVM();
  const r = vm.load(src.value);
  if (!r.ok) return showError(r.error);
  if (!vm.has('draw')) return fail('Your code needs a function called <code>draw</code>: keep the line <code>def draw(snake, apple):</code>');
  for (const [n, c] of L.cases.entries()) {
    screen.fill(null);
    if (n > 0) screen[idx(0, 0)] = COLORS.gray;   // leftovers from "last time": draw() must clear()
    const call = `draw(${pyList(c.snake)}, (${c.apple[0]}, ${c.apple[1]}))`;
    const res = vm.call('draw', [c.snake.map(T), T(c.apple)]);
    if (!res.ok) return showError(res.error, { during: call });
    const target = [[c.apple[0], c.apple[1], 'red'], ...c.snake.slice(1).map(([x, y]) => [x, y, 'green']), [c.snake[0][0], c.snake[0][1], 'lime']];
    const { wrong, missing, extra } = compareTarget(target);
    if (wrong.length || missing.length || extra.length) {
      blink = [...wrong, ...missing, ...extra];
      blinkT = performance.now() + 2600;
      const leftover = extra.includes(idx(0, 0)) && screen[idx(0, 0)] === COLORS.gray;
      return fail(`Test ${n + 1}: <code>${esc(call)}</code><br>${leftover ? 'A pixel from the previous picture was still lit: start <code>draw</code> with <code>clear()</code>.' : describeDiff(wrong, missing, extra, target)}`);
    }
    cnode('c-ok', `✓ ${esc(call)}`);
  }
  S.kit.draw = kitCode(src.value);
  pass(L, 'Your <code>draw()</code> is the game’s paintbrush now. Every later lesson uses it.');
}
function pyList(pts) { return '[' + pts.map((p) => `(${p[0]}, ${p[1]})`).join(', ') + ']'; }

function deepEq(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
  return a === b;
}
function runFunc(L) {
  const vm = newVM();
  const k = loadKit(vm, S.at);
  if (k) return showError(k.error, { inEditor: false });
  const r = vm.load(src.value);
  if (!r.ok) return showError(r.error);
  const fn = L.provides;
  if (!vm.has(fn)) return fail(`Your code needs a function called <code>${fn}</code>. Check the spelling on the <code>def</code> line.`);
  let passed = 0, firstFail = null;
  for (const t of L.tests) {
    const res = vm.load(`__r = ${t.call}\n__t = type(__r).__name__\n__rr = repr(__r)`);
    if (!res.ok) { showError(res.error, { during: t.call, moduleIsEditor: false }); return; }
    const v = vm.get('__r'), ty = vm.get('__t'), rr = vm.get('__rr');
    let ok = deepEq(v, t.expect);
    if (typeof t.expect === 'boolean') ok = ok && ty === 'bool';
    if (typeof t.expect === 'number') ok = ok && ty === 'int';
    if (ok) { passed++; cnode('c-ok', `✓ ${esc(t.call)} → ${esc(t.show)}`); }
    else {
      cnode('c-bad', `✗ ${esc(t.call)} gave ${esc(rr)}, expected ${esc(t.show)}`);
      firstFail ||= { t, rr, ty };
    }
  }
  if (firstFail) {
    let tip = '';
    if (firstFail.ty === 'NoneType') tip = ' It gave back <code>None</code>: is there a <code>return</code> for that case?';
    else if (typeof firstFail.t.expect === 'boolean' && firstFail.ty !== 'bool') tip = ' It should give back <code>True</code> or <code>False</code>.';
    else if (typeof firstFail.t.expect === 'number' && firstFail.ty === 'float') tip = ' It gave back a decimal (a float). <code>/</code> always does; <code>//</code> keeps whole numbers.';
    return fail(`<b>${passed} of ${L.tests.length}</b> tests pass.${tip}`);
  }
  S.kit[fn] = kitCode(src.value);
  playReady = true;
  updatePlay();
  overlay(READY);
  pass(L, `All ${L.tests.length} tests pass. Press <b>Play</b> on the PIXEL-8 and steer with the arrow keys.`);
}

function runSandbox(L) {
  const vm = newVM();
  const r = vm.load(src.value);
  if (!r.ok) return showError(r.error);
  const missing = ['draw', 'step'].filter((f) => !vm.has(f));
  if (missing.length) return fail(`The game needs ${missing.map((f) => `<code>${f}()</code>`).join(' and ')}.`);
  const optional = ['hits_wall', 'move', 'bites_itself', 'speed'].filter((f) => !vm.has(f));
  if (optional.length) cnode('c-sys', `Without ${optional.join(', ')} the game uses simple defaults for those.`);
  playReady = true;
  updatePlay();
  overlay(READY);
  const lines = src.value.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length;
  pass(L, `That's ${lines} lines of Python, and every one of them is yours. Press <b>Play</b> to try your rules.`);
}

// ------------------------------------------------------------------ the game
// Modes: dot (a single dot collecting apples), walls (+ hits_wall), snake (+ move,
// growing), full (+ bites_itself), speed (+ speed(score)).
const MODES = {
  dot: { walls: false, move: false, bite: false, speed: false },
  walls: { walls: true, move: false, bite: false, speed: false },
  snake: { walls: true, move: true, bite: false, speed: false },
  full: { walls: true, move: true, bite: true, speed: false },
  speed: { walls: true, move: true, bite: true, speed: true },
};
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const game = { on: false };
let playReady = false;
function updatePlay() {
  const L = LESSONS[S.at];
  const can = !!L.play && playReady;
  $('playBtn').disabled = !can;
  $('playBtn').textContent = game.on ? '■' : '▶';
  $('playLabel').textContent = game.on ? 'Stop' : 'Play';
}
function stopGame(quiet) {
  if (!game.on) return;
  game.on = false;
  game.alive = false;
  updatePlay();
  if (!quiet) overlay('<b>Stopped</b><small>Press Play to go again</small>');
}
function startGame() {
  const L = LESSONS[S.at];
  if (!L.play || !playReady) return;
  if (anim) { anim.cancel(); anim = null; }
  clearConsole();
  setErr(null);
  const vm = newVM();
  if (L.kind === 'func') {
    const k = loadKit(vm, S.at);
    if (k) return showError(k.error, { inEditor: false });
  }
  const r = vm.load(src.value);
  if (!r.ok) return showError(r.error);
  const mode = { ...MODES[L.play] };
  if (L.kind === 'sandbox') {
    mode.walls = vm.has('hits_wall'); mode.move = vm.has('move'); mode.bite = vm.has('bites_itself'); mode.speed = vm.has('speed');
  }
  Object.assign(game, {
    on: true, alive: true, started: false, vm, mode, lesson: L.id,
    snake: mode.move ? [[7, 8], [6, 8], [5, 8]] : [[7, 8]],
    dir: 'right', queue: [], score: 0, acc: 0, rate: 5,
  });
  game.apple = spawnApple();
  if (mode.speed && !updateRate()) return;
  if (!render()) return;
  overlay('<b>Ready?</b><small>Press an arrow key to start<br>(or W A S D, the pad, or swipe the screen)</small>');
  led('on');
  updatePlay();
  setStatus();
  $('device').focus();
}
function setStatus() {
  $('statusL').textContent = `apples ${game.score}`;
  $('statusR').textContent = `${game.mode.speed ? `${game.rate}/s · ` : ''}best ${S.best}`;
}
function spawnApple() {
  const taken = new Set(game.snake.map(([x, y]) => idx(x, y)));
  const free = [];
  for (let i = 0; i < N * N; i++) if (!taken.has(i)) free.push(i);
  const i = free[Math.floor(Math.random() * free.length)] ?? 0;
  return [i % N, Math.floor(i / N)];
}
/** Call one of the player's functions; on an error, stop the game and say so. */
function callUser(name, args, shown) {
  const res = game.vm.call(name, args);
  if (!res.ok) { crashOut(); showError(res.error, { during: shown, moduleIsEditor: false }); return { bad: true }; }
  return { v: res.value };
}
function crashOut() { game.alive = false; game.on = false; updatePlay(); }
function isPos(p) { return Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isInteger(n)); }
function show(v) {
  if (v === null || v === undefined) return 'None';
  if (Array.isArray(v)) return `(${v.map(show).join(', ')})`;
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}
function gameError(msg) { crashOut(); led('err'); beep('err'); fail(msg); overlay('<b>Stopped</b><small>See the console</small>'); }
function updateRate() {
  const r = callUser('speed', [game.score], `speed(${game.score})`);
  if (r.bad) return false;
  if (typeof r.v !== 'number' || !(r.v >= 1 && r.v <= 30)) { gameError(`<code>speed(${game.score})</code> gave back ${esc(show(r.v))}. It should be a number of moves per second, from 1 to 30.`); return false; }
  game.rate = r.v;
  return true;
}
function render() {
  screen.fill(null);
  const r = callUser('draw', [game.snake.map(T), T(game.apple)], `draw(snake, apple)`);
  return !r.bad;
}
function tick() {
  const g = game;
  if (g.queue.length) g.dir = g.queue.shift();
  const head = g.snake[0];
  const s = callUser('step', [T(head), g.dir], `step(${show(head)}, "${g.dir}")`);
  if (s.bad) return;
  if (!isPos(s.v)) return gameError(`<code>step(${esc(show(head))}, "${g.dir}")</code> gave back ${esc(show(s.v))}. It should give back a position like <code>(x, y)</code>${s.v === null ? ': is there a <code>return</code> for every direction?' : '.'}`);
  const nh = s.v;
  const off = nh[0] < 0 || nh[0] >= N || nh[1] < 0 || nh[1] >= N;
  if (g.mode.walls) {
    const w = callUser('hits_wall', [T(nh)], `hits_wall(${show(nh)})`);
    if (w.bad) return;
    if (typeof w.v !== 'boolean') return gameError(`<code>hits_wall(${esc(show(nh))})</code> gave back ${esc(show(w.v))}. It should give back <code>True</code> or <code>False</code>.`);
    if (w.v) return over('Crashed into the wall');
    if (off) return gameError(`The head went off the screen to ${esc(show(nh))}, but <code>hits_wall(${esc(show(nh))})</code> said <code>False</code>.`);
  } else if (off) {
    return over('Off the edge!', 'Next lesson: walls.');
  }
  const ate = nh[0] === g.apple[0] && nh[1] === g.apple[1];
  if (g.mode.move) {
    const m = callUser('move', [g.snake.map(T), T(nh), ate], `move(snake, ${show(nh)}, ${ate ? 'True' : 'False'})`);
    if (m.bad) return;
    if (!Array.isArray(m.v) || !m.v.length || !m.v.every(isPos)) return gameError(`<code>move(...)</code> gave back ${esc(show(m.v))}. It should give back the new list of positions, head first.`);
    g.snake = m.v;
  } else {
    g.snake = [nh];
  }
  if (g.mode.bite) {
    const b = callUser('bites_itself', [g.snake.map(T)], 'bites_itself(snake)');
    if (b.bad) return;
    if (typeof b.v !== 'boolean') return gameError(`<code>bites_itself(snake)</code> gave back ${esc(show(b.v))}. It should give back <code>True</code> or <code>False</code>.`);
    if (b.v) return over('You bit yourself!');
  }
  if (ate) {
    g.score++;
    beep('eat');
    g.apple = spawnApple();
    if (g.mode.speed && !updateRate()) return;
  }
  if (!render()) return;
  setStatus();
}
function over(why, extra) {
  const g = game;
  g.alive = false;
  g.on = false;
  flashRed = 1;
  beep('crash');
  led('err');
  const best = g.score > S.best;
  if (best) { S.best = g.score; save(); }
  updatePlay();
  setStatus();
  overlay(`<b>${why}</b>${g.score} apple${g.score === 1 ? '' : 's'}${best && g.score ? ' · new best!' : ''}<br><small>${extra ? extra + ' ' : ''}Press Play to go again</small>`);
}
function steer(dir) {
  if (!game.on || !game.alive) return;
  const last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
  const reverse = game.snake.length > 1 && OPP[dir] === last;   // no turning back into yourself
  if (dir !== last && !reverse && game.queue.length < 2) { game.queue.push(dir); beep('turn'); }
  if (!game.started) begin();
}
function begin() { game.started = true; game.acc = 0; overlay(''); }
$('playBtn').onclick = () => { if (game.on) stopGame(); else startGame(); };
window.addEventListener('keydown', (e) => {
  if (document.activeElement === src) return;
  const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' }[e.code];
  if (k && game.on) { e.preventDefault(); steer(k); }
  else if ((e.code === 'Space' || e.code === 'Enter') && document.activeElement === $('device') && playReady) { e.preventDefault(); $('playBtn').click(); }
});
document.querySelectorAll('.dpad button').forEach((b) => {
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('press'); steer(b.dataset.dir); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, () => b.classList.remove('press')));
});
let swipe = null;
cv.addEventListener('pointerdown', (e) => { if (game.on) swipe = [e.clientX, e.clientY]; });
cv.addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe[0], dy = e.clientY - swipe[1];
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

// --------------------------------------------------------------------- loop
let lastT = performance.now();
let lastSig = '';
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (game.on && game.alive && game.started) {
    game.acc += dt;
    const every = 1 / game.rate;
    let guard = 4;
    while (game.acc >= every && game.on && guard-- > 0) { game.acc -= every; tick(); }
  }
  if (flashRed > 0) flashRed = Math.max(0, flashRed - dt * 2.2);
  // redraw only when something on the screen can have changed
  const sig = screen.join() + '|' + hover + '|' + (ghost ? S.at : '') + '|' + (blink.length && now < blinkT ? Math.floor(now / 180) % 2 : '') +
    '|' + (sweepT >= 0 || flashRed > 0 ? now : '');
  if (sig !== lastSig) { lastSig = sig; drawScreen(now); }
  requestAnimationFrame(frame);
}

// --------------------------------------------------------------------- start
// the sticky header can wrap onto two rows; the layout below it needs its height
const setHead = () => document.documentElement.style.setProperty('--head', document.querySelector('.top').offsetHeight + 'px');
window.addEventListener('resize', setHead);
setHead();
$('soundBtn').textContent = `Sound: ${S.sound ? 'on' : 'off'}`;
if (!unlocked(S.at)) S.at = 0;
showLesson(Math.min(S.at, LESSONS.length - 1));
requestAnimationFrame(frame);
window.__snakelab = { LESSONS, S, run, startGame, steer, game, src, screen, showLesson, renderEditor };
