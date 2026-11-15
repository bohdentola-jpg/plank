// Credits.

import { W, H } from '../core/config.js';
import { chalkboard, chalk } from './ui.js';

const LINES = [
  ['COMPUTER LAB BRAWL', 30, '#ffe45c'],
  ['an original platform fighter, made to feel like the', 19],
  ['games you played when the teacher wasn\'t looking', 19],
  ['', 10],
  ['THE IDEA', 22, '#ffe45c'],
  ['The fifteen-slot line-up (who does what, the supers, the', 18],
  ['stage gimmicks) follows a "what if" design video by Mung.', 18],
  ['Every character, stage and name in here is new.', 18],
  ['', 10],
  ['SOUND', 22, '#ffe45c'],
  ['Recorded effects and the announcer are public-domain (CC0)', 18],
  ['packs from Kenney, rubberduck and artisticdude.', 18],
  ['The music was written for this game.', 18],
  ['', 10],
  ['LETTERING', 22, '#ffe45c'],
  ['Titan One, Carter One, Chewy, Bangers, Boogaloo, Comic Neue,', 18],
  ['Silkscreen and Schoolbell, under their open licences.', 18],
  ['', 10],
  ['No plugins were harmed in the making of this game.', 18, 'rgba(255,255,255,0.7)'],
];

export class CreditsScene {
  constructor(app) { this.app = app; this.t = 0; }
  enter() { this.app.audio.playMusic('menu'); }
  update() {
    const app = this.app, mn = app.input.menu(); this.t++;
    if (this.t > 15 && (mn.back || mn.ok || app.input.mouse.pressed)) { app.audio.sfx('ui_back'); import('./title.js').then((m) => app.go(() => new m.TitleScene(app, true))); }
  }
  draw(ctx) {
    chalkboard(ctx, this.t, 'CREDITS');
    let y = 138;
    for (const [s, size, col] of LINES) { if (s) chalk(ctx, s, W / 2, y, { size, align: 'center', fill: col || '#ffffff' }); y += size + 4; }
  }
}
