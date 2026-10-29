// The ofrenda builder. Choose the levels, then place things anywhere you like:
// there is no score and no "wrong" ofrenda. Abuela's wishes are story goals,
// and the four-elements strip is shown as one way people explain an ofrenda.
import * as THREE from 'three';
import { toon, box, mesh, PAL, mkCanvas, tex } from '../toon.js';
import { makeProp, PROP_INFO } from '../props.js';
import { papelString } from '../world.js';
import { papelCanvases } from './papel.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';

// which items can be placed more than once
const MULTI = { vela: 4, velas: 4, cempasuchil: 2, fruta: 1 };
// item id (backpack) → prop id
const PROP_OF = { velas: 'vela' };
const ELEMENT = {
  earth: ['pan', 'tamales', 'fruta', 'mole', 'chocolate', 'cafe', 'calabaza', 'atole', 'pizza', 'refresco', 'galletas', 'cempasuchil'],
  water: ['agua', 'jarrito', 'lavamanos'],
  fire: ['velas', 'vela', 'cirio'],
  wind: ['papel', 'copal'],
};

export const WISHES = [
  { id: 'foto', any: ['foto'], txt: { en: 'Abuelo\'s photo', es: 'La foto del Abuelo' } },
  { id: 'agua', any: ['agua', 'jarrito'], txt: { en: 'Water for the journey', es: 'Agua para el camino' } },
  { id: 'luz', any: ['velas', 'vela', 'cirio'], txt: { en: 'Candles to light the way', es: 'Velas para alumbrar' } },
  { id: 'flor', any: ['cempasuchil', 'terciopelo', 'nube'], txt: { en: 'Marigolds', es: 'Cempasúchil' } },
  { id: 'comida', any: ['pan', 'tamales', 'fruta', 'chocolate', 'cafe'], txt: { en: 'Something he liked to eat', es: 'Algo que le gustaba comer' } },
  { id: 'suyo', any: ['guitarra', 'domino', 'lentes', 'gorra'], txt: { en: 'One of his own things', es: 'Algo suyo' } },
];

export const LEVEL_INFO = {
  1: { en: 'One table — very common! Many families simply use a table.', es: 'Una mesa: ¡muy común! Muchas familias usan solo una mesa.' },
  2: { en: 'Two levels: some say they stand for heaven and earth.', es: 'Dos niveles: hay quien dice que son el cielo y la tierra.' },
  3: { en: 'Three levels: some say heaven, earth and the underworld; others say the Holy Trinity.', es: 'Tres niveles: hay quien dice cielo, tierra e inframundo; otros, la Santísima Trinidad.' },
  7: { en: 'Seven levels: some say they are the steps the soul passes on its journey.', es: 'Siete niveles: hay quien dice que son los pasos del alma en su viaje.' },
};

export class OfrendaBuilder {
  // scene: a Scene; base: Group of the table (top at baseY), mode 'story' | 'free'
  constructor(scene, { base, baseY = 0.78, width = 1.8, depth = 0.8, mode = 'story', portrait = null, wishes = WISHES }) {
    this.sc = scene;
    this.game = scene.game;
    this.engine = scene.engine;
    this.base = base;
    this.baseY = baseY;
    this.W = width;
    this.D = depth;
    this.mode = mode;
    this.portrait = portrait;
    this.wishes = wishes;
    this.root = new THREE.Group();
    base.add(this.root);
    this.tiers = [];
    this.placed = [];
    this.holding = null;
    this.levels = 0;
    this.extras = {};
    this.counts = {};
    this.cursor = this.makeCursor();
    this.root.add(this.cursor);
  }

