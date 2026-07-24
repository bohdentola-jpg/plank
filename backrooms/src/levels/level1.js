// LEVEL 1 — HABITABLE ZONE
// The rooms give way to poured concrete and pillars, strip lights on chains,
// pallets of nothing stacked to the ceiling. It is a warehouse for a company
// that does not exist, and it is the first level where something in the dark
// is faster than you are.

export const meta = {
  id: 'level1',
  num: '1',
  name: 'HABITABLE ZONE',
  subtitle: 'the concrete',
  tagline: 'Bring water. Bring a friend. Do not bring noise.',
  danger: 3,
  survival: 'fair',
  chapter: 2,
  tape: 'TAPE 02',
  brief: `Concrete bays, a flooded loading pit, machinery you never find.
    There are hounds in the far aisles and they hunt by sound. Walk.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 150, h: 150, cell: 3.4, wallH: 5.6,
    palette: { wall: 'concrete', floor: 'concrete', ceil: 'concrete' },
    fog: { color: 0x1a1c1a, density: 0.030 },
    ambient: { color: 0x2a2c2a, intensity: 0.16 },
  });
  L.setAmbience({ room: 'machinery', hum: 0.5, drip: 0.4, wind: 0.1, music: 'drone', reverb: 0.7 });
  L.setRules({ batteryDrain: 1.0, noiseLimit: 0.55 });
  L.setTint(0.94, 0.98, 1.0);

  // ---------------------------------------------------------------- the bays
  // One enormous slab, cut into aisles by racking. Sight lines are long down
  // the aisles and nil across them, which is exactly how the hounds like it.
  L.fill(C.WALL);
  kit.gen.hall(L, { x0: 3, z0: 3, x1: 146, z1: 146, every: 9, h: 5.6, prop: 'pillarSquare', thick: true });
  for (let z = 10; z < 142; z += 12) {
    const gap = kit.randInt(30, 110);
    for (let x = 6; x < 144; x++) {
      if (Math.abs(x - gap) < 5 || kit.chance(0.04)) continue;    // crossings
      L.set(x, z, C.HALF);
      L.paint(x, z, { wall: 'metalPlate' });
    }
  }
  L.paintWhere((c) => c === C.OPEN, { floor: 'concrete' });

  // A wing where the roof came down and the rain gets in.
  L.room(112, 108, 144, 144, { floor: 'concreteWet', wall: 'cinder', ceil: 'concrete' });
  L.ceilRect(112, 108, 144, 144, 7.4);
  L.scatter('rubblePile', 16, { where: (x, z) => x > 110 && z > 106 });
  L.scatter('columnBroken', 5, { where: (x, z) => x > 110 && z > 106 });

  // ---------------------------------------------------------------- the pit
  // A loading dock that has been filling with groundwater for years.
  L.room(14, 96, 44, 128, { floor: 'concreteWet', wall: 'concretePaint' });
  L.water(17, 99, 41, 125, { depth: 0.7, level: -0.2, floor: 'concreteWet', wall: 'concretePaint' });
  L.ramp(45, 112, 42, 112, 0, -0.9, { width: 4 });
  L.scatter('barrel', 12, { where: (x, z) => x > 14 && x < 44 && z > 96 && z < 128 });
  L.prop('trolley', { x: 30, z: 110, rot: 0.4 });

  // ---------------------------------------------------------------- mezzanine
  // Up the ramp, along the gantry, over the top of the racking.
  const mz = [96, 20, 130, 44];
  L.room(mz[0], mz[1], mz[2], mz[3], { floor: 'metalPlate', wall: 'cinder' });
  L.floorRect(mz[0], mz[1], mz[2], mz[3], 2.6);
  L.ceilRect(mz[0], mz[1], mz[2], mz[3], 6.4);
  L.ramp(mz[0] - 8, 30, mz[0], 30, 0, 2.6, { width: 3 });
  L.prop('railing', { x: mz[0] + 6, z: mz[3], len: 10, y: 2.6 });
  L.prop('serverRack', { x: mz[0] + 4, z: mz[1] + 3 });
  L.prop('breakerBox', { x: mz[0] + 8, z: mz[1] + 1 });
  L.prop('desk', { x: mz[0] + 12, z: mz[1] + 4, y: 2.6, rot: 1.2 });
  L.light({ x: mz[0] + 8, z: mz[1] + 4, y: 5.6, color: 0xffe8b0, intensity: 1.1, radius: 12, fixture: 'cage' });

  // ---------------------------------------------------------------- lights
  // Strip lights on chains, most of them still going, some of them not.
  L.lightGrid(8, 8, 142, 142, {
    every: 9, color: 0xf4f0d8, intensity: 0.95, radius: 15,
    flickerChance: 0.2, deadChance: 0.14, brokenChance: 0.08, fixture: 'tube',
  });
  for (const l of L.lights) if (l.x > 108 && l.z > 104) { l.dead = kit.chance(0.75); l.flicker = 0.8; }
  L.light({ x: 29, z: 112, y: 3.2, color: 0x7fd8ff, intensity: 0.8, radius: 14, fixture: 'flood', hum: 0.3 });

  // ---------------------------------------------------------------- dressing
  L.scatter('pallet', 40);
  L.scatter('crateStack', 26);
  L.scatter('drum', 18);
  L.scatter('boxStack', 22);
  L.scatter('pipeRun', 14, { opts: { len: 8, height: 4.8 } });
  L.scatter('ductRun', 8, { opts: { len: 10, height: 5.0 } });
  L.scatter('graffiti', 20);
  L.scatter('clawMarks', 14, { where: (x, z) => x > 80 });
  L.scatter('bloodTrail', 6, { where: (x, z) => x > 90 && z > 90 });
  L.scatter('wetFloorSign', 5);
  L.prop('dumpster', { x: 60, z: 18, rot: 0.2 });
  L.prop('shrine', { x: 74, z: 76 });

  // ---------------------------------------------------------------- pickups
  L.item('battery', { x: 22, z: 12 });
  L.item('battery', { x: mz[0] + 10, z: mz[1] + 2 });
  L.item('almondWater', { x: 74, z: 74 });
  L.item('almondWater', { x: 120, z: 130 });
  L.item('flare', { x: 62, z: 18, amount: 2 });
  L.item('medkit', { x: 30, z: 118 });
  L.item('crowbar', { x: mz[0] + 14, z: mz[1] + 6 });
  L.item('tape', { x: 76, z: 78, id: 'tape-hab', title: 'TAPE — "SHIFT LOG"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: 23, z: 12, title: 'CLIPBOARD, SHIFT LOG',
    text: `06:00 — bay 4 restocked. 09:00 — bay 4 restocked. 12:00 — bay 4
      restocked. Nothing has been taken out of bay 4 in the eleven weeks I have
      been signing this sheet. I have started signing other people's names.`,
  });
  L.note({
    x: 75, z: 76, title: 'CARDBOARD, MARKER, PROPPED ON A CRATE',
    text: `Whoever left the candles: thank you. I sat here two days and nothing
      came down the aisle. They don't like it lit and they don't like standing
      water. That's two things. Two things is a plan.`,
  });
  L.note({
    x: mz[0] + 11, z: mz[1] + 2, title: 'SAFETY NOTICE, LAMINATED',
    text: `HEARING PROTECTION MUST BE WORN IN THIS AREA. Overleaf: HEARING
      PROTECTION MUST NOT BE WORN IN THIS AREA. Both sides are signed by the
      same manager, four minutes apart.`,
  });
  L.note({
    x: 31, z: 118, title: 'WATERPROOF NOTEBOOK, PIT EDGE',
    text: `Waded the pit end to end. Floor's cracked open at the deep corner and
      there's air coming up out of it — cold, and it smells like a cave, like
      wet stone. Something down there is a lot bigger than this building.`,
  });
  L.note({
    x: 121, z: 130, title: 'SPRAYED ON A COLLAPSED WALL',
    text: `RUN AND THEY COME. WALK AND THEY WAIT. STOP AND THEY LEAVE.
      I HAVE ONLY EVER MANAGED TWO OF THE THREE.`,
  });
  L.note({
    x: 62, z: 19, title: 'INVOICE, WATER-STAINED',
    text: `SHIPPED TO: LEVEL 1, BAY 4. CONTENTS: 1 × PALLET, EMPTY.
      QUANTITY: 41,000. DELIVERY WINDOW: ONGOING.`,
  });

  // ---------------------------------------------------------------- company
  L.entity('duller', { x: 54, z: 60, state: 'patrol', leash: 14 });
  L.pack('duller', 3, 88, 40, 6, { state: 'patrol', leash: 10 });
  L.entity('howler', { x: 70, z: 100, state: 'patrol', leash: 20 });
  L.pack('hound', 4, 128, 126, 8, { state: 'dormant', tag: 'bay4', wake: { after: 150 } });
  L.entity('hound', { x: 104, z: 74, state: 'patrol', leash: 34 });
  L.entity('hound', { x: 40, z: 138, state: 'dormant', tag: 'bay4' });
  L.entity('clump', { x: 132, z: 96, state: 'patrol', leash: 8 });
  L.entity('watcher', { x: 72, z: 6, state: 'guard' });
  L.entity('crawler', { x: 118, z: 118, state: 'dormant', tag: 'bay4' });

  // ---------------------------------------------------------------- scares
  L.scare('lightBurst', { x: 60, z: 44, radius: 5 });
  L.scare('bodyFall', { x: 88, z: 66, radius: 9 });
  L.scare('shadowCross', { x: 46, z: 78, radius: 7 });
  L.scare('doorSlam', { x: 100, z: 30, radius: 7 });
  L.scare('waterStir', { x: 28, z: 112, radius: 7 });
  L.scare('footstepsFollow', { x: 74, z: 128, radius: 9 });
  L.scare('screamDistant', { x: 110, z: 88, radius: 12 });
  L.scare('crawlerDrop', { x: 124, z: 116, radius: 6 });
  L.scare('staticBurst', { x: 96, z: 140, radius: 8 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(8, 8, Math.PI * 0.25);
  L.objective('Find the fire door in the far corner of the bays.');
  L.objective('The mezzanine office has the breaker for the door lights.', { id: 'obj1' });
  L.objective('Don\'t run in the aisles. They hear it.', { optional: true });

  L.trigger({ x: mz[0] + 8, z: mz[1] + 4, radius: 4, objective: 'obj1', say: 'The breaker throws. Somewhere behind you, a row of lights comes back on.' });
  L.trigger({ x: 70, z: 70, radius: 8, say: 'Claw marks on the concrete. Waist height, four of them, a metre apart.' });
  L.trigger({ x: 120, z: 60, radius: 8, wake: 'bay4', say: 'Something in bay four just stood up.' });

  L.room(140, 68, 146, 78, { floor: 'concrete', wall: 'cinder' });
  L.prop('doubleDoor', { x: 145, z: 73, rot: Math.PI / 2 });
  L.prop('exitSign', { x: 144, z: 73 });
  L.light({ x: 143, z: 73, y: 3.4, color: 0x60ff90, intensity: 0.7, radius: 8, fixture: 'none' });
  L.exit({
    x: 145, z: 73, kind: 'door', to: 'level2', label: 'FIRE DOOR B',
    say: 'The bar gives. Behind it: stairs down, and the smell of hot metal.',
  });

  // The crack in the flooded pit. Cold cave air, and a long way down.
  L.exit({
    x: 19, z: 123, kind: 'crack', to: 'level8', hidden: true, label: 'THE CRACK',
    say: 'The concrete has split. The water is running into it, and so are you.',
  });

  return L.finish();
}
