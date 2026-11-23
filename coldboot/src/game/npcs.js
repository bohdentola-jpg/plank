// People in town. Named characters follow daily schedules (where they are at
// what hour, doing what); townsfolk wander between street corners. Bodies are
// built only near the player (a few per second, so the frame rate holds) and
// released when far away. Everyone walks on the same collision world.
import * as THREE from 'three';
import { buildCharacter } from '../human/character.js';
import { Animator } from '../human/anim.js';
import { CAST } from '../data/cast.js';
import { SCHEDULES } from '../data/schedules.js';
import { makeRng } from '../core/util.js';

const SPAWN_R = 95, DESPAWN_R = 130;
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

export class NPC {
  constructor(id, def) {
    this.id = id;
    this.def = def;
    this.pos = new THREE.Vector3(def.x ?? 0, 0, def.z ?? 0);
    this.yaw = def.yaw ?? 0;
    this.ch = null;
    this.anim = null;
    this.building = false;
    this.goal = null;        // {x, z, yaw, activity}
    this.path = [];
    this.speed = 0;
    this.activity = 'stand';
    this.talking = false;    // in a conversation: stand still, face the player
    this.lookAt = null;
    this.hidden = false;     // off-stage (in Anchorage, in hospital…)
    this.scripted = false;   // a mission is moving them
  }
}

export class NPCs {
  constructor(G) {
    this.G = G;
    this.list = new Map();
    this.queue = [];
    this._busy = false;
    this._t = 0;
    for (const [id, sch] of Object.entries(SCHEDULES)) {
      if (!CAST[id]) continue;
      this.list.set(id, new NPC(id, { name: CAST[id].name }));
    }
    // townsfolk
    const r = makeRng('folk');
    for (let i = 0; i < 10; i++) {
      const id = 'folk' + i;
      const male = r() < 0.55;
      const npc = new NPC(id, { folk: true, dna: folkDNA(r, i, male), voice: (male ? 'm' : 'f') + (1 + (i % 6)) });
      npc.wander = true;
      this.list.set(id, npc);
    }
  }

  get(id) { return this.list.get(id); }

  /** An NPC record for any cast member (Mr. Grey, Halloran…) — hidden unless a scene brings them. */
  ensure(id) {
    let npc = this.list.get(id);
    if (!npc && CAST[id]) {
      npc = new NPC(id, { name: CAST[id].name });
      npc.hidden = true;
      this.list.set(id, npc);
    }
    return npc;
  }

  /** Where a named NPC should be at this hour (from data/schedules.js). */
  scheduleFor(id, hour, day) {
    const sch = SCHEDULES[id];
    if (!sch) return null;
    const blocks = (typeof sch === 'function' ? sch(day, this.G.state) : sch) || [];
    for (const b of blocks) {
      const [a, z] = b.t;
      const inside = a <= z ? hour >= a && hour < z : hour >= a || hour < z;
      if (inside) return b;
    }
    return blocks[blocks.length - 1] || null;
  }

  resolvePlace(place) {
    if (!place) return null;
    if (typeof place === 'object') return place;
    const p = this.G.town.points[place];
    if (p) return p;
    const b = this.G.town.buildings[place] || (place.includes('.') ? this.G.town.buildings[place.split('.')[0]] : null);
    if (b) return { x: b.x + Math.sin(b.rot) * 6, z: b.z + Math.cos(b.rot) * 6, rot: b.rot + Math.PI };
    return null;
  }

  async _build(npc) {
    npc.building = true;
    const dna = npc.def.folk ? npc.def.dna : outdoorize(CAST[npc.id].dna, npc.id);
    const ch = await buildCharacter(dna);
    npc.ch = ch;
    npc.anim = new Animator(ch);
    npc.anim.fidget = Math.random();
    this.G.scene.add(ch.group);
    npc.building = false;
    npc.pos.y = this.G.world.groundNear(npc.pos.x, npc.pos.z, npc.pos.y || undefined);
    ch.group.position.copy(npc.pos);
    ch.group.rotation.y = npc.yaw;
  }

  _release(npc) {
    if (!npc.ch) return;
    npc.ch.dispose();
    npc.ch = null;
    npc.anim = null;
  }

