// THE VAST — app shell and game loop. Boot → title (a live cinematic of the
// actual world) → the journey. Everything runs off one seed; the save knows
// where you stood, what time it was, and everything you'd found.

import * as THREE from 'three';
import { World, SEA_LEVEL, BIOMES } from './world.js';
import { POIField } from './poi.js';
import { Terrain, CHUNK } from './terrain.js';
import { makeFloraLib, makeScatterer } from './flora.js';
import { POIManager } from './structures.js';
import { Sky } from './sky.js';
import { Fauna } from './fauna.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Horse } from './horse.js';
import { sfx } from './audio.js';
import { Hud } from './hud.js';
import { WorldMap, revealAround } from './map.js';
import { saveGame, loadGame, clearGame } from './save.js';
import { clamp } from './noise.js';

const BUILD = 1;
const params = new URLSearchParams(location.search);
const DAY_SECONDS = params.has('fast') ? 90 : 720;
const NOSAVE = params.has('nosave');

// ---------------------------------------------------------------------------
// boot decisions: which seed, fresh or continue
const save = params.has('new') || params.has('quick') ? null : loadGame();
let seed;
if (params.has('seed')) seed = (parseInt(params.get('seed'), 10) >>> 0) || 7;
else if (save) seed = save.seed;
else seed = (Math.random() * 0xffffffff) >>> 0;

const el = (id) => document.getElementById(id);
const holder = el('vast-holder');

// ---------------------------------------------------------------------------
// renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
holder.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.3, 2600);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------------------
// the world
const world = new World(seed);
const field = new POIField(world);
const floraLib = makeFloraLib();
const terrain = new Terrain(scene, world, {
  radius: 5,
  floraRadius: 4,
  scatter: makeScatterer(world, field, floraLib),
});
const sky = new Sky(scene, seed);
const fauna = new Fauna(scene, world);
const input = new Input(renderer.domElement);
const player = new Player(scene, world, sfx);
const horse = new Horse(scene, world, sfx);
const hud = new Hud();

// persistent journey state
const state = {
  discovered: new Set(save ? save.discovered : []),
  litShrines: new Set(save ? save.litShrines : []),
  relics: new Set(save ? save.relics : []),
  rumors: new Set(save ? save.rumors : []),
  explored: new Set(save ? save.explored : []),
};
const stats = save ? { dist: 0, playTime: 0, ...save.stats } : { dist: 0, playTime: 0 };
let dayT = save ? save.dayT : 0.32;
let day = save ? save.day : 1;
if (params.has('time')) dayT = clamp(parseFloat(params.get('time')) || 0, 0, 0.999);
if (save && typeof save.muted === 'boolean') sfx.muted = save.muted;

const poiMgr = new POIManager(scene, world, field, state);
const worldMap = new WorldMap(world, field, state);

