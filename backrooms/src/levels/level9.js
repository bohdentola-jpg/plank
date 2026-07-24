// LEVEL 9 — THE SUBURBS
// A street of identical houses under a sky with the wrong stars, repeating in
// every direction for as long as you care to walk. Sodium streetlights, cut grass,
// one porch light on. People are standing in the front yards facing the houses,
// and they do not turn round, and one of them is walking a dog that is not there.

export const meta = {
  id: 'level9',
  num: '9',
  name: 'THE SUBURBS',
  subtitle: 'the neighbourhood',
  tagline: 'Every house is the same house. Count the differences.',
  danger: 5,
  survival: 'fair',
  chapter: 12,
  tape: 'TAPE 10',
  brief: `Night suburb, endless. Walk the street to the last house, through it,
    and out the back into the field. Don't knock.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 156, h: 156, cell: 3.4, wallH: 8,
    openSky: true,
    sky: { top: 0x05060e, bottom: 0x121826, stars: true },
    palette: { wall: 'siding', floor: 'asphalt', ceil: 'void' },
    fog: { color: 0x0a0c14, density: 0.026 },
    ambient: { color: 0x1a2030, intensity: 0.16, sky: 0x202a3c },
  });
  L.setAmbience({ room: 'wind', hum: 0.1, drip: 0.05, wind: 0.55, music: 'wrong', reverb: 0.35 });
  L.setRules({ sanityDrain: 1.05 });
  L.setTint(0.94, 0.98, 1.08);

  // ---------------------------------------------------------------- the blocks
  L.fill(C.OPEN);
  const blocks = kit.gen.blocks(L, {
    x0: 2, z0: 2, x1: 153, z1: 153, bw: 16, bh: 20, street: 8, jitter: false,
    paint: { floor: 'sidewalk' },
  });
  L.paintWhere((c, x, z) => c === C.OPEN, { floor: 'asphalt', wall: 'siding' });

  // lawns and pavements: a band of grass around each block, sidewalk outside that
  for (const [x0, z0, x1, z1] of blocks) {
    for (let z = z0 - 4; z <= z1 + 4; z++) {
      for (let x = x0 - 4; x <= x1 + 4; x++) {
        if (!L.isOpen(x, z)) continue;
        const onLawn = x >= x0 - 3 && x <= x1 + 3 && z >= z0 - 3 && z <= z1 + 3;
        L.paint(x, z, { floor: onLawn ? 'grassDry' : 'sidewalk' });
      }
    }
    // the house itself: a facade on a solid block, with a porch light
    const cx = Math.floor((x0 + x1) / 2), cz = Math.floor((z0 + z1) / 2);
    L.prop('houseFacade', { x: cx, z: cz, w: (x1 - x0) * 3.2, h: 5.6, d: (z1 - z0) * 3.0 });
    L.light({
      x: cx, z: z1 + 4, y: 2.6, color: 0xffd090, intensity: kit.chance(0.22) ? 0.75 : 0,
      radius: 8, fixture: 'bulb', dead: !kit.chance(0.22), flicker: 0.1,
    });
    for (const [px, pz] of [[x0 - 4, z0 - 4], [x1 + 4, z0 - 4], [x0 - 4, z1 + 4], [x1 + 4, z1 + 4]]) {
      if (kit.chance(0.5)) L.prop('deadTree', { x: px, z: pz });
      if (kit.chance(0.4)) L.prop('fencePanel', { x: px, z: pz + 2, len: 3, rot: Math.PI / 2 });
    }
    if (kit.chance(0.55)) L.prop('car', { x: cx + kit.rand(-2, 2), z: z1 + 5, rot: kit.chance(0.5) ? 0 : Math.PI, color: kit.pick([0x6a7480, 0x7a3a30, 0x2a4a3a, 0x8a8a80]) });
  }

  // ---------------------------------------------------------------- the streets
  // Streetlights down every road, most working, a couple not.
  for (let z = 10; z < 150; z += 14) {
    for (let x = 10; x < 150; x += 14) {
      if (!L.isOpen(x, z)) continue;
      const dead = kit.chance(0.18);
      L.prop('streetlight', { x, z, rot: kit.pick([0, Math.PI / 2, Math.PI]) });
      L.light({
        x, z: z + 1, y: 7.4, color: 0xffb058, intensity: dead ? 0 : 1.15, radius: 16,
        fixture: 'none', dead, flicker: kit.chance(0.2) ? kit.rand(0.15, 0.6) : 0,
      });
    }
  }
  L.scatter('busShelter', 4);
  L.scatter('phoneBooth', 3);
  L.scatter('trafficCone', 12);
  L.scatter('dumpster', 6);
  L.scatter('signpost', 10);
  L.scatter('shoppingCart', 6);
  L.scatter('fencePanel', 40, { opts: { len: 3 } });
  L.scatter('deadTree', 30);
  L.scatter('graffiti', 12);
  L.scatter('bloodTrail', 4);

  // ---------------------------------------------------------------- one open house
  // Number 41. The door is open, the hall light is on, and the cellar isn't shut.
  const home = blocks[Math.floor(blocks.length / 2)];
  const hx = Math.floor((home[0] + home[2]) / 2), hz = Math.floor((home[1] + home[3]) / 2);
  L.rect(home[0], home[1], home[2], home[3], C.OPEN);
  L.paintRect(home[0], home[1], home[2], home[3], { floor: 'woodFloor', wall: 'wallpaperHotel', ceil: 'ceilTile' });
  L.ceilRect(home[0], home[1], home[2], home[3], 2.7);
  L.prop('sofa', { x: hx - 2, z: hz - 2, rot: 0 });
  L.prop('tv', { x: hx - 2, z: hz + 2, rot: Math.PI });
  L.prop('diningTable', { x: hx + 3, z: hz + 2, rot: 0 });
  L.prop('bed', { x: hx + 3, z: hz - 4, rot: 0 });
  L.prop('rug', { x: hx - 2, z: hz, w: 3, d: 2 });
  L.prop('picture', { x: hx, z: home[1] + 0.6 });
  L.prop('clock', { x: hx + 2, z: home[1] + 0.6 });
  L.light({ x: hx, z: hz, y: 2.6, color: 0xffd8a8, intensity: 1.1, radius: 14, fixture: 'bulb', flicker: 0.05 });
  L.prop('trapdoor', { x: hx - 4, z: hz + 4 });

  // ---------------------------------------------------------------- pickups
  L.item('battery', { x: hx - 1, z: hz - 1 });
  L.item('almondWater', { x: hx + 2, z: hz + 2 });
  L.item('medkit', { x: hx + 3, z: hz - 3 });
  L.item('battery', { x: 6, z: 20 });
  L.item('flare', { x: 150, z: 24, amount: 2 });
  L.item('glowstick', { x: 24, z: 140, amount: 3 });
  L.item('tape', { x: hx, z: hz + 3, id: 'tape-subs', title: 'TAPE — "NUMBER 41"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: hx, z: hz + 2, title: 'ON THE FRIDGE, UNDER A MAGNET',
    text: `Shopping: milk, bread, batteries, batteries, batteries. Underneath, a
      child's handwriting: WE DON'T NEED MILK. Underneath that, the adult hand
      again: I know. I like writing it.`,
  });
  L.note({
    x: hx + 1, z: hz - 3, title: 'BEDSIDE, A HALF-FINISHED LETTER',
    text: `Dear Mum — the new place is fine. Quiet street. The neighbours keep to
      themselves and stand in their gardens a lot, which I thought was odd at
      first. You get used to it. You get used to it. You get used to it. You get`,
  });
  L.note({
    x: 6, z: 21, title: 'FLYER, PUSHED THROUGH EVERY DOOR',
    text: `NEIGHBOURHOOD WATCH — REPORT ANYTHING UNUSUAL.
      Nine boxes to tick. Eight of them are ordinary. The ninth is: SOMEONE YOU
      DO NOT RECOGNISE, WHO RECOGNISES THE STREET.`,
  });
  L.note({
    x: 150, z: 25, title: 'STAPLED TO A UTILITY POLE',
    text: `MISSING: a black dog, answers to Bee. Last seen on this street, which is
      every street. There is a man walking her on the corner every night. He holds
      the lead the right way. There is nothing on the end of it.`,
  });
  L.note({
    x: 25, z: 140, title: 'CHALKED ON A DRIVEWAY',
    text: `THE STARS ARE WRONG BUT THEY ARE CONSISTENT
      I HAVE MAPPED THEM. THEY ARE THE SAME EVERY NIGHT.
      SOMEBODY BUILT A SKY AND THEN STOPPED CARING WHETHER IT MATCHED ANYTHING`,
  });
  L.note({
    x: hx - 3, z: hz + 4, title: 'TAPED TO THE CELLAR HATCH',
    text: `Do not go down while the bell is ringing. I know what bell. So do you,
      now, because you have heard it and you have already decided it was a long
      way off and that it was probably nothing.`,
  });

  // ---------------------------------------------------------------- company
  // Facelings standing on lawns facing the houses. They ignore you unless stared at.
  for (const [x0, z0, x1, z1] of blocks) {
    if (!kit.chance(0.55)) continue;
    L.entity('faceling', { x: Math.floor((x0 + x1) / 2) + kit.randInt(-3, 3), z: z1 + 3, state: 'guard' });
  }
  L.entity('skinstealer', { x: 78, z: 20, state: 'patrol', leash: 40, keepsDistance: 12 });
  L.pack('duller', 6, 130, 130, 12, { state: 'patrol', leash: 18 });
  L.pack('duller', 4, 26, 120, 10, { state: 'patrol', leash: 14 });
  L.entity('watcher', { x: 150, z: 78, state: 'guard' });
  L.entity('howler', { x: 60, z: 140, state: 'patrol', leash: 20 });
  L.entity('mannequin', { x: hx, z: hz - 6, state: 'patrol' });

  // ---------------------------------------------------------------- scares
  L.scare('shadowCross', { x: 40, z: 40, radius: 8 });
  L.scare('doorSlam', { x: hx, z: hz + 5, radius: 6 });
  L.scare('facePressWindow', { x: hx - 3, z: hz - 5, radius: 5 });
  L.scare('phoneRing', { x: 100, z: 60, radius: 8 });
  L.scare('footstepsFollow', { x: 70, z: 100, radius: 9 });
  L.scare('whisper', { x: 120, z: 40, radius: 8, text: 'Somebody on a lawn behind you says good evening.' });
  L.scare('crowdLaugh', { x: 46, z: 130, radius: 9 });
  L.scare('lightsOut', { x: 130, z: 90, radius: 12 });
  L.scare('nameOnWall', { x: 20, z: 60, radius: 6 });
  L.scare('bodyFall', { x: 110, z: 130, radius: 9 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(8, 78, 0);
  L.objective('Walk the street to the last house, and go through it.');
  L.objective('Number 41 is the one with the hall light on.', { id: 'obj1' });
  L.objective('Don\'t stare at the people on the lawns.', { optional: true });

  L.trigger({ x: hx, z: hz, radius: 6, objective: 'obj1', say: 'The hall light is on and the kettle is warm and nobody is home.' });
  L.trigger({ x: 78, z: 78, radius: 10, say: 'You have passed this car before. Same dent, same plate, same street.' });
  L.trigger({ x: 148, z: 140, radius: 8, say: 'The pavement stops. Past the fence there is wheat, and it is daylight out there.' });

  L.room(146, 134, 152, 146, { floor: 'grassDry', wall: 'siding' });
  L.prop('fencePanel', { x: 149, z: 147, len: 6 });
  L.light({ x: 149, z: 142, y: 4, color: 0xfff0d0, intensity: 0.7, radius: 12, fixture: 'none', hum: 0 });
  L.exit({
    x: 149, z: 145, kind: 'door', to: 'level10', label: 'THE BACK FENCE',
    say: 'Over the fence, and the night stops at the fence line like a wall of it.',
  });

  L.exit({
    x: hx - 4, z: hz + 4, kind: 'trapdoor', to: 'level94', hidden: true, label: 'CELLAR HATCH',
    say: 'Cold steps, and a bell ringing somewhere below, the way a school bell rings.',
  });

  return L.finish();
}
