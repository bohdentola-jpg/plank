// Title screen: a golden-hour street in Santa María del Lago, papel picado
// fluttering, marigold petals drifting, Lupita and Chispa saying hello.
import * as THREE from 'three';
import { Scene } from './base.js';
import { street, potRow } from './town.js';
import { monarch } from '../props.js';
import { toon, rng } from '../toon.js';
import { t, UI as S, getLang } from '../i18n.js';
import { icon, hydrateIcons } from '../icons.js';

export class TitleScene extends Scene {
  async build() {
    await super.build();
    this.setLights('golden', { shadowBox: 18 });
    this.addHills({ color: '#86b06a', far: '#a9b7d8' });
    const st = street({ length: 46, seed: 5 });
    for (const s of st.strings) { s.userData.dynamic = true; this.animateTree(s); }
    this.scene.add(st.group);
    this.scene.add(potRow(-4.2, 3.5, -4.2, -2, 4, 3));
    this.scene.add(potRow(4.2, 2.5, 4.2, -3, 4, 8));
    this.merge(st.group);

    const lupita = this.addChar('lupita', -1.55, 3.1, 0.45);
    const chispa = this.addChar('chispa', -0.85, 3.6, 0.2);
    lupita.emote('happy');
    chispa.play('sit');
    this.lupita = lupita;

    this.petals();
    // a few monarchs drifting down the street (just for beauty here)
    for (let i = 0; i < 4; i++) {
      const b = monarch({ scale: 2.2 });
      const p0 = new THREE.Vector3(-3 + i * 2, 2 + i * 0.4, -2 - i * 3);
      this.scene.add(b);
      this.updaters.push((dt, time) => {
        b.userData.update(time);
        const k = time * 0.25 + i * 1.7;
        b.position.set(p0.x + Math.sin(k) * 2.5, p0.y + Math.sin(k * 2.3) * 0.5, p0.z + Math.cos(k * 0.8) * 3);
        b.rotation.y = -k + Math.PI / 2;
      });
    }
    this.defineView('main', [0.9, 1.45, 8.2], [-0.2, 1.75, -6], 44);
  }

  petals() {
    const n = 140;
    const geo = new THREE.CircleGeometry(0.035, 5);
    const im = new THREE.InstancedMesh(geo, toon('#ffffff', { rim: 0, side: THREE.DoubleSide }), n);
    const r = rng(9);
    const cols = ['#ff9a0d', '#ffb21a', '#ff7f11', '#ffc93c', '#f26b1d', '#e4007c'];
    const P = [];
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      P.push({ x: (r() - 0.5) * 9, y: r() * 6, z: 4 - r() * 16, s: 0.4 + r() * 0.5, ph: r() * 6, spin: r() * 3 });
      im.setColorAt(i, col.set(cols[i % cols.length]));
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.updaters.push((dt, time) => {
      for (let i = 0; i < n; i++) {
        const p = P[i];
        p.y -= dt * (0.25 + p.s * 0.2);
        if (p.y < 0) { p.y = 6; p.x = (r() - 0.5) * 9; }
        e.set(time * p.spin + p.ph, time * p.spin * 0.7, 0);
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(p.x + Math.sin(time + p.ph) * 0.4, p.y, p.z), q, new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    });
    im.raycast = () => {};
    this.scene.add(im);
  }

  async enter() {
    this.game.sound.music('title');
    this.game.sound.setAmbient('birds');
    this.renderMenu();
    this.waveT = 1;
  }

  update(dt, time) {
    super.update(dt, time);
    this.waveT -= dt;
    if (this.waveT < 0) {
      this.lupita.play('wave', { restart: true, dur: 1.6 });
      this.waveT = 7 + Math.random() * 3;
    }
  }

  renderMenu() {
    const g = this.game;
    const el = g.ui.el.title;
    const started = g.state.started && g.has('intro');
    const es = getLang() === 'es';
    el.innerHTML = `
      <button type="button" class="btn cream small lang" data-a="lang">${icon('globe')} ${t(S.language)}</button>
      <div class="logo">
        <div class="crest">${icon('marigold')}</div>
        <div class="ribbon"><h1>${es ? 'El Camino de Cempasúchil' : 'The Marigold Path'}</h1>
          <div class="sub">${es ? 'Una aventura de Día de Muertos' : 'A Día de Muertos Adventure'}</div></div>
      </div>
      <div class="tmenu">
        <button type="button" class="btn rosa" data-a="play">${icon('play')} ${started ? t(S.continue) : t(S.play)}</button>
        ${started ? `<button type="button" class="btn cream small" data-a="new">${t(S.newGame)}</button>` : ''}
        <div class="row">
          <button type="button" class="btn turq" data-a="free">${icon('heart')} ${t(S.freeMode)}</button>
          <button type="button" class="btn purple" data-a="loteria">${icon('cards')} ${t(S.loteria)}</button>
        </div>
        <div class="row">
          <button type="button" class="btn cream" data-a="book">${icon('book')} ${t(S.book)}</button>
          <button type="button" class="btn cream" data-a="about">${icon('info')} ${t(S.credits)}</button>
        </div>
        <div class="tfoot">${t({ en: 'Santa María del Lago is a made-up town inspired by the lake region of Michoacán, Mexico. Every family and region celebrates in its own way.', es: 'Santa María del Lago es un pueblo inventado, inspirado en la región del lago en Michoacán. Cada familia y cada región lo celebra a su manera.' })}</div>
      </div>`;
    el.classList.remove('hidden');
    hydrateIcons(el);
    const on = (a, fn) => { const b = el.querySelector(`[data-a=${a}]`); if (b) b.onclick = () => { g.sfx('tap'); fn(); }; };
    on('lang', () => { g.toggleLang(); this.renderMenu(); });
    on('play', () => this.start());
    on('new', () => { if (window.confirm(t(S.resetConfirm))) { g.reset(false); this.start(); } });
    on('free', () => g.startFree());
    on('loteria', () => g.openLoteria());
    on('book', () => g.openBook());
    on('about', () => g.openAbout());
  }

  start() {
    const g = this.game;
    g.sound.ensure();
    const scene = g.state.started && g.has('intro') ? (g.state.scene || 'home') : 'home';
    g.go(scene === 'title' ? 'home' : scene, { dayCard: g.has('intro') ? null : { title: { en: 'October 31', es: '31 de octubre' }, sub: { en: 'Santa María del Lago, Michoacán', es: 'Santa María del Lago, Michoacán' } } });
  }

  onLang() { this.renderMenu(); }

  exit() {
    super.exit();
    this.game.ui.el.title.classList.add('hidden');
    this.game.ui.el.title.innerHTML = '';
  }
}
