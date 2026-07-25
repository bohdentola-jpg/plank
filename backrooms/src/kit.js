// THE LEVEL KIT — the only thing a level module is allowed to know about.
//
// A level is *data*: a cell grid, per-cell materials and heights, a list of
// lights, props, entities, scares, items, notes and exits. No three.js, no DOM,
// no engine internals. world.js turns that data into geometry and baked light;
// entities.js reads the same grid for pathing and sight. Because a level is
// data, `node tools/smoke-backrooms.mjs` can build all twenty-odd of them in a
// second and prove you can actually walk from the spawn to the exit.
//
// Author a level like this:
//
//   export const meta = { id:'level0', num:'0', name:'THE LOBBY', ... };
//   export function build(kit) {
//     const L = kit.level({ w: 120, h: 120, cell: 3.2, wallH: 3.0 });
//     L.fill(kit.C.WALL);
//     kit.gen.maze(L, { x0: 1, z0: 1, x1: 118, z1: 118, braid: 0.35 });
//     L.spawnAt(4, 4, 0);
//     L.light({ x: 8, z: 8, fixture: 'tube', color: 0xfff0c0, radius: 11 });
//     L.exit({ x: 110, z: 110, kind: 'seam', to: 'level1' });
//     L.objective('Find the seam in the wallpaper.');
//     return L.finish();
//   }
//
// Everything below is the whole vocabulary. Names are validated at build time:
// a typo in a material or an entity type is a loud error, never a silent
// missing wall.

import { randoms, Noise2, clamp } from './util.js';

// ------------------------------------------------------------------ cells
export const C = {
  VOID: 0,    // off-level solid. Never floored, never lit, never entered.
  OPEN: 1,    // plain walkable floor
  WALL: 2,    // full-height solid wall
  WATER: 3,   // walkable water — knee-to-waist, slows you, splashes
  DEEP: 4,    // swimmable water — you tread, and things swim under you
  DOOR: 5,    // walkable doorway: gets a frame, no wall quad
  GLASS: 6,   // solid but see-through (windows, vitrines)
  GRATE: 7,   // walkable metal grate, rings underfoot, black below
  PIT: 8,     // a hole. Walkable in the pathing sense; you will fall in.
  HALF: 9,    // waist-high solid: cubicle rows, counters, pool walls. Blocks
              // movement, does not block sight or light.
};

export const WALKABLE = new Set([C.OPEN, C.WATER, C.DEEP, C.DOOR, C.GRATE, C.PIT]);
export const SOLID = new Set([C.VOID, C.WALL, C.GLASS, C.HALF]);
export const OPAQUE = new Set([C.VOID, C.WALL]);          // stops light and sight
export const WET = new Set([C.WATER, C.DEEP]);

// ------------------------------------------------------------------ materials
// Surface recipes implemented in textures.js. Anything a level names must live
// in this table, and every name here must have a recipe — smoke checks both.
export const MATS = [
  // the original rooms
  'wallpaper', 'wallpaperDamp', 'wallpaperTorn', 'carpet', 'carpetDamp', 'ceilTile', 'ceilPanel',
  // concrete guts of the place
  'concrete', 'concreteWet', 'concretePaint', 'cinder', 'asphalt', 'sidewalk', 'metalPlate',
  'grate', 'pipeWall', 'rust', 'ductWall', 'breakerWall', 'brick', 'plywood',
  // offices, schools, hospitals
  'carpetOffice', 'cubicleFabric', 'drywall', 'linoleum', 'lockerWall', 'chalkboard',
  'tileHospital', 'tileHospitalFloor', 'shelfWall', 'woodPanel', 'acousticWall',
  // the poolrooms
  'tileWhite', 'tileBlue', 'tilePool', 'tileMosaic', 'poolTrim', 'wetTileFloor', 'marble',
  // hotels, party rooms, houses
  'wallpaperHotel', 'carpetHotel', 'woodFloor', 'wallpaperParty', 'curtain', 'stucco', 'siding',
  // the outdoors that isn't
  'grassDry', 'wheat', 'dirt', 'gravel', 'rock', 'moss', 'sand', 'snow', 'ice', 'mud',
  // odds and ends
  'glass', 'glassPool', 'mirror', 'void', 'blackout', 'fleshWall', 'paper', 'foam',
];
const MATSET = new Set(MATS);

// ------------------------------------------------------------------ props
// Procedural meshes in props.js. `blocks: true` props also drop a collider.
export const PROPS = [
  // light fixtures (a light with `fixture` already makes its own — these are dressing)
  'tube', 'tubeBroken', 'panelLight', 'bulb', 'cageLight', 'lamp', 'floodlight',
  'exitSign', 'emergencyLight', 'chandelier', 'lantern', 'streetlight', 'poolLight',
  // structure
  'pillar', 'pillarSquare', 'beam', 'ductRun', 'pipeRun', 'pipeCluster', 'vent', 'ventFloor',
  'doorFrame', 'door', 'doubleDoor', 'elevatorDoors', 'liftEntrance', 'window', 'archway', 'railing',
  // the lift car: the stall, what is on it, the price cards, the buttons, the notice
  'shopStall', 'shopGood', 'shopTag', 'liftPanel', 'notice',
  'chainFence', 'ladder', 'stairFlight', 'rubblePile', 'columnBroken', 'trapdoor',
  // rooms people used to work in
  'desk', 'officeChair', 'cubicle', 'filingCabinet', 'shelf', 'bookshelf', 'archiveShelf',
  'serverRack', 'breakerBox', 'transformer', 'valveWheel', 'payphone', 'crtMonitor',
  'vendingMachine', 'lockers', 'clock', 'corkboard', 'watercooler', 'trashcan', 'mopBucket',
  'wetFloorSign', 'crate', 'crateStack', 'pallet', 'barrel', 'drum', 'boxStack', 'trolley',
  // rooms people used to live in
  'sofa', 'armchair', 'bed', 'mattress', 'table', 'chair', 'diningTable', 'sideTable',
  'tv', 'radio', 'plant', 'pottedPalm', 'rug', 'picture', 'mirrorPanel', 'sink', 'toilet',
  'bathStall', 'gurney', 'ivStand', 'wheelchair', 'partyTable', 'balloonCluster', 'banner',
  'cake', 'streamers', 'partyHatPile',
  // water
  'poolLadder', 'divingBoard', 'lounger', 'lifebuoy', 'poolNoodle', 'drainGrate', 'fountain',
  // outside-ish
  'car', 'carWreck', 'dumpster', 'trafficCone', 'shoppingCart', 'houseFacade', 'fencePanel',
  'deadTree', 'wheatPatch', 'boulder', 'stalagmite', 'snowDrift', 'radioTower', 'trainCar',
  'busShelter', 'phoneBooth', 'campLight', 'tent', 'sleepingBag', 'signpost',
  // things that are not furniture
  'fleshGrowth', 'bacteriaMat', 'cocoon', 'bodyBag', 'mannequinProp', 'shrine', 'tapePile',
  'almondCrate', 'graffiti', 'bloodTrail', 'clawMarks', 'noteSheet', 'chalkArrow', 'skull',
];
const PROPSET = new Set(PROPS);

// ------------------------------------------------------------------ entities
// Behaviour parameters live in bestiary.js; a level just places them.
export const ENTITIES = [
  'hound',        // blind, hunts sound, sprints in packs
  'smiler',       // a grin in the dark; frozen by light, lethal without it
  'faceling',     // wanders the halls; punishes staring
  'skinstealer',  // wears a survivor's face, follows, then doesn't pretend
  'clump',        // slow mass of limbs; corridor-filling, contact damage
  'deathmoth',    // flies toward light, swarms, drains warmth
  'partygoer',    // laughing sprinter, comes when it hears you enjoying yourself
  'bacteria',     // stationary growth; spreads, burns to the touch
  'windows',      // lives in glass. Appears, watches, is gone.
  'wretch',       // swimmer; pulls you under in deep water
  'howler',       // fragile screamer that calls everything else
  'crawler',      // ceiling and vent dweller that drops on you
  'mannequin',    // moves only while unobserved
  'nurse',        // slow, lantern-lit, absolutely relentless
  'leviathan',    // deep-water shape. Do not be in deep water.
  'watcher',      // stands at the far end. Never closer, never gone.
  'duller',       // shambling crowd filler, weak alone
  'shepherd',     // not hostile. It hums, and it points the way out.
];
const ENTSET = new Set(ENTITIES);

