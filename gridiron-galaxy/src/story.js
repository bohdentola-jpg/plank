// Story mode: the Earth tutorial and abduction, the rocket launch, planet-to-planet progression, and the ending.
import * as THREE from '../vendor/three.module.js';
import { registerScreen } from './main.js';
import { PLANETS, PLANET_BY_ID, rangeForParts } from './data/planets.js';
import { KIDS, buildUserTeam } from './data/roster.js';
import { BASE_PLAYS } from './data/plays.js';
import { INTRO, TUTORIAL, ABDUCTION, LAUNCH, TRAVEL, PLANET_LINES, ENDING, ENDING2, CREDITS } from './data/dialog.js';
import { Dialog, kidSpec } from './ui/dialog.js';
import { Stadium, buildUFO } from './gfx/stadium.js';
import { Character, buildBall, ensureTeamArt, setOutlines } from './gfx/character.js';
import { buildRocket } from './gfx/space.js';
import { FIELD } from './gfx/textures.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { el, wait, clamp, lerp, easeInOut, easeOut } from './util.js';

const KID_NAME = { dex: 'Dex', tony: 'Big Tony', zippy: 'Zippy', marcus: 'Hands', priya: 'Priya', kevin: 'Kevin', sam: 'The Wall', jade: 'Jade', ray: "Lil' Ray", maya: 'Maya' };
export function lineFor(who, text, planet) {
  if (who === 'captain' && planet) return { who: planet.team.captain, text, alt: true, portrait: { species: planet.team.species, colors: planet.team.colors, skinIndex: 1 } };
  if (who === 'keeper' && planet) return { who: planet.shops.eat.keeper, text, alt: true, portrait: { species: planet.shops.eat.species, colors: planet.team.colors } };
  return { who: KID_NAME[who] || who, text, portrait: KID_NAME[who] ? kidSpec(who) : null };
}
const friendsTeam = (save) => { const t = buildUserTeam(save); return { ...t, id: 'friends', name: 'The Other Half', short: 'FRIENDS', colors: ['#57e86b', '#1c2b5a'], side: 'away', players: t.players.map(p => ({ ...p, team: 'away' })) }; };
function animate(dur, fn) { return new Promise(res => { const t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / (dur * 1000)); fn(k); if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); }); }

