// Procedural animation for people: locomotion from human gait curves, idles,
// sitting, talking gestures, look-at, and the face (blinks, saccades,
// lip-sync from the voice's amplitude/spectrum, expressions). Built on
// PoseRig (pose.js): every frame each layer writes a pose spec, which is
// resolved once and applied to the bones.
import * as THREE from 'three';
import { PoseRig, handCurl } from './pose.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);

/** Periodic Catmull-Rom over [phase, value] keys (phase 0..1). */
function curve(keys) {
  const n = keys.length;
  return (p) => {
    p = ((p % 1) + 1) % 1;
    let i = 0;
    while (i < n - 1 && keys[i + 1][0] <= p) i++;
    const k0 = keys[(i - 1 + n) % n], k1 = keys[i], k2 = keys[(i + 1) % n], k3 = keys[(i + 2) % n];
    const x1 = k1[0], x2 = i + 1 < n ? k2[0] : k2[0] + 1;
    const t = (p - x1) / (x2 - x1 || 1);
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * k1[1]) + (-k0[1] + k2[1]) * t + (2 * k0[1] - 5 * k1[1] + 4 * k2[1] - k3[1]) * t2 + (-k0[1] + 3 * k1[1] - 3 * k2[1] + k3[1]) * t3);
  };
}

// gait (phase 0 = this foot's heel strike; stance 0–0.6, swing 0.6–1)
const WALK = {
  hip: curve([[0, 24], [0.15, 18], [0.4, 0], [0.6, -12], [0.75, 6], [0.88, 26]]),
  knee: curve([[0, 3], [0.15, 16], [0.4, 5], [0.6, 36], [0.72, 62], [0.85, 30], [0.95, 2]]),
  ankle: curve([[0, -2], [0.1, -8], [0.45, 10], [0.62, -18], [0.75, -2], [0.9, 2]]),
};
const RUN = {
  hip: curve([[0, 30], [0.2, 8], [0.38, -14], [0.55, 10], [0.75, 52], [0.9, 42]]),
  knee: curve([[0, 22], [0.12, 38], [0.35, 18], [0.5, 70], [0.65, 110], [0.82, 70], [0.95, 25]]),
  ankle: curve([[0, -6], [0.15, 12], [0.35, -22], [0.55, -8], [0.8, 4]]),
};

function rotX(deg) {
  const a = deg * D2R;
  return [0, -Math.cos(a), Math.sin(a)];
}

export class Animator {
  constructor(ch) {
    this.ch = ch;
    this.rig = new PoseRig(ch);
    this.t = Math.random() * 10;
    this.speed = 0;          // m/s along the ground
    this.targetSpeed = 0;
    this.phase = 0;
    this.posture = 'stand';  // stand | sit | crouch | drive | lie
    this.postureW = { stand: 1, sit: 0, crouch: 0, drive: 0, lie: 0 };
    this.lookAt = null;      // THREE.Vector3 (world) or null
    this.lookW = 0;
    this.talk = 0;           // 0..1 speaking energy (from the voice)
    this.voice = { open: 0, wide: 0, round: 0 };
    this.expr = { smile: 0, frown: 0, worry: 0, surprise: 0, angry: 0, squint: 0 };
    this.exprTarget = { ...this.expr };
    this.blinkT = 2 + Math.random() * 3;
    this.blink = 0;
    this.sacc = new THREE.Vector2();
    this.saccT = 0.5;
    this.gesture = null;     // {name, t, dur}
    this.override = null;    // (pose, anim) => void : scripted poses (typing, holding…)
    this.legLen = this._legLength();
    this.turn = 0;           // rad/s, for leaning into turns
    this.fidget = Math.random();
    this.sitHeight = 0.46;
    this.armsCrossed = 0;
    this.handsOnTable = 0;
    this.headTilt = 0;
    this._tmpV = new THREE.Vector3();
  }

  _legLength() {
    const g = (n) => new THREE.Vector3().setFromMatrixPosition(this.ch.bones[n].userData.global);
    return g('upperleg01.L').distanceTo(g('lowerleg01.L')) + g('lowerleg01.L').distanceTo(g('foot.L'));
  }

  setPosture(p) { this.posture = p; }
  say(level) { this.talk = level; }

