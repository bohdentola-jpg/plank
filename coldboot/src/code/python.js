// COLD BOOT — python.js
// A Python-subset interpreter for Lyosha's Night School. Plain ES module, no dependencies,
// no eval/Function. Source is tokenized, parsed to an AST and compiled to JS closures.
// Every statement costs a "step"; exceeding maxSteps raises TimeoutError so player code can
// never hang the page. Semantics and error messages follow CPython 3.13.
//
// Value mapping inside the VM:
//   int → JS number (safe integers) or BigInt (bigger)    float → PyFloat {v}
//   bool → JS boolean    None → null    str → JS string    list → JS Array
//   tuple → PyTuple      dict → PyDict  set/frozenset → PySet
//
// Public API: PyVM, runPython, toJS, toPy, pyRepr, pyFloat (see the bottom of this file).

/* eslint-disable no-fallthrough, no-control-regex */

// ===========================================================================
// 1. Constants
// ===========================================================================

const MAX_SAFE = 9007199254740991;
const BIG_MAX = 9007199254740991n;
const BIG_MIN = -9007199254740991n;
const BIG_LIMIT = 1n << 1000000n; // ints beyond ~301,000 digits raise MemoryError
const BIG_LIMIT_BITS = 1000000;
const MAX_SEQ = 10000000; // longest list / string the VM will build
const STOP = Symbol('STOP');
const BREAK = 1, CONTINUE = 2, RETURN = 3;
const TIMEOUT_MSG = 'your code ran for too long — is there a loop that never ends?';

let CUR = null; // the PyVM currently running

// ===========================================================================
// 2. Value classes
// ===========================================================================

export class PyFloat {
  constructor(v) { this.v = v; }
}
const F = (v) => new PyFloat(v);

export class PyTuple {
  constructor(items) { this.items = items; }
}
const EMPTY_TUPLE = new PyTuple([]);

export class PyDict {
  constructor() { this.m = new Map(); } // hkey -> [key, value]
  get(k) { const e = this.m.get(hkey(k)); return e === undefined ? undefined : e[1]; }
  set(k, v) {
    const h = hkey(k);
    const e = this.m.get(h);
    if (e !== undefined) e[1] = v; else this.m.set(h, [k, v]);
  }
  has(k) { return this.m.has(hkey(k)); }
  delete(k) { return this.m.delete(hkey(k)); }
  get size() { return this.m.size; }
  keys() { const out = []; for (const e of this.m.values()) out.push(e[0]); return out; }
  vals() { const out = []; for (const e of this.m.values()) out.push(e[1]); return out; }
  entries() { return Array.from(this.m.values()); }
  copy() { const d = new PyDict(); for (const [h, e] of this.m) d.m.set(h, [e[0], e[1]]); return d; }
}

export class PySet {
  constructor(frozen = false) { this.m = new Map(); this.frozen = frozen; this.order = null; } // hkey -> value
  add(v) { const h = hkey(v); if (!this.m.has(h)) { this.m.set(h, v); this.order = null; } }
  has(v) { return this.m.has(hkey(v)); }
  delete(v) { const ok = this.m.delete(hkey(v)); if (ok && this.order) this.order = this.order.filter((x) => this.m.has(hkey(x))); return ok; }
  get size() { return this.m.size; }
  // Iteration order. Sets of small ints follow CPython's hash-table layout (deterministic there);
  // anything else (strings hash randomly in CPython anyway) iterates in insertion order.
  vals() {
    if (this.order && this.order.length === this.m.size) return this.order.slice();
    const vals = Array.from(this.m.values());
    if (vals.length > 1 && vals.length <= 100000 && vals.every((v) => (typeof v === 'number' && v <= 2305843009213693950 && v >= -2305843009213693950) || typeof v === 'boolean')) {
      return cpythonIntSetOrder(vals).order;
    }
    return vals;
  }
  get cls() { return this.frozen ? T_frozenset : T_set; }
}

// Simulates CPython's setobject.c (sequential set_add_entry + set_table_resize) for int keys,
// so print({3, 1, 2}) shows {1, 2, 3} like real Python.
const intSetHash = (v) => { const x = typeof v === 'boolean' ? (v ? 1 : 0) : v; return x === -1 ? -2 : x; };
function cpythonIntSetOrder(vals, insertCleanSize = 0) {
  const hashOf = intSetHash;
  const place = (tbl, v) => {
    const h = hashOf(v), size = tbl.length, mask = size - 1;
    let i = ((h % size) + size) % size;
    let perturb = null;
    for (;;) {
      if (tbl[i] === undefined) { tbl[i] = v; return; }
      if (i + 9 <= mask) for (let j = 1; j <= 9; j++) if (tbl[i + j] === undefined) { tbl[i + j] = v; return; }
      if (perturb === null) perturb = BigInt.asUintN(64, BigInt(h));
      perturb >>= 5n;
      i = Number((BigInt(i) * 5n + 1n + perturb) & BigInt(mask));
    }
  };
  if (insertCleanSize) { // set_insert_clean into a fresh table of a given size (no resizing)
    const t = new Array(insertCleanSize);
    for (const v of vals) place(t, v);
    return { order: t.filter((x) => x !== undefined), size: insertCleanSize };
  }
  let table = new Array(8);
  let fill = 0;
  for (const v of vals) {
    place(table, v);
    fill++;
    if (fill * 5 >= (table.length - 1) * 3) {
      const minused = fill > 50000 ? fill * 2 : fill * 4;
      let ns = 8;
      while (ns <= minused) ns *= 2;
      const old = table;
      table = new Array(ns);
      for (const x of old) if (x !== undefined) place(table, x);
    }
  }
  return { order: table.filter((x) => x !== undefined), size: table.length };
}
// A constant set literal like {3, 1, 2} is compiled by CPython into a frozenset constant
// (built once, rebuilt when constants are merged) that is then merged into a new empty set.
function cpythonLiteralSetOrder(vals) {
  const l1 = cpythonIntSetOrder(vals);
  const l2 = cpythonIntSetOrder(l1.order);
  const n = vals.length;
  let size = 8;
  if (n * 5 >= 7 * 3) { size = 8; while (size <= 2 * n) size *= 2; }
  if (size === l2.size) return l2.order;
  return cpythonIntSetOrder(l2.order, size).order;
}

class PyRange {
  constructor(start, stop, step) {
    this.start = start; this.stop = stop; this.step = step;
    let n;
    if (step > 0) n = start < stop ? Math.floor((stop - start - 1) / step) + 1 : 0;
    else n = start > stop ? Math.floor((start - stop - 1) / -step) + 1 : 0;
    this.len = n;
  }
}

class PySlice {
  constructor(start, stop, step) { this.start = start; this.stop = stop; this.step = step; }
}

class PyFunction {
  constructor(spec, defaults, kwdefaults, closure) {
    this.spec = spec; this.defaults = defaults; this.kwdefaults = kwdefaults; this.closure = closure;
    this.name = spec.name; this.qualname = spec.qualname; this.doc = spec.doc;
  }
}

class PyBuiltin {
  // fn(args, kw) for plain builtins, fn(self, args, kw) when bound to `self`
  constructor(name, fn, self, doc, qual) {
    this.name = name; this.fn = fn; this.self = self; this.doc = doc || null; this.qual = qual || name;
  }
}

class PyModule {
  constructor(name, attrs, native = true) { this.name = name; this.attrs = attrs; this.native = native; }
}

class PyIterator {
  constructor(cls) { this.cls = cls; }
  next() { return STOP; }
}

class PyDictView {
  constructor(d, kind) { this.d = d; this.kind = kind; }
  get cls() { return this.kind === 'keys' ? T_dict_keys : this.kind === 'values' ? T_dict_values : T_dict_items; }
}

class PyEllipsis {}
const ELLIPSIS = new PyEllipsis();

export class PyException {
  constructor(cls, args) {
    this.cls = cls; this.args = args;
    this.line = undefined; this.col = undefined; this.eline = undefined; this.ecol = undefined;
    this.trace = null; this.where = null;
  }
}

export class PyType {
  constructor(name, base, opts = {}) {
    this.name = name; this.base = base || null;
    this.methods = Object.create(null); // name -> impl(self, args, kw)
    this.attrs = Object.create(null); // class-level attributes (e.g. dict.fromkeys)
    this.make = opts.make || null; // (args, kw) => value
    this.isExc = !!opts.isExc;
    this.module = opts.module || null;
  }
}

// ===========================================================================
// 3. Type objects
// ===========================================================================

const T = Object.create(null);
function mktype(name, base, opts) { const t = new PyType(name, base, opts); T[name] = t; return t; }
const T_object = mktype('object', null);
const T_int = mktype('int', T_object);
const T_bool = mktype('bool', T_int);
const T_float = mktype('float', T_object);
const T_str = mktype('str', T_object);
const T_list = mktype('list', T_object);
const T_tuple = mktype('tuple', T_object);
const T_dict = mktype('dict', T_object);
const T_set = mktype('set', T_object);
const T_frozenset = mktype('frozenset', T_object);
const T_range = mktype('range', T_object);
const T_slice = mktype('slice', T_object);
const T_none = mktype('NoneType', T_object);
const T_type = mktype('type', T_object);
const T_function = mktype('function', T_object);
const T_builtin = mktype('builtin_function_or_method', T_object);
const T_module = mktype('module', T_object);
const T_ellipsis = mktype('ellipsis', T_object);
const T_dict_keys = mktype('dict_keys', T_object);
const T_dict_values = mktype('dict_values', T_object);
const T_dict_items = mktype('dict_items', T_object);
const ITER_T = Object.create(null);
for (const n of ['list_iterator', 'tuple_iterator', 'str_ascii_iterator', 'range_iterator', 'dict_keyiterator',
  'dict_valueiterator', 'dict_itemiterator', 'set_iterator', 'enumerate', 'zip', 'map', 'filter',
  'list_reverseiterator', 'reversed', 'generator', 'callable_iterator']) ITER_T[n] = mktype(n, T_object);

PyFloat.prototype.cls = T_float;
PyTuple.prototype.cls = T_tuple;
PyDict.prototype.cls = T_dict;
PyRange.prototype.cls = T_range;
PySlice.prototype.cls = T_slice;
PyFunction.prototype.cls = T_function;
PyBuiltin.prototype.cls = T_builtin;
PyModule.prototype.cls = T_module;
PyType.prototype.cls = T_type;
PyEllipsis.prototype.cls = T_ellipsis;

// Exceptions
const EXC = Object.create(null);
function mkexc(name, base) { const t = mktype(name, base, { isExc: true }); EXC[name] = t; return t; }
const E_Base = mkexc('BaseException', T_object);
mkexc('SystemExit', E_Base);
mkexc('KeyboardInterrupt', E_Base);
const E_Exception = mkexc('Exception', E_Base);
mkexc('ArithmeticError', E_Exception);
mkexc('ZeroDivisionError', EXC.ArithmeticError);
mkexc('OverflowError', EXC.ArithmeticError);
mkexc('FloatingPointError', EXC.ArithmeticError);
mkexc('AssertionError', E_Exception);
mkexc('AttributeError', E_Exception);
mkexc('EOFError', E_Exception);
mkexc('ImportError', E_Exception);
mkexc('ModuleNotFoundError', EXC.ImportError);
mkexc('LookupError', E_Exception);
mkexc('IndexError', EXC.LookupError);
mkexc('KeyError', EXC.LookupError);
mkexc('MemoryError', E_Exception);
mkexc('NameError', E_Exception);
mkexc('UnboundLocalError', EXC.NameError);
mkexc('OSError', E_Exception);
mkexc('TimeoutError', EXC.OSError);
mkexc('RuntimeError', E_Exception);
mkexc('NotImplementedError', EXC.RuntimeError);
mkexc('RecursionError', EXC.RuntimeError);
mkexc('StopIteration', E_Exception);
mkexc('SyntaxError', E_Exception);
mkexc('IndentationError', EXC.SyntaxError);
mkexc('TabError', EXC.IndentationError);
mkexc('SystemError', E_Exception);
mkexc('TypeError', E_Exception);
mkexc('ValueError', E_Exception);
mkexc('UnicodeError', EXC.ValueError);

function typeOf(v) {
  switch (typeof v) {
    case 'number': case 'bigint': return T_int;
    case 'string': return T_str;
    case 'boolean': return T_bool;
    case 'object':
      if (v === null) return T_none;
      if (Array.isArray(v)) return T_list;
      return v.cls || T_object;
  }
  return T_object;
}
const tname = (v) => typeOf(v).name;

function isSubtype(t, base) {
  for (; t; t = t.base) if (t === base) return true;
  return false;
}

// ===========================================================================
// 4. Errors
// ===========================================================================

function exc(name, msg) { return new PyException(EXC[name], msg === undefined ? [] : [msg]); }
const TypeErr = (m) => exc('TypeError', m);
const ValueErr = (m) => exc('ValueError', m);
const IndexErr = (m) => exc('IndexError', m);
const ZeroDiv = (m) => exc('ZeroDivisionError', m);
const OverflowErr = (m) => exc('OverflowError', m);
const MemoryErr = () => exc('MemoryError', "that's too big for this laptop");
const KeyErr = (k) => new PyException(EXC.KeyError, [k]);
const unhashable = (v) => TypeErr(`unhashable type: '${tname(v)}'`);

function attrError(obj, name) {
  const e = typeOf(obj) === T_module
    ? exc('AttributeError', `module '${obj.name}' has no attribute '${name}'`)
    : typeOf(obj) === T_type
      ? exc('AttributeError', `type object '${obj.name}' has no attribute '${name}'`)
      : exc('AttributeError', `'${tname(obj)}' object has no attribute '${name}'`);
  e.attrName = name; e.attrObj = obj;
  return e;
}

// ===========================================================================
// 5. Numbers
// ===========================================================================

function normBig(b) { return (b <= BIG_MAX && b >= BIG_MIN) ? Number(b) : b; }
function bigGuard(b) {
  if (typeof b === 'bigint' && (b > BIG_LIMIT || b < -BIG_LIMIT)) throw MemoryErr();
  return b;
}
const toBig = (v) => (typeof v === 'bigint' ? v : BigInt(v));
const isIntV = (v) => typeof v === 'number' || typeof v === 'bigint';
const isIntLike = (v) => typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean';
const intOf = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v); // bool -> int

// JS double from int/bool/float
function fval(v) {
  if (v instanceof PyFloat) return v.v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const f = Number(v);
  if (!isFinite(f)) throw OverflowErr('int too large to convert to float');
  return f;
}
const isNum = (v) => typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean' || v instanceof PyFloat;

function iAdd(a, b) {
  if (typeof a === 'number' && typeof b === 'number') { const r = a + b; if (r <= MAX_SAFE && r >= -MAX_SAFE) return r; }
  return normBig(toBig(a) + toBig(b));
}
function iSub(a, b) {
  if (typeof a === 'number' && typeof b === 'number') { const r = a - b; if (r <= MAX_SAFE && r >= -MAX_SAFE) return r; }
  return normBig(toBig(a) - toBig(b));
}
function iMul(a, b) {
  if (typeof a === 'number' && typeof b === 'number') { const r = a * b; if (r <= MAX_SAFE && r >= -MAX_SAFE) return r + 0; }
  return bigGuard(normBig(toBig(a) * toBig(b)));
}
function iFloorDiv(a, b) {
  if (b == 0) throw ZeroDiv('integer division or modulo by zero');
  if (typeof a === 'number' && typeof b === 'number') return Math.floor(a / b) + 0;
  const A = toBig(a), B = toBig(b);
  let q = A / B;
  if ((A % B !== 0n) && ((A < 0n) !== (B < 0n))) q -= 1n;
  return normBig(q);
}
function iMod(a, b, msg = 'integer modulo by zero') {
  if (b == 0) throw ZeroDiv(msg);
  if (typeof a === 'number' && typeof b === 'number') {
    let r = a % b;
    if (r !== 0 && (r < 0) !== (b < 0)) r += b;
    return r + 0;
  }
  const A = toBig(a), B = toBig(b);
  let r = A % B;
  if (r !== 0n && ((r < 0n) !== (B < 0n))) r += B;
  return normBig(r);
}
function iNeg(a) { return typeof a === 'number' ? 0 - a : normBig(-a); }
function iAbs(a) { return typeof a === 'number' ? Math.abs(a) : normBig(a < 0n ? -a : a); }
function iPow(a, b) {
  if (b < 0) {
    const fa = fval(a);
    if (fa === 0) throw ZeroDiv('0.0 cannot be raised to a negative power');
    return F(Math.pow(fa, fval(b)));
  }
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === 0 || a === 1) return b === 0 ? 1 : a;
    if (a === -1) return b % 2 === 0 ? 1 : -1;
    const est = Math.abs(a) ** b;
    if (est < MAX_SAFE) { // exact by repeated squaring (all partial products are below 2^53)
      let r = 1, base = a, e = b;
      while (e > 0) { if (e & 1) r *= base; e = Math.floor(e / 2); if (e) base *= base; }
      return r + 0;
    }
    const bits = Math.log2(Math.abs(a)) * b;
    if (bits > BIG_LIMIT_BITS) throw MemoryErr();
  } else {
    const A = toBig(a);
    if (A === 0n || A === 1n) return b == 0 ? 1 : normBig(A);
    if (A === -1n) return toBig(b) % 2n === 0n ? 1 : -1;
    if (toBig(b) > BigInt(BIG_LIMIT_BITS)) throw MemoryErr();
    const bits = (A < 0n ? -A : A).toString(2).length * Number(b);
    if (bits > BIG_LIMIT_BITS + 64) throw MemoryErr();
  }
  return bigGuard(normBig(toBig(a) ** toBig(b)));
}
function iShl(a, b) {
  if (b < 0) throw ValueErr('negative shift count');
  if (typeof a === 'number' && typeof b === 'number' && b < 53) {
    const r = a * 2 ** b;
    if (r <= MAX_SAFE && r >= -MAX_SAFE) return r + 0;
  }
  if (a == 0) return 0;
  if (b > BIG_LIMIT_BITS) throw MemoryErr();
  return bigGuard(normBig(toBig(a) << toBig(b)));
}
function iShr(a, b) {
  if (b < 0) throw ValueErr('negative shift count');
  if (typeof a === 'number' && typeof b === 'number') {
    if (b >= 64) return a < 0 ? -1 : 0;
    return Math.floor(a / 2 ** b) + 0;
  }
  if (typeof b === 'bigint' && b > 100000000n) return a < 0 ? -1 : 0;
  return normBig(toBig(a) >> toBig(b));
}
function iBit(op, a, b) {
  if (typeof a === 'number' && typeof b === 'number' && (a | 0) === a && (b | 0) === b) {
    return op === '&' ? a & b : op === '|' ? a | b : a ^ b;
  }
  const A = toBig(a), B = toBig(b);
  return normBig(op === '&' ? A & B : op === '|' ? A | B : A ^ B);
}

// float // and % exactly as CPython's _float_div_mod
function floatDivMod(vx, wx) {
  let mod = vx % wx;
  let div = (vx - mod) / wx;
  if (mod) {
    if ((wx < 0) !== (mod < 0)) { mod += wx; div -= 1.0; }
  } else {
    mod = wx < 0 ? -0 : 0;
  }
  let floordiv;
  if (div) {
    floordiv = Math.floor(div);
    if (div - floordiv > 0.5) floordiv += 1.0;
  } else {
    floordiv = (vx / wx) < 0 || Object.is(vx / wx, -0) ? -0 : 0;
  }
  return [floordiv, mod];
}

function floatPow(x, y) {
  if (x === 0 && y < 0) throw ZeroDiv('0.0 cannot be raised to a negative power');
  if (x < 0 && isFinite(x) && y !== Math.floor(y) && isFinite(y)) {
    throw ValueErr('negative number cannot be raised to a fractional power (that would be a complex number)');
  }
  const r = Math.pow(x, y);
  if (!isFinite(r) && isFinite(x) && isFinite(y)) throw OverflowErr("(34, 'Numerical result out of range')");
  return r;
}

// Python int() of a float
function floatToInt(x) {
  if (x !== x) throw ValueErr('cannot convert float NaN to integer');
  if (!isFinite(x)) throw OverflowErr('cannot convert float infinity to integer');
  const t = Math.trunc(x) + 0;
  if (t <= MAX_SAFE && t >= -MAX_SAFE) return t;
  return BigInt(t);
}

// Python's round-half-even for floats to an int
function roundHalfEven(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

// --- exact decimal conversion of doubles (for correct rounding like CPython) ---
const DV = new DataView(new ArrayBuffer(8));
function decompose(x) { // x finite, >= 0  ->  [mantissa BigInt, exponent] with x = m * 2^e
  DV.setFloat64(0, x);
  const hi = DV.getUint32(0), lo = DV.getUint32(4);
  const eb = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e;
  if (eb === 0) e = -1074; else { m |= 1n << 52n; e = eb - 1075; }
  return [m, e];
}
const POW10 = [];
function pow10n(k) { return k < 64 ? (POW10[k] ??= 10n ** BigInt(k)) : 10n ** BigInt(k); }
// round_half_even(x * 10^p) as BigInt, x >= 0 finite
function scaledRound(x, p) {
  if (x === 0) return 0n;
  const [m, e] = decompose(x);
  let num = m, den = 1n;
  if (e >= 0) num <<= BigInt(e); else den <<= BigInt(-e);
  if (p >= 0) num *= pow10n(p); else den *= pow10n(-p);
  let q = num / den;
  const r2 = (num - q * den) * 2n;
  if (r2 > den || (r2 === den && (q & 1n) === 1n)) q += 1n;
  return q;
}
// n significant digits (rounded half-even) of x > 0: {digits, decpt} with x ≈ 0.digits * 10^decpt
function sigDigits(x, n) {
  let E = Math.floor(Math.log10(x));
  for (let tries = 0; tries < 4; tries++) {
    const N = scaledRound(x, n - 1 - E);
    if (N >= pow10n(n)) { E += 1; continue; }
    if (N < pow10n(n - 1)) { E -= 1; continue; }
    return { digits: N.toString(), decpt: E + 1 };
  }
  const N = scaledRound(x, n - 1 - E);
  return { digits: N.toString().slice(0, n), decpt: E + 1 };
}
// shortest round-trip digits (like repr)
function shortestDigits(x) {
  if (x === 0) return { digits: '0', decpt: 1 };
  const s = x.toExponential();
  const ei = s.indexOf('e');
  return { digits: s.slice(0, ei).replace('.', ''), decpt: parseInt(s.slice(ei + 1), 10) + 1 };
}
// CPython's format_float_short for codes 'r', 'e', 'g' (x >= 0 finite)
function fmtShort(x, code, prec, addDot0, alt) {
  let digits, decpt;
  if (code === 'r') ({ digits, decpt } = shortestDigits(x));
  else if (x === 0) { digits = '0'; decpt = 1; }
  else {
    ({ digits, decpt } = sigDigits(x, code === 'e' ? prec + 1 : prec));
    digits = digits.replace(/0+$/, '');
    if (!digits) digits = '0';
  }
  let useExp = false, vEnd = digits.length;
  if (code === 'e') { useExp = true; vEnd = prec + 1; }
  else if (code === 'g') {
    if (decpt <= -4 || decpt > (addDot0 ? prec - 1 : prec)) useExp = true;
    if (alt) vEnd = prec;
  } else if (code === 'r') {
    if (decpt <= -4 || decpt > 16) useExp = true;
  }
  let exp = 0;
  if (useExp) { exp = decpt - 1; decpt = 1; }
  const vStart = decpt <= 0 ? decpt - 1 : 0;
  if (!useExp && addDot0) vEnd = Math.max(vEnd, decpt + 1); else vEnd = Math.max(vEnd, decpt);
  let s = '';
  if (decpt <= 0) s += '0'.repeat(decpt - vStart) + '.' + '0'.repeat(-decpt);
  else s += '0'.repeat(-vStart);
  if (decpt > 0 && decpt <= digits.length) s += digits.slice(0, decpt) + '.' + digits.slice(decpt);
  else s += digits;
  if (digits.length < decpt) s += '0'.repeat(decpt - digits.length) + '.' + '0'.repeat(vEnd - decpt);
  else s += '0'.repeat(Math.max(0, vEnd - digits.length));
  if (s.endsWith('.') && !alt) s = s.slice(0, -1);
  if (useExp) s += 'e' + (exp < 0 ? '-' : '+') + String(Math.abs(exp)).padStart(2, '0');
  return s;
}
function fmtFixed(x, prec, alt) { // x >= 0 finite
  let s = scaledRound(x, prec).toString();
  if (prec > 0) {
    s = s.padStart(prec + 1, '0');
    s = s.slice(0, s.length - prec) + '.' + s.slice(s.length - prec);
  } else if (alt) s += '.';
  return s;
}

function floatRepr(x) {
  if (x !== x) return 'nan';
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  if (x < 0) return '-' + fmtShort(-x, 'r', 0, true, false);
  return fmtShort(x, 'r', 0, true, false);
}

// round(x, n) for floats, correctly rounded like CPython
function roundFloat(x, n) {
  if (!isFinite(x) || x === 0) return x;
  if (n > 330) return x;
  if (n < -330) return x < 0 ? -0 : 0;
  const neg = x < 0;
  const N = scaledRound(Math.abs(x), n);
  let r;
  if (n >= 0) r = parseFloat(N.toString() + 'e-' + n);
  else r = parseFloat(N.toString() + 'e' + (-n));
  if (!isFinite(r)) throw OverflowErr('rounded value too large to represent');
  return neg ? -r : r;
}

// ===========================================================================
// 6. Hashing (dict keys / set items)
// ===========================================================================

const OBJ_IDS = new WeakMap();
let nextObjId = 1;
function objId(o) {
  let id = OBJ_IDS.get(o);
  if (id === undefined) { id = nextObjId++; OBJ_IDS.set(o, id); }
  return id;
}
function fakeAddr(o) { return '0x7f' + (0x3a2c1000 + objId(o) * 0x30).toString(16).padStart(10, '0'); }

function hkey(k) {
  switch (typeof k) {
    case 'string': case 'number': case 'bigint': return k;
    case 'boolean': return k ? 1 : 0;
    case 'object':
      if (k === null) return null;
      if (k instanceof PyFloat) {
        const v = k.v;
        if (Number.isInteger(v)) return (v <= MAX_SAFE && v >= -MAX_SAFE) ? v + 0 : BigInt(v);
        return v;
      }
      if (k instanceof PyTuple) return '\u0000\udfff' + tupleKey(k);
      if (Array.isArray(k) || k instanceof PyDict || (k instanceof PySet && !k.frozen) || k instanceof PyDictView) throw unhashable(k);
      if (k instanceof PySet) return '\u0000\udffe' + frozenKey(k);
      return k; // identity-hashed objects
  }
  return k;
}
function partKey(v) {
  switch (typeof v) {
    case 'string': return 's' + v.length + ':' + v;
    case 'number': return 'n' + v;
    case 'bigint': return 'n' + v.toString();
    case 'boolean': return v ? 'n1' : 'n0';
  }
  if (v === null) return 'N';
  if (v instanceof PyFloat) {
    const h = hkey(v);
    return typeof h === 'bigint' || Number.isInteger(h) ? 'n' + h : 'f' + h;
  }
  if (v instanceof PyTuple) return tupleKey(v);
  if (v instanceof PySet && v.frozen) return 'F' + frozenKey(v);
  hkey(v); // throws for unhashable
  return 'o' + objId(v);
}
function tupleKey(t) {
  let s = '(';
  for (const it of t.items) s += partKey(it) + ',';
  return s + ')';
}
function frozenKey(s) { return '{' + s.vals().map(partKey).sort().join(',') + '}'; }

// ===========================================================================
// 7. repr / str
// ===========================================================================

function bigStr(v) {
  const s = v.toString();
  if (s.length - (v < 0n ? 1 : 0) > 4300) {
    throw ValueErr('Exceeds the limit (4300 digits) for integer string conversion; use sys.set_int_max_str_digits() to increase the limit');
  }
  return s;
}

const RE_NONPRINT = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]/u;
const hexn = (c, n) => c.toString(16).padStart(n, '0');
function isPrintableChar(ch) { return ch === ' ' || !RE_NONPRINT.test(ch); }

function strRepr(s, ascii = false) {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  if (/^[\x20-\x26\x28-\x5b\x5d-\x7e]*$/.test(s) && (q === "'" || !s.includes('"'))) return q + s + q;
  let out = q;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === q || ch === '\\') out += '\\' + ch;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20 || c === 0x7f) out += '\\x' + hexn(c, 2);
    else if (c < 0x7f) out += ch;
    else if (!ascii && isPrintableChar(ch)) out += ch;
    else if (c <= 0xff) out += '\\x' + hexn(c, 2);
    else if (c <= 0xffff) out += '\\u' + hexn(c, 4);
    else out += '\\U' + hexn(c, 8);
  }
  return out + q;
}

function repr(v) { return reprX(v, null); }
function reprX(v, seen) {
  switch (typeof v) {
    case 'number': return String(v);
    case 'bigint': return bigStr(v);
    case 'string': return strRepr(v);
    case 'boolean': return v ? 'True' : 'False';
  }
  if (v === null) return 'None';
  if (v instanceof PyFloat) return floatRepr(v.v);
  if (Array.isArray(v)) {
    if (seen && seen.has(v)) return '[...]';
    (seen ||= new Set()).add(v);
    let s = '[';
    for (let i = 0; i < v.length; i++) { if (i) s += ', '; s += reprX(v[i], seen); }
    seen.delete(v);
    return s + ']';
  }
  if (v instanceof PyTuple) {
    const it = v.items;
    if (it.length === 1) return '(' + reprX(it[0], seen) + ',)';
    let s = '(';
    for (let i = 0; i < it.length; i++) { if (i) s += ', '; s += reprX(it[i], seen); }
    return s + ')';
  }
  if (v instanceof PyDict) {
    if (seen && seen.has(v)) return '{...}';
    (seen ||= new Set()).add(v);
    let s = '{', first = true;
    for (const e of v.m.values()) {
      if (!first) s += ', ';
      first = false;
      s += reprX(e[0], seen) + ': ' + reprX(e[1], seen);
    }
    seen.delete(v);
    return s + '}';
  }
  if (v instanceof PySet) {
    const vals = v.vals();
    if (v.frozen) return vals.length ? 'frozenset({' + vals.map((x) => reprX(x, seen)).join(', ') + '})' : 'frozenset()';
    return vals.length ? '{' + vals.map((x) => reprX(x, seen)).join(', ') + '}' : 'set()';
  }
  if (v instanceof PyRange) return v.step === 1 ? `range(${v.start}, ${v.stop})` : `range(${v.start}, ${v.stop}, ${v.step})`;
  if (v instanceof PyFunction) return `<function ${v.qualname} at ${fakeAddr(v)}>`;
  if (v instanceof PyBuiltin) {
    if (v.self !== undefined && v.self !== null) return `<built-in method ${v.name} of ${tname(v.self)} object at ${fakeAddr(v.self)}>`;
    return `<built-in function ${v.name}>`;
  }
  if (v instanceof PyType) return `<class '${v.module ? v.module + '.' : ''}${v.name}'>`;
  if (v instanceof PyModule) return v.native ? `<module '${v.name}' (built-in)>` : `<module '${v.name}'>`;
  if (v instanceof PyException) {
    const a = v.args;
    return v.cls.name + '(' + a.map((x) => reprX(x, seen)).join(', ') + ')';
  }
  if (v instanceof PyDictView) {
    const items = v.kind === 'keys' ? v.d.keys() : v.kind === 'values' ? v.d.vals() : v.d.entries().map((e) => new PyTuple([e[0], e[1]]));
    return `${v.cls.name}([${items.map((x) => reprX(x, seen)).join(', ')}])`;
  }
  if (v instanceof PySlice) return `slice(${reprX(v.start, seen)}, ${reprX(v.stop, seen)}, ${reprX(v.step, seen)})`;
  if (v instanceof PyEllipsis) return 'Ellipsis';
  if (v instanceof PyIterator) return `<${v.cls.name} object at ${fakeAddr(v)}>`;
  return `<${tname(v)} object at ${fakeAddr(v)}>`;
}

function excStr(e) {
  const a = e.args;
  if (a.length === 0) return '';
  if (a.length === 1) return e.cls === EXC.KeyError ? repr(a[0]) : str(a[0]);
  return repr(new PyTuple(a));
}

function str(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v instanceof PyException) return excStr(v);
  return reprX(v, null);
}

function asciiRepr(v) {
  const r = repr(v);
  let out = '';
  for (const ch of r) {
    const c = ch.codePointAt(0);
    out += c < 0x80 ? ch : c <= 0xff ? '\\x' + hexn(c, 2) : c <= 0xffff ? '\\u' + hexn(c, 4) : '\\U' + hexn(c, 8);
  }
  return out;
}

// ===========================================================================
// 8. format() mini-language, str.format, %-formatting
// ===========================================================================

const isDigitCh = (c) => c >= '0' && c <= '9';

function parseSpec(spec, v) {
  const n = spec.length;
  let i = 0, fill = null, align = null, sign = null, z = false, alt = false, width = -1, grouping = null, prec = -1, type = null;
  if (n >= 2 && '<>=^'.includes(spec[1])) { fill = spec[0]; align = spec[1]; i = 2; }
  else if (n >= 1 && '<>=^'.includes(spec[0])) { align = spec[0]; i = 1; }
  if (i < n && '+- '.includes(spec[i])) sign = spec[i++];
  if (i < n && spec[i] === 'z') { z = true; i++; }
  if (i < n && spec[i] === '#') { alt = true; i++; }
  let zeroFlag = false;
  if (i < n && spec[i] === '0') { zeroFlag = true; i++; }
  const ws = i;
  while (i < n && isDigitCh(spec[i])) i++;
  if (i > ws) width = parseInt(spec.slice(ws, i), 10);
  else if (zeroFlag) width = 0;
  if (zeroFlag && i > ws) width = parseInt(spec.slice(ws - 1, i), 10);
  if (i < n && (spec[i] === ',' || spec[i] === '_')) grouping = spec[i++];
  if (i < n && spec[i] === '.') {
    i++;
    const ps = i;
    while (i < n && isDigitCh(spec[i])) i++;
    if (i === ps) throw ValueErr('Format specifier missing precision');
    prec = parseInt(spec.slice(ps, i), 10);
  }
  if (i < n) type = spec[i++];
  if (i < n) throw ValueErr(`Invalid format specifier '${spec}' for object of type '${tname(v)}'`);
  return { fill, align, sign, z, alt, zeroFlag, width, grouping, prec, type };
}

function padStr(body, sp, defAlign, prefix = '') {
  const total = prefix.length + body.length;
  let fill = sp.fill, align = sp.align;
  if (sp.zeroFlag && fill === null) { fill = '0'; if (align === null && defAlign === '>') align = '='; }
  if (fill === null) fill = ' ';
  if (align === null) align = defAlign;
  if (sp.width <= total) return prefix + body;
  const k = sp.width - total;
  switch (align) {
    case '<': return prefix + body + fill.repeat(k);
    case '^': { const l = k >> 1; return fill.repeat(l) + prefix + body + fill.repeat(k - l); }
    case '=': return prefix + fill.repeat(k) + body;
    default: return fill.repeat(k) + prefix + body;
  }
}

function groupDigits(intPart, sep, every) {
  let out = '';
  for (let i = intPart.length; i > 0; i -= every) {
    const chunk = intPart.slice(Math.max(0, i - every), i);
    out = out ? chunk + sep + out : chunk;
  }
  return out;
}

// zero padding that also groups the padding zeros (format(1234, '09,') -> '0,001,234')
function groupedZeroPad(digits, sp, prefix, every) {
  let d = digits;
  let g = groupDigits(d, sp.grouping, every);
  while (prefix.length + g.length < sp.width) { d = '0' + d; g = groupDigits(d, sp.grouping, every); }
  return prefix + g;
}

function formatInt(v, sp) {
  const t = sp.type;
  if (t !== null && 'eEfFgG%'.includes(t)) return formatFloat(fval(v), sp);
  if (t !== null && !'dnbcoxX'.includes(t)) throw ValueErr(`Unknown format code '${t}' for object of type '${tname(v)}'`);
  if (sp.prec >= 0) throw ValueErr('Precision not allowed in integer format specifier');
  if (sp.z) throw ValueErr('Negative zero coercion (z) not allowed in integer format specifier');
  const iv = intOf(v);
  if (t === 'c') {
    if (sp.sign) throw ValueErr("Sign not allowed with integer format specifier 'c'");
    if (iv < 0 || iv > 0x10ffff) throw OverflowErr('%c arg not in range(0x110000)');
    return padStr(String.fromCodePoint(Number(iv)), sp, '<');
  }
  const base = t === 'b' ? 2 : t === 'o' ? 8 : (t === 'x' || t === 'X') ? 16 : 10;
  if (sp.grouping === ',' && base !== 10) throw ValueErr(`Cannot specify ',' with '${t}'.`);
  const neg = iv < 0;
  let digits = (neg ? iAbs(iv) : iv).toString(base);
  if (t === 'X') digits = digits.toUpperCase();
  const signStr = neg ? '-' : sp.sign === '+' ? '+' : sp.sign === ' ' ? ' ' : '';
  const pre = sp.alt && base !== 10 ? (base === 2 ? '0b' : base === 8 ? '0o' : t === 'X' ? '0X' : '0x') : '';
  const every = base === 10 ? 3 : 4;
  if (sp.grouping && sp.zeroFlag && sp.fill === null && sp.align === null) return groupedZeroPad(digits, sp, signStr + pre, every);
  if (sp.grouping) digits = groupDigits(digits, sp.grouping, every);
  return padStr(digits, sp, '>', signStr + pre);
}

