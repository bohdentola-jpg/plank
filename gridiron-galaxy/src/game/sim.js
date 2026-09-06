// The 5v5 football simulation. Pure game logic: no rendering. World units are yards.
// Field: x across [-15, 15], z along [0, 70]; goal lines at z=10 and z=60. `dir` is the direction the offense attacks.
import { FIELD } from '../gfx/textures.js';
import { resolvePlay, DEF_PLAYS, ZONES, BASE_PLAYS, getPlanetPlays } from '../data/plays.js';
import { OFFENSE_ROLES, DEFENSE_ROLES, DIFFICULTY } from '../data/roster.js';
import { clamp, lerp } from '../util.js';

const W2 = FIELD.W / 2, GL_A = FIELD.EZ, GL_B = FIELD.L - FIELD.EZ;
const R = (a, b) => a + Math.random() * (b - a);
const rating = (e, k) => (e.p.r[k] || 50) / 99;

export class Sim {
  constructor(opts) {
    this.home = opts.home; this.away = opts.away; this.userSide = opts.userSide || 'home';
    this.auto = !!opts.auto; this.settings = opts.settings; this.diff = DIFFICULTY[opts.settings.difficulty] || DIFFICULTY.normal;
    this.quirks = opts.quirks || []; this.mode = opts.mode || 'game';
    this.gravity = 10.7 * (this.quirks.includes('lowgrav') ? 0.62 : this.quirks.includes('highgrav') ? 1.3 : 1);
    this.userPlays = opts.userPlays || BASE_PLAYS; this.cpuPlays = opts.cpuPlays || BASE_PLAYS;
    this.emit = opts.onEvent || (() => {}); this.hooks = opts.hooks || {};
    this.time = 0; this.speedScale = 1;
    this.roster = { home: this._makeEnts(this.home, 'home'), away: this._makeEnts(this.away, 'away') };
    this.reset(opts.start || {});
  }
  _makeEnts(team, side) {
    return team.players.map(p => ({ p, team: side, role: p.role, x: 0, z: 0, vx: 0, vz: 0, facing: 0, speed: 0, state: 'idle', stamina: 1, timer: 0, active: false, isUser: false, hasBall: false, anim: 'idle', animOpts: null, eff: {}, engaged: null, cooldown: 0, react: 0, target: null, id: p.id, getup: 0 }));
  }
  reset(start = {}) {
    const q = this.settings.quarterLen * 60;
    this.score = { home: 0, away: 0 }; this.quarter = start.quarter || 1; this.clock = start.clock !== undefined ? start.clock : q; this.quarterLen = q;
    this.dirHome = 1; this.possession = start.possession || 'home'; this.openingReceiver = this.possession;
    this.overtime = false; this.final = false; this.pat = null; this.playNumber = 0;
    this.stats = { home: this._stats(), away: this._stats() };
    this.newSeries(start.los !== undefined ? start.los : this.ownYard(this.possession, 10));
    this.phase = 'playcall'; this.deadTimer = 0; this.result = null; this.lastResult = null;
    this.ball = { x: 0, y: 1, z: this.los, vx: 0, vy: 0, vz: 0, state: 'held', carrier: null, forward: false, target: null, thrower: null, kick: null, spin: 0, looseT: 0, lastTeam: null };
    for (const side of ['home', 'away']) for (const e of this.roster[side]) { e.active = false; e.state = 'idle'; e.hasBall = false; e.isUser = false; }
  }
  _stats() { return { yards: 0, passYds: 0, rushYds: 0, comp: 0, att: 0, tds: 0, ints: 0, sacks: 0, fumbles: 0, laterals: 0, plays: 0, longest: 0, firstDowns: 0, fg: 0, fga: 0 }; }
  get dir() { return this.possession === 'home' ? this.dirHome : -this.dirHome; }
  get defense() { return this.possession === 'home' ? 'away' : 'home'; }
  dirOf(side) { return side === 'home' ? this.dirHome : -this.dirHome; }
  ownGoalZ(side) { return this.dirOf(side) > 0 ? GL_A : GL_B; }        // the goal line a side defends
  targetGoalZ(side) { return this.dirOf(side) > 0 ? GL_B : GL_A; }     // the goal line a side attacks
  ownYard(side, yards) { return this.ownGoalZ(side) + this.dirOf(side) * yards; }
  yardsToGoal(z = this.los, side = this.possession) { return Math.round((this.targetGoalZ(side) - z) * this.dirOf(side)); }
  spotText(z = this.los) { const ytg = this.yardsToGoal(z); const own = 50 - ytg; return ytg === 25 ? 'the 25' : own <= 25 ? `own ${own}` : `opp ${ytg}`; }
  userOnOffense() { return this.possession === this.userSide; }
  newSeries(z) { this.los = clamp(z, GL_A + 0.5, GL_B - 0.5); this.down = 1; const ytg = this.yardsToGoal(this.los); this.toGo = Math.min(10, ytg); this.firstDownZ = this.los + this.dir * this.toGo; }
  downText() { const ytg = this.yardsToGoal(); const g = this.toGo >= ytg - 0.01; return `${['1ST', '2ND', '3RD', '4TH'][this.down - 1]} & ${g ? 'GOAL' : Math.max(1, Math.ceil(this.toGo))}`; }
  teamOf(side) { return side === 'home' ? this.home : this.away; }
  // play-space (x: offense's left negative, z: downfield) -> world
  toWorld(px, pz, dir = this.dir, los = this.los) { return { x: -px * dir, z: los + pz * dir }; }

