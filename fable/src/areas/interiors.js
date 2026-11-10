// Dollhouse interiors: the clubhouse, the diner and the arcade. Open toward
// the camera, back wall to the north, exit mat at the bottom.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { toon, M, rbox, box, signPlane, lit } from '../art/kit.js';
import { NPCS } from '../data/npcs.js';
import { CAST, teamSpec } from '../data/cast.js';
import { DECOR } from '../data/items.js';
import { flag } from '../game/state.js';
import * as story from '../game/story.js';

const RW = 16, RD = 11.4;

function shell(w, wall, trim) {
  w.put('wallSeg', RW / 2, 0.3, { w: RW, h: 4.4, color: wall });
  w.put('wallSeg', 0.2, RD / 2, { w: RD, h: 4.4, color: wall, ry: Math.PI / 2 });
  w.put('wallSeg', RW - 0.2, RD / 2, { w: RD, h: 4.4, color: wall, ry: Math.PI / 2 });
  w.add(M(box(RW, 0.25, 0.4), toon(trim), RW / 2, 4.4, 0.3));
}
function mat(g, col = '#d4502f') {
  g.rect(RW / 2 - 1.4, RD - 1.3, 2.8, 1.1, col, 0.3);
  g.text('▼', RW / 2, RD - 0.75, 0.6, 'rgba(255,244,220,0.9)');
}

export const clubhouse = {
  id: 'clubhouse', name: 'The Clubhouse', indoor: true, noCheckpoint: true,
  w: RW, d: RD, spawn: [8, 9.3], fixedCam: [8, 5.6], zoom: 0.66, music: 'indoors',
  ground: '#c79a62', edge: 0x5a3f33, lip: 0x8a6a4a,
  paint(g) {
    for (let i = 0; i < 12; i++) { g.rect(0, i, RW, 0.94, i % 2 ? '#c99c64' : '#bf9159'); for (let x = (i % 2) * 2; x < RW; x += 4) g.line(x, i, x, i + 0.94, 0.05, 'rgba(90,60,40,0.35)'); }
    g.speckle(0, 0, RW, RD, 40, ['rgba(90,60,40,0.18)'], 0.1, 0.3);
    mat(g, '#3b2148');
  },
  build(w, S) {
    shell(w, flag('clubhouse_fixed') ? 0xf6e7c6 : 0xe2d2b0, 0x3b2148);
    // back wall
    w.put('chalkboard', 4, 1.0, { text: 'LANTERNS' });
    w.interact(4, 2.2, { r: 1.7, label: 'Squads & playbook', fn: () => (G.hooks.menu ? G.hooks.menu(w, 'squads') : null), cond: () => S.chapter >= 1 });
    w.put('locker', 11.2, 1.0, { n: 4, color: new THREE.Color(S.team.helmet).getHex() });
    w.interact(11.2, 2.1, { r: 1.7, label: 'Change uniforms', fn: () => (G.hooks.uniforms ? G.hooks.uniforms(w) : null), cond: () => S.chapter >= 1 });
    const pos = signPlane('WE LEAVE\nA LIGHT ON', 2.2, 1.3, { bg: '#f08a24', color: '#fff4dc', radius: 12, border: '#2b1a33' });
    pos.position.set(7.6, 2.6, 0.47); w.add(pos, true);
    // trophy case
    w.put('shelf', 14.4, 1.0, { w: 1.9 });
    const trophies = S.decor.owned.filter((id) => id.startsWith('trophy_'));
    w.interact(14.2, 2.1, { r: 1.5, label: 'Trophy case', fn: async () => {
      if (!trophies.length) await G.ui.say(null, 'One old trophy, turned to face the wall. The engraving says: "MIDNIGHT BOWL — " and then nothing. They never got to finish it.');
      else await G.ui.say(null, `Trophies: ${trophies.map((id) => DECOR[id].name).join(', ')}. And the old one, still facing the wall.`);
    } });
    // bed (rest / change time of day)
    w.put('bed', 1.8, 3.6, { color: new THREE.Color(S.team.jersey).getHex() });
    w.interact(3.2, 3.8, { r: 1.5, label: 'Rest', fn: () => (G.hooks.bed ? G.hooks.bed(w) : null), cond: () => flag('met_hollow') });
    w.put('rug', 8, 6, { color: new THREE.Color(S.team.jersey).getHex(), color2: new THREE.Color(S.team.stripe).getHex(), r: 2 });
    // decorations you placed
    for (const d of S.decor.placed) {
      const def = DECOR[d.id];
      if (!def) continue;
      w.put(def.prop, d.x, d.z, { ...def.opts, ry: d.r || 0, solid: !def.flat });
    }
    w.interact(8, 6, { r: 9, label: 'Decorate here', fn: () => (G.hooks.decorate ? G.hooks.decorate(w) : null), cond: () => S.chapter >= 2 });
    // Coach Hollow haunts the middle of the room until he joins
    if (!flag('met_hollow')) {
      const a = w.npc('hollow', 8, 4.4, { spec: CAST.hollow.spec, name: 'Coach Hollow', face: 0, r: 0 });
      a.ch.root.visible = false;
      w.trigger(8, 8.4, 6, 2.6, () => story.clubhouseIntro(w), { once: 'clubhouse_intro' });
    }
    // teammates lounging at home (hangouts)
    if (S.chapter >= 2 && G.hooks.loungers) G.hooks.loungers(w);
    w.exit(8, RD - 0.5, 3, 0.9, 'hollow', 13, 47.3, { dir: Math.PI, arrow: false });
  },
};

