// App shell: title screen, the three builders, then Friday night.
import * as THREE from 'three';
import { genRoster, genRival } from './names.js';
import { SchoolBuilder, UniformBuilder, TeamBuilder } from './builders.js';
import { Game } from './game.js';
import { makeKit, buildPlayer, buildBall, buildRef, buildCoach } from './playerModel.js';
import { Animator } from './animation.js';
import { makeClips } from './clips.js';
import { logoCanvas } from './logos.js';
import { sfx } from './audio.js';

const SAVE_KEY = 'fng04_save_v1';

function defaultState() {
  return {
    school: {
      name: 'Westfield', mascot: 'Falcons', logoId: 'wing',
      colors: { primary: '#14306e', secondary: '#f2b705' },
      building: { style: 'brick', floors: 2, length: 2, wingL: true, wingR: false, gym: true, cupola: true, brick: '#9a4a32', buses: true },
    },
    uniform: {
      jersey: '#14306e', pants: '#f2f1ec', helmet: '#14306e', sleeve: '#f2b705',
      numberFill: '#f4f4f2', numberStroke: '#f2b705', pantsStripe: '#14306e',
      helmetStripe: '#f2b705', facemask: '#2d2f33', socks: '#14306e',
      style: 'classic', stripes2: false,
    },
    roster: genRoster(4),
    rival: null,
    _uniformInit: false,
  };
}

function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ school: state.school, uniform: state.uniform, roster: state.roster }));
  } catch { /* private mode */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.school?.name || !data.roster?.length) return null;
    return { ...defaultState(), ...data, _uniformInit: true };
  } catch { return null; }
}

// ------------------------------------------------------------- shell
const screens = ['title', 'school', 'uniform', 'team', 'game'];
function showScreen(id) {
  for (const s of screens) {
    document.getElementById(`scr-${s}`).classList.toggle('active', s === id);
  }
}

class App {
  constructor() {
    this.state = defaultState();
    this.current = null; // active builder/game with dispose()
    this.bindTitle();
  }

  swap(thing) {
    if (this.current?.dispose) this.current.dispose();
    this.current = thing;
  }

  bindTitle() {
    const saved = loadState();
    const cont = document.getElementById('title-continue');
    cont.style.display = saved ? '' : 'none';
    document.getElementById('title-new').onclick = () => { sfx.ensure(); sfx.chime(); this.toSchool(); };
    document.getElementById('title-quick').onclick = () => { sfx.ensure(); sfx.chime(); this.toGame(); };
    cont.onclick = () => {
      sfx.ensure(); sfx.chime();
      this.state = loadState() || this.state;
      this.toGame();
    };
    this.titleScene();
  }

