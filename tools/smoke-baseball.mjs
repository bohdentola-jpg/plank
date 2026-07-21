// Node smoke test for BIG INNING '27: imports every module with DOM stubs and
// exercises rigs, clips, parks, league math, and the RTG career.
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
  body: { appendChild() {} },
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

await step('ballplayer model + clips + animator', async () => {
  const pm = await import('../baseball/src/model.js');
  const an = await import('../baseball/src/animation.js');
  const cl = await import('../baseball/src/bbclips.js');
  const kit = pm.makeBBKit({
    jersey: '#f4f2e8', sleeve: '#d35f12', pants: '#f4f2e8', cap: '#d35f12', brim: '#1c1c1e',
    belt: '#d35f12', socks: '#d35f12', numberFill: '#d35f12', numberStroke: '#1c1c1e', style: 'classic',
  });
  const clips = cl.makeBBClips();
  for (const name of ['batStance', 'swing', 'swingL', 'pitchSet', 'pitchThrow', 'crouch', 'fieldReady', 'throwQuick', 'pickup', 'catchBall', 'leadoff', 'bunt']) {
    if (!clips[name]) throw new Error(`missing clip ${name}`);
  }
  for (const build of ['slim', 'avg', 'big', 'huge']) {
    const rig = pm.buildBallplayer(kit, { num: 9, build, skin: '#c68863', bats: 'L' });
    for (const j of an.JOINTS) {
      if (!rig.j[j]) throw new Error(`rig missing joint ${j}`);
    }
    pm.setHeadgear(rig, 'helmet');
    pm.setHeadgear(rig, 'cap');
    pm.setBattingGloves(rig, true);
    pm.setBattingGloves(rig, false);
    const a = new an.Animator(rig, clips);
    for (const name of Object.keys(clips)) {
      a.play(name, { force: true, fade: 0 });
      for (let i = 0; i < 12; i++) a.update(0.07);
    }
  }
  const catcher = pm.buildBallplayer(kit, { num: 27, build: 'big', skin: '#c68863' });
  const gear = pm.addCatcherGear(catcher, kit);
  if (!gear.length) throw new Error('catcher gear empty');
  pm.buildBat();
  pm.buildBaseball();
  pm.buildUmp();
});

await step('all six ballparks build', async () => {
  const pk = await import('../baseball/src/parks.js');
  if (pk.PARKS.length < 6) throw new Error('expected 6 parks, got ' + pk.PARKS.length);
  for (const park of pk.PARKS) {
    const scene = new THREE.Scene();
    const bg = pk.lightBallpark(scene, park);
    if (!bg) throw new Error(park.id + ' returned no sky color');
    const view = pk.buildBallpark(scene, park, { name: 'Copper Creek', mascot: 'Comets', colors: { primary: '#d35f12', secondary: '#1c1c1e' } });
    view.scoreboard.draw({ homeName: 'Comets', awayName: 'Stars', hr: 3, ar: 2, inning: 2, top: false, outs: 1, primary: '#d35f12' });
    view.crowd.update(1, 2);
    if (pk.wallDistFor(park, 0) <= pk.wallDistFor(park, Math.PI / 4)) throw new Error(park.id + ': wall should be deepest in center');
    if (park.tallSide && pk.wallHeightFor(park, park.tallSide === 'L' ? -0.5 : 0.5) <= park.wallHeight) {
      throw new Error(park.id + ': monster wall missing');
    }
  }
  for (let i = 0; i <= 4; i++) pk.basePos(i);
});

