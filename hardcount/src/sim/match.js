// A football game: the field, both teams, the ball, the rules and the clock.
// Pure logic — no three.js — so the whole game runs headless (tools/simgame.mjs)
// and the 3D match screen just watches it and feeds it the controller.
//
// Flow (phase):
//   'kickoff'  a kickoff is next: needs calls (kick type / return) → callKickoff()
//   'playcall' a scrimmage down is next: needs calls → callPlays(offId, defId)
//   'pat'      after a touchdown: choosePat('kick' | 'two')
//   'presnap'  lined up; the offense snaps (user ✕, or the CPU after a beat)
//   'live'     the play is on
//   'post'     whistle blown: bodies settle, refs signal → advance()
//   'final'    game over
import { makeRng } from '../core/util.js';
import { makeField } from './field.js';
import { Ent } from './entity.js';
import { Ball } from './ball.js';
import { buildRoster } from '../data/roster.js';
import { OFFENSE_BY_ID } from './plays/offense.js';
import { DEFENSE_BY_ID } from './plays/defense.js';
import { SPECIAL_BY_ID } from './plays/special.js';
import { FORMATIONS } from './plays/formations.js';
import { clamp, norm, dist, headingOf } from './math.js';
import * as setup from './setup.js';
import * as O from './ai/offense.js';
import * as D from './ai/defense.js';
import * as C from './contact.js';
import * as P from './passing.js';
import { userControl } from './user.js';
import { runScripts, runnerBrain, optionBrain, qbRunFeet, scriptCarrier } from './scripts.js';
import * as K from './special.js';
import * as RULES from './rules.js';

export const DIFFICULTY = {
  rookie: { cpu: -9, user: 5, qbRisk: -0.12, cpuMoves: 0.55, label: 'ROOKIE' },
  pro: { cpu: 0, user: 0, qbRisk: 0, cpuMoves: 1, label: 'PRO' },
  allpro: { cpu: 4, user: -2, qbRisk: 0.05, cpuMoves: 1.2, label: 'ALL-PRO' },
  allglory: { cpu: 8, user: -4, qbRisk: 0.1, cpuMoves: 1.45, label: 'ALL-GLORY' },
};

const other = (s) => (s === 'home' ? 'away' : 'home');

function teamStats() {
  return {
    firstDowns: 0, plays: 0, yards: 0, passYds: 0, rushYds: 0, comp: 0, att: 0, passTd: 0, rushTd: 0, ints: 0,
    fumbles: 0, fumblesLost: 0, sacks: 0, sackYds: 0, penalties: 0, penYds: 0, top: 0, third: 0, thirdConv: 0,
    laterals: 0, bigPlays: 0, returnYds: 0, punts: 0, fgm: 0, fga: 0, xpm: 0, xpa: 0,
  };
}

export class Match {
  constructor(opts = {}) {
    this.field = opts.field || makeField(opts.fieldSize || 'sevens');
    this.teams = { home: opts.home, away: opts.away };
    // (a career passes its own rosters: the team with you on its depth chart)
    this.rosters = { home: opts.rosters?.home || buildRoster(opts.home), away: opts.rosters?.away || buildRoster(opts.away) };
    this.users = { home: opts.users && 'home' in opts.users ? opts.users.home : 0, away: opts.users && 'away' in opts.users ? opts.users.away : null };
    this.lock = opts.lock || null;                 // career: { side, player }
    this.lockReturns = !!opts.lockReturns;
    this.settings = { quarterLen: 4, accelClock: true, penalties: true, fatigue: true, autoSwitch: true, ...(opts.settings || {}) };
    this.difficulty = DIFFICULTY[opts.difficulty || 'pro'] || DIFFICULTY.pro;
    this.weather = opts.weather || 'clear';
    this.wind = opts.wind || 0;
    this.windVec = this.wind ? { x: (opts.windDir ?? 0.7) * this.wind * 3, z: this.wind * 2 } : null;
    this.rng = makeRng(opts.seed ?? ((Date.now() * 7919) >>> 0));
    this.ents = { home: new Map(), away: new Map() };
    this.active = []; this.offense = []; this.defense = [];
    this.ball = new Ball();
    this.engagements = [];
    this.listeners = [];
    this.time = 0;
    this.playT = 0;
    // game state
    this.quarter = 1;
    this.clock = this.settings.quarterLen * 60;
    this.clockRunning = false;
    this.score = { home: 0, away: 0 };
    this.timeouts = { home: 3, away: 3 };
    this.dirHome = 1;
    this.possession = 'away';
    this.down = 1; this.toGo = 10; this.los = 0; this.ballX = 0; this.firstDownZ = 10;
    this.phase = 'pregame';
    this.special = null;
    this.tryMode = null;
    this.ot = null;
    this.stats = { home: teamStats(), away: teamStats(), players: new Map() };
    this.log = [];
    this.cmd = { home: null, away: null };
    this.userEnt = { home: null, away: null };
    this.icons = { home: {}, away: {} };
    this.flags = [];
    this.result = null;
    this.drive = null;
    this.playNo = 0;
    this.twoMin = { 2: false, 4: false };
    this.hurry = { home: false, away: false };
    this.firstKick = null;
    this.autoCalls = !!opts.autoCalls;    // headless: the CPU calls both sides
  }