// ------------------------------------------------------------------ scares
// Scripted one-shots compiled by fx.js. Placed with a radius; most are `once`.
export const SCARES = [
  'faceInHall',      // something at the far end of the corridor, gone on the next frame
  'shadowCross',     // a silhouette crosses a doorway ahead
  'lightBurst',      // the tube above you dies in a shower of sparks
  'lightsOut',       // the whole wing drops to black for a few seconds
  'doorSlam',        // a door you already passed closes
  'handFromCeiling', // it comes down through the tile behind your head
  'crawlerDrop',     // ceiling gives, something lands, it leaves
  'facePressWindow', // pressed flat against the glass beside you
  'mirrorFigure',    // your reflection is late, and taller
  'thingBehindYou',  // the camera whips around on its own
  'breathing',       // very close, not yours
  'whisper',         // your name, badly pronounced
  'screamDistant',   // someone else is having a worse night
  'footstepsFollow', // steps in time with yours, one beat behind
  'bodyFall',        // something heavy lands in the next room
  'phoneRing',       // a phone rings until you look at it
  'crowdLaugh',      // a party, three walls away
  'floorGiveWay',    // the floor drops an inch and holds
  'tapeGlitch',      // the tape eats a second of your life
  'staticBurst',     // the camera loses the picture and finds it again
  'waterStir',       // something big moves in the water you are standing in
  'nameOnWall',      // the graffiti is about you now
];
const SCARESET = new Set(SCARES);

// ------------------------------------------------------------------ items
export const ITEMS = [
  'battery',      // camcorder + flashlight juice
  'almondWater',  // health, sanity, and a small moment of peace
  'tape',         // collectible: someone else's last recording
  'key',          // opens a locked exit (pair with exit `needs`)
  'keycard',
  'glowstick',    // thrown light that lasts
  'flare',        // bright, hot, keeps most things away
  'medkit',
  'crowbar',      // opens boarded doors
  'fuse',         // for the levels that lost their power
];
const ITEMSET = new Set(ITEMS);

// ------------------------------------------------------------------ hiding
// Every floor has somewhere to get out of sight, and it is different every time:
// you learn a level by learning what counts as cover in it.
export const HIDES = [
  'locker',    // stand in it, look through the vents
  'cubicle',   // under the desk, knees up
  'gurney',    // under the sheet, on the trolley
  'shelf',     // between two stacks, sideways
  'crate',     // behind the pallet stack
  'stall',     // feet up on the pan, door latched
  'car',       // back seat, head down
  'water',     // under the surface, holding it
  'drift',     // dug into the snow
  'wheat',     // flat in the crop
  'vent',      // floor duct, lid pulled over
  'tent',      // somebody else's, still zipped
  'curtain',   // behind the drape, breathing shallow
  'crawl',     // under the pipe run, on your side
];
const HIDESET = new Set(HIDES);

// ------------------------------------------------------------------ gimmicks
// The one thing that makes a floor itself, mechanically. main.js implements them.
export const GIMMICKS = [
  'flicker',    // the grid stutters and drops whole wings for a few seconds
  'blackout',   // periodic total darkness, on a rhythm you can learn
  'darkwater',  // the water is opaque and something is under it
  'steam',      // vents blind you at intervals; the monster likes the noise
  'sparks',     // arcs kill the nearest lights whenever the monster closes
  'ceiling',    // it travels above the tiles and comes down
  'noisefloor', // metal and grating: every footstep carries
  'silence',    // no ambience at all — you only ever hear your own noise and its
  'crowd',      // standing bodies you have to push past, and it hides among them
  'fogbank',    // fog thick enough to hide the walls, thinner near the lift
  'mirrors',    // it shows up in glass a beat before it shows up in the room
  'cold',       // you freeze away from heat; the lift lobby is warm
];
const GIMSET = new Set(GIMMICKS);

// The shortest walk, in cells, that counts as a floor: below this the lift is a
// formality rather than an objective. Capped at one crossing of the floor's own
// area so a genuinely small level isn't measured against a big one.
const MIN_TREK = 45;
export const minTrek = (walkable) => Math.min(MIN_TREK, Math.round(Math.sqrt(walkable)));

// ------------------------------------------------------------------ sound beds
export const ROOM_TONES = [
  'buzz',        // the hum of ten thousand fluorescent tubes
  'drone',       // deep building tone
  'silence',     // near-anechoic, and worse for it
  'machinery',   // distant plant, thumping
  'water',       // pool echo and lapping
  'drips',
  'wind',
  'cave',
  'crowd',       // a party you are not at
  'static',
  'hospital',    // ventilators, a heart monitor with nobody on it
  'rain',
  'trainYard',
  'schoolBell',
];
export const MUSIC_BEDS = ['none', 'dread', 'drone', 'calm', 'muzak', 'choir', 'chase', 'lullaby', 'wrong'];
const TONESET = new Set(ROOM_TONES), MUSICSET = new Set(MUSIC_BEDS);

export const EXIT_KINDS = [
  'seam', 'hole', 'door', 'stairs', 'elevator', 'ladder', 'pipe', 'drain',
  'gate', 'trapdoor', 'manhole', 'portal', 'train', 'window', 'dive', 'crack',
];
const EXITSET = new Set(EXIT_KINDS);

const MAX_STEP = 0.7;   // how much floor height a body can climb in one cell

// Can a body get from cell a to cell b? This has to agree with what the player can
// actually do, because it is what the chalk arrows and the lift bearing are drawn
// from: a route the flood fill likes and a body cannot take is worse than no route.
//
//   · out of water: always — you haul yourself over the lip, which is why the
//     poolrooms connect at all
//   · up: a curb, no more. A 1-metre pool lip from dry land is a wall.
//   · into water: from any height. You land in it.
//   · down: a drop you can take without hurting yourself.
export function climbable(codeA, codeB, yA, yB) {
  if (WET.has(codeA)) return true;
  const rise = yB - yA;
  if (rise > MAX_STEP) return false;
  if (rise >= -MAX_STEP) return true;
  if (WET.has(codeB)) return true;
  return rise > -3.0;
}

// ------------------------------------------------------------------ the level
class Level {
  constructor(kit, opts = {}) {
    const w = Math.max(8, Math.min(320, opts.w ?? 96));
    const h = Math.max(8, Math.min(320, opts.h ?? 96));
    this.kit = kit;
    this.w = w; this.h = h;
    this.cell = opts.cell ?? 3.2;          // metres per cell
    this.wallH = opts.wallH ?? 3.0;        // default ceiling height
    this.cells = new Uint8Array(w * h);    // starts as VOID
    this.floorYs = new Float32Array(w * h);
    this.ceilYs = new Float32Array(w * h).fill(this.wallH);
    this.matF = new Array(w * h).fill(opts.palette?.floor ?? 'carpet');
    this.matW = new Array(w * h).fill(opts.palette?.wall ?? 'wallpaper');
    this.matC = new Array(w * h).fill(opts.palette?.ceil ?? 'ceilTile');
    this.lights = [];
    this.props = [];
    this.colliders = [];
    this.entities = [];
    this.scares = [];
    this.items = [];
    this.notes = [];
    this.triggers = [];
    this.links = [];
    this.exits = [];
    this.objectives = [];
    this.hides = [];
    this.monsterRec = null;
    this.gimmickName = null;
    this._spawn = null;
    this.openSky = opts.openSky ?? false;   // no ceiling quads; sky dome instead
    this.sky = opts.sky ?? null;            // { top, bottom, sun, stars, clouds }
    this.fog = { color: opts.fog?.color ?? 0x0a0a08, density: opts.fog?.density ?? 0.035 };
    this.ambient = {
      color: opts.ambient?.color ?? 0x30302a,
      intensity: opts.ambient?.intensity ?? 0.18,
      sky: opts.ambient?.sky ?? null,
    };
    this.ambience = { room: 'buzz', hum: 0.5, drip: 0.15, wind: 0, music: 'drone', reverb: 0.35 };
    this.rules = {
      dark: false,           // no baked room light at all — flashlight country
      wetFeet: false,        // footsteps always splash
      cold: false,           // stamina drains, breath fogs
      chase: null,           // { after: seconds, entity, spawnRate } — the level hunts you
      noiseLimit: 0,         // above this noise level, something wakes up
      batteryDrain: 1,       // multiplier on camcorder drain
      sanityDrain: 1,
      fallDamage: true,
      swimSpeed: 1,
    };
    this.tint = null;        // camcorder colour cast: { r, g, b }
    this.warnings = [];
  }

