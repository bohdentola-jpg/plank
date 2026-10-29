// El taller de Tía Lucía: her sunny patio. Cut papel picado with a chisel the
// way they do in Huixcolotla, then decorate a sugar skull for Abuelo.
import * as THREE from 'three';
import { Scene } from './base.js';
import { toon, box, mesh, cyl, rng, PAL, outline } from '../toon.js';
import { wall, floor, plant } from '../room.js';
import { papelString, woodTex, talaveraTex, bougainvillea } from '../world.js';
import { sugarSkull, alebrije, catrinaFigure } from '../props.js';
import { openPapel, papelCanvases, PAPER_COLORS } from '../games/papel.js';
import { t } from '../i18n.js';
import { icon, hydrateIcons } from '../icons.js';

const ICING = [PAL.rosa, PAL.turquoise, PAL.gold, PAL.purple, PAL.lime, PAL.orange, '#ffffff', '#2357d1'];

export class WorkshopScene extends Scene {
  dayLabel() { return { en: 'October 31 · afternoon', es: '31 de octubre · tarde' }; }

  async build() {
    await super.build();
    this.setLights('day', { shadowBox: 9 });
    this.sun.position.set(-6, 14, 8);
    const s = this.scene;
    const patio = new THREE.Group();
    const fl = floor(11, 9, '#d97a4a', '#c96a3c');
    patio.add(fl);
    const border = mesh(new THREE.PlaneGeometry(11, 0.5), toon('#ffffff', { map: talaveraTex(), rim: 0 }), { cast: false, receive: true });
    border.material.map.repeat.set(22, 1);
    border.rotation.x = -Math.PI / 2;
    border.position.set(0, 0.003, -4.2);
    patio.add(border);
    const back = wall(11, 3.4, [{ x: -3.2, y: 0, w: 1.2, h: 2.3 }, { x: 2.6, y: 1.1, w: 1.3, h: 1.1 }], PAL.yellowWall, { band: '#c4562e' });
    back.position.set(0, 0, -4.5);
    patio.add(back);
    for (const sx of [-1, 1]) {
      const w = wall(9, 3.4, [], sx < 0 ? PAL.blueWall : PAL.pinkWall, { band: sx < 0 ? '#2f5f9e' : '#b84a7c' });
      w.position.set(sx * 5.5, 0, 0);
      w.rotation.y = -sx * Math.PI / 2;
      patio.add(w);
    }
    s.add(patio);
    const bug = bougainvillea(4, 3.2, -4.4, rng(4));
    s.add(bug);
    const bug2 = bougainvillea(5, 3.0, -4.4, rng(9));
    bug2.position.x = 3;
    s.add(bug2);
    for (const [x, z, k] of [[-4.6, -3.6, 1.3], [4.6, -3.6, 1.1], [-4.7, 2.6, 1.0], [4.7, 2.0, 1.2]]) {
      const p = plant({ big: k, seed: Math.round(x * 10) });
      p.position.set(x, 0, z);
      s.add(p);
    }
    this.merge(patio);
    // drying lines of papel picado
    for (let k = 0; k < 3; k++) {
      const st = papelString([-5.3, 3.0, -3 + k * 1.8], [5.3, 3.05, -2.6 + k * 1.8], { seed: 30 + k, sheetW: 0.34, sag: 0.3 });
      st.userData.dynamic = true;
      this.animateTree(st);
      s.add(st);
    }
    // the cutting table
    const tb = new THREE.Group();
    const top = box(2.8, 0.08, 1.3, toon('#ffffff', { map: woodTex('#a0703f'), rim: 0 }));
    top.position.y = 0.88;
    tb.add(top);
    for (const [x, z] of [[-1.3, -0.55], [1.3, -0.55], [-1.3, 0.55], [1.3, 0.55]]) {
      const leg = box(0.1, 0.84, 0.1, toon('#7a4a2a', { rim: 0 }));
      leg.position.set(x, 0.42, z);
      tb.add(leg);
    }
    const plate = box(0.9, 0.03, 0.7, toon('#8d939a'));
    plate.position.set(-0.3, 0.935, 0);
    tb.add(plate);
    PAPER_COLORS.forEach((c, i) => {
      const stack = box(0.32, 0.05 + (i % 3) * 0.02, 0.4, toon(c));
      stack.position.set(0.55 + (i % 4) * 0.2, 0.95 + Math.floor(i / 4) * 0.08, -0.3 + Math.floor(i / 4) * 0.02);
      stack.rotation.y = (i % 2) * 0.2;
      tb.add(stack);
    });
    const sheetStack = box(0.62, 0.06, 0.5, toon(PAL.rosa));
    sheetStack.position.set(-0.3, 0.98, 0);
    tb.add(sheetStack);
    this.stack = sheetStack;
    const mallet = new THREE.Group();
    const mh = cyl(0.02, 0.02, 0.35, toon('#c9965e'), 6);
    mh.rotation.z = Math.PI / 2;
    mallet.add(mh);
    const mhead = cyl(0.06, 0.06, 0.14, toon('#8a5a33'), 10);
    mhead.position.x = 0.18;
    mallet.add(mhead);
    mallet.position.set(0.3, 0.97, 0.35);
    tb.add(mallet);
    for (let i = 0; i < 4; i++) {
      const ch = cyl(0.008, 0.012, 0.16, toon('#9aa3ad'), 6);
      ch.rotation.z = Math.PI / 2;
      ch.position.set(-0.1 + i * 0.07, 0.94, 0.5);
      tb.add(ch);
    }
    tb.position.set(-1.2, 0, -0.8);
    s.add(tb);
    this.cutTable = tb;
    // the sugar-skull station
    const st = new THREE.Group();
    const top2 = box(1.5, 0.08, 1.0, toon('#ffffff', { map: woodTex('#c99a6a'), rim: 0 }));
    top2.position.y = 0.86;
    st.add(top2);
    for (const [x, z] of [[-0.65, -0.42], [0.65, -0.42], [-0.65, 0.42], [0.65, 0.42]]) {
      const leg = box(0.08, 0.82, 0.08, toon('#7a4a2a', { rim: 0 }));
      leg.position.set(x, 0.41, z);
      st.add(leg);
    }
    const turn = cyl(0.3, 0.32, 0.05, toon('#fbf6ea'), 24);
    turn.position.set(0, 0.925, 0);
    st.add(turn);
    ICING.slice(0, 6).forEach((c, i) => {
      const bowl = mesh(new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#ffffff', { side: THREE.DoubleSide }));
      bowl.position.set(-0.55 + (i % 3) * 0.13, 0.97, 0.25 + Math.floor(i / 3) * 0.13);
      st.add(bowl);
      const ic = cyl(0.06, 0.06, 0.02, toon(c), 12);
      ic.position.set(bowl.position.x, 0.94, bowl.position.z);
      st.add(ic);
    });
    st.position.set(2.4, 0, -0.6);
    s.add(st);
    this.station = st;
    // the skull you'll decorate
    const g = this.game;
    const decorated = g.state.skull?.canvas;
    const sk = sugarSkull({ size: 4.2, plain: !decorated, dataUrl: decorated || null });
    sk.position.set(0, 0.95, 0);
    outline(sk, 0.01);
    st.add(sk);
    this.skull = sk;
    // folk art shelf
    const shelf = box(1.4, 0.06, 0.35, toon('#ffffff', { map: woodTex('#7a4a2a'), rim: 0 }));
    shelf.position.set(-4.8, 1.6, -1.5);
    shelf.rotation.y = Math.PI / 2;
    s.add(shelf);
    const al = alebrije();
    al.scale.setScalar(2.6);
    al.position.set(-4.85, 1.63, -1.2);
    al.rotation.y = Math.PI / 2;
    s.add(al);
    this.alebrije = al;
    const cat = catrinaFigure();
    cat.scale.setScalar(2.2);
    cat.position.set(-4.85, 1.63, -1.9);
    cat.rotation.y = Math.PI / 2;
    s.add(cat);
    this.catrina = cat;
    this.addChar('lucia', -1.1, -2.1, 0.1);
    this.addChar('lupita', 0.9, 0.9, -0.3);
    this.addChar('chispa', 0.2, 1.6, 0.2).play('lie');
    this.defineView('main', [0, 2.2, 6.6], [0, 1.0, -1.4], 46);
    this.defineView('cut', [-1.2, 2.3, 1.6], [-1.2, 0.9, -0.9], 44);
    this.defineView('skull', [2.4, 1.55, 1.15], [2.4, 1.15, -0.6], 40);
    this.defineView('shelf', [-2.6, 1.8, 0.4], [-4.8, 1.6, -1.5], 44);
    this.hideMonarch('bug', 3.4, 2.6, -4.2);
    this.hideMonarch('pot', -4.7, 1.35, 2.6);
    this.hangMyPapel();
  }

  hangMyPapel() {
    const custom = papelCanvases(this.game.state.papel, 128);
    if (!custom) return;
    if (this.myPapel) this.scene.remove(this.myPapel);
    const st = papelString([-5.3, 2.6, 1.6], [5.3, 2.65, 2.0], { sheetW: 0.4, sag: 0.35, customs: custom, seed: 2 });
    st.userData.dynamic = true;
    this.animateTree(st);
    this.scene.add(st);
    this.myPapel = st;
  }

  async enter() {
    const g = this.game;
    g.sound.music('workshop');
    g.sound.setAmbient('birds');
    this.talkable('lucia', { en: 'Tía Lucía', es: 'Tía Lucía' }, () => this.lucia());
    this.hot(this.cutTable, { en: 'Cut papel picado', es: 'Cortar papel picado' }, () => this.papel(), { enabled: () => !g.has('papel') });
    this.hot(this.station, { en: 'Decorate the sugar skull', es: 'Decorar la calaverita' }, () => this.decorate(), { enabled: () => !g.has('skull') && !this.decorating });
    this.hot(this.alebrije, { en: 'A colorful creature', es: 'Una criatura de colores' }, async () => {
      await this.view('shelf');
      await this.say([{ who: 'lucia', text: { en: 'My [[alebrije]]! Pedro Linares invented them in 1936. People love them now, but they aren\'t an old part of Día de Muertos.', es: '¡Mi [[alebrije]]! Los inventó Pedro Linares en 1936. Hoy a todos les encantan, pero no son parte antigua del Día de Muertos.' } }]);
      await g.learn('alebrije');
    });
    this.hot(this.catrina, { en: 'A clay Catrina', es: 'Una Catrina de barro' }, async () => {
      await this.view('shelf');
      await this.say([{ who: 'lucia', text: { en: 'My little [[Catrina]]. Ask Maestra Eréndira at the plaza who drew the very first one!', es: 'Mi [[Catrina]] de barro. ¡Pregúntale a la Maestra Eréndira, en la plaza, quién dibujó la primera!' } }]);
    });
    this.talkable('lupita', { en: 'Lupita', es: 'Lupita' }, () => this.say([{ who: 'lupita', text: this.lupitaLine() }]));
  }

  lupitaLine() {
    const g = this.game;
    if (!g.has('papel')) return { en: 'Let\'s cut papel picado at the big table!', es: '¡Vamos a cortar papel picado en la mesa grande!' };
    if (!g.has('skull')) return { en: 'Now the sugar skull for Abuelo — at the little table!', es: '¡Ahora la calaverita del Abuelo, en la mesita!' };
    return { en: 'Our papel picado and calaverita are ready! Open the **Map**.', es: '¡Ya están el papel picado y la calaverita! Abre el **Mapa**.' };
  }

  async afterEnter() {
    const g = this.game;
    if (!g.has('luciaHello')) {
      g.flag('luciaHello');
      await this.say([
        { who: 'lucia', emote: 'happy', text: { en: '¡Mis amores! Come in, come in. Today I\'m teaching you two things: [[papel picado]] and decorating a [[calaverita]].', es: '¡Mis amores! Pásenle. Hoy les enseño dos cosas: [[papel picado]] y a decorar una [[calaverita]].' } },
        { who: 'lucia', text: { en: 'I grew up in San Salvador [[Huixcolotla]], in Puebla. There, almost every family cuts papel picado!', es: 'Yo crecí en San Salvador [[Huixcolotla]], Puebla. ¡Allá casi todas las familias cortan papel picado!' } },
      ]);
    }
  }

  async lucia() {
    const g = this.game;
    if (!g.has('papel')) return this.papel();
    if (!g.has('skull')) return this.decorate();
    await this.say([{ who: 'lucia', text: { en: 'Your Abuelo would laugh — he used to say my papel picado looked like Swiss cheese. ¡Ja!', es: 'Tu abuelo se reiría: decía que mi papel picado parecía queso suizo. ¡Ja!' }, emote: 'laugh' }]);
  }

  async papel() {
    const g = this.game;
    if (g.has('papel')) return;
    await this.view('cut', { back: false });
    await this.say([
      { who: 'lucia', text: { en: 'We don\'t fold and snip with scissors. We stack fifty sheets of [[papel de China]] on a lead plate, lay the pattern on top, and strike a [[cincel]] — a chisel — with a mallet. ¡Tac, tac, tac!', es: 'No doblamos ni recortamos con tijeras. Apilamos cincuenta hojas de [[papel de China]] sobre una plancha de plomo, ponemos el patrón encima y golpeamos el [[cincel]] con un mazo. ¡Tac, tac, tac!' } },
      { who: 'lucia', text: { en: 'Every tap cuts all the sheets at once. ¿Listos?', es: 'Cada golpe corta todas las hojas a la vez. ¿Empezamos?' } },
    ]);
    const res = await openPapel(g);
    g.state.papel = res;
    g.take('papel-china');
    g.flag('papel');
    this.hangMyPapel();
    await g.give('papel');
    await this.say([{ who: 'lucia', emote: 'happy', text: { en: '¡Precioso! Look how it dances in the wind. Many people say papel picado stands for the air on the ofrenda.', es: '¡Precioso! Mira cómo baila con el viento. Mucha gente dice que en la ofrenda el papel picado representa el aire.' } }]);
    await g.learn('papel');
    await this.say([
      { who: 'lupita', text: { en: 'Tía, I read online that every color has a secret meaning. Is that true?', es: 'Tía, leí en internet que cada color tiene un significado secreto. ¿Es cierto?' } },
      { who: 'lucia', text: { en: 'Good question! Different websites say different things, and nobody has found an old rule. In my family we just pick the happiest colors.', es: '¡Buena pregunta! Cada página dice algo distinto y nadie ha encontrado una regla antigua. En mi familia escogemos los colores más alegres.' } },
    ]);
    await g.learn('colores');
    await this.backToMain();
    if (!g.has('skull')) await this.say([{ who: 'lupita', text: { en: 'Now let\'s decorate the sugar skull — click the little table!', es: 'Ahora decoremos la calaverita: ¡haz clic en la mesita!' } }]);
  }

  // ---------------------------------------------------------------- sugar skull
  async decorate() {
    const g = this.game;
    if (g.has('skull') || this.decorating) return;
    if (!g.hasItem('calavera-blanca')) {
      await this.say([{ who: 'lucia', text: { en: 'First you need a plain sugar skull from Doña Mago at the market!', es: '¡Primero necesitas una calaverita sin decorar del puesto de Doña Mago, en el mercado!' } }]);
      return;
    }
    this.decorating = true;
    await this.view('skull', { back: false });
    await this.say([
      { who: 'lucia', text: { en: 'This is [[alfeñique]]: sugar paste. Paint it with icing! **Drag on the skull to draw**, add flowers and foil, and write your Abuelo\'s name on the forehead.', es: 'Esto es [[alfeñique]], pasta de azúcar. ¡Píntala con betún! **Arrastra sobre la calaverita para dibujar**, ponle flores y papel metálico, y escribe el nombre de tu abuelo en la frente.' } },
    ]);
    const head = this.skull.userData.head;
    this.skullCv = this.skull.userData.canvas;
    this.brush = { color: PAL.rosa, size: 9, mode: 'paint' };
    this.undo = [];
    const side = document.createElement('div');
    side.style.maxWidth = '100%';
    side.innerHTML = `
      <div class="swatches">${ICING.map((c) => `<button type="button" class="swatch${c === this.brush.color ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <div class="swatches" style="margin-top:6px">
        <button type="button" class="tool on" data-m="paint">${t({ en: 'Icing', es: 'Betún' })}</button>
        <button type="button" class="tool" data-m="dots">${t({ en: 'Dots', es: 'Puntos' })}</button>
        <button type="button" class="tool" data-m="flower">${t({ en: 'Flower', es: 'Flor' })}</button>
        <button type="button" class="tool" data-m="heart">${t({ en: 'Heart', es: 'Corazón' })}</button>
        <button type="button" class="tool" data-m="foil">${t({ en: 'Foil eyes', es: 'Ojos de papel metálico' })}</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;align-items:center">
        <input class="inp" maxlength="14" style="max-width:170px;padding:6px 10px;font-size:16px" value="BETO" aria-label="name">
        <button type="button" class="btn turq small" data-a="name">${t({ en: 'Write name', es: 'Escribir nombre' })}</button>
        <button type="button" class="btn cream small" data-a="undo">${icon('undo')}</button>
        <button type="button" class="btn cream small" data-a="rot">${icon('rotate')}</button>
        <button type="button" class="btn rosa small" data-a="done">${icon('check')} ${t({ en: 'Done!', es: '¡Lista!' })}</button>
      </div>`;
    g.ui.showTray({ label: { en: 'Sugar skull', es: 'Calaverita' }, items: [], side, onPick: () => {} });
    side.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { this.brush.color = b.dataset.c; side.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); g.sfx('tap'); }; });
    side.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => { this.brush.mode = b.dataset.m; side.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b)); g.sfx('tap'); }; });
    const inp = side.querySelector('input');
    side.querySelector('[data-a=name]').onclick = () => { this.writeName(inp.value.trim().toUpperCase()); };
    side.querySelector('[data-a=undo]').onclick = () => this.undoPaint();
    side.querySelector('[data-a=rot]').onclick = () => { this.spin = (this.spin || 0) + Math.PI / 2; g.sfx('whoosh'); };
    hydrateIcons(side);
    await new Promise((resolve) => {
      side.querySelector('[data-a=done]').onclick = () => resolve();
    });
    // save the decorated skull
    g.state.skull = { canvas: this.skullCv.toDataURL('image/png'), name: inp.value.trim().toUpperCase() };
    delete g.cache.item.calavera;
    g.take('calavera-blanca');
    g.flag('skull');
    g.ui.hideTray();
    this.decorating = false;
    g.sfx('success');
    await g.give('calavera');
    await this.say([{ who: 'lucia', emote: 'happy', text: { en: '¡Qué bonita! In Mexico people also give sugar skulls with their friends\' names as gifts. A sweet joke between the living!', es: '¡Qué bonita! En México también se regalan calaveritas con el nombre de los amigos. ¡Una broma dulce entre vivos!' } }]);
    if (!g.knows('calavera')) await g.learn('calavera');
    await this.backToMain();
    await this.say([{ who: 'lupita', text: this.lupitaLine() }]);
    void head;
  }

  snapshotCanvas() {
    const c = document.createElement('canvas');
    c.width = this.skullCv.width; c.height = this.skullCv.height;
    c.getContext('2d').drawImage(this.skullCv, 0, 0);
    this.undo.push(c);
    if (this.undo.length > 20) this.undo.shift();
  }

  undoPaint() {
    const prev = this.undo.pop();
    if (!prev) return;
    const ctx = this.skullCv.getContext('2d');
    ctx.clearRect(0, 0, this.skullCv.width, this.skullCv.height);
    ctx.drawImage(prev, 0, 0);
    this.skull.userData.material.map.needsUpdate = true;
    this.game.sfx('tap');
  }

  uvAtPointer() {
    const hits = this.engine.raycastObjects([this.skull.userData.head]);
    if (!hits.length || !hits[0].uv) return null;
    const uv = hits[0].uv;
    return { x: uv.x * this.skullCv.width, y: (1 - uv.y) * this.skullCv.height };
  }

  paintAt(p, from = null) {
    const ctx = this.skullCv.getContext('2d');
    const b = this.brush;
    ctx.fillStyle = b.color;
    ctx.strokeStyle = b.color;
    if (b.mode === 'paint') {
      ctx.lineCap = 'round';
      ctx.lineWidth = b.size;
      if (from && Math.abs(from.x - p.x) < 200) {
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, b.size / 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (b.mode === 'dots') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    } else if (b.mode === 'flower') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * 11, p.y + Math.sin(a) * 11, 9, 5, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = PAL.gold;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    } else if (b.mode === 'heart') {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 14);
      ctx.bezierCurveTo(p.x - 22, p.y - 2, p.x - 10, p.y - 18, p.x, p.y - 6);
      ctx.bezierCurveTo(p.x + 10, p.y - 18, p.x + 22, p.y - 2, p.x, p.y + 14);
      ctx.fill();
    } else if (b.mode === 'foil') {
      // shiny foil fills both eye sockets
      for (const sx of [-1, 1]) {
        const g = ctx.createLinearGradient(256 + sx * 36 - 26, 98, 256 + sx * 36 + 26, 158);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, b.color); g.addColorStop(0.7, b.color); g.addColorStop(1, '#ffffff');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(256 + sx * 36, 128, 26, 30, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    this.skull.userData.material.map.needsUpdate = true;
  }

  writeName(name) {
    if (!name) return;
    this.snapshotCanvas();
    const ctx = this.skullCv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(256 - 70, 14, 140, 34);
    ctx.strokeStyle = this.brush.color;
    ctx.lineWidth = 4;
    ctx.strokeRect(256 - 70, 14, 140, 34);
    ctx.fillStyle = this.brush.color === '#ffffff' ? PAL.purple : this.brush.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fs = 26;
    ctx.font = `${fs}px 'Lilita One', sans-serif`;
    while (ctx.measureText(name).width > 128 && fs > 10) { fs--; ctx.font = `${fs}px 'Lilita One', sans-serif`; }
    ctx.fillText(name, 256, 32);
    this.skull.userData.material.map.needsUpdate = true;
    this.game.sfx('chime');
  }

  onPointerDown() {
    if (!this.decorating) return;
    const p = this.uvAtPointer();
    if (!p) { this.dragSpin = true; return; }
    this.snapshotCanvas();
    this.painting = true;
    this.last = p;
    this.paintAt(p);
    this.game.sfx('brush');
  }

  onPointerMove(e) {
    if (this.dragSpin && e.buttons) { this.spin = (this.spin ?? this.skull.rotation.y) + e.movementX * 0.012; return; }
    if (!this.painting || this.brush.mode !== 'paint') return;
    const p = this.uvAtPointer();
    if (!p) return;
    this.paintAt(p, this.last);
    this.last = p;
  }

  onPointerUp() { this.painting = false; this.dragSpin = false; this.last = null; }

  onTap() { return !!this.decorating; }

  update(dt, time) {
    super.update(dt, time);
    if (this.skull && this.spin !== undefined) {
      this.skull.rotation.y += (this.spin - this.skull.rotation.y) * Math.min(1, dt * 6);
    }
  }
}
