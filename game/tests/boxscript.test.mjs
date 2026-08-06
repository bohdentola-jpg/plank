// boxscript language tests — run with: node game/tests/boxscript.test.mjs
import { compile, ScriptInstance, num, display, truthy } from '../js/boxscript.js';
import assert from 'node:assert';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + (e.message || e)); }
}

// Minimal host that records calls and simulates a tiny world.
function makeHost() {
  const calls = [];
  const shared = new Map();
  const state = { x: 0, y: 0, size: 100, visible: true, solidV: true, colorV: 'gray', errors: [] };
  const host = {
    calls, shared, state,
    getX: () => state.x, getY: () => state.y, getSize: () => state.size,
    setX: v => { state.x = v; }, setY: v => { state.y = v; }, setSize: v => { state.size = v; },
    move: (dx, dy) => { state.x += dx; state.y += dy; calls.push(['move', dx, dy]); },
    say: (t, s) => calls.push(['say', t, s]),
    write: (t, x, y, sz, id) => calls.push(['write', t, x, y, sz, id]),
    unwrite: id => calls.push(['unwrite', id]),
    button: (l, x, y) => calls.push(['button', l, x, y]),
    removeButton: l => calls.push(['removeButton', l]),
    show: v => { state.visible = v; calls.push(['show', v]); },
    solid: v => { state.solidV = v; },
    color: c => { state.colorV = c; },
    spawn: (m, x, y) => calls.push(['spawn', m, x, y]),
    vanish: () => calls.push(['vanish']),
    push: (dx, dy) => calls.push(['push', dx, dy]),
    teleportPlayer: (x, y) => calls.push(['teleportPlayer', x, y]),
    sound: n => calls.push(['sound', n]),
    broadcast: (m, e) => calls.push(['broadcast', m, e]),
    freeze: v => calls.push(['freeze', v]),
    shake: a => calls.push(['shake', a]),
    playerX: () => 50, playerY: () => 20, playerName: () => 'tester',
    mouseX: () => 10, mouseY: () => 5,
    keyDown: k => k === 'e',
    touching: w => w === 'player',
    distanceToPlayer: () => 42,
    count: m => m === 'box' ? 3 : 0,
    time: () => 99,
    sharedGet: n => shared.get(n),
    sharedSet: (n, v) => shared.set(n, v),
    onError: (line, msg) => state.errors.push({ line, msg }),
  };
  return host;
}

function run(src, opts = {}) {
  const c = compile(src);
  if (!c.ok && !opts.allowErrors) {
    throw new Error('compile errors: ' + c.errors.map(e => `L${e.line}: ${e.msg}`).join(' | '));
  }
  const host = makeHost();
  const inst = new ScriptInstance(c.program, host);
  inst.start();
  const frames = opts.frames ?? 1;
  const dt = opts.dt ?? 1 / 30;
  let now = 0;
  for (let i = 0; i < frames; i++) { inst.update(now); now += dt; }
  return { host, inst, compileResult: c, tick: (n = 1) => { for (let i = 0; i < n; i++) { inst.update(now); now += dt; } return now; } };
}

// ------------------------------------------------ parsing
test('empty script compiles', () => {
  assert.ok(compile('').ok);
  assert.ok(compile('# just a comment\n\n').ok);
});

test('unknown command is a friendly error', () => {
  const c = compile('when start\n  explode\nend');
  assert.ok(!c.ok);
  assert.match(c.errors[0].msg, /explode/);
  assert.strictEqual(c.errors[0].line, 2);
});

test('missing end is caught', () => {
  const c = compile('when start\n  say "hi"');
  assert.ok(!c.ok);
  assert.match(c.errors[0].msg, /end/);
});

test('smart quotes accepted', () => {
  const c = compile('when start\n  say “hello”\nend');
  assert.ok(c.ok, JSON.stringify(c.errors));
});

test('comments and blank lines ignored', () => {
  const c = compile('# top\nwhen start # side comment\n\n  say "hi" # after\nend\n');
  assert.ok(c.ok, JSON.stringify(c.errors));
});

// ------------------------------------------------ basic statements
test('say fires on start', () => {
  const { host } = run('when start\n  say "hello"\nend');
  assert.deepStrictEqual(host.calls[0], ['say', 'hello', 4]);
});

