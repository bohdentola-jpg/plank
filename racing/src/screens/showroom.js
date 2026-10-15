// QUICK RACE — the Friday meet on level P2 of a parking structure. Walk the
// row of cars (← →, L1/R1 jumps a class), pick a paint (↑ ↓); the car you stop
// at fires up. ✕ takes it, then you plan the route over the hood: region
// (L1/R1), track, race type, laps, rivals, skill, catch-up. ✕ — race.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { buildLotScene, BAY } from './lotScene.js';
import { buildCarModel } from '../car/model.js';
import { CARS, CAR_BY_ID, CLASS_ORDER } from '../car/cars.js';
import { carStats } from '../car/stats.js';
import { TRACKS, TRACK_BY_ID } from '../track/tracks.js';
import { drawTrackMap, drawElevation, trackInfo, fmtDistance } from './trackmap.js';
import { C, vText, vWidth, text, paragraph, panel, hints, statBar, hit, usingPad, padGlyph, keyCap } from '../core/ui.js';
import { Menu, uiSound } from '../core/menu.js';
import { input } from '../core/input.js';
import { settings, store } from '../core/settings.js';
import { clamp, damp, makeRng } from '../core/util.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { EngineSound } from '../audio/engine.js';
import { engineProfile } from '../race/session.js';
import { knockLaps } from '../race/sim.js';

export const PALETTE = [
  ['#c8102e', 'RALLY RED'], ['#f2f1ec', 'CHAMPIONSHIP WHITE'], ['#0e0f12', 'MIDNIGHT BLACK'], ['#a9aeb5', 'ARCTIC SILVER'],
  ['#1d3f8f', 'WR BLUE'], ['#e3b52a', 'SUNBURST YELLOW'], ['#f26a1b', 'BLAZE ORANGE'], ['#2b7a3a', 'RACING GREEN'],
  ['#5b2a86', 'MIDNIGHT PURPLE'], ['#36a8c9', 'BAYSIDE TEAL'], ['#7a1020', 'BORDEAUX'], ['#555b63', 'GUNMETAL'],
];

const ENGINE_NAMES = { i4: 'INLINE-4', i6: 'INLINE-6', v6: 'V6', v8: 'V8', v10: 'V10', v12: 'V12', flat6: 'FLAT-6', boxer4: 'BOXER-4', rotary: 'TWIN-ROTOR' };
export const engineLabel = (spec) => {
  const tb = spec.sound.turbo || 0;
  return (ENGINE_NAMES[spec.sound.layout] || spec.sound.layout.toUpperCase()) + (tb >= 0.8 ? ' TWIN-TURBO' : tb > 0 ? ' TURBO' : '');
};
export const CLASS_COLORS = { D: '#3fbf6a', C: '#4a8fe0', B: '#f0a020', A: '#e8443a', S: '#a45cf0' };

export const REGIONS = [
  ['city', 'CITY'], ['docks', 'DOCKS'], ['highway', 'HIGHWAY'], ['circuit', 'RACEWAY'], ['mountain', 'MOUNTAIN'], ['desert', 'DESERT'],
];
export const TYPE_NAMES = { circuit: 'CIRCUIT', sprint: 'SPRINT', knockout: 'KNOCKOUT', drag: 'DRAG', timeattack: 'TIME ATTACK', drift: 'DRIFT' };
const TYPE_DESC = {
  circuit: 'Lapped race. First across the line after the final lap wins.',
  sprint: 'Point to point. One run, no second chances.',
  knockout: 'Last car across the line each lap is out. Survive to the end.',
  drag: 'Quarter mile. Launch, shift on the light, don\'t blink.',
  timeattack: 'Just you and the clock — chase the pro\'s ghost.',
  drift: 'Score attack. Angle times speed, chain it for multipliers, don\'t touch anything.',
};
export const typesFor = (def) => (def.type === 'drag' ? ['drag'] : def.type === 'sprint' ? ['sprint', 'timeattack'] : ['circuit', 'knockout', 'drift', 'timeattack']);
export const SKILLS = [
  { label: 'ROOKIE', v: 0.35 }, { label: 'STREET', v: 0.6 }, { label: 'PRO', v: 0.8 }, { label: 'LEGEND', v: 0.95 },
];
const TIME_NAMES = { night: 'NIGHT', dusk: 'DUSK', sunset: 'SUNSET', day: 'DAY', overcast: 'OVERCAST' };
const WEATHER_NAMES = { dry: 'DRY', wet: 'WET ROADS', rain: 'RAIN' };

