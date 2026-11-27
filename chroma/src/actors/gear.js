// Gear: headgear, clothing and shoes. Each piece has one ability that tweaks
// gameplay a little. Looks are composed from body traits + three gear ids.

export const ABILITIES = {
  ink_saver: { name: 'Ink Saver', short: 'INK SAVE', desc: 'Main weapon uses 12% less ink.', glyph: '◆' },
  sub_saver: { name: 'Sub Saver', short: 'SUB SAVE', desc: 'Sub weapons use 15% less ink.', glyph: '●' },
  ink_recovery: { name: 'Ink Recovery', short: 'INK REC', desc: 'Your tank refills 20% faster.', glyph: '↻' },
  run_speed: { name: 'Run Speed', short: 'RUN SPD', desc: 'Walk and run 8% faster.', glyph: '»' },
  swim_speed: { name: 'Swim Speed', short: 'SWIM SPD', desc: 'Swim through ink 8% faster.', glyph: '≈' },
  special_charge: { name: 'Special Charge', short: 'SP CHARGE', desc: 'Special meter fills 15% faster.', glyph: '★' },
  quick_respawn: { name: 'Quick Respawn', short: 'RESPAWN', desc: 'Respawn 1.5 seconds sooner.', glyph: '⟳' },
  ink_resist: { name: 'Ink Resistance', short: 'INK RES', desc: 'Enemy ink slows and hurts you less.', glyph: '▲' },
};
export const ABILITY_IDS = Object.keys(ABILITIES);

const B = { drip: 'Drip Co.', hue: 'Hue Street', scale: 'Scalewell', gloop: 'Gloop', mirage: 'Mirage', tread: 'Treadly', prism: 'Prism Lab' };

export const HATS = [
  { id: 'none', name: 'Bare Crest', brand: '—', price: 0, ability: null, style: 'none' },
  { id: 'cap_red', name: 'Splash Cap', brand: B.hue, price: 0, ability: 'run_speed', style: 'cap', c1: '#ff4d5e', c2: '#ffffff' },
  { id: 'beanie_mint', name: 'Mint Beanie', brand: B.gloop, price: 450, ability: 'ink_recovery', style: 'beanie', c1: '#3fd3b0', c2: '#f4f1ea' },
  { id: 'bucket_sun', name: 'Sunny Bucket', brand: B.drip, price: 600, ability: 'swim_speed', style: 'bucket', c1: '#ffd23f', c2: '#2b2f45' },
  { id: 'phones', name: 'Studio Cans', brand: B.prism, price: 900, ability: 'special_charge', style: 'headphones', c1: '#2b2f45', c2: '#ff2e88' },
  { id: 'visor_blue', name: 'Court Visor', brand: B.tread, price: 500, ability: 'run_speed', style: 'visor', c1: '#1e6bff', c2: '#ffffff' },
  { id: 'goggles', name: 'Dive Goggles', brand: B.scale, price: 1100, ability: 'swim_speed', style: 'goggles', c1: '#ff7a00', c2: '#9fe7ff' },
  { id: 'beret', name: 'Painter\'s Beret', brand: B.mirage, price: 800, ability: 'ink_saver', style: 'beret', c1: '#a335ff', c2: '#1b1530' },
  { id: 'bandana', name: 'Rally Bandana', brand: B.hue, price: 350, ability: 'quick_respawn', style: 'bandana', c1: '#ff2e88', c2: '#ffffff' },
  { id: 'cap_back', name: 'Backwards Snap', brand: B.drip, price: 700, ability: 'sub_saver', style: 'capback', c1: '#2ec4b6', c2: '#1b1530' },
  { id: 'party', name: 'Party Cone', brand: B.gloop, price: 1500, ability: 'special_charge', style: 'party', c1: '#ffd23f', c2: '#ff2e88' },
  { id: 'beanie_dark', name: 'Night Beanie', brand: B.scale, price: 650, ability: 'ink_resist', style: 'beanie', c1: '#2b2f45', c2: '#ffd23f' },
];