await step('players + league + free agents', async () => {
  const p = await import('../baseball/src/players.js');
  const club = p.genClub(2);
  if (club.length !== 12) throw new Error('club should carry 12, got ' + club.length);
  const team = p.genTeam(3, new Set());
  const order = p.battingOrder(team);
  if (order.length !== 9) throw new Error('order should be 9, got ' + order.length);
  if (order[8].pos !== 'P') throw new Error('pitcher bats ninth');
  const sim = p.simGame(team, p.genTeam(0, new Set()));
  if (sim.hr === sim.ar) throw new Error('sim must break ties');
  const fas = p.genFreeAgents(6, 2);
  if (fas.length !== 6 || !fas[0].cost) throw new Error('free agents malformed');

  const lg = await import('../baseball/src/league.js');
  const season = lg.newSeason(null);
  if (season.teams.length !== 8) throw new Error('league should have 8 clubs');
  if (season.teams.some((t) => !t.parkId)) throw new Error('every club needs a home park');
  if (season.schedule.length !== lg.SEASON_GAMES) throw new Error('bad schedule');
  for (let w = 0; w < lg.SEASON_GAMES; w++) {
    if (!lg.currentOpponent(season)) throw new Error('no opponent for week ' + season.week);
    lg.recordWeek(season, { userRuns: 5, oppRuns: 2 });
  }
  if (!season.playoffs?.made) throw new Error('14-0 club should make the playoffs');
  const semi = lg.recordPlayoff(season, { userRuns: 4, oppRuns: 1 });
  if (!semi.includes('Semifinal')) throw new Error('semifinal note: ' + semi);
  lg.recordPlayoff(season, { userRuns: 4, oppRuns: 1 });
  if (!season.champion) throw new Error('should be champions');
  const fa = season.freeAgents[0];
  season.coins = fa.cost + 10;
  const res = lg.signFreeAgent(season, fa);
  if (!res.ok) throw new Error('signing should succeed');
});

await step('road to glory career', async () => {
  const lg = await import('../baseball/src/league.js');
  const rtg = lg.newRtg({ name: 'Test Kid', num: 9, build: 'avg', look: {} }, null);
  if (rtg.schedule.length !== lg.RTG_GAMES) throw new Error('rtg schedule');
  if (!rtg.team.parkId || rtg.schedule.some((g) => !g.opp.parkId)) throw new Error('rtg parks missing');
  const ctx = lg.rtgPaContext(rtg, 1);
  if (!ctx.pitcher) throw new Error('pa context needs a pitcher');
  lg.rtgGameResult(rtg, [
    { outcome: 'single', rbi: 1, runs: 1 },
    { outcome: 'hr', rbi: 2, runs: 2 },
    { outcome: 'k', rbi: 0, runs: 0 },
    { outcome: 'bb', rbi: 0, runs: 0 },
  ]);
  if (rtg.stats.hits !== 2 || rtg.stats.hr !== 1 || rtg.stats.bb !== 1 || rtg.stats.k !== 1) {
    throw new Error('rtg stats wrong: ' + JSON.stringify(rtg.stats));
  }
  if (rtg.game !== 2) throw new Error('rtg game should advance');
  lg.rtgBuyUpgrade(rtg, 'con');
  if (!lg.rtgEvent(rtg).title) throw new Error('rtg event');
});

await step('game module parses + throw logic sanity', async () => {
  const g = await import('../baseball/src/game.js');
  if (g.PITCHES.length !== 4) throw new Error('expected 4 pitches');
  if (!g.CLIPS.swing) throw new Error('game clips missing');
  const kit = g.kitsFor({ colors: { primary: '#d35f12', secondary: '#1c1c1e' } }, true);
  if (!kit.numberOf) throw new Error('kit malformed');
});

await step('gamepad module (pads + padui shim)', async () => {
  const gp = await import('../baseball/src/gamepad.js');
  gp.pads.poll();
  if (gp.pads.p1.connected) throw new Error('no pad should be connected in node');
  const one = new gp.PadInput();
  one.poll();
  if (typeof gp.padAnnounced() !== 'boolean') throw new Error('padAnnounced shim');
});

console.log(failures ? `\n${failures} failure(s)` : '\nall baseball smoke checks passed');
process.exit(failures ? 1 : 0);
