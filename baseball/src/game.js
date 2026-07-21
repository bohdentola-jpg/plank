// BIG INNING '27 — the game on the field. Arcade baseball: read the incoming
// pitch marker, time the swing, paint the corners, take the extra base.
// Cameras live where the player lives: behind the batter when you hit,
// behind the pitcher when you deal. Full pad support.
import * as THREE from 'three';
import { Animator } from './animation.js';
import { makeBBClips, PITCH_RELEASE_S, SWING_CONTACT_S, THROW_RELEASE_S } from './bbclips.js';
import {
  makeBBKit, buildBallplayer, setHeadgear, setBattingGloves, addCatcherGear,
  buildBat, buildBaseball, buildUmp,
} from './model.js';
import {
  buildBallpark, lightBallpark, basePos, wallDistFor, wallHeightFor,
  PARKS, MOUND, BASEPATH,
} from './parks.js';
import { battingOrder } from './players.js';
import { sfx } from './audio.js';
import { pads, BTN } from './gamepad.js';

export const CLIPS = makeBBClips();

export const PITCHES = [
  { id: 'four',   name: 'FOUR-SEAM', spd: 1.00, brk: [0, 0] },
  { id: 'curve',  name: 'CURVEBALL', spd: 0.80, brk: [0.05, -0.85] },
  { id: 'slider', name: 'SLIDER',    spd: 0.90, brk: [-0.55, -0.30] },
  { id: 'change', name: 'CHANGEUP',  spd: 0.76, brk: [0.12, -0.30] },
];

const ZONE = { hw: 0.33, yLo: 0.55, yHi: 1.45 };       // the strike zone at the plate
const AIM = { hw: 0.80, yLo: 0.12, yHi: 1.95 };        // how far the reticle can chase
const G = 10.7;                                         // gravity, yd/s²
const RUN_SPD = 6.6;                                    // runner speed at spd=70

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function gauss() { return (Math.random() + Math.random() + Math.random()) * 2 / 3 - 1; }

// team kits: home whites, road color
export function kitsFor(team, home) {
  const c = team.colors;
  return makeBBKit(home ? {
    jersey: '#f4f2e8', sleeve: c.primary, pants: '#f4f2e8', cap: c.primary, brim: c.secondary,
    belt: c.primary, socks: c.primary, numberFill: c.primary, numberStroke: c.secondary, style: 'classic',
  } : {
    jersey: c.primary, sleeve: c.secondary, pants: '#c9c8c0', cap: c.primary, brim: c.secondary,
    belt: c.secondary, socks: c.secondary, numberFill: '#f4f4f2', numberStroke: c.secondary, style: 'classic',
  });
}

// fielder home positions by role
const FPOS = {
  P: () => new THREE.Vector3(0, 0, MOUND),
  C: () => new THREE.Vector3(0, 0, -2.1),
  '1B': () => basePos(1).clone().add(new THREE.Vector3(2.2, 0, -1.6)),
  '2B': () => new THREE.Vector3(7.5, 0, 21),
  SS: () => new THREE.Vector3(-7.5, 0, 21),
  '3B': () => basePos(3).clone().add(new THREE.Vector3(-2.2, 0, -1.6)),
  LF: () => new THREE.Vector3(-24, 0, 50),
  CF: () => new THREE.Vector3(0, 0, 58),
  RF: () => new THREE.Vector3(24, 0, 50),
};

class Fielder {
  constructor(rig, player, role) {
    this.rig = rig;
    this.player = player;
    this.role = role;
    this.anim = new Animator(rig, CLIPS);
    this.pos = rig.group.position;
    this.home = FPOS[role]().clone();
    this.face = 0;
    this.target = this.home.clone();
    this.hasBall = false;
  }
  warp(p, face = Math.PI) {
    this.pos.copy(p);
    this.face = face;
    this.rig.group.rotation.y = face;
  }
  seek(p) { this.target.copy(p); }
  update(dt) {
    const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const spd = 5.6 + (this.player.spd - 60) * 0.035;
    if (d > 0.25) {
      const step = Math.min(d, spd * dt);
      this.pos.x += dx / d * step;
      this.pos.z += dz / d * step;
      this.face = Math.atan2(dx, dz);
      this.anim.play(d > 6 ? 'sprint' : 'run');
    } else if (!['pickup', 'throwQuick', 'catchBall', 'pitchThrow', 'pitchSet', 'crouch', 'celebrate', 'dejected'].includes(this.anim.name) || this.anim.finished) {
      this.anim.play(this.role === 'C' ? 'crouch' : this.role === 'P' ? 'pitchSet' : 'fieldReady');
      this.face = Math.atan2(-this.pos.x, -this.pos.z);
    }
    let dy = this.face - this.rig.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.rig.group.rotation.y += dy * Math.min(1, dt * 10);
    this.anim.update(dt);
  }
}

class Runner {
  constructor(rig, player) {
    this.rig = rig;
    this.player = player;
    this.anim = new Animator(rig, CLIPS);
    this.pos = rig.group.position;
    this.base = 0;
    this.to = 1;
    this.moving = false;
    this.scored = false;
    this.out = false;
    this.forced = false;
  }
  speed() { return RUN_SPD + (this.player.spd - 70) * 0.045; }
  eta() {
    if (!this.moving) return Infinity;
    const t = basePos(this.to % 4);
    return this.pos.distanceTo(t) / this.speed();
  }
  startLeg(to) {
    this.to = to;
    this.moving = true;
    this.anim.play('sprint');
  }
  update(dt) {
    if (this.moving) {
      const t = basePos(this.to % 4);
      const dx = t.x - this.pos.x, dz = t.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const step = Math.min(d, this.speed() * dt);
      if (d > 0.01) {
        this.pos.x += dx / d * step;
        this.pos.z += dz / d * step;
        this.rig.group.rotation.y = Math.atan2(dx, dz);
      }
      if (d <= 0.15) {
        this.base = this.to;
        this.moving = false;
        this.anim.play('leadoff');
      }
    } else if (!this.out && !this.scored) {
      this.anim.play('leadoff');
      const nxt = basePos((this.base + 1) % 4);
      this.rig.group.rotation.y = Math.atan2(nxt.x - this.pos.x, nxt.z - this.pos.z);
    }
    this.anim.update(dt);
  }
}