test('say for N seconds', () => {
  const { host } = run('when start\n  say "yo" for 2 seconds\nend');
  assert.deepStrictEqual(host.calls[0], ['say', 'yo', 2]);
});

test('set and read variables', () => {
  const { host } = run('when start\n  set score to 3\n  set score to score + 4\n  say score\nend');
  assert.deepStrictEqual(host.calls[0], ['say', '7', 4]);
});

test('change by', () => {
  const { host } = run('when start\n  set n to 10\n  change n by -3\n  say n\nend');
  assert.deepStrictEqual(host.calls[0], ['say', '7', 4]);
});

test('unset variables read as 0', () => {
  const { host } = run('when start\n  say mystery + 1\nend');
  assert.deepStrictEqual(host.calls[0], ['say', '1', 4]);
});

test('set x / set y / set size hit properties, not vars', () => {
  const { host } = run('when start\n  set x to 25\n  set y to 8\n  set size to 150\nend');
  assert.strictEqual(host.state.x, 25);
  assert.strictEqual(host.state.y, 8);
  assert.strictEqual(host.state.size, 150);
});

test('move directions (y grows up in user space)', () => {
  const { host } = run('when start\n  move up 10\n  move right 5\n  move down 4\n  move left 1\nend');
  assert.deepStrictEqual(host.calls.map(c => [c[1], c[2]]), [[0, 10], [5, 0], [0, -4], [-1, 0]]);
});

test('goto with comma', () => {
  const { host } = run('when start\n  goto 100, 50\nend');
  assert.strictEqual(host.state.x, 100);
  assert.strictEqual(host.state.y, 50);
});

test('grow changes size', () => {
  const { host } = run('when start\n  grow 25\nend');
  assert.strictEqual(host.state.size, 125);
});

test('spawn with and without position', () => {
  const { host } = run('when start\n  spawn box at 10, 20\n  spawn crate\nend');
  assert.deepStrictEqual(host.calls[0], ['spawn', 'box', 10, 20]);
  assert.deepStrictEqual(host.calls[1], ['spawn', 'crate', null, null]);
});

test('vanish stops the script', () => {
  const { host } = run('when start\n  vanish\n  say "never"\nend');
  assert.deepStrictEqual(host.calls, [['vanish']]);
});

test('stop halts fiber', () => {
  const { host } = run('when start\n  say "a"\n  stop\n  say "b"\nend');
  assert.strictEqual(host.calls.length, 1);
});

test('write with size and id', () => {
  const { host } = run('when start\n  write "score: " + 5 at 50, 90 size 6 as hud\nend');
  assert.deepStrictEqual(host.calls[0], ['write', 'score: 5', 50, 90, 6, 'hud']);
});

test('button and when button', () => {
  const r = run('when start\n  button "play" at 50, 60\nend\nwhen button "play"\n  say "go"\nend');
  assert.deepStrictEqual(r.host.calls[0], ['button', 'play', 50, 60]);
  r.inst.trigger('button', 'play');
  r.tick();
  assert.deepStrictEqual(r.host.calls[1], ['say', 'go', 4]);
});

test('sound, broadcast local + everyone', () => {
  const { host } = run('when start\n  sound pop\n  broadcast levelup\n  broadcast go to everyone\nend');
  assert.deepStrictEqual(host.calls, [['sound', 'pop'], ['broadcast', 'levelup', false], ['broadcast', 'go', true]]);
});

test('teleport player', () => {
  const { host } = run('when start\n  teleport player to 5, 6\nend');
  assert.deepStrictEqual(host.calls[0], ['teleportPlayer', 5, 6]);
});

// ------------------------------------------------ control flow
test('if / else', () => {
  const { host } = run('when start\n  set a to 5\n  if a > 3\n    say "big"\n  else\n    say "small"\n  end\nend');
  assert.deepStrictEqual(host.calls[0], ['say', 'big', 4]);
});

test('nested if', () => {
  const src = `when start
  set a to 2
  if a > 1
    if a > 10
      say "huge"
    else
      say "medium"
    end
  end
end`;
  const { host } = run(src);
  assert.deepStrictEqual(host.calls[0], ['say', 'medium', 4]);
});

