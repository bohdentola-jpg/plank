// The race screen: "please stand by" while the world builds, then the race
// with HUD, a VCR-style pause menu, and the results board.
// Params: { trackDef|track, spec|car, look, upgrades, opponents:[{spec,look,upgrades,name,skill}|carId],
//           type, laps, playerGrid, rubber, onDone(results) → handled by caller, back }
// Dev: ?screen=race&track=downtown&car=lancet&opponents=kaze,suprano,m3
import { registerScreen, game, go } from '../main.js';
import { RaceSession } from '../race/session.js';
import { HUD } from '../race/hud.js';
import { drawReplayOSD } from '../race/replayOsd.js';
import { TRACK_BY_ID, TRACKS } from '../track/tracks.js';
import { CAR_BY_ID, CARS } from '../car/cars.js';
import { C, vText, text, panel, hints, osd } from '../core/ui.js';
import { Menu, uiSound } from '../core/menu.js';
import { input } from '../core/input.js';
import { settings, store } from '../core/settings.js';
import { fmtTime, ordinal } from '../core/util.js';
import { audio } from '../audio/audio.js';
import { music } from '../audio/music.js';

const AI_NAMES = ['ACE', 'MIKA', 'RAVEN', 'RYU', 'JINX', 'NOVA', 'JUNO', 'BISHOP', 'BRICK', 'SPOOK', 'LUCKY', 'SKIDS', 'BLADE', 'DRIFTER', 'ONYX', 'CASS'];

