// LEVEL 52 — THE HOSPITAL
// Green tile to shoulder height and cream paint above it, gurneys parked in the
// corridors as though a shift had just been called away, curtain bays, an
// operating suite with the lamp still on. There is a nurse. She walks at exactly
// your walking pace, she carries her own light, and she has been on shift for a
// very long time.

export const meta = {
  id: 'level52',
  num: '52',
  name: 'THE HOSPITAL',
  subtitle: 'ward block C',
  tagline: 'She is slower than you. She does not need to be faster.',
  danger: 8,
  survival: 'very poor',
  chapter: 16,
  tape: 'TAPE 14',
  brief: `Wards, theatres, a flooded basement ward and a morgue. Find the ward
    keycard and get out through the west doors. Keep moving, always.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 146, h: 146, cell: 3.1, wallH: 3.2,
    palette: { wall: 'tileHospital', floor: 'tileHospitalFloor', ceil: 'ceilTile' },
    fog: { color: 0x0c1210, density: 0.034 },
    ambient: { color: 0x1c2622, intensity: 0.16 },
  });
  L.setAmbience({ room: 'hospital', hum: 0.45, drip: 0.25, wind: 0, music: 'choir', reverb: 0.5 });
  L.setRules({ sanityDrain: 1.3 });
  L.setTint(0.96, 1.04, 0.98);

  // ---------------------------------------------------------------- the spine
  // Long straight corridors, because you need to be able to see her coming and
  // not be able to do anything about it.
  L.fill(C.WALL);
  for (const z of [24, 60, 96, 132]) L.rect(4, z, 141, z + 2, C.OPEN);
  for (const x of [24, 72, 120]) L.rect(x, 4, x + 2, 141, C.OPEN);

  // Wards off the corridors: six-bed bays with curtains.
  const wards = [];
  for (const [x, z] of [[8, 6], [40, 6], [88, 6], [8, 42], [40, 42], [88, 42],
    [8, 78], [40, 78], [88, 78], [8, 114], [40, 114], [88, 114]]) {
    const w = 26, h = 14;
    L.room(x, z, x + w, z + h, { floor: 'tileHospitalFloor', wall: 'tileHospital' });
    L.set(x + 12, z + h, C.DOOR);
    // and a stub through to the nearest corridor, so the ward is actually a ward
    // and not a sealed box with a door painted on it
    const spine = [24, 60, 96, 132].reduce((a, b) => (Math.abs(b - (z + h)) < Math.abs(a - (z + h)) ? b : a));
    L.corridor(x + 12, z + h, x + 12, spine + 1, 2, C.OPEN);
    wards.push([x + 13, z + 7]);
    for (let i = 0; i < 6; i++) {
      const bx = x + 3 + (i % 3) * 9, bz = z + 3 + Math.floor(i / 3) * 8;
      L.prop('gurney', { x: bx, z: bz, rot: 0 });
      if (kit.chance(0.6)) L.prop('ivStand', { x: bx + 1.4, z: bz - 0.6 });
      if (kit.chance(0.3)) L.prop('wheelchair', { x: bx - 1.6, z: bz + 1.4, rot: kit.rand(0, 6) });
      if (kit.chance(0.5)) {
        for (let k = 0; k < 4; k++) L.set(bx - 2 + k, bz - 2, C.HALF);   // curtain rail
        L.paintRect(bx - 2, bz - 2, bx + 1, bz - 2, { wall: 'curtain' });
      }
    }
    L.light({
      x: x + 13, z: z + 7, y: 3.1, color: 0xe8f4e8, intensity: 0.95, radius: 14,
      fixture: 'panel', flicker: kit.chance(0.4) ? kit.rand(0.2, 0.8) : 0, dead: kit.chance(0.12),
    });
  }

  // Theatre suite: scrub room, two theatres, and a lamp that is still on.
  const tx = 100, tz = 100;
  L.room(tx, tz, tx + 30, tz + 30, { floor: 'linoleum', wall: 'tileHospital', ceil: 'ceilPanel' });
  L.set(tx - 1, tz + 15, C.DOOR);
  L.ceilRect(tx, tz, tx + 30, tz + 30, 4.0);
  for (const [ox, oz] of [[tx + 8, tz + 8], [tx + 22, tz + 22]]) {
    L.prop('gurney', { x: ox, z: oz, rot: Math.PI / 2 });
    L.prop('ivStand', { x: ox + 2, z: oz + 2 });
    L.prop('trolley', { x: ox - 2, z: oz + 2, rot: 0.4 });
    L.light({ x: ox, z: oz, y: 3.4, color: 0xffffff, intensity: 1.8, radius: 12, fixture: 'flood', flicker: 0.05 });
  }
  L.prop('sink', { x: tx + 2, z: tz + 28, rot: Math.PI });
  L.prop('mirrorPanel', { x: tx + 2, z: tz + 29, rot: Math.PI });

  // The morgue, and nobody should be surprised that the drawers are open.
  const mx = 8, mz = 8;
  L.room(mx + 100, mz + 128, mx + 128, mz + 136, { floor: 'concrete', wall: 'tileHospital' });
  L.set(mx + 114, mz + 137, C.DOOR);
  for (let i = 0; i < 8; i++) L.prop('bodyBag', { x: mx + 104 + i * 3, z: mz + 132, rot: 0 });
  L.light({ x: mx + 114, z: mz + 132, y: 3.1, color: 0xbfd8e8, intensity: 0.7, radius: 12, fixture: 'tube', flicker: 0.3 });

  // Flooded basement ward: shin-deep, and the growth likes it.
  L.room(6, 6, 20, 20, { floor: 'tileHospitalFloor', wall: 'tileHospital' });
  for (let z = 7; z < 20; z++) {
    for (let x = 7; x < 20; x++) {
      L.set(x, z, C.WATER);
      L.floorAt(x, z, -0.4);
      L.paint(x, z, { floor: 'mud' });
    }
  }
  L.waterLevel = 0;
  L.scatter('bacteriaMat', 10, { where: (x, z) => x > 6 && x < 20 && z > 6 && z < 20 });

  // The red wing: emergency lighting only, and she starts her round here.
  L.paintRect(120, 4, 141, 60, { wall: 'tileHospital', ceil: 'ceilTile' });
  for (let z = 8; z < 58; z += 8) {
    L.light({ x: 121, z, y: 3.1, color: 0xff3428, intensity: 0.6, radius: 9, fixture: 'emergencyLight', flicker: 0.25 });
  }

  // ---------------------------------------------------------------- lights
  for (const z of [25, 61, 97, 133]) {
    for (let x = 8; x < 140; x += 8) {
      const dead = kit.chance(0.18);
      L.light({
        x, z, y: 3.1, color: 0xe8f4e8, intensity: dead ? 0 : 0.9, radius: 11,
        fixture: 'panel', dead, flicker: kit.chance(0.3) ? kit.rand(0.2, 0.9) : 0,
      });
    }
  }
  for (const x of [25, 73, 121]) {
    for (let z = 8; z < 140; z += 10) {
      L.light({ x, z, y: 3.1, color: 0xdff0e8, intensity: 0.8, radius: 10, fixture: 'tube', flicker: kit.rand(0, 0.5) });
    }
  }

  // Ward tubes throughout: a hospital corridor is lit even when nobody has walked it
  // in years, and the ones that have given up matter more when the rest work.
  L.lightGrid(5, 5, 133, 133, {
    every: 6, color: 0xdfeee4, intensity: 0.8, radius: 12, fixture: 'tube',
    flickerChance: 0.34, deadChance: 0.16, brokenChance: 0.06,
  });

  // ---------------------------------------------------------------- dressing
  L.scatter('gurney', 36);
  L.scatter('ivStand', 30);
  L.scatter('wheelchair', 18);
  L.scatter('trolley', 24);
  L.scatter('filingCabinet', 16);
  L.scatter('corkboard', 14);
  L.scatter('clock', 12);
  L.scatter('trashcan', 20);
  L.scatter('mopBucket', 10);
  L.scatter('wetFloorSign', 12);
  L.scatter('bloodTrail', 14);
  L.scatter('clawMarks', 8);
  L.scatter('graffiti', 10);
  // ---------------------------------------------------------------- scares
  L.scare('faceInHall', { x: 60, z: 25, radius: 8 });
  L.scare('doorSlam', { x: 40, z: 60, radius: 7 });
  L.scare('phoneRing', { x: 96, z: 97, radius: 8 });
  L.scare('mirrorFigure', { x: tx + 2, z: tz + 27, radius: 5 });
  L.scare('handFromCeiling', { x: 30, z: 110, radius: 5 });
  L.scare('crawlerDrop', { x: 100, z: 118, radius: 6 });
  L.scare('waterStir', { x: 14, z: 14, radius: 6 });
  L.scare('breathing', { x: 118, z: 40, radius: 6 });
  L.scare('screamDistant', { x: 70, z: 130, radius: 14 });
  L.scare('lightsOut', { x: 120, z: 20, radius: 12 });
  L.scare('bodyFall', { x: 112, z: 132, radius: 9 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(141, 25, Math.PI);

  L.trigger({ x: tx + 4, z: tz + 26, radius: 4, objective: 'obj1', say: 'A ward keycard, and a lamp above the table that is still on.' });
  L.trigger({ x: 73, z: 61, radius: 6, say: 'Heels on tile, a long way off, keeping perfect time.' });
  L.trigger({ x: 8, z: 61, radius: 6, say: 'The west doors. Wired glass, a badge reader, and daylight-coloured light beyond them.' });

  L.room(4, 56, 10, 66, { floor: 'linoleum', wall: 'drywall' });
  L.prop('doubleDoor', { x: 5, z: 61, rot: Math.PI / 2 });
  L.prop('exitSign', { x: 6, z: 61 });
  L.light({ x: 7, z: 61, y: 3.1, color: 0x60ff90, intensity: 0.7, radius: 8, fixture: 'none' });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('flicker');
  L.hideSpots('gurney', 10);
  L.monsterFar('nurse', { tell: 'nurseHeels', speed: 2.5, patience: 4.0, hearing: 1.4, wanders: 60, checksHides: 0.75 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 5, z: 61 });

  return L.finish();
}
