// La plaza, November 1 at dusk: the kiosco and its band, the Casa de la Cultura
// (history with Maestra Eréndira), Don Pancho's calaverita contest, a community
// ofrenda, Catrinas, atole, and friends.
import * as THREE from 'three';
import { Scene } from './base.js';
import { toon, box, mesh, cyl, sphere, rbox, rng, PAL, mkCanvas, tex } from '../toon.js';
import { kiosco, church, tree, lamp, bench, house, cobbleTex, papelString, stringLights, signBoard, stall, woodTex, plasterTex } from '../world.js';
import { makeProp, veladora, cirio, panDeMuerto, guitar, atole } from '../props.js';
import { miniOfrenda } from '../cardprops.js';
import { openPoem, poemLines } from '../games/poem.js';
import { openMexicoMap } from '../book.js';
import { t } from '../i18n.js';

export class PlazaScene extends Scene {
  dayLabel() { return { en: 'November 1 · dusk', es: '1 de noviembre · atardecer' }; }

  async build() {
    await super.build();
    this.setLights('evening', { shadowBox: 18 });
    this.addHills({ color: '#4c6a5a', far: '#6a6a9a' });
    const g = new THREE.Group();
    const ground = mesh(new THREE.PlaneGeometry(40, 40), toon('#ffffff', { map: cobbleTex('#cbb69c'), rim: 0 }), { cast: false, receive: true });
    ground.material.map.repeat.set(12, 12);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -4;
    g.add(ground);
    // garden beds around the kiosco
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 1.5], [6, 1.5]]) {
      const bed = box(4, 0.25, 3.2, toon('#6b8a3a', { rim: 0 }));
      bed.position.set(x, 0.125, z);
      g.add(bed);
      const curb = box(4.2, 0.28, 3.4, toon('#d9cbb8', { rim: 0 }));
      curb.position.set(x, 0.1, z);
      g.add(curb);
    }
    // the church across the square
    const ch = church({ color: '#f0a98a' });
    ch.position.set(0, 0, -17);
    g.add(ch);
    // portales (arcades) on the left
    const arc = new THREE.Group();
    const wallM = toon('#ffffff', { map: plasterTex('#ffd86b', null), rim: 0 });
    const back = box(14, 4.6, 0.4, wallM);
    back.position.set(0, 2.3, -1.2);
    arc.add(back);
    const roof = box(14.4, 0.4, 3.2, toon('#ffffff', { map: plasterTex('#f6c75a', null), rim: 0 }));
    roof.position.set(0, 3.6, 0.3);
    arc.add(roof);
    for (let i = 0; i < 8; i++) {
      const col = cyl(0.22, 0.25, 3.4, toon('#fff1dc', { rim: 0 }), 10);
      col.position.set(-7 + i * 2, 1.7, 1.6);
      arc.add(col);
    }
    arc.position.set(-13, 0, -5);
    arc.rotation.y = Math.PI / 2;
    g.add(arc);
    // houses on the right, next to the Casa de la Cultura
    const h1 = house({ w: 5, h: 4.2, d: 3, color: PAL.blueWall, band: '#2f5f9e', seed: 81, balcony: true, upper: true });
    h1.position.set(13, 0, -12);
    h1.rotation.y = -Math.PI / 2;
    g.add(h1);
    this.scene.add(g);
    this.merge(g);
    // the Casa de la Cultura
    const casa = new THREE.Group();
    const cw = box(8, 5, 4, toon('#ffffff', { map: plasterTex('#e9e0cf', '#7a3b2e', 0.15), rim: 0 }));
    cw.position.set(0, 2.5, 0);
    casa.add(cw);
    const door = rbox(2.2, 3.0, 0.2, 0.3, toon('#ffffff', { map: woodTex('#5a3420'), rim: 0 }));
    door.position.set(0, 1.5, 2.02);
    casa.add(door);
    const sign = signBoard('CASA DE LA CULTURA', '#7a3b2e', '#ffc21a', 4.6, 0.6);
    sign.position.set(0, 4.1, 2.04);
    casa.add(sign);
    // a banner announcing the exhibit
    const bcv = mkCanvas(256, 512);
    const bx = bcv.getContext('2d');
    bx.fillStyle = PAL.purple; bx.fillRect(0, 0, 256, 512);
    bx.fillStyle = '#ffc21a'; bx.font = "40px 'Lilita One', sans-serif"; bx.textAlign = 'center';
    ['POSADA', 'Y LA', 'CATRINA'].forEach((w, i) => bx.fillText(w, 128, 70 + i * 50));
    bx.fillStyle = '#fffaf0';
    bx.beginPath(); bx.ellipse(128, 330, 70, 78, 0, 0, Math.PI * 2); bx.fill();
    bx.fillStyle = '#1d1420';
    bx.beginPath(); bx.ellipse(100, 320, 22, 26, 0, 0, Math.PI * 2); bx.fill();
    bx.beginPath(); bx.ellipse(156, 320, 22, 26, 0, 0, Math.PI * 2); bx.fill();
    bx.beginPath(); bx.ellipse(128, 238, 120, 28, 0, 0, Math.PI * 2); bx.fill();
    const banner = mesh(new THREE.PlaneGeometry(1.2, 2.4), toon('#ffffff', { map: tex(bcv), rim: 0 }), { cast: false });
    banner.position.set(-2.6, 2.6, 2.03);
    casa.add(banner);
    casa.position.set(11.5, 0, -4);
    casa.rotation.y = -Math.PI / 2;
    this.scene.add(casa);
    this.casa = casa;
    this.casaDoor = door;
    // kiosco with its band
    const k = kiosco({ roof: '#2e8b57' });
    k.position.set(0, 0, -6);
    this.scene.add(k);
    this.kiosco = k;
    // trees and lamps
    const r = rng(12);
    for (const [x, z] of [[-9, -10], [9, -11], [-9, 3], [8, 4], [-3.5, -12], [4, -12.5]]) {
      const tr = tree({ kind: 'laurel', h: 3.6 + r(), seed: Math.round(x * 3 + z) });
      tr.position.set(x, 0, z);
      this.scene.add(tr);
    }
    for (const [x, z] of [[-4, -1.5], [4, -1.5], [-4, -10.5], [4, -10.5]]) {
      const l = lamp({ lit: true });
      l.position.set(x, 0, z);
      this.scene.add(l);
      const pl = new THREE.PointLight('#ffcf70', 3, 7, 1.5);
      pl.position.set(x, 2.8, z);
      this.scene.add(pl);
    }
    for (const [x, z, ry] of [[-3, 3, 0], [3, 3, 0], [-7.5, -6, Math.PI / 2]]) {
      const b = bench({});
      b.position.set(x, 0, z);
      b.rotation.y = ry;
      this.scene.add(b);
    }
    // papel picado and string lights from the kiosco to the trees
    const top = new THREE.Vector3(0, 5.2, -6);
    for (const [x, z] of [[-9, 3], [8, 4], [-9, -10], [9, -11], [-11, -5], [10, -4]]) {
      const s = papelString([top.x, top.y, top.z], [x, 3.4, z], { seed: Math.round(x * 7 + z), sheetW: 0.36, sag: 0.6 });
      s.userData.dynamic = true;
      this.animateTree(s);
      this.scene.add(s);
      this.scene.add(stringLights([top.x, top.y - 0.3, top.z], [x, 3.2, z], { n: 12, sag: 0.8 }));
    }
    this.buildOfrenda();
    this.buildBoard();
    this.buildStand();
    this.buildPeople();
    this.defineView('main', [0, 2.6, 11], [0, 1.6, -4], 48);
    this.defineView('casa', [5.5, 1.9, 1.5], [11, 1.6, -3.6], 46);
    this.defineView('board', [-1.5, 1.7, 4.2], [-5.2, 1.4, 2.0], 44);
    this.defineView('ofrenda', [2.0, 1.9, 7.9], [4.5, 1.2, 3.9], 46);
    this.defineView('kiosco', [0, 2.6, 2.5], [0, 2.0, -6], 48);
    this.hideMonarch('tree', -8.6, 2.8, 2.6);
    this.hideMonarch('kiosco', 1.8, 1.25, -3.6);
  }

  buildOfrenda() {
    // the community ofrenda at the front of the square, facing everyone
    const C = new THREE.Vector3(4.5, 0, 4.1);
    const rot = -0.6;
    const f = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)); // its front
    const side = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
    const o = miniOfrenda({ levels: 3, photos: 3 });
    o.scale.setScalar(3.4);
    o.position.copy(C);
    o.rotation.y = rot;
    this.scene.add(o);
    this.animateTree(o);
    this.ofrenda = o;
    // photos of townspeople everyone remembers (all made up)
    o.userData.frames.forEach((fr, i) => {
      this.game.portraitCanvas(500 + i * 17).then((cv) => fr.userData.setPicture(cv));
    });
    const arch = makeProp('arco', { w: 2.2, h: 2.6, noOutline: true });
    arch.position.copy(C).addScaledVector(f, -0.2);
    arch.rotation.y = rot;
    this.scene.add(arch);
    for (let i = 0; i < 10; i++) {
      const c = i % 2 ? cirio({ lit: true, h: 0.3 }) : veladora({ lit: true, glass: [PAL.red, PAL.purple][i % 2] });
      c.position.copy(C).addScaledVector(f, 1.25 + Math.floor(i / 5) * 0.35).addScaledVector(side, ((i % 5) - 2) * 0.45);
      this.scene.add(c);
      this.animateTree(c);
    }
    const gl = new THREE.PointLight('#ffb35c', 6, 6, 1.5);
    gl.position.copy(C).addScaledVector(f, 1.4).add(new THREE.Vector3(0, 1.4, 0));
    this.scene.add(gl);
  }

  buildBoard() {
    // the calaverita contest board
    const b = new THREE.Group();
    const board = box(2.2, 1.5, 0.08, toon('#ffffff', { map: woodTex('#9a6a3e'), rim: 0 }));
    board.position.y = 1.55;
    b.add(board);
    const title = signBoard('CALAVERITAS', PAL.rosa, '#ffffff', 2.0, 0.32);
    title.position.set(0, 2.45, 0.02);
    b.add(title);
    for (const x of [-0.95, 0.95]) {
      const leg = box(0.1, 2.4, 0.1, toon('#7a4a2a'));
      leg.position.set(x, 1.2, -0.05);
      b.add(leg);
    }
    // a few poems already pinned (other kids' entries)
    const cols = ['#fffaf0', '#fff1c9', '#ffe1f0', '#e2f7ff'];
    for (let i = 0; i < 5; i++) {
      const p = box(0.42, 0.52, 0.01, toon(cols[i % 4]));
      p.position.set(-0.75 + i * 0.37, 1.55 + (i % 2) * 0.12, 0.05);
      p.rotation.z = (i % 2 ? 1 : -1) * 0.05;
      b.add(p);
      const pin = sphere(0.025, toon(PAL.red), 6);
      pin.position.set(p.position.x, p.position.y + 0.22, 0.07);
      b.add(pin);
    }
    b.position.set(-5.4, 0, 1.6);
    b.rotation.y = 0.6;
    this.scene.add(b);
    this.board = b;
    this.boardSlots = 0;
    for (const poem of this.game.state.poems || []) this.pinPoem(poem);
  }

  pinPoem(poem) {
    const cv = mkCanvas(256, 320);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = PAL.purple; ctx.font = "26px 'Lilita One', sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('Calaverita', 128, 36);
    ctx.fillStyle = '#2a1a14'; ctx.font = "bold 15px 'Nunito', sans-serif";
    poem.lines.forEach((l, i) => {
      const words = l.split(' ');
      let line = '', y = 74 + i * 58;
      for (const w of words) {
        if (ctx.measureText(`${line} ${w}`).width > 230) { ctx.fillText(line, 128, y); line = w; y += 20; } else line = line ? `${line} ${w}` : w;
      }
      ctx.fillText(line, 128, y);
    });
    const p = mesh(new THREE.PlaneGeometry(0.62, 0.78), toon('#ffffff', { map: tex(cv), rim: 0 }), { cast: false });
    const i = this.boardSlots++;
    p.position.set(-0.55 + (i % 3) * 0.55, 1.55, 0.09 + i * 0.002);
    p.rotation.z = (i % 2 ? 1 : -1) * 0.04;
    this.board.add(p);
  }

  buildStand() {
    // atole & tamales
    const st = stall({ w: 2.4, d: 1.2, tarp: PAL.purple, stripes: '#a35ee0' });
    st.position.set(-8.6, 0, -2.2);
    st.rotation.y = Math.PI / 2;
    this.scene.add(st);
    for (let i = 0; i < 3; i++) {
      const pot = sphere(0.24, toon(['#b4673c', '#9a4a2a', '#c9814d'][i]), 14);
      pot.scale.y = 0.8;
      pot.position.set(-0.75 + i * 0.75, st.userData.tableY + 0.2, st.userData.tableZ);
      st.add(pot);
    }
    for (let i = 0; i < 5; i++) {
      const cup = atole();
      cup.position.set(-0.9 + i * 0.4, st.userData.tableY, st.userData.tableZ + 0.3);
      st.add(cup);
    }
    const pan = panDeMuerto({});
    pan.scale.setScalar(1.5);
    pan.position.set(0.95, st.userData.tableY, st.userData.tableZ + 0.25);
    st.add(pan);
    this.stand = st;
  }

  buildPeople() {
    this.addChar('lupita', -1.2, 6.2, 0.2);
    this.addChar('chispa', -0.4, 6.7, -0.2).play('sit');
    this.addChar('mateo', 1.4, 5.6, -0.6);
    this.addChar('erendira', 8.9, -2.6, -1.4);
    this.addChar('pancho', -4.4, 2.6, 0.9);
    this.addChar('nico', 2.8, 3.4, -0.5);
    const cat = this.addChar('catrina', 3.3, 0.6, -0.4);
    this.addChar('catrin', 4.0, 0.9, -0.7);
    cat.emote('smile');
    // the band in the kiosco
    const k = this.kiosco.position;
    const players = [['musico1', -0.9, 0.3], ['musico2', 0.2, 0.7], ['musico3', 1.1, 0.2]];
    for (const [id, x, z] of players) {
      const m = this.addChar(id, k.x + x, k.z + z, 0, { y: 0.9 });
      m.play('play-guitar');
      const gu = guitar();
      gu.scale.setScalar(1.25);
      gu.position.set(0.05, 0.62, 0.22);
      gu.rotation.z = -1.0;
      m.body.add(gu);
    }
    // townsfolk
    for (let i = 0; i < 7; i++) {
      const c = this.addChar(200 + i * 13, (i % 2 ? 1 : -1) * (2 + i * 0.6), -1 - (i % 3) * 3.2, Math.random() * 6);
      this.chars[`vecino${i}`] = c;
      delete this.chars[200 + i * 13];
      const loop = async () => {
        while (!this.gone) {
          const a = Math.random() * Math.PI * 2;
          await c.walkTo(Math.cos(a) * 5.5, -6 + Math.sin(a) * 5.5, 0.55);
          c.play('idle');
          await this.engine.wait(3 + Math.random() * 5);
        }
      };
      if (i < 4) loop();
    }
  }

  async enter() {
    const g = this.game;
    g.sound.music('plaza');
    g.sound.setAmbient('crowd');
    this.talkable('erendira', { en: 'Maestra Eréndira', es: 'Maestra Eréndira' }, () => this.erendira());
    this.hot(this.casa, { en: 'Casa de la Cultura: exhibit', es: 'Casa de la Cultura: exposición' }, () => this.erendira(), { sparkle: false });
    this.talkable('pancho', { en: 'Don Pancho\'s calaveritas', es: 'Las calaveritas de Don Pancho' }, () => this.pancho());
    this.hot(this.board, { en: 'Calaverita contest', es: 'Concurso de calaveritas' }, () => this.pancho(), { sparkle: false });
    this.talkable('mateo', { en: 'Mateo', es: 'Mateo' }, () => this.mateo());
    this.talkable('catrina', { en: 'Catrina & Catrín', es: 'Catrina y Catrín' }, () => this.catrinas());
    this.talkable('catrin', { en: 'Catrina & Catrín', es: 'Catrina y Catrín' }, () => this.catrinas(), { sparkle: false });
    this.talkable('nico', { en: 'Nico', es: 'Nico' }, () => this.nico());
    this.hot(this.ofrenda, { en: 'The community ofrenda', es: 'La ofrenda comunitaria' }, () => this.community());
    this.hot(this.stand, { en: 'Atole & tamales', es: 'Atole y tamales' }, () => this.atole());
    this.hot(this.kiosco, { en: 'The kiosco', es: 'El kiosco' }, async () => {
      await this.view('kiosco');
      await this.say([{ who: 'lupita', text: { en: 'Almost every town in Mexico has a [[kiosco]] in its plaza. Tonight the band is playing the old songs people love.', es: 'Casi todos los pueblos de México tienen un [[kiosco]] en la plaza. Hoy la banda toca las canciones de siempre.' } }]);
    });
    this.talkable('lupita', { en: 'Lupita', es: 'Lupita' }, () => this.lupita());
  }

  async afterEnter() {
    const g = this.game;
    if (!g.has('plazaHello')) {
      g.flag('plazaHello');
      await this.say([
        { who: 'lupita', emote: 'happy', text: { en: 'It\'s November 1st — [[Todos Santos]]! The whole town is in the [[plaza]].', es: '¡Es 1 de noviembre, [[Todos Santos]]! Todo el pueblo está en la [[plaza]].' } },
        { who: 'mateo', text: { en: '¡Lupita! You made it!', es: '¡Lupita! ¡Viniste!' }, emote: 'happy' },
        { who: 'lupita', text: { en: 'This is my friend Mateo. Let\'s find Maestra Eréndira at the Casa de la Cultura, and Don Pancho\'s calaverita contest!', es: 'Él es mi amigo Mateo. ¡Busquemos a la Maestra Eréndira en la Casa de la Cultura y el concurso de calaveritas de Don Pancho!' } },
      ]);
    }
  }

  async checkDone() {
    const g = this.game;
    if (g.has('plaza')) return;
    if (g.knows('catrina') && (g.state.poems || []).length) {
      g.flag('plaza');
      await this.backToMain();
      await this.say([
        { who: 'lupita', text: { en: 'The sun is going down. Tonight families stay with their loved ones at the [[panteón]]. Mamá and Abuela are already there!', es: 'Ya se está metiendo el sol. Esta noche las familias acompañan a sus seres queridos en el [[panteón]]. ¡Mamá y Abuela ya están allá!' } },
        { who: 'lupita', text: { en: 'Are you ready to go?', es: '¿Nos vamos?' }, choices: [{ label: { en: 'Let\'s go!', es: '¡Vamos!' }, value: 'go' }, { label: { en: 'Let me look around a bit more', es: 'Déjame ver un poco más' }, value: 'stay' }] },
      ]).then((v) => {
        if (v === 'go') g.go('cemetery', { dayCard: { title: { en: 'The night of November 1', es: 'La noche del 1 de noviembre' }, sub: { en: 'La velación', es: 'La velación' } } });
        else g.ui.toast(t({ en: 'Open the Map when you\'re ready for the panteón.', es: 'Abre el Mapa cuando quieras ir al panteón.' }), { ico: 'map', ms: 3500 });
      });
    }
  }

  async erendira() {
    const g = this.game;
    await this.view('casa');
    if (!g.has('erendiraHello')) {
      g.flag('erendiraHello');
      await this.say([
        { who: 'erendira', emote: 'happy', text: { en: '¡Bienvenidos a la Casa de la Cultura! I\'m Maestra Eréndira. My family is [[Purépecha]] — our people have lived around this lake for centuries.', es: '¡Bienvenidos a la Casa de la Cultura! Soy la Maestra Eréndira. Mi familia es [[Purépecha]]: nuestro pueblo ha vivido alrededor de este lago por siglos.' } },
      ]);
    }
    let again = true;
    while (again) {
      const topic = await this.say([{
        who: 'erendira', text: { en: 'What would you like to learn about?', es: '¿Sobre qué quieres aprender?' },
        choices: [
          { label: { en: 'La Catrina & Posada', es: 'La Catrina y Posada' }, value: 'catrina' },
          { label: { en: 'Where did it come from?', es: '¿De dónde viene?' }, value: 'origen' },
          { label: { en: 'The Purépecha vigil', es: 'La velación purépecha' }, value: 'velacion' },
          { label: { en: 'Celebrations around Mexico (map)', es: 'Celebraciones en México (mapa)' }, value: 'mapa' },
          { label: { en: 'That\'s all, ¡gracias!', es: 'Es todo, ¡gracias!' }, value: 'bye' },
        ],
      }]);
      if (topic === 'catrina') {
        await this.say([
          { who: 'erendira', text: { en: 'More than a hundred years ago, the printmaker José Guadalupe Posada made funny pictures of skeletons — dancing, cooking, riding bicycles.', es: 'Hace más de cien años, el grabador José Guadalupe Posada hacía imágenes chistosas de calaveras que bailaban, cocinaban y andaban en bicicleta.' } },
          { who: 'erendira', text: { en: 'One was a skeleton lady in a fancy French hat. It made fun of people who pretended to be rich Europeans and hid where they came from. Later, the painter Diego Rivera named her **La Catrina**.', es: 'Una era una calavera de mujer con un sombrero francés muy elegante. Se burlaba de quienes fingían ser europeos ricos y escondían de dónde venían. Después, el pintor Diego Rivera la llamó **La Catrina**.' } },
          { who: 'erendira', text: { en: 'The joke is: under our fancy clothes, we are all the same.', es: 'La broma es que, bajo la ropa elegante, todos somos iguales.' } },
        ]);
        await g.learn('posada');
        await g.learn('catrina');
      } else if (topic === 'origen') {
        await this.say([
          { who: 'erendira', text: { en: 'Long before the Spanish came, many Indigenous peoples here honored their dead with offerings. The [[mexicas]] even had feasts for the dead in their calendar — around July and August!', es: 'Mucho antes de que llegaran los españoles, muchos pueblos indígenas honraban a sus muertos con ofrendas. ¡Los [[mexicas]] tenían fiestas de muertos en su calendario, cerca de julio y agosto!' } },
          { who: 'erendira', text: { en: 'After the Spanish conquest, those ways mixed with the Catholic days of All Saints and All Souls. Historians still debate which parts came from where — and the tradition keeps changing today.', es: 'Después de la conquista, esas costumbres se mezclaron con los días católicos de Todos los Santos y Fieles Difuntos. Los historiadores todavía discuten qué parte viene de dónde, y la tradición sigue cambiando hoy.' } },
        ]);
        await g.learn('origen');
        if (!g.knows('mictlan')) await g.learn('mictlan');
        await this.say([{ who: 'erendira', text: { en: 'In 2008, UNESCO recognized these festivities as heritage of all humanity.', es: 'En 2008, la UNESCO reconoció estas fiestas como patrimonio de toda la humanidad.' } }]);
        await g.learn('unesco');
      } else if (topic === 'velacion') {
        await this.say([
          { who: 'erendira', text: { en: 'Around Lake [[Pátzcuaro]], we call it [[Animecha Kejtzitakua]] — the offering for the souls. Families build arches hung with bread and fruit.', es: 'Alrededor del lago de [[Pátzcuaro]] le decimos [[Animecha Kejtzitakua]]: la ofrenda para las ánimas. Las familias hacen arcos con pan y fruta.' } },
          { who: 'erendira', text: { en: 'Tonight, families keep vigil at the cemetery — on the island of [[Janitzio]], people used to arrive by canoe with candles. You\'ll see a velación at our panteón too.', es: 'Esta noche las familias velan en el panteón; a la isla de [[Janitzio]] llegaban en canoa con velas. Ustedes verán una velación en nuestro panteón.' } },
          { who: 'erendira', text: { en: 'And the monarch butterflies that arrive now? Many Purépecha and Mazahua families say they carry the souls of our ancestors.', es: '¿Y las monarcas que llegan en estos días? Muchas familias purépechas y mazahuas dicen que traen las almas de los antepasados.' } },
        ]);
        await g.learn('velacion');
        if (!g.knows('arco')) await g.learn('arco');
      } else if (topic === 'mapa') {
        await openMexicoMap(g);
      } else {
        again = false;
      }
    }
    await this.checkDone();
  }

  async pancho() {
    const g = this.game;
    await this.view('board');
    if (!g.has('panchoHello')) {
      g.flag('panchoHello');
      await this.say([
        { who: 'pancho', emote: 'happy', text: { en: '¡Buenas noches, jóvenes! I\'m the judge of the [[calaveras literarias]] contest!', es: '¡Buenas noches, jóvenes! ¡Soy el juez del concurso de [[calaveras literarias]]!' } },
        { who: 'pancho', text: { en: 'A calaverita is a funny poem. We imagine La Flaca — Death — comes for someone who is very much **alive**… and we tease their habits. With love, ¡eh! Never to hurt.', es: 'Una calaverita es un poema chistoso. Imaginamos que la Flaca viene por alguien que está muy **vivo**… y bromeamos sobre sus costumbres. ¡Con cariño, eh! Nunca para lastimar.' } },
      ]);
      await g.learn('calaveritas');
    }
    const write = await this.say([{
      who: 'pancho', text: { en: 'Will you write one for the contest?', es: '¿Escribes una para el concurso?' },
      choices: [{ label: { en: 'Yes!', es: '¡Sí!' }, value: 1 }, { label: { en: 'Maybe later', es: 'Al rato' }, value: 0 }],
    }]);
    if (write) {
      const poem = await openPoem(g);
      g.state.poems = [...(g.state.poems || []), poem];
      g.save();
      this.pinPoem(poem);
      g.sfx('success');
      const first = poemLines(poem)[0];
      await this.say([{ who: 'pancho', emote: 'laugh', text: { en: `"${first}…" ¡Ja, ja, ja! Very good! That one goes right on the board.`, es: `"${first}…" ¡Ja, ja, ja! ¡Muy buena! Va directo al tablero.` } }]);
      g.addPetals(2);
    }
    await this.checkDone();
  }

  async mateo() {
    const g = this.game;
    this.chars.mateo.emote('happy');
    const topic = await this.say([{
      who: 'mateo', text: { en: '¿Qué onda? Ask me anything!', es: '¿Qué onda? ¡Pregúntame lo que quieras!' },
      choices: [
        { label: { en: 'Where is your family from?', es: '¿De dónde es tu familia?' }, value: 'family' },
        { label: { en: 'Have you seen the movie "Coco"?', es: '¿Viste la película "Coco"?' }, value: 'coco' },
        { label: { en: 'Do people celebrate in other countries?', es: '¿Se celebra en otros países?' }, value: 'world' },
      ],
    }]);
    if (topic === 'family') {
      await this.say([
        { who: 'mateo', text: { en: 'My mom\'s family is from the Costa Chica in Guerrero — we\'re Afro-Mexican. My grandma\'s town celebrates too, with its own music and customs. Every place is different!', es: 'La familia de mi mamá es de la Costa Chica de Guerrero; somos afromexicanos. El pueblo de mi abuela también lo celebra, con su propia música y costumbres. ¡Cada lugar es distinto!' } },
        { who: 'mateo', text: { en: 'And my cousins live in Chicago. They go to a huge Day of the Dead exhibit at a museum there.', es: 'Y mis primos viven en Chicago. Van a una exposición enorme de Día de Muertos en un museo de allá.' } },
      ]);
      await g.learn('usa');
    } else if (topic === 'coco') {
      await this.say([
        { who: 'mateo', text: { en: 'Like ten times! But some things in it are movie magic — like the bridge of marigold petals and the alebrijes being spirit guides.', es: '¡Como diez veces! Pero hay cosas que son magia de película, como el puente de pétalos y los alebrijes como guías.' } },
      ]);
      await g.learn('coco');
    } else {
      await this.say([
        { who: 'mateo', text: { en: 'Yes! In Guatemala they fly giant kites. In Ecuador they eat bread babies called guaguas with a purple drink. My teacher showed us!', es: '¡Sí! En Guatemala vuelan barriletes gigantes. En Ecuador comen guaguas de pan con una bebida morada. ¡Nos lo enseñó mi maestra!' } },
      ]);
      await g.learn('guatemala');
      await g.learn('andes');
    }
  }

  async catrinas() {
    const g = this.game;
    await this.say([
      { who: 'catrina', emote: 'happy', text: { en: '¡Buenas noches! We\'re in the Catrina contest. We dress up like Posada\'s elegant skeletons — fancy hats and all!', es: '¡Buenas noches! Estamos en el concurso de Catrinas. Nos vestimos como las calaveras elegantes de Posada, ¡con todo y sombrero!' } },
      { who: 'catrin', text: { en: 'It\'s a modern festival custom, a way to joke with death. But it\'s not a scary costume — it\'s about honoring the tradition.', es: 'Es una costumbre moderna de los festivales, una forma de bromear con la muerte. Pero no es un disfraz de miedo: es para honrar la tradición.' } },
    ]);
    await g.learn('catrinas');
  }

  async nico() {
    const g = this.game;
    this.chars.nico.play('cheer', { restart: true });
    await this.say([
      { who: 'nico', emote: 'laugh', text: { en: '"[[¿Me da mi calaverita?]]" — Look! I got three candies, a mandarin and a coin!', es: '"[[¿Me da mi calaverita?]]" ¡Mira! ¡Me dieron tres dulces, una mandarina y una moneda!' } },
    ]);
    if (!g.knows('pedir')) await g.learn('pedir');
  }

  async community() {
    const g = this.game;
    await this.view('ofrenda');
    await this.say([
      { who: 'lupita', text: { en: 'This ofrenda is for the whole town. It has photos of people everyone remembers — the old music teacher, the town doctor, the lady who sold the best tamales.', es: 'Esta ofrenda es de todo el pueblo. Tiene fotos de personas que todos recuerdan: el maestro de música, el doctor del pueblo, la señora que vendía los mejores tamales.' } },
    ]);
    await g.learn('comunitaria');
  }

  async atole() {
    const g = this.game;
    await this.say([
      { who: 'lupita', text: { en: 'Warm [[atole]] and [[champurrado]]! Perfect for a chilly night. Corn drinks like these are older than the Spanish conquest.', es: '¡[[atole]] y [[champurrado]] calientitos! Perfectos para una noche fría. Estas bebidas de maíz son más antiguas que la conquista.' } },
    ]);
    if (!g.knows('bebidas')) await g.learn('bebidas');
  }

  async lupita() {
    const g = this.game;
    const todo = [];
    if (!g.knows('catrina')) todo.push({ en: 'visit Maestra Eréndira at the Casa de la Cultura', es: 'visitar a la Maestra Eréndira en la Casa de la Cultura' });
    if (!(g.state.poems || []).length) todo.push({ en: 'write a calaverita for Don Pancho\'s contest', es: 'escribir una calaverita para el concurso de Don Pancho' });
    if (todo.length) await this.say([{ who: 'lupita', text: { en: `Let's ${todo.map((x) => x.en).join(' and ')}!`, es: `¡Vamos a ${todo.map((x) => x.es).join(' y ')}!` } }]);
    else await this.checkDone().then(() => g.has('plaza') && this.say([{ who: 'lupita', text: { en: 'When you\'re ready, open the **Map** and go to the panteón.', es: 'Cuando quieras, abre el **Mapa** y ve al panteón.' } }]));
  }

  goalOverride() {
    if (this.game.has('plaza')) return null;
    return { en: 'Visit Maestra Eréndira (Casa de la Cultura) and write a calaverita', es: 'Visita a la Maestra Eréndira (Casa de la Cultura) y escribe una calaverita' };
  }

  exit() {
    super.exit();
    this.gone = true;
  }
}