function loadCfg() {
  const d = store.load('quick') || {};
  return {
    car: CAR_BY_ID[d.car] ? d.car : 'civica',
    paints: d.paints || {},
    track: TRACK_BY_ID[d.track] ? d.track : TRACKS[0].id,
    type: d.type || null,
    laps: d.laps || null,
    opp: d.opp ?? 5,
    skill: d.skill ?? 1,
    catchup: d.catchup ?? true,
  };
}

/** Same-class rivals with their own paint; duplicates allowed in small classes. */
export function pickRivals(spec, count, skillV, playerPaint, seed = 'q') {
  const rng = makeRng(seed + spec.id + count);
  const same = CARS.filter((c) => c.cls === spec.cls && c.id !== spec.id);
  const pool = same.length ? same : [spec];
  const out = [];
  const order = pool.slice().sort(() => rng() - 0.5);
  for (let k = 0; k < count; k++) {
    const s = k < order.length ? order[k] : (rng() < 0.3 ? spec : pool[Math.floor(rng() * pool.length)]);
    const cols = PALETTE.map((p) => p[0]).filter((c) => c !== playerPaint);
    const paint = k < order.length && rng() < 0.5 ? undefined : cols[Math.floor(rng() * cols.length)];
    const spread = count > 1 ? (k / (count - 1) - 0.5) * 0.16 : 0;
    out.push({ spec: s, look: paint ? { paint } : {}, skill: clamp(skillV + spread, 0.3, 1) });
  }
  return out;
}

