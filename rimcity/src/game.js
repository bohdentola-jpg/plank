// The match: 2-on-2, no refs, 14-second shot clock, shoves are legal and
// goaltending counts. Turbo, alley-oops, putbacks, and ON FIRE.
import * as THREE from 'three';
import { COURT, buildArena, updateArena } from './arena.js';
import { makeKit, buildPlayer, buildBall } from './playerModel.js';
import { Animator } from './animation.js';
import { makeClips, CLIP_META } from './clips.js';
import { sfx } from './audio.js';
import { pads, BTN } from './gamepad.js';
import { difficultyFor } from './teams.js';
import { clamp, lerp } from './util.js';

export const CLIPS = makeClips();

const G = 11.0;              // gamey gravity for players
const BALL_G = 9.4;
const BALL_R = 0.121;
const JUMP_V = 4.9;
const RIM = (dir) => new THREE.Vector3(dir * COURT.RIM_X, COURT.RIM_Y, 0);

const BARKS = {
  dunk: ['KABOOM!', 'ON A POSTER!', 'DUNK CITY!', 'BRING THE THUNDER!', 'OH MY GOODNESS!'],
  three: ['FROM DOWNTOWN!', 'BANG!', 'FROM THE PARKING LOT!', 'RAINING BUCKETS!'],
  bucket: ['COUNT IT!', 'TOO SMOOTH!', 'BUTTER!'],
  block: ['REJECTED!', 'GET THAT OUT OF HERE!', 'DENIED!', 'NOT IN THIS GYM!'],
  steal: ['PICKED HIS POCKET!', 'TAKEN!', 'HE SAW THAT COMING A MILE AWAY!'],
  shove: ['FLATTENED!', 'DOWN HE GOES!', 'SOMEBODY GET A MOP!'],
  alley: ['ALLEY-OOP!', 'UP TOP, FINISHED!'],
  fire: ["HE'S ON FIRE!", 'CALL THE FIRE DEPARTMENT!'],
  heat: ["HE'S HEATING UP!"],
  goaltend: ['GOALTENDING, COUNT IT!'],
  brick: ['NO GOOD!', 'CLANK!', 'OFF THE IRON!'],
  airball: ['AIR BALL!', 'NOT EVEN CLOSE!'],
};
const bark = (k) => BARKS[k][(Math.random() * BARKS[k].length) | 0];

// ------------------------------------------------------------------ baller
class Baller {
  constructor(rig, info, team, slot, crew) {
    this.rig = rig;
    this.info = info;
    this.team = team;
    this.slot = slot;
    this.crew = crew;
    this.anim = new Animator(rig, CLIPS);
    this.pos = new THREE.Vector2(0, 0);   // x, z
    this.vel = new THREE.Vector2(0, 0);
    this.y = 0;                            // jump height
    this.vy = 0;
    this.airborne = false;
    this.facing = 0;
    this._faceTarget = 0;
    this._desired = new THREE.Vector2(0, 0);
    this._sprint = false;
    this.turbo = 100;
    this.state = 'play';                   // play|shoot|dunk|layup|steal|shove|spin|fall|getup|tip|celebrate|dejected
    this.stateT = 0;
    this.sd = {};                          // state data
    this.fireStreak = 0;
    this.onFire = false;
    this.protected = 0;                    // inbound steal protection
    this.stealCD = 0;
    this.shoveCD = 0;
    this.spinCD = 0;
    this.callForBall = 0;
    this.aiT = Math.random() * 0.3;        // staggered AI thinking
    this.aiSpot = null;
    this.cutT = 0;
    this.stats = { pts: 0, threes: 0, dunks: 0, stl: 0, blk: 0, reb: 0 };
  }

  get h() { return this.info.h; }
  get speed() {
    let s = 4.5 * (0.90 + this.info.spd * 0.0018);
    if (this._sprint && (this.turbo > 0 || this.onFire)) s *= 1.42;
    if (this.state === 'fall' || this.state === 'getup') s = 0;
    return s;
  }
  /** Overhead reach right now (for blocks, boards, lob catches). */
  get reach() { return this.h * 1.32 + this.y; }

  warp(x, z, facing = 0) {
    this.pos.set(x, z);
    this.vel.set(0, 0);
    this.y = 0; this.vy = 0;
    this.facing = facing;
    this._faceTarget = facing;
    this.state = 'play';
    this.sd = {};
  }

  seek(x, z, frac = 1, sprint = false) {
    const d = new THREE.Vector2(x - this.pos.x, z - this.pos.y);
    const len = d.length();
    if (len < 0.05) { this._desired.set(0, 0); return; }
    d.multiplyScalar(1 / len);
    this._desired.copy(d).multiplyScalar(clamp(len * 3, 0, 1) * frac);
    this._sprint = sprint;
  }

  stop() { this._desired.set(0, 0); this._sprint = false; }
  faceToward(x, z) { this._faceTarget = Math.atan2(x - this.pos.x, z - this.pos.y); }

  knockDown() {
    if (this.state === 'fall' || this.state === 'getup') return;
    this.state = 'fall';
    this.stateT = 0;
    this.anim.play('fallBack', { fade: 0.06 });
    this.vel.set(0, 0);
  }

  scripted() {
    return ['shoot', 'dunk', 'layup', 'steal', 'shove', 'spin', 'fall', 'getup', 'tip', 'celebrate', 'dejected', 'pass', 'catch'].includes(this.state);
  }

  move(dt, hasBall, guarding) {
    // jump physics (block jumps, shot jumps handled here; dunks are scripted)
    if (this.airborne && this.state !== 'dunk') {
      this.y += this.vy * dt;
      this.vy -= G * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.airborne = false; }
    }
    const max = this.speed;
    const want = this._desired.clone().multiplyScalar(max);
    const accel = this.airborne ? 5 : 26;
    this.vel.x += (want.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.y += (want.y - this.vel.y) * Math.min(1, accel * dt);
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.x = clamp(this.pos.x, -COURT.FLOOR_HALF_LEN + 0.4, COURT.FLOOR_HALF_LEN - 0.4);
    this.pos.y = clamp(this.pos.y, -COURT.FLOOR_HALF_WID + 0.4, COURT.FLOOR_HALF_WID - 0.4);

    // facing: run direction at speed; the rim (or the man) when settled
    let target = this._faceTarget;
    const spd = this.vel.length();
    if (!guarding && this.state === 'play' && spd > (hasBall ? 2.6 : 0.6)) {
      target = Math.atan2(this.vel.x, this.vel.y);
    }
    let d = target - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * Math.min(1, 12 * dt);

    // base animation when not in a scripted state
    if (!this.scripted() && !this.airborne) {
      if (hasBall) {
        if (spd < 0.5) this.anim.play('dribbleIdle');
        else if (spd < 4.6) this.anim.play('dribbleRun', { rate: clamp(spd / 3.6, 0.7, 1.35) });
        else this.anim.play('dribbleSprint', { rate: clamp(spd / 5.4, 0.9, 1.3) });
      } else if (guarding && spd < 3.2) {
        this.anim.play(spd > 0.6 ? 'shuffle' : 'defense');
      } else {
        if (spd < 0.4) this.anim.play('idle');
        else if (spd < 4.6) this.anim.play('run', { rate: clamp(spd / 3.6, 0.7, 1.35) });
        else this.anim.play('sprint', { rate: clamp(spd / 5.4, 0.9, 1.3) });
      }
    }

    this.rig.group.position.set(this.pos.x, this.y, this.pos.y);
    this.rig.group.rotation.y = this.facing;
  }

  /** World position of a grip (for ball attachment). side 'R'|'L'|'both' */
  gripPos(out, side = 'R') {
    const g = side === 'L' ? this.rig.gripL : this.rig.gripR;
    g.getWorldPosition(out);
    if (side === 'both') {
      const l = new THREE.Vector3();
      this.rig.gripL.getWorldPosition(l);
      out.lerp(l, 0.5);
    }
    return out;
  }
}

// ------------------------------------------------------------------ HUD
class Hud {
  constructor(root) {
    this.el = {
      bar: root.querySelector('#hud-bar'),
      home: root.querySelector('#hud-home'),
      away: root.querySelector('#hud-away'),
      mid: root.querySelector('#hud-mid'),
      banner: root.querySelector('#hud-banner'),
      hint: root.querySelector('#hud-hint'),
      meter: root.querySelector('#shot-meter'),
      matchup: root.querySelector('#matchup'),
      final: root.querySelector('#final'),
      pause: root.querySelector('#pause'),
    };
    this._bannerT = null;
  }

  team(side, { abbr, score, color, fire, turbo, name }) {
    const el = side === 0 ? this.el.home : this.el.away;
    el.innerHTML = `
      <span class="abbr" style="background:${color}">${abbr}</span>
      <span class="pts">${score}</span>${fire ? '<span class="fire">🔥</span>' : ''}
      <i class="turbo"><b style="width:${turbo ?? 0}%"></b></i>`;
    el.title = name || '';
  }

  mid({ qtr, clock, shot, urgent }) {
    this.el.mid.innerHTML = `<span>${qtr}</span><b>${clock}</b><span class="shot ${urgent ? 'urgent' : ''}">:${String(shot).padStart(2, '0')}</span>`;
  }

  banner(main, sub = '', ms = 2000, cls = '') {
    const b = this.el.banner;
    b.querySelector('.main').textContent = main;
    b.querySelector('.sub').textContent = sub;
    b.className = 'show ' + cls;
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => { b.className = ''; }, ms);
  }

  hint(html) { this.el.hint.innerHTML = html; }

  meter(screen, frac, sweet) {
    const m = this.el.meter;
    if (!screen) { m.style.display = 'none'; return; }
    m.style.display = 'block';
    m.style.left = `${screen.x}px`;
    m.style.top = `${screen.y}px`;
    m.querySelector('b').style.height = `${clamp(frac, 0, 1) * 100}%`;
    m.classList.toggle('sweet', sweet);
  }
}

// ------------------------------------------------------------------ game
export class Game {
  /**
   * opts: {
   *   home, away         — crews from teams.js
   *   control            — { home: 'p1'|'p2'|'keys'|'keys2'|'cpu', away: ... }
   *   rung               — difficulty rung 0..8 (CPU tuning)
   *   quarterSec         — default 120
   *   label              — matchup label ("THE RUN · GAME 3")
   *   onEnd({homeScore, awayScore, won, stats}), onExit()
   * }
   */
  constructor(container, opts) {
    this.container = container;
    this.opts = opts;
    this.home = opts.home;
    this.away = opts.away;
    this.control = opts.control || { home: 'p1', away: 'cpu' };
    this.diff = difficultyFor(opts.rung ?? 3);
    this.qLen = opts.quarterSec || 120;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 200);
    this.cam.position.set(0, 7.2, 16.8);
    this.camShake = 0;

    this.arena = buildArena(this.scene, this.home, this.away);

    // ballers
    this.kits = [makeKit(this.home.colors), makeKit(this.away.colors)];
    this.ballers = [];
    for (let t = 0; t < 2; t++) {
      const crew = t === 0 ? this.home : this.away;
      crew.players.forEach((p, i) => {
        const rig = buildPlayer(this.kits[t], { num: p.num, build: p.build, h: p.h, look: p.look });
        this.scene.add(rig.group);
        this.ballers.push(new Baller(rig, p, t, i, crew));
      });
    }

    // the rock
    this.ballRig = buildBall();
    this.scene.add(this.ballRig);
    this.ballMat = this.ballRig.children[0].material;
    this.ball = {
      mode: 'dead', holder: null, lastTouch: null,
      pos: new THREE.Vector3(0, 1, 0), vel: new THREE.Vector3(),
      shot: null, pass: null, t: 0, noTouch: 0, scoreLock: 0,
      dribblePhase: 0,
    };

