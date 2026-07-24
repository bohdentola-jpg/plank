// LEVEL ! — RUN FOR YOUR LIFE
// Red emergency light, narrow branching halls, doors that only open one way, and
// no safe rooms at all. The level is hunting: it spawns hounds behind you, for as
// long as you are in it. Everything about the layout is built to be read at a
// sprint — wide-ish corridors, clean sight lines down every branch, and a route
// that is always forward.

export const meta = {
  id: 'level_run',
  num: '!',
  name: 'RUN FOR YOUR LIFE',
  subtitle: 'do not stop',
  tagline: 'There is no clever way through this one.',
  danger: 9,
  survival: 'nearly none',
  chapter: 22,
  tape: 'TAPE 20',
  brief: `Red halls, hounds behind you from the first second, and one door at the
    end. Sprint, turn, sprint. Stopping is what kills people here.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 136, h: 136, cell: 3.4, wallH: 3.2,
    palette: { wall: 'concretePaint', floor: 'concrete', ceil: 'concrete' },
    fog: { color: 0x1a0604, density: 0.042 },
    ambient: { color: 0x2c0a08, intensity: 0.14 },
  });
  L.setAmbience({ room: 'static', hum: 0.5, drip: 0.1, wind: 0.2, music: 'chase', reverb: 0.4 });
  L.setRules({
    sanityDrain: 1.8, batteryDrain: 1.2,
    chase: { after: 4, entity: 'hound', spawnRate: 20, max: 6 },
  });
  L.setTint(1.18, 0.86, 0.82);

  // ---------------------------------------------------------------- the halls
  // Heavy braid: every junction has at least two ways out, because a dead end in
  // this level is a death and the level should be cruel, not unfair.
  L.fill(C.WALL);
  kit.gen.maze(L, { x0: 2, z0: 2, x1: 133, z1: 133, braid: 0.62, rooms: 18, roomMin: 4, roomMax: 8 });
  // widen everything by one cell: you cannot read a one-cell corridor at a sprint
  for (let z = 3; z < 132; z++) {
    for (let x = 3; x < 132; x++) {
      if (!L.isOpen(x, z)) continue;
      if (kit.chance(0.55)) L.set(x + 1, z, C.OPEN);
      if (kit.chance(0.35)) L.set(x, z + 1, C.OPEN);
    }
  }
  L.enclose();
  L.paintWhere((c) => c === C.OPEN, { floor: 'concrete', wall: 'concretePaint', ceil: 'concrete' });

  // Barricade rooms: not safe, but they have something in them worth the detour.
  const bar = [];
  for (let i = 0; i < 6; i++) {
    const [x, z] = L.randomOpen();
    L.room(x, z, x + 6, z + 6, { floor: 'metalPlate', wall: 'cinder' });
    L.set(x + 3, z + 7, C.DOOR);
    L.scatter('crateStack', 4, { where: (px, pz) => px > x && px < x + 6 && pz > z && pz < z + 6 });
    L.prop('shelf', { x: x + 1, z: z + 1, rot: 0, height: 2.0 });
    L.light({ x: x + 3, z: z + 3, y: 3.0, color: 0xffd8a0, intensity: 0.9, radius: 9, fixture: 'cage', flicker: 0.15 });
    bar.push([x + 3, z + 3]);
  }

  // ---------------------------------------------------------------- red light
  // Every fitting in the level is an emergency light, and they all work, which is
  // the only mercy on offer.
  L.lightGrid(5, 5, 131, 131, {
    every: 6, color: 0xff2a18, intensity: 0.85, radius: 9,
    fixture: 'emergencyLight', flickerChance: 0.3, deadChance: 0.05,
  });
  for (let i = 0; i < 30; i++) {
    const [x, z] = L.randomOpen();
    L.light({ x, z, y: 3.1, color: 0xff6a30, intensity: 0.5, radius: 7, fixture: 'tube', flicker: kit.rand(0.4, 1) });
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('doorFrame', 40);
  L.scatter('pipeRun', 30, { opts: { len: 6, height: 2.9 } });
  L.scatter('rubblePile', 24);
  L.scatter('clawMarks', 40);
  L.scatter('bloodTrail', 22);
  L.scatter('graffiti', 30);
  L.scatter('barrel', 16);
  L.scatter('crate', 20);
  L.scatter('skull', 10);
  L.scatter('chalkArrow', 30);
  L.scatter('tapePile', 3);

  // ---------------------------------------------------------------- pickups
  L.item('flare', { x: bar[0][0], z: bar[0][1], amount: 3 });
  L.item('flare', { x: bar[3][0], z: bar[3][1], amount: 3 });
  L.item('medkit', { x: bar[1][0], z: bar[1][1] });
  L.item('medkit', { x: bar[4][0], z: bar[4][1] });
  L.item('almondWater', { x: bar[2][0], z: bar[2][1] });
  L.item('battery', { x: bar[5][0], z: bar[5][1] });
  L.item('crowbar', { x: bar[2][0] + 1, z: bar[2][1] });
  L.item('tape', { x: bar[4][0] + 1, z: bar[4][1], id: 'tape-run', title: 'TAPE — "NINE SECONDS OF IT"' });

  // ---------------------------------------------------------------- lore
  L.note({
    x: bar[0][0], z: bar[0][1] + 1, title: 'SCRAWLED ON A CRATE, ONE LINE',
    text: `KEEP GOING. THAT IS THE WHOLE STRATEGY. I AM SORRY.`,
  });
  L.note({
    x: bar[1][0], z: bar[1][1] + 1, title: 'ON THE FLOOR, IN A HURRY',
    text: `They come from behind, always, and they keep coming, and there are always
      more. Do not clear a corridor — you cannot. Take the corner, take the next
      corner, drop a flare at the third one and do not look at what stops.`,
  });
  L.note({
    x: bar[2][0], z: bar[2][1] + 1, title: 'TAPED INSIDE A DOOR',
    text: `The doors only open one way. That is deliberate, and it is not on your
      side, and it is not on theirs either — they cannot follow you through, they go
      round, and they know the way round better than you do.`,
  });
  L.note({
    x: bar[4][0], z: bar[4][1] + 1, title: 'A TAPE LABEL, NOTHING ELSE WRITTEN',
    text: `Nine seconds of it is on this tape and I am not going to describe the
      nine seconds. If you find the door — and there is a door, east side, and it is
      grey and it is heavy and it says NO ADMITTANCE — go through it without
      slowing down.`,
  });
  L.note({
    x: bar[5][0], z: bar[5][1] + 1, title: 'BOARD BY A LIGHT FITTING',
    text: `Every light in here works. Every single one, in a place where nothing else
      is maintained. Somebody wants you to be able to see this happening to you.`,
  });

  // ---------------------------------------------------------------- company
  // The level spawns hounds behind you on a timer (rules.chase). These are the
  // ones already here.
  L.pack('hound', 4, 66, 40, 10, { state: 'hunt' });
  L.pack('hound', 3, 40, 100, 10, { state: 'patrol', leash: 50 });
  L.pack('partygoer', 4, 100, 66, 12, { state: 'patrol', leash: 30 });
  L.pack('partygoer', 3, 60, 120, 10, { state: 'dormant', wake: { after: 60 } });
  L.entity('clump', { x: 100, z: 100, state: 'guard' });
  L.entity('clump', { x: 30, z: 66, state: 'guard' });
  L.entity('howler', { x: 76, z: 20, state: 'patrol', leash: 24 });
  L.entity('howler', { x: 20, z: 120, state: 'patrol', leash: 24 });
  L.entity('crawler', { x: 120, z: 40, state: 'patrol', leash: 30 });

  // ---------------------------------------------------------------- scares
  L.scare('lightsOut', { x: 60, z: 60, radius: 8 });
  L.scare('doorSlam', { x: 90, z: 30, radius: 7 });
  L.scare('bodyFall', { x: 40, z: 80, radius: 10 });
  L.scare('crawlerDrop', { x: 110, z: 50, radius: 6 });
  L.scare('thingBehindYou', { x: 70, z: 110, radius: 6 });
  L.scare('screamDistant', { x: 30, z: 40, radius: 14 });
  L.scare('tapeGlitch', { x: 120, z: 100, radius: 8 });
  L.scare('nameOnWall', { x: 20, z: 90, radius: 6 });
  L.scare('staticBurst', { x: 100, z: 120, radius: 8 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(6, 6, Math.PI * 0.25);
  L.objective('EAST SIDE. GREY DOOR. NO ADMITTANCE. GO.');
  L.objective('Do not clear a corridor. You cannot.', { id: 'obj1' });
  L.objective('Drop a flare at the third corner.', { optional: true });

  L.trigger({ x: 12, z: 12, radius: 6, objective: 'obj1', say: 'Something started running the moment you did.' });
  L.trigger({ x: 66, z: 66, radius: 8, say: 'More of them, ahead as well as behind. Take a branch, any branch.' });
  L.trigger({ x: 124, z: 100, radius: 8, say: 'Grey door. Heavy. NO ADMITTANCE stencilled on it at chest height.' });

  L.room(126, 94, 133, 108, { floor: 'metalPlate', wall: 'cinder' });
  L.prop('doubleDoor', { x: 132, z: 101, rot: -Math.PI / 2 });
  L.light({ x: 129, z: 101, y: 3.1, color: 0xffb040, intensity: 1.0, radius: 10, fixture: 'flood' });
  L.exit({
    x: 132, z: 101, kind: 'door', to: 'level_end', label: 'NO ADMITTANCE',
    say: 'Through, and shoulder it shut, and on the other side something enormous is idling.',
  });

  return L.finish();
}
