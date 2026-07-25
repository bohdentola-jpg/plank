// ============================== NOCLIP ONLINE ==============================
// Appended to the bundled engine: everything above (kit, World, Player, Entities,
// Camcorder, Audio, Fx, the bestiary, the props, the hazmat suits, the level library and
// the stall) is already in scope. This file is the rest of the game:
//
//   · the DOOR   — your name, your suit, and a four-letter code to host or join
//   · the LINK   — PeerJS data channels, host in the middle, up to four in a party
//   · the RUN    — ten floors, and everybody is on the same one
//   · the HANDS  — keyboard and mouse on a desktop, thumbs on a phone
//
// WHY THERE IS NO LEVEL DATA ON THE WIRE. The level generator is deterministic: the same
// id and the same seed build the same fifteen thousand cells everywhere. So the host
// sends "floor 3 is level52, seed 91824" — twenty bytes — and every machine in the party
// builds the identical building locally. What actually goes over the channel is where
// people are, where the thing is, and who just died.

const $ = (id) => document.getElementById(id);
const PREF_KEY = 'noclip_online_v1';
const PROTO = 'nc1';                       // bump to keep incompatible builds apart
const PID = (code) => `noclip-${PROTO}-${code}`;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_PARTY = 4;
const POSE_HZ = 15;                        // how often you tell the others where you are
const SNAP_HZ = 15;                        // how often the host tells you where IT is
const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

const prefs = (() => {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; }
})();
const savePrefs = () => {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
};

const cleanName = (s) => (String(s || '').replace(/[<>&"']/g, '').trim().toUpperCase().slice(0, 12) || 'OPERATOR');
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const isTouch = () => matchMedia('(hover: none), (pointer: coarse)').matches || 'ontouchstart' in window;

// ------------------------------------------------------------------ the link
// Star topology: the host holds one channel per guest and forwards what needs forwarding.
// Guests only ever talk to the host. There is no server to run — PeerJS's free cloud does
// the introductions and then everything is peer to peer.
class Link {
  constructor() {
    this.peer = null;
    this.conns = new Map();          // id → conn (host: guests; guest: just the host)
    this.isHost = false;
    this.onMessage = null;           // (msg, fromId)
    this.onJoin = null;
    this.onLeave = null;
    this.code = null;
    this.opts = window.NOCLIP_PEER_OPTS || {};    // the local test harness points this at its own server
  }

  available() { return typeof Peer !== 'undefined'; }

  host(code) {
    return new Promise((resolve, reject) => {
      this.isHost = true;
      this.code = code;
      const peer = this.peer = new Peer(PID(code), { config: ICE, debug: 0, ...this.opts });
      const to = setTimeout(() => reject(new Error('the lobby service did not answer')), 15000);
      peer.on('open', () => { clearTimeout(to); resolve(code); });
      peer.on('error', (e) => { clearTimeout(to); reject(e); });
      peer.on('connection', (conn) => {
        if (this.conns.size >= MAX_PARTY - 1) {
          conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); });
          return;
        }
        conn.on('open', () => this.attach(conn));
      });
    });
  }

  join(code) {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      this.code = code;
      const peer = this.peer = new Peer(undefined, { config: ICE, debug: 0, ...this.opts });
      const to = setTimeout(() => reject(new Error('could not reach that lobby')), 18000);
      peer.on('error', (e) => { clearTimeout(to); reject(e); });
      peer.on('open', () => {
        const conn = peer.connect(PID(code), { reliable: true });
        conn.on('open', () => { clearTimeout(to); this.attach(conn); resolve(); });
        conn.on('error', (e) => { clearTimeout(to); reject(e); });
      });
    });
  }

  attach(conn) {
    this.conns.set(conn.peer, conn);
    conn.on('data', (d) => {
      if (d && typeof d === 'object') this.onMessage?.(d, conn.peer);
    });
    conn.on('close', () => { this.conns.delete(conn.peer); this.onLeave?.(conn.peer); });
    conn.on('error', () => { this.conns.delete(conn.peer); this.onLeave?.(conn.peer); });
    this.onJoin?.(conn.peer);
  }

  send(msg, toId = null) {
    for (const [id, c] of this.conns) {
      if (toId && id !== toId) continue;
      try { if (c.open) c.send(msg); } catch { /* mid-close */ }
    }
  }

  // Host only: pass a guest's message on to everybody else, so guests see each other.
  relay(msg, fromId) {
    for (const [id, c] of this.conns) {
      if (id === fromId) continue;
      try { if (c.open) c.send(msg); } catch { /* mid-close */ }
    }
  }

  close() {
    for (const [, c] of this.conns) { try { c.close(); } catch { /* fine */ } }
    this.conns.clear();
    try { this.peer?.destroy(); } catch { /* fine */ }
    this.peer = null;
  }
}

// ------------------------------------------------------------------ hands
// One input object, filled by whatever the player actually has: keys, mouse, or thumbs.
class Hands {
  constructor(canvas) {
    this.canvas = canvas;
    this.move = { fwd: 0, back: 0, left: 0, right: 0, sprint: 0, crouch: 0, jump: 0 };
    this.look = { dx: 0, dy: 0 };
    this.taps = { interact: false, torch: false, film: false, night: false, pause: false };
    this.keys = new Set();
    this.touch = isTouch();
    this._bindKeys();
    this._bindMouse();
    if (this.touch) this._bindTouch();
  }

