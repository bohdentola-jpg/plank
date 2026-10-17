// MAIN MENU — the car radio. You're parked at a red light; each FM station
// is a game mode with its own music. Tune between them (static in between),
// press ✕ on a station and the light turns green.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { buildRadioScene, EYE } from './radioScene.js';
import { buildCarModel } from '../car/model.js';
import { CARS, CAR_BY_ID } from '../car/cars.js';
import { C, vText, text, panel, hints, hit, usingPad, padGlyph, keyCap, paragraph } from '../core/ui.js';
import { input } from '../core/input.js';
import { clamp, damp, fmtTime, disposeTree } from '../core/util.js';
import { store } from '../core/settings.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { EngineSound } from '../audio/engine.js';
import { engineProfile } from '../race/session.js';
import { CHAPTERS } from '../story/data.js';

export const STATIONS = [
  { id: 'quick', freq: 88.1, name: 'NITRO 88.1', theme: 'nitro', mode: 'QUICK RACE', rds: 'NITRO 88.1 * DRUM N BASS ALL NIGHT * ',
    desc: 'Pick any car on the lot, pick any road in the city — or out of it — and race. Circuits, sprints, knockouts, drag strips.', screen: 'showroom' },
  { id: 'story', freq: 92.7, name: 'THE UNDERGROUND 92.7', theme: 'underground', mode: 'STORY', rds: '92.7 THE UNDERGROUND * WHO RUNS PORT HALCYON? * ',
    desc: 'New in town with eight grand and a borrowed garage. Build your car from the frame up and take the city crew by crew.', screen: 'story' },
  { id: 'records', freq: 97.9, name: 'HALL OF FAME 97.9', theme: 'records', mode: 'RECORDS', rds: '97.9 HALL OF FAME * TOP TIMES * ',
    desc: 'Your fastest laps and best finishes on every road.', screen: 'records' },
  { id: 'cruise', freq: 101.1, name: 'CRUISE 101.1', theme: 'race_highway', mode: 'FREE ROAM', rds: 'CRUISE 101.1 * ALL NIGHT * ALL ROADS * ',
    desc: 'No clock, no rivals. Pick a car and drive the whole map: every road in town, joined up by the tunnels.', screen: 'showroom' },
  { id: 'talk', freq: 104.5, name: 'TALK 104.5', theme: 'talk', mode: 'OPTIONS', rds: 'TALK 104.5 * LATE NIGHT CALL-IN * ',
    desc: 'Sound, picture, controls, units, gearbox and driving assists.', screen: 'options' },
];
const F_MIN = 87.5, F_MAX = 108.0;

