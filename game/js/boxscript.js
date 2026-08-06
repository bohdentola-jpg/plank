// boxscript — the tiny scripting language for "game".
//
// Design goals: reads like English, no punctuation ceremony, hard to crash.
// A script is a list of event blocks:
//
//   when touched
//     say "ouch!"
//     wait 1
//     vanish
//   end
//
// This module is pure (no DOM): the game/editor supply a `host` object with
// bindings (move, say, sound, ...). That also lets it run under node for tests.

// ---------------------------------------------------------------- tokenizer

const SYMBOLS = ['<=', '>=', '!=', '+', '-', '*', '/', '%', '(', ')', '<', '>', '=', ','];

export function tokenize(src) {
  const tokens = [];
  const errors = [];
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  for (let ln = 0; ln < lines.length; ln++) {
    let s = lines[ln];
    const hash = indexOfComment(s);
    if (hash >= 0) s = s.slice(0, hash);
    let i = 0;
    let any = false;
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t') { i++; continue; }
      any = true;
      if (ch === '"' || ch === '“' || ch === '”') {
        // string — accept smart quotes since users paste from phones/docs
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
        tokens.push({ t: 'num', v: parseFloat(num), line: ln + 1 });
        i = j;
        continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        let j = i, w = '';
        while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) { w += s[j]; j++; }
        tokens.push({ t: 'word', v: w.toLowerCase(), line: ln + 1 });
        i = j;
        continue;
      }
      const sym = SYMBOLS.find(x => s.startsWith(x, i));
      if (sym) { tokens.push({ t: 'sym', v: sym, line: ln + 1 }); i += sym.length; continue; }
      errors.push({ line: ln + 1, msg: `I don't understand the character "${ch}"` });
      i++;
    }
    if (any) tokens.push({ t: 'nl', line: ln + 1 });
  }
  tokens.push({ t: 'eof', line: lines.length });
  return { tokens, errors };
}

function indexOfComment(s) {
  // a # starts a comment unless inside a string
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === '“' || c === '”') inStr = !inStr;
    else if (c === '#' && !inStr) return i;
  }
  return -1;
}

// ---------------------------------------------------------------- parser

