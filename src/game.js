// The Friday night game: phases, player AI, ball physics, tackles, downs,
// special teams, cameras, HUD. Home drives +X; goal lines at |x| = 50.
import * as THREE from 'three';
import { makeClips, THROW_RELEASE_S, KICK_CONTACT_S } from './clips.js';
import { Animator, tuckOverlay, lookOverlay } from './animation.js';
import { makeKit, buildPlayer, buildBall, buildRef, buildCoach } from './playerModel.js';
import { buildStadium } from './stadium.js';
import { OFFENSE_PLAYS, DEFENSE_PLAYS, OL_ALIGN, DEF_ALIGN, drawPlayArt, drawDefArt } from './plays.js';
import { logoCanvas } from './logos.js';
import { contrastText, shade } from './textures.js';
import { sfx } from './audio.js';

const CLIPS = makeClips();
const GOAL = 50, EZ_BACK = 60, SIDE = 160 / 6; // 26.67
const G = 10.7; // gravity, yd/s²
const QUARTER_LEN = 180;

const OFF_ROLES = ['QB', 'RB', 'FB', 'WR1', 'WR2', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'];
const DEF_ROLES = ['DE1', 'DT1', 'DT2', 'DE2', 'OLB1', 'MLB', 'OLB2', 'CB1', 'CB2', 'FS', 'SS'];

function rosterPick(roster) {
  // map roster entries to play roles
  const take = (pos, n = 0) => roster.filter((p) => p.pos === pos)[n] || roster[0];
  return {
    QB: take('QB'), RB: take('RB'), FB: take('FB'), WR1: take('WR', 0), WR2: take('WR', 1),
    TE: take('TE'), LT: take('LT'), LG: take('LG'), C: take('C'), RG: take('RG'), RT: take('RT'),
    DE1: take('DE', 0), DT1: take('DT', 0), DT2: take('DT', 1), DE2: take('DE', 1),
    OLB1: take('LB', 0), MLB: take('MLB'), OLB2: take('LB', 1),
    CB1: take('CB', 0), CB2: take('CB', 1), FS: take('FS'), SS: take('SS'),
    K: take('K'),
  };
}

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function damp(cur, target, lambda, dt) { return THREE.MathUtils.damp(cur, target, lambda, dt); }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
const rand = (a, b) => a + Math.random() * (b - a);

// ============================================================ Athlete
class Athlete {
  constructor(rig, info, team) {
    this.rig = rig;
    this.info = info;
    this.team = team;
    this.group = rig.group;
    this.anim = new Animator(rig, CLIPS);
    this.vel = new THREE.Vector2();
    this.maxSpd = 5.6 + (info.spd / 99) * 3.4;
    this.accel = 11 + (info.spd / 99) * 6;
    this.role = null;
    this.state = 'idle';
    this.waypoints = [];
    this.wpIndex = 0;
    this.engagedWith = null;
    this.shedTimer = 0;
    this.downTimer = 0;
    this.slowTimer = 0;
    this.diveTimer = 0;
    this.hasBall = false;
    this.tuck = 0;
    this.look = null;
    this.anim.overlays.push(tuckOverlay(() => this.tuck));
    this.anim.overlays.push(lookOverlay(() => this.look));
    this._desired = new THREE.Vector2();
    this._faceTarget = null;
    this.aiTimer = 0;
  }

  get pos() { return this.group.position; }
  get facing() { return this.group.rotation.y; }
  set facing(v) { this.group.rotation.y = v; }

  warp(x, z, facing = 0) {
    this.pos.set(x, 0, z);
    this.facing = facing;
    this.vel.set(0, 0);
  }

  /** Steer toward world point at given speed fraction. Returns distance. */
  seek(x, z, spdFrac = 1) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      this._desired.set(dx / d, dz / d).multiplyScalar(this.maxSpd * spdFrac);
    } else {
      this._desired.set(0, 0);
    }
    return d;
  }

  stop() { this._desired.set(0, 0); }

  faceToward(x, z) { this._faceTarget = Math.atan2(x - this.pos.x, z - this.pos.z); }

  /** Integrate motion + pick locomotion animation. */
  move(dt, { lockAnim = false } = {}) {
    if (this.slowTimer > 0) { this.slowTimer -= dt; this._desired.multiplyScalar(0.45); }
    const ax = this._desired.x - this.vel.x, az = this._desired.y - this.vel.y;
    const aMag = Math.hypot(ax, az);
    const aMax = this.accel * dt;
    if (aMag > aMax && aMag > 0) {
      this.vel.x += (ax / aMag) * aMax;
      this.vel.y += (az / aMag) * aMax;
    } else {
      this.vel.x = this._desired.x;
      this.vel.y = this._desired.y;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    const spd = this.vel.length();
    // face movement (or explicit target)
    if (this._faceTarget != null) {
      this.facing = angleLerp(this.facing, this._faceTarget, Math.min(1, dt * 10));
      this._faceTarget = null;
    } else if (spd > 0.6) {
      this.facing = angleLerp(this.facing, Math.atan2(this.vel.x, this.vel.y), Math.min(1, dt * 8));
    }
    if (!lockAnim) {
      if (spd > 0.92 * this.maxSpd) this.anim.play('sprint', { rate: 0.92 + spd / 9 });
      else if (spd > 4.2) this.anim.play('run', { rate: 0.8 + spd / 8 });
      else if (spd > 0.8) this.anim.play('jog', { rate: 0.8 + spd / 6 });
      else this.anim.play(this.idleClip || 'ready');
    }
    return spd;
  }
}

// ============================================================ HUD (DOM)
class Hud {
  constructor(root) {
    this.el = {
      bar: root.querySelector('#hud-bar'),
      score: root.querySelector('#hud-score'),
      situation: root.querySelector('#hud-situation'),
      clock: root.querySelector('#hud-clock'),
      banner: root.querySelector('#hud-banner'),
      bannerMain: root.querySelector('#hud-banner .main'),
      bannerSub: root.querySelector('#hud-banner .sub'),
      playcall: root.querySelector('#playcall'),
      playGrid: root.querySelector('#playcall .grid'),
      playTitle: root.querySelector('#playcall .pc-title'),
      icons: root.querySelector('#icons'),
      hint: root.querySelector('#hud-hint'),
      matchup: root.querySelector('#matchup'),
      final: root.querySelector('#final'),
    };
    this._bannerT = null;
  }
  setBar({ homeAbbr, awayAbbr, home, away, qtr, clock, down, toGo, ballOn, poss, homeColor, awayColor }) {
    this.el.score.innerHTML =
      `<span class="chip" style="background:${homeColor}">${homeAbbr}</span> <b>${home}</b>` +
      `&nbsp;·&nbsp;<span class="chip" style="background:${awayColor}">${awayAbbr}</span> <b>${away}</b>`;
    const downStr = down ? `${['1ST', '2ND', '3RD', '4TH'][down - 1]} & ${toGo}` : '';
    this.el.situation.textContent = down ? `${downStr} · BALL ON ${ballOn} · ${poss} BALL` : poss;
    this.el.clock.textContent = `Q${qtr} ${clock}`;
  }
  banner(main, sub = '', ms = 2200, cls = '') {
    const b = this.el.banner;
    this.el.bannerMain.textContent = main;
    this.el.bannerSub.textContent = sub;
    b.className = 'show ' + cls;
    clearTimeout(this._bannerT);
    if (ms > 0) this._bannerT = setTimeout(() => { b.className = ''; }, ms);
  }
  hideBanner() { this.el.banner.className = ''; clearTimeout(this._bannerT); }
  playcall(title, cards, cb) {
    this.el.playTitle.textContent = title;
    this.el.playGrid.innerHTML = '';
    cards.forEach((card, i) => {
      const div = document.createElement('div');
      div.className = 'playcard';
      if (card.art) div.appendChild(card.art);
      const name = document.createElement('div');
      name.className = 'pc-name';
      name.textContent = `${i + 1}. ${card.name}`;
      div.appendChild(name);
      if (card.desc) {
        const d = document.createElement('div');
        d.className = 'pc-desc';
        d.textContent = card.desc;
        div.appendChild(d);
      }
      div.onclick = () => { sfx.chime(); cb(card.id); };
      this.el.playGrid.appendChild(div);
    });
    this.el.playcall.classList.add('show');
    this._pcCards = cards;
    this._pcCb = cb;
  }
  hidePlaycall() { this.el.playcall.classList.remove('show'); this._pcCb = null; }
  pickPlay(i) {
    if (this._pcCb && this._pcCards[i]) { sfx.chime(); this._pcCb(this._pcCards[i].id); }
  }
  hint(text) { this.el.hint.innerHTML = text; }
  icons(list) {
    // list: [{key, x, y, label, hot}]
    const holder = this.el.icons;
    holder.innerHTML = '';
    for (const it of list) {
      const d = document.createElement('div');
      d.className = 'target-icon' + (it.hot ? ' hot' : '');
      d.style.left = it.x + 'px';
      d.style.top = it.y + 'px';
      d.innerHTML = `<span class="key">${it.key}</span><span class="lbl">${it.label}</span>`;
      holder.appendChild(d);
    }
  }
  clearIcons() { this.el.icons.innerHTML = ''; }
}

// ============================================================ Game
export class Game {
  constructor(container, appState, { onExit = () => {}, onRematch = () => {} } = {}) {
    this.appState = appState;
    this.onExit = onExit;
    this.onRematch = onRematch;
    this.container = container;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 900);
    this.camera.position.set(-40, 14, 30);
    this.camera.lookAt(0, 0, 0);
    this._camLook = v3(0, 0, 0);

    const school = appState.school, rival = appState.rival;
    this.school = school;
    this.rival = rival;
    const letter = school.name[0];
    this.homeLogo = logoCanvas(school.logoId, { fg: school.colors.secondary, bg: school.colors.primary, line: '#101014', letter });
    this.awayLogo = logoCanvas(rival.logoId, { fg: rival.colors.secondary, bg: rival.colors.primary, line: '#101014', letter: rival.name[0] });

    this.stadium = buildStadium(this.scene, school, rival, this.homeLogo);

    // kits: home in school uniform, visitors in road whites
    this.kits = {
      home: makeKit(appState.uniform, this.homeLogo),
      away: makeKit({
        jersey: '#f2f1ec', pants: rival.colors.primary, helmet: rival.colors.primary,
        sleeve: rival.colors.primary, numberFill: rival.colors.primary, numberStroke: rival.colors.secondary,
        pantsStripe: rival.colors.secondary, helmetStripe: rival.colors.secondary,
        facemask: '#3a3d44', socks: '#f2f1ec', style: 'classic',
      }, this.awayLogo),
    };

    // build athletes for every play role on both teams
    this.players = { home: {}, away: {} };
    for (const team of ['home', 'away']) {
      const roster = team === 'home' ? appState.roster : rival.roster;
      const picked = rosterPick(roster);
      for (const role of [...OFF_ROLES, ...DEF_ROLES, 'K']) {
        const info = picked[role];
        const rig = buildPlayer(this.kits[team], {
          num: info.num, build: info.build, skin: info.skin,
          accessories: { towel: role === 'RB' || role === 'QB' },
        });
        const a = new Athlete(rig, info, team);
        a.role = role;
        this.scene.add(rig.group);
        this.players[team][role] = a;
      }
    }
    this.allAthletes = [];
    for (const team of ['home', 'away']) for (const r in this.players[team]) this.allAthletes.push(this.players[team][r]);

