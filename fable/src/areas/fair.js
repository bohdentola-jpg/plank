// Harvest Fairgrounds — a midway, a corn maze, and the Haymakers' field on the
// far side of it. Region obstacle: hay bales (shove them; later they sit on the
// field during the match).
import * as THREE from 'three';
import { G } from '../core/game.js';
import { toon, M, box } from '../art/kit.js';
import { makeRng } from '../core/util.js';
import { NPCS } from '../data/npcs.js';
import { CAST } from '../data/cast.js';
import { flag, setFlag, addGear } from '../game/state.js';
import * as st from '../game/story2.js';

const W = 104, D = 60;
const MX = 38, MZ = 18, CELL = 2.6;
// # corn  . path  B hay bale (shove)  g gap for someone small  P pickups
const MAZE = [
  '#############',
  '#.....#...P##',
  '#.###.#g#####',
  '..#.........#',
  '#.#.###..##B#',
  '#.#...#..#...',
  '#.###.#####.#',
  '#P..#....P#.#',
  '#############',
];
const cx = (c) => MX + (c + 0.5) * CELL, cz = (r) => MZ + (r + 0.5) * CELL;

export default {
  id: 'fair', name: 'Harvest Fairgrounds', sub: 'Mind the bales',
  w: W, d: D, spawn: [8, 31], seed: 21,
  ground: '#b7b866', edge: 0x7a5a48,
  music: (S) => (S.tod === 'night' ? 'night' : 'fair'),

  paint(g, S) {
    g.speckle(0, 0, W, D, 300, ['#aab05c', '#c4c472', '#bcbc68'], 0.6, 1.8);
    // midway dirt
    g.rect(2, 4, 34, 52, '#d9c08a', 3);
    g.speckle(2, 4, 34, 52, 240, ['#cdb27c', '#e6d09c', '#c2a670'], 0.08, 0.2);
    g.path([[0, 31], [36, 31], [38, cz(3)]], 4, '#e8d4a0');
    g.path([[20, 31], [20, 14]], 3, '#e8d4a0'); g.path([[12, 31], [12, 44]], 3, '#e8d4a0'); g.path([[27, 31], [27, 22]], 3, '#e8d4a0');
    // maze floor
    g.rect(MX, MZ, 13 * CELL, 9 * CELL, '#c9a86a');
    g.speckle(MX, MZ, 13 * CELL, 9 * CELL, 200, ['#bd9a5c', '#d6b87c', '#e8c95a'], 0.06, 0.16);
    g.path([[cx(12), cz(5)], [78, cz(5)]], 3, '#e8d4a0');
    // the Haymakers' field
    g.field(76, 24, 26, 15, { name1: 'HAY', name2: 'MAKERS', ez1: '#f08a24', ez2: '#8a5a34', c1: '#a9b85a', c2: '#b6c466', ez: 3 });
    g.speckle(0, 0, W, D, 500, ['#e8842c', '#d4502f', '#f2b632', '#e8c95a'], 0.07, 0.17);
    g.tufts(0, 0, 36, D, 80, '#8f9a4a');
    g.text('◀ BUS', 4, 28.6, 0.8, 'rgba(90,60,40,0.6)');
  },

  build(w, S) {
    const r = makeRng(5);
    const ch = S.chapter;

    // ---------------- midway
    w.put('busStop', 6, 27.6, { text: 'BUS' });
    w.interact(6, 29.6, { r: 1.8, label: 'Take the bus', fn: () => st.busStop(w) });
    w.put('bus', 5.4, 35.4, { text: 'HOLLOW LINE' });
    w.put('ferrisWheel', 20, 9, {});
    w.onUpdate((dt) => { const f = w.dynRoot.children.find((o) => o.userData.spin); if (f) f.userData.spin.rotation.z += dt * 0.25; });
    w.put('tent', 8, 13, { color: 0xd4502f }); w.put('tent', 31, 12, { color: 0x2a6f77 }); w.put('tent', 31, 50, { color: 0xf2b632, r: 2.1 });
    w.bunting(4, 22, 20, 22, { y: 3.4 }); w.bunting(20, 22, 35, 22, { y: 3.4 }); w.bunting(4, 40, 20, 40, { y: 3.4 }); w.bunting(20, 40, 35, 40, { y: 3.4 });
    w.put('booth', 14, 19.6, { text: 'HOT CIDER', color: 0xd4502f });
    w.interact(14, 21.4, { r: 1.6, label: 'Buy hot cider (15 coins)', fn: () => st.ciderStand(w) });
    w.put('booth', 27, 19.6, { text: 'FIELD GOAL GOLF', color: 0x3f7a52 });
    w.npc('par', 27, 21.6, { ...NPCS.par, face: 0, mark: S.best.golf ? null : '!', talk: () => st.par(w) });
    w.put('goalpost', 31.4, 19.6, { w: 2.4, pad: false }).scale.setScalar(0.5);
    w.put('stage', 10, 47.6, {});
    w.npc('ringmaster', 14.6, 43.4, { ...NPCS.ringmaster, face: 0.4, mark: S.best.mascot ? null : '!', talk: () => st.rind(w) });
    if (!S.roster.includes('cheese')) w.npc('cheese', 6.4, 43.2, { spec: CAST.cheese.spec, name: 'Big Cheese', face: 0.6, talk: () => st.bigCheese(w) });
    w.bench(22, 28.4); w.put('balloons', 17.4, 20, { seed: 1 }); w.put('balloons', 23.6, 20, { seed: 3 });
    for (const [x, z] of [[4, 20], [34, 26], [24, 36], [3.6, 50], [34.4, 44]]) w.put('hayBale', x, z, {});
    for (const [x, z, s] of [[26, 46, 1.2], [27.2, 47, 0.8], [16, 34.6, 1], [33, 34.5, 0.9], [9, 24, 0.8]]) w.put('pumpkin', x, z, { s });
    for (const [x, z] of [[10, 27.6], [30, 28], [20, 42]]) { w.put('lamp', x, z); w.light(x, 3.4, z + 0.4, 0xffc65a, 26, 11); }
    w.put('scarecrowPost', 35, 22);
    w.npc('crowe', 35, 30.6, { ...NPCS.crowe, face: -1.2, talk: () => st.corvina(w) });
    if (!flag('fair_seen')) w.trigger(10, 31, 5, 6, () => st.fairArrive(w), { once: 'fair_seen_t' });

    // ---------------- corn everywhere that isn't path
    w.put('cornBlock', MX + 13 * CELL / 2, 9, { w: 13 * CELL, d: 18, seed: 3, gap: 1.25 });
    w.put('cornBlock', MX + 13 * CELL / 2, 50.7, { w: 13 * CELL, d: 18.6, seed: 4, gap: 1.25 });
    w.put('cornBlock', 37, 9.5, { w: 1.6, d: 19, seed: 5 }); w.put('cornBlock', 37, 46, { w: 1.6, d: 28, seed: 6 });
    MAZE.forEach((row, rr) => {
      let run = -1;
      for (let c = 0; c <= row.length; c++) {
        const k = row[c];
        if (k === '#') { if (run < 0) run = c; continue; }
        if (run >= 0) { const n = c - run; w.put('cornBlock', MX + (run + n / 2) * CELL, cz(rr), { w: n * CELL, d: CELL, seed: rr * 17 + run }); run = -1; }
        if (k === 'B') w.pushable('hayBale', cx(c), cz(rr), { id: `maze_bale_${c}_${rr}`, step: CELL });
        if (k === 'g') {
          const corn = w.put('cornBlock', cx(c), cz(rr), { w: CELL, d: CELL, seed: 9, solid: false, noFade: true });
          corn.scale.y = 0.75;
          w.solid(cx(c), cz(rr), CELL, CELL, 'gap');
          w.gap(cx(c), cz(rr) + CELL / 2 + 0.05, { to: [cx(c), cz(rr - 1)], back: [cx(c), cz(rr + 1)] });
        }
      }
    });
    // loot
    w.pickup(cx(1), cz(7), { id: 'fair_maze_coins', coins: 30 });
    w.pickup(cx(9), cz(7), { id: 'fair_maze_parts', parts: 2 });
    if (!flag('got_fair_cleats')) {
      const chest = w.put('crate', cx(10), cz(1), { s: 1.1 });
      void chest;
      w.interact(cx(9), cz(1), { r: 1.6, solo: true, label: 'Open the crate', fn: async () => {
        if (flag('got_fair_cleats')) return;
        setFlag('got_fair_cleats'); addGear('rocket_cleats');
        await G.ui.say(null, 'Inside the crate: a pair of *Rocket Cleats*, still in the box. Somebody hid these on purpose.');
      } });
    }
    // ---------------- the field beyond
    w.put('goalpost', 76.4, 31.5, { w: 4.4, ry: Math.PI / 2 }); w.put('goalpost', 101.6, 31.5, { w: 4.4, ry: Math.PI / 2 });
    for (let i = 0; i < 6; i++) w.put('hayBale', 79 + i * 4, 22, {});
    for (let i = 0; i < 5; i++) w.put('hayBale', 80 + i * 4.4, 41.4, {});
    w.put('scarecrowPost', 75, 20.5); w.put('scarecrowPost', 102, 42);
    w.npc('stitch', 90, 31.5, { ...NPCS.stitch, face: -1.3, mark: S.wins.haymakers ? null : '!', r: 2.6, talk: () => st.stitch(w) });
    for (const [x, z, n] of [[93, 29, 83], [93.4, 34, 34], [96, 31.5, 79]]) w.npc(`hm${n}`, x, z, { spec: { kind: 'scarecrow', shirt: 0x4a6fa5, helmet: { color: 0x8a5a34, stripe: 0xe8c95a } }, face: -1.4, r: 0 });
    w.bench(80, 45.6); w.put('waterCooler', 84.6, 45.8);
    w.put('signPost', 74.6, 35.4, { text: 'THE\nTHRESHING\nFLOOR', w: 2.4, h: 1.6 });
    for (const [x, z] of [[76, 50], [88, 52], [99, 50], [80, 12], [94, 10], [102, 16]]) w.put('cornBlock', x, z, { w: 7, d: 5, seed: x });

    // ---------------- opponents you can see coming
    const crow = (n) => ({ kind: 'animal', species: 'crow', number: n, jersey: 0x5a3f8a, pants: 0xf4f0e6, helmet: { color: 0x2b2b36, stripe: 0xb07aff } });
    const scare = (n) => ({ kind: 'scarecrow', shirt: 0x4a6fa5, number: n, helmet: { color: 0x8a5a34, stripe: 0xe8c95a } });
    const cond = () => ch >= 2;
    w.enemy({ id: 'fair_crow1', team: 'crows', spec: crow(4), minis: 1, path: [[16, 36], [28, 37], [22, 33]], cond, venue: 'fair' });
    w.enemy({ id: 'fair_crow2', team: 'crows', spec: crow(81), minis: 1, path: [[24, 51], [14, 54]], cond, venue: 'fair' });
    w.enemy({ id: 'fair_sc1', team: 'scarecrows', spec: scare(9), minis: 1, path: [[cx(5), cz(3)], [cx(10), cz(3)]], cond, venue: 'fair', sight: 6 });
    w.enemy({ id: 'fair_sc2', team: 'scarecrows', spec: scare(70), minis: 0, path: [[cx(7), cz(4)], [cx(8), cz(5)]], cond, venue: 'fair', sight: 5 });
    w.enemy({ id: 'fair_sc3', team: 'scarecrows', spec: scare(33), minis: 1, path: [[cx(5), cz(7)], [cx(8), cz(7)]], cond, venue: 'fair', sight: 6 });

    for (const [x, z] of [[2.6, 6], [2.4, 56], [35.4, 6.4], [24, 55.6]]) w.put('tree', x, z, { rng: r });
    void THREE; void toon; void M; void box;
  },
};
