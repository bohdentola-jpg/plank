// net.js — multiplayer with no game server.
//
// Signaling rides the free PeerJS broker; the actual play is WebRTC between
// players. One player hosts a lobby and relays; everyone else connects to them.
// That's why the whole game can live on static hosting.
//
// Public lobbies live at fixed broker ids (…-pub-0 … -pub-5): to find a game we
// probe every slot at once, join the first that answers, and claim an empty one
// if nobody's home. Private lobbies hash a 4-letter code into an id.

import { uid, lobbyCode } from './util.js';

export const PROTO = 3;
const PREFIX = 'snpt-game-v3';
const PUB_SLOTS = 6;
export const MAX_PLAYERS = 8;
const PROBE_TIMEOUT = 4500;
const PEER_OPEN_TIMEOUT = 9000;
const SILENCE_TIMEOUT = 12000;
const HANDSHAKE_TIMEOUT = 6000;

const pubId = (i) => `${PREFIX}-pub-${i}`;
const prvId = (code) => `${PREFIX}-prv-${String(code).toUpperCase()}`;

function newPeer(id) {
  // window.Peer comes from vendor/peerjs.min.js. Self-hosters (and the tests)
  // can point at their own peerjs-server with window.GAME_PEER_CONFIG.
  const cfg = Object.assign({ debug: 0 }, window.GAME_PEER_CONFIG || {});
  return new window.Peer(id || undefined, cfg);
}

function openPeer(id) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let peer;
    try { peer = newPeer(id); } catch (e) { reject(e); return; }
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { peer.destroy(); } catch (e) {}
      reject(new Error('signal-timeout'));
    }, PEER_OPEN_TIMEOUT);
    peer.on('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(peer);
    });
    peer.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { peer.destroy(); } catch (e) {}
      reject(err);
    });
  });
}

