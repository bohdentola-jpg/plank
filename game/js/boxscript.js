// boxscript — the language of "game".
//
// Reads like English, but it is a real language: variables, lists, your own
// functions with parameters and return values, recursion, loops with counters,
// and a 3D world to command.
//
//   to build with n
//     repeat with i from 1 to n
//       spawn box at i * 2, 0, 0
//     end
//   end
//
//   when start
//     build with 5
//   end
//
// This module is pure — no DOM, no three.js. The game supplies a `host` object
// with the bindings, which also lets the language run under node for tests.

// ---------------------------------------------------------------- tokenizer

const SYMBOLS = ['<=', '>=', '!=', '==', '+', '-', '*', '/', '%', '(', ')', '[', ']', '<', '>', '=', ',', ':'];

export function tokenize(src) {
  const tokens = [];
  const errors = [];
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  for (let ln = 0; ln < lines.length; ln++) {
    let s = stripComment(lines[ln]);
    let i = 0;
    let any = false;
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t') { i++; continue; }
      any = true;
      if (ch === '"' || ch === '“' || ch === '”') {
        let j = i + 1, out = '';
        while (j < s.length && s[j] !== '"' && s[j] !== '“' && s[j] !== '”') { out += s[j]; j++; }
        if (j >= s.length) errors.push({ line: ln + 1, msg: 'missing closing quote "' });
        tokens.push({ t: 'str', v: out, line: ln + 1 });
        i = j + 1;
        continue;
      }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1] || ''))) {
        let j = i, num = '';
        while (j < s.length && /[0-9.]/.test(s[j])) { num += s[j]; j++; }
        const val = parseFloat(num);
        if (!isFinite(val)) errors.push({ line: ln + 1, msg: `"${num}" is not a number I understand` });
        tokens.push({ t: 'num', v: isFinite(val) ? val : 0, line: ln + 1 });
        i = j;
        continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        let j = i, w = '';
        while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) { w += s[j]; j++; }
        tokens.push({ t: 'word', v: w.toLowerCase(), raw: w, line: ln + 1 });
        i = j;
        continue;
      }
      const sym = SYMBOLS.find(x => s.startsWith(x, i));
      if (sym) { tokens.push({ t: 'sym', v: sym === '==' ? '=' : sym, line: ln + 1 }); i += sym.length; continue; }
      errors.push({ line: ln + 1, msg: `I don't understand the character "${ch}"` });
      i++;
    }
    if (any) tokens.push({ t: 'nl', line: ln + 1 });
  }
  tokens.push({ t: 'eof', line: lines.length });
  return { tokens, errors };
}

function stripComment(s) {
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === '“' || c === '”') inStr = !inStr;
    else if (!inStr && (c === '#' || (c === '/' && s[i + 1] === '/'))) return s.slice(0, i);
  }
  return s;
}

// ---------------------------------------------------------------- vocabulary

export const KEY_NAMES = new Set(['space', 'up', 'down', 'left', 'right', 'enter', 'shift', 'tab',
  ...'abcdefghijklmnopqrstuvwxyz'.split(''), ...'0123456789'.split('')]);

// keys the game itself owns — scripts can't listen for these
export const RESERVED_KEYS = new Set(['t', 'enter', 'escape', 'tab']);

const MOVE_DIRS = new Set(['forward', 'back', 'backward', 'left', 'right', 'up', 'down',
  'north', 'south', 'east', 'west']);

// words that can never be a variable/function name
const KEYWORDS = new Set([
  'to', 'when', 'every', 'end', 'else', 'if', 'then', 'repeat', 'while', 'forever', 'for', 'each',
  'with', 'and', 'or', 'not', 'in', 'of', 'from', 'by', 'at', 'as', 'is', 'list', 'my', 'player',
  'set', 'change', 'local', 'add', 'remove', 'insert', 'return', 'break', 'continue', 'stop',
  'yes', 'no', 'true', 'false', 'nothing', 'item', 'length', 'letter', 'text', 'number',
  'random', 'round', 'abs', 'floor', 'ceil', 'sqrt', 'sin', 'cos', 'tan', 'min', 'max',
  'distance', 'touching', 'count', 'time', 'shared', 'key', 'mouse', 'biome', 'height',
  'index', 'contains', 'uppercase', 'lowercase', 'join', 'times', 'seconds', 'second',
  'move', 'turn', 'face', 'goto', 'say', 'write', 'unwrite', 'button', 'show', 'hide', 'solid',
  'screen', 'stamp', 'unstamp', 'print',
  'physical', 'color', 'grow', 'spawn', 'vanish', 'push', 'teleport', 'sound', 'broadcast',
  'wait', 'freeze', 'unfreeze', 'shake', 'spin', 'glow', 'light', 'pressed', 'down',
  'up', 'left', 'right', 'forward', 'back', 'backward', 'everyone', 'size', 'me', 'near',
]);

// ---------------------------------------------------------------- parser

class Parser {
  constructor(tokens) {
    this.toks = tokens;
    this.i = 0;
    this.errors = [];
    this.fnNames = new Set();
    // pre-pass: learn every function name so calls can appear before definitions
    for (let k = 0; k < tokens.length - 1; k++) {
      const a = tokens[k], b = tokens[k + 1];
      const atLineStart = k === 0 || tokens[k - 1].t === 'nl';
      if (atLineStart && a.t === 'word' && a.v === 'to' && b.t === 'word') this.fnNames.add(b.v);
    }
  }
  peek(k = 0) { return this.toks[Math.min(this.i + k, this.toks.length - 1)]; }
  next() { const t = this.peek(); if (this.i < this.toks.length - 1) this.i++; return t; }
  isWord(w, k = 0) { const t = this.peek(k); return t.t === 'word' && t.v === w; }
  isSym(s, k = 0) { const t = this.peek(k); return t.t === 'sym' && t.v === s; }
  eatWord(w) { if (this.isWord(w)) { this.next(); return true; } return false; }
  eatSym(s) { if (this.isSym(s)) { this.next(); return true; } return false; }
  atEnd() { return this.peek().t === 'eof'; }
  err(msg, tok) { this.errors.push({ line: (tok || this.peek()).line, msg }); }
  skipLine() {
    while (this.peek().t !== 'nl' && !this.atEnd()) this.next();
    if (this.peek().t === 'nl') this.next();
  }
  skipBlank() { while (this.peek().t === 'nl') this.next(); }
  endLine(what) {
    if (this.peek().t === 'nl') { this.next(); return; }
    if (this.atEnd()) return;
    this.err(`I don't know what "${tokenText(this.peek())}" is doing after ${what}`);
    this.skipLine();
  }
  expectEnd(what) {
    this.skipBlank();
    if (this.eatWord('end')) { if (this.peek().t === 'nl') this.next(); return; }
    this.err(`missing "end" to close "${what}"`);
  }
  name(what) {
    const t = this.next();
    if (t.t !== 'word') { this.err(`${what} needs a name`, t); return null; }
    if (KEYWORDS.has(t.v)) { this.err(`"${t.raw || t.v}" is a boxscript word — pick another name`, t); return null; }
    return t.v;
  }

  parseProgram() {
    const events = [];
    const functions = new Map();
    this.skipBlank();
    let guard = 0;
    while (!this.atEnd() && guard++ < 100000) {
      const before = this.i;
      if (this.isWord('to')) {
        const fn = this.parseFunction();
        if (fn) {
          if (functions.has(fn.name)) this.err(`there are two functions called "${fn.name}"`, { line: fn.line });
          functions.set(fn.name, fn);
        }
      } else {
        const ev = this.parseEvent();
        if (ev) events.push(ev);
      }
      if (this.i === before) this.next(); // never spin
      this.skipBlank();
    }
    return { events, functions };
  }

  parseFunction() {
    const tok = this.peek();
    this.next(); // 'to'
    const name = this.name('a function');
    const params = [];
    if (this.eatWord('with')) {
      do {
        const p = this.name('a parameter');
        if (p) params.push(p);
      } while (this.eatSym(','));
    }
    this.endLine(`"to ${name || '?'}"`);
    const body = this.parseBlock(['end']);
    this.expectEnd('to ' + (name || '?'));
    if (!name) return null;
    return { name, params, body, line: tok.line };
  }

