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

/** Accept THREE vectors or plain {x, y, z}. */
function vec(v) { return v && !v.isVector3 && typeof v === 'object' && 'x' in v ? new THREE.Vector3(v.x, v.y ?? 0, v.z ?? 0) : v; }

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
    this.fillLight = null;
  }

  /** A soft light riding just above the camera (cinematographer's fill). 0 turns it off. */
  setFill(intensity = 0.6, color = 0xffe4c8, distance = 3.2) {
    if (!this.fillLight) {
      this.fillLight = new THREE.PointLight(color, 0, distance, 2);
      this.scene.add(this.fillLight);
    }
    this.fillLight.color.set(color);
    this.fillLight.distance = distance;
    this.fillLight.intensity = intensity;
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
      to: () => ({ pos: vec(resolve(spec.pos)) || cam.position.clone(), look: vec(resolve(spec.look)) || from.look, fov: spec.fov ?? from.fov }),
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
    // head-and-shoulders, never a nose-to-lens extreme close-up
    const side = o.side ?? 1, dist = Math.max(1.0, (o.dist ?? 0.75) * 1.35), h = o.h ?? 0.03, fov = Math.max(28, o.fov ?? 28);
    return {
      pos: () => {
        const a = this.actors[id];
        if (!a) return this.camera.position.clone();   // not on stage: hold the shot
        const hp = this.headPos(id);
        const q = a.ch.group.getWorldQuaternion(new THREE.Quaternion());
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        const left = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        return hp.clone().addScaledVector(fwd, dist).addScaledVector(left, side * dist * (o.angle ?? 0.45)).add(new THREE.Vector3(0, h, 0));
      },
      look: () => (this.actors[id] ? this.headPos(id).add(new THREE.Vector3(0, -0.02, 0)) : this._look?.clone() || new THREE.Vector3()),
      fov, dofOn: this.actors[id] ? id : undefined, aperture: o.aperture ?? 9, drift: 0.006,
    };
  }

  /** Over the shoulder of `from` looking at `to`. */
  overShoulder(from, to, o = {}) {
    const fov = o.fov ?? 32;
    return {
      pos: () => {
        if (!this.actors[from] || !this.actors[to]) return this.camera.position.clone();
        const a = this.headPos(from), b = this.headPos(to);
        const dir = b.clone().sub(a).normalize();
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        return a.clone().addScaledVector(dir, -0.45).addScaledVector(right, (o.side ?? 1) * 0.32).add(new THREE.Vector3(0, 0.1, 0));
      },
      look: () => (this.actors[to] ? this.headPos(to) : this._look?.clone() || new THREE.Vector3()),
      fov, dofOn: this.actors[to] ? to : undefined, aperture: 6,
    };
  }

  // -------------------------------------------------------------- video calls
  /** The team on a video call (top right). ids: one or several cast ids. */
  call(ids, o = {}) {
    this.callers = (Array.isArray(ids) ? ids : [ids]).map((id) => ({ id }));
    this.callT = 0;
    this.callLabel = o.label || 'BELY MYS  ·  ENCRYPTED';
    return Promise.resolve();
  }

  hangUp() { this.callers = null; return Promise.resolve(); }

  _drawCall(ctx) {
    const n = this.callers.length;
    const tw = n > 2 ? 150 : 210, th = n > 2 ? 112 : 150, cols = n > 2 ? 3 : n;
    const x0 = W - 24 - cols * (tw + 8), y0 = 232;
    const k = Math.min(1, this.callT * 4);
    ctx.save();
    ctx.globalAlpha = k;
    text(ctx, '◉ ' + this.callLabel, W - 24, y0 - 8, { size: 11, weight: 800, color: '#ff6a5a', align: 'right', spacing: 2 });
    this.callers.forEach((c, i) => {
      const x = x0 + (i % cols) * (tw + 8), y = y0 + Math.floor(i / cols) * (th + 8);
      const L = CAST[c.id] || {};
      const talking = voice.subtitle?.who === c.id;
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, '#141a1e'); g.addColorStop(1, '#06080a');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, tw, th);
      // a head and shoulders against the warehouse lamp
      ctx.fillStyle = 'rgba(255,190,120,0.12)';
      ctx.beginPath(); ctx.arc(x + tw * 0.5, y + th * 0.18, th * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = L.color || '#8899aa';
      ctx.globalAlpha = k * 0.85;
      ctx.beginPath(); ctx.ellipse(x + tw / 2, y + th * 0.42, th * 0.15, th * 0.19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + tw / 2, y + th * 1.02, th * 0.42, th * 0.36, 0, Math.PI, 0); ctx.fill();
      ctx.globalAlpha = k;
      for (let yy = y; yy < y + th; yy += 3) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, yy, tw, 1); }
      ctx.strokeStyle = talking ? '#5dffb0' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = talking ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y + th - 22, tw, 22);
      text(ctx, (L.short || L.name || c.id).toUpperCase(), x + 8, y + th - 7, { size: 11, weight: 800, color: '#fff', spacing: 1 });
      if (talking) {
        for (let b = 0; b < 6; b++) {
          const hgt = 3 + Math.abs(Math.sin(this.t * 13 + b * 1.7)) * 10 * (this.lineHandle?.h?.features?.open ?? 0.5 + 0.3);
          ctx.fillStyle = '#5dffb0';
          ctx.fillRect(x + tw - 48 + b * 6, y + th - 11 - hgt / 2, 3, hgt);
        }
      }
    });
    ctx.restore();
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
    if (this.fillLight) this.fillLight.position.copy(this.camera.position).add(new THREE.Vector3(0, 0.25, 0));
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
    if (this.callers) { this.callT = (this.callT || 0) + 1 / 60; this._drawCall(ctx); }
    const sub = voice.subtitle;
    if (sub && this.subsOn) {
      const L = CAST[sub.who];
      const name = (sub.name || L?.short || L?.name || (/^[mf]\d$/.test(sub.who) ? '' : sub.who)).toUpperCase();
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
      if (name || sub.radio) text(ctx, (sub.radio ? '◉ ' : '') + name, W / 2, yy - 4, { size: 15, weight: 800, color: col, align: 'center', spacing: 3 });
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
