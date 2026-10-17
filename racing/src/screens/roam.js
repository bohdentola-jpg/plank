// FREE ROAM screen: drive the whole of Port Halcyon. The session builds one
// region at a time and swaps them in the tunnels; this screen adds the HUD,
// the pause menu and the map (fast travel to any region).
// Params: { track, car|spec, look, upgrades, traffic, back, station, onExit }
// Dev: ?screen=roam&track=downtown&car=lancet
import { registerScreen, game, go } from '../main.js';
import { RoamSession } from '../roam/session.js';
import { RoamHUD, drawRoamLoading, drawWorldMap } from '../roam/hud.js';
import { ring } from '../roam/network.js';
import { TRACK_BY_ID } from '../track/tracks.js';
import { CAR_BY_ID } from '../car/cars.js';
import { C, osd, panel, hints, text, vText } from '../core/ui.js';
import { typesFor, TYPE_NAMES, SKILLS, pickRivals } from './showroom.js';
import { knockLaps } from '../race/sim.js';
import { Menu, uiSound } from '../core/menu.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { audio } from '../audio/audio.js';

registerScreen('roam', () => {
  let session = null;
  let hud = null;
  let params = {};
  let pauseMenu = null;
  let map = null;           // { sel }
  let fade = 0;
  let raceMenu = null;      // racing this road from the start-line light
  const rcfg = { type: null, opp: 5, skill: 2, traffic: true };

  const trafficRoad = (def) => ['city', 'highway', 'docks'].includes(def.env);
  const makeRaceMenu = () => {
    const def = session.def;
    const types = typesFor(def);
    if (!types.includes(rcfg.type)) rcfg.type = types[0];
    if (rcfg.type === 'drag') rcfg.opp = Math.min(rcfg.opp, (def.dragLanes?.length || 2) - 1);
    rcfg.traffic = !!def.traffic;
    return new Menu([
      {
        label: 'RACE TYPE', type: 'choice',
        get options() { return typesFor(session.def).map((v) => ({ value: v, label: TYPE_NAMES[v] })); },
        get: () => rcfg.type, set: (v) => { rcfg.type = v; },
      },
      {
        label: 'RIVALS', type: 'choice',
        get options() {
          if (rcfg.type === 'timeattack' || rcfg.type === 'drift') return [{ value: rcfg.opp, label: rcfg.type === 'drift' ? 'POSTED SCORES' : 'NONE' }];
          const max = rcfg.type === 'drag' ? (session.def.dragLanes?.length || 2) - 1 : 7;
          const min = rcfg.type === 'knockout' ? 2 : 1;
          return Array.from({ length: max - min + 1 }, (_, k) => ({ value: k + min, label: String(k + min) }));
        },
        get: () => rcfg.opp, set: (v) => { rcfg.opp = v; },
      },
      {
        label: 'SKILL', type: 'choice', options: SKILLS.map((x, k) => ({ value: k, label: x.label })),
        get: () => rcfg.skill, set: (v) => { rcfg.skill = v; },
      },
      {
        label: 'TRAFFIC', type: 'choice',
        get options() { return trafficRoad(session.def) && rcfg.type !== 'drag' ? [{ value: true, label: 'ON' }, { value: false, label: 'OFF' }] : [{ value: false, label: 'CLOSED ROAD' }]; },
        get: () => trafficRoad(session.def) && rcfg.type !== 'drag' && rcfg.traffic, set: (v) => { rcfg.traffic = v; },
      },
      { label: 'START RACE', id: 'go' },
      { label: 'KEEP CRUISING', id: 'cancel' },
    ], { id: 'roamrace' });
  };

  const startRace = () => {
    const def = session.def;
    const P = session.opts.player;
    const type = rcfg.type;
    const opp = type === 'timeattack' || type === 'drift' ? 0 : Math.max(type === 'knockout' ? 2 : 1, rcfg.opp);
    // after the race: back on this road, just past the line
    const back = { ...params, track: def.id, trackDef: undefined, start: { s: (session.track.startS || 0) + (session.track.closed ? 30 : 15) } };
    go('race', {
      trackDef: def, spec: P.spec, look: P.look, upgrades: P.upgrades, type,
      laps: type === 'knockout' ? knockLaps(opp) : def.laps || 3,
      opponents: pickRivals(P.spec, opp, SKILLS[rcfg.skill].v, P.look?.paint, def.id + type + Date.now() % 97),
      rubber: 1, traffic: trafficRoad(def) && type !== 'drag' && rcfg.traffic,
      quitLabel: 'BACK TO FREE ROAM', noRecords: false,
      onDone: () => go('roam', back),
    });
  };

  const makePause = () => new Menu([
    { label: 'RESUME', id: 'resume' },
    { label: 'MAP  ·  FAST TRAVEL', id: 'map' },
    { label: 'BACK ON THE ROAD', id: 'reset' },
    {
      label: 'TRAFFIC', type: 'choice', options: [{ value: true, label: 'ON' }, { value: false, label: 'OFF' }],
      get: () => session?.opts.traffic !== false,
      set: (v) => { if (session) session.opts.traffic = v; settings.set('roamTraffic', v); },
    },
    {
      label: 'TRANSMISSION', type: 'choice', options: [{ value: 'auto', label: 'AUTO' }, { value: 'manual', label: 'MANUAL' }],
      get: () => settings.get('transmission'), set: (v) => { settings.set('transmission', v); if (session?.sim) session.sim.opts.auto = v !== 'manual'; },
    },
    {
      label: 'CAMERA', type: 'choice', options: [{ value: 0, label: 'CHASE FAR' }, { value: 1, label: 'CHASE' }, { value: 2, label: 'BUMPER' }, { value: 3, label: 'HOOD' }],
      get: () => session?.camera.mode ?? 1, set: (v) => { session?.camera.setMode(v); settings.set('camera', v); },
    },
    {
      label: 'MUSIC', type: 'slider', step: 0.1, min: 0, max: 1,
      get: () => settings.get('volMusic'), set: (v) => { settings.set('volMusic', v); audio.setVolumes({ music: v }); },
    },
    { label: params.quitLabel || 'QUIT TO MENU', id: 'quit' },
  ], { id: 'roampause' });

  const leave = () => {
    if (params.onExit) { params.onExit(session?.def?.id); return; }
    go('radio', { station: params.station || 'cruise' });
  };

  const scr = {
    async enter(p = {}) {
      params = p;
      let def = p.trackDef || TRACK_BY_ID[p.track] || TRACK_BY_ID.downtown;
      if (def.reverseOf) def = TRACK_BY_ID[def.reverseOf];
      if (!ring().includes(def.id)) def = TRACK_BY_ID[ring()[0]];
      const spec = p.spec || CAR_BY_ID[p.car] || CAR_BY_ID.lancet;
      const traffic = p.traffic === undefined ? settings.get('roamTraffic') !== false : (p.traffic === true || p.traffic === '1' || p.traffic === 'true');
      session = new RoamSession({
        track: def, traffic,
        player: { spec, look: p.look || {}, upgrades: p.upgrades || {}, name: p.playerName || 'YOU' },
        start: p.start || null, noRaces: !!p.noRaces,
      });
      await session.load(game.renderer.gl, () => {});
      game.renderer.setPost(session.world.at.post || {}, true);
      hud = new RoamHUD(session);
      scr.session = session;
      window.__roam = session;
      window.__race = session;
    },
    exit() {
      session?.dispose();
      session = null;
      game.fx.radialBlur = 0;
      game.fx.fade = 0;
      try { audio.duck(0); } catch { /* */ }
    },
    update(dt) {
      if (!session || session.state === 'loading') return;
      if (map) {
        const R = ring();
        if (input.pressed('left') || input.pressed('up')) { map.sel = (map.sel - 1 + R.length) % R.length; uiSound('move'); }
        if (input.pressed('right') || input.pressed('down')) { map.sel = (map.sel + 1) % R.length; uiSound('move'); }
        if (input.pressed('confirm')) {
          const id = R[map.sel];
          if (id !== session.def.id && session.fastTravel(id)) { uiSound('select'); map = null; pauseMenu = null; session.pause(false); }
          else uiSound('error');
        }
        if (input.pressed('back') || input.pressed('pause')) { map = null; uiSound('back'); }
        return;
      }
      if (raceMenu) {
        const it = raceMenu.update(dt);
        if (it?.id === 'go') { uiSound('select'); raceMenu = null; startRace(); return; }
        if (it?.id === 'cancel' || input.pressed('back') || input.pressed('pause') || !session.atMarker) {
          raceMenu = null; uiSound('back');
        }
        session.update(dt);
        Object.assign(game.fx, session.fx || {});
        return;
      }
      if (pauseMenu) {
        const it = pauseMenu.update(dt);
        if (input.pressed('pause') || input.pressed('back') || it?.id === 'resume') {
          pauseMenu = null; session.pause(false); uiSound('back');
          return;
        }
        if (it?.id === 'map') { map = { sel: Math.max(0, ring().indexOf(session.def.id)) }; uiSound('select'); }
        if (it?.id === 'reset' && session.sim) { session.sim.resetRacer(session.player); pauseMenu = null; session.pause(false); }
        if (it?.id === 'quit') leave();
        return;
      }
      const padLost = input.padEvent === 'lost';
      if ((input.pressed('pause') || padLost) && session.phase === 'drive') {
        pauseMenu = makePause();
        session.pause(true);
        uiSound('select');
        return;
      }
      if (session.atMarker && !params.noRaces && input.pressed('confirm')) {
        raceMenu = makeRaceMenu();
        uiSound('select');
        return;
      }
      if (input.pressed('map') && session.phase === 'drive') {
        map = { sel: Math.max(0, ring().indexOf(session.def.id)) };
        session.pause(true);
        uiSound('select');
        return;
      }
      const reps = Number(game.query.get('sim') || 1);
      for (let k = 0; k < reps; k++) session.update(dt);
      Object.assign(game.fx, session.fx || {});
      fade = session.fade;
    },
    view() { return session && session.state !== 'loading' ? session.view() : null; },
    draw(ctx, dt) {
      if (!session || session.state === 'loading' || session.phase === 'loading') {
        drawRoamLoading(ctx, session?.loading || { f: 0, label: 'PLEASE STAND BY', def: params.trackDef || TRACK_BY_ID[params.track] }, game.time);
        return;
      }
      if (!window.__noHud) hud.draw(ctx, dt);
      if (fade > 0) {
        ctx.fillStyle = `rgba(3,4,6,${Math.min(1, fade)})`;
        ctx.fillRect(0, 0, 1024, 768);
      }
      if (map) { drawWorldMap(ctx, session.def.id, map.sel, game.time); hints(ctx, [['lr', 'REGION'], ['confirm', 'TRAVEL'], ['back', 'BACK']]); return; }
      if (raceMenu) drawRaceMenu(ctx, raceMenu, session);
      else if (session.atMarker && !params.noRaces && !pauseMenu) drawRacePrompt(ctx, session, game.time);
      if (pauseMenu) drawPause(ctx, pauseMenu, session);
    },
  };
  return scr;
});