  // ------------------------------------------------------------ events / stats
  on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  emit(type, data = {}) {
    data.type = type;
    data.t = this.time;
    for (const fn of this.listeners) { try { fn(data, this); } catch (e) { console.error(e); } }
  }
  stat(e, key, v = 1) {
    if (!e) return;
    let s = this.stats.players.get(e.id);
    if (!s) { s = { id: e.id, side: e.side, name: `${e.p.first} ${e.p.last}`, num: e.num, pos: e.p.pos }; this.stats.players.set(e.id, s); }
    s[key] = (s[key] || 0) + v;
    if (this.phase === 'live' || this.phase === 'post') this.playStats?.push([s, key, v]);
  }
  tstat(side, key, v = 1) {
    this.stats[side][key] = (this.stats[side][key] || 0) + v;
    if (this.phase === 'live' || this.phase === 'post') this.playStats?.push([this.stats[side], key, v]);
  }
  /** A penalty wiped the play out: so are its numbers (the completion, the tackle, the sack). */
  undoPlayStats() {
    for (const [o, key, v] of this.playStats || []) o[key] = (o[key] || 0) - v;
    this.playStats = [];
  }

  // ------------------------------------------------------------ teams / bodies
  dirOf(side) { return side === 'home' ? this.dirHome : -this.dirHome; }
  get offSide() { return this.possession; }
  get defSide() { return other(this.possession); }
  get offDir() { return this.dirOf(this.possession); }
  dirFor(e) { return this.dirOf(e.side); }
  foesOf(e) { return e.side === this.offSide ? this.defense : this.offense; }
  matesOf(e) { return e.side === this.offSide ? this.offense : this.defense; }

  entFor(side, player) {
    let e = this.ents[side].get(player.id);
    if (!e) {
      // difficulty shifts the CPU side's ratings (and nudges the person's)
      const isUser = this.users[side] !== null && this.users[side] !== undefined;
      const delta = isUser ? this.difficulty.user : this.difficulty.cpu;
      const p = delta ? { ...player, r: Object.fromEntries(Object.entries(player.r).map(([k, v]) => [k, Math.max(25, Math.min(99, v + delta))])) } : player;
      e = new Ent(p, side);
      e.p = player;   // keep the real player for names, looks, stats
      this.ents[side].set(player.id, e);
    }
    return e;
  }

  byRole(role, side = this.offSide) {
    const list = side === this.offSide ? this.offense : this.defense;
    return list.find((e) => e.role === role) || null;
  }

  get carrier() { return this.ball.carrier; }

  ballSpot() { return { x: this.ball.x, z: this.ball.z }; }

  /** Forward progress of a carrier (z of the ball in his team's direction). */
  progressOf(e) { return this.ball.z * this.dirOf(e.side); }
  betterProgress(a, b) { return a === undefined || a === null ? b : Math.max(a, b); }

  // ------------------------------------------------------------ game start
  /** Kick off the game. kicking = the side that kicks first. */
  start({ kicking = 'home' } = {}) {
    this.firstKick = kicking;
    this.quarter = 1;
    this.clock = this.settings.quarterLen * 60;
    this.dirHome = kicking === 'home' ? 1 : -1;
    this.setupKickoff(kicking);
    this.emit('gameStart', { kicking });
  }

  setupKickoff(kickSide, { safety = false } = {}) {
    this.possession = kickSide;
    this.special = 'kickoff';
    this.tryMode = null;
    const yd = safety ? this.field.safetyKickYard : this.field.kickoffYard;
    this.los = this.field.ownYardZ(this.offDir, yd);
    this.ballX = 0;
    this.down = 0; this.toGo = 0;
    this.phase = 'kickoff';
    this.safetyKick = safety;
    this.clearField();
    this.emit('phase', { phase: 'kickoff', kickSide });
  }

  newSeries(side, z, x = this.ballX) {
    this.possession = side;
    const F = this.field;
    const dir = this.offDir;
    // never start inside your own end zone or the opponent's
    z = clamp(z, -F.halfL + 0.5, F.halfL - 0.5);
    this.los = z;
    this.ballX = clamp(x, -F.hash, F.hash);
    this.down = 1;
    const toGoal = F.toGoal(z, dir);
    this.toGo = Math.min(F.firstDown, toGoal);
    this.firstDownZ = this.los + this.toGo * dir;
    this.special = null;
    this.drive = { side, startZ: z, plays: 0, yards: 0, startClock: this.clock, startQ: this.quarter };
    this.phase = 'playcall';
  }

  get goalToGo() { return this.toGo >= this.field.toGoal(this.los, this.offDir) - 0.01; }

  clearField() {
    for (const e of this.active) e.onField = false;
    this.active = []; this.offense = []; this.defense = [];
    this.engagements = [];
    this.ball.place(this.ballX, this.los, 'dead');
  }

  // ------------------------------------------------------------ calling plays
  /** Which play lists apply right now: { off: 'offense'|'kickoff'|'pat', def: … } */
  callNeeds() { return RULES.callNeeds(this); }

