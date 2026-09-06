// The 3D space hub: main menu floating in the galaxy, and free-roam rocket flight with landings.
import { el, fmtCoins } from '../util.js';
import { input } from '../input.js';
import { audio } from '../audio.js';
import { Menu } from './menu.js';
import { PLANETS, PLANET_BY_ID, rangeForParts } from '../data/planets.js';

export class HubScreen {
  constructor(app, params) { this.app = app; this.params = params || {}; this.mode = 'menu'; this.wallToast = 0; }
  enter() {
    const app = this.app, sp = app.space;
    app.use2D(false); sp.mode = 'menu';
    sp.setRange(rangeForParts(app.save.story.rocketParts.length));
    sp.setTarget(app.storyTarget());
    if (!this.params.keepCam) { sp.cam.pos.set(-24, 9, 36); sp.aimCam(0, 0, 0); }
    audio.music('hub', 2);
    if (this.params.mode === 'roam') this.startRoam(this.params.fromPlanet); else this.buildMenu();
  }
  storyHint() {
    const st = this.app.save.story;
    if (st.complete) return 'Complete! Replay the finale or roam the galaxy';
    if (!st.introDone) return 'Begin: a backyard game on Maple Street';
    const p = PLANETS[Math.min(st.planet, PLANETS.length - 1)];
    return `Continue: ${p.name} · ${st.beaten.length}/${PLANETS.length - 1} teams beaten`;
  }
  buildMenu() {
    const app = this.app; this.mode = 'menu'; app.space.mode = 'menu';
    app.ui.innerHTML = '';
    const left = el('div', { class: 'hub-left' }, el('div', { class: 'logo', html: 'GRIDIRON<br>GALAXY<small>THE LONG BOMB</small>' }));
    app.ui.appendChild(left);
    const items = [
      { label: 'STORY', hint: this.storyHint(), action: () => app.startStory() },
      { label: 'FREE ROAM', hint: `Fly the rocket · ${app.save.story.rocketParts.length} parts · reach ${this.reachable()} planets`, action: () => this.startRoam() },
      { label: 'PRACTICE', hint: `Run plays on ${app.save.unlockedStadiums.length} unlocked stadium${app.save.unlockedStadiums.length === 1 ? '' : 's'}`, action: () => app.go('practice') },
      { label: 'PLAYBOOK', hint: 'Browse your plays and team', action: () => app.go('playbook') },
      { label: 'OPTIONS', hint: 'Controls, quarter length, difficulty, sound', action: () => app.go('options') },
    ];
    this.menu = new Menu(app, items, { parent: left, dpadOnly: true });
    app.ui.appendChild(el('div', { class: 'hub-controls', html: `${input.usingPad() ? input.glyphHTML('up') + input.glyphHTML('down', 'Menu') : '<span class="gly key">↑ ↓</span><span class="gl">Menu</span>'}<br>${input.usingPad() ? '<span class="gly">L</span><span class="gl">Fly around</span> <span class="gly">R</span><span class="gl">Look</span>' : '<span class="gly key">WASD</span><span class="gl">Fly around</span> <span class="gly key">DRAG</span><span class="gl">Look</span>'}${input.glyphHTML('r2', 'Boost')}` }));
    this.topbar();
  }
  reachable() { return PLANETS.filter(p => !p.isHome && this.app.space.inRange(p)).length; }
  topbar() {
    const app = this.app;
    app.ui.appendChild(el('div', { class: 'topright' }, el('span', { class: 'tag', text: `TEAM LVL ${app.save.teamLevel + 1}` }), el('span', { class: 'coins', text: fmtCoins(app.save.coins) })));
  }
  startRoam(fromPlanetId) {
    const app = this.app, sp = app.space; this.mode = 'roam'; sp.mode = 'rocket';
    if (this.menu) { this.menu.destroy(); this.menu = null; }
    app.ui.innerHTML = '';
    const from = fromPlanetId ? PLANET_BY_ID[fromPlanetId] : PLANETS[0];
    const next = app.storyTarget() && app.storyTarget().id !== from.id ? app.storyTarget() : PLANETS[(from.index + 1) % PLANETS.length];
    sp.placeAt(from, next);
    this.hud = el('div', { class: 'roam-hud' }, el('div', { class: 'panel' }, el('b', { text: 'Open Space' }), el('div', { class: 'sub', text: '' }), el('div', { class: 'row' }, el('span', { text: 'RANGE' }), el('div', { class: 'rangebar' }, el('i')), el('span', { class: 'rng', text: '' })), el('div', { class: 'row spd', text: '' })));
    app.ui.appendChild(this.hud);
    app.ui.appendChild(el('div', { class: 'hint', html: `${input.usingPad() ? '<span class="gly">L</span><span class="gl">Thrust</span> <span class="gly">R</span><span class="gl">Steer</span>' : '<span class="gly key">WASD</span><span class="gl">Thrust</span> <span class="gly key">ARROWS / DRAG</span><span class="gl">Steer</span>'}${input.glyphHTML('r2', 'Boost')}${input.glyphHTML('l2', 'Brake')}${input.glyphHTML('r1', 'Up')}${input.glyphHTML('l1', 'Down')}${input.glyphHTML('cross', 'Land')}${input.glyphHTML('circle', 'Menu')}` }));
    this.msg = el('div', { class: 'center-msg' }); app.ui.appendChild(this.msg); this.msg.style.display = 'none';
    this.topbar();
    audio.sfx('rocket');
  }
  update(dt) {
    const app = this.app, sp = app.space;
    if (this.mode === 'menu') {
      this.menu.update(input);
      sp.update(dt, input, { freeMove: true, labels: true, beaten: app.save.story.beaten });
      if (input.pressed('options')) app.go('options');
    } else {
      const near = sp.nearest(sp.ship.pos);
      const canLand = near.planet && near.dist < 10 && sp.inRange(near.planet);
      const nearId = near.planet && near.dist < 10 ? near.planet.id : null;
      sp.update(dt, input, { labels: true, nearId, landHint: canLand ? 'LAND' : 'OUT OF RANGE', beaten: app.save.story.beaten });
      // HUD
      const p = near.planet; const title = this.hud.querySelector('b'), sub = this.hud.querySelector('.sub'), bar = this.hud.querySelector('.rangebar i'), rng = this.hud.querySelector('.rng'), spd = this.hud.querySelector('.spd');
      const txt = p && near.dist < 60 ? p.name : 'Open Space';
      if (title.textContent !== txt) { title.textContent = txt; sub.textContent = p && near.dist < 60 ? `${p.district} · ${p.team.name}${app.save.story.beaten.includes(p.id) ? ' · DEFEATED' : ''}` : 'Fly toward a planet to land'; }
      const d = sp.ship.pos.length(); bar.style.width = `${Math.min(100, d / sp.range * 100).toFixed(1)}%`; rng.textContent = `${Math.round(d)} / ${Math.round(sp.range)}`;
      spd.textContent = `SPEED ${Math.round(sp.ship.speed * 10)} · ${this.reachable()} planets in range · nearest ${Math.max(0, Math.round(near.dist))}`;
      if (canLand) { this.msg.style.display = 'block'; this.msg.innerHTML = `${p.name.toUpperCase()}<small>${input.glyphHTML('cross')} LAND AT ${p.district.toUpperCase()}</small>`; }
      else if (nearId) { this.msg.style.display = 'block'; this.msg.innerHTML = `${p.name.toUpperCase()}<small>OUT OF ROCKET RANGE. WIN MORE GAMES FOR PARTS.</small>`; }
      else this.msg.style.display = 'none';
      if (sp.hitWall > 0 && this.wallToast <= 0) { app.toast('The rocket sputters. It needs more parts to go further.'); this.wallToast = 4; }
      this.wallToast -= dt;
      if (canLand && input.pressed('cross')) this.land(p);
      if (input.pressed('circle') || input.pressed('options')) { audio.sfx('back'); sp.syncCamFromCamera(); this.buildMenu(); }
    }
  }
  async land(planet) {
    input.block(600); audio.sfx('land');
    await this.app.fadeOut(600);
    this.app.go('district', { planet: planet.id, from: 'roam' });
  }
  render() { this.app.space.render(this.app.renderer); }
  exit() { if (this.menu) this.menu.destroy(); this.app.space.hideLabels(); }
}
