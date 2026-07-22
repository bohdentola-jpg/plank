// Weapon database. Values are modeled on classic CS tuning:
//  damage      base damage per bullet (per pellet for shotguns)
//  armorPen    fraction of damage kept when hitting armor (0..1)
//  rpm         cyclic rate of fire
//  rangeMod    damage multiplier applied per 15 m of travel
//  penPower    wall penetration budget (material crossings spend it)
//  moveSpeed   max run speed in m/s while holding the weapon
//  recoil      parameters feeding the deterministic pattern generator
//  inacc       stand/move/air spread in degrees; fire = added per shot, decays
//  team        'CT' | 'T' | null (both)
import { strHash, mulberry32, DEG } from './util.js';

export const KNIFE = {
  id: 'knife', name: 'Knife', class: 'knife', team: null, price: 0, killReward: 1500,
  damage: 40, backstabMult: 4.5, range: 1.9, rpm: 150, moveSpeed: 5.0,
};

export const WEAPONS = {
  // ---------------- pistols ----------------
  glock:     { name: 'Glock-18', class: 'pistol', team: 'T', price: 200, killReward: 300,
    damage: 30, armorPen: 0.47, rpm: 400, mag: 20, reserve: 120, reloadTime: 2.3,
    moveSpeed: 4.8, rangeMod: 0.90, penPower: 50, headshotMult: 4, auto: false,
    recoil: { vert: 1.5, horiz: 0.7, period: 5 }, recovery: 0.28,
    inacc: { stand: 0.32, move: 1.6, air: 4.0, fire: 0.34, crouch: 0.8 } },
  usps:      { name: 'USP-S', class: 'pistol', team: 'CT', price: 200, killReward: 300,
    damage: 35, armorPen: 0.505, rpm: 352, mag: 12, reserve: 24, reloadTime: 2.2,
    moveSpeed: 4.8, rangeMod: 0.91, penPower: 50, headshotMult: 4, auto: false, suppressed: true,
    recoil: { vert: 1.7, horiz: 0.7, period: 5 }, recovery: 0.30,
    inacc: { stand: 0.24, move: 1.5, air: 3.8, fire: 0.40, crouch: 0.8 } },
  p2000:     { name: 'P2000', class: 'pistol', team: 'CT', price: 200, killReward: 300,
    damage: 35, armorPen: 0.505, rpm: 352, mag: 13, reserve: 52, reloadTime: 2.2,
    moveSpeed: 4.8, rangeMod: 0.91, penPower: 50, headshotMult: 4, auto: false,
    recoil: { vert: 1.7, horiz: 0.75, period: 5 }, recovery: 0.30,
    inacc: { stand: 0.26, move: 1.5, air: 3.8, fire: 0.40, crouch: 0.8 } },
  dualies:   { name: 'Dual Berettas', class: 'pistol', team: null, price: 300, killReward: 300,
    damage: 38, armorPen: 0.575, rpm: 500, mag: 30, reserve: 120, reloadTime: 3.8,
    moveSpeed: 4.8, rangeMod: 0.88, penPower: 55, headshotMult: 4, auto: false,
    recoil: { vert: 1.9, horiz: 1.1, period: 4 }, recovery: 0.32,
    inacc: { stand: 0.38, move: 1.8, air: 4.2, fire: 0.45, crouch: 0.85 } },
  p250:      { name: 'P250', class: 'pistol', team: null, price: 300, killReward: 300,
    damage: 38, armorPen: 0.64, rpm: 400, mag: 13, reserve: 26, reloadTime: 2.2,
    moveSpeed: 4.8, rangeMod: 0.89, penPower: 60, headshotMult: 4, auto: false,
    recoil: { vert: 1.8, horiz: 0.8, period: 5 }, recovery: 0.30,
    inacc: { stand: 0.30, move: 1.6, air: 4.0, fire: 0.42, crouch: 0.8 } },
  fiveseven: { name: 'Five-SeveN', class: 'pistol', team: 'CT', price: 500, killReward: 300,
    damage: 32, armorPen: 0.91, rpm: 400, mag: 20, reserve: 100, reloadTime: 2.2,
    moveSpeed: 4.8, rangeMod: 0.905, penPower: 90, headshotMult: 4, auto: false,
    recoil: { vert: 1.7, horiz: 0.8, period: 5 }, recovery: 0.30,
    inacc: { stand: 0.30, move: 1.6, air: 4.0, fire: 0.42, crouch: 0.8 } },
  cz75:      { name: 'CZ75-Auto', class: 'pistol', team: null, price: 500, killReward: 100,
    damage: 31, armorPen: 0.7765, rpm: 600, mag: 12, reserve: 12, reloadTime: 2.7,
    moveSpeed: 4.8, rangeMod: 0.885, penPower: 75, headshotMult: 4, auto: true,
    recoil: { vert: 2.2, horiz: 1.2, period: 4 }, recovery: 0.36,
    inacc: { stand: 0.36, move: 1.9, air: 4.4, fire: 0.55, crouch: 0.85 } },
  tec9:      { name: 'Tec-9', class: 'pistol', team: 'T', price: 500, killReward: 300,
    damage: 33, armorPen: 0.906, rpm: 500, mag: 18, reserve: 90, reloadTime: 2.4,
    moveSpeed: 4.8, rangeMod: 0.885, penPower: 90, headshotMult: 4, auto: false,
    recoil: { vert: 2.0, horiz: 1.0, period: 5 }, recovery: 0.33,
    inacc: { stand: 0.40, move: 1.9, air: 4.4, fire: 0.50, crouch: 0.85 } },
  deagle:    { name: 'Desert Eagle', class: 'pistol', team: null, price: 700, killReward: 300,
    damage: 53, armorPen: 0.932, rpm: 267, mag: 7, reserve: 35, reloadTime: 2.3,
    moveSpeed: 4.6, rangeMod: 0.81, penPower: 100, headshotMult: 4, auto: false,
    recoil: { vert: 4.5, horiz: 1.6, period: 4 }, recovery: 0.55,
    inacc: { stand: 0.34, move: 2.6, air: 5.5, fire: 1.6, crouch: 0.75 } },
  r8:        { name: 'R8 Revolver', class: 'pistol', team: null, price: 600, killReward: 300,
    damage: 86, armorPen: 0.932, rpm: 150, mag: 8, reserve: 8, reloadTime: 2.3,
    moveSpeed: 4.4, rangeMod: 0.80, penPower: 100, headshotMult: 4, auto: false, chargeTime: 0.4,
    recoil: { vert: 5.0, horiz: 1.4, period: 4 }, recovery: 0.60,
    inacc: { stand: 0.16, move: 2.4, air: 5.0, fire: 1.8, crouch: 0.75 } },

  // ---------------- shotguns ----------------
  nova:      { name: 'Nova', class: 'shotgun', team: null, price: 1050, killReward: 900,
    damage: 26, pellets: 9, armorPen: 0.50, rpm: 68, mag: 8, reserve: 32, reloadTime: 0.55, shellReload: true,
    moveSpeed: 4.4, rangeMod: 0.55, penPower: 30, headshotMult: 2.5, auto: false, spread: 2.6,
    recoil: { vert: 6.0, horiz: 1.5, period: 3 }, recovery: 0.6,
    inacc: { stand: 0.4, move: 1.0, air: 3.0, fire: 0.5, crouch: 0.9 } },
  xm1014:    { name: 'XM1014', class: 'shotgun', team: null, price: 2000, killReward: 900,
    damage: 20, pellets: 6, armorPen: 0.80, rpm: 171, mag: 7, reserve: 32, reloadTime: 0.5, shellReload: true,
    moveSpeed: 4.3, rangeMod: 0.60, penPower: 30, headshotMult: 2.5, auto: true, spread: 2.4,
    recoil: { vert: 4.5, horiz: 1.4, period: 3 }, recovery: 0.5,
    inacc: { stand: 0.4, move: 1.0, air: 3.0, fire: 0.5, crouch: 0.9 } },
  mag7:      { name: 'MAG-7', class: 'shotgun', team: 'CT', price: 1300, killReward: 900,
    damage: 30, pellets: 8, armorPen: 0.75, rpm: 71, mag: 5, reserve: 32, reloadTime: 2.6,
    moveSpeed: 4.3, rangeMod: 0.50, penPower: 30, headshotMult: 2.5, auto: false, spread: 2.2,
    recoil: { vert: 6.5, horiz: 1.6, period: 3 }, recovery: 0.62,
    inacc: { stand: 0.35, move: 1.0, air: 3.0, fire: 0.5, crouch: 0.9 } },
  sawedoff:  { name: 'Sawed-Off', class: 'shotgun', team: 'T', price: 1100, killReward: 900,
    damage: 32, pellets: 8, armorPen: 0.75, rpm: 71, mag: 7, reserve: 32, reloadTime: 0.55, shellReload: true,
    moveSpeed: 4.5, rangeMod: 0.45, penPower: 25, headshotMult: 2.5, auto: false, spread: 3.4,
    recoil: { vert: 6.8, horiz: 1.8, period: 3 }, recovery: 0.65,
    inacc: { stand: 0.5, move: 1.2, air: 3.2, fire: 0.5, crouch: 0.9 } },

  // ---------------- machine guns ----------------
  m249:      { name: 'M249', class: 'mg', team: null, price: 5200, killReward: 300,
    damage: 32, armorPen: 0.80, rpm: 750, mag: 100, reserve: 200, reloadTime: 5.7,
    moveSpeed: 4.0, rangeMod: 0.97, penPower: 200, headshotMult: 4, auto: true,
    recoil: { vert: 2.4, horiz: 2.4, period: 7 }, recovery: 0.55,
    inacc: { stand: 0.55, move: 3.2, air: 6.0, fire: 0.22, crouch: 0.7 } },
  negev:     { name: 'Negev', class: 'mg', team: null, price: 1700, killReward: 300,
    damage: 35, armorPen: 0.75, rpm: 800, mag: 150, reserve: 300, reloadTime: 5.7,
    moveSpeed: 3.9, rangeMod: 0.97, penPower: 200, headshotMult: 4, auto: true, settleAfter: 9,
    recoil: { vert: 3.5, horiz: 3.0, period: 6 }, recovery: 0.55,
    inacc: { stand: 1.4, move: 3.6, air: 6.5, fire: -0.12, crouch: 0.7 } },

  // ---------------- SMGs ----------------
  mp9:       { name: 'MP9', class: 'smg', team: 'CT', price: 1250, killReward: 600,
    damage: 26, armorPen: 0.60, rpm: 857, mag: 30, reserve: 120, reloadTime: 2.1,
    moveSpeed: 4.9, rangeMod: 0.87, penPower: 60, headshotMult: 4, auto: true,
    recoil: { vert: 1.6, horiz: 1.1, period: 6 }, recovery: 0.34,
    inacc: { stand: 0.34, move: 0.9, air: 3.6, fire: 0.14, crouch: 0.85 } },
  mac10:     { name: 'MAC-10', class: 'smg', team: 'T', price: 1050, killReward: 600,
    damage: 29, armorPen: 0.575, rpm: 800, mag: 30, reserve: 100, reloadTime: 2.6,
    moveSpeed: 4.9, rangeMod: 0.85, penPower: 60, headshotMult: 4, auto: true,
    recoil: { vert: 1.9, horiz: 1.3, period: 5 }, recovery: 0.36,
    inacc: { stand: 0.42, move: 1.0, air: 3.8, fire: 0.16, crouch: 0.85 } },
  mp5sd:     { name: 'MP5-SD', class: 'smg', team: null, price: 1500, killReward: 600,
    damage: 27, armorPen: 0.625, rpm: 750, mag: 30, reserve: 120, reloadTime: 2.4,
    moveSpeed: 4.7, rangeMod: 0.85, penPower: 60, headshotMult: 4, auto: true, suppressed: true,
    recoil: { vert: 1.5, horiz: 1.0, period: 6 }, recovery: 0.33,
    inacc: { stand: 0.30, move: 0.85, air: 3.5, fire: 0.13, crouch: 0.85 } },
  mp7:       { name: 'MP7', class: 'smg', team: null, price: 1500, killReward: 600,
    damage: 29, armorPen: 0.625, rpm: 750, mag: 30, reserve: 120, reloadTime: 2.4,
    moveSpeed: 4.7, rangeMod: 0.85, penPower: 60, headshotMult: 4, auto: true,
    recoil: { vert: 1.7, horiz: 1.1, period: 6 }, recovery: 0.34,
    inacc: { stand: 0.32, move: 0.9, air: 3.6, fire: 0.14, crouch: 0.85 } },
  mp8:       { name: 'MP8', class: 'smg', team: null, price: 1400, killReward: 600,
    damage: 28, armorPen: 0.64, rpm: 780, mag: 30, reserve: 120, reloadTime: 2.3,
    moveSpeed: 4.75, rangeMod: 0.86, penPower: 60, headshotMult: 4, auto: true,
    recoil: { vert: 1.6, horiz: 1.05, period: 6 }, recovery: 0.34,
    inacc: { stand: 0.31, move: 0.9, air: 3.6, fire: 0.14, crouch: 0.85 } },
  ump45:     { name: 'UMP-45', class: 'smg', team: null, price: 1200, killReward: 600,
    damage: 35, armorPen: 0.65, rpm: 666, mag: 25, reserve: 100, reloadTime: 3.5,
    moveSpeed: 4.7, rangeMod: 0.82, penPower: 65, headshotMult: 4, auto: true,
    recoil: { vert: 2.0, horiz: 1.2, period: 5 }, recovery: 0.36,
    inacc: { stand: 0.36, move: 1.0, air: 3.8, fire: 0.16, crouch: 0.85 } },
  p90:       { name: 'P90', class: 'smg', team: null, price: 2350, killReward: 300,
    damage: 26, armorPen: 0.69, rpm: 857, mag: 50, reserve: 100, reloadTime: 3.3,
    moveSpeed: 4.6, rangeMod: 0.885, penPower: 65, headshotMult: 4, auto: true,
    recoil: { vert: 1.5, horiz: 1.15, period: 7 }, recovery: 0.34,
    inacc: { stand: 0.42, move: 0.85, air: 3.6, fire: 0.12, crouch: 0.85 } },
  bizon:     { name: 'PP-Bizon', class: 'smg', team: null, price: 1400, killReward: 600,
    damage: 27, armorPen: 0.575, rpm: 750, mag: 64, reserve: 120, reloadTime: 2.4,
    moveSpeed: 4.7, rangeMod: 0.80, penPower: 55, headshotMult: 4, auto: true,
    recoil: { vert: 1.5, horiz: 1.0, period: 6 }, recovery: 0.33,
    inacc: { stand: 0.38, move: 0.9, air: 3.7, fire: 0.13, crouch: 0.85 } },

  // ---------------- rifles ----------------
  famas:     { name: 'FAMAS', class: 'rifle', team: 'CT', price: 2050, killReward: 300,
    damage: 30, armorPen: 0.70, rpm: 666, mag: 25, reserve: 90, reloadTime: 3.3,
    moveSpeed: 4.35, rangeMod: 0.96, penPower: 100, headshotMult: 4, auto: true,
    recoil: { vert: 2.4, horiz: 1.4, period: 6 }, recovery: 0.40,
    inacc: { stand: 0.26, move: 2.4, air: 5.5, fire: 0.19, crouch: 0.8 } },
  galil:     { name: 'Galil AR', class: 'rifle', team: 'T', price: 1800, killReward: 300,
    damage: 30, armorPen: 0.775, rpm: 666, mag: 35, reserve: 90, reloadTime: 3.0,
    moveSpeed: 4.3, rangeMod: 0.98, penPower: 100, headshotMult: 4, auto: true,
    recoil: { vert: 2.5, horiz: 1.6, period: 6 }, recovery: 0.42,
    inacc: { stand: 0.30, move: 2.5, air: 5.6, fire: 0.20, crouch: 0.8 } },
  m4a4:      { name: 'M4A4', class: 'rifle', team: 'CT', price: 3100, killReward: 300,
    damage: 33, armorPen: 0.70, rpm: 666, mag: 30, reserve: 90, reloadTime: 3.1,
    moveSpeed: 4.35, rangeMod: 0.97, penPower: 100, headshotMult: 4, auto: true,
    recoil: { vert: 2.3, horiz: 1.25, period: 6 }, recovery: 0.38,
    inacc: { stand: 0.22, move: 2.3, air: 5.4, fire: 0.175, crouch: 0.8 } },
  m4a1s:     { name: 'M4A1-S', class: 'rifle', team: 'CT', price: 2900, killReward: 300,
    damage: 38, armorPen: 0.70, rpm: 600, mag: 20, reserve: 80, reloadTime: 3.1,
    moveSpeed: 4.35, rangeMod: 0.94, penPower: 100, headshotMult: 4, auto: true, suppressed: true,
    recoil: { vert: 2.2, horiz: 1.1, period: 6 }, recovery: 0.37,
    inacc: { stand: 0.20, move: 2.2, air: 5.3, fire: 0.17, crouch: 0.8 } },
  ak47:      { name: 'AK-47', class: 'rifle', team: 'T', price: 2700, killReward: 300,
    damage: 36, armorPen: 0.775, rpm: 600, mag: 30, reserve: 90, reloadTime: 2.4,
    moveSpeed: 4.3, rangeMod: 0.98, penPower: 100, headshotMult: 4, auto: true,
    recoil: { vert: 2.9, horiz: 1.7, period: 6 }, recovery: 0.45,
    inacc: { stand: 0.28, move: 2.6, air: 5.8, fire: 0.21, crouch: 0.8 } },
  aug:       { name: 'AUG', class: 'rifle', team: 'CT', price: 3300, killReward: 300,
    damage: 28, armorPen: 0.90, rpm: 666, mag: 30, reserve: 90, reloadTime: 3.8,
    moveSpeed: 4.4, rangeMod: 0.967, penPower: 100, headshotMult: 4, auto: true, zoom: 1.5,
    recoil: { vert: 2.1, horiz: 1.15, period: 6 }, recovery: 0.37,
    inacc: { stand: 0.20, move: 2.2, air: 5.3, fire: 0.16, crouch: 0.8 } },
  sg553:     { name: 'SG 553', class: 'rifle', team: 'T', price: 3000, killReward: 300,
    damage: 30, armorPen: 1.0, rpm: 666, mag: 30, reserve: 90, reloadTime: 2.8,
    moveSpeed: 4.25, rangeMod: 0.98, penPower: 100, headshotMult: 4, auto: true, zoom: 1.5,
    recoil: { vert: 2.6, horiz: 1.5, period: 6 }, recovery: 0.42,
    inacc: { stand: 0.24, move: 2.4, air: 5.5, fire: 0.19, crouch: 0.8 } },

  // ---------------- snipers ----------------
  ssg08:     { name: 'SSG 08', class: 'sniper', team: null, price: 1700, killReward: 300,
    damage: 88, armorPen: 0.85, rpm: 48, mag: 10, reserve: 90, reloadTime: 3.7,
    moveSpeed: 4.6, rangeMod: 0.99, penPower: 150, headshotMult: 3, auto: false, zoom: 4, boltAction: true,
    recoil: { vert: 3.5, horiz: 1.0, period: 4 }, recovery: 0.6,
    inacc: { stand: 3.5, move: 4.0, air: 0.15, fire: 1.0, crouch: 0.9, scoped: 0.02 } },
  awp:       { name: 'AWP', class: 'sniper', team: null, price: 4750, killReward: 100,
    damage: 115, armorPen: 0.975, rpm: 41, mag: 5, reserve: 30, reloadTime: 3.7,
    moveSpeed: 4.0, rangeMod: 0.99, penPower: 200, headshotMult: 3, auto: false, zoom: 6, boltAction: true,
    recoil: { vert: 6.0, horiz: 1.2, period: 4 }, recovery: 0.8,
    inacc: { stand: 4.5, move: 5.5, air: 8.0, fire: 1.5, crouch: 0.9, scoped: 0.015 } },
  scar20:    { name: 'SCAR-20', class: 'sniper', team: 'CT', price: 5000, killReward: 300,
    damage: 80, armorPen: 0.825, rpm: 240, mag: 20, reserve: 90, reloadTime: 2.7,
    moveSpeed: 4.1, rangeMod: 0.98, penPower: 200, headshotMult: 3, auto: true, zoom: 4,
    recoil: { vert: 3.2, horiz: 1.6, period: 5 }, recovery: 0.5,
    inacc: { stand: 3.5, move: 4.5, air: 7.0, fire: 0.6, crouch: 0.9, scoped: 0.06 } },
  g3sg1:     { name: 'G3SG1', class: 'sniper', team: 'T', price: 5000, killReward: 300,
    damage: 80, armorPen: 0.825, rpm: 240, mag: 20, reserve: 90, reloadTime: 4.6,
    moveSpeed: 4.05, rangeMod: 0.98, penPower: 200, headshotMult: 3, auto: true, zoom: 4,
    recoil: { vert: 3.3, horiz: 1.7, period: 5 }, recovery: 0.5,
    inacc: { stand: 3.5, move: 4.5, air: 7.0, fire: 0.6, crouch: 0.9, scoped: 0.06 } },
};
for (const [id, w] of Object.entries(WEAPONS)) w.id = id;

