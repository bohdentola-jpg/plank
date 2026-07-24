// THE ROSTER. Ten mascots plus two unlockables, each one an archetype moveset
// with its own specials, signature smashes, and build spec. Data only — the
// silhouette comes from `build` (models.js), the frame data from `moves` (moves.js).
import { mv, hit, archetype } from './moves.js';

// ============================================================ 1. BLITZ
const BLITZ = {
  id: 'blitz', name: 'BLITZ', title: 'THE WESTFIELD FALCON',
  bio: 'Mascot for the Westfield Falcons and the fastest thing on two talons. Hits like a dropped tray of nachos.',
  colors: { main: '#2a55b8', trim: '#f2b705', trim2: '#f2b705', skin: '#e8c37a', skin2: '#20439a', eye: '#141414', glove: '#f2b705' },
  alts: ['#c0273a', '#1e7a3c', '#efeade', '#5a2d82'],
  stats: { weight: 84, walk: 4.8, run: 9.2, air: 6.4, airAccel: 36, gravity: 33, jump: 15.6, hop: 10.6, djump: 14.8, jumps: 2, fall: 14, fastFall: 22, traction: 52, size: 0.98 },
  tier: { power: 3, speed: 5, range: 3, recovery: 5, weight: 2 },
  build: {
    scale: 1, leg: 0.3, legR: 0.078, arm: 0.29, armR: 0.07, paw: 'claw', foot: 'claw', sock: true, sleeve: true,
    torso: { kind: 'round', w: 0.33, h: 0.42, chestMark: true },
    head: { kind: 'round', size: 0.19, beak: true, crest: true, eyes: 'wide', brows: true, mouth: false },
    tail: { kind: 'bush', len: 0.34 }, ext: 'wings',
  },
  taunt: 'flares both wings and screeches',
  voice: { pick: 'Blitz' },
  moves: {
    ...archetype('speedster'),
    // signature: a rising talon rake that keeps him airborne
    fair: mv({ clip: 'fair', frames: 30, landCancel: true, landLag: 9, iasa: 28, hits: [
      hit({ start: 5, end: 7, x: 0.95, y: 1.25, r: 0.5, dmg: 6, angle: 70, kbBase: 12, kbGrowth: 45, sfx: 'slash', fx: 'slash' }),
      hit({ start: 9, end: 11, x: 1.05, y: 0.95, r: 0.52, dmg: 8, angle: 40, kbBase: 26, kbGrowth: 92, sfx: 'slash', fx: 'slash', group: 1 }),
    ] }),
    nspecial: mv({ name: 'FEATHER DART', clip: 'nspecial', frames: 30, iasa: 26, spawn: [{ frame: 10, proj: {
      kind: 'feather', r: 0.2, speed: 17, gravity: 2, life: 55, dmg: 5, angle: 20, kbBase: 14, kbGrowth: 34,
      color: '#f2b705', spin: 26, sfx: 'slash', fx: 'slash',
    } }] }),
    sspecial: mv({ name: 'TALON DASH', clip: 'sspecial', frames: 40, iasa: 36, driftMul: 0.4,
      momentum: [{ frame: 8, vx: 17, vy: 1.5, kill: true }, { frame: 20, vx: -6 }],
      hits: [hit({ start: 9, end: 19, x: 0.85, y: 0.95, r: 0.6, dmg: 11, angle: 42, kbBase: 30, kbGrowth: 78, sfx: 'thwack', fx: 'slash' })] }),
    uspecial: mv({ name: 'UPDRAFT', clip: 'uspecial', frames: 46, helpless: true, hangs: true, gravityMul: 0.55,
      momentum: [{ frame: 5, vy: 17, kill: true }, { frame: 16, vy: 4 }],
      hits: [
        hit({ start: 5, end: 8, x: 0.1, y: 1.2, r: 0.7, dmg: 4, angle: 90, kbBase: 8, kbGrowth: 24, setKb: 26, sfx: 'thwack' }),
        hit({ start: 9, end: 12, x: 0.1, y: 1.5, r: 0.7, dmg: 3, angle: 90, kbBase: 6, kbGrowth: 20, setKb: 24, group: 1 }),
        hit({ start: 13, end: 17, x: 0.1, y: 1.8, r: 0.72, dmg: 6, angle: 82, kbBase: 30, kbGrowth: 92, group: 2, sfx: 'slash', fx: 'slash' }),
      ] }),
    dspecial: mv({ name: 'DIVE BOMB', clip: 'dair', frames: 44, air: 'both', landLag: 16,
      momentum: [{ frame: 7, vy: -26, vx: 3, kill: true }],
      hits: [hit({ start: 8, end: 24, x: 0.15, y: 0.35, r: 0.55, dmg: 14, angle: 275, kbBase: 22, kbGrowth: 52, hitlag: 1.3, sfx: 'heavy', fx: 'star' })] }),
    finisher: mv({ name: 'SKY STRIKE', clip: 'finisher', frames: 82, finisher: true, voice: 'Sky strike',
      invuln: [1, 20], momentum: [{ frame: 22, vx: 24, vy: 12, kill: true }, { frame: 46, vx: -10, vy: -4 }],
      hits: [hit({ start: 24, end: 48, x: 0.9, y: 1.0, r: 1.15, dmg: 32, angle: 44, kbBase: 62, kbGrowth: 118, hitlag: 1.6, sfx: 'heavy', fx: 'star' })] }),
  },
};