  /** Line up a scrimmage play (or a punt / field goal / fake from the special list). */
  callPlays(offId, defId, { flip = false, noRunoff = false } = {}) {
    const play = OFFENSE_BY_ID[offId] || SPECIAL_BY_ID[offId] || OFFENSE_BY_ID.sp_slants;
    // the huddle and the line-up take time off a running clock
    if (!noRunoff && this.phase === 'playcall') {
      RULES.runoff(this);
      if (this.clock <= 0 && !this.ot && !this.tryMode) { RULES.endOfTime(this); return this; }
    }
    let dplay = DEFENSE_BY_ID[defId] || SPECIAL_BY_ID[defId] || DEFENSE_BY_ID.c3;
    this.play = play;
    this.dplay = dplay;
    this.flip = !!flip;
    this.playKind = play.kind === 'fake' ? (play.fake === 'pass' ? 'pass' : 'run') : play.kind;
    this.form = FORMATIONS[play.form] || FORMATIONS.gun_spread;
    this.clearField();
    const { ents } = setup.placeOffense(this, play, this.flip);
    this.offense = ents;
    this.defense = setup.placeDefense(this, dplay.jobs ? dplay : DEFENSE_BY_ID.c1);
    this.active = [...this.offense, ...this.defense];
    for (const e of this.active) e.onField = true;
    this.qb = this.byRole('QB');
    if (this.form.qb === 'direct') this.qb = this.byRole('RB');
    if (this.form.qb === 'punt') this.qb = this.byRole('P');
    if (this.form.qb === 'hold') this.qb = this.byRole('H');
    this.passReads = play.reads || [];
    setup.assignOffense(this, play, this.flip);
    if (dplay.jobs) setup.assignDefense(this, dplay); else K.assignSpecialDefense(this, dplay);
    if (play.kind === 'punt' || play.kind === 'fg' || (play.kind === 'fake')) K.assignSpecialOffense(this, play);
    this.runHole = null;
    this.prePlay();
    return this;
  }

  /** Common pre-snap state for any play. */
  prePlay() {
    this.phase = 'presnap';
    this.presnapT = 0;
    this.playT = 0;
    this.passThrown = false;
    this.forwardPassed = false;
    this.passCompleted = false;
    this.handedOff = false;
    this.flags = [];
    this.result = null;
    this.playStats = [];
    this.scriptState = {};
    this.hardCounted = 0;
    this.timers = [];
    this.segments = [];
    this.passInfo = null;
    this.mesh = null;
    this.optRead = null; this.optPitchRead = null; this.optDecided = false; this.optionKeep = undefined; this.optionDone = false;
    this.kickoff = this.kickoff && this.playKind === 'kickoff' ? this.kickoff : null;
    const center = this.byRole('C') || this.offense[0];
    this.center = center;
    this.ball.place(this.ballX, this.los, 'snap');
    this.ball.lastTeam = this.offSide;
    this.snapArmed = false;
    // the CPU offense snaps after a beat
    this.snapAt = this.userSnaps() ? Infinity : this.hurry[this.offSide] ? 1.0 + this.rng() * 0.6 : 1.8 + this.rng() * 1.6;
    // designed motion: he goes in motion on his own; the CPU snaps when he's crossing the ball
    this.motionMan = null;
    const mo = this.play?.motion;
    if (mo) {
      const e = this.byRole(mo.role);
      if (e) {
        const across = this.ballX + (this.ballX - e.x) * 0.9;
        // a jet man crosses just in front of a shotgun QB (behind one under center)
        const qbDepth = this.qb ? (this.los - this.qb.z) * this.offDir : 1;
        const depth = mo.jet ? (qbDepth > 2.5 ? qbDepth - 1.15 : 1.6) : 1.2;
        // (a person's jet sweep: the jet man takes off when the snap is called, and the ball is snapped to meet him)
        e.mem.motion = { x: across, speed: mo.jet ? 0.9 : 0.5, startAt: mo.jet && this.userSnaps() ? Infinity : 0.6, jet: !!mo.jet, depth };
        this.motionMan = e;
        if (!this.userSnaps()) this.snapAt = Infinity;
      }
    }
    this.pickUserEnts();
    this.assignIcons();
    this.emit('lineup', { play: this.play, dplay: this.dplay });
  }

  isUser(side) { return this.users[side] !== null && this.users[side] !== undefined; }
  /**
   * Does a person snap the ball? In a career only the quarterback does, and only on a down
   * from scrimmage: on a kick the snap goes back to the holder or the punter (a career QB
   * holds for PATs and field goals) and the CPU snaps it, since a person kicks only with
   * the kick meter, which a career never shows.
   */
  userSnaps() {
    if (!this.isUser(this.offSide)) return false;
    if (this.lock && this.lock.side === this.offSide) {
      if (this.isKickPlay()) return false;
      return this.lock.player.pos === 'QB' && this.qb?.p?.id === this.lock.player.id;
    }
    return true;
  }

  /** A kick: kickoff, field goal or PAT kick (the holder takes the snap), punt. */
  isKickPlay() {
    return this.playKind === 'kickoff' || this.playKind === 'fg' || this.playKind === 'punt' || this.form?.qb === 'hold' || this.form?.qb === 'punt';
  }

