// LEVEL 7 — THALASSOPHOBIA
// Black water in every direction under a ceiling too high to see. Concrete
// islands, half-sunk walkways, a beached houseboat, one radio mast. The swim
// between islands takes eight seconds and something enormous uses that eight
// seconds to decide about you.

export const meta = {
  id: 'level7',
  num: '7',
  name: 'THALASSOPHOBIA',
  subtitle: 'the great open water',
  tagline: 'Do not swim at all if you can help it. Time it if you can\'t.',
  danger: 8,
  survival: 'very poor',
  chapter: 10,
  tape: 'TAPE 08',
  brief: `Deep water, scattered islands, and a shape that passes underneath you.
    Island to island to the drain tower, and never stop halfway.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 150, h: 150, cell: 3.4, wallH: 11,
    palette: { wall: 'concreteWet', floor: 'concreteWet', ceil: 'void' },
    fog: { color: 0x04080c, density: 0.038 },
    ambient: { color: 0x0e1820, intensity: 0.14 },
  });
  L.setAmbience({ room: 'water', hum: 0.2, drip: 0.5, wind: 0.35, music: 'drone', reverb: 0.95 });
  L.setRules({ wetFeet: true, swimSpeed: 0.85, sanityDrain: 1.35, fallDamage: false });
  L.setTint(0.88, 0.96, 1.08);

  // ---------------------------------------------------------------- the water
  // Everything is deep water except what we build on top of it.
  L.fill(C.DEEP);
  L.floorRect(0, 0, 149, 149, -7);
  L.waterLevel = 0;
  L.paintAll({ floor: 'concreteWet', wall: 'concreteWet', ceil: 'void' });

  // ---------------------------------------------------------------- islands
  // Spaced so a crossing is 6-12 seconds of swimming. That interval is the game.
  const islands = [];
  const place = (x, z, r, tall = 0.5) => {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dz);
        if (d > r) continue;
        const px = x + dx, pz = z + dz;
        if (!L.inside(px, pz)) continue;
        L.set(px, pz, d > r - 1.2 ? C.WATER : C.OPEN);
        L.floorAt(px, pz, d > r - 1.2 ? -0.5 : tall);
        L.paint(px, pz, { floor: d > r - 1.2 ? 'concreteWet' : 'concrete' });
      }
    }
    islands.push([x, z, r]);
    return [x, z];
  };
  place(12, 12, 7, 0.6);                       // the one you wash up on
  const grid = [[46, 20, 5], [86, 14, 6], [124, 26, 5], [22, 52, 6], [62, 56, 7],
    [104, 60, 5], [136, 66, 6], [34, 92, 6], [74, 96, 7], [116, 100, 5],
    [20, 128, 6], [58, 132, 5], [96, 136, 6], [132, 132, 7]];
  for (const [x, z, r] of grid) place(x, z, r, kit.rand(0.4, 0.9));

  // Half-sunk walkways: knee-deep shortcuts between a few of them.
  const walk = (x0, z0, x1, z1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), z = Math.round(z0 + ((z1 - z0) * i) / n);
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1]]) {
        if (!L.inside(x + dx, z + dz)) continue;
        L.set(x + dx, z + dz, C.WATER);
        L.floorAt(x + dx, z + dz, -0.55);
        L.paint(x + dx, z + dz, { floor: 'metalPlate' });
      }
    }
  };
  walk(46, 20, 62, 56);
  walk(62, 56, 74, 96);
  walk(34, 92, 20, 128);
  walk(104, 60, 116, 100);

  // ---------------------------------------------------------------- landmarks
  const boat = islands[9];
  L.prop('trainCar', { x: boat[0], z: boat[1], rot: 0.4, scale: 0.7 });   // a hull, near enough
  L.prop('railing', { x: boat[0] + 3, z: boat[1] + 3, len: 8 });
  L.light({ x: boat[0], z: boat[1] + 2, y: 2.4, color: 0xffd8a0, intensity: 0.9, radius: 12, fixture: 'lantern', flicker: 0.2 });

  const mast = islands[5];
  L.prop('radioTower', { x: mast[0], z: mast[1] });
  L.light({ x: mast[0], z: mast[1], y: 14, color: 0xff3020, intensity: 1.1, radius: 30, fixture: 'none', flicker: 0.45, hum: 0 });

  for (const [x, z, r] of islands) {
    if (kit.chance(0.5)) L.prop('tent', { x: x + kit.rand(-2, 2), z: z + kit.rand(-2, 2), rot: kit.rand(0, 6) });
    if (kit.chance(0.6)) L.prop('campLight', { x: x + kit.rand(-2, 2), z: z + kit.rand(-2, 2) });
    if (kit.chance(0.4)) L.prop('sleepingBag', { x: x + kit.rand(-2, 2), z: z + kit.rand(-2, 2), rot: kit.rand(0, 6) });
    if (kit.chance(0.5)) L.prop('lifebuoy', { x: x + kit.rand(-3, 3), z: z + kit.rand(-3, 3) });
    if (kit.chance(0.4)) L.prop('boulder', { x: x + kit.rand(-3, 3), z: z + kit.rand(-3, 3) });
    L.light({
      x, z, y: 2.0, color: 0xffc890, intensity: kit.rand(0.5, 0.9), radius: r * 3,
      fixture: kit.chance(0.5) ? 'lantern' : 'campLight', flicker: kit.rand(0.05, 0.4),
    });
  }

  // ---------------------------------------------------------------- pickups
  const at = (i, dx = 0, dz = 0) => [islands[i % islands.length][0] + dx, islands[i % islands.length][1] + dz];
  L.item('battery', { x: at(0, 1)[0], z: at(0, 1)[1] });
  L.item('battery', { x: at(4)[0], z: at(4)[1] });
  L.item('almondWater', { x: at(2)[0], z: at(2)[1] });
  L.item('almondWater', { x: at(9, 2)[0], z: at(9, 2)[1] });
  L.item('medkit', { x: at(5)[0], z: at(5)[1] });
  L.item('flare', { x: at(7)[0], z: at(7)[1], amount: 3 });
  L.item('glowstick', { x: at(11)[0], z: at(11)[1], amount: 3 });
  L.item('tape', { x: at(9, 1, 1)[0], z: at(9, 1, 1)[1], id: 'tape-water', title: 'TAPE — "EIGHT SECONDS"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: at(0, 1, 1)[0], z: at(0, 1, 1)[1], title: 'WASHED UP IN A BOTTLE',
    text: `Eight seconds. That is how long the longest crossing takes at a decent
      swim. It goes under you at about six. If you are still swimming at nine you
      were never going to make it and you should have waited for it to pass.`,
  });
  L.note({
    x: at(4, 1)[0], z: at(4, 1)[1], title: 'PAINTED ON A CONCRETE SLAB',
    text: `IT DOES NOT HUNT. IT PATROLS.
      LEARN THE INTERVAL. THE INTERVAL IS LONGER THAN THE CROSSING.
      I HAVE MADE ELEVEN CROSSINGS AND I AM STILL HERE, WHICH PROVES NOTHING.`,
  });
  L.note({
    x: at(9, 2, 1)[0], z: at(9, 2, 1)[1], title: 'HOUSEBOAT LOG, LAST DRY PAGE',
    text: `Anchored here because there is nowhere to anchor to. Depth sounder
      reads 400 metres and then reads 4 and then reads 400. We have stopped
      turning it on. Marta says the water tastes like a swimming pool and she is
      right and neither of us wants to say what that means.`,
  });
  L.note({
    x: at(5, 1)[0], z: at(5, 1)[1], title: 'TAPED INSIDE THE MAST BASE',
    text: `The light at the top of the mast is on a timer nobody set. When it
      blinks fast, the water is empty. When it goes steady, do not get in.
      I do not know what is doing this. I am grateful and I do not want to know.`,
  });
  L.note({
    x: at(11, 1)[0], z: at(11, 1)[1], title: 'CARVED INTO A LIFEBUOY',
    text: `The drain tower is the tall one at the far corner with the grating on
      the side. It goes down, not up. It is dry inside for the first thirty metres.
      After that it is rock.`,
  });

  // ---------------------------------------------------------------- company
  L.entity('leviathan', { x: 74, z: 74, state: 'patrol', leash: 60, tag: 'deep' });
  L.entity('leviathan', { x: 120, z: 30, state: 'dormant', wake: { after: 180 } });
  L.pack('wretch', 4, 60, 100, 12, { state: 'patrol', leash: 24 });
  L.pack('wretch', 3, 110, 60, 12, { state: 'patrol', leash: 24 });
  L.entity('wretch', { x: 24, z: 60, state: 'patrol', leash: 20 });
  L.entity('watcher', { x: islands[13][0], z: islands[13][1], state: 'guard' });
  L.entity('deathmoth', { x: mast[0], z: mast[1] + 2, state: 'patrol', leash: 10 });
  L.entity('duller', { x: islands[8][0], z: islands[8][1], state: 'patrol', leash: 6 });

  // ---------------------------------------------------------------- scares
  L.scare('waterStir', { x: 50, z: 40, radius: 10 });
  L.scare('waterStir', { x: 96, z: 84, radius: 10 });
  L.scare('bodyFall', { x: boat[0], z: boat[1] + 4, radius: 8 });
  L.scare('breathing', { x: islands[3][0], z: islands[3][1], radius: 6 });
  L.scare('screamDistant', { x: 74, z: 20, radius: 14 });
  L.scare('staticBurst', { x: mast[0], z: mast[1] + 3, radius: 8 });
  L.scare('whisper', { x: islands[12][0], z: islands[12][1], radius: 7, text: 'Something very large exhales, a long way down.' });
  L.scare('footstepsFollow', { x: islands[7][0], z: islands[7][1], radius: 8 });

  // ---------------------------------------------------------------- the way out
  const tower = [140, 140];
  L.spawnAt(12, 12, Math.PI * 0.75);
  L.objective('Cross to the drain tower in the far south-east corner.');
  L.objective('Learn the interval. Watch the mast light before every swim.', { id: 'obj1' });
  L.objective('Do not be in open water when the mast light goes steady.', { optional: true });

  L.trigger({ x: mast[0], z: mast[1], radius: 6, objective: 'obj1', say: 'The mast light is blinking fast. That is the good one.' });
  L.trigger({ x: boat[0], z: boat[1], radius: 7, say: 'A hull, up on the concrete, with a lantern still burning inside it.' });
  L.trigger({ x: 120, z: 120, radius: 10, say: 'The far corner has a tower with a grating in its side, and the water is moving toward it.' });

  // the tower itself: a dry concrete stump with a way down
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (Math.hypot(dx, dz) > 4) continue;
      L.set(tower[0] + dx, tower[1] + dz, C.OPEN);
      L.floorAt(tower[0] + dx, tower[1] + dz, 0.8);
      L.paint(tower[0] + dx, tower[1] + dz, { floor: 'metalPlate', wall: 'rust' });
    }
  }
  L.prop('ladder', { x: tower[0], z: tower[1], height: 3.4 });
  L.prop('drainGrate', { x: tower[0] + 1, z: tower[1] + 1, scale: 1.6 });
  L.light({ x: tower[0], z: tower[1], y: 3.0, color: 0xd0e8ff, intensity: 0.9, radius: 12, fixture: 'cage', flicker: 0.2 });
  L.exit({
    x: tower[0], z: tower[1] + 1, kind: 'ladder', to: 'level8', label: 'DRAIN TOWER',
    say: 'Thirty metres of dry ladder, and then the walls stop being concrete and start being rock.',
  });

  return L.finish();
}
