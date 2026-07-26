// Boot → title → pick a Griffin → Quahog. Also the pause menu, the map, the
// job board and the save file, which is one small blob in localStorage.
import * as THREE from 'three';
import { World } from './world.js';
import { CHARACTERS, PLAYABLE, charSpec, portrait, buildCharacter, poseRig } from './cast.js';
import { MISSIONS, LEVELS, levelById, availableIn, levelComplete, storyProgress } from './missions.js';
import { GAGS } from './gags.js';
import { InkPass, buildSky, toon, flat, mkCanvas, INK } from './toon.js';
import { buildVehicle, VEHICLES } from './vehicles.js';
import * as B from './buildings.js';
import { sfx } from './audio.js';

const SAVE_KEY = 'quahog_save_v1';
const BUILD = 'BUILD 1';

function defaultSave() {
  return {
    mode: 'story',
    level: 1,
    maxLevel: 1,
    char: 'peter',
    coins: 0,
    done: [],
    gags: [],
    found: {},
    unlocked: ['peter'],
    hour: 9,
    day: 0,
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d.char) return null;
    return { ...defaultSave(), ...d };
  } catch { return null; }
}

function writeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

// ------------------------------------------------------------------ logos
export function logoCanvas(w = 720, h = 300) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // kicker
  ctx.font = `900 ${h * 0.13}px Impact, 'Arial Black', sans-serif`;
  ctx.fillStyle = '#c0261c';
  ctx.strokeStyle = INK;
  ctx.lineWidth = h * 0.03;
  ctx.strokeText('FAMILY GUY', w / 2, h * 0.16);
  ctx.fillText('FAMILY GUY', w / 2, h * 0.16);
  // the word
  ctx.save();
  ctx.translate(w / 2, h * 0.48);
  ctx.font = `900 ${h * 0.42}px Impact, 'Arial Black', sans-serif`;
  ctx.lineWidth = h * 0.085;
  ctx.strokeStyle = INK;
  ctx.strokeText('QUAHOG', 0, 0);
  const g = ctx.createLinearGradient(0, -h * 0.2, 0, h * 0.2);
  g.addColorStop(0, '#fff3c4');
  g.addColorStop(0.5, '#f2b705');
  g.addColorStop(0.52, '#e07a12');
  g.addColorStop(1, '#ffd75e');
  ctx.fillStyle = g;
  ctx.fillText('QUAHOG', 0, 0);
  ctx.restore();
  // subtitle bar
  ctx.font = `900 ${h * 0.19}px Impact, 'Arial Black', sans-serif`;
  ctx.lineWidth = h * 0.05;
  ctx.strokeStyle = INK;
  ctx.strokeText('HIT & RUN', w / 2, h * 0.80);
  ctx.fillStyle = '#fdfaf2';
  ctx.fillText('HIT & RUN', w / 2, h * 0.80);
  return cv;
}

function stingArt() {
  const cv = document.getElementById('sting-art');
  const ctx = cv.getContext('2d');
  const { width: w, height: h } = cv;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0a1226';
  ctx.fillRect(0, 0, w, h);
  // a little CRT television, because that is where all of this came from
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(w / 2 - 130, h / 2 - 84, 260, 168);
  ctx.strokeStyle = '#141418';
  ctx.lineWidth = 6;
  ctx.strokeRect(w / 2 - 130, h / 2 - 84, 260, 168);
  ctx.fillStyle = '#4aa6e8';
  ctx.fillRect(w / 2 - 112, h / 2 - 66, 190, 132);
  ctx.strokeRect(w / 2 - 112, h / 2 - 66, 190, 132);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let y = h / 2 - 66; y < h / 2 + 66; y += 6) ctx.fillRect(w / 2 - 112, y, 190, 2);
  ctx.fillStyle = '#141418';
  ctx.beginPath(); ctx.arc(w / 2 + 100, h / 2 - 30, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w / 2 + 100, h / 2 + 4, 10, 0, Math.PI * 2); ctx.fill();
  ctx.font = "900 26px Impact, 'Arial Black', sans-serif";
  ctx.fillStyle = '#fdfaf2';
  ctx.fillText('THE FAMILY PC', w / 2 - 17, h / 2 - 6);
  ctx.font = "700 13px 'Arial Narrow', sans-serif";
  ctx.fillStyle = '#ffe9a0';
  ctx.fillText('PRESENTS', w / 2 - 17, h / 2 + 22);
  return cv;
}

