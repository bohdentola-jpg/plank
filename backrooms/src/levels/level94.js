// LEVEL 94 — THE SCHOOL
// Locker corridors, classrooms with the chairs stacked on the desks, a gymnasium
// with the lines still bright, a cafeteria that smells faintly of gravy. Afternoon
// light comes through the wired glass and there is nothing outside it. A bell goes
// every so often and the corridors are never any fuller afterwards.
//
// The drawings taped to the walls are at the height of a seven-year-old.

export const meta = {
  id: 'level94',
  num: '94',
  name: 'THE SCHOOL',
  subtitle: 'the hallways of room 8',
  tagline: 'The drawings are of you, and they were done a while ago.',
  danger: 7,
  survival: 'poor',
  chapter: 17,
  tape: 'TAPE 15',
  brief: `An endless school in permanent afternoon. Get to the gymnasium fire door.
    The uniforms in the classrooms are on mannequins, and they move when you don't.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 144, h: 144, cell: 3.2, wallH: 3.3,
    palette: { wall: 'lockerWall', floor: 'linoleum', ceil: 'ceilTile' },
    fog: { color: 0x1c1a14, density: 0.030 },
    ambient: { color: 0x2e2a20, intensity: 0.2 },
  });
  L.setAmbience({ room: 'schoolBell', hum: 0.35, drip: 0.05, wind: 0, music: 'lullaby', reverb: 0.6 });
  L.setRules({ sanityDrain: 1.2, noiseLimit: 0.55 });
  L.setTint(1.05, 1.0, 0.9);

  // ---------------------------------------------------------------- corridors
  L.fill(C.WALL);
  for (const z of [20, 52, 84, 116]) {
    L.rect(4, z, 139, z + 2, C.OPEN);
    L.paintRect(4, z - 1, 139, z + 3, { wall: 'lockerWall' });
  }
  for (const x of [20, 68, 116]) L.rect(x, 4, x + 2, 139, C.OPEN);

  // Classrooms: chairs stacked, a chalkboard, and a uniform standing at the back.
  const rooms = [];
  for (const [x, z] of [[6, 4], [34, 4], [80, 4], [6, 36], [34, 36], [80, 36],
    [6, 68], [34, 68], [80, 68], [6, 100], [34, 100], [80, 100]]) {
    const w = 22, h = 13;
    L.room(x, z, x + w, z + h, { floor: 'woodFloor', wall: 'drywall' });
    L.set(x + 11, z + h, C.DOOR);
    const spine = [20, 52, 84, 116].reduce((a, b) => (Math.abs(b - (z + h)) < Math.abs(a - (z + h)) ? b : a));
    L.corridor(x + 11, z + h, x + 11, spine + 1, 2, C.OPEN);
    rooms.push([x + 11, z + 6]);
    L.paintRect(x, z, x + w, z, { wall: 'chalkboard' });
    for (let i = 0; i < 12; i++) {
      const dx = x + 3 + (i % 4) * 5, dz = z + 3 + Math.floor(i / 4) * 4;
      L.prop('desk', { x: dx, z: dz, rot: 0 });
      L.prop('chair', { x: dx, z: dz, y: 0.78, rot: kit.chance(0.5) ? 0 : Math.PI });   // stacked
    }
    L.prop('desk', { x: x + 11, z: z + 1.6, rot: Math.PI });
    L.prop('corkboard', { x: x + 4, z: z + h - 0.6, rot: Math.PI });
    L.light({
      x: x + 11, z: z + 6, y: 3.2, color: 0xfff0c8, intensity: 1.0, radius: 14,
      fixture: 'tube', flicker: kit.chance(0.3) ? kit.rand(0.15, 0.7) : 0, dead: kit.chance(0.1),
    });
    // wired glass onto nothing
    for (let i = 2; i < w - 2; i += 4) L.set(x + i, z - 1, C.GLASS);
  }

  // The gymnasium: tall, bright, lines on the floor, and the fire door.
  const gx = 106, gz = 96;
  L.room(gx, gz, gx + 34, gz + 40, { floor: 'woodFloor', wall: 'acousticWall', ceil: 'metalPlate' });
  L.ceilRect(gx, gz, gx + 34, gz + 40, 9.5);
  L.set(gx - 1, gz + 20, C.DOOR);
  L.corridor(gx - 1, gz + 20, 117, gz + 20, 2, C.OPEN);
  for (let i = 0; i < 6; i++) {
    L.light({
      x: gx + 6 + (i % 3) * 11, z: gz + 10 + Math.floor(i / 3) * 20, y: 9.2,
      color: 0xffffe8, intensity: 1.5, radius: 22, fixture: 'flood', flicker: kit.chance(0.3) ? 0.2 : 0,
    });
  }
  L.prop('railing', { x: gx + 17, z: gz + 1, len: 12 });
  L.scatter('crate', 8, { where: (x, z) => x > gx && x < gx + 34 && z > gz && z < gz + 40 });

  // Cafeteria: long tables, a serving hatch, the smell of a Tuesday.
  const cx = 6, cz = 118;
  L.room(cx, cz, cx + 40, cz + 20, { floor: 'linoleum', wall: 'tileHospital' });
  L.set(cx + 20, cz - 1, C.DOOR);
  L.corridor(cx + 20, cz - 1, cx + 20, 117, 2, C.OPEN);
  for (let i = 0; i < 8; i++) L.prop('diningTable', { x: cx + 5 + (i % 4) * 9, z: cz + 5 + Math.floor(i / 4) * 9, rot: 0 });
  L.prop('vendingMachine', { x: cx + 38, z: cz + 4, rot: -Math.PI / 2 });
  L.light({ x: cx + 20, z: cz + 10, y: 3.2, color: 0xf4f8e0, intensity: 1.1, radius: 20, fixture: 'panel', flicker: 0.12 });

  // Library annexe: quiet, dim, and the stacks are HALF cells you can see over.
  const lx = 62, lz = 118;
  L.room(lx, lz, lx + 34, lz + 20, { floor: 'carpetOffice', wall: 'shelfWall' });
  L.set(lx + 17, lz - 1, C.DOOR);
  L.corridor(lx + 17, lz - 1, lx + 17, 117, 2, C.OPEN);
  for (let z = lz + 3; z < lz + 18; z += 4) {
    for (let x = lx + 3; x < lx + 32; x++) {
      if (kit.chance(0.1)) continue;
      L.set(x, z, C.HALF);
      L.paint(x, z, { wall: 'shelfWall' });
    }
  }
  L.light({ x: lx + 17, z: lz + 10, y: 3.2, color: 0xd8e0a0, intensity: 0.8, radius: 16, fixture: 'lamp' });

  // Music room: where the party sound comes from, faintly, all the time.
  L.room(120, 20, 138, 34, { floor: 'woodFloor', wall: 'acousticWall' });
  L.set(119, 27, C.DOOR);
  L.corridor(119, 27, 117, 27, 2, C.OPEN);
  L.prop('partyHatPile', { x: 128, z: 27 });
  L.prop('streamers', { x: 129, z: 24, height: 3.3 });
  L.light({ x: 129, z: 27, y: 3.2, color: 0xffb0c8, intensity: 0.9, radius: 12, fixture: 'bulb', flicker: 0.2 });

  // ---------------------------------------------------------------- lights
  for (const z of [21, 53, 85, 117]) {
    for (let x = 8; x < 138; x += 8) {
      const dead = kit.chance(0.14);
      L.light({ x, z, y: 3.2, color: 0xfff2d0, intensity: dead ? 0 : 0.95, radius: 11, fixture: 'tube', dead, flicker: kit.chance(0.24) ? kit.rand(0.2, 0.8) : 0 });
    }
  }
  for (const x of [21, 69, 117]) {
    for (let z = 8; z < 138; z += 9) {
      L.light({ x, z, y: 3.2, color: 0xffeec8, intensity: 0.85, radius: 10, fixture: 'tube', flicker: kit.rand(0, 0.4) });
    }
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('lockers', 40);
  L.scatter('noteSheet', 60);
  L.scatter('corkboard', 20);
  L.scatter('picture', 40);
  L.scatter('trashcan', 22);
  L.scatter('clock', 14);
  L.scatter('mopBucket', 8);
  L.scatter('chair', 30);
  L.scatter('bookshelf', 14);
  L.scatter('graffiti', 16);
  L.scatter('chalkArrow', 20);
  L.scatter('balloonCluster', 6);
  L.scatter('tapePile', 3);

  // ---------------------------------------------------------------- pickups
  L.item('battery', { x: rooms[0][0], z: rooms[0][1] });
  L.item('battery', { x: rooms[7][0], z: rooms[7][1] });
  L.item('almondWater', { x: cx + 20, z: cz + 10 });
  L.item('almondWater', { x: lx + 17, z: lz + 2 });
  L.item('medkit', { x: rooms[4][0], z: rooms[4][1] });
  L.item('glowstick', { x: rooms[10][0], z: rooms[10][1], amount: 3 });
  L.item('flare', { x: gx + 6, z: gz + 6, amount: 2 });
  L.item('tape', { x: rooms[5][0], z: rooms[5][1], id: 'tape-school', title: 'TAPE — "ROOM 8, WEDNESDAY"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: rooms[0][0], z: rooms[0][1] + 1, title: 'CRAYON ON SUGAR PAPER, TAPED AT KNEE HEIGHT',
    text: `A drawing of a corridor, done in orange, with lockers on both sides done
      carefully. At the far end there is a stick figure holding a small black
      rectangle up to its face. Underneath, in pencil, an adult hand has written the
      date. The date is today.`,
  });
  L.note({
    x: rooms[4][0], z: rooms[4][1] + 1, title: 'CLASS REGISTER, ROOM 8',
    text: `Twenty-nine names, every one ticked present, every day, for as long as
      the book goes back. At the bottom of the last page, in the same neat teacher's
      hand: they are all present. They have always all been present. I would like
      to be marked absent, please.`,
  });
  L.note({
    x: rooms[7][0], z: rooms[7][1] + 1, title: 'PINNED TO A CORKBOARD, LAMINATED',
    text: `FIRE DRILL PROCEDURE: on hearing the bell, line up quietly and proceed
      to the gymnasium. Do not stop for coats. Do not stop for anyone. Underneath,
      in biro: the bell has gone forty times since I got here and I have never once
      seen anyone in the corridor when it does.`,
  });
  L.note({
    x: lx + 17, z: lz + 3, title: 'LIBRARY, SLIP IN A BOOK POCKET',
    text: `DUE BACK: the date has been stamped and re-stamped so many times the card
      has gone soft. Every stamp is the same day. The book is a picture book about a
      boy who gets lost in a building and the last page has been carefully cut out
      of every copy.`,
  });
  L.note({
    x: cx + 21, z: cz + 10, title: 'CAFETERIA, CHALKED MENU BOARD',
    text: `TODAY: gravy, potatoes, sponge and custard. TOMORROW: gravy, potatoes,
      sponge and custard. Someone has added, very small, in the corner: it is warm
      when I get here and I have never seen it served and I eat it every day.`,
  });
  L.note({
    x: gx + 7, z: gz + 6, title: 'GYMNASIUM, WRITTEN ON A CRASH MAT',
    text: `The uniforms in the classrooms are on stands. They are wearing shoes,
      which stands don't. Do not turn your back on one in a room with more than one
      of them. Count them going in and count them coming out.`,
  });

  // ---------------------------------------------------------------- company
  for (let i = 0; i < rooms.length; i += 2) {
    L.entity('mannequin', { x: rooms[i][0] + 4, z: rooms[i][1] - 3, state: 'patrol' });
  }
  L.pack('faceling', 4, gx + 17, gz + 20, 12, { state: 'patrol', leash: 18 });
  L.entity('howler', { x: cx + 20, z: cz + 10, state: 'guard' });
  L.pack('partygoer', 3, 129, 27, 4, { state: 'dormant', tag: 'music', wake: { after: 200 } });
  L.pack('duller', 6, 68, 84, 14, { state: 'patrol', leash: 18 });
  L.entity('watcher', { x: 21, z: 138, state: 'guard' });
  L.entity('crawler', { x: lx + 17, z: lz + 10, state: 'dormant', wake: { after: 120 } });
  L.entity('skinstealer', { x: 68, z: 20, state: 'patrol', leash: 40, keepsDistance: 12 });

  // ---------------------------------------------------------------- scares
  L.scare('faceInHall', { x: 40, z: 21, radius: 8 });
  L.scare('crowdLaugh', { x: 118, z: 27, radius: 8 });
  L.scare('doorSlam', { x: rooms[3][0], z: rooms[3][1] + 8, radius: 6 });
  L.scare('whisper', { x: lx + 10, z: lz + 10, radius: 7, text: 'A child, in the stacks, asks if you are new.' });
  L.scare('footstepsFollow', { x: 69, z: 60, radius: 9 });
  L.scare('shadowCross', { x: 90, z: 85, radius: 8 });
  L.scare('lightsOut', { x: 21, z: 100, radius: 12 });
  L.scare('breathing', { x: rooms[8][0], z: rooms[8][1], radius: 6 });
  L.scare('nameOnWall', { x: 117, z: 60, radius: 6 });
  L.scare('bodyFall', { x: gx + 17, z: gz + 30, radius: 10 });
  L.scare('phoneRing', { x: 8, z: 53, radius: 8 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(6, 21, 0);
  L.objective('Get to the gymnasium and out through the fire door at the back of it.');
  L.objective('Read what is taped up in Room 8.', { id: 'obj1' });
  L.objective('Count the uniforms in every classroom, going in and coming out.', { optional: true });

  L.trigger({ x: rooms[0][0], z: rooms[0][1], radius: 5, objective: 'obj1', say: 'The drawing has today\'s date on it in an adult\'s handwriting.' });
  L.trigger({ x: 69, z: 85, radius: 6, say: 'The bell goes. Nothing comes out of any of the doors.' });
  L.trigger({ x: gx + 17, z: gz + 20, radius: 10, say: 'The gym lights are all working, which nothing else in the building manages.' });

  L.prop('doubleDoor', { x: gx + 32, z: gz + 39, rot: 0 });
  L.prop('exitSign', { x: gx + 32, z: gz + 38 });
  L.light({ x: gx + 32, z: gz + 37, y: 3.2, color: 0x60ff90, intensity: 0.7, radius: 8, fixture: 'none' });
  L.exit({
    x: gx + 32, z: gz + 38, kind: 'door', to: 'level188', label: 'GYM FIRE DOOR',
    say: 'The bar gives, and behind it is a corridor with windows, going a very long way.',
  });

  return L.finish();
}