  parseEvent() {
    const tok = this.peek();
    if (this.eatWord('when')) {
      const kt = this.next();
      if (kt.t !== 'word') {
        this.err('after "when" I need an event, like: when touched', kt);
        this.skipLine();
        return null;
      }
      const kind = kt.v;
      let param = null;
      if (['start', 'tick', 'touched', 'clicked', 'hit'].includes(kind)) {
        // no parameter
      } else if (kind === 'key') {
        const k = this.next();
        const nm = k.t === 'word' ? k.v : (k.t === 'num' ? String(k.v) : null);
        if (!nm || !KEY_NAMES.has(nm)) this.err('"when key" needs a key name like space, e, up', k);
        else if (RESERVED_KEYS.has(nm)) this.err(`"${nm}" is used by the game (chat/menus) — pick another key`, k);
        param = nm || 'space';
        this.eatWord('pressed');
      } else if (kind === 'message') {
        const k = this.next();
        if (k.t === 'word' || k.t === 'str') param = String(k.v).toLowerCase();
        else this.err('"when message" needs a name, like: when message levelup', k);
      } else if (kind === 'button') {
        const k = this.next();
        if (k.t === 'str' || k.t === 'word') param = String(k.v);
        else this.err('"when button" needs the label in quotes', k);
      } else if (kind === 'screen') {
        const k = this.next();
        const which = k.t === 'word' ? k.v : null;
        if (!['start', 'stop', 'tick'].includes(which)) {
          this.err('"when screen" knows: when screen start, when screen stop, when screen tick', k);
        }
        return this.finishEvent('screen' + (which || 'start'), null, tok, '"when screen"');
      } else if (kind === 'player') {
        if (!this.eatWord('near')) this.err('did you mean "when player near 10"?');
        param = this.parseExpr();
        return this.finishEvent('near', param, tok, 'when player near');
      } else {
        this.err(`I don't know the event "when ${kind}". try: start, tick, touched, clicked, hit, key, message, button, player near, screen start/tick/stop`, kt);
        this.skipLine();
        return null;
      }
      return this.finishEvent(kind, param, tok, `"when ${kind}"`);
    }
    if (this.eatWord('every')) {
      const t = this.parseExpr();
      this.eatWord('seconds'); this.eatWord('second');
      return this.finishEvent('every', t, tok, '"every"');
    }
    this.err(`scripts are made of "when ..." blocks and "to ..." functions — I found "${tokenText(tok)}" loose`, tok);
    this.skipLine();
    return null;
  }