function formatFloat(x, sp) {
  let code = sp.type, prec = sp.prec, addDot0 = false, pct = false;
  if (code !== null && !'eEfFgGn%'.includes(code)) throw ValueErr(`Unknown format code '${code}' for object of type 'float'`);
  if (code === null) { addDot0 = true; code = prec < 0 ? 'r' : 'g'; }
  else if (code === 'n') code = 'g';
  else if (code === '%') { code = 'f'; x *= 100; pct = true; }
  const upper = code === 'E' || code === 'F' || code === 'G';
  code = code.toLowerCase();
  if (prec < 0) prec = code === 'r' ? 0 : 6;
  if (code === 'g' && prec === 0) prec = 1;
  let neg = x < 0 || Object.is(x, -0);
  const ax = Math.abs(x);
  let body;
  if (x !== x) { body = 'nan'; neg = false; }
  else if (!isFinite(x)) body = 'inf';
  else if (code === 'f') body = fmtFixed(ax, prec, sp.alt);
  else body = fmtShort(ax, code, prec, addDot0, sp.alt);
  if (upper) body = body.toUpperCase();
  if (pct) body += '%';
  if (sp.z && neg && !/[1-9]/.test(body)) neg = false;
  const signStr = neg ? '-' : sp.sign === '+' ? '+' : sp.sign === ' ' ? ' ' : '';
  if (sp.grouping && /^\d/.test(body)) {
    const m = /^(\d+)(.*)$/.exec(body);
    if (sp.zeroFlag && sp.fill === null && sp.align === null) {
      const tail = m[2];
      const sub = { ...sp, width: sp.width - tail.length };
      return groupedZeroPad(m[1], sub, signStr, 3) + tail;
    }
    body = groupDigits(m[1], sp.grouping, 3) + m[2];
  }
  return padStr(body, sp, '>', signStr);
}

function formatStr(s, sp) {
  if (sp.type !== null && sp.type !== 's') throw ValueErr(`Unknown format code '${sp.type}' for object of type 'str'`);
  if (sp.sign) throw ValueErr('Sign not allowed in string format specifier');
  if (sp.alt) throw ValueErr('Alternate form (#) not allowed in string format specifier');
  if (sp.z) throw ValueErr('Negative zero coercion (z) not allowed in format specifier');
  if (sp.align === '=') throw ValueErr("'=' alignment not allowed in string format specifier");
  if (sp.grouping) throw ValueErr(`Cannot specify '${sp.grouping}' with 's'.`);
  if (sp.prec >= 0) s = s.slice(0, sp.prec);
  return padStr(s, sp, '<');
}

function formatValue(v, spec) {
  if (spec === '') return str(v);
  const t = typeOf(v);
  if (t === T_int || t === T_bool) return formatInt(v, parseSpec(spec, v));
  if (t === T_float) return formatFloat(v.v, parseSpec(spec, v));
  if (t === T_str) return formatStr(v, parseSpec(spec, v));
  throw TypeErr(`unsupported format string passed to ${t.name}.__format__`);
}

// str.format(*args, **kw)
function strFormat(fmt, args, kw, st = { auto: 0, mode: null }) {
  let out = '';
  let i = 0;
  const n = fmt.length;
  while (i < n) {
    const c = fmt[i];
    if (c === '{') {
      if (fmt[i + 1] === '{') { out += '{'; i += 2; continue; }
      // find the matching '}' (nested braces allowed inside the spec)
      let j = i + 1, depth = 1;
      while (j < n && depth > 0) { if (fmt[j] === '{') depth++; else if (fmt[j] === '}') depth--; if (depth) j++; }
      if (j >= n) throw ValueErr("expected '}' before end of string");
      const field = fmt.slice(i + 1, j);
      i = j + 1;
      // split field into name, conversion, spec
      let name = field, conv = null, spec = '';
      let k = 0, br = 0;
      for (; k < field.length; k++) {
        const ch = field[k];
        if (ch === '[') br++; else if (ch === ']') br--;
        else if (br === 0 && (ch === '!' || ch === ':')) break;
      }
      name = field.slice(0, k);
      if (field[k] === '!') {
        conv = field[k + 1];
        if (conv === undefined || (field[k + 2] !== undefined && field[k + 2] !== ':')) throw ValueErr('expected \':\' after conversion specifier');
        k += 2;
      }
      if (field[k] === ':') spec = field.slice(k + 1);
      // resolve the value (field number first, then any nested fields in the spec, like CPython)
      const m = /^([^.[]*)(.*)$/.exec(name);
      let first = m[1], rest = m[2], val;
      if (first === '') {
        if (st.mode === 'manual') throw ValueErr('cannot switch from manual field specification to automatic field numbering');
        st.mode = 'auto';
        first = String(st.auto++);
      } else if (/^\d+$/.test(first)) {
        if (st.mode === 'auto') throw ValueErr('cannot switch from automatic field numbering to manual field specification');
        st.mode = 'manual';
      }
      if (spec.includes('{')) spec = strFormat(spec, args, kw, st);
      if (/^\d+$/.test(first)) {
        const idx = parseInt(first, 10);
        if (idx >= args.length) throw IndexErr(`Replacement index ${idx} out of range for positional args tuple`);
        val = args[idx];
      } else {
        if (!kw || !(first in kw)) throw KeyErr(first);
        val = kw[first];
      }
      const accRe = /^(?:\.([A-Za-z_]\w*)|\[([^\]]*)\])/;
      while (rest) {
        const a = accRe.exec(rest);
        if (!a) throw ValueErr('Only \'.\' or \'[\' may follow \']\' in format field specifier');
        if (a[1] !== undefined) val = getAttr(val, a[1]);
        else val = getItem(val, /^\d+$/.test(a[2]) ? parseInt(a[2], 10) : a[2]);
        rest = rest.slice(a[0].length);
      }
      if (conv === 'r') val = repr(val);
      else if (conv === 's') val = str(val);
      else if (conv === 'a') val = asciiRepr(val);
      else if (conv !== null) throw ValueErr(`Unknown conversion specifier ${conv}`);
      out += formatValue(val, spec);
      continue;
    }
    if (c === '}') {
      if (fmt[i + 1] === '}') { out += '}'; i += 2; continue; }
      throw ValueErr("Single '}' encountered in format string");
    }
    out += c;
    i++;
  }
  return out;
}

// printf-style: fmt % args
function percentFormat(fmt, arg) {
  let args, dict = null;
  if (arg instanceof PyTuple) args = arg.items;
  else { args = [arg]; if (arg instanceof PyDict) dict = arg; }
  let ai = 0, out = '', i = 0, usedDict = false;
  const n = fmt.length;
  const nextArg = () => {
    if (ai >= args.length) throw TypeErr('not enough arguments for format string');
    return args[ai++];
  };
  while (i < n) {
    const c = fmt[i];
    if (c !== '%') { out += c; i++; continue; }
    const start = i;
    i++;
    if (i >= n) throw ValueErr('incomplete format');
    let key = null;
    if (fmt[i] === '(') {
      const j = fmt.indexOf(')', i);
      if (j < 0) throw ValueErr('incomplete format key');
      key = fmt.slice(i + 1, j);
      i = j + 1;
    }
    let flags = '';
    while (i < n && '-+ #0'.includes(fmt[i])) flags += fmt[i++];
    let width = -1;
    if (fmt[i] === '*') { width = Number(intOf(nextArg())); i++; }
    else { const ws = i; while (i < n && isDigitCh(fmt[i])) i++; if (i > ws) width = parseInt(fmt.slice(ws, i), 10); }
    let prec = -1;
    if (fmt[i] === '.') {
      i++;
      if (fmt[i] === '*') { prec = Number(intOf(nextArg())); i++; }
      else { const ps = i; while (i < n && isDigitCh(fmt[i])) i++; prec = i > ps ? parseInt(fmt.slice(ps, i), 10) : 0; }
    }
    while (i < n && 'hlL'.includes(fmt[i])) i++;
    if (i >= n) throw ValueErr('incomplete format');
    const t = fmt[i++];
    if (t === '%') { out += '%'; continue; }
    let v;
    if (key !== null) {
      if (!dict) throw TypeErr('format requires a mapping');
      usedDict = true;
      v = dict.get(key);
      if (v === undefined) throw KeyErr(key);
    } else v = nextArg();
    const left = flags.includes('-');
    const zero = flags.includes('0') && !left;
    const sign = flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : null;
    const alt = flags.includes('#');
    let body;
    const sp = { fill: null, align: left ? '<' : null, sign, z: false, alt, zeroFlag: zero, width, grouping: null, prec: -1, type: null };
    switch (t) {
      case 's': case 'r': case 'a': {
        let s = t === 's' ? str(v) : t === 'r' ? repr(v) : asciiRepr(v);
        if (prec >= 0) s = s.slice(0, prec);
        body = padStr(s, { ...sp, zeroFlag: false, sign: null }, '>');
        break;
      }
      case 'd': case 'i': case 'u': {
        let iv;
        if (isIntLike(v)) iv = intOf(v);
        else if (v instanceof PyFloat) iv = floatToInt(v.v);
        else throw TypeErr(`%${t} format: a real number is required, not ${tname(v)}`);
        body = formatInt(iv, { ...sp, type: 'd', prec: -1 });
        if (prec > 0) { // precision on ints = minimum digits
          const neg = iv < 0;
          let d = String(neg ? iAbs(iv) : iv).padStart(prec, '0');
          d = (neg ? '-' : sign || '') + d;
          body = padStr(d, { ...sp, sign: null }, '>');
        }
        break;
      }
      case 'x': case 'X': case 'o': {
        if (!isIntLike(v)) throw TypeErr(`%${t} format: an integer is required, not ${tname(v)}`);
        body = formatInt(intOf(v), { ...sp, type: t });
        break;
      }
      case 'e': case 'E': case 'f': case 'F': case 'g': case 'G': {
        if (!isNum(v)) throw TypeErr(`must be real number, not ${tname(v)}`);
        body = formatFloat(fval(v), { ...sp, type: t, prec: prec < 0 ? 6 : prec });
        break;
      }
      case 'c': {
        let ch;
        if (typeof v === 'string') { if (v.length !== 1) throw TypeErr('%c requires int or char'); ch = v; }
        else if (isIntLike(v)) ch = String.fromCodePoint(Number(intOf(v)));
        else throw TypeErr('%c requires int or char');
        body = padStr(ch, { ...sp, zeroFlag: false }, '>');
        break;
      }
      default:
        throw ValueErr(`unsupported format character '${t}' (0x${t.charCodeAt(0).toString(16)}) at index ${i - 1}`);
    }
    void start;
    out += body;
  }
  if (ai < args.length && !usedDict && !(args.length === 1 && dict)) throw TypeErr('not all arguments converted during string formatting');
  return out;
}

// ===========================================================================
// 9. Truthiness, equality, ordering
// ===========================================================================

function truthy(v) {
  switch (typeof v) {
    case 'boolean': return v;
    case 'number': return v !== 0;
    case 'string': return v.length !== 0;
    case 'bigint': return v !== 0n;
  }
  if (v === null) return false;
  if (Array.isArray(v)) return v.length !== 0;
  if (v instanceof PyFloat) return v.v !== 0;
  if (v instanceof PyTuple) return v.items.length !== 0;
  if (v instanceof PyDict || v instanceof PySet) return v.size !== 0;
  if (v instanceof PyRange) return v.len !== 0;
  if (v instanceof PyDictView) return v.d.size !== 0;
  return true;
}

function eq(a, b) {
  if (a === b) return !(a instanceof PyFloat && a.v !== a.v);
  const ta = typeof a, tb = typeof b;
  if (ta === 'string' || tb === 'string') return false;
  if (ta !== 'object' || tb !== 'object' || a === null || b === null) {
    if (isNum(a) && isNum(b)) return numEq(a, b);
    return false;
  }
  if (a instanceof PyFloat || b instanceof PyFloat) return isNum(a) && isNum(b) && numEq(a, b);
  if (Array.isArray(a)) return Array.isArray(b) && seqEq(a, b);
  if (a instanceof PyTuple) return b instanceof PyTuple && seqEq(a.items, b.items);
  if (a instanceof PyDict) {
    if (!(b instanceof PyDict) || a.size !== b.size) return false;
    for (const [h, e] of a.m) { const o = b.m.get(h); if (o === undefined || !eq(e[1], o[1])) return false; }
    return true;
  }
  if (a instanceof PySet) {
    if (!(b instanceof PySet) || a.size !== b.size) return false;
    for (const h of a.m.keys()) if (!b.m.has(h)) return false;
    return true;
  }
  if (a instanceof PyRange) {
    if (!(b instanceof PyRange) || a.len !== b.len) return false;
    if (a.len === 0) return true;
    if (a.start !== b.start) return false;
    return a.len === 1 || a.step === b.step;
  }
  if (a instanceof PyDictView && b instanceof PyDictView && a.kind === b.kind && a.kind !== 'values') {
    return eq(viewSet(a), viewSet(b));
  }
  return false;
}
function numEq(a, b) {
  if (a instanceof PyFloat || b instanceof PyFloat) {
    const x = a instanceof PyFloat ? a.v : intOf(a);
    const y = b instanceof PyFloat ? b.v : intOf(b);
    return x == y; // number/bigint comparisons are exact in JS
  }
  return intOf(a) == intOf(b);
}
function seqEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !eq(a[i], b[i])) return false;
  return true;
}
function viewSet(v) { const s = new PySet(); for (const x of iterToArray(v)) s.add(x); return s; }

const CMP_SYM = { lt: '<', le: '<=', gt: '>', ge: '>=' };
function cmpError(op, a, b) {
  return TypeErr(`'${CMP_SYM[op]}' not supported between instances of '${tname(a)}' and '${tname(b)}'`);
}
function numVal(v) { return v instanceof PyFloat ? v.v : intOf(v); }
// ordering: op in lt/le/gt/ge
function order(op, a, b) {
  const ta = typeof a, tb = typeof b;
  if ((ta === 'number' || ta === 'bigint' || ta === 'boolean' || a instanceof PyFloat) &&
      (tb === 'number' || tb === 'bigint' || tb === 'boolean' || b instanceof PyFloat)) {
    const x = numVal(a), y = numVal(b);
    switch (op) { case 'lt': return x < y; case 'le': return x <= y; case 'gt': return x > y; default: return x >= y; }
  }
  if (ta === 'string' && tb === 'string') {
    switch (op) { case 'lt': return a < b; case 'le': return a <= b; case 'gt': return a > b; default: return a >= b; }
  }
  if ((Array.isArray(a) && Array.isArray(b)) || (a instanceof PyTuple && b instanceof PyTuple)) {
    const x = Array.isArray(a) ? a : a.items, y = Array.isArray(b) ? b : b.items;
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) {
      if (x[i] === y[i] || eq(x[i], y[i])) continue;
      return order(op, x[i], y[i]);
    }
    switch (op) { case 'lt': return x.length < y.length; case 'le': return x.length <= y.length; case 'gt': return x.length > y.length; default: return x.length >= y.length; }
  }
  if (a instanceof PySet && b instanceof PySet) {
    const sub = (p, q) => { for (const h of p.m.keys()) if (!q.m.has(h)) return false; return true; };
    switch (op) {
      case 'lt': return a.size < b.size && sub(a, b);
      case 'le': return sub(a, b);
      case 'gt': return a.size > b.size && sub(b, a);
      default: return sub(b, a);
    }
  }
  throw cmpError(op, a, b);
}
const lt = (a, b) => (typeof a === 'number' && typeof b === 'number') ? a < b : order('lt', a, b);

function contains(container, item) {
  if (typeof container === 'string') {
    if (typeof item !== 'string') throw TypeErr(`'in <string>' requires string as left operand, not ${tname(item)}`);
    return container.includes(item);
  }
  if (Array.isArray(container)) {
    for (let i = 0; i < container.length; i++) if (container[i] === item || eq(container[i], item)) return true;
    return false;
  }
  if (container instanceof PyDict || container instanceof PySet) return container.m.has(hkey(item));
  if (container instanceof PyTuple) return contains(container.items, item);
  if (container instanceof PyRange) {
    if (!isIntLike(item) && !(item instanceof PyFloat && Number.isInteger(item.v))) {
      for (const v of iterToArray(container)) if (eq(v, item)) return true;
      return false;
    }
    const x = Number(numVal(item));
    const r = container;
    if (r.step > 0 ? (x < r.start || x >= r.stop) : (x > r.start || x <= r.stop)) return false;
    return (x - r.start) % r.step === 0;
  }
  if (container instanceof PyDictView) {
    if (container.kind === 'keys') return container.d.m.has(hkey(item));
    return contains(iterToArray(container), item);
  }
  if (container instanceof PyIterator) {
    for (;;) { const v = container.next(); if (v === STOP) return false; if (eq(v, item)) return true; }
  }
  throw TypeErr(`argument of type '${tname(container)}' is not iterable`);
}

// ===========================================================================
// 10. Arithmetic dispatch
// ===========================================================================

const OP_NAMES = { add: '+', sub: '-', mul: '*', truediv: '/', floordiv: '//', mod: '%', pow: '**', lshift: '<<', rshift: '>>', and: '&', or: '|', xor: '^', matmul: '@' };
function opError(op, a, b, inplace) {
  return TypeErr(`unsupported operand type(s) for ${OP_NAMES[op]}${inplace ? '=' : ''}: '${tname(a)}' and '${tname(b)}'`);
}

function checkLen(n) { if (n > MAX_SEQ) throw MemoryErr(); }
function charge(n) {
  const vm = CUR;
  if (vm && (vm.steps += n) > vm.maxSteps) throw vm.timeoutError();
}

function repeatCount(n) {
  if (typeof n === 'boolean') return n ? 1 : 0;
  if (typeof n === 'bigint') { if (n <= 0n) return 0; throw OverflowErr("cannot fit 'int' into an index-sized integer"); }
  return n < 0 ? 0 : n;
}
function seqRepeat(seq, n) {
  const k = repeatCount(n);
  if (typeof seq === 'string') {
    checkLen(seq.length * k);
    charge((seq.length * k) >> 6);
    return seq.repeat(k);
  }
  const items = Array.isArray(seq) ? seq : seq.items;
  checkLen(items.length * k);
  charge((items.length * k) >> 2);
  const out = new Array(items.length * k);
  let p = 0;
  for (let r = 0; r < k; r++) for (let i = 0; i < items.length; i++) out[p++] = items[i];
  return Array.isArray(seq) ? out : new PyTuple(out);
}

function binop(op, a, b, inplace = false) {
  const ta = typeof a, tb = typeof b;
  const aInt = ta === 'number' || ta === 'bigint' || ta === 'boolean';
  const bInt = tb === 'number' || tb === 'bigint' || tb === 'boolean';
  if (aInt && bInt) {
    if (ta === 'boolean' && tb === 'boolean' && (op === 'and' || op === 'or' || op === 'xor')) {
      return op === 'and' ? a && b : op === 'or' ? a || b : a !== b;
    }
    const x = intOf(a), y = intOf(b);
    switch (op) {
      case 'add': return iAdd(x, y);
      case 'sub': return iSub(x, y);
      case 'mul': return iMul(x, y);
      case 'truediv':
        if (y == 0) throw ZeroDiv('division by zero');
        if (typeof x === 'number' && typeof y === 'number') return F(x / y);
        return F(bigTrueDiv(toBig(x), toBig(y)));
      case 'floordiv': return iFloorDiv(x, y);
      case 'mod': return iMod(x, y);
      case 'pow': return iPow(x, y);
      case 'lshift': return iShl(x, y);
      case 'rshift': return iShr(x, y);
      case 'and': case 'or': case 'xor': return iBit(op === 'and' ? '&' : op === 'or' ? '|' : '^', x, y);
    }
  }
  if ((aInt || a instanceof PyFloat) && (bInt || b instanceof PyFloat)) {
    const x = fval(a), y = fval(b);
    switch (op) {
      case 'add': return F(x + y);
      case 'sub': return F(x - y);
      case 'mul': return F(x * y);
      case 'truediv': if (y === 0) throw ZeroDiv('float division by zero'); return F(x / y);
      case 'floordiv': if (y === 0) throw ZeroDiv('float floor division by zero'); return F(floatDivMod(x, y)[0]);
      case 'mod': if (y === 0) throw ZeroDiv('float modulo by zero'); return F(floatDivMod(x, y)[1]);
      case 'pow': return F(floatPow(x, y));
    }
    throw opError(op, a, b, inplace);
  }
  if (ta === 'string') {
    if (op === 'add') {
      if (tb === 'string') { checkLen(a.length + b.length); return a + b; }
      throw TypeErr(`can only concatenate str (not "${tname(b)}") to str`);
    }
    if (op === 'mul') { if (bInt) return seqRepeat(a, b); throw TypeErr(`can't multiply sequence by non-int of type '${tname(b)}'`); }
    if (op === 'mod') return percentFormat(a, b);
    throw opError(op, a, b, inplace);
  }
  if (Array.isArray(a)) {
    if (op === 'add') {
      if (Array.isArray(b)) { checkLen(a.length + b.length); return a.concat(b); }
      throw TypeErr(`can only concatenate list (not "${tname(b)}") to list`);
    }
    if (op === 'mul') { if (bInt) return seqRepeat(a, b); throw TypeErr(`can't multiply sequence by non-int of type '${tname(b)}'`); }
    throw opError(op, a, b, inplace);
  }
  if (a instanceof PyTuple) {
    if (op === 'add') {
      if (b instanceof PyTuple) return new PyTuple(a.items.concat(b.items));
      throw TypeErr(`can only concatenate tuple (not "${tname(b)}") to tuple`);
    }
    if (op === 'mul') { if (bInt) return seqRepeat(a, b); throw TypeErr(`can't multiply sequence by non-int of type '${tname(b)}'`); }
    throw opError(op, a, b, inplace);
  }
  if (op === 'mul' && aInt && (tb === 'string' || Array.isArray(b) || b instanceof PyTuple)) return seqRepeat(b, a);
  if (op === 'mul' && a instanceof PyFloat && (tb === 'string' || Array.isArray(b) || b instanceof PyTuple)) {
    throw TypeErr(`can't multiply sequence by non-int of type 'float'`);
  }
  if (a instanceof PySet && b instanceof PySet) {
    const out = new PySet(a.frozen);
    const av = a.vals(), bv = b.vals();
    switch (op) {
      case 'or': for (const v of av) out.add(v); for (const v of bv) out.add(v); return out;
      case 'and': for (const v of av) if (b.has(v)) out.add(v); return out;
      case 'sub': for (const v of av) if (!b.has(v)) out.add(v); return out;
      case 'xor': for (const v of av) if (!b.has(v)) out.add(v); for (const v of bv) if (!a.has(v)) out.add(v); return out;
    }
  }
  if (a instanceof PyDict && b instanceof PyDict && op === 'or') {
    const d = a.copy();
    for (const e of b.m.values()) d.set(e[0], e[1]);
    return d;
  }
  if (a instanceof PyDictView && a.kind !== 'values' && (b instanceof PySet || b instanceof PyDictView) && 'or and sub xor'.includes(op)) {
    return binop(op, viewSet(a), b instanceof PySet ? b : viewSet(b));
  }
  throw opError(op, a, b, inplace);
}

function bigTrueDiv(x, y) {
  const fx = Number(x), fy = Number(y);
  if (isFinite(fx) && isFinite(fy)) return fx / fy;
  // scale down both so they fit in doubles
  const neg = (x < 0n) !== (y < 0n);
  let ax = x < 0n ? -x : x, ay = y < 0n ? -y : y;
  const shift = BigInt(Math.max(0, Math.max(ax.toString(2).length, ay.toString(2).length) - 1000));
  ax >>= shift; ay >>= shift;
  if (ay === 0n) throw OverflowErr('integer division result too large for a float');
  const r = Number(ax) / Number(ay);
  if (!isFinite(r)) throw OverflowErr('integer division result too large for a float');
  return neg ? -r : r;
}

// in-place variants: lists/dicts/sets mutate
function inplace(op, a, b) {
  if (Array.isArray(a)) {
    if (op === 'add') { const items = iterToArray(b); checkLen(a.length + items.length); for (let i = 0; i < items.length; i++) a.push(items[i]); return a; }
    if (op === 'mul') {
      if (!isIntLike(b)) throw TypeErr(`can't multiply sequence by non-int of type '${tname(b)}'`);
      const r = seqRepeat(a, b);
      a.length = 0;
      for (let i = 0; i < r.length; i++) a.push(r[i]);
      return a;
    }
  }
  if (a instanceof PyDict && op === 'or') { dictUpdate(a, [b], null); return a; }
  if (a instanceof PySet && !a.frozen && b instanceof PySet && 'or and sub xor'.includes(op)) {
    const r = binop(op, a, b);
    a.m = r.m;
    return a;
  }
  return binop(op, a, b, true);
}

function unary(op, v) {
  if (op === 'not') return !truthy(v);
  const t = typeof v;
  if (t === 'number' || t === 'bigint' || t === 'boolean') {
    const x = intOf(v);
    if (op === 'neg') return iNeg(x);
    if (op === 'pos') return x;
    return iSub(iNeg(x), 1); // invert
  }
  if (v instanceof PyFloat) {
    if (op === 'neg') return F(-v.v);
    if (op === 'pos') return v;
  }
  const sym = op === 'neg' ? '-' : op === 'pos' ? '+' : '~';
  throw TypeErr(`bad operand type for unary ${sym}: '${tname(v)}'`);
}

// ===========================================================================
// 11. Iteration
// ===========================================================================

class ListIter extends PyIterator {
  constructor(a, cls = ITER_T.list_iterator) { super(cls); this.a = a; this.i = 0; }
  next() { return this.i < this.a.length ? this.a[this.i++] : STOP; }
}
class StrIter extends PyIterator {
  constructor(s) { super(ITER_T.str_ascii_iterator); this.s = s; this.i = 0; }
  next() { return this.i < this.s.length ? this.s[this.i++] : STOP; }
}
class RangeIter extends PyIterator {
  constructor(r) { super(ITER_T.range_iterator); this.v = r.start; this.step = r.step; this.left = r.len; }
  next() { if (this.left <= 0) return STOP; this.left--; const v = this.v; this.v += this.step; return v; }
}
class MapIter extends PyIterator { // iterates a JS Map's values with a size check (dicts/sets)
  constructor(owner, cls, pick) {
    super(cls); this.owner = owner; this.it = owner.m.values(); this.size = owner.size; this.pick = pick;
  }
  next() {
    if (this.owner.size !== this.size) {
      this.size = -1;
      throw exc('RuntimeError', `${this.owner instanceof PySet ? 'Set' : 'dictionary'} changed size during iteration`);
    }
    const r = this.it.next();
    if (r.done) return STOP;
    return this.pick(r.value);
  }
}
class FnIter extends PyIterator { // generic iterator from a JS next() function
  constructor(cls, fn) { super(cls); this.fn = fn; this.done = false; }
  next() { if (this.done) return STOP; const v = this.fn(); if (v === STOP) this.done = true; return v; }
}
class GenIter extends PyIterator { // wraps a JS generator (generator expressions)
  constructor(gen) { super(ITER_T.generator); this.gen = gen; this.done = false; this.running = false; }
  next() {
    if (this.done) return STOP;
    if (this.running) throw ValueErr('generator already executing');
    this.running = true;
    try {
      const r = this.gen.next();
      if (r.done) { this.done = true; return STOP; }
      return r.value;
    } catch (e) { this.done = true; throw e; } finally { this.running = false; }
  }
}

const pickKey = (e) => e[0], pickVal = (e) => e[1], pickItem = (e) => new PyTuple([e[0], e[1]]);

function getIter(o) {
  if (Array.isArray(o)) return new ListIter(o);
  if (typeof o === 'string') return new StrIter(o);
  if (o instanceof PyRange) return new RangeIter(o);
  if (o instanceof PyTuple) return new ListIter(o.items, ITER_T.tuple_iterator);
  if (o instanceof PyDict) return new MapIter(o, ITER_T.dict_keyiterator, pickKey);
  if (o instanceof PySet) {
    const snap = o.vals(), size = o.size;
    let i = 0;
    const it = new FnIter(ITER_T.set_iterator, () => {
      if (o.size !== size) throw exc('RuntimeError', 'Set changed size during iteration');
      return i < snap.length ? snap[i++] : STOP;
    });
    return it;
  }
  if (o instanceof PyIterator) return o;
  if (o instanceof PyDictView) {
    const k = o.kind;
    return new MapIter(o.d, k === 'keys' ? ITER_T.dict_keyiterator : k === 'values' ? ITER_T.dict_valueiterator : ITER_T.dict_itemiterator,
      k === 'keys' ? pickKey : k === 'values' ? pickVal : pickItem);
  }
  throw TypeErr(`'${tname(o)}' object is not iterable`);
}

// materialize any iterable into a fresh JS array (charges steps for big inputs)
function iterToArray(o) {
  if (Array.isArray(o)) { charge(o.length >> 3); return o.slice(); }
  if (typeof o === 'string') { charge(o.length >> 3); return o.split(''); }
  if (o instanceof PyTuple) return o.items.slice();
  if (o instanceof PyRange) {
    checkLen(o.len);
    charge(o.len >> 2);
    const out = new Array(o.len);
    for (let i = 0, v = o.start; i < o.len; i++, v += o.step) out[i] = v;
    return out;
  }
  if (o instanceof PyDict) return o.keys();
  if (o instanceof PySet) return o.vals();
  const it = getIter(o);
  const out = [];
  let n = 0;
  for (;;) {
    const v = it.next();
    if (v === STOP) return out;
    out.push(v);
    if ((++n & 3) === 0) charge(1);
    if (n > MAX_SEQ) throw MemoryErr();
  }
}

// ===========================================================================
// 12. Indexing & slicing
// ===========================================================================

function indexOf(v, what) { // Python __index__
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'bigint') return v > 0n ? Infinity : -Infinity;
  throw TypeErr(what);
}

function sliceIndices(sl, len) {
  const idx = (v) => {
    if (v === null) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'bigint') return v > 0n ? MAX_SAFE : -MAX_SAFE;
    throw TypeErr('slice indices must be integers or None or have an __index__ method');
  };
  let step = idx(sl.step);
  if (step === null) step = 1;
  if (step === 0) throw ValueErr('slice step cannot be zero');
  let start = idx(sl.start), stop = idx(sl.stop);
  const lower = step < 0 ? -1 : 0, upper = step < 0 ? len - 1 : len;
  if (start === null) start = step < 0 ? upper : lower;
  else if (start < 0) { start += len; if (start < lower) start = lower; } else if (start > upper) start = upper;
  if (stop === null) stop = step < 0 ? lower : upper;
  else if (stop < 0) { stop += len; if (stop < lower) stop = lower; } else if (stop > upper) stop = upper;
  let n;
  if (step > 0) n = start < stop ? Math.floor((stop - start - 1) / step) + 1 : 0;
  else n = start > stop ? Math.floor((start - stop - 1) / -step) + 1 : 0;
  return [start, stop, step, n];
}

function sliceSeq(seq, sl) {
  const isStr = typeof seq === 'string';
  const items = isStr ? seq : Array.isArray(seq) ? seq : seq.items;
  const [start, , step, n] = sliceIndices(sl, items.length);
  if (step === 1) {
    if (isStr) return seq.slice(start, start + n);
    const out = items.slice(start, start + n);
    return Array.isArray(seq) ? out : new PyTuple(out);
  }
  if (isStr) { let s = ''; for (let i = 0, j = start; i < n; i++, j += step) s += seq[j]; return s; }
  const out = new Array(n);
  for (let i = 0, j = start; i < n; i++, j += step) out[i] = items[j];
  return Array.isArray(seq) ? out : new PyTuple(out);
}

function getItem(o, k) {
  if (Array.isArray(o)) {
    if (typeof k === 'number') {
      const i = k < 0 ? k + o.length : k;
      if (i >= 0 && i < o.length) return o[i];
      throw IndexErr('list index out of range');
    }
    if (k instanceof PySlice) return sliceSeq(o, k);
    if (typeof k === 'boolean') return getItem(o, k ? 1 : 0);
    if (typeof k === 'bigint') throw IndexErr("cannot fit 'int' into an index-sized integer");
    throw TypeErr(`list indices must be integers or slices, not ${tname(k)}`);
  }
  if (o instanceof PyDict) {
    const v = o.get(k);
    if (v === undefined) throw KeyErr(k);
    return v;
  }
  if (typeof o === 'string') {
    if (typeof k === 'number') {
      const i = k < 0 ? k + o.length : k;
      if (i >= 0 && i < o.length) return o[i];
      throw IndexErr('string index out of range');
    }
    if (k instanceof PySlice) return sliceSeq(o, k);
    if (typeof k === 'boolean') return getItem(o, k ? 1 : 0);
    if (typeof k === 'bigint') throw IndexErr("cannot fit 'int' into an index-sized integer");
    throw TypeErr(`string indices must be integers, not '${tname(k)}'`);
  }
  if (o instanceof PyTuple) {
    if (typeof k === 'number' || typeof k === 'boolean' || typeof k === 'bigint') {
      const kk = indexOf(k, '');
      const i = kk < 0 ? kk + o.items.length : kk;
      if (i >= 0 && i < o.items.length) return o.items[i];
      throw IndexErr('tuple index out of range');
    }
    if (k instanceof PySlice) return sliceSeq(o, k);
    throw TypeErr(`tuple indices must be integers or slices, not ${tname(k)}`);
  }
  if (o instanceof PyRange) {
    if (k instanceof PySlice) {
      const [start, , step, n] = sliceIndices(k, o.len);
      const st = o.start + start * o.step;
      return new PyRange(st, st + n * step * o.step, step * o.step);
    }
    const kk = indexOf(k, `range indices must be integers or slices, not ${tname(k)}`);
    const i = kk < 0 ? kk + o.len : kk;
    if (i >= 0 && i < o.len) return o.start + i * o.step;
    throw IndexErr('range object index out of range');
  }
  if (o instanceof PyType) {
    return o; // list[int] style annotations: just return the type
  }
  throw TypeErr(`'${tname(o)}' object is not subscriptable`);
}

function setItem(o, k, v) {
  if (Array.isArray(o)) {
    if (typeof k === 'number' || typeof k === 'boolean' || typeof k === 'bigint') {
      const kk = indexOf(k, '');
      const i = kk < 0 ? kk + o.length : kk;
      if (i >= 0 && i < o.length) { o[i] = v; return; }
      throw IndexErr('list assignment index out of range');
    }
    if (k instanceof PySlice) {
      const items = v === o ? o.slice() : iterToArray(v);
      const [start, stop, step, n] = sliceIndices(k, o.length);
      if (step === 1) {
        const end = Math.max(start, stop);
        checkLen(o.length - (end - start) + items.length);
        o.splice(start, end - start, ...items);
        return;
      }
      if (items.length !== n) throw ValueErr(`attempt to assign sequence of size ${items.length} to extended slice of size ${n}`);
      for (let i = 0, j = start; i < n; i++, j += step) o[j] = items[i];
      return;
    }
    throw TypeErr(`list indices must be integers or slices, not ${tname(k)}`);
  }
  if (o instanceof PyDict) { o.set(k, v); return; }
  throw TypeErr(`'${tname(o)}' object does not support item assignment`);
}

function delItem(o, k) {
  if (Array.isArray(o)) {
    if (typeof k === 'number' || typeof k === 'boolean' || typeof k === 'bigint') {
      const kk = indexOf(k, '');
      const i = kk < 0 ? kk + o.length : kk;
      if (i >= 0 && i < o.length) { o.splice(i, 1); return; }
      throw IndexErr('list assignment index out of range');
    }
    if (k instanceof PySlice) {
      const [start, , step, n] = sliceIndices(k, o.length);
      if (step === 1) { o.splice(start, n); return; }
      const kill = new Set();
      for (let i = 0, j = start; i < n; i++, j += step) kill.add(j);
      let w = 0;
      for (let r = 0; r < o.length; r++) if (!kill.has(r)) o[w++] = o[r];
      o.length = w;
      return;
    }
    throw TypeErr(`list indices must be integers or slices, not ${tname(k)}`);
  }
  if (o instanceof PyDict) {
    if (!o.delete(k)) throw KeyErr(k);
    return;
  }
  throw TypeErr(`'${tname(o)}' object does not support item deletion`);
}

function pyLen(v) {
  if (typeof v === 'string') return v.length;
  if (Array.isArray(v)) return v.length;
  if (v instanceof PyTuple) return v.items.length;
  if (v instanceof PyDict || v instanceof PySet) return v.size;
  if (v instanceof PyRange) return v.len;
  if (v instanceof PyDictView) return v.d.size;
  throw TypeErr(`object of type '${tname(v)}' has no len()`);
}

// ===========================================================================
// 13. Attributes
// ===========================================================================

function findMethod(t, name) {
  for (; t; t = t.base) { const m = t.methods[name]; if (m !== undefined) return m; }
  return undefined;
}

