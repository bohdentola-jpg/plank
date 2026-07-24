// LEVEL 188 — THE WINDOWS
// One corridor. Carpet, drywall, a ceiling of tiles, and windows at regular
// intervals down both walls. Through the windows: a city at night, an ocean, a
// wheat field in daylight, a room exactly like this one with somebody standing in
// it. Nothing here will hurt you. The level's entire weapon is that you will look
// twice.

export const meta = {
  id: 'level188',
  num: '188',
  name: 'THE WINDOWS',
  subtitle: 'the long hall',
  tagline: 'Look once. Everybody looks once.',
  danger: 3,
  survival: 'excellent',
  chapter: 18,
  tape: 'TAPE 16',
  brief: `A single corridor of impossible length, glazed both sides. Walk it to
    the far door. One pane is open. It is not the one you want.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 60, h: 300, cell: 3.0, wallH: 3.1,
    palette: { wall: 'drywall', floor: 'carpetOffice', ceil: 'ceilTile' },
    fog: { color: 0x0e1014, density: 0.030 },
    ambient: { color: 0x1e2228, intensity: 0.2 },
  });
  L.setAmbience({ room: 'silence', hum: 0.3, drip: 0, wind: 0.1, music: 'wrong', reverb: 0.4 });
  L.setRules({ sanityDrain: 1.5, batteryDrain: 0.9, noiseLimit: 0 });
  L.setTint(0.99, 0.99, 1.04);

  // ---------------------------------------------------------------- the corridor
  L.fill(C.WALL);
  const ribs = kit.gen.spine(L, { x: 30, len: 292, w: 5, every: 14, ribMin: 5, ribMax: 12, ribW: 2 });
  L.paintWhere((c) => c === C.OPEN, { floor: 'carpetOffice', wall: 'drywall', ceil: 'ceilTile' });

  // Windows, every four cells, both sides, with a frame prop and a pane of glass.
  const panes = [];
  for (let z = 8; z < 290; z += 4) {
    for (const [wx, dir] of [[27, -1], [33, 1]]) {
      if (!L.isOpen(wx - dir, z)) continue;
      L.set(wx, z, C.GLASS);
      L.paint(wx, z, { wall: 'glass' });
      L.prop('window', { x: wx, z, rot: dir > 0 ? Math.PI : 0, w: 2.4, h: 1.5, sill: 0.95 });
      panes.push([wx, z]);
      // whatever is on the other side has its own light, and its own colour
      const view = kit.pick([
        { c: 0xffb058, i: 0.55 },   // a city at night
        { c: 0x60c8e0, i: 0.5 },    // an ocean, overcast
        { c: 0xfff0c0, i: 0.7 },    // a wheat field at four in the afternoon
        { c: 0xd8e8ff, i: 0.4 },    // snow
        { c: 0x304050, i: 0.25 },   // a room like this one, unlit
      ]);
      L.light({ x: wx + dir, z, y: 1.6, color: view.c, intensity: view.i, radius: 7, fixture: 'none', hum: 0 });
    }
  }

  // Ceiling lights: every third one out, and the failures get worse as you go.
  for (let z = 6; z < 292; z += 6) {
    const t = z / 292;
    L.light({
      x: 30, z, y: 3.0, color: 0xf0f4e8, intensity: 0.95 - t * 0.35, radius: 10,
      fixture: 'panel', flicker: kit.chance(0.1 + t * 0.5) ? kit.rand(0.2, 0.9) : 0,
      dead: kit.chance(t * 0.35),
    });
  }

  // A handful of alcoves off the ribs: a chair, a water cooler, a payphone. The
  // furniture of a building that has corridors and nothing else.
  for (const [rx0, rz0, rx1] of ribs) {
    if (!kit.chance(0.5)) continue;
    const px = (rx0 + rx1) / 2;
    L.prop(kit.pick(['armchair', 'watercooler', 'payphone', 'plant', 'trashcan', 'picture']), {
      x: px, z: rz0, rot: kit.rand(0, 6.28),
    });
  }
  L.scatter('picture', 30);
  L.scatter('noteSheet', 24);
  L.scatter('clock', 12);
  L.scatter('graffiti', 14);
  L.scatter('chalkArrow', 20);
  L.scatter('tapePile', 3);
  L.scatter('mirrorPanel', 6);

  // ---------------------------------------------------------------- pickups
  L.item('battery', { x: 30, z: 40 });
  L.item('battery', { x: 30, z: 180 });
  L.item('almondWater', { x: 30, z: 110 });
  L.item('almondWater', { x: 30, z: 250 });
  L.item('medkit', { x: 30, z: 200 });
  L.item('tape', { x: 30, z: 146, id: 'tape-windows', title: 'TAPE — "PANE 41"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: 30, z: 42, title: 'ON THE CARPET, FIRST HUNDRED METRES',
    text: `Rules for the corridor, from someone who walked it: look at each window
      once, on the way past, without stopping. Do not look back at one you have
      already passed. If you see somebody in a window, keep walking at the same
      speed, and do not wave, because they will.`,
  });
  L.note({
    x: 30, z: 112, title: 'PINNED AT ABOUT PANE 30',
    text: `I have counted 812 windows and I have not reached the end. The views do
      not repeat and none of them are of anywhere I have been, except two, and both
      of those are of corridors, and in both of those corridors somebody was walking
      away from me at exactly my pace.`,
  });
  L.note({
    x: 30, z: 148, title: 'FOLDED INTO A WINDOW FRAME',
    text: `Pane 41 opens. I have opened it. There is a city on the other side and the
      air smells of wet asphalt and it is a city I have been in. If you go through it
      you are going backwards, and back is not the direction any of us needs, and I
      am going to go through it anyway.`,
  });
  L.note({
    x: 30, z: 204, title: 'WRITTEN ON THE BACK OF A PICTURE FRAME',
    text: `The corridor gets darker toward the end. Not gradually — in steps, at
      every fourteenth window. I have stopped counting the windows and started
      counting the steps, and there have been nine, and I think there are eleven.`,
  });
  L.note({
    x: 30, z: 268, title: 'AT THE FAR END, VERY NEATLY WRITTEN',
    text: `There is a door. It has a bar and it opens and it is not locked and it
      never has been. I sat in front of it for what felt like two days because after
      a while a corridor is easier than a door.`,
  });

  // ---------------------------------------------------------------- company
  // Almost nothing. That is the point. The windows do the work.
  for (let i = 0; i < 14; i++) {
    const p = panes[Math.floor((i / 14) * panes.length)];
    if (p) L.entity('windows', { x: p[0], z: p[1], state: 'guard' });
  }
  L.entity('watcher', { x: 30, z: 288, state: 'guard' });
  L.entity('faceling', { x: 30, z: 160, state: 'patrol', leash: 30 });
  L.entity('mannequin', { x: 30, z: 230, state: 'patrol' });
  L.entity('duller', { x: 30, z: 90, state: 'patrol', leash: 20 });

  // ---------------------------------------------------------------- scares
  // Escalating cadence: sparse at the start, on top of each other by the end.
  L.scare('facePressWindow', { x: 30, z: 60, radius: 6 });
  L.scare('shadowCross', { x: 30, z: 96, radius: 7 });
  L.scare('mirrorFigure', { x: 30, z: 130, radius: 6 });
  L.scare('facePressWindow', { x: 30, z: 168, radius: 6 });
  L.scare('whisper', { x: 30, z: 190, radius: 7, text: 'Through the glass, muffled: "you walked past me."' });
  L.scare('thingBehindYou', { x: 30, z: 212, radius: 6 });
  L.scare('staticBurst', { x: 30, z: 232, radius: 7 });
  L.scare('tapeGlitch', { x: 30, z: 248, radius: 7 });
  L.scare('lightsOut', { x: 30, z: 262, radius: 8 });
  L.scare('breathing', { x: 30, z: 276, radius: 6 });
  L.scare('nameOnWall', { x: 30, z: 284, radius: 6 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(30, 6, 0);
  L.objective('Walk to the far end of the corridor.');
  L.objective('Look at each window once. Once.', { id: 'obj1' });
  L.objective('Find the pane that opens. Decide whether to use it.', { optional: true });

  L.trigger({ x: 30, z: 40, radius: 6, objective: 'obj1', say: 'Windows, both sides, as far as the corridor goes. None of them are of here.' });
  L.trigger({ x: 30, z: 150, radius: 6, say: 'This one is open. The air coming through it smells of wet asphalt.' });
  L.trigger({ x: 30, z: 270, radius: 6, say: 'A door with a push bar. The first door in a very long time.' });

  L.room(26, 288, 34, 296, { floor: 'carpetOffice', wall: 'drywall' });
  L.prop('doubleDoor', { x: 30, z: 295, rot: 0 });
  L.light({ x: 30, z: 293, y: 3.0, color: 0xffb0c8, intensity: 0.8, radius: 9, fixture: 'bulb', flicker: 0.2 });
  L.exit({
    x: 30, z: 295, kind: 'door', to: 'level_fun', label: 'THE DOOR',
    say: 'Warm air, and muzak, and a great many people being pleased at once.',
  });

  // Pane 41 — the one that opens, and goes backwards.
  const pane41 = panes[40] || panes[0];
  L.exit({
    x: pane41[0], z: pane41[1], kind: 'window', to: 'level11', hidden: true, label: 'PANE 41',
    say: 'You go through the window and land on wet asphalt in fog, which you have done before.',
  });

  return L.finish();
}