function bootArt() {
  const cv = document.getElementById('boot-art');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const logo = logoCanvas(520, 220);
  ctx.drawImage(logo, 0, 0);
}

// ------------------------------------------------------------------- shell
const screens = ['title', 'select', 'world'];
function showScreen(id) {
  for (const s of screens) document.getElementById(`scr-${s}`).classList.toggle('active', s === id);
}

function modal(html, buttons = [], { sticky = false } = {}) {
  const wrap = document.getElementById('modal');
  const card = wrap.querySelector('.m-card');
  card.innerHTML = html;
  const holder = document.createElement('div');
  holder.className = 'm-buttons';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.innerHTML = `<span>${b.label}</span>${b.fx ? `<span class="fx">${b.fx}</span>` : ''}`;
    if (b.gold) el.classList.add('gold');
    if (b.disabled) el.disabled = true;
    el.onclick = () => { sfx.ui(); if (!b.keepOpen) wrap.classList.remove('show'); b.onPick?.(); };
    holder.appendChild(el);
  }
  card.appendChild(holder);
  wrap.classList.add('show');
  wrap.onclick = sticky ? null : (e) => { if (e.target === wrap) wrap.classList.remove('show'); };
}
function closeModal() { document.getElementById('modal').classList.remove('show'); }

// --------------------------------------------------------------- title art
function titleScene() {
  const holder = document.getElementById('title-3d');
  if (!holder || holder.dataset.built) return;
  holder.dataset.built = '1';
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(holder.clientWidth || innerWidth, holder.clientHeight || innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  holder.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, (holder.clientWidth || innerWidth) / (holder.clientHeight || innerHeight), 0.3, 400);
  const sky = buildSky(260);
  scene.add(sky.group);
  scene.add(new THREE.HemisphereLight('#cfe6ff', '#6a7a4a', 1.05));
  const sun = new THREE.DirectionalLight('#fff6e0', 1.25);
  sun.position.set(20, 40, 22);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(220, 40), toon('#63ac48'));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(420, 13), toon('#4d5058'));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, 7.5);
  scene.add(road);

  // the street they live on
  const homes = [B.bake(B.griffinHouse()), B.bake(B.house({ w: 9.5, d: 8, wall: '#bfe0f0', roof: '#3f5f7a', garage: true, door: '#2e5a9e' })),
    B.bake(B.house({ w: 9.5, d: 8, wall: '#f2d9a8', roof: '#6a5a4a', door: '#3f7a3a' }))];
  homes.forEach((h, i) => {
    h.position.set(-8 + i * 17, 0, -9);
    scene.add(h);
  });
  for (const [tx, tz] of [[-30, -3], [-15, -6], [17, -5], [31, -2]]) {
    const t = B.bake(B.tree(tx < 0 ? 'pine' : 'oak'));
    t.position.set(tx, 0, tz);
    scene.add(t);
  }
  const car = buildVehicle(VEHICLES.wagon);
  car.group.position.set(-8.5, 0, 3.5);
  car.group.rotation.y = Math.PI * 0.5;
  scene.add(car.group);

  // the family, lined up on the lawn
  const rigs = [];
  PLAYABLE.forEach((id, i) => {
    const rig = buildCharacter(charSpec(id));
    rig.group.position.set(1.2 + i * 2.0, 0, 3.2);
    rig.group.rotation.y = 0.34 - i * 0.06;
    scene.add(rig.group);
    rigs.push(rig);
  });

  const ink = new InkPass(renderer, { scale: 0.8 });
  ink.setSize(holder.clientWidth || innerWidth, holder.clientHeight || innerHeight);
  scene.fog = new THREE.Fog('#dcecf8', 60, 190);

  const clock = new THREE.Clock();
  let t = 0;
  const tick = () => {
    requestAnimationFrame(tick);
    if (!document.getElementById('scr-title').classList.contains('active')) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    rigs.forEach((r, i) => poseRig(r, 'idle', t + i * 0.4, { dt }));
    sky.update(11, dt, cam.position);
    const a = 0.3 + Math.sin(t * 0.07) * 0.34;
    cam.position.set(Math.sin(a) * 14 + 6.0, 3.1 + Math.sin(t * 0.2) * 0.25, Math.cos(a) * 14 + 6.5);
    cam.lookAt(6.0, 1.5, 1.6);
    const w = holder.clientWidth, h = holder.clientHeight;
    if (w && renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      renderer.setSize(w, h);
      ink.setSize(w, h);
    }
    ink.render(scene, cam, [sky.dome]);
  };
  tick();
}