function getAttr(o, name) {
  if (o instanceof PyModule) {
    const v = o.attrs.get(name);
    if (v === undefined) throw attrError(o, name);
    return v;
  }
  if (o instanceof PyType) {
    if (name === '__name__' || name === '__qualname__') return o.name;
    if (name in o.attrs) return o.attrs[name];
    const m = findMethod(o, name);
    if (m !== undefined) {
      const t = o;
      return new PyBuiltin(name, (args, kw) => {
        if (args.length === 0) throw TypeErr(`unbound method ${t.name}.${name}() needs an argument`);
        const self = args[0];
        if (!isSubtype(typeOf(self), t)) throw TypeErr(`descriptor '${name}' for '${t.name}' objects doesn't apply to a '${tname(self)}' object`);
        return m(self, args.slice(1), kw);
      }, undefined, null, `${t.name}.${name}`);
    }
    if (name === '__doc__') return null;
    throw attrError(o, name);
  }
  const t = typeOf(o);
  const m = findMethod(t, name);
  if (m !== undefined) return new PyBuiltin(name, m, o, null, `${t.name}.${name}`);
  switch (name) {
    case '__class__': return t;
    case '__name__': case '__qualname__':
      if (o instanceof PyFunction) return name === '__name__' ? o.name : o.qualname;
      if (o instanceof PyBuiltin) return o.name;
      break;
    case '__doc__':
      if (o instanceof PyFunction || o instanceof PyBuiltin) return o.doc;
      break;
    case 'args': if (o instanceof PyException) return new PyTuple(o.args.slice()); break;
    case 'real': case 'numerator':
      if (isIntLike(o)) return intOf(o);
      if (name === 'real' && o instanceof PyFloat) return o;
      break;
    case 'imag': if (isIntLike(o)) return 0; if (o instanceof PyFloat) return F(0); break;
    case 'denominator': if (isIntLike(o)) return 1; break;
    case 'start': case 'stop': case 'step':
      if (o instanceof PyRange) return o[name];
      if (o instanceof PySlice) return o[name];
      break;
  }
  throw attrError(o, name);
}

function setAttr(o, name, v) {
  if (o instanceof PyModule) { o.attrs.set(name, v); return; }
  if (o instanceof PyFunction && !name.startsWith('__')) { (o.dict ||= new Map()).set(name, v); return; }
  if (o instanceof PyType) throw TypeErr(`cannot set '${name}' attribute of immutable type '${o.name}'`);
  const e = exc('AttributeError', `'${tname(o)}' object has no attribute '${name}' and no __dict__ for setting new attributes`);
  throw e;
}

function callMethod(o, name, args, kw) {
  if (o instanceof PyModule) {
    const f = o.attrs.get(name);
    if (f === undefined) throw attrError(o, name);
    return callValue(f, args, kw);
  }
  if (!(o instanceof PyType)) {
    const m = findMethod(typeOf(o), name);
    if (m !== undefined) return m(o, args, kw);
  }
  return callValue(getAttr(o, name), args, kw);
}

// ===========================================================================
// 14. Calling
// ===========================================================================

function callValue(f, args, kw) {
  if (f instanceof PyFunction) return callFunction(f, args, kw);
  if (f instanceof PyBuiltin) return f.self === undefined ? f.fn(args, kw) : f.fn(f.self, args, kw);
  if (f instanceof PyType) {
    if (f.make) return f.make(args, kw);
    if (f.isExc) {
      if (kw && Object.keys(kw).length) throw TypeErr(`${f.name}() takes no keyword arguments`);
      return new PyException(f, args.slice());
    }
    throw TypeErr(`cannot create '${f.name}' instances`);
  }
  throw TypeErr(`'${tname(f)}' object is not callable`);
}

function listNames(names) {
  const q = names.map((n) => `'${n}'`);
  if (q.length === 1) return q[0];
  if (q.length === 2) return q[0] + ' and ' + q[1];
  return q.slice(0, -1).join(', ') + ', and ' + q[q.length - 1];
}

function bindArgs(fn, args, kw, vars) {
  const spec = fn.spec;
  const np = spec.nparams; // positional-or-keyword params
  const na = args.length;
  if (na > np && spec.varargs < 0) {
    const ndef = fn.defaults.length;
    const kwGiven = kw ? Object.keys(kw).filter((k) => spec.kwonly.includes(k)).length : 0;
    let msg;
    if (ndef > 0) msg = `${spec.qualname}() takes from ${np - ndef} to ${np} positional arguments but ${na} ${na === 1 ? 'was' : 'were'} given`;
    else msg = `${spec.qualname}() takes ${np} positional argument${np === 1 ? '' : 's'} but ${na}${kwGiven ? ` positional argument${na === 1 ? '' : 's'} (and ${kwGiven} keyword-only argument${kwGiven === 1 ? '' : 's'})` : ''} ${na === 1 ? 'was' : 'were'} given`;
    throw TypeErr(msg);
  }
  const m = na < np ? na : np;
  for (let i = 0; i < m; i++) vars[i] = args[i];
  if (spec.varargs >= 0) vars[spec.varargs] = na > np ? new PyTuple(args.slice(np)) : EMPTY_TUPLE;
  let extra = null;
  if (spec.kwargs >= 0) extra = vars[spec.kwargs] = new PyDict();
  if (kw) {
    for (const k in kw) {
      const idx = spec.paramIndex[k];
      if (idx === undefined) {
        if (extra) { extra.set(k, kw[k]); continue; }
        throw TypeErr(`${spec.qualname}() got an unexpected keyword argument '${k}'`);
      }
      if (vars[idx] !== undefined) throw TypeErr(`${spec.qualname}() got multiple values for argument '${k}'`);
      vars[idx] = kw[k];
    }
  }
  if (na < np || kw) {
    const defs = fn.defaults, firstDef = np - defs.length;
    let missing = null;
    for (let i = na; i < np; i++) {
      if (vars[i] === undefined) {
        if (i >= firstDef) vars[i] = defs[i - firstDef];
        else (missing ||= []).push(spec.params[i]);
      }
    }
    if (missing) throw TypeErr(`${spec.qualname}() missing ${missing.length} required positional argument${missing.length === 1 ? '' : 's'}: ${listNames(missing)}`);
  }
  if (spec.kwonly.length) {
    let missing = null;
    for (let j = 0; j < spec.kwonly.length; j++) {
      const idx = spec.kwonlyStart + j;
      if (vars[idx] === undefined) {
        const d = fn.kwdefaults[spec.kwonly[j]];
        if (d !== undefined) vars[idx] = d; else (missing ||= []).push(spec.kwonly[j]);
      }
    }
    if (missing) throw TypeErr(`${spec.qualname}() missing ${missing.length} required keyword-only argument${missing.length === 1 ? '' : 's'}: ${listNames(missing)}`);
  }
}

function callFunction(fn, args, kw) {
  const spec = fn.spec;
  const vm = CUR;
  const vars = new Array(spec.nlocals);
  if (!kw && args.length === spec.nparams && spec.simple) {
    for (let i = 0; i < args.length; i++) vars[i] = args[i];
  } else bindArgs(fn, args, kw, vars);
  if (++vm.depth > vm.maxDepth) {
    vm.depth--;
    throw exc('RecursionError', 'maximum recursion depth exceeded');
  }
  const frame = { v: vars, up: fn.closure, ret: null };
  try {
    return spec.body(frame) === RETURN ? frame.ret : null;
  } finally {
    vm.depth--;
  }
}

function checkArgs(name, args, min, max, style = 'pos') {
  const n = args.length;
  if (n >= min && n <= max) return;
  if (style === 'noargs') throw TypeErr(`${name}() takes no arguments (${n} given)`);
  if (style === 'O') throw TypeErr(`${name}() takes exactly one argument (${n} given)`);
  if (style === 'kw') {
    const bound = n < min ? min : max;
    const how = min === max ? 'exactly' : n < min ? 'at least' : 'at most';
    throw TypeErr(`${name}() takes ${how} ${bound} positional argument${bound === 1 ? '' : 's'} (${n} given)`);
  }
  if (n < min) throw TypeErr(`${name} expected ${min === max ? '' : 'at least '}${min} argument${min === 1 ? '' : 's'}, got ${n}`);
  throw TypeErr(`${name} expected ${min === max ? '' : 'at most '}${max} argument${max === 1 ? '' : 's'}, got ${n}`);
}
function noKw(name, kw) {
  if (kw) for (const k in kw) throw TypeErr(`${name}() takes no keyword arguments`);
}
function kwOnly(name, kw, allowed) {
  const out = {};
  if (kw) for (const k in kw) {
    if (!allowed.includes(k)) throw TypeErr(`${name}() got an unexpected keyword argument '${k}'`);
    out[k] = kw[k];
  }
  return out;
}
function needInt(v, what) {
  if (typeof v === 'number' || typeof v === 'bigint') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw TypeErr(what || `'${tname(v)}' object cannot be interpreted as an integer`);
}
function needSmallInt(v) {
  const i = needInt(v);
  if (typeof i === 'bigint') throw OverflowErr('Python int too large to convert to C ssize_t');
  return i;
}

// ===========================================================================
// 15. Sorting (stable; compares later < earlier like CPython's timsort)
// ===========================================================================

function mergeSortIdx(a, less) {
  const n = a.length, RUN = 32;
  for (let lo = 0; lo < n; lo += RUN) {
    const hi = Math.min(lo + RUN, n);
    for (let i = lo + 1; i < hi; i++) {
      const pivot = a[i];
      let l = lo, r = i;
      while (l < r) { const p = (l + r) >> 1; if (less(pivot, a[p])) r = p; else l = p + 1; }
      for (let j = i; j > l; j--) a[j] = a[j - 1];
      a[l] = pivot;
    }
  }
  let buf = new Array(n);
  for (let w = RUN; w < n; w *= 2) {
    for (let lo = 0; lo < n; lo += 2 * w) {
      const mid = Math.min(lo + w, n), hi = Math.min(lo + 2 * w, n);
      let i = lo, j = mid, k = lo;
      while (i < mid && j < hi) { if (less(a[j], a[i])) buf[k++] = a[j++]; else buf[k++] = a[i++]; }
      while (i < mid) buf[k++] = a[i++];
      while (j < hi) buf[k++] = a[j++];
    }
    const t = a; a = buf; buf = t;
  }
  return a;
}

function pySort(arr, key, reverse) {
  const n = arr.length;
  if (n < 2) { if (n === 1 && key) callValue(key, [arr[0]], null); return arr; }
  charge(n >> 1);
  const keys = key ? arr.map((v) => callValue(key, [v], null)) : arr;
  let idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  if (reverse) idx.reverse();
  idx = mergeSortIdx(idx, (i, j) => lt(keys[i], keys[j]));
  if (reverse) idx.reverse();
  const out = idx.map((i) => arr[i]);
  for (let i = 0; i < n; i++) arr[i] = out[i];
  return arr;
}

function sortOpts(name, kw) {
  const o = kwOnly(name, kw, ['key', 'reverse']);
  const key = o.key === undefined || o.key === null ? null : o.key;
  return { key, reverse: o.reverse === undefined ? false : truthy(o.reverse) };
}

// ===========================================================================
// 16. Builtin functions
// ===========================================================================

const BUILTINS = new Map();
function defb(name, fn, doc) { const b = new PyBuiltin(name, fn, undefined, doc || null); BUILTINS.set(name, b); return b; }

const PY_WS = '\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const RE_WS_CH = new RegExp('[' + PY_WS + ']');
const RE_STRIP_L = new RegExp('^[' + PY_WS + ']+');
const RE_STRIP_R = new RegExp('[' + PY_WS + ']+$');
const pyStrip = (s) => s.replace(RE_STRIP_L, '').replace(RE_STRIP_R, '');

const DIGIT_ZEROS = [0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xed0, 0xf20, 0x1040, 0xff10];
function asciiDigits(s) {
  return s.replace(/\p{Nd}/gu, (ch) => {
    const c = ch.codePointAt(0);
    for (const z of DIGIT_ZEROS) if (c >= z && c <= z + 9) return String(c - z);
    return ch;
  });
}

function parseIntStr(orig, base) {
  const fail = () => ValueErr(`invalid literal for int() with base ${base}: ${repr(orig)}`);
  let s = asciiDigits(pyStrip(orig));
  let neg = false;
  if (s[0] === '+' || s[0] === '-') { neg = s[0] === '-'; s = s.slice(1); }
  let b = base;
  const pre = s.slice(0, 2).toLowerCase();
  if ((pre === '0x' && (b === 16 || b === 0)) || (pre === '0o' && (b === 8 || b === 0)) || (pre === '0b' && (b === 2 || b === 0))) {
    b = pre === '0x' ? 16 : pre === '0o' ? 8 : 2;
    s = s.slice(2);
    if (s[0] === '_') s = s.slice(1);
  } else if (b === 0) {
    if (/^0+(_?0)*$/.test(s)) return 0;
    if (s[0] === '0') throw fail();
    b = 10;
  }
  if (!s || s[0] === '_' || s[s.length - 1] === '_' || s.includes('__')) throw fail();
  s = s.replace(/_/g, '');
  const valid = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, b);
  const low = s.toLowerCase();
  for (let i = 0; i < low.length; i++) if (!valid.includes(low[i])) throw fail();
  let v;
  if (s.length <= 10 || (b === 10 && s.length <= 15)) v = parseInt(s, b);
  else if (b === 10) v = normBig(BigInt(s));
  else if (b === 16 || b === 8 || b === 2) v = normBig(BigInt((b === 16 ? '0x' : b === 8 ? '0o' : '0b') + s));
  else { let r = 0n; const B = BigInt(b); for (const ch of low) r = r * B + BigInt(parseInt(ch, b)); v = normBig(r); }
  if (s.length > 4300 && b === 10) throw ValueErr('Exceeds the limit (4300 digits) for integer string conversion: value has ' + s.length + ' digits; use sys.set_int_max_str_digits() to increase the limit');
  return neg ? iNeg(v) : v;
}

const RE_FLOAT_STR = /^[+-]?(?:(?:\d(?:_?\d)*)?\.?\d(?:_?\d)*(?:[eE][+-]?\d(?:_?\d)*)?|\d(?:_?\d)*\.(?:[eE][+-]?\d(?:_?\d)*)?)$/;
function parseFloatStr(orig) {
  const s = asciiDigits(pyStrip(orig));
  const low = s.toLowerCase();
  const m = /^([+-]?)(inf|infinity|nan)$/.exec(low);
  if (m) return m[2] === 'nan' ? NaN : (m[1] === '-' ? -Infinity : Infinity);
  if (!RE_FLOAT_STR.test(s)) throw ValueErr(`could not convert string to float: ${repr(orig)}`);
  return parseFloat(s.replace(/_/g, ''));
}

function toFloat(x) {
  if (x instanceof PyFloat) return x.v;
  if (typeof x === 'string') return parseFloatStr(x);
  if (isIntLike(x)) return fval(x);
  throw TypeErr(`float() argument must be a string or a real number, not '${tname(x)}'`);
}

function makeRange(args, kw) {
  noKw('range', kw);
  if (args.length === 0) throw TypeErr('range expected at least 1 argument, got 0');
  if (args.length > 3) throw TypeErr(`range expected at most 3 arguments, got ${args.length}`);
  const a = args.map((v) => needSmallInt(v));
  let start = 0, stop, step = 1;
  if (a.length === 1) stop = a[0]; else { start = a[0]; stop = a[1]; if (a.length === 3) step = a[2]; }
  if (step === 0) throw ValueErr('range() arg 3 must not be zero');
  return new PyRange(start, stop, step);
}

function dictUpdate(d, args, kw) {
  if (args.length > 1) throw TypeErr(`update expected at most 1 argument, got ${args.length}`);
  if (args.length === 1) {
    const src = args[0];
    if (src instanceof PyDict) { for (const e of src.m.values()) d.set(e[0], e[1]); }
    else {
      const items = iterToArray(src);
      for (let i = 0; i < items.length; i++) {
        let pair;
        try { pair = iterToArray(items[i]); } catch (e) {
          if (e instanceof PyException && e.cls === EXC.TypeError) throw TypeErr(`cannot convert dictionary update sequence element #${i} to a sequence`);
          throw e;
        }
        if (pair.length !== 2) throw ValueErr(`dictionary update sequence element #${i} has length ${pair.length}; 2 is required`);
        d.set(pair[0], pair[1]);
      }
    }
  }
  if (kw) for (const k in kw) d.set(k, kw[k]);
  return d;
}

function makeSet(args, kw, frozen) {
  noKw(frozen ? 'frozenset' : 'set', kw);
  if (args.length > 1) throw TypeErr(`${frozen ? 'frozenset' : 'set'} expected at most 1 argument, got ${args.length}`);
  const s = new PySet(frozen);
  if (args.length) for (const v of iterToArray(args[0])) s.add(v);
  return s;
}

T_int.make = (args, kw) => {
  let base = null;
  if (kw) for (const k in kw) { if (k === 'base') base = kw[k]; else throw TypeErr(`'${k}' is an invalid keyword argument for int()`); }
  if (args.length > 2) throw TypeErr(`int expected at most 2 arguments, got ${args.length}`);
  if (args.length === 2) base = args[1];
  if (args.length === 0) { if (base !== null) throw TypeErr("int() missing string argument"); return 0; }
  const x = args[0];
  if (base !== null) {
    if (typeof x !== 'string') throw TypeErr("int() can't convert non-string with explicit base");
    const b = needInt(base);
    if (b !== 0 && (b < 2 || b > 36)) throw ValueErr('int() base must be >= 2 and <= 36, or 0');
    return parseIntStr(x, Number(b));
  }
  if (typeof x === 'string') return parseIntStr(x, 10);
  if (typeof x === 'number' || typeof x === 'bigint') return x;
  if (typeof x === 'boolean') return x ? 1 : 0;
  if (x instanceof PyFloat) return floatToInt(x.v);
  throw TypeErr(`int() argument must be a string, a bytes-like object or a real number, not '${tname(x)}'`);
};
T_float.make = (args, kw) => {
  noKw('float', kw);
  if (args.length > 1) throw TypeErr(`float expected at most 1 argument, got ${args.length}`);
  return args.length ? F(toFloat(args[0])) : F(0);
};
T_str.make = (args, kw) => {
  if (kw && Object.keys(kw).length) throw NotImpl('str() with encoding arguments');
  if (args.length > 1) throw TypeErr(`str expected at most 1 argument, got ${args.length}`);
  return args.length ? str(args[0]) : '';
};
T_bool.make = (args, kw) => {
  noKw('bool', kw);
  if (args.length > 1) throw TypeErr(`bool expected at most 1 argument, got ${args.length}`);
  return args.length ? truthy(args[0]) : false;
};
T_list.make = (args, kw) => {
  noKw('list', kw);
  if (args.length > 1) throw TypeErr(`list expected at most 1 argument, got ${args.length}`);
  return args.length ? iterToArray(args[0]) : [];
};
T_tuple.make = (args, kw) => {
  noKw('tuple', kw);
  if (args.length > 1) throw TypeErr(`tuple expected at most 1 argument, got ${args.length}`);
  if (!args.length) return EMPTY_TUPLE;
  return args[0] instanceof PyTuple ? args[0] : new PyTuple(iterToArray(args[0]));
};
T_dict.make = (args, kw) => {
  if (args.length > 1) throw TypeErr(`dict expected at most 1 argument, got ${args.length}`);
  return dictUpdate(new PyDict(), args, kw);
};
T_set.make = (args, kw) => makeSet(args, kw, false);
T_frozenset.make = (args, kw) => makeSet(args, kw, true);
T_range.make = makeRange;
T_type.make = (args, kw) => {
  noKw('type', kw);
  if (args.length === 1) return typeOf(args[0]);
  if (args.length === 3) throw NotImpl('creating classes with type()');
  throw TypeErr('type() takes 1 or 3 arguments');
};
T_slice.make = (args) => {
  if (args.length === 0) throw TypeErr('slice expected at least 1 argument, got 0');
  if (args.length === 1) return new PySlice(null, args[0], null);
  return new PySlice(args[0], args[1], args.length > 2 ? args[2] : null);
};
T_object.make = (args) => {
  if (args.length) throw TypeErr('object() takes no arguments');
  const o = new PyIterator(T_object);
  o.next = () => { throw TypeErr("'object' object is not an iterator"); };
  return o;
};

function NotImpl(what) {
  return exc('NotImplementedError', `${what} ${what.endsWith('s') ? 'are' : 'is'} not supported in Night School's Python`);
}

defb('print', (args, kw) => {
  let sep = ' ', end = '\n';
  if (kw) {
    for (const k in kw) {
      const v = kw[k];
      if (k === 'sep' || k === 'end') {
        if (v !== null && typeof v !== 'string') throw TypeErr(`${k} must be None or a string, not ${tname(v)}`);
        if (k === 'sep') sep = v === null ? ' ' : v; else end = v === null ? '\n' : v;
      } else if (k !== 'file' && k !== 'flush') throw TypeErr(`'${k}' is an invalid keyword argument for print()`);
    }
  }
  let s = '';
  for (let i = 0; i < args.length; i++) { if (i) s += sep; s += str(args[i]); }
  CUR.write(s + end);
  return null;
}, 'print(*values, sep=" ", end="\\n") — show values on the screen.');

defb('len', (args, kw) => { noKw('len', kw); checkArgs('len', args, 1, 1, 'O'); return pyLen(args[0]); },
  'len(x) — how many items are in x (characters in a string, items in a list, keys in a dict).');
defb('repr', (args, kw) => { noKw('repr', kw); checkArgs('repr', args, 1, 1, 'O'); return repr(args[0]); });
defb('ascii', (args, kw) => { noKw('ascii', kw); checkArgs('ascii', args, 1, 1, 'O'); return asciiRepr(args[0]); });
defb('abs', (args, kw) => {
  noKw('abs', kw); checkArgs('abs', args, 1, 1, 'O');
  const v = args[0];
  if (isIntLike(v)) return iAbs(intOf(v));
  if (v instanceof PyFloat) return F(Math.abs(v.v));
  throw TypeErr(`bad operand type for abs(): '${tname(v)}'`);
});
defb('chr', (args, kw) => {
  noKw('chr', kw); checkArgs('chr', args, 1, 1, 'O');
  const i = needInt(args[0]);
  if (typeof i === 'bigint' || i < 0 || i > 0x10ffff) {
    if (typeof i === 'bigint') throw OverflowErr('Python int too large to convert to C int');
    throw ValueErr('chr() arg not in range(0x110000)');
  }
  return String.fromCodePoint(i);
});
defb('ord', (args, kw) => {
  noKw('ord', kw); checkArgs('ord', args, 1, 1, 'O');
  const c = args[0];
  if (typeof c !== 'string') throw TypeErr(`ord() expected string of length 1, but ${tname(c)} found`);
  const n = [...c].length;
  if (n !== 1) throw TypeErr(`ord() expected a character, but string of length ${c.length} found`);
  return c.codePointAt(0);
});
function baseRepr(prefix, base) {
  return (args, kw) => {
    noKw(prefix, kw); checkArgs(prefix, args, 1, 1, 'O');
    const i = intOf(needInt(args[0]));
    const p = base === 16 ? '0x' : base === 8 ? '0o' : '0b';
    return i < 0 ? '-' + p + iAbs(i).toString(base) : p + i.toString(base);
  };
}
defb('hex', baseRepr('hex', 16));
defb('oct', baseRepr('oct', 8));
defb('bin', baseRepr('bin', 2));
defb('range', makeRange);
defb('callable', (args) => { checkArgs('callable', args, 1, 1, 'O'); const f = args[0]; return f instanceof PyFunction || f instanceof PyBuiltin || f instanceof PyType; });
defb('isinstance', (args, kw) => {
  noKw('isinstance', kw);
  checkArgs('isinstance', args, 2, 2);
  return isInstance(args[0], args[1]);
});
function isInstance(v, ci) {
  if (ci instanceof PyType) return isSubtype(typeOf(v), ci);
  if (ci instanceof PyTuple) return ci.items.some((c) => isInstance(v, c));
  throw TypeErr('isinstance() arg 2 must be a type, a tuple of types, or a union');
}
defb('issubclass', (args) => {
  checkArgs('issubclass', args, 2, 2);
  if (!(args[0] instanceof PyType)) throw TypeErr('issubclass() arg 1 must be a class');
  const ci = args[1];
  const test = (c) => { if (!(c instanceof PyType)) throw TypeErr('issubclass() arg 2 must be a class, a tuple of classes, or a union'); return isSubtype(args[0], c); };
  return ci instanceof PyTuple ? ci.items.some(test) : test(ci);
});
defb('iter', (args) => { checkArgs('iter', args, 1, 1); return getIter(args[0]); });
defb('next', (args) => {
  checkArgs('next', args, 1, 2);
  const it = args[0];
  if (!(it instanceof PyIterator)) throw TypeErr(`'${tname(it)}' object is not an iterator`);
  const v = it.next();
  if (v !== STOP) return v;
  if (args.length > 1) return args[1];
  throw exc('StopIteration');
});
defb('format', (args) => {
  checkArgs('format', args, 1, 2);
  const spec = args.length > 1 ? args[1] : '';
  if (typeof spec !== 'string') throw TypeErr(`format() argument 2 must be str, not ${tname(spec)}`);
  return formatValue(args[0], spec);
});
defb('hash', (args) => {
  checkArgs('hash', args, 1, 1, 'O');
  const v = args[0];
  const h = hkey(v);
  if (typeof h === 'number') { if (Number.isInteger(h)) return h === -1 ? -2 : h; return Math.floor(h * 1e9) % 2305843009213693951; }
  if (typeof h === 'bigint') return normBig(h % 2305843009213693951n);
  if (h === null) return 0xfca86420;
  const s = typeof h === 'string' ? h : 'o' + objId(h);
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) | 0;
  return x;
});
defb('id', (args) => {
  checkArgs('id', args, 1, 1, 'O');
  const v = args[0];
  if (v !== null && typeof v === 'object') return 139860000000000 + objId(v) * 48;
  return 139850000000000 + Math.abs(Number(hkey(v)) | 0) * 32;
});

function minmax(name, args, kw, isMax) {
  const o = kwOnly(name, kw, ['key', 'default']);
  if (args.length === 0) throw TypeErr(`${name} expected at least 1 argument, got 0`);
  let items;
  if (args.length === 1) items = iterToArray(args[0]);
  else {
    if ('default' in o) throw TypeErr(`Cannot specify a default for ${name}() with multiple positional arguments`);
    items = args;
  }
  if (items.length === 0) {
    if ('default' in o) return o.default;
    throw ValueErr(`${name}() iterable argument is empty`);
  }
  const key = o.key === undefined || o.key === null ? null : o.key;
  let best = items[0], bestK = key ? callValue(key, [best], null) : best;
  for (let i = 1; i < items.length; i++) {
    const v = items[i], k = key ? callValue(key, [v], null) : v;
    if (isMax ? order('gt', k, bestK) : order('lt', k, bestK)) { best = v; bestK = k; }
  }
  return best;
}
defb('max', (args, kw) => minmax('max', args, kw, true), 'max(iterable) or max(a, b, ...) — the biggest item. key=function picks what to compare.');
defb('min', (args, kw) => minmax('min', args, kw, false), 'min(iterable) or min(a, b, ...) — the smallest item.');

defb('sum', (args, kw) => {
  if (args.length === 0) throw TypeErr('sum() takes at least 1 positional argument (0 given)');
  if (args.length > 2) throw TypeErr(`sum() takes at most 2 arguments (${args.length} given)`);
  let result = args.length > 1 ? args[1] : 0;
  if (kw) for (const k in kw) { if (k === 'start') result = kw[k]; else throw TypeErr(`sum() got an unexpected keyword argument '${k}'`); }
  if (typeof result === 'string') throw TypeErr("sum() can't sum strings [use ''.join(seq) instead]");
  const it = getIter(args[0]);
  let n = 0;
  if (typeof result === 'number' || typeof result === 'bigint') {
    let acc = result;
    for (;;) {
      const v = it.next();
      if (v === STOP) return acc;
      if ((++n & 7) === 0) charge(1);
      if (typeof v === 'number' && typeof acc === 'number') { const r = acc + v; if (r <= MAX_SAFE && r >= -MAX_SAFE) { acc = r; continue; } }
      if (isIntLike(v)) { acc = iAdd(acc, intOf(v)); continue; }
      result = binop('add', acc, v);
      break;
    }
  }
  if (result instanceof PyFloat) {
    let f = result.v, c = 0;
    for (;;) {
      const v = it.next();
      if (v === STOP) { if (c && isFinite(c)) f += c; return F(f); }
      if ((++n & 7) === 0) charge(1);
      if (v instanceof PyFloat) {
        const x = v.v, t = f + x;
        if (Math.abs(f) >= Math.abs(x)) c += (f - t) + x; else c += (x - t) + f;
        f = t;
        continue;
      }
      if (typeof v === 'number' || typeof v === 'boolean') { f += intOf(v); continue; }
      if (c && isFinite(c)) f += c;
      result = binop('add', F(f), v);
      break;
    }
  }
  for (;;) {
    const v = it.next();
    if (v === STOP) return result;
    if ((++n & 7) === 0) charge(1);
    result = binop('add', result, v);
  }
}, 'sum(iterable, start=0) — add up all the numbers.');

defb('sorted', (args, kw) => {
  if (args.length !== 1) throw TypeErr(`sorted expected 1 argument, got ${args.length}`);
  const o = sortOpts('sorted', kw);
  return pySort(iterToArray(args[0]), o.key, o.reverse);
}, 'sorted(iterable, key=None, reverse=False) — a new sorted list.');

defb('reversed', (args, kw) => {
  noKw('reversed', kw);
  checkArgs('reversed', args, 1, 1);
  const s = args[0];
  if (Array.isArray(s)) {
    let i = s.length - 1;
    return new FnIter(ITER_T.list_reverseiterator, () => { if (i >= s.length) i = s.length - 1; return i >= 0 ? s[i--] : STOP; });
  }
  if (typeof s === 'string' || s instanceof PyTuple || s instanceof PyRange || s instanceof PyDict || s instanceof PyDictView) {
    if (s instanceof PyDictView && s.kind !== 'keys' && s.kind !== 'values' && s.kind !== 'items') throw TypeErr(`'${tname(s)}' object is not reversible`);
    const items = iterToArray(s);
    let i = items.length - 1;
    return new FnIter(ITER_T.reversed, () => (i >= 0 ? items[i--] : STOP));
  }
  throw TypeErr(`'${tname(s)}' object is not reversible`);
});

defb('enumerate', (args, kw) => {
  let iterable, start = 0;
  if (kw) for (const k in kw) {
    if (k === 'start') start = kw[k];
    else if (k === 'iterable') iterable = kw[k];
    else throw TypeErr(`enumerate() got an unexpected keyword argument '${k}'`);
  }
  if (args.length > 2) throw TypeErr(`enumerate() takes at most 2 arguments (${args.length} given)`);
  if (args.length >= 1) iterable = args[0];
  if (args.length === 2) start = args[1];
  if (iterable === undefined) throw TypeErr("enumerate() missing required argument 'iterable'");
  let n = needInt(start, `'${tname(start)}' object cannot be interpreted as an integer`);
  const it = getIter(iterable);
  return new FnIter(ITER_T.enumerate, () => {
    const v = it.next();
    if (v === STOP) return STOP;
    const t = new PyTuple([n, v]);
    n = iAdd(n, 1);
    return t;
  });
}, 'enumerate(iterable, start=0) — pairs of (index, item).');

defb('zip', (args, kw) => {
  const o = kwOnly('zip', kw, ['strict']);
  const strict = o.strict !== undefined && truthy(o.strict);
  const its = args.map(getIter);
  if (its.length === 0) return new FnIter(ITER_T.zip, () => STOP);
  return new FnIter(ITER_T.zip, () => {
    const row = new Array(its.length);
    for (let i = 0; i < its.length; i++) {
      const v = its[i].next();
      if (v === STOP) {
        if (strict) {
          if (i > 0) throw ValueErr(`zip() argument ${i + 1} is shorter than argument${i > 1 ? 's 1-' + i : ' 1'}`);
          for (let j = 1; j < its.length; j++) if (its[j].next() !== STOP) throw ValueErr(`zip() argument ${j + 1} is longer than argument${j > 1 ? 's 1-' + j : ' 1'}`);
        }
        return STOP;
      }
      row[i] = v;
    }
    return new PyTuple(row);
  });
}, 'zip(a, b, ...) — walk several lists side by side, giving tuples.');

defb('map', (args, kw) => {
  noKw('map', kw);
  if (args.length < 2) throw TypeErr('map() must have at least two arguments.');
  const fn = args[0];
  const its = args.slice(1).map(getIter);
  return new FnIter(ITER_T.map, () => {
    const a = new Array(its.length);
    for (let i = 0; i < its.length; i++) { const v = its[i].next(); if (v === STOP) return STOP; a[i] = v; }
    return callValue(fn, a, null);
  });
}, 'map(function, iterable) — apply function to every item (lazily).');

defb('filter', (args, kw) => {
  noKw('filter', kw);
  checkArgs('filter', args, 2, 2);
  const fn = args[0];
  const it = getIter(args[1]);
  return new FnIter(ITER_T.filter, () => {
    for (;;) {
      const v = it.next();
      if (v === STOP) return STOP;
      if (fn === null ? truthy(v) : truthy(callValue(fn, [v], null))) return v;
    }
  });
}, 'filter(function, iterable) — keep the items where function(item) is true.');

defb('any', (args, kw) => {
  noKw('any', kw); checkArgs('any', args, 1, 1, 'O');
  const it = getIter(args[0]);
  for (let n = 1; ; n++) { const v = it.next(); if (v === STOP) return false; if (truthy(v)) return true; if ((n & 7) === 0) charge(1); }
});
defb('all', (args, kw) => {
  noKw('all', kw); checkArgs('all', args, 1, 1, 'O');
  const it = getIter(args[0]);
  for (let n = 1; ; n++) { const v = it.next(); if (v === STOP) return true; if (!truthy(v)) return false; if ((n & 7) === 0) charge(1); }
});

defb('round', (args, kw) => {
  let num, nd = null;
  if (kw) for (const k in kw) {
    if (k === 'number') num = kw[k]; else if (k === 'ndigits') nd = kw[k];
    else throw TypeErr(`round() got an unexpected keyword argument '${k}'`);
  }
  if (args.length > 2) throw TypeErr(`round() takes at most 2 arguments (${args.length} given)`);
  if (args.length >= 1) num = args[0];
  if (args.length === 2) nd = args[1];
  if (num === undefined) throw TypeErr("round() missing required argument 'number' (pos 1)");
  if (isIntLike(num)) {
    const x = intOf(num);
    if (nd === null) return x;
    const n = needInt(nd);
    if (n >= 0) return x;
    const p = 10n ** toBig(iNeg(n));
    const X = toBig(x);
    let q = X / p, r = X % p;
    if (r < 0n) { r += p; q -= 1n; }
    const r2 = r * 2n;
    if (r2 > p || (r2 === p && (q & 1n) === 1n)) q += 1n;
    return normBig(q * p);
  }
  if (num instanceof PyFloat) {
    const x = num.v;
    if (nd === null) {
      if (x !== x) throw ValueErr('cannot convert float NaN to integer');
      if (!isFinite(x)) throw OverflowErr('cannot convert float infinity to integer');
      return floatToInt(roundHalfEven(x));
    }
    const n = needInt(nd);
    return F(roundFloat(x, Number(n)));
  }
  throw TypeErr(`type ${tname(num)} doesn't define __round__ method`);
}, 'round(x, ndigits=None) — round to ndigits after the point (banker\'s rounding: halves go to even).');