  finishEvent(kind, param, tok, label) {
    this.endLine(label);
    const body = this.parseBlock(['end']);
    this.expectEnd(label.replace(/"/g, ''));
    return { kind, param, body, line: tok.line };
  }

  parseBlock(stops) {
    const body = [];
    this.skipBlank();
    let guard = 0;
    while (guard++ < 100000) {
      const t = this.peek();
      if (t.t === 'eof') return body;
      if (t.t === 'word' && stops.includes(t.v)) return body;
      if (t.t === 'word' && (t.v === 'to' || t.v === 'when')) return body; // unterminated block
      const before = this.i;
      const s = this.parseStmt();
      if (s) body.push(s);
      if (this.i === before) this.next();
      this.skipBlank();
    }
    return body;
  }

  // ------------------------------------------------------------ statements
  parseStmt() {
    const tok = this.peek();
    if (tok.t !== 'word') {
      this.err(`I expected a command here, not "${tokenText(tok)}"`, tok);
      this.skipLine();
      return null;
    }
    const w = tok.v;
    const line = tok.line;
    const done = (stmt) => { this.endLine(`"${w}"`); return { ...stmt, line }; };

    switch (w) {
      case 'set': {
        this.next();
        // set item N of L to V
        if (this.isWord('item')) {
          this.next();
          const idx = this.parseExpr();
          if (!this.eatWord('of')) this.err('"set item" works like: set item 1 of things to "x"');
          const target = this.parsePlace();
          if (!this.eatWord('to')) this.err('"set item" needs "to"');
          const val = this.parseExpr();
          return done({ op: 'setitem', idx, target, val });
        }
        // set shared NAME to V
        if (this.isWord('shared')) {
          this.next();
          const nm = this.name('"set shared"');
          if (!this.eatWord('to')) this.err('"set" needs "to", like: set shared score to 0');
          return done({ op: 'set', scope: 'shared', name: nm, val: this.parseExpr() });
        }
        // set my x to V
        if (this.isWord('my')) {
          this.next();
          const p = this.next();
          const prop = p.t === 'word' ? p.v : null;
          if (!PROPS.has(prop)) this.err('"my" knows: x, y, z, yaw, size', p);
          if (!this.eatWord('to')) this.err('"set my ..." needs "to"');
          return done({ op: 'setprop', prop: prop || 'x', val: this.parseExpr() });
        }
        const nm = this.name('"set"');
        if (!this.eatWord('to')) this.err('"set" needs "to", like: set score to 0');
        return done({ op: 'set', scope: 'auto', name: nm, val: this.parseExpr() });
      }
      case 'local': {
        this.next();
        const nm = this.name('"local"');
        if (!this.eatWord('to')) this.err('"local" needs "to", like: local i to 0');
        return done({ op: 'set', scope: 'local', name: nm, val: this.parseExpr() });
      }
      case 'change': {
        this.next();
        if (this.isWord('shared')) {
          this.next();
          const nm = this.name('"change shared"');
          if (!this.eatWord('by')) this.err('"change" needs "by"');
          return done({ op: 'change', scope: 'shared', name: nm, val: this.parseExpr() });
        }
        if (this.isWord('my')) {
          this.next();
          const p = this.next();
          const prop = p.t === 'word' ? p.v : null;
          if (!PROPS.has(prop)) this.err('"my" knows: x, y, z, yaw, size', p);
          if (!this.eatWord('by')) this.err('"change my ..." needs "by"');
          return done({ op: 'changeprop', prop: prop || 'x', val: this.parseExpr() });
        }
        const nm = this.name('"change"');
        if (!this.eatWord('by')) this.err('"change" needs "by", like: change score by 1');
        return done({ op: 'change', scope: 'auto', name: nm, val: this.parseExpr() });
      }
      case 'add': {
        this.next();
        const val = this.parseExpr();
        if (!this.eatWord('to')) this.err('"add" works like: add 5 to things');
        const target = this.parsePlace();
        return done({ op: 'listadd', val, target });
      }
      case 'insert': {
        this.next();
        const val = this.parseExpr();
        if (!this.eatWord('at')) this.err('"insert" works like: insert 5 at 1 in things');
        const idx = this.parseExpr();
        if (!this.eatWord('in')) this.err('"insert" needs "in", like: insert 5 at 1 in things');
        const target = this.parsePlace();
        return done({ op: 'listinsert', val, idx, target });
      }
      case 'remove': {
        this.next();
        if (this.eatWord('button')) {
          const t = this.next();
          const label = (t.t === 'str' || t.t === 'word') ? String(t.v) : '';
          if (!label) this.err('"remove button" needs the label', t);
          return done({ op: 'removebutton', label });
        }
        if (this.eatWord('item')) {
          const idx = this.parseExpr();
          if (!this.eatWord('of')) this.err('"remove item" works like: remove item 1 of things');
          const target = this.parsePlace();
          return done({ op: 'listremove', idx, target });
        }
        if (this.eatWord('all')) {
          if (!this.eatWord('of') && !this.eatWord('from')) this.err('"remove all of things" clears a list');
          const target = this.parsePlace();
          return done({ op: 'listclear', target });
        }
        this.err('"remove" works like: remove item 1 of things · remove all of things · remove button "play"');
        this.skipLine();
        return null;
      }
      case 'return': {
        this.next();
        const hasVal = this.peek().t !== 'nl' && !this.atEnd();
        return done({ op: 'return', val: hasVal ? this.parseExpr() : null });
      }
      case 'break': { this.next(); return done({ op: 'break' }); }
      case 'continue': { this.next(); return done({ op: 'continue' }); }
      case 'stop': {
        this.next();
        if (this.eatWord('repeating')) return done({ op: 'break' });
        return done({ op: 'halt' });
      }
      case 'move': {
        this.next();
        const d = this.next();
        if (d.t !== 'word' || !MOVE_DIRS.has(d.v)) { this.err('"move" needs a direction: forward, back, left, right, up, down', d); this.skipLine(); return null; }
        return done({ op: 'move', dir: d.v, amt: this.parseExpr() });
      }
      case 'turn': {
        this.next();
        if (this.eatWord('to')) return done({ op: 'turnto', amt: this.parseExpr() });
        const d = this.next();
        if (d.t !== 'word' || (d.v !== 'left' && d.v !== 'right')) { this.err('"turn" works like: turn right 90 · turn to 180', d); this.skipLine(); return null; }
        this.eatWord('by');
        return done({ op: 'turn', dir: d.v, amt: this.parseExpr() });
      }
      case 'face': {
        this.next();
        if (this.eatWord('player')) return done({ op: 'face', what: 'player' });
        const x = this.parseExpr();
        this.eatSym(',');
        const z = this.parseExpr();
        return done({ op: 'facexz', x, z });
      }
      case 'goto': {
        this.next();
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        let z = null;
        if (this.eatSym(',') || this.peek().t === 'num' || this.peek().t === 'word') z = this.parseExpr();
        return done({ op: 'goto', x, y, z });
      }
      case 'say': {
        this.next();
        const text = this.parseExpr();
        let secs = null;
        if (this.eatWord('for')) { secs = this.parseExpr(); this.eatWord('seconds'); this.eatWord('second'); }
        return done({ op: 'say', text, secs });
      }
      case 'write': {
        this.next();
        const text = this.parseExpr();
        if (!this.eatWord('at')) this.err('"write" needs a place: write "hi" at 50, 20');
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        let size = null, id = null;
        for (let g = 0; g < 4; g++) {
          if (this.eatWord('size')) { size = this.parseExpr(); continue; }
          if (this.eatWord('as')) {
            const t = this.next();
            if (t.t === 'word' || t.t === 'str') id = String(t.v);
            else this.err('"as" needs a name', t);
            continue;
          }
          break;
        }
        return done({ op: 'write', text, x, y, size, id });
      }
      case 'unwrite': {
        this.next();
        const t = this.next();
        if (t.t === 'word' || t.t === 'str') return done({ op: 'unwrite', id: String(t.v) });
        this.err('"unwrite" needs the name you used with "as" (or "all")', t);
        return done({ op: 'unwrite', id: 'all' });
      }
      case 'button': {
        this.next();
        const t = this.next();
        let label = '';
        if (t.t === 'str' || t.t === 'word') label = String(t.v);
        else this.err('"button" needs a label in quotes', t);
        if (!this.eatWord('at')) this.err('"button" needs a place: button "play" at 50, 60');
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        return done({ op: 'button', label: label || 'button', x, y });
      }
      case 'show': { this.next(); return done({ op: 'show', on: true }); }
      case 'hide': { this.next(); return done({ op: 'show', on: false }); }
      case 'solid': case 'physical': case 'glow': case 'light': {
        this.next();
        const on = this.eatWord('on') ? true : (this.eatWord('off') ? false : null);
        if (on === null) this.err(`"${w}" needs on or off`);
        return done({ op: 'flag', flag: w, on: on !== false });
      }
      case 'color': {
        this.next();
        const t = this.next();
        if (t.t !== 'word' && t.t !== 'str') { this.err('"color" needs a color name, like: color red', t); this.skipLine(); return null; }
        return done({ op: 'color', name: String(t.v).toLowerCase() });
      }
      case 'grow': { this.next(); return done({ op: 'grow', amt: this.parseExpr() }); }
      case 'spin': { this.next(); return done({ op: 'spin', amt: this.parseExpr() }); }
      case 'spawn': {
        this.next();
        const t = this.next();
        let model = null;
        if (t.t === 'word' || t.t === 'str') model = String(t.v);
        else this.err('"spawn" needs a model name: spawn box at 10, 0, 0', t);
        let x = null, y = null, z = null;
        if (this.eatWord('at')) {
          x = this.parseExpr(); this.eatSym(',');
          y = this.parseExpr();
          if (this.eatSym(',')) z = this.parseExpr();
        }
        return done({ op: 'spawn', model: model || 'box', x, y, z });
      }
      case 'vanish': { this.next(); return done({ op: 'vanish' }); }
      case 'push': {
        this.next();
        const d = this.next();
        if (d.t !== 'word' || !MOVE_DIRS.has(d.v)) { this.err('"push" needs a direction', d); this.skipLine(); return null; }
        return done({ op: 'push', dir: d.v, amt: this.parseExpr() });
      }
      case 'teleport': {
        this.next();
        const who = this.eatWord('player') ? 'player' : (this.eatWord('me') ? 'me' : 'player');
        if (!this.eatWord('to')) this.err('"teleport" works like: teleport player to 0, 0, 0');
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        let z = null;
        if (this.eatSym(',')) z = this.parseExpr();
        return done({ op: 'teleport', who, x, y, z });
      }
      case 'sound': {
        this.next();
        const t = this.next();
        if (t.t !== 'word' && t.t !== 'str') { this.err('"sound" needs a name: sound pop', t); this.skipLine(); return null; }
        return done({ op: 'sound', name: String(t.v).toLowerCase() });
      }
      case 'broadcast': {
        this.next();
        const t = this.next();
        let msg = null;
        if (t.t === 'word' || t.t === 'str') msg = String(t.v).toLowerCase();
        else this.err('"broadcast" needs a message name', t);
        let everyone = false;
        if (this.eatWord('to')) { this.eatWord('everyone'); everyone = true; }
        return done({ op: 'broadcast', msg: msg || 'ping', everyone });
      }
      case 'wait': {
        this.next();
        const t = this.parseExpr();
        this.eatWord('seconds'); this.eatWord('second');
        return done({ op: 'wait', t });
      }
      case 'freeze': { this.next(); this.eatWord('player'); return done({ op: 'freeze', on: true }); }
      case 'unfreeze': { this.next(); this.eatWord('player'); return done({ op: 'freeze', on: false }); }
      case 'shake': { this.next(); return done({ op: 'shake', amt: this.parseExpr() }); }
      case 'if': return this.parseIf();
      case 'repeat': {
        this.next();
        if (this.eatWord('with')) {
          const nm = this.name('the counter');
          if (!this.eatWord('from')) this.err('"repeat with" works like: repeat with i from 1 to 10');
          const from = this.parseExpr();
          if (!this.eatWord('to')) this.err('"repeat with" needs "to"');
          const toE = this.parseExpr();
          let by = null;
          if (this.eatWord('by')) by = this.parseExpr();
          this.endLine('"repeat with"');
          const body = this.parseBlock(['end']);
          this.expectEnd('repeat with');
          return { op: 'count', name: nm || 'i', from, to: toE, by, body, line };
        }
        if (this.eatWord('forever')) {
          this.endLine('"repeat forever"');
          const body = this.parseBlock(['end']);
          this.expectEnd('repeat forever');
          return { op: 'forever', body, line };
        }
        const n = this.parseExpr();
        this.eatWord('times');
        this.endLine('"repeat"');
        const body = this.parseBlock(['end']);
        this.expectEnd('repeat');
        return { op: 'repeat', n, body, line };
      }
      case 'for': {
        this.next();
        this.eatWord('each');
        const nm = this.name('the loop variable');
        if (!this.eatWord('in')) this.err('"for each" works like: for each thing in things');
        const listE = this.parseExpr();
        this.endLine('"for each"');
        const body = this.parseBlock(['end']);
        this.expectEnd('for each');
        return { op: 'foreach', name: nm || 'it', list: listE, body, line };
      }
      case 'while': {
        this.next();
        const cond = this.parseExpr();
        this.endLine('"while"');
        const body = this.parseBlock(['end']);
        this.expectEnd('while');
        return { op: 'while', cond, body, line };
      }
      case 'forever': {
        this.next();
        this.endLine('"forever"');
        const body = this.parseBlock(['end']);
        this.expectEnd('forever');
        return { op: 'forever', body, line };
      }
      case 'clear': {
        this.next();
        if (!this.eatWord('screen')) this.err('"clear" works like: clear screen black');
        let color = null;
        const t = this.peek();
        if (t.t === 'word' || t.t === 'str') { this.next(); color = String(t.v).toLowerCase(); }
        return done({ op: 'clearscreen', color });
      }
      case 'stamp': {
        this.next();
        let id = null, idExpr = null;
        const t = this.peek();
        if (t.t === 'word' && this.peek(1).t === 'word' && this.peek(1).v === 'at') {
          this.next();
          id = String(t.v);
        } else if (t.t === 'str' && this.peek(1).t === 'word' && this.peek(1).v === 'at') {
          this.next();
          id = String(t.v);
        } else {
          idExpr = this.parseExpr();   // dynamic ids: stamp "s" + i at …
        }
        if (!this.eatWord('at')) this.err('"stamp" needs "at": stamp paddle at 10, 60 size 12, 3');
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        let w = { e: 'num', v: 4 }, hh = { e: 'num', v: 4 }, color = null;
        for (let g = 0; g < 3; g++) {
          if (this.eatWord('size')) {
            w = this.parseExpr();
            if (this.eatSym(',')) hh = this.parseExpr();
            else hh = w;
            continue;
          }
          if (this.eatWord('color')) { color = this.parseExpr(); continue; }
          break;
        }
        return done({ op: 'stamp', id, idExpr, x, y, w, h: hh, color });
      }
      case 'print': {
        this.next();
        const t = this.next();
        let id = null;
        if (t.t === 'word' || t.t === 'str') id = String(t.v);
        else this.err('"print" needs a name: print score "0" at 4, 2', t);
        const text = this.parseExpr();
        if (!this.eatWord('at')) this.err('"print" needs "at": print score "0" at 4, 2');
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        let size = null, color = null;
        for (let g = 0; g < 3; g++) {
          if (this.eatWord('size')) { size = this.parseExpr(); continue; }
          if (this.eatWord('color')) { color = this.parseExpr(); continue; }
          break;
        }
        return done({ op: 'sprint', id: id || 'p', text, x, y, size, color });
      }
      case 'unstamp': {
        this.next();
        const t = this.peek();
        if (t.t === 'word' && (this.peek(1).t === 'nl' || this.peek(1).t === 'eof')) {
          this.next();
          return done({ op: 'unstamp', id: String(t.v) });
        }
        if (t.t === 'nl' || t.t === 'eof') {
          this.err('"unstamp" needs the stamp name (or "all")', t);
          return done({ op: 'unstamp', id: 'all' });
        }
        return done({ op: 'unstamp', idExpr: this.parseExpr() });
      }
      case 'end': case 'else': {
        this.next();
        this.err(`stray "${w}" — it doesn't close anything here`, tok);
        this.skipLine();
        return null;
      }
      default: {
        // a call to one of your own functions
        if (this.fnNames.has(w)) {
          this.next();
          const args = this.parseCallArgs();
          return done({ op: 'call', name: w, args });
        }
        this.err(`I don't know the command "${tok.raw || w}"`, tok);
        this.skipLine();
        return null;
      }
    }
  }

  parseIf() {
    const line = this.peek().line;
    this.next(); // if
    const cond = this.parseExpr();
    this.eatWord('then');
    this.endLine('"if"');
    const body = this.parseBlock(['else', 'end']);
    let elseBody = null;
    this.skipBlank();
    if (this.isWord('else')) {
      this.next();
      if (this.isWord('if')) {
        elseBody = [this.parseIf()];
        return { op: 'if', cond, body, elseBody, line };
      }
      if (this.peek().t === 'nl') this.next();
      elseBody = this.parseBlock(['end']);
    }
    this.expectEnd('if');
    return { op: 'if', cond, body, elseBody, line };
  }

  parseCallArgs() {
    const args = [];
    if (this.eatSym('(')) {
      if (!this.isSym(')')) {
        do { args.push(this.parseExpr()); } while (this.eatSym(','));
      }
      if (!this.eatSym(')')) this.err('missing closing )');
      return args;
    }
    if (this.eatWord('with')) {
      do { args.push(this.parseExpr()); } while (this.eatSym(','));
    }
    return args;
  }

  // a "place" is something assignable/mutable: a variable, or item N of place
  parsePlace() {
    if (this.isWord('item')) {
      this.next();
      const idx = this.parseExpr();
      if (!this.eatWord('of')) this.err('"item" needs "of"');
      return { p: 'item', idx, of: this.parsePlace() };
    }
    if (this.isWord('shared')) {
      this.next();
      const nm = this.name('"shared"');
      return { p: 'shared', name: nm };
    }
    const nm = this.name('a list');
    return { p: 'var', name: nm };
  }

  // ------------------------------------------------------------ expressions
  parseExpr() { return this.parseOr(); }
  parseOr() {
    let l = this.parseAnd();
    while (this.isWord('or')) { this.next(); l = { e: 'bin', op: 'or', l, r: this.parseAnd() }; }
    return l;
  }
  parseAnd() {
    let l = this.parseCmp();
    while (this.isWord('and')) { this.next(); l = { e: 'bin', op: 'and', l, r: this.parseCmp() }; }
    return l;
  }
  parseCmp() {
    let l = this.parseAdd();
    for (let g = 0; g < 100; g++) {
      if (this.peek().t === 'sym' && ['=', '!=', '<', '>', '<=', '>='].includes(this.peek().v)) {
        const op = this.next().v;
        l = { e: 'bin', op, l, r: this.parseAdd() };
      } else if (this.isWord('is')) {
        this.next();
        if (this.eatWord('not')) l = { e: 'bin', op: '!=', l, r: this.parseAdd() };
        else l = { e: 'bin', op: '=', l, r: this.parseAdd() };
      } else if (this.isWord('contains')) {
        this.next();
        l = { e: 'contains', hay: l, needle: this.parseAdd() };
      } else break;
    }
    return l;
  }
  parseAdd() {
    let l = this.parseMul();
    while (this.peek().t === 'sym' && (this.peek().v === '+' || this.peek().v === '-')) {
      const op = this.next().v;
      l = { e: 'bin', op, l, r: this.parseMul() };
    }
    return l;
  }
  parseMul() {
    let l = this.parseUnary();
    while (this.peek().t === 'sym' && ['*', '/', '%'].includes(this.peek().v)) {
      const op = this.next().v;
      l = { e: 'bin', op, l, r: this.parseUnary() };
    }
    return l;
  }
  parseUnary() {
    if (this.isSym('-')) { this.next(); return { e: 'neg', v: this.parseUnary() }; }
    if (this.isWord('not')) { this.next(); return { e: 'not', v: this.parseUnary() }; }
    return this.parsePostfix();
  }
  parsePostfix() { return this.parsePrimary(); }

  parsePrimary() {
    const t = this.peek();
    if (t.t === 'num') { this.next(); return { e: 'num', v: t.v }; }
    if (t.t === 'str') { this.next(); return { e: 'str', v: t.v }; }
    if (this.eatSym('(')) {
      const inner = this.parseExpr();
      if (!this.eatSym(')')) this.err('missing closing )');
      return inner;
    }
    if (this.eatSym('[')) {   // [1, 2, 3] list literal
      const items = [];
      if (!this.isSym(']')) { do { items.push(this.parseExpr()); } while (this.eatSym(',')); }
      if (!this.eatSym(']')) this.err('missing closing ]');
      return { e: 'listlit', items };
    }
    if (t.t !== 'word') {
      this.err(`I expected a value here, not "${tokenText(t)}"`, t);
      this.next();
      return { e: 'num', v: 0 };
    }

    const w = t.v;
    // one-word values
    if (w === 'yes' || w === 'true') { this.next(); return { e: 'bool', v: true }; }
    if (w === 'no' || w === 'false') { this.next(); return { e: 'bool', v: false }; }
    if (w === 'nothing') { this.next(); return { e: 'str', v: '' }; }
    if (w === 'time') { this.next(); return { e: 'time' }; }
    if (w === 'biome') { this.next(); return { e: 'biome' }; }
    if (w === 'screen') {
      this.next();
      if (this.eatWord('on')) return { e: 'screenon' };
      if (this.eatWord('width')) return { e: 'num', v: 100 };
      if (this.eatWord('height')) return { e: 'num', v: 75 };
      return { e: 'screenon' };
    }
    if (w === 'list') {
      this.next();
      const items = [];
      const endsList = () => this.peek().t === 'nl' || this.atEnd() ||
        (this.peek().t === 'word' && ['to', 'in', 'of', 'at', 'as', 'for', 'then', 'and', 'or', 'by', 'with', 'end', 'times'].includes(this.peek().v));
      if (!endsList()) {
        do { items.push(this.parseExpr()); } while (this.eatSym(','));
      }
      return { e: 'listlit', items };
    }
    if (w === 'my') {
      this.next();
      const p = this.next();
      const prop = p.t === 'word' ? p.v : null;
      if (!PROPS.has(prop) && prop !== 'name') { this.err('"my" knows: x, y, z, yaw, size, name', p); return { e: 'num', v: 0 }; }
      return { e: 'my', p: prop };
    }
    if (w === 'player') {
      this.next();
      const p = this.next();
      const prop = p.t === 'word' ? p.v : null;
      if (!['x', 'y', 'z', 'yaw', 'name'].includes(prop)) { this.err('"player" knows: x, y, z, yaw, name', p); return { e: 'num', v: 0 }; }
      return { e: 'player', p: prop };
    }
    if (w === 'mouse') {
      this.next();
      const p = this.next();
      if (p.t !== 'word' || (p.v !== 'x' && p.v !== 'y')) { this.err('"mouse" knows: mouse x, mouse y', p); return { e: 'num', v: 0 }; }
      return { e: 'mouse', p: p.v };
    }
    if (w === 'shared') {
      this.next();
      const nm = this.name('"shared"');
      return { e: 'shared', name: nm || '_' };
    }
    if (w === 'random') {
      this.next();
      const a = this.parseAdd();
      if (!this.eatWord('to')) this.err('"random" works like: random 1 to 10');
      return { e: 'random', a, b: this.parseAdd() };
    }
    if (w === 'distance') {
      this.next();
      this.eatWord('to');
      if (this.eatWord('player')) return { e: 'distance', what: 'player' };
      const t2 = this.next();
      return { e: 'distancem', model: (t2.t === 'word' || t2.t === 'str') ? String(t2.v) : 'player' };
    }
    if (w === 'touching') {
      this.next();
      const t2 = this.next();
      if (t2.t !== 'word' && t2.t !== 'str') { this.err('"touching" works like: touching player', t2); return { e: 'bool', v: false }; }
      return { e: 'touching', what: String(t2.v) };
    }
    if (w === 'key') {
      this.next();
      const k = this.next();
      const nm = k.t === 'word' ? k.v : (k.t === 'num' ? String(k.v) : null);
      if (!nm || !KEY_NAMES.has(nm)) this.err('unknown key name', k);
      this.eatWord('is'); this.eatWord('down');
      return { e: 'keydown', name: nm || 'space' };
    }
    if (w === 'count') {
      this.next();
      this.eatWord('of');
      const t2 = this.next();
      if (t2.t !== 'word' && t2.t !== 'str') { this.err('"count" works like: count of box', t2); return { e: 'num', v: 0 }; }
      return { e: 'count', model: String(t2.v) };
    }
    if (w === 'height') {
      this.next();
      this.eatWord('at');
      const x = this.parseAdd();
      this.eatSym(',');
      return { e: 'height', x, z: this.parseAdd() };
    }
    if (w === 'item') {
      this.next();
      const idx = this.parseExpr();
      if (!this.eatWord('of')) this.err('"item" works like: item 1 of things');
      return { e: 'item', idx, of: this.parsePrimary() };
    }
    if (w === 'letter') {
      this.next();
      const idx = this.parseExpr();
      if (!this.eatWord('of')) this.err('"letter" works like: letter 1 of "word"');
      return { e: 'letter', idx, of: this.parsePrimary() };
    }
    if (w === 'length') {
      this.next();
      this.eatWord('of');
      return { e: 'length', v: this.parsePrimary() };
    }
    if (w === 'index') {
      this.next();
      this.eatWord('of');
      const needle = this.parseAdd();
      if (!this.eatWord('in')) this.err('"index of" works like: index of 5 in things');
      return { e: 'indexof', needle, hay: this.parsePrimary() };
    }
    if (w === 'join') {
      this.next();
      const list = this.parsePrimary();
      let sep = { e: 'str', v: '' };
      if (this.eatWord('with')) sep = this.parsePrimary();
      return { e: 'join', list, sep };
    }
    if (UNARY_FNS.has(w)) {
      this.next();
      this.eatWord('of');
      return { e: 'fn', fn: w, v: this.parseUnary() };
    }
    if (BINARY_FNS.has(w)) {
      this.next();
      this.eatWord('of');
      const a = this.parseAdd();
      this.eatSym(',');
      this.eatWord('and');
      return { e: 'fn2', fn: w, a, b: this.parseAdd() };
    }
    // your own function, used as a value
    if (this.fnNames.has(w)) {
      this.next();
      return { e: 'call', name: w, args: this.parseCallArgs() };
    }
    if (KEYWORDS.has(w)) {
      this.err(`"${t.raw || w}" can't be used as a value here`, t);
      this.next();
      return { e: 'num', v: 0 };
    }
    this.next();
    return { e: 'var', name: w };
  }
}

const PROPS = new Set(['x', 'y', 'z', 'yaw', 'size']);
const UNARY_FNS = new Set(['round', 'abs', 'floor', 'ceil', 'sqrt', 'sin', 'cos', 'tan',
  'text', 'number', 'uppercase', 'lowercase']);
const BINARY_FNS = new Set(['min', 'max']);

function tokenText(t) {
  if (t.t === 'nl') return 'end of line';
  if (t.t === 'eof') return 'end of script';
  if (t.t === 'str') return `"${t.v}"`;
  return String(t.raw || t.v);
}

export function compile(src) {
  const { tokens, errors: lexErrors } = tokenize(src);
  const p = new Parser(tokens);
  const program = p.parseProgram();
  const errors = [...lexErrors, ...p.errors].slice(0, 40);
  return { ok: errors.length === 0, errors, program };
}

// ---------------------------------------------------------------- values

export function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  return !(v === false || v === 0 || v === '' || v == null);
}

export function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v)) return v.length;
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