// ------------------------------------------------------------ select screen
class SelectScreen {
  constructor(app) {
    this.app = app;
    this.pick = app.save.char || 'peter';
    this.holder = document.getElementById('select-3d');
    this.build3d();
    this.renderCards();
    document.getElementById('select-go').onclick = () => {
      sfx.ui();
      app.enterWorld(this.pick);
    };
    document.getElementById('select-back').onclick = () => {
      sfx.back();
      this.stop = true;
      showScreen('title');
    };
  }

  build3d() {
    if (this.holder.dataset.built) { this.swapRig(); return; }
    this.holder.dataset.built = '1';
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(this.holder.clientWidth || 600, this.holder.clientHeight || 600);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.holder.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, 1, 0.2, 200);
    scene.add(new THREE.HemisphereLight('#dfeeff', '#7a8a5a', 1.15));
    const sun = new THREE.DirectionalLight('#fff6e0', 1.2);
    sun.position.set(6, 12, 8);
    scene.add(sun);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.4, 28), toon('#e8e2d2'));
    disc.position.y = -0.2;
    scene.add(disc);
    const sky = buildSky(90);
    scene.add(sky.group);
    const ink = new InkPass(renderer, { scale: 0.85 });
    ink.setSize(this.holder.clientWidth || 600, this.holder.clientHeight || 600);
    this.gfx = { renderer, scene, cam, ink, sky, rig: null, car: null };
    this.swapRig();
    const clock = new THREE.Clock();
    let t = 0;
    const tick = () => {
      requestAnimationFrame(tick);
      if (!document.getElementById('scr-select').classList.contains('active')) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;
      if (this.gfx.rig) poseRig(this.gfx.rig, 'idle', t, { dt });
      sky.update(12, dt, cam.position);
      const w = this.holder.clientWidth, h = this.holder.clientHeight;
      if (w && renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) {
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
        renderer.setSize(w, h);
        ink.setSize(w, h);
      }
      const a = t * 0.4;
      cam.position.set(Math.sin(a) * 6.6, 2.5, Math.cos(a) * 6.6);
      cam.lookAt(0, 1.0, 0);
      ink.render(scene, cam, [sky.dome]);
    };
    tick();
  }

  swapRig() {
    const g = this.gfx;
    if (!g) return;
    if (g.rig) g.scene.remove(g.rig.group);
    if (g.car) g.scene.remove(g.car.group);
    const spec = charSpec(this.pick);
    g.rig = buildCharacter(spec);
    g.scene.add(g.rig.group);
    const car = buildVehicle(VEHICLES[spec.car] || VEHICLES.sedan);
    car.group.position.set(0.4, 0, -4.4);
    car.group.rotation.y = 0.5;
    g.scene.add(car.group);
    g.car = car;
  }

  renderCards() {
    const wrap = document.getElementById('select-cards');
    wrap.innerHTML = '';
    for (const id of PLAYABLE) {
      const spec = CHARACTERS[id];
      const locked = !this.app.save.unlocked.includes(id);
      const btn = document.createElement('button');
      btn.className = `pick${id === this.pick ? ' on' : ''}${locked ? ' locked' : ''}`;
      const cv = portrait(spec, 96);
      btn.appendChild(cv);
      const b = document.createElement('b');
      b.textContent = locked ? '???' : spec.short;
      btn.appendChild(b);
      btn.onclick = () => {
        if (locked) {
          sfx.back();
          const owner = MISSIONS.find((m) => m.unlock === id);
          document.getElementById('select-info').innerHTML = `
            <h3>LOCKED</h3>
            <div class="tag">NOT YET PLAYABLE</div>
            <p>${owner
              ? `Finish <b>${charSpec(owner.char).short}</b>'s five jobs — the last one is
                 "${owner.title}" — and they will turn up.`
              : 'Play through the family and they will turn up.'}</p>
            <p>Or take <b>FREE ROAM</b> from the title screen and have everyone at once.</p>`;
          return;
        }
        sfx.ui();
        this.pick = id;
        this.swapRig();
        this.renderCards();
      };
      wrap.appendChild(btn);
    }
    const spec = CHARACTERS[this.pick];
    const done = missionsFor(this.pick).filter((m) => this.app.save.done.includes(m.id)).length;
    const bar = (label, v) => `<div class="stat"><span style="width:52px">${label}</span><i><b style="width:${Math.round(v * 100)}%"></b></i></div>`;
    document.getElementById('select-info').innerHTML = `
      <h3>${spec.name}</h3>
      <div class="tag">${spec.tag} · ${done}/5 JOBS DONE</div>
      <p>${spec.bio}</p>
      ${bar('SPEED', spec.speed / 1.4)}
      ${bar('MUSCLE', spec.strength / 1.7)}
      <div class="tag" style="margin-top:8px">SPECIAL — ${spec.special}</div>
      <div class="tag">RIDE — ${(VEHICLES[spec.car] || VEHICLES.sedan).name}</div>`;
  }
}