function modPow(b, e, m) {
  let result = 1n;
  b %= m; if (b < 0n) b += m;
  while (e > 0n) { if (e & 1n) result = (result * b) % m; e >>= 1n; b = (b * b) % m; }
  return result;
}
function modInverse(a, m) {
  let [g, x] = [a, 1n], [g1, x1] = [m, 0n];
  while (g1 !== 0n) { const q = g / g1; [g, g1] = [g1, g - q * g1]; [x, x1] = [x1, x - q * x1]; }
  if (g !== 1n && g !== -1n) throw ValueErr('base is not invertible for the given modulus');
  return g === 1n ? x : -x;
}
defb('pow', (args, kw) => {
  let a = args.slice();
  if (kw) for (const k in kw) {
    const pos = { base: 0, exp: 1, mod: 2 }[k];
    if (pos === undefined) throw TypeErr(`pow() got an unexpected keyword argument '${k}'`);
    a[pos] = kw[k];
  }
  if (a.length < 2 || a[0] === undefined || a[1] === undefined) throw TypeErr(`pow() missing required argument '${a[0] === undefined ? 'base' : 'exp'}' (pos ${a[0] === undefined ? 1 : 2})`);
  if (a.length > 3) throw TypeErr(`pow() takes at most 3 arguments (${a.length} given)`);
  if (a.length === 2 || a[2] === null) return binop('pow', a[0], a[1]);
  if (!isIntLike(a[0]) || !isIntLike(a[1]) || !isIntLike(a[2])) throw TypeErr('pow() 3rd argument not allowed unless all arguments are integers');
  let m = toBig(intOf(a[2]));
  if (m === 0n) throw ValueErr('pow() 3rd argument cannot be 0');
  const neg = m < 0n;
  if (neg) m = -m;
  let b = toBig(intOf(a[0])), e = toBig(intOf(a[1]));
  if (e < 0n) { b = modInverse(((b % m) + m) % m, m); e = -e; }
  let r = modPow(b, e, m);
  if (neg && r !== 0n) r -= m;
  return normBig(r);
});
defb('divmod', (args, kw) => {
  noKw('divmod', kw);
  checkArgs('divmod', args, 2, 2);
  const [a, b] = args;
  if (isIntLike(a) && isIntLike(b)) {
    const x = intOf(a), y = intOf(b);
    if (y == 0) throw ZeroDiv('integer division or modulo by zero');
    return new PyTuple([iFloorDiv(x, y), iMod(x, y)]);
  }
  if (isNum(a) && isNum(b)) {
    const x = fval(a), y = fval(b);
    if (y === 0) throw ZeroDiv('float divmod()');
    const [q, r] = floatDivMod(x, y);
    return new PyTuple([F(q), F(r)]);
  }
  throw TypeErr(`unsupported operand type(s) for divmod(): '${tname(a)}' and '${tname(b)}'`);
});
defb('input', (args) => {
  const vm = CUR;
  const prompt = args.length ? str(args[0]) : '';
  if (vm.inputFn) {
    if (prompt) vm.write(prompt);
    const v = vm.inputFn(prompt);
    if (v === null || v === undefined) throw exc('EOFError', 'EOF when reading a line');
    if (prompt) vm.write('\n');
    return String(v);
  }
  throw exc('EOFError', "input() can't read anything here — there's no keyboard on this mission");
}, 'input(prompt) — not available on missions: put the value in a variable instead.');
defb('getattr', (args) => {
  checkArgs('getattr', args, 2, 3);
  if (typeof args[1] !== 'string') throw TypeErr("attribute name must be string, not '" + tname(args[1]) + "'");
  try { return getAttr(args[0], args[1]); } catch (e) {
    if (args.length === 3 && e instanceof PyException && e.cls === EXC.AttributeError) return args[2];
    throw e;
  }
});
defb('hasattr', (args) => {
  checkArgs('hasattr', args, 2, 2);
  try { getAttr(args[0], args[1]); return true; } catch (e) {
    if (e instanceof PyException && e.cls === EXC.AttributeError) return false;
    throw e;
  }
});
defb('setattr', (args) => { checkArgs('setattr', args, 3, 3); setAttr(args[0], args[1], args[2]); return null; });
function publicNames(o) {
  if (o instanceof PyModule) return [...o.attrs.keys()].filter((k) => !k.startsWith('__')).sort();
  const t = o instanceof PyType ? o : typeOf(o);
  const names = new Set();
  for (let tt = t; tt; tt = tt.base) { for (const k in tt.methods) names.add(k); for (const k in tt.attrs) names.add(k); }
  return [...names].sort();
}
defb('dir', (args) => {
  if (args.length === 0) return [...CUR.globals.keys()].filter((k) => CUR.globals.get(k).v !== undefined).sort();
  return publicNames(args[0]);
});
defb('help', (args) => {
  const vm = CUR;
  if (!args.length) {
    vm.write("Type help(name) to read about a function, e.g. help(len). Lyosha's notes cover the rest.\n");
    return null;
  }
  const o = args[0];
  let head, doc;
  if (o instanceof PyFunction) {
    const s = o.spec;
    const ps = s.params.slice();
    if (s.varargsName) ps.push('*' + s.varargsName);
    if (s.kwargsName) ps.push('**' + s.kwargsName);
    head = `${o.name}(${ps.join(', ')})`;
    doc = o.doc;
  } else if (o instanceof PyBuiltin) { head = `${o.qual}(...)`; doc = o.doc; }
  else if (o instanceof PyModule) { head = `module ${o.name}`; doc = (o.attrs.get('__doc__') ?? null) || 'Names: ' + publicNames(o).join(', '); }
  else if (o instanceof PyType) { head = `class ${o.name}`; doc = 'Methods: ' + publicNames(o).join(', '); }
  else { head = `${tname(o)} object`; doc = 'Methods: ' + publicNames(o).join(', '); }
  vm.write(`Help on ${head}:\n\n    ${(doc || '(no description)').split('\n').join('\n    ')}\n\n`);
  return null;
});
const exitFn = (args) => { const e = exc('SystemExit'); if (args.length) e.args = [args[0]]; throw e; };
defb('exit', exitFn);
defb('quit', exitFn);
defb('globals', () => {
  const d = new PyDict();
  for (const [k, c] of CUR.globals) if (c.v !== undefined) d.set(k, c.v);
  return d;
});
defb('open', () => { throw exc('OSError', "there are no files on this laptop — Lyosha keeps everything in variables"); });

for (const t of [T_int, T_float, T_str, T_bool, T_list, T_tuple, T_dict, T_set, T_frozenset, T_range, T_type, T_object, T_slice]) BUILTINS.set(t.name, t);
for (const name in EXC) BUILTINS.set(name, EXC[name]);
BUILTINS.set('Ellipsis', ELLIPSIS);

// ===========================================================================
// 17. Methods of builtin types
// ===========================================================================

// ---- str ----
const SM = T_str.methods;
function strArg(v, what) {
  if (typeof v !== 'string') throw TypeErr(what || `must be str, not ${tname(v)}`);
  return v;
}
function adjustRange(len, start, end) {
  const idx = (v, d) => (v === undefined || v === null ? d : indexOf(v, 'slice indices must be integers or None or have an __index__ method'));
  let st = idx(start, 0), en = idx(end, len);
  if (st < 0) { st += len; if (st < 0) st = 0; }
  if (en < 0) { en += len; if (en < 0) en = 0; } else if (en > len) en = len;
  return [st, en];
}
function strFind(s, a, name, rev) {
  checkArgs(name, a, 1, 3);
  const sub = strArg(a[0], `must be str, not ${tname(a[0])}`);
  const [st, en] = adjustRange(s.length, a[1], a[2]);
  if (en - st < sub.length || st > s.length) return -1;
  if (!rev) { const i = s.indexOf(sub, st); return i < 0 || i + sub.length > en ? -1 : i; }
  const i = s.lastIndexOf(sub, en - sub.length);
  return i < st ? -1 : i;
}
SM.find = (s, a) => strFind(s, a, 'find', false);
SM.rfind = (s, a) => strFind(s, a, 'rfind', true);
SM.index = (s, a) => { const i = strFind(s, a, 'index', false); if (i < 0) throw ValueErr('substring not found'); return i; };
SM.rindex = (s, a) => { const i = strFind(s, a, 'rindex', true); if (i < 0) throw ValueErr('substring not found'); return i; };
SM.count = (s, a) => {
  checkArgs('count', a, 1, 3);
  const sub = strArg(a[0]);
  const [st, en] = adjustRange(s.length, a[1], a[2]);
  if (st > s.length || en < st) return 0;
  if (sub === '') return en - st + 1;
  let n = 0;
  for (let i = s.indexOf(sub, st); i >= 0 && i + sub.length <= en; i = s.indexOf(sub, i + sub.length)) n++;
  return n;
};
const noArgs = (name, fn) => (s, a, kw) => { noKw(name, kw); checkArgs(name, a, 0, 0, 'noargs'); return fn(s); };
SM.upper = noArgs('str.upper', (s) => s.toUpperCase());
SM.lower = noArgs('str.lower', (s) => s.toLowerCase());
SM.casefold = noArgs('str.casefold', (s) => s.toLowerCase().replace(/ß/g, 'ss'));
SM.swapcase = noArgs('str.swapcase', (s) => {
  let o = '';
  for (const ch of s) { const u = ch.toUpperCase(), l = ch.toLowerCase(); o += ch === u ? l : u; }
  return o;
});
const RE_CASED = /[\p{Lu}\p{Ll}\p{Lt}]/u;
const RE_UPPER = /[\p{Lu}\p{Lt}]/u;
const RE_LOWER = /\p{Ll}/u;
SM.title = noArgs('str.title', (s) => {
  let o = '', prev = false;
  for (const ch of s) {
    o += prev ? ch.toLowerCase() : ch.toUpperCase();
    prev = RE_CASED.test(ch);
  }
  return o;
});
SM.capitalize = noArgs('str.capitalize', (s) => {
  if (!s) return s;
  const first = [...s][0];
  return first.toUpperCase() + s.slice(first.length).toLowerCase();
});
const charTest = (name, re, emptyFalse = true) => noArgs(name, (s) => {
  if (!s) return !emptyFalse;
  for (const ch of s) if (!re.test(ch)) return false;
  return true;
});
SM.isdigit = charTest('str.isdigit', /[\p{Nd}²³¹⁰-⁹₀-₉]/u);
SM.isdecimal = charTest('str.isdecimal', /\p{Nd}/u);
SM.isnumeric = charTest('str.isnumeric', /[\p{Nd}\p{Nl}\p{No}〇零一-九]/u);
SM.isalpha = charTest('str.isalpha', /[\p{L}]/u);
SM.isalnum = charTest('str.isalnum', /[\p{L}\p{N}]/u);
SM.isspace = charTest('str.isspace', RE_WS_CH);
SM.isascii = noArgs('str.isascii', (s) => /^[\x00-\x7f]*$/.test(s));
SM.isprintable = noArgs('str.isprintable', (s) => { for (const ch of s) if (!isPrintableChar(ch)) return false; return true; });
SM.isidentifier = noArgs('str.isidentifier', (s) => /^[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}]*$/u.test(s));
SM.isupper = noArgs('str.isupper', (s) => { let cased = false; for (const ch of s) { if (RE_LOWER.test(ch)) return false; if (RE_UPPER.test(ch)) cased = true; } return cased; });
SM.islower = noArgs('str.islower', (s) => { let cased = false; for (const ch of s) { if (RE_UPPER.test(ch)) return false; if (RE_LOWER.test(ch)) cased = true; } return cased; });
SM.istitle = noArgs('str.istitle', (s) => {
  let cased = false, prev = false;
  for (const ch of s) {
    if (RE_UPPER.test(ch)) { if (prev) return false; prev = true; cased = true; }
    else if (RE_LOWER.test(ch)) { if (!prev) return false; prev = true; cased = true; }
    else prev = false;
  }
  return cased;
});
function stripChars(name, s, a, left, right) {
  checkArgs(name, a, 0, 1);
  const chars = a.length ? a[0] : null;
  if (chars === null) {
    if (left) s = s.replace(RE_STRIP_L, '');
    if (right) s = s.replace(RE_STRIP_R, '');
    return s;
  }
  if (typeof chars !== 'string') throw TypeErr(`${name} arg must be None or str`);
  let i = 0, j = s.length;
  if (left) while (i < j && chars.includes(s[i])) i++;
  if (right) while (j > i && chars.includes(s[j - 1])) j--;
  return s.slice(i, j);
}
SM.strip = (s, a, kw) => { noKw('strip', kw); return stripChars('strip', s, a, true, true); };
SM.lstrip = (s, a, kw) => { noKw('lstrip', kw); return stripChars('lstrip', s, a, true, false); };
SM.rstrip = (s, a, kw) => { noKw('rstrip', kw); return stripChars('rstrip', s, a, false, true); };
function splitArgs(name, a, kw) {
  if (a.length > 2) throw TypeErr(`${name}() takes at most 2 arguments (${a.length} given)`);
  let sep = a.length > 0 ? a[0] : null, maxsplit = a.length > 1 ? a[1] : -1;
  if (kw) for (const k in kw) {
    if (k === 'sep') sep = kw[k]; else if (k === 'maxsplit') maxsplit = kw[k];
    else throw TypeErr(`${name}() got an unexpected keyword argument '${k}'`);
  }
  if (sep !== null && typeof sep !== 'string') throw TypeErr(`must be str or None, not ${tname(sep)}`);
  if (sep === '') throw ValueErr('empty separator');
  maxsplit = Number(needInt(maxsplit));
  return [sep, maxsplit];
}
const isWs = (c) => RE_WS_CH.test(c);
SM.split = (s, a, kw) => {
  const [sep, maxsplit] = splitArgs('split', a, kw);
  const out = [];
  if (sep === null) {
    let i = 0;
    const n = s.length;
    for (;;) {
      while (i < n && isWs(s[i])) i++;
      if (i >= n) break;
      if (maxsplit >= 0 && out.length >= maxsplit) { out.push(s.slice(i)); break; }
      let j = i;
      while (j < n && !isWs(s[j])) j++;
      out.push(s.slice(i, j));
      i = j;
    }
    return out;
  }
  if (maxsplit < 0) return s.split(sep);
  let i = 0;
  while (out.length < maxsplit) {
    const j = s.indexOf(sep, i);
    if (j < 0) break;
    out.push(s.slice(i, j));
    i = j + sep.length;
  }
  out.push(s.slice(i));
  return out;
};
SM.rsplit = (s, a, kw) => {
  const [sep, maxsplit] = splitArgs('rsplit', a, kw);
  if (maxsplit < 0) return SM.split(s, sep === null ? [] : [sep], null);
  const out = [];
  if (sep === null) {
    let j = s.length;
    for (;;) {
      while (j > 0 && isWs(s[j - 1])) j--;
      if (j <= 0) break;
      if (out.length >= maxsplit) { out.push(s.slice(0, j)); break; }
      let i = j;
      while (i > 0 && !isWs(s[i - 1])) i--;
      out.push(s.slice(i, j));
      j = i;
    }
    return out.reverse();
  }
  let j = s.length;
  while (out.length < maxsplit) {
    const i = s.lastIndexOf(sep, j - sep.length);
    if (i < 0 || j - sep.length < 0) break;
    out.push(s.slice(i + sep.length, j));
    j = i;
  }
  out.push(s.slice(0, j));
  return out.reverse();
};
SM.splitlines = (s, a, kw) => {
  let keep = a.length ? truthy(a[0]) : false;
  if (kw && 'keepends' in kw) keep = truthy(kw.keepends);
  const out = [];
  const re = /\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/g;
  let last = 0, m;
  while ((m = re.exec(s))) { out.push(s.slice(last, keep ? m.index + m[0].length : m.index)); last = m.index + m[0].length; }
  if (last < s.length) out.push(s.slice(last));
  return out;
};
SM.join = (s, a, kw) => {
  noKw('str.join', kw);
  checkArgs('str.join', a, 1, 1, 'O');
  const items = iterToArray(a[0]);
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'string') throw TypeErr(`sequence item ${i}: expected str instance, ${tname(items[i])} found`);
  }
  const total = items.reduce((n, x) => n + x.length, 0) + s.length * Math.max(0, items.length - 1);
  checkLen(total);
  return items.join(s);
};
SM.replace = (s, a, kw) => {
  let count = -1;
  if (kw) for (const k in kw) { if (k === 'count') count = kw[k]; else throw TypeErr(`replace() got an unexpected keyword argument '${k}'`); }
  checkArgs('replace', a, 2, 3, 'kw');
  const old = strArg(a[0], `replace() argument 1 must be str, not ${tname(a[0])}`);
  const neu = strArg(a[1], `replace() argument 2 must be str, not ${tname(a[1])}`);
  if (a.length > 2) count = a[2];
  count = Number(needInt(count));
  if (count < 0) count = Infinity;
  if (old === '') {
    let out = '', n = 0;
    for (let i = 0; i <= s.length; i++) {
      if (n < count) { out += neu; n++; }
      if (i < s.length) out += s[i];
    }
    checkLen(out.length);
    return out;
  }
  if (count === Infinity) { const r = s.split(old).join(neu); checkLen(r.length); return r; }
  let out = '', i = 0, n = 0;
  while (n < count) {
    const j = s.indexOf(old, i);
    if (j < 0) break;
    out += s.slice(i, j) + neu;
    i = j + old.length;
    n++;
  }
  return out + s.slice(i);
};
function affix(name, s, a, atStart) {
  checkArgs(name, a, 1, 3);
  const [st, en] = adjustRange(s.length, a[1], a[2]);
  const test = (p) => {
    if (typeof p !== 'string') throw TypeErr(`${name} first arg must be str or a tuple of str, not ${tname(p)}`);
    if (st > s.length) return false;
    const seg = s.slice(st, Math.max(st, en));
    if (p.length > en - st) return false;
    return atStart ? seg.startsWith(p) : seg.endsWith(p);
  };
  const p = a[0];
  if (p instanceof PyTuple) return p.items.some((x) => {
    if (typeof x !== 'string') throw TypeErr(`tuple for ${name} must only contain str, not ${tname(x)}`);
    return test(x);
  });
  return test(p);
}
SM.startswith = (s, a) => affix('startswith', s, a, true);
SM.endswith = (s, a) => affix('endswith', s, a, false);
function fillArgs(name, a) {
  checkArgs(name, a, 1, 2);
  const w = Number(needInt(a[0]));
  const f = a.length > 1 ? a[1] : ' ';
  if (typeof f !== 'string' || f.length !== 1) {
    if (typeof f !== 'string') throw TypeErr(`${name}() argument 2 must be str, not ${tname(f)}`);
    throw TypeErr('The fill character must be exactly one character long');
  }
  checkLen(w);
  return [w, f];
}
SM.center = (s, a) => {
  const [w, f] = fillArgs('center', a);
  if (w <= s.length) return s;
  const marg = w - s.length;
  const left = Math.floor(marg / 2) + (marg & w & 1);
  return f.repeat(left) + s + f.repeat(marg - left);
};
SM.ljust = (s, a) => { const [w, f] = fillArgs('ljust', a); return w <= s.length ? s : s + f.repeat(w - s.length); };
SM.rjust = (s, a) => { const [w, f] = fillArgs('rjust', a); return w <= s.length ? s : f.repeat(w - s.length) + s; };
SM.zfill = (s, a) => {
  checkArgs('zfill', a, 1, 1);
  const w = Number(needInt(a[0]));
  if (w <= s.length) return s;
  checkLen(w);
  const pad = '0'.repeat(w - s.length);
  if (s[0] === '+' || s[0] === '-') return s[0] + pad + s.slice(1);
  return pad + s;
};
SM.partition = (s, a) => {
  checkArgs('str.partition', a, 1, 1, 'O');
  const sep = strArg(a[0]);
  if (!sep) throw ValueErr('empty separator');
  const i = s.indexOf(sep);
  return i < 0 ? new PyTuple([s, '', '']) : new PyTuple([s.slice(0, i), sep, s.slice(i + sep.length)]);
};
SM.rpartition = (s, a) => {
  checkArgs('str.rpartition', a, 1, 1, 'O');
  const sep = strArg(a[0]);
  if (!sep) throw ValueErr('empty separator');
  const i = s.lastIndexOf(sep);
  return i < 0 ? new PyTuple(['', '', s]) : new PyTuple([s.slice(0, i), sep, s.slice(i + sep.length)]);
};
SM.removeprefix = (s, a) => { checkArgs('str.removeprefix', a, 1, 1, 'O'); const p = strArg(a[0]); return p && s.startsWith(p) ? s.slice(p.length) : s; };
SM.removesuffix = (s, a) => { checkArgs('str.removesuffix', a, 1, 1, 'O'); const p = strArg(a[0]); return p && s.endsWith(p) ? s.slice(0, s.length - p.length) : s; };
SM.expandtabs = (s, a, kw) => {
  let ts = a.length ? a[0] : kw && 'tabsize' in kw ? kw.tabsize : 8;
  ts = Number(needInt(ts));
  let out = '', col = 0;
  for (const ch of s) {
    if (ch === '\t') { if (ts > 0) { const k = ts - (col % ts); out += ' '.repeat(k); col += k; } }
    else { out += ch; col = ch === '\n' || ch === '\r' ? 0 : col + 1; }
  }
  return out;
};
SM.format = (s, a, kw) => strFormat(s, a, kw);
SM.format_map = (s, a) => {
  checkArgs('str.format_map', a, 1, 1, 'O');
  const d = a[0];
  const kw = {};
  if (d instanceof PyDict) for (const e of d.m.values()) if (typeof e[0] === 'string') kw[e[0]] = e[1];
  return strFormat(s, [], kw);
};
SM.translate = (s, a) => {
  checkArgs('str.translate', a, 1, 1, 'O');
  const table = a[0];
  let out = '';
  for (const ch of s) {
    let v;
    try { v = getItem(table, ch.codePointAt(0)); } catch (e) {
      if (e instanceof PyException && isSubtype(e.cls, EXC.LookupError)) { out += ch; continue; }
      throw e;
    }
    if (v === null) continue;
    if (typeof v === 'string') out += v;
    else if (isIntLike(v)) out += String.fromCodePoint(Number(intOf(v)));
    else throw TypeErr('character mapping must return integer, None or str');
  }
  return out;
};
SM.encode = () => { throw NotImpl('bytes'); };
T_str.attrs.maketrans = new PyBuiltin('maketrans', (a) => {
  checkArgs('maketrans', a, 1, 3);
  const d = new PyDict();
  if (a.length === 1) {
    if (!(a[0] instanceof PyDict)) throw TypeErr('if you give only one argument to maketrans it must be a dict');
    for (const e of a[0].m.values()) d.set(typeof e[0] === 'string' ? e[0].codePointAt(0) : e[0], e[1]);
    return d;
  }
  const x = strArg(a[0]), y = strArg(a[1]);
  if (x.length !== y.length) throw ValueErr('the first two maketrans arguments must have equal length');
  for (let i = 0; i < x.length; i++) d.set(x.codePointAt(i), y.codePointAt(i));
  if (a.length > 2) for (const ch of strArg(a[2])) d.set(ch.codePointAt(0), null);
  return d;
}, undefined, null, 'str.maketrans');

// ---- list ----
const LM = T_list.methods;
LM.append = (l, a, kw) => { noKw('list.append', kw); checkArgs('list.append', a, 1, 1, 'O'); if (l.length >= MAX_SEQ) throw MemoryErr(); l.push(a[0]); return null; };
LM.extend = (l, a) => {
  checkArgs('list.extend', a, 1, 1, 'O');
  const items = a[0] === l ? l.slice() : iterToArray(a[0]);
  checkLen(l.length + items.length);
  for (let i = 0; i < items.length; i++) l.push(items[i]);
  return null;
};
LM.insert = (l, a) => {
  checkArgs('insert', a, 2, 2);
  let i = indexOf(a[0], `'${tname(a[0])}' object cannot be interpreted as an integer`);
  if (i < 0) { i += l.length; if (i < 0) i = 0; } else if (i > l.length) i = l.length;
  l.splice(i, 0, a[1]);
  return null;
};
LM.pop = (l, a) => {
  checkArgs('pop', a, 0, 1);
  if (l.length === 0) throw IndexErr('pop from empty list');
  if (!a.length) return l.pop();
  let i = indexOf(a[0], `'${tname(a[0])}' object cannot be interpreted as an integer`);
  if (i < 0) i += l.length;
  if (i < 0 || i >= l.length) throw IndexErr('pop index out of range');
  return l.splice(i, 1)[0];
};
LM.remove = (l, a) => {
  checkArgs('list.remove', a, 1, 1, 'O');
  for (let i = 0; i < l.length; i++) if (l[i] === a[0] || eq(l[i], a[0])) { l.splice(i, 1); return null; }
  throw ValueErr('list.remove(x): x not in list');
};
LM.index = (l, a) => {
  checkArgs('index', a, 1, 3);
  const [st, en] = adjustRange(l.length, a[1], a[2]);
  for (let i = st; i < en && i < l.length; i++) if (l[i] === a[0] || eq(l[i], a[0])) return i;
  throw ValueErr(`${repr(a[0])} is not in list`);
};
LM.count = (l, a) => {
  checkArgs('list.count', a, 1, 1, 'O');
  let n = 0;
  for (let i = 0; i < l.length; i++) if (l[i] === a[0] || eq(l[i], a[0])) n++;
  return n;
};
LM.sort = (l, a, kw) => {
  if (a.length) throw TypeErr('sort() takes no positional arguments');
  const o = sortOpts('sort', kw);
  pySort(l, o.key, o.reverse);
  return null;
};
LM.reverse = noArgs('list.reverse', (l) => { l.reverse(); return null; });
LM.copy = noArgs('list.copy', (l) => l.slice());
LM.clear = noArgs('list.clear', (l) => { l.length = 0; return null; });

// ---- tuple ----
const TM = T_tuple.methods;
TM.count = (t, a) => { checkArgs('tuple.count', a, 1, 1, 'O'); return LM.count(t.items, a); };
TM.index = (t, a) => {
  checkArgs('index', a, 1, 3);
  const l = t.items;
  const [st, en] = adjustRange(l.length, a[1], a[2]);
  for (let i = st; i < en && i < l.length; i++) if (l[i] === a[0] || eq(l[i], a[0])) return i;
  throw ValueErr('tuple.index(x): x not in tuple');
};

// ---- dict ----
const DM = T_dict.methods;
DM.get = (d, a) => { checkArgs('get', a, 1, 2); const v = d.get(a[0]); return v === undefined ? (a.length > 1 ? a[1] : null) : v; };
DM.keys = noArgs('dict.keys', (d) => new PyDictView(d, 'keys'));
DM.values = noArgs('dict.values', (d) => new PyDictView(d, 'values'));
DM.items = noArgs('dict.items', (d) => new PyDictView(d, 'items'));
DM.pop = (d, a) => {
  checkArgs('pop', a, 1, 2);
  const h = hkey(a[0]);
  const e = d.m.get(h);
  if (e === undefined) { if (a.length > 1) return a[1]; throw KeyErr(a[0]); }
  d.m.delete(h);
  return e[1];
};
DM.popitem = noArgs('dict.popitem', (d) => {
  if (!d.size) throw KeyErr('popitem(): dictionary is empty');
  let last;
  for (const [h, e] of d.m) last = [h, e];
  d.m.delete(last[0]);
  return new PyTuple([last[1][0], last[1][1]]);
});
DM.setdefault = (d, a) => {
  checkArgs('setdefault', a, 1, 2);
  const v = d.get(a[0]);
  if (v !== undefined) return v;
  const dv = a.length > 1 ? a[1] : null;
  d.set(a[0], dv);
  return dv;
};
DM.update = (d, a, kw) => { dictUpdate(d, a, kw); return null; };
DM.copy = noArgs('dict.copy', (d) => d.copy());
DM.clear = noArgs('dict.clear', (d) => { d.m.clear(); return null; });
T_dict.attrs.fromkeys = new PyBuiltin('fromkeys', (a) => {
  checkArgs('fromkeys', a, 1, 2);
  const d = new PyDict();
  const v = a.length > 1 ? a[1] : null;
  for (const k of iterToArray(a[0])) d.set(k, v);
  return d;
}, undefined, null, 'dict.fromkeys');

// ---- set / frozenset ----
const STM = T_set.methods;
const FSM = T_frozenset.methods;
function others(a) { return a.map((x) => (x instanceof PySet ? x : makeSet([x], null, false))); }
STM.add = (s, a) => { checkArgs('set.add', a, 1, 1, 'O'); s.add(a[0]); return null; };
STM.remove = (s, a) => { checkArgs('set.remove', a, 1, 1, 'O'); if (!s.delete(a[0])) throw KeyErr(a[0]); return null; };
STM.discard = (s, a) => { checkArgs('set.discard', a, 1, 1, 'O'); s.delete(a[0]); return null; };
STM.pop = noArgs('set.pop', (s) => {
  if (!s.size) throw KeyErr('pop from an empty set');
  const v = s.vals()[0];
  s.delete(v);
  return v;
});
STM.clear = noArgs('set.clear', (s) => { s.m.clear(); return null; });
STM.update = (s, a) => { for (const o of a) for (const v of iterToArray(o)) s.add(v); return null; };
for (const [name, op] of [['union', 'or'], ['intersection', 'and'], ['difference', 'sub'], ['symmetric_difference', 'xor']]) {
  const m = (s, a) => {
    let r = s.frozen ? makeSet([s], null, true) : makeSet([s], null, false);
    if (op === 'xor') checkArgs(`set.${name}`, a, 1, 1, 'O');
    for (const o of others(a)) r = binop(op, r, o);
    if (a.length === 0) r = makeSet([s], null, s.frozen);
    return r;
  };
  STM[name] = m;
  FSM[name] = m;
  if (name !== 'union') {
    STM[name + '_update'] = (s, a) => { let r = s; for (const o of others(a)) r = binop(op, r, o); s.m = r.m; return null; };
  }
}
const setCmp = (name, fn) => (s, a) => { checkArgs(`set.${name}`, a, 1, 1, 'O'); return fn(s, others(a)[0]); };
STM.issubset = FSM.issubset = setCmp('issubset', (s, o) => order('le', s, o));
STM.issuperset = FSM.issuperset = setCmp('issuperset', (s, o) => order('ge', s, o));
STM.isdisjoint = FSM.isdisjoint = setCmp('isdisjoint', (s, o) => { for (const h of s.m.keys()) if (o.m.has(h)) return false; return true; });
STM.copy = noArgs('set.copy', (s) => makeSet([s], null, false));
FSM.copy = noArgs('frozenset.copy', (s) => s);

// ---- int / float / range ----
const IM = T_int.methods;
IM.bit_length = noArgs('int.bit_length', (v) => { const x = intOf(v); const a = x < 0 ? iAbs(x) : x; return a == 0 ? 0 : toBig(a).toString(2).length; });
IM.bit_count = noArgs('int.bit_count', (v) => { const x = intOf(v); return [...toBig(x < 0 ? iAbs(x) : x).toString(2)].filter((c) => c === '1').length; });
IM.is_integer = noArgs('int.is_integer', () => true);
IM.conjugate = noArgs('int.conjugate', (v) => intOf(v));
IM.as_integer_ratio = noArgs('int.as_integer_ratio', (v) => new PyTuple([intOf(v), 1]));
const FM = T_float.methods;
FM.is_integer = noArgs('float.is_integer', (f) => Number.isInteger(f.v));
FM.conjugate = noArgs('float.conjugate', (f) => f);
FM.as_integer_ratio = noArgs('float.as_integer_ratio', (f) => {
  const x = f.v;
  if (!isFinite(x)) throw x !== x ? ValueErr('cannot convert NaN to integer ratio') : OverflowErr('cannot convert Infinity to integer ratio');
  if (x === 0) return new PyTuple([0, 1]);
  const [m, e] = decompose(Math.abs(x));
  let num = m, den = 1n;
  if (e >= 0) num <<= BigInt(e); else den <<= BigInt(-e);
  const g = gcdBig(num, den);
  return new PyTuple([normBig((x < 0 ? -num : num) / g), normBig(den / g)]);
});
function gcdBig(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; }
const RM = T_range.methods;
RM.count = (r, a) => { checkArgs('range.count', a, 1, 1, 'O'); return contains(r, a[0]) ? 1 : 0; };
RM.index = (r, a) => {
  checkArgs('range.index', a, 1, 1, 'O');
  if (!contains(r, a[0])) throw ValueErr(`${repr(a[0])} is not in range`);
  return (Number(numVal(a[0])) - r.start) / r.step;
};

// ===========================================================================
// 18. Modules: math, random, string, time
// ===========================================================================

function mathArg(v) {
  if (isNum(v)) return fval(v);
  throw TypeErr(`must be real number, not ${tname(v)}`);
}
function domain(x) { if (x !== x) throw ValueErr('math domain error'); return x; }
function mf(fn) {
  return (a, kw) => {
    noKw(fn.name || 'math', kw);
    const xs = a.map(mathArg);
    if (xs.some((x) => x !== x)) return F(NaN);
    const r = fn(...xs);
    if (r !== r) throw ValueErr('math domain error');
    if (!isFinite(r) && xs.every(isFinite)) throw OverflowErr('math range error');
    return F(r);
  };
}
function intResult(x) { return floatToInt(x); }
function gcd2(a, b) { a = iAbs(a); b = iAbs(b); while (b != 0) [a, b] = [b, iMod(a, b)]; return a; }
function isqrtBig(n) {
  if (n < 0n) throw ValueErr('isqrt() argument must be nonnegative');
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  for (;;) { const y = (x + n / x) >> 1n; if (y >= x) { if (x * x > n) x -= 1n; while ((x + 1n) * (x + 1n) <= n) x += 1n; return x; } x = y; }
}
function factorialOf(v) {
  const n = needInt(v);
  if (n < 0) throw ValueErr('factorial() not defined for negative values');
  if (n > 5000) throw MemoryErr();
  let r = 1n;
  for (let i = 2n; i <= toBig(n); i++) r *= i;
  return normBig(r);
}
function makeMath() {
  const m = new Map();
  const put = (name, v) => m.set(name, v instanceof PyBuiltin || !(typeof v === 'function') ? v : new PyBuiltin(name, v, undefined, null, 'math.' + name));
  put('pi', F(Math.PI)); put('e', F(Math.E)); put('tau', F(2 * Math.PI)); put('inf', F(Infinity)); put('nan', F(NaN));
  put('sqrt', (a) => { checkArgs('sqrt', a, 1, 1, 'O'); const x = mathArg(a[0]); if (x < 0) throw ValueErr('math domain error'); return F(Math.sqrt(x)); });
  put('cbrt', mf(Math.cbrt));
  put('exp', mf(Math.exp)); put('exp2', mf((x) => 2 ** x)); put('expm1', mf(Math.expm1));
  put('sin', mf(Math.sin)); put('cos', mf(Math.cos)); put('tan', mf(Math.tan));
  put('asin', mf(Math.asin)); put('acos', mf(Math.acos)); put('atan', mf(Math.atan)); put('atan2', mf(Math.atan2));
  put('sinh', mf(Math.sinh)); put('cosh', mf(Math.cosh)); put('tanh', mf(Math.tanh));
  put('asinh', mf(Math.asinh)); put('acosh', mf(Math.acosh)); put('atanh', mf(Math.atanh));
  put('degrees', mf((x) => x * 180 / Math.PI)); put('radians', mf((x) => x * Math.PI / 180));
  put('fabs', mf(Math.abs));
  put('pow', (a) => { checkArgs('pow', a, 2, 2); const x = mathArg(a[0]), y = mathArg(a[1]); if (x === 0 && y < 0) throw ValueErr('math domain error'); const r = Math.pow(x, y); if (r !== r && x === x && y === y) throw ValueErr('math domain error'); if (!isFinite(r) && isFinite(x) && isFinite(y)) throw OverflowErr('math range error'); return F(r); });
  put('log', (a) => {
    checkArgs('log', a, 1, 2);
    const ln = (v) => {
      if (typeof v === 'bigint') { if (v <= 0n) throw ValueErr('expected a positive input'); const s = v.toString(); return Math.log(parseFloat('0.' + s)) + s.length * Math.LN10; }
      const x = mathArg(v);
      if (x <= 0) throw ValueErr(x === 0 ? 'expected a positive input, got 0.0' : 'expected a positive input');
      return Math.log(x);
    };
    const r = a.length > 1 ? ln(a[0]) / ln(a[1]) : ln(a[0]);
    if (!isFinite(r)) throw ZeroDiv('division by zero');
    return F(r);
  });
  put('log2', (a) => { checkArgs('log2', a, 1, 1, 'O'); const x = mathArg(a[0]); if (x <= 0) throw ValueErr('math domain error'); return F(Math.log2(x)); });
  put('log10', (a) => { checkArgs('log10', a, 1, 1, 'O'); const x = mathArg(a[0]); if (x <= 0) throw ValueErr('math domain error'); return F(Math.log10(x)); });
  put('log1p', mf(Math.log1p));
  put('floor', (a) => { checkArgs('floor', a, 1, 1, 'O'); const v = a[0]; if (isIntLike(v)) return intOf(v); return intResult(Math.floor(mathArg(v))); });
  put('ceil', (a) => { checkArgs('ceil', a, 1, 1, 'O'); const v = a[0]; if (isIntLike(v)) return intOf(v); return intResult(Math.ceil(mathArg(v))); });
  put('trunc', (a) => { checkArgs('trunc', a, 1, 1, 'O'); const v = a[0]; if (isIntLike(v)) return intOf(v); return intResult(Math.trunc(mathArg(v))); });
  put('modf', (a) => { const x = mathArg(a[0]); const i = Math.trunc(x); return new PyTuple([F(x - i), F(i)]); });
  put('fmod', (a) => { checkArgs('fmod', a, 2, 2); const x = mathArg(a[0]), y = mathArg(a[1]); if (y === 0 || !isFinite(x)) throw ValueErr('math domain error'); return F(x % y); });
  put('copysign', (a) => { checkArgs('copysign', a, 2, 2); const x = Math.abs(mathArg(a[0])), y = mathArg(a[1]); return F(y < 0 || Object.is(y, -0) ? -x : x); });
  put('hypot', (a) => F(Math.hypot(...a.map(mathArg))));
  put('dist', (a) => { checkArgs('dist', a, 2, 2); const p = iterToArray(a[0]).map(mathArg), q = iterToArray(a[1]).map(mathArg); if (p.length !== q.length) throw ValueErr('both points must have the same number of dimensions'); return F(Math.hypot(...p.map((x, i) => x - q[i]))); });
  put('isfinite', (a) => isFinite(mathArg(a[0])));
  put('isinf', (a) => { const x = mathArg(a[0]); return x === Infinity || x === -Infinity; });
  put('isnan', (a) => { const x = mathArg(a[0]); return x !== x; });
  put('isclose', (a, kw) => {
    checkArgs('isclose', a, 2, 2);
    const o = kwOnly('isclose', kw, ['rel_tol', 'abs_tol']);
    const x = mathArg(a[0]), y = mathArg(a[1]);
    const rel = o.rel_tol === undefined ? 1e-9 : mathArg(o.rel_tol), abs = o.abs_tol === undefined ? 0 : mathArg(o.abs_tol);
    if (x === y) return true;
    if (!isFinite(x) || !isFinite(y)) return false;
    const d = Math.abs(y - x);
    return d <= Math.abs(rel * y) || d <= Math.abs(rel * x) || d <= abs;
  });
  put('gcd', (a) => { let g = 0; for (const v of a) g = gcd2(g, intOf(needInt(v))); return g; });
  put('lcm', (a) => { let l = 1; for (const v of a) { const x = intOf(needInt(v)); if (x == 0) return 0; l = iAbs(iFloorDiv(iMul(l, x), gcd2(l, x))); } return l; });
  put('factorial', (a) => { checkArgs('factorial', a, 1, 1, 'O'); return factorialOf(a[0]); });
  put('isqrt', (a) => { checkArgs('isqrt', a, 1, 1, 'O'); return normBig(isqrtBig(toBig(intOf(needInt(a[0]))))); });
  put('comb', (a) => {
    checkArgs('comb', a, 2, 2);
    const n = toBig(intOf(needInt(a[0]))), k = toBig(intOf(needInt(a[1])));
    if (n < 0n) throw ValueErr('n must be a non-negative integer');
    if (k < 0n) throw ValueErr('k must be a non-negative integer');
    if (k > n) return 0;
    let r = 1n;
    const kk = k > n - k ? n - k : k;
    for (let i = 1n; i <= kk; i++) r = r * (n - kk + i) / i;
    return normBig(r);
  });
  put('perm', (a) => {
    checkArgs('perm', a, 1, 2);
    const n = toBig(intOf(needInt(a[0])));
    const k = a.length > 1 && a[1] !== null ? toBig(intOf(needInt(a[1]))) : n;
    if (n < 0n) throw ValueErr('n must be a non-negative integer');
    if (k < 0n) throw ValueErr('k must be a non-negative integer');
    if (k > n) return 0;
    let r = 1n;
    for (let i = 0n; i < k; i++) r *= n - i;
    return normBig(r);
  });
  put('prod', (a, kw) => {
    checkArgs('prod', a, 1, 1);
    let r = kw && 'start' in kw ? kw.start : 1;
    for (const v of iterToArray(a[0])) r = binop('mul', r, v);
    return r;
  });
  put('fsum', (a) => {
    checkArgs('fsum', a, 1, 1, 'O');
    const partials = [];
    for (const v of iterToArray(a[0])) {
      let x = mathArg(v);
      let i = 0;
      for (let y of partials) {
        if (Math.abs(x) < Math.abs(y)) { const t = x; x = y; y = t; }
        const hi = x + y, lo = y - (hi - x);
        if (lo) partials[i++] = lo;
        x = hi;
      }
      partials.length = i;
      partials.push(x);
    }
    let hi = 0;
    if (partials.length) {
      let n = partials.length - 1;
      hi = partials[n];
      let lo = 0;
      while (n > 0) { const x = hi; const y = partials[--n]; hi = x + y; const yr = hi - x; lo = y - yr; if (lo) break; }
      if (n > 0 && ((lo < 0 && partials[n - 1] < 0) || (lo > 0 && partials[n - 1] > 0))) {
        const y = lo * 2, x = hi + y, yr = x - hi;
        if (y === yr) hi = x;
      }
    }
    return F(hi);
  });
  put('remainder', mf((x, y) => { if (y === 0) return NaN; const n = roundHalfEven(x / y); return x - n * y; }));
  put('ulp', mf((x) => { if (!isFinite(x)) return Math.abs(x); x = Math.abs(x); if (x === 0) return 5e-324; const [, e] = decompose(x); return 2 ** Math.max(e, -1074); }));
  return new PyModule('math', m);
}