// ============================================================ 2. TUSK
const TUSK = {
  id: 'tusk', name: 'TUSK', title: 'THE UNMOVABLE BOAR',
  bio: 'Retired from the tractor-pull circuit. Believes every problem is a wall to be run through.',
  colors: { main: '#7b4a2c', trim: '#d9c8a6', skin: '#c99a6a', skin2: '#6a3f26', eye: '#191012', metal: '#c9ccd4' },
  alts: ['#a53b2c', '#4a6a3a', '#e0d6c2', '#3a3f4a'],
  stats: { weight: 128, walk: 3.6, run: 6.6, air: 4.6, airAccel: 22, gravity: 40, jump: 14.2, hop: 9.6, djump: 12.8, jumps: 2, fall: 16.5, fastFall: 25, traction: 72, size: 1.2 },
  tier: { power: 5, speed: 2, range: 3, recovery: 2, weight: 5 },
  build: {
    scale: 1.16, leg: 0.28, legR: 0.1, arm: 0.3, armR: 0.095, armKind: 'box', paw: 'hoof', foot: 'hoof', legKind: 'box',
    torso: { kind: 'barrel', w: 0.42, h: 0.44, belt: true, pads: true },
    head: { kind: 'wide', size: 0.2, snout: true, teeth: true, nose: true, horns: true, ears: 'fin', eyes: 'dot', brows: true },
    tail: { kind: 'stub', len: 0.2 },
  },
  taunt: 'paws the ground and snorts steam',
  voice: { pick: 'Tusk' },
  moves: {
    ...archetype('heavy'),
    nspecial: mv({ name: 'SNORT CHARGE', clip: 'sspecial', frames: 54, iasa: 50, armor: { from: 6, to: 30, threshold: 11 },
      momentum: [{ frame: 8, vx: 13, kill: true }, { frame: 26, vx: -4 }],
      hits: [hit({ start: 9, end: 26, x: 1.0, y: 0.9, r: 0.78, dmg: 16, angle: 38, kbBase: 40, kbGrowth: 82, hitlag: 1.3, sfx: 'heavy', fx: 'star' })] }),
    sspecial: mv({ name: 'TUSK TOSS', clip: 'grab', frames: 40, noShield: true,
      hits: [hit({ start: 8, end: 12, x: 1.0, y: 0.9, r: 0.6, dmg: 4, grabHit: { frames: 26, dmg: 13, vx: 7, vy: 11 }, sfx: 'thwack' })] }),
    uspecial: mv({ name: 'BOAR BLAST', clip: 'uspecial', frames: 44, helpless: true, hangs: true,
      momentum: [{ frame: 6, vy: 15.5, kill: true }],
      hits: [
        hit({ start: 6, end: 12, x: 0.2, y: 1.9, r: 0.8, dmg: 15, angle: 88, kbBase: 34, kbGrowth: 96, hitlag: 1.3, sfx: 'heavy' }),
        hit({ start: 13, end: 20, x: 0.2, y: 1.7, r: 0.7, dmg: 7, angle: 80, kbBase: 24, kbGrowth: 70, group: 1 }),
      ] }),
    dspecial: mv({ name: 'QUAKE STOMP', clip: 'dspecial', frames: 50, iasa: 46, armor: { from: 4, to: 20, threshold: 9 },
      momentum: [{ frame: 4, vy: 9, kill: true }, { frame: 14, vy: -22 }],
      hits: [hit({ start: 18, end: 22, x: 0, y: 0.28, r: 1.9, dmg: 17, angle: 76, kbBase: 44, kbGrowth: 84, hitlag: 1.5, sfx: 'heavy', fx: 'ring' })] }),
    finisher: mv({ name: 'STAMPEDE', clip: 'finisher', frames: 96, finisher: true, voice: 'Stampede',
      armor: { from: 1, to: 70, threshold: 40 },
      momentum: [{ frame: 18, vx: 20, kill: true }, { frame: 62, vx: -8 }],
      hits: [hit({ start: 20, end: 64, x: 1.1, y: 1.0, r: 1.3, dmg: 34, angle: 40, kbBase: 66, kbGrowth: 112, hitlag: 1.7, sfx: 'heavy', fx: 'star' })] }),
  },
};

// ============================================================ 3. CHIP
const CHIP = {
  id: 'chip', name: 'CHIP', title: 'POCKET-SIZED MENACE',
  bio: 'Stole the concession stand takings in 1998 and has never been caught. Fights dirty, apologises never.',
  colors: { main: '#c8802c', trim: '#f4e3c0', skin: '#f0dcae', skin2: '#a86420', eye: '#120e0c', glove: '#5a3a18' },
  alts: ['#b03a3a', '#3a7ab0', '#e8e2d0', '#6a6a72'],
  stats: { weight: 70, walk: 4.9, run: 9.6, air: 6.6, airAccel: 38, gravity: 30, jump: 15.0, hop: 10.0, djump: 14.2, jumps: 3, fall: 12.6, fastFall: 20, traction: 46, size: 0.82 },
  tier: { power: 2, speed: 5, range: 2, recovery: 4, weight: 1 },
  build: {
    scale: 0.86, leg: 0.26, legR: 0.075, arm: 0.25, armR: 0.062, paw: 'glove', foot: 'paw',
    torso: { kind: 'pear', w: 0.32, h: 0.38, belly: true },
    head: { kind: 'round', size: 0.22, snout: true, nose: true, ears: 'round', eyes: 'wide', teeth: true },
    tail: { kind: 'bush', len: 0.4 },
  },
  taunt: 'stuffs both cheeks and grins',
  voice: { pick: 'Chip' },
  moves: {
    ...archetype('speedster'),
    nspecial: mv({ name: 'ACORN TOSS', clip: 'nspecial', frames: 32, iasa: 28, spawn: [{ frame: 11, proj: {
      kind: 'nut', r: 0.2, speed: 11, vy: 5, gravity: 24, life: 130, bounces: 2, dmg: 7, angle: 45,
      kbBase: 20, kbGrowth: 52, color: '#8a5a28', spin: 12, sfx: 'bonk', fx: 'spark',
    } }] }),
    sspecial: mv({ name: 'TAIL SPIN', clip: 'sspecial', frames: 46, iasa: 42, driftMul: 0.6,
      momentum: [{ frame: 6, vx: 12, kill: true }, { frame: 26, vx: -5 }],
      hits: [
        hit({ start: 7, end: 10, x: 0.75, y: 0.9, r: 0.55, dmg: 3, angle: 100, setKb: 22, kbBase: 6, kbGrowth: 12, sfx: 'thwack' }),
        hit({ start: 11, end: 14, x: 0.75, y: 0.9, r: 0.55, dmg: 3, angle: 100, setKb: 22, kbBase: 6, kbGrowth: 12, group: 1, sfx: 'thwack' }),
        hit({ start: 15, end: 18, x: 0.75, y: 0.9, r: 0.55, dmg: 3, angle: 100, setKb: 22, kbBase: 6, kbGrowth: 12, group: 2, sfx: 'thwack' }),
        hit({ start: 19, end: 23, x: 0.85, y: 0.9, r: 0.6, dmg: 6, angle: 44, kbBase: 34, kbGrowth: 88, group: 3, sfx: 'slash', fx: 'slash' }),
      ] }),
    uspecial: mv({ name: 'GLIDE TAIL', clip: 'uspecial', frames: 60, helpless: true, hangs: true, gravityMul: 0.42, driftMul: 1.4,
      momentum: [{ frame: 5, vy: 13.5, kill: true }],
      stall: { frame: 22, vy: 1.5 },
      hits: [hit({ start: 5, end: 40, x: 0.15, y: 1.55, r: 0.62, dmg: 2, angle: 90, setKb: 18, kbBase: 4, kbGrowth: 8, hitlag: 0.6, sfx: 'thwack' })] }),
    dspecial: mv({ name: 'BURROW', clip: 'dspecial', frames: 58, iasa: 54, invuln: [8, 30],
      momentum: [{ frame: 30, vy: 13, kill: true }],
      hits: [hit({ start: 30, end: 36, x: 0.1, y: 1.1, r: 0.75, dmg: 13, angle: 88, kbBase: 30, kbGrowth: 96, hitlag: 1.25, sfx: 'heavy', fx: 'ring' })] }),
    finisher: mv({ name: 'NUT AVALANCHE', clip: 'finisher', frames: 90, finisher: true, voice: 'Nut avalanche',
      invuln: [1, 24],
      spawn: Array.from({ length: 9 }, (_, i) => ({ frame: 18 + i * 5, proj: {
        kind: 'nut', r: 0.26, speed: 6 + i, vy: 6, gravity: 26, life: 110, bounces: 1, dmg: 8, angle: 50,
        kbBase: 30, kbGrowth: 70, color: '#8a5a28', spin: 20, sfx: 'bonk', fx: 'spark', explode: null,
      } })),
      hits: [hit({ start: 16, end: 20, x: 0.7, y: 0.9, r: 0.9, dmg: 10, angle: 90, kbBase: 40, kbGrowth: 60, sfx: 'heavy' })] }),
  },
};