  update(dt) {
    const G = this.G;
    const P = G.player.pos;
    const hour = G.state.hour, day = G.state.day;
    this._t -= dt;
    const replan = this._t <= 0;
    if (replan) this._t = 1.0;
    for (const npc of this.list.values()) {
      // where should they be?
      if (replan && !npc.scripted && !npc.talking) {
        if (npc.def.folk) this._wander(npc);
        else {
          const b = this.scheduleFor(npc.id, hour, day);
          npc.hidden = !b || b.away;
          if (b && !b.away) {
            const p = this.resolvePlace(b.at);
            if (p && (!npc.goal || npc.goal.x !== p.x || npc.goal.z !== p.z)) {
              npc.goal = { x: p.x, z: p.z, yaw: p.rot ?? npc.yaw, activity: b.do || 'stand' };
              // far from the player: just be there
              if (!npc.ch && Math.hypot(npc.pos.x - P.x, npc.pos.z - P.z) > SPAWN_R) npc.pos.set(p.x, G.world.groundNear(p.x, p.z, p.y), p.z);
            }
          }
        }
      }
      const d = Math.hypot(npc.pos.x - P.x, npc.pos.z - P.z);
      if (!npc.hidden && d < SPAWN_R && !npc.ch && !npc.building && !this.queue.includes(npc)) this.queue.push(npc);
      if ((npc.hidden || d > DESPAWN_R) && npc.ch && !npc.talking) this._release(npc);
      this._move(npc, dt);
      if (npc.ch) {
        npc.ch.group.visible = !npc.hidden;
        npc.anim.update(dt);
      }
    }
    // build one body at a time
    if (!this._busy && this.queue.length) {
      this.queue.sort((a, b) => Math.hypot(a.pos.x - P.x, a.pos.z - P.z) - Math.hypot(b.pos.x - P.x, b.pos.z - P.z));
      const npc = this.queue.shift();
      this._busy = true;
      this._build(npc).catch((e) => console.error(e)).finally(() => { this._busy = false; });
    }
  }

  _wander(npc) {
    if (npc.goal && Math.hypot(npc.goal.x - npc.pos.x, npc.goal.z - npc.pos.z) > 1.5) return;
    const pts = this.G.walkPoints;
    if (!pts?.length) return;
    // townsfolk are mostly out in the day and early evening
    const h = this.G.state.hour;
    npc.hidden = h < 7 || h > 22.5 ? Math.random() < 0.85 : false;
    const p = pts[Math.floor(Math.random() * pts.length)];
    if (!npc.goal) npc.pos.set(p.x, 0, p.z);
    npc.goal = { x: p.x + (Math.random() - 0.5) * 6, z: p.z + (Math.random() - 0.5) * 6, activity: Math.random() < 0.3 ? 'stand' : 'walk' };
  }

  _move(npc, dt) {
    const G = this.G;
    if (npc.talking) {
      npc.speed = 0;
      if (npc.anim) {
        npc.anim.targetSpeed = 0;
        const P = G.player.pos;
        const want = Math.atan2(P.x - npc.pos.x, P.z - npc.pos.z);
        npc.yaw += wrap(want - npc.yaw) * Math.min(1, dt * 4);
        npc.ch.group.rotation.y = npc.yaw;
      }
      return;
    }
    const g = npc.goal;
    if (!g) return;
    const dx = g.x - npc.pos.x, dz = g.z - npc.pos.z;
    const dist = Math.hypot(dx, dz);
    const arrive = dist < 0.6;
    const target = arrive ? 0 : (npc.run ? 3.4 : 1.35);
    npc.speed += (target - npc.speed) * Math.min(1, dt * 4);
    if (!arrive) {
      const want = Math.atan2(dx, dz);
      npc.yaw += wrap(want - npc.yaw) * Math.min(1, dt * 5);
      const step = Math.min(dist, npc.speed * dt);
      if (npc.ch) {
        const r = G.world.move(npc.pos, Math.sin(npc.yaw) * step, Math.cos(npc.yaw) * step, 0.28, npc.pos.y);
        npc.pos.x = r.x; npc.pos.z = r.z;
        if (r.hit) { npc.stuck = (npc.stuck || 0) + dt; if (npc.stuck > 3) { npc.pos.set(g.x, npc.pos.y, g.z); npc.stuck = 0; } }
      } else {
        npc.pos.x += Math.sin(npc.yaw) * step; npc.pos.z += Math.cos(npc.yaw) * step;
      }
    } else if (g.yaw !== undefined) {
      npc.yaw += wrap(g.yaw - npc.yaw) * Math.min(1, dt * 3);
    }
    if (npc.ch) {
      npc.pos.y += (G.world.groundAt(npc.pos.x, npc.pos.z, npc.pos.y + 0.5) - npc.pos.y) * Math.min(1, dt * 12);
      npc.ch.group.position.copy(npc.pos);
      npc.ch.group.rotation.y = npc.yaw;
      npc.anim.targetSpeed = npc.speed;
      const act = arrive ? g.activity : 'walk';
      npc.anim.setPosture(act === 'sit' ? 'sit' : 'stand');
      npc.anim.armsCrossed = act === 'arms' ? 1 : 0;
      npc.anim.handsOnTable = act === 'sit' ? 1 : 0;
      if (npc.lookAt) npc.anim.lookAt = npc.lookAt;
      else if (arrive && Math.hypot(G.player.pos.x - npc.pos.x, G.player.pos.z - npc.pos.z) < 6) npc.anim.lookAt = G.player.pos.clone().setY(G.player.pos.y + 1.6);
      else npc.anim.lookAt = null;
    }
  }