export class StoryController {
  constructor(app) { this.app = app; app.story = this; }
  get st() { return this.app.save.story; }
  current() { return PLANETS[clamp(this.st.planet || 1, 1, PLANETS.length - 1)]; }
  isTarget(planet) { return this.st.introDone && !this.st.complete && planet.index === this.st.planet; }
  start() {
    const st = this.st, app = this.app;
    if (st.complete) { app.toast('Story complete! Roam the galaxy or replay any stadium.'); app.go('hub', { mode: 'roam' }); return; }
    if (!st.introDone) { app.fadeOut(500).then(() => app.go('cutscene', { id: 'intro' })); return; }
    const p = this.current(); app.fadeOut(500).then(() => app.go('district', { planet: p.id, focus: 'stadium' }));
  }
  objectives(planet) {
    const st = this.st; if (!st.introDone) return [];
    const doneCh = (st.challengesDone || []).includes(planet.id), beaten = st.beaten.includes(planet.id);
    if (this.isTarget(planet)) return [{ text: `Side quest: ${planet.challenge.title} (+${planet.challenge.reward} coins)`, done: doneCh }, { text: `Beat the ${planet.team.name} at ${planet.stadium.name}`, done: beaten }, { text: `Win the ${planet.part ? planet.part.name : 'ball'}`, done: beaten }];
    if (beaten) return [{ text: `${planet.team.name} defeated`, done: true }, { text: `Side quest: ${planet.challenge.title}`, done: doneCh }];
    return [];
  }
  marker(planet, spotId) { if (!this.st.introDone) return null; if (spotId === 'stadium' && this.isTarget(planet) && !this.st.beaten.includes(planet.id)) return 'main'; if (spotId === 'practice' && !(this.st.challengesDone || []).includes(planet.id)) return 'side'; return null; }
  async onDistrictEnter(d) {
    const p = d.planet, st = this.st, app = this.app; const lines = PLANET_LINES[p.id];
    if (d.P.storyWin && lines) {
      await d.dialog.sequence(lines.win.map(([w, t]) => lineFor(w, t, p)));
      if (p.part) { audio.sfx('buy'); await d.dialog.say({ who: 'Kevin', text: `Rocket part acquired: ${p.part.name}! ${p.part.desc} Range extended.`, portrait: kidSpec('kevin') }); }
      const next = PLANETS[p.index + 1];
      if (next) { await d.dialog.say({ who: 'Dex', text: `Next stop: ${next.name}. ${next.tagline}`, portrait: kidSpec('dex'), choices: ['Blast off!', 'Stay and shop first'] }).then(async (c) => { if (c === 0) { await app.fadeOut(600); app.go('cutscene', { id: 'travel', from: p.id, to: next.id }); } else d.refreshObjectives(); }); }
      return;
    }
    if (d.P.storyLose && lines) { await d.dialog.sequence(lines.lose.map(([w, t]) => lineFor(w, t, p))); await d.dialog.say({ who: 'Dex', text: 'Shake it off. Hit the shops, run the side quest, and we go again.', portrait: kidSpec('dex') }); return; }
    if (!this.isTarget(p)) return;
    st.arrived = st.arrived || [];
    if (!st.arrived.includes(p.id)) { st.arrived.push(p.id); app.persist(); if (lines) await d.dialog.sequence(lines.arrive.map(([w, t]) => lineFor(w, t, p))); d.refreshObjectives(); }
  }
  intercept(district, spotId) {
    const p = district.planet, app = this.app; if (spotId !== 'stadium' || !this.isTarget(p) || this.st.beaten.includes(p.id)) return false;
    if (app.save.pantry && app.save.pantry.length) { app.save.pantryActive = app.save.pantry.slice(); app.save.pantry = []; app.toast('Pre-game meal eaten! Buffs active for this game.'); }
    app.fadeOut(500).then(() => app.go('game', { planet: p.id, mode: 'story', onEnd: (res) => this.afterMatch(p, res), onQuit: () => app.go('district', { planet: p.id }), quitLabel: `Back to ${p.district}`, onEnter: (m) => this.pregame(m, p) }));
    return true;
  }
  async pregame(match, p) {
    match.frozen = true; const d = new Dialog(this.app); const cap = p.team.captain;
    await d.sequence([{ who: cap, text: p.isFinal ? 'Your ball is in our trophy case. Come and get it, specimens.' : `${p.team.perk.name}! ${p.team.perk.desc} Good luck, Earthlings.`, alt: true, portrait: { species: p.team.species, colors: p.team.colors, skinIndex: 1 } }, { who: 'Dex', text: p.isFinal ? 'Everything we learned. Every planet. One game.' : 'Comets on three. One, two, three, COMETS!', portrait: kidSpec('dex') }]);
    d.hide(); match.frozen = false; this.app.save.pantryActive = this.app.save.pantryActive; 
  }
  afterMatch(p, res) {
    const st = this.st, app = this.app; app.save.pantryActive = []; 
    if (res.won) {
      if (!st.beaten.includes(p.id)) { st.beaten.push(p.id); app.save.teamLevel = Math.min(35, app.save.teamLevel + 1); if (p.part) st.rocketParts.push(p.part.name); if (!app.save.unlockedStadiums.includes(p.id)) app.save.unlockedStadiums.push(p.id); app.save.coins += 250; }
      if (p.isFinal) { app.persist(); app.fadeOut(600).then(() => app.go('cutscene', { id: 'ending' })); return; }
      st.planet = p.index + 1; app.persist(); app.space.setRange(rangeForParts(st.rocketParts.length));
      app.fadeOut(500).then(() => app.go('district', { planet: p.id, focus: 'stadium', storyWin: true }));
    } else { app.persist(); app.fadeOut(500).then(() => app.go('district', { planet: p.id, focus: 'practice', storyLose: true })); }
  }
  leave(planet) { return false; }

