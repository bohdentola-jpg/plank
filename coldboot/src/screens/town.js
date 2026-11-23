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
  let ready = false, progress = 0, paused = false, pauseSel = 0;
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
    hud.objective = s.objective || { text: "Find Koshkin's General Store", sub: 'On the square by the church', target: { x: 34, z: -2 } };
    progress = 1;
    input.wantPointerLock = true;
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
      if (input.pressed('pause')) { paused = !paused; pauseSel = 0; audio.duck(paused ? 0.8 : 0); if (paused) input.releasePointer(); }
      if (paused) {
        if (input.pressed('up')) pauseSel = (pauseSel + PAUSE.length - 1) % PAUSE.length;
        if (input.pressed('down')) pauseSel = (pauseSel + 1) % PAUSE.length;
        if (input.pressed('confirm')) {
          const it = PAUSE[pauseSel];
          if (it === 'RESUME') { paused = false; audio.duck(0); }
          if (it === 'SAVE GAME') { s.pos = { x: G.player.pos.x, z: G.player.pos.z, yaw: G.player.yaw }; saveGame(); hud.toast('SAVED', `Day ${s.day}, ${env.clockString()}`); paused = false; audio.duck(0); }
          if (it === 'OPTIONS') go('options', { from: 'town' });
          if (it === 'QUIT TO TITLE') { audio.duck(0); go('title', {}); }
        }
        return;
      }
      // the clock: one game minute per real second
      s.hour += dt / 60;
      if (s.hour >= 24) { s.hour -= 24; }
      s.stats.playSeconds += dt;
      env.hour = s.hour;
      const P = G.player;
      P.update(dt, orbit.yaw);
      P.anim.update(dt);
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
      orbit.update(dt, P, { indoors });
      G.camYaw = orbit.yaw;
      const r = env.update(dt, P.pos, camera);
      game.renderer.tweakPost({ exposure: env.exposure });
      snow.update(dt, camera, game.renderer.targets.h);
      snow.intensity = indoors ? 0 : 0.8;
      pool.update(dt, P.pos, r.night);
      voice.update(dt);
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
      hud.draw(ctx, { state: G.state, player: G.player, camYaw: G.camYaw, buildingRects: G.buildingRects, shoreZ });
      if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
        vText(ctx, 'PAUSED', W / 2, 220, 44, { align: 'center', color: '#fff', weight: 0.16 });
        PAUSE.forEach((it, i) => {
          const on = i === pauseSel;
          panel(ctx, W / 2 - 170, 280 + i * 58, 340, 46, { accent: on ? C.accent : 'rgba(0,0,0,0)', alpha: on ? 1 : 0.7 });
          vText(ctx, it, W / 2, 312 + i * 58, 20, { align: 'center', color: on ? '#fff' : C.dim, weight: 0.16 });
        });
        hints(ctx, [['ud', 'SELECT'], ['confirm', 'OK'], ['pause', 'RESUME']]);
      }
    },
    view() { return ready ? { scene, camera } : null; },
  };
});
