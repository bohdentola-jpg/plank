// La panadería de Don Ramón: bake pan de muerto step by step. Every loaf
// comes out "right" — Don Ramón shares what people say the shapes mean.
import * as THREE from 'three';
import { Scene } from './base.js';
import { toon, box, mesh, cyl, sphere, rbox, rng, PAL, glowSprite, outline } from '../toon.js';
import { wall, floor, beams } from '../room.js';
import { woodTex, plasterTex } from '../world.js';
import { panDeMuerto } from '../props.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';

const TABLE = new THREE.Vector3(0, 0, -0.6);
const TOP = 0.92;

export class BakeryScene extends Scene {
  dayLabel() { return { en: 'October 31 · afternoon', es: '31 de octubre · tarde' }; }

  async build() {
    await super.build();
    this.setLights('interior', { scenery: false, shadowBox: 8 });
    this.sun.position.set(6, 9, 8);
    this.hemi.intensity = 1.25;
    const s = this.scene;
    const room = new THREE.Group();
    room.add(floor(10, 8, '#d8b88e', '#caa87c'));
    const back = wall(10, 3.6, [{ x: 3.2, y: 1.0, w: 1.4, h: 1.2 }], '#fbe3c0', { band: '#c4562e' });
    back.position.set(0, 0, -4);
    room.add(back);
    for (const sx of [-1, 1]) {
      const w = wall(8, 3.6, sx > 0 ? [{ x: 1.4, y: 0, w: 1.2, h: 2.3 }] : [], '#fbe3c0', { band: '#c4562e' });
      w.position.set(sx * 5, 0, 0);
      w.rotation.y = -sx * Math.PI / 2;
      room.add(w);
    }
    room.add(beams(10, 8, 3.6, 6));
    s.add(room);
    this.merge(room);
    this.buildOven();
    this.buildShelves();
    // the work table
    const tb = new THREE.Group();
    const top = box(2.6, 0.08, 1.2, toon('#ffffff', { map: woodTex('#c9965e'), rim: 0 }));
    top.position.y = TOP - 0.04;
    tb.add(top);
    for (const [x, z] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]]) {
      const leg = box(0.1, TOP - 0.08, 0.1, toon('#8a5a33', { rim: 0 }));
      leg.position.set(x, (TOP - 0.08) / 2, z);
      tb.add(leg);
    }
    // flour dust
    const dust = mesh(new THREE.CircleGeometry(0.5, 20), toon('#fbf6ea', { transparent: true, opacity: 0.7, rim: 0 }), { cast: false });
    dust.rotation.x = -Math.PI / 2;
    dust.position.set(-0.2, TOP + 0.002, 0.05);
    tb.add(dust);
    tb.position.copy(TABLE);
    s.add(tb);
    this.table = tb;
    this.addChar('ramon', 0.2, -1.65, 0);
    this.addChar('lupita', -1.7, 0.4, 0.6);
    this.addChar('chispa', -2.3, 0.9, 0.5).play('sit');
    this.defineView('main', [0, 2.05, 5.2], [0, 1.1, -1.4], 46);
    this.defineView('table', [0, 2.15, 1.1], [0, TOP, -0.65], 46);
    this.defineView('oven', [-1.2, 1.7, 1.2], [-3.4, 1.0, -2.6], 46);
    this.hideMonarch('shelf', 3.6, 2.45, -3.6);
    this.hideMonarch('sacks', -4.2, 0.75, 1.2);
  }

  buildOven() {
    const s = this.scene;
    const g = new THREE.Group();
    const brick = toon('#ffffff', { map: plasterTex('#c96f4a', null), rim: 0 });
    const base = box(2.2, 0.9, 2.0, brick);
    base.position.y = 0.45;
    g.add(base);
    const dome = mesh(new THREE.SphereGeometry(1.0, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), brick);
    dome.position.y = 0.9;
    dome.scale.set(1.05, 0.95, 0.95);
    g.add(dome);
    const mouth = mesh(new THREE.CircleGeometry(0.42, 20, 0, Math.PI), toon('#2a140c', { rim: 0 }), { cast: false });
    mouth.position.set(0, 0.92, 0.96);
    g.add(mouth);
    const fire = glowSprite('#ff8a2a', 1.3, 0.85);
    fire.position.set(0, 1.05, 0.7);
    g.add(fire);
    this.fire = fire;
    const fl = new THREE.PointLight('#ff9a4a', 4, 4, 1.5);
    fl.position.set(0, 1.1, 1.3);
    g.add(fl);
    this.fireLight = fl;
    const arch = mesh(new THREE.TorusGeometry(0.46, 0.07, 8, 20, Math.PI), toon('#9a4a2a'));
    arch.position.set(0, 0.92, 0.97);
    g.add(arch);
    const chim = cyl(0.18, 0.22, 1.6, brick, 12);
    chim.position.set(0, 2.4, -0.4);
    g.add(chim);
    for (let i = 0; i < 6; i++) {
      const log = cyl(0.07, 0.07, 0.6, toon('#7a5236'), 8);
      log.rotation.z = Math.PI / 2;
      log.position.set(-1.45, 0.08 + (i % 3) * 0.14, 0.4 + Math.floor(i / 3) * 0.16);
      g.add(log);
    }
    const peel = new THREE.Group();
    const handle = cyl(0.025, 0.025, 1.6, toon('#c9965e'), 6);
    handle.rotation.z = 0.25;
    handle.position.set(1.25, 0.85, 0.8);
    peel.add(handle);
    const blade = box(0.32, 0.4, 0.02, toon('#c9965e'));
    blade.position.set(1.05, 0.1, 0.8);
    peel.add(blade);
    g.add(peel);
    g.position.set(-3.5, 0, -2.6);
    g.rotation.y = 0.5;
    s.add(g);
    this.oven = g;
    this.updaters.push((dt, time) => {
      const f = 1 + Math.sin(time * 9) * 0.06 + Math.sin(time * 23) * 0.04;
      fire.material.opacity = 0.7 * f;
      fl.intensity = 4 * f;
    });
  }

  buildShelves() {
    const s = this.scene;
    const g = new THREE.Group();
    const wood = toon('#ffffff', { map: woodTex('#8a5a33'), rim: 0 });
    const r = rng(8);
    for (let i = 0; i < 3; i++) {
      const sh = box(3.2, 0.06, 0.5, wood);
      sh.position.set(0, 0.7 + i * 0.6, 0);
      g.add(sh);
    }
    for (const x of [-1.6, 1.6]) {
      const side = box(0.06, 1.9, 0.5, wood);
      side.position.set(x, 0.95, 0);
      g.add(side);
    }
    // conchas, pan de muerto, cuernitos
    const conchaCols = ['#f6e2c0', '#d9a06a', '#f2b8c8'];
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 6; k++) {
        const y = 0.73 + i * 0.6;
        const x = -1.35 + k * 0.52 + (r() - 0.5) * 0.06;
        if (i === 1) {
          const p = panDeMuerto({ topping: k % 3 === 2 ? 'sesame' : 'sugar', size: 1.1 });
          p.position.set(x, y, 0);
          g.add(p);
        } else {
          const c = sphere(0.11, toon('#d68a3c'), 14);
          c.scale.set(1, 0.55, 1);
          c.position.set(x, y + 0.05, 0);
          g.add(c);
          const top = sphere(0.105, toon(conchaCols[(k + i) % 3]), 14);
          top.scale.set(1, 0.4, 1);
          top.position.set(x, y + 0.08, 0);
          g.add(top);
        }
      }
    }
    g.position.set(2.6, 0, -3.6);
    s.add(g);
    this.merge(g);
    // flour sacks
    for (let i = 0; i < 3; i++) {
      const sack = sphere(0.35, toon('#efe3c8'), 14);
      sack.scale.set(1, 1.3, 0.85);
      sack.position.set(-4.2 + i * 0.25, 0.42, 1.6 - i * 0.6);
      s.add(sack);
    }
    // the shop counter near the door
    const counter = box(1.6, 1.0, 0.6, toon('#ffffff', { map: woodTex('#7a4a2a'), rim: 0 }));
    counter.position.set(3.9, 0.5, 1.2);
    s.add(counter);
    const glass = box(1.5, 0.35, 0.5, toon('#d8f1ff', { transparent: true, opacity: 0.35 }));
    glass.position.set(3.9, 1.18, 1.2);
    s.add(glass);
  }

  async enter() {
    const g = this.game;
    g.sound.music('workshop');
    g.sound.setAmbient(null);
    this.talkable('ramon', { en: 'Don Ramón', es: 'Don Ramón' }, () => this.ramon());
    this.hot(this.table, { en: 'Bake pan de muerto', es: 'Hornear pan de muerto' }, () => this.ramon(), { enabled: () => !g.has('pan') });
    this.hot(this.oven, { en: 'The wood-fired oven', es: 'El horno de leña' }, async () => {
      await this.view('oven');
      await this.say([{ who: 'ramon', text: { en: 'My oven burns wood, like my father\'s did. Bread baked this way smells like smoke and orange blossom.', es: 'Mi horno es de leña, como el de mi papá. El pan que sale de aquí huele a humo y a azahar.' } }]);
    }, { sparkle: false });
    this.talkable('lupita', { en: 'Lupita', es: 'Lupita' }, () => this.say([{ who: 'lupita', text: g.has('pan') ? { en: 'Our pan de muerto smells SO good. On to the next place — open the Map!', es: '¡Nuestro pan huele riquísimo! A lo que sigue: abre el Mapa.' } : { en: 'Let\'s ask Don Ramón to teach us!', es: '¡Pidámosle a Don Ramón que nos enseñe!' } }]));
  }

  async afterEnter() {
    if (!this.game.has('pan') && !this.game.has('bakeryHello')) {
      this.game.flag('bakeryHello');
      await this.say([
        { who: 'ramon', emote: 'happy', text: { en: '¡Pásenle, pásenle! Come in! Lupita, your Abuela called. She says you want to bake [[pan de muerto]] for your Abuelo.', es: '¡Pásenle, pásenle! Lupita, tu abuela me habló. Dice que quieren hornear [[pan de muerto]] para tu abuelo.' } },
        { who: 'ramon', text: { en: 'Click on my work table and we\'ll start!', es: '¡Haz clic en mi mesa de trabajo y empezamos!' } },
      ]);
    }
  }

  async ramon() {
    const g = this.game;
    if (g.has('pan')) {
      await this.say([{ who: 'ramon', text: { en: 'Your Abuelo always bought two loaves — one for the ofrenda and one "for the road". ¡Ja!', es: 'Tu abuelo siempre compraba dos panes: uno para la ofrenda y otro "para el camino". ¡Ja!' }, emote: 'laugh' }]);
      return;
    }
    await this.bake();
  }

  // ---------------------------------------------------------------- the minigame
  steps(i) {
    const names = [{ en: 'Mix', es: 'Mezclar' }, { en: 'Knead', es: 'Amasar' }, { en: 'Shape', es: 'Formar' }, { en: 'Bake', es: 'Hornear' }, { en: 'Top', es: 'Decorar' }];
    return `<div class="steps">${names.map((n, k) => `<span class="${k < i ? 'done' : k === i ? 'on' : ''}">${k + 1}. ${t(n)}</span>`).join('')}</div>`;
  }

  async bake() {
    const g = this.game;
    await this.view('table', { back: false });
    const T = this.table;
    this.mg = new THREE.Group();
    T.add(this.mg);
    // 1. ingredients
    const bowl = mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#e8d9c2', { side: THREE.DoubleSide }));
    bowl.position.set(0, TOP + 0.3, 0);
    this.mg.add(bowl);
    const inside = cyl(0.27, 0.15, 0.02, toon('#efe3c8'), 20);
    inside.position.set(0, TOP + 0.05, 0);
    inside.visible = false;
    this.mg.add(inside);
    const ING = [
      { id: 'harina', make: () => { const m = sphere(0.16, toon('#efe3c8'), 12); m.scale.set(1, 1.2, 0.8); return m; }, x: -0.95, z: -0.1, name: { en: 'Wheat flour', es: 'Harina de trigo' }, fact: { en: 'Wheat came to Mexico with the Spanish. Before that, people made breads and figures with corn and amaranth.', es: 'El trigo llegó a México con los españoles. Antes se hacían panes y figuras de maíz y amaranto.' } },
      { id: 'huevos', make: () => { const gg = new THREE.Group(); for (let i = 0; i < 3; i++) { const e = sphere(0.045, toon('#f6e7cf'), 10); e.scale.y = 1.3; e.position.set(i * 0.08 - 0.08, 0.06, 0); gg.add(e); } return gg; }, x: -0.6, z: 0.35, name: { en: 'Eggs', es: 'Huevos' } },
      { id: 'mantequilla', make: () => rbox(0.16, 0.08, 0.1, 0.02, toon('#ffe58a')), x: -0.2, z: 0.42, name: { en: 'Butter', es: 'Mantequilla' } },
      { id: 'azucar', make: () => { const m = cyl(0.08, 0.1, 0.18, toon('#ffffff'), 12); return m; }, x: 0.25, z: 0.42, name: { en: 'Sugar', es: 'Azúcar' } },
      { id: 'levadura', make: () => rbox(0.1, 0.06, 0.08, 0.015, toon('#c9a063')), x: 0.62, z: 0.35, name: { en: 'Yeast', es: 'Levadura' }, fact: { en: 'Yeast makes the dough rise and become fluffy.', es: 'La levadura hace que la masa crezca y quede esponjosa.' } },
      { id: 'azahar', make: () => { const gg = new THREE.Group(); const b = cyl(0.05, 0.06, 0.18, toon('#cfe8ff', { transparent: true, opacity: 0.7 }), 12); b.position.y = 0.09; gg.add(b); const c = cyl(0.025, 0.025, 0.05, toon(PAL.purple), 8); c.position.y = 0.2; gg.add(c); return gg; }, x: 0.95, z: -0.05, name: { en: 'Orange-blossom water', es: 'Agua de azahar' }, fact: { en: 'Orange-blossom water (azahar) gives pan de muerto its special smell. Some bakers use orange zest too.', es: 'El agua de azahar le da al pan de muerto su olor especial. Algunos panaderos usan también ralladura de naranja.' } },
    ];
    await this.say([{ who: 'ramon', text: { en: 'First, the ingredients. Click each one to add it to the bowl!', es: 'Primero, los ingredientes. ¡Haz clic en cada uno para echarlo al tazón!' } }]);
    g.ui.showTray({ label: { en: 'Pan de muerto', es: 'Pan de muerto' }, items: [], side: this.steps(0), onPick: () => {} });
    await new Promise((resolve) => {
      let left = ING.length;
      for (const ing of ING) {
        const o = ing.make();
        o.position.set(ing.x, TOP + 0.02, ing.z);
        outline(o, 0.004);
        this.mg.add(o);
        this.hot(o, ing.name, async () => {
          this.engine.removeHotspot(o);
          g.sfx(ing.id === 'azahar' ? 'pour' : 'whoosh');
          const p0 = o.position.clone();
          await this.engine.tween(0.5, (k) => {
            o.position.set(p0.x * (1 - k), TOP + 0.02 + Math.sin(k * Math.PI) * 0.4 + k * 0.2, p0.z * (1 - k));
            o.scale.setScalar(1 - k * 0.7);
          });
          this.mg.remove(o);
          inside.visible = true;
          inside.position.y = TOP + 0.05 + (ING.length - left + 1) * 0.02;
          left--;
          if (ing.fact) await this.say([{ who: 'ramon', text: ing.fact }]);
          if (left <= 0) resolve();
        }, { sparkle: true, nested: true });
      }
    });
    // 2. knead
    this.mg.remove(bowl, inside);
    const dough = sphere(0.22, toon('#f0d6aa'), 24);
    dough.scale.set(1, 0.6, 1);
    dough.position.set(0, TOP + 0.12, 0);
    outline(dough, 0.004);
    this.mg.add(dough);
    this.dough = dough;
    g.ui.showTray({ label: { en: 'Pan de muerto', es: 'Pan de muerto' }, items: [], side: `${this.steps(1)}<div class="meter" style="width:220px"><i id="knead"></i></div>`, onPick: () => {} });
    await this.say([{ who: 'ramon', text: { en: 'Now we knead! **Drag back and forth over the dough** until it\'s smooth.', es: '¡Ahora a amasar! **Arrastra de un lado a otro sobre la masa** hasta que quede suavecita.' } }]);
    await new Promise((resolve) => {
      this.kneading = { amount: 0, last: null, resolve };
    });
    this.kneading = null;
    // 3. shape: round loaf + bones + ball
    g.sfx('success');
    await this.engine.tween(0.6, (k) => { dough.scale.set(1 + k * 0.2, 0.6 - k * 0.05, 1 + k * 0.2); });
    g.ui.showTray({ label: { en: 'Pan de muerto', es: 'Pan de muerto' }, items: [], side: this.steps(2), onPick: () => {} });
    await this.say([
      { who: 'ramon', text: { en: 'Beautiful and round. Now the **huesitos** — the little dough bones. Click on the loaf to lay a bone across it. Most bakers use four, in a cross… but it\'s your bread!', es: 'Bien redondita. Ahora los **huesitos** de masa. Haz clic en el pan para ponerle un hueso encima. Casi todos ponemos cuatro, en cruz… ¡pero es tu pan!' } },
    ]);
    this.bones = [];
    await new Promise((resolve) => {
      this.boneMode = { resolve };
      const side = document.createElement('div');
      side.innerHTML = `${this.steps(2)}<button type="button" class="btn rosa small" data-a="ok">${icon('check')} ${t({ en: 'Done with the bones', es: 'Listos los huesitos' })}</button>`;
      g.ui.showTray({ label: { en: 'Pan de muerto', es: 'Pan de muerto' }, items: [], side, onPick: () => {} });
      side.querySelector('[data-a=ok]').onclick = () => {
        if (!this.bones.length) { g.ui.toast(t({ en: 'Add at least one bone!', es: '¡Ponle al menos un huesito!' }), { ico: 'info' }); return; }
        resolve();
      };
    });
    this.boneMode = null;
    const ball = sphere(0.05, toon('#e9c48f'), 14);
    ball.position.set(0, TOP + 0.31, 0);
    ball.scale.setScalar(0.01);
    this.mg.add(ball);
    this.ball = ball;
    await this.say([{ who: 'ramon', text: { en: 'And on top, a little ball. Many people say it\'s a skull, or a heart. Some say the bones are tears. I call it **la nariz** — the nose! ¡Ja, ja!', es: 'Y arriba, una bolita. Mucha gente dice que es el cráneo, o el corazón. Hay quien dice que los huesitos son lágrimas. Yo le digo **la nariz**. ¡Ja, ja!' }, emote: 'laugh' }]);
    g.sfx('bean');
    await this.engine.tween(0.4, (k) => ball.scale.setScalar(Math.max(0.01, k)), 'back');
    // 4. bake
    g.ui.showTray({ label: { en: 'Pan de muerto', es: 'Pan de muerto' }, items: [], side: this.steps(3), onPick: () => {} });
    await this.say([{ who: 'ramon', text: { en: 'Into the oven! Watch it turn golden.', es: '¡Al horno! Mira cómo se dora.' } }]);
    await this.view('oven', { back: false });
    const bread = this.loafGroup();
    this.mg.visible = false;
    bread.position.set(-3.5 + Math.sin(0.5) * 0.7, 0.98, -2.6 + Math.cos(0.5) * 0.7);
    this.scene.add(bread);
    this.fireLight.intensity = 8;
    const mats = [];
    bread.traverse((o) => { if (o.isMesh && !o.userData.isOutlineHull && o.material?.color) { o.material = o.material.clone(); mats.push(o.material); } });
    const raw = new THREE.Color('#f0d6aa'), baked = new THREE.Color('#cf7f34');
    await this.engine.tween(3.2, (k) => {
      for (const m of mats) m.color.copy(raw).lerp(baked, k);
      bread.scale.setScalar(1 + k * 0.18);
    }, 'inOut');
    g.sfx('ding');
    await this.say([{ who: 'ramon', text: { en: '¡Listo! Golden like the sun.', es: '¡Listo! Doradito como el sol.' }, emote: 'happy' }]);
    this.scene.remove(bread);
    this.mg.visible = true;
    for (const m of [this.dough, ...this.bones, this.ball]) {
      m.traverse((o) => { if (o.isMesh && !o.userData.isOutlineHull && o.material?.color) { o.material = o.material.clone(); o.material.color.set(m === this.dough ? '#d68a3c' : '#c97a32'); } });
    }
    await this.view('table', { back: false });
    // 5. topping
    g.ui.showTray({ label: { en: 'Pan de muerto', es: 'Pan de muerto' }, items: [], side: this.steps(4), onPick: () => {} });
    const top = await this.say([{
      who: 'ramon',
      text: { en: 'Last step. Here in Michoacán I sprinkle sugar, but bread changes from town to town. How do you want it?', es: 'Último paso. Aquí en Michoacán le pongo azúcar, pero el pan cambia de pueblo en pueblo. ¿Cómo lo quieres?' },
      choices: [
        { label: { en: 'Sugar!', es: '¡Azúcar!' }, value: 'sugar' },
        { label: { en: 'Sesame seeds', es: 'Ajonjolí' }, value: 'sesame' },
        { label: { en: 'Plain and shiny', es: 'Sencillo y brillante' }, value: 'plain' },
      ],
    }]);
    g.sfx('petal');
    const finished = panDeMuerto({ topping: top, size: 2.2 });
    finished.position.set(0, TOP, 0);
    outline(finished, 0.004);
    this.mg.clear();
    this.mg.add(finished);
    g.state.pan = { topping: top, bones: this.bones.length };
    g.flag('pan');
    g.ui.hideTray();
    await this.say([
      { who: 'ramon', text: { en: 'In Oaxaca they make pan de yema with a little painted face. Every region has its own bread — and every family has its favorite.', es: 'En Oaxaca hacen pan de yema con una carita pintada. Cada región tiene su pan, y cada familia su favorito.' } },
    ]);
    await g.give('pan');
    await g.learn('pan');
    await this.say([{ who: 'lupita', emote: 'happy', text: { en: '¡Gracias, Don Ramón! Let\'s open the **Map** and keep going!', es: '¡Gracias, Don Ramón! ¡Abramos el **Mapa** y sigamos!' } }]);
    g.ui.pulse('#btn-map', true);
    await this.backToMain();
  }

  loafGroup() {
    const gg = new THREE.Group();
    const d = this.dough.clone();
    d.position.set(0, 0.12, 0);
    gg.add(d);
    for (const b of this.bones) {
      const c = b.clone();
      c.position.y -= TOP;
      gg.add(c);
    }
    const ba = this.ball.clone();
    ba.position.set(0, 0.31, 0);
    gg.add(ba);
    gg.scale.setScalar(0.8);
    return gg;
  }

  addBone(angle) {
    const g = this.game;
    if (this.bones.length >= 8) { g.sfx('oops'); return; }
    const r = 0.26;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const u = (k / 8) * 2 - 1;
      pts.push(new THREE.Vector3(Math.cos(angle) * u * r, TOP + 0.12 + Math.sqrt(Math.max(0, 1 - u * u)) * 0.15 + 0.01, Math.sin(angle) * u * r));
    }
    const bone = new THREE.Group();
    const m = toon('#e9c48f');
    bone.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 6), m));
    for (const u of [-0.55, 0, 0.55]) {
      const k = sphere(0.035, m, 8);
      k.position.set(Math.cos(angle) * u * r, TOP + 0.12 + Math.sqrt(1 - u * u) * 0.15 + 0.015, Math.sin(angle) * u * r);
      bone.add(k);
    }
    outline(bone, 0.004);
    this.mg.add(bone);
    this.bones.push(bone);
    g.sfx('bean');
  }

  onPointerMove() {
    const kd = this.kneading;
    if (!kd || !this.pressing) return;
    const p = this.engine.pointOnPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TOP + 0.1)));
    if (!p) return;
    const local = this.table.worldToLocal(p.clone());
    if (kd.last) {
      const d = Math.hypot(local.x - kd.last.x, local.z - kd.last.z);
      if (Math.hypot(local.x, local.z) < 0.6) kd.amount += d;
    }
    kd.last = local;
    const k = Math.min(1, kd.amount / 4.5);
    const bar = document.getElementById('knead');
    if (bar) bar.style.width = `${k * 100}%`;
    this.dough.scale.set(1 + Math.sin(kd.amount * 6) * 0.12, 0.6 - Math.abs(Math.sin(kd.amount * 6)) * 0.08, 1 - Math.sin(kd.amount * 6) * 0.1);
    if (Math.floor(kd.amount * 3) !== Math.floor((kd.amount - 0.05) * 3)) this.game.sfx('knead');
    if (k >= 1) { kd.resolve(); this.kneading = null; this.dough.scale.set(1, 0.6, 1); }
  }

  onPointerDown() { this.pressing = true; if (this.kneading) this.kneading.last = null; }

  onPointerUp() { this.pressing = false; }

  onTap() {
    if (!this.boneMode) return false;
    const hits = this.engine.raycastObjects([this.dough]);
    if (!hits.length) return false;
    const local = this.table.worldToLocal(hits[0].point.clone());
    this.addBone(Math.atan2(local.z, local.x));
    return true;
  }
}
