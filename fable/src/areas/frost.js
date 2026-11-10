// Frostbite Falls — a frozen river you cross by sliding. Pick a direction and
// you keep going until something stops you. Region obstacle: ice.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { toon, M, box, cyl, sphere } from '../art/kit.js';
import { makeRng, rand } from '../core/util.js';
import { NPCS } from '../data/npcs.js';
import { CAST } from '../data/cast.js';
import { flag } from '../game/state.js';
import * as st from '../game/story2.js';

const W = 96, D = 58;
const IX = 30, IZ = 20, CELL = 2, COLS = 10, ROWS = 7;      // the sliding puzzle
const ROCKS = [[3, 0], [8, 1], [0, 2], [5, 3], [9, 4], [2, 4], [1, 5], [6, 6]];
const ix = (c) => IX + (c + 0.5) * CELL, iz = (r) => IZ + (r + 0.5) * CELL;

export default {
  id: 'frost', name: 'Frostbite Falls', sub: 'On the ice you don\'t walk — you go',
  w: W, d: D, spawn: [9, 47], seed: 31, snow: true, dust: 0xffffff,
  ground: '#e3edf5', edge: 0x8fa8c4, lip: 0xf4f8fc,
  sky: (S) => (S.tod === 'night' ? 'night' : S.tod === 'dusk' ? 'dusk' : 'snow'),
  music: (S) => (S.tod === 'night' ? 'night' : 'frost'),

  paint(g, S) {
    g.speckle(0, 0, W, D, 320, ['#d6e4ef', '#eef5fa', '#cfdfec'], 0.6, 2.0);
    // the river: open water / thin ice, with the solid sheet in the middle
    g.rect(0, IZ, W, ROWS * CELL, '#7fb4d6');
    g.speckle(0, IZ, W, ROWS * CELL, 120, ['#9cc8e2', '#6aa4c8'], 0.4, 1.4);
    g.rect(IX, IZ, COLS * CELL, ROWS * CELL, '#cfeaf7');
    for (let c = 0; c <= COLS; c++) g.line(IX + c * CELL, IZ, IX + c * CELL, IZ + ROWS * CELL, 0.05, 'rgba(120,170,205,0.5)');
    for (let r = 0; r <= ROWS; r++) g.line(IX, IZ + r * CELL, IX + COLS * CELL, IZ + r * CELL, 0.05, 'rgba(120,170,205,0.5)');
    g.speckle(IX, IZ, COLS * CELL, ROWS * CELL, 26, ['rgba(255,255,255,0.7)'], 0.2, 0.7);
    // dock on the south bank, landing on the north bank
    g.rect(IX, IZ + ROWS * CELL, 2 * CELL, 2, '#b07a45', 0.15);
    g.rect(ix(7) - 1, IZ - 1.6, 2, 1.6, '#d9c9a8', 0.2);
    if (flag('frost_bridge')) { g.rect(52.2, IZ - 0.4, 2.4, ROWS * CELL + 0.8, '#9a6a3a', 0.2); for (let i = 0; i < 12; i++) g.line(52.2, IZ + i * 1.2, 54.6, IZ + i * 1.2, 0.07, '#6a4a2e'); }
    // paths in the snow
    g.path([[0, 47], [20, 47], [31, 38], [32, 36]], 3, '#dfe9f2');
    g.path([[ix(7), 18], [ix(7), 13], [62, 11], [72, 11]], 3, '#dfe9f2');
    if (flag('frost_bridge')) g.path([[53.4, 36], [53.4, 40], [34, 40]], 2.4, '#dfe9f2');
    // the Flurries' pond
    g.field(66, 3, 26, 14, { name1: 'FALLS', name2: 'FLURRY', ez1: '#2a6f9a', ez2: '#8fb7d9', c1: '#dcecf6', c2: '#e9f4fb', line: 'rgba(70,120,170,0.75)', ez: 3 });
    g.text('◀ BUS', 4, 44.6, 0.8, 'rgba(70,110,150,0.7)');
    g.text('THIN ICE', 14, 27, 1.2, 'rgba(255,255,255,0.55)'); g.text('THIN ICE', 74, 27, 1.2, 'rgba(255,255,255,0.55)');
  },

  build(w, S) {
    const r = makeRng(8);
    const ch = S.chapter;
    const night = w.night;

    // ---------------- the village (south bank)
    w.put('busStop', 7, 43.6, { text: 'BUS' });
    w.interact(7, 45.6, { r: 1.8, label: 'Take the bus', fn: () => st.busStop(w) });
    w.put('bus', 6, 51.6, { text: 'HOLLOW LINE' });
    w.put('cabin', 17, 40, {});
    w.put('igloo', 40, 46, {});
    w.put('booth', 26, 49.4, { text: 'COCOA', color: 0xd4502f });
    w.npc('cocoa', 26, 51.4, { ...NPCS.cocoa, face: 0, mark: S.best.snack ? null : '!', talk: () => st.cocoa(w) });
    w.npc('ranger', 14.4, 46.6, { ...NPCS.ranger, face: 0.5, talk: () => st.ranger(w) });
    w.bench(21, 44.4);
    w.put('skiLift', 3.4, 38); w.put('signPost', 27.4, 38.6, { text: 'RIVER\nCROSSING', w: 2.2, h: 1.2 });
    for (const [x, z] of [[12, 44], [34, 42], [46, 50]]) { w.put('lamp', x, z); w.light(x, 3.4, z + 0.4, 0xffc65a, 26, 11); }
    if (!flag('frost_seen')) w.trigger(11, 47, 4, 6, () => st.frostArrive(w), { once: 'frost_seen_t' });

    // ---------------- the river
    w.zone('ice', IX + COLS * CELL / 2, IZ + ROWS * CELL / 2, COLS * CELL, ROWS * CELL, { cell: CELL });
    for (const [c, rr] of ROCKS) { w.put('icicleRock', ix(c), iz(rr), { s: 1.05, solid: false }); w.solid(ix(c), iz(rr), CELL - 0.1, CELL - 0.1); }
    // thin ice either side is off limits
    w.solid(IX / 2, IZ + ROWS * CELL / 2, IX, ROWS * CELL);
    const bridge = flag('frost_bridge');
    if (bridge) {
      w.solid((IX + COLS * CELL + 52.2) / 2, IZ + ROWS * CELL / 2, 52.2 - (IX + COLS * CELL), ROWS * CELL);
      w.solid((54.6 + W) / 2, IZ + ROWS * CELL / 2, W - 54.6, ROWS * CELL);
      for (const x of [52.2, 54.6]) w.fence(x, IZ - 0.4, x, IZ + ROWS * CELL + 0.4, { style: 'rail', solid: false });
    } else w.solid((IX + COLS * CELL + W) / 2, IZ + ROWS * CELL / 2, W - (IX + COLS * CELL), ROWS * CELL);
    // banks: you can only step on from the dock (cols 0-1) and off at the landing (col 7)
    w.wall(IX + 2 * CELL, IZ + ROWS * CELL + 0.15, IX + COLS * CELL, IZ + ROWS * CELL + 0.15);
    w.wall(IX, IZ - 0.15, ix(7) - 1, IZ - 0.15); w.wall(ix(7) + 1, IZ - 0.15, IX + COLS * CELL, IZ - 0.15);
    for (let i = 0; i < 8; i++) w.put('snowPile', IX + 2 * CELL + 1 + i * 2, IZ + ROWS * CELL + 0.7, { s: 0.7 + (i % 3) * 0.12, solid: false });
    for (let i = 0; i < 10; i++) { const x = IX + 1 + i * 2; if (Math.abs(x - ix(7)) > 1.2) w.put('snowPile', x, IZ - 0.7, { s: 0.75 + (i % 2) * 0.15, solid: false }); }
    w.pickup(ix(4), iz(0), { id: 'frost_ice_parts', parts: 3 });
    // log-bridge bell on the far bank
    w.target(53.4, 17.6, { h: 2.2, flag: 'frost_bridge', fn: () => st.bridgeBell(w) });
    w.put('signPost', 56, 17.6, { text: 'RING FOR\nBRIDGE', w: 2, h: 1.1 });

    // ---------------- Slush, marooned
    if (!S.roster.includes('slush')) {
      const free = flag('slush_free');
      const fx = free ? 62 : 62, fz = free ? 19 : 26;
      w.add(M(cyl(1.5, 1.6, 0.3, 9), toon(0xeaf6fc), fx, 0.12, fz), true);
      w.npc('slush', fx, fz, { spec: CAST.slush.spec, name: 'Slush', face: Math.PI, base: free ? 'move' : 'panic', solid: false, r: free ? 2.4 : 0 });
      const buoy = new THREE.Group();
      buoy.add(M(cyl(0.3, 0.4, 0.6, 8), toon(0xd4502f), 0, 0.3, 0)); buoy.add(M(cyl(0.05, 0.05, 1.6, 5), toon(0xfffaf0), 0, 1.2, 0));
      buoy.position.set(66, 0, 26);
      w.add(buoy, true);
      const tg = w.target(66, 26, { h: 2.1, noPost: true, flag: 'slush_free', fn: () => st.slushRescue(w), solid: false });
      void tg;
      w.put('signPost', 64, 17.4, { text: 'BUOY BELL', w: 2, h: 0.8 });
    }

    // ---------------- far bank + the pond
    w.put('goalpost', 66.4, 10, { w: 4.4, ry: Math.PI / 2, color: 0x8fb7d9 }); w.put('goalpost', 91.6, 10, { w: 4.4, ry: Math.PI / 2, color: 0x8fb7d9 });
    w.npc('flurry', 79, 10, { ...NPCS.flurry, face: -1.3, mark: S.wins.flurries ? null : '!', r: 2.6, talk: () => st.avalanche(w) });
    w.npc('avalanche', 82.6, 10.4, { ...NPCS.avalanche, face: -1.3, r: 0 });
    for (const [x, z, n] of [[85, 7.6, 80], [85.4, 12.8, 84]]) w.npc(`fl${n}`, x, z, { spec: { kind: 'snowman', jersey: 0x2a6f9a, number: n, helmet: { color: 0x2a6f9a, stripe: 0xffffff } }, face: -1.4, r: 0 });
    w.bench(70, 18); w.put('waterCooler', 74.6, 18.2);
    w.put('cabin', 20, 9, {}); w.put('igloo', 58, 5, {});
    w.pickup(22, 15.4, { id: 'frost_far_coins', coins: 45 });

    // ---------------- opponents
    const peng = (n) => ({ kind: 'animal', species: 'penguin', build: 'small', number: n, jersey: 0x2a6f9a, pants: 0xf4f0e6, helmet: { color: 0x2a6f9a, stripe: 0xffffff } });
    const snow = (n) => ({ kind: 'snowman', jersey: 0x2a6f9a, number: n, helmet: { color: 0x2a6f9a, stripe: 0xffffff } });
    const cond = () => ch >= 3;
    w.enemy({ id: 'fr_peng1', team: 'penguins', spec: peng(5), minis: 1, path: [[30, 52], [42, 53], [36, 49]], cond, venue: 'frost' });
    w.enemy({ id: 'fr_peng2', team: 'penguins', spec: peng(80), minis: 2, path: [[52, 44], [62, 48]], cond, venue: 'frost' });
    w.enemy({ id: 'fr_snow1', team: 'snowpatrol', spec: snow(12), minis: 1, path: [[36, 12], [46, 8], [40, 15]], cond, venue: 'frost' });
    w.enemy({ id: 'fr_snow2', team: 'snowpatrol', spec: snow(72), minis: 1, path: [[10, 12], [16, 16]], cond, venue: 'frost' });

    // ---------------- pines + drifting snow
    const pines = [[2.5, 4], [9, 6], [28, 5], [34, 9], [50, 4], [62, 15.4], [94, 20.4], [93, 2.4], [2.6, 17], [24, 36.4], [48, 39], [58, 52], [70, 44], [80, 50], [90, 42], [93, 54], [14, 54.6], [34, 55]];
    for (const [x, z] of pines) w.put('tree', x, z, { kind: 'pine', snow: true, rng: r });
    for (const [x, z] of [[44, 37.6], [10, 40.4], [66, 38], [84, 36.5], [46, 16.4]]) w.put('icicleRock', x, z, { s: 0.7 + r() * 0.4 });
    w.onUpdate((dt) => { if (Math.random() < dt * 14) { const c = w.camTarget; w.fx.emit('snow', c.x + rand(-16, 16), 10, c.z + rand(-10, 8), { vx: rand(-0.6, -0.1), vy: -2.2, vz: rand(0.1, 0.5), g: 0, life: 4.5, s0: 0.16, s1: 0.16, color: 0xffffff }); } });
    void box; void sphere; void night;
  },
};
