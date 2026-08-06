// game.js — a running play session (solo, host, or client).
//
// The host owns the truth for: box physics, blaster bolts, stand pickups,
// pong, and deaths. Each client owns its own player and sends state at 15Hz;
// the host relays a world snapshot at 15Hz.
//
// boxscript objects run locally on every client (each player experiences the
// map like their own copy of the game); `broadcast ... to everyone` crosses
// the network so map makers can sync the moments that matter.

import { clamp, lerp, dist, uid, rand, PAL, COLORS, playSound, pixelText } from './util.js';
import {
  GRAV, PLAYER_W, PLAYER_H, PLAYER_SPEED, PLAYER_JUMP, BOLT_SPEED, BOLT_LIFE,
  THROW_SPEED, BONK_SPEED, createEntity, entBox, entW, entH, boxesOverlap,
  pointInBox, stepBody, bodyBox, collectSolids, modelInfo, validateMap,
} from './world.js';
import { mainMap } from './maps.js';
import {
  Renderer, drawGround, drawStickman, drawEntity, drawBolt, drawBurstBox,
  drawCardboardBox, worldLabel,
} from './render.js';
import { compile, ScriptInstance } from './boxscript.js';
import { Chat, addBubble, updateBubbles, drawBubbles, drawNameTag } from './chat.js';
import { Pong } from './pong.js';
import { migrate } from './net.js';

const NET_HZ = 15;
const RESPAWN_T = 2.4;
const KEYMAP = {
  ' ': 'space', 'arrowup': 'up', 'arrowdown': 'down',
  'arrowleft': 'left', 'arrowright': 'right', 'enter': 'enter',
};

export class GameSession {
  constructor(opts) {
    this.renderer = opts.renderer;
    this.dom = opts.dom;
    this.lobby = opts.lobby;              // may be null for editor test
    this.testMode = !!opts.testMode;
    this.onExit = opts.onExit || (() => {});
    this.mapIsMain = !opts.map;
    this.map = opts.map ? validateMap(opts.map) : mainMap();
    this.myName = opts.myName || 'guest';

    this.time = 0;
    this.ents = [];
    this.players = new Map();
    this.bolts = [];                       // authoritative (host) or from snaps
    this.myBolts = [];                     // cosmetic instant bolts (client)
    this.bursts = [];
    this.stands = new Map();               // standEntId → {armed, t}
    this.shared = new Map();
    this.writes = new Map();
    this.buttons = new Map();
    this.pendingMsgs = [];
    this.errorLog = [];
    this.toasts = [];
    this.pops = 0;
    this.seq = 0;
    this.netAcc = 0;
    this.hintT = 14;
    this.running = true;
    this.migrating = false;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    this.spawnedCount = 0;

    this.buildWorld();

    const myId = this.lobby ? this.lobby.myId : 'me';
    this.me = this.makePlayer(myId, this.myName, false);
    this.players.set(myId, this.me);
    this.respawnMe(true);

    this.chat = new Chat(this.dom.chatBar, this.dom.chatInput, (text) => this.sendChat(text));

    if (this.lobby) {
      if (this.lobby.isHost) {
        this.lobby.getWelcome = () => ({
          map: this.mapIsMain ? null : this.map,
          snap: this.makeSnap(),
        });
      }
      this.lobby.attach({
        onMessage: (from, msg) => this.onNet(from, msg),
        onJoin: ({ id, name }) => this.onPeerJoin(id, name),
        onLeave: (id) => this.onPeerLeave(id),
        onHostLost: () => this.onHostLost(),
        onStatus: (txt) => this.toast(txt),
      });
      // players already in the lobby (client join): roster arrives via lobby.names
      for (const [id, name] of this.lobby.names) {
        if (id !== myId && !this.players.has(id)) this.players.set(id, this.makePlayer(id, name, true));
      }
      if (opts.snap) this.applySnap(opts.snap, true);
    }

    this.bindInput();
    this.startScripts();
    this.last = performance.now();
    this.raf = requestAnimationFrame(() => this.frame());
  }

  // ---------------------------------------------------------- world setup
  buildWorld() {
    this.ents = [];
    this.pong = null;
    for (const spec of this.map.objects) {
      const ent = createEntity(this.map, spec);
      const info = modelInfo(this.map, ent.model);
      const script = spec.script || (info.custom && info.custom.script) || null;
      ent.script = script;
      // host-synced: plain physical props with no behavior
      ent.synced = ent.physical && !script;
      this.ents.push(ent);
      if (ent.model === 'blasterstand') this.stands.set(ent.id, { armed: true, t: 0 });
      if (ent.model === 'pongtable' && !this.pong) {
        this.pong = new Pong(ent, this.map, this.map.groundY);
      }
    }
  }

  makePlayer(id, name, remote) {
    return {
      id, name: name || 'guest', remote,
      x: this.map.spawn.x, y: this.map.spawn.y - PLAYER_H / 2,
      vx: 0, vy: 0, w: PLAYER_W, h: PLAYER_H,
      face: 1, onGround: false, walkPhase: 0, idleT: rand(0, 5),
      holding: null,                // {kind:'box', id} | {kind:'blaster'}
      aim: 0, dead: false, deadT: 0,
      pongSide: null, swingT: 0, frozen: false,
      bubbles: [], tx: 0, ty: 0, hasTarget: false,
    };
  }

  respawnMe(first) {
    const p = this.me;
    p.x = this.map.spawn.x + (first ? 0 : rand(-8, 8));
    p.y = this.map.spawn.y - PLAYER_H / 2;
    p.vx = 0; p.vy = 0;
    p.dead = false; p.deadT = 0;
    p.holding = null; p.pongSide = null;
  }

