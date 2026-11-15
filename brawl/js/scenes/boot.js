// Placeholder boot scene (replaced by the real preloader in the menu pass).
import { W, H } from '../core/config.js';
import { txt } from '../core/gfx.js';
export class BootScene {
  constructor(app) { this.app = app; }
  update() {}
  draw(ctx) { ctx.fillStyle = '#2f7fd0'; ctx.fillRect(0, 0, W, H); txt(ctx, 'COMPUTER LAB BRAWL', W / 2, H / 2, { font: 'carter', size: 48 }); }
}
