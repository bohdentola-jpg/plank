// QA: a grid of rigs cycling through every animation clip (?gallery).
import * as THREE from 'three';
import { makeKit, buildPlayer, buildBall, buildRef, buildCoach } from './playerModel.js';
import { Animator } from './animation.js';
import { makeClips } from './clips.js';
import { logoCanvas } from './logos.js';

export function galleryMode(defaultState) {
  document.body.classList.add('gallery');
  document.getElementById('scr-game').classList.add('active');
  const holder = document.getElementById('game-holder');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(holder.clientWidth, holder.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  holder.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#182038');
  const cam = new THREE.PerspectiveCamera(40, holder.clientWidth / holder.clientHeight, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#8a9cc8', '#202418', 1.0));
  const key = new THREE.DirectionalLight('#fff0d8', 2.0);
  key.position.set(10, 18, 14);
  key.castShadow = true;
  key.shadow.camera.left = -30; key.shadow.camera.right = 30;
  key.shadow.camera.top = 30; key.shadow.camera.bottom = -30;
  scene.add(key);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshPhongMaterial({ color: '#2c5a28' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const state = defaultState();
  const logo = logoCanvas('wing', { fg: '#f2b705', bg: '#14306e', line: '#101014', letter: 'W' });
  const kit = makeKit(state.uniform, logo);
  const CLIPS = makeClips();
  const params = new URLSearchParams(location.search);
  const clipList = (params.get('clips') || 'idle,ready,run,sprint,backpedal,stance3,stance2,qbUnder,throwHold,throwRelease,catchHigh,block,tackleLunge,fallBack,fallFwd,celebrate,kick,jukeL').split(',');
  const anims = [];
  const cols = 6;
  clipList.forEach((clip, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const builds = ['avg', 'slim', 'big', 'huge'];
    const rig = buildPlayer(kit, { num: 10 + i, build: builds[i % 4], skin: ['#c68863', '#8d5a3b', '#5d3a26'][i % 3] });
    rig.group.position.set((col - (cols - 1) / 2) * 3.2, 0, row * 4 - 3);
    scene.add(rig.group);
    const a = new Animator(rig, CLIPS);
    a.play(clip, { fade: 0 });
    anims.push({ a, clip });
  });
  const ball = buildBall();
  ball.position.set(0, 0.14, 4.4);
  scene.add(ball);
  const ref = buildRef();
  ref.group.position.set(-4, 0, 4.5);
  scene.add(ref.group);
  const refA = new Animator(ref, CLIPS);
  refA.play('refTD');
  const coach = buildCoach('#14306e', '#f2b705');
  coach.group.position.set(4, 0, 4.5);
  scene.add(coach.group);
  const coachA = new Animator(coach, CLIPS);
  coachA.play('idle');

  const clock = new THREE.Clock();
  let t = 0;
  const camY = parseFloat(params.get('camy') || '6');
  const camR = parseFloat(params.get('camr') || '17');
  (function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    for (const { a, clip } of anims) {
      a.update(dt);
      if (a.finished) a.play(clip, { force: true, fade: 0.1 });
    }
    refA.update(dt);
    coachA.update(dt);
    const ang = parseFloat(params.get('ang') || '0') + (params.has('spin') ? t * 0.3 : 0);
    cam.position.set(Math.sin(ang) * camR, camY, Math.cos(ang) * camR);
    cam.lookAt(0, 1.0, -1);
    renderer.render(scene, cam);
  })();
  window.__fng = { gallery: true };
}
