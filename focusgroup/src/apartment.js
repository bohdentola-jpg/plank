// FOCUS GROUP — the flat.
//
// Top floor of a 1960s block. Two rooms, a kitchen you can turn round in, a
// bathroom, and a hall you can see all of at once, which is convenient for
// everybody. It is built the same way every morning, because it is the same
// flat every morning; what changes is the dressing, the lighting, and how much
// of it is pointed at you.
//
//        z-8.6 +--------------------+-----------+-------+
//              |      BEDROOM       | BATHROOM  |  cpd  |
//        z-5.4 +----[ ]-------------+---[ ]-----+-------+
//              |            HALL                    [D] |   D = front door
//        z-3.6 +------[ ]-----------+-----[ ]----------- +
//              |     LIVING         |     KITCHEN        |
//         z1.4 +====================+====================+
//            x-4.0                x0.2                 x3.4
//                     ==== = the window wall

import * as THREE from 'three';
import { World, CEIL, doorLeaf, skirting, scalePlaneUVs } from './world.js';
import { material, simple } from './textures.js';
import * as P from './props.js';
import { LENSES } from './story.js';

export const FLAT = {
  living: { x0: -4.0, x1: 0.2, z0: -3.6, z1: 1.4 },
  kitchen: { x0: 0.2, x1: 3.4, z0: -3.6, z1: 1.4 },
  hall: { x0: -4.0, x1: 3.4, z0: -5.4, z1: -3.6 },
  bedroom: { x0: -4.0, x1: -0.4, z0: -8.6, z1: -5.4 },
  bathroom: { x0: -0.4, x1: 2.0, z0: -8.6, z1: -5.4 },
};

/** Where you wake up, and which way you are facing when you do. */
export const SPAWN = { x: -0.95, y: 0, z: -6.55, yaw: 2.05 };

// A skin pinned to one side of a wall, so a room can have its own paper on a
// wall it shares with a room that has different taste. `holes` uses the same
// { at, w, y0, y1 } shape as world.wall and must be given the same openings —
// a lining without them papers straight over the doorway.
function lining(world, x0, z0, x1, z1, mat, facing, holes = []) {
  const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const sx = Math.min(x0, x1), sz = Math.min(z0, z1);
  const m = material(mat);

  const parts = [];
  let cursor = 0;
  for (const h of [...holes].sort((a, b) => a.at - b.at)) {
    if (h.at > cursor) parts.push({ a: cursor, b: h.at, y0: 0, y1: CEIL });
    if (h.y1 < CEIL) parts.push({ a: h.at, b: h.at + h.w, y0: h.y1, y1: CEIL });
    if (h.y0 > 0) parts.push({ a: h.at, b: h.at + h.w, y0: 0, y1: h.y0 });
    cursor = h.at + h.w;
  }
  if (cursor < len) parts.push({ a: cursor, b: len, y0: 0, y1: CEIL });

  const made = [];
  for (const p of parts) {
    const pl = p.b - p.a;
    const ph = p.y1 - p.y0;
    if (pl <= 0.002 || ph <= 0.002) continue;
    const geo = new THREE.PlaneGeometry(pl, ph);
    scalePlaneUVs(geo, pl, ph, m.userData.tile);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(
      horiz ? sx + p.a + pl / 2 : x0,
      p.y0 + ph / 2,
      horiz ? z0 : sz + p.a + pl / 2
    );
    mesh.rotation.y = facing;
    mesh.position.x += Math.sin(facing) * 0.065;
    mesh.position.z += Math.cos(facing) * 0.065;
    mesh.receiveShadow = true;
    // a zero-thickness plane is invisible to a bounding-box test, so it says
    // out loud what stretch of wall it covers and the smoke test reads it
    mesh.userData.lining = {
      horiz,
      at0: horiz ? sx + p.a : sz + p.a,
      at1: horiz ? sx + p.b : sz + p.b,
      on: horiz ? z0 : x0,
      y0: p.y0,
      y1: p.y1,
    };
    made.push(world.add(mesh));
  }
  return made;
}

/**
 * @param {object} dress   the day's `dress` block from story.js
 * @param {number} lit     0..1 — how hard the flat is being lit for television
 * @param {string} outside 'sodium' (before dawn) or 'grey' (Saturday)
 */