// --------------------------------------------------------------------- app
class App {
  constructor() {
    this.save = loadSave() || defaultSave();
    this.world = null;
    this.bindTitle();
    this.bindWorldUi();
  }

  bindTitle() {
    const logo = document.getElementById('title-logo');
    logo.getContext('2d').drawImage(logoCanvas(820, 320), 0, 0);
    const saved = loadSave();
    const cont = document.getElementById('title-continue');
    cont.disabled = !saved;
    const levels = document.getElementById('title-levels');
    levels.disabled = !saved || (saved.maxLevel || 1) < 2;

    const card = document.getElementById('title-levelcard');
    if (saved) {
      const lvl = levelById(saved.level || 1);
      const prog = storyProgress(saved);
      card.classList.add('show');
      card.innerHTML = `<b>${lvl ? lvl.card : 'STORY COMPLETE'}</b>
        ${lvl ? lvl.name : 'QUAHOG IS SAFE'}<br/>${prog.done}/${prog.total} STORY JOBS · ${saved.coins} CLAMS`;
    } else {
      card.classList.remove('show');
    }

    document.getElementById('title-new').onclick = () => {
      sfx.ensure(); sfx.ui();
      if (saved && !confirm('Start a new game? Your save will be overwritten.')) return;
      this.save = defaultSave();
      writeSave(this.save);
      this.enterWorld('peter', { story: true });
    };
    cont.onclick = () => {
      sfx.ensure(); sfx.ui();
      this.save = loadSave() || defaultSave();
      this.enterWorld(this.save.char || 'peter');
    };
    levels.onclick = () => { sfx.ui(); this.levelSelect(); };
    document.getElementById('title-free').onclick = () => {
      sfx.ensure(); sfx.ui();
      this.save = { ...(loadSave() || defaultSave()), mode: 'free', unlocked: [...PLAYABLE] };
      this.toSelect();
    };
    document.getElementById('title-help').onclick = () => { sfx.ui(); this.helpModal(); };
    titleScene();
  }

  levelSelect() {
    const s = this.save = loadSave() || this.save;
    const maxLevel = s.maxLevel || 1;
    modal(`
      <h3>LEVEL SELECT</h3>
      <div class="m-sub">REPLAY ANY LEVEL YOU HAVE REACHED</div>
      <div class="m-note">Each level puts you in a different Griffin's shoes with their own jobs,
      their own car and seven collectibles hidden around their patch of town.</div>`,
      LEVELS.map((l) => {
        const done = l.missions.filter((m) => s.done.includes(m.id)).length;
        const found = (s.found[l.id] || []).length;
        return {
          label: `${l.card} — ${l.name}`,
          fx: l.id > maxLevel ? 'LOCKED' : `${done}/${l.missions.length} JOBS · ${found}/${l.collectible.n} FOUND`,
          disabled: l.id > maxLevel,
          onPick: () => {
            this.save.level = l.id;
            this.save.mode = 'story';
            writeSave(this.save);
            this.enterWorld(l.char, { level: l });
          },
        };
      }).concat([{ label: 'BACK', gold: true }]));
  }

  helpModal() {
    showScreen('title');
    modal(`
      <h3>HOW TO PLAY</h3>
      <div class="m-sub">QUAHOG, RHODE ISLAND · POPULATION: MOSTLY IDIOTS</div>
      <p><b>On foot —</b> <b>WASD</b> move · <b>SHIFT</b> sprint · <b>SPACE</b> jump ·
      <b>F</b> swing · <b>R</b> your character's special · <b>E</b> get in the nearest car ·
      <b>G</b> talk / start a job / trigger a cutaway gag.</p>
      <p><b>Driving —</b> <b>W/S</b> throttle and brake · <b>A/D</b> steer · <b>SPACE</b> handbrake ·
      <b>H</b> horn · <b>E</b> get out.</p>
      <p><b>Anywhere —</b> <b>M</b> map · <b>ESC</b> pause · <b>X</b> abandon a job ·
      <b>Z/C</b> swing the camera. A gamepad works too: stick to move, ✕ handbrake/jump,
      ◯ enter/exit, □ swing, R2 gas.</p>
      <div class="m-note">Gold diamonds are jobs for the Griffin you are playing. Purple TVs are
      cutaway gags — eighteen of them, and each one pays the first time. Coins are everywhere.
      The clock runs: the whole cast moves around town as the day goes on.</div>`,
      [{ label: 'GOT IT', gold: true }]);
  }