function cleanName(n) {
  const s = String(n || '').replace(/[^\w \-'.]/g, '').trim().slice(0, 16);
  return s || 'guest';
}

// ---------------------------------------------------------------- Lobby
export class Lobby {
  constructor(kind) {
    this.kind = kind;              // 'pub' | 'prv' | 'solo'
    this.isHost = false;
    this.offline = kind === 'solo';
    this.peer = null;
    this.hostConn = null;
    this.conns = new Map();        // host: peerId → conn
    this.names = new Map();
    this.myId = 'me-' + uid();
    this.myName = 'guest';
    this.code = null;
    this.slot = null;
    this.welcome = null;
    this.handlers = null;
    this.queue = [];
    this.closed = false;
    this.lastHeard = new Map();
    this.lastHostHeard = now();
    this.getWelcome = null;
    this.pendingHandshakes = new Map();
    this._watch = setInterval(() => this._checkSilence(), 2000);
  }

  get playerCount() { return (this.isHost ? this.conns.size : 0) + 1; }

  describe() {
    if (this.offline) return 'solo';
    if (this.kind === 'prv') return 'private · code ' + this.code;
    return 'public lobby ' + ((this.slot ?? 0) + 1);
  }

  attach(handlers) {
    this.handlers = handlers;
    const q = this.queue;
    this.queue = [];
    for (const [fn, args] of q) {
      const h = this.handlers[fn];
      if (h) h(...args);
    }
  }

  emit(fn, ...args) {
    if (this.handlers && this.handlers[fn]) this.handlers[fn](...args);
    else if (this.queue.length < 200) this.queue.push([fn, args]);
  }

  send(msg) {
    if (this.offline || this.isHost || this.closed) return;
    try { if (this.hostConn && this.hostConn.open) this.hostConn.send(msg); } catch (e) {}
  }

  broadcast(msg, exceptId) {
    if (!this.isHost || this.closed) return;
    for (const [id, conn] of this.conns) {
      if (id === exceptId) continue;
      try { if (conn.open) conn.send(msg); } catch (e) {}
    }
  }

  sendTo(id, msg) {
    const conn = this.conns.get(id);
    if (!conn) return;
    try { if (conn.open) conn.send(msg); } catch (e) {}
  }

  // ------------------------------------------------ host
  becomeHost(peer, myName) {
    this.isHost = true;
    this.peer = peer;
    this.myId = peer.id;
    this.myName = cleanName(myName);
    this.names.set(this.myId, this.myName);
    peer.on('connection', (conn) => this._accept(conn));
    peer.on('disconnected', () => { if (!this.closed) { try { peer.reconnect(); } catch (e) {} } });
    peer.on('error', (err) => {
      if (this.closed) return;
      if (err && (err.type === 'network' || err.type === 'server-error')) {
        this.emit('onStatus', 'lost the lobby service — nobody new can join');
      }
    });
  }

  _accept(conn) {
    // a connection that never says hello gets dropped, so a peer can't pile up
    // open channels that never count against MAX_PLAYERS
    const hsTimer = setTimeout(() => {
      if (!this.conns.has(conn.peer)) { try { conn.close(); } catch (e) {} }
      this.pendingHandshakes.delete(conn.peer);
    }, HANDSHAKE_TIMEOUT);
    this.pendingHandshakes.set(conn.peer, hsTimer);

    conn.on('data', (msg) => {
      if (this.closed || !msg || typeof msg !== 'object') return;
      const id = conn.peer;
      if (msg.t === 'hi') {
        if (msg.v !== PROTO) { this._reject(conn, 'badver'); return; }
        if (this.conns.size + 1 >= MAX_PLAYERS) { this._reject(conn, 'full'); return; }
        clearTimeout(hsTimer);
        this.pendingHandshakes.delete(id);
        const name = cleanName(msg.name);
        this.conns.set(id, conn);
        this.names.set(id, name);
        this.lastHeard.set(id, now());
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
      if (!this.conns.has(id)) return;      // ignore chatter before hello
      this.lastHeard.set(id, now());
      this.emit('onMessage', id, msg);
    });
    conn.on('close', () => { clearTimeout(hsTimer); this.pendingHandshakes.delete(conn.peer); this._drop(conn.peer); });
    conn.on('error', () => { clearTimeout(hsTimer); this.pendingHandshakes.delete(conn.peer); this._drop(conn.peer); });
  }

  _reject(conn, why) {
    try { conn.send({ t: why }); } catch (e) {}
    setTimeout(() => { try { conn.close(); } catch (e) {} }, 120);
    this.lastHeard.delete(conn.peer);
  }

  _drop(id) {
    this.lastHeard.delete(id);           // always, even for peers that never joined
    if (!this.conns.has(id)) return;
    const conn = this.conns.get(id);
    try { if (conn) conn.close(); } catch (e) {}
    this.conns.delete(id);
    this.names.delete(id);
    this.broadcast({ t: 'leave', id });
    this.emit('onLeave', id);
  }

  // ------------------------------------------------ client
  becomeClient(peer, conn, welcome, myName) {
    this.isHost = false;
    this.peer = peer;
    this.hostConn = conn;
    this.welcome = welcome;
    this.myId = welcome.you;
    this.myName = cleanName(myName);
    this.hostId = welcome.hostId;
    if (welcome.lobby) {
      this.code = welcome.lobby.code || this.code;
      this.slot = welcome.lobby.slot;
    }
    for (const r of Array.isArray(welcome.roster) ? welcome.roster.slice(0, MAX_PLAYERS) : []) {
      if (r && typeof r.id === 'string') this.names.set(r.id, cleanName(r.name));
    }
    this.lastHostHeard = now();
    conn.on('data', (msg) => {
      if (this.closed || !msg || typeof msg !== 'object') return;
      this.lastHostHeard = now();
      if (msg.t === 'join') {
        if (typeof msg.id !== 'string' || this.names.size > MAX_PLAYERS * 2) return;
        const name = cleanName(msg.name);
        this.names.set(msg.id, name);
        this.emit('onJoin', { id: msg.id, name });
        return;
      }
      if (msg.t === 'leave') {
        if (typeof msg.id !== 'string') return;
        this.names.delete(msg.id);
        this.emit('onLeave', msg.id);
        return;
      }
      this.emit('onMessage', 'host', msg);
    });
    conn.on('close', () => this._hostLost());
    conn.on('error', () => this._hostLost());
    peer.on('disconnected', () => { if (!this.closed) { try { peer.reconnect(); } catch (e) {} } });
  }

  _hostLost() {
    if (this.closed || this.isHost) return;
    this.closed = true;
    clearInterval(this._watch);
    this.emit('onHostLost');
  }

  _checkSilence() {
    if (this.closed || this.offline) return;
    const t = now();
    if (this.isHost) {
      for (const [id] of [...this.conns]) {
        if (t - (this.lastHeard.get(id) || 0) > SILENCE_TIMEOUT) this._drop(id);
      }
    } else if (this.hostConn && t - this.lastHostHeard > SILENCE_TIMEOUT) {
      this._hostLost();
    }
  }

  close() {
    this.closed = true;
    clearInterval(this._watch);
    for (const [, timer] of this.pendingHandshakes) clearTimeout(timer);
    this.pendingHandshakes.clear();
    for (const [, conn] of this.conns) { try { conn.close(); } catch (e) {} }
    this.conns.clear();
    try { if (this.hostConn) this.hostConn.close(); } catch (e) {}
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
  }
}

function now() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

// ---------------------------------------------------------------- probing
function tryJoin(peer, targetId, name, timeoutMs = PROBE_TIMEOUT) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let conn;
    try { conn = peer.connect(targetId, { reliable: true }); } catch (e) { reject({ reason: 'error' }); return; }
    if (!conn) { reject({ reason: 'unavailable' }); return; }

    const onErr = (err) => {
      if (err && err.type === 'peer-unavailable' && String(err.message || '').includes(targetId)) {
        finish(reject, { reason: 'unavailable' });
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      if (peer.off) peer.off('error', onErr);
      else if (peer.removeListener) peer.removeListener('error', onErr);
    };
    const finish = (fn, v) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (fn === reject) { try { conn.close(); } catch (e) {} }
      fn(v);
    };
    const timer = setTimeout(() => finish(reject, { reason: 'timeout' }), timeoutMs);
    peer.on('error', onErr);
    conn.on('open', () => { try { conn.send({ t: 'hi', name, v: PROTO }); } catch (e) {} });
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'welcome') finish(resolve, { conn, welcome: msg });
      else if (msg.t === 'full') finish(reject, { reason: 'full' });
      else if (msg.t === 'badver') finish(reject, { reason: 'badver' });
    });
    conn.on('close', () => finish(reject, { reason: 'closed' }));
    conn.on('error', () => finish(reject, { reason: 'error' }));
  });
}

