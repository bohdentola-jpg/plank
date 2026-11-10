// The overworld: an angled, slightly overhead camera over a diorama "playset".
// You steer the Captain; active teammates trail behind in a line. Areas are
// described declaratively (see src/areas/*.js) with the build API below.
import * as THREE from 'three';
import { G, Mode } from '../core/game.js';
import { Fx } from '../core/fx.js';
import { PROPS, fence as fenceProp, bunting as buntingProp } from '../art/props.js';
import { Character, buildFootball } from '../art/characters.js';
import { toon, flat, M, lightRig, bake, disposeTree, sphere, cyl, cone, circle, ring, torus, roundRect, FONT, glowSprite } from '../art/kit.js';
import { clamp, damp, lerp, dist, circleBoxPush, circleCirclePush, pointInBox, segBox, rand, TAU, wrapAngle, el, makeRng, ease } from '../core/util.js';
import { teamSpec, displayName, charState, maxStamina } from '../data/cast.js';
import { AREAS } from '../areas/index.js';
import { flag, setFlag, flagVal, addCoins, addItem, addParts, restAll, save, trackedQuest } from '../game/state.js';

const PPU = 18;                    // ground texture pixels per world unit
const WALK = 5.4, RUN = 8.3;

// ------------------------------------------------------------------ ground painter
class Painter {
  constructor(ctx, W, D, s, seed) { this.c = ctx; this.W = W; this.D = D; this.s = s; this.r = makeRng(seed); }
  fill(col) { this.c.fillStyle = col; this.c.fillRect(0, 0, this.W * this.s, this.D * this.s); return this; }
  rect(x, z, w, d, col, rad = 0) {
    const { c, s } = this; c.fillStyle = col;
    if (rad) { roundRect(c, x * s, z * s, w * s, d * s, rad * s); c.fill(); } else c.fillRect(x * s, z * s, w * s, d * s);
    return this;
  }
  frame(x, z, w, d, col, lw = 0.12, rad = 0) {
    const { c, s } = this; c.strokeStyle = col; c.lineWidth = lw * s;
    roundRect(c, x * s, z * s, w * s, d * s, rad * s); c.stroke();
    return this;
  }
  circle(x, z, r, col) { const { c, s } = this; c.fillStyle = col; c.beginPath(); c.arc(x * s, z * s, r * s, 0, TAU); c.fill(); return this; }
  ellipse(x, z, rx, rz, col, rot = 0) { const { c, s } = this; c.fillStyle = col; c.beginPath(); c.ellipse(x * s, z * s, rx * s, rz * s, rot, 0, TAU); c.fill(); return this; }
  path(pts, width, col, o = {}) {
    const { c, s } = this;
    c.strokeStyle = col; c.lineWidth = width * s; c.lineJoin = 'round'; c.lineCap = o.cap || 'round';
    if (o.dash) c.setLineDash(o.dash.map((v) => v * s)); else c.setLineDash([]);
    c.beginPath();
    pts.forEach(([x, z], i) => (i ? c.lineTo(x * s, z * s) : c.moveTo(x * s, z * s)));
    if (o.close) c.closePath();
    c.stroke();
    c.setLineDash([]);
    return this;
  }
  line(x1, z1, x2, z2, w, col, o) { return this.path([[x1, z1], [x2, z2]], w, col, { cap: 'butt', ...(o || {}) }); }
  /** Scatter little blobs (leaves, pebbles, flowers). */
  speckle(x, z, w, d, n, cols, r0 = 0.07, r1 = 0.16) {
    const { c, s, r } = this;
    for (let i = 0; i < n; i++) {
      c.fillStyle = cols[Math.floor(r() * cols.length)];
      const px = (x + r() * w) * s, pz = (z + r() * d) * s, rr = (r0 + r() * (r1 - r0)) * s;
      c.beginPath(); c.ellipse(px, pz, rr, rr * (0.5 + r() * 0.5), r() * 3.14, 0, TAU); c.fill();
    }
    return this;
  }
  tufts(x, z, w, d, n, col) {
    const { c, s, r } = this; c.strokeStyle = col; c.lineWidth = 0.06 * s; c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const px = (x + r() * w) * s, pz = (z + r() * d) * s;
      c.beginPath(); c.moveTo(px - 0.1 * s, pz); c.lineTo(px - 0.14 * s, pz - 0.2 * s); c.moveTo(px, pz); c.lineTo(px, pz - 0.26 * s); c.moveTo(px + 0.1 * s, pz); c.lineTo(px + 0.15 * s, pz - 0.2 * s); c.stroke();
    }
    return this;
  }
  stripes(x, z, w, d, c1, c2, sw = 1.4, vertical = true) {
    this.rect(x, z, w, d, c1);
    const { c, s } = this; c.fillStyle = c2;
    c.save(); c.beginPath(); c.rect(x * s, z * s, w * s, d * s); c.clip();
    if (vertical) for (let p = x + sw; p < x + w; p += sw * 2) c.fillRect(p * s, z * s, sw * s, d * s);
    else for (let p = z + sw; p < z + d; p += sw * 2) c.fillRect(x * s, p * s, w * s, sw * s);
    c.restore();
    return this;
  }
  text(str, x, z, size, col, o = {}) {
    const { c, s } = this;
    c.save();
    c.translate(x * s, z * s);
    if (o.rot) c.rotate(o.rot);
    c.font = `${o.weight || 900} ${size * s}px ${o.font || FONT}`;
    c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = (o.strokeW || 0.14) * s; c.lineJoin = 'round'; c.strokeText(str, 0, 0); }
    c.fillStyle = col; c.fillText(str, 0, 0);
    c.restore();
    return this;
  }
  /** Soft dark smudge — fake ambient occlusion under big props. */
  shade(x, z, rx, rz, a = 0.16) {
    const { c, s } = this;
    const g = c.createRadialGradient(x * s, z * s, 0, x * s, z * s, Math.max(rx, rz) * s);
    g.addColorStop(0, `rgba(40,20,50,${a})`); g.addColorStop(1, 'rgba(40,20,50,0)');
    c.save(); c.translate(x * s, z * s); c.scale(1, rz / rx); c.translate(-x * s, -z * s);
    c.fillStyle = g; c.beginPath(); c.arc(x * s, z * s, rx * s, 0, TAU); c.fill(); c.restore();
    return this;
  }
  /** A football field running left→right. o: { c1, c2, line, ez1, ez2, name1, name2, marks } */
  field(x, z, w, d, o = {}) {
    const ez = o.ez ?? w * 0.1;
    this.stripes(x + ez, z, w - ez * 2, d, o.c1 || '#6fae54', o.c2 || '#7dbb60', (w - ez * 2) / 10, true);
    this.rect(x, z, ez, d, o.ez1 || '#d4502f'); this.rect(x + w - ez, z, ez, d, o.ez2 || '#3b2148');
    const lc = o.line || 'rgba(255,255,255,0.92)';
    for (let i = 0; i <= 10; i++) this.line(x + ez + (i * (w - ez * 2)) / 10, z, x + ez + (i * (w - ez * 2)) / 10, z + d, 0.14, lc);
    this.frame(x, z, w, d, lc, 0.2);
    if (o.name1) this.text(o.name1, x + ez / 2, z + d / 2, ez * 0.5, '#fff4dc', { rot: -Math.PI / 2 });
    if (o.name2) this.text(o.name2, x + w - ez / 2, z + d / 2, ez * 0.5, '#fff4dc', { rot: Math.PI / 2 });
    return this;
  }
}

const _box3 = new THREE.Box3();
const _v3 = new THREE.Vector3();

export class World extends Mode {
  constructor() {
    super();
    this.name = 'world';
    this.camera.fov = 22;
    this.busy = 0;
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.camDist = 46; this.camPitch = 0.93;
    this.camOverride = null;
    this.party = [];
    this.balls = [];
    this.markers = [];
  }

  // ================================================================ lifecycle
  enter(params) {
    this.fx = new Fx(this.scene);
    this._buildHud();
    this.loadArea(params.area || G.S.area, params.x, params.z, params);
    if (params.onStart) this.run(() => params.onStart(this));
  }

