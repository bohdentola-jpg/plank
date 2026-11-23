// Cutscene director: actors, voiced lines with subtitles and lip-sync,
// listeners who look at whoever's talking, camera shots with depth of field,
// player choices, fades and letterbox. Scenes are async scripts:
//   await d.say('dmitri', 'w.dmitri.enough', { cam: d.closeUp('dmitri') });
//   const pick = await d.choose(['Who would build that?', 'Why not tell someone?']);
import * as THREE from 'three';
import { game } from '../main.js';
import { voice } from '../audio/voice.js';
import { input } from '../core/input.js';
import { C, W, H, text, measure, actionGlyph, roundRect, tone } from '../core/ui.js';
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
    if (typeof window !== 'undefined') { window.__cuts = (window.__cuts || 0) + 1; window.__cutAt = performance.now(); window.__cutDur = spec?.dur || 0; }   // QA: tools/shotlog.mjs
    // a fixed shot whose lens sits right behind a wall, a post or a lamp: step it
    // past the obstruction toward what it looks at (the look point itself may be
    // inside a building, so only something close to the lens counts)
    if (spec && spec.clear !== false && spec.pos && spec.look && typeof spec.pos !== 'function' && typeof spec.look !== 'function') {
      const P = vec(spec.pos), L = vec(spec.look);
      if (P?.isVector3 && L?.isVector3) {
        const full = P.distanceTo(L);
        const near = Math.min(1.6, full * 0.3);
        const c = this.clearDist(P, L.clone().sub(P).normalize().multiplyScalar(near).add(P));
        if (c < near - 0.02) {
          const step = Math.min(full * 0.6, c + 0.45);
          spec = { ...spec, pos: P.clone().lerp(L, step / full) };
        }
      }
    }
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

  /** Stop driving the camera: the scene is over and gameplay owns it again. */
  release() {
    if (this.shot?.resolve) { const r = this.shot.resolve; this.shot.resolve = null; r(); }
    this.shot = null;
    this._look = null;
    game.renderer.dof = null;
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
    else if (s.spec.dofOn && !this.actors[s.spec.dofOn]) r.dof = null;   // subject left the stage: no focus to hold
    else if (s.spec.dofOn || s.spec.dof) {
      const focus = s.spec.dofOn ? cam.position.distanceTo(this.headPos(s.spec.dofOn)) : s.spec.dof;
      // a face more than 25 m from the lens isn't what this shot is about: no blur
      r.dof = s.spec.dofOn && focus > 25 ? null : { focus, aperture: s.spec.aperture ?? 7, maxBlur: s.spec.maxBlur ?? 8 };
    }
  }

  /**
   * How far from `from` toward `to` the view is clear of solid scenery (walls,
   * lamps, furniture). People, the sky, glass and particles don't block.
   */
  clearDist(from, to) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 1e-3 || !this.scene) return len;
    dir.divideScalar(len);
    const rc = this._rc || (this._rc = new THREE.Raycaster());
    rc.set(from, dir);
    rc.near = 0.12;
    rc.far = len;
    let hits;
    try { hits = rc.intersectObject(this.scene, true); } catch { return len; }
    for (const h of hits) {
      const ob = h.object;
      if (!ob.isMesh || ob.isSkinnedMesh || ob.isInstancedMesh && ob.count === 0) continue;
      const m = Array.isArray(ob.material) ? ob.material[0] : ob.material;
      if (!m || m.side === THREE.BackSide || m.transparent || m.depthWrite === false || m.colorWrite === false) continue;
      let p = ob, skip = false;
      for (; p; p = p.parent) {
        if (!p.visible || p.userData?.noBlock || (p.name && p.name.startsWith('person'))) { skip = true; break; }
      }
      if (skip) continue;
      return h.distance;
    }
    return len;
  }

  /** Close-up on an actor's face from a side (+1 their left, −1 their right). */
  closeUp(id, o = {}) {
    // head-and-shoulders, never a nose-to-lens extreme close-up
    const dist = Math.max(1.0, (o.dist ?? 0.75) * 1.35), h = o.h ?? 0.03, fov = Math.max(28, o.fov ?? 28);
    let side = o.side ?? 1, pull = 1, decided = false;
    let fwdFix = null;   // where the face points when the shot starts (held for the shot)
    const faceDir = (a) => {
      const q = a.ch.group.getWorldQuaternion(new THREE.Quaternion());
      const body = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const hb = a.ch.bones?.Bip01_Head, hf = a.anim?.headFwd;
      if (hb && hf) {
        const head = hf.clone().applyQuaternion(hb.getWorldQuaternion(new THREE.Quaternion()));
        head.y = 0;
        if (head.lengthSq() > 1e-4) body.multiplyScalar(0.4).addScaledVector(head.normalize(), 0.6);
      }
      body.y = 0;
      return body.lengthSq() > 1e-6 ? body.normalize() : new THREE.Vector3(0, 0, 1);
    };
    const at = (a, sd, k) => {
      const hp = this.headPos(id);
      const fwd = fwdFix || faceDir(a);
      const left = new THREE.Vector3(fwd.z, 0, -fwd.x);   // the subject's left
      return hp.clone().addScaledVector(fwd, dist * k).addScaledVector(left, sd * dist * k * (o.angle ?? 0.45)).add(new THREE.Vector3(0, h, 0));
    };
    return {
      pos: () => {
        const a = this.actors[id];
        if (!a) return this.camera.position.clone();   // not on stage: hold the shot
        if (!decided) {
          // keep the face clear: if scenery sits between face and lens, take the other
          // side; if both are blocked, come in closer than the obstruction
          decided = true;
          fwdFix = faceDir(a);
          const hp = this.headPos(id);
          const want = at(a, side, 1);
          const full = hp.distanceTo(want);
          const c1 = this.clearDist(hp, want);
          if (c1 < full - 0.05) {
            const alt = at(a, -side, 1);
            const c2 = this.clearDist(hp, alt);
            if (c2 >= full - 0.05) side = -side;
            else {
              if (c2 > c1) side = -side;
              pull = Math.max(0.55, (Math.max(c1, c2) - 0.15) / full);
            }
          }
        }
        return at(a, side, pull);
      },
      look: () => (this.actors[id] ? this.headPos(id).add(new THREE.Vector3(0, -0.02, 0)) : this._look?.clone() || new THREE.Vector3()),
      fov, dofOn: this.actors[id] ? id : undefined, aperture: o.aperture ?? 9, drift: 0.006,
    };
  }

  /**
   * Over the shoulder of `from` looking at `to`. Two people talking face to face
   * need to be near each other: if the player is one of them and stands far away,
   * the scene's stagePlayer() hook walks them over first; if they're still apart,
   * the shot becomes a close-up on `to` (never a long lens across the town).
   */
  overShoulder(from, to, o = {}) {
    const fov = o.fov ?? 32;
    const apart = () => (this.actors[from] && this.actors[to] ? this.headPos(from).distanceTo(this.headPos(to)) : 0);
    if (apart() > 5 && this.stagePlayer && (from === 'player' || to === 'player')) {
      try { this.stagePlayer(from === 'player' ? to : from); } catch (e) { console.error(e); }
    }
    let cu = null;
    const far = () => {
      if (apart() <= 5) return false;
      cu ||= this.closeUp(to, { side: o.side ?? 1 });
      return true;
    };
    return {
      pos: () => {
        if (!this.actors[from] || !this.actors[to]) return this.camera.position.clone();
        if (far()) return cu.pos();
        const a = this.headPos(from), b = this.headPos(to);
        const dir = b.clone().sub(a).normalize();
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        return a.clone().addScaledVector(dir, -0.45).addScaledVector(right, (o.side ?? 1) * 0.32).add(new THREE.Vector3(0, 0.1, 0));
      },
      look: () => {
        if (this.actors[to] && far()) return cu.look();
        return this.actors[to] ? this.headPos(to) : this._look?.clone() || new THREE.Vector3();
      },
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
    // an encrypted call: one card per caller, initials, a ring while they speak
    const n = this.callers.length;
    const tw = n > 2 ? 132 : 168, th = n > 2 ? 132 : 150, cols = n > 2 ? 3 : n;
    const x0 = W - 40 - cols * (tw + 8) + 8, y0 = 168;
    const k = Math.min(1, this.callT * 4);
    ctx.save();
    ctx.globalAlpha = k;
    text(ctx, (this.callLabel || 'Secure call').toUpperCase(), W - 40, y0 - 12, { size: 11, weight: 600, color: C.dim, align: 'right', spacing: 2 });
    ctx.fillStyle = C.red;
    ctx.beginPath(); ctx.arc(W - 40 - measure(ctx, (this.callLabel || 'Secure call').toUpperCase(), { size: 11, weight: 600, spacing: 2 }) - 12, y0 - 16, 3.5, 0, Math.PI * 2); ctx.fill();
    this.callers.forEach((c, i) => {
      const x = x0 + (i % cols) * (tw + 8), y = y0 + Math.floor(i / cols) * (th + 8);
      const L = CAST[c.id] || {};
      const talking = voice.subtitle?.who === c.id;
      roundRect(ctx, x, y, tw, th, 8);
      ctx.fillStyle = 'rgba(12,14,18,0.86)';
      ctx.fill();
      ctx.strokeStyle = talking ? C.accent : 'rgba(255,255,255,0.10)';
      ctx.lineWidth = talking ? 1.5 : 1;
      ctx.stroke();
      const cx = x + tw / 2, cy = y + th * 0.42, r = th * 0.22;
      if (talking) {
        const pulse = 1 + 0.08 * Math.abs(Math.sin(this.t * 9));
        ctx.strokeStyle = 'rgba(231,167,64,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, r * pulse + 5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#2a3038';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      const nm = L.short || L.name || c.id;
      const initials = nm.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      text(ctx, initials, cx, cy + r * 0.36, { size: Math.round(r * 0.95), weight: 500, color: '#dfe4e9', align: 'center', shadow: false });
      text(ctx, nm, cx, y + th - 16, { size: 13, weight: 500, color: talking ? '#fff' : C.dim, align: 'center' });
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
      if (opts.gesture) actor.anim.play?.(opts.gesture, { upper: true });   // a scripted mocap gesture
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
    return new Promise((r) => {
      this.choice = { options, sel: 0, r, t: 0, prompt: o.prompt };
      // QA runs (tools/shotlog.mjs) answer with the first option after a beat
      if (typeof window !== 'undefined' && window.__qaAuto) setTimeout(() => { if (this.choice?.r === r) { this.choice = null; r(0); } }, 1500);
    });
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
      const name = sub.name || L?.short || L?.name || (/^[mf]\d$/.test(sub.who) ? '' : sub.who);
      const a = sub.fading ? Math.max(0, 1 - (sub.fadeT || 0) / 0.6) : Math.min(1, sub.t * 6);
      ctx.save();
      ctx.globalAlpha = a;
      const boxed = game.renderer.post.letterbox > 0.5;
      const maxW = 900;
      const lines = wrap(ctx, sub.en, maxW, 23);
      const ruH = sub.ru ? 22 : 0;
      // bottom of the text block sits above the cinema bar (or the screen edge)
      const bottom = boxed ? H - 104 : H - 64;
      let yy = bottom - ruH - (lines.length - 1) * 30;
      // a soft dark pool behind the words, no box
      const top = yy - (name ? 50 : 30);
      const midY = (top + bottom + 16) / 2, rx = maxW * 0.62, ry = Math.max(40, (bottom + 16 - top) * 0.75);
      ctx.save();
      ctx.translate(W / 2, midY);
      ctx.scale(1, ry / rx);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, 'rgba(0,0,0,0.38)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.26)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore();
      const col = sub.radio ? C.cyan : (L?.color ? tone(L.color) : '#e9c58a');
      if (name || sub.radio) text(ctx, (sub.radio ? 'EARPIECE  ·  ' : '') + name.toUpperCase(), W / 2, yy - 28, { size: 12, weight: 600, color: col, align: 'center', spacing: 2.5 });
      for (const ln of lines) { text(ctx, ln, W / 2, yy, { size: 23, weight: 500, color: '#f6f7f8', align: 'center' }); yy += 30; }
      if (sub.ru) text(ctx, sub.ru, W / 2, yy - 6, { size: 14, weight: 400, color: 'rgba(225,230,235,0.6)', align: 'center' });
      ctx.restore();
    }
    if (this.choice) {
      const c = this.choice;
      const n = c.options.length;
      const bw = 600, rowH = 46;
      const x = W / 2 - bw / 2, y = H - 120 - n * rowH;
      text(ctx, (c.prompt || 'Your answer').toUpperCase(), x, y - 14, { size: 11, weight: 600, color: C.accent, spacing: 2.5 });
      c.hover = undefined;
      c.options.forEach((o, i) => {
        const yy = y + i * rowH;
        const on = i === c.sel;
        roundRect(ctx, x, yy, bw, rowH - 8, 6);
        ctx.fillStyle = on ? 'rgba(20,23,28,0.92)' : 'rgba(10,12,15,0.66)';
        ctx.fill();
        if (on) { ctx.fillStyle = C.accent; ctx.fillRect(x, yy + 6, 2, rowH - 20); }
        const m = input.mouse;
        if (m.x > x && m.x < x + bw && m.y > yy && m.y < yy + rowH - 8) { if (input.mouse.moved) c.sel = i; c.hover = i; }
        actionGlyph(ctx, 'choice' + (i + 1), x + 14, yy + (rowH - 8) / 2, 9.5);
        text(ctx, o, x + 52, yy + 25, { size: 17, weight: on ? 500 : 400, color: on ? '#fff' : '#c3cad1' });
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
