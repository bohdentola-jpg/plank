// How to play: five chalkboard pages.

import { W, H } from '../core/config.js';
import { clamp } from '../core/util.js';
import { OUT, txt, rrect, circle, star, polygon, line } from '../core/gfx.js';
import { keyLabel, PAD_PRESETS, padLabel } from '../core/input.js';
import { FIGHTERS } from '../fighters/index.js';
import { dummyFighter, tickDummy, drawDummy } from '../game/render.js';
import { chalkboard, chalk, keycap, padBtn, hot, clicked } from './ui.js';

const PAGES = ['THE BIG IDEA', 'KEYBOARD', 'SHARING & CONTROLLERS', 'YOUR MOVES', 'STARS & BOXES'];

export class HowToScene {
  constructor(app) {
    this.app = app; this.t = 0; this.page = 0;
    const roster = FIGHTERS.filter((f) => !f.stub);
    this.a = dummyFighter(roster[0], 0); this.b = dummyFighter(roster[1 % roster.length], 1);
    this.b.state = 'hitstun'; this.b.tumble = true; this.b.grounded = false;
  }
  enter() { this.app.audio.playMusic('menu'); }
  update() {
    const app = this.app, mn = app.input.menu(); this.t++;
    tickDummy(this.a); this.b.t++; this.b.pose = this.b.def.pose(this.b, null);
    if (this.t < 12) return;
    const n = PAGES.length;
    if (mn.right || mn.ok || clicked(app, W - 120, H - 96, 90, 44)) { if (this.page < n - 1) { this.page++; app.audio.sfx('chalk'); } else if (mn.ok) this.exit(); }
    if (mn.left || clicked(app, 30, H - 96, 90, 44)) { if (this.page > 0) { this.page--; app.audio.sfx('chalk'); } }
    if (mn.back) this.exit();
  }
  exit() { this.app.audio.sfx('ui_back'); import('./title.js').then((m) => this.app.go(() => new m.TitleScene(this.app, true))); }

  keysFor(table, action, x, y) {
    const k = this.app.input.keys[table][action] || [];
    let cx = x;
    k.forEach((code, i) => { if (i) { chalk(this.ctx, 'or', cx + 3, y + 13, { size: 15 }); cx += 24; } cx += keycap(this.ctx, keyLabel(code), cx, y) + 5; });
    return cx;
  }
  row(label, table, action, x, y) { chalk(this.ctx, label, x, y + 13, { size: 21 }); this.keysFor(table, action, x + 110, y); }

