// Missions are async scripts. A mission's run(m, from) uses the helpers on `m`
// to set objectives and wait for things to happen; m.cp(n) marks checkpoints
// so a saved game resumes from the last one (steps before `from` are skipped):
//
//   async run(m, from) {
//     if (m.cp(1, from)) { m.obj('Find the store', 'koshkin'); await m.reach('koshkin', 6); }
//     if (m.cp(2, from)) { await m.talk('koshkin'); }
//     m.done();
//   }
import { ALL_MISSIONS } from '../data/script/index.js';
import { saveGame, addRel } from './state.js';
import { voice } from '../audio/voice.js';

export class Missions {
  constructor(G) {
    this.G = G;
    this.running = new Map();   // id → { m, promise }
    this.waiters = [];          // {test(), resolve}
    this.listeners = [];        // {evt, resolve}
    this.earQueue = Promise.resolve();
  }

  /** Resume everything active in the save. */
  resumeAll() {
    for (const [id, cp] of Object.entries(this.G.state.missions.active)) this.start(id, cp);
  }

  isActive(id) { return this.running.has(id); }
  isDone(id) { return !!this.G.state.missions.done[id]; }

  start(id, from = 0) {
    const def = ALL_MISSIONS[id];
    const s = this.G.state;
    if (!def || this.running.has(id) || s.missions.done[id]) return;
    s.missions.active[id] = from;
    const m = this._api(id, def);
    if (from === 0 && def.title) this.G.hud.toast(def.main ? 'NEW ASSIGNMENT' : 'NEW TASK', def.title, def.main ? '#ffd166' : '#7fe6ff');
    const p = def.run(m, from).catch((e) => { if (e !== 'cancelled') console.error(e); });
    this.running.set(id, { m, p });
  }

  cancel(id) {
    const r = this.running.get(id);
    if (!r) return;
    r.m.cancelled = true;
    this.running.delete(id);
    delete this.G.state.missions.active[id];
  }

  emit(evt) {
    for (const l of this.listeners) if (l.evt === evt) l.resolve(evt);
    this.listeners = this.listeners.filter((l) => l.evt !== evt);
  }

  /** Earpiece: Nadia & co. through the radio filter, one after another. */
  ear(id, opts = {}) {
    const G = this.G;
    this.earQueue = this.earQueue.then(async () => {
      const L = voice.line(id);
      if (!L) return;
      await G.director.say(L.who, id, { radio: true, listeners: [] });
      if (opts.pause) await G.director.wait(opts.pause);
    });
    return this.earQueue;
  }

