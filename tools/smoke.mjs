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

console.log(failures ? `\n${failures} failure(s)` : '\nall smoke checks passed');
process.exit(failures ? 1 : 0);