export function display(v) {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(display).join(', ');
  if (typeof v === 'number') {
    if (!isFinite(v)) return '0';
    return String(Math.round(v * 1e6) / 1e6);
  }
  return String(v);
}

function isNumeric(v) {
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '' && isFinite(+v);
  return false;
}

function looseEq(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => looseEq(x, b[i]));
  }
  if (isNumeric(a) && isNumeric(b)) return num(a) === num(b);
  return display(a) === display(b);
}

// ---------------------------------------------------------------- runtime

const OPS_BUDGET = 6000;      // ops per fiber per frame before yielding
const MAX_DEPTH = 120;        // function call depth
const MAX_LIST = 20000;

function rtError(line, msg) {
  const e = new Error(msg);
  e.__bs = true;
  e.__line = line || 0;
  e.__msg = msg;
  return e;
}

function stopSignal(why) {
  const e = new Error(why || 'stop');
  e.__stop = true;
  return e;
}

// Host bindings (all optional):
//   getProp(name) setProp(name, v) getName()
//   move(dx,dy,dz) moveLocal(fwd, side, up) turn(deg) setYaw(deg) faceTarget(what) facePoint(x,z)
//   say(text, secs) write(text,x,y,size,id) unwrite(id) button(label,x,y) removeButton(label)
//   show(v) flag(name, v) color(name) grow(amt) spin(deg)
//   spawn(model,x,y,z) vanish() push(dx,dy,dz) pushLocal(fwd,side,up)
//   teleportPlayer(x,y,z) sound(name) broadcast(msg,everyone) freeze(v) shake(amt)
//   playerProp(p) mouse(p) keyDown(name) touching(what) distanceToPlayer()
//   distanceToModel(m) count(model) time() biome() heightAt(x,z)
//   sharedGet(n) sharedSet(n,v) onError(line,msg)
export class ScriptInstance {
  constructor(program, host) {
    this.prog = program || { events: [], functions: new Map() };
    this.host = host || {};
    this.vars = new Map();       // this object's variables
    this.fibers = [];
    this.timers = [];
    this.tickHandlers = [];
    this.nearHandlers = [];
    this.dead = false;
    this.now = 0;
    for (const ev of this.prog.events) {
      if (ev.kind === 'every') this.timers.push({ ev, next: null, period: null });
      else if (ev.kind === 'tick') this.tickHandlers.push({ ev, fiber: null });
      else if (ev.kind === 'screentick') this.tickHandlers.push({ ev, fiber: null, gated: true });
      else if (ev.kind === 'near') this.nearHandlers.push({ ev, inside: false });
    }
  }

