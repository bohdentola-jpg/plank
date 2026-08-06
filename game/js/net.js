// net.js — serverless multiplayer over PeerJS (WebRTC + the free PeerJS cloud
// broker for signaling). No game server anywhere: one player hosts, everyone
// else connects to them, the host relays. Works from static hosting (Netlify).
//
// Public lobbies use deterministic broker IDs (…-pub-0, …-pub-1, …): to find a
// game we try to connect to every slot at once; if nobody's home we claim a
// slot and become the host. Private lobbies hash a 4-letter code into an ID.

import { uid, lobbyCode } from './util.js';

export const PROTO = 1;
const PREFIX = 'snpt-game-v1';
const PUB_SLOTS = 6;
export const MAX_PLAYERS = 8;
const PROBE_TIMEOUT = 4500;
const PEER_OPEN_TIMEOUT = 9000;
const SILENCE_TIMEOUT = 9000;

const pubId = (i) => `${PREFIX}-pub-${i}`;
const prvId = (code) => `${PREFIX}-prv-${String(code).toUpperCase()}`;

function newPeer(id) {
  // vendored global from vendor/peerjs.min.js.
  // By default this uses the free PeerJS cloud broker. Self-hosters (or tests)
  // can point at their own peerjs-server by defining window.GAME_PEER_CONFIG
  // = {host, port, path, key, secure} before the game loads.
  const cfg = Object.assign({ debug: 0 }, window.GAME_PEER_CONFIG || {});
  return new window.Peer(id || undefined, cfg);
}

function openPeer(id) {
  return new Promise((resolve, reject) => {
    let done = false;
    const peer = newPeer(id);
    const timer = setTimeout(() => {
      if (!done) { done = true; try { peer.destroy(); } catch (e) {} reject(new Error('signal-timeout')); }
    }, PEER_OPEN_TIMEOUT);
    peer.on('open', () => {
      if (done) return;
      done = true; clearTimeout(timer); resolve(peer);
    });
    peer.on('error', (err) => {
      if (done) return;
      done = true; clearTimeout(timer);
      try { peer.destroy(); } catch (e) {}
      reject(err);
    });
  });
}

// ---------------------------------------------------------------- Lobby
export class Lobby {
  constructor(kind) {
    this.kind = kind;          // 'pub' | 'prv' | 'solo'
    this.isHost = false;
    this.offline = kind === 'solo';
    this.peer = null;
    this.hostConn = null;      // client → host
    this.conns = new Map();    // host: peerId → conn
    this.names = new Map();    // peerId → name
    this.myId = 'me-' + uid();
    this.myName = 'guest';
    this.code = null;          // private code
    this.slot = null;          // public slot number
    this.handlers = null;
    this.queue = [];
    this.closed = false;
    this.lastHeard = new Map();
    this.lastHostHeard = performance.now();
    this.getWelcome = null;    // host: set by the session → {map, snap}
    this._watch = setInterval(() => this._checkSilence(), 2000);
  }

  get playerCount() { return (this.isHost ? this.conns.size : 0) + 1; }

  describe() {
    if (this.offline) return 'offline · playing solo';
    if (this.kind === 'prv') return 'private · code ' + this.code;
    return 'public lobby ' + ((this.slot ?? 0) + 1);
  }

  attach(handlers) {
    this.handlers = handlers;
    for (const [fn, args] of this.queue) {
      const h = this.handlers[fn];
      if (h) h(...args);
    }
    this.queue = [];
  }

  emit(fn, ...args) {
    if (this.handlers && this.handlers[fn]) this.handlers[fn](...args);
    else this.queue.push([fn, args]);
  }

  // client → host
  send(msg) {
    if (this.offline || this.isHost) return;
    try { if (this.hostConn && this.hostConn.open) this.hostConn.send(msg); } catch (e) {}
  }

  // host → all clients (optionally skipping one)
  broadcast(msg, exceptId) {
    if (!this.isHost) return;
    for (const [id, conn] of this.conns) {
      if (id === exceptId) continue;
      try { if (conn.open) conn.send(msg); } catch (e) {}
    }
  }

  sendTo(id, msg) {
    const conn = this.conns.get(id);
    if (conn) { try { if (conn.open) conn.send(msg); } catch (e) {} }
  }

  // ------------------------------------------------ host side
  becomeHost(peer, myName) {
    this.isHost = true;
    this.peer = peer;
    this.myId = peer.id;
    this.myName = myName;
    this.names.set(this.myId, myName);
    peer.on('connection', (conn) => this._acceptConn(conn));
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    peer.on('error', (err) => {
      // fatal peer errors while hosting → clients will migrate; we go solo
      if (err && (err.type === 'network' || err.type === 'server-error')) {
        this.emit('onStatus', 'connection to the lobby service lost — new players cannot join');
      }
    });
  }

