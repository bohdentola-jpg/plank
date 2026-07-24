// LEVEL 283 — THE ARCHIVES
// Shelving to the limit of the light in every direction, card catalogue halls,
// reading rooms with green-shaded lamps, and a rare-books cage with a padlock on
// the inside. The silence is not an absence of noise, it is a rule, and something
// in the stacks enforces it. The archive is still accessioning, and lately what it
// has been filing is you.

export const meta = {
  id: 'level_archives',
  num: '283',
  name: 'THE ARCHIVES',
  subtitle: 'accessions, ongoing',
  tagline: 'Quiet, please.',
  danger: 7,
  survival: 'fair, if you can be silent',
  chapter: 20,
  tape: 'TAPE 18',
  brief: `Infinite stacks under a silence rule. Find the reading room with the
    catalogue drawer that has your name in it, then take the stairs up.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 146, h: 146, cell: 3.1, wallH: 4.6,
    palette: { wall: 'shelfWall', floor: 'carpetOffice', ceil: 'ceilTile' },
    fog: { color: 0x100d08, density: 0.036 },
    ambient: { color: 0x241e14, intensity: 0.13 },
  });
  L.setAmbience({ room: 'silence', hum: 0.12, drip: 0.05, wind: 0, music: 'choir', reverb: 0.75 });
  L.setRules({ noiseLimit: 0.18, sanityDrain: 1.25, batteryDrain: 0.95 });
  L.setTint(1.04, 1.0, 0.9);

  // ---------------------------------------------------------------- the stacks
  L.fill(C.OPEN);
  L.paintAll({ floor: 'carpetOffice', wall: 'shelfWall', ceil: 'ceilTile' });
  // rows of shelving as HALF cells: you can see over them and never past them
  for (let z = 8; z < 138; z += 4) {
    for (let x = 6; x < 140; x++) {
      if (kit.chance(0.07)) { x += 2; continue; }        // gaps to slip through
      L.set(x, z, C.HALF);
      L.paint(x, z, { wall: 'shelfWall' });
    }
  }
  // cross-aisles, so the level is navigable at all
  for (const x of [24, 52, 80, 108, 132]) L.rect(x, 4, x + 2, 141, C.OPEN);
  for (const z of [30, 70, 110]) L.rect(4, z, 141, z + 2, C.OPEN);

  // Reading rooms: carpet, tables, green lamps, and the only real light.
  const readers = [];
  for (const [x, z] of [[8, 34], [96, 34], [40, 74], [112, 74], [16, 114], [76, 114]]) {
    const w = 20, h = 16;
    L.rect(x, z, x + w, z + h, C.OPEN);
    L.paintRect(x, z, x + w, z + h, { floor: 'carpetHotel', wall: 'woodPanel', ceil: 'ceilPanel' });
    L.ceilRect(x, z, x + w, z + h, 6.2);
    readers.push([x + 10, z + 8]);
    for (let i = 0; i < 4; i++) {
      const tx = x + 5 + (i % 2) * 9, tz = z + 5 + Math.floor(i / 2) * 7;
      L.prop('diningTable', { x: tx, z: tz, rot: 0 });
      L.prop('chair', { x: tx - 1, z: tz + 1.6, rot: 0 });
      L.prop('chair', { x: tx + 1, z: tz - 1.6, rot: Math.PI });
      L.prop('lamp', { x: tx, z: tz, y: 0.78 });
      L.light({ x: tx, z: tz, y: 1.2, color: 0x90ff90, intensity: 0.55, radius: 7, fixture: 'none', hum: 0.1 });
    }
    L.light({ x: x + 10, z: z + 8, y: 6.0, color: 0xffe8b0, intensity: 0.9, radius: 16, fixture: 'chandelier', flicker: 0.08 });
  }

  // The catalogue hall: drawers, thousands of them, one of them about you.
  const cx = 60, cz = 8;
  L.rect(cx, cz, cx + 26, cz + 18, C.OPEN);
  L.paintRect(cx, cz, cx + 26, cz + 18, { floor: 'marble', wall: 'woodPanel', ceil: 'ceilPanel' });
  L.ceilRect(cx, cz, cx + 26, cz + 18, 6.8);
  for (let i = 0; i < 24; i++) {
    L.prop('filingCabinet', { x: cx + 2 + (i % 8) * 3, z: cz + 3 + Math.floor(i / 8) * 6, rot: 0 });
  }
  L.light({ x: cx + 13, z: cz + 9, y: 6.6, color: 0xfff0c8, intensity: 1.2, radius: 22, fixture: 'chandelier' });

  // The rare-books cage, padlocked from the inside.
  const kx = 116, kz = 120;
  L.rect(kx, kz, kx + 14, kz + 14, C.OPEN);
  L.frame(kx - 1, kz - 1, kx + 15, kz + 15, C.GLASS);
  L.set(kx + 7, kz - 1, C.DOOR);
  L.paintRect(kx, kz, kx + 14, kz + 14, { floor: 'woodFloor', wall: 'shelfWall' });
  for (let i = 0; i < 8; i++) L.prop('archiveShelf', { x: kx + 2 + (i % 4) * 3, z: kz + 3 + Math.floor(i / 4) * 8, rot: 0 });
  L.light({ x: kx + 7, z: kz + 7, y: 4.4, color: 0xffc060, intensity: 0.7, radius: 14, fixture: 'lamp', flicker: 0.15 });

  // ---------------------------------------------------------------- lights
  // The stacks get almost nothing: a bulb every few aisles, on a pull cord.
  for (let z = 12; z < 138; z += 16) {
    for (let x = 12; x < 138; x += 14) {
      L.light({
        x, z, y: 4.4, color: 0xffdca0, intensity: 0.5, radius: 8, fixture: 'bulb',
        flicker: kit.chance(0.3) ? kit.rand(0.2, 0.7) : 0, dead: kit.chance(0.22),
      });
    }
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('archiveShelf', 60, { where: (x, z, c) => c === C.OPEN });
  L.scatter('bookshelf', 40);
  L.scatter('trolley', 24);
  L.scatter('noteSheet', 70);
  L.scatter('filingCabinet', 20);
  L.scatter('clock', 10);
  L.scatter('lamp', 22);
  L.scatter('chair', 26);
  L.scatter('boxStack', 20);
  L.scatter('tapePile', 4);
  L.scatter('graffiti', 8);

  // ---------------------------------------------------------------- pickups
  L.item('battery', { x: readers[0][0], z: readers[0][1] });
  L.item('battery', { x: readers[3][0], z: readers[3][1] });
  L.item('almondWater', { x: readers[1][0], z: readers[1][1] });
  L.item('almondWater', { x: readers[4][0], z: readers[4][1] });
  L.item('medkit', { x: readers[2][0], z: readers[2][1] });
  L.item('glowstick', { x: cx + 13, z: cz + 9, amount: 3 });
  L.item('key', { x: kx + 7, z: kz + 7, key: 'cage' });
  L.item('tape', { x: readers[5][0], z: readers[5][1], id: 'tape-arch', title: 'TAPE — "ACCESSION 41"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: cx + 13, z: cz + 10, title: 'CATALOGUE DRAWER, PULLED OUT',
    text: `Index cards, typed, in your surname's range. One of them is your movements
      since you arrived in the archive: aisle by aisle, timed to the second, in the
      past tense, and the last line is not written yet but the card has room for it.`,
  });
  L.note({
    x: readers[0][0], z: readers[0][1] + 1, title: 'READING ROOM RULES, FRAMED',
    text: `SILENCE IS REQUIRED. Items may not be removed. Readers may not be removed.
      Do not speak to staff. There is no staff. If a member of staff speaks to you,
      you are not required to answer, and you are strongly advised not to.`,
  });
  L.note({
    x: readers[2][0], z: readers[2][1] + 1, title: 'SLIP LEFT IN A BOOK',
    text: `Two whole days without making a sound. I have taken my boots off. I have
      learned which of the shelves creak. The one in the stacks doesn't hunt like a
      dog — it waits for a noise and then it is simply there, at the end of the aisle,
      already looking at you.`,
  });
  L.note({
    x: readers[4][0], z: readers[4][1] + 1, title: 'ON A TROLLEY OF UNSHELVED BOOKS',
    text: `Somebody is still shelving. The trolleys move overnight and the books go
      to the right places. I have followed the sequence four aisles and it is correct
      and it is faster than I could do it and it is done in the dark.`,
  });
  L.note({
    x: kx + 7, z: kz + 8, title: 'RARE BOOKS CAGE, INSIDE, ON THE PADLOCK',
    text: `Locked from in here, by me, and I am aware of what that means. The stairs
      up are in the north-east and they are not on the plan on the wall, which is
      wrong in several other ways too. The key is on the desk. Take it. I have
      finished with doors.`,
  });

  // ---------------------------------------------------------------- company
  L.entity('howler', { x: 40, z: 40, state: 'patrol', leash: 30, tag: 'shush' });
  L.entity('howler', { x: 100, z: 90, state: 'patrol', leash: 30, tag: 'shush' });
  L.entity('howler', { x: 70, z: 130, state: 'patrol', leash: 30 });
  L.pack('mannequin', 4, 80, 60, 22, { state: 'patrol' });
  L.pack('mannequin', 3, 30, 100, 18, { state: 'patrol' });
  L.entity('watcher', { x: 6, z: 70, state: 'guard' });
  L.entity('watcher', { x: 140, z: 30, state: 'guard' });
  L.entity('watcher', { x: 70, z: 140, state: 'guard' });
  L.pack('duller', 6, 108, 40, 12, { state: 'patrol', leash: 16 });
  L.entity('faceling', { x: 52, z: 100, state: 'patrol', leash: 26 });
  L.entity('crawler', { x: 132, z: 100, state: 'dormant', wake: { after: 150 } });

  // ---------------------------------------------------------------- scares
  L.scare('whisper', { x: 30, z: 30, radius: 7, text: 'From the next aisle, very quietly: "quiet, please."' });
  L.scare('faceInHall', { x: 52, z: 50, radius: 8 });
  L.scare('footstepsFollow', { x: 80, z: 80, radius: 9 });
  L.scare('breathing', { x: 24, z: 90, radius: 6 });
  L.scare('bodyFall', { x: 108, z: 110, radius: 10 });
  L.scare('nameOnWall', { x: cx + 20, z: cz + 14, radius: 6 });
  L.scare('mirrorFigure', { x: 132, z: 70, radius: 6 });
  L.scare('lightsOut', { x: 60, z: 120, radius: 12 });
  L.scare('staticBurst', { x: 100, z: 20, radius: 8 });
  L.scare('screamDistant', { x: 20, z: 130, radius: 14 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(6, 31, 0);
  L.objective('Find the stairs in the north-east corner and go up.');
  L.objective('The stair door is locked. The key is in the rare-books cage.', { id: 'obj1' });
  L.objective('Read the drawer with your name in it.', { optional: true });

  L.trigger({ x: cx + 13, z: cz + 9, radius: 6, say: 'A drawer is already open at your surname. The card is up to date.' });
  L.trigger({ x: kx + 7, z: kz + 7, radius: 5, objective: 'obj1', say: 'A key on a desk, and a padlock closed from this side.' });
  L.trigger({ x: 136, z: 12, radius: 6, say: 'Stairs. Going up. Not on the plan by the door, which had other problems.' });

  L.rect(132, 6, 140, 20, C.OPEN);
  L.paintRect(132, 6, 140, 20, { floor: 'concrete', wall: 'cinder', ceil: 'concrete' });
  L.prop('stairFlight', { x: 136, z: 12, height: 2.4, steps: 8 });
  L.prop('door', { x: 136, z: 20, metal: true });
  L.light({ x: 136, z: 16, y: 4.4, color: 0xd8e8ff, intensity: 0.8, radius: 10, fixture: 'tube', flicker: 0.15 });
  L.exit({
    x: 136, z: 12, kind: 'stairs', to: 'level99', needs: 'key', label: 'NORTH-EAST STAIRS',
    say: 'Up two flights, and the air gets colder every step, and at the top there is snow blowing under the door.',
  });

  return L.finish();
}
