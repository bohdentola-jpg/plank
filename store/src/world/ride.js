// The ride: renders the current car of the Drip Line with its shopkeeper(s)
// and your figure, lays real buttons over everything you can tap, draws the
// day's loose tokens, and animates walking from car to car.
import { carLayout, drawCar, drawCarFront, carSway } from '../art/car.js';
import { drawFigure, drawNpc } from '../art/figure.js';
import { ellipse, dot, rgba, INK } from '../ink.js';
import { el } from '../ui/dom.js';

export const CAR_DEFS = {
  cab: { kind: 'cab', npc: null, num: 0, label: 'THE CAB' },
  front: { kind: 'front', npc: 'signal', num: 1, label: 'FRONT CAR' },
  threads: { kind: 'threads', npc: 'drippy', num: 2, label: 'THREADS', shop: 'threads' },
  kicks: { kind: 'kicks', npc: 'lace', num: 3, label: 'KICKS & DECKS', shop: 'kicks' },
  lids: { kind: 'lids', npc: 'cone', num: 4, label: 'LIDS', shop: 'lids' },
  ice: { kind: 'ice', npc: 'mira', num: 5, label: 'ICE', shop: 'ice' },
  arcade: { kind: 'arcade', npc: 'joy', npc2: 'eight', num: 6, label: 'ARCADE' },
  capsules: { kind: 'capsules', npc: 'plug', num: 7, label: 'CAPSULES' },
  ghost: { kind: 'ghost', npc: 'static', num: 0, label: 'THE GHOST CAR', shop: 'ghost' },
  vault: { kind: 'vault', npc: 'plug', num: 0, label: 'THE VAULT', shop: 'vault' },
};

const PLAYER_M = 1.55, NPC_M = 1.5;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