  toSelect() {
    showScreen('select');
    this.select = new SelectScreen(this);
  }

  enterWorld(charId, opts = {}) {
    this.save.char = charId;
    writeSave(this.save);
    showScreen('world');
    document.getElementById('hud').style.display = '';
    if (this.world) this.world.dispose();
    sfx.ensure();
    sfx.setMusic('town');
    const holder = document.getElementById('world-holder');
    holder.innerHTML = '';
    this.world = new World(holder, this.save, {
      onSave: () => {
        this.save.maxLevel = Math.max(this.save.maxLevel || 1, this.save.level || 1);
        writeSave(this.save);
      },
      onStoryComplete: () => this.storyComplete(),
    });
    this.world.hud.setCoins(this.save.coins);
    this.world.hud.setHealth(1);
    this.world.hud.setStars(0);
    if (!this.loopRunning) {
      this.loopRunning = true;
      const loop = () => {
        requestAnimationFrame(loop);
        if (this.world && document.getElementById('scr-world').classList.contains('active')) this.world.update();
      };
      loop();
    }
    if (opts.story) this.world.beginStory();
    else if (opts.level) this.world.beginLevel(opts.level);
    else if (this.save.mode === 'free') {
      this.world.hud.toast(`${charSpec(charId).short} — FREE ROAM`);
    } else {
      const lvl = levelById(this.save.level || 1);
      if (lvl) this.world.hud.toast(`${lvl.card} — ${lvl.name}`);
    }
    writeSave(this.save);
  }

  storyComplete() {
    modal(`
      <h3>THAT'S THE SHOW</h3>
      <div class="m-sub">QUAHOG HIT &amp; RUN — STORY COMPLETE</div>
      <p>The brewery is drained, the chicken is in a crate and everybody in town has
      stopped clucking. Mostly.</p>
      <div class="m-note">Free Roam is now open with all six Griffins, and every level can be
      replayed from Level Select — there are still collectibles and cutaway gags out there.</div>`,
      [{ label: 'FREEKIN SWEET', gold: true }]);
    this.save.unlocked = [...PLAYABLE];
    writeSave(this.save);
  }

  bindWorldUi() {
    const pause = document.getElementById('pause');
    const map = document.getElementById('map-overlay');
    window.addEventListener('keydown', (e) => {
      if (!this.world || !document.getElementById('scr-world').classList.contains('active')) return;
      if (document.getElementById('modal').classList.contains('show')) return;
      if (e.code === 'Escape') {
        if (map.classList.contains('show')) { map.classList.remove('show'); this.world.paused = false; return; }
        this.togglePause();
      } else if (e.code === 'KeyM') {
        if (this.world.director.active) return;
        const on = !map.classList.contains('show');
        map.classList.toggle('show', on);
        this.world.paused = on;
        if (on) this.world.openMap();
      } else if (e.code === 'KeyN') {
        sfx.setMuted(!sfx.muted);
      }
    });
    document.getElementById('map-close').onclick = () => {
      map.classList.remove('show');
      this.world.paused = false;
    };
    document.getElementById('pause-resume').onclick = () => this.togglePause(false);
    document.getElementById('pause-exit').onclick = () => {
      writeSave(this.save);
      this.togglePause(false);
      sfx.stopEngine();
      sfx.setMusic('menu');
      showScreen('title');
      this.bindTitle();
    };
    document.getElementById('pause-switch').onclick = () => {
      writeSave(this.save);
      this.togglePause(false);
      if (this.save.mode === 'free') this.toSelect();
      else modal(`<h3>NOT IN THE STORY</h3>
        <p>Each level has its own Griffin. Finish this level to move on to the next one —
        or start <b>Free Roam</b> from the title screen and play as anybody.</p>`,
        [{ label: 'FAIR ENOUGH', gold: true }]);
    };
    document.getElementById('pause-jobs').onclick = () => this.jobBoard();
    document.querySelector('.pause-keys').innerHTML =
      'WASD move · SHIFT sprint · SPACE jump/handbrake · E car · G talk/job/gag · F swing · R special<br/>'
      + 'M map · X abandon job · Z/C camera · N mute · ESC pause';
  }

