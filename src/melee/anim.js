// Pose/clip system for the chunky mascot rigs. Same shape as the football
// game's animation.js, but with the fighter joint set and two additions the
// fighting game needs: whole-body spin (the `root` joint) and clip playback at
// a forced duration, so one animation can be stretched to fit a move's exact
// frame count.
//
// Conventions (rig faces +Z, same as the football rigs):
//   thigh/shoulder forward swing = -rx · knee flex = +rx · elbow flex = -rx
//   torso forward lean = +rx · left arm out = -rz (right = +rz)
//   root +rx = forward somersault · y = hip height delta (units)

export const JOINTS = [
  'root', 'hips', 'torso', 'head',
  'shL', 'elL', 'shR', 'elR',
  'hipL', 'kneeL', 'hipR', 'kneeR',
  'tail', 'ext',
];

const D2R = Math.PI / 180;

export function emptyPose() {
  const p = { y: 0 };
  for (const j of JOINTS) p[j] = [0, 0, 0];
  return p;
}

/** Merge a sparse pose spec onto a base pose (or a zero pose). */
export function P(spec = {}, base = null) {
  const p = base ? clonePose(base) : emptyPose();
  for (const k in spec) {
    if (k === 'y') p.y = spec.y;
    else if (p[k]) p[k] = spec[k].slice();
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

const MIRROR = {
  shL: 'shR', shR: 'shL', elL: 'elR', elR: 'elL',
  hipL: 'hipR', hipR: 'hipL', kneeL: 'kneeR', kneeR: 'kneeL',
};

/** Mirror left/right for the other half of a walk cycle. */
export function mirrorPose(p) {
  const m = emptyPose();
  m.y = p.y;
  for (const j of JOINTS) {
    const src = p[MIRROR[j] || j];
    m[j] = [src[0], -src[1], -src[2]];
  }
  return m;
}

/** clip(duration_seconds, loop, [[t, pose], ...]) — t in 0..1, keys sorted. */
export function clip(dur, loop, frames) {
  return { dur, loop, keys: frames.map(([t, p]) => ({ t, p })) };
}

const ease = (t) => t * t * (3 - 2 * t);

function sampleClip(c, phase, out) {
  const keys = c.keys;
  if (keys.length === 1) { lerpPose(keys[0].p, keys[0].p, 0, out); return; }
  let a = keys[0], b = keys[keys.length - 1], span = 1, local = phase;
  if (c.loop) {
    for (let i = 0; i < keys.length; i++) {
      const k0 = keys[i], k1 = keys[(i + 1) % keys.length];
      const t1 = (i + 1 === keys.length) ? k1.t + 1 : k1.t;
      if (phase >= k0.t && phase <= t1) { a = k0; b = k1; span = t1 - k0.t; local = phase - k0.t; break; }
    }
  } else {
    for (let i = 0; i < keys.length - 1; i++) {
      if (phase >= keys[i].t && phase <= keys[i + 1].t) {
        a = keys[i]; b = keys[i + 1]; span = b.t - a.t; local = phase - a.t; break;
      }
    }
    if (phase >= keys[keys.length - 1].t) { a = b = keys[keys.length - 1]; span = 1; local = 0; }
    else if (phase <= keys[0].t) { a = b = keys[0]; span = 1; local = 0; }
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
    this.dur = 1;
    this.done = false;
    this._pose = emptyPose();
    this._from = null;
    this._fadeT = 0;
    this._fadeDur = 0;
    this.overlays = [];
    this.play('idle', { fade: 0 });
  }

  /**
   * name    clip key
   * dur     force the clip to run this long in seconds (moves do this so the
   *         animation always lines up with the frame data)
   */
  play(name, { fade = 0.08, rate = 1, force = false, dur = null } = {}) {
    const c = this.clips[name];
    if (!c) return false;
    if (name === this.name && !force) { this.rate = rate; if (dur) this.dur = dur; return true; }
    if (this.name && fade > 0) {
      this._from = clonePose(this._pose);
      this._fadeT = 0;
      this._fadeDur = fade;
    } else {
      this._from = null;
    }
    this.name = name;
    this.t = 0;
    this.rate = rate;
    this.dur = dur || c.dur;
    this.done = false;
    return true;
  }

  /** Jump a non-looping clip to a normalized position (move frame → pose). */
  seek(phase) { this.t = Math.max(0, Math.min(1, phase)) * this.dur; }

  update(dt) {
    const c = this.clips[this.name];
    if (!c) return;
    this.t += dt * this.rate;
    let phase;
    if (c.loop) {
      phase = (this.t / this.dur) % 1;
      if (phase < 0) phase += 1;
    } else {
      phase = Math.min(1, this.t / this.dur);
      if (phase >= 1) this.done = true;
    }
    sampleClip(c, phase, this._pose);
    if (this._from) {
      this._fadeT += dt;
      const f = this._fadeDur > 0 ? Math.min(1, this._fadeT / this._fadeDur) : 1;
      lerpPose(this._from, this._pose, ease(f), this._pose);
      if (f >= 1) this._from = null;
    }
    for (const fn of this.overlays) fn(this._pose, this);
    this.apply(this._pose);
  }

  apply(p) {
    const j = this.rig.j;
    if (j.hips) j.hips.position.y = this.rig.hipY + p.y;
    for (const name of JOINTS) {
      const g = j[name];
      if (!g) continue;
      const e = p[name];
      g.rotation.set(e[0] * D2R, e[1] * D2R, e[2] * D2R);
    }
  }
}
