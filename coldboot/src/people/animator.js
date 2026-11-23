// Animation for people: Rocketbox motion capture through THREE.AnimationMixer,
// with procedural layers on top.
//
// Clips are split into a lower layer (root, pelvis, Bip01_Spine — the Biped
// thighs hang off it — and legs) and an upper layer (Spine1 up: torso, arms,
// head). Each layer blends its clips with weights that sum to one, so a
// seated body can wear a standing gesture's arms, a walk can keep its arm
// swing while the head looks around, a laugh can happen in a chair. Times are
// driven here, not by the mixer: locomotion clips share one gait phase (all
// aligned on the left foot's heel strike, so walk ↔ jog ↔ run blends keep
// the feet together and `phase` crosses 0 and 0.5 on footfalls).
//
// Procedural on top of the mocap: head/neck/chest look-at (clamped, eased),
// eyes with saccades, blinks, lip-sync visemes from the voice analyser, facial
// expressions, leaning into turns, a seated talker's head beats, hands on a
// steering wheel (two-bone IK) and hands up (named action 'handsUp').
//
// The public fields are the old Animator's: targetSpeed, speed, phase,
// setPosture('stand'|'sit'|'drive'|'crouch'), posture, postureW, sitHeight,
// handsOnTable, armsCrossed, lookAt, talk, voice {open, wide, round},
// exprTarget {smile, frown, worry, surprise, angry, squint}, turn, headTilt.
// New: play(name, {upper, hold, fade, rate}), stop(name), playing(name).
import * as THREE from 'three';
import { lowerClipFor } from './loader.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const LOCO = ['walk', 'walkFast', 'jog', 'run', 'sprint'];   // gaits, slowest first
const IDLES = ['idle', 'idle', 'idle2', 'idle3', 'waiting'];
const LISTENS = ['listen1', 'listen2', 'idle'];
const TALKS = { neutral: ['talk1', 'talk2', 'talk3'], happy: ['talk3', 'talkExcited'], sad: ['talkSad'], worry: ['talkNervous', 'talkSad'], angry: ['talkAngry'], surprise: ['talkExcited'] };
const SIT_TABLE = ['sitTable', 'sitTable', 'sitTable2', 'sitTableLook'];
const SIT_CHAIR = ['sitChair', 'sitChair', 'sitChair2', 'sitChairLook'];
const HIP_ABOVE_SEAT = 0.1;   // hip joint over the seat surface (m)
const PROCEDURAL = new Set(['handsUp']);
// blendshape gains (see _face)
const GAIN = {
  AK_44_MouthSmileLeft: 2.2, AK_45_MouthSmileRight: 2.2, AK_07_CheekSquintLeft: 1.5, AK_08_CheekSquintRight: 1.5,
  AK_28_MouthDimpleLeft: 1.6, AK_29_MouthDimpleRight: 1.6, AK_30_MouthFrownLeft: 1.9, AK_31_MouthFrownRight: 2.6,
  AK_01_BrowDownLeft: 1.8, AK_02_BrowDownRight: 1.7, AK_04_BrowOuterUpLeft: 1.6, AK_05_BrowOuterUpRight: 1.5,
  AK_21_EyeWideLeft: 2.2, AK_22_EyeWideRight: 1.6, AK_19_EyeSquintLeft: 1.8, AK_20_EyeSquintRight: 1.8,
  AK_50_NoseSneerLeft: 1.5, AK_51_NoseSneerRight: 1.4, AK_36_MouthPressLeft: 1.6, AK_37_MouthPressRight: 1.1,
  AK_46_MouthStretchLeft: 1.5, AK_47_MouthStretchRight: 1.9, AK_42_MouthShrugLower: 1.0,
  AA_VI_14_U: 1.6, AA_VI_01_PP: 1.6, AA_VI_11_E: 1.2, AA_VI_12_I: 1.3,
};

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const Y = new THREE.Vector3(0, 1, 0);

const _rwP = new THREE.Quaternion(), _rwL = new THREE.Quaternion();
/** Rotate a bone by a world-space rotation (keeps the rest of the chain). */
function rotateWorld(bone, qWorld) {
  bone.parent.getWorldQuaternion(_rwP);
  _rwL.copy(_rwP).invert().multiply(qWorld).multiply(_rwP);
  bone.quaternion.premultiply(_rwL);
  bone.updateMatrixWorld(true);
}