  togglePause(force) {
    const pause = document.getElementById('pause');
    const on = force === undefined ? !pause.classList.contains('show') : force;
    pause.classList.toggle('show', on);
    if (this.world) this.world.paused = on;
    if (on) {
      const s = this.save;
      const lvl = levelById(s.level || 1);
      const prog = storyProgress(s);
      const found = (s.found[s.level] || []).length;
      document.getElementById('pause-stats').innerHTML = `
        <div>${s.mode === 'free' ? 'FREE ROAM' : lvl ? lvl.card + ' — ' + lvl.name : 'STORY COMPLETE'}</div>
        <div>PLAYING AS <b>${charSpec(s.char).short}</b> · DAY ${s.day + 1}</div>
        <div>CLAMS <b>${s.coins.toLocaleString()}</b></div>
        <div>STORY <b>${prog.done}/${prog.total}</b> · THIS LEVEL <b>${found}/${lvl ? lvl.collectible.n : 7} ${lvl ? lvl.collectible.name.toUpperCase() : ''}</b></div>
        <div>CUTAWAY GAGS <b>${s.gags.length}/${GAGS.length}</b></div>`;
      writeSave(this.save);
    }
  }

  jobBoard() {
    const s = this.save;
    const rows = LEVELS.map((l) => {
      const done = l.missions.filter((m) => s.done.includes(m.id)).length;
      const found = (s.found[l.id] || []).length;
      const locked = l.id > (s.maxLevel || 1);
      const next = availableIn(l.id, s)[0];
      return `<div class="job-row" style="margin:6px 0">
        <b style="min-width:120px">${locked ? 'LEVEL ' + l.id : l.card}</b>
        <span style="flex:1">${locked ? 'Not reached yet'
          : next ? `NEXT: ${next.title} — ${next.desc}`
          : '<span class="done-tick">Level complete ✔</span>'}</span>
        <b>${done}/${l.missions.length} · ${found}/${l.collectible.n}</b>
      </div>`;
    }).join('');
    modal(`
      <h3>THE JOB BOARD</h3>
      <div class="m-sub">SEVEN LEVELS · ONE GRIFFIN EACH · NOBODY ASKED FOR ANY OF IT</div>
      <div class="job-list">${rows}</div>
      <div class="m-note">Gold diamonds are story jobs — finish them all to move the story on.
      Blue diamonds are bonus jobs. Blue squares are this level's collectibles.</div>`,
      [{ label: 'BACK', gold: true }]);
  }
}

// ------------------------------------------------------------------- boot
const params = new URLSearchParams(location.search);

if (params.has('cast')) {
  const { castGallery } = await import('./gallery.js');
  castGallery();
} else if (params.has('city')) {
  const { cityPreview } = await import('./gallery.js');
  cityPreview();
} else {
  const app = new App();
  window.__quahog = app;
  if (params.has('drop')) {
    // QA: straight into the world
    const who = params.get('drop');
    app.save.unlocked = [...PLAYABLE];
    app.enterWorld(PLAYABLE.includes(who) ? who : 'peter');
  } else if (params.has('select')) {
    app.toSelect();
  } else {
    // studio sting, then PRESS START, then the title
    const sting = document.getElementById('sting');
    const boot = document.getElementById('boot');
    stingArt();
    bootArt();
    showScreen('title');
    sting.classList.add('show');
    setTimeout(() => {
      sting.classList.remove('show');
      boot.classList.add('show');
    }, 1900);
    const begin = () => {
      if (sting.classList.contains('show')) {
        sting.classList.remove('show');
        boot.classList.add('show');
        return;
      }
      window.removeEventListener('keydown', begin);
      boot.removeEventListener('pointerdown', begin);
      clearInterval(padPoll);
      sfx.ensure();
      sfx.setMusic('menu');
      boot.classList.remove('show');
    };
    window.addEventListener('keydown', begin);
    boot.addEventListener('pointerdown', begin);
    sting.addEventListener('pointerdown', begin);
    const padPoll = setInterval(() => {
      try {
        for (const g of navigator.getGamepads?.() || []) {
          if (g?.buttons?.some((b) => b.pressed)) { begin(); break; }
        }
      } catch { /* fine */ }
    }, 140);
  }
}
