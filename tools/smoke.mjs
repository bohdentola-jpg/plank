// Node smoke test: imports every 3D module with DOM stubs and exercises the
// builders so reference errors / bad clip data surface without a browser.
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

await step('names', async () => {
  const m = await import('../src/names.js');
  const roster = m.genRoster(2);
  if (roster.length < 22) throw new Error('roster too small');
  const rival = m.genRival('Westfield', 'Falcons');
  if (!rival.roster.length) throw new Error('rival roster empty');
});

await step('logos', async () => {
  const m = await import('../src/logos.js');
  for (const id of m.LOGO_IDS) m.logoCanvas(id, { fg: '#fff', bg: '#123', line: '#000', letter: 'W' });
});

await step('textures', async () => {
  const m = await import('../src/textures.js');
  m.brickCanvas('#9a4a32');
  m.skyCanvas();
  m.fieldCanvas({ schoolName: 'Westfield', mascot: 'Falcons', rivalName: 'Eastvale', primary: '#123', secondary: '#fb0', logo: stubCanvas() });
  m.numberCanvas(7, '#fff', '#000');
  if (m.contrastText('#ffffff') !== '#16181d') throw new Error('contrast calc');
});

await step('player model + clips + animator', async () => {
  const pm = await import('../src/playerModel.js');
  const an = await import('../src/animation.js');
  const cl = await import('../src/clips.js');
  const kit = pm.makeKit({
    jersey: '#14306e', pants: '#f2f1ec', helmet: '#14306e', sleeve: '#f2b705',
    numberFill: '#fff', numberStroke: '#f2b705', pantsStripe: '#14306e',
    helmetStripe: '#f2b705', facemask: '#2d2f33', socks: '#14306e', style: 'classic', stripes2: false,
  }, stubCanvas());
  const clips = cl.makeClips();
  for (const build of ['slim', 'avg', 'big', 'huge']) {
    const rig = pm.buildPlayer(kit, { num: 7, build, skin: '#c68863' });
    for (const j of an.JOINTS) {
      if (!rig.j[j]) throw new Error(`rig missing joint ${j}`);
    }
    const a = new an.Animator(rig, clips);
    for (const name of Object.keys(clips)) {
      a.play(name, { force: true, fade: 0 });
      for (let i = 0; i < 12; i++) a.update(0.07);
    }
  }
  pm.buildBall();
  pm.buildRef();
  pm.buildCoach('#123', '#fb0');
});

await step('school (all styles)', async () => {
  const m = await import('../src/school.js');
  for (const style of ['classic', 'brick', 'modern']) {
    const g = m.buildSchool({
      name: 'Westfield', mascot: 'Falcons',
      colors: { primary: '#14306e', secondary: '#f2b705' },
      building: { style, floors: 3, length: 3, wingL: true, wingR: true, gym: true, cupola: true, brick: '#9a4a32', buses: true },
    });
    if (!g.children.length) throw new Error('empty school');
  }
});

await step('stadium', async () => {
  const m = await import('../src/stadium.js');
  const scene = new THREE.Scene();
  const st = m.buildStadium(scene,
    { name: 'Westfield', mascot: 'Falcons', colors: { primary: '#14306e', secondary: '#f2b705' }, building: { style: 'brick', floors: 2, length: 2, wingL: true, wingR: false, gym: true, cupola: true, brick: '#9a4a32', buses: true } },
    { name: 'Eastvale', mascot: 'Vikings', colors: { primary: '#5e1f2e', secondary: '#9aa0a6' } },
    stubCanvas());
  st.scoreboard.draw({ stadium: 'Falcons Stadium', mascot: 'Falcons', headerColor: '#14306e', headerText: '#fff', home: 7, away: 3, clock: '2:00', down: '1', toGo: '10', ballOn: '25', qtr: '1' });
  st.crowd.update(1.5, 0.016);
});

await step('plays + art', async () => {
  const m = await import('../src/plays.js');
  for (const p of m.OFFENSE_PLAYS) m.drawPlayArt(p);
  for (const p of m.DEFENSE_PLAYS) m.drawDefArt(p);
});

