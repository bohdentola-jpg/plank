// Node smoke test for FOCUS GROUP: imports every module with DOM stubs and
// builds all three sets, so reference errors, bad recipe names and broken
// story wiring surface without a browser.
const calls = [];
function stubCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'createPattern') return () => ({});
      if (prop === 'getImageData' || prop === 'createImageData') {
        return (a, b, w = 256, h = 256) => {
          const W = typeof a === 'number' && arguments.length <= 2 ? a : w;
          const H = typeof b === 'number' && arguments.length <= 2 ? b : h;
          const n = Math.max(1, (W || 256) * (H || 256) * 4);
          return { data: new Uint8ClampedArray(n), width: W || 256, height: H || 256 };
        };
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
    width: 256, height: 256, style: {},
    getContext: () => stubCtx(),
    toDataURL: () => 'data:,',
    appendChild() {},
  };
}
const stubEl = () => ({
  style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '', value: '',
  appendChild() {}, removeChild() {}, remove() {}, insertAdjacentHTML() {},
  addEventListener() {}, removeEventListener() {}, setAttribute() {}, focus() {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  querySelector: () => stubEl(), querySelectorAll: () => [],
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }),
  children: [],
});
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? stubCanvas() : stubEl()),
  createElementNS: () => stubCanvas(),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener() {},
  body: stubEl(),
  exitPointerLock() {},
};
globalThis.window = globalThis;
try { globalThis.navigator ??= { userAgent: 'node' }; } catch { /* node 21+ */ }
globalThis.self = globalThis;
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.performance ??= { now: () => Date.now() };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { search: '' };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;

let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`ok   focusgroup ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL focusgroup ${name}: ${e.message}`);
    console.error(e.stack.split('\n').slice(1, 5).join('\n'));
  }
}

const THREE = await import('../vendor/three.module.js');
globalThis.THREE = THREE;

const story = await import('../focusgroup/src/story.js');
const util = await import('../focusgroup/src/util.js');
const textures = await import('../focusgroup/src/textures.js');
const worldMod = await import('../focusgroup/src/world.js');
const props = await import('../focusgroup/src/props.js');
const apartment = await import('../focusgroup/src/apartment.js');
const basement = await import('../focusgroup/src/basement.js');
const studio = await import('../focusgroup/src/studio.js');

// ------------------------------------------------------------------ content

await step('the week is six mornings, in order', async () => {
  if (story.DAYS.length !== 6) throw new Error(`the week is ${story.DAYS.length} days long`);
  story.DAYS.forEach((d, i) => {
    if (d.n !== i + 1) throw new Error(`day ${i} says it is day ${d.n}`);
    if (!d.weekday || !d.title || !d.listHead) throw new Error(`day ${d.n} is missing its heading`);
    if (!d.steps.length) throw new Error(`day ${d.n} has nothing to do`);
    const last = d.steps.filter((s) => s.last);
    if (last.length !== 1) throw new Error(`day ${d.n} has ${last.length} ways to end`);
    const ids = new Set();
    d.steps.forEach((s) => {
      if (ids.has(s.id)) throw new Error(`day ${d.n} lists '${s.id}' twice`);
      ids.add(s.id);
    });
  });
});

await step('every cut comes from a lens that exists that day', async () => {
  for (const d of story.DAYS) {
    for (const id of d.lenses) {
      if (!story.LENSES[id]) throw new Error(`day ${d.n} wants a lens called '${id}'`);
    }
    // the four gifts arrive mid-morning, so a gift day may cut to one
    const gifts = d.dress?.gifts ? ['mug', 'lamp', 'figurine', 'alarm'] : [];
    for (const b of d.beats) {
      if (!b.cut) continue;
      if (!d.lenses.includes(b.cut.lens) && !gifts.includes(b.cut.lens)) {
        throw new Error(`day ${d.n} cuts to '${b.cut.lens}', which is not in the flat yet`);
      }
    }
  }
});

await step('every beat fires on something the day can produce', async () => {
  for (const d of story.DAYS) {
    const stepIds = d.steps.map((s) => s.id);
    for (const b of d.beats) {
      const [kind, arg] = b.on.split(':');
      if ((kind === 'step' || kind === 'after') && !stepIds.includes(arg)
          && !(arg === 'tv' && d.n === 4)) {
        throw new Error(`day ${d.n} has a beat on '${b.on}' but no step '${arg}'`);
      }
      if (b.unlock && !stepIds.includes(b.unlock)) {
        throw new Error(`day ${d.n} unlocks '${b.unlock}', which is not a step`);
      }
      if (b.note && !story.NOTES[b.note]) throw new Error(`day ${d.n} reads a note '${b.note}' that is not written`);
      if (b.ad !== undefined && !story.ADS[b.ad]) throw new Error(`day ${d.n} plays ad ${b.ad}, which does not exist`);
    }
  }
});

