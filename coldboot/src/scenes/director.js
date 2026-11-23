// Cutscene director: actors, voiced lines with subtitles and lip-sync,
// listeners who look at whoever's talking, camera shots with depth of field,
// player choices, fades and letterbox. Scenes are async scripts:
//   await d.say('dmitri', 'w.dmitri.enough', { cam: d.closeUp('dmitri') });
//   const pick = await d.choose(['Who would build that?', 'Why not tell someone?']);
import * as THREE from 'three';
import { game } from '../main.js';
import { voice } from '../audio/voice.js';
import { input } from '../core/input.js';
import { C, W, H, text, panel, measure, actionGlyph } from '../core/ui.js';
import { CAST } from '../data/cast.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Director {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.actors = {};
    this.shot = null;        // current camera move
    this.choice = null;      // pending choice UI
    this.skipping = false;
    this.lineHandle = null;
    this.t = 0;
    this.radioFor = new Set(); // who speaks through the earpiece
    this.subsOn = true;
    this.camShake = 0;
    this._skipHeld = 0;
  }

  addActor(id, ch, anim, opts = {}) {
    this.actors[id] = { id, ch, anim, head: new THREE.Vector3(), external: !!opts.external };
    return this.actors[id];
  }

  removeActor(id) { delete this.actors[id]; }

  headPos(id, out = new THREE.Vector3()) {
    const a = this.actors[id];
    if (!a) return out.set(0, 1.5, 0);
    const h = a.ch.bones.head;
    h.updateWorldMatrix(true, false);
    out.setFromMatrixPosition(h.matrixWorld);
    out.y += 0.06 * a.ch.holder.scale.y;
    return out;
  }

  // -------------------------------------------------------------- camera
  /** Instant cut / move. spec: {pos, look, fov, dof (focus metres) | dofOn: id, dur} */
  cam(spec) {
    const cam = this.camera;
    const from = { pos: cam.position.clone(), look: this._look ? this._look.clone() : new THREE.Vector3(0, 1, 0), fov: cam.fov };
    const resolve = (v) => (typeof v === 'function' ? v() : v);
    this.shot = {
      from, spec, t: 0,
      dur: spec.dur || 0,
      to: () => ({ pos: resolve(spec.pos), look: resolve(spec.look), fov: spec.fov ?? from.fov }),
    };
    if (!spec.dur) this._applyShot(1);
    return new Promise((r) => { this.shot.resolve = r; if (!spec.dur) r(); });
  }

  _applyShot(k) {
    const s = this.shot;
    const to = s.to();
    const e = ease(Math.min(1, k));
    const cam = this.camera;
    if (s.spec.dur) {
      cam.position.lerpVectors(s.from.pos, to.pos, e);
      this._look = (this._look || new THREE.Vector3()).lerpVectors(s.from.look, to.look, e);
      cam.fov = s.from.fov + (to.fov - s.from.fov) * e;
    } else {
      cam.position.copy(to.pos);
      this._look = to.look.clone();
      cam.fov = to.fov;
    }
    // slow handheld drift keeps shots alive
    const dr = s.spec.drift ?? 0.012;
    cam.position.x += Math.sin(this.t * 0.37) * dr;
    cam.position.y += Math.sin(this.t * 0.29 + 1) * dr * 0.6;
    if (this.camShake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.camShake;
      cam.position.y += (Math.random() - 0.5) * this.camShake;
    }
    cam.lookAt(this._look);
    cam.updateProjectionMatrix();
    // depth of field on the subject
    const r = game.renderer;
    if (s.spec.dof === false) r.dof = null;
    else if (s.spec.dofOn || s.spec.dof) {
      const focus = s.spec.dofOn ? cam.position.distanceTo(this.headPos(s.spec.dofOn)) : s.spec.dof;
      r.dof = { focus, aperture: s.spec.aperture ?? 7, maxBlur: s.spec.maxBlur ?? 8 };
    }
  }

  /** Close-up on an actor's face from a side (+1 their left, −1 their right). */
  closeUp(id, o = {}) {
    const side = o.side ?? 1, dist = o.dist ?? 0.75, h = o.h ?? 0.02, fov = o.fov ?? 26;
    return {
      pos: () => {
        const a = this.actors[id];
        const hp = this.headPos(id);
        const q = a.ch.group.getWorldQuaternion(new THREE.Quaternion());
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        const left = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        return hp.clone().addScaledVector(fwd, dist).addScaledVector(left, side * dist * (o.angle ?? 0.45)).add(new THREE.Vector3(0, h, 0));
      },
      look: () => this.headPos(id).add(new THREE.Vector3(0, -0.02, 0)),
      fov, dofOn: id, aperture: o.aperture ?? 9, drift: 0.006,
    };
  }

  /** Over the shoulder of `from` looking at `to`. */
  overShoulder(from, to, o = {}) {
    const fov = o.fov ?? 32;
    return {
      pos: () => {
        const a = this.headPos(from), b = this.headPos(to);
        const dir = b.clone().sub(a).normalize();
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        return a.clone().addScaledVector(dir, -0.45).addScaledVector(right, (o.side ?? 1) * 0.32).add(new THREE.Vector3(0, 0.1, 0));
      },
      look: () => this.headPos(to),
      fov, dofOn: to, aperture: 6,
    };
  }

  // -------------------------------------------------------------- lines
  /**
   * Speak a line. opts: { cam, listeners (ids or 'all'), emo, radio, wait (extra s), gesture }
   */
  async say(who, id, opts = {}) {
    if (this.skipping) return;
    const actor = this.actors[who];
    if (opts.cam) this.cam(typeof opts.cam === 'function' ? opts.cam() : opts.cam);
    const L = voice.line(id);
    const radio = opts.radio ?? this.radioFor.has(who);
    if (actor) {
      const emo = opts.emo || L?.emo;
      this._setEmo(actor, emo);
    }
    // everyone else looks at the speaker
    const listeners = opts.listeners === undefined ? Object.keys(this.actors) : opts.listeners;
    if (actor) {
      for (const lid of listeners) {
        if (lid === who || !this.actors[lid]) continue;
        const la = this.actors[lid];
        if (!la.lockLook) la.anim.lookAt = this.headPos(who);
      }
      if (opts.lookAt) actor.anim.lookAt = typeof opts.lookAt === 'string' ? this.headPos(opts.lookAt) : opts.lookAt;
    }
    const h = voice.play(id, { radio });
    this.lineHandle = { h, actor };
    await Promise.race([h.done, this._skipLine()]);
    h.stop();
    if (actor) { actor.anim.talk = 0; actor.anim.voice.open = 0; }
    this.lineHandle = null;
    await this.wait(opts.wait ?? 0.25);
  }

  _setEmo(actor, emo) {
    const t = actor.anim.exprTarget;
    for (const k of Object.keys(t)) t[k] = 0;
    if (emo === 'smile') t.smile = 0.6;
    if (emo === 'laugh') { t.smile = 1; t.squint = 0.5; }
    if (emo === 'serious') t.frown = 0.25;
    if (emo === 'frown') t.frown = 0.6;
    if (emo === 'worry') t.worry = 0.7;
    if (emo === 'surprise') t.surprise = 0.7;
    if (emo === 'angry') { t.angry = 0.7; t.frown = 0.4; }
  }

  _skipLine() {
    return new Promise((r) => { this._skipResolve = r; });
  }

  wait(s) {
    if (this.skipping) return Promise.resolve();
    return new Promise((r) => { this._waits = this._waits || []; this._waits.push({ t: s, r }); });
  }

  /** Present choices; resolves to the picked index. */
  choose(options, o = {}) {
    if (this.skipping) return Promise.resolve(o.skipTo ?? 0);
    return new Promise((r) => { this.choice = { options, sel: 0, r, t: 0, prompt: o.prompt }; });
  }

  // -------------------------------------------------------------- frame
  update(dt) {
    this.t += dt;
    voice.update(dt);
    if (this.shot) {
      this.shot.t += dt;
      const k = this.shot.dur ? this.shot.t / this.shot.dur : 1;
      this._applyShot(k);
      if (k >= 1 && this.shot.resolve) { const r = this.shot.resolve; this.shot.resolve = null; r(); }
    }
    // lip-sync the current speaker
    if (this.lineHandle?.actor) {
      const { h, actor } = this.lineHandle;
      actor.anim.voice.open = h.features.open;
      actor.anim.voice.wide = h.features.wide;
      actor.anim.voice.round = h.features.round;
      actor.anim.talk = Math.min(1, actor.anim.talk + dt * 2) * (0.6 + 0.4 * h.features.open);
    }
    for (const a of Object.values(this.actors)) if (!a.external) a.anim.update(dt);
    if (this._waits) {
      for (const w of this._waits) { w.t -= dt; if (w.t <= 0) w.r(); }
      this._waits = this._waits.filter((w) => w.t > 0);
    }
    // input: skip line / choices
    if (this.choice) {
      const c = this.choice;
      c.t += dt;
      const n = c.options.length;
      if (input.pressed('up')) c.sel = (c.sel + n - 1) % n;
      if (input.pressed('down')) c.sel = (c.sel + 1) % n;
      for (let i = 0; i < Math.min(4, n); i++) if (input.pressed('choice' + (i + 1))) { c.sel = i; c.pick = true; }
      if (c.t > 0.4 && (input.pressed('confirm') || c.pick || (input.takeClick() && c.hover !== undefined))) {
        const r = c.r;
        const sel = c.sel;
        this.choice = null;
        r(sel);
      }
    } else if (this.lineHandle && this.lineHandle.h.t > 0.35 && (input.pressed('skip') || input.takeClick())) {
      this._skipResolve?.();
    }
  }

  // -------------------------------------------------------------- UI
  draw(ctx) {
    const sub = voice.subtitle;
    if (sub && this.subsOn) {
      const L = CAST[sub.who];
      const name = (L?.short || L?.name || sub.who).toUpperCase();
      const a = sub.fading ? Math.max(0, 1 - (sub.fadeT || 0) / 0.6) : Math.min(1, sub.t * 6);
      ctx.save();
      ctx.globalAlpha = a;
      const y = H - (game.renderer.post.letterbox > 0.5 ? 128 : 112);
      const maxW = 860;
      const lines = wrap(ctx, sub.en, maxW, 24);
      const bh = 30 + lines.length * 30 + (sub.ru ? 22 : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(W / 2 - maxW / 2 - 24, y - bh + 6, maxW + 48, bh + 10);
      let yy = y - bh + 32;
      const col = L?.color || (sub.radio ? '#7fe6ff' : '#ffd479');
      text(ctx, (sub.radio ? '◉ ' : '') + name, W / 2, yy - 4, { size: 15, weight: 800, color: col, align: 'center', spacing: 3 });
      yy += 24;
      for (const ln of lines) { text(ctx, ln, W / 2, yy, { size: 24, weight: 600, color: '#f4f6f8', align: 'center' }); yy += 30; }
      if (sub.ru) text(ctx, sub.ru, W / 2, yy - 2, { size: 14, weight: 500, color: 'rgba(220,225,235,0.55)', align: 'center', italic: true });
      ctx.restore();
    }
    if (this.choice) {
      const c = this.choice;
      const n = c.options.length;
      const bw = 640, rowH = 44;
      const x = W / 2 - bw / 2, y = H - 150 - n * rowH;
      panel(ctx, x - 20, y - 46, bw + 40, n * rowH + 60, { accentLen: 200 });
      text(ctx, c.prompt || 'YOU', x, y - 16, { size: 13, weight: 800, color: C.accent, spacing: 3 });
      c.hover = undefined;
      c.options.forEach((o, i) => {
        const yy = y + i * rowH;
        const on = i === c.sel;
        if (on) { ctx.fillStyle = 'rgba(127,230,255,0.13)'; ctx.fillRect(x - 8, yy, bw + 16, rowH - 6); ctx.fillStyle = C.accent; ctx.fillRect(x - 8, yy, 3, rowH - 6); }
        const m = input.mouse;
        if (m.x > x - 8 && m.x < x + bw + 8 && m.y > yy && m.y < yy + rowH - 6) { if (input.mouse.moved) c.sel = i; c.hover = i; }
        actionGlyph(ctx, 'choice' + (i + 1), x + 4, yy + 19, 10);
        text(ctx, o, x + 44, yy + 26, { size: 19, weight: on ? 700 : 500, color: on ? '#fff' : C.dim });
      });
    }
  }
}

function wrap(ctx, str, maxW, size) {
  const words = String(str).split(/\s+/);
  const out = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (measure(ctx, t, { size, weight: 600 }) > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