export const diner = {
  id: 'diner', name: 'The Diner', indoor: true, noCheckpoint: true,
  w: RW, d: RD, spawn: [4, 9.2], fixedCam: [8, 5.6], zoom: 0.66, music: 'indoors',
  ground: '#f2f2ea', edge: 0x4a4a58, lip: 0x8f9aa6,
  paint(g, S) {
    const a = S.town.diner ? '#d4502f' : '#b98a84', b = S.town.diner ? '#fff4dc' : '#e2d9c9';
    for (let x = 0; x < RW; x++) for (let z = 0; z < 12; z++) g.rect(x, z, 1, 1, (x + z) % 2 ? a : b);
    if (!S.town.diner) g.speckle(0, 0, RW, RD, 60, ['rgba(60,50,60,0.2)'], 0.2, 0.6);
    g.rect(2.6, RD - 1.3, 2.8, 1.1, '#2a6f77', 0.3);
    g.text('▼', 4, RD - 0.75, 0.6, 'rgba(255,244,220,0.9)');
  },
  build(w, S) {
    const fixed = S.town.diner;
    shell(w, fixed ? 0xdfeef0 : 0xc9d0cc, fixed ? 0xd4502f : 0x8a5a54);
    w.put('counter', 9, 3.2, { w: 9, color: fixed ? 0xd4502f : 0x9a7a74 });
    for (let i = 0; i < 5; i++) w.put('stool', 5.6 + i * 1.7, 4.3, { color: fixed ? 0x2a6f77 : 0x7a8a8c });
    // kitchen wall bits
    w.add(M(rbox(2.2, 1.5, 0.8, 0.08), toon(0x8f9aa6), 6, 0.75, 1.1));
    w.add(M(rbox(1.6, 2.4, 0.8, 0.08), toon(0xc9d2da), 12.5, 1.2, 1.1));
    w.add(M(box(1.9, 0.06, 0.7), fixed ? lit(0xff7a3c, 0xff5a1c, 0.8) : toon(0x4a4a58), 6, 1.52, 1.1));
    const menu = signPlane(fixed ? 'TODAY:\nPANCAKES' : 'CLOSED\n(ish)', 2.4, 1.3, { bg: '#2b1a33', color: '#fff4dc', radius: 10 });
    menu.position.set(9.3, 2.9, 0.47); w.add(menu, true);
    for (const z of [6.6, 9.2]) { w.put('boothSeat', 13.6, z - 0.9, { color: fixed ? 0x2a6f77 : 0x7a8a8c }); w.put('table', 13.6, z, {}); }
    w.put('jukebox', 1.4, 1.4, {});
    w.interact(1.6, 2.5, { r: 1.4, label: 'Poke the jukebox', fn: async () => { G.audio.sfx('ding'); const songs = ['town', 'borough', 'indoors', 'fair', 'frost', 'neon']; const s = songs[(S.seen.juke = ((S.seen.juke || 0) + 1)) % songs.length]; G.audio.music(s); G.ui.toast(`♪ Now playing: <b>${s}</b>`); } });
    if (!S.roster.includes('waffle')) {
      w.npc('waffle', 9, 1.8, { spec: { ...CAST.waffle.spec, shirt: 0xfffaf0, hat: 'chef', acc: ['apron'] }, name: 'Waffle', face: 0, mark: S.roster.includes('pip') && S.roster.includes('zip') ? '!' : null, r: 3.7, talk: () => story.waffle(w) });
    } else {
      w.npc('maple', 9, 1.9, { ...NPCS.maple, face: 0, r: 3.7, label: fixed ? 'Order a game-day meal' : 'Talk to Maple', talk: () => story.maple(w) });
    }
    w.interact(13.6, 7.9, { r: 1.6, label: 'Sit and chat with a teammate', cond: () => !!S.town.diner && S.roster.length > 1, fn: () => (G.hooks.chat ? G.hooks.chat(w) : null) });
    w.exit(4, RD - 0.5, 3, 0.9, 'hollow', 61.9, 23.6, { dir: Math.PI, arrow: false });
  },
};

