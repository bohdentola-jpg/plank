// Drive battles: five-on-five football on a compact field.
//   huddle (pick a play, arm abilities) → line up → timed snap → live play
//   (read & throw / timed catch / run with jukes, spins, laterals — or, on
//   defense, steer one defender, time tackles and interceptions) → next down.
// Small encounters are one drive; rival matches alternate possessions.
//
// Everything is simulated in "drive space": the team with the ball always
// attacks +x from x=los toward x=L. When the opponent has the ball the whole
// picture is rotated 180° for display (see wx/wz), so on screen you always
// attack right and defend the left end zone.
import * as THREE from 'three';
import { G, Mode } from '../core/game.js';
import { Fx } from '../core/fx.js';
import { buildField } from './field.js';
import { BattleHud, STATUS } from './hud.js';
import { Character, buildFootball } from '../art/characters.js';
import { toon, flat, M, ring, circle, glowSprite } from '../art/kit.js';
import { portrait } from '../art/portraits.js';
import { CAST, ABILITIES, teamSpec, statsOf, charState, maxStamina, displayName, speedOf, fitSquad, OFF_SLOTS, DEF_SLOTS, addXp, xpToNext } from '../data/cast.js';
import { TEAMS, CPU_OFF, CPU_DEF, scaledTeam } from '../data/teams.js';
import { PLAYS, DEF_PLAYS, OFF_FORM, DEF_FORM, STARTER_PLAYS, STARTER_DEF, getPlay } from '../data/plays.js';
import { ITEMS } from '../data/items.js';
import { clamp, lerp, damp, dist, rand, pick, chance, TAU, wrapAngle, ordinal, ease, el, rich } from '../core/util.js';
import { addItem, itemCount } from '../game/state.js';

const SCALE = 1.34;
const OFF_ROLE_OF_SLOT = ['QB', 'LINE', 'WR1', 'WR2', 'BACK'];
const DEF_ROLE_OF_SLOT = ['RUSH', 'LB', 'CB1', 'CB2', 'S'];
const NEG = ['soggy', 'syrup', 'spook', 'dizzy', 'butter', 'freeze', 'glitch'];
const YOU = 0, CPU = 1;

export class Battle extends Mode {
  constructor() {
    super();
    this.name = 'battle';
    this.camera.fov = 22;
  }

