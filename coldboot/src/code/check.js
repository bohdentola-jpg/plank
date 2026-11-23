// COLD BOOT — check.js
// Grades a player's Python against an exercise/challenge `check` from lessons.js / challenges.js.
//
//   import { checkExercise } from './check.js';
//   const res = checkExercise(exercise, playerSource, { natives, data, maxSteps });
//   res = { pass, message, output, error, cases }
//
// check kinds:
//   { kind: 'stdout', expected }            run the program, compare printed text
//                                           (trailing spaces / trailing blank lines ignored)
//   { kind: 'call', fn, cases: [{args, expect}] }
//                                           load the program in a fresh VM per case, call fn(*args),
//                                           compare the return value (floats within 1e-9, tuples == lists,
//                                           dict key order ignored)

import { PyVM, pyRepr } from './python.js';

const MAX_STEPS = 500000;

function normalizeOut(s) {
  return String(s ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
}

function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Map) && !(v instanceof Set); }

/** Deep comparison of an expected JS value with the JS value returned by PyVM.call. */
export function sameValue(want, got) {
  if (typeof want === 'number' && typeof got === 'number') {
    if (Number.isNaN(want) && Number.isNaN(got)) return true;
    if (want === got) return true;
    return Math.abs(want - got) <= 1e-9 * Math.max(1, Math.abs(want), Math.abs(got));
  }
  if (typeof want === 'bigint' || typeof got === 'bigint') {
    try { return BigInt(want) === BigInt(got); } catch { return false; }
  }
  if (Array.isArray(want)) {
    return Array.isArray(got) && want.length === got.length && want.every((w, i) => sameValue(w, got[i]));
  }
  if (want instanceof Set) {
    if (!(got instanceof Set) || got.size !== want.size) return false;
    for (const w of want) if (![...got].some((g) => sameValue(w, g))) return false;
    return true;
  }
  if (want instanceof Map || isPlainObject(want)) {
    const we = want instanceof Map ? [...want] : Object.entries(want);
    let ge;
    if (got instanceof Map) ge = [...got];
    else if (isPlainObject(got)) ge = Object.entries(got);
    else return false;
    if (we.length !== ge.length) return false;
    return we.every(([k, v]) => ge.some(([gk, gv]) => sameValue(k, gk) && sameValue(v, gv)));
  }
  return want === got;
}

function deepCopy(v) {
  if (Array.isArray(v)) return v.map(deepCopy);
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [deepCopy(k), deepCopy(x)]));
  if (v instanceof Set) return new Set([...v].map(deepCopy));
  if (isPlainObject(v)) { const o = {}; for (const k of Object.keys(v)) o[k] = deepCopy(v[k]); return o; }
  return v;
}

/** Python-looking text for a JS value, for messages like  unwrap(['#A', 'CB']) returned 'BC'. */
export function showValue(v) {
  try { return pyRepr(v); } catch { return String(v); }
}

function makeVM(opts) {
  const vm = new PyVM({ maxSteps: opts.maxSteps ?? MAX_STEPS, maxDepth: opts.maxDepth ?? 150, onPrint: opts.onPrint, input: opts.input });
  if (opts.natives) {
    for (const [name, fn] of Object.entries(opts.natives)) {
      if (typeof fn === 'function') vm.defineNative(name, fn);
      else if (fn && typeof fn === 'object') vm.defineModuleObject(name, fn);
    }
  }
  if (opts.data) for (const [name, value] of Object.entries(opts.data)) vm.set(name, deepCopy(value));
  return vm;
}

/**
 * Run `source` against `exercise.check`.
 * opts: { natives: {name: fn | {method: fn}}, data: {name: jsValue}, maxSteps, maxDepth, onPrint }
 * Returns { pass, message, output, error, cases? }.
 */
export function checkExercise(exercise, source, opts = {}) {
  const check = exercise.check;
  if (check.kind === 'stdout') {
    const vm = makeVM(opts);
    const r = vm.load(source);
    if (!r.ok) {
      return { pass: false, output: r.output, error: r.error, message: `${r.error.text} (line ${r.error.line ?? '?'})` };
    }
    const got = normalizeOut(r.stdout), want = normalizeOut(check.expected);
    if (got === want) return { pass: true, output: r.output, error: null, message: 'Output matches. Molodets!' };
    const gl = got.split('\n'), wl = want.split('\n');
    let i = 0;
    while (i < gl.length && i < wl.length && gl[i] === wl[i]) i++;
    let message;
    if (!got) message = 'Nothing was printed. Did you forget print()?';
    else if (i >= wl.length) message = `Too many lines: expected ${wl.length}, got ${gl.length}.`;
    else if (i >= gl.length) message = `Missing lines: expected ${wl.length}, got ${gl.length}. Next expected: ${wl[i]}`;
    else message = `Line ${i + 1} should be: ${wl[i]}\n          but was: ${gl[i]}`;
    return { pass: false, output: r.output, error: null, message, expected: check.expected };
  }

  if (check.kind === 'call') {
    const cases = [];
    let output = null;
    for (const c of check.cases) {
      const vm = makeVM(opts);
      const r = vm.load(source);
      if (output === null) output = r.output;
      if (!r.ok) return { pass: false, output, error: r.error, cases, message: `${r.error.text} (line ${r.error.line ?? '?'})` };
      if (!vm.has(check.fn)) {
        return { pass: false, output, error: null, cases, message: `Lyosha's test needs a function called ${check.fn}(...). Did you name it exactly that?` };
      }
      const res = vm.call(check.fn, deepCopy(c.args));
      const call = `${check.fn}(${c.args.map(showValue).join(', ')})`;
      if (!res.ok) {
        cases.push({ args: c.args, expect: c.expect, pass: false, error: res.error, output: res.output });
        return { pass: false, output, error: res.error, cases, message: `${call} crashed: ${res.error.text} (line ${res.error.line ?? '?'})` };
      }
      const ok = sameValue(c.expect, res.value);
      cases.push({ args: c.args, expect: c.expect, got: res.value, pass: ok, output: res.output });
      if (!ok) {
        const hint = res.value === null && c.expect !== null ? ' (None — did you print instead of return?)' : '';
        return { pass: false, output, error: null, cases, message: `${call} returned ${showValue(res.value)}${hint}, expected ${showValue(c.expect)}` };
      }
    }
    return { pass: true, output, error: null, cases, message: `All ${cases.length} tests passed. Molodets!` };
  }
  throw new Error(`unknown check kind: ${check.kind}`);
}