  startScripts() {
    for (const ent of this.ents) this.initScript(ent);
    for (const ent of this.ents) if (ent.scriptInst) ent.scriptInst.start();
  }

  initScript(ent) {
    if (!ent.script) return;
    const res = compile(ent.script);
    if (!res.ok) {
      for (const e of res.errors.slice(0, 3)) {
        this.scriptError(ent, e.line, e.msg);
      }
      if (!this.testMode) return; // in play mode a broken script just does nothing
    }
    ent.scriptInst = new ScriptInstance(res.program, this.makeBindings(ent));
    ent.touchedLast = false;
    ent.hitBolts = new Set();
  }

  // boxscript user space: x = center-x, y = height of the BOTTOM above world 0.
  makeBindings(ent) {
    const S = this;
    const map = this.map;
    const entBottom = () => ent.y + entH(map, ent) / 2;
    return {
      getX: () => ent.x,
      getY: () => -entBottom(),
      setX: (v) => { ent.x = v; ent.vx = 0; },
      setY: (v) => { ent.y = -v - entH(map, ent) / 2; ent.vy = 0; },
      getSize: () => ent.scale,
      setSize: (v) => { ent.scale = clamp(v, 5, 1000); },
      getName: () => ent.model,
      move: (dx, dy) => { ent.x += dx; ent.y -= dy; },
      say: (text, secs) => addBubble(ent, text, clamp(secs, 0.5, 30)),
      write: (text, x, y, size, id) => {
        const key = id || (ent.id + '@' + Math.round(x) + ',' + Math.round(y));
        S.writes.set(key, { text, x, y, size: clamp(size, 1, 20) });
      },
      unwrite: (id) => {
        if (id === 'all') S.writes.clear();
        else S.writes.delete(id);
      },
      button: (label, x, y) => S.addButton(label, x, y),
      removeButton: (label) => S.removeButton(label),
      show: (v) => { ent.visible = v; },
      solid: (v) => { ent.solid = v; },
      color: (name) => { ent.color = COLORS[name] ? name : ent.color; },
      spawn: (model, x, y) => S.spawnFromScript(ent, model, x, y),
      vanish: () => { ent.gone = true; },
      push: (dx, dy) => {
        if (!ent.physical) ent.physical = true;
        ent.vx += dx; ent.vy -= dy;
      },
      teleportPlayer: (x, y) => {
        S.me.x = x; S.me.y = -y - PLAYER_H / 2;
        S.me.vx = 0; S.me.vy = 0;
      },
      freeze: (v) => { S.me.frozen = v; },
      shake: (amt) => S.renderer.shake(clamp(amt, 0, 3)),
      sound: (name) => playSound(name),
      broadcast: (msg, everyone) => S.broadcastBS(msg, everyone),
      playerX: () => S.me.x,
      playerY: () => -(S.me.y + PLAYER_H / 2),
      playerName: () => S.me.name,
      mouseX: () => S.mouse.x,
      mouseY: () => -S.mouse.y,
      keyDown: (name) => S.keys.has(name),
      touching: (what) => S.touchingWhat(ent, what),
      distanceToPlayer: () => dist(ent.x, ent.y, S.me.x, S.me.y),
      count: (model) => S.ents.filter(e => !e.gone && e.model === model).length,
      time: () => S.time,
      sharedGet: (n) => S.shared.get(n),
      sharedSet: (n, v) => S.shared.set(n, v),
      onError: (line, msg) => S.scriptError(ent, line, msg),
    };
  }

  touchingWhat(ent, what) {
    const b = entBox(this.map, ent);
    if (what === 'player') {
      return boxesOverlap(b, bodyBox(this.me), 2);
    }
    for (const e of this.ents) {
      if (e === ent || e.gone || e.model !== what) continue;
      if (boxesOverlap(b, entBox(this.map, e), 1)) return true;
    }
    return false;
  }

  spawnFromScript(src, model, x, y) {
    if (this.spawnedCount > 400) { this.scriptError(src, 0, 'too many spawned objects (400 max)'); return; }
    const info = modelInfo(this.map, model);
    if (info.missing) { this.scriptError(src, 0, `no model called "${model}"`); return; }
    const spec = {
      model, spawned: true,
      x: x != null ? x : src.x,
      y: y != null ? -y - (info.h / 2) : src.y,
      scale: 100,
    };
    const ent = createEntity(this.map, spec);
    ent.script = info.custom && info.custom.script || (model === src.model ? null : null);
    ent.synced = false;
    this.ents.push(ent);
    this.spawnedCount++;
    if (ent.script) { this.initScript(ent); if (ent.scriptInst) ent.scriptInst.start(); }
  }

  addButton(label, x, y) {
    if (this.buttons.has(label)) this.removeButton(label);
    const b = document.createElement('button');
    b.className = 'bs-btn';
    b.textContent = label;
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
    const label = ent.model + (ent.id ? ' (' + ent.id.slice(0, 4) + ')' : '');
    const text = `${label} line ${line}: ${msg}`;
    if (this.errorLog[this.errorLog.length - 1] !== text) {
      this.errorLog.push(text);
      if (this.errorLog.length > 30) this.errorLog.shift();
      if (this.testMode) this.updateErrorPanel();
    }
  }

  updateErrorPanel() {
    const el = this.dom.errPanel;
    if (!el) return;
    if (!this.errorLog.length) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.textContent = 'script issues:\n' + this.errorLog.slice(-6).join('\n');
  }