  _bindKeys() {
    const map = {
      KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'crouch', KeyC: 'crouch', Space: 'jump',
    };
    addEventListener('keydown', (e) => {
      if (map[e.code]) { this.move[map[e.code]] = 1; e.preventDefault(); }
      if (this.keys.has(e.code)) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.taps.interact = true;
      if (e.code === 'KeyF') this.taps.torch = true;
      if (e.code === 'KeyR') this.taps.film = true;
      if (e.code === 'KeyN') this.taps.night = true;
      if (e.code === 'Escape') this.taps.pause = true;
    });
    addEventListener('keyup', (e) => {
      if (map[e.code]) this.move[map[e.code]] = 0;
      this.keys.delete(e.code);
    });
    addEventListener('blur', () => {
      for (const k in this.move) this.move[k] = 0;
      this.keys.clear();
    });
  }

  _bindMouse() {
    this.canvas.addEventListener('click', () => {
      if (!this.touch) this.canvas.requestPointerLock?.();
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.look.dx += e.movementX;
      this.look.dy += e.movementY;
    });
    this.canvas.addEventListener('mousedown', (e) => { if (e.button === 2) this.taps.torch = true; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Phones: a stick under the left thumb, look-drag anywhere on the right, and the
  // buttons are big enough to hit while something is chasing you.
  _bindTouch() {
    document.body.classList.add('touch');
    const stick = $('stick');
    const knob = $('knob');
    let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
    const R = 58;

    const onStart = (t, rect) => {
      if (t.clientX < innerWidth * 0.45 && t.clientY > innerHeight * 0.42) {
        stickId = t.identifier;
        sx = t.clientX; sy = t.clientY;
        stick.style.left = `${sx}px`;
        stick.style.top = `${sy}px`;
        stick.classList.add('on');
        return true;
      }
      lookId = t.identifier; lx = t.clientX; ly = t.clientY;
      return true;
    };
    addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('.tbtn, .screen, .door')) continue;
        onStart(t);
      }
    }, { passive: true });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          const dx = t.clientX - sx, dy = t.clientY - sy;
          const d = Math.min(R, Math.hypot(dx, dy)) || 0;
          const a = Math.atan2(dy, dx);
          const nx = Math.cos(a) * d / R, ny = Math.sin(a) * d / R;
          knob.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
          this.move.fwd = ny < -0.18 ? Math.min(1, -ny * 1.4) : 0;
          this.move.back = ny > 0.18 ? Math.min(1, ny * 1.4) : 0;
          this.move.left = nx < -0.18 ? Math.min(1, -nx * 1.4) : 0;
          this.move.right = nx > 0.18 ? Math.min(1, nx * 1.4) : 0;
          this.move.sprint = d > R * 0.85 ? 1 : 0;      // push the stick to run
        } else if (t.identifier === lookId) {
          this.look.dx += (t.clientX - lx) * 1.7;
          this.look.dy += (t.clientY - ly) * 1.7;
          lx = t.clientX; ly = t.clientY;
        }
      }
    }, { passive: true });
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null;
          stick.classList.remove('on');
          knob.style.transform = 'translate(0,0)';
          this.move.fwd = this.move.back = this.move.left = this.move.right = this.move.sprint = 0;
        }
        if (t.identifier === lookId) lookId = null;
      }
    };
    addEventListener('touchend', onEnd, { passive: true });
    addEventListener('touchcancel', onEnd, { passive: true });

    const btn = (id, fn, hold) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); fn(true); el.classList.add('down'); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); if (hold) fn(false); el.classList.remove('down'); }, { passive: false });
    };
    btn('b-use', () => { this.taps.interact = true; });
    btn('b-torch', () => { this.taps.torch = true; });
    btn('b-crouch', (down) => { this.move.crouch = down ? 1 : 0; }, true);
    btn('b-film', () => { this.taps.film = true; });
    btn('b-night', () => { this.taps.night = true; });
    btn('b-menu', () => { this.taps.pause = true; });
  }

  // Read and clear the one-shots.
  takeTaps() {
    const t = { ...this.taps };
    for (const k in this.taps) this.taps[k] = false;
    return t;
  }

  takeLook() {
    const l = { ...this.look };
    this.look.dx = 0; this.look.dy = 0;
    return l;
  }
}

// ------------------------------------------------------------------ the others
// Everyone else in the party, drawn as a hazmat suit with their name over it and their
// torch throwing real light, interpolated between the poses that arrive.
class Crowd {
  constructor(scene) {
    this.scene = scene;
    this.people = new Map();          // id → { mesh, from, to, name, suit, light, tag }
  }

  ensure(id, name, suit) {
    let p = this.people.get(id);
    if (p) return p;
    const mesh = buildHazmat(suit);
    const light = new THREE.PointLight(0xffe8c8, 1.5, 12, 1.3);
    light.position.set(0, 1.5, 0);
    mesh.add(light);
    const tag = makeNameTag(name);
    tag.position.y = 2.15;
    mesh.add(tag);
    p = {
      mesh, light, tag, name, suit,
      from: { x: 0, y: 0, z: 0, yaw: 0, t: 0 },
      to: { x: 0, y: 0, z: 0, yaw: 0, t: 0 },
      speed: 0, crouch: 0, torch: true, film: true, pitch: 0, hidden: false, dead: false,
    };
    this.people.set(id, p);
    this.scene.add(mesh);
    return p;
  }

