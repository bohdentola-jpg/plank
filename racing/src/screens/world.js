// PORT HALCYON free roam. You start in your garage on Foundry St: pick a
// car (any car on the roster), fit it out (performance and body work, free
// here and kept per car), choose night, dusk or day, then DRIVE OUT: the
// camera comes round behind the car, the door rolls up and the city is out
// there, no loading screen. Park back inside to get the garage again.
// Every race track's start line stands under a column of light: pull up in
// it and ✕ races that track in the car you're driving, and afterwards you're
// back in the city past the line (or past a sprint's finish).
// Params: { car, spec, look, upgrades, time, x, z, heading, budget, quitLabel, onExit, station, garage,
//   noGarage (a story cruise: not your garage), noRaces (no start lines), traffic }
// Dev: ?screen=world (garage start) · ?screen=world&car=silvio&x=700&z=790&heading=3.14 (on the road)
import { registerScreen, game, go } from '../main.js';
import { WorldSession } from '../world/session.js';
import { WorldHUD } from '../world/hud.js';
import { roamGarage } from '../world/garagesave.js';
import { allPlaces, discover } from '../world/discover.js';
import { GARAGE } from '../world/map/base.js';
import { CARS, CAR_BY_ID } from '../car/cars.js';
import { carStats } from '../car/stats.js';
import { prFor } from '../story/state.js';
import { PERF_PARTS, TIER_NAMES, BODY_PARTS, upgradesFor } from '../story/data.js';
import { CLASS_COLORS, engineLabel, typesFor, TYPE_NAMES, SKILLS, pickRivals } from './showroom.js';
import { knockLaps } from '../race/sim.js';
import { CAM_MODES } from '../race/camera.js';
import { C, panel, text, vText, paragraph, hints, statBar } from '../core/ui.js';
import { Menu, uiSound } from '../core/menu.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { audio } from '../audio/audio.js';
import { sfx } from '../audio/sfx.js';
import { clamp } from '../core/util.js';

const TABS = ['CAR', 'PERFORMANCE', 'BODY', 'DRIVE'];
const TIME_LABEL = { night: 'NIGHT', dusk: 'DUSK', day: 'DAY' };

