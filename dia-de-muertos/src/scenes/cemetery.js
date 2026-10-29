// El panteón, the night of November 1: the velación. Families clean and
// decorate their graves, light candles, share food and music, and keep their
// loved ones company until dawn. Warm and social — never spooky.
import * as THREE from 'three';
import { Scene } from './base.js';
import { toon, box, mesh, cyl, sphere, rbox, rng, PAL, glowSprite } from '../toon.js';
import { marigolds, marigoldBunch, papelString, tree, plasterTex, cobbleTex } from '../world.js';
import { cirio, veladora, makeProp, guitar, petate } from '../props.js';

const GRAVE = new THREE.Vector3(0, 0, 0.6); // Abuelo's grave
const TOMB_COLORS = ['#f2efe8', '#7fc3e8', '#f7a8c4', '#9ed98b', '#ffd86b', '#c9a0ff', '#e9e0cf'];

function tombModel(kind, color, r) {
  const g = new THREE.Group();
  const stone = toon(color);
  if (kind === 'mound') {
    const m = sphere(0.7, toon('#7a5a3e'), 14);
    m.scale.set(0.6, 0.22, 1.1);
    m.position.y = 0.05;
    g.add(m);
    const cross = new THREE.Group();
    cross.add(box(0.07, 0.7, 0.06, toon('#7a5236')));
    const h = box(0.36, 0.07, 0.06, toon('#7a5236'));
    h.position.y = 0.15;
    cross.add(h);
    cross.position.set(0, 0.35, -0.7);
    g.add(cross);
  } else if (kind === 'chapel') {
    const base = box(1.1, 0.4, 1.6, stone);
    base.position.y = 0.2;
    g.add(base);
    const niche = box(0.9, 1.2, 0.5, stone);
    niche.position.set(0, 0.9, -0.55);
    g.add(niche);
    const roof = mesh(new THREE.CylinderGeometry(0.01, 0.62, 0.45, 4, 1), toon('#c8643b'));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.6);
    roof.position.set(0, 1.72, -0.55);
    g.add(roof);
    const hole = box(0.5, 0.6, 0.05, toon('#3a2f3a'));
    hole.position.set(0, 0.95, -0.28);
    g.add(hole);
  } else {
    const base = box(0.9, 0.35, 1.7, stone);
    base.position.y = 0.175;
    g.add(base);
    const head = rbox(0.8, 0.85, 0.14, 0.14, stone);
    head.position.set(0, 0.6, -0.8);
    g.add(head);
    if (r() > 0.4) {
      const cross = new THREE.Group();
      cross.add(box(0.06, 0.4, 0.06, toon('#8a7f72')));
      const h = box(0.22, 0.06, 0.06, toon('#8a7f72'));
      h.position.y = 0.08;
      cross.add(h);
      cross.position.set(0, 1.18, -0.8);
      g.add(cross);
    }
  }
  return g;
}

export class CemeteryScene extends Scene {
  dayLabel() { return this.dawn ? { en: 'November 2 · dawn', es: '2 de noviembre · amanecer' } : { en: 'Night of November 1', es: 'Noche del 1 de noviembre' }; }

