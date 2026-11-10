// Small helpers over the save state: flags, wallet, inventory, roster, quests.
import { G } from '../core/game.js';
import { writeSave } from '../core/save.js';
import { CAST, charState, maxStamina, normalizeSquads, displayName } from '../data/cast.js';
import { ITEMS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';

export const flag = (k) => !!G.S.flags[k];
export const flagVal = (k, d = 0) => (G.S.flags[k] === undefined ? d : G.S.flags[k]);
export function setFlag(k, v = true) { G.S.flags[k] = v; }

export function addCoins(n, quiet) {
  G.S.coins = Math.max(0, G.S.coins + n);
  if (!quiet && n) { G.ui.toast(`${n > 0 ? '+' : ''}${n} <b>🪙 coins</b>`); if (n > 0) G.audio.sfx('coin'); }
}
export function addParts(n, quiet) {
  G.S.parts = Math.max(0, G.S.parts + n);
  if (!quiet && n) { G.ui.toast(`${n > 0 ? '+' : ''}${n} <b>🔩 parts</b>`); if (n > 0) G.audio.sfx('item'); }
}
export function addItem(id, n = 1, quiet) {
  G.S.items[id] = (G.S.items[id] || 0) + n;
  if (G.S.items[id] <= 0) delete G.S.items[id];
  if (!quiet && n > 0 && ITEMS[id]) { G.ui.toast(`Got ${ITEMS[id].icon} <b>${ITEMS[id].name}</b>${n > 1 ? ` ×${n}` : ''}`); G.audio.sfx('item'); }
}
export const itemCount = (id) => G.S.items[id] || 0;
export function addGear(id, quiet) {
  if (!G.S.gear.includes(id)) G.S.gear.push(id);
  if (!quiet) { G.ui.toast(`New gear: <b>${id.replace(/_/g, ' ')}</b>`); G.audio.sfx('item'); }
}
export function unlockPlay(id, quiet) {
  if (G.S.plays.includes(id)) return false;
  G.S.plays.push(id);
  if (!quiet) { G.ui.toast('📋 New play in the playbook!'); G.audio.sfx('quest'); }
  return true;
}
export function addDecor(id, quiet) {
  if (!G.S.decor.owned.includes(id)) G.S.decor.owned.push(id);
  if (!quiet) { G.ui.toast('🛋️ New clubhouse decoration!'); G.audio.sfx('item'); }
}

export function recruit(id, quiet) {
  const S = G.S;
  if (S.roster.includes(id)) return false;
  S.roster.push(id);
  charState(id).st = maxStamina(id);
  for (const sq of S.squads) if (sq.length < 5 && !sq.includes(id)) sq.push(id);
  normalizeSquads();
  if (!quiet) { G.audio.sfx('recruit'); G.ui.banner(`${displayName(id)} joined!`, CAST[id].title, { dur: 2.2, cls: 'small' }); }
  return true;
}

export function restAll() {
  for (const id of G.S.roster) charState(id).st = maxStamina(id);
}
export function healChar(id, amt) {
  const cs = charState(id);
  cs.st = Math.min(maxStamina(id), cs.st + amt);
}

export function save(quiet = true) {
  const ok = writeSave(G.S);
  if (!quiet) G.ui.toast(ok ? '💾 Saved' : 'Could not save (storage blocked)');
  return ok;
}

// ---------------------------------------------------------------- quests
export function startQuest(id, stage = 0) {
  const S = G.S;
  if (S.quests[id]) return;
  S.quests[id] = { stage, done: false };
  S.questLog.push(id);
  G.ui.toast(`📜 New quest: <b>${QUESTS[id].title}</b>`);
  G.audio.sfx('quest');
}
export function questStage(id) { const q = G.S.quests[id]; return q ? (q.done ? 999 : q.stage) : -1; }
export function setQuestStage(id, stage) {
  const q = G.S.quests[id];
  if (!q || q.done || q.stage >= stage) return;
  q.stage = stage;
}
export function finishQuest(id) {
  const q = G.S.quests[id];
  if (!q || q.done) return;
  q.done = true;
  G.ui.toast(`✅ Quest complete: <b>${QUESTS[id].title}</b>`);
  G.audio.sfx('quest');
}
export const questActive = (id) => !!G.S.quests[id] && !G.S.quests[id].done;
export const questDone = (id) => !!G.S.quests[id] && G.S.quests[id].done;

/** The quest shown in the HUD: first unfinished main quest, else first unfinished side quest. */
export function trackedQuest() {
  const S = G.S;
  let side = null;
  for (const id of S.questLog) {
    const q = S.quests[id];
    if (!q || q.done) continue;
    const def = QUESTS[id];
    if (!def) continue;
    const out = { id, title: def.title, text: typeof def.text === 'function' ? def.text(q.stage, S) : (def.steps ? def.steps[Math.min(q.stage, def.steps.length - 1)] : ''), main: !!def.main };
    if (def.main) return out;
    if (!side) side = out;
  }
  return side;
}
