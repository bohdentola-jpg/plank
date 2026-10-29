// El mercado: flowers, candles and copal, fruit, sugar skulls, tissue paper and
// clay — everything on Abuela's list, with a vendor to explain each one.
import * as THREE from 'three';
import { Scene } from './base.js';
import { toon, box, mesh, cyl, sphere, rng, PAL } from '../toon.js';
import { stall, crate, bucket, basket, house, cobbleTex, papelString, marigoldBunch, church } from '../world.js';
import { veladora, cirio, sugarSkull, skullCanvas, cockscombVase, nubeVase, xoloFigure, catrinaFigure, copalBurner, sugarcane, calabazaEnTacha } from '../props.js';
import { MARKET_LIST } from '../content/items.js';

const LANE_W = 6.2;

export class MarketScene extends Scene {
  dayLabel() { return { en: 'October 31 · late morning', es: '31 de octubre · media mañana' }; }

  async build() {
    await super.build();
    this.setLights('day', { shadowBox: 16 });
    this.sun.position.set(8, 16, 9);
    this.addHills({ color: '#7fae6a', far: '#a3c0d9' });
    const g = new THREE.Group();
    const ground = mesh(new THREE.PlaneGeometry(LANE_W + 14, 46), toon('#ffffff', { map: cobbleTex('#cbb69c'), rim: 0 }), { cast: false, receive: true });
    ground.material.map.repeat.set(6, 14);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -10;
    g.add(ground);
    // houses behind the stalls
    const walls = [[PAL.pinkWall, '#b84a7c'], [PAL.yellowWall, '#c4562e'], [PAL.blueWall, '#2f5f9e'], [PAL.greenWall, '#3b7a4a'], ['#f0b48c', '#9a4a2a'], ['#c9a0ff', '#6a3fa0']];
    for (let i = 0; i < 6; i++) {
      for (const sx of [-1, 1]) {
        const [c, b] = walls[(i * 2 + (sx > 0 ? 1 : 0)) % walls.length];
        const h = house({ w: 5, h: 3.4 + (i % 3) * 0.5, d: 3, color: c, band: b, seed: 60 + i * 2 + (sx > 0 ? 1 : 0), roof: i % 2 ? 'tile' : 'flat', bugambilia: (i + (sx > 0 ? 1 : 0)) % 3 === 0 });
        h.position.set(sx * (LANE_W / 2 + 4.6), 0, 3 - i * 5.2);
        h.rotation.y = -sx * Math.PI / 2;
        g.add(h);
      }
    }
    const ch = church({ color: '#f5c08f' });
    ch.position.set(0, 0, -30);
    ch.scale.setScalar(1.1);
    g.add(ch);
    this.scene.add(g);
    this.merge(g);
    // papel picado over the lane
    for (let k = 0; k < 5; k++) {
      const s = papelString([-(LANE_W / 2 + 0.6), 3.7, 0.6 - k * 3.6], [LANE_W / 2 + 0.6, 3.8, 0.1 - k * 3.6], { seed: 20 + k, sheetW: 0.4, sag: 0.35 });
      s.userData.dynamic = true;
      this.animateTree(s);
      this.scene.add(s);
    }
    this.buildStalls();
    this.buildPeople();
    this.defineView('main', [0, 2.15, 7.6], [0, 1.0, -5.5], 46);
    this.defineView('flores', [0.6, 1.65, 2.6], [-2.6, 1.0, 0.2], 44);
    this.defineView('velas', [-0.6, 1.65, 2.6], [2.6, 1.05, 0.2], 44);
    this.defineView('fruta', [0.6, 1.6, -2.0], [-2.6, 1.0, -4.4], 44);
    this.defineView('dulces', [-0.6, 1.6, -2.0], [2.6, 1.05, -4.4], 44);
    this.defineView('papel', [0.6, 1.6, -6.6], [-2.6, 1.1, -9.0], 44);
    this.defineView('barro', [-0.6, 1.6, -6.6], [2.6, 1.0, -9.0], 44);
    this.hideMonarch('awning', 2.6, 2.75, -9.2);
    this.hideMonarch('crate', -3.3, 0.5, -2.6);
  }

