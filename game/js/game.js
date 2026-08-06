// game.js — a running session: solo, hosting, or joined.
//
// The host owns the truth for the shared world: loose boxes, blaster bolts,
// stands, pong, and who just popped. Each client owns its own body and sends it
// at 15Hz; the host answers with a snapshot at 15Hz. Keepalives run on a timer,
// not the animation frame, so a backgrounded tab doesn't look dead and get
// dropped from the lobby.
//
// Scripted objects run locally on every client — each player experiences the
// map on their own machine — and `broadcast … to everyone` is the door between
// those copies.

import * as THREE from '../vendor/three.module.js';
import {
  clamp, lerp, rand, uid, COLORS, colorOf, playSound, unlockAudio,
  angleDelta, approachAngle, DEG,
} from './util.js';
import {
  PLAYER_SPEED, PLAYER_RUN, PLAYER_JUMP, PLAYER_H, PLAYER_R,
  BOLT_SPEED, BOLT_LIFE, THROW_SPEED, BONK_SPEED,
  createEntity, refreshSize, entAABB, aabbOverlap, pointInAABB, bodyAABB,
  stepBody, collectSolids, validateMap, distXZ, dist3,
} from './world.js';
import { modelInfo, buildModelMesh, tintMesh } from './models.js';
import { World, TerrainStreamer, BIOMES } from './terrain.js';
import { View, makeShadow, boxGeo, flatMat, cardboardBox } from './render.js';
import { StickmanRig, BoxBurst, makeBolt } from './rig.js';
import { compile, ScriptInstance } from './boxscript.js';
import { Chat, BubbleLayer, addBubble, updateBubbles, clearBubbles } from './chat.js';
import { Pong } from './pong.js';
import { mainMap } from './maps.js';
import { migrate } from './net.js';

const NET_HZ = 15;
const RESPAWN_T = 2.6;
const MAX_BOLTS_PER_PLAYER = 8;
const SHOOT_COOLDOWN = 0.22;
const MAX_SPAWNED = 400;
const MAX_WRITES = 80;
const KEYMAP = {
  ' ': 'space', arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
  enter: 'enter', shift: 'shift', tab: 'tab',
};

export class GameSession {
  constructor(opts) {
    this.dom = opts.dom;
    this.lobby = opts.lobby || null;
    this.testMode = !!opts.testMode;
    this.onExit = opts.onExit || (() => {});
    this.myName = opts.myName || 'guest';
    this.mapIsMain = !opts.map;
    this.map = opts.map ? validateMap(opts.map) : mainMap();

    this.view = new View(this.dom.canvas);
    this.world = new World(this.map.terrain === false ? 0 : this.map.seed);
    this.flatVoid = this.map.terrain === false;
    if (this.flatVoid) {
      this.world.heightAt = () => 0;
      this.world.isLava = () => false;
      this.world.biomeAt = () => 'void';
    }
    this.terrain = this.map.terrain === false
      ? new FlatGround(this.view.scene)
      : new TerrainStreamer(this.world, this.view.scene, { radius: 7, budget: 2 });

    this.time = 0;
    this.ents = [];
    this.players = new Map();
    this.bolts = [];
    this.myBolts = [];
    this.bursts = [];
    this.stands = new Map();
    this.shared = new Map();
    this.writes = new Map();
    this.buttons = new Map();
    this.pendingMsgs = [];
    this.errors = [];
    this.toasts = [];
    this.pops = 0;
    this.deaths = 0;
    this.seq = 0;
    this.keys = new Set();
    this.mouseAim = { x: 0, z: 0 };
    this.shootCool = 0;
    this.jumpBuffer = 0;
    this.spawnedLive = 0;
    this.running = true;
    this.paused = false;
    this.migrating = false;
    this.hintT = 16;
    this.deadBolts = [];
    this.writeEls = new Map();
    this.raycaster = new THREE.Raycaster();
    this.bubbles = new BubbleLayer(this.dom.bubbles);

    this.buildWorld();

    const myId = this.lobby ? this.lobby.myId : 'me';
    this.me = this.makePlayer(myId, this.myName, false);
    this.players.set(myId, this.me);
    this.respawn(true);
    this.view.cam.yaw = 0;
    this.view.updateCamera(new THREE.Vector3(this.me.x, this.me.y + 2, this.me.z), 1, this.world, { snap: true });
    if (this.terrain.prime) this.terrain.prime(this.me.x, this.me.z, 3);

    this.chat = new Chat(this.dom.chatBar, this.dom.chatInput, (t) => this.sendChat(t));

    if (this.lobby) {
      if (this.lobby.isHost) {
        this.lobby.getWelcome = () => ({
          map: this.mapIsMain ? null : this.map,
          snap: this.makeSnap(),
        });
      }
      this.attachLobby(this.lobby);
      for (const [id, name] of this.lobby.names) {
        if (id !== myId && !this.players.has(id)) this.players.set(id, this.makePlayer(id, name, true));
      }
      const w = this.lobby.welcome;
      if (w && w.snap) this.applySnap(w.snap, true);
    }

    this.bindInput();
    this.dom.crosshair.style.display = 'block';
    this.startScripts();

    // keepalives on a timer: rAF stops in a hidden tab, this does not
    this.netTimer = setInterval(() => this.netTick(), Math.round(1000 / NET_HZ));
    this.last = performance.now();
    this.raf = requestAnimationFrame(() => this.frame());
  }

  // ---------------------------------------------------------- world build
  buildWorld() {
    this.pong = null;
    for (const spec of this.map.objects) {
      this.addEntity(spec, false);
    }
  }

  addEntity(spec, spawned) {
    const ent = createEntity(this.map, spec);
    const info = modelInfo(this.map, ent.model);
    ent.script = spec.script || (info.custom && info.custom.script) || null;
    ent.synced = ent.physical && !ent.script;
    ent.spawned = !!spawned;
    // a placed object with no y sits on the ground
    if (this.map.terrain !== false && (spec.y == null || spec.y === 0) && !spawned) {
      ent.y = this.world.heightAt(ent.x, ent.z);
    }
    ent.mesh = buildModelMesh(this.map, ent.model);
    ent.mesh.scale.setScalar(ent.scale);
    ent.mesh.userData.entId = ent.id;
    if (ent.color) tintMesh(ent.mesh, colorOf(ent.color));
    this.syncMesh(ent);
    this.view.scene.add(ent.mesh);
    if (info.size.y > 0.9 && ent.model !== 'flower') {
      ent.shadow = makeShadow(Math.max(0.5, ent.size.x * 0.6));
      this.view.scene.add(ent.shadow);
    }
    this.ents.push(ent);
    if (ent.model === 'blasterstand') this.stands.set(ent.id, { armed: true, t: 0 });
    if (ent.model === 'pongtable' && !this.pong) this.pong = new Pong(ent);
    if (spawned) this.spawnedLive++;
    return ent;
  }

  removeEntity(ent) {
    if (ent.scriptInst) { ent.scriptInst.destroy(); ent.scriptInst = null; }
    if (ent.mesh) {
      this.view.scene.remove(ent.mesh);
      ent.mesh.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
    }
    if (ent.shadow) { this.view.scene.remove(ent.shadow); ent.shadow.geometry.dispose(); }
    if (ent.lightObj) { this.view.scene.remove(ent.lightObj); }
    this.bubbles.forget(ent);
    if (ent.spawned) this.spawnedLive = Math.max(0, this.spawnedLive - 1);
    if (this.pong && this.pong.tableId === ent.id) this.pong = null;
    this.stands.delete(ent.id);
  }

  syncMesh(ent) {
    if (!ent.mesh) return;
    ent.mesh.position.set(ent.x, ent.y, ent.z);
    ent.mesh.rotation.y = ent.yaw * DEG;
    ent.mesh.visible = ent.visible;
    if (ent.shadow) {
      const gy = this.world.heightAt(ent.x, ent.z);
      ent.shadow.position.set(ent.x, gy + 0.04, ent.z);
      const lift = clamp(ent.y - gy, 0, 10);
      ent.shadow.material.opacity = clamp(0.8 - lift * 0.08, 0.1, 0.8);
      ent.shadow.visible = ent.visible;
    }
  }