function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRandom(vm) {
  const m = new Map();
  let rng = makeRng(vm.seed);
  const put = (name, fn) => m.set(name, new PyBuiltin(name, fn, undefined, null, 'random.' + name));
  const below = (n) => Math.floor(rng() * n);
  put('seed', (a) => {
    const v = a.length ? a[0] : null;
    let s = 0;
    if (v !== null) { const k = str(v); for (let i = 0; i < k.length; i++) s = (Math.imul(s, 31) + k.charCodeAt(i)) | 0; }
    rng = makeRng(v === null ? (Date.now() >>> 0) : s);
    return null;
  });
  put('random', () => F(rng()));
  put('uniform', (a) => { checkArgs('uniform', a, 2, 2); const x = mathArg(a[0]), y = mathArg(a[1]); return F(x + (y - x) * rng()); });
  put('randint', (a) => {
    checkArgs('randint', a, 2, 2);
    const lo = Number(needInt(a[0])), hi = Number(needInt(a[1]));
    if (hi < lo) throw ValueErr(`empty range in randrange(${lo}, ${hi + 1})`);
    return lo + below(hi - lo + 1);
  });
  put('randrange', (a) => {
    const r = makeRange(a, null);
    if (!r.len) throw ValueErr('empty range for randrange()');
    return r.start + below(r.len) * r.step;
  });
  put('choice', (a) => {
    checkArgs('choice', a, 1, 1, 'O');
    const n = pyLen(a[0]);
    if (!n) throw IndexErr('Cannot choose from an empty sequence');
    return getItem(a[0], below(n));
  });
  put('choices', (a, kw) => {
    const items = iterToArray(a[0]);
    const k = kw && 'k' in kw ? Number(needInt(kw.k)) : 1;
    if (!items.length) throw IndexErr('Cannot choose from an empty sequence');
    return Array.from({ length: k }, () => items[below(items.length)]);
  });
  put('shuffle', (a) => {
    checkArgs('shuffle', a, 1, 1, 'O');
    const l = a[0];
    if (!Array.isArray(l)) throw TypeErr(`'${tname(l)}' object does not support item assignment`);
    for (let i = l.length - 1; i > 0; i--) { const j = below(i + 1); const t = l[i]; l[i] = l[j]; l[j] = t; }
    return null;
  });
  put('sample', (a, kw) => {
    const items = iterToArray(a[0]);
    const k = Number(needInt(a.length > 1 ? a[1] : kw && kw.k));
    if (k < 0 || k > items.length) throw ValueErr('Sample larger than population or is negative');
    for (let i = items.length - 1; i > 0; i--) { const j = below(i + 1); const t = items[i]; items[i] = items[j]; items[j] = t; }
    return items.slice(0, k);
  });
  return new PyModule('random', m);
}
function makeString() {
  const m = new Map();
  const lower = 'abcdefghijklmnopqrstuvwxyz', upper = lower.toUpperCase(), digits = '0123456789';
  const punct = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
  m.set('ascii_lowercase', lower); m.set('ascii_uppercase', upper); m.set('ascii_letters', lower + upper);
  m.set('digits', digits); m.set('hexdigits', '0123456789abcdefABCDEF'); m.set('octdigits', '01234567');
  m.set('punctuation', punct); m.set('whitespace', ' \t\n\r\x0b\x0c');
  m.set('printable', digits + lower + upper + punct + ' \t\n\r\x0b\x0c');
  m.set('capwords', new PyBuiltin('capwords', (a) => {
    const s = strArg(a[0]);
    const sep = a.length > 1 ? a[1] : null;
    const parts = SM.split(s, sep === null ? [] : [sep], null);
    return parts.map((w) => SM.capitalize(w, [], null)).join(sep === null ? ' ' : sep);
  }, undefined, null, 'string.capwords'));
  return new PyModule('string', m);
}
function makeTime() {
  const m = new Map();
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  m.set('time', new PyBuiltin('time', () => F(Date.now() / 1000), undefined, null, 'time.time'));
  m.set('perf_counter', new PyBuiltin('perf_counter', () => F(now() / 1000), undefined, null, 'time.perf_counter'));
  m.set('monotonic', new PyBuiltin('monotonic', () => F(now() / 1000), undefined, null, 'time.monotonic'));
  m.set('sleep', new PyBuiltin('sleep', (a) => {
    checkArgs('sleep', a, 1, 1, 'O');
    const s = mathArg(a[0]);
    if (s < 0) throw ValueErr('sleep length must be non-negative');
    charge(Math.min(1000, Math.ceil(s * 10)));
    return null;
  }, undefined, null, 'time.sleep'));
  return new PyModule('time', m);
}
function makeSys(vm) {
  const m = new Map();
  const stream = (name) => new PyModule(name, new Map([
    ['write', new PyBuiltin('write', (a) => { checkArgs('write', a, 1, 1); const s = strArg(a[0], `write() argument must be str, not ${tname(a[0])}`); CUR.write(s); return s.length; }, undefined, null, `${name}.write`)],
    ['flush', new PyBuiltin('flush', () => null, undefined, null, `${name}.flush`)],
  ]), false);
  m.set('argv', ['']);
  m.set('maxsize', normBig(9223372036854775807n));
  m.set('version', '3.13 (Night School)');
  m.set('platform', 'nightschool');
  m.set('stdout', stream('stdout'));
  m.set('stderr', stream('stderr'));
  m.set('exit', new PyBuiltin('exit', exitFn, undefined, null, 'sys.exit'));
  m.set('getrecursionlimit', new PyBuiltin('getrecursionlimit', () => vm.maxDepth, undefined, null, 'sys.getrecursionlimit'));
  m.set('setrecursionlimit', new PyBuiltin('setrecursionlimit', (a) => {
    checkArgs('setrecursionlimit', a, 1, 1);
    const n = Number(needInt(a[0]));
    if (n < 1) throw ValueErr('recursion limit must be greater or equal than 1');
    vm.maxDepth = Math.min(n, 1000);
    return null;
  }, undefined, null, 'sys.setrecursionlimit'));
  return new PyModule('sys', m);
}
const MODULE_MAKERS = { math: makeMath, random: makeRandom, string: makeString, time: makeTime, sys: makeSys };

// ===========================================================================
// 19. Tokenizer
// ===========================================================================

const KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
  'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
  'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']);
const OPS3 = new Set(['**=', '//=', '>>=', '<<=', '...']);
const OPS2 = new Set(['**', '//', '>>', '<<', '<=', '>=', '==', '!=', '->', ':=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '@=']);
const OPS1 = new Set('+-*/%@&|^~<>()[]{},:.;=!'.split(''));
const RE_NAME = /[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}]*/uy;
const RE_ID_START = /^[\p{L}\p{Nl}_]/u;
const RE_HEX = /0[xX](?:_?[0-9a-fA-F])+/y;
const RE_OCT = /0[oO](?:_?[0-7])+/y;
const RE_BIN = /0[bB](?:_?[01])+/y;
const RE_FLOATLIT = /(?:\d(?:_?\d)*\.(?:\d(?:_?\d)*)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?|\d(?:_?\d)*[eE][+-]?\d(?:_?\d)*/y;
const RE_INTLIT = /\d(?:_?\d)*/y;
const RE_AFTER_NUM = /[\p{L}\p{N}_]/u;

function synErr(type, msg, line, col) { // col is 1-based
  const e = exc(type, msg);
  e.line = line; e.col = col; e.isSyntax = true;
  return e;
}

function decodeEscape(s, p, onErr) { // s[p] === '\\' ; returns [text, consumed]
  const d = s[p + 1];
  switch (d) {
    case '\n': return ['', 2];
    case '\\': return ['\\', 2];
    case "'": return ["'", 2];
    case '"': return ['"', 2];
    case 'a': return ['\x07', 2];
    case 'b': return ['\b', 2];
    case 'f': return ['\f', 2];
    case 'n': return ['\n', 2];
    case 'r': return ['\r', 2];
    case 't': return ['\t', 2];
    case 'v': return ['\v', 2];
    case 'x': case 'u': case 'U': {
      const len = d === 'x' ? 2 : d === 'u' ? 4 : 8;
      const hex = s.slice(p + 2, p + 2 + len);
      if (hex.length < len || !/^[0-9a-fA-F]+$/.test(hex)) {
        onErr(`(unicode error) 'unicodeescape' codec can't decode bytes in position 0-${1 + hex.replace(/[^0-9a-fA-F].*$/, '').length}: truncated \\${d}${'X'.repeat(len)} escape`);
      }
      const cp = parseInt(hex, 16);
      if (cp > 0x10ffff) onErr(`(unicode error) 'unicodeescape' codec can't decode bytes in position 0-${len + 1}: illegal Unicode character`);
      return [String.fromCodePoint(cp), 2 + len];
    }
    case 'N': {
      const m = /^\{([^}]*)\}/.exec(s.slice(p + 2));
      const names = { SPACE: ' ', 'NO-BREAK SPACE': ' ', 'EM DASH': '—', 'EN DASH': '–', BULLET: '•', 'DEGREE SIGN': '°', SNOWFLAKE: '❄', 'COPYRIGHT SIGN': '©' };
      if (!m || !(m[1].toUpperCase() in names)) onErr("(unicode error) 'unicodeescape' codec can't decode bytes in position 0-1: unknown Unicode character name");
      return [names[m[1].toUpperCase()], 3 + m[1].length + 1];
    }
    default:
      if (d >= '0' && d <= '7') {
        let k = 1;
        while (k < 3 && s[p + 1 + k] >= '0' && s[p + 1 + k] <= '7') k++;
        return [String.fromCodePoint(parseInt(s.slice(p + 1, p + 1 + k), 8)), 1 + k];
      }
      return ['\\', 1]; // invalid escape: keep the backslash, next char is literal
  }
}

function decodeEscapes(body, onErr) {
  if (body.indexOf('\\') < 0) return body;
  let out = '';
  for (let i = 0; i < body.length;) {
    const c = body[i];
    if (c !== '\\') { out += c; i++; continue; }
    const [t, n] = decodeEscape(body, i, onErr);
    out += t;
    i += n;
  }
  return out;
}

class Tokenizer {
  constructor(src, opts = {}) {
    this.s = src;
    this.p = 0;
    this.line = opts.line || 1;
    this.ls = -(opts.col || 0); // offset of the current line's start; col = p - ls
    this.toks = [];
    this.ind = [0];
    this.alt = [0];
    this.br = [];
    this.expr = !!opts.expr;
    this.lastNl = null;
  }
  err(msg, line, col0, type = 'SyntaxError') { throw synErr(type, msg, line, col0 + 1); }
  tok(type, v, line, col, extra) {
    const t = { type, v, line, col, eline: this.line, ecol: this.p - this.ls };
    if (extra) Object.assign(t, extra);
    this.toks.push(t);
    return t;
  }
  run() {
    const s = this.s, n = s.length;
    let bol = !this.expr;
    for (;;) {
      if (bol) {
        bol = false;
        let col = 0, alt = 0, p = this.p;
        while (p < n) {
          const c = s.charCodeAt(p);
          if (c === 32) { col++; alt++; } else if (c === 9) { col = (Math.floor(col / 8) + 1) * 8; alt++; } else if (c === 12) { col = 0; alt = 0; } else break;
          p++;
        }
        this.p = p;
        if (p >= n) break;
        const c = s[p];
        if (c === '#' || c === '\n') {
          while (this.p < n && s[this.p] !== '\n') this.p++;
          if (this.p < n) { this.p++; this.line++; this.ls = this.p; bol = true; }
          continue;
        }
        this.indentTo(col, alt);
      }
      let c;
      while (this.p < n && ((c = s.charCodeAt(this.p)) === 32 || c === 9 || c === 12)) this.p++;
      if (this.p >= n) break;
      const ch = s[this.p];
      if (ch === '\n') {
        if (this.br.length || this.expr) { this.p++; this.line++; this.ls = this.p; continue; }
        this.lastNl = this.tok('nl', '', this.line, this.p - this.ls);
        this.p++; this.line++; this.ls = this.p;
        bol = true;
        continue;
      }
      if (ch === '#') { while (this.p < n && s[this.p] !== '\n') this.p++; continue; }
      if (ch === '\\') {
        if (s[this.p + 1] === '\n') { this.p += 2; this.line++; this.ls = this.p; continue; }
        if (this.p + 1 >= n) this.err('unexpected EOF while parsing', this.line, this.p - this.ls);
        this.err('unexpected character after line continuation character', this.line, this.p - this.ls + 1);
      }
      this.scanToken();
    }
    const endCol = this.p - this.ls;
    if (!this.expr) {
      const last = this.toks[this.toks.length - 1];
      if (last && last.type !== 'nl' && !this.br.length) this.lastNl = this.tok('nl', '', this.line, endCol);
      const endsNl = this.s.length > 0 && this.s[this.s.length - 1] === '\n';
      const at = (this.br.length || endsNl || !this.lastNl) ? { line: this.line, col: endCol } : this.lastNl;
      while (this.ind.length > 1) {
        this.ind.pop(); this.alt.pop();
        this.toks.push({ type: 'dedent', v: '', line: at.line, col: at.col, eline: at.line, ecol: at.col });
      }
      this.toks.push({ type: 'eof', v: '', line: at.line, col: at.col, eline: at.line, ecol: at.col });
    } else {
      this.toks.push({ type: 'eof', v: '', line: this.line, col: endCol, eline: this.line, ecol: endCol });
    }
    this.unclosed = this.br;
    return this.toks;
  }
  indentTo(col, alt) {
    const line = this.line, c0 = this.p - this.ls;
    const top = this.ind[this.ind.length - 1];
    const tabErr = () => this.err('inconsistent use of tabs and spaces in indentation', line, c0, 'TabError');
    if (col === top) {
      if (alt !== this.alt[this.alt.length - 1]) tabErr();
    } else if (col > top) {
      if (alt <= this.alt[this.alt.length - 1]) tabErr();
      this.ind.push(col); this.alt.push(alt);
      this.toks.push({ type: 'indent', v: '', line, col: c0, eline: line, ecol: c0 });
    } else {
      while (this.ind.length > 1 && col < this.ind[this.ind.length - 1]) {
        this.ind.pop(); this.alt.pop();
        this.toks.push({ type: 'dedent', v: '', line, col: c0, eline: line, ecol: c0 });
      }
      if (col !== this.ind[this.ind.length - 1]) this.err('unindent does not match any outer indentation level', line, c0, 'IndentationError');
      if (alt !== this.alt[this.alt.length - 1]) tabErr();
    }
  }
  scanToken() {
    const s = this.s, start = this.p, line = this.line, col = start - this.ls;
    const ch = s[start];
    const code = s.charCodeAt(start);
    if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90) || code === 95 ||
        (code > 127 && RE_ID_START.test(String.fromCodePoint(s.codePointAt(start))))) {
      RE_NAME.lastIndex = start;
      const word = RE_NAME.exec(s)[0];
      const nx = s[start + word.length];
      if ((nx === '"' || nx === "'") && word.length <= 2 && /^(?:[rRuUfFbB]|[rR][bBfF]|[bBfF][rR])$/.test(word)) {
        this.p = start + word.length;
        this.readString(word, line, col);
        return;
      }
      this.p = start + word.length;
      this.tok(KEYWORDS.has(word) ? 'kw' : 'name', word, line, col);
      return;
    }
    const c1 = s.charCodeAt(start + 1);
    if ((code >= 48 && code <= 57) || (ch === '.' && c1 >= 48 && c1 <= 57)) { this.readNumber(line, col); return; }
    if (ch === '"' || ch === "'") { this.readString('', line, col); return; }
    const c3 = s.substr(start, 3), c2 = s.substr(start, 2);
    const op = OPS3.has(c3) ? c3 : OPS2.has(c2) ? c2 : OPS1.has(ch) ? ch : null;
    if (op !== null) {
      if (op === '(' || op === '[' || op === '{') this.br.push({ ch: op, line, col });
      else if (op === ')' || op === ']' || op === '}') {
        if (!this.br.length) this.err(`unmatched '${op}'`, line, col);
        const o = this.br.pop();
        const want = op === ')' ? '(' : op === ']' ? '[' : '{';
        if (o.ch !== want) {
          this.err(o.line !== line
            ? `closing parenthesis '${op}' does not match opening parenthesis '${o.ch}' on line ${o.line}`
            : `closing parenthesis '${op}' does not match opening parenthesis '${o.ch}'`, line, col);
        }
      }
      this.p = start + op.length;
      this.tok('op', op, line, col);
      return;
    }
    const cp = s.codePointAt(start);
    const chr = String.fromCodePoint(cp);
    if (cp < 128) { this.p = start + 1; this.tok('op', chr, line, col); return; }
    const hex = cp.toString(16).toUpperCase().padStart(4, '0');
    if (!isPrintableChar(chr)) this.err(`invalid non-printable character U+${hex}`, line, col);
    this.err(`invalid character '${chr}' (U+${hex})`, line, col);
  }
  readNumber(line, col) {
    const s = this.s, start = this.p;
    let value, end;
    const c1 = s[start + 1];
    if (s[start] === '0' && c1 && 'xXoObB'.includes(c1)) {
      const k = c1.toLowerCase();
      const re = k === 'x' ? RE_HEX : k === 'o' ? RE_OCT : RE_BIN;
      const kind = k === 'x' ? 'hexadecimal' : k === 'o' ? 'octal' : 'binary';
      re.lastIndex = start;
      const m = re.exec(s);
      if (!m) {
        if (k === 'o' && /[89]/.test(s[start + 2] || '')) this.err(`invalid digit '${s[start + 2]}' in octal literal`, line, col + 2);
        if (k === 'b' && /[2-9]/.test(s[start + 2] || '')) this.err(`invalid digit '${s[start + 2]}' in binary literal`, line, col + 2);
        this.err(`invalid ${kind} literal`, line, col + 1);
      }
      end = start + m[0].length;
      if (end < s.length && RE_AFTER_NUM.test(s[end])) {
        if (k === 'o' && /[89]/.test(s[end])) this.err(`invalid digit '${s[end]}' in octal literal`, line, end - this.ls);
        if (k === 'b' && /[2-9]/.test(s[end])) this.err(`invalid digit '${s[end]}' in binary literal`, line, end - this.ls);
        this.err(`invalid ${kind} literal`, line, end - this.ls);
      }
      value = normBig(BigInt('0' + k + m[0].slice(2).replace(/_/g, '')));
    } else {
      RE_FLOATLIT.lastIndex = start;
      let m = RE_FLOATLIT.exec(s);
      let isFloat = !!m;
      if (!m) { RE_INTLIT.lastIndex = start; m = RE_INTLIT.exec(s); }
      const text = m[0];
      end = start + text.length;
      if (s[end] === 'j' || s[end] === 'J') {
        const e = exc('NotImplementedError', "complex numbers (like 2j) are not supported in Night School's Python");
        e.line = line; e.col = col + 1;
        throw e;
      }
      if (end < s.length && RE_AFTER_NUM.test(s[end])) {
        this.err('invalid decimal literal', line, s[end] === '_' ? end - this.ls : col);
      }
      if (!isFloat && text.length > 1 && text[0] === '0' && /[1-9]/.test(text)) {
        this.err('leading zeros in decimal integer literals are not permitted; use an 0o prefix for octal integers', line, col);
      }
      const clean = text.replace(/_/g, '');
      if (isFloat) value = F(parseFloat(clean));
      else value = clean.length <= 15 ? parseInt(clean, 10) : normBig(BigInt(clean));
    }
    this.p = end;
    this.tok('num', value, line, col);
  }
  readString(prefix, line, col) {
    const s = this.s, n = s.length;
    const low = prefix.toLowerCase();
    const raw = low.includes('r'), isF = low.includes('f'), isB = low.includes('b');
    const q = s[this.p];
    const triple = s[this.p + 1] === q && s[this.p + 2] === q;
    const qlen = triple ? 3 : 1;
    let p = this.p + qlen;
    if (isF) { this.readFString(raw, q, triple, p, line, col); return; }
    const bodyStart = p;
    for (;;) {
      if (p >= n) {
        this.err(triple ? `unterminated triple-quoted string literal (detected at line ${this.line})`
          : `unterminated string literal (detected at line ${this.line})`, line, col);
      }
      const c = s[p];
      if (c === '\\') {
        if (s[p + 1] === '\n') { this.line++; this.ls = p + 2; }
        p += 2;
        continue;
      }
      if (c === '\n') {
        if (!triple) this.err(`unterminated string literal (detected at line ${this.line})`, line, col);
        this.line++; this.ls = p + 1; p++;
        continue;
      }
      if (c === q && (!triple || (s[p + 1] === q && s[p + 2] === q))) break;
      p++;
    }
    const body = s.slice(bodyStart, p);
    this.p = p + qlen;
    if (isB) {
      const e = exc('NotImplementedError', "bytes literals (b'...') are not supported in Night School's Python");
      e.line = line; e.col = col + 1;
      throw e;
    }
    const value = raw ? body : decodeEscapes(body, (msg) => this.err(msg, line, col));
    this.tok('str', value, line, col);
  }
  readFString(raw, q, triple, p, line, col) {
    const s = this.s, n = s.length;
    const parts = [];
    let lit = '';
    const unterminated = () => this.err(triple ? `unterminated triple-quoted f-string literal (detected at line ${this.line})`
      : `unterminated f-string literal (detected at line ${this.line})`, line, col);
    for (;;) {
      if (p >= n) unterminated();
      const c = s[p];
      if (c === q && (!triple || (s[p + 1] === q && s[p + 2] === q))) break;
      if (c === '\n') {
        if (!triple) unterminated();
        this.line++; this.ls = p + 1; lit += c; p++;
        continue;
      }
      if (c === '\\') {
        const d = s[p + 1];
        if (raw || d === '{' || d === '}') {
          lit += '\\';
          p++;
          if (raw && d !== undefined && d !== '{' && d !== '}') {
            if (d === '\n') { this.line++; this.ls = p + 1; }
            lit += d;
            p++;
          }
          continue;
        }
        if (d === '\n') { this.line++; this.ls = p + 2; }
        const [t, k] = decodeEscape(s, p, (msg) => this.err(msg, line, col));
        lit += t;
        p += k;
        continue;
      }
      if (c === '{') {
        if (s[p + 1] === '{') { lit += '{'; p += 2; continue; }
        if (lit) { parts.push(lit); lit = ''; }
        const f = this.readFField(p + 1, q, triple, 0);
        parts.push(f.field);
        p = f.end;
        continue;
      }
      if (c === '}') {
        if (s[p + 1] === '}') { lit += '}'; p += 2; continue; }
        this.err("f-string: single '}' is not allowed", this.line, p - this.ls);
      }
      lit += c;
      p++;
    }
    if (lit) parts.push(lit);
    this.p = p + (triple ? 3 : 1);
    this.tok('str', null, line, col, { fparts: parts });
  }
  skipNestedString(p) {
    const s = this.s, n = s.length, c = s[p];
    const triple = s[p + 1] === c && s[p + 2] === c;
    p += triple ? 3 : 1;
    for (;;) {
      if (p >= n) return -1;
      const d = s[p];
      if (d === '\\') { p += 2; continue; }
      if (d === '\n') { if (!triple) return -1; this.line++; this.ls = p + 1; }
      if (d === c && (!triple || (s[p + 1] === c && s[p + 2] === c))) return p + (triple ? 3 : 1);
      p++;
    }
  }
  readFField(p, q, triple, nest) {
    const s = this.s, n = s.length;
    const exprStart = p, eLine = this.line, eCol = p - this.ls;
    const expecting = () => this.err("f-string: expecting '}'", this.line, Math.min(p, n) - this.ls);
    let depth = 0;
    for (;;) {
      if (p >= n) expecting();
      const c = s[p];
      if (c === "'" || c === '"') {
        if (c === q && !triple && depth === 0) expecting();
        const e = this.skipNestedString(p);
        if (e < 0) expecting();
        p = e;
        continue;
      }
      if (c === '\n') {
        if (!triple && depth === 0) expecting();
        this.line++; this.ls = p + 1; p++;
        continue;
      }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (c === '}') { if (depth <= 0) break; depth--; }
      else if (depth === 0) {
        if (c === '!' && s[p + 1] !== '=') break;
        if (c === ':') break;
        if (c === '=' && s[p + 1] !== '=' && !'=!<>'.includes(s[p - 1])) {
          let k = p + 1;
          while (s[k] === ' ') k++;
          if (s[k] === '}' || s[k] === '!' || s[k] === ':') break;
        }
      }
      p++;
    }
    const src = s.slice(exprStart, p);
    let debug = null, conv = null, spec = null;
    if (s[p] === '=') {
      let k = p + 1;
      while (s[k] === ' ') k++;
      debug = s.slice(exprStart, k);
      p = k;
    }
    if (!src.trim()) this.err(`f-string: valid expression required before '${s[p]}'`, this.line, p - this.ls);
    if (s[p] === '!') {
      conv = s[p + 1];
      if (conv === undefined || conv === '}' || conv === ':') this.err('f-string: missing conversion character', this.line, p + 1 - this.ls);
      if (!'rsa'.includes(conv)) this.err(`f-string: invalid conversion character '${conv}': expected 's', 'r', or 'a'`, this.line, p + 1 - this.ls);
      p += 2;
    }
    if (s[p] === ':') {
      p++;
      const specParts = [];
      let lit = '';
      for (;;) {
        if (p >= n) expecting();
        const c = s[p];
        if (c === '}') break;
        if (c === '{') {
          if (lit) { specParts.push(lit); lit = ''; }
          const f = this.readFField(p + 1, q, triple, nest + 1);
          specParts.push(f.field);
          p = f.end;
          continue;
        }
        if ((c === '\n' && !triple) || (c === q && !triple)) expecting();
        if (c === '\\' && !raw && s[p + 1] !== '{' && s[p + 1] !== '}') {
          const [t, k] = decodeEscape(s, p, (msg) => this.err(msg, this.line, p - this.ls));
          lit += t;
          p += k;
          continue;
        }
        lit += c;
        p++;
      }
      if (lit) specParts.push(lit);
      spec = specParts;
    }
    if (s[p] !== '}') expecting();
    return { field: { src, line: eLine, col: eCol, conv, spec, debug }, end: p + 1 };
  }
}

// ===========================================================================
// 20. Parser
// ===========================================================================

const BIN_PREC = { '|': 1, '^': 2, '&': 3, '<<': 4, '>>': 4, '+': 5, '-': 5, '*': 6, '/': 6, '//': 6, '%': 6, '@': 6 };
const BIN_OP = { '|': 'or', '^': 'xor', '&': 'and', '<<': 'lshift', '>>': 'rshift', '+': 'add', '-': 'sub', '*': 'mul', '/': 'truediv', '//': 'floordiv', '%': 'mod', '@': 'matmul' };
const AUG_OPS = { '+=': 'add', '-=': 'sub', '*=': 'mul', '/=': 'truediv', '//=': 'floordiv', '%=': 'mod', '**=': 'pow', '<<=': 'lshift', '>>=': 'rshift', '&=': 'and', '|=': 'or', '^=': 'xor', '@=': 'matmul' };
const CMP_OPS = new Set(['<', '>', '==', '>=', '<=', '!=']);
const SOFT_KW = new Set(['match', 'case', '_', 'type']);

function exprName(n) {
  switch (n.type) {
    case 'Attribute': return 'attribute';
    case 'Subscript': return 'subscript';
    case 'Starred': return 'starred';
    case 'Name': return 'name';
    case 'List': return 'list';
    case 'Tuple': return 'tuple';
    case 'Lambda': return 'lambda';
    case 'Call': return 'function call';
    case 'BoolOp': case 'BinOp': case 'UnaryOp': return 'expression';
    case 'GeneratorExp': return 'generator expression';
    case 'ListComp': return 'list comprehension';
    case 'SetComp': return 'set comprehension';
    case 'DictComp': return 'dict comprehension';
    case 'Dict': return 'dict literal';
    case 'Set': return 'set display';
    case 'JoinedStr': return 'f-string expression';
    case 'Const': return n.value === null ? 'None' : n.value === true ? 'True' : n.value === false ? 'False' : n.value === ELLIPSIS ? 'ellipsis' : 'literal';
    case 'Compare': return 'comparison';
    case 'IfExp': return 'conditional expression';
    case 'NamedExpr': return 'named expression';
  }
  return 'expression';
}

function invalidTarget(n, kind) {
  switch (n.type) {
    case 'List': case 'Tuple':
      for (const e of n.elts) { const b = invalidTarget(e, kind); if (b) return b; }
      return null;
    case 'Starred': return kind === 'del' ? n : invalidTarget(n.value, kind);
    case 'Compare':
      if (kind === 'for') return n.ops[0] === 'in' ? invalidTarget(n.left, kind) : null;
      return n;
    case 'Name': case 'Subscript': case 'Attribute': return null;
    default: return n;
  }
}

function isBitwiseOrNode(n) {
  switch (n.type) {
    case 'BoolOp': case 'Compare': case 'IfExp': case 'Lambda': case 'NamedExpr': case 'Starred':
    case 'List': case 'Tuple': case 'GeneratorExp': return false;
    case 'UnaryOp': return n.op !== 'not';
    case 'Const': return !(n.value === true || n.value === false || n.value === null);
    default: return true;
  }
}

class Parser {
  constructor(toks, unclosed, fmode = false) {
    this.t = toks;
    this.i = 0;
    this.unclosed = unclosed || [];
    this.fmode = fmode;
    this.far = 0;
  }
  get tok() { return this.t[this.i]; }
  peek(k = 1) { return this.t[Math.min(this.i + k, this.t.length - 1)]; }
  at(type) { return this.t[this.i].type === type; }
  atOp(v) { const t = this.t[this.i]; return t.type === 'op' && t.v === v; }
  atKw(v) { const t = this.t[this.i]; return t.type === 'kw' && t.v === v; }
  next() { return this.t[this.i++]; }
  eatOp(v) { if (this.atOp(v)) { this.i++; return true; } return false; }
  eatKw(v) { if (this.atKw(v)) { this.i++; return true; } return false; }
  mk(type, t, props) {
    const p = this.t[Math.max(0, this.i - 1)];
    const node = { type, line: t.line, col: t.col, eline: p.eline, ecol: p.ecol };
    return props ? Object.assign(node, props) : node;
  }
  errAt(at, msg, type = 'SyntaxError') {
    let e = synErr(type, this.fmode && type === 'SyntaxError' && !msg.startsWith('f-string') ? 'f-string: ' + msg : msg, at.line, at.col + 1);
    if (this.unclosed.length) {
      const b = this.unclosed[this.unclosed.length - 1];
      const farTok = this.t[Math.min(Math.max(this.i, this.far), this.t.length - 1)];
      if (this.tok.type === 'eof' || at.line > b.line || farTok.line > b.line) e = synErr('SyntaxError', `'${b.ch}' was never closed`, b.line, b.col + 1);
    }
    throw e;
  }
  fail(msg = 'invalid syntax', at = this.tok) { this.errAt(at, msg); }
  notSupported(at, what) {
    const e = exc('NotImplementedError', `${what} ${what.endsWith('s') ? 'are' : 'is'} not supported in Night School's Python`);
    e.line = at.line; e.col = at.col + 1;
    return e;
  }
  expectName() {
    const t = this.tok;
    if (t.type !== 'name') this.fail();
    this.i++;
    return t;
  }
  atStmtEnd() { const t = this.tok; return t.type === 'nl' || t.type === 'eof' || (t.type === 'op' && t.v === ';'); }
  canStartExpr() {
    const t = this.tok;
    if (t.type === 'name' || t.type === 'num' || t.type === 'str') return true;
    if (t.type === 'kw') return t.v === 'None' || t.v === 'True' || t.v === 'False' || t.v === 'not' || t.v === 'lambda' || t.v === 'await';
    if (t.type === 'op') return '([{-+~'.includes(t.v) || t.v === '...' || t.v === '*';
    return false;
  }
  tryParse(fn) {
    const save = this.i;
    try { fn(); this.far = Math.max(this.far, this.i + 1); return true; } catch (e) {
      if (!(e instanceof PyException)) throw e;
      this.far = Math.max(this.far, this.i);
      return false;
    } finally { this.i = save; }
  }

