// HARD COUNT venues. buildVenue() assembles a whole match setting: the painted
// field, the stadium (per-venue builders in ./venues), floodlights, sky, the
// crowd, the sidelines, the scoreboard and the weather, lit for the time of
// day, plus the CRT post grade to show it with.
//
//   const v = await buildVenue(renderer, { venue, field, home, away, time, weather, wind, crowd, quality });
//   scene.add(players…) → v.scene;  renderer.setPost(v.post);
//   v.update(dt, { camera, time, excitement, reaction, homeHasBall, ball });
//   v.setScoreboard({...}); v.setMarkers({ los, firstDown, dir, show }); v.focusShadow(x, z, r); v.flashes(rate); v.dispose();
import * as THREE from 'three';
import { getEnvMap } from '../../core/envmap.js';
import { disposeTree, makeRng } from '../../core/util.js';
import { makeField } from '../../sim/field.js';
import { TEAMS } from '../../data/teams.js';
import { atmosphere, skyDome } from './sky.js';
import { buildField } from './field.js';
import { Batches } from './kit.js';
import { LightRig } from './lights.js';
import { buildCrowd, buildFlashes } from './crowd.js';
import { buildSideline } from './sideline.js';
import { glowTex } from './tex.js';
import { createWeather } from '../fx/weather.js';
import * as friday from './venues/friday.js';
import * as college from './venues/college.js';
import * as bayside from './venues/bayside.js';
import * as dome from './venues/dome.js';
import * as foundry from './venues/foundry.js';
import * as snowbowl from './venues/snowbowl.js';
import * as park from './venues/park.js';

