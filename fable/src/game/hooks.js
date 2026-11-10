// Default glue between the overworld and the things it launches. Each real
// system (battle, minigames, town menus, cutscenes) replaces its hook when it
// loads; until then these fallbacks keep the story playable.
import { G } from '../core/game.js';

export function install() {
  const H = G.hooks;
  H.battle = H.battle || (async () => { G.ui.toast('(battle system not loaded — counted as a win)'); return { won: true, stub: true }; });
  H.encounter = H.encounter || (async (def, kind) => H.battle({ team: def.team, kind: 'drive', side: kind === 'ambush' ? 'def' : 'off', venue: def.venue || 'backyard', blindside: kind === 'blindside', roam: true }));
  H.minigame = H.minigame || (async () => ({ won: true, score: 0, stub: true }));
}