    // particles: fire trail + bursts + confetti share one Points pool
    this.particles = this.makeParticles(420);

    // match state
    this.phase = 'tip';                 // tip|live|dead|over
    this.quarter = 1;
    this.clockQ = this.qLen;
    this.shotClock = 14;
    this.scores = [0, 0];
    this.possession = 0;
    this.controlled = [0, 0];           // controlled slot per team
    this.t = 0;
    this.excite = 0.3;
    this.paused = false;
    this.pendingEnd = false;
    this._timers = [];
    this._jumboT = 0;
    this._sqT = 0;
    this._fpsAcc = 0; this._fpsN = 0; this._lowQ = false;

    this.hud = new Hud(container.parentElement);
    this.keys = new Set();
    this.edgeKeys = new Set();
    this.edgeKeysNext = new Set();
    this._keyDown = (e) => this.keyDown(e);
    this._keyUp = (e) => { this.keys.delete(e.code); };
    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup', this._keyUp);
    this._resize = () => {
      if (!container.clientWidth) return;
      this.cam.aspect = container.clientWidth / container.clientHeight;
      this.cam.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', this._resize);

    this.edge = { 0: {}, 1: {} };       // per-team input snapshot
    this.showMatchup();
    this.clock = new THREE.Clock();
    this._raf = 0;
    this.loop();
  }

  // ------------------------------------------------------------ helpers
  attackDir(team) {
    const flip = this.quarter >= 3 ? -1 : 1;
    return (team === 0 ? 1 : -1) * flip;
  }
  hoopFor(team) { return this.arena.hoops[this.attackDir(team) > 0 ? 1 : 0]; }
  rimFor(team) { return RIM(this.attackDir(team)); }
  teamBallers(t) { return this.ballers.filter((b) => b.team === t); }
  mate(b) { return this.ballers.find((o) => o.team === b.team && o !== b); }
  isHuman(team) { return this.control[team === 0 ? 'home' : 'away'] !== 'cpu'; }
  ctrlOf(team) { return this.teamBallers(team)[this.controlled[team]]; }
  holder() { return this.ball.holder; }

  after(seconds, fn) { this._timers.push({ at: this.t + seconds, fn }); }
  runTimers() {
    for (let i = this._timers.length - 1; i >= 0; i--) {
      if (this.t >= this._timers[i].at) {
        const tm = this._timers.splice(i, 1)[0];
        tm.fn();
      }
    }
  }

  fmtClock(s) {
    const m = Math.floor(Math.max(0, s) / 60);
    const ss = Math.ceil(Math.max(0, s) % 60);
    return ss === 60 ? `${m + 1}:00` : `${m}:${String(ss).padStart(2, '0')}`;
  }

  qLabel() {
    return this.quarter <= 4 ? `Q${this.quarter}` : `OT${this.quarter - 4 > 1 ? this.quarter - 4 : ''}`;
  }

  crowdPop(x) { this.excite = Math.min(1.2, this.excite + x); sfx.crowd(x); }

  // ------------------------------------------------------------ flow
  showMatchup() {
    const m = this.hud.el.matchup;
    const card = (crew) => `
      <div class="mu-team" style="--c:${crew.colors.primary};--c2:${crew.colors.secondary}">
        <div class="mu-city">${crew.city}</div>
        <div class="mu-name">${crew.name}</div>
        <div class="mu-players">${crew.players.map((p) => `${p.name.split(' ')[0]} “${p.nick}” ${p.name.split(' ').slice(1).join(' ')}`).join('<br/>')}</div>
      </div>`;
    m.innerHTML = `
      <div class="mu-card">
        <div class="mu-label">${this.opts.label || 'EXHIBITION'} · ${this.diff.label}</div>
        <div class="mu-vs">${card(this.away)}<div class="mu-x">AT</div>${card(this.home)}</div>
        <div class="mu-tip">FIRST TO THE TIP — ${this.fmtClock(this.qLen)} QUARTERS, 14 ON THE SHOT CLOCK, NO REFS</div>
      </div>`;
    m.classList.add('show');
    this.phase = 'dead';
    sfx.say(`${this.away.city} ${this.away.name}, at ${this.home.city} ${this.home.name}. Welcome to Rim City!`, 2);
    this.after(3.4, () => {
      m.classList.remove('show');
      this.tipoff();
    });
  }

  tipoff() {
    this.phase = 'tip';
    this.clockQ = this.qLen;
    this.shotClock = 14;
    // jumpers: best (height+block) per team
    const jumper = (t) => {
      const [a, b] = this.teamBallers(t);
      return (a.h + a.info.block * 0.002) >= (b.h + b.info.block * 0.002) ? a : b;
    };
    const j0 = jumper(0), j1 = jumper(1);
    const m0 = this.mate(j0), m1 = this.mate(j1);
    j0.warp(-0.75, 0, Math.atan2(1, 0));
    j1.warp(0.75, 0, Math.atan2(-1, 0));
    m0.warp(-3.4, 2.6, Math.atan2(1, 0));
    m1.warp(3.4, -2.6, Math.atan2(-1, 0));
    this.ball.mode = 'tip';
    this.ball.holder = null;
    this.ball.pos.set(0, 1.3, 0);
    this.ball.vel.set(0, 0, 0);
    this.ball.t = 0;
    this.ball.tipDone = false;
    this.sdTip = { j0, j1 };
    this.hud.banner('THE TIP', '', 1400);
    this.contextHint();
  }

  updateTip(dt) {
    const b = this.ball;
    b.t += dt;
    if (b.t < 0.5) {
      b.pos.y = 1.3 + (b.t / 0.5) * 2.6; // toss up to ~3.9
    } else {
      b.pos.y -= (b.t - 0.5) * 7 * dt * 14; // accelerate down
      b.pos.y = Math.max(2.4, b.pos.y);
    }
    if (b.t > 0.32 && !this.sdTip.jumped) {
      this.sdTip.jumped = true;
      for (const j of [this.sdTip.j0, this.sdTip.j1]) {
        j.state = 'tip';
        j.anim.play('tipJump', { fade: 0.05, onDone: () => { j.state = 'play'; } });
        j.airborne = true; j.vy = JUMP_V * 1.05;
      }
    }
    if (b.t > 0.78 && !b.tipDone) {
      b.tipDone = true;
      const { j0, j1 } = this.sdTip;
      const s0 = j0.h * 50 + j0.info.block * 0.3 + Math.random() * 45;
      const s1 = j1.h * 50 + j1.info.block * 0.3 + Math.random() * 45;
      const winner = s0 >= s1 ? j0 : j1;
      const mateP = this.mate(winner).pos;
      b.mode = 'loose';
      b.vel.set((mateP.x - b.pos.x) * 1.3, 2.1, (mateP.y - b.pos.y) * 1.3);
      b.noTouch = 0.12;
      this.phase = 'live';
      sfx.catchPop();
      sfx.say(`${winner.crew.name} control the tip!`);
    }
  }

  giveBall(baller) {
    const b = this.ball;
    b.mode = 'held';
    b.holder = baller;
    b.lastTouch = baller;
    b.shot = null; b.pass = null;
    // control always follows the ball on your own team
    this.controlled[baller.team] = baller.slot;
    if (this.possession !== baller.team) {
      this.possession = baller.team;
      this.shotClock = 14;
      const dTeam = 1 - baller.team;
      this.controlled[dTeam] = this.nearestSlot(dTeam, baller.pos.x, baller.pos.y);
    }
    this.contextHint();
  }

  nearestSlot(team, x, z) {
    const [a, b] = this.teamBallers(team);
    const da = (a.pos.x - x) ** 2 + (a.pos.y - z) ** 2;
    const db = (b.pos.x - x) ** 2 + (b.pos.y - z) ** 2;
    return da <= db ? a.slot : b.slot;
  }

  /** After a make: other team takes it out under the hoop that got scored on. */
  inbound(team) {
    const dir = -this.attackDir(team);           // their backcourt baseline
    const [a, b] = this.teamBallers(team);
    const handler = a.info.handle >= b.info.handle ? a : b;
    const other = this.mate(handler);
    handler.warp(dir * (COURT.HALF_LEN - 0.6), (Math.random() < 0.5 ? 1 : -1) * 1.8, Math.atan2(-dir, 0));
    handler.protected = 1.0;
    other.seek(dir * 8, -handler.pos.y * 0.7);
    this.giveBall(handler);
    this.shotClock = 14;
  }

  // ------------------------------------------------------------ input
  readTeam(team) {
    const src = this.control[team === 0 ? 'home' : 'away'];
    const out = { mx: 0, mz: 0, turbo: false, shootD: false, shootU: false, shootHeld: false, pass: false, lob: false, shove: false, switch: false, pause: false };
    if (src === 'cpu') return out;
    if (src === 'p1' || src === 'p2') {
      const p = src === 'p1' ? pads.p1 : pads.p2;
      if (p.connected) {
        out.mx = p.lx; out.mz = p.ly;
        out.turbo = p.r2 > 0.25;
        out.shootHeld = p.down(BTN.CROSS);
        for (const e of p.edges) {
          if (e === BTN.CROSS) out.shootD = true;
          if (e === BTN.SQUARE) out.pass = true;
          if (e === BTN.TRIANGLE) out.lob = true;
          if (e === BTN.CIRCLE) out.shove = true;
          if (e === BTN.L1) out.switch = true;
          if (e === BTN.OPTIONS) out.pause = true;
        }
        out.shootU = this._prevShoot?.[team] && !out.shootHeld;
        this._prevShoot = this._prevShoot || {};
        this._prevShoot[team] = out.shootHeld;
        return out;
      }
      // pad missing → fall through to keyboard
    }
    const k = this.keys;
    if (src === 'keys2') {
      out.mx = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
      out.mz = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
      out.turbo = k.has('ShiftRight');
      out.shootHeld = k.has('KeyL');
      out.shootD = this.edgeKeys.has('KeyL');
      out.pass = this.edgeKeys.has('KeyK');
      out.shove = this.edgeKeys.has('KeyJ');
      out.lob = this.edgeKeys.has('KeyO');
      out.switch = this.edgeKeys.has('KeyO');
    } else {
      out.mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      out.mz = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
      out.turbo = k.has('ShiftLeft');
      out.shootHeld = k.has('Space');
      out.shootD = this.edgeKeys.has('Space');
      out.pass = this.edgeKeys.has('KeyE');
      out.shove = this.edgeKeys.has('KeyQ');
      out.lob = this.edgeKeys.has('KeyF');
      out.switch = this.edgeKeys.has('KeyF');
    }
    out.shootU = this._prevShoot?.[team] && !out.shootHeld;
    this._prevShoot = this._prevShoot || {};
    this._prevShoot[team] = out.shootHeld;
    return out;
  }

  keyDown(e) {
    if (e.repeat) return;
    this.keys.add(e.code);
    this.edgeKeysNext.add(e.code);
    if (e.code === 'Escape') this.togglePause();
    if (e.code === 'KeyM') { sfx.setMuted(!sfx.muted); this.hud.banner(sfx.muted ? 'MUTED' : 'SOUND ON', '', 700); }
  }