  _acceptConn(conn) {
    conn.on('data', (msg) => {
      if (this.closed || !msg || typeof msg !== 'object') return;
      const id = conn.peer;
      this.lastHeard.set(id, performance.now());
      if (msg.t === 'hi') {
        if (msg.v !== PROTO) { try { conn.send({ t: 'badver' }); conn.close(); } catch (e) {} return; }
        if (this.conns.size + 1 >= MAX_PLAYERS) { try { conn.send({ t: 'full' }); conn.close(); } catch (e) {} return; }
        const name = cleanName(msg.name);
        this.conns.set(id, conn);
        this.names.set(id, name);
        const w = this.getWelcome ? this.getWelcome() : {};
        try {
          conn.send({
            t: 'welcome', you: id, proto: PROTO,
            map: w.map || null, snap: w.snap || null,
            roster: [...this.names.entries()].map(([pid, n]) => ({ id: pid, name: n })),
            hostId: this.myId,
            lobby: { kind: this.kind, code: this.code, slot: this.slot },
          });
        } catch (e) {}
        this.broadcast({ t: 'join', id, name }, id);
        this.emit('onJoin', { id, name });
        return;
      }
      if (!this.conns.has(id)) return; // ignore chatter before hi
      this.emit('onMessage', id, msg);
    });
    conn.on('close', () => this._dropClient(conn.peer));
    conn.on('error', () => this._dropClient(conn.peer));
  }

  _dropClient(id) {
    if (!this.conns.has(id)) return;
    this.conns.delete(id);
    this.names.delete(id);
    this.lastHeard.delete(id);
    this.broadcast({ t: 'leave', id });
    this.emit('onLeave', id);
  }

  // ------------------------------------------------ client side
  becomeClient(peer, conn, welcome, myName) {
    this.isHost = false;
    this.peer = peer;
    this.hostConn = conn;
    this.welcome = welcome;           // {map, snap, roster, …} for the session
    this.myId = welcome.you;
    this.myName = myName;
    this.code = welcome.lobby && welcome.lobby.code || this.code;
    this.slot = welcome.lobby ? welcome.lobby.slot : this.slot;
    for (const r of welcome.roster || []) this.names.set(r.id, r.name);
    this.lastHostHeard = performance.now();
    conn.on('data', (msg) => {
      if (this.closed || !msg || typeof msg !== 'object') return;
      this.lastHostHeard = performance.now();
      if (msg.t === 'join') { this.names.set(msg.id, cleanName(msg.name)); this.emit('onJoin', { id: msg.id, name: msg.name }); return; }
      if (msg.t === 'leave') { this.names.delete(msg.id); this.emit('onLeave', msg.id); return; }
      this.emit('onMessage', 'host', msg);
    });
    conn.on('close', () => this._hostLost());
    conn.on('error', () => this._hostLost());
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  }

  _hostLost() {
    if (this.closed || this.isHost) return;
    this.closed = true;
    this.emit('onHostLost');
  }

  _checkSilence() {
    if (this.closed || this.offline) return;
    const now = performance.now();
    if (this.isHost) {
      for (const [id] of this.conns) {
        const last = this.lastHeard.get(id) || 0;
        if (now - last > SILENCE_TIMEOUT) this._dropClient(id);
      }
    } else if (this.hostConn && now - this.lastHostHeard > SILENCE_TIMEOUT) {
      this._hostLost();
    }
  }

  close() {
    this.closed = true;
    clearInterval(this._watch);
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
    this.conns.clear();
  }
}

function cleanName(n) {
  n = String(n || '').replace(/[^\w \-'.]/g, '').trim().slice(0, 16);
  return n || 'guest';
}

// ---------------------------------------------------------------- matchmaking

// Try to join an existing host at `targetId` using `peer`. Resolves with
// {conn, welcome} or rejects ({reason: 'unavailable'|'full'|'badver'|'timeout'}).
function tryJoin(peer, targetId, name, timeoutMs = PROBE_TIMEOUT) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, v) => { if (!done) { done = true; cleanup(); fn(v); } };
    const conn = peer.connect(targetId, { reliable: true });
    if (!conn) return reject({ reason: 'unavailable' });
    const timer = setTimeout(() => {
      try { conn.close(); } catch (e) {}
      finish(reject, { reason: 'timeout' });
    }, timeoutMs);
    const onErr = (err) => {
      if (err && err.type === 'peer-unavailable' && String(err.message || '').includes(targetId)) {
        try { conn.close(); } catch (e) {}
        finish(reject, { reason: 'unavailable' });
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      peer.off && peer.off('error', onErr);
    };
    peer.on('error', onErr);
    conn.on('open', () => { try { conn.send({ t: 'hi', name, v: PROTO }); } catch (e) {} });
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'welcome') { finish(resolve, { conn, welcome: msg }); }
      else if (msg.t === 'full') { try { conn.close(); } catch (e) {} finish(reject, { reason: 'full' }); }
      else if (msg.t === 'badver') { try { conn.close(); } catch (e) {} finish(reject, { reason: 'badver' }); }
    });
    conn.on('close', () => finish(reject, { reason: 'closed' }));
    conn.on('error', () => finish(reject, { reason: 'error' }));
  });
}