registerScreen('radio', () => {
  let S = null;            // scene parts
  let freq = 88.1;
  let target = null;       // seeking toward a station frequency
  let t = 0;
  let intro = 0;
  let introOn = false;
  let selected = null;     // station we're locked on
  let lastStation = null;
  let launch = null;       // {t, station}
  let lightState = 'red';
  let lightT = 0;
  let rival = null;
  let rivalEngine = null;
  let ownEngine = null;
  let phoneT = -10;
  let cross = [];
  let crossT = 2;
  let wipeT = 1.5;
  let lastKnob = 0;
  let records = [];

  const nearest = (f) => {
    let best = null, bd = Infinity;
    for (const s of STATIONS) { const d = Math.abs(s.freq - f); if (d < bd) { bd = d; best = s; } }
    return { s: best, d: bd };
  };

  function seek(dir) {
    const cur = target ?? freq;
    const list = STATIONS.map((s) => s.freq).sort((a, b) => a - b);
    let next = dir > 0 ? list.find((f) => f > cur + 0.05) : [...list].reverse().find((f) => f < cur - 0.05);
    if (next === undefined) next = dir > 0 ? list[0] : list[list.length - 1];
    target = next;
    try { sfx.knob(); } catch { /* */ }
  }

  function stationEvent(st) {
    if (st.id === 'quick') summonRival();
    if (st.id === 'story') { phoneT = t; try { sfx.phone(); } catch { /* */ } }
  }

  function summonRival() {
    if (rival) return;
    const pool = CARS.filter((c) => c.cls !== 'D');
    const spec = pool[Math.floor(Math.random() * pool.length)];
    const m = buildCarModel(spec, {}, { interior: true });
    m.group.position.set(-3.6, 0, -45);
    m.setLights(1, 1, 0);
    S.scene.add(m.group);
    rival = { m, spec, z: -45, v: 16, state: 'arrive', revT: 0 };
    try {
      rivalEngine = new EngineSound(engineProfile(spec), { player: false });
      rivalEngine.setSpatial({ gain: 0.2, pan: -0.6, doppler: 1 });
    } catch { /* */ }
  }

  function spawnCross() {
    const pool = CARS;
    const spec = pool[Math.floor(Math.random() * pool.length)];
    const m = buildCarModel(spec, { paint: ['#1d2a44', '#5a1a1a', '#c9c9c4', '#222', '#3b5b3a'][Math.floor(Math.random() * 5)] }, { interior: false, shadow: true });
    const dir = Math.random() < 0.5 ? 1 : -1;
    m.group.position.set(-dir * 140 + 2, 0, dir > 0 ? 22 : 28.5);
    m.group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    m.setLights(1, 1, 0);
    S.scene.add(m.group);
    cross.push({ m, dir, x: -dir * 140 + 2, v: 14 + Math.random() * 10 });
  }

  function select(st) {
    if (launch) return;
    launch = { t: 0, st };
    lightState = 'green';
    try { sfx.ui('select'); ownEngine?.update(0.016, { rpm: 5200, throttle: 1, load: 1, gear: 1 }); } catch { /* */ }
  }

  const scr = {
    async enter(p = {}) {
      S = buildRadioScene(game.renderer.gl);
      S.street.position.x = 2;
      game.renderer.setPost({ exposure: 1.2, bloomStrength: 1.1, bloomThreshold: 0.85, saturation: 1.1, contrast: 1.05, vignette: 0.7, lift: [0, 0.006, 0.02] }, true);
      introOn = !!p.intro;
      intro = introOn ? 0 : 10;
      const st = STATIONS.find((s) => s.id === p.station) || STATIONS[0];
      freq = st.freq;
      selected = null;
      lastStation = null;
      records = loadRecords();
      try {
        const lastCar = store.load('lastCar') || 'lancet';
        ownEngine = new EngineSound(engineProfile(CAR_BY_ID[lastCar] || CAR_BY_ID.lancet), { player: true });
        sfx.ambience('city');
        sfx.rain(0.6);
      } catch { /* */ }
      for (let k = 0; k < 2; k++) spawnCross();
      cross.forEach((c, k) => { c.x += c.dir * (60 + k * 50); });
      if (p.resume === 'setup') select(STATIONS[0]);
    },
    exit() {
      try { sfx.radioStatic(0); sfx.rain(0); sfx.ambience(null); ownEngine?.stop(); rivalEngine?.stop(); } catch { /* */ }
      disposeTree(S?.scene);
      S = null;
    },
    update(dt, busy) {
      if (!S) return;
      t += dt;
      intro += dt;

      // ---- tuning input
      if (!launch && !busy && intro > 2.2) {
        if (input.pressed('left')) seek(-1);
        if (input.pressed('right')) seek(1);
        const ax = Math.abs(input.axes[0]) > 0.2 && !input.btn[14] && !input.btn[15] ? input.axes[0] : 0;
        if (ax) { target = null; freq = clamp(freq + ax * dt * 3.2, F_MIN, F_MAX); }
        if (input.mouse.wheel) { target = null; freq = clamp(freq + input.mouse.wheel * 0.1, F_MIN, F_MAX); input.mouse.wheel = 0; }
        for (let k = 0; k < STATIONS.length; k++) if (input.keys.has(`Digit${k + 1}`)) target = STATIONS[k].freq;
        if (input.takeClick() && hit.hover?.startsWith('st:')) {
          const st = STATIONS[parseInt(hit.hover.slice(3), 10)];
          if (selected === st) select(st); else target = st.freq;
        }
        const n = nearest(freq);
        if (input.pressed('confirm') && n.d < 0.12) select(n.s);
      }
      if (target !== null) {
        const d = target - freq;
        const step = Math.sign(d) * Math.min(Math.abs(d), dt * (2.5 + Math.abs(d) * 3));
        freq += step;
        if (Math.abs(target - freq) < 0.002) { freq = target; target = null; }
      }
      if (Math.floor(freq * 5) !== lastKnob) { lastKnob = Math.floor(freq * 5); S.interior.knobs[1].rotation.y = freq * 2; }

      // ---- station lock, music, static
      const n = nearest(freq);
      const lock = clamp(1 - (n.d - 0.04) / 0.35, 0, 1);
      selected = lock > 0.85 ? n.s : null;
      try {
        if (lock > 0.05 && music.theme !== n.s.theme) music.play(n.s.theme, { fade: 0.25, intensity: 0.6 });
        music.setTuning(1 - lock);
        const introMute = clamp(1 - (intro - 1.0), 0, 1);
        sfx.radioStatic(launch ? 0 : clamp((1 - lock) * 0.9 + 0.04, 0, 1) * (1 - introMute));
        music.update?.();
      } catch { /* */ }
      if (selected && selected !== lastStation) { lastStation = selected; stationEvent(selected); }
      if (!selected) lastStation = null;

      // ---- head unit display + preset lights
      const shownFreq = freq.toFixed(1);
      S.interior.display.draw({
        band: 'FM', freq: intro < 1.6 ? '--.-' : shownFreq,
        rds: intro < 1.6 ? 'MIDNIGHT FREQUENCY' : selected ? selected.rds : 'SEARCHING...',
        signal: lock, t, preset: selected ? STATIONS.indexOf(selected) + 1 : 0,
      });
      S.interior.presets.forEach((b, k) => { b.material.emissiveIntensity = selected && STATIONS.indexOf(selected) === k ? 2.5 : 0.5; });

      // ---- traffic light + cross traffic
      lightT += dt;
      S.bulbs.forEach((b, k) => {
        const on = (lightState === 'red' && k === 0) || (lightState === 'green' && k === 2);
        b.m.color.copy(b.col).multiplyScalar(on ? 3.5 : 0.08);
      });
      S.sigGlow.material.color.set(lightState === 'red' ? 0xff2a1a : 0x2aff8a);
      crossT -= dt;
      if (crossT <= 0 && lightState === 'red') { spawnCross(); crossT = 4 + Math.random() * 6; }
      for (const c of cross) {
        c.x += c.dir * c.v * dt;
        c.m.group.position.x = c.x;
        c.m.animate(dt, c.v, 0);
      }
      cross = cross.filter((c) => {
        if (Math.abs(c.x) > 150) { S.scene.remove(c.m.group); c.m.dispose(); return false; }
        return true;
      });

      // ---- rival arrival + revs
      if (rival) {
        const R = rival;
        if (R.state === 'arrive') {
          const stopZ = 3.2;
          const dist = stopZ - R.z;
          R.v = Math.min(R.v, Math.sqrt(Math.max(0, 2 * 5 * dist)));
          R.z += R.v * dt;
          if (dist < 0.05) { R.state = 'idle'; R.v = 0; }
          R.m.setLights(1, 1, R.v < 6 ? 1 : 0);
        } else if (R.state === 'idle') {
          R.revT -= dt;
          R.m.setLights(1, 1, 1);
        } else if (R.state === 'go') {
          R.v += dt * 9;
          R.z += R.v * dt;
          R.m.setLights(1, 1, 0);
          if (R.z > 300) { S.scene.remove(R.m.group); R.m.dispose(); rival = null; try { rivalEngine?.stop(); } catch { /* */ } rivalEngine = null; }
        }
        if (rival) {
          R.m.group.position.z = R.z;
          R.m.animate(dt, R.v, 0, R.state === 'idle' ? Math.sin(t * 30) * 0.004 : 0);
          try {
            const rev = R.state === 'idle' ? (Math.sin(t * 1.7) > 0.6 ? 0.9 : 0.05) : R.state === 'go' ? 1 : 0.2;
            const rpm = R.state === 'idle' ? 900 + rev * 5200 : 2000 + R.v * 150;
            rivalEngine?.update(dt, { rpm, throttle: rev, load: rev > 0.5 ? 1 : -0.3, gear: R.state === 'go' ? 2 : 0 });
            const dz = R.z - EYE.z;
            rivalEngine?.setSpatial({ gain: clamp(1 - Math.abs(dz) / 80, 0, 1) * 0.8, pan: -0.7, doppler: 1 });
          } catch { /* */ }
        }
      }

      // ---- our car: idle shake, engine, launch lurch
      const idleShake = Math.sin(t * 23) * 0.0012 + Math.sin(t * 17.3) * 0.0008;
      let surge = 0;
      if (launch) {
        launch.t += dt;
        surge = Math.min(1, launch.t / 1.4);
        if (rival && rival.state !== 'go' && launch.t > 0.3) rival.state = 'go';
        if (launch.t > 1.15 && !launch.went) {
          launch.went = true;
          const st = launch.st;
          go(st.screen, { from: 'radio', station: st.id });
        }
      }
      S.car.position.y = idleShake;
      S.camera.position.set(EYE.x, EYE.y + idleShake * 1.5, EYE.z);
      S.camera.quaternion.copy(S.baseQuat);
      if (launch) {
        // squat + forward lurch: move the whole street toward us
        const k = surge * surge;
        S.street.position.z = -k * 14;
        for (const pm of S.parked) pm.group.position.z = pm.group.userData.z0 ?? (pm.group.userData.z0 = pm.group.position.z);
        S.camera.rotateX(-0.03 * Math.sin(Math.min(1, launch.t * 3) * Math.PI));
      }
      try {
        const rpm = launch ? 1500 + Math.min(1, launch.t * 2) * 5000 : 860 + Math.sin(t * 2.3) * 25;
        ownEngine?.update(dt, { rpm, throttle: launch ? 1 : 0.02, load: launch ? 1 : 0, gear: launch ? 1 : 0 });
      } catch { /* */ }

      // ---- gauges, wipers, air freshener, phone
      S.interior.tach.draw(launch ? 1.5 + Math.min(1, launch.t * 2) * 4.5 : 0.85 + Math.sin(t * 2.3) * 0.03);
      if (launch) S.interior.speedo.draw(launch.t * 18);
      wipeT -= dt;
      if (wipeT <= 0) { wipeT = 5 + Math.random() * 3; S.shield.mat.uniforms.wipe.value = S.shield.mat.uniforms.time.value + 0.6; S._wipe = 0; }
      if (S._wipe !== undefined) {
        S._wipe += dt;
        const k = S._wipe / 1.2;
        const ang = k < 1 ? Math.sin(k * Math.PI) * 1.45 : 0;
        S.shield.blades.forEach((b) => { b.rotation.z = ang; });
        if (k >= 1) S._wipe = undefined;
      }
      S.shield.mat.uniforms.time.value += dt;
      S.interior.fresh.rotation.z = Math.sin(t * 1.3) * 0.08 + (launch ? -surge * 0.4 : 0);
      S.interior.fresh.rotation.x = Math.sin(t * 0.9) * 0.05 + (launch ? -surge * 0.3 : 0);
      const ph = t - phoneT;
      drawPhone(S.interior.pscreenC, ph < 8 && ph > 0 ? ph : -1);
      S.interior.pscreen.material.map.needsUpdate = true;
      S.interior.phone.position.y = 0.52 + (ph > 0 && ph < 2.5 ? Math.sin(ph * 80) * 0.002 : 0);
    },
    view() { return S ? { scene: S.scene, camera: S.camera } : null; },
    draw(ctx) {
      if (!S) return;
      const a = clamp((intro - 0.3) / 1.2, 0, 1);
      // fade in from black
      if (intro < 1.2) { ctx.fillStyle = `rgba(0,0,0,${1 - intro / 1.2})`; ctx.fillRect(0, 0, 1024, 768); }
      // title card during the intro
      if (introOn && intro < 4.2) {
        const k = clamp((intro - 0.6) / 0.6, 0, 1) * clamp((4.2 - intro) / 0.6, 0, 1);
        drawLogo(ctx, 512, 300, 1.25, k);
        return;
      }
      ctx.save();
      ctx.globalAlpha = a;
      drawLogo(ctx, 150, 64, 0.42, 1);
      const n = nearest(freq);
      const lock = clamp(1 - (n.d - 0.04) / 0.35, 0, 1);
      // station dial strip along the top
      drawDial(ctx, freq);
      // station card
      const st = selected;
      panel(ctx, 34, 440, 470, 230, { accent: lock > 0.5 ? C.cyan : C.faint, accentLen: 200, alpha: 0.95 });
      if (st) {
        text(ctx, st.name, 64, 476, { size: 15, color: C.cyan, weight: 800, spacing: 3 });
        vText(ctx, st.mode, 62, 532, 46, { color: '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.6)', shadow: [3, 3, 'rgba(0,0,0,0.5)'] });
        paragraph(ctx, st.id === 'story' ? storyDesc(st) : st.desc, 64, 568, 410, { size: 15, color: '#c8d0dc', weight: 500, lineHeight: 20 });
        if (st.id === 'records') drawRecordsTeaser(ctx, records);
        const pulse = 0.6 + 0.4 * Math.sin(t * 5);
        ctx.globalAlpha = a * pulse;
        drawPress(ctx, 64, 648, 'confirm', st.id === 'quick' ? 'HIT THE GAS' : st.id === 'story' ? 'ANSWER THE CALL' : 'TUNE IN');
        ctx.globalAlpha = a;
      } else {
        text(ctx, 'FM ' + freq.toFixed(1), 64, 476, { size: 15, color: C.dim, weight: 800, spacing: 3 });
        vText(ctx, 'SEARCHING', 62, 532, 40, { color: '#8a93a6', alpha: 0.6 + 0.4 * Math.sin(t * 9) });
        text(ctx, 'Nothing but static between the stations.', 64, 568, { size: 15, color: C.dim, weight: 500 });
      }
      ctx.restore();
      if (a > 0.5) hints(ctx, [['lr', 'TUNE'], ['confirm', 'SELECT']], { x: 500, y: 712 });
    },
  };
  return scr;
});

