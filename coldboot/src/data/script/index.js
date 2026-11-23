// Every voiced line, mission and conversation in the game, merged from the
// script modules (each exports LINES, and optionally MISSIONS / DIALOG / DAY).
// Conversations compose: a module with DIALOG_OVERRIDE = true gets (c, prev)
// and can hand off to the earlier version with `return prev(c)`.
import * as prologue from './prologue.js';
import * as folk from './folk.js';
import * as lessons from './lessons.js';
import * as day01 from './day01.js';
import * as day02 from './day02.js';
import * as day03 from './day03.js';
import * as day04 from './day04.js';
import * as day05 from './day05.js';
import * as day06 from './day06.js';
import * as day07 from './day07.js';
import * as day08 from './day08.js';
import * as day09 from './day09.js';
import * as day10 from './day10.js';
import * as day11 from './day11.js';
import * as day12 from './day12.js';
import * as day13 from './day13.js';
import * as day14 from './day14.js';
import * as sideFriends from './side_friends.js';
import * as sideJobs from './side_jobs.js';
import * as sideTown from './side_town.js';
import * as finale from './finale.js';

const MODS = [prologue, folk, lessons, day01, sideJobs, sideTown, sideFriends, day02, day03, day04, day05, day06, day07, day08, day09, day10, day11, day12, day13, day14, finale];

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
