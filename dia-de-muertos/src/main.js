// The Marigold Path — a Día de Muertos point-and-click adventure.
// Game ties together the engine (3D), the UI (DOM), saving, sound and story.
import * as THREE from 'three';
import { Engine } from './engine.js';
import { UI } from './ui.js';
import { Speech } from './speech.js';
import { Sound } from './audio.js';
import { loadState, saveState, wipeState, freshState } from './save.js';
import { setLang, getLang, t, UI as S } from './i18n.js';
import { icon } from './icons.js';
import { CARD_BY_ID } from './content/cards.js';
import { ITEMS, HOME_ITEM_TEXT, MARKET_LIST } from './content/items.js';
import { makeProp, PROP_INFO, photoFrame } from './props.js';
import { CARD_PROPS } from './cardprops.js';
import { makeCharacter } from './characters.js';
import { outline, disposeTree } from './toon.js';
import { openBook } from './book.js';
import { openMap, PLACES } from './map.js';
import { TitleScene } from './scenes/title.js';
import { HomeScene } from './scenes/home.js';
import { MarketScene } from './scenes/market.js';
import { BakeryScene } from './scenes/bakery.js';
import { WorkshopScene } from './scenes/workshop.js';
import { PlazaScene } from './scenes/plaza.js';
import { CemeteryScene } from './scenes/cemetery.js';
import { FreeScene } from './scenes/free.js';

export const NAMES = {
  lupita: { en: 'Lupita', es: 'Lupita' },
  chispa: { en: 'Chispa', es: 'Chispa' },
  abuela: { en: 'Abuela Rosa', es: 'Abuela Rosa' },
  mama: { en: 'Mamá', es: 'Mamá' },
  papa: { en: 'Papá', es: 'Papá' },
  nico: { en: 'Nico', es: 'Nico' },
  mateo: { en: 'Mateo', es: 'Mateo' },
  chela: { en: 'Doña Chela', es: 'Doña Chela' },
  tomas: { en: 'Don Tomás', es: 'Don Tomás' },
  ramon: { en: 'Don Ramón', es: 'Don Ramón' },
  lucia: { en: 'Tía Lucía', es: 'Tía Lucía' },
  pancho: { en: 'Don Pancho', es: 'Don Pancho' },
  erendira: { en: 'Maestra Eréndira', es: 'Maestra Eréndira' },
  abuelo: { en: 'Abuelo Beto', es: 'Abuelo Beto' },
  mago: { en: 'Doña Mago', es: 'Doña Mago' },
};

const ABOUT = {
  en: `<h3>The Marigold Path</h3>
    <p class="lead">An educational point-and-click adventure about Día de Muertos (Day of the Dead).</p>
    <p>Lupita, her family and Santa María del Lago are made up. The town is inspired by the lake region of Michoacán, where Purépecha families keep vigils on the night of November 1. Every region, town and family in Mexico celebrates in its own way — and some families don't celebrate at all.</p>
    <p>The facts in this game were researched from Mexican institutions (INAH, INPI, the Secretaría de Cultura and other government agencies), UNESCO, museums like the Smithsonian and the National Museum of Mexican Art, and scholars. Open the <b>Book of Memories → Sources</b> to see them all.</p>
    <p>Everything you see and hear — the 3D art, the music, the sounds — was made with code. No photos of real people are used.</p>
    <div class="note">If your family celebrates Día de Muertos, you know things this game doesn't. Share them with your friends — that's how traditions stay alive.</div>`,
  es: `<h3>El Camino de Cempasúchil</h3>
    <p class="lead">Una aventura educativa de "apuntar y hacer clic" sobre el Día de Muertos.</p>
    <p>Lupita, su familia y Santa María del Lago son inventados. El pueblo está inspirado en la región del lago en Michoacán, donde las familias purépechas velan la noche del 1 de noviembre. Cada región, pueblo y familia de México lo celebra a su manera, y algunas familias no lo celebran.</p>
    <p>Los datos del juego se investigaron en instituciones mexicanas (INAH, INPI, Secretaría de Cultura y otras dependencias), la UNESCO, museos como el Smithsonian y el Museo Nacional de Arte Mexicano, y trabajos de especialistas. Abre el <b>Libro de los Recuerdos → Fuentes</b> para verlos todos.</p>
    <p>Todo lo que ves y oyes —el arte 3D, la música y los sonidos— se hizo con código. No se usan fotos de personas reales.</p>
    <div class="note">Si tu familia celebra el Día de Muertos, sabes cosas que este juego no sabe. Compártelas con tus amigos: así se mantienen vivas las tradiciones.</div>`,
};