  // ================================================================ setup
  enter(cfg) {
    const S = G.S;
    this.cfg = cfg;
    this.team = cfg.teamDef || scaledTeam(cfg.team, cfg.bonus || 0);
    this.kind = cfg.kind || 'drive';
    this.L = cfg.L || 50; this.HW = cfg.HW || 10; this.EZ = cfg.EZ || 6;
    this.size = cfg.size || 5;
    this.offRoles = cfg.offRoles || OFF_ROLE_OF_SLOT;
    this.defRoles = cfg.defRoles || DEF_ROLE_OF_SLOT;
    this.auto = !!(cfg.auto || G.debug.auto);
    this.score = [0, 0];
    this.stats = { yards: 0, perfect: 0, tackles: 0, ints: 0, tds: 0, plays: 0, sacks: 0 };
    this.clock = 0; this.playT = 0;
    this.phase = 'intro';
    this.flip = false;
    this.poss = YOU;
    this.los = 20; this.ltg = 30; this.down = 1;
    this.secondChanceUsed = false;
    this.buff = {};                     // drive-long item buffs
    this.fx = new Fx(this.scene);
    this.field = buildField(this.scene, {
      venue: cfg.venue || 'backyard', L: this.L, HW: this.HW, EZ: this.EZ, tod: cfg.tod || S.tod,
      home: { name: S.team.name, color: S.team.jersey }, away: { short: this.team.short, color: this.team.color },
      hazard: cfg.hazard !== undefined ? cfg.hazard : this.team.hazard, boardLines: cfg.boardLines,
    });
    this.hudUI = new BattleHud(this.hud, this);

    // ---- your squads
    const roster = S.roster.slice();
    let sq = [S.squads[0].slice(), S.squads[1].slice()];
    if (cfg.squad) sq = [cfg.squad.slice(), cfg.squad.slice()];
    if (cfg.guest) {
      for (const q of sq) { if (!q.includes(cfg.guest)) { q.unshift(cfg.guest); while (q.length > this.size) q.pop(); } }
    }
    for (const q of sq) { for (const id of roster) { if (q.length >= this.size) break; if (!q.includes(id)) q.push(id); } q.length = Math.min(q.length, this.size); }
    this.squads = sq;
    this.curSquad = cfg.side === 'def' ? S.defSquad : S.offSquad;
    this.mine = {};
    for (const id of new Set([...sq[0], ...sq[1]])) this.mine[id] = this._ent(YOU, id, displayName(id), teamSpec(id), statsOf(id));
    // ---- them
    const idx = cfg.cpuIdx || [0, 1, 2, 3, 4];
    this.foes = idx.map((i) => { const m = this.team.squad[i]; const e = this._ent(CPU, `cpu${i}`, m.name, m.spec, m.stats); e.slot = i; return e; });
    this.iq = this.team.iq;

    // ball + catch rings + first-down marker
    this.ballMesh = buildFootball(1.5);
    this.scene.add(this.ballMesh);
    this.ball = { state: 'held', holder: null, x: 0, y: 1, z: 0 };
    this.ringOut = new THREE.Mesh(ring(0.86, 1.0, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
    this.ringIn = new THREE.Mesh(ring(0.8, 1.0, 36), new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    for (const r of [this.ringOut, this.ringIn]) { r.rotation.x = -Math.PI / 2; r.visible = false; r.renderOrder = 5; this.scene.add(r); }
    this.losLine = M(new THREE.BoxGeometry(0.16, 0.02, this.HW * 2), flat(0x9be8ff, { transparent: true, opacity: 0.75 }), 0, 0.04, 0, { shadow: false });
    this.ltgLine = M(new THREE.BoxGeometry(0.22, 0.02, this.HW * 2), flat(0xffd45a, { transparent: true, opacity: 0.9 }), 0, 0.045, 0, { shadow: false });
    this.userRing = new THREE.Mesh(ring(0.62, 0.78, 28), new THREE.MeshBasicMaterial({ color: 0x58e6ff, transparent: true, opacity: 0.9, depthWrite: false }));
    this.userRing.rotation.x = -Math.PI / 2; this.userRing.position.y = 0.05; this.userRing.renderOrder = 4;
    this.scene.add(this.losLine, this.ltgLine, this.userRing);
    this.syrups = [];
    this.decoy = null;
    this.all = []; this.off = []; this.def = [];
    this.camX = 20; this.camZoom = 1;
    this._placeBench();
    this._camera(0, true);
    G.audio.music(cfg.music || (this.team.rival ? 'rival' : this.field.music));
    this._run();
  }

  exit() {
    this.hudUI.dispose();
    this.field.dispose();
    this.fx.dispose();
    G.ui.clearBanner();
  }

  async _run() {
    try {
      await this.flow();
    } catch (e) {
      G.reportError(e);
      G.leave({ won: false, error: true });
    }
  }

  _ent(team, key, name, spec, stats) {
    const ch = new Character(spec);
    ch.root.scale.multiplyScalar(SCALE);
    this.scene.add(ch.root);
    const e = {
      team, key, name, ch, stats, x: 0, z: 0, vx: 0, vz: 0, yaw: 0,
      st: stats.sta, maxSt: stats.sta, status: {}, hist: [], histT: 0,
      role: null, job: 'idle', onField: false, downT: 0, stunT: 0, engaged: null, shedT: 0,
      wind: 0, tackleCd: 0, iframes: 0, jukeCd: 0, spinCd: 0, spins: 0, burst: 0, dive: 0, slideT: 0,
    };
    if (team === YOU) { e.maxSt = maxStamina(key); }
    return e;
  }
  stOf(e) { return e.team === YOU ? charState(e.key).st : e.st; }
  addSt(e, d) {
    if (e.team === YOU) { const cs = charState(e.key); cs.st = clamp(cs.st + d, 0, e.maxSt); } else e.st = clamp(e.st + d, 0, e.maxSt);
  }
  tired(e) { return this.stOf(e) < e.maxSt * 0.2; }
  has(e, s) { return (e.status[s] || 0) > 0; }
  give(e, s, plays = 2) {
    if (!e || e.decoy) return;
    const fresh = !this.has(e, s);
    e.status[s] = Math.max(e.status[s] || 0, plays);
    if (fresh && STATUS[s]) this.pop(e, `${STATUS[s].icon} ${STATUS[s].name}`, STATUS[s].good ? 'small green' : 'small cool');
  }

  // world mapping (rotate 180° when the opponent has the ball)
  wx(x) { return this.flip ? this.L - x : x; }
  wz(z) { return this.flip ? -z : z; }
  wyaw(y) { return this.flip ? y + Math.PI : y; }
  wpos(e, y = 1.6) { return { x: this.wx(e.x), y, z: this.wz(e.z) }; }
  pop(e, text, cls = '', life = 1.0) { G.ui.pop(text, this.wpos(e, e.ch ? e.ch.height + 0.6 : 2.4), cls, life); }

  // ================================================================ flow
  async flow() {
    const cfg = this.cfg;
    await this.opening();
    const first = cfg.side === 'def' ? CPU : YOU;
    let won;
    if (this.kind === 'match') {
      const order = [];
      for (let i = 0; i < (cfg.drives || 2); i++) order.push(first, 1 - first);
      this.order = order;
      let start = 15;
      for (let i = 0; i < order.length; i++) {
        this.driveIdx = i;
        const res = await this.drive(order[i], start);
        start = res.next ?? 15;
        if (i === order.length / 2 - 1) await this.halftime();
      }
      let rounds = 0;
      while (this.score[YOU] === this.score[CPU]) { await this.shootout(rounds++); }
      won = this.score[YOU] > this.score[CPU];
    } else if (cfg.blitz) {
      won = await this.blitzGame();
    } else {
      const res = await this.drive(first, cfg.start ?? 20);
      won = first === YOU ? res.scored : !res.scored;
      this.narrow = res.fg;
    }
    await this.finale(won);
  }

  async opening() {
    const cfg = this.cfg;
    this.phase = 'intro';
    this.poss = cfg.side === 'def' ? CPU : YOU;
    this.flip = this.poss === CPU;
    this.los = cfg.start ?? (this.kind === 'match' ? 15 : 20);
    this._bug();
    if (G.debug.fast) return;
    const t = this.team;
    if (this.kind === 'match') {
      await G.ui.banner(`${G.S.team.name} <span style="font-size:.5em">vs</span> ${t.name}`, `${(cfg.drives || 2)} possessions each`, { dur: 2.2, cls: 'small' });
    } else if (!cfg.blitz) {
      const label = cfg.blindside ? 'BLINDSIDE!' : this.poss === YOU ? 'YOUR BALL' : 'DEFEND!';
      await G.ui.banner(label, `${t.name} — ${this.poss === YOU ? 'score to win' : 'stop them to win'}`, { dur: 1.5, cls: this.poss === YOU ? '' : 'cool' });
    }
  }

  /** Run one possession. Returns { scored, fg, next (start for the other team) }. */
  async drive(poss, start) {
    this.poss = poss;
    this.flip = poss === CPU;
    this.los = clamp(start, 3, this.L - 3);
    this.down = 1;
    this.ltg = Math.min(this.los + 10, this.L);
    this.curSquad = poss === YOU ? G.S.offSquad : G.S.defSquad;
    this.secondChanceUsed = false;
    this.firstPlay = true;
    const one = this.kind !== 'match';
    if (this.kind === 'match' && !G.debug.fast) {
      const n = Math.floor(this.driveIdx / 2) + 1;
      await G.ui.banner(poss === YOU ? 'YOUR BALL' : `${this.team.short} BALL`, `Possession ${n} of ${this.order.length / 2}`, { dur: 1.3, cls: poss === YOU ? 'small' : 'small cool' });
    }
    for (;;) {
      this._bug();
      const call = await this.huddle();
      if (call.kick === 'fg') {
        const good = await this.fieldGoal(false);
        if (good) { this.score[poss] += 3; this._bug(); return { scored: true, fg: true, next: 15 }; }
        return { scored: false, next: clamp(this.L - this.los, 8, 40) };
      }
      if (call.kick === 'punt') {
        const net = 24 + rand(-3, 5);
        if (!G.debug.fast) await G.ui.banner('PUNT', `${Math.round(net)} yards`, { dur: 1.1, cls: 'small cool' });
        return { scored: false, next: clamp(this.L - (this.los + net), 6, 30) };
      }
      await this.lineUp(call);
      await this.snap();
      const res = await this.live();
      const end = await this.afterPlay(res, one);
      if (end) return end;
    }
  }

  // ---------------------------------------------------------------- huddle
  squadIds() { return this.squads[this.curSquad]; }
  lineupFor(side) {
    const ids = this.squadIds();
    if (this.size < 5) return ids.map((id, i) => ({ id, role: (side === 'off' ? this.offRoles : this.defRoles)[i] }));
    const fit = fitSquad(ids, side === 'off' ? OFF_SLOTS : DEF_SLOTS);
    return fit.map((id, i) => ({ id, role: (side === 'off' ? OFF_ROLE_OF_SLOT : DEF_ROLE_OF_SLOT)[i] })).filter((m) => m.id);
  }

  playbook() {
    const S = G.S;
    const ids = [...new Set([...(this.cfg.plays || STARTER_PLAYS), ...S.plays, ...S.customPlays.map((p) => p.id)])];
    const on = this.squadIds();
    return ids.map((id) => ({ id, play: getPlay(id, S) })).filter((p) => p.play && (!p.play.combo || p.play.combo.every((c) => on.includes(c))) && this._playFits(p.play));
  }
  _playFits(play) {
    if (this.size >= 5) return true;
    return play.type === 'pass' && !play.fake && !play.ladder;
  }
  defbook() {
    const S = G.S;
    const ids = [...new Set([...(this.cfg.defPlays || STARTER_DEF), ...S.defPlays])];
    return ids.map((id) => ({ id, play: DEF_PLAYS[id] })).filter((p) => p.play);
  }

  abilityChips(side) {
    const out = [];
    for (const m of this.lineupFor(side)) {
      const c = CAST[m.id];
      const ab = ABILITIES[c.ability];
      if (!ab || (ab.side !== 'both' && ab.side !== side)) continue;
      const e = this.mine[m.id];
      const st = this.stOf(e);
      let can = true, why = '';
      if (this.has(e, 'spook')) { can = false; why = 'Spooked — can\'t use it this play.'; }
      else if (this.tired(e)) { can = false; why = 'Exhausted — rest, snack or swap squads.'; }
      else if (st < ab.cost) { can = false; why = 'Not enough stamina.'; }
      out.push({ id: c.ability, charId: m.id, name: displayName(m.id), ab, can, why, on: false });
    }
    return out;
  }

  async huddle() {
    this.phase = 'huddle';
    this.armed = new Set();
    this._showUser(null);
    this.hudUI.clearTargets();
    this.hudUI.setHint('');
    const side = this.poss === YOU ? 'off' : 'def';
    const S = G.S;
    // the opponent's call
    const cpuCall = this.cpuCall();
    this._placeHuddle();
    if (this.cfg.tutorial) await this.tutor('huddle');
    for (;;) {
      this._squadBar();
      const chips = this.abilityChips(side);
      const plays = side === 'off' ? this.playbook() : this.defbook();
      if (this.auto) {
        const p = this.autoPlay(plays, side);
        for (const c of chips) if (c.can && chance(0.35)) this.armed.add(c.charId);
        if (side === 'off' && this.down === 4 && this.kind === 'match' && this.los < this.L - 26 && this.ltg - this.los > 3) return { kick: 'punt' };
        return side === 'off' ? { off: p.play, offId: p.id, def: cpuCall } : { off: cpuCall, def: p.play, defId: p.id };
      }
      const extras = [];
      const other = this.squads[1 - this.curSquad];
      if (other.join() !== this.squadIds().join()) extras.push({ label: `🔄 Swap to Squad ${2 - this.curSquad} ${G.ui.key('l')}`, value: 'swap', desc: `Bring on your other squad: ${other.map((id) => displayName(id)).join(', ')}. Resting teammates recover stamina every play.` });
      const snacks = Object.keys(S.items).filter((id) => ITEMS[id] && S.items[id] > 0);
      if (snacks.length && !this.cfg.blitz) extras.push({ label: '🍊 Snack', value: 'snack', desc: 'Use an item from your bag (one per huddle).', disabled: this.snacked });
      if (side === 'off' && this.down === 4 && !this.cfg.blitz) {
        const kd = this.kickDist();
        extras.push({ label: `🥅 Field goal (${Math.round(kd)} yd)`, value: 'fg', cls: 'teal', disabled: kd > 46, desc: kd > 46 ? 'Too far to kick.' : 'Kick for 3 points. Stop the needle in the green.' });
        if (this.kind === 'match') extras.push({ label: '👟 Punt', value: 'punt', cls: 'teal', desc: 'Kick it away so they start deep in their own end.' });
      }
      const title = side === 'off' ? 'Call a play' : 'Call a coverage';
      const dd = this.ddText();
      const pickRes = await this.hudUI.huddle({
        title, side, sit: dd, plays, abilities: chips, extras, defaultId: this.lastCall && plays.some((p) => p.id === this.lastCall[side]) ? this.lastCall[side] : plays[0].id,
        onToggle: (id, on) => { if (on) this.armed.add(id); else this.armed.delete(id); this._squadBar(); },
      });
      if (pickRes.extra === 'swap') { this.curSquad = 1 - this.curSquad; this.armed.clear(); G.audio.sfx('whistle'); this._placeHuddle(); continue; }
      if (pickRes.extra === 'snack') { await this.snackMenu(); continue; }
      if (pickRes.extra === 'fg') return { kick: 'fg' };
      if (pickRes.extra === 'punt') return { kick: 'punt' };
      this.lastCall = this.lastCall || {};
      this.lastCall[side] = pickRes.play;
      const chosen = plays.find((p) => p.id === pickRes.play);
      return side === 'off' ? { off: chosen.play, offId: chosen.id, def: cpuCall } : { off: cpuCall, def: chosen.play, defId: chosen.id };
    }
  }

  ddText() {
    const togo = this.ltg >= this.L ? 'Goal' : Math.max(1, Math.round(this.ltg - this.los));
    return `${ordinal(this.down)} &amp; ${togo}`;
  }
  kickDist() { return (this.L - this.los) + this.EZ + 4; }

  cpuCall() {
    const t = this.team;
    if (this.poss === CPU) {
      // their offence
      const togo = this.ltg - this.los;
      let runRate = t.off.runRate;
      if (togo <= 3) runRate += 0.25; else if (togo >= 9) runRate -= 0.2;
      if (this.size < 5) runRate = 0;
      const run = t.off.run.length && chance(runRate);
      let list = run ? t.off.run : t.off.pass;
      if (!run && togo >= 9 && list.includes('cpu_deep') && chance(0.4)) list = ['cpu_deep'];
      return PLAYS[pick(list)];
    }
    const togo = this.ltg - this.los;
    let list = t.def.slice();
    if (togo <= 3 && list.includes('fence_line')) list.push('fence_line', 'fence_line');
    if (togo >= 9 && list.includes('zone_blanket')) list.push('zone_blanket');
    return DEF_PLAYS[pick(list)];
  }

  autoPlay(plays, side) {
    if (side === 'def') return pick(plays);
    const togo = this.ltg - this.los;
    const pool = plays.filter((p) => (togo <= 3 ? true : p.play.type === 'pass' || chance(0.3)));
    return pick(pool.length ? pool : plays);
  }

  async snackMenu() {
    const S = G.S;
    const ids = Object.keys(S.items).filter((id) => ITEMS[id] && S.items[id] > 0);
    const used = await G.ui.panel({
      title: '🍊 Snack break', cls: 'small',
      build: (body, api) => {
        for (const id of ids) {
          const it = ITEMS[id];
          body.append(el('button.card.focusable', { style: { display: 'block', width: '100%', textAlign: 'left', marginBottom: '0.4em' }, onclick: () => api.close(id) },
            el('div', { html: `<b>${it.icon} ${it.name}</b> ×${S.items[id]}` }), el('div.tiny.muted', it.desc)));
        }
      },
    });
    if (!used) return;
    const it = ITEMS[used];
    let target = null;
    if (it.heal) {
      const ids2 = this.squadIds();
      target = await G.ui.panel({
        title: `${it.icon} Who gets it?`, cls: 'small',
        build: (body, api) => {
          for (const id of ids2) {
            const e = this.mine[id];
            body.append(el('button.card.focusable', { style: { display: 'block', width: '100%', textAlign: 'left', marginBottom: '0.4em' }, onclick: () => api.close(id) }, `${displayName(id)} — ${Math.round(this.stOf(e))}/${e.maxSt}`));
          }
        },
      });
      if (!target) return;
      this.addSt(this.mine[target], it.heal);
    }
    if (it.healAll) for (const id of this.squadIds()) this.addSt(this.mine[id], it.healAll);
    if (it.cure) for (const id of this.squadIds()) for (const s of NEG) delete this.mine[id].status[s];
    if (it.buff === 'sticky') this.buff.sticky = true;
    if (it.buff === 'hype') this.buff.hype = true;
    addItem(used, -1, true);
    this.snacked = true;
    G.audio.sfx('item');
    G.ui.toast(`${it.icon} ${it.name} used`);
  }

  // ---------------------------------------------------------------- line up
  async lineUp(call) {
    this.phase = 'line';
    this.call = call;
    const play = call.off, dplay = call.def;
    this.play = play; this.dplay = dplay;
    // who is on the field
    const mineSide = this.poss === YOU ? 'off' : 'def';
    const lu = this.lineupFor(mineSide);
    const mineEnts = lu.map((m) => { const e = this.mine[m.id]; e.role = m.role; return e; });
    const cpuRoles = this.poss === YOU ? (this.size < 5 ? this.defRoles : CPU_DEF) : (this.size < 5 ? this.offRoles : CPU_OFF);
    const cpuEnts = this.foes.map((e, i) => { e.role = cpuRoles[i]; return e; });
    this.off = this.poss === YOU ? mineEnts : cpuEnts;
    this.def = this.poss === YOU ? cpuEnts : mineEnts;
    for (const e of Object.values(this.mine)) e.onField = mineEnts.includes(e);
    this.all = [...this.off, ...this.def];
    this._placeBench();
    const byRole = (list, r) => list.find((e) => e.role === r);
    this.role = (r) => byRole(this.off, r) || byRole(this.def, r);

    // formation spots
    const spots = [];
    for (const e of this.off) {
      const f = (play.form && play.form[e.role]) || OFF_FORM[e.role];
      spots.push([e, this.los + f[0], clamp(f[1], -this.HW + 1, this.HW - 1), 0]);
    }
    for (const e of this.def) {
      let f = DEF_FORM[e.role];
      if (dplay.S === 'robber' && e.role === 'S') f = [5.5, 0];
      if (dplay.rush.includes('LB') && e.role === 'LB') f = [1.6, 2.6];
      if (dplay.zones && dplay.zones[e.role] && e.role !== 'LB') f = [Math.min(f[0], dplay.zones[e.role][0]), f[1]];
      spots.push([e, Math.min(this.los + f[0], this.L + this.EZ - 1), clamp(f[1], -this.HW + 1, this.HW - 1), Math.PI]);
    }
    for (const [e] of spots) this._resetEnt(e);
    // jog to the line
    const from = spots.map(([e]) => [e.x, e.z]);
    const first = this.firstPlay;
    this.firstPlay = false;
    this.camZoomGoal = 1;
    await this.tween(first || G.debug.fast ? 0.01 : 0.7, (k) => {
      spots.forEach(([e, x, z, yaw], i) => {
        const nx = lerp(from[i][0], x, k), nz = lerp(from[i][1], z, k);
        e.vx = (nx - e.x) / 0.016 * 0.2; e.vz = (nz - e.z) / 0.016 * 0.2;
        e.x = nx; e.z = nz;
        e.yaw = k < 0.95 ? Math.atan2(x - from[i][0], z - from[i][1]) : (yaw === 0 ? Math.PI / 2 : -Math.PI / 2);
      });
    }, ease.inOut2);
    for (const [e, x, z, yaw] of spots) { e.x = x; e.z = z; e.vx = e.vz = 0; e.yaw = yaw === 0 ? Math.PI / 2 : -Math.PI / 2; e.home = { x, z }; }
    this.assignJobs();
    const qb = byRole(this.off, 'QB');
    this.ball.state = 'held'; this.ball.holder = byRole(this.off, 'LINE') || qb;
    // who do you steer?
    if (this.poss === YOU) {
      this.userEnt = play.type === 'run' && play.carrier !== 'QB' ? byRole(this.off, play.carrier) : qb;
      this.userMode = 'pre';
    } else {
      this.userEnt = byRole(this.def, dplay.S === 'robber' ? 'S' : 'S') || this.def[this.def.length - 1];
      if (this.size < 5) this.userEnt = this.def[this.def.length - 1];
      this.userMode = 'defender';
    }
    this._showUser(this.userEnt);
    this._bug();
    this._squadBar();
    if (!G.debug.fast && this.poss === YOU) G.ui.toast(`📋 <b>${play.name}</b>`, 1500);
    if (this.cfg.tutorial) await this.tutor('line');
  }

  _resetEnt(e) {
    e.job = 'idle'; e.engaged = null; e.downT = 0; e.stunT = 0; e.wind = 0; e.tackleCd = 0; e.iframes = 0; e.jukeCd = 0; e.spinCd = 0; e.spins = 0;
    e.burst = 0; e.dive = 0; e.slideT = 0; e.hist = []; e.route = null; e.ri = 0; e.target = null; e.zone = null; e.threw = false; e.fooled = 0;
    e.pancakes = 0; e.playDead = false; e.deadT = 0; e.stinky = 0; e.slideReady = false; e.snatch = false; e.userCtl = false; e.hasBall = false; e.confT = 0;
    e.syrT = 0; e.sneezeT = rand(2, 5); e.wrapT = 0; e.lag = 0;
    e.ch.setBase(e.ch.floaty ? 'float' : 'move'); e.ch.stop(); e.ch.setExpr('open');
    e.maxSp = speedOf(e.stats.spd);
  }

  assignJobs() {
    const play = this.play, dplay = this.dplay;
    const L = this.los;
    const role = (r) => this.all.find((e) => e.role === r);
    for (const e of this.off) {
      const rt = play.routes && play.routes[e.role];
      if (rt) e.route = rt.map(([dx, dz]) => ({ x: clamp(e.home.x + dx, -this.EZ + 1, this.L + this.EZ - 1), z: clamp(e.home.z + dz, -this.HW + 0.8, this.HW - 0.8) }));
      if (e.role === 'QB') e.job = play.type === 'run' && play.carrier === 'QB' ? 'runner' : 'qb';
      else if (e.role === 'LINE') e.job = play.type === 'run' ? 'runblock' : 'passblock';
      else if (play.type === 'run') e.job = play.carrier === e.role ? 'runner' : 'runblock';
      else e.job = rt ? 'route' : 'passblock';
      e.keyIdx = (play.keys || []).indexOf(e.role);
    }
    const lagBase = 0.44 - this.defIq() * 0.24;
    for (const e of this.def) {
      e.lag = lagBase * (1.15 - e.stats.agi * 0.03);
      if (dplay.rush.includes(e.role)) { e.job = 'rush'; continue; }
      if (dplay.man && dplay.man[e.role]) { const t = role(dplay.man[e.role]); if (t) { e.job = 'man'; e.target = t; continue; } }
      if (dplay.zones && dplay.zones[e.role]) { e.job = 'zone'; e.zone = { x: L + dplay.zones[e.role][0], z: dplay.zones[e.role][1] }; continue; }
      if (e.role === 'S') {
        if (dplay.S === 'double') { e.job = 'double'; e.target = role('WR1'); } else if (dplay.S === 'robber') { e.job = 'zone'; e.zone = { x: L + 5.5, z: 0 }; } else { e.job = 'deep'; }
        continue;
      }
      e.job = 'zone'; e.zone = { x: e.home.x + 2, z: e.home.z };
    }
    if (this.size < 5) { for (const e of this.def) if (e.job === 'rush') e.rushDelay = this.cfg.rushDelay ?? 2.2; }
  }
  /** IQ of whoever is on defence: the CPU's, or a fixed value for your AI teammates. */
  defIq() { return this.poss === YOU ? this.iq : 0.72; }
  offIq() { return this.poss === CPU ? this.iq : 0.62; }

  // ---------------------------------------------------------------- snap
  async snap() {
    this.phase = 'snap';
    const youOff = this.poss === YOU;
    const tempo = this.cfg.tutorial ? 0.62 : rand(0.44, 0.56);
    let grade = 'ok';
    if (this.auto) {
      grade = pick(['perfect', 'good', 'good', 'ok', 'ok', 'late']);
      await this.wait(0.25);
    } else {
      if (this.cfg.tutorial) await this.tutor('snap');
      this.hudUI.showSnap(youOff ? `Press ${G.ui.key('a')} on <b>HIKE!</b>` : `Time your jump: ${G.ui.key('a')} on <b>HIKE!</b>`);
      this.snapBeat = -0.6; this.snapTempo = tempo; this.snapPress = null; this._lastBeat = 0;
      await this.until((dt) => {
        this.snapBeat += dt / tempo;
        const b = Math.floor(this.snapBeat);
        if (b > this._lastBeat && b >= 1 && b <= 3) { this._lastBeat = b; G.audio.sfx(b === 3 ? 'hike' : 'hut'); }
        this.hudUI.updateSnap(this.snapBeat);
        if (this.snapPress === null && this.snapBeat > 0.2 && G.input.take('a')) this.snapPress = this.snapBeat;
        return this.snapPress !== null || this.snapBeat > 3.7;
      });
      const err = this.snapPress === null ? 9 : Math.abs(this.snapPress - 3) * tempo;
      if (this.snapPress !== null && this.snapPress < 3 - 0.3 / tempo) grade = 'early';
      else if (err <= 0.065) grade = 'perfect';
      else if (err <= 0.15) grade = 'good';
      else if (err <= 0.3) grade = 'ok';
      else grade = 'late';
      this.hudUI.hideSnap();
    }
    this.snapGrade = grade;
    const c = this.role('LINE') || this.role('QB');
    const text = { perfect: 'PERFECT SNAP!', good: 'Good snap', ok: 'Snap', late: 'LATE!', early: 'FLINCH!' }[grade];
    if (youOff) {
      this.pop(c, text, grade === 'perfect' ? 'big' : grade === 'good' ? '' : grade === 'ok' ? 'white small' : 'bad');
    } else {
      this.pop(this.userEnt, { perfect: 'GREAT JUMP!', good: 'Good jump', ok: '', late: 'SLOW OFF THE BALL', early: 'JUMPED EARLY!' }[grade], grade === 'perfect' ? 'big' : grade === 'good' ? '' : 'bad');
    }
    if (grade === 'perfect') { G.audio.sfx('perfect'); this.fx.sparkle(this.wpos(c, 1.2), 0xfff2a8, 10); } else if (grade === 'good') G.audio.sfx('good'); else if (grade !== 'ok') G.audio.sfx('miss');
    // what the grade does
    const tbl = { perfect: [1.42, 0.45], good: [1.2, 0.2], ok: [1, 0], late: [0.78, 0], early: [0.72, 0] };
    if (youOff) {
      this.blockBonus = tbl[grade][0] * (this.cfg.blindside ? 1.25 : 1);
      this.rushHold = tbl[grade][1] + (this.cfg.blindside ? 0.3 : 0);
      this.defJump = 1;
    } else {
      this.blockBonus = { perfect: 0.72, good: 0.88, ok: 1, late: 1.15, early: 1.2 }[grade];
      this.rushHold = grade === 'early' || grade === 'late' ? 0.4 : 0;
      this.defJump = grade === 'perfect' ? 0.8 : grade === 'good' ? 0.9 : 1;
      if (grade === 'perfect' || grade === 'good') for (const e of this.def) e.lag *= this.defJump;
    }
    // abilities fire
    this.lightsOut = 0;
    for (const id of this.armed) {
      const e = this.mine[id];
      if (!e || !e.onField) continue;
      const abId = CAST[id].ability, ab = ABILITIES[abId];
      this.addSt(e, -ab.cost);
      this.pop(e, `${ab.icon} ${ab.name}`, 'small', 1.3);
      if (abId === 'rally') { G.audio.sfx('whistle'); for (const m of (youOff ? this.off : this.def)) { m.status.hyped = Math.max(m.status.hyped || 0, 1); for (const s of NEG) delete m.status[s]; this.fx.sparkle(this.wpos(m, 1.4), 0xffb347, 5); } }
      if (abId === 'playdead') e.playDead = true;
      if (abId === 'pancake') e.pancakes = 1;
      if (abId === 'doubletake') this.spawnDecoy(e);
      if (abId === 'lightsout') { this.lightsOut = 5; G.audio.sfx('flutter'); }
      if (abId === 'stinky') e.stinky = 4.5;
      if (abId === 'bellyslide') e.slideReady = true;
      if (abId === 'snatch') e.snatch = true;
    }
    if (this.buff.hype && youOff) { for (const m of this.off) m.status.hyped = Math.max(m.status.hyped || 0, 1); this.buff.hype = false; }
    if (this.play.stack && youOff) { const ln = this.role('LINE'); if (ln) ln.pancakes = Math.max(ln.pancakes, 2); }
    if (this.play.nolook && youOff) { const t = this.role(this.play.nolook); for (const d of this.def) if (d.target === t) d.fooled = 1.3; }
    if (this.play.flutter && youOff) for (const d of this.def) if (d.job === 'man') d.lag *= 2.1;
    if (this.play.fake === 'handoff') for (const d of this.def) if (d.role === 'LB' || d.role === 'S') d.bite = 0.95;
    if (this.play.fake === 'pass') for (const d of this.def) if (d.role !== 'RUSH') d.bail = 1.0;
    this._squadBar();
  }

  spawnDecoy(src) {
    const ch = new Character({ ...teamSpec(src.key) });
    ch.root.scale.multiplyScalar(SCALE);
    ch.root.traverse((o) => { if (o.material && !Array.isArray(o.material)) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = Math.min(o.material.opacity, 0.6); } });
    this.scene.add(ch.root);
    const d = { decoy: true, team: src.team, key: `${src.key}_decoy`, name: 'decoy', ch, stats: src.stats, x: src.x, z: src.z + (src.z > 0 ? -1.4 : 1.4), vx: 0, vz: 0, yaw: src.yaw, status: {}, hist: [], histT: 0, role: 'DECOY', job: 'route', downT: 0, stunT: 0, maxSp: speedOf(src.stats.spd), life: 4.2, ri: 0 };
    // mirror the route across the receiver's own lane
    d.route = (src.route || [{ x: src.x + 8, z: src.z }]).map((p) => ({ x: p.x, z: clamp(src.home.z - (p.z - src.home.z), -this.HW + 0.8, this.HW - 0.8) }));
    this.decoy = d;
    this.all.push(d);
    // the nearest coverage defender (or the safety) chases the wrong one
    let best = null, bd = 1e9;
    for (const e of this.def) { if (e.job !== 'man' && e.job !== 'deep' && e.job !== 'double') continue; const dd = e.target === src ? 0 : dist(e.x, e.z, src.x, src.z) + (e.job === 'deep' ? 2 : 6); if (dd < bd) { bd = dd; best = e; } }
    if (best) { best.realTarget = best.target; best.realJob = best.job; best.job = 'man'; best.target = d; best.fooledBy = 3.2; }
    G.audio.sfx('pop');
    this.fx.burst('puff', this.wpos(d, 1), 8, { speed: 2, up: 1.5, life: 0.4, s0: 0.5, g: 0 });
  }

  // ================================================================ live play
  live() {
    this.phase = 'live';
    this.playT = 0;
    this.sub = 'pocket';
    this.carrier = null;
    this.result = null;
    this.endT = 0;
    this.catchPress = null;
    this.pickPress = null;
    this.pressure = false;
    const play = this.play;
    const qb = this.role('QB');
    const ln = this.role('LINE');
    if (ln) ln.ch.play('snap');
    this.ball.holder = qb; qb.hasBall = true;
    qb.readAt = (1.75 - this.offIq() * 0.75) * (this.defJump < 1 ? 1.12 : 1) + (this.lightsOut ? 1.35 : 0);
    qb.lastRead = 0;
    if (play.type === 'run') {
      if (play.carrier === 'QB') { this.sub = 'run'; this.startRun(qb, true); } else this.sub = 'handoff';
    }
    if (this.poss === YOU) {
      if (play.type === 'run') this.userMode = play.carrier === 'QB' ? 'carrier' : 'wait';
      else this.userMode = 'qb';
      // Glitched: shuffle which button throws to whom
      if (this.off.some((e) => this.has(e, 'glitch'))) { const ks = this.off.filter((e) => e.keyIdx >= 0); const idx = ks.map((e) => e.keyIdx).sort(() => Math.random() - 0.5); ks.forEach((e, i) => { e.keyIdx = idx[i]; }); }
    } else this.userMode = 'defender';
    G.audio.sfx('hike');
    if (this.cfg.tutorial) this.tutorLive();
    return new Promise((res) => { this._liveRes = res; });
  }

  endPlay(res) {
    if (this.result) return;
    this.result = res;
    this.endT = res.type === 'td' || res.type === 'ret_td' ? 1.3 : 0.75;
    G.audio.sfx('whistle');
    this.ringOut.visible = this.ringIn.visible = false;
    this.hudUI.clearTargets();
    this.hudUI.setHint('');
  }

  // ---------------------------------------------------------------- per-frame sim
  simLive(dt) {
    if (this.result) {
      this.endT -= dt;
      for (const e of this.all) { e.vx = damp(e.vx, 0, 6, dt); e.vz = damp(e.vz, 0, 6, dt); this._tick(e, dt); e.x += e.vx * dt; e.z += e.vz * dt; }
      if (this.endT <= 0 && this._liveRes) { const r = this._liveRes; this._liveRes = null; this.phase = 'dead'; r(this.result); }
      return;
    }
    this.playT += dt;
    this.hazards(dt);
    this.userControl(dt);
    for (const e of this.all) { this._tick(e, dt); this.think(e, dt); }
    for (const e of this.all) this.integrate(e, dt);
    this.contacts(dt);
    this.ballUpdate(dt);
    this.rules();
    if (this.decoy) { this.decoy.life -= dt; if (this.decoy.life <= 0 || this.sub === 'run' || this.sub === 'return') this.killDecoy(); }
    if (this.lightsOut > 0) this.lightsOut -= dt;
  }

  killDecoy() {
    const d = this.decoy;
    if (!d) return;
    this.fx.burst('puff', this.wpos(d, 1), 8, { speed: 2, up: 1.5, life: 0.4, s0: 0.5, g: 0 });
    d.ch.dispose();
    this.all = this.all.filter((e) => e !== d);
    for (const e of this.def) if (e.target === d) { e.target = e.realTarget; e.job = e.realJob || 'pursue'; this.pop(e, '!?', 'white small'); }
    this.decoy = null;
  }

  _tick(e, dt) {
    if (e.downT > 0) { e.downT -= dt; if (e.downT <= 0 && !this.result) { e.ch.setBase(e.ch.floaty ? 'float' : 'move'); e.ch.play('getup'); e.ch.setExpr('open'); } }
    if (e.stunT > 0) e.stunT -= dt;
    if (e.confT > 0) e.confT -= dt;
    if (e.iframes > 0) e.iframes -= dt;
    if (e.jukeCd > 0) e.jukeCd -= dt;
    if (e.spinCd > 0) e.spinCd -= dt;
    if (e.tackleCd > 0) e.tackleCd -= dt;
    if (e.burst > 0) e.burst -= dt;
    if (e.syrT > 0) e.syrT -= dt;
    if (e.stinky > 0) e.stinky -= dt;
    if (e.fooled > 0) e.fooled -= dt;
    if (e.bite > 0) e.bite -= dt;
    if (e.bail > 0) e.bail -= dt;
    if (e.fooledBy > 0) { e.fooledBy -= dt; if (e.fooledBy <= 0 && e.target && e.target.decoy) { e.target = e.realTarget; e.job = e.realJob || 'man'; this.pop(e, '!?', 'white small'); } }
    e.histT += dt;
    if (e.histT > 0.05) { e.histT = 0; e.hist.unshift({ x: e.x, z: e.z }); if (e.hist.length > 14) e.hist.pop(); }
  }

  free(e) { return e.downT <= 0 && e.stunT <= 0 && e.confT <= 0 && !e.engaged && !e.decoy; }
  alive(e) { return e.downT <= 0 && !e.decoy; }
  speed(e) {
    let s = e.maxSp;
    if (this.has(e, 'hyped')) s *= 1.12;
    if (this.has(e, 'soggy')) s *= 0.78;
    if (e.syrT > 0) s *= 0.5;
    if (!e.decoy && this.tired(e)) s *= 0.86;
    if (e.burst > 0) s *= 1.28;
    if (e.hasBall) s *= 0.97;
    return s;
  }
  onIce(e) {
    if (this.has(e, 'freeze')) return true;
    const hz = this.field.hz;
    if (hz.type !== 'ice') return false;
    const x = this.wx(e.x), z = this.wz(e.z);
    for (const h of hz.list) if (Math.abs(x - h.x) < h.w / 2 && Math.abs(z - h.z) < h.d / 2) return true;
    return false;
  }

  /** Set an entity's desired velocity toward a point. k = fraction of top speed. */
  go(e, tx, tz, k = 1, arrive = 0.25) {
    const dx = tx - e.x, dz = tz - e.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) { e.dvx = 0; e.dvz = 0; return d; }
    const s = this.speed(e) * k * Math.min(1, d / 0.8 + 0.35);
    e.dvx = (dx / d) * s; e.dvz = (dz / d) * s;
    return d;
  }

  nearestFoe(e, list, max = 99) {
    let best = null, bd = max;
    for (const o of list) { if (!this.alive(o)) continue; const d = dist(e.x, e.z, o.x, o.z); if (d < bd) { bd = d; best = o; } }
    return best ? { e: best, d: bd } : null;
  }
  openness(r) {
    let m = 99;
    for (const d of this.def) { if (d.downT > 0 || d.stunT > 0 || d.confT > 0) continue; m = Math.min(m, dist(r.x, r.z, d.x, d.z)); }
    return m;
  }

  // ---------------------------------------------------------------- AI
  think(e, dt) {
    if (e.userCtl) return;          // you (or the autopilot) already set this one's heading
    e.dvx = 0; e.dvz = 0;
    if (e.downT > 0 || e.stunT > 0 || e.confT > 0 || e.deadT > 0) return;
    if (e.engaged) return;
    const t = this.playT;
    const c = this.carrier;
    const offense = this.off.includes(e) || e.decoy;
    switch (e.job) {
      case 'qb': if (this.poss === CPU) this.cpuQB(e, dt); break;
      case 'route': {
        const r = e.route;
        if (r && e.ri < r.length) {
          const d = this.go(e, r[e.ri].x, r[e.ri].z, 0.96, 0.5);
          if (d < 0.6) e.ri++;
        } else if (!e.decoy) {
          // scramble drill: drift to open grass
          const nf = this.nearestFoe(e, this.def, 6);
          let tx = e.x + 1.2, tz = e.z;
          if (nf) { tx = e.x + (e.x - nf.e.x) * 0.8 + 0.6; tz = e.z + (e.z - nf.e.z) * 0.8; }
          this.go(e, clamp(tx, this.los + 1, this.L + this.EZ - 1.5), clamp(tz, -this.HW + 1, this.HW - 1), 0.62, 0.3);
        } else this.go(e, e.x + 3, e.z, 0.9);
        break;
      }
      case 'toBall': this.go(e, this.ball.to.x, this.ball.to.z, 1, 0.15); break;
      case 'passblock': {
        if (this.play.release && t > this.play.release && offense) { e.job = 'leadblock'; break; }
        const qb = this.role('QB');
        let tg = null, bd = 9;
        for (const d of this.def) { if (d.job !== 'rush' || !this.free(d)) continue; const dd = dist(d.x, d.z, qb.x, qb.z); if (dd < bd) { bd = dd; tg = d; } }
        if (tg) this.go(e, lerp(qb.x, tg.x, 0.62), lerp(qb.z, tg.z, 0.62), 1, 0.2);
        else this.go(e, qb.x + 1.6, qb.z + (e.role === 'BACK' ? 1.6 : 0), 0.6, 0.4);
        break;
      }
      case 'runblock': case 'leadblock': {
        const ball = c || this.role(this.play.carrier || 'QB') || e;
        const dirG = this.goalDir();
        let tg = null, bs = 1e9;
        for (const d of this.opp(e)) {
          if (!this.free(d)) continue;
          const ahead = (d.x - ball.x) * dirG;
          const dd = dist(d.x, d.z, e.x, e.z) + dist(d.x, d.z, ball.x, ball.z) * 0.6 - Math.min(ahead, 6) * 0.4;
          if (dd < bs) { bs = dd; tg = d; }
        }
        if (e.job === 'runblock' && e.route && e.ri < e.route.length && t < 0.9) { const d = this.go(e, e.route[e.ri].x, e.route[e.ri].z, 0.95, 0.5); if (d < 0.6) e.ri++; } else if (tg) this.go(e, tg.x, tg.z, 1, 0.2);
        else this.go(e, ball.x + dirG * 3, ball.z, 0.8);
        break;
      }
      case 'runner': {
        if (this.sub === 'handoff') {
          const qb = this.role('QB');
          this.go(e, qb.x + 0.7, qb.z + (e.home.z > qb.z ? 0.5 : -0.5), 0.9, 0.2);
        }
        break;
      }
      case 'carrier': this.cpuCarrier(e, dt); break;
      case 'rush': {
        if (t < this.rushHold || (e.rushDelay && t < e.rushDelay)) break;
        const tgt = c || this.ball.holder || this.role('QB');
        if (this.sub === 'air') { this.go(e, this.ball.to.x, this.ball.to.z, 0.9); break; }
        this.go(e, tgt.x, tgt.z, 1, 0.1);
        break;
      }
      case 'man': case 'double': {
        const tg = e.target;
        if (!tg || tg.downT > 0) { e.job = 'pursue'; break; }
        if (e.bite > 0) { this.go(e, this.los + 1.5, e.z * 0.7, 0.8); break; }
        if (e.fooled > 0) { this.go(e, tg.x + 1.5, -tg.z * 0.4, 0.9); break; }
        const k = clamp(Math.round(e.lag / 0.05), 0, tg.hist.length - 1);
        const h = tg.hist[k] || tg;
        const deep = tg.x - this.los > 13;
        const cushion = e.job === 'double' ? 2.6 : (e.bail > 0 ? 3.5 : deep ? 0.2 : 1.0);
        this.go(e, h.x + cushion, h.z + (e.job === 'double' ? -Math.sign(h.z) * 1.2 : -Math.sign(h.z) * 0.35), 1, 0.2);
        break;
      }
      case 'zone': {
        if (e.bite > 0) { this.go(e, this.los + 1.2, e.z * 0.6, 0.8); break; }
        let tx = e.zone.x + (e.bail > 0 ? 3 : 0), tz = e.zone.z;
        let near = null, nd = 7;
        for (const o of this.off) { if (o.role === 'QB' || o.role === 'LINE') continue; const dd = dist(o.x, o.z, e.zone.x, e.zone.z); if (dd < nd) { nd = dd; near = o; } }
        if (near) { tx = lerp(tx, near.x + 0.8, 0.62); tz = lerp(tz, near.z, 0.62); }
        this.go(e, tx, tz, 0.92, 0.25);
        break;
      }
      case 'deep': {
        if (e.bite > 0) { this.go(e, this.los + 4, 0, 0.8); break; }
        let deepest = null;
        for (const o of this.off) { if (o.role === 'QB' || o.role === 'LINE') continue; if (!deepest || o.x > deepest.x) deepest = o; }
        const tx = Math.max(this.los + 9 + (e.bail > 0 ? 3 : 0), (deepest ? deepest.x : this.los) + 3.2);
        const tz = deepest && deepest.x - this.los > 6 ? deepest.z * 0.55 : 0;
        this.go(e, Math.min(tx, this.L + this.EZ - 1), tz, 0.95, 0.3);
        break;
      }
      case 'pursue': {
        if (!c) { const h = this.ball.holder; if (h) this.go(e, h.x, h.z, 1, 0.1); break; }
        const d = dist(e.x, e.z, c.x, c.z);
        const lead = clamp(d / (this.speed(e) * 1.5), 0, 0.55);
        this.go(e, c.x + c.vx * lead, c.z + c.vz * lead, 1, 0.05);
        break;
      }
      default: break;
    }
  }

  goalDir() { return this.carrier && this.carrier.team !== (this.poss === YOU ? YOU : CPU) ? -1 : 1; }
  opp(e) { const mineOff = this.off.includes(e); return mineOff ? this.def : this.off; }
  mates(e) { return this.off.includes(e) ? this.off : this.def; }

  cpuQB(q, dt) {
    const t = this.playT;
    if (q.threw || this.sub !== 'pocket') return;
    const rush = this.nearestFoe(q, this.def.filter((d) => this.free(d) && (d.job === 'rush' || d.job === 'pursue' || d.userCtl)), 12);
    const pr = rush ? rush.d : 99;
    this.pressure = pr < 2.6;
    if (t < 0.75) this.go(q, this.los - 4.8, 0, 0.8, 0.2);
    else if (rush && pr < 4) this.go(q, q.x - (rush.e.x - q.x) * 0.5, q.z - (rush.e.z - q.z) * 0.9, 0.7, 0.1);
    q.z = clamp(q.z, -this.HW + 1, this.HW - 1);
    if (t < q.readAt && pr > 2.2) return;
    if (t - q.lastRead < 0.22) return;
    q.lastRead = t;
    let best = null, bo = -1;
    for (const r of this.off) {
      if (r.keyIdx < 0 || r.downT > 0 || r.x < this.los - 1) continue;
      const o = this.openness(r) + clamp((r.x - this.los) * 0.03, 0, 0.5);
      if (o > bo) { bo = o; best = r; }
    }
    const thr = lerp(2.5, 1.35, clamp((t - q.readAt) / 2, 0, 1)) + (this.lightsOut > 0 ? -0.6 : 0);
    if (best && (bo > thr || (pr < 2.3 && bo > 0.9) || t > 4)) { this.throwTo(q, best); return; }
    if (pr < 1.9 && t > 1) {
      if (chance(0.3 + q.stats.agi * 0.03)) { this.startRun(q); return; }
      if (chance(0.5)) { this.throwAway(q); }
    } else if (t > 4.6) this.throwAway(q);
  }

  cpuCarrier(e, dt) {
    const dir = this.goalDir();
    let fx = dir, fz = 0;
    for (const o of this.opp(e)) {
      if (!this.alive(o) || o.stunT > 0 || o.engaged) continue;
      const dx = e.x - o.x, dz = e.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d > 7 || (o.x - e.x) * dir < -1.5) continue;
      const w = 3.4 / (d * d + 0.6);
      fz += (dz / (d || 1)) * w * 1.5; fx += (dx / (d || 1)) * w * 0.25;
    }
    if (Math.abs(e.z) > this.HW - 2.2) fz -= Math.sign(e.z) * 1.6;
    const m = Math.hypot(fx, fz) || 1;
    e.dvx = (fx / m) * this.speed(e); e.dvz = (fz / m) * this.speed(e);
    if (e.dvx * dir < this.speed(e) * 0.25) e.dvx = dir * this.speed(e) * 0.25;
    if (e.slideT > 0) { e.dvx = dir * 13; e.dvz *= 0.3; }
  }