  makeCursor() {
    const ring = mesh(new THREE.RingGeometry(0.06, 0.085, 24), new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.85, depthWrite: false }), { cast: false });
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ring.renderOrder = 5;
    ring.raycast = () => {};
    return ring;
  }

  // ---------------------------------------------------------------- tiers
  setLevels(n) {
    for (const t0 of this.tiers) { this.root.remove(t0.mesh); this.root.remove(t0.pick); }
    this.tiers = [];
    this.levels = n;
    const back = -this.D / 2;
    const h = n <= 3 ? 0.24 : 0.12;
    const clothM = toon('#ffffff', { map: clothTex(), rim: 0 });
    // level 0 is the tabletop with its cloth
    const cloth = box(this.W + 0.06, 0.03, this.D + 0.06, clothM);
    cloth.position.y = this.baseY + 0.015;
    cloth.castShadow = false;
    this.root.add(cloth);
    const skirt = box(this.W + 0.07, 0.34, 0.012, toon('#ffffff', { map: skirtTex(), rim: 0, transparent: true, alphaTest: 0.4 }));
    skirt.position.set(0, this.baseY - 0.15, this.D / 2 + 0.035);
    skirt.castShadow = false;
    this.root.add(skirt);
    this.tiers.push({ y: this.baseY + 0.03, x0: -this.W / 2 + 0.1, x1: this.W / 2 - 0.1, z0: back + (n > 1 ? this.D * (1 - 1 / n) * 0 : 0) + 0.06, z1: this.D / 2 - 0.08, mesh: cloth });
    for (let i = 1; i < n; i++) {
      const depth = this.D * (1 - i / n);
      const w = this.W - i * (n <= 3 ? 0.22 : 0.1);
      const tier = box(w, h, depth, clothM);
      const yTop = this.baseY + 0.03 + i * h;
      tier.position.set(0, yTop - h / 2, back + depth / 2);
      this.root.add(tier);
      const trim = box(w + 0.005, 0.03, 0.01, toon([PAL.rosa, PAL.marigold, PAL.turquoise, PAL.purple][i % 4], { rim: 0 }));
      trim.position.set(0, yTop - 0.02, back + depth + 0.003);
      trim.castShadow = false;
      this.root.add(trim);
      this.tiers.push({ y: yTop, x0: -w / 2 + 0.08, x1: w / 2 - 0.08, z0: back + 0.05, z1: back + depth - 0.06, mesh: tier, extra: [trim] });
    }
    // the visible strip of each lower tier stops where the next tier begins
    for (let i = 0; i < this.tiers.length - 1; i++) {
      const next = this.tiers[i + 1];
      this.tiers[i].z0 = next.z1 + 0.1;
    }
    // invisible pick planes
    for (const tr of this.tiers) {
      const pick = new THREE.Mesh(new THREE.PlaneGeometry(tr.x1 - tr.x0 + 0.08, Math.max(0.06, tr.z1 - tr.z0 + 0.08)), new THREE.MeshBasicMaterial({ visible: false }));
      pick.rotation.x = -Math.PI / 2;
      pick.position.set((tr.x0 + tr.x1) / 2, tr.y + 0.002, (tr.z0 + tr.z1) / 2);
      pick.userData.tier = tr;
      this.root.add(pick);
      tr.pick = pick;
    }
    this.game.sfx('whoosh');
  }

  topY() { return this.tiers.length ? this.tiers[this.tiers.length - 1].y : this.baseY; }

  // ---------------------------------------------------------------- items
  propFor(id) { return PROP_OF[id] || id; }

  build(id) {
    const pid = this.propFor(id);
    let opts = {};
    if (pid === 'foto') {
      opts = { canvas: this.portrait };
    } else if (pid === 'calavera' && this.game.state.skull?.canvas && this.mode === 'story') {
      opts = { dataUrl: this.game.state.skull.canvas };
    } else if (pid === 'pan') {
      opts = { topping: this.game.state.pan?.topping || 'sugar' };
    } else if (pid === 'vela') {
      opts = { glass: [PAL.red, PAL.purple, '#f7e4c8', PAL.marigold][(this.counts[id] || 0) % 4] };
    }
    const obj = makeProp(pid, opts);
    obj.userData.itemId = id;
    return obj;
  }

  remaining(id) {
    const max = this.multi?.[id] || MULTI[id] || 1;
    return max - (this.counts[id] || 0);
  }

  pick(id) {
    if (this.remaining(id) <= 0) {
      this.game.sfx('oops');
      return false;
    }
    // special items place themselves
    if (id === 'arco' || id === 'papel' || id === 'petate') {
      this.placeSpecial(id);
      return true;
    }
    this.drop();
    this.holding = { id, obj: this.build(id) };
    this.holding.obj.visible = false;
    this.root.add(this.holding.obj);
    this.game.sfx('tap');
    return true;
  }

  drop() {
    if (!this.holding) return;
    this.root.remove(this.holding.obj);
    this.holding = null;
    this.cursor.visible = false;
  }

  placeSpecial(id) {
    if (this.extras[id]) return;
    let obj;
    if (id === 'arco') {
      obj = makeProp('arco', { w: this.W + 0.3, h: Math.max(1.75, this.topY() - this.baseY + 1.0) });
      obj.position.set(0, this.baseY - 0.75, -this.D / 2 - 0.02);
    } else if (id === 'papel') {
      obj = papelString([-this.W / 2 - 0.25, 0, 0], [this.W / 2 + 0.25, 0, 0], { sheetW: 0.26, sag: 0.08, customs: this.mode === 'story' ? papelCanvases(this.game.state.papel, 96) : null, seed: 7 });
      obj.position.set(0, this.topY() + 0.95, -this.D / 2 + 0.05);
      this.sc.animateTree(obj);
    } else if (id === 'petate') {
      obj = makeProp('petate');
      obj.position.set(0, -this.baseY + 0.002, this.D / 2 + 0.55);
    }
    obj.userData.itemId = id;
    this.root.add(obj);
    this.extras[id] = obj;
    this.counts[id] = 1;
    this.afterChange(id);
    this.game.sfx('success');
    popIn(this.engine, obj);
  }

  // pointer helpers (called by the scene's pointer handlers)
  hover() {
    if (!this.holding) return;
    const hits = this.engine.raycastObjects(this.tiers.map((x) => x.pick));
    if (!hits.length) {
      this.holding.obj.visible = false;
      this.cursor.visible = false;
      return;
    }
    const h = hits[0];
    const tr = h.object.userData.tier;
    const local = this.root.worldToLocal(h.point.clone());
    const x = THREE.MathUtils.clamp(local.x, tr.x0, tr.x1);
    const z = THREE.MathUtils.clamp(local.z, tr.z0, Math.max(tr.z0, tr.z1));
    this.holding.obj.visible = true;
    this.holding.obj.position.set(x, tr.y + 0.04, z);
    this.holding.obj.rotation.y = -x * 0.25;
    this.cursor.visible = true;
    this.cursor.position.set(x, tr.y + 0.006, z);
    this.holding.tier = tr;
  }

  // place what we're holding; returns the placed record or null
  place() {
    const h = this.holding;
    if (!h || !h.obj.visible || !h.tier) return null;
    h.obj.position.y = h.tier.y;
    const rec = { id: h.id, obj: h.obj, tier: this.tiers.indexOf(h.tier), x: h.obj.position.x, z: h.obj.position.z };
    this.placed.push(rec);
    this.counts[h.id] = (this.counts[h.id] || 0) + 1;
    this.holding = null;
    this.cursor.visible = false;
    this.makeClickable(rec);
    popIn(this.engine, rec.obj);
    this.game.sfx('bean');
    this.afterChange(rec.id);
    return rec;
  }

  makeClickable(rec) {
    this.sc.hot(rec.obj, () => ({ en: `Move ${PROP_INFO[this.propFor(rec.id)]?.en || ''}`, es: `Mover ${PROP_INFO[this.propFor(rec.id)]?.es || ''}` }), async () => {
      if (this.holding || this.locked) return;
      this.unplace(rec);
    }, { sparkle: false, nested: true, enabled: () => !this.locked && !this.holding });
  }

  unplace(rec) {
    this.engine.removeHotspot(rec.obj);
    this.placed = this.placed.filter((r) => r !== rec);
    this.counts[rec.id] = Math.max(0, (this.counts[rec.id] || 1) - 1);
    this.holding = { id: rec.id, obj: rec.obj };
    rec.obj.visible = false;
    this.afterChange(rec.id);
    this.game.sfx('tap');
  }

  afterChange(id) {
    this.onChange?.(id);
  }

  has(id) { return (this.counts[id] || 0) > 0; }

  wishState() {
    return this.wishes.map((w) => ({ ...w, ok: w.any.some((i) => this.has(i)) }));
  }

  elements() {
    const out = {};
    for (const [k, ids] of Object.entries(ELEMENT)) out[k] = ids.some((i) => this.has(i));
    return out;
  }

  candles() {
    const list = [];
    for (const r of this.placed) if (r.obj.userData.light && (r.id === 'velas' || r.id === 'vela' || r.id === 'cirio')) list.push(r);
    return list;
  }

  copals() { return this.placed.filter((r) => r.id === 'copal'); }

  // ---------------------------------------------------------------- save/load
  serialize() {
    return {
      levels: this.levels,
      items: this.placed.map((r) => ({ id: r.id, tier: r.tier, x: +r.x.toFixed(3), z: +r.z.toFixed(3) })),
      extras: Object.keys(this.extras),
    };
  }

  load(data, { lit = false } = {}) {
    if (!data) return;
    this.setLevels(data.levels || 1);
    for (const e of data.extras || []) this.placeSpecial(e);
    for (const it of data.items || []) {
      const tr = this.tiers[Math.min(it.tier, this.tiers.length - 1)];
      const obj = this.build(it.id);
      obj.position.set(it.x, tr.y, it.z);
      obj.rotation.y = -it.x * 0.25;
      this.root.add(obj);
      const rec = { id: it.id, obj, tier: it.tier, x: it.x, z: it.z };
      this.placed.push(rec);
      this.counts[it.id] = (this.counts[it.id] || 0) + 1;
      if (lit) obj.userData.light?.(true);
    }
    this.sc.animateTree(this.root);
  }

  lock() {
    this.locked = true;
    this.drop();
  }
}