// ============================================================ 4. VOLT-9
const VOLT = {
  id: 'volt', name: 'VOLT-9', title: 'STORE DEMO UNIT',
  bio: 'Built to loop a trailer on a shop floor in 1999. Achieved sentience during a power cut. Wants to fight.',
  colors: { main: '#b9c0cc', trim: '#e8433f', skin: '#7d8494', skin2: '#8f97a6', eye: '#66e2ff', metal: '#d6dbe4', glow: '#66e2ff' },
  alts: ['#d9b34a', '#5a7fd6', '#3a3f4a', '#7ad6a0'],
  stats: { weight: 104, walk: 4.0, run: 7.2, air: 5.4, airAccel: 30, gravity: 30, jump: 14.4, hop: 9.8, djump: 13.4, jumps: 2, fall: 12.8, fastFall: 21, traction: 58, size: 1.05 },
  tier: { power: 4, speed: 3, range: 5, recovery: 4, weight: 4 },
  build: {
    scale: 1.05, leg: 0.3, legR: 0.09, arm: 0.3, armR: 0.08, armKind: 'box', legKind: 'box', paw: 'metal', foot: 'boot',
    torso: { kind: 'box', w: 0.36, h: 0.44, chestMark: true, pack: true },
    head: { kind: 'box', size: 0.19, visor: true, antenna: true, eyes: 'dot', face: false, mouth: false },
    tail: { kind: 'wire', len: 0.3 }, ext: 'fins',
  },
  taunt: 'plays a jingle out of its chest speaker',
  voice: { pick: 'Volt nine' },
  moves: {
    ...archetype('zoner'),
    nspecial: mv({ name: 'ARC LASER', clip: 'nspecial', frames: 34, iasa: 30, spawn: [{ frame: 12, proj: {
      kind: 'bolt', r: 0.22, speed: 21, gravity: 0, life: 45, dmg: 6, angle: 361, kbBase: 16, kbGrowth: 40,
      color: '#66e2ff', pierce: false, sfx: 'zap', fx: 'zap',
    } }] }),
    sspecial: mv({ name: 'SHOCK DISC', clip: 'sspecial', frames: 40, iasa: 36, spawn: [{ frame: 14, proj: {
      kind: 'disc', r: 0.32, speed: 8, gravity: 0, life: 110, dmg: 10, angle: 361, kbBase: 24, kbGrowth: 62,
      color: '#8ad6ff', spin: 22, homing: 0.035, sfx: 'zap', fx: 'zap',
    } }] }),
    uspecial: mv({ name: 'JET HOVER', clip: 'uspecial', frames: 64, helpless: true, hangs: true, gravityMul: 0.3, driftMul: 1.6,
      momentum: [{ frame: 5, vy: 12, kill: true }, { frame: 24, vy: 5 }, { frame: 40, vy: 3 }],
      hits: [hit({ start: 5, end: 12, x: 0.1, y: 0.2, r: 0.62, dmg: 8, angle: 88, kbBase: 26, kbGrowth: 70, sfx: 'burn', fx: 'flame' })] }),
    dspecial: mv({ name: 'REFLECT FIELD', clip: 'dspecial', frames: 44, iasa: 40, reflect: { window: [6, 30], mult: 1.5 },
      hits: [hit({ start: 6, end: 9, x: 0, y: 1.0, r: 1.05, dmg: 6, angle: 60, kbBase: 30, kbGrowth: 50, sfx: 'zap', fx: 'ring' })] }),
    finisher: mv({ name: 'OVERCLOCK', clip: 'finisher', frames: 88, finisher: true, voice: 'Overclock',
      invuln: [1, 30],
      spawn: Array.from({ length: 6 }, (_, i) => ({ frame: 16 + i * 8, proj: {
        kind: 'bolt', r: 0.3, speed: 24, gravity: 0, life: 50, dmg: 9, angle: i % 2 ? 10 : 350,
        kbBase: 26, kbGrowth: 74, color: '#a8f0ff', pierce: true, sfx: 'zap', fx: 'zap',
      } })),
      hits: [hit({ start: 60, end: 66, x: 0.8, y: 1.0, r: 1.2, dmg: 22, angle: 42, kbBase: 60, kbGrowth: 106, hitlag: 1.6, sfx: 'zap', fx: 'star' })] }),
  },
};