  // ---------------- statements ----------------
  parseFile() {
    const body = [];
    while (!this.at('eof')) {
      if (this.at('nl')) { this.i++; continue; }
      body.push(...this.parseStatement());
    }
    return body;
  }
  parseStatement() {
    const t = this.tok;
    if (t.type === 'indent') this.errAt(t, 'unexpected indent', 'IndentationError');
    if (t.type === 'dedent') this.fail();
    if (t.type === 'kw') {
      switch (t.v) {
        case 'if': return [this.parseIf()];
        case 'while': return [this.parseWhile()];
        case 'for': return [this.parseFor()];
        case 'def': return [this.parseDef()];
        case 'try': return [this.parseTry()];
        case 'class':
          if (this.peek().type !== 'name') this.fail('invalid syntax', this.peek());
          throw this.notSupported(t, 'classes');
        case 'with': throw this.notSupported(t, "'with' blocks");
        case 'async': throw this.notSupported(t, "'async' functions");
      }
    }
    if (t.type === 'op' && t.v === '@') throw this.notSupported(t, 'decorators');
    if (t.type === 'name' && t.v === 'match' && this.looksLikeMatch()) throw this.notSupported(t, "'match' statements");
    return this.parseSimpleStmts();
  }
  looksLikeMatch() {
    const nx = this.peek();
    if (nx.type === 'op' && !'([{-~*'.includes(nx.v)) return false;
    if (nx.type === 'nl' || nx.type === 'eof') return false;
    let j = this.i + 1;
    while (j < this.t.length && this.t[j].type !== 'nl' && this.t[j].type !== 'eof') j++;
    const last = this.t[j - 1];
    return last.type === 'op' && last.v === ':' && this.t[j + 1] && this.t[j + 1].type === 'indent';
  }
  parseSimpleStmts() {
    const out = [this.parseSimpleStmt()];
    while (this.atOp(';')) {
      this.i++;
      if (this.at('nl') || this.at('eof')) break;
      out.push(this.parseSimpleStmt());
    }
    if (this.at('nl')) this.i++;
    else if (!this.at('eof')) this.fail();
    return out;
  }
  colon(forced) {
    if (this.eatOp(':')) return;
    if (forced || this.at('nl')) this.fail("expected ':'");
    this.fail();
  }
  parseBlock(kw, what) {
    if (this.at('nl')) {
      this.i++;
      if (!this.at('indent')) this.errAt(this.tok, `expected an indented block after ${what} on line ${kw.line}`, 'IndentationError');
      this.i++;
      const body = [];
      while (!this.at('dedent') && !this.at('eof')) body.push(...this.parseStatement());
      if (this.at('dedent')) this.i++;
      return body;
    }
    if (this.at('eof')) this.errAt(this.tok, `expected an indented block after ${what} on line ${kw.line}`, 'IndentationError');
    return this.parseSimpleStmts();
  }
  parseIf() {
    const kw = this.next();
    const test = this.parseNamedExpr();
    this.colon(false);
    const body = this.parseBlock(kw, `'${kw.v}' statement`);
    let orelse = [];
    if (this.atKw('elif')) orelse = [this.parseIf()];
    else if (this.atKw('else')) {
      const ek = this.next();
      this.colon(true);
      orelse = this.parseBlock(ek, "'else' statement");
    }
    return { type: 'If', test, body, orelse, line: kw.line, col: kw.col, eline: kw.eline, ecol: kw.ecol };
  }
  parseWhile() {
    const kw = this.next();
    const test = this.parseNamedExpr();
    this.colon(false);
    const body = this.parseBlock(kw, "'while' statement");
    let orelse = [];
    if (this.atKw('else')) { const ek = this.next(); this.colon(true); orelse = this.parseBlock(ek, "'else' statement"); }
    return { type: 'While', test, body, orelse, line: kw.line, col: kw.col, eline: kw.eline, ecol: kw.ecol };
  }
  parseTargetElem() {
    if (this.atOp('*')) { const st = this.next(); const v = this.parsePrimary(); return this.mk('Starred', st, { value: v }); }
    return this.parsePrimary();
  }
  parseTargetList(stopKw) {
    const t = this.tok;
    const elts = [this.parseTargetElem()];
    let comma = false;
    while (this.atOp(',')) {
      this.i++;
      comma = true;
      if (this.atKw(stopKw)) break;
      elts.push(this.parseTargetElem());
    }
    if (elts.length === 1 && !comma) return elts[0];
    return this.mk('Tuple', t, { elts });
  }
  forTargetError(startIdx) {
    const errTok = this.tok;
    this.i = startIdx;
    let e = null;
    try { e = this.parseStarExprs(); } catch (err) { if (!(err instanceof PyException)) throw err; e = null; }
    if (e) {
      const bad = invalidTarget(e, 'for');
      if (bad) this.errAt(bad, `cannot assign to ${exprName(bad)}`);
    }
    this.fail('invalid syntax', errTok);
  }
  checkTarget(n, kind, hereHint = false) {
    const bad = invalidTarget(n, kind);
    if (!bad) return;
    const name = exprName(bad);
    if (kind === 'del') this.errAt(bad, `cannot delete ${name}`);
    if (hereHint && bad === n && isBitwiseOrNode(n)) this.errAt(n, `cannot assign to ${name} here. Maybe you meant '==' instead of '='?`);
    this.errAt(bad, `cannot assign to ${name}`);
  }
  parseFor() {
    const kw = this.next();
    const start = this.i;
    const target = this.parseTargetList('in');
    if (!this.atKw('in')) this.forTargetError(start);
    this.checkTarget(target, 'for');
    this.i++;
    const iter = this.parseStarExprs();
    this.colon(false);
    const body = this.parseBlock(kw, "'for' statement");
    let orelse = [];
    if (this.atKw('else')) { const ek = this.next(); this.colon(true); orelse = this.parseBlock(ek, "'else' statement"); }
    return { type: 'For', target, iter, body, orelse, line: kw.line, col: kw.col, eline: kw.eline, ecol: kw.ecol };
  }
  parseParams(closer, lambda) {
    const P = { params: [], vararg: null, kwonly: [], kwarg: null, toks: [] };
    let seenDefault = false, star = false;
    while (!this.atOp(closer)) {
      if (this.atOp('/')) { this.i++; }
      else if (this.atOp('**')) {
        this.i++;
        const n = this.expectName();
        if (!lambda && this.eatOp(':')) this.parseExpr();
        P.kwarg = n.v;
        P.toks.push(n);
      } else if (this.atOp('*')) {
        this.i++;
        star = true;
        if (this.at('name')) {
          const n = this.next();
          if (!lambda && this.eatOp(':')) this.parseExpr();
          P.vararg = n.v;
          P.toks.push(n);
        }
      } else {
        const n = this.expectName();
        if (!lambda && this.eatOp(':')) this.parseExpr();
        let def = null;
        if (this.eatOp('=')) def = this.parseExpr();
        if (star) P.kwonly.push({ name: n.v, default: def });
        else {
          if (def) seenDefault = true;
          else if (seenDefault) this.errAt(n, 'parameter without a default follows parameter with a default');
          P.params.push({ name: n.v, default: def });
        }
        P.toks.push(n);
      }
      if (!this.eatOp(',')) break;
    }
    return P;
  }
  parseDef() {
    const kw = this.next();
    const nameTok = this.tok;
    if (nameTok.type !== 'name') this.fail();
    this.i++;
    if (!this.atOp('(')) this.fail("expected '('");
    this.i++;
    const args = this.parseParams(')', false);
    if (!this.eatOp(')')) this.fail();
    if (this.eatOp('->')) this.parseExpr();
    this.colon(true);
    const body = this.parseBlock(kw, 'function definition');
    return { type: 'FunctionDef', name: nameTok.v, args, body, line: kw.line, col: kw.col, eline: nameTok.eline, ecol: nameTok.ecol };
  }
  parseTry() {
    const kw = this.next();
    this.colon(true);
    const body = this.parseBlock(kw, "'try' statement");
    const handlers = [];
    while (this.atKw('except')) {
      const ek = this.next();
      if (this.atOp('*')) throw this.notSupported(ek, "'except*' blocks");
      let typ = null, name = null;
      if (!this.atOp(':')) {
        if (this.at('nl')) this.fail("expected ':'");
        typ = this.parseExpr();
        if (this.atOp(',')) this.errAt(typ, 'multiple exception types must be parenthesized');
        if (this.eatKw('as')) name = this.expectName().v;
      }
      this.colon(false);
      const hbody = this.parseBlock(ek, "'except' statement");
      handlers.push({ type: typ, name, body: hbody, line: ek.line, col: ek.col });
    }
    let orelse = [], finalbody = null;
    if (this.atKw('else') && handlers.length) { const ek = this.next(); this.colon(true); orelse = this.parseBlock(ek, "'else' statement"); }
    if (this.atKw('finally')) { const fk = this.next(); this.colon(true); finalbody = this.parseBlock(fk, "'finally' statement"); }
    if (!handlers.length && !finalbody) this.fail("expected 'except' or 'finally' block");
    return { type: 'Try', body, handlers, orelse, finalbody, line: kw.line, col: kw.col, eline: kw.eline, ecol: kw.ecol };
  }
  parseDottedName() {
    let name = this.expectName().v;
    while (this.atOp('.')) { this.i++; name += '.' + this.expectName().v; }
    return name;
  }
  parseSimpleStmt() {
    const t = this.tok;
    if (t.type === 'kw') {
      switch (t.v) {
        case 'pass': this.i++; return this.mk('Pass', t);
        case 'break': this.i++; return this.mk('Break', t);
        case 'continue': this.i++; return this.mk('Continue', t);
        case 'return': {
          this.i++;
          const value = this.atStmtEnd() ? null : this.parseStarExprs();
          return this.mk('Return', t, { value });
        }
        case 'global': case 'nonlocal': {
          this.i++;
          const names = [this.expectName().v];
          while (this.eatOp(',')) names.push(this.expectName().v);
          return this.mk(t.v === 'global' ? 'Global' : 'Nonlocal', t, { names });
        }
        case 'del': {
          this.i++;
          const target = this.parseStarExprs();
          const targets = target.type === 'Tuple' && !target.paren ? target.elts : [target];
          for (const x of targets) this.checkTarget(x, 'del');
          return this.mk('Del', t, { targets });
        }
        case 'assert': {
          this.i++;
          const test = this.parseExpr();
          const msg = this.eatOp(',') ? this.parseExpr() : null;
          return this.mk('Assert', t, { test, msg });
        }
        case 'raise': {
          this.i++;
          let ex = null, cause = null;
          if (!this.atStmtEnd()) {
            ex = this.parseExpr();
            if (this.eatKw('from')) cause = this.parseExpr();
          }
          return this.mk('Raise', t, { exc: ex, cause });
        }
        case 'import': {
          this.i++;
          if (this.atStmtEnd()) this.fail("Expected one or more names after 'import'");
          const names = [];
          do {
            const name = this.parseDottedName();
            let asname = null;
            if (this.eatKw('as')) asname = this.expectName().v;
            names.push({ name, asname });
          } while (this.eatOp(','));
          return this.mk('Import', t, { names });
        }
        case 'from': {
          this.i++;
          while (this.atOp('.') || this.atOp('...')) this.i++;
          const module = this.parseDottedName();
          if (!this.eatKw('import')) this.fail();
          const names = [];
          if (this.eatOp('*')) names.push({ name: '*', asname: null });
          else {
            const paren = this.eatOp('(');
            do {
              if (paren && this.atOp(')')) break;
              const name = this.expectName().v;
              let asname = null;
              if (this.eatKw('as')) asname = this.expectName().v;
              names.push({ name, asname });
            } while (this.eatOp(','));
            if (paren && !this.eatOp(')')) this.fail();
          }
          return this.mk('ImportFrom', t, { module, names });
        }
        case 'yield': throw this.notSupported(t, "'yield' (generator functions)");
      }
    }
    const first = this.parseStarExprs();
    if (this.atOp('=')) {
      const targets = [first];
      while (this.eatOp('=')) {
        if (this.atKw('yield')) throw this.notSupported(this.tok, "'yield' (generator functions)");
        targets.push(this.parseStarExprs());
      }
      const value = targets.pop();
      if (value.type === 'Starred') this.errAt(value, "can't use starred expression here");
      targets.forEach((tg, idx) => this.checkTarget(tg, 'assign', targets.length === 1 && idx === 0));
      return this.mk('Assign', t, { targets, value });
    }
    const tk = this.tok;
    if (tk.type === 'op' && AUG_OPS[tk.v]) {
      if (first.type !== 'Name' && first.type !== 'Attribute' && first.type !== 'Subscript') {
        this.errAt(first, `'${exprName(first)}' is an illegal expression for augmented assignment`);
      }
      this.i++;
      if (this.atKw('yield')) throw this.notSupported(this.tok, "'yield' (generator functions)");
      const value = this.parseStarExprs();
      return this.mk('AugAssign', t, { target: first, op: AUG_OPS[tk.v], value });
    }
    if (this.atOp(':')) {
      if (first.type === 'Tuple') this.errAt(first, 'only single target (not tuple) can be annotated');
      if (first.type === 'List') this.errAt(first, 'only single target (not list) can be annotated');
      if (first.type !== 'Name' && first.type !== 'Attribute' && first.type !== 'Subscript') this.errAt(first, 'illegal target for annotation');
      this.i++;
      this.parseExpr();
      let value = null;
      if (this.eatOp('=')) value = this.parseStarExprs();
      return this.mk('AnnAssign', t, { target: first, value });
    }
    if (!this.atStmtEnd() && first.type === 'Name' && (first.id === 'print' || first.id === 'exec') && !this.atOp('(')) {
      if (this.tryParse(() => this.parseStarExprs())) {
        this.errAt(first, `Missing parentheses in call to '${first.id}'. Did you mean ${first.id}(...)?`);
      }
    }
    if (first.type === 'Starred') this.errAt(first, "can't use starred expression here");
    return this.mk('Expr', t, { value: first });
  }

  // ---------------- expressions ----------------
  parseStarExprs() {
    const t = this.tok;
    const first = this.parseStarExpr();
    if (!this.atOp(',')) return first;
    const elts = [first];
    while (this.eatOp(',')) {
      if (!this.canStartExpr()) break;
      elts.push(this.parseStarExpr());
    }
    return this.mk('Tuple', t, { elts });
  }
  parseStarExpr() {
    if (this.atOp('*')) { const st = this.next(); const v = this.parseBitOr(); return this.mk('Starred', st, { value: v }); }
    return this.parseExpr();
  }
  parseExpr() {
    if (this.atKw('lambda')) return this.parseLambda();
    const t = this.tok;
    const body = this.parseDisjunction();
    if (this.atKw('if')) {
      this.i++;
      const test = this.parseDisjunction();
      if (!this.eatKw('else')) {
        if (this.atOp(':')) this.fail();
        this.errAt(body, "expected 'else' after 'if' expression");
      }
      const orelse = this.parseExpr();
      return this.mk('IfExp', t, { test, body, orelse });
    }
    return body;
  }
  parseNamedExpr() {
    const t = this.tok;
    if (t.type === 'name' && this.peek().type === 'op' && this.peek().v === ':=') {
      this.i += 2;
      const value = this.parseExpr();
      return this.mk('NamedExpr', t, { target: this.mkName(t), value });
    }
    const e = this.parseExpr();
    if (this.atOp(':=')) this.errAt(e, `cannot use assignment expressions with ${exprName(e)}`);
    if (this.atOp('=')) {
      const followOk = () => {
        const save = this.i;
        this.i++;
        try { this.parseBitOr(); return !this.atOp('=') && !this.atOp(':='); } catch (err) { if (!(err instanceof PyException)) throw err; return false; } finally { this.i = save; }
      };
      if (e.type === 'Name' && !e.paren) {
        if (followOk()) this.errAt(e, "invalid syntax. Maybe you meant '==' or ':=' instead of '='?");
      } else if (isBitwiseOrNode(e) && !e.paren) {
        if (followOk()) this.errAt(e, `cannot assign to ${exprName(e)} here. Maybe you meant '==' instead of '='?`);
      }
    }
    return e;
  }
  mkName(t) { return { type: 'Name', id: t.v, line: t.line, col: t.col, eline: t.eline, ecol: t.ecol }; }
  parseDisjunction() {
    const t = this.tok;
    const e = this.parseConjunction();
    if (!this.atKw('or')) return e;
    const values = [e];
    while (this.eatKw('or')) values.push(this.parseConjunction());
    return this.mk('BoolOp', t, { op: 'or', values });
  }
  parseConjunction() {
    const t = this.tok;
    const e = this.parseInversion();
    if (!this.atKw('and')) return e;
    const values = [e];
    while (this.eatKw('and')) values.push(this.parseInversion());
    return this.mk('BoolOp', t, { op: 'and', values });
  }
  parseInversion() {
    if (this.atKw('not')) {
      const t = this.next();
      const operand = this.parseInversion();
      return this.mk('UnaryOp', t, { op: 'not', operand });
    }
    return this.parseComparison();
  }
  parseComparison() {
    const t = this.tok;
    const left = this.parseBitOr();
    const ops = [], comparators = [];
    for (;;) {
      const tk = this.tok;
      let op = null;
      if (tk.type === 'op' && CMP_OPS.has(tk.v)) { op = tk.v; this.i++; }
      else if (tk.type === 'kw') {
        if (tk.v === 'in') { op = 'in'; this.i++; }
        else if (tk.v === 'not' && this.peek().type === 'kw' && this.peek().v === 'in') { op = 'not in'; this.i += 2; }
        else if (tk.v === 'is') { this.i++; op = this.eatKw('not') ? 'is not' : 'is'; }
      }
      if (!op) break;
      ops.push(op);
      comparators.push(this.parseBitOr());
    }
    if (!ops.length) return left;
    return this.mk('Compare', t, { left, ops, comparators });
  }
  parseBitOr() { return this.parseBin(1); }
  parseBin(minPrec) {
    const t = this.tok;
    let left = this.parseFactor();
    for (;;) {
      const tk = this.tok;
      if (tk.type !== 'op') break;
      const prec = BIN_PREC[tk.v];
      if (prec === undefined || prec < minPrec) break;
      this.i++;
      const right = this.parseBin(prec + 1);
      left = this.mk('BinOp', t, { op: BIN_OP[tk.v], left, right, opLine: tk.line, opCol: tk.col });
    }
    return left;
  }
  parseFactor() {
    const t = this.tok;
    if (t.type === 'op' && (t.v === '-' || t.v === '+' || t.v === '~')) {
      this.i++;
      const operand = this.parseFactor();
      if (t.v === '-' && operand.type === 'Const' && (typeof operand.value === 'number' || typeof operand.value === 'bigint' || operand.value instanceof PyFloat) && !operand.paren) {
        const v = operand.value;
        return this.mk('Const', t, { value: v instanceof PyFloat ? F(-v.v) : iNeg(v) });
      }
      return this.mk('UnaryOp', t, { op: t.v === '-' ? 'neg' : t.v === '+' ? 'pos' : 'invert', operand });
    }
    return this.parsePower();
  }
  parsePower() {
    const t = this.tok;
    if (t.type === 'kw' && t.v === 'await') throw this.notSupported(t, "'await'");
    const base = this.parsePrimary();
    if (this.atOp('**')) {
      this.i++;
      const exp = this.parseFactor();
      return this.mk('BinOp', t, { op: 'pow', left: base, right: exp });
    }
    return base;
  }
  parsePrimary() {
    const t = this.tok;
    let e = this.parseAtom();
    for (;;) {
      if (this.atOp('.')) {
        this.i++;
        const n = this.tok;
        if (n.type !== 'name') this.fail();
        this.i++;
        e = this.mk('Attribute', t, { value: e, attr: n.v, attrLine: n.line, attrCol: n.col });
      } else if (this.atOp('(')) {
        this.i++;
        const { args, keywords } = this.parseCallArgs();
        this.closeBracket(')');
        e = this.mk('Call', t, { func: e, args, keywords });
      } else if (this.atOp('[')) {
        this.i++;
        const slice = this.parseSlices();
        this.closeBracket(']');
        e = this.mk('Subscript', t, { value: e, slice });
      } else break;
    }
    return e;
  }
  closeBracket(ch) { if (!this.eatOp(ch)) this.fail(); }
  commaHint(elem, startIdx, closer) {
    if (this.atOp(',') || this.atOp(closer)) return;
    const st = this.t[startIdx];
    const second = this.t[startIdx + 1];
    const excluded = (st.type === 'name' && second && second.type === 'str') || (st.type === 'name' && SOFT_KW.has(st.v));
    if (!excluded && elem.type !== 'IfExp' && elem.type !== 'Lambda' && elem.type !== 'Starred' && this.canStartExpr() && !this.atOp('*')) {
      if (this.tryParse(() => this.parseExpr())) this.errAt(st, 'invalid syntax. Perhaps you forgot a comma?');
    }
    this.fail();
  }
  parseCallArgs() {
    const args = [], keywords = [];
    let sawKw = false, sawDstar = false;
    while (!this.atOp(')')) {
      const startIdx = this.i;
      const t = this.tok;
      if (this.atOp('*')) {
        this.i++;
        const v = this.parseExpr();
        if (sawDstar) this.errAt(t, 'iterable argument unpacking follows keyword argument unpacking');
        args.push(this.mk('Starred', t, { value: v }));
        this.commaHint(v, startIdx + 1, ')');
      } else if (this.atOp('**')) {
        this.i++;
        const v = this.parseExpr();
        keywords.push({ arg: null, value: v, line: t.line, col: t.col });
        sawDstar = true;
        this.commaHint(v, startIdx + 1, ')');
      } else if (t.type === 'name' && this.peek().type === 'op' && this.peek().v === '=') {
        this.i += 2;
        const vIdx = this.i;
        const v = this.parseExpr();
        if (keywords.some((k) => k.arg === t.v)) this.errAt(t, `keyword argument repeated: ${t.v}`);
        keywords.push({ arg: t.v, value: v, line: t.line, col: t.col });
        sawKw = true;
        this.commaHint(v, vIdx, ')');
      } else {
        let e;
        if (t.type === 'name' && this.peek().type === 'op' && this.peek().v === ':=') {
          this.i += 2;
          const value = this.parseExpr();
          e = this.mk('NamedExpr', t, { target: this.mkName(t), value });
        } else e = this.parseExpr();
        if (this.atOp('=')) this.errAt(e, 'expression cannot contain assignment, perhaps you meant "=="?');
        if (this.atKw('for')) {
          const g = this.parseComp(e, null, 'GeneratorExp', t);
          if (args.length || keywords.length || (this.atOp(',') && this.peek().type !== 'op')) this.errAt(g, 'Generator expression must be parenthesized');
          args.push(g);
        } else {
          if (sawDstar) this.errAt(e, 'positional argument follows keyword argument unpacking');
          if (sawKw) this.errAt(e, 'positional argument follows keyword argument');
          args.push(e);
          this.commaHint(e, startIdx, ')');
        }
      }
      if (!this.eatOp(',')) break;
    }
    return { args, keywords };
  }
  parseSlices() {
    const t = this.tok;
    const first = this.parseSliceItem();
    if (!this.atOp(',')) return first;
    const elts = [first];
    while (this.eatOp(',')) {
      if (this.atOp(']')) break;
      elts.push(this.parseSliceItem());
    }
    return this.mk('Tuple', t, { elts });
  }
  parseSliceItem() {
    const t = this.tok;
    let lower = null;
    if (!this.atOp(':')) {
      if (this.atOp('*')) { const st = this.next(); const v = this.parseBitOr(); return this.mk('Starred', st, { value: v }); }
      lower = this.parseNamedExpr();
      if (!this.atOp(':')) return lower;
    }
    this.i++;
    let upper = null, step = null;
    if (!this.atOp(':') && !this.atOp(']') && !this.atOp(',')) upper = this.parseExpr();
    if (this.eatOp(':')) { if (!this.atOp(']') && !this.atOp(',')) step = this.parseExpr(); }
    return this.mk('Slice', t, { lower, upper, step });
  }
  parseStarredItem() {
    const st = this.next();
    const v = this.parseBitOr();
    return this.mk('Starred', st, { value: v });
  }
  parseAtom() {
    const t = this.tok;
    switch (t.type) {
      case 'name': this.i++; return this.mkName(t);
      case 'num': this.i++; return this.mk('Const', t, { value: t.v });
      case 'str': return this.parseStrings();
      case 'kw':
        if (t.v === 'None') { this.i++; return this.mk('Const', t, { value: null }); }
        if (t.v === 'True') { this.i++; return this.mk('Const', t, { value: true }); }
        if (t.v === 'False') { this.i++; return this.mk('Const', t, { value: false }); }
        if (t.v === 'yield') throw this.notSupported(t, "'yield' (generator functions)");
        if (t.v === 'lambda') return this.parseLambda();
        break;
      case 'op':
        if (t.v === '(') return this.parseParen();
        if (t.v === '[') return this.parseList();
        if (t.v === '{') return this.parseBrace();
        if (t.v === '...') { this.i++; return this.mk('Const', t, { value: ELLIPSIS }); }
        break;
    }
    this.fail();
  }
  parseParen() {
    const lp = this.next();
    if (this.atOp(')')) { this.i++; return this.mk('Tuple', lp, { elts: [], paren: true }); }
    if (this.atKw('yield')) throw this.notSupported(this.tok, "'yield' (generator functions)");
    const si = this.i;
    const first = this.atOp('*') ? this.parseStarredItem() : this.parseNamedExpr();
    if (this.atKw('for')) { const g = this.parseComp(first, null, 'GeneratorExp', lp); this.closeBracket(')'); g.paren = true; return g; }
    if (this.atOp(')')) {
      this.i++;
      if (first.type === 'Starred') this.errAt(first, 'cannot use starred expression here');
      first.paren = true;
      return first;
    }
    const elts = [first];
    this.commaHint(first, si, ')');
    while (this.eatOp(',')) {
      if (this.atOp(')')) break;
      const s2 = this.i;
      const e = this.atOp('*') ? this.parseStarredItem() : this.parseNamedExpr();
      elts.push(e);
      this.commaHint(e, s2, ')');
    }
    this.closeBracket(')');
    return this.mk('Tuple', lp, { elts, paren: true });
  }
  parseList() {
    const lb = this.next();
    if (this.atOp(']')) { this.i++; return this.mk('List', lb, { elts: [] }); }
    const si = this.i;
    const first = this.atOp('*') ? this.parseStarredItem() : this.parseNamedExpr();
    if (this.atKw('for')) { const c = this.parseComp(first, null, 'ListComp', lb); this.closeBracket(']'); return c; }
    const elts = [first];
    this.commaHint(first, si, ']');
    while (this.eatOp(',')) {
      if (this.atOp(']')) break;
      const s2 = this.i;
      const e = this.atOp('*') ? this.parseStarredItem() : this.parseNamedExpr();
      elts.push(e);
      this.commaHint(e, s2, ']');
    }
    this.closeBracket(']');
    return this.mk('List', lb, { elts });
  }
  parseBrace() {
    const lb = this.next();
    if (this.atOp('}')) { this.i++; return this.mk('Dict', lb, { keys: [], values: [] }); }
    const si = this.i;
    const keys = [], values = [];
    const dictItem = () => {
      if (this.atOp('**')) { this.i++; keys.push(null); values.push(this.parseBitOr()); return null; }
      const s2 = this.i;
      const k = this.parseExpr();
      if (!this.atOp(':')) {
        if (this.atOp(',') || this.atOp('}')) this.errAt(k, "':' expected after dictionary key");
        this.commaHint(k, s2, '}');
      }
      this.i++;
      const vIdx = this.i;
      const v = this.parseExpr();
      keys.push(k);
      values.push(v);
      return { v, vIdx };
    };
    if (this.atOp('**')) {
      dictItem();
    } else {
      const first = this.atOp('*') ? this.parseStarredItem() : this.parseNamedExpr();
      if (this.atOp(':') && first.type !== 'Starred') {
        this.i++;
        const vIdx = this.i;
        const v = this.parseExpr();
        if (this.atKw('for')) { const c = this.parseComp(first, v, 'DictComp', lb); this.closeBracket('}'); return c; }
        keys.push(first);
        values.push(v);
        this.commaHint(v, vIdx, '}');
      } else {
        // set
        if (this.atKw('for')) { const c = this.parseComp(first, null, 'SetComp', lb); this.closeBracket('}'); return c; }
        const elts = [first];
        this.commaHint(first, si, '}');
        while (this.eatOp(',')) {
          if (this.atOp('}')) break;
          const s2 = this.i;
          const e = this.atOp('*') ? this.parseStarredItem() : this.parseNamedExpr();
          elts.push(e);
          this.commaHint(e, s2, '}');
        }
        this.closeBracket('}');
        return this.mk('Set', lb, { elts });
      }
    }
    while (this.eatOp(',')) {
      if (this.atOp('}')) break;
      const r = dictItem();
      if (r) this.commaHint(r.v, r.vIdx, '}');
    }
    this.closeBracket('}');
    return this.mk('Dict', lb, { keys, values });
  }
  parseComp(elt, value, kind, startTok) {
    const gens = [];
    while (this.atKw('for')) {
      const ft = this.next();
      const start = this.i;
      const target = this.parseTargetList('in');
      if (!this.atKw('in')) this.forTargetError(start);
      this.checkTarget(target, 'for');
      this.i++;
      const iter = this.parseDisjunction();
      const ifs = [];
      while (this.atKw('if')) { this.i++; ifs.push(this.parseDisjunction()); }
      gens.push({ target, iter, ifs, line: ft.line, col: ft.col });
    }
    return this.mk(kind, startTok, { elt, value, gens });
  }
  parseLambda() {
    const t = this.next();
    const args = this.parseParams(':', true);
    if (!this.eatOp(':')) this.fail();
    const body = this.parseExpr();
    return this.mk('Lambda', t, { args, body });
  }
  parseStrings() {
    const t = this.tok;
    const toks = [];
    while (this.at('str')) toks.push(this.next());
    if (toks.every((x) => !x.fparts)) {
      const v = toks.length === 1 ? toks[0].v : toks.map((x) => x.v).join('');
      return this.mk('Const', t, { value: v });
    }
    const parts = [];
    const pushLit = (s) => { if (!s) return; if (typeof parts[parts.length - 1] === 'string') parts[parts.length - 1] += s; else parts.push(s); };
    for (const x of toks) {
      if (!x.fparts) { pushLit(x.v); continue; }
      for (const p of x.fparts) {
        if (typeof p === 'string') pushLit(p);
        else for (const q of this.fieldNodes(p)) { if (typeof q === 'string') pushLit(q); else parts.push(q); }
      }
    }
    return this.mk('JoinedStr', t, { parts });
  }
  fieldNodes(f) {
    const out = [];
    if (f.debug) out.push(f.debug);
    const value = this.parseFExpr(f);
    let spec = null;
    if (f.spec) {
      const sp = [];
      for (const p of f.spec) {
        if (typeof p === 'string') sp.push(p);
        else sp.push(...this.fieldNodes(p));
      }
      spec = { type: 'JoinedStr', parts: sp, line: f.line, col: f.col };
    }
    const conv = f.conv || (f.debug && !f.spec ? 'r' : null);
    out.push({ type: 'FormattedValue', value, conv, spec, line: f.line, col: f.col, eline: value.eline, ecol: value.ecol });
    return out;
  }
  parseFExpr(f) {
    const tz = new Tokenizer(f.src, { line: f.line, col: f.col, expr: true });
    let toks;
    try { toks = tz.run(); } catch (e) {
      if (e instanceof PyException && e.isSyntax && !String(e.args[0]).startsWith('f-string')) e.args = ['f-string: ' + e.args[0]];
      throw e;
    }
    const p = new Parser(toks, [], true);
    const node = p.parseStarExprs();
    if (!p.at('eof')) {
      if (p.atOp('=') || p.atOp(':=')) p.fail();
      p.commaHint(node, 0, '\u0000');
    }
    return node;
  }
}

function parseSource(src) {
  const tz = new Tokenizer(src);
  const toks = tz.run();
  const p = new Parser(toks, tz.unclosed);
  return p.parseFile();
}

// ===========================================================================
// 21. Compiler: AST -> JS closures
// ===========================================================================

const GLOBAL = { kind: 'global' };

class Scope {
  constructor(kind, parent, name, qualname) {
    this.kind = kind; // 'module' | 'function' | 'comp'
    this.parent = parent;
    this.name = name;
    this.qualname = qualname;
    this.slots = new Map();
    this.globalNames = new Set();
    this.nonlocalNames = new Set();
    this.loop = 0;
  }
  slot(name) {
    let i = this.slots.get(name);
    if (i === undefined) { i = this.slots.size; this.slots.set(name, i); }
    return i;
  }
}

function nodeErr(type, msg, node) { return synErr(type, msg, node.line, node.col + 1); }

function setLoc(e, node, where) {
  e.line = node.line;
  e.col = node.col + 1;
  e.eline = node.eline;
  e.ecol = node.ecol === undefined ? undefined : node.ecol + 1;
  e.where = where || null;
}
function jsToPyExc(e) {
  if (e instanceof PyException) return e;
  if (e instanceof RangeError) {
    const m = String(e.message);
    if (/call stack/i.test(m)) return exc('RecursionError', 'maximum recursion depth exceeded');
    if (/invalid (string|array|typed array) length|allocation failed|out of memory/i.test(m)) return MemoryErr();
  }
  const pe = exc('SystemError', `internal interpreter error: ${e && e.message ? e.message : String(e)}`);
  pe.jsError = e;
  return pe;
}
function locate(e, node, where) {
  if (e instanceof PyException) {
    if (e.line === undefined) setLoc(e, node, where);
    return e;
  }
  const pe = jsToPyExc(e);
  if (pe.line === undefined) setLoc(pe, node, where);
  return pe;
}
function callErr(x, node, where) {
  if (x instanceof PyException) {
    if (x.line === undefined) setLoc(x, node, where);
    else if (!x.isSyntax) (x.trace ||= []).push({ line: node.line, where });
    return x;
  }
  return locate(x, node, where);
}
function nameErr(name, node, where, frame, scope) {
  const e = exc('NameError', `name '${name}' is not defined`);
  setLoc(e, node, where);
  e.nameCtx = { name, frame, scope };
  return e;
}
function unboundErr(name, node, where) {
  const e = exc('UnboundLocalError', `cannot access local variable '${name}' where it is not associated with a value`);
  setLoc(e, node, where);
  return e;
}
function freeErr(name, node, where) {
  const e = exc('NameError', `cannot access free variable '${name}' where it is not associated with a value in enclosing scope`);
  setLoc(e, node, where);
  return e;
}

function walkExpr(e, fn) {
  if (!e || typeof e !== 'object') return;
  fn(e);
  switch (e.type) {
    case 'BinOp': walkExpr(e.left, fn); walkExpr(e.right, fn); break;
    case 'UnaryOp': walkExpr(e.operand, fn); break;
    case 'BoolOp': e.values.forEach((v) => walkExpr(v, fn)); break;
    case 'Compare': walkExpr(e.left, fn); e.comparators.forEach((v) => walkExpr(v, fn)); break;
    case 'IfExp': walkExpr(e.test, fn); walkExpr(e.body, fn); walkExpr(e.orelse, fn); break;
    case 'Call': walkExpr(e.func, fn); e.args.forEach((v) => walkExpr(v, fn)); e.keywords.forEach((k) => walkExpr(k.value, fn)); break;
    case 'Attribute': walkExpr(e.value, fn); break;
    case 'Subscript': walkExpr(e.value, fn); walkExpr(e.slice, fn); break;
    case 'Slice': walkExpr(e.lower, fn); walkExpr(e.upper, fn); walkExpr(e.step, fn); break;
    case 'List': case 'Tuple': case 'Set': e.elts.forEach((v) => walkExpr(v, fn)); break;
    case 'Dict': e.keys.forEach((v) => walkExpr(v, fn)); e.values.forEach((v) => walkExpr(v, fn)); break;
    case 'ListComp': case 'SetComp': case 'GeneratorExp': case 'DictComp':
      walkExpr(e.elt, fn); walkExpr(e.value, fn);
      e.gens.forEach((g) => { walkExpr(g.iter, fn); g.ifs.forEach((c) => walkExpr(c, fn)); });
      break;
    case 'Starred': walkExpr(e.value, fn); break;
    case 'JoinedStr': e.parts.forEach((p) => { if (typeof p !== 'string') { walkExpr(p.value, fn); walkExpr(p.spec, fn); } }); break;
    case 'NamedExpr': walkExpr(e.value, fn); break;
    case 'Lambda': e.args.params.forEach((p) => walkExpr(p.default, fn)); e.args.kwonly.forEach((p) => walkExpr(p.default, fn)); break;
  }
}

function collectBindings(body, sc, params) {
  const assigned = new Set();
  const bind = (name) => {
    assigned.add(name);
    if (!sc.globalNames.has(name) && !sc.nonlocalNames.has(name)) sc.slot(name);
  };
  const bindTarget = (t) => {
    if (!t) return;
    if (t.type === 'Name') bind(t.id);
    else if (t.type === 'Tuple' || t.type === 'List') t.elts.forEach(bindTarget);
    else if (t.type === 'Starred') bindTarget(t.value);
  };
  const walrus = (e) => walkExpr(e, (n) => { if (n.type === 'NamedExpr') bind(n.target.id); });
  const visitAll = (stmts) => { for (const s of stmts) visit(s); };
  const visit = (s) => {
    switch (s.type) {
      case 'Expr': walrus(s.value); break;
      case 'Assign': walrus(s.value); s.targets.forEach(bindTarget); break;
      case 'AugAssign': walrus(s.value); if (s.target.type === 'Name') bind(s.target.id); break;
      case 'AnnAssign': walrus(s.value); if (s.target.type === 'Name') bind(s.target.id); break;
      case 'Return': walrus(s.value); break;
      case 'If': walrus(s.test); visitAll(s.body); visitAll(s.orelse); break;
      case 'While': walrus(s.test); visitAll(s.body); visitAll(s.orelse); break;
      case 'For': walrus(s.iter); bindTarget(s.target); visitAll(s.body); visitAll(s.orelse); break;
      case 'Try':
        visitAll(s.body);
        for (const h of s.handlers) { if (h.name) bind(h.name); visitAll(h.body); }
        visitAll(s.orelse);
        if (s.finalbody) visitAll(s.finalbody);
        break;
      case 'FunctionDef':
        s.args.params.forEach((p) => walrus(p.default));
        bind(s.name);
        break;
      case 'Import': for (const n of s.names) bind(n.asname || n.name.split('.')[0]); break;
      case 'ImportFrom':
        for (const n of s.names) {
          if (n.name === '*') throw nodeErr('SyntaxError', 'import * only allowed at module level', s);
          bind(n.asname || n.name);
        }
        break;
      case 'Del': s.targets.forEach(bindTarget); break;
      case 'Assert': walrus(s.test); walrus(s.msg); break;
      case 'Global':
        for (const n of s.names) {
          if (params && params.includes(n)) throw nodeErr('SyntaxError', `name '${n}' is parameter and global`, s);
          if (assigned.has(n)) throw nodeErr('SyntaxError', `name '${n}' is assigned to before global declaration`, s);
          sc.globalNames.add(n);
        }
        break;
      case 'Nonlocal':
        for (const n of s.names) {
          if (params && params.includes(n)) throw nodeErr('SyntaxError', `name '${n}' is parameter and nonlocal`, s);
          if (assigned.has(n)) throw nodeErr('SyntaxError', `name '${n}' is assigned to before nonlocal declaration`, s);
          sc.nonlocalNames.add(n);
        }
        break;
    }
  };
  visitAll(body);
  for (const n of sc.nonlocalNames) {
    let found = false;
    for (let p = sc.parent; p && p.kind !== 'module'; p = p.parent) if (p.slots.has(n)) { found = true; break; }
    if (!found) {
      const s = body.find((x) => x.type === 'Nonlocal' && x.names.includes(n)) || body[0];
      throw nodeErr('SyntaxError', `no binding for nonlocal '${n}' found`, s);
    }
  }
}

function excMatches(pe, t) {
  if (t instanceof PyType && t.isExc) return isSubtype(pe.cls, t);
  if (t instanceof PyTuple) return t.items.some((x) => excMatches(pe, x));
  throw TypeErr('catching classes that do not inherit from BaseException is not allowed');
}

function unpackSeq(v, n, star) {
  let items;
  if (Array.isArray(v)) items = v;
  else if (v instanceof PyTuple) items = v.items;
  else {
    try { items = iterToArray(v); } catch (e) {
      if (e instanceof PyException && e.cls === EXC.TypeError && /is not iterable/.test(e.args[0])) throw TypeErr(`cannot unpack non-iterable ${tname(v)} object`);
      throw e;
    }
  }
  if (star < 0) {
    if (items.length === n) return items;
    if (items.length > n) throw ValueErr(`too many values to unpack (expected ${n})`);
    throw ValueErr(`not enough values to unpack (expected ${n}, got ${items.length})`);
  }
  if (items.length < n - 1) throw ValueErr(`not enough values to unpack (expected at least ${n - 1}, got ${items.length})`);
  const after = n - 1 - star;
  const out = items.slice(0, star);
  out.push(items.slice(star, items.length - after));
  for (let i = items.length - after; i < items.length; i++) out.push(items[i]);
  return out;
}

class Compiler {
  constructor(vm) { this.vm = vm; }

