// LEVEL FUN =)
// Party rooms, forever. Streamers, balloons, trestle tables with paper cloths,
// cake with somebody's name piped on it in yellow. Warm pink and yellow light and
// muzak from a system nobody can find. It is a birthday party that started a long
// time ago and never once stopped, and the guests are still here, and they are so
// pleased you could make it.
//
// The mechanic is noise: run in here and the whole level comes to say hello.

export const meta = {
  id: 'level_fun',
  num: 'FUN',
  name: 'LEVEL FUN =)',
  subtitle: 'many happy returns',
  tagline: 'They saved you a seat. They saved everybody a seat.',
  danger: 8,
  survival: 'very poor',
  chapter: 19,
  tape: 'TAPE 17',
  brief: `Party rooms without end. Walk — running brings the whole level. The way
    out is behind the biggest banner in the main hall.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 140, h: 140, cell: 3.1, wallH: 3.2,
    palette: { wall: 'wallpaperParty', floor: 'woodFloor', ceil: 'ceilTile' },
    fog: { color: 0x2a1418, density: 0.030 },
    ambient: { color: 0x46242c, intensity: 0.22 },
  });
  L.setAmbience({ room: 'crowd', hum: 0.3, drip: 0, wind: 0, music: 'muzak', reverb: 0.5 });
  L.setRules({ noiseLimit: 0.22, sanityDrain: 1.45 });
  L.setTint(1.08, 0.96, 1.0);

  // ---------------------------------------------------------------- the rooms
  L.fill(C.WALL);
  const rooms = kit.gen.rooms(L, {
    x0: 3, z0: 3, x1: 136, z1: 136, minRoom: 10, splits: 5, pad: 1, corridorW: 2,
    roomPaint: { floor: 'woodFloor', wall: 'wallpaperParty', ceil: 'ceilTile' },
  });

  // Every room is dressed for a party, and no two are dressed the same.
  for (const [cx, cz, rx0, rz0, rx1, rz1] of rooms) {
    const tables = kit.randInt(2, 5);
    for (let i = 0; i < tables; i++) {
      const tx = kit.randInt(rx0 + 2, rx1 - 2), tz = kit.randInt(rz0 + 2, rz1 - 2);
      L.prop('partyTable', { x: tx, z: tz, rot: kit.rand(0, 6.28) });
      if (kit.chance(0.5)) L.prop('cake', { x: tx, z: tz, y: 0.8 });
      for (let k = 0; k < kit.randInt(2, 5); k++) {
        L.prop('chair', { x: tx + kit.rand(-2, 2), z: tz + kit.rand(-2, 2), rot: kit.rand(0, 6.28) });
      }
    }
    for (let i = 0; i < kit.randInt(2, 6); i++) {
      L.prop('balloonCluster', { x: kit.randInt(rx0 + 1, rx1 - 1), z: kit.randInt(rz0 + 1, rz1 - 1) });
    }
    for (let i = 0; i < kit.randInt(2, 5); i++) {
      L.prop('streamers', { x: kit.randInt(rx0 + 1, rx1 - 1), z: kit.randInt(rz0 + 1, rz1 - 1), height: 3.2 });
    }
    if (kit.chance(0.6)) L.prop('banner', { x: cx, z: rz0 + 0.6, w: Math.min(6, rx1 - rx0 - 2) });
    if (kit.chance(0.4)) L.prop('partyHatPile', { x: cx + kit.rand(-2, 2), z: cz + kit.rand(-2, 2) });
    L.light({
      x: cx, z: cz, y: 3.1, color: kit.pick([0xffc0d0, 0xffe0a0, 0xffd0e8, 0xfff0c0]),
      intensity: 1.1, radius: 16, fixture: 'bulb', flicker: kit.chance(0.25) ? 0.15 : 0,
    });
    if (kit.chance(0.5)) {
      L.light({
        x: cx + kit.randInt(-4, 4), z: cz + kit.randInt(-4, 4), y: 3.0,
        color: 0xff90b0, intensity: 0.6, radius: 10, fixture: 'bulb', flicker: 0.1,
      });
    }
  }

  // The main hall: bigger, brighter, louder, and the banner at the end of it is
  // the largest thing in the level.
  const hall = rooms[Math.floor(rooms.length / 2)];
  const hx = hall[0], hz = hall[1];
  L.paintRect(hall[2], hall[3], hall[4], hall[5], { wall: 'wallpaperParty', floor: 'woodFloor', ceil: 'ceilPanel' });
  L.ceilRect(hall[2], hall[3], hall[4], hall[5], 6.4);
  L.prop('banner', { x: hx, z: hall[5] - 0.6, w: 10, rot: Math.PI });
  L.prop('cake', { x: hx, z: hz, scale: 2.4 });
  L.light({ x: hx, z: hz, y: 6.0, color: 0xffd8b0, intensity: 1.8, radius: 30, fixture: 'chandelier' });
  for (let i = 0; i < 10; i++) {
    L.prop('balloonCluster', { x: hx + kit.rand(-8, 8), z: hz + kit.rand(-6, 6) });
    L.prop('streamers', { x: hx + kit.rand(-8, 8), z: hz + kit.rand(-6, 6), height: 6.2 });
  }
  for (let i = 0; i < 12; i++) {
    L.prop('chair', { x: hx + kit.rand(-9, 9), z: hz + kit.rand(-7, 7), rot: kit.rand(0, 6.28) });
  }

  // Party lights strung through everything: the level is warm and bright, and that is
  // most of why it is unbearable.
  L.lightGrid(5, 5, 135, 135, {
    every: 6, color: 0xffd0b0, intensity: 0.7, radius: 12, fixture: 'bulb',
    flickerChance: 0.22, deadChance: 0.08, brokenChance: 0.03,
  });

  // ---------------------------------------------------------------- dressing
  L.scatter('balloonCluster', 60);
  L.scatter('streamers', 60, { opts: { height: 3.2 } });
  L.scatter('partyHatPile', 40);
  L.scatter('cake', 20);
  L.scatter('chair', 60);
  L.scatter('banner', 20, { opts: { w: 4 } });
  L.scatter('picture', 20);
  L.scatter('rug', 20);
  L.scatter('graffiti', 12);
  const at = (i, dx = 0, dz = 0) => [rooms[i % rooms.length][0] + dx, rooms[i % rooms.length][1] + dz];
  for (let i = 0; i < rooms.length; i++) {
    const [cx, cz] = rooms[i];
  }

  // ---------------------------------------------------------------- scares
  L.scare('crowdLaugh', { x: at(0)[0], z: at(0)[1], radius: 9 });
  L.scare('crowdLaugh', { x: at(7)[0], z: at(7)[1], radius: 9 });
  L.scare('faceInHall', { x: at(3, 2)[0], z: at(3, 2)[1], radius: 7 });
  L.scare('doorSlam', { x: at(6, 2)[0], z: at(6, 2)[1], radius: 6 });
  L.scare('whisper', { x: at(10)[0], z: at(10)[1], radius: 7, text: 'Somebody very close asks whether you got your slice.' });
  L.scare('breathing', { x: at(12)[0], z: at(12)[1], radius: 6 });
  L.scare('phoneRing', { x: at(2, 2)[0], z: at(2, 2)[1], radius: 8 });
  L.scare('lightsOut', { x: hx, z: hz + 6, radius: 12 });
  L.scare('thingBehindYou', { x: at(9, 2)[0], z: at(9, 2)[1], radius: 6 });
  L.scare('nameOnWall', { x: at(11, 2)[0], z: at(11, 2)[1], radius: 6 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(rooms[0][0], rooms[0][1], 0);

  L.trigger({ x: rooms[0][0], z: rooms[0][1], radius: 6, objective: 'obj1', say: 'Muzak, warm light, and every head in the room turning to see who came in.' });
  L.trigger({ x: hx, z: hz, radius: 8, say: 'Forty-one candles, and one of them has been lit recently.' });
  L.trigger({ x: hx, z: hall[5] - 3, radius: 5, say: 'The carpet under the banner is worn in a strip.' });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('crowd');
  L.hideSpots('crate', 10);
  L.monsterFar('partygoer', { tell: 'partyGiggle', speed: 6.0, patience: 1.6, hearing: 2.0, wanders: 30, checksHides: 0.7 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: hx, z: hall[5] - 1 });

  return L.finish();
}
