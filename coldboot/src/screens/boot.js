// The old TV power-on screen is gone: ?screen=boot links land on the title.
import { registerScreen, go } from '../main.js';

registerScreen('boot', () => ({
  enter() { go('title', { intro: true }, { transition: 'none' }); },
}));
