// LEVEL 3 — ELECTRICAL STATION
// Rows of transformer cabinets in a hall with no visible end, humming at a
// frequency that gets into your teeth. Sodium emergency light, arcs behind the
// louvres, and the freight gate at the far end that needs three fuses nobody
// filed the location of. Something in here is wearing a survivor and doing an
// almost convincing job.

export const meta = {
  id: 'level3',
  num: '3',
  name: 'ELECTRICAL STATION',
  subtitle: 'the hum',
  tagline: 'Everything here is live, including the things that aren\'t wired.',
  danger: 5,
  survival: 'poor',
  chapter: 4,
  tape: 'TAPE 04',
  brief: `A substation maze. The freight gate out needs three ceramic fuses from
    the wings. Do not trust a voice that knows your name.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 136, h: 136, cell: 3.2, wallH: 4.4,
    palette: { wall: 'breakerWall', floor: 'concretePaint', ceil: 'ductWall' },
    fog: { color: 0x1a1408, density: 0.040 },
    ambient: { color: 0x30240e, intensity: 0.13 },
  });
  L.setAmbience({ room: 'machinery', hum: 0.95, drip: 0.1, wind: 0, music: 'drone', reverb: 0.5 });
  L.setRules({ batteryDrain: 1.3, sanityDrain: 1.15 });
  L.setTint(1.1, 0.98, 0.78);

  // ---------------------------------------------------------------- the rows
  L.fill(C.WALL);
  kit.gen.hall(L, { x0: 3, z0: 3, x1: 132, z1: 132, every: 12, h: 4.4, prop: 'pillar' });
  // cabinet rows: full-height, so the aisles are corridors with cross-cuts
  for (let x = 10; x < 128; x += 8) {
    for (let z = 6; z < 130; z++) {
      if (kit.chance(0.09)) { z += 2; continue; }        // gaps you can slip through
      L.set(x, z, C.WALL);
      L.paint(x, z, { wall: 'breakerWall' });
    }
  }
  L.enclose();

  // Four transformer halls at the corners, tall and loud.
  const wings = [[8, 8], [104, 8], [8, 104], [104, 104]];
  const wingSpots = [];
  for (const [x, z] of wings) {
    L.room(x, z, x + 22, z + 22, { floor: 'metalPlate', wall: 'cinder', ceil: 'ductWall' });
    L.ceilRect(x, z, x + 22, z + 22, 7.2);
    for (let i = 0; i < 6; i++) {
      const tx = x + 3 + (i % 3) * 8, tz = z + 4 + Math.floor(i / 3) * 12;
      L.prop('transformer', { x: tx, z: tz, rot: kit.pick([0, Math.PI / 2]) });
      L.collider(tx - 0.7, tz - 0.6, tx + 0.7, tz + 0.6, { y1: 2.1 });
    }
    L.light({ x: x + 11, z: z + 11, y: 6.8, color: 0xffb040, intensity: 1.15, radius: 18, fixture: 'flood', flicker: 0.22 });
    wingSpots.push([x + 11, z + 18]);
  }

  // The centre: a control room with a window onto the whole floor.
  L.room(58, 58, 76, 74, { floor: 'linoleum', wall: 'drywall', ceil: 'ceilPanel' });
  for (let x = 58; x <= 76; x++) L.set(x, 57, C.GLASS);
  L.light({ x: 67, z: 66, y: 4.1, color: 0xe8f0ff, intensity: 1.2, radius: 14, fixture: 'panel', flicker: 0.08 });
  L.prop('desk', { x: 62, z: 60, rot: 0 });
  L.prop('crtMonitor', { x: 62, z: 59.6 });
  L.prop('serverRack', { x: 74, z: 60, rot: -Math.PI / 2 });
  L.prop('officeChair', { x: 63.4, z: 61, rot: 2.2 });
  L.prop('corkboard', { x: 67, z: 74.6, rot: Math.PI });
  L.prop('watercooler', { x: 59, z: 72 });

  // ---------------------------------------------------------------- lights
  L.lightGrid(6, 6, 130, 130, {
    every: 8, color: 0xffa838, intensity: 0.7, radius: 11,
    flickerChance: 0.3, deadChance: 0.2, fixture: 'emergencyLight',
  });
  for (let i = 0; i < 40; i++) {
    const [x, z] = L.randomOpen();
    L.light({ x, z, y: 4.2, color: 0xfff4d0, intensity: 0.5, radius: 7, fixture: 'tube', flicker: kit.rand(0.3, 0.95) });
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('breakerBox', 40);
  L.scatter('ductRun', 24, { opts: { len: 9, height: 4.0 } });
  L.scatter('pipeRun', 18, { opts: { len: 7, height: 3.8 } });
  L.scatter('trolley', 10);
  L.scatter('crate', 20);
  L.scatter('drum', 14);
  L.scatter('graffiti', 18);
  L.scatter('clawMarks', 8);
  L.scatter('trafficCone', 16);
  L.scatter('wetFloorSign', 6);
  L.scatter('tapePile', 3);
  L.prop('vendingMachine', { x: 78, z: 66, rot: -Math.PI / 2 });

  // ---------------------------------------------------------------- pickups
  // Three fuses, one per wing, and the fourth wing has the thing that follows.
  L.item('fuse', { x: wingSpots[0][0], z: wingSpots[0][1] });
  L.item('fuse', { x: wingSpots[1][0], z: wingSpots[1][1] });
  L.item('fuse', { x: wingSpots[2][0], z: wingSpots[2][1] });
  L.item('battery', { x: 62, z: 62 });
  L.item('battery', { x: wingSpots[1][0] + 2, z: wingSpots[1][1] });
  L.item('almondWater', { x: 74, z: 70 });
  L.item('medkit', { x: 60, z: 72 });
  L.item('flare', { x: wingSpots[2][0] + 2, z: wingSpots[2][1], amount: 2 });
  L.item('tape', { x: 67, z: 63, id: 'tape-elec', title: 'TAPE — "IT KNEW MY SISTER\'S NAME"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: 67, z: 73, title: 'CONTROL ROOM LOG, LAST PAGE',
    text: `Load on the west bus has been steady at 4.1MW for nine months.
      Nothing is drawing it. I traced the feeder out past the wing and it goes
      into the wall, and the wall is forty centimetres thick, and on the other
      side of the wall is the wing I just came from.`,
  });
  L.note({
    x: 68, z: 73, title: 'STICKY NOTE ON THE GLASS',
    text: `GATE NEEDS 3 FUSES. THE CRATE BY THE GATE HAS 1 IN IT. IT IS THE WRONG
      SIZE. WHOEVER KEEPS SWAPPING IT: I KNOW, AND IT ISN'T FUNNY.`,
  });
  L.note({
    x: wingSpots[0][0], z: wingSpots[0][1] + 1, title: 'FOLDED INTO A CABINET DOOR',
    text: `There's a man in here who says he's from bay four and he knew the layout
      before I told him. His voice is right. His words are right. He stands too far
      away to see properly and he never comes closer while I'm looking at him.`,
  });
  L.note({
    x: wingSpots[1][0], z: wingSpots[1][1] + 1, title: 'GREASE PENCIL ON A TRANSFORMER',
    text: `The hum is 60Hz and it is in tune with itself everywhere except the
      north-east wing, where it is a quarter-tone flat. I have started avoiding
      that wing. I cannot explain why a flat hum is worse. It is worse.`,
  });
  L.note({
    x: wingSpots[2][0], z: wingSpots[2][1] + 1, title: 'HAND-DRAWN MAP, MOSTLY CROSSED OUT',
    text: `Cable chase under cabinet 40 goes down. I put a stone in and counted:
      four seconds, then a wet sound, then red light coming up out of it.
      I am not going down there. I am writing it down so someone else can be
      stupid instead.`,
  });

  // ---------------------------------------------------------------- company
  L.entity('skinstealer', { x: wingSpots[3][0], z: wingSpots[3][1], state: 'patrol', leash: 40, keepsDistance: 10 });
  L.entity('skinstealer', { x: 100, z: 66, state: 'dormant', wake: { after: 200 } });
  L.pack('smiler', 3, 120, 66, 8, { state: 'patrol', leash: 12 });
  L.pack('deathmoth', 6, 67, 40, 10, { state: 'patrol', leash: 20 });
  L.pack('deathmoth', 5, 40, 100, 10, { state: 'patrol', leash: 20 });
  L.entity('duller', { x: 30, z: 66, state: 'patrol', leash: 16 });
  L.entity('duller', { x: 92, z: 120, state: 'patrol', leash: 16 });
  L.entity('howler', { x: 66, z: 110, state: 'patrol', leash: 18 });
  L.entity('watcher', { x: 118, z: 30, state: 'guard' });

  // ---------------------------------------------------------------- scares
  L.scare('lightBurst', { x: 48, z: 48, radius: 5 });
  L.scare('staticBurst', { x: 84, z: 40, radius: 7 });
  L.scare('whisper', { x: 30, z: 90, radius: 7, text: 'A voice you know says your name from the next aisle.' });
  L.scare('facePressWindow', { x: 67, z: 56, radius: 5 });
  L.scare('shadowCross', { x: 100, z: 100, radius: 7 });
  L.scare('lightsOut', { x: 120, z: 120, radius: 8 });
  L.scare('thingBehindYou', { x: 52, z: 120, radius: 6 });
  L.scare('bodyFall', { x: 110, z: 48, radius: 9 });
  L.scare('phoneRing', { x: 67, z: 68, radius: 6 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(4, 66, 0);
  L.objective('Get through the freight gate at the east end.');
  L.objective('Find three ceramic fuses — one in each of the transformer wings.', { id: 'obj1' });
  L.objective('Whatever is copying a survivor: don\'t let it get inside ten metres.', { optional: true });

  L.trigger({ x: 67, z: 66, radius: 6, say: 'The control room still has power and a chair that is still warm.' });
  L.trigger({ x: wingSpots[0][0], z: wingSpots[0][1], radius: 5, say: 'Fuse. Ceramic, unbroken, the right size for once.' });
  L.trigger({ x: 126, z: 66, radius: 6, objective: 'obj1', say: 'The gate panel wants three fuses. It has room for four.' });

  L.room(126, 60, 132, 72, { floor: 'metalPlate', wall: 'cinder' });
  L.prop('elevatorDoors', { x: 131, z: 66, rot: -Math.PI / 2 });
  L.light({ x: 128, z: 66, y: 4.0, color: 0xff4030, intensity: 0.8, radius: 8, fixture: 'emergencyLight', flicker: 0.4 });
  L.exit({
    x: 131, z: 66, kind: 'gate', to: 'level4', needs: 'fuse', label: 'FREIGHT GATE',
    say: 'Three fuses in, the gate grinds up, and behind it is carpet. Office carpet.',
  });

  // The cable chase under cabinet 40. Four seconds, a wet sound, red light.
  L.prop('trapdoor', { x: 40, z: 122 });
  L.exit({
    x: 40, z: 122, kind: 'trapdoor', to: 'level_run', hidden: true, label: 'CABLE CHASE',
    say: 'You are falling in a straight line and the light coming up at you is red.',
  });

  return L.finish();
}