export function buildFlat(dress = {}, lit = 0, outside = 'sodium') {
  const w = new World('flat');
  w.bounds = { x0: -4.3, x1: 3.7, z0: -8.9, z1: 1.7 };

  // ---------------------------------------------------------------- rooms
  w.room('living', FLAT.living.x0, FLAT.living.z0, FLAT.living.x1, FLAT.living.z1, 'carpet');
  w.room('kitchen', FLAT.kitchen.x0, FLAT.kitchen.z0, FLAT.kitchen.x1, FLAT.kitchen.z1, 'lino');
  w.room('hall', FLAT.hall.x0, FLAT.hall.z0, FLAT.hall.x1, FLAT.hall.z1, 'carpet');
  w.room('bedroom', FLAT.bedroom.x0, FLAT.bedroom.z0, FLAT.bedroom.x1, FLAT.bedroom.z1, 'carpet');
  w.room('bathroom', FLAT.bathroom.x0, FLAT.bathroom.z0, FLAT.bathroom.x1, FLAT.bathroom.z1, 'tile');

  // ---------------------------------------------------------------- floors
  w.slab(-4.0, 0.2, -3.6, 1.4, 0, 'carpet');
  w.slab(0.2, 3.4, -3.6, 1.4, 0.002, 'lino');
  w.slab(-4.0, 3.4, -5.4, -3.6, 0, 'carpetHall');
  w.slab(-4.0, -0.4, -8.6, -5.4, 0, 'carpet');
  w.slab(-0.4, 2.0, -8.6, -5.4, 0.002, 'tileBath');
  // ceiling, all one artexed sheet
  w.slab(-4.0, 3.4, -8.6, 1.4, CEIL, 'ceiling', { up: false });

  // ---------------------------------------------------------------- walls
  const PAPER = 'wallpaper';

  // south — the window wall. Two openings, both glazed.
  w.wall(-4.0, 1.4, 3.4, 1.4, PAPER, {
    holes: [
      { at: 0.8, w: 2.4, y0: 0.95, y1: 2.20 },   // living room window
      { at: 5.4, w: 1.2, y0: 1.00, y1: 2.00 },   // over the kitchen sink
    ],
  });
  // west, east, north — the outside of the block
  w.wall(-4.0, 1.4, -4.0, -8.6, PAPER);
  w.wall(3.4, 1.4, 3.4, -8.6, PAPER, {
    holes: [{ at: 5.03, w: 0.90, y0: 0, y1: 2.06 }],   // the front door
  });
  w.wall(-4.0, -8.6, 3.4, -8.6, PAPER);

  // living/kitchen from the hall
  w.wall(-4.0, -3.6, 3.4, -3.6, PAPER, {
    holes: [
      { at: 0.4, w: 1.10, y0: 0, y1: 2.10 },     // into the living room
      { at: 5.4, w: 0.90, y0: 0, y1: 2.06 },     // into the kitchen
    ],
  });
  // the stub between living and kitchen — open from the window end
  w.wall(0.2, -3.6, 0.2, -1.3, PAPER);

  // hall from the bedroom and bathroom
  w.wall(-4.0, -5.4, 3.4, -5.4, PAPER, {
    holes: [
      { at: 1.0, w: 0.86, y0: 0, y1: 2.04 },     // bedroom door
      { at: 4.6, w: 0.80, y0: 0, y1: 2.04 },     // bathroom door
    ],
  });
  w.wall(-0.4, -5.4, -0.4, -8.6, PAPER);          // bedroom | bathroom
  w.wall(2.0, -5.4, 2.0, -8.6, PAPER);            // bathroom | cupboard
  // the airing cupboard is a solid lump you cannot get into
  w.solid(2.0, 3.4, -8.6, -5.4, 0, CEIL, 'wall');
  w.box(1.36, CEIL, 0.06, 'gloss', 2.72, CEIL / 2, -5.43, { solid: false });

  // the bedroom and the bathroom got their own decorating. The wall each of
  // them shares with the hall has a door in it, so its lining does too.
  const B = FLAT.bedroom, T = FLAT.bathroom;
  const BED_DOOR = [{ at: 1.0, w: 0.86, y0: 0, y1: 2.04 }];   // x -3.00 .. -2.14
  const BATH_DOOR = [{ at: 1.0, w: 0.80, y0: 0, y1: 2.04 }];  // x  0.60 ..  1.40
  lining(w, B.x0, B.z0, B.x1, B.z0, 'wallpaperBed', 0);                    // north
  lining(w, B.x0, B.z1, B.x1, B.z1, 'wallpaperBed', Math.PI, BED_DOOR);    // the hall
  lining(w, B.x0, B.z0, B.x0, B.z1, 'wallpaperBed', Math.PI / 2);          // west
  lining(w, B.x1, B.z0, B.x1, B.z1, 'wallpaperBed', -Math.PI / 2);         // east
  lining(w, T.x0, T.z0, T.x1, T.z0, 'tileBath', 0);
  lining(w, T.x0, T.z1, T.x1, T.z1, 'tileBath', Math.PI, BATH_DOOR);
  lining(w, T.x0, T.z0, T.x0, T.z1, 'tileBath', Math.PI / 2);
  lining(w, T.x1, T.z0, T.x1, T.z1, 'tileBath', -Math.PI / 2);

  // skirting, everywhere the eye lands on a corner
  [[-4.0, 1.35, 0.2, 1.35], [-4.0, -3.55, 0.2, -3.55], [-3.95, -3.6, -3.95, 1.4],
    [-4.0, -5.35, 3.4, -5.35], [-3.95, -8.6, -3.95, -5.4], [3.35, -5.4, 3.35, 1.4]]
    .forEach((r) => skirting(w, r[0], r[1], r[2], r[3]));

  // doors, hung on their frames and slightly ajar, the way doors are
  const doors = {
    bedroom: doorLeaf(w, -3.0, -5.4, { rotY: 0 }),
    bathroom: doorLeaf(w, 0.6, -5.4, { rotY: 0, w: 0.74 }),
  };
  doors.bedroom.pivot.rotation.y = -0.9;
  doors.bathroom.pivot.rotation.y = -1.5;

  // ---------------------------------------------------------------- living
  const tv = P.television(w, -3.58, -1.20, Math.PI / 2);
  P.sofa(w, -1.30, -1.20, -Math.PI / 2);
  P.coffeeTable(w, -2.44, -1.20);
  P.sideboard(w, -2.00, -3.32, 0);
  const lamp = P.standardLamp(w, -3.58, 0.85);
  P.radiator(w, -2.00, 1.26, 0);
  const win = P.window7(w, -2.00, 1.33, { w: 2.40, h: 1.25, y: 0.95 });
  const clock = P.wallClock(w, -0.60, 1.85, -3.53, 0);
  // the rug the coffee table stands on
  const rug = w.slab(-3.30, -0.60, -2.40, 0.10, 0.004, 'upholstery', { tile: 0.5 });
  rug.material = simple(0x7a3a1c, { rough: 0.98 });

  // ---------------------------------------------------------------- kitchen
  P.counterRun(w, 1.30, 3.20, 1.05, { face: -1 });
  P.sink(w, 2.00, 1.05);
  // the wall cupboard goes beside the window, not on top of the extractor
  P.wallUnits(w, 2.70, 3.24, 1.20, { face: -1 });
  P.cooker(w, 0.66, 1.05);
  const ext = P.extractor(w, 0.66, 1.05);
  ext.group.rotation.y = Math.PI;              // grille out into the room
  P.fridge(w, 3.02, -0.40, -Math.PI / 2);
  const coffee = P.coffeeMaker(w, 2.86, 1.02, Math.PI);
  P.dinetteTable(w, 1.70, -1.70);
  P.chair(w, 1.70, -2.42, 0);
  P.chair(w, 1.70, -0.98, Math.PI);
  P.window7(w, 2.00, 1.33, { w: 1.20, h: 1.00, y: 1.00 });

  // ---------------------------------------------------------------- hall
  const front = P.frontDoor(w, 3.37, -4.48, -Math.PI / 2);
  const smoke = P.smokeDetector(w, 1.15, 2.42, -4.50);
  const mat = w.slab(2.55, 3.30, -4.90, -4.05, 0.005, 'carpetHall', { tile: 1.6 });
  mat.material = simple(0x3a2c20, { rough: 1 });
  // coat hooks, with one coat on them
  w.box(0.52, 0.06, 0.03, 'woodDark', -1.60, 1.72, -5.36, { solid: false });
  [-1.78, -1.60, -1.42].forEach((hx) => {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), simple(0xb08a44, { rough: 0.35, metal: 0.6 }));
    h.position.set(hx, 1.70, -5.32);
    w.add(h);
  });
  w.box(0.34, 0.86, 0.14, 'upholstery', -1.78, 1.28, -5.28, { solid: false, tile: 0.9 });

  // ---------------------------------------------------------------- bedroom
  P.bed(w, -2.40, -7.20, 0);
  P.bedsideTable(w, -1.30, -7.90);
  const radio = P.clockRadio(w, -1.30, 0.55, -7.90, 0.5);
  P.wardrobe(w, -3.66, -5.95, Math.PI / 2);
  P.radiator(w, -2.20, -8.50, 0);

  // ---------------------------------------------------------------- bathroom
  P.basin(w, 0.90, -8.32);
  const cab = P.cabinetMirror(w, 0.90, 1.55, -8.48);
  P.bath(w, 0.36, -6.60, Math.PI / 2);
  P.toilet(w, 1.68, -8.12, 0);

  // ---------------------------------------------------------------- light
  // A March morning at twenty to seven is not a morning yet. The window is
  // the colour of the street lamp outside it, which is the colour of tinned
  // soup, and the flat's own bulbs are worse.
  const night = outside !== 'grey';
  w.light(new THREE.AmbientLight(night ? 0x39394a : 0x6a7080, night ? 1.05 : 1.9), 'ambient');
  w.light(new THREE.HemisphereLight(night ? 0x4a5470 : 0x9fabbc, 0x4a3826, night ? 0.85 : 1.5), 'ambient');

  const sun = new THREE.DirectionalLight(night ? 0xffa040 : 0xc8cede, night ? 1.35 : 2.6);
  sun.position.set(-1.2, night ? 2.4 : 7.0, 9.0);
  sun.target.position.set(-1.6, 0.8, -1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 26;
  sun.shadow.bias = -0.0015;
  w.add(sun.target);
  w.light(sun, 'window');

  // the pendants: one to a room, all of them 60W and none of them shaded well
  // three is physically based from r155 on: a point light's intensity is in
  // candela, so a 60W bulb in a small room is tens, not tenths.
  const pendant = (x, z, colour = 0xffd0a0, intensity = 0.9) => {
    const p = new THREE.PointLight(colour, intensity * 22, 7.5, 2);
    p.position.set(x, 2.18, z);
    w.light(p, 'practical');
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.16, 14, 1, true),
      simple(0xe8dcc0, { rough: 0.9, side: THREE.DoubleSide, emissive: 0xffe0b0, emissiveIntensity: 0.7 })
    );
    shade.position.set(x, 2.24, z);
    w.add(shade);
    w.box(0.012, 0.20, 0.012, 'woodDark', x, 2.36, z, { solid: false });
    return p;
  };
  pendant(-1.9, -1.2, 0xffcc9a, night ? 0.62 : 0.28);
  pendant(1.8, -0.8, 0xfff0d0, night ? 0.62 : 0.3);
  pendant(-1.7, -4.5, 0xffcc9a, night ? 0.52 : 0.26);
  pendant(-2.2, -6.9, 0xffc890, night ? 0.42 : 0.20);
  pendant(0.8, -7.0, 0xf0f4ff, night ? 0.48 : 0.26);

  // ---- and the one that has no source in the room.
  // It arrives softly, from off-frame left, at exactly the height a key light
  // is hung at. By Saturday it is doing most of the work.
  // registered at full strength and then scaled down, because world.light()
  // remembers whatever it is handed as the base
  const key = new THREE.SpotLight(0xfff0d2, 58, 18, 0.95, 0.55, 1.4);
  key.position.set(-6.4, 3.1, -1.0);
  key.target.position.set(-1.4, 1.1, -2.0);
  w.add(key.target);
  w.light(key, 'studio');
  const fill = new THREE.PointLight(0xdce8ff, 13, 11, 1.6);
  fill.position.set(2.6, 2.2, -2.6);
  w.light(fill, 'studio');
  w.setLightScale('studio', lit);

  // ---------------------------------------------------------------- dressing

  const props = { tv, lamp, win, clock, coffee, radio, cab, smoke, ext, front, doors, key, fill, sun };
  const gifts = {};

  if (dress.box) props.parcel = P.parcel(w, 3.05, -4.35, { rotY: 0.24 });

  if (dress.gifts) {
    // where the gifts ended up. On Thursday you choose; after that they stay
    // where you put them, and the save file remembers, and so do they.
    const spots = dress.giftSpots || DEFAULT_GIFT_SPOTS;
    if (spots.mug) gifts.mug = P.mug(w, spots.mug.x, spots.mug.y, spots.mug.z, { lens: true });
    if (spots.lamp) gifts.lamp = P.giftLamp(w, spots.lamp.x, spots.lamp.y, spots.lamp.z, { lens: true });
    if (spots.figurine) gifts.figurine = P.figurine(w, spots.figurine.x, spots.figurine.y, spots.figurine.z, { lens: true });
    if (spots.alarm) {
      gifts.alarm = P.smokeDetector(w, spots.alarm.x, spots.alarm.y, spots.alarm.z, { noBattery: true, colour: 0xf0ece0 });
    }
    props.giftSpots = spots;
  }

  if (dress.marks) {
    props.marks = [
      P.floorMark(w, -2.10, -0.40, 0.0),
      P.floorMark(w, 1.90, -0.30, 0.35),
      P.floorMark(w, -0.20, -4.50, Math.PI / 2),
    ];
  }

  if (dress.val) {
    props.val = P.valMascot(w, -3.60, -8.10, { rotY: 0.6 });
  }

  // Every window in the block opposite is showing the same thing, and they
  // are showing it at the same time.
  if (dress.sync) props.opposite = buildOpposite(w);

  // ---------------------------------------------------------------- cameras
  //
  // Every angle the game can cut to. They are all mounted on something you
  // could have found, which is the deal the game makes with you and keeps.

  const mid = { x: -1.6, y: 1.15, z: -1.1 };
  w.camSpot('smoke', { x: 1.15, y: 2.36, z: -4.50 }, { x: -1.8, y: 0.95, z: -4.60 }, { num: 3, fov: 88, room: 'hall' });
  w.camSpot('clock', { x: -1.26, y: 0.62, z: -7.86 }, { x: -2.40, y: 0.72, z: -7.10 }, { num: 1, fov: 74, room: 'bedroom' });
  w.camSpot('tv', { x: -3.30, y: 1.12, z: -1.20 }, { x: -1.50, y: 1.05, z: -0.90 }, { num: 4, fov: 82, room: 'living' });
  w.camSpot('kettle', { x: 2.86, y: 1.14, z: 0.90 }, { x: 1.70, y: 1.20, z: -0.90 }, { num: 5, fov: 84, room: 'kitchen' });
  w.camSpot('mirror', { x: 1.06, y: 1.62, z: -8.40 }, { x: 0.80, y: 1.20, z: -7.20 }, { num: 7, fov: 80, room: 'bathroom' });
  w.camSpot('vent', { x: 0.66, y: 1.58, z: 0.90 }, { x: 1.40, y: 1.10, z: -1.40 }, { num: 6, fov: 86, room: 'kitchen' });
  w.camSpot('blinds', { x: -0.86, y: 1.92, z: 1.26 }, { x: -2.20, y: 1.00, z: -1.60 }, { num: 2, fov: 90, room: 'living' });
  w.camSpot('peephole', { x: 3.30, y: 1.56, z: -4.48 }, { x: -1.20, y: 1.20, z: -4.60 }, { num: 8, fov: 92, room: 'hall' });
  if (dress.gifts) {
    const s = props.giftSpots || DEFAULT_GIFT_SPOTS;
    const look = (p) => ({ x: p.x + (p.x > 0 ? -1.4 : 1.4), y: 1.05, z: p.z - 0.9 });
    if (s.mug) w.camSpot('mug', { x: s.mug.x, y: s.mug.y + 0.06, z: s.mug.z }, look(s.mug), { num: 9, fov: 76 });
    if (s.lamp) w.camSpot('lamp', { x: s.lamp.x, y: s.lamp.y + 0.20, z: s.lamp.z }, look(s.lamp), { num: 10, fov: 80 });
    if (s.figurine) w.camSpot('figurine', { x: s.figurine.x, y: s.figurine.y + 0.10, z: s.figurine.z }, look(s.figurine), { num: 11, fov: 72 });
    if (s.alarm) w.camSpot('alarm', { x: s.alarm.x, y: s.alarm.y - 0.04, z: s.alarm.z }, { x: mid.x, y: 0.9, z: mid.z }, { num: 12, fov: 94 });
  }

  // ---------------------------------------------------------------- noticing
  //
  // One Q-interact per lens that exists today, hung on the actual bead of
  // glass in the actual object.
  const lensAnchors = {
    smoke: smoke.lens, clock: radio.lens, tv: tv.lens, kettle: coffee.lens,
    mirror: cab.lens, vent: ext.lens, blinds: win.toggle, peephole: front.lens,
    mug: gifts.mug?.userData.lens, lamp: gifts.lamp?.group.userData.lens,
    figurine: gifts.figurine?.userData.lens, alarm: gifts.alarm?.lens,
  };
  const v = new THREE.Vector3();
  for (const id of dress.lenses || []) {
    const anchor = lensAnchors[id];
    if (!anchor) continue;
    anchor.getWorldPosition(v);
    w.addInteract({
      id: `lens:${id}`,
      lens: id,
      key: 'Q',
      pos: { x: v.x, y: v.y, z: v.z },
      r: 2.2,
      cone: 0.90,                       // you have to be actually looking at it
      label: LENSES[id]?.hint || 'something',
    });
  }

  props.gifts = gifts;
  w.props = props;
  return w;
}

