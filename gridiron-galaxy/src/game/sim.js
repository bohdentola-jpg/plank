// The 5v5 football simulation (v2). Pure game logic, no rendering. Units are yards and seconds.
// Field: x across [-W/2, W/2], z along [0, L]; goal lines at EZ and L-EZ. `dir` is the way the offense attacks (+1 or -1 along z).
// The ball is a real projectile (gravity, drag, wind, spin). Catches happen at the hands; tipped balls stay live; contact decides tackles.
import { FIELD } from '../field.js';
import { resolvePlay, DEF_PLAYS, zoneLandmark, BASE_PLAYS, counterCall } from '../data/plays.js';
import { OFFENSE_ROLES, DEFENSE_ROLES, DIFFICULTY } from '../data/roster.js';
import { getSpecies } from '../data/species.js';
import { clamp } from '../util.js';

const R = (a, b) => a + Math.random() * (b - a);
const rating = (e, k) => (e.p.r[k] || 50) / 99;
const BALL_R = 0.16, CATCH_LO = 0.2, CATCH_HI = 2.3;
const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
const angleDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const STOP = { dx: 0, dz: 0, speed: 0 };
const DEFAULT_RULES = () => ({ gravity: 1, ballGravity: 1, jump: 1, traction: 1, drag: 1, bounce: 1, wind: { x: 0, z: 0 }, gusts: null, visibility: 1, staminaDrain: 1, hazards: [], text: [] });

export class Sim {
  constructor(opts) {
    this.home = opts.home; this.away = opts.away; this.userSide = opts.userSide || 'home';
    this.auto = !!opts.auto; this.settings = opts.settings; this.diff = DIFFICULTY[opts.settings.difficulty] || DIFFICULTY.normal;
    this.rules = opts.rules || DEFAULT_RULES(); this.mode = opts.mode || 'game';
    this.F = FIELD; this.W2 = FIELD.W / 2; this.GLA = FIELD.EZ; this.GLB = FIELD.L - FIELD.EZ;
    this.g = 10.7 * this.rules.gravity; this.ballG = 10.7 * this.rules.ballGravity;
    this.userPlays = opts.userPlays || BASE_PLAYS; this.cpuPlays = opts.cpuPlays || BASE_PLAYS;
    this.emit = opts.onEvent || (() => {}); this.hooks = opts.hooks || {};
    this.time = 0; this.timeScale = 1; this.slowmo = 0; this.bonusCoins = 0;
    this.wind = { x: this.rules.wind.x, z: this.rules.wind.z }; this.gust = { t: 0, until: 0, next: this.rules.gusts ? R(this.rules.gusts.min, this.rules.gusts.max) : 0 }; this.gustStrength = 0;
    this.groove = 0; this.grooveNext = 18; this.lastDefIds = [];
    this.roster = { home: this._makeEnts(this.home, 'home'), away: this._makeEnts(this.away, 'away') };
    this.reset(opts.start || {});
  }
  _makeEnts(team, side) {
    const sp = getSpecies(team.species); const scale = sp.scale || 1;
    return team.players.map(p => ({ p, team: side, role: p.role, id: p.id, x: 0, z: 0, vx: 0, vz: 0, facing: 0, faceTarget: null, speed: 0, state: 'idle', stamina: 1, timer: 0, active: false, isUser: false, hasBall: false, anim: 'idle', animOpts: null, eff: {}, engaged: null, cooldown: 0, react: 0, target: null, getup: 0, scale, r: 0.42 * scale, mass: (0.7 + (p.r.str / 99) * 0.6) * scale, jumpY: 0, jumpV: 0, look: null, reach: null, backpedal: false, canBackpedal: false, catching: 0, catchType: null, catchCooldown: 0, wrapOn: null, dragger: null }));
  }
  reset(start = {}) {
    const q = this.settings.quarterLen * 60;
    this.score = { home: 0, away: 0 }; this.quarter = start.quarter || 1; this.clock = start.clock !== undefined ? start.clock : q; this.quarterLen = q;
    this.dirHome = 1; this.possession = start.possession || 'home'; this.openingReceiver = this.possession;
    this.overtime = false; this.final = false; this.pat = null; this.playNumber = 0;
    this.stats = { home: this._stats(), away: this._stats() };
    this.newSeries(start.los !== undefined ? start.los : this.ownYard(this.possession, 10));
    this.phase = 'playcall'; this.deadTimer = 0; this.result = null; this.lastResult = null;
    this.ball = { x: 0, y: 1, z: this.los, vx: 0, vy: 0, vz: 0, state: 'held', carrier: null, forward: false, target: null, thrower: null, kick: null, spin: 'none', spinRate: 0, spinAngle: 0, wobble: 0, airT: 0, looseT: 0, lastTeam: null, pred: null, predT: 0, tipped: false, free: false, flightT: 0, landing: null };
    for (const side of ['home', 'away']) for (const e of this.roster[side]) { e.active = false; e.state = 'idle'; e.hasBall = false; e.isUser = false; }
  }
  _stats() { return { yards: 0, passYds: 0, rushYds: 0, comp: 0, att: 0, tds: 0, ints: 0, sacks: 0, fumbles: 0, laterals: 0, plays: 0, longest: 0, firstDowns: 0, fg: 0, fga: 0, tips: 0 }; }
  get dir() { return this.possession === 'home' ? this.dirHome : -this.dirHome; }
  get defense() { return this.possession === 'home' ? 'away' : 'home'; }
  dirOf(side) { return side === 'home' ? this.dirHome : -this.dirHome; }
  ownGoalZ(side) { return this.dirOf(side) > 0 ? this.GLA : this.GLB; }
  targetGoalZ(side) { return this.dirOf(side) > 0 ? this.GLB : this.GLA; }
  ownYard(side, yards) { return this.ownGoalZ(side) + this.dirOf(side) * yards; }
  yardsToGoal(z = this.los, side = this.possession) { return Math.round((this.targetGoalZ(side) - z) * this.dirOf(side)); }
  spotText(z = this.los) { const len = this.F.L - 2 * this.F.EZ; const ytg = this.yardsToGoal(z); const own = len - ytg; return Math.abs(ytg - len / 2) < 0.5 ? 'midfield' : own <= len / 2 ? `own ${own}` : `opp ${ytg}`; }
  userOnOffense() { return this.possession === this.userSide; }
  newSeries(z) { this.los = clamp(z, this.GLA + 0.5, this.GLB - 0.5); this.down = 1; const ytg = this.yardsToGoal(this.los); this.toGo = Math.min(10, ytg); this.firstDownZ = this.los + this.dir * this.toGo; }
  downText() { const ytg = this.yardsToGoal(); const g = this.toGo >= ytg - 0.01; return `${['1ST', '2ND', '3RD', '4TH'][this.down - 1]} & ${g ? 'GOAL' : Math.max(1, Math.ceil(this.toGo))}`; }
  teamOf(side) { return side === 'home' ? this.home : this.away; }
  trait(e) { return (this.teamOf(e.team).perk || {}).trait; }
  toWorld(px, pz, dir = this.dir, los = this.los) { return { x: -px * dir, z: los + pz * dir }; }
  opponents(e) { return this.roster[e.team === 'home' ? 'away' : 'home']; }
  standing(side) { return this.roster[side].filter(e => e.active && e.state !== 'down' && !(e.getup > 0)); }
  _angleTo(e, t) { return Math.atan2(t.x - e.x, t.z - e.z); }