registerScreen('race', () => {
  let session = null;
  let hud = null;
  let params = {};
  let loading = { f: 0, label: 'PLEASE STAND BY' };
  let pauseMenu = null;
  let resultsMenu = null;
  let resultsT = 0;
  let results = null;

  const buildOpponents = (p, spec) => {
    // a fresh crew of names each time (fixed once per params so RACE AGAIN keeps them)
    if (!p._names) p._names = AI_NAMES.slice().sort(() => Math.random() - 0.5);
    const names = p._names;
    if (p.opponents) {
      return p.opponents.map((o, k) => {
        if (typeof o === 'string') return { spec: CAR_BY_ID[o], name: names[k % names.length], skill: 0.75 };
        return { name: names[k % names.length], skill: 0.75, ...o };
      });
    }
    // dev default: 5 rivals in the same class
    const pool = CARS.filter((c) => c.cls === spec.cls && c.id !== spec.id);
    const list = [];
    for (let k = 0; k < 5; k++) list.push({ spec: pool[k % pool.length] || spec, name: names[k], skill: 0.62 + k * 0.07 });
    return list;
  };

  const makePause = () => new Menu([
    { label: 'RESUME', id: 'resume' },
    { label: 'RESTART RACE', id: 'restart' },
    {
      label: 'TRANSMISSION', type: 'choice', options: [{ value: 'auto', label: 'AUTO' }, { value: 'manual', label: 'MANUAL' }],
      get: () => settings.get('transmission'), set: (v) => { settings.set('transmission', v); if (session) session.sim.opts.auto = v !== 'manual'; },
    },
    {
      label: 'CAMERA', type: 'choice', options: [{ value: 0, label: 'CHASE FAR' }, { value: 1, label: 'CHASE' }, { value: 2, label: 'BUMPER' }, { value: 3, label: 'HOOD' }],
      get: () => session?.camera.mode ?? 1, set: (v) => { session?.camera.setMode(v); settings.set('camera', v); },
    },
    {
      label: 'MUSIC', type: 'slider', step: 0.1, min: 0, max: 1,
      get: () => settings.get('volMusic'), set: (v) => { settings.set('volMusic', v); audio.setVolumes({ music: v }); },
    },
    { label: params.quitLabel || 'QUIT RACE', id: 'quit' },
  ], { id: 'pause' });

  const finishResults = () => {
    const sim = session.sim;
    results = {
      track: session.def.id, type: session.type,
      place: session.player.out ? null : session.player.place,
      out: !!session.player.out,
      time: session.player.finishTime,
      bestLap: session.player.bestLap,
      order: session.type === 'drift'
        ? [...sim.driftRivals.map((x) => ({ name: x.name, car: null, score: x.score })), { name: session.player.name, car: session.player.spec.id, score: session.player.driftTotal || 0, player: true }].sort((a, b) => b.score - a.score)
        : sim.finishOrder.map((r) => ({ name: r.name, car: r.spec.id, time: r.finishTime, best: r.bestLap, player: r.isPlayer, estimated: r.estimated, out: r.out })),
      score: session.player.driftTotal,
      racers: sim.racers.length,
      target: session.target || null,
      beat: session.target ? !!(session.player.bestLap && (sim.T.closed ? session.player.bestLap : session.player.finishTime) <= session.target) : null,
    };
    if (session.target && !sim.T.closed) results.bestLap = session.player.finishTime;
    try { saveRecords(results); } catch (e) { console.warn('records', e); }
    if (params.onResult) {
      try { results.summary = params.onResult(results); } catch (e) { console.warn('result', e); }
    }
    const items = [];
    if (params.onDone) items.push({ label: 'CONTINUE', id: 'continue' });
    items.push({ label: 'RACE AGAIN', id: 'restart' });
    if (session.canReplay) items.splice(1, 0, { label: 'WATCH REPLAY', id: 'replay' });
    if (!params.onDone) items.push({ label: 'CHANGE CAR / TRACK', id: 'setup' }, { label: 'MAIN MENU', id: 'menu' });
    resultsMenu = new Menu(items, { id: 'results' });
    try { music.play(resultsTheme(), { fade: 2.5 }); } catch { /* */ }
  };
  const resultsTheme = () => (results?.place === 1 ? 'results_win' : 'results_lose');

  const leave = (where) => {
    if (where === 'restart') { go('race', params); return; }
    if (params.onDone) { params.onDone(where === 'continue' ? results : null, where); return; }
    if (where === 'setup') { go(params.back || 'showroom', { station: params.station || 'quick', resume: 'route' }); return; }
    go('radio', { station: params.station || 'quick' });
  };

  /** Hall of fame: best lap / best time / wins per track, and the last car driven. */
  const saveRecords = (res) => {
    if (params.noRecords) return;
    const all = store.load('records') || {};
    const P = session.player;
    const r = all[res.track] || { trackName: session.def.name, races: 0, wins: 0 };
    r.trackName = session.def.name;
    r.races = (r.races || 0) + 1;
    if (res.place === 1 && res.racers > 1) r.wins = (r.wins || 0) + 1;
    const car = `${P.spec.make} ${P.spec.model}`;
    if (res.bestLap && (!r.bestLap || res.bestLap < r.bestLap)) { r.bestLap = res.bestLap; r.bestLapCar = car; r.newLap = true; } else r.newLap = false;
    if (res.time && !res.out && (session.type === 'sprint' || session.type === 'drag') && (!r.bestTime || res.time < r.bestTime)) { r.bestTime = res.time; r.bestTimeCar = car; }
    r.date = Date.now();
    all[res.track] = r;
    store.save('records', all);
    store.save('lastCar', P.spec.id);
    res.newLap = r.newLap;
  };

  const scr = {
    async enter(p = {}) {
      params = p;
      const def = p.trackDef || TRACK_BY_ID[p.track] || TRACKS[0];
      const spec = p.spec || CAR_BY_ID[p.car] || CAR_BY_ID.lancet;
      if (typeof p.opponents === 'string') p.opponents = p.opponents.split(',').filter(Boolean);
      session = new RaceSession({
        track: def, type: p.type || def.type, laps: p.laps ? Number(p.laps) : def.laps,
        player: { spec, look: p.look || {}, upgrades: p.upgrades || {}, name: p.playerName || 'YOU' },
        opponents: ['timeattack', 'drift'].includes(p.type || def.type) ? [] : buildOpponents(p, spec),
        playerGrid: p.playerGrid, rubber: p.rubber, musicTheme: p.musicTheme, ttFactor: p.ttFactor, banner: p.banner, driftRivals: p.driftRivals,
        traffic: p.traffic === undefined ? undefined : (p.traffic === true || p.traffic === '1' || p.traffic === 'true'),
      });
      await session.load(game.renderer.gl, (f, label) => { loading = { f, label }; });
      game.renderer.setPost(session.world.at.post || {}, true);
      hud = new HUD(session);
      scr.session = session;
      window.__race = session;
    },
    exit() {
      session?.dispose();
      session = null;
      game.fx.radialBlur = 0;
      try { audio.duck(0); } catch { /* */ }
    },
    update(dt) {
      if (!session || session.state === 'loading') return;
      // pause
      if (pauseMenu) {
        const it = pauseMenu.update(dt);
        if (input.pressed('pause') || input.pressed('back') || it?.id === 'resume') {
          pauseMenu = null; session.pause(false); uiSound('back');
          return;
        }
        if (it?.id === 'restart') leave('restart');
        if (it?.id === 'quit') leave('quit');
        return;
      }
      // instant replay: a VCR's transport on the pad
      if (session.replay) {
        const rp = session.replay;
        if (input.pressed('back') || input.pressed('pause')) {
          session.stopReplay(resultsTheme());
          uiSound('back');
          return;
        }
        if (input.pressed('confirm')) rp.playPause();
        if (input.pressed('tabR')) rp.fast(1);
        if (input.pressed('tabL')) rp.fast(-1);
        if (input.pressed('left')) rp.cycleFocus(-1);
        if (input.pressed('right')) rp.cycleFocus(1);
        if (input.pressed('camera')) rp.cycleMode();
        session.update(dt);
        Object.assign(game.fx, session.fx || {});
        return;
      }
      // controller unplugged / battery died mid-race: pause, like a console would
      const padLost = input.padEvent === 'lost' && (session.state === 'racing' || session.state === 'countdown');
      if ((input.pressed('pause') || padLost) && session.state !== 'done') {
        pauseMenu = makePause();
        session.pause(true);
        uiSound('select');
        return;
      }
      // QA: ?sim=N runs N simulation steps per frame, ?autopilot=1 lets the AI drive you
      const reps = Number(game.query.get('sim') || 1);
      for (let k = 0; k < reps; k++) {
        if (game.query.get('autopilot') && session.player && !session.player.ai && session.sim) {
          import('../race/ai.js').then(({ AIDriver }) => { session.player.ai = session.player.ai || new AIDriver(session.player, session.track, { skill: 0.9, rubber: 0 }); });
        }
        session.update(dt);
        if (session.state === 'intro' && game.query.get('autopilot')) session.startCountdown();
      }
      Object.assign(game.fx, session.fx || {});
      if (session.state === 'done') {
        resultsT += dt;
        if (!results && session.doneT > 2.5) finishResults();
        if (resultsMenu) {
          const it = resultsMenu.update(dt);
          if (it?.id === 'replay') { if (session.startReplay()) uiSound('select'); }
          else if (it) leave(it.id);
        }
      }
    },
    view() { return session && session.state !== 'loading' ? session.view() : null; },
    draw(ctx, dt) {
      if (!session || session.state === 'loading') {
        drawStandBy(ctx, loading, game.time);
        return;
      }
      if (session.replay) { drawReplayOSD(ctx, session.replay, session, game.time); return; }
      if (!window.__noHud) hud.draw(ctx, dt);
      if (results) drawResults(ctx, results, resultsMenu, resultsT, session);
      if (pauseMenu) drawPause(ctx, pauseMenu, session);
    },
  };
  return scr;
});

