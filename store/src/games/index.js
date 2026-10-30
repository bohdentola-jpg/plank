// Minigame registry. Each game returns a promise for its last result.
import { playSwipe } from './swipe.js';
import { playTag } from './tag.js';
import { playRunner } from './runner.js';
import { playCups } from './cups.js';
import { playClaw } from './claw.js';

const GAMES = { swipe: playSwipe, tag: playTag, runner: playRunner, cups: playCups, claw: playClaw };

export function openGame(name, ctx) {
  const fn = GAMES[name];
  if (!fn) return Promise.resolve(null);
  return fn(ctx);
}