  start() {
    for (const ev of this.prog.events) if (ev.kind === 'start') this.spawnFiber(ev.body);
  }

  trigger(kind, param = null) {
    if (this.dead) return;
    for (const ev of this.prog.events) {
      if (ev.kind !== kind) continue;
      if (kind === 'key' || kind === 'message') {
        if (String(ev.param).toLowerCase() !== String(param).toLowerCase()) continue;
      } else if (kind === 'button') {
        if (String(ev.param).toLowerCase() !== String(param).toLowerCase()) continue;
      }
      this.spawnFiber(ev.body);
    }
  }

  spawnFiber(body) {
    if (this.fibers.length > 64) return;   // runaway guard
    const ctx = this.newCtx();
    const f = { gen: execBlock(body, ctx), ctx, sleepUntil: 0 };
    this.fibers.push(f);
    return f;
  }

  newCtx() { return { inst: this, ops: 0, frames: [], depth: 0 }; }

  update(now) {
    if (this.dead) return;
    this.now = now;
    for (const tm of this.timers) {
      if (tm.period === null) {
        tm.period = Math.max(0.03, num(this.evalSafe(tm.ev.param)));
        tm.next = now + tm.period;
      }
      if (now >= tm.next) {
        tm.next = now + tm.period;
        this.spawnFiber(tm.ev.body);
      }
    }
    for (const th of this.tickHandlers) {
      // screen ticks only run while the local player is at the controls
      if (th.gated && !(this.host.screenOn && this.host.screenOn())) continue;
      if (!th.fiber || th.fiber.done) th.fiber = this.spawnFiber(th.ev.body);
    }
    for (const nh of this.nearHandlers) {
      const r = num(this.evalSafe(nh.ev.param));
      const d = this.host.distanceToPlayer ? this.host.distanceToPlayer() : 1e9;
      const inside = d <= r;
      if (inside && !nh.inside) this.spawnFiber(nh.ev.body);
      nh.inside = inside;
    }
    for (const f of this.fibers) this.stepFiber(f, now);
    if (this.fibers.some(f => f.done)) this.fibers = this.fibers.filter(f => !f.done);
  }