  // place a stall on one side of the lane at z; returns a group in "stall space"
  // where +z is the customer side and the table top is at userData.tableY
  placeStall(side, z, opts) {
    const st = stall({ w: 2.6, d: 1.4, ...opts });
    st.position.set(side * (LANE_W / 2 - 0.4), 0, z);
    st.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(st);
    return st;
  }

  onTable(st, obj, x, z = 0.1, s = 1) {
    obj.position.set(x, st.userData.tableY, st.userData.tableZ + z);
    obj.scale.setScalar(s);
    st.add(obj);
    return obj;
  }

  buildStalls() {
    // 1. Doña Chela — flowers
    const flores = this.placeStall(-1, 0.2, { tarp: PAL.rosa });
    const r = rng(3);
    for (let i = 0; i < 5; i++) {
      const b = bucket(0.18, 0.3, ['#4a8fc9', '#d8293b', '#3e9b4f'][i % 3]);
      b.position.set(-1.0 + i * 0.5, flores.userData.tableY, flores.userData.tableZ + 0.05);
      flores.add(b);
      const kind = i === 2 ? 'terciopelo' : i === 4 ? 'nube' : 'cempasuchil';
      if (kind === 'cempasuchil') {
        const bunch = marigoldBunch(26, 0.2, 10 + i, 0.06);
        bunch.position.set(b.position.x, b.position.y + 0.34, b.position.z);
        flores.add(bunch);
      } else {
        const v = kind === 'terciopelo' ? cockscombVase() : nubeVase();
        v.scale.setScalar(1.6);
        v.position.set(b.position.x, b.position.y + 0.02, b.position.z);
        flores.add(v);
      }
    }
    // big bundles on the ground in front
    for (let i = 0; i < 4; i++) {
      const bunch = marigoldBunch(30, 0.24, 30 + i, 0.065);
      bunch.position.set(-0.9 + i * 0.6, 0.12, 0.95 + r() * 0.2);
      flores.add(bunch);
      const stems = cyl(0.12, 0.1, 0.25, toon('#4a8a3c'), 8);
      stems.position.set(-0.9 + i * 0.6, 0.12, 0.95);
      flores.add(stems);
    }
    this.flores = flores;
    // 2. Don Tomás — candles & copal
    const velas = this.placeStall(1, 0.2, { tarp: PAL.cobalt, stripes: '#5f8ff0' });
    for (let i = 0; i < 9; i++) {
      const c = veladora({ glass: [PAL.red, PAL.purple, '#f7e4c8', PAL.marigold, PAL.turquoise][i % 5] });
      this.onTable(velas, c, -1.05 + (i % 5) * 0.22, i < 5 ? 0.25 : -0.05, 1.3);
    }
    // cirios hanging from a cord, the classic market display
    for (let i = 0; i < 7; i++) {
      const c = cirio({ h: 0.5 });
      c.children[0].visible = false;
      c.rotation.x = Math.PI;
      c.position.set(-0.9 + i * 0.3, 2.2, -0.35);
      velas.add(c);
    }
    const cord = cyl(0.008, 0.008, 2.2, toon('#efe6d6'), 4);
    cord.rotation.z = Math.PI / 2;
    cord.position.set(0, 2.25, -0.35);
    velas.add(cord);
    for (let i = 0; i < 2; i++) {
      const bk = basket(0.2, 0.14);
      this.onTable(velas, bk, 0.55 + i * 0.45, 0.05);
      for (let k = 0; k < 9; k++) {
        const lump = sphere(0.035, toon('#f4ecd2'), 6);
        lump.position.set(bk.position.x + (r() - 0.5) * 0.2, bk.position.y + 0.12 + r() * 0.04, bk.position.z + (r() - 0.5) * 0.2);
        velas.add(lump);
      }
    }
    const burner = copalBurner({});
    this.onTable(velas, burner, 0.95, 0.32, 1.2);
    this.velas = velas;
    // 3. fruit
    const fruta = this.placeStall(-1, -4.4, { tarp: PAL.lime, stripes: '#b6dc6a' });
    const fruitCols = ['#ff8c1a', '#ffb02e', '#f5c542', '#9cc34a', '#ffd23f'];
    for (let i = 0; i < 4; i++) {
      const cr = crate(0.5, 0.18, 0.4, '#c79a62');
      this.onTable(fruta, cr, -0.9 + i * 0.6, 0.05);
      const spots = [];
      for (let k = 0; k < 14; k++) spots.push([cr.position.x + (r() - 0.5) * 0.38, cr.position.y + 0.2 + r() * 0.06, cr.position.z + (r() - 0.5) * 0.28, i === 1 ? 0.028 : 0.042]);
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), toon(fruitCols[i]), spots.length);
      const m4 = new THREE.Matrix4();
      spots.forEach(([x, y, z, s], k) => { m4.makeScale(s, s, s).setPosition(x, y, z); im.setMatrixAt(k, m4); });
      im.castShadow = true;
      fruta.add(im);
    }
    const cane = sugarcane();
    cane.scale.setScalar(2.2);
    cane.position.set(1.15, 0, 0.75);
    fruta.add(cane);
    for (let i = 0; i < 3; i++) {
      const c2 = crate(0.5, 0.3, 0.4, '#b58a52');
      c2.position.set(-0.7 + i * 0.55, 0, 0.9);
      fruta.add(c2);
    }
    this.fruta = fruta;
    // 4. Doña Mago — sugar skulls & sweets
    const dulces = this.placeStall(1, -4.4, { tarp: PAL.rosa, stripes: '#ff7ac0' });
    const shelf = box(2.3, 0.05, 0.4, toon('#ffffff', { rim: 0 }));
    shelf.position.set(0, 1.35, -0.35);
    dulces.add(shelf);
    const decorSets = [
      { eyes: PAL.turquoise, nose: PAL.rosa, flowers: PAL.marigold, swirls: PAL.purple },
      { eyes: PAL.rosa, nose: PAL.gold, flowers: PAL.lime, swirls: PAL.cobalt },
      { eyes: PAL.purple, nose: PAL.red, flowers: PAL.turquoise, swirls: PAL.rosa },
    ];
    for (let i = 0; i < 8; i++) {
      const sk = sugarSkull({ canvas: skullCanvas(decorSets[i % 3]) });
      sk.scale.setScalar(i % 3 === 0 ? 1.6 : 1.2);
      sk.position.set(-1.0 + i * 0.28, 1.38, -0.35);
      dulces.add(sk);
    }
    for (let i = 0; i < 6; i++) {
      const sk = sugarSkull({ plain: true });
      this.onTable(dulces, sk, -1.05 + i * 0.2, 0.25, 1.1);
    }
    const choc = sugarSkull({ canvas: skullCanvas({ eyes: '#3a1a10', nose: '#5a2a18', flowers: '#7a3a20', swirls: '#2a1008' }) });
    choc.traverse((o) => { if (o.isMesh && o.material?.color) o.material = toon('#6b3a22'); });
    this.onTable(dulces, choc, 0.35, 0.0, 1.4);
    const calab = calabazaEnTacha();
    this.onTable(dulces, calab, 0.75, 0.05, 1.5);
    const tab = cyl(0.05, 0.05, 0.03, toon('#5a2d1a'), 8);
    for (let i = 0; i < 4; i++) {
      const tb = tab.clone();
      tb.position.set(1.0, dulces.userData.tableY + 0.015 + i * 0.03, dulces.userData.tableZ + 0.15);
      dulces.add(tb);
    }
    this.dulces = dulces;
    // 5. paper
    const papel = this.placeStall(-1, -9.0, { tarp: PAL.turquoise, stripes: '#6fd6cf' });
    const pcols = [PAL.rosa, PAL.marigold, PAL.turquoise, PAL.purple, PAL.lime, PAL.red, PAL.gold, PAL.cobalt];
    pcols.forEach((c, i) => {
      const stack = box(0.26, 0.08 + (i % 3) * 0.03, 0.34, toon(c));
      this.onTable(papel, stack, -1.05 + i * 0.3, 0.05);
    });
    const banner = papelString([-1.25, 2.0, -0.3], [1.25, 2.0, -0.3], { seed: 4, sheetW: 0.3, sag: 0.12 });
    papel.add(banner);
    this.animateTree(banner);
    this.papel = papel;
    // 6. pottery
    const barro = this.placeStall(1, -9.0, { tarp: PAL.marigold, stripes: '#ffc266' });
    for (let i = 0; i < 6; i++) {
      const pot = sphere(0.13 + (i % 3) * 0.03, toon(['#b4673c', PAL.terracotta, '#9a4a2a'][i % 3]), 14);
      pot.scale.y = 0.85;
      this.onTable(barro, pot, -1.0 + i * 0.4, 0.05).position.y += 0.12;
    }
    const xo = xoloFigure();
    this.onTable(barro, xo, 0.2, 0.3, 1.5);
    const xo2 = xoloFigure();
    this.onTable(barro, xo2, -0.4, 0.32, 1.2);
    const cat = catrinaFigure();
    this.onTable(barro, cat, 0.8, 0.3, 1.4);
    for (let i = 0; i < 4; i++) {
      const sb = copalBurner({});
      sb.position.set(-0.9 + i * 0.5, 0, 0.95);
      sb.scale.setScalar(1.6);
      barro.add(sb);
    }
    this.barro = barro;
    for (const st of [flores, velas, fruta, dulces, papel, barro]) this.animateTree(st);
  }

  buildPeople() {
    const vendor = (id, st, x = 0) => {
      const c = this.addChar(id, 0, 0, 0);
      st.add(c.root);
      c.root.position.set(x, 0, -0.45);
      c.root.rotation.y = 0;
      return c;
    };
    vendor('chela', this.flores, 0.3);
    vendor('tomas', this.velas, -0.2);
    vendor('mago', this.dulces, 0.2);
    this.addChar('lupita', -1.75, 2.6, 0.55);
    const ch = this.addChar('chispa', -1.0, 3.1, 0.2);
    ch.play('sit');
    // shoppers strolling up and down the lane
    this.shoppers = [];
    for (let i = 0; i < 5; i++) {
      const c = this.addChar(100 + i * 7, (i % 2 ? 1 : -1) * 0.9, -2 - i * 2.5, 0);
      this.chars[`shopper${i}`] = c;
      delete this.chars[100 + i * 7];
      this.shoppers.push(c);
      const loop = async () => {
        while (!this.gone && c.root.parent) {
          await c.walkTo((Math.random() - 0.5) * 2.2, -1.5 - Math.random() * 10, 0.6 + Math.random() * 0.3);
          c.play('idle');
          c.faceTo(c.root.position.x > 0 ? 6 : -6, c.root.position.z);
          await this.engine.wait(2 + Math.random() * 4);
        }
      };
      loop();
    }
  }

  async enter() {
    const g = this.game;
    g.sound.music('market');
    g.sound.setAmbient('crowd');
    const H = (obj, label, fn, opts) => this.hot(obj, label, fn, opts);
    this.talkable('chela', { en: 'Doña Chela\'s flowers', es: 'Las flores de Doña Chela' }, () => this.chela());
    H(this.flores, { en: 'Marigolds & flowers', es: 'Cempasúchil y flores' }, () => this.chela(), { sparkle: false });
    this.talkable('tomas', { en: 'Don Tomás: candles & copal', es: 'Don Tomás: velas y copal' }, () => this.tomas());
    H(this.velas, { en: 'Candles & copal', es: 'Velas y copal' }, () => this.tomas(), { sparkle: false });
    H(this.fruta, { en: 'Fruit stand', es: 'Puesto de fruta' }, () => this.fruit());
    this.talkable('mago', { en: 'Doña Mago\'s sweets', es: 'Los dulces de Doña Mago' }, () => this.mago());
    H(this.dulces, { en: 'Sugar skulls & sweets', es: 'Calaveritas y dulces' }, () => this.mago(), { sparkle: false });
    H(this.papel, { en: 'Paper stand', es: 'Puesto de papel' }, () => this.paper());
    H(this.barro, { en: 'Clay & pottery', es: 'Barro y alfarería' }, () => this.pottery());
    this.talkable('lupita', { en: 'Lupita', es: 'Lupita' }, () => this.lupita());
    this.talkable('chispa', { en: 'Chispa', es: 'Chispa' }, async () => { this.chars.chispa.play('jump', { restart: true }); g.sfx('bark'); });
  }

  async afterEnter() {
    if (!this.game.has('marketHello')) {
      this.game.flag('marketHello');
      await this.say([
        { who: 'lupita', emote: 'happy', text: { en: 'The [[mercado]] is so full today! Everyone is shopping for their ofrendas.', es: '¡El [[mercado]] está llenísimo! Todos compran para sus ofrendas.' } },
        { who: 'lupita', text: { en: 'Click on the stalls to find everything on Abuela\'s list.', es: 'Haz clic en los puestos para encontrar todo lo de la lista de Abuela.' } },
      ]);
    }
  }

  async done(from) {
    const g = this.game;
    g.refreshHud();
    const have = MARKET_LIST.every((id) => g.hasItem(id) || (id === 'calavera-blanca' && g.hasItem('calavera')) || (id === 'papel-china' && g.hasItem('papel')));
    if (have && !g.has('marketDone')) {
      g.flag('marketDone');
      await this.backToMain();
      g.sfx('success');
      await this.say([{ who: 'lupita', emote: 'happy', text: { en: '¡Listo! We have everything from the market. Let\'s open the **Map** and go to the bakery or to Tía Lucía\'s!', es: '¡Listo! Ya tenemos todo lo del mercado. ¡Abramos el **Mapa** y vamos a la panadería o con Tía Lucía!' } }]);
      g.ui.pulse('#btn-map', true);
    }
    void from;
  }

  async chela() {
    const g = this.game;
    await this.view('flores');
    this.chars.chela.look(new THREE.Vector3(0.6, 1.6, 2.6));
    if (!g.hasItem('cempasuchil')) {
      await this.say([
        { who: 'chela', emote: 'happy', text: { en: '¡Buenos días, Lupita! For your Abuelo\'s ofrenda? Smell these [[cempasúchil]]!', es: '¡Buenos días, Lupita! ¿Para la ofrenda de tu abuelo? ¡Huele este [[cempasúchil]]!' } },
        { who: 'chela', text: { en: 'My family grows them. The name means "twenty flower" in Nahuatl. They say their color and smell show the souls the way home.', es: 'Mi familia los cultiva. El nombre significa "veinte flor" en náhuatl. Dicen que su color y su olor les enseñan el camino a las almas.' } },
      ]);
      await g.give('cempasuchil');
      await g.learn('cempasuchil');
      const more = await this.say([{
        who: 'chela', text: { en: 'Do you want some [[terciopelo]] too? It\'s soft like velvet.', es: '¿Quieres también [[terciopelo]]? Es suavecito como el terciopelo.' },
        choices: [{ label: { en: 'Yes, please!', es: '¡Sí, por favor!' }, value: 1 }, { label: { en: 'No, thank you', es: 'No, gracias' }, value: 0 }],
      }]);
      if (more) { await g.give('terciopelo'); await g.learn('terciopelo'); }
      await this.say([{ who: 'chela', text: { en: 'And remember to scatter petals from your door to the ofrenda!', es: '¡Y no se te olvide hacer un caminito de pétalos de la puerta a la ofrenda!' } }]);
    } else {
      await this.say([{ who: 'chela', text: { en: 'Give my love to your Abuela, mija!', es: '¡Saludos a tu abuela, mija!' }, emote: 'happy' }]);
    }
    await this.done('flores');
  }

  async tomas() {
    const g = this.game;
    await this.view('velas');
    this.chars.tomas.look(new THREE.Vector3(-0.6, 1.6, 2.6));
    if (!g.hasItem('velas')) {
      await this.say([
        { who: 'tomas', text: { en: '¡Buen día! [[veladoras|veladora]] for the ofrenda? Their light guides the souls home.', es: '¡Buen día! ¿[[veladoras|veladora]] para la ofrenda? Su luz guía a las almas a casa.' } },
        { who: 'tomas', text: { en: 'In some families, each candle is for one person they remember. Four candles is a good number — some put them in a cross, for the four directions.', es: 'En algunas familias cada vela es por una persona que recuerdan. Cuatro es buen número: algunos las ponen en cruz, por los cuatro rumbos.' } },
      ]);
      await g.give('velas');
      await g.learn('velas');
    }
    if (!g.hasItem('copal')) {
      await this.say([
        { who: 'tomas', text: { en: 'And this is [[copal]], tree resin. You burn it in a clay [[sahumador]]. Smell it — like pine and lemon!', es: 'Y esto es [[copal]], resina de árbol. Se quema en un [[sahumador]] de barro. Huélelo: ¡como a pino y limón!' } },
      ]);
      await g.give('copal');
      await g.learn('copal');
    } else {
      await this.say([{ who: 'tomas', text: { en: 'Light them carefully, ¿eh? Always with a grown-up.', es: 'Enciéndanlas con cuidado, ¿eh? Siempre con un adulto.' } }]);
    }
    await this.done('velas');
  }

  async fruit() {
    const g = this.game;
    await this.view('fruta');
    if (!g.hasItem('fruta')) {
      await this.say([
        { who: 'lupita', text: { en: 'Oranges, mandarins, guavas, [[tejocote|tejocote]]s and a stick of [[caña]]! Abuelo loved peeling oranges for me.', es: '¡Naranjas, mandarinas, guayabas, [[tejocote]]s y un trozo de [[caña]]! Al Abuelo le encantaba pelarme naranjas.' } },
      ]);
      await g.give('fruta');
      await g.learn('fruta');
    } else {
      await this.say([{ who: 'lupita', text: { en: 'Mmm, the whole market smells like guavas.', es: 'Mmm, todo el mercado huele a guayaba.' } }]);
    }
    await this.done('fruta');
  }

  async mago() {
    const g = this.game;
    await this.view('dulces');
    this.chars.mago.look(new THREE.Vector3(-0.6, 1.6, -2.0));
    if (!g.hasItem('calavera-blanca') && !g.hasItem('calavera')) {
      await this.say([
        { who: 'mago', emote: 'happy', text: { en: '¡Calaveritas de azúcar! These are made with [[alfeñique]], a sugar paste. My family brings them from [[Toluca]], where there\'s a whole fair of them.', es: '¡Calaveritas de azúcar! Se hacen con [[alfeñique]], una pasta de azúcar. Mi familia las trae de [[Toluca]], donde hay toda una feria.' } },
        { who: 'mago', text: { en: 'Take a plain one — you can decorate it at Tía Lucía\'s and write your Abuelo\'s name on the forehead.', es: 'Llévate una sin decorar: la puedes adornar con Tía Lucía y escribir el nombre de tu abuelo en la frente.' } },
      ]);
      await g.give('calavera-blanca');
      await g.learn('calavera');
      const c = await this.say([{
        who: 'mago', text: { en: 'I also have Mexican chocolate, for hot chocolate, and candied pumpkin — [[calabaza en tacha]].', es: 'También tengo chocolate de mesa, para el chocolate caliente, y [[calabaza en tacha]].' },
        choices: [{ label: { en: 'Chocolate for Abuelo!', es: '¡Chocolate para el Abuelo!' }, value: 'choc' }, { label: { en: 'What\'s calabaza en tacha?', es: '¿Qué es la calabaza en tacha?' }, value: 'cal' }, { label: { en: 'That\'s all, gracias', es: 'Es todo, gracias' }, value: 'no' }],
      }]);
      if (c === 'choc') { await g.give('chocolate'); await g.learn('bebidas'); }
      if (c === 'cal') await g.learn('calabaza');
    } else {
      await this.say([{ who: 'mago', text: { en: 'In my town, kids give each other sugar skulls with their friends\' names on them. ¡Qué rico!', es: 'En mi pueblo, los niños se regalan calaveritas con el nombre de sus amigos. ¡Qué rico!' } }]);
      if (!g.knows('calabaza')) await g.learn('calabaza');
    }
    await this.done('dulces');
  }

  async paper() {
    const g = this.game;
    await this.view('papel');
    if (!g.hasItem('papel-china') && !g.hasItem('papel')) {
      await this.say([
        { who: 'lupita', text: { en: 'Stacks of [[papel de China]] — tissue paper in every color! Tía Lucía is going to teach us to make [[papel picado]] the way they do in her hometown.', es: '¡Pilas de [[papel de China]] de todos los colores! Tía Lucía nos va a enseñar a hacer [[papel picado]] como en su pueblo.' } },
      ]);
      await g.give('papel-china');
    } else {
      await this.say([{ who: 'lupita', text: { en: 'Papel picado flutters in the wind — some people say it stands for the air.', es: 'El papel picado se mueve con el viento; hay quien dice que representa el aire.' } }]);
    }
    await this.done('papel');
  }

  async pottery() {
    const g = this.game;
    await this.view('barro');
    await this.say([
      { who: 'lupita', text: { en: 'Clay [[sahumador|sahumador]]s for burning copal, little Xolo dogs, and a [[Catrina]]! Michoacán is famous for its pottery.', es: '¡[[Sahumadores|sahumador]] de barro para el copal, perritos Xolo y una [[Catrina]]! Michoacán es famoso por su alfarería.' } },
    ]);
    if (!g.knows('xolo')) await g.learn('xolo');
    else if (!g.knows('catrina')) await this.say([{ who: 'lupita', text: { en: 'Maestra Eréndira at the plaza knows the whole story of the Catrina. Let\'s ask her tomorrow!', es: 'La Maestra Eréndira, en la plaza, sabe toda la historia de la Catrina. ¡Preguntémosle mañana!' } }]);
  }

  async lupita() {
    const g = this.game;
    const missing = MARKET_LIST.filter((id) => !(g.hasItem(id) || (id === 'calavera-blanca' && g.hasItem('calavera')) || (id === 'papel-china' && g.hasItem('papel'))));
    const names = { cempasuchil: { en: 'marigolds', es: 'cempasúchil' }, velas: { en: 'candles', es: 'veladoras' }, copal: { en: 'copal', es: 'copal' }, fruta: { en: 'fruit', es: 'fruta' }, 'calavera-blanca': { en: 'a sugar skull', es: 'una calaverita' }, 'papel-china': { en: 'tissue paper', es: 'papel de China' } };
    if (missing.length) {
      await this.say([{ who: 'lupita', text: { en: `We still need: ${missing.map((m) => names[m].en).join(', ')}.`, es: `Todavía nos falta: ${missing.map((m) => names[m].es).join(', ')}.` } }]);
    } else {
      await this.say([{ who: 'lupita', text: { en: 'We have everything from the market! Open the **Map** to keep going.', es: '¡Ya tenemos todo lo del mercado! Abre el **Mapa** para seguir.' } }]);
    }
  }

  onBack() { for (const id of ['chela', 'tomas', 'mago']) this.chars[id]?.look(null); }

  exit() {
    super.exit();
    this.gone = true;
  }
}
