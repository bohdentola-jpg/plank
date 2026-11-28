// House UI: the NEST & NOOK catalog (a laptop on your desk), the decorate-mode
// tray, the key-hint bar, and 3D thumbnails rendered from the real models.
import * as THREE from 'three';
import { FURNITURE, FURNITURE_IDS, CATS, WALLPAPERS, FLOORS, styleThumb, isSharedGeo } from '../world/furniture.js';

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------------------------------------------------------------- thumbnails
const THUMBS = new Map(); // `${id}|${ink}` -> data URL (kept for the whole session)
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export class Thumbs {
  constructor(renderer, kit, envTex) {
    this.r = renderer; this.kit = kit; this.ink = kit.inkHex;
    this.queue = []; this.waiting = new Set();
    const S = this.size = 160;
    this.scene = new THREE.Scene();
    this.scene.environment = envTex || null;
    this.scene.add(new THREE.HemisphereLight(0xfff4e8, 0x8a7f90, 1.3));
    const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(3, 5, 4); this.scene.add(d);
    const d2 = new THREE.DirectionalLight(0xffd9f0, 0.8); d2.position.set(-4, 2, -2); this.scene.add(d2);
    this.cam = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
    // rendered at 2x and averaged down for smooth edges
    this.rt = new THREE.WebGLRenderTarget(S * 2, S * 2, { type: THREE.FloatType });
    this.buf = new Float32Array(S * S * 16);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = S;
  }
  key(id) { return id + '|' + this.ink; }
  get(id) {
    const v = THUMBS.get(this.key(id));
    if (v) return v;
    if (!this.waiting.has(id)) { this.waiting.add(id); this.queue.push(id); }
    return null;
  }
  // render a few per frame; returns ids finished
  pump(n = 2) {
    const done = [];
    while (n-- > 0 && this.queue.length) {
      const id = this.queue.shift();
      this.waiting.delete(id);
      try { THUMBS.set(this.key(id), this.render(id)); } catch (e) { console.warn('thumb', id, e); THUMBS.set(this.key(id), BLANK); }
      done.push(id);
    }
    return done;
  }
  render(id) {
    const def = FURNITURE[id];
    const built = def.build(this.kit, { trophies: 3 });
    const g = built.group;
    built.update?.(1.2, 0.016, { on: true, dirty: true }, { party: false });
    this.scene.add(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const c = sph.center, rad = Math.max(0.12, sph.radius);
    const dist = rad / Math.sin(THREE.MathUtils.degToRad(this.cam.fov / 2)) * 1.02;
    const wall = def.kind === 'wall';
    const yaw = wall ? 0.32 : 0.62, pitch = wall ? 0.12 : 0.45;
    this.cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * dist, c.y + Math.sin(pitch) * dist, c.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.cam.lookAt(c);
    const r = this.r;
    const prevRT = r.getRenderTarget(), prevC = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha();
    const prevShadow = r.shadowMap.enabled;
    r.shadowMap.enabled = false;
    r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear();
    r.render(this.scene, this.cam);
    const S = this.size, out = this.canvas.getContext('2d'), img = out.createImageData(S, S);
    let ok = true;
    try { r.readRenderTargetPixels(this.rt, 0, 0, S * 2, S * 2, this.buf); } catch { ok = false; }
    r.setRenderTarget(prevRT); r.setClearColor(prevC, prevA); r.shadowMap.enabled = prevShadow;
    this.scene.remove(g);
    // free the one-off parts (screens, merged books...); cached geometry + kit materials stay
    const kitMats = new Set(this.kit.cache.values());
    g.traverse((m) => {
      if (m.geometry && !isSharedGeo(m.geometry)) m.geometry.dispose();
      const mt = m.material;
      if (mt && !kitMats.has(mt)) { mt.map?.dispose(); mt.emissiveMap?.dispose(); mt.dispose(); }
    });
    if (!ok) return BLANK;
    // ACES-ish tonemap + sRGB, flip Y
    const tm = (v) => { v *= 1.05; v = (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14); v = Math.min(1, Math.max(0, v)); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
    const B = this.buf, W2 = S * 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let r0 = 0, g0 = 0, b0 = 0, a0 = 0;
      for (let k = 0; k < 4; k++) {
        const i = (((S - 1 - y) * 2 + (k >> 1)) * W2 + x * 2 + (k & 1)) * 4;
        const a = Math.min(1, Math.max(0, B[i + 3]));
        r0 += B[i] * a; g0 += B[i + 1] * a; b0 += B[i + 2] * a; a0 += a;
      }
      const o = (y * S + x) * 4, inv = a0 > 0 ? 1 / a0 : 0;
      img.data[o] = tm(r0 * inv) * 255; img.data[o + 1] = tm(g0 * inv) * 255; img.data[o + 2] = tm(b0 * inv) * 255;
      img.data[o + 3] = (a0 / 4) * 255;
    }
    out.putImageData(img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }
  dispose() { this.rt.dispose(); }
}

// ---------------------------------------------------------------- UI
export class HouseUI {
  constructor(house) {
    this.house = house;
    this.app = house.app;
    this.menus = this.app.menus;
    this.thumbs = new Thumbs(this.app.renderer, house.kit, house.scene.environment);
    this.styleCache = new Map();
    this.hintEl = el('<div id="house-hint"></div>');
    document.body.appendChild(this.hintEl);
  }
  sfx(n) { this.app.audio?.sfx(n); }
  setKit(kit) { this.thumbs.kit = kit; this.thumbs.ink = kit.inkHex; this.thumbs.queue = []; this.thumbs.waiting.clear(); this.styleCache.clear(); }

  hint(html) { if (this.hintEl._h !== html) { this.hintEl._h = html; this.hintEl.innerHTML = html; } this.hintEl.classList.toggle('on', !!html); }

  thumb(id) { return this.thumbs.get(id) || BLANK; }
  styleImg(kind, id) {
    const k = kind + id;
    if (!this.styleCache.has(k)) this.styleCache.set(k, styleThumb(kind, id, this.house.kit.inkHex));
    return this.styleCache.get(k);
  }
  // call every frame: finish a couple of thumbnails and swap them into the DOM
  update() {
    if (!this.thumbs.queue.length) return;
    for (const id of this.thumbs.pump(this.app.qualityPreset === 'qa' ? 1 : 2)) {
      const src = this.thumbs.get(id);
      document.querySelectorAll(`img[data-thumb="${id}"]`).forEach((im) => { im.src = src; im.classList.add('ready'); });
    }
  }
  img(id, cls = '') { const t = this.thumbs.get(id); return `<img class="hthumb ${cls} ${t ? 'ready' : ''}" data-thumb="${id}" src="${t || BLANK}" alt="">`; }

  // ------------------------------------------------------------ catalog
  catalog({ onBuy, onBuyStyle, onApplyStyle, onPlace, onDecorate, onClose, startTab = 'all' }) {
    const app = this.app, p = app.profile, H = p.house;
    let tab = startTab, sel = null, selStyle = null;
    const tabs = [['all', 'All'], ...Object.entries(CATS), ['styles', 'Walls & Floors']];
    const node = el(`<div class="overlay side-right hcat"><div class="panel shopwide">
      <div class="shop-head"><h2>NEST &amp; NOOK</h2><div class="coins"><span class="coin">◉</span> <b class="cv"></b></div></div>
      <div class="tabs hc-tabs">${tabs.map(([k, v]) => `<button class="chip" data-tab="${k}">${v}</button>`).join('')}</div>
      <div class="shop-cols hc-cols"><div class="hc-grid"></div><div class="shop-detail hc-detail"></div></div>
      <div class="hc-actions"><button class="btn ghost" data-back>CLOSE</button><button class="btn" data-a="deco">🛋 DECORATE</button></div>
    </div></div>`);
    const close = this.menus.open(node);
    this._catClose = () => { close(); this._catClose = null; this._catRender = null; };
    const grid = node.querySelector('.hc-grid'), det = node.querySelector('.hc-detail');
    const placed = (id) => H.items.filter((i) => i.id === id).length;
    const ownedN = (id) => H.owned[id] || 0;
    const render = () => {
      node.querySelector('.cv').textContent = p.coins.toLocaleString();
      node.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('sel', b.dataset.tab === tab));
      if (tab === 'styles') {
        const card = (kind, id, d) => {
          const own = (kind === 'wall' ? H.walls : H.floors).includes(id), cur = (kind === 'wall' ? H.wall : H.floor) === id;
          return `<button class="hcard style ${selStyle?.id === id && selStyle?.kind === kind ? 'sel' : ''} ${own ? 'own' : ''}" data-style="${kind}:${id}"><img class="hthumb ready" src="${this.styleImg(kind, id)}" alt=""><b>${d.name}</b><small>${cur ? '★ IN USE' : own ? 'OWNED' : `◉ ${d.price}`}</small></button>`;
        };
        grid.innerHTML = `<h3 class="hc-sec">Wallpaper</h3>${Object.entries(WALLPAPERS).map(([id, d]) => card('wall', id, d)).join('')}<h3 class="hc-sec">Floors</h3>${Object.entries(FLOORS).map(([id, d]) => card('floor', id, d)).join('')}`;
        if (!selStyle) selStyle = { kind: 'wall', id: H.wall };
        const d = (selStyle.kind === 'wall' ? WALLPAPERS : FLOORS)[selStyle.id];
        const own = (selStyle.kind === 'wall' ? H.walls : H.floors).includes(selStyle.id), cur = (selStyle.kind === 'wall' ? H.wall : H.floor) === selStyle.id;
        let action;
        if (cur) action = '<div class="tag eq">IN USE</div>';
        else if (own) action = '<button class="btn" data-apply>APPLY</button>';
        else action = `<button class="btn buy" data-buys ${p.coins < d.price ? 'disabled' : ''}><span class="coin">◉</span> ${d.price.toLocaleString()}</button>`;
        det.innerHTML = `<img class="hc-big style" src="${this.styleImg(selStyle.kind, selStyle.id)}" alt="">
          <div class="wd-cls">${selStyle.kind === 'wall' ? 'WALLPAPER' : 'FLOORING'}</div><div class="wd-name">${d.name}</div>
          <div class="wc-desc">${selStyle.kind === 'wall' ? 'Covers every wall in the house.' : 'Covers the whole floor (the entry tiles stay).'} Buy once, switch any time.</div>
          <div class="wd-actions">${action}</div>`;
      } else {
        const ids = FURNITURE_IDS.filter((id) => (tab === 'all' || FURNITURE[id].cat === tab) && !FURNITURE[id].fixed);
        if (!sel || !ids.includes(sel)) sel = ids[0];
        grid.innerHTML = ids.map((id) => {
          const d = FURNITURE[id], n = ownedN(id);
          return `<button class="hcard ${id === sel ? 'sel' : ''} ${n ? 'own' : ''}" data-id="${id}">${this.img(id)}<b>${esc(d.name)}</b><small>◉ ${d.price}${n ? ` · <em>×${n}</em>` : ''}</small></button>`;
        }).join('');
        const d = FURNITURE[sel], n = ownedN(sel), free = n - placed(sel);
        const kind = { floor: 'Furniture', small: 'Tabletop · goes on tables too', rug: 'Rug', wall: 'Wall decor' }[d.kind];
        det.innerHTML = `${this.img(sel, 'hc-big')}
          <div class="wd-cls">${CATS[d.cat].toUpperCase()} · ${kind}</div>
          <div class="wd-name">${esc(d.name)}</div>
          <div class="wc-desc">${esc(d.desc)}</div>
          <div class="hc-own">${n ? `You own <b>${n}</b>${free ? ` · <b>${free}</b> in storage` : ' · all placed'}` : 'Not owned yet'}</div>
          <div class="wd-actions"><button class="btn buy" data-buy ${p.coins < d.price ? 'disabled' : ''}><span class="coin">◉</span> ${d.price.toLocaleString()}</button>${free ? '<button class="btn ghost small" data-place>PLACE IT</button>' : ''}</div>
          <p class="hint">Buying adds it to your storage. Press <b>F</b> (or DECORATE) to place it.</p>`;
      }
      det.scrollTop = 0;
      grid.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => { sel = b.dataset.id; this.sfx('ui_move'); render(); });
      grid.querySelectorAll('[data-style]').forEach((b) => b.onclick = () => { const [kind, id] = b.dataset.style.split(':'); selStyle = { kind, id }; this.sfx('ui_move'); render(); });
      node.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; this.sfx('ui_move'); render(); });
      det.querySelector('[data-buy]')?.addEventListener('click', () => { if (onBuy(sel)) { this.sfx('buy'); render(); } else this.sfx('ui_error'); });
      det.querySelector('[data-place]')?.addEventListener('click', () => { this.sfx('ui_select'); this._catClose(); onPlace(sel); });
      det.querySelector('[data-buys]')?.addEventListener('click', () => { if (onBuyStyle(selStyle.kind, selStyle.id)) { this.sfx('buy'); render(); } else this.sfx('ui_error'); });
      det.querySelector('[data-apply]')?.addEventListener('click', () => { onApplyStyle(selStyle.kind, selStyle.id); this.sfx('ui_select'); render(); });
    };
    this._catRender = render;
    render();
    node.querySelector('[data-back]').onclick = () => { this.sfx('ui_back'); this._catClose(); onClose(); };
    node.querySelector('[data-a="deco"]').onclick = () => { this.sfx('ui_select'); this._catClose(); onDecorate(); };
    this.menus.padNav(node);
    return { close: () => this._catClose?.(), render };
  }
  catalogOpen() { return !!this._catClose; }

  // ------------------------------------------------------------ decorate tray
  decoTray({ onPick, onStyle, onCatalog, onDone }) {
    const app = this.app, H = app.profile.house;
    const node = el(`<div id="house-deco">
      <div class="hd-top"><b class="hd-title">DECORATE</b><span class="hd-help"></span><span class="hd-sp"></span>
        <button class="btn small ghost" data-a="cat">🛒 CATALOG</button><button class="btn small" data-a="done">DONE <kbd>F</kbd></button></div>
      <div class="hd-row"><div class="hd-inv"></div><div class="hd-styles"></div></div>
    </div>`);
    document.body.appendChild(node);
    requestAnimationFrame(() => node.classList.add('on'));
    const inv = node.querySelector('.hd-inv'), sty = node.querySelector('.hd-styles');
    const render = () => {
      const ids = FURNITURE_IDS.filter((id) => (H.owned[id] || 0) - H.items.filter((i) => i.id === id).length > 0);
      inv.innerHTML = ids.length ? ids.map((id) => {
        const n = (H.owned[id] || 0) - H.items.filter((i) => i.id === id).length;
        return `<button class="hd-card" data-id="${id}" title="${esc(FURNITURE[id].name)}">${this.img(id)}<span>${esc(FURNITURE[id].name)}</span><i>×${n}</i></button>`;
      }).join('') : '<div class="hd-empty">Storage is empty. Click furniture in the room to move it, or buy more in the <b>catalog</b>.</div>';
      sty.innerHTML = `<div class="hd-sty"><small>WALLS</small>${H.walls.map((id) => `<button class="hd-sw ${H.wall === id ? 'sel' : ''}" data-sty="wall:${id}" title="${WALLPAPERS[id].name}"><img src="${this.styleImg('wall', id)}" alt=""></button>`).join('')}</div>
        <div class="hd-sty"><small>FLOOR</small>${H.floors.map((id) => `<button class="hd-sw ${H.floor === id ? 'sel' : ''}" data-sty="floor:${id}" title="${FLOORS[id].name}"><img src="${this.styleImg('floor', id)}" alt=""></button>`).join('')}</div>`;
      inv.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => { this.sfx('ui_select'); onPick(b.dataset.id); });
      sty.querySelectorAll('[data-sty]').forEach((b) => b.onclick = () => { const [k, id] = b.dataset.sty.split(':'); this.sfx('ui_select'); onStyle(k, id); render(); });
    };
    node.querySelector('[data-a="cat"]').onclick = () => { this.sfx('ui_select'); onCatalog(); };
    node.querySelector('[data-a="done"]').onclick = () => { this.sfx('ui_select'); onDone(); };
    node.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => this.sfx('ui_move')));
    render();
    const help = node.querySelector('.hd-help');
    return {
      node, render,
      help(html) { if (help._h !== html) { help._h = html; help.innerHTML = html; } },
      show(on) { node.classList.toggle('hidden', !on); },
      close() { node.classList.remove('on'); setTimeout(() => node.remove(), 250); },
    };
  }

  dispose() {
    this._catClose?.();
    this.hintEl.remove();
    this.thumbs.dispose();
    document.getElementById('house-deco')?.remove();
  }
}