registerScreen('world', () => {
  let session = null;
  let hud = null;
  let params = {};
  let pauseMenu = null;
  let loading = { f: 0, label: 'TUNING IN' };
  // the garage
  let tab = 0, carSel = 0, perfSel = 0, perfTier = 0, bodySel = 0, driveSel = 0;
  let pending = null;           // a car change waiting for the list to settle
  let toast = null;
  let uiA = 1;                  // garage UI fade
  let t = 0;
  let mapV = null;              // the map open: { cx, cz, mpp, sel }
  let travel = null;            // fast travelling: { name, f }
  let raceMenu = null;          // racing from a start line: { st, menu }
  const rcfg = { type: null, opp: 5, skill: 2, traffic: true };

  const say = (s, color = C.accent) => { toast = { text: s, t: 0, color }; };
  const carId = () => session.player.spec.id;
  const levels = () => roamGarage.carState(carId()).levels;

  const makePause = () => new Menu([
    { label: 'RESUME', id: 'resume' },
    ...(session?.inGarage ? [] : [{ label: 'MAP  ·  FAST TRAVEL', id: 'map' }, { label: 'BACK ON THE ROAD', id: 'reset' }, ...(params.noGarage ? [] : [{ label: 'BACK TO THE GARAGE', id: 'garage' }])]),
    {
      label: 'CAMERA', type: 'choice', options: CAM_MODES.map((m, k) => ({ value: k, label: m.name })),
      get: () => session?.camera.mode ?? 1, set: (v) => { session?.camera.setMode(v); settings.set('camera', v); },
    },
    {
      label: 'MUSIC', type: 'slider', step: 0.1, min: 0, max: 1,
      get: () => settings.get('volMusic'), set: (v) => { settings.set('volMusic', v); audio.setVolumes({ music: v }); },
    },
    { label: params.quitLabel || 'QUIT TO MENU', id: 'quit' },
  ], { id: 'worldpause' });

  const leave = () => {
    if (params.onExit) { params.onExit(); return; }
    go('radio', { station: params.station || 'cruise' });
  };

  // ---------------------------------------------------------------- racing from a start line

  const trafficOK = (def, type) => !!def.traffic && type !== 'drag';
  function openRace(st) {
    const def = st.def;
    const types = typesFor(def);
    if (!types.includes(rcfg.type)) rcfg.type = types[0];
    if (rcfg.type === 'drag') rcfg.opp = 1;
    rcfg.traffic = !!def.traffic;
    const menu = new Menu([
      {
        label: 'RACE TYPE', type: 'choice',
        get options() { return types.map((v) => ({ value: v, label: TYPE_NAMES[v] })); },
        get: () => rcfg.type, set: (v) => { rcfg.type = v; if (v === 'drag') rcfg.opp = 1; },
      },
      {
        label: 'RIVALS', type: 'choice',
        get options() {
          if (rcfg.type === 'timeattack' || rcfg.type === 'drift') return [{ value: rcfg.opp, label: rcfg.type === 'drift' ? 'POSTED SCORES' : 'NONE' }];
          const max = rcfg.type === 'drag' ? 1 : 7, min = rcfg.type === 'knockout' ? 2 : 1;
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
        get options() { return trafficOK(def, rcfg.type) ? [{ value: true, label: 'ON' }, { value: false, label: 'OFF' }] : [{ value: false, label: 'CLOSED ROAD' }]; },
        get: () => trafficOK(def, rcfg.type) && rcfg.traffic, set: (v) => { rcfg.traffic = v; },
      },
      { label: 'START RACE', id: 'go' },
      { label: 'KEEP CRUISING', id: 'cancel' },
    ], { id: 'worldrace' });
    raceMenu = { st, menu };
    session.pause(true);
    uiSound('select');
  }

  function startRace(st) {
    const def = st.def;
    const P = session.player;
    const type = rcfg.type;
    const opp = type === 'timeattack' || type === 'drift' ? 0 : type === 'drag' ? 1 : Math.max(type === 'knockout' ? 2 : 1, rcfg.opp);
    const car = { spec: P.spec, look: P.look, upgrades: P.upgrades };
    // afterwards: back in the city, past the line (or past a sprint's finish when you got there)
    const back = (at) => ({ ...params, ...car, car: P.spec.id, x: at.x, z: at.z, heading: at.heading, time: session.def.time, traffic: session.opts.traffic !== false, garage: false });
    go('race', {
      trackDef: def, ...car, type,
      laps: type === 'knockout' ? knockLaps(opp, def.laps) : def.laps || 3,
      opponents: pickRivals(P.spec, opp, SKILLS[rcfg.skill].v, P.look?.paint, def.id + type + (Date.now() % 97)),
      rubber: 1, traffic: trafficOK(def, type) && rcfg.traffic,
      quitLabel: 'BACK TO THE CITY',
      onDone: (res) => go('world', back(res && st.finish ? st.finish : st.start)),
    });
  }

  function raceMenuUpdate(dt) {
    const it = raceMenu.menu.update(dt);
    if (it?.id === 'go') { const st = raceMenu.st; raceMenu = null; uiSound('select'); startRace(st); return; }
    if (it?.id === 'cancel' || input.pressed('back') || input.pressed('pause')) { raceMenu = null; session.pause(false); uiSound('back'); }
  }

  function drawRacePrompt(ctx, st) {
    const a = 0.75 + 0.25 * Math.sin(t * 5);
    panel(ctx, 312, 520, 400, 64, { accent: C.accent, accentLen: 140, alpha: 0.88 });
    vText(ctx, 'RACE HERE', 336, 552, 22, { color: '#fff' });
    text(ctx, st.def.name, 338, 572, { size: 11, color: C.accent, weight: 900, spacing: 1.5 });
    ctx.save(); ctx.globalAlpha = a;
    hints(ctx, [['confirm', 'RACE']], { y: 552, x: 696 });
    ctx.restore();
  }

  function drawRaceMenu(ctx) {
    const { st, menu } = raceMenu;
    ctx.fillStyle = 'rgba(0,6,20,0.5)';
    ctx.fillRect(0, 0, 1024, 768);
    panel(ctx, 290, 150, 460, 430, { accent: C.accent, accentLen: 200 });
    vText(ctx, st.def.name, 320, 198, 26, { color: '#fff' });
    text(ctx, `${typesFor(st.def).map((v) => TYPE_NAMES[v]).join('  ·  ')}`, 322, 220, { size: 11, color: C.accent, weight: 900, spacing: 2 });
    paragraph(ctx, st.def.blurb || '', 322, 246, 396, { size: 11, color: C.dim, weight: 600, lineHeight: 15 });
    menu.draw(ctx, 330, 330, 390, { rowH: 38, size: 18 });
    hints(ctx, [['confirm', 'SELECT'], ['lr', 'ADJUST'], ['back', 'KEEP CRUISING']], { y: 740 });
  }

  // ---------------------------------------------------------------- garage actions

  function applyCar(id) {
    const p = roamGarage.player(id);
    roamGarage.setCar(id);
    session.setCar(p.spec, p.look, p.upgrades);
    perfTier = levels()[PERF_PARTS[perfSel].id] || 0;
  }

  function setTier(part, tier) {
    const id = carId();
    roamGarage.setLevel(id, part.id, tier);
    const p = roamGarage.player(id);
    session.setCar(p.spec, p.look, p.upgrades);
    try { sfx.airWrench?.(); } catch { /* */ }
  }

  function setBody(part, val) {
    const id = carId();
    const look = { ...session.player.look, [part.key]: val };
    roamGarage.setLook(id, look);
    session.setLook(look);
  }

  function bodyVal(part) {
    const sp = session.player.spec;
    return session.player.look[part.key] ?? sp.stockLook?.[part.key] ?? part.options[0];
  }

  function driveOut() {
    if (session.leave()) { uiSound('select'); return; }
    if (!session.ready) say('THE CITY IS STILL WAKING UP…', C.dim);
  }

  function garageUpdate(dt) {
    const s = session;
    // orbit the camera: right stick, a mouse drag, or ◄ ► on the drive page
    const rs = Math.abs(input.axes[2] || 0) > 0.15 ? input.axes[2] : 0;
    if (rs) { s.gcam.yawT += rs * 1.9 * dt; s.gcam.idle = 0; }
    if (input.mouse.down && input.device === 'mouse') { s.gcam.yawT += (input.mouse.dx || 0) * 0.006; s.gcam.idle = 0; }
    if (s.state !== 'garage') return;
    if (input.pressed('tabR')) { tab = (tab + 1) % TABS.length; uiSound('tab'); }
    if (input.pressed('tabL')) { tab = (tab + TABS.length - 1) % TABS.length; uiSound('tab'); }
    if (input.pressed('alt')) { driveOut(); return; }
    const ok = input.pressed('confirm');
    if (tab === 0) {
      const n = CARS.length;
      let d = 0;
      if (input.pressed('down')) d = 1;
      if (input.pressed('up')) d = -1;
      if (d) {
        carSel = (carSel + d + n) % n;
        pending = { id: CARS[carSel].id, t: 0 };
        uiSound('move');
      }
      if (pending) {
        pending.t += dt;
        if (pending.t > 0.3 || ok) { applyCar(pending.id); pending = null; }
      } else if (ok) { tab = 3; driveSel = 2; uiSound('select'); }
    } else if (tab === 1) {
      const n = PERF_PARTS.length + 1;
      if (input.pressed('down')) { perfSel = (perfSel + 1) % n; uiSound('move'); }
      if (input.pressed('up')) { perfSel = (perfSel + n - 1) % n; uiSound('move'); }
      const dir = input.pressed('right') ? 1 : input.pressed('left') ? -1 : 0;
      if (perfSel < PERF_PARTS.length) {
        const part = PERF_PARTS[perfSel];
        const cur = levels()[part.id] || 0;
        if (dir) {
          const nt = clamp(cur + dir, 0, 3);
          if (nt !== cur) { setTier(part, nt); uiSound('tab'); say(nt ? `${TIER_NAMES[nt]} ${part.name} FITTED` : `${part.name} BACK TO STOCK`, C.green); }
        }
      } else if (dir || ok) {
        // all parts at once: the next tier up (or down) from the lowest fitted
        const lv = levels();
        const lo = Math.min(...PERF_PARTS.map((p) => lv[p.id] || 0));
        const nt = clamp(lo + (dir || 1), 0, 3);
        const id = carId();
        for (const p of PERF_PARTS) roamGarage.setLevel(id, p.id, nt);
        const p = roamGarage.player(id);
        session.setCar(p.spec, p.look, p.upgrades);
        say(nt ? `EVERYTHING ${TIER_NAMES[nt]}` : 'ALL STOCK', C.green);
        try { sfx.airWrench?.(); } catch { /* */ }
      }
    } else if (tab === 2) {
      const n = BODY_PARTS.length;
      if (input.pressed('down')) { bodySel = (bodySel + 1) % n; uiSound('move'); }
      if (input.pressed('up')) { bodySel = (bodySel + n - 1) % n; uiSound('move'); }
      const dir = input.pressed('right') ? 1 : input.pressed('left') ? -1 : 0;
      if (dir) {
        const part = BODY_PARTS[bodySel];
        const opts = part.options;
        const i = Math.max(0, opts.indexOf(bodyVal(part)));
        setBody(part, opts[(i + dir + opts.length) % opts.length]);
        uiSound('tab');
        try { sfx.spray?.(); } catch { /* */ }
      }
    } else {
      const n = 3;
      if (input.pressed('down')) { driveSel = (driveSel + 1) % n; uiSound('move'); }
      if (input.pressed('up')) { driveSel = (driveSel + n - 1) % n; uiSound('move'); }
      const dir = input.pressed('right') ? 1 : input.pressed('left') ? -1 : 0;
      if (driveSel === 0 && dir) {
        const T = roamGarage.TIMES;
        const nt = T[(T.indexOf(s.def.time) + dir + T.length) % T.length];
        roamGarage.setTime(nt);
        s.setTime(nt);
        game.renderer.setPost(s.world.at.post || {}, true);
        uiSound('tab');
      }
      if (driveSel === 1 && dir) { s.camera.setMode(s.camera.mode + dir); settings.set('camera', s.camera.mode); uiSound('tab'); }
      if (ok && driveSel === 2) driveOut();
    }
  }

  // ---------------------------------------------------------------- the map

  function openMap() {
    if (!session.map) { say('THE MAP IS STILL BEING DRAWN…', C.dim); return; }
    const v = session.player.vehicle;
    const places = allPlaces(session.districts);
    const starts = params.noRaces ? [] : (session.starts || []).map((st) => ({ x: st.x, z: st.z, name: st.def.name, found: true, st }));
    mapV = { cx: v.x, cz: v.z, mpp: 5, sel: null, places, starts, t: 0 };
    session.pause(true);
    uiSound('select');
  }

  function mapUpdate(dt) {
    mapV.t += dt;
    // pan (stick / arrows / WASD), zoom (L1 R1 / Q E)
    const sy = Math.abs(input.axes[1] || 0) > 0.2 ? input.axes[1] : 0;
    const px = input.steer || 0, pz = clamp((input.brake || 0) - (input.throttle || 0) + sy, -1, 1);
    const sp = 520 * mapV.mpp * dt;
    mapV.cx = clamp(mapV.cx + px * sp, -6200, 6200);
    mapV.cz = clamp(mapV.cz + pz * sp, -5600, 4400);
    if (input.pressed('tabR')) { mapV.mpp = Math.max(1.5, mapV.mpp / 1.6); uiSound('tab'); }
    if (input.pressed('tabL')) { mapV.mpp = Math.min(13, mapV.mpp * 1.6); uiSound('tab'); }
    // what's under the crosshair
    let best = null, bd = 28 * mapV.mpp;
    const consider = (p) => { const d = Math.hypot(p.x - mapV.cx, p.z - mapV.cz); if (d < bd) { bd = d; best = p; } };
    for (const p of mapV.places) { p.found = discover.has(p.id); if (p.hidden && !p.found) continue; consider(p); }
    for (const p of mapV.starts) consider(p);
    consider({ x: GARAGE.x, z: GARAGE.z, garage: true, name: 'YOUR GARAGE', found: true });
    mapV.sel = best;
    if (input.pressed('confirm') && best) {
      if (!best.found) { say('FIND IT FIRST: DRIVE THERE', C.dim); uiSound('error'); return; }
      const target = best;
      mapV = null;
      session.pause(false);
      uiSound('select');
      if (target.garage) { session.travelTo(target); tab = 0; return; }
      travel = { name: target.name, f: 0 };
      const to = target.st ? { ...target, arrival: target.st.arrive } : target;
      session.travelTo(to, (f) => { if (travel) travel.f = f; }).then(() => { travel = null; });
      return;
    }
    if (input.pressed('back') || input.pressed('map') || input.pressed('pause')) { mapV = null; session.pause(false); uiSound('back'); }
  }

  function drawMap(ctx) {
    const v = session.player.vehicle;
    session.map.draw(ctx, mapV, { car: { x: v.x, z: v.z, heading: v.heading }, places: mapV.places, starts: mapV.starts, sel: mapV.sel, t: mapV.t });
    // crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(512 - 16, 384); ctx.lineTo(512 - 5, 384); ctx.moveTo(512 + 5, 384); ctx.lineTo(512 + 16, 384);
    ctx.moveTo(512, 384 - 16); ctx.lineTo(512, 384 - 5); ctx.moveTo(512, 384 + 5); ctx.lineTo(512, 384 + 16);
    ctx.stroke();
    // top bar
    ctx.fillStyle = 'rgba(4,8,14,0.78)';
    ctx.fillRect(0, 0, 1024, 70);
    vText(ctx, 'PORT HALCYON', 40, 46, 28, { color: '#fff' });
    const all = mapV.places.length, got = mapV.places.filter((p) => discover.has(p.id)).length;
    text(ctx, `PLACES FOUND  ${got} / ${all}`, 984, 42, { size: 13, color: C.cyan, weight: 900, spacing: 2, align: 'right' });
    const sel = mapV.sel;
    if (sel) {
      ctx.fillStyle = 'rgba(4,8,14,0.8)';
      ctx.fillRect(312, 640, 400, 54);
      vText(ctx, sel.found ? sel.name : '???', 512, 674, 20, { align: 'center', color: sel.found ? '#fff' : C.dim });
    }
    hints(ctx, [['stick', 'MOVE'], ['tabL', 'ZOOM OUT'], ['tabR', 'ZOOM IN'], ...(sel && sel.found ? [['confirm', 'TRAVEL']] : []), ['back', 'CLOSE']], { y: 740 });
  }

  // ---------------------------------------------------------------- the screen

  const scr = {
    async enter(p = {}) {
      params = p;
      const G = roamGarage.get();
      const onRoad = p.x !== undefined;
      const fromGarage = p.garage !== false && !onRoad;
      let player;
      if (p.spec || (p.car && onRoad)) {
        const spec = p.spec || CAR_BY_ID[p.car] || CAR_BY_ID.silvio;
        player = { spec, look: p.look || {}, upgrades: p.upgrades || {} };
      } else {
        player = roamGarage.player(p.car || G.car);
      }
      const start = onRoad ? { x: Number(p.x), z: Number(p.z), heading: Number(p.heading ?? 0) } : null;
      carSel = Math.max(0, CARS.findIndex((c) => c.id === player.spec.id));
      tab = 0; perfSel = 0; bodySel = 0; driveSel = 2; pending = null; toast = null; t = 0; uiA = 1;
      session = new WorldSession({
        player: { spec: player.spec, look: player.look, upgrades: player.upgrades, name: 'YOU' },
        time: p.time || G.time, garage: fromGarage, start, budget: p.budget ? Number(p.budget) : undefined,
        traffic: p.traffic === undefined ? undefined : !(p.traffic === false || p.traffic === '0' || p.traffic === 'false'),
        noGarage: !!p.noGarage, noRaces: !!p.noRaces,
        slice: Number(p.slice || game.query.get('slice') || 0) || undefined,
      });
      await session.load(game.renderer.gl, (f, l) => { loading = { f, label: l }; });
      game.renderer.setPost(session.world.at.post || {}, true);
      hud = new WorldHUD(session);
      scr.session = session;
      window.__world = session;
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
      t += dt;
      if (toast) { toast.t += dt; if (toast.t > 2.4) toast = null; }
      if (travel) return;
      if (mapV) { mapUpdate(dt); return; }
      if (raceMenu) { raceMenuUpdate(dt); return; }
      if (pauseMenu) {
        const it = pauseMenu.update(dt);
        if (input.pressed('pause') || input.pressed('back') || it?.id === 'resume') { pauseMenu = null; session.pause(false); uiSound('back'); return; }
        if (it?.id === 'reset') { session.sim.resetRacer(session.player); pauseMenu = null; session.pause(false); }
        if (it?.id === 'garage') { pauseMenu = null; session.pause(false); session.teleportToGarage(); tab = 0; }
        if (it?.id === 'map') { pauseMenu = null; session.pause(false); openMap(); }
        if (it?.id === 'quit') leave();
        return;
      }
      if (input.pressed('pause') || input.padEvent === 'lost') {
        pauseMenu = makePause();
        session.pause(true);
        uiSound('select');
        return;
      }
      if (session.inGarage) {
        if (session.state === 'garage' && input.pressed('back')) { pauseMenu = makePause(); session.pause(true); uiSound('select'); return; }
        garageUpdate(dt);
      } else if (session.canGarage && input.pressed('confirm')) {
        session.enterGarage();
        tab = 0;
        uiSound('select');
      } else if (session.atStart && !params.noRaces && input.pressed('confirm')) {
        openRace(session.atStart);
        return;
      } else if (input.pressed('map')) {
        openMap();
        return;
      }
      uiA = clamp(uiA + (session.state === 'garage' ? dt * 4 : -dt * 5), 0, 1);
      const reps = Number(game.query.get('sim') || 1);
      for (let k = 0; k < reps; k++) session.update(dt);
      Object.assign(game.fx, session.fx || {});
    },
    view() { return session && session.state !== 'loading' && !travel && !mapV ? session.view() : null; },
    draw(ctx, dt) {
      if (!session || session.state === 'loading') {
        ctx.fillStyle = '#030406';
        ctx.fillRect(0, 0, 1024, 768);
        vText(ctx, 'PORT HALCYON', 512, 360, 52, { align: 'center', color: '#fff', outline: 3, outlineColor: '#000' });
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(362, 420, 300, 4);
        ctx.fillStyle = C.accent;
        ctx.fillRect(362, 420, 300 * Math.min(1, loading.f || 0), 4);
        text(ctx, loading.label || '', 512, 450, { size: 12, color: C.dim, weight: 800, spacing: 3, align: 'center' });
        return;
      }
      if (travel) {
        ctx.fillStyle = '#030406';
        ctx.fillRect(0, 0, 1024, 768);
        text(ctx, 'FAST TRAVEL', 512, 330, { size: 12, color: C.dim, weight: 900, spacing: 4, align: 'center' });
        vText(ctx, travel.name, 512, 372, 34, { align: 'center', color: '#fff' });
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(362, 410, 300, 4);
        ctx.fillStyle = C.cyan;
        ctx.fillRect(362, 410, 300 * Math.min(1, travel.f || 0), 4);
        return;
      }
      if (mapV) { drawMap(ctx); return; }
      if (session.inGarage) {
        if (uiA > 0.01) { ctx.save(); ctx.globalAlpha = uiA; drawGarage(ctx); ctx.restore(); }
        hud.drawMessages(ctx);
      } else {
        hud.draw(ctx, dt);
        if (session.canGarage && !pauseMenu) {
          panel(ctx, 362, 600, 300, 54, { accent: C.cyan, accentLen: 90, alpha: 0.85 });
          vText(ctx, 'YOUR GARAGE', 390, 634, 18, { color: '#fff' });
          hints(ctx, [['confirm', 'GO IN']], { y: 627, x: 646 });
        } else if (session.atStart && !params.noRaces && !pauseMenu && !raceMenu) drawRacePrompt(ctx, session.atStart);
      }
      if (toast) {
        const a = clamp(Math.min(toast.t * 6, (2.4 - toast.t) * 3), 0, 1);
        ctx.save(); ctx.globalAlpha = a;
        text(ctx, toast.text, 512, 700, { size: 15, color: toast.color, weight: 900, spacing: 2, align: 'center', outline: 3 });
        ctx.restore();
      }
      if (raceMenu) drawRaceMenu(ctx);
      if (pauseMenu) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, 1024, 768);
        vText(ctx, 'PAUSE', 66, 118, 40, { color: '#fff' });
        panel(ctx, 300, 200, 424, 352, { accent: C.accent, accentLen: 140 });
        pauseMenu.draw(ctx, 320, 230, 384);
      }
    },
  };

  // ---------------------------------------------------------------- drawing the garage

  function drawGarage(ctx) {
    const s = session;
    // title + tabs
    vText(ctx, 'YOUR GARAGE', 40, 62, 30, { color: '#fff', outline: 3, outlineColor: '#000' });
    text(ctx, 'FOUNDRY ST  ·  THE WORKS  ·  PORT HALCYON', 42, 84, { size: 11, color: C.dim, weight: 800, spacing: 3 });
    TABS.forEach((nm, k) => {
      const x = 420 + k * 146;
      ctx.fillStyle = k === tab ? C.accent : 'rgba(10,14,22,0.82)';
      ctx.fillRect(x, 40, 138, 32);
      vText(ctx, nm, x + 69, 63, 14, { align: 'center', color: k === tab ? '#14100a' : C.dim });
    });
    if (tab === 0) drawCars(ctx);
    else if (tab === 1) drawPerf(ctx);
    else if (tab === 2) drawBody(ctx);
    else drawDrive(ctx);
    // the city behind the door
    if (!s.ready) {
      const f = s.readyF;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(712, 80, 270, 3);
      ctx.fillStyle = C.cyan;
      ctx.fillRect(712, 80, 270 * f, 3);
      text(ctx, s.wantLeave ? 'WARMING UP…' : `THE CITY: ${s.readyLabel || ''}`, 982, 96, { size: 10, color: s.wantLeave ? C.cyan : C.dim, weight: 800, spacing: 2, align: 'right' });
    }
  }

  /** A strip along the bottom: rating and the four bars (with a compare). */
  function carInfo(ctx, x, y, sp, up, title = null, sub = null) {
    const st = carStats(sp, up);
    const pr = prFor(sp, up);
    panel(ctx, x, y, 1000 - x, 116, { accent: C.cyan, accentLen: 140, alpha: 0.86 });
    vText(ctx, title || `${sp.make} ${sp.model}`, x + 20, y + 34, 18, { color: '#fff' });
    text(ctx, sub || `${sp.year || ''}  ·  CLASS ${sp.cls}  ·  ${engineLabel(sp)}  ·  ${Math.round(st.hp)} HP  ·  ${st.drive}`, x + 22, y + 54, { size: 10, color: C.dim, weight: 800, spacing: 1.5 });
    text(ctx, 'RATING', x + 22, y + 80, { size: 10, color: C.dim, weight: 800, spacing: 2 });
    vText(ctx, String(pr), x + 22, y + 108, 26, { color: C.accent });
    const units = settings.get('units');
    const rows = [
      ['SPEED', st.bars.speed, units === 'kmh' ? `${Math.round(st.vmax * 3.6)} KM/H` : `${Math.round(st.vmax * 2.237)} MPH`],
      ['ACCEL', st.bars.accel, `0-60 ${st.t60.toFixed(1)}S`],
      ['HANDLING', st.bars.handling, `${st.latG.toFixed(2)} G`],
      ['BRAKES', st.bars.braking, `${Math.round(st.brake60)} FT`],
    ];
    const colW = (1000 - x - 130) / 2;
    rows.forEach(([k, a, v], i) => {
      const cx = x + 118 + (i % 2) * colW, yy = y + 74 + Math.floor(i / 2) * 26;
      text(ctx, k, cx, yy + 9, { size: 10, color: C.text, weight: 800, spacing: 1.2 });
      statBar(ctx, cx + 62, yy, colW - 136, 9, a, { segments: 12, color: C.accent });
      text(ctx, v, cx + colW - 10, yy + 9, { size: 10, color: C.dim, weight: 700, align: 'right' });
    });
  }

  function drawCars(ctx) {
    const s = session;
    panel(ctx, 30, 100, 330, 604, { accent: C.accent, alpha: 0.86 });
    text(ctx, 'PICK YOUR RIDE', 52, 128, { size: 12, color: C.accent, weight: 900, spacing: 3 });
    const rows = 14, top = Math.max(0, Math.min(CARS.length - rows, carSel - 6));
    for (let k = top; k < Math.min(CARS.length, top + rows); k++) {
      const sp = CARS[k];
      const y = 160 + (k - top) * 38;
      const sel = k === carSel;
      if (sel) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(42, y - 24, 306, 34); }
      if (sp.id === s.player.spec.id) { ctx.fillStyle = C.green; ctx.beginPath(); ctx.moveTo(44, y - 15); ctx.lineTo(51, y - 9); ctx.lineTo(44, y - 3); ctx.fill(); }
      ctx.fillStyle = CLASS_COLORS[sp.cls] || '#888';
      ctx.fillRect(56, y - 16, 24, 19);
      vText(ctx, sp.cls, 68, y, 13, { align: 'center', color: '#0b0d12' });
      vText(ctx, `${sp.make} ${sp.model}`, 90, y, 13, { color: sel ? '#fff' : '#c9d1de' });
    }
    const sp = CARS[carSel];
    carInfo(ctx, 380, 588, sp, upgradesFor(roamGarage.carState(sp.id).levels, sp));
    hints(ctx, [['ud', 'CAR'], ['stick', 'LOOK'], ['tabR', 'TUNE'], ['alt', 'DRIVE OUT'], ['back', 'MENU']], { y: 740 });
  }

  function drawPerf(ctx) {
    const s = session;
    const sp = s.player.spec;
    const lv = levels();
    panel(ctx, 30, 100, 360, 604, { accent: C.accent, alpha: 0.86 });
    text(ctx, 'PERFORMANCE  ·  FREE', 52, 128, { size: 12, color: C.accent, weight: 900, spacing: 3 });
    PERF_PARTS.forEach((p, k) => {
      const y = 160 + k * 38;
      const sel = k === perfSel;
      if (sel) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(42, y - 24, 336, 34); }
      vText(ctx, p.name, 54, y, 13, { color: sel ? '#fff' : '#c9d1de' });
      const cur = lv[p.id] || 0;
      for (let tI = 1; tI <= 3; tI++) {
        const px = 282 + (tI - 1) * 30;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px, y - 14, 22, 12);
        if (tI <= cur) { ctx.fillStyle = C.accent; ctx.fillRect(px + 2, y - 12, 18, 8); }
      }
    });
    {
      const y = 160 + PERF_PARTS.length * 38;
      const sel = perfSel === PERF_PARTS.length;
      if (sel) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(42, y - 24, 336, 34); }
      vText(ctx, 'ALL PARTS', 54, y, 13, { color: sel ? C.accent : '#c9d1de' });
      text(ctx, '◄ ►', 366, y - 1, { size: 12, color: sel ? C.accent : C.dim, weight: 800, align: 'right' });
    }
    const all = perfSel >= PERF_PARTS.length;
    const part = PERF_PARTS[Math.min(perfSel, PERF_PARTS.length - 1)];
    const desc = all ? 'Every part up a tier, or down: RACE on everything for the full beast, or all of it back to stock.' : part.desc;
    paragraph(ctx, desc, 54, 160 + (PERF_PARTS.length + 1) * 38 - 14, 320, { size: 11, color: C.dim, weight: 600, lineHeight: 15 });
    const cur = all ? null : (lv[part.id] || 0);
    carInfo(ctx, 410, 588, sp, s.player.upgrades, all ? 'ALL PARTS' : `${part.name}: ${TIER_NAMES[cur]}`);
    hints(ctx, [['ud', 'PART'], ['lr', 'TIER'], ['stick', 'LOOK'], ['alt', 'DRIVE OUT'], ['back', 'MENU']], { y: 740 });
  }

  function drawBody(ctx) {
    panel(ctx, 30, 108, 400, 600, { accent: C.accent, alpha: 0.88 });
    text(ctx, 'BODY SHOP  ·  FREE', 54, 136, { size: 12, color: C.accent, weight: 900, spacing: 3 });
    BODY_PARTS.forEach((p, k) => {
      const y = 170 + k * 38;
      const sel = k === bodySel;
      if (sel) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(44, y - 24, 372, 34); }
      vText(ctx, p.name, 58, y, 14, { color: sel ? '#fff' : '#c9d1de' });
      const v = bodyVal(p);
      if (p.swatch) {
        if (v) { ctx.fillStyle = v; ctx.fillRect(330, y - 16, 34, 18); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(330, y - 16, 34, 18); }
        else text(ctx, 'NONE', 398, y, { size: 12, color: C.dim, weight: 800, align: 'right' });
      } else {
        text(ctx, p.label(v), 398, y, { size: 12, color: sel ? C.accent : C.dim, weight: 800, align: 'right' });
      }
      if (sel) { text(ctx, '◄', 314, y, { size: 11, color: C.accent }); text(ctx, '►', 404, y, { size: 11, color: C.accent }); }
    });
    hints(ctx, [['ud', 'PART'], ['lr', 'STYLE'], ['stick', 'LOOK'], ['alt', 'DRIVE OUT'], ['back', 'MENU']], { y: 740 });
  }

  function drawDrive(ctx) {
    const s = session;
    panel(ctx, 30, 108, 400, 300, { accent: C.accent, alpha: 0.88 });
    text(ctx, 'HIT THE STREETS', 54, 136, { size: 12, color: C.accent, weight: 900, spacing: 3 });
    const rows = [
      ['TIME OF DAY', TIME_LABEL[s.def.time] || s.def.time.toUpperCase()],
      ['CAMERA', CAM_MODES[s.camera.mode].name],
      ['DRIVE OUT', s.ready ? '' : `${Math.round(s.readyF * 100)}%`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 186 + i * 52;
      const sel = i === driveSel;
      if (sel) { ctx.fillStyle = i === 2 ? 'rgba(70,232,255,0.2)' : 'rgba(255,178,30,0.16)'; ctx.fillRect(44, y - 30, 372, 44); }
      vText(ctx, k, 58, y, i === 2 ? 22 : 16, { color: sel ? '#fff' : '#c9d1de' });
      if (v) text(ctx, i < 2 ? `◄  ${v}  ►` : v, 404, y - 2, { size: 13, color: sel ? C.accent : C.dim, weight: 800, align: 'right' });
    });
    paragraph(ctx, 'The whole city, no clock, no rivals. Backroads, bridges, the lake, the mountains, the desert, and places that aren\'t on any map. Park back in here any time.', 54, 352, 360, { size: 12, color: C.dim, weight: 600, lineHeight: 16 });
    hints(ctx, [['ud', 'OPTION'], ['lr', 'CHANGE'], ['confirm', 'GO'], ['stick', 'LOOK'], ['back', 'MENU']], { y: 740 });
  }

  return scr;
});
