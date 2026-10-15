// STORY — "WHO RUNS PORT HALCYON?"  Data only: chapters, crews, events,
// parts catalog, body-shop options, starter cars, and the text messages that
// carry the plot.
import { VINYLS, KITS, SPOILERS, HOODS } from '../car/kits.js';
import { RIM_NAMES, RIM_COLOR_NAMES } from '../car/model.js';

export const START_CASH = 8000;
export const GARAGE_SLOTS = 3;

// ------------------------------------------------------------------ chapters + crews

export const CHAPTERS = [
  {
    id: 'main', name: 'DOWNTOWN', crew: 'KINGS OF MAIN', color: '#ff3d6e', district: 'city',
    blurb: 'Four-lane boulevards, wet asphalt, neon. The Kings run every light on Main Street.',
    members: ['LIL MO', 'SPARKY', 'TINA', 'JAY-R', 'BOOGIE'],
    pool: ['civica', 'golfo', 'trueno', 'miyako'],
    boss: { name: 'DEZ', quote: 'Main Street is mine. Always has been.', car: 'silvio', tier: 0, skill: 0.74, look: { paint: '#f2f1ec', vinyl: 'tribal', paint2: '#c8102e', rims: 'six', rimColor: 'gold', kit: 'street', spoiler: 'gt', neon: '#ff2a6d', plate: 'KING DEZ' } },
  },
  {
    id: 'docks', name: 'THE DOCKS', crew: 'HARBOR RATS', color: '#ffb21e', district: 'docks',
    blurb: 'Container canyons and gantry cranes. Sodium light, diesel, salt — and no rules.',
    members: ['RUST', 'BILGE', 'MARLOW', 'KEEL', 'SKIFF'],
    pool: ['silvio', 'nx350', 'stallion', 'golfo'],
    boss: { name: 'TANK', quote: 'I hit things for a living, kid.', car: 'stallion', tier: 1, skill: 0.8, look: { paint: '#141416', vinyl: 'stripes', paint2: '#e3b52a', rims: 'dish', rimColor: 'black', hood: 'scoop', kit: 'race', plate: 'TANK' } },
  },
  {
    id: 'pass', name: 'THE PASS', crew: 'KAIDO GHOSTS', color: '#46e8ff', district: 'mountain',
    blurb: 'Guardrail on one side, rock on the other. The Ghosts only race downhill, and only at night.',
    members: ['HAYATE', 'SORA', 'RIN', 'TETSU', 'MIKA'],
    pool: ['kaze', 'lancet', 'rz7', 'silvio', 'm3'],
    boss: { name: 'KAITO', quote: 'The mountain decides. Not the car.', car: 'trueno', tier: 3, skill: 0.88, look: { paint: '#f2f1ec', vinyl: 'twotone', paint2: '#141416', rims: 'dish', rimColor: 'bronze', hood: 'carbon', plate: 'GHOST', number: 86 } },
  },
  {
    id: 'desert', name: 'ROUTE 99', crew: 'ROUTE 99 SYNDICATE', color: '#ff7a2a', district: 'desert',
    blurb: 'Two hundred miles of heat shimmer. The Syndicate races for money — big money.',
    members: ['DUNE', 'RATTLER', 'MESA', 'COLT', 'SIDEWINDER'],
    pool: ['suprano', 'skyhawk', 'm3', 'rz7', 'stallion'],
    boss: { name: 'VEX', quote: 'Twenty-five grand says you blink first.', car: 'venom', tier: 1, skill: 0.86, look: { paint: '#7a1020', vinyl: 'stripes', paint2: '#141416', rims: 'five', rimColor: 'chrome', kit: 'wide', spoiler: 'big', plate: 'VEX' } },
  },
  {
    id: 'freq', name: 'THE FREQUENCY', crew: 'THE FREQUENCY', color: '#a45cf0', district: 'highway',
    blurb: 'Nobody knows who runs it. Interstates at 200, and the old raceway after hours.',
    members: ['STATIC', 'ECHO', 'CIPHER', 'NULL', 'HALO'],
    pool: ['stuttgard', 'venom', 'skyhawk', 'suprano', 'pipistrello'],
    boss: { name: 'ZERO', quote: '...', car: 'pipistrello', tier: 2, skill: 0.92, look: { paint: '#0e0f12', finish: 'matte', vinyl: 'kanji', paint2: '#a45cf0', rims: 'turbine', rimColor: 'red', neon: '#a45cf0', tint: 3, plate: 'ZERO' } },
  },
];

