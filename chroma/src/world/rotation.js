// Stage rotation: two stages are "live" in each 20-minute window, the same for
// everyone at the same clock time.
import { STAGE_IDS, stageInfo } from './stage.js';

const SLOT_MS = 20 * 60 * 1000;

export function currentRotation(now = Date.now()) {
  const slot = Math.floor(now / SLOT_MS);
  const ids = [...STAGE_IDS];
  // deterministic shuffle per slot
  let s = (slot * 2654435761) >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const pair = ids.slice(0, Math.min(2, ids.length));
  const msLeft = SLOT_MS - (now % SLOT_MS);
  return { ids: pair, names: pair.map((id) => stageInfo(id).name), minutesLeft: Math.ceil(msLeft / 60000) };
}
