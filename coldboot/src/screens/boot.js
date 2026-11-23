// Boot: the TV is off in a dark room. Any button turns it on — the CRT opens
// from a bright line, static hisses in, and the title "cold boots" like an old
// computer.
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { audio } from '../audio/audio.js';
import { sfx } from '../audio/sfx.js';
import { text, W, H } from '../core/ui.js';

registerScreen('boot', () => {
  let on = false;
  let t = 0;
  const led = document.getElementById('tv-led');
  const hint = document.getElementById('room-hint');
  return {
    enter() {
      game.renderer.power = 0;
      led?.classList.add('standby');
      if (hint) hint.textContent = 'press any button to turn on the tv';
    },
    exit() {
      led?.classList.remove('standby');
      led?.classList.add('on');
      if (hint) hint.textContent = '';
    },
    update(dt) {
      t += dt;
      if (!on && (input.pressed('any') || input.takeClick())) {
        on = true;
        t = 0;
        audio.unlock();
        try { sfx.tvOn(); } catch { /* */ }
        led?.classList.remove('standby');
        led?.classList.add('on');
        hint?.classList.add('gone');
      }
      if (on) {
        game.renderer.power = Math.min(1, t / 0.75);
        game.fx.staticAmt = t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) / 0.6);
        if (t > 1.5) go('title', { intro: true }, { transition: 'none' });
      }
    },
    draw(ctx) {
      if (!on) return;
      if (t > 0.5 && t < 1.4) {
        ctx.fillStyle = `rgba(20,40,160,${Math.min(1, (t - 0.5) * 3) * 0.8})`;
        ctx.fillRect(0, 0, W, H);
        text(ctx, 'AV 1', 80, 90, { size: 30, color: '#e8ffe8', weight: 800, font: '"Consolas", monospace' });
      }
    },
  };
});