const KEY_NAMES = new Set(['space', 'up', 'down', 'left', 'right', 'enter',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
  'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

const DIRS = new Set(['up', 'down', 'left', 'right']);

class Parser {
  constructor(tokens) {
    this.toks = tokens;
    this.i = 0;
    this.errors = [];
  }
  peek(k = 0) { return this.toks[this.i + k] || this.toks[this.toks.length - 1]; }
  next() { return this.toks[this.i++] || this.toks[this.toks.length - 1]; }
  isWord(w, k = 0) { const t = this.peek(k); return t.t === 'word' && t.v === w; }
  isSym(s, k = 0) { const t = this.peek(k); return t.t === 'sym' && t.v === s; }
  eatWord(w) { if (this.isWord(w)) { this.next(); return true; } return false; }
  eatSym(s) { if (this.isSym(s)) { this.next(); return true; } return false; }
  err(msg, tok) {
    tok = tok || this.peek();
    this.errors.push({ line: tok.line, msg });
  }
  skipToNewline() {
    while (this.peek().t !== 'nl' && this.peek().t !== 'eof') this.next();
    if (this.peek().t === 'nl') this.next();
  }
  expectNewline(what) {
    if (this.peek().t === 'nl' || this.peek().t === 'eof') { if (this.peek().t === 'nl') this.next(); return true; }
    this.err(`unexpected extra stuff after ${what}: "${tokenText(this.peek())}"`);
    this.skipToNewline();
    return false;
  }
  skipBlankLines() { while (this.peek().t === 'nl') this.next(); }

  parseProgram() {
    const events = [];
    this.skipBlankLines();
    while (this.peek().t !== 'eof') {
      const ev = this.parseEvent();
      if (ev) events.push(ev);
      this.skipBlankLines();
    }
    return { events };
  }

  parseEvent() {
    const tok = this.peek();
    if (this.eatWord('when')) {
      const kindTok = this.next();
      if (kindTok.t !== 'word') { this.err('after "when" I need an event, like: when touched', kindTok); this.skipToNewline(); return null; }
      const kind = kindTok.v;
      let param = null;
      if (kind === 'start' || kind === 'tick' || kind === 'touched' || kind === 'clicked' || kind === 'hit') {
        // no param
      } else if (kind === 'key') {
        const k = this.next();
        const name = k.t === 'word' ? k.v : (k.t === 'num' ? String(k.v) : null);
        if (!name || !KEY_NAMES.has(name)) { this.err('"when key" needs a key name like space, e, up, left', k); }
        param = name || 'space';
        this.eatWord('pressed'); // optional flourish: when key e pressed
      } else if (kind === 'message') {
        const k = this.next();
        if (k.t === 'word' || k.t === 'str') param = String(k.v).toLowerCase();
        else this.err('"when message" needs a name, like: when message levelup', k);
      } else if (kind === 'button') {
        const k = this.next();
        if (k.t === 'str' || k.t === 'word') param = String(k.v);
        else this.err('"when button" needs the button label in quotes', k);
      } else {
        this.err(`I don't know the event "when ${kind}". Try: start, tick, touched, clicked, hit, key, message, button`, kindTok);
        this.skipToNewline();
        return null;
      }
      this.expectNewline(`"when ${kind}"`);
      const body = this.parseBlock(['end']);
      this.expectEnd('when ' + kind);
      return { kind, param, body, line: tok.line };
    }
    if (this.eatWord('every')) {
      const t = this.parseExpr();
      this.eatWord('seconds'); this.eatWord('second');
      this.expectNewline('"every"');
      const body = this.parseBlock(['end']);
      this.expectEnd('every');
      return { kind: 'every', param: t, body, line: tok.line };
    }
    this.err(`scripts are made of "when ..." blocks — I found "${tokenText(tok)}" outside one`, tok);
    this.skipToNewline();
    return null;
  }

  expectEnd(what) {
    if (this.eatWord('end')) {
      if (this.peek().t === 'nl') this.next();
      return;
    }
    this.err(`missing "end" to close "${what}"`);
  }

  // parse statements until one of the stop words (at line start) or eof
  parseBlock(stops) {
    const body = [];
    this.skipBlankLines();
    while (true) {
      const t = this.peek();
      if (t.t === 'eof') return body;
      if (t.t === 'word' && stops.includes(t.v)) return body;
      const s = this.parseStmt();
      if (s) body.push(s);
      this.skipBlankLines();
    }
  }

  parseStmt() {
    const tok = this.peek();
    if (tok.t !== 'word') {
      this.err(`I expected a command here, not "${tokenText(tok)}"`, tok);
      this.skipToNewline();
      return null;
    }
    const w = tok.v;
    const line = tok.line;
    const fin = (stmt) => { this.expectNewline(`"${w}"`); return { ...stmt, line }; };

    switch (w) {
      case 'set': {
        this.next();
        let shared = false;
        if (this.isWord('shared')) { this.next(); shared = true; }
        const nameTok = this.next();
        if (nameTok.t !== 'word') { this.err('"set" needs a name, like: set score to 0', nameTok); this.skipToNewline(); return null; }
        if (!this.eatWord('to')) this.err('"set" needs "to", like: set score to 0');
        const val = this.parseExpr();
        return fin({ op: 'set', shared, name: nameTok.v, val });
      }
      case 'change': {
        this.next();
        let shared = false;
        if (this.isWord('shared')) { this.next(); shared = true; }
        const nameTok = this.next();
        if (nameTok.t !== 'word') { this.err('"change" needs a name, like: change score by 1', nameTok); this.skipToNewline(); return null; }
        if (!this.eatWord('by')) this.err('"change" needs "by", like: change score by 1');
        const val = this.parseExpr();
        return fin({ op: 'change', shared, name: nameTok.v, val });
      }
      case 'move': {
        this.next();
        const dirTok = this.next();
        if (dirTok.t !== 'word' || !DIRS.has(dirTok.v)) { this.err('"move" needs a direction: move up 10', dirTok); this.skipToNewline(); return null; }
        const amt = this.parseExpr();
        return fin({ op: 'move', dir: dirTok.v, amt });
      }
      case 'goto': {
        this.next();
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        return fin({ op: 'goto', x, y });
      }
      case 'say': {
        this.next();
        const text = this.parseExpr();
        let secs = null;
        if (this.eatWord('for')) { secs = this.parseExpr(); this.eatWord('seconds'); this.eatWord('second'); }
        return fin({ op: 'say', text, secs });
      }
      case 'write': {
        this.next();
        const text = this.parseExpr();
        if (!this.eatWord('at')) this.err('"write" needs a place: write "hi" at 50, 20');
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        let size = null, id = null;
        while (true) {
          if (this.eatWord('size')) { size = this.parseExpr(); continue; }
          if (this.eatWord('as')) {
            const t = this.next();
            if (t.t === 'word' || t.t === 'str') id = String(t.v);
            else this.err('"as" needs a name, like: as scorelabel', t);
            continue;
          }
          break;
        }
        return fin({ op: 'write', text, x, y, size, id });
      }
      case 'unwrite': {
        this.next();
        const t = this.next();
        if (t.t === 'word' || t.t === 'str') return fin({ op: 'unwrite', id: String(t.v) });
        this.err('"unwrite" needs the name you wrote with "as" (or "all")', t);
        return fin({ op: 'unwrite', id: 'all' });
      }
      case 'button': {
        this.next();
        const t = this.next();
        let label = 'button';
        if (t.t === 'str' || t.t === 'word') label = String(t.v);
        else this.err('"button" needs a label in quotes: button "play" at 50, 60', t);
        if (!this.eatWord('at')) this.err('"button" needs a place: button "play" at 50, 60');
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        return fin({ op: 'button', label, x, y });
      }
      case 'remove': {
        this.next();
        if (this.eatWord('button')) {
          const t = this.next();
          const label = (t.t === 'str' || t.t === 'word') ? String(t.v) : '';
          return fin({ op: 'removebutton', label });
        }
        this.err('"remove" works like: remove button "play"');
        this.skipToNewline();
        return null;
      }
      case 'show': { this.next(); return fin({ op: 'show' }); }
      case 'hide': { this.next(); return fin({ op: 'hide' }); }
      case 'solid': {
        this.next();
        const on = this.eatWord('on') ? true : (this.eatWord('off') ? false : null);
        if (on === null) this.err('"solid" needs on or off: solid off');
        return fin({ op: 'solid', on: on !== false });
      }
      case 'color': {
        this.next();
        const t = this.next();
        const name = (t.t === 'word' || t.t === 'str') ? String(t.v).toLowerCase() : 'gray';
        if (t.t !== 'word' && t.t !== 'str') this.err('"color" needs a color name, like: color red', t);
        return fin({ op: 'color', name });
      }
      case 'grow': {
        this.next();
        const amt = this.parseExpr();
        return fin({ op: 'grow', amt });
      }
      case 'spawn': {
        this.next();
        const t = this.next();
        let model = 'box';
        if (t.t === 'word' || t.t === 'str') model = String(t.v);
        else this.err('"spawn" needs a model name: spawn box at 100, 50', t);
        let x = null, y = null;
        if (this.eatWord('at')) { x = this.parseExpr(); this.eatSym(','); y = this.parseExpr(); }
        return fin({ op: 'spawn', model, x, y });
      }
      case 'vanish': { this.next(); return fin({ op: 'vanish' }); }
      case 'push': {
        this.next();
        const dirTok = this.next();
        if (dirTok.t !== 'word' || !DIRS.has(dirTok.v)) { this.err('"push" needs a direction: push up 200', dirTok); this.skipToNewline(); return null; }
        const amt = this.parseExpr();
        return fin({ op: 'push', dir: dirTok.v, amt });
      }
      case 'teleport': {
        this.next();
        const who = this.eatWord('player') ? 'player' : (this.eatWord('me') ? 'me' : 'player');
        if (!this.eatWord('to')) this.err('"teleport" works like: teleport player to 100, 50');
        const x = this.parseExpr();
        this.eatSym(',');
        const y = this.parseExpr();
        return fin({ op: 'teleport', who, x, y });
      }
      case 'sound': {
        this.next();
        const t = this.next();
        const name = (t.t === 'word' || t.t === 'str') ? String(t.v).toLowerCase() : 'beep';
        if (t.t !== 'word' && t.t !== 'str') this.err('"sound" needs a name: sound pop', t);
        return fin({ op: 'sound', name });
      }
      case 'broadcast': {
        this.next();
        const t = this.next();
        let msg = '';
        if (t.t === 'word' || t.t === 'str') msg = String(t.v).toLowerCase();
        else this.err('"broadcast" needs a message name: broadcast levelup', t);
        let everyone = false;
        if (this.eatWord('to')) { this.eatWord('everyone'); everyone = true; }
        return fin({ op: 'broadcast', msg, everyone });
      }
      case 'wait': {
        this.next();
        const t = this.parseExpr();
        this.eatWord('seconds'); this.eatWord('second');
        return fin({ op: 'wait', t });
      }
      case 'freeze': { this.next(); this.eatWord('player'); return fin({ op: 'freeze' }); }
      case 'unfreeze': { this.next(); this.eatWord('player'); return fin({ op: 'unfreeze' }); }
      case 'shake': {
        this.next();
        const amt = this.parseExpr();
        return fin({ op: 'shake', amt });
      }
      case 'stop': { this.next(); return fin({ op: 'stop' }); }
      case 'if': {
        this.next();
        const cond = this.parseExpr();
        this.eatWord('then');
        this.expectNewline('"if"');
        const body = this.parseBlock(['else', 'end']);
        let elseBody = null;
        if (this.eatWord('else')) {
          if (this.peek().t === 'nl') this.next();
          elseBody = this.parseBlock(['end']);
        }
        this.expectEnd('if');
        return { op: 'if', cond, body, elseBody, line };
      }
      case 'repeat': {
        this.next();
        const n = this.parseExpr();
        this.eatWord('times');
        this.expectNewline('"repeat"');
        const body = this.parseBlock(['end']);
        this.expectEnd('repeat');
        return { op: 'repeat', n, body, line };
      }
      case 'while': {
        this.next();
        const cond = this.parseExpr();
        this.expectNewline('"while"');
        const body = this.parseBlock(['end']);
        this.expectEnd('while');
        return { op: 'while', cond, body, line };
      }
      case 'forever': {
        this.next();
        this.expectNewline('"forever"');
        const body = this.parseBlock(['end']);
        this.expectEnd('forever');
        return { op: 'forever', body, line };
      }
      case 'end':
      case 'else': {
        // handled by callers; reaching here means stray end/else
        this.next();
        this.err(`stray "${w}" — it doesn't close anything here`, tok);
        this.skipToNewline();
        return null;
      }
      default: {
        this.err(`I don't know the command "${w}"`, tok);
        this.skipToNewline();
        return null;
      }
    }
  }

  // ------------------------------------------------------------ expressions
  parseExpr() { return this.parseOr(); }
  parseOr() {
    let l = this.parseAnd();
    while (this.isWord('or')) { this.next(); const r = this.parseAnd(); l = { e: 'bin', op: 'or', l, r }; }
    return l;
  }
  parseAnd() {
    let l = this.parseCmp();
    while (this.isWord('and')) { this.next(); const r = this.parseCmp(); l = { e: 'bin', op: 'and', l, r }; }
    return l;
  }
  parseCmp() {
    let l = this.parseAdd();
    while (this.peek().t === 'sym' && ['=', '!=', '<', '>', '<=', '>='].includes(this.peek().v)) {
      const op = this.next().v;
      const r = this.parseAdd();
      l = { e: 'bin', op, l, r };
    }
    return l;
  }
  parseAdd() {
    let l = this.parseMul();
    while (this.peek().t === 'sym' && (this.peek().v === '+' || this.peek().v === '-')) {
      const op = this.next().v;
      const r = this.parseMul();
      l = { e: 'bin', op, l, r };
    }
    return l;
  }
  parseMul() {
    let l = this.parseUnary();
    while (this.peek().t === 'sym' && ['*', '/', '%'].includes(this.peek().v)) {
      const op = this.next().v;
      const r = this.parseUnary();
      l = { e: 'bin', op, l, r };
    }
    return l;
  }
  parseUnary() {
    if (this.isSym('-')) { this.next(); return { e: 'neg', v: this.parseUnary() }; }
    if (this.isWord('not')) { this.next(); return { e: 'not', v: this.parseUnary() }; }
    if (this.isWord('round')) { this.next(); return { e: 'fn', fn: 'round', v: this.parseUnary() }; }
    if (this.isWord('abs')) { this.next(); return { e: 'fn', fn: 'abs', v: this.parseUnary() }; }
    if (this.isWord('floor')) { this.next(); return { e: 'fn', fn: 'floor', v: this.parseUnary() }; }
    return this.parsePrimary();
  }
  parsePrimary() {
    const t = this.peek();
    if (t.t === 'num') { this.next(); return { e: 'num', v: t.v }; }
    if (t.t === 'str') { this.next(); return { e: 'str', v: t.v }; }
    if (this.eatSym('(')) {
      const inner = this.parseExpr();
      if (!this.eatSym(')')) this.err('missing closing )');
      return inner;
    }
    if (t.t === 'word') {
      const w = t.v;
      if (w === 'yes' || w === 'true') { this.next(); return { e: 'bool', v: true }; }
      if (w === 'no' || w === 'false') { this.next(); return { e: 'bool', v: false }; }
      if (w === 'time') { this.next(); return { e: 'time' }; }
      if (w === 'my') {
        this.next();
        const p = this.next();
        if (p.t === 'word' && ['x', 'y', 'size', 'name'].includes(p.v)) return { e: 'my', p: p.v };
        this.err('"my" knows: my x, my y, my size, my name', p);
        return { e: 'num', v: 0 };
      }
      if (w === 'player') {
        this.next();
        const p = this.next();
        if (p.t === 'word' && ['x', 'y', 'name'].includes(p.v)) return { e: 'player', p: p.v };
        this.err('"player" knows: player x, player y, player name', p);
        return { e: 'num', v: 0 };
      }
      if (w === 'mouse') {
        this.next();
        const p = this.next();
        if (p.t === 'word' && (p.v === 'x' || p.v === 'y')) return { e: 'mouse', p: p.v };
        this.err('"mouse" knows: mouse x, mouse y', p);
        return { e: 'num', v: 0 };
      }
      if (w === 'shared') {
        this.next();
        const p = this.next();
        if (p.t === 'word') return { e: 'shared', name: p.v };
        this.err('"shared" needs a name: shared score', p);
        return { e: 'num', v: 0 };
      }
      if (w === 'random') {
        this.next();
        const a = this.parseAdd();
        if (!this.eatWord('to')) this.err('"random" works like: random 1 to 10');
        const b = this.parseAdd();
        return { e: 'random', a, b };
      }
      if (w === 'distance') {
        this.next();
        this.eatWord('to'); this.eatWord('player');
        return { e: 'distance' };
      }
      if (w === 'touching') {
        this.next();
        const p = this.next();
        const what = (p.t === 'word' || p.t === 'str') ? String(p.v) : 'player';
        if (p.t !== 'word' && p.t !== 'str') this.err('"touching" works like: touching player', p);
        return { e: 'touching', what };
      }
      if (w === 'key') {
        this.next();
        const k = this.next();
        const name = k.t === 'word' ? k.v : (k.t === 'num' ? String(k.v) : 'space');
        if (!KEY_NAMES.has(name)) this.err('unknown key name for "key ... down"', k);
        this.eatWord('is'); this.eatWord('down');
        return { e: 'keydown', name };
      }
      if (w === 'count') {
        this.next();
        this.eatWord('of');
        const p = this.next();
        const model = (p.t === 'word' || p.t === 'str') ? String(p.v) : '';
        if (p.t !== 'word' && p.t !== 'str') this.err('"count" works like: count of box', p);
        return { e: 'count', model };
      }
      // plain variable
      this.next();
      return { e: 'var', name: w };
    }
    this.err(`I expected a value here, not "${tokenText(t)}"`, t);
    this.next();
    return { e: 'num', v: 0 };
  }
}

function tokenText(t) {
  if (t.t === 'nl') return 'end of line';
  if (t.t === 'eof') return 'end of script';
  if (t.t === 'str') return `"${t.v}"`;
  return String(t.v);
}

// compile source → { ok, errors: [{line,msg}], program }
export function compile(src) {
  const { tokens, errors: lexErrors } = tokenize(src);
  const p = new Parser(tokens);
  const program = p.parseProgram();
  const errors = [...lexErrors, ...p.errors];
  return { ok: errors.length === 0, errors, program };
}

// ---------------------------------------------------------------- runtime

export function truthy(v) { return !(v === false || v === 0 || v === '' || v == null); }
export function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}
export function display(v) {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
  return String(v);
}

function looseEq(a, b) {
  if (typeof a === 'number' || typeof b === 'number') {
    const an = num(a), bn = num(b);
    if ((typeof a === 'number' || String(a).trim() !== '' && isFinite(+a)) &&
        (typeof b === 'number' || String(b).trim() !== '' && isFinite(+b))) return an === bn;
  }
  return display(a) === display(b);
}

const OPS_BUDGET = 4000; // per fiber per frame; loops beyond this resume next frame

// One running script attached to one object.
// host bindings (all optional, sensible no-ops if missing):
//   getX/getY/getSize/getName, setX/setY/setSize
//   move(dx,dy) say(text,secs) write(text,x,y,size,id) unwrite(id)
//   button(label,x,y) removeButton(label) show(v) solid(v) color(name)
//   spawn(model,x,y) vanish() push(vx,vy) teleportPlayer(x,y)
//   sound(name) broadcast(msg,everyone) freeze(v) shake(amt)
//   playerX() playerY() playerName() mouseX() mouseY() keyDown(name)
//   touching(what) distanceToPlayer() count(model) time()
//   sharedGet(name) sharedSet(name,v) onError(line,msg)
export class ScriptInstance {
  constructor(program, host) {
    this.prog = program;
    this.host = host;
    this.vars = new Map();
    this.fibers = [];
    this.timers = []; // for `every`
    this.tickHandlers = [];
    this.dead = false;
    this.now = 0;
    for (const ev of program.events) {
      if (ev.kind === 'every') {
        this.timers.push({ ev, next: 0, period: null });
      } else if (ev.kind === 'tick') {
        this.tickHandlers.push({ ev, fiber: null });
      }
    }
  }

  start() {
    for (const ev of this.prog.events) {
      if (ev.kind === 'start') this.spawnFiber(ev.body);
    }
  }

  trigger(kind, param = null) {
    if (this.dead) return;
    for (const ev of this.prog.events) {
      if (ev.kind !== kind) continue;
      if (kind === 'key' || kind === 'message') {
        if (ev.param !== String(param).toLowerCase()) continue;
      } else if (kind === 'button') {
        if (String(ev.param).toLowerCase() !== String(param).toLowerCase()) continue;
      }
      this.spawnFiber(ev.body);
    }
  }

  spawnFiber(body) {
    const ctx = { inst: this, ops: 0 };
    this.fibers.push({ gen: execBlock(body, ctx), ctx, sleepUntil: 0 });
  }

  // advance all fibers. now = seconds since map start.
  update(now) {
    if (this.dead) return;
    this.now = now;
    // every-timers
    for (const tm of this.timers) {
      if (tm.period === null) {
        tm.period = Math.max(0.05, num(this.evalSafe(tm.ev.param)));
        tm.next = now + tm.period;
      }
      if (now >= tm.next) {
        tm.next = now + tm.period;
        this.spawnFiber(tm.ev.body);
      }
    }
    // tick handlers: one live fiber each; respawn when finished
    for (const th of this.tickHandlers) {
      if (!th.fiber || th.fiber.done) {
        const ctx = { inst: this, ops: 0 };
        th.fiber = { gen: execBlock(th.ev.body, ctx), ctx, sleepUntil: 0 };
        this.fibers.push(th.fiber);
      }
    }
    for (const f of this.fibers) this.stepFiber(f, now);
    this.fibers = this.fibers.filter(f => !f.done);
  }

  stepFiber(f, now) {
    if (f.done || now < f.sleepUntil) return;
    f.ctx.ops = 0;
    try {
      const r = f.gen.next();
      if (r.done) { f.done = true; return; }
      const y = r.value || {};
      if (y.wait) f.sleepUntil = now + num(y.wait);
      // {frame:1} → just resume next update
    } catch (err) {
      f.done = true;
      if (err && err.__bsstop) return;
      const line = (err && err.__bsline) || 0;
      this.reportError(line, err && err.__bsmsg ? err.__bsmsg : String(err && err.message || err));
    }
  }

  evalSafe(expr) {
    try { return evalExpr(expr, { inst: this, ops: 0 }); }
    catch (e) { return 0; }
  }

  reportError(line, msg) {
    if (this.host.onError) this.host.onError(line, msg);
  }

  destroy() { this.dead = true; this.fibers.length = 0; }
}

function rtError(line, msg) {
  const e = new Error(msg);
  e.__bsline = line;
  e.__bsmsg = msg;
  return e;
}

function* execBlock(stmts, ctx) {
  for (const s of stmts) yield* execStmt(s, ctx);
}

function dirDelta(dir, amt) {
  // boxscript user space: y grows UP. host.move receives user-space deltas.
  switch (dir) {
    case 'up': return [0, amt];
    case 'down': return [0, -amt];
    case 'left': return [-amt, 0];
    case 'right': return [amt, 0];
  }
  return [0, 0];
}

function* execStmt(s, ctx) {
  const inst = ctx.inst;
  const H = inst.host;
  if (inst.dead) { const e = new Error('stopped'); e.__bsstop = true; throw e; }
  ctx.ops++;
  switch (s.op) {
    case 'set': {
      const v = evalExpr(s.val, ctx);
      if (s.shared) H.sharedSet && H.sharedSet(s.name, v);
      else if (s.name === 'x' && H.setX) H.setX(num(v));
      else if (s.name === 'y' && H.setY) H.setY(num(v));
      else if (s.name === 'size' && H.setSize) H.setSize(num(v));
      else inst.vars.set(s.name, v);
      break;
    }
    case 'change': {
      const d = num(evalExpr(s.val, ctx));
      if (s.shared) {
        const cur = num(H.sharedGet ? H.sharedGet(s.name) : 0);
        H.sharedSet && H.sharedSet(s.name, cur + d);
      } else if (s.name === 'x' && H.setX) H.setX(num(H.getX ? H.getX() : 0) + d);
      else if (s.name === 'y' && H.setY) H.setY(num(H.getY ? H.getY() : 0) + d);
      else if (s.name === 'size' && H.setSize) H.setSize(num(H.getSize ? H.getSize() : 100) + d);
      else inst.vars.set(s.name, num(inst.vars.get(s.name)) + d);
      break;
    }
    case 'move': {
      const amt = num(evalExpr(s.amt, ctx));
      const [dx, dy] = dirDelta(s.dir, amt);
      H.move && H.move(dx, dy);
      break;
    }
    case 'goto': {
      const x = num(evalExpr(s.x, ctx)), y = num(evalExpr(s.y, ctx));
      H.setX && H.setX(x);
      H.setY && H.setY(y);
      break;
    }
    case 'say': {
      const text = display(evalExpr(s.text, ctx));
      const secs = s.secs ? num(evalExpr(s.secs, ctx)) : 4;
      H.say && H.say(text, secs);
      break;
    }
    case 'write': {
      const text = display(evalExpr(s.text, ctx));
      const x = num(evalExpr(s.x, ctx)), y = num(evalExpr(s.y, ctx));
      const size = s.size ? num(evalExpr(s.size, ctx)) : 4;
      H.write && H.write(text, x, y, size, s.id);
      break;
    }
    case 'unwrite': H.unwrite && H.unwrite(s.id); break;
    case 'button': {
      const x = num(evalExpr(s.x, ctx)), y = num(evalExpr(s.y, ctx));
      H.button && H.button(s.label, x, y);
      break;
    }
    case 'removebutton': H.removeButton && H.removeButton(s.label); break;
    case 'show': H.show && H.show(true); break;
    case 'hide': H.show && H.show(false); break;
    case 'solid': H.solid && H.solid(s.on); break;
    case 'color': H.color && H.color(s.name); break;
    case 'grow': {
      const amt = num(evalExpr(s.amt, ctx));
      H.setSize && H.setSize(num(H.getSize ? H.getSize() : 100) + amt);
      break;
    }
    case 'spawn': {
      const x = s.x != null ? num(evalExpr(s.x, ctx)) : null;
      const y = s.y != null ? num(evalExpr(s.y, ctx)) : null;
      H.spawn && H.spawn(s.model, x, y);
      break;
    }
    case 'vanish': {
      H.vanish && H.vanish();
      const e = new Error('vanished'); e.__bsstop = true; throw e;
    }
    case 'push': {
      const amt = num(evalExpr(s.amt, ctx));
      const [dx, dy] = dirDelta(s.dir, amt);
      H.push && H.push(dx, dy);
      break;
    }
    case 'teleport': {
      const x = num(evalExpr(s.x, ctx)), y = num(evalExpr(s.y, ctx));
      if (s.who === 'player') H.teleportPlayer && H.teleportPlayer(x, y);
      else { H.setX && H.setX(x); H.setY && H.setY(y); }
      break;
    }
    case 'sound': H.sound && H.sound(s.name); break;
    case 'broadcast': H.broadcast && H.broadcast(s.msg, s.everyone); break;
    case 'wait': {
      const t = num(evalExpr(s.t, ctx));
      yield { wait: Math.max(0.01, t) };
      break;
    }
    case 'freeze': H.freeze && H.freeze(true); break;
    case 'unfreeze': H.freeze && H.freeze(false); break;
    case 'shake': H.shake && H.shake(num(evalExpr(s.amt, ctx))); break;
    case 'stop': { const e = new Error('stop'); e.__bsstop = true; throw e; }
    case 'if': {
      if (truthy(evalExpr(s.cond, ctx))) yield* execBlock(s.body, ctx);
      else if (s.elseBody) yield* execBlock(s.elseBody, ctx);
      break;
    }
    case 'repeat': {
      const n = Math.min(100000, Math.max(0, Math.floor(num(evalExpr(s.n, ctx)))));
      for (let i = 0; i < n; i++) {
        yield* execBlock(s.body, ctx);
        if (ctx.ops > OPS_BUDGET) { ctx.ops = 0; yield { frame: 1 }; }
      }
      break;
    }
    case 'while': {
      let guard = 0;
      while (truthy(evalExpr(s.cond, ctx))) {
        yield* execBlock(s.body, ctx);
        if (ctx.ops > OPS_BUDGET) { ctx.ops = 0; yield { frame: 1 }; }
        if (++guard > 1000000) throw rtError(s.line, 'this "while" never ends — add a wait or make the condition change');
      }
      break;
    }
    case 'forever': {
      while (true) {
        yield* execBlock(s.body, ctx);
        ctx.ops = 0;
        yield { frame: 1 }; // forever loops run once per frame, like Scratch
      }
    }
    default:
      throw rtError(s.line, `unknown command "${s.op}"`);
  }
}

export function evalExpr(x, ctx) {
  const inst = ctx.inst;
  const H = inst.host;
  if (++ctx.ops > 2000000) throw rtError(0, 'expression too big');
  switch (x.e) {
    case 'num': return x.v;
    case 'str': return x.v;
    case 'bool': return x.v;
    case 'var': {
      if (inst.vars.has(x.name)) return inst.vars.get(x.name);
      return 0; // unset vars read as 0 — forgiving for beginners
    }
    case 'shared': return H.sharedGet ? (H.sharedGet(x.name) ?? 0) : 0;
    case 'my':
      if (x.p === 'x') return H.getX ? H.getX() : 0;
      if (x.p === 'y') return H.getY ? H.getY() : 0;
      if (x.p === 'size') return H.getSize ? H.getSize() : 100;
      if (x.p === 'name') return H.getName ? H.getName() : '';
      return 0;
    case 'player':
      if (x.p === 'x') return H.playerX ? H.playerX() : 0;
      if (x.p === 'y') return H.playerY ? H.playerY() : 0;
      if (x.p === 'name') return H.playerName ? H.playerName() : '';
      return 0;
    case 'mouse':
      return x.p === 'x' ? (H.mouseX ? H.mouseX() : 0) : (H.mouseY ? H.mouseY() : 0);
    case 'time': return H.time ? H.time() : inst.now;
    case 'random': {
      const a = num(evalExpr(x.a, ctx)), b = num(evalExpr(x.b, ctx));
      const lo = Math.min(a, b), hi = Math.max(a, b);
      if (Number.isInteger(lo) && Number.isInteger(hi)) return lo + Math.floor(Math.random() * (hi - lo + 1));
      return lo + Math.random() * (hi - lo);
    }
    case 'distance': return H.distanceToPlayer ? H.distanceToPlayer() : 0;
    case 'touching': return H.touching ? !!H.touching(x.what) : false;
    case 'keydown': return H.keyDown ? !!H.keyDown(x.name) : false;
    case 'count': return H.count ? H.count(x.model) : 0;
    case 'neg': return -num(evalExpr(x.v, ctx));
    case 'not': return !truthy(evalExpr(x.v, ctx));
    case 'fn': {
      const v = num(evalExpr(x.v, ctx));
      if (x.fn === 'round') return Math.round(v);
      if (x.fn === 'abs') return Math.abs(v);
      if (x.fn === 'floor') return Math.floor(v);
      return v;
    }
    case 'bin': {
      if (x.op === 'and') return truthy(evalExpr(x.l, ctx)) ? evalExpr(x.r, ctx) : false;
      if (x.op === 'or') {
        const l = evalExpr(x.l, ctx);
        return truthy(l) ? l : evalExpr(x.r, ctx);
      }
      const l = evalExpr(x.l, ctx), r = evalExpr(x.r, ctx);
      switch (x.op) {
        case '+':
          if (typeof l === 'string' || typeof r === 'string') return display(l) + display(r);
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

// list of key names, exported for the game's key mapper
export { KEY_NAMES };
