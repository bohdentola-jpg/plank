// App shell: boot gate → title (live 3D dunk show) → THE RUN ladder /
// exhibition / couch versus. Saves run progress to the browser.
import * as THREE from 'three';
import { CREWS, crewById, runLadder, overall } from './teams.js';
import { Game, CLIPS } from './game.js';
import { buildArena, updateArena, COURT } from './arena.js';
import { makeKit, buildPlayer, buildBall } from './playerModel.js';
import { Animator } from './animation.js';
import { sfx } from './audio.js';
import { PadUI } from './padui.js';
import { pads } from './gamepad.js';
import { mkCanvas } from './util.js';

const SAVE_KEY = 'rimcity_save_v1';

function loadRun() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d.crewId) return null;
    return d;
  } catch { return null; }
}
function saveRun(run) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(run)); } catch { /* private mode */ }
}
function clearRun() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* fine */ }
}

// ------------------------------------------------------------------ logo
export function rimCityLogoCanvas(w = 1200, h = 420) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center';
  // flame glow backdrop
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.5);
  glow.addColorStop(0, 'rgba(255,110,20,0.32)');
  glow.addColorStop(1, 'rgba(255,110,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const word = (text, y, size) => {
    ctx.save();
    ctx.translate(w * 0.5, y);
    ctx.transform(1, 0, -0.14, 1, 0, 0);
    ctx.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
    const grad = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.42);
    grad.addColorStop(0, '#fff3c8');
    grad.addColorStop(0.42, '#ffb01f');
    grad.addColorStop(0.55, '#c2440c');
    grad.addColorStop(0.72, '#ff7a1f');
    grad.addColorStop(1, '#ffd24a');
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0c0405';
    ctx.lineWidth = size * 0.085;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = grad;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  word('RIM CITY', h * 0.52, h * 0.46);
  // tag bar
  ctx.fillStyle = '#f2b705';
  const bw = w * 0.52, bh = h * 0.115;
  ctx.save();
  ctx.translate(w * 0.5, h * 0.76);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#16100a';
  ctx.font = `900 ${bh * 0.62}px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillText('2-ON-2 · NO REFS · NO MERCY', 0, bh * 0.22);
  ctx.restore();
  return cv;
}

// ------------------------------------------------------------------ shell
const screens = ['title', 'select', 'ladder', 'game'];
function showScreen(id) {
  for (const s of screens) {
    document.getElementById(`scr-${s}`).classList.toggle('active', s === id);
  }
}

class App {
  constructor() {
    this.current = null;
    this.run = loadRun();
    this.titleMusic = null;
    this.bindTitle();
  }

  swap(thing) {
    if (this.current?.dispose) this.current.dispose();
    this.current = thing;
  }

  stopMusic() {
    this.titleMusic?.stop();
    this.titleMusic = null;
  }

  toTitle() {
    this.swap(null);
    showScreen('title');
    this.bindTitle();
  }

  bindTitle() {
    const logo = document.getElementById('title-logo');
    if (logo && !logo.src) logo.src = rimCityLogoCanvas().toDataURL();
    const run = this.run = loadRun();
    const tRun = document.getElementById('t-run');
    tRun.innerHTML = run
      ? (run.champion
        ? '👑 THE RUN — CHAMPIONS · RUN IT BACK'
        : `🔥 CONTINUE THE RUN — GAME ${run.rung + 1} OF 9 (${crewById(run.crewId).name})`)
      : '🔥 THE RUN — NINE CREWS. ONE CROWN.';
    tRun.onclick = () => {
      sfx.ensure(); sfx.chime();
      if (run && run.champion) { clearRun(); this.run = null; }
      if (this.run) this.toLadder();
      else this.toSelect('PICK YOUR CREW', (crew) => {
        this.run = { crewId: crew.id, rung: 0, champion: false };
        saveRun(this.run);
        this.toLadder();
      });
    };
    document.getElementById('t-quick').onclick = () => {
      sfx.ensure(); sfx.chime();
      this.toSelect('PICK YOUR CREW', (mine) => {
        this.toSelect('PICK THE OPPOSITION', (opp) => {
          this.startGame({ home: mine, away: opp, control: { home: 'p1', away: 'cpu' }, rung: 3, label: 'EXHIBITION' });
        }, mine.id);
      });
    };
    document.getElementById('t-versus').onclick = () => {
      sfx.ensure(); sfx.chime();
      this.toSelect('PLAYER 1 — PICK YOUR CREW', (p1crew) => {
        this.toSelect('PLAYER 2 — PICK YOUR CREW', (p2crew) => {
          const p2src = pads.count >= 2 ? 'p2' : 'keys2';
          this.startGame({
            home: p1crew, away: p2crew,
            control: { home: 'p1', away: p2src },
            rung: 3, label: 'VERSUS',
          });
        }, p1crew.id);
      });
    };
    if (this.run && !this.run.champion) {
      const reset = document.getElementById('t-reset');
      reset.style.display = '';
      reset.onclick = () => {
        sfx.back(); clearRun(); this.run = null;
        reset.style.display = 'none';
        this.bindTitle();
      };
    } else {
      document.getElementById('t-reset').style.display = 'none';
    }
    this.titleScene();
    if (!this.titleMusic && !new URLSearchParams(location.search).has('silent')) {
      // starts after the first user gesture (boot gate) — ctx exists by then
      if (sfx.ctx) this.titleMusic = sfx.titleLoop();
    }
  }

  // ----------------------------------------------------------- crew select
  toSelect(title, onPick, excludeId = null) {
    showScreen('select');
    this.swap(null);
    document.getElementById('select-title').textContent = title;
    const grid = document.getElementById('select-grid');
    grid.innerHTML = '';
    const bar = (label, v) => `
      <div class="cs-bar"><span>${label}</span><i><b style="width:${v}%"></b></i></div>`;
    for (const crew of CREWS) {
      if (crew.id === excludeId) continue;
      const card = document.createElement('button');
      card.className = 'crew-card';
      card.style.setProperty('--c', crew.colors.primary);
      card.style.setProperty('--c2', crew.colors.secondary);
      card.innerHTML = `
        <div class="cs-city">${crew.city}</div>
        <div class="cs-name">${crew.name}</div>
        <div class="cs-ovr">${overall(crew)} OVR</div>
        <div class="cs-players">
          ${crew.players.map((p) => `
            <div class="cs-p">
              <div class="cs-pname">“${p.nick}”<small>${p.name} · #${p.num}</small></div>
              ${bar('SPD', p.spd)}${bar('3PT', p.three)}${bar('DNK', p.dunk)}${bar('DEF', p.def)}
            </div>`).join('')}
        </div>
        <div class="cs-blurb">${crew.blurb}</div>`;
      card.onclick = () => { sfx.ensure(); sfx.chime(); onPick(crew); };
      grid.appendChild(card);
    }
    const back = document.createElement('button');
    back.className = 'menu-btn back-btn';
    back.dataset.back = '1';
    back.textContent = '◂ BACK';
    back.onclick = () => { sfx.back(); this.toTitle(); };
    grid.appendChild(back);
  }

  // ----------------------------------------------------------- THE RUN
  toLadder() {
    showScreen('ladder');
    this.swap(null);
    const run = this.run;
    const mine = crewById(run.crewId);
    const ladder = runLadder(run.crewId);
    const wrap = document.getElementById('ladder');
    wrap.innerHTML = `
      <div class="ladder-head">
        <span class="lh-crew" style="--c:${mine.colors.primary};--c2:${mine.colors.secondary}">${mine.city} ${mine.name}</span>
        <span>${run.champion ? 'KINGS OF RIM CITY' : `GAME ${run.rung + 1} OF ${ladder.length}`}</span>
      </div>`;
    ladder.forEach((crew, i) => {
      const div = document.createElement('button');
      const state = i < run.rung ? 'beaten' : i === run.rung && !run.champion ? 'next' : 'locked';
      div.className = `rung ${state}`;
      div.style.setProperty('--c', crew.colors.primary);
      div.style.setProperty('--c2', crew.colors.secondary);
      div.innerHTML = `
        <span class="rung-n">${i + 1}</span>
        <span class="rung-name">${crew.city} ${crew.name}</span>
        <span class="rung-ovr">${overall(crew)} OVR</span>
        <span class="rung-state">${state === 'beaten' ? '✔ BEATEN' : state === 'next' ? 'PLAY ▸' : '🔒'}</span>`;
      if (state === 'next') {
        div.onclick = () => {
          sfx.chime();
          this.startGame({
            home: mine, away: crew,
            control: { home: 'p1', away: 'cpu' },
            rung: i, label: `THE RUN · GAME ${i + 1} OF ${ladder.length}`,
            runMode: true,
          });
        };
      } else if (state === 'beaten') {
        div.disabled = true;
      } else {
        div.disabled = true;
      }
      wrap.appendChild(div);
    });
    if (run.champion) {
      const crown = document.createElement('div');
      crown.className = 'champ-note';
      crown.innerHTML = '👑 EVERY CREW IN THE CITY HAS TAKEN THE L. THE RIM IS YOURS.';
      wrap.appendChild(crown);
    }
    const back = document.createElement('button');
    back.className = 'menu-btn back-btn';
    back.dataset.back = '1';
    back.textContent = '◂ TITLE';
    back.onclick = () => { sfx.back(); this.toTitle(); };
    wrap.appendChild(back);
  }

  // ----------------------------------------------------------- the game
  startGame(opts) {
    this.stopMusic();
    showScreen('game');
    const runMode = opts.runMode;
    const game = new Game(document.getElementById('game-holder'), {
      ...opts,
      buttons: ({ won }) => {
        if (runMode && won) {
          const ladder = runLadder(this.run.crewId);
          const last = this.run.rung >= ladder.length - 1;
          return [[last ? '👑 CLAIM THE CROWN' : 'NEXT GAME ▸', () => {
            this.run.rung++;
            if (this.run.rung >= ladder.length) this.run.champion = true;
            saveRun(this.run);
            this.swap(null);
            this.toLadder();
          }]];
        }
        if (runMode && !won) {
          return [
            ['RUN IT BACK — REMATCH', () => { this.swap(null); this.startGame(opts); }],
            ['BACK TO THE LADDER', () => { this.swap(null); this.toLadder(); }],
          ];
        }
        return [
          ['REMATCH', () => { this.swap(null); this.startGame(opts); }],
          ['BACK TO TITLE', () => { this.swap(null); this.toTitle(); }],
        ];
      },
      onEnd: () => {},
      onExit: () => { this.swap(null); this.toTitle(); },
    });
    this.swap(game);
    window.__rim = { app: this, game };
  }

  // ----------------------------------------------------------- title scene
  titleScene() {
    const holder = document.getElementById('title-3d');
    if (!holder || holder.dataset.built) return;
    holder.dataset.built = '1';
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(holder.clientWidth, holder.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    holder.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, holder.clientWidth / holder.clientHeight, 0.1, 200);
    const ny = crewById('ny'), chi = crewById('chi');
    const arena = buildArena(scene, ny, chi);
    arena.jumbo.draw({ marquee: 'RIM CITY', marqueeColor: '#f2b705', sub: 'PRESS START' });

    const kitA = makeKit(ny.colors), kitB = makeKit(chi.colors);
    const dunker = buildPlayer(kitA, { num: 8, build: 'big', h: 2.08, look: ny.players[0].look });
    const shooter = buildPlayer(kitB, { num: 23, build: 'avg', h: 1.98, look: chi.players[0].look });
    scene.add(dunker.group, shooter.group);
    const aDunk = new Animator(dunker, CLIPS);
    const aShoot = new Animator(shooter, CLIPS);
    const ball = buildBall();
    scene.add(ball);

    // looped show: dunker runs in and hammers it, shooter drains corner threes
    let t = 0;
    const rim = new THREE.Vector3(COURT.RIM_X, COURT.RIM_Y, 0);
    shooter.group.position.set(COURT.RIM_X - 6.4, 0, -5.6);
    shooter.group.rotation.y = Math.atan2(rim.x - (COURT.RIM_X - 6.4), rim.z - (-5.6));
    const clock = new THREE.Clock();
    const CYCLE = 5.2;
    const tick = () => {
      requestAnimationFrame(tick);
      if (!document.getElementById('scr-title').classList.contains('active')) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;
      const c = t % CYCLE;
      // dunker choreography
      if (c < 1.6) {
        const u = c / 1.6;
        dunker.group.position.set(rim.x - 7.5 + u * 5.4, 0, 2.8 - u * 2.0);
        dunker.group.rotation.y = Math.atan2(rim.x - dunker.group.position.x, rim.z - dunker.group.position.z);
        aDunk.play('dribbleSprint');
        if (ball.userData.who !== 'dunker') ball.userData.who = 'dunker';
        const phase = (aDunk.t / CLIPS.dribbleSprint.dur * 2) % 1;
        ball.position.set(
          dunker.group.position.x + Math.sin(dunker.group.rotation.y + 1.2) * 0.35,
          0.12 + Math.abs(Math.cos(Math.PI * phase)) * 0.62,
          dunker.group.position.z + Math.cos(dunker.group.rotation.y + 1.2) * 0.35
        );
      } else if (c < 2.6) {
        const u = (c - 1.6) / 1.0;
        aDunk.play('dunkTomahawk');
        const peak = 1.1;
        const k = Math.min(1, u / 0.6);
        dunker.group.position.x = (rim.x - 2.1) + k * 1.55;
        dunker.group.position.z = 0.8 - k * 0.8;
        dunker.group.position.y = u < 0.6 ? peak * Math.sin((u / 0.6) * Math.PI * 0.5) : peak * (1 - ((u - 0.6) / 0.4) ** 2);
        if (u < 0.58) {
          dunker.rig?.gripR?.getWorldPosition?.(ball.position);
          // (rig handle not exposed here; approximate at the hands)
          ball.position.set(dunker.group.position.x + 0.25, dunker.group.position.y + 2.0, dunker.group.position.z);
        } else {
          ball.position.set(rim.x, COURT.RIM_Y - 0.5 - (u - 0.58) * 4, rim.z);
          if (!ball.userData.boomed) { ball.userData.boomed = true; arena.hoops[1].shake = 1; arena.hoops[1].netKick = 1; }
        }
      } else {
        aDunk.play('flex');
        if (c > 4.9) { ball.userData.boomed = false; }
        const u = Math.min(1, (c - 2.6) / 0.5);
        dunker.group.position.y = 0;
        // shooter takes one
        const sc = (c - 2.6) / 2.6;
        if (sc < 0.3) aShoot.play('shootUp');
        else if (sc < 0.65) aShoot.play('shootRelease');
        else aShoot.play('idle');
        if (sc > 0.32 && sc < 0.95) {
          const su = (sc - 0.32) / 0.63;
          const p0 = new THREE.Vector3(COURT.RIM_X - 6.4, 2.1, -5.6);
          ball.position.lerpVectors(p0, rim, su);
          ball.position.y = (1 - su) * (1 - su) * p0.y + 2 * (1 - su) * su * (COURT.RIM_Y + 1.4) + su * su * rim.y;
          if (su > 0.98) arena.hoops[1].netKick = 1;
        }
      }
      ball.rotation.x += dt * 6;
      updateArena(arena, t, dt, 0.55);
      const a = t * 0.11;
      cam.position.set(rim.x - 7 + Math.sin(a) * 4.2, 3.4 + Math.sin(t * 0.3) * 0.5, 10.5 + Math.cos(a) * 2.5);
      cam.lookAt(rim.x - 2.5, 2.2, 0);
      if (holder.clientWidth && renderer.domElement.width !== Math.round(holder.clientWidth * renderer.getPixelRatio())) {
        cam.aspect = holder.clientWidth / holder.clientHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(holder.clientWidth, holder.clientHeight);
      }
      renderer.render(scene, cam);
    };
    tick();
    window.addEventListener('resize', () => {
      if (!holder.clientWidth) return;
      cam.aspect = holder.clientWidth / holder.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(holder.clientWidth, holder.clientHeight);
    });
  }
}

// ------------------------------------------------------------------ modes
const params = new URLSearchParams(location.search);

if (params.has('gallery')) {
  galleryMode();
} else if (params.has('quick') || params.has('nointro')) {
  showScreen('title');
  const app = new App();
  window.__padui = new PadUI();
  window.__app = app;
  if (params.has('quick')) {
    const home = crewById(params.get('team') || 'ny');
    const away = crewById(params.get('opp') || 'chi');
    app.startGame({
      home, away,
      control: { home: params.has('cpu') ? 'cpu' : 'p1', away: 'cpu' },
      rung: parseInt(params.get('rung') || '3', 10),
      quarterSec: parseInt(params.get('q') || '120', 10),
      label: 'EXHIBITION',
    });
  }
} else {
  const boot = document.getElementById('boot');
  document.getElementById('boot-logo').src = rimCityLogoCanvas().toDataURL();
  boot.classList.add('show');
  const app = new App();
  const begin = () => {
    window.removeEventListener('keydown', begin);
    boot.removeEventListener('pointerdown', begin);
    clearInterval(bootPad);
    sfx.ensure();
    sfx.horn();
    boot.classList.remove('show');
    showScreen('title');
    if (!app.titleMusic) app.titleMusic = sfx.titleLoop();
  };
  window.addEventListener('keydown', begin);
  boot.addEventListener('pointerdown', begin);
  const bootPad = setInterval(() => {
    try {
      for (const g of navigator.getGamepads?.() || []) {
        if (g?.buttons?.some((b) => b.pressed)) { begin(); break; }
      }
    } catch { /* fine */ }
  }, 120);
  window.__padui = new PadUI();
  window.__app = app;
}

// ------------------------------------------------------------------ gallery
function galleryMode() {
  showScreen('game');
  document.getElementById('hud-bar').style.display = 'none';
  const holder = document.getElementById('game-holder');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(holder.clientWidth, holder.clientHeight);
  holder.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101218');
  scene.add(new THREE.HemisphereLight('#cdd6ee', '#241a10', 1.1));
  const key = new THREE.DirectionalLight('#fff2dc', 2.2);
  key.position.set(6, 10, 8);
  scene.add(key);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshPhongMaterial({ color: '#2c2419' }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const wanted = (params.get('clips') || Object.keys(CLIPS).join(',')).split(',').filter((c) => CLIPS[c]);
  const kit = makeKit({ primary: '#1b2a52', secondary: '#f08018' });
  const anims = [];
  const cols = Math.ceil(Math.sqrt(wanted.length));
  wanted.forEach((name, i) => {
    const rig = buildPlayer(kit, { num: i, build: ['slim', 'avg', 'big'][i % 3], h: 2.0, look: { skin: '#8d5a3b', hair: ['afro', 'buzz', 'hightop', 'braids'][i % 4] } });
    const x = (i % cols) * 2.2 - cols, z = Math.floor(i / cols) * 2.6 - cols;
    rig.group.position.set(x, 0, z);
    scene.add(rig.group);
    const a = new Animator(rig, CLIPS);
    a.play(name, { force: true });
    a.onDone = null;
    anims.push({ a, name, x, z });
    const cv = mkCanvas(256, 48);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f2b705';
    ctx.font = '700 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 34);
    const texm = new THREE.CanvasTexture(cv);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texm }));
    label.scale.set(1.6, 0.3, 1);
    label.position.set(x, 2.4, z);
    scene.add(label);
  });
  const cam = new THREE.PerspectiveCamera(40, holder.clientWidth / holder.clientHeight, 0.1, 100);
  const camr = parseFloat(params.get('camr') || (cols * 2.4));
  const camy = parseFloat(params.get('camy') || '3.4');
  const ang = parseFloat(params.get('ang') || '0');
  cam.position.set(Math.sin(ang) * camr, camy, Math.cos(ang) * camr);
  cam.lookAt(0, 1, 0);
  const clock = new THREE.Clock();
  const tick = () => {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    for (const { a, name } of anims) {
      a.update(dt);
      if (a.finished) a.play(name, { force: true, fade: 0.2 });
    }
    renderer.render(scene, cam);
  };
  tick();
}