  pickUserEnts() {
    for (const side of ['home', 'away']) {
      if (!this.isUser(side)) { this.userEnt[side] = null; continue; }
      let e = null;
      if (this.lock && this.lock.side === side) e = this.active.find((a) => a.p.id === this.lock.player.id) || null;
      else if (side === this.offSide) e = this.special === 'kickoff' ? this.byRole('K') : this.qb;
      else {
        const list = side === this.offSide ? this.offense : this.defense;
        const pref = this.special === 'kickoff' ? 'KR' : (this.userPref?.[side] || 'S');
        e = list.find((a) => a.role === pref) || list.find((a) => a.role === 'LB1') || list[0];
      }
      this.setUserEnt(side, e);
    }
  }

  setUserEnt(side, e) {
    const prev = this.userEnt[side];
    if (prev && prev !== e) prev.ctrl = null;
    this.userEnt[side] = e;
    if (e) e.ctrl = this.users[side];
  }

  /** Face-button icons over the receivers: ✕ the back, □ left, ○ right, △ the middle. */
  assignIcons() {
    for (const side of ['home', 'away']) this.icons[side] = {};
    const side = this.offSide;
    const elig = this.offense.filter((e) => !['C', 'LG', 'RG'].includes(e.role) && e !== this.qb && e.asg?.type !== 'special' && !(e.asg?.type === 'block' && e.asg.block !== 'pass' && !e.mem.route));
    this.setIcons(side, elig);
  }

  setIcons(side, list) {
    const dir = this.dirOf(side);
    const px = (e) => (this.ballX - e.x) * dir;
    const map = {};
    const pool = list.filter(Boolean).slice(0, 4);
    const backs = pool.filter((e) => Math.abs(px(e)) < 3 && (e.z - this.los) * dir < -1.5);
    const wide = pool.filter((e) => !backs.includes(e)).sort((a, b) => px(a) - px(b));
    if (backs[0]) map.cross = backs[0];
    const rest = [...wide, ...backs.slice(1)];
    if (rest.length) map.square = rest[0];
    if (rest.length > 1) map.circle = rest[rest.length - 1];
    if (rest.length > 2) map.triangle = rest[1];
    if (!map.cross && rest.length > 3) map.cross = rest[2];
    if (!map.cross && !backs.length && rest.length === 3) { /* three wide: □ △ ○ */ }
    this.icons[side] = map;
  }

  // ------------------------------------------------------------ kickoffs / PAT
  callKickoff(kickId = 'ko_deep', retId = 'kr_middle') {
    this.play = SPECIAL_BY_ID[kickId] || SPECIAL_BY_ID.ko_deep;
    this.dplay = SPECIAL_BY_ID[retId] || SPECIAL_BY_ID.kr_middle;
    this.playKind = 'kickoff';
    this.flip = false;
    this.form = { qb: 'kick' };
    this.clearField();
    const { kick, ret } = setup.placeKickoff(this, this.offSide, this.defSide);
    this.offense = kick; this.defense = ret;
    this.active = [...kick, ...ret];
    for (const e of this.active) e.onField = true;
    this.qb = null;
    K.assignKickoff(this);
    this.prePlay();
    this.ball.place(this.ballX, this.los, 'dead');
    this.ball.y = 0.35; // on the tee
    this.snapAt = this.isUser(this.offSide) && !this.lock ? Infinity : 1.2;
    return this;
  }

  choosePat(choice) { RULES.choosePat(this, choice); }