// ============================================================ 5. CRUNCH
const CRUNCH = {
  id: 'crunch', name: 'CRUNCH', title: 'THE CLEARANCE-BIN KAIJU',
  bio: 'Was the star of three unreleased platformers. Ate the fourth pitch meeting.',
  colors: { main: '#3f9a56', trim: '#f2d23a', skin: '#e8e0c0', skin2: '#2f7a44', eye: '#e8433f' },
  alts: ['#8a4ab0', '#c04a2c', '#3a6ab0', '#4a4f56'],
  stats: { weight: 118, walk: 3.9, run: 7.0, air: 4.9, airAccel: 25, gravity: 38, jump: 14.6, hop: 9.8, djump: 13.2, jumps: 2, fall: 15.6, fastFall: 24, traction: 66, size: 1.14 },
  tier: { power: 5, speed: 2, range: 4, recovery: 3, weight: 5 },
  build: {
    scale: 1.12, leg: 0.29, legR: 0.096, arm: 0.28, armR: 0.086, paw: 'claw', foot: 'claw',
    torso: { kind: 'barrel', w: 0.4, h: 0.44, belly: true },
    head: { kind: 'wide', size: 0.21, snout: true, teeth: true, crest: true, eyes: 'dot', brows: true },
    tail: { kind: 'lizard', len: 0.55 },
  },
  taunt: 'roars at nobody in particular',
  voice: { pick: 'Crunch' },
  moves: {
    ...archetype('heavy'),
    // signature: the tail sweep replaces the default down tilt
    dtilt: mv({ clip: 'dtilt', frames: 30, iasa: 26, hits: [
      hit({ start: 7, end: 11, x: -0.9, y: 0.3, r: 0.7, dmg: 11, angle: 24, kbBase: 26, kbGrowth: 80, sfx: 'thwack' }),
      hit({ start: 7, end: 11, x: 0.95, y: 0.3, r: 0.6, dmg: 9, angle: 24, kbBase: 24, kbGrowth: 72, group: 1, sfx: 'thwack' }),
    ] }),
    nspecial: mv({ name: 'FIRE BREATH', clip: 'nspecial', frames: 56, iasa: 52, hits: [
      hit({ start: 12, end: 16, x: 1.0, y: 1.1, r: 0.55, dmg: 3, angle: 361, setKb: 20, kbBase: 4, kbGrowth: 10, sfx: 'burn', fx: 'flame' }),
      hit({ start: 17, end: 21, x: 1.35, y: 1.1, r: 0.6, dmg: 3, angle: 361, setKb: 22, kbBase: 4, kbGrowth: 10, group: 1, sfx: 'burn', fx: 'flame' }),
      hit({ start: 22, end: 26, x: 1.7, y: 1.15, r: 0.62, dmg: 3, angle: 361, setKb: 24, kbBase: 4, kbGrowth: 10, group: 2, sfx: 'burn', fx: 'flame' }),
      hit({ start: 27, end: 33, x: 2.0, y: 1.15, r: 0.65, dmg: 5, angle: 40, kbBase: 26, kbGrowth: 72, group: 3, sfx: 'burn', fx: 'flame' }),
    ] }),
    sspecial: mv({ name: 'TAIL WHIP', clip: 'sspecial', frames: 44, iasa: 40,
      momentum: [{ frame: 8, vx: 7, kill: true }],
      hits: [hit({ start: 12, end: 17, x: 1.25, y: 0.7, r: 0.8, dmg: 15, angle: 34, kbBase: 38, kbGrowth: 92, hitlag: 1.3, sfx: 'heavy', fx: 'slash' })] }),
    uspecial: mv({ name: 'REX LEAP', clip: 'uspecial', frames: 52, helpless: true, hangs: true,
      momentum: [{ frame: 8, vy: 16.5, vx: 3, kill: true }],
      hits: [
        hit({ start: 8, end: 14, x: 0.25, y: 1.9, r: 0.85, dmg: 14, angle: 84, kbBase: 32, kbGrowth: 94, hitlag: 1.3, sfx: 'heavy' }),
        hit({ start: 20, end: 34, x: 0.2, y: 0.3, r: 0.7, dmg: 9, angle: 270, kbBase: 22, kbGrowth: 46, group: 1, sfx: 'heavy', fx: 'ring' }),
      ] }),
    dspecial: mv({ name: 'KAIJU ROAR', clip: 'dspecial', frames: 54, iasa: 48, armor: { from: 6, to: 40, threshold: 14 },
      hits: [hit({ start: 14, end: 22, x: 0.6, y: 1.2, r: 1.5, dmg: 12, angle: 55, kbBase: 46, kbGrowth: 64, hitlag: 1.4, sfx: 'heavy', fx: 'ring' })] }),
    finisher: mv({ name: 'CITY SMASHER', clip: 'finisher', frames: 100, finisher: true, voice: 'City smasher',
      armor: { from: 1, to: 60, threshold: 30 },
      momentum: [{ frame: 20, vy: 14, kill: true }, { frame: 44, vy: -30 }],
      hits: [hit({ start: 52, end: 60, x: 0, y: 0.4, r: 2.6, dmg: 36, angle: 62, kbBase: 70, kbGrowth: 110, hitlag: 1.8, sfx: 'heavy', fx: 'star' })] }),
  },
};

// ============================================================ 6. RIBBIT
const RIBBIT = {
  id: 'ribbit', name: 'RIBBIT', title: 'THE POND NINJA',
  bio: 'Trained in a drainage ditch behind the store. Master of the tongue-grab and the smoke bomb.',
  colors: { main: '#4aa83a', trim: '#2a2f38', skin: '#d8e8a0', skin2: '#3a8a2c', eye: '#f2d23a', glove: '#2a2f38' },
  alts: ['#3a6ad6', '#c04a4a', '#8a4ab0', '#d8d0b8'],
  stats: { weight: 88, walk: 4.5, run: 8.4, air: 6.0, airAccel: 34, gravity: 32, jump: 16.4, hop: 11.0, djump: 15.4, jumps: 2, fall: 13.6, fastFall: 22, traction: 50, size: 0.95 },
  tier: { power: 3, speed: 4, range: 4, recovery: 4, weight: 2 },
  build: {
    scale: 0.96, leg: 0.31, legR: 0.084, arm: 0.27, armR: 0.068, paw: 'glove', foot: 'paw',
    torso: { kind: 'round', w: 0.34, h: 0.4, belt: true },
    head: { kind: 'wide', size: 0.2, eyes: 'stalk', hat: 'band', mouth: true, face: false },
    tail: { kind: 'none' },
  },
  taunt: 'vanishes in a puff and reappears cross-legged',
  voice: { pick: 'Ribbit' },
  moves: {
    ...archetype('brawler'),
    nspecial: mv({ name: 'TONGUE GRAB', clip: 'nspecial', frames: 46, noShield: true,
      hits: [hit({ start: 12, end: 20, x: 1.7, y: 1.0, r: 0.48, dmg: 3, grabHit: { frames: 30, dmg: 10, vx: 6, vy: 10 }, sfx: 'thwack' })] }),
    sspecial: mv({ name: 'KUNAI FAN', clip: 'sspecial', frames: 42, iasa: 38, spawn: [
      { frame: 12, proj: { kind: 'disc', r: 0.18, speed: 16, gravity: 3, life: 60, dmg: 4, angle: 20, kbBase: 12, kbGrowth: 28, color: '#c8ccd4', spin: 30, sfx: 'slash', fx: 'slash' } },
      { frame: 16, proj: { kind: 'disc', r: 0.18, speed: 15, gravity: 8, life: 60, dmg: 4, angle: 12, kbBase: 12, kbGrowth: 28, color: '#c8ccd4', spin: 30, sfx: 'slash', fx: 'slash' } },
      { frame: 20, proj: { kind: 'disc', r: 0.18, speed: 17, gravity: 0, life: 60, dmg: 4, angle: 30, kbBase: 14, kbGrowth: 32, color: '#c8ccd4', spin: 30, sfx: 'slash', fx: 'slash' } },
    ] }),
    uspecial: mv({ name: 'SMOKE LEAP', clip: 'uspecial', frames: 48, helpless: true, hangs: true, invuln: [4, 12],
      momentum: [{ frame: 4, vy: 19, kill: true }, { frame: 18, vy: 2 }],
      hits: [hit({ start: 16, end: 22, x: 0.15, y: 1.6, r: 0.68, dmg: 11, angle: 80, kbBase: 28, kbGrowth: 88, sfx: 'slash', fx: 'slash' })] }),
    dspecial: mv({ name: 'POND STANCE', clip: 'dspecial', frames: 46, counter: { window: [4, 24], mult: 1.5 } }),
    finisher: mv({ name: 'THOUSAND TONGUES', clip: 'finisher', frames: 92, finisher: true, voice: 'Thousand tongues',
      invuln: [1, 26],
      hits: Array.from({ length: 8 }, (_, i) => hit({
        start: 16 + i * 6, end: 19 + i * 6, x: 1.2 + (i % 3) * 0.3, y: 0.7 + (i % 4) * 0.35, r: 0.6,
        dmg: 3.4, angle: 361, setKb: 26, kbBase: 6, kbGrowth: 12, group: i, sfx: 'thwack', fx: 'spark',
      })).concat([hit({ start: 70, end: 76, x: 1.1, y: 1.0, r: 0.9, dmg: 14, angle: 42, kbBase: 58, kbGrowth: 104, hitlag: 1.6, sfx: 'heavy', fx: 'star', group: 20 })]) }),
  },
};

