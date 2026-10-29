// Lupita's house. Morning of Oct 31: meet the family and get Abuela's list.
// Evening: build Abuelo's ofrenda. November 2: share the food and remember.
import * as THREE from 'three';
import { Scene } from './base.js';
import { toon, box, mesh, PAL, sphere, cyl, glowSprite } from '../toon.js';
import { wall, floor, beams, rug, table, sofa, armchair, trastero, plant, wallFrame, calendarProp, guitarCase, radioProp, smallTable, doormat } from '../room.js';
import { house, papelString, petalPath } from '../world.js';
import { makeProp, monarch } from '../props.js';
import { papelCanvases } from '../games/papel.js';
import { OfrendaBuilder, wishesHtml, LEVEL_INFO } from '../games/ofrenda.js';
import { HOME_ITEMS, HOME_ITEM_TEXT } from '../content/items.js';
import { t, UI as S } from '../i18n.js';
import { icon } from '../icons.js';
import { CARDS } from '../content/cards.js';

const DOOR = new THREE.Vector3(5.2, 0, -0.5);

export class HomeScene extends Scene {
  phase() {
    const f = this.game.state.flags;
    if (!f.intro) return 'intro';
    if (!f.ofrenda) return this.readyForOfrenda() ? 'build' : 'explore';
    if (f.panteon && !f.ending) return 'ending';
    if (f.ending) return 'after';
    return 'done';
  }

  readyForOfrenda() {
    const g = this.game;
    const f = g.state.flags;
    const market = ['cempasuchil', 'velas', 'copal', 'fruta'].every((i) => g.hasItem(i));
    return market && f.pan && f.papel && f.skull;
  }

  dayLabel() {
    const p = this.phase();
    if (p === 'intro' || p === 'explore') return { en: 'October 31 · morning', es: '31 de octubre · mañana' };
    if (p === 'build') return { en: 'October 31 · evening', es: '31 de octubre · tarde' };
    if (p === 'done') return { en: 'October 31 · night', es: '31 de octubre · noche' };
    return { en: 'November 2 · morning', es: '2 de noviembre · mañana' };
  }

  async build() {
    await super.build();
    const ph = this.ph = this.phase();
    const night = ph === 'build' || ph === 'done';
    this.night = night;
    const L = this.setLights(night ? 'evening' : 'interior', { sky: true, scenery: false, shadowBox: 9 });
    this.sun.position.set(-14, night ? 4 : 10, 2);
    this.sun.target.position.set(0, 0, -1);
    if (night) {
      L.hemi.intensity = 0.55;
      this.sun.intensity = 0.4;
    }
    this.buildRoom();
    this.buildOutside();
    this.buildFurniture();
    this.buildCharacters();
    this.defineView('main', [0, 1.8, 6.5], [0, 1.15, -1.4], 46);
    this.defineView('ofrenda', [0, 1.6, 0.7], [0, 0.98, -3.4], 50);
    this.defineView('door', [1.2, 1.6, 2.4], [4.6, 0.6, -1.2], 50);
    this.hideMonarch('plant', 4.6, 1.5, -2.6);
    this.hideMonarch('trastero', 3.9, 2.15, -3.6);
  }

  // ---------------------------------------------------------------- room
  buildRoom() {
    const s = this.scene;
    const W = 11, D = 8, H = 3.6;
    const room = new THREE.Group();
    room.add(floor(W, D, '#c8643b', '#b85532'));
    const back = wall(W, H, [{ x: -3.4, y: 0, w: 1.3, h: 2.35 }], '#f6c6a5', { band: '#1d9c96' });
    back.position.set(0, 0, -D / 2);
    room.add(back);
    const left = wall(D, H, [{ x: -0.6, y: 0.95, w: 1.6, h: 1.35 }], '#f6c6a5', { band: '#1d9c96' });
    left.position.set(-W / 2, 0, 0);
    left.rotation.y = Math.PI / 2;
    room.add(left);
    const right = wall(D, H, [{ x: 0.5, y: 0, w: 1.15, h: 2.3 }], '#f6c6a5', { band: '#1d9c96' });
    right.position.set(W / 2, 0, 0);
    right.rotation.y = -Math.PI / 2;
    room.add(right);
    room.add(beams(W, D, H, 7));
    // window frame + shutters
    const wf = new THREE.Group();
    const trim = toon('#2f6f8f', { rim: 0 });
    for (const [w, h, x, y] of [[1.8, 0.1, 0, 2.33], [1.8, 0.12, 0, 0.92], [0.1, 1.45, -0.85, 1.62], [0.1, 1.45, 0.85, 1.62], [0.06, 1.35, 0, 1.62]]) {
      const b = box(w, h, 0.08, trim);
      b.position.set(x, y, 0.05);
      wf.add(b);
    }
    const sill = box(1.9, 0.07, 0.3, toon('#f3e3c5', { rim: 0 }));
    sill.position.set(0, 0.9, 0.12);
    wf.add(sill);
    const pot = makeProp('cempasuchil');
    pot.scale.setScalar(1.1);
    pot.position.set(0.55, 0.94, 0.12);
    wf.add(pot);
    wf.position.set(-W / 2 + 0.01, 0, -0.6);
    wf.rotation.y = Math.PI / 2;
    room.add(wf);
    // front door (open a crack in the evening for the petals)
    const door = box(1.1, 2.25, 0.08, toon('#ffffff', { map: null, rim: 0 }));
    door.material = toon('#6e4127', { rim: 0 });
    door.position.set(W / 2 - 0.08, 1.125, -0.5 + 0.55);
    door.rotation.y = -Math.PI / 2 + (this.night ? 0.9 : 0);
    door.geometry.translate(0, 0, 0);
    this.doorMesh = door;
    room.add(door);
    const knob = sphere(0.05, toon(PAL.gold), 8);
    knob.position.set(W / 2 - 0.15, 1.05, -0.5 - 0.3);
    room.add(knob);
    const mat = doormat();
    mat.position.set(W / 2 - 0.75, 0, -0.5);
    mat.rotation.y = Math.PI / 2;
    room.add(mat);
    // kitchen glimpse through the back doorway
    const kitchen = new THREE.Group();
    const kf = floor(2.6, 2.2, '#d9b38c', '#cfa77e');
    kf.position.set(-3.4, 0.001, -5.1);
    kitchen.add(kf);
    const kback = box(2.8, H, 0.1, toon('#ffe2a8', { rim: 0 }));
    kback.position.set(-3.4, H / 2, -6.2);
    kitchen.add(kback);
    for (const sx of [-1, 1]) {
      const kw = box(0.1, H, 2.3, toon('#ffe2a8', { rim: 0 }));
      kw.position.set(-3.4 + sx * 1.35, H / 2, -5.1);
      kitchen.add(kw);
    }
    const stove = box(1.4, 0.85, 0.6, toon('#e9d8c0', { rim: 0 }));
    stove.position.set(-3.4, 0.425, -5.8);
    kitchen.add(stove);
    const comal = cyl(0.3, 0.3, 0.03, toon('#3a3030'), 18);
    comal.position.set(-3.6, 0.88, -5.75);
    kitchen.add(comal);
    const olla = sphere(0.22, toon('#b4673c'), 14);
    olla.scale.y = 0.85;
    olla.position.set(-3.0, 1.05, -5.75);
    kitchen.add(olla);
    for (let i = 0; i < 4; i++) {
      const p = sphere(0.09, toon(['#b4673c', PAL.terracotta, '#9a4a2a', '#c9814d'][i]), 10);
      p.position.set(-4.0 + i * 0.4, 1.9, -6.05);
      kitchen.add(p);
    }
    const kl = new THREE.PointLight('#ffd7a0', this.night ? 6 : 3, 5);
    kl.position.set(-3.4, 2.6, -5.2);
    kitchen.add(kl);
    room.add(kitchen);
    s.add(room);
    this.room = room;
    // warm ceiling lamp
    const lampLight = new THREE.PointLight('#ffd9a8', this.night ? 9 : 3, 12, 1.5);
    lampLight.position.set(0, 3.1, 0);
    s.add(lampLight);
    this.lampLight = lampLight;
    // a hanging tin lamp
    const shade = mesh(new THREE.ConeGeometry(0.34, 0.26, 16, 1, true), toon('#c9902e', { side: THREE.DoubleSide }));
    shade.position.set(0, 3.12, 0);
    s.add(shade);
    const bulb = sphere(0.09, toon('#fff3dc', { emissive: '#ffd27a', emissiveIntensity: this.night ? 1 : 0.4 }), 12);
    bulb.position.set(0, 3.0, 0);
    s.add(bulb);
    const bglow = glowSprite('#ffd9a0', this.night ? 1.6 : 0.8, this.night ? 0.6 : 0.25);
    bglow.position.set(0, 3.0, 0);
    s.add(bglow);
    const cord = cyl(0.012, 0.012, 0.4, toon('#333'), 4);
    cord.position.set(0, 3.42, 0);
    s.add(cord);
    // papel picado across the ceiling once it's been made
    if (this.game.state.flags.papel) {
      // the papel picado you cut at Tía Lucía's, plus some of hers
      const mine = papelCanvases(this.game.state.papel, 96);
      for (let k = 0; k < 3; k++) {
        const st = papelString([-5.2, 3.1, -2.6 + k * 1.6], [5.2, 3.1, -2.2 + k * 1.6], { seed: 3 + k, sheetW: 0.36, sag: 0.32, customs: k === 1 ? mine : null });
        st.userData.dynamic = true;
        s.add(st);
        this.animateTree(st);
      }
    }
  }