  titleScene() {
    // a hero shot behind the title: QB mid-throw under the lights
    const holder = document.getElementById('title-3d');
    if (!holder || holder.dataset.built) return;
    holder.dataset.built = '1';
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(holder.clientWidth, holder.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    holder.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a1024');
    scene.fog = new THREE.Fog('#0a1024', 14, 50);
    const cam = new THREE.PerspectiveCamera(40, holder.clientWidth / holder.clientHeight, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#8a9cd8', '#1c2415', 1.3));
    const key = new THREE.DirectionalLight('#ffe8c4', 3.2);
    key.position.set(6, 10, 6);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#7a9aff', 1.8);
    rim.position.set(-8, 6, -6);
    scene.add(rim);
    const glow = new THREE.PointLight('#ffd890', 30, 18);
    glow.position.set(0, 4, 3);
    scene.add(glow);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 32),
      new THREE.MeshPhongMaterial({ color: '#1d3a1c' })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const s = this.state.school;
    const logo = logoCanvas(s.logoId, { fg: s.colors.secondary, bg: s.colors.primary, line: '#101014', letter: s.name[0] });
    const kit = makeKit(this.state.uniform, logo);
    const CLIPS = makeClips();
    const anims = [];
    const add = (build, num, clip, x, z, face, rate = 1) => {
      const rig = buildPlayer(kit, { num, build, skin: '#8d5a3b' });
      rig.group.position.set(x, 0, z);
      rig.group.rotation.y = face;
      scene.add(rig.group);
      const a = new Animator(rig, CLIPS);
      a.play(clip, { fade: 0, startAt: Math.random() * 0.5 });
      a.rate = rate;
      anims.push(a);
      return rig;
    };
    add('avg', 7, 'throwHold', 0.6, 0, -0.5, 0.7);
    add('slim', 81, 'sprint', -2.0, -1.4, -0.2);
    add('huge', 72, 'block', 2.4, -1.2, 0.4, 0.8);
    const clock = new THREE.Clock();
    let t = 0;
    const tick = () => {
      if (!document.getElementById('scr-title').classList.contains('active')) {
        requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;
      // self-heal if we were built while hidden
      const cv = renderer.domElement;
      if (holder.clientWidth && cv.width !== Math.round(holder.clientWidth * renderer.getPixelRatio())) {
        cam.aspect = holder.clientWidth / holder.clientHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(holder.clientWidth, holder.clientHeight);
      }
      for (const a of anims) a.update(dt);
      cam.position.set(2.2 + Math.sin(t * 0.14) * 4.4, 1.9 + Math.sin(t * 0.4) * 0.15, Math.cos(t * 0.14) * 6.2);
      cam.lookAt(0.4, 1.25, 0);
      renderer.render(scene, cam);
      requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('resize', () => {
      if (!holder.clientWidth) return;
      cam.aspect = holder.clientWidth / holder.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(holder.clientWidth, holder.clientHeight);
    });
  }

  toSchool() {
    showScreen('school');
    const b = new SchoolBuilder(
      document.querySelector('#scr-school .panel'),
      document.querySelector('#scr-school .preview3d'),
      this.state
    );
    b.onNext(() => this.toUniform());
    this.swap(b);
  }

  toUniform() {
    // derive uniform from school colors on first visit
    if (!this.state._uniformInit) {
      const c = this.state.school.colors;
      Object.assign(this.state.uniform, {
        jersey: c.primary, helmet: c.primary, sleeve: c.secondary,
        numberFill: '#f4f4f2', numberStroke: c.secondary,
        pantsStripe: c.primary, helmetStripe: c.secondary, socks: c.primary,
      });
      this.state._uniformInit = true;
    }
    showScreen('uniform');
    const b = new UniformBuilder(
      document.querySelector('#scr-uniform .panel'),
      document.querySelector('#scr-uniform .preview3d'),
      this.state
    );
    b.onNext(() => this.toTeam());
    this.swap(b);
  }

  toTeam() {
    showScreen('team');
    const b = new TeamBuilder(
      document.querySelector('#scr-team .panel'),
      document.querySelector('#scr-team .preview3d'),
      this.state
    );
    b.onNext(() => this.toGame());
    this.swap(b);
  }

  toGame(rematch = false) {
    saveState(this.state);
    if (!rematch || !this.state.rival) {
      this.state.rival = genRival(this.state.school.name, this.state.school.mascot);
    }
    showScreen('game');
    const game = new Game(document.getElementById('game-holder'), this.state, {
      onExit: () => { this.swap(null); showScreen('title'); this.bindTitle(); },
      onRematch: () => { this.toGame(true); },
    });
    this.swap(game);
    window.__fng = { state: this.state, game };
  }
}

// ------------------------------------------------------------- modes
function galleryMode() {
  // QA: a grid of rigs cycling through every clip
  document.body.classList.add('gallery');
  showScreen('game');
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
    if (!CLIPS[clip]) console.warn('missing clip', clip);
    anims.push({ a, clip });
  });
  // ball + ref + coach
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
      if (a.finished) a.play(clip, { force: true, fade: 0.1 }); // loop one-shots
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

// ------------------------------------------------------------- boot
const params = new URLSearchParams(location.search);
if (params.has('gallery')) {
  galleryMode();
} else {
  showScreen('title'); // layout first so the title hero scene gets a real size
  const app = new App();
  if (params.has('quick')) app.toGame();
  window.__app = app;
}