await step('the lenses escalate and never go backwards', async () => {
  let prev = 0;
  for (const d of story.DAYS.slice(0, 5)) {
    if (d.lenses.length < prev) throw new Error(`day ${d.n} has fewer lenses than the day before`);
    prev = d.lenses.length;
  }
  if (Object.keys(story.LENSES).length !== 12) {
    throw new Error(`there are ${Object.keys(story.LENSES).length} lenses; the game says twelve`);
  }
  const nums = new Set();
  for (const [id, l] of Object.entries(story.LENSES)) {
    if (nums.has(l.cam)) throw new Error(`two lenses are both CAM ${l.cam} (${id})`);
    nums.add(l.cam);
  }
});

await step('the cuts get longer every morning', async () => {
  const days = story.DAYS.slice(0, 4);
  for (let i = 1; i < days.length; i++) {
    if (days[i].cutBudget.max < days[i - 1].cutBudget.max) {
      throw new Error(`day ${days[i].n} cuts away for less time than day ${days[i - 1].n}`);
    }
  }
  if (story.DAYS[0].cutBudget.count !== 1) throw new Error('Tuesday should cut exactly once');
});

await step('every advertisement can be played', async () => {
  const all = [story.COLD_OPEN, story.FINAL_AD, ...Object.values(story.ADS)];
  for (const ad of all) {
    if (!ad.shots?.length) throw new Error(`${ad.id} has no shots`);
    for (const [caption, secs, shot] of ad.shots) {
      if (!(secs > 0)) throw new Error(`${ad.id} has a shot of ${secs}s`);
      if (typeof shot !== 'string') throw new Error(`${ad.id} has a shot with no set-up`);
      if (typeof caption !== 'string') throw new Error(`${ad.id} has a bad caption`);
    }
  }
  if (story.BRAND.tagline.length !== 6) throw new Error('there should be one tagline a morning');
});

await step('the survey answers all come back at you', async () => {
  story.SURVEY.questions.forEach((q, i) => {
    if (q.a.length !== q.echo.length) throw new Error(`question ${i + 1} has ${q.a.length} answers and ${q.echo.length} replies`);
  });
  const survey = await import('../focusgroup/src/survey.js');
  const echo = survey.surveyEcho([0, 1, 0, 3]);
  if (!echo || echo.length < 10) throw new Error('the announcer has nothing to say back');
  if (!survey.surveyEcho(null)) throw new Error('an unanswered card should still get a line');
});

// ------------------------------------------------------------------ engine

await step('every surface recipe draws', async () => {
  const names = Object.keys(textures.RECIPES);
  if (names.length < 15) throw new Error(`only ${names.length} surfaces in the flat`);
  for (const n of names) {
    const m = textures.material(n);
    if (!m || !m.map) throw new Error(`${n} produced no texture`);
    if (!(textures.tileScale(n) > 0)) throw new Error(`${n} has no tile scale`);
  }
  textures.valFace(64);
  textures.valcoLogo(128, 64);
  textures.logoCanvas('FOCUS GROUP', 256, 64);
  textures.liveCanvas(32, 32);
});

await step('the flat is built and you can stand in it', async () => {
  const day = story.dayByNumber(4);
  const w = apartment.buildFlat({ ...day.dress, lenses: day.lenses }, day.light, 'sodium');
  if (w.colliders.length < 30) throw new Error(`the flat has only ${w.colliders.length} colliders`);
  if (w.rooms.length !== 5) throw new Error(`the flat has ${w.rooms.length} rooms`);
  const spawn = apartment.SPAWN;
  if (w.roomAt(spawn.x, spawn.z) !== 'bedroom') throw new Error('you do not wake up in the bedroom');
  if (w.blocked(spawn.x, spawn.z, 0)) throw new Error('you wake up inside a wall');
  for (const r of ['living', 'kitchen', 'hall', 'bedroom', 'bathroom']) {
    const room = w.rooms.find((x) => x.id === r);
    const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
    if (!w.floorMatAt(cx, cz)) throw new Error(`${r} has no floor`);
  }
});

