// boxscript language tests — run with: node game/tests/boxscript.test.mjs
import { compile, ScriptInstance, num, display, truthy } from '../js/boxscript.js';
import assert from 'node:assert';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + (e && e.message || e)); }
}

// A fake 3D world: one object at the origin, a player at (50, 0, 20).
function makeHost() {
  const calls = [];
  const shared = new Map();
  const state = {
    x: 0, y: 0, z: 0, yaw: 0, size: 100,
    visible: true, flags: {}, colorV: 'gray', errors: [], spin: 0,
  };
  return {
    calls, shared, state,
    getProp: p => state[p],
    setProp: (p, v) => { state[p] = v; },
    getName: () => 'thing',
    move: (dx, dy, dz) => { state.x += dx; state.y += dy; state.z += dz; calls.push(['move', dx, dy, dz]); },
    moveLocal: (f, s, u) => {
      const r = state.yaw * Math.PI / 180;
      state.x += Math.sin(r) * f + Math.cos(r) * s;
      state.z += -Math.cos(r) * f + Math.sin(r) * s;
      state.y += u;
      calls.push(['moveLocal', f, s, u]);
    },
    turn: d => { state.yaw = (state.yaw + d) % 360; calls.push(['turn', d]); },
    setYaw: d => { state.yaw = d; },
    faceTarget: w => calls.push(['faceTarget', w]),
    facePoint: (x, z) => calls.push(['facePoint', x, z]),
    say: (t, s) => calls.push(['say', t, s]),
    write: (t, x, y, sz, id) => calls.push(['write', t, x, y, sz, id]),
    unwrite: id => calls.push(['unwrite', id]),
    button: (l, x, y) => calls.push(['button', l, x, y]),
    removeButton: l => calls.push(['removeButton', l]),
    show: v => { state.visible = v; },
    flag: (n, v) => { state.flags[n] = v; },
    color: c => { state.colorV = c; },
    grow: a => { state.size += a; },
    spin: a => { state.spin = a; },
    spawn: (m, x, y, z) => calls.push(['spawn', m, x, y, z]),
    vanish: () => calls.push(['vanish']),
    push: (dx, dy, dz) => calls.push(['push', dx, dy, dz]),
    pushLocal: (f, s, u) => calls.push(['pushLocal', f, s, u]),
    teleportPlayer: (x, y, z) => calls.push(['teleportPlayer', x, y, z]),
    sound: n => calls.push(['sound', n]),
    broadcast: (m, e) => calls.push(['broadcast', m, e]),
    freeze: v => calls.push(['freeze', v]),
    shake: a => calls.push(['shake', a]),
    playerProp: p => ({ x: 50, y: 0, z: 20, yaw: 90, name: 'tester' })[p],
    mouse: p => (p === 'x' ? 10 : 5),
    keyDown: k => k === 'e',
    touching: w => w === 'player',
    distanceToPlayer: () => 42,
    distanceToModel: m => m === 'tree' ? 7 : 999,
    count: m => m === 'box' ? 3 : 0,
    time: () => 99,
    biome: () => 'volcano',
    heightAt: (x, z) => x + z,
    sharedGet: n => shared.get(n),
    sharedSet: (n, v) => shared.set(n, v),
    onError: (line, msg) => state.errors.push({ line, msg }),
  };
}

function run(src, opts = {}) {
  const c = compile(src);
  if (!c.ok && !opts.allowErrors) {
    throw new Error('compile errors: ' + c.errors.map(e => `L${e.line}: ${e.msg}`).join(' | '));
  }
  const host = makeHost();
  const inst = new ScriptInstance(c.program, host);
  inst.start();
  const dt = opts.dt ?? 1 / 30;
  let now = 0;
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { inst.update(now); now += dt; } };
  tick(opts.frames ?? 1);
  return { host, inst, compileResult: c, tick, said: () => host.calls.filter(c => c[0] === 'say').map(c => c[1]) };
}