// a little bounce when something lands
function popIn(engine, obj) {
  const s = obj.scale.clone();
  engine.tween(0.35, (k) => {
    const b = 1 + Math.sin(k * Math.PI) * 0.25;
    obj.scale.set(s.x * b, s.y * (2 - b), s.z * b);
  }, 'out').then(() => obj.scale.copy(s));
}

let _cloth = null;
function clothTex() {
  if (_cloth) return _cloth;
  const cv = mkCanvas(128, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(200,180,150,0.25)';
  for (let i = 0; i < 128; i += 4) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke(); }
  _cloth = tex(cv);
  _cloth.userData.shared = true;
  return _cloth;
}

let _skirt = null;
function skirtTex() {
  if (_skirt) return _skirt;
  // embroidered hem with scalloped edge
  const cv = mkCanvas(512, 96);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, 512, 80);
  ctx.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < 512; x += 32) { ctx.beginPath(); ctx.arc(x + 16, 92, 16, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  const cols = [PAL.rosa, PAL.marigold, PAL.turquoise, PAL.purple];
  for (let i = 0; i < 16; i++) {
    const x = 16 + i * 32, y = 46;
    ctx.fillStyle = cols[i % 4];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 3.5, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PAL.gold;
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = PAL.rosa;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(512, 18); ctx.stroke();
  _skirt = tex(cv);
  _skirt.userData.shared = true;
  return _skirt;
}

// UI panel for the builder (goes in the tray's side area)
export function wishesHtml(builder, mode) {
  const ws = builder.wishState();
  const el = builder.elements();
  const E = { earth: { en: 'Earth', es: 'Tierra' }, wind: { en: 'Wind', es: 'Viento' }, water: { en: 'Water', es: 'Agua' }, fire: { en: 'Fire', es: 'Fuego' } };
  const wishes = mode === 'story' ? `<div style="font:16px var(--display);color:var(--purple-d)">${t({ en: 'Abuela\'s wishes', es: 'Lo que pidió Abuela' })}</div>` + ws.map((w) => `<div style="font-weight:800;font-size:14px;display:flex;gap:4px;align-items:center;opacity:${w.ok ? 1 : 0.7}">${w.ok ? icon('check') : '○'} ${t(w.txt)}</div>`).join('') : '';
  return `${wishes}<div style="font:14px var(--display);color:var(--purple-d);margin-top:4px">${t({ en: 'The four elements (one way to explain it)', es: 'Los cuatro elementos (una forma de explicarlo)' })}</div><div class="elements">${Object.keys(E).map((k) => `<span class="${el[k] ? 'on' : ''}">${t(E[k])}</span>`).join('')}</div>`;
}
