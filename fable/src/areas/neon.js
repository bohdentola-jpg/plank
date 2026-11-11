// Neon Boardwalk — a seaside pier where the signs still say OPEN and nothing
// is. At the far end: the Buzzer Dome, dark until you find its three breakers.
// Region obstacle: flickering lights (in the dome, reads disappear in the dark).
import * as THREE from 'three';
import { G } from '../core/game.js';
import { toon, lit, M, box, cyl, rbox, glowSprite } from '../art/kit.js';
import { makeRng } from '../core/util.js';
import { NPCS } from '../data/npcs.js';
import { CAST } from '../data/cast.js';
import { flag } from '../game/state.js';
import * as st from '../game/story2.js';

const W = 100, D = 46;

export default {
  id: 'neon', name: 'Neon Boardwalk', sub: 'OPEN (sign is broken)',
  w: W, d: D, spawn: [7, 25], seed: 44, alwaysNight: true,
  ground: '#3a3157', edge: 0x241c46, lip: 0x5a4f8a,
  sky: () => 'neon', music: 'neon',

  paint(g, S) {
    g.speckle(0, 0, W, D, 200, ['#342c50', '#41385f'], 0.6, 1.8);
    // boardwalk planks
    g.rect(0, 16, W, 18, '#8a6a52');
    for (let x = 0; x < W; x += 1.1) g.line(x, 16, x, 34, 0.05, 'rgba(50,30,40,0.45)');
    for (const z of [16, 22, 28, 34]) g.line(0, z, W, z, 0.08, 'rgba(50,30,40,0.5)');
    // the sea + pier
    g.rect(0, 34, W, 12, '#1f3a6a');
    g.speckle(0, 34, W, 12, 90, ['#2a4a80', '#3a5f9a', '#18305a'], 0.3, 1.2);
    g.rect(38, 34, 4, 11, '#8a6a52'); for (let z = 34; z < 45; z += 1.1) g.line(38, z, 42, z, 0.05, 'rgba(50,30,40,0.45)');
    // neon spill on the boards
    for (const [x, c] of [[14, '255,90,208'], [30, '88,230,255'], [48, '255,212,90'], [66, '182,240,138'], [84, '88,230,255']]) { const s = g.s; const c2 = g.c; const gr = c2.createRadialGradient(x * s, 17 * s, 0, x * s, 17 * s, 9 * s); gr.addColorStop(0, `rgba(${c},0.32)`); gr.addColorStop(1, `rgba(${c},0)`); c2.fillStyle = gr; c2.fillRect((x - 9) * s, 14 * s, 18 * s, 14 * s); }
    g.rect(60, 4, 9, 9, '#4a4266', 0.4);
    g.text('◀ BUS', 4, 22.6, 0.8, 'rgba(255,255,255,0.5)');
  },

  build(w, S) {
    const r = makeRng(3);
    const ch = S.chapter;
    const lit3 = [1, 2, 3].filter((i) => flag(`neon_b${i}`)).length;

    // ---------------- arrival + shopfronts along the north side
    w.put('busStop', 6, 18.4, { text: 'BUS' });
    w.interact(6, 20.4, { r: 1.8, label: 'Take the bus', fn: () => st.busStop(w) });
    w.put('bus', 6, 11.4, { text: 'HOLLOW LINE' });
    if (!flag('neon_seen')) w.trigger(10, 25, 4, 10, () => st.neonArrive(w), { once: 'neon_seen_t' });
    const shop = (x, wd, col, sign, neon) => {
      w.add(M(rbox(wd, 4.2, 6, 0.2), toon(col), x, 2.1, 10));
      w.solid(x, 10, wd, 6);
      w.put('neonSign', x, 13.2, { text: sign, color: neon, w: Math.min(wd - 1, 5), h: 1.1, y: 3.3, wall: true, solid: false });
      w.light(x, 3, 14.6, neon, 22, 10);
    };
    shop(16, 8, 0x4a3f7a, 'FRIES', 0xffd45a);
    shop(27, 9, 0x3a2f6e, 'ARCADE', 0xff5ad0);
    shop(39, 8, 0x4a3a6a, 'TAFFY', 0x58e6ff);
    shop(50, 8, 0x3f356a, 'OPEN', 0xb6f08a);
    w.npc('skipper', 15.4, 15, { ...NPCS.skipper, face: 0, talk: () => st.skipper(w) });
    for (let i = 0; i < 4; i++) w.put('arcadeCabinet', 23.6 + i * 2.2, 14.4, { color: [0x5a3f8a, 0x2a3a6a, 0x8a2f6a, 0x3f7a52][i], neon: [0x58e6ff, 0xff5ad0, 0xffd45a, 0xb6f08a][i] });
    w.npc('tokens', 32.6, 15.2, { ...NPCS.tokens, face: 0, mark: flag('tokens_met') ? null : '!', label: 'Play the arcade', talk: async () => { G.S.flags.tokens_met = true; await st.tokens(w); } });
    for (const x of [11, 34, 45, 56, 74]) w.put('palm', x, 15.4, {});
    for (const x of [20, 46, 70]) { w.put('lamp', x, 33); }
    w.bench(52, 16.6); w.put('trashcan', 44.4, 15.6);
    // railing along the sea, with the pier opening
    w.fence(0, 34, 38, 34, { style: 'rail', color: 0xd9dde2 }); w.fence(42, 34, W, 34, { style: 'rail', color: 0xd9dde2 });
    w.fence(38, 34, 38, 45, { style: 'rail', color: 0xd9dde2 }); w.fence(42, 34, 42, 45, { style: 'rail', color: 0xd9dde2 }); w.fence(38, 45, 42, 45, { style: 'rail', color: 0xd9dde2 });
    // the sea (with the pier carved out of it)
    w.solid(19, 40.4, 38, 11.6, 'low'); w.solid(71, 40.4, 58, 11.6, 'low');
    for (const [x, z] of [[38, 36], [42, 36], [38, 44.6], [42, 44.6]]) w.put('pierPost', x, z, { solid: false });

    // ---------------- breaker 1: a switch on a buoy pole past the end of the pier — needs an arm
    const b = (n) => flag(`neon_b${n}`);
    w.add(M(cyl(0.12, 0.12, 2.6, 6), toon(0x6a7480), 40, 1.3, 45.4));
    w.target(40, 45.4, { h: 2.6, noPost: true, flag: 'neon_b1', solid: false, fn: () => st.breaker(w, 1, 'CLUNK. The pier breaker snaps over. A string of bulbs along the railing stutters awake.') });
    if (b(1)) for (let i = 0; i < 9; i++) w.add(M(new THREE.SphereGeometry(0.14, 6, 5), lit(0xffe9a8, 0xffc65a, 1.6), 4 + i * 4, 1.2, 34), true);

    // ---------------- breaker 2: inside the utility cage — only the vent is open
    w.fence(60, 4, 69, 4, { style: 'chain' }); w.fence(60, 13, 69, 13, { style: 'chain' }); w.fence(69, 4, 69, 13, { style: 'chain' });
    w.fence(60, 4, 60, 9.4, { style: 'chain' }); w.fence(60, 10.6, 60, 13, { style: 'chain' });
    w.solid(60, 10, 0.5, 1.2, 'gap');
    w.gap(60, 10, { to: [61.6, 10], back: [58.4, 10], ry: Math.PI / 2 });
    w.add(M(rbox(1.2, 1.8, 0.6, 0.08), toon(0x6a7480), 66.4, 0.9, 5.2)); w.solid(66.4, 5.2, 1.2, 0.6);
    w.add(M(box(0.3, 0.5, 0.1), b(2) ? lit(0xb6f08a, 0xb6f08a, 1.5) : toon(0xd4502f), 66.4, 1.3, 5.54), true);
    if (!b(2)) w.interact(66.4, 6.6, { r: 1.5, solo: true, label: 'Flip the breaker', fn: () => st.breaker(w, 2, 'The cage breaker thunks down. The utility fans spin up with a groan.') });
    w.put('signPost', 57.4, 12.6, { text: 'DANGER\nVERY SMALL\nVENT', w: 2, h: 1.5 });

    // ---------------- breaker 3: a dead arcade cabinet is shoved up against it
    w.add(M(rbox(8, 4.2, 6, 0.2), toon(0x3a2f6e), 76, 2.1, 6)); w.solid(76, 6, 8, 6);
    w.add(M(rbox(1.0, 1.5, 0.3, 0.06), toon(0x6a7480), 74, 1.1, 9.1));
    w.add(M(box(0.3, 0.5, 0.1), b(3) ? lit(0xb6f08a, 0xb6f08a, 1.5) : toon(0xd4502f), 74, 1.3, 9.3), true);
    w.pushable('arcadeCabinet', 74, 9.65, { id: 'neon_cab', step: 2, color: 0x2b2438, neon: 0x555066 });
    if (!b(3)) w.interact(74, 9.5, { r: 0.8, label: 'Flip the breaker', fn: () => st.breaker(w, 3, 'Sparks, then a hum. The alley breaker is live.') });
    w.put('signPost', 77.4, 12, { text: 'OUT OF\nORDER', w: 1.8, h: 1.1 });

    // ---------------- the Buzzer Dome
    w.put('arenaFront', 88, 8.6, { text: 'BUZZER DOME', lit: lit3 >= 3 });
    w.interact(88, 12.6, { r: 2.4, label: lit3 >= 3 ? 'Enter the Buzzer Dome' : 'Try the dome doors', fn: () => st.dome(w), mark: lit3 >= 3 && !S.wins.buzzers ? '!' : null, markY: 3.4 });
    for (let i = 0; i < 3; i++) w.add(M(new THREE.SphereGeometry(0.3, 8, 6), b(i + 1) ? lit(0xb6f08a, 0xb6f08a, 1.6) : toon(0x4a4458), 86.6 + i * 1.4, 3.3, 11.2), true);
    w.bench(80, 16.6);

    // ---------------- Sal, the gull who takes things
    if (!S.roster.includes('sal') && ch >= 4) {
      const stage = flag('sal_2') ? 2 : flag('sal_1') ? 1 : 0;
      const [sx, sz] = [[22, 26], [58, 30], [40, 43]][stage];
      w.npc('sal', sx, sz, { spec: CAST.sal.spec, name: 'Sal', face: 0.6, mark: '!', talk: () => st.sal(w, stage) });
    }

    // ---------------- opponents
    const gull = (n) => ({ kind: 'animal', species: 'seagull', number: n, jersey: 0x2a6f77, pants: 0xf4f0e6, helmet: { color: 0xf2b632, stripe: 0xffffff } });
    const bot = (n, neon) => ({ kind: 'robot', neon, jersey: 0xd63f8c, number: n });
    const cond = () => ch >= 4;
    w.enemy({ id: 'ne_gull1', team: 'gulls', spec: gull(7), minis: 1, path: [[16, 28], [30, 30], [24, 24]], cond, venue: 'neon' });
    w.enemy({ id: 'ne_gull2', team: 'gulls', spec: gull(81), minis: 1, path: [[46, 22], [54, 26]], cond, venue: 'neon' });
    w.enemy({ id: 'ne_bot1', team: 'tokens', spec: bot(8, 0x58e6ff), minis: 1, path: [[62, 22], [72, 28], [66, 18]], cond, venue: 'neon' });
    w.enemy({ id: 'ne_bot2', team: 'tokens', spec: bot(74, 0xffd45a), minis: 2, path: [[78, 24], [92, 26]], cond, venue: 'neon' });
    w.pickup(96, 30, { id: 'neon_coins', coins: 60 }); w.pickup(62, 7, { id: 'neon_cage_parts', parts: 3 });
    for (const [x, c] of [[14, 0xff5ad0], [48, 0xffd45a], [84, 0x58e6ff]]) { const gl = glowSprite(c, 12, 0.18); gl.position.set(x, 2.5, 18); w.add(gl, true); }
    void r;
  },
};
