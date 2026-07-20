// Node smoke test for RIM CITY: imports every 3D module with DOM stubs and
// exercises rigs, clips, crews, and the arena so reference errors surface
// without a browser.
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
    console.log(`ok   rimcity ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL rimcity ${name}: ${e.message}`);
    console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  }
}

const THREE = await import('../vendor/three.module.js');

await step('teams', async () => {
  const m = await import('../rimcity/src/teams.js');
  if (m.CREWS.length < 10) throw new Error('need 10 crews, got ' + m.CREWS.length);
  for (const c of m.CREWS) {
    if (c.players.length !== 2) throw new Error(`${c.id} needs 2 players`);
    for (const p of c.players) {
      if (!(p.h > 1.6 && p.h < 2.3)) throw new Error(`${p.name} has a bad height ${p.h}`);
      for (const k of ['spd', 'three', 'dunk', 'def', 'steal', 'block', 'handle']) {
        if (!(p[k] >= 0 && p[k] <= 99)) throw new Error(`${p.name} bad ${k}`);
      }
    }
    if (!(m.overall(c) > 30 && m.overall(c) < 100)) throw new Error(`${c.id} bad overall`);
  }
  const ladder = m.runLadder('ny');
  if (ladder.length !== m.CREWS.length - 1) throw new Error('ladder size');
  if (ladder.some((c) => c.id === 'ny')) throw new Error('own crew in ladder');
  for (let r = 0; r <= 8; r++) {
    const d = m.difficultyFor(r);
    if (!(d.reaction > 0 && d.shootIQ > 0)) throw new Error('difficulty rung ' + r);
  }
});

await step('player model + clips + animator', async () => {
  const pm = await import('../rimcity/src/playerModel.js');
  const an = await import('../rimcity/src/animation.js');
  const cl = await import('../rimcity/src/clips.js');
  const { CREWS } = await import('../rimcity/src/teams.js');
  const clips = cl.makeClips();
  for (const meta of Object.keys(cl.CLIP_META)) {
    if (!clips[meta]) throw new Error(`CLIP_META references missing clip ${meta}`);
  }
  for (const crew of CREWS) {
    const kit = pm.makeKit(crew.colors);
    for (const p of crew.players) {
      const rig = pm.buildPlayer(kit, { num: p.num, build: p.build, h: p.h, look: p.look });
      for (const j of an.JOINTS) {
        if (!rig.j[j]) throw new Error(`rig missing joint ${j}`);
      }
      const a = new an.Animator(rig, clips);
      for (const name of Object.keys(clips)) {
        a.play(name, { force: true, fade: 0 });
        for (let i = 0; i < 10; i++) a.update(0.08);
      }
    }
  }
  pm.buildBall();
});

await step('arena', async () => {
  const m = await import('../rimcity/src/arena.js');
  const { CREWS } = await import('../rimcity/src/teams.js');
  const scene = new THREE.Scene();
  const arena = m.buildArena(scene, CREWS[0], CREWS[1]);
  if (arena.hoops.length !== 2) throw new Error('need 2 hoops');
  arena.jumbo.draw({ home: 12, away: 8, qtr: 'Q2', clock: '1:30', shot: 7, abbrH: 'NYC', abbrA: 'CHI' });
  arena.jumbo.draw({ marquee: 'JAM!', sub: 'TEST' });
  arena.hoops[0].shake = 1;
  arena.hoops[1].netKick = 1;
  for (let i = 0; i < 30; i++) m.updateArena(arena, i * 0.016, 0.016, 0.5);
  if (!(m.COURT.RIM_X > 0 && m.COURT.RIM_Y === 3.05)) throw new Error('court constants');
});

await step('game module parses + clips wired', async () => {
  const g = await import('../rimcity/src/game.js');
  if (!g.CLIPS.dribbleRun || !g.CLIPS.dunkTomahawk || !g.CLIPS.shootRelease) throw new Error('clips missing');
  if (typeof g.Game !== 'function') throw new Error('Game class missing');
});

await step('audio + gamepad + util parse', async () => {
  await import('../rimcity/src/audio.js');
  const gp = await import('../rimcity/src/gamepad.js');
  gp.pads.poll();
  const u = await import('../rimcity/src/util.js');
  if (u.clamp(5, 0, 3) !== 3) throw new Error('clamp');
  if (u.shade('#808080', 16) !== '#909090') throw new Error('shade');
});

console.log(failures ? `\n${failures} failure(s)` : '\nall rimcity smoke checks passed');
process.exit(failures ? 1 : 0);
