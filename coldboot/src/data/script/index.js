// Every voiced line, mission and conversation in the game, merged from the
// script modules (each exports LINES, and optionally MISSIONS / DIALOG).
import * as prologue from './prologue.js';
import * as folk from './folk.js';
import * as day01 from './day01.js';
import * as lessons from './lessons.js';

const MODS = [prologue, folk, day01, lessons];

export const ALL_LINES = Object.assign({}, ...MODS.map((m) => m.LINES || {}));
export const ALL_MISSIONS = Object.assign({}, ...MODS.map((m) => m.MISSIONS || {}));
// conversations: later modules can wrap earlier ones (day-specific overrides)
export const ALL_DIALOGS = {};
for (const m of MODS) {
  for (const [id, fn] of Object.entries(m.DIALOG || {})) {
    const prev = ALL_DIALOGS[id];
    ALL_DIALOGS[id] = prev && m.DIALOG_OVERRIDE ? (c) => fn(c, prev) : fn;
  }
}
export const FOLK_LINES = folk.FOLK;