  // ---------- tutorial (runs inside the match screen) ----------
  tutorialParams() {
    const app = this.app; const home = buildUserTeam(app.save); const away = friendsTeam(app.save); const self = this; this.tutStep = 0; this.abducting = false;
    const stepPlay = ['slants', 'dive', 'verts'];
    return {
      planet: 'earth', mode: 'tutorial', simMode: 'practice', spot: 25, home, away, userPlays: BASE_PLAYS, qa: false,
      hooks: {
        filterPlays: (p) => p.id === stepPlay[self.tutStep], filterCats: null, lockPlay: true, noPAT: true,
        afterCall: (sim) => { self.tutText(TUTORIAL['step' + (self.tutStep + 1)][1]); if (self.tutStep === 2) sim.eligibles = sim.eligibles.filter(e => e.role === 'X'); },
        onPlayEnd: (r, sim) => { if (self.abducting) return; if (self.tutStep < 2) self.tutStep++; self.tutText(TUTORIAL['step' + (self.tutStep + 1)][0]); },
        onLive: (sim) => { const b = sim.ball; if (self.tutStep === 2 && !self.abducting && b.state === 'air' && b.forward && b.flightT && b.airT / b.flightT > 0.68 && b.target && b.target.role === 'X') self.abduct(self.match); },
      },
      onEnter: (m) => { self.match = m; self.tutBox = el('div', { class: 'tutbox' }); app.ui.appendChild(self.tutBox); self.tutText(TUTORIAL.step1[0]); },
      onQuit: () => app.go('hub'), quitLabel: 'Skip to the hub',
    };
  }
  tutText(t) { if (this.tutBox) this.tutBox.textContent = t; }
  async abduct(match) {
    this.abducting = true; const app = this.app, sim = match.sim; match.frozen = true; audio.sfx('ufo'); if (this.tutBox) this.tutBox.remove();
    const b = sim.ball; const ufo = buildUFO(5); ufo.position.set(b.x, 45, b.z); match.scene.add(ufo);
    const camDir = sim.dir; match.camera.override = { pos: new THREE.Vector3(b.x + 8, 6, b.z - camDir * 14), look: new THREE.Vector3(b.x, 6, b.z), k: 3 };
    await animate(1.6, (k) => { ufo.position.y = lerp(45, 12, easeInOut(k)); ufo.rotation.y += 0.05; ufo.userData.lights.rotation.y -= 0.1; });
    ufo.userData.beam.visible = true; ufo.userData.glow.intensity = 3; audio.sfx('beam');
    const start = new THREE.Vector3(b.x, b.y, b.z); match.ballOverride = start.clone();
    await animate(1.8, (k) => { match.ballOverride.set(start.x + Math.sin(k * 25) * 0.15, lerp(start.y, 11.5, easeInOut(k)), start.z); match.ball3d.rotation.y += 0.2; ufo.userData.lights.rotation.y -= 0.1; });
    match.ballOverride.set(0, -50, 0); ufo.userData.beam.visible = false; ufo.userData.glow.intensity = 0; audio.sfx('warp');
    await animate(1.5, (k) => { ufo.position.y = lerp(12, 90, k * k); ufo.position.x += k * 1.2; ufo.position.z += camDir * k * 0.8; ufo.rotation.z = -k * 0.7; match.camera.override.look.set(ufo.position.x, ufo.position.y, ufo.position.z); });
    match.scene.remove(ufo); match.camera.override = null;
    const d = new Dialog(app); await d.sequence(ABDUCTION.map(l => lineFor(l.who, l.text))); d.hide();
    this.st.introDone = true; this.st.planet = 1; app.persist();
    await app.fadeOut(700); app.go('cutscene', { id: 'launch' });
  }
}

