// The cutscene director. Scripts are written as beats — who is talking, what
// they say, and how it is framed — and the camera, letterbox, mouth flaps and
// voice blips are worked out from that. Shots are cut, never blended, because
// that is how the show reads.
import * as THREE from 'three';
import { talk, poseRig, charSpec } from './cast.js';
import { sfx } from './audio.js';

export function lineDur(text) {
  return Math.max(1.5, Math.min(5.4, 1.15 + text.length * 0.042));
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class Director {
  constructor({ camera, world }) {
    this.camera = camera;
    this.world = world;
    this.active = false;
    this.script = null;
    this.beat = 0;
    this.t = 0;
    this.resolve = null;
    this.el = {
      cine: document.getElementById('cine'),
      cap: document.getElementById('cine-caption'),
      name: document.querySelector('#cine-caption b'),
      line: document.querySelector('#cine-caption span'),
      title: document.getElementById('cine-title'),
      flash: document.getElementById('gag-flash'),
    };
  }

  /**
   * script: {
   *   title, gag, actors: { id: object3D-ish },
   *   beats: [{ who, line, shot, focus, dur, action }]
   * }
   * A beat's `who` is looked up in script.actors, then in the world.
   */
  play(script) {
    this.script = script;
    this.beat = -1;
    this.t = 0;
    this.active = true;
    this.el.cine.classList.add('show');
    if (script.title) {
      this.el.title.textContent = script.title;
      this.el.title.classList.add('show');
    }
    if (script.gag) {
      sfx.harp();
      this.flash();
    }
    this.next();
    return new Promise((res) => { this.resolve = res; });
  }

  flash() {
    this.el.flash.classList.add('on');
    setTimeout(() => this.el.flash.classList.remove('on'), 90);
  }

  actor(who) {
    if (!who) return null;
    return this.script.actors?.[who] || this.world.actorFor?.(who) || null;
  }

  posOf(who, out) {
    const a = this.actor(who);
    if (!a) return out.set(0, 1.4, 0);
    const p = a.group ? a.group.position : a.position || a;
    const h = a.height || 1.7;
    return out.set(p.x, h * 0.86, p.z);
  }

  /** Work out where the camera goes for this beat's framing. */
  frame(beat) {
    const focus = beat.focus || beat.who;
    this.posOf(focus, _a);
    const other = beat.with || this.otherSpeaker(focus);
    if (other) this.posOf(other, _b); else _b.copy(_a).add(new THREE.Vector3(0, 0, 0.001));
    const shot = beat.shot || 'closeup';
    const dirTo = new THREE.Vector3().subVectors(_b, _a);
    const flat = new THREE.Vector3(dirTo.x, 0, dirTo.z);
    if (flat.lengthSq() < 0.001) flat.set(0, 0, 1);
    flat.normalize();
    const side = new THREE.Vector3(-flat.z, 0, flat.x);
    const t = beat._seed ?? 0;

    if (shot === 'closeup') {
      const pos = _a.clone().add(flat.clone().multiplyScalar(1.9)).add(side.clone().multiplyScalar(0.72 * (t % 2 ? -1 : 1)));
      pos.y = _a.y + 0.18;
      return { pos, look: _a.clone().add(new THREE.Vector3(0, 0.04, 0)) };
    }
    if (shot === 'over') {
      const pos = _b.clone().add(flat.clone().multiplyScalar(-0.9)).add(side.clone().multiplyScalar(0.85));
      pos.y = _b.y + 0.42;
      return { pos, look: _a.clone() };
    }
    if (shot === 'two') {
      const mid = _a.clone().add(_b).multiplyScalar(0.5);
      const pos = mid.clone().add(side.clone().multiplyScalar(3.1)).add(flat.clone().multiplyScalar(0.6));
      pos.y = mid.y + 0.5;
      return { pos, look: mid };
    }
    if (shot === 'low') {
      const pos = _a.clone().add(flat.clone().multiplyScalar(2.6));
      pos.y = 0.5;
      return { pos, look: _a.clone().add(new THREE.Vector3(0, 0.3, 0)) };
    }
    if (shot === 'establish') {
      const pos = _a.clone().add(new THREE.Vector3(9, 7.5, 9));
      return { pos, look: _a.clone() };
    }
    // wide
    const mid = _a.clone().add(_b).multiplyScalar(0.5);
    const pos = mid.clone().add(side.clone().multiplyScalar(5.2)).add(flat.clone().multiplyScalar(1.2));
    pos.y = mid.y + 1.5;
    return { pos, look: mid };
  }

  otherSpeaker(focus) {
    const beats = this.script.beats;
    for (let i = this.beat + 1; i < beats.length; i++) {
      if (beats[i].who && beats[i].who !== focus) return beats[i].who;
    }
    for (let i = this.beat - 1; i >= 0; i--) {
      if (beats[i].who && beats[i].who !== focus) return beats[i].who;
    }
    return null;
  }

  next() {
    this.beat++;
    const beats = this.script.beats;
    if (this.beat >= beats.length) { this.end(); return; }
    const b = beats[this.beat];
    b._seed = this.beat;
    this.t = 0;
    this.dur = b.dur || (b.line ? lineDur(b.line) : 1.4);
    const shot = this.frame(b);
    this.camFrom = shot.pos;
    this.camLook = shot.look;
    this.camera.position.copy(shot.pos);
    this.camera.lookAt(shot.look);
    this.drift = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.5
    );
    if (b.line) {
      const spec = charSpec(b.who);
      this.el.name.textContent = (spec?.short || b.who || '').toUpperCase();
      this.el.line.textContent = b.line;
      this.el.cap.style.display = '';
      const rig = this.actor(b.who);
      if (rig && rig.group) talk(rig, this.dur * 0.85);
      sfx.blip(spec?.voice || 150, this.dur * 0.8);
    } else {
      this.el.cap.style.display = 'none';
    }
    if (b.action) {
      try { b.action(this.world); } catch (e) { console.warn('cutscene action', e); }
    }
    if (this.beat === 1) this.el.title.classList.remove('show');
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    // a slow push keeps a static shot alive
    const k = this.t * 0.16;
    this.camera.position.set(
      this.camFrom.x + this.drift.x * k,
      this.camFrom.y + this.drift.y * k,
      this.camFrom.z + this.drift.z * k
    );
    this.camera.lookAt(this.camLook);
    // keep everyone in shot animated
    const actors = this.script.actors || {};
    for (const id of Object.keys(actors)) {
      const rig = actors[id];
      if (rig?.j) poseRig(rig, rig._clip || 'idle', performance.now() / 1000, { dt });
    }
    if (this.t >= this.dur) this.next();
  }

  skip() {
    if (!this.active) return;
    this.end();
  }

  end() {
    this.active = false;
    this.el.cine.classList.remove('show');
    this.el.title.classList.remove('show');
    const done = this.resolve;
    this.resolve = null;
    if (this.script?.gag) this.flash();
    const script = this.script;
    this.script = null;
    if (script?.onEnd) script.onEnd(this.world);
    if (done) done();
  }
}