  // ---------- play calling ----------
  forcedPlay(playbook) { if (this.pendingKick === 'pat') return playbook.find(p => p.type === 'fg') || BASE_PLAYS.find(p => p.type === 'fg'); return null; }
  cpuOffCall(playbook = this.cpuPlays) {
    const ytg = this.yardsToGoal(), d = this.down, tg = this.toGo, side = this.possession;
    const trailing = this.score[side] < this.score[this.defense]; const late = this.quarter >= 4 && this.clock < 150;
    const kicker = this.roster[side].find(e => e.role === 'QB'); const vk = 17 + rating(kicker, 'kik') * 9.5; const fgMax = (vk * vk * Math.sin(1.32) / this.ballG) * 0.8 - 7;
    const inCat = (cat) => playbook.filter(p => p.cat === cat && p.type !== 'punt' && p.type !== 'fg');
    const pick = (cat) => { const arr = inCat(cat); return arr.length ? arr[Math.floor(Math.random() * arr.length)] : playbook[0]; };
    if (this.hooks.cpuForcePlay) { const f = this.hooks.cpuForcePlay(this, playbook); if (f) return f; }
    if (d === 4) {
      if (ytg + 17 <= fgMax && (tg > 1.5 || late)) return playbook.find(p => p.type === 'fg') || pick('short');
      const len = this.F.L - 2 * this.F.EZ; if (ytg > len * 0.45 && !(late && trailing) && this.mode === 'game') return playbook.find(p => p.type === 'punt') || pick('short');
      return tg <= 2 ? pick('run') : pick('short');
    }
    const style = (this.teamOf(side).style || {}).off || 'balanced';
    const w = { run: 1, short: 1, mid: 1, deep: 0.6, trick: 0.25 };
    if (tg <= 3) { w.run += 1.6; w.short += 0.4; } if (tg > 12) { w.deep += 1; w.mid += 1; w.run *= 0.4; } if (d === 1) { w.run += 0.6; w.mid += 0.4; } if (d === 3) { w.run *= 0.5; w.short += 0.6; w.mid += 0.4; }
    if (late && trailing) { w.deep += 1.2; w.mid += 0.8; w.run *= 0.3; } if (ytg < 10) { w.run += 0.8; w.short += 0.6; w.deep *= 0.2; }
    if (this.hooks.cpuBias === 'pass') { w.run = 0; w.mid += 1; w.deep += 1; } if (this.hooks.cpuBias === 'run') { w.run += 10; }
    const mult = { run: { run: 2.4 }, short: { short: 2.4 }, mid: { mid: 2.2 }, deep: { deep: 2.6, mid: 1.2 }, trick: { trick: 4, deep: 1.2 }, balanced: {} }[style] || {};
    for (const k of Object.keys(mult)) w[k] *= mult[k];
    const tricks = playbook.filter(p => (p.cat === 'special' || p.cat === 'planet') && p.type !== 'punt' && p.type !== 'fg'); if (!tricks.length) w.trick = 0;
    let total = 0; for (const k of Object.keys(w)) total += w[k]; let r = Math.random() * total;
    for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0) { if (k === 'trick') return tricks[Math.floor(Math.random() * tricks.length)]; return pick(k); } }
    return pick('short');
  }
  cpuDefCall(offPlay) {
    const tg = this.toGo, d = this.down; const team = this.teamOf(this.defense); const style = (team.style || {}).def || 'mixed'; const trait = (team.perk || {}).trait;
    if (offPlay && (offPlay.type === 'punt' || offPlay.type === 'fg')) return DEF_PLAYS.find(p => p.id === 'blitz');
    if (offPlay && ((this.rules.mindReader && this.defense !== this.userSide) || trait === 'brain') && Math.random() < 0.45) return counterCall(offPlay);
    const w = {}; for (const p of DEF_PLAYS) w[p.id] = 1;
    if (tg <= 2) { w.man += 2; w.blitz += 2; w.cbblitz += 1; w.prevent = 0; w.cover3 *= 0.5; w.manoff *= 0.4; }
    if (tg >= 8) { w.cover3 += 1.5; w.cover2 += 1; w.manoff += 1; w.blitz *= 0.6; }
    if (d >= 3 && tg > 8) { w.prevent += 1.2; w.cover3 += 1; }
    if (d === 1) { w.zoneunder += 1; w.man += 0.5; }
    const late = this.quarter >= 4 && this.clock < 90 && this.score[this.defense] > this.score[this.possession]; if (late) { w.prevent += 3; w.cover3 += 1; w.blitz *= 0.4; }
    if (this.yardsToGoal() < 12) { w.man += 1.5; w.blitz += 1; w.prevent = 0; w.cover3 *= 0.6; }
    if (style === 'blitz' || this.rules.swarm) { w.blitz *= 3; w.cbblitz *= 3; w.firezone *= 2; }
    if (style === 'man') { w.man *= 2.5; w.manoff *= 2; w.spy *= 1.5; }
    if (style === 'zone') { w.cover3 *= 2.5; w.cover2 *= 2.5; w.zoneunder *= 2; w.firezone *= 1.5; }
    if (this.lastDefIds[0] && this.lastDefIds[0] === this.lastDefIds[1]) w[this.lastDefIds[0]] *= 0.15;
    let total = 0; for (const k of Object.keys(w)) total += w[k]; let r = Math.random() * total; let pick = DEF_PLAYS[0];
    for (const p of DEF_PLAYS) { r -= w[p.id]; if (r <= 0) { pick = p; break; } }
    this.lastDefIds = [pick.id, this.lastDefIds[0]]; return pick;
  }

  // ---------- setup ----------
  callPlay(offPlay, defPlay) {
    this.offPlay = offPlay; this.defPlay = defPlay || this.cpuDefCall(offPlay); this.playNumber++;
    const off = this.roster[this.possession], def = this.roster[this.defense];
    for (const side of ['home', 'away']) for (const e of this.roster[side]) { Object.assign(e, { active: false, isUser: false, hasBall: false, engaged: null, state: 'bench', eff: {}, timer: 0, cooldown: 0, pathIdx: 0, routeIdx: 0, anim: 'idle', animOpts: null, jumpY: 0, jumpV: 0, look: null, reach: null, backpedal: false, canBackpedal: false, catching: 0, catchType: null, catchCooldown: 0, wrapOn: null, dragger: null, dragging: false, faceTarget: null, reads: null, target: null, breaking: false, manTarget: null, zone: null, vx: 0, vz: 0, speed: 0 }); }
    const res = resolvePlay(offPlay); this.res = res; this.eligibles = [];
    for (const role of OFFENSE_ROLES) {
      const e = off.find(o => o.role === role); const r = res[role]; e.active = true;
      const w = this.toWorld(r.start[0], r.start[1]); e.x = w.x; e.z = w.z; e.facing = this.dir > 0 ? 0 : Math.PI;
      e.route = r.pts.map(([px, pz]) => this.toWorld(px, pz)); e.settle = r.settle; e.routeDelay = r.delay; e.isBlocker = r.block; e.path = r.path ? r.path.map(([px, pz]) => this.toWorld(px, pz)) : null;
      e.isSnapper = r.snap; e.isCarrierDesignate = r.isCarrier; e.px = r.start[0]; e.pz = r.start[1];
      e.state = role === 'C' ? 'snapset' : 'set'; e.anim = role === 'C' ? 'snapset' : (e.isSnapper ? 'qbset' : 'set');
      if (!e.isSnapper) this.eligibles.push(e);
    }
    this.eligibles.sort((a, b) => a.px - b.px); this.eligibles.forEach((e, i) => { e.glyph = i; });
    this.passer = off.find(e => e.isSnapper); this.qb = off.find(e => e.role === 'QB');
    if (this.noDefense) { for (const role of DEFENSE_ROLES) def.find(o => o.role === role).active = false; } else this._alignDefense(def, this.defPlay);
    this.phase = 'presnap'; this.playT = 0; this.snapT = this.userOnOffense() && !this.auto ? Infinity : R(1.4, 2.6);
    this.forwardPassUsed = false; this.passCrossed = false; this.laterals = 0; this.result = null; this.script = this._buildScript(offPlay); this.paBite = 0;
    Object.assign(this.ball, { state: 'held', carrier: null, x: 0, z: this.los, y: 0.3, kick: null, forward: false, lateral: false, tipped: false, free: false, pred: null, predT: 0, target: null, thrower: null, airT: 0, looseT: 0, vx: 0, vy: 0, vz: 0, spin: 'none', spinRate: 0, wobble: 0, fgResolved: false, bounces: 0, resting: false, landing: null, flightT: 0 });
    this.userEnt = null; this._pickUserEnt();
    this.emit('playset', { offPlay, defPlay: this.defPlay });
  }
  _alignDefense(def, defPlay) {
    const off = this.roster[this.possession]; const xs = this.F.W / 34; const dir = this.dir;
    const strong = ((off.find(o => o.role === 'RB') || {}).px || 0) > 0 ? 1 : -1;
    for (const role of DEFENSE_ROLES) {
      const e = def.find(o => o.role === role); e.active = true;
      const [asg, arg] = (defPlay.cover[role] || 'zone:hook').split(':'); e.asg = asg; e.asgArg = arg;
      e.tech = defPlay.tech || (Math.random() < 0.5 ? 'press' : 'off'); e.zoneDepthMul = R(0.9, 1.15) * (defPlay.deep ? 1.25 : 1); e.disguise = null; e.rushSide = null; e.shedSide = null;
      let px = 0, pz = 5;
      if (asg === 'rush') { px = role === 'LB' ? -strong * 2.5 : role === 'R' ? strong * 1.6 : role === 'CB2' ? 11 * xs : -11 * xs; pz = role === 'CB1' || role === 'CB2' ? 2.2 : 1.2; }
      else if (asg === 'spy') { px = 0; pz = 5; }
      else if (asg === 'man') { const t = off.find(o => o.role === arg); e.manTarget = t; const cushion = e.tech === 'press' ? 1.3 : R(4, 6.5); px = t ? t.px + Math.sign(t.px || 1) * 0.6 : 0; pz = t ? Math.max(1.2, t.pz + (t.pz < -2 ? 7 : cushion)) : 5; }
      else {
        const lm = zoneLandmark(arg, this.F.W); e.zone = lm; px = lm[0] * 0.8; pz = Math.max(2, lm[1] * 0.55);
        if (Math.random() < 0.35 && (arg.startsWith('deep') || arg.startsWith('half'))) { const t = off.find(o => o.role === (lm[0] < 0 ? 'X' : lm[0] > 0 ? 'Z' : 'RB')); if (t) { px = t.px + Math.sign(t.px || 1) * 0.6; pz = t.pz + 3.5; e.disguise = 'man'; } }
      }
      if (this.offPlay.type === 'punt' && role === 'S') { px = 0; pz = Math.min(36, Math.max(10, this.yardsToGoal() - 6)); e.asg = 'returner'; }
      if (this.offPlay.type === 'fg') { e.asg = role === 'S' ? 'spy' : 'rush'; pz = e.asg === 'rush' ? 1.2 : 8; px = role === 'R' ? 1.5 : role === 'LB' ? -1.5 : role === 'CB1' ? -4 : 4; }
      px += R(-0.6, 0.6); pz += R(-0.3, 0.3);
      const w = this.toWorld(px, pz); e.x = clamp(w.x, -this.W2 + 0.5, this.W2 - 0.5); e.z = clamp(w.z, 1, this.F.L - 1); e.facing = dir > 0 ? Math.PI : 0; e.state = 'read'; e.anim = 'set';
      e.rushDelay = defPlay.tags && defPlay.tags.includes('blitz') ? R(0.1, 0.3) : (this.offPlay.type === 'fg' || this.offPlay.type === 'punt') ? 0.5 : R(0.6, 1.1);
    }
  }
  _pickUserEnt() {
    if (this.auto) return;
    if (this.userOnOffense()) this.setUser(this.passer);
    else { const def = this.roster[this.userSide].filter(e => e.active); const pref = def.find(e => e.role === 'LB') || def.find(e => e.role === 'S') || def[0]; if (pref) this.setUser(pref); }
  }
  setUser(e) { for (const s of ['home', 'away']) for (const o of this.roster[s]) o.isUser = false; if (e) { e.isUser = true; this.userEnt = e; } else this.userEnt = null; }
  switchDefender() {
    if (this.userOnOffense()) return; const def = this.standing(this.userSide).filter(e => e !== this.userEnt); if (!def.length) return;
    const bx = this.ball.carrier ? this.ball.carrier.x : this.ball.x, bz = this.ball.carrier ? this.ball.carrier.z : this.ball.z;
    def.sort((a, b) => Math.hypot(a.x - bx, a.z - bz) - Math.hypot(b.x - bx, b.z - bz)); this.setUser(def[0]); this.emit('switch', def[0]);
  }
  _buildScript(play) {
    const t = play.trick; const s = [];
    if (play.type === 'run' && !t && play.carrier !== 'QB') s.push({ t: 0.05, fn: () => this._beginHandoff(play.carrier, play.delay || 0) });
    if (play.type === 'run' && play.carrier === 'QB' && !t) s.push({ t: 0.05, fn: () => { const qb = this._role('QB'); qb.state = 'carrier'; qb.followPath = true; } });
    if (t === 'fleaflicker') { s.push({ t: 0.05, fn: () => this._beginHandoff('RB', 0) }); s.push({ t: 1.35, fn: () => { const rb = this._role('RB'), qb = this._role('QB'); if (this.ball.carrier === rb && rb.state === 'carrier') this._lateral(rb, qb, true); } }); }
    if (t === 'hbpass' || t === 'pitch') s.push({ t: 0.05, fn: () => this._beginHandoff('RB', 0, true) });
    if (t === 'reverse') { s.push({ t: 0.05, fn: () => this._beginHandoff('RB', 0) }); s.push({ t: 0.3, fn: () => { this._role('Z').state = 'reverse'; } }); }
    if (t === 'statue') { s.push({ t: 0.35, fn: () => { const qb = this._role('QB'); qb.anim = 'throw'; qb.animOpts = { restart: true }; qb.fake = 0.45; } }); s.push({ t: 0.85, fn: () => this._beginHandoff('RB', 0) }); }
    if (t === 'jet') s.push({ t: 0.0, fn: () => { this._role('Z').state = 'jet'; } });
    if (t === 'option') s.push({ t: 0.05, fn: () => { const qb = this._role('QB'); qb.state = 'carrier'; qb.followPath = true; const rb = this._role('RB'); rb.state = 'trail'; if (!this.auto && this.userOnOffense()) this.setUser(qb); } });
    if (t === 'playaction') s.push({ t: 0.1, fn: () => { this._role('RB').state = 'fakerun'; this.paBite = 0.8; } });
    if (t === 'doublepass') s.push({ t: 0.45, fn: () => { const qb = this._role('QB'), x = this._role('X'); if (this.ball.carrier === qb) this._lateral(qb, x, true); } });
    if (t === 'hookladder') s.push({ t: 0.1, fn: () => { const rb = this._role('RB'); rb.state = 'trail'; rb.trailTarget = this._role('X'); } });
    if (play.type === 'punt') s.push({ t: 0.05, fn: () => { this.kickMode = 'punt'; this.phase = 'kickmeter'; this.meter = { t: 0, val: 0.5 }; this._giveBall(this.passer); } });
    if (play.type === 'fg') s.push({ t: 0.05, fn: () => { this.kickMode = 'fg'; this.phase = 'kickmeter'; this.meter = { t: 0, val: 0.5 }; this._giveBall(this.passer); } });
    return s;
  }
  _role(role) { return this.roster[this.possession].find(e => e.role === role); }
  _beginHandoff(role, delay, pitch = false) { const c = this._role(role); if (!c) return; c.state = 'mesh'; c.meshDelay = delay; c.meshT = 0; c.pitch = pitch; }

  // ---------- snap & live ----------
  snap() {
    if (this.phase !== 'presnap') return; this.phase = 'live'; this.playT = 0; this.clockRunning = this.mode === 'game';
    const off = this.roster[this.possession].filter(e => e.active), def = this.roster[this.defense].filter(e => e.active);
    this._giveBall(this.passer); this.passer.state = this.passer.isCarrierDesignate && this.offPlay.type === 'run' ? 'carrier' : 'qb'; this.passer.dropT = 0; this.passer.reads = null;
    if (this.passer.state === 'carrier') this.passer.followPath = true;
    for (const e of off) { if (e === this.passer) continue; if (e.isBlocker) e.state = 'block'; else if (e.route.length) { e.state = 'route'; e.routeIdx = 0; e.routeT = -e.routeDelay; } else if (e.isCarrierDesignate) e.state = 'mesh'; else e.state = 'block'; }
    for (const e of def) { e.state = 'read'; e.timer = 0; }
    this.emit('snap'); this.stats[this.possession].plays++;
    if (this.hooks.onSnap) this.hooks.onSnap(this);
  }
  _giveBall(e) { if (this.ball.carrier) this.ball.carrier.hasBall = false; const b = this.ball; b.carrier = e; b.state = 'held'; b.free = false; b.pred = null; b.target = null; b.tipped = false; e.hasBall = true; b.lastTeam = e.team; if (!this.auto && e.team === this.userSide && this.userOnOffense()) this.setUser(e); }

  // ---------- user actions ----------
  actSnap() { if (this.phase === 'presnap') this.snap(); }
  actThrow(glyphIndex, power) { const t = this.eligibles.find(e => e.glyph === glyphIndex); const passer = this.ball.carrier; if (!t || !passer || passer.team !== this.possession || this.phase !== 'live' || t === passer) return false; return this._throw(passer, t, power); }
  actLateral() { const c = this.ball.carrier; if (!c || this.phase !== 'live' || (c.state !== 'carrier' && c.state !== 'qb')) return false; const t = this.lateralTarget(c); if (!t) return false; this._lateral(c, t, false); return true; }
  lateralTarget(c) {
    const mates = this.standing(c.team).filter(e => e !== c && (e.z - c.z) * this.dirOf(c.team) < -0.3);
    if (!mates.length) return null; mates.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z)); return Math.hypot(mates[0].x - c.x, mates[0].z - c.z) < 14 ? mates[0] : null;
  }
  actJuke(dirX) { const c = this.ball.carrier; if (!c || c.state !== 'carrier' || c.eff.juke > 0 || c.eff.spin > 0 || c.eff.drag > 0) return; c.eff.juke = 0.4; c.eff.jukeDir = dirX || (Math.random() < 0.5 ? -1 : 1); c.anim = 'juke'; c.animOpts = { dir: c.eff.jukeDir, restart: true }; c.stamina = Math.max(0, c.stamina - 0.08); this.emit('juke', c); }
  actSpin() { const c = this.ball.carrier; if (!c || c.state !== 'carrier' || c.eff.spin > 0 || c.eff.juke > 0 || c.eff.drag > 0) return; c.eff.spin = 0.5; c.anim = 'spin'; c.animOpts = { restart: true }; c.stamina = Math.max(0, c.stamina - 0.1); this.emit('juke', c); }
  actDive() {
    const u = this.userEnt; if (!u || this.phase !== 'live' || u.state === 'down' || u.eff.dive > 0 || u.jumpY > 0) return;
    const b = this.ball; let dx = u.vx, dz = u.vz; const sp = Math.hypot(dx, dz);
    if (b.state === 'air' && b.pred && !u.hasBall) { dx = b.pred.catch.x - u.x; dz = b.pred.catch.z - u.z; } else if (sp < 0.5) { dx = Math.sin(u.facing); dz = Math.cos(u.facing); }
    [dx, dz] = norm(dx, dz); u.eff.dive = 0.45; u.vx = dx * 9; u.vz = dz * 9; u.anim = 'dive'; u.animOpts = { restart: true }; this.emit('dive', u);
  }
  actSwat() { const u = this.userEnt; if (!u || u.state === 'down' || u.jumpY > 0 || u.eff.dive > 0) return; this._jump(u); u.eff.jump = 0.55; }
  _jump(e) { e.jumpV = 5.2 * this.rules.jump; e.jumpY = 0.001; e.anim = 'catch_high'; e.animOpts = { restart: true }; e.catching = Math.max(e.catching, 0.6); this.emit('jump', e); }
  actKick(val) { if (this.phase !== 'kickmeter') return; this._doKick(val); }
  actPAT(choice) { if (!this.pat) return; if (choice === 'kick') { this.pat = null; this.pendingKick = 'pat'; this.newSeriesForPat(); this.emit('patchoice', 'kick'); } else { this.pat = null; this.pendingTwo = true; this.newSeriesForPat(); this.emit('patchoice', 'two'); } }
  newSeriesForPat() { this.los = this.targetGoalZ(this.possession) - this.dir * (this.pendingTwo ? 5 : 3); this.down = 1; this.toGo = this.yardsToGoal(); this.firstDownZ = this.targetGoalZ(this.possession); this.phase = 'playcall'; }

  // ---------- throws, pitches, kicks ----------
  _throw(passer, target, power = 0.5) {
    const beyond = (passer.z - this.los) * this.dir > 0.3;
    if (beyond || this.forwardPassUsed) { this.emit('noPass', beyond ? 'PAST THE LINE' : 'ALREADY THREW'); return false; }
    passer.action = { type: 'throw', t: 0, target, power, release: 0.22, point: target && target.point ? target : null }; passer.anim = 'throw'; passer.animOpts = { restart: true }; passer.state = 'throwing';
    passer.faceTarget = this._angleTo(passer, target); passer.look = { x: target.x, y: 1.4, z: target.z };
    this.emit('windup', passer); return true;
  }
  _throwAway(e) { const sideX = (e.x >= 0 ? 1 : -1) * (this.W2 + 6); this._throw(e, { x: sideX, z: e.z + this.dir * 12, point: true }, 0.8); this.emit('throwaway', e); }
  _releasePass(passer, a) {
    const point = a.point; const t = point ? null : a.target; const thp = rating(passer, 'thp'), tha = rating(passer, 'tha');
    const tx0 = point ? point.x : t.x, tz0 = point ? point.z : t.z; const dist = Math.hypot(tx0 - passer.x, tz0 - passer.z);
    const spd = 19 + thp * 15; let T = clamp(0.4 + dist / spd, 0.4, 2.4); if (a.power < 0.5) T *= 1.25 + (0.5 - a.power) * 0.6; if (this.rules.dense) T *= 1.15;
    const lead = clamp(T * 0.92, 0, 1.8); let tx = point ? tx0 : t.x + t.vx * lead, tz = point ? tz0 : t.z + t.vz * lead; if (!point) tx = clamp(tx, -this.W2 + 0.8, this.W2 - 0.8);
    const pressure = this.standing(this.defense).some(d => Math.hypot(d.x - passer.x, d.z - passer.z) < 2.6); const moving = Math.hypot(passer.vx, passer.vz) > 3;
    const err = (1.05 - tha) * dist * 0.07 * (pressure ? 1.7 : 1) * (moving ? 1.4 : 1) * (a.power > 0.75 ? 0.85 : 1.1) * (this.rules.windy ? 1.15 : 1) * (this.rules.fog ? 1.1 : 1);
    const ea = R(0, 6.283), er = Math.random() * err; tx += Math.cos(ea) * er; tz += Math.sin(ea) * er;
    const b = this.ball; Object.assign(b, { state: 'air', carrier: null, thrower: passer, target: t, forward: true, tipped: false, airT: 0, lateral: false, kick: null, free: false, bounces: 0, resting: false });
    passer.hasBall = false; b.x = passer.x + Math.sin(passer.facing) * 0.5; b.z = passer.z + Math.cos(passer.facing) * 0.5; b.y = 1.95 + passer.jumpY;
    const catchY = a.power < 0.5 ? 1.7 : 1.4; const dy = catchY - b.y;
    let vx = (tx - b.x) / T, vz = (tz - b.z) / T, vy = (dy + 0.5 * this.ballG * T * T) / T;
    const v = Math.hypot(vx, vy, vz); const kd = 0.0045 * this.rules.drag; vx *= 1 + kd * v * T * 0.55; vz *= 1 + kd * v * T * 0.55; vy *= 1 + kd * v * T * 0.3;
    b.vx = vx; b.vy = vy; b.vz = vz; b.spin = 'spiral'; b.spinRate = 18 + thp * 10; b.wobble = clamp(er / 3, 0, 1) + (a.power < 0.3 ? 0.2 : 0); b.bullet = a.power > 0.7; b.deflections = 0;
    b.pred = this._predict(b); b.predT = 0.12; b.flightT = b.pred.ground.t; b.landing = { x: b.pred.catch.x, z: b.pred.catch.z, t: b.pred.catch.t };
    this.forwardPassUsed = true; this.stats[this.possession].att++; passer.state = 'qb'; passer.threw = true; passer.reads = null; this._rollDives();
    if (t) t.state = 'track';
    if (this.rules.slowThrow) { this.slowmo = 0.45; this.emit('slowmo'); }
    this.emit('throw', { passer, target: t, T, point });
    if (!this.auto && passer.team === this.userSide) this.setUser(t && t.team === passer.team ? t : null);
  }
  _lateral(from, to, scripted) {
    const b = this.ball; const dist = Math.hypot(to.x - from.x, to.z - from.z); const T = clamp(0.25 + dist / 22, 0.25, 0.9);
    Object.assign(b, { state: 'air', carrier: null, thrower: from, target: to, forward: false, lateral: true, tipped: false, airT: 0, kick: null, free: false, bounces: 0, resting: false }); from.hasBall = false;
    b.x = from.x; b.z = from.z; b.y = 1.3 + from.jumpY; const lead = T * 0.8; const tx = to.x + to.vx * lead, tz = to.z + to.vz * lead;
    b.vx = (tx - b.x) / T; b.vz = (tz - b.z) / T; b.vy = (1.3 - b.y + 0.5 * this.ballG * T * T) / T; b.spin = 'tumble'; b.spinRate = 6; b.wobble = 0.2; b.bullet = false;
    b.pred = this._predict(b); b.predT = 0.12; b.flightT = b.pred.ground.t; b.landing = { x: b.pred.catch.x, z: b.pred.catch.z, t: b.pred.catch.t };
    from.state = from.state === 'qb' ? 'qb' : 'route'; from.anim = 'throw'; from.animOpts = { restart: true };
    to.state = 'track'; this.laterals++; this.stats[from.team].laterals++;
    this.emit('lateral', { from, to, scripted }); if (!this.auto && from.team === this.userSide) this.setUser(to);
  }
  _doKick(val) {
    const k = this.passer; const kik = rating(k, 'kik'); const acc = 1 - Math.abs(val - 0.5) * 2;
    const b = this.ball; Object.assign(b, { state: 'air', carrier: null, forward: false, lateral: false, thrower: k, target: null, airT: 0, fgResolved: false, tipped: false, bounces: 0, free: false, resting: false }); k.hasBall = false;
    b.x = k.x; b.z = k.z; b.y = 1.0; k.anim = 'kick'; k.animOpts = { restart: true }; this.phase = 'live'; this.playT = 0; const g = this.ballG;
    if (this.kickMode === 'punt') {
      const v = 17 + kik * 8 + acc * 3 + R(-1, 1), ang = 0.95 + R(-0.05, 0.05); const err = (val - 0.5) * 2 * (0.12 + (1 - kik) * 0.15) + R(-0.04, 0.04);
      b.vy = v * Math.sin(ang); const vh = v * Math.cos(ang); b.vz = vh * Math.cos(err) * this.dir; b.vx = vh * Math.sin(err) * -this.dir; b.kick = 'punt'; b.spin = 'tumble'; b.spinRate = 12;
      b.pred = this._predict(b); b.flightT = b.pred.ground.t; b.landing = { x: b.pred.ground.x, z: b.pred.ground.z, t: b.pred.ground.t };
      for (const e of this.roster[this.possession]) if (e.active) e.state = 'cover';
      for (const e of this.roster[this.defense]) if (e.active) e.state = e.asg === 'returner' ? 'returner' : 'pursue';
      const ret = this.roster[this.defense].find(e => e.asg === 'returner'); if (ret && !this.auto && ret.team === this.userSide) this.setUser(ret);
      this.emit('kick', 'punt');
    } else {
      const goalZ = this.targetGoalZ(this.possession) + this.dir * this.F.EZ;
      const v = 18 + kik * 9.5 + R(-0.6, 0.6), ang = 0.66 + R(-0.03, 0.03); const err = (val - 0.5) * 2 * (0.13 + (1 - kik) * 0.14) + R(-0.015, 0.015);
      b.vy = v * Math.sin(ang); const vh = v * Math.cos(ang); b.vz = vh * Math.cos(err) * this.dir; b.vx = vh * Math.sin(err) * -this.dir; b.kick = this.pendingKick === 'pat' ? 'pat' : 'fg'; b.goalZ = goalZ; b.spin = 'tumble'; b.spinRate = 14;
      b.pred = this._predict(b); b.flightT = b.pred.ground.t; b.landing = { x: b.pred.ground.x, z: b.pred.ground.z, t: b.pred.ground.t };
      for (const e of this.roster[this.defense]) if (e.active) e.state = 'pursue';
      this.stats[this.possession].fga += b.kick === 'fg' ? 1 : 0; this.emit('kick', 'fg');
    }
    if (!(this.roster[this.defense].find(e => e.asg === 'returner') && this.kickMode === 'punt' && this.defense === this.userSide)) this.setUser(null);
  }

  // ---------- main update ----------
  update(dt) {
    dt = Math.min(dt, 0.05); this.time += dt; this._environment(dt);
    if (this.phase === 'presnap') { this.playT += dt; if (this.playT >= this.snapT) this.snap(); return; }
    if (this.phase === 'kickmeter') {
      this.meter.t += dt; this.meter.val = 0.5 + 0.5 * Math.sin(this.meter.t * 4.2); this._updateEnts(dt);
      const cpuKick = this.auto || this.passer.team !== this.userSide;
      if (cpuKick) { if (this.meter.t > 1.1) this._doKick(0.5 + R(-0.12, 0.12) * (1.3 - rating(this.passer, 'kik'))); } else if (this.meter.t > 4) this._doKick(this.meter.val);
      return;
    }
    if (this.phase === 'live') {
      this.playT += dt; if (this.clockRunning) this._tickClock(dt);
      for (const s of this.script) if (!s.done && this.playT >= s.t) { s.done = true; s.fn(); }
      if (this.paBite > 0) this.paBite -= dt;
      this._updateEnts(dt); this._separate(); this._updateBall(dt); if (this.phase === 'live') this._contacts(dt); this._hazardEffects(dt);
      if (this.hooks.onLive) this.hooks.onLive(this, dt);
      return;
    }
    if (this.phase === 'dead') { this.deadTimer -= dt; this._updateEnts(dt); this._separate(); this._updateBall(dt); if (this.deadTimer <= 0) this._advance(); }
  }
  _tickClock(dt) { if (this.mode === 'game') this.clock = Math.max(0, this.clock - dt); }
  _environment(dt) {
    const rules = this.rules, g = this.gust;
    if (rules.gusts) {
      g.t += dt;
      if (g.until > 0) { g.until -= dt; if (g.until <= 0) { this.wind.x = rules.wind.x; this.wind.z = rules.wind.z; this.gustStrength = 0; this.emit('gustend'); } }
      else if (g.t >= g.next) { g.t = 0; g.next = R(rules.gusts.min, rules.gusts.max); g.until = rules.gusts.dur; const a = R(0, 6.283); this.wind.x = rules.wind.x + Math.cos(a) * rules.gusts.strength; this.wind.z = rules.wind.z + Math.sin(a) * rules.gusts.strength; this.gustStrength = 1; this.emit('gust', rules.gusts.kind); }
    }
    if (rules.groove) { if (this.groove > 0) this.groove -= dt; else { this.grooveNext -= dt; if (this.grooveNext <= 0) { this.groove = 6; this.grooveNext = 22; this.emit('groove'); } } }
    for (const h of rules.hazards) if (h.type === 'steam' || h.type === 'lava') { h.phase += dt; const cyc = h.type === 'steam' ? 9 : 11; const ph = h.phase % cyc; const was = h.active; h.active = ph < 1.6 ? 1 : 0; if (h.active && !was) this.emit('erupt', h); }
    if (this.slowmo > 0) { this.slowmo -= dt; this.timeScale = 0.35; } else this.timeScale = 1;
  }
  _updateEnts(dt) {
    const b = this.ball; const live = this.phase === 'live';
    for (const side of ['home', 'away']) for (const e of this.roster[side]) {
      if (!e.active) continue;
      e.cooldown = Math.max(0, e.cooldown - dt); for (const k of Object.keys(e.eff)) if (typeof e.eff[k] === 'number' && k !== 'jukeDir') e.eff[k] = Math.max(0, e.eff[k] - dt);
      if (e.catching > 0) { e.catching -= dt; if (e.catching <= 0) { e.catching = 0; e.reach = null; e.catchType = null; } }
      if (e.action) { e.action.t += dt; if (e.action.type === 'throw' && !e.action.released && e.action.t >= e.action.release) { e.action.released = true; if (b.carrier === e && live) this._releasePass(e, e.action); } if (e.action.t > 0.6) e.action = null; }
      if (e.fake > 0) e.fake -= dt;
      if (e.jumpY > 0 || e.jumpV !== 0) { e.jumpY += e.jumpV * dt; e.jumpV -= this.g * dt; if (e.jumpY <= 0) { e.jumpY = 0; e.jumpV = 0; } }
      if (e.dragging && !(e.eff.drag > 0)) { e.dragging = false; const t = e.dragger; e.dragger = null; if (t) t.wrapOn = null; if (live && b.carrier === e) { this._tackleDown(e, t, 3); continue; } }
      const carrierTeam = b.carrier ? b.carrier.team : this.possession;
      if (e.action && e.action.target) e.look = { x: e.action.target.x, y: 1.4, z: e.action.target.z };
      else if (b.state === 'air' || b.state === 'loose' || (b.state === 'dead' && b.free)) e.look = { x: b.x, y: b.y, z: b.z };
      else if (b.carrier && b.carrier !== e && (e.team !== carrierTeam || e.settle)) e.look = { x: b.carrier.x, y: 1.4, z: b.carrier.z };
      else e.look = null;
      if (e.state === 'down') { e.timer -= dt; e.x += e.vx * dt; e.z += e.vz * dt; e.vx *= Math.exp(-4 * dt); e.vz *= Math.exp(-4 * dt); e.speed = 0; if (e.timer <= 0 && live) { e.state = e.team === this.possession ? (e.hasBall ? 'carrier' : 'route') : 'pursue'; e.anim = 'getup'; e.animOpts = { restart: true }; e.getup = 0.5; } continue; }
      if (e.getup > 0) { e.getup -= dt; e.vx *= 0.7; e.vz *= 0.7; e.speed = 0; continue; }
      if (!live) { e.vx *= 0.85; e.vz *= 0.85; e.x += e.vx * dt; e.z += e.vz * dt; e.speed = Math.hypot(e.vx, e.vz); e.faceTarget = null; this._face(e, dt); if (this.phase === 'dead' && !e.hasBall && e.state !== 'down' && Math.random() < dt * 0.4) e.anim = (this.result && this.result.happy === e.team) ? 'celebrate' : 'idle'; continue; }
      e.faceTarget = null; e.canBackpedal = false;
      const desire = (e.isUser && !this.auto && this.userInput) ? this._userDesire(e, dt) : (e.team === this.possession ? this._offenseAI(e, dt) : this._defenseAI(e, dt));
      this._move(e, desire, dt); this._face(e, dt);
    }
  }
  _userDesire(e, dt) {
    const inp = this.userInput; const mv = inp.move; const camDir = this.dirOf(this.userSide); const b = this.ball;
    let dz = mv.y * camDir, dx = -mv.x * camDir; const mag = Math.hypot(dx, dz);
    if (e.state === 'track' && mag < 0.3) return this._trackBall(e, b);
    if (e.state === 'returner' && mag < 0.3) return this._returnerAI(e, dt);
    if (mag < 0.1) return STOP;
    const sprint = inp.sprint && e.stamina > 0.05;
    if (sprint) e.stamina = Math.max(0, e.stamina - dt * 0.17 * this.rules.staminaDrain); else e.stamina = Math.min(1, e.stamina + dt * 0.12 / Math.max(0.5, this.rules.staminaDrain));
    return { dx: dx / mag, dz: dz / mag, speed: Math.min(1, mag) * (sprint ? 1.13 : 1), sprint };
  }
  _maxSpeed(e) {
    const rules = this.rules; let sp = 5.6 + rating(e, 'spd') * 3.9;
    if (e.eff.stumble > 0) sp *= 0.45; if (e.engaged) sp *= 0.3; if (e.eff.brokenSlow > 0) sp *= 0.7; if (e.eff.tangled > 0) sp *= 0.62; if (e.eff.burn > 0) sp *= 0.6;
    if (e.stamina < 0.15) sp *= 0.9; if (this.groove > 0) sp *= 1.06; if (rules.dense) sp *= 0.88; if (rules.sticky) sp *= 0.94;
    if (this._hazardAt(e, 'steam')) sp *= 0.55;
    const pursuing = this.ball.carrier && this.ball.carrier.team !== e.team && this.ball.state === 'held'; if (pursuing && !e.isUser) sp *= 1.03;
    if (e.state === 'route' && e.p.role === 'C') sp *= 0.9; if (e.backpedal) sp *= 0.72;
    return sp;
  }
  _move(e, d, dt) {
    const rules = this.rules; const traction = clamp(rules.traction * this._hazardTraction(e), 0.12, 1.3);
    const maxSp = this._maxSpeed(e); const acc = (13 + rating(e, 'acc') * 13) * traction * (e.engaged ? 0.6 : 1);
    if (e.eff.dive > 0) {
      e.x += e.vx * dt; e.z += e.vz * dt; e.vx *= Math.exp(-2.5 * dt); e.vz *= Math.exp(-2.5 * dt); e.speed = Math.hypot(e.vx, e.vz);
      if (e.eff.dive <= dt) { e.eff.dove = 0.6; if (e.hasBall) { const near = this.standing(e.team === 'home' ? 'away' : 'home').some(o => Math.hypot(o.x - e.x, o.z - e.z) < 1.6); if (near) this._tackleDown(e, null, 2); else { e.getup = 0.45; e.anim = 'getup'; e.animOpts = { restart: true }; } } else { e.timer = 0.6; e.state = 'down'; e.anim = 'down'; } }
      return;
    }
    if (e.eff.drag > 0) { e.vx *= Math.exp(-2.5 * dt); e.vz *= Math.exp(-2.5 * dt); e.x += e.vx * dt; e.z += e.vz * dt; e.speed = Math.hypot(e.vx, e.vz); return; }
    const want = d && d.speed > 0 ? d.speed : 0; let tx = (d ? d.dx : 0) * want * maxSp, tz = (d ? d.dz : 0) * want * maxSp;
    if (e.eff.juke > 0) { const k = e.eff.juke / 0.4; tx += (e.eff.jukeDir || 1) * 6.5 * k; }
    if (e.eff.spin > 0) { tx *= 0.6; tz *= 0.6; }
    let dvx = tx - e.vx, dvz = tz - e.vz; const dl = Math.hypot(dvx, dvz); const maxDv = acc * dt * (want > 0 ? 1 : 0.9); if (dl > maxDv) { dvx *= maxDv / dl; dvz *= maxDv / dl; }
    e.vx += dvx; e.vz += dvz; e.x += e.vx * dt; e.z += e.vz * dt;
    if (!e.hasBall) { e.x = clamp(e.x, -this.W2 - 2.5, this.W2 + 2.5); e.z = clamp(e.z, -2, this.F.L + 2); }
    e.speed = Math.hypot(e.vx, e.vz);
    if (e.speed > 6.5 && !e.isUser) e.stamina = Math.max(0, e.stamina - dt * (e.hasBall ? 0.16 : 0.05) * rules.staminaDrain); else if (!e.isUser) e.stamina = Math.min(1, e.stamina + dt * 0.1 / Math.max(0.5, rules.staminaDrain));
  }
  _face(e, dt) {
    let target = e.faceTarget; const moving = e.speed > 1.2; const velDir = Math.atan2(e.vx, e.vz); e.backpedal = false;
    if (target === null || target === undefined) { if (!moving) return; target = velDir; }
    else if (moving) { const d = Math.abs(angleDiff(velDir, target)); if (d > 1.9) { if (e.speed < 5.0 && e.canBackpedal) e.backpedal = true; else target = velDir; } else if (d > 1.0 && e.speed > 3.5 && !e.canBackpedal) target = velDir; }
    e.facing += angleDiff(e.facing, target) * Math.min(1, dt * 12);
  }
  _steerTo(e, x, z, speed = 1, slowRadius = 0.4) { const dx = x - e.x, dz = z - e.z; const d = Math.hypot(dx, dz); if (d < slowRadius) return STOP; return { dx: dx / d, dz: dz / d, speed: Math.min(speed, d < 1.6 ? d / 1.6 : 1) }; }
  _intercept(e, t) { const sp = this._maxSpeed(e); let tt = Math.min(1.3, Math.hypot(t.x - e.x, t.z - e.z) / sp); for (let i = 0; i < 2; i++) { const px = t.x + t.vx * tt, pz = t.z + t.vz * tt; tt = Math.min(1.3, Math.hypot(px - e.x, pz - e.z) / sp); } return { x: t.x + t.vx * tt, z: t.z + t.vz * tt }; }

  // ---------- offense AI ----------
  _offenseAI(e, dt) {
    const b = this.ball; const dir = this.dir;
    if (e.jumpY > 0 && !e.hasBall) return STOP;
    if (e.wrapOn) return this._steerTo(e, e.wrapOn.x, e.wrapOn.z, 0.5, 0.1);
    switch (e.state) {
      case 'track': return this._trackBall(e, b);
      case 'route': {
        if (b.state === 'air' && b.pred && (b.tipped || !b.target) && Math.hypot(b.pred.catch.x - e.x, b.pred.catch.z - e.z) < 7) return this._trackBall(e, b);
        if (b.state === 'loose' && Math.hypot(b.x - e.x, b.z - e.z) < 10) return this._steerTo(e, b.x, b.z, 1, 0.1);
        if (b.carrier && b.carrier.team !== e.team) { const p = this._intercept(e, b.carrier); return this._steerTo(e, p.x, p.z, 1); }
        if (b.carrier && b.carrier.team === e.team && b.carrier !== e && b.carrier.state === 'carrier' && this.passCrossed) return this._blockFor(e, b.carrier);
        e.routeT = (e.routeT || 0) + dt; if (e.routeT < 0) return STOP;
        if (e.routeIdx < e.route.length) { const p = e.route[e.routeIdx]; if (Math.hypot(p.x - e.x, p.z - e.z) < 0.9) e.routeIdx++; return this._steerTo(e, p.x, p.z, 1, 0.1); }
        const qb = b.carrier || this.passer;
        if (e.settle) { e.faceTarget = this._angleTo(e, qb); if (this.playT > 3.2) return this._steerTo(e, e.x + (e.x > 0 ? -1 : 1) * 3, e.z + dir * 2, 0.6); return STOP; }
        const goalZ = this.targetGoalZ(e.team); const openX = clamp(e.x + (qb.x > e.x ? 3 : -3), -this.W2 + 2, this.W2 - 2); const tz = Math.abs(goalZ - e.z) > 3 ? e.z + dir * 3 : goalZ - dir * 1;
        return this._steerTo(e, openX, tz, 0.75);
      }
      case 'block': { if (b.carrier && b.carrier.team !== e.team) { const p = this._intercept(e, b.carrier); return this._steerTo(e, p.x, p.z, 1); } if (b.state === 'loose' && Math.hypot(b.x - e.x, b.z - e.z) < 8) return this._steerTo(e, b.x, b.z, 1, 0.1); return this._blockFor(e, b.carrier || this.passer); }
      case 'fakerun': { if (!e.path) e.path = [{ x: e.x, z: e.z + dir * 6 }]; const p = e.path[Math.min(e.pathIdx, e.path.length - 1)]; if (Math.hypot(p.x - e.x, p.z - e.z) < 1) e.state = 'block'; return this._steerTo(e, p.x, p.z, 0.9); }
      case 'mesh': {
        const qb = b.carrier; if (!qb || qb.team !== e.team) { e.state = 'route'; return STOP; }
        e.meshT = (e.meshT || 0) + dt; if (e.meshT < e.meshDelay) return STOP;
        if (e.pitch) { this._lateral(qb, e, true); return STOP; }
        const meshX = qb.x + (e.x > qb.x ? 0.8 : -0.8), meshZ = qb.z - dir * 0.3;
        if (Math.hypot(meshX - e.x, meshZ - e.z) < 1.1 || e.meshT > 1.2) { this._handoff(qb, e); return this._pathDesire(e, dt); }
        return this._steerTo(e, meshX, meshZ, 0.9, 0.2);
      }
      case 'reverse': { const rb = b.carrier; if (!rb || rb.team !== e.team) { e.state = 'route'; return STOP; } if (Math.hypot(rb.x - e.x, rb.z - e.z) < 1.4 && this.playT > 0.8) { this._handoff(rb, e); e.path = [{ x: e.x + (e.x > 0 ? -1 : 1) * 10, z: e.z + dir * 2 }, { x: clamp(e.x + (e.x > 0 ? -1 : 1) * 14, -this.W2 + 2, this.W2 - 2), z: e.z + dir * 30 }]; e.pathIdx = 0; return this._pathDesire(e, dt); } return this._steerTo(e, rb.x - (rb.x > 0 ? 1 : -1) * 0.5, rb.z - dir * 1.5, 1); }
      case 'jet': { const qb = b.carrier; if (!qb || qb.team !== e.team) { e.state = 'route'; return STOP; } const side = e.x > qb.x ? 1 : -1; if (Math.abs(e.x - qb.x) < 1.3 && Math.abs(e.z - qb.z) < 1.6) { this._handoff(qb, e); e.path = [{ x: qb.x - side * 12, z: this.los + dir * 3 }, { x: qb.x - side * 13, z: this.los + dir * 30 }]; e.pathIdx = 0; return this._pathDesire(e, dt); } return this._steerTo(e, qb.x - side * 0.5, qb.z - dir * 0.6, 1, 0.1); }
      case 'trail': { const c = b.carrier; if (!c || c.team !== e.team || c === e) { e.state = 'route'; return STOP; } const side = e.x > c.x ? 1 : -1; return this._steerTo(e, clamp(c.x + side * 4, -this.W2 + 1, this.W2 - 1), c.z - dir * 3, 1, 0.3); }
      case 'qb': return this._qbAI(e, dt);
      case 'throwing': return STOP;
      case 'carrier': return this._carrierAI(e, dt);
      case 'cover': { const c = b.carrier; const t = c && c.team !== e.team ? this._intercept(e, c) : (b.pred ? b.pred.ground : null); if (!t) return STOP; return this._steerTo(e, t.x, t.z, 1); }
      case 'pursue': { const c = b.carrier; if (c && c.team !== e.team) { const p = this._intercept(e, c); return this._steerTo(e, p.x, p.z, 1); } if (b.state === 'loose') return this._steerTo(e, b.x, b.z, 1); return STOP; }
      default: return STOP;
    }
  }
  _trackBall(e, b) {
    if (b.state !== 'air' || !b.pred) { e.state = e.team === this.possession ? 'route' : 'pursue'; return STOP; }
    const cp = b.pred.catch; const dl = Math.hypot(cp.x - e.x, cp.z - e.z); const tArr = Math.max(0, cp.t);
    this._jumpOrDive(e, b, cp, dl, tArr);
    const sp = this._maxSpeed(e); const need = dl / Math.max(0.12, tArr); const speed = clamp(need / sp + 0.15, 0.4, 1);
    if (dl < 0.35 && tArr > 0.25) { e.faceTarget = Math.atan2(b.x - e.x, b.z - e.z); return STOP; }
    return this._steerTo(e, cp.x, cp.z, speed, 0.12);
  }
  _passHeightAt(e, b) { const pts = b.pred && b.pred.pts; if (!pts || !pts.length) return null; let best = null, bd = 1e9; for (const p of pts) { const d = Math.hypot(p[0] - e.x, p[2] - e.z); if (d < bd) { bd = d; best = p; } } return { y: best[1], t: best[3], dist: bd }; }
  _jumpOrDive(e, b, cp, dl, tArr) {
    if (e.jumpY > 0 || e.eff.dive > 0 || e.eff.stumble > 0) return;
    const h = this._passHeightAt(e, b);
    if (h && h.y > 1.95 && h.y < 3.4 && h.dist < 1.3 && h.t < 0.4 && h.t > 0.04) { this._jump(e); return; }
    const reach = e.r + 0.7;
    const short = dl - this._maxSpeed(e) * Math.max(0, tArr);
    if (!e.isUser && e.diveWill && tArr < 0.34 && short > reach * 0.5 && short < reach + 1.3 && cp.y < 1.9) { const [dx, dz] = norm(cp.x - e.x, cp.z - e.z); e.eff.dive = 0.45; e.vx = dx * 9; e.vz = dz * 9; e.anim = 'dive'; e.animOpts = { restart: true }; this.emit('dive', e); }
  }
  _rollDives() { for (const side of ['home', 'away']) for (const e of this.roster[side]) e.diveWill = Math.random() < (e.team === this.possession ? 0.7 : 0.4); }
  _blockFor(e, protectee) {
    if (!protectee) return STOP; const def = this.standing(e.team === 'home' ? 'away' : 'home');
    if (e.engaged) { const d = e.engaged; return this._steerTo(e, d.x + (protectee.x - d.x) * 0.15, d.z + (protectee.z - d.z) * 0.15, 0.6, 0.3); }
    let best = null, bs = 1e9;
    for (const d of def) { if (d.engaged && d.engaged !== e) continue; if (d === this.ball.carrier) continue; const dist = Math.hypot(d.x - protectee.x, d.z - protectee.z); const score = dist - (d.asg === 'rush' ? 4 : 0) - (Math.hypot(d.x - e.x, d.z - e.z) < 4 ? 3 : 0); if (score < bs) { bs = score; best = d; } }
    if (!best) return this._steerTo(e, e.x, protectee.z + this.dirOf(e.team) * 1.5, 0.6);
    e.faceTarget = this._angleTo(e, best);
    const dx = protectee.x - best.x, dz = protectee.z - best.z; const l = Math.hypot(dx, dz) || 1; return this._steerTo(e, best.x + dx / l * 0.9, best.z + dz / l * 0.9, 1, 0.2);
  }
  _pathDesire(e, dt) {
    if (!e.path || !e.path.length) return this._carrierAI(e, dt);
    const p = e.path[Math.min(e.pathIdx, e.path.length - 1)]; if (Math.hypot(p.x - e.x, p.z - e.z) < 1.2) e.pathIdx++;
    if (e.pathIdx >= e.path.length || this.passCrossed) { e.followPath = false; return this._carrierAI(e, dt); }
    return this._avoid(e, this._steerTo(e, p.x, p.z, 1, 0.1));
  }
  _avoid(e, d) {
    const def = this.standing(e.team === 'home' ? 'away' : 'home').filter(x => !x.engaged); let ax = 0, az = 0; const dir = this.dirOf(e.team);
    for (const x of def) { const dx = e.x - x.x, dz = e.z - x.z; const dist = Math.hypot(dx, dz); if (dist < 5.5 && dz * dir < 2) { const w = (5.5 - dist) / 5.5; ax += dx / (dist || 1) * w * 1.6; az += dz / (dist || 1) * w * 0.5; } }
    if (Math.abs(e.x) > this.W2 - 3) ax -= Math.sign(e.x) * 0.9;
    let dx = d.dx + ax, dz = d.dz + az; if (dz * dir < 0.2) dz = 0.2 * dir; const l = Math.hypot(dx, dz) || 1; return { dx: dx / l, dz: dz / l, speed: d.speed };
  }
  _carrierAI(e, dt) {
    if (e.isUser && !this.auto) return STOP; const dir = this.dirOf(e.team); const goalZ = this.targetGoalZ(e.team);
    if (e.followPath && e.path && e.pathIdx < e.path.length && !this.passCrossed) return this._pathDesire(e, dt);
    const def = this.standing(e.team === 'home' ? 'away' : 'home'); let best = null, bs = -1e9;
    for (const ang of [-1.1, -0.7, -0.35, 0, 0.35, 0.7, 1.1]) {
      const dx = Math.sin(ang), dz = Math.cos(ang) * dir; const px = e.x + dx * 6, pz = e.z + dz * 6; let s = Math.cos(ang) * 3.2 - Math.abs(ang) * 0.6 - Math.abs(goalZ - pz) * 0.05; if (Math.abs(px) > this.W2 - 1) s -= 6;
      for (const x of def) { const dd = Math.hypot(x.x + x.vx * 0.5 - px, x.z + x.vz * 0.5 - pz); s -= Math.max(0, 6 - dd) * 1.2; const dnow = Math.hypot(x.x - e.x, x.z - e.z); if (dnow < 3) { const rel = ((x.x - e.x) * dx + (x.z - e.z) * dz) / dnow; s -= Math.max(0, rel) * 3; } }
      if (s > bs) { bs = s; best = { dx, dz }; }
    }
    const near = def.find(x => Math.hypot(x.x - e.x, x.z - e.z) < 2.2 && e.eff.juke <= 0 && e.eff.spin <= 0);
    if (near && Math.random() < dt * (0.8 + rating(e, 'agi') * 2)) { if (Math.random() < 0.5) { e.eff.juke = 0.4; e.eff.jukeDir = e.x - near.x > 0 ? 1 : -1; e.anim = 'juke'; e.animOpts = { dir: e.eff.jukeDir, restart: true }; } else { e.eff.spin = 0.5; e.anim = 'spin'; e.animOpts = { restart: true }; } }
    return { dx: best.dx, dz: best.dz, speed: 1 };
  }
  _routeDepth(r) { return r.route && r.route.length ? (r.route[r.route.length - 1].z - this.los) * this.dir : 0; }
  _evalTarget(qb, r, def) {
    const dist = Math.hypot(r.x - qb.x, r.z - qb.z); const T = 0.4 + dist / (19 + rating(qb, 'thp') * 15); const lx = r.x + r.vx * T * 0.9, lz = r.z + r.vz * T * 0.9;
    let sep = 1e9; for (const d of def) { const dd = Math.hypot(d.x + d.vx * T * 0.8 - lx, d.z + d.vz * T * 0.8 - lz); if (dd < sep) sep = dd; }
    const depth = (lz - this.los) * this.dir; let lane = 0; const [ux, uz] = norm(lx - qb.x, lz - qb.z);
    for (const d of def) { const px = d.x - qb.x, pz = d.z - qb.z; const along = px * ux + pz * uz; if (along > 0 && along < 6 && Math.abs(-uz * px + ux * pz) < 1.2) lane++; }
    const score = sep * 1.4 + Math.min(depth, 22) * 0.18 - (dist > 42 ? 8 : 0) - (depth < -1 ? 3 : 0) + (r.settle && r.routeIdx >= r.route.length ? 1 : 0) - lane * 3 - (Math.abs(lx) > this.W2 - 0.8 ? 5 : 0) - (this.rules.fog && dist > 20 ? 3 : 0);
    return { score, sep, depth, dist };
  }
  _qbAI(e, dt) {
    const b = this.ball; if (b.carrier !== e) return STOP; if (e.isUser && !this.auto) return STOP;
    e.dropT = (e.dropT || 0) + dt; const dir = this.dir; const def = this.standing(this.defense); const react = this.diff.aiReact;
    const rushers = def.filter(d => Math.hypot(d.x - e.x, d.z - e.z) < 2.6 && !d.engaged); const pressure = rushers.length > 0;
    const passable = !this.forwardPassUsed && (e.z - this.los) * dir <= 0.3;
    if (!passable) { e.state = 'carrier'; return this._carrierAI(e, dt); }
    e.faceTarget = dir > 0 ? 0 : Math.PI;
    if (!e.reads) { e.reads = this.eligibles.filter(r => !r.isBlocker && r.state !== 'block'); const deepFirst = this.offPlay.cat === 'deep' || this.offPlay.cat === 'mid'; e.reads.sort((a, c) => (deepFirst ? -1 : 1) * (this._routeDepth(a) - this._routeDepth(c))); e.readIdx = 0; e.readT = 0; }
    const isRun = this.offPlay.type === 'run'; const minHold = 0.55 * react + (this.offPlay.cat === 'deep' ? 0.9 : this.offPlay.cat === 'mid' ? 0.4 : 0) + (isRun ? 1.6 : 0);
    if (e.dropT > minHold && e.reads.length) {
      e.readT += dt; let best = null, bs = -1e9;
      for (const r of e.reads) { if (r.state === 'down' || r.state === 'block') continue; const ev = this._evalTarget(e, r, def); const s = ev.score + (r === e.reads[e.readIdx] ? 1.5 : 0); if (s > bs) { bs = s; best = { r, ...ev }; } }
      const need = pressure ? 1.2 : e.dropT > 2.4 * react ? 1.8 : 2.6;
      if (best && (best.sep > need || (e.dropT > 3.2 * react && best.sep > 1.0))) { const power = best.depth > 14 && best.sep > 3.5 ? 0.35 : best.depth > 7 && best.sep > 2.2 ? 0.62 : 0.85; this._throw(e, best.r, power); return STOP; }
      if (e.readT > 0.45 * react) { e.readT = 0; e.readIdx = (e.readIdx + 1) % e.reads.length; }
      if (pressure && e.dropT > 1.6 * react && Math.random() < dt * 3) { if (rating(e, 'spd') > 0.62 && Math.random() < 0.5) { e.state = 'carrier'; this.emit('scramble', e); return this._carrierAI(e, dt); } this._throwAway(e); return STOP; }
      if (e.dropT > 4.0 * react) { e.state = 'carrier'; this.emit('scramble', e); return this._carrierAI(e, dt); }
    }
    const pocketZ = this.res.QB.start[1] - (isRun && !e.threw && e.dropT < 1.6 ? 0.3 : 2.2); const w = this.toWorld(this.res.QB.start[0], pocketZ); let tx = w.x, tz = w.z;
    if (pressure) { const d = rushers.reduce((a, c) => (Math.hypot(c.x - e.x, c.z - e.z) < Math.hypot(a.x - e.x, a.z - e.z) ? c : a)); tx = e.x + (e.x - d.x) * 1.5; tz = e.z + (e.z - d.z) * 0.6; if ((tz - this.los) * dir > -0.5) tz = this.los - dir * 1; }
    return this._steerTo(e, clamp(tx, -this.W2 + 1, this.W2 - 1), tz, pressure ? 0.9 : 0.6, 0.3);
  }
  _handoff(qb, rb) { if (this.ball.carrier !== qb) return; this.handoffT = this.playT; this._giveBall(rb); rb.state = 'carrier'; rb.followPath = true; qb.state = 'block'; qb.anim = 'idle'; this.emit('handoff', rb); }

  // ---------- defense AI ----------
  _nearestBlocker(e) { let best = null, bd = 1e9; for (const o of this.standing(this.possession)) { if (o.state !== 'block' && !o.isBlocker) continue; const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < bd) { bd = d; best = o; } } return bd < 2.4 ? best : null; }
  _returnerAI(e, dt) {
    const b = this.ball;
    if (b.carrier === e) return this._carrierAI(e, dt);
    if (b.state === 'air' && b.pred) { const cp = b.pred.ground; const dl = Math.hypot(cp.x - e.x, cp.z - e.z); const h = this._passHeightAt(e, b); if (h && h.y > 1.95 && h.y < 3.2 && h.dist < 1.2 && h.t < 0.4 && e.jumpY === 0) this._jump(e); e.faceTarget = this._angleTo(e, b); e.canBackpedal = true; return this._steerTo(e, cp.x, cp.z, 1, 0.12); }
    if (b.state === 'loose') return this._steerTo(e, b.x, b.z, 1, 0.1);
    if (b.carrier && b.carrier.team !== e.team) { const p = this._intercept(e, b.carrier); return this._steerTo(e, p.x, p.z, 1); }
    return STOP;
  }
  _defenseAI(e, dt) {
    const b = this.ball, dir = this.dir, off = this.roster[this.possession]; const carrier = b.carrier; const react = this.diff.aiReact; const rules = this.rules;
    e.react -= dt; const canReact = e.react <= 0; if (canReact) e.react = (0.08 + (1 - rating(e, 'awr')) * 0.25) * react * (rules.fog ? 1.5 : 1);
    if (e.state === 'returner') return this._returnerAI(e, dt);
    if (e.wrapOn) return this._steerTo(e, e.wrapOn.x, e.wrapOn.z, 0.5, 0.1);
    if (e.jumpY > 0) return STOP;
    if (e.engaged) { const bl = e.engaged; const side = e.shedSide || (e.shedSide = Math.random() < 0.5 ? -1 : 1); const qb = carrier || this.passer; const [lx, lz] = norm(-(qb.z - e.z), qb.x - e.x); return this._steerTo(e, bl.x + lx * side * 1.3, bl.z + lz * side * 1.3 + (qb.z - bl.z) * 0.25, 0.7, 0.2); }
    if (carrier && carrier.team !== e.team) {
      const live = carrier.state === 'carrier' || this.passCrossed || (carrier.z - this.los) * dir > -0.3;
      const fooled = carrier !== this.passer && !this.passCrossed && (carrier.z - this.los) * dir < 1 && e.asg !== 'rush' && e.asg !== 'spy' && this.playT - (this.handoffT || 0) < (e.diagT || (e.diagT = (0.35 + (1 - rating(e, 'awr')) * 0.7) * react));
      if (live && !fooled) { if (canReact || !e.target) e.target = this._intercept(e, carrier); return this._steerTo(e, e.target.x, e.target.z, 1, 0.1); }
    }
    if (carrier && carrier.team === e.team) return this._blockFor(e, carrier);
    if (b.state === 'loose') return this._steerTo(e, b.x, b.z, 1, 0.1);
    if (b.state === 'air' && b.pred && !b.kick) {
      const cp = b.pred.catch; const dl = Math.hypot(cp.x - e.x, cp.z - e.z); const tArr = cp.t; const sp = this._maxSpeed(e);
      const canMake = dl / sp < tArr + 0.5 + rating(e, 'awr') * 0.4; const myMan = e.manTarget && b.target === e.manTarget;
      const found = b.airT >= (myMan ? 0.06 : 0.14 + (1 - rating(e, 'awr')) * 0.3) * react || b.tipped;
      if (found && (canMake || myMan || e.asg === 'zone' || e.asg === 'spy') && !(rules.fog && dl > 14 && !myMan)) { e.breaking = true; this._jumpOrDive(e, b, cp, dl, tArr); return this._steerTo(e, cp.x, cp.z, 1, 0.1); }
    }
    const qb = carrier || this.passer; if (!qb) return STOP;
    switch (e.asg) {
      case 'rush': {
        if (this.playT < e.rushDelay * react) { e.faceTarget = this._angleTo(e, qb); return STOP; }
        if (canReact || !e.target) e.target = this._intercept(e, qb);
        const bl = this._nearestBlocker(e); if (bl) { const side = e.rushSide || (e.rushSide = Math.random() < 0.5 ? -1 : 1); const [lx, lz] = norm(-(qb.z - e.z), qb.x - e.x); return this._steerTo(e, bl.x + lx * side * 1.6, bl.z + lz * side * 1.6 + (qb.z - bl.z) * 0.3, 1, 0.1); }
        return this._steerTo(e, e.target.x, e.target.z, 1, 0.1);
      }
      case 'spy': { e.faceTarget = this._angleTo(e, qb); e.canBackpedal = true; if ((qb.z - this.los) * dir > -0.5 && qb.state === 'carrier') { e.target = this._intercept(e, qb); return this._steerTo(e, e.target.x, e.target.z, 1, 0.1); } const w = this.toWorld(0, 5); return this._steerTo(e, clamp(qb.x, -this.W2 + 3, this.W2 - 3), w.z, 0.7, 0.3); }
      case 'man': {
        const t = e.manTarget; if (!t || t.state === 'block' || t.isBlocker || t.state === 'down') { const w = this.toWorld(0, 6); e.faceTarget = this._angleTo(e, qb); e.canBackpedal = true; return this._steerTo(e, e.x, w.z, 0.5); }
        const bite = this.paBite > 0 && rating(e, 'awr') < 0.75 ? -3 : 0; const cushion = (e.tech === 'press' ? 0.6 : 2.2) + (1 - rating(e, 'cov')) * 1.2 + bite;
        const beaten = (t.z - e.z) * dir > 0.4;
        if (canReact || !e.target) { const lead = 0.3 * react; const tx = t.x + t.vx * lead, tz = t.z + t.vz * lead; e.target = { x: tx - Math.sign(tx || 1) * 0.5, z: tz + dir * cushion }; }
        if (!beaten) { e.faceTarget = this._angleTo(e, qb); e.canBackpedal = true; }
        return this._steerTo(e, e.target.x, e.target.z, 1, 0.1);
      }
      case 'zone': default: {
        const lm = e.zone || zoneLandmark('hook', this.F.W); const w = this.toWorld(lm[0], lm[1] * (e.zoneDepthMul || 1)); let tx = w.x, tz = w.z;
        const bite = this.paBite > 0 && rating(e, 'awr') < 0.75 ? -4 : 0; tz += dir * bite;
        let near = null, nd = 8; for (const o of off) { if (!o.active || o.isBlocker || o.state === 'block' || o === carrier || o.state === 'down') continue; const d = Math.hypot(o.x - tx, o.z - tz); if (d < nd) { nd = d; near = o; } }
        if (near && canReact) e.target = { x: tx + (near.x - tx) * 0.6, z: tz + (near.z - tz) * 0.5 }; else if (!e.target || canReact) e.target = { x: tx, z: tz };
        e.faceTarget = this._angleTo(e, qb); e.canBackpedal = true;
        return this._steerTo(e, e.target.x, e.target.z, 0.95, 0.25);
      }
    }
  }

  // ---------- ball ----------
  _predict(b) {
    let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz; const dt = 0.04; const kd = (b.spin === 'spiral' ? 0.0045 + b.wobble * 0.006 : 0.012) * this.rules.drag; const g = this.ballG;
    let catchPt = null, apex = vy <= 0, t = 0; const pts = [];
    for (let i = 0; i < 200; i++) {
      const v = Math.hypot(vx, vy, vz); const f = 1 - Math.min(0.5, kd * v * dt); vy -= g * dt; vx *= f; vy *= f; vz *= f; vx += this.wind.x * dt * 0.6; vz += this.wind.z * dt * 0.6;
      if (this.rules.pullCenter && y > 0.5) vx += -Math.sign(x) * Math.min(2.5, Math.abs(x) * 0.25) * dt;
      x += vx * dt; y += vy * dt; z += vz * dt; t += dt; if (vy < 0) apex = true;
      if (!catchPt && apex && y <= 1.5) catchPt = { x, z, y, t };
      if (i % 4 === 0) pts.push([x, y, z, t]);
      if (y <= BALL_R) { pts.push([x, y, z, t]); return { catch: catchPt || { x, z, y: BALL_R, t }, ground: { x, z, t }, pts }; }
    }
    return { catch: catchPt || { x, z, y, t }, ground: { x, z, t }, pts };
  }
  _nearestMagnet(b) { let best = null, bd = 1e9; for (const e of this.standing(this.magnetSide || 'away')) { const d = Math.hypot(e.x - b.x, e.z - b.z); if (d < bd) { bd = d; best = e; } } return best; }
  _integrateBall(b, dt) {
    const g = this.ballG, rules = this.rules; b.airT += dt;
    if (b.y > BALL_R + 0.01 || b.vy > 0) {
      b.vy -= g * dt; const v = Math.hypot(b.vx, b.vy, b.vz); const kd = (b.spin === 'spiral' ? 0.0045 + b.wobble * 0.006 : 0.012) * rules.drag; const f = 1 - Math.min(0.5, kd * v * dt); b.vx *= f; b.vy *= f; b.vz *= f;
      b.vx += this.wind.x * dt * 0.6; b.vz += this.wind.z * dt * 0.6;
      if (rules.pullCenter && b.y > 0.5) b.vx += -Math.sign(b.x) * Math.min(2.5, Math.abs(b.x) * 0.25) * dt;
      if (rules.magnet && b.state === 'air' && b.forward) { const m = this._nearestMagnet(b); if (m) { const dx = m.x - b.x, dz = m.z - b.z; const d = Math.hypot(dx, dz); if (d < 8 && d > 0.3) { const a = 3.5 * (1 - d / 8); b.vx += dx / d * a * dt; b.vz += dz / d * a * dt; } } }
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.spinAngle += b.spinRate * dt;
    if (b.y <= BALL_R) { b.y = BALL_R; this._onGround(b, dt); }
  }
  _onGround(b, dt) {
    const rules = this.rules;
    if (b.state === 'air') {
      if (b.kick === 'fg' || b.kick === 'pat') { if (!b.fgResolved) { b.fgResolved = true; this._fieldGoal(false); } b.state = 'dead'; b.free = true; }
      else if (b.forward) { b.state = 'dead'; b.free = true; if (this.phase === 'live') { this._endPlay({ type: 'incomplete', text: b.dropped ? 'DROPPED' : b.tipped ? 'TIPPED · INCOMPLETE' : b.throwAway ? 'THROWN AWAY' : 'INCOMPLETE', spot: this.los, clockStop: true }); this.emit('incomplete'); } }
      else { b.state = 'loose'; b.looseT = 0; b.target = null; this.emit('bounce'); }
      for (const side of ['home', 'away']) for (const e of this.roster[side]) if (e.state === 'track') e.state = e.team === this.possession ? 'route' : 'pursue';
    }
    if (b.vy < -1.0) {
      const vh = Math.hypot(b.vx, b.vz); b.vy = -b.vy * 0.45 * rules.bounce; const kick = R(0.15, 0.5) * vh + R(0.3, 2) * rules.bounce; const a = R(0, 6.283);
      b.vx = b.vx * 0.55 + Math.cos(a) * kick; b.vz = b.vz * 0.55 + Math.sin(a) * kick; b.bounces = (b.bounces || 0) + 1; b.spin = 'tumble'; b.spinRate = R(6, 14) * rules.bounce; if (b.bounces <= 3) this.emit('bounce');
    } else {
      b.vy = 0; const f = Math.exp(-(rules.sticky ? 5 : rules.slick ? 0.8 : 1.8) * dt); b.vx *= f; b.vz *= f; const sp = Math.hypot(b.vx, b.vz);
      if (sp < 0.15) { b.vx = b.vz = 0; b.resting = true; b.spinRate = 0; } else { b.spinRate = sp * 4; b.spin = 'roll'; }
    }
  }
  _updateBall(dt) {
    const b = this.ball; const live = this.phase === 'live';
    if (b.state === 'held') { const c = b.carrier; if (c) { b.x = c.x; b.z = c.z; b.y = 1.0 + c.jumpY; b.vx = c.vx; b.vz = c.vz; b.vy = 0; } return; }
    if (b.state === 'dead') { if (b.free) this._integrateBall(b, dt); return; }
    if (b.state === 'air') {
      this._integrateBall(b, dt); if (b.state !== 'air') return;
      b.predT -= dt; if (!b.pred || b.predT <= 0) { b.pred = this._predict(b); b.predT = 0.12; }
      if (b.kick === 'fg' || b.kick === 'pat') { if (!b.fgResolved && (b.z - b.goalZ) * this.dir >= 0) { b.fgResolved = true; this._fieldGoal(b.y > 3.33 && Math.abs(b.x) < 3.08 && b.y < 40); } else if (!b.fgResolved && b.airT > 7) { b.fgResolved = true; this._fieldGoal(false); } return; }
      if (!live) return;
      this._catchChecks(b, dt); if (b.state !== 'air') return;
      if (Math.abs(b.x) > this.W2 + 0.3 || b.z < -1 || b.z > this.F.L + 1) {
        if (b.forward) { b.state = 'dead'; b.free = true; this._endPlay({ type: 'incomplete', text: b.throwAway ? 'THROWN AWAY' : 'INCOMPLETE', spot: this.los, clockStop: true }); this.emit('incomplete'); }
        else if (b.kick === 'punt') this._puntDead(clamp(b.z, this.GLA + 1, this.GLB - 1), 'OUT OF BOUNDS');
        else { b.state = 'dead'; b.free = true; this._endPlay({ type: 'oob', text: 'OUT OF BOUNDS', spot: b.thrower ? b.thrower.z : this.los, clockStop: true }); }
        return;
      }
      if (b.airT > 10) { b.state = 'dead'; b.free = true; this._endPlay({ type: 'incomplete', text: 'INCOMPLETE', spot: this.los, clockStop: true }); }
      return;
    }
    if (b.state === 'loose') { this._integrateBall(b, dt); if (live && b.state === 'loose') this._looseUpdate(b, dt); }
  }
  _looseUpdate(b, dt) {
    b.looseT += dt; const gz = this.targetGoalZ(this.possession);
    if (b.kick === 'punt') {
      if ((b.z - gz) * this.dir > 0) return this._puntDead(null, 'TOUCHBACK');
      if (Math.abs(b.x) > this.W2) return this._puntDead(clamp(b.z, this.GLA + 1, this.GLB - 1), 'OUT OF BOUNDS');
      if ((b.resting && b.looseT > 1.5) || b.looseT > 7) return this._puntDead(b.z, 'DOWNED');
    } else if (b.looseT > 5 || Math.abs(b.x) > this.W2 + 0.5 || b.z < 0 || b.z > this.F.L) { return this._endPlay({ type: 'loose', text: 'BALL DEAD', spot: clamp(b.z, this.GLA + 1, this.GLB - 1), turnover: b.lastTeam !== this.possession, clockStop: true }); }
    if (b.looseT < 0.2) return;
    for (const side of ['home', 'away']) for (const e of this.standing(side)) {
      if (Math.hypot(e.x - b.x, e.z - b.z) < e.r + 0.55 && b.y < 1.5) {
        if (b.kick === 'punt' && e.team === this.possession) return this._puntDead(b.z, 'DOWNED');
        this._giveBall(e); e.state = 'carrier'; e.followPath = false; b.kick = null; this.passCrossed = true; e.anim = 'catch_curl'; e.animOpts = { restart: true }; e.catching = 0.4; this.emit('recover', e);
        if (e.team !== this.possession) { for (const o of this.roster[this.possession]) if (o.active) o.state = 'pursue'; for (const d of this.roster[this.defense]) if (d.active && d !== e) d.state = 'block'; }
        if (!this.auto && e.team === this.userSide) this.setUser(e); return;
      }
    }
  }
  _catchType(e, b) {
    if (e.eff.dive > 0) return 'dive';
    const h = this._passHeightAt(e, b); if (e.jumpY > 0.15 || (h && h.y > 1.95 && h.dist < 1.3)) return 'high';
    const fx = Math.sin(e.facing), fz = Math.cos(e.facing); const dx = b.x - e.x, dz = b.z - e.z; const dh = Math.hypot(dx, dz) || 1; const toBall = (fx * dx + fz * dz) / dh;
    const bvh = Math.hypot(b.vx, b.vz) || 1; const along = (b.vx * fx + b.vz * fz) / bvh; const lateral = Math.abs(-fz * dx + fx * dz);
    if (along > 0.45 && toBall < 0.35 && e.speed > 2.5) return 'shoulder';
    if (lateral > 0.9) return 'reach';
    return 'curl';
  }
  _catchChecks(b, dt) {
    const isKick = b.kick === 'punt'; let bestOff = null, bdO = 1e9, bestDef = null, bdD = 1e9;
    for (const side of ['home', 'away']) for (const e of this.roster[side]) {
      if (!e.active || e.state === 'down' || e.getup > 0) continue;
      if (e === b.thrower && b.airT < 0.35 && !b.tipped) continue;
      if (!b.tipped && e !== b.target && (e.engaged || e.state === 'block')) continue;
      if (isKick && e.team === b.lastTeam) continue;
      e.catchCooldown = Math.max(0, e.catchCooldown - dt);
      const dx = b.x - e.x, dz = b.z - e.z; const dh = Math.hypot(dx, dz); const yRel = b.y - e.jumpY;
      const closing = (dx * (b.vx - e.vx) + dz * (b.vz - e.vz)) < 0;
      if (dh < 2.6 && closing && yRel < CATCH_HI + 1.2 && yRel > -0.5 && !(e.catching > 0) && e.catchCooldown <= 0) { e.catching = 0.6; e.catchType = this._catchType(e, b); e.anim = 'catch_' + e.catchType; e.animOpts = { restart: true }; }
      if (e.catching > 0) e.reach = { x: b.x, y: b.y, z: b.z };
      if (e.catchCooldown > 0) continue;
      const reachH = e.r + 0.7 + (e.eff.dive > 0 ? 0.55 : 0) + (e.catchType === 'reach' ? 0.25 : 0); const hi = CATCH_HI + (e.jumpY > 0.15 ? 0.7 : 0);
      if (dh < reachH && yRel > CATCH_LO && yRel < hi) { if (e.team === b.lastTeam) { if (dh < bdO) { bdO = dh; bestOff = e; } } else if (dh < bdD) { bdD = dh; bestDef = e; } }
    }
    if (bestOff && bestDef) {
      // Both have hands on it: the receiver with position usually wins; a defender who is closer, sees the ball, or is in the air can play it first.
      const d = bestDef; const sees = this._seesBall(d, b);
      const pDef = clamp(0.18 + (bdO - bdD) * 1.1 + (rating(d, 'cov') - 0.5) * 0.4 + (d.jumpY > 0.15 ? 0.2 : 0) + (d.eff.dive > 0 ? 0.1 : 0) + (b.tipped ? 0.1 : 0), 0.05, 0.8) * sees;
      this._resolveCatch(Math.random() < pDef ? d : bestOff, b);
    } else if (bestOff) this._resolveCatch(bestOff, b); else if (bestDef) this._resolveCatch(bestDef, b);
  }
  _seesBall(e, b) { const fx = Math.sin(e.facing), fz = Math.cos(e.facing); const dx = b.x - e.x, dz = b.z - e.z; const dh = Math.hypot(dx, dz) || 1; const face = (fx * dx + fz * dz) / dh; let sees = face > 0.3 ? 1 : face > -0.4 ? 0.7 : 0.35; if (e.breaking) sees = Math.max(sees, 0.75); return sees; }
  _resolveCatch(e, b) {
    e.catchCooldown = 0.5; const isOff = e.team === b.lastTeam; const rules = this.rules;
    const opp = this.standing(e.team === 'home' ? 'away' : 'home'); let contestedBy = null, cd = 1.6; for (const o of opp) { const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < cd) { cd = d; contestedBy = o; } } const contested = !!contestedBy; const tight = contested ? (1.6 - cd) / 1.6 : 0;
    if (b.kick === 'punt') {
      const near = this.standing(b.lastTeam).some(o => Math.hypot(o.x - e.x, o.z - e.z) < 4.5);
      if (Math.random() < 0.78 + rating(e, 'cat') * 0.22 - (rules.fog ? 0.1 : 0) - (e.jumpY > 0.1 ? 0.1 : 0)) {
        this._giveBall(e); e.state = 'carrier'; e.followPath = false; b.kick = null; this.passCrossed = true; this.emit('puntcatch', e);
        if (near && !e.isUser && Math.random() < 0.6) { this.emit('faircatch'); this._endPlay({ type: 'punt', text: 'FAIR CATCH', spot: clamp(e.z, this.GLA + 1, this.GLB - 1), turnover: true, clockStop: true, punt: true }); } else this._puntCaught(e);
      } else { this._deflect(b, e, 'muff'); this.emit('muff', e); }
      return;
    }
    if (isOff) {
      let p = 0.68 + rating(e, 'cat') * 0.32 - (contested ? 0.06 + tight * 0.22 + rating(contestedBy, 'cov') * 0.08 : 0) - (b.bullet ? 0.05 : 0) + (this.trait(e) === 'sticky' ? 0.15 : 0) + (b.lateral ? 0.2 : 0) + (e === b.target ? 0.05 : -0.08)
        - ({ high: 0.04, shoulder: 0.06, reach: 0.12, dive: 0.18, curl: 0 }[e.catchType] || 0) - (b.tipped ? 0.15 : 0) + (rules.sticky ? 0.08 : 0) - (rules.fog ? 0.06 : 0) - (b.wobble > 0.6 ? 0.06 : 0) - (contested && this.trait(contestedBy) === 'thief' ? 0.08 : 0);
      this.emit('catchroll', { text: `${e.role} ${e.catchType} p=${p.toFixed(2)}${contested ? ' contested' : ''}${e === b.target ? ' target' : ''}${b.tipped ? ' tipped' : ''}${b.bullet ? ' bullet' : ''} y=${b.y.toFixed(1)} v=${Math.hypot(b.vx, b.vy, b.vz).toFixed(0)}` });
      if (Math.random() < p) this._complete(e, b); else { this._deflect(b, e, 'drop'); this.emit('drop', e); }
    } else {
      const sees = this._seesBall(e, b);
      const pInt = (0.05 + rating(e, 'cov') * 0.18 + rating(e, 'cat') * 0.1 - (b.bullet ? 0.08 : 0) + (this.trait(e) === 'thief' ? 0.1 : 0) + (e.jumpY > 0.15 ? 0.06 : 0) + (b.tipped ? 0.12 : 0) + (e.isUser && e.eff.jump > 0 ? 0.08 : 0) - (rules.fog ? 0.04 : 0)) * sees;
      const multi = (b.deflections || 0) >= 2 ? 0.4 : 1; const pSwat = (0.3 + rating(e, 'cov') * 0.25 + (e.eff.dive > 0 ? 0.1 : 0) + (e.jumpY > 0.15 ? 0.1 : 0)) * (0.5 + 0.5 * sees) * multi; const r = Math.random();
      this.emit('defroll', { text: `${e.role} int=${pInt.toFixed(2)} swat=${pSwat.toFixed(2)} sees=${sees}${b.tipped ? ' tipped' : ''}` });
      if (r < pInt) {
        this._giveBall(e); e.state = 'carrier'; e.followPath = false; this.passCrossed = true; this.stats[e.team].ints++; e.catching = 0.35; this.emit('interception', e);
        for (const o of this.roster[this.possession]) if (o.active) o.state = 'pursue'; for (const d of this.roster[this.defense]) if (d.active && d !== e) d.state = 'block';
        if (!this.auto && e.team === this.userSide) this.setUser(e);
      } else if (r < pInt + pSwat) { this._deflect(b, e, Math.random() < 0.6 ? 'swat' : 'tip'); e.catchCooldown = 0.9; this.emit('swat', e); }
    }
  }
  _complete(e, b) {
    this._giveBall(e); e.state = 'carrier'; e.followPath = !!(e.path && e.isCarrierDesignate && !this.passCrossed); e.catching = Math.max(e.catching, 0.35);
    if (b.forward) { this.stats[this.possession].comp++; this.passCrossed = true; }
    this.emit('catch', e);
  }
  _deflect(b, e, kind) {
    const a = R(0, 6.283);
    if (kind === 'swat') { b.vx = b.vx * 0.25 + Math.cos(a) * R(1, 3); b.vz = b.vz * 0.25 + Math.sin(a) * R(1, 3); b.vy = R(-5, -2.5); }
    else if (kind === 'tip') { b.vx = b.vx * 0.3 + Math.cos(a) * R(1, 3.5); b.vz = b.vz * 0.3 + Math.sin(a) * R(1, 3.5); b.vy = R(2.5, 5); }
    else if (kind === 'muff') { b.vx = Math.cos(a) * R(1.5, 4); b.vz = Math.sin(a) * R(1.5, 4); b.vy = R(1, 3); }
    else { b.vx = b.vx * 0.25 + Math.cos(a) * R(0.3, 1.8); b.vz = b.vz * 0.25 + Math.sin(a) * R(0.3, 1.8); b.vy = R(-1.5, 1.4); }
    if (kind === 'drop') b.dropped = true; else b.tipped = true; b.deflections = (b.deflections || 0) + 1; this._rollDives(); b.spin = 'tumble'; b.spinRate = R(8, 16); b.pred = this._predict(b); b.predT = 0.12; b.target = null; if (kind === 'swat' || kind === 'tip') this.stats[e.team].tips++; this.emit('tip', { e, kind });
    for (const side of ['home', 'away']) for (const o of this.roster[side]) if (o.state === 'track' && o !== e) o.state = o.team === this.possession ? 'route' : 'pursue';
  }
  _puntCaught(e) { this.emit('puntcatchrun', e); for (const o of this.roster[this.possession]) if (o.active) o.state = 'pursue'; for (const d of this.roster[this.defense]) if (d.active && d !== e) d.state = 'block'; }
  _puntDead(z, text) {
    const b = this.ball; const recv = this.defense; const len = this.F.L - 2 * this.F.EZ; const spot = z === null ? this.ownYard(recv, Math.min(20, Math.round(len * 0.25))) : clamp(z, this.GLA + 1, this.GLB - 1);
    const dist = Math.round(Math.abs((z === null ? this.targetGoalZ(this.possession) : z) - this.los)); b.state = 'dead'; b.free = true; b.kick = null;
    this._endPlay({ type: 'punt', text: `PUNT ${dist} YDS · ${text}`, spot, turnover: true, clockStop: true, punt: true });
  }
  _fieldGoal(good) {
    const b = this.ball; const isPat = b.kick === 'pat'; b.state = 'dead'; b.free = true;
    if (good) { this.score[this.possession] += isPat ? 1 : 3; if (!isPat) this.stats[this.possession].fg++; this.emit(isPat ? 'patgood' : 'fggood'); this._endPlay({ type: 'score', text: isPat ? 'EXTRA POINT GOOD' : 'FIELD GOAL IS GOOD!', spot: this.los, score: true, clockStop: true, happy: this.possession, pat: isPat }); }
    else { this.emit('fgmiss'); this._endPlay({ type: isPat ? 'patmiss' : 'fgmiss', text: isPat ? 'EXTRA POINT MISSED' : 'NO GOOD', spot: this.los, turnover: !isPat, clockStop: true, kickMiss: true, pat: isPat }); }
    this.pendingKick = null;
  }

  // ---------- contact: separation, blocks, tackles ----------
  _separate() {
    const list = [...this.standing('home'), ...this.standing('away')];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], c = list[j]; const dx = c.x - a.x, dz = c.z - a.z; const d = Math.hypot(dx, dz); const minD = a.r + c.r; if (d >= minD || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d; const overlap = minD - d; const wa = c.mass / (a.mass + c.mass), wc = a.mass / (a.mass + c.mass);
      a.x -= nx * overlap * wa; a.z -= nz * overlap * wa; c.x += nx * overlap * wc; c.z += nz * overlap * wc;
      const vn = (c.vx - a.vx) * nx + (c.vz - a.vz) * nz; if (vn < 0) { a.vx += nx * vn * wa; a.vz += nz * vn * wa; c.vx -= nx * vn * wc; c.vz -= nz * vn * wc; }
    }
  }
  _contacts(dt) {
    const b = this.ball; const c = b.carrier;
    for (const side of ['home', 'away']) for (const o of this.standing(side)) {
      const blocking = o.state === 'block' || (o.state === 'route' && this.passCrossed && !o.hasBall && b.carrier && b.carrier.team === o.team);
      if (!blocking) continue;
      if (o.engaged) { o.engageT -= dt; if (o.engageT <= 0 || o.engaged.state === 'down') { o.engaged.engaged = null; o.engaged = null; o.cooldown = 0.45; } continue; }
      if (o.cooldown > 0) continue;
      for (const d of this.standing(o.team === 'home' ? 'away' : 'home')) {
        if (d.engaged || d === c || d.eff.dive > 0 || d.wrapOn) continue;
        if (Math.hypot(d.x - o.x, d.z - o.z) < o.r + d.r + 0.15) { const dur = 0.3 + rating(o, 'blk') * 1.1 - rating(d, 'str') * 0.6 + (this.trait(o) === 'wall' ? 0.35 : 0) + (this.trait(d) === 'iron' ? -0.25 : 0); o.engaged = d; d.engaged = o; o.engageT = clamp(dur, 0.25, 1.4); o.anim = 'block'; d.anim = 'block'; d.shedSide = null; this.emit('block', { o, d }); break; }
      }
    }
    if (!c || this.phase !== 'live' || b.state !== 'held') return;
    const cdir = this.dirOf(c.team); const goalZ = this.targetGoalZ(c.team);
    if ((c.z - goalZ) * cdir >= 0) return this._touchdown(c);
    if (Math.abs(c.x) > this.W2) { const isPasserBehind = (c.z - this.los) * this.dir < 0 && c.team === this.possession; return this._endPlay({ type: 'oob', text: 'OUT OF BOUNDS', spot: c.z, clockStop: true, gain: true, carrier: c, sack: isPasserBehind && !this.passCrossed && c.state !== 'carrier' }); }
    if (c.eff.drag > 0 || c.eff.dive > 0) return;
    for (const t of this.standing(c.team === 'home' ? 'away' : 'home')) {
      if (t.cooldown > 0 || t.engaged || t.wrapOn || t.jumpY > 0.3) continue;
      const dx = c.x - t.x, dz = c.z - t.z; const d = Math.hypot(dx, dz); const range = c.r + t.r + 0.12 + (t.eff.dive > 0 ? 0.65 : 0); if (d > range) continue;
      t.cooldown = 0.6; const [nx, nz] = norm(dx, dz); const closing = Math.max(0, (t.vx - c.vx) * nx + (t.vz - c.vz) * nz);
      const gang = this.standing(t.team).some(o => o !== t && Math.hypot(o.x - c.x, o.z - c.z) < 1.6);
      const cs = Math.hypot(c.vx, c.vz); const behind = cs > 1 ? ((t.x - c.x) * c.vx + (t.z - c.z) * c.vz) / (cs * (d || 1)) < -0.6 : false;
      let p = 0.62 - (behind ? 0.14 : 0) - (cs > 7.5 && closing < 2 ? 0.08 : 0) + (rating(t, 'tak') - (rating(c, 'str') * 0.5 + rating(c, 'agi') * 0.5)) * 0.6 + (t.eff.dive > 0 ? 0.08 : 0) - (c.eff.juke > 0 ? 0.38 : 0) - (c.eff.spin > 0 ? 0.32 : 0) + (this.trait(t) === 'iron' ? 0.1 : 0) - (this.trait(c) === 'phase' ? 0.14 : 0) + (c.stamina < 0.2 ? 0.1 : 0) + (closing > 6 ? 0.06 : 0) + (gang ? 0.15 : 0) + (t.isUser && !this.auto && t.eff.dive <= 0 ? 0.06 : 0) - (this.rules.slick ? 0.05 : 0);
      p = clamp(p, 0.3, 0.95);
      if (this.rules.vines && this.trait(t) === 'thief') c.eff.tangled = 1.0;
      if (Math.random() < p) {
        const pf = 0.025 + (this.trait(t) === 'hammer' ? 0.06 : 0) + (closing > 6 ? 0.03 : 0) - rating(c, 'awr') * 0.02 + (this.rules.slick ? 0.015 : 0) - (this.trait(c) === 'lucky' ? 0.02 : 0) + (c.catching > 0 ? 0.03 : 0);
        if (Math.random() < pf && (c.z - this.los) * cdir > -6) return this._fumble(c, t);
        const dragChance = 0.12 + (rating(c, 'str') - rating(t, 'str')) * 0.8 - (closing > 6 ? 0.2 : 0) - (gang ? 0.3 : 0);
        if (Math.random() < dragChance && (c.z - this.los) * cdir > -2) { c.eff.drag = R(0.35, 0.7); c.dragging = true; c.dragger = t; t.wrapOn = c; t.anim = 'block'; c.anim = 'stumble'; c.animOpts = { restart: true }; this.emit('wrap', { t, c }); return; }
        return this._tackleDown(c, t, closing);
      }
      t.eff.stumble = 0.9; t.anim = 'stumble'; t.animOpts = { restart: true }; t.cooldown = 1.0; c.eff.brokenSlow = 0.4;
      if (this.rules.stampede && this.trait(c) === 'wall') { t.vx -= nx * 7; t.vz -= nz * 7; t.eff.stumble = 1.3; }
      this.emit('broken', { t, c });
    }
  }
  _tackleDown(c, t, closing = 0) {
    if (this.phase !== 'live') return;
    let [nx, nz] = norm(c.vx + (t ? t.vx * 0.5 : 0), c.vz + (t ? t.vz * 0.5 : 0)); if (Math.hypot(c.vx, c.vz) + (t ? Math.hypot(t.vx, t.vz) : 0) < 0.3) { nx = Math.sin(c.facing); nz = Math.cos(c.facing); }
    const slide = 0.4 + Math.min(1.0, closing * 0.1);
    c.state = 'down'; c.timer = 1.4; c.anim = closing > 6 && Math.random() < 0.5 ? 'downback' : 'down'; c.animOpts = { restart: true }; c.vx = nx * slide * 3; c.vz = nz * slide * 3; c.eff.drag = 0; c.dragging = false; c.dragger = null;
    if (t) { t.state = 'down'; t.timer = 0.9; t.anim = 'tackle'; t.animOpts = { restart: true }; t.vx = nx * slide * 2.5; t.vz = nz * slide * 2.5; t.wrapOn = null; t.tackled = true; }
    const cdir = this.dirOf(c.team); const spot = clamp(c.z + nz * slide * 0.5, this.GLA + 0.3, this.GLB - 0.3);
    this.emit('tackle', { t, c, big: closing > 6.5 });
    const sack = c === this.passer && !this.passCrossed && c.team === this.possession && (c.z - this.los) * this.dir < 0 && this.offPlay.type !== 'run';
    if ((spot - this.ownGoalZ(c.team)) * cdir <= 0 && (c.z - this.ownGoalZ(c.team)) * cdir <= 0.2) return this._safety(c);
    this._endPlay({ type: sack ? 'sack' : 'tackle', text: sack ? 'SACK!' : null, spot, gain: true, carrier: c, sack, clockStop: false });
  }
  _fumble(c, t) {
    const b = this.ball; c.hasBall = false; Object.assign(b, { carrier: null, state: 'loose', looseT: 0, forward: false, lateral: false, kick: null, tipped: false, free: false, lastTeam: c.team, resting: false, bounces: 0, spin: 'tumble', spinRate: 10 });
    b.x = c.x; b.z = c.z; b.y = 1.2; b.vx = R(-4, 4); b.vz = R(-4, 4); b.vy = R(3, 6); this.stats[c.team].fumbles++; b.pred = this._predict(b);
    c.state = 'down'; c.timer = 1.1; c.anim = 'downback'; c.animOpts = { restart: true }; c.eff.drag = 0; c.dragging = false; if (t) { t.eff.stumble = 0.5; t.wrapOn = null; } this.passCrossed = true; this.emit('fumble', { c, t });
    for (const side of ['home', 'away']) for (const e of this.roster[side]) if (e.active && e.state !== 'down') e.state = 'pursue';
    if (!this.auto) this.setUser(null);
  }
  _touchdown(c) {
    const side = c.team; this.score[side] += 6; this.stats[side].tds++; const yards = Math.round(Math.abs(c.z - this.los)); this.stats[side].longest = Math.max(this.stats[side].longest, yards);
    let jackpot = false; if (this.rules.jackpot && side === this.userSide && Math.random() < 0.3) { jackpot = true; this.bonusCoins += 300; }
    this.emit('touchdown', { c, side, yards, defensive: side !== this.possession, jackpot }); this.possession = side;
    this._endPlay({ type: 'td', text: 'TOUCHDOWN!', spot: this.targetGoalZ(side), score: true, td: true, clockStop: true, happy: side, yards, jackpot });
  }
  _safety(c) { const defSide = c.team === 'home' ? 'away' : 'home'; this.score[defSide] += 2; this.emit('safety', defSide); this._endPlay({ type: 'safety', text: 'SAFETY!', spot: this.ownYard(defSide, 10), safety: true, scoredBy: defSide, clockStop: true, happy: defSide }); }

  // ---------- hazards ----------
  _hazardAt(e, type) { for (const h of this.rules.hazards) if ((!type || h.type === type) && Math.hypot(h.x - e.x, h.z - e.z) < h.r) return h; return null; }
  _hazardTraction(e) { const h = this._hazardAt(e); return h && (h.type === 'ice' || h.type === 'grease') ? 0.18 : 1; }
  _hazardEffects(dt) {
    if (!this.rules.hazards.length) return;
    for (const side of ['home', 'away']) for (const e of this.standing(side)) {
      if (e.eff.hazardCd > 0 || e.jumpY > 0.3) continue; const h = this._hazardAt(e); if (!h) continue;
      if (h.type === 'lava') { e.eff.stumble = 0.8; e.eff.burn = 1.5; e.stamina = Math.max(0, e.stamina - 0.2); e.eff.hazardCd = 2; const [nx, nz] = norm(e.x - h.x, e.z - h.z); e.vx += nx * 3; e.vz += nz * 3; e.anim = 'stumble'; e.animOpts = { restart: true }; this.emit('hazard', { e, h }); if (e.hasBall && this.ball.state === 'held' && Math.random() < 0.12) this._fumble(e, null); }
      else if (h.type === 'holes' || h.type === 'junk') { if (e.speed > 3) { e.eff.stumble = 1.0; e.vx *= 0.3; e.vz *= 0.3; e.eff.hazardCd = 2.5; e.anim = 'stumble'; e.animOpts = { restart: true }; this.emit('hazard', { e, h }); } }
      else if (h.type === 'steam' && h.active) { e.jumpV = 4 * this.rules.jump; e.jumpY = 0.001; e.eff.stumble = 0.6; e.eff.hazardCd = 3; this.emit('hazard', { e, h }); }
    }
  }

  // ---------- play end, downs, clock ----------
  _endPlay(r) {
    if (this.phase !== 'live' && this.phase !== 'kickmeter') return; this.phase = 'dead'; this.deadTimer = r.type === 'td' ? 3.2 : 2.1; this.result = r; this.lastResult = r; this.clockRunning = false;
    const b = this.ball; if (b.state === 'air' || b.state === 'loose') { b.state = 'dead'; b.free = true; }
    if (r.gain && r.carrier) { const gained = Math.round((r.spot - this.los) * this.dir); r.yards = gained; if (r.carrier.team === this.possession) { const st = this.stats[this.possession]; st.yards += gained; if (this.forwardPassUsed && this.passCrossed) st.passYds += gained; else st.rushYds += gained; st.longest = Math.max(st.longest, gained); if (!r.text) r.text = gained > 0 ? `+${gained} YARDS` : gained === 0 ? 'NO GAIN' : `${gained} YARDS`; } else { r.turnover = true; r.text = r.text || 'TURNOVER'; } }
    if (this.laterals > 0 && r.type !== 'incomplete') r.lateral = true;
    for (const side of ['home', 'away']) for (const e of this.roster[side]) { if (e.wrapOn) e.wrapOn = null; e.dragging = false; e.eff.drag = 0; }
    if (this.hooks.onPlayEnd) this.hooks.onPlayEnd(r, this);
    this.emit('playend', r);
    if (!this.auto) this.setUser(null);
  }
  _advance() {
    const r = this.result; if (!r) { this.phase = 'playcall'; return; }
    if (this.mode === 'practice') { if (this.practicePossession) this.possession = this.practicePossession; else if (r.td || r.turnover || r.type === 'punt') this.possession = this.userSide; this.newSeries(this.practiceSpot !== undefined ? this.practiceSpot : this.los); this.phase = 'playcall'; this.result = null; if (this.hooks.afterAdvance) this.hooks.afterAdvance(this); return; }
    if (!r.clockStop && this.mode === 'game' && this.clock > 0) this.clock = Math.max(0, this.clock - 12);
    if (this.pendingTwo) { this.pendingTwo = false; if (r.td) { this.score[this.possession] -= 6; this.score[this.possession] += 2; r.text = 'TWO-POINT CONVERSION!'; this.emit('twogood'); } else this.emit('twofail'); this._afterScore(); return; }
    if (r.pat) { this._afterScore(); return; }
    if (r.td) { const scorer = r.happy; this.possession = scorer; if (this.hooks.noPAT || this.mode !== 'game') { this._afterScore(); return; } this.pat = { side: scorer }; this.phase = 'pat'; this.emit('pat', scorer); return; }
    if (r.type === 'score') { this._afterScore(); return; }
    if (r.safety) { this.possession = r.scoredBy; this.newSeries(this.ownYard(this.possession, 10)); this._checkClock(); return; }
    if (r.type === 'punt') { this.possession = this.defense; this.newSeries(r.spot); this._checkClock(); return; }
    if (r.type === 'fgmiss') { this.possession = this.defense; this.newSeries(this.los); this._checkClock(); return; }
    if (r.turnover) { this.possession = this.defense; this.newSeries(clamp(r.spot, this.GLA + 1, this.GLB - 1)); this.emit('turnover'); this._checkClock(); return; }
    const spot = r.type === 'incomplete' || r.type === 'drop' ? this.los : clamp(r.spot, this.GLA + 0.5, this.GLB - 0.5);
    if ((spot - this.firstDownZ) * this.dir >= 0) { this.stats[this.possession].firstDowns++; this.newSeries(spot); this.emit('firstdown'); }
    else { this.los = spot; this.down++; this.toGo = Math.max(0.5, (this.firstDownZ - this.los) * this.dir); if (this.down > 4) { this.possession = this.defense; this.newSeries(this.los); this.emit('downs'); } }
    this._checkClock();
  }
  _afterScore() { const other = this.possession === 'home' ? 'away' : 'home'; this.possession = other; this.newSeries(this.ownYard(other, 10)); this.ball.kick = null; this.pendingKick = null; this._checkClock(true); }
  _checkClock() {
    this.result = null;
    if (this.mode !== 'game') { this.phase = 'playcall'; return; }
    if (this.overtime && this.score.home !== this.score.away) { this._finish(); return; }
    if (this.clock <= 0) {
      if (this.quarter === 2) { this.quarter = 3; this.clock = this.quarterLen; this.dirHome = -this.dirHome; this.possession = this.openingReceiver === 'home' ? 'away' : 'home'; this.newSeries(this.ownYard(this.possession, 10)); this.emit('halftime'); this.phase = 'playcall'; return; }
      if (this.quarter === 4 || this.overtime) { if (this.score.home === this.score.away && !this.overtime) { this.overtime = true; this.quarter = 'OT'; this.clock = 120; this.possession = Math.random() < 0.5 ? 'home' : 'away'; this.newSeries(this.ownYard(this.possession, 10)); this.emit('overtime'); this.phase = 'playcall'; return; } if (this.overtime && this.score.home === this.score.away) { this.clock = 120; this.phase = 'playcall'; return; } this._finish(); return; }
      this.quarter++; this.clock = this.quarterLen; this.dirHome = -this.dirHome; this.emit('quarter', this.quarter);
    }
    this.phase = 'playcall';
  }
  _finish() { this.final = true; this.phase = 'final'; this.emit('final', { home: this.score.home, away: this.score.away, winner: this.score.home > this.score.away ? 'home' : 'away' }); }
  forceEnd() { this._finish(); }
}