  stepFiber(f, now) {
    if (f.done || now < f.sleepUntil) return;
    f.ctx.ops = 0;
    try {
      const r = f.gen.next();
      if (r.done) { f.done = true; return; }
      const y = r.value || {};
      if (y.wait) f.sleepUntil = now + num(y.wait);
    } catch (err) {
      f.done = true;
      if (err && err.__stop) return;
      const line = err && err.__line || 0;
      this.reportError(line, err && err.__msg ? err.__msg : String((err && err.message) || err));
    }
  }

  evalSafe(expr) {
    try {
      const ctx = this.newCtx();
      const g = evalExpr(expr, ctx);
      // evalExpr is a generator (function calls can wait); drain it without waiting
      let r = g.next();
      let guard = 0;
      while (!r.done && guard++ < 10000) r = g.next();
      return r.done ? r.value : 0;
    } catch (e) { return 0; }
  }

  reportError(line, msg) { if (this.host.onError) this.host.onError(line, msg); }
  destroy() { this.dead = true; this.fibers.length = 0; }
}

// ------------------------------------------------------------ scope helpers

function frame(ctx) { return ctx.frames.length ? ctx.frames[ctx.frames.length - 1] : null; }

function readVar(ctx, name) {
  const fr = frame(ctx);
  if (fr && fr.locals.has(name)) return fr.locals.get(name);
  const v = ctx.inst.vars;
  return v.has(name) ? v.get(name) : 0;
}

function writeVar(ctx, name, val, scope) {
  const fr = frame(ctx);
  if (scope === 'local') {
    if (fr) fr.locals.set(name, val);
    else ctx.inst.vars.set(name, val);
    return;
  }
  if (fr && fr.locals.has(name)) { fr.locals.set(name, val); return; }
  ctx.inst.vars.set(name, val);
}

// resolve a place to {get, set}
function* resolvePlace(place, ctx) {
  if (!place) throw rtError(0, 'I need a list name here');
  if (place.p === 'var') {
    const name = place.name;
    return {
      get: () => readVar(ctx, name),
      set: (v) => writeVar(ctx, name, v, 'auto'),
    };
  }
  if (place.p === 'shared') {
    const H = ctx.inst.host;
    const name = place.name;
    return {
      get: () => (H.sharedGet ? H.sharedGet(name) : 0),
      set: (v) => { if (H.sharedSet) H.sharedSet(name, v); },
    };
  }
  // item N of <place>
  const outer = yield* resolvePlace(place.of, ctx);
  const idx = Math.round(num(yield* evalExpr(place.idx, ctx)));
  return {
    get: () => {
      const l = outer.get();
      if (!Array.isArray(l)) return 0;
      return idx >= 1 && idx <= l.length ? l[idx - 1] : 0;
    },
    set: (v) => {
      const l = outer.get();
      if (!Array.isArray(l)) throw rtError(place.line, 'that is not a list');
      if (idx < 1 || idx > l.length) throw rtError(place.line, `there is no item ${idx} (the list has ${l.length})`);
      l[idx - 1] = v;
    },
    list: () => {
      const l = outer.get();
      if (!Array.isArray(l)) throw rtError(place.line, 'that is not a list');
      return l;
    },
  };
}

function* listOf(place, ctx, line) {
  const ref = yield* resolvePlace(place, ctx);
  let l = ref.get();
  if (!Array.isArray(l)) {
    if (l === 0 || l === '' || l == null) { l = []; ref.set(l); }   // auto-create
    else throw rtError(line, 'that is not a list — make one with: set things to list');
  }
  return l;
}

// ------------------------------------------------------------ execution

function* execBlock(stmts, ctx) {
  for (const s of stmts) {
    const sig = yield* execStmt(s, ctx);
    if (sig) return sig;
  }
  return null;
}

function dirVec(dir, amt) {
  // returns [forward, side, up] in the object's local frame
  switch (dir) {
    case 'forward': return [amt, 0, 0];
    case 'back': case 'backward': return [-amt, 0, 0];
    case 'right': return [0, amt, 0];
    case 'left': return [0, -amt, 0];
    case 'up': return [0, 0, amt];
    case 'down': return [0, 0, -amt];
    default: return [0, 0, 0];
  }
}

function worldVec(dir, amt) {
  switch (dir) {
    case 'north': return [0, 0, -amt];
    case 'south': return [0, 0, amt];
    case 'east': return [amt, 0, 0];
    case 'west': return [-amt, 0, 0];
    case 'up': return [0, amt, 0];
    case 'down': return [0, -amt, 0];
    default: return null;
  }
}