await step('you can walk from the bed to the front door', async () => {
  const day = story.dayByNumber(1);
  const w = apartment.buildFlat({ ...day.dress, lenses: day.lenses }, 0, 'sodium');
  // a coarse flood fill over the walkable plane; the door must be reachable
  const step = 0.22;
  const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const start = { x: apartment.SPAWN.x, z: apartment.SPAWN.z };
  const seen = new Set([key(start.x, start.z)]);
  const queue = [start];
  let reachedDoor = false;
  let guard = 0;
  while (queue.length && guard++ < 40000) {
    const p = queue.shift();
    if (p.x > 2.7 && p.z > -5.0 && p.z < -3.9) reachedDoor = true;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const nx = p.x + dx, nz = p.z + dz;
      const k = key(nx, nz);
      if (seen.has(k)) continue;
      seen.add(k);
      if (w.blocked(nx, nz, 0, 0.26)) continue;
      queue.push({ x: nx, z: nz });
    }
  }
  if (!reachedDoor) throw new Error('the front door cannot be reached from the bed');
  if (seen.size < 200) throw new Error('the flat is barely walkable');
});

await step('every lens has an angle and every angle has a lens', async () => {
  const day = story.dayByNumber(4);
  const w = apartment.buildFlat({ ...day.dress, lenses: day.lenses }, day.light, 'sodium');
  for (const id of day.lenses) {
    const spot = w.camSpots.get(id);
    if (!spot) throw new Error(`day 4 lists lens '${id}' but the flat has no camera there`);
    if (spot.num !== story.LENSES[id].cam) {
      throw new Error(`'${id}' is CAM ${spot.num} in the flat and CAM ${story.LENSES[id].cam} in the notes`);
    }
    if (!w.interactById(`lens:${id}`)) throw new Error(`'${id}' cannot be noticed`);
    // the shot has to be pointed somewhere inside the flat
    const { pos, look } = spot;
    if (Math.abs(pos.x) > 6 || Math.abs(pos.z) > 12) throw new Error(`'${id}' is mounted outside the block`);
    if (pos.distanceTo(look) < 0.4) throw new Error(`'${id}' is looking at itself`);
  }
});

await step('the gift slots are all real places in the flat', async () => {
  const w = apartment.buildFlat({ gifts: false, lenses: [] }, 0, 'sodium');
  for (const s of apartment.GIFT_SLOTS) {
    if (!w.rooms.find((r) => r.id === s.room)) throw new Error(`slot '${s.id}' is in a room called ${s.room}`);
    if (s.y < 0.1 || s.y > 2.5) throw new Error(`slot '${s.id}' is at ${s.y}m`);
  }
  const ids = new Set(apartment.GIFT_SLOTS.map((s) => s.id));
  if (ids.size !== apartment.GIFT_SLOTS.length) throw new Error('two gift slots share an id');
  if (apartment.GIFT_SLOTS.length < 4) throw new Error('there are four gifts and fewer places to put them');
});

await step('the basement is built and the door is at the end of it', async () => {
  const w = basement.buildBasement({});
  if (!w.interactById('bell')) throw new Error('there is no bell');
  if (!w.interactById('panel')) throw new Error('there is no panel');
  const door = w.interactById('door');
  if (!door) throw new Error('there is no door');
  if (door.enabled) throw new Error('the door is open before anybody rings');
  if (w.blocked(basement.BASEMENT_SPAWN.x, basement.BASEMENT_SPAWN.z, 0)) {
    throw new Error('the lift car has somebody else in it');
  }
  if (!w.camSpots.get('corridor') || !w.camSpots.get('liftcar')) throw new Error('nothing is watching the basement');
  w.update(0.1, {});
});

await step('the soundstage is built and the audience is in it', async () => {
  const w = studio.buildStudio({});
  if (w.blocked(studio.STUDIO_SPAWN.x, studio.STUDIO_SPAWN.z, 0)) throw new Error('you wake up inside the sofa');
  for (const id of ['monitors', 'window', 'val', 'mark', 'line', 'lens:last']) {
    if (!w.interactById(id)) throw new Error(`the set is missing '${id}'`);
  }
  if (w.interactById('lens:last').enabled) throw new Error('the thirteenth camera should start hidden');
  for (const id of ['studio-wide', 'studio-close', 'studio-high', 'studio-house', 'studio-mon', 'last']) {
    if (!w.camSpots.get(id)) throw new Error(`the gallery has no '${id}'`);
  }
  if (studio.MARKS.length < 3) throw new Error('there are not enough marks to hit');
  for (const m of studio.MARKS) {
    if (w.blocked(m.x, m.z, 0)) throw new Error(`the '${m.id}' mark is inside something`);
  }
  if (!w.props.val || w.props.val.group.visible) throw new Error('VAL should not be out yet');
  w.props.rigUp(1);
  w.props.rigUp(0);
});

