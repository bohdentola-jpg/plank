// Rooms: the lobby layer on top of the peer transport.
//  - Quick match ("always looking"): claim/join well-known public slot ids.
//  - Private match: a 4-letter room code; the host owns all settings.
// The host's browser is authoritative for everything; clients send intents.
import { openPeer, connectTo, NET_PREFIX, GAME_VERSION } from './transport.js';
import { STAGE_IDS } from '../world/stage.js';
import { WEAPON_IDS } from '../actors/weapons.js';
import { randomLook } from '../actors/gear.js';
import { BOT_NAMES } from '../actors/bot.js';
import { COLOR_PAIRS } from '../util.js';
import { currentRotation } from '../world/rotation.js';

export const MAX_PLAYERS = 8;
export const PUBLIC_SLOTS = 6;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const REJECT_TEXT = { full: 'That room is full.', 'in-progress': 'That match already started.', version: 'Your game version doesn\'t match the host\'s — everyone needs the same version.' };

export const MODES = { turf: { name: 'Turf Rush', desc: 'Paint the most floor in the time limit.' } };

export function defaultSettings(kind) {
  return { stage: kind === 'quick' ? 'rotation' : 'random', mode: 'turf', time: 180, bots: true, skill: 'normal', teamLock: false };
}

export class NetRoom {
  constructor(peer, isHost, kind) {
    this.peer = peer;
    this.isHost = isHost;
    this.kind = kind;
    this.myId = peer.id;
    this.handlers = {};
    this.members = [];
    this.settings = defaultSettings(kind);
    this.phase = 'lobby';
    this.conns = new Map();
    this.hostConn = null;
    this.closed = false;
    this.countdown = null;
    peer.on('disconnected', () => { if (!this.closed) { try { peer.reconnect(); } catch { /* */ } } });
  }

  on(type, fn) { (this.handlers[type] ||= []).push(fn); return () => { this.handlers[type] = (this.handlers[type] || []).filter((f) => f !== fn); }; }
  emit(type, ...a) {
    const hs = this.handlers[type] || [];
    if (!hs.length && type === 'msg') { (this.buffer ||= []).push(a); if (this.buffer.length > 800) this.buffer.shift(); return; }
    for (const fn of [...hs]) { try { fn(...a); } catch (e) { console.error(e); } }
  }
  drain() { const b = this.buffer || []; this.buffer = []; for (const a of b) this.emit('msg', ...a); }
  offAll(type) { delete this.handlers[type]; }

  get me() { return this.members.find((m) => m.id === this.myId); }
  get humans() { return this.members.length; }

  // ------------------------------------------------------------------ host side
  static async host(id, me, kind) {
    const peer = await openPeer(id);
    const r = new NetRoom(peer, true, kind);
    r.code = kind === 'private' ? id.split('-').pop() : null;
    r.members = [{ id: peer.id, name: me.name, look: me.look, weapon: me.weapon, ink: me.ink, team: 1, host: true }];
    peer.on('connection', (conn) => r.onConn(conn));
    peer.on('error', (e) => { if (e.type !== 'peer-unavailable') r.emit('error', e); });
    return r;
  }

  onConn(conn) {
    conn.on('data', (msg) => this.onHostData(conn, msg));
    conn.on('close', () => this.dropMember(conn.peer));
    conn.on('error', () => this.dropMember(conn.peer));
  }

  autoTeam() {
    const a = this.members.filter((m) => m.team === 1).length, b = this.members.filter((m) => m.team === 2).length;
    return a <= b ? 1 : 2;
  }