// ============================================================ 7. EL PLANCHA
const PLANCHA = {
  id: 'plancha', name: 'EL PLANCHA', title: 'LUCHADOR OF THE PLANK',
  bio: 'Never lost a match, never won a match — every bout ends when he suplexes the referee.',
  colors: { main: '#e8433f', trim: '#f2e3c0', skin: '#c98a5a', skin2: '#c03832', eye: '#141414', glove: '#f2e3c0' },
  alts: ['#3a6ad6', '#f2c14a', '#2f2f38', '#4aa87a'],
  stats: { weight: 112, walk: 4.2, run: 7.6, air: 5.0, airAccel: 27, gravity: 36, jump: 15.0, hop: 10.2, djump: 13.6, jumps: 2, fall: 15.0, fastFall: 23, traction: 64, size: 1.08 },
  tier: { power: 5, speed: 3, range: 2, recovery: 3, weight: 4 },
  build: {
    scale: 1.06, leg: 0.31, legR: 0.092, arm: 0.31, armR: 0.084, paw: 'mitt', foot: 'boot', sock: true,
    torso: { kind: 'box', w: 0.37, h: 0.44, belt: true, chestMark: true, cape: true },
    head: { kind: 'round', size: 0.19, eyes: 'dot', hat: 'band', face: false, mouth: true, brows: true },
    tail: { kind: 'none' },
  },
  taunt: 'flexes for a crowd that is not there',
  voice: { pick: 'El Plancha' },
  moves: {
    ...archetype('brawler'),
    fsmash: mv({ name: 'LARIAT', clip: 'fsmash', frames: 46, iasa: 42, charge: { maxFrames: 50, dmgMult: 1.42, kbMult: 1.14 },
      hits: [hit({ start: 13, end: 17, x: 1.15, y: 1.05, r: 0.68, dmg: 19, angle: 34, kbBase: 36, kbGrowth: 102, hitlag: 1.35, sfx: 'heavy', fx: 'star' })] }),
    nspecial: mv({ name: 'SPRINGBOARD SPLASH', clip: 'nspecial', frames: 52, iasa: 48,
      momentum: [{ frame: 8, vy: 12, vx: 6, kill: true }],
      hits: [hit({ start: 18, end: 30, x: 0.3, y: 0.4, r: 0.85, dmg: 14, angle: 280, kbBase: 26, kbGrowth: 58, hitlag: 1.3, sfx: 'heavy', fx: 'ring' })] }),
    sspecial: mv({ name: 'SUPLEX RUSH', clip: 'sspecial', frames: 48, noShield: true,
      momentum: [{ frame: 6, vx: 11, kill: true }, { frame: 20, vx: -4 }],
      hits: [hit({ start: 8, end: 20, x: 0.95, y: 0.95, r: 0.6, dmg: 5, grabHit: { frames: 34, dmg: 15, vx: 5, vy: 13 }, sfx: 'thwack' })] }),
    uspecial: mv({ name: 'ROPE-CLIMB ELBOW', clip: 'uspecial', frames: 46, helpless: true, hangs: true,
      momentum: [{ frame: 6, vy: 16, kill: true }],
      hits: [
        hit({ start: 6, end: 13, x: 0.3, y: 1.85, r: 0.75, dmg: 13, angle: 86, kbBase: 30, kbGrowth: 94, hitlag: 1.3, sfx: 'heavy' }),
        hit({ start: 22, end: 34, x: 0.25, y: 0.35, r: 0.65, dmg: 10, angle: 272, kbBase: 20, kbGrowth: 44, group: 1, sfx: 'heavy', fx: 'ring' }),
      ] }),
    dspecial: mv({ name: 'COUNTER SLAM', clip: 'dspecial', frames: 48, counter: { window: [4, 26], mult: 1.65 } }),
    finisher: mv({ name: 'PLANCHA SUPREMA', clip: 'finisher', frames: 94, finisher: true, voice: 'Plancha suprema',
      invuln: [1, 24], momentum: [{ frame: 16, vy: 20, vx: 10, kill: true }, { frame: 46, vy: -26 }],
      hits: [hit({ start: 46, end: 62, x: 0.2, y: 0.4, r: 1.6, dmg: 34, angle: 285, kbBase: 40, kbGrowth: 108, hitlag: 1.8, sfx: 'heavy', fx: 'star' })] }),
  },
};

// ============================================================ 8. ZORB
const ZORB = {
  id: 'zorb', name: 'ZORB', title: 'VISITOR FROM AISLE 9',
  bio: 'Arrived inside a returned copy of a space sim. Communicates entirely in bloops. Floats like a plastic bag.',
  colors: { main: '#8a5ad6', trim: '#c8f0a0', skin: '#b48ae8', skin2: '#7a4ac0', eye: '#1a1020', glow: '#c8f0a0' },
  alts: ['#3ad6c0', '#d64a8a', '#d6d64a', '#4a5ad6'],
  stats: { weight: 82, walk: 4.0, run: 6.8, air: 6.2, airAccel: 40, gravity: 24, jump: 13.6, hop: 9.2, djump: 13.0, jumps: 3, fall: 10.6, fastFall: 19, traction: 42, size: 1.0 },
  tier: { power: 3, speed: 3, range: 4, recovery: 5, weight: 2 },
  build: {
    scale: 1.0, leg: 0.24, legR: 0.08, arm: 0.28, armR: 0.075, paw: 'glove', foot: 'paw',
    torso: { kind: 'blob', w: 0.4, h: 0.42, belly: false },
    head: { kind: 'dome', size: 0.21, eyes: 'stalk', antenna: true, face: false, mouth: true },
    tail: { kind: 'none' },
  },
  taunt: 'inflates, deflates, apologises',
  voice: { pick: 'Zorb' },
  moves: {
    ...archetype('zoner'),
    nspecial: mv({ name: 'GRAVITY BALL', clip: 'nspecial', frames: 38, iasa: 34, spawn: [{ frame: 13, proj: {
      kind: 'ball', r: 0.34, speed: 6.5, vy: 1, gravity: -1.5, life: 150, dmg: 9, angle: 70, kbBase: 22, kbGrowth: 66,
      color: '#c8f0a0', spin: 6, homing: 0.02, sfx: 'zap', fx: 'ring',
    } }] }),
    sspecial: mv({ name: 'SLIME SLIDE', clip: 'sspecial', frames: 44, iasa: 40, slide: 0.2,
      momentum: [{ frame: 6, vx: 13, kill: true }, { frame: 24, vx: -5 }],
      hits: [hit({ start: 8, end: 22, x: 0.7, y: 0.42, r: 0.62, dmg: 10, angle: 30, kbBase: 26, kbGrowth: 74, sfx: 'thwack', fx: 'ring' })] }),
    uspecial: mv({ name: 'ANTI-GRAV', clip: 'uspecial', frames: 66, helpless: false, hangs: true, gravityMul: 0.15, driftMul: 1.8,
      momentum: [{ frame: 4, vy: 11, kill: true }, { frame: 22, vy: 6 }, { frame: 40, vy: 4 }],
      hits: [hit({ start: 4, end: 10, x: 0, y: 1.1, r: 0.9, dmg: 7, angle: 88, kbBase: 24, kbGrowth: 62, sfx: 'zap', fx: 'ring' })] }),
    dspecial: mv({ name: 'BOUNCE POD', clip: 'dspecial', frames: 50, iasa: 46, armor: { from: 6, to: 26, threshold: 10 },
      momentum: [{ frame: 8, vy: -18, kill: true }, { frame: 26, vy: 15 }],
      hits: [hit({ start: 10, end: 24, x: 0, y: 0.25, r: 0.85, dmg: 13, angle: 268, kbBase: 24, kbGrowth: 54, hitlag: 1.25, sfx: 'heavy', fx: 'ring' })] }),
    finisher: mv({ name: 'SINGULARITY', clip: 'finisher', frames: 96, finisher: true, voice: 'Singularity',
      invuln: [1, 40],
      hits: Array.from({ length: 6 }, (_, i) => hit({
        start: 18 + i * 8, end: 24 + i * 8, x: 0, y: 1.1, r: 3.2 - i * 0.15, dmg: 3.2,
        angle: 180 + (i % 2 ? 20 : -20), setKb: 14, kbBase: 2, kbGrowth: 4, group: i, sfx: 'zap', fx: 'zap',
      })).concat([hit({ start: 72, end: 80, x: 0, y: 1.1, r: 3.4, dmg: 20, angle: 90, kbBase: 66, kbGrowth: 112, hitlag: 1.9, sfx: 'heavy', fx: 'star', group: 30 })]) }),
  },
};