// resolve a saved poi id back to its full record ("poi_cx_cz")
function poiById(id) {
  const m = /^poi_(-?\d+)_(-?\d+)$/.exec(id);
  if (!m) return null;
  return field.poiForCell(parseInt(m[1], 10), parseInt(m[2], 10));
}
function knownPois() {
  const out = [];
  for (const id of state.discovered) {
    const p = poiById(id);
    if (p) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// spawn + title cinematic
const spawn = save ? { x: save.pos[0], z: save.pos[2] } : world.findSpawn();
player.pos.set(spawn.x, world.heightAt(spawn.x, spawn.z) + 0.5, spawn.z);
if (save) {
  player.pos.set(save.pos[0], save.pos[1] + 0.3, save.pos[2]);
  player.camYaw = save.camYaw || 0;
  player.stamina = save.stamina ?? 1;
  if (save.horse && save.horse.state !== 'away') {
    horse.state = 'grazing';
    horse.pos.set(save.horse.x, world.heightAt(save.horse.x, save.horse.z), save.horse.z);
    horse.root.visible = true;
  }
}

let mode = 'loading'; // loading | title | play | pause | map | journal | help | rest
let cinemaT = 0;
let fadeT = 0, fadeCb = null;
let regionId = null, regionCheckT = 0;
let autosaveT = 25;
let fpsEma = 60, qualityLevel = 0, qualityT = 0;
let promptCache = '';

function fade(cb) {
  fadeT = 1;
  fadeCb = cb;
  el('vast-fade').classList.add('show');
}

// ---------------------------------------------------------------------------
// title screen
function drawLogo() {
  const c = el('vast-logo');
  const g = c.getContext('2d');
  const W = (c.width = 640), H = (c.height = 170);
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const grad = g.createLinearGradient(0, 20, 0, 120);
  grad.addColorStop(0, '#fdf6e3');
  grad.addColorStop(0.55, '#e8d9a8');
  grad.addColorStop(1, '#b98d4f');
  g.fillStyle = grad;
  g.font = '600 92px Georgia, "Times New Roman", serif';
  g.save();
  g.translate(W / 2, 78);
  g.scale(1.12, 1);
  const text = 'THE VAST';
  let x = -g.measureText(text).width * 0.5 * 1.18 / 1.12;
  for (const ch of text) {
    const w = g.measureText(ch).width;
    g.fillText(ch, x + w / 2, 0);
    x += w * 1.18;
  }
  g.restore();
  g.strokeStyle = 'rgba(232,217,168,0.7)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(W * 0.14, 138); g.lineTo(W * 0.86, 138); g.stroke();
  g.fillStyle = '#cabb95';
  g.font = '15px Georgia, serif';
  g.fillText('T H E   W O R L D   D O E S   N O T   E N D  ·  G O   A N D   S E E', W / 2, 155);
}

function buildTitleMenu() {
  const menu = el('vast-menu');
  menu.innerHTML = '';
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'vast-btn';
    b.textContent = label;
    b.onclick = () => { sfx.ensure(); sfx.ui(); fn(); };
    menu.appendChild(b);
    return b;
  };
  if (save) {
    btn(`CONTINUE — DAY ${save.day}, ${state.discovered.size} PLACES FOUND`, startGame);
    btn('SET OUT ANEW — A NEW WORLD', () => {
      clearGame();
      location.href = location.pathname + '?new=1';
    });
  } else {
    btn('SET OUT', startGame);
  }
  const seedRow = document.createElement('div');
  seedRow.className = 'vast-seedrow';
  seedRow.innerHTML = `<input id="vast-seed-in" type="text" placeholder="seed…" maxlength="10" />`;
  const go = document.createElement('button');
  go.className = 'vast-btn small';
  go.textContent = 'WANDER BY SEED';
  go.onclick = () => {
    const v = parseInt(el('vast-seed-in').value, 10);
    if (!isNaN(v)) location.href = location.pathname + `?new=1&seed=${v >>> 0}`;
  };
  seedRow.appendChild(go);
  menu.appendChild(seedRow);
  el('vast-build').textContent = `THE VAST · BUILD ${BUILD} · SEED ${seed}`;
}

function startGame() {
  fade(() => {
    mode = 'play';
    el('vast-title').classList.add('hidden');
    el('vast-hud').classList.remove('hidden');
    regionId = null; // re-announce where we are
    input.requestLock();
  });
}

// ---------------------------------------------------------------------------
// events from the world
poiMgr.onDiscover = (poi) => {
  hud.showBanner('DISCOVERED', poi.name, 'discover');
  sfx.landmark();
  revealAround(state.explored, poi.x, poi.z);
};
poiMgr.onRelic = (poi) => {
  hud.showBanner('RELIC RECOVERED', `${state.relics.size} in your pack`, 'relic');
  sfx.relic();
};
poiMgr.onShrine = (poi) => {
  hud.showBanner('SHRINE AWAKENED', 'its light now marks your map — travel to it from anywhere', 'shrine');
  sfx.shrine();
  doSave();
};
poiMgr.onRest = () => {
  mode = 'rest';
  fade(() => {
    if (dayT >= 0.27) day++;
    dayT = 0.268;
    player.stamina = 1;
    hud.toast('You rest until dawn.');
    sfx.rest();
    doSave();
    mode = 'play';
  });
};
poiMgr.onSurvey = (poi, found) => {
  if (found.length) {
    hud.showBanner('THE LAND OPENS UP', `${found.length} rumor${found.length > 1 ? 's' : ''} marked on your map`, 'survey');
    for (const q of found) revealAround(state.explored, q.x, q.z);
  } else {
    hud.showBanner('NOTHING NEW', 'you have found all there is to find near here', 'survey');
  }
  sfx.survey();
};
worldMap.onTravel = (poi) => {
  worldMap.hide();
  mode = 'play';
  fade(() => {
    player.teleport(poi.x + 4, poi.z + 4);
    if (player.riding) doDismount();
    hud.toast(`You arrive at ${poi.name}.`);
    doSave();
  });
};
player.onStep = (surface) => sfx.step(surface);
player.onSplash = () => sfx.splash();
player.onLand = () => sfx.step('rock');
horse.onHoof = (i) => sfx.hoof(i);
sky.onThunder = (delay) => sfx.thunder(delay);

// ---------------------------------------------------------------------------
// riding
function doMount() {
  horse.mount();
  player.riding = horse;
  horse.saddle.add(player.root);
  player.root.position.set(0, 0.1, 0);
  player.root.rotation.y = Math.PI / 2;
  hud.toast('E to dismount');
}
function doDismount() {
  horse.dismount();
  player.riding = null;
  scene.add(player.root);
  const side = horse.heading + Math.PI / 2;
  player.pos.set(
    horse.pos.x + Math.sin(side) * 1.4,
    horse.pos.y + 0.4,
    horse.pos.z + Math.cos(side) * 1.4
  );
  player.vel.set(0, 0, 0);
  player.root.rotation.set(0, player.heading, 0);
  player.torso.rotation.x = 0;
}

// ---------------------------------------------------------------------------
// save
function doSave() {
  if (NOSAVE) return;
  saveGame({
    seed,
    pos: player.riding ? horse.pos : player.pos,
    camYaw: player.camYaw,
    dayT, day,
    stamina: player.stamina,
    discovered: state.discovered,
    litShrines: state.litShrines,
    relics: state.relics,
    rumors: state.rumors,
    explored: state.explored,
    stats,
    horse: { state: horse.state === 'away' ? 'away' : 'grazing', x: horse.pos.x, z: horse.pos.z },
    muted: sfx.muted,
  });
}
addEventListener('beforeunload', () => { if (mode !== 'title' && mode !== 'loading') doSave(); });

// ---------------------------------------------------------------------------
// overlay toggles
function closeOverlays() {
  el('vast-journal').classList.remove('show');
  el('vast-help').classList.remove('show');
  el('vast-pause').classList.remove('show');
  worldMap.hide();
}
function toggleOverlay(which) {
  if (mode === which) {
    closeOverlays();
    mode = 'play';
    return;
  }
  closeOverlays();
  mode = which;
  if (which === 'map') worldMap.show(anchor().x, anchor().z);
  if (which === 'journal') {
    hud.renderJournal({ state, stats, seed, day, knownPois: knownPois() });
    el('vast-journal').classList.add('show');
  }
  if (which === 'help') el('vast-help').classList.add('show');
  if (which === 'pause') {
    el('vast-pause').classList.add('show');
    input.releaseLock();
    doSave();
  }
}
el('vast-resume').onclick = () => { sfx.ui(); toggleOverlay('pause'); input.requestLock(); };
el('vast-quit').onclick = () => { doSave(); location.href = location.pathname; };

renderer.domElement.addEventListener('click', () => {
  sfx.ensure();
  if (mode === 'play') input.requestLock();
});

const anchor = () => (player.riding ? horse.pos : player.pos);

// ---------------------------------------------------------------------------
// quality autoscaling
const QUALITY = [
  { radius: 5, flora: 4, pr: 2, shadows: true },
  { radius: 4, flora: 4, pr: 1.5, shadows: true },
  { radius: 4, flora: 3, pr: 1, shadows: false },
  { radius: 3, flora: 2, pr: 1, shadows: false },
];
function applyQuality(q) {
  const Q = QUALITY[q];
  terrain.setRadius(Q.radius);
  terrain.floraRadius = Q.flora;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pr));
  renderer.shadowMap.enabled = Q.shadows;
  sky.sun.castShadow = Q.shadows;
}