  makePlayer(id, name, remote) {
    const rig = new StickmanRig({ color: remote ? COLORS.gray : COLORS.darkgray });
    this.view.scene.add(rig.root);
    const sp = this.map.spawn;
    return {
      id, name: name || 'guest', remote, rig,
      x: sp.x, y: this.world.heightAt(sp.x, sp.z), z: sp.z,
      vx: 0, vy: 0, vz: 0, r: PLAYER_R, h: PLAYER_H,
      yaw: 0, pitch: 0, onGround: true,
      holding: null, pongSide: null, dead: false, deadT: 0, frozen: false,
      bubbles: [], speed: 0,
      tx: 0, ty: 0, tz: 0, tyaw: 0, hasTarget: false,
    };
  }

  removePlayer(p) {
    this.view.scene.remove(p.rig.root);
    p.rig.dispose();
    this.bubbles.forget(p);
  }

  respawn(first) {
    const p = this.me;
    const sp = this.map.spawn;
    const jitter = first ? 0 : rand(-2.5, 2.5);
    p.x = sp.x + jitter;
    p.z = sp.z + rand(-2.5, 2.5) * (first ? 0 : 1);
    p.y = this.world.heightAt(p.x, p.z) + 0.2;
    p.vx = p.vy = p.vz = 0;
    p.dead = false; p.deadT = 0;
    p.frozen = false;
    this.releaseHeld(p);
    p.pongSide = null;
  }

  releaseHeld(p) {
    if (p.holding && p.holding.kind === 'box') {
      const ent = this.entById(p.holding.id);
      if (ent && ent.heldBy === p.id) ent.heldBy = null;
    }
    p.holding = null;
  }

  startScripts() {
    for (const ent of this.ents) this.initScript(ent);
    for (const ent of this.ents) if (ent.scriptInst) ent.scriptInst.start();
  }

  initScript(ent) {
    if (!ent.script) return;
    const res = compile(ent.script);
    if (!res.ok) {
      for (const e of res.errors.slice(0, 3)) this.scriptError(ent, e.line, e.msg);
      if (!this.testMode) return;      // in play, a broken script just does nothing
    }
    ent.scriptInst = new ScriptInstance(res.program, this.bindings(ent));
    ent.touchedLast = false;
    ent.hitBolts = new Set();
  }

  // ---------------------------------------------------------- script host
  bindings(ent) {
    const S = this;
    return {
      getProp: (p) => {
        if (p === 'size') return ent.scale * 100;
        if (p === 'yaw') return ent.yaw;
        return ent[p];
      },
      setProp: (p, v) => {
        if (p === 'size') { ent.scale = clamp(v, 5, 1000) / 100; ent.mesh.scale.setScalar(ent.scale); refreshSize(S.map, ent); return; }
        if (p === 'yaw') { ent.yaw = v % 360; return; }
        if (p === 'x' || p === 'y' || p === 'z') { ent[p] = clamp(v, -1e5, 1e5); ent.vx = ent.vy = ent.vz = 0; }
      },
      getName: () => ent.model,
      move: (dx, dy, dz) => { ent.x += dx; ent.y += dy; ent.z += dz; },
      moveLocal: (f, side, up) => {
        const r = ent.yaw * DEG;
        ent.x += Math.sin(r) * f + Math.cos(r) * side;
        ent.z += Math.cos(r) * f - Math.sin(r) * side;
        ent.y += up;
      },
      turn: (deg) => { ent.yaw = (ent.yaw + deg) % 360; },
      setYaw: (deg) => { ent.yaw = deg % 360; },
      faceTarget: () => {
        const dx = S.me.x - ent.x, dz = S.me.z - ent.z;
        ent.yaw = Math.atan2(dx, dz) / DEG;
      },
      facePoint: (x, z) => { ent.yaw = Math.atan2(x - ent.x, z - ent.z) / DEG; },
      say: (text, secs) => addBubble(ent, text, secs),
      write: (text, x, y, size, id) => {
        const key = id || ent.id;         // unnamed writes belong to the object,
        if (!this.writes.has(key) && this.writes.size >= MAX_WRITES) {
          this.writes.delete(this.writes.keys().next().value);
        }
        S.writes.set(key, { text, x, y, size: clamp(size, 1, 30) });
      },
      unwrite: (id) => { if (id === 'all') S.writes.clear(); else S.writes.delete(id); },
      button: (label, x, y) => S.addButton(label, x, y),
      removeButton: (label) => S.removeButton(label),
      show: (v) => { ent.visible = !!v; },
      flag: (name, v) => {
        if (name === 'solid') ent.solid = !!v;
        else if (name === 'physical') ent.physical = !!v;
        else if (name === 'glow') S.setGlow(ent, !!v);
        else if (name === 'light') S.setLight(ent, !!v);
      },
      color: (name) => {
        const hex = COLORS[String(name).toLowerCase()];
        if (hex == null) return;
        ent.color = String(name).toLowerCase();
        tintMesh(ent.mesh, hex);
      },
      grow: (amt) => {
        ent.scale = clamp(ent.scale * 100 + amt, 5, 1000) / 100;
        ent.mesh.scale.setScalar(ent.scale);
        refreshSize(S.map, ent);
      },
      spin: (deg) => { ent.spin = clamp(deg, -3600, 3600); },
      spawn: (model, x, y, z) => S.spawnFromScript(ent, model, x, y, z),
      vanish: () => { ent.gone = true; },
      push: (dx, dy, dz) => {
        ent.physical = true;
        ent.vx += dx * 0.05; ent.vy += dy * 0.05; ent.vz += dz * 0.05;
      },
      pushLocal: (f, side, up) => {
        ent.physical = true;
        const r = ent.yaw * DEG;
        ent.vx += (Math.sin(r) * f + Math.cos(r) * side) * 0.05;
        ent.vz += (Math.cos(r) * f - Math.sin(r) * side) * 0.05;
        ent.vy += up * 0.05;
      },
      teleportPlayer: (x, y, z) => {
        S.me.x = clamp(x, -1e5, 1e5);
        S.me.z = clamp(z, -1e5, 1e5);
        S.me.y = y == null ? S.world.heightAt(S.me.x, S.me.z) : clamp(y, -1e4, 1e4);
        S.me.vx = S.me.vy = S.me.vz = 0;
      },
      sound: (name) => playSound(name),
      broadcast: (msg, everyone) => S.broadcastBS(msg, everyone),
      freeze: (v) => { S.me.frozen = !!v; },
      shake: (amt) => S.view.shake(clamp(amt, 0, 3)),
      playerProp: (p) => {
        if (p === 'name') return S.me.name;
        if (p === 'yaw') return S.me.yaw / DEG;
        return S.me[p];
      },
      mouse: (p) => (p === 'x' ? S.mouseAim.x : S.mouseAim.z),
      keyDown: (name) => S.keys.has(name),
      touching: (what) => S.touchingWhat(ent, what),
      distanceToPlayer: () => dist3(ent.x, ent.y, ent.z, S.me.x, S.me.y + 1, S.me.z),
      distanceToModel: (model) => {
        let best = 1e9;
        for (const e of S.ents) {
          if (e === ent || e.gone || e.model !== model) continue;
          best = Math.min(best, dist3(ent.x, ent.y, ent.z, e.x, e.y, e.z));
        }
        return best === 1e9 ? 0 : best;
      },
      count: (model) => S.ents.reduce((n, e) => n + (!e.gone && e.model === model ? 1 : 0), 0),
      time: () => S.time,
      biome: () => S.world.biomeAt(ent.x, ent.z),
      heightAt: (x, z) => S.world.heightAt(x, z),
      sharedGet: (n) => S.shared.get(n),
      sharedSet: (n, v) => { if (S.shared.size < 400 || S.shared.has(n)) S.shared.set(n, v); },
      onError: (line, msg) => S.scriptError(ent, line, msg),
    };
  }

  setGlow(ent, on) {
    ent.glow = on;
    ent.mesh.traverse(o => {
      if (!o.isMesh) return;
      if (on) {
        if (!o.userData.preGlow) o.userData.preGlow = o.material;
        o.material = new THREE.MeshBasicMaterial({ color: o.material.color ? o.material.color.clone() : 0xffffff });
      } else if (o.userData.preGlow) {
        o.material = o.userData.preGlow;
      }
    });
  }

