// Free mode: your own ofrenda in a quiet room, with every item available.
import * as THREE from 'three';
import { Scene } from './base.js';
import { toon, PAL, sphere, cyl, glowSprite } from '../toon.js';
import { wall, floor, beams, rug, table, plant, armchair } from '../room.js';
import { papelString, petalPath } from '../world.js';
import { PROP_INFO } from '../props.js';
import { OfrendaBuilder, wishesHtml, LEVEL_INFO } from '../games/ofrenda.js';
import { t, UI as S } from '../i18n.js';
import { icon } from '../icons.js';

const FREE_ITEMS = ['foto', 'cempasuchil', 'terciopelo', 'nube', 'vela', 'cirio', 'copal', 'agua', 'jarrito', 'sal', 'pan', 'calavera', 'fruta', 'cana',
  'mole', 'tamales', 'chocolate', 'cafe', 'atole', 'calabaza', 'pizza', 'refresco', 'galletas', 'plato', 'balon', 'radio', 'guitarra', 'gorra', 'domino',
  'lentes', 'libro', 'juguetes', 'xolo', 'cruz', 'catrina', 'alebrije', 'mariposa', 'papel', 'arco', 'petate', 'lavamanos'];

async function canvasFrom(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  cv.getContext('2d').drawImage(img, 0, 0);
  return cv;
}

export class FreeScene extends Scene {
  dayLabel() { return { en: 'Your ofrenda', es: 'Tu ofrenda' }; }

  async build() {
    await super.build();
    this.setLights('evening', { scenery: false, shadowBox: 8 });
    this.hemi.intensity = 0.6;
    this.sun.intensity = 0.5;
    const s = this.scene;
    const room = new THREE.Group();
    room.add(floor(9, 7, '#a9573a', '#9a4c32'));
    const back = wall(9, 3.4, [{ x: -2.8, y: 1.0, w: 1.3, h: 1.2 }], '#d9c2f0', { band: PAL.purple });
    back.position.set(0, 0, -3.5);
    room.add(back);
    for (const sx of [-1, 1]) {
      const w = wall(7, 3.4, [], '#d9c2f0', { band: PAL.purple });
      w.position.set(sx * 4.5, 0, 0);
      w.rotation.y = -sx * Math.PI / 2;
      room.add(w);
    }
    room.add(beams(9, 7, 3.4, 5));
    const rg = rug(3, 2);
    rg.position.set(0, 0, 0.4);
    room.add(rg);
    s.add(room);
    this.merge(room);
    const ch = armchair({ color: PAL.turquoise });
    ch.position.set(2.6, 0, -1.6);
    ch.rotation.y = -0.6;
    s.add(ch);
    const pl = plant({ big: 1.2, seed: 3 });
    pl.position.set(-3.8, 0, -2.6);
    s.add(pl);
    const tb = table({ w: 1.8, d: 0.8 });
    tb.position.set(0, 0, -3.0);
    s.add(tb);
    this.ofrendaTable = tb;
    const lamp = new THREE.PointLight('#ffd9a8', 6, 10, 1.5);
    lamp.position.set(0, 2.9, 0.5);
    s.add(lamp);
    this.lamp = lamp;
    const bulb = sphere(0.1, toon('#fff3dc', { emissive: '#ffd27a' }), 12);
    bulb.position.set(0, 2.95, 0.5);
    s.add(bulb);
    const gl = glowSprite('#ffd9a0', 1.4, 0.5);
    gl.position.copy(bulb.position);
    s.add(gl);
    const cord = cyl(0.01, 0.01, 0.4, toon('#333'), 4);
    cord.position.set(0, 3.2, 0.5);
    s.add(cord);
    for (let k = 0; k < 2; k++) {
      const st = papelString([-4.4, 2.95, -2 + k * 1.8], [4.4, 2.95, -1.6 + k * 1.8], { seed: 50 + k, sheetW: 0.34, sag: 0.3 });
      st.userData.dynamic = true;
      this.animateTree(st);
      s.add(st);
    }
    this.addChar('chispa', 1.4, 0.8, -0.5).play('lie');
    this.defineView('main', [0, 1.6, 1.6], [0, 0.95, -3.0], 52);
  }