  update(dt) {
    this.t += dt;
    const ch = this.ch;
    // posture weights ease in
    for (const k of Object.keys(this.postureW)) this.postureW[k] = damp(this.postureW[k], k === this.posture ? 1 : 0, 6, dt);
    this.speed = damp(this.speed, this.targetSpeed, 5, dt);
    const v = Math.abs(this.speed);
    const runK = clamp((v - 2.0) / 1.6, 0, 1);
    const strideLen = this.legLen * lerp(1.65, 2.6, runK) * (0.75 + 0.25 * clamp(v / 1.4, 0, 1.5));
    this.phase = (this.phase + (v / Math.max(strideLen, 0.3)) * dt) % 1;
    const moveK = clamp(v / 0.5, 0, 1);

    const pose = {};
    const sit = this.postureW.sit, drive = this.postureW.drive, crouch = this.postureW.crouch;
    const seated = Math.max(sit, drive);
    const t = this.t;

    // ---------------------------------------------------------------- legs
    const legs = (side, ph) => {
      const s = side === 'L' ? 1 : -1;
      const w = WALK, r = RUN;
      let hip = lerp(w.hip(ph), r.hip(ph), runK) * moveK;
      let knee = lerp(w.knee(ph), r.knee(ph), runK) * moveK + 3;
      let ankle = lerp(w.ankle(ph), r.ankle(ph), runK) * moveK;
      // idle weight shift: one knee softens
      const shift = Math.sin(t * 0.35 + this.fidget * 6) * (1 - moveK);
      knee += Math.max(0, shift * s) * 7;
      // crouch
      hip = lerp(hip, 75, crouch); knee = lerp(knee, 120, crouch); ankle = lerp(ankle, 30, crouch);
      // seated
      hip = lerp(hip, 88, seated); knee = lerp(knee, 92 - (drive ? 15 : 0), seated); ankle = lerp(ankle, 4, seated);
      const spread = s * (0.03 + seated * 0.12);
      const th = rotX(hip);
      pose[`upperleg01.${side}`] = { aim: [-spread * 0.6 + th[0], th[1], th[2]] };
      const sh = rotX(hip - knee);
      pose[`lowerleg01.${side}`] = { aim: [-spread * 0.2 + sh[0], sh[1], sh[2]] };
      const fa = (hip - knee + ankle) * D2R;
      // foot pitch: rotate the rest foot direction about X
      const base = new THREE.Vector3(s * 0.12, -0.45, 0.9).normalize().applyAxisAngle(new THREE.Vector3(1, 0, 0), -fa * 0.85);
      pose[`foot.${side}`] = { aim: [base.x, base.y, base.z] };
    };
    legs('L', this.phase);
    legs('R', (this.phase + 0.5) % 1);

    // ---------------------------------------------------------------- hips
    const bob = moveK * lerp(0.022, 0.05, runK) * (Math.cos(this.phase * TAU * 2) * -1) * 0.5;
    const sway = moveK * 0.018 * Math.sin(this.phase * TAU) * (1 - runK * 0.5);
    const idleSway = (1 - moveK) * 0.012 * Math.sin(t * 0.35 + this.fidget * 6);
    let rootY = bob - moveK * lerp(0.01, 0.05, runK) - crouch * 0.42;
    const rootZ = seated * -0.06;
    rootY -= seated * (0.92 * ch.holder.scale.y - this.sitHeight - 0.08) * 1.0;
    pose.root = { p: [sway + idleSway, rootY, rootZ], e: [0, 0, 0] };
    pose.root.e = [0, moveK * 6 * Math.sin(this.phase * TAU) * (1 - runK * 0.4), 0];
    pose.root = { p: pose.root.p };

    // ---------------------------------------------------------------- spine
    const breath = Math.sin(t * TAU * 0.24) * (1 - runK * 0.5);
    const lean = runK * 12 + moveK * 3 + crouch * 25 + seated * (this.handsOnTable ? 10 : -4);
    const twist = moveK * 7 * Math.sin(this.phase * TAU + Math.PI);
    pose.spine05 = { e: [lean * 0.15, -twist * 0.5, 0] };
    pose.spine04 = { e: [lean * 0.25, -twist * 0.3, 0] };
    pose.spine03 = { e: [lean * 0.25 + breath * 0.6, twist * 0.2, this.turn * -3] };
    pose.spine02 = { e: [lean * 0.2 - breath * 0.8, twist * 0.3, 0] };
    pose.spine01 = { e: [lean * 0.1 - breath * 0.6, twist * 0.4, 0] };
    // head steadies against the trunk, then looks
    const nod = this.talk * Math.sin(t * 7.3) * 2.2 + Math.sin(t * 0.7 + this.fidget) * 1.2;
    pose.neck01 = { e: [-lean * 0.35 + nod * 0.4, -twist * 0.5, 0] };
    pose.head = { e: [-lean * 0.2 + nod * 0.6, -twist * 0.4, this.headTilt] };

    // ---------------------------------------------------------------- arms
    const arm = (side, ph) => {
      const s = side === 'L' ? 1 : -1;
      const swing = moveK * lerp(16, 45, runK) * Math.sin((ph + 0.5) * TAU) * -1;
      const out = 0.12 + runK * 0.06 + crouch * 0.1;
      let up = rotX(swing);
      let elbow = lerp(12, 88, runK) + moveK * 8 * (1 - runK) + Math.max(0, swing) * 0.3;
      // talking: one or both hands come up a little, open palms, beats
      const tk = this.talk * (1 - moveK);
      const beat = Math.sin(t * 4.1 + (s > 0 ? 0 : 1.7)) * 0.5 + 0.5;
      const gestureSide = s > 0 ? 0.6 + 0.4 * Math.sin(t * 0.6) : 0.4 + 0.4 * Math.sin(t * 0.6 + 2);
      const g = tk * gestureSide;
      up = [up[0], up[1], up[2] + g * 0.35];
      elbow = lerp(elbow, 70 + beat * 18, g);
      // seated: hands on the table or lap
      if (seated > 0.01) {
        const tab = this.handsOnTable;
        up = [lerp(up[0], s * 0.05, seated), lerp(up[1], -1, seated), lerp(up[2], tab ? 0.45 : 0.25, seated)];
        elbow = lerp(elbow, tab ? 75 + g * 25 : 55, seated);
      }
      // arms crossed
      if (this.armsCrossed > 0.01) {
        const k = this.armsCrossed;
        up = [lerp(up[0], s * 0.1, k), lerp(up[1], -1, k), lerp(up[2], 0.35, k)];
        elbow = lerp(elbow, 115, k);
      }
      pose[`upperarm01.${side}`] = { aim: [s * out + up[0], up[1], up[2]] };
      const fe = rotX(swing * 0.9 + elbow);
      let fdir = [s * out * 0.5 + fe[0], fe[1], fe[2]];
      if (this.armsCrossed > 0.01) {
        const k = this.armsCrossed;
        fdir = [lerp(fdir[0], -s * 1.0, k), lerp(fdir[1], 0.05, k), lerp(fdir[2], 0.45, k)];
      }
      pose[`lowerarm01.${side}`] = { aim: fdir, tw: s * (-15 + g * 40) };
      pose[`wrist.${side}`] = { e: [6 + g * 10, 0, -s * (6 + g * 8)] };
      handCurl(pose, side, lerp(0.16, 0.6, runK) - g * 0.1 + this.armsCrossed * 0.25, 0.18);
    };
    arm('L', this.phase);
    arm('R', (this.phase + 0.5) % 1);

    // ---------------------------------------------------------------- look
    this.lookW = damp(this.lookW, this.lookAt ? 1 : 0, 4, dt);
    if (this.lookAt && this.lookW > 0.01) this._look(pose);

    if (this.override) this.override(pose, this, dt);

    this.rig.resolve(pose).apply();
    this._face(dt);
  }

