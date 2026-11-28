// Peer-to-peer transport. Online play uses PeerJS (WebRTC data channels with a
// free public signalling broker — nobody has to host a server). For local
// testing, `?net=local` swaps in a BroadcastChannel fake with the same API so
// several tabs of one browser can play together.

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const NET_PREFIX = 'chromaclash-v3';
export const GAME_VERSION = 3;

export async function loadPeerLib() {
  if (params.get('net') === 'local') return LocalPeer;
  if (window.Peer) return window.Peer;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = new URL('../../vendor/peerjs.min.js', import.meta.url).href;
    s.onload = res;
    s.onerror = () => rej(new Error('Could not load the networking library.'));
    document.head.appendChild(s);
  });
  if (!window.Peer) throw new Error('Networking library failed to start.');
  return window.Peer;
}

function peerOptions() {
  const o = { debug: 0 };
  if (params.get('peerhost')) {
    o.host = params.get('peerhost');
    o.port = +(params.get('peerport') || 443);
    o.path = params.get('peerpath') || '/';
    o.secure = params.get('peersecure') !== '0';
  }
  return o;
}

// Open a peer with a fixed id. Resolves with the Peer once registered, rejects
// with err.type === 'unavailable-id' if somebody already holds that id.
export async function openPeer(id) {
  const Peer = await loadPeerLib();
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; try { peer.destroy(); } catch { /* */ } reject(Object.assign(new Error('Timed out contacting the matchmaking server.'), { type: 'timeout' })); } }, 12000);
    peer.on('open', () => { if (done) return; done = true; clearTimeout(t); resolve(peer); });
    peer.on('error', (err) => {
      if (done) return;
      done = true; clearTimeout(t);
      try { peer.destroy(); } catch { /* */ }
      reject(err);
    });
  });
}

// Connect to a host peer; resolves with an open DataConnection.
export function connectTo(peer, hostId, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const conn = peer.connect(hostId, { reliable: true, serialization: 'json' });
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; try { conn.close(); } catch { /* */ } reject(Object.assign(new Error('No answer from that room.'), { type: 'timeout' })); } }, timeout);
    conn.on('open', () => { if (done) return; done = true; clearTimeout(t); resolve(conn); });
    conn.on('error', (e) => { if (done) return; done = true; clearTimeout(t); reject(e); });
    peer.on('error', (e) => { if (done) return; if (e.type === 'peer-unavailable') { done = true; clearTimeout(t); reject(e); } });
  });
}

// ---------------------------------------------------------------------------
// BroadcastChannel fake of the PeerJS API (local multi-tab testing only)
class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] ||= []).push(fn); return this; }
  off(ev, fn) { this._h[ev] = (this._h[ev] || []).filter((f) => f !== fn); }
  _emit(ev, ...a) { for (const fn of [...(this._h[ev] || [])]) fn(...a); }
}

const BC = typeof BroadcastChannel !== 'undefined' ? BroadcastChannel : null;

class LocalConn extends Emitter {
  constructor(owner, remote, cid) { super(); this.owner = owner; this.peer = remote; this.cid = cid; this.open = false; }
  send(data) { if (this.open) this.owner._post({ t: 'data', cid: this.cid, to: this.peer, from: this.owner.id, data: JSON.parse(JSON.stringify(data)) }); }
  close() { if (!this.open) return; this.open = false; this.owner._post({ t: 'close', cid: this.cid, to: this.peer, from: this.owner.id }); this.owner.conns.delete(this.cid); this._emit('close'); }
}

export class LocalPeer extends Emitter {
  constructor(id) {
    super();
    if (typeof id === 'object') id = null;
    this.id = id || 'anon-' + Math.random().toString(36).slice(2, 10);
    this.conns = new Map();
    this.ch = new BC('chroma-localnet');
    this.alive = true;
    this.ch.onmessage = (e) => this._recv(e.data);
    this.claimNonce = Math.random();
    this.claimed = false;
    this._post({ t: 'claim', id: this.id, n: this.claimNonce });
    this.claimT = setTimeout(() => { this.claimed = true; this._emit('open', this.id); }, 350);
  }
  _post(m) { if (this.alive) this.ch.postMessage(m); }
  _recv(m) {
    if (!this.alive) return;
    if (m.t === 'claim' && m.id === this.id && m.n !== this.claimNonce && this.claimed) { this._post({ t: 'taken', id: this.id, n: m.n }); return; }
    if (m.t === 'taken' && m.id === this.id && m.n === this.claimNonce && !this.claimed) {
      clearTimeout(this.claimT);
      this._emit('error', Object.assign(new Error('id taken'), { type: 'unavailable-id' }));
      return;
    }
    if (m.to !== this.id) return;
    if (m.t === 'conn') {
      if (!this.claimed) return;
      const c = new LocalConn(this, m.from, m.cid);
      this.conns.set(m.cid, c);
      this._post({ t: 'connok', cid: m.cid, to: m.from, from: this.id });
      c.open = true;
      this._emit('connection', c);
      setTimeout(() => c._emit('open'), 0);
    } else if (m.t === 'connok') {
      const c = this.conns.get(m.cid);
      if (c) { c.open = true; c._emit('open'); }
    } else if (m.t === 'data') {
      this.conns.get(m.cid)?._emit('data', m.data);
    } else if (m.t === 'close') {
      const c = this.conns.get(m.cid);
      if (c) { c.open = false; this.conns.delete(m.cid); c._emit('close'); }
    }
  }
  connect(remote) {
    const cid = Math.random().toString(36).slice(2);
    const c = new LocalConn(this, remote, cid);
    this.conns.set(cid, c);
    this._post({ t: 'conn', cid, to: remote, from: this.id });
    setTimeout(() => { if (!c.open && this.conns.has(cid)) this._emit('error', Object.assign(new Error('peer unavailable'), { type: 'peer-unavailable' })); }, 1500);
    return c;
  }
  destroy() {
    for (const c of [...this.conns.values()]) c.close();
    this.alive = false;
    clearTimeout(this.claimT);
    try { this.ch.close(); } catch { /* */ }
    this._emit('close');
  }
}
