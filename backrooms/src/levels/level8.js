// LEVEL 8 — THE CAVES
// Wet limestone under everything else. Galleries you can stand in, squeezes you
// go through on your elbows, sumps that are full to the roof, and a growth in the
// deep galleries that is warm to the touch and does not like being touched. The
// only light down here is what you brought and a few patches of something that
// glows because it is alive.

export const meta = {
  id: 'level8',
  num: '8',
  name: 'THE CAVES',
  subtitle: 'below the below',
  tagline: 'Bring rope you don\'t have. Bring light you\'ll run out of.',
  danger: 7,
  survival: 'poor',
  chapter: 11,
  tape: 'TAPE 09',
  brief: `Limestone, cold water, and bacteria taking over the deep end. Find the
    fissure with the night air coming through it. Mind your head.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 144, h: 144, cell: 3.0, wallH: 3.2,
    palette: { wall: 'rock', floor: 'rock', ceil: 'rock' },
    fog: { color: 0x05070a, density: 0.070 },
    ambient: { color: 0x0c1014, intensity: 0.06 },
  });
  L.setAmbience({ room: 'cave', hum: 0.15, drip: 1.0, wind: 0.2, music: 'drone', reverb: 1.0 });
  L.setRules({ dark: true, cold: false, wetFeet: true, sanityDrain: 1.2, batteryDrain: 1.1 });
  L.setTint(0.92, 0.98, 1.02);

  // ---------------------------------------------------------------- the caves
  L.fill(C.WALL);
  const cave = kit.gen.caves(L, { x0: 2, z0: 2, x1: 141, z1: 141, fill: 0.42, steps: 4 });
  // The automaton leaves pockets it likes and we want the whole system walkable,
  // so bore galleries between the biggest voids until it reads as one cave.
  for (let i = 0; i < 22; i++) {
    const a = cave[Math.floor(kit.rand() * cave.length)] || [20, 20];
    const b = cave[Math.floor(kit.rand() * cave.length)] || [120, 120];
    L.corridor(a[0], a[1], b[0], b[1], kit.randInt(2, 4), C.OPEN);
  }
  L.paintWhere((c) => c === C.OPEN, { floor: 'rock', wall: 'rock', ceil: 'rock' });

  // Height varies wildly: crawl squeezes, standing galleries, one big chamber.
  const n = kit.noise(9);
  for (let z = 2; z < 142; z++) {
    for (let x = 2; x < 142; x++) {
      if (!L.isOpen(x, z)) continue;
      const v = n.fbm(x / 26, z / 26, 4);
      const h = v < -0.25 ? 1.55 : v < 0.05 ? 2.3 : v < 0.4 ? 3.2 : 5.0;
      L.ceilAt(x, z, h);
      L.floorAt(x, z, v * 0.35);
      if (kit.chance(0.18)) L.paint(x, z, { floor: 'mud' });
      if (kit.chance(0.12)) L.paint(x, z, { wall: 'moss', floor: 'moss' });
    }
  }

  // The big chamber: one place with air and echo, and a shrine somebody built.
  const [gx, gz] = cave[Math.floor(cave.length * 0.5)] || [72, 72];
  L.disc(gx, gz, 12, C.OPEN);
  for (let dz = -12; dz <= 12; dz++) {
    for (let dx = -12; dx <= 12; dx++) {
      if (Math.hypot(dx, dz) > 12) continue;
      L.ceilAt(gx + dx, gz + dz, 9.0);
      L.floorAt(gx + dx, gz + dz, 0);
    }
  }
  L.prop('shrine', { x: gx, z: gz });
  L.light({ x: gx, z: gz, y: 0.6, color: 0xffc070, intensity: 0.8, radius: 12, fixture: 'lantern', flicker: 0.25 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    L.prop('stalagmite', { x: gx + Math.cos(a) * 9, z: gz + Math.sin(a) * 9, height: kit.rand(1.2, 2.6) });
    L.prop('stalagmite', { x: gx + Math.cos(a) * 7, z: gz + Math.sin(a) * 7, height: kit.rand(1.4, 3.0), down: true, y: 8.4 });
  }

  // Sumps: cold water in the low spots, some of it over your head.
  const sumps = [];
  for (let i = 0; i < 7; i++) {
    const [x, z] = L.randomOpen();
    const r = kit.randInt(3, 7);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!L.isOpen(x + dx, z + dz) || Math.hypot(dx, dz) > r) continue;
        const deep = Math.hypot(dx, dz) < r * 0.5;
        L.set(x + dx, z + dz, deep ? C.DEEP : C.WATER);
        L.floorAt(x + dx, z + dz, deep ? -2.6 : -0.6);
        L.paint(x + dx, z + dz, { floor: 'mud' });
      }
    }
    sumps.push([x, z]);
  }
  L.waterLevel = 0;

  // ---------------------------------------------------------------- glow
  // Bioluminescence: weak, green, and the only free light in the level.
  for (let i = 0; i < 34; i++) {
    const [x, z] = L.randomOpen();
    L.light({ x, z, y: 0.4, color: 0x50ff90, intensity: 0.3, radius: 5, fixture: 'none', hum: 0 });
    L.prop('bacteriaMat', { x, z });
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('stalagmite', 120, { opts: { height: 1.2 } });
  L.scatter('boulder', 60);
  L.scatter('rubblePile', 30);
  L.scatter('fleshGrowth', 22, { where: (x, z) => x > 80 || z > 80 });
  L.scatter('bacteriaMat', 30);
  L.scatter('cocoon', 12, { where: (x, z) => x > 90 && z > 90 });
  L.scatter('skull', 10);
  L.scatter('campLight', 5);
  L.scatter('sleepingBag', 4);
  L.scatter('chalkArrow', 22);
  const at = (i, dx = 0) => {
    const c = cave[(i * 137) % cave.length] || [gx, gz];
    return [c[0] + dx, c[1]];
  };
  // ---------------------------------------------------------------- scares
  L.scare('crawlerDrop', { x: at(3, 2)[0], z: at(3, 2)[1], radius: 6 });
  L.scare('handFromCeiling', { x: at(11, 2)[0], z: at(11, 2)[1], radius: 5 });
  L.scare('waterStir', { x: sumps[1][0], z: sumps[1][1], radius: 7 });
  L.scare('breathing', { x: at(7, 2)[0], z: at(7, 2)[1], radius: 6, needsDark: true });
  L.scare('floorGiveWay', { x: at(15, 2)[0], z: at(15, 2)[1], radius: 6 });
  L.scare('screamDistant', { x: gx, z: gz - 6, radius: 14 });
  L.scare('whisper', { x: at(19, 2)[0], z: at(19, 2)[1], radius: 7, text: 'The echo comes back in a voice that isn\'t yours.' });
  L.scare('bodyFall', { x: at(21, 2)[0], z: at(21, 2)[1], radius: 9 });
  L.scare('tapeGlitch', { x: at(23, 2)[0], z: at(23, 2)[1], radius: 8 });

  // ---------------------------------------------------------------- the way out
  // The automaton hands back its void seeds in no particular order, so take the two
  // that are furthest apart: you come in at one end of the system and out the other.
  // (two passes: farthest from the middle, then farthest from that)
  let start = cave[0] || [8, 8], fissure = cave[cave.length - 1] || [136, 136];
  const farthestFrom = (p) => cave.reduce((b, c) => (
    Math.hypot(c[0] - p[0], c[1] - p[1]) > Math.hypot(b[0] - p[0], b[1] - p[1]) ? c : b
  ), cave[0] || p);
  if (cave.length) {
    start = farthestFrom([72, 72]);
    fissure = farthestFrom(start);
  }
  L.spawnAt(start[0], start[1], 0);

  L.trigger({ x: gx, z: gz, radius: 10, objective: 'obj1', say: 'Nine metres of air above you, and an echo you could set your watch by.' });
  L.trigger({ x: sumps[2][0], z: sumps[2][1], radius: 6, say: 'This sump is full to the roof. You will have to swim it, or find the way round.' });
  L.trigger({ x: fissure[0], z: fissure[1], radius: 8, say: 'Cold air, and cut grass. There is grass somewhere in front of you.' });

  L.disc(fissure[0], fissure[1], 4, C.OPEN);
  L.light({ x: fissure[0], z: fissure[1], y: 1.6, color: 0x8090c0, intensity: 0.5, radius: 8, fixture: 'none', hum: 0 });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('ceiling');
  L.hideSpots('crawl', 10);
  L.monsterFar('crawler', { tell: 'crawlerScrape', speed: 5.0, patience: 1.6, wanders: 30, checksHides: 0.65 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: fissure[0], z: fissure[1] });

  return L.finish();
}