export const GRENADES = {
  he:         { name: 'HE Grenade', price: 300, maxCarry: 1, team: null, fuse: 1.64, damage: 98, radius: 10 },
  flash:      { name: 'Flashbang', price: 200, maxCarry: 2, team: null, fuse: 1.5, radius: 22 },
  smoke:      { name: 'Smoke Grenade', price: 300, maxCarry: 1, team: null, fuse: 1.2, radius: 3.4, duration: 18 },
  molotov:    { name: 'Molotov', price: 400, maxCarry: 1, team: 'T', fuse: 2.0, radius: 3.4, duration: 7, dps: 32 },
  incendiary: { name: 'Incendiary Grenade', price: 600, maxCarry: 1, team: 'CT', fuse: 2.0, radius: 3.4, duration: 7, dps: 32 },
  decoy:      { name: 'Decoy Grenade', price: 50, maxCarry: 1, team: null, fuse: 1.0, duration: 15 },
};
for (const [id, g] of Object.entries(GRENADES)) g.id = id;
export const GRENADE_ORDER = ['he', 'flash', 'smoke', 'molotov', 'incendiary', 'decoy'];

export const EQUIPMENT = {
  kevlar: { name: 'Kevlar Vest', price: 650 },
  helmet: { name: 'Kevlar + Helmet', price: 1000, upgradePrice: 350 },
};

