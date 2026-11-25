// HIDE — boot, game loop and the systems that tie everything together:
// the night clock, fear and comfort, the lantern, pickups, lightning, doors.
import * as THREE from 'three';
import { CFG, MOBILE, TOUCH, DEBUG } from './config.js';
import { buildTextures, setAniso, grainDataURL } from './textures.js';
import { buildLevel } from './level.js';
import { Nav } from './nav.js';
import { Monster } from './monster.js';
import { Player } from './player.js';
import { Audio } from './audio.js';
import { Post } from './post.js';
import { Input } from './input.js';
import { makeProps, COMFORT } from './items.js';
import { clamp, lerp, damp, smoothstep, rng, nextFrame } from './util.js';

const $ = (id) => document.getElementById(id);
const R = rng(2024);

class Game {
  constructor() {
    this.state = 'loading';
    this.time = 0;
    this.clockT = 0;
    this.hour = 0;
    this.fear = 0;
    this.comfort = 0;
    this.tension = 0;
    this.touchMode = MOBILE || (TOUCH && !matchMedia('(pointer: fine)').matches);
  }

  // ======================================================================
  async boot() {
    const el = $('game');
    el.classList.toggle('mobile', this.touchMode);
    el.classList.toggle('desktop', !this.touchMode);
    const progress = (p) => ($('load').firstElementChild.style.width = Math.round(p * 100) + '%');
    progress(0.02);
    await nextFrame();

    const canvas = $('view');
    const full = CFG.post === 'full';
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !full, powerPreference: 'high-performance', stencil: false });
    } catch (e) {
      $('start').textContent = 'WebGL is not available on this device';
      return;
    }
    this.renderer = renderer;
    this.basePR = Math.min(window.devicePixelRatio || 1, CFG.pixelRatioMax);
    this.pr = this.basePR;
    renderer.setPixelRatio(this.pr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = full ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    // three's ACES divides exposure by 0.6; the desktop composite pass multiplies by it — match them
    renderer.toneMappingExposure = 0.42;
    renderer.shadowMap.enabled = CFG.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    const T = (this.T = await buildTextures(CFG, (name, p) => progress(0.05 + p * 0.55)));
    T.env = this.makeEnv();
    progress(0.62);
    await nextFrame();

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x020303);
    scene.fog = new THREE.FogExp2(0x030405, CFG.fog);
    const camera = (this.camera = new THREE.PerspectiveCamera(72, 1, 0.04, CFG.farPlane));
    scene.add(camera);

    const lvl = (this.lvl = buildLevel(scene, T, CFG));
    progress(0.78);
    await nextFrame();
    this.nav = new Nav(lvl);
    this.nav.doorBlock = (ax, az, bx, bz) => this.doorBlocks(ax, az, bx, bz);
    this.audio = new Audio(CFG);
    this.props = makeProps(T, CFG);
    this.player = new Player({ scene, camera, cfg: CFG, lvl, T, audio: this.audio, game: this });
    this.monster = new Monster({ scene, T, cfg: CFG, nav: this.nav, lvl, audio: this.audio, game: this });
    this.setupLights();
    this.setupHole();
    this.setupItems();
    this.setupAtmosphere();
    this.post = new Post(renderer, CFG);
    this.input = new Input(canvas, { touch: this.touchMode });
    this.input.onPauseRequest = () => this.pause();
    progress(0.9);
    await nextFrame();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(); });
    if (!full) {
      $('fx-grain').style.backgroundImage = `url(${grainDataURL(128)})`;
    }
    this.hookUI();
    this.resetRun();
    this.titleCam();
    // warm up shaders so the first seconds don't hitch
    try { renderer.compile(scene, camera); } catch (e) { /* ignore */ }
    this.post.render(scene, camera);
    progress(1);
    $('load').hidden = true;
    $('start').disabled = false;
    $('start').textContent = this.touchMode ? 'tap to hide' : 'click to hide';
    this.state = 'title';
    this.fadeTo(0, 1.5);
    this.last = performance.now();
    this.frameTimes = [];
    this.prT = 0;
    requestAnimationFrame((t) => this.loop(t));
    if (DEBUG) window.__hide = this;
  }

  makeEnv() {
    const pm = new THREE.PMREMGenerator(this.renderer);
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x040506);
    const room = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 30), new THREE.MeshBasicMaterial({ color: 0x0c0e0f, side: THREE.BackSide }));
    s.add(room);
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdfeaff).multiplyScalar(2.5) });
    for (let x = -9; x <= 9; x += 6) for (let z = -9; z <= 9; z += 6) {
      if ((x + z) % 12 === 0) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 1.2), strip);
      m.position.set(x, 2.9, z);
      s.add(m);
    }
    const warm = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a2a1a) }));
    warm.position.set(0, 1.5, -14.8);
    s.add(warm);
    const env = pm.fromScene(s, 0.04).texture;
    pm.dispose();
    return env;
  }

  // ---------------------------------------------------------------- lights
  setupLights() {
    const { scene, lvl } = this;
    this.hemi = new THREE.HemisphereLight(0x7d93a8, 0x3a3128, MOBILE ? 1.0 : 0.8);
    scene.add(this.hemi);
    this.lights = [];
    for (const p of lvl.pointLights) {
      // ceiling fixtures and hanging lamps only throw light downward
      const down = p.kind === 'fixture' || p.kind === 'lamp';
      const L = down ? new THREE.SpotLight(p.color, p.intensity, p.distance, 1.2, 0.9, 2) : new THREE.PointLight(p.color, p.intensity, p.distance, 2);
      L.position.set(p.x, p.y, p.z);
      if (down) {
        L.target.position.set(p.x, 0, p.z);
        scene.add(L.target);
      }
      scene.add(L);
      this.lights.push({ L, base: p.intensity, flicker: p.flicker, kind: p.kind, x: p.x, z: p.z, y: p.y, on: 1, ft: 0, state: 1 });
    }
    this.flickerLights = this.lights.filter((l) => l.flicker);
    this.litFix = this.lights.filter((l) => l.kind === 'fixture' || l.kind === 'lamp');
    // lightning through the front windows
    const lt = (this.lightning = new THREE.SpotLight(0xd3e2ff, 0, lvl.SD + 14, 1.05, 0.7, 1.2));
    lt.position.set(lvl.W / 2, 7.5, -9);
    lt.target.position.set(lvl.W / 2, 0, lvl.SD * 0.45);
    if (CFG.shadows) {
      lt.castShadow = true;
      lt.shadow.mapSize.set(1024, 1024);
      lt.shadow.camera.near = 4;
      lt.shadow.camera.far = lvl.SD + 16;
      lt.shadow.bias = -0.0006;
      lt.shadow.autoUpdate = false;
    }
    scene.add(lt, lt.target);
    this.nextLightning = 18 + R() * 20;
    this.flash = null;
    // fridge hum location
    const fr = lvl.pointLights.find((p) => p.kind === 'freezer' || p.kind === 'cooler');
    this.fridgePos = fr ? { x: fr.x, z: fr.z } : { x: lvl.W - 2, z: 14 };
  }

  setupHole() {
    const { scene, lvl, props } = this;
    const lan = props.lantern();
    lan.group.position.copy(lvl.hole.lantern);
    scene.add(lan.group);
    this.lanternMesh = lan;
    const L = (this.lanternLight = new THREE.PointLight(0xffa456, 1.1, MOBILE ? 3.2 : 5, 2));
    L.position.copy(lvl.hole.lantern).add(new THREE.Vector3(0, 0.2, 0));
    if (CFG.shadows) {
      L.castShadow = true;
      L.shadow.mapSize.set(512, 512);
      L.shadow.camera.near = 0.05;
      L.shadow.camera.far = 6;
      L.shadow.bias = -0.002;
      L.shadow.radius = 3;
      L.shadow.autoUpdate = false;
      L.shadow.needsUpdate = true;
    }
    scene.add(L);
    // comfort item slots (hidden until brought back)
    this.slots = {};
    const S = lvl.hole.slots;
    const mk = { pillow: () => props.pillow(), teddy: () => props.teddy(), lights: () => props.stringLights(true), thermos: () => props.thermos(), comic: () => props.comic() };
    for (const k of Object.keys(mk)) {
      const m = mk[k]();
      m.position.copy(S[k]);
      if (k === 'teddy') m.rotation.y = Math.PI * 0.8;
      if (k === 'pillow') m.rotation.y = 0.15;
      m.visible = false;
      scene.add(m);
      this.slots[k] = m;
    }
  }

  setupItems() {
    const { scene, lvl, props } = this;
    this.batteries = [];
    for (let i = 0; i < CFG.batterySpawns + 1; i++) {
      const m = props.battery();
      m.visible = false;
      scene.add(m);
      this.batteries.push({ mesh: m, spot: null, active: false });
    }
    const keys = MOBILE ? ['pillow', 'teddy', 'lights'] : ['pillow', 'teddy', 'lights', 'thermos', 'comic'];
    const mk = { pillow: () => props.pillow(), teddy: () => props.teddy(), lights: () => props.stringLights(false), thermos: () => props.thermos(), comic: () => props.comic() };
    this.comfortItems = keys.map((k) => {
      const m = mk[k]();
      const s = lvl.comfortSpots[k];
      scene.add(m);
      return { key: k, mesh: m, spot: s, state: 'world' };
    });
  }

  setupAtmosphere() {
    const { scene, lvl, T } = this;
    // rain running down the front glass
    if (lvl.rainGlass) {
      const g = lvl.rainGlass;
      const mats = [];
      for (let i = 0; i < 2; i++) {
        const tex = T.rain.clone();
        tex.needsUpdate = true;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set((g.x1 - g.x0) / (2.5 + i), (g.y1 - g.y0) / (2.5 + i));
        const m = new THREE.MeshBasicMaterial({ color: 0x8fa0b0, alphaMap: tex, transparent: true, opacity: 0.22 - i * 0.07, depthWrite: false, fog: true });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(g.x1 - g.x0, g.y1 - g.y0), m);
        mesh.position.set((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, g.z + i * 0.01);
        scene.add(mesh);
        mats.push(tex);
      }
      this.rainTex = mats;
      this.outsideMat = scene.children.find((c) => c.isMesh && c.material && c.material.map === T.outside)?.material;
    }
    // dust motes that catch the flashlight beam
    if (CFG.dust) {
      const n = CFG.dust;
      const pos = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = R() * 14 - 7;
        pos[i * 3 + 1] = R() * 4;
        pos[i * 3 + 2] = R() * 14 - 7;
        seed[i] = R();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
      this.dustMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { cam: { value: new THREE.Vector3() }, fpos: { value: new THREE.Vector3() }, fdir: { value: new THREE.Vector3(0, 0, -1) }, fpow: { value: 1 }, time: { value: 0 }, pr: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float seed; uniform vec3 cam; uniform vec3 fpos; uniform vec3 fdir; uniform float fpow; uniform float time; uniform float pr;
          varying float vA;
          void main() {
            vec3 p = position;
            p += vec3(sin(time * 0.13 + seed * 40.0), sin(time * 0.07 + seed * 13.0) * 0.6 - time * 0.02, cos(time * 0.11 + seed * 23.0)) * 0.35;
            vec3 rel = mod(p - cam + vec3(7.0, 0.0, 7.0), vec3(14.0, 4.0, 14.0)) - vec3(7.0, 0.0, 7.0);
            vec3 w = vec3(cam.x + rel.x, rel.y + 0.1, cam.z + rel.z);
            vec3 L = w - fpos; float d = length(L);
            float cone = smoothstep(0.86, 0.97, dot(L / d, fdir));
            vA = cone * fpow / (1.0 + d * d * 0.25) * (0.35 + seed * 0.4) * smoothstep(0.4, 1.2, d);
            vec4 mv = modelViewMatrix * vec4(w, 1.0);
            gl_PointSize = min(pr * (1.0 + seed * 1.4) * (3.0 / -mv.z), 6.0 * pr);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() { vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * vA * a * 0.9, 1.0); }`,
      });
      const pts = new THREE.Points(geo, this.dustMat);
      pts.frustumCulled = false;
      scene.add(pts);
    }
  }

  // ---------------------------------------------------------------- UI
  hookUI() {
    const start = () => {
      if (this.state !== 'title') return;
      this.audio.init();
      this.audio.resume();
      $('title').hidden = true;
      this.beginRun();
    };
    $('start').addEventListener('click', start);
    $('resume').addEventListener('click', () => this.resume());
    $('retry').addEventListener('click', () => this.restart());
    $('again').addEventListener('click', () => this.restart());
    $('mute').addEventListener('click', () => this.toggleMute());
    $('view').addEventListener('click', () => {
      if (this.state === 'play' && !this.touchMode && !this.input.locked && !this.input.dragLook) this.input.requestLock();
    });
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    $('mute').textContent = 'sound: ' + (this.audio.muted ? 'off' : 'on');
  }

  fadeTo(v, secs = 0.6) {
    const f = $('fx-fade');
    f.style.transition = `opacity ${secs}s linear`;
    f.style.opacity = v;
    this.fadeTarget = v;
  }

  message(text, secs = 4) {
    const m = $('msg');
    m.textContent = text;
    m.classList.add('show');
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => m.classList.remove('show'), secs * 1000);
  }

  showClock(secs = 4) {
    $('clock').classList.add('show');
    clearTimeout(this._clkT);
    if (secs > 0) this._clkT = setTimeout(() => { if (!this.player.hidden) $('clock').classList.remove('show'); }, secs * 1000);
  }

  // ---------------------------------------------------------------- run flow
  resetRun() {
    this.time = 0;
    this.clockT = 0;
    this.hour = 0;
    this.fear = 0.1;
    this.lantern = 1;
    this.dawn = 0;
    this.hurt = 0;
    this.player.reset();
    this.monster.reset();
    const hole = this.lvl.hides.find((h) => h.kind === 'hole');
    this.hole = hole;
    this.player.hidden = hole;
    this.player.pos.set(hole.enter.x, 0, hole.enter.z);
    this.player.yaw = hole.yaw;
    this.player.pitch = -0.08;
    this.player.eye.copy(hole.cam);
    this.stats = { batteries: 0, items: 0, closeCalls: 0, chases: 0 };
    this.hints = {};
    this.placed = new Set();
    for (const k in this.slots) this.slots[k].visible = false;
    for (const c of this.comfortItems) {
      c.state = 'world';
      c.mesh.visible = true;
      c.mesh.position.set(c.spot.x, c.spot.y, c.spot.z);
      c.mesh.rotation.set(0, R() * Math.PI * 2, 0);
    }
    for (const b of this.batteries) { b.active = false; b.mesh.visible = false; b.spot = null; }
    for (let i = 0; i < CFG.batterySpawns; i++) this.spawnBattery();
    for (const l of this.lights) { l.L.intensity = l.base; l.state = 1; }
    for (const d of this.lvl.doors) { d.angle = [0, 0]; d.vel = [0, 0]; d.swing = 0; }
    this.lanternLight.intensity = 1.1;
    if (this.lanternLight.shadow) this.lanternLight.shadow.needsUpdate = true;
    this.updateCarryUI();
    this.lastHiddenSpot = null;
    this.monsterWasChecking = false;
  }

  titleCam() {
    const h = this.lvl.hides.find((x) => x.kind === 'hole');
    this.camera.position.copy(h.cam);
    this.camera.rotation.set(-0.06, h.yaw, 0, 'YXZ');
  }

  beginRun() {
    this.state = 'play';
    $('hud').hidden = false;
    $('touch').hidden = !this.touchMode;
    this.input.enabled = true;
    this.input.clearEdges();
    if (!this.touchMode) this.input.requestLock();
    this.showClock(6);
    $('status').classList.add('show');
    setTimeout(() => this.message('this is your spot.', 3.5), 900);
    setTimeout(() => { if (this.state === 'play') this.message('stay quiet. make it to 6 AM.', 4.5); }, 5600);
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    $('pause').hidden = false;
    $('touch').hidden = true;
    this.audio.ctx?.suspend();
  }
  resume() {
    if (this.state !== 'paused') return;
    $('pause').hidden = true;
    $('touch').hidden = !this.touchMode;
    this.state = 'play';
    this.audio.resume();
    this.input.clearEdges();
    if (!this.touchMode) this.input.requestLock();
    this.last = performance.now();
  }
  restart() {
    $('dead').hidden = true;
    $('won').hidden = true;
    this.resetRun();
    this.player.lockLook = null;
    this.player.shake = 0;
    this.fadeTo(0, 1.2);
    this.state = 'play';
    this.input.enabled = true;
    this.input.clearEdges();
    $('hud').hidden = false;
    $('touch').hidden = !this.touchMode;
    $('status').classList.add('show');
    this.showClock(5);
    this.audio.resume();
    if (!this.touchMode) this.input.requestLock();
    this.last = performance.now();
  }

  // ---------------------------------------------------------------- events
  noise(x, z, radius, kind) {
    this.monster.hear(x, z, radius, kind);
  }
  surfaceAt(x, z) {
    return this.lvl.surfaceAt(x, z);
  }
  lightAt(x, z) {
    let v = 0;
    for (const l of this.litFix) {
      const d = Math.hypot(l.x - x, l.z - z);
      v += clamp(1 - d / 6.5, 0, 1) * (l.L.intensity / l.base);
    }
    return clamp(v, 0, 1);
  }
  onSpotted() {
    this.audio.stinger();
    this.stats.chases++;
    this.fear = Math.max(this.fear, 0.85);
  }
  onHidden(spot) {
    this.lastHiddenSpot = spot;
    if (spot.kind === 'hole') {
      // unpack: batteries into the lantern, comfort items into their places
      if (this.player.carry.batteries > 0 && this.lantern < 0.9) this.swapBattery();
      let placedAny = null;
      for (const c of this.comfortItems) {
        if (c.state === 'carried') {
          c.state = 'placed';
          this.placed.add(c.key);
          this.slots[c.key].visible = true;
          this.stats.items++;
          placedAny = c;
        }
      }
      if (placedAny) {
        this.message(COMFORT[placedAny.key].msg, 3.5);
        this.audio.rustle(0.6);
        if (this.lanternLight.shadow) this.lanternLight.shadow.needsUpdate = true;
      }
      this.updateCarryUI();
    }
    $('clock').classList.add('show');
  }
  onUnhidden() {
    this.showClock(2);
  }
  swapBattery() {
    this.player.carry.batteries--;
    this.lantern = 1;
    this.audio.click();
    setTimeout(() => this.audio.click(), 180);
    this.message('fresh batteries. the light steadies.', 3);
    this.updateCarryUI();
  }
  onGrabbed(monster) {
    if (this.state !== 'play') return;
    this.state = 'dying';
    this.dyingT = 0;
    const pl = this.player;
    if (!pl.hidden) {
      // spin the monster in, right in front of your face
      const dx = monster.pos.x - pl.pos.x, dz = monster.pos.z - pl.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      monster.pos.set(pl.pos.x + (dx / d) * 0.78, 0, pl.pos.z + (dz / d) * 0.78);
      monster.yaw = Math.atan2(-dx, -dz);
    }
    this.audio.jumpscare();
    this.player.shake = 1;
    this.hurt = 1;
    $('hud').hidden = true;
    $('touch').hidden = true;
  }

  // ---------------------------------------------------------------- items
  spawnBattery() {
    const slot = this.batteries.find((b) => !b.active);
    if (!slot) return;
    const used = new Set(this.batteries.filter((b) => b.active).map((b) => b.spot));
    const pl = this.player.pos;
    const cands = this.lvl.batterySpots.filter((s) => !used.has(s) && Math.hypot(s.x - pl.x, s.z - pl.z) > 7);
    const s = cands.length ? cands[Math.floor(R() * cands.length)] : this.lvl.batterySpots[0];
    slot.spot = s;
    slot.active = true;
    slot.mesh.visible = true;
    slot.mesh.position.set(s.x, s.y, s.z);
    slot.mesh.rotation.y = s.face !== undefined ? (s.face > 0 ? Math.PI / 2 : -Math.PI / 2) : R() * 6;
  }

  updateCarryUI() {
    const c = this.player.carry;
    const lines = [];
    if (c.batteries) lines.push(`batteries × ${c.batteries}`);
    for (const it of this.comfortItems) if (it.state === 'carried') lines.push(COMFORT[it.key].name);
    $('carry').innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  }

  // what can the player interact with right now?
  findInteract() {
    const pl = this.player;
    if (pl.trans) return null;
    if (pl.hidden) return { kind: 'exit', label: pl.hidden.kind === 'hole' ? 'crawl out' : 'get out' };
    const ex = pl.eye, fwd = pl.dir;
    let best = null, bestScore = 0;
    const consider = (pos, maxD, minDot, obj) => {
      const dx = pos.x - ex.x, dy = pos.y - ex.y, dz = pos.z - ex.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > maxD) return;
      const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d;
      if (dot < minDot) return;
      const score = dot - d * 0.1;
      if (score > bestScore) { bestScore = score; best = obj; }
    };
    const v = new THREE.Vector3();
    for (const b of this.batteries) if (b.active) consider(v.set(b.spot.x, b.spot.y + 0.08, b.spot.z), 2.0, 0.86, { kind: 'battery', b, label: 'take the batteries' });
    for (const c of this.comfortItems) if (c.state === 'world') consider(v.set(c.spot.x, c.spot.y + 0.1, c.spot.z), 2.1, 0.84, { kind: 'comfort', c, label: `take the ${COMFORT[c.key].name}` });
    for (const h of this.lvl.hides) {
      const d = Math.hypot(h.enter.x - pl.pos.x, h.enter.z - pl.pos.z);
      if (d > 1.15) continue;
      const tx = h.cam.x - ex.x, tz = h.cam.z - ex.z;
      const dl = Math.hypot(tx, tz) || 1;
      const dot = (tx * fwd.x + tz * fwd.z) / dl / Math.max(0.2, Math.hypot(fwd.x, fwd.z));
      if (dot > 0.35 && 1.5 - d > bestScore) { bestScore = 1.5 - d; best = { kind: 'hide', h, label: h.label }; }
    }
    return best;
  }

  interact(it) {
    const pl = this.player;
    if (!it) return;
    if (it.kind === 'exit') pl.exit();
    else if (it.kind === 'hide') pl.enter(it.h);
    else if (it.kind === 'battery') {
      it.b.active = false;
      it.b.mesh.visible = false;
      pl.carry.batteries++;
      this.stats.batteries++;
      this.audio.pickup();
      this.updateCarryUI();
      if (!this.hints.battery) { this.hints.battery = 1; this.message('take them back to your spot.', 3); }
      setTimeout(() => this.spawnBattery(), 20000);
    } else if (it.kind === 'comfort') {
      it.c.state = 'carried';
      it.c.mesh.visible = false;
      this.audio.pickup();
      this.updateCarryUI();
      if (!this.hints.comfort) { this.hints.comfort = 1; this.message('it would look nice in your spot.', 3.5); }
    }
  }

  // ---------------------------------------------------------------- doors
  updateDoors(dt) {
    const ents = [
      { x: this.player.pos.x, z: this.player.pos.z, r: 1.2, hard: this.player.sprinting },
      { x: this.monster.pos.x, z: this.monster.pos.z, r: 1.6, hard: this.monster.speed > 3, monster: true },
    ];
    for (const d of this.lvl.doors) {
      let target = 0, hard = false;
      for (const e of ents) {
        if (Math.abs(e.x - d.x) > d.w / 2 + 0.4) continue;
        const dz = e.z - d.z;
        if (Math.abs(dz) > e.r) continue;
        const push = (1 - Math.abs(dz) / e.r) * 1.9;
        // swing away from whoever is pushing
        const t = dz < 0 ? -push : push;
        if (Math.abs(t) > Math.abs(target)) { target = t; hard = e.hard; }
      }
      const prev = d.swing || 0;
      for (let s = 0; s < 2; s++) {
        // spring + damping, panels mirror each other
        const want = s === 0 ? target : -target;
        d.vel[s] += (want - d.angle[s]) * 40 * dt - d.vel[s] * 7 * dt;
        d.angle[s] += d.vel[s] * dt;
        d.panels[s].rotation.y = d.angle[s];
      }
      d.swing = Math.abs(target);
      if (prev < 0.2 && d.swing >= 0.2) this.audio.door(d.x, d.z, hard);
      if (prev > 0.6 && d.swing < 0.05) d.closing = 0.6;
      if (d.closing > 0) {
        d.closing -= dt;
        if (d.closing <= 0 || Math.abs(d.angle[0]) < 0.06) { this.audio.door(d.x, d.z, false); d.closing = 0; }
      }
    }
  }
  doorBlocks(ax, az, bx, bz) {
    for (const d of this.lvl.doors) {
      if ((az - d.z) * (bz - d.z) > 0) continue;
      const t = (d.z - az) / (bz - az || 1e-6);
      const x = ax + (bx - ax) * t;
      if (Math.abs(x - d.x) < d.w / 2 && Math.abs(d.angle[0]) < 0.35) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- loop
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.adaptQuality(dt);
    if (this.state === 'title') {
      this.time += dt;
      this.titleUpdate(dt);
    } else if (this.state === 'play' || this.state === 'dying') {
      this.update(dt);
    } else if (this.state === 'won') {
      this.time += dt;
      this.dawn = Math.min(1, this.dawn + dt * 0.25);
      this.applyLighting(dt);
      this.monster.update(dt);
    }
    if (this.state !== 'paused') this.render(dt);
  }

  titleUpdate(dt) {
    const h = this.hole;
    const t = this.time;
    this.camera.position.set(h.cam.x, h.cam.y + Math.sin(t * 1.1) * 0.008, h.cam.z);
    this.camera.rotation.set(-0.06 + Math.sin(t * 0.21) * 0.03, h.yaw + Math.sin(t * 0.13) * 0.22, 0, 'YXZ');
    this.lanternLight.intensity = 1.1 * (0.96 + Math.sin(t * 13) * 0.01 + Math.sin(t * 2.3) * 0.02);
    this.applyLighting(dt);
    this.player.flash.intensity = 0;
    this.post.u.hidden = 1;
    this.post.u.warmth = 0.7;
    this.post.u.fade = 0;
  }

  update(dt) {
    const pl = this.player, mon = this.monster, inp = this.input.read();
    const dying = this.state === 'dying';
    this.time += dt;
    if (inp.pause && !dying) { this.pause(); return; }
    if (inp.mute) this.toggleMute();

    // ---- night clock
    if (!dying) {
      this.clockT += dt;
      const sph = CFG.secondsPerHour;
      const h = Math.floor(this.clockT / sph);
      if (h !== this.hour) {
        this.hour = h;
        if (h >= 6) return this.win();
        this.audio.chime();
        this.showClock(5);
      }
      const mins = Math.floor(((this.clockT % sph) / sph) * 60);
      $('clock-time').textContent = `${this.hour === 0 ? 12 : this.hour}:${String(mins).padStart(2, '0')}`;
    }

    // ---- input actions
    const it = dying ? null : this.findInteract();
    if (!dying) {
      if (inp.interact) this.interact(it);
      if (inp.flashlight && !pl.hidden) {
        pl.flashlight = !pl.flashlight;
        this.audio.click();
      }
    }
    this.updatePrompt(it);

    pl.update(dt, inp, dying);
    mon.update(dt);

    // ---- fear / comfort / tension
    const inHole = pl.hidden && pl.hidden.kind === 'hole';
    const lit = this.lantern > 0.02;
    const items = this.placed.size;
    const d = mon.distToPlayer ?? 99;
    const active = mon.state !== 'dormant' && mon.state !== 'gone' && mon.state !== 'leave';
    let target = pl.hidden ? 0.06 : pl.flashlight ? 0.16 : 0.24;
    if (active) {
      const prox = clamp(1 - d / 16, 0, 1);
      target += prox * 0.5;
      if (!pl.hidden && this.nav.los(pl.pos.x, pl.pos.z, mon.pos.x, mon.pos.z)) target += prox * 0.25;
    }
    if (mon.hunting) target = Math.max(target, 0.92);
    if (mon.state === 'check' && pl.hidden === mon.spot) target = Math.max(target, 0.7 + mon.suspicion * 0.3);
    if (inHole && !lit) target += 0.22;
    if (inHole && lit) target -= 0.06 + items * 0.02;
    target = clamp(target, 0, 1);
    if (target > this.fear) this.fear = Math.min(target, this.fear + dt * 0.55);
    else this.fear = Math.max(target, this.fear - dt * (inHole && lit ? 0.11 + items * 0.025 : pl.hidden ? 0.06 : 0.04));
    if (dying) this.fear = 1;
    const comfortT = inHole ? (lit ? 1 : 0.25) * clamp(1 - this.fear * 1.4, 0, 1) * (0.7 + items * 0.06) : 0;
    this.comfort = damp(this.comfort, comfortT, 1.2, dt);
    const tensT = active ? clamp(1 - d / 22, 0, 1) * 0.6 + (mon.hunting ? 0.5 : 0) + (mon.state === 'check' && pl.hidden === mon.spot ? 0.35 : 0) : 0;
    this.tension = damp(this.tension, clamp(tensT, 0, 1), 1.5, dt);

    // ---- lantern
    const drain = 1 / (CFG.lanternMinutes * 60) * (1 - items * 0.07);
    this.lantern = Math.max(0, this.lantern - drain * dt);
    if (inHole && this.lantern <= 0.02 && pl.carry.batteries > 0) this.swapBattery();
    if (this.lantern < 0.33 && !this.hints.lowLantern) {
      this.hints.lowLantern = 1;
      this.message(inHole ? 'your lantern is fading. there were batteries out on the shelves.' : 'your lantern is fading.', 5);
    }
    if (this.lantern <= 0.02 && !this.hints.deadLantern) {
      this.hints.deadLantern = 1;
      this.message('the lantern is dead.', 3.5);
    }
    const lb = $('lantern-bar');
    lb.style.width = Math.round(this.lantern * 100) + '%';
    lb.classList.toggle('low', this.lantern < 0.25);

    // ---- hints around the first close encounter
    if (pl.hidden && active && d < 7 && !this.hints.breath) {
      this.hints.breath = 1;
      this.breathHintT = 6;
    }
    const checkingMe = mon.state === 'check' && pl.hidden && pl.hidden === mon.spot;
    if (checkingMe && !this.monsterWasChecking) {
      this.stats.closeCalls++;
      // remind about breath-holding during the first few visits
      if (this.stats.closeCalls <= 3 && !pl.breath.held) this.breathHintT = 5;
    }
    if (pl.breath.held && this.breathHintT > 0) this.breathHintT = Math.min(this.breathHintT, 0.6);
    if (!checkingMe && this.monsterWasChecking && pl.hidden && mon.state !== 'grab') {
      if (!this.hints.gone) { this.hints.gone = 1; setTimeout(() => this.message("it's gone. for now.", 3.5), 2500); }
    }
    this.monsterWasChecking = checkingMe;

    // ---- dying sequence
    if (dying) {
      this.dyingT += dt;
      mon.model.head.getWorldPosition(this._headW || (this._headW = new THREE.Vector3()));
      pl.lockLook = this._headW;
      pl.shake = Math.max(0, 1 - this.dyingT * 0.6);
      if (this.dyingT > 1.0 && this.fadeTarget !== 1) this.fadeTo(1, 0.15);
      if (this.dyingT > 1.7) this.die();
    }
    this.hurt = Math.max(0, this.hurt - dt * (dying ? 0.2 : 1));

    // ---- lightning, flicker, doors, lights
    this.updateLightning(dt);
    this.updateDoors(dt);
    this.applyLighting(dt);

    // ---- flashlight nerves: it stutters when the thing is close
    let ff = 1;
    if (active && d < 9 && pl.flashlight) {
      const k = 1 - d / 9;
      if (Math.random() < dt * 6 * k) this.flashDrop = 0.06 + Math.random() * 0.12;
    }
    if (this.flashDrop > 0) { this.flashDrop -= dt; ff = 0.15 + Math.random() * 0.3; }
    pl.flashFlicker = ff;

    // ---- audio
    const occluded = !this.nav.los(pl.eye.x, pl.eye.z, mon.pos.x, mon.pos.z);
    const breathT = this.breathHintT > 0 ? (this.breathHintT -= dt) : 0;
    void breathT;
    this.audio.listener(this.camera.position, this.camera.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3())), this._up || (this._up = new THREE.Vector3(0, 1, 0)));
    this.audio.setPositions({ monster: mon.pos, lantern: this.lanternLight.position, fridge: this.fridgePos, buzz: this.flickerLights[0] ? this.flickerLights[0].L.position : null });
    this.audio.mix({
      hidden: pl.hidden ? 1 : pl.trans ? 0.5 : 0,
      hiddenKind: pl.hidden ? pl.hidden.kind : null,
      stock: this.lvl.inStock(pl.pos.x, pl.pos.z) ? 1 : 0,
      hum: this.lightAt(pl.pos.x, pl.pos.z),
      tension: this.tension,
      suspicion: mon.state === 'check' ? mon.suspicion : 0,
      comfort: this.comfort,
      lantern: inHole || Math.hypot(pl.pos.x - this.lanternLight.position.x, pl.pos.z - this.lanternLight.position.z) < 4 ? this.lantern : 0,
      occluded,
      dawn: this.dawn,
      breath: { level: pl.breath.level, phase: pl.breath.phase, holding: pl.breath.held },
      heart: smoothstep(0.22, 0.85, this.fear),
      bpm: 62 + this.fear * 98,
    });

    // ---- HUD bits
    const bb = $('breathbar');
    const showBreath = pl.breath.held || pl.breath.amount < 0.98;
    bb.classList.toggle('show', showBreath);
    bb.classList.toggle('low', pl.breath.amount < 0.3);
    bb.firstElementChild.style.width = Math.round(pl.breath.amount * 100) + '%';
    $('crosshair').classList.toggle('hot', !!it && it.kind !== 'exit');
    if (this.touchMode) {
      $('t-light').classList.toggle('on', pl.flashlight);
      $('t-crouch').classList.toggle('on', pl.crouch);
    }
  }

  updatePrompt(it) {
    const p = $('prompt');
    const pl = this.player;
    let html = '';
    if (this.breathHintT > 0 && pl.hidden) {
      html = this.touchMode ? 'it is close. hold <b>breath</b>.' : '<kbd>SPACE</kbd>hold your breath';
    } else if (it) {
      if (this.touchMode) html = it.label;
      else html = `<kbd>E</kbd>${it.label}` + (it.kind === 'exit' && pl.hidden && pl.hidden.peek ? '&nbsp;&nbsp;&nbsp;<kbd>W</kbd>peek out' : '');
    }
    if (p.innerHTML !== html) p.innerHTML = html;
    p.classList.toggle('show', !!html);
    if (this.touchMode) {
      const u = $('t-use');
      u.classList.toggle('off', !it);
      const lbl = !it ? 'use' : it.kind === 'exit' ? 'leave' : it.kind === 'hide' ? 'hide' : 'take';
      if (u.textContent !== lbl) u.textContent = lbl;
    }
  }

  updateLightning(dt) {
    this.nextLightning -= dt;
    const lt = this.lightning;
    if (this.nextLightning <= 0 && !this.flash) {
      this.flash = { t: 0, seq: [[0, 0.07, 1], [0.13, 0.2, 0.55], [0.33, 0.52, 1.25], [0.6, 0.66, 0.4]] };
      this.nextLightning = 30 + R() * 45;
      this.audio.thunder(0.6 + R() * 1.6);
    }
    let v = 0;
    if (this.flash) {
      const f = this.flash;
      f.t += dt;
      for (const [a, b, k] of f.seq) if (f.t >= a && f.t < b) v = k;
      if (f.t > 0.8) this.flash = null;
      if (lt.shadow && v > 0) lt.shadow.needsUpdate = true;
    }
    lt.intensity = v * (MOBILE ? 420 : 650);
    if (this.outsideMat) this.outsideMat.color.setScalar(1 + v * 5 + this.dawn * 3);
    if (this.rainTex) {
      this.rainTex[0].offset.y += dt * 0.05;
      this.rainTex[1].offset.y += dt * 0.11;
    }
  }

  applyLighting(dt) {
    const t = this.time;
    // flickering tubes
    for (const l of this.flickerLights) {
      l.ft -= dt;
      if (l.ft <= 0) {
        if (l.state === 1) { l.state = Math.random() < 0.5 ? 0 : 0.3; l.ft = 0.04 + Math.random() * 0.15; }
        else { l.state = 1; l.ft = Math.random() < 0.3 ? 0.05 + Math.random() * 0.1 : 1.5 + Math.random() * 5; }
      }
      l.L.intensity = l.base * l.state * (1 - this.dawn) + l.base * this.dawn;
    }
    const fm = this.lvl.materials.lightFlicker;
    if (fm && this.flickerLights[0]) fm.emissiveIntensity = 1.3 * Math.max(this.flickerLights[0].state, this.dawn);
    const wm = this.lvl.materials.lightWarmFlicker;
    const wl = this.flickerLights.find((l) => l.kind === 'lamp');
    if (wm && wl) wm.emissiveIntensity = 3 * Math.max(wl.state, this.dawn);
    if (this.flickerLights[0]) this.audio.buzz(this.flickerLights[0].state < 1 && this.flickerLights[0].state > 0 ? 1 : this.flickerLights[0].state === 1 ? 0.15 : 0);
    // dawn: every tube comes back on
    if (this.dawn > 0) {
      this.hemi.intensity = lerp(MOBILE ? 1.0 : 0.8, 3, this.dawn);
      const off = this.lvl.materials.diffuserOff;
      if (off) { off.emissive.setHex(0xeaf3ff); off.emissiveIntensity = this.dawn * 2; }
    }
    // lantern: dims and stutters as the batteries die
    const lv = this.lantern;
    let li = lv > 0.15 ? 0.75 + lv * 0.25 : lv / 0.15 * 0.75;
    if (lv < 0.2 && Math.random() < 0.08) li *= 0.4 + Math.random() * 0.4;
    if (lv <= 0.001) li = 0;
    const warmer = this.placed && this.placed.has('lights') ? 1.25 : 1;
    if (this.state !== 'title') this.lanternLight.intensity = 1.1 * li * warmer * (0.97 + Math.sin(t * 13) * 0.015);
    this.lanternMesh.globeMat.emissiveIntensity = 2.5 * li;
    // string lights twinkle gently
    if (this.placed && this.placed.has('lights')) this.props.bulbMats.forEach((m, i) => (m.emissiveIntensity = 1.8 + Math.sin(t * 1.3 + i * 1.7) * 0.5));
    // lantern shadow only re-renders while something moves nearby
    if (this.lanternLight.shadow) {
      const md = Math.hypot(this.monster.pos.x - this.lanternLight.position.x, this.monster.pos.z - this.lanternLight.position.z);
      if (md < 6) this.lanternLight.shadow.needsUpdate = true;
    }
    // monster eye-shine when the beam finds its face
    const mon = this.monster;
    const shine = this.player.beamOn(mon.head) ? 5 : 0;
    mon.eyeShine = damp(mon.eyeShine || 0, shine + (mon.hunting ? 1.2 : 0.35), 10, dt);
    mon.model.setEyes(mon.eyeShine);
  }

  render(dt) {
    const pl = this.player;
    const P = this.post.u;
    P.time = this.time;
    const hid = this.state === 'title' ? 1 : pl.hidden ? 1 : pl.trans ? 0.5 : 0;
    P.hidden = damp(P.hidden, hid, 3, dt);
    P.fear = damp(P.fear, this.fear, 4, dt);
    P.warmth = damp(P.warmth, this.state === 'title' ? 0.7 : this.comfort, 1.5, dt);
    P.hurt = this.hurt;
    P.dawn = this.dawn;
    P.fade = 0;
    const bpm = 62 + this.fear * 98;
    P.pulse = Math.pow(Math.max(0, Math.sin(this.time * (bpm / 60) * Math.PI)), 12);
    P.exposure = 1.1 + this.dawn * 0.4;
    if (!this.post.full) this.renderer.toneMappingExposure = 0.42 + this.dawn * 0.2;
    if (this.dustMat) {
      const U = this.dustMat.uniforms;
      U.cam.value.copy(this.camera.position);
      U.fpos.value.copy(pl.flash.position);
      U.fdir.value.copy(pl.dir);
      U.fpow.value = pl.flash.intensity / 40;
      U.time.value = this.time;
      U.pr.value = this.renderer.getPixelRatio();
    }
    if (!this.post.full) {
      $('fx-vignette').style.opacity = (0.45 + P.fear * 0.45 + P.hidden * 0.25 + P.pulse * P.fear * 0.2).toFixed(3);
      $('fx-grain').style.opacity = (0.1 + P.fear * 0.18).toFixed(3);
      $('fx-hurt').style.opacity = this.hurt.toFixed(3);
    }
    this.post.render(this.scene, this.camera);
  }

  adaptQuality(dt) {
    if (this.state !== 'play' || DEBUG) return;
    const ft = this.frameTimes;
    ft.push(dt);
    if (ft.length < 90) return;
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    ft.length = 0;
    this.prT -= 1.5;
    const min = MOBILE ? 0.55 : 0.65;
    if (avg > 1 / 38 && this.pr > min) {
      this.pr = Math.max(min, this.pr - 0.12);
      this.resize();
    } else if (avg < 1 / 58 && this.pr < this.basePR && this.prT <= 0) {
      this.pr = Math.min(this.basePR, this.pr + 0.06);
      this.prT = 8;
      this.resize();
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 82 : 72;
    this.camera.updateProjectionMatrix();
    const v = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.post.setSize(v.x, v.y);
  }

  // ---------------------------------------------------------------- debug (?debug)
  dbgStart() {
    this.audio.init();
    $('title').hidden = true;
    this.beginRun();
    this.fadeTo(0, 0.01);
  }
  dbgSettle(n = 20, dt = 0.05) {
    for (let i = 0; i < n; i++) this.update(dt);
  }
  dbgTeleport(x, z, yaw, pitch = 0) {
    const pl = this.player;
    pl.hidden = null;
    pl.trans = null;
    pl.entering = null;
    pl.pos.set(x, 0, z);
    pl.yaw = yaw;
    pl.pitch = pitch;
    pl.eyeH = 1.62;
  }
  dbgMonster(x, z, yaw, state = 'linger', timer = 999) {
    const m = this.monster;
    m.pos.set(x, 0, z);
    m.yaw = yaw;
    m.path = null;
    m.setState(state, timer);
    m.place();
  }

  // ---------------------------------------------------------------- endings
  fmtTime() {
    const sph = CFG.secondsPerHour;
    const h = Math.floor(this.clockT / sph);
    const m = Math.floor(((this.clockT % sph) / sph) * 60);
    return `${h === 0 ? 12 : h}:${String(m).padStart(2, '0')} AM`;
  }
  die() {
    this.state = 'dead';
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    const s = this.stats;
    $('dead-stats').innerHTML = `you lasted until ${this.fmtTime()}<br />close calls survived: ${Math.max(0, s.closeCalls - 1)} · batteries found: ${s.batteries}<br />things brought home: ${s.items}`;
    $('dead').hidden = false;
    this.fadeTo(0.55, 1.2);
  }
  win() {
    this.state = 'won';
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.monster.leave();
    this.audio.dawn();
    this.audio.chime();
    $('hud').hidden = true;
    $('touch').hidden = true;
    const s = this.stats;
    setTimeout(() => {
      $('won-stats').innerHTML = `close calls survived: ${s.closeCalls} · times it chased you: ${s.chases}<br />batteries found: ${s.batteries} · things brought home: ${s.items}`;
      $('won').hidden = false;
    }, 3800);
  }
}

const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('start');
  if (b) b.textContent = 'something went wrong: ' + e.message;
});
