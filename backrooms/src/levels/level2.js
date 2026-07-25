// LEVEL 2 — PIPE DREAMS
// Service tunnels the width of your shoulders, hot pipes at head height, steam
// where the lagging failed, and eight inches of standing water the whole way.
// There is almost no light down here. What light there is, you are carrying,
// and the things in the dark are counting on you turning it off.

export const meta = {
  id: 'level2',
  num: '2',
  name: 'PIPE DREAMS',
  subtitle: 'the tunnels',
  tagline: 'Anything you can hear can hear you.',
  danger: 5,
  survival: 'poor',
  chapter: 3,
  tape: 'TAPE 03',
  brief: `Tight tunnels, hot pipes, water to your ankles, and no ceiling lights
    at all. Smilers wait in the black stretches. Keep something burning.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 132, h: 132, cell: 3.0, wallH: 2.5,
    palette: { wall: 'pipeWall', floor: 'concreteWet', ceil: 'rust' },
    fog: { color: 0x08090a, density: 0.062 },
    ambient: { color: 0x14161a, intensity: 0.07 },
  });
  L.setAmbience({ room: 'drips', hum: 0.3, drip: 0.9, wind: 0.05, music: 'dread', reverb: 0.55 });
  L.setRules({ dark: true, wetFeet: true, batteryDrain: 1.15, sanityDrain: 1.3, noiseLimit: 0.4 });
  L.setTint(0.9, 0.95, 1.02);

  // ---------------------------------------------------------------- the maze
  // A tight braid with real dead ends. You will take a wrong turn down here and
  // the wrong turn will be forty metres long.
  L.fill(C.WALL);
  kit.gen.maze(L, { x0: 2, z0: 2, x1: 129, z1: 129, braid: 0.16, rooms: 8, roomMin: 3, roomMax: 6 });

  // Ceiling heights all over the place: crouch stretches, then a plant room
  // you can stand up in and be grateful about it.
  for (let z = 2; z < 130; z++) {
    for (let x = 2; x < 130; x++) {
      if (!L.isOpen(x, z)) continue;
      const n = kit.rand();
      L.ceilAt(x, z, n < 0.22 ? 1.75 : n < 0.5 ? 2.1 : 2.5);
      if (kit.chance(0.3)) L.paint(x, z, { wall: 'rust' });
      if (kit.chance(0.2)) L.paint(x, z, { floor: 'grate' });
    }
  }

  // Standing water in the low runs.
  for (let i = 0; i < 26; i++) {
    const [x, z] = L.randomOpen();
    const r = kit.randInt(2, 5);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!L.isOpen(x + dx, z + dz) || Math.hypot(dx, dz) > r) continue;
        L.set(x + dx, z + dz, C.WATER);
        L.floorAt(x + dx, z + dz, -0.22);
      }
    }
  }
  L.waterLevel = 0;

  // Plant rooms: valve walls, transformers, and the only standing height.
  const plants = [];
  for (const [x, z] of [[16, 16], [104, 22], [22, 104], [98, 100], [60, 62]]) {
    L.room(x, z, x + 9, z + 9, { floor: 'metalPlate', wall: 'breakerWall', ceil: 'ductWall' });
    L.ceilRect(x, z, x + 9, z + 9, 4.2);
    L.prop('valveWheel', { x: x + 2, z: z + 1, rot: 0.2 });
    L.prop('valveWheel', { x: x + 7, z: z + 1, rot: -0.3 });
    L.prop('pipeCluster', { x: x + 4, z: z + 5, len: 8 });
    L.prop('breakerBox', { x: x + 8, z: z + 5, rot: -Math.PI / 2 });
    L.light({ x: x + 4, z: z + 4, y: 3.9, color: 0xffc060, intensity: 0.85, radius: 9, fixture: 'cage', flicker: 0.35 });
    plants.push([x + 4, z + 4]);
  }

  // ---------------------------------------------------------------- light
  // Twelve working bulbs in a level of four thousand cells. That's the level.
  for (let i = 0; i < 12; i++) {
    const [x, z] = L.randomOpen();
    L.light({ x, z, color: 0xffd8a0, intensity: 0.55, radius: 6, fixture: 'bulb', flicker: kit.rand(0.2, 0.9) });
  }
  for (let i = 0; i < 26; i++) {
    const [x, z] = L.randomOpen();
    L.light({ x, z, color: 0xff5a3a, intensity: 0.22, radius: 4, fixture: 'emergencyLight', flicker: 0.15, hum: 0.2 });
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('pipeRun', 90, { opts: { len: 6, height: 1.9 } });
  L.scatter('pipeCluster', 40);
  L.scatter('valveWheel', 24);
  L.scatter('vent', 30);
  L.scatter('drainGrate', 24);
  L.scatter('bacteriaMat', 22, { where: (x, z, c) => c === C.WATER });
  L.scatter('fleshGrowth', 10, { where: (x, z) => x > 70 && z > 70 });
  L.scatter('graffiti', 22);
  L.scatter('skull', 5, { where: (x, z) => x > 60 });
  L.scatter('rubblePile', 12);
  // ---------------------------------------------------------------- scares
  L.scare('breathing', { x: 34, z: 60, radius: 5, needsDark: true });
  L.scare('crawlerDrop', { x: 62, z: 44, radius: 5 });
  L.scare('handFromCeiling', { x: 88, z: 52, radius: 5 });
  L.scare('whisper', { x: 44, z: 92, radius: 6, text: 'Something in the dark asks, politely, for the light.' });
  L.scare('lightsOut', { x: 74, z: 96, radius: 6 });
  L.scare('waterStir', { x: 100, z: 68, radius: 6 });
  L.scare('tapeGlitch', { x: 28, z: 30, radius: 7 });
  L.scare('footstepsFollow', { x: 112, z: 112, radius: 8 });
  L.scare('bodyFall', { x: 58, z: 78, radius: 8 });
  L.scare('nameOnWall', { x: 120, z: 96, radius: 5 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(4, 4, 0);

  L.trigger({ x: plants[0][0], z: plants[0][1], radius: 4, objective: 'obj1', say: 'Glowsticks. Four of them, still good.' });
  L.trigger({ x: 66, z: 66, radius: 6, say: 'The pipes here are hot enough to hurt. Follow them.' });
  L.trigger({ x: 122, z: 120, radius: 6, say: 'Concrete steps. Going up, which is new.' });

  L.room(120, 118, 128, 128, { floor: 'metalPlate', wall: 'cinder', ceil: 'concrete' });
  L.ceilRect(120, 118, 128, 128, 4.6);
  L.prop('stairFlight', { x: 124, z: 124, height: 2.4, steps: 8 });
  L.prop('doorFrame', { x: 124, z: 127 });
  L.light({ x: 124, z: 122, y: 4.2, color: 0xd8e8ff, intensity: 0.9, radius: 10, fixture: 'tube', flicker: 0.1 });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('steam');
  L.hideSpots('crawl', 10);
  L.monsterFar('smiler', { tell: 'smilerHum', speed: 5.2, patience: 1.6, wanders: 16, checksHides: 0.7 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 124, z: 127 });

  return L.finish();
}