  // ------------------------------------------------------------ actions
  startShot(b) {
    if (this.ball.holder !== b || b.scripted()) return;
    const rim = this.rimFor(b.team);
    const dist = Math.hypot(rim.x - b.pos.x, rim.z - b.pos.y);
    const movingIn = b.vel.length() > 2.2 && (b.vel.x * (rim.x - b.pos.x) + b.vel.y * (rim.z - b.pos.y)) > 0;
    if (dist < 3.6 && (movingIn || dist < 1.9)) {
      const wantDunk = b._sprint || b.onFire || b.info.dunk > 82;
      if (wantDunk && b.info.dunk > 45) return this.startDunk(b);
      return this.startLayup(b);
    }
    b.state = 'shoot';
    b.stateT = 0;
    b.sd = { released: false, apex: JUMP_V * 0.94 / G, dist };
    b.faceToward(rim.x, rim.z);
    b.stop();
    b.airborne = true;
    b.vy = JUMP_V * 0.94;
    b.anim.play('shootUp', { fade: 0.05 });
    sfx.squeak();
  }

  releaseShot(b, forcedQ = null) {
    if (b.state !== 'shoot' || b.sd.released) return;
    b.sd.released = true;
    const rim = this.rimFor(b.team);
    const apex = b.sd.apex;
    let q = forcedQ ?? (1 - clamp(Math.abs(b.stateT - apex) / 0.26, 0, 1));
    b.anim.play('shootRelease', { fade: 0.04, onDone: () => { if (b.state === 'shoot') b.state = 'play'; } });
    // ball leaves the hands shortly into the release clip
    this.after(CLIP_META.shootRelease.release * 0.34, () => this.launchShot(b, q));
  }

  launchShot(b, q) {
    if (this.ball.holder !== b) return;   // shoved loose between release and launch
    const rim = this.rimFor(b.team);
    const hoop = this.hoopFor(b.team);
    const p0 = new THREE.Vector3();
    b.gripPos(p0, 'R');
    const dist = Math.hypot(rim.x - b.pos.x, rim.z - b.pos.y);
    const isThree = dist > COURT.THREE_R + 0.12;
    // make probability
    let p;
    if (dist < 4.2) p = 0.50 + b.info.three * 0.0022 + b.info.dunk * 0.001;
    else if (!isThree) p = 0.44 + b.info.three * 0.0030;
    else if (dist < 8.6) p = 0.30 + b.info.three * 0.0044;
    else p = 0.10 + b.info.three * 0.0028;       // heave
    p += 0.24 * (q - 0.45);
    const contest = this.contestOn(b);
    p -= contest;
    if (b.vel.length() > 2.4) p -= 0.07;
    if (b.onFire) p += 0.24;
    if (!this.isHuman(b.team)) p += this.diff.makeBonus;
    p = clamp(p, 0.04, 0.97);
    const make = Math.random() < p;
    const margin = Math.abs(p - 0.5) + q * 0.3;

    let target, missType = null;
    if (make) {
      target = rim.clone();
      target.x += (Math.random() - 0.5) * 0.05;
      target.z += (Math.random() - 0.5) * 0.05;
    } else {
      const roll = Math.random();
      if (roll < 0.14 && q < 0.35) {
        missType = 'air';
        const dir = new THREE.Vector3(b.pos.x - rim.x, 0, b.pos.y - rim.z).normalize();
        target = rim.clone().addScaledVector(dir, 0.55 + Math.random() * 0.4);
        target.y -= 0.1;
      } else if (roll < 0.5) {
        missType = 'board';
        target = new THREE.Vector3(hoop.dir * (COURT.BOARD_X - 0.04), 3.15 + Math.random() * 0.5, (Math.random() - 0.5) * 0.7);
      } else {
        missType = 'rim';
        const a = Math.atan2(b.pos.y - rim.z, b.pos.x - rim.x) + (Math.random() - 0.5) * 2.4;
        target = rim.clone();
        target.x += Math.cos(a) * (COURT.RIM_R + 0.03);
        target.z += Math.sin(a) * (COURT.RIM_R + 0.03);
      }
    }
    const T = clamp(0.55 + dist * 0.055, 0.6, 1.45);
    const apexY = Math.max(p0.y, COURT.RIM_Y) + 0.75 + dist * 0.055;
    this.ball.mode = 'shot';
    this.ball.holder = null;
    this.ball.shot = {
      p0, p1: target, T, t: 0, apexY,
      shooter: b, make, missType, isThree, hoop,
      rattle: make && margin < 0.18,
      q,
    };
    this.ball.scoreLock = 0;
    b.lastShotAt = this.t;
    if (this.clockQ <= 0) this.pendingEnd = true; // buzzer beater in the air
  }

  /** Defender contest penalty on a shooter right now. */
  contestOn(b) {
    let worst = 0;
    for (const d of this.teamBallers(1 - b.team)) {
      const dd = Math.hypot(d.pos.x - b.pos.x, d.pos.y - b.pos.y);
      if (dd < 2.3) {
        let c = (2.3 - dd) / 2.3 * (d.airborne ? 0.40 : 0.16);
        c *= 0.5 + d.info.def * 0.006;
        worst = Math.max(worst, c);
      }
    }
    return worst;
  }

  startDunk(b) {
    const rim = this.rimFor(b.team);
    const hoop = this.hoopFor(b.team);
    const styles = ['dunkTomahawk', 'dunkFlush', 'dunkWindmill'];
    const style = b.info.dunk > 88 ? styles[(Math.random() * 3) | 0] : styles[(Math.random() * 2) | 0];
    const slamT = CLIP_META[style].slam * CLIPS[style].dur;
    const toRim = new THREE.Vector3(rim.x - b.pos.x, 0, rim.z - b.pos.y);
    const d = toRim.length();
    const land = rim.clone().addScaledVector(toRim.normalize(), -0.62);
    b.state = 'dunk';
    b.stateT = 0;
    b.sd = {
      style, slamT,
      p0: new THREE.Vector2(b.pos.x, b.pos.y),
      p1: new THREE.Vector2(land.x, land.z),
      peak: Math.max(0.85, (COURT.RIM_Y + 0.18) - b.h * 1.18),
      dur: CLIPS[style].dur,
      slammed: false, stuffed: false, hoop,
    };
    b.faceToward(rim.x, rim.z);
    b.stop();
    b.anim.play(style, { fade: 0.05 });
    this.ball.mode = 'dunk';
    this.ball.holder = b;
    if (this.clockQ <= 0) this.pendingEnd = true;
    sfx.whooshUp();
  }

  updateDunk(b, dt) {
    const sd = b.sd;
    b.stateT += dt;
    const t = b.stateT;
    const k = clamp(t / (sd.slamT * 1.15), 0, 1);
    const ease = 1 - (1 - k) * (1 - k);
    b.pos.x = lerp(sd.p0.x, sd.p1.x, ease);
    b.pos.y = lerp(sd.p0.y, sd.p1.y, ease);
    if (t <= sd.slamT) {
      const u = t / sd.slamT;
      b.y = sd.peak * Math.sin(u * Math.PI * 0.5);
    } else {
      const u = clamp((t - sd.slamT) / (sd.dur - sd.slamT), 0, 1);
      b.y = sd.peak * (1 - u * u);
    }
    b.rig.group.position.set(b.pos.x, b.y, b.pos.y);
    b.rig.group.rotation.y = b.facing;

    // a leaping shot-blocker can stuff it right at the rim
    if (!sd.slammed && !sd.stuffed && t > sd.slamT - 0.22 && t < sd.slamT) {
      for (const d of this.teamBallers(1 - b.team)) {
        if (!d.airborne || d.state !== 'block') continue;
        const hand = new THREE.Vector3(d.pos.x + Math.sin(d.facing) * 0.25, d.reach, d.pos.y + Math.cos(d.facing) * 0.25);
        if (hand.distanceTo(this.ball.pos) < 0.55 && Math.random() < 0.25 + d.info.block * 0.004) {
          sd.stuffed = true;
          this.ball.mode = 'loose';
          this.ball.holder = null;
          this.ball.vel.set((d.pos.x - b.pos.x) * 2.4, 2.6, (d.pos.y - b.pos.y) * 2.4);
          this.ball.noTouch = 0.15;
          d.stats.blk++;
          this.hud.banner('STUFFED AT THE RIM!', `${d.info.nick} SAYS NO`, 2000, 'reject');
          sfx.say(bark('block'), 2);
          sfx.rimClank();
          this.crowdPop(0.8);
        }
      }
    }
    if (!sd.slammed && !sd.stuffed && t >= sd.slamT) {
      sd.slammed = true;
      if (sd.oop && this.ball.holder !== b) {
        // rose for the lob but never caught it — swing at nothing
        if (b.anim.finished) { b.state = 'play'; b.y = 0; b.airborne = false; }
        return;
      }
      this.scoreBasket(b, 2, sd.kind || 'dunk');
      sd.hoop.shake = 1;
      sd.hoop.netKick = 1;
      this.camShake = Math.max(this.camShake, 0.5);
      this.burst(this.ball.pos, b.onFire ? [1, 0.5, 0.1] : [1, 0.85, 0.4], 26);
      this.ball.mode = 'loose';
      this.ball.holder = null;
      this.ball.pos.set(sd.hoop.center.x, COURT.RIM_Y - 0.3, sd.hoop.center.z);
      this.ball.vel.set((Math.random() - 0.5) * 1, -1.4, (Math.random() - 0.5) * 1);
      this.ball.noTouch = 0.4;
      sfx.dunkBoom();
    }
    if (b.anim.finished) {
      b.state = 'play';
      b.y = 0; b.airborne = false;
    }
  }

  startLayup(b) {
    const rim = this.rimFor(b.team);
    b.state = 'layup';
    b.stateT = 0;
    const relT = CLIP_META.layup.release * CLIPS.layup.dur;
    b.sd = { relT, released: false };
    b.faceToward(rim.x, rim.z);
    b._desired.multiplyScalar(0.4);
    b.airborne = true;
    b.vy = JUMP_V * 0.8;
    b.anim.play('layup', { fade: 0.05, onDone: () => { if (b.state === 'layup') b.state = 'play'; } });
    if (this.clockQ <= 0) this.pendingEnd = true;
  }