  pose(id, d) {
    const p = this.ensure(id, d.n || '—', d.s || 'hazard');
    p.from = { ...p.to, t: performance.now() };
    p.to = { x: d.x, y: d.y, z: d.z, yaw: d.a, t: performance.now() + 1000 / POSE_HZ };
    p.speed = d.v || 0;
    p.crouch = d.c ? 1 : 0;
    p.torch = !!d.l;
    p.film = !!d.r;
    p.pitch = d.p || 0;
    p.hidden = !!d.h;
    p.dead = !!d.dd;
    if (d.n) { p.name = d.n; }
  }

  drop(id) {
    const p = this.people.get(id);
    if (!p) return;
    this.scene.remove(p.mesh);
    p.mesh.traverse((o) => o.geometry?.dispose?.());
    this.people.delete(id);
  }

  clear() { for (const id of [...this.people.keys()]) this.drop(id); }

  update(dt, t, camera) {
    const now = performance.now();
    for (const [, p] of this.people) {
      // interpolate between the last two poses; a dropped packet just holds still
      const span = Math.max(1, p.to.t - p.from.t);
      const k = Math.min(1.4, (now - p.from.t) / span);
      p.mesh.position.set(
        p.from.x + (p.to.x - p.from.x) * k,
        p.from.y + (p.to.y - p.from.y) * k,
        p.from.z + (p.to.z - p.from.z) * k,
      );
      let da = p.to.yaw - p.from.yaw;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      p.mesh.rotation.y = p.from.yaw + da * k;
      p.mesh.visible = !p.hidden && !p.dead;
      p.light.intensity = p.torch ? 1.5 : 0.15;
      animateHazmat(p.mesh, dt, t, {
        speed: p.speed, crouch: p.crouch, torchOn: p.torch, recording: p.film, pitch: p.pitch,
      });
      p.tag.lookAt(camera.position.x, p.mesh.position.y + 2.15, camera.position.z);
    }
  }
}

function makeNameTag(name) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(name, 128, 42);
  ctx.fillStyle = '#e8e2d0';
  ctx.fillText(name, 128, 42);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.375),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
  );
  return m;
}