function drawRacePrompt(ctx, session, t) {
  const def = session.def;
  const a = 0.75 + 0.25 * Math.sin(t * 5);
  panel(ctx, 312, 520, 400, 64, { accent: C.accent, accentLen: 140, alpha: 0.88 });
  vText(ctx, 'RACE HERE', 336, 556, 24, { color: '#fff' });
  text(ctx, typesFor(def).map((v) => TYPE_NAMES[v]).join('  ·  '), 338, 574, { size: 11, color: C.dim, weight: 800, spacing: 1.5 });
  text(ctx, '✕ / ENTER', 690, 556, { size: 14, color: C.accent, weight: 900, spacing: 2, align: 'right', alpha: a });
}

function drawRaceMenu(ctx, menu, session) {
  ctx.fillStyle = 'rgba(0,6,20,0.5)';
  ctx.fillRect(0, 0, 1024, 768);
  panel(ctx, 290, 190, 460, 360, { accent: C.accent, accentLen: 200 });
  vText(ctx, session.def.name, 320, 238, 26, { color: '#fff' });
  text(ctx, 'RACE THIS ROAD', 322, 260, { size: 12, color: C.accent, weight: 900, spacing: 3 });
  menu.draw(ctx, 330, 300, 390, { rowH: 40, size: 19 });
  hints(ctx, [['confirm', 'SELECT'], ['lr', 'ADJUST'], ['back', 'KEEP CRUISING']]);
}

function drawPause(ctx, menu, session) {
  ctx.fillStyle = 'rgba(0,10,40,0.55)';
  ctx.fillRect(0, 0, 1024, 768);
  osd(ctx, '❚❚ PAUSE', 60, 84, 34);
  osd(ctx, `FREE ROAM  ·  ${session.def.name}`, 60, 124, 18, '#bfffbf');
  panel(ctx, 290, 170, 460, 420, { accent: C.accent });
  menu.draw(ctx, 330, 228, 390, { rowH: 44, size: 20 });
  hints(ctx, [['confirm', 'SELECT'], ['lr', 'ADJUST'], ['pause', 'RESUME']]);
}
