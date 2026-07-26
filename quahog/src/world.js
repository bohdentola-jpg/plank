// The game itself: one town, one Griffin, a camera behind them, and every
// system in the folder wired together — driving, walking, punching, traffic,
// cops, pickups, missions, gags and the clock that moves the whole cast around.
import * as THREE from 'three';
import { InkPass, buildSky, toon, flat, skyAt, blobShadow, INK } from './toon.js';
import { setNight } from './buildings.js';
import { buildCity, HALF, whereIs } from './city.js';
import { ROADS, roadPoint, plot, roadGraph, edgesNear, nearestRoad, roadClearance } from './roads.js';
import { CHARACTERS, charSpec, buildCharacter, buildSimplePed, poseRig, talk, randomPedSpec } from './cast.js';
import { Crowd, NpcDirector, Traffic, Police, buildChicken } from './actors.js';
import { VEHICLES, buildVehicle, Vehicle, randomTrafficDef } from './vehicles.js';
import { Hud, districtAt } from './hud.js';
import { Director } from './cutscene.js';
import {
  MISSIONS, MissionRunner, missionById, LEVELS, levelById, availableIn, levelComplete,
} from './missions.js';
import { OPENING } from './story.js';
import { GAGS } from './gags.js';
import { sfx } from './audio.js';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------- input
class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.pad = null;
    this.padPrev = [];
    this._down = (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      this.pressed.add(k);
      if (['Space', 'Tab', 'KeyM', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    };
    this._up = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', () => this.keys.clear());
    // mouse look, either dragged or with the pointer locked
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false;
    this._move = (e) => {
      if (document.pointerLockElement || this.dragging) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    };
    this._mdown = (e) => { if (e.button === 2 || e.button === 1) this.dragging = true; };
    this._mup = () => { this.dragging = false; };
    this._ctx = (e) => e.preventDefault();
    window.addEventListener('mousemove', this._move);
    window.addEventListener('mousedown', this._mdown);
    window.addEventListener('mouseup', this._mup);
    window.addEventListener('contextmenu', this._ctx);
  }

  takeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  poll() {
    let pads = [];
    try { pads = navigator.getGamepads?.() || []; } catch { /* none */ }
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  endFrame() {
    this.pressed.clear();
    if (this.pad) this.padPrev = this.pad.buttons.map((b) => b.pressed);
  }

  padButton(i) { return !!this.pad?.buttons[i]?.pressed; }
  padHit(i) { return this.padButton(i) && !this.padPrev[i]; }
  axis(i) {
    const v = this.pad?.axes[i] || 0;
    return Math.abs(v) < 0.16 ? 0 : v;
  }

  dispose() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
    window.removeEventListener('mousemove', this._move);
    window.removeEventListener('mousedown', this._mdown);
    window.removeEventListener('mouseup', this._mup);
    window.removeEventListener('contextmenu', this._ctx);
  }
}

// ------------------------------------------------------------------- world
export class World {
  constructor(holder, save, opts = {}) {
    this.holder = holder;
    this.save = save;
    this.opts = opts;
    this.paused = false;
    this.t = 0;
    this.frames = 0;
    this.fpsClock = 0;
    this.quality = 1;

    // ---- renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.setSize(holder.clientWidth || innerWidth, holder.clientHeight || innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    holder.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, this.aspect, 0.4, 1200);
    this.camera.position.set(0, 6, -10);

    this.sky = buildSky(700);
    this.scene.add(this.sky.group);
    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#5f7a4a', 1.0);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff6e0', 1.2);
    this.sun.position.set(90, 160, 60);
    this.scene.add(this.sun);
    this.scene.fog = new THREE.Fog('#dcecf8', 170, 470);

    // ---- town
    this.city = buildCity();
    this.scene.add(this.city.group);
    this.colliders = this.city.colliders;

    // ---- populace
    this.crowd = new Crowd(this.scene, this.city, opts.lowSpec ? 18 : 30);
    this.npcs = new NpcDirector(this.scene, this.city);
    this.traffic = new Traffic(this.scene, this.city, opts.lowSpec ? 8 : 14);
    this.police = new Police(this.scene, this.city);

    // ---- player
    this.player = {
      id: save.char || 'peter', rig: null, x: 0, z: 0, y: 0, yaw: 0, vy: 0,
      speed: 0, vehicle: null, health: 100, punchT: 0, specialT: 0, clip: 'idle',
    };
    this.wanted = 0;
    this.wantedCool = 0;
    this.hour = save.hour ?? 9;
    this.day = save.day ?? 0;
    this.camYaw = 0;
    this.camPitch = 0.28;
    this.camPos = new THREE.Vector3();

    // ---- systems
    this.hud = new Hud();
    this.director = new Director({ camera: this.camera, world: this });
    this.missions = new MissionRunner(this);
    this.input = new Input();
    this.ink = new InkPass(renderer, { scale: opts.lowSpec ? 0.7 : 0.85 });
    this.ink.setSize(this.width, this.height);

    // ---- world objects
    this.vehicles = [];
    this.pickups = [];
    this.coins = [];
    this.checkpoints = [];
    this.brawlers = [];
    this.boss = null;
    this.rival = null;
    this.marker = null;
    this.gagMarkers = [];
    this.missionMarkers = [];
    this.collectibles = [];
    this.impacts = [];

    this.spawnParkedCars();
    this.spawnSignatureCars();
    this.spawnCoins();
    this.buildGagMarkers();
    this.setCharacter(this.player.id, true);
    this.refreshCollectibles();

    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
    // click the world to capture the mouse for looking around
    this._lock = () => {
      if (this.paused || this.director.active) return;
      renderer.domElement.requestPointerLock?.();
    };
    renderer.domElement.addEventListener('click', this._lock);
    this.clock = new THREE.Clock();
  }

  get width() { return this.holder.clientWidth || innerWidth; }
  get height() { return this.holder.clientHeight || innerHeight; }
  get aspect() { return this.width / Math.max(1, this.height); }

  resize() {
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.ink.setSize(this.width, this.height);
  }

  // ------------------------------------------------------------ characters
  setCharacter(id, initial = false) {
    const spec = charSpec(id);
    if (this.player.rig) this.scene.remove(this.player.rig.group);
    const rig = buildCharacter(spec);
    this.scene.add(rig.group);
    this.player.rig = rig;
    this.player.id = id;
    this.save.char = id;
    this.npcs.addFamily(id);
    this.hud.setCharacter(id);
    if (initial) {
      const home = this.city.spots.griffin;
      this.player.x = home.x - 3;
      this.player.z = home.z + 11;
      this.player.yaw = 0.4;
      // your ride is on the driveway
      const def = VEHICLES[spec.car] || VEHICLES.wagon;
      const mine = this.addVehicle(def, home.x + 5.5, home.z + 9, 0, { own: true });
      this.myCar = mine;
    }
    this.refreshMissionMarkers();
  }

  /** The director asks for these by character id. */
  actorFor(id) {
    if (id === this.player.id) return this.player.rig;
    const n = this.npcs.npcs[id];
    if (n?.rig) return n.rig;
    return this.tempActors?.[id] || null;
  }

  // -------------------------------------------------------------- vehicles
  addVehicle(def, x, z, yaw = 0, opts = {}) {
    const model = buildVehicle(def, opts);
    this.scene.add(model.group);
    const v = new Vehicle(model, x, z, yaw);
    v.own = !!opts.own;
    v.sync(0.016);
    this.vehicles.push(v);
    return v;
  }

