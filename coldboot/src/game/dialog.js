// Conversations in town. Each character's DIALOG is an async script that gets
// a context `c`: c.say(who, lineId), c.you('text'), c.choose([...]),
// c.state, c.rel(n), c.money(n), c.flag(k, v), c.start(mission), c.emit(evt)…
// The camera cuts to over-the-shoulder shots; the person turns to face you.
import * as THREE from 'three';
import { ALL_DIALOGS, FOLK_LINES } from '../data/script/index.js';
import { addRel, relLevel, REL_NAMES } from './state.js';
import { CAST } from '../data/cast.js';
import { voice } from '../audio/voice.js';
import { game } from '../main.js';

export class Dialog {
  constructor(G) {
    this.G = G;
    this.active = null;
    this.youLine = null;
  }

  has(id) { return !!ALL_DIALOGS[id]; }

  _ctx(npc) {
    const G = this.G, d = G.director, s = G.state;
    const self = this;
    const id = npc?.id;
    const c = {
      state: s, G,
      get day() { return s.day; },
      get hour() { return s.hour; },
      get level() { return relLevel(s, id); },
      met: !!s.met[id],
      flag(k, v) { if (v === undefined) return s.flags[k]; s.flags[k] = v; return v; },
      has(k) { return !!s.flags[k]; },
      async say(who, line, opts = {}) {
        const a = d.actors[who];
        if (a && who !== 'player') {
          // over the player's shoulder onto the speaker (same side of the line all conversation)
          if (self._shot !== who) { self._shot = who; d.cam(d.overShoulder('player', who, { side: self.side, fov: 30 })); }
        }
        await d.say(who, line, { radio: opts.radio, emo: opts.emo, listeners: [] });
      },
      async you(text) {
        if (id && self._shot !== 'player') { self._shot = 'player'; d.cam(d.overShoulder(id, 'player', { side: -self.side, fov: 32 })); }
        self.youLine = { s: text, t: 0 };
        await d.wait(Math.min(3.2, 0.9 + text.length / 28));
      },
      async choose(opts, o) {
        const list = opts.filter((x) => typeof x === 'string' || !x.when || x.when());
        const labels = list.map((x) => (typeof x === 'string' ? x : x.label));
        if (id && self._shot !== 'player') { self._shot = 'player'; d.cam(d.overShoulder(id, 'player', { side: -self.side, fov: 34 })); }
        const i = await d.choose(labels, o);
        const pick = list[i];
        return typeof pick === 'string' ? opts.indexOf(pick) : (pick.key ?? opts.indexOf(pick));
      },
      rel(n) {
        if (!id) return;
        const up = addRel(s, id, n);
        if (up) G.hud.toast('FRIENDSHIP', `${CAST[id]?.short || id}: ${REL_NAMES[relLevel(s, id)]}`, '#9fe8b0');
      },
      money(n, why) {
        s.money += n;
        G.hud.toast(n >= 0 ? 'PAID' : 'SPENT', `${n >= 0 ? '+' : '−'}$${Math.abs(n)}${why ? '  ' + why : ''}`, n >= 0 ? '#9fe8b0' : '#ffb21e');
      },
      give(item, n = 1) { s.inv[item] = (s.inv[item] || 0) + n; G.hud.toast('ITEM', `${item.replace(/_/g, ' ')}${n > 1 ? ' ×' + n : ''}`); },
      take(item, n = 1) { if ((s.inv[item] || 0) < n) return false; s.inv[item] -= n; return true; },
      hasItem(item, n = 1) { return (s.inv[item] || 0) >= n; },
      start(mission) { G.missions.start(mission); },
      emit(evt) { G.missions.emit(evt); },
      wait(t) { return d.wait(t); },
      attention(n) { G.attention.add(n); },
      spirit(n) { s.spirit += n; G.hud.toast('TOWN SPIRIT', `+${n}`, '#ffd166'); },
      standing(n) { s.standing += n; G.hud.toast('STANDING', `+${n}`, '#b98cff'); },
    };
    return c;
  }

  /** Talk to a named character. */
  async talk(id) {
    const G = this.G;
    const npc = G.npcs.get(id);
    const script = ALL_DIALOGS[id];
    if (!npc?.ch || !script) return;
    await this.run(npc, (c) => script(c));
    G.state.met[id] = true;
  }

  /** Run any conversation with an NPC (missions call this too). */
  async run(npc, fn) {
    const G = this.G, d = G.director;
    if (this.active) return;
    this.active = npc;
    npc.talking = true;
    G.player.locked = true;
    G.cinematic = true;
    // face each other
    const P = G.player;
    P.yaw = Math.atan2(npc.pos.x - P.pos.x, npc.pos.z - P.pos.z);
    P.ch.group.rotation.y = P.yaw;
    d.addActor('player', P.ch, P.anim, { external: true });
    d.addActor(npc.id, npc.ch, npc.anim, { external: true });
    npc.anim.lookAt = d.headPos('player');
    P.anim.lookAt = d.headPos(npc.id);
    // keep the camera on the side of the line it's already on: no jump across the pair
    const toNpc = Math.atan2(npc.pos.x - P.pos.x, npc.pos.z - P.pos.z);
    const camRight = Math.sin((G.orbit?.lookYaw ?? toNpc) - toNpc) > 0;
    this.side = camRight ? 1 : -1;
    this._shot = npc.id;
    game.renderer.tweakPost({ letterbox: 1 });
    G.hud.prompt = null;
    // ease from the gameplay camera into the first shot
    d.cam({ ...d.overShoulder('player', npc.id, { side: this.side, fov: 30 }), dur: 0.55 });
    try {
      await fn(this._ctx(npc));
    } catch (e) { console.error(e); }
    d.removeActor('player');
    d.removeActor(npc.id);
    npc.talking = false;
    npc.anim.lookAt = null;
    P.anim.lookAt = null;
    G.player.locked = false;
    G.cinematic = false;
    game.renderer.dof = null;
    game.renderer.tweakPost({ letterbox: 0 });
    G.orbit?.snapBehind(P);
    this.active = null;
    G.state.met[npc.id] = true;
  }

  /** A passing remark from a townsperson. */
  async folk(npc) {
    const G = this.G;
    const lines = FOLK_LINES[npc.def.voice] || [];
    const hour = G.state.hour;
    const pool = lines.filter((l) => !l.when || l.when(G.state, hour));
    if (!pool.length) return;
    const L = pool[Math.floor(Math.random() * pool.length)];
    await this.run(npc, async (c) => { await c.say(npc.id, L.id); });
  }

  update(dt) { if (this.youLine) this.youLine.t += dt; }
}

/** The silent protagonist's line, in the subtitle style (drawn by the town screen). */
export function drawYou(ctx, d, W, H, text) {
  const y = d.youLine;
  if (!y) return;
  if (y.t > 3.4) { d.youLine = null; return; }
  const a = Math.min(1, y.t * 5) * Math.min(1, (3.4 - y.t) * 3);
  const boxed = game.renderer.post.letterbox > 0.5;
  const base = boxed ? H - 104 : H - 64;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.translate(W / 2, base - 14);
  ctx.scale(1, 0.12);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 520);
  gr.addColorStop(0, 'rgba(0,0,0,0.38)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.24)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(-520, -520, 1040, 1040);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  text(ctx, 'YOU', W / 2, base - 28, { size: 12, weight: 600, color: '#a9d4b2', align: 'center', spacing: 2.5 });
  text(ctx, y.s, W / 2, base, { size: 23, weight: 500, color: '#f6f7f8', align: 'center' });
  ctx.restore();
}

void THREE; void voice;