  // ---------- play calling ----------
  forcedPlay(playbook) { if (this.pendingKick === 'pat') return playbook.find(p => p.type === 'fg') || BASE_PLAYS.find(p => p.type === 'fg'); return null; }
  cpuOffCall(playbook = this.cpuPlays) {
    const ytg = this.yardsToGoal(), d = this.down, tg = this.toGo, side = this.possession;
    const trailing = this.score[side] < this.score[this.defense]; const late = this.quarter >= 4 && this.clock < 150;
    const kicker = this.roster[side].find(e => e.role === 'QB'); const vk = 17 + rating(kicker, 'kik') * 9.5; const fgMax = (vk * vk * Math.sin(1.32) / this.gravity) * 0.8 - 7;
    const pick = (cat) => { const arr = playbook.filter(p => p.cat === cat); return arr[Math.floor(Math.random() * arr.length)]; };
    if (this.hooks.cpuForcePlay) { const f = this.hooks.cpuForcePlay(this, playbook); if (f) return f; }
    if (d === 4) {
      if (ytg + 17 <= fgMax && (tg > 1.5 || late)) return playbook.find(p => p.type === 'fg') || pick('short');
      if (ytg > 28 && !(late && trailing) && this.mode === 'game') return playbook.find(p => p.type === 'punt') || pick('short');
      return tg <= 2 ? pick('run') : pick('short');
    }
    const r = Math.random();
    if (this.hooks.cpuBias === 'pass' || (late && trailing)) return r < 0.5 ? pick('mid') : r < 0.8 ? pick('deep') : pick('short');
    if (this.hooks.cpuBias === 'run') return pick('run');
    if (r < 0.08) { const specials = playbook.filter(p => (p.cat === 'special' || p.cat === 'planet') && p.type !== 'punt' && p.type !== 'fg'); if (specials.length) return specials[Math.floor(Math.random() * specials.length)]; }
    if (tg <= 3 && r < 0.6) return pick('run');
    if (tg > 12) return r < 0.5 ? pick('deep') : pick('mid');
    if (d === 1) return r < 0.42 ? pick('run') : r < 0.75 ? pick('mid') : r < 0.9 ? pick('short') : pick('deep');
    return r < 0.3 ? pick('run') : r < 0.6 ? pick('short') : r < 0.85 ? pick('mid') : pick('deep');
  }
  cpuDefCall(offPlay) {
    const tg = this.toGo, d = this.down; const r = Math.random();
    if (offPlay && (offPlay.type === 'punt' || offPlay.type === 'fg')) return DEF_PLAYS.find(p => p.id === 'blitz');
    if (d >= 3 && tg > 8) return r < 0.5 ? DEF_PLAYS.find(p => p.id === 'thirds') : DEF_PLAYS.find(p => p.id === 'prevent');
    if (tg <= 2) return r < 0.5 ? DEF_PLAYS.find(p => p.id === 'blitz') : DEF_PLAYS.find(p => p.id === 'man');
    const ids = ['man', 'zone', 'thirds', 'blitz', 'zone']; return DEF_PLAYS.find(p => p.id === ids[Math.floor(r * ids.length)]);
  }
  // ---------- setup ----------
  callPlay(offPlay, defPlay) {
    this.offPlay = offPlay; this.defPlay = defPlay || this.cpuDefCall(offPlay); this.playNumber++;
    const off = this.roster[this.possession], def = this.roster[this.defense];
    for (const side of ['home', 'away']) for (const e of this.roster[side]) { e.active = false; e.isUser = false; e.hasBall = false; e.engaged = null; e.state = 'bench'; e.eff = {}; e.timer = 0; e.cooldown = 0; e.pathIdx = 0; e.routeIdx = 0; e.anim = 'idle'; }
    const res = resolvePlay(offPlay); this.res = res; this.eligibles = [];
    for (const role of OFFENSE_ROLES) {
      const e = off.find(o => o.role === role); const r = res[role]; e.active = true;
      const w = this.toWorld(r.start[0], r.start[1]); e.x = w.x; e.z = w.z; e.vx = e.vz = 0; e.facing = this.dir > 0 ? 0 : Math.PI;
      e.route = r.pts.map(([px, pz]) => this.toWorld(px, pz)); e.settle = r.settle; e.routeDelay = r.delay; e.isBlocker = r.block; e.path = r.path ? r.path.map(([px, pz]) => this.toWorld(px, pz)) : null;
      e.isSnapper = r.snap; e.isCarrierDesignate = r.isCarrier; e.px = r.start[0]; e.pz = r.start[1];
      e.state = role === 'C' ? 'snapset' : 'set'; e.anim = role === 'C' ? 'snapset' : (e.isSnapper ? 'qbset' : 'set');
      if (!e.isSnapper) this.eligibles.push(e);
    }
    this.eligibles.sort((a, b) => a.px - b.px); this.eligibles.forEach((e, i) => { e.glyph = i; });
    this.passer = off.find(e => e.isSnapper); this.qb = off.find(e => e.role === 'QB');
    if (this.noDefense) { for (const role of DEFENSE_ROLES) { const e = def.find(o => o.role === role); e.active = false; } }
    else this._alignDefense(def, this.defPlay);
    this.phase = 'presnap'; this.playT = 0; this.snapT = this.userOnOffense() && !this.auto ? Infinity : R(1.4, 2.6);
    this.forwardPassUsed = false; this.passCrossed = false; this.laterals = 0; this.result = null; this.script = this._buildScript(offPlay);
    Object.assign(this.ball, { state: 'held', carrier: null, x: 0, z: this.los, y: 0.3, kick: null, forward: false, lateral: false, fgResolved: false, dropped: false, landing: null, target: null, thrower: null, airT: 0, looseT: 0, vx: 0, vy: 0, vz: 0 });
    const c = off.find(e => e.role === 'C'); this.ballHolderPre = c;
    this.userEnt = null; this._pickUserEnt();
    this.wind = this.quirks.includes('wind') ? { x: R(-3.5, 3.5), z: R(-2, 2) } : { x: 0, z: 0 };
    this.emit('playset', { offPlay, defPlay: this.defPlay });
  }
  _alignDefense(def, defPlay) {
    const off = this.roster[this.possession];
    for (const role of DEFENSE_ROLES) {
      const e = def.find(o => o.role === role); e.active = true; const asg = (defPlay.cover[role] || 'zone:hook').split(':'); e.asg = asg[0]; e.asgArg = asg[1];
      let px = 0, pz = 5;
      const strong = (off.find(o => o.role === 'RB') || {}).px > 0 ? 1 : -1;
      if (e.asg === 'rush') { px = role === 'LB' ? -strong * 2.5 : strong * 1.6; pz = 1.2; }
      else if (e.asg === 'spy') { px = 0; pz = 5; }
      else if (e.asg === 'man') { const t = off.find(o => o.role === e.asgArg); e.manTarget = t; px = t ? t.px + Math.sign(t.px || 1) * 0.6 : 0; pz = t ? Math.max(1.5, t.pz + (t.pz < -2 ? 7 : 4.5)) : 5; }
      else { const zc = ZONES[e.asgArg] || ZONES.hook; e.zone = zc; px = zc[0]; pz = zc[1] * 0.6 + 1.5; }
      if (this.offPlay.type === 'punt' && e.role === 'S') { px = 0; pz = 34; e.asg = 'returner'; }
      if (this.offPlay.type === 'fg') { e.asg = e.role === 'S' ? 'spy' : 'rush'; pz = e.asg === 'rush' ? 1.2 : 8; px = e.role === 'R' ? 1.5 : e.role === 'LB' ? -1.5 : e.role === 'CB1' ? -4 : 4; }
      const w = this.toWorld(px, pz); e.x = clamp(w.x, -W2 + 0.5, W2 - 0.5); e.z = w.z; e.vx = e.vz = 0; e.facing = this.dir > 0 ? Math.PI : 0; e.state = 'read'; e.anim = 'set'; e.rushDelay = defPlay.id === 'blitz' ? 0.2 : this.offPlay.type === 'fg' || this.offPlay.type === 'punt' ? 0.5 : R(0.7, 1.1);
    }
  }
  _pickUserEnt() {
    if (this.auto) return;
    const side = this.userSide;
    if (this.userOnOffense()) { this.setUser(this.passer); }
    else { const def = this.roster[side].filter(e => e.active); const pref = def.find(e => e.role === 'LB') || def.find(e => e.role === 'S') || def[0]; if (pref) this.setUser(pref); }
  }
  setUser(e) { for (const s of ['home', 'away']) for (const o of this.roster[s]) o.isUser = false; if (e) { e.isUser = true; this.userEnt = e; } else this.userEnt = null; }
  switchDefender() {
    if (this.userOnOffense()) return; const def = this.roster[this.userSide].filter(e => e.active && e.state !== 'down' && e !== this.userEnt);
    if (!def.length) return; const bx = this.ball.carrier ? this.ball.carrier.x : this.ball.x, bz = this.ball.carrier ? this.ball.carrier.z : this.ball.z;
    def.sort((a, b) => Math.hypot(a.x - bx, a.z - bz) - Math.hypot(b.x - bx, b.z - bz)); this.setUser(def[0]); this.emit('switch', def[0]);
  }
  _buildScript(play) {
    const t = play.trick; const s = [];
    if (play.type === 'run' && !t) s.push({ t: 0.05, fn: () => this._beginHandoff(play.carrier, play.delay || 0) });
    if (t === 'fleaflicker') { s.push({ t: 0.05, fn: () => this._beginHandoff('RB', 0) }); s.push({ t: 1.35, fn: () => { const rb = this._role('RB'), qb = this._role('QB'); if (this.ball.carrier === rb && rb.state === 'carrier') this._lateral(rb, qb, true); } }); }
    if (t === 'hbpass') s.push({ t: 0.05, fn: () => this._beginHandoff('RB', 0, true) });
    if (t === 'pitch') s.push({ t: 0.05, fn: () => this._beginHandoff('RB', 0, true) });
    if (t === 'reverse') { s.push({ t: 0.05, fn: () => this._beginHandoff('RB', 0) }); s.push({ t: 0.3, fn: () => { const z = this._role('Z'); z.state = 'reverse'; } }); }
    if (t === 'wildcat') s.push({ t: 0.0, fn: () => { /* RB already snaps; QB runs route */ } });
    if (t === 'statue') { s.push({ t: 0.35, fn: () => { const qb = this._role('QB'); qb.anim = 'throw'; qb.fake = 0.45; } }); s.push({ t: 0.85, fn: () => this._beginHandoff('RB', 0) }); }
    if (t === 'jet') s.push({ t: 0.0, fn: () => { const z = this._role('Z'); z.state = 'jet'; } });
    if (t === 'option') s.push({ t: 0.05, fn: () => { const qb = this._role('QB'); qb.state = 'carrier'; qb.followPath = true; const rb = this._role('RB'); rb.state = 'trail'; this._giveBall(qb); if (!this.auto && this.userOnOffense()) this.setUser(qb); } });
    if (t === 'playaction') { s.push({ t: 0.1, fn: () => { const rb = this._role('RB'); rb.state = 'fakerun'; this.paBite = 0.8; } }); }
    if (t === 'doublepass') s.push({ t: 0.45, fn: () => { const qb = this._role('QB'), x = this._role('X'); if (this.ball.carrier === qb) this._lateral(qb, x, true); } });
    if (t === 'hookladder') s.push({ t: 0.1, fn: () => { const rb = this._role('RB'); rb.state = 'trail'; rb.trailTarget = this._role('X'); } });
    if (play.type === 'punt') s.push({ t: 0.05, fn: () => { this.kickMode = 'punt'; this.phase = 'kickmeter'; this.meter = { t: 0, val: 0.5 }; this._giveBall(this.passer); } });
    if (play.type === 'fg') s.push({ t: 0.05, fn: () => { this.kickMode = 'fg'; this.phase = 'kickmeter'; this.meter = { t: 0, val: 0.5 }; this._giveBall(this.passer); } });
    if (play.type === 'run' && play.carrier === 'QB' && !t) { s.length = 0; s.push({ t: 0.05, fn: () => { const qb = this._role('QB'); qb.state = 'carrier'; qb.followPath = true; } }); }
    return s;
  }
  _role(role) { return this.roster[this.possession].find(e => e.role === role); }
  _beginHandoff(role, delay, pitch = false) { const c = this._role(role); if (!c) return; c.state = 'mesh'; c.meshDelay = delay; c.pitch = pitch; this.handoffPending = c; }

  // ---------- snap & live ----------
  snap() {
    if (this.phase !== 'presnap') return; this.phase = 'live'; this.playT = 0; this.clockRunning = this.mode === 'game';
    const off = this.roster[this.possession].filter(e => e.active), def = this.roster[this.defense].filter(e => e.active);
    this._giveBall(this.passer); this.passer.state = this.passer.isCarrierDesignate && this.offPlay.type === 'run' ? 'carrier' : 'qb'; this.passer.dropT = 0;
    if (this.passer.state === 'carrier') this.passer.followPath = true;
    for (const e of off) { if (e === this.passer) continue; if (e.isBlocker) e.state = 'block'; else if (e.route.length) { e.state = 'route'; e.routeIdx = 0; e.routeT = -e.routeDelay; } else if (e.isCarrierDesignate) e.state = 'mesh'; else e.state = 'block'; }
    for (const e of def) { e.state = 'read'; e.timer = 0; }
    this.emit('snap'); this.stats[this.possession].plays++;
    if (this.hooks.onSnap) this.hooks.onSnap(this);
  }
  _giveBall(e) { if (this.ball.carrier) this.ball.carrier.hasBall = false; this.ball.carrier = e; this.ball.state = 'held'; e.hasBall = true; this.ball.lastTeam = e.team; if (!this.auto && e.team === this.userSide && this.userOnOffense()) this.setUser(e); }