export const VENUES = [
  { id: 'friday', name: 'Hollis Field', city: 'Millbrook', kind: 'highschool', capacity: 4200, roof: 'open', surface: 'grass', defaultTime: 'night', defaultWeather: 'clear' },
  { id: 'college', name: 'Memorial Bowl', city: 'Riverton', kind: 'college', capacity: 92000, roof: 'open', surface: 'grass', defaultTime: 'day', defaultWeather: 'clear' },
  { id: 'bayside', name: 'Bayside Stadium', city: 'Port Halcyon', kind: 'pro', capacity: 68500, roof: 'open', surface: 'grass', defaultTime: 'night', defaultWeather: 'clear' },
  { id: 'dome', name: 'Gulf Coast Dome', city: 'Houston', kind: 'pro', capacity: 71000, roof: 'dome', surface: 'turf', defaultTime: 'night', defaultWeather: 'clear' },
  { id: 'foundry', name: 'The Foundry', city: 'Detroit', kind: 'pro', capacity: 64500, roof: 'open', surface: 'turf', defaultTime: 'dusk', defaultWeather: 'overcast' },
  { id: 'snowbowl', name: 'Summit Field', city: 'Salt Lake', kind: 'pro', capacity: 61000, roof: 'open', surface: 'grass', defaultTime: 'day', defaultWeather: 'snow' },
  { id: 'park', name: 'Eastside Park', city: 'Port Halcyon', kind: 'park', capacity: 350, roof: 'open', surface: 'grass', defaultTime: 'night', defaultWeather: 'clear' },
];
const BUILDERS = { friday, college, bayside, dome, foundry, snowbowl, park };

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function buildVenue(renderer, opts = {}) {
  const def = VENUES.find((v) => v.id === opts.venue) || VENUES[0];
  const mod = BUILDERS[def.id];
  const field = opts.field || makeField('sevens');
  const home = opts.home || TEAMS[0];
  const away = opts.away || TEAMS.find((t) => t.id !== home.id) || TEAMS[1];
  const quality = opts.quality === 'low' ? 'low' : 'high';
  const time = ['day', 'dusk', 'night'].includes(opts.time) ? opts.time : def.defaultTime;
  const weather = def.roof === 'dome' ? 'clear' : (['clear', 'overcast', 'rain', 'snow', 'fog'].includes(opts.weather) ? opts.weather : def.defaultWeather);
  const wind = def.roof === 'dome' ? 0 : Math.max(0, Math.min(1, opts.wind ?? 0.3));
  const crowd = Math.max(0, Math.min(1, opts.crowd ?? 0.85));
  const A = atmosphere(time, weather, { roof: def.roof, sunAz: mod.SUN_AZ, cold: mod.COLD });
  if (A.night && mod.KEY_NIGHT) Object.assign(A.key, mod.KEY_NIGHT);

  const scene = new THREE.Scene();
  scene.name = `venue:${def.id}`;
  scene.background = new THREE.Color(A.fog[0]);
  scene.fog = new THREE.FogExp2(A.fog[0], A.fog[1] * (A.weather === 'clear' ? (mod.FOG ?? 1) : 1));
  scene.environment = getEnvMap(renderer, A.env);
  const root = new THREE.Group();
  root.name = 'venue';
  scene.add(root);

  // ---- light: one shadow-casting key, hemisphere fill, environment
  const hemi = new THREE.HemisphereLight(A.hemi[0], A.hemi[1], A.hemi[2]);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(A.key.color, A.key.i);
  key.name = 'key';
  key.castShadow = true;
  const sm = quality === 'low' ? 1024 : 2048;
  key.shadow.mapSize.set(sm, sm);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = A.night || A.dome ? 3.5 : 2;
  scene.add(key);
  scene.add(key.target);
  if (A.fill) {
    const fill = new THREE.DirectionalLight(A.fill.color, A.fill.i);
    fill.name = 'floodFill';
    fill.position.copy(A.fill.dir).multiplyScalar(100);
    scene.add(fill);
  }

  const ctx = {
    renderer, def, field, home, away, quality, time, weather: A.weather, wind, crowd, atmos: A,
    night: A.night, dusk: A.dusk, day: A.day, wet: !!A.wet, cold: !!A.cold || !!mod.COLD,
    windDir: mod.WIND_DIR ?? 0.6,
    rng: makeRng('venue' + def.id),
    aniso: Math.min(16, renderer.capabilities.getMaxAnisotropy?.() || 8),
    uSpill: { value: A.spill },
    uPool: { value: new THREE.Vector4(...(mod.POOL || [field.halfW + 42, field.end + 38]), A.night ? 1 : 0, 0.3) },
    lightsList: [],
    scene, root,
  };
  ctx.B = new Batches(ctx);
  ctx.rig = new LightRig(ctx);
  ctx.paint = { seed: def.id, ...mod.paint(ctx) };

  // ---- field
  const F = buildField({
    field, quality, aniso: ctx.aniso, paint: ctx.paint, weather: A.weather, wind, windDir: ctx.windDir,
    padColor: home.colors.primary, flagColor: mod.FLAG_COLOR, uPool: ctx.uPool, apron: mod.APRON ?? 160, apronRect: mod.apronRect?.(field), apronCanvas: mod.apronCanvas?.(ctx),
  });
  root.add(F.group);
  await tick();

  // ---- the venue itself (stands, structures, surroundings, boards, light banks)
  const V = (await mod.build(ctx)) || {};
  await tick();
  const sideline = buildSideline(ctx, ctx.B, V.sideline || {});
  root.add(sideline.group);
  const meshes = ctx.B.flush(root);
  void meshes;
  await tick();

  // ---- floodlights, point glows, sky
  for (const p of ctx.lightsList) ctx.rig.point(p);
  const lights = ctx.rig.build(root);
  const sky = A.dome ? null : skyDome(A, ctx.rig.skyBanks());
  if (sky) scene.add(sky);

  // ---- crowd + flashes
  let crowdObj = null, flashes = null;
  const seats = V.seats || [];
  if (seats.length && crowd > 0.001) {
    crowdObj = buildCrowd(seats, { home, away, crowd, quality, cold: ctx.cold, wet: ctx.wet, atmos: A, venueId: def.id });
    root.add(crowdObj.mesh);
    flashes = buildFlashes(crowdObj.flashSpots, glowTex());
    root.add(flashes.mesh);
  }
  await tick();

  // ---- weather
  const wx = createWeather(scene, {
    weather: A.weather, wind, windDir: ctx.windDir, quality, night: A.night, dusk: A.dusk, field,
    hazeColor: A.fog[0],
  });

  // ---- post grade
  const post = { ...A.post, ...(V.post || {}) };
  if (A.weather === 'fog') post.bloomStrength = (post.bloomStrength || 1) * 1.25;

  // ---- shadow focus
  const keyDir = A.key.dir.clone().normalize();
  const _t = new THREE.Vector3();
  const focusShadow = (x = 0, z = 0, r = 30) => {
    const cam = key.shadow.camera;
    // snap to shadow texels so the edges don't crawl as the action moves
    const texel = (2 * r) / sm;
    const sx = Math.round(x / texel) * texel, sz = Math.round(z / texel) * texel;
    key.target.position.set(sx, 0, sz);
    key.position.copy(key.target.position).addScaledVector(keyDir, 90);
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 20; cam.far = 170;
    cam.updateProjectionMatrix();
    key.target.updateMatrixWorld();
    _t.copy(key.position);
  };
  focusShadow(0, 0, 32);

  let t = 0;
  let lastDown = 1;
  const venue = {
    id: def.id, def, scene, post, shadowLight: key, field, time, weather: A.weather, atmos: A,
    crowdCount: crowdObj?.count || 0,
    cams: V.cams || {},
    update(dt, st = {}) {
      t = typeof st.time === 'number' ? st.time : t + dt;
      const cam = st.camera;
      if (sky && cam) { sky.position.copy(cam.position); sky.material.uniforms.time.value = t; }
      F.update(dt, t, wind);
      lights.update(t);
      sideline.update(dt, t, st);
      crowdObj?.state.update(dt, { excitement: st.excitement ?? 0.3, reaction: st.reaction || null, homeHasBall: st.homeHasBall, time: t });
      flashes?.update(dt, t);
      wx.update(dt, cam, t);
      V.update?.(dt, st, t);
    },
    setScoreboard(s) {
      for (const b of V.boards || []) b.draw(s);
      if (s && s.down) { lastDown = s.down; sideline.setDown(s.down); }
    },
    setMarkers(m = {}) {
      F.setLines(m);
      sideline.setChains(m);
      sideline.setDown(lastDown);
    },
    focusShadow,
    flashes(rate = 0) { if (flashes) flashes.rate = Math.max(0, rate); },
    dispose() {
      wx.dispose();
      V.dispose?.();
      disposeTree(scene, [...(V.disposables || [])]);
      scene.clear();
    },
  };
  return venue;
}