  // ------------------------------------------------------------ pre-snap tools
  hardCount() { RULES.hardCount(this); }
  audible(playId) {
    const keepDef = this.dplay?.id;
    this.callPlays(playId, keepDef, { flip: this.flip, noRunoff: true });
  }
  flipPlay() { if (this.phase === 'presnap' && this.playKind !== 'kickoff') this.callPlays(this.play.id, this.dplay.id, { flip: !this.flip, noRunoff: true }); }
  hotRoute(e, routeId) { if (this.phase === 'presnap') { setup.hotRoute(this, e, routeId); this.emit('hotRoute', { e, routeId }); } }
  motion(e) {
    if (this.phase !== 'presnap' || e.mem.motion) return;
    // across the formation, behind the line
    e.mem.motion = { x: this.ballX + (this.ballX - e.x) * 0.6, started: this.presnapT };
    this.emit('motion', { e });
  }
  defAudible(defId) {
    if (this.phase !== 'presnap') return;
    const d = DEFENSE_BY_ID[defId];
    if (!d) return;
    this.dplay = d;
    const keepCtrl = this.userEnt[this.defSide]?.role;
    this.defense = setup.placeDefense(this, d);
    this.active = [...this.offense, ...this.defense];
    for (const e of this.active) e.onField = true;
    setup.assignDefense(this, d);
    if (keepCtrl) this.setUserEnt(this.defSide, this.byRole(keepCtrl, this.defSide));
    this.emit('defAudible', { dplay: d });
  }
  /** ◯ before / during the play: the defender nearest the ball. */
  switchDefender(side, opts = {}) {
    if (this.lock && this.lock.side === side) return;
    const list = side === this.offSide ? this.offense : this.defense;
    const cur = this.userEnt[side];
    const b = this.ball.carrier || this.ball;
    const target = this.ball.state === 'air' && this.ball.targetPt ? this.ball.targetPt : b;
    let cands = list.filter((e) => e.standing && e !== cur);
    if (!cands.length) return;
    if (opts.cycle) {
      // pre-snap: walk through them from left to right
      cands = list.filter((e) => e.standing).sort((a, b2) => a.x - b2.x);
      const i = cands.indexOf(cur);
      this.setUserEnt(side, cands[(i + 1) % cands.length]);
    } else {
      cands.sort((a, b2) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b2.x - target.x, b2.z - target.z));
      this.setUserEnt(side, cands[0]);
    }
    this.userPref = this.userPref || {};
    this.userPref[side] = this.userEnt[side]?.role;
    this.emit('switch', { side, e: this.userEnt[side] });
  }

  // ------------------------------------------------------------ the snap
  snap(force = false) {
    if (this.phase !== 'presnap') return;
    // a person calling for the snap on a jet sweep: send the jet man, snap it when he gets there
    const mo = this.motionMan?.mem.motion;
    if (!force && mo?.jet && this.userSnaps()) {
      if (!this.snapArmed) { this.snapArmed = true; mo.startAt = Math.min(mo.startAt, this.presnapT); }
      return;
    }
    RULES.checkOffsides(this);
    this.phase = 'live';
    this.playT = 0;
    this.playNo++;
    this.drive && this.drive.plays++;
    for (const e of this.active) {
      e.state = 'active';
      e.hist.length = 0;
      if (e.mem.motion) e.mem.motion = null;   // (keeps his running start)
      if (e.base === 'stance3' || e.base === 'stance2' || e.base === 'ready' || e.base === 'center') e.base = 'stand';
    }
    if (this.playKind === 'kickoff') { K.kickoffSnap(this); }
    else K.snapBall(this);
    if (!this.clockRunning && this.playKind !== 'kickoff') this.clockRunning = true;
    this.emit('snap', { play: this.play, dplay: this.dplay });
  }

  // ------------------------------------------------------------ the loop
  step(dt) {
    this.time += dt;
    switch (this.phase) {
      case 'presnap': this.presnapStep(dt); break;
      case 'live': this.liveStep(dt); break;
      case 'post': this.postStep(dt); break;
      case 'kickoff': case 'playcall': case 'pat':
        if (this.autoCalls) RULES.autoCall(this);
        break;
      default: break;
    }
  }

  presnapStep(dt) {
    this.presnapT += dt;
    for (const e of this.active) {
      // motion man
      if (e.mem.motion) {
        const mo = e.mem.motion;
        if (this.presnapT < (mo.startAt ?? 0)) { e.vx = e.vz = 0; continue; }
        e.state = 'active';
        e.goTo(mo.x, this.los - this.offDir * (mo.depth ?? 1.2), mo.speed ?? 0.55, null, 0.3);
        e.move(dt);
        // a jet man is snapped to so the ball and he reach the QB together
        const lead = this.form.qb === 'under' ? 1.0 : 0.6 + Math.hypot(e.vx, e.vz) * 0.3;
        if (mo.jet && this.motionMan === e && (!this.userSnaps() || this.snapArmed) && Math.abs(e.x - this.ballX) < lead) { this.snap(true); return; }
        if (Math.abs(e.x - mo.x) < 0.4) { e.mem.motion = null; e.state = 'set'; e.base = 'stance2'; if (this.motionMan === e && !this.userSnaps()) this.snapAt = this.presnapT + 0.2; }
        continue;
      }
      // a person moving his defender before the snap
      if (e.ctrl !== null && e.side === this.defSide && this.cmd[e.side]) {
        userControl(this, e, this.cmd[e.side], dt, true);
        e.state = 'active';
        e.move(dt);
        e.state = 'set';
        continue;
      }
      e.vx = e.vz = 0;
    }
    if (this.cmd[this.offSide] && this.userEnt[this.offSide]) userControl(this, this.userEnt[this.offSide], this.cmd[this.offSide], dt, true);
    if (this.presnapT >= this.snapAt) this.snap();
  }

  liveStep(dt) {
    this.playT += dt;
    const b = this.ball;
    runScripts(this, dt);
    // brains
    for (const e of this.active) this.think(e, dt);
    C.updateEngagements(this, dt);
    // bodies
    for (const e of this.active) {
      if (e.state === 'engaged' || e.state === 'wrapping') continue;
      e.move(dt);
      // airborne (hurdles, leaps)
      if (e.y > 0 || e.vy > 0) {
        e.vy -= 10.73 * dt;
        e.y += e.vy * dt;
        if (e.y <= 0) { e.y = 0; e.vy = 0; }
      }
    }
    C.updateWraps(this, dt);
    C.resolveCollisions(this);
    // keep everybody on the field's surroundings (players can run out of bounds)
    for (const e of this.active) {
      e.x = clamp(e.x, -this.field.halfW - 6, this.field.halfW + 6);
      e.z = clamp(e.z, -this.field.end - 4, this.field.end + 4);
    }
    // the ball
    if (b.state === 'held' && b.carrier) {
      const c = b.carrier;
      const h = c.heading;
      const side = c.carry === 'L' ? 1 : c.carry === 'R' ? -1 : 0;
      b.x = c.x + Math.sin(h) * 0.18 + Math.cos(h) * side * 0.22;
      b.z = c.z + Math.cos(h) * 0.18 - Math.sin(h) * side * 0.22;
      b.y = c.onGround ? 0.25 : 1.05 + c.y;
    } else {
      const ev = b.step(dt, this.rng);
      if (ev === 'ground') RULES.ballGrounded(this);
      if (this.phase !== 'live') return;
      C.checkCatches(this, dt);
      C.checkLoose(this);
      RULES.looseBallChecks(this, dt);
    }
    if (this.phase !== 'live') return;
    // tackles: user-controlled and AI defenders touching the carrier
    RULES.contactTackles(this, dt);
    // actions advance (falls end in a whistle)
    for (const e of this.active) {
      const done = e.tickAction(dt);
      if (done && e.base.startsWith('lie') && e.state !== 'down') { e.state = 'down'; e.downT = 0; }
      if (e.state === 'down') e.downT += dt;
      e.tire(dt, this.settings.fatigue);
      e.record(dt);
    }
    RULES.fieldChecks(this, dt);
    if (this.phase === 'live' && this.clockRunning) RULES.tickClock(this, dt);
  }

  /** One player's decision for this tick. */
  think(e, dt) {
    const b = this.ball;
    if (e.state === 'falling' || e.state === 'down' || e.state === 'dead') return;
    if (e.onGround) {
      if (e.recover <= 0 && !e.action) { e.act(e.base === 'lie_back' ? 'getup_back' : 'getup_front'); e.recover = 1.2; }
      return;
    }
    // a person's man (unless he's left the stick alone in a career, when his job runs itself —
    // and the kicker, holder and punter go through their steps on their own until the kick is away)
    if (e.ctrl !== null && this.cmd[e.side] && this.userEnt[e.side] === e && !this.kickingUnit(e)) {
      if (userControl(this, e, this.cmd[e.side], dt, false) !== 'ai') return;
    }
    if (e.state === 'wrapping') return;
    if (e.recover > 0 && e.state !== 'engaged') { e.setWant(e.vx, e.vz, 0.2); return; }
    const c = b.carrier;
    // special teams have their own brains until the ball is caught
    if (this.playKind === 'kickoff' || this.playKind === 'punt' || this.playKind === 'fg') {
      if (K.specialBrain(this, e, dt)) return;
    }
    if (e === this.qb && e.side === this.offSide && (this.playKind === 'run' || this.playKind === 'qbrun' || (this.playKind === 'trick' && this.play.run)) && qbRunFeet(this, e, dt)) return;
    if (c === e) {
      if (e === this.qb && e.side === this.offSide && !this.handedOff && (this.playKind === 'pass' || this.playKind === 'screen' || this.playKind === 'trick') && e.mem.phase !== 'scramble' && (this.los - e.z) * this.offDir > -0.3 && e.asg?.type === 'qb') return O.qbBrain(this, e, dt);
      if (e.asg?.type === 'qb' && e.side === this.offSide && e.mem.passer && (this.los - e.z) * this.offDir > -0.3) return O.qbBrain(this, e, dt);
      if (this.optionLive(e)) return optionBrain(this, e, dt);
      if (this.playKind === 'trick' && scriptCarrier(this, e, dt)) return;
      return O.carrierBrain(this, e, dt);
    }
    // the ball changed hands: everybody's job changes
    const holder = c ? c.side : (b.state === 'loose' || (b.state === 'air' && b.kind === 'fumble')) ? null : b.lastTeam;
    if (holder && holder !== this.offSide) {
      // turnover / a return: the offense chases, the defense blocks
      if (e.side === holder) return this.blockForReturner(e, dt);
      return D.pursue(this, e, dt);
    }
    if (holder === null) return D.pursue(this, e, dt);   // loose ball: everybody goes
    if (e.side === this.offSide) {
      const a = e.asg?.type;
      // a pitch / lateral coming to me (the QB on a flea flicker too): go get it
      if (b.state === 'air' && b.target === e && b.kind === 'lateral') return O.trackBall(this, e, dt);
      if (a === 'qb') return O.qbBrain(this, e, dt);
      if (a === 'route') return O.routeBrain(this, e, dt);
      if (a === 'block') return O.blockBrain(this, e, dt);
      if (a === 'carrierDesignate') return runnerBrain(this, e, dt);
      if (a === 'support') return O.supportBrain(this, e, dt);
      e.setWant(0, 0, 0);
      return;
    }
    const a = e.asg?.type;
    if (a === 'rush') return D.rushBrain(this, e, dt);
    if (a === 'man') return D.manBrain(this, e, dt);
    if (a === 'zone') return D.zoneBrain(this, e, dt);
    if (a === 'spy') return D.spyBrain(this, e, dt);
    return D.pursue(this, e, dt);
  }

  /** After a handoff the person takes the ball carrier — unless he still has a trick to run (flea flicker, reverse). */
  userTakes(e) {
    const side = e.side;
    if (!this.isUser(side) || (this.lock && this.lock.side === side) || this.userEnt[side] === e) return;
    if (this.carrierScripted(e)) return;
    this.setUserEnt(side, e);
  }

  /** Before the kick, the kicking team's man runs himself (the kick meter is the person's part). */
  kickingUnit(e) {
    if (e.side !== this.offSide) return false;
    if (this.playKind === 'kickoff') return !this.kickoff?.kicked;
    if (this.playKind === 'punt') return !this.punt?.kicked;
    if (this.playKind === 'fg') return !this.fg?.kicked;
    return false;
  }

  blockForReturner(e, dt) {
    const c = this.ball.carrier;
    if (!c) return D.pursue(this, e, dt);
    if (this.supportFor(c) === e) return O.supportBrain(this, e, dt);
    // a returner's blockers: the nearest chaser between them and the ball
    let best = null, bd = 1e9;
    for (const o of this.foesOf(e)) {
      if (!o.standing || o.engaged) continue;
      const d = Math.hypot(o.x - c.x, o.z - c.z) + Math.hypot(o.x - e.x, o.z - e.z) * 0.6;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) { e.goTo(c.x + (e.x > c.x ? 3 : -3), c.z + this.dirOf(e.side) * 3, 0.8); return; }
    const n = norm(c.x - best.x, c.z - best.z);
    e.goTo(best.x + n.x * 0.8, best.z + n.z * 0.8, 1, null, 0.1);
    e.mem.wantBlock = best;
    e.mem.pushDir = norm(best.x - c.x, best.z - c.z);
  }

  postStep(dt) {
    this.postT += dt;
    const b = this.ball;
    for (const e of this.active) {
      e.tickAction(dt);
      if (e.state === 'engaged') { e.state = 'active'; e.engaged = null; }
      if (e.state === 'wrapping') { e.state = 'active'; e.wrapping = null; }
      // everybody pulls up; men on the ground get up after a moment
      if (e.onGround && !e.action && this.postT > 0.8 + (e.id.length % 5) * 0.12) e.act(e.base === 'lie_back' ? 'getup_back' : 'getup_front');
      if (e.state === 'falling' && !e.action) e.state = 'down';
      if (!e.onGround && !e.action && e.state !== 'falling') e.state = 'dead';
      e.setWant(0, 0, 0);
      if (e.state === 'dead') {
        // drift a step, then stand around
        const k = Math.exp(-dt * 3);
        e.vx *= k; e.vz *= k;
        e.x += e.vx * dt; e.z += e.vz * dt;
      } else e.move(dt);
      e.tire(dt, this.settings.fatigue);
      if (e.stamina < 1) e.stamina = Math.min(1, e.stamina + dt * 0.01);
    }
    if (b.state === 'held' && b.carrier) { b.x = b.carrier.x; b.z = b.carrier.z; b.y = b.carrier.onGround ? 0.25 : 1.0; }
    else if (b.state === 'air' || b.state === 'loose') b.step(dt, this.rng);
    if (this.postT >= this.postDur) this.advance();
  }

  /** Run fn `t` seconds into the live play. */
  after(t, fn) { (this.timers ||= []).push({ at: this.playT + t, fn }); }
  seg(e, kind) { RULES.segment(this, e, kind); }

  // ------------------------------------------------------------ whistles + results
  whistle(type, data = {}) { RULES.whistle(this, type, data); }
  advance() { RULES.advance(this); }
  onContact(a, b, impact) { RULES.onContact(this, a, b, impact); }
  onCatch(e, info) { RULES.onCatch(this, e, info); }
  onRecover(e, dove) { RULES.onRecover(this, e, dove); }

  // ------------------------------------------------------------ actions the brains + people use
  throwTo(qb, rec, opts = {}) { RULES.throwTo(this, qb, rec, opts); }
  throwAway(qb) { RULES.throwAway(this, qb); }
  lateralFrom(e, to = null) { return RULES.lateralFrom(this, e, to); }
  doMove(e, move, side = null) { RULES.doMove(this, e, move, side); }
  diveTackle(d, c) { RULES.diveTackle(this, d, c); }
  callTimeout(side) { return RULES.callTimeout(this, side); }

  // ------------------------------------------------------------ questions the brains ask
  isRunning() {
    const c = this.ball.carrier;
    if (!c) return false;
    if (c.side !== this.offSide) return true;
    // a trick-play carrier who's still going to throw / pitch it: the routes stay live
    if (this.playKind === 'trick' && this.carrierScripted(c)) return false;
    if (c !== this.qb) return true;
    return this.handedOff || this.playKind === 'qbrun' || (c.mem.phase === 'scramble' && (c.z - this.los) * this.offDir > 0) || (c.z - this.los) * this.offDir > 0.5;
  }
  ballThrown() { const b = this.ball; return b.state === 'air' && (b.kind === 'pass' || b.kind === 'tip') && b.lastTeam === this.offSide; }
  runCarrier() { return this.offense.find((e) => e.asg?.type === 'carrierDesignate') || null; }
  holePoint() { return this.runHole || { x: this.ballX, z: this.los }; }
  optionLive(e) { return (this.playKind === 'option') && e.side === this.offSide && !this.optionDone && (this.los - e.z) * this.offDir > -1 && (e === this.qb); }
  /** Does this trick-play carrier still have a scripted throw / pitch / handoff to make (behind the line)? */
  carrierScripted(c) {
    const steps = this.play?.script;
    if (!steps || (c.z - this.los) * this.offDir > 0.5) return false;
    const done = this.scriptState.done;
    return steps.some((st, i) => !done?.has(i) && st.from === c.role && ['handoff', 'pitch', 'lateral', 'pass', 'throwFrom'].includes(st.do));
  }

  /** A trick-play QB with a scripted handoff / pitch / pump still to come doesn't throw first. */
  scriptHold(e) {
    const steps = this.play?.script;
    if (!steps || this.playKind !== 'trick') return false;
    const done = this.scriptState.done;
    return steps.some((st, i) => !done?.has(i) && st.from === e.role && st.at !== undefined && ['handoff', 'pitch', 'lateral', 'pass', 'pump'].includes(st.do));
  }
  lateAndTrailing(side = this.offSide) {
    const diff = this.score[side] - this.score[other(side)];
    return this.quarter >= 4 && this.clock < 150 && diff < 0;
  }

  /** Did the defender read run yet? */
  runRead(e) {
    // (an option shows run as soon as the QB rides the mesh or heads for the edge)
    if (!this.isRunning() && !(this.handedOff && this.playT > 0.2) && !(this.playKind === 'option' && this.playT > 0.35 && !this.forwardPassed)) return false;
    if (e.mem.runReadAt === undefined) e.mem.runReadAt = this.time + D.reaction(e, 'run');
    return this.time >= e.mem.runReadAt;
  }

  pressureOn(qb) {
    let p = 0;
    for (const d of this.foesOf(qb)) {
      if (!d.standing || d.state === 'engaged') continue;
      const dd = dist(d, qb);
      if (dd < 3.2) p = Math.max(p, 1 - (dd - 0.8) / 2.4);
    }
    return clamp(p, 0, 1);
  }

  nearestThreat(e) {
    let best = null, bd = 1e9;
    for (const d of this.foesOf(e)) {
      if (!d.standing || d.state === 'engaged' || d.recover > 0.2) continue;
      const dd = dist(d, e);
      if (dd < bd) { bd = dd; best = d; }
    }
    if (!best) return null;
    const n = norm(e.x - best.x, e.z - best.z);
    const closing = (best.vx - e.vx) * n.x + (best.vz - e.vz) * n.z;
    return { e: best, d: bd, closing };
  }

  /** Is there a running lane in front of him? open 0..1 */
  runLane(e) {
    const dir = this.dirFor(e);
    let open = 1;
    for (const d of this.foesOf(e)) {
      if (!d.standing) continue;
      const dz = (d.z - e.z) * dir, dx = Math.abs(d.x - e.x);
      if (dz > -0.5 && dz < 6 && dx < 3 + dz * 0.4) open = Math.min(open, (Math.hypot(dx, dz) - 1) / 5);
    }
    return { open: clamp(open, 0, 1) };
  }

  /** Who trails this carrier for a pitch (one man), if anyone. */
  supportFor(c) {
    if (!c) return null;
    if (this._support && this._support.c === c && this._support.t > this.time - 0.5) return this._support.e;
    const mates = this.matesOf(c).filter((e) => e !== c && e.standing && e.state !== 'engaged' && !['C', 'LG', 'RG', 'K', 'P', 'H'].includes(e.role));
    // designated trailers first
    let pickE = mates.find((e) => e.mem.support);
    if (!pickE) {
      const wants = this.wantsSupport(c);
      if (wants) {
        const dir = this.dirFor(c);
        mates.sort((a, b) => Math.hypot(a.x - c.x, (a.z - c.z) + dir * 4) - Math.hypot(b.x - c.x, (b.z - c.z) + dir * 4));
        pickE = mates[0] || null;
      }
    }
    this._support = { c, e: pickE, t: this.time };
    return pickE;
  }

  /** Trail the runner for a lateral when a person has the ball, on returns, or when it's desperate. */
  wantsSupport(c) {
    if (c.ctrl !== null) return true;
    if (this.playKind === 'kickoff' || this.playKind === 'punt') return true;
    if (this.lateAndTrailing(c.side) && this.clock < 20) return true;
    return this.play?.tags?.includes('lateral');
  }

  /** CPU: is now the time to pitch it? */
  wantsLateral(c) {
    if (c.ctrl !== null || c.mem.noLateral) return false;
    const s = this.supportFor(c);
    if (!s || !s.standing) return false;
    const dir = this.dirFor(c);
    if ((s.z - c.z) * dir > -0.5) return false;          // must be behind (or level)
    const d = dist(s, c);
    if (d < 2.5 || d > 12) return false;
    // is he open?
    let open = 9;
    for (const o of this.foesOf(c)) if (o.standing) open = Math.min(open, dist(o, s));
    if (open < 2.6) return false;
    const th = this.nearestThreat(c);
    const about = c.state === 'wrapped' || (th && th.d < 1.6 && th.closing > 1);
    if (!about) return false;
    const desperate = this.lateAndTrailing(c.side) && this.clock < 12;
    // (an option's pitch is the QB's business; the dive back doesn't go looking for laterals)
    const designed = this.scriptState.lateralOk || (this.play?.tags?.includes('lateral') && this.playKind !== 'option');
    const p = desperate ? 0.9 : designed ? 0.55 : this.playKind === 'kickoff' ? 0.12 : 0.04;
    if (this.rng() > p) { c.mem.noLateral = true; return false; }
    return true;
  }

  wantOutOfBounds(e) {
    if (e.side !== this.offSide && this.ball.carrier === e) return false;
    const late = (this.quarter === 2 || this.quarter >= 4) && this.clock < 60;
    const diff = this.score[e.side] - this.score[other(e.side)];
    return late && diff <= 0 && (e.z - this.los) * this.dirFor(e) > 3;
  }
}