  // ---------------------------------------------------------------- you
  input() {
    const inp = G.input;
    if (G.ui.busy) return { x: 0, z: 0 };
    const a = inp.axis();
    let x = a.x, z = a.y;
    if (this.flip) { x = -x; z = -z; }
    const u = this.userEnt;
    if (u && this.has(u, 'dizzy')) { const w = Math.sin(this.clock * 2.3) * 0.75; const cx = x * Math.cos(w) - z * Math.sin(w), cz = x * Math.sin(w) + z * Math.cos(w); x = cx; z = cz; }
    return { x, z };
  }

  userControl(dt) {
    const inp = G.input;
    const u = this.userEnt;
    for (const e of this.all) e.userCtl = false;
    if (this.auto) { this.autoControl(dt); return; }
    if (!u || G.ui.busy) return;
    const mv = this.input();
    const drive = (k = 1) => {
      if (u.downT > 0 || u.stunT > 0 || u.engaged || u.deadT > 0) return;
      u.userCtl = true;
      const s = this.speed(u) * k;
      u.dvx = mv.x * s; u.dvz = mv.z * s;
      if (u.slideT > 0) { u.dvx = this.goalDir() * 13; u.dvz = mv.z * 4; }
    };
    if (this.userMode === 'qb') {
      if (this.sub !== 'pocket') return;
      if (u.deadT > 0) return;
      drive(0.82);
      if (inp.take('a')) this.juke(u, mv);
      for (const r of this.off) if (r.keyIdx >= 0 && inp.targetHit(r.keyIdx)) { this.throwTo(u, r); return; }
      if (u.x > this.los + 0.5) { this.startRun(u); G.ui.toast('Scramble!', 900); }
    } else if (this.userMode === 'carrier') {
      drive(1);
      if (inp.take('a')) this.juke(u, mv);
      if (inp.take('b')) this.spin(u);
      if (inp.take('y')) this.lateral(u);
    } else if (this.userMode === 'air') {
      if (this.catchPress === null && inp.take('a')) this.catchPress = this.ball.t;
    } else if (this.userMode === 'defender') {
      if (inp.take('y') || inp.take('l') || inp.take('x')) this.switchDefender();
      const d = this.userEnt;
      if (d.dive > 0) { d.userCtl = true; return; }
      drive(1.04);
      if (inp.take('a')) {
        if (this.sub === 'air' && this.pickPress === null) { this.pickPress = this.ball.t; d.ch.play('catch'); } else this.diveTackle(d, mv);
      }
    }
  }

