// The game: Port Zarya, on foot. Loads the town, puts Rybka in it, runs the
// clock, the camera, the HUD and every system that lives in the open world.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { C, W, H, text, panel, vText, hints } from '../core/ui.js';
import { buildTown, LightPool } from '../world/town.js';
import { createSky } from '../world/sky.js';
import { createSnow } from '../world/snow.js';
import { Environment } from '../world/environment.js';
import { shoreZ } from '../world/terrain.js';
import { getEnvMap } from '../core/envmap.js';
import { buildCharacter } from '../human/character.js';
import { Animator } from '../human/anim.js';
import { CollisionWorld } from '../game/physics.js';
import { Player, OrbitCamera } from '../game/player.js';
import { HUD } from '../game/hud.js';
import { game$, newState, loadGame, saveGame } from '../game/state.js';
import { store } from '../core/settings.js';
import { voice } from '../audio/voice.js';
import { audio } from '../audio/audio.js';
import { playerDNA } from '../scenes/warehouse.js';
import { Director } from '../scenes/director.js';
import { NPCs } from '../game/npcs.js';
import { Interactions } from '../game/interact.js';
import { Dialog, drawYou } from '../game/dialog.js';
import { Missions } from '../game/missions.js';
import { Attention } from '../game/attention.js';
import { Minigames } from '../game/minigames.js';
import { streetPoints } from '../world/roads.js';
import { sfx } from '../audio/sfx.js';
import { DAY_START } from '../data/script/days.js';
import { NEWDAY_HOOKS } from '../data/script/index.js';
import { Economy } from '../game/economy.js';
import { optionsPanel } from './options.js';
import { Phone } from '../game/phone.js';
import { ChimneySmoke } from '../world/smoke.js';
import { Vehicles } from '../game/vehicles.js';

export const G = {
  // the live game, for every system to reach: G.state, G.player, G.town, G.hud …
};

/** The player's outdoor outfit: their own clothes under a parka. */
function outdoorDNA(profile) {
  const dna = { ...playerDNA() };
  const base = (dna.outfit || []).filter((g) => g.slot !== 'coat');
  dna.outfit = [...base, { slot: 'coat', pattern: 'nylon', color: profile?.coat || '#2e3a44', thick: 0.016, puff: 0.016, hem: 'hip' }];
  return dna;
}