registerScreen('showroom', () => {
  let L = null;
  let phase = 'car';
  let phaseT = 0;
  let t = 0;
  let idx = 0;
  let camK = 0;
  let settle = 0;
  let orbit = 0;
  let cfg = loadCfg();
  let region = 'city';
  let menu = null;
  let launch = null;
  let engine = null;
  let running = -1;      // bay whose engine is running
  let rev = 0;           // 0..1 rev blip envelope
  let revQueue = [];
  let lightsOn = 0;
  const models = new Map();
  const n = CARS.length;

  const paintOf = (k) => cfg.paints[CARS[k].id] || CARS[k].stockLook?.paint || '#c0c4ca';
  const spec = () => CARS[idx];

  function place(m, k) {
    m.group.position.set(k * BAY, 0, -0.35);
    m.group.traverse((o) => { if (o.isMesh && !o.material?.transparent) o.castShadow = true; });
  }

  function build(k, hi) {
    const old = models.get(k);
    if (old) { L.scene.remove(old.m.group); old.m.dispose(); }
    const m = buildCarModel(CARS[k], { paint: paintOf(k) }, { hiRes: hi, interior: true, shadow: true });
    place(m, k);
    m.setLights(0, 0.1, 0);
    L.scene.add(m.group);
    models.set(k, { m, hi, paint: paintOf(k) });
    return m;
  }

  /** Keep a small window of cars around the camera; one build per frame. */
  function syncModels() {
    for (const [k, e] of models) {
      if (k < idx - 4 || k > idx + 2) { L.scene.remove(e.m.group); e.m.dispose(); models.delete(k); }
    }
    for (const k of [idx, idx - 1, idx + 1, idx - 2, idx - 3]) {
      if (k < 0 || k >= n) continue;
      const e = models.get(k);
      if (!e || e.paint !== paintOf(k)) { build(k, k === idx && Math.abs(camK - idx) < 0.1); return; }
    }
    // upgrade the settled car to the detailed build
    const cur = models.get(idx);
    if (cur && !cur.hi && Math.abs(camK - idx) < 0.04) build(idx, true);
  }

  function setCar(k, snap = false) {
    k = clamp(k, 0, n - 1);
    if (k === idx && !snap) return;
    idx = k;
    cfg.car = CARS[k].id;
    settle = 0;
    orbit *= 0.3;
    if (snap) camK = k;
    uiSound('move');
  }

  function stopEngine() {
    try { engine?.stop(); } catch { /* */ }
    engine = null;
    const e = models.get(running);
    if (e) e.m.setLights(0, 0.1, 0);
    running = -1;
    lightsOn = 0;
  }

  function startEngine(k) {
    stopEngine();
    running = k;
    try {
      sfx.engineStart();
      engine = new EngineSound(engineProfile(CARS[k]), { player: false });
      engine.setSpatial({ gain: 0, pan: 0.15, doppler: 1 });
    } catch { /* audio not ready */ }
    revQueue = [0.55];
  }

  // ---------------------------------------------------------------- route phase
  const regionTracks = (r) => TRACKS.filter((d) => d.env === r);
  const regions = () => REGIONS.filter(([r]) => regionTracks(r).length);
  const track = () => TRACK_BY_ID[cfg.track] || TRACKS[0];
  const racers = () => (cfg.type === 'timeattack' || cfg.type === 'drift' ? 1 : cfg.opp + 1);
  const trafficOK = () => ['city', 'highway', 'docks'].includes(track().env) && cfg.type !== 'drag';

  function fixType() {
    const allowed = typesFor(track());
    if (!allowed.includes(cfg.type)) cfg.type = allowed[0];
    if (cfg.type === 'drag') cfg.opp = clamp(cfg.opp, 1, (track().dragLanes?.length || 2) - 1);
    if (cfg.type === 'knockout') cfg.opp = Math.max(2, cfg.opp);
    if (!cfg.laps || cfg.type === 'circuit' && cfg._lapsTrack !== cfg.track) { cfg.laps = track().laps || 3; cfg._lapsTrack = cfg.track; }
  }

  function makeMenu() {
    const items = [
      {
        label: 'TRACK', type: 'choice', id: 'track',
        get options() { return regionTracks(region).map((d) => ({ value: d.id, label: d.name })); },
        get: () => cfg.track,
        set: (v) => { cfg.track = v; fixType(); },
      },
      {
        label: 'RACE TYPE', type: 'choice', id: 'type',
        get options() { return typesFor(track()).map((v) => ({ value: v, label: TYPE_NAMES[v] })); },
        get: () => cfg.type, set: (v) => { cfg.type = v; fixType(); },
      },
      {
        label: 'LAPS', type: 'choice', id: 'laps',
        get options() {
          if (cfg.type === 'sprint' || cfg.type === 'drag') return [{ value: cfg.laps, label: '—' }];
          if (cfg.type === 'knockout') return [{ value: cfg.laps, label: `${knockLaps(cfg.opp)} (AUTO)` }];
          return Array.from({ length: 10 }, (_, k) => ({ value: k + 1, label: String(k + 1) }));
        },
        get: () => cfg.laps, set: (v) => { cfg.laps = v; },
      },
      {
        label: 'RIVALS', type: 'choice', id: 'opp',
        get options() {
          if (cfg.type === 'timeattack' || cfg.type === 'drift') return [{ value: cfg.opp, label: cfg.type === 'drift' ? 'POSTED SCORES' : 'NONE' }];
          const max = cfg.type === 'drag' ? (track().dragLanes?.length || 2) - 1 : 7;
          const min = cfg.type === 'knockout' ? 2 : 1;
          return Array.from({ length: max - min + 1 }, (_, k) => ({ value: k + min, label: String(k + min) }));
        },
        get: () => cfg.opp, set: (v) => { cfg.opp = v; },
      },
      {
        label: 'SKILL', type: 'choice', id: 'skill',
        options: SKILLS.map((s, k) => ({ value: k, label: s.label })),
        get: () => cfg.skill, set: (v) => { cfg.skill = v; },
      },
      {
        label: 'CATCH-UP', type: 'choice', id: 'catchup',
        options: [{ value: true, label: 'ON' }, { value: false, label: 'OFF' }],
        get: () => cfg.catchup, set: (v) => { cfg.catchup = v; },
      },
      {
        label: 'TRAFFIC', type: 'choice', id: 'traffic',
        get options() { return trafficOK() ? [{ value: true, label: 'ON' }, { value: false, label: 'OFF' }] : [{ value: false, label: 'CLOSED ROAD' }]; },
        get: () => (trafficOK() ? cfg.traffic ?? !!track().traffic : false), set: (v) => { cfg.traffic = v; },
      },
      { label: 'RACE!', id: 'race' },
    ];
    return new Menu(items, { id: 'route', sel: 0 });
  }

  function enterRoute() {
    phase = 'route';
    phaseT = 0;
    region = track().env;
    if (!regionTracks(region).length) { region = regions()[0][0]; cfg.track = regionTracks(region)[0].id; }
    fixType();
    menu = makeMenu();
    try { music.play('nitro', { fade: 2.5, intensity: 0.7 }); } catch { /* */ }
  }

  function switchRegion(dir) {
    const rs = regions().map((r) => r[0]);
    const k = (rs.indexOf(region) + dir + rs.length) % rs.length;
    region = rs[k];
    cfg.track = regionTracks(region)[0].id;
    fixType();
    uiSound('tab');
  }

  function save() {
    const { _lapsTrack, ...keep } = cfg;
    void _lapsTrack;
    store.save('quick', keep);
    store.save('lastCar', cfg.car);
  }

  function startRace() {
    save();
    const sp = CAR_BY_ID[cfg.car];
    const def = track();
    const type = cfg.type;
    const opp = type === 'timeattack' || type === 'drift' ? 0 : cfg.opp;
    const skill = SKILLS[cfg.skill].v;
    const params = {
      track: def.id, car: sp.id, look: { paint: paintOf(idx) }, type,
      laps: type === 'knockout' ? knockLaps(opp) : cfg.laps,
      opponents: pickRivals(sp, opp, skill, paintOf(idx), def.id + type),
      rubber: cfg.catchup ? 1 : 0,
      traffic: trafficOK() ? (cfg.traffic ?? !!def.traffic) : false,
      back: 'showroom', station: 'quick',
    };
    go('race', params);
  }

  // ---------------------------------------------------------------- screen

  const scr = {
    enter(p = {}) {
      L = buildLotScene(game.renderer.gl, CARS);
      game.renderer.setPost({ exposure: 1.15, bloomStrength: 0.9, bloomThreshold: 0.95, saturation: 1.02, contrast: 1.08, vignette: 0.85, lift: [0.004, 0.006, 0.012], gain: [1.0, 1.0, 1.02] }, true);
      idx = Math.max(0, CARS.findIndex((c) => c.id === cfg.car));
      setCar(idx, true);
      build(idx, true);
      for (const k of [idx - 1, idx + 1, idx - 2]) if (k >= 0 && k < n) build(k, false);
      try {
        if (music.theme !== 'showroom') music.play('showroom', { fade: 2, intensity: 0.55 });
        music.setTuning(0, true);
        sfx.ambience('city');
      } catch { /* */ }
      if (p.resume === 'route' || p.resume === 'setup') { startEngine(idx); enterRoute(); }
      window.__showroom = { setCar, enterRoute, cfg, get phase() { return phase; } };
    },
    exit() {
      stopEngine();
      for (const e of models.values()) e.m.dispose();
      models.clear();
      try { sfx.ambience(null); } catch { /* */ }
      L?.dispose();
      L = null;
    },
    update(dt, busy) {
      if (!L) return;
      t += dt;
      phaseT += dt;
      L.update(dt, t);
      try { music.update?.(); } catch { /* */ }

      if (!busy && !launch) {
        if (phase === 'car') {
          if (input.pressed('right')) setCar(idx + 1);
          if (input.pressed('left')) setCar(idx - 1);
          if (input.pressed('tabR') || input.pressed('tabL')) {
            const dir = input.pressed('tabR') ? 1 : -1;
            const ci = CLASS_ORDER.indexOf(CARS[idx].cls);
            const target = CLASS_ORDER[clamp(ci + dir, 0, CLASS_ORDER.length - 1)];
            const k = CARS.findIndex((c) => c.cls === target);
            if (k >= 0) setCar(k);
          }
          if (input.pressed('up') || input.pressed('down')) {
            const cols = PALETTE.map((p) => p[0]);
            const cur = cols.indexOf(paintOf(idx));
            const nx = (cur + (input.pressed('down') ? 1 : -1) + cols.length) % cols.length;
            cfg.paints[CARS[idx].id] = cols[nx];
            uiSound('tab');
          }
          if (input.takeClick()) {
            const h = hit.hover || '';
            if (h.startsWith('car:')) setCar(parseInt(h.slice(4), 10));
            else if (h.startsWith('paint:')) { cfg.paints[CARS[idx].id] = PALETTE[parseInt(h.slice(6), 10)][0]; uiSound('tab'); }
            else if (h === 'take') takeCar();
          }
          if (input.pressed('confirm')) takeCar();
          if (input.pressed('back')) { save(); go('radio', { station: 'quick' }); return; }
        } else if (phase === 'route') {
          if (input.pressed('tabR')) switchRegion(1);
          if (input.pressed('tabL')) switchRegion(-1);
          if (input.takeClick() && hit.hover?.startsWith('region:')) {
            region = hit.hover.slice(7);
            cfg.track = regionTracks(region)[0].id;
            fixType();
            uiSound('tab');
          }
          const it = menu.update(dt);
          const go2 = it?.id === 'race' || (input.pressed('confirm') && menu.current?.type === 'choice');
          if (go2) { launch = { t: 0 }; revQueue = [1, 1]; try { sfx.ui('select'); } catch { /* */ } }
          if (input.pressed('back')) { phase = 'car'; phaseT = 0; uiSound('back'); }
        }
      }

      // camera slide + model window
      camK = damp(camK, idx, 7.5, dt);
      if (Math.abs(camK - idx) < 0.002) camK = idx;
      syncModels();
      L.focus(camK);
      settle += dt;
      if (settle > 0.55 && running !== idx && Math.abs(camK - idx) < 0.05) startEngine(idx);
      if (running >= 0 && running !== idx && Math.abs(camK - idx) > 0.3) stopEngine();

      // orbit: right stick / mouse drag, drift back to the default angle
      const rs = Math.abs(input.axes[2] || 0) > 0.15 ? input.axes[2] : 0;
      if (rs) orbit = clamp(orbit + rs * dt * 1.6, -1.25, 1.1);
      else if (input.mouse.down && input.device === 'mouse') orbit = clamp(orbit + (input.mouse.dx || 0) * 0.004, -1.25, 1.1);
      else orbit = damp(orbit, 0, 0.6, dt);

      // engine: idle with rev blips on cue
      const e = models.get(running);
      if (running >= 0 && e) {
        lightsOn = Math.min(1, lightsOn + dt * 1.5);
        e.m.setLights(lightsOn > 0.3 ? 0.35 : 0, 0.5 * lightsOn, 0);
        if (revQueue.length && rev <= 0.02) { rev = revQueue.shift(); }
        const sp = CARS[running];
        const rpm = sp.perf.idle * (1 + Math.sin(t * 9) * 0.015) + rev * (sp.perf.redline * 0.78 - sp.perf.idle);
        try {
          engine?.update(dt, { rpm, throttle: rev > 0.05 ? 1 : 0.03, load: rev > 0.05 ? 0.9 : 0, gear: 0 });
          engine?.setSpatial({ gain: 0.55, pan: 0.1, doppler: 1 });
        } catch { /* */ }
        if (rev > 0.05) input.rumble(0.12 * rev, 0.25 * rev, 60);
        rev = Math.max(0, rev - dt * (rev > 0.6 ? 1.6 : 2.4));
        e.m.animate(dt, 0, 0, -rev * 0.006, Math.sin(t * 31) * 0.0015 * (0.3 + rev), 0);
      }

      // launch: revs, then cut to the race
      if (launch) {
        launch.t += dt;
        if (launch.t > 1.3 && !launch.went) { launch.went = true; startRace(); }
      }
      updateCamera(dt);
    },
    view() { return L ? { scene: L.scene, camera: L.camera } : null; },
    draw(ctx) {
      if (!L) return;
      if (phase === 'car') drawCarPhase(ctx);
      else drawRoutePhase(ctx);
    },
  };

  function takeCar() {
    uiSound('select');
    if (running !== idx) startEngine(idx);
    revQueue.push(0.9);
    save();
    enterRoute();
  }

  const _v = new THREE.Vector3();
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  let camInit = false;
  function updateCamera(dt) {
    const cx = camK * BAY, cz = -0.35;
    let off, tgt, fov;
    if (phase === 'car') {
      off = [3.5, 1.2, 7.1]; tgt = [-1.35, 0.55, 0.3]; fov = 38;
    } else {
      // route: low over the front corner, car at the right edge of frame
      off = [-2.6, 0.78, 4.9]; tgt = [-0.2, 0.62, -1.4]; fov = 46;
    }
    if (launch) { const k = Math.min(1, launch.t / 1.3); off = [off[0] * (1 - k * 0.35), off[1] - k * 0.25, off[2] * (1 - k * 0.4)]; }
    const a = orbit + Math.sin(t * 0.21) * 0.05;
    const ca = Math.cos(a), sa = Math.sin(a);
    const rot = (p) => [p[0] * ca + p[2] * sa, p[1], -p[0] * sa + p[2] * ca];
    const o = rot(off), g = rot(tgt);
    _v.set(cx + o[0], o[1] + Math.sin(t * 0.37) * 0.025, cz + o[2]);
    if (!camInit) { camPos.copy(_v); camTgt.set(cx + g[0], g[1], cz + g[2]); camInit = true; }
    const k = 1 - Math.exp(-dt * (phaseT < 1.5 ? 3.5 : 6));
    camPos.lerp(_v, k);
    camTgt.lerp(_v.set(cx + g[0], g[1], cz + g[2]), k);
    // keep the sideways slide crisp
    camPos.x = cx + o[0] + (camPos.x - (cx + o[0])) * 0.5;
    L.camera.position.copy(camPos);
    L.camera.lookAt(camTgt);
    if (Math.abs(L.camera.fov - fov) > 0.01) { L.camera.fov += (fov - L.camera.fov) * Math.min(1, dt * 4); L.camera.updateProjectionMatrix(); }
  }

  // ---------------------------------------------------------------- drawing

  function drawCarPhase(ctx) {
    const sp = spec();
    const st = carStats(sp);
    const units = settings.get('units');
    const a = clamp(phaseT / 0.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    // title strip
    text(ctx, 'NITRO 88.1  ·  QUICK RACE', 48, 40, { size: 13, color: C.cyan, weight: 800, spacing: 3 });
    vText(ctx, 'THE LOT', 46, 92, 38, { color: '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.7)', shadow: [3, 3, 'rgba(0,0,0,0.5)'] });
    text(ctx, 'LEVEL P2  ·  FRIDAY 11:48 PM', 62 + vWidth('THE LOT', 38), 90, { size: 13, color: C.dim, weight: 700, spacing: 2 });

    // spec card
    const px = 34, py = 118, pw = 392, ph = 470;
    panel(ctx, px, py, pw, ph, { accent: CLASS_COLORS[sp.cls], accentLen: 160, alpha: 0.93 });
    // class badge
    ctx.fillStyle = CLASS_COLORS[sp.cls];
    ctx.beginPath();
    ctx.moveTo(px + 30, py + 22); ctx.lineTo(px + 74, py + 22); ctx.lineTo(px + 66, py + 62); ctx.lineTo(px + 22, py + 62);
    ctx.closePath();
    ctx.fill();
    vText(ctx, sp.cls, px + 48, py + 54, 30, { align: 'center', color: '#fff', outline: 2, outlineColor: 'rgba(0,0,0,0.4)' });
    text(ctx, `${sp.year}  ·  ${sp.make}`, px + 88, py + 38, { size: 14, color: C.dim, weight: 800, spacing: 2 });
    text(ctx, `CLASS ${sp.cls}  ·  ${st.drive}`, px + 88, py + 58, { size: 12, color: CLASS_COLORS[sp.cls], weight: 800, spacing: 2 });
    const nameSize = Math.min(34, (pw - 50) / Math.max(1, vWidth(sp.model, 1)));
    vText(ctx, sp.model, px + 24, py + 104, nameSize, { color: '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.6)', shadow: [2, 3, 'rgba(0,0,0,0.5)'] });
    paragraph(ctx, sp.blurb, px + 26, py + 134, pw - 56, { size: 13, color: '#bcc5d3', weight: 500, lineHeight: 18 });

    // spec table
    const rows = [
      ['ENGINE', engineLabel(sp)],
      ['POWER', `${st.hp} HP @ ${sp.perf.rpmPeak.toLocaleString()} RPM`],
      ['WEIGHT', units === 'kmh' ? `${st.weight.toLocaleString()} KG` : `${Math.round(st.weight * 2.2046).toLocaleString()} LB`],
      [units === 'kmh' ? '0-100 KM/H' : '0-60 MPH', `${(units === 'kmh' ? st.t60 * 1.04 : st.t60).toFixed(1)} S`],
      ['TOP SPEED', units === 'kmh' ? `${Math.round(st.vmax * 3.6)} KM/H` : `${Math.round(st.vmax * 2.23694)} MPH`],
    ];
    rows.forEach(([k, v], i) => {
      const y = py + 206 + i * 24;
      text(ctx, k, px + 26, y, { size: 12, color: C.dim, weight: 800, spacing: 1.5 });
      text(ctx, v, px + pw - 30, y, { size: 14, color: '#e8edf5', weight: 700, align: 'right' });
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(px + 26, y + 8, pw - 56, 1);
    });
    // performance bars
    const bars = [['SPEED', st.bars.speed], ['ACCELERATION', st.bars.accel], ['HANDLING', st.bars.handling], ['BRAKING', st.bars.braking]];
    bars.forEach(([k, v], i) => {
      const y = py + 345 + i * 30;
      text(ctx, k, px + 26, y + 9, { size: 12, color: C.text, weight: 800, spacing: 1.5 });
      statBar(ctx, px + 148, y, pw - 182, 11, v, { segments: 16, color: CLASS_COLORS[sp.cls] });
    });

    // paint swatches
    text(ctx, 'PAINT', 48, 622, { size: 12, color: C.dim, weight: 800, spacing: 2 });
    const cur = paintOf(idx);
    const curName = (PALETTE.find((p) => p[0] === cur) || [cur, 'FACTORY'])[1];
    text(ctx, curName, 104, 622, { size: 13, color: '#fff', weight: 800, spacing: 1 });
    PALETTE.forEach(([col], i) => {
      const x = 48 + i * 30, y = 634;
      hit.add(`paint:${i}`, x, y, 26, 22);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 26, 20);
      ctx.strokeStyle = col === cur ? '#fff' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = col === cur ? 2.5 : 1;
      ctx.strokeRect(x, y, 26, 20);
    });

    // the row: one tick per bay, grouped by class
    const rx0 = 470, ry = 690, cw = 30;
    let lastCls = null;
    CARS.forEach((c, k) => {
      const x = rx0 + k * cw;
      if (c.cls !== lastCls) { text(ctx, c.cls, x + 2, ry - 10, { size: 11, color: CLASS_COLORS[c.cls], weight: 900 }); lastCls = c.cls; }
      hit.add(`car:${k}`, x, ry - 6, cw - 4, 20);
      ctx.fillStyle = k === idx ? CLASS_COLORS[c.cls] : 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, ry, cw - 6, k === idx ? 8 : 5);
    });
    text(ctx, `${idx + 1} / ${n}`, rx0 + n * cw + 6, ry + 8, { size: 13, color: C.dim, weight: 800 });

    // take it
    const pulse = 0.65 + 0.35 * Math.sin(t * 5);
    ctx.globalAlpha = a * pulse;
    const bx = 640, by = 640;
    hit.add('take', bx - 10, by - 22, 260, 32);
    if (usingPad()) padGlyph(ctx, 'cross', bx + 12, by - 5, 12); else keyCap(ctx, 'ENTER', bx + 24, by - 5, 20);
    text(ctx, 'TAKE IT OUT', bx + (usingPad() ? 32 : 58), by, { size: 17, color: '#fff', weight: 900, spacing: 2 });
    ctx.restore();
    hints(ctx, [['lr', 'CAR'], ['tabR', 'CLASS'], ['ud', 'PAINT'], ['stick', 'LOOK'], ['back', 'RADIO']], { y: 740 });
  }

  function drawRoutePhase(ctx) {
    const def = track();
    const info = trackInfo(def);
    const units = settings.get('units');
    const a = clamp(phaseT / 0.35, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    text(ctx, 'NITRO 88.1  ·  QUICK RACE', 48, 40, { size: 13, color: C.cyan, weight: 800, spacing: 3 });
    vText(ctx, 'THE ROUTE', 46, 92, 38, { color: '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.7)', shadow: [3, 3, 'rgba(0,0,0,0.5)'] });
    const sp = spec();
    text(ctx, `${sp.make} ${sp.model}`, 62 + vWidth('THE ROUTE', 38), 90, { size: 13, color: C.dim, weight: 700, spacing: 2 });

    // region tabs
    const rs = regions();
    let tx = 70;
    if (usingPad()) padGlyph(ctx, 'L1', 50, 126, 10); else keyCap(ctx, 'Q', 52, 126, 18);
    rs.forEach(([r, label]) => {
      const on = r === region;
      const w = vWidth(label, 15) + 22;
      hit.add(`region:${r}`, tx, 110, w, 30);
      if (on) {
        ctx.fillStyle = C.accent;
        ctx.beginPath();
        ctx.moveTo(tx + 6, 112); ctx.lineTo(tx + w, 112); ctx.lineTo(tx + w - 6, 138); ctx.lineTo(tx, 138);
        ctx.closePath();
        ctx.fill();
      }
      vText(ctx, label, tx + w / 2, 132, 15, { align: 'center', color: on ? '#14100a' : C.dim });
      tx += w + 4;
    });
    if (usingPad()) padGlyph(ctx, 'R1', tx + 18, 126, 10); else keyCap(ctx, 'E', tx + 14, 126, 18);

    // map
    const mx = 34, my = 150, mw = 560, mh = 360;
    panel(ctx, mx, my, mw, mh, { accent: C.accent, accentLen: 220, skew: 0, alpha: 0.96 });
    drawTrackMap(ctx, def, mx + 2, my + 2, mw - 4, mh - 4, { t: game.time });
    vText(ctx, def.name, mx + 22, my + 40, 26, { color: '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.8)' });
    text(ctx, `${(REGIONS.find((r) => r[0] === def.env) || [0, def.env])[1]}  ·  ${TIME_NAMES[def.time] || def.time}  ·  ${WEATHER_NAMES[def.weather] || def.weather}`, mx + 24, my + 62, { size: 12, color: C.cyan, weight: 800, spacing: 2 });
    // track carousel position
    const list = regionTracks(region);
    const ti = list.findIndex((d) => d.id === def.id);
    text(ctx, `${ti + 1}/${list.length}`, mx + mw - 20, my + 30, { size: 13, color: C.dim, weight: 800, align: 'right' });

    // facts + elevation
    const fy = my + mh + 22;
    const facts = [
      ['LENGTH', fmtDistance(info.length * (def.type === 'drag' ? 0 : 1) || 402, units)],
      ['TURNS', def.type === 'drag' ? '0' : String(info.turns)],
      ['ELEVATION', `${Math.round((info.maxY - info.minY) * (units === 'kmh' ? 1 : 3.281))} ${units === 'kmh' ? 'M' : 'FT'}`],
      ['RECORD', recordFor(def.id)],
    ];
    facts.forEach(([k, v], i) => {
      const x = mx + 10 + i * 140;
      text(ctx, k, x + 14, fy, { size: 11, color: C.dim, weight: 800, spacing: 1.5 });
      vText(ctx, v, x + 14, fy + 24, 17, { color: '#fff' });
    });
    drawElevation(ctx, def, mx + 24, fy + 38, mw - 48, 30);
    if (info.maxY - info.minY < 3) text(ctx, 'FLAT', mx + mw / 2, fy + 58, { size: 11, color: C.dim, weight: 800, spacing: 3, align: 'center' });
    paragraph(ctx, def.blurb || '', mx + 24, fy + 92, mw - 48, { size: 13, color: '#bcc5d3', weight: 500, lineHeight: 18 });

    // options
    const ox = 620, oy = 150, ow = 370, oh = 360;
    panel(ctx, ox, oy, ow, oh, { accent: C.cyan, accentLen: 120, alpha: 0.9 });
    menu.draw(ctx, ox + 42, oy + 48, ow - 60, { rowH: 39, size: 17, hints: false });
    text(ctx, TYPE_DESC[cfg.type] || '', ox + 24, oy + oh + 26, { size: 13, color: C.dim, weight: 600 });
    const rc = racers();
    text(ctx, `${rc} CAR${rc > 1 ? 'S' : ''} ON THE GRID  ·  ${SKILLS[cfg.skill].label} RIVALS`, ox + 24, oy + oh + 48, { size: 12, color: '#8fa0b8', weight: 700, spacing: 1 });
    ctx.restore();
    hints(ctx, [['tabR', 'REGION'], ['ud', 'OPTION'], ['lr', 'CHANGE'], ['confirm', 'RACE'], ['back', 'CAR']], { y: 740 });
  }

  function recordFor(id) {
    const r = (store.load('records') || {})[id];
    if (!r || !r.bestLap) return '--:--.--';
    const m = Math.floor(r.bestLap / 60), s = r.bestLap - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
  }

  return scr;
});