    // officials + coaches
    this.ref = new Athlete(buildRef(), { spd: 70, str: 50, hands: 50, iq: 90, num: '' }, 'ref');
    this.ref.idleClip = 'idle';
    this.scene.add(this.ref.group);
    this.coaches = {
      home: new Athlete(buildCoach(school.colors.primary, school.colors.secondary), { spd: 40, str: 50, hands: 40, iq: 99, num: '' }, 'home'),
      away: new Athlete(buildCoach(rival.colors.primary, rival.colors.secondary), { spd: 40, str: 50, hands: 40, iq: 99, num: '' }, 'away'),
    };
    this.coaches.home.idleClip = 'idle';
    this.coaches.away.idleClip = 'idle';
    this.coaches.home.warp(-6, 28.2, Math.PI);
    this.coaches.away.warp(6, -28.2, 0);
    this.scene.add(this.coaches.home.group, this.coaches.away.group);

    // ball
    this.ball = buildBall();
    this.scene.add(this.ball);
    this.ballMode = 'ground';
    this.holder = null;
    this.ballVel = v3();
    this.ballMeta = null;
    this.spin = 0;

    // match state
    this.match = {
      home: 0, away: 0, qtr: 1, clock: QUARTER_LEN,
      down: 1, toGo: 10, losX: -25, poss: 'home', dir: 1,
    };
    this.phase = 'intro';
    this.phaseT = 0;
    this.playResult = null;
    this.offPlay = null;
    this.defPlay = null;
    this.user = null;       // athlete under user control
    this.engagements = [];
    this.targetsLive = [];
    this.t = 0;
    this._scoreboardT = 0;
    this.paused = false;
    this.muted = false;
    this._timers = [];
    this.timeScale = 1;     // QA hook: speed up the sim
    this._fpsEma = 60;
    this.lowSpec = false;

    this.hud = new Hud(document);
    this.keys = new Set();
    this._onKeyDown = (e) => this.keyDown(e);
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onResize = () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('resize', this._onResize);

    // park everyone at their bench to start
    this.parkAll();
    this.placeBallAt(this.match.losX, 0);

    this.clock = new THREE.Clock();
    this._raf = null;
    this.disposed = false;

