// LEVEL 37 — THE POOLROOMS
// Warm, bright, tiled to the horizon, and the light comes from nowhere you can
// point at. Waist-deep water in every chamber, an echo that repeats your
// footsteps one beat late, and no sound of anything else at all — until the
// water moves on its own. The prettiest level on the tape, which is how it
// gets you: people stop walking here and never start again.

export const meta = {
  id: 'poolrooms',
  num: '37',
  name: 'THE POOLROOMS',
  subtitle: 'sublimity',
  tagline: 'Nobody drowns in the poolrooms. They just stop leaving.',
  danger: 3,
  survival: 'good, if you keep moving',
  chapter: 6,
  tape: 'TAPE 06',
  brief: `Endless tiled chambers, waist-deep and warm. Something swims in the
    deep basins. Find the drain corridor and go down it before you decide you
    like it here.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 144, h: 144, cell: 3.2, wallH: 4.6,
    palette: { wall: 'tileWhite', floor: 'wetTileFloor', ceil: 'tileWhite' },
    fog: { color: 0x9fd8e0, density: 0.020 },
    // Bright, but the tape still has to resolve the tile grout — ambient this high
    // plus the skylights clips the top half of the frame to white.
    ambient: { color: 0x9fdce8, intensity: 0.34, sky: 0xd8f4ff },
  });

  L.setAmbience({ room: 'water', hum: 0.15, drip: 0.85, wind: 0.1, music: 'calm', reverb: 0.9 });
  L.setRules({ wetFeet: true, swimSpeed: 0.9, sanityDrain: 0.6, batteryDrain: 0.85 });
  L.setTint(0.94, 1.02, 1.08);

  // ---------------------------------------------------------------- chambers
  L.fill(C.WALL);
  const chambers = kit.gen.pools(L, {
    x0: 3, z0: 3, x1: 140, z1: 140, count: 26, min: 12, max: 26,
    floor: 'tilePool', wall: 'tileWhite', ceil: 'tileWhite', corridorW: 2, h: 4.6,
  });

  // Everything hand-placed below hangs off the chambers the generator actually
  // made, so a new seed moves the furniture instead of burying it in tile.
  const mid = ([x0, z0, x1, z1]) => [Math.floor((x0 + x1) / 2), Math.floor((z0 + z1) / 2)];
  const spot = (i, dx = 0, dz = 0) => {
    const [x, z] = mid(chambers[i % chambers.length]);
    return [x + dx, z + dz];
  };

  // A few chambers go cathedral-tall with a light shaft down the middle.
  const cathedrals = kit.shuffle(chambers).slice(0, 4);
  for (const [x0, z0, x1, z1] of cathedrals) {
    L.ceilRect(x0, z0, x1, z1, 9.5);
    L.paintRect(x0, z0, x1, z1, { wall: 'tileMosaic' });
    const cx = Math.floor((x0 + x1) / 2), cz = Math.floor((z0 + z1) / 2);
    L.light({ x: cx, z: cz, y: 8.6, color: 0xfff6e0, intensity: 0.9, radius: 26, fixture: 'sun', hum: 0 });
    L.prop('fountain', { x: cx, z: cz });
  }

  // ---------------------------------------------------------------- windows
  // The thing about the poolrooms is that you can see the next room before you can get
  // to it. Every chamber gets glazing punched through the tile into whatever is on the
  // other side: a long strip at chest height, or a run of tall lights floor to ceiling.
  // Glass is solid to walk into and clear to look and to LIGHT through, so a chamber
  // with a window in it borrows the blue off the water next door — and something moving
  // two rooms away is visible long before it has any idea you are there.
  const glazed = [];
  for (const [x0, z0, x1, z1] of chambers) {
    const wide = x1 - x0 >= z1 - z0;
    // pick a wall with something behind it: step out from the middle of each side and
    // look for open floor two cells beyond the tile
    const sides = wide
      ? [[Math.floor((x0 + x1) / 2), z0 - 1, 0, -1], [Math.floor((x0 + x1) / 2), z1 + 1, 0, 1]]
      : [[x0 - 1, Math.floor((z0 + z1) / 2), -1, 0], [x1 + 1, Math.floor((z0 + z1) / 2), 1, 0]];
    for (const [wx, wz, dx, dz] of kit.shuffle(sides)) {
      if (!L.inside(wx + dx * 3, wz + dz * 3)) continue;
      let behind = false;
      for (let d = 1; d <= 4; d++) if (L.isOpen(wx + dx * d, wz + dz * d)) { behind = true; break; }
      if (!behind) continue;
      const run = kit.randInt(4, 9);
      const tall = kit.chance(0.45);
      for (let i = -run; i <= run; i++) {
        const gx = wx + (dx ? 0 : i), gz = wz + (dz ? 0 : i);
        if (!L.inside(gx, gz) || L.get(gx, gz) !== C.WALL) continue;
        // leave a mullion every few cells so it reads as glazing and not a missing wall
        if (!tall && Math.abs(i) % 4 === 3) continue;
        L.set(gx, gz, C.GLASS);
        L.paint(gx, gz, { wall: 'glassPool' });
      }
      glazed.push([wx, wz, dx, dz, tall]);
      break;
    }
  }
  // a working light on the far side of some of them, so the window is a bright hole in
  // a dark wall rather than a grey one
  for (const [wx, wz, dx, dz] of kit.shuffle(glazed).slice(0, 9)) {
    const lx = wx + dx * 3, lz = wz + dz * 3;
    if (!L.isOpen(lx, lz)) continue;
    L.light({ x: lx, z: lz, y: 2.2, color: 0xa8e8ff, intensity: 0.9, radius: 14, fixture: 'none', hum: 0.15 });
  }

  // ---------------------------------------------------------------- the water
  // Everything walkable is wet. Basins are deeper, and one of them is a lot
  // deeper than it looks from the doorway.
  L.paintWhere((c) => c === C.OPEN, { floor: 'tilePool' });
  for (let z = 1; z < L.h - 1; z++) {
    for (let x = 1; x < L.w - 1; x++) {
      if (L.get(x, z) !== C.OPEN) continue;
      L.set(x, z, C.WATER);
      L.floorAt(x, z, -0.85);
    }
  }

  // Raised tile walkways: dry ground to catch your breath on, and the only
  // place a wretch can't reach you.
  const ledges = kit.shuffle(chambers).slice(0, 5).map(([x0, z0, x1, z1]) => (
    x1 - x0 >= z1 - z0
      ? [x0 + 2, z0 + 1, x1 - 2, z0 + 2]      // a shelf along the north wall
      : [x0 + 1, z0 + 2, x0 + 2, z1 - 2]      // or down the west wall
  ));
  for (const [x0, z0, x1, z1] of ledges) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!L.inside(x, z) || L.get(x, z) === C.WALL) continue;
        L.set(x, z, C.OPEN);
        L.floorAt(x, z, 0.35);
        L.paint(x, z, { floor: 'wetTileFloor' });
      }
    }
    L.ramp(x0 - 2, z0, x0, z0, -0.85, 0.35, { width: Math.min(3, z1 - z0 + 1) });
    L.prop('poolLadder', { x: x1, z: z1, rot: Math.PI });
    L.prop('lounger', { x: x0 + 2, z: z0, rot: kit.rand(0, 6.28) });
  }

  // Deep basins — chest-deep to over your head. The dark blue ones.
  const deeps = kit.shuffle(chambers).slice(0, 5);
  for (const [x0, z0, x1, z1] of deeps) {
    const px0 = x0 + 3, pz0 = z0 + 3, px1 = x1 - 3, pz1 = z1 - 3;
    if (px1 - px0 < 3 || pz1 - pz0 < 3) continue;
    for (let z = pz0; z <= pz1; z++) {
      for (let x = px0; x <= px1; x++) {
        L.set(x, z, C.DEEP);
        L.floorAt(x, z, -3.1);
        L.paint(x, z, { floor: 'tileBlue' });
      }
    }
    L.prop('poolLadder', { x: px0 - 1, z: pz0, rot: 0 });
    L.prop('divingBoard', { x: px1 + 1, z: Math.floor((pz0 + pz1) / 2), rot: Math.PI });
    for (const [lx, lz] of [[px0, pz0], [px1, pz1]]) {
      L.light({ x: lx, z: lz, y: -1.6, color: 0x7fe4ff, intensity: 1.1, radius: 12, fixture: 'poolLight', hum: 0.2 });
    }
  }

  // ---------------------------------------------------------------- light
  // Nothing in here is a lamp. The tiles just keep some of yesterday's sun.
  for (const [x0, z0, x1, z1] of chambers) {
    const cx = Math.floor((x0 + x1) / 2), cz = Math.floor((z0 + z1) / 2);
    L.light({
      x: cx, z: cz, y: 4.0, color: 0xeafaff, intensity: 1.15,
      radius: Math.max(18, (x1 - x0) * 1.5), fixture: 'none', flicker: 0, hum: 0,
    });
    if (kit.chance(0.5)) {
      L.light({
        x: cx + kit.randInt(-4, 4), z: cz + kit.randInt(-4, 4), y: 4.2,
        color: 0xc8ecff, intensity: 0.6, radius: 12, fixture: 'none', hum: 0,
      });
    }
  }
  // corridors get their own faint glow so they don't read as black holes
  for (let i = 0; i < 320; i++) {
    const [x, z] = L.randomOpen();
    L.light({ x, z, y: 3.4, color: 0xcfeef8, intensity: 0.75, radius: 12, fixture: 'none', bake: true, hum: 0 });
  }

  // Landmarks the objectives point at: the spawn chamber, the ledge with the
  // keycard on it, the mirrored wall, and the far chamber with the main drain.
  const spawn = mid(chambers[0]);
  const keyAt = [ledges[1][0] + 1, ledges[1][1]];
  const mirrorAt = mid(chambers[Math.min(4, chambers.length - 1)]);
  const drainRoom = mid(chambers[chambers.length - 1]);

  // ---------------------------------------------------------------- dressing
  L.scatter('poolNoodle', 22, { where: (x, z, c) => c === C.WATER });
  L.scatter('lifebuoy', 9);
  L.scatter('drainGrate', 16);
  L.scatter('graffiti', 12);
  L.scatter('lounger', 8, { where: (x, z, c) => c === C.OPEN });
  L.scatter('bacteriaMat', 6);
  L.prop('mirrorPanel', { x: mirrorAt[0], z: mirrorAt[1], rot: 0 });
  // ---------------------------------------------------------------- scares
  L.scare('waterStir', { x: spot(6, 2, 0)[0], z: spot(6, 2, 0)[1], radius: 8 });
  L.scare('waterStir', { x: spot(9, 0, 2)[0], z: spot(9, 0, 2)[1], radius: 8 });
  L.scare('facePressWindow', { x: mirrorAt[0], z: mirrorAt[1] + 1, radius: 5 });
  L.scare('mirrorFigure', { x: mirrorAt[0], z: mirrorAt[1] + 1, radius: 4 });
  L.scare('breathing', { x: spot(5, 2, 2)[0], z: spot(5, 2, 2)[1], radius: 6 });
  L.scare('bodyFall', { x: spot(11, 0, 3)[0], z: spot(11, 0, 3)[1], radius: 10 });
  L.scare('staticBurst', { x: spot(4, 3, 0)[0], z: spot(4, 3, 0)[1], radius: 7 });
  L.scare('screamDistant', { x: spot(2, 0, 4)[0], z: spot(2, 0, 4)[1], radius: 12 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(spawn[0], spawn[1], Math.PI * 0.75);

  L.trigger({ x: spot(7)[0], z: spot(7)[1], radius: 7, say: 'Your footsteps come back late.' });
  L.trigger({ x: keyAt[0], z: keyAt[1], radius: 4, objective: 'obj1', say: 'Keycard. Chamber 14 is the far south-east.' });
  L.trigger({ x: drainRoom[0] + 3, z: drainRoom[1] + 3, radius: 8, say: 'The water is draining somewhere ahead. You can feel the pull.' });

  L.paintRect(drainRoom[0] - 4, drainRoom[1] - 4, drainRoom[0] + 4, drainRoom[1] + 4, { wall: 'tileBlue' });
  L.prop('drainGrate', { x: drainRoom[0], z: drainRoom[1] + 2, scale: 2.2 });
  L.light({ x: drainRoom[0], z: drainRoom[1], y: 4.0, color: 0x9fe8ff, intensity: 1.4, radius: 16, fixture: 'none', hum: 0 });

  // The other way down: swim to the bottom of the blue basin and keep going.
  const [dx, dz] = L.randomOpen((x, z, c) => c === C.DEEP);

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('darkwater');
  L.hideSpots('water', 10);
  L.monsterFar('wretch', { tell: 'wretchGurgle', speed: 4.4, patience: 1.4, hearing: 1.5, wanders: 26, checksHides: 0.4 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: drainRoom[0], z: drainRoom[1] + 2 });

  return L.finish();
}