  toast(text) {
    this.toasts.push({ text, t: 4 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  // ---------------------------------------------------------- input
  bindInput() {
    this.onKeyDown = (e) => {
      if (!this.running) return;
      const tag = document.activeElement && document.activeElement.tagName;
      const typing = this.chat.open || tag === 'INPUT' || tag === 'TEXTAREA';
      const k = KEYMAP[e.key.toLowerCase()] || e.key.toLowerCase();
      if (typing) return;
      if (e.key === 'Enter' || e.key === 't' || e.key === 'T') {
        e.preventDefault();
        this.chat.openBar();
        return;
      }
      if (e.key === 'Escape') {
        this.exit();
        return;
      }
      if (!this.keys.has(k)) {
        this.keys.add(k);
        if (k === 'e') this.interact();
        if (k === 'q') this.dropHeld();
        for (const ent of this.ents) if (ent.scriptInst) ent.scriptInst.trigger('key', k);
      }
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase()) || e.key === ' ') e.preventDefault();
    };
    this.onKeyUp = (e) => {
      const k = KEYMAP[e.key.toLowerCase()] || e.key.toLowerCase();
      this.keys.delete(k);
    };
    this.onMouseMove = (e) => {
      this.mouse.sx = e.clientX; this.mouse.sy = e.clientY;
      const w = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.mouse.x = w.x; this.mouse.y = w.y;
    };
    this.onMouseDown = (e) => {
      if (!this.running || this.chat.open) return;
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT')) return;
      this.click();
    };
    this.onBlur = () => this.keys.clear();
    this.onResize = () => this.renderer.resize();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
  }

  unbindInput() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
  }

  // E — pick up box / grab blaster / join pong
  interact() {
    const p = this.me;
    if (p.dead || p.frozen) return;
    if (p.pongSide) { this.act({ kind: 'pongleave' }); p.pongSide = null; return; }
    // the pong table takes priority: you put down whatever you're carrying
    if (this.pong) {
      for (const side of ['L', 'R']) {
        if (Math.abs(p.x - this.pong.stationX(side)) < 24 &&
            Math.abs((p.y + PLAYER_H / 2) - this.pong.groundY) < 30) {
          if (p.holding && p.holding.kind === 'box') this.dropHeld();
          p.holding = null;
          this.act({ kind: 'pongjoin' });
          return;
        }
      }
    }
    if (!p.holding) {
      // nearest loose physical thing (boxes, custom physical models…)
      let best = null, bestD = 26;
      for (const ent of this.ents) {
        if (ent.gone || !ent.physical || ent.heldBy || !ent.visible) continue;
        const d = dist(ent.x, ent.y, p.x, p.y);
        if (d < bestD) { best = ent; bestD = d; }
      }
      if (best) {
        p.holding = { kind: 'box', id: best.id };
        best.heldBy = p.id;
        playSound('pickup');
        // scripted objects are per-player copies — only synced ones go to the host
        if (best.synced) this.act({ kind: 'pickup', id: best.id });
        return;
      }
      // blaster stand
      for (const [standId, st] of this.stands) {
        const ent = this.entById(standId);
        if (!ent || !st.armed) continue;
        if (dist(ent.x, ent.y, p.x, p.y) < 26) {
          p.holding = { kind: 'blaster' };
          st.armed = false;
          playSound('pickup');
          this.act({ kind: 'grabblaster', id: standId });
          return;
        }
      }
    }
  }

  dropHeld() {
    const p = this.me;
    if (!p.holding) return;
    if (p.holding.kind === 'box') {
      const ent = this.entById(p.holding.id);
      if (ent) { ent.heldBy = null; ent.vx = p.vx; ent.vy = -40; }
      if (ent && ent.synced) this.act({ kind: 'throw', id: ent.id, vx: p.vx, vy: -40 });
    } else if (p.holding.kind === 'blaster') {
      this.act({ kind: 'dropblaster' });
    }
    p.holding = null;
  }

  click() {
    const p = this.me;
    if (p.dead || p.frozen) return;
    if (p.pongSide) {
      p.swingT = 0.18;
      playSound('tock');
      this.act({ kind: 'swing' });
      return;
    }
    if (p.holding && p.holding.kind === 'box') {
      const ent = this.entById(p.holding.id);
      const a = Math.atan2(this.mouse.y - (p.y - 16), this.mouse.x - p.x);
      const vx = Math.cos(a) * THROW_SPEED + p.vx * 0.5;
      const vy = Math.sin(a) * THROW_SPEED - 60;
      if (ent) {
        ent.heldBy = null; ent.vx = vx; ent.vy = vy;
        ent.thrownBy = p.id; ent.thrownT = this.time;
      }
      p.holding = null;
      playSound('thud');
      if (ent && ent.synced) this.act({ kind: 'throw', id: ent.id, vx, vy });
      return;
    }
    if (p.holding && p.holding.kind === 'blaster') {
      const a = p.aim;
      const sx = p.x + Math.cos(a) * 10, sy = p.y - 3 + Math.sin(a) * 10;
      const bolt = { id: uid(), x: sx, y: sy, vx: Math.cos(a) * BOLT_SPEED, vy: Math.sin(a) * BOLT_SPEED, owner: p.id, life: BOLT_LIFE };
      playSound('blast');
      if (this.isAuthority()) this.bolts.push(bolt);
      else { this.myBolts.push(bolt); this.act({ kind: 'shoot', x: sx, y: sy, a }); }
      return;
    }
    // clicked a scripted object?
    for (let i = this.ents.length - 1; i >= 0; i--) {
      const ent = this.ents[i];
      if (ent.gone || !ent.scriptInst || !ent.visible) continue;
      if (pointInBox(this.mouse.x, this.mouse.y, entBox(this.map, ent), 2)) {
        ent.scriptInst.trigger('clicked');
        return;
      }
    }
  }

  entById(id) { return this.ents.find(e => e.id === id && !e.gone); }
  isAuthority() { return !this.lobby || this.lobby.isHost; }

  // send an action to the authority (or apply directly if we are it)
  act(a) {
    if (this.isAuthority()) this.applyAct(this.me.id, a);
    else this.lobby.send({ t: 'act', a });
  }