export class Ride {
  constructor(canvas, hotRoot, env) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.hotRoot = hotRoot;
    this.env = env; // { body, outfit, talking, state(car), tags(car), pickups(car, n), onHot(id), onCoin(p, sx, sy) }
    this.car = 'front';
    this.L = null;
    this.W = 1;
    this.H = 1;
    this.dpr = 1;
    this.tr = null;
    this.poseName = 'idle';
    this.poseUntil = 0;
    this.coins = [];
    this.t = 0;
    this.enterAt = 0;
    // A horizontal swipe anywhere in the car (background or a hotspot) changes
    // cars. The tap that ends a swipe must not also count as a click.
    this.swipe = null;
    this.swipedAt = -1;
    const inCar = (t) => t === canvas || hotRoot.contains(t);
    window.addEventListener('pointerdown', (e) => {
      this.swipe = inCar(e.target) ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    });
    window.addEventListener('pointerup', (e) => {
      const s = this.swipe;
      this.swipe = null;
      if (!s || this.tr) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (performance.now() - s.t < 700 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        this.swipedAt = performance.now();
        this.env.onSwipe?.(dx < 0 ? 'next' : 'back');
      }
    });
  }

  justSwiped() { return performance.now() - this.swipedAt < 400; }

  get def() { return CAR_DEFS[this.car]; }

  resize(W, H, dpr) {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.layout();
  }

  layout() {
    this.L = carLayout(this.W, this.H, this.def.kind);
    this.buildHotspots();
  }

  setCar(id) {
    this.car = id;
    this.enterAt = this.t;
    this.layout();
  }

  // walk to another car: zoom through the end door (next) or back out (back)
  travel(id, dir = 'next') {
    if (this.tr) return Promise.resolve(false);
    return new Promise((resolve) => {
      this.tr = { id, dir, k: 0, swapped: false, resolve };
      this.hotRoot.classList.add('busy');
    });
  }

  pose(name, secs = 1.4) {
    this.poseName = name;
    this.poseUntil = this.t + secs;
  }

  // ---------------------------------------------------------- hotspots

  buildHotspots() {
    const root = this.hotRoot;
    root.innerHTML = '';
    if (!this.L) return;
    const tags = this.env.tags(this.car) || {};
    // an id can have several rects (a car with three racks): tag only the biggest
    const biggest = {};
    for (const h of this.L.hotspots || []) {
      const area = h.rect[2] * h.rect[3];
      if (!biggest[h.id] || area > biggest[h.id].area) biggest[h.id] = { h, area };
    }
    for (const h of this.L.hotspots || []) {
      const [x, y, w, hh] = h.rect;
      const tag = tags[h.id];
      const label = (tag && tag.aria) || h.label || h.id;
      const main = biggest[h.id].h === h;
      const b = el('button', {
        type: 'button', class: 'hot', 'data-id': h.id, 'aria-label': label,
        tabindex: main ? null : '-1', 'aria-hidden': main ? null : 'true',
        style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` },
      });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.detail > 0) b.blur();
        if (!this.tr && !this.justSwiped()) this.env.onHot(h.id);
      });
      root.append(b);
      if (tag && tag.text && biggest[h.id].h === h) {
        const a = h.anchor || [x + w / 2, y];
        root.append(el('span', { class: `hot-tag ${tag.cls || ''}`, style: { left: `${a[0]}px`, top: `${Math.max(a[1], 8)}px` } }, tag.text));
      }
    }
    this.spreadTags();
    // you: tap yourself to open the closet
    const P = this.L.player;
    if (P) {
      const hpx = PLAYER_M * P.s;
      const b = el('button', { type: 'button', class: 'hot', 'data-id': 'me', 'aria-label': 'You. Open your closet', style: { left: `${P.x - hpx * 0.3}px`, top: `${P.y - hpx}px`, width: `${hpx * 0.6}px`, height: `${hpx}px` } });
      b.addEventListener('click', (e) => { e.stopPropagation(); if (e.detail > 0) b.blur(); if (!this.tr && !this.justSwiped()) this.env.onHot('me'); });
      root.append(b);
    }
    // loose tokens
    this.coins = [];
    const spots = this.L.spots || [];
    for (const p of this.env.pickups(this.car, spots.length)) {
      const sp = spots[p.spot];
      if (!sp) continue;
      const c = { ...p, x: sp.x, y: sp.y, s: sp.s };
      const b = el('button', { type: 'button', class: 'coin-btn', 'aria-label': p.big ? 'A golden token on the floor' : 'A loose token on the floor', style: { left: `${sp.x}px`, top: `${sp.y - sp.s * 0.12}px` } });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.justSwiped()) return;
        this.coins = this.coins.filter((q) => q !== c);
        b.remove();
        this.env.onCoin(c, sp.x, sp.y - sp.s * 0.12);
      });
      root.append(b);
      this.coins.push(c);
    }
  }

  // Labels on a narrow phone can land on top of each other. Nudge each one
  // up (then down, then sideways) until it clears the ones already placed.
  spreadTags() {
    const tagEls = [...this.hotRoot.querySelectorAll('.hot-tag')];
    if (tagEls.length < 2) return;
    const W = this.W, topMin = 6;
    const placed = [];
    const hit = (r) => placed.some((p) => r.left < p.right + 4 && r.right > p.left - 4 && r.top < p.bottom + 3 && r.bottom > p.top - 3);
    // place the larger (nearer) targets first so they keep their spot
    tagEls.sort((a, b) => parseFloat(b.style.top) - parseFloat(a.style.top));
    for (const t of tagEls) {
      const y0 = parseFloat(t.style.top), x0 = parseFloat(t.style.left);
      let r = t.getBoundingClientRect();
      const tries = [[0, 0], [0, -1], [0, 1], [0, -2], [-1, 0], [1, 0], [0, 2], [-1, -1], [1, -1], [0, -3]];
      for (const [dxk, dyk] of tries) {
        const dy = dyk * (r.height + 4), dx = dxk * (r.width / 2 + 6);
        const top = Math.max(topMin + r.height, y0 + dy);
        const left = Math.min(W - r.width / 2 - 4, Math.max(r.width / 2 + 4, x0 + dx));
        t.style.top = `${top}px`;
        t.style.left = `${left}px`;
        r = t.getBoundingClientRect();
        if (!hit(r)) break;
      }
      placed.push(r);
    }
  }

  refreshTags() { this.buildHotspots(); }

  // ---------------------------------------------------------- anchors

  anchorOf(who) {
    const L = this.L;
    if (!L) return null;
    if (who === 'me' && L.player) return { x: L.player.x, y: L.player.y - PLAYER_M * L.player.s * 1.02 };
    const d = this.def;
    if (L.npc && who === d.npc) return { x: L.npc.x, y: L.npc.y - NPC_M * L.npc.s * 1.06 };
    if (L.npc2 && who === d.npc2) return { x: L.npc2.x, y: L.npc2.y - NPC_M * L.npc2.s * 1.06 };
    if (who === 'grabber') {
      const h = (L.hotspots || []).find((q) => q.id === 'claw');
      if (h) return { x: h.rect[0] + h.rect[2] / 2, y: h.rect[1] + 10 };
    }
    return null;
  }

  // ---------------------------------------------------------- render

  render(dt, t) {
    this.t = t;
    const g = this.g;
    const { W, H, dpr } = this;
    if (!this.L) return;
    let zoom = 1, fade = 0, cx = W / 2, cy = H * 0.45;
    if (this.tr) {
      const tr = this.tr;
      // a slow frame (a car being drawn for the first time) must not skip the fade
      tr.k += Math.min(dt, 1 / 30) / 0.42;
      const door = (this.L.hotspots || []).find((h) => h.id === 'door-next');
      if (door) { cx = door.rect[0] + door.rect[2] / 2; cy = door.rect[1] + door.rect[3] / 2; }
      if (!tr.swapped) {
        const k = ease(Math.min(1, tr.k));
        zoom = tr.dir === 'next' ? 1 + k * 1.8 : 1 - k * 0.25;
        fade = k;
        if (tr.k >= 1) {
          tr.swapped = true;
          tr.k = 0;
          this.setCar(tr.id);
          this.env.onArrive?.(tr.id);
        }
      } else {
        const k = ease(Math.min(1, tr.k));
        zoom = tr.dir === 'next' ? 0.86 + 0.14 * k : 1.3 - 0.3 * k;
        fade = 1 - k;
        if (tr.k >= 1) {
          const r = tr.resolve;
          this.tr = null;
          this.hotRoot.classList.remove('busy');
          this.buildHotspots();
          r(true);
        }
      }
    }
    const L = this.L;
    const kind = this.def.kind;
    const state = this.env.state(this.car);
    state.scale = dpr; // keep car bakes at screen density while the walk zooms
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0a0618';
    g.fillRect(0, 0, W, H);
    g.save();
    if (zoom !== 1) {
      g.translate(cx, cy);
      g.scale(zoom, zoom);
      g.translate(-cx, -cy);
    }
    // the car rocks on the rails; everyone inside rocks with it
    const sw = carSway(t, L);
    g.translate(L.W / 2 + sw.dx, L.H + sw.dy);
    g.rotate(sw.rot);
    g.translate(-L.W / 2, -L.H);
    drawCar(g, L, kind, t, state);
    // loose tokens
    for (const c of this.coins) this.drawCoin(g, c, t);
    // characters, back to front
    const actors = [];
    const talking = this.env.talking();
    const d = this.def;
    if (L.npc && d.npc) actors.push({ y: L.npc.y, draw: () => drawNpc(g, d.npc, L.npc.x, L.npc.y, { scale: (NPC_M * L.npc.s) / 100, t: t + 0.7, talk: talking === d.npc, blink: (t + 1.3) % 3.4 < 0.12 ? 1 : 0, boil: 31 + (Math.floor(t * 7) % 3) * 101, pose: talking === d.npc ? 'point' : 'idle' }) });
    if (L.npc2 && d.npc2) actors.push({ y: L.npc2.y, draw: () => drawNpc(g, d.npc2, L.npc2.x, L.npc2.y, { scale: (NPC_M * L.npc2.s) / 100, t: t + 2.1, talk: talking === d.npc2, blink: (t + 0.4) % 2.9 < 0.12 ? 1 : 0, boil: 51 + (Math.floor(t * 7) % 3) * 101 }) });
    if (L.player) {
      const pose = t < this.poseUntil ? this.poseName : t - this.enterAt < 1.1 ? 'wave' : 'idle';
      actors.push({ y: L.player.y, draw: () => drawFigure(g, L.player.x, L.player.y, { body: this.env.body(), outfit: this.env.outfit(), scale: (PLAYER_M * L.player.s) / 100, t, pose, view: 'front', blink: t % 3.1 < 0.12 ? 1 : 0, talk: talking === 'me', boil: 11 + (Math.floor(t * 7) % 3) * 101 }) });
    }
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();
    drawCarFront(g, L, kind, t, state);
    g.restore();
    if (fade > 0) {
      g.fillStyle = rgba('#0a0618', Math.min(1, fade * 1.1));
      g.fillRect(0, 0, W, H);
    }
  }

  drawCoin(g, c, t) {
    const r = c.s * (c.big ? 0.09 : 0.065);
    const bob = Math.sin(t * 3 + c.x) * r * 0.25;
    const x = c.x, y = c.y - r * 1.4 + bob;
    const spin = Math.cos(t * 4 + c.x * 0.01);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(x, y, 1, x, y, r * 3);
    gl.addColorStop(0, 'rgba(255,220,120,0.55)');
    gl.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = gl;
    g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    g.restore();
    g.fillStyle = 'rgba(10,6,24,0.3)';
    g.beginPath();
    g.ellipse(c.x, c.y, r * 0.9, r * 0.25, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(x, y);
    g.scale(Math.max(0.18, Math.abs(spin)), 1);
    ellipse(g, 0, 0, r, r, { fill: c.big ? '#ffd23f' : spin > 0 ? '#f0c24a' : '#d4a030', lw: Math.max(1.6, r * 0.22), amp: 0.2, seed: 3 });
    ellipse(g, 0, 0, r * 0.6, r * 0.6, { fill: '#ffe08a', lw: 0, amp: 0, seed: 4 });
    // drop symbol
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(0, -r * 0.42);
    g.bezierCurveTo(r * 0.18, -r * 0.18, r * 0.3, 0, r * 0.3, r * 0.12);
    g.arc(0, r * 0.12, r * 0.3, 0, Math.PI);
    g.bezierCurveTo(-r * 0.3, 0, -r * 0.18, -r * 0.18, 0, -r * 0.42);
    g.fill();
    if (c.big) {
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + i * 1.57;
        dot(g, Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6, Math.max(1.4, r * 0.12), '#fffaf0');
      }
    }
    g.restore();
  }
}
