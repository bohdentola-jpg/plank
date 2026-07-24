// LEVEL 99 — THE WHITEOUT
// Snow to the edge of what you can see, which is about twelve metres, under a sky
// that is the same colour as the ground. Radio masts are the only landmarks and
// they are not where you left them. There is a line of people standing in the snow
// facing away from you, and they have been standing there a long time.

export const meta = {
  id: 'level99',
  num: '99',
  name: 'THE WHITEOUT',
  subtitle: 'no horizon',
  tagline: 'The cold is the level. Everything else is incidental.',
  danger: 7,
  survival: 'poor',
  chapter: 21,
  tape: 'TAPE 19',
  brief: `Open snow, dense fog, no shelter except the mast huts. Get to the radio
    shack in the far corner before the cold finishes the job.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 152, h: 152, cell: 3.6, wallH: 12,
    openSky: true,
    sky: { top: 0xd8dee4, bottom: 0xf0f2f4, stars: false },
    palette: { wall: 'snow', floor: 'snow', ceil: 'void' },
    fog: { color: 0xdfe4e8, density: 0.058 },
    ambient: { color: 0xc0c8d0, intensity: 0.55, sky: 0xe8eef2 },
  });
  L.setAmbience({ room: 'wind', hum: 0.05, drip: 0, wind: 1.0, music: 'drone', reverb: 0.15 });
  L.setRules({ cold: true, batteryDrain: 1.45, sanityDrain: 1.2, noiseLimit: 0.5 });
  L.setTint(0.98, 1.0, 1.06);

  // ---------------------------------------------------------------- the field
  L.fill(C.OPEN);
  L.paintAll({ floor: 'snow', wall: 'snow', ceil: 'void' });

  // Drifts: raised snow you have to walk round or over, and they break sight
  // lines in a level where sight lines are already twelve metres.
  const n = kit.noise(kit.randInt(1, 99999));
  for (let z = 2; z < 150; z++) {
    for (let x = 2; x < 150; x++) {
      const v = n.fbm(x / 18, z / 18, 4);
      if (v > 0.45) { L.set(x, z, C.WALL); continue; }     // a drift too steep to climb
      L.floorAt(x, z, Math.max(0, v) * 1.4);
      if (v < -0.4) L.paint(x, z, { floor: 'ice' });        // wind-scoured blue ice
    }
  }
  L.enclose();
  // and make sure it is walkable end to end whatever the noise did
  for (const [ax, az, bx, bz] of [[8, 8, 76, 76], [76, 76, 144, 144], [8, 144, 76, 76], [144, 8, 76, 76]]) {
    L.corridor(ax, az, bx, bz, 5, C.OPEN);
    L.floorRect(Math.min(ax, bx) - 2, Math.min(az, bz) - 2, Math.max(ax, bx) + 2, Math.max(az, bz) + 2, 0);
  }

  // ---------------------------------------------------------------- masts
  // Four masts with a hut at the base of each: the only warm places, and the only
  // fixed points in a level with no horizon.
  const masts = [[30, 30], [122, 34], [34, 120], [118, 116]];
  for (const [mx, mz] of masts) {
    L.disc(mx, mz, 6, C.OPEN);
    L.floorRect(mx - 6, mz - 6, mx + 6, mz + 6, 0);
    L.paintRect(mx - 6, mz - 6, mx + 6, mz + 6, { floor: 'gravel' });
    L.prop('radioTower', { x: mx, z: mz });
    L.light({ x: mx, z: mz, y: 14.2, color: 0xff3020, intensity: 1.0, radius: 24, fixture: 'none', flicker: 0.4, hum: 0 });
    // the hut
    L.room(mx + 3, mz + 3, mx + 9, mz + 8, { floor: 'plywood', wall: 'plywood', ceil: 'plywood' });
    L.ceilRect(mx + 3, mz + 3, mx + 9, mz + 8, 2.6);
    L.set(mx + 6, mz + 2, C.DOOR);
    L.prop('table', { x: mx + 6, z: mz + 5, rot: 0 });
    L.prop('radio', { x: mx + 6, z: mz + 5, y: 0.78 });
    L.prop('chair', { x: mx + 6, z: mz + 6.4, rot: Math.PI });
    L.prop('campLight', { x: mx + 8, z: mz + 4 });
    L.light({ x: mx + 6, z: mz + 5, y: 2.5, color: 0xffc880, intensity: 1.1, radius: 9, fixture: 'bulb', flicker: 0.1 });
  }

  // The frozen line: a queue of people, facing away, in the middle of nowhere.
  const line = [];
  for (let i = 0; i < 14; i++) {
    const lx = 70 + i * 1.6, lz = 60 + i * 0.4;
    line.push([Math.round(lx), Math.round(lz)]);
  }

  // ---------------------------------------------------------------- light
  // A white sky is a big soft light. Bake it broad and let the fog eat the rest.
  for (let z = 6; z < 148; z += 9) {
    for (let x = 6; x < 148; x += 9) {
      if (!L.isOpen(x, z)) continue;
      L.light({ x, z, y: 9, color: 0xeef4f8, intensity: 0.8, radius: 12, fixture: 'none', hum: 0 });
    }
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('snowDrift', 120);
  L.scatter('deadTree', 24);
  L.scatter('fencePanel', 26, { opts: { len: 3 } });
  L.scatter('signpost', 16);
  L.scatter('boulder', 20);
  L.scatter('trafficCone', 10);
  L.scatter('tent', 8);
  L.scatter('sleepingBag', 6);
  L.scatter('campLight', 8);
  L.scatter('skull', 6);
  L.scatter('carWreck', 4);
  L.scatter('tapePile', 3);

  // ---------------------------------------------------------------- pickups
  L.item('battery', { x: masts[0][0] + 6, z: masts[0][1] + 5, amount: 2 });
  L.item('battery', { x: masts[2][0] + 6, z: masts[2][1] + 5 });
  L.item('almondWater', { x: masts[1][0] + 6, z: masts[1][1] + 5 });
  L.item('almondWater', { x: masts[3][0] + 6, z: masts[3][1] + 5 });
  L.item('medkit', { x: masts[1][0] + 7, z: masts[1][1] + 6 });
  L.item('flare', { x: masts[2][0] + 7, z: masts[2][1] + 6, amount: 3 });
  L.item('tape', { x: 76, z: 62, id: 'tape-snow', title: 'TAPE — "THE QUEUE"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: masts[0][0] + 6, z: masts[0][1] + 6, title: 'MAST HUT 1, LOG BOOK',
    text: `Transmitting on the hour, receiving nothing. The mast light is on a timer
      I can't find and can't reset. I have moved the hut's thermometer three times
      to check it: minus nine, everywhere, even in here with the heater going, and
      the heater is going, and the tea is hot. Minus nine.`,
  });
  L.note({
    x: masts[1][0] + 6, z: masts[1][1] + 6, title: 'MAST HUT 2, TAPED TO THE RADIO',
    text: `You get about forty minutes out there before the shivering starts and
      about ninety before the decisions get stupid. Do not walk mast to mast in a
      straight line — you cannot walk in a straight line out there and you will
      believe you are.`,
  });
  L.note({
    x: masts[3][0] + 6, z: masts[3][1] + 6, title: 'MAST HUT 4, SCRATCHED INTO THE DOOR FRAME',
    text: `Counted the masts: four. Walked to all four in one day. Counted again from
      hut 4: five. The fifth is in the direction with no tracks in the snow, and
      there are tracks in the snow going toward it, and they are mine.`,
  });
  L.note({
    x: 77, z: 62, title: 'DROPPED BESIDE THE LINE OF PEOPLE',
    text: `Fourteen of them, standing, facing north-east, snow up to their knees and
      no drift built up against them, which means they were not standing there when
      it fell. I walked round the front of one. There is nothing wrong with its face.
      That is the worst part and I cannot explain why.`,
  });
  L.note({
    x: 140, z: 140, title: 'ON THE SHACK DOOR, PAINTED',
    text: `INSIDE IS WARM. INSIDE IS NOT RIGHT. GO IN ANYWAY — YOU HAVE NINETY
      MINUTES OUT HERE AND THE DOOR IS THE ONLY THING LEFT.`,
  });

  // ---------------------------------------------------------------- company
  for (const [lx, lz] of line) L.entity('duller', { x: lx, z: lz, state: 'guard' });
  L.pack('hound', 4, 60, 100, 12, { state: 'patrol', leash: 60 });
  L.pack('hound', 3, 110, 70, 12, { state: 'patrol', leash: 60 });
  L.pack('deathmoth', 6, masts[1][0], masts[1][1] + 2, 8, { state: 'patrol', leash: 12 });
  L.entity('watcher', { x: 76, z: 8, state: 'guard' });
  L.entity('watcher', { x: 8, z: 76, state: 'guard' });
  L.entity('faceling', { x: 100, z: 130, state: 'patrol', leash: 30 });
  L.entity('howler', { x: 40, z: 70, state: 'patrol', leash: 24 });
  L.entity('skinstealer', { x: 130, z: 90, state: 'dormant', wake: { after: 180 }, keepsDistance: 14 });

  // ---------------------------------------------------------------- scares
  L.scare('shadowCross', { x: 50, z: 50, radius: 9 });
  L.scare('whisper', { x: 80, z: 66, radius: 8, text: 'One of them, without turning round, says you are nearly there.' });
  L.scare('screamDistant', { x: 100, z: 40, radius: 14 });
  L.scare('footstepsFollow', { x: 60, z: 120, radius: 9 });
  L.scare('breathing', { x: masts[2][0] + 6, z: masts[2][1] + 5, radius: 6 });
  L.scare('staticBurst', { x: masts[0][0] + 6, z: masts[0][1] + 5, radius: 7 });
  L.scare('bodyFall', { x: 120, z: 60, radius: 10 });
  L.scare('lightsOut', { x: masts[3][0], z: masts[3][1], radius: 10 });
  L.scare('nameOnWall', { x: 140, z: 136, radius: 6 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(8, 8, Math.PI * 0.25);
  L.objective('Reach the radio shack in the far south-east corner.');
  L.objective('Warm up in the mast huts on the way. All of them, if you can.', { id: 'obj1' });
  L.objective('Do not walk in a straight line. You cannot, and you will think you are.', { optional: true });

  L.trigger({ x: masts[0][0] + 6, z: masts[0][1] + 5, radius: 5, objective: 'obj1', say: 'Warm. The kettle is hot and the thermometer still says minus nine.' });
  L.trigger({ x: 76, z: 62, radius: 8, say: 'Fourteen people, standing in the snow, facing away, with no drift built up against them.' });
  L.trigger({ x: 138, z: 138, radius: 8, say: 'A shack, and light coming out from under the door, and the light is red.' });

  L.room(138, 136, 146, 146, { floor: 'plywood', wall: 'plywood', ceil: 'plywood' });
  L.ceilRect(138, 136, 146, 146, 2.6);
  L.set(140, 135, C.DOOR);
  L.prop('door', { x: 142, z: 146, metal: false });
  L.prop('table', { x: 142, z: 141, rot: 0 });
  L.prop('radio', { x: 142, z: 141, y: 0.78 });
  L.light({ x: 142, z: 141, y: 2.5, color: 0xff4030, intensity: 1.3, radius: 12, fixture: 'bulb', flicker: 0.25 });
  L.exit({
    x: 142, z: 145, kind: 'door', to: 'level_run', label: 'RADIO SHACK',
    say: 'Inside it is warm and red and the far wall is a corridor, and the corridor is already running.',
  });

  return L.finish();
}