function drawPress(ctx, x, y, action, label) {
  const w = usingPad() ? padGlyph(ctx, 'cross', x + 12, y - 5, 12) : keyCap(ctx, 'ENTER', x + 24, y - 5, 20);
  text(ctx, label, x + (usingPad() ? 32 : 58), y, { size: 16, color: '#fff', weight: 800, spacing: 2 });
  void w;
}

/** The FM band strip with station markers and the needle. */
function drawDial(ctx, freq) {
  const x0 = 300, x1 = 990, y = 48;
  const X = (f) => x0 + (f - F_MIN) / (F_MAX - F_MIN) * (x1 - x0);
  ctx.save();
  ctx.fillStyle = 'rgba(2,6,10,0.55)';
  ctx.fillRect(x0 - 14, y - 26, x1 - x0 + 28, 52);
  ctx.strokeStyle = 'rgba(70,232,255,0.35)';
  ctx.lineWidth = 1;
  for (let f = 88; f <= 108; f += 0.5) {
    const big = Math.abs(f % 2) < 0.01;
    ctx.beginPath();
    ctx.moveTo(X(f), y + (big ? 2 : 8));
    ctx.lineTo(X(f), y + 14);
    ctx.stroke();
    if (big) text(ctx, String(f), X(f), y - 4, { size: 10, color: 'rgba(170,240,255,0.6)', align: 'center', weight: 700, shadow: false });
  }
  STATIONS.forEach((s, k) => {
    const sx = X(s.freq);
    hit.add(`st:${k}`, sx - 34, y - 26, 68, 52);
    const near = Math.abs(freq - s.freq) < 0.12;
    ctx.fillStyle = near ? C.cyan : 'rgba(70,232,255,0.4)';
    ctx.fillRect(sx - 2, y - 22, 4, 8);
    text(ctx, s.mode, sx, y + 24 + 4, { size: 10, color: near ? '#fff' : C.dim, align: 'center', weight: 800, spacing: 1 });
  });
  // needle
  const nx = X(freq);
  ctx.fillStyle = '#ff3a2a';
  ctx.shadowColor = '#ff3a2a';
  ctx.shadowBlur = 10;
  ctx.fillRect(nx - 1.5, y - 24, 3, 40);
  ctx.restore();
}