// ------------------------------------------------------------------ events
// type: circuit | sprint | knockout | drag | timeattack (vs the clock: tt = target factor
// on a pro's lap in your own car — 1.0 means "as fast as a pro").
// pr: the rivals' performance rating. prize: cash for 1st (2nd 45%, 3rd 20%).

export const EVENTS = [
  // ch 1 — DOWNTOWN
  { id: 'c1e1', ch: 0, name: 'FRIDAY NIGHT LIGHTS', track: 'downtown', type: 'circuit', laps: 2, rivals: 3, pr: 500, prize: 1500, flavor: 'Easy money. Four cars, two laps, the whole boulevard watching.' },
  { id: 'c1e2', ch: 0, name: 'UPTOWN RUN', track: 'uptown', type: 'sprint', rivals: 3, pr: 510, prize: 1800, traffic: true, flavor: 'Bridge to the hill, every light red, cabs in both directions. Nobody brakes first.' },
  { id: 'c1e3', ch: 0, name: 'LAST ONE OUT', track: 'oldtown', type: 'knockout', rivals: 3, pr: 520, prize: 2200, flavor: 'Old Town is tight and the Kings play rough. Last car each lap goes home.' },
  { id: 'c1e4', ch: 0, name: 'RAIN CHECK', track: 'uptown', type: 'timeattack', tt: 1.05, prize: 1600, flavor: 'Tina set the uptown record in the rain. Beat her number.' },
  { id: 'c1e5', ch: 0, name: 'MAIN EVENT', track: 'oldtown', type: 'circuit', laps: 3, rivals: 5, pr: 535, prize: 2600, flavor: 'Full grid on the narrow streets. Win this and Dez has to answer.' },
  { id: 'c1b', ch: 0, boss: true, name: 'DEZ: KING OF MAIN', track: 'downtown', type: 'circuit', laps: 3, rivals: 1, pr: 0, prize: 5000, flavor: 'One on one with the King. His S15 has never lost on Main.' },
  // ch 2 — THE DOCKS
  { id: 'c2e1', ch: 1, name: 'CONTAINER CANYON', track: 'harbor', type: 'circuit', laps: 3, rivals: 4, pr: 575, prize: 3200, flavor: 'Steel walls both sides, puddles deep enough to swim in.' },
  { id: 'c2e2', ch: 1, name: 'END OF THE PIER', track: 'pier9', type: 'circuit', laps: 3, rivals: 3, pr: 585, prize: 3400, flavor: 'Square corners and a hairpin over the water. Brake late or go swimming.' },
  { id: 'c2e3', ch: 1, name: 'RAT RACE', track: 'harbor', type: 'knockout', rivals: 4, pr: 595, prize: 4000, flavor: 'Five Rats, one survivor. They will trade paint.' },
  { id: 'c2e4', ch: 1, name: 'NIGHT SHIFT', track: 'pier9', type: 'drift', laps: 2, prize: 3000, flavor: 'The crane crews score every slide from the cab. Square corners, wet concrete — beat the Rats\' posted scores.' },
  { id: 'c2e5', ch: 1, name: 'DOWNTOWN DELIVERY', track: 'downtown', type: 'circuit', laps: 3, rivals: 5, pr: 605, prize: 4200, traffic: true, flavor: 'The Rats come uptown to settle a debt. Six cars, wet streets, rush-hour traffic.' },
  { id: 'c2b', ch: 1, boss: true, name: 'TANK: HARBOR MASTER', track: 'harbor', type: 'circuit', laps: 3, rivals: 1, pr: 0, prize: 10000, flavor: 'Tank\'s Stallion weighs as much as a forklift and drives like one. A fast one.' },
  // ch 3 — THE PASS
  { id: 'c3e1', ch: 2, name: 'DOWNHILL', track: 'kaido', type: 'sprint', rivals: 3, pr: 640, prize: 5500, flavor: 'Five kilometers of pass road, top to bottom. Respect the guardrail.' },
  { id: 'c3e2', ch: 2, name: 'FOG LINE', track: 'summit', type: 'circuit', laps: 3, rivals: 4, pr: 650, prize: 6000, flavor: 'Switchbacks up, a plunge down, fog everywhere in between.' },
  { id: 'c3e3', ch: 2, name: 'GHOST LAP', track: 'kaido', type: 'timeattack', tt: 1.03, prize: 5000, flavor: 'The Ghosts keep a time carved into the summit sign. Beat it.' },
  { id: 'c3e4', ch: 2, name: 'SUMMIT KNOCKOUT', track: 'summit', type: 'knockout', rivals: 4, pr: 665, prize: 7000, flavor: 'Three laps of the peak. Every time past the shrine, the back of the pack goes home.' },
  { id: 'c3e5', ch: 2, name: 'GOLDEN HOUR', track: 'crestwood', type: 'circuit', laps: 3, rivals: 5, pr: 675, prize: 7500, flavor: 'The Ghosts borrow the old hill circuit at sundown. Blind crest, corkscrew, carousel.' },
  { id: 'c3b', ch: 2, boss: true, name: 'KAITO: THE GHOST', track: 'kaido', type: 'sprint', rivals: 1, pr: 0, prize: 15000, flavor: 'A twenty-year-old Trueno that nobody has beaten downhill. Ever.' },
  // ch 4 — ROUTE 99
  { id: 'c4e1', ch: 3, name: 'HEAT SHIMMER', track: 'route99', type: 'sprint', rivals: 4, pr: 715, prize: 9000, flavor: 'Seven kilometers of two-lane through the Mojave. Watch the whoops.' },
  { id: 'c4e2', ch: 3, name: 'QUARTER MILE', track: 'drylake', type: 'drag', rivals: 1, pr: 725, prize: 8000, flavor: 'Salt flat, chalk lines, a tree of lights. Launch and shift. That\'s it.' },
  { id: 'c4e3', ch: 3, name: 'RED ROCK', track: 'redrock', type: 'circuit', laps: 3, rivals: 5, pr: 730, prize: 10000, flavor: 'Sunset loop between the buttes. Through the slot canyon, flat out.' },
  { id: 'c4e4', ch: 3, name: 'BAKED', track: 'redrock', type: 'knockout', rivals: 4, pr: 740, prize: 11000, flavor: 'Three laps of heat. The Syndicate bets on who drops first.' },
  { id: 'c4e5', ch: 3, name: 'BIG MONEY DRAG', track: 'drylake', type: 'drag', rivals: 3, pr: 755, prize: 12000, flavor: 'Four lanes, four cars, one envelope of cash on the hood.' },
  { id: 'c4b', ch: 3, boss: true, name: 'VEX: THE SYNDICATE', track: 'route99', type: 'sprint', rivals: 1, pr: 0, prize: 25000, flavor: 'Vex puts twenty-five grand on the hood of his Venom. Bring a real car.' },
  // ch 5 — THE FREQUENCY
  { id: 'c5e1', ch: 4, name: 'INTERSTATE 9', track: 'interstate', type: 'sprint', rivals: 4, pr: 790, prize: 15000, flavor: 'Flat out through traffic on the interstate. Two hundred or nothing.' },
  { id: 'c5e2', ch: 4, name: 'SKYLINE', track: 'skyline', type: 'circuit', laps: 3, rivals: 5, pr: 800, prize: 16000, flavor: 'Elevated expressway loop above the city lights.' },
  { id: 'c5e3', ch: 4, name: 'AFTER HOURS', track: 'redwood', type: 'circuit', laps: 3, rivals: 5, pr: 810, prize: 17000, flavor: 'Someone cut the lock on the raceway gate. Grand-prix rules, no marshals.' },
  { id: 'c5e4', ch: 4, name: 'SIGNAL LOSS', track: 'crestwood', type: 'knockout', rivals: 4, pr: 820, prize: 18000, flavor: 'Five cars, three laps of the hills. The Frequency wants to see who breaks.' },
  { id: 'c5e5', ch: 4, name: 'DEAD AIR', track: 'skyline', type: 'timeattack', tt: 1.02, prize: 15000, flavor: 'One lap of the skyline. They want a pro\'s time. Exactly a pro\'s time.' },
  { id: 'c5b', ch: 4, boss: true, name: 'ZERO', track: 'redwood', type: 'circuit', laps: 3, rivals: 1, pr: 0, prize: 50000, flavor: 'Midnight at Redwood. The last race you will ever need to win.' },
];