  exit() {
    this.unloadArea();
    this.fx.dispose();
    G.ui.prompt(null);
  }

  resume() {
    // coming back from a battle / minigame / menu
    this.refreshParty();
    this._hudDirty = true;
    const a = this.area;
    G.audio.music(typeof a.music === 'function' ? a.music(G.S) : a.music);
  }

  unloadArea() {
    if (!this.root) return;
    for (const p of this.party) p.ch.dispose();
    this.party = [];
    this.scene.remove(this.root);
    disposeTree(this.root);
    if (this.rig) this.scene.remove(this.rig.sun, this.rig.sun.target, this.rig.hemi);
    for (const m of this.markers) m.el.remove();
    this.markers = [];
    this.root = null;
  }

  /** (Re)build an area and drop the party at x,z. */
  loadArea(id, x, z, o = {}) {
    this.unloadArea();
    const area = AREAS[id];
    if (!area) throw new Error(`No such area: ${id}`);
    const S = G.S;
    this.area = area; this.areaId = id;
    this.W = area.w; this.D = area.d;
    S.area = id;
    const sky = area.indoor ? 'indoor' : (typeof area.sky === 'function' ? area.sky(S) : area.sky) || S.tod;
    this.night = !area.indoor && (S.tod !== 'day' || area.alwaysNight);
    this.dark = !area.indoor && (S.tod === 'night' || area.alwaysNight);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.rig = lightRig(this.scene, sky, { shadowSize: 24, fog: area.indoor ? null : [70, 170] });
    this.staticRoot = new THREE.Group(); this.root.add(this.staticRoot);
    this.dynRoot = new THREE.Group(); this.root.add(this.dynRoot);
    this.solids = []; this.rounds = []; this.actors = []; this.interacts = []; this.triggers = [];
    this.targets = []; this.pushables = []; this.enemies = []; this.zones = []; this.occluders = [];
    this.pickups = []; this.updaters = []; this.named = {}; this._occQueue = []; this._lights = 0;
    this.camZoom = area.zoom || 1;
    this._buildGround(area);
    area.build(this, S);
    this._finishStatic();
    const sp = area.spawn || [this.W / 2, this.D / 2];
    this._spawnParty(x ?? sp[0], z ?? sp[1]);
    this.solo = null;
    this._snapCamera();
    this._hudDirty = true;
    G.audio.music(typeof area.music === 'function' ? area.music(S) : area.music);
    if (!o.quiet && area.name && this._lastAreaName !== area.name) G.ui.banner(area.name, area.sub || '', { dur: 1.7, cls: 'area' });
    this._lastAreaName = area.name;
    if (!area.noCheckpoint && !o.noCheckpoint) S.checkpoint = { area: id, x: this.leader.x, z: this.leader.z };
    S.pos = { x: this.leader.x, z: this.leader.z };
    if (area.onEnter) this.run(() => area.onEnter(this, S));
  }

  /** Fade to another area. */
  async goto(id, x, z, o = {}) {
    this.busy++;
    G.audio.sfx(o.sfx || 'door');
    await G.fadeOut();
    this.loadArea(id, x, z, o);
    save();
    await G.fadeIn();
    this.busy--;
  }

  /** Rebuild the current area in place (after a flag changed what should exist). */
  rebuild() {
    const p = this.ctrl || this.leader;
    const cam = this.camTarget.clone();
    this.loadArea(this.areaId, this.leader.x, this.leader.z, { quiet: true, noCheckpoint: true });
    void p;
    this.camTarget.copy(cam);
    this._snapCamera(true);
  }