export function drawLogo(ctx, x, y, s = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(s, s);
  vText(ctx, 'MIDNIGHT', 0, 0, 64, { align: 'center', gradient: [[0, '#ffffff'], [0.5, '#c9d4e8'], [0.52, '#7d8aa6'], [1, '#e8eef8']], outline: 4, outlineColor: 'rgba(0,0,0,0.85)', shadow: [4, 5, 'rgba(0,0,0,0.6)'], skew: -0.22, spacing: 4 });
  // waveform under the word
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const px = -230 + i * (460 / 120);
    const env = Math.sin((i / 120) * Math.PI);
    const py = 26 + Math.sin(i * 0.9) * Math.sin(i * 0.23) * 9 * env;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.strokeStyle = '#46e8ff';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#46e8ff';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;
  vText(ctx, 'FREQUENCY', 0, 72, 30, { align: 'center', color: C.accent, outline: 3, outlineColor: 'rgba(0,0,0,0.85)', spacing: 14, skew: -0.22 });
  ctx.restore();
}

function drawPhone(c, t) {
  const x = c.getContext('2d');
  x.fillStyle = t < 0 ? '#050807' : '#0b2a1e';
  x.fillRect(0, 0, 64, 96);
  if (t >= 0) {
    x.fillStyle = '#7dffb5';
    x.font = 'bold 10px monospace';
    x.fillText('1 NEW MSG', 6, 16);
    if (t > 1.2) {
      x.font = '9px monospace';
      ['u in?', 'midnite', 'docks.', '-R'].forEach((l, k) => x.fillText(l, 6, 34 + k * 13));
    } else if (Math.floor(t * 6) % 2) {
      x.fillRect(22, 40, 20, 14);
    }
  }
}