// ============================================================ 9. SIR CLANK
const CLANK = {
  id: 'clank', name: 'SIR CLANK', title: 'KNIGHT OF THE BARGAIN BIN',
  bio: 'Guarded a cardboard castle in a shop window for eleven years. Slow, honourable, extremely hard to move.',
  colors: { main: '#9aa4b4', trim: '#3a5ad6', skin: '#e8d0a8', skin2: '#8a94a4', eye: '#141820', metal: '#cdd4e0' },
  alts: ['#c0a83a', '#c04a4a', '#4a4f56', '#7ac0a0'],
  stats: { weight: 124, walk: 3.7, run: 6.8, air: 4.7, airAccel: 24, gravity: 39, jump: 14.0, hop: 9.4, djump: 12.6, jumps: 2, fall: 16.0, fastFall: 24, traction: 70, size: 1.14 },
  tier: { power: 5, speed: 2, range: 5, recovery: 2, weight: 5 },
  build: {
    scale: 1.12, leg: 0.3, legR: 0.098, arm: 0.32, armR: 0.088, armKind: 'box', legKind: 'box', paw: 'metal', foot: 'boot',
    torso: { kind: 'box', w: 0.38, h: 0.46, pads: true, belt: true, cape: true },
    head: { kind: 'box', size: 0.19, hat: 'helm', visor: true, eyes: 'dot', face: false, mouth: false },
    tail: { kind: 'none' },
  },
  taunt: 'plants his lance and salutes',
  voice: { pick: 'Sir Clank' },
  moves: {
    ...archetype('heavy'),
    ftilt: mv({ name: 'LANCE POKE', clip: 'ftilt', frames: 32, iasa: 28,
      hits: [hit({ start: 8, end: 12, x: 1.45, y: 1.0, r: 0.5, dmg: 12, angle: 361, kbBase: 26, kbGrowth: 84, sfx: 'heavy' })] }),
    nspecial: mv({ name: 'LANCE THRUST', clip: 'nspecial', frames: 48, iasa: 44, armor: { from: 8, to: 22, threshold: 12 },
      momentum: [{ frame: 10, vx: 6, kill: true }],
      hits: [hit({ start: 12, end: 18, x: 1.7, y: 1.0, r: 0.55, dmg: 16, angle: 361, kbBase: 32, kbGrowth: 92, hitlag: 1.3, sfx: 'heavy', fx: 'slash' })] }),
    sspecial: mv({ name: 'SHIELD BASH', clip: 'sspecial', frames: 56, iasa: 52, armor: { from: 6, to: 36, threshold: 16 },
      momentum: [{ frame: 8, vx: 10, kill: true }, { frame: 30, vx: -3 }],
      hits: [hit({ start: 10, end: 30, x: 1.05, y: 1.0, r: 0.72, dmg: 15, angle: 40, kbBase: 42, kbGrowth: 78, hitlag: 1.3, shieldDmg: 8, sfx: 'heavy', fx: 'ring' })] }),
    uspecial: mv({ name: 'GRAPPLE RISE', clip: 'uspecial', frames: 50, helpless: true, hangs: true,
      momentum: [{ frame: 8, vy: 17.5, kill: true }],
      hits: [hit({ start: 8, end: 16, x: 0.2, y: 2.0, r: 0.72, dmg: 12, angle: 88, kbBase: 28, kbGrowth: 90, sfx: 'heavy', fx: 'slash' })] }),
    dspecial: mv({ name: 'GUARD STANCE', clip: 'dspecial', frames: 54, counter: { window: [3, 32], mult: 1.4 },
      armor: { from: 3, to: 32, threshold: 20 } }),
    finisher: mv({ name: 'CHARGE OF THE BIN', clip: 'finisher', frames: 98, finisher: true, voice: 'For the bargain bin',
      armor: { from: 1, to: 72, threshold: 34 },
      momentum: [{ frame: 20, vx: 19, kill: true }, { frame: 70, vx: -6 }],
      hits: [hit({ start: 22, end: 72, x: 1.5, y: 1.0, r: 1.1, dmg: 33, angle: 36, kbBase: 64, kbGrowth: 114, hitlag: 1.8, sfx: 'heavy', fx: 'star' })] }),
  },
};

