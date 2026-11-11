// Huddle Hollow — the hub town built around an abandoned football stadium.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { toon, lit, M, rbox, box, cyl, sphere, cone, glowSprite, signPlane } from '../art/kit.js';
import { makeRng } from '../core/util.js';
import { NPCS } from '../data/npcs.js';
import { flag } from '../game/state.js';
import * as story from '../game/story.js';

const W = 78, D = 60;

export default {
  id: 'hollow', name: 'Huddle Hollow', sub: 'Population: depends who\'s counting',
  w: W, d: D, spawn: [69, 33.5], seed: 3,
  ground: '#8dbd62', edge: 0x7a5a48,
  music: (S) => (S.tod === 'night' ? 'night' : 'town'),

  paint(g, S) {
    const town = S.town;
    // soft colour variation in the grass
    g.speckle(0, 0, W, D, 260, ['#84b55b', '#96c56a', '#8fbf5f'], 0.6, 1.8);
    // stadium apron (gravel)
    g.rect(4, 0, 70, 12.4, '#cfc2ad', 1.5);
    g.speckle(4, 0, 70, 12, 300, ['#c2b49d', '#dbcfba', '#b9ab96'], 0.05, 0.14);
    // main street + side paths
    const path = '#e6d3a4', pathEdge = '#cdb684';
    const roads = [
      [[0, 33.5], [W, 33.5]],
      [[39, 33.5], [39, 60]],
      [[39, 33.5], [39, 12]],
      [[20.5, 33.5], [20.5, 48.4], [13, 48.4]],
      [[51.5, 33.5], [51.5, 22.5]],
      [[62, 33.5], [62, 22.5]],
      [[62, 36], [62, 47.5]],
      [[17, 33.5], [17, 30.5]],
    ];
    for (const r of roads) g.path(r, r[0][1] === 33.5 && r[1][1] === 33.5 ? 5.4 : 3.2, pathEdge);
    for (const r of roads) g.path(r, r[0][1] === 33.5 && r[1][1] === 33.5 ? 4.8 : 2.6, path);
    g.speckle(0, 31, W, 5, 120, ['#d9c594', '#efdfb6'], 0.06, 0.16);
    // town square
    g.circle(39, 44.5, 7.2, pathEdge); g.circle(39, 44.5, 6.8, '#ead9ae');
    for (let i = 0; i < 3; i++) g.frame(39 - 5.6 + i * 1.6, 44.5 - 5.6 + i * 1.6, 11.2 - i * 3.2, 11.2 - i * 3.2, 'rgba(180,150,100,0.35)', 0.1, 5.6 - i * 1.6);
    // practice field
    if (town.field) {
      g.field(6, 15.5, 22, 13.5, { name1: 'LANTERNS', name2: 'HOLLOW', ez1: '#f08a24', ez2: '#3b2148' });
    } else {
      g.rect(6, 15.5, 22, 13.5, '#7ea955', 0.8);
      g.speckle(6, 15.5, 22, 13.5, 90, ['#93b85f', '#6e9a4b', '#a9b86a'], 0.3, 0.9);
      for (let i = 1; i < 10; i++) g.line(6 + i * 2.2, 16, 6 + i * 2.2, 28.5, 0.1, 'rgba(255,255,255,0.28)', { dash: [0.7, 0.9] });
      g.frame(6, 15.5, 22, 13.5, 'rgba(255,255,255,0.35)', 0.14, 0.4);
      g.tufts(6, 15.5, 22, 13.5, 60, '#5f8a42');
    }
    // pond
    g.ellipse(36.2, 22.4, 6.1, 4.7, '#b8a77c');
    g.ellipse(36.2, 22.4, 5.6, 4.2, '#5fb7c7');
    g.ellipse(35.4, 21.6, 4.2, 2.9, '#74c8d6');
    g.ellipse(34.2, 20.8, 1.4, 0.5, 'rgba(255,255,255,0.5)', -0.3);
    g.speckle(31.5, 19, 9, 6, 9, ['#6aa84f'], 0.25, 0.4);
    g.rect(35.4, 25.4, 1.6, 3.6, '#b07a45', 0.1);
    for (let i = 0; i < 6; i++) g.line(35.4, 25.7 + i * 0.6, 37, 25.7 + i * 0.6, 0.06, '#8a5a34');
    // fallen leaves everywhere, thicker under trees
    g.speckle(0, 12, W, D - 12, 620, ['#e8842c', '#d4502f', '#f2b632', '#c9652a'], 0.07, 0.17);
    g.tufts(0, 12, W, D - 12, 130, '#6f9f4c');
    // building shadows-on-ground
    for (const [x, z, rx, rz] of [[13, 42, 6, 4.5], [51.5, 19, 6, 4], [64.5, 19, 6.5, 4], [62.5, 49.5, 5, 3.6], [27.5, 44, 5, 3.6], [38, 5, 30, 5]]) g.shade(x, z + 1, rx, rz, 0.2);
    // exits
    g.text('BACKYARD BOROUGH ▼', 39, 58.3, 0.8, 'rgba(90,60,40,0.6)');
  },

  build(w, S) {
    const r = makeRng(41);
    const night = w.night;
    const town = S.town;

    // ---------------- the abandoned stadium (north edge)
    const stoneC = 0xb9b0c4;
    w.put('wallSeg', 20.5, 9.6, { w: 31, h: 3.6, color: stoneC });
    w.put('wallSeg', 57.5, 9.6, { w: 31, h: 3.6, color: stoneC });
    for (const x of [36, 42]) { w.add(M(rbox(1.3, 4.6, 1.3, 0.15), toon(0x8f86a0), x, 2.3, 9.6)); w.solid(x, 9.6, 1.3, 1.3); w.add(M(sphere(0.5, 10, 8), night ? lit(0xffe9a8, 0xffc65a, 1.4) : toon(0xfff1c0), x, 5, 9.6)); }
    // bleacher backs looming behind the wall
    for (const [x, wd] of [[20.5, 28], [57.5, 28]]) {
      const b = new THREE.Group();
      for (let i = 0; i < 4; i++) b.add(M(box(wd - i * 1.2, 1.5, 1.6), toon(i % 2 ? 0x9a93ad : 0xa9a2bb), 0, 3.9 + i * 1.5, -1.4 - i * 1.5));
      b.position.set(x, 0, 8.6);
      w.add(b);
    }
    w.solid(39, 4, 70, 8);
    const sb = w.put('scoreboard', 39, 6.2, { w: 8.8, h: 4.2, on: flag('scoreboard_on'), lines: flag('scoreboard_on') ? story.scoreboardLines() : [], solid: false, noFade: true });
    sb.position.y = 2.4;
    w.named.scoreboard = sb;
    if (flag('scoreboard_on') && night) { const gl = glowSprite(0xffb53c, 16, 0.4); gl.position.set(39, 8.6, 7); w.add(gl, true); }
    for (const x of [8.5, 69.5]) w.put('lightTower', x, 7.2, { on: town.stadium >= 1 && night, h: 10, noFade: true });
    // the gate
    const gateOpen = town.stadium >= 1 || flag('gate_open');
    if (!gateOpen) {
      const gate = new THREE.Group();
      for (let i = 0; i < 9; i++) gate.add(M(cyl(0.07, 0.07, 3.2, 5), toon(0x4a4458), -2 + i * 0.5, 1.6, 0));
      for (const y of [0.5, 2.8]) gate.add(M(box(4.6, 0.14, 0.14), toon(0x4a4458), 0, y, 0));
      gate.add(M(rbox(0.6, 0.7, 0.3, 0.08), toon(0xd9a441), 0, 1.5, 0.15));
      gate.position.set(39, 0, 9.6);
      w.add(gate);
      w.solid(39, 9.6, 4.8, 0.6);
    }
    w.interact(39, 11.2, { r: 2.2, label: gateOpen ? 'Enter the stadium' : 'Look at the gate', fn: () => story.stadiumGate(w) });
    w.put('booth', 31.5, 11.6, { text: 'TICKETS', color: 0x8a5aa8 });
    w.put('signPost', 46, 12, { text: 'HOME OF THE\nLANTERNS', w: 2.6, h: 1.0 });
    // fuse box (Midnight Maintenance)
    w.add(M(rbox(0.9, 1.3, 0.4, 0.06), toon(0x6a7480), 48.5, 1.5, 9.3));
    w.add(M(box(0.5, 0.12, 0.05), toon(0xffd45a), 48.5, 1.8, 9.52));
    w.interact(48.5, 10.6, { r: 1.6, label: 'Check the fuse box', fn: () => story.fuseBox(w) });
    w.trigger(39, 14, 20, 3, () => story.stadiumApproach(w));
    w.vista(39, 16.5, 34, 13, { dz: -9, zoom: 1.24 });

    // ---------------- practice field + pond
    w.put('goalpost', 6.6, 22.2, { w: 4, ry: Math.PI / 2, crooked: town.field ? 0 : 0.08 });
    w.put('goalpost', 27.4, 22.2, { w: 4, ry: Math.PI / 2 });
    w.fence(5, 14.6, 29, 14.6, { style: 'rail' });
    w.fence(5, 14.6, 5, 29.6, { style: 'rail' });
    w.put('signPost', 17, 30.3, { text: 'PRACTICE FIELD', w: 2.8, h: 0.7 });
    w.put('tackleDummy', 9.5, 17.5); w.put('tackleDummy', 11.5, 17.5);
    w.put('waterCooler', 24.5, 29.6);
    w.bench(21, 29.9);
    w.interact(17, 22.2, { r: 3.2, label: town.field ? 'Practice routes' : 'Look at the field', fn: () => story.practiceField(w) });
    w.rounds.push({ x: 36.2, z: 22.2, r: 3.9 }, { x: 33.2, z: 22.6, r: 3.0 }, { x: 39.2, z: 22.6, r: 3.0 });
    w.npc('croaker', 41.5, 26.4, { ...NPCS.croaker, face: -2.2, base: 'fish', talk: () => story.croaker(w) });
    w.interact(36.2, 27.8, { r: 1.5, label: 'Fish off the dock', cond: () => flag('has_rod'), fn: () => story.fish(w) });
    for (const [x, z] of [[30.8, 26.5], [42.4, 19.5], [31, 18.6]]) w.put('bush', x, z, { color: 0x6aa84f });
    w.put('rock', 41.6, 24.2, { s: 0.8 }); w.put('rock', 30.6, 23, { s: 0.6 });

    // ---------------- arcade + diner
    w.put('arcade', 51.5, 19, { fixed: town.arcade });
    w.door(51.5, 22.3, { to: 'arcade', at: [8, 9.2], label: town.arcade ? 'Enter the Arcade' : 'Try the arcade door', locked: () => (town.arcade ? false : 'The arcade is boarded up. A faded sign says: "BACK IN FIVE MINUTES." It has been considerably longer than five minutes.') });
    w.npc('dot', 55.4, 23.4, { ...NPCS.dot, face: -0.5, talk: () => story.dot(w) });
    w.put('diner', 64.5, 19, { fixed: town.diner });
    w.door(61.9, 22.3, { to: 'diner', at: [4, 9], label: 'Enter the Diner' });
    w.pushable('dumpster', 70.3, 21.6, { id: 'diner_dumpster' });
    w.pickup(73.6, 17.6, { id: 'hollow_alley', parts: 2 });
    w.fence(69.4, 16.4, 76.5, 16.4, { style: 'wood' });
    w.fence(76.5, 16.4, 76.5, 23.4, { style: 'wood' });
    w.fence(71.6, 23.4, 76.5, 23.4, { style: 'wood' });
    w.put('trashcan', 59.2, 22); w.put('trashcan', 46.6, 22);

    // ---------------- main street dressing
    for (const [x, z] of [[9, 30.3], [26, 30.3], [46, 30.3], [58, 30.3], [14, 36.8], [31, 36.8], [48, 36.8], [66, 36.8]]) { w.put('lamp', x, z); w.light(x, 3.4, z + 0.4, 0xffc65a, 26, 11); }
    w.put('busStop', 71.6, 29.8, { text: 'BUS' });
    w.put('bus', 71, 38.6, { text: 'HOLLOW LINE' });
    w.npc('gus', 67.6, 31.2, { ...NPCS.gus, face: 0.2, talk: () => story.gus(w) });
    w.put('hydrant', 44.2, 30.6); w.put('mailbox', 55.5, 30.6, { color: 0xd4502f });

    // ---------------- clubhouse (yours)
    w.put('clubhouse', 13, 42.2, { fixed: flag('clubhouse_fixed') ? 1 : 0, team: new THREE.Color(S.team.jersey).getHex() });
    w.door(13, 46, { to: 'clubhouse', at: [8, 9.3], label: 'Enter the Clubhouse' });
    w.put('mailbox', 17.6, 47.4, { color: 0xf08a24 });
    w.bench(8.2, 49.2);
    w.put('pumpkin', 9.6, 46.2); w.put('pumpkin', 10.4, 46.6, { s: 0.7 });
    w.put('leafPile', 5.5, 46);
    if (!S.roster.includes('june') && S.roster.length >= 5) {
      w.npc('june', 14.6, 46.6, { spec: { kind: 'animal', species: 'moth', build: 'small', shirt: 0xe9dcc0 }, name: 'June', y: 2.2, base: 'float', solid: false, mark: '!', r: 2.6, label: 'Look at the porch light', talk: () => story.june(w) });
      w.onUpdate((dt, t) => { const a = w.named.june; if (a && !a.scripted) { a.x = 14.45 + Math.cos(t * 1.7) * 0.9; a.z = 46.5 + Math.sin(t * 1.7) * 0.5; a.y = 2.3 + Math.sin(t * 3) * 0.2; a.ch.setPos(a.x, a.z, a.y); a.face = t * 1.7 + Math.PI; } });
    }

    // ---------------- town square
    const ped = new THREE.Group();
    ped.add(M(cyl(1.5, 1.7, 0.5, 14), toon(0xc9c4ba), 0, 0.25, 0));
    ped.add(M(cyl(0.9, 1.1, 1.1, 12), toon(0xd9d4ca), 0, 1.05, 0));
    ped.add(M(cyl(0.38, 0.42, 0.1, 6), toon(0xb8862f), 0, 1.66, 0));
    ped.add(M(cyl(0.3, 0.34, 0.74, 6), night ? lit(0xffe9a8, 0xffc65a, 1.5) : toon(0xffeab0), 0, 2.08, 0));
    ped.add(M(cone(0.36, 0.3, 6), toon(0xb8862f), 0, 2.6, 0));
    ped.position.set(39, 0, 44.5);
    w.add(ped);
    w.rounds.push({ x: 39, z: 44.5, r: 1.7 });
    if (night) { const gl = glowSprite(0xffc65a, 6, 0.5); gl.position.set(39, 2.1, 44.5); w.add(gl, true); w.light(39, 3, 45.5, 0xffc65a, 30, 12); }
    w.interact(39, 46.6, { r: 1.4, label: 'Read the plaque', fn: () => story.plaque(w) });
    w.put('signPost', 46.4, 40.2, { text: 'NOTICE\nBOARD', w: 2.2, h: 1.3 });
    w.interact(46.4, 41.4, { r: 1.6, label: 'Check the notice board', fn: () => story.noticeBoard(w), mark: flag('board_open') && !flag('board_seen') ? '!' : null, markY: 2.8 });
    w.npc('marigold', 42.6, 41, { ...NPCS.marigold, face: 0.4, talk: () => story.marigold(w), wander: 0 });
    w.put('bench', 33.4, 48); w.put('bench', 44.6, 48);
    w.put('flowers', 35.5, 39.6, { n: 8 }); w.put('flowers', 42.6, 49.8, { n: 8 });

    // ---------------- homes + shop
    w.put('house', 27.5, 43.6, { w: 6.4, d: 5, wall: 0xf7dcc0, roof: 0x2a6f77, doorC: 0xd4502f });
    w.npc('hamm', 26.4, 48, { ...NPCS.hamm, face: 0.3, talk: () => story.hamm(w), wander: 1.6 });
    w.put('shop', 62.5, 49.4, { name: 'THISTLE & SON' });
    w.npc('nan', 62.5, 53.3, { ...NPCS.nan, face: 0, talk: () => story.nan(w) });
    w.put('crate', 66.6, 52.8, { s: 1.1 }); w.put('pumpkin', 58.6, 52.6); w.put('pumpkin', 59.4, 53.2, { s: 0.75, color: 0xe8c95a });
    w.put('house', 52, 45.5, { w: 5.8, d: 4.8, wall: 0xe9e2f2, roof: 0x8a5aa8, doorC: 0x2a6f77, hip: true });
    w.npc('mittens', 50.2, 39.2, { ...NPCS.mittens, face: 1, talk: () => story.mittens(w), wander: 2.4 });

    // ---------------- trees and greenery
    const trees = [[3, 13.5], [3.5, 33.5], [2.6, 39], [4, 54], [10, 56.5], [18, 55], [24.5, 52.5], [30, 56], [33.5, 38], [46, 55.5], [52, 57], [58, 57.5], [69, 55.5], [74.5, 49], [75, 43.5], [74, 27], [46.2, 26.2], [29.6, 13.2], [57.8, 13.4], [72.5, 13], [23.5, 38.6], [70.4, 45.6], [5.4, 36.2]];
    for (const [x, z] of trees) w.put('tree', x, z, { rng: r });
    for (const [x, z] of [[2.5, 46], [22, 31], [33, 30.6], [56, 37.6], [74.6, 36.8], [47.5, 49], [31, 52.5], [6, 31.2]]) w.put('bush', x, z, { color: r() < 0.5 ? 0x6aa84f : 0x7fae4a, berries: r() < 0.4 });
    for (const [x, z] of [[20, 57], [56, 54.5], [4.5, 51], [72.5, 52.5]]) w.put('leafPile', x, z, { color: r() < 0.5 ? 0xe8842c : 0xd4502f });
    w.put('rock', 34.6, 56.4); w.put('stump', 16, 53.4);

    // ---------------- exits
    w.exit(39, 59.6, 7, 1.2, 'borough', 39, 3.4, { dir: Math.PI, locked: () => (flag('has_ball') ? false : 'Better look at the clubhouse first — it\'s the one thing in town that\'s actually yours.'), bump: [0, -1.2] });

    // something under the bleachers (only after dark)
    if (S.tod === 'night' && S.chapter >= 1 && !flag('bowl_won')) {
      const glow = glowSprite(0xffb347, 3, 0.55);
      glow.position.set(20, 2.2, 8.2);
      w.add(glow, true);
      w.onUpdate((dt, t) => { glow.position.x = 20 + Math.sin(t * 0.35) * 12; glow.material.opacity = 0.35 + Math.sin(t * 9) * 0.08 + (Math.sin(t * 0.35) > 0.96 ? -0.3 : 0); });
    }
    if (S.chapter === 0 && !flag('intro_done')) w.trigger(69, 33.5, 8, 6, () => story.arrival(w), { once: 'intro_done' });
  },
};