export function soloLobby(name, reasonText) {
  const lobby = new Lobby('solo');
  lobby.isHost = true;
  lobby.myName = cleanName(name);
  lobby.names.set(lobby.myId, lobby.myName);
  if (reasonText) setTimeout(() => lobby.emit('onStatus', reasonText), 0);
  return lobby;
}

// Join any public lobby, else open one.
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
    const state = new Array(PUB_SLOTS).fill('unknown');
    const probes = [];
    for (let i = 0; i < PUB_SLOTS; i++) {
      probes.push(
        tryJoin(peer, pubId(i), name)
          .then(r => ({ i, ok: true, r }))
          .catch(err => { state[i] = err && err.reason; return { i, ok: false }; })
      );
    }
    const results = await Promise.all(probes);
    const winner = results.find(r => r.ok);
    if (winner) {
      // probing means saying hello, so every other lobby we reached now thinks
      // we joined — close those connections instead of leaving ghosts behind
      for (const r of results) {
        if (r.ok && r !== winner) { try { r.r.conn.close(); } catch (e) {} }
      }
      const lobby = new Lobby('pub');
      lobby.slot = winner.i;
      lobby.becomeClient(peer, winner.r.conn, winner.r.welcome, name);
      return lobby;
    }

    onStatus && onStatus('no lobby yet — opening one…');
    for (let i = 0; i < PUB_SLOTS; i++) {
      if (state[i] !== 'unavailable' && state[i] !== 'timeout') continue;
      try {
        const hostPeer = await openPeer(pubId(i));
        try { peer.destroy(); } catch (e) {}
        const lobby = new Lobby('pub');
        lobby.slot = i;
        lobby.becomeHost(hostPeer, name);
        return lobby;
      } catch (e) {
        // somebody claimed this slot between our probe and our claim — they are
        // the host now, so join them rather than opening a rival lobby
        try {
          const { conn, welcome } = await tryJoin(peer, pubId(i), name, 5000);
          const lobby = new Lobby('pub');
          lobby.slot = i;
          lobby.becomeClient(peer, conn, welcome, name);
          return lobby;
        } catch (e2) { /* still nothing there; try the next slot */ }
      }
    }
    onStatus && onStatus('lobbies were busy, retrying…');
  }
  try { peer.destroy(); } catch (e) {}
  return soloLobby(name, 'every public lobby was full — playing solo');
}

export async function hostPrivate(name, onStatus) {
  name = cleanName(name);
  onStatus && onStatus('opening a private lobby…');
  for (let i = 0; i < 5; i++) {
    const code = lobbyCode();
    try {
      const peer = await openPeer(prvId(code));
      const lobby = new Lobby('prv');
      lobby.code = code;
      lobby.becomeHost(peer, name);
      return lobby;
    } catch (e) {
      if (e && e.type === 'unavailable-id') continue;   // code taken, reroll
      return soloLobby(name, "couldn't reach the lobby service — playing solo");
    }
  }
  return soloLobby(name, "couldn't get a lobby code — playing solo");
}

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
    const { conn, welcome } = await tryJoin(peer, prvId(code), name, 6500);
    const lobby = new Lobby('prv');
    lobby.code = code;
    lobby.becomeClient(peer, conn, welcome, name);
    return lobby;
  } catch (err) {
    try { peer.destroy(); } catch (e) {}
    const reason = err && err.reason;
    if (reason === 'full') throw { reason, text: 'that lobby is full' };
    if (reason === 'badver') throw { reason, text: 'that lobby runs a different version of game' };
    throw { reason: 'nolobby', text: 'no lobby found with code ' + code };
  }
}

// The host vanished: whoever claims the lobby id first becomes the new host and
// the rest join them. A random stagger keeps the race short.
export async function migrate(oldLobby, name, onStatus) {
  onStatus && onStatus('host left — reconnecting…');
  await sleep(250 + Math.random() * 1100);
  if (oldLobby.kind === 'prv' && oldLobby.code) {
    const code = oldLobby.code;
    try {
      const peer = await openPeer(prvId(code));
      const lobby = new Lobby('prv');
      lobby.code = code;
      lobby.becomeHost(peer, name);
      return lobby;
    } catch (e) { /* someone else got it first */ }
    try {
      return await joinPrivate(code, name, onStatus);
    } catch (e) {
      return soloLobby(name, 'that lobby is gone — playing solo');
    }
  }
  return joinOrHostPublic(name, onStatus);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