export const CLOTHES = [
  { id: 'tee_basic', name: 'Basic Tee', brand: B.hue, price: 0, ability: 'ink_saver', style: 'tee', c1: '#f4f1ea', c2: '#ff2e88', emblem: 'splat' },
  { id: 'hoodie_grape', name: 'Grape Hoodie', brand: B.gloop, price: 700, ability: 'ink_recovery', style: 'hoodie', c1: '#8e5cff', c2: '#ffd23f', emblem: 'none' },
  { id: 'track_lime', name: 'Lime Track Top', brand: B.tread, price: 900, ability: 'run_speed', style: 'jacket', c1: '#7bd13c', c2: '#1b1530', emblem: 'stripe' },
  { id: 'varsity', name: 'Varsity Scales', brand: B.drip, price: 1400, ability: 'special_charge', style: 'varsity', c1: '#c8283c', c2: '#f4f1ea', emblem: 'star' },
  { id: 'raincoat', name: 'Puddle Raincoat', brand: B.scale, price: 1200, ability: 'ink_resist', style: 'raincoat', c1: '#ffd23f', c2: '#2b2f45', emblem: 'none' },
  { id: 'vest', name: 'Utility Vest', brand: B.mirage, price: 800, ability: 'sub_saver', style: 'vest', c1: '#5a6b3c', c2: '#ff7a00', emblem: 'none' },
  { id: 'tee_sky', name: 'Sky Burst Tee', brand: B.hue, price: 400, ability: 'swim_speed', style: 'tee', c1: '#5bc0ff', c2: '#ffffff', emblem: 'circle' },
  { id: 'hoodie_coral', name: 'Coral Zip Hoodie', brand: B.gloop, price: 950, ability: 'quick_respawn', style: 'hoodie', c1: '#ff7b6b', c2: '#2b2f45', emblem: 'stripe' },
  { id: 'tank_mint', name: 'Mint Tank', brand: B.tread, price: 500, ability: 'swim_speed', style: 'tank', c1: '#3fd3b0', c2: '#1b1530', emblem: 'splat' },
  { id: 'jacket_night', name: 'Neon Night Jacket', brand: B.prism, price: 1800, ability: 'ink_saver', style: 'jacket', c1: '#1b1e2b', c2: '#ff2e88', emblem: 'stripe' },
  { id: 'varsity_blue', name: 'Cobalt Letterman', brand: B.drip, price: 1500, ability: 'run_speed', style: 'varsity', c1: '#1e4bb8', c2: '#ffd23f', emblem: 'star' },
  { id: 'tee_pink', name: 'Bubblegum Tee', brand: B.hue, price: 300, ability: 'ink_recovery', style: 'tee', c1: '#ff8ac2', c2: '#1b1530', emblem: 'circle' },
];

export const SHOES = [
  { id: 'kicks_white', name: 'Clean Kicks', brand: B.tread, price: 0, ability: 'run_speed', style: 'sneaker', c1: '#ffffff', c2: '#ff2e88' },
  { id: 'hightop_red', name: 'Hoop High-Tops', brand: B.drip, price: 800, ability: 'quick_respawn', style: 'hightop', c1: '#e63946', c2: '#ffffff' },
  { id: 'boots_tan', name: 'Trail Boots', brand: B.scale, price: 950, ability: 'ink_resist', style: 'boot', c1: '#b5835a', c2: '#3d2b1f' },
  { id: 'slip_check', name: 'Checker Slips', brand: B.hue, price: 450, ability: 'swim_speed', style: 'slipon', c1: '#1b1530', c2: '#f4f1ea' },
  { id: 'kicks_lime', name: 'Lime Runners', brand: B.tread, price: 650, ability: 'run_speed', style: 'sneaker', c1: '#c8ff3a', c2: '#1b1530' },
  { id: 'hightop_sky', name: 'Sky High-Tops', brand: B.drip, price: 900, ability: 'special_charge', style: 'hightop', c1: '#5bc0ff', c2: '#ffffff' },
  { id: 'boots_black', name: 'Stomp Boots', brand: B.mirage, price: 1300, ability: 'sub_saver', style: 'boot', c1: '#23263a', c2: '#ffd23f' },
  { id: 'kicks_grape', name: 'Grape Dashers', brand: B.gloop, price: 700, ability: 'ink_saver', style: 'sneaker', c1: '#8e5cff', c2: '#ffd23f' },
  { id: 'slip_sun', name: 'Sunny Slips', brand: B.hue, price: 400, ability: 'ink_recovery', style: 'slipon', c1: '#ffd23f', c2: '#ff7a00' },
  { id: 'kicks_neon', name: 'Neon Sprinters', brand: B.prism, price: 1600, ability: 'swim_speed', style: 'sneaker', c1: '#1b1e2b', c2: '#00f0c8' },
];