registerScreen('town', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 6000);
  let ready = false, progress = 0, paused = false, pauseSel = 0, opts = null;
  let env, sky, snow, pool, world, orbit, hud;
  let saveT = 0, occT = 0;

  async function setup(params) {
    const profile = store.load('profile') || {};
    let s = params.load ? loadGame() : null;
    if (!s) { s = newState(profile); game$.s = s; }
    G.state = s;
    sky = createSky();
    scene.add(sky.mesh);
    env = new Environment(scene, sky, { hour: s.hour });
    G.env = env;
    scene.environment = getEnvMap(game.renderer.gl, 'night');
    scene.environmentIntensity = 0.25;
    snow = createSnow({ count: 7000, box: 60, height: 32 });
    snow.uniforms.size.value = 0.06;
    scene.add(snow.points);
    const town = await buildTown({ states: s.repairs, onProgress: (k) => { progress = k * 0.9; } });
    const chimneys = new ChimneySmoke(town.smokePoints);
    scene.add(chimneys.points);
    G.chimneys = chimneys;
    G.town = town;
    scene.add(town.root);
    pool = new LightPool(scene, town.lightSources, 12);
    world = new CollisionWorld();
    for (const c of town.colliders) world.addBox(c);
    for (const f of town.floors || []) world.addFloor(f);
    G.world = world;
    G.buildingRects = Object.values(town.buildings).filter((b) => b.type !== 'harbor').map((b) => ({ x: b.x, z: b.z, rot: b.rot, w: b.b.footprint?.w || 8, d: b.b.footprint?.d || 8, color: b.type === 'cornerStore' ? 'rgba(80,220,255,0.85)' : undefined }));
    // the player
    const ch = await buildCharacter(outdoorDNA(profile));
    scene.add(ch.group);
    const anim = new Animator(ch);
    const player = new Player(ch, anim, world);
    const at = s.pos || params.at || { x: 8, z: 38, yaw: Math.PI };
    player.place(at.x, at.z, at.yaw ?? 0);
    G.player = player;
    orbit = new OrbitCamera(camera, world);
    orbit.yaw = player.yaw;
    G.orbit = orbit;
    hud = new HUD();
    G.hud = hud;
    G.shoreZ = shoreZ;
    hud.objective = s.objective || null;
    // the systems
    G.scene = scene;
    G.camera = camera;
    G.director = new Director(scene, camera);
    G.walkPoints = streetPoints(18).filter((p) => !p.street.dirt && Math.hypot(p.x, p.z) < 260);
    G.npcs = new NPCs(G);
    G.interact = new Interactions(G);
    G.dialog = new Dialog(G);
    G.missions = new Missions(G);
    G.attention = new Attention(G);
    G.minigames = new Minigames(G);
    G.economy = new Economy(G);
    G.phone = new Phone(G);
    G.vehicles = new Vehicles(G, scene);
    if (game.query.has('ff')) window.__cb = { game, G, input };   // QA handle
    G.cutscene = cutscene;
    G.sfx = sfx;
    G.fadeTeleport = fadeTeleport;
    G.reveal = reveal;
    G.sleep = sleep;
    // the end of day 14: across the strait (scenes/finale.js)
    G.finale = async () => { saveGame(); go('finale', {}, { transition: 'black' }); await new Promise(() => {}); };
    cabinSpots();
    for (const id of ['hardware', 'koshkin', 'northstar', 'diner']) {
      const p = G.missions.where(`${id}.counter`) || G.missions.where(id);
      if (p) G.interact.add('shop:' + id, { x: p.x, z: p.z, y: p.y, r: 2.6, prompt: id === 'diner' ? 'Order something' : 'Browse the shelves', action: () => G.economy.shop(id) });
    }
    progress = 1;
    input.wantPointerLock = true;
    if (!params.load || !Object.keys(s.missions.active).length) {
      if (s.day === 1 && !s.missions.done['d1.arrival'] && !game.query.has('free')) {
        const t = town.buildings.terminal;
        player.place(t.x + 4, t.z + 14, Math.PI);
        orbit.yaw = 0;
        G.missions.start('d1.arrival');
      }
    } else G.missions.resumeAll();
  }

  function cabinSpots() {
    const cab = G.town.buildings.cabin;
    const pt = (name, dx, dz) => G.town.points['cabin.' + name] || { x: cab.x + dx, z: cab.z + dz, y: cab.y };
    const bed = pt('bed', -1.5, -1);
    G.interact.add('cabin.bed', { ...bed, r: 2, prompt: 'Sleep', enabled: () => !!G.state.flags.hasCabin, action: () => G.sleep() });
    const lap = pt('laptop', 1.2, -1.4);
    G.interact.add('cabin.laptop', { ...lap, r: 2, prompt: "Lyosha's Night School", enabled: () => !!G.state.flags.hasCabin, action: () => openLaptop() });
  }

  async function openLaptop() {
    try {
      const mod = await import('./laptop.js');
      await mod.openLaptop(G);
    } catch (e) {
      console.warn(e);
      G.hud.toast('LAPTOP', 'The laptop is still booting…');
    }
  }

  function fade(to, dur) {
    return new Promise((r) => {
      const from = game.fx.fade || 0;
      let t = 0;
      const step = () => {
        t += 1 / 60;
        game.fx.fade = from + (to - from) * Math.min(1, t / dur);
        if (t < dur) requestAnimationFrame(step); else r();
      };
      step();
    });
  }

  async function fadeTeleport(p, dur = 1.2) {
    G.player.locked = true;
    await fade(1, dur * 0.4);
    G.player.place(p.x, p.z, p.yaw ?? G.player.yaw);
    orbit.yaw = G.player.yaw;
    await new Promise((r) => setTimeout(r, dur * 300));
    await fade(0, dur * 0.4);
    G.player.locked = false;
  }

  /** The town reveal: houses, the church, Koshkin's old store — and that one bright new store. */
  async function reveal() {
    const d = G.director, B = G.town.buildings;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    G.cinematic = true;
    G.player.locked = true;
    game.renderer.tweakPost({ letterbox: 1 });
    const line = G.missions.ear('a.nadia.reveal');
    d.cam({ pos: V(-40, 70, 220), look: V(10, 4, -20), fov: 46, dof: false });
    d.cam({ pos: V(-10, 42, 120), look: V(0, 6, -30), fov: 44, dur: 4.5 });
    await d.wait(4.2);
    const ch = B.church;
    d.cam({ pos: V(ch.x - 26, ch.y + 22, ch.z + 34), look: V(ch.x, ch.y + 14, ch.z), fov: 34, dof: false });
    d.cam({ pos: V(ch.x - 14, ch.y + 18, ch.z + 30), look: V(ch.x, ch.y + 16, ch.z), fov: 32, dur: 3.2 });
    await d.wait(3.0);
    const k = B.koshkin;
    d.cam({ pos: V(k.x - 22, k.y + 6, k.z + 10), look: V(k.x, k.y + 4, k.z), fov: 36 });
    d.cam({ pos: V(k.x - 18, k.y + 5, k.z + 4), look: V(k.x, k.y + 4, k.z), fov: 34, dur: 3 });
    await d.wait(2.8);
    const n = B.northstar;
    d.cam({ pos: V(n.x + 26, n.y + 3, n.z + 14), look: V(n.x, n.y + 3, n.z), fov: 38 });
    d.cam({ pos: V(n.x + 18, n.y + 2.5, n.z + 8), look: V(n.x, n.y + 3, n.z), fov: 30, dur: 4.5 });
    await line;
    await d.wait(0.8);
    game.renderer.tweakPost({ letterbox: 0 });
    G.cinematic = false;
    G.player.locked = false;
    game.renderer.dof = null;
  }

  /** Cutscenes in the open world: d.bring() puts people on stage. */
  async function cutscene(fn) {
    const d = G.director;
    G.cinematic = true;
    G.player.locked = true;
    game.renderer.tweakPost({ letterbox: 1 });
    d.addActor('player', G.player.ch, G.player.anim, { external: true });
    const brought = [];
    d.bring = async (id, where, o = {}) => {
      if (id === 'player') {
        const p = G.missions.where(where);
        if (p) G.player.place(p.x, p.z, o.face ?? p.rot ?? G.player.yaw);
        G.player.anim.setPosture(o.sit ? 'sit' : 'stand');
        return;
      }
      const npc = G.npcs.get(id);
      if (!npc) return;
      const p = G.missions.where(where) || { x: G.player.pos.x + 2, z: G.player.pos.z + 2 };
      npc.scripted = true;
      npc.hidden = false;
      npc.pos.set(p.x, G.world.groundAt(p.x, p.z), p.z);
      npc.yaw = o.face ?? p.rot ?? npc.yaw;
      npc.goal = { x: p.x, z: p.z, yaw: npc.yaw, activity: o.sit ? 'sit' : 'stand' };
      if (!npc.ch) await G.npcs._build(npc);
      npc.ch.group.position.copy(npc.pos);
      npc.ch.group.rotation.y = npc.yaw;
      npc.ch.group.visible = true;
      d.addActor(id, npc.ch, npc.anim, { external: true });
      brought.push(npc);
    };
    d.you = async (t) => { G.dialog.youLine = { s: t, t: 0 }; await d.wait(Math.min(3.2, 0.9 + t.length / 28)); };
    try {
      await fn(d);
    } catch (e) { console.error(e); }
    for (const npc of brought) { d.removeActor(npc.id); npc.scripted = false; npc.goal = null; }
    d.removeActor('player');
    G.player.anim.setPosture('stand');
    game.renderer.tweakPost({ letterbox: 0 });
    game.renderer.dof = null;
    G.cinematic = false;
    G.player.locked = false;
  }

  async function sleep() {
    const s = G.state;
    const need = DAY_START[s.day]?.mustFinish || [];
    const open = need.filter((m) => !s.missions.done[m]);
    if (open.length && s.day < 14) { G.missions.ear('d1.n.notyet'); return; }
    G.player.locked = true;
    await fade(1, 0.8);
    s.day += 1;
    s.hour = 8.0;
    s.pos = { x: G.player.pos.x, z: G.player.pos.z, yaw: G.player.yaw };
    s.attention = Math.max(0, s.attention - 15);
    G.hud.toast('A NEW DAY', `Day ${s.day}`, '#ffd166');
    saveGame();
    await new Promise((r) => setTimeout(r, 900));
    await fade(0, 1.0);
    G.player.locked = false;
    for (const id of DAY_START[s.day]?.start || []) G.missions.start(id);
    for (const h of NEWDAY_HOOKS) { try { h(G, s.day); } catch (e) { console.error(e); } }
    G.missions.emit('newday');
    G.missions.emit('day:' + s.day);
  }

  function updateOccluders() {
    const p = G.player.pos;
    const list = [];
    for (const b of Object.values(G.town.buildings)) {
      if (Math.hypot(b.x - p.x, b.z - p.z) < 40) list.push(b.b.group);
    }
    orbit.occluders = list;
  }

  const PAUSE = ['RESUME', 'SAVE GAME', 'OPTIONS', 'QUIT TO TITLE'];

  return {
    heavy: true,
    async enter(params) {
      game.renderer.setPost({ exposure: 1.05, bloomStrength: 0.75, vignette: 0.5, letterbox: 0 }, true);
      G.screen = this;
      await setup(params);
      ready = true;
    },
    exit() { input.wantPointerLock = false; input.releasePointer(); voice.stopAll(); },
    update(dt) {
      if (!ready) return;
      const s = G.state;
      if (G.overlay) { G.overlay.update(dt); G.director.update(dt); return; }
      if (opts) { opts.update(dt); return; }
      if (input.pressed('pause')) { paused = !paused; pauseSel = 0; audio.duck(paused ? 0.8 : 0); if (paused) input.releasePointer(); }
      if (paused) {
        if (input.pressed('up')) pauseSel = (pauseSel + PAUSE.length - 1) % PAUSE.length;
        if (input.pressed('down')) pauseSel = (pauseSel + 1) % PAUSE.length;
        if (input.pressed('confirm')) {
          const it = PAUSE[pauseSel];
          if (it === 'RESUME') { paused = false; audio.duck(0); }
          if (it === 'SAVE GAME') { s.pos = { x: G.player.pos.x, z: G.player.pos.z, yaw: G.player.yaw }; saveGame(); hud.toast('SAVED', `Day ${s.day}, ${env.clockString()}`); paused = false; audio.duck(0); }
          if (it === 'OPTIONS') opts = optionsPanel(() => { opts = null; });
          if (it === 'QUIT TO TITLE') { audio.duck(0); go('title', {}); }
        }
        return;
      }
      // the phone: Tab, or straight to the map (M) / journal (J)
      if (!G.cinematic && !G.dialog.active && !G.minigames.active) {
        if (input.pressed('phone')) G.phone.toggle();
        else if (input.pressed('map')) G.phone.toggle('map');
        else if (input.pressed('journal')) G.phone.toggle('journal');
      }
      if (G.phone.open) { if (G.cinematic) G.phone.close(); else G.phone.update(dt); }
      // the clock: one game minute per real second
      s.hour += dt / 60;
      if (s.hour >= 24) { s.hour -= 24; }
      s.stats.playSeconds += dt;
      env.hour = s.hour;
      const P = G.player;
      P.update(dt, orbit.yaw);
      P.anim.update(dt);
      G.npcs.update(dt);
      G.missions.update(dt);
      G.minigames.update(dt);
      G.interact.update(dt);
      G.vehicles.update(dt);
      G.attention.update(dt);
      G.director.update(dt);
      G.dialog.update(dt);
      occT -= dt;
      if (occT <= 0) { occT = 0.5; updateOccluders(); }
      // interiors appear when you're close (and you're indoors if inside one's footprint)
      let indoors = false;
      for (const it of G.town.interiors) {
        const d = Math.hypot(P.pos.x - it.x, P.pos.z - it.z);
        it.group.visible = d < it.r;
        if (d < 6) indoors = true;
      }
      P.indoors = indoors;
      if (!G.cinematic) orbit.update(dt, P, { indoors, vehicle: G.vehicles.driving });
      G.camYaw = orbit.yaw;
      const r = env.update(dt, P.pos, camera);
      game.renderer.tweakPost({ exposure: env.exposure });
      snow.update(dt, camera, game.renderer.targets.h);
      snow.intensity = indoors ? 0 : 0.8;
      pool.update(dt, P.pos, r.night);
      G.town.update?.(dt);
      G.chimneys?.update(dt, game.renderer.targets.h);
      hud.update(dt);
      saveT += dt;
      if (saveT > 60) { saveT = 0; s.pos = { x: P.pos.x, z: P.pos.z, yaw: P.yaw }; saveGame(); }
    },
    draw(ctx) {
      if (!ready) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        vText(ctx, 'PORT ZARYA', W / 2, H / 2 - 10, 40, { align: 'center', color: '#fff', weight: 0.16, glow: 14, glowColor: 'rgba(127,230,255,0.5)' });
        text(ctx, 'ALASKA  ·  POP. 1,140', W / 2, H / 2 + 22, { size: 14, weight: 700, color: C.dim, align: 'center', spacing: 4 });
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(W / 2 - 200, H / 2 + 48, 400, 3);
        ctx.fillStyle = C.accent; ctx.fillRect(W / 2 - 200, H / 2 + 48, 400 * progress, 3);
        return;
      }
      hud.visible = !G.cinematic || !!G.dialog.active;
      if (!G.cinematic) hud.draw(ctx, { state: G.state, player: G.player, camYaw: G.camYaw, buildingRects: G.buildingRects, shoreZ });
      G.minigames.draw(ctx);
      G.vehicles.draw(ctx);
      G.phone.draw(ctx);
      if (G.overlay) G.overlay.draw(ctx, 1 / 60);
      G.director.draw(ctx);
      drawYou(ctx, G.dialog, W, H, text);
      if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
        vText(ctx, 'PAUSED', W / 2, 220, 44, { align: 'center', color: '#fff', weight: 0.16 });
        PAUSE.forEach((it, i) => {
          const on = i === pauseSel;
          panel(ctx, W / 2 - 170, 280 + i * 58, 340, 46, { accent: on ? C.accent : 'rgba(0,0,0,0)', alpha: on ? 1 : 0.7 });
          vText(ctx, it, W / 2, 312 + i * 58, 20, { align: 'center', color: on ? '#fff' : C.dim, weight: 0.16 });
        });
        hints(ctx, [['ud', 'SELECT'], ['confirm', 'OK'], ['pause', 'RESUME']]);
        if (opts) opts.draw(ctx);
      }
    },
    view() { return ready ? { scene, camera } : null; },
  };
});
