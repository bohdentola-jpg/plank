// arcade.test.mjs — plays the shipped cabinet games headlessly.
// The games are boxscript, so the whole thing runs under plain node with a
// mock screen: compile each game, feed it ticks and keys, and make sure it
// actually plays. Run: node game/tests/arcade.test.mjs

import assert from 'node:assert';
import { compile, ScriptInstance } from '../js/boxscript.js';
import { SNAKE_GAME, PONG_GAME, BRICKS_GAME, DOOR_SCRIPT, ARCADE_GAMES } from '../js/arcadegames.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + (e && e.message || e)); }
}

// a mock cabinet: records sprites the way screen.js would
function cabinet(src) {
  const c = compile(src);
  if (!c.ok) throw new Error('compile: ' + c.errors.map(e => `L${e.line} ${e.msg}`).join(' | '));
  const sprites = new Map();
  const sounds = [];
  const errors = [];
  const keys = new Set();
  const state = { playing: false };
  const host = {
    sprites, sounds, errors, keys, state,
    screenOn: () => state.playing,
    screenClear: () => sprites.clear(),
    screenStamp: (id, x, y, w, h, color) => sprites.set(id, { kind: 'rect', x, y, w, h, color }),
    screenPrint: (id, text, x, y, size, color) => sprites.set(id, { kind: 'text', text, x, y, size, color }),
    screenUnstamp: (id) => { if (id === 'all') sprites.clear(); else sprites.delete(id); },
    sound: (n) => { sounds.push(n); if (sounds.length > 500) sounds.shift(); },
    keyDown: (k) => keys.has(k),
    onError: (line, msg) => errors.push(line + ': ' + msg),
    turn: () => {}, flag: () => {}, sharedGet: () => 0, sharedSet: () => {},
  };
  const inst = new ScriptInstance(c.program, host);
  inst.start();
  let now = 0;
  const step = (frames = 1, dt = 1 / 60) => {
    for (let i = 0; i < frames; i++) { inst.update(now); now += dt; }
  };
  const press = (k) => inst.trigger('key', k);
  const play = () => { state.playing = true; inst.trigger('screenstart'); step(2); };
  return { inst, host, sprites, sounds, errors, keys, state, step, press, play };
}

// ================================================================ compiling
test('every shipped game and the door script compile clean', () => {
  for (const [name, src] of [...Object.entries(ARCADE_GAMES), ['door', DOOR_SCRIPT]]) {
    const c = compile(src);
    assert.ok(c.ok, name + ': ' + c.errors.map(e => `L${e.line} ${e.msg}`).join(' | '));
  }
});

// ================================================================ attract
test('cabinets draw an attract title before anyone plays', () => {
  for (const src of [SNAKE_GAME, PONG_GAME, BRICKS_GAME]) {
    const cab = cabinet(src);
    cab.step(3);
    assert.ok(cab.sprites.has('title'), 'no title sprite');
    assert.strictEqual(cab.errors.length, 0, cab.errors.join(' | '));
  }
});

// ================================================================ snake
test('snake: pressing E deals a fresh board', () => {
  const cab = cabinet(SNAKE_GAME);
  cab.play();
  assert.ok(cab.sprites.has('s1') && cab.sprites.has('s2') && cab.sprites.has('s3'), 'no snake segments');
  assert.ok(cab.sprites.has('food'), 'no food');
  assert.ok(!cab.sprites.has('title'), 'attract screen should be cleared');
});

test('snake: it slithers, and arrows steer it', () => {
  const cab = cabinet(SNAKE_GAME);
  cab.play();
  const x0 = cab.sprites.get('s1').x;
  cab.step(12);                          // ~0.2s → one 0.13s move
  const x1 = cab.sprites.get('s1').x;
  assert.ok(x1 > x0, `should move right: ${x0} → ${x1}`);
  cab.press('down');
  cab.step(12);
  const before = cab.sprites.get('s1');
  cab.step(9);
  const after = cab.sprites.get('s1');
  assert.ok(after.y > before.y, `should now move down: ${before.y} → ${after.y}`);
  assert.strictEqual(cab.errors.length, 0, cab.errors.join(' | '));
});

test('snake: eating food grows it and scores', () => {
  const cab = cabinet(SNAKE_GAME);
  cab.play();
  // steer the food into the snake's path instead of chasing randomness:
  // place food straight ahead on the same row
  const head = cab.sprites.get('s1');
  cab.inst.vars.set('foodx', Math.round(head.x / 5) + 2);
  cab.inst.vars.set('foody', Math.round(head.y / 5));
  cab.step(40);                          // a few moves later it has eaten
  const score = cab.sprites.get('score');
  assert.ok(score && +score.text >= 1, 'score should be 1+, got ' + (score && score.text));
  assert.ok(cab.sprites.has('s4'), 'the snake should be longer');
});