const byId = (arr) => Object.fromEntries(arr.map((g) => [g.id, g]));
export const HAT = byId(HATS), CLOTH = byId(CLOTHES), SHOE = byId(SHOES);
export const GEAR_SLOTS = { hat: HAT, clothes: CLOTH, shoes: SHOE };
export const STARTER_GEAR = ['none', 'cap_red', 'tee_basic', 'kicks_white'];

// Body traits (salon)
export const SKIN_TONES = ['#7ccf6a', '#5fb8a6', '#e0b54a', '#d97b54', '#8fa8e0', '#c98be0', '#a9b86a', '#e78fa6'];
export const PATTERNS = ['stripes', 'spots', 'bands', 'plain'];
export const PATTERN_COLORS = ['#2f6b3a', '#1f4f6b', '#8a5a1f', '#7a2f2f', '#3b2f7a', '#f4f1ea', '#ffd23f', '#1b1530'];
export const CRESTS = ['crest', 'fan', 'horns', 'round'];
export const CREST_LABEL = { crest: 'Casque', fan: 'Frill Fan', horns: 'Tri-Horns', round: 'Dome' };
export const PATTERN_LABEL = { stripes: 'Stripes', spots: 'Spots', bands: 'Bands', plain: 'Plain' };
export const EYE_COLORS = ['#ff9f1c', '#3a7bff', '#18b06a', '#e63946', '#8e44ff', '#ffd23f', '#00b3c6', '#1b1530'];
export const BOTTOMS = ['#23263a', '#3d405b', '#5a4a3a', '#2f5d62', '#1d3557', '#6d597a', '#f4f1ea', '#c8553d'];

export function randomLook(r = Math.random) {
  const p = (a) => a[Math.floor(r() * a.length)];
  return {
    skin: p(SKIN_TONES), pattern: p(PATTERNS), patternColor: p(PATTERN_COLORS), crest: p(CRESTS), eyes: p(EYE_COLORS),
    bottom: p(BOTTOMS), hat: r() < 0.25 ? 'none' : p(HATS).id, clothes: p(CLOTHES).id, shoes: p(SHOES).id,
  };
}

// Upgrade looks saved by the earlier paint-drop-kid version
const CREST_FROM_HAIR = { drop: 'crest', twin: 'fan', mohawk: 'horns', bob: 'round' };
export function migrateLook(look) {
  if (!look) return randomLook();
  const out = { ...look };
  if (out.hair && !out.crest) out.crest = CREST_FROM_HAIR[out.hair] || 'crest';
  if (!SKIN_TONES.includes(out.skin)) out.skin = SKIN_TONES[0];
  if (!PATTERNS.includes(out.pattern)) out.pattern = 'stripes';
  if (!out.patternColor) out.patternColor = PATTERN_COLORS[0];
  if (!CRESTS.includes(out.crest)) out.crest = 'crest';
  if (!out.eyes) out.eyes = EYE_COLORS[0];
  if (!out.bottom) out.bottom = BOTTOMS[0];
  if (!HAT[out.hat]) out.hat = 'cap_red';
  if (!CLOTH[out.clothes]) out.clothes = 'tee_basic';
  if (!SHOE[out.shoes]) out.shoes = 'kicks_white';
  delete out.hair; delete out.top; delete out.topStyle;
  return out;
}

// Combine the three gear abilities into gameplay multipliers
export function gearMods(look) {
  const m = { inkUse: 1, subInk: 1, inkRecover: 1, run: 1, swim: 1, special: 1, respawn: 0, inkResist: 1 };
  const ab = [HAT[look?.hat]?.ability, CLOTH[look?.clothes]?.ability, SHOE[look?.shoes]?.ability];
  for (const a of ab) {
    if (a === 'ink_saver') m.inkUse *= 0.88;
    else if (a === 'sub_saver') m.subInk *= 0.85;
    else if (a === 'ink_recovery') m.inkRecover *= 1.2;
    else if (a === 'run_speed') m.run *= 1.08;
    else if (a === 'swim_speed') m.swim *= 1.08;
    else if (a === 'special_charge') m.special *= 1.15;
    else if (a === 'quick_respawn') m.respawn += 1.5;
    else if (a === 'ink_resist') m.inkResist *= 0.55;
  }
  return m;
}