  switchDefender() {
    const tgt = this.carrier || this.ball.holder || (this.sub === 'air' ? this.ball.to : null);
    if (!tgt) return;
    const mineList = (this.carrier && this.carrier.team === CPU && this.poss === YOU) ? this.off : (this.poss === CPU ? this.def : this.off);
    let best = null, bd = 1e9;
    for (const e of mineList) { if (!this.free(e) || e === this.userEnt) continue; const d = dist(e.x, e.z, tgt.x, tgt.z); if (d < bd) { bd = d; best = e; } }
    if (best) { this.userEnt = best; this._showUser(best); G.audio.sfx('move'); }
  }

  juke(e, mv) {
    if (e.jukeCd > 0 || e.downT > 0 || e.stunT > 0) return false;
    if (this.has(e, 'soggy')) { this.pop(e, 'Too soggy!', 'cool small'); return false; }
    if (this.stOf(e) < 3) return false;
    e.jukeCd = 0.75; e.iframes = 0.27;
    this.addSt(e, -3);
    // sidestep: perpendicular to travel, on the side you're leaning
    const sp = Math.hypot(e.vx, e.vz) || 1;
    const px = -e.vz / sp, pz = e.vx / sp;
    let side = Math.sign(px * mv.x + pz * mv.z);
    if (!side) side = chance(0.5) ? 1 : -1;
    e.vx += px * side * 7.5; e.vz += pz * side * 7.5;
    e.ch.jukeDir = side; e.ch.play('juke');
    G.audio.sfx('juke');
    this.fx.dust(this.wx(e.x), this.wz(e.z), 0xf4ead0, 3);
    return true;
  }
  spin(e) {
    if (e.spinCd > 0 || e.downT > 0 || e.stunT > 0 || this.stOf(e) < 5) return false;
    e.spinCd = 1.1; e.iframes = 0.42; e.spins++;
    this.addSt(e, -5);
    e.ch.play('spin');
    G.audio.sfx('spin');
    if (e.spins >= 3) this.give(e, 'dizzy', 2);
    return true;
  }
  lateral(e) {
    let best = null, bd = 9.5;
    for (const m of this.mates(e)) {
      if (m === e || !this.free(m) || m.x * this.goalDir() > e.x * this.goalDir() + 0.6) continue;
      const d = dist(e.x, e.z, m.x, m.z);
      if (d < bd && d > 1) { bd = d; best = m; }
    }
    if (!best) { this.pop(e, 'Nobody behind you!', 'white small'); return; }
    this.addSt(e, -2);
    e.ch.play('toss');
    G.audio.sfx('lateral');
    // a defender in the lane can swat it loose
    let risk = 0;
    for (const d of this.opp(e)) { if (!this.free(d)) continue; const mx = (e.x + best.x) / 2, mz = (e.z + best.z) / 2; if (dist(d.x, d.z, mx, mz) < 1.4) risk = 0.3; }
    const ladder = this.play.ladder && e.role === this.play.ladder.from && best.role === this.play.ladder.to;
    if (ladder) risk = 0;
    e.hasBall = false;
    this.carrier = null;
    this.sub = 'lateral';
    this.userMode = 'none';
    this.ball.state = 'air';
    this.ball.from = { x: e.x, y: 1.3, z: e.z }; this.ball.to = { x: best.x, z: best.z }; this.ball.t = 0; this.ball.T = clamp(bd / 16, 0.16, 0.45); this.ball.target = best; this.ball.arc = 0.6;
    this.ball.lateral = { from: e, to: best, risk, ladder };
  }

  diveTackle(d, mv) {
    if (d.downT > 0 || d.stunT > 0 || d.dive > 0 || d.engaged) return;
    let dx = mv.x, dz = mv.z;
    const c = this.carrier || this.ball.holder;
    if (!dx && !dz) { if (c) { dx = c.x - d.x; dz = c.z - d.z; } else { dx = Math.sin(d.yaw); dz = Math.cos(d.yaw); } }
    // light aim assist toward the ball carrier
    if (c) { const cd = dist(d.x, d.z, c.x, c.z); if (cd < 4.5) { const ax = (c.x + c.vx * 0.12 - d.x) / cd, az = (c.z + c.vz * 0.12 - d.z) / cd; const m0 = Math.hypot(dx, dz) || 1; dx = dx / m0 * 0.45 + ax * 0.55; dz = dz / m0 * 0.45 + az * 0.55; d.diveDist = cd; } else d.diveDist = 99; }
    const m = Math.hypot(dx, dz) || 1;
    d.dive = 0.34; d.diveX = dx / m; d.diveZ = dz / m; d.diveHit = false;
    d.ch.play('dive', 0.5);
    this.addSt(d, -2);
    G.audio.sfx('juke');
    // the runner decides right now whether it saw you coming
    if (c && c.team === CPU && !c.userCtl) { const p = (0.06 + c.stats.agi * 0.022) * (d.diveDist < 2.4 ? 0.45 : 1) * (this.tired(c) ? 0.5 : 1); d.willMiss = chance(p); } else d.willMiss = false;
  }