/** Wins needed in a chapter's regular events before its boss calls you out. */
export const BOSS_UNLOCK_WINS = 4;

// ------------------------------------------------------------------ performance parts

export const TIER_NAMES = ['STOCK', 'STREET', 'PRO', 'RACE'];
/** Chapter (0-based) at which each tier goes on sale. */
export const TIER_UNLOCK = [0, 0, 1, 2];
export const CLASS_PRICE = { D: 1.0, C: 1.25, B: 1.5, A: 1.85, S: 2.3 };

export const PERF_PARTS = [
  { id: 'engine', name: 'ENGINE', desc: 'Cams, pistons, ported head, balanced bottom end.', price: [1500, 4500, 11000],
    tiers: [{ power: 0.06 }, { power: 0.12, redline: 250 }, { power: 0.2, redline: 500 }] },
  { id: 'turbo', name: 'FORCED INDUCTION', desc: 'Turbo kit — or a bigger turbo, or a supercharger on the big engines.', price: [2500, 6000, 14000],
    tiers: [{ power: 0.07, turbo: 0.55 }, { power: 0.14, turbo: 0.8 }, { power: 0.22, turbo: 1.0 }] },
  { id: 'exhaust', name: 'INTAKE + EXHAUST', desc: 'Cold-air intake, headers, straight-through exhaust. Louder pops.', price: [600, 1500, 3500],
    tiers: [{ power: 0.03, exhaustSound: 0.15 }, { power: 0.05, exhaustSound: 0.3 }, { power: 0.08, exhaustSound: 0.45 }] },
  { id: 'ecu', name: 'ECU', desc: 'Remapped fuel and ignition. More midrange, more top.', price: [500, 1500, 3500],
    tiers: [{ power: 0.02, torqueLow: 0.05 }, { power: 0.04, torqueLow: 0.1 }, { power: 0.06, torqueLow: 0.16, redline: 250 }] },
  { id: 'trans', name: 'TRANSMISSION', desc: 'Short-shift kit, lighter flywheel, dog-box on the race tier.', price: [900, 2500, 6000],
    tiers: [{ shift: 0.2 }, { shift: 0.35 }, { shift: 0.5 }] },
  { id: 'susp', name: 'SUSPENSION', desc: 'Coilovers, sway bars, bushings. Lower and sharper.', price: [800, 2200, 5500],
    tiers: [{ handling: 0.1, lower: 0.3 }, { handling: 0.2, lower: 0.6 }, { handling: 0.32, lower: 1.0 }] },
  { id: 'tires', name: 'TIRES', desc: 'Stickier compounds and wider footprints.', price: [600, 1600, 4000],
    tiers: [{ grip: 0.03 }, { grip: 0.06 }, { grip: 0.1 }] },
  { id: 'brakes', name: 'BRAKES', desc: 'Pads, lines, big multi-piston calipers on the race tier.', price: [700, 1800, 4500],
    tiers: [{ brake: 0.08 }, { brake: 0.16 }, { brake: 0.26 }] },
  { id: 'weight', name: 'WEIGHT REDUCTION', desc: 'Seats, sound deadening, spare tire, AC. Then carbon panels.', price: [1000, 3000, 8000],
    tiers: [{ weight: 0.04 }, { weight: 0.08 }, { weight: 0.12 }] },
  { id: 'nitrous', name: 'NITROUS', desc: 'Bigger bottles, wetter shots. More boost for longer.', price: [700, 2000, 5000],
    tiers: [{ nitro: 0.8 }, { nitro: 1.0 }, { nitro: 1.3 }] },
  { id: 'aero', name: 'AERO', desc: 'Splitter, diffuser, undertray. Grip that grows with speed.', price: [900, 2500, 6000],
    tiers: [{ aero: 0.3 }, { aero: 0.6 }, { aero: 1.0 }] },
];