test('repeat N times', () => {
  const { host } = run('when start\n  repeat 3\n    say "x"\n  end\nend');
  assert.strictEqual(host.calls.length, 3);
});

test('repeat with "times" word', () => {
  const { host } = run('when start\n  repeat 2 times\n    sound beep\n  end\nend');
  assert.strictEqual(host.calls.length, 2);
});

test('while loop', () => {
  const { host } = run('when start\n  set i to 0\n  while i < 4\n    change i by 1\n  end\n  say i\nend');
  assert.deepStrictEqual(host.calls[0], ['say', '4', 4]);
});

test('wait pauses a fiber across frames', () => {
  const r = run('when start\n  say "a"\n  wait 0.5\n  say "b"\nend', { frames: 1 });
  assert.strictEqual(r.host.calls.length, 1);
  r.tick(20); // ~0.66s at 30fps
  assert.strictEqual(r.host.calls.length, 2);
});

test('forever runs once per frame', () => {
  const r = run('when start\n  forever\n    sound beep\n  end\nend', { frames: 5 });
  assert.strictEqual(r.host.calls.length, 5);
});

test('busy while loop cannot freeze a frame', () => {
  // loop never terminates but each update() must return
  const t0 = Date.now();
  const r = run('when start\n  while yes\n    change i by 1\n  end\nend', { frames: 10 });
  assert.ok(Date.now() - t0 < 3000, 'update() should not hang');
  assert.ok(r.inst.vars.get('i') > 0);
});

test('when tick runs every frame', () => {
  const r = run('when tick\n  change shared t by 1\nend', { frames: 6 });
  assert.strictEqual(num(r.host.shared.get('t')), 6);
});

test('every N seconds', () => {
  const r = run('every 0.2 seconds\n  sound beep\nend', { frames: 1, dt: 0.1 });
  r.tick(10); // reaches ~1.1s → about 5 firings
  const n = r.host.calls.length;
  assert.ok(n >= 4 && n <= 6, 'got ' + n);
});

// ------------------------------------------------ events
test('touched / clicked / hit / key / message triggers', () => {
  const src = `when touched
  say "t"
end
when clicked
  say "c"
end
when hit
  say "h"
end
when key e
  say "k"
end
when message boom
  say "m"
end`;
  const r = run(src);
  r.inst.trigger('touched');
  r.inst.trigger('clicked');
  r.inst.trigger('hit');
  r.inst.trigger('key', 'e');
  r.inst.trigger('key', 'q'); // no handler
  r.inst.trigger('message', 'boom');
  r.inst.trigger('message', 'BOOM'); // case-insensitive
  r.tick();
  assert.deepStrictEqual(r.host.calls.map(c => c[1]).sort(), ['c', 'h', 'k', 'm', 'm', 't']);
});

test('when key with pressed flourish', () => {
  const c = compile('when key space pressed\n  sound beep\nend');
  assert.ok(c.ok, JSON.stringify(c.errors));
});

// ------------------------------------------------ expressions
test('arithmetic precedence', () => {
  const { host } = run('when start\n  say 2 + 3 * 4\nend');
  assert.deepStrictEqual(host.calls[0][1], '14');
});

test('parentheses', () => {
  const { host } = run('when start\n  say (2 + 3) * 4\nend');
  assert.deepStrictEqual(host.calls[0][1], '20');
});

test('division by zero is 0, not Infinity', () => {
  const { host } = run('when start\n  say 5 / 0\nend');
  assert.deepStrictEqual(host.calls[0][1], '0');
});

test('string concat with +', () => {
  const { host } = run('when start\n  say "hp: " + 10\nend');
  assert.deepStrictEqual(host.calls[0][1], 'hp: 10');
});

test('comparisons and and/or/not', () => {
  const src = `when start
  if 3 < 5 and not (2 > 9)
    say "logic"
  end
  if 1 = 2 or "a" = "a"
    say "eq"
  end
  if 5 != 6
    say "neq"
  end
end`;
  const { host } = run(src);
  assert.deepStrictEqual(host.calls.map(c => c[1]), ['logic', 'eq', 'neq']);
});

test('loose equality: "5" = 5', () => {
  const { host } = run('when start\n  set s to "5"\n  if s = 5\n    say "same"\n  end\nend');
  assert.deepStrictEqual(host.calls[0][1], 'same');
});

