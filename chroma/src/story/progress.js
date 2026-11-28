// Story save data in profile.story: schema, v1 -> v2 migration, Hue Shards and
// the story-only upgrade shop. v1 saves were { cleared: [...], swatches: [...] }
// with level ids l1..l5; those ids (and the meaning of a swatch id equal to its
// level id) are unchanged, so migration only adds fields.
import { INFO, ORDER, SWATCHES } from './info.js';

export const STORY_V = 2;
// shards granted per level already cleared in a v1 save (roughly what a new run collects there)
export const V1_SHARD_GRANT = 45;
export const CLEAR_SHARDS = 30, BOSS_SHARDS = 60;

export const UPGRADES = [
  { id: 'armor', name: 'Tough Scales', icon: '♥', color: '#ff6b8a', cost: [30, 70, 130], tiers: ['+20 effective health', '+45 effective health', '+75 effective health'], blurb: 'Thicker scales: every hit stings less.' },
  { id: 'refill', name: 'Quick Refill', icon: '▼', color: '#3cb4ff', cost: [25, 60, 110], tiers: ['Ink refills 25% faster', 'Ink refills 50% faster', 'Ink refills 80% faster'], blurb: 'A wider ink gland. Swim less, splash more.' },
  { id: 'charge', name: 'Super Charge', icon: '★', color: '#ffd21a', cost: [25, 60, 110], tiers: ['Special charges 30% faster', 'Special charges 60% faster', 'Special charges twice as fast'], blurb: 'Your special meter fills while you paint.' },
  { id: 'burst', name: 'Prism Burst', icon: '✸', color: '#b06bff', cost: [40, 80, 140], tiers: ['Specials release a color shockwave', 'Bigger, stronger shockwave', 'Huge shockwave that flattens the Drab'], blurb: 'Every special also blasts nearby Drab.' },
  { id: 'power', name: 'Bold Hues', icon: '✦', color: '#ff7a3d', cost: [35, 75, 135], tiers: ['+12% damage to the Drab', '+24% damage to the Drab', '+36% damage to the Drab'], blurb: 'Brighter ink hits harder. Bosses included.' },
  { id: 'magnet', name: 'Shard Magnet', icon: '◆', color: '#5ee05a', cost: [15, 35, 60], tiers: ['Pull shards in from 3 m', 'Pull shards in from 5 m', 'Pull shards in from 8 m'], blurb: 'Hue Shards fly to you.' },
];
export const UPGRADE = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

const arr = (a, ok) => (Array.isArray(a) ? [...new Set(a.filter(ok))] : []);
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

// Normalised copy of profile.story (never mutates the profile).
export function readStory(profile) {
  const s = profile?.story && typeof profile.story === 'object' ? profile.story : null;
  const cleared = arr(s?.cleared, (id) => INFO[id]);
  const out = {
    v: STORY_V,
    cleared,
    swatches: arr(s?.swatches, (id) => SWATCHES[id]),
    shards: Math.max(0, Math.floor(num(s?.shards))),
    shardsTotal: Math.max(0, Math.floor(num(s?.shardsTotal))),
    got: {},
    up: {},
    best: {},
    flags: s?.flags && typeof s.flags === 'object' ? { ...s.flags } : {},
    deaths: Math.max(0, Math.floor(num(s?.deaths))),
  };
  if (s?.got && typeof s.got === 'object') for (const id of Object.keys(s.got)) if (INFO[id]) out.got[id] = arr(s.got[id], (i) => Number.isInteger(i) && i >= 0 && i < 400);
  if (s?.up && typeof s.up === 'object') for (const u of UPGRADES) out.up[u.id] = Math.max(0, Math.min(u.cost.length, Math.floor(num(s.up[u.id]))));
  else for (const u of UPGRADES) out.up[u.id] = 0;
  if (s?.best && typeof s.best === 'object') for (const id of Object.keys(s.best)) if (INFO[id] && num(s.best[id]) > 0) out.best[id] = s.best[id];
  // v1 save: grant shards for the levels already beaten so the shop isn't empty-handed
  if (s && !s.v) {
    const grant = cleared.length * V1_SHARD_GRANT;
    out.shards += grant;
    out.shardsTotal += grant;
    out.flags.intro = true;
    out.flags.migratedV1 = true;
  }
  return out;
}

// Normalise profile.story (creating/migrating it if needed) and return it.
// Once normalised the same object is returned every time, so callers can keep it.
export function ensureStory(profile) {
  const s = profile.story;
  if (s && s.v === STORY_V && Array.isArray(s.cleared) && Array.isArray(s.swatches) && s.got && s.up && s.flags && s.best && Number.isFinite(s.shards)) return s;
  profile.story = readStory(profile);
  return profile.story;
}

export function levelSwatchesFound(story, id) {
  const inf = INFO[id];
  return inf ? inf.swatchIds.filter((sid) => story.swatches.includes(sid)).length : 0;
}

export function upgradeCost(story, uid) {
  const u = UPGRADE[uid];
  const lv = story.up[uid] || 0;
  return lv >= u.cost.length ? null : u.cost[lv];
}

export function buyUpgrade(story, uid) {
  const cost = upgradeCost(story, uid);
  if (cost == null || story.shards < cost) return false;
  story.shards -= cost;
  story.up[uid] = (story.up[uid] || 0) + 1;
  return true;
}

// Gameplay multipliers from the purchased upgrades.
export function upgradeEffects(story) {
  const up = story?.up || {};
  const t = (id) => Math.max(0, Math.min(3, up[id] || 0));
  const pick = (id, vals, none) => (t(id) ? vals[t(id) - 1] : none);
  const bonusHp = pick('armor', [20, 45, 75], 0);
  return {
    armor: 100 / (100 + bonusHp), bonusHp,
    refill: pick('refill', [1.25, 1.5, 1.8], 1),
    charge: pick('charge', [1.3, 1.6, 2.0], 1),
    burst: t('burst') ? { r: [5, 7, 9.5][t('burst') - 1], dmg: [110, 170, 260][t('burst') - 1] } : null,
    power: pick('power', [1.12, 1.24, 1.36], 1),
    magnet: pick('magnet', [3, 5, 8], 1.4),
  };
}

export const coresDone = (story) => story.cleared.length;
export const totalCores = () => ORDER.length;