export class BBGame {
  /**
   * opts: {
   *   innings, userTeam: 'home'|'away'|null (null = CPU vs CPU),
   *   park: PARKS entry, turbo (QA),
   *   mode: 'full' | 'pa',
   *   pa: { outs, bases: [b,b,b], batter, pitcher, inning },
   *   onGameEnd({home, away, won, line}), onPaEnd(result), onRematch, onExit,
   * }
   */
  constructor(container, home, away, opts = {}) {
    this.container = container;
    this.home = home;
    this.away = away;
    this.opts = opts;
    this.mode = opts.mode || 'full';
    this.innings = opts.innings || 3;
    this.userTeam = opts.userTeam !== undefined ? opts.userTeam : 'home';
    this.park = opts.park || PARKS[0];

    // ---------- renderer / scene
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(lightBallpark(this.scene, this.park));
    this.parkView = buildBallpark(this.scene, this.park, home);
    this.camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 500);
    this._camPos = new THREE.Vector3(0, 2.7, -7.2);
    this._camLook = new THREE.Vector3(0, 1.4, MOUND);
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);

    // ---------- kits, rig pools
    this.kits = { home: kitsFor(home, true), away: kitsFor(away, false) };
    this._rigCache = new Map();
    this.ballGroup = buildBaseball();
    this.scene.add(this.ballGroup);
    this.bat = buildBat();
    this.scene.add(this.bat);
    this.bat.visible = false;
    this.ump = buildUmp();
    this.ump.group.position.set(0, 0, -3.1);
    setHeadgear(this.ump, 'cap');
    this.scene.add(this.ump.group);
    this.umpAnim = new Animator(this.ump, CLIPS);
    this.umpAnim.play('fieldReady');

    // ---------- match state
    this.score = { home: 0, away: 0 };
    this.inning = opts.pa?.inning || 1;
    this.top = true;
    this.outs = 0;
    this.balls = 0;
    this.strikes = 0;
    this.orders = { home: battingOrder(home), away: battingOrder(away) };
    this.orderIdx = { home: 0, away: 0 };
    this.fielders = [];
    this.runners = [];
    this.batterRunner = null;
    this.line = { hits: 0, hr: 0, oppHits: 0 };
    this.paResult = null;

    this.phase = 'boot';
    this.t = 0;
    this._timers = [];
    this.aim = { x: 0, y: 1.0 };
    this.pitchSel = 0;
    this.ball = { state: 'dead' };
    this.disposed = false;
    this.padSeen = false;

    // ---------- hud handles
    this.hud = {
      bar: document.getElementById('bb-bar'),
      count: document.getElementById('bb-count'),
      bases: document.getElementById('bb-bases'),
      banner: document.getElementById('hud-banner'),
      zone: document.getElementById('bb-zone'),
      reticle: document.getElementById('bb-reticle'),
      mark: document.getElementById('bb-mark'),
      incoming: document.getElementById('bb-incoming'),
      pitchmenu: document.getElementById('bb-pitchmenu'),
      throwmenu: document.getElementById('bb-throwmenu'),
      hint: document.getElementById('bb-hint'),
      matchup: document.getElementById('matchup'),
      final: document.getElementById('final'),
      pause: document.getElementById('pause'),
    };

    this._onKey = (e) => this.onKey(e);
    this._onMouse = (e) => this.onMouse(e);
    this._onClick = (e) => this.onClick(e);
    this._onCtx = (e) => { e.preventDefault(); this.onSwing(true); };
    this._onResize = () => {
      if (!container.clientWidth) return;
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('resize', this._onResize);
    this.renderer.domElement.addEventListener('pointermove', this._onMouse);
    this.renderer.domElement.addEventListener('pointerdown', this._onClick);
    this.renderer.domElement.addEventListener('contextmenu', this._onCtx);

    this.clock = new THREE.Clock();
    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0); // z = 0

    if (this.mode === 'pa') {
      this.top = false; // your club takes the home slot in PA mode
      this.outs = opts.pa.outs || 0;
    }
    this.showMatchup();
    this.loop();
  }

  // -------------------------------------------------------------- helpers
  after(s, fn) { this._timers.push({ at: this.t + s, fn }); }
  runTimers() {
    for (const tm of [...this._timers]) {
      if (this.t >= tm.at) {
        this._timers.splice(this._timers.indexOf(tm), 1);
        tm.fn();
      }
    }
  }

  battingTeamKey() { return this.top ? 'away' : 'home'; }
  fieldingTeamKey() { return this.top ? 'home' : 'away'; }
  battingTeam() { return this.top ? this.away : this.home; }
  fieldingTeam() { return this.top ? this.home : this.away; }
  userIsBatting() { return this.mode === 'pa' ? true : this.userTeam === this.battingTeamKey(); }
  userIsFielding() { return this.mode === 'pa' ? false : this.userTeam === this.fieldingTeamKey(); }

  rigFor(player, teamKey) {
    const key = teamKey + ':' + (player.name || 'x') + player.num;
    if (!this._rigCache.has(key)) {
      const rig = buildBallplayer(this.kits[teamKey], {
        num: player.num, build: player.build, skin: player.skin,
        look: player.look || {}, bats: player.bats, throws: 'R',
        gloveColor: this.kits[teamKey].u.sleeve,
      });
      setHeadgear(rig, 'cap');
      this.scene.add(rig.group);
      rig.group.visible = false;
      this._rigCache.set(key, rig);
    }
    return this._rigCache.get(key);
  }

  banner(main, sub = '', cls = '', ms = 1900) {
    const b = this.hud.banner;
    b.querySelector('.main').textContent = main;
    b.querySelector('.sub').textContent = sub;
    b.className = 'show ' + cls;
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => { b.className = ''; }, ms);
  }

  updateHud() {
    const abbr = (t) => t.mascot.toUpperCase().slice(0, 8);
    this.hud.bar.innerHTML = `
      <span class="chip" style="background:${this.away.colors.primary}">${abbr(this.away)} ${this.score.away}</span>
      <span class="chip" style="background:${this.home.colors.primary}">${abbr(this.home)} ${this.score.home}</span>`;
    this.hud.count.innerHTML = `
      <b>${this.top ? '▲' : '▼'} ${this.inning}</b>
      <span>${this.balls}-${this.strikes}</span>
      <span class="outs">${'●'.repeat(this.outs)}${'○'.repeat(Math.max(0, 3 - this.outs))}</span>`;
    const occ = [1, 2, 3].map((b) => this.runners.some((r) => !r.out && !r.scored && ((r.moving && r.to === b) || (!r.moving && r.base === b))));
    this.hud.bases.innerHTML = `
      <i class="b2 ${occ[1] ? 'on' : ''}"></i>
      <i class="b3 ${occ[2] ? 'on' : ''}"></i>
      <i class="b1 ${occ[0] ? 'on' : ''}"></i>`;
    this.parkView.scoreboard.draw({
      homeName: this.home.mascot, awayName: this.away.mascot,
      hr: this.score.home, ar: this.score.away,
      inning: this.inning, top: this.top, outs: this.outs,
      primary: this.home.colors.primary,
    });
  }

  hint(html) { this.hud.hint.innerHTML = html || ''; }
  padHint(keyboard, pad) { this.hint(pads.p1.connected ? pad : keyboard); }

  // -------------------------------------------------------------- matchup → play ball
  showMatchup() {
    const m = this.hud.matchup;
    m.innerHTML = `
      <div class="mu-week">${this.opts.label || (this.mode === 'pa' ? 'YOUR AT-BAT' : 'SUMMER LEAGUE BASEBALL')} · ${this.park.name.toUpperCase()}</div>
      <div class="mu-teams">
        <div class="mu-team" style="border-color:${this.away.colors.primary}">
          <div class="mu-name">${this.away.name}</div>
          <div class="mu-mascot" style="color:${this.away.colors.secondary}">${this.away.mascot.toUpperCase()}</div>
        </div>
        <div class="mu-at">@</div>
        <div class="mu-team" style="border-color:${this.home.colors.primary}">
          <div class="mu-name">${this.home.name}</div>
          <div class="mu-mascot" style="color:${this.home.colors.secondary}">${this.home.mascot.toUpperCase()}</div>
        </div>
      </div>
      <div class="mu-sub">PLAY BALL</div>`;
    m.classList.add('show');
    sfx.crowd(0.7);
    this.after(1.6, () => {
      m.classList.remove('show');
      this.setupHalf();
    });
  }

  // -------------------------------------------------------------- inning setup
  setupHalf() {
    for (const r of this.runners) r.rig.group.visible = false;
    this.runners = [];
    this.batterRunner = null;
    this.outs = this.mode === 'pa' ? (this.opts.pa.outs || 0) : 0;

    for (const f of this.fielders) f.rig.group.visible = false;
    this.fielders = [];
    const fteamKey = this.fieldingTeamKey();
    const fteam = this.fieldingTeam();
    const starters = fteam.roster.filter((p) => !p.role);
    for (const role of Object.keys(FPOS)) {
      const player = (this.mode === 'pa' && role === 'P' && this.opts.pa.pitcher)
        ? this.opts.pa.pitcher
        : starters.find((p) => p.pos === role) || starters[0];
      const rig = this.rigFor(player, fteamKey);
      rig.group.visible = true;
      setHeadgear(rig, 'cap');
      setBattingGloves(rig, false);
      if (role === 'C' && !rig.catcherGear) addCatcherGear(rig, this.kits[fteamKey]);
      if (rig.catcherGear) for (const g of rig.catcherGear) g.visible = role === 'C';
      const f = new Fielder(rig, player, role);
      f.warp(f.home, Math.atan2(-f.home.x, -f.home.z));
      this.fielders.push(f);
    }
    this.pitcher = this.fielders.find((f) => f.role === 'P');
    this.catcher = this.fielders.find((f) => f.role === 'C');

    if (this.mode === 'pa') {
      (this.opts.pa.bases || []).forEach((occ, i) => {
        if (!occ) return;
        const base = i + 1;
        const ghost = { name: 'Runner', num: 44 + base, build: 'avg', skin: '#a16a45', spd: 72, bats: 'R' };
        const r = new Runner(this.rigFor(ghost, this.battingTeamKey()), ghost);
        r.rig.group.visible = true;
        setHeadgear(r.rig, 'helmet');
        r.base = base;
        r.pos.copy(basePos(base));
        this.runners.push(r);
      });
    }
    this.nextBatter();
  }

  nextBatter() {
    this.balls = 0;
    this.strikes = 0;
    this.paOutcome = null;
    const bteamKey = this.battingTeamKey();
    let player;
    if (this.mode === 'pa') {
      player = this.opts.pa.batter;
    } else {
      const order = this.orders[bteamKey];
      player = order[this.orderIdx[bteamKey] % order.length];
    }
    this.batterPlayer = player;
    const rig = this.rigFor(player, bteamKey);
    rig.group.visible = true;
    setHeadgear(rig, 'helmet');
    setBattingGloves(rig, true);
    this.batterRig = rig;
    this.batterAnim = new Animator(rig, CLIPS);
    this.lefty = player.bats === 'L';
    const bx = this.lefty ? 0.95 : -0.95;
    rig.group.position.set(bx, 0, -0.15);
    rig.group.rotation.y = this.lefty ? -Math.PI / 2 : Math.PI / 2;
    this.batterAnim.play(this.lefty ? 'batStanceL' : 'batStance');
    this.bat.visible = true;
    this.swung = false;
    this.updateHud();
    if (this.userIsBatting()) {
      this.padHint(
        `<b>${player.name}</b> ${player.pos} · AIM mouse — <b>CLICK</b> swing · <b>RIGHT-CLICK</b> power · <b>A</b> send runners / <b>S</b> hold`,
        `<b>${player.name}</b> ${player.pos} · 🎮 STICK aims — <b>✕</b> swing · <b>□</b> power · <b>R1</b> send runners / <b>L1</b> hold`
      );
    }
    this.toPitchCall();
  }

  // -------------------------------------------------------------- pitch call
  toPitchCall() {
    this.phase = 'pitchcall';
    this.ball.state = 'dead';
    this.swung = false;
    this.whiffed = false;
    this.earlyWhiff = false;
    this.foulTip = false;
    this.batted = null;
    this.ballGroup.visible = false;
    this.pitcher.warp(FPOS.P(), Math.PI);
    this.pitcher.anim.play('pitchSet');
    this.hud.mark.style.display = 'none';
    this.hud.incoming.style.display = 'none';
    if (this.userIsFielding()) {
      this.showPitchMenu();
      this.padHint(
        `<b>1-4</b> pick a pitch · AIM with the mouse · <b>CLICK / SPACE</b> deal`,
        `🎮 <b>D-PAD</b> picks the pitch · <b>STICK</b> aims · <b>✕</b> deals`
      );
    } else {
      this.hud.pitchmenu.classList.remove('show');
      this.cpuPitch = {
        type: PITCHES[(Math.random() * PITCHES.length) | 0],
        target: this.cpuPickTarget(),
      };
      this.after(0.9 + Math.random() * 0.8, () => this.throwPitch(this.cpuPitch.type, this.cpuPitch.target));
    }
    this.hud.zone.style.display = 'block';
  }

  cpuPickTarget() {
    const behind = this.balls >= 2;
    const edge = behind ? 0.55 : 0.95;
    const tx = (Math.random() < 0.5 ? -1 : 1) * ZONE.hw * edge * Math.random();
    const ty = ZONE.yLo + (ZONE.yHi - ZONE.yLo) * (0.5 + gauss() * 0.45 * edge);
    return { x: clamp(tx, -AIM.hw, AIM.hw), y: clamp(ty, AIM.yLo, AIM.yHi) };
  }

  showPitchMenu() {
    const m = this.hud.pitchmenu;
    m.innerHTML = PITCHES.map((p, i) => `
      <button data-i="${i}" class="${i === this.pitchSel ? 'on' : ''}">
        <b>${i + 1}</b> ${p.name}
      </button>`).join('');
    m.classList.add('show');
    m.querySelectorAll('button').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); this.pitchSel = +b.dataset.i; this.showPitchMenu(); };
    });
  }

  throwPitch(type, target) {
    if (this.phase !== 'pitchcall') return;
    this.phase = 'pitch';
    this.hud.pitchmenu.classList.remove('show');
    const P = this.pitcher.player;
    const wild = (0.09 + (1 - (P.ctrl || 70) / 99) * 0.30);
    const cross = {
      x: clamp(target.x + gauss() * wild, -AIM.hw, AIM.hw),
      y: clamp(target.y + gauss() * wild, AIM.yLo, AIM.yHi),
    };
    const speed = (26 + (P.velo || 70) * 0.16) * type.spd;
    const release = new THREE.Vector3(0.25, 1.78, MOUND - 1.3);
    const dist = release.z;
    this.pitch = {
      type, release, cross, speed,
      dur: dist / speed,
      t0: null,
      brk: new THREE.Vector2(type.brk[0] * (0.7 + (P.brk || 70) / 200), type.brk[1] * (0.7 + (P.brk || 70) / 200)),
    };
    this.pitcher.anim.play('pitchThrow', { force: true });
    this.after(PITCH_RELEASE_S, () => {
      this.pitch.t0 = this.t;
      this.ball.state = 'pitch';
      this.ballGroup.visible = true;
      sfx.hike();
      if (!this.userIsBatting()) this.cpuBatterPlan();
    });
  }

  cpuBatterPlan() {
    const b = this.batterPlayer;
    const c = this.pitch.cross;
    const inZone = Math.abs(c.x) < ZONE.hw && c.y > ZONE.yLo && c.y < ZONE.yHi;
    const near = Math.abs(c.x) < ZONE.hw + 0.22 && c.y > ZONE.yLo - 0.2 && c.y < ZONE.yHi + 0.2;
    const pSwing = inZone ? 0.86 : near ? 0.24 : 0.04;
    if (Math.random() > pSwing) return;
    const sigma = 0.030 + (1 - b.con / 99) * 0.045;
    const err = gauss() * sigma;
    const power = b.pow > 78 && Math.random() < 0.4;
    this.after(Math.max(0.05, this.pitch.dur - SWING_CONTACT_S + err), () => {
      this.cpuAim = {
        x: c.x + gauss() * (0.055 + (1 - b.con / 99) * 0.16),
        y: c.y + gauss() * (0.055 + (1 - b.con / 99) * 0.15),
      };
      this.doSwing(power, this.cpuAim, err);
    });
  }

  // -------------------------------------------------------------- swings
  onSwing(power) {
    if (!this.userIsBatting()) return;
    if (this.phase !== 'pitch' && this.phase !== 'pitchcall') return;
    this.doSwing(power, { ...this.aim });
  }

  doSwing(power, aimAt, cpuErr = null) {
    if (this.swung || this.phase === 'live') return;
    this.swung = true;
    this.swingPower = power;
    this.swingAim = aimAt;
    this.swingT = this.t;
    this.swingErr = cpuErr;
    this.batterAnim.play(this.lefty ? 'swingL' : 'swing', { force: true, rate: power ? 0.92 : 1.05 });
    this.after(SWING_CONTACT_S, () => this.resolveContact());
  }

  resolveContact() {
    if (this.ball.state !== 'pitch' || this.pitch.t0 == null) {
      this.earlyWhiff = true;
      return;
    }
    // timing error from when the swing STARTED, not when this timer fired —
    // timers quantize to frames and would read every swing as late
    const dt = this.swingErr != null
      ? this.swingErr
      : (this.swingT + SWING_CONTACT_S) - (this.pitch.t0 + this.pitch.dur);
    const c = this.pitch.cross;
    const aim = this.swingAim;
    const dx = aim.x - c.x, dy = aim.y - c.y;
    const d = Math.hypot(dx, dy);
    const b = this.batterPlayer;
    const conF = b.con / 99;
    const reach = 0.30 + conF * 0.16 - (this.swingPower ? 0.06 : 0);
    const timeOk = Math.abs(dt) < 0.115 + conF * 0.035;

    if (d > reach || !timeOk) {
      this.whiffed = true;
      return;
    }
    const quality = (1 - d / reach) * (1 - Math.abs(dt) / 0.15);
    if (quality < 0.16) {
      // got a piece of it — straight back to the screen
      this.whiffed = false;
      this.foulTip = true;
      return;
    }
    this.contactBall(quality, dt, dx, dy);
  }

  contactBall(quality, dt, dx, dy) {
    const b = this.batterPlayer;
    const powF = (b.pow / 99) * (this.swingPower ? 1.18 : 0.92);
    this.ball.state = 'hit';
    this.phase = 'live';
    this.hud.zone.style.display = 'none';
    this.hud.incoming.style.display = 'none';
    sfx.thud();
    sfx.crowd(0.8);

    const exit = 15 + 33 * quality * (0.55 + powF * 0.75) + gauss() * 2;
    let la = 10 - dy * 95 + gauss() * 8 + (this.swingPower ? 6 : 0);   // undercut lifts it
    la = clamp(la, -12, 55);
    const pullDir = this.lefty ? 1 : -1;                               // early swings pull
    let ha = pullDir * (-dt) * 5.2 + dx * 1.4 + gauss() * 0.16;
    ha = clamp(ha, -0.85, 0.85);
    const foulBias = quality < 0.3 ? gauss() * 0.5 : 0;
    ha += foulBias;

    const laR = la * Math.PI / 180;
    const v = new THREE.Vector3(
      Math.sin(ha) * Math.cos(laR),
      Math.sin(laR),
      Math.cos(ha) * Math.cos(laR)
    ).multiplyScalar(exit);
    const p0 = new THREE.Vector3(this.pitch.cross.x, Math.max(0.4, this.pitch.cross.y), 0.1);
    this.launchBattedBall(p0, v);
  }

  /** Simulate the full trajectory now; play it back in real time. */
  launchBattedBall(p0, v0) {
    const samples = [];
    const p = p0.clone(), v = v0.clone();
    let t = 0, bounces = 0, landed = null, hrAt = null, wallBounce = false;
    const dt = 0.02;
    for (let i = 0; i < 700; i++) {
      p.addScaledVector(v, dt);
      v.y -= G * dt;
      // quadratic air drag — tuned so ~50yd/s off the bat just clears center
      v.multiplyScalar(Math.max(0, 1 - 0.008 * v.length() * dt));
      if (p.y <= 0.12) v.multiplyScalar(Math.max(0, 1 - 1.1 * dt)); // rolling friction
      t += dt;
      const ang = Math.atan2(p.x, p.z);
      if (Math.abs(ang) <= Math.PI / 4 + 0.02 && p.z > 4) {
        const r = Math.hypot(p.x, p.z);
        const cang = clamp(ang, -Math.PI / 4, Math.PI / 4);
        const wd = wallDistFor(this.park, cang);
        if (r >= wd && !hrAt) {
          if (p.y > wallHeightFor(this.park, cang)) {
            hrAt = { t, pos: p.clone(), bounced: bounces > 0 };
            samples.push({ t, p: p.clone() });
            break;
          } else {
            const n = new THREE.Vector3(-Math.sin(ang), 0, -Math.cos(ang));
            const vn = v.dot(n);
            if (vn < 0) v.addScaledVector(n, -1.6 * vn);
            v.multiplyScalar(0.55);
            wallBounce = true;
          }
        }
      }
      if (p.y <= 0.05 && v.y < 0) {
        if (!landed) landed = { t, pos: p.clone() };
        bounces++;
        p.y = 0.05;
        v.y = -v.y * 0.4;
        v.x *= 0.72;
        v.z *= 0.72;
        if (v.length() < 1.4) { samples.push({ t, p: p.clone() }); break; }
      }
      samples.push({ t, p: p.clone() });
    }
    this.batted = {
      samples,
      t0: this.t,
      landed,
      hr: hrAt ? { ...hrAt, bounced: bounces > 0 } : null,
      wallBounce,
      final: samples[samples.length - 1],
      fielded: false,
    };
    const ref = landed || { pos: samples[samples.length - 1].p };
    const fa = Math.atan2(ref.pos.x, Math.max(0.01, ref.pos.z));
    this.batted.foul = Math.abs(fa) > Math.PI / 4 + 0.01 || ref.pos.z < 0;
    this.beginLivePlay();
  }

  // -------------------------------------------------------------- live ball
  beginLivePlay() {
    const bb = this.batted;
    if (bb.foul) {
      this.after(Math.min(1.4, bb.landed ? bb.landed.t : 1.2), () => {
        sfx.whistle();
        this.banner('FOUL BALL', '', '', 1200);
        if (this.strikes < 2) this.strikes++;
        this.ball.state = 'dead';
        this.updateHud();
        this.after(0.9, () => this.toPitchCall());
      });
      return;
    }

    const br = new Runner(this.batterRig, this.batterPlayer);
    br.pos.copy(this.batterRig.group.position);
    br.startLeg(1);
    br.forced = true;
    this.batterRunner = br;
    this.runners.push(br);
    this.bat.visible = false;

    // force chain
    let force = true;
    for (let b = 1; b <= 3 && force; b++) {
      const r = this.runners.find((rr) => rr !== br && !rr.out && !rr.scored && rr.base === b && !rr.moving);
      if (r) { r.forced = true; r.startLeg(b + 1); force = true; } else force = false;
    }

    if (bb.hr && !bb.hr.bounced && !bb.wallBounce) {
      this.after(bb.hr.t, () => this.homeRun());
      return;
    }
    if (bb.hr && (bb.hr.bounced || bb.wallBounce)) {
      this.after(bb.hr.t + 0.3, () => this.groundRuleDouble());
      return;
    }

    this.planFielding();
    this.after(0.35, () => this.runnersRead());
    if (this.userIsBatting() && this.mode !== 'pa') {
      this.padHint(`<b>A</b> send the runners · <b>S</b> hold up`, `🎮 <b>R1</b> send the runners · <b>L1</b> hold up`);
    }
  }

  planFielding() {
    const bb = this.batted;
    let best = null, bestT = Infinity, intercept = null;
    const INFIELD = ['P', 'C', '1B', '2B', '3B', 'SS'];
    for (const f of this.fielders) {
      if (f.role === 'P' && bb.landed && bb.landed.t > 1.4) continue;
      const quickHands = INFIELD.includes(f.role);
      for (const s of bb.samples) {
        if (s.p.y > 2.1) continue;
        const need = f.pos.distanceTo(new THREE.Vector3(s.p.x, 0, s.p.z));
        // infielders get a first-step burst on balls hit near them
        const spd = quickHands && s.t <= 1.5 ? 7.2 : 5.6 + (f.player.spd - 60) * 0.035;
        const reach = (quickHands ? 0.15 : 0.3) + need / spd;
        if (reach <= s.t && s.t < bestT) {
          bestT = s.t;
          best = f;
          intercept = s;
          break;
        }
      }
    }
    if (!best) {
      const fin = this.batted.final;
      let near = this.fielders[0], nd = Infinity;
      for (const f of this.fielders.filter((x) => x.role !== 'C')) {
        const d = f.pos.distanceTo(fin.p);
        if (d < nd) { nd = d; near = f; }
      }
      best = near;
      const spd = 5.6 + (best.player.spd - 60) * 0.035;
      intercept = { t: Math.max(fin.t, nd / spd + 0.3), p: fin.p };
    }
    this.chaser = best;
    this.chaseMeta = { intercept };
    best.seek(new THREE.Vector3(intercept.p.x, 0, intercept.p.z));
    const airborne = bb.landed ? intercept.t < bb.landed.t - 0.02 : true;
    this.chaseMeta.flyout = airborne && (bb.landed ? bb.landed.t : 99) > 0.85;
    // commit the play at intercept time — frame sampling can skip the window
    this.after(intercept.t, () => {
      if (this.ball.state !== 'hit' || !this.batted || this.batted.fielded) return;
      const bt = this.t - this.batted.t0;
      const S = this.batted.samples;
      let s = S[S.length - 1];
      for (let i = 0; i < S.length; i++) { if (S[i].t >= bt) { s = S[i]; break; } }
      const flat = new THREE.Vector3(s.p.x, 0, s.p.z);
      if (this.chaser.pos.distanceTo(flat) < 2.4) {
        this.chaser.pos.copy(flat);
        this.fieldedBall();
      }
    });
    // cover the bags — the pitcher takes first when the first baseman chases
    for (const f of this.fielders) {
      if (f === best) continue;
      if (f.role === '1B') f.seek(basePos(1));
      else if (f.role === 'P' && best.role === '1B') f.seek(basePos(1));
      else if (f.role === '2B' && best.role !== 'SS') f.seek(basePos(2));
      else if (f.role === 'SS') f.seek(best.role === '3B' ? basePos(3) : basePos(2));
      else if (f.role === '3B') f.seek(basePos(3));
      else if (f.role === 'C') f.seek(new THREE.Vector3(0, 0, -1.2));
    }
  }

  runnersRead() {
    const bb = this.batted;
    if (this.ball.state !== 'hit') return;
    const deep = bb.landed && Math.hypot(bb.landed.pos.x, bb.landed.pos.z) > 38;
    const veryDeep = bb.landed && Math.hypot(bb.landed.pos.x, bb.landed.pos.z) > 56;
    const willBeCaught = this.chaseMeta?.flyout;
    for (const r of this.runners) {
      if (r === this.batterRunner || r.out || r.scored) continue;
      if (r.moving) continue;
      if (willBeCaught) continue;
      const aggression = (r.player.spd - 60) / 60 + (deep ? 0.5 : 0) + (veryDeep ? 0.5 : 0);
      if (deep || aggression > 0.35 + Math.random() * 0.3) {
        if (!this.baseBlocked(r.base + 1, r)) r.startLeg(r.base + 1);
      }
    }
    const br = this.batterRunner;
    if (br && veryDeep && !willBeCaught) br.stretch = 2;
  }

  baseBlocked(base, self) {
    if (base >= 4) return false;
    return this.runners.some((r) => r !== self && !r.out && !r.scored && ((r.base === base && !r.moving) || (r.moving && r.to === base)));
  }

  sendRunners() {
    if (!this.userIsBatting() || this.ball.state === 'dead') return;
    for (const r of this.runners) {
      if (r.out || r.scored || r.moving) continue;
      const nb = r.base + 1;
      if (nb <= 4 && !this.baseBlocked(nb, r)) r.startLeg(nb);
    }
    sfx.chime();
  }

  holdRunners() {
    if (!this.userIsBatting() || this.ball.state === 'dead') return;
    for (const r of this.runners) {
      if (r.out || r.scored || !r.moving || r.forced) continue;
      r.to = r.base;
      r.moving = true;
    }
    sfx.back();
  }

  // -------------------------------------------------------------- ball fielded
  fieldedBall() {
    const bb = this.batted;
    const f = this.chaser;
    bb.fielded = true;
    f.hasBall = true;
    this.ball.state = 'held';
    this.heldBy = f;

    const landedT = bb.landed ? bb.landed.t : Infinity;
    const isFly = this.chaseMeta.flyout && (this.t - bb.t0) <= landedT + 0.35;
    if (isFly) {
      f.anim.play('catchBall', { force: true });
      sfx.catchPop();
      this.recordOut(this.batterRunner, 'FLY OUT', f);
      this.batterRunner = null;
      const third = this.runners.find((r) => !r.out && !r.scored && (r.base === 3 || (r.moving && r.to === 4)));
      const ip = this.chaseMeta.intercept.p;
      const deep = Math.hypot(ip.x, ip.z) > 40;
      for (const r of this.runners) {
        if (r.out || r.scored) continue;
        if (r === third && deep && this.outs < 3) {
          r.forced = false;
          r.startLeg(4); // tags and goes
          continue;
        }
        if (r.moving) { r.to = r.base; }
        r.forced = false;
      }
      this.after(0.8, () => { if (this.ball.state === 'held') this.playDead(); });
      return;
    }

    f.anim.play('pickup', { force: true });
    if (this.userIsFielding()) {
      this.showThrowMenu();
      this.padHint(
        `<b>1 / 2 / 3</b> throw to a bag · <b>H</b> home · best play glows`,
        `🎮 <b>◯</b> 1st · <b>△</b> 2nd · <b>□</b> 3rd · <b>✕</b> home · best play glows`
      );
      this.autoThrowTimer = this.t + 2.2;
    } else {
      this.after(0.28, () => this.cpuThrow());
    }
  }

  /**
   * Where should the ball go? Take the force out you can win — and when in
   * doubt, get the sure out at FIRST. Never fire across the diamond for
   * no reason.
   */
  bestThrowTarget() {
    const plays = [];
    for (const r of this.runners) {
      if (r.out || r.scored || !r.moving || !r.forced) continue;
      const base = (r.to % 4) || 4;
      const margin = r.eta() - this.throwTime(basePos(r.to % 4));
      plays.push({ base, margin });
    }
    if (plays.length) {
      // winnable force plays: take the lead base when it's clearly there
      const winnable = plays.filter((p) => p.margin > 0.12).sort((a, b) => b.base - a.base);
      if (winnable.length) return winnable[0];
      // nothing clean — take the play at first (bang-bang beats holding it)
      const first = plays.find((p) => p.base === 1);
      if (first) return first;
      plays.sort((a, b) => b.margin - a.margin);
      return plays[0];
    }
    // nobody forced: throw ahead of the lead runner to freeze him
    const lead = this.runners.filter((r) => !r.out && !r.scored)
      .sort((a, b) => (b.moving ? b.to : b.base) - (a.moving ? a.to : a.base))[0];
    if (!lead) return { base: 1, margin: -1 };
    const base = lead.moving ? ((lead.to % 4) || 4) : Math.min(4, lead.base + 1);
    return { base: Math.max(1, base), margin: -1 };
  }

  throwTime(target) {
    const d = this.heldBy.pos.distanceTo(target);
    const spd = 24 + (this.heldBy.player.arm - 60) * 0.22;
    return 0.25 + d / spd;
  }

  showThrowMenu() {
    const m = this.hud.throwmenu;
    const best = this.bestThrowTarget();
    const labels = { 1: '1ST', 2: '2ND', 3: '3RD', 4: 'HOME' };
    const padKeys = { 1: '◯', 2: '△', 3: '□', 4: '✕' };
    const usePad = pads.p1.connected;
    m.innerHTML = [1, 2, 3, 4].map((b) => `
      <button data-b="${b}" class="${best.base === b && best.margin > 0 ? 'hot' : ''}">
        <b>${usePad ? padKeys[b] : (b === 4 ? 'H' : b)}</b> ${labels[b]}
      </button>`).join('');
    m.classList.add('show');
    m.querySelectorAll('button').forEach((btn) => {
      btn.onclick = (e) => { e.stopPropagation(); this.userThrow(+btn.dataset.b); };
    });
  }

  cpuThrow() {
    if (this.ball.state !== 'held') return;
    const best = this.bestThrowTarget();
    this.throwToBase(best.base);
  }

  userThrow(base) {
    if (this.ball.state !== 'held' || !this.userIsFielding()) return;
    this.hud.throwmenu.classList.remove('show');
    this.throwToBase(base);
  }

  throwToBase(base) {
    if (this.ball.state !== 'held') return;
    const from = this.heldBy;
    const target = basePos(base % 4);
    const d = from.pos.distanceTo(target);
    this.hud.throwmenu.classList.remove('show');
    if (d < 1.2) {
      this.resolveBaseArrival(base, 0);
      this.after(0.5, () => { if (this.ball.state !== 'dead') this.playDead(); });
      return;
    }
    from.anim.play('throwQuick', { force: true });
    const tof = this.throwTime(target) - 0.25;
    this.after(THROW_RELEASE_S, () => {
      this.ball.state = 'throw';
      this.throwFlight = {
        from: new THREE.Vector3(from.pos.x, 1.5, from.pos.z),
        to: new THREE.Vector3(target.x, 1.0, target.z),
        t0: this.t, dur: Math.max(0.18, tof),
        base,
      };
      from.hasBall = false;
      sfx.catchPop();
    });
  }

  resolveBaseArrival(base, graceTime) {
    const coverer = this.fielders.find((f) => f.target.distanceTo(basePos(base % 4)) < 1.5) || this.heldBy;
    if (coverer) { coverer.hasBall = true; this.heldBy = coverer; this.ball.state = 'held'; }
    let gotOut = false;
    for (const r of this.runners) {
      if (r.out || r.scored || !r.moving) continue;
      if (r.to % 4 !== base % 4) continue;
      const margin = r.eta();
      if (margin > 0.06 + graceTime) {
        this.recordOut(r, r.forced ? (r === this.batterRunner ? 'OUT AT FIRST' : 'FORCE OUT') : 'TAGGED OUT', coverer);
        gotOut = true;
        if (r === this.batterRunner) this.batterRunner = null;
        break;
      } else if (margin > -0.4) {
        this.banner('SAFE!', '', 'good', 1000);
      }
    }
    // turn two: force at second, relay to first
    if (gotOut && base === 2 && this.outs < 3 && this.batterRunner && this.batterRunner.moving) {
      const relayT = 0.25 + basePos(2).distanceTo(basePos(1)) / 26;
      if (this.batterRunner.eta() > relayT + 0.12) {
        this.after(relayT, () => {
          if (this.batterRunner && !this.batterRunner.out && this.outs < 3) {
            this.recordOut(this.batterRunner, 'DOUBLE PLAY!', null);
            this.batterRunner = null;
            sfx.crowd(1.2);
          }
        });
      }
    }
    if (!gotOut) sfx.crowd(0.4);
  }

  recordOut(runner, label, fielder) {
    if (!runner || runner.out) { this.outs = Math.min(3, this.outs + 1); this.updateHud(); return; }
    runner.out = true;
    runner.moving = false;
    runner.anim?.play('dejected');
    this.outs++;
    this.paOutcome = this.paOutcome || 'out';
    const isUserOut = this.userIsBatting();
    this.banner(label, `${this.outs} OUT${this.outs > 1 ? 'S' : ''}`, isUserOut ? 'bad' : 'good', 1500);
    sfx.whistle();
    this.updateHud();
    if (this.outs >= 3) {
      this.after(1.0, () => this.endHalf());
    }
  }

  // -------------------------------------------------------------- scoring plays
  homeRun() {
    const bb = this.batted;
    const n = 1 + this.runners.filter((r) => r !== this.batterRunner && !r.out && !r.scored).length;
    this.addRuns(n);
    this.paOutcome = 'hr';
    this.paRbi = n;
    this.line.hr += this.userIsBatting() ? 1 : 0;
    this.line.hits += this.userIsBatting() ? 1 : 0;
    this.banner('HOME RUN!', n > 1 ? `${n} RUNS SCORE` : (Math.hypot(bb.hr.pos.x, bb.hr.pos.z) > this.park.wallCenter - 4 ? 'DEAD CENTER, GONE' : 'SEE YA!'), 'good', 2600);
    sfx.horn();
    sfx.crowd(1.6);
    for (const r of this.runners) { if (!r.out && !r.scored) { r.scored = true; r.rig.group.visible = false; } }
    this.batterAnim.play('celebrate', { force: true });
    this.ball.state = 'dead';
    this.after(2.3, () => this.playDead(true));
  }

  groundRuleDouble() {
    this.banner('OFF THE WALL — GROUND RULE DOUBLE', '', 'good', 2200);
    sfx.crowd(1.1);
    this.ball.state = 'dead';
    for (const r of this.runners) {
      if (r.out || r.scored) continue;
      if (r === this.batterRunner) { r.base = 2; r.moving = false; r.pos.copy(basePos(2)); }
      else {
        const nb = Math.min(4, r.base + 2);
        if (nb >= 4) { r.scored = true; r.rig.group.visible = false; this.addRuns(1); }
        else { r.base = nb; r.moving = false; r.pos.copy(basePos(nb)); }
      }
    }
    this.paOutcome = 'double';
    this.line.hits += this.userIsBatting() ? 1 : 0;
    this.after(1.6, () => this.playDead(true));
  }

  addRuns(n) {
    if (this.mode === 'pa') { this.paRuns = (this.paRuns || 0) + n; }
    this.score[this.battingTeamKey()] += n;
    this.updateHud();
    if (this.mode === 'full' && !this.top && this.inning >= this.innings && this.score.home > this.score.away) {
      this.after(1.4, () => this.endGame());
    }
  }

  // -------------------------------------------------------------- play resolution
  playDead(skipSettle = false) {
    if (this.phase === 'over') return;
    this.hud.throwmenu.classList.remove('show');
    this.ball.state = 'dead';
    this.phase = 'dead';
    this.hint('');

    const settle = () => {
      for (const r of [...this.runners]) {
        if (r.scored || r.out) {
          const i = this.runners.indexOf(r);
          if (i >= 0) this.runners.splice(i, 1);
          r.rig.group.visible = false;
          continue;
        }
        if (r.moving) { r.base = r.to; r.moving = false; r.pos.copy(basePos(r.base % 4)); }
        if (r.base >= 4) {
          r.scored = true;
          this.addRuns(1);
          if (this.batterRunner && r !== this.batterRunner) this.paRbi = (this.paRbi || 0) + 1;
          r.rig.group.visible = false;
          const i = this.runners.indexOf(r);
          if (i >= 0) this.runners.splice(i, 1);
        }
      }
      const br = this.batterRunner;
      if (br && !br.out && !br.scored && !this.paOutcome) {
        this.paOutcome = ['', 'single', 'double', 'triple'][br.base] || 'single';
        this.line.hits += this.userIsBatting() ? 1 : 0;
        if (this.userIsBatting()) {
          const call = { single: 'BASE HIT!', double: 'DOUBLE!', triple: 'TRIPLE!' }[this.paOutcome];
          if (call) this.banner(call, '', 'good', 1400);
        } else if (this.userIsFielding()) {
          this.line.oppHits++;
        }
      }
      this.batterRunner = null;
      this.updateHud();

      if (this.outs >= 3) return;
      if (this.mode === 'pa') { this.finishPa(); return; }
      const bkey = this.battingTeamKey();
      this.orderIdx[bkey]++;
      this.after(0.7, () => this.nextBatter());
    };
    if (skipSettle) settle();
    else this.after(0.7, settle);
  }

  pitchCrossed() {
    const c = this.pitch.cross;
    const inZone = Math.abs(c.x) < ZONE.hw && c.y > ZONE.yLo && c.y < ZONE.yHi;
    this.catcher.anim.play('catchBall', { force: true });
    sfx.catchPop();
    this.markZone(c, inZone);
    this.hud.incoming.style.display = 'none';
    if (this.foulTip) {
      if (this.strikes < 2) this.strikes++;
      this.banner('FOUL TIP', `STRIKE ${this.strikes}`, '', 1100);
      this.foulTip = false;
    } else if (this.swung || this.earlyWhiff) {
      this.strikes++;
      this.banner(this.strikes >= 3 ? 'STRIKE THREE!' : 'SWING AND A MISS', this.strikes < 3 ? `STRIKE ${this.strikes}` : '', this.userIsBatting() ? 'bad' : 'good', 1300);
    } else if (inZone) {
      this.strikes++;
      this.banner(this.strikes >= 3 ? 'CALLED STRIKE THREE' : 'STRIKE', this.strikes < 3 ? `STRIKE ${this.strikes}` : '', this.userIsBatting() ? 'bad' : '', 1200);
    } else {
      this.balls++;
      this.banner(this.balls >= 4 ? 'BALL FOUR' : 'BALL', this.balls < 4 ? `BALL ${this.balls}` : 'TAKE YOUR BASE', '', 1100);
    }
    this.swung = false;
    this.whiffed = false;
    this.earlyWhiff = false;
    this.ball.state = 'dead';
    this.updateHud();

    if (this.strikes >= 3) {
      this.paOutcome = 'k';
      this.batterAnim.play('dejected', { force: true });
      this.after(0.8, () => {
        this.recordOut({ out: false, moving: false, anim: this.batterAnim, rig: this.batterRig }, 'STRUCK OUT', null);
        this.batterRig.group.visible = false;
        if (this.outs < 3) {
          if (this.mode === 'pa') this.finishPa();
          else { this.orderIdx[this.battingTeamKey()]++; this.after(0.8, () => this.nextBatter()); }
        } else if (this.mode === 'pa') this.finishPa();
      });
      return;
    }
    if (this.balls >= 4) {
      this.paOutcome = 'bb';
      this.after(0.7, () => this.walkBatter());
      return;
    }
    this.after(0.85, () => this.toPitchCall());
  }

  walkBatter() {
    const br = new Runner(this.batterRig, this.batterPlayer);
    br.pos.copy(this.batterRig.group.position);
    this.runners.push(br);
    this.batterRunner = br;
    this.bat.visible = false;
    br.startLeg(1);
    // forced runners move up only while the chain from first is unbroken
    const runnerAt = (b) => this.runners.find((rr) => rr !== br && !rr.out && !rr.scored && rr.base === b && !rr.moving);
    const chain = [];
    for (let b = 1; b <= 3; b++) {
      const r = runnerAt(b);
      if (!r) break;
      chain.push(r);
    }
    for (let i = chain.length - 1; i >= 0; i--) chain[i].startLeg(chain[i].base + 1);
    this.after(1.2, () => this.playDead());
  }

  endHalf() {
    if (this.phase === 'over') return;
    this.hud.throwmenu.classList.remove('show');
    this.hud.pitchmenu.classList.remove('show');
    if (this.mode === 'pa') { this.finishPa(); return; }
    this.banner(this.top ? 'MIDDLE OF THE INNING' : 'END OF THE INNING', 'THREE AWAY', '', 1600);
    this.phase = 'dead';
    this.ball.state = 'dead';
    const wasBottom = !this.top;
    this.after(1.4, () => {
      if (wasBottom) {
        if (this.inning >= this.innings && this.score.home !== this.score.away) { this.endGame(); return; }
        this.inning++;
        this.top = true;
      } else {
        if (this.inning >= this.innings && this.score.home > this.score.away) { this.endGame(); return; }
        this.top = false;
      }
      this.batterRig && (this.batterRig.group.visible = false);
      this.updateHud();
      this.setupHalf();
    });
  }

  finishPa() {
    if (this._paDone) return;
    this._paDone = true;
    this.phase = 'over';
    const res = {
      outcome: this.paOutcome || 'out',
      rbi: this.paRbi || 0,
      runs: this.paRuns || 0,
    };
    this.after(1.1, () => this.opts.onPaEnd?.(res));
  }

  endGame() {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const { home, away } = this.score;
    const userKey = this.userTeam;
    const won = userKey ? this.score[userKey] > this.score[userKey === 'home' ? 'away' : 'home'] : home > away;
    sfx.horn();
    sfx.crowd(1.5);
    const f = this.hud.final;
    f.innerHTML = `
      <div class="fin-head ${won ? 'won' : 'lost'}">${won ? 'BALLGAME!' : 'FINAL'}</div>
      <div class="fin-score">${this.away.mascot.toUpperCase()} ${away} — ${home} ${this.home.mascot.toUpperCase()}</div>
      <div class="fin-sub">${won ? 'Shake hands, tip your cap. That one belongs to you.' : 'They got you tonight. Get the bats hot for the next one.'}</div>
      <div class="fin-buttons">
        <button id="fin-continue">CONTINUE ▸</button>
        ${this.opts.onRematch ? '<button id="fin-rematch">RUN IT BACK</button>' : ''}
        <button id="fin-exit">QUIT TO MENU</button>
      </div>`;
    f.classList.add('show');
    f.querySelector('#fin-continue').onclick = () => {
      f.classList.remove('show');
      this.opts.onGameEnd?.({ home, away, won, line: this.line });
    };
    const rm = f.querySelector('#fin-rematch');
    if (rm) rm.onclick = () => { f.classList.remove('show'); this.opts.onRematch?.(); };
    f.querySelector('#fin-exit').onclick = () => {
      f.classList.remove('show');
      this.opts.onExit?.();
    };
  }

  // -------------------------------------------------------------- input
  onKey(e) {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { this.togglePause(); return; }
    if (k === 'm') { sfx.setMuted(!sfx.muted); return; }
    if (this.userIsBatting()) {
      if (k === ' ' || k === 'z') { e.preventDefault(); this.onSwing(false); }
      if (k === 'x') this.onSwing(true);
      if (k === 'a') this.sendRunners();
      if (k === 's') this.holdRunners();
      if (k === 'arrowleft') this.aim.x -= 0.09;
      if (k === 'arrowright') this.aim.x += 0.09;
      if (k === 'arrowup') this.aim.y += 0.09;
      if (k === 'arrowdown') this.aim.y -= 0.09;
      this.aim.x = clamp(this.aim.x, -AIM.hw, AIM.hw);
      this.aim.y = clamp(this.aim.y, AIM.yLo, AIM.yHi);
    }
    if (this.userIsFielding()) {
      if (this.phase === 'pitchcall') {
        if (['1', '2', '3', '4'].includes(k)) { this.pitchSel = +k - 1; this.showPitchMenu(); }
        if (k === ' ' || k === 'z') { e.preventDefault(); this.throwPitch(PITCHES[this.pitchSel], { ...this.aim }); }
      }
      if (this.ball.state === 'held') {
        if (['1', '2', '3'].includes(k)) this.userThrow(+k);
        if (k === 'h' || k === '4') this.userThrow(4);
      }
    }
  }

  /** Gamepad, polled once per frame. */
  pollPad(dt) {
    pads.poll();
    const p = pads.p1;
    if (!p.connected) return;
    if (p.justConnected && !this.padSeen) {
      this.padSeen = true;
      this.banner('🎮 PAD CONNECTED', 'STICK AIMS · ✕ SWINGS · D-PAD PICKS PITCHES', '', 2200);
    }
    // stick drives the aim reticle (batting + pitch aiming)
    if (this.userIsBatting() || (this.userIsFielding() && this.phase === 'pitchcall')) {
      this.aim.x = clamp(this.aim.x + p.lx * dt * 2.4, -AIM.hw, AIM.hw);
      this.aim.y = clamp(this.aim.y - p.ly * dt * 2.4, AIM.yLo, AIM.yHi);
    }
    for (const b of p.edges) {
      if (b === BTN.OPTIONS) { this.togglePause(); continue; }
      if (this.paused) continue;
      if (this.userIsBatting()) {
        if (b === BTN.CROSS) this.onSwing(false);
        if (b === BTN.SQUARE) this.onSwing(true);
        if (b === BTN.R1) this.sendRunners();
        if (b === BTN.L1) this.holdRunners();
      }
      if (this.userIsFielding()) {
        if (this.phase === 'pitchcall') {
          if (b === BTN.UP || b === BTN.LEFT) { this.pitchSel = (this.pitchSel + PITCHES.length - 1) % PITCHES.length; this.showPitchMenu(); sfx.chime(); }
          if (b === BTN.DOWN || b === BTN.RIGHT) { this.pitchSel = (this.pitchSel + 1) % PITCHES.length; this.showPitchMenu(); sfx.chime(); }
          if (b === BTN.CROSS || b === BTN.R2) this.throwPitch(PITCHES[this.pitchSel], { ...this.aim });
        }
        if (this.ball.state === 'held') {
          if (b === BTN.CIRCLE) this.userThrow(1);
          if (b === BTN.TRIANGLE) this.userThrow(2);
          if (b === BTN.SQUARE) this.userThrow(3);
          if (b === BTN.CROSS) this.userThrow(4);
        }
      }
    }
  }

  onMouse(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const hit = new THREE.Vector3();
    if (this._raycaster.ray.intersectPlane(this._plane, hit)) {
      this.aim.x = clamp(hit.x, -AIM.hw, AIM.hw);
      this.aim.y = clamp(hit.y, AIM.yLo, AIM.yHi);
    }
  }

  onClick(e) {
    if (e.button !== 0) return;
    sfx.ensure();
    if (this.userIsBatting() && (this.phase === 'pitch' || this.phase === 'pitchcall')) this.onSwing(false);
    else if (this.userIsFielding() && this.phase === 'pitchcall') this.throwPitch(PITCHES[this.pitchSel], { ...this.aim });
  }

  togglePause() {
    const p = this.hud.pause;
    const on = !p.classList.contains('show');
    p.classList.toggle('show', on);
    this.paused = on;
    if (on) {
      p.querySelector('#pause-resume').onclick = () => this.togglePause();
      p.querySelector('#pause-exit').onclick = () => { p.classList.remove('show'); this.opts.onExit?.(); };
    }
  }

  // -------------------------------------------------------------- overlays
  projectToScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (v.x + 1) / 2 * rect.width + rect.left,
      y: (-v.y + 1) / 2 * rect.height + rect.top,
    };
  }

  layoutZone() {
    const z = this.hud.zone;
    if (z.style.display === 'none') return;
    const tl = this.projectToScreen(-ZONE.hw, ZONE.yHi, 0);
    const br = this.projectToScreen(ZONE.hw, ZONE.yLo, 0);
    // screen-right can be world -X depending on which side the camera lives
    z.style.left = Math.min(tl.x, br.x) + 'px';
    z.style.top = Math.min(tl.y, br.y) + 'px';
    z.style.width = Math.abs(br.x - tl.x) + 'px';
    z.style.height = Math.abs(br.y - tl.y) + 'px';
    const showRet = (this.userIsBatting() && (this.phase === 'pitch' || this.phase === 'pitchcall'))
      || (this.userIsFielding() && this.phase === 'pitchcall');
    const r = this.hud.reticle;
    r.style.display = showRet ? 'block' : 'none';
    if (showRet) {
      const p = this.projectToScreen(this.aim.x, this.aim.y, 0);
      r.style.left = p.x + 'px';
      r.style.top = p.y + 'px';
      r.className = this.userIsBatting() ? 'bat' : 'pit';
    }
    // the incoming-pitch marker: fades in and tightens as the ball arrives
    const inc = this.hud.incoming;
    if (this.ball.state === 'pitch' && this.pitch?.t0 != null && this.userIsBatting()) {
      const u = clamp((this.t - this.pitch.t0) / this.pitch.dur, 0, 1);
      const c = this.pitch.cross;
      const p = this.projectToScreen(c.x, c.y, 0);
      const size = 74 - u * 44;
      inc.style.display = 'block';
      inc.style.left = p.x + 'px';
      inc.style.top = p.y + 'px';
      inc.style.width = size + 'px';
      inc.style.height = size + 'px';
      inc.style.marginLeft = -size / 2 + 'px';
      inc.style.marginTop = -size / 2 + 'px';
      inc.style.opacity = String(0.25 + u * 0.75);
    } else if (inc.style.display !== 'none' && this.ball.state !== 'pitch') {
      inc.style.display = 'none';
    }
  }

  markZone(c, inZone) {
    const m = this.hud.mark;
    const p = this.projectToScreen(c.x, c.y, 0);
    m.style.display = 'block';
    m.style.left = p.x + 'px';
    m.style.top = p.y + 'px';
    m.className = inZone ? 'in' : 'out';
    clearTimeout(this._markT);
    this._markT = setTimeout(() => { m.style.display = 'none'; }, 900);
  }

  // -------------------------------------------------------------- ball + camera
  updateBall(dt) {
    const bg = this.ballGroup;
    if (this.ball.state === 'pitch' && this.pitch.t0 != null) {
      const u = (this.t - this.pitch.t0) / this.pitch.dur;
      if (u >= 1) {
        if (!this.swung || this.whiffed || this.foulTip || !this.batted) {
          if (this.phase !== 'live') this.pitchCrossed();
        }
        return;
      }
      const r = this.pitch.release, c = this.pitch.cross;
      bg.visible = true;
      bg.position.set(
        r.x + (c.x - r.x) * u + this.pitch.brk.x * u * u,
        r.y + (c.y - r.y) * u + this.pitch.brk.y * u * u + Math.sin(u * Math.PI) * 0.12,
        r.z * (1 - u)
      );
    } else if (this.ball.state === 'hit' && this.batted) {
      const bt = this.t - this.batted.t0;
      const S = this.batted.samples;
      let s = S[S.length - 1];
      for (let i = 0; i < S.length; i++) { if (S[i].t >= bt) { s = S[i]; break; } }
      bg.visible = true;
      bg.position.copy(s.p);
      // has the chaser met the ball? (checked against the LIVE ball so
      // coarse frames can't skip the intercept window)
      if (!this.batted.fielded && this.chaser && this.chaseMeta) {
        const ip = this.chaseMeta.intercept;
        const flat = new THREE.Vector3(s.p.x, 0, s.p.z);
        const landedT = this.batted.landed ? this.batted.landed.t : Infinity;
        if (bt > landedT + 0.35) this.chaseMeta.flyout = false;
        if (bt >= ip.t - 0.02 && this.chaser.pos.distanceTo(flat) < 1.7 && s.p.y < 2.2) {
          this.fieldedBall();
        } else if (bt >= ip.t + 0.1) {
          this.chaser.seek(flat);
        }
      }
      if (bt >= S[S.length - 1].t + 1.6 && !this.batted.fielded) {
        this.fieldedBall();
      }
    } else if (this.ball.state === 'throw' && this.throwFlight) {
      const tf = this.throwFlight;
      const u = (this.t - tf.t0) / tf.dur;
      if (u >= 1) {
        bg.position.copy(tf.to);
        this.ball.state = 'held';
        // credit the frame lateness back to the defense on bang-bang plays
        const late = this.t - (tf.t0 + tf.dur);
        this.resolveBaseArrival(tf.base, -late);
        this.throwFlight = null;
        this.after(0.6, () => {
          if (this.ball.state === 'held' && this.outs < 3 && this.phase === 'live') {
            const anyMoving = this.runners.some((r) => r.moving && !r.out && !r.scored);
            if (anyMoving && this.userIsFielding()) { this.showThrowMenu(); this.autoThrowTimer = this.t + 1.6; }
            else if (anyMoving) this.cpuThrow();
            else this.playDead();
          }
        });
        return;
      }
      bg.visible = true;
      bg.position.lerpVectors(tf.from, tf.to, u);
      bg.position.y += Math.sin(u * Math.PI) * (tf.dur * 3.4);
    } else if (this.ball.state === 'held' && this.heldBy) {
      bg.visible = true;
      bg.position.set(this.heldBy.pos.x, 1.35, this.heldBy.pos.z);
      if (this.userIsFielding() && this.autoThrowTimer && this.t > this.autoThrowTimer && this.phase === 'live') {
        this.autoThrowTimer = null;
        const anyMoving = this.runners.some((r) => r.moving && !r.out && !r.scored);
        if (anyMoving) this.cpuThrow();
        else this.playDead();
      }
      if (this.phase === 'live') {
        const anyMoving = this.runners.some((r) => r.moving && !r.out && !r.scored);
        if (!anyMoving && !this.userIsFielding()) this.playDead();
        if (!anyMoving && this.userIsFielding()) { this.hud.throwmenu.classList.remove('show'); this.playDead(); }
      }
    }
  }

  updateBat() {
    if (!this.bat.visible || !this.batterRig) return;
    const grip = this.lefty ? this.batterRig.gripL : this.batterRig.gripR;
    grip.updateWorldMatrix(true, false);
    this.bat.position.setFromMatrixPosition(grip.matrixWorld);
    const q = new THREE.Quaternion();
    grip.getWorldQuaternion(q);
    this.bat.quaternion.copy(q);
    this.bat.rotateX(-0.5);
  }

  /**
   * The camera lives where the player lives:
   * - you bat → over your batter's back shoulder, looking out at the mound
   * - you pitch → behind the mound, looking in at the catcher's mitt
   * - ball in play → pulls up and chases the ball
   */
  updateCamera(dt) {
    let targetPos, targetLook;
    const pitchPhase = this.phase === 'pitchcall' || this.phase === 'pitch';
    if (this.phase === 'live' && this.ball.state !== 'dead' && this.ballGroup.visible) {
      const bp = this.ballGroup.position;
      const d = Math.hypot(bp.x, bp.z);
      const back = clamp(6 + d * 0.24, 7, 26);
      const up = clamp(3.5 + d * 0.22 + bp.y * 0.4, 4, 24);
      targetPos = new THREE.Vector3(bp.x * 0.35, up, -back + bp.z * 0.18);
      targetLook = new THREE.Vector3(bp.x, Math.max(1, bp.y), bp.z);
    } else if (this.phase === 'dead' && this.runners.some((r) => r.moving)) {
      targetPos = new THREE.Vector3(0, 14, -16);
      targetLook = new THREE.Vector3(0, 0, BASEPATH);
    } else if (pitchPhase && this.userIsFielding()) {
      // mound cam: over the pitcher's throwing shoulder, zone dead ahead
      targetPos = new THREE.Vector3(1.7, 2.95, MOUND + 6.8);
      targetLook = new THREE.Vector3(0, 1.05, -0.5);
    } else if (pitchPhase && this.userIsBatting()) {
      // batter cam: over the hitter's back shoulder
      const s = this.lefty ? 1 : -1;
      targetPos = new THREE.Vector3(s * 2.3, 2.15, -4.9);
      targetLook = new THREE.Vector3(s * -0.4, 1.35, MOUND);
    } else {
      // neutral broadcast view behind the plate
      targetPos = new THREE.Vector3(this.lefty ? 1.4 : -1.4, 2.75, -7.4);
      targetLook = new THREE.Vector3(0, 1.35, MOUND);
    }
    const k = Math.min(1, dt * 4.2);
    this._camPos.lerp(targetPos, k);
    this._camLook.lerp(targetLook, k);
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);
  }

  // -------------------------------------------------------------- main loop
  loop() {
    if (this.disposed) return;
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05) * (this.opts.turbo || 1);
    this.pollPad(dt);
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }
    this.t += dt;
    this.runTimers();

    for (const f of this.fielders) f.update(dt);
    for (const r of this.runners) r.update(dt);
    this.batterAnim?.update(dt);
    this.umpAnim?.update(dt);
    this.updateBall(dt);
    this.updateBat();
    this.updateCamera(dt);
    this.layoutZone();
    this.parkView.crowd.update(0.4, this.t);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._onResize);
    this.renderer.domElement.removeEventListener('pointermove', this._onMouse);
    this.renderer.domElement.removeEventListener('pointerdown', this._onClick);
    this.renderer.domElement.removeEventListener('contextmenu', this._onCtx);
    clearTimeout(this._bannerT);
    clearTimeout(this._markT);
    this.renderer.dispose();
    this.container.innerHTML = '';
    for (const id of ['bb-pitchmenu', 'bb-throwmenu']) document.getElementById(id)?.classList.remove('show');
    this.hud.zone.style.display = 'none';
    this.hud.incoming.style.display = 'none';
    this.hud.reticle.style.display = 'none';
    this.hud.hint.innerHTML = '';
  }
}