  // user actions (called by the match screen)
  actSnap() { if (this.phase === 'presnap') this.snap(); }
  actThrow(glyphIndex, power) { const t = this.eligibles.find(e => e.glyph === glyphIndex); const passer = this.ball.carrier; if (!t || !passer || passer.team !== this.possession || this.phase !== 'live') return false; if (t === passer) return false; return this._throw(passer, t, power); }
  actLateral() { const c = this.ball.carrier; if (!c || this.phase !== 'live' || c.state !== 'carrier' && c.state !== 'qb') return false; const t = this.lateralTarget(c); if (!t) return false; this._lateral(c, t, false); return true; }
  lateralTarget(c) {
    const mates = this.roster[c.team].filter(e => e.active && e !== c && e.state !== 'down' && (e.z - c.z) * this.dirOf(c.team) < -0.3);
    if (!mates.length) return null; mates.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z)); return Math.hypot(mates[0].x - c.x, mates[0].z - c.z) < 14 ? mates[0] : null;
  }
  actJuke(dirX) { const c = this.ball.carrier; if (!c || c.state !== 'carrier' || c.eff.juke > 0 || c.eff.spin > 0) return; c.eff.juke = 0.4; c.eff.jukeDir = dirX || (Math.random() < 0.5 ? -1 : 1); c.anim = 'juke'; c.animOpts = { dir: c.eff.jukeDir, restart: true }; c.stamina = Math.max(0, c.stamina - 0.08); this.emit('juke', c); }
  actSpin() { const c = this.ball.carrier; if (!c || c.state !== 'carrier' || c.eff.spin > 0 || c.eff.juke > 0) return; c.eff.spin = 0.5; c.anim = 'spin'; c.animOpts = { restart: true }; c.stamina = Math.max(0, c.stamina - 0.1); this.emit('juke', c); }
  actDive() {
    const u = this.userEnt; if (!u || this.phase !== 'live' || u.state === 'down' || u.eff.dive > 0) return;
    const sp = Math.hypot(u.vx, u.vz); let dx = u.vx, dz = u.vz; if (sp < 0.5) { dx = Math.sin(u.facing); dz = Math.cos(u.facing); } else { dx /= sp; dz /= sp; }
    u.eff.dive = 0.45; u.vx = dx * 9; u.vz = dz * 9; u.anim = 'dive'; u.animOpts = { restart: true }; this.emit('dive', u);
  }
  actSwat() { const u = this.userEnt; if (!u || this.ball.state !== 'air' || u.eff.jump > 0) return; u.eff.jump = 0.5; u.anim = 'catch'; u.animOpts = { high: true, restart: true }; }
  actKick(val) { if (this.phase !== 'kickmeter') return; this._doKick(val); }
  actPAT(choice) { if (!this.pat) return; if (choice === 'kick') { this.pat = null; this.pendingKick = 'pat'; this.newSeriesForPat(); this.emit('patchoice', 'kick'); } else { this.pat = null; this.pendingTwo = true; this.newSeriesForPat(); this.emit('patchoice', 'two'); } }
  newSeriesForPat() { const z = this.targetGoalZ(this.possession) - this.dir * (this.pendingTwo ? 5 : 3); this.los = z; this.down = 1; this.toGo = this.yardsToGoal(); this.firstDownZ = this.targetGoalZ(this.possession); this.phase = 'playcall'; }

  _throw(passer, target, power = 0.5) {
    const beyond = (passer.z - this.los) * this.dir > 0.3;
    if (beyond || this.forwardPassUsed) { this.emit('noPass', beyond ? 'PAST THE LINE' : 'ALREADY THREW'); return false; }
    passer.action = { type: 'throw', t: 0, target, power, release: 0.22 }; passer.anim = 'throw'; passer.animOpts = { restart: true }; passer.state = 'throwing';
    this.emit('windup', passer); return true;
  }
  _releasePass(passer, a) {
    const t = a.target; const thp = rating(passer, 'thp'), tha = rating(passer, 'tha');
    // lead the receiver: predict where they'll be
    const dist = Math.hypot(t.x - passer.x, t.z - passer.z);
    const spd = 17 + thp * 15; let T = clamp(0.45 + dist / spd, 0.45, 2.3); if (a.power < 0.5) T *= 1.25 + (0.5 - a.power) * 0.5; // lob hangs
    if (this.quirks.includes('dense')) T *= 1.15;
    const lead = clamp(T * 0.9, 0, 1.6); let tx = t.x + t.vx * lead, tz = t.z + t.vz * lead;
    // if the receiver is settled (curl), aim at them; sideline safety
    tx = clamp(tx, -W2 + 0.8, W2 - 0.8);
    // accuracy error
    const pressure = this.roster[this.defense].some(d => d.active && Math.hypot(d.x - passer.x, d.z - passer.z) < 2.6);
    const moving = Math.hypot(passer.vx, passer.vz) > 3;
    const err = (1.05 - tha) * dist * 0.075 * (pressure ? 1.7 : 1) * (moving ? 1.4 : 1) * (a.power > 0.75 ? 0.8 : 1.1);
    const ea = Math.random() * Math.PI * 2, er = Math.random() * err; tx += Math.cos(ea) * er; tz += Math.sin(ea) * er;
    const b = this.ball; b.state = 'air'; b.carrier = null; passer.hasBall = false; b.thrower = passer; b.target = t; b.forward = true; b.airT = 0; b.flightT = T;
    b.x = passer.x + Math.sin(passer.facing) * 0.4; b.z = passer.z + Math.cos(passer.facing) * 0.4; b.y = 1.9;
    const dy = 1.4 - b.y; b.vx = (tx - b.x) / T; b.vz = (tz - b.z) / T; b.vy = (dy + 0.5 * this.gravity * T * T) / T; b.landing = { x: tx, z: tz, t: T }; b.bullet = a.power > 0.6;
    this.forwardPassUsed = true; this.stats[this.possession].att++; passer.state = 'qb'; passer.threw = true;
    // everyone reacts
    t.state = 'catchrun'; t.catchTarget = { x: tx, z: tz };
    this.emit('throw', { passer, target: t, T });
    if (!this.auto && passer.team === this.userSide) this.setUser(null);
  }
  _lateral(from, to, scripted) {
    const b = this.ball; const dist = Math.hypot(to.x - from.x, to.z - from.z); const T = clamp(0.25 + dist / 22, 0.25, 0.9);
    b.state = 'air'; b.carrier = null; from.hasBall = false; b.thrower = from; b.target = to; b.forward = false; b.airT = 0; b.flightT = T; b.lateral = true;
    b.x = from.x; b.z = from.z; b.y = 1.3; const lead = T * 0.8; const tx = to.x + to.vx * lead, tz = to.z + to.vz * lead;
    b.vx = (tx - b.x) / T; b.vz = (tz - b.z) / T; b.vy = (1.2 - b.y + 0.5 * this.gravity * T * T) / T; b.landing = { x: tx, z: tz, t: T }; b.bullet = false;
    from.state = from.state === 'qb' ? 'qb' : 'route'; from.anim = 'throw'; from.animOpts = { restart: true }; from.lateralAnim = 0.3;
    to.state = 'catchrun'; to.catchTarget = { x: tx, z: tz }; this.laterals++; this.stats[from.team].laterals++;
    this.emit('lateral', { from, to, scripted }); if (!this.auto && from.team === this.userSide) this.setUser(null);
  }
  _doKick(val) {
    const k = this.passer; const kik = rating(k, 'kik'); const acc = 1 - Math.abs(val - 0.5) * 2; // 1 = perfect
    const b = this.ball; b.state = 'air'; b.carrier = null; k.hasBall = false; b.forward = false; b.lateral = false; b.thrower = k; b.target = null; b.airT = 0; b.fgResolved = false; b.dropped = false; b.bounces = 0;
    b.x = k.x; b.z = k.z; b.y = 1.0; k.anim = 'kick'; k.animOpts = { restart: true }; this.phase = 'live'; this.playT = 0;
    const g = this.gravity;
    if (this.kickMode === 'punt') {
      const v = 15.5 + kik * 8 + acc * 3 + R(-1, 1), ang = 0.9 + R(-0.05, 0.05); const err = (val - 0.5) * 2 * (0.12 + (1 - kik) * 0.15) + R(-0.04, 0.04);
      b.vy = v * Math.sin(ang); const vh = v * Math.cos(ang); b.vz = vh * Math.cos(err) * this.dir; b.vx = vh * Math.sin(err) * -this.dir;
      const T = (b.vy + Math.sqrt(b.vy * b.vy + 2 * g * b.y)) / g; b.kick = 'punt'; b.flightT = T; b.landing = { x: clamp(b.x + b.vx * T, -W2, W2), z: b.z + b.vz * T, t: T };
      for (const e of this.roster[this.possession]) if (e.active) e.state = 'cover';
      for (const e of this.roster[this.defense]) if (e.active) e.state = e.asg === 'returner' ? 'returner' : 'pursue';
      const ret = this.roster[this.defense].find(e => e.asg === 'returner'); if (ret) { ret.catchTarget = { x: b.landing.x, z: b.landing.z }; if (!this.auto && ret.team === this.userSide) this.setUser(ret); }
      this.emit('kick', 'punt');
    } else {
      const goalZ = this.targetGoalZ(this.possession) + this.dir * FIELD.EZ;
      const v = 17 + kik * 9.5 + R(-0.6, 0.6), ang = 0.66 + R(-0.03, 0.03); const err = (val - 0.5) * 2 * (0.13 + (1 - kik) * 0.14) + R(-0.015, 0.015);
      b.vy = v * Math.sin(ang); const vh = v * Math.cos(ang); b.vz = vh * Math.cos(err) * this.dir; b.vx = vh * Math.sin(err) * -this.dir;
      const T = (b.vy + Math.sqrt(b.vy * b.vy + 2 * g * b.y)) / g; b.kick = this.pendingKick === 'pat' ? 'pat' : 'fg'; b.goalZ = goalZ; b.flightT = T; b.landing = { x: b.x + b.vx * T, z: b.z + b.vz * T, t: T };
      for (const e of this.roster[this.defense]) if (e.active) e.state = 'pursue';
      this.stats[this.possession].fga += b.kick === 'fg' ? 1 : 0; this.emit('kick', 'fg');
    }
    this.setUser(null);
  }

  // ---------- main update ----------
  update(dt) {
    dt = Math.min(dt, 0.05); this.time += dt;
    if (this.phase === 'presnap') { this.playT += dt; if (this.playT >= this.snapT) this.snap(); this._presnapMotion(dt); return; }
    if (this.phase === 'kickmeter') { this.meter.t += dt; this.meter.val = 0.5 + 0.5 * Math.sin(this.meter.t * 4.2); this._updateEnts(dt); if (this.auto || (!this.userOnOffense() && this.passer.team !== this.userSide)) { if (this.meter.t > 1.1) this._doKick(0.5 + R(-0.12, 0.12) * (1.3 - rating(this.passer, 'kik'))); } else if (this.meter.t > 4) this._doKick(this.meter.val); return; }
    if (this.phase === 'live') {
      this.playT += dt; if (this.clockRunning) this._tickClock(dt);
      for (const s of this.script) if (!s.done && this.playT >= s.t) { s.done = true; s.fn(); }
      if (this.paBite > 0) this.paBite -= dt;
      this._updateEnts(dt); this._updateBall(dt); this._collisions(dt);
      if (this.hooks.onLive) this.hooks.onLive(this, dt);
      return;
    }
    if (this.phase === 'dead') {
      this.deadTimer -= dt; this._updateEnts(dt);
      if (this.deadTimer <= 0) this._advance();
    }
  }
  _tickClock(dt) { if (this.mode !== 'game') return; this.clock = Math.max(0, this.clock - dt); }
  _presnapMotion(dt) { /* players hold their stance; jet motion could go here */ }

  _updateEnts(dt) {
    const off = this.roster[this.possession], def = this.roster[this.defense];
    for (const side of ['home', 'away']) for (const e of this.roster[side]) {
      if (!e.active) continue;
      e.cooldown = Math.max(0, e.cooldown - dt); for (const k of Object.keys(e.eff)) if (typeof e.eff[k] === 'number' && k !== 'jukeDir') e.eff[k] = Math.max(0, e.eff[k] - dt);
      if (e.action) { e.action.t += dt; if (e.action.type === 'throw' && !e.action.released && e.action.t >= e.action.release) { e.action.released = true; if (this.ball.carrier === e) this._releasePass(e, e.action); } if (e.action.t > 0.6) e.action = null; }
      if (e.fake > 0) { e.fake -= dt; }
      if (e.state === 'down') { e.timer -= dt; e.vx *= 0.8; e.vz *= 0.8; if (e.timer <= 0 && this.phase === 'live') { e.state = e.team === this.possession ? (e.hasBall ? 'carrier' : 'route') : 'pursue'; e.anim = 'getup'; e.animOpts = { restart: true }; e.getup = 0.5; } continue; }
      if (e.getup > 0) { e.getup -= dt; e.vx *= 0.7; e.vz *= 0.7; continue; }
      if (this.phase !== 'live') { e.vx *= 0.85; e.vz *= 0.85; if (this.phase === 'dead' && !e.hasBall && e.state !== 'down' && Math.random() < dt * 0.4) { e.anim = e.team === (this.result && this.result.happy) ? 'celebrate' : 'idle'; } continue; }
      let desire = null; // {dx,dz,speed(0..1)}
      if (e.isUser && !this.auto && this.userInput) desire = this._userDesire(e, dt);
      else desire = e.team === this.possession ? this._offenseAI(e, dt) : this._defenseAI(e, dt);
      this._move(e, desire, dt);
    }
  }
  _userDesire(e, dt) {
    const inp = this.userInput; const mv = inp.move; // {x, y} stick, y up = downfield toward camera forward
    // camera forward = direction the user's team attacks; screen right = -dir * x (see character facing convention)
    const camDir = this.dirOf(this.userSide);
    let dz = mv.y * camDir, dx = -mv.x * camDir;
    const mag = Math.hypot(dx, dz); if (mag < 0.1) return { dx: 0, dz: 0, speed: 0 };
    const sprint = inp.sprint && e.stamina > 0.05; if (sprint) e.stamina = Math.max(0, e.stamina - dt * (this.quirks.includes('hot') ? 0.28 : 0.17)); else e.stamina = Math.min(1, e.stamina + dt * 0.12);
    return { dx: dx / mag, dz: dz / mag, speed: Math.min(1, mag) * (sprint ? 1.13 : 1), sprint };
  }
  _move(e, d, dt) {
    const surface = this.quirks; const slick = surface.includes('slick'), sticky = surface.includes('sticky');
    const pursuing = this.ball.carrier && this.ball.carrier.team !== e.team && this.ball.state === 'held';
    const maxSp = (5.4 + rating(e, 'spd') * 3.9) * (sticky ? 0.93 : 1) * (e.eff.stumble > 0 ? 0.45 : 1) * (e.engaged ? 0.35 : 1) * (e.eff.brokenSlow > 0 ? 0.7 : 1) * (e.p.role === 'C' && e.state === 'route' ? 0.9 : 1) * (pursuing ? (e.isUser && !this.auto ? 1.04 : 1.07) : 1) * (e.hasBall && e.stamina < 0.15 ? 0.9 : 1);
    let acc = (13 + rating(e, 'acc') * 13) * (slick ? 0.5 : 1) * (sticky ? 0.85 : 1);
    if (e.eff.dive > 0) { e.x += e.vx * dt; e.z += e.vz * dt; e.vx *= Math.exp(-2.5 * dt); e.vz *= Math.exp(-2.5 * dt); if (e.eff.dive <= dt) { e.state = e.state === 'carrier' ? 'carrier' : e.state; e.eff.dove = 0.6; if (!e.hasBall) { e.timer = 0.7; e.prevState = e.state; e.state = 'down'; e.anim = 'down'; } } this._faceVel(e, dt); return; }
    const want = d && d.speed > 0 ? d.speed : 0;
    let tx = (d ? d.dx : 0) * want * maxSp, tz = (d ? d.dz : 0) * want * maxSp;
    if (e.eff.juke > 0) { const k = e.eff.juke / 0.4; tx += e.eff.jukeDir * 7 * k * -this.dirOf(e.team) * 0; tx += (e.eff.jukeDir || 1) * 6.5 * k; }
    if (e.eff.spin > 0) { tx *= 0.6; tz *= 0.6; }
    let dvx = tx - e.vx, dvz = tz - e.vz; const dl = Math.hypot(dvx, dvz); const maxDv = acc * dt; if (dl > maxDv) { dvx *= maxDv / dl; dvz *= maxDv / dl; }
    e.vx += dvx; e.vz += dvz;
    e.x += e.vx * dt; e.z += e.vz * dt;
    if (!e.hasBall) { e.x = clamp(e.x, -W2 - 2.5, W2 + 2.5); e.z = clamp(e.z, -2, FIELD.L + 2); }
    e.speed = Math.hypot(e.vx, e.vz);
    if (e.state !== 'set' && e.state !== 'snapset' && e.state !== 'read') this._faceVel(e, dt, d);
    if (e.speed > 6.5 && !e.isUser) e.stamina = Math.max(0, e.stamina - dt * (e.hasBall ? 0.16 : 0.05)); else if (!e.isUser) e.stamina = Math.min(1, e.stamina + dt * 0.1);
  }
  _faceVel(e, dt, d) {
    let fx = e.vx, fz = e.vz; if (e.speed < 0.8 && d && d.speed > 0) { fx = d.dx; fz = d.dz; } else if (e.speed < 0.8) return;
    const want = Math.atan2(fx, fz); let diff = ((want - e.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI; e.facing += diff * Math.min(1, dt * 14);
  }
  _steerTo(e, x, z, speed = 1, slowRadius = 0.4) {
    const dx = x - e.x, dz = z - e.z; const d = Math.hypot(dx, dz); if (d < slowRadius) return { dx: 0, dz: 0, speed: 0 };
    return { dx: dx / d, dz: dz / d, speed: Math.min(speed, d < 1.6 ? d / 1.6 : 1) };
  }
  _intercept(e, t) { // pursuit point for a moving target
    const sp = 5.4 + rating(e, 'spd') * 3.9; let tt = Math.hypot(t.x - e.x, t.z - e.z) / sp; tt = Math.min(tt, 1.3);
    for (let i = 0; i < 2; i++) { const px = t.x + t.vx * tt, pz = t.z + t.vz * tt; tt = Math.min(1.3, Math.hypot(px - e.x, pz - e.z) / sp); }
    return { x: t.x + t.vx * tt, z: t.z + t.vz * tt };
  }

  // ---------- offense AI ----------
  _offenseAI(e, dt) {
    const b = this.ball; const dir = this.dir;
    switch (e.state) {
      case 'route': case 'catchrun': {
        if (e.state === 'catchrun' && b.state === 'air' && b.target === e) { const l = b.landing; return this._steerTo(e, l.x, l.z, 1, 0.2); }
        if (e.state === 'catchrun') e.state = 'route';
        if (b.carrier && b.carrier.team === e.team && b.carrier !== e && b.carrier.state === 'carrier' && this.passCrossed) return this._blockFor(e, b.carrier);
        e.routeT = (e.routeT || 0) + dt; if (e.routeT < 0) return { dx: 0, dz: 0, speed: 0 };
        if (e.routeIdx < e.route.length) { const p = e.route[e.routeIdx]; const d = Math.hypot(p.x - e.x, p.z - e.z); if (d < 0.9) e.routeIdx++; return this._steerTo(e, p.x, p.z, 1, 0.1); }
        // route finished
        if (e.settle) { const qb = b.carrier || this.passer; const toQ = { dx: qb.x - e.x, dz: qb.z - e.z }; const l = Math.hypot(toQ.dx, toQ.dz) || 1; e.facing = Math.atan2(toQ.dx, toQ.dz); if (this.playT > 3.2) return this._steerTo(e, e.x + (e.x > 0 ? -1 : 1) * 3, e.z + dir * 2, 0.6); return { dx: 0, dz: 0, speed: 0 }; }
        // scramble drill: drift toward open grass on the QB's side
        const qb = b.carrier || this.passer; const goalZ = this.targetGoalZ(e.team); const openX = clamp(e.x + (qb.x > e.x ? 3 : -3), -W2 + 2, W2 - 2);
        const tz = Math.abs(goalZ - e.z) > 3 ? e.z + dir * 3 : goalZ - dir * 1;
        return this._steerTo(e, openX, tz, 0.75);
      }
      case 'block': return this._blockFor(e, b.carrier || this.passer);
      case 'fakerun': { if (!e.path) e.path = [{ x: e.x, z: e.z + dir * 6 }]; const p = e.path[Math.min(e.pathIdx, e.path.length - 1)]; if (Math.hypot(p.x - e.x, p.z - e.z) < 1) { e.state = 'block'; } return this._steerTo(e, p.x, p.z, 0.9); }
      case 'mesh': { // run to the QB for the handoff
        const qb = b.carrier; if (!qb || qb.team !== e.team) { e.state = 'route'; return null; }
        e.meshT = (e.meshT || 0) + dt; if (e.meshT < e.meshDelay) return { dx: 0, dz: 0, speed: 0 };
        if (e.pitch) { this._lateral(qb, e, true); e.state = 'catchrun'; return this._steerTo(e, e.path ? e.path[0].x : e.x, e.path ? e.path[0].z : e.z, 1); }
        const meshX = qb.x + (e.x > qb.x ? 0.8 : -0.8), meshZ = qb.z - dir * 0.3;
        if (Math.hypot(meshX - e.x, meshZ - e.z) < 1.1 || e.meshT > 1.2) { this._handoff(qb, e); return this._pathDesire(e, dt); }
        return this._steerTo(e, meshX, meshZ, 0.9, 0.2);
      }
      case 'reverse': { const rb = b.carrier; if (!rb || rb.team !== e.team) { e.state = 'route'; return null; } const target = { x: rb.x - (rb.x > 0 ? 1 : -1) * 0.5, z: rb.z - dir * 1.5 }; if (Math.hypot(rb.x - e.x, rb.z - e.z) < 1.4 && this.playT > 0.8) { this._handoff(rb, e); e.path = [{ x: e.x + (e.x > 0 ? -1 : 1) * 10, z: e.z + dir * 2 }, { x: clamp(e.x + (e.x > 0 ? -1 : 1) * 14, -13, 13), z: e.z + dir * 30 }]; e.pathIdx = 0; return this._pathDesire(e, dt); } return this._steerTo(e, target.x, target.z, 1); }
      case 'jet': { const qb = b.carrier; if (!qb || qb.team !== e.team) { e.state = 'route'; return null; } const side = e.x > qb.x ? 1 : -1; const target = { x: qb.x - side * 0.5, z: qb.z - dir * 0.6 }; if (Math.abs(e.x - qb.x) < 1.3 && Math.abs(e.z - qb.z) < 1.6) { this._handoff(qb, e); e.path = [{ x: qb.x - side * 12, z: this.los + dir * 3 }, { x: qb.x - side * 13, z: this.los + dir * 30 }]; e.pathIdx = 0; return this._pathDesire(e, dt); } return this._steerTo(e, target.x, target.z, 1, 0.1); }
      case 'trail': { const c = b.carrier; if (!c || c.team !== e.team || c === e) { e.state = 'route'; return null; } const side = e.x > c.x ? 1 : -1; return this._steerTo(e, clamp(c.x + side * 4, -W2 + 1, W2 - 1), c.z - dir * 3, 1, 0.3); }
      case 'qb': return this._qbAI(e, dt);
      case 'throwing': return { dx: 0, dz: 0, speed: 0 };
      case 'carrier': return this._carrierAI(e, dt);
      case 'cover': { const t = b.carrier && b.carrier.team !== e.team ? b.carrier : (b.landing ? { x: b.landing.x, z: b.landing.z, vx: 0, vz: 0 } : null); if (!t) return null; const p = b.carrier ? this._intercept(e, t) : t; return this._steerTo(e, p.x, p.z, 1); }
      case 'pursue': { const c = b.carrier; if (c && c.team !== e.team) { const p = this._intercept(e, c); return this._steerTo(e, p.x, p.z, 1); } if (b.state === 'loose') return this._steerTo(e, b.x, b.z, 1); return null; }
      default: return null;
    }
  }
  _blockFor(e, protectee) {
    const def = this.roster[this.defense].filter(d => d.active && d.state !== 'down');
    if (!protectee) return null;
    if (e.engaged) { const d = e.engaged; return this._steerTo(e, d.x + (protectee.x - d.x) * 0.15, d.z + (protectee.z - d.z) * 0.15, 0.6, 0.3); }
    // nearest threat to the protectee that isn't already blocked (prefer rushers)
    let best = null, bs = 1e9;
    for (const d of def) { if (d.engaged && d.engaged !== e) continue; const dist = Math.hypot(d.x - protectee.x, d.z - protectee.z); const score = dist - (d.asg === 'rush' ? 4 : 0) - (Math.hypot(d.x - e.x, d.z - e.z) < 4 ? 3 : 0); if (score < bs) { bs = score; best = d; } }
    if (!best) return this._steerTo(e, e.x, protectee.z + this.dir * 1.5, 0.6);
    // stand between the defender and the protectee
    const dx = protectee.x - best.x, dz = protectee.z - best.z; const l = Math.hypot(dx, dz) || 1;
    const px = best.x + dx / l * 0.9, pz = best.z + dz / l * 0.9;
    return this._steerTo(e, px, pz, 1, 0.2);
  }
  _pathDesire(e, dt) {
    if (!e.path || !e.path.length) return this._carrierAI(e, dt);
    const p = e.path[Math.min(e.pathIdx, e.path.length - 1)]; if (Math.hypot(p.x - e.x, p.z - e.z) < 1.2) e.pathIdx++;
    if (e.pathIdx >= e.path.length || this.passCrossed) { e.followPath = false; return this._carrierAI(e, dt); }
    const d = this._steerTo(e, p.x, p.z, 1, 0.1); return this._avoid(e, d);
  }
  _avoid(e, d) { // steer a CPU carrier around nearby defenders
    const def = this.roster[e.team === this.possession ? this.defense : this.possession].filter(x => x.active && x.state !== 'down' && !x.engaged);
    let ax = 0, az = 0; const dir = this.dirOf(e.team);
    for (const x of def) { const dx = e.x - x.x, dz = e.z - x.z; const dist = Math.hypot(dx, dz); if (dist < 5.5 && (dz * dir) < 2) { const w = (5.5 - dist) / 5.5; ax += dx / (dist || 1) * w * 1.6; az += dz / (dist || 1) * w * 0.5; } }
    if (Math.abs(e.x) > W2 - 3) ax -= Math.sign(e.x) * 0.9;
    let dx = d.dx + ax, dz = d.dz * 1.0 + az; if (dz * dir < 0.2) dz = 0.2 * dir; const l = Math.hypot(dx, dz) || 1;
    return { dx: dx / l, dz: dz / l, speed: d.speed };
  }
  _carrierAI(e, dt) {
    if (e.isUser && !this.auto) return null;
    const dir = this.dirOf(e.team); const goalZ = this.targetGoalZ(e.team);
    if (e.followPath && e.path && e.pathIdx < e.path.length && !this.passCrossed) return this._pathDesire(e, dt);
    // pick a lane: sample a few headings and score by defender proximity
    const def = this.roster[e.team === this.possession ? this.defense : this.possession].filter(x => x.active && x.state !== 'down');
    let best = null, bs = -1e9;
    for (const ang of [-1.1, -0.7, -0.35, 0, 0.35, 0.7, 1.1]) {
      const dx = Math.sin(ang) * (Math.abs(ang) > 0.9 ? 1 : 1), dz = Math.cos(ang) * dir; const px = e.x + dx * 6, pz = e.z + dz * 6;
      let s = -Math.abs(ang) * 1.5 + Math.abs(goalZ - pz) * -0.05; if (Math.abs(px) > W2 - 1) s -= 6;
      for (const x of def) { const dd = Math.hypot(x.x + x.vx * 0.5 - px, x.z + x.vz * 0.5 - pz); s -= Math.max(0, 6 - dd) * 1.2; const dnow = Math.hypot(x.x - e.x, x.z - e.z); if (dnow < 3) { const rel = ((x.x - e.x) * dx + (x.z - e.z) * dz) / dnow; s -= Math.max(0, rel) * 3; } }
      if (s > bs) { bs = s; best = { dx, dz }; }
    }
    // jukes for CPU carriers when a defender closes
    const near = def.find(x => Math.hypot(x.x - e.x, x.z - e.z) < 2.2 && e.eff.juke <= 0 && e.eff.spin <= 0);
    if (near && Math.random() < dt * (0.8 + rating(e, 'agi') * 2)) { if (Math.random() < 0.5) { e.eff.juke = 0.4; e.eff.jukeDir = e.x - near.x > 0 ? 1 : -1; e.anim = 'juke'; e.animOpts = { dir: e.eff.jukeDir, restart: true }; } else { e.eff.spin = 0.5; e.anim = 'spin'; e.animOpts = { restart: true }; } }
    return { dx: best.dx, dz: best.dz, speed: 1 };
  }
  _qbAI(e, dt) {
    const b = this.ball; if (b.carrier !== e) return { dx: 0, dz: 0, speed: 0 };
    if (e.isUser && !this.auto) return null;
    e.dropT = (e.dropT || 0) + dt; const dir = this.dir;
    const def = this.roster[this.defense].filter(d => d.active && d.state !== 'down');
    const pressure = def.some(d => Math.hypot(d.x - e.x, d.z - e.z) < 2.4 && !d.engaged);
    const react = this.diff.aiReact;
    // design read: wait for routes to develop
    const passable = !this.forwardPassUsed && (e.z - this.los) * dir <= 0.3;
    if (passable && e.dropT > 0.65 * react) {
      let best = null, bs = -1e9;
      for (const r of this.eligibles) {
        if (r === e || r.state === 'block' || r.state === 'down' || r.isBlocker) continue;
        const lead = 0.6; const rx = r.x + r.vx * lead, rz = r.z + r.vz * lead;
        let sep = 1e9; for (const d of def) sep = Math.min(sep, Math.hypot(d.x + d.vx * lead - rx, d.z + d.vz * lead - rz));
        const depth = (rz - this.los) * dir; const dist = Math.hypot(rx - e.x, rz - e.z);
        let s = sep * 1.4 + Math.min(depth, 22) * 0.18 - (dist > 38 ? 8 : 0) - (depth < -1 ? 3 : 0) + (r.settle && r.routeIdx >= r.route.length ? 1 : 0);
        if (Math.abs(rx) > W2 - 0.5) s -= 5;
        if (s > bs) { bs = s; best = { r, sep, depth, dist }; }
      }
      const hold = e.dropT; const need = pressure ? 1.6 : hold > 2.6 * react ? 2.4 : 3.3;
      if (best && (best.sep > need || hold > 3.4 * react)) {
        if (hold > 3.4 * react && best.sep < 1.5 && !pressure && Math.random() < 0.5) { /* keep scrambling */ }
        else { const power = best.depth > 14 && best.sep > 4 ? 0.3 : 0.85; this._throw(e, best.r, power); return { dx: 0, dz: 0, speed: 0 }; }
      }
      if (hold > 3.6 * react) { e.state = 'carrier'; this.emit('scramble', e); return this._carrierAI(e, dt); }
    }
    if (!passable) { e.state = 'carrier'; return this._carrierAI(e, dt); }
    // pocket movement: drop back, slide away from pressure
    const pocketZ = this.res.QB.start[1] - 2.2; const w = this.toWorld(this.res.QB.start[0], pocketZ);
    let tx = w.x, tz = w.z;
    if (pressure) { const d = def.reduce((a, c) => (Math.hypot(c.x - e.x, c.z - e.z) < Math.hypot(a.x - e.x, a.z - e.z) ? c : a)); tx = e.x + (e.x - d.x) * 1.5; tz = e.z + (e.z - d.z) * 0.6; if ((tz - this.los) * dir > -0.5) tz = this.los - dir * 1; if (e.dropT > 2.2 && Math.random() < 0.02) { e.state = 'carrier'; this.emit('scramble', e); } }
    return this._steerTo(e, clamp(tx, -W2 + 1, W2 - 1), tz, pressure ? 0.9 : 0.6, 0.3);
  }
  _handoff(qb, rb) { if (this.ball.carrier !== qb) return; this._giveBall(rb); rb.state = 'carrier'; rb.followPath = true; qb.state = 'block'; qb.anim = 'idle'; this.handoffPending = null; this.emit('handoff', rb); }

  // ---------- defense AI ----------
  _defenseAI(e, dt) {
    const b = this.ball; const dir = this.dir; const off = this.roster[this.possession];
    const carrier = b.carrier; const react = this.diff.aiReact;
    e.react -= dt; const canReact = e.react <= 0; if (canReact) e.react = (0.08 + (1 - rating(e, 'awr')) * 0.25) * react;
    if (e.engaged) { const bl = e.engaged; return this._steerTo(e, bl.x + (e.x - bl.x) * 0.2, bl.z + (e.z - bl.z) * 0.2, 0.5, 0.2); }
    if (e.eff.jump > 0) return { dx: 0, dz: 0, speed: 0 };
    if (e.state === 'returner') { if (b.state === 'air' && b.landing) return this._steerTo(e, b.landing.x, b.landing.z, 1, 0.15); if (b.state === 'loose') return this._steerTo(e, b.x, b.z, 1); if (carrier === e) return this._carrierAI(e, dt); }
    // ball carrier established and past the read phase: everyone pursues (ball carrier on offense that's not the QB, or QB across the line)
    if (carrier && carrier.team !== e.team && (carrier.state === 'carrier' || this.passCrossed || (carrier.z - this.los) * dir > -0.2 && e.asg !== 'man')) { if (canReact || !e.target) e.target = this._intercept(e, carrier); const t = e.target; return this._steerTo(e, t.x, t.z, 1, 0.1); }
    if (carrier && carrier.team === e.team) { return this._blockFor(e, carrier); }
    if (b.state === 'loose') return this._steerTo(e, b.x, b.z, 1, 0.1);
    if (b.state === 'air' && b.landing) {
      // break on the ball if it's close enough to matter
      const l = b.landing; const dl = Math.hypot(l.x - e.x, l.z - e.z); const tRemain = Math.max(0, b.flightT - b.airT);
      const sp = 5.4 + rating(e, 'spd') * 3.9; if (dl / sp < tRemain + 0.45 + rating(e, 'awr') * 0.3 || e.manTarget === b.target) { e.breaking = true; return this._steerTo(e, l.x, l.z, 1, 0.1); }
      if (e.asg === 'zone' || e.asg === 'spy') return this._steerTo(e, l.x, l.z, 1, 0.1);
    }
    switch (e.asg) {
      case 'rush': { if (this.playT < e.rushDelay * react) { const q = carrier || this.passer; return this._steerTo(e, e.x + (q.x - e.x) * 0.2, e.z, 0.4, 0.2); } const q = carrier || this.passer; if (canReact || !e.target) e.target = this._intercept(e, q); return this._steerTo(e, e.target.x, e.target.z, 1, 0.1); }
      case 'spy': { const q = carrier || this.passer; if ((q.z - this.los) * dir > -0.5 && q.state === 'carrier') { e.target = this._intercept(e, q); return this._steerTo(e, e.target.x, e.target.z, 1, 0.1); } return this._steerTo(e, clamp(q.x, -8, 8), this.los + dir * 5, 0.7, 0.3); }
      case 'man': { const t = e.manTarget; if (!t || t.state === 'block' || t.isBlocker) { const q = carrier || this.passer; return this._steerTo(e, e.x, this.los + dir * 6, 0.5); } const bite = this.paBite > 0 && rating(e, 'awr') < 0.75 ? -3 : 0; const cushion = 1.4 + (1 - rating(e, 'cov')) * 1.2; if (canReact || !e.target) e.target = { x: t.x + t.vx * 0.35 * react + (Math.abs(t.x) < 12 ? Math.sign(t.x || 1) * -0.3 : 0), z: t.z + t.vz * 0.35 * react + dir * (cushion + bite) }; return this._steerTo(e, e.target.x, e.target.z, 1, 0.1); }
      case 'zone': default: {
        const zc = e.zone || ZONES.hook; const w = this.toWorld(zc[0], zc[1]); let tx = w.x, tz = w.z;
        const bite = this.paBite > 0 && rating(e, 'awr') < 0.75 ? -4 : 0; tz += dir * bite;
        let near = null, nd = 7.5; for (const o of off) { if (!o.active || o.isBlocker || o.state === 'block' || o === carrier) continue; const d = Math.hypot(o.x - tx, o.z - tz); if (d < nd) { nd = d; near = o; } }
        if (near && canReact) { e.target = { x: tx + (near.x - tx) * 0.65, z: tz + (near.z - tz) * 0.55 }; } else if (!e.target || canReact) e.target = { x: tx, z: tz };
        return this._steerTo(e, e.target.x, e.target.z, 0.95, 0.25);
      }
    }
  }

  // ---------- ball ----------
  _updateBall(dt) {
    const b = this.ball;
    if (b.state === 'held' && b.carrier) { const c = b.carrier; b.x = c.x; b.z = c.z; b.y = 1.0; return; }
    if (b.state === 'air') {
      b.airT += dt; b.vy -= this.gravity * dt; b.vx += this.wind.x * dt * 0.5; b.vz += this.wind.z * dt * 0.5;
      if (this.quirks.includes('dense')) { b.vx *= Math.exp(-0.25 * dt); b.vz *= Math.exp(-0.25 * dt); }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.kick === 'fg' || b.kick === 'pat') { if ((b.z - b.goalZ) * this.dir >= 0 && !b.fgResolved) { b.fgResolved = true; const good = b.y > 3.33 && Math.abs(b.x) < 3.08 && b.y < 40; this._fieldGoal(good); return; } if (b.y <= 0 || b.airT > 6) { if (!b.fgResolved) { b.fgResolved = true; this._fieldGoal(false); } return; } return; }
      if (b.airT > 8 || b.y < -5) { this._endPlay({ type: 'incomplete', text: 'INCOMPLETE', spot: this.los, clockStop: true }); return; }
      if (b.vy < 0 || b.airT > 0.2) this._catchCheck(dt);
      if (b.y <= 0.15) { b.y = 0.15;
        if (b.forward) { this._endPlay({ type: 'incomplete', text: 'INCOMPLETE', spot: this.los, clockStop: true }); this.emit('incomplete'); return; }
        // laterals, punts, fumbles: live ball
        b.state = 'loose'; b.looseT = 0; b.vy = Math.abs(b.vy) * (this.quirks.includes('bouncy') ? 0.7 : 0.45); b.vx *= 0.5; b.vz *= 0.5; b.bounces = 1; this.emit('bounce');
      }
      if (Math.abs(b.x) > W2 + 0.3 && !b.kick) { /* ball out of bounds in the air: incomplete / dead */ if (b.forward) { this._endPlay({ type: 'incomplete', text: 'INCOMPLETE', spot: this.los, clockStop: true }); } else this._endPlay({ type: 'oob', text: 'OUT OF BOUNDS', spot: b.thrower ? b.thrower.z : this.los, clockStop: true }); return; }
      if (b.kick === 'punt') { if (Math.abs(b.x) > W2) { this._puntDead(b.z, 'OUT OF BOUNDS'); return; } }
      return;
    }
    if (b.state === 'loose') {
      b.looseT += dt; b.vy -= this.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.y <= 0.15) { b.y = 0.15; if (Math.abs(b.vy) > 1.5) { b.vy = Math.abs(b.vy) * (this.quirks.includes('bouncy') ? 0.75 : 0.5); b.vx += R(-1.5, 1.5); b.vz += R(-1.5, 1.5); b.bounces = (b.bounces || 0) + 1; } else b.vy = 0; b.vx *= Math.exp(-2.2 * dt); b.vz *= Math.exp(-2.2 * dt); }
      const gz = this.targetGoalZ(this.possession);
      if (b.kick === 'punt') {
        if ((b.z - gz) * this.dir > 0) { this._puntDead(null, 'TOUCHBACK'); return; }
        if (Math.abs(b.x) > W2 || (b.looseT > 2.6 && Math.hypot(b.vx, b.vz) < 0.6) || b.looseT > 5) { this._puntDead(b.z, 'DOWNED'); return; }
      } else if (b.looseT > 4.5 || Math.abs(b.x) > W2 + 0.5) { const team = b.lastTeam; this._endPlay({ type: 'loose', text: 'BALL DEAD', spot: clamp(b.z, GL_A + 1, GL_B - 1), turnover: team !== this.possession, clockStop: true }); return; }
      // recovery
      if (b.looseT > 0.25) for (const side of ['home', 'away']) for (const e of this.roster[side]) {
        if (!e.active || e.state === 'down' || e.getup > 0) continue; if (Math.hypot(e.x - b.x, e.z - b.z) < 1.0 && b.y < 1.6) {
          if (b.kick === 'punt' && e.team === this.possession) { this._puntDead(b.z, 'DOWNED'); return; }
          this._giveBall(e); e.state = 'carrier'; e.followPath = false; b.kick = null; this.passCrossed = true; this.emit('recover', e); if (e.team !== this.possession) { for (const o of this.roster[this.possession]) if (o.active) o.state = 'pursue'; for (const d of this.roster[this.defense]) if (d.active && d !== e) d.state = 'block'; }
          if (!this.auto && e.team === this.userSide) this.setUser(e); return;
        }
      }
    }
  }
  _catchCheck(dt) {
    const b = this.ball; if (b.y > 3.3) return;
    const cands = [];
    for (const side of ['home', 'away']) for (const e of this.roster[side]) { if (!e.active || e.state === 'down' || e.getup > 0 || e === b.thrower && b.airT < 0.35) continue; const d = Math.hypot(e.x - b.x, e.z - b.z); const reach = 1.25 + (e.eff.jump > 0 ? 0.5 : 0) + (b.y > 2.3 ? -0.3 : 0); if (d < reach && b.y < 2.6 + (e.eff.jump > 0 ? 0.8 : 0)) cands.push({ e, d }); }
    if (!cands.length) return;
    cands.sort((a, c) => a.d - c.d);
    const first = cands[0].e; const isOff = first.team === b.lastTeam; const contested = cands.find(c => c.e.team !== first.team && c.d < 1.7);
    if (b.kick === 'punt') { if (first.team === this.defense) { this._giveBall(first); first.state = 'carrier'; b.kick = null; this.passCrossed = true; this.emit('catch', first); this._puntCaught(first); } return; }
    const trait = (e) => this.teamOf(e.team).perk && this.teamOf(e.team).perk.trait;
    if (isOff) {
      let p = 0.55 + rating(first, 'cat') * 0.42 - (contested ? 0.24 + rating(contested.e, 'cov') * 0.16 : 0) - (b.bullet ? 0.07 : 0) + (trait(first) === 'sticky' ? 0.15 : 0) + (b.lateral ? 0.2 : 0) + (first === b.target ? 0.05 : -0.15);
      if (contested && trait(contested.e) === 'thief' && Math.random() < 0.22) p -= 0.25;
      if (Math.random() < p) { this._complete(first, b); }
      else { b.forward ? this._endPlay({ type: 'drop', text: contested ? 'BROKEN UP' : 'DROPPED', spot: this.los, clockStop: true }) : null; if (b.forward) this.emit('drop', first); else { b.vx *= 0.3; b.vz *= 0.3; b.vy = 1.5; } b.dropped = true; }
    } else {
      // defender is closest: interception or swat
      let pInt = 0.22 + rating(first, 'cov') * 0.35 + rating(first, 'cat') * 0.15 - (b.bullet ? 0.15 : 0) + (trait(first) === 'thief' ? 0.15 : 0) + (first.eff.jump > 0 ? 0.1 : 0);
      if (first.isUser && !this.auto && first.eff.jump <= 0) pInt -= 0.1;
      const r = Math.random();
      if (r < pInt) { this._giveBall(first); first.state = 'carrier'; first.followPath = false; this.passCrossed = true; this.stats[first.team].ints++; this.emit('interception', first); for (const o of this.roster[this.possession]) if (o.active) o.state = 'pursue'; for (const d of this.roster[this.defense]) if (d.active && d !== first) d.state = 'block'; if (!this.auto && first.team === this.userSide) this.setUser(first); }
      else if (r < pInt + 0.45 && b.forward) { this._endPlay({ type: 'drop', text: 'BROKEN UP', spot: this.los, clockStop: true }); this.emit('swat', first); }
      else b.dropped = true; // sails on
    }
  }
  _complete(e, b) {
    this._giveBall(e); e.state = 'carrier'; e.followPath = false; e.anim = 'catch'; e.animOpts = { restart: true, high: b.y > 2 }; e.catchT = 0.3;
    if (b.forward) { this.stats[this.possession].comp++; this.passCrossed = true; }
    this.emit('catch', e);
  }
  _puntCaught(e) { this.emit('puntcatch', e); for (const o of this.roster[this.possession]) if (o.active) o.state = 'pursue'; for (const d of this.roster[this.defense]) if (d.active && d !== e) d.state = 'block'; }
  _puntDead(z, text) {
    const b = this.ball; const recv = this.defense; let spot = z === null ? this.ownYard(recv, 10) : clamp(z, GL_A + 1, GL_B - 1);
    const dist = Math.round(Math.abs((z === null ? this.targetGoalZ(this.possession) : z) - this.los));
    this._endPlay({ type: 'punt', text: `PUNT ${dist} YDS · ${text}`, spot, turnover: true, clockStop: true, punt: true });
  }
  _fieldGoal(good) {
    const b = this.ball; const isPat = b.kick === 'pat'; b.state = 'dead';
    if (good) { this.score[this.possession] += isPat ? 1 : 3; if (!isPat) this.stats[this.possession].fg++; this.emit(isPat ? 'patgood' : 'fggood'); this._endPlay({ type: 'score', text: isPat ? 'EXTRA POINT GOOD' : 'FIELD GOAL IS GOOD!', spot: this.los, score: true, clockStop: true, happy: this.possession, pat: isPat }); }
    else { this.emit('fgmiss'); this._endPlay({ type: isPat ? 'patmiss' : 'fgmiss', text: isPat ? 'EXTRA POINT MISSED' : 'NO GOOD', spot: this.los, turnover: !isPat, clockStop: true, kickMiss: true, pat: isPat }); }
    this.pendingKick = null;
  }

  // ---------- collisions: blocks & tackles ----------
  _collisions(dt) {
    const b = this.ball; const c = b.carrier; const off = this.roster[this.possession].filter(e => e.active), def = this.roster[this.defense].filter(e => e.active);
    // blocks
    for (const o of off) {
      if (o.state !== 'block' && !(o.state === 'route' && this.passCrossed && !o.hasBall)) continue; if (o.engaged) { o.engageT -= dt; if (o.engageT <= 0) { o.engaged.engaged = null; o.engaged = null; o.cooldown = 1.3; } continue; }
      if (o.cooldown > 0) continue;
      for (const d of def) { if (d.engaged || d.state === 'down' || d === c) continue; if (Math.hypot(d.x - o.x, d.z - o.z) < 1.15) { const dur = 0.3 + rating(o, 'blk') * 1.1 - rating(d, 'str') * 0.6 + ((this.teamOf(o.team).perk || {}).trait === 'wall' ? 0.35 : 0) + ((this.teamOf(d.team).perk || {}).trait === 'iron' ? -0.25 : 0); o.engaged = d; d.engaged = o; o.engageT = clamp(dur, 0.25, 1.4); o.anim = 'block'; d.anim = 'block'; this.emit('block', { o, d }); break; } }
    }
    // tackles
    if (!c || this.phase !== 'live') return;
    const carrierTeam = c.team; const tacklers = this.roster[carrierTeam === 'home' ? 'away' : 'home'].filter(e => e.active && e.state !== 'down' && !(e.getup > 0));
    const cdir = this.dirOf(carrierTeam); const goalZ = this.targetGoalZ(carrierTeam);
    // touchdown?
    if ((c.z - goalZ) * cdir >= 0) { this._touchdown(c); return; }
    // out of bounds
    if (Math.abs(c.x) > W2) { const isPasserBehind = (c.z - this.los) * this.dir < 0 && c.team === this.possession; this._endPlay({ type: 'oob', text: 'OUT OF BOUNDS', spot: c.z, clockStop: true, gain: true, carrier: c, sack: isPasserBehind && !this.passCrossed && c.state !== 'carrier' }); return; }
    for (const t of tacklers) {
      if (t.cooldown > 0 || t.engaged) continue; const d = Math.hypot(t.x - c.x, t.z - c.z); const range = 0.95 + (t.eff.dive > 0 ? 0.9 : 0);
      if (d > range) continue;
      t.cooldown = 0.55;
      const trait = (e) => (this.teamOf(e.team).perk || {}).trait;
      let p = 0.72 + (rating(t, 'tak') - (rating(c, 'str') * 0.5 + rating(c, 'agi') * 0.5)) * 0.6 + (t.eff.dive > 0 ? 0.1 : 0) - (c.eff.juke > 0 ? 0.38 : 0) - (c.eff.spin > 0 ? 0.32 : 0) + (trait(t) === 'iron' ? 0.1 : 0) - (trait(c) === 'phase' ? 0.14 : 0) + (c.stamina < 0.2 ? 0.1 : 0);
      if (t.isUser && !this.auto && t.eff.dive <= 0) p += 0.08; // reward getting there
      p = clamp(p, 0.3, 0.95);
      if (Math.random() < p) {
        // fumble?
        let pf = 0.025 + (trait(t) === 'hammer' ? 0.06 : 0) + (t.speed > 6 ? 0.02 : 0) - rating(c, 'awr') * 0.02 + (this.quirks.includes('slick') ? 0.01 : 0) - (trait(c) === 'lucky' ? 0.02 : 0);
        if (c.hasBall && !c.catchT && Math.random() < pf && (c.z - this.los) * cdir > -6) { this._fumble(c, t); return; }
        const sack = c === this.passer && !this.passCrossed && c.team === this.possession && (c.z - this.los) * this.dir < 0 && this.offPlay.type !== 'run';
        const safety = (c.z - this.ownGoalZ(carrierTeam)) * cdir <= 0;
        c.state = 'down'; c.timer = 1.4; c.anim = t.eff.dive > 0 ? 'downback' : 'down'; c.animOpts = { restart: true }; t.anim = t.eff.dive > 0 ? 'down' : 'block'; t.state = 'down'; t.timer = 0.9; t.tackled = true;
        this.emit('tackle', { t, c, big: t.speed > 6.5 });
        if (safety) { this._safety(c); return; }
        this._endPlay({ type: sack ? 'sack' : 'tackle', text: sack ? 'SACK!' : null, spot: c.z, gain: true, carrier: c, sack, clockStop: false });
        return;
      } else {
        // broken tackle
        t.eff.stumble = 0.9; t.anim = 'stumble'; t.animOpts = { restart: true }; t.cooldown = 1.0; c.eff.brokenSlow = 0.4; this.emit('broken', { t, c });
      }
    }
  }
  _fumble(c, t) {
    const b = this.ball; c.hasBall = false; b.carrier = null; b.state = 'loose'; b.looseT = 0; b.forward = false; b.lateral = false; b.kick = null; b.lastTeam = c.team;
    b.x = c.x; b.z = c.z; b.y = 1.2; b.vx = R(-4, 4); b.vz = R(-4, 4); b.vy = R(3, 6); this.stats[c.team].fumbles++;
    c.state = 'down'; c.timer = 1.1; c.anim = 'downback'; c.animOpts = { restart: true }; t.eff.stumble = 0.5; this.passCrossed = true; this.emit('fumble', { c, t });
    for (const side of ['home', 'away']) for (const e of this.roster[side]) if (e.active && e.state !== 'down') e.state = 'pursue';
    if (!this.auto) this.setUser(null);
  }
  _touchdown(c) {
    const side = c.team; this.score[side] += 6; this.stats[side].tds++;
    const yards = Math.round(Math.abs(c.z - this.los)); this.stats[side].longest = Math.max(this.stats[side].longest, yards);
    this.emit('touchdown', { c, side, yards, defensive: side !== this.possession });
    const scorer = side; this.possession = side; // scorer gets the PAT
    this._endPlay({ type: 'td', text: 'TOUCHDOWN!', spot: this.targetGoalZ(side), score: true, td: true, clockStop: true, happy: side, yards });
  }
  _safety(c) { const defSide = c.team === 'home' ? 'away' : 'home'; this.score[defSide] += 2; this.emit('safety', defSide); this._endPlay({ type: 'safety', text: 'SAFETY!', spot: this.ownYard(defSide, 10), safety: true, scoredBy: defSide, clockStop: true, happy: defSide }); }

  _endPlay(r) {
    if (this.phase !== 'live' && this.phase !== 'kickmeter') return; this.phase = 'dead'; this.deadTimer = r.type === 'td' ? 3.2 : 2.1; this.result = r; this.lastResult = r; this.clockRunning = false;
    const b = this.ball; if (b.state === 'air') { b.state = 'dead'; }
    // yards for the log
    if (r.gain && r.carrier) { const gained = Math.round((r.spot - this.los) * this.dir); r.yards = gained; if (r.carrier.team === this.possession) { const st = this.stats[this.possession]; st.yards += gained; if (this.forwardPassUsed && this.passCrossed) st.passYds += gained; else st.rushYds += gained; st.longest = Math.max(st.longest, gained); if (!r.text) r.text = gained > 0 ? `+${gained} YARDS` : gained === 0 ? 'NO GAIN' : `${gained} YARDS`; } else { r.turnover = true; r.text = r.text || 'TURNOVER'; } }
    if (this.laterals > 0 && r.type !== 'incomplete') r.lateral = true;
    if (this.hooks.onPlayEnd) this.hooks.onPlayEnd(r, this);
    this.emit('playend', r);
    if (!this.auto) this.setUser(null);
  }
  _advance() {
    const r = this.result; if (!r) { this.phase = 'playcall'; return; }
    if (this.mode === 'practice') { if (this.practicePossession) this.possession = this.practicePossession; else if (r.td || r.turnover || r.type === 'punt') this.possession = this.userSide; this.newSeries(this.practiceSpot !== undefined ? this.practiceSpot : this.los); this.phase = 'playcall'; this.result = null; if (this.hooks.afterAdvance) this.hooks.afterAdvance(this); return; }
    // clock runoff between plays when it kept running
    if (!r.clockStop && this.mode === 'game' && this.clock > 0) this.clock = Math.max(0, this.clock - 12);
    if (this.pendingTwo) { this.pendingTwo = false; if (r.td) { this.score[this.possession] -= 6; this.score[this.possession] += 2; r.text = 'TWO-POINT CONVERSION!'; this.emit('twogood'); } else this.emit('twofail'); this._afterScore(); return; }
    if (r.pat) { this._afterScore(); return; }
    if (r.td) {
      const scorer = r.happy; this.possession = scorer; // possession already set in _touchdown
      if (this.hooks.noPAT || this.mode !== 'game') { this._afterScore(); return; }
      this.pat = { side: scorer }; this.phase = 'pat'; this.emit('pat', scorer); return;
    }
    if (r.type === 'score') { this._afterScore(); return; }
    if (r.safety) { this.possession = r.scoredBy; this.newSeries(this.ownYard(this.possession, 10)); this._checkClock(); return; }
    if (r.type === 'punt') { this.possession = this.defense; this.newSeries(r.spot); this._checkClock(); return; }
    if (r.type === 'fgmiss') { this.possession = this.defense; this.newSeries(this.los); this._checkClock(); return; }
    if (r.turnover) { this.possession = this.defense; this.newSeries(clamp(r.spot, GL_A + 1, GL_B - 1)); this.emit('turnover'); this._checkClock(); return; }
    // normal down progression
    const spot = r.type === 'incomplete' || r.type === 'drop' ? this.los : clamp(r.spot, GL_A + 0.5, GL_B - 0.5);
    if ((spot - this.firstDownZ) * this.dir >= 0) { this.stats[this.possession].firstDowns++; this.newSeries(spot); this.emit('firstdown'); }
    else { this.los = spot; this.down++; this.toGo = Math.max(0.5, (this.firstDownZ - this.los) * this.dir); if (this.down > 4) { this.possession = this.defense; this.newSeries(this.los); this.emit('downs'); } }
    this._checkClock();
  }
  _afterScore() { const other = this.possession === 'home' ? 'away' : 'home'; this.possession = other; this.newSeries(this.ownYard(other, 10)); this.ball.kick = null; this.pendingKick = null; this._checkClock(true); }
  _checkClock(afterScore = false) {
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
  // for practice/challenge modules
  forceEnd() { this._finish(); }
}
export { W2, GL_A, GL_B };