const SUM = ['power', 'torqueLow', 'redline', 'shift', 'handling', 'lower', 'grip', 'brake', 'weight', 'aero'];
const MAX = ['turbo', 'nitro', 'exhaustSound'];

/** Part levels {engine: 2, ...} → physics upgrades for derivePerf/Vehicle. */
export function upgradesFor(levels = {}, spec = null) {
  const up = {};
  for (const part of PERF_PARTS) {
    const lv = levels[part.id] || 0;
    if (!lv) continue;
    const t = part.tiers[lv - 1];
    for (const [k, v] of Object.entries(t)) {
      if (SUM.includes(k)) up[k] = (up[k] || 0) + v;
      else if (MAX.includes(k)) up[k] = Math.max(up[k] || 0, v);
    }
  }
  // the big engines get a supercharger instead of a turbo (no lag, all whine)
  if (spec && up.turbo && ['v8', 'v10', 'v12'].includes(spec.sound.layout)) {
    delete up.turbo;
    up.supercharger = true;
  }
  if (up.turbo) up.turboSound = up.turbo;
  return up;
}

export const uniformLevels = (tier) => Object.fromEntries(PERF_PARTS.map((p) => [p.id, tier]));

export function partPrice(part, tier, spec) {
  return Math.round(part.price[tier - 1] * (CLASS_PRICE[spec.cls] || 1) / 50) * 50;
}