  spawnParkedCars() {
    const { edges } = roadGraph();
    let n = 0;
    for (const e of edges) {
      if (e.len < 26 || n > 40) continue;
      if (Math.random() < 0.45) continue;
      const t = 0.25 + Math.random() * 0.5;
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = e.a.x + (e.b.x - e.a.x) * t;
      const z = e.a.z + (e.b.z - e.a.z) * t;
      const dir = Math.atan2(e.b.x - e.a.x, e.b.z - e.a.z);
      const off = side * (e.w / 2 - 1.5);
      const cx = x + Math.cos(dir) * off;
      const cz = z - Math.sin(dir) * off;
      if (this.colliders.resolve(cx, cz, 2.4).hit) continue;
      const { def, color } = randomTrafficDef();
      this.addVehicle(def, cx, cz, dir + (side > 0 ? 0 : Math.PI), { color });
      n++;
    }
  }

  /** The cars that belong to specific places: news van, cruisers, brewery truck. */
  spawnSignatureCars() {
    const at = (id, dx, dz, def, yaw = 0) => {
      const spot = this.city.spots[id];
      if (!spot) return;
      const x = spot.x + dx, z = spot.z + dz;
      if (this.colliders.resolve(x, z, 2.4).hit) return;
      this.addVehicle(def, x, z, yaw);
    };
    at('channel5', 12, 14, VEHICLES.newsvan, 0.4);
    at('police', -10, 16, VEHICLES.police, 0.2);
    at('police', -16, 16, VEHICLES.police, 0.2);
    at('clam', 12, 12, VEHICLES.clamvan, -0.3);
    at('brewery', 22, 20, VEHICLES.clamvan, 1.2);
    at('mall', -30, -22, VEHICLES.bus, 0.1);
    at('school', 18, 20, VEHICLES.bus, 0.1);
    at('airport', -18, 18, VEHICLES.taxi, 0.5);
    at('cabana', 14, 14, VEHICLES.sports, -0.4);
    at('pewterschmidt', 18, 22, VEHICLES.sports, 0.6);
  }

