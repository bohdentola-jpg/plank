// LEVEL 6 — LIGHTS OUT
// No fixtures. No windows. No emergency lighting worth the name. Storage cages
// and boiler rooms and stacks of paper going soft in the damp, and every single
// thing in here hunts by sound. What you carry is what you see by, and the moment
// you put a light down and step away from it, you are the only moving thing in a
// hundred metres of black.

export const meta = {
  id: 'level6',
  num: '6',
  name: 'LIGHTS OUT',
  subtitle: 'the sub-basement',
  tagline: 'Walk. Do not run. Do not swing the torch about.',
  danger: 8,
  survival: 'very poor',
  chapter: 8,
  tape: 'TAPE 07',
  brief: `Total dark. Hounds hunt your footsteps and the smilers only wait.
    Find the maintenance shaft — the air coming down it is warm and smells of
    chlorine.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 138, h: 138, cell: 3.2, wallH: 3.0,
    palette: { wall: 'cinder', floor: 'concreteWet', ceil: 'concrete' },
    fog: { color: 0x030304, density: 0.075 },
    ambient: { color: 0x0a0a0e, intensity: 0.04 },
  });
  L.setAmbience({ room: 'silence', hum: 0.1, drip: 0.55, wind: 0.05, music: 'dread', reverb: 0.75 });
  L.setRules({ dark: true, noiseLimit: 0.28, sanityDrain: 1.6, batteryDrain: 1.2 });
  L.setTint(0.92, 0.95, 1.05);

  // ---------------------------------------------------------------- the stacks
  L.fill(C.WALL);
  const rooms = kit.gen.rooms(L, {
    x0: 3, z0: 3, x1: 134, z1: 134, minRoom: 9, splits: 5, pad: 1, corridorW: 2,
    roomPaint: { floor: 'concreteWet', wall: 'cinder' },
  });
  // storage cages: waist-high rows you can see over if you had any light
  for (const [cx, cz, rx0, rz0, rx1, rz1] of rooms) {
    if (kit.chance(0.45)) continue;
    for (let z = rz0 + 2; z < rz1 - 1; z += 3) {
      for (let x = rx0 + 1; x < rx1 - 1; x++) {
        if (kit.chance(0.12)) continue;
        L.set(x, z, C.HALF);
        L.paint(x, z, { wall: 'chainFence' in {} ? 'metalPlate' : 'metalPlate' });
      }
    }
    L.scatter('shelf', 4, { where: (x, z) => x > rx0 && x < rx1 && z > rz0 && z < rz1 });
  }

  // Boiler rooms: the only warm places, and the only ones with any glow at all.
  const boilers = kit.shuffle(rooms).slice(0, 4);
  for (const [cx, cz] of boilers) {
    L.paintRect(cx - 4, cz - 4, cx + 4, cz + 4, { floor: 'metalPlate', wall: 'rust', ceil: 'ductWall' });
    L.prop('pipeCluster', { x: cx, z: cz, len: 8 });
    L.prop('valveWheel', { x: cx + 2, z: cz - 3 });
    L.prop('drum', { x: cx - 3, z: cz + 2 });
    L.light({ x: cx, z: cz, y: 2.6, color: 0xff5828, intensity: 0.4, radius: 6, fixture: 'emergencyLight', flicker: 0.55, hum: 0.4 });
  }

  // A wing of soft paper: filing that has been damp for decades.
  const paperRoom = rooms[Math.floor(rooms.length / 2)];
  L.paintRect(paperRoom[2], paperRoom[3], paperRoom[4], paperRoom[5], { wall: 'paper', floor: 'carpetDamp' });
  L.scatter('archiveShelf', 12, {
    where: (x, z) => x > paperRoom[2] && x < paperRoom[4] && z > paperRoom[3] && z < paperRoom[5],
  });

  // ---------------------------------------------------------------- light
  // Eleven failing emergency lights in the whole level. That is the level.
  for (let i = 0; i < 11; i++) {
    const [x, z] = L.randomOpen();
    L.light({ x, z, y: 2.7, color: 0xff4a30, intensity: 0.3, radius: 5, fixture: 'emergencyLight', flicker: kit.rand(0.6, 1) });
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('crateStack', 30);
  L.scatter('boxStack', 34);
  L.scatter('barrel', 18);
  L.scatter('trolley', 12);
  L.scatter('rubblePile', 18);
  L.scatter('clawMarks', 24);
  L.scatter('bloodTrail', 10);
  L.scatter('skull', 8);
  L.scatter('bacteriaMat', 12);
  L.scatter('graffiti', 14);
  L.scatter('mattress', 8);
  L.scatter('campLight', 6);
  L.scatter('tapePile', 4);
  L.scatter('cocoon', 6, { where: (x, z) => x > 90 || z > 90 });

  // ---------------------------------------------------------------- pickups
  // Generous, because without light this level is a coin flip.
  const spot = (i) => [rooms[i % rooms.length][0], rooms[i % rooms.length][1]];
  L.item('flare', { x: spot(0)[0], z: spot(0)[1], amount: 3 });
  L.item('flare', { x: spot(4)[0], z: spot(4)[1], amount: 2 });
  L.item('glowstick', { x: spot(1)[0], z: spot(1)[1], amount: 6 });
  L.item('glowstick', { x: spot(6)[0], z: spot(6)[1], amount: 4 });
  L.item('battery', { x: spot(2)[0], z: spot(2)[1], amount: 2 });
  L.item('battery', { x: spot(7)[0], z: spot(7)[1] });
  L.item('almondWater', { x: spot(3)[0], z: spot(3)[1] });
  L.item('medkit', { x: spot(5)[0], z: spot(5)[1] });
  L.item('tape', { x: spot(8)[0], z: spot(8)[1], id: 'tape-dark', title: 'TAPE — "SIXTY-ONE STEPS"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: spot(0)[0] + 1, z: spot(0)[1], title: 'FLARE BOX LID, WRITTEN IN CHALK',
    text: `Light held still is safe. Light that sweeps around is a flag. They do
      not see it, exactly — they hear you turn. Put the flare down, let it burn,
      walk out of the circle in a straight line and keep walking.`,
  });
  L.note({
    x: spot(1)[0] + 1, z: spot(1)[1], title: 'INDEX CARD, PINNED TO A CAGE',
    text: `Counted the steps between the boiler room and the cages: sixty-one at a
      walk. Ninety-four the time I ran, because running does not go in a straight
      line down here, and because it followed me the long way round.`,
  });
  L.note({
    x: spot(2)[0] + 1, z: spot(2)[1], title: 'DAMP PAGE, HANDWRITING VERY NEAT',
    text: `The smilers do not move while there is light on them. I have tested this
      for six hours. I got very good at holding the torch steady and very bad at
      everything else, and when the battery went I found out what they do next.`,
  });
  L.note({
    x: spot(5)[0] + 1, z: spot(5)[1], title: 'SPRAYED AT WAIST HEIGHT',
    text: `THE SHAFT IS IN THE NORTH-EAST BOILER ROOM
      THE AIR COMING DOWN IT IS WARM
      IT SMELLS OF SWIMMING POOLS AND I ALMOST CRIED`,
  });
  L.note({
    x: spot(8)[0] + 1, z: spot(8)[1], title: 'FILE FOLDER, EMPTY, LABEL INTACT',
    text: `SUB-BASEMENT LIGHTING — WORK ORDERS, 41 YEARS. Every order signed off
      as completed. Every order for the same eleven fittings. Nobody has ever
      replaced one of them and everybody has been paid.`,
  });

  // ---------------------------------------------------------------- company
  L.pack('hound', 5, spot(9)[0], spot(9)[1], 10, { state: 'patrol', leash: 40 });
  L.pack('hound', 4, spot(11)[0], spot(11)[1], 10, { state: 'patrol', leash: 40 });
  L.entity('hound', { x: spot(3)[0], z: spot(3)[1], state: 'patrol', leash: 50 });
  L.pack('smiler', 5, spot(10)[0], spot(10)[1], 14, { state: 'patrol', leash: 20 });
  L.pack('smiler', 4, spot(12)[0], spot(12)[1], 14, { state: 'patrol', leash: 20 });
  L.entity('smiler', { x: spot(6)[0], z: spot(6)[1], state: 'guard' });
  L.entity('howler', { x: spot(7)[0], z: spot(7)[1], state: 'patrol', leash: 18 });
  L.entity('clump', { x: spot(13)[0], z: spot(13)[1], state: 'patrol', leash: 8 });
  L.entity('crawler', { x: spot(14)[0], z: spot(14)[1], state: 'patrol', leash: 24 });

  // ---------------------------------------------------------------- scares
  L.scare('breathing', { x: spot(2)[0], z: spot(2)[1] + 3, radius: 6, needsDark: true });
  L.scare('footstepsFollow', { x: spot(4)[0], z: spot(4)[1] + 3, radius: 8 });
  L.scare('whisper', { x: spot(6)[0], z: spot(6)[1] + 3, radius: 7, text: 'Very close, at the level of your ear: "don\'t."' });
  L.scare('handFromCeiling', { x: spot(8)[0], z: spot(8)[1] + 2, radius: 5 });
  L.scare('bodyFall', { x: spot(10)[0], z: spot(10)[1] + 4, radius: 10 });
  L.scare('screamDistant', { x: spot(12)[0], z: spot(12)[1] + 4, radius: 12 });
  L.scare('thingBehindYou', { x: spot(13)[0], z: spot(13)[1] + 2, radius: 6 });
  L.scare('staticBurst', { x: spot(5)[0], z: spot(5)[1] + 3, radius: 7 });
  L.scare('nameOnWall', { x: spot(7)[0], z: spot(7)[1] + 3, radius: 5 });
  L.scare('tapeGlitch', { x: spot(11)[0], z: spot(11)[1] + 3, radius: 8 });

  // ---------------------------------------------------------------- the way out
  const start = rooms[0];
  const shaft = boilers[boilers.length - 1];
  L.spawnAt(start[0], start[1], 0);
  L.objective('Find the maintenance shaft in a boiler room. The warm one.');
  L.objective('Get a light you can put down and leave burning.', { id: 'obj1' });
  L.objective('Never run. Not once.', { optional: true });

  L.trigger({ x: spot(0)[0], z: spot(0)[1], radius: 4, objective: 'obj1', say: 'Flares. Three of them, dry.' });
  L.trigger({ x: spot(9)[0], z: spot(9)[1], radius: 8, say: 'Something ahead of you is breathing through its mouth and moving on four legs.' });
  L.trigger({ x: shaft[0], z: shaft[1], radius: 6, say: 'Warm air, falling. Chlorine. There is a ladder bolted into the wall.' });

  L.prop('ladder', { x: shaft[0] + 3, z: shaft[1] + 3, height: 3.0 });
  L.light({ x: shaft[0] + 3, z: shaft[1] + 3, y: 2.6, color: 0x90e8ff, intensity: 0.5, radius: 7, fixture: 'none', hum: 0 });
  L.exit({
    x: shaft[0] + 3, z: shaft[1] + 3, kind: 'ladder', to: 'poolrooms', label: 'MAINTENANCE SHAFT',
    say: 'You climb toward the smell of chlorine, and it gets warmer, and then it gets bright.',
  });

  return L.finish();
}