// ============================================================ 10. SPIRIT
const SPIRIT = {
  id: 'spirit', name: 'SPIRIT', title: 'CAPTAIN OF THE PEP SQUAD',
  bio: 'Runs the Westfield sideline with a megaphone and zero patience. Louder than the marching band.',
  colors: { main: '#f2b705', trim: '#14306e', skin: '#e8c8a0', skin2: '#d9a600', eye: '#141414', glove: '#f4f4f2' },
  alts: ['#c0273a', '#3f7ce8', '#f4f4f2', '#3fbf6a'],
  stats: { weight: 90, walk: 4.6, run: 8.6, air: 6.0, airAccel: 34, gravity: 32, jump: 16.0, hop: 10.8, djump: 15.2, jumps: 2, fall: 13.4, fastFall: 21, traction: 54, size: 0.98 },
  tier: { power: 3, speed: 4, range: 4, recovery: 4, weight: 3 },
  build: {
    scale: 0.98, leg: 0.32, legR: 0.08, arm: 0.28, armR: 0.068, paw: 'glove', foot: 'shoe', sock: true, sleeve: true,
    torso: { kind: 'pear', w: 0.32, h: 0.42, jersey: true, belt: true },
    head: { kind: 'round', size: 0.19, eyes: 'wide', hat: 'cap', brows: true, mouth: true },
    tail: { kind: 'none' }, ext: 'pompoms',
  },
  taunt: 'runs a two-count cheer',
  voice: { pick: 'Spirit' },
  moves: {
    ...archetype('brawler'),
    usmash: mv({ name: 'BASKET TOSS', clip: 'usmash', frames: 44, iasa: 40, charge: { maxFrames: 50, dmgMult: 1.4, kbMult: 1.12 },
      hits: [
        hit({ start: 10, end: 13, x: 0.15, y: 1.6, r: 0.6, dmg: 6, angle: 90, setKb: 30, kbBase: 8, kbGrowth: 18, sfx: 'thwack' }),
        hit({ start: 14, end: 18, x: 0.15, y: 2.4, r: 0.8, dmg: 14, angle: 90, kbBase: 30, kbGrowth: 104, group: 1, hitlag: 1.3, sfx: 'heavy', fx: 'star' }),
      ] }),
    nspecial: mv({ name: 'MEGAPHONE BLAST', clip: 'nspecial', frames: 46, iasa: 42, hits: [
      hit({ start: 12, end: 16, x: 1.2, y: 1.1, r: 0.62, dmg: 5, angle: 361, setKb: 24, kbBase: 6, kbGrowth: 14, sfx: 'zap', fx: 'ring' }),
      hit({ start: 17, end: 24, x: 2.1, y: 1.15, r: 0.9, dmg: 9, angle: 42, kbBase: 32, kbGrowth: 70, group: 1, sfx: 'zap', fx: 'ring' }),
    ] }),
    sspecial: mv({ name: 'CARTWHEEL', clip: 'sspecial', frames: 44, iasa: 40, driftMul: 0.7,
      momentum: [{ frame: 6, vx: 14, kill: true }, { frame: 24, vx: -6 }],
      hits: [
        hit({ start: 8, end: 12, x: 0.6, y: 1.5, r: 0.6, dmg: 5, angle: 90, setKb: 24, kbBase: 6, kbGrowth: 12, sfx: 'thwack' }),
        hit({ start: 13, end: 20, x: 0.9, y: 0.9, r: 0.62, dmg: 8, angle: 44, kbBase: 30, kbGrowth: 82, group: 1, sfx: 'thwack', fx: 'spark' }),
      ] }),
    uspecial: mv({ name: 'PYRAMID LIFT', clip: 'uspecial', frames: 50, helpless: true, hangs: true, gravityMul: 0.7,
      momentum: [{ frame: 6, vy: 18, kill: true }, { frame: 20, vy: 3 }],
      hits: [hit({ start: 6, end: 18, x: 0.15, y: 1.7, r: 0.7, dmg: 10, angle: 86, kbBase: 26, kbGrowth: 86, sfx: 'thwack', fx: 'spark' })] }),
    dspecial: mv({ name: 'SPIRIT SPIN', clip: 'dspecial', frames: 56, iasa: 52, hits: [
      hit({ start: 10, end: 13, x: 0.9, y: 0.9, r: 0.6, dmg: 3, angle: 361, setKb: 20, kbBase: 4, kbGrowth: 8, sfx: 'thwack' }),
      hit({ start: 14, end: 17, x: -0.9, y: 0.9, r: 0.6, dmg: 3, angle: 361, setKb: 20, kbBase: 4, kbGrowth: 8, group: 1, sfx: 'thwack' }),
      hit({ start: 18, end: 21, x: 0.9, y: 0.9, r: 0.6, dmg: 3, angle: 361, setKb: 20, kbBase: 4, kbGrowth: 8, group: 2, sfx: 'thwack' }),
      hit({ start: 22, end: 28, x: 0, y: 1.0, r: 1.1, dmg: 8, angle: 60, kbBase: 40, kbGrowth: 88, group: 3, sfx: 'heavy', fx: 'ring' }),
    ] }),
    finisher: mv({ name: 'PEP RALLY', clip: 'finisher', frames: 88, finisher: true, voice: 'Pep rally',
      invuln: [1, 30],
      hits: Array.from({ length: 7 }, (_, i) => hit({
        start: 14 + i * 7, end: 18 + i * 7, x: (i % 2 ? 1 : -1) * 1.2, y: 1.0, r: 1.3, dmg: 4,
        angle: 361, setKb: 26, kbBase: 6, kbGrowth: 12, group: i, sfx: 'thwack', fx: 'spark',
      })).concat([hit({ start: 66, end: 74, x: 0, y: 1.2, r: 2.0, dmg: 22, angle: 88, kbBase: 60, kbGrowth: 110, hitlag: 1.7, sfx: 'heavy', fx: 'star', group: 20 })]) }),
  },
};

// ============================================================ 11. COACH (unlock)
const COACH = {
  id: 'coach', name: 'COACH', title: 'FRIDAY NIGHT LEGEND',
  bio: 'On loan from VARSITY 27. Coaches the whole match at volume and throws a mean out route.',
  colors: { main: '#14306e', trim: '#f2b705', skin: '#d8ab7a', skin2: '#0f2454', eye: '#141414', glove: '#2a2f38', shoe: '#f4f4f2' },
  alts: ['#7a1020', '#1e7a3c', '#3a3f4a', '#c86a1a'],
  stats: { weight: 106, walk: 4.1, run: 7.4, air: 5.2, airAccel: 28, gravity: 35, jump: 14.6, hop: 9.9, djump: 13.4, jumps: 2, fall: 14.6, fastFall: 22, traction: 60, size: 1.06 },
  tier: { power: 4, speed: 3, range: 4, recovery: 3, weight: 4 },
  unlock: { how: 'Win the GAUNTLET on any difficulty', key: 'gauntlet' },
  build: {
    scale: 1.05, leg: 0.31, legR: 0.088, arm: 0.3, armR: 0.078, paw: 'glove', foot: 'shoe',
    torso: { kind: 'box', w: 0.37, h: 0.44, jersey: true, belt: true },
    head: { kind: 'round', size: 0.19, hat: 'cap', eyes: 'dot', brows: true, mouth: true },
    tail: { kind: 'none' },
  },
  taunt: 'blows the whistle and points at the sideline',
  voice: { pick: 'Coach' },
  moves: {
    ...archetype('brawler'),
    nspecial: mv({ name: 'OUT ROUTE', clip: 'nspecial', frames: 40, iasa: 36, spawn: [{ frame: 14, proj: {
      kind: 'ball', r: 0.24, speed: 15, vy: 4, gravity: 14, life: 90, dmg: 10, angle: 40, kbBase: 24, kbGrowth: 62,
      color: '#8a5a2c', spin: 24, bounces: 1, sfx: 'thwack', fx: 'spark',
    } }] }),
    sspecial: mv({ name: 'SHOULDER CHARGE', clip: 'sspecial', frames: 50, iasa: 46, armor: { from: 8, to: 26, threshold: 10 },
      momentum: [{ frame: 8, vx: 13, kill: true }, { frame: 26, vx: -5 }],
      hits: [hit({ start: 10, end: 24, x: 1.0, y: 1.0, r: 0.7, dmg: 14, angle: 40, kbBase: 38, kbGrowth: 84, hitlag: 1.3, sfx: 'heavy', fx: 'star' })] }),
    uspecial: mv({ name: 'GOALPOST VAULT', clip: 'uspecial', frames: 48, helpless: true, hangs: true,
      momentum: [{ frame: 7, vy: 17, vx: 2, kill: true }],
      hits: [hit({ start: 7, end: 16, x: 0.25, y: 1.95, r: 0.74, dmg: 12, angle: 86, kbBase: 30, kbGrowth: 92, sfx: 'heavy' })] }),
    dspecial: mv({ name: 'CLIPBOARD SLAM', clip: 'dspecial', frames: 46, iasa: 42,
      hits: [hit({ start: 12, end: 16, x: 0.85, y: 0.4, r: 0.7, dmg: 15, angle: 272, kbBase: 26, kbGrowth: 56, hitlag: 1.35, sfx: 'bonk', fx: 'ring' })] }),
    finisher: mv({ name: 'HAIL MARY', clip: 'finisher', frames: 92, finisher: true, voice: 'Hail Mary',
      invuln: [1, 24],
      spawn: Array.from({ length: 5 }, (_, i) => ({ frame: 20 + i * 9, proj: {
        kind: 'ball', r: 0.3, speed: 18, vy: 7 - i, gravity: 12, life: 100, dmg: 9, angle: 45,
        kbBase: 32, kbGrowth: 78, color: '#8a5a2c', spin: 26, sfx: 'thwack', fx: 'spark',
      } })),
      hits: [hit({ start: 70, end: 78, x: 1.0, y: 1.0, r: 1.1, dmg: 24, angle: 40, kbBase: 62, kbGrowth: 108, hitlag: 1.7, sfx: 'heavy', fx: 'star' })] }),
  },
};