test('snake: biting yourself ends it; space deals again', () => {
  const cab = cabinet(SNAKE_GAME);
  cab.play();
  // grow long enough to turn into yourself: feed it three times
  for (let i = 0; i < 3; i++) {
    const head = cab.sprites.get('s1');
    cab.inst.vars.set('foodx', Math.round(head.x / 5) + 1);
    cab.inst.vars.set('foody', Math.round(head.y / 5));
    cab.step(12);
  }
  assert.ok(cab.sprites.has('s5'), 'should be 6 long by now');
  // a tight loop: up, left, down bites the body
  cab.press('up'); cab.step(9);
  cab.press('left'); cab.step(9);
  cab.press('down'); cab.step(9);
  cab.step(10);
  assert.ok(cab.sprites.has('over'), 'game over text should show');
  cab.press('space');
  cab.step(3);
  assert.ok(!cab.sprites.has('over'), 'space should reset');
  assert.strictEqual(cab.sprites.get('score').text, '0');
});

// ================================================================ pong
test('pong: the ball flies, both paddles show, holding up moves you', () => {
  const cab = cabinet(PONG_GAME);
  cab.play();
  cab.step(5);
  const b0 = { ...cab.sprites.get('ball') };
  cab.step(30);
  const b1 = cab.sprites.get('ball');
  assert.ok(Math.hypot(b1.x - b0.x, b1.y - b0.y) > 3, 'ball should travel');
  assert.ok(cab.sprites.has('me') && cab.sprites.has('them') && cab.sprites.has('net'));
  const p0 = cab.sprites.get('me').y;
  cab.keys.add('up');
  cab.step(20);
  cab.keys.delete('up');
  assert.ok(cab.sprites.get('me').y < p0 - 5, 'paddle should move up while held');
  assert.strictEqual(cab.errors.length, 0, cab.errors.join(' | '));
});

test('pong: points get scored eventually', () => {
  const cab = cabinet(PONG_GAME);
  cab.play();
  // park the player's paddle at the top so the machine wins rallies
  cab.step(4);
  let scored = false;
  for (let i = 0; i < 40 && !scored; i++) {
    cab.step(60);
    const s2 = cab.sprites.get('s2');
    if (s2 && +s2.text >= 1) scored = true;
  }
  assert.ok(scored, 'the machine should score against a parked paddle');
  assert.strictEqual(cab.errors.length, 0, cab.errors.join(' | '));
});

// ================================================================ bricks
test('bricks: a full wall appears, space serves, bricks break, score rises', () => {
  const cab = cabinet(BRICKS_GAME);
  cab.play();
  let bricks = 0;
  for (const id of cab.sprites.keys()) if (String(id).startsWith('b')) bricks++;
  assert.ok(bricks >= 32, 'expected 32 bricks, saw ' + bricks);
  cab.press('space');
  cab.step(2);
  const before = cab.sprites.size;
  let broke = false;
  for (let i = 0; i < 30 && !broke; i++) {
    cab.step(60);
    const sc = cab.sprites.get('score');
    if (sc && +sc.text >= 1) broke = true;
    // if the ball dropped, serve again
    if (cab.inst.vars.get('stuck') === true || cab.inst.vars.get('stuck') === 'yes') cab.press('space');
  }
  assert.ok(broke, 'a brick should break within a while');
  assert.ok(cab.sprites.size < before + 3, 'sprites should not leak');
  assert.strictEqual(cab.errors.length, 0, cab.errors.join(' | '));
});

test('bricks: paddle obeys the keys and stays on screen', () => {
  const cab = cabinet(BRICKS_GAME);
  cab.play();
  cab.keys.add('left');
  cab.step(120);
  cab.keys.delete('left');
  const x = cab.sprites.get('paddle').x;
  assert.strictEqual(x, 0, 'paddle should stop at the left edge, got ' + x);
  cab.keys.add('right');
  cab.step(200);
  cab.keys.delete('right');
  assert.strictEqual(cab.sprites.get('paddle').x, 88, 'right edge clamp');
});

// ================================================================ manners
test('games leave the screen alone when nobody is playing', () => {
  const cab = cabinet(SNAKE_GAME);
  cab.step(60);                     // a second of attract
  const n = cab.sprites.size;
  cab.step(120);
  assert.strictEqual(cab.sprites.size, n, 'attract mode should be still');
});

test('the door script opens and closes', () => {
  const c = compile(DOOR_SCRIPT);
  assert.ok(c.ok);
  let yaw = 0, solid = true;
  const host = {
    turn: (d) => { yaw += d; },
    flag: (n, v) => { if (n === 'solid') solid = v; },
    sound: () => {},
    onError: (l, m) => { throw new Error(l + ': ' + m); },
  };
  const inst = new ScriptInstance(c.program, host);
  inst.start();
  inst.update(0);
  inst.trigger('clicked');
  inst.update(0.1);
  assert.strictEqual(yaw, 100);
  assert.strictEqual(solid, false);
  inst.trigger('clicked');
  inst.update(0.2);
  assert.strictEqual(yaw, 0);
  assert.strictEqual(solid, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
