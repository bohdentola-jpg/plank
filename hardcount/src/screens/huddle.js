// MAIN MENU placeholder (replaced by the huddle scene).
import { registerScreen } from '../main.js';
import { vText, text, hints } from '../core/ui.js';

registerScreen('huddle', () => ({
  draw(ctx) {
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, 1024, 768);
    vText(ctx, 'HARD COUNT', 512, 360, 72, { align: 'center', color: '#fff', outline: 4, outlineColor: 'rgba(0,0,0,0.8)' });
    text(ctx, '7-ON-7 FOOTBALL', 512, 410, { size: 18, align: 'center', color: '#ffb21e', spacing: 6 });
    hints(ctx, [['confirm', 'SELECT'], ['back', 'BACK']]);
  },
}));