// ---------------------------------------------------------------------------
// Deterministic recoil patterns. Every weapon gets a fixed sequence of
// per-shot view-punch deltas (degrees), seeded by its id — the same pattern
// every round, every session, so it can be learned and pulled against.
// Shape: strong vertical ramp for the first shots, then horizontal sway that
// alternates direction with a per-weapon period, plus small fixed jitter.
// ---------------------------------------------------------------------------
const patternCache = new Map();

export function recoilPattern(id) {
  if (patternCache.has(id)) return patternCache.get(id);
  const w = WEAPONS[id];
  const rng = mulberry32(strHash(id));
  const n = Math.max(w.mag, 12);
  const pts = [];
  const phase = rng() * Math.PI * 2;
  const dir0 = rng() > 0.5 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const ramp = i < 4 ? 0.45 + 0.18 * i : 1.0;
    const settle = w.settleAfter ? (i > w.settleAfter ? 0.35 : 1.0) : 1.0;
    const vert = w.recoil.vert * ramp * settle * (0.92 + rng() * 0.16);
    const swayIn = Math.min(1, Math.max(0, (i - 3) / 5));
    const sway = Math.sin((i / w.recoil.period) * Math.PI * 2 + phase) * w.recoil.horiz * swayIn * dir0;
    const jitter = (rng() - 0.5) * w.recoil.horiz * 0.5;
    pts.push({ x: (sway + jitter) * DEG, y: vert * DEG });
  }
  patternCache.set(id, pts);
  return pts;
}