function* execStmt(s, ctx) {
  const inst = ctx.inst;
  const H = inst.host;
  if (inst.dead) throw stopSignal('destroyed');
  if (++ctx.ops > OPS_BUDGET) { ctx.ops = 0; yield { frame: 1 }; }

  switch (s.op) {
    case 'set': {
      const v = yield* evalExpr(s.val, ctx);
      if (s.scope === 'shared') { if (H.sharedSet) H.sharedSet(s.name, v); }
      else writeVar(ctx, s.name, v, s.scope);
      return null;
    }
    case 'change': {
      const d = num(yield* evalExpr(s.val, ctx));
      if (s.scope === 'shared') {
        const cur = num(H.sharedGet ? H.sharedGet(s.name) : 0);
        if (H.sharedSet) H.sharedSet(s.name, cur + d);
      } else writeVar(ctx, s.name, num(readVar(ctx, s.name)) + d, s.scope);
      return null;
    }
    case 'setprop': {
      const v = num(yield* evalExpr(s.val, ctx));
      if (H.setProp) H.setProp(s.prop, v);
      return null;
    }
    case 'changeprop': {
      const d = num(yield* evalExpr(s.val, ctx));
      if (H.setProp && H.getProp) H.setProp(s.prop, num(H.getProp(s.prop)) + d);
      return null;
    }
    case 'setitem': {
      const val = yield* evalExpr(s.val, ctx);
      const ref = yield* resolvePlace(s.target, ctx);
      const l = ref.get();
      if (!Array.isArray(l)) throw rtError(s.line, 'that is not a list');
      const idx = Math.round(num(yield* evalExpr(s.idx, ctx)));
      if (idx < 1 || idx > l.length) throw rtError(s.line, `there is no item ${idx} (the list has ${l.length})`);
      l[idx - 1] = val;
      return null;
    }
    case 'listadd': {
      const val = yield* evalExpr(s.val, ctx);
      const l = yield* listOf(s.target, ctx, s.line);
      if (l.length >= MAX_LIST) throw rtError(s.line, `that list hit the ${MAX_LIST} item limit`);
      l.push(val);
      return null;
    }
    case 'listinsert': {
      const val = yield* evalExpr(s.val, ctx);
      const l = yield* listOf(s.target, ctx, s.line);
      const idx = Math.round(num(yield* evalExpr(s.idx, ctx)));
      if (l.length >= MAX_LIST) throw rtError(s.line, `that list hit the ${MAX_LIST} item limit`);
      l.splice(Math.max(0, Math.min(l.length, idx - 1)), 0, val);
      return null;
    }
    case 'listremove': {
      const l = yield* listOf(s.target, ctx, s.line);
      const idx = Math.round(num(yield* evalExpr(s.idx, ctx)));
      if (idx >= 1 && idx <= l.length) l.splice(idx - 1, 1);
      return null;
    }
    case 'listclear': {
      const l = yield* listOf(s.target, ctx, s.line);
      l.length = 0;
      return null;
    }
    case 'move': {
      const amt = num(yield* evalExpr(s.amt, ctx));
      const wv = worldVec(s.dir, amt);
      if (wv && H.move) H.move(wv[0], wv[1], wv[2]);
      else if (H.moveLocal) { const [f, si, u] = dirVec(s.dir, amt); H.moveLocal(f, si, u); }
      return null;
    }
    case 'push': {
      const amt = num(yield* evalExpr(s.amt, ctx));
      const wv = worldVec(s.dir, amt);
      if (wv && H.push) H.push(wv[0], wv[1], wv[2]);
      else if (H.pushLocal) { const [f, si, u] = dirVec(s.dir, amt); H.pushLocal(f, si, u); }
      return null;
    }
    case 'turn': {
      const amt = num(yield* evalExpr(s.amt, ctx));
      if (H.turn) H.turn(s.dir === 'left' ? -amt : amt);
      return null;
    }
    case 'turnto': {
      const amt = num(yield* evalExpr(s.amt, ctx));
      if (H.setYaw) H.setYaw(amt);
      return null;
    }
    case 'face': { if (H.faceTarget) H.faceTarget(s.what); return null; }
    case 'facexz': {
      const x = num(yield* evalExpr(s.x, ctx));
      const z = num(yield* evalExpr(s.z, ctx));
      if (H.facePoint) H.facePoint(x, z);
      return null;
    }
    case 'goto': {
      const x = num(yield* evalExpr(s.x, ctx));
      const y = num(yield* evalExpr(s.y, ctx));
      const z = s.z ? num(yield* evalExpr(s.z, ctx)) : null;
      if (H.setProp) {
        H.setProp('x', x);
        if (s.z) { H.setProp('y', y); H.setProp('z', z); }
        else { H.setProp('z', y); }   // two numbers = ground coordinates
      }
      return null;
    }
    case 'say': {
      const text = display(yield* evalExpr(s.text, ctx));
      const secs = s.secs ? num(yield* evalExpr(s.secs, ctx)) : 4;
      if (H.say) H.say(text, Math.max(0.2, Math.min(60, secs)));
      return null;
    }
    case 'write': {
      const text = display(yield* evalExpr(s.text, ctx));
      const x = num(yield* evalExpr(s.x, ctx));
      const y = num(yield* evalExpr(s.y, ctx));
      const size = s.size ? num(yield* evalExpr(s.size, ctx)) : 4;
      if (H.write) H.write(text, x, y, size, s.id);
      return null;
    }
    case 'unwrite': { if (H.unwrite) H.unwrite(s.id); return null; }
    case 'button': {
      const x = num(yield* evalExpr(s.x, ctx));
      const y = num(yield* evalExpr(s.y, ctx));
      if (H.button) H.button(s.label, x, y);
      return null;
    }
    case 'removebutton': { if (H.removeButton) H.removeButton(s.label); return null; }
    case 'show': { if (H.show) H.show(s.on); return null; }
    case 'flag': { if (H.flag) H.flag(s.flag, s.on); return null; }
    case 'color': { if (H.color) H.color(s.name); return null; }
    case 'grow': {
      const amt = num(yield* evalExpr(s.amt, ctx));
      if (H.grow) H.grow(amt);
      return null;
    }
    case 'spin': {
      const amt = num(yield* evalExpr(s.amt, ctx));
      if (H.spin) H.spin(amt);
      return null;
    }
    case 'spawn': {
      const x = s.x != null ? num(yield* evalExpr(s.x, ctx)) : null;
      const y = s.y != null ? num(yield* evalExpr(s.y, ctx)) : null;
      const z = s.z != null ? num(yield* evalExpr(s.z, ctx)) : null;
      // two numbers = ground coordinates (x, z)
      if (H.spawn) {
        if (s.z != null) H.spawn(s.model, x, y, z);
        else if (s.x != null) H.spawn(s.model, x, null, y);
        else H.spawn(s.model, null, null, null);
      }
      return null;
    }
    case 'vanish': { if (H.vanish) H.vanish(); throw stopSignal('vanished'); }
    case 'teleport': {
      const x = num(yield* evalExpr(s.x, ctx));
      const y = num(yield* evalExpr(s.y, ctx));
      const z = s.z != null ? num(yield* evalExpr(s.z, ctx)) : null;
      const pos = s.z != null ? [x, y, z] : [x, null, y];
      if (s.who === 'player') { if (H.teleportPlayer) H.teleportPlayer(pos[0], pos[1], pos[2]); }
      else if (H.setProp) {
        H.setProp('x', pos[0]);
        if (pos[1] != null) H.setProp('y', pos[1]);
        H.setProp('z', pos[2]);
      }
      return null;
    }
    case 'clearscreen': { if (H.screenClear) H.screenClear(s.color); return null; }
    case 'stamp': {
      const id = s.id != null ? s.id : display(yield* evalExpr(s.idExpr, ctx));
      const x = num(yield* evalExpr(s.x, ctx)), y = num(yield* evalExpr(s.y, ctx));
      const w = num(yield* evalExpr(s.w, ctx)), hh = num(yield* evalExpr(s.h, ctx));
      const color = s.color ? display(yield* evalExpr(s.color, ctx)) : null;
      if (H.screenStamp) H.screenStamp(id, x, y, w, hh, color);
      return null;
    }
    case 'sprint': {
      const text = display(yield* evalExpr(s.text, ctx));
      const x = num(yield* evalExpr(s.x, ctx)), y = num(yield* evalExpr(s.y, ctx));
      const size = s.size ? num(yield* evalExpr(s.size, ctx)) : 3;
      const color = s.color ? display(yield* evalExpr(s.color, ctx)) : null;
      if (H.screenPrint) H.screenPrint(s.id, text, x, y, size, color);
      return null;
    }
    case 'unstamp': {
      const id = s.id != null ? s.id : display(yield* evalExpr(s.idExpr, ctx));
      if (H.screenUnstamp) H.screenUnstamp(id);
      return null;
    }
    case 'sound': { if (H.sound) H.sound(s.name); return null; }
    case 'broadcast': { if (H.broadcast) H.broadcast(s.msg, s.everyone); return null; }
    case 'wait': {
      const t = num(yield* evalExpr(s.t, ctx));
      yield { wait: Math.max(0.005, t) };
      return null;
    }
    case 'freeze': { if (H.freeze) H.freeze(s.on); return null; }
    case 'shake': {
      const amt = num(yield* evalExpr(s.amt, ctx));
      if (H.shake) H.shake(amt);
      return null;
    }
    case 'halt': throw stopSignal('stop');
    case 'return': {
      const v = s.val ? yield* evalExpr(s.val, ctx) : '';
      return { kind: 'return', value: v };
    }
    case 'break': return { kind: 'break' };
    case 'continue': return { kind: 'continue' };
    case 'call': {
      yield* callFunction(s.name, s.args, ctx, s.line);
      return null;
    }
    case 'if': {
      if (truthy(yield* evalExpr(s.cond, ctx))) return yield* execBlock(s.body, ctx);
      if (s.elseBody) return yield* execBlock(s.elseBody, ctx);
      return null;
    }
    case 'repeat': {
      const n = Math.min(1e7, Math.max(0, Math.floor(num(yield* evalExpr(s.n, ctx)))));
      for (let i = 0; i < n; i++) {
        const sig = yield* execBlock(s.body, ctx);
        if (sig) {
          if (sig.kind === 'break') break;
          if (sig.kind !== 'continue') return sig;
        }
        if (ctx.ops > OPS_BUDGET) { ctx.ops = 0; yield { frame: 1 }; }
      }
      return null;
    }
    case 'count': {
      const from = num(yield* evalExpr(s.from, ctx));
      const to = num(yield* evalExpr(s.to, ctx));
      let by = s.by ? num(yield* evalExpr(s.by, ctx)) : (to < from ? -1 : 1);
      if (by === 0) by = to < from ? -1 : 1;
      let guard = 0;
      for (let v = from; by > 0 ? v <= to : v >= to; v += by) {
        writeVar(ctx, s.name, v, frame(ctx) ? 'local' : 'auto');
        const sig = yield* execBlock(s.body, ctx);
        if (sig) {
          if (sig.kind === 'break') break;
          if (sig.kind !== 'continue') return sig;
        }
        if (ctx.ops > OPS_BUDGET) { ctx.ops = 0; yield { frame: 1 }; }
        if (++guard > 1e7) throw rtError(s.line, 'this "repeat with" runs too long');
      }
      return null;
    }
    case 'foreach': {
      const src = yield* evalExpr(s.list, ctx);
      const items = Array.isArray(src) ? src.slice() : (typeof src === 'string' ? src.split('') : [src]);
      for (const it of items) {
        writeVar(ctx, s.name, it, frame(ctx) ? 'local' : 'auto');
        const sig = yield* execBlock(s.body, ctx);
        if (sig) {
          if (sig.kind === 'break') break;
          if (sig.kind !== 'continue') return sig;
        }
        if (ctx.ops > OPS_BUDGET) { ctx.ops = 0; yield { frame: 1 }; }
      }
      return null;
    }
    case 'while': {
      let guard = 0;
      while (truthy(yield* evalExpr(s.cond, ctx))) {
        const sig = yield* execBlock(s.body, ctx);
        if (sig) {
          if (sig.kind === 'break') break;
          if (sig.kind !== 'continue') return sig;
        }
        if (ctx.ops > OPS_BUDGET) { ctx.ops = 0; yield { frame: 1 }; }
        if (++guard > 5e6) throw rtError(s.line, 'this "while" never ends — change the condition or add a wait');
      }
      return null;
    }
    case 'forever': {
      while (true) {
        const sig = yield* execBlock(s.body, ctx);
        if (sig) {
          if (sig.kind === 'break') return null;
          if (sig.kind !== 'continue') return sig;
        }
        ctx.ops = 0;
        yield { frame: 1 };   // one pass per frame, like Scratch
      }
    }
    default:
      throw rtError(s.line, `unknown command "${s.op}"`);
  }
}