// =============================================================== parsing
test('empty and comment-only scripts compile', () => {
  assert.ok(compile('').ok);
  assert.ok(compile('# hi\n// also a comment\n\n').ok);
});

test('unknown command names the culprit and the line', () => {
  const c = compile('when start\n  say "ok"\n  explode\nend');
  assert.ok(!c.ok);
  assert.strictEqual(c.errors[0].line, 3);
  assert.match(c.errors[0].msg, /explode/);
});

test('missing end is reported', () => {
  const c = compile('when start\n  say "hi"');
  assert.ok(!c.ok);
  assert.match(c.errors[0].msg, /end/);
});

test('smart quotes work', () => {
  assert.ok(compile('when start\n  say “hello”\nend').ok);
});

test('reserved words rejected as variable names', () => {
  const c = compile('when start\n  set time to 5\nend');
  assert.ok(!c.ok);
  assert.match(c.errors[0].msg, /boxscript word/);
});

test('chat keys rejected in when key', () => {
  const c = compile('when key t\n  say "no"\nend');
  assert.ok(!c.ok);
  assert.match(c.errors[0].msg, /used by the game/);
});

test('parser recovers and reports several errors', () => {
  const c = compile('when start\n  blorp\n  frobnicate 3\n  say "fine"\nend');
  assert.ok(!c.ok);
  assert.ok(c.errors.length >= 2, 'expected 2+ errors, got ' + c.errors.length);
});

test('unterminated block does not hang', () => {
  const c = compile('when start\n  repeat 3\n    say "x"\nend');
  assert.ok(c.errors.length >= 1);
});

// =============================================================== variables
test('set / change / read', () => {
  const r = run('when start\n  set score to 3\n  change score by 4\n  say score\nend');
  assert.deepStrictEqual(r.said(), ['7']);
});

test('unset variables read as 0', () => {
  assert.deepStrictEqual(run('when start\n  say mystery + 1\nend').said(), ['1']);
});

test('shared variables go through the host', () => {
  const r = run('when start\n  set shared score to 10\n  change shared score by 5\n  say shared score\nend');
  assert.strictEqual(r.host.shared.get('score'), 15);
  assert.deepStrictEqual(r.said(), ['15']);
});

test('set my x / y / z / yaw / size', () => {
  const r = run('when start\n  set my x to 5\n  set my y to 6\n  set my z to 7\n  set my yaw to 90\n  set my size to 150\nend');
  const s = r.host.state;
  assert.deepStrictEqual([s.x, s.y, s.z, s.yaw, s.size], [5, 6, 7, 90, 150]);
});

test('change my y by N', () => {
  const r = run('when start\n  set my y to 10\n  change my y by -4\n  say my y\nend');
  assert.deepStrictEqual(r.said(), ['6']);
});

// =============================================================== lists
test('list literal, length, item', () => {
  const r = run('when start\n  set l to list 10, 20, 30\n  say length of l\n  say item 2 of l\nend');
  assert.deepStrictEqual(r.said(), ['3', '20']);
});

test('bracket list literal', () => {
  assert.deepStrictEqual(run('when start\n  set l to [1, 2, 3]\n  say item 3 of l\nend').said(), ['3']);
});

test('empty list then add', () => {
  const r = run('when start\n  set l to list\n  add "a" to l\n  add "b" to l\n  say length of l\n  say item 1 of l\nend');
  assert.deepStrictEqual(r.said(), ['2', 'a']);
});

test('add to an unset name auto-creates the list', () => {
  assert.deepStrictEqual(run('when start\n  add 5 to bag\n  say length of bag\nend').said(), ['1']);
});

test('set item N of list to V', () => {
  const r = run('when start\n  set l to list 1, 2, 3\n  set item 2 of l to 99\n  say l\nend');
  assert.deepStrictEqual(r.said(), ['1, 99, 3']);
});