  onHostData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const reject = (reason) => { try { conn.send({ t: 'reject', reason }); } catch { /* */ } setTimeout(() => { try { conn.close(); } catch { /* */ } }, 300); };
      if (msg.v !== GAME_VERSION) return reject('version');
      if (this.phase !== 'lobby') return reject('in-progress');
      if (this.members.length >= MAX_PLAYERS) return reject('full');
      const name = String(msg.name || 'Player').replace(/[<>&"'`]/g, '').slice(0, 12) || 'Player';
      this.members = this.members.filter((m) => m.id !== conn.peer);
      this.members.push({ id: conn.peer, name, look: msg.look, weapon: WEAPON_IDS.includes(msg.weapon) ? msg.weapon : 'spritzer', ink: msg.ink, team: this.autoTeam(), host: false });
      this.conns.set(conn.peer, conn);
      conn.send({ t: 'welcome', you: conn.peer, kind: this.kind, code: this.code });
      this.syncLobby();
      this.emit('join', name);
      return;
    }
    if (!this.conns.has(conn.peer)) return;
    if (msg.t === 'set') {
      const m = this.members.find((x) => x.id === conn.peer);
      if (!m) return;
      if (msg.weapon && WEAPON_IDS.includes(msg.weapon)) m.weapon = msg.weapon;
      if (msg.look) m.look = msg.look;
      if ((msg.team === 1 || msg.team === 2) && !this.settings.teamLock && this.kind === 'private') {
        if (this.members.filter((x) => x.team === msg.team).length < 4) m.team = msg.team;
      }
      this.syncLobby();
      return;
    }
    this.emit('msg', msg, conn.peer);
  }

  dropMember(id) {
    if (!this.members.some((m) => m.id === id)) return;
    const m = this.members.find((x) => x.id === id);
    this.members = this.members.filter((x) => x.id !== id);
    this.conns.delete(id);
    this.syncLobby();
    this.emit('leave', id, m?.name);
  }

  // host: settings / teams
  setSettings(patch) { Object.assign(this.settings, patch); this.syncLobby(); }
  setTeam(id, team) {
    const m = this.members.find((x) => x.id === id);
    if (!m || m.team === team) return;
    if (this.members.filter((x) => x.team === team).length >= 4) return;
    m.team = team; this.syncLobby();
  }
  shuffleTeams() {
    const ms = [...this.members].sort(() => Math.random() - 0.5);
    ms.forEach((m, i) => { m.team = (i % 2) + 1; });
    this.syncLobby();
  }
  updateMe(patch) {
    if (this.isHost) { Object.assign(this.me, patch); this.syncLobby(); }
    else this.send({ t: 'set', ...patch });
  }

  syncLobby() {
    if (!this.isHost) return;
    const msg = { t: 'lobby', members: this.members, settings: this.settings, phase: this.phase, countdown: this.countdown };
    this.broadcast(msg);
    this.emit('lobby');
  }

  broadcast(msg, except = null) {
    for (const [id, c] of this.conns) if (id !== except && c.open) { try { c.send(msg); } catch { /* */ } }
  }
  sendTo(id, msg) { const c = this.conns.get(id); if (c?.open) { try { c.send(msg); } catch { /* */ } } }

  // Build the match description and tell everyone to load it
  startMatch() {
    const s = this.settings;
    const rot = currentRotation();
    const stage = s.stage === 'random' ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : s.stage === 'rotation' ? rot.ids[Math.floor(Math.random() * rot.ids.length)] : s.stage;
    const pair = COLOR_PAIRS[Math.floor(Math.random() * COLOR_PAIRS.length)];
    const flip = Math.random() < 0.5;
    const roster = [];
    const team = (t) => this.members.filter((m) => m.team === t);
    // keep teams to 4 max
    for (const t of [1, 2]) for (const m of team(t).slice(0, 4)) roster.push({ id: m.id, name: m.name, team: t, look: m.look, weapon: m.weapon, bot: false });
    const taken = roster.map((r) => r.name);
    if (s.bots) {
      const pool = BOT_NAMES.filter((n) => !taken.includes(n)).sort(() => Math.random() - 0.5);
      for (const t of [1, 2]) {
        while (roster.filter((r) => r.team === t).length < 4) {
          roster.push({ id: 'bot-' + roster.length, name: pool.pop() || 'Bot', team: t, look: randomLook(), weapon: WEAPON_IDS[Math.floor(Math.random() * WEAPON_IDS.length)], bot: true });
        }
      }
    }
    const match = { stage, colors: flip ? [pair.b, pair.a] : [pair.a, pair.b], mode: s.mode, time: s.time, skill: s.skill, roster, host: this.myId, kind: this.kind };
    this.phase = 'match';
    this.countdown = null;
    this.syncLobby();
    this.broadcast({ t: 'start', match });
    this.emit('start', match);
  }

  endMatch() {
    this.phase = 'lobby';
    this.syncLobby();
  }