await step('the mascot, the avatar and the animator all hold together', async () => {
  const w = new worldMod.World('t');
  const val = props.valMascot(w, 0, 0, {});
  if (!val.head || !val.face) throw new Error('VAL has no head');
  const av = props.avatar({});
  if (av.legs.length !== 2 || av.arms.length !== 2) throw new Error('the stand-in is the wrong shape');
  for (let i = 0; i < 20; i++) props.poseAvatar(av, i / 10, i * 0.07, 0.2);
  if (!Number.isFinite(av.group.position.y)) throw new Error('the walk cycle blew up');
});

await step('the collider maths survives a turn', async () => {
  const w = new worldMod.World('t');
  w.solidRot(0, 0, 2, 0.5, 0, 1, Math.PI / 2);
  const c = w.colliders[0];
  if (Math.abs((c.x1 - c.x0) - 0.5) > 0.01) throw new Error('a quarter turn did not swap the extents');
  if (Math.abs((c.z1 - c.z0) - 2) > 0.01) throw new Error('a quarter turn did not swap the extents');
});

await step('the walls take their holes where they are told', async () => {
  const w = new worldMod.World('t');
  w.wall(0, 0, 4, 0, 'wallpaper', { holes: [{ at: 1, w: 0.9, y0: 0, y1: 2 }] });
  const low = w.colliders.filter((c) => c.y0 < 0.5);
  const gap = low.every((c) => !(1.2 > c.x0 && 1.6 < c.x1));
  if (!gap) throw new Error('the doorway was bricked up');
  if (!low.length) throw new Error('the wall is not solid anywhere');
});

await step('util does arithmetic', async () => {
  if (util.clamp(5, 0, 1) !== 1) throw new Error('clamp');
  if (Math.abs(util.damp(0, 1, 1e9, 1) - 1) > 1e-6) throw new Error('damp');
  const r = util.rng(7);
  const a = [r(), r(), r()];
  const r2 = util.rng(7);
  if ([r2(), r2(), r2()].some((v, i) => v !== a[i])) throw new Error('the same seed gave a different week');
  if (util.fmtClock(6 * 3600 + 41 * 60 + 7) !== '06:41:07') throw new Error('fmtClock');
  if (!util.fmtStamp(0, 0).startsWith('74-03-05')) throw new Error('fmtStamp');
  const n = new util.Noise2(3);
  const v = n.fbm(0.3, 0.7, 4);
  if (!(v >= 0 && v <= 1)) throw new Error(`noise returned ${v}`);
});

await step('the runtime modules parse', async () => {
  await import('../focusgroup/src/audio.js');
  await import('../focusgroup/src/surveil.js');
  await import('../focusgroup/src/player.js');
  await import('../focusgroup/src/cameras.js');
  await import('../focusgroup/src/hud.js');
  await import('../focusgroup/src/ad.js');
  await import('../focusgroup/src/save.js');
  await import('../focusgroup/src/gallery.js');
});

await step('the advertisement paints every set-up it can be asked for', async () => {
  const { AdReel } = await import('../focusgroup/src/ad.js');
  const reel = new AdReel({});
  const names = new Set();
  [story.COLD_OPEN, story.FINAL_AD, ...Object.values(story.ADS)]
    .forEach((ad) => ad.shots.forEach((s) => names.add(s[2])));
  const ctx = stubCtx();
  for (const name of names) {
    reel.script = { shots: [['a caption', 1, name]] };
    reel.shot = 0;
    reel.shotT = 0.5;
    reel.playing = true;
    reel.paint(ctx, 320, 240, { film: true });
  }
});

await step('a player walks into walls instead of through them', async () => {
  const { Player } = await import('../focusgroup/src/player.js');
  const day = story.dayByNumber(1);
  const w = apartment.buildFlat({ ...day.dress, lenses: day.lenses }, 0, 'sodium');
  const p = new Player({});
  p.spawn(apartment.SPAWN.x, apartment.SPAWN.z, apartment.SPAWN.yaw);
  for (let i = 0; i < 600; i++) {
    p.turn(Math.sin(i * 0.37) * 40, 0);
    p.update(1 / 60, { fwd: 1, back: 0, left: 0, right: 0, run: i % 3 === 0 ? 1 : 0 }, w);
  }
  if (!Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.z)) throw new Error('the player left the coordinate system');
  if (w.blocked(p.pos.x, p.pos.z, 0, p.radius)) throw new Error('the player ended up inside geometry');
  if (p.pos.x < -4.4 || p.pos.x > 3.8 || p.pos.z < -9.0 || p.pos.z > 1.8) {
    throw new Error(`the player walked out of the flat to (${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`);
  }
});

console.log(failures ? `\n${failures} failure(s)` : '\nall focusgroup smoke checks passed');
process.exit(failures ? 1 : 0);