  // ---------------------------------------------------------- authority
  applyAct(pid, a) {
    const player = this.players.get(pid);
    if (!player || !a) return;
    switch (a.kind) {
      case 'pickup': {
        const ent = this.entById(a.id);
        if (ent && ent.physical && (!ent.heldBy || ent.heldBy === pid)) ent.heldBy = pid;
        break;
      }
      case 'throw': {
        const ent = this.entById(a.id);
        if (ent && ent.heldBy === pid) {
          ent.heldBy = null;
          ent.vx = clamp(+a.vx || 0, -600, 600);
          ent.vy = clamp(+a.vy || 0, -600, 600);
          ent.thrownBy = pid; ent.thrownT = this.time;
        }
        break;
      }
      case 'grabblaster': {
        const st = this.stands.get(a.id);
        if (st && st.armed) { st.armed = false; st.t = 12; }
        break;
      }
      case 'dropblaster': break; // holding state arrives via player state
      case 'shoot': {
        const angle = +a.a || 0;
        this.bolts.push({
          id: uid(), x: +a.x || player.x, y: +a.y || player.y,
          vx: Math.cos(angle) * BOLT_SPEED, vy: Math.sin(angle) * BOLT_SPEED,
          owner: pid, life: BOLT_LIFE,
        });
        break;
      }
      case 'pongjoin': {
        if (this.pong) {
          const side = this.pong.join(pid, player.x);
          if (side && pid === this.me.id) this.me.pongSide = side;
        }
        break;
      }
      case 'pongleave': if (this.pong) this.pong.leave(pid); break;
      case 'swing': if (this.pong) { if (this.pong.swing(pid)) playSound('tock'); } break;
    }
  }

  // host: a player pops into cardboard
  hostPop(victimId, byId, x, y) {
    const ev = { t: 'ev', kind: 'pop', id: victimId, by: byId, x, y };
    if (this.lobby && this.lobby.isHost) this.lobby.broadcast(ev);
    this.applyPop(ev);
  }

  applyPop(ev) {
    const p = this.players.get(ev.id);
    playSound('bigpop');
    this.spawnBurst(ev.x, ev.y);
    if (ev.by === this.me.id && ev.id !== this.me.id) this.pops++;
    if (!p) return;
    p.dead = true;
    if (p === this.me) {
      p.deadT = RESPAWN_T;
      if (p.holding && p.holding.kind === 'box') {
        const ent = this.entById(p.holding.id);
        if (ent && ent.heldBy === p.id) ent.heldBy = null;
      }
      p.holding = null;
      if (p.pongSide) { this.act({ kind: 'pongleave' }); p.pongSide = null; }
    }
  }