  // ---------------------------------------------------------------- movement
  integrate(e, dt) {
    if (e.deadT > 0) { e.deadT -= dt; e.vx = e.vz = 0; if (e.deadT <= 0) { e.ch.setBase('move'); e.ch.play('getup'); e.ch.setExpr('open'); } return; }
    if (e.downT > 0 || e.stunT > 0 || e.confT > 0) { e.vx = damp(e.vx, 0, 8, dt); e.vz = damp(e.vz, 0, 8, dt); e.x += e.vx * dt; e.z += e.vz * dt; this._bounds(e); return; }
    if (e.engaged) return;
    if (e.dive > 0) {
      e.dive -= dt;
      e.vx = e.diveX * 12.5; e.vz = e.diveZ * 12.5;
      e.x += e.vx * dt; e.z += e.vz * dt;
      e.yaw = Math.atan2(e.vx, e.vz);
      if (e.dive <= 0) { if (!e.diveHit) { e.downT = 0.85; e.ch.setBase('down'); this.fx.dust(this.wx(e.x), this.wz(e.z)); } }
      this._bounds(e);
      return;
    }
    if (e.wind > 0) {
      // lunging at the ball carrier
      const h = e.windTarget;
      if (h) { const tx = h.x + h.vx * 0.08, tz = h.z + h.vz * 0.08; const d = Math.hypot(tx - e.x, tz - e.z) || 1; const s = this.speed(e) * 1.12; e.vx = damp(e.vx, ((tx - e.x) / d) * s, 14, dt); e.vz = damp(e.vz, ((tz - e.z) / d) * s, 14, dt); e.yaw = Math.atan2(e.vx, e.vz); }
      e.x += e.vx * dt; e.z += e.vz * dt;
      this._bounds(e);
      return;
    }
    const acc = this.onIce(e) ? 1.6 : (e.userCtl ? 17 : 9 + e.stats.agi * 0.9);
    e.vx = damp(e.vx, e.dvx || 0, acc, dt);
    e.vz = damp(e.vz, e.dvz || 0, acc, dt);
    // stinky cheese: defenders can't stand to be near
    if (!this.off.includes(e)) for (const o of this.off) if (o.stinky > 0) { const d = dist(e.x, e.z, o.x, o.z); if (d < 3.2 && d > 0.01) { e.vx += ((e.x - o.x) / d) * 26 * dt; e.vz += ((e.z - o.z) / d) * 26 * dt; } }
    e.x += e.vx * dt; e.z += e.vz * dt;
    const sp = Math.hypot(e.vx, e.vz);
    if (sp > 0.7) e.yaw += wrapAngle(Math.atan2(e.vx, e.vz) - e.yaw) * (1 - Math.exp(-14 * dt));
    this._bounds(e);
  }
  _bounds(e) {
    const carrier = e === this.carrier || (e.hasBall && this.sub === 'pocket');
    if (!carrier) { e.z = clamp(e.z, -this.HW - 0.6, this.HW + 0.6); e.x = clamp(e.x, -this.EZ + 0.3, this.L + this.EZ - 0.3); } else e.x = clamp(e.x, -this.EZ + 0.4, this.L + this.EZ - 0.4);
    // solid hazards (hay bales)
    const hz = this.field.hz;
    if (hz.type === 'bales') {
      const wx = this.wx(e.x), wz = this.wz(e.z);
      for (const h of hz.list) { const d = Math.hypot(wx - h.x, wz - h.z); const rr = h.r + 0.45; if (d < rr && d > 0.001) { const nx = (wx - h.x) / d, nz = (wz - h.z) / d; const px = h.x + nx * rr, pz = h.z + nz * rr; e.x = this.flip ? this.L - px : px; e.z = this.flip ? -pz : pz; e.vx += (this.flip ? nz : -nz) * 0.6; e.vz += (this.flip ? -nx : nx) * 0.6; } }
    }
  }

