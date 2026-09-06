// Practice-field side quests: each planet has one challenge type with its own rules, built on top of the match screen.
import { registerScreen } from './main.js';
import { PLANETS, PLANET_BY_ID } from './data/planets.js';
import { buildUserTeam, buildPlanetTeam } from './data/roster.js';
import { BASE_PLAYS, DEF_PLAYS } from './data/plays.js';
import { userPlaybook } from './game/match.js';
import { Menu } from './ui/menu.js';
import { el, fmtCoins, fmtClock } from './util.js';
import { audio } from './audio.js';

export function challengeParams(app, planet) {
  const ch = planet.challenge; const type = ch.type; const state = { count: 0, plays: 0, yards: 0, made: 0, attempts: 0, time: ch.time || 0, done: false, success: false, catchZ: null, note: '' };
  const home = buildUserTeam(app.save), away = buildPlanetTeam(planet, app.save.settings.difficulty);
  const P = { planet: planet.id, mode: 'challenge', simMode: 'practice', spot: 25, home, away, userPlays: userPlaybook(app.save), hooks: { noPAT: true }, quitLabel: `Back to ${planet.district}`, onQuit: () => app.go('district', { planet: planet.id, focus: 'practice' }) };
  const back = () => app.go('district', { planet: planet.id, focus: 'practice' });
  const goal = { passing: `Complete ${ch.n} passes in ${ch.time}s`, run: `Gain ${ch.yards} yards in ${ch.n} run plays`, longbomb: `Complete a ${ch.yards}+ yard pass (5 tries)`, kick: `Make ${ch.n} of 4 field goals`, drill2min: `Score a TD before the clock hits 0:00`, stand: 'Keep them out of the end zone for 4 downs', puntreturn: `Return a punt ${ch.yards}+ yards (3 tries)`, lateral: 'Score a TD on a play with a lateral (8 plays)', pick6: 'Intercept a pass (8 plays)', redzone: 'Score from the 10 in 2 plays (3 tries)', trick: 'Score a TD with a Special play (5 plays)' }[type] || ch.desc;
  const finish = (m, success) => {
    if (state.done) return; state.done = true; state.success = success; m.sim.forceEnd();
  };
  const status = (m) => {
    const s = m.sim;
    switch (type) {
      case 'passing': return `${state.count}/${ch.n} completions · ${fmtClock(state.time)} left`;
      case 'run': return `${state.yards}/${ch.yards} yards · play ${Math.min(state.plays + 1, ch.n)}/${ch.n}`;
      case 'longbomb': return `Longest: ${state.yards} yds · attempt ${Math.min(state.attempts + 1, 5)}/5`;
      case 'kick': return `${state.made}/${ch.n} made · kick ${Math.min(state.attempts + 1, 4)}/4 from ${[25, 32, 40, 47][Math.min(state.attempts, 3)]} yds`;
      case 'drill2min': return `${fmtClock(s.clock)} · ${s.downText()} at ${s.spotText()}`;
      case 'stand': return `Down ${Math.min(state.plays + 1, 4)} of 4 · ball on ${s.spotText()}`;
      case 'puntreturn': return `Best return: ${state.yards} yds · try ${Math.min(state.attempts + 1, 3)}/3`;
      case 'lateral': return `Play ${Math.min(state.plays + 1, 8)}/8 · laterals so far: ${state.count}`;
      case 'pick6': return `Play ${Math.min(state.plays + 1, 8)}/8`;
      case 'redzone': return `Try ${Math.min(state.attempts + 1, 3)}/3 · play ${(state.plays % 2) + 1}/2`;
      case 'trick': return `Play ${Math.min(state.plays + 1, 5)}/5 · Special plays only`;
      default: return '';
    }
  };
  // per-type setup
  if (type === 'passing') { P.noDefense = true; }
  if (type === 'run') { P.hooks.filterCats = ['run']; P.hooks.filterPlays = (p) => p.cat === 'run'; }
  if (type === 'kick') { P.hooks.forcePlay = () => BASE_PLAYS.find(p => p.type === 'fg'); P.spot = 50 - (25 - 17); }
  if (type === 'drill2min') { P.simMode = 'game'; P.start = { clock: ch.time, quarter: 4, possession: 'home' }; P.spot = 10; }
  if (type === 'stand') { P.simMode = 'practice'; P.start = { possession: 'away', los: 35 }; P.hooks.practicePossession = 'away'; }
  if (type === 'puntreturn') { P.start = { possession: 'away' }; P.hooks.practicePossession = 'away'; P.hooks.cpuForcePlay = (sim, pb) => pb.find(p => p.type === 'punt'); }
  if (type === 'lateral') { P.spot = 30; }
  if (type === 'pick6') { P.start = { possession: 'away' }; P.hooks.practicePossession = 'away'; P.hooks.cpuBias = 'pass'; }
  if (type === 'redzone') { P.spot = 40; }
  if (type === 'trick') { P.spot = 20; P.hooks.filterCats = ['special', 'planet']; P.hooks.filterPlays = (p) => (p.cat === 'special' || p.cat === 'planet') && p.type !== 'punt' && p.type !== 'fg'; }
  P.onEnter = (m) => {
    const s = m.sim;
    if (P.hooks.practicePossession) { s.practicePossession = P.hooks.practicePossession; s.possession = 'away'; s.newSeries(P.start && P.start.los !== undefined ? P.start.los : s.ownYard('away', 25)); s.practiceSpot = s.los; }
    if (type === 'kick') { s.practiceSpot = s.targetGoalZ('home') - s.dir * 8; s.newSeries(s.practiceSpot); }
    if (type === 'redzone') { s.practiceSpot = s.targetGoalZ('home') - s.dir * 10; s.newSeries(s.practiceSpot); }
    if (type === 'lateral' || type === 'trick') { s.practiceSpot = s.targetGoalZ('home') - s.dir * (type === 'lateral' ? 30 : 30); s.newSeries(s.practiceSpot); }
    if (type === 'drill2min') { s.newSeries(s.ownYard('home', 10)); }
    m.objBox = el('div', { class: 'objective', style: { top: '150px' } }, el('div', { class: 'panel' }, el('h4', { text: `SIDE QUEST · ${ch.title.toUpperCase()}` }), el('div', { text: goal, style: { fontSize: '15px', marginBottom: '6px' } }), el('div', { class: 'stat', style: { color: '#ffd23f', fontWeight: '900' } })));
    app.ui.appendChild(m.objBox);
  };
  P.onFrame = (m, dt) => {
    if (state.done) return; const s = m.sim;
    if (type === 'passing' && !m.paused) { state.time -= dt; if (state.time <= 0) { state.time = 0; finish(m, state.count >= ch.n); } }
    const st = m.objBox && m.objBox.querySelector('.stat'); if (st) st.textContent = status(m);
  };
  P.onEvent = (t, d, m) => {
    if (state.done) return; const s = m.sim;
    if (t === 'catch' && d.team === 'home' && s.ball.forward !== false && type === 'passing' && s.forwardPassUsed) { state.count++; audio.sfx('coin'); if (state.count >= ch.n) finish(m, true); }
    if (t === 'puntcatch' && d.team === 'home') state.catchZ = d.z;
    if (t === 'interception' && d.team === 'home' && type === 'pick6') finish(m, true);
    if (t === 'touchdown') {
      if (type === 'drill2min' && d.side === 'home') finish(m, true);
      if (type === 'stand' && d.side === 'away') finish(m, false);
      if (type === 'lateral' && d.side === 'home') { if (s.laterals > 0) finish(m, true); else state.note = 'No lateral on that one!'; }
      if (type === 'redzone' && d.side === 'home') finish(m, true);
      if (type === 'trick' && d.side === 'home') finish(m, true);
    }
    if (t === 'fggood' && type === 'kick') { state.made++; }
    if (t === 'fggood' && type === 'stand') finish(m, false);
    if (t === 'final' && type === 'drill2min') finish(m, false);
    if (t === 'playend') {
      const r = d;
      if (type === 'run') { if (r.yards !== undefined) state.yards += Math.max(0, r.yards); if (r.td) state.yards += 50; state.plays++; if (state.yards >= ch.yards) finish(m, true); else if (state.plays >= ch.n) finish(m, false); }
      if (type === 'longbomb') { if (s.passCrossed && r.yards !== undefined && s.forwardPassUsed) state.yards = Math.max(state.yards, r.td ? 99 : r.yards); if (r.td && s.forwardPassUsed) state.yards = 99; state.attempts++; if (state.yards >= ch.yards) finish(m, true); else if (state.attempts >= 5) finish(m, false); }
      if (type === 'kick') { state.attempts++; if (state.made >= ch.n) finish(m, true); else if (state.attempts >= 4) finish(m, false); else { s.practiceSpot = s.targetGoalZ('home') - s.dir * ([25, 32, 40, 47][state.attempts] - 17); } }
      if (type === 'stand') { state.plays++; if (r.turnover || (r.type === 'punt')) finish(m, true); else if (state.plays >= 4) finish(m, !r.td); else { s.practiceSpot = r.type === 'incomplete' || r.type === 'drop' ? s.los : r.spot; } }
      if (type === 'puntreturn') { if (state.catchZ !== null && r.spot !== undefined && s.ball.lastTeam === 'home') { const gained = Math.round((r.spot - state.catchZ) * s.dirOf('home')); state.yards = Math.max(state.yards, r.td ? 99 : gained); } state.catchZ = null; state.attempts++; if (state.yards >= ch.yards) finish(m, true); else if (state.attempts >= 3) finish(m, false); }
      if (type === 'lateral') { state.count += s.laterals; state.plays++; if (state.plays >= 8) finish(m, false); }
      if (type === 'pick6') { state.plays++; if (state.plays >= 8) finish(m, false); }
      if (type === 'redzone') { state.plays++; if (state.plays % 2 === 0) { state.attempts++; if (state.attempts >= 3) finish(m, false); } }
      if (type === 'trick') { state.plays++; if (state.plays >= 5) finish(m, false); }
      if (type === 'drill2min' && (r.turnover || r.type === 'punt')) finish(m, false);
    }
    if (t === 'downs' && type === 'drill2min') finish(m, false);
    if (t === 'downs' && type === 'stand') finish(m, true);
  };
  P.customFinal = (m) => {
    const save = app.save; save.story.challengesDone = save.story.challengesDone || []; const already = save.story.challengesDone.includes(planet.id);
    let coins = 0; if (state.success) { coins = already ? Math.round(ch.reward / 2) : ch.reward; save.coins += coins; if (!already) save.story.challengesDone.push(planet.id); app.persist(); }
    audio.sfx(state.success ? 'bigcheer' : 'boo');
    const wrap = el('div', { class: 'overlay' }); const panel = el('div', { class: 'panel final' }, el('h2', { text: state.success ? 'SIDE QUEST COMPLETE!' : 'NOT THIS TIME' }), el('div', { text: `${ch.title} · ${goal}`, style: { marginBottom: '8px' } }), el('div', { class: 'tag', text: status(m) }), coins ? el('div', { class: 'reward', text: `+${fmtCoins(coins)} coins` }) : el('p', { text: state.note || (state.success ? '' : 'Try again from the practice field.') }));
    wrap.appendChild(panel); app.ui.appendChild(wrap);
    const items = [{ label: state.success ? 'Continue' : 'Back to town', action: back }]; if (!state.success) items.unshift({ label: 'Retry', action: () => app.go('challenge', { planet: planet.id }) });
    m.paused = true; m.pauseMenu = new Menu(app, items, { parent: panel }); m.pauseWrap = wrap;
  };
  return P;
}
class ChallengeScreen { constructor(app, params) { this.app = app; this.P = params; } enter() { const planet = PLANET_BY_ID[this.P.planet] || PLANETS[1]; this.app.go('game', challengeParams(this.app, planet)); } }
registerScreen('challenge', ChallengeScreen);
