// QA scenes: ?scene=gallery (every species animating) and ?scene=stadium&planet=id (a stadium fly-around).
import * as THREE from '../../vendor/three.module.js';
import { registerScreen } from '../main.js';
import { Character, buildBall, ensureTeamArt, setOutlines } from './character.js';
import { Stadium } from './stadium.js';
import { SPECIES_IDS } from '../data/species.js';
import { PLANETS, PLANET_BY_ID } from '../data/planets.js';
import { buildPlanetTeam, buildUserTeam } from '../data/roster.js';
import { input } from '../input.js';
import { el } from '../util.js';

class GalleryScreen {
  constructor(app, params) { this.app = app; this.params = params; }
  enter() {
    const app = this.app; app.use2D(false); setOutlines(app.save.settings.outlines);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#3a5a8a');
    this.scene.add(new THREE.HemisphereLight('#bfe0ff', '#4a6a3a', 0.9)); const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.set(10, 20, 15); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; this.scene.add(sun); this.scene.add(new THREE.AmbientLight('#ffffff', 0.3));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshToonMaterial({ color: '#5cae4e' })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    this.camera = new THREE.PerspectiveCamera(45, app.vw / app.vh, 0.1, 500);
    const ids = this.params.species ? this.params.species.split(',') : SPECIES_IDS; const cols = Math.ceil(Math.sqrt(ids.length * 1.6));
    this.chars = []; this.t = 0;
    ids.forEach((id, i) => {
      const planet = PLANETS.find(p => p.team.species === id) || PLANETS[0]; const team = ensureTeamArt({ colors: planet.team.colors, short: planet.team.short, name: planet.team.name });
      const c = new Character({ species: id, team, num: (i * 7) % 99 + 1, id: 'g' + i, skinIndex: i, hair: ['short', 'ponytail', 'curly', 'braid', 'bob', 'spiky'][i % 6], gloves: i % 2 === 0 });
      c.group.position.set((i % cols - (cols - 1) / 2) * 3.2, 0, -Math.floor(i / cols) * 3.6); this.scene.add(c.group); this.chars.push(c);
      if (i % 5 === 0) c.holdBall(buildBall());
    });
    this.states = (this.params.anim || 'idle,run,carry,throw,catch,set,block,dive,down,celebrate,kick,juke').split(',');
    this.rows = Math.ceil(ids.length / cols); this.cols = cols;
    app.ui.appendChild(el('div', { class: 'hint', html: 'GALLERY · number keys cycle animations · WASD orbit' }));
    this.label = el('div', { class: 'center-msg', text: '' }); app.ui.appendChild(this.label);
    this.stateIdx = 0; this.orbit = 0; this.dist = +(this.params.dist || 16);
  }
  update(dt) {
    this.t += dt; if (this.t > 2.5) { this.t = 0; this.stateIdx = (this.stateIdx + 1) % this.states.length; }
    const st = this.states[this.stateIdx]; this.label.textContent = st.toUpperCase();
    const mv = input.moveVec(); this.orbit += mv.x * dt * 1.2; this.dist = Math.max(4, this.dist - mv.y * dt * 10);
    this.chars.forEach((c, i) => { const speed = ['run', 'carry', 'juke'].includes(st) ? 6 : 0; if (c.anim.state !== st) c.setState(st, { variant: i % 3, dir: 1 }); c.update(dt, speed); c.setFacing(this.params.face ? +this.params.face : 0.2 * Math.sin(this.t * 0.5 + i)); });
    const cz = -(this.rows - 1) * 1.8; this.camera.position.set(Math.sin(this.orbit) * this.dist, 5 + this.dist * 0.35, cz + Math.cos(this.orbit) * this.dist); this.camera.lookAt(0, 1.2, cz);
  }
  render() { this.app.renderer.render(this.scene, this.camera); }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  exit() { }
}

class StadiumScreen {
  constructor(app, params) { this.app = app; this.params = params; }
  enter() {
    const app = this.app; app.use2D(false); setOutlines(app.save.settings.outlines);
    const planet = PLANET_BY_ID[this.params.planet] || PLANETS[1];
    this.home = buildUserTeam(app.save); this.away = buildPlanetTeam(planet); ensureTeamArt(this.home); ensureTeamArt(this.away);
    this.stadium = new Stadium(planet, this.home, this.away);
    this.camera = new THREE.PerspectiveCamera(50, app.vw / app.vh, 0.1, 1200);
    this.chars = [];
    const homeRoles = this.home.players.slice(0, 5), awayRoles = this.away.players.slice(5, 10);
    homeRoles.forEach((p, i) => { const c = new Character({ species: this.home.species, team: this.home, num: p.num, id: p.id, skinIndex: p.skin, hair: p.hair, hairColor: p.hairColor, gloves: p.role !== 'QB' }); c.group.position.set(-8 + i * 4, 0, 30); this.stadium.scene.add(c.group); this.chars.push(c); c.setState('set'); });
    awayRoles.forEach((p, i) => { const c = new Character({ species: this.away.species, team: this.away, num: p.num, id: p.id, skinIndex: p.skin }); c.group.position.set(-8 + i * 4, 0, 36); c.setFacing(Math.PI); this.stadium.scene.add(c.group); this.chars.push(c); c.setState('set'); });
    this.t = 0; this.orbit = +(this.params.angle || 0.6); this.dist = +(this.params.dist || 60); this.height = +(this.params.h || 22);
    app.ui.appendChild(el('div', { class: 'center-msg', html: `${planet.name.toUpperCase()}<small>${planet.stadium.name} · ${planet.stadium.size} · ${planet.stadium.surface.type}</small>` }));
    this.stadium.cheer(1);
  }
  update(dt) {
    this.t += dt; const mv = input.moveVec(); this.orbit += mv.x * dt * 1.0 + (this.params.spin ? dt * 0.15 : 0); this.dist = Math.max(10, this.dist - mv.y * dt * 30);
    if (input.down('r2')) this.height += dt * 15; if (input.down('l2')) this.height = Math.max(2, this.height - dt * 15);
    this.stadium.update(dt); this.chars.forEach(c => c.update(dt, 0));
    this.camera.position.set(Math.sin(this.orbit) * this.dist, this.height, 35 + Math.cos(this.orbit) * this.dist); this.camera.lookAt(0, 0, 35);
  }
  render() { this.app.renderer.render(this.stadium.scene, this.camera); }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  exit() { }
}
registerScreen('gallery', GalleryScreen); registerScreen('stadium', StadiumScreen);