  // ---------------------------------------------------------------- blocking, tackling, hazards
  contacts(dt) {
    const c = this.carrier;
    // soft separation so nobody stands inside anybody
    const list = this.all;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.decoy) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.decoy || a.engaged === b) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        const rr = 0.86;
        if (d2 < rr * rr && d2 > 1e-5) {
          const d = Math.sqrt(d2), p = (rr - d) * 0.5;
          const wa = a.downT > 0 ? 0.1 : 1, wb = b.downT > 0 ? 0.1 : 1;
          a.x -= (dx / d) * p * wa; a.z -= (dz / d) * p * wa; b.x += (dx / d) * p * wb; b.z += (dz / d) * p * wb;
        }
      }
    }
    // blocks
    for (const b of list) {
      if (b.decoy || !this.free(b) || b.userCtl || b.hasBall) continue;
      if (b.job !== 'passblock' && b.job !== 'runblock' && b.job !== 'leadblock') continue;
      for (const d of this.opp(b)) {
        if (!this.free(d) || d.dive > 0 || d.wind > 0) continue;
        if (b.job === 'passblock' && d.job !== 'rush' && d.job !== 'pursue' && !d.userCtl) continue;
        if (dist(b.x, b.z, d.x, d.z) > 1.15) continue;
        this.engage(b, d);
        break;
      }
    }
    for (const d of list) {
      const b = d.engaged;
      if (!b || !d.shedT) continue;
      // d is the one being blocked
      d.shedT -= dt * (d.userCtl ? 1.5 : 1);
      const tgt = c || this.ball.holder || this.role('QB');
      const dx = tgt.x - d.x, dz = tgt.z - d.z, m = Math.hypot(dx, dz) || 1;
      const push = 0.55 * (d.stats.str / (b.stats.str || 1));
      d.x += (dx / m) * push * dt; d.z += (dz / m) * push * dt;
      b.x = d.x + (dx / m) * 0.75; b.z = d.z + (dz / m) * 0.75;
      b.yaw = Math.atan2(-dx, -dz); d.yaw = Math.atan2(dx, dz);
      b.vx = b.vz = d.vx = d.vz = 0;
      if (this.sub === 'air' || this.sub === 'run' || this.sub === 'return') d.shedT = Math.min(d.shedT, 0.45);
      if (d.shedT <= 0) {
        d.engaged = null; b.engaged = null; d.shedT = 0;
        b.stunT = 0.65; b.ch.play('stumble');
        d.tackleCd = 0.25;
      }
    }
    // Play Dead
    if (this.sub === 'pocket') {
      const q = this.ball.holder;
      if (q && q.playDead && !q.usedDead) {
        for (const d of this.def) if (this.free(d) && (d.job === 'rush' || d.job === 'pursue') && dist(d.x, d.z, q.x, q.z) < 2.7) {
          q.usedDead = true; q.playDead = false; q.deadT = 0.9;
          q.ch.setBase('dead'); q.ch.setExpr('closed');
          G.audio.sfx('squeak');
          this.pop(q, '💀 ...', 'white', 1.2);
          for (const r of this.def) if (dist(r.x, r.z, q.x, q.z) < 7 && r.downT <= 0) { r.confT = 2.9; r.vx = r.vz = 0; r.ch.play('shake', 0.9); this.pop(r, '?', 'white'); if (r.engaged) { r.engaged.engaged = null; r.engaged = null; r.shedT = 0; } }
          break;
        }
      }
    }
    // tackles on whoever has the ball
    const holder = c || (this.sub === 'pocket' || this.sub === 'handoff' ? this.ball.holder : null);
    if (holder && holder.downT <= 0) {
      for (const d of this.opp(holder)) {
        if (d.decoy) continue;
        const dd = dist(d.x, d.z, holder.x, holder.z);
        if (d.dive > 0) {
          if (!d.diveHit && dd < 1.2) { d.diveHit = true; this.resolveTackle(d, holder, true); if (this.result) return; }
          continue;
        }
        if (!this.free(d)) continue;
        if (d.userCtl) {
          // wrap-up if you just run into them
          if (dd < 1.0) { d.wrapT = (d.wrapT || 0) + dt; if (d.wrapT > 0.3) { d.wrapT = 0; this.resolveTackle(d, holder, false, 0.22); if (this.result) return; } } else d.wrapT = 0;
          continue;
        }
        if (d.wind > 0) {
          d.wind -= dt;
          if (d.wind <= 0) {
            d.ch.play('dive', 0.42);
            if (dd < 1.5) { this.resolveTackle(d, holder, false); if (this.result) return; } else { d.downT = 0.8; d.ch.setBase('down'); this.fx.dust(this.wx(d.x), this.wz(d.z)); }
            d.tackleCd = 1.1; d.windTarget = null;
          }
        } else if (d.tackleCd <= 0 && dd < 1.95 && this.playT > 0.25) {
          // commit: a short telegraphed lunge. Juke or spin as it lands to slip it.
          d.wind = clamp(0.37 - (this.off.includes(d) ? 0.62 : this.defIq()) * 0.12, 0.22, 0.37);
          d.windTarget = holder;
          d.ch.setExpr('angry', 0.5);
          this.fx.emit('ring', this.wx(holder.x), 0.08, this.wz(holder.z), { life: d.wind, s0: 3.0, s1: 1.0, color: 0xff6a4a });
          if (holder.userCtl && !this.auto) this.pop(d, '!', 'bad small', 0.4);
        }
      }
    }
  }

  engage(b, d) {
    if (b.pancakes > 0) {
      b.pancakes--;
      d.downT = 3.6; d.ch.setBase('down'); d.ch.setExpr('dizzy');
      d.vx = (d.x - b.x) * 4; d.vz = (d.z - b.z) * 4;
      this.impact(d, 'SPLAT!', 1.2);
      G.audio.sfx('syrup');
      this.addSyrup(d.x, d.z);
      b.ch.play('push');
      this.addSt(d, -8);
      return;
    }
    const base = b.job === 'passblock' ? 2.7 : b.job === 'runblock' ? 1.7 : 1.3;
    const ratio = Math.pow((b.stats.str + 2) / (d.stats.str + 2), 0.9);
    const bonus = this.off.includes(b) ? this.blockBonus : 1;
    d.shedT = base * ratio * bonus * rand(0.85, 1.15) * (this.tired(b) ? 0.7 : 1);
    if (d.snatch) d.shedT *= 0.8;
    b.engaged = d; d.engaged = b;
    b.ch.setBase('block'); d.ch.setBase('block');
    this.fx.dust(this.wx((b.x + d.x) / 2), this.wz((b.z + d.z) / 2), 0xf4ead0, 2);
    if (Math.random() < 0.5) G.audio.sfx('thud');
  }

  addSyrup(x, z) {
    const m = new THREE.Mesh(circle(2.2, 22), new THREE.MeshBasicMaterial({ color: 0x9a5a1e, transparent: true, opacity: 0.8, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(this.wx(x), 0.045, this.wz(z)); m.renderOrder = 3;
    this.scene.add(m);
    this.syrups.push({ x, z, r: 2.2, m, forTeam: this.off[0].team });
  }

  impact(e, word, scale = 1, cls = 'big') {
    const p = this.wpos(e, 1.2);
    this.fx.impact(p, 0xffd45a, scale);
    this.fx.shake(0.22 * scale, 0.25);
    G.hitstop(0.07);
    if (word) G.ui.pop(word, { x: p.x, y: 2.6, z: p.z }, cls, 0.9);
  }

  /** d tries to bring down c. dive = a committed user/AI lunge. extraBreak = added break chance. */
  resolveTackle(d, c, dive, extraBreak = 0) {
    if (c.iframes > 0 || c.slideT > 0) { this.whiff(d, c); return; }
    if (d.willMiss && dive) { d.willMiss = false; if (this.juke(c, { x: 0, z: 0 }) || true) { c.iframes = 0.25; this.whiff(d, c); return; } }
    // AI runners can sidestep AI tacklers
    if (!c.userCtl && !d.userCtl && c.jukeCd <= 0 && !this.tired(c) && chance(0.05 + c.stats.agi * 0.018)) { c.jukeCd = 0.9; c.iframes = 0.25; c.ch.play('juke'); this.whiff(d, c); return; }
    let pBreak = 0.1 + (c.stats.str - d.stats.str) * 0.035 + extraBreak + (this.has(c, 'hyped') ? 0.12 : 0) - (this.tired(c) ? 0.1 : 0) + (this.tired(d) ? 0.12 : 0);
    if (d.userCtl && dive) pBreak -= 0.12;
    if (c.burst > 0) pBreak += 0.1;
    pBreak = clamp(pBreak, 0.03, 0.5);
    if (chance(pBreak)) {
      d.downT = 1.2; d.ch.setBase('down'); d.ch.setExpr('dizzy');
      c.vx *= 0.6; c.vz *= 0.6;
      this.addSt(c, -5);
      this.impact(c, 'BROKEN TACKLE!', 0.7, '');
      G.audio.sfx('thud');
      return;
    }
    this.tackle(d, c, dive);
  }

  whiff(d, c) {
    d.downT = 0.95; d.ch.setBase('down'); d.dive = 0; d.wind = 0;
    d.vx = Math.sin(d.yaw) * 5; d.vz = Math.cos(d.yaw) * 5;
    this.pop(d, 'MISSED!', 'white small', 0.7);
    this.fx.dust(this.wx(d.x), this.wz(d.z));
    if (c.userCtl || c.team === YOU) { c.burst = Math.max(c.burst, 0.35); }
  }

  tackle(d, c, dive) {
    const sack = this.sub === 'pocket' && c.x < this.los;
    d.ch.play('dive', 0.4);
    c.downT = 9; c.ch.setBase('down'); c.ch.setExpr('dizzy'); c.hasBall = false;
    d.downT = 0.7; d.dive = 0;
    const words = sack ? ['SACK!'] : ['POW!', 'BONK!', 'OOF!', 'WHAM!', 'THUD!'];
    this.impact(c, pick(words), sack ? 1.3 : 1);
    G.audio.sfx('tackle');
    this.addSt(c, sack ? -16 : -14);
    this.addSt(d, -5);
    if (d.team === YOU) this.stats.tackles++;
    if (sack && d.team === YOU) this.stats.sacks++;
    // the tackler's team may rub off a status
    const ts = d.team === CPU ? this.team.tackleStatus : null;
    if (ts && chance(ts[1])) this.give(c, ts[0], 2);
    // strip / fumble
    let strip = d.snatch ? 0.45 : (d.userCtl && dive ? 0.08 : 0);
    if (d.snatch) d.snatch = false;
    if (strip && chance(strip) && !sack) {
      this.pop(d, 'STRIPPED!', 'big', 1.2);
      this.endPlay({ type: 'fumble', x: clamp(c.x, 1, this.L - 1), by: d });
      return;
    }
    const ret = c.team !== (this.poss === YOU ? YOU : CPU);
    if (ret) this.endPlay({ type: 'int', x: clamp(c.x, 1, this.L - 1), by: c });
    else this.endPlay({ type: sack ? 'sack' : 'tackle', x: c.x, carrier: c, by: d });
  }

  hazards(dt) {
    const hz = this.field.hz;
    this.clock += dt;
    if (hz.type === 'sprinklers') {
      for (const h of hz.list) {
        h.on = ((this.clock + h.phase) % h.period) / h.period < h.duty;
        if (!h.on) continue;
        h.spin += dt * 5;
        for (let k = 0; k < 2; k++) { const a = h.spin + k * Math.PI + rand(-0.2, 0.2), v = h.r * 1.5; this.fx.emit('drop', h.x, 0.5, h.z, { vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 4.4, g: -12, life: 0.75, s0: 0.22, s1: 0.1, color: 0x9be8ff }); }
        for (const e of this.all) { if (e.decoy || e.downT > 0) continue; if (dist(this.wx(e.x), this.wz(e.z), h.x, h.z) < h.r) { if (!this.has(e, 'soggy')) { this.fx.burst('drop', this.wpos(e, 1), 6, { speed: 2.5, up: 2.5, life: 0.4, s0: 0.2, color: 0x9be8ff }); if (e.team === YOU) G.audio.sfx('splash'); } this.give(e, 'soggy', 2); } }
      }
    }
    for (const s of this.syrups) for (const e of this.all) { if (e.decoy || e.team === s.forTeam || e.downT > 0) continue; if (dist(e.x, e.z, s.x, s.z) < s.r) { if (e.syrT <= 0) this.pop(e, '🥞 Stuck!', 'small', 0.7); e.syrT = 2.4; } }
    if (hz.type === 'flicker') {
      const k = (this.clock % 7.5);
      this.darkNow = k > 5.6;
      this.hudUI.setDark(this.darkNow ? 0.82 : 0);
    } else if (this.lightsOut > 0) { this.hudUI.setDark(0.55); } else this.hudUI.setDark(0);
  }

  // ---------------------------------------------------------------- the ball
  startRun(e, quiet) {
    this.sub = this.sub === 'return' ? 'return' : 'run';
    this.carrier = e;
    e.hasBall = true; e.job = 'carrier';
    this.ball.state = 'held'; this.ball.holder = e;
    for (const o of this.mates(e)) { if (o !== e && !o.engaged && o.job !== 'leadblock') o.job = 'leadblock'; }
    for (const o of this.opp(e)) { if (!o.engaged) o.job = 'pursue'; }
    if (e.team === YOU) { this.userEnt = e; this.userMode = 'carrier'; this._showUser(e); } else if (this.poss === YOU || this.sub === 'return') { this.userMode = 'defender'; if (!this.mates(this.userEnt).includes(this.userEnt) || this.userEnt.team !== YOU) this.switchDefender(); }
    if (this.userEnt.team !== YOU) { const mineList = this.all.filter((x) => x.team === YOU && !x.decoy); this.userEnt = mineList[0]; this.switchDefender(); this._showUser(this.userEnt); }
    if (e.slideReady) { e.slideReady = false; e.slideT = 1.4; e.ch.play('dive', 1.4); this.pop(e, '🐧 WHEEE!', '', 1); G.audio.sfx('juke'); }
    if (!quiet) this.hudUI.clearTargets();
  }

  throwTo(q, r) {
    if (q.threw) return;
    q.threw = true;
    const sp = 15.5 + q.stats.arm * 0.95;
    let ax = r.x, az = r.z, T = 0.4;
    for (let i = 0; i < 3; i++) { T = clamp(dist(q.x, q.z, ax, az) / sp, 0.32, 1.6); ax = r.x + r.vx * T * 0.92; az = r.z + r.vz * T * 0.92; }
    ax = clamp(ax, -this.EZ + 0.6, this.L + this.EZ - 0.6); az = clamp(az, -this.HW + 0.5, this.HW - 0.5);
    const d = dist(q.x, q.z, ax, az);
    const rush = this.nearestFoe(q, this.def.filter((x) => this.free(x)), 3);
    let err = (0.22 + d * 0.034) * (1.55 - q.stats.arm * 0.065);
    if (rush) err *= 1.55;
    if (Math.hypot(q.vx, q.vz) > 4) err *= 1.3;
    if (this.has(q, 'dizzy')) err *= 1.8;
    if (q.team === CPU && this.lightsOut > 0) err *= 2.1;
    if (q.team === CPU) err *= 1.7 - this.iq * 0.6;
    const ea = rand(TAU), em = Math.abs((Math.random() + Math.random() + Math.random()) / 1.5 - 1) * err * 1.6;
    ax += Math.cos(ea) * em; az += Math.sin(ea) * em;
    q.hasBall = false;
    q.ch.play('throw');
    q.yaw = Math.atan2(ax - q.x, az - q.z);
    G.audio.sfx('throw');
    this.sub = 'air';
    this.ball.state = 'air';
    this.ball.from = { x: q.x, y: 1.9, z: q.z }; this.ball.to = { x: ax, z: az };
    this.ball.t = 0; this.ball.T = T; this.ball.target = r; this.ball.arc = 1.0 + T * 2.4; this.ball.lateral = null;
    this.ball.passer = q;
    r.job = 'toBall';
    // the closest couple of defenders break on it
    const near = this.def.filter((x) => this.free(x)).sort((a, b) => dist(a.x, a.z, ax, az) - dist(b.x, b.z, ax, az)).slice(0, 2);
    for (const n of near) if (!n.userCtl) { n.job = 'toBall'; n.breakLag = n.lag; }
    if (q.team === YOU) { this.userMode = 'air'; this.catchPress = null; this._showUser(r); this.hudUI.setHint(`${G.ui.key('a')} when the rings meet — time the catch!`); } else { this.pickPress = null; this.hudUI.setHint(`Get under it — ${G.ui.key('a')} as the rings meet to pick it off!`); }
    this.hudUI.clearTargets();
    this.ringOut.visible = this.ringIn.visible = true;
  }

  throwAway(q) {
    q.threw = true; q.hasBall = false;
    q.ch.play('throw');
    this.sub = 'air';
    this.ball.state = 'air';
    this.ball.from = { x: q.x, y: 1.9, z: q.z }; this.ball.to = { x: q.x + 9, z: (q.z >= 0 ? 1 : -1) * (this.HW + 2.5) };
    this.ball.t = 0; this.ball.T = 0.7; this.ball.target = null; this.ball.arc = 2; this.ball.lateral = null;
    G.audio.sfx('throw');
  }

  catchWindow(r) {
    const open = this.openness(r);
    let f = clamp(0.72 + (open - 1) * 0.22, 0.7, 1.4) * (0.82 + r.stats.hnd * 0.032);
    if (this.buff.sticky) f *= 1.3;
    if (this.has(r, 'butter')) f *= 0.62;
    if (this.has(r, 'hyped')) f *= 1.15;
    if (this.tired(r)) f *= 0.8;
    return { perfect: 0.075 * f, good: 0.17 * f };
  }

  ballUpdate(dt) {
    const b = this.ball;
    if (b.state !== 'air') return;
    b.t += dt;
    const k = clamp(b.t / b.T, 0, 1);
    b.x = lerp(b.from.x, b.to.x, k); b.z = lerp(b.from.z, b.to.z, k);
    b.y = lerp(b.from.y, 1.5, k) + Math.sin(k * Math.PI) * b.arc;
    if (k < 1) return;
    // ---- arrival
    if (b.lateral) {
      const { from, to, risk, ladder } = b.lateral;
      if (to.downT > 0 || chance(risk)) { this.pop(to, 'FUMBLE!', 'big bad'); this.endPlay({ type: 'fumble', x: clamp(to.x, 1, this.L - 1), by: this.nearestFoe(to, this.opp(to)).e }); return; }
      this.startRun(to, true);
      to.ch.play('catch', 0.25);
      G.audio.sfx('catch');
      if (ladder) { to.burst = 1.6; this.pop(to, 'HOOK & LADDER!', 'big'); this.give(to, 'hyped', 1); }
      void from;
      return;
    }
    const r = b.target;
    this.ringOut.visible = this.ringIn.visible = false;
    if (!r) { this.incomplete('THROWN AWAY', b.to); return; }
    const off = dist(r.x, r.z, b.to.x, b.to.z);
    const nd = this.nearestFoe({ x: b.to.x, z: b.to.z }, this.def.filter((d) => this.alive(d) && d.stunT <= 0), 6);
    const dDef = nd ? nd.d : 99;
    const youThrow = b.passer.team === YOU;
    if (off > 1.75 || r.downT > 0) {
      if (nd && dDef < 1.0 && chance(0.25)) { this.interception(nd.e); return; }
      this.incomplete(off > 3 ? 'OVERTHROWN' : 'JUST OUT OF REACH', b.to);
      return;
    }
    if (youThrow) {
      const win = this.catchWindow(r);
      let err = this.catchPress === null ? 9 : Math.abs(this.catchPress - b.T);
      if (this.auto) err = Math.abs(rand(-1, 1)) * 0.2;
      if (err <= win.perfect) {
        this.completed(r, 'perfect');
      } else if (err <= win.good) {
        this.completed(r, 'good');
      } else {
        const early = this.catchPress !== null && this.catchPress < b.T;
        if (nd && dDef < 1.2 && chance(0.1 + nd.e.stats.hnd * 0.02)) { this.interception(nd.e); return; }
        r.ch.play('flinch'); r.ch.setExpr('wide', 1);
        G.audio.sfx('bonk');
        this.incomplete(this.catchPress === null ? 'BONK! (press to catch)' : early ? 'TOO EARLY!' : 'TOO LATE!', b.to, r);
      }
      return;
    }
    // ---- their pass: you may have timed a pick
    const u = this.userEnt;
    if (u && u.team === YOU && this.pickPress !== null && this.free(u)) {
      const du = dist(u.x, u.z, b.to.x, b.to.z);
      const err = Math.abs(this.pickPress - b.T);
      const hf = 0.85 + u.stats.hnd * 0.03;
      if (du < 1.9 && err <= 0.085 * hf) { this.interception(u, true); return; }
      if (du < 2.3 && err <= 0.2 * hf) { u.ch.play('catch'); this.pop(u, 'SWATTED!', 'big cool'); G.audio.sfx('bonk'); this.fx.impact({ x: this.wx(b.to.x), y: 2, z: this.wz(b.to.z) }, 0x9be8ff, 0.6); this.incomplete('', b.to); return; }
    }
    if (this.auto && u && u.team === YOU && dist(u.x, u.z, b.to.x, b.to.z) < 1.8 && chance(0.3)) { this.interception(u, true); return; }
    // AI coverage contests it
    let pCatch = 0.95 - Math.max(0, 1.7 - dDef) * 0.36 - off * 0.12 + (r.stats.hnd - 5) * 0.03;
    if (this.lightsOut > 0) pCatch -= 0.12;
    pCatch = clamp(pCatch, 0.2, 0.97);
    if (chance(pCatch)) { this.completed(r, 'cpu'); return; }
    if (nd && dDef < 1.3 && nd.e.team === YOU && chance(0.22 + nd.e.stats.hnd * 0.03)) { this.interception(nd.e, false); return; }
    if (nd && dDef < 1.6) { nd.e.ch.play('catch'); this.pop(nd.e, 'BROKEN UP!', 'cool'); }
    this.incomplete('INCOMPLETE', b.to, r);
  }

  completed(r, grade) {
    this.startRun(r, true);
    r.ch.play('catch', 0.3);
    G.audio.sfx('catch');
    const p = this.wpos(r, 1.6);
    if (grade === 'perfect') {
      this.stats.perfect++;
      r.burst = 1.5;
      this.give(r, 'hyped', 1);
      this.pop(r, 'PERFECT CATCH!', 'big');
      G.audio.sfx('perfect');
      this.fx.sparkle(p, 0xfff2a8, 14);
      const nd = this.nearestFoe(r, this.def, 2.2);
      if (nd && this.free(nd.e)) { nd.e.stunT = 0.7; nd.e.ch.play('stumble'); this.pop(nd.e, 'ankles!', 'white small'); }
    } else if (grade === 'good') {
      this.pop(r, 'Caught!', '');
      G.audio.sfx('good');
    } else {
      this.pop(r, 'CAUGHT', 'bad small');
    }
    if (r.team === YOU && this.play.ladder && r.role === this.play.ladder.from) this.hudUI.setHint(`${G.ui.key('y')} LATERAL to the trailer!`);
    else if (r.team === YOU) this.hudUI.setHint(`${G.ui.key('a')} juke · ${G.ui.key('b')} spin · ${G.ui.key('y')} lateral`);
    else this.hudUI.setHint(`${G.ui.key('a')} dive tackle · ${G.ui.key('y')} switch defender`);
  }

  incomplete(text, at, r) {
    this.ball.state = 'loose';
    this.ball.vy = 3; this.ball.bx = (at.x - this.ball.from.x) * 0.3; this.ball.bz = (at.z - this.ball.from.z) * 0.3;
    if (text) G.ui.pop(text, { x: this.wx(at.x), y: 2.4, z: this.wz(at.z) }, 'white', 1.0);
    void r;
    this.endPlay({ type: 'inc' });
  }

  interception(d, byUser) {
    d.ch.play('catch');
    this.pop(d, 'INTERCEPTED!', d.team === YOU ? 'huge' : 'huge bad', 1.3);
    G.audio.sfx('int');
    this.fx.impact(this.wpos(d, 1.6), d.team === YOU ? 0x9be8ff : 0xff8f7a, 1);
    if (d.team === YOU) this.stats.ints++;
    void byUser;
    this.sub = 'return';
    for (const e of this.all) { if (e.engaged) { e.engaged = null; e.shedT = 0; } }
    this.startRun(d, true);
    if (d.team === YOU) { this.userEnt = d; this.userMode = 'carrier'; this._showUser(d); this.hudUI.setHint(`Run it back! ${G.ui.key('a')} juke · ${G.ui.key('b')} spin`); } else { this.userMode = 'defender'; this.switchDefender(); this.hudUI.setHint(`Bring them down! ${G.ui.key('a')} dive tackle · ${G.ui.key('y')} switch`); }
  }

  // ---------------------------------------------------------------- rules
  rules() {
    const t = this.playT;
    // handoff
    if (this.sub === 'handoff' && t > 0.36) {
      const q = this.role('QB'), r = this.role(this.play.carrier);
      q.hasBall = false; q.ch.play('toss');
      this.sub = 'run';
      this.startRun(r, true);
      G.audio.sfx('lateral');
      if (r.team === YOU) this.hudUI.setHint(`${G.ui.key('a')} juke · ${G.ui.key('b')} spin · ${G.ui.key('y')} lateral`);
    }
    const c = this.carrier;
    if (c && c.downT <= 0) {
      const dir = this.goalDir();
      if (dir > 0 && c.x >= this.L) { this.endPlay({ type: 'td', carrier: c }); return; }
      if (dir < 0 && c.x <= 0) { this.endPlay({ type: 'ret_td', carrier: c }); return; }
      if (Math.abs(c.z) > this.HW + 0.1) {
        this.pop(c, 'OUT OF BOUNDS', 'white small');
        if (dir < 0) this.endPlay({ type: 'int', x: clamp(c.x, 1, this.L - 1), by: c });
        else this.endPlay({ type: 'ob', x: c.x, carrier: c });
        return;
      }
      if (c.slideT > 0) c.slideT -= 0.016;
    }
    // quarterback wandered out of bounds
    const h = this.ball.holder;
    if (this.sub === 'pocket' && h && Math.abs(h.z) > this.HW + 0.1) this.endPlay({ type: 'ob', x: h.x, carrier: h });
    if (t > 14 && !this.result) this.endPlay({ type: c ? 'tackle' : 'inc', x: c ? c.x : this.los, carrier: c });
  }

  // ---------------------------------------------------------------- after the whistle
  async afterPlay(res, one) {
    this.stats.plays++;
    (G.debug.plays = G.debug.plays || []).push({ poss: this.poss, play: this.play.name, def: this.dplay.name, type: res.type, gain: res.x !== undefined ? +(res.x - this.los).toFixed(1) : 0, t: +this.playT.toFixed(1), down: this.down, snap: this.snapGrade });
    const youOff = this.poss === YOU;
    const offName = youOff ? G.S.team.name : this.team.short;
    // fatigue + bench recovery + status countdown
    for (const e of this.all) { if (e.decoy) continue; this.addSt(e, -2); for (const s of Object.keys(e.status)) { e.status[s]--; if (e.status[s] <= 0) delete e.status[s]; } }
    for (const e of Object.values(this.mine)) if (!e.onField) this.addSt(e, 7);
    this.killDecoy();
    for (const s of this.syrups) this.scene.remove(s.m);
    this.syrups = [];
    this.snacked = false;
    const ban = (m, s, cls) => (G.debug.fast ? null : G.ui.banner(m, s, { dur: 1.25, cls }));
    let end = null;

    if (res.type === 'td') {
      this.score[this.poss] += 6;
      if (youOff) this.stats.tds++;
      G.audio.sfx('td');
      this.field.cheer(true);
      for (const e of this.off) { if (e.downT <= 0) { e.ch.play('celebrate'); e.ch.setExpr('happy', 2); } }
      const p = this.wpos(res.carrier, 2);
      this.fx.confetti(p, 50);
      this._bug();
      await ban('TOUCHDOWN!', offName, youOff ? '' : 'bad');
      if (youOff && this.cfg.onFirstTD && !this._firstTD) { this._firstTD = true; await this.cfg.onFirstTD(this); G.audio.music(this.cfg.music || (this.team.rival ? 'rival' : this.field.music)); }
      if (this.kind === 'match') { const good = await this.fieldGoal(true); if (good) this.score[this.poss] += 1; }
      this._bug();
      end = { scored: true, next: 15 };
    } else if (res.type === 'ret_td') {
      const other = 1 - this.poss;
      this.score[other] += 6;
      G.audio.sfx(other === YOU ? 'td' : 'sad');
      if (other === YOU) { this.stats.tds++; this.fx.confetti(this.wpos(res.carrier, 2), 50); }
      this._bug();
      await ban('PICK SIX!', other === YOU ? G.S.team.name : this.team.short, other === YOU ? '' : 'bad');
      if (this.kind === 'match') this.score[other] += 1;
      end = { scored: false, pick6: true, next: 15, turnover: true };
    } else if (res.type === 'int' || res.type === 'fumble') {
      G.audio.sfx(youOff ? 'sad' : 'firstdown');
      await ban(res.type === 'int' ? 'TURNOVER!' : 'FUMBLE!', youOff ? `${this.team.short} take over` : 'Your ball!', youOff ? 'bad' : 'cool');
      end = { scored: false, turnover: true, next: clamp(this.L - res.x, 4, this.L - 4) };
    } else {
      // tackle / out of bounds / sack / incomplete
      let nx = this.los;
      if (res.type !== 'inc') nx = clamp(res.x, 0.5, this.L - 0.2);
      const gain = nx - this.los;
      if (youOff && res.type !== 'inc') this.stats.yards += Math.round(gain);
      const yd = Math.round(Math.abs(gain));
      if (nx >= this.ltg && res.type !== 'inc') {
        this.los = nx; this.down = 1; this.ltg = Math.min(this.los + 10, this.L);
        G.audio.sfx('firstdown');
        await ban('FIRST DOWN!', `+${yd} yards`, youOff ? 'small' : 'small bad');
      } else {
        this.los = nx; this.down++;
        if (this.down > 4) {
          G.audio.sfx(youOff ? 'sad' : 'firstdown');
          await ban('TURNOVER ON DOWNS', youOff ? 'So close.' : 'What a stand!', youOff ? 'bad small' : 'cool small');
          end = { scored: false, turnover: true, next: clamp(this.L - this.los, 4, this.L - 4) };
        } else if (!G.debug.fast) {
          const txt = res.type === 'inc' ? 'Incomplete' : res.type === 'sack' ? `Sacked! −${yd}` : gain >= 0 ? `+${yd} yard${yd === 1 ? '' : 's'}` : `−${yd} yards`;
          G.ui.toast(`${txt} · <b>${this.ddText()}</b>`, 1600);
          await this.wait(0.35);
        }
      }
    }
    this._bug();
    this._squadBar();
    if (this.cfg.tutorial) await this.tutor('after', res);
    return end;
  }

  async halftime() {
    for (const e of Object.values(this.mine)) this.addSt(e, e.maxSt * 0.3);
    for (const e of this.foes) this.addSt(e, e.maxSt * 0.3);
    if (G.debug.fast) return;
    G.audio.sfx('whistle');
    await G.ui.banner('HALFTIME', `${G.S.team.name} ${this.score[YOU]} — ${this.score[CPU]} ${this.team.short} · everyone catches their breath`, { dur: 2.2, cls: 'small' });
    this._squadBar();
  }

  /** Tie-breaker: one kick each from 30 yards until somebody misses. */
  async shootout(round) {
    if (!G.debug.fast) await G.ui.banner(round ? 'STILL TIED!' : 'TIED!', 'Field goal shootout — sudden death', { dur: 1.6, cls: 'small cool' });
    this.poss = YOU; this.flip = false; this.los = this.L - 20 - round * 4;
    this.curSquad = G.S.offSquad;
    this._bug();
    const mine = await this.fieldGoal(false, true);
    const theirs = chance(clamp(0.7 - round * 0.12 + (this.iq - 0.5) * 0.2, 0.3, 0.85));
    if (!G.debug.fast) await G.ui.banner(theirs ? `${this.team.short}: GOOD` : `${this.team.short}: NO GOOD`, '', { dur: 1.1, cls: theirs ? 'small bad' : 'small' });
    if (mine) this.score[YOU] += 3;
    if (theirs) this.score[CPU] += 3;
    this._bug();
  }

  // ---------------------------------------------------------------- kicking
  kicker() {
    let best = null;
    for (const id of this.squadIds()) { const e = this.mine[id]; if (!best || e.stats.kick > best.stats.kick) best = e; }
    return best;
  }

  /** Kick meter. pat = extra point. Returns true if it's good. */
  async fieldGoal(pat, shoot) {
    this.phase = 'kick';
    this.hudUI.clearTargets();
    this._showUser(null);
    const youKick = this.poss === YOU;
    const distY = pat ? 14 : this.kickDist();
    if (!youKick) {
      const p = clamp(0.97 - Math.max(0, distY - 18) * 0.022, 0.25, 0.95);
      const good = chance(p);
      if (!pat && !G.debug.fast) await G.ui.banner(good ? 'FIELD GOAL' : 'NO GOOD!', `${this.team.short} from ${Math.round(distY)} yards`, { dur: 1.3, cls: good ? 'small bad' : 'small' });
      else if (!G.debug.fast) G.ui.toast(good ? `${this.team.short} extra point is good` : `${this.team.short} missed the extra point!`);
      return good;
    }
    const k = this.kicker();
    const wind = pat ? 0 : rand(-1, 1) * 0.12;
    const attempt = async () => {
      // set the kicker up behind the ball
      const bx = pat ? this.L - 8 : this.los, kx = bx - 2.2;
      for (const e of this.all) { e.vx = e.vz = 0; }
      k.x = kx; k.z = 0.4; k.yaw = Math.PI / 2; k.downT = 0; k.ch.setBase(k.ch.floaty ? 'float' : 'move'); k.onField = true;
      if (!this.all.includes(k)) this.all.push(k);
      this.ball.state = 'spot'; this.ball.x = bx; this.ball.z = 0; this.ball.y = 0.3;
      this.camFocus = { x: bx + 6 };
      const w = clamp(0.36 - distY * 0.0045 + k.stats.kick * 0.014, 0.07, 0.42);
      const zone = { c: clamp(0.5 + wind, 0.2, 0.8), w };
      let pos = 0.5;
      if (this.auto) pos = zone.c + rand(-1, 1) * w * 0.75;
      else {
        this.hudUI.showKick(`${pat ? 'Extra point' : `${Math.round(distY)}-yard field goal`} — ${G.ui.key('a')} in the green${wind ? ` · wind ${wind > 0 ? '→' : '←'}` : ''}`, zone);
        let t = rand(1), stopped = false;
        const speed = 1.05 + distY * 0.018;
        await this.until((dt) => {
          t += dt * speed;
          pos = 0.5 + Math.sin(t * 2.6) * 0.48;
          this.hudUI.updateKick(pos);
          if (G.input.take('a')) stopped = true;
          return stopped;
        });
        this.hudUI.hideKick();
      }
      const off = Math.abs(pos - zone.c);
      const good = off <= w / 2;
      const doink = !good && off <= w / 2 + 0.035;
      // the kick
      k.ch.play('kick');
      await this.wait(0.22);
      G.audio.sfx('kick');
      const tx = this.L + this.EZ + 0.3, tz = good ? (pos - zone.c) * 4 : (pos > zone.c ? 1 : -1) * (doink ? 2.6 : 4.4);
      const fx0 = this.ball.x;
      this.ball.state = 'kick';
      await this.tween(G.debug.fast ? 0.01 : 1.0, (u) => {
        this.ball.x = lerp(fx0, tx, u); this.ball.z = lerp(0, tz, u);
        this.ball.y = 0.3 + Math.sin(u * Math.PI) * (5.5 + distY * 0.08) + u * 3.4;
        this.camFocus = { x: lerp(fx0 + 6, tx - 6, u) };
      }, ease.linear);
      if (doink) { G.audio.sfx('doink'); G.ui.pop('DOINK!', { x: this.wx(tx), y: 5, z: this.wz(tz) }, 'big bad'); } else if (good) { G.audio.sfx('firstdown'); this.fx.sparkle({ x: this.wx(tx), y: 5, z: this.wz(tz) }, 0xfff2a8, 16); }
      return good;
    };
    let good = await attempt();
    if (!good) {
      const h = this.mine.hollow;
      const cost = ABILITIES.secondchance.cost;
      if (h && this.squadIds().includes('hollow') && !this.secondChanceUsed && this.stOf(h) >= cost && !this.has(h, 'spook')) {
        this.secondChanceUsed = true;
        this.addSt(h, -cost);
        G.audio.sfx('ghost');
        if (!G.debug.fast) await G.ui.banner('SECOND CHANCE!', 'Coach Hollow rewinds the kick', { dur: 1.4, cls: 'small cool' });
        this._squadBar();
        good = await attempt();
      }
    }
    this.camFocus = null;
    if (!G.debug.fast) await G.ui.banner(good ? 'IT\'S GOOD!' : 'NO GOOD', pat ? 'Extra point' : shoot ? 'Shootout kick' : `${Math.round(distY)} yards`, { dur: 1.2, cls: good ? 'small' : 'small bad' });
    this.ball.state = 'held';
    this.all = this.all.filter((e) => this.off.includes(e) || this.def.includes(e));
    return good;
  }

  // ---------------------------------------------------------------- Backyard Blitz (2-on-2, first to N or time)
  async blitzGame() {
    const cfg = this.cfg;
    const target = cfg.blitz.target || 3;
    let poss = YOU;
    let turns = 0;
    while (this.score[YOU] < target * 6 && this.score[CPU] < target * 6 && turns < (cfg.blitz.maxTurns || 8)) {
      this.driveIdx = turns;
      this.order = new Array((cfg.blitz.maxTurns || 8)).fill(0);
      this.poss = poss; this.flip = poss === CPU;
      this.los = 4; this.down = 1; this.ltg = this.L;
      this.curSquad = 0;
      if (!G.debug.fast) await G.ui.banner(poss === YOU ? 'YOUR BALL' : 'THEIR BALL', 'Four downs to score', { dur: 1.0, cls: poss === YOU ? 'small' : 'small cool' });
      for (;;) {
        this._bug();
        const call = await this.huddle();
        await this.lineUp(call);
        await this.snap();
        const res = await this.live();
        const end = await this.afterPlay(res, true);
        if (end) break;
      }
      poss = 1 - poss; turns++;
    }
    return this.score[YOU] > this.score[CPU];
  }

  // ---------------------------------------------------------------- finish
  async finale(won) {
    this.phase = 'over';
    this._showUser(null);
    const cfg = this.cfg;
    const t = this.team;
    G.audio.sfx(won ? 'win' : 'lose');
    if (won) for (const e of Object.values(this.mine)) { if (e.onField && e.downT <= 0) { e.ch.setBase('cheer'); e.ch.setExpr('happy'); } }
    const result = { won, score: this.score.slice(), stats: this.stats, narrow: this.narrow };
    // rewards
    const rewards = [];
    const ups = [];
    if (!cfg.noRewards) {
      const xp = Math.round(t.xp * (won ? 1 : 0.35) * (this.narrow ? 0.7 : 1));
      const played = new Set([...this.squads[0], ...this.squads[1]]);
      for (const id of G.S.roster) { const before = charState(id).lv; const up = addXp(id, played.has(id) ? xp : Math.round(xp * 0.5)); if (up) ups.push({ id, from: before, to: charState(id).lv }); }
      result.xp = xp;
      if (won) {
        const coins = Math.round((t.coins || 0) * (this.narrow ? 0.6 : 1) * (cfg.blindside ? 1.2 : 1));
        if (coins) { G.S.coins += coins; rewards.push(`🪙 +${coins} coins`); }
        if (t.parts && chance(t.parts)) { G.S.parts += 1; rewards.push('🔩 +1 part'); }
        if (t.item && chance(t.item[1])) { addItem(t.item[0], 1, true); rewards.push(`${ITEMS[t.item[0]].icon} ${ITEMS[t.item[0]].name}`); }
      }
    }
    for (const e of Object.values(this.mine)) e.maxSt = maxStamina(e.key);
    if (G.debug.fastDialog || cfg.quietEnd) { G.leave(result); return; }
    await this.wait(0.8);
    await G.ui.panel({
      title: won ? (this.kind === 'match' ? 'Victory!' : this.narrow ? 'Three points is three points' : 'Drive won!') : (this.kind === 'match' ? 'Final whistle' : 'Stopped'), closable: false,
      build: (body, api) => {
        if (this.kind === 'match' || cfg.blitz) body.append(el('div.final', { html: `${this.score[YOU]} — ${this.score[CPU]}<small>${G.S.team.name} vs ${t.name}</small>` }));
        const s = this.stats;
        body.append(el('div.statline', [`${s.yards} yards`, `${s.perfect} perfect catches`, `${s.tds} TD`, `${s.tackles} tackles`, `${s.ints} INT`].map((x) => el('span', x))));
        if (result.xp) {
          body.append(el('div.lbl', `+${result.xp} XP`));
          for (const id of this.squads[this.curSquad]) {
            const cs = charState(id);
            const up = ups.find((u) => u.id === id);
            body.append(el('div.xprow', el('img', { src: portrait(`cast:${id}:b`, teamSpec(id)) }), el('div.lv', `Lv ${cs.lv}`), el('div.bar', el('i', { style: { width: `${clamp(cs.xp / xpToNext(cs.lv), 0, 1) * 100}%` } })), up ? el('span.tag', 'LEVEL UP!') : null));
          }
        }
        if (ups.length) G.audio.sfx('levelup');
        if (rewards.length) body.append(el('div.mg-rewards', rewards.map((r) => el('div.toastlike', { html: r }))));
        body.append(el('div.row.center', { style: { marginTop: '0.8em' } }, el('button.btn.focusable.first', { text: 'Continue', onclick: () => api.close(true) })));
      },
    });
    G.leave(result);
  }

  // ================================================================ tutorials (Coach Hollow talks you through it)
  async tutor(stage, res) {
    const T = this.cfg.tutorial;
    this.tut = this.tut || {};
    const once = (k) => { if (this.tut[k]) return false; this.tut[k] = true; return true; };
    const say = (text) => G.ui.say('hollow', text);
    const k = (a) => G.input.glyph(a);
    if (T === 'offense') {
      if (stage === 'huddle' && once('h')) { await say('Offense! Four downs to get to the *gold line*. Get there and you get four more. Reach the end zone and I do my little dance.'); await say('Pick a play card. The lines are *routes* — where each receiver runs. The numbers are who each throw button goes to.'); }
      if (stage === 'snap' && once('s')) await say(`The count goes *HUT — HUT — HIKE*. Press ${k('a')} right on *HIKE*. A clean snap gives your blockers a head start.`);
      if (stage === 'after' && once('a')) await say(`Not bad. When you\'re running: ${k('a')} *jukes* past a tackler, ${k('b')} *spins*, ${k('y')} *laterals* to a teammate behind you. Watch for the red flash — that\'s a tackle coming.`);
      if (stage === 'after' && this.stats.plays === 2 && once('a2')) await say('Tackles cost *stamina*. So do abilities. A tired player is a slow player with no tricks — rest them on a bench or swap squads in the huddle.');
    } else if (T === 'defense') {
      if (stage === 'huddle' && once('h')) { await say('Defense! Stop them from reaching the gold line four times in a row and the ball is yours.'); await say('Pick a *coverage*. Red arrows rush the passer. Dotted lines stick to a receiver. Blobs guard a patch of grass.'); }
      if (stage === 'snap' && once('s')) await say(`You steer the one with the blue ring. ${k('y')} switches to whoever is nearest the ball. ${k('a')} is a *dive tackle* — commit, because a miss leaves you face down.`);
      if (stage === 'after' && once('a')) await say(`When they throw, get under the ball and press ${k('a')} as the rings meet. Good timing swats it. *Perfect* timing and it\'s yours.`);
    }
    void res;
  }
  tutorLive() {
    const T = this.cfg.tutorial;
    this.tut = this.tut || {};
    if (T === 'offense' && !this.tut.live && this.play.type === 'pass') { this.tut.live = true; G.ui.toast(`Green bubble = open. Throw with ${G.ui.key('t1')} ${G.ui.key('t2')} ${G.ui.key('t3')}`, 4000); }
  }

  // ================================================================ autopilot (QA + demos)
  autoControl(dt) {
    const u = this.userEnt;
    if (!u) return;
    this._autoT = (this._autoT || 0) - dt;
    if (this.userMode === 'qb' && this.sub === 'pocket') {
      if (u.deadT > 0) return;
      u.userCtl = true;
      const t = this.playT;
      if (t < 0.7) { u.dvx = -this.speed(u) * 0.6; u.dvz = 0; } else { u.dvx = 0; u.dvz = 0; }
      const rush = this.nearestFoe(u, this.def.filter((d) => this.free(d)), 3);
      if (rush && rush.d < 2 && u.jukeCd <= 0) this.juke(u, { x: 0, z: 1 });
      if (t > 1.1 || (rush && t > 0.6)) {
        let best = null, bo = 0;
        for (const r of this.off) { if (r.keyIdx < 0) continue; const o = this.openness(r); if (o > bo) { bo = o; best = r; } }
        if (best && (bo > 2 || t > 2.6 || rush)) this.throwTo(u, best);
      }
    } else if (this.userMode === 'carrier') {
      if (u.downT > 0) return;
      u.userCtl = true;
      this.cpuCarrier(u, dt);
      for (const d of this.opp(u)) {
        if (d.wind > 0 && d.autoSeen !== d.windTarget) { d.autoSeen = d.windTarget; d.autoDodge = chance(0.5); }
        if (d.wind <= 0) d.autoSeen = null;
        if (d.wind > 0 && d.wind < 0.14 && d.autoDodge && u.jukeCd <= 0) { d.autoDodge = false; this.juke(u, { x: 0, z: chance(0.5) ? 1 : -1 }); break; }
      }
    } else if (this.userMode === 'defender') {
      if (u.downT > 0 || u.dive > 0 || u.engaged) { if (this._autoT <= 0) { this._autoT = 0.4; this.switchDefender(); } return; }
      u.userCtl = true;
      const c = this.carrier;
      if (this.sub === 'air') { this.go(u, this.ball.to.x, this.ball.to.z, 1.04, 0.1); } else if (c) {
        const d = dist(u.x, u.z, c.x, c.z);
        const lead = clamp(d / 12, 0, 0.5);
        this.go(u, c.x + c.vx * lead, c.z + c.vz * lead, 1.04, 0.05);
        if (d < 2.3 && c.downT <= 0) this.diveTackle(u, { x: 0, z: 0 });
        else if (d > 7 && this._autoT <= 0) { this._autoT = 0.6; this.switchDefender(); }
      } else {
        const tg = u.target || this.role('WR1');
        if (u.job === 'deep' || !tg) this.go(u, this.los + 10, 0, 0.9); else this.go(u, tg.x + 1.2, tg.z, 1, 0.2);
      }
    }
  }

  // ================================================================ presentation
  _placeBench() {
    // everyone not on the field stands on the sideline
    let i = 0;
    const bench = [...Object.values(this.mine).filter((e) => !e.onField), ...(this.foes || []).filter((e) => !this.all || !this.all.includes(e))];
    for (const e of bench) {
      if (this.all && this.all.includes(e)) continue;
      const mineSide = e.team === YOU;
      e.x = -99; e.benchW = { x: (mineSide ? 6 : this.L - 6) + (i % 5) * 1.5 * (mineSide ? 1 : -1), z: this.HW + 2.6 };
      i++;
    }
  }
  _placeHuddle() {
    // before the first snap of a drive put both sides near the ball so the jog-in looks right
    const side = this.poss === YOU ? 'off' : 'def';
    const lu = this.lineupFor(side).map((m) => this.mine[m.id]);
    for (const e of Object.values(this.mine)) e.onField = lu.includes(e);
    this._placeBench();
    if (!this.firstPlay) return;
    lu.forEach((e, i) => { e.x = this.los + (side === 'off' ? -4 : 5) + Math.cos(i * 1.26) * 1.5; e.z = Math.sin(i * 1.26) * 1.5; e.vx = e.vz = 0; e.yaw = Math.atan2(-Math.cos(i * 1.26), -Math.sin(i * 1.26)); e.downT = 0; e.ch.setBase(e.ch.floaty ? 'float' : 'move'); });
    this.foes.forEach((e, i) => { e.x = this.los + (side === 'off' ? 5 : -4) + Math.cos(i * 1.26) * 1.5; e.z = Math.sin(i * 1.26) * 1.5; e.vx = e.vz = 0; e.yaw = Math.atan2(-Math.cos(i * 1.26), -Math.sin(i * 1.26)); e.downT = 0; e.ch.setBase(e.ch.floaty ? 'float' : 'move'); });
    this.all = [...lu, ...this.foes];
    this.ball.holder = side === 'off' ? lu[0] : this.foes[0];
    this.ball.state = 'held';
  }

  _showUser(e) { this.userShown = e; }

  _bug() {
    const S = G.S;
    const w = (x) => (this.flip ? this.L - x : x);
    let sub = '';
    if (this.kind === 'match' && this.order) sub = `Possession ${Math.floor((this.driveIdx || 0) / 2) + 1} of ${this.order.length / 2}`;
    else if (this.cfg.blitz) sub = `First to ${this.cfg.blitz.target || 3} touchdowns`;
    else sub = this.poss === YOU ? 'Score to win the drive' : 'Get a stop to win';
    const yardsToGoal = Math.round(this.L - this.los);
    this.hudUI.scorebug({
      L: this.L, EZ: this.EZ, you: this.score[YOU], them: this.score[CPU], youName: S.team.name.slice(0, 9).toUpperCase(), themName: this.team.short,
      youColor: S.team.jersey, themColor: this.team.color, poss: this.poss,
      dd: `${this.ddText()} · ${yardsToGoal} to the end zone`, sub,
      losW: w(this.los), ltgW: this.ltg >= this.L ? null : w(this.ltg), ballW: w(this.ball && this.ball.state === 'air' ? this.ball.x : this.los),
    });
    this.losLine.position.x = w(this.los);
    this.ltgLine.position.x = w(this.ltg);
    this.ltgLine.visible = this.ltg < this.L;
  }

  _squadBar() {
    const side = this.poss === YOU ? 'off' : 'def';
    const lu = this.lineupFor(side);
    this.hudUI.squadBar(lu.map((m) => {
      const e = this.mine[m.id];
      return {
        id: m.id, name: displayName(m.id), role: m.role.replace(/\d/, ''), portrait: portrait(`cast:${m.id}:b`, teamSpec(m.id)),
        st: this.stOf(e), max: e.maxSt, statuses: Object.keys(e.status), armed: this.armed && this.armed.has(m.id), tired: this.tired(e),
        user: this.userShown === e, ability: CAST[m.id].ability,
      };
    }));
  }

  _camera(dt, snap) {
    let fx = this.los + 6;
    const ph = this.phase;
    if (this.camFocus) fx = this.camFocus.x;
    else if (ph === 'live' || ph === 'dead') {
      const b = this.ball;
      const c = this.carrier;
      if (b.state === 'air' && !b.lateral) fx = lerp(b.x, b.to.x, 0.6) + 2;
      else if (c) fx = c.x + this.goalDir() * 4.5;
      else {
        // pocket: keep the quarterback and the deepest route on screen
        let deep = this.los;
        for (const e of this.off) if (e.keyIdx >= 0) deep = Math.max(deep, e.x);
        const q = this.ball.holder || this.role('QB');
        fx = clamp((q.x + deep) / 2 + 2.5, this.los + 1, this.los + 11);
      }
    } else if (ph === 'kick') fx = this.L - 10;
    const wxT = this.flip ? this.L - fx : fx;
    const goal = clamp(wxT, 8, this.L - 8);
    this.camX = snap ? goal : damp(this.camX, goal, ph === 'live' ? 4.2 : 3, dt);
    const aspect = this.camera.aspect;
    const d = 46 * (aspect < 1.6 ? 1.6 / aspect : 1) * (this.HW / 10);
    const pitch = 0.93;
    this.camera.position.set(this.camX, Math.sin(pitch) * d, 1.0 + Math.cos(pitch) * d);
    this.camera.lookAt(this.camX, 0.5, 1.0);
    this.fx.applyShake(this.camera);
    this.field.rig.follow(this.camX, 0);
  }

  update(dt) {
    if (this.phase === 'live') this.simLive(dt);
    else if (this.phase !== 'kick') {
      // idle drift between plays
      for (const e of this.all || []) { e.vx = damp(e.vx, 0, 8, dt); e.vz = damp(e.vz, 0, 8, dt); }
      if (this.field.hz.type === 'sprinklers') this.hazards(dt);
    }
    // ---- presentation
    const all = new Set([...(this.all || []), ...Object.values(this.mine), ...this.foes]);
    for (const e of all) {
      const on = this.all && this.all.includes(e);
      if (!on) {
        if (e.benchW) { e.ch.setPos(e.benchW.x, e.benchW.z); e.ch.face(Math.PI, dt, 6); }
        e.ch.root.visible = !!e.benchW;
        e.ch.update(dt, 0);
        continue;
      }
      e.ch.root.visible = true;
      e.ch.setPos(this.wx(e.x), this.wz(e.z));
      e.ch.face(this.wyaw(e.yaw), dt, 16);
      if (e.downT > 0 && e.ch.base !== 'down' && e.ch.base !== 'dead') e.ch.setBase('down');
      else if (e.downT <= 0 && e.deadT <= 0 && this.phase !== 'over') {
        const want = e.engaged ? 'block' : e.hasBall && this.phase === 'live' ? 'carry' : (e.ch.floaty ? 'float' : 'move');
        if (e.ch.base !== want && (e.ch.base === 'block' || e.ch.base === 'carry' || e.ch.base === 'move' || e.ch.base === 'float' || e.ch.base === 'down')) e.ch.setBase(want);
      }
      if (e.stunT > 0 && !e.ch.busy) e.ch.setExpr('dizzy', 0.3);
      e.ch.update(dt, Math.hypot(e.vx, e.vz));
    }
    // ball
    const b = this.ball;
    const bm = this.ballMesh;
    if (b.state === 'air' || b.state === 'kick' || b.state === 'spot') {
      bm.visible = true;
      bm.position.set(this.wx(b.x), b.y, this.wz(b.z));
      bm.rotation.y += dt * 4; bm.rotation.z = Math.sin(this.time * 20) * 0.2; bm.rotation.x += dt * (b.state === 'kick' ? 14 : 0);
      if (b.state === 'air' && b.to && !b.lateral) {
        const tx = this.wx(b.to.x), tz = this.wz(b.to.z);
        const k = clamp(1 - b.t / b.T, 0, 1);
        this.ringIn.position.set(tx, 0.06, tz); this.ringOut.position.set(tx, 0.07, tz);
        this.ringIn.scale.setScalar(1.05);
        this.ringOut.scale.setScalar(1.05 + k * 3.4);
        this.ringOut.material.color.set(k < 0.12 ? 0x9bff8a : 0xffffff);
      }
    } else if (b.state === 'loose') {
      b.vy -= 22 * dt; b.y = Math.max(0.2, b.y + b.vy * dt); if (b.y <= 0.2 && b.vy < 0) b.vy *= -0.45;
      b.x += b.bx * dt; b.z += b.bz * dt; b.bx *= 0.97; b.bz *= 0.97;
      bm.position.set(this.wx(b.x), b.y, this.wz(b.z)); bm.rotation.x += dt * 8;
    } else {
      const h = b.holder;
      if (h && h.ch.root.visible) {
        bm.visible = true;
        const yaw = this.wyaw(h.yaw);
        const down = h.downT > 0;
        bm.position.set(this.wx(h.x) + Math.sin(yaw) * 0.42 + Math.cos(yaw) * 0.2, down ? 0.3 : 1.0 * h.ch.scale + h.ch.tilt.position.y, this.wz(h.z) + Math.cos(yaw) * 0.42 - Math.sin(yaw) * 0.2);
        bm.rotation.set(0, yaw, 0.3);
      } else bm.visible = false;
    }
    // your marker + throw bubbles
    const u = this.userShown;
    if (u && this.all.includes(u) && this.phase !== 'huddle') { this.userRing.visible = true; this.userRing.position.set(this.wx(u.x), 0.05, this.wz(u.z)); this.userRing.scale.setScalar(1 + Math.sin(this.time * 6) * 0.06); } else this.userRing.visible = false;
    if (this.phase === 'live' && this.poss === YOU && this.sub === 'pocket' && this.userMode === 'qb' && !this.result) {
      const hidden = this.darkNow || this.off.some((e) => this.has(e, 'glitch'));
      const list = [];
      for (const r of this.off) {
        if (r.keyIdx < 0) continue;
        const o = this.openness(r);
        const far = this.field.hz.type === 'fog' && r.x - this.los > 9;
        list.push({ pos: this.wpos(r, r.ch.height + 0.9), label: G.input.device === 'pad' ? ['□', '△', '◯'][r.keyIdx] : String(r.keyIdx + 1), cls: hidden || far ? 'unk' : o > 2.5 ? '' : o > 1.5 ? 'mid' : 'bad', sub: displayName(r.key) });
      }
      this.hudUI.targets(list, this.camera);
      if (!this._hintSet) this.hudUI.setHint(`${G.ui.key('move')} move · ${G.ui.key('t1')}${G.ui.key('t2')}${G.ui.key('t3')} throw · ${G.ui.key('a')} dodge · cross the blue line to scramble`);
    } else if (this.phase !== 'live') this.hudUI.clearTargets();
    if (this.phase === 'live' && this.poss === CPU && this.sub === 'pocket' && !this.result) this.hudUI.setHint(`${G.ui.key('move')} move · ${G.ui.key('a')} dive tackle · ${G.ui.key('y')} switch defender`);
    this.field.update(dt, this.time, this.phase === 'dead' ? 1 : 0.15);
    this._camera(dt, false);
    this.fx.update(dt, this.camera);
    if (this.phase === 'live') { this._bugT = (this._bugT || 0) + dt; if (this._bugT > 0.15) { this._bugT = 0; this._squadBar(); } }
  }
}