export const arcade = {
  id: 'arcade', name: 'The Arcade', indoor: true, noCheckpoint: true,
  w: RW, d: RD, spawn: [8, 9.2], fixedCam: [8, 5.6], zoom: 0.66, music: 'neon',
  ground: '#2b2250', edge: 0x1b1630, lip: 0x4a3f7a,
  paint(g) {
    g.speckle(0, 0, RW, RD, 70, ['#ff5ad0', '#58e6ff', '#ffd45a', '#b07aff'], 0.08, 0.2);
    for (let i = 0; i < 9; i++) g.path([[i * 2, 0], [i * 2 + 1, RD]], 0.06, 'rgba(120,100,220,0.25)');
    mat(g, '#f08a24');
  },
  build(w, S) {
    shell(w, 0x3a2f6e, 0xf08a24);
    const games = [
      ['blitz', 'BACKYARD\nBLITZ', 0xd4502f, 0xffd45a],
      ['snack', 'SNACK SHACK\nRUSH', 0xf08a24, 0x58e6ff],
      ['golf', 'FIELD GOAL\nGOLF', 0x3f7a52, 0xb6f08a],
      ['mascot', 'MASCOT\nMAYHEM', 0x8a5aa8, 0xff5ad0],
      ['lights', 'MIDNIGHT\nMAINTENANCE', 0x2a3a6a, 0xffc65a],
    ];
    games.forEach(([id, label, col, neon], i) => {
      const x = 2.4 + i * 2.8;
      w.put('arcadeCabinet', x, 1.4, { color: col, neon });
      const s = signPlane(label, 1.9, 0.8, { color: '#fff4dc', stroke: '#2b1a33', strokeW: 6 });
      s.position.set(x, 3.2, 0.5); w.add(s, true);
      w.interact(x, 2.6, { r: 1.25, label: `Play ${label.replace('\n', ' ')}`, fn: () => (G.hooks.arcadeGame ? G.hooks.arcadeGame(w, id) : null) });
    });
    w.put('counter', 13.2, 7.6, { w: 3.6, color: 0x5a3f8a, top: 0xffd45a });
    w.npc('dot', 13.2, 6.4, { ...NPCS.dot, face: 0, r: 2.6, label: 'Prize counter', talk: () => (G.hooks.prizes ? G.hooks.prizes(w) : story.dot(w)) });
    w.put('beanbag', 3, 7.6, { color: 0xff5ad0 }); w.put('beanbag', 4.6, 8.3, { color: 0x58e6ff });
    w.put('plant', 1.2, 9.6, {});
    w.exit(8, RD - 0.5, 3, 0.9, 'hollow', 51.5, 23.6, { dir: Math.PI, arrow: false });
  },
};