test('insert / remove item / remove all', () => {
  const r = run([
    'when start',
    '  set l to list 1, 2, 3',
    '  insert 0 at 1 in l',
    '  say l',
    '  remove item 2 of l',
    '  say l',
    '  remove all of l',
    '  say length of l',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['0, 1, 2, 3', '0, 2, 3', '0']);
});

test('nested lists (a grid)', () => {
  const r = run([
    'when start',
    '  set grid to list',
    '  repeat with row from 1 to 3',
    '    set line to list',
    '    repeat with col from 1 to 3',
    '      add row * col to line',
    '    end',
    '    add line to grid',
    '  end',
    '  say item 2 of item 3 of grid',
    '  set item 1 of item 1 of grid to "X"',
    '  say item 1 of item 1 of grid',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['6', 'X']);
});

test('contains / index of', () => {
  const r = run([
    'when start',
    '  set l to list "a", "b", "c"',
    '  if l contains "b" then',
    '    say "yes"',
    '  end',
    '  say index of "c" in l',
    '  say index of "zz" in l',
    '  if "hello" contains "ell" then',
    '    say "substring"',
    '  end',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['yes', '3', '0', 'substring']);
});

test('join with separator', () => {
  const r = run('when start\n  set l to list "a", "b"\n  say join l with "-"\nend');
  assert.deepStrictEqual(r.said(), ['a-b']);
});

test('out-of-range item reads empty, writing errors', () => {
  const r = run('when start\n  set l to list 1\n  say item 9 of l\nend');
  assert.deepStrictEqual(r.said(), ['']);
  const r2 = run('when start\n  set l to list 1\n  set item 9 of l to 2\nend');
  assert.ok(r2.host.state.errors.length === 1, JSON.stringify(r2.host.state.errors));
  assert.match(r2.host.state.errors[0].msg, /no item 9/);
});

test('list + list concatenates', () => {
  const r = run('when start\n  say (list 1, 2) + (list 3)\nend');
  assert.deepStrictEqual(r.said(), ['1, 2, 3']);
});

// =============================================================== functions
test('function with a parameter', () => {
  const r = run('to greet with who\n  say "hi " + who\nend\nwhen start\n  greet with "world"\nend');
  assert.deepStrictEqual(r.said(), ['hi world']);
});

test('function with two parameters and a return value', () => {
  const r = run('to add2 with a, b\n  return a + b\nend\nwhen start\n  say add2 with 3, 4\nend');
  assert.deepStrictEqual(r.said(), ['7']);
});

test('parenthesized call syntax also works', () => {
  const r = run('to double with n\n  return n * 2\nend\nwhen start\n  say double(21)\nend');
  assert.deepStrictEqual(r.said(), ['42']);
});

test('zero-parameter function as a value', () => {
  const r = run('to answer\n  return 42\nend\nwhen start\n  say answer\nend');
  assert.deepStrictEqual(r.said(), ['42']);
});

test('calls may appear before the definition', () => {
  const r = run('when start\n  shout\nend\nto shout\n  say "later"\nend');
  assert.deepStrictEqual(r.said(), ['later']);
});

test('recursion: factorial', () => {
  const r = run([
    'to fact with n',
    '  if n <= 1 then',
    '    return 1',
    '  end',
    '  return n * fact(n - 1)',
    'end',
    'when start',
    '  say fact(6)',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['720']);
});

test('recursion: fibonacci (nested calls in one expression)', () => {
  const r = run([
    'to fib with n',
    '  if n < 2 then',
    '    return n',
    '  end',
    '  return fib(n - 1) + fib(n - 2)',
    'end',
    'when start',
    '  say fib(12)',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['144']);
});

test('runaway recursion errors instead of blowing the stack', () => {
  const r = run('to loopy with n\n  return loopy(n + 1)\nend\nwhen start\n  say loopy(1)\nend');
  assert.strictEqual(r.host.state.errors.length, 1);
  assert.match(r.host.state.errors[0].msg, /too many times/);
});

test('parameters are local: recursion does not clobber the caller', () => {
  const r = run([
    'to countdown with n',
    '  if n > 0 then',
    '    say n',
    '    countdown with n - 1',
    '    say "back at " + n',
    '  end',
    'end',
    'when start',
    '  countdown with 3',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['3', '2', '1', 'back at 1', 'back at 2', 'back at 3']);
});

test('local declares a local; set writes the object variable', () => {
  const r = run([
    'to bump',
    '  local tmp to 5',
    '  set score to score + tmp',
    'end',
    'when start',
    '  set score to 1',
    '  bump',
    '  say score',
    '  say tmp',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['6', '0']);   // tmp did not leak out
});

test('functions can wait, and callers wait with them', () => {
  const r = run([
    'to slow',
    '  say "a"',
    '  wait 0.5',
    '  say "b"',
    'end',
    'when start',
    '  slow',
    '  say "c"',
    'end',
  ].join('\n'), { frames: 1 });
  assert.deepStrictEqual(r.said(), ['a']);
  r.tick(25);
  assert.deepStrictEqual(r.said(), ['a', 'b', 'c']);
});

test('functions returning lists', () => {
  const r = run([
    'to squares with n',
    '  set out to list',
    '  repeat with i from 1 to n',
    '    add i * i to out',
    '  end',
    '  return out',
    'end',
    'when start',
    '  say squares(4)',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['1, 4, 9, 16']);
});

test('duplicate function names are an error', () => {
  const c = compile('to a\nend\nto a\nend');
  assert.ok(!c.ok);
  assert.match(c.errors[0].msg, /two functions/);
});

test('calling an undefined function is a runtime error, not a crash', () => {
  const r = run('when start\n  set x to 1\nend', { allowErrors: true });
  assert.strictEqual(r.host.state.errors.length, 0);
});

// =============================================================== control flow
test('if / else if / else', () => {
  const src = (n) => [
    'when start',
    `  set n to ${n}`,
    '  if n > 10 then',
    '    say "big"',
    '  else if n > 5 then',
    '    say "medium"',
    '  else',
    '    say "small"',
    '  end',
    'end',
  ].join('\n');
  assert.deepStrictEqual(run(src(20)).said(), ['big']);
  assert.deepStrictEqual(run(src(7)).said(), ['medium']);
  assert.deepStrictEqual(run(src(1)).said(), ['small']);
});

test('repeat N times', () => {
  assert.strictEqual(run('when start\n  repeat 3 times\n    say "x"\n  end\nend').said().length, 3);
});

test('repeat with counter, ascending and descending and by step', () => {
  const r = run([
    'when start',
    '  repeat with i from 1 to 3',
    '    say i',
    '  end',
    '  repeat with j from 3 to 1',
    '    say j',
    '  end',
    '  repeat with k from 0 to 10 by 5',
    '    say k',
    '  end',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['1', '2', '3', '3', '2', '1', '0', '5', '10']);
});

test('for each over a list and a string', () => {
  const r = run([
    'when start',
    '  for each thing in list "a", "b"',
    '    say thing',
    '  end',
    '  for each ch in "hi"',
    '    say ch',
    '  end',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['a', 'b', 'h', 'i']);
});

test('for each is safe when the list is mutated inside', () => {
  const r = run([
    'when start',
    '  set l to list 1, 2, 3',
    '  for each x in l',
    '    add x to l',
    '  end',
    '  say length of l',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['6']);
});

test('while loop', () => {
  const r = run('when start\n  set i to 0\n  while i < 4\n    change i by 1\n  end\n  say i\nend');
  assert.deepStrictEqual(r.said(), ['4']);
});

test('break and continue', () => {
  const r = run([
    'when start',
    '  repeat with i from 1 to 10',
    '    if i = 3 then',
    '      continue',
    '    end',
    '    if i > 5 then',
    '      break',
    '    end',
    '    say i',
    '  end',
    '  say "done"',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['1', '2', '4', '5', 'done']);
});

test('"stop repeating" is break', () => {
  const r = run('when start\n  repeat 10\n    say "once"\n    stop repeating\n  end\nend');
  assert.deepStrictEqual(r.said(), ['once']);
});

test('return exits nested loops inside a function', () => {
  const r = run([
    'to find with target',
    '  repeat with i from 1 to 10',
    '    repeat with j from 1 to 10',
    '      if i * j = target then',
    '        return i + "x" + j',
    '      end',
    '    end',
    '  end',
    '  return "none"',
    'end',
    'when start',
    '  say find(12)',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['2x6']);   // 2*6 is reached before 3*4
});

test('stop halts the whole handler', () => {
  const r = run('when start\n  say "a"\n  stop\n  say "b"\nend');
  assert.deepStrictEqual(r.said(), ['a']);
});

test('wait pauses across frames', () => {
  const r = run('when start\n  say "a"\n  wait 0.5\n  say "b"\nend', { frames: 1 });
  assert.deepStrictEqual(r.said(), ['a']);
  r.tick(20);
  assert.deepStrictEqual(r.said(), ['a', 'b']);
});

test('forever yields once per frame', () => {
  const r = run('when start\n  forever\n    sound beep\n  end\nend', { frames: 5 });
  assert.strictEqual(r.host.calls.length, 5);
});

test('busy while loop cannot freeze a frame', () => {
  const t0 = Date.now();
  const r = run('when start\n  while yes\n    change n by 1\n  end\nend', { frames: 10 });
  assert.ok(Date.now() - t0 < 4000, 'update() should always return');
  assert.ok(num(r.inst.vars.get('n')) > 0);
});

test('a big repeat finishes over several frames', () => {
  const r = run('when start\n  repeat 40000\n    change n by 1\n  end\n  say "done " + n\nend', { frames: 1 });
  r.tick(80);
  assert.deepStrictEqual(r.said(), ['done 40000']);
});

// =============================================================== 3D commands
test('move in world directions', () => {
  const r = run('when start\n  move north 5\n  move east 3\n  move up 2\nend');
  const s = r.host.state;
  assert.deepStrictEqual([s.x, s.y, s.z], [3, 2, -5]);
});

test('move forward respects yaw', () => {
  const r = run('when start\n  set my yaw to 90\n  move forward 10\nend');
  const s = r.host.state;
  assert.ok(Math.abs(s.x - 10) < 0.001, 'x=' + s.x);
  assert.ok(Math.abs(s.z) < 0.001, 'z=' + s.z);
});

test('turn right / left / turn to', () => {
  const r = run('when start\n  turn right 90\n  turn left 30\n  say my yaw\n  turn to 180\n  say my yaw\nend');
  assert.deepStrictEqual(r.said(), ['60', '180']);
});

test('face player and face a point', () => {
  const r = run('when start\n  face player\n  face 10, 20\nend');
  assert.deepStrictEqual(r.host.calls, [['faceTarget', 'player'], ['facePoint', 10, 20]]);
});

test('goto with 3 numbers, and with 2 (ground coords)', () => {
  const r = run('when start\n  goto 1, 2, 3\nend');
  assert.deepStrictEqual([r.host.state.x, r.host.state.y, r.host.state.z], [1, 2, 3]);
  const r2 = run('when start\n  goto 5, 9\nend');
  assert.deepStrictEqual([r2.host.state.x, r2.host.state.z], [5, 9]);
});

test('spawn with 3d and ground coords and no position', () => {
  const r = run('when start\n  spawn box at 1, 2, 3\n  spawn tree at 10, 20\n  spawn rock\nend');
  assert.deepStrictEqual(r.host.calls[0], ['spawn', 'box', 1, 2, 3]);
  assert.deepStrictEqual(r.host.calls[1], ['spawn', 'tree', 10, null, 20]);
  assert.deepStrictEqual(r.host.calls[2], ['spawn', 'rock', null, null, null]);
});

test('push forward and push up', () => {
  const r = run('when start\n  push up 200\n  push forward 100\nend');
  assert.deepStrictEqual(r.host.calls[0], ['push', 0, 200, 0]);
  assert.deepStrictEqual(r.host.calls[1], ['pushLocal', 100, 0, 0]);
});

test('teleport player with 3 and 2 coords', () => {
  const r = run('when start\n  teleport player to 1, 2, 3\n  teleport player to 7, 8\nend');
  assert.deepStrictEqual(r.host.calls[0], ['teleportPlayer', 1, 2, 3]);
  assert.deepStrictEqual(r.host.calls[1], ['teleportPlayer', 7, null, 8]);
});

test('vanish stops the script', () => {
  const r = run('when start\n  vanish\n  say "never"\nend');
  assert.deepStrictEqual(r.host.calls, [['vanish']]);
});

test('show / hide / solid / physical / glow / light', () => {
  const r = run('when start\n  hide\n  solid off\n  physical on\n  glow on\n  light off\nend');
  assert.strictEqual(r.host.state.visible, false);
  assert.deepStrictEqual(r.host.state.flags, { solid: false, physical: true, glow: true, light: false });
});

test('color, grow, spin', () => {
  const r = run('when start\n  color red\n  grow 25\n  spin 90\nend');
  assert.strictEqual(r.host.state.colorV, 'red');
  assert.strictEqual(r.host.state.size, 125);
  assert.strictEqual(r.host.state.spin, 90);
});

test('say for N seconds, write with size and id, unwrite, buttons', () => {
  const r = run([
    'when start',
    '  say "yo" for 2 seconds',
    '  write "score: " + 5 at 50, 10 size 6 as hud',
    '  unwrite hud',
    '  button "play" at 50, 60',
    '  remove button "play"',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.host.calls, [
    ['say', 'yo', 2],
    ['write', 'score: 5', 50, 10, 6, 'hud'],
    ['unwrite', 'hud'],
    ['button', 'play', 50, 60],
    ['removeButton', 'play'],
  ]);
});

test('sound, broadcast local and to everyone, freeze, shake', () => {
  const r = run('when start\n  sound pop\n  broadcast go\n  broadcast go to everyone\n  freeze player\n  unfreeze player\n  shake 0.5\nend');
  assert.deepStrictEqual(r.host.calls, [
    ['sound', 'pop'], ['broadcast', 'go', false], ['broadcast', 'go', true],
    ['freeze', true], ['freeze', false], ['shake', 0.5],
  ]);
});

// =============================================================== events
test('all the event kinds fire', () => {
  const r = run([
    'when touched', '  say "t"', 'end',
    'when clicked', '  say "c"', 'end',
    'when hit', '  say "h"', 'end',
    'when key e', '  say "k"', 'end',
    'when message boom', '  say "m"', 'end',
    'when button "go"', '  say "b"', 'end',
  ].join('\n'));
  r.inst.trigger('touched');
  r.inst.trigger('clicked');
  r.inst.trigger('hit');
  r.inst.trigger('key', 'e');
  r.inst.trigger('key', 'q');       // no handler
  r.inst.trigger('message', 'BOOM'); // case-insensitive
  r.inst.trigger('button', 'go');
  r.tick();
  assert.deepStrictEqual(r.said().sort(), ['b', 'c', 'h', 'k', 'm', 't']);
});

test('when tick runs every frame', () => {
  const r = run('when tick\n  change shared n by 1\nend', { frames: 6 });
  assert.strictEqual(num(r.host.shared.get('n')), 6);
});

test('every N seconds', () => {
  const r = run('every 0.2 seconds\n  sound beep\nend', { frames: 1, dt: 0.1 });
  r.tick(10);
  const n = r.host.calls.length;
  assert.ok(n >= 4 && n <= 6, 'fired ' + n + ' times');
});

test('when player near fires on entry only', () => {
  const src = 'when player near 50\n  say "close"\nend';
  const c = compile(src);
  assert.ok(c.ok, JSON.stringify(c.errors));
  const host = makeHost();
  let d = 100;
  host.distanceToPlayer = () => d;
  const inst = new ScriptInstance(c.program, host);
  inst.start();
  inst.update(0);
  assert.strictEqual(host.calls.length, 0);
  d = 10;
  inst.update(0.1); inst.update(0.2);   // stays inside: still one fire
  assert.strictEqual(host.calls.length, 1);
  d = 100; inst.update(0.3);
  d = 10; inst.update(0.4);             // re-entry fires again
  assert.strictEqual(host.calls.length, 2);
});

test('several handlers of the same kind all run', () => {
  const r = run('when start\n  say "one"\nend\nwhen start\n  say "two"\nend');
  assert.deepStrictEqual(r.said().sort(), ['one', 'two']);
});

// =============================================================== expressions
test('arithmetic precedence and parentheses', () => {
  assert.deepStrictEqual(run('when start\n  say 2 + 3 * 4\n  say (2 + 3) * 4\nend').said(), ['14', '20']);
});

test('divide and mod by zero are 0, not Infinity/NaN', () => {
  assert.deepStrictEqual(run('when start\n  say 5 / 0\n  say 5 % 0\nend').said(), ['0', '0']);
});

test('string concat, and numeric strings still add', () => {
  const r = run('when start\n  say "hp: " + 10\n  say "5" + 5\nend');
  assert.deepStrictEqual(r.said(), ['hp: 10', '10']);
});

test('comparisons, is / is not, and or not', () => {
  const r = run([
    'when start',
    '  if 3 < 5 and not (2 > 9) then',
    '    say "logic"',
    '  end',
    '  if 1 = 2 or "a" = "a" then',
    '    say "or"',
    '  end',
    '  if 5 is not 6 then',
    '    say "isnot"',
    '  end',
    '  if 5 is 5 then',
    '    say "is"',
    '  end',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['logic', 'or', 'isnot', 'is']);
});

test('loose equality between "5" and 5', () => {
  assert.deepStrictEqual(run('when start\n  set s to "5"\n  if s = 5 then\n    say "same"\n  end\nend').said(), ['same']);
});

test('yes / no / nothing', () => {
  const r = run('when start\n  set on to yes\n  if on then\n    say "on"\n  end\n  say no\n  say length of nothing\nend');
  assert.deepStrictEqual(r.said(), ['on', 'no', '0']);
});

test('negative numbers', () => {
  assert.deepStrictEqual(run('when start\n  say -5 + 2\n  say 0 - -3\nend').said(), ['-3', '3']);
});

test('math library', () => {
  const r = run([
    'when start',
    '  say round 2.6', '  say abs (0 - 7)', '  say floor 3.9', '  say ceil 3.1',
    '  say sqrt 16', '  say round (sin 90)', '  say round (cos 0)',
    '  say min of 3, 8', '  say max of 3, 8',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['3', '7', '3', '4', '4', '1', '1', '3', '8']);
});

test('string library', () => {
  const r = run([
    'when start',
    '  say length of "hello"',
    '  say letter 2 of "hello"',
    '  say uppercase of "hi"',
    '  say lowercase of "HI"',
    '  say text of 5',
    '  say (number of "12") + 1',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), ['5', 'e', 'HI', 'hi', '5', '13']);
});

test('random stays in range and is whole for whole bounds', () => {
  const r = run('when start\n  repeat 30\n    say random 1 to 3\n  end\nend');
  for (const v of r.said()) {
    const n = +v;
    assert.ok(n >= 1 && n <= 3 && Number.isInteger(n), 'got ' + v);
  }
});

test('world queries', () => {
  const r = run([
    'when start',
    '  goto 7, 8, 9',
    '  say my x + "," + my y + "," + my z',
    '  say my name',
    '  say player x + "," + player z',
    '  say player name',
    '  say mouse x + "," + mouse y',
    '  say distance to player',
    '  say distance to tree',
    '  if touching player then',
    '    say "touch"',
    '  end',
    '  if key e is down then',
    '    say "edown"',
    '  end',
    '  say count of box',
    '  say time',
    '  say biome',
    '  say height at 2, 3',
    'end',
  ].join('\n'));
  assert.deepStrictEqual(r.said(), [
    '7,8,9', 'thing', '50,20', 'tester', '10,5', '42', '7',
    'touch', 'edown', '3', '99', 'volcano', '5',
  ]);
});

// =============================================================== robustness
test('destroy() stops fibers', () => {
  const r = run('when tick\n  sound beep\nend', { frames: 2 });
  const before = r.host.calls.length;
  r.inst.destroy();
  r.tick(5);
  assert.strictEqual(r.host.calls.length, before);
});

test('runtime errors are reported with a line number and do not stop other handlers', () => {
  const r = run([
    'when start',
    '  set l to list 1',
    '  set item 5 of l to 0',
    'end',
    'when start',
    '  say "other handler still runs"',
    'end',
  ].join('\n'));
  assert.strictEqual(r.host.state.errors.length, 1);
  assert.strictEqual(r.host.state.errors[0].line, 3);
  assert.deepStrictEqual(r.said(), ['other handler still runs']);
});

test('list size is capped', () => {
  const r = run('when start\n  set l to list\n  repeat 25000\n    add 1 to l\n  end\nend', { frames: 1 });
  r.tick(60);
  assert.ok(r.host.state.errors.length >= 1);
  assert.match(r.host.state.errors[0].msg, /item limit/);
});

test('fiber count is bounded (event spam cannot pile up forever)', () => {
  const r = run('when clicked\n  wait 5\n  say "late"\nend');
  for (let i = 0; i < 500; i++) r.inst.trigger('clicked');
  r.tick();
  assert.ok(r.inst.fibers.length <= 70, 'fibers=' + r.inst.fibers.length);
});

test('display formatting', () => {
  assert.strictEqual(display(0.30000000000000004), '0.3');
  assert.strictEqual(display(true), 'yes');
  assert.strictEqual(display(false), 'no');
  assert.strictEqual(display([1, 'a']), '1, a');
});

test('truthiness: empty list is false, non-empty is true', () => {
  assert.ok(!truthy([]) && truthy([0]));
  assert.ok(!truthy(0) && !truthy('') && !truthy(false));
  assert.ok(truthy(1) && truthy('a') && truthy(true));
});

// =============================================================== real programs
test('a working scoreboard object', () => {
  const r = run([
    'to refresh',
    '  write "score: " + shared score at 50, 8 size 4 as hud',
    'end',
    'when start',
    '  set shared score to 0',
    '  refresh',
    'end',
    'when clicked',
    '  change shared score by 10',
    '  refresh',
    'end',
  ].join('\n'));
  r.inst.trigger('clicked');
  r.inst.trigger('clicked');
  r.tick();
  const writes = r.host.calls.filter(c => c[0] === 'write').map(c => c[1]);
  assert.deepStrictEqual(writes, ['score: 0', 'score: 10', 'score: 20']);
});

test('a block-blast style board build', () => {
  const r = run([
    'to board with cols, rows',
    '  set made to 0',
    '  repeat with row from 1 to rows',
    '    repeat with col from 1 to cols',
    '      spawn tile at col * 2, 0, row * 2',
    '      change made by 1',
    '    end',
    '  end',
    '  return made',
    'end',
    'when start',
    '  say "made " + board(4, 3)',
    'end',
  ].join('\n'));
  assert.strictEqual(r.host.calls.filter(c => c[0] === 'spawn').length, 12);
  assert.deepStrictEqual(r.said(), ['made 12']);
});

test('a patrolling guard using functions, lists and waits', () => {
  const r = run([
    'to patrol with points',
    '  for each p in points',
    '    goto item 1 of p, item 2 of p',
    '    wait 0.1',
    '  end',
    'end',
    'when start',
    '  patrol with list (list 10, 10), (list 20, 20)',
    '  say "route done at " + my x',
    'end',
  ].join('\n'), { frames: 1 });
  r.tick(30);
  assert.deepStrictEqual(r.said(), ['route done at 20']);
  assert.strictEqual(r.host.state.z, 20);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
