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

  L.trigger({ x: mz[0] + 8, z: mz[1] + 4, radius: 4, objective: 'obj1', say: 'The breaker throws. Somewhere behind you, a row of lights comes back on.' });
  L.trigger({ x: 70, z: 70, radius: 8, say: 'Claw marks on the concrete. Waist height, four of them, a metre apart.' });
  L.trigger({ x: 120, z: 60, radius: 8, wake: 'bay4', say: 'Something in bay four just stood up.' });

  L.room(140, 68, 146, 78, { floor: 'concrete', wall: 'cinder' });
  L.prop('doubleDoor', { x: 145, z: 73, rot: Math.PI / 2 });
  L.prop('exitSign', { x: 144, z: 73 });
  L.light({ x: 143, z: 73, y: 3.4, color: 0x60ff90, intensity: 0.7, radius: 8, fixture: 'none' });

  // The crack in the flooded pit. Cold cave air, and a long way down.

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('noisefloor');
  L.hideSpots('crate', 10);
  L.monsterFar('clump', { tell: 'clumpWet', speed: 2.0, patience: 1.3, hearing: 1.4, wanders: 22, checksHides: 0.5 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 145, z: 73 });

  return L.finish();
}
