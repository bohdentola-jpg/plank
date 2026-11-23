// Validates Lyosha's Night School (src/code/lessons.js) and the field hacks / finale (src/code/challenges.js):
//   - structure: ids, days, 3–5 pages of 40–120 words, 3 exercises per lesson, 3 hints each
//   - every page example runs in PyVM with no error and prints exactly what CPython prints
//   - every solution passes its own check; every starter does NOT pass
//   - every expected answer is confirmed by running the solution in real CPython
//   - challenges: natives are documented, and the "live" run works with stub natives + mission data
//
//   node tools/test_lessons.mjs [-v]

import { spawnSync } from 'node:child_process';
import { PyVM } from '../src/code/python.js';
import { LESSONS } from '../src/code/lessons.js';
import { CHALLENGES, CHALLENGE_ORDER, NATIVES } from '../src/code/challenges.js';
import { checkExercise, sameValue, showValue } from '../src/code/check.js';

const VERBOSE = process.argv.includes('-v');
let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; if (VERBOSE) console.log('✓', name); }
  else { fail++; failures.push(`✗ ${name}${detail ? '\n    ' + String(detail).split('\n').join('\n    ') : ''}`); }
}
const J = (v) => JSON.stringify(v);

function cpython(src) {
  const r = spawnSync('python3', ['-I', '-c', src], { encoding: 'utf8', input: '', timeout: 20000 });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

// Run the solution's function on every case in real CPython and return the JSON results.
function cpythonCall(solution, fn, cases) {
  const payload = JSON.stringify(cases.map((c) => c.args));
  const src = `${solution}\nimport json as __json\n__cases = __json.loads(r'''${payload}''')\nprint(__json.dumps([${fn}(*__a) for __a in __cases]))\n`;
  const r = cpython(src);
  if (r.status !== 0) return { error: r.stderr };
  return { values: JSON.parse(r.stdout) };
}

const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;

// Stub natives: dotted names become module objects (camera.feed -> camera = { feed }).
function stubNatives(names, received, data = {}) {
  const out = {};
  const behave = {
    report: (v) => { received.push(['report', v]); return null; },
    'camera.feed': () => ['Bering St 02:58 empty', 'Bering St 02:59 empty', 'Bering St 03:00 PERSON at cabin door', 'Bering St 03:01 PERSON at cabin door', 'Bering St 03:02 empty', 'Bering St 03:03 PERSON walking', 'Bering St 03:04 fox'],
    'camera.loop': (frames) => { received.push(['camera.loop', frames]); return frames.length; },
    submit: (names) => { received.push(['submit', names]); return names.length; },
    publish: (ev) => { received.push(['publish', ev]); return null; },
    'vault.insert_key': (key) => { received.push(['vault.insert_key', key]); return key === 'C0DE9F31B7E2'; },
    'vault.screen': () => 'EXXC7\\RN-7SE^AR7U;7D[XC7%',
    send: (code) => { received.push(['send', code]); return 'TRANSMITTED'; },
  };
  for (const n of names) {
    const fn = behave[n] || (() => null);
    if (n.includes('.')) {
      const [mod, attr] = n.split('.');
      (out[mod] ||= {})[attr] = fn;
    } else out[n] = fn;
  }
  void data;
  return out;
}

function checkExerciseShape(where, ex) {
  ok(`${where} has id/prompt/starter/solution`, typeof ex.id === 'string' && typeof ex.prompt === 'string' && ex.prompt.length > 20 && typeof ex.starter === 'string' && typeof ex.solution === 'string');
  ok(`${where} has 3 hints`, Array.isArray(ex.hints) && ex.hints.length === 3 && ex.hints.every((h) => typeof h === 'string' && h.length > 5), J(ex.hints));
  const c = ex.check;
  ok(`${where} check shape`, c && ((c.kind === 'stdout' && typeof c.expected === 'string') || (c.kind === 'call' && typeof c.fn === 'string' && Array.isArray(c.cases) && c.cases.length >= 1)), J(c));
}

function verifyExercise(where, ex, opts = {}) {
  checkExerciseShape(where, ex);
  // solution passes, starter fails
  const good = checkExercise(ex, ex.solution, opts);
  ok(`${where} solution passes`, good.pass, `${good.message}${good.error && good.error.internal ? '\n' + good.error.internal : ''}`);
  const bad = checkExercise(ex, ex.starter, opts);
  ok(`${where} starter does not pass`, !bad.pass, bad.message);
  if (VERBOSE && !bad.pass) console.log(`    starter → ${bad.message.split('\n')[0]}`);
  // cross-check the expected answers against CPython
  if (ex.check.kind === 'stdout') {
    const r = cpython(ex.solution);
    const norm = (s) => s.replace(/\s+$/, '').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n');
    ok(`${where} expected output confirmed by CPython`, r.status === 0 && norm(r.stdout) === norm(ex.check.expected), `CPython: ${J(r.stdout)} ${r.stderr}\nexpected: ${J(ex.check.expected)}`);
  } else {
    const r = cpythonCall(ex.solution, ex.check.fn, ex.check.cases);
    const same = !r.error && r.values.length === ex.check.cases.length && ex.check.cases.every((c, i) => sameValue(c.expect, r.values[i]));
    ok(`${where} expected values confirmed by CPython`, same, r.error || `CPython: ${J(r.values)}\nexpected: ${J(ex.check.cases.map((c) => c.expect))}`);
  }
  // the bare hint #3 should be close to real code: it must at least parse when it looks like a def
  const h3 = ex.hints[2];
  if (/^def /.test(h3)) {
    const vm = new PyVM();
    const r = vm.load(h3);
    ok(`${where} hint 3 is valid Python`, r.ok, r.error && r.error.text);
  }
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------
ok('14 lessons', LESSONS.length === 14, LESSONS.length);
const ids = new Set();
LESSONS.forEach((L, i) => {
  const where = L.id;
  ok(`${where} id/day`, L.id === `l${String(i + 1).padStart(2, '0')}` && L.day === i + 1, J({ id: L.id, day: L.day }));
  ok(`${where} title`, typeof L.title === 'string' && L.title.length > 3);
  ok(`${where} ru line`, L.ru && /[А-Яа-яЁё]/.test(L.ru.line) && typeof L.ru.en === 'string' && L.ru.en.length > 10, J(L.ru));
  ok(`${where} ru line is one sentence`, !/[.!?…]\s+[А-ЯЁA-Z]/.test(L.ru.line) && L.ru.line.length < 140, L.ru.line);
  ok(`${where} 3–5 pages`, L.pages.length >= 3 && L.pages.length <= 5, L.pages.length);
  L.pages.forEach((p, j) => {
    const n = words(p.text);
    ok(`${where} page ${j + 1} is 40–120 words`, n >= 40 && n <= 120, `${n} words: ${p.text.slice(0, 60)}…`);
    if (p.code) {
      const vm = new PyVM();
      const r = vm.load(p.code);
      ok(`${where} page ${j + 1} example runs`, r.ok, r.error && `${r.error.text} line ${r.error.line}\n${p.code}`);
      const py = cpython(p.code);
      ok(`${where} page ${j + 1} example output matches CPython`, py.status === 0 && py.stdout === r.stdout, `CPython:\n${py.stdout}${py.stderr}\nPyVM:\n${r.stdout}`);
    }
  });
  ok(`${where} has 3 exercises`, L.exercises.length === 3, L.exercises.length);
  L.exercises.forEach((ex, j) => {
    ok(`${where} exercise id`, ex.id === `${L.id}e${j + 1}` && !ids.has(ex.id), ex.id);
    ids.add(ex.id);
    verifyExercise(`${where}/${ex.id}`, ex);
  });
});

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------
const LIVE_EXPECT = {
  faces: [['report', 4]],
  keypad: [['report', '4471']],
  camloop: [['camera.loop', ['Bering St 02:58 empty', 'Bering St 02:59 empty', 'Bering St 02:59 empty', 'Bering St 02:59 empty', 'Bering St 03:02 empty', 'Bering St 03:02 empty', 'Bering St 03:04 fox']]],
  petition: [['submit', ['Dolly Finch', 'Father Gabriel Popov', 'Hank Brubaker', 'Lou Amarok', 'Nina Kowalczyk', 'Pearl Jessup', 'Ruth Aqpik', 'Sasha Koshkin', 'Tommy Aqpik', 'Wade Tolliver']]],
  ledger: [['publish', { 'Lyle Pruitt': 19500, 'Walt Hennessey': 25000, 'Gideon Shaw': 4100 }]],
  shares: [['vault.insert_key', 'C0DE9F31B7E2']],
  vault: [],
  final: [['send', 'AURORA-ABORT-0415']],
};
const REQUIRED = ['faces', 'keypad', 'camloop', 'petition', 'ledger', 'shares', 'vault', 'final'];
ok('all challenges present', REQUIRED.every((k) => CHALLENGES[k]) && J(CHALLENGE_ORDER) === J(REQUIRED), J(Object.keys(CHALLENGES)));
for (const id of Object.keys(CHALLENGES)) {
  const ch = CHALLENGES[id];
  const where = `challenge ${id}`;
  ok(`${where} fields`, ch.id === id && Number.isInteger(ch.day) && typeof ch.title === 'string' && typeof ch.briefing === 'string' && ch.briefing.length > 80 && (ch.timeLimit === null || ch.timeLimit > 0) && Array.isArray(ch.natives) && typeof ch.live === 'string', J({ id: ch.id, day: ch.day, timeLimit: ch.timeLimit }));
  ok(`${where} natives documented`, ch.natives.every((n) => NATIVES[n] && NATIVES[n].call && NATIVES[n].doc), J(ch.natives));
  const received = [];
  const natives = stubNatives(ch.natives, received);
  verifyExercise(where, ch, { natives, data: ch.data });
  // live run: natives + mission data + the player's code + the game's live line
  received.length = 0;
  const vm = new PyVM();
  for (const [name, fn] of Object.entries(natives)) {
    if (typeof fn === 'function') vm.defineNative(name, fn); else vm.defineModuleObject(name, fn);
  }
  for (const [k, v] of Object.entries(ch.data || {})) vm.set(k, v);
  const r1 = vm.load(ch.solution);
  const r2 = vm.load(ch.live);
  ok(`${where} live run`, r1.ok && r2.ok, (r1.error || r2.error || {}).text);
  ok(`${where} live run reached the world`, J(received) === J(LIVE_EXPECT[id]) || (LIVE_EXPECT[id].length && sameValue(LIVE_EXPECT[id], received)), `got ${J(received)}\nwant ${J(LIVE_EXPECT[id])}`);
  if (id === 'vault') ok(`${where} live decode printed`, r2.output[0] === 'ROOT KEY: DRIVE B, SLOT 2', J(r2.output));
}
ok('final has a 10-minute clock and 4 cases', CHALLENGES.final.timeLimit === 600 && CHALLENGES.final.check.cases.length === 4);
ok('final cases include no-decoy and all-but-one-decoy', CHALLENGES.final.check.cases.some((c) => c.args[0].every((s) => !s.startsWith('#'))) && CHALLENGES.final.check.cases.some((c) => c.args[0].filter((s) => !s.startsWith('#')).length === 1));
ok('lesson 14 rehearses the finale shape', LESSONS[13].exercises[2].check.fn === CHALLENGES.final.check.fn);

// a wrong finale answer gets a helpful message
{
  const wrong = 'def unwrap(shards):\n    joined = ""\n    for s in shards:\n        joined += s[::-1]\n    return joined\n';
  const r = checkExercise(CHALLENGES.final, wrong);
  ok('finale wrong answer message', !r.pass && /unwrap\(\['#NORTHSTAR'/.test(r.message) && /expected 'WORMWOOD-HALT-4471'/.test(r.message), r.message);
  const printer = 'def unwrap(shards):\n    print("hi")\n';
  const r2 = checkExercise(CHALLENGES.final, printer);
  ok('finale print-instead-of-return message', !r2.pass && /did you print instead of return/.test(r2.message), r2.message);
  const syntax = 'def unwrap(shards)\n    return ""\n';
  const r3 = checkExercise(CHALLENGES.final, syntax);
  ok('finale syntax error message', !r3.pass && r3.error && r3.error.type === 'SyntaxError' && r3.error.line === 1, r3.message);
  ok('showValue', showValue(['#A', 1.5, null]) === "['#A', 1.5, None]");
}

for (const f of failures) console.log(f);
console.log(`lessons+challenges: ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