// ------------------------------------------------------------------ body shop

export const PAINTS = [
  '#c8102e', '#f2f1ec', '#0e0f12', '#a9aeb5', '#1d3f8f', '#e3b52a', '#f26a1b', '#2b7a3a',
  '#5b2a86', '#36a8c9', '#7a1020', '#555b63', '#ff2a6d', '#9bff00', '#00c2ff', '#ffd400',
  '#3b2414', '#c9c2a6', '#6a8fb3', '#0b3d2e', '#d4547a', '#ff5ac8', '#e8e8e8', '#2a2d33',
];
export const FINISH_LIST = [['gloss', 'GLOSS', 0], ['metallic', 'METALLIC', 300], ['pearl', 'PEARL', 600], ['candy', 'CANDY', 900], ['matte', 'MATTE', 500], ['chrome', 'CHROME', 2500]];
export const NEONS = [null, '#ff2a6d', '#00e5ff', '#7a2cff', '#39ff6a', '#ffffff', '#ff8a00', '#ff2020'];

/** Body-shop categories: key in the look, the option list, label, price per change. */
export const BODY_PARTS = [
  { id: 'paint', name: 'PAINT', key: 'paint', options: PAINTS, label: () => '', price: 350, swatch: true },
  { id: 'finish', name: 'FINISH', key: 'finish', options: FINISH_LIST.map((f) => f[0]), label: (v) => FINISH_LIST.find((f) => f[0] === v)?.[1] || v, price: (v) => 200 + (FINISH_LIST.find((f) => f[0] === v)?.[2] || 0) },
  { id: 'vinyl', name: 'VINYL', key: 'vinyl', options: VINYLS, label: (v) => v.toUpperCase(), price: 500 },
  { id: 'paint2', name: 'VINYL COLOR', key: 'paint2', options: PAINTS, label: () => '', price: 250, swatch: true },
  { id: 'rims', name: 'RIMS', key: 'rims', options: RIM_NAMES, label: (v) => v.toUpperCase(), price: 1200 },
  { id: 'rimColor', name: 'RIM FINISH', key: 'rimColor', options: RIM_COLOR_NAMES, label: (v) => v.toUpperCase(), price: 300 },
  { id: 'rimSize', name: 'RIM SIZE', key: 'rimSize', options: [0, 1, 2, 3], label: (v) => (v ? `+${v} IN` : 'STOCK'), price: (v) => 300 + v * 350 },
  { id: 'kit', name: 'BODY KIT', key: 'kit', options: KITS, label: (v) => v.toUpperCase(), price: (v) => ({ stock: 300, street: 1800, race: 3200, wide: 5500 }[v] || 1000) },
  { id: 'spoiler', name: 'SPOILER', key: 'spoiler', options: SPOILERS, label: (v) => v.toUpperCase(), price: (v) => ({ none: 100, stock: 200, lip: 400, ducktail: 600, roof: 600, gt: 1200, evo: 1100, big: 1500, hoop: 900 }[v] || 600) },
  { id: 'hood', name: 'HOOD', key: 'hood', options: HOODS, label: (v) => v.toUpperCase(), price: (v) => ({ stock: 200, vented: 700, carbon: 1200, scoop: 900 }[v] || 600) },
  { id: 'tint', name: 'WINDOW TINT', key: 'tint', options: [0, 1, 2, 3], label: (v) => ['CLEAR', 'LIGHT', 'DARK', 'LIMO'][v], price: 150 },
  { id: 'neon', name: 'UNDERGLOW', key: 'neon', options: NEONS, label: (v) => (v ? '' : 'NONE'), price: 600, swatch: true },
  { id: 'ride', name: 'RIDE HEIGHT', key: 'ride', options: [0, 0.35, 0.7, 1], label: (v) => ['STOCK', 'LOWERED', 'SLAMMED', 'ON THE DECK'][[0, 0.35, 0.7, 1].indexOf(v)] || 'STOCK', price: 250 },
  { id: 'caliper', name: 'CALIPERS', key: 'caliper', options: ['#b8141c', '#e3b52a', '#1d3f8f', '#2b7a3a', '#0e0f12', '#f2f1ec', '#f26a1b'], label: () => '', price: 200, swatch: true },
];