  // ---------------------------------------------------------------- coins
  spawnCoins() {
    const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12);
    const mat = toon('#f2b705');
    const { edges } = roadGraph();
    for (let i = 0; i < 70; i++) {
      const e = edges[(Math.random() * edges.length) | 0];
      const t = Math.random();
      const side = Math.random() < 0.5 ? -1 : 1;
      const dir = Math.atan2(e.b.x - e.a.x, e.b.z - e.a.z);
      const off = side * (e.w / 2 + 3.4);
      const x = e.a.x + (e.b.x - e.a.x) * t + Math.cos(dir) * off;
      const z = e.a.z + (e.b.z - e.a.z) * t - Math.sin(dir) * off;
      if (this.colliders.resolve(x, z, 1).hit) continue;
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = Math.PI / 2;
      m.position.set(x, 0.9, z);
      this.scene.add(m);
      this.coins.push({ mesh: m, x, z, taken: false, respawn: 0 });
    }
  }

  // --------------------------------------------------------------- markers
  makeRing(color, radius) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.22, 8, 26), flat(color));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.25;
    g.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, 9, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 4.5;
    beam.userData.noMerge = true;
    g.add(beam);
    return g;
  }

  setMarker(x, z, opts = {}) {
    if (this.marker) { this.scene.remove(this.marker.obj); this.marker = null; }
    if (x === null || x === undefined) return;
    const obj = this.makeRing(opts.color || '#f2b705', opts.radius || 6);
    obj.position.set(x, 0, z);
    this.scene.add(obj);
    this.marker = { obj, x, z, r: opts.radius || 6, label: opts.label };
  }

  buildGagMarkers() {
    for (const gag of GAGS) {
      const p = this.resolveSpot(gag.at);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), toon('#c0392b'));
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.44), flat('#9fd6f5'));
      screen.position.z = 0.36;
      body.add(screen);
      for (const s of [-1, 1]) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), toon('#3a3a44'));
        ant.position.set(s * 0.2, 0.55, 0);
        ant.rotation.z = s * 0.5;
        body.add(ant);
      }
      body.position.y = 1.5;
      g.add(body);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
      this.gagMarkers.push({ gag, obj: g, x: p.x, z: p.z, body });
    }
  }

  refreshMissionMarkers() {
    for (const m of this.missionMarkers) this.scene.remove(m.obj);
    this.missionMarkers.length = 0;
    const list = this.save.mode === 'free'
      ? MISSIONS.filter((m) => m.char === this.player.id && !this.save.done.includes(m.id))
      : availableIn(this.save.level || 1, this.save);
    for (const m of list) {
      const p = this.resolveSpot(m.start);
      const g = new THREE.Group();
      const gold = m.story !== false;
      const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), flat(gold ? '#f2b705' : '#7ad0f2'));
      dia.position.y = 2.4;
      g.add(dia);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 7, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: gold ? '#f2b705' : '#7ad0f2', transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false })
      );
      beam.position.y = 3.5;
      g.add(beam);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
      this.missionMarkers.push({ mission: m, obj: g, x: p.x, z: p.z, spin: dia });
    }
  }

  /** The seven collector items hidden around this level's patch of town. */
  refreshCollectibles() {
    for (const c of this.collectibles) this.scene.remove(c.obj);
    this.collectibles.length = 0;
    const lvl = levelById(this.save.level || 1);
    if (!lvl?.collectible) return;
    const found = this.save.found[lvl.id] || [];
    const centre = this.resolveSpot(lvl.collectible.around);
    const rng = mulberry(lvl.id * 7919);
    for (let i = 0; i < lvl.collectible.n; i++) {
      if (found.includes(i)) continue;
      let x = centre.x, z = centre.z;
      for (let tries = 0; tries < 40; tries++) {
        const a = rng() * Math.PI * 2;
        const r = lvl.collectible.radius * (0.25 + rng() * 0.75);
        x = centre.x + Math.cos(a) * r;
        z = centre.z + Math.sin(a) * r;
        if (Math.abs(x) < HALF - 14 && Math.abs(z) < HALF - 14 && !this.colliders.resolve(x, z, 1.4).hit) break;
      }
      const g = new THREE.Group();
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.18), toon('#2a2a32'));
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.22), flat('#f2f2ee'));
      label.position.z = 0.1;
      tape.add(label);
      tape.position.y = 1.1;
      g.add(tape);
      const halo = this.makeRing('#7ad0f2', 1.4);
      g.add(halo);
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.collectibles.push({ obj: g, tape, x, z, index: i, level: lvl.id });
    }
  }

  // ------------------------------------------------------- mission plumbing
  resolveSpot(ref) {
    if (!ref) return { x: 0, z: 0 };
    if (ref.x !== undefined && ref.spot === undefined) return { x: ref.x, z: ref.z };
    const s = this.city.spots[ref.spot] || this.city.spots.griffin;
    return { x: s.x + (ref.dx || 0), z: s.z + (ref.dz || 0) };
  }

  randomPointsAround(center, radius, n) {
    const pts = [];
    let guard = 0;
    while (pts.length < n && guard++ < n * 60) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.3 + Math.random() * 0.7);
      const x = center.x + Math.cos(a) * r;
      const z = center.z + Math.sin(a) * r;
      if (Math.abs(x) > HALF - 12 || Math.abs(z) > HALF - 12) continue;
      const res = this.colliders.resolve(x, z, 1.2);
      if (res.hit) continue;
      pts.push({ x, z });
    }
    return pts;
  }

  randomTownPoints(n) {
    const pts = [];
    const { edges } = roadGraph();
    let guard = 0;
    while (pts.length < n && guard++ < n * 80) {
      const e = edges[(Math.random() * edges.length) | 0];
      const t = Math.random();
      const side = Math.random() < 0.5 ? -1 : 1;
      const dir = Math.atan2(e.b.x - e.a.x, e.b.z - e.a.z);
      const off = side * (e.w / 2 + 4);
      const x = e.a.x + (e.b.x - e.a.x) * t + Math.cos(dir) * off;
      const z = e.a.z + (e.b.z - e.a.z) * t - Math.sin(dir) * off;
      if (this.colliders.resolve(x, z, 1.2).hit) continue;
      pts.push({ x, z });
    }
    return pts;
  }

  spawnPickups(points, kind) {
    this.clearPickups();
    const colors = { cheque: '#dfe8b0', crate: '#b8864a', part: '#9aa0a8', bag: '#c0392b', page: '#f4f4ee', paper: '#f0efe4' };
    const mat = toon(colors[kind] || '#f2b705');
    for (const p of points) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat);
      box.position.set(p.x, 0.8, p.z);
      const halo = this.makeRing('#f2b705', 1.5);
      halo.position.set(p.x, 0, p.z);
      this.scene.add(box);
      this.scene.add(halo);
      this.pickups.push({ x: p.x, z: p.z, mesh: box, halo, taken: false });
    }
  }

  clearPickups() {
    for (const p of this.pickups) { this.scene.remove(p.mesh); this.scene.remove(p.halo); }
    this.pickups.length = 0;
  }

  spawnCheckpoints(route) {
    this.clearCheckpoints();
    route.forEach(([x, z], i) => {
      const ring = this.makeRing(i === 0 ? '#f2b705' : '#3f95cf', 5.5);
      ring.position.set(x, 0, z);
      ring.visible = i === 0;
      this.scene.add(ring);
      this.checkpoints.push({ x, z, obj: ring, taken: false, index: i });
    });
    this.cpIndex = 0;
  }

  clearCheckpoints() {
    for (const c of this.checkpoints) this.scene.remove(c.obj);
    this.checkpoints.length = 0;
    this.cpIndex = 0;
  }

  checkpointsLeft() { return this.checkpoints.filter((c) => !c.taken).length; }
  checkpointsTaken() { return this.checkpoints.filter((c) => c.taken).length; }
  checkpointsTotal() { return this.checkpoints.length; }

  spawnRival(who, route) {
    this.clearRival();
    const spec = CHARACTERS[who] || CHARACTERS.brian;
    const def = VEHICLES[spec.car] || VEHICLES.sedan;
    const v = this.addVehicle(def, route[0][0], route[0][1], 0);
    v.driver = 'rival';
    this.rival = { v, route, leg: 0, t: 0 };
  }

  clearRival() {
    if (!this.rival) return;
    this.removeVehicle(this.rival.v);
    this.rival = null;
  }

  removeVehicle(v) {
    this.scene.remove(v.group);
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
  }

  spawnBrawlers(n) {
    this.clearBrawlers();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const spec = randomPedSpec();
      spec.body = ['chubby', 'round', 'slim'][i % 3];
      const rig = buildSimplePed(spec);
      const x = this.player.x + Math.cos(a) * (7 + Math.random() * 7);
      const z = this.player.z + Math.sin(a) * (7 + Math.random() * 7);
      rig.group.position.set(x, 0, z);
      this.scene.add(rig.group);
      this.brawlers.push({ rig, x, z, hp: 1, down: 0, swing: Math.random() * 2 });
    }
  }

  clearBrawlers() {
    for (const b of this.brawlers) this.scene.remove(b.rig.group);
    this.brawlers.length = 0;
  }

  spawnBoss(hits) {
    if (this.boss) this.clearBoss();
    const rig = buildChicken();
    const a = Math.random() * Math.PI * 2;
    const x = this.player.x + Math.cos(a) * 14;
    const z = this.player.z + Math.sin(a) * 14;
    rig.group.position.set(x, 0, z);
    this.scene.add(rig.group);
    this.boss = { rig, x, z, hp: hits, max: hits, swing: 1.4, stun: 0, yaw: 0 };
    sfx.setMusic('chase');
  }

  clearBoss() {
    if (!this.boss) return;
    this.scene.remove(this.boss.rig.group);
    this.boss = null;
    sfx.setMusic('town');
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, 5);
    this.wantedCool = 22;
    this.hud.setStars(this.wanted);
    if (this.wanted > 0) sfx.setMusic('chase'); else sfx.setMusic('town');
  }

  bump(amount, reason) {
    if (this.player.id === 'meg' && Math.random() < 0.5) return;  // nobody notices Meg
    this.setWanted(Math.min(5, this.wanted + amount));
  }

  // ------------------------------------------------------------- cutscenes
  /**
   * Stage a scene. Anyone with a line gets a body: the player uses their own
   * rig, everyone else gets a fresh one dropped in front of the camera (and
   * their walking-around copy is hidden so there are never two of them).
   */
  async playScript(beats, { title, gag, stage, at } = {}) {
    const actors = {};
    const temps = [];
    const hidden = [];
    const centre = at || { x: this.player.x + Math.sin(this.player.yaw) * 1.6, z: this.player.z + Math.cos(this.player.yaw) * 1.6 };
    const stageMap = new Map((stage || []).map((s) => [s.who, s]));
    const cast = [];
    for (const b of beats) if (b.who && !cast.includes(b.who)) cast.push(b.who);
    for (const s of stage || []) if (!cast.includes(s.who)) cast.push(s.who);

    const extras = cast.filter((w) => w !== this.player.id || at);
    extras.forEach((who, i) => {
      const npc = this.npcs.npcs[who];
      if (npc?.rig) { npc.rig.group.visible = false; hidden.push(npc.rig.group); }
      const rig = buildCharacter(charSpec(who));
      this.scene.add(rig.group);
      temps.push(rig);
      const s = stageMap.get(who);
      let x, z, face;
      if (s) {
        x = centre.x + (s.dx || 0);
        z = centre.z + (s.dz || 0);
        face = s.face ?? 0;
      } else {
        // a loose semicircle in front of whoever is playing
        const spread = extras.length > 1 ? (i / (extras.length - 1) - 0.5) * 1.7 : 0;
        const a = this.player.yaw + spread;
        x = centre.x + Math.sin(a) * 1.5;
        z = centre.z + Math.cos(a) * 1.5;
        face = a + Math.PI;
      }
      rig.group.position.set(x, 0, z);
      rig.group.rotation.y = face;
      actors[who] = rig;
    });
    if (!actors[this.player.id]) {
      actors[this.player.id] = this.player.rig;
      this.player.rig.group.visible = true;
      // the rig only follows the player on a live frame, so catch it up first
      this.player.rig.group.position.set(this.player.x, 0, this.player.z);
      // turn the player toward the scene
      const dx = centre.x - this.player.x, dz = centre.z - this.player.z;
      if (Math.hypot(dx, dz) > 0.3) this.player.rig.group.rotation.y = Math.atan2(dx, dz);
    }
    this.tempActors = actors;
    document.getElementById('hud').style.opacity = '0';
    await this.director.play({ title, gag, beats, actors });
    document.getElementById('hud').style.opacity = '';
    for (const r of temps) this.scene.remove(r.group);
    for (const g of hidden) g.visible = true;
    this.tempActors = null;
  }

  async playGag(entry) {
    if (this.director.active) return;
    const at = { x: entry.x, z: entry.z };
    const stage = entry.gag.cast.map((c) => ({ ...c }));
    // face the staged actors at each other
    await this.playScript(entry.gag.beats, { title: entry.gag.title, gag: true, stage, at });
    if (!this.save.gags.includes(entry.gag.id)) {
      this.save.gags.push(entry.gag.id);
      this.addCoins(entry.gag.reward);
      this.hud.toast(`CUTAWAY GAG! +${entry.gag.reward}`, 'good');
    }
    this.opts.onSave?.();
  }

  async startMission(mission) {
    if (this.missions.active) return;
    await this.playScript(mission.brief, { title: `${mission.title}   ·   ${mission.episode}` });
    this.missions.start(mission);
    sfx.setMusic(mission.boss ? 'chase' : 'town');
  }

  onMissionStart(m) {
    this.hud.toast(m.title, 'good');
  }

  async onMissionComplete(m) {
    this.save.done.push(m.id);
    this.addCoins(m.reward);
    this.hud.clearObjective();
    sfx.win();
    if (m.boss) this.clearBoss();
    await this.playScript(m.outro, { title: 'JOB DONE' });
    this.hud.toast(`+${m.reward} CLAMS`, 'good');
    this.refreshMissionMarkers();
    this.opts.onSave?.();
    if (this.save.mode !== 'free' && levelComplete(this.save.level, this.save)) {
      await this.finishLevel();
    }
  }

  /** New game: the cold open, then level one. */
  async beginStory() {
    const home = this.city.spots.griffin;
    this.player.x = home.x - 2;
    this.player.z = home.z + 12;
    await this.playScript(OPENING, { title: 'QUAHOG HIT & RUN' });
    await this.beginLevel(levelById(this.save.level || 1));
  }

  /** Level over: outro, then straight into the next one, character and all. */
  async finishLevel() {
    const lvl = levelById(this.save.level);
    if (!lvl) return;
    await this.playScript(lvl.outro, { title: `${lvl.card} COMPLETE` });
    const next = levelById(this.save.level + 1);
    if (!next) {
      this.save.finished = true;
      this.opts.onSave?.();
      this.opts.onStoryComplete?.();
      return;
    }
    this.save.level = next.id;
    if (!this.save.unlocked.includes(next.char)) this.save.unlocked.push(next.char);
    this.opts.onSave?.();
    this.beginLevel(next);
  }

  /** Drop the player into a level: right character, right corner of town. */
  async beginLevel(lvl) {
    this.setCharacter(lvl.char);
    const home = this.city.spots[lvl.missions[0].start.spot] || this.city.spots.griffin;
    this.exitVehicle(true);
    this.player.x = home.x + 6;
    this.player.z = home.z + 14;
    this.player.health = 100;
    this.hud.setHealth(1);
    this.refreshCollectibles();
    this.refreshMissionMarkers();
    this.hud.toast(`${lvl.card} — ${lvl.name}`, 'good');
    await this.playScript(lvl.intro, { title: `${lvl.card}\n${lvl.name}` });
    // put the level's car on the kerb next to you
    const spec = charSpec(lvl.char);
    const def = VEHICLES[spec.car] || VEHICLES.wagon;
    this.myCar = this.addVehicle(def, home.x + 12, home.z + 12, 0, { own: true });
  }

  onMissionFail(m, reason) {
    this.hud.clearObjective();
    this.hud.toast(`MISSION FAILED — ${reason}`, 'bad');
    sfx.fail();
    if (m?.boss) this.clearBoss();
    this.refreshMissionMarkers();
  }

  addCoins(n) {
    this.save.coins = Math.max(0, (this.save.coins || 0) + n);
    this.hud.setCoins(this.save.coins);
  }

  // ------------------------------------------------------------- the loop
  update() {
    const dtRaw = this.clock.getDelta();
    const dt = Math.min(dtRaw, 0.05);
    if (this.paused) { this.render(); return; }
    this.t += dt;

    if (this.director.active) {
      this.director.update(dt);
      if (this.input.hit('Space') || this.input.hit('Enter') || this.input.padHit(0)) this.director.skip();
      this.tickWorldLite(dt);
      this.input.endFrame();
      this.render();
      return;
    }

    this.input.poll();
    this.tickClock(dt);
    this.tickPlayer(dt);
    this.tickVehicles(dt);
    this.tickActors(dt);
    this.tickPickups(dt);
    this.tickCombat(dt);
    this.tickInteractions(dt);
    this.missions.update(dt);
    this.tickCamera(dt);
    this.tickHud(dt);
    this.input.endFrame();
    this.render();
    this.trackPerf(dtRaw);
  }

  /** During a cutscene the town keeps breathing, but nothing can hurt you. */
  tickWorldLite(dt) {
    // the town keeps moving, but nobody in the scene gets teleported home
    this.city.update(this.t, dt);
    this.sky.update(this.hour, dt, this.camera.position);
    this.crowd.update(dt, { x: this.player.x, z: this.player.z, speed: 0 }, []);
  }

  tickClock(dt) {
    this.city.update(this.t, dt);
    this.hour += dt / 60;              // one real minute is one Quahog hour
    if (this.hour >= 24) { this.hour -= 24; this.day++; }
    this.save.hour = this.hour;
    this.save.day = this.day;
    const s = this.sky.update(this.hour, dt, this.camera.position);
    this.hemi.intensity = s.amb;
    this.sun.intensity = s.dir;
    this.sun.color.set(s.sun);
    this.scene.fog.color.set(s.fog);
    this.renderer.setClearColor(s.fog);
    setNight(s.night);
  }

  /** WASD only. Arrows and the mouse belong to the camera. */
  moveInput() {
    const i = this.input;
    let mx = 0, mz = 0;
    if (i.down('KeyA')) mx -= 1;
    if (i.down('KeyD')) mx += 1;
    if (i.down('KeyW')) mz += 1;
    if (i.down('KeyS')) mz -= 1;
    const ax = i.axis(0), ay = i.axis(1);
    if (ax || ay) { mx = ax; mz = -ay; }
    return { mx, mz };
  }

  /** The direction the camera is facing, flattened. Screen-up is -fwd. */
  camBasis() {
    const f = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    return { f, r };
  }

  /** Mouse, right stick and arrow keys all swing the camera. */
  tickCameraInput(dt) {
    const i = this.input;
    const { dx, dy } = i.takeMouse();
    let turn = 0, pitch = 0;
    if (i.down('ArrowLeft')) turn -= 1;
    if (i.down('ArrowRight')) turn += 1;
    if (i.down('KeyQ')) turn -= 1;
    if (i.down('KeyE') && i.down('ShiftLeft')) turn += 1;
    if (i.down('ArrowUp')) pitch -= 1;
    if (i.down('ArrowDown')) pitch += 1;
    turn += i.axis(2);
    pitch += i.axis(3) * 0.7;
    this.camYaw -= dx * 0.0032;
    this.camPitch = clamp(this.camPitch + dy * 0.0022 + pitch * 1.3 * dt, -0.25, 0.95);
    this.camYaw += turn * 2.3 * dt;
    if (dx || turn) this.camManual = 1.4;
    else if (this.camManual > 0) this.camManual -= dt;
  }

  tickPlayer(dt) {
    const p = this.player;
    const spec = charSpec(p.id);
    const i = this.input;

    this.tickCameraInput(dt);

    if (p.vehicle) {
      const v = p.vehicle;
      const { mx, mz } = this.moveInput();
      const throttle = i.padButton(7) ? 1 : i.padButton(6) ? -1 : mz;
      const hb = i.down('Space') || i.padButton(0);
      const bump = v.drive({ throttle, steer: mx, handbrake: hb }, dt, this.colliders,
        { boost: p.id === 'stewie' ? 1.08 : 1 });
      if (bump) this.onVehicleBump(v, bump);
      p.x = v.pos.x; p.z = v.pos.z; p.yaw = v.yaw;
      sfx.engineState(v.speed, v.def.maxSpeed, throttle);
      if (hb && Math.abs(v.speed) > 8 && Math.random() < 0.25) sfx.skid();
      if (i.hit('KeyH') || i.padHit(3)) sfx.horn();
      // hide the driver inside the cabin
      p.rig.group.position.set(v.pos.x, v.pos.y + 0.42, v.pos.z);
      p.rig.group.rotation.set(0, v.yaw, 0);
      p.rig.group.visible = v.def.kind === 'trike' || v.def.kind === 'moped';
      poseRig(p.rig, 'sit', this.t, { dt });
      if (v.health <= 0) this.wreck(v);
    } else {
      p.rig.group.visible = true;
      const { mx, mz } = this.moveInput();
      const sprint = i.down('ShiftLeft') || i.down('ShiftRight') || i.padButton(7);
      const base = 3.4 * (spec.speed || 1) * (sprint ? 1.85 : 1);
      const { f, r } = this.camBasis();
      const move = f.multiplyScalar(mz).add(r.multiplyScalar(mx));
      const len = move.length();
      if (len > 0.02) {
        move.normalize();
        const want = Math.atan2(move.x, move.z);
        p.yaw += Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) * Math.min(1, 12 * dt);
        p.speed = base * Math.min(1, len);
        p.clip = sprint ? 'run' : 'walk';
      } else {
        p.speed *= Math.max(0, 1 - 9 * dt);
        p.clip = 'idle';
      }
      const nx = p.x + Math.sin(p.yaw) * p.speed * dt;
      const nz = p.z + Math.cos(p.yaw) * p.speed * dt;
      const res = this.colliders.resolve(nx, nz, 0.55);
      p.x = res.x; p.z = res.z;
      // jump
      if ((i.hit('Space') || i.padHit(0)) && p.y <= 0.01) { p.vy = 6.2; sfx.jump(); }
      if (p.y > 0 || p.vy > 0) {
        p.vy -= 20 * dt;
        p.y = Math.max(0, p.y + p.vy * dt);
        if (p.y === 0 && p.vy < 0) { p.vy = 0; sfx.land(); }
      }
      p.rig.group.position.set(p.x, p.y, p.z);
      p.rig.group.rotation.set(0, p.yaw, 0);
      const amp = p.clip === 'idle' ? 1 : Math.min(1.2, p.speed / 3.4);
      poseRig(p.rig, p.punchT > 0 ? 'hit' : p.clip, this.t * (p.clip === 'run' ? 1.15 : 1), { dt, amp });
    }
    if (p.punchT > 0) p.punchT -= dt;
    if (p.specialT > 0) p.specialT -= dt;

    // wanted level cools off once nobody can see you
    if (this.wanted > 0) {
      const chased = this.police.units.some((u) => Math.hypot(u.v.pos.x - p.x, u.v.pos.z - p.z) < 45);
      this.wantedCool -= dt * (chased ? 0.35 : 1);
      if (this.wantedCool <= 0) {
        this.wanted--;
        this.wantedCool = 16;
        this.hud.setStars(this.wanted);
        if (this.wanted === 0) { this.police.clear(); sfx.setMusic('town'); }
      }
    }
    const busted = this.wanted > 0
      ? this.police.update(dt, this.wanted, { x: p.x, z: p.z, speed: p.vehicle ? p.vehicle.speed : p.speed }, this.colliders)
      : false;
    if (busted) this.busted();
  }

  onVehicleBump(v, box) {
    if (Math.abs(v.speed) > 3) {
      sfx.crash();
      this.hud.damage();
      this.shake = 0.35;
      this.missions.notify('crash');
      if (box.smash) this.smashProp(box);
    }
  }

  smashProp(box) {
    box.dead = true;
    const entry = this.city.props.find((p) => p.box === box);
    if (entry) {
      entry.obj.visible = false;
      sfx.smash();
      this.addCoins(5);
      this.missions.notify('smash');
      this.spawnPop((box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2);
      setTimeout(() => { entry.obj.visible = true; box.dead = false; }, 30000);
    }
  }

  /** A little comic burst wherever something breaks. */
  spawnPop(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22), flat(i % 2 ? '#f2b705' : '#fdfaf2'));
      const a = (i / 7) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.4, 1 + Math.random() * 0.4, Math.sin(a) * 0.4);
      s.userData.v = new THREE.Vector3(Math.cos(a) * 3.4, 4 + Math.random() * 2, Math.sin(a) * 3.4);
      g.add(s);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.impacts.push({ obj: g, life: 0.9 });
  }

  wreck(v) {
    sfx.crash();
    this.exitVehicle(true);
    this.hud.toast('YOUR RIDE IS TOAST', 'bad');
    v.health = 40;
  }

  busted() {
    const station = this.city.spots.police;
    this.exitVehicle(true);
    this.wanted = 0;
    this.wantedCool = 0;
    this.police.clear();
    this.hud.setStars(0);
    this.addCoins(-150);
    this.player.x = station.x + 6;
    this.player.z = station.z + 16;
    this.player.health = 100;
    this.hud.toast('BUSTED — 150 CLAMS BAIL', 'bad');
    sfx.fail();
    this.missions.notify('busted');
    sfx.setMusic('town');
  }

  enterVehicle(v) {
    if (v.driver === 'cop') return;
    this.player.vehicle = v;
    v.driver = 'player';
    v.parked = false;
    sfx.startEngine();
    this.hud.speed(0, true);
    this.hud.toast(v.def.name.toUpperCase());
  }

  exitVehicle(force = false) {
    const v = this.player.vehicle;
    if (!v) return;
    if (!force && Math.abs(v.speed) > 6) return;
    v.driver = null;
    v.speed = 0;
    v.vel.set(0, 0, 0);
    this.player.vehicle = null;
    const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw)).multiplyScalar(v.def.wid * 0.8 + 0.6);
    const out = this.colliders.resolve(v.pos.x + side.x, v.pos.z + side.z, 0.6);
    this.player.x = out.x;
    this.player.z = out.z;
    this.player.rig.group.visible = true;
    sfx.stopEngine();
    this.hud.speed(0, false);
  }

  tickVehicles(dt) {
    const p = this.player;
    // traffic + parked cars vs the player's car: shove each other about
    const pv = p.vehicle;
    for (const v of this.vehicles) {
      if (v === pv) continue;
      if (!pv) continue;
      const dx = v.pos.x - pv.pos.x, dz = v.pos.z - pv.pos.z;
      const d = Math.hypot(dx, dz);
      const minD = (v.radius + pv.radius) * 0.9;
      if (d < minD && d > 0.001) {
        const push = (minD - d) / d;
        v.pos.x += dx * push * 0.7;
        v.pos.z += dz * push * 0.7;
        pv.pos.x -= dx * push * 0.3;
        pv.pos.z -= dz * push * 0.3;
        if (Math.abs(pv.speed) > 7) {
          sfx.crash();
          this.hud.damage();
          this.shake = 0.4;
          pv.speed *= 0.55;
          pv.health -= 4;
          v.speed = Math.abs(pv.speed) * 0.4;
          this.missions.notify('crash');
          this.bump(1);
        }
        v.sync(dt);
      }
    }
    if (this.rival) {
      const r = this.rival;
      const [tx, tz] = r.route[(r.leg + 1) % r.route.length];
      const v = r.v;
      const dx = tx - v.pos.x, dz = tz - v.pos.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(want - v.yaw), Math.cos(want - v.yaw));
      v.drive({ steer: clamp(diff * 1.5, -1, 1), throttle: 0.85, handbrake: false }, dt, this.colliders);
      if (d < 10) r.leg = (r.leg + 1) % r.route.length;
    }
  }

  tickActors(dt) {
    const p = this.player;
    const threats = [];
    if (p.vehicle) threats.push({ x: p.x, z: p.z, speed: Math.abs(p.vehicle.speed) });
    for (const u of this.police.units) threats.push({ x: u.v.pos.x, z: u.v.pos.z, speed: Math.abs(u.v.speed) });
    for (const c of this.traffic.active) threats.push({ x: c.v.pos.x, z: c.v.pos.z, speed: Math.abs(c.v.speed) });

    this.crowd.update(dt, { x: p.x, z: p.z, speed: p.vehicle ? Math.abs(p.vehicle.speed) : 0 }, threats);
    this.npcs.update(dt, this.hour, p.x, p.z);
    this.traffic.update(dt, p.x, p.z, [
      ...this.traffic.active.map((c) => ({ x: c.v.pos.x, z: c.v.pos.z })),
      { x: p.x, z: p.z },
    ]);

    // running people over: rude, effective, illegal
    if (p.vehicle && Math.abs(p.vehicle.speed) > 4) {
      const hit = this.crowd.nearest(p.x, p.z, 2.4);
      if (hit) {
        const dx = hit.x - p.x, dz = hit.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        if (this.crowd.knock(hit, dx / d, dz / d, Math.min(2, Math.abs(p.vehicle.speed) / 9))) {
          sfx.bonk();
          this.bump(1);
          this.hud.toast('WATCH IT!', 'bad');
        }
      }
    }
  }

  tickPickups(dt) {
    const p = this.player;
    // spinning coins
    for (const c of this.coins) {
      if (c.taken) {
        c.respawn -= dt;
        if (c.respawn <= 0) { c.taken = false; c.mesh.visible = true; }
        continue;
      }
      c.mesh.rotation.z += dt * 2.6;
      c.mesh.position.y = 0.9 + Math.sin(this.t * 2 + c.x) * 0.12;
      if (Math.hypot(c.x - p.x, c.z - p.z) < 2.2) {
        c.taken = true;
        c.mesh.visible = false;
        c.respawn = 45;
        this.addCoins(10);
        sfx.coin();
      }
    }
    // mission pickups
    for (const k of this.pickups) {
      if (k.taken) continue;
      k.mesh.rotation.y += dt * 1.8;
      k.mesh.position.y = 0.8 + Math.sin(this.t * 2.4 + k.x) * 0.12;
      if (Math.hypot(k.x - p.x, k.z - p.z) < 2.6) {
        k.taken = true;
        this.scene.remove(k.mesh);
        this.scene.remove(k.halo);
        this.missions.notify('pickup');
      }
    }
    // checkpoints, in order
    const next = this.checkpoints.find((c) => !c.taken);
    if (next) {
      next.obj.visible = true;
      next.obj.rotation.y += dt * 0.9;
      if (Math.hypot(next.x - p.x, next.z - p.z) < 7) {
        next.taken = true;
        this.scene.remove(next.obj);
        this.missions.notify('checkpoint');
        const after = this.checkpoints.find((c) => !c.taken);
        if (after) after.obj.visible = true;
      }
    }
    // objective marker
    if (this.marker) {
      this.marker.obj.rotation.y += dt * 0.7;
      if (Math.hypot(this.marker.x - p.x, this.marker.z - p.z) < this.marker.r) {
        this.missions.notify('reachedMarker');
      }
    }
    // level collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.tape.rotation.y += dt * 1.5;
      c.tape.position.y = 1.1 + Math.sin(this.t * 2 + c.x) * 0.12;
      if (Math.hypot(c.x - p.x, c.z - p.z) < 2.6) {
        this.scene.remove(c.obj);
        this.collectibles.splice(i, 1);
        const found = (this.save.found[c.level] = this.save.found[c.level] || []);
        found.push(c.index);
        const lvl = levelById(c.level);
        sfx.coin();
        this.addCoins(75);
        this.hud.toast(`${lvl.collectible.name.toUpperCase()} ${found.length}/${lvl.collectible.n}`, 'good');
        if (found.length >= lvl.collectible.n) {
          this.addCoins(500);
          this.hud.toast('FULL SET! +500 CLAMS', 'good');
        }
        this.opts.onSave?.();
      }
    }

    // impact bursts
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const im = this.impacts[i];
      im.life -= dt;
      for (const c of im.obj.children) {
        c.userData.v.y -= 16 * dt;
        c.position.addScaledVector(c.userData.v, dt);
        c.rotation.x += dt * 6;
      }
      if (im.life <= 0) { this.scene.remove(im.obj); this.impacts.splice(i, 1); }
    }
    // spin the markers
    for (const m of this.missionMarkers) {
      m.spin.rotation.y += dt * 1.6;
      m.spin.position.y = 2.4 + Math.sin(this.t * 2) * 0.16;
    }
    for (const g of this.gagMarkers) {
      g.body.rotation.y += dt * 1.1;
      g.body.position.y = 1.5 + Math.sin(this.t * 2.2 + g.x) * 0.12;
    }
  }

  tickCombat(dt) {
    const p = this.player;
    const spec = charSpec(p.id);
    const punch = this.input.hit('KeyF') || this.input.padHit(2);
    const special = this.input.hit('KeyR') || this.input.padHit(1);

    if (!p.vehicle && (punch || special) && p.punchT <= 0) {
      p.punchT = 0.35;
      sfx.punch();
      const reach = special ? 6.5 : 2.6;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const hitPoint = { x: p.x + fx * 1.2, z: p.z + fz * 1.2 };
      let landed = false;
      // brawlers first
      for (const b of this.brawlers) {
        if (b.down > 0) continue;
        if (Math.hypot(b.x - hitPoint.x, b.z - hitPoint.z) < reach) {
          b.down = 4;
          b.vx = (b.x - p.x) * 1.6;
          b.vz = (b.z - p.z) * 1.6;
          landed = true;
          this.missions.notify('brawlDown');
          if (!special) break;
        }
      }
      // the boss
      if (this.boss && Math.hypot(this.boss.x - hitPoint.x, this.boss.z - hitPoint.z) < reach + 1.6) {
        this.boss.hp -= special ? 2 : 1;
        this.boss.stun = 0.6;
        landed = true;
        sfx.bonk();
        this.hud.toast(`ERNIE: ${Math.max(0, this.boss.hp)} LEFT`);
        if (this.boss.hp <= 0) {
          this.clearBoss();
          this.missions.notify('bossDown');
        }
      }
      // civilians
      const ped = this.crowd.nearest(hitPoint.x, hitPoint.z, reach);
      if (ped) {
        const dx = ped.x - p.x, dz = ped.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        this.crowd.knock(ped, dx / d, dz / d, special ? 1.6 : 1);
        landed = true;
        this.bump(1);
        this.missions.notify('zap');
      }
      if (special) {
        if (spec.special?.includes('Ray')) sfx.ray();
        this.spawnPop(hitPoint.x, hitPoint.z);
      }
      if (!landed && special) this.spawnPop(hitPoint.x, hitPoint.z);
    }

    // brawler AI
    for (const b of this.brawlers) {
      if (b.down > 0) {
        b.down -= dt;
        b.x += (b.vx || 0) * dt;
        b.z += (b.vz || 0) * dt;
        b.vx = (b.vx || 0) * 0.9;
        b.vz = (b.vz || 0) * 0.9;
        b.rig.group.position.set(b.x, 0, b.z);
        poseRig(b.rig, 'fall', this.t, { dt });
        continue;
      }
      const dx = p.x - b.x, dz = p.z - b.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 1.8) {
        b.x += (dx / d) * 2.6 * dt;
        b.z += (dz / d) * 2.6 * dt;
      } else {
        b.swing -= dt;
        if (b.swing <= 0) {
          b.swing = 1.6;
          this.hurt(6);
        }
      }
      b.rig.group.position.set(b.x, 0, b.z);
      b.rig.group.rotation.y = Math.atan2(dx, dz);
      poseRig(b.rig, d > 1.8 ? 'run' : 'hit', this.t + b.x, { dt });
    }

    // the chicken
    if (this.boss) {
      const b = this.boss;
      const dx = p.x - b.x, dz = p.z - b.z;
      const d = Math.hypot(dx, dz) || 1;
      b.stun = Math.max(0, b.stun - dt);
      if (b.stun <= 0) {
        const sp = 4.2;
        if (d > 2.6) { b.x += (dx / d) * sp * dt; b.z += (dz / d) * sp * dt; }
        else {
          b.swing -= dt;
          if (b.swing <= 0) { b.swing = 1.5; this.hurt(12); sfx.punch(); this.shake = 0.5; }
        }
      }
      b.yaw = Math.atan2(dx, dz);
      b.rig.group.position.set(b.x, b.stun > 0 ? 0.1 : 0, b.z);
      b.rig.group.rotation.y = b.yaw;
      poseRig(b.rig, b.stun > 0 ? 'hit' : d > 2.6 ? 'run' : 'cheer', this.t, { dt });
    }
  }

  hurt(n) {
    this.player.health -= n;
    this.hud.damage();
    this.hud.setHealth(this.player.health / 100);
    if (this.player.health <= 0) {
      this.player.health = 100;
      this.hud.setHealth(1);
      const hosp = this.city.spots.hospital;
      this.exitVehicle(true);
      this.player.x = hosp.x + 8;
      this.player.z = hosp.z + 18;
      this.addCoins(-100);
      this.hud.toast('DR. HARTMAN PATCHED YOU UP — 100 CLAMS', 'bad');
      this.missions.notify('busted');
    }
  }

  tickInteractions(dt) {
    const p = this.player;
    const i = this.input;
    const act = i.hit('KeyE') || i.padHit(1);
    let prompt = '';

    if (p.vehicle) {
      prompt = '<b>E</b> get out   ·   <b>SPACE</b> handbrake   ·   <b>H</b> horn';
      if (act) { this.exitVehicle(); return; }
    } else {
      // nearest car
      let best = null, bd = 3.6;
      for (const v of this.vehicles) {
        const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
        if (d < bd) { bd = d; best = v; }
      }
      for (const c of this.traffic.active) {
        const d = Math.hypot(c.v.pos.x - p.x, c.v.pos.z - p.z);
        if (d < bd) { bd = d; best = c.v; c.active = false; }
      }
      if (best) {
        prompt = `<b>E</b> drive the ${best.def.name}`;
        if (act) { this.enterVehicle(best); return; }
      }
    }

    // gag markers
    for (const g of this.gagMarkers) {
      if (Math.hypot(g.x - p.x, g.z - p.z) < 3.4) {
        const seen = this.save.gags.includes(g.gag.id);
        prompt = `<b>G</b> cutaway gag${seen ? ' (seen)' : ` — +${g.gag.reward}`}`;
        if (i.hit('KeyG')) { this.playGag(g); return; }
      }
    }

    // mission markers
    for (const m of this.missionMarkers) {
      if (Math.hypot(m.x - p.x, m.z - p.z) < 4.2) {
        if (this.missions.active) {
          prompt = 'Finish what you started first.';
        } else {
          prompt = `<b>G</b> start "${m.mission.title}"   ·   ${m.mission.desc}`;
          if (i.hit('KeyG')) { this.startMission(m.mission); return; }
        }
      }
    }

    // a word with the neighbours
    const npc = this.npcs.nearest(p.x, p.z, 3.4);
    if (npc && !prompt) {
      prompt = `<b>G</b> talk to ${npc.spec.short}`;
      if (i.hit('KeyG')) this.chat(npc);
    }

    // sleep it off at home
    const home = this.city.spots.griffin;
    if (!p.vehicle && Math.hypot(home.x - p.x, home.z - p.z) < 8) {
      prompt = `<b>G</b> sleep until morning${prompt ? '' : ''}`;
      if (i.hit('KeyG')) {
        this.hour = 8;
        this.day++;
        this.player.health = 100;
        this.hud.setHealth(1);
        this.hud.toast('SLEPT LIKE A GRIFFIN');
      }
    }

    if (this.missions.active && i.hit('KeyX')) this.missions.abandon();
    this.hud.prompt(prompt);
  }

  chat(npc) {
    const lines = CHAT[npc.id] || ['...'];
    const line = lines[(Math.random() * lines.length) | 0];
    talk(npc.rig, 2.2);
    sfx.blip(npc.spec.voice || 150, 1.2);
    this.hud.subtitle(npc.spec.short, line, 3.4);
  }

  tickCamera(dt) {
    const p = this.player;
    const target = new THREE.Vector3(p.x, p.y + 1.2, p.z);
    let dist = 7.0, height = 3.1, lead = 0;
    const manual = this.camManual > 0;
    if (p.vehicle) {
      const v = p.vehicle;
      dist = 9.4 + Math.min(4, Math.abs(v.speed) * 0.16);
      height = 3.2;
      lead = clamp(v.speed * 0.14, -2, 4);
      // the camera settles behind the car unless you are steering it yourself
      if (!manual && Math.abs(v.speed) > 1.2) {
        const wantYaw = v.yaw + Math.PI;
        const rate = Math.min(1, (Math.abs(v.speed) > 6 ? 2.6 : 1.2) * dt);
        this.camYaw += Math.atan2(Math.sin(wantYaw - this.camYaw), Math.cos(wantYaw - this.camYaw)) * rate;
      }
      target.y = v.pos.y + 1.3;
    } else if (p.speed > 0.4 && !manual) {
      const wantYaw = p.yaw + Math.PI;
      this.camYaw += Math.atan2(Math.sin(wantYaw - this.camYaw), Math.cos(wantYaw - this.camYaw)) * Math.min(1, 0.9 * dt);
    }
    // behind the player: +yaw vector points back from the camera to the subject
    const back = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const pitch = this.camPitch;
    const want = target.clone()
      .add(back.clone().multiplyScalar((dist - lead) * Math.cos(pitch)))
      .add(new THREE.Vector3(0, height + dist * Math.sin(pitch) * 0.9, 0));
    // keep the camera out of the scenery
    const res = this.colliders.resolve(want.x, want.z, 0.8);
    want.x = res.x; want.z = res.z;
    this.camPos.lerp(want, Math.min(1, 6 * dt));
    this.camPos.y = Math.max(1.1, this.camPos.y);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.7;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.5;
    }
    const lookAt = target.clone().add(back.clone().multiplyScalar(-lead * 1.2));
    lookAt.y += p.vehicle ? 0.5 : 0.25;
    this.camera.lookAt(lookAt);
  }

  tickHud(dt) {
    const p = this.player;
    this.hud.tick(dt);
    this.hud.setClock(this.hour, this.day);
    this.hud.setWhere(districtAt(p.x, p.z));
    this.hud.setCoins(this.save.coins);
    if (p.vehicle) this.hud.speed(p.vehicle.mph, true);
    const blips = [];
    for (const m of this.missionMarkers) blips.push({ x: m.x, z: m.z, color: '#f2b705', shape: 'diamond', edge: true });
    for (const g of this.gagMarkers) {
      if (!this.save.gags.includes(g.gag.id)) blips.push({ x: g.x, z: g.z, color: '#7a3f8a', shape: 'square' });
    }
    for (const c of this.collectibles) blips.push({ x: c.x, z: c.z, color: '#7ad0f2', shape: 'square' });
    if (this.marker) blips.push({ x: this.marker.x, z: this.marker.z, color: '#c0392b', edge: true });
    for (const c of this.checkpoints) if (!c.taken) blips.push({ x: c.x, z: c.z, color: '#3f95cf', edge: true });
    for (const u of this.police.units) blips.push({ x: u.v.pos.x, z: u.v.pos.z, color: '#3060ff' });
    for (const k of this.pickups) if (!k.taken) blips.push({ x: k.x, z: k.z, color: '#f2b705' });
    this.blips = blips;
    this.hud.drawMinimap(this.city.groundCanvas, p.x, p.z, p.yaw, blips);
  }

  openMap() {
    this.hud.drawBigMap(this.city.groundCanvas, this.player.x, this.player.z, this.city.landmarks, this.blips || []);
  }

  trackPerf(dtRaw) {
    this.frames++;
    this.fpsClock += dtRaw;
    if (this.fpsClock < 3) return;
    const fps = this.frames / this.fpsClock;
    this.frames = 0;
    this.fpsClock = 0;
    this.fps = fps;
    if (fps < 34 && this.quality === 1) {
      this.quality = 0.7;
      this.ink.scale = 0.6;
      this.ink.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
    } else if (fps < 24 && this.quality === 0.7) {
      this.quality = 0.4;
      this.ink.enabled = false;
      this.scene.fog.far = 320;
    }
  }

  render() {
    this.ink.render(this.scene, this.camera, [this.sky.dome]);
  }

  dispose() {
    window.removeEventListener('resize', this._resize);
    try { document.exitPointerLock?.(); } catch { /* fine */ }
    this.input.dispose();
    sfx.stopEngine();
    sfx.stopMusic();
    this.renderer.dispose();
    this.holder.innerHTML = '';
  }
}