// ---------------------------------------------------------------------------
// QA hooks
window.__VAST = {
  get pos() { const a = anchor(); return { x: +a.x.toFixed(1), y: +a.y.toFixed(1), z: +a.z.toFixed(1) }; },
  get seed() { return seed; },
  get mode() { return mode; },
  get fps() { return Math.round(fpsEma); },
  get chunks() { return terrain.chunkCount(); },
  get biome() { return world.biomeAt(anchor().x, anchor().z); },
  biomeAt(x, z) { return world.biomeAt(x, z); },
  get discovered() { return state.discovered.size; },
  teleport(x, z) { player.teleport(x, z); },
  setTime(t) { dayT = clamp(t, 0, 0.999); },
  look(yaw, pitch) { player.camYaw = yaw; if (pitch !== undefined) player.camPitch = pitch; },
  get horse() { return { state: horse.state, d: Math.round(horse.distTo(player.pos.x, player.pos.z)) }; },
  get weather() { return { state: sky.weather.state, clouds: +sky.weather.cloudiness.toFixed(2), rain: +sky.weather.rainLevel.toFixed(2) }; },
  start() { if (mode === 'title') startGame(); },
  pois(r = 1500) {
    const a2 = anchor();
    return field.poisNear(a2.x, a2.z, r)
      .map((p) => ({ id: p.id, type: p.type, name: p.name, x: Math.round(p.x), z: Math.round(p.z), d: Math.round(Math.hypot(p.x - a2.x, p.z - a2.z)) }))
      .sort((m, n) => m.d - n.d);
  },
  storm() {
    sky.weather.state = 'storm';
    sky.weather.targetClouds = 1;
    sky.weather.targetRain = 1;
    sky.weather.timer = 120;
  },
};