// ------------------------------------------------------------------ cars

/** The classifieds on the bench: used starter cars. */
export const STARTERS = [
  { id: 'trueno', price: 5500, ad: '\'86 TRUENO. White/black, runs great. Smells like tofu. 210k miles. Cash only.', look: { paint: '#f2f1ec', vinyl: 'twotone', paint2: '#141416' } },
  { id: 'miyako', price: 6000, ad: '\'01 MIYAKO MX. Yellow, soft top leaks a little. Fun fun fun. No lowballers.', look: { paint: '#e3b52a' } },
  { id: 'civica', price: 6500, ad: '\'99 CIVICA SiR. Red, B-series screams to 8,600. Clean title. Must sell.', look: { paint: '#c8102e' } },
  { id: 'golfo', price: 7000, ad: '\'02 GOLFO 1.8T. Black, chipped, sleeper. Moving overseas, everything goes.', look: { paint: '#22252b' } },
];

/** Dealer: which classes are on sale from which chapter. */
export const DEALER_CLASS_UNLOCK = { D: 0, C: 0, B: 1, A: 2, S: 3 };
export const RESALE = 0.6;

// ------------------------------------------------------------------ messages

/**
 * Phone texts. trigger: 'start' | 'starter' | `unlock:${ch}` | `boss:${ch}` | `beat:${ch}` | 'end'.
 */