// Per-shot inaccuracy (radians) for a shooter state.
export function computeInaccuracy(w, { speed, maxSpeed, grounded, crouched, fireInacc, scoped }) {
  const i = w.inacc;
  let acc;
  if (scoped && i.scoped !== undefined) acc = i.scoped;
  else acc = i.stand;
  const speedFrac = maxSpeed > 0 ? speed / maxSpeed : 0;
  if (!grounded) acc += i.air;
  else if (speedFrac > 0.34) acc += i.move * ((speedFrac - 0.34) / 0.66);
  acc += fireInacc;
  if (crouched && grounded) acc *= i.crouch;
  return Math.max(0.01, acc) * DEG;
}

export const DEFAULT_LOADOUT = { CT: 'usps', T: 'glock' };

export function killRewardFor(weaponId) {
  if (weaponId === 'knife') return KNIFE.killReward;
  if (weaponId === 'he' || weaponId === 'molotov' || weaponId === 'incendiary') return 300;
  const w = WEAPONS[weaponId];
  return w ? w.killReward : 300;
}

export function buyableFor(team) {
  const cats = [
    { title: 'PISTOLS', ids: ['glock', 'usps', 'p2000', 'dualies', 'p250', 'fiveseven', 'cz75', 'tec9', 'deagle', 'r8'] },
    { title: 'HEAVY', ids: ['nova', 'xm1014', 'mag7', 'sawedoff', 'm249', 'negev'] },
    { title: 'SMGS', ids: ['mp9', 'mac10', 'mp5sd', 'mp7', 'mp8', 'ump45', 'p90', 'bizon'] },
    { title: 'RIFLES', ids: ['famas', 'galil', 'm4a4', 'm4a1s', 'ak47', 'aug', 'sg553', 'ssg08', 'awp', 'scar20', 'g3sg1'] },
  ];
  return cats.map((c) => ({
    title: c.title,
    items: c.ids.filter((id) => !WEAPONS[id].team || WEAPONS[id].team === team).map((id) => WEAPONS[id]),
  }));
}
