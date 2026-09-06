import { el } from '../util.js';
import { input } from '../input.js';
import { audio } from '../audio.js';

export class TitleScreen {
  constructor(app) { this.app = app; this.t = 0; }
  enter() {
    const app = this.app, sp = app.space;
    app.use2D(false); sp.mode = 'menu'; sp.cam.pos.set(-24, 9, 36); sp.aimCam(0, 0, 0); sp.setTarget(null);
    app.ui.appendChild(el('div', { class: 'title-wrap' },
      el('div', { class: 'logo', html: 'GRIDIRON<br>GALAXY<small>THE LONG BOMB</small>' }),
      el('div', { class: 'press', html: input.usingPad() ? 'PRESS ANY BUTTON' : 'PRESS ANY KEY' }),
    ));
    app.ui.appendChild(el('div', { class: 'build', text: 'v1.0 · 5v5 · PS5 controller ready · Maple Street → The Mothership' }));
    audio.music('space', 1);
    this.ready = false; setTimeout(() => { this.ready = true; }, 400);
  }
  update(dt) {
    this.t += dt;
    const sp = this.app.space; sp.cam.yaw += dt * 0.02;
    sp.update(dt, null, { labels: false, drift: 1 });
    if (this.ready && input.anyPressed()) { audio.init(); audio.resume(); audio.sfx('confirm'); this.app.go('hub'); }
  }
  render() { this.app.space.render(this.app.renderer); }
  exit() { }
}
