// LEVEL 11 — THE ENDLESS CITY
// Fog-blind city blocks with sodium light, wet asphalt, parked cars nobody is
// coming back for, and shopfront glass with things standing in it. The fog has a
// ceiling about six storeys up and no sky above that. Traffic noise, no traffic.

export const meta = {
  id: 'level11',
  num: '11',
  name: 'THE ENDLESS CITY',
  subtitle: 'downtown, some year',
  tagline: 'The mannequins are in a different window every block.',
  danger: 6,
  survival: 'fair',
  chapter: 14,
  tape: 'TAPE 12',
  brief: `City blocks in fog. Cross town to the parking ramp on the far side.
    Anything in glass is watching, and some of it isn't in the glass any more.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 158, h: 158, cell: 3.4, wallH: 18,
    openSky: true,
    sky: { top: 0x20242c, bottom: 0x3a3e46, stars: false },
    palette: { wall: 'brick', floor: 'asphalt', ceil: 'void' },
    fog: { color: 0x2a2e34, density: 0.040 },
    ambient: { color: 0x2c3038, intensity: 0.2, sky: 0x3a4048 },
  });
  L.setAmbience({ room: 'rain', hum: 0.2, drip: 0.4, wind: 0.35, music: 'drone', reverb: 0.55 });
  L.setRules({ sanityDrain: 1.15, wetFeet: false });
  L.setTint(1.0, 0.98, 0.94);

  // ---------------------------------------------------------------- the blocks
  L.fill(C.OPEN);
  const blocks = kit.gen.blocks(L, {
    x0: 2, z0: 2, x1: 155, z1: 155, bw: 18, bh: 18, street: 7, jitter: true,
    paint: { floor: 'sidewalk' },
  });
  L.paintWhere((c) => c === C.OPEN, { floor: 'asphalt' });
  for (const [x0, z0, x1, z1] of blocks) {
    L.paintRect(x0 - 1, z0 - 1, x1 + 1, z1 + 1, { wall: kit.pick(['brick', 'concretePaint', 'cinder']) });
    // pavement ring
    for (let z = z0 - 2; z <= z1 + 2; z++) {
      for (let x = x0 - 2; x <= x1 + 2; x++) if (L.isOpen(x, z)) L.paint(x, z, { floor: 'sidewalk' });
    }
    // shopfronts: glass at street level on one side of each block
    const side = kit.randInt(0, 3);
    const glassRun = (fx, fz, dx, dz, n) => {
      for (let i = 0; i < n; i++) {
        const gx = fx + dx * i, gz = fz + dz * i;
        if (kit.chance(0.25)) continue;
        L.set(gx, gz, C.GLASS);
        L.paint(gx, gz, { wall: 'glass' });
        if (kit.chance(0.3)) L.prop('mannequinProp', { x: gx - dz * 0.6, z: gz - dx * 0.6, rot: kit.rand(0, 6) });
      }
    };
    if (side === 0) glassRun(x0, z0 - 1, 1, 0, x1 - x0);
    if (side === 1) glassRun(x0, z1 + 1, 1, 0, x1 - x0);
    if (side === 2) glassRun(x0 - 1, z0, 0, 1, z1 - z0);
    if (side === 3) glassRun(x1 + 1, z0, 0, 1, z1 - z0);
  }

  // ---------------------------------------------------------------- plaza
  const px = 78, pz = 78;
  L.rect(px - 12, pz - 12, px + 12, pz + 12, C.OPEN);
  L.paintRect(px - 12, pz - 12, px + 12, pz + 12, { floor: 'marble' });
  L.prop('fountain', { x: px, z: pz });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    L.prop('streetlight', { x: px + Math.cos(a) * 10, z: pz + Math.sin(a) * 10 });
    L.light({ x: px + Math.cos(a) * 10, z: pz + Math.sin(a) * 10, y: 7.4, color: 0xffb058, intensity: 1.0, radius: 14, fixture: 'none' });
  }
  L.prop('busShelter', { x: px - 10, z: pz + 12, rot: 0 });

  // ---------------------------------------------------------------- underpass
  // A stretch with a ceiling, which after an hour of fog is a relief and a mistake.
  for (let x = 20; x < 60; x++) {
    for (let z = 118; z < 124; z++) {
      L.set(x, z, C.OPEN);
      L.ceilAt(x, z, 4.2);
      L.paint(x, z, { floor: 'asphalt', wall: 'concretePaint', ceil: 'concrete' });
    }
  }
  for (let x = 22; x < 60; x += 8) {
    L.light({ x, z: 121, y: 4.0, color: 0xff9840, intensity: 0.8, radius: 9, fixture: 'tube', flicker: kit.rand(0.1, 0.7) });
  }
  L.scatter('graffiti', 20, { where: (x, z) => x > 20 && x < 60 && z > 117 && z < 125 });

  // ---------------------------------------------------------------- streets
  for (let z = 8; z < 152; z += 12) {
    for (let x = 8; x < 152; x += 12) {
      if (!L.isOpen(x, z)) continue;
      const dead = kit.chance(0.22);
      L.prop('streetlight', { x, z });
      L.light({ x, z: z + 1, y: 7.4, color: 0xffa848, intensity: dead ? 0 : 1.05, radius: 15, fixture: 'none', dead, flicker: kit.chance(0.18) ? 0.4 : 0 });
    }
  }
  L.scatter('car', 46, { where: (x, z, c) => c === C.OPEN });
  L.scatter('carWreck', 8);
  L.scatter('phoneBooth', 10);
  L.scatter('busShelter', 6);
  L.scatter('dumpster', 16);
  L.scatter('trafficCone', 22);
  L.scatter('shoppingCart', 14);
  L.scatter('signpost', 18);
  L.scatter('deadTree', 20);
  L.scatter('graffiti', 24);
  L.scatter('rubblePile', 14);
  for (let i = 0; i < 10; i++) {
    const b = blocks[(i * 3) % blocks.length];
    if (!b) break;
  }

  // ---------------------------------------------------------------- scares
  L.scare('facePressWindow', { x: 60, z: 40, radius: 6 });
  L.scare('mirrorFigure', { x: 100, z: 100, radius: 6 });
  L.scare('phoneRing', { x: 30, z: 100, radius: 8 });
  L.scare('shadowCross', { x: px, z: pz + 14, radius: 8 });
  L.scare('crawlerDrop', { x: 44, z: 121, radius: 6 });
  L.scare('footstepsFollow', { x: 120, z: 60, radius: 9 });
  L.scare('crowdLaugh', { x: 140, z: 140, radius: 10 });
  L.scare('lightsOut', { x: 70, z: 130, radius: 12 });
  L.scare('screamDistant', { x: 26, z: 70, radius: 14 });
  L.scare('nameOnWall', { x: 90, z: 20, radius: 6 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(6, 78, 0);

  L.trigger({ x: px, z: pz, radius: 10, objective: 'obj1', say: 'The fountain is running. There is nowhere for the water to come from.' });
  L.trigger({ x: 40, z: 121, radius: 6, say: 'A ceiling. After all that fog, a ceiling, and it is a relief, and it should not be.' });
  L.trigger({ x: 148, z: 100, radius: 8, say: 'A ramp, going down, with painted arrows and a height bar.' });

  L.room(146, 92, 154, 108, { floor: 'concrete', wall: 'concretePaint' });
  L.ramp(150, 94, 150, 106, 0, -2.4, { width: 4 });
  L.prop('trafficCone', { x: 150, z: 96 });
  L.light({ x: 150, z: 100, y: 4, color: 0xffa040, intensity: 0.9, radius: 12, fixture: 'tube', flicker: 0.3 });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('fogbank');
  L.hideSpots('car', 10);
  L.monsterFar('mannequin', { tell: 'none', speed: 7.0, patience: 2.4, wanders: 50, checksHides: 0.3 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 150, z: 106 });

  return L.finish();
}
