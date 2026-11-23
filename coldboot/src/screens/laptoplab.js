// QA: the Night School laptop without the town.  ?screen=laptoplab&lesson=0&page=1&ex=0&code=...
import { registerScreen } from '../main.js';
import { newState } from '../game/state.js';
import { HUD } from '../game/hud.js';
import { openLaptop } from './laptop.js';

registerScreen('laptoplab', () => {
  const G = { state: newState({ name: 'Sam' }), hud: new HUD(), player: { locked: false }, overlay: null };
  G.state.day = 14;
  return {
    enter(p) {
      openLaptop(G, { challenge: p.challenge });
      window.__lab = G;
    },
    update(dt) { G.overlay?.update(dt); },
    draw(ctx) { G.overlay?.draw(ctx, 1 / 60); G.hud.update(1 / 60); },
    view() { return null; },
  };
});