  spawnBurst(x, y) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      this.bursts.push({
        x: x + rand(-4, 4), y: y + rand(-8, 4),
        vx: rand(-130, 130), vy: rand(-230, -40),
        rot: rand(0, Math.PI * 2), vrot: rand(-8, 8),
        size: rand(5, 11), life: rand(0.9, 1.6),
      });
    }
  }

  // ---------------------------------------------------------- networking
  onPeerJoin(id, name) {
    if (!this.players.has(id)) this.players.set(id, this.makePlayer(id, name, true));
    this.toast((name || 'someone') + ' joined');
    playSound('ding');
  }

  onPeerLeave(id) {
    const p = this.players.get(id);
    if (p) {
      this.toast(p.name + ' left');
      // free anything they held
      for (const ent of this.ents) if (ent.heldBy === id) ent.heldBy = null;
      if (this.pong) this.pong.leave(id);
      this.players.delete(id);
    }
  }

  async onHostLost() {
    if (this.migrating || !this.running) return;
    this.migrating = true;
    const oldLobby = this.lobby;
    this.lobby = null; // play solo during the gap
    try { oldLobby.close(); } catch (e) {}
    const newLobby = await migrate(oldLobby, this.myName, (s) => this.toast(s));
    if (!this.running) { newLobby.close(); return; }
    // drop remote players; fresh roster comes from the new lobby
    for (const [id] of this.players) if (id !== this.me.id) this.players.delete(id);
    const oldId = this.me.id;
    this.me.id = newLobby.myId;
    this.players.delete(oldId);
    this.players.set(this.me.id, this.me);
    this.lobby = newLobby;
    if (newLobby.isHost) {
      newLobby.getWelcome = () => ({ map: this.mapIsMain ? null : this.map, snap: this.makeSnap() });
    }
    newLobby.attach({
      onMessage: (from, msg) => this.onNet(from, msg),
      onJoin: ({ id, name }) => this.onPeerJoin(id, name),
      onLeave: (id) => this.onPeerLeave(id),
      onHostLost: () => this.onHostLost(),
      onStatus: (txt) => this.toast(txt),
    });
    for (const [id, name] of newLobby.names) {
      if (id !== this.me.id && !this.players.has(id)) this.players.set(id, this.makePlayer(id, name, true));
    }
    this.toast(newLobby.offline ? 'playing solo' : 'reconnected · ' + newLobby.describe());
    this.migrating = false;
  }

  onNet(from, msg) {
    switch (msg.t) {
      case 'st': {
        if (!this.lobby || !this.lobby.isHost) return;
        const p = this.players.get(from);
        if (!p) return;
        this.readPlayerState(p, msg);
        break;
      }
      case 'snap': if (this.lobby && !this.lobby.isHost) this.applySnap(msg); break;
      case 'chat': {
        // the host stamps the true sender — clients can't speak as someone else
        const senderId = (this.lobby && this.lobby.isHost) ? from : msg.id;
        const p = this.players.get(senderId);
        if (p) { addBubble(p, String(msg.text || '').slice(0, 120)); playSound('pip'); }
        if (this.lobby && this.lobby.isHost) {
          this.lobby.broadcast({ t: 'chat', id: senderId, text: String(msg.text || '').slice(0, 120) }, senderId);
        }
        break;
      }
      case 'act': if (this.lobby && this.lobby.isHost) this.applyAct(from, msg.a); break;
      case 'ev': if (msg.kind === 'pop') this.applyPop(msg); break;
      case 'bs': {
        const m = String(msg.msg || '').slice(0, 64);
        this.pendingMsgs.push(m);
        if (this.lobby && this.lobby.isHost) this.lobby.broadcast({ t: 'bs', msg: m }, from);
        break;
      }
    }
  }

  sendChat(text) {
    addBubble(this.me, text);
    if (this.lobby && !this.lobby.offline) {
      const msg = { t: 'chat', id: this.me.id, text };
      if (this.lobby.isHost) this.lobby.broadcast(msg);
      else this.lobby.send(msg);
    }
  }

  readPlayerState(p, s) {
    p.tx = +s.x || 0; p.ty = +s.y || 0; p.hasTarget = true;
    p.vx = +s.vx || 0;
    p.face = s.f >= 0 ? 1 : -1;
    p.aim = +s.a || 0;
    p.dead = !!s.dd;
    p.onGround = !!s.g;
    p.pongSide = s.ps || null;
    if (s.sw) p.swingT = 0.18;
    if (s.hold == null) p.holding = null;
    else if (s.hold === 'g') p.holding = { kind: 'blaster' };
    else p.holding = { kind: 'box', id: s.hold };
  }

  myState() {
    const p = this.me;
    return {
      t: 'st', x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
      vx: Math.round(p.vx), f: p.face, a: Math.round(p.aim * 100) / 100,
      dd: p.dead ? 1 : 0, g: p.onGround ? 1 : 0,
      ps: p.pongSide, sw: p.swingT > 0.1 ? 1 : 0,
      hold: p.holding ? (p.holding.kind === 'blaster' ? 'g' : p.holding.id) : null,
    };
  }

  makeSnap() {
    const players = {};
    for (const [id, p] of this.players) {
      players[id] = {
        x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
        vx: Math.round(p.vx), f: p.face, a: Math.round(p.aim * 100) / 100,
        dd: p.dead ? 1 : 0, g: p.onGround ? 1 : 0,
        ps: p.pongSide, sw: p.swingT > 0.1 ? 1 : 0,
        hold: p.holding ? (p.holding.kind === 'blaster' ? 'g' : p.holding.id) : null,
        nm: p.name,
      };
    }
    const obj = [];
    for (const ent of this.ents) {
      if (!ent.synced || ent.gone) continue;
      obj.push([ent.id, Math.round(ent.x * 10) / 10, Math.round(ent.y * 10) / 10, ent.heldBy]);
    }
    const stands = {};
    for (const [id, st] of this.stands) stands[id] = st.armed ? 1 : 0;
    return {
      t: 'snap', seq: this.seq++,
      players, obj,
      bolts: this.bolts.map(b => [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.owner]),
      stands,
      pong: this.pong ? this.pong.snapshot() : null,
    };
  }

  applySnap(s, immediate) {
    // players
    for (const [id, ps] of Object.entries(s.players || {})) {
      if (id === this.me.id) {
        // authority echo of me — only adopt pong side decisions
        this.me.pongSide = ps.ps || null;
        continue;
      }
      let p = this.players.get(id);
      if (!p) { p = this.makePlayer(id, ps.nm, true); this.players.set(id, p); }
      if (ps.nm) p.name = ps.nm;
      this.readPlayerState(p, ps);
      if (immediate) { p.x = p.tx; p.y = p.ty; }
    }
    // synced objects
    for (const [id, x, y, heldBy] of s.obj || []) {
      const ent = this.entById(id);
      if (!ent) continue;
      ent.heldBy = heldBy;
      if (heldBy === this.me.id) continue;      // I position what I carry
      ent.ntx = x; ent.nty = y; ent.hasTarget = true;
      if (immediate || Math.abs(ent.x - x) > 90 || Math.abs(ent.y - y) > 90) { ent.x = x; ent.y = y; }
    }
    // bolts (skip my own — I simulate those for instant feel)
    const seen = new Set();
    for (const [id, x, y, vx, vy, owner] of s.bolts || []) {
      if (owner === this.me.id) continue;
      seen.add(id);
      let b = this.bolts.find(q => q.id === id);
      if (!b) { b = { id, x, y, vx, vy, owner, life: BOLT_LIFE }; this.bolts.push(b); }
      else { b.ntx = x; b.nty = y; b.vx = vx; b.vy = vy; }
    }
    this.bolts = this.bolts.filter(b => seen.has(b.id));
    // stands
    for (const [id, armed] of Object.entries(s.stands || {})) {
      const st = this.stands.get(id);
      if (st) st.armed = !!armed;
    }
    if (this.pong && s.pong) {
      this.pong.applySnapshot(s.pong);
      this.me.pongSide = this.pong.sideOf(this.me.id);
    }
  }

  // ---------------------------------------------------------- frame loop
  frame() {
    if (!this.running) return;
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;

    this.stepMe(dt);
    if (this.isAuthority()) this.stepAuthority(dt);
    this.stepLocalPhysics(dt);
    this.smoothRemotes(dt);
    this.stepBoltsCosmetic(dt);
    this.stepScripts(dt);
    this.stepEffects(dt);
    this.netTick(dt);
    this.draw(dt);

    this.raf = requestAnimationFrame(() => this.frame());
  }

  stepMe(dt) {
    const p = this.me;
    p.idleT += dt;
    if (p.swingT > 0) p.swingT -= dt;

    if (p.dead) {
      p.deadT -= dt;
      if (p.deadT <= 0) this.respawnMe();
      return;
    }

    // pinned at the pong table
    if (p.pongSide && this.pong) {
      p.x = this.pong.stationX(p.pongSide);
      p.y = this.pong.groundY - PLAYER_H / 2;
      p.vx = 0; p.vy = 0; p.onGround = true;
      p.face = p.pongSide === 'L' ? 1 : -1;
      p.pong = true;
      if (this.keys.has('a') || this.keys.has('d') || this.keys.has('left') || this.keys.has('right')) {
        this.act({ kind: 'pongleave' });
        p.pongSide = null;
      }
      return;
    }
    p.pong = false;

    const typing = this.chat.open;
    let ax = 0;
    if (!p.frozen && !typing) {
      if (this.keys.has('a') || this.keys.has('left')) ax -= 1;
      if (this.keys.has('d') || this.keys.has('right')) ax += 1;
    }
    const target = ax * PLAYER_SPEED;
    p.vx = lerp(p.vx, target, Math.min(1, dt * 12));
    if (ax) p.face = ax > 0 ? 1 : -1;
    if (!p.frozen && !typing && (this.keys.has('w') || this.keys.has('up') || this.keys.has('space')) && p.onGround) {
      p.vy = -PLAYER_JUMP;
      playSound('boop');
    }

    const solids = collectSolids(this.map, this.ents.filter(e => !e.gone));
    stepBody(p, dt, solids, this.map.groundY, { friction: 0 });
    p.walkPhase += Math.abs(p.vx) * dt * 0.11;

    // aim at the mouse while armed
    if (p.holding && p.holding.kind === 'blaster') {
      p.aim = Math.atan2(this.mouse.y - (p.y - 3), this.mouse.x - p.x);
      p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    }

    // fell out of the world
    if (p.y > 2600) {
      this.spawnBurst(p.x, p.y - 40);
      playSound('bigpop');
      this.respawnMe();
    }
  }

  // host / solo: authoritative simulation
  stepAuthority(dt) {
    // stand refills
    for (const [, st] of this.stands) {
      if (!st.armed) {
        st.t -= dt;
        if (st.t <= 0) st.armed = true;
      }
    }
    // bolts
    const solids = collectSolids(this.map, this.ents.filter(e => !e.gone));
    for (const b of this.bolts) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const bb = { x0: b.x - 3, y0: b.y - 2, x1: b.x + 3, y1: b.y + 2 };
      for (const s of solids) if (boxesOverlap(bb, s)) { b.life = 0; break; }
      if (this.map.groundY != null && b.y > this.map.groundY) b.life = 0;
      if (b.life <= 0) continue;
      for (const [pid, p] of this.players) {
        if (pid === b.owner || p.dead || p.pongSide) continue;
        if (boxesOverlap(bb, bodyBox(p), 1)) {
          b.life = 0;
          this.hostPop(pid, b.owner, p.x, p.y);
          break;
        }
      }
    }
    this.bolts = this.bolts.filter(b => b.life > 0);

    // synced boxes: physics + carried pinning + bonks
    for (const ent of this.ents) {
      if (!ent.synced || ent.gone) continue;
      if (ent.heldBy) {
        const holder = this.players.get(ent.heldBy);
        if (holder && !holder.dead) {
          ent.x = holder.x;
          ent.y = holder.y - PLAYER_H / 2 - entH(this.map, ent) / 2 - 1;
          ent.vx = 0; ent.vy = 0;
        } else ent.heldBy = null;
        continue;
      }
      const body = { x: ent.x, y: ent.y, w: entW(this.map, ent), h: entH(this.map, ent), vx: ent.vx, vy: ent.vy };
      const others = collectSolids(this.map, this.ents.filter(e => !e.gone), ent);
      stepBody(body, dt, others, this.map.groundY, { bounce: 0.25, friction: 6 });
      ent.x = body.x; ent.y = body.y; ent.vx = body.vx; ent.vy = body.vy; ent.onGround = body.onGround;

      const speed = Math.hypot(ent.vx, ent.vy);
      if (speed > BONK_SPEED) {
        const bb = entBox(this.map, ent);
        for (const [pid, p] of this.players) {
          if (p.dead || p.pongSide) continue;
          if (ent.thrownBy === pid && this.time - ent.thrownT < 0.35) continue;
          if (boxesOverlap(bb, bodyBox(p), 0)) {
            ent.vx *= -0.3; ent.vy = -80;
            this.hostPop(pid, ent.thrownBy || pid, p.x, p.y);
            break;
          }
        }
      }
    }

    if (this.pong) this.pong.step(dt, true);
  }

  // both sides: local physics for script-spawned/scripted physical objects,
  // plus client-side pinning of whatever anyone is carrying
  stepLocalPhysics(dt) {
    for (const ent of this.ents) {
      if (ent.gone) continue;
      if (ent.heldBy) {
        const holder = this.players.get(ent.heldBy);
        if (holder && !holder.dead) {
          ent.x = holder.x;
          ent.y = holder.y - PLAYER_H / 2 - entH(this.map, ent) / 2 - 1;
          ent.vx = 0; ent.vy = 0;
        } else ent.heldBy = null;
        continue;
      }
      if (ent.synced) {
        if (!this.isAuthority()) {
          // ease toward host positions
          if (ent.hasTarget) {
            ent.x = lerp(ent.x, ent.ntx, Math.min(1, dt * 12));
            ent.y = lerp(ent.y, ent.nty, Math.min(1, dt * 12));
          }
        }
        continue;
      }
      if (ent.physical) {
        const body = { x: ent.x, y: ent.y, w: entW(this.map, ent), h: entH(this.map, ent), vx: ent.vx, vy: ent.vy };
        const others = collectSolids(this.map, this.ents.filter(e => !e.gone), ent);
        stepBody(body, dt, others, this.map.groundY, { bounce: 0.2, friction: 6 });
        ent.x = body.x; ent.y = body.y; ent.vx = body.vx; ent.vy = body.vy; ent.onGround = body.onGround;
      }
    }
    // sweep vanished entities
    for (const ent of this.ents) {
      if (ent.gone && ent.scriptInst) { ent.scriptInst.destroy(); ent.scriptInst = null; }
    }
    this.ents = this.ents.filter(e => !e.gone);
  }

  smoothRemotes(dt) {
    for (const [, p] of this.players) {
      if (!p.remote || !p.hasTarget) continue;
      if (Math.abs(p.x - p.tx) > 120 || Math.abs(p.y - p.ty) > 120) { p.x = p.tx; p.y = p.ty; }
      else {
        p.x = lerp(p.x, p.tx, Math.min(1, dt * 12));
        p.y = lerp(p.y, p.ty, Math.min(1, dt * 12));
      }
      p.walkPhase += Math.abs(p.vx) * dt * 0.11;
      p.idleT += dt;
      if (p.swingT > 0) p.swingT -= dt;
      p.pong = !!p.pongSide;
      if (p.pongSide && this.pong) {
        p.x = this.pong.stationX(p.pongSide);
        p.y = this.pong.groundY - PLAYER_H / 2;
        p.face = p.pongSide === 'L' ? 1 : -1;
        p.onGround = true;
      }
      updateBubbles(p, 0); // lifetimes advance in stepEffects; keep array tidy here
    }
  }

  // client: my own bolts (instant feedback) + remote bolt easing
  stepBoltsCosmetic(dt) {
    if (!this.isAuthority()) {
      const solids = collectSolids(this.map, this.ents.filter(e => !e.gone));
      for (const b of this.myBolts) {
        b.life -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const bb = { x0: b.x - 3, y0: b.y - 2, x1: b.x + 3, y1: b.y + 2 };
        for (const s of solids) if (boxesOverlap(bb, s)) { b.life = 0; break; }
        if (this.map.groundY != null && b.y > this.map.groundY) b.life = 0;
      }
      this.myBolts = this.myBolts.filter(b => b.life > 0);
      for (const b of this.bolts) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.ntx != null) {
          b.x = lerp(b.x, b.ntx, Math.min(1, dt * 10));
          b.y = lerp(b.y, b.nty, Math.min(1, dt * 10));
        }
      }
    }
  }

  stepScripts(dt) {
    // queued boxscript broadcasts
    if (this.pendingMsgs.length) {
      const msgs = this.pendingMsgs;
      this.pendingMsgs = [];
      for (const msg of msgs) {
        for (const ent of this.ents) if (ent.scriptInst) ent.scriptInst.trigger('message', msg);
      }
    }
    const myBox = bodyBox(this.me);
    const allBolts = this.isAuthority() ? this.bolts : [...this.bolts, ...this.myBolts];
    for (const ent of this.ents) {
      if (!ent.scriptInst) continue;
      // touched (edge)
      const touching = !this.me.dead && ent.visible && boxesOverlap(entBox(this.map, ent), myBox, 2);
      if (touching && !ent.touchedLast) ent.scriptInst.trigger('touched');
      ent.touchedLast = touching;
      // hit by bolts
      if (ent.visible) {
        const b0 = entBox(this.map, ent);
        for (const b of allBolts) {
          if (ent.hitBolts.has(b.id)) continue;
          if (pointInBox(b.x, b.y, b0, 2)) {
            ent.hitBolts.add(b.id);
            ent.scriptInst.trigger('hit');
          }
        }
        if (ent.hitBolts.size > 400) ent.hitBolts.clear(); // ids only matter for ~1.4s
      }
      ent.scriptInst.update(this.time);
    }
  }

  stepEffects(dt) {
    for (const b of this.bursts) {
      b.life -= dt;
      b.vy += GRAV * 0.8 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vrot * dt;
      if (this.map.groundY != null && b.y > this.map.groundY - b.size / 2) {
        b.y = this.map.groundY - b.size / 2;
        b.vy = -Math.abs(b.vy) * 0.4;
        b.vx *= 0.7;
      }
    }
    this.bursts = this.bursts.filter(b => b.life > 0);
    for (const [, p] of this.players) updateBubbles(p, dt);
    for (const ent of this.ents) updateBubbles(ent, dt);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter(t => t.t > 0);
    if (this.hintT > 0) this.hintT -= dt;
  }

  netTick(dt) {
    if (!this.lobby || this.lobby.offline) return;
    this.netAcc += dt;
    if (this.netAcc < 1 / NET_HZ) return;
    this.netAcc = 0;
    if (this.lobby.isHost) {
      this.lobby.broadcast(this.makeSnap());
    } else {
      this.lobby.send(this.myState());
    }
  }

  // ---------------------------------------------------------- drawing
  draw(dt) {
    const R = this.renderer;
    const p = this.me;
    R.cam.x = lerp(R.cam.x, p.x, Math.min(1, dt * 6));
    R.cam.y = lerp(R.cam.y, p.y - 14, Math.min(1, dt * 6));

    const c = R.begin(this.map.bg, dt);
    const view = R.viewBounds();
    drawGround(c, this.map.groundY, view);

    // entities (skip held boxes here; they draw pinned after players)
    for (const ent of this.ents) {
      if (ent.heldBy) continue;
      const armed = ent.model === 'blasterstand' ? (this.stands.get(ent.id) || {}).armed : false;
      drawEntity(c, this.map, ent, { armed });
    }

    // pong ball + score
    if (this.pong) {
      const pong = this.pong;
      if (pong.ball) {
        c.fillStyle = '#f4f4f4';
        c.beginPath(); c.arc(pong.ball.x, pong.ball.y, 2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#c9c9c9';
        c.fillRect(Math.round(pong.ball.x) - 1, Math.round(pong.ball.y) - 1, 1, 1);
      }
      if (pong.sides.L || pong.sides.R) {
        const midX = (pong.rect.x0 + pong.rect.x1) / 2;
        worldLabel(c, pong.score.L + ' - ' + pong.score.R, midX, pong.surfaceY - 34, 2, '#b5b5b5');
        if (pong.msg) worldLabel(c, pong.msg, midX, pong.surfaceY - 44, 1, '#c5c5c5');
        // box-bot
        for (const side of ['L', 'R']) {
          if (pong.sides[side] === 'bot') {
            const bx = pong.stationX(side);
            drawCardboardBox(c, bx - 7, pong.groundY - 14, 14, 14, null);
            const dir = side === 'L' ? 1 : -1;
            c.fillStyle = PAL.cardDark;
            c.fillRect(bx + dir * 6, pong.groundY - 16, dir * 3, 2);
            c.fillStyle = '#b55c5c';
            c.beginPath(); c.arc(bx + dir * 11, pong.groundY - 17, 3.5, 0, Math.PI * 2); c.fill();
          }
        }
      }
    }

    // players
    for (const [, pl] of this.players) {
      if (pl.dead) continue;
      pl.holdingKind = pl.holding ? pl.holding.kind : null;
      drawStickman(c, {
        x: pl.x, y: pl.y, vx: pl.vx, face: pl.face, walkPhase: pl.walkPhase,
        onGround: pl.onGround, holding: pl.holdingKind, aim: pl.aim,
        pong: pl.pong, swingT: pl.swingT, idleT: pl.idleT, frozen: pl.frozen,
      }, pl === this.me ? PAL.stickDark : PAL.stick);
    }

    // held boxes pinned overhead
    for (const ent of this.ents) {
      if (!ent.heldBy) continue;
      drawEntity(c, this.map, ent, {});
    }

    // bolts
    for (const b of this.bolts) drawBolt(c, b);
    for (const b of this.myBolts) drawBolt(c, b);

    // bursts
    for (const b of this.bursts) drawBurstBox(c, b);

    // spawn marker in test mode
    if (this.testMode) {
      c.fillStyle = 'rgba(120,180,120,0.5)';
      c.fillRect(this.map.spawn.x - 1, this.map.spawn.y - 10, 2, 10);
    }

    const o = R.end();

    // bubbles + names
    for (const [, pl] of this.players) {
      if (pl.dead) continue;
      const head = R.worldToScreen(pl.x, pl.y - 12);
      drawNameTag(o, pl === this.me ? '' : pl.name, { x: head.x, y: head.y - 4 }, false);
      drawBubbles(o, pl, head, pl === this.me);
    }
    for (const ent of this.ents) {
      if (!ent.bubbles || !ent.bubbles.length) continue;
      const top = R.worldToScreen(ent.x, ent.y - entH(this.map, ent) / 2);
      drawBubbles(o, ent, top, false);
    }

    this.drawUI(o, R);
  }

  drawUI(o, R) {
    // boxscript writes (percent coords, pixel font)
    for (const [, wr] of this.writes) {
      const px = wr.x / 100 * R.w, py = wr.y / 100 * R.h;
      const scale = Math.max(1, Math.round(wr.size / 100 * R.h / 6));
      const width = String(wr.text).length * 4 * scale;
      pixelText(o, wr.text, Math.round(px - width / 2), Math.round(py), scale, '#8a8a8a');
    }

    o.font = '12px ui-monospace, Menlo, Consolas, monospace';
    o.textBaseline = 'top';
    o.fillStyle = 'rgba(150,150,150,0.9)';

    // top-left: lobby info
    const info = this.testMode
      ? 'testing "' + this.map.name + '" · esc returns to the editor'
      : (this.lobby ? this.lobby.describe() + ' · ' + this.players.size + (this.players.size === 1 ? ' player' : ' players') : '');
    o.fillText(info, 10, 10);
    if (this.pops > 0) o.fillText('pops: ' + this.pops, 10, 26);

    // controls hint
    if (this.hintT > 0 && !this.testMode) {
      o.globalAlpha = Math.min(1, this.hintT);
      o.textAlign = 'center';
      o.fillText('a/d move · w jump · e grab · click throw/blast · t chat', R.w / 2, R.h - 28);
      o.textAlign = 'left';
      o.globalAlpha = 1;
    }

    // toasts
    let ty = R.h - 54;
    o.textAlign = 'center';
    for (const t of this.toasts) {
      o.globalAlpha = Math.min(1, t.t);
      o.fillText(t.text, R.w / 2, ty);
      ty -= 18;
      o.globalAlpha = 1;
    }
    o.textAlign = 'left';

    // dead overlay
    if (this.me.dead) {
      o.fillStyle = 'rgba(255,255,255,0.4)';
      o.fillRect(0, 0, R.w, R.h);
      o.fillStyle = '#9a9a9a';
      o.textAlign = 'center';
      o.font = '14px ui-monospace, Menlo, Consolas, monospace';
      o.fillText('you popped', R.w / 2, R.h / 2 - 20);
      o.textAlign = 'left';
    }
  }

  // ---------------------------------------------------------- teardown
  exit() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
    this.chat.destroy();
    for (const [, b] of this.buttons) b.remove();
    this.buttons.clear();
    for (const ent of this.ents) if (ent.scriptInst) ent.scriptInst.destroy();
    if (this.lobby) this.lobby.close();
    this.onExit();
  }
}