  _look(pose) {
    // yaw/pitch of the target relative to the person's facing (holder space)
    const ch = this.ch;
    const head = ch.bones.head;
    head.updateWorldMatrix(true, false);
    const hp = this._tmpV.setFromMatrixPosition(head.matrixWorld);
    const toT = this.lookAt.clone().sub(hp);
    const inv = new THREE.Quaternion();
    ch.group.getWorldQuaternion(inv).invert();
    toT.applyQuaternion(inv);
    let yaw = Math.atan2(toT.x, toT.z);
    let pitch = Math.atan2(toT.y, Math.hypot(toT.x, toT.z));
    yaw = clamp(yaw, -1.2, 1.2) * this.lookW;
    pitch = clamp(pitch, -0.6, 0.5) * this.lookW;
    const y = yaw / D2R, p = -pitch / D2R;
    const add = (name, ex, ey) => {
      const e = pose[name]?.e || [0, 0, 0];
      pose[name] = { ...(pose[name] || {}), e: [e[0] + ex, e[1] + ey, e[2]] };
    };
    add('spine01', p * 0.1, y * 0.15);
    add('neck01', p * 0.35, y * 0.35);
    add('head', p * 0.55, y * 0.5);
    this._eyeYaw = yaw * 0.25;
    this._eyePitch = pitch * 0.3;
  }