    this.showMatchup();
    this.loop();
  }

  // -------------------------------------------------- helpers
  /** Schedule on the sim clock (pause-safe, timeScale-aware). */
  after(seconds, fn) { this._timers.push({ at: this.t + seconds, fn }); }

  runTimers() {
    if (!this._timers.length) return;
    const due = [];
    this._timers = this._timers.filter((tm) => (tm.at <= this.t ? (due.push(tm), false) : true));
    for (const tm of due) tm.fn();
  }

  abbr(name) { return name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'HS'; }

  fmtClock(s) {
    const m = Math.max(0, Math.floor(s / 60)), ss = Math.max(0, Math.floor(s % 60));
    return `${m}:${String(ss).padStart(2, '0')}`;
  }

  updateHudBar() {
    const m = this.match;
    this.hud.setBar({
      homeAbbr: this.abbr(this.school.name), awayAbbr: this.abbr(this.rival.name),
      home: m.home, away: m.away, qtr: m.qtr, clock: this.fmtClock(m.clock),
      down: this.phase === 'final' ? 0 : m.down, toGo: m.toGo >= 10 && this.goalToGo() ? 'GOAL' : m.toGo,
      ballOn: Math.round(50 - Math.abs(m.losX)),
      poss: m.poss === 'home' ? this.abbr(this.school.name) : this.abbr(this.rival.name),
      homeColor: this.school.colors.primary, awayColor: this.rival.colors.primary,
    });
  }

  goalToGo() { return (50 - this.match.losX * this.match.dir) <= this.match.toGo; }

  drawScoreboard() {
    const m = this.match;
    this.stadium.scoreboard.draw({
      stadium: `${this.school.mascot} Stadium`, mascot: this.school.mascot,
      headerColor: this.school.colors.primary, headerText: contrastText(this.school.colors.primary),
      home: m.home, away: m.away, clock: this.fmtClock(m.clock),
      down: String(m.down), toGo: this.goalToGo() ? 'G' : String(m.toGo),
      ballOn: String(Math.round(50 - Math.abs(m.losX))), qtr: String(Math.min(m.qtr, 4)),
    });
  }

  parkAll() {
    // everyone to their sideline in two loose rows
    for (const team of ['home', 'away']) {
      const zSide = team === 'home' ? 28.0 : -28.0;
      let i = 0;
      for (const role in this.players[team]) {
        const a = this.players[team][role];
        const row = i % 2, col = Math.floor(i / 2);
        a.warp(-16 + col * 2.4, zSide + row * 1.0, team === 'home' ? Math.PI : 0);
        a.state = 'spectate';
        a.idleClip = 'idle';
        a.anim.play('idle', { startAt: Math.random() });
        i++;
      }
    }
    this.ref.warp(0, -27, 0);
    this.ref.state = 'spectate';
  }

  placeBallAt(x, z, y = 0.1) {
    this.ballMode = 'ground';
    this.holder = null;
    this.ball.position.set(x, y, z);
    this.ball.rotation.set(0, 0, 0.12);
  }

  giveBall(athlete, grip = 'tuck') {
    this.holder = athlete;
    this.ballMode = 'held';
    this.ballGrip = grip;
    for (const a of this.allAthletes) a.hasBall = false;
    athlete.hasBall = true;
  }

  // attach ball visual to holder each frame
  updateHeldBall() {
    const a = this.holder;
    if (!a) return;
    if (this.ballGrip === 'hand') {
      a.rig.gripR.updateWorldMatrix(true, false);
      this.ball.position.setFromMatrixPosition(a.rig.gripR.matrixWorld);
      this.ball.quaternion.setFromEuler(new THREE.Euler(0, a.facing + Math.PI / 2, 0.9));
    } else {
      // tucked under the left arm against the ribs
      const off = v3(-0.21, 0.12, 0.16).applyAxisAngle(v3(0, 1, 0), a.facing);
      a.rig.j.chest.updateWorldMatrix(true, false);
      this.ball.position.setFromMatrixPosition(a.rig.j.chest.matrixWorld).add(off);
      this.ball.quaternion.setFromEuler(new THREE.Euler(0.25, a.facing, 0.5));
    }
  }

  // -------------------------------------------------- flow
  showMatchup() {
    const el = this.hud.el.matchup;
    el.innerHTML = `
      <div class="mu-week">WEEK 1 · FRIDAY NIGHT</div>
      <div class="mu-teams">
        <div class="mu-team" style="border-color:${this.rival.colors.primary}">
          <div class="mu-name">${this.rival.name.toUpperCase()}</div>
          <div class="mu-mascot" style="color:${this.rival.colors.secondary}">${this.rival.mascot.toUpperCase()}</div>
        </div>
        <div class="mu-at">AT</div>
        <div class="mu-team" style="border-color:${this.school.colors.primary}">
          <div class="mu-name">${this.school.name.toUpperCase()}</div>
          <div class="mu-mascot" style="color:${this.school.colors.secondary}">${this.school.mascot.toUpperCase()}</div>
        </div>
      </div>
      <div class="mu-sub">${this.school.mascot} Stadium · Kickoff 7:00 PM</div>`;
    el.classList.add('show');
    this.setPhase('intro');
    this.after(3.4, () => {
      el.classList.remove('show');
      this.startDrive('home', -25, 'Your ball. Lead them out.');
    });
  }

  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
  }

  startDrive(team, losX, note = '') {
    const m = this.match;
    // overtime is sudden death: any lead at a change of drive ends it
    if (m.qtr > 4 && m.home !== m.away) { this.endGame(); return; }
    m.poss = team;
    m.dir = team === 'home' ? 1 : -1;
    m.losX = THREE.MathUtils.clamp(losX, -49, 49);
    m.down = 1;
    m.toGo = Math.min(10, 50 - m.losX * m.dir);
    this.placeBallAt(m.losX, 0);
    this.updateHudBar();
    this.drawScoreboard();
    if (note) this.hud.banner(team === 'home' ? 'YOUR DRIVE' : `${this.rival.mascot.toUpperCase()} BALL`, note, 1800);
    this.after(0.6, () => this.toPlaycall());
  }

  toPlaycall() {
    if (this.checkClockFlow()) return;
    this.setPhase('playcall');
    this.hud.clearIcons();
    const m = this.match;
    const userOnOffense = m.poss === 'home';
    // CPU picks its side immediately
    if (userOnOffense) {
      this.defPlay = this.cpuPickDefense();
      const cards = OFFENSE_PLAYS.map((p) => ({ id: p.id, name: p.name, desc: p.desc, art: drawPlayArt(p) }));
      if (m.down === 4) {
        const kickDist = Math.round(50 - m.losX * m.dir + 17);
        if (kickDist <= 48) cards.push({ id: '__fg', name: `FG (${kickDist} yd)`, desc: 'Send out the kicking unit.' });
        cards.push({ id: '__punt', name: 'Punt', desc: 'Flip the field. Live to fight again.' });
      }
      this.hud.playcall(`${['1ST', '2ND', '3RD', '4TH'][m.down - 1]} & ${this.goalToGo() ? 'GOAL' : m.toGo} — call it`, cards, (id) => this.choosePlay(id));
    } else {
      this.offPlay = this.cpuPickOffense();
      const cards = DEFENSE_PLAYS.map((p) => ({ id: p.id, name: p.name, desc: p.desc, art: drawDefArt(p) }));
      this.hud.playcall(`DEFENSE — ${['1ST', '2ND', '3RD', '4TH'][m.down - 1]} & ${m.toGo}`, cards, (id) => this.choosePlay(id));
    }
    this.updateHudBar();
  }

  choosePlay(id) {
    if (id === '__punt') { this.hud.hidePlaycall(); this.startPunt(); return; }
    if (id === '__fg') { this.hud.hidePlaycall(); this.startKick('FG'); return; }
    const userOnOffense = this.match.poss === 'home';
    if (userOnOffense) {
      this.offPlay = OFFENSE_PLAYS.find((p) => p.id === id);
    } else {
      this.defPlay = DEFENSE_PLAYS.find((p) => p.id === id);
    }
    this.hud.hidePlaycall();
    this.lineup();
  }

  cpuPickOffense() {
    const m = this.match;
    const dist = m.toGo;
    if (m.down === 4) {
      const kickDist = Math.round(50 - m.losX * m.dir + 17);
      if (dist <= 2 && Math.random() < 0.5) return OFFENSE_PLAYS.find((p) => p.id === 'dive');
      if (kickDist <= 45) { this._cpuSpecial = 'FG'; return null; }
      this._cpuSpecial = 'PUNT';
      return null;
    }
    const pool = dist <= 3
      ? ['dive', 'dive', 'sneak', 'toss', 'slants']
      : dist <= 7
        ? ['dive', 'toss', 'slants', 'curls', 'verts']
        : ['curls', 'slants', 'verts', 'pa_post', 'toss'];
    const id = pool[(Math.random() * pool.length) | 0];
    return OFFENSE_PLAYS.find((p) => p.id === id);
  }

  cpuPickDefense() {
    const m = this.match;
    const pool = m.toGo <= 3 ? ['base', 'blitz', 'goalline'] : m.toGo >= 9 ? ['cover2', 'base', 'blitz'] : ['base', 'cover2', 'blitz'];
    const id = pool[(Math.random() * pool.length) | 0];
    return DEFENSE_PLAYS.find((p) => p.id === id);
  }

  // -------------------------------------------------- downs / scoring
  endPlay(reason, spotX, spotZ = 0) {
    if (this.phase !== 'live') return;
    this.setPhase('dead');
    sfx.whistle();
    this.hud.clearIcons();
    this.playResult = { reason, spotX: THREE.MathUtils.clamp(spotX, -59.5, 59.5), spotZ };
    const m = this.match;
    m.clock = Math.max(0, m.clock - 14); // between-play runoff
    // banner per reason
    const gain = Math.round((spotX - m.losX) * m.dir);
    if (reason === 'tackle' || reason === 'oob') {
      if (gain >= m.toGo && reason !== 'incomplete') {
        this.hud.banner('FIRST DOWN', `${gain >= 0 ? '+' : ''}${gain} yards`, 1700, 'good');
        sfx.firstDown();
      } else {
        this.hud.banner(reason === 'oob' ? 'OUT OF BOUNDS' : 'TACKLE', `${gain >= 0 ? '+' : ''}${gain} yards`, 1500);
      }
    } else if (reason === 'incomplete') {
      this.hud.banner('INCOMPLETE', '', 1500);
    } else if (reason === 'sack') {
      this.hud.banner('SACKED!', `${gain} yards`, 1700, 'bad');
      this.stadium.crowd.setExcitement(this.match.poss === 'away' ? 0.8 : 0.3);
    }
    this.after(1.75, () => this.advanceDowns());
  }

  advanceDowns() {
    const m = this.match;
    const r = this.playResult || { reason: 'incomplete', spotX: m.losX };
    let spot = r.reason === 'incomplete' ? m.losX : r.spotX;
    const gain = (spot - m.losX) * m.dir;

    // safety
    if (r.reason !== 'incomplete' && spot * m.dir <= -50) {
      const defTeam = m.poss === 'home' ? 'away' : 'home';
      m[defTeam] += 2;
      this.hud.banner('SAFETY!', 'Two points', 2300, defTeam === 'home' ? 'good' : 'bad');
      sfx.crowd(defTeam === 'home' ? 1 : 0.3);
      this.updateHudBar();
      this.after(2.1, () => this.startDrive(defTeam, (defTeam === 'home' ? -1 : 1) * 15));
      return;
    }

    if (r.reason !== 'incomplete') {
      m.losX = THREE.MathUtils.clamp(spot, -49.5, 49.5);
      m.toGo = Math.round(m.toGo - gain);
    }
    if (m.toGo <= 0) {
      m.down = 1;
      m.toGo = Math.min(10, 50 - m.losX * m.dir);
    } else {
      m.down++;
    }
    if (m.down > 4) {
      const other = m.poss === 'home' ? 'away' : 'home';
      this.hud.banner('TURNOVER ON DOWNS', '', 2000, other === 'home' ? 'good' : 'bad');
      this.after(1.9, () => this.startDrive(other, m.losX));
      return;
    }
    this.updateHudBar();
    this.drawScoreboard();
    this.toPlaycall();
  }

  checkClockFlow() {
    const m = this.match;
    if (m.clock > 0) return false;
    if (m.qtr === 2) {
      m.qtr = 3;
      m.clock = QUARTER_LEN;
      this.hud.banner('HALFTIME', 'The band takes the field', 3000);
      this.stadium.crowd.setExcitement(0.7);
      sfx.crowd(0.6);
      this.after(3.0, () => this.toPlaycall());
      return true;
    }
    if (m.qtr === 4 || m.qtr > 4) {
      if (m.home !== m.away) { this.endGame(); return true; }
      m.qtr++;
      m.clock = QUARTER_LEN;
      this.hud.banner('OVERTIME', 'Next score wins', 2600, 'good');
      this.after(2.4, () => this.toPlaycall());
      return true;
    }
    m.qtr++;
    m.clock = QUARTER_LEN;
    this.hud.banner(`END OF Q${m.qtr - 1}`, '', 2000);
    this.after(1.9, () => this.toPlaycall());
    return true;
  }

  touchdown(team) {
    const m = this.match;
    m[team] += 6;
    this.setPhase('td');
    this.hud.clearIcons();
    sfx.horn();
    sfx.crowd(team === 'home' ? 1 : 0.35);
    this.stadium.crowd.setExcitement(team === 'home' ? 1 : 0.4);
    this.hud.banner('TOUCHDOWN!', team === 'home' ? `${this.school.name} ${this.school.mascot}` : `${this.rival.name} ${this.rival.mascot}`, 2800, team === 'home' ? 'good' : 'bad');
    // celebrations
    const scorer = this.holder || this.players[team].RB;
    this._celebrant = scorer;
    for (const a of this.allAthletes) {
      if (a.state === 'down') continue;
      if (a.team === team) {
        if (a.pos.distanceTo(scorer.pos) < 16) { a.state = 'celebrate'; a.anim.play('celebrate', { startAt: Math.random() * 0.4 }); }
      } else if (a.state !== 'spectate') {
        a.state = 'dejected';
        a.anim.play('dejected');
      }
    }
    this.coaches[team].anim.play('celebrate');
    this.coaches[team === 'home' ? 'away' : 'home'].anim.play('dejected');
    this.ref.state = 'celebrate';
    this.ref.anim.play('refTD');
    this.updateHudBar();
    this.drawScoreboard();
    this.after(3.0, () => this.startKick('XP', team));
  }

  endGame() {
    const m = this.match;
    this.setPhase('final');
    const won = m.home > m.away;
    this.hud.hideBanner();
    const el = this.hud.el.final;
    el.innerHTML = `
      <div class="fin-head ${won ? 'won' : 'lost'}">${won ? 'VICTORY' : 'TOUGH LOSS'}</div>
      <div class="fin-score">${this.school.name.toUpperCase()} ${m.home} — ${m.away} ${this.rival.name.toUpperCase()}</div>
      <div class="fin-sub">${won ? `The ${this.school.mascot} are 1–0. The whole town's talking.` : `The ${this.school.mascot} will bounce back. Hit the film room.`}</div>
      <div class="fin-buttons">
        <button id="fin-rematch">REMATCH</button>
        <button id="fin-exit">BACK TO LOCKER ROOM</button>
      </div>`;
    el.classList.add('show');
    document.getElementById('fin-rematch').onclick = () => { el.classList.remove('show'); this.onRematch(); };
    document.getElementById('fin-exit').onclick = () => { el.classList.remove('show'); this.onExit(); };
    // field scene
    for (const a of this.allAthletes) {
      if (a.state === 'spectate') continue;
      const celebrating = (a.team === 'home') === won;
      a.state = celebrating ? 'celebrate' : 'dejected';
      a.anim.play(celebrating ? 'celebrate' : 'dejected', { startAt: Math.random() * 0.5 });
    }
    if (won) { sfx.horn(); sfx.crowd(1); this.stadium.crowd.setExcitement(1); }
  }

  // -------------------------------------------------- lineup & snap
  lineup() {
    const m = this.match;
    const play = this.offPlay;
    if (!play) { this.startSpecialCpu(); return; }
    this.setPhase('lineup');
    this.placeBallAt(m.losX, 0);
    const off = this.players[m.poss];
    const def = this.players[m.poss === 'home' ? 'away' : 'home'];
    const dir = m.dir;
    this._spots = new Map();

    const benchPark = (a, i) => {
      const zSide = a.team === 'home' ? 28.0 : -28.0;
      a.state = 'spectate';
      a.group.visible = !this.lowSpec;
      this._spots.set(a, [-16 + (i % 12) * 2.4, zSide + Math.floor(i / 12) * 1.0, a.team === 'home' ? Math.PI : 0]);
    };
    // offense
    let bi = 0;
    for (const role in off) {
      const a = off[role];
      a.engagedWith = null; a.hasBall = false; a.tuck = 0; a.look = null;
      if (role === 'K' || DEF_ROLES.includes(role)) { benchPark(a, bi++); continue; }
      const align = OL_ALIGN[role] || play.align[role];
      this._spots.set(a, [m.losX + align[0] * dir, align[1] * dir, dir > 0 ? Math.PI / 2 : -Math.PI / 2]);
      a.state = 'toSpot';
      a.group.visible = true;
    }
    // defense
    bi = 0;
    for (const role in def) {
      const a = def[role];
      a.engagedWith = null; a.hasBall = false; a.tuck = 0; a.look = null;
      if (role === 'K' || OFF_ROLES.includes(role)) { benchPark(a, bi++); continue; }
      const al = DEF_ALIGN[role];
      let ax = al[0], az = al[1];
      if (this.defPlay.press && (role === 'CB1' || role === 'CB2')) ax = 1.6;
      // CBs line over the receivers
      if (role === 'CB1' || role === 'CB2') az = (play.align[role === 'CB1' ? 'WR1' : 'WR2']?.[1] ?? az) + (az > 0 ? -0.8 : 0.8);
      this._spots.set(a, [m.losX + ax * -dir, az * dir, dir > 0 ? -Math.PI / 2 : Math.PI / 2]);
      a.state = 'toSpot';
      a.group.visible = true;
    }
    // ref trails the play
    this.ref.state = 'toSpot';
    this._spots.set(this.ref, [m.losX - 9 * dir, -14 * dir, dir > 0 ? Math.PI / 2 : -Math.PI / 2]);
    this.user = null;
    this.hud.hint('');
  }

  allLinedUp() {
    for (const [a, s] of this._spots) {
      if (a.state !== 'toSpot') continue;
      if (Math.hypot(a.pos.x - s[0], a.pos.z - s[1]) > 0.4) return false;
    }
    return true;
  }

  setAtLine() {
    const m = this.match;
    const play = this.offPlay;
    const off = this.players[m.poss];
    for (const [a, s] of this._spots) {
      if (a.state !== 'toSpot') continue;
      a.warp(s[0], s[1], s[2]);
      a.state = 'set';
      const role = a.role;
      if (a === this.ref) { a.anim.play('idle'); continue; }
      if (['LT', 'LG', 'C', 'RG', 'RT'].includes(role)) a.anim.play('stance3', { startAt: Math.random() * 0.5 });
      else if (['DE1', 'DT1', 'DT2', 'DE2'].includes(role)) a.anim.play('stance3', { startAt: Math.random() * 0.5 });
      else if (role === 'QB') a.anim.play(play.shotgun ? 'ready' : 'qbUnder');
      else if (['OLB1', 'MLB', 'OLB2', 'SS'].includes(role)) a.anim.play('stance2', { startAt: Math.random() * 0.5 });
      else a.anim.play('ready', { startAt: Math.random() * 0.5 });
    }
    this.setPhase('set');
    const userOnOffense = m.poss === 'home';
    if (userOnOffense) {
      this.hud.hint('<b>SPACE</b> snap · <b>WASD</b> move · <b>SHIFT</b> sprint');
    } else {
      this.user = this.players.home.MLB;
      this.hud.hint('<b>SPACE</b> snap the look · you have <b>MLB</b> · <b>E</b> switch · <b>SPACE</b> dive');
      this._cpuSnapT = rand(1.0, 2.2);
    }
  }

  snap() {
    const m = this.match;
    const play = this.offPlay;
    const off = this.players[m.poss];
    const def = this.players[m.poss === 'home' ? 'away' : 'home'];
    const dir = m.dir;
    sfx.hike();
    this.setPhase('live');
    this.liveT = 0;
    this.playDead = false;
    this._sackWarn = 0;

    const qb = off.QB;
    this.giveBall(qb, play.shotgun ? 'none' : 'hand');
    if (play.shotgun) {
      // ball flies back to the QB
      this.ballMode = 'snapfly';
      this.holder = null;
      this._snapTarget = qb;
      const from = v3(m.losX, 0.35, 0);
      this.ball.position.copy(from);
      const to = v3(qb.pos.x, 1.35, qb.pos.z);
      this.ballVel.copy(to).sub(from).multiplyScalar(1 / 0.28);
      qb.anim.play('snapCatch');
    }

    // offense assignments
    const insideOf = (z) => (z <= 0 ? 1 : -1);
    for (const role of OFF_ROLES) {
      const a = off[role];
      const asg = play.assignments?.[role];
      a.aiTimer = 0;
      if (['LT', 'LG', 'C', 'RG', 'RT'].includes(role)) {
        a.state = play.type === 'run' ? 'run-block' : 'pass-pro';
        a.blockAnchor = [a.pos.x, a.pos.z];
        continue;
      }
      if (role === 'QB') {
        a.state = m.poss === 'home' ? 'qb-user' : 'qb-cpu';
        a.dropSpot = [m.losX - (play.shotgun ? 7.5 : 6.5) * dir, 0];
        a.scanT = rand(1.0, 1.6) + (99 - a.info.iq) / 99;
        a.qbDecided = false;
        continue;
      }
      if (play.carrier === role) {
        a.state = 'mesh';
        a.waypoints = (play.paths[role] || []).map(([dx, dz]) => [m.losX + dx * dir, dz * dir]);
        a.wpIndex = 0;
        continue;
      }
      if (asg?.route) {
        a.state = 'route';
        const sx = a.pos.x, sz = a.pos.z;
        a.waypoints = asg.route.map(([dx, dzi]) => [sx + dx * dir, sz + dzi * insideOf(sz) ]);
        a.wpIndex = 0;
        continue;
      }
      if (asg?.leadBlock || (play.paths && play.paths[role])) {
        a.state = 'lead-block';
        a.waypoints = (play.paths?.[role] || [[2, 0]]).map(([dx, dz]) => [m.losX + dx * dir, dz * dir]);
        a.wpIndex = 0;
        continue;
      }
      a.state = 'stay-block';
      a.blockAnchor = [a.pos.x, a.pos.z];
    }

    // defense assignments
    const dp = this.defPlay;
    for (const role of DEF_ROLES) {
      const a = def[role];
      a.aiTimer = 0;
      a.paBitten = play.playAction ? rand(0.7, 1.3) : 0;
      if (dp.rush.includes(role)) { a.state = 'rush'; continue; }
      if (dp.man[role]) { a.state = 'man'; a.manTarget = off[dp.man[role]]; a.cushion = rand(0.6, 1.4); continue; }
      if (dp.zone[role]) {
        a.state = 'zone';
        const [zx, zz] = dp.zone[role];
        a.zoneSpot = [m.losX + zx * -dir, zz * dir];
        continue;
      }
      a.state = 'zone';
      a.zoneSpot = [m.losX + 6 * -dir, a.pos.z];
    }

    // run plays: schedule the exchange
    this._exchange = null;
    if (play.type === 'run' && play.carrier !== 'QB') {
      this._exchange = { done: false, toss: !!play.toss, t: 0 };
      qb.state = m.poss === 'home' ? 'qb-handoff' : 'qb-handoff';
    } else if (play.carrier === 'QB') {
      // sneak: QB is immediately the carrier
      qb.state = m.poss === 'home' ? 'user-carry' : 'carry';
      qb.tuck = 1;
      this.ballGrip = 'tuck';
      if (m.poss === 'home') this.user = qb;
    }
    if (m.poss === 'home' && play.type === 'pass') this.user = qb;

    this.targetsLive = (play.targets || []).map((r) => off[r]).filter(Boolean);
    this.hud.hint(m.poss === 'home'
      ? (play.type === 'pass' ? '<b>1-4</b> throw to receiver · <b>WASD</b> move · cross the line to run' : 'Hit the hole! <b>SHIFT</b> sprint · <b>SPACE</b> juke')
      : '<b>E</b> switch defender · <b>SPACE</b> dive tackle');
  }

  // -------------------------------------------------- live updates
  updateLive(dt) {
    const m = this.match;
    const play = this.offPlay;
    const off = this.players[m.poss];
    const def = this.players[m.poss === 'home' ? 'away' : 'home'];
    const dir = m.dir;
    this.liveT += dt;
    m.clock = Math.max(0, m.clock - dt);

    // snap flight to QB
    if (this.ballMode === 'snapfly') {
      this.ball.position.addScaledVector(this.ballVel, dt);
      this.ball.rotation.z += dt * 18;
      const qb = this._snapTarget;
      if (this.ball.position.distanceTo(v3(qb.pos.x, 1.35, qb.pos.z)) < 0.5 || this.liveT > 0.4) {
        this.giveBall(qb, 'hand');
      }
    }

    // run exchange
    if (this._exchange && !this._exchange.done) {
      const qb = off.QB, rb = off[play.carrier];
      this._exchange.t += dt;
      if (this._exchange.toss) {
        if (this._exchange.t > 0.42 && this.holder === qb) {
          // pitch: soft lob to the back
          this.ballMode = 'flight';
          this.holder = null;
          qb.anim.play('handoff', { force: true });
          const lead = v3(rb.pos.x + rb.vel.x * 0.4, 1.2, rb.pos.z + rb.vel.y * 0.4);
          const from = this.ball.position.clone();
          const t = 0.38;
          this.ballVel.set((lead.x - from.x) / t, (lead.y - from.y + 0.5 * G * t * t) / t, (lead.z - from.z) / t);
          this.ballMeta = { kind: 'pitch', target: rb };
          this.spin = 6;
        }
      } else if (this.holder === qb) {
        qb.anim.play('handoff');
        qb.faceToward(rb.pos.x, rb.pos.z);
        if (Math.hypot(qb.pos.x - rb.pos.x, qb.pos.z - rb.pos.z) < 1.15) {
          this.completeExchange(rb);
        }
      }
    }

    // brains
    for (const role of OFF_ROLES) this.brainOffense(off[role], dt);
    for (const role of DEF_ROLES) this.brainDefense(def[role], dt);
    this.updateEngagements(dt);

    // user control
    this.updateUserControl(dt);

    // motion + anim
    for (const a of this.allAthletes) {
      if (a.state === 'spectate') { a.anim.update(dt); continue; }
      if (a.state === 'down') {
        a.downTimer -= dt;
        a.stop();
        // slide out any momentum from the hit
        if (a.vel.lengthSq() > 0.01) {
          a.pos.x += a.vel.x * dt;
          a.pos.z += a.vel.y * dt;
          a.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
        }
        if (a.downTimer <= 0 && this.phase === 'live') { a.state = a.postDownState || 'pursuit'; a.anim.play('getUp', { fade: 0.2 }); }
        a.anim.update(dt);
        continue;
      }
      const lockAnim = ['set', 'engaged', 'qb-user', 'qb-cpu', 'qb-handoff', 'throwing', 'diving', 'catching'].includes(a.state)
        || a.anim.name === 'tackleLunge' || a.anim.name === 'fallFwd' || a.anim.name === 'fallBack'
        || (a.anim.name === 'getUp' && !a.anim.finished)
        || (['jukeL', 'jukeR', 'stumble', 'catchHigh', 'catchLow'].includes(a.anim.name) && !a.anim.finished);
      a.move(dt, { lockAnim });
      a.anim.update(dt);
    }
    this.ref.seek(THREE.MathUtils.clamp((this.holder?.pos.x ?? this.ball.position.x) - 8 * dir, -58, 58), -14 * dir, 0.8);
    this.ref.move(dt);
    this.ref.anim.update(dt);
    this.coaches.home.anim.update(dt);
    this.coaches.away.anim.update(dt);

    // ball
    this.updateBall(dt);

    // carrier outcomes: TD, OOB, safety zone
    const carrier = this.holder;
    if (carrier && this.phase === 'live' && ['carry', 'user-carry', 'return'].includes(carrier.state)) {
      const cd = carrier.team === m.poss ? dir : -dir;
      if (carrier.pos.x * cd >= GOAL + 0.2) {
        this.touchdown(carrier.team);
        return;
      }
      if (Math.abs(carrier.pos.z) > SIDE - 0.3) {
        if (carrier.team !== m.poss) { this.interceptDead(carrier); return; }
        this.endPlay('oob', carrier.pos.x, Math.sign(carrier.pos.z) * (SIDE - 0.4));
        return;
      }
    }
    // QB scramble crossing the LOS becomes a run
    const qb = off.QB;
    if (this.holder === qb && (qb.state === 'qb-user' || qb.state === 'qb-cpu') && (qb.pos.x - m.losX) * dir > 0.4) {
      qb.state = qb.team === 'home' ? 'user-carry' : 'carry';
      qb.tuck = 1;
      this.ballGrip = 'tuck';
      this.targetsLive = [];
      this.hud.clearIcons();
      if (qb.team === 'home') { this.user = qb; this.hud.hint('Scramble! <b>SHIFT</b> sprint · <b>SPACE</b> juke'); }
    }

    // receiver icons
    if (m.poss === 'home' && this.holder === qb && play.type === 'pass' && ['qb-user'].includes(qb.state)) {
      this.projectIcons();
    }
  }

  completeExchange(rb) {
    this._exchange.done = true;
    this.giveBall(rb, 'tuck');
    rb.tuck = 1;
    rb.state = rb.team === 'home' ? 'user-carry' : 'carry';
    if (rb.team === 'home') this.user = rb;
    const qb = this.players[this.match.poss].QB;
    qb.state = 'fade-out';
    qb.waypoints = [[qb.pos.x - 3 * this.match.dir, qb.pos.z + 2]];
    qb.wpIndex = 0;
  }

  interceptDead(defender) {
    // defender with the ball tackled/out: his team takes over there
    this.setPhase('dead');
    sfx.whistle();
    const spot = THREE.MathUtils.clamp(defender.pos.x, -45, 45);
    this.after(1.6, () => this.startDrive(defender.team, spot));
  }

  // -------------------------------------------------- brains
  brainOffense(a, dt) {
    const m = this.match, dir = m.dir;
    switch (a.state) {
      case 'route': {
        const wp = a.waypoints[a.wpIndex];
        if (!wp) { a.state = 'improv'; break; }
        const d = a.seek(wp[0], wp[1], 0.96);
        if (d < 0.6) a.wpIndex++;
        break;
      }
      case 'improv': {
        // find grass: drift away from nearest defender, slight upfield bias
        const near = this.nearestOpponent(a);
        let dx = dir * 0.6, dz = 0;
        if (near && near.d < 6) {
          dx += (a.pos.x - near.a.pos.x) / near.d;
          dz += (a.pos.z - near.a.pos.z) / near.d;
        }
        a.seek(a.pos.x + dx * 3, THREE.MathUtils.clamp(a.pos.z + dz * 3, -SIDE + 2, SIDE - 2), 0.45);
        break;
      }
      case 'mesh': {
        const wp = a.waypoints[a.wpIndex];
        if (!wp) { a.stop(); break; }
        const frac = this._exchange?.done ? 1 : 0.82;
        const d = a.seek(wp[0], wp[1], frac);
        if (d < 0.7) a.wpIndex = Math.min(a.wpIndex + 1, a.waypoints.length - 1);
        break;
      }
      case 'carry': {
        // CPU ball carrier: head for the end zone, avoid tacklers, stay inbounds
        const cd = a.team === m.poss ? dir : -dir;
        let tx = cd * 60, tz = a.pos.z * 0.6;
        let avoid = new THREE.Vector2();
        for (const d of Object.values(this.players[a.team === 'home' ? 'away' : 'home'])) {
          if (d.state === 'down' || d.state === 'spectate' || d.state === 'engaged') continue;
          const dx = a.pos.x - d.pos.x, dz = a.pos.z - d.pos.z;
          const dd = Math.hypot(dx, dz);
          if (dd < 5 && dd > 0.01) avoid.add(new THREE.Vector2(dx / dd, dz / dd).multiplyScalar((5 - dd) / 5));
        }
        tz += avoid.y * 7;
        tz = THREE.MathUtils.clamp(tz + avoid.y * 4, -SIDE + 1.5, SIDE - 1.5);
        a.seek(tx, tz, 1);
        const near = this.nearestOpponent(a);
        if (near && near.d < 1.7 && Math.random() < dt * 1.2) {
          a.anim.play(Math.random() < 0.5 ? 'jukeL' : 'jukeR', { force: true });
          a.jukeT = 0.4;
        }
        if (a.jukeT > 0) a.jukeT -= dt;
        break;
      }
      case 'fade-out': {
        const wp = a.waypoints[0];
        if (wp && a.seek(wp[0], wp[1], 0.5) < 1) { a.stop(); a.state = 'watch'; }
        break;
      }
      case 'watch': a.stop(); break;
      case 'qb-handoff': {
        if (this.holder === a) {
          // settle toward the mesh point
          const hp = this.offPlay.handoff || { x: -2.4, z: 0.4 };
          a.seek(m.losX + hp.x * dir, hp.z * dir, 0.5);
          a.anim.play('handoff');
        } else { a.state = 'fade-out'; a.waypoints = [[a.pos.x - 2 * dir, a.pos.z + 2]]; a.wpIndex = 0; }
        break;
      }
      case 'qb-cpu': {
        this.brainCpuQb(a, dt);
        break;
      }
      case 'pass-pro': {
        // slide between the nearest free rusher and the QB
        const qb = this.players[m.poss].QB;
        const rusher = this.findRusherFor(a);
        if (rusher) {
          const mid = v3().addVectors(rusher.pos, qb.pos).multiplyScalar(0.5);
          a.seek(mid.x, mid.z, 0.85);
          a.faceToward(rusher.pos.x, rusher.pos.z);
          if (Math.hypot(a.pos.x - rusher.pos.x, a.pos.z - rusher.pos.z) < 1.25) this.engage(a, rusher, 'pass');
          if (a.vel.length() < 2) a.anim.play('block');
        } else {
          a.seek(a.blockAnchor[0] - 0.6 * dir, a.blockAnchor[1], 0.4);
          a.anim.play('block');
        }
        break;
      }
      case 'run-block': {
        const rusher = this.findRusherFor(a, 3.2);
        if (rusher) {
          a.seek(rusher.pos.x, rusher.pos.z, 0.95);
          if (Math.hypot(a.pos.x - rusher.pos.x, a.pos.z - rusher.pos.z) < 1.2) this.engage(a, rusher, 'run');
        } else {
          a.seek(a.pos.x + 1.5 * dir, a.pos.z, 0.6);
          a.anim.play('block');
        }
        break;
      }
      case 'lead-block': {
        const wp = a.waypoints[a.wpIndex];
        if (wp) {
          if (a.seek(wp[0], wp[1], 0.92) < 0.8) a.wpIndex++;
        } else {
          const near = this.nearestOpponent(a, (d) => !['down', 'engaged', 'spectate'].includes(d.state));
          if (near && near.d < 3.5) {
            a.seek(near.a.pos.x, near.a.pos.z, 0.95);
            if (near.d < 1.15) this.engage(a, near.a, 'run');
          } else { a.seek(a.pos.x + 2 * dir, a.pos.z, 0.5); }
        }
        break;
      }
      case 'stay-block': {
        const near = this.nearestOpponent(a, (d) => !['down', 'engaged', 'spectate'].includes(d.state));
        if (near && near.d < 3.0) {
          a.seek(near.a.pos.x, near.a.pos.z, 0.85);
          if (near.d < 1.15) this.engage(a, near.a, 'pass');
        } else { a.stop(); a.anim.play('block'); }
        break;
      }
    }
  }

  brainCpuQb(a, dt) {
    const m = this.match, dir = m.dir;
    if (this.holder !== a) { a.stop(); return; }
    a.scanT -= dt;
    const drop = a.dropSpot;
    const atSpot = Math.hypot(a.pos.x - drop[0], a.pos.z - drop[1]) < 0.7;
    if (!atSpot && this.liveT < 1.6) {
      a.seek(drop[0], drop[1], 0.8);
    } else {
      a.stop();
      a.anim.play('throwHold');
      const lead = this.bestTarget(a);
      if (lead) a.faceToward(lead.a.pos.x, lead.a.pos.z);
    }
    const pressure = this.nearestOpponent(a, (d) => ['rush', 'pursuit'].includes(d.state));
    const pressured = pressure && pressure.d < 2.3;
    if (this.offPlay.type === 'run') return; // sneak handled as carry
    if (!a.qbDecided && (a.scanT <= 0 || pressured) && this.liveT > 0.9) {
      const best = this.bestTarget(a);
      const must = this.liveT > 3.4 || pressured;
      if (best && (best.score > 1.6 || (must && best.score > 0.2))) {
        a.qbDecided = true;
        this.startThrow(a, best.a);
      } else if (must) {
        a.qbDecided = true;
        if (a.info.spd > 78 || Math.random() < 0.5) {
          a.state = 'carry';
          a.tuck = 1;
          this.ballGrip = 'tuck';
        } else {
          this.startThrow(a, null); // throwaway
        }
      } else {
        a.scanT = 0.35;
      }
    }
  }

  bestTarget(qb) {
    let best = null;
    for (const t of this.targetsLive) {
      if (['down', 'engaged'].includes(t.state)) continue;
      const near = this.nearestOpponent(t);
      const sep = near ? near.d : 9;
      const depth = (t.pos.x - this.match.losX) * this.match.dir;
      const score = sep * 0.7 + Math.min(depth, 18) * 0.06 + (t.info.hands - 70) * 0.01;
      if (!best || score > best.score) best = { a: t, score, sep };
    }
    return best;
  }

  nearestOpponent(a, filter = null) {
    const oppTeam = a.team === 'home' ? 'away' : 'home';
    let best = null;
    for (const role in this.players[oppTeam]) {
      const d = this.players[oppTeam][role];
      if (d.state === 'spectate') continue;
      if (filter && !filter(d)) continue;
      const dd = Math.hypot(a.pos.x - d.pos.x, a.pos.z - d.pos.z);
      if (!best || dd < best.d) best = { a: d, d: dd };
    }
    return best;
  }

  findRusherFor(blocker, range = 6) {
    const oppTeam = blocker.team === 'home' ? 'away' : 'home';
    let best = null;
    for (const role in this.players[oppTeam]) {
      const d = this.players[oppTeam][role];
      if (d.state !== 'rush' && d.state !== 'pursuit') continue;
      if (d.engagedWith) continue;
      // don't double-team: skip if another blocker is closer
      const dd = Math.hypot(blocker.pos.x - d.pos.x, blocker.pos.z - d.pos.z);
      if (dd > range) continue;
      if (!best || dd < best.dd) best = { a: d, dd };
    }
    return best ? best.a : null;
  }

  brainDefense(a, dt) {
    const m = this.match, dir = m.dir;
    const carrier = this.holder;
    const ballLive = this.ballMode === 'flight' && this.ballMeta?.kind === 'pass';
    // play-action freeze
    if (a.paBitten > 0) {
      a.paBitten -= dt;
      if (['man', 'zone'].includes(a.state) && ['MLB', 'OLB1', 'OLB2', 'SS'].includes(a.role)) {
        a.seek(m.losX, a.pos.z, 0.5);
        return;
      }
    }
    // once somebody is running with the ball, everyone rallies
    const carrierLoose = carrier && ['carry', 'user-carry', 'return'].includes(carrier.state) && carrier.team !== a.team;
    if (carrierLoose && !['down', 'engaged', 'user-def', 'diving'].includes(a.state)) a.state = 'pursuit';

    switch (a.state) {
      case 'rush': {
        const qb = carrier && carrier.team !== a.team ? carrier : this.players[m.poss].QB;
        a.seek(qb.pos.x, qb.pos.z, 1);
        if (carrier && carrier.team !== a.team && Math.hypot(a.pos.x - carrier.pos.x, a.pos.z - carrier.pos.z) < 1.05) {
          this.attemptTackle(a, carrier);
        }
        break;
      }
      case 'man': {
        const t = a.manTarget;
        if (!t) { a.state = 'zone'; a.zoneSpot = [a.pos.x, a.pos.z]; break; }
        if (ballLive && this.ballMeta.target === t) { a.state = 'ballhawk'; break; }
        const cushion = a.cushion * (a.maxSpd >= t.maxSpd ? 0.6 : 1.3);
        const tx = t.pos.x + t.vel.x * 0.22 - dir * cushion;
        const tz = t.pos.z + t.vel.y * 0.22;
        const d = a.seek(tx, tz, 1);
        if (d < 1.2) { a.seek(tx, tz, 0.4); }
        if (d < 2.0 && Math.abs(t.vel.x) + Math.abs(t.vel.y) < 2) a.anim.play('backpedal');
        break;
      }
      case 'zone': {
        if (ballLive) {
          const land = this.ballLanding();
          if (land && Math.hypot(land.x - a.zoneSpot[0], land.z - a.zoneSpot[1]) < 8) { a.state = 'ballhawk'; break; }
        }
        const d = a.seek(a.zoneSpot[0], a.zoneSpot[1], 0.9);
        if (d < 0.8) {
          a.stop();
          const qb = this.players[m.poss].QB;
          a.faceToward(qb.pos.x, qb.pos.z);
          a.anim.play('backpedal', { rate: 0.7 });
        }
        break;
      }
      case 'ballhawk': {
        const land = this.ballLanding();
        if (!land) { a.state = 'pursuit'; break; }
        a.seek(land.x, land.z, 1);
        break;
      }
      case 'pursuit': {
        if (!carrier || carrier.team === a.team) { a.seek(this.ball.position.x, this.ball.position.z, 0.85); break; }
        const dd = Math.hypot(a.pos.x - carrier.pos.x, a.pos.z - carrier.pos.z);
        const lead = Math.min(dd / a.maxSpd, 0.6);
        a.seek(carrier.pos.x + carrier.vel.x * lead, carrier.pos.z + carrier.vel.y * lead, 1);
        if (dd < 1.05) this.attemptTackle(a, carrier);
        break;
      }
      case 'diving': {
        a.diveTimer -= dt;
        if (carrier && carrier.team !== a.team && Math.hypot(a.pos.x - carrier.pos.x, a.pos.z - carrier.pos.z) < 1.35) {
          this.attemptTackle(a, carrier, { dive: true });
        }
        if (a.diveTimer <= 0) { a.state = 'down'; a.downTimer = 0.7; a.postDownState = 'pursuit'; }
        break;
      }
    }
  }

  // -------------------------------------------------- blocking
  engage(blocker, defender, mode) {
    if (blocker.engagedWith || defender.engagedWith) return;
    if (defender.state === 'down' || defender.state === 'diving') return;
    blocker.engagedWith = defender;
    defender.engagedWith = blocker;
    blocker.state = 'engaged';
    defender.state = 'engaged';
    blocker.anim.play('block', { startAt: Math.random() * 0.5 });
    defender.anim.play('block', { startAt: Math.random() * 0.5 });
    const strDiff = (blocker.info.str - defender.info.str) / 99;
    this.engagements.push({
      blk: blocker, def: defender, mode,
      shed: rand(2.0, 3.8) + strDiff * 1.8,
    });
  }

  updateEngagements(dt) {
    const m = this.match, dir = m.dir;
    const qb = this.players[m.poss].QB;
    for (let i = this.engagements.length - 1; i >= 0; i--) {
      const e = this.engagements[i];
      e.shed -= dt;
      const { blk, def } = e;
      // drive: pass-pro gives ground slowly toward QB; run blocks push downfield
      const pushDir = e.mode === 'run' ? dir : -dir * 0.35;
      const strDiff = (blk.info.str - def.info.str) / 99;
      const drive = (0.25 + strDiff * 0.5) * (e.mode === 'run' ? 1 : 0.5);
      def.pos.x += pushDir * Math.max(-0.2, drive) * dt;
      blk.pos.x = def.pos.x - dir * 0.95;
      blk.pos.z += (def.pos.z - blk.pos.z) * 0.5 * dt * 5;
      blk.faceToward(def.pos.x, def.pos.z);
      def.faceToward(blk.pos.x, blk.pos.z);
      blk.vel.set(0, 0); def.vel.set(0, 0);
      // small lateral jostle
      const jx = Math.sin(this.t * 7 + i * 2) * 0.12 * dt;
      blk.pos.z += jx; def.pos.z += jx;
      const finished = this.phase !== 'live';
      if (e.shed <= 0 || finished) {
        blk.engagedWith = null;
        def.engagedWith = null;
        this.engagements.splice(i, 1);
        if (finished) { blk.state = 'watch'; def.state = 'watch'; continue; }
        // defender sheds the block
        def.state = 'pursuit';
        blk.state = 'beaten';
        blk.anim.play('stumble', { force: true });
        blk.slowTimer = 0.55;
        this.after(0.6, () => { if (blk.state === 'beaten') blk.state = this.offPlay?.type === 'run' ? 'run-block' : 'pass-pro'; });
      }
    }
  }

  // -------------------------------------------------- tackling
  attemptTackle(tackler, carrier, { dive = false } = {}) {
    if (this.phase !== 'live' || this.playDead) return;
    if (carrier.state === 'throwing') return; // ball's already coming out
    if (tackler.tackleCd > this.t) return;
    tackler.tackleCd = this.t + 0.9;
    const jukeBonus = carrier.jukeT > 0 ? 0.30 : 0;
    const breakChance = THREE.MathUtils.clamp(0.16 + (carrier.info.str - tackler.info.str) / 280 + jukeBonus - (dive ? 0.1 : 0), 0.04, 0.62);
    if (Math.random() < breakChance) {
      // broken tackle!
      tackler.state = 'down';
      tackler.downTimer = 1.0;
      tackler.postDownState = 'pursuit';
      tackler.anim.play('fallFwd', { force: true });
      carrier.slowTimer = 0.4;
      carrier.anim.play('stumble', { force: true });
      sfx.thud();
      this.stadium.crowd.setExcitement(carrier.team === 'home' ? 0.75 : 0.3);
      return;
    }
    this.doTackle(tackler, carrier);
  }

  doTackle(tackler, carrier) {
    this.playDead = true;
    sfx.thud();
    const m = this.match;
    // who else piles on
    const oppTeam = carrier.team === 'home' ? 'away' : 'home';
    tackler.state = 'tackling';
    tackler.anim.play('tackleLunge', { force: true });
    tackler.faceToward(carrier.pos.x, carrier.pos.z);
    // crash through the contact
    const tdx = carrier.pos.x - tackler.pos.x, tdz = carrier.pos.z - tackler.pos.z;
    const tdd = Math.hypot(tdx, tdz) || 1;
    tackler.vel.set((tdx / tdd) * 5.5, (tdz / tdd) * 5.5);
    // carrier falls based on the hit direction
    const hitFromFront = (carrier.vel.x * (tackler.pos.x - carrier.pos.x) + carrier.vel.y * (tackler.pos.z - carrier.pos.z)) > 0;
    carrier.state = 'down';
    carrier.downTimer = 2.2;
    carrier.postDownState = 'watch';
    carrier.anim.play(hitFromFront ? 'fallBack' : 'fallFwd', { force: true });
    carrier.vel.multiplyScalar(hitFromFront ? -0.1 : 0.35); // fall through the hit
    if (this.user === carrier || this.user === tackler) this.user = null;
    for (const role in this.players[oppTeam]) {
      const d = this.players[oppTeam][role];
      if (d === tackler || d.state === 'down' || d.state === 'spectate' || d.state === 'engaged') continue;
      if (Math.hypot(d.pos.x - carrier.pos.x, d.pos.z - carrier.pos.z) < 1.7) {
        d.state = 'down';
        d.downTimer = rand(1.0, 1.5);
        d.postDownState = 'watch';
        d.anim.play('fallFwd', { force: true });
      }
    }
    this.after(0.36, () => {
      tackler.state = 'down';
      tackler.downTimer = 1.1;
      tackler.postDownState = 'watch';
      tackler.anim.play('fallFwd', { force: true });
    });
    // the ball is down where the carrier was
    const spotX = carrier.pos.x, spotZ = carrier.pos.z;
    if (carrier.team !== m.poss) {
      // intercept return ended
      this.after(0.5, () => this.interceptDead(carrier));
    } else {
      const sacked = carrier.role === 'QB' && (spotX - m.losX) * m.dir < 0 && this.offPlay.type === 'pass';
      this.after(0.42, () => this.endPlay(sacked ? 'sack' : 'tackle', spotX, spotZ));
    }
  }

  // -------------------------------------------------- throwing & catching
  startThrow(qb, target) {
    if (this.holder !== qb) return;
    qb.state = 'throwing';
    qb.stop();
    qb.vel.set(0, 0);
    this.ballGrip = 'hand';
    if (target) qb.faceToward(target.pos.x, target.pos.z);
    qb.anim.play('throwRelease', { force: true });
    this.hud.clearIcons();
    this.after(THROW_RELEASE_S, () => {
      if (this.holder !== qb) return;
      this.releaseBall(qb, target);
      this.after(0.5, () => { if (qb.state === 'throwing') qb.state = 'watch'; });
    });
  }

  /** Where will this receiver be in tt seconds? Follows his route if he's on one. */
  predictReceiver(target, tt) {
    if (target.state !== 'route' || !target.waypoints?.length || target.wpIndex >= target.waypoints.length) {
      return v3(target.pos.x + target.vel.x * tt * 0.92, 1.35, target.pos.z + target.vel.y * tt * 0.92);
    }
    let px = target.pos.x, pz = target.pos.z;
    let rem = tt * target.maxSpd * 0.94;
    let i = target.wpIndex;
    while (rem > 0 && i < target.waypoints.length) {
      const [wx, wz] = target.waypoints[i];
      const d = Math.hypot(wx - px, wz - pz);
      if (d > rem) { px += ((wx - px) / d) * rem; pz += ((wz - pz) / d) * rem; rem = 0; }
      else { px = wx; pz = wz; rem -= d; i++; }
    }
    return v3(px, 1.35, pz);
  }

  releaseBall(qb, target) {
    const m = this.match;
    this.holder = null;
    this.ballMode = 'flight';
    qb.hasBall = false;
    const from = this.ball.position.clone();
    let to, tFlight;
    if (target) {
      const dist0 = Math.hypot(target.pos.x - from.x, target.pos.z - from.z);
      tFlight = THREE.MathUtils.clamp(dist0 / 21, 0.45, 1.85);
      // lead the receiver along his route (two passes to converge flight time)
      to = this.predictReceiver(target, tFlight);
      tFlight = THREE.MathUtils.clamp(Math.hypot(to.x - from.x, to.z - from.z) / 21, 0.4, 1.9);
      to = this.predictReceiver(target, tFlight);
      // accuracy noise
      const acc = (qb.info.arm ?? 75) / 99;
      const moving = qb.vel.length() > 2 ? 1.8 : 1;
      const err = (1.15 - acc) * moving;
      to.x += rand(-err, err) * 1.6;
      to.z += rand(-err, err) * 1.6;
      to.x = THREE.MathUtils.clamp(to.x, -EZ_BACK + 1, EZ_BACK - 1);
    } else {
      // throwaway toward the sideline
      to = v3(qb.pos.x + m.dir * 8, 0.5, Math.sign(qb.pos.z || 1) * (SIDE + 6));
      tFlight = 0.9;
    }
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    tFlight = THREE.MathUtils.clamp(dist / 21, 0.4, 1.9);
    this.ballVel.set(
      (to.x - from.x) / tFlight,
      (to.y - from.y + 0.5 * G * tFlight * tFlight) / tFlight,
      (to.z - from.z) / tFlight
    );
    this.ballMeta = { kind: 'pass', target, thrower: qb, resolved: false };
    this.spin = 16;
  }

  ballLanding() {
    if (this.ballMode !== 'flight') return null;
    const p = this.ball.position, vy = this.ballVel.y;
    const h = 1.1;
    const disc = vy * vy + 2 * G * (p.y - h);
    if (disc < 0) return null;
    const t = (vy + Math.sqrt(disc)) / G;
    return { x: p.x + this.ballVel.x * t, z: p.z + this.ballVel.z * t, t };
  }

  updateBall(dt) {
    if (this.ballMode === 'held') {
      this.updateHeldBall();
      return;
    }
    if (this.ballMode !== 'flight' && this.ballMode !== 'kickfly') return;
    // substep so a fast ball can't tunnel through catch radii on slow frames
    let rem = dt;
    while (rem > 0.0001) {
      const h = Math.min(rem, 0.033);
      rem -= h;
      const before = this.ballMode;
      this.stepBall(h);
      if (this.ballMode !== before) break;
    }
  }

  stepBall(dt) {
    // physics
    this.ballVel.y -= G * dt;
    this.ball.position.addScaledVector(this.ballVel, dt);
    // orient nose along velocity + spiral
    if (this.ballVel.lengthSq() > 1) {
      const d = this.ballVel.clone().normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(v3(1, 0, 0), d);
      this._roll = (this._roll || 0) + this.spin * dt;
      const qr = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), this._roll);
      this.ball.quaternion.copy(q.multiply(qr));
    }

    if (this.ballMode === 'kickfly') { this.updateKickBall(dt); return; }

    const meta = this.ballMeta;
    if (meta?.kind === 'pitch') {
      const rb = meta.target;
      if (this.ball.position.distanceTo(v3(rb.pos.x, 1.1, rb.pos.z)) < 0.8) {
        this.completeExchange(rb);
        this.ballMeta = null;
      } else if (this.ball.position.y < 0.15) {
        // muffed pitch — just give it to him (no fumbles on Friday night)
        this.completeExchange(rb);
        this.ballMeta = null;
      }
      return;
    }
    if (meta?.kind === 'pass' && !meta.resolved) {
      // can anyone make a play on this ball?
      const candidates = [];
      if (meta.target && !['down'].includes(meta.target.state)) candidates.push(meta.target);
      const defTeam = this.match.poss === 'home' ? 'away' : 'home';
      for (const role of DEF_ROLES) {
        const d = this.players[defTeam][role];
        if (['down', 'engaged', 'spectate'].includes(d.state)) continue;
        candidates.push(d);
      }
      const bp = this.ball.position;
      for (const c of candidates) {
        const reach = v3(c.pos.x, 1.45, c.pos.z);
        if (bp.distanceTo(reach) < 1.05 && bp.y < 2.6) {
          this.resolveCatch(c, meta);
          return;
        }
      }
      if (bp.y < 0.14) {
        meta.resolved = true;
        this.ballMode = 'ground';
        this.endPlay('incomplete', this.match.losX);
      }
      // sideline overthrow
      if (Math.abs(bp.z) > SIDE + 8 && bp.y < 1) {
        meta.resolved = true;
        this.ballMode = 'ground';
        this.endPlay('incomplete', this.match.losX);
      }
    }
  }

  resolveCatch(catcher, meta) {
    const m = this.match;
    const isOffense = catcher.team === m.poss;
    const near = this.nearestOpponent(catcher);
    const contested = near && near.d < 1.1;
    meta.resolved = true;
    if (!isOffense) {
      // defender on the ball: pick or swat
      const pickChance = (catcher.info.hands / 99) * (contested ? 0.30 : 0.55);
      if (Math.random() < pickChance) {
        this.giveBall(catcher, 'tuck');
        catcher.tuck = 1;
        catcher.state = 'return';
        catcher.anim.play(this.ball.position.y > 1.7 ? 'catchHigh' : 'catchLow', { force: true });
        sfx.catchPop();
        this.hud.banner('INTERCEPTED!', `${catcher.info.name} jumps the route`, 2000, m.poss === 'home' ? 'bad' : 'good');
        this.stadium.crowd.setExcitement(m.poss === 'home' ? 0.3 : 0.9);
        if (catcher.team === 'home') { this.user = catcher; this.hud.hint('Take it back! <b>SHIFT</b> sprint'); }
        // possession flips live: pursuit flips too
        for (const a of Object.values(this.players[m.poss])) {
          if (!['down', 'engaged', 'spectate'].includes(a.state)) a.state = 'pursuit';
        }
      } else {
        // batted down
        this.ballVel.set(rand(-3, 3), rand(2, 4), rand(-3, 3));
        this.ballMeta = { kind: 'dead' };
        catcher.anim.play('catchHigh', { force: true });
        this.after(0.6, () => { if (this.phase === 'live') { this.ballMode = 'ground'; this.endPlay('incomplete', m.losX); } });
      }
      return;
    }
    // offensive catch attempt
    let prob = 0.62 + (catcher.info.hands / 99) * 0.33;
    if (contested) prob -= 0.38;
    if (this.ballVel.length() > 24) prob -= 0.08;
    if (Math.random() < prob) {
      this.giveBall(catcher, 'tuck');
      catcher.tuck = 1;
      sfx.catchPop();
      catcher.anim.play(this.ball.position.y > 1.7 ? 'catchHigh' : 'catchLow', { force: true });
      catcher.slowTimer = 0.35;
      catcher.state = catcher.team === 'home' ? 'user-carry' : 'carry';
      if (catcher.team === 'home') {
        this.user = catcher;
        this.hud.hint('<b>SHIFT</b> sprint · <b>SPACE</b> juke');
      }
      this.stadium.crowd.setExcitement(catcher.team === 'home' ? 0.6 : 0.25);
      // instant TD check happens in updateLive
    } else {
      // drop / breakup
      this.ballVel.set(rand(-2.5, 2.5), rand(1.5, 3.2), rand(-2.5, 2.5));
      this.ballMeta = { kind: 'dead' };
      catcher.anim.play('catchHigh', { force: true });
      if (contested && near) near.a.anim.play('catchHigh', { force: true });
      this.after(0.6, () => { if (this.phase === 'live') { this.ballMode = 'ground'; this.endPlay('incomplete', m.losX); } });
    }
  }

  // -------------------------------------------------- user control
  updateUserControl(dt) {
    const a = this.user;
    if (!a || this.phase !== 'live') return;
    if (['down', 'throwing', 'diving', 'tackling'].includes(a.state)) return;
    const k = this.keys;
    let ix = 0, iz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) ix += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) ix -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) iz -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) iz += 1;
    // camera-relative: the camera always looks down the offense's drive,
    // so W = away from camera (upfield), D = screen-right
    const dir = this.match.dir;
    const wx = ix * dir, wz = -iz * dir;
    const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    const mag = Math.hypot(wx, wz);
    if (a.state === 'qb-user') {
      if (mag > 0) {
        a._desired.set(wx / mag, wz / mag).multiplyScalar(a.maxSpd * (sprint ? 0.78 : 0.55));
        a.look = null;
      } else {
        a.stop();
        a.anim.play('throwHold');
        const best = this.bestTarget(a);
        if (best) {
          const yaw = Math.atan2(best.a.pos.x - a.pos.x, best.a.pos.z - a.pos.z) - a.facing;
          a.look = { yaw: THREE.MathUtils.radToDeg(Math.atan2(Math.sin(yaw), Math.cos(yaw))) * 0.5, pitch: 0 };
        }
      }
      return;
    }
    if (a.state === 'user-carry' || a.state === 'return') {
      if (mag > 0) {
        a._desired.set(wx / mag, wz / mag).multiplyScalar(a.maxSpd * (sprint ? 1 : 0.72));
      } else {
        a._desired.multiplyScalar(0.86);
      }
      if (a.jukeT > 0) a.jukeT -= dt;
      return;
    }
    if (a.state === 'user-def' || (a.team !== this.match.poss && ['man', 'zone', 'rush', 'pursuit', 'ballhawk'].includes(a.state) && a === this.user)) {
      a.state = 'user-def';
      if (mag > 0) {
        a._desired.set(wx / mag, wz / mag).multiplyScalar(a.maxSpd * (sprint ? 1 : 0.75));
      } else {
        a._desired.multiplyScalar(0.8);
      }
      // auto tackle on contact
      const carrier = this.holder;
      if (carrier && carrier.team !== a.team && ['carry', 'user-carry', 'qb-user', 'qb-cpu', 'mesh'].includes(carrier.state)) {
        if (Math.hypot(a.pos.x - carrier.pos.x, a.pos.z - carrier.pos.z) < 1.0) this.attemptTackle(a, carrier);
      }
    }
  }

  userThrow(i) {
    const a = this.user;
    if (!a || a.state !== 'qb-user' || this.holder !== a) return;
    const t = this.targetsLive[i];
    if (!t || ['down'].includes(t.state)) return;
    this.startThrow(a, t);
  }

  userJuke() {
    const a = this.user;
    if (!a) return;
    if (a.state === 'user-carry' || a.state === 'return') {
      if (this.t < (a._jukeCd || 0)) return;
      a._jukeCd = this.t + 1.1;
      a.jukeT = 0.45;
      const side = Math.random() < 0.5 ? -1 : 1;
      a.anim.play(side < 0 ? 'jukeL' : 'jukeR', { force: true });
      // lateral burst
      const lat = v3(Math.cos(a.facing), 0, -Math.sin(a.facing)).multiplyScalar(side * 4.5);
      a.vel.x += lat.x; a.vel.y += lat.z;
      return;
    }
    if (a.state === 'user-def') {
      // dive tackle
      a.state = 'diving';
      a.diveTimer = 0.42;
      a.anim.play('tackleLunge', { force: true });
      const f = v3(Math.sin(a.facing), 0, Math.cos(a.facing));
      a.vel.x += f.x * 5.5; a.vel.y += f.z * 5.5;
    }
  }

  switchDefender() {
    if (this.match.poss === 'home' || this.phase !== 'live') return;
    const focus = this.holder ? this.holder.pos : this.ball.position;
    let best = null;
    for (const role of DEF_ROLES) {
      const d = this.players.home[role];
      if (['down', 'engaged', 'diving'].includes(d.state) || d === this.user) continue;
      const dd = Math.hypot(d.pos.x - focus.x, d.pos.z - focus.z);
      if (!best || dd < best.dd) best = { a: d, dd };
    }
    if (best) {
      if (this.user && this.user.state === 'user-def') this.user.state = 'pursuit';
      this.user = best.a;
      this.user.state = 'user-def';
      sfx.chime();
    }
  }

  projectIcons() {
    const list = [];
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.targetsLive.forEach((t, i) => {
      const p = v3(t.pos.x, t.pos.y + 2.55, t.pos.z).project(this.camera);
      if (p.z > 1) return;
      const near = this.nearestOpponent(t);
      list.push({
        key: i + 1,
        x: (p.x * 0.5 + 0.5) * w,
        y: (-p.y * 0.5 + 0.5) * h,
        label: `${t.role} #${t.info.num}`,
        hot: near && near.d > 3.5,
      });
    });
    this.hud.icons(list);
  }

  // -------------------------------------------------- special teams
  startSpecialCpu() {
    if (this._cpuSpecial === 'FG') this.startKick('FG');
    else this.startPunt();
    this._cpuSpecial = null;
  }

  startPunt() {
    const m = this.match;
    this.setPhase('punt');
    this.hud.hidePlaycall();
    this.hud.hint('');
    const team = m.poss;
    const punter = this.players[team].K;
    // everyone else lines up loosely
    this.lineupSpecial(team);
    punter.state = 'kick-script';
    punter.group.visible = true;
    punter.warp(m.losX - 12 * m.dir, 0, m.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.placeBallAt(m.losX, 0);
    this._kick = { type: 'PUNT', team, t: 0, launched: false, kicker: punter };
    this.giveBall(punter, 'hand');
    punter.anim.play('idle');
  }

  startKick(type, scoringTeam = null) {
    const m = this.match;
    const team = scoringTeam || m.poss;
    this.setPhase('kick');
    this.hud.hidePlaycall();
    this.hud.hint('');
    const dir = team === 'home' ? 1 : -1;
    const spotX = type === 'XP' ? dir * 48 : m.losX;
    this.lineupSpecial(team);
    const kicker = this.players[team].K;
    const holdX = spotX - 2.8 * dir;
    kicker.state = 'kick-script';
    kicker.group.visible = true;
    kicker.warp(holdX - 2.2 * dir, 1.1, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.placeBallAt(holdX, 0, 0.14);
    this.ball.rotation.set(0, 0, Math.PI / 2 - 0.12);
    this._kick = { type, team, dir, t: 0, launched: false, kicker, holdX };
    const dist = Math.round((GOAL - holdX * dir) + 10 + 7);
    this._kick.prob = type === 'XP' ? 0.96 : THREE.MathUtils.clamp(1.45 - dist / 46, 0.12, 0.97);
    this._kick.dist = dist;
  }

  lineupSpecial(team) {
    // park everyone; kicking unit handled separately
    for (const t of ['home', 'away']) {
      let i = 0;
      for (const role in this.players[t]) {
        const a = this.players[t][role];
        const zSide = t === 'home' ? 28.0 : -28.0;
        a.engagedWith = null; a.hasBall = false; a.tuck = 0;
        a.state = 'spectate';
        a.group.visible = !this.lowSpec;
        a.warp(-16 + (i % 12) * 2.4, zSide + Math.floor(i / 12) * 1.0, t === 'home' ? Math.PI : 0);
        a.anim.play(Math.random() < 0.3 ? 'cheer' : 'idle', { startAt: Math.random() });
        i++;
      }
    }
  }

  updateKickScene(dt) {
    const k = this._kick;
    if (!k) return;
    k.t += dt;
    const kicker = k.kicker;
    if (this.phase === 'punt') {
      if (k.t > 0.8 && !k.launched) {
        k.launched = true;
        kicker.anim.play('kick', { force: true });
        this.after(KICK_CONTACT_S, () => {
          sfx.kickThump();
          const m = this.match;
          this.holder = null;
          this.ballMode = 'kickfly';
          const distance = rand(30, 44);
          const t = 2.4;
          const toX = THREE.MathUtils.clamp(m.losX + distance * m.dir, -58, 58);
          this.ball.position.set(kicker.pos.x, 1.0, kicker.pos.z);
          this.ballVel.set((toX - kicker.pos.x) / t, (0.5 * G * t * t - 1) / t, rand(-2.5, 2.5));
          this.spin = 4;
          this._kickResultAt = null;
        });
      }
      kicker.anim.update(dt);
      return;
    }
    // FG / XP
    if (k.t > 0.7 && !k.approach) {
      k.approach = true;
      kicker.seek(k.holdX - 0.4 * k.dir, 0.25, 0.55);
    }
    if (k.approach && !k.launched) {
      kicker.move(dt);
      if (Math.hypot(kicker.pos.x - (k.holdX - 0.4 * k.dir), kicker.pos.z - 0.25) < 0.55) {
        k.launched = true;
        kicker.stop();
        kicker.vel.set(0, 0);
        kicker.facing = k.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        kicker.anim.play('kick', { force: true });
        this.after(KICK_CONTACT_S, () => {
          sfx.kickThump();
          const good = Math.random() < k.prob;
          k.good = good;
          this.ballMode = 'kickfly';
          this.holder = null;
          const t = 1.7;
          const targetX = k.dir * (EZ_BACK + 0.5);
          const targetZ = good ? rand(-2.6, 2.6) : (Math.random() < 0.5 ? -1 : 1) * rand(4.6, 8);
          const targetY = good ? rand(4.6, 6.5) : rand(2.0, 6.5);
          const from = this.ball.position.clone();
          this.ballVel.set(
            (targetX - from.x) / t,
            (targetY - from.y + 0.5 * G * t * t) / t,
            (targetZ - from.z) / t
          );
          this.spin = 2;
          this._kickEndT = this.t + t + 1.2;
        });
      }
    }
    kicker.anim.update(dt);
  }

  updateKickBall(dt) {
    const k = this._kick;
    if (!k) return;
    const m = this.match;
    if (k.type === 'PUNT') {
      if (this.ball.position.y <= 0.12) {
        this.ball.position.y = 0.12;
        const other = m.poss === 'home' ? 'away' : 'home';
        let spot = THREE.MathUtils.clamp(this.ball.position.x, -58, 58);
        let label = `Downed at the ${Math.max(1, Math.round(50 - Math.abs(spot)))}`;
        if (spot * (other === 'home' ? 1 : -1) <= -50) { spot = (other === 'home' ? -1 : 1) * 30; label = 'Touchback'; }
        this.ballMode = 'ground';
        this.hud.banner('PUNT', label, 1800);
        this.setPhase('dead');
        this.after(1.8, () => this.startDrive(other, spot));
        this._kick = null;
      }
      return;
    }
    // FG/XP: crossing the goal plane
    const planeX = k.dir * EZ_BACK;
    if ((k.dir > 0 && this.ball.position.x >= planeX) || (k.dir < 0 && this.ball.position.x <= planeX) || this.ball.position.y < 0.1) {
      const good = k.good && this.ball.position.y > 3.3;
      this.ballMode = 'ground';
      const m2 = this.match;
      if (k.type === 'XP') {
        if (good) m2[k.team] += 1;
        this.hud.banner(good ? 'EXTRA POINT GOOD' : 'NO GOOD!', '', 1700, good === (k.team === 'home') ? 'good' : '');
      } else {
        if (good) m2[k.team] += 3;
        this.hud.banner(good ? `FIELD GOAL — ${k.dist} YDS` : 'NO GOOD!', good ? 'Three points' : 'Wide!', 2000, good === (k.team === 'home') ? 'good' : 'bad');
        if (good) sfx.crowd(k.team === 'home' ? 0.85 : 0.3);
      }
      this.updateHudBar();
      this.drawScoreboard();
      const other = k.team === 'home' ? 'away' : 'home';
      const failSpot = k.type === 'FG' ? m2.losX : (other === 'home' ? -25 : 25);
      this.setPhase('dead');
      this.after(2.0, () => {
        if (k.type === 'FG' && !good) this.startDrive(other, failSpot);
        else this.startDrive(other, other === 'home' ? -25 : 25);
      });
      this._kick = null;
    }
  }

  // -------------------------------------------------- camera
  updateCamera(dt) {
    const m = this.match;
    const cam = this.camera;
    const userOnOffense = m.poss === 'home';
    const faceDir = userOnOffense ? m.dir : m.dir; // always look down the offense's field
    let target, look;
    if (this.phase === 'td' && this._celebrant) {
      const c = this._celebrant.pos;
      this._orbitA = (this._orbitA || 0) + dt * 0.9;
      target = v3(c.x + Math.sin(this._orbitA) * 7, 2.6, c.z + Math.cos(this._orbitA) * 7);
      look = v3(c.x, 1.2, c.z);
    } else if (this.phase === 'kick' || this.phase === 'punt') {
      const k = this._kick;
      const focus = this.ballMode === 'kickfly' ? this.ball.position : (k ? v3(k.kicker.pos.x, 1, k.kicker.pos.z) : this.ball.position);
      const dir2 = k ? (k.dir ?? m.dir) : m.dir;
      target = v3(focus.x - dir2 * 9, Math.max(4.2, focus.y + 2.5), focus.z + 4);
      look = v3(focus.x + dir2 * 6, Math.min(focus.y + 1, 6), focus.z);
    } else if (this.phase === 'final') {
      this._orbitA = (this._orbitA || 0) + dt * 0.35;
      target = v3(Math.sin(this._orbitA) * 22, 7, Math.cos(this._orbitA) * 22);
      look = v3(0, 1.5, 0);
    } else if (this.phase === 'live' || this.phase === 'dead') {
      let focus;
      if (this.ballMode === 'flight') focus = this.ball.position;
      else if (this.holder) focus = this.holder.pos;
      else focus = this.ball.position;
      const back = this.phase === 'dead' ? 8 : 10.5;
      target = v3(focus.x - faceDir * back, this.phase === 'dead' ? 4.6 : 5.8, focus.z * 0.62);
      look = v3(focus.x + faceDir * 7, 1.0, focus.z * 0.85);
    } else {
      // playcall / lineup / set: settled view from behind the user's unit
      const x = m.losX;
      target = v3(x - faceDir * 12, 6.4, 5);
      look = v3(x + faceDir * 9, 0.6, 0);
    }
    const lam = this.phase === 'live' ? 5.2 : 2.6;
    cam.position.x = damp(cam.position.x, target.x, lam, dt);
    cam.position.y = damp(cam.position.y, target.y, lam, dt);
    cam.position.z = damp(cam.position.z, target.z, lam, dt);
    this._camLook.x = damp(this._camLook.x, look.x, lam + 1, dt);
    this._camLook.y = damp(this._camLook.y, look.y, lam + 1, dt);
    this._camLook.z = damp(this._camLook.z, look.z, lam + 1, dt);
    cam.lookAt(this._camLook);
  }

  // -------------------------------------------------- input
  keyDown(e) {
    if (e.repeat) return;
    sfx.ensure();
    this.keys.add(e.code);
    if (e.code === 'Escape') { this.togglePause(); return; }
    if (e.code === 'KeyM') {
      this.muted = !this.muted;
      sfx.setMuted(this.muted);
      this.hud.banner(this.muted ? 'SOUND OFF' : 'SOUND ON', '', 700);
      return;
    }
    if (this.paused) return;
    // playcall hotkeys
    if (this.phase === 'playcall') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) this.hud.pickPlay(n - 1);
      return;
    }
    if (this.phase === 'set') {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.match.poss === 'home') this.snap();
      }
      return;
    }
    if (this.phase === 'live') {
      if (e.code === 'Space') {
        e.preventDefault();
        this.userJuke();
        return;
      }
      if (e.code === 'KeyE') { this.switchDefender(); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) this.userThrow(n - 1);
    }
  }

  togglePause() {
    this.paused = !this.paused;
    document.getElementById('pause').classList.toggle('show', this.paused);
    if (this.paused) {
      document.getElementById('pause-resume').onclick = () => this.togglePause();
      document.getElementById('pause-exit').onclick = () => { this.togglePause(); this.onExit(); };
    }
  }

  // -------------------------------------------------- main loop
  loop() {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(() => this.loop());
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05) * this.timeScale;
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }
    this.t += dt;
    this.phaseT += dt;
    this.runTimers();

    // adaptive quality: if the machine can't hold a frame rate, shed load once
    if (raw > 0.0001) this._fpsEma = this._fpsEma * 0.95 + (1 / raw) * 0.05;
    if (!this.lowSpec && this.t > 5 && this._fpsEma < 26) {
      this.lowSpec = true;
      this.renderer.setPixelRatio(1);
      if (this.stadium.keyLight) this.stadium.keyLight.castShadow = false;
      for (const a of this.allAthletes) if (a.state === 'spectate') a.group.visible = false;
    }

    switch (this.phase) {
      case 'intro': {
        // slow aerial drift over the stadium
        this.camera.position.set(Math.sin(this.t * 0.12) * 55, 26, Math.cos(this.t * 0.12) * 55);
        this.camera.lookAt(0, 2, 0);
        break;
      }
      case 'lineup': {
        for (const [a, s] of this._spots) {
          if (a.state !== 'toSpot') { a.anim.update(dt); continue; }
          const d = a.seek(s[0], s[1], 0.55);
          if (d < 0.35) { a.stop(); a.vel.set(0, 0); a.facing = s[2]; }
          a.move(dt);
          a.anim.update(dt);
        }
        for (const a of this.allAthletes) if (a.state === 'spectate') a.anim.update(dt);
        if (this.allLinedUp() || this.phaseT > 3.2) this.setAtLine();
        break;
      }
      case 'set': {
        for (const a of this.allAthletes) a.anim.update(dt);
        this.ref.anim.update(dt);
        // CPU snaps on its own count
        if (this.match.poss === 'away') {
          this._cpuSnapT -= dt;
          if (this._cpuSnapT <= 0) this.snap();
        }
        break;
      }
      case 'live': this.updateLive(dt); break;
      case 'dead':
      case 'td':
      case 'final': {
        for (const a of this.allAthletes) {
          if (a.state === 'down') {
            a.downTimer -= dt;
            if (a.downTimer <= 0 && a.anim.name !== 'getUp') { a.anim.play('getUp'); a.state = 'watch'; }
          }
          a.anim.update(dt);
        }
        this.ref.anim.update(dt);
        this.coaches.home.anim.update(dt);
        this.coaches.away.anim.update(dt);
        if (this.ballMode === 'flight') this.updateBall(dt);
        break;
      }
      case 'kick':
      case 'punt': {
        this.updateKickScene(dt);
        for (const a of this.allAthletes) if (a !== this._kick?.kicker) a.anim.update(dt);
        if (this.ballMode === 'kickfly') this.updateBall(dt);
        break;
      }
      case 'playcall': {
        for (const a of this.allAthletes) a.anim.update(dt);
        break;
      }
    }

    if (this.ballMode === 'held') this.updateHeldBall();

    // ambient updates
    this.stadium.crowd.update(this.t, dt);
    this._scoreboardT -= dt;
    if (this._scoreboardT <= 0) {
      this._scoreboardT = 1.0;
      this.drawScoreboard();
      this.updateHudBar();
    }
    if (this.phase !== 'intro') this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
    this.hud.hidePlaycall();
    this.hud.hideBanner();
    this.hud.clearIcons();
    this.hud.el.matchup.classList.remove('show');
    this.hud.el.final.classList.remove('show');
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}

export { Hud, rosterPick, OFF_ROLES, DEF_ROLES, CLIPS };
