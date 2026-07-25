// LEVEL 0 — THE LOBBY
// The one everybody knows. Mono-yellow wallpaper, damp carpet, the buzz of
// fluorescent lights at maximum hum, and roughly six hundred million square
// miles of it. Nothing hunts you here for a long while, which is the point:
// the level's monster is the level. Then, somewhere around the far wing, you
// start hearing something that runs on more than two legs.

export const meta = {
  id: 'level0',
  num: '0',
  name: 'THE LOBBY',
  subtitle: 'the rooms',
  tagline: 'If you are here, you noclipped out of reality.',
  danger: 1,
  survival: 'almost guaranteed',
  chapter: 1,
  tape: 'TAPE 01',
  brief: `Yellow rooms. Wet carpet. The hum. Nothing has noticed you yet.
    Find the seam where the wallpaper doesn't meet and get out of the lobby.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 140, h: 140, cell: 3.2, wallH: 3.0,
    palette: { wall: 'wallpaper', floor: 'carpet', ceil: 'ceilTile' },
    fog: { color: 0x6a5f2a, density: 0.024 },
    // The lobby is the bright floor: light comes from the whole ceiling and there is
    // nowhere in it that reads as dark. Everything below here is a step down.
    ambient: { color: 0x7a6a34, intensity: 0.52 },
  });

  L.setAmbience({ room: 'buzz', hum: 0.85, drip: 0.12, wind: 0, music: 'drone', reverb: 0.3 });
  L.setRules({ batteryDrain: 0.9, sanityDrain: 0.8 });
  L.setTint(1.06, 1.0, 0.72);          // the tape reads everything a little yellow

  // ---------------------------------------------------------------- the maze
  // Braided hard, so it feels like an office block that lost its offices
  // instead of a puzzle with a solution.
  L.fill(C.WALL);
  kit.gen.maze(L, {
    x0: 2, z0: 2, x1: 137, z1: 137,
    braid: 0.42, rooms: 26, roomMin: 4, roomMax: 12,
  });

  // A handful of the big empty rooms people always describe: too wide, too
  // low, one light out, exactly like every other one.
  const halls = [
    [8, 8, 26, 22], [104, 12, 128, 30], [14, 100, 36, 126],
    [96, 98, 124, 128], [58, 58, 84, 82],
  ];
  for (const [x0, z0, x1, z1] of halls) {
    L.room(x0, z0, x1, z1, { floor: 'carpetDamp', wall: 'wallpaperDamp' });
    L.ceilRect(x0, z0, x1, z1, 2.7);
    kit.gen.hall(L, { x0: x0 + 2, z0: z0 + 2, x1: x1 - 2, z1: z1 - 2, every: 7, h: 2.7, prop: 'pillarSquare' });
  }

  // Damp corners: the carpet has been wet for years and the wallpaper knows it.
  for (let i = 0; i < 40; i++) {
    const [x, z] = L.randomOpen();
    const r = kit.randInt(2, 6);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.hypot(dx, dz) > r) continue;
        L.paint(x + dx, z + dz, { floor: 'carpetDamp' });
        if (kit.chance(0.4)) L.paint(x + dx, z + dz, { wall: 'wallpaperDamp' });
      }
    }
  }

  // ---------------------------------------------------------------- lights
  // The whole ceiling is a light fixture. Some of them gave up.
  L.lightGrid(4, 4, 136, 136, {
    every: 5, color: 0xfff0b4, intensity: 1.25, radius: 15,
    flickerChance: 0.16, deadChance: 0.05, brokenChance: 0.03,
  });
  // A second grid, offset by half a bay: a strict grid on a braided maze leaves whole
  // corridors with no fitting above them, and the lobby is not a level with dark
  // corners — that is what everything below it is for.
  L.lightGrid(6, 7, 136, 136, {
    every: 5, color: 0xffeeae, intensity: 0.9, radius: 13,
    flickerChance: 0.2, deadChance: 0.08, brokenChance: 0.05,
  });

  // One wing where the tubes are on their way out — the dread ramp.
  for (const l of L.lights) {
    if (l.x > 96 && l.z > 96) { l.flicker = Math.max(l.flicker, kit.rand(0.35, 0.9)); l.intensity *= 0.7; }
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('trashcan', 14);
  L.scatter('boxStack', 22);
  L.scatter('chair', 18);
  L.scatter('mopBucket', 6);
  L.scatter('wetFloorSign', 9);
  L.scatter('graffiti', 26);
  L.scatter('clawMarks', 12, { where: (x, z) => x > 70 || z > 70 });
  L.scatter('bacteriaMat', 8, { where: (x, z) => x > 100 && z > 100 });
  L.scatter('rubblePile', 10);
  L.scatter('chalkArrow', 18);

  // Someone before you made a camp and did not finish using it.
  L.prop('mattress', { x: 20, z: 16, rot: 0.3 });
  L.prop('campLight', { x: 22, z: 17 });
  L.prop('almondCrate', { x: 18, z: 18, rot: 0.8 });
  L.light({ x: 22, z: 17, y: 0.5, color: 0xffd090, intensity: 0.7, radius: 7, fixture: 'lamp', flicker: 0.1 });
  // Almost nothing for the first two wings. Then it earns the name.

  // ---------------------------------------------------------------- scares
  L.scare('faceInHall', { x: 44, z: 20, radius: 7 });
  L.scare('shadowCross', { x: 66, z: 34, radius: 6 });
  L.scare('lightBurst', { x: 30, z: 60, radius: 4 });
  L.scare('whisper', { x: 84, z: 44, radius: 8, text: 'it says a name that is almost yours' });
  L.scare('footstepsFollow', { x: 58, z: 88, radius: 9 });
  L.scare('doorSlam', { x: 96, z: 60, radius: 6 });
  L.scare('breathing', { x: 112, z: 78, radius: 5, needsDark: false });
  L.scare('nameOnWall', { x: 126, z: 108, radius: 5 });
  L.scare('tapeGlitch', { x: 70, z: 120, radius: 8 });

  // ---------------------------------------------------------------- the way out
  // The seam: where two runs of wallpaper don't line up and the wall behind
  // them isn't there. Marked on the map only once you're near it.
  L.spawnAt(6, 6, Math.PI * 0.25);

  L.trigger({
    x: 70, z: 70, radius: 6, say: 'The hum is louder here. Or there is more of it.',
  });
  L.trigger({
    x: 100, z: 100, radius: 8,
    say: 'Something in the next wing is moving on more legs than you have.',
    wake: 'pack', objective: null,
  });
  L.trigger({
    x: 132, z: 130, radius: 5, say: 'The wallpaper here has a shadow behind it.',
    objective: 'obj1',
  });

  L.prop('graffiti', { x: 133, z: 132, rot: 0, big: true });
  L.light({ x: 133, z: 131, color: 0xd8e8ff, intensity: 0.5, radius: 6, fixture: 'none', flicker: 0.5 });

  // The classic accident: a soft spot in the floor of a flooded storeroom.
  // Fall through it and you skip straight into the poolrooms.
  L.room(4, 128, 12, 136, { floor: 'wetTileFloor', wall: 'tileWhite' });
  L.water(5, 129, 11, 135, { depth: 0.5, level: 0, floor: 'tilePool', wall: 'tileWhite' });
  L.prop('drainGrate', { x: 8, z: 132 });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('flicker');
  L.hideSpots('crate', 10);
  L.monsterFar('faceling', { tell: 'facelingBreath', speed: 2.6, patience: 0.8, wanders: 30, checksHides: 0.25 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 134, z: 132 });

  return L.finish();
}
