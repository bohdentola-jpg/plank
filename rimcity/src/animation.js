// Keyframe animation for the player rig: poses are joint-euler maps (degrees),
// clips are timed keyframe lists, the Animator samples + crossfades + applies.
// (Same engine that runs VARSITY 27 — proven on Friday nights.)
import * as THREE from 'three';

export const JOINTS = [
  'body', 'hips', 'spine', 'chest', 'neck', 'head',
  'shL', 'shR', 'elL', 'elR',
  'thighL', 'thighR', 'kneeL', 'kneeR', 'ankleL', 'ankleR',
];

const D2R = Math.PI / 180;

export function emptyPose() {
  const p = { y: 0 };
  for (const j of JOINTS) p[j] = [0, 0, 0];
  return p;
}

/** Merge sparse pose spec onto a full zero pose. */
export function P(spec = {}, base = null) {
  const p = base ? clonePose(base) : emptyPose();
  for (const k in spec) {
    if (k === 'y') p.y = spec.y;
    else p[k] = spec[k].slice();
  }
  return p;
}

export function clonePose(p) {
  const o = { y: p.y };
  for (const j of JOINTS) o[j] = p[j].slice();
  return o;
}

export function lerpPose(a, b, t, out) {
  out.y = a.y + (b.y - a.y) * t;
  for (const j of JOINTS) {
    const aj = a[j], bj = b[j], oj = out[j];
    oj[0] = aj[0] + (bj[0] - aj[0]) * t;
    oj[1] = aj[1] + (bj[1] - aj[1]) * t;
    oj[2] = aj[2] + (bj[2] - aj[2]) * t;
  }
  return out;
}

/** Mirror left/right (for handed variants). */
export function mirrorPose(p) {
  const m = emptyPose();
  m.y = p.y;
  const swap = { shL: 'shR', shR: 'shL', elL: 'elR', elR: 'elL', thighL: 'thighR', thighR: 'thighL', kneeL: 'kneeR', kneeR: 'kneeL', ankleL: 'ankleR', ankleR: 'ankleL' };
  for (const j of JOINTS) {
    const src = p[swap[j] || j];
    m[j] = [src[0], -src[1], -src[2]];
  }
  return m;
}

/** clip(duration, loop, [[t, poseSpec], ...]) — t in 0..1, keys sorted. */
export function clip(dur, loop, frames) {
  return { dur, loop, keys: frames.map(([t, p]) => ({ t, p })) };
}

const ease = (t) => t * t * (3 - 2 * t);

function sampleClip(c, phase, out) {
  const keys = c.keys;
  if (phase <= keys[0].t && !c.loop) { lerpPose(keys[0].p, keys[0].p, 0, out); return; }
  let a = keys[keys.length - 1], b = keys[0], span, local;
  if (c.loop) {
    // wrap segment from last key to first key + 1
    for (let i = 0; i < keys.length; i++) {
      const k0 = keys[i], k1 = keys[(i + 1) % keys.length];
      const t1 = (i + 1 === keys.length) ? k1.t + 1 : k1.t;
      if (phase >= k0.t && phase <= t1) { a = k0; b = k1; span = t1 - k0.t; local = phase - k0.t; break; }
    }
  } else {
    a = keys[0]; b = keys[keys.length - 1]; span = 1; local = phase;
    for (let i = 0; i < keys.length - 1; i++) {
      if (phase >= keys[i].t && phase <= keys[i + 1].t) {
        a = keys[i]; b = keys[i + 1]; span = b.t - a.t; local = phase - a.t; break;
      }
    }
    if (phase >= keys[keys.length - 1].t) { a = b = keys[keys.length - 1]; span = 1; local = 0; }
  }
  const t = span > 0 ? ease(Math.min(1, Math.max(0, local / span))) : 0;
  lerpPose(a.p, b.p, t, out);
}

export class Animator {
  constructor(rig, clips) {
    this.rig = rig;
    this.clips = clips;
    this.name = null;
    this.t = 0;
    this.rate = 1;
    this.done = false;
    this.onDone = null;
    this._pose = emptyPose();
    this._from = null;   // crossfade source pose
    this._fadeT = 0;
    this._fadeDur = 0;
    this.overlays = [];  // fns(pose) applied after sampling
    this.play('idle');
  }

  play(name, { fade = 0.12, rate = 1, force = false, onDone = null, startAt = 0 } = {}) {
    if (name === this.name && !force) { this.rate = rate; return; }
    if (!this.clips[name]) return;
    if (this.name) {
      this._from = clonePose(this._pose);
      this._fadeT = 0;
      this._fadeDur = fade;
    }
    this.name = name;
    this.t = startAt * this.clips[name].dur;
    this.rate = rate;
    this.done = false;
    this.onDone = onDone;
  }

  /** 0..1 progress through the current clip. */
  get phase() {
    const c = this.clips[this.name];
    if (!c) return 0;
    return c.loop ? (this.t / c.dur) % 1 : Math.min(1, this.t / c.dur);
  }

  /** True if playing a non-looping clip that has finished. */
  get finished() { return this.done; }

  update(dt) {
    const c = this.clips[this.name];
    if (!c) return;
    this.t += dt * this.rate;
    let phase;
    if (c.loop) {
      phase = (this.t / c.dur) % 1;
      if (phase < 0) phase += 1;
    } else {
      phase = Math.min(1, this.t / c.dur);
      if (phase >= 1 && !this.done) {
        this.done = true;
        if (this.onDone) { const f = this.onDone; this.onDone = null; f(); }
      }
    }
    sampleClip(c, phase, this._pose);
    if (this._from) {
      this._fadeT += dt;
      const f = Math.min(1, this._fadeT / this._fadeDur);
      lerpPose(this._from, this._pose, ease(f), this._pose);
      if (f >= 1) this._from = null;
    }
    for (const fn of this.overlays) fn(this._pose, this);
    this.apply(this._pose);
  }

  apply(p) {
    const j = this.rig.j;
    j.hips.position.y = 1.04 + p.y;
    for (const name of JOINTS) {
      const g = j[name];
      if (!g) continue;
      const e = p[name];
      g.rotation.set(e[0] * D2R, e[1] * D2R, e[2] * D2R);
    }
  }
}

/** Overlay: aim the head (yaw/pitch degrees from a getter). */
export function lookOverlay(getLook) {
  return (pose) => {
    const l = getLook();
    if (!l) return;
    pose.head = [
      Math.max(-28, Math.min(28, pose.head[0] + l.pitch)),
      Math.max(-70, Math.min(70, pose.head[1] + l.yaw)),
      pose.head[2],
    ];
    pose.neck = [pose.neck[0], Math.max(-30, Math.min(30, pose.neck[1] + l.yaw * 0.4)), pose.neck[2]];
  };
}