  module(body) {
    const sc = new Scope('module', null, '<module>', '<module>');
    const check = (stmts) => {
      for (const s of stmts) {
        if (s.type === 'Nonlocal') throw nodeErr('SyntaxError', 'nonlocal declaration not allowed at module level', s);
        if (s.body && s.type !== 'FunctionDef') { check(s.body); if (s.orelse) check(s.orelse); }
        if (s.type === 'Try') { s.handlers.forEach((h) => check(h.body)); if (s.finalbody) check(s.finalbody); }
      }
    };
    check(body);
    return this.block(body, sc);
  }

  resolve(name, sc) {
    let s = sc, depth = 0;
    while (s && s.kind !== 'module') {
      if (s.globalNames.has(name)) return GLOBAL;
      const i = s.slots.get(name);
      if (i !== undefined) return depth === 0 ? { kind: 'local', slot: i } : { kind: 'free', depth, slot: i };
      s = s.parent;
      depth++;
    }
    return GLOBAL;
  }
  loadName(name, sc, node) {
    const r = this.resolve(name, sc), where = sc.qualname;
    if (r.kind === 'local') {
      const i = r.slot;
      return (f) => { const v = f.v[i]; if (v !== undefined) return v; throw unboundErr(name, node, where); };
    }
    if (r.kind === 'free') {
      const d = r.depth, i = r.slot;
      if (d === 1) return (f) => { const v = f.up.v[i]; if (v !== undefined) return v; throw freeErr(name, node, where); };
      return (f) => {
        let fr = f;
        for (let k = 0; k < d; k++) fr = fr.up;
        const v = fr.v[i];
        if (v !== undefined) return v;
        throw freeErr(name, node, where);
      };
    }
    const cell = this.vm.cell(name);
    return (f) => {
      const v = cell.v;
      if (v !== undefined) return v;
      const b = BUILTINS.get(name);
      if (b !== undefined) return b;
      throw nameErr(name, node, where, f, sc);
    };
  }
  storeName(name, sc) {
    const r = this.resolve(name, sc);
    if (r.kind === 'local') { const i = r.slot; return (f, v) => { f.v[i] = v; }; }
    if (r.kind === 'free') {
      const d = r.depth, i = r.slot;
      return (f, v) => { let fr = f; for (let k = 0; k < d; k++) fr = fr.up; fr.v[i] = v; };
    }
    const cell = this.vm.cell(name);
    return (f, v) => { cell.v = v; };
  }
  delName(name, sc, node) {
    const r = this.resolve(name, sc), where = sc.qualname;
    if (r.kind === 'local') {
      const i = r.slot;
      return (f) => { if (f.v[i] === undefined) throw unboundErr(name, node, where); f.v[i] = undefined; };
    }
    if (r.kind === 'free') {
      const d = r.depth, i = r.slot;
      return (f) => {
        let fr = f;
        for (let k = 0; k < d; k++) fr = fr.up;
        if (fr.v[i] === undefined) throw freeErr(name, node, where);
        fr.v[i] = undefined;
      };
    }
    const cell = this.vm.cell(name);
    return (f) => { if (cell.v === undefined) throw nameErr(name, node, where, f, sc); cell.v = undefined; };
  }

  block(stmts, sc) {
    const fns = stmts.map((s) => this.stmt(s, sc));
    const n = fns.length, vm = this.vm, where = sc.qualname;
    if (n === 0) return () => undefined;
    if (n === 1) {
      const f0 = fns[0], s0 = stmts[0];
      return (f) => {
        if (++vm.steps > vm.maxSteps) throw vm.timeoutError(s0, where);
        try { return f0(f); } catch (e) { throw locate(e, s0, where); }
      };
    }
    return (f) => {
      let i = 0;
      try {
        for (; i < n; i++) {
          if (++vm.steps > vm.maxSteps) throw vm.timeoutError(stmts[i], where);
          const sig = fns[i](f);
          if (sig) return sig;
        }
      } catch (e) { throw locate(e, stmts[i], where); }
      return undefined;
    };
  }

  stmt(s, sc) {
    const vm = this.vm, where = sc.qualname;
    switch (s.type) {
      case 'Expr': {
        const e = this.expr(s.value, sc);
        return (f) => { e(f); };
      }
      case 'Assign': {
        const val = this.expr(s.value, sc);
        if (s.targets.length === 1) {
          const t = s.targets[0];
          if (t.type === 'Name') {
            const r = this.resolve(t.id, sc);
            if (r.kind === 'local') { const i = r.slot; return (f) => { f.v[i] = val(f); }; }
            if (r.kind === 'global') { const cell = vm.cell(t.id); return (f) => { cell.v = val(f); }; }
          }
          const st = this.target(t, sc);
          return (f) => { st(f, val(f)); };
        }
        const sts = s.targets.map((t) => this.target(t, sc));
        return (f) => { const v = val(f); for (let i = 0; i < sts.length; i++) sts[i](f, v); };
      }
      case 'AnnAssign': {
        if (!s.value) return () => undefined;
        const val = this.expr(s.value, sc), st = this.target(s.target, sc);
        return (f) => { st(f, val(f)); };
      }
      case 'AugAssign': return this.augAssign(s, sc);
      case 'Pass': case 'Global': case 'Nonlocal': return () => undefined;
      case 'Break':
        if (!sc.loop) throw nodeErr('SyntaxError', "'break' outside loop", s);
        return () => BREAK;
      case 'Continue':
        if (!sc.loop) throw nodeErr('SyntaxError', "'continue' not properly in loop", s);
        return () => CONTINUE;
      case 'Return': {
        if (sc.kind !== 'function') throw nodeErr('SyntaxError', "'return' outside function", s);
        if (!s.value) return (f) => { f.ret = null; return RETURN; };
        const val = this.expr(s.value, sc);
        return (f) => { f.ret = val(f); return RETURN; };
      }
      case 'If': {
        const test = this.expr(s.test, sc), body = this.block(s.body, sc);
        if (s.orelse.length) {
          const orelse = this.block(s.orelse, sc);
          return (f) => { const t = test(f); return (t === true || (t !== false && truthy(t))) ? body(f) : orelse(f); };
        }
        return (f) => { const t = test(f); if (t === true || (t !== false && truthy(t))) return body(f); return undefined; };
      }
      case 'While': {
        const test = this.expr(s.test, sc);
        sc.loop++;
        const body = this.block(s.body, sc);
        sc.loop--;
        const orelse = s.orelse.length ? this.block(s.orelse, sc) : null;
        return (f) => {
          for (;;) {
            const t = test(f);
            if (!(t === true || (t !== false && truthy(t)))) return orelse ? orelse(f) : undefined;
            const sig = body(f);
            if (sig === BREAK) return undefined;
            if (sig === RETURN) return RETURN;
          }
        };
      }
      case 'For': return this.forStmt(s, sc);
      case 'Try': return this.tryStmt(s, sc);
      case 'FunctionDef': {
        const spec = this.compileFunction(s.name, s.args, s.body, sc, false, s);
        const defs = s.args.params.filter((p) => p.default).map((p) => this.expr(p.default, sc));
        const kwdefs = s.args.kwonly.filter((p) => p.default).map((p) => [p.name, this.expr(p.default, sc)]);
        const store = this.storeName(s.name, sc);
        return (f) => {
          const dv = defs.map((d) => d(f));
          const kd = {};
          for (const [n, d] of kwdefs) kd[n] = d(f);
          store(f, new PyFunction(spec, dv, kd, f));
        };
      }
      case 'Del': {
        const dels = s.targets.map((t) => this.delTarget(t, sc));
        return (f) => { for (const d of dels) d(f); };
      }
      case 'Assert': {
        const test = this.expr(s.test, sc), msg = s.msg ? this.expr(s.msg, sc) : null;
        return (f) => {
          if (!truthy(test(f))) {
            const e = new PyException(EXC.AssertionError, msg ? [msg(f)] : []);
            setLoc(e, s, where);
            throw e;
          }
        };
      }
      case 'Raise': {
        const ex = s.exc ? this.expr(s.exc, sc) : null;
        if (s.cause) this.expr(s.cause, sc);
        return (f) => {
          if (!ex) {
            const cur = vm.handling[vm.handling.length - 1];
            if (!cur) { const e = exc('RuntimeError', 'No active exception to reraise'); setLoc(e, s, where); throw e; }
            throw cur;
          }
          let v = ex(f);
          if (v instanceof PyType && v.isExc) v = new PyException(v, []);
          else if (!(v instanceof PyException)) { const e = TypeErr('exceptions must derive from BaseException'); setLoc(e, s, where); throw e; }
          if (v.line === undefined) setLoc(v, s, where);
          throw v;
        };
      }
      case 'Import': {
        const parts = s.names.map((n) => ({ name: n.name, store: this.storeName(n.asname || n.name.split('.')[0], sc) }));
        return (f) => { for (const p of parts) p.store(f, vm.importModule(p.name)); };
      }
      case 'ImportFrom': {
        const mod = s.module;
        if (s.names.length === 1 && s.names[0].name === '*') {
          if (sc.kind !== 'module') throw nodeErr('SyntaxError', 'import * only allowed at module level', s);
          return () => {
            const m = vm.importModule(mod);
            for (const [k, v] of m.attrs) if (!k.startsWith('_')) vm.cell(k).v = v;
          };
        }
        const parts = s.names.map((n) => ({ name: n.name, store: this.storeName(n.asname || n.name, sc) }));
        return (f) => {
          const m = vm.importModule(mod);
          for (const p of parts) {
            const v = m.attrs.get(p.name);
            if (v === undefined) {
              const e = exc('ImportError', `cannot import name '${p.name}' from '${mod}' (unknown location)`);
              e.importName = p.name; e.importFrom = m;
              throw e;
            }
            p.store(f, v);
          }
        };
      }
    }
    throw nodeErr('SyntaxError', 'invalid syntax', s);
  }

  augAssign(s, sc) {
    const op = s.op, t = s.target, where = sc.qualname;
    const val = this.expr(s.value, sc);
    if (t.type === 'Name') {
      const load = this.loadName(t.id, sc, t), store = this.storeName(t.id, sc);
      if (op === 'add' || op === 'sub') {
        const add = op === 'add';
        return (f) => {
          const cur = load(f), r = val(f);
          if (typeof cur === 'number' && typeof r === 'number') {
            const x = add ? cur + r : cur - r;
            if (x <= MAX_SAFE && x >= -MAX_SAFE) { store(f, x); return; }
          } else if (add && typeof cur === 'string' && typeof r === 'string' && cur.length + r.length <= MAX_SEQ) { store(f, cur + r); return; }
          let res;
          try { res = inplace(op, cur, r); } catch (e) { throw locate(e, s, where); }
          store(f, res);
        };
      }
      return (f) => {
        const cur = load(f), r = val(f);
        let res;
        try { res = inplace(op, cur, r); } catch (e) { throw locate(e, s, where); }
        store(f, res);
      };
    }
    if (t.type === 'Subscript') {
      const o = this.expr(t.value, sc), k = this.expr(t.slice, sc);
      return (f) => {
        const ov = o(f), kv = k(f);
        let cur;
        try { cur = getItem(ov, kv); } catch (e) { throw locate(e, t, where); }
        const r = val(f);
        try { setItem(ov, kv, inplace(op, cur, r)); } catch (e) { throw locate(e, s, where); }
      };
    }
    const o = this.expr(t.value, sc), name = t.attr;
    return (f) => {
      const ov = o(f);
      let cur;
      try { cur = getAttr(ov, name); } catch (e) { throw locate(e, t, where); }
      const r = val(f);
      try { setAttr(ov, name, inplace(op, cur, r)); } catch (e) { throw locate(e, s, where); }
    };
  }

  forStmt(s, sc) {
    const iterE = this.expr(s.iter, sc), where = sc.qualname;
    const store = this.target(s.target, sc);
    sc.loop++;
    const body = this.block(s.body, sc);
    sc.loop--;
    const orelse = s.orelse.length ? this.block(s.orelse, sc) : null;
    const iterNode = s.iter;
    return (f) => {
      const o = iterE(f);
      if (o instanceof PyRange) {
        let v = o.start;
        const step = o.step;
        for (let k = o.len; k > 0; k--, v += step) {
          store(f, v);
          const sig = body(f);
          if (sig === BREAK) return undefined;
          if (sig === RETURN) return RETURN;
        }
        return orelse ? orelse(f) : undefined;
      }
      let it;
      try { it = getIter(o); } catch (e) { throw locate(e, iterNode, where); }
      for (;;) {
        const v = it.next();
        if (v === STOP) return orelse ? orelse(f) : undefined;
        store(f, v);
        const sig = body(f);
        if (sig === BREAK) return undefined;
        if (sig === RETURN) return RETURN;
      }
    };
  }

  tryStmt(s, sc) {
    const vm = this.vm;
    const body = this.block(s.body, sc);
    const handlers = s.handlers.map((h) => ({
      type: h.type ? this.expr(h.type, sc) : null,
      store: h.name ? this.storeName(h.name, sc) : null,
      unbind: h.name ? this.unbinder(h.name, sc) : null,
      body: this.block(h.body, sc),
      node: h,
    }));
    const orelse = s.orelse.length ? this.block(s.orelse, sc) : null;
    const fin = s.finalbody ? this.block(s.finalbody, sc) : null;
    const where = sc.qualname;
    const core = handlers.length ? (f) => {
      let sig;
      try {
        sig = body(f);
      } catch (err) {
        const pe = jsToPyExc(err);
        if (pe.fatal) throw pe;
        if (pe.line === undefined) setLoc(pe, s, where);
        for (const h of handlers) {
          if (h.type !== null) {
            let ok;
            try { ok = excMatches(pe, h.type(f)); } catch (e) { throw locate(e, h.node, where); }
            if (!ok) continue;
          }
          if (h.store) h.store(f, pe);
          vm.handling.push(pe);
          try { return h.body(f); } finally { vm.handling.pop(); if (h.unbind) h.unbind(f); }
        }
        throw pe;
      }
      if (orelse && !sig) return orelse(f);
      return sig;
    } : body;
    if (!fin) return core;
    return (f) => {
      let sig, err = null, threw = false;
      try { sig = core(f); } catch (e) { threw = true; err = e; }
      if (threw && err instanceof PyException && err.fatal) throw err;
      if (threw) vm.handling.push(jsToPyExc(err));
      let fs;
      try { fs = fin(f); } finally { if (threw) vm.handling.pop(); }
      if (fs) return fs;
      if (threw) throw err;
      return sig;
    };
  }
  unbinder(name, sc) {
    const r = this.resolve(name, sc);
    if (r.kind === 'local') { const i = r.slot; return (f) => { f.v[i] = undefined; }; }
    if (r.kind === 'free') { const d = r.depth, i = r.slot; return (f) => { let fr = f; for (let k = 0; k < d; k++) fr = fr.up; fr.v[i] = undefined; }; }
    const cell = this.vm.cell(name);
    return () => { cell.v = undefined; };
  }

  target(t, sc) {
    const where = sc.qualname;
    switch (t.type) {
      case 'Name': return this.storeName(t.id, sc);
      case 'Subscript': {
        const o = this.expr(t.value, sc), k = this.expr(t.slice, sc);
        return (f, v) => {
          const ov = o(f), kv = k(f);
          if (Array.isArray(ov) && typeof kv === 'number') {
            const i = kv < 0 ? kv + ov.length : kv;
            if (i >= 0 && i < ov.length) { ov[i] = v; return; }
          }
          try { setItem(ov, kv, v); } catch (e) { throw locate(e, t, where); }
        };
      }
      case 'Attribute': {
        const o = this.expr(t.value, sc), name = t.attr;
        return (f, v) => { const ov = o(f); try { setAttr(ov, name, v); } catch (e) { throw locate(e, t, where); } };
      }
      case 'Tuple': case 'List': {
        const elts = t.elts;
        const stars = elts.filter((e) => e.type === 'Starred').length;
        if (stars > 1) throw nodeErr('SyntaxError', 'multiple starred expressions in assignment', t);
        const starIdx = elts.findIndex((e) => e.type === 'Starred');
        const subs = elts.map((e) => (e.type === 'Starred' ? this.target(e.value, sc) : this.target(e, sc)));
        const n = elts.length;
        return (f, v) => {
          let items;
          try { items = unpackSeq(v, n, starIdx); } catch (e) { throw locate(e, t, where); }
          for (let i = 0; i < n; i++) subs[i](f, items[i]);
        };
      }
      case 'Starred': throw nodeErr('SyntaxError', 'starred assignment target must be in a list or tuple', t);
    }
    throw nodeErr('SyntaxError', `cannot assign to ${exprName(t)}`, t);
  }
  delTarget(t, sc) {
    const where = sc.qualname;
    switch (t.type) {
      case 'Name': return this.delName(t.id, sc, t);
      case 'Subscript': {
        const o = this.expr(t.value, sc), k = this.expr(t.slice, sc);
        return (f) => { const ov = o(f), kv = k(f); try { delItem(ov, kv); } catch (e) { throw locate(e, t, where); } };
      }
      case 'Attribute': {
        const o = this.expr(t.value, sc), name = t.attr;
        return (f) => {
          const ov = o(f);
          if (ov instanceof PyModule && ov.attrs.has(name)) { ov.attrs.delete(name); return; }
          const e = attrError(ov, name);
          setLoc(e, t, where);
          throw e;
        };
      }
      case 'Tuple': case 'List': {
        const subs = t.elts.map((e) => this.delTarget(e, sc));
        return (f) => { for (const d of subs) d(f); };
      }
    }
    throw nodeErr('SyntaxError', `cannot delete ${exprName(t)}`, t);
  }

  compileFunction(name, args, body, psc, isLambda, node) {
    let q = psc;
    while (q.kind === 'comp') q = q.parent;
    const qualname = psc.kind === 'module' ? name : `${psc.qualname}.<locals>.${name}`;
    const sc = new Scope('function', psc, name, qualname);
    const params = args.params.map((p) => p.name);
    const all = params.concat(args.kwonly.map((p) => p.name));
    if (args.vararg) all.push(args.vararg);
    if (args.kwarg) all.push(args.kwarg);
    const seen = new Set();
    for (let i = 0; i < all.length; i++) {
      if (seen.has(all[i])) {
        const tk = args.toks.find((x, j) => x.v === all[i] && j > args.toks.findIndex((y) => y.v === all[i])) || node;
        throw nodeErr('SyntaxError', `duplicate argument '${all[i]}' in function definition`, tk);
      }
      seen.add(all[i]);
    }
    params.forEach((p) => sc.slot(p));
    args.kwonly.forEach((p) => sc.slot(p.name));
    const varargs = args.vararg ? sc.slot(args.vararg) : -1;
    const kwargs = args.kwarg ? sc.slot(args.kwarg) : -1;
    const paramIndex = Object.create(null);
    params.forEach((p, i) => { paramIndex[p] = i; });
    args.kwonly.forEach((p, j) => { paramIndex[p.name] = params.length + j; });
    let bodyFn, doc = null;
    if (isLambda) {
      walkExpr(body, (n) => { if (n.type === 'NamedExpr') sc.slot(n.target.id); });
      const e = this.expr(body, sc);
      bodyFn = (f) => { f.ret = e(f); return RETURN; };
    } else {
      collectBindings(body, sc, all);
      if (body[0] && body[0].type === 'Expr' && body[0].value.type === 'Const' && typeof body[0].value.value === 'string') doc = body[0].value.value;
      bodyFn = this.block(body, sc);
    }
    return {
      name, qualname, doc, params, nparams: params.length,
      kwonly: args.kwonly.map((p) => p.name), kwonlyStart: params.length,
      varargs, kwargs, varargsName: args.vararg, kwargsName: args.kwarg, paramIndex,
      nlocals: sc.slots.size, simple: varargs < 0 && kwargs < 0 && args.kwonly.length === 0,
      body: bodyFn, scope: sc, vm: this.vm,
    };
  }

  // ---------------- expressions ----------------
  expr(e, sc) {
    const where = sc.qualname;
    switch (e.type) {
      case 'Const': { const v = e.value; return () => v; }
      case 'Name': return this.loadName(e.id, sc, e);
      case 'BinOp': return this.binop(e, sc);
      case 'UnaryOp': {
        const o = this.expr(e.operand, sc), op = e.op;
        if (op === 'not') return (f) => { const v = o(f); return v === false ? true : v === true ? false : !truthy(v); };
        if (op === 'neg') {
          return (f) => {
            const v = o(f);
            if (typeof v === 'number') return 0 - v;
            try { return unary('neg', v); } catch (x) { throw locate(x, e, where); }
          };
        }
        return (f) => { const v = o(f); try { return unary(op, v); } catch (x) { throw locate(x, e, where); } };
      }
      case 'BoolOp': {
        const vals = e.values.map((v) => this.expr(v, sc));
        const n = vals.length;
        if (e.op === 'and') return (f) => { let v; for (let i = 0; i < n; i++) { v = vals[i](f); if (!truthy(v)) return v; } return v; };
        return (f) => { let v; for (let i = 0; i < n; i++) { v = vals[i](f); if (truthy(v)) return v; } return v; };
      }
      case 'Compare': return this.compare(e, sc);
      case 'IfExp': {
        const test = this.expr(e.test, sc), body = this.expr(e.body, sc), orelse = this.expr(e.orelse, sc);
        return (f) => (truthy(test(f)) ? body(f) : orelse(f));
      }
      case 'Call': return this.call(e, sc);
      case 'Attribute': {
        const o = this.expr(e.value, sc), name = e.attr;
        return (f) => { const v = o(f); try { return getAttr(v, name); } catch (x) { throw locate(x, e, where); } };
      }
      case 'Subscript': {
        const o = this.expr(e.value, sc), k = this.expr(e.slice, sc);
        return (f) => {
          const ov = o(f), kv = k(f);
          if (Array.isArray(ov) && typeof kv === 'number') {
            const i = kv < 0 ? kv + ov.length : kv;
            if (i >= 0 && i < ov.length) return ov[i];
          }
          try { return getItem(ov, kv); } catch (x) { throw locate(x, e, where); }
        };
      }
      case 'Slice': {
        const lo = e.lower ? this.expr(e.lower, sc) : null, hi = e.upper ? this.expr(e.upper, sc) : null, st = e.step ? this.expr(e.step, sc) : null;
        return (f) => new PySlice(lo ? lo(f) : null, hi ? hi(f) : null, st ? st(f) : null);
      }
      case 'List': case 'Tuple': case 'Set': return this.display(e, sc);
      case 'Dict': {
        const ks = e.keys.map((k) => (k ? this.expr(k, sc) : null)), vs = e.values.map((v) => this.expr(v, sc));
        const n = ks.length;
        return (f) => {
          const d = new PyDict();
          for (let i = 0; i < n; i++) {
            if (ks[i] === null) {
              const m = vs[i](f);
              if (!(m instanceof PyDict)) { const x = TypeErr(`'${tname(m)}' object is not a mapping`); setLoc(x, e, where); throw x; }
              for (const en of m.m.values()) d.set(en[0], en[1]);
            } else {
              const k = ks[i](f), v = vs[i](f);
              try { d.set(k, v); } catch (x) { throw locate(x, e, where); }
            }
          }
          return d;
        };
      }
      case 'ListComp': case 'SetComp': case 'DictComp': case 'GeneratorExp': return this.comp(e, sc);
      case 'JoinedStr': {
        const parts = e.parts.map((p) => (typeof p === 'string' ? p : {
          v: this.expr(p.value, sc), conv: p.conv, spec: p.spec ? this.expr(p.spec, sc) : null, node: p,
        }));
        return (f) => {
          let s = '';
          for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (typeof p === 'string') { s += p; continue; }
            let v = p.v(f);
            const spec = p.spec ? p.spec(f) : '';
            try {
              if (p.conv === 'r') v = repr(v);
              else if (p.conv === 's') v = str(v);
              else if (p.conv === 'a') v = asciiRepr(v);
              s += (spec === '' && typeof v === 'string') ? v : formatValue(v, spec);
            } catch (x) { throw locate(x, p.node, where); }
          }
          return s;
        };
      }
      case 'Lambda': {
        const spec = this.compileFunction('<lambda>', e.args, e.body, sc, true, e);
        const defs = e.args.params.filter((p) => p.default).map((p) => this.expr(p.default, sc));
        const kwdefs = e.args.kwonly.filter((p) => p.default).map((p) => [p.name, this.expr(p.default, sc)]);
        return (f) => {
          const kd = {};
          for (const [n, d] of kwdefs) kd[n] = d(f);
          return new PyFunction(spec, defs.map((d) => d(f)), kd, f);
        };
      }
      case 'NamedExpr': {
        const val = this.expr(e.value, sc);
        let tsc = sc;
        while (tsc.kind === 'comp') tsc = tsc.parent;
        if (tsc.kind === 'function' && !tsc.slots.has(e.target.id) && !tsc.globalNames.has(e.target.id)) tsc.slot(e.target.id);
        const store = this.storeName(e.target.id, sc);
        return (f) => { const v = val(f); store(f, v); return v; };
      }
      case 'Starred': throw nodeErr('SyntaxError', "can't use starred expression here", e);
    }
    throw nodeErr('SyntaxError', 'invalid syntax', e);
  }

  binop(e, sc) {
    const L = this.expr(e.left, sc), R = this.expr(e.right, sc), op = e.op, where = sc.qualname;
    switch (op) {
      case 'add':
        return (f) => {
          const a = L(f), b = R(f);
          if (typeof a === 'number' && typeof b === 'number') { const r = a + b; if (r <= MAX_SAFE && r >= -MAX_SAFE) return r; }
          else if (typeof a === 'string' && typeof b === 'string' && a.length + b.length <= MAX_SEQ) return a + b;
          try { return binop('add', a, b); } catch (x) { throw locate(x, e, where); }
        };
      case 'sub':
        return (f) => {
          const a = L(f), b = R(f);
          if (typeof a === 'number' && typeof b === 'number') { const r = a - b; if (r <= MAX_SAFE && r >= -MAX_SAFE) return r; }
          try { return binop('sub', a, b); } catch (x) { throw locate(x, e, where); }
        };
      case 'mul':
        return (f) => {
          const a = L(f), b = R(f);
          if (typeof a === 'number' && typeof b === 'number') { const r = a * b; if (r <= MAX_SAFE && r >= -MAX_SAFE) return r + 0; }
          try { return binop('mul', a, b); } catch (x) { throw locate(x, e, where); }
        };
      case 'mod':
        return (f) => {
          const a = L(f), b = R(f);
          if (typeof a === 'number' && typeof b === 'number' && a >= 0 && b > 0) return a % b;
          try { return binop('mod', a, b); } catch (x) { throw locate(x, e, where); }
        };
      case 'floordiv':
        return (f) => {
          const a = L(f), b = R(f);
          if (typeof a === 'number' && typeof b === 'number' && b !== 0) return Math.floor(a / b) + 0;
          try { return binop('floordiv', a, b); } catch (x) { throw locate(x, e, where); }
        };
    }
    return (f) => {
      const a = L(f), b = R(f);
      try { return binop(op, a, b); } catch (x) { throw locate(x, e, where); }
    };
  }

  compare(e, sc) {
    const where = sc.qualname;
    const L = this.expr(e.left, sc);
    const Rs = e.comparators.map((c) => this.expr(c, sc));
    const ops = e.ops, n = ops.length;
    const cmp1 = (op, a, b) => {
      switch (op) {
        case '<': return order('lt', a, b);
        case '>': return order('gt', a, b);
        case '<=': return order('le', a, b);
        case '>=': return order('ge', a, b);
        case '==': return a === b ? !(a instanceof PyFloat && a.v !== a.v) : eq(a, b);
        case '!=': return !(a === b ? !(a instanceof PyFloat && a.v !== a.v) : eq(a, b));
        case 'in': return contains(b, a);
        case 'not in': return !contains(b, a);
        case 'is': return a === b;
        default: return a !== b;
      }
    };
    if (n === 1) {
      const R = Rs[0], op = ops[0];
      switch (op) {
        case '<': return (f) => { const a = L(f), b = R(f); if (typeof a === 'number' && typeof b === 'number') return a < b; try { return order('lt', a, b); } catch (x) { throw locate(x, e, where); } };
        case '>': return (f) => { const a = L(f), b = R(f); if (typeof a === 'number' && typeof b === 'number') return a > b; try { return order('gt', a, b); } catch (x) { throw locate(x, e, where); } };
        case '<=': return (f) => { const a = L(f), b = R(f); if (typeof a === 'number' && typeof b === 'number') return a <= b; try { return order('le', a, b); } catch (x) { throw locate(x, e, where); } };
        case '>=': return (f) => { const a = L(f), b = R(f); if (typeof a === 'number' && typeof b === 'number') return a >= b; try { return order('ge', a, b); } catch (x) { throw locate(x, e, where); } };
        case '==': return (f) => {
          const a = L(f), b = R(f);
          const ta = typeof a;
          if (ta === typeof b && (ta === 'number' || ta === 'string')) return a === b;
          return a === b ? !(a instanceof PyFloat && a.v !== a.v) : eq(a, b);
        };
        case '!=': return (f) => {
          const a = L(f), b = R(f);
          const ta = typeof a;
          if (ta === typeof b && (ta === 'number' || ta === 'string')) return a !== b;
          return !(a === b ? !(a instanceof PyFloat && a.v !== a.v) : eq(a, b));
        };
      }
      return (f) => { const a = L(f), b = R(f); try { return cmp1(op, a, b); } catch (x) { throw locate(x, e, where); } };
    }
    return (f) => {
      let a = L(f);
      for (let i = 0; i < n; i++) {
        const b = Rs[i](f);
        let r;
        try { r = cmp1(ops[i], a, b); } catch (x) { throw locate(x, e, where); }
        if (!r) return false;
        a = b;
      }
      return true;
    };
  }

  display(e, sc) {
    const where = sc.qualname;
    const items = e.elts.map((x) => (x.type === 'Starred' ? { star: true, fn: this.expr(x.value, sc), node: x } : { star: false, fn: this.expr(x, sc) }));
    const n = items.length;
    const hasStar = items.some((x) => x.star);
    const build = hasStar
      ? (f) => {
        const out = [];
        for (const it of items) {
          if (it.star) {
            let arr;
            try { arr = iterToArray(it.fn(f)); } catch (x) { throw locate(x, it.node, where); }
            for (const v of arr) out.push(v);
          } else out.push(it.fn(f));
        }
        return out;
      }
      : (f) => { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = items[i].fn(f); return out; };
    if (e.type === 'List') return build;
    if (e.type === 'Tuple') return n === 0 ? () => EMPTY_TUPLE : (f) => new PyTuple(build(f));
    const constInts = n > 2 && e.elts.every((x) => x.type === 'Const' && (typeof x.value === 'boolean' || (typeof x.value === 'number' && Math.abs(x.value) < 2305843009213693950)));
    return (f) => {
      const s = new PySet();
      const vals = build(f);
      try { for (const v of vals) s.add(v); } catch (x) { throw locate(x, e, where); }
      if (constInts && s.size > 1) s.order = cpythonLiteralSetOrder(Array.from(s.m.values()));
      return s;
    };
  }

  call(e, sc) {
    const where = sc.qualname;
    const hasStar = e.args.some((a) => a.type === 'Starred') || e.keywords.some((k) => k.arg === null);
    const argFns = e.args.map((a) => (a.type === 'Starred' ? { star: true, fn: this.expr(a.value, sc), node: a } : { star: false, fn: this.expr(a, sc) }));
    const kwFns = e.keywords.map((k) => ({ name: k.arg, fn: this.expr(k.value, sc), node: k }));
    const nargs = argFns.length;
    const funcLabel = e.func.type === 'Name' ? e.func.id : e.func.type === 'Attribute' ? e.func.attr : 'function';
    let buildArgs;
    if (!hasStar) {
      const fns = argFns.map((a) => a.fn);
      buildArgs = nargs === 0 ? () => [] : nargs === 1 ? (f) => [fns[0](f)] : nargs === 2 ? (f) => [fns[0](f), fns[1](f)]
        : (f) => { const a = new Array(nargs); for (let i = 0; i < nargs; i++) a[i] = fns[i](f); return a; };
    } else {
      buildArgs = (f) => {
        const out = [];
        for (const a of argFns) {
          if (a.star) {
            const v = a.fn(f);
            let arr;
            try { arr = iterToArray(v); } catch (x) {
              if (x instanceof PyException && x.cls === EXC.TypeError) { const y = TypeErr(`${funcLabel}() argument after * must be an iterable, not ${tname(v)}`); setLoc(y, a.node, where); throw y; }
              throw locate(x, a.node, where);
            }
            for (const it of arr) out.push(it);
          } else out.push(a.fn(f));
        }
        return out;
      };
    }
    const buildKw = kwFns.length === 0 ? null : (f) => {
      const kw = Object.create(null);
      for (const k of kwFns) {
        if (k.name === null) {
          const d = k.fn(f);
          if (!(d instanceof PyDict)) { const y = TypeErr(`${funcLabel}() argument after ** must be a mapping, not ${tname(d)}`); setLoc(y, k.node, where); throw y; }
          for (const en of d.m.values()) {
            if (typeof en[0] !== 'string') { const y = TypeErr('keywords must be strings'); setLoc(y, k.node, where); throw y; }
            if (en[0] in kw) { const y = TypeErr(`${funcLabel}() got multiple values for keyword argument '${en[0]}'`); setLoc(y, k.node, where); throw y; }
            kw[en[0]] = en[1];
          }
        } else {
          if (k.name in kw) { const y = TypeErr(`${funcLabel}() got multiple values for keyword argument '${k.name}'`); setLoc(y, k.node, where); throw y; }
          kw[k.name] = k.fn(f);
        }
      }
      return kw;
    };
    if (e.func.type === 'Attribute') {
      const obj = this.expr(e.func.value, sc), name = e.func.attr;
      const lm = LM[name], sm = SM[name];
      return (f) => {
        const o = obj(f);
        const args = buildArgs(f);
        const kw = buildKw ? buildKw(f) : null;
        try {
          if (Array.isArray(o)) { if (lm !== undefined) return lm(o, args, kw); }
          else if (typeof o === 'string' && sm !== undefined) return sm(o, args, kw);
          return callMethod(o, name, args, kw);
        } catch (x) { throw callErr(x, e, where); }
      };
    }
    const fn = this.expr(e.func, sc);
    if (!buildKw) {
      return (f) => {
        const fv = fn(f);
        const args = buildArgs(f);
        try { return callValue(fv, args, null); } catch (x) { throw callErr(x, e, where); }
      };
    }
    return (f) => {
      const fv = fn(f);
      const args = buildArgs(f);
      const kw = buildKw(f);
      try { return callValue(fv, args, kw); } catch (x) { throw callErr(x, e, where); }
    };
  }

  comp(e, sc) {
    const vm = this.vm, where = sc.qualname;
    const kindName = { ListComp: '<listcomp>', SetComp: '<setcomp>', DictComp: '<dictcomp>', GeneratorExp: '<genexpr>' }[e.type];
    const csc = new Scope('comp', sc, kindName, sc.qualname);
    const bindNames = (t) => {
      if (t.type === 'Name') csc.slot(t.id);
      else if (t.type === 'Tuple' || t.type === 'List') t.elts.forEach(bindNames);
      else if (t.type === 'Starred') bindNames(t.value);
    };
    e.gens.forEach((g) => bindNames(g.target));
    const iter0 = this.expr(e.gens[0].iter, sc);
    const gens = e.gens.map((g, i) => ({
      store: this.target(g.target, csc),
      iter: i === 0 ? null : this.expr(g.iter, csc),
      ifs: g.ifs.map((c) => this.expr(c, csc)),
      iterNode: g.iter,
    }));
    const elt = this.expr(e.elt, csc);
    const val = e.value ? this.expr(e.value, csc) : null;
    const nl = () => csc.slots.size;
    const G = gens.length;
    const getIt = (o, node) => { try { return getIter(o); } catch (x) { throw locate(x, node, where); } };
    if (e.type === 'GeneratorExp') {
      return (f) => {
        const first = getIt(iter0(f), gens[0].iterNode);
        const fr = { v: new Array(nl()), up: f, ret: null };
        function* run(level, it) {
          const g = gens[level];
          for (;;) {
            const v = it.next();
            if (v === STOP) return;
            if (++vm.steps > vm.maxSteps) throw vm.timeoutError(e, where);
            g.store(fr, v);
            let ok = true;
            for (const c of g.ifs) if (!truthy(c(fr))) { ok = false; break; }
            if (!ok) continue;
            if (level + 1 < G) yield* run(level + 1, getIt(gens[level + 1].iter(fr), gens[level + 1].iterNode));
            else yield elt(fr);
          }
        }
        return new GenIter(run(0, first));
      };
    }
    const kind = e.type;
    return (f) => {
      const first = getIt(iter0(f), gens[0].iterNode);
      const fr = { v: new Array(nl()), up: f, ret: null };
      const out = kind === 'ListComp' ? [] : kind === 'SetComp' ? new PySet() : new PyDict();
      const emit = () => {
        if (kind === 'ListComp') { if (out.length >= MAX_SEQ) throw MemoryErr(); out.push(elt(fr)); }
        else if (kind === 'SetComp') { const v = elt(fr); try { out.add(v); } catch (x) { throw locate(x, e, where); } }
        else { const k = elt(fr), v = val(fr); try { out.set(k, v); } catch (x) { throw locate(x, e, where); } }
      };
      const run = (level, it) => {
        const g = gens[level];
        for (;;) {
          const v = it.next();
          if (v === STOP) return;
          if (++vm.steps > vm.maxSteps) throw vm.timeoutError(e, where);
          g.store(fr, v);
          let ok = true;
          for (let c = 0; c < g.ifs.length; c++) if (!truthy(g.ifs[c](fr))) { ok = false; break; }
          if (!ok) continue;
          if (level + 1 < G) run(level + 1, getIt(gens[level + 1].iter(fr), gens[level + 1].iterNode));
          else emit();
        }
      };
      run(0, first);
      return out;
    };
  }
}

