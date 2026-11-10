// Backyard Borough — a cul-de-sac's worth of back lawns. The championship field
// is painted across several of them (crookedly). Region obstacle: sprinklers.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { toon, M, rbox, box, cyl } from '../art/kit.js';
import { makeRng } from '../core/util.js';
import { NPCS } from '../data/npcs.js';
import { teamSpec, CAST } from '../data/cast.js';
import { flag, setFlag, addGear } from '../game/state.js';
import * as story from '../game/story.js';

const W = 84, D = 62;
const LAWNS = [
  // x, z, w, d, colour A, colour B
  [2, 13, 15, 21, '#86bb5c', '#93c768'],    // yard A (fenced, the squeeze puzzle)
  [17, 13, 19, 21, '#8fc463', '#9bce6f'],   // yard B (Pip's roof)
  [48, 13, 18, 21, '#84b85a', '#90c466'],   // yard C (sprinkler gauntlet)
  [66, 13, 16, 21, '#8cc060', '#98cc6c'],   // yard D (crates)
];

export default {
  id: 'borough', name: 'Backyard Borough', sub: 'Mind the sprinklers',
  w: W, d: D, spawn: [42, 3.4], seed: 9,
  ground: '#89bb5e', edge: 0x7a5a48,
  music: (S) => (S.tod === 'night' ? 'night' : 'borough'),

  paint(g, S) {
    g.speckle(0, 0, W, D, 240, ['#80b257', '#95c468'], 0.6, 1.8);
    // the street along the top
    g.rect(0, 0, W, 5.2, '#8d8a96'); g.rect(0, 4.6, W, 1.2, '#d9d2c2');
    for (let x = 1; x < W; x += 3.2) g.rect(x, 2.4, 1.6, 0.22, '#f4efdf');
    for (const [x, z, w, d, a, b] of LAWNS) g.stripes(x, z, w, d, a, b, 1.5, (x / 2) % 2 < 1);
    // lane down the middle
    g.path([[42, 0], [42, 35]], 4.6, '#cdb684'); g.path([[42, 0], [42, 35]], 4.0, '#e6d3a4');
    g.speckle(40, 5, 4, 30, 40, ['#d9c594', '#efdfb6'], 0.06, 0.15);
    // ---- the crooked field: four lawns' worth of slightly mismatched paint
    const fx = 12, fz = 36, fw = 58, fd = 13.4;
    const cols = [['#7fb655', '#8cc261'], ['#88be5c', '#95ca69'], ['#7cb252', '#89be5f'], ['#86bc5a', '#93c867']];
    for (let i = 0; i < 4; i++) g.stripes(fx + i * (fw / 4), fz, fw / 4, fd, cols[i][0], cols[i][1], fw / 40, true);
    g.rect(fx, fz, 5, fd, 'rgba(212,80,47,0.85)'); g.rect(fx + fw - 5, fz, 5, fd, 'rgba(63,111,181,0.85)');
    const lc = 'rgba(255,255,255,0.9)';
    for (let i = 0; i <= 10; i++) {
      const x = fx + 5 + i * 4.8;
      const wob = ((i * 7) % 5 - 2) * 0.12;       // nobody owned a ruler
      g.line(x + wob, fz + 0.2, x - wob, fz + fd - 0.2, 0.16, lc);
    }
    g.path([[fx, fz], [fx + fw, fz + 0.3], [fx + fw - 0.2, fz + fd], [fx + 0.3, fz + fd - 0.2]], 0.2, lc, { close: true });
    g.text('GNOMES', fx + 2.5, fz + fd / 2, 1.5, '#fff4dc', { rot: -Math.PI / 2 });
    g.text('VISITORS', fx + fw - 2.5, fz + fd / 2, 1.3, '#fff4dc', { rot: Math.PI / 2 });
    g.text('50', fx + fw / 2, fz + 2.2, 1.5, 'rgba(255,255,255,0.8)');
    g.circle(fx + fw / 2, fz + fd / 2, 1.5, 'rgba(255,255,255,0.3)');
    // flowerbed the field runs straight through ("one very upset flowerbed")
    g.ellipse(33, 48.6, 2.4, 1.1, '#8a6a4a'); g.speckle(31, 47.8, 4, 1.6, 26, ['#f7b9c2', '#ffd45a', '#ffffff', '#d4502f'], 0.1, 0.18);
    // block party lawn + dash track
    g.rect(49, 51.4, 34, 10, '#93c768', 1.2);
    g.rect(52, 55.8, 28, 2.6, '#e6d3a4', 0.4);
    for (let i = 0; i <= 14; i++) g.line(52 + i * 2, 55.8, 52 + i * 2, 58.4, 0.08, 'rgba(160,120,70,0.5)');
    g.text('LAWN DASH', 66, 57.1, 1.1, 'rgba(120,80,40,0.55)');
    // the Acorn twins' yard
    g.stripes(4, 51.4, 30, 9.6, '#84b85a', '#91c467', 1.5, false);
    g.frame(8, 53, 22, 6.4, 'rgba(255,255,255,0.75)', 0.14, 0.3);
    g.line(19, 53, 19, 59.4, 0.12, 'rgba(255,255,255,0.75)');
    // paths
    g.path([[42, 35], [42, 36]], 4, '#e6d3a4');
    g.path([[42, 49.4], [42, 56], [48, 56]], 2.6, '#e6d3a4');
    g.path([[76, 34], [76, 51]], 2.4, '#e6d3a4');
    // leaves + tufts
    g.speckle(0, 5, W, D - 5, 520, ['#e8842c', '#d4502f', '#f2b632', '#c9652a'], 0.07, 0.17);
    g.tufts(0, 6, W, D - 6, 140, '#6c9c49');
    for (const [x, z] of [[9, 9], [26, 9], [57, 9], [74, 9]]) g.shade(x, z + 1, 6, 4, 0.2);
    g.text('▲ HUDDLE HOLLOW', 42, 1.2, 0.8, 'rgba(255,255,255,0.75)');
  },

  build(w, S) {
    const r = makeRng(77);
    const chapter = S.chapter;

    // ---------------- the row of houses (we see their back doors)
    w.put('house', 9, 9.2, { w: 7, d: 5.4, wall: 0xf2d9b8, roof: 0x2a6f77, doorC: 0xd4502f });
    w.put('house', 26, 9.2, { w: 7, d: 5.4, wall: 0xf7efe0, roof: 0xc8452d, doorC: 0x2a6f77, chimney: false });
    w.put('house', 57, 9.2, { w: 7, d: 5.4, wall: 0xdfeedd, roof: 0x8a5aa8, doorC: 0xf08a24 });
    w.put('house', 74, 9.2, { w: 7, d: 5.4, wall: 0xf2e2c4, roof: 0x5a4a5e, doorC: 0x6aa84f, hip: true });
    // fences along the back of the street
    for (const [a, b] of [[0.5, 5], [13, 22], [30, 39.6], [44.4, 53], [61, 70], [78, 83.5]]) w.fence(a, 12, b, 12, { style: 'picket' });
    // yard dividers
    w.fence(17, 12, 17, 23.6, { style: 'wood' }); w.fence(17, 26.4, 17, 34, { style: 'wood' });
    w.fence(36, 12, 36, 19.6, { style: 'picket' }); w.fence(36, 23.4, 36, 34, { style: 'picket' });
    w.fence(48, 12, 48, 25.6, { style: 'picket' }); w.fence(48, 29.4, 48, 34, { style: 'picket' });
    w.fence(66, 12, 66, 17.6, { style: 'wood' }); w.fence(66, 21.4, 66, 34, { style: 'wood' });
    w.fence(2, 12, 2, 34, { style: 'wood' }); w.fence(82, 12, 82, 34, { style: 'wood' });
    // south edge of the yards (gaps lead onto the field)
    w.fence(2, 34, 17, 34, { style: 'wood' });
    w.fence(17, 34, 22, 34, { style: 'picket' }); w.fence(31, 34, 36, 34, { style: 'picket' });
    w.fence(48, 34, 59.6, 34, { style: 'picket' }); w.fence(63.4, 34, 66, 34, { style: 'picket' });
    w.fence(66, 34, 74.4, 34, { style: 'wood' }); w.fence(77.6, 34, 82, 34, { style: 'wood' });

    // ---------------- yard B: Pip is stuck on the roof
    if (!S.roster.includes('pip')) {
      w.npc('pip', 25.2, 11.25, { spec: teamSpec('pip'), name: 'Pip', y: 4.5, base: flag('pip_ladder') ? 'move' : 'dead', expr: flag('pip_ladder') ? 'open' : 'closed', face: 0, solid: false });
      w.npc('quill', 21.5, 16.2, { ...NPCS.quill, face: 0.6, mark: flag('quill_met') ? null : '!', talk: async () => { setFlag('quill_met'); await story.quill(w); } });
      // a spare football resting in the gutter
      w.add(M(new THREE.SphereGeometry(0.16, 8, 6), toon(0x8a4a26), 27.4, 3.65, 12.1, { sz: 1.6 }));
    } else {
      w.npc('quill', 21.5, 16.2, { ...NPCS.quill, face: 0.6, talk: () => story.quill(w), wander: 1.5 });
    }
    w.target(29.2, 12.55, { h: 3.0, noPost: true, flag: 'pip_ladder', fn: () => story.pipLadder(w), solid: false });
    if (flag('pip_ladder')) w.put('ladder', 25.6, 12.6, { h: 3.6 });
    else w.add(M(box(0.66, 0.1, 3.4), toon(0xb07a45), 25.6, 3.3, 12.05));
    w.put('picnicTable', 31, 19, { cloth: 0xd4502f });
    w.put('grill', 33.6, 15.5); w.put('clothesline', 23, 28.5, { len: 6 });
    w.put('flowers', 20, 13.2, { n: 7 }); w.put('birdbath', 27, 24);
    w.put('tree', 19.6, 31, { rng: r, s: 0.9 });

    // ---------------- yard A: fenced in — only someone small fits through the hole
    const gateOpen = flag('yardA_open');
    if (!gateOpen) { w.fence(17, 23.6, 17, 26.4, { style: 'picket', color: 0xd4502f }); }
    w.gap(17, 30.4, { to: [15.4, 30.4], back: [18.6, 30.4], ry: Math.PI / 2 });
    w.solid(17, 30.4, 0.6, 1.2, 'gap');
    if (!gateOpen) {
      w.interact(15.8, 25, { r: 1.5, label: 'Unlatch the gate', solo: true, fn: async () => {
        setFlag('yardA_open');
        G.audio.sfx('switch');
        await G.ui.say(null, 'Click. The gate swings open from the inside.');
        await w.regroup();
        w.rebuild();
      } });
    }
    w.put('doghouse', 5.5, 16, {}); w.put('trampoline', 11.5, 28.5); w.put('kiddiePool', 6.2, 23.5);
    w.put('lawnChair', 12.6, 16.2, { color: 0xffd45a }); w.put('tree', 4.4, 31, { rng: r });
    if (!flag('got_yardA_gear')) w.interact(5.5, 18, { r: 1.5, label: 'Look in the doghouse', fn: async () => {
      if (flag('got_yardA_gear')) return;
      setFlag('got_yardA_gear');
      addGear('sticky_gloves');
      await G.ui.say(null, 'Inside: a chewed tennis ball, a rawhide, and a pair of *Sticky Gloves*. Equip gear from the menu.');
    } });
    w.pickup(13.5, 21, { id: 'yardA_coins', coins: 25 });

    // ---------------- yard C: the sprinkler gauntlet
    const valve = flag('yardC_valve');
    w.zone('sprinkler', 54, 22.6, 0, 0, { r: 2.5, period: 4.2, phase: 0, flag: 'yardC_valve' });
    w.zone('sprinkler', 59.6, 22.6, 0, 0, { r: 2.5, period: 4.2, phase: 1.4, flag: 'yardC_valve' });
    w.zone('sprinkler', 56.8, 28.4, 0, 0, { r: 2.5, period: 4.2, phase: 2.8, flag: 'yardC_valve' });
    w.zone('sprinkler', 62, 30.6, 0, 0, { r: 2.3, period: 3.6, phase: 0.6, flag: 'yardC_valve' });
    w.target(64.8, 14.2, { h: 1.6, flag: 'yardC_valve', fn: async () => { for (const z of w.zones) if (z.flag === 'yardC_valve') z.off = true; await G.ui.say(null, 'The valve squeals shut. The sprinklers droop, sulking.'); } });
    w.put('signPost', 50.4, 26.4, { text: valve ? 'SPRINKLERS:\nOFF (sorry)' : 'KEEP OFF\nTHE GRASS', w: 2.2, h: 1.1 });
    w.put('lawnChair', 51, 15.4, { color: 0xd4502f }); w.put('gnomeStatue', 63.4, 26, {}); w.put('gnomeStatue', 52.2, 31.4, { color: 0x3f6fb5 });
    w.pickup(57, 25.4, { id: 'yardC_parts', parts: 2 });
    w.put('hedge', 57, 13.4, { len: 5 });

    // ---------------- yard D: a couple of things only a lineman can move
    w.pushable('crate', 72, 25, { id: 'd_crate1', s: 1.8 });
    w.pushable('crate', 76, 29, { id: 'd_crate2', s: 1.8 });
    w.fence(70, 23, 70, 31, { style: 'wood' }); w.fence(70, 31, 79, 31, { style: 'wood' }); w.fence(79, 23, 79, 31, { style: 'wood' });
    w.fence(70, 23, 71, 23, { style: 'wood' }); w.fence(73, 23, 79, 23, { style: 'wood' });
    w.put('shed', 76.4, 25.4, { wall: 0x6aa84f });
    w.pickup(73.4, 28.6, { id: 'yardD_coins', coins: 40 });
    w.put('tree', 69, 15.5, { rng: r }); w.put('picnicTable', 76, 17, {}); w.put('trashcan', 80, 14);

    // ---------------- the lane
    w.bench(45.6, 15);
    w.npc('biscuit', 39.6, 20, { ...NPCS.biscuit, face: 0.8, talk: () => story.biscuit(w), wander: 2 });
    w.put('mailbox', 39.4, 6.6, {}); w.put('hydrant', 45, 6.4);
    w.put('trashcan', 38.2, 13.4); w.put('lamp', 46.6, 30.5); w.light(46.6, 3.4, 31, 0xffc65a, 26, 11);

    // ---------------- the crooked field
    w.put('goalpost', 12.6, 42.7, { w: 4.2, ry: Math.PI / 2, crooked: 0.09, color: 0xd9c9a8 });
    w.put('goalpost', 69.4, 42.7, { w: 4.2, ry: Math.PI / 2, crooked: -0.07, color: 0xd9c9a8 });
    for (let i = 0; i < 9; i++) { w.put('foldingChair', 24 + i * 1.3 + (i > 4 ? 6 : 0), 35.1, { color: [0x8f9aa6, 0xd4502f, 0x58b8c9][i % 3], ry: Math.PI }); }
    for (let i = 0; i < 8; i++) w.put('foldingChair', 20 + i * 1.3 + (i > 3 ? 14 : 0), 50.4, { color: [0x8f9aa6, 0xffd45a, 0x6aa84f][i % 3] });
    w.put('gnomeStatue', 41, 37.4, { color: 0x6aa84f });           // Gerald
    w.interact(41, 38.4, { r: 1.2, label: 'Look at Gerald', fn: () => G.ui.say(null, 'A garden gnome. The paint on his hat says "GERALD — DO NOT MOVE (HE KNOWS)."') });
    w.put('waterCooler', 30.5, 50.9); w.bench(38, 51.2);
    w.npc('terracotta', 46, 42.7, { ...NPCS.terracotta, face: -1.2, mark: chapter >= 1 && !S.wins.gnomes ? '!' : null, r: 2.4, talk: () => story.terracotta(w) });
    for (const [x, z, f] of [[49, 40.2, -1.4], [49.2, 45.4, -1.2], [52, 42.7, -1.5]]) w.npc(`gn${x}`, x, z, { spec: NPCS.gnome.spec, face: f, r: 0 });
    w.put('yardSign', 21.8, 35.4, { text: '10' }); w.put('yardSign', 60.2, 35.4, { text: '10', bg: '#3f6fb5' });

    // ---------------- block party (south-east)
    w.put('tent', 55, 53.4, { color: 0xd4502f }); w.put('tent', 79, 53.2, { color: 0x2a6f77, r: 2 });
    w.put('booth', 62, 53.2, { text: 'LAWN DASH', color: 0xd4502f });
    w.put('booth', 70, 53.2, { text: 'LEMONADE', color: 0xf2b632 });
    w.bunting(52, 52, 66, 52, { y: 3.6 }); w.bunting(66, 52, 81, 52, { y: 3.6 });
    w.put('balloons', 58.4, 52.6, { seed: 1 }); w.put('balloons', 74.4, 52.6, { seed: 2 });
    w.npc('bleat', 62, 54.8, { ...NPCS.bleat, face: 0, talk: () => story.bleat(w) });
    if (!S.roster.includes('zip')) w.npc('zip', 53.4, 57.2, { spec: teamSpec('zip'), name: 'Zip', face: 1.2, mark: '!', talk: () => story.zip(w), wander: 1.2 });
    w.interact(70, 55, { r: 1.5, label: 'Buy lemonade (5 coins)', fn: async () => {
      if (S.coins < 5) { await G.ui.say(null, 'The sign says 5 coins. Your pockets say otherwise.'); return; }
      S.coins -= 5; for (const id of S.roster) G.S.chars[id] && (G.S.chars[id].st = Math.min(999, G.S.chars[id].st + 30));
      G.audio.sfx('fizz'); G.ui.toast('🍋 Everyone feels a bit fresher. (+30 stamina)');
    } });
    w.put('picnicTable', 76, 58.6, { cloth: 0xffd45a }); w.put('lamp', 51, 59.6); w.light(60, 3.6, 55, 0xffc65a, 30, 14);

    // ---------------- the Acorn twins (Backyard Blitz)
    w.fence(4, 51.2, 34, 51.2, { style: 'picket' }); w.fence(4, 51.2, 4, 61, { style: 'picket' }); w.fence(34, 55, 34, 61, { style: 'picket' });
    w.npc('nutmeg', 30.6, 53.2, { ...NPCS.nutmeg, face: 1.2, talk: () => story.nutmeg(w), mark: chapter >= 1 && !S.best.blitz ? '!' : null });
    w.npc('clove', 29.2, 54.6, { ...NPCS.clove, face: 1.0, talk: () => story.clove(w) });
    w.put('sprinkler', 13.5, 56.2); w.put('sprinkler', 24.5, 56.2);
    w.put('lawnChair', 10, 53.8, { color: 0x58b8c9 }); w.put('lawnChair', 27.4, 58.6, { color: 0xd4502f, ry: 0.5 });
    w.put('kiddiePool', 18, 59, {});

    // ---------------- roaming gnome scouts (once you have a team)
    const gnome = (shirt, hat) => ({ kind: 'gnome', build: 'small', shirt, helmet: { color: hat, stripe: 0xfff4dc }, shoes: 0x3a2a2e });
    const cond = () => S.chapter >= 1;
    w.enemy({ id: 'gn_lane', team: 'gnome_scouts', spec: gnome(0x3f6fb5, 0xc8452d), minis: 1, path: [[42, 24], [42, 31], [44, 27]], cond, venue: 'backyard' });
    w.enemy({ id: 'gn_yardB', team: 'gnome_scouts', spec: gnome(0x4f8a4a, 0xc8452d), minis: 1, path: [[24, 22], [32, 26], [26, 31]], cond, venue: 'backyard' });
    w.enemy({ id: 'gn_field', team: 'gnome_diggers', spec: gnome(0x8a5aa8, 0x2a6f77), minis: 2, path: [[20, 52.6], [32, 52.6]], cond: () => S.chapter >= 1 && !!S.wins.gnomes, venue: 'backyard' });
    w.enemy({ id: 'gn_yardD', team: 'gnome_diggers', spec: gnome(0x3f6fb5, 0x2a6f77), minis: 1, path: [[70, 19], [78, 20.6]], cond, venue: 'backyard' });

    // ---------------- greenery + exits
    const trees = [[4, 39], [6, 46], [3.4, 50], [78, 40], [80, 46], [35.6, 60.4], [46.4, 60.6], [1.6, 8], [82.6, 8], [48.6, 9], [34.4, 9.4]];
    for (const [x, z] of trees) w.put('tree', x, z, { rng: r });
    for (const [x, z] of [[9, 36.4], [8, 49.6], [74.5, 37], [73, 49], [16, 9.6], [66, 9.6]]) w.put('bush', x, z, { berries: r() < 0.4 });
    for (const [x, z] of [[72, 44], [8.4, 42], [44.6, 33]]) w.put('leafPile', x, z, { color: r() < 0.5 ? 0xe8842c : 0xd4502f });
    w.pickup(8, 44.2, { id: 'borough_leafpile', coins: 15 });
    w.exit(42, 0.5, 5, 1.2, 'hollow', 39, 56.4, { dir: 0 });
  },
};