// ---------------------------------------------------------------------------
// the loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsEma += ((1000 / Math.max(1, now - (frame._p || now - 16))) - fpsEma) * 0.05;
  frame._p = now;

  const inp = input.poll();
  const a = anchor();

  // fade curtain
  if (fadeT > 0) {
    fadeT -= dt * 1.8;
    if (fadeT <= 0.5 && fadeCb) { fadeCb(); fadeCb = null; }
    if (fadeT <= 0) el('vast-fade').classList.remove('show');
    el('vast-fade').style.opacity = Math.sin(Math.min(1, Math.max(0, fadeT)) * Math.PI);
  }

  if (mode === 'title' || mode === 'loading') {
    // slow cinematic orbit of the spawn point
    cinemaT += dt * 0.05;
    const cr = 34, ch = 14;
    const sx = spawn.x, sz = spawn.z;
    camera.position.set(sx + Math.cos(cinemaT) * cr, world.heightAt(sx, sz) + ch, sz + Math.sin(cinemaT) * cr);
    const lookY = world.heightAt(sx + Math.cos(cinemaT + 1.2) * 20, sz + Math.sin(cinemaT + 1.2) * 20);
    camera.lookAt(sx + Math.cos(cinemaT + 1.2) * 20, lookY + 6, sz + Math.sin(cinemaT + 1.2) * 20);
    terrain.update(sx, sz, 8);
    sky.update(dt, 0.42, camera.position.x, camera.position.y, camera.position.z);
    fauna.update(dt, sx, sz, false, camera.position.y);
    poiMgr.update(sx, sz, dt, false);
    renderer.render(scene, camera);
    return;
  }

  // ---- global toggles ----
  if (inp.mute) { sfx.setMuted(!sfx.muted); hud.toast(sfx.muted ? 'sound off' : 'sound on'); }
  if (inp.map) { sfx.ensure(); toggleOverlay('map'); }
  if (inp.journal) { sfx.ensure(); toggleOverlay('journal'); }
  if (inp.help) toggleOverlay('help');
  if (inp.pause) {
    if (mode === 'play') toggleOverlay('pause');
    else if (mode !== 'rest') { closeOverlays(); mode = 'play'; }
  }

  const frozen = mode !== 'play';

  // ---- time ----
  if (!frozen || mode === 'map' || mode === 'journal') {
    const prev = dayT;
    dayT += dt / DAY_SECONDS;
    if (dayT >= 1) { dayT -= 1; day++; hud.toast(`Day ${day}`); }
  }

  // ---- actions ----
  if (!frozen) {
    if (inp.whistle) {
      sfx.ensure();
      if (horse.whistle(a.x, a.z, player.camYaw)) {
        sfx.whistle();
        hud.toast(horse.state === 'coming' ? 'Your horse is coming.' : '');
      }
    }
    if (inp.interact) {
      if (player.riding) doDismount();
      else if (horse.distTo(a.x, a.z) < 4.4 && horse.state !== 'coming') doMount();
      else poiMgr.interact();
    }
  }

  // ---- world sim ----
  player.update(dt, inp, frozen);
  horse.update(dt, frozen ? { moveX: 0, moveZ: 0, sprint: false } : inp, player.camYaw, a.x, a.z);
  if (player.riding) {
    player.pos.copy(horse.pos);
    // deep water throws the rider
    if (world.heightAt(horse.pos.x, horse.pos.z) < SEA_LEVEL - 1.2) doDismount();
  }
  terrain.update(a.x, a.z, 6);
  poiMgr.update(a.x, a.z, dt, sky.isNight);
  fauna.update(dt, a.x, a.z, sky.isNight, camera.position.y);
  sky.update(dt, dayT, a.x, a.y, a.z);
  player.applyCamera(camera, dt);

  // underwater treatment
  const under = camera.position.y < SEA_LEVEL - 0.1 &&
    world.heightAt(camera.position.x, camera.position.z) < SEA_LEVEL;
  sky.setUnderwater(under);
  sfx.setUnderwater(player.swimming);
  el('vast-vignette').classList.toggle('show', under || player.swimming);

  // shadow map follows
  // (sun position already tracks the anchor inside sky.update)

  // ---- discovery of regions ----
  regionCheckT -= dt;
  if (regionCheckT <= 0) {
    regionCheckT = 1.5;
    const rg = field.regionAt(a.x, a.z);
    if (rg.id !== regionId) {
      regionId = rg.id;
      hud.showBanner(rg.name.toUpperCase(), (BIOMES[rg.biome] && BIOMES[rg.biome].label) || '', 'region');
      sfx.discover();
    }
    revealAround(state.explored, a.x, a.z);
  }

  // ---- audio beds ----
  const alt = Math.max(0, a.y);
  sfx.update(dt, {
    wind: clamp(alt / 90, 0, 0.5) + clamp(Math.hypot(player.vel.x, player.vel.z) / 26, 0, 0.3) + sky.weather.rainLevel * 0.25,
    rain: sky.weather.rainLevel,
    night: sky.isNight ? 1 : 0,
  });

  // ---- stats + autosave ----
  stats.playTime += dt;
  const hv = player.riding ? horse.speed : Math.hypot(player.vel.x, player.vel.z);
  stats.dist += hv * dt;
  autosaveT -= dt;
  if (autosaveT <= 0) { autosaveT = 25; doSave(); }

  // ---- quality scaling ----
  qualityT += dt;
  if (qualityT > 3) {
    qualityT = 0;
    if (fpsEma < 42 && qualityLevel < QUALITY.length - 1) applyQuality(++qualityLevel);
    else if (fpsEma > 57 && qualityLevel > 0) applyQuality(--qualityLevel);
  }

  // ---- HUD ----
  hud.update(dt);
  if (mode === 'play' || mode === 'map' || mode === 'journal') {
    // compass markers: lit shrines, rumors, the horse
    const markers = [];
    for (const id of state.litShrines) {
      const p = poiById(id);
      if (p && Math.hypot(p.x - a.x, p.z - a.z) < 900) {
        markers.push({ angle: Math.atan2(p.x - a.x, p.z - a.z), color: '#ffd766', glyph: '✦' });
      }
    }
    for (const id of state.rumors) {
      const p = poiById(id);
      if (p && Math.hypot(p.x - a.x, p.z - a.z) < 1400) {
        markers.push({ angle: Math.atan2(p.x - a.x, p.z - a.z), color: 'rgba(240,230,200,0.85)', glyph: '?' });
      }
    }
    if (horse.state !== 'away' && !player.riding && horse.distTo(a.x, a.z) > 25) {
      markers.push({ angle: Math.atan2(horse.pos.x - a.x, horse.pos.z - a.z), color: '#d8b48a', glyph: '⨀' });
    }
    hud.drawCompass(player.camYaw, markers);
    hud.drawDial(dayT, day);
    hud.updateMinimap(dt, world, a.x, a.z, player.camYaw, field.poisNear(a.x, a.z, 260), state);
    hud.setStamina(player.stamina);

    // interaction prompt
    let prompt = null;
    if (player.riding) prompt = 'E — dismount';
    else if (horse.state === 'grazing' && horse.distTo(a.x, a.z) < 4.4) prompt = 'E — mount up';
    else if (poiMgr.prompt) prompt = `E — ${poiMgr.prompt.label}`;
    else if (player.swimming && player.stamina < 0.3) prompt = 'find the shore — you are tiring';
    if (prompt !== promptCache) { hud.setPrompt(prompt); promptCache = prompt; }
  }

  worldMap.update();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// boot
drawLogo();
buildTitleMenu();
el('vast-loading').querySelector('.load-sub').textContent = `seed ${seed}`;

// heavy lifting behind the loading veil, split across two frames for paint
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    terrain.pregenerate(spawn.x, spawn.z, 2);
    revealAround(state.explored, spawn.x, spawn.z);
    el('vast-loading').classList.add('hidden');
    if (params.has('quick')) {
      mode = 'title';
      el('vast-title').classList.remove('hidden');
      startGame();
    } else {
      mode = 'title';
      el('vast-title').classList.remove('hidden');
    }
    requestAnimationFrame(frame);
  });
});
