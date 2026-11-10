// Glue: how the rest of the game starts a battle.
import { G } from '../core/game.js';
import { Battle } from './battle.js';
import { TEAMS } from '../data/teams.js';

/**
 * cfg: { team, kind: 'drive' | 'match', side: 'off' | 'def', venue, start, drives,
 *        tutorial, blindside, guest, noLoss, story, tod, onFirstTD, ... }
 * Resolves { won, score, stats }.
 */
export async function runBattle(cfg) {
  if (!TEAMS[cfg.team] && !cfg.teamDef) throw new Error(`No team "${cfg.team}"`);
  if (cfg.story === 'first_match' && !G.S.flags.scoreboard_on) {
    const story = await import('../game/story.js');
    cfg.onFirstTD = () => story.firstTouchdownCut();
  }
  if (G.debug.autoWin) { if (cfg.onFirstTD) await cfg.onFirstTD(); return { won: true, score: [7, 0], stats: {}, skipped: true }; }
  let res;
  for (;;) {
    res = await G.run(new Battle(), cfg);
    if (res && res.won) break;
    if (!cfg.noLoss) break;
    // tutorials: just line up again
    await G.ui.say('hollow', 'Shake it off. Nobody keeps score in practice. I keep score in practice. Again!');
  }
  return res;
}

export function install() {
  G.hooks.battle = runBattle;
  G.hooks.encounter = (def, kind) => runBattle({
    team: def.team, kind: 'drive', side: kind === 'ambush' ? 'def' : 'off',
    venue: def.venue || 'backyard', blindside: kind === 'blindside', start: def.start ?? (kind === 'ambush' ? 22 : 20),
  });
}