/** Where a reasonable person puts four things they did not ask for. */
export const DEFAULT_GIFT_SPOTS = {
  mug: { x: 2.55, y: 0.825, z: 1.02 },        // by the coffee machine
  lamp: { x: -2.00, y: 0.795, z: -3.30 },     // on the sideboard
  figurine: { x: -0.60, y: 0.425, z: -1.10 }, // on the coffee table
  alarm: { x: -1.90, y: 2.42, z: -1.20 },     // living room ceiling
};

/** Every place you could reasonably put one, for the day you get to choose. */
export const GIFT_SLOTS = [
  { id: 'counter', label: 'the kitchen counter', x: 2.55, y: 0.825, z: 1.02, room: 'kitchen' },
  { id: 'sideboard', label: 'the sideboard', x: -2.00, y: 0.795, z: -3.30, room: 'living' },
  { id: 'table', label: 'the coffee table', x: -0.60, y: 0.425, z: -1.10, room: 'living' },
  { id: 'bedside', label: 'the bedside table', x: -1.30, y: 0.545, z: -7.68, room: 'bedroom' },
  { id: 'shelf', label: 'the shelf in the hall', x: -1.60, y: 1.60, z: -5.30, room: 'hall' },
  { id: 'ceiling', label: 'the living room ceiling', x: -1.90, y: 2.42, z: -1.20, room: 'living' },
  { id: 'dinette', label: 'the kitchen table', x: 1.70, y: 0.755, z: -1.70, room: 'kitchen' },
  { id: 'cistern', label: 'the bathroom shelf', x: 1.68, y: 0.82, z: -8.38, room: 'bathroom' },
];