  // ------------------------------------------------------------------ client side
  static async join(hostId, me, kind) {
    const peer = await openPeer(null);
    let conn;
    try { conn = await connectTo(peer, hostId); } catch (e) { try { peer.destroy(); } catch { /* */ } throw e; }
    const r = new NetRoom(peer, false, kind);
    r.hostConn = conn;
    r.hostId = hostId;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { reject(Object.assign(new Error('The room didn\'t answer.'), { type: 'timeout' })); r.close(); }, 7000);
      let welcomed = false;
      conn.on('data', (msg) => {
        if (!welcomed) {
          if (msg.t === 'welcome') { welcomed = true; clearTimeout(t); r.code = msg.code; resolve(r); }
          else if (msg.t === 'reject') { clearTimeout(t); r.close(); reject(Object.assign(new Error(REJECT_TEXT[msg.reason] || 'Could not join.'), { type: 'reject', reason: msg.reason })); }
          return;
        }
        r.onClientData(msg);
      });
      conn.on('close', () => r.onHostGone());
      conn.send({ t: 'hello', v: GAME_VERSION, name: me.name, look: me.look, weapon: me.weapon, ink: me.ink });
    });
  }

  onClientData(msg) {
    if (msg.t === 'lobby') {
      this.members = msg.members; this.settings = msg.settings; this.phase = msg.phase; this.countdown = msg.countdown;
      this.emit('lobby');
    } else if (msg.t === 'start') {
      this.phase = 'match';
      this.emit('start', msg.match);
    } else this.emit('msg', msg, this.hostId);
  }

  send(msg) { if (this.hostConn?.open) { try { this.hostConn.send(msg); } catch { /* */ } } }

  onHostGone() {
    if (this.closed) return;
    this.closed = true;
    this.emit('closed', 'The host left the room.');
    try { this.peer.destroy(); } catch { /* */ }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try { this.hostConn?.close(); } catch { /* */ }
    for (const c of this.conns.values()) { try { c.close(); } catch { /* */ } }
    try { this.peer.destroy(); } catch { /* */ }
  }
}

// ------------------------------------------------------------------ entry points
export async function createPrivateRoom(me) {
  for (let i = 0; i < 6; i++) {
    let code = '';
    for (let k = 0; k < 4; k++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    try { return await NetRoom.host(`${NET_PREFIX}-room-${code}`, me, 'private'); }
    catch (e) { if (e.type !== 'unavailable-id') throw e; }
  }
  throw new Error('Could not create a room right now — try again.');
}

export async function joinPrivateRoom(code, me) {
  code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (code.length !== 4) throw new Error('Room codes are 4 letters.');
  try { return await NetRoom.join(`${NET_PREFIX}-room-${code}`, me, 'private'); }
  catch (e) { if (e.type === 'peer-unavailable' || e.type === 'timeout') throw new Error(`No room called ${code} — check the code with your friend.`); throw e; }
}

// "Always looking": keep trying public slots — join a waiting host, or become one.
export async function quickMatch(me, onStatus, token) {
  const tryJoin = async (id) => {
    try { return { room: await NetRoom.join(id, me, 'quick') }; }
    catch (e) { return { err: e }; }
  };
  for (let round = 0; !token.cancelled; round++) {
    for (let slot = 0; slot < PUBLIC_SLOTS && !token.cancelled; slot++) {
      const id = `${NET_PREFIX}-pub-${slot}`;
      onStatus?.(`Searching for players… (lobby ${slot + 1})`);
      let j = await tryJoin(id);
      if (j.room) { if (token.cancelled) { j.room.close(); return null; } return j.room; }
      if (token.cancelled) return null;
      if (j.err?.type === 'reject') continue; // full / already playing: next lobby
      try {
        const room = await NetRoom.host(id, me, 'quick');
        if (token.cancelled) { room.close(); return null; }
        return room;
      } catch (e) {
        if (e.type === 'unavailable-id') {
          // someone became host of this lobby a moment ago: join them instead
          await sleep(600);
          j = await tryJoin(id);
          if (j.room) { if (token.cancelled) { j.room.close(); return null; } return j.room; }
          continue;
        }
        onStatus?.('Can\'t reach the matchmaking server — check your internet. Retrying…');
        await sleep(3000);
        break;
      }
    }
    await sleep(1500);
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
