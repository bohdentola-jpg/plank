// Inside the old stadium (once the gate is unchained). Exhibition games against
// visiting teams, the snack shack, and — after sunset, once you've earned it —
// the Midnight Bowl.
import * as THREE from 'three';
import { G } from '../core/game.js';
import { toon, lit, M, rbox, box, glowSprite } from '../art/kit.js';
import { makeRng } from '../core/util.js';
import { NPCS } from '../data/npcs.js';
import { flag } from '../game/state.js';
import * as story from '../game/story.js';

const W = 60, D = 42;

export default {
  id: 'stadium', name: 'Lantern Stadium', sub: 'We leave a light on',
  w: W, d: D, spawn: [30, 37], seed: 5,
  ground: '#6f9a6a', edge: 0x6a6478, lip: 0xb9b0c4,
  music: (S) => (S.tod === 'night' ? 'night' : 'town'),
  paint(g, S) {
    g.rect(0, 0, W, D, '#b9b0c4');
    g.speckle(0, 0, W, D, 200, ['#aaa1b6', '#c6bdd0'], 0.06, 0.18);
    g.field(7, 13, 46, 18, { name1: 'LANTERNS', name2: S.wins.buzzers ? 'MIDNIGHT' : 'VISITORS', ez1: '#f08a24', ez2: '#3b2148', c1: '#5f9a5a', c2: '#6aa866' });
    g.path([[30, 42], [30, 31.5]], 4, '#cdc4d6');
    g.text('▼ TOWN', 30, 40.6, 0.8, 'rgba(60,40,70,0.55)');
  },
  build(w, S) {
    const r = makeRng(12);
    const night = w.night;
    const lv = S.town.stadium;
    // stands
    for (const x of [15, 30, 45]) w.put('bleachers', x, 10.4, { len: 13, rows: 6, color: lv >= 2 ? 0xd9d2e4 : 0xb0a8bc, noFade: true });
    for (const x of [15, 45]) w.put('bleachers', x, 34, { len: 13, rows: 3, ry: Math.PI, color: lv >= 2 ? 0xd9d2e4 : 0xb0a8bc });
    const sb = w.put('scoreboard', 30, 2.6, { w: 12, h: 4.6, on: flag('scoreboard_on'), lines: flag('scoreboard_on') ? story.scoreboardLines() : [], solid: false, noFade: true });
    sb.position.y = 3.6;
    w.solid(30, 3, 50, 4);
    for (const [x, z] of [[4, 8], [56, 8], [4, 35], [56, 35]]) w.put('lightTower', x, z, { h: 11, on: night && (lv >= 2 || (S.best.lights || {}).medal >= 1), noFade: true });
    w.put('goalpost', 6.6, 22, { w: 5, ry: Math.PI / 2 }); w.put('goalpost', 53.4, 22, { w: 5, ry: Math.PI / 2 });
    // the snack shack
    w.put('booth', 8, 37, { text: 'SNACK SHACK', color: 0xf08a24 });
    w.interact(8, 38.6, { r: 1.7, label: 'Snack Shack', fn: () => (G.hooks.snackShack ? G.hooks.snackShack(w) : G.ui.say(null, 'The shutters are down. A sign says: "BACK AT HALFTIME."')) });
    // lockers + benches
    w.put('locker', 52, 37.6, { n: 4, color: 0x3b2148 });
    w.bench(22, 33.2); w.put('waterCooler', 38, 33.4);
    // exhibition board
    w.put('signPost', 37, 37.4, { text: 'VISITING\nTEAMS', w: 2.2, h: 1.2 });
    w.interact(37, 38.6, { r: 1.6, label: 'Schedule an exhibition game', fn: () => (G.hooks.exhibition ? G.hooks.exhibition(w) : G.ui.say(null, 'No games posted yet.')) });
    // under the bleachers, at night
    if (S.tod === 'night' && !flag('bowl_won')) {
      const glow = glowSprite(0xffb347, 3.2, 0.5);
      glow.position.set(15, 1.6, 9.4);
      w.add(glow, true);
      w.onUpdate((dt, t) => { glow.position.x = 30 + Math.sin(t * 0.3) * 17; glow.material.opacity = 0.35 + Math.sin(t * 9) * 0.08; });
    }
    if (G.hooks.stadiumExtras) G.hooks.stadiumExtras(w);
    w.exit(30, D - 0.5, 5, 1, 'hollow', 39, 12.6, { dir: Math.PI });
    void THREE; void toon; void lit; void M; void rbox; void box; void NPCS; void r;
  },
};