// ---------- cutscenes ----------
class CutsceneScreen {
  constructor(app, params) { this.app = app; this.P = params || {}; this.t = 0; }
  enter() {
    const app = this.app; app.use2D(false); setOutlines(app.save.settings.outlines); this.dialog = new Dialog(app); this.chars = []; this.done = false;
    app.ui.appendChild(el('div', { class: 'skip', html: `${input.glyphHTML('options', 'Skip')}` }));
    const fn = this[this.P.id]; if (fn) fn.call(this).catch(e => console.error(e)); else app.go('hub');
  }
  setup3d(planetId, home, away) {
    const planet = PLANET_BY_ID[planetId]; ensureTeamArt(home); ensureTeamArt(away); this.stadium = new Stadium(planet, home, away); this.scene = this.stadium.scene;
    this.camera = new THREE.PerspectiveCamera(46, this.app.vw / this.app.vh, 0.1, 1500); this.camPos = new THREE.Vector3(0, 8, 10); this.camLook = new THREE.Vector3(0, 1, 35);
    this.mode = '3d';
  }
  kid(id, team, x, z, state = 'idle', facing = 0) {
    const k = KIDS.find(p => p.id === id); const c = new Character({ species: 'kid', team, num: k.num, id: k.id, skinIndex: k.skin, hair: k.hair, hairColor: k.hairColor, gloves: id !== 'dex' });
    c.group.position.set(x, 0, z); c.setFacing(facing); c.setState(state, { variant: k.num % 3 }); this.scene.add(c.group); this.chars.push(c); return c;
  }
  caption(text, sub = '') { const c = el('div', { class: 'caption', html: `${text}${sub ? `<small>${sub}</small>` : ''}` }); this.app.ui.appendChild(c); setTimeout(() => c.remove(), 3500); }
  async intro() {
    const app = this.app; const home = buildUserTeam(app.save), away = friendsTeam(app.save); this.setup3d('earth', home, away);
    const L = FIELD.L / 2; const off = ['dex', 'tony', 'zippy', 'marcus', 'priya'], def = ['kevin', 'sam', 'jade', 'ray', 'maya'];
    off.forEach((id, i) => this.kid(id, home, -6 + i * 3, L - 4, 'idle', 0)); def.forEach((id, i) => this.kid(id, away, -6 + i * 3, L + 4, 'idle', Math.PI));
    this.chars[0].holdBall(buildBall());
    this.camPos.set(-14, 5, L - 14); this.camLook.set(0, 1.2, L); this.orbit = true;
    audio.music('story', 5); await wait(600); this.caption('MAPLE STREET, EARTH', 'Saturday. 4:02 PM. Undefeated.');
    await this.dialog.sequence(INTRO.map(l => lineFor(l.who, l.text)));
    await app.fadeOut(600); app.go('game', app.story.tutorialParams());
  }
  async launch() {
    const app = this.app; const home = buildUserTeam(app.save), away = friendsTeam(app.save); this.setup3d('earth', home, away);
    const g = this.stadium.garageRocket; const garage = g.parent; // rocket inside the garage group
    const gx = -FIELD.W / 2 - 16, gz = -12; const ids = ['dex', 'tony', 'zippy', 'marcus', 'priya', 'kevin', 'sam', 'jade', 'ray', 'maya'];
    ids.forEach((id, i) => this.kid(id, i < 5 ? home : away, gx + 8 + (i % 5) * 2.2, gz + 12 + Math.floor(i / 5) * 2.5, 'idle', Math.PI));
    this.camPos.set(gx + 4, 6, gz + 30); this.camLook.set(gx, 5, gz);
    audio.music('story', 6); await wait(500); this.caption("KEVIN'S GARAGE", 'GOOBER field office (unofficial)');
    await this.dialog.sequence(LAUNCH.map(l => lineFor(l.who, l.text)));
    // kids run into the garage, rocket lifts
    for (const c of this.chars) c.setState('run');
    await animate(1.6, (k) => { this.chars.forEach((c, i) => { c.group.position.z = lerp(gz + 12 + Math.floor(i / 5) * 2.5, gz + 3, easeInOut(k)); c.group.position.x = lerp(gx + 8 + (i % 5) * 2.2, gx + (i % 5 - 2) * 1.2, easeInOut(k)); c.update(1 / 60, 6); }); });
    for (const c of this.chars) c.group.visible = false;
    garage.remove(g); this.scene.add(g); g.position.set(gx, 7, gz - 1); g.rotation.set(-Math.PI / 2 + 0.15, 0, 0); g.scale.setScalar(2.2);
    audio.sfx('rocket'); this.stadium.cheer(1);
    await animate(4.5, (k) => { const e = k * k; g.position.y = 7 + e * 160; g.rotation.x = lerp(-Math.PI / 2 + 0.15, -Math.PI / 2, k); g.userData.flame.scale.set(1.6, 2.5 + Math.sin(this.t * 40) * 0.5, 1.6); this.camLook.set(gx, g.position.y * 0.85, gz); this.camPos.set(gx + 10 + k * 20, 6 + e * 40, gz + 30 + k * 15); });
    await app.fadeOut(800);
    app.space.setRange(rangeForParts(0)); app.go('cutscene', { id: 'travel', from: 'earth', to: 'luna' });
  }
  async travel() {
    const app = this.app, sp = app.space; const from = PLANET_BY_ID[this.P.from] || PLANETS[0], to = PLANET_BY_ID[this.P.to] || PLANETS[1];
    this.mode = 'space'; sp.mode = 'cinematic'; sp.setTarget(to); const A = new THREE.Vector3(...from.pos), B = new THREE.Vector3(...to.pos);
    const dirAB = B.clone().sub(A).normalize(); const start = A.clone().addScaledVector(dirAB, from.radius + 6), end = B.clone().addScaledVector(dirAB, -(to.radius + 8));
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 30 + start.distanceTo(end) * 0.15, 0));
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end); audio.music('space', 3); audio.sfx('warp');
    this.caption(`TO ${to.name.toUpperCase()}`, to.district);
    const banter = TRAVEL[(from.index + to.index) % TRAVEL.length]; const dur = 8;
    let said = 0; const t0 = performance.now();
    await animate(dur, (k) => {
      const e = easeInOut(k); const p = curve.getPoint(e); const tangent = curve.getTangent(Math.min(0.999, e)).normalize();
      sp.rocket.position.copy(p); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent); sp.rocket.quaternion.slerp(q, 0.2); sp.ship.speed = 60 * (1 - Math.abs(k - 0.5) * 1.6);
      const camP = p.clone().addScaledVector(tangent, -12).add(new THREE.Vector3(3, 4, 0)); sp.camera.position.lerp(camP, 0.12); sp.camera.lookAt(p.clone().addScaledVector(tangent, 10));
      sp.ship.pos.copy(p);
      const el2 = (performance.now() - t0) / 1000; if (said === 0 && el2 > 1.2) { said = 1; this.dialog.set({ who: KID_NAME[banter[0]], text: banter[1], portrait: kidSpec(banter[0]) }); } if (said === 1 && el2 > 4.4) { said = 2; this.dialog.set({ who: KID_NAME[banter[2]], text: banter[3], portrait: kidSpec(banter[2]) }); }
    });
    audio.sfx('land'); await app.fadeOut(700); sp.mode = 'menu'; sp.placeAt(to, PLANETS[Math.min(to.index + 1, PLANETS.length - 1)]);
    app.go('district', { planet: to.id, focus: 'stadium' });
  }
  async ending() {
    const app = this.app; const home = buildUserTeam(app.save), away = friendsTeam(app.save); this.setup3d('earth', home, away);
    const L = FIELD.L / 2; const ids = ['dex', 'tony', 'zippy', 'marcus', 'priya', 'kevin', 'sam', 'jade', 'ray', 'maya'];
    ids.forEach((id, i) => this.kid(id, i < 5 ? home : away, -8 + i * 1.8, L - 2 + (i % 2) * 2, 'idle', 0));
    const ball = buildBall(); const zippy = this.chars[2]; zippy.holdBall(ball);
    this.camPos.set(-12, 5, L - 16); this.camLook.set(0, 1.2, L); this.orbit = true;
    audio.music('victory', 9); await wait(600); this.caption('MAPLE STREET, EARTH', 'Several light-years later.');
    await this.dialog.sequence(ENDING.map(l => lineFor(l.who, l.text)));
    this.orbit = false; zippy.setState('carry'); const z0 = zippy.group.position.z;
    await animate(2.2, (k) => { zippy.group.position.z = z0 + k * 14; zippy.update(1 / 60, 7); this.camLook.set(zippy.group.position.x, 1.2, zippy.group.position.z); this.camPos.set(zippy.group.position.x - 8, 5, zippy.group.position.z - 10); });
    // the fumble
    zippy.releaseBall(ball); this.scene.add(ball); const bp = zippy.group.position.clone().add(new THREE.Vector3(0.5, 1.2, 0.5)); ball.position.copy(bp); zippy.setState('stumble'); audio.sfx('fumble');
    await animate(1.0, (k) => { ball.position.set(bp.x + k * 3, bp.y + Math.sin(k * Math.PI) * 2.5 - k * 1.0, bp.z + k * 2); ball.rotation.x += 0.3; zippy.update(1 / 60, 0); });
    for (const c of this.chars) c.setState('idle');
    audio.sfx('ufo'); const ufo = buildUFO(5); ufo.position.set(ball.position.x, 45, ball.position.z); this.scene.add(ufo);
    await animate(1.6, (k) => { ufo.position.y = lerp(45, 12, easeInOut(k)); ufo.rotation.y += 0.05; this.camLook.set(ball.position.x, 4, ball.position.z); this.camPos.set(ball.position.x - 10, 6, ball.position.z - 12); });
    ufo.userData.beam.visible = true; audio.sfx('beam'); const by = ball.position.y;
    await animate(1.8, (k) => { ball.position.y = lerp(by, 11.5, easeInOut(k)); ball.rotation.y += 0.2; });
    ball.visible = false; ufo.userData.beam.visible = false; audio.sfx('warp');
    await animate(1.4, (k) => { ufo.position.y = lerp(12, 90, k * k); ufo.position.x += k; ufo.rotation.z = -k * 0.7; this.camLook.copy(ufo.position); });
    this.scene.remove(ufo);
    await this.dialog.sequence(ENDING2.map(l => lineFor(l.who, l.text)));
    this.st = app.save.story; this.st.complete = true; app.persist();
    await app.fadeOut(800); this.mode = 'space'; app.space.mode = 'menu'; app.space.cam.pos.set(-24, 9, 36); app.space.aimCam(0, 0, 0); app.space.setTarget(null); app.fadeIn(800);
    audio.music('space', 12);
    const cred = el('div', { class: 'credits' }, ...CREDITS.map((l, i) => i === 0 ? el('h1', { text: l }) : l === '' ? el('br') : ['STARRING', 'FEATURING', 'GOOBER'].includes(l) ? el('h3', { text: l }) : el('div', { text: l }))); app.ui.appendChild(cred);
    await animate(28, (k) => { cred.style.bottom = `${-100 + k * 230}%`; });
    await app.fadeOut(600); app.go('hub');
  }
  update(dt) {
    this.t += dt; this.dialog.update(dt);
    if (input.pressed('options') && !this.skipping) this.skip();
    if (this.mode === '3d') {
      if (this.orbit) { const a = this.t * 0.12; const c = this.camLook; this.camPos.set(c.x + Math.sin(a) * 16, 5 + Math.sin(this.t * 0.3), c.z + Math.cos(a) * 16); }
      this.camera.position.lerp(this.camPos, 0.08); const look = this.camera.userData.look || (this.camera.userData.look = this.camLook.clone()); look.lerp(this.camLook, 0.1); this.camera.lookAt(look);
      this.stadium.update(dt); for (const c of this.chars) c.update(dt, c.anim.state === 'run' || c.anim.state === 'carry' ? 6 : 0);
    } else if (this.mode === 'space') { this.app.space.update(dt, null, { labels: false, lockInput: true }); }
  }
  async skip() {
    this.skipping = true; const app = this.app; const id = this.P.id; audio.sfx('back');
    if (id === 'intro') { await app.fadeOut(400); app.go('game', app.story.tutorialParams()); }
    else if (id === 'launch') { await app.fadeOut(400); app.space.setRange(rangeForParts(0)); app.go('district', { planet: 'luna', focus: 'stadium' }); }
    else if (id === 'travel') { await app.fadeOut(400); app.space.mode = 'menu'; app.go('district', { planet: this.P.to, focus: 'stadium' }); }
    else if (id === 'ending') { app.save.story.complete = true; app.persist(); await app.fadeOut(400); app.go('hub'); }
  }
  render() { if (this.mode === '3d') this.app.renderer.render(this.scene, this.camera); else if (this.mode === 'space') this.app.space.render(this.app.renderer); }
  resize(w, h) { if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); } }
  exit() { this.dialog.hide(); if (this.mode === 'space') this.app.space.mode = 'menu'; }
}
class StoryScreen { constructor(app) { this.app = app; } enter() { (this.app.story || new StoryController(this.app)).start(); } }
registerScreen('cutscene', CutsceneScreen); registerScreen('story', StoryScreen);
export function installStory(app) { return app.story || new StoryController(app); }