  setLight(ent, on) {
    if (on && !ent.lightObj) {
      ent.lightObj = new THREE.PointLight(0xffffff, 1.1, 22, 1.6);
      this.view.scene.add(ent.lightObj);
    } else if (!on && ent.lightObj) {
      this.view.scene.remove(ent.lightObj);
      ent.lightObj = null;
    }
  }

  touchingWhat(ent, what) {
    const a = entAABB(ent);
    if (what === 'player') {
      return !this.me.dead && aabbOverlap(a, bodyAABB(this.me), 0.25);
    }
    for (const e of this.ents) {
      if (e === ent || e.gone || e.model !== what) continue;
      if (aabbOverlap(a, entAABB(e), 0.1)) return true;
    }
    return false;
  }

  spawnFromScript(src, model, x, y, z) {
    if (this.spawnedLive >= MAX_SPAWNED) {
      this.scriptError(src, 0, `too many spawned objects at once (${MAX_SPAWNED} max)`);
      return;
    }
    const info = modelInfo(this.map, model);
    if (info.missing) { this.scriptError(src, 0, `there is no model called "${model}"`); return; }
    const px = x != null ? x : src.x;
    const pz = z != null ? z : src.z;
    const py = y != null ? y : this.world.heightAt(px, pz);
    const ent = this.addEntity({
      model, x: px, y: py, z: pz, scale: 100, yaw: 0,
      script: info.custom && info.custom.script || null,
    }, true);
    if (ent.script) { this.initScript(ent); if (ent.scriptInst) ent.scriptInst.start(); }
  }