  buildOutside() {
    // the street outside the window and the door
    const out = new THREE.Group();
    const ground = mesh(new THREE.PlaneGeometry(30, 30), toon('#c9b49a', { rim: 0 }), { cast: false, receive: true });
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-14, -0.02, 0);
    out.add(ground);
    const cols = [[PAL.yellowWall, '#c4562e'], [PAL.blueWall, '#2f5f9e'], [PAL.pinkWall, '#b84a7c']];
    cols.forEach(([c, b], i) => {
      const h = house({ w: 4, h: 3.6, d: 3, color: c, band: b, seed: 40 + i, roof: i === 1 ? 'tile' : 'flat', bugambilia: i === 0 });
      h.position.set(-11.5, 0, -4.5 + i * 4.2);
      h.rotation.y = Math.PI / 2;
      out.add(h);
    });
    const ground2 = mesh(new THREE.PlaneGeometry(14, 20), toon('#c9b49a', { rim: 0 }), { cast: false, receive: true });
    ground2.rotation.x = -Math.PI / 2;
    ground2.position.set(12, -0.02, 0);
    out.add(ground2);
    const across = house({ w: 5, h: 3.4, d: 3, color: PAL.greenWall, band: '#3b7a4a', seed: 51 });
    across.position.set(11, 0, -0.5);
    across.rotation.y = -Math.PI / 2;
    out.add(across);
    this.scene.add(out);
    this.merge(out);
  }

  buildFurniture() {
    const s = this.scene;
    const f = new THREE.Group();
    const rg = rug(3.4, 2.3);
    rg.position.set(-0.3, 0, 0.6);
    f.add(rg);
    const so = sofa({ color: PAL.turquoise });
    so.position.set(-4.75, 0, 1.6);
    so.rotation.y = Math.PI / 2;
    f.add(so);
    const tr = trastero();
    tr.position.set(3.9, 0, -3.72);
    f.add(tr);
    const st = smallTable({});
    st.position.set(-4.9, 0, -0.6);
    f.add(st);
    s.add(f);
    this.merge(f);

    // the ofrenda table (empty until the evening)
    const tb = table({ w: 1.8, d: 0.8 });
    tb.position.set(0, 0, -3.42);
    s.add(tb);
    this.ofrendaTable = tb;

    const chair = armchair({ color: PAL.rosa });
    chair.position.set(2.45, 0, -2.35);
    chair.rotation.y = -0.65;
    s.add(chair);
    this.chair = chair;

    const radio = radioProp();
    radio.position.set(-4.9, 0.58, -0.6);
    radio.rotation.y = Math.PI / 2;
    s.add(radio);
    this.radio = radio;

    const gc = guitarCase();
    gc.position.set(2.85, 0, -3.75);
    s.add(gc);
    this.guitar = gc;

    const cal = calendarProp();
    cal.position.set(-2.05, 1.65, -3.97);
    s.add(cal);
    this.calendar = cal;

    const pl = plant({ big: 1.3, seed: 4 });
    pl.position.set(4.7, 0, -2.6);
    s.add(pl);
    this.plantObj = pl;
    const pl2 = plant({ big: 1.1, seed: 9 });
    pl2.position.set(-4.85, 0, -2.9);
    s.add(pl2);

    // family photos on the back wall (painted portraits of the living)
    this.photos = new THREE.Group();
    s.add(this.photos);
    this.abueloWall = null;
    const g = this.game;
    g.portraitCanvas('abuelo').then((cv) => {
      this.abueloCanvas = cv;
      const ph = this.phase();
      if (ph === 'intro' || ph === 'explore') {
        const fr = wallFrame(cv, 0.42, 0.54, '#7a4a2a');
        fr.position.set(1.35, 1.95, -3.97);
        this.scene.add(fr);
        this.abueloWall = fr;
        this.hot(fr, { en: 'Abuelo Beto\'s photo', es: 'La foto del Abuelo Beto' }, () => this.talkPhoto());
      }
    });
    Promise.all([g.portraitCanvas('mama'), g.portraitCanvas('papa'), g.portraitCanvas('lupita')]).then(([a, b, c]) => {
      [[a, 2.0, 2.2], [b, 2.48, 2.2], [c, 2.24, 1.62]].forEach(([cv, x, y]) => {
        const fr = wallFrame(cv, 0.3, 0.38, '#a06a3b');
        fr.position.set(x, y, -3.97);
        this.photos.add(fr);
      });
    });
  }

  buildCharacters() {
    const ph = this.ph;
    const lu = this.addChar('lupita', 0.55, 1.05, 0.15);
    const ch = this.addChar('chispa', 1.45, 1.35, -0.4);
    ch.play('sit');
    if (ph === 'ending' || ph === 'after') {
      this.addChar('abuela', -0.9, -1.2, 0.35);
      this.addChar('mama', -1.9, -1.6, 0.5);
      this.addChar('papa', 1.8, -1.5, -0.5);
      this.addChar('nico', -0.6, 1.4, 0.3);
    } else if (ph === 'build' || ph === 'done') {
      this.addChar('abuela', 2.3, -2.05, -0.65);
      this.addChar('mama', -1.9, -1.9, 0.4);
      this.addChar('papa', -2.7, -1.2, 0.7);
      this.addChar('nico', -0.9, 0.6, 0.3).play('sit');
    } else {
      const ab = this.addChar('abuela', 2.42, -2.1, -0.62);
      ab.play('sit');
      ab.root.position.y = 0.06;
      this.addChar('nico', -0.9, 0.55, 0.4).play('sit');
      this.addChar('mama', -3.4, -4.75, 0.15);
    }
    lu.look(new THREE.Vector3(0, 1.6, 7));
  }

  // ---------------------------------------------------------------- flow
  async enter() {
    const g = this.game;
    const ph = this.ph;
    g.sound.music(ph === 'build' || ph === 'done' ? 'ofrenda' : 'home');
    g.sound.setAmbient(this.night ? null : 'birds');
    this.setupHotspots();
    if (ph === 'build' && this.game.state.ofrenda) {
      // returning mid-build: rebuild what was there
    }
    if (ph === 'done' || ph === 'after' || ph === 'ending') this.showFinishedOfrenda();
  }

  async afterEnter() {
    const ph = this.ph;
    if (ph === 'intro') await this.intro();
    else if (ph === 'build') await this.startBuild();
    else if (ph === 'ending') await this.ending();
    else if (ph === 'explore' && !this.game.has('homeHint')) {
      this.game.flag('homeHint');
      await this.say([{ who: 'lupita', text: { en: 'Click things in the house to learn about them — look for the sparkles! When you\'re ready, open the **Map**.', es: 'Haz clic en las cosas de la casa para aprender. ¡Busca los destellos! Cuando quieras, abre el **Mapa**.' } }]);
    }
  }

  setupHotspots() {
    const g = this.game;
    const ph = this.ph;
    this.talkable('lupita', { en: 'Lupita', es: 'Lupita' }, () => this.talkLupita());
    this.talkable('chispa', { en: 'Chispa the Xolo', es: 'Chispa, la Xolo' }, () => this.talkChispa());
    if (this.chars.abuela) this.talkable('abuela', { en: 'Abuela Rosa', es: 'Abuela Rosa' }, () => this.talkAbuela());
    if (this.chars.nico) this.talkable('nico', { en: 'Nico', es: 'Nico' }, () => this.talkNico());
    if (this.chars.mama) this.talkable('mama', { en: 'Mamá', es: 'Mamá' }, () => this.talkMama());
    if (this.chars.papa) this.talkable('papa', { en: 'Papá', es: 'Papá' }, () => this.talkPapa());
    this.hot(this.calendar, { en: 'The calendar', es: 'El calendario' }, async () => {
      await this.say([{ who: 'lupita', text: { en: 'Look — November 1 and 2 are circled in orange!', es: '¡Mira! El 1 y el 2 de noviembre están marcados en naranja.' } }]);
      await g.learn('fechas', { force: true });
    });
    this.hot(this.guitar, { en: 'Abuelo\'s guitar', es: 'La guitarra del Abuelo' }, async () => {
      await this.say([
        { who: 'abuela', text: { en: 'Your Abuelo played that guitar every Sunday. Badly! But with so much love.', es: 'Tu abuelo tocaba esa guitarra cada domingo. ¡Muy mal! Pero con mucho cariño.' }, emote: 'laugh' },
        { who: 'lupita', text: { en: 'We\'ll put it on the ofrenda, so he knows it\'s still here for him.', es: 'La vamos a poner en la ofrenda, para que sepa que sigue aquí para él.' } },
      ]);
      await g.learn('personales', { force: true });
    }, { enabled: () => ph !== 'build' });
    this.hot(this.radio, { en: 'The old radio', es: 'El radio viejo' }, async () => {
      g.sound.music('ofrenda', true);
      await this.say([{ who: 'lupita', text: { en: 'This was Abuelo\'s radio. Abuela says he sang along to every song — even the ones he didn\'t know!', es: 'Este era el radio del Abuelo. Abuela dice que cantaba todas las canciones, ¡hasta las que no se sabía!' }, emote: 'laugh' }]);
      g.sound.music(this.night ? 'ofrenda' : 'home', true);
    });
    this.hot(this.ofrendaTable, { en: 'The ofrenda table', es: 'La mesa de la ofrenda' }, async () => {
      if (ph === 'intro' || ph === 'explore') {
        await this.say([{ who: 'lupita', text: { en: 'Tonight this table becomes Abuelo\'s [[ofrenda]]! First we need everything on Abuela\'s list.', es: '¡Esta noche, esta mesa será la [[ofrenda]] del Abuelo! Primero necesitamos todo lo de la lista de Abuela.' } }]);
        await g.learn('ofrenda', { force: true });
      } else if (ph === 'done' || ph === 'after' || ph === 'ending') {
        await this.view('ofrenda');
        this.offerPhoto();
      }
    }, { enabled: () => ph !== 'build' });
    // the window: monarchs arriving over the lake
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.35), new THREE.MeshBasicMaterial({ visible: false }));
    win.position.set(-5.45, 1.62, -0.6);
    win.rotation.y = Math.PI / 2;
    this.scene.add(win);
    this.hot(win, { en: 'The window', es: 'La ventana' }, async () => {
      this.flyMonarchsPast();
      await this.say([{ who: 'lupita', text: { en: 'Look outside! The [[mariposa monarca]] butterflies are arriving in Michoacán, like every year at this time.', es: '¡Mira afuera! Las [[mariposas monarca|mariposa monarca]] están llegando a Michoacán, como cada año en estas fechas.' } }]);
      await g.learn('monarca', { force: true });
    }, { sparkle: true });
    // the door → out to the map
    const doorPick = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.3), new THREE.MeshBasicMaterial({ visible: false }));
    doorPick.position.set(5.42, 1.15, -0.5);
    doorPick.rotation.y = -Math.PI / 2;
    this.scene.add(doorPick);
    this.hot(doorPick, { en: 'Go outside (Map)', es: 'Salir (Mapa)' }, () => {
      if (!g.has('intro')) return this.say([{ who: 'lupita', text: { en: 'Wait! Come say hi to my Abuela first.', es: '¡Espera! Primero ven a saludar a mi Abuela.' } }]);
      g.openMap();
    }, { enabled: () => ph !== 'build' });
    this.hot(this.chair, { en: 'Abuela\'s armchair', es: 'El sillón de Abuela' }, () => this.say([{ who: 'lupita', text: { en: 'That was Abuelo\'s favorite chair too. Abuela put her crochet doily on it.', es: 'Ese también era el sillón favorito del Abuelo. Abuela le puso su carpetita tejida.' } }]), { enabled: () => ph === 'build' || ph === 'done', sparkle: false });
    // kitchen
    const kpick = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.35), new THREE.MeshBasicMaterial({ visible: false }));
    kpick.position.set(-3.4, 1.17, -3.98);
    this.scene.add(kpick);
    this.hot(kpick, { en: 'The kitchen', es: 'La cocina' }, () => this.talkMama(), { enabled: () => ph === 'intro' || ph === 'explore' });
  }

  async intro() {
    const g = this.game;
    const lu = this.chars.lupita;
    await g.engine.wait(0.6);
    lu.play('wave', { restart: true, dur: 2 });
    this.chars.chispa.play('jump', { restart: true, then: 'happy' });
    g.sfx('bark');
    await this.say([
      { who: 'lupita', emote: 'happy', text: { en: '¡Hola! I\'m Lupita, and this is my dog Chispa. She\'s a [[Xoloitzcuintle]] — a Xolo for short!', es: '¡Hola! Soy Lupita y ella es mi perrita Chispa. Es una [[Xoloitzcuintle]]… ¡Xolo, para los cuates!' } },
      { who: 'chispa', text: { en: 'Woof! Woof!', es: '¡Guau! ¡Guau!' }, do: () => this.game.sfx('bark') },
      { who: 'lupita', text: { en: 'Today is October 31st. In my family — and in lots of families in Mexico — the next days are [[Día de Muertos]], the Day of the Dead.', es: 'Hoy es 31 de octubre. En mi familia —y en muchas familias de México— los próximos días son [[Día de Muertos]].' } },
      {
        who: 'lupita', text: { en: 'Do you know what it is?', es: '¿Sabes qué es?' },
        choices: [
          { label: { en: 'Is it like Halloween?', es: '¿Es como Halloween?' }, value: 'hw' },
          { label: { en: 'Tell me!', es: '¡Cuéntame!' }, value: 'tell' },
          { label: { en: 'Yes, my family celebrates too!', es: '¡Sí, mi familia también lo celebra!' }, value: 'yes' },
        ],
        then: (v) => {
          if (v === 'hw') return [{ who: 'lupita', text: { en: 'A lot of people think so, but no! It\'s not about being scary. It\'s when we remember people we love who have died — and welcome them home.', es: 'Mucha gente lo piensa, ¡pero no! No es para asustar. Es cuando recordamos a las personas que queremos y que ya murieron, y las recibimos en casa.' } }];
          if (v === 'yes') return [{ who: 'lupita', emote: 'happy', text: { en: '¡Qué padre! Then you know every family does it a little differently. Let me show you how mine does it!', es: '¡Qué padre! Entonces sabes que cada familia lo hace un poquito distinto. ¡Te enseño cómo lo hace la mía!' } }];
          return [{ who: 'lupita', text: { en: 'It\'s when we remember people we love who have died. We believe their souls come home to visit for a little while — so we get everything ready to welcome them!', es: 'Es cuando recordamos a las personas que queremos y que ya murieron. Creemos que sus almas vienen de visita un ratito, ¡así que preparamos todo para recibirlas!' } }];
        },
      },
    ]);
    await g.learn('dia');
    await this.say([
      { who: 'lupita', text: { en: 'This year we\'re making an [[ofrenda]] for my Abuelo Beto. Come meet my Abuela!', es: 'Este año vamos a poner una [[ofrenda]] para mi Abuelo Beto. ¡Ven a conocer a mi Abuela!' } },
    ]);
    lu.look(this.chars.abuela.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
    await this.engine.setRig([1.4, 1.6, 2.6], [2.2, 1.0, -2.0], 46, 1.4, 0.15);
    this.chars.abuela.look(new THREE.Vector3(1.4, 1.6, 2.6));
    await this.say([
      { who: 'abuela', text: { en: 'Ay, mija, who did you bring? Come in, come in — make yourself at home!', es: 'Ay, mija, ¿a quién trajiste? ¡Pásale, pásale, estás en tu casa!' }, emote: 'happy' },
      { who: 'abuela', text: { en: 'Your Abuelo Beto died two years ago. I miss him every day… and on Día de Muertos, we welcome him back with everything he loved.', es: 'Tu Abuelo Beto murió hace dos años. Lo extraño todos los días… y en Día de Muertos lo recibimos con todo lo que le gustaba.' }, emote: 'sad' },
      { who: 'abuela', text: { en: 'It is a little sad and a little happy at the same time. That is all right — both feelings are welcome here.', es: 'Es un poquito triste y un poquito alegre a la vez. Está bien: aquí caben los dos sentimientos.' } },
      { who: 'abuela', text: { en: 'In our town, the [[ofrenda]] has his photo, [[cempasúchil]] flowers, [[veladoras|veladora]], water, bread… every family does it its own way.', es: 'En nuestro pueblo, la [[ofrenda]] lleva su foto, [[cempasúchil]], [[veladoras|veladora]], agua, pan… cada familia la pone a su manera.' } },
      { who: 'abuela', text: { en: 'Will you help Lupita? Here is my list:\n**The market:** marigolds, candles, copal, fruit, a sugar skull and tissue paper.\n**Don Ramón\'s bakery:** pan de muerto.\n**Tía Lucía\'s workshop:** papel picado and decorating the skull.', es: '¿Le ayudas a Lupita? Aquí está mi lista:\n**El mercado:** cempasúchil, veladoras, copal, fruta, una calaverita y papel de China.\n**La panadería de Don Ramón:** pan de muerto.\n**El taller de Tía Lucía:** papel picado y decorar la calaverita.' } },
    ]);
    g.flag('intro');
    await this.engine.setRig(this.views.main.pos, this.views.main.target, 46, 1.2, 0.3);
    lu.look(new THREE.Vector3(0, 1.6, 7));
    await this.say([
      { who: 'lupita', emote: 'happy', text: { en: '¡Vámonos! When we\'re ready, we open the **Map** (top right). But first, click around the house — there\'s lots to learn!', es: '¡Vámonos! Cuando estemos listos abrimos el **Mapa** (arriba a la derecha). Pero antes, haz clic por la casa: ¡hay mucho que aprender!' } },
    ]);
    g.ui.pulse('#btn-map', true);
    g.refreshHud();
  }

  async talkLupita() {
    const g = this.game;
    const ph = this.ph;
    if (ph === 'explore') {
      const next = g.goalText();
      await this.say([{ who: 'lupita', text: { en: `Let's keep going! ${next.en}`, es: `¡Sigamos! ${next.es}` } }]);
    } else if (ph === 'done') {
      await this.say([{ who: 'lupita', text: { en: 'The ofrenda is ready. Tomorrow evening we go to the plaza, and then we keep Abuelo company at the [[panteón]].', es: 'La ofrenda está lista. Mañana en la tarde vamos a la plaza y luego acompañamos al Abuelo en el [[panteón]].' } }]);
    } else if (ph === 'after') {
      await this.say([{ who: 'lupita', text: { en: 'Thank you for helping me remember Abuelo. You can make your own ofrenda, play Lotería, or read the Book of Memories from the main menu!', es: '¡Gracias por ayudarme a recordar al Abuelo! Desde el menú principal puedes hacer tu propia ofrenda, jugar Lotería o leer el Libro de los Recuerdos.' } }]);
    } else if (ph === 'intro') {
      await this.intro();
    } else {
      await this.say([{ who: 'lupita', text: { en: 'I\'m so happy you\'re here!', es: '¡Qué gusto que estés aquí!' }, emote: 'happy' }]);
    }
  }

  async talkChispa() {
    const g = this.game;
    this.chars.chispa.play('happy', { restart: true });
    g.sfx('bark');
    if (!g.knows('xolo')) {
      await this.say([
        { who: 'lupita', text: { en: 'Chispa is a Xolo — a hairless dog from Mexico. Her breed is thousands of years old!', es: 'Chispa es una Xolo, un perro sin pelo de México. ¡Su raza tiene miles de años!' } },
        { who: 'abuela', text: { en: 'The old [[mexicas]] told a story: when people died, a little dog helped their souls cross a river on the way to [[Mictlán]], the land of the dead.', es: 'Los antiguos [[mexicas]] contaban que, al morir, un perrito ayudaba a las almas a cruzar un río camino al [[Mictlán]], la tierra de los muertos.' } },
      ]);
      await g.learn('xolo');
      await g.learn('mictlan');
    } else {
      await this.say([{ who: 'chispa', text: { en: 'Woof!', es: '¡Guau!' } }]);
    }
  }

  async talkAbuela() {
    const g = this.game;
    const ph = this.ph;
    if (ph === 'explore') {
      const lines = [{ who: 'abuela', text: { en: 'Did you find everything on my list? Take your time. The market closes late today.', es: '¿Encontraste todo lo de mi lista? Con calma. Hoy el mercado cierra tarde.' } }];
      if (!g.knows('origen')) {
        lines.push({ who: 'abuela', text: { en: 'My grandmother told me these customs are very old — older than the churches, and mixed with what came after. Ask Maestra Eréndira at the plaza; she knows the history.', es: 'Mi abuela me decía que estas costumbres son muy antiguas, más que las iglesias, y se mezclaron con lo que llegó después. Pregúntale a la Maestra Eréndira en la plaza: ella sabe la historia.' } });
      }
      await this.say(lines);
    } else if (ph === 'done') {
      await this.say([{ who: 'abuela', text: { en: 'Look how the candles shine. Thank you, from my heart. Your Abuelo would have made you laugh all night.', es: 'Mira cómo brillan las velas. Gracias, de corazón. Tu abuelo te habría hecho reír toda la noche.' }, emote: 'happy' }]);
    } else {
      await this.say([{ who: 'abuela', text: { en: 'Every family remembers in its own way. That is what makes it beautiful.', es: 'Cada familia recuerda a su manera. Eso es lo bonito.' } }]);
    }
  }

  async talkNico() {
    const g = this.game;
    this.chars.nico.emote('happy');
    await this.say([
      { who: 'nico', text: { en: 'Tonight I\'m going door to door to ask: "[[¿Me da mi calaverita?]]" — and people give us candy or coins!', es: 'Hoy en la noche voy a ir de casa en casa a decir: "[[¿Me da mi calaverita?]]", ¡y nos dan dulces o moneditas!' }, emote: 'happy' },
    ]);
    await g.learn('pedir');
  }

  async talkMama() {
    const g = this.game;
    await this.say([
      { who: 'mama', text: { en: 'I\'m making [[corundas]] — triangle tamales from Michoacán. Your Abuelo could eat six at once!', es: 'Estoy haciendo [[corundas]], tamales de triángulo de Michoacán. ¡Tu abuelo se comía seis de un jalón!' }, emote: 'laugh' },
    ]);
    await g.learn('tamales');
  }

  async talkPapa() {
    await this.say([{ who: 'papa', text: { en: 'My father loved his café de olla and a good game of dominoes. He always let me win… or so he said.', es: 'A mi papá le encantaba su café de olla y una buena partida de dominó. Siempre me dejaba ganar… o eso decía él.' }, emote: 'happy' }]);
  }

  async talkPhoto() {
    const g = this.game;
    await this.say([
      { who: 'lupita', text: { en: 'That\'s my Abuelo Beto. He wore that cap every single day, and he always had a joke ready.', es: 'Ese es mi Abuelo Beto. Usaba esa gorra todos los días y siempre tenía un chiste listo.' } },
      { who: 'abuela', text: { en: 'Tonight his photo goes on the ofrenda, so everyone knows who we are welcoming.', es: 'Hoy en la noche su foto va en la ofrenda, para que todos sepan a quién recibimos.' } },
    ]);
    await g.learn('foto');
  }

  flyMonarchsPast() {
    for (let i = 0; i < 5; i++) {
      const b = monarch({ scale: 3 });
      const z0 = -1.4 + i * 0.3, y0 = 1.3 + i * 0.18;
      this.scene.add(b);
      let k = 0;
      this.updaters.push((dt, time) => {
        if (!b.parent) return;
        k += dt * 0.5;
        b.userData.update(time);
        b.position.set(-7 + k * 2.2 + Math.sin(k * 3 + i) * 0.3, y0 + Math.sin(k * 4 + i) * 0.2, z0 + Math.cos(k * 2 + i) * 0.4);
        b.rotation.y = Math.PI / 2;
        if (k > 1.8) this.scene.remove(b);
      });
    }
  }

  // ---------------------------------------------------------------- the ofrenda
  homeItems() {
    // things in the house + things you gathered (finished versions only)
    const bag = this.game.state.bag.filter((id) => !['papel-china', 'calavera-blanca'].includes(id));
    return [...bag, ...HOME_ITEMS];
  }

  async startBuild() {
    const g = this.game;
    if (!g.has('buildIntro')) {
      await this.say([
        { who: 'abuela', text: { en: 'You\'re back! Everything is here. Now let\'s build Abuelo\'s ofrenda together.', es: '¡Ya regresaron! Aquí está todo. Ahora pongamos juntos la ofrenda del Abuelo.' }, emote: 'happy' },
        { who: 'papa', text: { en: 'I\'ll help with the heavy boxes!', es: '¡Yo ayudo con las cajas pesadas!' } },
      ]);
      g.flag('buildIntro');
    }
    await this.view('ofrenda', { back: false });
    const levels = await this.say([{
      who: 'abuela',
      text: { en: 'First: how many levels should it have? Families do it differently — there is no wrong answer.', es: 'Primero: ¿cuántos niveles le ponemos? Cada familia lo hace distinto; no hay respuesta equivocada.' },
      choices: [1, 2, 3, 7].map((n) => ({ label: { en: `${n} ${n === 1 ? 'level (a table)' : 'levels'}`, es: `${n} ${n === 1 ? 'nivel (una mesa)' : 'niveles'}` }, value: n })),
    }]);
    this.builder = new OfrendaBuilder(this, { base: this.ofrendaTable, baseY: 0.78, mode: 'story', portrait: this.abueloCanvas });
    this.builder.onChange = (id) => this.onBuilderChange(id);
    this.builder.setLevels(levels);
    await this.say([{ who: 'abuela', text: LEVEL_INFO[levels] }]);
    await g.learn('niveles');
    if (this.abueloWall) { this.scene.remove(this.abueloWall); this.engine.removeHotspot(this.abueloWall); }
    await this.say([{ who: 'lupita', text: { en: 'Now pick something from the tray below, then click on the ofrenda to put it there. Click a placed thing to move it.', es: 'Ahora elige algo de la bandeja de abajo y haz clic en la ofrenda para ponerlo. Haz clic en algo ya puesto para moverlo.' } }]);
    this.showBuildTray();
  }

  async showBuildTray() {
    const g = this.game;
    const b = this.builder;
    const ids = this.homeItems();
    const items = [];
    for (const id of ids) {
      const info = g.itemInfo(id);
      items.push({ id, label: info.name || HOME_ITEM_TEXT[id]?.name, img: await g.itemImage(id), used: b.remaining(id) <= 0, count: b.remaining(id) });
    }
    const side = document.createElement('div');
    side.innerHTML = `<button type="button" class="btn rosa small" data-a="done">${icon('candle')} ${t({ en: 'Light it up!', es: '¡A encender!' })}</button>`;
    const ok = b.wishState().every((w) => w.ok);
    const btn = side.querySelector('[data-a=done]');
    btn.disabled = !ok;
    btn.onclick = () => this.finishBuild();
    g.ui.showTray({ label: { en: 'Put on the ofrenda', es: 'Pon en la ofrenda' }, items, active: b.holding?.id, side, onPick: (id) => {
      if (b.pick(id)) {
        g.ui.setTrayActive(b.holding ? id : null);
        if (b.holding) g.ui.toast(t({ en: 'Now click on the ofrenda!', es: '¡Ahora haz clic en la ofrenda!' }), { ico: 'sparkle', ms: 1500 });
      }
    } });
    g.ui.sidePanel(wishesHtml(b, 'story'));
  }

  async onBuilderChange(id) {
    const g = this.game;
    this.showBuildTray();
    const card = g.itemInfo(id)?.card || { foto: 'foto', agua: 'agua', sal: 'sal', cruz: 'cruz', xolo: 'xolo', petate: 'petate', arco: 'arco', lavamanos: 'lavamanos', guitarra: 'personales', domino: 'personales', lentes: 'personales', gorra: 'personales', dibujo: 'personales', tamales: 'tamales', cafe: 'bebidas' }[id];
    if (card && !g.knows(card) && this.builder.has(id)) {
      await g.learn(card);
    }
    const remarks = {
      foto: { who: 'abuela', text: { en: 'There he is. Hola, viejo.', es: 'Ahí está. Hola, viejo.' } },
      guitarra: { who: 'papa', text: { en: 'His guitar! He\'d want it close.', es: '¡Su guitarra! Él la querría cerquita.' } },
      domino: { who: 'papa', text: { en: 'Maybe tonight he\'ll finally let somebody else win.', es: 'A lo mejor hoy por fin deja ganar a alguien más.' }, emote: 'laugh' },
      dibujo: { who: 'lupita', text: { en: 'I drew Abuelo with his guitar. I hope he likes it!', es: 'Dibujé al Abuelo con su guitarra. ¡Ojalá le guste!' } },
      cruz: { who: 'abuela', text: { en: 'Our family is Catholic, so we put a small cross. Other families use other things — or none.', es: 'Nuestra familia es católica, por eso ponemos una crucecita. Otras familias ponen otras cosas, o nada.' } },
      calavera: { who: 'lupita', text: { en: 'The sugar skull we decorated, with his name on it!', es: '¡La calaverita que decoramos, con su nombre!' } },
    };
    if (remarks[id] && this.builder.has(id) && !this['said_' + id]) {
      this['said_' + id] = true;
      await this.say([remarks[id]]);
    }
  }

  onPointerMove() {
    if (this.builder && !this.builder.locked) this.builder.hover();
    if (this.painting) this.paintPetals();
  }

  onPointerDown() {
    if (this.petalMode) { this.painting = true; this.paintPetals(); }
  }

  onPointerUp() {
    this.painting = false;
  }

  onTap() {
    const b = this.builder;
    if (b && b.holding && !b.locked) {
      b.hover();
      const rec = b.place();
      if (rec) {
        this.game.ui.setTrayActive(null);
        return true;
      }
    }
    return false;
  }

  async finishBuild() {
    const g = this.game;
    const b = this.builder;
    b.lock();
    this.lighting = true;
    g.ui.hideTray();
    g.ui.setGoal(null);
    g.state.ofrenda = b.serialize();
    g.save();
    // light the candles one by one
    const candles = b.candles();
    await this.say([{ who: 'abuela', text: { en: 'Now we light the candles, so their light can guide him home. Click each candle!', es: 'Ahora encendemos las velas, para que su luz lo guíe a casa. ¡Haz clic en cada vela!' } }]);
    await new Promise((resolve) => {
      let left = candles.length;
      if (!left) resolve();
      for (const c of candles) {
        this.engine.removeHotspot(c.obj);
        this.hot(c.obj, { en: 'Light the candle', es: 'Encender la vela' }, async () => {
          if (c.obj.userData.lit) return;
          this.engine.removeHotspot(c.obj);
          g.sfx('strike');
          c.obj.userData.light(true);
          this.addCandleGlow(c.obj);
          left--;
          if (left <= 0) resolve();
        }, { sparkle: true, nested: true });
      }
    });
    for (const c of candles) this.engine.removeHotspot(c.obj);
    this.animateTree(b.root);
    const copals = b.copals();
    if (copals.length) {
      await this.say([{ who: 'mama', text: { en: 'And the [[copal]]. Its smoke smells like the forest after rain.', es: 'Y el [[copal]]. Su humo huele a bosque después de la lluvia.' } }]);
      await new Promise((resolve) => {
        const c = copals[0];
        this.engine.removeHotspot(c.obj);
        this.hot(c.obj, { en: 'Light the copal', es: 'Encender el copal' }, async () => {
          this.engine.removeHotspot(c.obj);
          g.sfx('whoosh');
          c.obj.userData.light(true);
          resolve();
        }, { nested: true });
      });
      this.engine.removeHotspot(copals[0].obj);
    }
    await this.petalPathStep();
    await this.finale();
  }

  addCandleGlow(obj) {
    const p = obj.getWorldPosition(new THREE.Vector3());
    if (!this.candleLight) {
      this.candleLight = new THREE.PointLight('#ffb35c', 0, 5, 1.4);
      this.candleLight.position.set(0, 1.5, -2.7);
      this.scene.add(this.candleLight);
    }
    this.candleLight.intensity += 1.6;
    void p;
  }

  async petalPathStep() {
    const g = this.game;
    await this.engine.setRig([1.6, 3.6, 4.2], [2.2, 0, -1.6], 50, 1.2, 0.1);
    await this.say([{ who: 'lupita', text: { en: 'Last thing: a path of [[cempasúchil]] petals from the door to the ofrenda, so Abuelo can find his way. **Drag from the door to the ofrenda!**', es: 'Lo último: un camino de pétalos de [[cempasúchil]] desde la puerta hasta la ofrenda, para que el Abuelo encuentre el camino. **¡Arrastra desde la puerta hasta la ofrenda!**' } }]);
    const pts = [[5.0, -0.5], [3.6, -0.2], [2.4, -0.9], [1.2, -1.6], [0.3, -2.4]];
    const path = petalPath(pts, { width: 0.45, density: 90, seed: 3 });
    path.count = 0;
    this.scene.add(path);
    this.petals = path;
    // a faint dotted guide
    const guide = new THREE.Group();
    const curve = path.userData.curve;
    for (let i = 0; i <= 24; i++) {
      const p = curve.getPointAt(i / 24);
      const d = mesh(new THREE.CircleGeometry(0.05, 10), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.7, depthWrite: false }), { cast: false });
      d.rotation.x = -Math.PI / 2;
      d.position.set(p.x, 0.02, p.z);
      d.raycast = () => {};
      guide.add(d);
    }
    this.scene.add(guide);
    this.guide = guide;
    this.petalMode = true;
    this.petalT = 0;
    await new Promise((resolve) => { this.petalDone = resolve; });
    this.petalMode = false;
    this.scene.remove(guide);
    g.sfx('success');
  }

  paintPetals() {
    const hit = this.engine.pointOnPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    if (!hit || !this.petals) return;
    const curve = this.petals.userData.curve;
    // closest point on the path, only moving forward
    let best = this.petalT, bestD = Infinity;
    for (let i = 0; i <= 60; i++) {
      const tt = i / 60;
      const p = curve.getPointAt(tt);
      const d = Math.hypot(p.x - hit.x, p.z - hit.z);
      if (d < bestD) { bestD = d; best = tt; }
    }
    if (bestD < 0.9 && best > this.petalT && best - this.petalT < 0.35) {
      this.petalT = best;
      const n = Math.floor(this.petals.userData.total * best);
      if (n > this.petals.count + 8) this.game.sfx('petal');
      this.petals.count = n;
      this.guide.children.forEach((d, i) => { d.visible = i / 24 > best; });
      if (best > 0.96) {
        this.petals.count = this.petals.userData.total;
        this.petalDone?.();
        this.petalDone = null;
      }
    }
  }

  async finale() {
    const g = this.game;
    g.sound.music('ofrenda', true);
    // dim the room, glow the ofrenda
    const lamp0 = this.lampLight.intensity;
    await this.engine.tween(2, (k) => {
      this.lampLight.intensity = lamp0 * (1 - k * 0.7);
      this.hemi.intensity = 0.55 * (1 - k * 0.3);
    });
    await this.engine.setRig([0.6, 1.7, 2.2], [0, 1.2, -3.2], 48, 2.5, 0.1);
    const ab = this.chars.abuela;
    for (const id of ['lupita', 'abuela', 'mama', 'papa', 'nico']) this.chars[id]?.look(new THREE.Vector3(0, 1.3, -3.4));
    // the gentle signs: a monarch comes in through the door and rests on the photo; Chispa wags at the chair
    const fotoRec = this.builder.placed.find((r) => r.id === 'foto');
    const target = fotoRec ? fotoRec.obj.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.05, 0.32, 0.05)) : new THREE.Vector3(0, 1.6, -3.3);
    const b = monarch({ scale: 3 });
    this.scene.add(b);
    let k = 0;
    const start = new THREE.Vector3(5.2, 1.6, -0.4);
    this.updaters.push((dt, time) => {
      k = Math.min(1, k + dt * 0.18);
      b.userData.update(time * (k < 1 ? 1 : 0.15));
      const p = start.clone().lerp(target, k);
      p.y += Math.sin(k * Math.PI) * 0.8 + Math.sin(time * 3) * 0.05 * (1 - k);
      b.position.copy(p);
      b.rotation.y = -Math.PI / 2 + k * 1.2;
    });
    this.chars.chispa.faceTo(2.45, -2.35);
    this.chars.chispa.play('happy', { dur: 8 });
    await this.say([
      { who: 'abuela', text: { en: 'Do you see? A [[mariposa monarca]]… My mother used to say the butterflies bring our loved ones home.', es: '¿Ves? Una [[mariposa monarca]]… Mi mamá decía que las mariposas traen a nuestros seres queridos a casa.' }, emote: 'happy' },
      { who: 'lupita', text: { en: 'And look at Chispa — she\'s wagging her tail at Abuelo\'s chair!', es: '¡Y mira a Chispa, le mueve la cola al sillón del Abuelo!' }, emote: 'surprised' },
      { who: 'papa', text: { en: 'Every year on this night, he would play us one song. Badly!', es: 'Cada año, esta noche, nos tocaba una canción. ¡Bien mal!' }, emote: 'laugh' },
      { who: 'abuela', text: { en: 'We are sad that he is gone, and happy that we had him. Both things are true. ¡Bienvenido a casa, Beto!', es: 'Nos da tristeza que ya no esté y alegría de haberlo tenido. Las dos cosas son ciertas. ¡Bienvenido a casa, Beto!' } },
      { who: 'lupita', text: { en: 'Welcome home, Abuelo.', es: 'Bienvenido a casa, Abuelo.' }, emote: 'smile' },
    ]);
    void ab;
    g.flag('ofrenda');
    g.addPetals(5);
    g.sfx('success');
    await this.offerPhoto(true);
    await this.say([{ who: 'lupita', text: { en: 'Tomorrow is November 1. In the evening we\'ll go to the plaza, and then stay with Abuelo at the [[panteón]]. ¿Vienes? Are you coming?', es: 'Mañana es 1 de noviembre. En la tarde vamos a la plaza y luego acompañamos al Abuelo en el [[panteón]]. ¿Vienes?' } }]);
    g.go('plaza', { dayCard: { title: { en: 'November 1', es: '1 de noviembre' }, sub: { en: 'Todos Santos', es: 'Todos Santos' } } });
  }

  // shows the saved ofrenda, candles lit
  showFinishedOfrenda() {
    const g = this.game;
    const data = g.state.ofrenda;
    if (!data) return;
    const make = () => {
      this.builder = new OfrendaBuilder(this, { base: this.ofrendaTable, baseY: 0.78, mode: 'story', portrait: this.abueloCanvas });
      this.builder.load(data, { lit: this.night || this.ph === 'ending' });
      this.builder.lock();
      if (this.night) {
        const cl = new THREE.PointLight('#ffb35c', 5, 5, 1.4);
        cl.position.set(0, 1.5, -2.7);
        this.scene.add(cl);
        const path = petalPath([[5.0, -0.5], [3.6, -0.2], [2.4, -0.9], [1.2, -1.6], [0.3, -2.4]], { width: 0.45, density: 90, seed: 3 });
        this.scene.add(path);
      }
    };
    if (this.abueloCanvas) make();
    else g.portraitCanvas('abuelo').then((cv) => { this.abueloCanvas = cv; make(); });
  }

  async offerPhoto(auto = false) {
    const g = this.game;
    const choice = await this.say([{
      who: auto ? 'lupita' : null,
      text: { en: 'Do you want to take a picture of the ofrenda?', es: '¿Quieres tomarle una foto a la ofrenda?' },
      choices: [{ label: { en: 'Take a picture!', es: '¡Tomar foto!' }, value: 'yes' }, { label: { en: 'Not now', es: 'Ahora no' }, value: 'no' }],
    }]);
    if (choice === 'yes') {
      g.sfx('chime');
      const url = this.engine.snapshot();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ofrenda-abuelo-beto.png';
      a.click();
      g.ui.toast(t(S.saved), { ico: 'camera' });
    }
  }

  // ---------------------------------------------------------------- the end
  async ending() {
    const g = this.game;
    await this.say([
      { who: 'lupita', text: { en: 'It\'s November 2. After the souls\' visit, families share the food from the ofrenda.', es: 'Es 2 de noviembre. Después de la visita de las almas, las familias comparten la comida de la ofrenda.' } },
      { who: 'abuela', text: { en: 'They say the souls take the smell and the steam — the essence. Taste the bread… it\'s not as sweet as yesterday, ¿verdad?', es: 'Dicen que las almas se llevan el olor y el vapor, la esencia. Prueba el pan… ya no está tan dulce como ayer, ¿verdad?' }, emote: 'happy' },
    ]);
    await g.learn('despues');
    await this.say([
      { who: 'papa', text: { en: 'Thank you for being here with our family.', es: 'Gracias por acompañar a nuestra familia.' } },
      { who: 'lupita', text: { en: 'As long as we tell his stories, Abuelo stays with us.', es: 'Mientras contemos sus historias, el Abuelo sigue con nosotros.' } },
      { who: 'lupita', text: { en: 'Every family remembers in its own way. If you\'d like, you can ask a grown-up in your family about someone they remember. And if you\'d rather not, that\'s okay too.', es: 'Cada familia recuerda a su manera. Si quieres, puedes preguntarle a alguien de tu familia sobre alguien a quien recuerde. Y si prefieres no hacerlo, también está bien.' } },
    ]);
    g.flag('ending');
    g.addPetals(5);
    g.sfx('success');
    await this.showEndCard();
  }

  async showEndCard() {
    const g = this.game;
    const n = g.state.cards.length;
    const body = document.createElement('div');
    body.className = 'mg';
    body.innerHTML = `
      <div style="text-align:center"><div style="font:46px var(--display);color:var(--purple)">${t({ en: '¡Fin!', es: '¡Fin!' })}</div>
      <p style="font-weight:800">${t({ en: 'You helped Lupita\'s family welcome Abuelo Beto home.', es: 'Ayudaste a la familia de Lupita a recibir al Abuelo Beto.' })}</p>
      <p style="font-weight:800">${icon('cards')} ${t(S.cardsFound, { n, total: CARDS.length })} · ${icon('marigold')} ${g.state.petals}</p></div>
      <div class="row" style="justify-content:center">
        <button type="button" class="btn purple" data-a="lot">${icon('cards')} ${t(S.loteria)}</button>
        <button type="button" class="btn turq" data-a="free">${icon('heart')} ${t(S.freeMode)}</button>
        <button type="button" class="btn cream" data-a="book">${icon('book')} ${t(S.book)}</button>
      </div>`;
    const m = g.ui.modal({ title: { en: 'The end — and a beginning', es: 'El fin… y un comienzo' }, ico: 'star', body, cls: 'narrow' });
    body.querySelector('[data-a=lot]').onclick = () => { m.close(); g.openLoteria(); };
    body.querySelector('[data-a=free]').onclick = () => { m.close(); g.startFree(); };
    body.querySelector('[data-a=book]').onclick = () => { m.close(); g.openBook(); };
    await m.done;
  }

  goalOverride() {
    if (this.ph === 'ending' && !this.game.has('ending')) return false;
    if (this.ph === 'build' && this.lighting && !this.game.has('ofrenda')) return false;
    if (this.ph === 'build' && !this.lighting) return { en: 'Build Abuelo\'s ofrenda — anything goes!', es: 'Pon la ofrenda del Abuelo: ¡como tú quieras!' };
    return null;
  }

  onLang() { if (this.builder && !this.builder.locked && !this.game.ui.el.tray.classList.contains('hidden')) this.showBuildTray(); }
}
