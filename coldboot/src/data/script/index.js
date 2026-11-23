// Every voiced line, mission and conversation in the game, merged from the
// script modules (each exports LINES, and optionally MISSIONS / DIALOG / DAY).
// Conversations compose: a module with DIALOG_OVERRIDE = true gets (c, prev)
// and can hand off to the earlier version with `return prev(c)`.
// (kit.js holds the day scripts' shared helpers; it has no content of its own.)
import * as prologue from './prologue.js';
import * as folk from './folk.js';
import * as lessons from './lessons.js';
import * as day01 from './day01.js';
import * as day02 from './day02.js';
import * as day03 from './day03.js';
import * as day04 from './day04.js';
import * as day05 from './day05.js';
import * as sideFriends from './side_friends.js';
import * as sideJobs from './side_jobs.js';
import * as sideTown from './side_town.js';
import * as finale from './finale.js';

const MODS = [prologue, folk, lessons, day01, sideJobs, sideTown, sideFriends, day02, day03, day04, day05, finale];

export const ALL_LINES = Object.assign({}, ...MODS.map((m) => m.LINES || {}));
export const ALL_MISSIONS = Object.assign({}, ...MODS.map((m) => m.MISSIONS || {}));
export const ALL_DIALOGS = {};
for (const m of MODS) {
  for (const [id, fn] of Object.entries(m.DIALOG || {})) {
    const prev = ALL_DIALOGS[id] || (async () => {});
    ALL_DIALOGS[id] = m.DIALOG_OVERRIDE ? (c) => fn(c, prev) : fn;
  }
}
export const FOLK_LINES = folk.FOLK;
/** Modules may export onNewDay(G, day) — called each morning after the day's missions start. */
export const NEWDAY_HOOKS = MODS.map((m) => m.onNewDay).filter(Boolean);
export const DAYS = Object.fromEntries(MODS.filter((m) => m.DAY).map((m) => [m.DAY.n, m.DAY]));