function drawStandBy(ctx, loading, t) {
  // SMPTE-ish test card under the static
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  for (let k = 0; k < 7; k++) { ctx.fillStyle = bars[k]; ctx.fillRect(k * 1024 / 7, 0, 1024 / 7 + 1, 470); }
  const low = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
  for (let k = 0; k < 7; k++) { ctx.fillStyle = low[k]; ctx.fillRect(k * 1024 / 7, 470, 1024 / 7 + 1, 70); }
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 540, 1024, 228);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(212, 300, 600, 140);
  vText(ctx, 'PLEASE STAND BY', 512, 368, 40, { align: 'center', color: '#ffffff', outline: 3 });
  text(ctx, loading.label, 512, 408, { size: 17, align: 'center', color: '#e8e8e8', weight: 700, spacing: 3 });
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(312, 600, 400, 10);
  ctx.fillStyle = '#ffb21e';
  ctx.fillRect(312, 600, 400 * loading.f, 10);
  osd(ctx, 'CH 03', 60, 80, 30);
  void t;
}

function drawPause(ctx, menu, session) {
  ctx.fillStyle = 'rgba(0,10,40,0.55)';
  ctx.fillRect(0, 0, 1024, 768);
  osd(ctx, '❚❚ PAUSE', 60, 84, 34);
  osd(ctx, session.def.name, 60, 124, 18, '#bfffbf');
  panel(ctx, 300, 190, 440, 340, { accent: C.accent });
  menu.draw(ctx, 340, 250, 370, { rowH: 46, size: 21 });
  hints(ctx, [['confirm', 'SELECT'], ['lr', 'ADJUST'], ['pause', 'RESUME']]);
}