await step('game module parses + helpers', async () => {
  const g = await import('../src/game.js');
  const { genRoster } = await import('../src/names.js');
  const picked = g.rosterPick(genRoster(2));
  for (const role of [...g.OFF_ROLES, ...g.DEF_ROLES, 'K']) {
    if (!picked[role]) throw new Error(`rosterPick missing ${role}`);
  }
  if (!g.CLIPS.run || !g.CLIPS.throwRelease) throw new Error('clips missing');
});

await step('audio module parses', async () => {
  await import('../src/audio.js');
});

await step('franchise', async () => {
  const f = await import('../src/franchise.js');
  const fr = f.newFranchise();
  if (fr.schedule.length !== 8) throw new Error('bad schedule');
  const opp = f.currentOpponent(fr);
  if (!opp.roster.length) throw new Error('no opp roster');
  f.applyDecision(fr, { morale: 2, adTrust: -5 });
  const ev = f.recordResult(fr, { won: true, home: 21, away: 7, oppName: 'Testville Tigers' });
  if (fr.week !== 2) throw new Error('week did not advance');
  for (let w = 2; w <= 8; w++) f.recordResult(fr, { won: true, home: 20, away: 10, oppName: 'X' });
  if (!f.madePlayoffs(fr)) throw new Error('should be in playoffs');
  f.recordResult(fr, { won: true, home: 20, away: 10, oppName: 'P1' });
  f.recordResult(fr, { won: true, home: 20, away: 10, oppName: 'P2' });
  f.recordResult(fr, { won: true, home: 20, away: 10, oppName: 'P3' });
  if (!fr.trophies.includes('state')) throw new Error('no state trophy: ' + fr.trophies);
  if (!fr.seasonOver) throw new Error('season should be over');
  const fresh = f.rollNewSeason(fr);
  if (!fresh.trophies.includes('state')) throw new Error('trophies must carry over');
  if (!f.practiceBonusFor('routes', 0.9)) throw new Error('practice bonus');
});

await step('plays count + custom art', async () => {
  const m = await import('../src/plays.js');
  if (m.OFFENSE_PLAYS.length < 16) throw new Error('expected 16+ plays, got ' + m.OFFENSE_PLAYS.length);
  // a custom-style rawZ play renders art
  m.drawPlayArt({
    id: 'c1', name: 'Custom', type: 'pass', rawZ: true, custom: true,
    align: { QB: [-5, 0], RB: [-5, -2], FB: [-1, -7], WR1: [-1, -13], WR2: [-1.5, 11], TE: [-0.7, 4] },
    assignments: { WR1: { route: [[6, 2], [12, -4]] }, RB: { block: true } },
    paths: {}, targets: ['WR1'],
  });
});

// ======================================================= MASCOT MELEE 64
// The fight sim is three.js-free, so most of it is covered in depth by
// tools/melee-sim.mjs. What matters here is that the *browser-side* modules
// import and build with DOM stubs: every rig, every stage, every emblem.

await step('melee: pose library', async () => {
  const { makeClips } = await import('../src/melee/poses.js');
  const { JOINTS } = await import('../src/melee/anim.js');
  const clips = makeClips();
  const names = Object.keys(clips);
  if (names.length < 40) throw new Error(`only ${names.length} clips`);
  for (const [name, c] of Object.entries(clips)) {
    if (!c.keys.length) throw new Error(`clip ${name} has no keys`);
    if (!(c.dur > 0)) throw new Error(`clip ${name} has no duration`);
    for (const k of c.keys) {
      for (const j of JOINTS) {
        if (!Array.isArray(k.p[j]) || k.p[j].length !== 3) throw new Error(`clip ${name} joint ${j} malformed`);
      }
    }
  }
});