  draw(ctx) {
    this.ctx = ctx;
    const t = this.t, p = this.page;
    chalkboard(ctx, t, PAGES[p]);
    const L = 70;
    if (p === 0) {
      chalk(ctx, 'Every hit adds DAMAGE: the % by your name.', L, 150);
      chalk(ctx, 'The higher your %, the farther you fly.', L, 186);
      chalk(ctx, 'Knock everybody else off the screen.', L, 222);
      chalk(ctx, 'Last one left wins.', L, 258, { fill: '#ffe45c' });
      // little diagram
      const gy = 430;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(110, gy); ctx.lineTo(520, gy); ctx.stroke();
      drawDummy(ctx, this.a, 200, gy, 1.5, 1);
      const u = (t % 110) / 110, bx = 290 + u * 420, by = gy - 60 - Math.sin(u * 2.4) * 120;
      ctx.setLineDash([8, 10]); ctx.beginPath(); ctx.moveTo(290, gy - 60); ctx.quadraticCurveTo(480, gy - 300, 720, gy - 150); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
      drawDummy(ctx, this.b, bx, by + 30, 1.2, -1);
      chalk(ctx, '132%', 610, gy - 250, { size: 34, fill: '#ff9a8a' });
      chalk(ctx, 'bye!', 690, gy - 190, { size: 26 });
      chalk(ctx, 'Fell off? Jump again in the air, then UP + SPECIAL.', L, 496, { size: 20 });
    } else if (p === 1) {
      chalk(ctx, 'One player. Either hand position works:', L, 140, { size: 20, fill: '#ffe45c' });
      const rows = [['Move', 'left'], ['', 'right'], ['Jump', 'jump'], ['Attack', 'attack'], ['Special', 'special'], ['Strong', 'strong'], ['Shield', 'shield'], ['Grab', 'grab'], ['Pause', 'start']];
      let y = 166;
      chalk(ctx, 'Move', L, y + 13, { size: 21 });
      let cx = L + 110;
      for (const dir of ['up', 'left', 'down', 'right']) cx += keycap(ctx, keyLabel(this.app.input.keys.solo[dir][0]), cx, y) + 4;
      chalk(ctx, 'or', cx + 4, y + 13, { size: 15 }); cx += 28;
      for (const dir of ['up', 'left', 'down', 'right']) cx += keycap(ctx, keyLabel(this.app.input.keys.solo[dir][1] || this.app.input.keys.solo[dir][0]), cx, y) + 4;
      y += 40;
      for (const [lab, act] of rows.slice(2)) { this.row(lab, 'solo', act, L, y); y += 37; }
      chalk(ctx, 'UP jumps too.', 470, 250, { size: 20 });
      chalk(ctx, 'Hold DOWN on a thin', 470, 290, { size: 20 }); chalk(ctx, 'platform to drop through.', 470, 314, { size: 20 });
      chalk(ctx, 'Change any key in', 470, 366, { size: 20 }); chalk(ctx, 'OPTIONS.', 470, 390, { size: 20, fill: '#ffe45c' });
    } else if (p === 2) {
      chalk(ctx, 'Two on one keyboard', L, 140, { size: 22, fill: '#ffe45c' });
      chalk(ctx, '(player 2 joins with their Attack key)', 290, 140, { size: 16 });
      const acts = [['Move', null], ['Jump', 'jump'], ['Attack', 'attack'], ['Special', 'special'], ['Strong', 'strong'], ['Shield', 'shield'], ['Grab', 'grab']];
      [['split1', L, 'LEFT SIDE'], ['split2', 410, 'RIGHT SIDE']].forEach(([tb, x, title]) => {
        chalk(ctx, title, x, 172, { size: 18 });
        let y = 188;
        for (const [lab, act] of acts) {
          chalk(ctx, lab, x, y + 12, { size: 18 });
          let cx = x + 78;
          if (!act) for (const dir of ['up', 'left', 'down', 'right']) cx += keycap(ctx, keyLabel(this.app.input.keys[tb][dir][0]), cx, y, { h: 22, size: 13 }) + 3;
          else cx += keycap(ctx, keyLabel(this.app.input.keys[tb][act][0]), cx, y, { h: 22, size: 13 }) + 3;
          y += 28;
        }
      });
      chalk(ctx, 'Controllers', L, 404, { size: 22, fill: '#ffe45c' });
      chalk(ctx, '(plug one in, press a button to join)', 196, 404, { size: 16 });
      const map = PAD_PRESETS[this.app.input.padPreset] || PAD_PRESETS.brawl;
      const items = [['Attack', map.attack], ['Special', map.special], ['Jump', map.jump], ['Shield', map.shield], ['Grab', map.grab]];
      let x = L;
      for (const [lab, btns] of items) {
        chalk(ctx, lab, x, 440, { size: 18 }); let bx = x + 14;
        for (const b of btns) { padBtn(ctx, padLabel(b), bx, 468, ['#35a84a', '#e8402a', '#2f7fe0', '#f2b81c'][b] || '#3a3f55'); bx += 30; }
        x += 132;
      }
      chalk(ctx, 'Left stick moves.  Right stick = Strong attacks.  START pauses.', L, 506, { size: 18 });
    } else if (p === 3) {
      const rows = [
        ['ATTACK', 'Quick hits. Try it with a direction, in the air, on the run.'],
        ['STRONG', 'The big hit. Hold it to charge. Aim it up or down too.'],
        ['SPECIAL', 'Four per fighter: plain, sideways, up (your way back), down.'],
        ['SHIELD', 'Blocks. Tap left/right to roll, down to sidestep. Mid-air: dodge.'],
        ['GRAB', 'Goes through shields. Then pick a direction to throw.'],
        ['LEDGES', 'Fall near an edge and you catch it. Up or Jump to climb.'],
        ['DOWN', 'Tap it in the air to drop fast.'],
      ];
      rows.forEach((r, i) => { chalk(ctx, r[0], L, 150 + i * 46, { size: 24, fill: '#ffe45c' }); chalk(ctx, r[1], L + 118, 150 + i * 46, { size: 19 }); });
      chalk(ctx, 'Getting hit a lot? Shield more, and stay off the edges.', L, 492, { size: 19 });
    } else {
      star(ctx, L + 22, 164, 22, 10, 5, '#ffd92e', OUT, 3);
      chalk(ctx, 'GOLD STAR', L + 60, 150, { size: 26, fill: '#ffe45c' });
      chalk(ctx, 'It floats in now and then. Break it to earn your SUPER,', L + 60, 180, { size: 19 });
      chalk(ctx, 'then press SPECIAL on its own. Every fighter has one.', L + 60, 204, { size: 19 });
      rrect(ctx, L + 4, 258, 36, 26, 3, '#d9a25e', OUT, 2.6); rrect(ctx, L + 2, 252, 40, 9, 2, '#f0c078', OUT, 2.6); txt(ctx, '?', L + 22, 272, { font: 'titan', size: 18, fill: '#ffffff', lw: 4 });
      chalk(ctx, 'SHOW & TELL', L + 60, 256, { size: 26, fill: '#ffe45c' });
      chalk(ctx, 'Walk into the box. Something climbs out and fights for you.', L + 60, 286, { size: 19 });
      chalk(ctx, 'STAGES', L + 60, 340, { size: 26, fill: '#ffe45c' });
      chalk(ctx, 'Most have a gimmick. HAZARDS: OFF on the stage screen', L + 60, 370, { size: 19 });
      chalk(ctx, 'turns them into plain platforms.', L + 60, 394, { size: 19 });
      chalk(ctx, 'RULES', L + 60, 448, { size: 26, fill: '#ffe45c' });
      chalk(ctx, 'Stocks are lives. Add a timer if lunch is nearly over.', L + 60, 478, { size: 19 });
    }
    // page turner
    const n = PAGES.length;
    for (let i = 0; i < n; i++) circle(ctx, W / 2 - (n - 1) * 11 + i * 22, H - 74, i === p ? 6 : 4, i === p ? '#ffe45c' : 'rgba(255,255,255,0.5)', null, 0);
    if (p > 0) chalk(ctx, '< back', 44, H - 74, { size: 22 });
    chalk(ctx, p < n - 1 ? 'next >' : 'done >', W - 44, H - 74, { size: 22, align: 'right' });
  }
}
