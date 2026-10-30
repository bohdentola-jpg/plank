// Placeholder — replaced by the real game.
import { openArcade } from './frame.js';

export function playRunner(ctx) {
  return openArcade({
    id: 'runner',
    title: 'RAT RACE',
    logical: [800, 450],
    intro: { title: 'RAT RACE', text: 'Coming down the tracks soon.', button: 'OK' },
    create(api) {
      return {
        start() { api.finish({ title: 'SOON', lines: ['This game is still being painted.'], again: false }); },
        update() {},
        draw(g) { g.fillStyle = '#1b1533'; g.fillRect(0, 0, api.W, api.H); },
      };
    },
  }, ctx);
}