function* callFunction(name, argExprs, ctx, line) {
  const fn = ctx.inst.prog.functions.get(name);
  if (!fn) throw rtError(line, `there is no function called "${name}"`);
  if (ctx.depth >= MAX_DEPTH) throw rtError(line, `"${name}" called itself too many times (${MAX_DEPTH} deep)`);
  const args = [];
  for (const a of argExprs) args.push(yield* evalExpr(a, ctx));
  const locals = new Map();
  fn.params.forEach((p, i) => locals.set(p, i < args.length ? args[i] : 0));
  ctx.frames.push({ locals, name });
  ctx.depth++;
  try {
    const sig = yield* execBlock(fn.body, ctx);
    if (sig && sig.kind === 'return') return sig.value;
    return '';
  } finally {
    ctx.frames.pop();
    ctx.depth--;
  }
}

// evalExpr is a generator so user functions (which may `wait`) work in expressions
export function* evalExpr(x, ctx) {
  const inst = ctx.inst;
  const H = inst.host;
  if (!x) return 0;
  if (++ctx.ops > OPS_BUDGET * 8) { ctx.ops = 0; yield { frame: 1 }; }

  switch (x.e) {
    case 'num': case 'str': case 'bool': return x.v;
    case 'listlit': {
      const out = [];
      for (const it of x.items) out.push(yield* evalExpr(it, ctx));
      return out;
    }
    case 'var': return readVar(ctx, x.name);
    case 'shared': return H.sharedGet ? (H.sharedGet(x.name) ?? 0) : 0;
    case 'my':
      if (x.p === 'name') return H.getName ? H.getName() : '';
      return H.getProp ? num(H.getProp(x.p)) : 0;
    case 'player':
      if (x.p === 'name') return H.playerProp ? H.playerProp('name') : '';
      return H.playerProp ? num(H.playerProp(x.p)) : 0;
    case 'mouse': return H.mouse ? num(H.mouse(x.p)) : 0;
    case 'time': return H.time ? H.time() : inst.now;
    case 'biome': return H.biome ? H.biome() : 'void';
    case 'screenon': return H.screenOn ? !!H.screenOn() : false;
    case 'height': {
      const a = num(yield* evalExpr(x.x, ctx));
      const b = num(yield* evalExpr(x.z, ctx));
      return H.heightAt ? num(H.heightAt(a, b)) : 0;
    }
    case 'random': {
      const a = num(yield* evalExpr(x.a, ctx));
      const b = num(yield* evalExpr(x.b, ctx));
      const lo = Math.min(a, b), hi = Math.max(a, b);
      if (Number.isInteger(lo) && Number.isInteger(hi)) return lo + Math.floor(Math.random() * (hi - lo + 1));
      return lo + Math.random() * (hi - lo);
    }
    case 'distance': return H.distanceToPlayer ? num(H.distanceToPlayer()) : 0;
    case 'distancem': return H.distanceToModel ? num(H.distanceToModel(x.model)) : 0;
    case 'touching': return H.touching ? !!H.touching(x.what) : false;
    case 'keydown': return H.keyDown ? !!H.keyDown(x.name) : false;
    case 'count': return H.count ? num(H.count(x.model)) : 0;
    case 'item': {
      const l = yield* evalExpr(x.of, ctx);
      const i = Math.round(num(yield* evalExpr(x.idx, ctx)));
      if (Array.isArray(l)) return i >= 1 && i <= l.length ? l[i - 1] : '';
      const s = display(l);
      return i >= 1 && i <= s.length ? s[i - 1] : '';
    }
    case 'letter': {
      const s = display(yield* evalExpr(x.of, ctx));
      const i = Math.round(num(yield* evalExpr(x.idx, ctx)));
      return i >= 1 && i <= s.length ? s[i - 1] : '';
    }
    case 'length': {
      const v = yield* evalExpr(x.v, ctx);
      if (Array.isArray(v)) return v.length;
      return display(v).length;
    }
    case 'indexof': {
      const needle = yield* evalExpr(x.needle, ctx);
      const hay = yield* evalExpr(x.hay, ctx);
      if (Array.isArray(hay)) {
        for (let i = 0; i < hay.length; i++) if (looseEq(hay[i], needle)) return i + 1;
        return 0;
      }
      return display(hay).indexOf(display(needle)) + 1;
    }
    case 'contains': {
      const hay = yield* evalExpr(x.hay, ctx);
      const needle = yield* evalExpr(x.needle, ctx);
      if (Array.isArray(hay)) return hay.some(v => looseEq(v, needle));
      return display(hay).includes(display(needle));
    }
    case 'join': {
      const l = yield* evalExpr(x.list, ctx);
      const sep = display(yield* evalExpr(x.sep, ctx));
      return (Array.isArray(l) ? l : [l]).map(display).join(sep);
    }
    case 'neg': return -num(yield* evalExpr(x.v, ctx));
    case 'not': return !truthy(yield* evalExpr(x.v, ctx));
    case 'fn': {
      const raw = yield* evalExpr(x.v, ctx);
      switch (x.fn) {
        case 'text': return display(raw);
        case 'number': return num(raw);
        case 'uppercase': return display(raw).toUpperCase();
        case 'lowercase': return display(raw).toLowerCase();
      }
      const v = num(raw);
      switch (x.fn) {
        case 'round': return Math.round(v);
        case 'abs': return Math.abs(v);
        case 'floor': return Math.floor(v);
        case 'ceil': return Math.ceil(v);
        case 'sqrt': return v < 0 ? 0 : Math.sqrt(v);
        case 'sin': return Math.sin(v * Math.PI / 180);
        case 'cos': return Math.cos(v * Math.PI / 180);
        case 'tan': return Math.tan(v * Math.PI / 180);
      }
      return v;
    }
    case 'fn2': {
      const a = num(yield* evalExpr(x.a, ctx));
      const b = num(yield* evalExpr(x.b, ctx));
      return x.fn === 'min' ? Math.min(a, b) : Math.max(a, b);
    }
    case 'call': return yield* callFunction(x.name, x.args, ctx, x.line);
    case 'bin': {
      if (x.op === 'and') return truthy(yield* evalExpr(x.l, ctx)) ? truthy(yield* evalExpr(x.r, ctx)) : false;
      if (x.op === 'or') {
        if (truthy(yield* evalExpr(x.l, ctx))) return true;
        return truthy(yield* evalExpr(x.r, ctx));
      }
      const l = yield* evalExpr(x.l, ctx);
      const r = yield* evalExpr(x.r, ctx);
      switch (x.op) {
        case '+':
          if (Array.isArray(l) && Array.isArray(r)) return [...l, ...r];
          if (typeof l === 'string' || typeof r === 'string') {
            if (isNumeric(l) && isNumeric(r)) return num(l) + num(r);
            return display(l) + display(r);
          }
          return num(l) + num(r);
        case '-': return num(l) - num(r);
        case '*': return num(l) * num(r);
        case '/': { const d = num(r); return d === 0 ? 0 : num(l) / d; }
        case '%': { const d = num(r); return d === 0 ? 0 : num(l) % d; }
        case '=': return looseEq(l, r);
        case '!=': return !looseEq(l, r);
        case '<': return num(l) < num(r);
        case '>': return num(l) > num(r);
        case '<=': return num(l) <= num(r);
        case '>=': return num(l) >= num(r);
      }
      return 0;
    }
  }
  return 0;
}
