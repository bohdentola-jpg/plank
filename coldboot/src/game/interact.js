// Things you can do where you stand: talk to people, use objects. The nearest
// thing in front of you gets the prompt; the interact button runs it.
import { input } from '../core/input.js';
import { CAST } from '../data/cast.js';

export class Interactions {
  constructor(G) {
    this.G = G;
    this.items = new Map();
    this.busy = false;
    this.current = null;
  }

  /** spec: { x, z, y?, r = 1.8, prompt, action: async () => {}, enabled?: () => bool, action icon } */
  add(id, spec) { this.items.set(id, { id, r: 1.8, ...spec }); }
  remove(id) { this.items.delete(id); }

  update() {
    const G = this.G;
    const P = G.player;
    this.current = null;
    if (this.busy || P.locked || G.cinematic) { G.hud.prompt = null; return; }
    let best = null, bestScore = Infinity;
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    const consider = (it, x, z, y) => {
      const dx = x - P.pos.x, dz = z - P.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > it.r) return;
      if (y !== undefined && Math.abs(y - P.pos.y) > 2.2) return;
      const facing = d > 0.4 ? (dx * fx + dz * fz) / d : 1;
      if (facing < -0.2) return;
      const score = d - facing * 0.8;
      if (score < bestScore) { bestScore = score; best = it; }
    };
    for (const it of this.items.values()) {
      if (it.enabled && !it.enabled()) continue;
      consider(it, it.x, it.z, it.y);
    }
    // people
    for (const { npc } of G.npcs.near(P.pos.x, P.pos.z, 2.4)) {
      if (npc.def.folk && !G.dialog.has(npc.id)) {
        consider({ id: 'talk:' + npc.id, r: 2.4, prompt: 'Say hello', action: () => G.dialog.folk(npc) }, npc.pos.x, npc.pos.z);
        continue;
      }
      if (!G.dialog.has(npc.id)) continue;
      const nm = CAST[npc.id]?.short || CAST[npc.id]?.name || npc.id;
      const known = G.state.met[npc.id];
      consider({ id: 'talk:' + npc.id, r: 2.4, prompt: known ? `Talk to ${nm}` : 'Talk', action: () => G.dialog.talk(npc.id) }, npc.pos.x, npc.pos.z);
    }
    this.current = best;
    G.hud.prompt = best ? { action: 'interact', text: best.prompt } : null;
    if (best && input.pressed('interact')) {
      this.busy = true;
      G.hud.prompt = null;
      Promise.resolve(best.action()).catch((e) => console.error(e)).finally(() => { this.busy = false; });
    }
  }
}