  // ================================================================ build API (used by areas)
  _buildGround(area) {
    const cw = Math.round(this.W * PPU), cd = Math.round(this.D * PPU);
    const cvs = document.createElement('canvas');
    cvs.width = cw; cvs.height = cd;
    const ctx = cvs.getContext('2d');
    const g = new Painter(ctx, this.W, this.D, PPU, (area.seed || 7) * 131);
    g.fill(area.ground || '#86b860');
    if (area.paint) area.paint(g, G.S, this);
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.W, this.D), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(this.W / 2, 0, this.D / 2);
    mesh.receiveShadow = true;
    mesh.userData.keep = true;
    this.root.add(mesh);
    this.groundTex = tex; this.groundCanvas = cvs; this.painter = g;
    // the slab the playset sits on
    const edge = area.edge || 0x7a5a48;
    const slab = M(new THREE.BoxGeometry(this.W + 0.8, 2.4, this.D + 0.8), toon(edge), this.W / 2, -1.21, this.D / 2, { shadow: false });
    slab.userData.keep = true;
    this.root.add(slab);
    const lip = M(new THREE.BoxGeometry(this.W + 1.2, 0.3, this.D + 1.2), toon(area.lip || 0xd9c9a8), this.W / 2, -0.17, this.D / 2, { shadow: false });
    lip.userData.keep = true;
    this.root.add(lip);
  }

  /** Place a prop from the library. o.ry rotates it (quarter turns keep collision exact). */
  put(name, x, z, o = {}) {
    const make = PROPS[name];
    if (!make) throw new Error(`No prop "${name}"`);
    const obj = make({ night: this.night, ...o });
    const ry = o.ry || 0;
    obj.position.x += x; obj.position.z += z;
    if (o.y) obj.position.y += o.y;
    if (ry) obj.rotation.y += ry;
    if (o.scale) obj.scale.multiplyScalar(o.scale);
    const sol = obj.userData.solid;
    const k = o.scale || 1;
    if (sol && o.solid !== false) {
      if (sol.r) this.rounds.push({ x, z, r: sol.r * k, id: o.id });
      else {
        const quarter = Math.round(ry / (Math.PI / 2)) & 1;
        const off = obj.userData.solidOff || { x: 0, z: 0 };
        const ox = off.x * Math.cos(ry) + off.z * Math.sin(ry), oz = -off.x * Math.sin(ry) + off.z * Math.cos(ry);
        this.solids.push({ x: x + ox * k, z: z + oz * k, w: (quarter ? sol.d : sol.w) * k, d: (quarter ? sol.w : sol.d) * k, id: o.id, tag: o.tag });
      }
    }
    if (obj.userData.tall && !o.noFade) this._occQueue.push(obj);
    else if (obj.userData.keep) this.dynRoot.add(obj);
    else this.staticRoot.add(obj);
    if (o.id) this.named[o.id] = obj;
    return obj;
  }

  /** Add any Object3D (static unless keep=true). */
  add(obj, keep = false) { (keep || obj.userData.keep ? this.dynRoot : this.staticRoot).add(obj); return obj; }

  fence(x1, z1, x2, z2, o = {}) {
    const f = fenceProp(x1, z1, x2, z2, o);
    this.staticRoot.add(f);
    if (o.solid !== false) this.wall(x1, z1, x2, z2, o.tag, 0.3);
    return f;
  }
  bunting(x1, z1, x2, z2, o) { const b = buntingProp(x1, z1, x2, z2, o); this.staticRoot.add(b); return b; }

  /** Invisible wall along a segment. */
  wall(x1, z1, x2, z2, tag, t = 0.3) {
    if (Math.abs(z1 - z2) < 0.01) this.solids.push({ x: (x1 + x2) / 2, z: z1, w: Math.abs(x2 - x1), d: t, tag });
    else if (Math.abs(x1 - x2) < 0.01) this.solids.push({ x: x1, z: (z1 + z2) / 2, w: t, d: Math.abs(z2 - z1), tag });
    else {
      const len = Math.hypot(x2 - x1, z2 - z1), n = Math.ceil(len / 0.45);
      for (let i = 0; i <= n; i++) this.solids.push({ x: lerp(x1, x2, i / n), z: lerp(z1, z2, i / n), w: 0.5, d: 0.5, tag });
    }
  }
  /** Box collider centred at x,z. Returns it (set .off = true to disable). */
  solid(x, z, w, d, tag, id) { const s = { x, z, w, d, tag, id }; this.solids.push(s); if (id) this.named[id] = s; return s; }

  npc(id, x, z, o = {}) {
    const ch = new Character(o.spec || { kind: 'animal', species: 'fox' });
    ch.setPos(x, z, o.y || 0);
    ch.face(o.face ?? 0);
    if (o.base) ch.setBase(o.base);
    if (o.expr) ch.setExpr(o.expr);
    this.dynRoot.add(ch.root);
    const a = { id, ch, x, z, y: o.y || 0, r: o.solid === false ? 0 : ch.radius, name: o.name, talk: o.talk, home: { x, z }, wander: o.wander || 0, wt: rand(2, 6), dest: null, mark: o.mark || null, face: o.face ?? 0, speaker: o.speaker || id, fixed: !!o.base };
    this.actors.push(a);
    this.named[id] = a;
    if (o.talk) this.interacts.push({ actor: a, r: o.r ?? 2.0, label: o.label || `Talk to ${o.name || id}`, fn: () => this.talkTo(a), cond: o.cond });
    if (a.mark) this._addMarker(a, a.mark);
    return a;
  }

  /** Something you can walk up to and press the action button on. */
  interact(x, z, o) {
    const it = { x, z, r: o.r ?? 1.7, label: o.label || 'Look', fn: o.fn, cond: o.cond, solo: o.solo };
    this.interacts.push(it);
    if (o.mark) this._addMarker({ x, z, y: o.markY ?? 0, ch: null, markH: o.markY ?? 2.4 }, o.mark);
    return it;
  }

  /** A doorway to another area. o: { to, at:[x,z], label, locked: () => string|false } */
  door(x, z, o) {
    return this.interact(x, z, {
      r: o.r ?? 1.5, label: o.label || 'Enter',
      fn: async () => {
        const why = o.locked ? o.locked() : false;
        if (why) { G.audio.sfx('deny'); await G.ui.say(null, why); return; }
        if (o.before) { const ok = await o.before(this); if (ok === false) return; }
        await this.goto(o.to, o.at[0], o.at[1]);
      },
    });
  }

  /** Walk-into region that changes area. */
  exit(x, z, w, d, to, tx, tz, o = {}) {
    this.triggers.push({ x, z, w, d, inside: true, armed: false, fn: async () => {
      if (o.locked) { const why = o.locked(); if (why) { await G.ui.say(null, why); this._bump(o.bump); return; } }
      await this.goto(to, tx, tz, { sfx: 'step' });
    } });
    if (o.arrow !== false) this._arrow(x, z, o.dir || 0);
  }

  /** Region callback. o.once = flag name to fire only once ever. */
  trigger(x, z, w, d, fn, o = {}) {
    this.triggers.push({ x, z, w, d, inside: false, armed: true, fn, once: o.once, repeat: o.repeat });
  }

  /** A switch you hit by throwing the football. */
  target(x, z, o = {}) {
    const obj = o.obj || this.put('target', x, z, { h: o.h ?? 2.4, noPost: o.noPost, solid: o.solid, y: o.y });
    const t = { x, z, y: (o.y || 0) + (o.h ?? 2.4), r: o.r ?? 0.8, fn: o.fn, hit: !!(o.flag && flag(o.flag)), flag: o.flag, obj, repeat: !!o.repeat, spin: 0 };
    if (t.hit && obj.userData.head) obj.userData.head.rotation.y = Math.PI / 2;
    this.targets.push(t);
    return t;
  }

  /** A heavy thing the lineman can shove one step at a time. */
  pushable(name, x, z, o = {}) {
    const key = `push_${this.areaId}_${o.id}`;
    const saved = G.S.flags[key];
    if (saved) { x = saved[0]; z = saved[1]; }
    const obj = PROPS[name](o);
    obj.position.set(x, 0, z);
    obj.userData.keep = true;
    this.dynRoot.add(obj);
    const sol = obj.userData.solid || { w: 1.8, d: 1.8 };
    const s = { x, z, w: sol.w, d: sol.d, tag: 'push' };
    this.solids.push(s);
    const p = { obj, s, id: o.id, key, step: o.step ?? 2, onMove: o.onMove, x0: x, z0: z };
    this.pushables.push(p);
    const it = { get x() { return s.x; }, get z() { return s.z; }, r: Math.max(sol.w, sol.d) / 2 + 1.25, label: 'Shove', fn: () => this.shove(p) };
    this.interacts.push(it);
    return p;
  }

  /** A gap only your smallest teammate fits through. o: { to:[x,z], back:[x,z] } */
  gap(x, z, o = {}) {
    const arch = new THREE.Group();
    arch.add(M(torus(0.42, 0.07, 5, 12, Math.PI), toon(0x2b1a33), 0, 0, 0, { shadow: false }));
    arch.add(M(circle(0.38, 12), flat(0x1b1024), 0, 0.02, 0.0, { shadow: false }));
    arch.position.set(x, 0.02, z);
    arch.rotation.y = o.ry || 0;
    arch.userData.keep = true;
    this.dynRoot.add(arch);
    const g = { x, z, to: o.to, back: o.back || [x, z + 1], id: o.id };
    this.interacts.push({ x: g.back[0], z: g.back[1], r: 1.6, label: 'Send someone small through', cond: () => !this.solo, fn: () => this.squeeze(g) });
    this.interacts.push({ x: o.to[0], z: o.to[1], r: 1.3, label: 'Squeeze back out', solo: true, cond: () => !!this.solo, fn: () => this.regroup() });
    return g;
  }

  /** A roaming opponent you can see, sneak up on, or avoid. */
  enemy(o) {
    const key = `${this.areaId}:${o.id}`;
    if (G.session.beaten.has(key) || (o.once && flag(`beat_${o.id}`))) return null;
    if (o.cond && !o.cond()) return null;
    const ch = new Character(o.spec);
    const [x, z] = o.path[0];
    ch.setPos(x, z);
    this.dynRoot.add(ch.root);
    const e = { key, id: o.id, def: o, ch, x, z, path: o.path, pi: 0, state: 'patrol', t: 0, yaw: 0, home: { x, z }, speed: o.speed ?? 2.3, sight: o.sight ?? 7.5, wait: 0, r: ch.radius, minis: [] };
    for (let i = 0; i < (o.minis || 0); i++) {
      const m = new Character(o.miniSpec || o.spec);
      m.root.scale.multiplyScalar(0.82);
      m.setPos(x - 1 - i, z);
      this.dynRoot.add(m.root);
      e.minis.push({ ch: m, x: x - 1 - i, z });
    }
    this.enemies.push(e);
    return e;
  }

  /** Rest spot: refills stamina, saves, sets the respawn point. */
  bench(x, z, o = {}) {
    this.put('bench', x, z, o);
    this.interact(x, z + (o.ry ? 0 : 0.9), { r: 1.7, label: 'Rest on the bench', fn: async () => {
      restAll();
      G.S.checkpoint = { area: this.areaId, x: this.leader.x, z: this.leader.z };
      save();
      G.audio.sfx('item');
      for (const p of this.party) this.fx.sparkle({ x: p.x, y: 1.4, z: p.z }, 0xb6f08a, 5);
      G.ui.toast('🪑 Everyone caught their breath. <b>Saved.</b>');
    } });
  }

  /** A floating collectable. o: { id, coins, parts, item, n, cond } */
  pickup(x, z, o) {
    const key = `got_${o.id}`;
    if (flag(key)) return null;
    const g = new THREE.Group();
    const col = o.coins ? 0xffd45a : o.parts ? 0xc9d2da : 0x58b8c9;
    g.add(M(o.coins ? cyl(0.26, 0.26, 0.08, 12) : sphere(0.24, 10, 8), toon(col), 0, 0, 0, { rx: o.coins ? Math.PI / 2 : 0 }));
    g.add(glowSprite(col, 1.5, 0.35));
    g.position.set(x, 0.8, z);
    g.userData.keep = true;
    this.dynRoot.add(g);
    const p = { x, z, g, o, key };
    this.pickups.push(p);
    return p;
  }

  /** Hazard / terrain region. type: sprinkler | ice | slow */
  zone(type, x, z, w, d, o = {}) {
    const zn = { type, x, z, w, d, ...o, t: o.phase || 0, on: false };
    if (type === 'sprinkler') {
      zn.r = o.r ?? 2.6;
      zn.period = o.period ?? 4; zn.duty = o.duty ?? 0.55;
      zn.obj = this.put('sprinkler', x, z, {});
      zn.off = !!(o.flag && flag(o.flag));
    }
    this.zones.push(zn);
    return zn;
  }

  /** Night-time point light (a handful per area). */
  light(x, y, z, color = 0xffc65a, intensity = 30, distance = 12) {
    if (!this.night || this._lights >= 5) return null;
    this._lights++;
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z);
    this.root.add(l);
    return l;
  }

  /** Per-frame callback for area-specific animation. */
  onUpdate(fn) { this.updaters.push(fn); }

  _arrow(x, z, dir) {
    const a = M(cone(0.42, 0.7, 4), flat(0xffd45a), x, 0.06, z, { shadow: false });
    a.rotation.set(Math.PI / 2, 0, -dir);
    a.scale.set(1, 1, 0.25);
    a.userData.keep = true;
    this.dynRoot.add(a);
    this.updaters.push((dt, t) => { a.position.y = 0.08; a.material.opacity = 1; a.scale.setScalar(1 + Math.sin(t * 4) * 0.12); a.scale.z = 0.25; });
  }

  _addMarker(a, text) {
    const node = el('div.marker', text);
    this.hud.appendChild(node);
    this.markers.push({ el: node, a });
  }

  _finishStatic() {
    for (const obj of this._occQueue) {
      this.dynRoot.add(obj);
      if (!obj.userData.keep) bake(obj);
      const mats = [];
      obj.traverse((o) => { if (o.material && !Array.isArray(o.material)) { o.material = o.material.clone(); mats.push(o.material); } });
      obj.updateMatrixWorld(true);
      _box3.setFromObject(obj);
      const light = !!obj.userData.light;
      this.occluders.push({ obj, mats, k: 1, minX: _box3.min.x, maxX: _box3.max.x, minZ: _box3.min.z, maxZ: _box3.max.z, h: _box3.max.y, light, cz: obj.position.z });
    }
    this._occQueue = [];
    bake(this.staticRoot);
  }

  // ================================================================ party
  _spawnParty(x, z) {
    const S = G.S;
    const ids = ['captain'];
    for (const id of S.squads[0]) if (id !== 'captain' && S.roster.includes(id) && ids.length < 5) ids.push(id);
    const FAN = [[0, 0], [-1.25, 0.5], [1.25, 0.5], [-2.3, 1.0], [2.3, 1.0]];
    this.party = ids.map((id, i) => {
      const ch = new Character(teamSpec(id));
      const p = { id, ch, x: x + FAN[i][0], z: z + FAN[i][1], vx: 0, vz: 0, r: 0.42, small: ch.small, sp: 0 };
      if (i) this.moveCircle(p, 0, 0, 0.35, false);
      ch.setPos(p.x, p.z);
      this.dynRoot.add(ch.root);
      return p;
    });
    this.leader = this.party[0];
    this.ctrl = this.leader;
    this.trail = [];
    for (let i = 0; i < 80; i++) { const f = this.party[Math.min(this.party.length - 1, Math.round(i / 9))]; this.trail.push({ x: f.x, z: f.z }); }
    this.partyIds = ids.join(',');
  }

  /** Rebuild followers if the squad changed (after recruiting / editing squads / uniforms). */
  refreshParty(force) {
    if (!this.root) return;
    const S = G.S;
    const ids = ['captain'];
    for (const id of S.squads[0]) if (id !== 'captain' && S.roster.includes(id) && ids.length < 5) ids.push(id);
    const sig = ids.join(',') + JSON.stringify(S.team) + S.captain.species;
    if (!force && sig === this._partySig) return;
    this._partySig = sig;
    const lx = this.leader ? this.leader.x : this.W / 2, lz = this.leader ? this.leader.z : this.D / 2;
    const yaw = this.leader ? this.leader.ch.yaw : 0;
    const old = this.party;
    for (const p of old) p.ch.dispose();
    this._spawnParty(lx, lz);
    this.leader.ch.face(yaw);
    old.forEach((o, i) => { const n = this.party.find((p) => p.id === o.id); if (n && i) { n.x = o.x; n.z = o.z; n.ch.setPos(o.x, o.z); } });
  }

  /** Debug/QA: put the whole party at x,z. */
  tp(x, z) {
    this.trail = [];
    for (let i = 0; i < 80; i++) this.trail.push({ x, z: z + i * 0.13 });
    this.party.forEach((p, i) => { p.x = x; p.z = z + i * 1.17; p.vx = p.vz = 0; p.ch.setPos(p.x, p.z); });
    for (const t of this.triggers) t.inside = Math.abs(x - t.x) < t.w / 2 && Math.abs(z - t.z) < t.d / 2;
    this._snapCamera();
  }

  has(id) { return this.party.some((p) => p.id === id); }
  member(id) { return this.party.find((p) => p.id === id) || null; }

  // ================================================================ scripting helpers
  /** Run an async script with player control locked. */
  async run(fn) {
    this.busy++;
    try { return await fn(); } catch (e) { G.reportError(e); } finally { this.busy--; }
  }

  async talkTo(a) {
    const p = this.ctrl;
    const yaw = Math.atan2(p.x - a.x, p.z - a.z);
    if (!a.fixed) a.face = yaw;
    p.ch.faceTo(a.x, a.z);
    if (a.talk) await a.talk(this, a);
  }

  /** Say a line; if the speaker is an actor or party member in this area they animate while talking. */
  async say(who, text, opts) {
    const a = typeof who === 'string' ? (this.named[who] && this.named[who].ch ? this.named[who] : this.member(who)) : null;
    const ch = a ? a.ch : null;
    let prev = null;
    if (ch && !ch.one && (ch.base === 'move' || ch.base === 'float')) { prev = ch.base; ch.setBase(ch.floaty ? 'float' : 'talk'); }
    await G.ui.say(who, text, opts);
    if (ch && prev) ch.setBase(prev);
  }

  /** Walk an actor (or party member) in a straight line to x,z. */
  async walk(a, x, z, speed = 5) {
    const d0 = dist(a.x, a.z, x, z);
    if (d0 < 0.05) return;
    const sx = a.x, sz = a.z;
    a.scripted = true;
    a.sp = speed;
    await this.tween(d0 / speed, (k) => {
      a.x = lerp(sx, x, k); a.z = lerp(sz, z, k);
      a.ch.setPos(a.x, a.z, a.y || 0);
      a.ch.face(Math.atan2(x - sx, z - sz), 0.016, 20);
      if (a.face !== undefined) a.face = Math.atan2(x - sx, z - sz);
    }, ease.linear);
    a.sp = 0;
    a.scripted = false;
    if (a.home) { a.home.x = x; a.home.z = z; }
  }

  /** Point the camera somewhere for a cutscene; release() hands it back. */
  async focus(x, z, zoom = 1, dur = 0.8) {
    const from = this.camOverride ? { ...this.camOverride } : { x: this.camTarget.x, z: this.camTarget.z, zoom: this.camZoom };
    this.camOverride = from;
    await this.tween(dur, (k) => { this.camOverride = { x: lerp(from.x, x, k), z: lerp(from.z, z, k), zoom: lerp(from.zoom, zoom, k) }; }, ease.inOut2);
  }
  release() { this.camOverride = null; }

  emote(a, text, cls = 'big') { G.ui.pop(text, { x: a.x, y: (a.y || 0) + (a.ch ? a.ch.height : 2) + 0.5, z: a.z }, cls, 1.2); }

  removeActor(id, poof = true) {
    const i = this.actors.findIndex((a) => a.id === id);
    if (i < 0) return;
    const a = this.actors[i];
    if (poof) this.fx.burst('puff', { x: a.x, y: 1, z: a.z }, 10, { speed: 2.5, up: 2, life: 0.5, s0: 0.6, color: 0xfff4dc, g: 0 });
    a.ch.dispose();
    this.actors.splice(i, 1);
    this.interacts = this.interacts.filter((it) => it.actor !== a);
    for (const m of this.markers.filter((mk) => mk.a === a)) m.el.remove();
    this.markers = this.markers.filter((mk) => mk.a !== a);
    delete this.named[id];
  }

  _bump(dir) {
    const p = this.ctrl;
    const d = dir || [0, 0];
    p.x += d[0]; p.z += d[1];
  }

  // ================================================================ field abilities
  /** Q: throw the football at whatever switch (or opponent) you're facing. */
  throwBall() {
    const p = this.leader;
    if (this.ballCd > 0 || this.solo) return;
    this.ballCd = 0.7;
    const yaw = p.ch.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let best = null, bestScore = 0.72; // cos of ~44°
    const consider = (tx, tz, ty, ref, kind) => {
      const dx = tx - p.x, dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8 || d > 15) return;
      const dot = (dx * fx + dz * fz) / d;
      const score = dot - d * 0.004;
      if (score > bestScore) { bestScore = score; best = { x: tx, z: tz, y: ty, ref, kind, d }; }
    };
    for (const t of this.targets) if (!t.hit || t.repeat) consider(t.x, t.z, t.y, t, 'target');
    for (const e of this.enemies) if (e.state !== 'stun') consider(e.x, e.z, 1.2, e, 'enemy');
    const from = { x: p.x + fx * 0.5, y: 1.5, z: p.z + fz * 0.5 };
    const to = best || { x: p.x + fx * 8, z: p.z + fz * 8, y: 0.2, kind: 'miss', d: 8 };
    const mesh = buildFootball(1.25);
    mesh.position.set(from.x, from.y, from.z);
    this.dynRoot.add(mesh);
    p.ch.play('throw');
    G.audio.sfx('throw');
    this.balls.push({ mesh, from, to, t: 0, dur: clamp(to.d / 17, 0.28, 0.85), arc: 1 + to.d * 0.09 });
  }

  _updateBalls(dt) {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      if (!b.done) {
        b.mesh.position.set(lerp(b.from.x, b.to.x, k), lerp(b.from.y, b.to.y, k) + Math.sin(k * Math.PI) * b.arc, lerp(b.from.z, b.to.z, k));
        b.mesh.rotation.y = Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z);
        b.mesh.rotation.z += dt * 18;
        if (k >= 1) {
          b.done = true; b.t = 0;
          const pos = { x: b.to.x, y: b.to.y, z: b.to.z };
          if (b.to.kind === 'target') {
            const t = b.to.ref;
            this.fx.impact(pos, 0xffd45a, 0.8);
            G.ui.pop('DING!', pos, '', 0.9);
            G.audio.sfx('switch');
            t.spin = 1;
            if (!t.hit || t.repeat) { t.hit = true; if (t.flag) setFlag(t.flag); if (t.fn) this.run(() => t.fn(this, t)); }
          } else if (b.to.kind === 'enemy') {
            const e = b.to.ref;
            this.fx.impact(pos, 0xffffff, 0.8);
            G.ui.pop('BONK!', pos, '', 0.9);
            G.audio.sfx('bonk');
            e.state = 'stun'; e.t = 3.2;
            e.ch.setExpr('dizzy', 3.2); e.ch.play('stumble');
          } else {
            this.fx.dust(pos.x, pos.z); G.audio.sfx('land');
          }
          b.vy = 4; b.vx = (b.from.x - b.to.x) * 0.25; b.vz = (b.from.z - b.to.z) * 0.25;
        }
      } else {
        b.vy -= 18 * dt;
        b.mesh.position.x += b.vx * dt; b.mesh.position.z += b.vz * dt; b.mesh.position.y = Math.max(0.15, b.mesh.position.y + b.vy * dt);
        b.mesh.rotation.x += dt * 9;
        if (b.t > 0.7) { this.fx.burst('puff', b.mesh.position, 4, { speed: 1.2, up: 1, life: 0.3, s0: 0.3, g: 0 }); b.mesh.removeFromParent(); this.balls.splice(i, 1); }
      }
    }
  }

  /** The lineman shoves a heavy object one step away from the player. */
  async shove(p) {
    const w = this.member('waffle');
    if (!w) { G.audio.sfx('deny'); await G.ui.say(null, 'It won\'t budge. You\'d need someone refrigerator-sized to shove this.'); return; }
    const me = this.ctrl;
    let dx = p.s.x - me.x, dz = p.s.z - me.z;
    if (Math.abs(dx) > Math.abs(dz)) { dx = Math.sign(dx); dz = 0; } else { dz = Math.sign(dz); dx = 0; }
    const nx = p.s.x + dx * p.step, nz = p.s.z + dz * p.step;
    const test = { x: nx, z: nz, w: p.s.w - 0.1, d: p.s.d - 0.1 };
    let blocked = nx < test.w / 2 || nz < test.d / 2 || nx > this.W - test.w / 2 || nz > this.D - test.d / 2;
    for (const s of this.solids) {
      if (s === p.s || s.off) continue;
      if (Math.abs(s.x - test.x) < (s.w + test.w) / 2 && Math.abs(s.z - test.z) < (s.d + test.d) / 2) { blocked = true; break; }
    }
    for (const c of this.rounds) if (pointInBox(c.x, c.z, test, c.r)) { blocked = true; break; }
    await this.run(async () => {
      // Waffle hustles to the near side and leans in
      const sx = p.s.x - dx * (p.s.w / 2 + 0.7), sz = p.s.z - dz * (p.s.d / 2 + 0.7);
      w.scripted = true;
      const fx0 = w.x, fz0 = w.z;
      await this.tween(0.22, (k) => { w.x = lerp(fx0, sx, k); w.z = lerp(fz0, sz, k); w.ch.setPos(w.x, w.z); w.ch.face(Math.atan2(dx, dz)); });
      w.ch.play('push', 0.55);
      G.audio.sfx('push');
      if (blocked) {
        await this.wait(0.3);
        this.fx.shake(0.12, 0.2);
        G.ui.pop('THUD', { x: p.s.x, y: 1.8, z: p.s.z }, 'white', 0.8);
        G.audio.sfx('thud');
      } else {
        const ox = p.s.x, oz = p.s.z;
        await this.tween(0.42, (k) => {
          p.s.x = lerp(ox, nx, k); p.s.z = lerp(oz, nz, k);
          p.obj.position.set(p.s.x, 0, p.s.z);
          w.x = lerp(sx, sx + dx * p.step, k); w.z = lerp(sz, sz + dz * p.step, k); w.ch.setPos(w.x, w.z);
          if (Math.random() < 0.5) this.fx.dust(p.s.x - dx * 0.9, p.s.z - dz * 0.9);
        }, ease.out2);
        this.fx.shake(0.1, 0.15);
        G.S.flags[p.key] = [nx, nz];
        if (p.onMove) await p.onMove(this, p);
      }
      await this.wait(0.15);
      w.scripted = false;
    });
  }

  /** Hand control to the smallest teammate on the far side of a gap. */
  async squeeze(g) {
    const small = this.party.find((p) => p.small && p !== this.leader);
    if (!small) { G.audio.sfx('deny'); await G.ui.say(null, 'Too tight for you. Someone much smaller could squeeze through.'); return; }
    await this.run(async () => {
      G.audio.sfx('squeak');
      small.scripted = true;
      const sx = small.x, sz = small.z;
      await this.tween(0.3, (k) => { small.x = lerp(sx, g.x, k); small.z = lerp(sz, g.z, k); small.ch.setPos(small.x, small.z); small.ch.faceTo(g.to[0], g.to[1]); });
      small.ch.play('hop');
      await this.tween(0.3, (k) => { small.x = lerp(g.x, g.to[0], k); small.z = lerp(g.z, g.to[1], k); small.ch.setPos(small.x, small.z); });
      this.fx.dust(small.x, small.z);
      this.solo = { p: small, g };
      this.ctrl = small;
      small.vx = small.vz = 0;
      G.ui.toast(`You're steering <b>${displayName(small.id)}</b>. ${G.ui.key('y')} regroups.`);
    });
  }

  async regroup() {
    if (!this.solo) return;
    const { p, g } = this.solo;
    await this.run(async () => {
      G.audio.sfx('squeak');
      this.fx.burst('puff', { x: p.x, y: 0.8, z: p.z }, 6, { speed: 2, up: 1.5, life: 0.4, s0: 0.45, g: 0 });
      p.x = g.back[0]; p.z = g.back[1];
      p.ch.setPos(p.x, p.z);
      this.fx.burst('puff', { x: p.x, y: 0.8, z: p.z }, 6, { speed: 2, up: 1.5, life: 0.4, s0: 0.45, g: 0 });
      this.solo = null;
      this.ctrl = this.leader;
      p.scripted = false;
      await this.wait(0.1);
    });
  }

  // ================================================================ movement
  moveCircle(e, dx, dz, r, small) {
    e.x += dx; e.z += dz;
    for (let it = 0; it < 2; it++) {
      for (const b of this.solids) {
        if (b.off || (small && b.tag === 'gap')) continue;
        if (Math.abs(e.x - b.x) > b.w / 2 + r || Math.abs(e.z - b.z) > b.d / 2 + r) continue;
        const p = circleBoxPush(e.x, e.z, r, b);
        if (p) { e.x += p.x; e.z += p.z; }
      }
      for (const c of this.rounds) {
        const p = circleCirclePush(e.x, e.z, r, c.x, c.z, c.r);
        if (p) { e.x += p.x; e.z += p.z; }
      }
    }
    e.x = clamp(e.x, r, this.W - r);
    e.z = clamp(e.z, r, this.D - r);
  }

  blocked(ax, az, bx, bz) {
    for (const s of this.solids) {
      if (s.off || s.tag === 'low' || s.tag === 'gap') continue;
      if (segBox(ax, az, bx, bz, s)) return true;
    }
    return false;
  }

  _control(dt) {
    const inp = G.input;
    const c = this.ctrl;
    const ax = inp.axis();
    const run = inp.running();
    let max = run ? RUN : WALK;
    // terrain
    let ice = null;
    for (const zn of this.zones) {
      if (zn.type === 'slow' && pointInBox(c.x, c.z, zn)) max *= zn.k ?? 0.55;
      if (zn.type === 'ice' && pointInBox(c.x, c.z, zn)) ice = zn;
    }
    if (ice) {
      // on ice you keep sliding in a straight line until something stops you
      if (!c.slide) {
        const mx = Math.abs(ax.x) > Math.abs(ax.y) ? Math.sign(ax.x) : 0, mz = mx ? 0 : Math.sign(ax.y);
        if (mx || mz) { c.slide = { x: mx, z: mz }; G.audio.sfx('juke'); }
        else if (Math.hypot(c.vx, c.vz) > 1) { c.slide = Math.abs(c.vx) > Math.abs(c.vz) ? { x: Math.sign(c.vx), z: 0 } : { x: 0, z: Math.sign(c.vz) }; }
      }
      if (c.slide) {
        const sp = 11;
        const px = c.x, pz = c.z;
        this.moveCircle(c, c.slide.x * sp * dt, c.slide.z * sp * dt, c.r, c.small);
        const moved = Math.hypot(c.x - px, c.z - pz);
        c.vx = c.slide.x * sp; c.vz = c.slide.z * sp;
        if (moved < sp * dt * 0.4) { c.slide = null; c.vx = c.vz = 0; G.audio.sfx('thud'); this.fx.dust(c.x, c.z, 0xffffff); }
        c.ch.face(Math.atan2(c.vx || 0.001, c.vz), dt);
        c.sp = 2;
        return;
      }
    } else c.slide = null;

    c.vx = damp(c.vx, ax.x * max, 16, dt);
    c.vz = damp(c.vz, ax.y * max, 16, dt);
    const px = c.x, pz = c.z;
    this.moveCircle(c, c.vx * dt, c.vz * dt, c.r, c.small);
    // don't walk through NPCs
    for (const a of this.actors) {
      if (!a.r) continue;
      const p = circleCirclePush(c.x, c.z, c.r, a.x, a.z, a.r * 0.9);
      if (p) { c.x += p.x; c.z += p.z; }
    }
    const moved = Math.hypot(c.x - px, c.z - pz);
    c.sp = moved / Math.max(dt, 1e-4);
    if (Math.hypot(c.vx, c.vz) > 0.6) c.ch.face(Math.atan2(c.vx, c.vz), dt, 16);
    this.stepT = (this.stepT || 0) + moved;
    if (this.stepT > (run ? 1.9 : 1.5)) { this.stepT = 0; G.audio.sfx(this.area.snow ? 'stepSnow' : 'step', run ? 1.3 : 1); if (run) this.fx.dust(c.x, c.z, this.area.dust || 0xe8d9b8, 1); }
  }

  _followers(dt) {
    const L = this.leader;
    const last = this.trail[0];
    if (dist(L.x, L.z, last.x, last.z) > 0.12) {
      this.trail.unshift({ x: L.x, z: L.z });
      if (this.trail.length > 90) this.trail.pop();
    }
    for (let i = 1; i < this.party.length; i++) {
      const f = this.party[i];
      if (f.scripted || (this.solo && this.solo.p === f)) { f.ch.update(dt, f.sp || 0); continue; }
      const tp = this.trail[Math.min(this.trail.length - 1, i * 9)];
      const d = dist(f.x, f.z, tp.x, tp.z);
      const px = f.x, pz = f.z;
      if (d > 0.08) {
        const sp = Math.min(d * 9, (L.sp || 0) * 1.25 + 2.5);
        const step = Math.min(d, sp * dt);
        f.x += ((tp.x - f.x) / d) * step; f.z += ((tp.z - f.z) / d) * step;
      }
      const moved = Math.hypot(f.x - px, f.z - pz);
      f.sp = moved / Math.max(dt, 1e-4);
      if (moved > 0.004) f.ch.face(Math.atan2(f.x - px, f.z - pz), dt, 12);
      else if (dist(f.x, f.z, L.x, L.z) < 3) f.ch.faceTo(L.x, L.z, dt, 3);
      f.ch.setPos(f.x, f.z);
      f.ch.update(dt, f.sp);
    }
  }

  _actors(dt, frozen) {
    for (const a of this.actors) {
      if (a.scripted) { a.ch.update(dt, a.sp || 0); continue; }
      let sp = 0;
      if (a.wander && !frozen) {
        a.wt -= dt;
        if (!a.dest && a.wt <= 0) {
          const ang = rand(TAU), r = rand(0.5, a.wander);
          a.dest = { x: a.home.x + Math.cos(ang) * r, z: a.home.z + Math.sin(ang) * r, t: 4 };
        }
        if (a.dest) {
          const d = dist(a.x, a.z, a.dest.x, a.dest.z);
          a.dest.t -= dt;
          if (d < 0.2 || a.dest.t <= 0) { a.dest = null; a.wt = rand(2.5, 7); } else {
            const px = a.x, pz = a.z;
            this.moveCircle(a, ((a.dest.x - a.x) / d) * 1.8 * dt, ((a.dest.z - a.z) / d) * 1.8 * dt, a.r || 0.4, false);
            sp = Math.hypot(a.x - px, a.z - pz) / Math.max(dt, 1e-4);
            a.face = Math.atan2(a.dest.x - a.x, a.dest.z - a.z);
            a.ch.setPos(a.x, a.z, a.y);
          }
        }
      }
      a.ch.face(a.face, dt, 8);
      a.ch.update(dt, sp);
    }
  }

  _enemies(dt, frozen) {
    const p = this.leader;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      let sp = 0;
      const dp = dist(e.x, e.z, p.x, p.z);
      if (!frozen) {
        const px = e.x, pz = e.z;
        if (e.state === 'stun') {
          e.t -= dt;
          if (Math.random() < dt * 5) this.fx.emit('star', e.x + rand(-0.5, 0.5), e.ch.height + 0.3, e.z, { vy: 0.6, life: 0.5, s0: 0.3, color: 0xffd45a, vrot: 5 });
          if (e.t <= 0) { e.state = 'patrol'; e.ch.setExpr('open'); }
        } else if (e.state === 'patrol' || e.state === 'return') {
          const tgt = e.state === 'return' ? e.home : { x: e.path[e.pi][0], z: e.path[e.pi][1] };
          const d = dist(e.x, e.z, tgt.x, tgt.z);
          if (e.wait > 0) e.wait -= dt;
          else if (d < 0.25) {
            if (e.state === 'return') e.state = 'patrol';
            e.pi = (e.pi + 1) % e.path.length; e.wait = e.path.length > 1 ? rand(0.6, 1.6) : 0;
          } else {
            const s = e.state === 'return' ? e.speed * 1.4 : e.speed;
            e.x += ((tgt.x - e.x) / d) * s * dt; e.z += ((tgt.z - e.z) / d) * s * dt;
            e.yaw = Math.atan2(tgt.x - e.x, tgt.z - e.z);
          }
          // spot the player?
          if (dp < e.sight && !this.solo) {
            const ang = Math.abs(wrapAngle(Math.atan2(p.x - e.x, p.z - e.z) - e.yaw));
            if ((ang < 1.15 || dp < 2.2) && !this.blocked(e.x, e.z, p.x, p.z)) {
              e.state = 'alert'; e.t = 0.55;
              this.emote(e, '!', 'big bad');
              G.audio.sfx('alarm');
              e.ch.play('flinch');
            }
          }
        } else if (e.state === 'alert') {
          e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
          e.t -= dt;
          if (e.t <= 0) { e.state = 'chase'; e.t = 0; }
        } else if (e.state === 'chase') {
          e.t += dt;
          const s = (e.def.chase ?? 6.4);
          const d = Math.max(dp, 0.001);
          this.moveCircle(e, ((p.x - e.x) / d) * s * dt, ((p.z - e.z) / d) * s * dt, e.r * 0.8, false);
          e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
          if (dp > e.sight * 1.7 || dist(e.x, e.z, e.home.x, e.home.z) > (e.def.leash ?? 16) || e.t > 9) { e.state = 'return'; this.emote(e, '?', 'white'); }
        }
        sp = Math.hypot(e.x - px, e.z - pz) / Math.max(dt, 1e-4);
        // contact → battle
        if (dp < 1.2 && this.busy === 0 && !this.solo) {
          const behind = Math.abs(wrapAngle(Math.atan2(p.x - e.x, p.z - e.z) - e.yaw)) > 1.5;
          const kind = e.state === 'chase' ? 'ambush' : (e.state === 'stun' || behind) ? 'blindside' : 'normal';
          this._encounter(e, kind);
        }
      }
      e.ch.setPos(e.x, e.z);
      e.ch.face(e.yaw, dt, 10);
      e.ch.update(dt, sp);
      e.minis.forEach((m, k) => {
        const tx = e.x - Math.sin(e.yaw) * (1.1 + k * 1.0) + (k % 2 ? 0.5 : -0.5), tz = e.z - Math.cos(e.yaw) * (1.1 + k * 1.0);
        const d = dist(m.x, m.z, tx, tz);
        let msp = 0;
        if (d > 0.15) { const st = Math.min(d, (sp + 2) * dt); m.x += ((tx - m.x) / d) * st; m.z += ((tz - m.z) / d) * st; msp = st / Math.max(dt, 1e-4); m.ch.face(Math.atan2(tx - m.x, tz - m.z), dt, 10); }
        m.ch.setPos(m.x, m.z); m.ch.update(dt, msp);
      });
    }
  }

  async _encounter(e, kind) {
    await this.run(async () => {
      G.audio.sfx('whistle');
      this.fx.impact({ x: (e.x + this.leader.x) / 2, y: 1.2, z: (e.z + this.leader.z) / 2 }, 0xffd45a, 1);
      G.ui.pop(kind === 'blindside' ? 'BLINDSIDE!' : kind === 'ambush' ? 'AMBUSHED!' : 'HUT!', { x: e.x, y: 2.6, z: e.z }, kind === 'ambush' ? 'big bad' : 'big');
      await this.wait(0.55);
      const result = await G.hooks.encounter(e.def, kind, this);
      if (result && result.won) {
        G.session.beaten.add(e.key);
        if (e.def.once) setFlag(`beat_${e.id}`);
        this.fx.burst('puff', { x: e.x, y: 1, z: e.z }, 12, { speed: 3, up: 2, life: 0.6, s0: 0.7, color: 0xfff4dc, g: 0 });
        e.ch.dispose(); for (const m of e.minis) m.ch.dispose();
        this.enemies.splice(this.enemies.indexOf(e), 1);
        if (e.def.onWin) await e.def.onWin(this);
      } else if (result && result.fled) {
        e.state = 'stun'; e.t = 2.5;
        const d = Math.max(0.1, dist(e.x, e.z, this.leader.x, this.leader.z));
        this.leader.x += ((this.leader.x - e.x) / d) * 2; this.leader.z += ((this.leader.z - e.z) / d) * 2;
      } else {
        // lost: back to the last bench, a little winded
        const cp = G.S.checkpoint || { area: this.areaId, x: this.area.spawn[0], z: this.area.spawn[1] };
        for (const id of G.S.roster) { const cs = charState(id); cs.st = Math.max(cs.st, Math.round(maxStamina(id) * 0.5)); }
        await G.fadeOut();
        this.loadArea(cp.area, cp.x, cp.z, { quiet: true });
        await G.fadeIn();
        G.ui.toast('You regroup at the last bench.');
      }
      save();
    });
  }

  _zones(dt, frozen) {
    const c = this.ctrl;
    for (const zn of this.zones) {
      if (zn.type !== 'sprinkler') continue;
      zn.t += dt;
      const on = !zn.off && (zn.t % zn.period) / zn.period < zn.duty;
      if (on !== zn.on) { zn.on = on; }
      if (on) {
        zn.spin = (zn.spin || 0) + dt * 5;
        for (let k = 0; k < 2; k++) {
          const a = zn.spin + k * Math.PI + rand(-0.2, 0.2), v = zn.r * 1.5;
          this.fx.emit('drop', zn.x, 0.5, zn.z, { vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 4.4, g: -12, life: 0.75, s0: 0.2, s1: 0.1, color: 0x9be8ff });
        }
        if (Math.random() < dt * 3) G.audio.sfx('sprinkler');
        if (!frozen) {
          const d = dist(c.x, c.z, zn.x, zn.z);
          if (d < zn.r) {
            // soaked: shoved back out of the spray
            const nx = (c.x - zn.x) / (d || 1), nz = (c.z - zn.z) / (d || 1);
            c.x = zn.x + nx * (zn.r + 0.4); c.z = zn.z + nz * (zn.r + 0.4);
            c.vx = nx * 6; c.vz = nz * 6;
            this.moveCircle(c, 0, 0, c.r, c.small);
            if ((zn.cd || 0) <= 0) {
              zn.cd = 0.8;
              G.audio.sfx('splash');
              G.ui.pop('SOAKED!', { x: c.x, y: 2.4, z: c.z }, 'cool', 0.9);
              this.fx.burst('drop', { x: c.x, y: 1, z: c.z }, 10, { speed: 3, up: 3, life: 0.5, s0: 0.25, color: 0x9be8ff });
              c.ch.play('flinch');
            }
          }
        }
      }
      if (zn.cd > 0) zn.cd -= dt;
    }
  }

  // ================================================================ camera & hud
  _camGoal() {
    const c = this.ctrl || this.leader;
    const a = this.area;
    let tx = c.x + (c.vx || 0) * 0.22, tz = c.z + (c.vz || 0) * 0.22 - 0.6;
    let zoom = this.camZoom;
    if (this.camOverride) { tx = this.camOverride.x; tz = this.camOverride.z; zoom = this.camOverride.zoom; }
    else {
      const mx = Math.min(this.W / 2, 11 * zoom * Math.min(1.6, this.camera.aspect / 1.78)), mz = Math.min(this.D / 2, 7.5 * zoom);
      if (a.fixedCam) { tx = a.fixedCam[0]; tz = a.fixedCam[1]; } else {
        tx = clamp(tx, mx, this.W - mx);
        tz = clamp(tz, mz - 1.5, this.D - mz + 2.5);
      }
    }
    return { tx, tz, zoom };
  }
  _snapCamera(keep) {
    const g = this._camGoal();
    if (!keep) this.camTarget.set(g.tx, 0, g.tz);
    this._zoomNow = g.zoom;
    this._placeCamera();
  }
  _placeCamera() {
    const d = this.camDist * this._zoomNow * (this.camera.aspect < 1.5 ? 1.5 / this.camera.aspect : 1);
    this.camera.position.set(this.camTarget.x, Math.sin(this.camPitch) * d, this.camTarget.z + Math.cos(this.camPitch) * d);
    this.camera.lookAt(this.camTarget.x, 0.6, this.camTarget.z);
    this.fx.applyShake(this.camera);
    this.rig.follow(this.camTarget.x, this.camTarget.z);
  }

  _buildHud() {
    this.hQuest = el('div.quest-box.hidden', el('div.q-title'), el('div.q-text'));
    this.hWallet = el('div.wallet');
    this.hHelp = el('div.help-tag');
    this.hud.append(this.hQuest, this.hWallet, this.hHelp);
  }
  _updateHud() {
    const S = G.S;
    const sig = `${S.coins}|${S.parts}|${G.input.device}|${S.questLog.length}|${JSON.stringify(S.quests)}|${S.roster.length}|${this.solo ? 1 : 0}|${flag('has_ball')}`;
    if (sig === this._hudSig && !this._hudDirty) return;
    this._hudSig = sig; this._hudDirty = false;
    const q = trackedQuest();
    if (q) {
      this.hQuest.classList.remove('hidden');
      this.hQuest.children[0].textContent = (q.main ? '★ ' : '') + q.title.toUpperCase();
      this.hQuest.children[1].textContent = q.text;
    } else this.hQuest.classList.add('hidden');
    this.hWallet.innerHTML = S.chapter > 0 || S.coins || S.parts ? `<div class="chip">🪙 ${S.coins}</div><div class="chip">🔩 ${S.parts}</div>` : '';
    const k = (a) => G.ui.key(a);
    const bits = [`${k('move')} move`, `${k('b')} run`, `${k('a')} talk`];
    if (flag('has_ball')) bits.push(`${k('x')} throw`);
    if (this.solo) bits.push(`${k('y')} regroup`);
    bits.push(`${k('menu')} menu`);
    this.hHelp.innerHTML = bits.join(' · ');
  }

  // ================================================================ main update
  update(dt) {
    const inp = G.input;
    const frozen = G.ui.busy || this.busy > 0;
    this.ballCd = Math.max(0, (this.ballCd || 0) - dt);
    const c = this.ctrl;

    if (!frozen) {
      this._control(dt);
      // interactions
      let best = null, bd = 1e9;
      for (const it of this.interacts) {
        if (it.cond && !it.cond()) continue;
        if (!!it.solo !== !!this.solo && it.solo !== undefined) continue;
        const ix = it.actor ? it.actor.x : it.x, iz = it.actor ? it.actor.z : it.z;
        const d = dist(c.x, c.z, ix, iz);
        if (d < it.r && d < bd) { bd = d; best = it; }
      }
      this.near = best;
      if (best) {
        G.ui.prompt('a', best.label);
        if (inp.take('a')) { G.ui.prompt(null); G.audio.sfx('ok'); c.vx = c.vz = 0; this.run(() => best.fn(this)); }
      } else G.ui.prompt(null);
      if (inp.hit('x') && flag('has_ball') && this.busy === 0) this.throwBall();
      if (inp.hit('y') && this.solo && this.busy === 0) this.regroup();
      if ((inp.take('menu') || inp.take('start')) && this.busy === 0 && G.hooks.menu) { c.vx = c.vz = 0; G.hooks.menu(this); }
      // triggers
      for (const t of this.triggers) {
        const inside = Math.abs(c.x - t.x) < t.w / 2 && Math.abs(c.z - t.z) < t.d / 2;
        if (inside && !t.inside && t.armed !== false) {
          if (t.once && flag(t.once)) { t.inside = inside; continue; }
          if (t.once) setFlag(t.once);
          t.inside = true;
          c.vx = c.vz = 0;
          this.run(() => t.fn(this, t));
          break;
        }
        if (!inside) t.armed = true;
        t.inside = inside;
      }
      // pickups
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        if (dist(c.x, c.z, pk.x, pk.z) < 1.0) {
          setFlag(pk.key);
          if (pk.o.coins) addCoins(pk.o.coins);
          if (pk.o.parts) addParts(pk.o.parts);
          if (pk.o.item) addItem(pk.o.item, pk.o.n || 1);
          this.fx.sparkle({ x: pk.x, y: 1, z: pk.z });
          pk.g.removeFromParent();
          this.pickups.splice(i, 1);
          if (pk.o.fn) this.run(() => pk.o.fn(this));
        }
      }
    } else {
      G.ui.prompt(null);
      c.vx = damp(c.vx, 0, 20, dt); c.vz = damp(c.vz, 0, 20, dt);
      if (!c.scripted) c.sp = 0;
    }
    if (!c.scripted) c.ch.setPos(c.x, c.z);
    c.ch.update(dt, c.sp || 0);
    if (this.solo && !this.leader.scripted) { this.leader.ch.update(dt, 0); }

    this._followers(dt);
    this._actors(dt, frozen);
    this._enemies(dt, frozen);
    this._zones(dt, frozen);
    this._updateBalls(dt);
    for (const u of this.updaters) u(dt, this.time, this);
    for (const pk of this.pickups) { pk.g.rotation.y += dt * 2.4; pk.g.position.y = 0.8 + Math.sin(this.time * 3 + pk.x) * 0.12; }
    for (const t of this.targets) if (t.spin > 0 && t.obj.userData.head) { t.spin = Math.max(0, t.spin - dt * 1.2); t.obj.userData.head.rotation.y += dt * 30 * t.spin; if (t.spin === 0) t.obj.userData.head.rotation.y = t.hit && !t.repeat ? Math.PI / 2 : 0; }

    // fade things that hide the character you are steering
    for (const o of this.occluders) {
      const hide = c.x > o.minX - 0.3 && c.x < o.maxX + 0.3 && c.z < (o.light ? o.cz - 0.2 : o.maxZ - 0.4) && c.z > o.minZ - o.h * 0.8;
      const goal = hide ? (o.light ? 0.4 : 0.3) : 1;
      if (Math.abs(o.k - goal) > 0.01) {
        o.k = damp(o.k, goal, 10, dt);
        if (Math.abs(o.k - goal) <= 0.01) o.k = goal;
        const tr = o.k < 0.99;
        for (const m of o.mats) { if (m.transparent !== tr && !m.userData.wasT) { if (m.userData.wasT === undefined) m.userData.wasT = m.transparent; if (!m.userData.wasT) { m.transparent = tr; m.needsUpdate = true; } } m.opacity = (m.userData.baseO ?? (m.userData.baseO = m.opacity)) * o.k; }
      }
    }

    // camera
    const g = this._camGoal();
    const lam = this.camOverride ? 30 : 6;
    this.camTarget.x = damp(this.camTarget.x, g.tx, lam, dt);
    this.camTarget.z = damp(this.camTarget.z, g.tz, lam, dt);
    this._zoomNow = damp(this._zoomNow, g.zoom, 5, dt);
    this._placeCamera();
    this.fx.update(dt, this.camera);

    // markers
    for (const m of this.markers) {
      const a = m.a;
      const h = a.ch ? a.ch.height + 0.35 + (a.y || 0) : (a.markH || 2.4);
      const s = G.ui.project({ x: a.x, y: h, z: a.z }, this.camera);
      m.el.style.left = `${s.x}px`; m.el.style.top = `${s.y}px`;
    }
    this._updateHud();
    G.S.playTime += dt;
    if (this.busy === 0 && !this.solo) { G.S.pos = { x: this.leader.x, z: this.leader.z }; }
  }
}