// ------------------------------------------------------------------ the game
// One class, one animation frame, and the same World/Player/Entities the shelf version
// uses. The differences from single player are all about the party: everybody's poses go
// out, the host owns the thing that hunts you, and nobody rides the lift alone.
class Online {
  constructor() {
    this.holder = $('game');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 16 / 9, 0.06, 400);
    const touch = isTouch();
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(touch ? Math.min(1, devicePixelRatio || 1) : Math.min(1.5, devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.holder.appendChild(this.renderer.domElement);

    this.audio = new Audio();
    this.cam = new Camcorder(this.renderer, this.scene, this.camera, $('tape'));
    this.hands = new Hands(this.renderer.domElement);
    this.crowd = new Crowd(this.scene);
    this.link = new Link();
    this.quality = touch ? 0.6 : 1;

    this.ambient = new THREE.AmbientLight(0x30302a, 0.2);
    this.hemi = new THREE.HemisphereLight(0x404048, 0x101010, 0.15);
    this.lamp = new THREE.SpotLight(0xfff2d8, 0, 30, 0.62, 0.55, 1.05);
    this.lampTarget = new THREE.Object3D();
    this.glow = new THREE.PointLight(0xffe8c8, 0, 9, 1.25);
    this.scene.add(this.ambient, this.hemi, this.lamp, this.lampTarget, this.glow);
    this.lamp.target = this.lampTarget;

    this.player = new Player(null, {
      onFootstep: (mat, force) => {
        this.audio.footstep(mat, force);
        this.noiseBoost = Math.max(this.noiseBoost, force * 0.5);
      },
      onSplash: (v) => this.audio.oneShot('splash', Math.min(1, v)),
      onLand: () => this.audio.footstep('concrete', 1),
    });
    this.entities = new Entities(this);
    this.fx = { glitchAmt: 0, grainAmt: 0, shakeAmt: 0, hitFlash: 0, whipAmt: 0,
      update() {}, reset() {}, jumpscare() {} };

    // ---- state
    this.state = 'door';
    this.me = { id: 'me', name: cleanName(prefs.name), suit: prefs.suit || 'hazard' };
    this.party = new Map();            // id → { name, suit, floor, dead }
    this.floors = [];
    this.seeds = [];
    this.floorIndex = 0;
    this.world = null;
    this.levelId = null;
    this.lampOn = true;
    this.recording = true;
    this.night = false;
    this.camBattery = 100;
    this.tapeTime = 0;
    this.levelTime = 0;
    this.noiseBoost = 0;
    this.filmSeconds = 0;
    this.footage = 0;
    this.owned = {};
    this.mods = baseMods();
    this.dead = false;
    this.paused = false;
    this.downed = new Set();           // who is out on this floor
    this.settings = { sens: 1, tape: 1, subtitles: true, headBob: true, invertY: false, quality: this.quality };
    this.poseT = 0;
    this.snapT = 0;
    this.input = { fwd: 0, back: 0, left: 0, right: 0, sprint: 0, crouch: 0, jump: 0 };

    this.buildDoor();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cam?.resize(w, h);
  }

  show(name) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === `scr-${name}`);
    $('hud').classList.toggle('on', name === 'play');
    $('tape').classList.toggle('on', name === 'play');
    document.body.classList.toggle('playing', name === 'play');
  }

  say(text, secs = 4) {
    const el = $('say');
    el.textContent = text || '';
    el.classList.toggle('on', !!text);
    this.sayT = secs;
  }

  toast(text) {
    const el = $('toast');
    el.textContent = text || '';
    el.classList.toggle('on', !!text);
    this.toastT = 2.4;
  }

  // ---------------------------------------------------------------- the door
  buildDoor() {
    $('logo').src = logoCanvas('NOCLIP').toDataURL();
    const nameEl = $('name');
    nameEl.value = this.me.name;
    const suits = $('suits');
    suits.innerHTML = SUITS.map((s) => `
      <button class="suit ${s.key === this.me.suit ? 'on' : ''}" data-suit="${s.key}">
        <i style="background:#${s.suit.toString(16).padStart(6, '0')}"></i>${s.name}
      </button>`).join('');
    suits.onclick = (e) => {
      const b = e.target.closest('.suit');
      if (!b) return;
      this.me.suit = b.dataset.suit;
      prefs.suit = this.me.suit;
      savePrefs();
      for (const el of suits.querySelectorAll('.suit')) el.classList.toggle('on', el.dataset.suit === this.me.suit);
    };
    nameEl.oninput = () => { this.me.name = cleanName(nameEl.value); prefs.name = nameEl.value; savePrefs(); };

    $('d-solo').onclick = () => this.startSolo();
    $('d-host').onclick = () => this.startHost();
    $('d-join').onclick = () => this.startJoin($('code').value);
    $('code').oninput = () => { $('code').value = $('code').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); };
    $('lobby-go').onclick = () => this.beginRun();
    $('lobby-back').onclick = () => { this.link.close(); this.show('door'); this.state = 'door'; };
    $('p-resume').onclick = () => this.setPaused(false);
    $('p-quit').onclick = () => location.reload();
    $('d-copy').onclick = () => {
      const url = `${location.origin}${location.pathname}?join=${this.link.code}`;
      navigator.clipboard?.writeText(url);
      this.setLobbyNote('link copied — send it to them');
    };
    $('dead-watch').onclick = () => { $('scr-dead').classList.remove('on'); };

    const join = new URLSearchParams(location.search).get('join');
    if (join) { $('code').value = join.toUpperCase().slice(0, 4); this.setDoorNote(`invited to ${$('code').value} — press JOIN`); }
    this.show('door');
  }

  setDoorNote(t) { $('door-note').textContent = t || ''; }
  setLobbyNote(t) { $('lobby-note').textContent = t || ''; }

  renderLobby() {
    const rows = [[this.me.id, { name: this.me.name, suit: this.me.suit, host: this.link.isHost || this.solo }]];
    for (const [id, p] of this.party) rows.push([id, p]);
    $('lobby-list').innerHTML = rows.map(([, p]) => {
      const s = suitByKey(p.suit);
      return `<div class="crew"><i style="background:#${s.suit.toString(16).padStart(6, '0')}"></i>
        <b>${p.name}</b><span>${p.host ? 'HOST' : 'READY'}</span></div>`;
    }).join('');
    $('lobby-code').textContent = this.link.code || '—';
    $('lobby-go').hidden = !(this.link.isHost || this.solo);
    $('lobby-wait').hidden = this.link.isHost || this.solo;
  }

  // ---------------------------------------------------------------- lobbies
  async startSolo() {
    this.solo = true;
    this.party.clear();
    this.show('lobby');
    this.renderLobby();
    $('lobby-code').textContent = 'SOLO';
  }

  async startHost() {
    if (!this.link.available()) { this.setDoorNote('multiplayer needs the lobby library — check your connection'); return; }
    this.setDoorNote('opening a lobby…');
    const code = randomCode();
    this.wireLink();
    try {
      await this.link.host(code);
    } catch (e) {
      this.setDoorNote(`could not open a lobby (${e.message || e.type || 'no answer'}) — SOLO still works`);
      return;
    }
    this.solo = false;
    this.show('lobby');
    this.renderLobby();
    this.setLobbyNote('tell them the code, or send the link');
  }

  async startJoin(codeRaw) {
    const code = String(codeRaw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (code.length !== 4) { this.setDoorNote('a lobby code is four characters'); return; }
    if (!this.link.available()) { this.setDoorNote('multiplayer needs the lobby library — check your connection'); return; }
    this.setDoorNote(`knocking on ${code}…`);
    this.wireLink();
    try {
      await this.link.join(code);
    } catch (e) {
      this.setDoorNote(`nobody answered on ${code} (${e.message || e.type || 'timeout'})`);
      return;
    }
    this.solo = false;
    this.link.send({ t: 'hello', name: this.me.name, suit: this.me.suit });
    this.show('lobby');
    this.renderLobby();
    this.setLobbyNote('waiting for the host to start the descent');
  }

  wireLink() {
    this.link.onMessage = (m, from) => this.onMessage(m, from);
    this.link.onJoin = (id) => {
      if (!this.link.isHost) return;
      this.link.send({ t: 'welcome', you: id, host: { name: this.me.name, suit: this.me.suit } }, id);
      this.renderLobby();
    };
    this.link.onLeave = (id) => {
      const who = this.party.get(id);
      this.party.delete(id);
      this.crowd.drop(id);
      if (this.link.isHost) this.link.relay({ t: 'left', id }, id);
      if (who) this.toast(`${who.name} dropped out`);
      this.renderLobby();
    };
  }

  // ---------------------------------------------------------------- messages
  onMessage(m, from) {
    switch (m.t) {
      case 'hello': {                                  // a guest introducing itself
        this.party.set(from, { name: cleanName(m.name), suit: m.suit || 'hazard' });
        if (this.link.isHost) {
          // tell the newcomer about everybody, and everybody about the newcomer
          const roster = [[this.me.id, { name: this.me.name, suit: this.me.suit, host: true }]];
          for (const [id, p] of this.party) if (id !== from) roster.push([id, p]);
          this.link.send({ t: 'roster', rows: roster }, from);
          this.link.relay({ t: 'hello', name: m.name, suit: m.suit, id: from }, from);
          this.toast(`${cleanName(m.name)} is in`);
          if (this.state === 'play') this.link.send(this.runMsg(), from);
        }
        this.renderLobby();
        break;
      }
      case 'welcome':                                  // the host says hi back
        this.me.id = m.you || this.me.id;
        this.party.set('host', { name: cleanName(m.host?.name), suit: m.host?.suit, host: true });
        this.link.send({ t: 'hello', name: this.me.name, suit: this.me.suit });
        this.renderLobby();
        break;
      case 'roster':
        for (const [id, p] of m.rows || []) this.party.set(id, p);
        this.renderLobby();
        break;
      case 'left':
        this.party.delete(m.id);
        this.crowd.drop(m.id);
        this.renderLobby();
        break;
      case 'full':
        this.setDoorNote('that lobby is full (four is the most this tape can hold)');
        break;
      case 'run':                                      // the host's floor list
        this.floors = m.floors;
        this.seeds = m.seeds;
        this.enterFloor(m.at || 0);
        break;
      case 'pose': {                                   // where somebody is
        const id = m.id || from;
        if (id === this.me.id) break;
        if (!this.party.has(id)) this.party.set(id, { name: m.n, suit: m.s });
        this.crowd.pose(id, m);
        if (this.link.isHost) this.link.relay({ ...m, id }, from);
        break;
      }
      case 'snap':                                     // the host's monster
        if (this.entities.monster && !this.link.isHost) {
          const mm = this.entities.monster;
          mm.pos.x = m.x; mm.pos.y = m.y; mm.pos.z = m.z;
          mm.yaw = m.a;
          mm.state = m.s;
          mm.alert = m.al;
        }
        break;
      case 'down': {                                   // somebody got caught
        this.downed.add(m.id);
        const who = m.id === this.me.id ? 'you' : (this.party.get(m.id)?.name || 'somebody');
        if (m.id === this.me.id) this.goDown(m.by);
        else this.say(`${who} did not make it. ${this.aliveCount()} of you left.`, 5);
        if (this.link.isHost) this.link.relay(m, from);
        this.renderTags();
        break;
      }
      case 'floor':                                    // everybody down a floor
        this.enterFloor(m.at);
        break;
      case 'buy':                                      // somebody took something off the stall
        if (this.link.isHost) this.link.relay(m, from);
        this.toast(`${this.party.get(m.id)?.name || 'somebody'} bought ${m.name}`);
        break;
      case 'wipe':
        this.say('The tape stops. All of you.', 6);
        this.show('over');
        this.state = 'over';
        break;
      default: break;
    }
  }

  runMsg() { return { t: 'run', floors: this.floors, seeds: this.seeds, at: this.floorIndex }; }

  aliveCount() {
    const total = 1 + this.party.size;
    return Math.max(0, total - this.downed.size);
  }

  // ---------------------------------------------------------------- the run
  async beginRun() {
    if (!this.link.isHost && !this.solo) return;
    const rand = (() => { let s = (Math.random() * 1e9) | 0; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
    this.floors = makeRun(rand, 10);
    this.seeds = this.floors.map(() => Math.floor(rand() * 1e9));
    if (!this.solo) this.link.send(this.runMsg());
    await this.enterFloor(0);
  }

  async enterFloor(index) {
    this.floorIndex = index;
    this.levelId = this.floors[index];
    this.state = 'loading';
    this.show('load');
    $('load-label').textContent = `FLOOR ${index + 1} OF ${this.floors.length}`;
    await new Promise((r) => setTimeout(r, 30));

    const mod = LEVELS[this.levelId];
    if (!mod) { $('load-label').textContent = `tape damaged — ${this.levelId}`; return; }
    const data = mod.build(makeKit(this.seeds[index] ?? 1));
    this.meta = mod.meta;

    if (this.world) this.world.dispose();
    this.entities.clear();
    this.crowd.clear();
    this.downed.clear();
    this.world = new World(data, this.scene, { quality: this.quality, arrows: this.mods.arrows });
    this.player.world = this.world;
    this.player.mods = this.mods;
    this.rules = data.rules;
    this.gimmick = data.gimmick;
    this.scene.fog = new THREE.FogExp2(data.fog.color, data.fog.density);
    this.scene.background = new THREE.Color(data.fog.color);
    this.ambient.color.setHex(data.ambient.color);
    this.ambient.intensity = data.ambient.intensity;
    this.hemi.visible = !!data.openSky;
    this.levelTint = data.tint;
    this.entities.load(data);
    this.spawnLift(data.exits);

    // everybody starts at the same door, spread out a little so nobody is inside anybody
    const spread = (this.partyIndex() % 4) * 0.9;
    this.player.spawn(data.spawn.x * data.cell + spread, data.spawn.z * data.cell, data.spawn.yaw);
    this.levelTime = 0;
    this.filmSeconds = 0;
    this.dead = false;
    this.state = 'play';
    this.show('play');
    this.audio.ensure();
    this.audio.resume();
    this.audio.startTone(data.ambience);
    this.audio.startMusic(data.ambience.music);
    this.card(mod.meta, index + 1, this.floors.length);
    this.renderTags();
    if (!this.hands.touch) this.renderer.domElement.requestPointerLock?.();
  }

  partyIndex() {
    const ids = ['me', ...this.party.keys()].sort();
    return Math.max(0, ids.indexOf(this.me.id));
  }

  card(meta, floor, floors) {
    const el = $('card');
    el.innerHTML = `<div class="c-floor">FLOOR ${floor} OF ${floors}</div>
      <div class="c-num">LEVEL ${meta.num}</div><div class="c-name">${meta.name}</div>
      <div class="c-sub">${meta.subtitle || ''}</div><div class="c-tag">${meta.tagline || ''}</div>`;
    el.classList.add('on');
    this.cardT = 4.5;
  }

  spawnLift(exits) {
    for (const o of this.exitObjs || []) this.scene.remove(o.mesh);
    this.exitObjs = [];
    const S = this.world.cell;
    for (const e of exits) {
      if (e.kind !== 'elevator') continue;
      const g = new THREE.Group();
      const wx = e.x * S, wz = e.z * S;
      let facing = 0, bestOpen = -1;
      for (const [dx, dz, yaw] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
        let open = 0;
        for (let d = 1; d <= 4; d++) if (this.world.isOpenCell(e.x + dx * d, e.z + dz * d)) open++; else break;
        if (open > bestOpen) { bestOpen = open; facing = yaw; }
      }
      const car = buildProp({ name: 'liftEntrance', px: 0, pz: 0, rot: 0, y: 0 }, 0, 3);
      car.rotation.y = facing;
      g.add(car);
      const light = new THREE.PointLight(0xffd8a0, 2.4, 26, 1.05);
      light.position.set(Math.sin(facing) * 2.6, 1.5, Math.cos(facing) * 2.6);
      const inside = new THREE.PointLight(0xffe0a8, 2.2, 9, 1.2);
      inside.position.set(-Math.sin(facing) * 0.8, 2.1, -Math.cos(facing) * 0.8);
      g.add(light, inside);
      g.position.set(wx, this.world.floorAtWorld(wx, wz), wz);
      this.scene.add(g);
      this.exitObjs.push({ mesh: g, rec: e, doors: car.userData.doors, facing });
    }
  }

  // ---------------------------------------------------------------- the frame
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.0005, (now - this.last) / 1000));
    this.last = now;
    this.lastDt = dt;

    const taps = this.hands.takeTaps();
    if (taps.pause && this.state === 'play') this.setPaused(!this.paused);

    if (this.state === 'play' && !this.paused) {
      if (!this.dead) this.tick(dt, taps);
      else this.tickDead(dt);
    }
    this.hudTick(dt);

    const light = this.world ? this.world.lightAt(this.player.pos.x, this.player.pos.z) + (this.lampOn ? 0.35 : 0) : 0.4;
    this.cam.render(dt, {
      glitch: Math.min(1, this.fx.glitchAmt),
      grain: Math.min(1, this.fx.grainAmt),
      light: this.state === 'play' ? light : 0.5,
      night: this.night && this.camBattery > 0,
      damage: this.fx.hitFlash || 0,
      sanity: 1 - (this.entities.monster?.state === 'hunt' ? 0.4 : 0) - (this.player.hidden ? 0.15 : 0),
      underwater: !!this.player.submerged,
      tint: this.levelTint || { r: 1, g: 1, b: 1 },
      tapeTime: this.tapeTime,
      battery: this.camBattery,
      recording: this.recording && this.camBattery > 0,
      floorTag: this.meta ? `FLOOR ${this.floorIndex + 1}/${this.floors.length} · ${this.aliveCount()} ALIVE` : '',
    });
  }

  tick(dt, taps) {
    const p = this.player;
    const w = this.world;
    if (!w) return;
    this.levelTime += dt;
    if (this.recording && this.camBattery > 0) this.tapeTime += dt;
    this.noiseBoost = Math.max(0, this.noiseBoost - dt * 1.5);

    // ---- look
    const look = this.hands.takeLook();
    if (look.dx || look.dy) {
      p.turn(look.dx * (p.hidden ? 0.45 : 1), (this.settings.invertY ? -1 : 1) * look.dy * (p.hidden ? 0.45 : 1), this.settings.sens);
    }

    // ---- one-shots
    if (taps.torch) { this.lampOn = !this.lampOn; this.audio.oneShot('facelingClick', 0.3); }
    if (taps.film) { this.recording = !this.recording; this.audio.oneShot(this.recording ? 'tapeStart' : 'tapeStop', 0.5); }
    if (taps.night && this.camBattery > 0) { this.night = !this.night; this.audio.oneShot('glassTick', 0.4); }
    if (taps.interact) this.interact();

    // ---- move
    Object.assign(this.input, this.hands.move);
    if (p.hidden) {
      const m = this.entities.monster;
      p.hideThreat = m ? Math.min(1, Math.max(0, 1 - m.dist / 14)) : 0;
      p.updateHide(dt, this.mods);
      if (p.hideBreath <= 0) { p.leaveHide(); this.toast('you had to breathe'); }
    } else {
      p.update(dt, this.input, this.rules || {});
    }
    w.update(dt, p.pos);

    // ---- the thing. The host owns it; guests are shown where it is.
    if (this.link.isHost || this.solo) this.entities.update(dt);
    else if (this.entities.monster) this.entities.monster.animate(dt, 1.6);

    // ---- camera + torch
    const eye = p.eye();
    const hideDrop = p.hidden ? 0.42 : 0;
    this.camera.position.set(eye.x, eye.y - hideDrop + (this.settings.headBob ? 0 : -p.bob), eye.z);
    this.camera.rotation.set(p.pitch, p.yaw, p.sway * (this.settings.headBob ? 1 : 0), 'YXZ');
    const dir = p.look();
    this.lamp.position.copy(this.camera.position);
    this.lampTarget.position.set(eye.x + dir.x * 8, eye.y + dir.y * 8, eye.z + dir.z * 8);
    this.lamp.intensity = damp(this.lamp.intensity, this.lampOn && !p.hidden ? 2.6 * (this.mods.lampPower || 1) : 0, 12, dt);
    this.lamp.distance = 30 * (this.mods.lampRange || 1);
    this.glow.position.copy(this.camera.position);
    const night = this.night && this.camBattery > 0;
    this.glow.distance = night ? 22 : 9;
    this.glow.intensity = damp(this.glow.intensity, p.hidden ? 0.12 : night ? 7.5 : this.lampOn ? 2.2 : 0.12, 12, dt);

    // ---- battery, filming
    if (this.recording) {
      this.camBattery = Math.max(0, this.camBattery - dt * 0.09 * (this.night ? 3 : 1) * (this.mods.batteryDrain || 1));
    }
    const mon = this.entities.monster;
    if (mon && this.recording && mon.filmable?.()) this.filmSeconds += dt;

    // ---- doors, sound, prompts
    for (const o of this.exitObjs || []) {
      const d = Math.hypot(o.mesh.position.x - p.pos.x, o.mesh.position.z - p.pos.z);
      o.doorT = damp(o.doorT ?? 0, d < 5.5 ? 1 : 0, 3.2, dt);
      if (o.doors) {
        o.doors.l.position.x = o.doors.closedL - o.doors.open * o.doorT;
        o.doors.r.position.x = o.doors.closedR + o.doors.open * o.doorT;
      }
      if (d < 40) this.audio.hum(Math.min(1, 1 - d / 40));
    }
    this.audio.setListener(eye.x, eye.z, p.yaw);
    this.audio.humIdle(dt);
    if (mon) this.audio.updateHeart(dt, Math.min(1, Math.max(0, 1 - mon.dist / 26)) * (mon.state === 'hunt' ? 1 : 0.4));
    this.crowd.update(dt, this.levelTime, this.camera);
    this.updatePrompt();

    // ---- tell the others where we are
    this.poseT -= dt;
    if (this.poseT <= 0 && !this.solo) {
      this.poseT = 1 / POSE_HZ;
      this.link.send({
        t: 'pose', id: this.me.id, n: this.me.name, s: this.me.suit,
        x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2),
        a: +p.yaw.toFixed(2), p: +p.pitch.toFixed(2),
        v: +Math.hypot(p.vel?.x || 0, p.vel?.z || 0).toFixed(1),
        c: this.input.crouch ? 1 : 0, l: this.lampOn ? 1 : 0, r: this.recording ? 1 : 0,
        h: p.hidden ? 1 : 0, dd: this.dead ? 1 : 0,
      });
    }
    // ---- and if we are the host, where the thing is
    if ((this.link.isHost) && mon) {
      this.snapT -= dt;
      if (this.snapT <= 0) {
        this.snapT = 1 / SNAP_HZ;
        this.link.send({
          t: 'snap', x: +mon.pos.x.toFixed(2), y: +mon.pos.y.toFixed(2), z: +mon.pos.z.toFixed(2),
          a: +mon.yaw.toFixed(2), s: mon.state, al: +mon.alert.toFixed(2),
        });
      }
    }
  }

  // Dead is not out of the game: you keep the camera, you keep watching, and the others
  // have to finish without you. It is the meanest thing in here.
  tickDead(dt) {
    this.deadT = (this.deadT || 0) + dt;
    const look = this.hands.takeLook();
    if (look.dx || look.dy) this.player.turn(look.dx, look.dy, this.settings.sens);
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
    if (this.world) this.world.update(dt, this.player.pos);
    if (this.link.isHost || this.solo) this.entities.update(dt);
    this.crowd.update(dt, this.levelTime, this.camera);
    this.fx.grainAmt = 0.55;
    this.fx.glitchAmt = Math.max(0, 0.6 - this.deadT * 0.1);
  }

  interact() {
    const p = this.player.pos;
    if (this.player.hidden) { this.player.leaveHide(); return; }
    const lift = (this.exitObjs || []).find((o) => Math.hypot(o.mesh.position.x - p.x, o.mesh.position.z - p.z) < 3.2);
    if (lift) { this.callLift(); return; }
    const hide = this.world?.nearestHide(p.x, p.z, 2.3);
    if (hide) {
      this.player.enterHide(hide);
      this.audio.oneShot('clawStep', 0.35);
      this.say('You get out of sight and stay very still.', 3);
    }
  }

  // In a party the lift waits for everybody who is still alive to be standing in it. The
  // host does the counting, because the host is the one who can see everybody.
  callLift() {
    if (this.solo) { this.descend(); return; }
    const atLift = this.nearLift(this.player.pos);
    if (!atLift) return;
    if (this.link.isHost) {
      const waiting = [];
      for (const [id, p] of this.crowd.people) {
        if (this.downed.has(id)) continue;
        if (!this.nearLift(p.mesh.position)) waiting.push(this.party.get(id)?.name || 'somebody');
      }
      if (waiting.length) { this.toast(`waiting for ${waiting.join(', ')}`); return; }
      this.descend();
    } else {
      this.link.send({ t: 'ready' });
      this.toast('told the host you are in');
    }
  }

  nearLift(pos) {
    return (this.exitObjs || []).some((o) => Math.hypot(o.mesh.position.x - pos.x, o.mesh.position.z - pos.z) < 4.5);
  }

  async descend() {
    const pay = footageFor({
      floorIndex: this.floorIndex, filmSeconds: this.filmSeconds,
      neverChased: false, seconds: this.levelTime, hides: 1,
    });
    this.footage += pay.total;
    if (this.floorIndex + 1 >= this.floors.length) {
      if (!this.solo) this.link.send({ t: 'out' });
      this.show('out');
      this.state = 'out';
      $('out-stats').textContent = `${this.floors.length} floors · ${Math.round(this.tapeTime)}s of tape · ${this.footage} ft`;
      return;
    }
    if (!this.solo) this.link.send({ t: 'floor', at: this.floorIndex + 1 });
    await this.enterFloor(this.floorIndex + 1);
  }

  // The host tells everybody when the thing reaches somebody, including itself.
  onCaught(monster, reason) {
    if (this.dead) return;
    const msg = { t: 'down', id: this.me.id, by: monster?.sp?.name || 'IT', why: reason || null };
    if (!this.solo) this.link.send(msg);
    this.goDown(msg.by);
  }

  goDown(by) {
    this.dead = true;
    this.deadT = 0;
    this.downed.add(this.me.id);
    this.audio.oneShot('stingerLow', 1);
    this.audio.oneShot('stingerHigh', 0.8);
    $('dead-by').textContent = `${by || 'IT'} reached you.`;
    $('dead-note').textContent = this.solo
      ? 'The tape stops here.'
      : 'You keep filming. They have to finish it without you.';
    $('scr-dead').classList.add('on');
    if ((this.link.isHost || this.solo) && this.aliveCount() <= 0) {
      if (!this.solo) this.link.send({ t: 'wipe' });
      setTimeout(() => { this.show('over'); this.state = 'over'; }, 2500);
    }
  }

  setPaused(on) {
    this.paused = on;
    this.show(on ? 'pause' : 'play');
    if (!on && !this.hands.touch) this.renderer.domElement.requestPointerLock?.();
  }

  // ---------------------------------------------------------------- the hud
  updatePrompt() {
    const p = this.player.pos;
    let text = null;
    if (this.player.hidden) text = 'come out';
    else if (this.nearLift(p)) text = this.solo ? 'take the lift' : 'call the lift';
    else if (this.world?.nearestHide(p.x, p.z, 2.3)) text = 'hide';
    const el = $('prompt');
    el.textContent = text ? (this.hands.touch ? text.toUpperCase() : `[E] ${text}`) : '';
    el.classList.toggle('on', !!text);
  }

  renderTags() {
    const rows = [[this.me.id, { name: this.me.name, suit: this.me.suit }], ...this.party];
    $('party').innerHTML = rows.map(([id, pp]) => {
      const s = suitByKey(pp.suit);
      const out = this.downed.has(id);
      return `<div class="ptag ${out ? 'out' : ''}"><i style="background:#${s.suit.toString(16).padStart(6, '0')}"></i>${pp.name}</div>`;
    }).join('');
  }

  hudTick(dt) {
    if (this.cardT > 0) { this.cardT -= dt; if (this.cardT <= 0) $('card').classList.remove('on'); }
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) $('say').classList.remove('on'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.remove('on'); }
    const m = this.entities.monster;
    $('near').classList.toggle('on', !!m && m.dist < 22 && m.state === 'hunt');
    if (this.state === 'play') {
      $('foot').textContent = `${this.footage} ft`;
      $('batt').style.width = `${Math.max(0, this.camBattery)}%`;
      $('wind').style.width = `${Math.max(0, this.player.stamina || 0)}%`;
    }
  }
}

// ------------------------------------------------------------------ go
window.NOCLIP_ONLINE = new Online();