  updateLayup(b, dt) {
    b.stateT += dt;
    if (!b.sd.released && b.stateT >= b.sd.relT && this.ball.holder === b) {
      b.sd.released = true;
      const rim = this.rimFor(b.team);
      const hoop = this.hoopFor(b.team);
      let p = 0.74 + b.info.dunk * 0.0016 - this.contestOn(b) * 1.25;
      if (b.onFire) p += 0.2;
      if (!this.isHuman(b.team)) p += this.diff.makeBonus;
      p = clamp(p, 0.05, 0.96);
      const make = Math.random() < p;
      const p0 = new THREE.Vector3();
      b.gripPos(p0, 'R');
      let target;
      if (make) {
        target = rim.clone();
      } else {
        target = Math.random() < 0.6
          ? new THREE.Vector3(hoop.dir * (COURT.BOARD_X - 0.04), 3.3, (Math.random() - 0.5) * 0.5)
          : rim.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4));
      }
      this.ball.mode = 'shot';
      this.ball.holder = null;
      this.ball.shot = {
        p0, p1: target, T: 0.5, t: 0, apexY: Math.max(p0.y + 0.4, COURT.RIM_Y + 0.42),
        shooter: b, make, missType: make ? null : 'rim', isThree: false, hoop, rattle: false, q: 0.6, layup: true,
      };
    }
  }

  startPass(from, lob = false) {
    if (this.ball.holder !== from || from.scripted()) return;
    const to = this.mate(from);
    if (lob) {
      const rim = this.rimFor(from.team);
      const dTo = Math.hypot(rim.x - to.pos.x, rim.z - to.pos.y);
      if (dTo > 7.5) lob = false;      // too far for the oop — chest it
    }
    from.state = 'pass';
    from.stateT = 0;
    from.faceToward(to.pos.x, to.pos.y);
    from.anim.play('passChest', { fade: 0.05, onDone: () => { if (from.state === 'pass') from.state = 'play'; } });
    const relT = CLIP_META.passChest.release * CLIPS.passChest.dur;
    this.after(relT, () => {
      if (this.ball.holder !== from) return;
      const p0 = new THREE.Vector3();
      from.gripPos(p0, 'both');
      this.ball.holder = null;
      if (lob) {
        const rim = this.rimFor(from.team);
        const drop = rim.clone();
        drop.x -= this.attackDir(from.team) * 0.55;
        drop.y = COURT.RIM_Y + 0.55;
        this.ball.mode = 'lob';
        this.ball.pass = { p0, to, t: 0, T: 0.92, p1: drop, apexY: COURT.RIM_Y + 1.7, oop: true };
        to.sd = {}; to.cutT = 0;
        to.oopTarget = drop;
        sfx.say('Lob is UP!');
      } else {
        this.ball.mode = 'pass';
        this.ball.pass = { p0, to, t: 0, T: 0, apexY: 0 };
      }
      sfx.catchPop();
    });
  }

  attemptSteal(d) {
    if (d.scripted() || d.airborne || d.stealCD > 0) return;
    d.state = 'steal';
    d.stateT = 0;
    d.stealCD = 0.65;
    d.anim.play('steal', { fade: 0.04, onDone: () => { if (d.state === 'steal') d.state = 'play'; } });
    const swipeT = CLIP_META.steal.swipe * CLIPS.steal.dur;
    this.after(swipeT, () => {
      const h = this.holder();
      if (!h || h.team === d.team) return;
      const dd = Math.hypot(h.pos.x - d.pos.x, h.pos.y - d.pos.y);
      if (dd > 1.25 || h.protected > 0 || h.state === 'spin') return;
      if (['shoot', 'dunk', 'layup'].includes(h.state)) return;
      let p = 0.30 + (d.info.steal - h.info.handle) * 0.0035;
      if (h.onFire) p *= 0.45;
      if (!this.isHuman(d.team)) p *= 0.8 + this.diff.stealRate * 0.2;
      if (Math.random() < clamp(p, 0.05, 0.75)) {
        this.giveBall(d);
        d.stats.stl++;
        this.hud.banner('PICKED!', `${d.info.nick} WITH THE TAKEAWAY`, 1800, 'steal');
        sfx.steal();
        sfx.say(bark('steal'), 1);
        this.crowdPop(0.5);
      }
    });
  }

  attemptShove(s) {
    if (s.scripted() || s.airborne || s.shoveCD > 0) return;
    const strong = s.turbo >= 28 || s.onFire;
    if (!s.onFire) s.turbo = Math.max(0, s.turbo - 28);
    s.shoveCD = 1.15;
    s.state = 'shove';
    s.stateT = 0;
    s.anim.play('shove', { fade: 0.04, onDone: () => { if (s.state === 'shove') s.state = 'play'; } });
    const hitT = CLIP_META.shove.hit * CLIPS.shove.dur;
    this.after(hitT, () => {
      for (const v of this.teamBallers(1 - s.team)) {
        const dd = Math.hypot(v.pos.x - s.pos.x, v.pos.y - s.pos.y);
        if (dd > 1.15 || v.state === 'fall' || v.state === 'getup' || v.state === 'dunk') continue;
        const ang = Math.atan2(v.pos.x - s.pos.x, v.pos.y - s.pos.y);
        let dA = ang - s.facing;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        if (Math.abs(dA) > 1.3) continue;
        if (!strong) { v.vel.addScaledVector(new THREE.Vector2(Math.sin(ang), Math.cos(ang)), 3); continue; }
        if (v.state === 'shoot' && !v.sd.released) this.releaseShot(v, 0.02);
        const hadBall = this.holder() === v;
        v.knockDown();
        if (hadBall) {
          this.ball.mode = 'loose';
          this.ball.holder = null;
          this.ball.pos.set(v.pos.x, 1.3, v.pos.y);
          this.ball.vel.set(Math.sin(ang) * 2.4 + (Math.random() - 0.5), 3.1, Math.cos(ang) * 2.4 + (Math.random() - 0.5));
          this.ball.noTouch = 0.18;
        }
        this.hud.banner('FLATTENED!', hadBall ? 'AND THE BALL IS LOOSE' : '', 1500, 'shove');
        sfx.shove();
        if (Math.random() < 0.6) sfx.say(bark('shove'));
        this.crowdPop(0.4);
      }
    });
  }

  startBlock(d) {
    if (d.scripted() || d.airborne) return;
    d.state = 'block';
    d.stateT = 0;
    d.airborne = true;
    d.vy = JUMP_V * (0.92 + d.info.block * 0.002);
    d.anim.play('block', { fade: 0.05, onDone: () => { if (d.state === 'block') d.state = 'play'; } });
    sfx.squeak();
  }

  startSpin(b) {
    if (this.ball.holder !== b || b.scripted() || b.spinCD > 0) return;
    b.spinCD = 1.0;
    b.state = 'spin';
    b.stateT = 0;
    const burst = b.vel.clone().normalize().multiplyScalar(2.2);
    b.vel.add(burst);
    b.anim.play('spin', { fade: 0.05, onDone: () => { if (b.state === 'spin') b.state = 'play'; } });
  }

  // ------------------------------------------------------------ scoring
  scoreBasket(scorer, pts, kind) {
    if (this.ball.scoreLock > this.t) return;
    this.ball.scoreLock = this.t + 0.5;
    const team = scorer.team;
    this.scores[team] += pts;
    scorer.stats.pts += pts;
    if (pts === 3) scorer.stats.threes++;
    if (kind === 'dunk' || kind === 'oop' || kind === 'putbackDunk') scorer.stats.dunks++;

    // fire bookkeeping
    for (const o of this.ballers) {
      if (o === scorer) continue;
      if (o.team !== team && o.onFire) {
        o.onFire = false;
        this.hud.banner('FIRE OUT', `${o.info.nick} COOLS OFF`, 1300);
      }
      o.fireStreak = o === this.mate(scorer) ? o.fireStreak : 0;
    }
    scorer.fireStreak++;
    let fireNote = '';
    if (scorer.fireStreak === 2) {
      sfx.say(bark('heat'));
      fireNote = `${scorer.info.nick} IS HEATING UP`;
    }
    if (scorer.fireStreak >= 3 && !scorer.onFire) {
      scorer.onFire = true;
      this.hud.banner('🔥 ON FIRE 🔥', `${scorer.info.nick} CAN'T MISS`, 2600, 'fire');
      sfx.whooshUp();
      sfx.say(bark('fire'), 2);
      this.crowdPop(1.0);
    }

    const labels = {
      dunk: [bark('dunk'), `${scorer.info.nick} THROWS IT DOWN`],
      oop: [bark('alley'), `${scorer.info.nick} FINISHES THE LOB`],
      three: [bark('three'), `${scorer.info.nick} FOR THREE`],
      mid: ['BUCKET!', `${scorer.info.nick} FROM MID-RANGE`],
      layup: ['AND IN!', `${scorer.info.nick} WITH THE FINISH`],
      putback: ['PUTBACK!', `${scorer.info.nick} CLEANS IT UP`],
      goaltend: ['GOALTENDING — COUNT IT', `${scorer.info.nick} GETS THE POINTS`],
      buzzer: ['AT THE BUZZER!', `${scorer.info.nick} BEATS THE CLOCK`],
    };
    const [main, sub] = labels[kind] || labels.mid;
    this.hud.banner(pts === 3 ? `${main} +3` : main, fireNote || sub, 2000, kind === 'dunk' || kind === 'oop' ? 'dunk' : pts === 3 ? 'three' : '');
    if (kind === 'dunk' || kind === 'oop') { /* dunk already barked elsewhere on bigs */ }
    if (kind !== 'goaltend' && Math.random() < (kind === 'dunk' || kind === 'oop' ? 0.95 : 0.6)) {
      sfx.say(kind === 'three' ? bark('three') : kind === 'dunk' ? bark('dunk') : kind === 'oop' ? bark('alley') : bark('bucket'));
    }
    this.crowdPop(kind === 'dunk' || kind === 'oop' ? 0.9 : pts === 3 ? 0.7 : 0.4);
    this.jumboFlash(pts === 3 ? 'TREY!' : kind === 'dunk' || kind === 'oop' ? 'JAM!' : 'BUCKET!', scorer.crew.colors.secondary);

    if (this.pendingEnd) {
      this.after(0.5, () => this.endPeriod());
      this.pendingEnd = false;
    } else {
      this.inbound(1 - team);
    }
  }

  turnover(reason) {
    const team = this.possession;
    this.hud.banner(reason, 'TURNOVER', 1500);
    sfx.buzzer();
    this.inbound(1 - team);
  }

  // ------------------------------------------------------------ ball
  updateBall(dt) {
    const b = this.ball;
    b.noTouch = Math.max(0, b.noTouch - dt);
    if (b.mode === 'tip') { this.updateTip(dt); this.placeBallRig(); return; }

    if (b.mode === 'held') {
      const h = b.holder;
      if (!h) { b.mode = 'loose'; return; }
      if (h.state === 'shoot' || h.state === 'pass' || h.state === 'layup' || h.state === 'spin' || h.state === 'tip') {
        // in the hands
        const side = h.state === 'pass' ? 'both' : 'R';
        h.gripPos(b.pos, side);
      } else if (h.state === 'fall' || h.state === 'getup') {
        h.gripPos(b.pos, 'R');
      } else {
        // dribble: ball off the right hand, synced to the pump
        const meta = CLIP_META[h.anim.name];
        const bounces = meta?.bounces || 1;
        const phase = (h.anim.phase * bounces) % 1;
        const handH = 0.74 * h.rig.scale + Math.abs(Math.sin(this.t * 2)) * 0.02;
        const a = h.facing;
        const ox = Math.sin(a + Math.PI * 0.42) * 0.34 + Math.sin(a) * 0.18;
        const oz = Math.cos(a + Math.PI * 0.42) * 0.34 + Math.cos(a) * 0.18;
        b.pos.set(h.pos.x + ox, BALL_R + (handH - BALL_R) * Math.abs(Math.cos(Math.PI * phase)), h.pos.y + oz);
        const prevPhase = ((h.anim.phase - dt / CLIPS[h.anim.name].dur * h.anim.rate) * bounces) % 1;
        if (phase > 0.42 && phase < 0.58 && !(prevPhase > 0.42 && prevPhase < 0.58)) sfx.bounce(0.35);
      }
      this.placeBallRig();
      return;
    }

    if (b.mode === 'dunk') {
      const h = b.holder;
      if (h) h.gripPos(b.pos, h.sd?.style === 'dunkFlush' ? 'both' : 'R');
      this.placeBallRig();
      return;
    }

    if (b.mode === 'shot') { this.updateShot(dt); this.placeBallRig(); return; }
    if (b.mode === 'pass' || b.mode === 'lob') { this.updatePass(dt); this.placeBallRig(); return; }
    if (b.mode === 'loose') { this.updateLoose(dt); this.placeBallRig(); return; }
  }

  placeBallRig() {
    this.ballRig.position.copy(this.ball.pos);
    this.ballRig.rotation.x += 0.16;
    this.ballRig.rotation.z += 0.07;
    const fire = this.holder()?.onFire || this.ball.shot?.shooter?.onFire;
    this.ballMat.color.set(fire ? '#ffd890' : '#d96b27');
    this.ballMat.emissive?.set?.(fire ? '#7a2a00' : '#000000');
  }

  /** Quadratic-bezier flight sampler for shots. */
  shotPos(s, t, out) {
    const u = clamp(t / s.T, 0, 1);
    out.x = lerp(s.p0.x, s.p1.x, u);
    out.z = lerp(s.p0.z, s.p1.z, u);
    const yc = s.apexY * 2 - (s.p0.y + s.p1.y) / 2;
    out.y = (1 - u) * (1 - u) * s.p0.y + 2 * (1 - u) * u * yc + u * u * s.p1.y;
    return out;
  }

  updateShot(dt) {
    const b = this.ball;
    const s = b.shot;
    s.t += dt;
    this.shotPos(s, s.t, b.pos);

    // blocks & goaltends
    const rising = s.t < s.T * 0.45;
    for (const d of this.ballers) {
      if (d.team === s.shooter.team || d.state !== 'block' || !d.airborne) continue;
      const hand = new THREE.Vector3(d.pos.x + Math.sin(d.facing) * 0.28, d.reach, d.pos.y + Math.cos(d.facing) * 0.28);
      if (hand.distanceTo(b.pos) < 0.46) {
        const nearRim = Math.hypot(b.pos.x - s.hoop.center.x, b.pos.z - s.hoop.center.z) < 2.0;
        if (rising || !nearRim) {
          // clean rejection
          b.mode = 'loose';
          const away = new THREE.Vector3(b.pos.x - s.hoop.center.x, 0, b.pos.z - s.hoop.center.z).normalize();
          b.vel.set(away.x * 5.5 + (Math.random() - 0.5) * 2, 1.8, away.z * 5.5 + (Math.random() - 0.5) * 2);
          b.noTouch = 0.12;
          b.shot = null;
          d.stats.blk++;
          this.hud.banner('REJECTED!', `${d.info.nick} SENDS IT BACK`, 1900, 'reject');
          sfx.say(bark('block'), 2);
          sfx.catchPop();
          this.crowdPop(0.7);
          return;
        }
        if (!d.onFire) {
          // goaltend: points count
          b.mode = 'loose';
          b.vel.set((Math.random() - 0.5) * 2, -1, (Math.random() - 0.5) * 2);
          b.shot = null;
          sfx.say(bark('goaltend'), 2);
          this.scoreBasket(s.shooter, s.isThree ? 3 : 2, 'goaltend');
          return;
        }
        // on-fire defenders are allowed to swat anything
        b.mode = 'loose';
        const away = new THREE.Vector3(b.pos.x - s.hoop.center.x, 0, b.pos.z - s.hoop.center.z).normalize();
        b.vel.set(away.x * 6, 1.4, away.z * 6);
        b.shot = null;
        d.stats.blk++;
        this.hud.banner('TOO HOT TO HANDLE!', `${d.info.nick} SWATS IT AWAY`, 1900, 'reject');
        sfx.say(bark('block'), 2);
        return;
      }
    }

    if (s.t < s.T) return;

    // arrival
    if (s.make) {
      if (s.rattle && !s.rattled) {
        s.rattled = true;
        s.t = s.T - 0.16;   // one lap around the iron
        sfx.rimClank();
        this.shotClock = Math.max(this.shotClock, 8);
        return;
      }
      const kind = s.layup ? 'layup' : s.isThree ? 'three' : 'mid';
      s.hoop.netKick = 1;
      if (!s.rattle) sfx.swish(); else sfx.rimClank();
      this.scoreBasket(s.shooter, s.isThree ? 3 : 2, this.clockQ <= 0 && this.pendingEnd ? 'buzzer' : kind);
      this.ball.mode = 'loose';
      this.ball.pos.set(s.hoop.center.x, COURT.RIM_Y - 0.35, s.hoop.center.z);
      this.ball.vel.set((Math.random() - 0.5) * 0.8, -1.2, (Math.random() - 0.5) * 0.8);
      this.ball.noTouch = 0.4;
      this.ball.shot = null;
      return;
    }
    // miss → live ball
    const prev = new THREE.Vector3();
    this.shotPos(s, s.t - 0.03, prev);
    const vel = b.pos.clone().sub(prev).multiplyScalar(1 / 0.03);
    b.mode = 'loose';
    b.shot = null;
    if (s.missType === 'board') {
      sfx.boardThud();
      vel.x = -vel.x * 0.42;
      vel.y = Math.abs(vel.y) * 0.25 + 0.6;
      vel.z *= 0.5;
      this.shotClock = Math.max(this.shotClock, 6);
    } else if (s.missType === 'rim') {
      sfx.rimClank();
      const n = new THREE.Vector3(b.pos.x - s.hoop.center.x, 0.55, b.pos.z - s.hoop.center.z).normalize();
      const sp = clamp(vel.length() * 0.55, 2.2, 4.6);
      vel.copy(n).multiplyScalar(sp);
      vel.y = Math.abs(vel.y) + 2.4;
      this.shotClock = Math.max(this.shotClock, 8);
      if (Math.random() < 0.25) sfx.say(bark('brick'), 0);
    } else {
      if (Math.random() < 0.6) sfx.say(bark('airball'), 1);
    }
    b.vel.copy(vel);
    b.noTouch = 0.22;
  }

  updatePass(dt) {
    const b = this.ball;
    const p = b.pass;
    p.t += dt;
    if (b.mode === 'pass') {
      // flat fast pass with live homing to the receiver
      const target = new THREE.Vector3(p.to.pos.x, 1.15 * p.to.rig.scale + p.to.y, p.to.pos.y);
      const dist = p.p0.distanceTo(target);
      p.T = clamp(0.18 + dist * 0.045, 0.2, 0.62);
      const u = clamp(p.t / p.T, 0, 1);
      b.pos.lerpVectors(p.p0, target, u);
      b.pos.y += Math.sin(u * Math.PI) * 0.3;
      // defenders jump the lane
      for (const d of this.teamBallers(1 - p.to.team)) {
        if (d.state !== 'steal') continue;
        if (Math.hypot(d.pos.x - b.pos.x, d.pos.y - b.pos.z) < 0.6 && b.pos.y < d.reach) {
          b.mode = 'loose';
          b.pass = null;
          b.vel.set((Math.random() - 0.5) * 4, 1.6, (Math.random() - 0.5) * 4);
          this.hud.banner('TIPPED!', `${d.info.nick} GETS A HAND IN`, 1400, 'steal');
          sfx.catchPop();
          return;
        }
      }
      if (u >= 1) {
        b.pass = null;
        this.giveBall(p.to);
        p.to.protected = 0.25;
        if (!p.to.scripted()) p.to.anim.play('catch', { fade: 0.05, onDone: () => {} });
        sfx.catchPop();
        this.contextHint();
      }
      return;
    }
    // lob: high rainbow to the rim pocket
    const u = clamp(p.t / p.T, 0, 1);
    b.pos.x = lerp(p.p0.x, p.p1.x, u);
    b.pos.z = lerp(p.p0.z, p.p1.z, u);
    const yc = p.apexY * 2 - (p.p0.y + p.p1.y) / 2;
    b.pos.y = (1 - u) * (1 - u) * p.p0.y + 2 * (1 - u) * u * yc + u * u * p.p1.y;
    const to = p.to;
    // receiver rises when the ball comes down the chute
    if (u > 0.52 && !p.jumped && to.state === 'play') {
      const dd = Math.hypot(to.pos.x - p.p1.x, to.pos.y - p.p1.z);
      if (dd < 1.3) {
        p.jumped = true;
        to.state = 'dunk';
        to.stateT = 0;
        const style = 'dunkFlush';
        const rim = this.rimFor(to.team);
        const land = rim.clone().addScaledVector(new THREE.Vector3(rim.x - to.pos.x, 0, rim.z - to.pos.y).normalize(), -0.6);
        to.sd = {
          style, slamT: CLIP_META[style].slam * CLIPS[style].dur,
          p0: new THREE.Vector2(to.pos.x, to.pos.y), p1: new THREE.Vector2(land.x, land.z),
          peak: Math.max(0.9, (COURT.RIM_Y + 0.2) - to.h * 1.18),
          dur: CLIPS[style].dur, slammed: false, stuffed: false, hoop: this.hoopFor(to.team), oop: true,
        };
        to.faceToward(rim.x, rim.z);
        to.anim.play(style, { fade: 0.05 });
      }
    }
    // catch in the air → instant flush
    if (p.jumped && to.state === 'dunk' && !to.sd.caught) {
      const hands = new THREE.Vector3();
      to.gripPos(hands, 'both');
      if (hands.distanceTo(b.pos) < 0.85) {
        to.sd.caught = true;
        b.mode = 'dunk';
        b.holder = to;
        b.pass = null;
        to.sd.kind = 'oop';
        this.crowdPop(0.5);
        return;
      }
    }
    if (u >= 1) {
      // nobody home — ball off the rim area, loose
      b.mode = 'loose';
      b.pass = null;
      b.vel.set((Math.random() - 0.5) * 2.4, -0.5, (Math.random() - 0.5) * 2.4);
      b.noTouch = 0.1;
    }
  }

  updateLoose(dt) {
    const b = this.ball;
    b.vel.y -= BALL_G * dt;
    b.pos.addScaledVector(b.vel, dt);

    // floor
    if (b.pos.y < BALL_R) {
      b.pos.y = BALL_R;
      if (Math.abs(b.vel.y) > 0.8) sfx.bounce(clamp(Math.abs(b.vel.y) / 7, 0.2, 0.9));
      b.vel.y = -b.vel.y * 0.58;
      b.vel.x *= 0.86;
      b.vel.z *= 0.86;
      if (Math.abs(b.vel.y) < 0.4) b.vel.y = 0;
    }
    // street rules: invisible walls keep it alive
    const WX = COURT.FLOOR_HALF_LEN - 0.25, WZ = COURT.FLOOR_HALF_WID - 0.25;
    if (Math.abs(b.pos.x) > WX) { b.pos.x = Math.sign(b.pos.x) * WX; b.vel.x = -b.vel.x * 0.5; }
    if (Math.abs(b.pos.z) > WZ) { b.pos.z = Math.sign(b.pos.z) * WZ; b.vel.z = -b.vel.z * 0.5; }

    // rims + boards
    for (const hoop of this.arena.hoops) {
      const c = hoop.center;
      const dx = b.pos.x - c.x, dz = b.pos.z - c.z;
      const horiz = Math.hypot(dx, dz);
      if (Math.abs(b.pos.y - c.y) < 0.35 && horiz < COURT.RIM_R + 0.25 && b.noTouch <= 0) {
        // closest point on the ring
        const nx = horiz > 0.001 ? dx / horiz : 1, nz = horiz > 0.001 ? dz / horiz : 0;
        const ring = new THREE.Vector3(c.x + nx * COURT.RIM_R, c.y, c.z + nz * COURT.RIM_R);
        const d = b.pos.distanceTo(ring);
        if (d < BALL_R + 0.025) {
          const n = b.pos.clone().sub(ring).normalize();
          const vn = b.vel.dot(n);
          if (vn < 0) {
            b.vel.addScaledVector(n, -vn * 1.55);
            b.vel.multiplyScalar(0.8);
            if (Math.abs(vn) > 1.5) sfx.rimClank();
            this.shotClock = Math.max(this.shotClock, 6);
          }
        }
      }
      // backboard
      const bx = hoop.dir * COURT.BOARD_X;
      if (Math.abs(b.pos.x - bx) < BALL_R + 0.03 && b.pos.y > COURT.BOARD_BOT && b.pos.y < COURT.BOARD_TOP && Math.abs(b.pos.z) < COURT.BOARD_HALF_W) {
        if (Math.sign(b.vel.x) === Math.sign(bx - b.pos.x + 0.0001) || Math.abs(b.pos.x) < Math.abs(bx)) {
          if ((bx > 0 && b.vel.x > 0) || (bx < 0 && b.vel.x < 0)) {
            b.vel.x = -b.vel.x * 0.55;
            sfx.boardThud();
          }
        }
      }
      // dropping through the cylinder = putback bucket
      if (b.vel.y < 0 && b.pos.y < c.y + 0.05 && b.pos.y > c.y - 0.3 && horiz < COURT.RIM_R * 0.7 && this.t > this.ball.scoreLock) {
        const attackTeam = this.ballers.find((p) => this.attackDir(p.team) === hoop.dir)?.team ?? 0;
        const credit = (b.lastTouch && b.lastTouch.team === attackTeam) ? b.lastTouch : this.teamBallers(attackTeam)[0];
        hoop.netKick = 1;
        sfx.swish();
        this.scoreBasket(credit, 2, 'putback');
        b.noTouch = 0.4;
        return;
      }
    }

    // pickups
    if (b.noTouch > 0) return;
    for (const p of this.ballers) {
      if (p.state === 'fall' || p.state === 'getup' || p.state === 'dunk') continue;
      const dd = Math.hypot(p.pos.x - b.pos.x, p.pos.y - b.pos.z);
      const high = b.pos.y > p.h * 1.05;
      if (dd < (high ? 0.7 : 0.62) && b.pos.y < p.reach + 0.15) {
        if (high && !p.airborne) continue;      // must jump for the high ones
        const wasShotAt = p.lastShotAt && this.t - p.lastShotAt < 0.5;
        if (wasShotAt) continue;
        if (b.pos.y > 1.4) p.stats.reb++;
        this.giveBall(p);
        b.lastTouch = p;
        // mid-air gather near the rim → instant putback flush
        const rim = this.rimFor(p.team);
        const rimD = Math.hypot(rim.x - p.pos.x, rim.z - p.pos.y);
        if (p.airborne && b.pos.y > 2.2 && rimD < 1.7 && p.info.dunk > 55) {
          this.startDunk(p);
          if (p.sd) p.sd.kind = 'putbackDunk';
        }
        sfx.catchPop();
        return;
      }
    }
  }

  // ------------------------------------------------------------ user control
  updateUser(team, dt) {
    const inp = this.readTeam(team);
    this.edge[team] = inp;
    if (inp.pause) { this.togglePause(); return; }
    // arcade rule: control follows the ball on offense (giveBall retargets
    // controlled[]), nearest/switchable defender otherwise.
    const me = this.ctrlOf(team);
    if (!me) return;

    // movement intent
    const mag = Math.hypot(inp.mx, inp.mz);
    if (me.state === 'shoot' && !me.sd.released) {
      // small air drift
      me._desired.set(inp.mx * 0.2, inp.mz * 0.2);
    } else if (!me.scripted()) {
      me._desired.set(clamp(inp.mx, -1, 1), clamp(inp.mz, -1, 1));
      if (mag > 1) me._desired.multiplyScalar(1 / mag);
      me._sprint = inp.turbo && (me.turbo > 0 || me.onFire);
    }

    if (this.holder() === me) {
      const rim = this.rimFor(team);
      me.faceToward(rim.x, rim.z);
      if (inp.shootD) this.startShot(me);
      if (inp.shootU && me.state === 'shoot') this.releaseShot(me);
      if (inp.pass) this.startPass(me, false);
      if (inp.lob) this.startPass(me, true);
      if (inp.shove) this.startSpin(me);
    } else {
      // defense / loose-ball: jump, swipe, shove, switch
      if (inp.shootD) this.startBlock(me);
      if (inp.pass) this.attemptSteal(me);
      if (inp.shove) this.attemptShove(me);
      if (inp.switch) {
        this.controlled[team] = 1 - this.controlled[team];
        sfx.chime();
      }
      const h = this.holder();
      if (h && !me.scripted() && me.vel.length() < 2.5) me.faceToward(h.pos.x, h.pos.y);
    }

    // shot meter for the human shooter
    if (me.state === 'shoot' && !me.sd.released) {
      const sp = this.project(me.pos.x, me.y + 2.3, me.pos.y);
      this.hud.meter(sp, me.stateT / (me.sd.apex * 2), Math.abs(me.stateT - me.sd.apex) < 0.09);
    } else if (this.isHuman(team)) {
      const other = 1 - team;
      const otherHuman = this.isHuman(other);
      const oc = otherHuman ? this.ctrlOf(other) : null;
      const showing = (oc && oc.state === 'shoot' && !oc.sd.released);
      if (!showing) this.hud.meter(null);
    }
  }

  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.cam);
    if (v.z > 1) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top };
  }

  // ------------------------------------------------------------ AI
  updateAI(b, dt) {
    b.aiT -= dt;
    const h = this.holder();
    const myTeamHasBall = this.possession === b.team && h;
    if (this.ball.mode === 'loose' || this.ball.mode === 'tip') return this.aiLoose(b, dt);
    if (this.ball.mode === 'lob' && this.ball.pass?.to === b) {
      // run under the lob; updatePass handles the rise and the finish
      if (!b.scripted()) {
        const p1 = this.ball.pass.p1;
        b.seek(p1.x, p1.z, 1, true);
        b.faceToward(p1.x, p1.z);
      }
      return;
    }
    if (myTeamHasBall) {
      if (h === b) return this.aiHandler(b, dt);
      return this.aiOffBall(b, dt);
    }
    return this.aiDefense(b, dt);
  }

  aiLoose(b, dt) {
    if (b.scripted()) return;
    const bp = this.ball.pos;
    const mine = this.teamBallers(b.team);
    const dists = mine.map((p) => Math.hypot(p.pos.x - bp.x, p.pos.y - bp.z));
    const meD = Math.hypot(b.pos.x - bp.x, b.pos.y - bp.z);
    const iAmCloser = meD <= Math.min(...dists) + 0.01;
    if (iAmCloser) {
      b.seek(bp.x, bp.z, 1, meD > 3);
      if (meD < 0.9 && bp.y > b.h * 1.1 && !b.airborne) {
        b.airborne = true;
        b.vy = JUMP_V * 0.9;
        b.state = 'block';
        b.stateT = 0;
        b.anim.play('block', { fade: 0.06, onDone: () => { if (b.state === 'block') b.state = 'play'; } });
      }
    } else {
      // drift toward our hoop-side spacing
      const rim = this.rimFor(b.team);
      b.seek(lerp(b.pos.x, rim.x * 0.3, 0.4), lerp(b.pos.y, 0, 0.3), 0.5);
    }
  }

  aiHandler(b, dt) {
    if (b.scripted()) return;
    const rim = this.rimFor(b.team);
    const dir = this.attackDir(b.team);
    const dist = Math.hypot(rim.x - b.pos.x, rim.z - b.pos.y);
    const mate = this.mate(b);
    const diff = this.isHuman(b.team) ? difficultyFor(4) : this.diff;
    b.faceToward(rim.x, rim.z);

    if (b.aiT > 0) { this.aiSteer(b, dt); return; }
    b.aiT = diff.reaction + Math.random() * 0.12;

    const myOpen = this.opennessOf(b);
    const mateOpen = this.opennessOf(mate);
    const urgency = clamp((6 - this.shotClock) / 6, 0, 1);
    const pastHalf = (b.pos.x - 0) * dir > 0.5;

    // shoot it?
    const lookWanted = 0.78 - diff.shootIQ * 0.3 - urgency * 0.45;
    const goodShot = (myOpen > 2.0 - urgency && pastHalf && (dist < 5.5 || (dist > COURT.THREE_R + 0.15 && dist < 9 && b.info.three > 55)));
    if (this.shotClock < 1.2 && pastHalf) return this.startShot(b);
    if (goodShot && Math.random() < diff.shootIQ + urgency * 0.4 + (b.onFire ? 0.3 : 0)) {
      if (dist < 4.2 && myOpen > 1.6) {
        if (Math.random() < diff.dunkBias && b.info.dunk > 50) { b._sprint = true; return this.startDunk(b); }
        return this.startLayup(b);
      }
      return this.startShot(b);
    }
    // lob to a cutting mate
    const mateRimD = Math.hypot(rim.x - mate.pos.x, rim.z - mate.pos.y);
    if (mateRimD < 5.5 && mateOpen > 1.8 && Math.random() < diff.lobRate && mate.info.dunk > 60 && !mate.scripted()) {
      return this.startPass(b, true);
    }
    // swing it
    if (mateOpen - myOpen > 1.6 && Math.random() < 0.55 + urgency * 0.3) return this.startPass(b, false);
    // drive
    if ((myOpen > 1.4 || Math.random() < diff.dunkBias * 0.4) && pastHalf && dist > 3.4) {
      b.sd.drive = { x: rim.x - dir * 1.6, z: (Math.random() - 0.5) * 3 };
    }
    // spin out of pressure
    const presser = this.nearestOpp(b);
    if (presser && Math.hypot(presser.pos.x - b.pos.x, presser.pos.y - b.pos.y) < 1.1 && Math.random() < 0.3 && b.spinCD <= 0) {
      this.startSpin(b);
    }
    this.aiSteer(b, dt);
  }

  aiSteer(b, dt) {
    const rim = this.rimFor(b.team);
    const dir = this.attackDir(b.team);
    const pastHalf = (b.pos.x) * dir > 0.5;
    if (!pastHalf) {
      b.seek(dir * 6.5, b.pos.y * 0.4, 1, b.turbo > 35);
      return;
    }
    if (b.sd.drive) {
      b.seek(b.sd.drive.x, b.sd.drive.z, 1, b.turbo > 20 || b.onFire);
      const dd = Math.hypot(rim.x - b.pos.x, rim.z - b.pos.y);
      if (dd < 3.3) {
        const diff = this.isHuman(b.team) ? difficultyFor(4) : this.diff;
        b.sd.drive = null;
        if (Math.random() < diff.dunkBias && b.info.dunk > 50) { b._sprint = true; this.startDunk(b); }
        else this.startLayup(b);
      }
      return;
    }
    // probe around the arc
    const orbit = b.sd.orbit || (b.sd.orbit = { a: Math.atan2(b.pos.y - rim.z, b.pos.x - rim.x), r: 6.2 + Math.random() * 1.4, w: (Math.random() < 0.5 ? 1 : -1) * 0.5 });
    orbit.a += orbit.w * dt;
    const tx = rim.x + Math.cos(orbit.a) * orbit.r * -dir * -1;
    const tz = clamp(rim.z + Math.sin(orbit.a) * orbit.r, -6.4, 6.4);
    b.seek(clamp(tx, -13.4, 13.4), tz, 0.75);
  }

  opennessOf(b) {
    let best = 99;
    for (const d of this.teamBallers(1 - b.team)) {
      best = Math.min(best, Math.hypot(d.pos.x - b.pos.x, d.pos.y - b.pos.y));
    }
    return best;
  }

  nearestOpp(b) {
    let best = null, bd = 1e9;
    for (const d of this.teamBallers(1 - b.team)) {
      const dd = (d.pos.x - b.pos.x) ** 2 + (d.pos.y - b.pos.y) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  aiOffBall(b, dt) {
    if (b.scripted()) return;
    b.cutT -= dt;
    const rim = this.rimFor(b.team);
    const dir = this.attackDir(b.team);
    const h = this.holder();
    if (b.cutT > 0) {
      // hard cut to the rim for the oop
      b.seek(rim.x - dir * 1.2, rim.z + (b.pos.y > 0 ? 1 : -1) * 0.8, 1, true);
      return;
    }
    if (Math.random() < 0.002 && Math.hypot(rim.x - b.pos.x, rim.z - b.pos.y) > 5) b.cutT = 1.1;
    // spacing: opposite wing/corner from the handler
    const spots = [
      { x: rim.x - dir * 5.6, z: 5.6 }, { x: rim.x - dir * 5.6, z: -5.6 },
      { x: rim.x - dir * 7.4, z: 2.2 }, { x: rim.x - dir * 7.4, z: -2.2 },
      { x: rim.x - dir * 1.4, z: 3.4 }, { x: rim.x - dir * 1.4, z: -3.4 },
    ];
    if (!b.aiSpot || b.aiT <= 0) {
      b.aiT = 0.8 + Math.random() * 0.8;
      let best = spots[0], bs = -1e9;
      for (const s of spots) {
        const dh = h ? Math.hypot(s.x - h.pos.x, s.z - h.pos.y) : 5;
        const dme = Math.hypot(s.x - b.pos.x, s.z - b.pos.y);
        const score = dh * 1.4 - dme * 0.5 + Math.random() * 2;
        if (score > bs) { bs = score; best = s; }
      }
      b.aiSpot = best;
    }
    b.seek(b.aiSpot.x, b.aiSpot.z, 0.85);
    if (h) b.faceToward(h.pos.x, h.pos.y);
  }

  aiDefense(b, dt) {
    if (b.scripted()) return;
    // skip if this player is the human-controlled defender
    const human = this.isHuman(b.team) && this.ctrlOf(b.team) === b && this.ball.mode !== 'tip';
    if (human) return;
    const diff = this.isHuman(b.team) ? difficultyFor(4) : this.diff;
    const opp = this.teamBallers(1 - b.team);
    const mine = this.teamBallers(b.team);
    // man assignment: keep crossing minimal
    const myIdx = mine.indexOf(b);
    let man = opp[myIdx];
    const other = mine[1 - myIdx];
    const swap = (Math.hypot(b.pos.x - opp[1 - myIdx].pos.x, b.pos.y - opp[1 - myIdx].pos.y) + 1.2 <
                  Math.hypot(b.pos.x - man.pos.x, b.pos.y - man.pos.y)) && other && !other.scripted();
    if (swap) man = opp[1 - myIdx];
    const ownRim = this.rimFor(1 - b.team);   // the hoop we defend
    const hasBall = this.holder() === man;
    const press = hasBall ? clamp(0.9 + b.info.def * 0.004, 0.9, 1.35) : 1.9;
    const tx = lerp(man.pos.x, ownRim.x, hasBall ? 0.16 : 0.34);
    const tz = lerp(man.pos.y, ownRim.z, hasBall ? 0.16 : 0.34);
    const gx = man.pos.x + (tx - man.pos.x) * (press / Math.max(0.001, Math.hypot(tx - man.pos.x, tz - man.pos.y)));
    const gz = man.pos.y + (tz - man.pos.y) * (press / Math.max(0.001, Math.hypot(tx - man.pos.x, tz - man.pos.y)));
    const far = Math.hypot(b.pos.x - gx, b.pos.y - gz);
    b.seek(gx, gz, 1, far > 4.5 && b.turbo > 25);
    b.faceToward(man.pos.x, man.pos.y);

    // contest a shot
    if (man.state === 'shoot' && !man.sd.released && Math.hypot(man.pos.x - b.pos.x, man.pos.y - b.pos.y) < 2.0) {
      if (Math.random() < 0.5 + b.info.block * 0.004) this.startBlock(b);
    }
    // contest a dunk drive
    if (man.state === 'dunk' && Math.hypot(man.pos.x - b.pos.x, man.pos.y - b.pos.y) < 1.6 && Math.random() < diff.shoveRate + b.info.block * 0.002) {
      this.startBlock(b);
    }
    // swipe + shove
    if (hasBall && far < 1.4) {
      if (Math.random() < diff.stealRate * dt) this.attemptSteal(b);
      else if (Math.random() < diff.shoveRate * dt && b.turbo > 30) this.attemptShove(b);
    }
    // crash the glass when a shot is up
    if (this.ball.mode === 'shot') {
      const hoop = this.ball.shot.hoop;
      b.seek(lerp(b.pos.x, hoop.center.x - hoop.dir * 1.1, 0.5), lerp(b.pos.y, (Math.random() - 0.5) * 1.6, 0.4), 0.9);
    }
  }

  // ------------------------------------------------------------ live update
  updateLive(dt) {
    // clocks
    if (this.phase === 'live') {
      this.clockQ -= dt;
      if (this.holder() || this.ball.mode === 'shot' || this.ball.mode === 'pass' || this.ball.mode === 'lob') {
        if (this.holder()) this.shotClock -= dt;
      }
      if (this.clockQ <= 0 && !this.pendingEnd) {
        const airborneBall = ['shot', 'dunk', 'lob', 'pass'].includes(this.ball.mode) ||
          (this.holder() && ['shoot', 'layup', 'dunk'].includes(this.holder().state));
        sfx.buzzer();
        if (airborneBall) this.pendingEnd = true;
        else return this.endPeriod();
      }
      if (this.shotClock <= 0 && this.holder()) {
        return this.turnover('SHOT CLOCK');
      }
      // the buzzer sounded with a shot in the air; once it resolves without
      // points (miss, swat, dropped lob) the period is over
      if (this.pendingEnd) {
        const settled = (this.ball.mode === 'held' || this.ball.mode === 'loose') &&
          !['shoot', 'dunk', 'layup'].includes(this.holder()?.state || '');
        if (settled) {
          this.pendingEnd = false;
          return this.endPeriod();
        }
      }
    }

    // inputs + AI: the human drives exactly one player per team (ctrlOf),
    // the AI drives everyone else.
    for (const team of [0, 1]) {
      if (this.isHuman(team)) this.updateUser(team, dt);
    }
    for (const b of this.ballers) {
      const humanControls = this.isHuman(b.team) && this.ctrlOf(b.team) === b;
      if (!humanControls) this.updateAI(b, dt);
    }

    // state timers + scripted updates
    for (const b of this.ballers) {
      b.protected = Math.max(0, b.protected - dt);
      b.stealCD = Math.max(0, b.stealCD - dt);
      b.shoveCD = Math.max(0, b.shoveCD - dt);
      b.spinCD = Math.max(0, b.spinCD - dt);
      b.callForBall = Math.max(0, b.callForBall - dt);
      // turbo
      const burning = b._sprint && b.vel.length() > 1 && !b.onFire;
      b.turbo = clamp(b.turbo + (burning ? -30 : 16) * dt, 0, 100);
      if (b.onFire) b.turbo = 100;

      if (b.state === 'shoot') {
        b.stateT += dt;
        if (!b.sd.released && !b.airborne && b.stateT > 0.15) this.releaseShot(b, 0.05); // landed without releasing
        if (b.sd.released && b.anim.finished) b.state = 'play';
        // CPU release timing
        if (!b.sd.released && !this.isHuman(b.team)) {
          const err = (1 - this.diff.shootIQ) * 0.12;
          if (b.stateT >= b.sd.apex + (Math.random() - 0.5) * err) this.releaseShot(b);
        }
        if (!b.sd.released && this.isHuman(b.team) && this.holder() !== b) {
          // safety: shot state but ball gone (shoved) — resolve
          b.state = 'play';
        }
      } else if (b.state === 'dunk') {
        this.updateDunk(b, dt);
      } else if (b.state === 'layup') {
        this.updateLayup(b, dt);
      } else if (b.state === 'fall') {
        b.stateT += dt;
        if (b.anim.finished) {
          b.state = 'getup';
          b.anim.play('getUp', { fade: 0.08, onDone: () => { b.state = 'play'; b.protected = 0.5; } });
        }
      }
      if (b.state !== 'dunk') b.move(dt, this.holder() === b, this.possession !== b.team && this.phase === 'live');
    }

    // player-player collision push
    for (let i = 0; i < this.ballers.length; i++) {
      for (let j = i + 1; j < this.ballers.length; j++) {
        const a = this.ballers[i], c = this.ballers[j];
        if (a.state === 'fall' || c.state === 'fall' || a.state === 'dunk' || c.state === 'dunk') continue;
        const dx = c.pos.x - a.pos.x, dz = c.pos.y - a.pos.y;
        const d = Math.hypot(dx, dz);
        if (d < 0.62 && d > 0.001) {
          const push = (0.62 - d) / 2;
          const nx = dx / d, nz = dz / d;
          a.pos.x -= nx * push; a.pos.y -= nz * push;
          c.pos.x += nx * push; c.pos.y += nz * push;
        }
      }
    }

    this.updateBall(dt);
    this.runTimers();
  }

  endPeriod() {
    this.pendingEnd = false;
    this.phase = 'dead';
    sfx.horn();
    const isHalf = this.quarter === 2;
    const isEnd = this.quarter >= 4 && this.scores[0] !== this.scores[1];
    if (isEnd) return this.endGame();
    const next = () => {
      this.quarter++;
      this.clockQ = this.quarter > 4 ? 60 : this.qLen;
      this.shotClock = 14;
      this.phase = 'live';
      // alternate possession
      this.inbound(this.quarter % 2 === 0 ? 1 : 0);
      this.hud.banner(this.qLabel(), this.quarter > 4 ? 'EXTRA PERIOD — 1:00' : isHalf ? 'SIDES SWITCHED' : '', 1800);
    };
    if (this.quarter >= 4) {
      this.hud.banner('OVERTIME', `TIED AT ${this.scores[0]}`, 2400, 'fire');
      sfx.say('We are going to overtime!', 2);
      this.after(2.6, next);
    } else if (isHalf) {
      this.hud.banner('HALFTIME', `${this.home.abbr} ${this.scores[0]} — ${this.away.abbr} ${this.scores[1]}`, 2600);
      sfx.organ();
      sfx.say(`At the half: ${this.scores[0]} to ${this.scores[1]}.`);
      this.after(3.0, next);
    } else {
      this.hud.banner(`END OF ${this.qLabel()}`, '', 1800);
      this.after(2.2, next);
    }
  }

  endGame() {
    this.phase = 'over';
    const won = this.scores[0] > this.scores[1];
    const winCrew = won ? this.home : this.away;
    sfx.horn();
    sfx.say(`That's the ball game! ${winCrew.city} ${winCrew.name} take it, ${Math.max(...this.scores)} to ${Math.min(...this.scores)}.`, 2);
    this.crowdPop(1.1);
    this.confetti(winCrew);
    for (const b of this.ballers) {
      b.stop();
      b.state = b.team === (won ? 0 : 1) ? 'celebrate' : 'dejected';
      b.anim.play(b.state, { fade: 0.3 });
    }
    // stat lines
    const row = (b) => `
      <tr><td class="pn"><i style="background:${b.crew.colors.primary}"></i>${b.info.nick}</td>
      <td>${b.stats.pts}</td><td>${b.stats.dunks}</td><td>${b.stats.threes}</td>
      <td>${b.stats.stl}</td><td>${b.stats.blk}</td><td>${b.stats.reb}</td></tr>`;
    const mvp = [...this.ballers].sort((a, c) =>
      (c.stats.pts + (c.stats.dunks + c.stats.stl + c.stats.blk) * 1.5) -
      (a.stats.pts + (a.stats.dunks + a.stats.stl + a.stats.blk) * 1.5))[0];
    const f = this.hud.el.final;
    f.innerHTML = `
      <div class="fin-card">
        <div class="fin-score">
          <span style="--c:${this.away.colors.primary}">${this.away.abbr} ${this.scores[1]}</span>
          <em>FINAL${this.quarter > 4 ? ' / OT' : ''}</em>
          <span style="--c:${this.home.colors.primary}">${this.scores[0]} ${this.home.abbr}</span>
        </div>
        <div class="fin-head">${won ? this.home.city + ' ' + this.home.name : this.away.city + ' ' + this.away.name} WIN</div>
        <div class="fin-mvp">PLAYER OF THE GAME — ${mvp.info.name} “${mvp.info.nick}” · ${mvp.stats.pts} PTS</div>
        <table class="fin-stats">
          <tr><th></th><th>PTS</th><th>DNK</th><th>3PM</th><th>STL</th><th>BLK</th><th>REB</th></tr>
          ${this.ballers.map(row).join('')}
        </table>
        <div class="fin-buttons"></div>
      </div>`;
    const btns = f.querySelector('.fin-buttons');
    for (const [label, fn] of this.opts.buttons?.({ won, home: this.scores[0], away: this.scores[1] }) || [['BACK TO TITLE', () => this.opts.onExit?.()]]) {
      const el = document.createElement('button');
      el.className = 'menu-btn';
      el.textContent = label;
      el.onclick = () => { sfx.chime(); fn(); };
      btns.appendChild(el);
    }
    f.classList.add('show');
    this.opts.onEnd?.({ home: this.scores[0], away: this.scores[1], won });
  }

  // ------------------------------------------------------------ presentation
  makeParticles(n) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.16, vertexColors: true, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    return {
      mesh: pts, n, i: 0,
      p: new Array(n).fill(null),
      pos, col,
    };
  }

  emit(x, y, z, vx, vy, vz, r, g, b, life, grav = 0) {
    const P = this.particles;
    P.p[P.i] = { x, y, z, vx, vy, vz, r, g, b, life, t: 0, grav };
    P.i = (P.i + 1) % P.n;
  }

  burst(p, [r, g, b], count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3;
      this.emit(p.x, p.y, p.z, Math.cos(a) * s, Math.random() * 2.5, Math.sin(a) * s, r, g, b, 0.5 + Math.random() * 0.3, 4);
    }
  }

  confetti(crew) {
    const cols = [crew.colors.primary, crew.colors.secondary, '#f4f2ec'];
    const c = new THREE.Color();
    for (let i = 0; i < 260; i++) {
      c.set(cols[i % 3]);
      this.emit(
        (Math.random() - 0.5) * 24, 9 + Math.random() * 4, (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 1.2, -0.8 - Math.random(), (Math.random() - 0.5) * 1.2,
        c.r, c.g, c.b, 4 + Math.random() * 3, 0.25
      );
    }
  }

  updateParticles(dt) {
    const P = this.particles;
    for (let i = 0; i < P.n; i++) {
      const p = P.p[i];
      const o = i * 3;
      if (!p || p.t >= p.life) {
        P.pos[o + 1] = -50;
        continue;
      }
      p.t += dt;
      p.vy -= (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const f = 1 - p.t / p.life;
      P.pos[o] = p.x; P.pos[o + 1] = p.y; P.pos[o + 2] = p.z;
      P.col[o] = p.r * f; P.col[o + 1] = p.g * f; P.col[o + 2] = p.b * f;
    }
    P.mesh.geometry.attributes.position.needsUpdate = true;
    P.mesh.geometry.attributes.color.needsUpdate = true;

    // fire trails
    for (const b of this.ballers) {
      if (!b.onFire) continue;
      if (Math.random() < 0.8) {
        this.emit(
          b.pos.x + (Math.random() - 0.5) * 0.3, 0.15 + Math.random() * 0.5 + b.y, b.pos.y + (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.4, 0.8 + Math.random(), (Math.random() - 0.5) * 0.4,
          1, 0.45 + Math.random() * 0.3, 0.05, 0.45, 0
        );
      }
    }
    const fireBall = this.holder()?.onFire || this.ball.shot?.shooter?.onFire;
    if (fireBall && this.ball.pos.y > 0) {
      this.emit(
        this.ball.pos.x, this.ball.pos.y, this.ball.pos.z,
        (Math.random() - 0.5) * 0.3, 0.5, (Math.random() - 0.5) * 0.3,
        1, 0.5, 0.08, 0.35, 0
      );
    }
  }

  updateCamera(dt) {
    const bx = clamp(this.ball.pos.x, -9.0, 9.0);
    const bz = this.ball.pos.z;
    const want = new THREE.Vector3(bx * 0.80, 6.6, 15.6);
    this.cam.position.lerp(want, Math.min(1, 3.2 * dt));
    if (this.camShake > 0.002) {
      this.camShake *= Math.pow(0.001, dt);
      this.cam.position.x += (Math.random() - 0.5) * this.camShake * 0.5;
      this.cam.position.y += (Math.random() - 0.5) * this.camShake * 0.4;
    }
    // near a hoop, lean the framing onto the rim so finishes stay in shot
    const rimPull = clamp((Math.abs(this.ball.pos.x) - 7.5) / 5, 0, 1) * Math.sign(this.ball.pos.x);
    const lookX = bx * 0.88 + rimPull * 2.2;
    const look = new THREE.Vector3(lookX, 1.8 + this.ball.pos.y * 0.22 + Math.abs(rimPull) * 0.5, bz * 0.22);
    this._lookAt = this._lookAt || look.clone();
    this._lookAt.lerp(look, Math.min(1, 4.5 * dt));
    this.cam.lookAt(this._lookAt);
    const targetFov = 40 - clamp(Math.abs(this.ball.pos.x) - 6, 0, 7) * 0.6;
    this.cam.fov += (targetFov - this.cam.fov) * Math.min(1, 2 * dt);
    this.cam.updateProjectionMatrix();
  }

  jumboFlash(text, color) {
    this.arena.jumbo.draw({ marquee: text, marqueeColor: color, sub: `${this.home.abbr} ${this.scores[0]} — ${this.away.abbr} ${this.scores[1]}` });
    this._jumboT = this.t + 2.2;
  }

  updateHud() {
    for (const team of [0, 1]) {
      const ctrl = this.ctrlOf(team);
      const fire = this.teamBallers(team).some((b) => b.onFire);
      this.hud.team(team === 0 ? 0 : 1, {
        abbr: (team === 0 ? this.home : this.away).abbr,
        name: (team === 0 ? this.home : this.away).name,
        score: this.scores[team],
        color: (team === 0 ? this.home : this.away).colors.primary,
        fire,
        turbo: this.isHuman(team) ? ctrl?.turbo : null,
      });
    }
    this.hud.mid({
      qtr: this.qLabel(),
      clock: this.fmtClock(this.clockQ),
      shot: Math.max(0, Math.ceil(this.shotClock)),
      urgent: this.shotClock <= 5,
    });
    if (this.t > this._jumboT && this.t - (this._jumboDrew || 0) > 0.4) {
      this._jumboDrew = this.t;
      this.arena.jumbo.draw({
        abbrH: this.home.abbr, abbrA: this.away.abbr,
        home: this.scores[0], away: this.scores[1],
        qtr: this.qLabel(), clock: this.fmtClock(this.clockQ),
        shot: Math.max(0, Math.ceil(this.shotClock)),
      });
    }
  }

  contextHint() {
    const padIn = pads.p1.connected;
    const team = 0;
    if (!this.isHuman(team)) return;
    const off = this.possession === team;
    const hint = padIn
      ? (off ? '✕ SHOOT (HOLD, RELEASE AT THE TOP) · □ PASS · △ ALLEY-OOP · ◯ SPIN · R2 TURBO'
             : '✕ BLOCK · □ STEAL · ◯ SHOVE · L1 SWITCH · R2 TURBO')
      : (off ? 'SPACE SHOOT (HOLD) · E PASS · F ALLEY-OOP · Q SPIN · SHIFT TURBO'
             : 'SPACE BLOCK · E STEAL · Q SHOVE · F SWITCH · SHIFT TURBO');
    this.hud.hint(hint);
  }

  /** Markers under the controlled players. */
  ensureMarkers() {
    if (this._markers) return;
    this._markers = [];
    for (const team of [0, 1]) {
      if (!this.isHuman(team)) { this._markers.push(null); continue; }
      const crew = team === 0 ? this.home : this.away;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.55, 24),
        new THREE.MeshBasicMaterial({ color: crew.colors.secondary, transparent: true, opacity: 0.85, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.scene.add(ring);
      this._markers.push(ring);
    }
  }

  updateMarkers() {
    this.ensureMarkers();
    for (const team of [0, 1]) {
      const ring = this._markers[team];
      if (!ring) continue;
      const b = (this.possession === team && this.holder()?.team === team) ? this.holder() : this.ctrlOf(team);
      ring.position.x = b.pos.x;
      ring.position.z = b.pos.y;
      ring.material.opacity = 0.55 + Math.sin(this.t * 6) * 0.25;
    }
  }

  togglePause() {
    if (this.phase === 'over') return;
    this.paused = !this.paused;
    this.hud.el.pause.classList.toggle('show', this.paused);
    if (this.paused) {
      const p = this.hud.el.pause;
      p.querySelector('#pause-resume').onclick = () => this.togglePause();
      p.querySelector('#pause-exit').onclick = () => { this.opts.onExit?.(); };
      p.querySelector('#pause-mute').onclick = () => {
        sfx.setMuted(!sfx.muted);
        p.querySelector('#pause-mute').textContent = sfx.muted ? 'SOUND: OFF' : 'SOUND: ON';
      };
      p.querySelector('#pause-voice').onclick = () => {
        sfx.voiceOn = !sfx.voiceOn;
        p.querySelector('#pause-voice').textContent = sfx.voiceOn ? 'ANNOUNCER: ON' : 'ANNOUNCER: OFF';
      };
    }
  }

  // ------------------------------------------------------------ loop
  loop() {
    this._raf = requestAnimationFrame(() => this.loop());
    const real = Math.min(this.clock.getDelta(), 0.045);
    pads.poll();
    this.edgeKeys = this.edgeKeysNext || new Set();
    this.edgeKeysNext = new Set();
    // pad pause works even while paused
    for (const p of pads.pads) {
      if (p.edges.includes(BTN.OPTIONS)) { this.togglePause(); break; }
    }
    if (this.paused) { this.renderer.render(this.scene, this.cam); return; }
    const dt = real;
    this.t += dt;

    if (this.phase === 'tip' || this.phase === 'live') this.updateLive(dt);
    else {
      this.runTimers();
      for (const b of this.ballers) {
        if (this.phase === 'over') b.move(dt, false, false);
        b.anim.update(dt);
      }
      if (this.phase === 'dead') this.updateBall(dt);
    }
    if (this.phase === 'tip' || this.phase === 'live') {
      for (const b of this.ballers) b.anim.update(dt);
    }

    this.excite = Math.max(0.18, this.excite - dt * 0.12);
    updateArena(this.arena, this.t, dt, this.excite);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.updateMarkers();
    this.updateHud();

    // adaptive quality
    this._fpsAcc += real; this._fpsN++;
    if (this._fpsN >= 60) {
      const avg = this._fpsAcc / this._fpsN;
      if (avg > 1 / 42 && !this._lowQ) {
        this._lowQ = true;
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.arena.key.castShadow = false;
      }
      this._fpsAcc = 0; this._fpsN = 0;
    }

    this.renderer.render(this.scene, this.cam);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup', this._keyUp);
    window.removeEventListener('resize', this._resize);
    try { this.renderer.dispose(); } catch { /* fine */ }
    this.container.innerHTML = '';
    this.hud.el.final.classList.remove('show');
    this.hud.el.pause.classList.remove('show');
    this.hud.el.matchup.classList.remove('show');
    this.hud.meter(null);
  }
}