function compileSource(vm, src) {
  src = String(src).replace(/\r\n?/g, '\n');
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const body = parseSource(src);
  return new Compiler(vm).module(body);
}

// ===========================================================================
// 22. "Did you mean ...?" suggestions (CPython's algorithm)
// ===========================================================================

const PY_BUILTIN_NAMES = ['__name__', '__doc__', '__package__', '__loader__', '__spec__', '__build_class__', '__import__', 'abs', 'all', 'any', 'ascii', 'bin', 'breakpoint', 'callable', 'chr', 'compile', 'delattr', 'dir', 'divmod', 'eval', 'exec', 'format', 'getattr', 'globals', 'hasattr', 'hash', 'hex', 'id', 'input', 'isinstance', 'issubclass', 'iter', 'aiter', 'len', 'locals', 'max', 'min', 'next', 'anext', 'oct', 'ord', 'pow', 'print', 'repr', 'round', 'setattr', 'sorted', 'sum', 'vars', 'None', 'Ellipsis', 'NotImplemented', 'False', 'True', 'bool', 'memoryview', 'bytearray', 'bytes', 'classmethod', 'complex', 'dict', 'enumerate', 'filter', 'float', 'frozenset', 'property', 'int', 'list', 'map', 'object', 'range', 'reversed', 'set', 'slice', 'staticmethod', 'str', 'super', 'tuple', 'type', 'zip', '__debug__', 'BaseException', 'BaseExceptionGroup', 'Exception', 'GeneratorExit', 'KeyboardInterrupt', 'SystemExit', 'ArithmeticError', 'AssertionError', 'AttributeError', 'BufferError', 'EOFError', 'ImportError', 'LookupError', 'MemoryError', 'NameError', 'OSError', 'ReferenceError', 'RuntimeError', 'StopAsyncIteration', 'StopIteration', 'SyntaxError', 'SystemError', 'TypeError', 'ValueError', 'Warning', 'FloatingPointError', 'OverflowError', 'ZeroDivisionError', 'BytesWarning', 'DeprecationWarning', 'EncodingWarning', 'FutureWarning', 'ImportWarning', 'PendingDeprecationWarning', 'ResourceWarning', 'RuntimeWarning', 'SyntaxWarning', 'UnicodeWarning', 'UserWarning', 'BlockingIOError', 'ChildProcessError', 'ConnectionError', 'FileExistsError', 'FileNotFoundError', 'InterruptedError', 'IsADirectoryError', 'NotADirectoryError', 'PermissionError', 'ProcessLookupError', 'TimeoutError', 'IndentationError', '_IncompleteInputError', 'IndexError', 'KeyError', 'ModuleNotFoundError', 'NotImplementedError', 'PythonFinalizationError', 'RecursionError', 'UnboundLocalError', 'UnicodeError', 'BrokenPipeError', 'ConnectionAbortedError', 'ConnectionRefusedError', 'ConnectionResetError', 'TabError', 'UnicodeDecodeError', 'UnicodeEncodeError', 'UnicodeTranslateError', 'ExceptionGroup', 'EnvironmentError', 'IOError', 'open', 'quit', 'exit', 'copyright', 'credits', 'license', 'help'];
const INT_DIR = ['as_integer_ratio', 'bit_count', 'bit_length', 'conjugate', 'denominator', 'from_bytes', 'imag', 'is_integer', 'numerator', 'real', 'to_bytes'];
const TYPE_DIRS = {
  str: ['capitalize', 'casefold', 'center', 'count', 'encode', 'endswith', 'expandtabs', 'find', 'format', 'format_map', 'index', 'isalnum', 'isalpha', 'isascii', 'isdecimal', 'isdigit', 'isidentifier', 'islower', 'isnumeric', 'isprintable', 'isspace', 'istitle', 'isupper', 'join', 'ljust', 'lower', 'lstrip', 'maketrans', 'partition', 'removeprefix', 'removesuffix', 'replace', 'rfind', 'rindex', 'rjust', 'rpartition', 'rsplit', 'rstrip', 'split', 'splitlines', 'startswith', 'strip', 'swapcase', 'title', 'translate', 'upper', 'zfill'],
  list: ['append', 'clear', 'copy', 'count', 'extend', 'index', 'insert', 'pop', 'remove', 'reverse', 'sort'],
  dict: ['clear', 'copy', 'fromkeys', 'get', 'items', 'keys', 'pop', 'popitem', 'setdefault', 'update', 'values'],
  set: ['add', 'clear', 'copy', 'difference', 'difference_update', 'discard', 'intersection', 'intersection_update', 'isdisjoint', 'issubset', 'issuperset', 'pop', 'remove', 'symmetric_difference', 'symmetric_difference_update', 'union', 'update'],
  frozenset: ['copy', 'difference', 'intersection', 'isdisjoint', 'issubset', 'issuperset', 'symmetric_difference', 'union'],
  tuple: ['count', 'index'],
  int: INT_DIR, bool: INT_DIR,
  float: ['as_integer_ratio', 'conjugate', 'fromhex', 'hex', 'imag', 'is_integer', 'real'],
  range: ['count', 'index', 'start', 'step', 'stop'],
  NoneType: [],
};
const MODULE_DIRS = {
  math: ['acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh', 'cbrt', 'ceil', 'comb', 'copysign', 'cos', 'cosh', 'degrees', 'dist', 'e', 'erf', 'erfc', 'exp', 'exp2', 'expm1', 'fabs', 'factorial', 'floor', 'fma', 'fmod', 'frexp', 'fsum', 'gamma', 'gcd', 'hypot', 'inf', 'isclose', 'isfinite', 'isinf', 'isnan', 'isqrt', 'lcm', 'ldexp', 'lgamma', 'log', 'log10', 'log1p', 'log2', 'modf', 'nan', 'nextafter', 'perm', 'pi', 'pow', 'prod', 'radians', 'remainder', 'sin', 'sinh', 'sqrt', 'sumprod', 'tan', 'tanh', 'tau', 'trunc', 'ulp'],
  string: ['Formatter', 'Template', 'ascii_letters', 'ascii_lowercase', 'ascii_uppercase', 'capwords', 'digits', 'hexdigits', 'octdigits', 'printable', 'punctuation', 'whitespace'],
  random: ['BPF', 'LOG4', 'NV_MAGICCONST', 'RECIP_BPF', 'Random', 'SG_MAGICCONST', 'SystemRandom', 'TWOPI', 'betavariate', 'binomialvariate', 'choice', 'choices', 'expovariate', 'gammavariate', 'gauss', 'getrandbits', 'getstate', 'lognormvariate', 'main', 'normalvariate', 'paretovariate', 'randbytes', 'randint', 'random', 'randrange', 'sample', 'seed', 'setstate', 'shuffle', 'triangular', 'uniform', 'vonmisesvariate', 'weibullvariate'],
  time: ['altzone', 'asctime', 'clock_getres', 'clock_gettime', 'ctime', 'daylight', 'get_clock_info', 'gmtime', 'localtime', 'mktime', 'monotonic', 'perf_counter', 'process_time', 'sleep', 'strftime', 'strptime', 'struct_time', 'time', 'timezone', 'tzname'],
};
const STDLIB_NAMES = new Set(('__future__ abc antigravity argparse array ast asyncio atexit base64 bdb binascii bisect builtins bz2 cProfile calendar cmath cmd code codecs codeop collections colorsys compileall concurrent configparser contextlib contextvars copy copyreg csv ctypes curses dataclasses datetime dbm decimal difflib dis doctest email encodings ensurepip enum errno faulthandler fcntl filecmp fileinput fnmatch fractions ftplib functools gc genericpath getopt getpass gettext glob graphlib grp gzip hashlib heapq hmac html http idlelib imaplib importlib inspect io ipaddress itertools json keyword linecache locale logging lzma mailbox marshal math mimetypes mmap modulefinder msvcrt multiprocessing netrc nt ntpath nturl2path numbers opcode operator optparse os pathlib pdb pickle pickletools pkgutil platform plistlib poplib posix posixpath pprint profile pstats pty pwd py_compile pyclbr pydoc pydoc_data pyexpat queue quopri random re readline reprlib resource rlcompleter runpy sched secrets select selectors shelve shlex shutil signal site smtplib socket socketserver sqlite3 sre_compile sre_constants sre_parse ssl stat statistics string stringprep struct subprocess symtable sys sysconfig syslog tabnanny tarfile tempfile termios textwrap this threading time timeit tkinter token tokenize tomllib trace traceback tracemalloc tty turtle turtledemo types typing unicodedata unittest urllib uuid venv warnings wave weakref webbrowser winreg winsound wsgiref xml xmlrpc zipapp zipfile zipimport zlib zoneinfo').split(' '));

const MOVE_COST = 2, CASE_COST = 1, MAX_STRING_SIZE = 40;
function substCost(a, b) {
  if ((a.charCodeAt(0) & 31) !== (b.charCodeAt(0) & 31)) return MOVE_COST;
  if (a === b) return 0;
  return a.toLowerCase() === b.toLowerCase() ? CASE_COST : MOVE_COST;
}
function levenshtein(a, b, maxCost) {
  if (a === b) return 0;
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  a = a.slice(s); b = b.slice(s);
  let e = 0;
  while (e < a.length && e < b.length && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  a = a.slice(0, a.length - e); b = b.slice(0, b.length - e);
  if (!a.length || !b.length) return (a.length + b.length) * MOVE_COST;
  if (a.length > MAX_STRING_SIZE || b.length > MAX_STRING_SIZE) return maxCost + 1;
  if (b.length < a.length) { const t = a; a = b; b = t; }
  if ((b.length - a.length) * MOVE_COST > maxCost) return maxCost + 1;
  const buf = new Array(a.length);
  for (let i = 0, t = MOVE_COST; i < a.length; i++, t += MOVE_COST) buf[i] = t;
  let result = 0;
  for (let bi = 0; bi < b.length; bi++) {
    const code = b[bi];
    let distance = result = bi * MOVE_COST;
    let minimum = Infinity;
    for (let i = 0; i < a.length; i++) {
      const substitute = distance + substCost(code, a[i]);
      distance = buf[i];
      const insertDelete = Math.min(result, distance) + MOVE_COST;
      result = Math.min(insertDelete, substitute);
      buf[i] = result;
      if (result < minimum) minimum = result;
    }
    if (minimum > maxCost) return maxCost + 1;
  }
  return result;
}
function suggest(name, candidates) {
  if (!name || candidates.length >= 750) return null;
  let best = null, bestDist = Infinity;
  for (const item of candidates) {
    if (item === name) continue;
    let maxDist = Math.floor((name.length + item.length + 3) * MOVE_COST / 6);
    maxDist = Math.min(maxDist, bestDist - 1);
    const d = levenshtein(name, item, maxDist);
    if (d > maxDist) continue;
    if (!best || d < bestDist) { best = item; bestDist = d; }
  }
  return best;
}
function nameCandidates(ctx, vm) {
  const out = [];
  const { frame, scope } = ctx;
  const g = ['__name__', '__doc__', '__package__', '__loader__', '__spec__', '__annotations__', '__builtins__'];
  for (const [k, c] of vm.globals) if (c.v !== undefined && !g.includes(k)) g.push(k);
  if (scope && scope.kind !== 'module' && frame) {
    for (const [n, i] of scope.slots) if (frame.v[i] !== undefined) out.push(n);
  } else out.push(...g);
  out.push(...g, ...PY_BUILTIN_NAMES);
  return out;
}
function attrCandidates(obj) {
  if (obj instanceof PyModule) {
    if (obj.native && MODULE_DIRS[obj.name]) return MODULE_DIRS[obj.name];
    return [...obj.attrs.keys()].filter((k) => !k.startsWith('_')).sort();
  }
  const t = obj instanceof PyType ? obj : typeOf(obj);
  if (TYPE_DIRS[t.name]) return TYPE_DIRS[t.name];
  if (t.isExc) return ['add_note', 'args', 'with_traceback'];
  return [];
}

// ===========================================================================
// 23. Lyosha's hints
// ===========================================================================

const HINTS = [
  ['SyntaxError', /^expected ':'/, "Lines that open a block (if, elif, else, for, while, def, try) end with a colon. Add ':' at the end of the line."],
  ['SyntaxError', /was never closed/, "You opened a bracket and never closed it. Count them, Rybka: every ( needs a ), every [ a ], every { a }."],
  ['SyntaxError', /^unmatched/, "There's a closing bracket with no partner. Delete it, or add the opening one you forgot."],
  ['SyntaxError', /does not match opening parenthesis/, "The brackets don't pair up: you opened one kind and closed with another."],
  ['SyntaxError', /^unterminated (triple-quoted )?(f-)?string/, "A string started but never ended. Every quote needs a matching partner on the same line: 'like this' or \"like this\"."],
  ['SyntaxError', /Maybe you meant '==' or ':=' instead of '='/, "One = puts a value into a name. To ask \"are these equal?\" use two: =="],
  ['SyntaxError', /Maybe you meant '==' instead of '='/, "The left side of = must be a name you're filling. If you wanted to compare, use ==."],
  ['SyntaxError', /^cannot (assign to|delete)/, "Only names (and things like my_list[0] or my_dict['key']) can go on the left of =."],
  ['SyntaxError', /illegal expression for augmented assignment/, "+= and friends need a plain name (or list[i], dict[key]) on the left."],
  ['SyntaxError', /Perhaps you forgot a comma/, "Two values are standing side by side with nothing between them. A comma is missing."],
  ['SyntaxError', /Missing parentheses in call to 'print'/, "That's old Python 2. In Python 3 print is a function: print(\"hello\")."],
  ['SyntaxError', /'return' outside function/, "return only works inside a def. Out here there's nobody to return to."],
  ['SyntaxError', /'break' outside loop|'continue' not properly in loop/, "break and continue only make sense inside a for or while loop."],
  ['SyntaxError', /invalid non-printable character/, "An invisible character sneaked in, probably from copy-paste. Delete the spaces around that spot and type them again."],
  ['SyntaxError', /invalid character/, "There's a symbol Python can't read: a curly quote or a fancy dash pasted from a document, maybe. Retype it with plain keyboard characters."],
  ['SyntaxError', /leading zeros/, "Python doesn't allow numbers like 08 or 007. Write 8 and 7. (Text like '007' is fine in quotes.)"],
  ['SyntaxError', /invalid (decimal|hexadecimal|octal|binary) literal|invalid digit/, "A number runs straight into letters. Names can't start with a digit, and numbers need a space or operator after them."],
  ['SyntaxError', /^f-string/, "Something inside the {curly braces} of your f-string isn't right. Each {} needs a real expression, like {name} or {total:.2f}."],
  ['SyntaxError', /positional argument follows keyword argument/, "Plain arguments go first, name=value arguments after them."],
  ['SyntaxError', /expected 'except' or 'finally' block/, "A try: block needs an except: block (or finally:) right after it."],
  ['SyntaxError', /expected 'else' after 'if' expression/, "An inline if needs an else: value_if_true if condition else value_if_false."],
  ['SyntaxError', /expected '\('/, "A def needs brackets after the function name, even when empty: def greet():"],
  ['SyntaxError', /duplicate argument/, "Two parameters have the same name. Give each one its own name."],
  ['SyntaxError', /parameter without a default follows/, "Parameters with default values (x=5) must come after the ones without."],
  ['SyntaxError', /':' expected after dictionary key/, "In a dictionary every key needs a colon and a value: {'key': value}."],
  ['SyntaxError', /global declaration|nonlocal/, "Put global (or nonlocal) on the first lines of the function, before you use the name."],
  ['SyntaxError', /./, "Python couldn't read this line. Look for a missing bracket, quote, colon or comma. Often the real mistake is just before where I'm pointing."],
  ['IndentationError', /expected an indented block/, "After a line that ends in ':', the next line must be indented (4 spaces). That's how Python knows what's inside the block."],
  ['IndentationError', /unexpected indent/, "This line is indented, but nothing above it opened a block. Line it up with the line before it."],
  ['IndentationError', /unindent does not match/, "This line's indentation doesn't line up with any block above. Use exactly 4 spaces per level, and line up lines that belong together."],
  ['TabError', /./, "Tabs and spaces got mixed in the indentation. Pick one (spaces, please) and use it everywhere."],
  ['NameError', /Did you forget to import/, "That name belongs to a module. Put import at the top first, or if it's your own variable, give it a value before you use it."],
  ['NameError', /Did you mean: '([^']*)'/, "Python doesn't know that name. Looks like a typo: compare your spelling with '$1'. Capitals count."],
  ['NameError', /free variable/, "The function uses a name from the outer function before it got a value. Give it a value first."],
  ['NameError', /./, "Python doesn't know that name yet. Did you spell it the same way both times? Capitals count: Total and total are strangers. And a name needs a value (name = ...) before you use it."],
  ['UnboundLocalError', /./, "Inside a function, assigning to a name makes it local to that function. Give it a value inside the function first, or pass it in as a parameter and return the result."],
  ['TypeError', /can only concatenate str/, "You can't glue text and a number with +. Convert first with str(n), or use an f-string: f\"Total: {n}\"."],
  ['TypeError', /unsupported operand type\(s\) for [^:]+: 'int' and 'str'|unsupported operand type\(s\) for [^:]+: 'str' and 'int'|unsupported operand type\(s\) for [^:]+: 'float' and 'str'/, "A number and some text don't add up. If the text holds a number, convert it with int(text). If you want text, use str(number)."],
  ['TypeError', /'NoneType'/, "One of the values is None. Usually that's a function that forgot to return something, or the result of .sort()/.append(), which change the list and return None."],
  ['TypeError', /unsupported operand type/, "Those two types don't mix with that operator. Check what each side really is; print(type(x)) will tell you."],
  ['TypeError', /object is not callable/, "You put ( ) after something that isn't a function. Did a variable steal a function's name? Like naming a list 'list' or a total 'sum'."],
  ['TypeError', /object is not subscriptable/, "Square brackets [ ] only work on lists, strings, tuples and dicts, not on this value."],
  ['TypeError', /cannot unpack non-iterable/, "You're splitting one value into several names, but it's a single thing. Check what's on the right of the =."],
  ['TypeError', /object is not iterable/, "A for loop needs something to walk through: a list, a string, range(n). A plain number won't do; try range(n)."],
  ['TypeError', /argument of type '\w+' is not iterable/, "'in' needs a container on the right: a list, a string or a dict."],
  ['TypeError', /'in <string>' requires string/, "To search inside a string, the thing you look for must be a string too: str(x) in text."],
  ['TypeError', /positional arguments? but \d+ (was|were) given|missing \d+ required|required keyword-only/, "The function got a different number of values than its def line asks for. Count the names between the brackets and compare."],
  ['TypeError', /unexpected keyword argument/, "That function has no parameter with that name. Check the spelling in its def line."],
  ['TypeError', /takes (no|exactly|at least|at most)|expected (at least |at most )?\d+ arguments?, got/, "Wrong number of values inside the brackets for this function. Check how many it needs."],
  ['TypeError', /not supported between instances of/, "You're comparing apples and fish, a number with text maybe. Convert one side with int() or str() first."],
  ['TypeError', /indices must be integers/, "Positions must be whole numbers. If it came from text, int() it; if it came from division, use // instead of /."],
  ['TypeError', /does not support item assignment/, "Strings and tuples can't be changed in place. Build a new one instead, like s = s[:i] + 'x' + s[i+1:]."],
  ['TypeError', /can't multiply sequence by non-int/, "You can only repeat text or a list a whole number of times. Convert with int() first."],
  ['TypeError', /unhashable type/, "Lists (and dicts, and sets) can't be dictionary keys or set items, because they can change. Use a string or a tuple instead."],
  ['TypeError', /expected str instance/, "join() only glues strings together. Convert the items first: ', '.join(str(x) for x in items)."],
  ['TypeError', /has no len\(\)/, "len() measures lists, strings and dicts, not a single number."],
  ['TypeError', /cannot be interpreted as an integer/, "This spot needs a whole number (an int), not a float. Use // instead of /, or wrap it in int()."],
  ['TypeError', /int\(\) argument must be|float\(\) argument must be/, "int() and float() can only convert numbers and number-text like '42'."],
  ['TypeError', /bad operand type/, "That operator doesn't work on that type of value."],
  ['TypeError', /./, "A value of the wrong type got in somewhere. The message says which types met; print(type(x)) helps you check."],
  ['ValueError', /invalid literal for int\(\)/, "int() can only read whole numbers written as text, like '42'. Check for spaces, letters or a decimal point (use float() for '3.5')."],
  ['ValueError', /could not convert string to float/, "float() needs text that looks like a number, like '3.5' or '12'."],
  ['ValueError', /too many values to unpack/, "There are more values on the right than names on the left of the =."],
  ['ValueError', /not enough values to unpack/, "There are fewer values on the right than names on the left of the =."],
  ['ValueError', /is not in list|x not in list|not in tuple|is not in range/, "That value isn't in there. Check with 'if x in my_list:' before asking for its position."],
  ['ValueError', /substring not found/, "That piece of text isn't in the string. .find() returns -1 instead of crashing, if that helps."],
  ['ValueError', /iterable argument is empty/, "You asked for the biggest or smallest of nothing: the list is empty."],
  ['ValueError', /math domain error|expected a positive input/, "That math isn't possible, like the square root of a negative number or the log of zero."],
  ['ValueError', /chr\(\) arg not in range/, "chr() needs a code between 0 and 1114111."],
  ['ValueError', /empty separator/, "split('') can't split on nothing. To get single characters, use list(text)."],
  ['ValueError', /Exceeds the limit/, "That number has more than 4300 digits. Even Baba Valya doesn't want to read it."],
  ['ValueError', /format/, "The format code doesn't fit this value. Check the part after the colon, like {price:.2f}."],
  ['ValueError', /./, "The value has the right type, but it isn't one Python can use here."],
  ['IndexError', /pop from empty list/, "The list is already empty. Nothing left to pop."],
  ['IndexError', /./, "You asked for a position past the end. Counting starts at 0, so the last item of a list of length n is at n - 1 (or just use [-1])."],
  ['KeyError', /./, "That key isn't in the dictionary. Check spelling and capitals, or use .get(key, default) to be safe."],
  ['ZeroDivisionError', /./, "Division by zero. Even Baba Valya can't do that. Check the number before you divide: if n != 0: ..."],
  ['AttributeError', /'NoneType' object has no attribute/, "This value is None. Usually that's a function that didn't return anything, or the result of .sort() or .append(), which return None."],
  ['AttributeError', /has no attribute 'push'/, "Python lists use .append(), not .push(). That's JavaScript talking, Rybka."],
  ['AttributeError', /has no attribute 'length'/, "In Python it's len(x), not x.length."],
  ['AttributeError', /has no attribute '(toUpperCase|toLowerCase)'/, "In Python it's .upper() and .lower()."],
  ['AttributeError', /Did you mean: '([^']*)'/, "No such method here. I think you meant .$1"],
  ['AttributeError', /^module/, "That module doesn't have that name. Check the spelling."],
  ['AttributeError', /./, "That kind of value doesn't have that method. Check the spelling, and check what type the value really is with type(x)."],
  ['RecursionError', /./, "The function keeps calling itself and never stops. Every recursive function needs a base case that returns without calling itself again."],
  ['TimeoutError', /./, "The program never finished, probably a loop whose condition never becomes False. Make sure something inside the loop moves it toward the exit."],
  ['AssertionError', /./, "An assert checked something and it was False. Read the condition: what did you expect, and what did you actually get?"],
  ['RuntimeError', /changed size during iteration/, "Don't add or remove keys while looping over a dictionary. Loop over list(d) instead."],
  ['EOFError', /./, "There's no keyboard on this mission, so input() can't work. Put the value straight into a variable instead."],
  ['MemoryError', /./, "That's too big for this laptop. Lyosha bought it used in 2011. Try something smaller."],
  ['OverflowError', /./, "That number is too big to fit. Try smaller numbers, or ints instead of floats."],
  ['ModuleNotFoundError', /./, "That module isn't installed on this laptop. Night School has math, random, string, time and sys."],
  ['ImportError', /./, "That name isn't in the module. Check the spelling."],
  ['StopIteration', /./, "The iterator ran out of items. next(it, default) gives a default instead of crashing."],
  ['NotImplementedError', /not supported in Night School/, "Night School's Python skips this feature. There's always another way, usually a plain function and a loop."],
  ['SystemError', /internal interpreter error/, "That's my bug, not yours, Rybka. Tell Lyosha which line did it."],
];
function makeHint(type, message) {
  for (const [t, re, text] of HINTS) {
    if (t !== type) continue;
    const m = re.exec(message);
    if (m) return text.replace('$1', m[1] || '');
  }
  return "Read the last line of the error: it says what went wrong. The line number says where. Fix the first error first.";
}

// ===========================================================================
// 24. JS <-> Python conversion
// ===========================================================================

function isPyObject(v) { return v.cls instanceof PyType; }
function setProp(o, k, v) {
  if (k === '__proto__') Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
  else o[k] = v;
}

export function toPy(v, vm = CUR) {
  switch (typeof v) {
    case 'number':
      if (Number.isInteger(v)) return (v <= MAX_SAFE && v >= -MAX_SAFE) ? v + 0 : BigInt(v);
      return F(v);
    case 'bigint': return normBig(v);
    case 'string': case 'boolean': return v;
    case 'undefined': return null;
    case 'function': {
      const fn = v;
      return new PyBuiltin(fn.name || 'native', (args) => toPy(fn(...args.map((a) => toJS(a, vm))), vm), undefined, null);
    }
    case 'object': {
      if (v === null) return null;
      if (Array.isArray(v)) return v.map((x) => toPy(x, vm));
      if (isPyObject(v)) return v;
      if (v instanceof Map) { const d = new PyDict(); for (const [k, x] of v) d.set(toPy(k, vm), toPy(x, vm)); return d; }
      if (v instanceof Set) { const s = new PySet(); for (const x of v) s.add(toPy(x, vm)); return s; }
      if (v instanceof Date) return F(v.getTime() / 1000);
      const d = new PyDict();
      for (const k of Object.keys(v)) d.set(k, toPy(v[k], vm));
      return d;
    }
  }
  return null;
}

export function toJS(v, vm = CUR) {
  switch (typeof v) {
    case 'number': case 'string': case 'boolean': return v;
    case 'bigint': return v;
  }
  if (v === null || v === undefined) return null;
  if (v instanceof PyFloat) return v.v;
  if (Array.isArray(v)) return v.map((x) => toJS(x, vm));
  if (v instanceof PyTuple) return v.items.map((x) => toJS(x, vm));
  if (v instanceof PyDict) {
    const entries = v.entries();
    if (entries.every((e) => typeof e[0] === 'string')) {
      const o = {};
      for (const e of entries) setProp(o, e[0], toJS(e[1], vm));
      return o;
    }
    const m = new Map();
    for (const e of entries) m.set(toJS(e[0], vm), toJS(e[1], vm));
    return m;
  }
  if (v instanceof PySet) return new Set(v.vals().map((x) => toJS(x, vm)));
  if (v instanceof PyRange) { const out = []; for (let i = 0, x = v.start; i < v.len && i < MAX_SEQ; i++, x += v.step) out.push(x); return out; }
  if (v instanceof PyDictView) {
    const items = v.kind === 'keys' ? v.d.keys() : v.kind === 'values' ? v.d.vals() : v.d.entries().map((e) => [e[0], e[1]]);
    return items.map((x) => toJS(x, vm));
  }
  if (v instanceof PyFunction || v instanceof PyBuiltin) {
    const owner = (v instanceof PyFunction && v.spec.vm) || vm;
    const f = v;
    return (...args) => {
      const prev = CUR;
      CUR = owner;
      try { return toJS(callValue(f, args.map((a) => toPy(a, owner)), null), owner); }
      catch (e) {
        const pe = jsToPyExc(e);
        const err = new Error(`${pe.cls.name}: ${excStr(pe)}`);
        err.pyError = owner ? owner.errorInfo(pe) : null;
        throw err;
      } finally { CUR = prev; }
    };
  }
  if (v instanceof PyException) return { type: v.cls.name, message: excStr(v) };
  if (v instanceof PyType) return v.name;
  if (v instanceof PyModule) return v.name;
  if (v instanceof PyIterator) {
    const out = [];
    for (let n = 0; n < MAX_SEQ; n++) { const x = v.next(); if (x === STOP) break; out.push(toJS(x, vm)); }
    return out;
  }
  return repr(v);
}

/** Python repr() of a JS value, e.g. pyRepr(['a', 1.5]) -> "['a', 1.5]" */
export function pyRepr(v) { return repr(toPy(v)); }
/** Wrap a JS number so it stays a Python float even when it is whole (toPy(2) would be int 2). */
export function pyFloat(x) { return new PyFloat(Number(x)); }

// ===========================================================================
// 25. The VM
// ===========================================================================

export class PyVM {
  /**
   * @param {object} opts
   *   maxSteps (500000)   statements/iterations before TimeoutError
   *   maxDepth (150)      Python call depth before RecursionError
   *   onPrint(line)       called once per finished output line (no trailing '\n')
   *   input               array of strings or function(prompt) -> string, feeds input(); default: input() raises EOFError
   *   seed                seed for the random module (deterministic by default)
   *   maxOutputLines      (10000) lines kept in result.output
   */
  constructor(opts = {}) {
    this.maxSteps = opts.maxSteps ?? 500000;
    this.maxDepth = opts.maxDepth ?? 150;
    this.onPrint = typeof opts.onPrint === 'function' ? opts.onPrint : null;
    this.maxOutputLines = opts.maxOutputLines ?? 10000;
    this.seed = opts.seed ?? 20251122;
    if (typeof opts.input === 'function') this.inputFn = opts.input;
    else if (Array.isArray(opts.input)) { const q = opts.input.slice(); this.inputFn = () => (q.length ? q.shift() : null); }
    else this.inputFn = null;
    this.globals = new Map();
    this.modules = new Map();
    this.hostModules = new Map();
    this.steps = 0;
    this.depth = 0;
    this.handling = [];
    this.out = [];
    this.partial = '';
    this.stdoutText = '';
    this.truncated = false;
    this.moduleFrame = { v: [], up: null, ret: null };
    this.cell('__name__').v = '__main__';
    this.cell('__doc__').v = null;
  }

  cell(name) {
    let c = this.globals.get(name);
    if (c === undefined) { c = { v: undefined }; this.globals.set(name, c); }
    return c;
  }

  timeoutError(node, where) {
    const e = exc('TimeoutError', TIMEOUT_MSG);
    e.fatal = true;
    if (node) setLoc(e, node, where);
    return e;
  }

  write(s) {
    if (!s) return;
    if (this.stdoutText.length < 4000000) this.stdoutText += s;
    const parts = (this.partial + s).split('\n');
    this.partial = parts.pop();
    for (const line of parts) this.emitLine(line);
  }
  emitLine(line) {
    if (this.out.length >= this.maxOutputLines) { this.truncated = true; return; }
    this.out.push(line);
    if (this.onPrint) { try { this.onPrint(line); } catch (e) { /* host errors are not the player's problem */ } }
  }
  flush() { if (this.partial) { const p = this.partial; this.partial = ''; this.emitLine(p); } }

  importModule(name) {
    let m = this.modules.get(name) || this.hostModules.get(name);
    if (m) return m;
    const make = MODULE_MAKERS[name];
    if (!make) {
      const e = exc('ModuleNotFoundError', `No module named '${name}'`);
      e.modName = name;
      throw e;
    }
    m = make(this);
    this.modules.set(name, m);
    return m;
  }

  _run(body) {
    if (this.running) {
      const e = exc('RuntimeError', 'this PyVM is already running (load/call cannot be nested inside a native)');
      return { ok: false, error: this.errorInfo(e), value: undefined, output: [], stdout: '', steps: 0 };
    }
    this.running = true;
    const prev = CUR;
    CUR = this;
    this.steps = 0;
    this.depth = 0;
    this.handling = [];
    this.out = [];
    this.partial = '';
    this.stdoutText = '';
    this.truncated = false;
    let error = null, value;
    try { value = body(); } catch (e) { error = e; } finally { this.flush(); CUR = prev; this.running = false; }
    const base = { output: this.out, stdout: this.stdoutText, steps: this.steps };
    if (this.truncated) base.truncated = true;
    if (error !== null) {
      const pe = jsToPyExc(error);
      if (pe.cls === EXC.SystemExit) {
        const code = pe.args.length ? pe.args[0] : null;
        if (code === null || code === 0) return { ok: true, error: null, value: undefined, ...base };
      }
      return { ok: false, error: this.errorInfo(pe), value: undefined, ...base };
    }
    return { ok: true, error: null, value, ...base };
  }

  /** Parse and run top-level code. Returns { ok, output, error } (+ stdout, steps). */
  load(source) {
    const r = this._run(() => {
      const fn = compileSource(this, source);
      fn(this.moduleFrame);
    });
    delete r.value;
    return r;
  }

  /** Call a Python function defined by load(). Args are JS values. Returns { ok, value, output, error }. */
  call(name, args = []) {
    return this._run(() => {
      const c = this.globals.get(name);
      if (!c || c.v === undefined) throw exc('NameError', `name '${name}' is not defined`);
      const res = callValue(c.v, args.map((a) => toPy(a, this)), null);
      return toJS(res, this);
    });
  }

  has(name) { const c = this.globals.get(name); return !!c && c.v !== undefined; }
  get(name) { const c = this.globals.get(name); return c && c.v !== undefined ? toJS(c.v, this) : undefined; }
  set(name, value) { this.cell(name).v = toPy(value, this); return this; }

  _native(name, fn, opts = {}, thisArg = undefined) {
    const vm = this;
    const params = opts.params || null;
    return new PyBuiltin(name.split('.').pop(), (args, kw) => {
      const jsArgs = args.map((a) => toJS(a, vm));
      if (kw) {
        for (const k in kw) {
          if (!params) throw TypeErr(`${name}() takes no keyword arguments`);
          const i = params.indexOf(k);
          if (i < 0) throw TypeErr(`${name}() got an unexpected keyword argument '${k}'`);
          if (i < args.length) throw TypeErr(`${name}() got multiple values for argument '${k}'`);
          jsArgs[i] = toJS(kw[k], vm);
        }
      }
      let r;
      try { r = fn.apply(thisArg, jsArgs); } catch (e) {
        if (e instanceof PyException) throw e;
        if (e && typeof e.pyType === 'string' && EXC[e.pyType]) throw exc(e.pyType, String(e.message ?? ''));
        throw exc('RuntimeError', String((e && e.message) || e));
      }
      return toPy(r, vm);
    }, undefined, opts.doc || null, name);
  }

  /**
   * Make a host function callable from Python. fn receives JS values and returns a JS value.
   * opts.doc: text shown by help(name); opts.params: parameter names so Python can pass keywords.
   * Throw an Error with .pyType = 'ValueError' (etc.) to raise that Python exception.
   */
  defineNative(name, fn, opts = {}) {
    this.cell(name).v = this._native(name, fn, opts);
    return this;
  }

  /**
   * Expose a host object as a module-like global: functions become methods (called with `this` = obj),
   * other values become attributes (converted once, now). Also importable: `import camera` just works.
   */
  defineModuleObject(name, obj, opts = {}) {
    const attrs = new Map();
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'function') attrs.set(k, this._native(`${name}.${k}`, v, { doc: opts.docs ? opts.docs[k] : null, params: opts.params ? opts.params[k] : null }, obj));
      else attrs.set(k, toPy(v, this));
    }
    if (opts.doc) attrs.set('__doc__', opts.doc);
    const m = new PyModule(name, attrs, false);
    this.hostModules.set(name, m);
    this.cell(name).v = m;
    return this;
  }

  /** Error object for the UI: { type, message, line, col, endLine, endCol, hint, trace } (line/col 1-based). */
  errorInfo(pe) {
    const type = pe.cls.name;
    let message = excStr(pe);
    try {
      if (pe.cls === EXC.NameError && pe.nameCtx) {
        const name = pe.nameCtx.name;
        const sug = suggest(name, nameCandidates(pe.nameCtx, this));
        if (sug) message += `. Did you mean: '${sug}'?`;
        if (STDLIB_NAMES.has(name)) message += sug ? ` Or did you forget to import '${name}'?` : `. Did you forget to import '${name}'?`;
      } else if (pe.cls === EXC.AttributeError && pe.attrName !== undefined) {
        const sug = pe.attrName.startsWith('_') ? null : suggest(pe.attrName, attrCandidates(pe.attrObj));
        if (sug) message += `. Did you mean: '${sug}'?`;
      } else if (pe.cls === EXC.ImportError && pe.importName) {
        const sug = suggest(pe.importName, attrCandidates(pe.importFrom));
        if (sug) message += `. Did you mean: '${sug}'?`;
      }
    } catch (e) { /* suggestions are best-effort */ }
    const info = {
      type,
      message,
      line: pe.line ?? null,
      col: pe.col ?? null,
      endLine: pe.eline ?? null,
      endCol: pe.ecol ?? null,
      hint: makeHint(type, message),
      text: message ? `${type}: ${message}` : type,
    };
    const trace = [];
    if (pe.line !== undefined) trace.push({ line: pe.line, where: pe.where || '<module>' });
    if (pe.trace) for (const t of pe.trace) trace.push({ line: t.line, where: t.where || '<module>' });
    if (trace.length > 1) info.trace = trace;
    if (pe.jsError) info.internal = String(pe.jsError && pe.jsError.stack || pe.jsError);
    return info;
  }
}

/** Convenience: new PyVM(opts).load(source) */
export function runPython(source, opts) { return new PyVM(opts).load(source); }
