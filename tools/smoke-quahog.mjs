// QUAHOG HIT & RUN headless harness: builds the town, the cast, every vehicle
// and the whole campaign with DOM stubs, so a bad plot, a mission pointing at
// nowhere or a building parked on a road surfaces without opening a browser.
const calls = [];
function stubCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'canvas') return { width: 256, height: 256 };
      if (typeof prop === 'string') return (...a) => { calls.push(prop); };
      return undefined;
    },
    set() { return true; },
  });
}
function stubCanvas() {
  return {
    width: 0, height: 0, style: {},
    getContext: () => stubCtx(),
    appendChild() {},
  };
}
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? stubCanvas() : { style: {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } }),
  createElementNS: () => stubCanvas(),
  getElementById: () => null,
  querySelector: () => null,
};
globalThis.window = globalThis;
try { globalThis.navigator ??= { userAgent: 'node' }; } catch { /* node 21+ has a getter */ }
globalThis.self = globalThis;
globalThis.requestAnimationFrame = () => 0;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}`);
    console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  }
}

const THREE = await import('../vendor/three.module.js');

await step('toon core', async () => {
  const m = await import('../quahog/src/toon.js');
  m.toon('#ff0000');
  m.flat('#00ff00');
  m.signTex('THE DRUNKEN CLAM', { sub: 'BEER' });
  m.roundedBox(2, 1, 0.5);
  m.blobShadow(0.5);
  const sky = m.skyAt(13.5);
  if (!sky.top || typeof sky.amb !== 'number') throw new Error('sky keys');
  if (!m.skyAt(2).night) throw new Error('2am should be night');
  if (m.skyAt(13).night) throw new Error('1pm should not be night');
});

await step('the cast', async () => {
  const c = await import('../quahog/src/cast.js');
  const clips = ['idle', 'walk', 'run', 'sit', 'talk', 'cheer', 'hit', 'fall'];
  for (const id of [...c.PLAYABLE, ...Object.keys(c.SUPPORTING)]) {
    const spec = c.charSpec(id);
    const rig = c.buildCharacter(spec);
    for (const jn of ['body', 'hips', 'torso', 'head', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'kneeL', 'kneeR']) {
      if (!rig.j[jn]) throw new Error(`${id} missing joint ${jn}`);
    }
    for (const clip of clips) c.poseRig(rig, clip, 1.2, { dt: 0.016 });
    c.talk(rig, 1);
    c.portrait(spec, 64);
  }
  const ped = c.buildSimplePed(c.randomPedSpec());
  for (const clip of clips) c.poseRig(ped, clip, 0.4, { dt: 0.016 });
});

await step('buildings', async () => {
  const b = await import('../quahog/src/buildings.js');
  const made = [
    b.house({}), b.randomHouse(), b.cityBlock({}), b.griffinHouse(), b.quagmireHouse(),
    b.swansonHouse(), b.brownHouse(), b.herbertHouse(), b.harringtons(), b.tubeMan(),
    b.streetSign('SPOONER ST'), b.gates(), b.drunkenClam(), b.brewery(), b.highSchool(),
    b.cityHall(), b.newsStation(), b.mall(), b.pharmacy(), b.lighthouse(), b.church(),
    b.hospital(), b.mansion(), b.performingArts(), b.policeStation(), b.airport(),
    b.airliner(), b.cabanaClub(), b.stripMall([{ name: 'A' }, { name: 'B' }]),
    b.tree('oak'), b.tree('pine'), b.tree('palm'), b.streetLamp(), b.hydrant(), b.mailbox(),
    b.bench(), b.trashCan(), b.trafficLight(), b.busStop(), b.fence(6), b.hedge(6),
    b.dumpster(), b.boat(), b.ramp(), b.billboard('X', 'Y'), b.bandStand(), b.statue('clam'),
  ];
  for (const g of made) {
    if (!g || (!g.children?.length && !g.isMesh)) throw new Error('empty building');
    if (!g.userData.animate) b.bake(g);
  }
  const tm = b.tubeMan();
  tm.userData.animate(1.4, 0.016, tm);   // the tube men have to flail
  b.setNight(true);
  b.setNight(false);
});

await step('the street plan', async () => {
  const roads = await import('../quahog/src/roads.js');
  if (roads.ROADS.length < 15) throw new Error('too few roads');
  const g = roads.roadGraph();
  if (g.nodes.length < 40) throw new Error('road graph too small');
  for (const n of g.nodes) if (!n.links.length) throw new Error('orphan junction');
  // Spooner Street must be a dead end: one end joins the network, one does not
  const ends = ['spooner'].map((name) => {
    const road = roads.ROAD_BY_NAME[name];
    return [roads.roadPoint(name, 0), roads.roadPoint(name, 1)];
  })[0];
  const joins = ends.filter((e) => g.nodes.some((n) => Math.hypot(n.x - e.x, n.z - e.z) < 12
    && n.links.some((l) => l.edge.road !== 'spooner' && l.edge.road !== 'spoonerbulb')));
  if (joins.length !== 1) throw new Error('Spooner Street should join the town at exactly one end');
  // a plot must sit clear of its own road and face it
  for (const road of roads.ROADS) {
    for (const side of [-1, 1]) {
      const p = roads.plot(road.name, 0.5, side, 14);
      const c = roads.roadPoint(road.name, 0.5);
      const away = Math.hypot(p.x - c.x, p.z - c.z);
      if (away < road.w / 2 + 12) throw new Error(`plot beside ${road.name} is too close to it`);
      // the building's front (+Z after rot) should point back at the street
      const fx = Math.sin(p.rot), fz = Math.cos(p.rot);
      const tx = (c.x - p.x) / away, tz = (c.z - p.z) / away;
      if (fx * tx + fz * tz < 0.9) throw new Error(`plot beside ${road.name} faces away from the street`);
    }
  }
});

await step('the town', async () => {
  const m = await import('../quahog/src/city.js');
  const roads = await import('../quahog/src/roads.js');
  const city = m.buildCity();
  if (city.colliders.all.length < 400) throw new Error('too few colliders: ' + city.colliders.all.length);
  if (city.landmarks.length < 20) throw new Error('too few landmarks: ' + city.landmarks.length);
  for (const id of ['griffin', 'quagmire', 'swanson', 'brown', 'herbert', 'goldman', 'clam',
    'brewery', 'school', 'cityhall', 'mall', 'police', 'hospital', 'airport', 'docks',
    'pewterschmidt', 'harrington', 'channel5', 'park', 'diner']) {
    if (!city.spots[id]) throw new Error('missing spot ' + id);
  }
  // nothing may be built on tarmac, or half the town is undrivable
  for (const road of roads.ROADS) {
    const steps = Math.max(8, Math.round(road.pts.length * 14));
    for (let i = 0; i <= steps; i++) {
      const p = roads.roadPoint(road.name, i / steps);
      const hit = city.colliders.resolve(p.x, p.z, road.w / 2 - 0.5).hit;
      if (hit && !hit.edge) throw new Error(`${road.name} blocked at (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`);
    }
  }
  if (city.animated.length < 5) throw new Error('the tube men are missing');
  city.update(1.2, 0.016);
  for (const h of [0, 6, 9, 13, 18, 21, 23]) {
    if (!m.whereIs('peter', h)) throw new Error('no schedule at hour ' + h);
  }
});

await step('vehicles', async () => {
  const v = await import('../quahog/src/vehicles.js');
  for (const key of Object.keys(v.VEHICLES)) {
    const model = v.buildVehicle(v.VEHICLES[key]);
    if (!model.wheels.length) throw new Error(key + ' has no wheels');
    const car = new v.Vehicle(model, 0, 0, 0);
    for (let i = 0; i < 60; i++) car.drive({ throttle: 1, steer: 0.4, handbrake: i > 40 }, 0.016, null);
    if (!isFinite(car.pos.x) || !isFinite(car.yaw)) throw new Error(key + ' physics blew up');
    if (Math.abs(car.speed) > v.VEHICLES[key].maxSpeed + 1) throw new Error(key + ' exceeded max speed');
  }
});

await step('the campaign', async () => {
  const m = await import('../quahog/src/missions.js');
  const st = await import('../quahog/src/story.js');
  const g = await import('../quahog/src/gags.js');
  const c = await import('../quahog/src/cast.js');
  const city = (await import('../quahog/src/city.js')).buildCity();
  if (m.LEVELS.length !== 7) throw new Error('expected 7 levels, got ' + m.LEVELS.length);
  if (m.MISSIONS.length < 30) throw new Error('expected 30+ jobs, got ' + m.MISSIONS.length);

  const checkBeats = (beats, where) => {
    if (!beats?.length) throw new Error(where + ' has no dialogue');
    for (const b of beats) {
      if (!c.charSpec(b.who)) throw new Error(where + ' unknown speaker ' + b.who);
      if (!b.line) throw new Error(where + ' beat with no line');
    }
  };
  checkBeats(st.OPENING, 'the cold open');

  const ids = new Set();
  for (const lvl of m.LEVELS) {
    if (!c.PLAYABLE.includes(lvl.char)) throw new Error('level ' + lvl.id + ' has no playable lead');
    checkBeats(lvl.intro, 'level ' + lvl.id + ' intro');
    checkBeats(lvl.outro, 'level ' + lvl.id + ' outro');
    if (!city.spots[lvl.collectible.around.spot]) throw new Error('level ' + lvl.id + ' collects near nowhere');
    if (lvl.missions.length < 4) throw new Error('level ' + lvl.id + ' is short of story jobs');
  }
  for (const mi of m.MISSIONS) {
    if (ids.has(mi.id)) throw new Error('duplicate job id ' + mi.id);
    ids.add(mi.id);
    if (!mi.objectives.length) throw new Error(mi.id + ' has no objectives');
    checkBeats(mi.brief, mi.id + ' brief');
    checkBeats(mi.outro, mi.id + ' outro');
    if (!city.spots[mi.start.spot]) throw new Error(mi.id + ' starts at unknown spot ' + mi.start.spot);
    for (const o of mi.objectives) {
      if (o.to && !city.spots[o.to.spot]) throw new Error(mi.id + ' goto unknown spot');
      if (o.around && !city.spots[o.around.spot]) throw new Error(mi.id + ' collect near unknown spot');
      if (o.type === 'race') {
        for (const [x, z] of o.route) {
          if (!city.onRoad(x, z, 9)) throw new Error(`${mi.id} checkpoint (${x}, ${z}) is not on a road`);
        }
      }
    }
    for (const r of mi.requires || []) if (!m.missionById(r)) throw new Error(mi.id + ' requires missing ' + r);
  }
  // the story has to be completable start to finish
  const save = { done: [], level: 1 };
  for (const lvl of m.LEVELS) {
    let guard = 0;
    while (!m.levelComplete(lvl.id, save)) {
      const avail = m.availableIn(lvl.id, save);
      if (!avail.length) throw new Error('level ' + lvl.id + ' deadlocks with jobs left');
      save.done.push(avail[0].id);
      if (guard++ > 30) throw new Error('level ' + lvl.id + ' never completes');
    }
  }
  const prog = m.storyProgress(save);
  if (prog.done !== prog.total) throw new Error('story did not finish');

  if (g.GAGS.length < 18) throw new Error('expected 18 cutaway gags');
  for (const gag of g.GAGS) {
    if (!city.spots[gag.at.spot]) throw new Error(gag.id + ' at unknown spot ' + gag.at.spot);
    checkBeats(gag.beats, gag.id);
    for (const cast of gag.cast) if (!c.charSpec(cast.who)) throw new Error(gag.id + ' unknown cast member');
  }
});

await step('actors, audio and hud parse', async () => {
  await import('../quahog/src/actors.js');
  await import('../quahog/src/audio.js');
  await import('../quahog/src/hud.js');
  await import('../quahog/src/cutscene.js');
});

console.log(failures ? `\n${failures} failure(s)` : '\nQUAHOG: all smoke checks passed');
process.exit(failures ? 1 : 0);