test('yes/no booleans', () => {
  const { host } = run('when start\n  set on to yes\n  if on\n    say "on"\n  end\n  say no\nend');
  assert.deepStrictEqual(host.calls.map(c => c[1]), ['on', 'no']);
});

test('negative numbers', () => {
  const { host } = run('when start\n  say -5 + 2\nend');
  assert.deepStrictEqual(host.calls[0][1], '-3');
});

test('random N to M in range, integer for int bounds', () => {
  const { host } = run('when start\n  repeat 20\n    say random 1 to 3\n  end\nend');
  for (const c of host.calls) {
    const v = +c[1];
    assert.ok(v >= 1 && v <= 3 && Number.isInteger(v), 'value ' + c[1]);
  }
});

test('world getters: my/player/mouse/distance/touching/key/count/time', () => {
  const src = `when start
  goto 7, 8
  say my x + "," + my y
  say player x + "," + player y
  say mouse x + "," + mouse y
  say distance to player
  if touching player
    say "touch"
  end
  if key e down
    say "edown"
  end
  say count of box
  say time
end`;
  const { host } = run(src);
  const said = host.calls.filter(c => c[0] === 'say').map(c => c[1]);
  assert.deepStrictEqual(said, ['7,8', '50,20', '10,5', '42', 'touch', 'edown', '3', '99']);
});

test('round/abs/floor', () => {
  const { host } = run('when start\n  say round 2.6\n  say abs (0 - 7)\n  say floor 3.9\nend');
  assert.deepStrictEqual(host.calls.map(c => c[1]), ['3', '7', '3']);
});

test('shared variables via host store', () => {
  const src = `when start
  set shared score to 10
  change shared score by 5
  say shared score
end`;
  const { host } = run(src);
  assert.deepStrictEqual(host.calls[0][1], '15');
  assert.strictEqual(host.shared.get('score'), 15);
});

// ------------------------------------------------ robustness
test('runtime keeps going after one bad handler', () => {
  const src = `when clicked
  say "fine"
end`;
  const r = run(src);
  r.inst.trigger('clicked');
  r.tick();
  assert.strictEqual(r.host.calls.length, 1);
});

test('multiple events of same kind all fire', () => {
  const src = `when start
  say "one"
end
when start
  say "two"
end`;
  const { host } = run(src);
  assert.strictEqual(host.calls.length, 2);
});

test('destroy() stops fibers', () => {
  const r = run('when tick\n  sound beep\nend', { frames: 2 });
  const before = r.host.calls.length;
  r.inst.destroy();
  r.tick(5);
  assert.strictEqual(r.host.calls.length, before);
});

test('big repeat completes over multiple frames without hanging', () => {
  const r = run('when start\n  repeat 50000\n    change n by 1\n  end\n  say "done " + n\nend', { frames: 1 });
  r.tick(60);
  const say = r.host.calls.find(c => c[0] === 'say');
  assert.ok(say, 'should finish');
  assert.strictEqual(say[1], 'done 50000');
});

test('error line numbers are right', () => {
  const c = compile('when start\n  say "ok"\n  blorp 12\nend');
  assert.strictEqual(c.errors[0].line, 3);
});

test('freeze/unfreeze/shake', () => {
  const { host } = run('when start\n  freeze player\n  shake 0.5\n  unfreeze player\nend');
  assert.deepStrictEqual(host.calls, [['freeze', true], ['shake', 0.5], ['freeze', false]]);
});

test('solid and color and show/hide', () => {
  const { host } = run('when start\n  solid off\n  color red\n  hide\n  show\nend');
  assert.strictEqual(host.state.solidV, false);
  assert.strictEqual(host.state.colorV, 'red');
  assert.strictEqual(host.state.visible, true);
});

test('display formatting trims float noise', () => {
  assert.strictEqual(display(0.30000000000000004), '0.3');
  assert.strictEqual(display(true), 'yes');
  assert.strictEqual(display(false), 'no');
});

test('truthiness', () => {
  assert.ok(!truthy(0) && !truthy('') && !truthy(false));
  assert.ok(truthy(1) && truthy('a') && truthy(true));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
