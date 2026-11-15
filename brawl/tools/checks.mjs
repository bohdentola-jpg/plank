// Scripted-input checks of the core mechanics: jump heights, attacks from the
// right inputs, shield/roll, grab/throw, ledges, KOs and match end.
//   node brawl/tools/checks.mjs

import { Match } from '../js/game/match.js';
import { fighterById } from '../js/fighters/index.js';
import { stageById } from '../js/stages/index.js';
import { blankSnap, ACTIONS, NullCtl } from '../js/core/input.js';

class Script {
  constructor(steps) { this.steps = steps; this.snap = blankSnap(); this.isCPU = false; this.tapJump = true; this.px = 0; this.py = 0; }
  at(frame) { let t = 0; for (const [n, inp] of this.steps) { if (frame < t + n) return inp; t += n; } return {}; }
  read(f, m) {
    const s = this.snap, w = this.at(m.frame) || {}, x = w.x || 0, y = w.y || 0;
    s.tapX = x && x !== this.px ? Math.sign(x) : 0; s.tapY = y && y !== this.py ? Math.sign(y) : 0;
    this.px = x; this.py = y; s.x = x; s.y = y;
    for (const a of ACTIONS) { const h = !!w[a]; s.p[a] = h && !s.h[a]; s.h[a] = h; }
    return s;
  }
}

let fails = 0;
const ok = (name, cond, detail = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); if (!cond) fails++; };

function run(steps, frames, setup, watch, opts = {}) {
  const m = new Match({
    stageDef: stageById(opts.stage || 'loading'), skipIntro: true, seed: 3,
    players: [{ def: fighterById(opts.a || 'lunchlady'), ctl: new Script([]) }, { def: fighterById(opts.b || 'lunchlady'), ctl: new NullCtl() }],
    rules: Object.assign({ stocks: 3, time: 0, items: false }, opts.rules),
  });
  const [a, b] = m.fighters;
  // let everyone land first
  for (let i = 0; i < 40; i++) m.update();
  const base = m.frame; a.ctl.steps = [[base + 1, {}]].concat(steps);
  if (setup) setup(a, b, m);
  const log = { minY: 0, maxX: -1e9, states: new Set(), moves: new Set(), maxCharge: 0 };
  for (let i = 0; i < frames && !m.done; i++) {
    m.update();
    log.minY = Math.min(log.minY, a.y); log.maxX = Math.max(log.maxX, a.x);
    log.states.add(a.state); if (a.moveId) log.moves.add(a.moveId); log.maxCharge = Math.max(log.maxCharge, a.charge);
    if (watch) watch(a, b, m, log, i);
  }
  return { a, b, m, log };
}

// 1. jump heights
let r = run([[20, { jump: true }]], 80);
ok('full hop is about 150px', r.log.minY < -125 && r.log.minY > -185, `apex ${r.log.minY.toFixed(0)}`);
r = run([[1, { jump: true }]], 80);
ok('tapping jump gives a short hop', r.log.minY < -40 && r.log.minY > -85, `apex ${r.log.minY.toFixed(0)}`);
r = run([[20, { jump: true }], [12, {}], [10, { jump: true }]], 110);
ok('double jump goes higher', r.log.minY < -200, `apex ${r.log.minY.toFixed(0)}`);
r = run([[8, { y: -1 }]], 80);
ok('UP jumps (tap jump)', r.log.minY < -40, `apex ${r.log.minY.toFixed(0)}`);

// 2. movement
r = run([[60, { x: 1 }]], 60);
ok('holding a direction runs', r.log.states.has('run') && r.a.x > 60, `x ${r.a.x.toFixed(0)}`);
r = run([[300, { x: 1 }]], 300);
ok('running off the edge falls, does not hover', !r.a.grounded || r.a.state === 'dead' || r.a.stocks < 3 || r.a.x > 300, `state ${r.a.state}`);