function drawResults(ctx, res, menu, t, session) {
  const a = Math.min(1, t / 0.4);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(2,4,10,0.72)';
  ctx.fillRect(0, 0, 1024, 768);
  const title = res.target ? (res.beat ? 'TARGET BEATEN' : 'TARGET MISSED') : res.out ? 'KNOCKED OUT' : res.place === 1 ? 'VICTORY' : `${ordinal(res.place)} PLACE`;
  const good = res.target ? res.beat : res.place === 1;
  vText(ctx, title, 70, 110, 52, { color: good ? '#4dff8b' : res.out || (res.target && !res.beat) ? '#ff3d52' : C.accent, outline: 3, outlineColor: '#000' });
  if (res.summary?.pay) text(ctx, `PRIZE  $${res.summary.pay.toLocaleString()}`, 690, 118, { size: 20, color: C.green, weight: 900, spacing: 2 });
  text(ctx, `${session.def.name}  ·  ${res.type.toUpperCase()}`, 74, 142, { size: 16, color: C.dim, weight: 700, spacing: 2 });
  if (res.newLap) {
    const p = 0.6 + 0.4 * Math.sin(t * 6);
    text(ctx, `NEW LAP RECORD  ${fmtTime(res.bestLap)}`, 690, 142, { size: 16, color: C.accent, weight: 900, spacing: 2, alpha: p, glow: 8 });
  }
  panel(ctx, 60, 170, 600, 46 + res.order.length * 34, { accent: C.cyan });
  text(ctx, 'POS', 90, 200, { size: 12, color: C.dim, weight: 800 });
  text(ctx, 'DRIVER', 150, 200, { size: 12, color: C.dim, weight: 800 });
  text(ctx, 'CAR', 300, 200, { size: 12, color: C.dim, weight: 800 });
  text(ctx, res.type === 'drift' ? 'SCORE' : 'TIME', 520, 200, { size: 12, color: C.dim, weight: 800 });
  text(ctx, 'BEST', 610, 200, { size: 12, color: C.dim, weight: 800, align: 'right' });
  res.order.forEach((r, k) => {
    const y = 236 + k * 34;
    const col = r.player ? C.cyan : '#e6ebf3';
    vText(ctx, r.out ? '-' : String(k + 1), 92, y, 18, { color: col });
    text(ctx, r.name, 150, y, { size: 16, color: col, weight: r.player ? 900 : 600 });
    const spec = session.sim.racers.find((x) => x.spec.id === r.car)?.spec;
    text(ctx, spec ? `${spec.make} ${spec.model}` : (r.car || (res.type === 'drift' ? 'POSTED SCORE' : '')), 300, y, { size: 13, color: C.dim, weight: 600 });
    text(ctx, r.score !== undefined ? r.score.toLocaleString() : r.out ? 'OUT' : fmtTime(r.time) + (r.estimated ? '*' : ''), 520, y, { size: 16, color: col, weight: 700 });
    text(ctx, r.best ? fmtTime(r.best) : '', 640, y, { size: 13, color: C.dim, weight: 600, align: 'right' });
  });
  if (menu) {
    panel(ctx, 690, 170, 290, 60 + menu.items.length * 46, { accent: C.accent });
    menu.draw(ctx, 730, 226, 220, { rowH: 46, size: 19 });
  }
  ctx.restore();
  hints(ctx, [['confirm', 'SELECT']]);
}