await step('melee: every fighter builds a rig', async () => {
  const { ROSTER } = await import('../src/melee/roster.js');
  const { buildFighter, buildBlobShadow, buildPlayerRing } = await import('../src/melee/models.js');
  const { Animator } = await import('../src/melee/anim.js');
  const { makeClips } = await import('../src/melee/poses.js');
  const clips = makeClips();
  for (const def of ROSTER) {
    for (const alt of [0, 2]) {
      const rig = buildFighter(def, alt);
      if (!rig.j.hips || !rig.j.head) throw new Error(`${def.id} rig missing joints`);
      const want = 1.75 * (def.stats.size ?? 1);
      if (Math.abs(rig.height - want) > 0.001) throw new Error(`${def.id} height ${rig.height} != ${want}`);
      let tris = 0;
      rig.group.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry;
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      });
      if (tris > 1400) throw new Error(`${def.id} is ${tris | 0} triangles — too heavy for the look`);
      // pose it through every clip to catch a bad joint reference
      const anim = new Animator(rig, { ...clips, ...(def.clips || {}) });
      for (const name of Object.keys(clips)) {
        anim.play(name, { fade: 0, force: true });
        anim.update(1 / 60);
        anim.update(1 / 3);
      }
      rig.setFace('ko');
      rig.setFace('normal');
      rig.setFlash('#ffffff', 0.5);
      rig.setFlash('#ffffff', 0);
      rig.dispose();
    }
  }
  buildBlobShadow(0.5);
  buildPlayerRing('#ff0000');
});

await step('melee: every stage builds and draws its thumbnail', async () => {
  const { STAGES } = await import('../src/melee/stages.js');
  const { World } = await import('../src/melee/world.js');
  const kit = await import('../src/melee/kit.js');
  for (const st of STAGES) {
    const world = new World(st);
    const view = st.build({ THREE, world, ...kit });
    if (!view?.group) throw new Error(`${st.id} built no group`);
    view.update?.(1 / 60, { frame: 10, fighters: [], rand: () => 0.5 });
    st.thumb(stubCtx(), 288, 162);
    // the ledges the sim will offer must exist
    if (!world.ledges().length) throw new Error(`${st.id} exposes no ledges`);
  }
});

await step('melee: emblems + logo art', async () => {
  const { ROSTER } = await import('../src/melee/roster.js');
  const { emblemCanvas, nameplateCanvas, stockIconCanvas } = await import('../src/melee/portraits.js');
  for (const def of ROSTER) {
    emblemCanvas(def, 96);
    nameplateCanvas(def);
    stockIconCanvas(def, 32);
  }
  const { logoCanvas } = await import('../src/melee/menu.js');
  logoCanvas(400, 140);
});

await step('melee: sound + fx modules import clean', async () => {
  const { sfx, music, TRACK_IDS } = await import('../src/melee/sound.js');
  if (TRACK_IDS.length < 10) throw new Error(`only ${TRACK_IDS.length} music tracks`);
  const { STAGES } = await import('../src/melee/stages.js');
  for (const st of STAGES) {
    if (!TRACK_IDS.includes(st.music)) throw new Error(`${st.id} wants missing track ${st.music}`);
  }
  // with no AudioContext in node these must all no-op rather than throw
  sfx.hit('heavy', 1);
  sfx.ui('confirm');
  sfx.voice('test');
  sfx.charge(true);
  sfx.charge(false);
  music.play('menu');
  music.stop();
  await import('../src/melee/fx.js');
  await import('../src/melee/hud.js');
  await import('../src/melee/view.js');
  await import('../src/melee/menu.js');
});

await step('melee: a full match runs headless', async () => {
  const { Match } = await import('../src/melee/match.js');
  const { charById } = await import('../src/melee/roster.js');
  const { STAGES } = await import('../src/melee/stages.js');
  const { VirtualControls } = await import('../src/melee/input.js');
  const match = new Match({
    stage: STAGES[0],
    entrants: [
      { def: charById('blitz'), controls: new VirtualControls(), cpu: 6 },
      { def: charById('tusk'), alt: 1, controls: new VirtualControls(), cpu: 6 },
    ],
    rules: { mode: 'stock', stocks: 1, timeLimit: 0, items: true },
  });
  let frames = 0;
  while (!match.over && frames < 60 * 60 * 4) { match.step(); frames++; }
  if (!match.over) throw new Error('match never finished');
  if (!match.result?.order?.length) throw new Error('no result');
});

console.log(failures ? `\n${failures} failure(s)` : '\nall smoke checks passed');
process.exit(failures ? 1 : 0);