  // -------------------------------------------------------------- indexing
  idx(x, z) { return (z | 0) * this.w + (x | 0); }
  inside(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h; }
  get(x, z) { return this.inside(x, z) ? this.cells[this.idx(x, z)] : C.VOID; }
  set(x, z, code) {
    if (!this.inside(x, z)) return this;
    this.cells[this.idx(x, z)] = code;
    return this;
  }
  isOpen(x, z) { return WALKABLE.has(this.get(x, z)); }

  // -------------------------------------------------------------- painting
  fill(code) { this.cells.fill(code); return this; }

  rect(x0, z0, x1, z1, code) {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) this.set(x, z, code);
    return this;
  }

  frame(x0, z0, x1, z1, code) {
    for (let x = x0; x <= x1; x++) { this.set(x, z0, code); this.set(x, z1, code); }
    for (let z = z0; z <= z1; z++) { this.set(x0, z, code); this.set(x1, z, code); }
    return this;
  }

  disc(cx, cz, r, code) {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (Math.hypot(x - cx, z - cz) <= r) this.set(x, z, code);
      }
    }
    return this;
  }

  // A room: floor inside, wall ring around it (only where nothing is carved yet).
  room(x0, z0, x1, z1, opts = {}) {
    const code = opts.code ?? C.OPEN;
    this.rect(x0, z0, x1, z1, code);
    if (opts.walls !== false) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        for (const z of [z0 - 1, z1 + 1]) if (this.get(x, z) === C.VOID) this.set(x, z, C.WALL);
      }
      for (let z = z0 - 1; z <= z1 + 1; z++) {
        for (const x of [x0 - 1, x1 + 1]) if (this.get(x, z) === C.VOID) this.set(x, z, C.WALL);
      }
    }
    if (opts.floor || opts.wall || opts.ceil) this.paintRect(x0, z0, x1, z1, opts);
    if (opts.h !== undefined) this.ceilRect(x0, z0, x1, z1, opts.h);
    return this;
  }

  // An L-shaped corridor of width `w` from a to b.
  corridor(x0, z0, x1, z1, w = 1, code = C.OPEN) {
    const half = Math.floor((w - 1) / 2), extra = (w - 1) - half;
    const runX = (z, xa, xb) => this.rect(Math.min(xa, xb), z - half, Math.max(xa, xb), z + extra, code);
    const runZ = (x, za, zb) => this.rect(x - half, Math.min(za, zb), x + extra, Math.max(za, zb), code);
    if (this.kit.chance(0.5)) { runX(z0, x0, x1); runZ(x1, z0, z1); }
    else { runZ(x0, z0, z1); runX(z1, x0, x1); }
    return this;
  }

  paint(x, z, m) {
    if (!this.inside(x, z)) return this;
    const i = this.idx(x, z);
    if (m.floor) this.matF[i] = m.floor;
    if (m.wall) this.matW[i] = m.wall;
    if (m.ceil) this.matC[i] = m.ceil;
    return this;
  }

  paintRect(x0, z0, x1, z1, m) {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.paint(x, z, m);
    }
    return this;
  }

  paintAll(m) { return this.paintRect(0, 0, this.w - 1, this.h - 1, m); }

  // Repaint every cell that matches a predicate — handy for "all water floors".
  paintWhere(test, m) {
    for (let z = 0; z < this.h; z++) {
      for (let x = 0; x < this.w; x++) if (test(this.get(x, z), x, z)) this.paint(x, z, m);
    }
    return this;
  }

  // -------------------------------------------------------------- heights
  floorAt(x, z, v) {
    if (v === undefined) return this.inside(x, z) ? this.floorYs[this.idx(x, z)] : 0;
    this.floorYs[this.idx(x, z)] = v;
    return this;
  }

  floorRect(x0, z0, x1, z1, v) {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        if (this.inside(x, z)) this.floorYs[this.idx(x, z)] = v;
      }
    }
    return this;
  }

  ceilAt(x, z, v) {
    if (v === undefined) return this.inside(x, z) ? this.ceilYs[this.idx(x, z)] : this.wallH;
    this.ceilYs[this.idx(x, z)] = v;
    return this;
  }

  ceilRect(x0, z0, x1, z1, v) {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        if (this.inside(x, z)) this.ceilYs[this.idx(x, z)] = v;
      }
    }
    return this;
  }

  // A walkable slope. Steps stay inside MAX_STEP so a body can climb them.
  ramp(x0, z0, x1, z1, yFrom, yTo, opts = {}) {
    const horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const n = Math.max(1, horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0));
    const per = Math.abs(yTo - yFrom) / n;
    if (per > MAX_STEP) {
      this.warnings.push(`ramp at ${x0},${z0} climbs ${per.toFixed(2)}m per cell (max ${MAX_STEP})`);
    }
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = yFrom + (yTo - yFrom) * t;
      const x = horiz ? Math.round(x0 + (x1 - x0) * t) : x0;
      const z = horiz ? z0 : Math.round(z0 + (z1 - z0) * t);
      const wide = opts.width ?? 1;
      for (let k = 0; k < wide; k++) {
        const px = horiz ? x : x + k, pz = horiz ? z + k : z;
        if (this.get(px, pz) === C.VOID || this.get(px, pz) === C.WALL) this.set(px, pz, C.OPEN);
        this.floorAt(px, pz, y);
        if (opts.keepHead !== false) this.ceilAt(px, pz, y + (opts.head ?? this.wallH));
      }
    }
    return this;
  }

  // A pool/basin: water cells with the floor dropped and the surface at `level`.
  water(x0, z0, x1, z1, opts = {}) {
    const depth = opts.depth ?? 1.0;
    const level = opts.level ?? 0;
    const code = depth > 1.5 ? C.DEEP : C.WATER;
    this.rect(x0, z0, x1, z1, opts.code ?? code);
    this.floorRect(x0, z0, x1, z1, level - depth);
    if (opts.floor || opts.wall) this.paintRect(x0, z0, x1, z1, { floor: opts.floor ?? 'tilePool', wall: opts.wall ?? 'tileBlue' });
    this.waterLevel = level;
    return this;
  }

  // -------------------------------------------------------------- fixtures
  light(o) {
    const l = {
      x: o.x, z: o.z, y: o.y ?? null,           // null → hang from the ceiling
      color: o.color ?? 0xfff0c8,
      intensity: o.intensity ?? 1,
      radius: o.radius ?? 10,
      flicker: o.flicker ?? 0,                  // 0 steady … 1 dying
      fixture: o.fixture ?? 'tube',             // 'tube'|'panel'|'bulb'|'cage'|'lamp'|'flood'|'sun'|'none'
      rot: o.rot ?? 0,
      on: o.on !== false,
      dead: !!o.dead,                           // fixture exists, light does not
      bake: o.bake !== false,                   // contributes to baked vertex light
      dynamic: !!o.dynamic,                     // always gets a real light when near
      hum: o.hum ?? 1,
    };
    this.lights.push(l);
    return l;
  }

  // A regular ceiling grid of tubes, the way the original rooms do it.
  lightGrid(x0, z0, x1, z1, opts = {}) {
    const every = opts.every ?? 5;
    const made = [];
    for (let z = z0; z <= z1; z += every) {
      for (let x = x0; x <= x1; x += every) {
        if (!this.isOpen(x, z)) continue;
        const dying = this.kit.chance(opts.deadChance ?? 0.06);
        made.push(this.light({
          x, z,
          color: opts.color ?? 0xfff2c4,
          intensity: opts.intensity ?? 1,
          radius: opts.radius ?? every * 2.4,
          flicker: dying ? this.kit.rand(0.5, 1) : this.kit.chance(opts.flickerChance ?? 0.12) ? this.kit.rand(0.08, 0.3) : 0,
          fixture: opts.fixture ?? 'tube',
          rot: opts.rot ?? 0,
          dead: this.kit.chance(opts.brokenChance ?? 0.04),
        }));
      }
    }
    return made;
  }

  prop(name, o = {}) {
    const p = { name, x: o.x, z: o.z, y: o.y ?? null, rot: o.rot ?? 0, scale: o.scale ?? 1, ...o };
    this.props.push(p);
    // `blocks` is a footprint in METRES (true → 0.9m across), converted to cells here,
    // because a prop's collider should be the size of the prop and nothing else.
    if (o.blocks) {
      const r = (o.blocks === true ? 0.45 : o.blocks) / this.cell;
      this.collider(o.x - r, o.z - r, o.x + r, o.z + r, { y1: o.height ?? 1.2 });
    }
    return p;
  }

  // Scatter a prop across random open cells. Returns what it placed.
  scatter(name, n, opts = {}) {
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 60) {
      const x = this.kit.randInt(1, this.w - 2), z = this.kit.randInt(1, this.h - 2);
      if (!this.isOpen(x, z)) continue;
      if (opts.where && !opts.where(x, z, this.get(x, z))) continue;
      out.push(this.prop(name, {
        x: x + this.kit.rand(-0.3, 0.3),
        z: z + this.kit.rand(-0.3, 0.3),
        rot: this.kit.rand(0, Math.PI * 2),
        ...(opts.opts || {}),
      }));
    }
    return out;
  }

  // Cell-space AABB. y0/y1 are metres off that cell's floor.
  collider(x0, z0, x1, z1, o = {}) {
    this.colliders.push({
      x0: Math.min(x0, x1), z0: Math.min(z0, z1),
      x1: Math.max(x0, x1), z1: Math.max(z0, z1),
      y0: o.y0 ?? 0, y1: o.y1 ?? 2.2,
      blocksSight: !!o.blocksSight,
    });
    return this;
  }

  entity(type, o = {}) {
    const e = {
      type, x: o.x, z: o.z,
      state: o.state ?? 'patrol',            // 'dormant'|'patrol'|'guard'|'hunt'
      leash: o.leash ?? 0,                   // 0 = roams the level
      speed: o.speed ?? null,                // null → bestiary default
      aggro: o.aggro ?? null,
      hp: o.hp ?? null,
      wake: o.wake ?? null,                  // { objective:'…' } or { after: secs }
      route: o.route ?? null,                // [[x,z],…] patrol ring
      tag: o.tag ?? null,
      ...o,
    };
    this._place(`entity ${type}`, e);
    this.entities.push(e);
    return e;
  }

  // Place a pack around a point without piling them on one cell.
  pack(type, n, x, z, spread = 4, o = {}) {
    const out = [];
    for (let i = 0; i < n; i++) {
      let px = x, pz = z, guard = 0;
      do {
        px = Math.round(x + this.kit.rand(-spread, spread));
        pz = Math.round(z + this.kit.rand(-spread, spread));
      } while (!this.isOpen(px, pz) && guard++ < 40);
      out.push(this.entity(type, { ...o, x: px, z: pz }));
    }
    return out;
  }

  // Exactly one hunter per floor. It one-shots you, so everything about it —
  // where it starts, how fast, how it finds you — is a deliberate choice.
  monster(type, o = {}) {
    const m = {
      type, x: o.x, z: o.z,
      speed: o.speed ?? null,
      patience: o.patience ?? 1,       // how long it keeps searching
      hearing: o.hearing ?? 1,         // multiplier on its ears
      sight: o.sight ?? 1,
      tell: o.tell ?? null,            // the sound it makes when it's near
      wanders: o.wanders ?? 26,        // how far it roams while it hasn't found you
      checksHides: o.checksHides ?? 0.45,
      ...o,
    };
    this._place(`monster ${type}`, m, 20);
    this.monsterRec = m;
    // it is also an entity for the runtime, and the only one
    this.entities.push({ ...m, state: 'patrol', leash: 0, isMonster: true });
    return m;
  }

  // A place to get out of sight. Kinds are per-floor: lockers in the school,
  // gurneys in the hospital, the water itself in the poolrooms.
  hide(kind, x, z, o = {}) {
    const h = { kind, x, z, rot: o.rot ?? 0, ...o };
    this._place(`hide ${kind}`, h);
    this.hides.push(h);
    return h;
  }

  // Scatter hiding places across the floor, spread out so no corner is safe and
  // no corner is hopeless.
  hideSpots(kind, n, o = {}) {
    const out = [];
    let guard = 0;
    const minGap = (o.minGap ?? 12);
    while (out.length < n && guard++ < n * 120) {
      const [x, z] = this.randomOpen(o.where);
      if (out.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < minGap)) continue;
      out.push([x, z]);
      this.hide(kind, x, z, { rot: this.kit.rand(0, Math.PI * 2) });
    }
    return out;
  }

  // Put the monster a long way from the spawn — most of the way to the far end of
  // the floor, so the first minute is yours and the rest of it is not.
  monsterFar(type, o = {}) {
    const sp = this._spawn || { x: 2, z: 2 };
    const [fx, fz] = this.farthestOpen(sp.x, sp.z);
    const t = o.at ?? 0.72;
    const [mx, mz] = this.snap(
      Math.round(sp.x + (fx - sp.x) * t),
      Math.round(sp.z + (fz - sp.z) * t),
      20,
    ) || [fx, fz];
    return this.monster(type, { ...o, x: mx, z: mz });
  }

  // The old chain is gone: every floor now ends at a lift, and the lift is where
  // the shop is. `to` is always the next floor of the descent.
  elevatorAt(o = {}) {
    const { to, needs, kind, hidden, ...rest } = o;
    return this.elevator(o.x, o.z, { ...rest, to: 'NEXT' });
  }

  gimmick(name, o = {}) {
    this.gimmickName = name;
    this.gimmickOpts = o;
    return this;
  }

  // The way off the floor. One per level, and the shop rides down with you.
  elevator(x, z, o = {}) {
    return this.exit({
      x, z, kind: 'elevator', to: o.to ?? 'NEXT', label: o.label ?? 'SERVICE LIFT',
      say: o.say ?? 'The doors part. Inside it is lit, and warm, and there is somebody\'s stall set up against the back wall.',
      ...o,
    });
  }

  scare(name, o = {}) {
    const s = {
      name, x: o.x, z: o.z,
      radius: o.radius ?? 6,
      once: o.once !== false,
      delay: o.delay ?? 0,
      facing: o.facing ?? null,     // only fire when the camera looks this way (radians)
      needsDark: !!o.needsDark,
      text: o.text ?? null,
      ...o,
    };
    this.scares.push(s);
    return s;
  }

  item(type, o = {}) {
    const it = { type, x: o.x, z: o.z, amount: o.amount ?? 1, key: o.key ?? null, ...o };
    this._place(`item ${type}`, it);
    this.items.push(it);
    return it;
  }

  // A page of someone else's bad night. The tape's lore lives in these.
  note(o) {
    const n = { x: o.x, z: o.z, title: o.title ?? 'NOTE', text: o.text, found: false, ...o };
    this._place(`note "${n.title}"`, n);
    this.notes.push(n);
    return n;
  }

  // Walk-in event: subtitles, objective completion, sound, entity wake-ups.
  trigger(o) {
    const t = {
      x: o.x, z: o.z, radius: o.radius ?? 4, once: o.once !== false,
      say: o.say ?? null,              // subtitle line
      objective: o.objective ?? null,  // completes / adds an objective
      addObjective: o.addObjective ?? null,
      sound: o.sound ?? null,
      wake: o.wake ?? null,            // entity tag to wake
      lightsOff: o.lightsOff ?? null,  // [radius] kill the lights around here
      ...o,
    };
    this._place('trigger', t);
    this.triggers.push(t);
    return t;
  }

  // Declared traversal that isn't a walk: elevator, drain, crawl, ladder.
  link(x0, z0, x1, z1, o = {}) {
    this.links.push({ x0, z0, x1, z1, kind: o.kind ?? 'ladder', two: o.two !== false, label: o.label ?? null });
    return this;
  }

  exit(o) {
    const e = {
      x: o.x, z: o.z,
      kind: o.kind ?? 'door',
      to: o.to,                       // level id, or 'END'
      label: o.label ?? null,
      needs: o.needs ?? null,         // item type ('key' + key:'red', 'fuse', …)
      key: o.key ?? null,
      hidden: !!o.hidden,             // no marker until you're close
      say: o.say ?? null,
      ...o,
    };
    this._place(`exit ${e.kind}→${e.to}`, e, 14);
    this.exits.push(e);
    return e;
  }

  spawnAt(x, z, yaw = 0) {
    this._spawn = this._place('spawn', { x, z, yaw }, 24);
    return this;
  }

  objective(text, o = {}) {
    this.objectives.push({ id: o.id ?? `obj${this.objectives.length}`, text, done: false, optional: !!o.optional });
    return this;
  }

  setAmbience(o) { Object.assign(this.ambience, o); return this; }
  setRules(o) { Object.assign(this.rules, o); return this; }
  setFog(color, density) { this.fog = { color, density }; return this; }
  setAmbient(color, intensity) { this.ambient = { ...this.ambient, color, intensity }; return this; }
  setTint(r, g, b) { this.tint = { r, g, b }; return this; }

  // -------------------------------------------------------------- queries
  openCells() {
    const out = [];
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) if (this.isOpen(x, z)) out.push([x, z]);
    return out;
  }

  // Nearest walkable cell to a point, by ring search. Generators are random, so
  // hand-placed coordinates land in walls sooner or later — everything that has
  // to be *reachable* (spawn, exits, items, notes, entities) snaps with this,
  // and a long snap is recorded as a warning instead of a silent teleport.
  snap(x, z, maxR = 10) {
    const cx = Math.round(x), cz = Math.round(z);
    if (this.isOpen(cx, cz)) return [cx, cz];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bestD = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx = cx + dx, nz = cz + dz;
          if (!this.isOpen(nx, nz)) continue;
          const d = Math.hypot(dx, dz);
          if (d < bestD) { bestD = d; best = [nx, nz]; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  _place(what, o, maxR = 10) {
    const s = this.snap(o.x, o.z, maxR);
    if (!s) { this.warnings.push(`${what} at ${o.x},${o.z} has no open cell within ${maxR} — left where it was`); return o; }
    const moved = Math.hypot(s[0] - o.x, s[1] - o.z);
    if (moved > 4) this.warnings.push(`${what} moved ${moved.toFixed(1)} cells to reach open floor (${o.x},${o.z} → ${s[0]},${s[1]})`);
    o.x = s[0]; o.z = s[1];
    return o;
  }

  randomOpen(where = null) {
    for (let i = 0; i < 4000; i++) {
      const x = this.kit.randInt(1, this.w - 2), z = this.kit.randInt(1, this.h - 2);
      if (this.isOpen(x, z) && (!where || where(x, z, this.get(x, z)))) return [x, z];
    }
    const all = this.openCells();
    return all.length ? all[Math.floor(all.length / 2)] : [1, 1];
  }

  // Breadth-first flood honouring step height. Returns Int32Array of distances
  // (-1 unreachable), which is also exactly what the exit check needs.
  flood(sx, sz) {
    const dist = new Int32Array(this.w * this.h).fill(-1);
    if (!this.isOpen(sx, sz)) return dist;
    const q = new Int32Array(this.w * this.h);
    let head = 0, tail = 0;
    q[tail++] = this.idx(sx, sz);
    dist[this.idx(sx, sz)] = 0;
    while (head < tail) {
      const i = q[head++];
      const x = i % this.w, z = (i / this.w) | 0;
      const fy = this.floorYs[i];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (!this.inside(nx, nz)) continue;
        const j = this.idx(nx, nz);
        if (dist[j] !== -1 || !WALKABLE.has(this.cells[j])) continue;
        if (!climbable(this.cells[i], this.cells[j], fy, this.floorYs[j])) continue;
        dist[j] = dist[i] + 1;
        q[tail++] = j;
      }
    }
    // declared links (ladders, drains, elevators) jump the flood across
    for (let pass = 0; pass < 3; pass++) {
      for (const L of this.links) {
        const a = this.idx(L.x0, L.z0), b = this.idx(L.x1, L.z1);
        const grow = (from, to) => {
          if (dist[from] >= 0 && dist[to] === -1 && WALKABLE.has(this.cells[to])) {
            dist[to] = dist[from] + 1;
            // re-flood from the far side
            const q2 = [to];
            while (q2.length) {
              const i = q2.pop();
              const x = i % this.w, z = (i / this.w) | 0;
              for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, nz = z + dz;
                if (!this.inside(nx, nz)) continue;
                const j = this.idx(nx, nz);
                if (dist[j] !== -1 || !WALKABLE.has(this.cells[j])) continue;
                if (!climbable(this.cells[i], this.cells[j], this.floorYs[i], this.floorYs[j])) continue;
                dist[j] = dist[i] + 1;
                q2.push(j);
              }
            }
          }
        };
        grow(a, b);
        if (L.two) grow(b, a);
      }
    }
    return dist;
  }

  farthestOpen(sx, sz) {
    const d = this.flood(sx, sz);
    let best = -1, bx = sx, bz = sz;
    for (let z = 0; z < this.h; z++) {
      for (let x = 0; x < this.w; x++) {
        const v = d[this.idx(x, z)];
        if (v > best) { best = v; bx = x; bz = z; }
      }
    }
    return [bx, bz, best];
  }

  // Seal anything the generators left touching the edge of the world.
  enclose(code = C.WALL) {
    for (let x = 0; x < this.w; x++) { this.set(x, 0, code); this.set(x, this.h - 1, code); }
    for (let z = 0; z < this.h; z++) { this.set(0, z, code); this.set(this.w - 1, z, code); }
    // and turn any open cell that still faces the void into a wall's neighbour
    for (let z = 1; z < this.h - 1; z++) {
      for (let x = 1; x < this.w - 1; x++) {
        if (!this.isOpen(x, z)) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this.get(x + dx, z + dz) === C.VOID) this.set(x + dx, z + dz, C.WALL);
        }
      }
    }
    return this;
  }

  // -------------------------------------------------------------- finish
  finish() {
    const L = this;
    const bad = (msg) => { throw new Error(`[level] ${msg}`); };
    const num = (v, what) => { if (!Number.isFinite(v)) bad(`${what} is not a number (${v})`); };

    L.enclose();

    if (!L._spawn) bad('no spawn — call L.spawnAt(x, z, yaw)');
    num(L._spawn.x, 'spawn.x'); num(L._spawn.z, 'spawn.z');
    if (!L.isOpen(L._spawn.x, L._spawn.z)) bad(`spawn ${L._spawn.x},${L._spawn.z} is inside a wall`);
    if (!L.exits.length) bad('no exits — the whole point is getting out');
    if (!L.objectives.length) bad('no objectives — tell the player what to do');
    if (!L.monsterRec) bad('no monster — one per floor, that is the rule');
    if (L.entities.filter((e) => e.isMonster).length !== 1) bad('more than one monster on the floor');
    if (L.hides.length < 5) bad(`only ${L.hides.length} hiding places — a floor needs at least five`);
    for (const h of L.hides) if (!HIDESET.has(h.kind)) bad(`unknown hiding place "${h.kind}"`);
    if (!L.gimmickName) bad('no gimmick — every floor needs its own trick');
    if (!GIMSET.has(L.gimmickName)) bad(`unknown gimmick "${L.gimmickName}"`);
    if (!L.exits.some((e) => e.kind === 'elevator')) bad('no elevator — that is the way out now');

    for (const m of [...L.matF, ...L.matW, ...L.matC]) if (!MATSET.has(m)) bad(`unknown material "${m}"`);
    for (const p of L.props) {
      if (!PROPSET.has(p.name)) bad(`unknown prop "${p.name}"`);
      num(p.x, `prop ${p.name}.x`); num(p.z, `prop ${p.name}.z`);
    }
    for (const e of L.entities) {
      if (!ENTSET.has(e.type)) bad(`unknown entity "${e.type}"`);
      num(e.x, `entity ${e.type}.x`); num(e.z, `entity ${e.type}.z`);
    }
    for (const s of L.scares) if (!SCARESET.has(s.name)) bad(`unknown scare "${s.name}"`);
    for (const it of L.items) if (!ITEMSET.has(it.type)) bad(`unknown item "${it.type}"`);
    for (const e of L.exits) {
      if (!EXITSET.has(e.kind)) bad(`unknown exit kind "${e.kind}"`);
      if (!e.to) bad(`exit at ${e.x},${e.z} goes nowhere (set \`to\`)`);
      if (e.kind === 'elevator' && e.to !== 'NEXT') bad('an elevator always goes to NEXT');
    }
    if (!TONESET.has(L.ambience.room)) bad(`unknown room tone "${L.ambience.room}"`);
    if (!MUSICSET.has(L.ambience.music)) bad(`unknown music bed "${L.ambience.music}"`);
    for (const l of L.lights) {
      num(l.x, 'light.x'); num(l.z, 'light.z');
      if (!(l.radius > 0)) bad(`light at ${l.x},${l.z} has radius ${l.radius}`);
    }
    for (const n of L.notes) if (!n.text) bad(`note at ${n.x},${n.z} has no text`);

    // reachability: the exits, and everything you're meant to pick up
    const dist = L.flood(L._spawn.x, L._spawn.z);
    const reach = (x, z) => L.inside(x, z) && dist[L.idx(Math.round(x), Math.round(z))] >= 0;
    for (const e of L.exits) if (!reach(e.x, e.z)) bad(`exit ${e.kind}→${e.to} at ${e.x},${e.z} is unreachable from the spawn`);

    let walkable = 0;
    for (let i = 0; i < L.cells.length; i++) if (WALKABLE.has(L.cells[i])) walkable++;
    if (walkable < 40) bad(`only ${walkable} walkable cells — did the generator run?`);

    // A floor has to be a trek. If the lift ended up on the doorstep — a generator
    // handing back two seed points that happen to be neighbours, say — push it out
    // to the far end rather than ship a floor you finish in four steps. Small floors
    // are held to a smaller standard: roughly one crossing of their own area.
    const lift = L.exits.find((e) => e.kind === 'elevator');
    if (lift) {
      const liftD = dist[L.idx(Math.round(lift.x), Math.round(lift.z))];
      if (liftD < minTrek(walkable)) {
        let far = -1, fx = lift.x, fz = lift.z;
        for (let i = 0; i < dist.length; i++) {
          if (dist[i] > far) { far = dist[i]; fx = i % L.w; fz = (i / L.w) | 0; }
        }
        L.warnings.push(`lift sat ${liftD} cells from the spawn — moved it to ${fx},${fz} (${far} away)`);
        lift.x = fx; lift.z = fz;
      }
    }

    // Nothing lies around on a floor any more: the torch is the only thing you carry
    // and the only kit in the game comes off the stall in the lift.
    if (L.items.length) L.warnings.push(`${L.items.length} item pickup(s) — kit comes from the lift now, not the floor`);
    for (const n of L.notes) if (!reach(n.x, n.z)) L.warnings.push(`note "${n.title}" at ${n.x},${n.z} unreachable`);
    for (const e of L.entities) if (!L.isOpen(Math.round(e.x), Math.round(e.z))) L.warnings.push(`entity ${e.type} spawned in a wall at ${e.x},${e.z}`);

    return {
      w: L.w, h: L.h, cell: L.cell, wallH: L.wallH,
      cells: L.cells, floorYs: L.floorYs, ceilYs: L.ceilYs,
      matF: L.matF, matW: L.matW, matC: L.matC,
      lights: L.lights, props: L.props, colliders: L.colliders,
      entities: L.entities, scares: L.scares, items: L.items, notes: L.notes,
      triggers: L.triggers, links: L.links, exits: L.exits, objectives: L.objectives,
      hides: L.hides, monster: L.monsterRec, gimmick: L.gimmickName, gimmickOpts: L.gimmickOpts || {},
      spawn: L._spawn, openSky: L.openSky, sky: L.sky, fog: L.fog, ambient: L.ambient,
      ambience: L.ambience, rules: L.rules, tint: L.tint,
      waterLevel: L.waterLevel ?? null,
      stats: {
        walkable, lights: L.lights.length, props: L.props.length,
        entities: L.entities.length, hides: L.hides.length,
      },
      warnings: L.warnings,
    };
  }

  // A room that is not a floor of the game: the lift car, and anything else that wants
  // the world builder's geometry, collision and lighting without the floor contract.
  // No monster, no cover, no gimmick, nothing to escape — just somewhere to stand.
  finishRoom() {
    const L = this;
    L.enclose();
    if (!L._spawn) throw new Error('[room] no spawn — call L.spawnAt(x, z, yaw)');
    let walkable = 0;
    for (let i = 0; i < L.cells.length; i++) if (WALKABLE.has(L.cells[i])) walkable++;
    return {
      w: L.w, h: L.h, cell: L.cell, wallH: L.wallH,
      cells: L.cells, floorYs: L.floorYs, ceilYs: L.ceilYs,
      matF: L.matF, matW: L.matW, matC: L.matC,
      lights: L.lights, props: L.props, colliders: L.colliders,
      entities: [], scares: [], items: [], notes: [],
      triggers: L.triggers, links: [], exits: [], objectives: [],
      hides: [], monster: null, gimmick: 'silence', gimmickOpts: {},
      spawn: L._spawn, openSky: false, sky: L.sky, fog: L.fog, ambient: L.ambient,
      ambience: L.ambience, rules: L.rules, tint: L.tint,
      waterLevel: null,
      stats: { walkable, lights: L.lights.length, props: L.props.length, entities: 0, hides: 0 },
      warnings: [],
    };
  }
}

