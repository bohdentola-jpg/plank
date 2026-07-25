// LEVEL 4B — THE BREAK ROOM
// A staff break room and its stockroom: warm lamps, steady light, a vending machine
// that still works, crates of almond water, and a corkboard carrying the notes of
// everyone who came through here and went on. It reads as the safe floor, and for a
// long time people wrote that down as fact.
//
// Something tall stands in the corner and hums. When you look at it, it points at
// the way out — patiently, helpfully, every time. It is the only thing down here
// that tells you the truth, and it must not be allowed to reach you.
//
// The smallest floor on the tape, which is the point: there is nowhere in it that is
// more than twenty seconds from the thing.

export const meta = {
  id: 'breakroom',
  num: '4B',
  name: 'THE BREAK ROOM',
  subtitle: 'safe, as far as anyone knows',
  tagline: 'It hums, it points, and it is walking while it does it.',
  danger: 5,
  survival: 'good, if you keep moving',
  chapter: 6,
  tape: 'TAPE 05B',
  brief: `Warm light, steady hum, and one small floor. The thing in the corner will
    show you where the lift is. It will also walk you down while it does.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 68, h: 68, cell: 3.0, wallH: 2.8,
    palette: { wall: 'woodPanel', floor: 'linoleum', ceil: 'ceilTile' },
    fog: { color: 0x1c1812, density: 0.022 },
    ambient: { color: 0x40342a, intensity: 0.34 },
  });
  L.setAmbience({ room: 'drone', hum: 0.25, drip: 0.08, wind: 0, music: 'calm', reverb: 0.3 });
  L.setRules({ sanityDrain: 0.7, batteryDrain: 0.5 });
  L.setTint(1.06, 1.0, 0.9);

  // ---------------------------------------------------------------- the rooms
  L.fill(C.WALL);
  // main break room
  L.room(8, 8, 34, 30, { floor: 'linoleum', wall: 'woodPanel', ceil: 'ceilTile' });
  // stockroom
  L.room(38, 8, 58, 26, { floor: 'concrete', wall: 'cinder', ceil: 'concrete' });
  L.corridor(34, 18, 38, 16, 2);
  // corridor south to the two doors
  L.room(18, 34, 26, 56, { floor: 'carpetOffice', wall: 'drywall' });
  L.corridor(22, 30, 22, 34, 2);
  // washroom
  L.room(40, 32, 52, 44, { floor: 'tileHospitalFloor', wall: 'tileHospital' });
  L.corridor(26, 40, 40, 38, 2);

  // ---------------------------------------------------------------- furniture
  L.prop('diningTable', { x: 20, z: 16, rot: 0 });
  for (const [dx, dz, r] of [[-4, -2, 0.2], [-4, 2, 3.1], [4, -2, 0.6], [4, 2, 2.6], [0, 4, 1.6]]) {
    L.prop('chair', { x: 20 + dx, z: 16 + dz, rot: r });
  }
  L.prop('sofa', { x: 12, z: 26, rot: 0 });
  L.prop('armchair', { x: 30, z: 26, rot: -0.6 });
  L.prop('sideTable', { x: 26, z: 26 });
  L.prop('radio', { x: 26, z: 26, y: 0.62 });
  L.prop('vendingMachine', { x: 32, z: 11, rot: -Math.PI / 2 });
  L.prop('watercooler', { x: 10, z: 11 });
  L.prop('sink', { x: 14, z: 9.4, rot: 0 });
  L.prop('clock', { x: 22, z: 8.6 });
  L.prop('rug', { x: 20, z: 22, w: 4, d: 3 });
  L.prop('tv', { x: 20, z: 29, rot: Math.PI });
  L.prop('picture', { x: 27, z: 8.6 });
  L.prop('corkboard', { x: 17, z: 8.6 });
  L.prop('corkboard', { x: 21, z: 8.6 });
  L.prop('lamp', { x: 12, z: 24 });
  L.prop('lamp', { x: 29, z: 24 });

  // stockroom: the almond water mountain
  for (let i = 0; i < 12; i++) {
    L.prop('almondCrate', { x: 40 + (i % 4) * 4, z: 10 + Math.floor(i / 4) * 5, rot: kit.rand(0, 0.4) });
  }
  L.scatter('crateStack', 10, { where: (x, z) => x > 38 && x < 58 && z > 8 && z < 26 });
  L.prop('shelf', { x: 57, z: 14, rot: -Math.PI / 2, height: 2.2 });
  L.prop('shelf', { x: 57, z: 20, rot: -Math.PI / 2, height: 2.2 });
  L.prop('tapePile', { x: 44, z: 22 });

  // washroom
  for (let i = 0; i < 3; i++) L.prop('bathStall', { x: 42 + i * 3, z: 35, rot: 0 });
  L.prop('sink', { x: 48, z: 42.6, rot: Math.PI });
  L.prop('mirrorPanel', { x: 48, z: 43.6, rot: Math.PI });

  // ---------------------------------------------------------------- light
  // Warm, low, and completely steady. No flicker anywhere in this level.
  L.light({ x: 20, z: 16, y: 2.7, color: 0xffdca8, intensity: 1.3, radius: 16, fixture: 'panel' });
  L.light({ x: 12, z: 25, y: 0.9, color: 0xffc888, intensity: 0.8, radius: 8, fixture: 'lamp' });
  L.light({ x: 29, z: 25, y: 0.9, color: 0xffc888, intensity: 0.8, radius: 8, fixture: 'lamp' });
  L.light({ x: 48, z: 16, y: 2.7, color: 0xf0e8d0, intensity: 1.0, radius: 16, fixture: 'tube' });
  L.light({ x: 22, z: 44, y: 2.7, color: 0xffe0b0, intensity: 0.9, radius: 14, fixture: 'tube' });
  L.light({ x: 46, z: 38, y: 2.7, color: 0xe8f0f0, intensity: 0.9, radius: 12, fixture: 'panel' });
  L.light({ x: 22, z: 54, y: 2.6, color: 0x60ff90, intensity: 0.6, radius: 8, fixture: 'none' });
  // and a fitting every few metres besides, because this is the one floor where the
  // lights were maintained
  L.lightGrid(9, 9, 58, 56, {
    every: 5, color: 0xffdca8, intensity: 0.5, radius: 9, fixture: 'panel',
    flickerChance: 0, deadChance: 0.1, brokenChance: 0,
  });

  // ---------------------------------------------------------------- the board
  L.scare('screamDistant', { x: 22, z: 46, radius: 10 });
  L.scare('breathing', { x: 48, z: 16, radius: 7 });
  L.scare('doorSlam', { x: 22, z: 40, radius: 6 });

  // ---------------------------------------------------------------- doors out
  L.spawnAt(20, 20, Math.PI);

  L.trigger({ x: 20, z: 20, radius: 6, say: 'Warm light, steady hum, and something humming along with it in the next room.' });
  L.trigger({ x: 31, z: 13, radius: 4, say: 'It hums a note and a half, and points, patiently, at the south corridor.' });
  L.trigger({ x: 22, z: 48, radius: 5, say: 'Two doors. One of them has light under it.' });

  L.prop('doorFrame', { x: 20, z: 56 });
  L.prop('exitSign', { x: 20, z: 55 });
  L.prop('door', { x: 25, z: 56, metal: true });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('silence');
  L.hideSpots('locker', 10);
  // It walks. It never runs, it never loses you, and it never stops pointing.
  L.monsterFar('shepherd', { tell: 'shepherdHum', speed: 2.2, patience: 6.0, hearing: 1.4, wanders: 20, checksHides: 0.2 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 20, z: 55 });

  return L.finish();
}