function storyDesc(st) {
  const s = store.load('story');
  if (!s || !s.cars?.length) return st.desc;
  if (s.finished) return `Port Halcyon is yours. $${Math.round(s.cash).toLocaleString()} in the bank. The crews still want rematches.`;
  return `Chapter ${s.chapter + 1} of ${CHAPTERS.length}: ${CHAPTERS[s.chapter]?.crew || ''}. $${Math.round(s.cash).toLocaleString()} in the bank, ${s.stats?.wins || 0} wins so far. Pick up where you left off.`;
}

function loadRecords() {
  const r = store.load('records') || {};
  return Object.entries(r).map(([track, rec]) => ({ track, ...rec })).sort((a, b) => (a.bestLap ?? 1e9) - (b.bestLap ?? 1e9)).slice(0, 4);
}

function drawRecordsTeaser(ctx, recs) {
  if (!recs.length) return;
  panel(ctx, 540, 470, 300, 30 + recs.length * 24, { accent: C.accent, accentLen: 80 });
  recs.forEach((r, k) => {
    text(ctx, r.trackName || r.track.toUpperCase(), 566, 500 + k * 24, { size: 13, color: '#e6ebf3', weight: 700 });
    text(ctx, fmtTime(r.bestLap), 820, 500 + k * 24, { size: 13, color: C.accent, weight: 800, align: 'right' });
  });
}
