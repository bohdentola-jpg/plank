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
  L.scatter('tapePile', 3);
  L.scatter('chalkArrow', 22);

  // ---------------------------------------------------------------- pickups
  const at = (i, dx = 0) => {
    const c = cave[(i * 137) % cave.length] || [gx, gz];
    return [c[0] + dx, c[1]];
  };
  L.item('battery', { x: at(1)[0], z: at(1)[1], amount: 2 });
  L.item('battery', { x: at(5)[0], z: at(5)[1] });
  L.item('glowstick', { x: gx + 2, z: gz + 2, amount: 5 });
  L.item('flare', { x: at(9)[0], z: at(9)[1], amount: 2 });
  L.item('almondWater', { x: at(13)[0], z: at(13)[1] });
  L.item('medkit', { x: at(17)[0], z: at(17)[1] });
  L.item('tape', { x: gx - 2, z: gz + 3, id: 'tape-caves', title: 'TAPE — "THE SHRINE"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: gx + 1, z: gz + 1, title: 'AT THE SHRINE, ON A FLAT STONE',
    text: `Whoever stacked these candles: the ones down here don't come into the
      big chamber. Not because of the light. Because of the echo — you can hear
      something crossing the floor from thirty metres away, and they know it, and
      they'd rather wait in the squeezes where you can't.`,
  });
  L.note({
    x: at(1, 1)[0], z: at(1, 1)[1], title: 'CAVING NOTEBOOK, SOAKED',
    text: `Survey day 6. The passages don't hold their shape between visits. I have
      resurveyed the same gallery three times and got three different lengths, all
      longer than the time before. The compass is fine. I checked it against
      itself, which I understand is not a check.`,
  });
  L.note({
    x: at(5, 1)[0], z: at(5, 1)[1], title: 'SCRATCHED BESIDE A SQUEEZE',
    text: `The low bits are where they live. Go through on your side with the light
      out in front of your hand, not behind it, so you see the eyes before you put
      your hand on them. Yes: before.`,
  });
  L.note({
    x: at(9, 1)[0], z: at(9, 1)[1], title: 'TAPED TO A LAMP, LENS SMASHED',
    text: `The growth in the deep galleries is warm. It is 34 degrees, which is not
      a temperature rock does. It flinched when I touched it. I have not gone back
      that way and I do not recommend it.`,
  });
  L.note({
    x: at(13, 1)[0], z: at(13, 1)[1], title: 'CHALK ON A BOULDER',
    text: `FISSURE: FOLLOW THE DRAUGHT, NOT THE ARROWS.
      SOMEBODY HAS BEEN MOVING THE ARROWS.`,
  });

  // ---------------------------------------------------------------- company
  L.pack('crawler', 6, at(3)[0], at(3)[1], 12, { state: 'patrol', leash: 26 });
  L.pack('crawler', 5, at(11)[0], at(11)[1], 12, { state: 'patrol', leash: 26 });
  L.pack('bacteria', 8, at(19)[0], at(19)[1], 14, { state: 'guard' });
  L.pack('bacteria', 6, at(23)[0], at(23)[1], 12, { state: 'guard' });
  L.entity('clump', { x: at(7)[0], z: at(7)[1], state: 'patrol', leash: 8 });
  L.entity('clump', { x: at(21)[0], z: at(21)[1], state: 'dormant', wake: { after: 120 } });
  L.pack('deathmoth', 5, gx, gz + 4, 8, { state: 'patrol', leash: 14 });
  L.entity('wretch', { x: sumps[0][0], z: sumps[0][1], state: 'patrol', leash: 10 });
  L.entity('wretch', { x: sumps[3][0], z: sumps[3][1], state: 'patrol', leash: 10 });
  L.entity('howler', { x: at(15)[0], z: at(15)[1], state: 'patrol', leash: 16 });

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
  const start = cave[0] || [8, 8];
  const fissure = cave[cave.length - 1] || [136, 136];
  L.spawnAt(start[0], start[1], 0);
  L.objective('Find the fissure with night air coming through it.');
  L.objective('Get through the big chamber — it is the only place you can hear anything coming.', { id: 'obj1' });
  L.objective('Don\'t touch the warm growth.', { optional: true });

  L.trigger({ x: gx, z: gz, radius: 10, objective: 'obj1', say: 'Nine metres of air above you, and an echo you could set your watch by.' });
  L.trigger({ x: sumps[2][0], z: sumps[2][1], radius: 6, say: 'This sump is full to the roof. You will have to swim it, or find the way round.' });
  L.trigger({ x: fissure[0], z: fissure[1], radius: 8, say: 'Cold air, and cut grass. There is grass somewhere in front of you.' });

  L.disc(fissure[0], fissure[1], 4, C.OPEN);
  L.light({ x: fissure[0], z: fissure[1], y: 1.6, color: 0x8090c0, intensity: 0.5, radius: 8, fixture: 'none', hum: 0 });
  L.exit({
    x: fissure[0], z: fissure[1], kind: 'crack', to: 'level9', label: 'THE FISSURE',
    say: 'You come out through wet stone into a smell of cut grass, under a sky with the wrong stars in it.',
  });

  return L.finish();
}