// ------------------------------------------------------------------ generators
// Every generator works on a Level and draws with its cell codes, so levels can
// stack them: a maze here, a hall there, caves through the middle.
export const gen = {
  // Perfect maze on odd cells, then braided (loops punched in) so it reads as
  // rooms and halls instead of a puzzle. The original rooms are mostly this.
  maze(L, o = {}) {
    const kit = L.kit;
    const x0 = o.x0 ?? 1, z0 = o.z0 ?? 1;
    const x1 = o.x1 ?? L.w - 2, z1 = o.z1 ?? L.h - 2;
    const code = o.code ?? C.OPEN;
    const wall = o.wall ?? C.WALL;
    L.rect(x0, z0, x1, z1, wall);
    const cols = Math.floor((x1 - x0) / 2), rows = Math.floor((z1 - z0) / 2);
    const seen = new Uint8Array((cols + 1) * (rows + 1));
    const cellIdx = (cx, cz) => cz * (cols + 1) + cx;
    const stack = [[0, 0]];
    seen[0] = 1;
    L.set(x0, z0, code);
    while (stack.length) {
      const [cx, cz] = stack[stack.length - 1];
      const dirs = kit.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      let moved = false;
      for (const [dx, dz] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx > cols || nz > rows || seen[cellIdx(nx, nz)]) continue;
        seen[cellIdx(nx, nz)] = 1;
        L.set(x0 + nx * 2, z0 + nz * 2, code);
        L.set(x0 + cx * 2 + dx, z0 + cz * 2 + dz, code);
        stack.push([nx, nz]);
        moved = true;
        break;
      }
      if (!moved) stack.pop();
    }
    // braid: knock through dead-end walls so it loops like a real building
    const braid = o.braid ?? 0.3;
    for (let z = z0 + 1; z < z1; z++) {
      for (let x = x0 + 1; x < x1; x++) {
        if (L.get(x, z) !== wall) continue;
        const openN = (L.isOpen(x + 1, z) ? 1 : 0) + (L.isOpen(x - 1, z) ? 1 : 0)
          + (L.isOpen(x, z + 1) ? 1 : 0) + (L.isOpen(x, z - 1) ? 1 : 0);
        if (openN >= 2 && kit.chance(braid)) L.set(x, z, code);
      }
    }
    // and widen some junctions into rooms, because corridors alone get boring
    const rooms = o.rooms ?? Math.floor(((x1 - x0) * (z1 - z0)) / 900);
    for (let i = 0; i < rooms; i++) {
      const rw = kit.randInt(o.roomMin ?? 3, o.roomMax ?? 9);
      const rh = kit.randInt(o.roomMin ?? 3, o.roomMax ?? 9);
      const rx = kit.randInt(x0 + 1, Math.max(x0 + 1, x1 - rw - 1));
      const rz = kit.randInt(z0 + 1, Math.max(z0 + 1, z1 - rh - 1));
      L.rect(rx, rz, rx + rw, rz + rh, code);
      if (o.roomPaint) L.paintRect(rx, rz, rx + rw, rz + rh, o.roomPaint);
    }
    return L;
  },

  // BSP rooms joined by corridors. Offices, hotels, hospitals, apartments.
  rooms(L, o = {}) {
    const kit = L.kit;
    const x0 = o.x0 ?? 1, z0 = o.z0 ?? 1, x1 = o.x1 ?? L.w - 2, z1 = o.z1 ?? L.h - 2;
    const minRoom = o.minRoom ?? 6, splits = o.splits ?? 4;
    const code = o.code ?? C.OPEN;
    L.rect(x0, z0, x1, z1, o.wall ?? C.WALL);
    const leaves = [];
    (function split(ax, az, bx, bz, depth) {
      const w = bx - ax, h = bz - az;
      if (depth <= 0 || (w < minRoom * 2 && h < minRoom * 2)) { leaves.push([ax, az, bx, bz]); return; }
      const horiz = w === h ? kit.chance(0.5) : w > h;
      if (horiz) {
        const cut = kit.randInt(ax + minRoom, bx - minRoom);
        split(ax, az, cut, bz, depth - 1);
        split(cut + 1, az, bx, bz, depth - 1);
      } else {
        const cut = kit.randInt(az + minRoom, bz - minRoom);
        split(ax, az, bx, cut, depth - 1);
        split(ax, cut + 1, bx, bz, depth - 1);
      }
    })(x0, z0, x1, z1, splits);
    const centers = [];
    for (const [ax, az, bx, bz] of leaves) {
      const pad = o.pad ?? 1;
      const rx0 = ax + pad, rz0 = az + pad, rx1 = bx - pad, rz1 = bz - pad;
      if (rx1 - rx0 < 2 || rz1 - rz0 < 2) continue;
      L.rect(rx0, rz0, rx1, rz1, code);
      if (o.roomPaint) L.paintRect(rx0, rz0, rx1, rz1, o.roomPaint);
      if (o.ceil) L.ceilRect(rx0, rz0, rx1, rz1, o.ceil);
      centers.push([Math.floor((rx0 + rx1) / 2), Math.floor((rz0 + rz1) / 2), rx0, rz0, rx1, rz1]);
    }
    // string the rooms together, then add a few extra doors for loops
    for (let i = 1; i < centers.length; i++) {
      const a = centers[i - 1], b = centers[i];
      L.corridor(a[0], a[1], b[0], b[1], o.corridorW ?? 1, code);
    }
    const extra = o.extraLinks ?? Math.floor(centers.length * 0.4);
    for (let i = 0; i < extra && centers.length > 2; i++) {
      const a = kit.pick(centers), b = kit.pick(centers);
      if (a !== b) L.corridor(a[0], a[1], b[0], b[1], o.corridorW ?? 1, code);
    }

    // ---- architecture, so a "room" is a room and not a rectangle
    // Every room gets its own ceiling within a hand's width of its neighbours', a few go
    // properly tall, and every threshold between a room and what leads into it gets a
    // frame in it. Costs nothing at runtime and it is most of the difference between a
    // building and a floor plan.
    if (o.architecture !== false) {
      for (const [cx, cz, rx0, rz0, rx1, rz1] of centers) {
        const base = o.ceil ?? L.wallH;
        const tall = kit.chance(0.16) && (rx1 - rx0) > 7 && (rz1 - rz0) > 7;
        const h = tall ? base + kit.rand(1.6, 3.2) : base + kit.rand(-0.35, 0.45);
        L.ceilRect(rx0, rz0, rx1, rz1, Math.max(2.1, h));
        if (tall) {
          // a coffer: the middle of the ceiling steps up again, and it is the only place
          // in the room a light can hide
          const ix0 = rx0 + 2, iz0 = rz0 + 2, ix1 = rx1 - 2, iz1 = rz1 - 2;
          if (ix1 > ix0 && iz1 > iz0) L.ceilRect(ix0, iz0, ix1, iz1, h + 0.5);
        }
        // an alcove punched into one wall of some rooms: somewhere to stand that is not
        // the middle of the floor
        if (kit.chance(0.3) && rx1 - rx0 > 8) {
          const ax = kit.randInt(rx0 + 2, rx1 - 3);
          const north = kit.chance(0.5);
          const az = north ? rz0 - 1 : rz1 + 1;
          for (let d = 0; d < 2; d++) {
            for (let w2 = 0; w2 < 3; w2++) {
              const px = ax + w2, pz = az + (north ? -d : d);
              if (!L.inside(px, pz) || L.get(px, pz) !== C.WALL) continue;
              L.set(px, pz, code);
              L.ceilAt(px, pz, 2.3);
            }
          }
        }
      }
      // doorframes: any open cell with walls either side of it is a threshold
      let frames = 0;
      for (let z = z0 + 1; z < z1 && frames < 90; z++) {
        for (let x = x0 + 1; x < x1 && frames < 90; x++) {
          if (!L.isOpen(x, z)) continue;
          const ew = L.get(x - 1, z) === C.WALL && L.get(x + 1, z) === C.WALL;
          const ns = L.get(x, z - 1) === C.WALL && L.get(x, z + 1) === C.WALL;
          if (!ew && !ns) continue;
          // one frame per doorway, not one per cell of a wide one
          if (L.get(x - (ns ? 1 : 0), z - (ew ? 1 : 0)) === code) continue;
          L.prop('doorFrame', { x, z, rot: ns ? Math.PI / 2 : 0 });
          frames++;
        }
      }
    }

    L.roomCenters = centers;
    return centers;
  },

  // Cellular caves. Wet rock, bacteria, the places under the places.
  caves(L, o = {}) {
    const kit = L.kit;
    const x0 = o.x0 ?? 1, z0 = o.z0 ?? 1, x1 = o.x1 ?? L.w - 2, z1 = o.z1 ?? L.h - 2;
    const code = o.code ?? C.OPEN, wall = o.wall ?? C.WALL;
    const fill = o.fill ?? 0.46;
    let a = [];
    for (let z = z0; z <= z1; z++) {
      const row = [];
      for (let x = x0; x <= x1; x++) row.push(kit.chance(fill) ? 1 : 0);
      a.push(row);
    }
    const at = (arr, x, z) => (arr[z] && arr[z][x] !== undefined ? arr[z][x] : 1);
    for (let step = 0; step < (o.steps ?? 4); step++) {
      const b = a.map((row, z) => row.map((_, x) => {
        let n = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) n += at(a, x + dx, z + dz);
        return n >= 5 ? 1 : n <= 2 ? 0 : at(a, x, z);
      }));
      a = b;
    }
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) L.set(x, z, a[z - z0][x - x0] ? wall : code);
    }
    // keep only the biggest cavern so nobody spawns in a sealed bubble
    const seen = new Uint8Array(L.w * L.h);
    let best = null;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!L.isOpen(x, z) || seen[L.idx(x, z)]) continue;
        const blob = [];
        const q = [[x, z]];
        seen[L.idx(x, z)] = 1;
        while (q.length) {
          const [cx, cz] = q.pop();
          blob.push([cx, cz]);
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, nz = cz + dz;
            if (!L.inside(nx, nz) || seen[L.idx(nx, nz)] || !L.isOpen(nx, nz)) continue;
            seen[L.idx(nx, nz)] = 1;
            q.push([nx, nz]);
          }
        }
        if (!best || blob.length > best.length) best = blob;
      }
    }
    if (best && o.pruneIslands !== false) {
      const keep = new Set(best.map(([x, z]) => L.idx(x, z)));
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) if (L.isOpen(x, z) && !keep.has(L.idx(x, z))) L.set(x, z, wall);
      }
    }
    return best || [];
  },

  // A big open hall on a pillar grid: warehouses, garages, terminals, malls.
  hall(L, o = {}) {
    const x0 = o.x0 ?? 1, z0 = o.z0 ?? 1, x1 = o.x1 ?? L.w - 2, z1 = o.z1 ?? L.h - 2;
    L.rect(x0, z0, x1, z1, o.code ?? C.OPEN);
    if (o.h) L.ceilRect(x0, z0, x1, z1, o.h);
    const every = o.every ?? 6;
    const placed = [];
    for (let z = z0 + (o.offZ ?? 2); z <= z1 - 1; z += every) {
      for (let x = x0 + (o.offX ?? 2); x <= x1 - 1; x += every) {
        if (o.where && !o.where(x, z)) continue;
        placed.push(L.prop(o.prop ?? 'pillar', { x, z, height: o.h ?? L.wallH }));
        // The collider is the pillar, not the cell it stands in. A pillar is 0.7m
        // across; a full-cell box is 3m and quietly walls off a bay that the pathing
        // still thinks is open, so the chalk sends you into thin air you cannot cross.
        const r = (o.radius ?? 0.45) / L.cell;
        L.collider(x - r, z - r, x + r, z + r, { y1: o.h ?? L.wallH, blocksSight: !!o.thick });
      }
    }
    return placed;
  },

  // Repeating blocks with streets between them: city, suburb, garage decks.
  blocks(L, o = {}) {
    const x0 = o.x0 ?? 1, z0 = o.z0 ?? 1, x1 = o.x1 ?? L.w - 2, z1 = o.z1 ?? L.h - 2;
    const bw = o.bw ?? 10, bh = o.bh ?? 10, street = o.street ?? 4;
    L.rect(x0, z0, x1, z1, o.code ?? C.OPEN);
    const made = [];
    for (let z = z0 + street; z + bh < z1; z += bh + street) {
      for (let x = x0 + street; x + bw < x1; x += bw + street) {
        const jw = Math.max(3, bw - (o.jitter ? L.kit.randInt(0, 3) : 0));
        const jh = Math.max(3, bh - (o.jitter ? L.kit.randInt(0, 3) : 0));
        L.rect(x, z, x + jw, z + jh, o.blockCode ?? C.WALL);
        made.push([x, z, x + jw, z + jh]);
        if (o.paint) L.paintRect(x - 1, z - 1, x + jw + 1, z + jh + 1, o.paint);
      }
    }
    return made;
  },

  // Cubicle farm: an open floor plate carved by waist-high partitions.
  office(L, o = {}) {
    const x0 = o.x0 ?? 2, z0 = o.z0 ?? 2, x1 = o.x1 ?? L.w - 3, z1 = o.z1 ?? L.h - 3;
    L.rect(x0, z0, x1, z1, C.OPEN);
    const pod = o.pod ?? 4;
    const desks = [];
    for (let z = z0 + 1; z + pod < z1; z += pod + 2) {
      for (let x = x0 + 1; x + pod < x1; x += pod + 2) {
        // three sides of a cubicle, opening onto the aisle
        for (let i = 0; i <= pod; i++) {
          L.set(x + i, z, C.HALF);
          L.set(x, z + i, C.HALF);
          if (L.kit.chance(0.75)) L.set(x + i, z + pod, C.HALF);
        }
        L.set(x + Math.floor(pod / 2), z, C.OPEN);   // the gap you walk through
        desks.push(L.prop('desk', { x: x + pod / 2, z: z + pod / 2, rot: L.kit.pick([0, Math.PI / 2, Math.PI]) }));
        if (L.kit.chance(0.6)) L.prop('officeChair', { x: x + pod / 2 + 0.6, z: z + pod / 2 + 0.5, rot: L.kit.rand(0, 6.28) });
        if (L.kit.chance(0.35)) L.prop('crtMonitor', { x: x + pod / 2, z: z + pod / 2 - 0.3 });
      }
    }
    return desks;
  },

  // Endless-corridor generator: one long spine with ribs. Level 188 and friends.
  spine(L, o = {}) {
    const len = o.len ?? L.h - 4;
    const x = o.x ?? Math.floor(L.w / 2);
    const w = o.w ?? 3;
    L.rect(x - Math.floor(w / 2), 2, x + Math.floor(w / 2), 2 + len, C.OPEN);
    const ribs = [];
    for (let z = 6; z < len; z += o.every ?? 8) {
      const side = L.kit.chance(0.5) ? 1 : -1;
      const rl = L.kit.randInt(o.ribMin ?? 4, o.ribMax ?? 14);
      const rx0 = side > 0 ? x + Math.floor(w / 2) : x - Math.floor(w / 2) - rl;
      L.rect(rx0, z, rx0 + rl, z + (o.ribW ?? 1), C.OPEN);
      ribs.push([rx0, z, rx0 + rl, z + (o.ribW ?? 1)]);
    }
    return ribs;
  },

  // Poolroom-style plan: chambers of water joined by shallow passages.
  pools(L, o = {}) {
    const kit = L.kit;
    const x0 = o.x0 ?? 2, z0 = o.z0 ?? 2, x1 = o.x1 ?? L.w - 3, z1 = o.z1 ?? L.h - 3;
    const chambers = [];
    const n = o.count ?? 9;
    for (let i = 0; i < n; i++) {
      const cw = kit.randInt(o.min ?? 8, o.max ?? 18), ch = kit.randInt(o.min ?? 8, o.max ?? 18);
      const cx = kit.randInt(x0, Math.max(x0, x1 - cw)), cz = kit.randInt(z0, Math.max(z0, z1 - ch));
      L.room(cx, cz, cx + cw, cz + ch, { floor: o.floor ?? 'tilePool', wall: o.wall ?? 'tileWhite', ceil: o.ceil ?? 'tileWhite' });
      if (o.h) L.ceilRect(cx, cz, cx + cw, cz + ch, o.h);
      chambers.push([cx, cz, cx + cw, cz + ch]);
    }
    for (let i = 1; i < chambers.length; i++) {
      const a = chambers[i - 1], b = chambers[i];
      const ax = Math.floor((a[0] + a[2]) / 2), az = Math.floor((a[1] + a[3]) / 2);
      const bx = Math.floor((b[0] + b[2]) / 2), bz = Math.floor((b[1] + b[3]) / 2);
      L.corridor(ax, az, bx, bz, o.corridorW ?? 2, C.OPEN);
    }
    return chambers;
  },
};

// ------------------------------------------------------------------ the kit
export function makeKit(seed = 1) {
  const R = randoms(seed);
  const kit = {
    seed,
    C, MATS, PROPS, ENTITIES, SCARES, ITEMS, HIDES, GIMMICKS, ROOM_TONES, MUSIC_BEDS, EXIT_KINDS,
    gen,
    r: R.r,
    rand: R.rand,
    randInt: R.randInt,
    pick: R.pick,
    chance: R.chance,
    shuffle: R.shuffle,
    bell: R.bell,
    noise: (s = seed) => new Noise2(s),
    clamp,
    level: (opts) => new Level(kit, opts),
  };
  return kit;
}