  addButton(label, x, y) {
    if (this.buttons.has(label)) this.removeButton(label);
    if (this.buttons.size >= 12) return;
    const b = document.createElement('button');
    b.className = 'bs-btn';
    b.textContent = String(label).slice(0, 24);
    b.style.left = clamp(x, 0, 100) + '%';
    b.style.top = clamp(y, 0, 100) + '%';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      playSound('pip');
      for (const ent of this.ents) if (ent.scriptInst) ent.scriptInst.trigger('button', label);
    });
    this.dom.bsUI.appendChild(b);
    this.buttons.set(label, b);
  }

  removeButton(label) {
    const b = this.buttons.get(label);
    if (b) { b.remove(); this.buttons.delete(label); }
  }

  broadcastBS(msg, everyone) {
    this.pendingMsgs.push(msg);
    if (everyone && this.lobby && !this.lobby.offline) {
      if (this.lobby.isHost) this.lobby.broadcast({ t: 'bs', msg });
      else this.lobby.send({ t: 'bs', msg });
    }
  }

  scriptError(ent, line, msg) {
    const text = `${ent.model} line ${line}: ${msg}`;
    if (this.errors[this.errors.length - 1] === text) return;
    this.errors.push(text);
    if (this.errors.length > 40) this.errors.shift();
    if (this.testMode) this.showErrors();
  }

  showErrors() {
    const el = this.dom.errPanel;
    if (!el) return;
    if (!this.errors.length) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.textContent = 'script issues\n' + this.errors.slice(-6).join('\n');
  }

  toast(text) {
    this.toasts.push({ text: String(text), t: 4.5 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  // ---------------------------------------------------------- input
  bindInput() {
    const canvas = this.dom.canvas;
    this.onKeyDown = (e) => {
      if (!this.running) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (this.chat.open || tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = KEYMAP[e.key.toLowerCase()] || e.key.toLowerCase();
      if (k === 't' || k === 'enter') { e.preventDefault(); this.chat.openBar(); return; }
      if (e.key === 'Escape') { this.setPaused(true); return; }
      if (!this.keys.has(k)) {
        this.keys.add(k);
        if (k === 'space') this.jumpBuffer = 0.16;   // a tap between frames still jumps
        if (k === 'e') this.interact();
        else if (k === 'q') this.dropHeld();
        else if (k === 'f') this.view.setPixel(this.view.pixel === 3 ? 2 : this.view.pixel === 2 ? 4 : 3);
        for (const ent of this.ents) if (ent.scriptInst) ent.scriptInst.trigger('key', k);
      }
      if (k === 'space' || k.startsWith('arrow')) e.preventDefault();
    };
    this.onKeyUp = (e) => {
      const k = KEYMAP[e.key.toLowerCase()] || e.key.toLowerCase();
      this.keys.delete(k);
    };
    this.onMouseMove = (e) => {
      // mouse look works locked (normal) or by dragging (when a browser or an
      // embed refuses pointer lock, the game still has to be playable)
      const locked = document.pointerLockElement === canvas;
      if (locked || this.dragLook) {
        const s = 0.0022;
        this.view.cam.yaw -= (e.movementX || 0) * s;
        this.view.cam.pitch = clamp(this.view.cam.pitch + (e.movementY || 0) * s, -0.55, 1.15);
      }
      this.lastMouse = { x: e.clientX, y: e.clientY };
    };
    this.onMouseUp = () => { this.dragLook = false; };
    this.onMouseDown = (e) => {
      if (!this.running || this.paused || this.chat.open) return;
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'A')) return;
      unlockAudio();
      if (document.pointerLockElement !== canvas) {
        this.dragLook = true;
        this.requestLock();
        if (!this.lockWorks) return;      // first click just grabs the mouse
      }
      if (e.button === 0) this.primary();
    };
    this.onWheel = (e) => {
      if (this.paused) return;
      this.view.cam.dist = clamp(this.view.cam.dist + Math.sign(e.deltaY) * 1.1, 4.5, 22);
    };
    this.onBlur = () => this.keys.clear();
    this.onResize = () => this.view.resize();
    this.onLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) { this.lockWorks = true; this.hadLock = true; }
      // only losing a lock we actually had means "the player pressed escape"
      else if (this.hadLock && this.running && !this.chat.open) this.setPaused(true);
      this.dom.crosshair.style.display = this.running && !this.paused ? 'block' : 'none';
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onLockChange);

    // the pause overlay
    this.dom.pauseResume.onclick = () => this.setPaused(false);
    this.dom.pauseLeave.onclick = () => this.exit();
  }

  requestLock() {
    try {
      const p = this.dom.canvas.requestPointerLock();
      // Chrome returns a promise; a rejection means locking is not allowed here
      if (p && p.catch) p.catch(() => { this.lockWorks = false; });
    } catch (e) { this.lockWorks = false; }
  }

  setPaused(on) {
    if (!this.running) return;
    this.paused = on;
    this.dom.pause.style.display = on ? 'flex' : 'none';
    this.dom.crosshair.style.display = on ? 'none' : 'block';
    if (on) {
      this.keys.clear();
      this.dragLook = false;
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      this.requestLock();
    }
    const info = this.dom.pauseInfo;
    if (on && info) {
      info.textContent = this.testMode
        ? 'testing "' + this.map.name + '"'
        : (this.lobby ? this.lobby.describe() + (this.lobby.code ? ' — share the code' : '') : '');
    }
  }

  unbindInput() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.dom.pauseResume.onclick = null;
    this.dom.pauseLeave.onclick = null;
  }

  // camera forward/right on the ground plane
  camBasis() {
    const yaw = this.view.cam.yaw;
    return {
      fx: Math.sin(yaw), fz: Math.cos(yaw),
      rx: Math.cos(yaw), rz: -Math.sin(yaw),
    };
  }

  // the direction the player is looking, as a unit vector
  lookDir() {
    const c = this.view.camera;
    const v = new THREE.Vector3();
    c.getWorldDirection(v);
    return v;
  }

  // ---------------------------------------------------------- actions
  interact() {
    const p = this.me;
    if (p.dead || p.frozen) return;

    if (p.pongSide) { this.act({ k: 'pongleave' }); p.pongSide = null; return; }

    // the pong table wins over everything else nearby
    if (this.pong) {
      const side = this.pong.nearStation(p.x, p.z);
      if (side != null && Math.abs(p.y - this.pong.baseY) < 6) {
        if (p.holding && p.holding.kind === 'box') this.dropHeld();
        p.holding = null;
        this.act({ k: 'pongjoin' });
        return;
      }
    }

    if (p.holding) return;

    // nearest liftable thing
    let best = null, bestD = 3.4;
    for (const ent of this.ents) {
      if (ent.gone || !ent.physical || ent.heldBy || !ent.visible) continue;
      const d = dist3(ent.x, ent.y + ent.size.y / 2, ent.z, p.x, p.y + 1.6, p.z);
      if (d < bestD) { best = ent; bestD = d; }
    }
    if (best) {
      p.holding = { kind: 'box', id: best.id };
      best.heldBy = p.id;
      playSound('pickup');
      if (best.synced) this.act({ k: 'pickup', id: best.id });
      return;
    }

    // a blaster stand
    for (const [standId, st] of this.stands) {
      const ent = this.entById(standId);
      if (!ent || !st.armed) continue;
      if (distXZ(ent.x, ent.z, p.x, p.z) < 3.6 && Math.abs(ent.y - p.y) < 5) {
        p.holding = { kind: 'blaster' };
        st.armed = false;
        playSound('pickup');
        this.act({ k: 'grabblaster', id: standId });
        return;
      }
    }

    // clicked-object fallback: E also pokes a scripted object you're standing in
    for (const ent of this.ents) {
      if (!ent.scriptInst || ent.gone || !ent.visible) continue;
      if (aabbOverlap(entAABB(ent), bodyAABB(p), 0.6)) { ent.scriptInst.trigger('clicked'); return; }
    }
  }

  dropHeld() {
    const p = this.me;
    if (!p.holding) return;
    if (p.holding.kind === 'box') {
      const ent = this.entById(p.holding.id);
      if (ent) {
        ent.heldBy = null;
        ent.vx = p.vx * 0.4; ent.vz = p.vz * 0.4; ent.vy = 0;
        if (ent.synced) this.act({ k: 'throw', id: ent.id, vx: ent.vx, vy: 0, vz: ent.vz });
      }
    }
    p.holding = null;
    playSound('thud');
  }

  primary() {
    const p = this.me;
    if (p.dead || p.frozen) return;

    if (p.pongSide) {
      p.rig.swingPaddle();
      playSound('tock');
      const d = this.lookDir();
      this.act({ k: 'swing', dx: d.x, dz: d.z });
      return;
    }

    if (p.holding && p.holding.kind === 'box') {
      const ent = this.entById(p.holding.id);
      const d = this.lookDir();
      const vx = d.x * THROW_SPEED + p.vx * 0.4;
      const vy = d.y * THROW_SPEED + 3.2;
      const vz = d.z * THROW_SPEED + p.vz * 0.4;
      if (ent) {
        ent.heldBy = null;
        ent.vx = vx; ent.vy = vy; ent.vz = vz;
        ent.thrownBy = p.id; ent.thrownT = this.time;
        if (ent.synced) this.act({ k: 'throw', id: ent.id, vx, vy, vz });
      }
      p.holding = null;
      playSound('whoosh');
      return;
    }

    if (p.holding && p.holding.kind === 'blaster') {
      if (this.shootCool > 0) return;
      this.shootCool = SHOOT_COOLDOWN;
      const d = this.lookDir();
      const muzzle = new THREE.Vector3(p.x, p.y + 2.5, p.z).addScaledVector(d, 1.1);
      p.rig.kick();
      playSound('blast');
      const bolt = {
        id: uid(), owner: p.id, life: BOLT_LIFE,
        x: muzzle.x, y: muzzle.y, z: muzzle.z,
        vx: d.x * BOLT_SPEED, vy: d.y * BOLT_SPEED, vz: d.z * BOLT_SPEED,
      };
      if (this.isAuthority()) this.addBolt(bolt);
      else {
        this.addBolt(bolt, true);
        this.act({ k: 'shoot', x: muzzle.x, y: muzzle.y, z: muzzle.z, dx: d.x, dy: d.y, dz: d.z });
      }
      return;
    }

    // shooting nothing: click to poke whatever you're looking at
    this.clickRay();
  }

  clickRay() {
    const cam = this.view.camera;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);
    this.raycaster.far = 40;
    const targets = [];
    for (const ent of this.ents) {
      if (ent.gone || !ent.scriptInst || !ent.visible || !ent.mesh) continue;
      targets.push(ent.mesh);
    }
    const hits = this.raycaster.intersectObjects(targets, true);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj && !obj.userData.entId) obj = obj.parent;
    const ent = obj ? this.entById(obj.userData.entId) : null;
    if (ent && ent.scriptInst) ent.scriptInst.trigger('clicked');
  }

  entById(id) {
    for (const e of this.ents) if (e.id === id && !e.gone) return e;
    return null;
  }

  isAuthority() { return !this.lobby || this.lobby.isHost; }

  act(a) {
    if (this.isAuthority()) this.applyAct(this.me.id, a);
    else if (this.lobby) this.lobby.send({ t: 'act', a });
  }

  addBolt(bolt, mine) {
    const list = mine ? this.myBolts : this.bolts;
    const owned = list.filter(b => b.owner === bolt.owner).length;
    if (owned >= MAX_BOLTS_PER_PLAYER) return;
    bolt.mesh = makeBolt();
    bolt.mesh.position.set(bolt.x, bolt.y, bolt.z);
    this.view.scene.add(bolt.mesh);
    list.push(bolt);
  }

  killBolt(b, list) {
    if (b.mesh) {
      this.view.scene.remove(b.mesh);
      b.mesh.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
      b.mesh = null;
    }
    b.life = 0;
    // scripts still get to see it this frame, so `when hit` fires on solid things
    this.deadBolts.push({ id: b.id, x: b.x, y: b.y, z: b.z, owner: b.owner });
  }

  // ---------------------------------------------------------- authority
  applyAct(pid, a) {
    const player = this.players.get(pid);
    if (!player || !a || typeof a !== 'object') return;
    switch (a.k) {
      case 'pickup': {
        const ent = this.entById(a.id);
        if (ent && ent.physical && ent.synced && (!ent.heldBy || ent.heldBy === pid)) ent.heldBy = pid;
        break;
      }
      case 'throw': {
        const ent = this.entById(a.id);
        if (ent && ent.heldBy === pid) {
          ent.heldBy = null;
          ent.vx = clamp(+a.vx || 0, -60, 60);
          ent.vy = clamp(+a.vy || 0, -60, 60);
          ent.vz = clamp(+a.vz || 0, -60, 60);
          ent.thrownBy = pid;
          ent.thrownT = this.time;
        }
        break;
      }
      case 'grabblaster': {
        const st = this.stands.get(a.id);
        if (st && st.armed) { st.armed = false; st.t = 14; }
        break;
      }
      case 'shoot': {
        if (!player.shootAt) player.shootAt = 0;
        if (this.time - player.shootAt < SHOOT_COOLDOWN * 0.8) break;   // rate limit
        player.shootAt = this.time;
        const dx = +a.dx || 0, dy = +a.dy || 0, dz = +a.dz || 0;
        const len = Math.hypot(dx, dy, dz) || 1;
        // the origin must be near the shooter — no shooting from across the map
        let x = +a.x || player.x, y = +a.y || player.y + 2.5, z = +a.z || player.z;
        if (dist3(x, y, z, player.x, player.y + 2, player.z) > 4) {
          x = player.x; y = player.y + 2.5; z = player.z;
        }
        this.addBolt({
          id: uid(), owner: pid, life: BOLT_LIFE, x, y, z,
          vx: dx / len * BOLT_SPEED, vy: dy / len * BOLT_SPEED, vz: dz / len * BOLT_SPEED,
        });
        break;
      }
      case 'pongjoin': {
        if (!this.pong) break;
        const side = this.pong.join(pid, player.x, player.z);
        if (side && pid === this.me.id) this.me.pongSide = side;
        break;
      }
      case 'pongleave': if (this.pong) this.pong.leave(pid); break;
      case 'selfpop': {
        // a client fell in the lava or off the world; the host still owns the event
        if (!player.dead) this.hostPop(pid, null, player.x, player.y + 1.4, player.z);
        break;
      }
      case 'swing': {
        if (!this.pong) break;
        const dir = { x: +a.dx || 0, z: +a.dz || 0 };
        if (this.pong.swing(pid, dir)) playSound('tock');
        break;
      }
    }
  }

  hostPop(victimId, byId, x, y, z) {
    const ev = { t: 'ev', k: 'pop', id: victimId, by: byId, x, y, z };
    if (this.lobby && this.lobby.isHost) this.lobby.broadcast(ev);
    this.applyPop(ev);
  }

  applyPop(ev) {
    const x = +ev.x || 0, y = +ev.y || 0, z = +ev.z || 0;
    playSound('bigpop');
    this.view.shake(0.25);
    this.bursts.push(new BoxBurst(this.view.scene, x, y, z));
    if (ev.by === this.me.id && ev.id !== this.me.id) this.pops++;
    const p = this.players.get(ev.id);
    if (!p) return;
    p.dead = true;
    p.rig.root.visible = false;
    clearBubbles(p);
    if (p === this.me) {
      p.deadT = RESPAWN_T;
      this.deaths++;
      this.releaseHeld(p);
      if (p.pongSide) { this.act({ k: 'pongleave' }); p.pongSide = null; }
    }
  }

  // ---------------------------------------------------------- lobby glue
  attachLobby(lobby) {
    lobby.attach({
      onMessage: (from, msg) => this.onNet(from, msg),
      onJoin: ({ id, name }) => this.onPeerJoin(id, name),
      onLeave: (id) => this.onPeerLeave(id),
      onHostLost: () => this.onHostLost(),
      onStatus: (txt) => this.toast(txt),
    });
  }

  onPeerJoin(id, name) {
    if (!this.players.has(id)) this.players.set(id, this.makePlayer(id, name, true));
    this.toast((name || 'someone') + ' joined');
    playSound('ding');
  }

  onPeerLeave(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.toast(p.name + ' left');
    for (const ent of this.ents) if (ent.heldBy === id) ent.heldBy = null;
    if (this.pong) this.pong.leave(id);
    this.bolts = this.bolts.filter(b => {
      if (b.owner !== id) return true;
      this.killBolt(b, this.bolts);
      return false;
    });
    this.removePlayer(p);
    this.players.delete(id);
  }

  async onHostLost() {
    if (this.migrating || !this.running) return;
    this.migrating = true;
    const old = this.lobby;
    this.lobby = null;                    // play on alone during the gap
    try { old.close(); } catch (e) {}

    const fresh = await migrate(old, this.myName, (s) => this.toast(s));
    if (!this.running) { fresh.close(); return; }

    // everyone else is gone until the new lobby says otherwise
    for (const [id, p] of [...this.players]) {
      if (id === this.me.id) continue;
      this.removePlayer(p);
      this.players.delete(id);
    }
    // our id changes, so drop every id-keyed attachment from the old world:
    // otherwise the dead host's held box and pong seat follow the new host
    const heldId = this.me.holding && this.me.holding.kind === 'box' ? this.me.holding.id : null;
    for (const ent of this.ents) ent.heldBy = (heldId && ent.id === heldId) ? fresh.myId : null;
    if (this.pong) {
      const wasPlaying = !!this.me.pongSide;
      this.pong.reset();
      this.me.pongSide = null;
      if (wasPlaying) this.toast('the pong table was reset');
    }
    for (const b of [...this.bolts]) this.killBolt(b, this.bolts);
    this.bolts.length = 0;

    this.players.delete(this.me.id);
    this.me.id = fresh.myId;
    this.players.set(this.me.id, this.me);
    this.lobby = fresh;
    if (fresh.isHost) {
      fresh.getWelcome = () => ({ map: this.mapIsMain ? null : this.map, snap: this.makeSnap() });
    }
    this.attachLobby(fresh);
    for (const [id, name] of fresh.names) {
      if (id !== this.me.id && !this.players.has(id)) this.players.set(id, this.makePlayer(id, name, true));
    }
    const w = fresh.welcome;
    if (w && w.snap) this.applySnap(w.snap, true);
    this.toast(fresh.offline ? 'playing solo' : 'reconnected · ' + fresh.describe());
    this.migrating = false;
  }

  onNet(from, msg) {
    const host = this.lobby && this.lobby.isHost;
    switch (msg.t) {
      case 'st': {
        if (!host) return;
        const p = this.players.get(from);
        if (p) this.readState(p, msg);
        break;
      }
      case 'snap': if (this.lobby && !host) this.applySnap(msg); break;
      case 'chat': {
        // the host stamps the real sender, so nobody can talk as someone else
        const senderId = host ? from : (typeof msg.id === 'string' ? msg.id : null);
        const text = String(msg.text || '').slice(0, 140);
        if (!senderId || !text) return;
        const p = this.players.get(senderId);
        if (p) { addBubble(p, text); playSound('pip'); }
        if (host) this.lobby.broadcast({ t: 'chat', id: senderId, text }, senderId);
        break;
      }
      case 'act': if (host) this.applyAct(from, msg.a); break;
      case 'ev': {
        // deaths are the host's call only — a client saying "you died" is ignored
        if (host || !this.lobby) return;
        if (msg.k === 'pop') this.applyPop(msg);
        break;
      }
      case 'bs': {
        const m = String(msg.msg || '').slice(0, 64);
        if (!m) return;
        this.pendingMsgs.push(m);
        if (host) this.lobby.broadcast({ t: 'bs', msg: m }, from);
        break;
      }
    }
  }

  sendChat(text) {
    addBubble(this.me, text);
    if (!this.lobby || this.lobby.offline) return;
    const msg = { t: 'chat', id: this.me.id, text };
    if (this.lobby.isHost) this.lobby.broadcast(msg);
    else this.lobby.send(msg);
  }

  readState(p, s) {
    if (!s || typeof s !== 'object') return;
    p.tx = clampNum(s.x); p.ty = clampNum(s.y); p.tz = clampNum(s.z);
    p.hasTarget = true;
    p.tyaw = clampNum(s.a);
    p.speed = clamp(+s.sp || 0, 0, 30);
    p.pitch = clamp(+s.p || 0, -1.4, 1.4);
    p.dead = !!s.dd;
    p.onGround = !!s.g;
    p.pongSide = s.ps === 'L' || s.ps === 'R' ? s.ps : null;
    if (s.sw) p.rig.swingPaddle();
    if (s.h == null) p.holding = null;
    else if (s.h === 'g') p.holding = { kind: 'blaster' };
    else p.holding = { kind: 'box', id: String(s.h).slice(0, 20) };
    p.rig.root.visible = !p.dead;
  }

  myState() {
    const p = this.me;
    return {
      t: 'st',
      x: r2(p.x), y: r2(p.y), z: r2(p.z),
      a: r2(p.yaw), p: r2(p.pitch), sp: Math.round(p.speed),
      dd: p.dead ? 1 : 0, g: p.onGround ? 1 : 0,
      ps: p.pongSide, sw: p.rig.swing > 0.15 ? 1 : 0,
      h: p.holding ? (p.holding.kind === 'blaster' ? 'g' : p.holding.id) : null,
    };
  }

  makeSnap() {
    const players = {};
    for (const [id, p] of this.players) {
      players[id] = {
        x: r2(p.x), y: r2(p.y), z: r2(p.z), a: r2(p.yaw), p: r2(p.pitch),
        sp: Math.round(p.speed), dd: p.dead ? 1 : 0, g: p.onGround ? 1 : 0,
        ps: p.pongSide, sw: 0,
        h: p.holding ? (p.holding.kind === 'blaster' ? 'g' : p.holding.id) : null,
        nm: p.name,
      };
    }
    const obj = [];
    for (const ent of this.ents) {
      if (!ent.synced || ent.gone) continue;
      obj.push([ent.id, r2(ent.x), r2(ent.y), r2(ent.z), r2(ent.yaw), ent.heldBy]);
    }
    const stands = {};
    for (const [id, st] of this.stands) stands[id] = st.armed ? 1 : 0;
    return {
      t: 'snap', seq: this.seq++,
      players, obj, stands,
      bolts: this.bolts.map(b => [b.id, r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vy), r2(b.vz), b.owner]),
      pong: this.pong ? this.pong.snapshot() : null,
    };
  }

  applySnap(s, immediate) {
    if (!s || typeof s !== 'object') return;
    const ps = s.players && typeof s.players === 'object' ? s.players : {};
    let count = 0;
    for (const id of Object.keys(ps)) {
      if (++count > 16) break;                       // never trust an unbounded roster
      if (!/^[\w-]{1,64}$/.test(id)) continue;
      const st = ps[id];
      if (!st || typeof st !== 'object') continue;
      if (id === this.me.id) {
        this.me.pongSide = st.ps === 'L' || st.ps === 'R' ? st.ps : null;
        continue;
      }
      let p = this.players.get(id);
      if (!p) {
        if (this.players.size > 16) continue;
        p = this.makePlayer(id, String(st.nm || 'guest').slice(0, 16), true);
        this.players.set(id, p);
      }
      if (typeof st.nm === 'string') p.name = st.nm.slice(0, 16);
      this.readState(p, st);
      if (immediate) { p.x = p.tx; p.y = p.ty; p.z = p.tz; p.yaw = p.tyaw; }
    }

    for (const row of Array.isArray(s.obj) ? s.obj.slice(0, 900) : []) {
      if (!Array.isArray(row) || row.length < 5) continue;
      const ent = this.entById(String(row[0]));
      if (!ent) continue;
      ent.heldBy = typeof row[5] === 'string' ? row[5] : null;
      if (ent.heldBy === this.me.id) continue;        // I place what I carry
      ent.ntx = +row[1] || 0; ent.nty = +row[2] || 0; ent.ntz = +row[3] || 0;
      ent.ntyaw = +row[4] || 0;
      ent.hasTarget = true;
      if (immediate || dist3(ent.x, ent.y, ent.z, ent.ntx, ent.nty, ent.ntz) > 14) {
        ent.x = ent.ntx; ent.y = ent.nty; ent.z = ent.ntz; ent.yaw = ent.ntyaw;
      }
    }

    const seen = new Set();
    for (const row of Array.isArray(s.bolts) ? s.bolts.slice(0, 64) : []) {
      if (!Array.isArray(row) || row.length < 8) continue;
      const id = String(row[0]);
      if (row[7] === this.me.id) continue;            // my own bolts are mine to fly
      seen.add(id);
      let b = this.bolts.find(q => q.id === id);
      if (!b) {
        this.addBolt({
          id, owner: String(row[7] || ''), life: BOLT_LIFE,
          x: +row[1] || 0, y: +row[2] || 0, z: +row[3] || 0,
          vx: +row[4] || 0, vy: +row[5] || 0, vz: +row[6] || 0,
        });
      } else {
        b.x = +row[1] || 0; b.y = +row[2] || 0; b.z = +row[3] || 0;
        b.vx = +row[4] || 0; b.vy = +row[5] || 0; b.vz = +row[6] || 0;
      }
    }
    for (const b of this.bolts) if (!seen.has(b.id)) this.killBolt(b, this.bolts);
    this.bolts = this.bolts.filter(b => b.life > 0);

    const stands = s.stands && typeof s.stands === 'object' ? s.stands : {};
    for (const id of Object.keys(stands)) {
      const st = this.stands.get(id);
      if (st) st.armed = !!stands[id];
    }
    if (this.pong && s.pong) {
      this.pong.applySnapshot(s.pong);
      this.me.pongSide = this.pong.sideOf(this.me.id);
    }
  }

  netTick() {
    if (!this.running || !this.lobby || this.lobby.offline) return;
    if (this.lobby.isHost) this.lobby.broadcast(this.makeSnap());
    else this.lobby.send(this.myState());
  }

  // ---------------------------------------------------------- frame
  frame() {
    if (!this.running) return;
    const now = performance.now();
    // Real elapsed time, then simulate it in small fixed slices. Clamping dt on
    // its own would be simpler, but on a slow machine that makes the whole game
    // run in slow motion — substepping keeps physics stable AND keeps game time
    // tracking the clock.
    const real = Math.min(0.3, (now - this.last) / 1000);
    this.last = now;
    this.raf = requestAnimationFrame(() => this.frame());
    if (this.paused) { this.view.render(); return; }
    const steps = clamp(Math.ceil(real / (1 / 30)), 1, 9);
    const dt = real / steps;
    for (let i = 0; i < steps; i++) this.simulate(dt);
    this.render(real);
  }

  simulate(dt) {
    this.time += dt;
    if (this.shootCool > 0) this.shootCool -= dt;
    this.stepMe(dt);
    if (this.isAuthority()) this.stepAuthority(dt);
    this.stepEntities(dt);
    this.stepRemotes(dt);
    this.stepBolts(dt);
    this.stepScripts(dt);
    this.stepEffects(dt);
  }

  render(dt) {
    // world streaming and the look of the place you're standing in
    this.terrain.update(this.me.x, this.me.z, dt);
    const biome = this.world.biomeAt(this.me.x, this.me.z);
    const look = BIOMES[biome] || BIOMES.void;
    this.view.setBiomeLook(look.fog, look.accent === COLORS.lava ? 0xffe6d8 : 0xffffff);
    this.view.setFogRange(this.flatVoid ? 260 : 150, this.flatVoid ? 460 : 330);

    // camera + animation
    const target = new THREE.Vector3(this.me.x, this.me.y + 2.1, this.me.z);
    this.view.updateCamera(target, dt, this.world, {});
    this.updateAim();
    this.drawUI(dt);
    this.view.render();
  }

  stepMe(dt) {
    const p = this.me;

    if (p.dead) {
      p.deadT -= dt;
      p.rig.root.visible = false;
      if (p.deadT <= 0) {
        this.respawn();
        p.rig.root.visible = true;
      }
      return;
    }

    if (p.pongSide && this.pong) {
      const st = this.pong.station(p.pongSide);
      p.x = st.x; p.z = st.z;
      p.y = this.world.heightAt(st.x, st.z);
      p.vx = p.vy = p.vz = 0;
      p.speed = 0;
      p.onGround = true;
      p.yaw = Math.atan2(this.pong.cx - p.x, this.pong.cz - p.z);
      // step away to leave
      if (this.keys.has('a') || this.keys.has('d') || this.keys.has('w') || this.keys.has('s')) {
        this.act({ k: 'pongleave' });
        p.pongSide = null;
      }
      this.poseSelf(dt);
      return;
    }

    const typing = this.chat.open;
    const b = this.camBasis();
    let ix = 0, iz = 0;
    if (!p.frozen && !typing) {
      if (this.keys.has('w')) iz += 1;
      if (this.keys.has('s')) iz -= 1;
      if (this.keys.has('d')) ix += 1;
      if (this.keys.has('a')) ix -= 1;
    }
    const running = this.keys.has('shift');
    const speed = running ? PLAYER_RUN : PLAYER_SPEED;
    let wx = b.fx * iz + b.rx * ix;
    let wz = b.fz * iz + b.rz * ix;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }

    const accel = p.onGround ? 16 : 7;
    p.vx = lerp(p.vx, wx * speed, clamp(dt * accel, 0, 1));
    p.vz = lerp(p.vz, wz * speed, clamp(dt * accel, 0, 1));
    if (len > 0) p.yaw = approachAngle(p.yaw, Math.atan2(wx, wz), dt * 14);

    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    const wantJump = this.keys.has('space') || this.jumpBuffer > 0;
    if (!p.frozen && !typing && wantJump && p.onGround) {
      p.vy = PLAYER_JUMP;
      p.onGround = false;
      this.jumpBuffer = 0;
      playSound('jump');
    }

    const solids = collectSolids(this.ents, null, p, 22);
    stepBody(p, dt, solids, this.world, { friction: p.onGround ? 0 : 0, stepUp: 0.9 });
    p.speed = Math.hypot(p.vx, p.vz);
    if (p.justLanded) playSound('land');

    // footsteps
    this.stepT = (this.stepT || 0) + p.speed * dt;
    if (p.onGround && this.stepT > 1.9) { this.stepT = 0; playSound('step'); }

    // hazards: lava and falling out of the world
    if (this.world.isLava && this.world.isLava(p.x, p.y, p.z)) {
      this.selfPop('the lava');
      return;
    }
    if (p.y < -180) { this.selfPop('the void'); return; }

    this.poseSelf(dt);
  }

  poseSelf(dt) {
    const p = this.me;
    p.pitch = -this.view.cam.pitch;
    p.rig.root.position.set(p.x, p.y, p.z);
    p.rig.root.rotation.y = p.yaw;
    p.rig.update(dt, {
      speed: p.speed, onGround: p.onGround,
      holding: p.holding ? p.holding.kind : null,
      pong: !!p.pongSide, frozen: p.frozen,
      aimPitch: p.holding && p.holding.kind === 'blaster' ? this.view.cam.pitch * 0.8 : 0,
      groundY: this.world.heightAt(p.x, p.z),
    });
  }

  // dying to the world itself (no shooter): the host still owns the event
  selfPop(what) {
    const p = this.me;
    if (p.dead) return;
    if (this.isAuthority()) this.hostPop(p.id, null, p.x, p.y + 1.4, p.z);
    else {
      // tell the host; also pop locally so it feels instant
      if (this.lobby) this.lobby.send({ t: 'act', a: { k: 'selfpop' } });
      this.applyPop({ id: p.id, by: null, x: p.x, y: p.y + 1.4, z: p.z });
    }
    if (what) this.toast(what + ' got you');
  }

  stepAuthority(dt) {
    // stands refill
    for (const [, st] of this.stands) {
      if (st.armed) continue;
      st.t -= dt;
      if (st.t <= 0) st.armed = true;
    }

    // bolts: fly, hit things, pop people
    for (const b of this.bolts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.mesh) { b.mesh.position.set(b.x, b.y, b.z); b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz); }
      if (b.y < this.world.heightAt(b.x, b.z)) { this.killBolt(b, this.bolts); continue; }
      let stopped = false;
      for (const e of this.ents) {
        if (e.gone || !e.solid || !e.visible || e.heldBy) continue;
        if (pointInAABB(b.x, b.y, b.z, entAABB(e), 0.1)) { this.killBolt(b, this.bolts); stopped = true; break; }
      }
      if (stopped) continue;
      for (const [pid, p] of this.players) {
        if (pid === b.owner || p.dead || p.pongSide) continue;
        if (pointInAABB(b.x, b.y, b.z, bodyAABB(p), 0.35)) {
          this.killBolt(b, this.bolts);
          this.hostPop(pid, b.owner, p.x, p.y + 1.5, p.z);
          break;
        }
      }
      if (b.life <= 0) this.killBolt(b, this.bolts);
    }
    this.bolts = this.bolts.filter(b => b.life > 0);

    // shared boxes: physics + carrying + bonks
    for (const ent of this.ents) {
      if (!ent.synced || ent.gone) continue;
      if (ent.heldBy) {
        this.pinToHolder(ent);
        continue;
      }
      this.physicsEntity(ent, dt, 0.3);
      const speed = Math.hypot(ent.vx, ent.vy, ent.vz);
      if (speed > BONK_SPEED) {
        const bb = entAABB(ent);
        for (const [pid, p] of this.players) {
          if (p.dead || p.pongSide) continue;
          if (ent.thrownBy === pid && this.time - ent.thrownT < 0.4) continue;
          if (aabbOverlap(bb, bodyAABB(p), 0.1)) {
            ent.vx *= -0.3; ent.vz *= -0.3; ent.vy = 3;
            this.hostPop(pid, ent.thrownBy || null, p.x, p.y + 1.5, p.z);
            break;
          }
        }
      }
    }

    if (this.pong) this.pong.step(dt);
  }

  pinToHolder(ent) {
    const holder = this.players.get(ent.heldBy);
    if (!holder || holder.dead) { ent.heldBy = null; return; }
    ent.x = holder.x;
    ent.z = holder.z;
    ent.y = holder.y + PLAYER_H + 0.15;
    ent.vx = ent.vy = ent.vz = 0;
    ent.yaw = holder.yaw / DEG;
  }

  physicsEntity(ent, dt, bounce) {
    const body = {
      x: ent.x, y: ent.y, z: ent.z,
      vx: ent.vx, vy: ent.vy, vz: ent.vz,
      r: Math.max(ent.size.x, ent.size.z) / 2, h: ent.size.y,
      onGround: ent.onGround,
    };
    const solids = collectSolids(this.ents, ent, ent, 16);
    stepBody(body, dt, solids, this.world, { bounce, friction: 5, stepUp: 0 });
    ent.x = body.x; ent.y = body.y; ent.z = body.z;
    ent.vx = body.vx; ent.vy = body.vy; ent.vz = body.vz;
    ent.onGround = body.onGround;
  }

  stepEntities(dt) {
    let removed = false;
    for (const ent of this.ents) {
      if (ent.gone) { removed = true; continue; }
      if (ent.spin) ent.yaw = (ent.yaw + ent.spin * dt) % 360;
      if (ent.heldBy) {
        this.pinToHolder(ent);
      } else if (ent.synced) {
        if (!this.isAuthority() && ent.hasTarget) {
          const k = clamp(dt * 13, 0, 1);
          ent.x = lerp(ent.x, ent.ntx, k);
          ent.y = lerp(ent.y, ent.nty, k);
          ent.z = lerp(ent.z, ent.ntz, k);
          ent.yaw = lerp(ent.yaw, ent.ntyaw, k);
        }
      } else if (ent.physical) {
        this.physicsEntity(ent, dt, 0.25);
      }
      if (ent.lightObj) ent.lightObj.position.set(ent.x, ent.y + ent.size.y, ent.z);
      this.syncMesh(ent);
      updateBubbles(ent, dt);
    }
    if (removed) {
      const keep = [];
      for (const ent of this.ents) {
        if (ent.gone) this.removeEntity(ent);
        else keep.push(ent);
      }
      this.ents = keep;
    }
  }

  stepRemotes(dt) {
    for (const [, p] of this.players) {
      if (!p.remote) continue;
      if (p.hasTarget) {
        const far = dist3(p.x, p.y, p.z, p.tx, p.ty, p.tz) > 18;
        const k = clamp(dt * 13, 0, 1);
        p.x = far ? p.tx : lerp(p.x, p.tx, k);
        p.y = far ? p.ty : lerp(p.y, p.ty, k);
        p.z = far ? p.tz : lerp(p.z, p.tz, k);
        p.yaw = approachAngle(p.yaw, p.tyaw, dt * 12);
      }
      if (p.pongSide && this.pong) {
        const st = this.pong.station(p.pongSide);
        p.x = st.x; p.z = st.z;
        p.y = this.world.heightAt(st.x, st.z);
        p.yaw = Math.atan2(this.pong.cx - p.x, this.pong.cz - p.z);
      }
      p.rig.root.position.set(p.x, p.y, p.z);
      p.rig.root.rotation.y = p.yaw;
      p.rig.update(dt, {
        speed: p.speed, onGround: p.onGround,
        holding: p.holding ? p.holding.kind : null,
        pong: !!p.pongSide, aimPitch: p.pitch * 0.8,
        groundY: this.world.heightAt(p.x, p.z),
      });
      updateBubbles(p, dt);
    }
    updateBubbles(this.me, dt);
  }

  stepBolts(dt) {
    // my own bolts fly locally for instant feedback; the host decides the hits
    if (!this.isAuthority()) {
      for (const b of this.myBolts) {
        b.life -= dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (b.mesh) { b.mesh.position.set(b.x, b.y, b.z); b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz); }
        if (b.y < this.world.heightAt(b.x, b.z)) this.killBolt(b, this.myBolts);
      }
      this.myBolts = this.myBolts.filter(b => b.life > 0);
      for (const b of this.bolts) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (b.mesh) { b.mesh.position.set(b.x, b.y, b.z); b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz); }
      }
    }
  }

  stepScripts(dt) {
    if (this.pendingMsgs.length) {
      const msgs = this.pendingMsgs.splice(0, 40);
      for (const m of msgs) {
        for (const ent of this.ents) if (ent.scriptInst) ent.scriptInst.trigger('message', m);
      }
    }
    const meBox = bodyAABB(this.me);
    const flying = this.isAuthority() ? this.bolts : [...this.bolts, ...this.myBolts];
    const allBolts = this.deadBolts.length ? [...flying, ...this.deadBolts] : flying;
    for (const ent of this.ents) {
      if (!ent.scriptInst || ent.gone) continue;
      const touching = !this.me.dead && ent.visible && aabbOverlap(entAABB(ent), meBox, 0.3);
      if (touching && !ent.touchedLast) ent.scriptInst.trigger('touched');
      ent.touchedLast = touching;
      if (ent.visible && allBolts.length) {
        const bb = entAABB(ent);
        for (const b of allBolts) {
          if (ent.hitBolts.has(b.id)) continue;
          if (pointInAABB(b.x, b.y, b.z, bb, 0.35)) {
            ent.hitBolts.add(b.id);
            ent.scriptInst.trigger('hit');
          }
        }
        if (ent.hitBolts.size > 300) ent.hitBolts.clear();
      }
      ent.scriptInst.update(this.time);
    }
    this.deadBolts.length = 0;
  }

  stepEffects(dt) {
    this.bursts = this.bursts.filter(b => {
      if (b.update(dt, this.world)) return true;
      b.dispose();
      return false;
    });
    for (const t of this.toasts) t.t -= dt;
    if (this.toasts.some(t => t.t <= 0)) this.toasts = this.toasts.filter(t => t.t > 0);
    if (this.hintT > 0) this.hintT -= dt;
  }

  updateAim() {
    // where the camera ray meets the ground — this is `mouse x` / `mouse y`
    const d = this.lookDir();
    const cam = this.view.camera.position;
    if (Math.abs(d.y) > 0.001) {
      const gy = this.world.heightAt(this.me.x, this.me.z);
      const t = (gy - cam.y) / d.y;
      if (t > 0 && t < 400) {
        this.mouseAim.x = Math.round((cam.x + d.x * t) * 100) / 100;
        this.mouseAim.z = Math.round((cam.z + d.z * t) * 100) / 100;
      }
    }
  }

  // ---------------------------------------------------------- UI
  drawUI(dt) {
    // bubbles + name tags, projected from 3D
    const items = [];
    for (const [, p] of this.players) {
      if (p.dead) { this.bubbles.forget(p); continue; }
      const head = new THREE.Vector3(p.x, p.y + PLAYER_H + 0.5, p.z);
      items.push({
        actor: p, screen: this.view.project(head),
        mine: p === this.me, name: p === this.me ? '' : p.name,
      });
    }
    for (const ent of this.ents) {
      if (!ent.bubbles || !ent.bubbles.length) continue;
      const top = new THREE.Vector3(ent.x, ent.y + ent.size.y + 0.4, ent.z);
      items.push({ actor: ent, screen: this.view.project(top), mine: false, name: '' });
    }
    this.bubbles.layout(items);

    // HUD text
    const hud = this.dom.hud;
    const lines = [];
    if (this.testMode) lines.push('testing "' + this.map.name + '" — esc to stop');
    else if (this.lobby) {
      lines.push(this.lobby.describe() + ' · ' + this.players.size + (this.players.size === 1 ? ' player' : ' players'));
    }
    if (!this.flatVoid) {
      const b = this.world.biomeAt(this.me.x, this.me.z);
      const label = { void: 'the void', outer: 'the outer void', meadow: 'meadow', forest: 'forest', desert: 'dunes', snow: 'snowfield', volcano: 'volcano', ash: 'ash flats' }[b] || b;
      lines.push(label + '  ·  ' + Math.round(this.me.x) + ', ' + Math.round(this.me.z));
    }
    if (this.pops) lines.push('pops: ' + this.pops);
    const text = lines.join('\n');
    if (hud.textContent !== text) hud.textContent = text;

    // script writes
    const layer = this.dom.writes;
    const wanted = new Set();
    for (const [key, wr] of this.writes) {
      wanted.add(key);
      let el = this.writeEls.get(key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'bs-write';
        layer.appendChild(el);
        this.writeEls.set(key, el);
      }
      if (el.textContent !== wr.text) el.textContent = wr.text;
      el.style.left = clamp(wr.x, -20, 120) + '%';
      el.style.top = clamp(wr.y, -20, 120) + '%';
      el.style.fontSize = clamp(wr.size, 1, 30) * 4 + 'px';
    }
    for (const [key, el] of [...this.writeEls]) {
      if (!wanted.has(key)) { el.remove(); this.writeEls.delete(key); }
    }

    // hint + toasts
    const foot = this.dom.foot;
    let footText = '';
    if (this.hintT > 0 && !this.testMode) {
      footText = 'wasd move · shift run · space jump · e grab · click throw/blast · t chat · esc menu';
    }
    if (this.toasts.length) {
      footText = this.toasts.map(t => t.text).join('\n') + (footText ? '\n' + footText : '');
    }
    if (foot.textContent !== footText) foot.textContent = footText;

    // pong scoreboard
    const pongEl = this.dom.pongHud;
    if (this.pong && (this.pong.sides.L || this.pong.sides.R)) {
      const p = this.pong;
      pongEl.style.display = 'block';
      const txt = p.score.L + ' – ' + p.score.R + (p.msg ? '\n' + p.msg : '');
      if (pongEl.textContent !== txt) pongEl.textContent = txt;
    } else if (pongEl.style.display !== 'none') {
      pongEl.style.display = 'none';
    }

    // dead veil
    this.dom.veil.style.opacity = this.me.dead ? '0.55' : '0';
    this.dom.veil.textContent = this.me.dead ? 'you popped' : '';

    // the ball and the box-bot live in the scene; keep them in step
    this.syncPongVisuals();
  }

  syncPongVisuals() {
    const p = this.pong;
    if (!p) return;
    if (!this.ballMesh) {
      this.ballMesh = new THREE.Mesh(boxGeo(0.28, 0.28, 0.28), flatMat(COLORS.white));
      this.ballMesh.visible = false;
      this.view.scene.add(this.ballMesh);
    }
    if (p.ball) {
      this.ballMesh.visible = true;
      this.ballMesh.position.set(p.ball.x, p.ball.y, p.ball.z);
      this.ballMesh.rotation.x += 0.3;
      this.ballMesh.rotation.y += 0.2;
    } else this.ballMesh.visible = false;

    for (const side of ['L', 'R']) {
      const key = 'bot' + side;
      const isBot = p.sides[side] === 'bot';
      if (isBot && !this[key]) {
        const g = cardboardBox(1.5);
        const paddle = new THREE.Mesh(boxGeo(0.6, 0.66, 0.1), flatMat(COLORS.red));
        paddle.position.set(side === 'L' ? 0.9 : -0.9, 0.4, 0);
        g.add(paddle);
        const st = p.station(side);
        g.position.set(st.x, this.world.heightAt(st.x, st.z) + 0.75, st.z);
        this.view.scene.add(g);
        this[key] = g;
      } else if (!isBot && this[key]) {
        this.view.scene.remove(this[key]);
        this[key] = null;
      }
      if (this[key]) this[key].rotation.y = Math.sin(this.time * 2) * 0.2;
    }
  }

  // ---------------------------------------------------------- teardown
  exit() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearInterval(this.netTimer);
    this.unbindInput();
    this.chat.destroy();
    if (document.pointerLockElement) document.exitPointerLock();
    for (const [, b] of this.buttons) b.remove();
    this.buttons.clear();
    for (const [, el] of this.writeEls) el.remove();
    this.writeEls.clear();
    this.bubbles.clear();
    for (const ent of this.ents) this.removeEntity(ent);
    this.ents.length = 0;
    for (const [, p] of this.players) this.removePlayer(p);
    this.players.clear();
    for (const b of this.bursts) b.dispose();
    this.terrain.dispose();
    this.view.dispose();
    if (this.lobby) this.lobby.close();
    this.dom.pause.style.display = 'none';
    this.dom.crosshair.style.display = 'none';
    this.dom.veil.style.opacity = '0';
    this.dom.hud.textContent = '';
    this.dom.foot.textContent = '';
    this.dom.pongHud.style.display = 'none';
    if (this.dom.errPanel) this.dom.errPanel.style.display = 'none';
    this.onExit();
  }
}

// a bare white floor for maps with terrain switched off
class FlatGround {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.PlaneGeometry(1200, 1200, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, flatMat(0xf7f7f7));
    scene.add(this.mesh);
  }
  update() {}
  prime() {}
  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
  }
}

const r2 = (v) => Math.round((+v || 0) * 100) / 100;
function clampNum(v) { const n = +v; return Number.isFinite(n) ? clamp(n, -1e5, 1e5) : 0; }