/**
 * The block across the courtyard, seen through the living room window: three
 * flat planes of windows. On the days it matters, every one of them is the
 * same blue, and they all flicker together.
 */
function buildOpposite(world) {
  const g = new THREE.Group();
  g.position.set(-1.2, 0, 13.0);
  world.add(g);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 13),
    simple(0x181a20, { rough: 1 })
  );
  wall.position.set(0, 5.0, 0);
  wall.rotation.y = Math.PI;
  g.add(wall);

  const panes = [];
  const mat = () => simple(0x2a2f3a, { rough: 0.6, emissive: 0x0a0c12, emissiveIntensity: 1 });
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 11; col++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.75), mat());
      m.position.set(-9.4 + col * 1.9, 1.4 + row * 1.85, -0.03);
      m.rotation.y = Math.PI;
      g.add(m);
      panes.push(m);
    }
  }
  return {
    group: g,
    panes,
    /** @param {number} k 0 = a normal block at night, 1 = all of them, together */
    setSync(k, t) {
      const flick = 0.55 + 0.45 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
      panes.forEach((p, i) => {
        const own = ((i * 37) % 11) < 4 ? 1 : 0;                 // who is normally up
        const lonely = own ? 0.55 : 0.02;
        const together = 0.85 * flick;
        const v = lonely + (together - lonely) * k;
        p.material.emissive.setRGB(v * (0.35 + 0.25 * k), v * (0.42 + 0.3 * k), v * (0.55 + 0.45 * k));
      });
    },
  };
}
