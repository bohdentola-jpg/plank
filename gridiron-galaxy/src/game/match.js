// The football match screen: stadium + characters + simulation + HUD + play calling + controls.
import * as THREE from '../../vendor/three.module.js';
import { registerScreen } from '../main.js';
import { Stadium } from '../gfx/stadium.js';
import { Character, buildBall, ensureTeamArt, setOutlines } from '../gfx/character.js';
import { ribbon, fieldLine, dashed } from '../gfx/lines.js';
import { Sim } from './sim.js';
import { GameCamera } from './camera.js';
import { HUD } from '../ui/hud.js';
import { PlayCallUI } from '../ui/playcall.js';
import { Menu } from '../ui/menu.js';
import { PLANETS, PLANET_BY_ID } from '../data/planets.js';
import { buildUserTeam, buildPlanetTeam } from '../data/roster.js';
import { BASE_PLAYS, DEF_PLAYS, getPlanetPlays } from '../data/plays.js';
import { FIELD } from '../gfx/textures.js';
import { input, GLYPH, FACE_ORDER } from '../input.js';
import { audio } from '../audio.js';
import { el, clamp, fmtCoins } from '../util.js';

const W2 = FIELD.W / 2;
const ONESHOT = { throw: 0.6, catch: 0.45, juke: 0.42, spin: 0.5, kick: 0.9, stumble: 0.9, getup: 0.6, dive: 0.5 };

export function userPlaybook(save) {
  const owned = new Set(save.playsOwned || []); const extra = [];
  for (const pl of PLANETS) for (const p of getPlanetPlays(pl)) if (owned.has(p.id)) extra.push(p);
  return [...BASE_PLAYS, ...extra];
}