  _face(dt) {
    const ch = this.ch;
    // blinks
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 1;
      this.blinkT = 1.5 + Math.random() * 4.5;
      if (Math.random() < 0.15) this.blinkT = 0.25; // double blink
    }
    const b = this.blink > 0 ? Math.sin((1 - this.blink) * Math.PI) : 0;
    this.blink = Math.max(0, this.blink - dt / 0.16);
    // expressions ease
    for (const k of Object.keys(this.expr)) this.expr[k] = damp(this.expr[k], this.exprTarget[k] || 0, 3, dt);
    const e = this.expr;
    const vo = this.voice;
    const open = clamp(vo.open, 0, 1);
    ch.setExpr('eye-left-closure', clamp(b + e.squint * 0.3 + e.smile * 0.15, 0, 1));
    ch.setExpr('eye-right-closure', clamp(b + e.squint * 0.3 + e.smile * 0.15, 0, 1));
    ch.setExpr('eye-left-opened-up', e.surprise * 0.6);
    ch.setExpr('eye-right-opened-up', e.surprise * 0.6);
    ch.setExpr('mouth-open', open * 0.75 + e.surprise * 0.2);
    ch.setExpr('mouth-retraction', vo.wide * open * 0.6);
    ch.setExpr('mouth-pursing', vo.round * open * 0.55);
    ch.setExpr('mouth-corner-puller', e.smile * 0.7);
    ch.setExpr('mouth-depression', e.frown * 0.6 + e.worry * 0.25);
    const browUp = e.surprise * 0.7 + this.talk * 0.12 * Math.max(0, Math.sin(this.t * 2.3));
    ch.setExpr('eyebrows-left-up', browUp);
    ch.setExpr('eyebrows-right-up', browUp);
    ch.setExpr('eyebrows-left-down', e.angry * 0.7 + e.frown * 0.3);
    ch.setExpr('eyebrows-right-down', e.angry * 0.7 + e.frown * 0.3);
    ch.setExpr('eyebrows-left-inner-up', e.worry * 0.8);
    ch.setExpr('eyebrows-right-inner-up', e.worry * 0.8);
    ch.applyExpr();
    // eyes: gaze + micro-saccades
    this.saccT -= dt;
    if (this.saccT <= 0) {
      this.saccT = 0.4 + Math.random() * 1.8;
      this.sacc.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.05);
    }
    const ey = (this._eyeYaw || 0) * this.lookW + this.sacc.x;
    const ep = (this._eyePitch || 0) * this.lookW + this.sacc.y;
    for (const side of ['L', 'R']) {
      const eb = ch.bones['eye.' + side];
      if (!eb) continue;
      // eye bone Y points forward-ish: rotate about local Z (yaw) and X (pitch)
      eb.quaternion.copy(eb.userData.restQ).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(ep, 0, -ey)));
    }
  }
}

/** Analyse a voice for lip-sync: returns {open, wide, round} from an AnalyserNode. */
export function voiceFeatures(analyser, buf, out) {
  analyser.getFloatFrequencyData(buf);
  const sr = analyser.context.sampleRate;
  const bin = sr / analyser.fftSize;
  let lo = 0, mid = 0, hi = 0;
  for (let i = 1; i < buf.length; i++) {
    const f = i * bin;
    const p = Math.pow(10, buf[i] / 20);
    if (f < 250) continue;
    if (f < 900) lo += p; else if (f < 2600) mid += p; else if (f < 6000) hi += p;
  }
  const tot = lo + mid + hi;
  const level = clamp((20 * Math.log10(tot + 1e-9) + 48) / 34, 0, 1);
  out.open = damp(out.open, level, 18, 1 / 60);
  out.wide = tot > 0 ? clamp((mid + hi * 0.5) / tot * 1.6 - 0.4, 0, 1) : 0;
  out.round = tot > 0 ? clamp(lo / tot * 1.8 - 0.7, 0, 1) : 0;
  return out;
}
