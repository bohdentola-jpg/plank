// LEVEL 5 — TERROR HOTEL
// A grand hotel that has been running for a very long time without any guests
// and without ever once closing. Patterned carpet, brass numbers, a ballroom with
// a chandelier that is still lit, a kitchen where something is still cooking. The
// party you can hear is on the third floor, and everyone at it is delighted you
// came.

export const meta = {
  id: 'level5',
  num: '5',
  name: 'TERROR HOTEL',
  subtitle: 'no vacancies',
  tagline: 'The staff are attentive. That is the problem.',
  danger: 6,
  survival: 'poor',
  chapter: 7,
  tape: 'TAPE 06B',
  brief: `Guest corridors, a ballroom, a kitchen, a front desk with somebody
    behind it. Find a room key, take the service stairs down, and do not accept
    an invitation.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 140, h: 140, cell: 3.1, wallH: 3.4,
    palette: { wall: 'wallpaperHotel', floor: 'carpetHotel', ceil: 'ceilTile' },
    fog: { color: 0x1a0e10, density: 0.032 },
    // A hotel with the house lights still on a timer somewhere: dim, warm, and never
    // so dark that you cannot see which end of the corridor you are at.
    ambient: { color: 0x30181c, intensity: 0.30 },
  });
  L.setAmbience({ room: 'crowd', hum: 0.3, drip: 0.05, wind: 0, music: 'muzak', reverb: 0.6 });
  L.setRules({ noiseLimit: 0.6, sanityDrain: 1.1 });
  L.setTint(1.05, 0.95, 0.95);

  // ---------------------------------------------------------------- guest wings
  // Long straight corridors with identical doors, because that is the horror.
  L.fill(C.WALL);
  const corridorsZ = [20, 40, 60, 80, 100, 120];
  for (const z of corridorsZ) {
    L.rect(6, z, 134, z + 2, C.OPEN);
    for (let x = 8; x < 132; x += 6) {
      // a guest room either side, most of them locked forever
      for (const dir of [-1, 1]) {
        const rz = dir < 0 ? z - 8 : z + 3;
        L.room(x, rz, x + 4, rz + 7, { floor: 'woodFloor', wall: 'wallpaperHotel' });
        L.set(x + 2, dir < 0 ? z - 1 : z + 3, C.DOOR);
        L.prop('bed', { x: x + 2, z: rz + 3, rot: dir < 0 ? 0 : Math.PI });
        if (kit.chance(0.5)) L.prop('sideTable', { x: x + 3.4, z: rz + 1.4 });
        if (kit.chance(0.35)) L.prop('picture', { x: x + 2, z: rz + 0.6 });
        if (kit.chance(0.25)) L.prop('armchair', { x: x + 1, z: rz + 6, rot: kit.rand(0, 6) });
      }
    }
  }
  // two cross corridors and the service stair core
  for (const x of [20, 118]) L.rect(x, 12, x + 2, 130, C.OPEN);
  L.paintWhere((c) => c === C.OPEN, { floor: 'carpetHotel' });

  // ---------------------------------------------------------------- ballroom
  const bx = 52, bz = 52;
  L.room(bx, bz, bx + 34, bz + 30, { floor: 'woodFloor', wall: 'woodPanel', ceil: 'ceilPanel' });
  L.ceilRect(bx, bz, bx + 34, bz + 30, 8.2);
  L.set(bx + 17, bz + 31, C.DOOR);
  L.set(bx + 17, bz - 1, C.DOOR);
  L.prop('chandelier', { x: bx + 17, z: bz + 15, y: 8.0 });
  L.light({ x: bx + 17, z: bz + 15, y: 7.4, color: 0xffe0a0, intensity: 2.0, radius: 30, fixture: 'none', flicker: 0.06 });
  for (let i = 0; i < 10; i++) {
    L.prop('diningTable', { x: bx + 5 + (i % 5) * 6, z: bz + 6 + Math.floor(i / 5) * 16, rot: 0 });
    L.prop('chair', { x: bx + 5 + (i % 5) * 6, z: bz + 8 + Math.floor(i / 5) * 16, rot: kit.rand(0, 6) });
  }
  for (let i = 0; i < 6; i++) L.prop('pottedPalm', { x: bx + 2 + i * 6, z: bz + 1 });

  // ---------------------------------------------------------------- lobby
  L.room(8, 8, 44, 26, { floor: 'marble', wall: 'woodPanel', ceil: 'ceilPanel' });
  L.ceilRect(8, 8, 44, 26, 6.4);
  L.prop('desk', { x: 30, z: 12, rot: Math.PI });
  L.prop('desk', { x: 33, z: 12, rot: Math.PI });
  L.prop('clock', { x: 31, z: 9 });
  L.prop('sofa', { x: 14, z: 22, rot: 0 });
  L.prop('armchair', { x: 20, z: 22, rot: -0.4 });
  L.prop('pottedPalm', { x: 11, z: 10 });
  L.prop('payphone', { x: 43, z: 20, rot: -Math.PI / 2 });
  L.light({ x: 26, z: 17, y: 6.0, color: 0xffd8a0, intensity: 1.6, radius: 24, fixture: 'chandelier' });

  // ---------------------------------------------------------------- kitchen
  L.room(96, 96, 128, 124, { floor: 'linoleum', wall: 'tileHospital', ceil: 'ductWall' });
  L.set(95, 108, C.DOOR);
  for (let i = 0; i < 8; i++) L.prop('table', { x: 100 + (i % 4) * 6, z: 100 + Math.floor(i / 4) * 10 });
  L.scatter('shelf', 8, { where: (x, z) => x > 96 && x < 128 && z > 96 && z < 124 });
  L.prop('sink', { x: 126, z: 100, rot: -Math.PI / 2 });
  L.light({ x: 112, z: 110, y: 3.3, color: 0xf0f4e0, intensity: 1.1, radius: 16, fixture: 'tube', flicker: 0.3 });

  // ---------------------------------------------------------------- room 302
  // Where the party is. Left unlocked, which should tell you something.
  L.room(60, 118, 68, 128, { floor: 'woodFloor', wall: 'wallpaperParty', ceil: 'ceilTile' });
  L.set(64, 117, C.DOOR);
  L.prop('balloonCluster', { x: 62, z: 124 });
  L.prop('partyTable', { x: 65, z: 124, rot: 0.3 });
  L.prop('cake', { x: 65, z: 124, y: 0.8 });
  L.prop('streamers', { x: 64, z: 121, height: 3.3 });
  L.light({ x: 64, z: 123, y: 3.2, color: 0xffb0c8, intensity: 1.2, radius: 12, fixture: 'bulb', flicker: 0.12 });

  // ---------------------------------------------------------------- light
  // Sconces down every corridor, close enough together that the dark patches between
  // them read as gaps rather than as the whole floor.
  for (const z of corridorsZ) {
    for (let x = 8; x < 134; x += 6) {
      L.light({
        x, z: z + 1, y: 3.2, color: 0xffc890, intensity: 0.95, radius: 12,
        fixture: 'lamp', flicker: kit.chance(0.28) ? kit.rand(0.2, 0.8) : 0, dead: kit.chance(0.1),
      });
    }
  }
  for (const x of [21, 119]) {
    for (let z = 16; z < 130; z += 12) {
      L.light({ x, z, y: 3.2, color: 0xffb878, intensity: 0.7, radius: 10, fixture: 'bulb', flicker: kit.rand(0, 0.4) });
    }
  }
  // And a fitting in every guest room, a quarter of them dead. A hotel has a light in
  // each room whether anybody is using it or not.
  L.lightGrid(6, 6, 133, 133, {
    every: 7, color: 0xffc890, intensity: 0.6, radius: 11, fixture: 'bulb',
    flickerChance: 0.3, deadChance: 0.24, brokenChance: 0.06,
  });

  // ---------------------------------------------------------------- dressing
  L.scatter('trolley', 16);
  L.scatter('picture', 40);
  L.scatter('plant', 22);
  L.scatter('rug', 18);
  L.scatter('mirrorPanel', 10);
  L.scatter('lockers', 6, { where: (x, z) => x > 90 && z > 90 });
  L.scatter('graffiti', 8);
  L.scatter('partyHatPile', 8);
  L.scatter('streamers', 12, { opts: { height: 3.3 } });
  L.scatter('bodyBag', 3, { where: (x, z) => x > 96 && z > 96 });
  // ---------------------------------------------------------------- scares
  L.scare('crowdLaugh', { x: 64, z: 110, radius: 10 });
  L.scare('doorSlam', { x: 40, z: 40, radius: 7 });
  L.scare('faceInHall', { x: 100, z: 60, radius: 8 });
  L.scare('mirrorFigure', { x: 22, z: 80, radius: 5 });
  L.scare('phoneRing', { x: 43, z: 20, radius: 6 });
  L.scare('footstepsFollow', { x: 80, z: 100, radius: 9 });
  L.scare('breathing', { x: 118, z: 100, radius: 6 });
  L.scare('lightsOut', { x: 70, z: 20, radius: 9 });
  L.scare('bodyFall', { x: 30, z: 118, radius: 9 });
  L.scare('nameOnWall', { x: 126, z: 60, radius: 6 });
  L.scare('whisper', { x: 60, z: 80, radius: 7, text: 'Somebody upstairs is saying your name to somebody else.' });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(12, 14, 0);

  L.trigger({ x: 31, z: 13, radius: 4, objective: 'obj1', say: 'A brass fob with no number on it. The clerk does not look up.' });
  L.trigger({ x: bx + 17, z: bz + 15, radius: 8, say: 'The chandelier is on. The floor has been polished this week.' });
  L.trigger({ x: 64, z: 116, radius: 5, wake: 'party', say: 'Music through the door of 302. And a lot of people, laughing at once.' });

  L.room(126, 126, 136, 136, { floor: 'concrete', wall: 'cinder', ceil: 'concrete' });
  L.corridor(120, 130, 126, 131, 2);
  L.prop('stairFlight', { x: 131, z: 131, height: 2.4, steps: 8 });
  L.prop('exitSign', { x: 130, z: 128 });
  L.light({ x: 130, z: 129, y: 3.2, color: 0x60ff90, intensity: 0.6, radius: 8, fixture: 'none' });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('mirrors');
  L.hideSpots('curtain', 10);
  L.monsterFar('partygoer', { tell: 'partyGiggle', speed: 5.6, patience: 1.2, hearing: 1.5, wanders: 30, checksHides: 0.6 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 131, z: 131 });

  return L.finish();
}