  async build() {
    await super.build();
    this.setLights('night', { shadowBox: 14 });
    this.sun.position.set(-10, 18, -14);
    const s = this.scene;
    const r = rng(31);
    const g = new THREE.Group();
    const ground = mesh(new THREE.PlaneGeometry(50, 40), toon('#3d5a3a', { rim: 0 }), { cast: false, receive: true });
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -8;
    g.add(ground);
    // paths between the graves
    for (const x of [-2.2, 2.2]) {
      const p = mesh(new THREE.PlaneGeometry(1.1, 30), toon('#ffffff', { map: cobbleTex('#9a8a76'), rim: 0 }), { cast: false, receive: true });
      p.material.map.repeat.set(1, 12);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.005, -8);
      g.add(p);
    }
    // the lake and its island beyond the wall
    const lake = mesh(new THREE.PlaneGeometry(120, 40), toon('#1c2a5a', { rim: 0 }), { cast: false });
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(0, -0.05, -42);
    g.add(lake);
    const island = sphere(4, toon('#24304a', { rim: 0 }), 16);
    island.scale.set(2, 0.6, 1.2);
    island.position.set(-14, 0, -48);
    g.add(island);
    // the cemetery wall with its arched gate
    const wallM = toon('#ffffff', { map: plasterTex('#d9c9b0', '#8a6a4a', 0.2), rim: 0 });
    for (const x of [-11, 11]) {
      const w = box(18, 1.6, 0.4, wallM);
      w.position.set(x, 0.8, -21);
      g.add(w);
    }
    for (const sx of [-1, 1]) {
      const w = box(0.4, 1.6, 26, wallM);
      w.position.set(sx * 19.5, 0.8, -8);
      g.add(w);
    }
    s.add(g);
    this.merge(g);
    // the gate arch dressed in marigolds
    const gate = makeProp('arco', { w: 3.4, h: 3.8, noOutline: true });
    gate.position.set(0, 0, -21);
    s.add(gate);
    // moon
    const moon = mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ color: '#fff4d6', fog: false }), { cast: false });
    moon.position.set(30, 38, -120);
    moon.lookAt(0, 0, 0);
    s.add(moon);
    const mglow = glowSprite('#b9c8ff', 26, 0.35);
    mglow.position.copy(moon.position);
    s.add(mglow);
    // island candles twinkling far away (like Janitzio)
    const isl = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const gs = glowSprite('#ffb34a', 0.6 + r() * 0.4, 0.8);
      gs.position.set(-14 + (r() - 0.5) * 12, 0.6 + r() * 1.6, -48 + (r() - 0.5) * 4);
      isl.add(gs);
    }
    s.add(isl);
    // trees
    for (const [x, z] of [[-12, -16], [13, -15], [-16, -4], [16, -2], [-8, -19], [7, -19]]) {
      const tr = tree({ kind: r() > 0.5 ? 'cypress' : 'laurel', h: 4 + r() * 1.5, seed: Math.round(x * 5 + z) });
      tr.position.set(x, 0, z);
      s.add(tr);
    }
    this.buildGraves(r);
    this.buildAbueloGrave();
    this.buildPeople();
    this.defineView('main', [2.2, 3.4, 7.2], [0, 0.6, -2.4], 50);
    this.defineView('grave', [1.9, 2.5, 4.7], [0, 0.5, 0.4], 46);
    this.defineView('sit', [3.2, 1.6, 4.4], [-0.8, 0.8, 0.8], 48);
    this.hideMonarch('gate', 1.8, 3.4, -20.8);
    this.hideMonarch('tree', -11.6, 2.2, -15.4);
  }

  buildGraves(r) {
    const s = this.scene;
    const spots = [];
    for (let row = 0; row < 5; row++) {
      for (let col = -3; col <= 3; col++) {
        if (row === 0 && Math.abs(col) <= 1) continue; // Abuelo's area
        if (Math.abs(col) === 1 && row > 0) continue; // paths
        spots.push([col * 2.9 + (r() - 0.5) * 0.3, -1.6 - row * 3.6 + (r() - 0.5) * 0.4]);
      }
    }
    this.flames = [];
    const allMarigolds = [];
    for (const [x, z] of spots) {
      const kind = r() > 0.82 ? 'chapel' : r() > 0.3 ? 'tomb' : 'mound';
      const tb = tombModel(kind, TOMB_COLORS[Math.floor(r() * TOMB_COLORS.length)], r);
      tb.position.set(x, 0, z);
      tb.rotation.y = (r() - 0.5) * 0.1;
      s.add(tb);
      // marigolds around the grave
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        allMarigolds.push([x + Math.cos(a) * 0.62, 0.38 + (kind === 'mound' ? -0.25 : 0), z + Math.sin(a) * 1.0, 0.07]);
      }
      for (let i = 0; i < 8; i++) allMarigolds.push([x + (r() - 0.5) * 0.6, kind === 'mound' ? 0.2 : 0.42, z + (r() - 0.5) * 1.3, 0.06]);
      // candles: glowing flames (cheap) on every grave
      const n = 3 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const fx = x + (r() - 0.5) * 0.8, fz = z + 0.6 + (r() - 0.5) * 0.5;
        const c = cyl(0.03, 0.03, 0.18 + r() * 0.12, toon('#fbf4e4'), 8);
        c.position.set(fx, 0.12, fz);
        s.add(c);
        const fl = glowSprite('#ffb04a', 0.45, 0.85);
        fl.position.set(fx, 0.32, fz);
        s.add(fl);
        this.flames.push({ s: fl, ph: r() * 10 });
      }
    }
    s.add(marigolds(allMarigolds, { seed: 5 }));
    // a few warm lights spread over the field of candles
    for (const [x, z] of [[-6, -3], [6, -3], [-6, -10], [6, -10], [0, -14]]) {
      const pl = new THREE.PointLight('#ffa84a', 5, 9, 1.6);
      pl.position.set(x, 1.2, z);
      s.add(pl);
    }
    this.updaters.push((dt, time) => {
      for (const f of this.flames) f.s.material.opacity = 0.65 + Math.sin(time * 9 + f.ph) * 0.12 + Math.sin(time * 23 + f.ph) * 0.06;
    });
    // papel picado over some graves
    for (const [x, z] of [[-5.8, -5.2], [5.8, -8.8]]) {
      const pp = papelString([x - 1.2, 1.9, z], [x + 1.2, 1.9, z], { sheetW: 0.3, sag: 0.2, seed: Math.round(x) });
      this.animateTree(pp);
      s.add(pp);
      for (const sx of [-1.25, 1.25]) {
        const pole = cyl(0.03, 0.03, 1.95, toon('#7a5236'), 6);
        pole.position.set(x + sx, 0.97, z);
        s.add(pole);
      }
    }
  }

  buildAbueloGrave() {
    const s = this.scene;
    const g = new THREE.Group();
    const stone = toon('#d8d2c8');
    const base = box(1.0, 0.36, 1.8, stone);
    base.position.y = 0.18;
    g.add(base);
    const head = rbox(0.9, 0.95, 0.16, 0.16, toon('#bdb5a8'));
    head.position.set(0, 0.62, -0.85);
    g.add(head);
    this.headstone = head;
    // the name, carved
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#d8d2c8'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#4a4038'; ctx.textAlign = 'center';
    ctx.font = "34px 'Lilita One', serif";
    ctx.fillText('ALBERTO', 128, 80);
    ctx.fillText('"BETO"', 128, 122);
    ctx.font = "bold 24px 'Nunito', serif";
    ctx.fillText('1948 – 2024', 128, 170);
    ctx.font = "bold 18px 'Nunito', serif";
    ctx.fillText('Siempre con nosotros', 128, 210);
    const plaque = mesh(new THREE.PlaneGeometry(0.7, 0.7), toon('#ffffff', { map: new THREE.CanvasTexture(cv), rim: 0 }), { cast: false });
    plaque.material.map.colorSpace = THREE.SRGBColorSpace;
    plaque.position.set(0, 0.64, -0.765);
    g.add(plaque);
    this.plaque = plaque;
    // dust/grime on the headstone, washed away later
    const grime = mesh(new THREE.PlaneGeometry(0.86, 0.9), new THREE.MeshBasicMaterial({ color: '#6a5a44', transparent: true, opacity: 0.55, depthWrite: false }), { cast: false });
    grime.position.set(0, 0.62, -0.76);
    grime.raycast = () => {};
    g.add(grime);
    this.grime = grime;
    // weeds and dry leaves to tidy
    this.weeds = [];
    const r = rng(17);
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const blade = mesh(new THREE.ConeGeometry(0.03, 0.28, 4), toon(k % 2 ? '#5c7a2e' : '#7a6a3a'));
        blade.position.set((r() - 0.5) * 0.12, 0.14, (r() - 0.5) * 0.12);
        blade.rotation.set((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6);
        w.add(blade);
      }
      const side = i % 2 ? 1 : -1;
      w.position.set(side * (0.55 + r() * 0.12), 0, -0.6 + Math.floor(i / 2) * 0.6);
      g.add(w);
      this.weeds.push(w);
    }
    for (let i = 0; i < 4; i++) {
      const leaf = mesh(new THREE.CircleGeometry(0.06, 6), toon('#8a6a3a'), { cast: false });
      leaf.rotation.x = -Math.PI / 2;
      leaf.position.set((r() - 0.5) * 0.7, 0.37, (r() - 0.5) * 1.4);
      g.add(leaf);
      this.weeds.push(leaf);
    }
    g.position.copy(GRAVE);
    s.add(g);
    this.grave = g;
    // the family's petate and their basket of food beside the grave
    const pt = petate({ w: 1.8, d: 1.2 });
    pt.position.set(-1.6, 0, 1.4);
    s.add(pt);
    // a warm light for our grave, brighter as candles are lit
    this.graveLight = new THREE.PointLight('#ffb35c', 1, 6, 1.4);
    this.graveLight.position.set(0, 1.4, 1.6);
    s.add(this.graveLight);
  }

  buildPeople() {
    // the family gathers on the left and behind, leaving the grave in view
    const fam = [['abuela', -1.5, 1.6, 0.9], ['mama', -2.3, 0.6, 1.2], ['papa', 1.45, -0.5, -0.9], ['nico', -1.1, 0.35, 1.0]];
    for (const [id, x, z, ry] of fam) this.addChar(id, x, z, ry);
    this.addChar('lupita', -0.95, 2.6, 0.6);
    this.addChar('chispa', -0.25, 3.0, 0.2).play('sit');
    // other families keeping vigil
    const groups = [[-5.8, -0.4], [5.8, -0.6], [-5.8, -7.6], [5.8, -4.2], [-2.9, -8.6], [2.9, -11.6]];
    let k = 0;
    this.quiet = [];
    for (const [x, z] of groups) {
      for (let i = 0; i < 2 + (k % 2); i++) {
        const c = this.addChar(300 + k * 11 + i, x - 0.6 + i * 0.7, z + 1.5, Math.PI + (i - 0.5) * 0.5);
        const key = `fam${k}_${i}`;
        this.chars[key] = c;
        delete this.chars[300 + k * 11 + i];
        c.play(i === 0 ? 'sit' : (k === 2 ? 'kneel' : 'idle'));
        c.look(new THREE.Vector3(x, 0.6, z));
        if (k === 2) this.quiet.push(c);
      }
      k++;
    }
    // musicians serenading a grave
    for (const [id, x, z] of [['musico1', 4.6, -2.4], ['musico3', 5.4, -2.2]]) {
      const m = this.addChar(id, x, z, -0.9);
      m.play('play-guitar');
      const gu = guitar();
      gu.scale.setScalar(1.25);
      gu.position.set(0.05, 0.62, 0.22);
      gu.rotation.z = -1.0;
      m.body.add(gu);
      this.musicians = [...(this.musicians || []), m];
    }
    // a neighbor who will kindly ask before taking a photo
    this.visitor = this.addChar(431, 4.3, 1.5, -2.2);
  }

  async enter() {
    const g = this.game;
    g.sound.music('cemetery');
    g.sound.setAmbient('night');
    this.talkable('lupita', { en: 'Lupita', es: 'Lupita' }, () => this.say([{ who: 'lupita', text: this.task ? this.task.hint : { en: 'It\'s so beautiful at night, with all the candles.', es: 'Qué bonito se ve de noche, con todas las velas.' } }]));
    this.talkable('abuela', { en: 'Abuela Rosa', es: 'Abuela Rosa' }, () => this.say([{ who: 'abuela', text: { en: 'Your Abuelo liked this spot. From here you can see the lake.', es: 'A tu abuelo le gustaba este lugar. Desde aquí se ve el lago.' } }]));
    for (const c of this.quiet) {
      this.hot(c.root, { en: 'A family praying', es: 'Una familia rezando' }, () => this.say([{ who: 'lupita', text: { en: 'That family is praying quietly. Let\'s give them their space.', es: 'Esa familia está rezando en silencio. Dejémosles su espacio.' } }]), { sparkle: false });
    }
    if (this.musicians?.[0]) this.hot(this.musicians[0].root, { en: 'Musicians', es: 'Músicos' }, () => this.say([{ who: 'lupita', text: { en: 'Some families bring musicians to play their loved one\'s favorite songs. It\'s like a serenade.', es: 'Algunas familias traen músicos para tocar las canciones favoritas de su ser querido. Es como una serenata.' } }]), { sparkle: false });
  }

  async afterEnter() {
    const g = this.game;
    if (g.has('panteon')) {
      await this.say([{ who: 'lupita', text: { en: 'Abuelo\'s grave looks so pretty with all the flowers.', es: 'La tumba del Abuelo se ve muy bonita con todas las flores.' } }]);
      this.decorateDone(true);
      return;
    }
    await this.say([
      { who: 'lupita', text: { en: 'This is our town\'s [[panteón]]. Tonight families stay here all night with their loved ones — it\'s called the [[velación]].', es: 'Este es el [[panteón]] del pueblo. Esta noche las familias se quedan aquí toda la noche con sus seres queridos: se llama la [[velación]].' } },
      { who: 'abuela', text: { en: 'First we tidy up your Abuelo\'s grave, like we do every year. Will you help us?', es: 'Primero arreglamos la tumba de tu abuelo, como cada año. ¿Nos ayudas?' } },
    ]);
    await this.view('grave', { back: false });
    await this.cleanStep();
    await this.washStep();
    await this.flowerStep();
    await this.candleStep();
    await this.visitStep();
    await this.vigil();
  }

  // ---------------------------------------------------------------- tasks
  cleanStep() {
    this.task = { hint: { en: 'Pull the weeds and pick up the dry leaves — click each one!', es: 'Quita la hierba y las hojas secas: ¡haz clic en cada una!' } };
    this.game.ui.setGoal(this.task.hint);
    return new Promise((resolve) => {
      let left = this.weeds.length;
      for (const w of this.weeds) {
        this.hot(w, { en: 'Tidy up', es: 'Limpiar' }, async () => {
          this.engine.removeHotspot(w);
          this.game.sfx('brush');
          const s0 = w.scale.clone();
          await this.engine.tween(0.3, (k) => { w.scale.copy(s0).multiplyScalar(1 - k); w.position.y += 0.01; });
          w.visible = false;
          left--;
          if (left <= 0) resolve();
        }, { nested: true, sparkle: true });
      }
    });
  }

  washStep() {
    const g = this.game;
    this.task = { hint: { en: 'Wash the headstone: drag back and forth over it with the cloth!', es: 'Lava la lápida: ¡arrastra de un lado a otro con el trapo!' } };
    g.ui.setGoal(this.task.hint);
    return new Promise((resolve) => {
      this.washing = { amount: 0, last: null, resolve };
    });
  }

  async flowerStep() {
    const g = this.game;
    this.washing = null;
    g.sfx('success');
    await this.say([{ who: 'abuela', text: { en: '¡Qué limpia quedó! Now the flowers. Put [[cempasúchil]] all around — click the spots.', es: '¡Qué limpia quedó! Ahora las flores. Pon [[cempasúchil]] alrededor: haz clic en los lugares.' } }]);
    this.task = { hint: { en: 'Put marigolds around the grave — click the glowing spots.', es: 'Pon cempasúchil alrededor de la tumba: haz clic en los lugares que brillan.' } };
    g.ui.setGoal(this.task.hint);
    const spots = [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.2], [0.6, 0.2], [-0.6, 0.85], [0.6, 0.85], [0, 1.15]];
    await new Promise((resolve) => {
      let left = spots.length;
      for (const [x, z] of spots) {
        const ring = mesh(new THREE.RingGeometry(0.1, 0.16, 20), new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.8, depthWrite: false }), { cast: false });
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.02, z);
        this.grave.add(ring);
        const pick = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10), new THREE.MeshBasicMaterial({ visible: false }), { cast: false });
        pick.position.set(x, 0.15, z);
        this.grave.add(pick);
        this.hot(pick, { en: 'Add marigolds', es: 'Poner cempasúchil' }, async () => {
          this.engine.removeHotspot(pick);
          this.grave.remove(ring);
          const b = marigoldBunch(16, 0.2, Math.round(x * 10 + z * 7) + 40, 0.065);
          b.position.set(x, 0.0, z);
          this.grave.add(b);
          g.sfx('petal');
          left--;
          if (left <= 0) resolve();
        }, { nested: true, sparkle: false });
      }
    });
    // a cross of petals on top of the grave
    const cross = [];
    for (let i = 0; i < 12; i++) cross.push([0, 0.37, -0.6 + i * 0.12, 0.05]);
    for (let i = -3; i <= 3; i++) if (i) cross.push([i * 0.11, 0.37, -0.2, 0.05]);
    this.grave.add(marigolds(cross, { seed: 61 }));
    g.sfx('success');
  }

  async candleStep() {
    const g = this.game;
    await this.say([{ who: 'papa', text: { en: 'And now the candles. Click each one to light it.', es: 'Y ahora las velas. Haz clic en cada una para encenderla.' } }]);
    this.task = { hint: { en: 'Light the candles on Abuelo\'s grave.', es: 'Enciende las velas en la tumba del Abuelo.' } };
    g.ui.setGoal(this.task.hint);
    const places = [[-0.38, 1.02], [0.38, 1.02], [-0.38, -0.95], [0.38, -0.95], [0, 1.3]];
    this.myCandles = [];
    await new Promise((resolve) => {
      let left = places.length;
      places.forEach(([x, z], i) => {
        const c = i % 2 ? veladora({ glass: PAL.purple }) : cirio({ h: 0.3 });
        c.position.set(x, z < -0.5 ? 0.36 : 0, z);
        this.grave.add(c);
        this.myCandles.push(c);
        this.hot(c, { en: 'Light the candle', es: 'Encender la vela' }, async () => {
          if (c.userData.lit) return;
          this.engine.removeHotspot(c);
          g.sfx('strike');
          c.userData.light(true);
          this.animateTree(c);
          this.graveLight.intensity += 1.6;
          left--;
          if (left <= 0) resolve();
        }, { nested: true });
      });
    });
    await g.learn('panteon');
  }

  async visitStep() {
    const g = this.game;
    g.ui.setGoal(null);
    this.task = null;
    // a neighbor asks first — that's how it's done
    const v = this.visitor;
    await v.walkTo(1.8, 2.8, 0.8);
    v.look(this.chars.abuela.root.position.clone().add(new THREE.Vector3(0, 1, 0)));
    await this.say([
      { who: null, text: { en: 'A neighbor comes over: "Buenas noches. Your family\'s grave is so beautiful — may I take a photo?"', es: 'Se acerca una vecina: "Buenas noches. Qué bonita está la tumba de su familia. ¿Me permite tomar una foto?"' } },
      { who: 'abuela', text: { en: 'Thank you for asking, mija. Yes, go ahead.', es: 'Gracias por preguntar, mija. Sí, adelante.' }, emote: 'happy' },
      { who: 'lupita', text: { en: 'Asking first is good manners at the panteón — some families are praying or remembering quietly.', es: 'Preguntar antes es de buena educación en el panteón: algunas familias están rezando o recordando en silencio.' } },
    ]);
    g.sfx('chime');
    await this.say([{ who: null, text: { en: 'She smiles and offers a basket: "¿Gustan unos tamales? We made too many!"', es: 'Ella sonríe y ofrece una canasta: "¿Gustan unos tamalitos? ¡Hicimos de más!"' } }]);
    v.walkTo(4.4, 1.2, 0.8);
  }

  async vigil() {
    const g = this.game;
    await this.view('sit', { back: false });
    for (const id of ['lupita', 'mama', 'papa', 'nico']) this.chars[id]?.play('sit');
    this.chars.abuela.play('sit');
    g.sound.music('ofrenda', true);
    await this.say([
      { who: 'abuela', text: { en: 'The first time your Abuelo saw me, I was selling flowers at the market. He bought every marigold I had — just to talk to me!', es: 'La primera vez que tu abuelo me vio, yo vendía flores en el mercado. ¡Me compró todo el cempasúchil solo para platicar conmigo!' }, emote: 'happy' },
      { who: 'papa', text: { en: 'He taught me to fix bicycles. He always whistled while he worked — always out of tune.', es: 'Él me enseñó a arreglar bicicletas. Siempre chiflaba mientras trabajaba… siempre desafinado.' }, emote: 'laugh' },
      { who: 'mama', text: { en: 'He called every one of us "mi rey" or "mi reina". Even the dog!', es: 'A todos nos decía "mi rey" o "mi reina". ¡Hasta al perro!' }, emote: 'laugh' },
      { who: 'nico', text: { en: 'I don\'t remember him much…', es: 'Yo no me acuerdo mucho de él…' }, emote: 'sad' },
      { who: 'abuela', text: { en: 'That\'s why we tell the stories, mijo. So you can know him too.', es: 'Por eso contamos las historias, mijo. Para que tú también lo conozcas.' } },
    ]);
    // the gentle sign: a warm breeze, the flames lean toward the grave, petals rise
    const swirl = new THREE.Group();
    const pts = [];
    for (let i = 0; i < 30; i++) {
      const p = mesh(new THREE.CircleGeometry(0.03, 5), toon(i % 2 ? '#ff9a0d' : '#ffc21a', { side: THREE.DoubleSide, rim: 0 }), { cast: false });
      p.userData.ph = Math.random() * 6;
      swirl.add(p);
      pts.push(p);
    }
    swirl.position.set(0, 0.4, 0.6);
    this.scene.add(swirl);
    let k0 = 0;
    this.updaters.push((dt, time) => {
      k0 += dt;
      for (const p of pts) {
        const a = time * 0.8 + p.userData.ph;
        const h = ((k0 * 0.25 + p.userData.ph / 6) % 1) * 2.4;
        p.position.set(Math.cos(a) * (0.5 + h * 0.2), h, Math.sin(a) * (0.5 + h * 0.2));
        p.rotation.set(a, a * 0.7, 0);
      }
      for (const c of this.myCandles || []) {
        const f = c.userData.flame;
        if (f) f.rotation.z = -0.35 + Math.sin(time * 2) * 0.05;
      }
    });
    g.sfx('petal');
    this.chars.chispa.play('happy', { dur: 6 });
    await this.say([
      { who: 'lupita', text: { en: 'Look — a warm breeze… the candle flames are all leaning toward Abuelo\'s grave.', es: 'Mira… una brisa tibia. Las llamas de las velas se inclinan hacia la tumba del Abuelo.' }, emote: 'surprised' },
      { who: 'abuela', text: { en: 'Some people say that\'s how you know they came to visit. Whatever you believe, mija, he lives in our stories.', es: 'Hay quien dice que así se sabe que vinieron de visita. Creas lo que creas, mija, él vive en nuestras historias.' } },
      { who: 'lupita', text: { en: 'Te queremos, Abuelo. We love you.', es: 'Te queremos, Abuelo.' } },
    ]);
    await g.learn('velacion');
    // dawn
    g.flag('panteon');
    g.addPetals(5);
    await this.say([{ who: 'lupita', text: { en: 'We stayed until the sky turned pink. Tomorrow is November 2. Let\'s go home.', es: 'Nos quedamos hasta que el cielo se puso rosa. Ya es 2 de noviembre. Vamos a casa.' } }]);
    g.go('home', { dayCard: { title: { en: 'November 2', es: '2 de noviembre' }, sub: { en: 'Día de los Fieles Difuntos', es: 'Día de los Fieles Difuntos' } } });
  }

  decorateDone() {
    for (const w of this.weeds) w.visible = false;
    this.grime.visible = false;
    const spots = [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.2], [0.6, 0.2], [-0.6, 0.85], [0.6, 0.85], [0, 1.15]];
    for (const [x, z] of spots) {
      const b = marigoldBunch(16, 0.2, Math.round(x * 10 + z * 7) + 40, 0.065);
      b.position.set(x, 0, z);
      this.grave.add(b);
    }
    for (const [x, z] of [[-0.38, 1.02], [0.38, 1.02], [0, 1.3]]) {
      const c = cirio({ h: 0.3, lit: true });
      c.position.set(x, 0, z);
      this.grave.add(c);
      this.animateTree(c);
    }
    this.graveLight.intensity = 6;
  }

  onPointerDown() { this.pressing = true; if (this.washing) this.washing.last = null; }

  onPointerUp() { this.pressing = false; }

  onPointerMove() {
    const w = this.washing;
    if (!w || !this.pressing) return;
    const hits = this.engine.raycastObjects([this.headstone]);
    if (!hits.length) return;
    const p = hits[0].point;
    if (w.last) w.amount += p.distanceTo(w.last);
    w.last = p.clone();
    this.grime.material.opacity = Math.max(0, 0.55 * (1 - w.amount / 3.2));
    if (Math.random() < 0.15) this.game.sfx('brush');
    if (w.amount >= 3.2) {
      this.grime.visible = false;
      const r = w.resolve;
      this.washing = null;
      r();
    }
  }

  onTap() { return !!this.washing; }

  goalOverride() {
    if (this.task) return this.task.hint;
    return this.game.has('panteon') ? null : false;
  }
}