export const MESSAGES = [
  { id: 'm_start1', trigger: 'start', from: 'R', text: 'welcome to port halcyon. my dad\'s old body shop is yours while ur in town. keys under the mat.' },
  { id: 'm_start2', trigger: 'start', from: 'R', text: 'classifieds are on the bench. $8k won\'t get u much but it\'ll get u started.' },
  { id: 'm_starter', trigger: 'starter', from: 'R', text: 'nice ride. now go make some noise downtown. the KINGS OF MAIN run the boulevards. their leader DEZ thinks he\'s untouchable.' },
  { id: 'm_starter2', trigger: 'starter', from: 'R', text: 'races are pinned on the board. win enough of them and the king will come to u.' },
  { id: 'm_boss0', trigger: 'boss:0', from: 'DEZ', text: 'heard some new kid\'s been running his mouth on my streets. downtown. 3 laps. just u and me.' },
  { id: 'm_beat0', trigger: 'beat:0', from: 'R', text: 'DEZ is still crying into his slushie. nice. PRO parts are on the shelf now.' },
  { id: 'm_beat0b', trigger: 'beat:0', from: 'R', text: 'the HARBOR RATS heard about u. careful at the docks. TANK plays dirty.' },
  { id: 'm_boss1', trigger: 'boss:1', from: 'TANK', text: 'u touch my docks again u swim home. harbor. tonight.' },
  { id: 'm_beat1', trigger: 'beat:1', from: 'R', text: 'TANK\'s car is literally in the harbor lol. RACE parts unlocked. u\'ll need them.' },
  { id: 'm_beat1b', trigger: 'beat:1', from: 'R', text: 'next is the pass. the KAIDO GHOSTS. their guy KAITO drives a 20 year old toyoshi and nobody\'s beaten him downhill. ever.' },
  { id: 'm_boss2', trigger: 'boss:2', from: 'KAITO', text: 'Midnight. The top of the pass. Bring your best line.' },
  { id: 'm_beat2', trigger: 'beat:2', from: 'KAITO', text: 'Respect. You drive like water.' },
  { id: 'm_beat2b', trigger: 'beat:2', from: 'R', text: 'u beat KAITO?? ok i\'m a little scared of u now. the desert is all money — VEX runs the ROUTE 99 SYNDICATE. exotics on the dealer lot now too.' },
  { id: 'm_boss3', trigger: 'boss:3', from: 'VEX', text: 'I\'ll put up $25,000 that you can\'t keep up with me on 99. Bring a real car.' },
  { id: 'm_beat3', trigger: 'beat:3', from: 'R', text: 'one left. THE FREQUENCY. nobody knows who runs it. nobody.' },
  { id: 'm_beat3b', trigger: 'beat:3', from: '???', text: 'you\'ve been listening. now race. -0' },
  { id: 'm_boss4', trigger: 'boss:4', from: 'ZERO', text: 'redwood. midnight. the last race u will ever need.' },
  { id: 'm_end1', trigger: 'end', from: 'ZERO', text: '...' },
  { id: 'm_end2', trigger: 'end', from: 'ZERO', text: 'it was always me, kid. i had to know if u were the one.' },
  { id: 'm_end3', trigger: 'end', from: 'R', text: 'port halcyon is yours now. the frequency is yours. see u on the radio. -R' },
];

export const BASE_LOOK = { plate: 'MIDNITE' };