const SCENES = {
  title: TitleScene, home: HomeScene, market: MarketScene, bakery: BakeryScene,
  workshop: WorkshopScene, plaza: PlazaScene, cemetery: CemeteryScene, free: FreeScene,
};

class Game {
  constructor() {
    this.state = loadState();
    setLang(this.state.settings.lang);
    document.body.classList.toggle('big', !!this.state.settings.big);
    document.body.classList.toggle('calm', !!this.state.settings.calm);
    this.engine = new Engine(document.getElementById('stage'));
    this.speech = new Speech();
    this.speech.enabled = !!this.state.settings.read;
    this.sound = new Sound();
    this.sound.setMusic(this.state.settings.music);
    this.sound.setSfx(this.state.settings.sfx);
    this.names = NAMES;
    this.chars = {};
    this.cache = { portrait: {}, card: {}, item: {} };
    this.ui = new UI(this);
    this.ui.setSoundIcon(this.state.settings.music || this.state.settings.sfx);
    this.sceneId = null;
    this.busy = false;
    // first gesture unlocks audio (browser rule)
    const unlock = () => { this.sound.ensure(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('keydown', (e) => this.onKey(e));
    window.__game = this; // handy for testing in the console
    document.querySelector('#rotate .btn')?.addEventListener('click', () => document.getElementById('rotate').classList.add('dismissed'));
  }

  async boot() {
    this.ui.loading(true, S.loading);
    try { await document.fonts?.ready; } catch { /* fonts are optional */ }
    const q = new URLSearchParams(location.search);
    const start = q.get('scene');
    if (q.has('reset')) this.reset(false);
    if (start && SCENES[start]) {
      if (q.has('cheat')) this.cheat(q.get('cheat'));
      await this.go(start, { quick: true, view: q.get('view') });
    } else {
      await this.go('title', { quick: true });
    }
    this.ui.loading(false);
  }

  // ---------------------------------------------------------------- scenes
  async go(id, opts = {}) {
    if (this.busy) return;
    this.busy = true;
    const Cls = SCENES[id];
    if (!opts.quick) await this.ui.fadeOut(opts.dayCard || null);
    this.ui.closeAllModals();
    this.ui.hideTray();
    this.ui.back(null);
    this.ui.setGoal(null);
    this.speech.stop();
    const stage = new Cls(this);
    this.sceneId = id;
    this.chars = {};
    await this.engine.setStage(stage, opts);
    this.chars = stage.chars || {};
    const isTitle = id === 'title';
    this.ui.showHud(!isTitle);
    if (!isTitle) {
      if (id !== 'free') this.state.scene = id; // "Continue" returns to the story, not free mode
      this.state.started = true;
      this.save();
      const place = PLACES.find((p) => p.scene === id);
      this.ui.setPlace(place?.name, stage.dayLabel?.() || '');
      this.refreshHud();
    }
    if (!opts.quick) await this.ui.fadeIn();
    this.busy = false;
    stage.afterEnter?.(opts);
  }

  // ---------------------------------------------------------------- progress
  has(k) { return !!this.state.flags[k]; }

  flag(k, v = true) {
    this.state.flags[k] = v;
    this.save();
    this.refreshHud();
  }

  save() { saveState(this.state); }

  reset(reload = true) {
    const keepSettings = this.state.settings;
    wipeState();
    this.state = freshState();
    this.state.settings = keepSettings;
    this.save();
    if (reload) location.href = location.pathname;
  }

  addPetals(n) {
    this.state.petals += n;
    this.ui.setPetals(this.state.petals, true);
    this.save();
  }

  // show a learning card; first time = new card + a marigold
  async learn(id, { force = false } = {}) {
    const card = CARD_BY_ID[id];
    if (!card) return;
    const isNew = !this.state.cards.includes(id);
    if (!isNew && !force) return;
    if (isNew) {
      this.state.cards.push(id);
      this.save();
    }
    await this.ui.showCard(card, { isNew });
    if (isNew) {
      this.addPetals(1);
      this.ui.setBookNew(true);
    }
  }

  knows(id) { return this.state.cards.includes(id); }

  // put something in the backpack (with a little flying animation)
  async give(id, from = null) {
    if (this.state.bag.includes(id)) return;
    this.state.bag.push(id);
    this.save();
    const img = await this.itemImage(id);
    this.ui.fly(img, from);
    this.sfx('pickup');
    this.ui.toast(`${t(S.addedToBag)}: <b>${t(this.itemInfo(id).name)}</b>`, { img });
    this.refreshHud();
  }

  take(id) {
    this.state.bag = this.state.bag.filter((x) => x !== id);
    this.save();
    this.refreshHud();
  }

  hasItem(id) { return this.state.bag.includes(id); }

  itemInfo(id) {
    return ITEMS[id] || { prop: id, name: HOME_ITEM_TEXT[id]?.name || (PROP_INFO[id] ? { en: PROP_INFO[id].en, es: PROP_INFO[id].es } : { en: id, es: id }) };
  }

  // the goal line under the HUD, computed from progress
  goalText() {
    const f = this.state.flags;
    if (!f.intro) return { en: 'Talk to Lupita — click on her!', es: 'Habla con Lupita: ¡haz clic en ella!' };
    if (!f.ofrenda) {
      const got = MARKET_LIST.filter((id) => this.hasItem(id) || (id === 'calavera-blanca' && this.hasItem('calavera')) || (id === 'papel-china' && this.hasItem('papel'))).length;
      const parts = [];
      if (got < MARKET_LIST.length) parts.push({ en: `Market ${got}/${MARKET_LIST.length}`, es: `Mercado ${got}/${MARKET_LIST.length}` });
      if (!f.pan) parts.push({ en: 'Bakery', es: 'Panadería' });
      if (!f.papel || !f.skull) parts.push({ en: 'Tía Lucía\'s workshop', es: 'Taller de Tía Lucía' });
      if (!parts.length) return { en: 'Everything is ready — go home and build the ofrenda!', es: '¡Todo listo! Ve a casa a poner la ofrenda.' };
      return { en: `Abuela's list: ${parts.map((p) => p.en).join(' · ')}  (open the Map!)`, es: `La lista de Abuela: ${parts.map((p) => p.es).join(' · ')}  (¡abre el Mapa!)` };
    }
    if (!f.plaza) return { en: 'November 1: go to the plaza (open the Map)', es: '1 de noviembre: ve a la plaza (abre el Mapa)' };
    if (!f.panteon) return { en: 'Tonight: the vigil at the panteón (open the Map)', es: 'Esta noche: la velación en el panteón (abre el Mapa)' };
    if (!f.ending) return { en: 'November 2: go home', es: '2 de noviembre: regresa a casa' };
    return { en: 'You finished the story! Try the Lotería or make your own ofrenda.', es: '¡Terminaste la historia! Juega la Lotería o haz tu propia ofrenda.' };
  }

  refreshHud() {
    this.ui.setPetals(this.state.petals);
    this.ui.setBagCount(this.state.bag.length);
    const unseen = this.state.cards.some((id) => !this.state.seenCards.includes(id));
    this.ui.setBookNew(unseen);
    if (this.sceneId && this.sceneId !== 'title') {
      // a scene can override the goal line, or return false to hide it
      const o = this.engine.stage?.goalOverride?.();
      this.ui.setGoal(o === false ? null : (o || this.goalText()));
    }
  }

  // ---------------------------------------------------------------- images
  // render a 3D prop/character to a PNG data URL once, then reuse it
  async propImage(spec, key) {
    if (key && this.cache.prop?.[key]) return this.cache.prop[key];
    let obj;
    if (spec.char) {
      obj = makeCharacter(spec.char).root;
      obj.updateMatrixWorld(true);
    } else if (CARD_PROPS[spec.prop]) {
      obj = CARD_PROPS[spec.prop](spec.opts || {});
      outline(obj, 0.004);
    } else if (spec.prop === 'foto' && spec.opts?.portrait) {
      const cv = await this.portraitCanvas(spec.opts.portrait);
      obj = photoFrame({ canvas: cv });
      outline(obj, 0.004);
    } else {
      const opts = { ...(spec.opts || {}) };
      if (opts.dataUrl) {
        const img = new Image();
        img.src = opts.dataUrl;
        try { await img.decode(); } catch { /* fall back to plain */ }
        const cv = document.createElement('canvas');
        cv.width = 512; cv.height = 256;
        cv.getContext('2d').drawImage(img, 0, 0, 512, 256);
        opts.canvas = cv;
        delete opts.dataUrl;
      }
      obj = makeProp(spec.prop, opts);
    }
    obj.traverse((o) => o.userData.update?.(1.3, 0.016));
    const url = this.engine.thumb(obj, { size: 256, dir: spec.dir || [0.45, 0.42, 1], fill: spec.fill || 0.78 });
    disposeTree(obj);
    if (key) (this.cache.prop ||= {})[key] = url;
    return url;
  }

  async cardImage(card) {
    if (!this.cache.card[card.id]) this.cache.card[card.id] = await this.propImage(card.pic, card.id);
    return this.cache.card[card.id];
  }

  async itemImage(id) {
    if (this.cache.item[id]) return this.cache.item[id];
    const info = this.itemInfo(id);
    let spec = { prop: info.prop || id, opts: info.propOpts || {} };
    if (id === 'foto') spec = { prop: 'foto', opts: { portrait: 'abuelo' } };
    if (id === 'calavera' && this.state.skull?.canvas) spec = { prop: 'calavera', opts: { dataUrl: this.state.skull.canvas } };
    const url = await this.propImage(spec, id);
    this.cache.item[id] = url;
    return url;
  }

  // a character's head, framed for the dialogue box
  async portrait(who) {
    if (this.cache.portrait[who]) return this.cache.portrait[who];
    const c = makeCharacter(who);
    c.update(0.016);
    c.root.updateMatrixWorld(true);
    const head = (c.j.head).getWorldPosition(new THREE.Vector3());
    const isDog = who === 'chispa';
    const url = this.engine.thumb(c.root, {
      size: 256, target: head.add(new THREE.Vector3(0, isDog ? 0.0 : -0.02, 0)), radius: isDog ? 0.22 : (c.R || 0.27) * 1.45,
      dir: [0.12, 0.05, 1], fill: 0.95,
    });
    disposeTree(c.root);
    this.cache.portrait[who] = url;
    return url;
  }

  async portraitCanvas(who) {
    const url = await this.portrait(who);
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = 200; cv.height = 260;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, '#f6d7a8'); g.addColorStop(1, '#d99c6a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 200, 260);
    ctx.drawImage(img, -28, 10, 256, 256);
    // a soft vignette, like an old photo
    const v = ctx.createRadialGradient(100, 130, 60, 100, 130, 160);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,30,10,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 200, 260);
    return cv;
  }

  // ---------------------------------------------------------------- panels
  openBook(tab) { openBook(this, tab); }

  openMap() { openMap(this); }

  async startFree() {
    const m = await import('./free.js');
    m.startFree(this);
  }

  async openLoteria() {
    const m = await import('./loteria.js');
    m.openLoteria(this);
  }

  openAbout() {
    const body = document.createElement('div');
    body.className = 'book';
    body.innerHTML = `<div class="page">${t(ABOUT)}</div>`;
    this.ui.modal({ title: S.credits, ico: 'info', body, cls: 'narrow' });
  }

  hint() {
    this.engine.flashHotspots();
    this.engine.stage?.onHint?.();
  }

  sfx(name) { this.sound.sfx(name); }

  toggleSound() {
    const s = this.state.settings;
    const on = !(s.music || s.sfx);
    s.music = on; s.sfx = on;
    this.sound.setMusic(on); this.sound.setSfx(on);
    this.ui.setSoundIcon(on);
    this.save();
    if (on) this.sfx('tap');
  }

  openMenu() {
    const s = this.state.settings;
    const body = document.createElement('div');
    body.className = 'mg';
    const row = (key, label, checked) => `<label class="opt"><input type="checkbox" data-k="${key}" ${checked ? 'checked' : ''}> ${t(label)}</label>`;
    body.innerHTML = `
      <button type="button" class="btn rosa" data-a="resume">${icon('play')} ${t(S.resume)}</button>
      <div class="row" style="flex-direction:column;align-items:stretch;gap:10px">
        <button type="button" class="btn cream" data-a="lang">${icon('globe')} ${t(S.language)}</button>
        ${row('music', S.music, s.music)}
        ${row('sfx', S.sound, s.sfx)}
        ${row('read', S.readAloud, s.read)}
        ${row('big', S.textSize, s.big)}
        ${row('calm', { en: 'Calm mode (less motion)', es: 'Modo tranquilo (menos movimiento)' }, s.calm)}
      </div>
      <div class="row">
        <button type="button" class="btn turq" data-a="book">${icon('book')} ${t(S.book)}</button>
        <button type="button" class="btn purple" data-a="title">${icon('home')} ${t(S.quitTitle)}</button>
      </div>
      <button type="button" class="btn cream small" data-a="reset">${icon('trash')} ${t(S.reset)}</button>`;
    const m = this.ui.modal({ title: S.menu, ico: 'gear', body, cls: 'narrow' });
    body.querySelectorAll('input[data-k]').forEach((inp) => {
      inp.onchange = () => {
        const k = inp.dataset.k;
        s[k] = inp.checked;
        if (k === 'music') this.sound.setMusic(s.music);
        if (k === 'sfx') this.sound.setSfx(s.sfx);
        if (k === 'read') { this.speech.enabled = s.read; if (s.read) this.speech.line(t({ en: 'I will read the story out loud.', es: 'Voy a leer la historia en voz alta.' }), getLang()); }
        if (k === 'big') document.body.classList.toggle('big', s.big);
        if (k === 'calm') document.body.classList.toggle('calm', s.calm);
        this.ui.setSoundIcon(s.music || s.sfx);
        this.save();
      };
    });
    body.querySelector('[data-a=resume]').onclick = () => m.close();
    body.querySelector('[data-a=lang]').onclick = () => { m.close(); this.toggleLang(); };
    body.querySelector('[data-a=book]').onclick = () => { m.close(); this.openBook(); };
    body.querySelector('[data-a=title]').onclick = () => { m.close(); this.go('title'); };
    body.querySelector('[data-a=reset]').onclick = () => {
      if (window.confirm(t(S.resetConfirm))) this.reset(true);
    };
  }

  toggleLang() {
    const lang = getLang() === 'en' ? 'es' : 'en';
    this.state.settings.lang = lang;
    setLang(lang);
    this.save();
    this.ui.relabel();
    this.refreshHud();
    const place = PLACES.find((p) => p.scene === this.sceneId);
    if (place) this.ui.setPlace(place.name, this.engine.stage?.dayLabel?.() || '');
    this.engine.stage?.onLang?.();
  }

  onKey(e) {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    const uiOpen = !this.ui.el.dialog.classList.contains('hidden') || this.ui.modalStack.length || !this.ui.el.card.classList.contains('hidden');
    if (e.key === 'Tab' && !uiOpen && this.sceneId !== 'title') {
      e.preventDefault();
      this.engine.focusNext(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Enter' && !uiOpen && this.engine.hovered && document.activeElement === document.body) {
      this.engine.activateFocused();
    } else if ((e.key === 'm' || e.key === 'M') && !uiOpen && this.sceneId !== 'title') {
      this.openMap();
    } else if ((e.key === 'h' || e.key === 'H') && !uiOpen) {
      this.hint();
    }
  }

  // test helper: jump ahead in the story (?cheat=market|ofrenda|plaza|panteon|end)
  cheat(level) {
    const f = this.state.flags;
    const order = ['intro', 'market', 'pan', 'workshop', 'ofrenda', 'plaza', 'panteon', 'ending'];
    const upto = order.indexOf(level);
    if (upto >= 0) f.intro = true;
    if (upto >= 1) for (const id of MARKET_LIST) if (!this.state.bag.includes(id)) this.state.bag.push(id);
    if (upto >= 2) { f.pan = true; this.state.bag.push('pan'); }
    if (upto >= 3) {
      f.papel = true; f.skull = true;
      this.state.bag = this.state.bag.filter((x) => x !== 'papel-china' && x !== 'calavera-blanca');
      this.state.bag.push('papel', 'calavera');
    }
    if (upto >= 4) {
      f.ofrenda = true;
      f.buildIntro = true;
      if (!this.state.ofrenda) {
        // a sample ofrenda so later scenes have something to show
        this.state.ofrenda = {
          levels: 3,
          extras: ['arco', 'papel', 'petate'],
          items: [['foto', 2, 0, -0.1], ['calavera', 2, 0.3, -0.1], ['xolo', 2, -0.3, -0.1], ['agua', 1, -0.3, -0.1], ['sal', 1, 0.3, -0.1], ['pan', 1, 0, -0.08],
            ['tamales', 1, -0.55, -0.1], ['cafe', 1, 0.55, -0.1], ['velas', 0, -0.75, 0.25], ['velas', 0, 0.75, 0.25], ['velas', 0, -0.35, 0.3], ['velas', 0, 0.35, 0.3],
            ['cempasuchil', 0, -0.62, 0.1], ['cempasuchil', 0, 0.62, 0.1], ['fruta', 0, 0, 0.22], ['guitarra', 0, -0.15, 0.05], ['copal', 0, 0.2, 0.3], ['domino', 0, 0.42, 0.12]]
            .map(([id, tier, x, z]) => ({ id, tier, x, z })),
        };
        this.state.pan ||= { topping: 'sugar', bones: 4 };
      }
    }
    if (upto >= 5) f.plaza = true;
    if (upto >= 6) f.panteon = true;
    if (upto >= 7) f.ending = true;
    this.state.bag = [...new Set(this.state.bag)];
    this.save();
  }
}

const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.querySelector('.msg').textContent = `Oops: ${e.message}`;
});