// 3. the right move from the right input
const moveFrom = (inp, want, label) => { const q = run([[2, inp], [30, {}]], 30); ok(label + ' -> ' + want, q.log.moves.has(want), [...q.log.moves].join(',')); };
moveFrom({ attack: true }, 'jab', 'attack');
moveFrom({ attack: true, x: 1 }, 'ftilt', 'forward + attack');
moveFrom({ attack: true, y: -1 }, 'utilt', 'up + attack');
moveFrom({ attack: true, y: 1 }, 'dtilt', 'down + attack');
moveFrom({ strong: true, x: 1 }, 'fsmash', 'forward + strong');
moveFrom({ strong: true, y: -1 }, 'usmash', 'up + strong');
moveFrom({ strong: true, y: 1 }, 'dsmash', 'down + strong');
moveFrom({ special: true }, 'nspecial', 'special');
moveFrom({ special: true, x: 1 }, 'sspecial', 'forward + special');
moveFrom({ special: true, y: -1 }, 'uspecial', 'up + special');
moveFrom({ special: true, y: 1 }, 'dspecial', 'down + special');
moveFrom({ grab: true }, 'grab', 'grab');
r = run([[14, { x: 1 }], [2, { x: 1, attack: true }], [30, {}]], 50);
ok('attack while running -> dash attack', r.log.moves.has('dash'), [...r.log.moves].join(','));
r = run([[1, { jump: true }], [8, {}], [2, { attack: true, x: 1 }], [40, {}]], 50);
ok('forward + attack in the air -> fair', r.log.moves.has('fair'), [...r.log.moves].join(','));
r = run([[1, { jump: true }], [8, {}], [2, { attack: true, y: 1 }], [40, {}]], 50);
ok('down + attack in the air -> dair', r.log.moves.has('dair'), [...r.log.moves].join(','));
r = run([[3, { y: -1 }], [2, { y: -1, attack: true }], [30, {}]], 40);
ok('up, then attack a moment later -> still an up attack (not a jump)', r.log.moves.has('utilt') || r.log.moves.has('uair'), [...r.log.moves].join(','));

// 4. charging a strong attack
r = run([[45, { strong: true, x: 1 }], [40, {}]], 90);
ok('holding strong charges it', r.log.maxCharge > 25, `charge ${r.log.maxCharge}`);

// 5. shield, roll, sidestep, air dodge
r = run([[20, { shield: true }], [2, { shield: true, x: -1 }], [40, {}]], 60);
ok('shield then tap sideways rolls', r.log.states.has('shield') && r.log.states.has('roll'), [...r.log.states].join(','));
r = run([[20, { shield: true }], [2, { shield: true, y: 1 }], [40, {}]], 60);
ok('shield then tap down sidesteps', r.log.states.has('spotdodge'), [...r.log.states].join(','));
r = run([[1, { jump: true }], [10, {}], [2, { shield: true }], [50, {}]], 60);
ok('shield in the air is a dodge', r.log.states.has('airdodge'), [...r.log.states].join(','));

// 6. hitting, shielding, grabbing
r = run([[2, { attack: true, x: 1 }], [40, {}]], 40, (a, b) => { b.x = a.x + 46; a.facing = 1; });
ok('a tilt in range does damage', r.b.pct > 0, `victim ${r.b.pct.toFixed(1)}%`);
r = run([[2, { grab: true }], [26, {}], [3, { x: 1 }], [60, {}]], 90, (a, b) => { b.x = a.x + 40; a.facing = 1; });
ok('grab then forward throws', r.b.pct > 0 && r.log.moves.has('fthrow'), `victim ${r.b.pct.toFixed(1)}% moves ${[...r.log.moves].join(',')}`);
r = run([[50, { strong: true, x: 1 }], [60, {}]], 110, (a, b) => { b.x = a.x + 50; b.pct = 160; a.facing = 1; });
ok('a charged smash at 160% is a KO', r.b.stocks < 3 || r.b.state === 'dead', `victim stocks ${r.b.stocks} state ${r.b.state}`);

// 7. ledges
r = run([[200, {}]], 60, (a) => { a.x = -300; a.y = -10; a.grounded = false; a.ground = null; a.vy = 2; a.facing = 1; a.setState('air'); }, (a, b, m, log) => { if (a.state === 'ledge') log.ledge = true; });
ok('falling next to an edge grabs it', r.log.ledge === true, `state ${r.a.state} x ${r.a.x.toFixed(0)} y ${r.a.y.toFixed(0)}`);
r = run([[30, {}], [4, { y: -1 }], [60, {}]], 100, (a) => { a.x = -300; a.y = -10; a.grounded = false; a.ground = null; a.vy = 2; a.setState('air'); });
ok('up from the ledge climbs onto the stage', r.a.grounded && r.a.x > -290 && r.a.x < 0, `state ${r.a.state} x ${r.a.x.toFixed(0)}`);

// 8. KOs and the end of the match
r = run([[400, {}]], 400, (a, b) => { b.x = 2000; }, null, { rules: { stocks: 1 } });
ok('last stock gone ends the match with the survivor first', r.m.result && r.m.result.order[0] === 0, r.m.result ? 'order ' + r.m.result.order.join(',') : 'no result');
r = run([[400, {}]], 400, (a, b) => { b.x = 2000; });
ok('with stocks left you come back', r.b.stocks === 2 && r.b.state !== 'dead', `stocks ${r.b.stocks} state ${r.b.state}`);
r = run([[200, {}]], 200, null, null, { rules: { stocks: 0, time: 2 } });
ok('a timed match ends on the clock', !!r.m.result && r.m.result.reason === 'time', r.m.result ? r.m.result.reason : 'no result');

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
