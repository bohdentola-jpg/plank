// ============================== RIM CITY ONLINE ==============================
// Appended to the bundled engine: everything above (Game, Hud, CLIPS, arena,
// rigs, sfx, pads…) is in scope. This file adds the lobby, the netcode
// (host-authoritative over a PeerJS data channel), touch controls, and a
// guest-side presenter that renders the host's snapshots.

const $ = (id) => document.getElementById(id);
const NET_KEY = 'rimcity_online_v1';
const PROTO = 'rc1';                 // bump to keep incompatible builds apart
const PID = (code) => `rimcity-${PROTO}-${code}`;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};
const NEUTRAL = () => ({ mx: 0, mz: 0, turbo: false, shootD: false, shootU: false, shootHeld: false, pass: false, lob: false, shove: false, switch: false, pause: false });

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(NET_KEY) || '{}'); } catch { return {}; }
}
function savePrefs(p) {
  try { localStorage.setItem(NET_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
function crewInk(crew) {
  // some crews' secondary is near-black — keep names readable on dark cards
  return luminance(crew.colors.secondary) < 0.18 ? '#f4f2ec' : crew.colors.secondary;
}

function cleanName(s) {
  const n = String(s || '').replace(/[<>&"']/g, '').trim().toUpperCase().slice(0, 12);
  return n || 'BALLER';
}

// ------------------------------------------------------------------ logo
function onlineLogoCanvas(w = 1000, h = 360) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center';
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, 30, w * 0.5, h * 0.45, w * 0.45);
  glow.addColorStop(0, 'rgba(255,110,20,0.32)');
  glow.addColorStop(1, 'rgba(255,110,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.5, h * 0.44);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.font = `900 ${h * 0.42}px Impact, 'Arial Black', sans-serif`;
  const grad = ctx.createLinearGradient(0, -h * 0.2, 0, h * 0.16);
  grad.addColorStop(0, '#fff3c8');
  grad.addColorStop(0.42, '#ffb01f');
  grad.addColorStop(0.55, '#c2440c');
  grad.addColorStop(0.72, '#ff7a1f');
  grad.addColorStop(1, '#ffd24a');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0c0405';
  ctx.lineWidth = h * 0.075;
  ctx.strokeText('RIM CITY', 0, 0);
  ctx.fillStyle = grad;
  ctx.fillText('RIM CITY', 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(w * 0.5, h * 0.72);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.fillStyle = '#38c3ff';
  const bw = w * 0.44, bh = h * 0.16;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#06121e';
  ctx.font = `900 ${bh * 0.66}px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillText('O N L I N E', 0, bh * 0.24);
  ctx.restore();
  return cv;
}

// ------------------------------------------------------------------ input
/** Keyboard + first gamepad + touch, merged into one readTeam-shaped object.
 *  Edges accumulate between read() calls so nothing is dropped. */
class LocalInput {
  constructor(touch) {
    this.touch = touch;
    this.keys = new Set();
    this.edges = new Set();
    this._prevPadShoot = false;
    this._prevKeyShoot = false;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.edges.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  read() {
    const out = NEUTRAL();
    const k = this.keys;
    out.mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    out.mz = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
    out.turbo = k.has('ShiftLeft') || k.has('ShiftRight');
    out.shootHeld = k.has('Space');
    if (this.edges.has('Space')) out.shootD = true;
    if (this._prevKeyShoot && !k.has('Space')) out.shootU = true;
    this._prevKeyShoot = k.has('Space');
    if (this.edges.has('KeyE')) out.pass = true;
    if (this.edges.has('KeyF')) { out.lob = true; out.switch = true; }
    if (this.edges.has('KeyQ')) out.shove = true;
    this.edges.clear();

    const p = pads.p1;
    if (p.connected) {
      if (Math.abs(p.lx) > Math.abs(out.mx)) out.mx = p.lx;
      if (Math.abs(p.ly) > Math.abs(out.mz)) out.mz = p.ly;
      out.turbo = out.turbo || p.r2 > 0.25;
      // track our own press transitions: pads.poll() may run more often than
      // read() (guest polls at 60Hz, sends at 30Hz), and p.edges only lives
      // for a single poll — relying on it would drop taps
      this._padLast = this._padLast || {};
      const press = (btn) => {
        const cur = p.down(btn);
        const was = !!this._padLast[btn];
        this._padLast[btn] = cur;
        return cur && !was;
      };
      const held = p.down(BTN.CROSS);
      out.shootHeld = out.shootHeld || held;
      if (press(BTN.CROSS)) out.shootD = true;
      if (press(BTN.SQUARE)) out.pass = true;
      if (press(BTN.TRIANGLE)) out.lob = true;
      if (press(BTN.CIRCLE)) out.shove = true;
      if (press(BTN.L1)) out.switch = true;
      if (this._prevPadShoot && !held) out.shootU = true;
      this._prevPadShoot = held;
    }

    if (this.touch?.active) this.touch.mergeInto(out);
    const mag = Math.hypot(out.mx, out.mz);
    if (mag > 1) { out.mx /= mag; out.mz /= mag; }
    return out;
  }
}

/** Virtual stick + four buttons. Push the stick to the rim for turbo. */
class TouchPad {
  constructor() {
    this.active = false;
    this.mx = 0; this.mz = 0; this.turbo = false;
    this.held = {};
    this.edges = {};
    this._prevShoot = false;
    const stick = $('stick'), knob = $('stick-knob');
    let sid = null;
    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stick.addEventListener('pointerdown', (e) => {
      this.wake();
      sid = e.pointerId;
      stick.setPointerCapture(sid);
      this.moveStick(e, stick, setKnob);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== sid) return;
      this.moveStick(e, stick, setKnob);
    });
    const end = (e) => {
      if (e.pointerId !== sid) return;
      sid = null;
      this.mx = 0; this.mz = 0; this.turbo = false;
      stick.classList.remove('turbo');
      setKnob(0, 0);
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);

    for (const btn of document.querySelectorAll('.tbtn')) {
      const b = btn.dataset.b;
      const down = (e) => {
        e.preventDefault();
        this.wake();
        btn.setPointerCapture(e.pointerId);
        btn.classList.add('down');
        this.held[b] = true;
        this.edges[b] = true;
      };
      const up = () => {
        btn.classList.remove('down');
        this.held[b] = false;
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    }
  }

  wake() {
    if (this.active) return;
    this.active = true;
    document.body.classList.add('touch');
    sfx.ensure();
  }

  moveStick(e, stick, setKnob) {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 6;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    setKnob(dx, dy);
    const m = Math.min(1, len / max);
    if (m < 0.14) { this.mx = 0; this.mz = 0; this.turbo = false; }
    else {
      this.mx = (dx / max);
      this.mz = (dy / max);
      this.turbo = m > 0.92;
    }
    stick.classList.toggle('turbo', this.turbo);
  }

  mergeInto(out) {
    if (Math.abs(this.mx) > Math.abs(out.mx)) out.mx = this.mx;
    if (Math.abs(this.mz) > Math.abs(out.mz)) out.mz = this.mz;
    out.turbo = out.turbo || this.turbo;
    const held = !!this.held.shoot;
    out.shootHeld = out.shootHeld || held;
    if (this.edges.shoot) out.shootD = true;
    if (this._prevShoot && !held) out.shootU = true;
    this._prevShoot = held;
    if (this.edges.pass) out.pass = true;
    if (this.edges.lob) { out.lob = true; out.switch = true; }
    if (this.edges.shove) out.shove = true;
    this.edges = {};
  }
}

// ------------------------------------------------------------------ net
class NetLink {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.onMessage = null;
    this.onClose = null;
    this.remote = { held: NEUTRAL(), edges: {}, at: 0 };
  }

  available() { return typeof Peer !== 'undefined'; }

  host(code) {
    return new Promise((resolve, reject) => {
      this.isHost = true;
      const peer = this.peer = new Peer(PID(code), { config: ICE, debug: 0 });
      peer.on('open', () => resolve(code));
      peer.on('error', (e) => reject(e));
      peer.on('connection', (conn) => {
        if (this.conn && this.conn.open) {
          conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 400); });
          return;
        }
        this.attach(conn);
      });
    });
  }

  join(code) {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      const peer = this.peer = new Peer(undefined, { config: ICE, debug: 0 });
      peer.on('error', (e) => reject(e));
      peer.on('open', () => {
        const conn = peer.connect(PID(code), { reliable: true });
        const to = setTimeout(() => reject(new Error('timeout')), 12000);
        conn.on('open', () => { clearTimeout(to); this.attach(conn); resolve(); });
        conn.on('error', (e) => { clearTimeout(to); reject(e); });
      });
    });
  }

  attach(conn) {
    this.conn = conn;
    conn.on('data', (d) => {
      if (!d || typeof d !== 'object') return;
      if (d.t === 'in') {
        this.remote.held = d.h || NEUTRAL();
        for (const k in d.e || {}) if (d.e[k]) this.remote.edges[k] = true;
        this.remote.at = performance.now();
        return;
      }
      this.onMessage?.(d);
    });
    conn.on('close', () => this.onClose?.());
    conn.on('error', () => this.onClose?.());
  }

  /** Host: the away team's controller, built from the guest's packets. */
  consumeInput() {
    if (performance.now() - this.remote.at > 2000) return NEUTRAL();
    const h = this.remote.held, e = this.remote.edges;
    const out = {
      mx: h.mx || 0, mz: h.mz || 0,
      turbo: !!h.turbo, shootHeld: !!h.shootHeld,
      shootD: !!e.shootD, shootU: !!e.shootU,
      pass: !!e.pass, lob: !!e.lob, shove: !!e.shove, switch: !!e.switch,
      pause: false,
    };
    this.remote.edges = {};
    return out;
  }

  send(obj) {
    try { if (this.conn?.open) this.conn.send(obj); } catch { /* mid-close */ }
  }

  close() {
    try { this.send({ t: 'bye' }); } catch { /* fine */ }
    try { this.conn?.close(); } catch { /* fine */ }
    try { this.peer?.destroy(); } catch { /* fine */ }
    this.peer = null;
    this.conn = null;
  }
}

// ------------------------------------------------------------------ host
const SFX_TAPS = ['bounce', 'squeak', 'swish', 'rimClank', 'boardThud', 'dunkBoom', 'catchPop', 'steal', 'shove', 'whooshUp', 'buzzer', 'horn', 'chime', 'back', 'organ', 'crowd', 'say'];
let sfxOriginals = null;
function tapSfx(net) {
  if (sfxOriginals) return;
  sfxOriginals = {};
  for (const n of SFX_TAPS) {
    sfxOriginals[n] = sfx[n].bind(sfx);
    sfx[n] = (...a) => {
      sfxOriginals[n](...a);
      net.send({ t: 'ev', k: 'sfx', n, a });
    };
  }
}
function untapSfx() {
  if (!sfxOriginals) return;
  for (const n in sfxOriginals) sfx[n] = sfxOriginals[n];
  sfxOriginals = null;
}

class HostGame extends Game {
  readTeam(team) {
    const src = this.control[team === 0 ? 'home' : 'away'];
    if (src === 'local') return ONLINE.input ? ONLINE.input.read() : NEUTRAL();
    if (src === 'remote') return ONLINE.net ? ONLINE.net.consumeInput() : NEUTRAL();
    return super.readTeam(team);
  }
  contextHint() {
    if (document.body.classList.contains('touch')) { this.hud.hint(''); return; }
    super.contextHint();
  }
}

function snapFrom(game) {
  const R = (v) => Math.round(v * 100) / 100;
  const holderIdx = game.ball.holder ? game.ballers.indexOf(game.ball.holder) : -1;
  let sh = null;
  for (let i = 0; i < 4; i++) {
    const b = game.ballers[i];
    if (b.state === 'shoot' && !b.sd.released) { sh = { i, t: R(b.stateT), a: R(b.sd.apex) }; break; }
  }
  return {
    t: 's',
    q: game.quarter, ck: R(game.clockQ), sc: R(game.shotClock),
    s: game.scores.slice(), ph: game.phase, ex: R(game.excite),
    ctrl: game.controlled.slice(),
    sh,
    b: game.ballers.map((p) => [
      R(p.pos.x), R(p.pos.y), R(p.y), R(p.facing),
      p.anim.name, R(p.anim.t), R(p.anim.rate),
      p.onFire ? 1 : 0, Math.round(p.turbo),
    ]),
    ball: [R(game.ball.pos.x), R(game.ball.pos.y), R(game.ball.pos.z), game.ball.mode, holderIdx],
  };
}

// ------------------------------------------------------------------ guest
class GuestView {
  constructor(container, home, away, names) {
    this.container = container;
    this.home = home;
    this.away = away;
    this.names = names;                 // [hostName, guestName]
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, document.body.classList.contains('touch') ? 1.5 : 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = !document.body.classList.contains('touch');
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 200);
    this.cam.position.set(0, 7.2, 16.8);
    this.camShake = 0;
    this.arena = buildArena(this.scene, home, away);

    this.kits = [makeKit(home.colors), makeKit(away.colors)];
    // shaped like Game.ballers just enough for the borrowed particle system
    this.ballers = [];
    for (let t = 0; t < 2; t++) {
      const crew = t === 0 ? home : away;
      crew.players.forEach((p, i) => {
        const rig = buildPlayer(this.kits[t], { num: p.num, build: p.build, h: p.h, look: p.look });
        this.scene.add(rig.group);
        this.ballers.push({
          rig, info: p, team: t, slot: i,
          anim: new Animator(rig, CLIPS),
          pos: new THREE.Vector2(t === 0 ? -2 : 2, i * 2 - 1),
          y: 0, facing: 0, onFire: false, turbo: 100,
          cur: null, prev: null,
        });
      });
    }
    this.ballRig = buildBall();
    this.scene.add(this.ballRig);
    this.ballMat = this.ballRig.children[0].material;
    this.ball = { pos: new THREE.Vector3(0, 1, 0), shot: null, mode: 'dead', holderIdx: -1 };
    this.holder = () => (this.ball.holderIdx >= 0 ? this.ballers[this.ball.holderIdx] : null);
    this.particles = this.makeParticles(420);

    this.hud = new Hud(container.parentElement);
    this.snapPrev = null;
    this.snapCur = null;
    this.tPrev = 0;
    this.tCur = 0;
    this.scores = [0, 0];
    this.phase = 'dead';
    this.controlled = [0, 0];
    this.excite = 0.3;
    this._jumboT = 0;
    this._lastDribblePhase = 0;
    this.dead = false;
    this._markers = null;

    this._resize = () => {
      if (!container.clientWidth) return;
      this.cam.aspect = container.clientWidth / container.clientHeight;
      this.cam.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', this._resize);
    this.clock = new THREE.Clock();
    this.loop();
  }

  // borrow the host game's particle system wholesale
  makeParticles(n) { return Game.prototype.makeParticles.call(this, n); }
  emit(...a) { return Game.prototype.emit.call(this, ...a); }
  burst(...a) { return Game.prototype.burst.call(this, ...a); }
  confetti(...a) { return Game.prototype.confetti.call(this, ...a); }
  updateParticles(dt) { return Game.prototype.updateParticles.call(this, dt); }
  project(x, y, z) { return Game.prototype.project.call(this, x, y, z); }

  applySnap(s) {
    this.snapPrev = this.snapCur;
    this.tPrev = this.tCur;
    this.snapCur = s;
    this.tCur = performance.now();
    this.scores = s.s;
    this.phase = s.ph;
    this.controlled = s.ctrl;
    this.excite = s.ex;
    if (s.ph === 'over' && !this._overShown) {
      this._overShown = true;
      const won = s.s[1] > s.s[0];  // guest is the away team
      this.confetti(won ? this.away : this.home);
      showGuestFinal(s.s, this.home, this.away, won);
    }
    if (s.ph !== 'over') this._overShown = false;
  }

  applyEvent(e) {
    if (e.k === 'banner') {
      this.hud.banner(e.m, e.s2, e.ms, e.cls);
      $('matchup').classList.remove('show');
    }
    if (e.k === 'sfx') {
      const fn = sfx[e.n];
      if (fn) fn.apply(sfx, e.a || []);
      if (e.n === 'dunkBoom') {
        this.camShake = 0.5;
        const hoop = this.nearestHoop();
        hoop.shake = 1; hoop.netKick = 1;
        this.burst(this.ball.pos, [1, 0.85, 0.4], 26);
      }
      if (e.n === 'swish' || e.n === 'rimClank') this.nearestHoop().netKick = 1;
    }
  }

  nearestHoop() {
    return this.ball.pos.x > 0 ? this.arena.hoops[1] : this.arena.hoops[0];
  }

  loop() {
    if (this.dead) return;
    this._raf = requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    pads.poll();
    const now = performance.now();

    // interpolate between the two newest snapshots, ~120ms behind
    if (this.snapPrev && this.snapCur) {
      const span = Math.max(16, this.tCur - this.tPrev);
      const u = clamp((now - 120 - this.tPrev) / span, 0, 1.35);
      const A = this.snapPrev, B = this.snapCur;
      for (let i = 0; i < 4; i++) {
        const a = A.b[i], b = B.b[i];
        const p = this.ballers[i];
        p.pos.x = lerp(a[0], b[0], u);
        p.pos.y = lerp(a[1], b[1], u);
        p.y = lerp(a[2], b[2], u);
        let df = b[3] - a[3];
        while (df > Math.PI) df -= Math.PI * 2;
        while (df < -Math.PI) df += Math.PI * 2;
        p.facing = a[3] + df * u;
        p.onFire = !!b[7];
        p.turbo = b[8];
        // animation: follow the host's clip + timeline
        const name = b[4];
        if (p.anim.name !== name && CLIPS[name]) {
          const dur = CLIPS[name].dur;
          p.anim.play(name, { fade: 0.09, startAt: clamp(b[5] / dur, 0, 0.99) });
        } else if (Math.abs(p.anim.t - b[5]) > 0.35) {
          p.anim.t = b[5];
        }
        p.anim.rate = b[6];
        p.anim.update(dt);
        p.rig.group.position.set(p.pos.x, p.y, p.pos.y);
        p.rig.group.rotation.y = p.facing;
        const aBall = A.ball, bBall = B.ball;
        this.ball.mode = bBall[3];
        this.ball.holderIdx = bBall[4];
        if (bBall[4] >= 0 && (bBall[3] === 'held' || bBall[3] === 'dunk')) {
          this.attachBall(this.ballers[bBall[4]], bBall[3]);
        } else {
          this.ball.pos.set(lerp(aBall[0], bBall[0], u), lerp(aBall[1], bBall[1], u), lerp(aBall[2], bBall[2], u));
        }
      }
      this.hud.mid({
        qtr: B.q <= 4 ? `Q${B.q}` : `OT${B.q - 4 > 1 ? B.q - 4 : ''}`,
        clock: Game.prototype.fmtClock.call(this, lerp(A.ck, B.ck, u)),
        shot: Math.max(0, Math.ceil(B.sc)),
        urgent: B.sc <= 5,
      });
      for (const team of [0, 1]) {
        const crew = team === 0 ? this.home : this.away;
        const ctrlB = this.ballers.filter((p) => p.team === team)[this.controlled[team]] || this.ballers[team * 2];
        this.hud.team(team, {
          abbr: crew.abbr, name: crew.name, score: this.scores[team],
          color: crew.colors.primary,
          fire: this.ballers.some((p) => p.team === team && p.onFire),
          turbo: team === 1 ? ctrlB.turbo : null,
        });
      }
      // my shot meter (I'm the away side)
      const sh = B.sh;
      if (sh && this.ballers[sh.i].team === 1) {
        const p = this.ballers[sh.i];
        const sp = this.project(p.pos.x, p.y + 2.3, p.pos.y);
        this.hud.meter(sp, sh.t / (sh.a * 2), Math.abs(sh.t - sh.a) < 0.09);
      } else {
        this.hud.meter(null);
      }
    }

    // ball dribble sound + spin + fire tint
    this.ballRig.position.copy(this.ball.pos);
    this.ballRig.rotation.x += 0.16;
    this.ballRig.rotation.z += 0.07;
    const fire = this.holder()?.onFire;
    this.ballMat.color.set(fire ? '#ffd890' : '#d96b27');
    this.ballMat.emissive?.set?.(fire ? '#7a2a00' : '#000000');

    // camera (same broadcast math as the host)
    const bx = clamp(this.ball.pos.x, -9.0, 9.0);
    const want = new THREE.Vector3(bx * 0.80, 6.6, 15.6);
    this.cam.position.lerp(want, Math.min(1, 3.2 * dt));
    if (this.camShake > 0.002) {
      this.camShake *= Math.pow(0.001, dt);
      this.cam.position.x += (Math.random() - 0.5) * this.camShake * 0.5;
      this.cam.position.y += (Math.random() - 0.5) * this.camShake * 0.4;
    }
    const rimPull = clamp((Math.abs(this.ball.pos.x) - 7.5) / 5, 0, 1) * Math.sign(this.ball.pos.x);
    const look = new THREE.Vector3(bx * 0.88 + rimPull * 2.2, 1.8 + this.ball.pos.y * 0.22 + Math.abs(rimPull) * 0.5, this.ball.pos.z * 0.22);
    this._lookAt = this._lookAt || look.clone();
    this._lookAt.lerp(look, Math.min(1, 4.5 * dt));
    this.cam.lookAt(this._lookAt);

    this.excite = Math.max(0.18, this.excite - dt * 0.05);
    updateArena(this.arena, now / 1000, dt, this.excite);
    this.updateParticles(dt);
    this.updateMarkersAndTags();
    if (now / 1000 > this._jumboT) {
      this._jumboT = now / 1000 + 0.5;
      const B = this.snapCur;
      if (B) {
        this.arena.jumbo.draw({
          abbrH: this.home.abbr, abbrA: this.away.abbr,
          home: this.scores[0], away: this.scores[1],
          qtr: B.q <= 4 ? `Q${B.q}` : 'OT', clock: Game.prototype.fmtClock.call(this, B.ck),
          shot: Math.max(0, Math.ceil(B.sc)),
        });
      }
    }
    this.renderer.render(this.scene, this.cam);
  }

  attachBall(p, mode) {
    // replicate the host's held-ball visuals locally so dribbles look live
    const h = p;
    const st = h.anim.name;
    if (mode === 'dunk' || st === 'shootUp' || st === 'shootRelease' || st === 'passChest' || st === 'layup' || st === 'spin' || st === 'inboundHold' || st === 'tipJump') {
      const side = (st === 'passChest' || st === 'inboundHold' || st === 'dunkFlush') ? 'both' : 'R';
      const g = side === 'L' ? h.rig.gripL : h.rig.gripR;
      g.getWorldPosition(this.ball.pos);
      if (side === 'both') {
        const l = new THREE.Vector3();
        h.rig.gripL.getWorldPosition(l);
        this.ball.pos.lerp(l, 0.5);
      }
      return;
    }
    const meta = CLIP_META[st];
    const bounces = meta?.bounces || 1;
    const phase = (h.anim.phase * bounces) % 1;
    const handH = 0.74 * h.rig.scale;
    const a = h.facing;
    const ox = Math.sin(a + Math.PI * 0.42) * 0.34 + Math.sin(a) * 0.18;
    const oz = Math.cos(a + Math.PI * 0.42) * 0.34 + Math.cos(a) * 0.18;
    this.ball.pos.set(h.pos.x + ox, 0.121 + (handH - 0.121) * Math.abs(Math.cos(Math.PI * phase)), h.pos.y + oz);
    if (phase > 0.42 && phase < 0.58 && !(this._lastDribblePhase > 0.42 && this._lastDribblePhase < 0.58)) {
      // dribble thump locally (host doesn't broadcast every bounce)
      sfxOriginals ? sfxOriginals.bounce(0.35) : sfx.bounce(0.35);
    }
    this._lastDribblePhase = phase;
  }

  updateMarkersAndTags() {
    if (!this._markers) {
      this._markers = [];
      for (const team of [0, 1]) {
        const crew = team === 0 ? this.home : this.away;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.42, 0.55, 24),
          new THREE.MeshBasicMaterial({ color: crew.colors.secondary, transparent: true, opacity: 0.85, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        this.scene.add(ring);
        this._markers.push(ring);
      }
    }
    const t = performance.now() / 1000;
    for (const team of [0, 1]) {
      const p = this.ballers.filter((b) => b.team === team)[this.controlled[team]] || this.ballers[team * 2];
      const ring = this._markers[team];
      ring.position.x = p.pos.x;
      ring.position.z = p.pos.y;
      ring.material.opacity = team === 1 ? 0.6 + Math.sin(t * 6) * 0.25 : 0.28;
      updateNameTag(team, this.names[team], p, this, team === 0 ? this.home : this.away);
    }
  }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    try { this.renderer.dispose(); } catch { /* fine */ }
    this.container.innerHTML = '';
    $('nametags').innerHTML = '';
    this.hud.meter(null);
    $('net-final').classList.remove('show');
  }
}

// name tags shared by host + guest
function updateNameTag(team, name, p, view, crew) {
  const host = $('nametags');
  let el = host.querySelector(`[data-team="${team}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'ntag';
    el.dataset.team = team;
    host.appendChild(el);
  }
  el.textContent = (p.onFire ? '🔥 ' : '') + name;
  el.style.setProperty('--c', crewInk(crew));
  const sp = view.project(p.pos.x, (p.y || 0) + p.info.h + 0.55, p.pos.y);
  if (!sp) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.left = `${sp.x}px`;
  el.style.top = `${sp.y}px`;
}

function showGuestFinal(scores, home, away, won) {
  const f = $('net-final');
  f.innerHTML = `
    <div class="fin-card">
      <div class="fin-score">
        <span style="--c:${away.colors.primary}">${away.abbr} ${scores[1]}</span>
        <em>FINAL</em>
        <span style="--c:${home.colors.primary}">${scores[0]} ${home.abbr}</span>
      </div>
      <div class="fin-head">${won ? 'YOU TOOK IT.' : 'THEY TOOK IT.'}</div>
      <div class="fin-mvp">${won ? 'Tell them to run it back.' : 'The host decides on the rematch — stay ready.'}</div>
      <button class="menu-btn" id="gf-leave">LEAVE LOBBY</button>
    </div>`;
  f.classList.add('show');
  $('gf-leave').onclick = () => leaveEverything('You left the game.');
}

// ------------------------------------------------------------------ flow
const ONLINE = {
  net: null,
  input: null,
  touch: null,
  game: null,       // HostGame (host / practice)
  view: null,       // GuestView (guest)
  snapTimer: 0,
  sendTimer: 0,
  me: { name: 'BALLER', crewId: 'ny' },
  peerName: '',
  code: '',
};

function showN(id) {
  for (const s of document.querySelectorAll('.nscreen')) s.classList.remove('active');
  $(id).classList.add('active');
  document.body.classList.toggle('ingame', id === 'scr-game');
}

function status(msg, err = false) {
  const el = $('n-status');
  el.textContent = msg || '';
  el.classList.toggle('err', err);
}

function buildCrewGrid() {
  const grid = $('n-crews');
  grid.innerHTML = '';
  for (const crew of CREWS) {
    const b = document.createElement('button');
    b.className = 'n-crew' + (crew.id === ONLINE.me.crewId ? ' sel' : '');
    b.style.setProperty('--c', crew.colors.primary);
    b.style.setProperty('--c2', crew.colors.secondary);
    b.innerHTML = `<div class="cc">${crew.city}</div><div class="cn" style="color:${crewInk(crew)}">${crew.name}</div>`;
    b.onclick = () => {
      sfx.ensure(); sfx.chime();
      ONLINE.me.crewId = crew.id;
      savePrefs(ONLINE.me);
      grid.querySelectorAll('.n-crew').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
    };
    grid.appendChild(b);
  }
}

function renderLobby(players, isHost) {
  const wrap = $('lob-players');
  wrap.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const p = players[i];
    const d = document.createElement('div');
    if (p) {
      const crew = crewById(p.crewId);
      d.className = 'lob-p';
      d.style.setProperty('--c', crew.colors.primary);
      d.style.setProperty('--c2', crew.colors.secondary);
      d.innerHTML = `<div class="pn">${p.name}</div><div class="pc" style="color:${crewInk(crew)}">${crew.city} ${crew.name}${i === 0 ? ' · HOST' : ''}</div>`;
    } else {
      d.className = 'lob-p empty';
      d.innerHTML = `<div class="pn">…</div><div class="pc">WAITING FOR A CHALLENGER</div>`;
    }
    wrap.appendChild(d);
  }
  $('lob-start').style.display = isHost && players[1] ? '' : 'none';
  $('lob-wait').textContent = !players[1]
    ? 'share the code — first friend in gets the away crew'
    : isHost ? '' : 'waiting for the host to start…';
}

function genCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
  return c;
}

function commitIdentity() {
  ONLINE.me.name = cleanName($('n-name').value);
  $('n-name').value = ONLINE.me.name;
  savePrefs(ONLINE.me);
}

// ---- hosting
async function createLobby() {
  commitIdentity();
  if (!ONLINE.net.available()) return status('Multiplayer service unreachable — check your connection.', true);
  status('opening lobby…');
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = genCode();
    try {
      await ONLINE.net.host(code);
      ONLINE.code = code;
      enterLobbyScreen(true, null);
      return;
    } catch (e) {
      if (String(e?.type) === 'unavailable-id') continue;   // code taken, roll again
      return status('Could not reach the lobby service. Try again in a moment.', true);
    }
  }
  status('Could not grab a lobby code — try again.', true);
}

function enterLobbyScreen(isHost, guest) {
  showN('scr-lobby');
  $('lob-code').textContent = ONLINE.code;
  const link = `${location.origin}${location.pathname}?join=${ONLINE.code}`;
  $('lob-share').innerHTML = isHost
    ? `Friends join with the code, or send them this link:<br/><b style="color:#7df2ff">${link}</b>`
    : 'Connected. The host picks when it starts.';
  renderLobby([{ name: isHost ? ONLINE.me.name : ONLINE.peerName || 'HOST', crewId: isHost ? ONLINE.me.crewId : ONLINE.hostCrewId || 'ny' }, guest], isHost);

  if (isHost) {
    ONLINE.net.onMessage = (d) => {
      if (d.t === 'hello') {
        ONLINE.peerName = cleanName(d.name);
        ONLINE.peerCrewId = d.crewId;
        ONLINE.net.send({ t: 'lobby', name: ONLINE.me.name, crewId: ONLINE.me.crewId, code: ONLINE.code });
        renderLobby([{ name: ONLINE.me.name, crewId: ONLINE.me.crewId }, { name: ONLINE.peerName, crewId: d.crewId }], true);
        sfx.ensure(); sfx.chime();
      }
      if (d.t === 'bye') leaveEverything('Your friend left the lobby.');
    };
    ONLINE.net.onClose = () => leaveEverything('Connection lost.');
    $('lob-start').onclick = () => startOnlineGame();
  }
}

function resolveCrews() {
  const homeCrew = crewById(ONLINE.me.crewId);
  let awayId = ONLINE.peerCrewId || 'chi';
  if (awayId === homeCrew.id) {
    const idx = CREWS.findIndex((c) => c.id === awayId);
    awayId = CREWS[(idx + 1) % CREWS.length].id;
  }
  return { homeCrew, awayCrew: crewById(awayId) };
}

function startOnlineGame() {
  const { homeCrew, awayCrew } = resolveCrews();
  ONLINE.net.send({
    t: 'start',
    home: { crewId: homeCrew.id, name: ONLINE.me.name },
    away: { crewId: awayCrew.id, name: ONLINE.peerName },
  });
  startHostGame(homeCrew, awayCrew, 'remote', `ONLINE · LOBBY ${ONLINE.code}`);
}

function startHostGame(homeCrew, awayCrew, awayCtl, label) {
  showN('scr-game');
  teardownGameOnly();
  if (ONLINE.net?.conn) tapSfx(ONLINE.net);
  const game = ONLINE.game = new HostGame($('game-holder'), {
    home: homeCrew, away: awayCrew,
    control: { home: 'local', away: awayCtl },
    rung: awayCtl === 'cpu' ? 3 : 4,
    label,
    buttons: ({ won }) => {
      const rows = [];
      if (awayCtl === 'remote') {
        rows.push(['REMATCH — RUN IT BACK', () => startOnlineGame()]);
        rows.push(['LEAVE LOBBY', () => leaveEverything('You left the game.')]);
      } else {
        rows.push(['REMATCH', () => startHostGame(homeCrew, awayCrew, 'cpu', label)]);
        rows.push(['BACK TO LOBBY SCREEN', () => leaveEverything()]);
      }
      return rows;
    },
    onEnd: () => {},
    onExit: () => leaveEverything(),
  });
  // touch devices: calmer defaults
  if (document.body.classList.contains('touch')) {
    game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    game.renderer.shadowMap.enabled = false;
    game.arena.key.castShadow = false;
  }
  // broadcast banners + snapshots
  if (awayCtl === 'remote') {
    const ob = game.hud.banner.bind(game.hud);
    game.hud.banner = (m, s2, ms, cls) => { ob(m, s2, ms, cls); ONLINE.net.send({ t: 'ev', k: 'banner', m, s2, ms, cls }); };
    ONLINE.snapTimer = setInterval(() => {
      if (ONLINE.game) ONLINE.net.send(snapFrom(ONLINE.game));
    }, 50);
    ONLINE.net.onMessage = (d) => {
      if (d.t === 'bye') leaveEverything('Your friend left the game.');
    };
    ONLINE.net.onClose = () => leaveEverything('Connection lost.');
  }
  // host name tags
  const names = [ONLINE.me.name, awayCtl === 'remote' ? ONLINE.peerName : 'CPU'];
  const tagTick = () => {
    if (!ONLINE.game) return;
    for (const team of [0, 1]) {
      const b = (ONLINE.game.inb?.team !== team && ONLINE.game.possession === team && ONLINE.game.holder()?.team === team)
        ? ONLINE.game.holder() : ONLINE.game.ctrlOf(team);
      updateNameTag(team, names[team], b, ONLINE.game, team === 0 ? homeCrew : awayCrew);
    }
    ONLINE.tagRaf = requestAnimationFrame(tagTick);
  };
  tagTick();
}

// ---- joining
async function joinLobby(codeRaw) {
  commitIdentity();
  const code = String(codeRaw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length !== 4) return status('Codes are 4 letters.', true);
  if (!ONLINE.net.available()) return status('Multiplayer service unreachable — check your connection.', true);
  status('joining ' + code + '…');
  try {
    await ONLINE.net.join(code);
  } catch (e) {
    const kind = String(e?.type || e?.message || '');
    return status(kind.includes('peer-unavailable') ? `No lobby ${code} — check the code.` : 'Could not connect. Both of you online?', true);
  }
  ONLINE.code = code;
  ONLINE.net.send({ t: 'hello', name: ONLINE.me.name, crewId: ONLINE.me.crewId });
  ONLINE.net.onMessage = (d) => {
    if (d.t === 'lobby') {
      ONLINE.peerName = cleanName(d.name);
      ONLINE.hostCrewId = d.crewId;
      enterLobbyScreen(false, { name: ONLINE.me.name, crewId: ONLINE.me.crewId });
      renderLobby([{ name: ONLINE.peerName, crewId: d.crewId }, { name: ONLINE.me.name, crewId: ONLINE.me.crewId }], false);
      sfx.ensure(); sfx.chime();
    }
    if (d.t === 'start') startGuestGame(d);
    if (d.t === 'full') { leaveEverything('That lobby is already full.'); }
    if (d.t === 'ev' && ONLINE.view) ONLINE.view.applyEvent(d);
    if (d.t === 's' && ONLINE.view) ONLINE.view.applySnap(d);
    if (d.t === 'bye') leaveEverything('The host left.');
  };
  ONLINE.net.onClose = () => leaveEverything('Connection lost.');
}

function startGuestGame(d) {
  showN('scr-game');
  teardownGameOnly();
  const home = crewById(d.home.crewId);
  const away = crewById(d.away.crewId);
  ONLINE.view = new GuestView($('game-holder'), home, away, [d.home.name, d.away.name]);
  showGuestMatchup(home, away, d.home.name, d.away.name);
  // send inputs at 30Hz
  ONLINE.sendTimer = setInterval(() => {
    const inp = ONLINE.input.read();
    const { mx, mz, turbo, shootHeld } = inp;
    ONLINE.net.send({
      t: 'in',
      h: { mx, mz, turbo, shootHeld },
      e: { shootD: inp.shootD, shootU: inp.shootU, pass: inp.pass, lob: inp.lob, shove: inp.shove, switch: inp.switch },
    });
  }, 33);
  if (!document.body.classList.contains('touch')) {
    ONLINE.view.hud.hint('SPACE SHOOT (HOLD) · E PASS/STEAL · F ALLEY/SWITCH · Q SPIN/SHOVE · SHIFT TURBO — 🎮 pads work too');
  }
}

function showGuestMatchup(home, away, hostName, myName) {
  const m = $('matchup');
  const card = (crew, nm) => `
    <div class="mu-team" style="--c:${crew.colors.primary};--c2:${crewInk(crew)}">
      <div class="mu-city">${crew.city}</div>
      <div class="mu-name">${crew.name}</div>
      <div class="mu-players">${nm}</div>
    </div>`;
  m.innerHTML = `
    <div class="mu-card">
      <div class="mu-label">ONLINE · LOBBY ${ONLINE.code}</div>
      <div class="mu-vs">${card(away, myName + ' (YOU)')}<div class="mu-x">AT</div>${card(home, hostName)}</div>
      <div class="mu-tip">FIRST TO THE TIP — NO REFS, AND NO LAG EXCUSES</div>
    </div>`;
  m.classList.add('show');
  setTimeout(() => m.classList.remove('show'), 3600);
}

// ---- teardown
function teardownGameOnly() {
  clearInterval(ONLINE.snapTimer);
  clearInterval(ONLINE.sendTimer);
  cancelAnimationFrame(ONLINE.tagRaf);
  $('nametags').innerHTML = '';
  if (ONLINE.game) { ONLINE.game.dispose(); ONLINE.game = null; }
  if (ONLINE.view) { ONLINE.view.dispose(); ONLINE.view = null; }
  $('net-final').classList.remove('show');
}

function leaveEverything(msg) {
  teardownGameOnly();
  untapSfx();
  if (ONLINE.net) { ONLINE.net.close(); }
  ONLINE.net = new NetLink();
  showN('scr-landing');
  status(msg || '');
}

// ------------------------------------------------------------------ boot
function bootOnline() {
  if (typeof THREE === 'undefined') { $('cdn-fail').hidden = false; return; }
  Object.assign(ONLINE.me, loadPrefs());
  ONLINE.me.name = cleanName(ONLINE.me.name);
  if (!crewById(ONLINE.me.crewId)) ONLINE.me.crewId = 'ny';
  ONLINE.touch = new TouchPad();
  ONLINE.input = new LocalInput(ONLINE.touch);
  ONLINE.net = new NetLink();
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  const setOrient = () => document.body.classList.toggle('portrait', matchMedia('(orientation: portrait)').matches);
  setOrient();
  matchMedia('(orientation: portrait)').addEventListener?.('change', setOrient);

  $('n-logo-img').src = onlineLogoCanvas().toDataURL();
  $('n-name').value = ONLINE.me.name;
  buildCrewGrid();

  $('n-create').onclick = () => { sfx.ensure(); sfx.chime(); createLobby(); };
  $('n-join').onclick = () => { sfx.ensure(); sfx.chime(); joinLobby($('n-code').value); };
  $('n-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinLobby($('n-code').value); });
  $('n-practice').onclick = () => {
    sfx.ensure(); sfx.chime();
    commitIdentity();
    const mine = crewById(ONLINE.me.crewId);
    const oppPool = CREWS.filter((c) => c.id !== mine.id);
    const opp = oppPool[(Math.random() * oppPool.length) | 0];
    startHostGame(mine, opp, 'cpu', 'PRACTICE');
  };
  $('lob-leave').onclick = () => leaveEverything();

  $('c-pause').onclick = () => {
    if (ONLINE.game) { ONLINE.game.togglePause(); return; }
    // guest: overlay with quit/mute — the game keeps running online
    const p = $('pause');
    const open = !p.classList.contains('show');
    p.classList.toggle('show', open);
    if (open) {
      p.querySelector('#pause-resume').onclick = () => p.classList.remove('show');
      p.querySelector('#pause-exit').onclick = () => leaveEverything('You left the game.');
      p.querySelector('#pause-mute').textContent = sfx.muted ? 'SOUND: OFF' : 'SOUND: ON';
      p.querySelector('#pause-mute').onclick = () => {
        sfx.setMuted(!sfx.muted);
        p.querySelector('#pause-mute').textContent = sfx.muted ? 'SOUND: OFF' : 'SOUND: ON';
      };
      p.querySelector('#pause-voice').textContent = sfx.voiceOn ? 'ANNOUNCER: ON' : 'ANNOUNCER: OFF';
      p.querySelector('#pause-voice').onclick = () => {
        sfx.setVoiceOn(!sfx.voiceOn);
        p.querySelector('#pause-voice').textContent = sfx.voiceOn ? 'ANNOUNCER: ON' : 'ANNOUNCER: OFF';
      };
      p.querySelector('#pause-voice-name').onclick = () => {
        const name = sfx.cycleVoice();
        p.querySelector('#pause-voice-name').textContent = `ANNOUNCER VOICE: ${(name || 'AUTO').toUpperCase().slice(0, 28)} ▸`;
        sfx.say('Are you KIDDING me?!', 2, 1.0);
      };
    }
  };
  $('c-mute').onclick = () => {
    sfx.ensure();
    sfx.setMuted(!sfx.muted);
    $('c-mute').textContent = sfx.muted ? '🔇' : '🔊';
  };
  $('c-mute').textContent = sfx.muted ? '🔇' : '🔊';

  window.addEventListener('beforeunload', () => { try { ONLINE.net?.close(); } catch { /* bye */ } });

  // invite links: ?join=CODE
  const params = new URLSearchParams(location.search);
  const j = params.get('join');
  if (j) {
    $('n-code').value = j.toUpperCase().slice(0, 4);
    status(`Invite for lobby ${$('n-code').value} — set your name & crew, then hit JOIN.`);
  }
  window.__rimOnline = ONLINE;
  window.__rimDebug = { snapFrom, NetLink, NEUTRAL, GuestView, showN, teardownGameOnly, crewById };
}

bootOnline();