  _api(id, def) {
    const G = this.G, self = this, s = G.state;
    const m = {
      id, G, state: s, cancelled: false,
      cp(n, from) {
        if (m.cancelled) throw 'cancelled';
        if (n < from) return false;
        s.missions.active[id] = n;
        return true;
      },
      /** Objective on the HUD (+ radar marker). where: building id, point, npc id or {x, z}. */
      obj(text, where, sub) {
        const target = self.where(where);
        m._obj = { text, sub, target, mission: id };
        G.hud.objective = m._obj;
        s.objective = { text, sub, target };
      },
      clear() { if (G.hud.objective === m._obj) G.hud.objective = null; s.objective = null; },
      until(test, interval = 0) {
        return new Promise((resolve, reject) => {
          self.waiters.push({ test: () => { if (m.cancelled) { reject('cancelled'); return true; } return test(); }, resolve, interval });
        });
      },
      reach(where, r = 4) {
        return m.until(() => {
          const t = self.where(where);
          return t && Math.hypot(G.player.pos.x - t.x, G.player.pos.z - t.z) < r;
        });
      },
      /** Wait until the player talks to someone (their DIALOG handles it; it emits 'talk:<id>'). */
      talk(npcId) { return m.event(`talk:${npcId}`); },
      event(evt) { return new Promise((resolve) => self.listeners.push({ evt, resolve })); },
      /** Wait for the clock (hour today, or tomorrow if it's passed). */
      hour(h) { return m.until(() => s.hour >= h && s.hour < h + 3); },
      wait(sec) { return G.director.wait(sec); },
      ear(line, o) { return self.ear(line, o); },
      async ears(lines) { for (const l of lines) await self.ear(l); },
      /** Temporary interactable for this mission. */
      spot(spotId, where, prompt, r = 1.8) {
        const t = self.where(where);
        return new Promise((resolve) => {
          G.interact.add(`${id}:${spotId}`, { x: t.x, z: t.z, y: t.y, r, prompt, action: () => { G.interact.remove(`${id}:${spotId}`); resolve(); } });
        });
      },
      flag(k, v) { if (v === undefined) return s.flags[k]; s.flags[k] = v; return v; },
      /** Friendship with anyone, from inside a mission. */
      rel(npcId, n) { s.met[npcId] = true; return addRel(s, npcId, n); },
      money(n, why) { s.money += n; G.hud.toast(n >= 0 ? 'PAID' : 'SPENT', `${n >= 0 ? '+' : '−'}$${Math.abs(n)}${why ? '  ' + why : ''}`, n >= 0 ? '#9fe8b0' : '#ffb21e'); },
      start(other) { self.start(other); },
      async minigame(kind, opts) { return G.minigames ? G.minigames.run(kind, opts) : true; },
      async job(kind, opts) { const n = await G.economy.job(kind, opts); return n || 0; },
      async repair(id) { return G.economy.repair(id); },
      async shop(id) { return G.economy.shop(id); },
      async code(challengeId) {
        const { openLaptop } = await import('../screens/laptop.js');
        const r = await openLaptop(G, { challenge: challengeId });
        return r || { pass: false };
      },
      async scene(fn) { return G.cutscene ? G.cutscene(fn) : fn(G.director); },
      done() {
        delete s.missions.active[id];
        s.missions.done[id] = true;
        self.running.delete(id);
        m.clear();
        if (def.title) G.hud.toast(def.main ? 'ASSIGNMENT COMPLETE' : 'DONE', def.title, '#9fe8b0');
        def.onDone?.(G);
        saveGame();
      },
    };
    return m;
  }

  /** Resolve a place: building id, 'building.point', npc id, or {x, z}. */
  where(w) {
    const G = this.G;
    if (!w) return null;
    if (typeof w === 'object') return w;
    const npc = G.npcs?.get(w);
    if (npc && !npc.def.folk && (npc.ch || !npc.hidden)) return { x: npc.pos.x, z: npc.pos.z };
    const pt = G.town.points[w];
    if (pt) return pt;
    // 'building.point' that doesn't exist falls back to the building's front
    const b = G.town.buildings[w] || (w.includes('.') ? G.town.buildings[w.split('.')[0]] : null);
    if (b) return { x: b.x + Math.sin(b.rot) * ((b.b.footprint?.d || 10) / 2 + 2), z: b.z + Math.cos(b.rot) * ((b.b.footprint?.d || 10) / 2 + 2), y: b.y };
    return null;
  }

  update() {
    for (const w of this.waiters) {
      try { if (w.test()) { w.done = true; w.resolve(); } } catch { w.done = true; }
    }
    this.waiters = this.waiters.filter((w) => !w.done);
    // radar: objective marker
    const G = this.G, o = G.hud.objective;
    const ms = o?.target ? [{ x: o.target.x, z: o.target.z, color: '#ffd166', icon: 'diamond' }] : [];
    const wp = G.hud.waypoint;
    if (wp) {
      if (Math.hypot(G.player.pos.x - wp.x, G.player.pos.z - wp.z) < 8) G.hud.waypoint = null;
      else ms.push({ x: wp.x, z: wp.z, color: '#c792ea', icon: 'diamond' });
    }
    G.hud.markers = ms;
  }
}