  /** Visible NPCs near a point (for interaction prompts). */
  near(x, z, r) {
    const out = [];
    for (const n of this.list.values()) {
      if (!n.ch || n.hidden) continue;
      const d = Math.hypot(n.pos.x - x, n.pos.z - z);
      if (d < r) out.push({ npc: n, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }
}

// outdoors in November everyone wears a coat (unless their outfit has one)
export function outdoorize(dna, id) {
  const out = { ...dna };
  const has = (dna.outfit || []).some((g) => g.slot === 'coat');
  if (!has && !['halloran', 'pilot'].includes(id)) {
    const cols = ['#3a4450', '#5a4a3a', '#2a3a2e', '#6a2a24', '#2e2e34', '#7a6a4a'];
    const c = cols[(dna.seed || 1) % cols.length];
    out.outfit = [...(dna.outfit || []), { slot: 'coat', pattern: (dna.seed || 1) % 3 ? 'nylon' : 'duck', color: c, thick: 0.016, puff: (dna.seed || 1) % 2 ? 0.014 : 0.006, hem: 'hip' }];
  }
  return out;
}

const HAIRC = ['#0e0b09', '#2b1d14', '#3a2618', '#5a4026', '#7a5634', '#9a948c', '#c8a066'];
function folkDNA(r, i, male) {
  const a = r(), b = r();
  const eth = { caucasian: 0.3 + r(), asian: a < 0.45 ? 0.6 + r() : r() * 0.3, african: b < 0.15 ? 0.8 : r() * 0.15 };
  const dark = eth.african / (eth.caucasian + eth.asian + eth.african);
  const age = 20 + Math.floor(r() * 55);
  return outdoorize({
    seed: 5000 + i, sex: male ? 0.9 + r() * 0.1 : r() * 0.1, age, muscle: 0.3 + r() * 0.5, weight: 0.3 + r() * 0.5, height: 0.94 + r() * 0.1,
    ethnic: eth, skin: { tone: Math.min(1, 0.1 + dark * 0.7 + eth.asian * 0.15 + r() * 0.1), rosy: r() },
    hair: { style: male ? r.pick(['short', 'buzz', 'messy', 'swept']) : r.pick(['bun', 'bob', 'long', 'short']), color: HAIRC[Math.floor(r() * (age > 55 ? 7 : 5))], recede: male && age > 40 ? r() * 0.8 : 0 },
    beard: male && r() < 0.4 ? { style: r.pick(['short', 'full', 'moustache']), stubble: r() } : { stubble: male ? r() * 0.6 : 0 },
    outfit: [
      { slot: 'top', pattern: r.pick(['knit', 'fleece', 'plaid', 'plain']), color: r.pick(['#5a6a7a', '#7a4a32', '#3e5468', '#8e2a24', '#5a6a4e', '#7a7e86']), color2: '#151515', color3: '#9a8a62', thick: 0.008, hem: 'hip' },
      { slot: 'bottom', pattern: r.pick(['denim', 'duck', 'wool']), color: r.pick(['#2c3a4e', '#3a3428', '#2a2a2e', '#4a4232']), thick: 0.005 },
      { slot: 'boots', pattern: 'leather', color: r.pick(['#2a1e14', '#141210', '#4a3020']), thick: 0.014, shaft: 0.3 },
    ],
  }, 'folk');
}
