// LEVEL 10 — THE FIELD
// Wheat over your head, a sky that is too blue, no sun anywhere in it, and no
// birds. Mown paths and irrigation ditches are the only way to navigate, because
// standing in the crop you can see about four metres in any direction. It is warm
// and it is pleasant and it goes on for as long as you do.

export const meta = {
  id: 'level10',
  num: '10',
  name: 'THE FIELD',
  subtitle: 'blue skies',
  tagline: 'Nothing bad happens here for a long time.',
  danger: 4,
  survival: 'good',
  chapter: 13,
  tape: 'TAPE 11',
  brief: `Wheat to the horizon under a sky with no sun. Follow the mown paths to
    the grain silo and go down it. Watch the ridge line.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 160, h: 160, cell: 3.4, wallH: 9,
    openSky: true,
    sky: { top: 0x4a8ad8, bottom: 0xbfe0f4, stars: false },
    palette: { wall: 'wheat', floor: 'dirt', ceil: 'void' },
    fog: { color: 0xc8d8e8, density: 0.014 },
    ambient: { color: 0x8090a0, intensity: 0.5, sky: 0xd8ecff },
  });
  L.setAmbience({ room: 'wind', hum: 0.05, drip: 0, wind: 0.8, music: 'calm', reverb: 0.2 });
  L.setRules({ sanityDrain: 0.7, batteryDrain: 0.85 });
  L.setTint(1.02, 1.0, 0.96);

  // ---------------------------------------------------------------- the crop
  // Wheat is HALF: it blocks you and hides you, and you can just see over it.
  L.fill(C.HALF);
  L.paintAll({ wall: 'wheat', floor: 'dirt', ceil: 'void' });

  // Mown paths: a wandering grid, wide enough for two.
  const paths = [];
  for (let i = 0; i < 9; i++) {
    let x = kit.randInt(10, 150), z = 4;
    const w = kit.randInt(2, 3);
    while (z < 156) {
      for (let dx = 0; dx < w; dx++) {
        for (let dz = 0; dz < 2; dz++) {
          L.set(x + dx, z + dz, C.OPEN);
          L.paint(x + dx, z + dz, { floor: 'dirt' });
        }
      }
      z += 2;
      x = Math.max(4, Math.min(153, x + kit.randInt(-1, 1)));
    }
    paths.push(x);
  }
  for (let i = 0; i < 8; i++) {
    let z = kit.randInt(10, 150), x = 4;
    const w = kit.randInt(2, 3);
    while (x < 156) {
      for (let dz = 0; dz < w; dz++) {
        for (let dx = 0; dx < 2; dx++) {
          L.set(x + dx, z + dz, C.OPEN);
          L.paint(x + dx, z + dz, { floor: 'dirt' });
        }
      }
      x += 2;
      z = Math.max(4, Math.min(153, z + kit.randInt(-1, 1)));
    }
  }

  // Two paths that definitely go somewhere: the spawn to the farmhouse, and the
  // farmhouse to the silo. The wandering ones are for getting lost between them.
  for (const [ax, az, bx, bz] of [[8, 8, 46, 62], [53, 68, 132, 124]]) {
    L.corridor(ax, az, bx, bz, 3, C.OPEN);
  }
  L.paintWhere((c) => c === C.OPEN, { floor: 'dirt' });

  // Irrigation ditches: shin-deep water running dead straight, which nothing
  // else in this level does.
  for (const z of [40, 96, 132]) {
    for (let x = 4; x < 156; x++) {
      for (let dz = 0; dz < 2; dz++) {
        L.set(x, z + dz, C.WATER);
        L.floorAt(x, z + dz, -0.35);
        L.paint(x, z + dz, { floor: 'mud' });
      }
    }
  }
  L.waterLevel = 0;

  // ---------------------------------------------------------------- landmarks
  // The farmhouse: empty, tidy, table laid.
  const fx = 46, fz = 62;
  L.room(fx, fz, fx + 14, fz + 12, { floor: 'woodFloor', wall: 'siding', ceil: 'ceilTile' });
  L.ceilRect(fx, fz, fx + 14, fz + 12, 2.8);
  L.set(fx + 7, fz + 13, C.DOOR);
  L.prop('diningTable', { x: fx + 7, z: fz + 5, rot: 0 });
  for (let i = 0; i < 4; i++) L.prop('chair', { x: fx + 5 + i * 2, z: fz + 7, rot: Math.PI });
  L.prop('bed', { x: fx + 3, z: fz + 9, rot: 0 });
  L.prop('sink', { x: fx + 12, z: fz + 1.4, rot: 0 });
  L.prop('clock', { x: fx + 7, z: fz + 0.6 });
  L.prop('radio', { x: fx + 11, z: fz + 5, y: 0.7 });
  L.light({ x: fx + 7, z: fz + 6, y: 2.7, color: 0xffe8c0, intensity: 1.0, radius: 14, fixture: 'bulb' });

  // The silo: the way out, visible from a long way off.
  const sx = 132, sz = 130;
  for (let dz = -6; dz <= 6; dz++) {
    for (let dx = -6; dx <= 6; dx++) {
      const d = Math.hypot(dx, dz);
      if (d > 6) continue;
      L.set(sx + dx, sz + dz, d > 5 ? C.WALL : C.OPEN);
      L.paint(sx + dx, sz + dz, { floor: 'concrete', wall: 'metalPlate', ceil: 'metalPlate' });
      L.ceilAt(sx + dx, sz + dz, 14);
    }
  }
  L.set(sx, sz - 6, C.DOOR);
  L.prop('ladder', { x: sx + 4, z: sz, height: 8 });
  L.light({ x: sx, z: sz, y: 13, color: 0xd8e8ff, intensity: 1.2, radius: 20, fixture: 'none', hum: 0 });

  // A combine harvester, mid-row, engine cold. (A wreck reads well enough.)
  L.prop('carWreck', { x: 100, z: 50, rot: 0.6 });
  L.prop('radioTower', { x: 20, z: 20 });
  L.prop('signpost', { x: 76, z: 77 });

  // ---------------------------------------------------------------- light
  // No sun in the sky, so the light comes from the sky itself: bake a broad,
  // even field and let the fog do the depth.
  for (let z = 6; z < 156; z += 10) {
    for (let x = 6; x < 156; x += 10) {
      if (!L.isOpen(x, z)) continue;
      L.light({ x, z, y: 7, color: 0xdfeeff, intensity: 0.75, radius: 14, fixture: 'none', hum: 0, bake: true });
    }
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('wheatPatch', 220, { where: (x, z, c) => c === C.OPEN });
  L.scatter('deadTree', 18);
  L.scatter('fencePanel', 30, { opts: { len: 3 } });
  L.scatter('boulder', 20);
  L.scatter('signpost', 12);
  L.scatter('chalkArrow', 26);
  L.scatter('skull', 6);
  L.scatter('tent', 4);
  L.scatter('sleepingBag', 4);
  L.scatter('trafficCone', 8);
  // ---------------------------------------------------------------- scares
  L.scare('shadowCross', { x: 60, z: 30, radius: 8 });
  L.scare('whisper', { x: 90, z: 60, radius: 8, text: 'The wheat moves against the wind, in a line, coming this way.' });
  L.scare('breathing', { x: 30, z: 80, radius: 6 });
  L.scare('screamDistant', { x: 110, z: 70, radius: 14 });
  L.scare('faceInHall', { x: fx + 7, z: fz + 6, radius: 6 });
  L.scare('bodyFall', { x: 140, z: 60, radius: 10 });
  L.scare('footstepsFollow', { x: 70, z: 120, radius: 9 });
  L.scare('staticBurst', { x: 20, z: 24, radius: 8 });
  L.scare('nameOnWall', { x: sx, z: sz - 4, radius: 5 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(8, 8, Math.PI * 0.25);

  L.trigger({ x: fx + 7, z: fz + 6, radius: 6, objective: 'obj1', say: 'Four places laid. The radio is on, playing nothing, and warm.' });
  L.trigger({ x: 76, z: 77, radius: 8, say: 'A signpost with the arms broken off. Someone has scratched: EITHER WAY.' });
  L.trigger({ x: sx, z: sz - 4, radius: 6, say: 'The silo hatch is open, and there is fog coming up out of it, and street noise.' });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('crowd');
  L.hideSpots('wheat', 10);
  L.monsterFar('howler', { tell: 'howlerWheeze', speed: 4.2, patience: 1.3, hearing: 1.7, wanders: 50, checksHides: 0.3 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: sx, z: sz });

  return L.finish();
}