export class Animator {
  constructor(ch) {
    this.ch = ch;
    ch.animator = this;
    this.lib = ch.lib;
    this.mixer = new THREE.AnimationMixer(ch.root);
    this.rootK = ch.hip / (this.lib.hip || ch.hip);
    this.B = ch.bones;
    // ---- the old Animator's public state
    this.t = Math.random() * 10;
    this.speed = 0;
    this.targetSpeed = 0;
    this.phase = 0;
    this.posture = 'stand';
    this.postureW = { stand: 1, sit: 0, crouch: 0, drive: 0, lie: 0 };
    this.lookAt = null;
    this.lookW = 0;
    this.talk = 0;
    this.voice = { open: 0, wide: 0, round: 0 };
    this.expr = { smile: 0, frown: 0, worry: 0, surprise: 0, angry: 0, squint: 0 };
    this.exprTarget = { ...this.expr };
    this.turn = 0;
    this.fidget = Math.random();
    this.sitHeight = 0.46;
    this.armsCrossed = 0;
    this.handsOnTable = 0;
    this.headTilt = 0;
    this.override = null;       // legacy: ignored (use play())
    // ---- internals
    this.layers = { lo: { acts: new Map(), w: new Map() }, up: { acts: new Map(), w: new Map() } };
    this.additive = new Map();  // name → {action, w}
    this.clock = new Map();     // clip time per clip name (lo and up stay in step)
    this.standClip = 'idle';
    this.sitClip = { table: 'sitTable', chair: 'sitChair' };
    this.idleT = rand(4, 10);
    this.sitT = rand(8, 16);
    this.talkHold = 0;
    this.talkClip = null;
    this.mood = 'neutral';
    this.shots = [];            // one-shots: {name, t, dur, w, upper, hold, fade, rate, out}
    this.handsUpW = 0;
    this.handsUpOn = false;
    this.ikW = 0;
    this.blinkT = rand(1, 4);
    this.blink = 0;
    this.sacc = new THREE.Vector2();
    this.saccT = 0.4;
    this.eyeDir = new THREE.Vector3();
    this.lookDir = new THREE.Vector3(0, 0, 1);
    this.lookInit = false;
    this.nodT = 0;
    this.frame = 0;
    this.snapNext = true;
    this._initRig();
  }