  async enter(opts) {
    const g = this.game;
    g.sound.music('ofrenda');
    this.honoree = opts.honoree || (g.state.free[0] ? null : null);
    const hon = this.honoree || { kind: 'familia', name: t({ en: 'Someone special', es: 'Alguien especial' }), portrait: null };
    this.portraitCv = hon.portrait ? await canvasFrom(hon.portrait) : null;
    this.builder = new OfrendaBuilder(this, { base: this.ofrendaTable, baseY: 0.78, mode: 'free', portrait: this.portraitCv, wishes: [] });
    this.builder.multi = { vela: 6, cirio: 3, cempasuchil: 4, fruta: 2 };
    this.builder.onChange = () => this.tray();
    const levels = await this.say([{
      who: null, text: { en: 'How many levels would you like? (There\'s no wrong answer.)', es: '¿Cuántos niveles quieres? (No hay respuesta equivocada.)' },
      choices: [1, 2, 3, 7].map((n) => ({ label: { en: `${n}`, es: `${n}` }, value: n })),
    }]);
    this.builder.setLevels(levels);
    await this.say([{ who: null, text: LEVEL_INFO[levels] }]);
    if (hon.kind === 'mascota' && !g.knows('mascotas')) await g.learn('mascotas');
    if (!g.knows('favoritos')) await g.learn('favoritos');
    this.tray();
  }

  async tray() {
    const g = this.game;
    const b = this.builder;
    const items = [];
    for (const id of FREE_ITEMS) {
      const max = b.multi?.[id] || 1;
      const left = max - (b.counts[id] || 0);
      const img = id === 'foto' && this.portraitCv ? this.portraitCv.toDataURL() : await g.itemImage(id);
      items.push({ id, label: { en: PROP_INFO[id].en, es: PROP_INFO[id].es }, img, used: left <= 0, count: left });
    }
    const side = document.createElement('div');
    side.innerHTML = `<button type="button" class="btn rosa small" data-a="light">${icon('candle')} ${t({ en: 'Light it', es: 'Encender' })}</button>
      <button type="button" class="btn turq small" data-a="photo">${icon('camera')} ${t(S.photo)}</button>
      <button type="button" class="btn cream small" data-a="exit">${icon('home')} ${t(S.quitTitle)}</button>`;
    side.querySelector('[data-a=light]').onclick = () => this.lightAll();
    side.querySelector('[data-a=photo]').onclick = () => this.photo();
    side.querySelector('[data-a=exit]').onclick = () => g.go('title');
    g.ui.showTray({ label: { en: 'Your ofrenda', es: 'Tu ofrenda' }, items, side, active: b.holding?.id, onPick: (id) => {
      if (b.pick(id)) g.ui.setTrayActive(b.holding ? id : null);
    } });
    g.ui.sidePanel(wishesHtml(b, 'free'));
  }

  lightAll() {
    const g = this.game;
    let n = 0;
    for (const r of this.builder.placed) {
      if (r.obj.userData.light && !r.obj.userData.lit) { r.obj.userData.light(true); n++; }
    }
    if (!this.lit) {
      this.animateTree(this.builder.root);
      this.lit = true;
      const cl = new THREE.PointLight('#ffb35c', 0, 5, 1.4);
      cl.position.set(0, 1.5, -2.3);
      this.scene.add(cl);
      this.engine.tween(1.5, (k) => { cl.intensity = 6 * k; this.lamp.intensity = 6 * (1 - k * 0.6); });
      const path = petalPath([[3.5, 2.5], [2.2, 1.0], [1.0, -0.6], [0.2, -2.3]], { width: 0.4, density: 70, seed: 8 });
      this.scene.add(path);
    }
    g.sfx(n ? 'strike' : 'chime');
  }

  photo() {
    const g = this.game;
    g.ui.hideTray();
    requestAnimationFrame(() => {
      const url = this.engine.snapshot();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mi-ofrenda.png';
      a.click();
      g.sfx('chime');
      g.ui.toast(t(S.saved), { ico: 'camera' });
      this.tray();
    });
  }

  onPointerMove() { if (this.builder && !this.builder.locked) this.builder.hover(); }

  onTap() {
    const b = this.builder;
    if (b && b.holding) {
      b.hover();
      if (b.place()) { this.game.ui.setTrayActive(null); return true; }
    }
    return false;
  }

  goalOverride() { return { en: 'Build it your way — click a thing, then click the ofrenda', es: 'Ponla a tu manera: elige algo y haz clic en la ofrenda' }; }

  onLang() { this.tray(); }
}
