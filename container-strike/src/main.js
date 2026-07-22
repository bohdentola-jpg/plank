// Bootstrap and main loop. Simulation runs on a fixed 64-tick timestep with
// rendering decoupled per-frame; trigger input is applied sub-tick straight
// from event timestamps (see player.js), so fire timing never quantizes to
// frame boundaries.
import * as THREE from './three.js';
import { G, TICK_DT } from './state.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { GrenadeSystem } from './grenades.js';
import { GameAudio } from './audio.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { clamp, lerp } from './util.js';

const $ = (id) => document.getElementById(id);

function init() {
  const app = $('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  app.appendChild(renderer.domElement);

  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(G.settings.fov, window.innerWidth / window.innerHeight, 0.02, 600);
  G.scene.add(G.camera);

  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  G.audio = new GameAudio();
  G.world = new World().build();
  G.player = new Player('You', 'CT');
  G.combat = new Combat();
  G.grenades = new GrenadeSystem();
  G.game = new Game();
  G.hud = new HUD();
  G.player.bindInput(renderer.domElement);

  wireMenus();
  loop();
}

// ------------------------------------------------------------------ menus
function wireMenus() {
  const canvas = G.renderer.domElement;

  $('btn-play').addEventListener('click', () => {
    G.audio.init(); G.audio.resume();
    const team = $('sel-team').value;
    G.settings.difficulty = parseInt($('sel-diff').value, 10);
    $('menu').style.display = 'none';
    G.hud.show();
    G.started = true;
    G.paused = false;
    G.game.setupMatch(team);
    canvas.requestPointerLock();
  });

  $('btn-resume').addEventListener('click', () => {
    $('pause').style.display = 'none';
    G.paused = false;
    G.audio.resume();
    canvas.requestPointerLock();
  });

  $('btn-quit').addEventListener('click', () => location.reload());
  $('btn-again').addEventListener('click', () => {
    $('match-end').style.display = 'none';
    G.game.setupMatch(G.player.team);
    canvas.requestPointerLock();
  });

  const sens = $('inp-sens'), vol = $('inp-vol'), fov = $('inp-fov');
  sens.addEventListener('input', () => { G.settings.sens = parseFloat(sens.value); $('sens-val').textContent = (+sens.value).toFixed(2); });
  vol.addEventListener('input', () => { G.settings.volume = parseFloat(vol.value); $('vol-val').textContent = (+vol.value).toFixed(2); G.audio.setVolume(G.settings.volume); });
  fov.addEventListener('input', () => { G.settings.fov = parseInt(fov.value, 10); $('fov-val').textContent = fov.value; });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked) {
      G.player.keys = {}; // never leave movement keys "held" across a lock loss
      G.player.mouseDown = false;
      G.player.mouse2Down = false;
    }
    if (!locked && G.started && !G.hud.buyOpen && !G.game.matchOver && !G.testMode) {
      G.paused = true;
      $('pause').style.display = 'flex';
    }
  });
  window.addEventListener('blur', () => {
    if (G.player) { G.player.keys = {}; G.player.mouseDown = false; G.player.mouse2Down = false; }
  });

  // clicking the canvas re-locks (e.g. after closing the buy menu)
  canvas.addEventListener('click', () => {
    if (G.started && !G.paused && !G.hud.buyOpen && !G.game.matchOver && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });
}

// ------------------------------------------------------------------- loop
let last = performance.now() / 1000;
let acc = 0;

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now() / 1000;
  let frame = Math.min(0.1, now - last);
  last = now;
  if (G.paused) frame = 0;

  acc += frame;
  let steps = 0;
  while (acc >= TICK_DT && steps < 8) {
    step(TICK_DT);
    acc -= TICK_DT;
    steps++;
  }

  // camera + fov each render frame for smoothness
  if (G.started) {
    G.player.applyCamera();
    const def = G.player.currentDef();
    const targetFov = G.player.scoped && def && def.zoom ? G.settings.fov / (def.zoom >= 4 ? def.zoom * 1.4 : def.zoom) : G.settings.fov;
    if (Math.abs(G.camera.fov - targetFov) > 0.1) {
      G.camera.fov = lerp(G.camera.fov, targetFov, 0.25);
      G.camera.updateProjectionMatrix();
    }
    G.hud.update(frame);
  }
  G.audio.syncListener();
  G.renderer.render(G.scene, G.camera);
}

function step(dt) {
  if (!G.started) return;
  G.time += dt;
  G.tick++;
  G.game.update(dt);
  G.player.update(dt);
  for (const b of G.bots) b.update(dt);
  G.grenades.update(dt);
  G.combat.update(dt);
  // prune sound events after bots have had a beat to hear them
  for (let i = G.soundEvents.length - 1; i >= 0; i--) {
    if (G.time - G.soundEvents[i].time > 0.6) G.soundEvents.splice(i, 1);
  }
}

// ---------------------------------------------------------------- testing
// ?test=1 starts a match without pointer lock and exposes hooks; used by the
// headless smoke test.
if (new URLSearchParams(location.search).has('test')) {
  G.testMode = true;
  window.addEventListener('load', () => {
    setTimeout(() => {
      $('btn-play').click();
      document.exitPointerLock && document.exitPointerLock();
    }, 300);
  });
}
window.__cs = G;

init();