  // ------------------------------------------------------------------ rig facts (from the bind pose)
  _initRig() {
    const B = this.B, root = this.ch.root;
    root.updateWorldMatrix(true, true);   // parents (holder scale) first, then every bone
    const inv = new THREE.Quaternion();
    root.getWorldQuaternion(inv).invert();
    // a bone's local axis that points along the character's +Z (forward), at rest
    const fwdLocal = (b) => {
      if (!b) return new THREE.Vector3(0, 0, 1);
      b.getWorldQuaternion(_q);
      return new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(_q2)).applyQuaternion(_q.invert());
    };
    this.headFwd = fwdLocal(B.Bip01_Head);
    this.eyeFwd = { L: fwdLocal(B.Bip01_LEye), R: fwdLocal(B.Bip01_REye) };
    this.eyeRest = { L: B.Bip01_LEye?.quaternion.clone(), R: B.Bip01_REye?.quaternion.clone() };
    // arm lengths for IK
    const wp = (b) => b.getWorldPosition(new THREE.Vector3());
    this.arm = {};
    for (const s of ['L', 'R']) {
      const u = B[`Bip01_${s}_UpperArm`], f = B[`Bip01_${s}_Forearm`], h = B[`Bip01_${s}_Hand`];
      if (!u || !f || !h) continue;
      this.arm[s] = { u, f, h, l1: wp(u).distanceTo(wp(f)), l2: wp(f).distanceTo(wp(h)) };
    }
    // seated hip heights of the sit clips (for chairs of any height)
    this.seatHip = {};
    for (const n of [...SIT_TABLE, ...SIT_CHAIR]) {
      const c = this.lib.lower[n];
      const tr = c?.tracks.find((t) => t.name === 'Bip01.position');
      if (tr) this.seatHip[n] = { y: tr.values[1] * this.rootK, z: tr.values[2] * this.rootK };
    }
  }

  setPosture(p) { this.posture = p === 'lie' ? 'stand' : p; }
  say(level) { this.talk = level; }
  snap() { this.snapNext = true; }

  // ------------------------------------------------------------------ actions
  _act(layer, name) {
    const L = this.layers[layer];
    let a = L.acts.get(name);
    if (a === undefined) {
      const clip = layer === 'lo' ? lowerClipFor(this.lib, name, this.rootK) : this.lib.upper[name];
      a = clip ? this.mixer.clipAction(clip) : null;
      if (a) {
        a.setLoop(THREE.LoopRepeat, Infinity);
        a.timeScale = 0;          // times are set by hand
        a.weight = 0;
        a.play();
      }
      L.acts.set(name, a);
    }
    return a;
  }

  _additive(name, ref = 'idle', layer = 'up') {
    const key = name + ':' + layer;
    let ad = this.additive.get(key);
    if (!ad) {
      const lib = this.lib;
      lib.additive = lib.additive || new Map();
      const ck = key + '@' + this.rootK.toFixed(3);
      let clip = lib.additive.get(ck);
      if (!clip) {
        const src = layer === 'lo' ? lowerClipFor(lib, name, this.rootK) : lib.upper[name];
        const refc = layer === 'lo' ? lowerClipFor(lib, ref, this.rootK) : lib.upper[ref];
        if (!src || !refc) return null;
        clip = THREE.AnimationUtils.makeClipAdditive(src.clone(), 0, refc, 30);
        clip.name = ck;
        lib.additive.set(ck, clip);
      }
      const action = this.mixer.clipAction(clip);
      action.blendMode = THREE.AdditiveAnimationBlendMode;
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.timeScale = 0;
      action.weight = 0;
      action.play();
      ad = { action, w: 0, name };
      this.additive.set(key, ad);
    }
    return ad;
  }

  meta(name) { return this.lib.meta[name] || { dur: 1, loop: 1, speed: 0, phase: 0 }; }
  has(name) { return !!this.lib.clips[name] || PROCEDURAL.has(name); }

  /**
   * Play a named action. Clips: laugh, laughLow, shrug, nod, shake, thoughtful,
   * wave, photo, phone, phoneText, documents, drink, scratchHead, touchFace,
   * sitTableThink, sitTableShrug… Procedural: handsUp.
   * o: { upper: arms/torso only (default when seated or walking), hold: stay
   * on the last frame (or loop a looping clip) until stop(), fade: seconds, rate }
   */
  play(name, o = {}) {
    if (name === 'handsUp') { this.handsUpOn = true; return; }
    if (!this.lib.clips[name]) { console.warn('people: no clip', name); return; }
    const m = this.meta(name);
    let s = this.shots.find((x) => x.name === name);
    if (!s) { s = { name, w: 0 }; this.shots.push(s); }
    Object.assign(s, { t: 0, dur: m.dur, loop: !!m.loop, upper: o.upper, hold: !!o.hold, fade: o.fade ?? 0.35, rate: o.rate ?? 1, out: false });
    this.clock.set(name, 0);
  }

  stop(name) {
    if (name === 'handsUp' || name === undefined) this.handsUpOn = false;
    for (const s of this.shots) if (name === undefined || s.name === name) s.out = true;
  }

  playing(name) {
    if (name === 'handsUp') return this.handsUpOn;
    return this.shots.some((s) => s.name === name && !s.out);
  }

  // ------------------------------------------------------------------ the frame
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.frame++;
    const ch = this.ch;
    // level of detail: far or unseen people animate less often
    const far = ch.camDist ?? 0;
    ch.tick = (ch.tick || 0) + 1;
    const unseen = ch.tick - (ch.seenTick ?? ch.tick) > 3;   // not drawn for a few frames (culled, off screen)
    const every = unseen ? 4 : far > 45 ? 3 : far > 25 ? 2 : 1;
    this._acc = (this._acc || 0) + dt;
    if (!this.snapNext && every > 1 && this.frame % every) return;
    dt = this._acc;
    this._acc = 0;
    if (this.override && !this._warned) { this._warned = true; console.warn('people: anim.override is gone — use anim.play(name)'); }

    // posture weights ease (code may also set postureW directly)
    const pw = this.postureW;
    let tot = 0;
    for (const k of Object.keys(pw)) { pw[k] = damp(pw[k], k === this.posture ? 1 : 0, 5, dt); tot += pw[k]; }
    for (const k of Object.keys(pw)) pw[k] /= tot || 1;
    this.speed = damp(this.speed, this.targetSpeed, 5, dt);
    const v = Math.abs(this.speed);
    const stand = pw.stand + pw.lie, sit = pw.sit, drive = pw.drive, crouch = pw.crouch;
    const seated = sit + drive;

    this._states(dt, v, seated);

    // ---------------------------------------------------------------- desired weights
    const lo = new Map(), up = new Map();
    const add = (map, n, w) => { if (w > 1e-4 && n) map.set(n, (map.get(n) || 0) + w); };
    const moveK = smooth(0.06, 0.6, v) * (1 - seated);
    const loco = this._loco(v, dt);
    if (stand > 0) add(lo, this.standClip, stand * (1 - moveK));
    for (const [n, w] of loco) add(lo, n, (stand + crouch) * moveK * w);
    if (crouch > 0) add(lo, 'crouch', crouch * (1 - moveK));
    const hot = clamp(this.handsOnTable, 0, 1);
    if (sit > 0) {
      add(lo, this.sitClip.table, sit * hot);
      add(lo, this.sitClip.chair, sit * (1 - hot));
    }
    if (drive > 0) add(lo, 'sitChair', drive);
    for (const [n, w] of lo) up.set(n, w);
    // arms crossed (standing still or seated): procedural, after the mocap (see _armsCrossed)
    const ac = clamp(this.armsCrossed, 0, 1) * (1 - moveK) * (this.talkHold > 0 ? 0.25 : 1) * (1 - drive);
    this._acTarget = this.shots.some((x) => x.w > 0.2) ? 0 : ac;
    // one-shots
    for (const s of this.shots) {
      const upper = s.upper ?? (seated > 0.5 || moveK > 0.3 || crouch > 0.5);
      if (s.w > 0.001) {
        scaleIn(up, s.name, s.w);
        if (!upper) scaleIn(lo, s.name, s.w);
      }
    }

    // additive: a crouched walk; gestures while seated and talking
    const crouchWalk = crouch * moveK;
    const talkK = this.talkHold > 0 ? 1 : 0;
    this._addW('crouch', crouchWalk, 'lo', 'idle', dt, 8);
    this._addW('crouch', crouchWalk * 0.7, 'up', 'idle', dt, 8);
    const seatTalk = seated * (1 - drive) * talkK * (1 - ac * 0.8) * (this.shots.some((s) => s.w > 0.2) ? 0 : 1);
    this._addW(this.seatTalkClip || 'talk1', seatTalk * 0.42, 'up', 'idle', dt, 3);

    // ---------------------------------------------------------------- blend + evaluate
    const rate = this.snapNext ? 1e9 : 7;
    this._blend('lo', lo, rate, dt);
    this._blend('up', up, rate, dt);
    this._times(dt, loco);
    this.mixer.update(0);
    this.snapNext = false;

    // ---------------------------------------------------------------- procedural
    this._seat(seated, sit, drive);
    ch.root.updateWorldMatrix(true, true);   // the game may have moved the group this frame
    this._lean(moveK, dt);
    this._look(dt, seated);
    this._armsCrossed(dt);
    this._handsUp(dt);
    this._drive(drive, dt);
    // faces only up close (a frozen half-blink at 30 m would be the only tell)
    if (!(far > 22 || unseen)) { this._face(dt); this._faceOn = true; }
    else if (this._faceOn) { this._faceOn = false; ch.resetFace(); }
    // shadows: far away only the body casts one
    const shadows = far < 40;
    if (shadows !== this._shadows) {
      this._shadows = shadows;
      for (const m of Object.values(ch.meshes)) if (m.name !== 'body' && m.name !== 'hairFringe' && m.name !== 'glasses') m.castShadow = shadows;
    }
  }

  /** Which idle / talk / sit clips should be playing now. */
  _states(dt, v, seated) {
    const talking = this.talk > 0.12;
    if (talking) this.talkHold = 0.9; else this.talkHold = Math.max(0, this.talkHold - dt);
    const e = this.exprTarget;
    const mood = e.angry > 0.3 ? 'angry' : e.worry > 0.35 ? 'worry' : e.surprise > 0.4 ? 'surprise' : e.frown > 0.45 ? 'sad' : e.smile > 0.5 ? 'happy' : 'neutral';
    // standing
    this.idleT -= dt;
    if (this.talkHold > 0) {
      if (!this.talkClip || mood !== this.mood) { this.talkClip = pick(TALKS[mood] || TALKS.neutral); this.mood = mood; this._restart(this.talkClip); }
      this.standClip = this.talkClip;
      this.seatTalkClip = this.talkClip === 'talkAngry' || this.talkClip === 'talkExcited' ? 'talk2' : this.talkClip;
    } else {
      this.talkClip = null;
      if (this.idleT <= 0 || !this.layers.lo.acts.has(this.standClip) && this.standClip !== 'idle') {
        const next = pick(this.lookAt ? LISTENS : IDLES);
        if (next !== this.standClip) this._restart(next);
        this.standClip = next;
        this.idleT = rand(9, 20);
      } else if (TALKS.neutral.includes(this.standClip) || this.standClip.startsWith('talk')) {
        this.standClip = this.lookAt ? 'listen1' : 'idle';
      }
    }
    // seated: change idle now and then
    this.sitT -= dt;
    if (this.sitT <= 0 && seated > 0.5) {
      this.sitT = rand(10, 22);
      this.sitClip = { table: pick(SIT_TABLE), chair: pick(SIT_CHAIR) };
    }
    // a laughing face gets a laughing body (the director's 'laugh' emotion)
    this.laughCool = Math.max(0, (this.laughCool || 0) - dt);
    if (e.smile > 0.85 && e.squint > 0.3 && this.laughCool <= 0 && !this.shots.some((x) => x.w > 0.3)) {
      this.laughCool = 9;
      this.play(Math.random() < 0.6 ? 'laughLow' : 'laugh', { upper: seated > 0.5 ? true : undefined, fade: 0.5 });
    }
    // listening: an occasional nod
    if (this.lookAt && !talking && this.talkHold <= 0) {
      this.nodT -= dt;
      if (this.nodT <= 0) {
        this.nodT = rand(6, 14);
        // standing: the mocap nod; seated (arms on a table): just the head
        if (Math.random() < 0.45 && !this.shots.length) {
          if (seated > 0.5) this.nodProc = 0.001;
          else this.play('nod', { fade: 0.4 });
        }
      }
    }
  }

  _restart(name) { if (!this.meta(name).loop || !this.clock.has(name)) this.clock.set(name, 0); }

  /**
   * Locomotion: [[clip, weight]…] for this speed, and the gait phase advanced.
   * Each gait plays alone from its own capture speed up to ~1.2× (cadence
   * scaled), then crossfades into the next one: walk → brisk walk → jog → run →
   * sprint, covering 0–6+ m/s. The phase advances by distance / stride, so the
   * planted foot moves exactly with the ground (no skating).
   */
  _loco(v, dt) {
    const L = [];
    const gs = LOCO.map((n) => [n, this.meta(n)]).filter(([n, m]) => m.speed > 0.2 && this.lib.clips[n]).sort((a, b) => a[1].speed - b[1].speed);
    if (!gs.length) return L;
    const top = (m) => Math.max(m.speed * 1.2, m.speed + 0.2);
    const stride = (m) => m.speed * m.dur;
    let cyc = stride(gs[0][1]);
    for (let i = 0; i < gs.length; i++) {
      const [na, a] = gs[i];
      const nb = gs[i + 1];
      if (!nb || v <= top(a)) {
        L.push([na, 1]);
        cyc = stride(a) * (nb ? 1 : Math.pow(Math.max(1, v / a.speed), 0.35));
        break;
      }
      const end = Math.max(top(a) + 0.25, nb[1].speed * 0.95);
      if (v < end) {
        const f = smooth(top(a), end, v);
        L.push([na, 1 - f], [nb[0], f]);
        cyc = lerp(stride(a), stride(nb[1]), f);
        break;
      }
    }
    if (v > 0.02) this.phase = (this.phase + (v * dt) / Math.max(0.3, cyc)) % 1;
    return L;
  }

  _blend(layer, want, rate, dt) {
    const L = this.layers[layer];
    const k = 1 - Math.exp(-rate * dt);
    for (const n of want.keys()) if (!L.w.has(n)) L.w.set(n, 0);
    let sum = 0;
    for (const [n, w] of L.w) {
      const nw = w + ((want.get(n) || 0) - w) * k;
      L.w.set(n, nw);
      sum += nw;
    }
    for (const [n, w] of L.w) {
      const a = this._act(layer, n);
      const ww = sum > 1e-5 ? w / sum : 0;
      if (a) a.weight = ww;
      if (ww < 1e-4 && !want.has(n)) { L.w.delete(n); if (a) a.weight = 0; }
    }
  }

  _addW(name, target, layer, ref, dt, rate) {
    if (target < 1e-3 && !this.additive.has(name + ':' + layer)) return;
    const ad = this._additive(name, ref, layer);
    if (!ad) return;
    ad.w = damp(ad.w, target, rate, dt);
    ad.action.weight = ad.w < 1e-3 ? 0 : ad.w;
  }

  /** Set every active clip's time: gait clips from the phase, the rest from their own clocks. */
  _times(dt, loco) {
    const set = new Set();
    for (const L of Object.values(this.layers)) for (const n of L.w.keys()) set.add(n);
    for (const ad of this.additive.values()) if (ad.w > 0.001) set.add(ad.name);
    for (const s of this.shots) set.add(s.name);
    for (const n of set) {
      const m = this.meta(n);
      let t;
      if (LOCO.includes(n)) t = (((this.phase + (m.phase || 0)) % 1) + 1) % 1 * m.dur;
      else {
        const shot = this.shots.find((s) => s.name === n);
        const r = shot ? shot.rate : 1;
        t = (this.clock.get(n) ?? Math.random() * m.dur) + dt * r;
        if (m.loop && !(shot && !shot.hold && t >= m.dur)) t %= m.dur;
        else t = Math.min(t, m.dur - 1e-3);
      }
      this.clock.set(n, t);
      for (const L of Object.values(this.layers)) { const a = L.acts.get(n); if (a) a.time = t; }
      for (const ad of this.additive.values()) if (ad.name === n) ad.action.time = t;
    }
    // one-shots: fade in, run, fade out (or hold)
    for (const s of this.shots) {
      s.t += dt * s.rate;
      const end = !s.hold && s.t >= s.dur - s.fade;
      const want = s.out || end ? 0 : 1;
      s.w = damp(s.w, want, 1 / Math.max(0.05, s.fade) * 2.2, dt);
      if (want === 0 && s.w < 0.01) s.done = true;
    }
    this.shots = this.shots.filter((s) => !s.done);
  }

  // ------------------------------------------------------------------ procedural layers
  _seat(seated, sit, drive) {
    // the hips land on the seat: sitHeight = seat surface above the floor
    let y = 0;
    if (seated > 0.001) {
      const name = sit >= drive ? (this.handsOnTable >= 0.5 ? this.sitClip.table : this.sitClip.chair) : 'sitChair';
      const h = this.seatHip[name] || { y: 0.55 };
      y = (this.sitHeight + HIP_ABOVE_SEAT - h.y) * seated;
    }
    this.ch.holder.position.y = y;
  }

  _lean(moveK, dt) {
    this._turnS = damp(this._turnS || 0, clamp(this.turn, -1, 1), 6, dt);
    const ang = -this._turnS * 7 * D2R * moveK * clamp(Math.abs(this.speed) / 3, 0.3, 1);
    if (Math.abs(ang) < 1e-4) return;
    const bip = this.B.Bip01;
    _q.setFromAxisAngle(_v.set(0, 0, 1), ang);
    bip.quaternion.premultiply(_q);
    bip.position.applyQuaternion(_q);
    bip.updateMatrixWorld(true);
  }

  /** Head, neck and a little chest turn toward lookAt (clamped to what a neck can do). */
  _look(dt, seated) {
    const B = this.B, head = B.Bip01_Head;
    if (!head) return;
    const want = this.lookAt ? 1 : 0;
    this.lookW = damp(this.lookW, want, 3.5, dt);
    const ch = this.ch;
    // the body's frame (holder space → world)
    ch.group.getWorldQuaternion(_q);
    const bodyQ = _q.clone();
    const headPos = head.getWorldPosition(_v2);
    // target direction, smoothed in body space
    const tgt = _v3;
    if (this.lookAt) tgt.copy(this.lookAt).sub(headPos).applyQuaternion(_q2.copy(bodyQ).invert()).normalize();
    else tgt.set(0, 0, 1);
    if (!this.lookInit) { this.lookDir.copy(tgt); this.lookInit = true; }
    this.lookDir.lerp(tgt, 1 - Math.exp(-5 * dt)).normalize();
    // clamp yaw/pitch relative to the body
    let yaw = Math.atan2(this.lookDir.x, this.lookDir.z);
    let pitch = Math.asin(clamp(this.lookDir.y, -1, 1));
    yaw = clamp(yaw, -1.25, 1.25);
    pitch = clamp(pitch, -0.6, 0.45);
    // talking: little head beats; headTilt
    const tk = Math.min(1, this.talkHold) * (0.4 + 0.6 * this.voice.open);
    let beat = Math.sin(this.t * 5.3 + this.fidget * 9) * 0.035 * tk * (seated > 0.5 ? 1 : 0.5);
    // a listener's nod: two soft dips of the head
    if (this.nodProc) {
      this.nodProc += dt;
      const k = this.nodProc / 1.3;
      if (k >= 1) this.nodProc = 0;
      else beat -= Math.sin(k * Math.PI * 2) ** 2 * Math.sin(k * Math.PI) * 0.16;   // down, not up
    }
    const lw = this.lookW * 0.92;   // a little of the mocap's own head motion stays
    if (lw < 0.005 && Math.abs(beat) < 1e-4 && !this.headTilt) { this._eyeAim = null; return; }
    // where the animation already points the head (body space)
    head.getWorldQuaternion(_q2);
    const cur = _v4.copy(this.headFwd).applyQuaternion(_q2).applyQuaternion(_q3.copy(bodyQ).invert());
    const curYaw = Math.atan2(cur.x, cur.z), curPitch = Math.asin(clamp(cur.y, -1, 1));
    const dYaw = (yaw - curYaw) * lw, dPitch = (pitch - curPitch) * lw + beat;
    // spread over chest / neck / head (body-space yaw about up, pitch about the body's right axis)
    const share = [[B.Bip01_Spine2, 0.18], [B.Bip01_Neck, 0.32], [head, 0.5]];
    const right = _v.set(1, 0, 0).applyQuaternion(bodyQ);
    const up = Y.clone().applyQuaternion(bodyQ);
    for (const [b, k] of share) {
      if (!b) continue;
      _q.setFromAxisAngle(up, dYaw * k);
      _q3.setFromAxisAngle(right.clone().applyQuaternion(_q), -dPitch * k);
      rotateWorld(b, _q3.multiply(_q));
    }
    if (this.headTilt) { head.getWorldDirection(_v); rotateWorld(head, _q.setFromAxisAngle(_v.set(0, 0, 1).applyQuaternion(bodyQ), this.headTilt * D2R)); }
    // the eyes lead: aim them at the target itself
    this._eyeAim = this.lookAt && lw > 0.05 ? this.lookAt : null;
  }

  /** Arms folded across the chest: the left forearm over the right, hands at the opposite elbows. */
  _armsCrossed(dt) {
    this.acW = damp(this.acW || 0, this._acTarget || 0, 3.5, dt);
    const w = smooth(0, 1, this.acW);
    if (w < 0.003 || !this.B.Bip01_Spine2) return;
    const bodyQ = this.ch.group.getWorldQuaternion(new THREE.Quaternion());
    const chest = this.B.Bip01_Spine2.getWorldPosition(new THREE.Vector3());
    const s = this.ch.holder.scale.y;
    for (const [side, k] of [['R', -1], ['L', 1]]) {
      const A = this.arm[side];
      if (!A) continue;
      // the left arm lies on top (further forward), the right hand tucks under it
      const t = side === 'L' ? new THREE.Vector3(-0.055, -0.085, 0.21) : new THREE.Vector3(0.045, -0.045, 0.165);
      const target = chest.clone().add(t.multiplyScalar(s).applyQuaternion(bodyQ));
      const sh = A.u.getWorldPosition(new THREE.Vector3());
      const pole = sh.clone().add(new THREE.Vector3(k * 0.45, -0.55, 0.1).applyQuaternion(bodyQ));
      this._ik(A, target, pole, w);
    }
  }

  /** Arms up, palms out (the arrest). */
  _handsUp(dt) {
    this.handsUpW = damp(this.handsUpW, this.handsUpOn ? 1 : 0, 4, dt);
    const w = smooth(0, 1, this.handsUpW);
    if (w < 0.002) return;
    const bodyQ = this.ch.group.getWorldQuaternion(new THREE.Quaternion());
    for (const s of ['L', 'R']) {
      const A = this.arm[s];
      if (!A) continue;
      const side = s === 'L' ? 1 : -1;
      // Rocketbox faces +Z, its left is +X
      const sh = A.u.getWorldPosition(new THREE.Vector3());
      const upperDir = new THREE.Vector3(side * 0.78, 0.3, 0.45).normalize().applyQuaternion(bodyQ);   // elbows out and a little forward
      const elbow = sh.clone().addScaledVector(upperDir, A.l1);
      const hand = elbow.clone().addScaledVector(new THREE.Vector3(side * 0.04, 1, 0.2).normalize().applyQuaternion(bodyQ), A.l2);
      const pole = elbow.clone().addScaledVector(new THREE.Vector3(0, -1, -0.4).applyQuaternion(bodyQ), 0.3);
      this._ik(A, hand, pole, w);
      // palms out (toward whoever is in front)
      this._palm(s, _v.set(0, 0.25, 1).normalize().applyQuaternion(bodyQ), w);
    }
  }

  /** Turn a hand (half in the forearm, half at the wrist) so its palm faces dir. */
  _palm(s, dir, w) {
    const A = this.arm[s], B = this.B;
    const f1 = B[`Bip01_${s}_Finger1`], f2 = B[`Bip01_${s}_Finger2`], f4 = B[`Bip01_${s}_Finger4`];
    if (!A || !f1 || !f2 || !f4) return;
    const side = s === 'L' ? 1 : -1;
    for (const [bone, k] of [[A.f, 0.55], [A.h, 1]]) {
      const hp = A.h.getWorldPosition(new THREE.Vector3());
      const fingers = f2.getWorldPosition(new THREE.Vector3()).sub(hp).normalize();
      const across = f1.getWorldPosition(new THREE.Vector3()).sub(f4.getWorldPosition(new THREE.Vector3()));
      const palm = new THREE.Vector3().crossVectors(fingers, across).multiplyScalar(side).normalize();
      const axis = hp.clone().sub(A.f.getWorldPosition(new THREE.Vector3())).normalize();
      const p1 = palm.addScaledVector(axis, -palm.dot(axis));
      const p2 = dir.clone().addScaledVector(axis, -dir.dot(axis));
      if (p1.lengthSq() < 1e-6 || p2.lengthSq() < 1e-6) continue;
      p1.normalize(); p2.normalize();
      let ang = Math.acos(clamp(p1.dot(p2), -1, 1));
      if (new THREE.Vector3().crossVectors(p1, p2).dot(axis) < 0) ang = -ang;
      rotateWorld(bone, _q.setFromAxisAngle(axis, ang * k * w));
    }
  }

  /** Hands on a steering wheel / handlebars in front of the chest. */
  _drive(drive, dt) {
    this.ikW = damp(this.ikW, drive > 0.5 ? 1 : 0, 6, dt);
    const w = this.ikW * clamp(drive * 1.5, 0, 1);
    if (w < 0.01) return;
    const bodyQ = this.ch.group.getWorldQuaternion(new THREE.Quaternion());
    const chest = this.B.Bip01_Spine2.getWorldPosition(new THREE.Vector3());
    const steer = Math.sin(this.t * 0.9 + this.fidget * 7) * 0.02 + clamp(this.turn, -1, 1) * 0.06;
    for (const s of ['L', 'R']) {
      const A = this.arm[s];
      if (!A) continue;
      const side = s === 'L' ? 1 : -1;
      const grip = chest.clone().add(new THREE.Vector3(side * 0.19, -0.06 + side * steer, 0.42).applyQuaternion(bodyQ));
      const pole = grip.clone().add(new THREE.Vector3(side * 0.5, -0.6, -0.2).applyQuaternion(bodyQ));
      this._ik(A, grip, pole, w);
    }
  }

  /** Two-bone IK (upper arm, forearm) toward target with the elbow toward pole; weight w. */
  _ik(A, target, pole, w) {
    const { u, f, h, l1, l2 } = A;
    const a = u.getWorldPosition(new THREE.Vector3());
    const b = f.getWorldPosition(new THREE.Vector3());
    const c = h.getWorldPosition(new THREE.Vector3());
    const want = target.clone().sub(a);
    const d = clamp(want.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    // 1. elbow angle
    const ba = a.clone().sub(b).normalize(), bc = c.clone().sub(b).normalize();
    const cur = Math.acos(clamp(ba.dot(bc), -1, 1));
    const goal = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    let axis = new THREE.Vector3().crossVectors(bc, ba);
    if (axis.lengthSq() < 1e-8) axis = new THREE.Vector3().crossVectors(want, pole.clone().sub(a)).normalize();
    else axis.normalize();
    rotateWorld(f, _q.setFromAxisAngle(axis, (cur - goal) * w));
    // 2. swing the upper arm so the hand points at the target
    const c2 = h.getWorldPosition(new THREE.Vector3());
    const from = c2.sub(a).normalize();
    const to = want.clone().normalize();
    rotateWorld(u, _q.setFromUnitVectors(from, from.clone().lerp(to, w).normalize()));
    // 3. twist about the shoulder→hand line so the elbow faces the pole
    const b2 = f.getWorldPosition(new THREE.Vector3());
    const ax = h.getWorldPosition(new THREE.Vector3()).sub(a).normalize();
    const e1 = b2.clone().sub(a); e1.addScaledVector(ax, -e1.dot(ax));
    const e2 = pole.clone().sub(a); e2.addScaledVector(ax, -e2.dot(ax));
    if (e1.lengthSq() > 1e-8 && e2.lengthSq() > 1e-8) {
      e1.normalize(); e2.normalize();
      let ang = Math.acos(clamp(e1.dot(e2), -1, 1));
      if (new THREE.Vector3().crossVectors(e1, e2).dot(ax) < 0) ang = -ang;
      rotateWorld(u, _q.setFromAxisAngle(ax, ang * w));
    }
  }

  // ------------------------------------------------------------------ the face
  _face(dt) {
    const ch = this.ch;
    // expressions ease
    for (const k of Object.keys(this.expr)) this.expr[k] = damp(this.expr[k], this.exprTarget[k] || 0, 3, dt);
    const e = this.expr;
    // blinks (more when talking, double blinks now and then)
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 1;
      this.blinkT = rand(2, 5.5) * (this.talkHold > 0 ? 0.75 : 1);
      if (Math.random() < 0.12) this.blinkT = 0.28;
    }
    const b = this.blink > 0 ? Math.sin((1 - this.blink) * Math.PI) : 0;
    this.blink = Math.max(0, this.blink - dt / 0.17);
    // eyes: look at the target (or ahead) + micro-saccades; lids follow the gaze down
    this.saccT -= dt;
    if (this.saccT <= 0) {
      this.saccT = rand(0.35, 1.9);
      this.sacc.set((Math.random() - 0.5) * 0.07, (Math.random() - 0.5) * 0.045);
    }
    let lidDown = 0;
    for (const s of ['L', 'R']) {
      const eb = this.B[`Bip01_${s}Eye`];
      if (!eb || !this.eyeRest[s]) continue;
      eb.quaternion.copy(this.eyeRest[s]);
      eb.updateMatrixWorld(true);
      eb.getWorldQuaternion(_q);
      const fwd = _v.copy(this.eyeFwd[s]).applyQuaternion(_q);
      let dir;
      if (this._eyeAim) dir = _v2.copy(this._eyeAim).sub(eb.getWorldPosition(_v3)).normalize();
      else dir = _v2.copy(fwd);
      // saccade offset in the eye's own frame
      const up = _v3.set(0, 1, 0);
      const side = _v4.crossVectors(up, fwd).normalize();
      dir.addScaledVector(side, this.sacc.x).addScaledVector(up, this.sacc.y).normalize();
      // clamp to what eyes can do (~30°)
      const ang = fwd.angleTo(dir);
      const lim = 0.5;
      if (ang > lim) dir.copy(fwd).lerp(dir, lim / ang).normalize();
      _q2.setFromUnitVectors(fwd, dir);
      rotateWorld(eb, _q2);
      lidDown = Math.max(lidDown, -dir.y - 0.05);
    }
    // the voice: jaw + visemes from {open, wide, round}
    const vo = this.voice;
    const open = clamp(vo.open, 0, 1), wide = clamp(vo.wide, 0, 1), round = clamp(vo.round, 0, 1);
    const speaking = this.talkHold > 0 ? 1 : 0;
    // Rocketbox's ARKit shapes are gentle (a full smile moves the corners ~4 mm): GAIN scales them to read on camera
    const M = (n, x) => ch.morph(n, clamp(x * (GAIN[n] || 1), 0, 2.5));
    // the jaw follows the loudness, the lips the vowel colour (wide → E/I, round → O/U), closures between syllables
    M('AA_VI_10_aa', open * (1 - round * 0.8) * (1 - wide * 0.45) * 0.72);
    M('AA_VI_11_E', open * wide * 0.85);
    M('AA_VI_12_I', wide * (1 - open) * 0.45 * speaking);
    M('AA_VI_13_O', open * round * 0.9);
    M('AA_VI_14_U', round * (1 - open) * 0.6 * speaking);
    M('AA_VI_01_PP', speaking * smooth(0.12, 0.02, open) * 0.55 * (1 - round));
    M('AK_25_JawOpen', open * 0.15 + e.surprise * 0.15);
    // expressions
    const sm = e.smile, fr = e.frown, wo = e.worry, su = e.surprise, an = e.angry, sq = e.squint;
    const browBeat = speaking * 0.3 * Math.max(0, Math.sin(this.t * 2.1 + this.fidget * 4)) * open;
    M('AK_44_MouthSmileLeft', sm); M('AK_45_MouthSmileRight', sm * 0.95);
    M('AK_07_CheekSquintLeft', sm * 0.7 + sq * 0.3); M('AK_08_CheekSquintRight', sm * 0.7 + sq * 0.3);
    M('AK_28_MouthDimpleLeft', sm * 0.35); M('AK_29_MouthDimpleRight', sm * 0.35);
    M('AK_30_MouthFrownLeft', fr * 0.8 + wo * 0.35 + an * 0.3); M('AK_31_MouthFrownRight', fr * 0.8 + wo * 0.35 + an * 0.3);
    M('AK_42_MouthShrugLower', fr * 0.35 + an * 0.25);
    M('AK_01_BrowDownLeft', an * 0.9 + fr * 0.45); M('AK_02_BrowDownRight', an * 0.9 + fr * 0.45);
    M('AK_03_BrowInnerUp', wo * 0.9 + su * 0.7 + browBeat);
    M('AK_04_BrowOuterUpLeft', su * 0.8 + browBeat * 0.6); M('AK_05_BrowOuterUpRight', su * 0.8 + browBeat * 0.6);
    M('AK_21_EyeWideLeft', su * 0.7); M('AK_22_EyeWideRight', su * 0.7);
    M('AK_50_NoseSneerLeft', an * 0.5); M('AK_51_NoseSneerRight', an * 0.5);
    M('AK_36_MouthPressLeft', an * 0.45 * (1 - open)); M('AK_37_MouthPressRight', an * 0.45 * (1 - open));
    M('AK_46_MouthStretchLeft', wo * 0.25 + wide * open * 0.25); M('AK_47_MouthStretchRight', wo * 0.25 + wide * open * 0.25);
    const sleepy = smooth(0.7, 1, sq);
    const squintK = sq * 0.6 + sm * 0.3 + an * 0.3;
    M('AK_19_EyeSquintLeft', squintK); M('AK_20_EyeSquintRight', squintK);
    const lid = clamp(b + sleepy * 0.85 + clamp(lidDown, 0, 0.6) * 0.45 + sm * 0.08, 0, 1);
    M('AK_09_EyeBlinkLeft', lid); M('AK_10_EyeBlinkRight', lid);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.ch.root);
  }
}

/** Scale a weight map by (1-k) and add name at k. */
function scaleIn(map, name, k) {
  for (const [n, w] of map) map.set(n, w * (1 - k));
  map.set(name, (map.get(name) || 0) + k);
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