export class GameScreen {
  constructor(app, params) { this.app = app; this.P = params || {}; }
  enter() {
    const app = this.app, P = this.P; app.use2D(false); setOutlines(app.save.settings.outlines);
    this.planet = P.planetObj || PLANET_BY_ID[P.planet] || PLANETS[0];
    this.mode = P.mode || 'exhibition'; this.auto = P.auto === '1' || P.auto === true; this.timeScale = +(P.speed || 1);
    this.home = P.home || buildUserTeam(app.save); this.away = P.away || buildPlanetTeam(this.planet, app.save.settings.difficulty);
    ensureTeamArt(this.home); ensureTeamArt(this.away);
    this.stadium = new Stadium(this.planet, this.home, this.away); this.scene = this.stadium.scene;
    const userPlays = P.userPlays || userPlaybook(app.save); const cpuPlays = [...BASE_PLAYS, ...getPlanetPlays(this.planet)];
    const simMode = this.mode === 'practice' ? 'practice' : (P.simMode || 'game');
    this.sim = new Sim({ home: this.home, away: this.away, userSide: 'home', auto: this.auto, settings: app.save.settings, quirks: this.planet.stadium.quirks, userPlays, cpuPlays, mode: simMode, onEvent: (t, d) => this.onEvent(t, d), hooks: P.hooks || {}, start: P.start });
    if (this.mode === 'practice') { this.sim.practiceSpot = this.sim.ownYard('home', P.spot || 25); this.sim.newSeries(this.sim.practiceSpot); this.sim.noDefense = !!P.noDefense; }
    this.chars = [];
    for (const side of ['home', 'away']) { const team = side === 'home' ? this.home : this.away; this.sim.roster[side].forEach((ent) => { const c = new Character({ species: team.species, team, num: ent.p.num, id: ent.p.id, skinIndex: ent.p.skin, hair: ent.p.hair, hairColor: ent.p.hairColor, gloves: ent.p.role !== 'QB' }); this.scene.add(c.group); ent.char = c; this.chars.push(c); }); }
    this.ball3d = buildBall(); this.scene.add(this.ball3d); this.ballHolder = null; this.ballSpin = 0;
    this.camera = new GameCamera(app); this.hud = new HUD(app, this.sim, this.camera); this.playcall = new PlayCallUI(app, this.sim);
    this.lines = new THREE.Group(); this.scene.add(this.lines); this.marks = new THREE.Group(); this.scene.add(this.marks);
    this.paused = false; this.finalShown = false; this.throwHold = null; this.callPending = false; this.msgT = 0;
    audio.music(this.planet.isFinal ? 'tense' : 'game', this.planet.index + 3);
    this.benchLayout();
    if (P.qa) window.__match = this;
    if (P.onEnter) P.onEnter(this);
  }
  benchLayout() {
    for (const side of ['home', 'away']) { const sx = side === 'home' ? 1 : -1; this.sim.roster[side].forEach((ent, i) => { ent.benchX = sx * (W2 + 4.5 + (i % 2) * 1.6); ent.benchZ = 16 + i * 3.4; }); }
  }
  // ---------- events ----------
  onEvent(type, d) {
    const s = this.sim; const user = 'home'; const H = this.hud;
    const mine = (side) => side === user;
    switch (type) {
      case 'snap': audio.sfx('snap'); this.clearRoutes(); break;
      case 'throw': audio.sfx('throw'); break;
      case 'windup': break;
      case 'catch': audio.sfx('catch'); if (d.team === user) this.stadium.cheer(0.3); break;
      case 'drop': audio.sfx('drop'); break;
      case 'incomplete': audio.sfx('drop'); break;
      case 'tackle': audio.sfx(d.big ? 'bigthud' : 'thud'); this.camera.shake = d.big ? 0.25 : 0.12; break;
      case 'broken': audio.sfx('thud'); break;
      case 'juke': audio.sfx('juke'); break;
      case 'dive': audio.sfx('swoosh'); break;
      case 'lateral': audio.sfx('lateral'); H.showResult('LATERAL!', 'good'); break;
      case 'handoff': break;
      case 'kick': audio.sfx('kick'); break;
      case 'fggood': audio.sfx('goal'); if (mine(s.possession)) { audio.sfx('cheer'); this.stadium.cheer(0.8); } else audio.sfx('boo'); break;
      case 'patgood': audio.sfx('goal'); break;
      case 'fgmiss': audio.sfx(mine(s.possession) ? 'boo' : 'cheer'); break;
      case 'touchdown': audio.sfx('td'); if (mine(d.side)) { audio.sfx('bigcheer'); this.stadium.cheer(1); } else audio.sfx('boo'); this.camera.orbit = 0; break;
      case 'interception': audio.sfx('crowd_gasp'); H.showResult('INTERCEPTED!', mine(d.team) ? 'good' : 'bad'); break;
      case 'fumble': audio.sfx('fumble'); H.showResult('FUMBLE!', 'bad'); break;
      case 'recover': audio.sfx('pop'); break;
      case 'firstdown': audio.sfx('firstdown'); H.showResult('FIRST DOWN', mine(s.possession) ? 'good' : ''); break;
      case 'downs': H.showResult('TURNOVER ON DOWNS', mine(s.possession) ? 'good' : 'bad'); audio.sfx('buzzer'); break;
      case 'turnover': break;
      case 'safety': audio.sfx('buzzer'); break;
      case 'halftime': H.showResult('HALFTIME', '', `${this.home.short} ${s.score.home} · ${this.away.short} ${s.score.away}`); audio.sfx('whistle'); break;
      case 'quarter': H.showResult(`END OF QUARTER ${d - 1}`); audio.sfx('whistle'); break;
      case 'overtime': H.showResult('OVERTIME!', 'good', 'Next score wins'); audio.sfx('bigcheer'); break;
      case 'noPass': H.showResult(d, 'bad'); break;
      case 'switch': audio.sfx('blip'); break;
      case 'scramble': break;
      case 'pat': break;
      case 'playend': {
        const r = d; audio.sfx('whistle'); if (r.sack) audio.sfx('bigthud');
        if (r.text && !['FIRST DOWN'].includes(r.text)) {
          const userOff = s.userOnOffense(); let cls = '';
          if (r.td || r.type === 'score') cls = mine(r.happy) ? 'good' : 'bad'; else if (r.turnover || r.sack || r.type === 'incomplete' || r.type === 'drop') cls = userOff ? 'bad' : 'good'; else if (r.yards !== undefined) cls = (r.yards >= 5) === userOff ? 'good' : '';
          const sub = r.td && r.yards ? `${r.yards}-yard score` : r.lateral && r.type !== 'td' ? 'with a lateral!' : '';
          H.showResult(r.text, cls, sub);
        }
        break;
      }
      case 'final': audio.sfx(d.winner === user ? 'bigcheer' : 'boo'); break;
    }
    if (this.P.qa) { (window.__events = window.__events || []).push({ p: s.playNumber, type, d: d && typeof d === 'object' ? (d.text || d.role || (d.c && d.c.role) || '') : d }); }
    if (this.P.onEvent) this.P.onEvent(type, d, this);
  }
  // ---------- routes & marks ----------
  clearRoutes() { while (this.lines.children.length) this.lines.remove(this.lines.children[0]); }
  drawRoutes() {
    this.clearRoutes(); const s = this.sim; if (!s.userOnOffense() || this.auto) return;
    for (const e of s.roster[s.possession]) {
      if (!e.active) continue; const col = e.glyph !== undefined && !e.isBlocker ? GLYPH[FACE_ORDER[e.glyph]].color : '#ffffff';
      if (e.route && e.route.length) this.lines.add(ribbon([[e.x, e.z], ...e.route.map(p => [p.x, p.z])], 0.28, col, 0.06, { arrow: !e.settle, dot: e.settle }));
      if (e.path && e.isCarrierDesignate) this.lines.add(dashed([[e.x, e.z], ...e.path.map(p => [p.x, p.z]).slice(0, 3)], 0.3, '#ffd23f', 0.07));
    }
  }
  drawMarks() {
    while (this.marks.children.length) this.marks.remove(this.marks.children[0]); const s = this.sim;
    this.marks.add(fieldLine(s.los, '#4a9bff', 0.3, 0.045));
    const ytg = s.yardsToGoal(); if (s.toGo < ytg - 0.01 && s.mode !== 'practice' || (s.mode === 'practice' && s.toGo < ytg)) this.marks.add(fieldLine(s.firstDownZ, '#ffd23f', 0.3, 0.045));
  }
  // ---------- per frame ----------
  update(dt) {
    const s = this.sim; const app = this.app;
    if (this.paused) { this.pauseMenu.update(input); if (input.pressed('options')) this.unpause(); this.hud.update(0); return; }
    if (this.frozen) { this.syncVisuals(dt); this.camera.update(dt, s); this.hud.update(dt); this.stadium.update(dt); if (this.ballOverride) this.ball3d.position.copy(this.ballOverride); return; }
    if ((input.pressed('options') || input.keyEdge.has('Escape')) && s.phase !== 'final' && !this.auto) { this.pause(); return; }
    s.userInput = { move: input.moveVec(), sprint: input.down('r2') };
    switch (s.phase) {
      case 'playcall': this.handlePlaycall(); break;
      case 'presnap': this.handlePresnap(); break;
      case 'live': this.handleLive(dt); break;
      case 'kickmeter': if (!this.auto && s.userOnOffense()) { this.hud.showMeter(s.meter.val, s.kickMode === 'punt' ? 'PUNT · STOP IN THE MIDDLE' : 'KICK · STOP IN THE MIDDLE'); if (input.pressed('cross')) s.actKick(s.meter.val); } break;
      case 'pat': if (this.auto) s.actPAT('kick'); else { if (input.pressed('cross')) s.actPAT('kick'); if (input.pressed('triangle')) s.actPAT('two'); } break;
      case 'final': if (!this.finalShown) this.showFinal(); break;
    }
    if (s.phase !== 'kickmeter') this.hud.hideMeter();
    const steps = this.timeScale > 1 ? Math.round(this.timeScale) : 1;
    for (let i = 0; i < steps; i++) { if (s.phase === 'playcall' && !this.callPending && this.auto) this.handlePlaycall(); s.update(dt); }
    if (s.phase !== 'playcall' && s.phase !== 'pat' && this.playcall.isOpen) this.playcall.close();
    this.syncVisuals(dt); this.camera.update(dt, s); this.hud.update(dt); this.stadium.update(dt);
    if (this.P.onFrame) this.P.onFrame(this, dt);
    this.stadium.setScoreboard({ home: s.score.home, away: s.score.away, clock: s.mode === 'game' ? `${Math.floor(s.clock / 60)}:${String(Math.ceil(s.clock % 60) % 60).padStart(2, '0')}` : '--:--', quarter: s.quarter, down: s.down, togo: Math.ceil(s.toGo), homeName: this.home.short, awayName: this.away.short });
  }
  handlePlaycall() {
    const s = this.sim; if (this.callPending) { this.playcall.update(); return; }
    const userOff = s.userOnOffense();
    const forced = s.forcedPlay(userOff ? s.userPlays : s.cpuPlays); if (forced) { s.callPlay(forced, null); this.afterCall(); return; }
    if (this.auto) { const off = s.cpuOffCall(userOff ? s.userPlays : s.cpuPlays); s.callPlay(off, s.cpuDefCall(off)); this.afterCall(); return; }
    const hooks = this.P.hooks || {};
    if (userOff) {
      if (hooks.forcePlay) { const p = hooks.forcePlay(s); if (p) { s.callPlay(p, null); this.afterCall(); return; } }
      this.callPending = true; this.playcall.open('offense', s.userPlays, (p) => { this.callPending = false; s.callPlay(p, null); this.afterCall(); }, { filterPlays: hooks.filterPlays, filterCats: hooks.filterCats });
    } else {
      const off = s.cpuOffCall(); this.callPending = true; this.playcall.open('defense', DEF_PLAYS, (d) => { this.callPending = false; s.callPlay(off, d); this.afterCall(); });
    }
  }
  afterCall() { this.drawRoutes(); this.drawMarks(); if (this.P.hooks && this.P.hooks.afterCall) this.P.hooks.afterCall(this.sim, this); }
  handlePresnap() {
    const s = this.sim; if (this.auto) return;
    if (s.userOnOffense()) { if (input.pressed('cross')) s.actSnap(); if (input.pressed('circle') && !(this.P.hooks && this.P.hooks.lockPlay)) { audio.sfx('back'); s.phase = 'playcall'; this.clearRoutes(); } }
    else { if (input.pressed('r1')) s.switchDefender(); if (input.pressed('cross')) s.snapT = Math.min(s.snapT, s.playT + 0.25); }
  }
  handleLive(dt) {
    const s = this.sim; if (this.auto) return; const c = s.ball.carrier, u = s.userEnt;
    const throwMode = c && c === u && s.ball.state === 'held' && !s.forwardPassUsed && (c.z - s.los) * s.dir <= 0.3 && c.team === s.possession;
    if (throwMode) {
      for (let i = 0; i < 4; i++) if (input.throwPressed(i) && !this.throwHold) this.throwHold = { i, t: 0 };
      if (this.throwHold) { const h = this.throwHold; h.t += dt; if (!input.throwDown(h.i) || h.t >= 0.32) { s.actThrow(h.i, clamp(h.t / 0.32, 0.15, 1)); this.throwHold = null; } }
      if (input.pressed('l1')) s.actLateral();
    } else {
      this.throwHold = null;
      if (c && c === u && c.state === 'carrier') {
        const mv = input.moveVec(); const camDir = s.dirOf('home'); const jd = Math.abs(mv.x) > 0.3 ? -Math.sign(mv.x) * camDir : 0;
        if (input.pressed('square')) s.actJuke(jd); if (input.pressed('circle')) s.actSpin(); if (input.pressed('cross')) s.actDive(); if (input.pressed('l1') || input.pressed('triangle')) s.actLateral();
      } else if (u && !s.userOnOffense()) {
        if (input.pressed('cross')) s.actDive(); if (input.pressed('square') || input.pressed('triangle')) s.actSwat(); if (input.pressed('r1')) s.switchDefender();
      }
    }
  }
  // ---------- visuals ----------
  syncVisuals(dt) {
    const s = this.sim; const b = s.ball; const result = s.result;
    for (const side of ['home', 'away']) for (const ent of s.roster[side]) {
      const c = ent.char; if (!c) continue;
      if (!ent.active) { c.group.position.set(ent.benchX, 0, ent.benchZ); c.setFacing(ent.benchX > 0 ? -Math.PI / 2 : Math.PI / 2); const want = (s.phase === 'dead' && result && result.happy === side) ? 'celebrate' : 'idle'; if (c.anim.state !== want) c.setState(want, { variant: ent.p.num % 3 }); c.update(dt, 0); continue; }
      c.group.position.set(ent.x, 0, ent.z); c.setFacing(ent.facing);
      if (ent.animOpts && ent.animOpts.restart) { c.setState(ent.anim, { ...ent.animOpts }); ent.animOpts.restart = false; ent.animT = 0; ent.oneShot = ent.anim; }
      ent.animT = (ent.animT || 0) + dt;
      let base;
      if (ent.state === 'down') base = ent.anim === 'downback' ? 'downback' : 'down';
      else if (ent.eff.dive > 0) base = 'dive';
      else if (ent.engaged) base = 'block';
      else if (s.phase === 'presnap') base = ent.team === s.possession ? (ent.role === 'C' ? 'snapset' : ent.isSnapper ? 'qbset' : 'set') : 'set';
      else if (s.phase === 'dead' && result && result.happy === side && (ent.hasBall || (ent.p.num % 2 === 0))) base = 'celebrate';
      else if (s.phase === 'dead' && result && result.happy && result.happy !== side && ent.p.num % 3 === 0 && ent.speed < 0.5) base = 'sad';
      else if (ent.speed > 0.7) base = ent.hasBall ? 'carry' : 'run';
      else base = ent.hasBall && s.phase === 'live' ? 'qbset' : 'idle';
      const dur = ONESHOT[ent.oneShot]; if (ent.oneShot && dur && ent.animT < dur && ent.state !== 'down') { /* let the one-shot finish */ }
      else { ent.oneShot = null; if (c.anim.state !== base) c.setState(base, { variant: ent.p.num % 3 }); }
      c.update(dt, ent.speed);
      if (ent.isUser && !this.auto) this.userChar = c;
      if (ent.hasBall && b.state === 'held' && this.ballHolder !== c) { if (this.ballHolder) this.ballHolder.releaseBall(this.ball3d); c.holdBall(this.ball3d); this.ballHolder = c; }
    }
    if (b.state !== 'held' && this.ballHolder) { this.ballHolder.releaseBall(this.ball3d); this.ballHolder = null; this.scene.add(this.ball3d); }
    if (b.state !== 'held') {
      this.ball3d.position.set(b.x, Math.max(0.15, b.y), b.z);
      const vh = Math.hypot(b.vx, b.vz); if (vh > 0.5) { this.ball3d.rotation.set(0, Math.atan2(b.vx, b.vz) - Math.PI / 2, 0); this.ballSpin += dt * (b.state === 'air' ? 18 : 6); this.ball3d.rotateX(this.ballSpin); if (b.state === 'air') this.ball3d.rotateZ(-Math.atan2(b.vy, vh) * 0.6); } else if (b.state === 'loose') { this.ball3d.rotation.z = 0.9; }
    }
    // controlled-player marker: subtle ring under the user
    if (!this.ring) { this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 24), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.75, depthWrite: false })); this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring); }
    const u = s.userEnt; this.ring.visible = !!u && s.phase !== 'playcall' && !this.auto; if (u) this.ring.position.set(u.x, 0.04, u.z);
  }
  // ---------- pause / final ----------
  pause() {
    this.paused = true; audio.sfx('back'); const app = this.app;
    this.pauseWrap = el('div', { class: 'overlay' }); const panel = el('div', { class: 'panel' }, el('h2', { text: 'PAUSED' })); this.pauseWrap.appendChild(panel); app.ui.appendChild(this.pauseWrap);
    const items = [{ label: 'Resume', action: () => this.unpause() }];
    if (this.mode === 'practice') {
      items.push({ label: `Defense: ${this.sim.noDefense ? 'OFF' : 'ON'}`, hint: 'Toggle the defense for the next play', action: () => { this.sim.noDefense = !this.sim.noDefense; this.unpause(); this.app.toast(`Defense ${this.sim.noDefense ? 'off' : 'on'} next play`); } });
      items.push({ label: 'Move the ball', hint: 'Cycle: own 25 → midfield → opp 20 → goal line', action: () => { const opts = [25, 45, 60, 75]; const cur = Math.round(Math.abs(this.sim.practiceSpot - this.sim.ownGoalZ('home'))); const i = (opts.indexOf(cur) + 1) % opts.length; this.sim.practiceSpot = this.sim.ownYard('home', Math.min(opts[i], 48)); this.sim.newSeries(this.sim.practiceSpot); this.drawMarks(); this.unpause(); } });
    }
    if (this.mode === 'exhibition' || this.mode === 'practice') items.push({ label: 'Restart', action: () => this.app.go('game', this.P) });
    items.push({ label: this.P.quitLabel || 'Quit to Hub', hint: 'Progress in this game is lost', action: () => { if (this.P.onQuit) this.P.onQuit(this); else this.app.go('hub'); } });
    this.pauseMenu = new Menu(app, items, { parent: panel, onBack: () => this.unpause() });
  }
  unpause() { this.paused = false; if (this.pauseWrap) this.pauseWrap.remove(); if (this.pauseMenu) this.pauseMenu.destroy(); input.block(150); }
  showFinal() {
    this.finalShown = true; const s = this.sim, app = this.app;
    if (this.P.customFinal) { this.playcall.close(); this.hud.setHint(''); this.P.customFinal(this); return; } const won = s.score.home > s.score.away; const st = s.stats.home;
    let coins = 0; if (this.mode === 'exhibition' || this.mode === 'story') { coins = won ? 300 + s.score.home * 10 : 100 + s.score.home * 5; app.save.coins += coins; app.save.stats.wins += won ? 1 : 0; app.save.stats.losses += won ? 0 : 1; app.save.stats.tds += st.tds; app.save.stats.laterals += st.laterals; app.save.stats.longestPlay = Math.max(app.save.stats.longestPlay, st.longest); if (this.mode === 'exhibition' && won) app.save.exhibitionWins++; app.persist(); }
    this.playcall.close(); this.hud.setHint('');
    const wrap = el('div', { class: 'overlay' }); const panel = el('div', { class: 'panel final' },
      el('h2', { text: won ? 'VICTORY!' : s.score.home === s.score.away ? 'TIE GAME' : 'DEFEAT' }),
      el('div', { class: 'teams' }, el('span', { text: this.home.name, style: { color: this.home.colors[0], filter: 'brightness(1.5)' } }), el('span', { text: 'vs' }), el('span', { text: this.away.name, style: { color: this.away.colors[0], filter: 'brightness(1.5)' } })),
      el('div', { class: 'score', text: `${s.score.home} – ${s.score.away}` }),
      el('div', { class: 'statgrid', html: `<span>Total yards</span><b>${st.yards}</b><span>Passing / rushing</span><b>${st.passYds} / ${st.rushYds}</b><span>Completions</span><b>${st.comp}/${st.att}</b><span>Touchdowns</span><b>${st.tds}</b><span>Interceptions (D)</span><b>${st.ints}</b><span>Laterals</span><b>${st.laterals}</b><span>Longest play</span><b>${st.longest} yds</b><span>Opponent yards</span><b>${s.stats.away.yards}</b>` }),
      coins ? el('div', { class: 'reward', text: `+${fmtCoins(coins)} coins` }) : null,
    );
    wrap.appendChild(panel); app.ui.appendChild(wrap);
    const items = [{ label: 'Continue', action: () => { if (this.P.onEnd) this.P.onEnd({ won, score: { ...s.score }, stats: s.stats }, this); else app.go('hub'); } }];
    if (this.mode === 'exhibition') items.push({ label: 'Rematch', action: () => app.go('game', this.P) });
    this.finalMenu = new Menu(app, items, { parent: panel });
    this.paused = true; this.pauseMenu = this.finalMenu; this.pauseWrap = wrap;
    if (this.P.onFinal) this.P.onFinal({ won, score: { ...s.score }, stats: s.stats }, this);
  }
  render() { this.app.renderer.render(this.scene, this.camera.cam); }
  resize(w, h) { this.camera.resize(w, h); }
  exit() { this.hud.destroy(); this.playcall.close(); if (this.pauseWrap) this.pauseWrap.remove(); if (window.__match === this) window.__match = null; }
}
registerScreen('game', GameScreen);