// ============================================================ 12. PIXEL (unlock)
const PIXEL = {
  id: 'pixel', name: 'PIXEL', title: 'CORRUPTED SAVE FILE',
  bio: 'Something in the kiosk memory card woke up. Fights in 4 frames of animation and refuses to load properly.',
  colors: { main: '#2ad6a0', trim: '#f24aa0', skin: '#f2f2f2', skin2: '#1aa87a', eye: '#101018', glow: '#f24aa0', metal: '#e0e0e8' },
  alts: ['#f2d23a', '#4a8af2', '#f2f2f2', '#8a2ad6'],
  stats: { weight: 92, walk: 4.7, run: 8.8, air: 6.1, airAccel: 36, gravity: 33, jump: 15.4, hop: 10.4, djump: 14.6, jumps: 2, fall: 14.0, fastFall: 23, traction: 56, size: 1.0 },
  tier: { power: 4, speed: 5, range: 4, recovery: 4, weight: 3 },
  unlock: { how: 'Play 12 matches', key: 'matches12' },
  build: {
    scale: 1.0, leg: 0.3, legR: 0.088, arm: 0.29, armR: 0.078, armKind: 'box', legKind: 'box', paw: 'metal', foot: 'boot',
    torso: { kind: 'box', w: 0.35, h: 0.42, chestMark: true, shell: true },
    head: { kind: 'box', size: 0.2, eyes: 'dot', visor: true, antenna: true, face: false, mouth: false },
    tail: { kind: 'none' }, ext: 'fins',
  },
  taunt: 'flickers between three sprites',
  voice: { pick: 'Pixel' },
  moves: {
    ...archetype('speedster'),
    nspecial: mv({ name: 'BYTE SHOT', clip: 'nspecial', frames: 30, iasa: 26, spawn: [{ frame: 9, proj: {
      kind: 'wave', r: 0.26, speed: 19, gravity: 0, life: 40, dmg: 6, angle: 361, kbBase: 16, kbGrowth: 44,
      color: '#f24aa0', spin: 8, sfx: 'zap', fx: 'zap',
    } }] }),
    sspecial: mv({ name: 'WARP DASH', clip: 'sspecial', frames: 38, iasa: 34, invuln: [4, 14],
      momentum: [{ frame: 5, vx: 26, kill: true }, { frame: 14, vx: -18 }],
      hits: [hit({ start: 15, end: 20, x: 0.9, y: 1.0, r: 0.68, dmg: 12, angle: 40, kbBase: 30, kbGrowth: 88, sfx: 'zap', fx: 'zap' })] }),
    uspecial: mv({ name: 'LEVEL UP', clip: 'uspecial', frames: 46, helpless: true, hangs: true,
      momentum: [{ frame: 5, vy: 18.5, kill: true }],
      hits: [
        hit({ start: 5, end: 10, x: 0.1, y: 1.5, r: 0.7, dmg: 4, angle: 90, setKb: 26, kbBase: 6, kbGrowth: 12, sfx: 'zap' }),
        hit({ start: 11, end: 18, x: 0.1, y: 2.0, r: 0.72, dmg: 9, angle: 84, kbBase: 28, kbGrowth: 92, group: 1, sfx: 'zap', fx: 'zap' }),
      ] }),
    dspecial: mv({ name: 'GLITCH FIELD', clip: 'dspecial', frames: 46, iasa: 42, reflect: { window: [5, 28], mult: 1.6 },
      hits: [hit({ start: 5, end: 8, x: 0, y: 1.0, r: 1.0, dmg: 7, angle: 70, kbBase: 34, kbGrowth: 54, sfx: 'zap', fx: 'zap' })] }),
    finisher: mv({ name: 'HARD RESET', clip: 'finisher', frames: 90, finisher: true, voice: 'Hard reset',
      invuln: [1, 34],
      spawn: Array.from({ length: 8 }, (_, i) => ({ frame: 14 + i * 7, proj: {
        kind: 'wave', r: 0.34, speed: 22, gravity: 0, life: 44, dmg: 5, angle: 361, kbBase: 18, kbGrowth: 40,
        color: i % 2 ? '#f24aa0' : '#2ad6a0', spin: 10, pierce: true, sfx: 'zap', fx: 'zap',
      } })),
      hits: [hit({ start: 74, end: 82, x: 0.8, y: 1.0, r: 1.3, dmg: 26, angle: 45, kbBase: 60, kbGrowth: 112, hitlag: 1.8, sfx: 'zap', fx: 'star' })] }),
  },
};

export const ROSTER = [BLITZ, TUSK, CHIP, VOLT, CRUNCH, RIBBIT, PLANCHA, ZORB, CLANK, SPIRIT, COACH, PIXEL];

export const BASE_ROSTER = ROSTER.filter((c) => !c.unlock);
export const UNLOCKABLE = ROSTER.filter((c) => c.unlock);

export function charById(id) { return ROSTER.find((c) => c.id === id) || ROSTER[0]; }

/** Is this fighter available with the given save-file unlock keys? */
export function isUnlocked(def, unlocks = {}) {
  return !def.unlock || !!unlocks[def.unlock.key];
}

export function randomChar(unlocks = {}) {
  const pool = ROSTER.filter((c) => isUnlocked(c, unlocks));
  return pool[(Math.random() * pool.length) | 0];
}