// Idle chatter, because a town where nobody talks is a town nobody visits.
const CHAT = {
  peter: ["Hey. You ever notice how the road just… keeps going?", "Lois! LOIS! …Sorry, force of habit.", "I'm not fat, I'm surrounded by thin air."],
  lois: ["Peter's at the Clam, isn't he. Of course he is.", "Don't track that through the kitchen.", "If you see Meg, tell her dinner's at six."],
  stewie: ["Ah, the ambulatory one. How's the walking coming along?", "I'm building something. It's not a bomb. It's a bomb.", "Victory shall be mine. Eventually. After my nap."],
  brian: ["I'm working on a novel. It's going great. It's going fine.", "This town is a cultural desert with a beer tap.", "Do NOT throw the ball. I mean it. …Throw the ball."],
  chris: ["Everything I know about girls I learned from a pamphlet.", "There's a monkey in my closet. Nobody believes me.", "Dad says if I get a job I have to keep it."],
  meg: ["Hi. Sorry. Never mind.", "Nobody's noticed I've been standing here for an hour.", "If you tell anyone I said that, I'll deny it."],
  quagmire: ["Giggity.", "Flying to Rio tonight. Back Tuesday. Alllright.", "Hey there. …Hey. Hey there."],
  cleveland: ["Well now, that's just delightful.", "I'm gonna take a bath and nothing bad will happen.", "Peter, if you break my fence again, I will speak to you sternly."],
  joe: ["Keep it under twenty-five through here, hero.", "I once chased a guy nine blocks. In this chair. Won, too.", "Bonnie's been pregnant for eleven years. Don't ask."],
  bonnie: ["Joe's at work. He's always at work.", "You look tense. Have you tried a makeover?"],
  mort: ["Oh boy. Oh boy oh boy. That's a rash all right.", "Do you know what the markup on aspirin is? I do."],
  herbert: ["Ssssay, is your paper route hiring?", "Come sit on the porch. I've got popsicles."],
  west: ["The water supply is under attack. From the sky.", "I have been mayor for a very long time and I have learned nothing."],
  tucker: ["Tom Tucker, Channel 5. This is my hair.", "Diane. DIANE. …She's not here. She never is."],
  consuela: ["No. No, I need lemon Pledge.", "No no no. Tuesday."],
  carter: ["I could buy this street. I probably have.", "Money is like oxygen. I have all of it."],
  barbara: ["Lois married a man who once ate a bicycle.", "Do come to the club. Bring nothing."],
  seamus: ["Arr, the sea took me hands. And me feet. And me cousin.", "There be a storm coming. There always be."],
  hartman: ["Good news and bad news, and I've mixed up which is which.", "Take two of these and call literally anybody else."],
  jerome: ["Hey now. Jerome's my name. Yeah, that Jerome.", "Peter still owes me for the jukebox."],
  bruce: ["Ohh nooo.", "That's the third inflatable man this week. Ohh nooo."],
  neil: ["Statistically, Meg and I are inevitable.", "I have a coupon for the arcade. It expired in 2003."],
  shepherd: ["Walk, don't run. Actually, run. Something's on fire.", "The vending machine ate my dollar. Again."],
  angela: ["Peter Griffin is my problem and I resent it.", "Shipping is behind because Peter is Peter."],
  death: ["Not for you. Not today. Probably.", "You'd be amazed how much of this job is paperwork."],
};
