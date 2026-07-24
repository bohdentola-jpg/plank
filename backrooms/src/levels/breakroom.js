// LEVEL 4B — THE BREAK ROOM
// The one place on the tape where nothing is hunting you. A staff break room and
// its stockroom, warm lamps, a vending machine that still works, crates of
// almond water, and a corkboard carrying the notes of everyone who came through
// here and went on. Something tall stands in the corner and hums, and it points
// at the door when you look at it, and it has never once come closer.
//
// Mechanically: the game's save room. Deliberately small — the size bar does not
// apply to the level whose whole job is to be a room.

export const meta = {
  id: 'breakroom',
  num: '4B',
  name: 'THE BREAK ROOM',
  subtitle: 'safe, as far as anyone knows',
  tagline: 'Sit down. Drink something. It will still be out there in ten minutes.',
  danger: 0,
  survival: 'total',
  chapter: 6,
  tape: 'TAPE 05B',
  brief: `Nothing in here wants anything from you. Restock, read the corkboard,
    and pick a door: STAIRS B, or the unlit one somebody labelled DO NOT.`,
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
  L.setRules({ sanityDrain: 0, batteryDrain: 0.5 });
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

  // ---------------------------------------------------------------- stock
  L.item('almondWater', { x: 42, z: 12, amount: 2 });
  L.item('almondWater', { x: 46, z: 17, amount: 2 });
  L.item('battery', { x: 50, z: 12, amount: 2 });
  L.item('battery', { x: 44, z: 24 });
  L.item('medkit', { x: 54, z: 20 });
  L.item('flare', { x: 52, z: 16, amount: 2 });
  L.item('glowstick', { x: 56, z: 22, amount: 4 });
  L.item('tape', { x: 44, z: 21, id: 'tape-break', title: 'TAPE — "EVERYONE WHO SAT HERE"' });

  // ---------------------------------------------------------------- the board
  L.note({
    x: 17, z: 9, title: 'CORKBOARD — TOP LEFT, OLDEST',
    text: `If you are reading this you found the room. Rules of the room:
      take what you need, leave what you can, don't sleep more than one shift, and
      do not follow the tall one if it walks. It only ever points. If it walks,
      the room isn't safe any more and you should already be gone.`,
  });
  L.note({
    x: 21, z: 9, title: 'CORKBOARD — A LIST OF NAMES',
    text: `Forty-one names, each with two dates. Most have a second date. Six
      don't. At the bottom, in a different hand: the six without a second date are
      the ones who went out through STAIRS B. Make of that what you like — I did,
      and I'm going that way.`,
  });
  L.note({
    x: 20, z: 15, title: 'ON THE TABLE, UNDER A MUG',
    text: `The vending machine takes no money and gives you what you need instead
      of what you press. I have tested it eleven times. Twice it gave me a first
      aid tin. Once it gave me a photograph of a house I grew up in.`,
  });
  L.note({
    x: 44, z: 22, title: 'STOCKROOM INVENTORY, IN PENCIL',
    text: `Almond water: plenty. D-cells: plenty. Flares: fewer every time I count,
      and I am the only one here. Whatever is taking them isn't taking anything
      else, which means it can see in the dark and would rather you couldn't.`,
  });
  L.note({
    x: 22, z: 50, title: 'TAPED TO THE UNLIT DOOR',
    text: `DO NOT. I'm not going to tell you why, because the last person who
      wrote why on this door was very specific and everyone went anyway.
      It goes down and it goes dark and there is no third thing.`,
  });
  L.note({
    x: 48, z: 42, title: 'WASHROOM MIRROR, WRITTEN IN SOAP',
    text: `Check your reflection every time you pass. Not for anything behind you.
      For you. If it takes longer than it should to catch up, sit down in the
      break room and drink something and do not go out for a while.`,
  });

  // ---------------------------------------------------------------- company
  // One entity, and it is on your side, more or less.
  L.entity('shepherd', { x: 31, z: 12, state: 'guard' });
  L.scare('screamDistant', { x: 22, z: 46, radius: 10 });

  // ---------------------------------------------------------------- doors out
  L.spawnAt(20, 20, Math.PI);
  L.objective('Restock, then pick a door: STAIRS B, or the one marked DO NOT.');
  L.objective('Read the corkboard. All of it.', { optional: true });
  L.objective('The vending machine works. Try it.', { optional: true });

  L.trigger({ x: 20, z: 20, radius: 6, say: 'Warm light, steady hum, nothing moving. Take a minute — the tape can spare it.' });
  L.trigger({ x: 31, z: 13, radius: 4, say: 'It hums a note and a half, and points, patiently, at the south corridor.' });
  L.trigger({ x: 22, z: 48, radius: 5, say: 'Two doors. One of them has light under it.' });

  L.prop('doorFrame', { x: 20, z: 56 });
  L.prop('exitSign', { x: 20, z: 55 });
  L.exit({
    x: 20, z: 55, kind: 'door', to: 'level5', label: 'STAIRS B',
    say: 'Carpet, then patterned carpet, then a corridor of doors with brass numbers on them.',
  });
  L.prop('door', { x: 25, z: 56, metal: true });
  L.exit({
    x: 25, z: 55, kind: 'stairs', to: 'level6', label: 'DO NOT',
    say: 'Down, and down. The last bulb is behind you now and nothing has replaced it.',
  });

  return L.finish();
}