async function tryHost(targetId) {
  // claiming a deterministic ID = becoming that lobby's host
  return openPeer(targetId);
}

export function soloLobby(name, reasonText) {
  const lobby = new Lobby('solo');
  lobby.isHost = true;
  lobby.myName = cleanName(name);
  lobby.names.set(lobby.myId, lobby.myName);
  if (reasonText) setTimeout(() => lobby.emit('onStatus', reasonText), 0);
  return lobby;
}

// Join any public lobby, or claim an empty slot and host one.
export async function joinOrHostPublic(name, onStatus) {
  name = cleanName(name);
  onStatus && onStatus('looking for players…');
  let peer;
  try {
    peer = await openPeer(null);
  } catch (e) {
    return soloLobby(name, "couldn't reach the lobby service — playing solo");
  }

  for (let round = 0; round < 2; round++) {
    const slotState = new Array(PUB_SLOTS).fill('unknown');
    const attempts = [];
    for (let i = 0; i < PUB_SLOTS; i++) {
      attempts.push(
        tryJoin(peer, pubId(i), name)
          .then(r => ({ i, ok: true, r }))
          .catch(err => { slotState[i] = err.reason; return { i, ok: false, err }; })
      );
    }
    // take the first success; remember empty slots
    const results = await Promise.all(attempts.map(p => p.then(x => x, x => x)));
    const win = results.find(r => r.ok);
    if (win) {
      const lobby = new Lobby('pub');
      lobby.slot = win.i;
      lobby.becomeClient(peer, win.r.conn, win.r.welcome, name);
      return lobby;
    }
    // nobody home → try to claim an empty slot as host
    onStatus && onStatus('no lobby found — opening one…');
    for (let i = 0; i < PUB_SLOTS; i++) {
      if (slotState[i] !== 'unavailable' && slotState[i] !== 'timeout') continue;
      try {
        const hostPeer = await tryHost(pubId(i));
        try { peer.destroy(); } catch (e) {}
        const lobby = new Lobby('pub');
        lobby.slot = i;
        lobby.becomeHost(hostPeer, name);
        return lobby;
      } catch (e) {
        // someone else claimed it between probe and host → loop tries next slot
      }
    }
    onStatus && onStatus('lobbies were busy, retrying…');
  }
  try { peer.destroy(); } catch (e) {}
  return soloLobby(name, 'all public lobbies were full — playing solo');
}

// Host a new private lobby with a fresh code.
export async function hostPrivate(name, onStatus) {
  name = cleanName(name);
  onStatus && onStatus('opening a private lobby…');
  for (let i = 0; i < 5; i++) {
    const code = lobbyCode();
    try {
      const peer = await tryHost(prvId(code));
      const lobby = new Lobby('prv');
      lobby.code = code;
      lobby.becomeHost(peer, name);
      return lobby;
    } catch (e) {
      if (e && e.type === 'unavailable-id') continue;  // code collision — reroll
      return soloLobby(name, "couldn't reach the lobby service — playing solo");
    }
  }
  return soloLobby(name, "couldn't get a lobby code — playing solo");
}

// Join a private lobby by code. Throws {reason} on failure.
export async function joinPrivate(code, name, onStatus) {
  name = cleanName(name);
  code = String(code || '').trim().toUpperCase();
  onStatus && onStatus('joining ' + code + '…');
  let peer;
  try {
    peer = await openPeer(null);
  } catch (e) {
    throw { reason: 'network', text: "couldn't reach the lobby service" };
  }
  try {
    const { conn, welcome } = await tryJoin(peer, prvId(code), name, 6000);
    const lobby = new Lobby('prv');
    lobby.code = code;
    lobby.becomeClient(peer, conn, welcome, name);
    return lobby;
  } catch (err) {
    try { peer.destroy(); } catch (e) {}
    if (err.reason === 'full') throw { reason: 'full', text: 'that lobby is full' };
    if (err.reason === 'badver') throw { reason: 'badver', text: 'that lobby runs a different version' };
    throw { reason: 'nolobby', text: 'no lobby found with code ' + code };
  }
}

// After the host vanishes: someone claims the same lobby id, everyone else
// rejoins it. Deterministic delay ordering keeps the race short.
export async function migrate(oldLobby, name, onStatus) {
  const kind = oldLobby.kind;
  onStatus && onStatus('host left — reconnecting…');
  await sleep(300 + Math.random() * 1200);
  if (kind === 'prv' && oldLobby.code) {
    const code = oldLobby.code;
    try {
      const peer = await tryHost(prvId(code));
      const lobby = new Lobby('prv');
      lobby.code = code;
      lobby.becomeHost(peer, name);
      return lobby;
    } catch (e) { /* someone beat us to it — join them */ }
    try {
      return await joinPrivate(code, name, onStatus);
    } catch (e) {
      return soloLobby(name, 'the lobby is gone — playing solo');
    }
  }
  return joinOrHostPublic(name, onStatus);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
