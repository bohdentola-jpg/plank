// FOCUS GROUP — the cut.
//
// The Director owns the second camera: the one that is already in the room.
// When it takes the shot the game does not fade, does not warn you and does
// not give you back the controls in a different arrangement. It simply is not
// your point of view any more, and you carry on making coffee.
//
// Two rules the game keeps and never states:
//   1. Every cut comes from a lens that is physically in the flat and that you
//      could have found. Nothing cuts from nowhere.
//   2. Every cut takes a still. Those stills are real frames of your
//      playthrough, and they come back later in an advertisement.

import * as THREE from 'three';
import { clamp, clamp01, damp, fmtStamp, rng } from './util.js';
import { agedPass } from './textures.js';

const CAP_W = 320, CAP_H = 240;

export class Director {
  constructor(game) {
    this.game = game;
    this.renderer = game.renderer;
    this.scene = game.scene;

    this.cam = new THREE.PerspectiveCamera(80, CAP_W / CAP_H, 0.05, 60);
    this.cam.layers.enableAll();

    // the shot currently being taken, or null if you have your own eyes
    this.shot = null;
    this.t = 0;
    this.sinceCut = 0;
    this.budget = { count: 0, min: 0, max: 0 };
    this.used = 0;
    this.nextIn = 999;
    this.rand = rng(19740310);

    // the stills. Kept as canvases because they end up on a television.
    this.frames = [];
    this.maxFrames = 24;

    this.capRT = new THREE.WebGLRenderTarget(CAP_W, CAP_H, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.SRGBColorSpace,
    });
    this.buf = new Uint8Array(CAP_W * CAP_H * 4);
    this.capCv = document.createElement('canvas');
    this.capCv.width = CAP_W;
    this.capCv.height = CAP_H;
    this.capCtx = this.capCv.getContext('2d');

    this._v = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  get active() { return !!this.shot; }
  get camNum() { return this.shot?.spot.num ?? 0; }

  // ---------------------------------------------------------------- a day

  /**
   * @param {object} budget { count, min, max } from the day
   * @param {World} world
   */
  beginDay(budget, world) {
    this.world = world;
    this.budget = budget || { count: 0, min: 0, max: 0 };
    this.used = 0;
    this.shot = null;
    this.t = 0;
    this.sinceCut = 0;
    this.nextIn = this.budget.count > 0 ? 26 + this.rand() * 26 : 1e9;
  }

  /** No more scheduled cuts today; scripted ones still fire. */
  stopScheduling() { this.nextIn = 1e9; }

  // ---------------------------------------------------------------- cutting

  /**
   * @param {string} lensId  a key in world.camSpots
   * @param {number} secs
   * @param {object} o { hold, sticky, track, silent, note }
   * @returns {boolean} whether the shot was taken
   */
  cut(lensId, secs, o = {}) {
    const spot = this.world?.camSpots.get(lensId);
    if (!spot) return false;
    if (this.shot && this.shot.locked && !o.force) return false;

    this.shot = {
      spot,
      lens: lensId,
      dur: secs,
      t: 0,
      hold: !!o.hold,
      sticky: !!o.sticky,
      track: o.track ?? spot.track,
      locked: !!o.locked,
      note: o.note || '',
      startRoom: this.game.playerRoom,
      yaw: 0,
    };

    this.cam.fov = spot.fov;
    this.cam.updateProjectionMatrix();
    this.cam.position.copy(spot.pos);
    this._look.copy(spot.look);
    this.cam.lookAt(this._look);
    this.game.lens.breakHold();

    // the relay is tiny and very close to your ear, and on the first days you
    // will not hear it at all
    if (!o.silent) this.game.audio.oneShot('relay', 0.35 + this.game.dayIndex * 0.12, spot.pos);

    // and it takes a frame, because that is what it is for
    this.grab();
    return true;
  }

  release() {
    if (!this.shot) return;
    this.shot = null;
    this.sinceCut = 0;
    this.game.lens.breakHold();
  }

  /** Cut and do not come back. There is one of these in the game. */
  lock(lensId, o = {}) {
    this.cut(lensId, 1e9, { ...o, hold: true, locked: true, force: true });
  }

  // ---------------------------------------------------------------- frame

  update(dt) {
    this.t += dt;

    if (this.shot) {
      const s = this.shot;
      s.t += dt;

      // a servo camera does not snap to you, it catches up with you, and
      // sometimes it does not bother
      if (s.track) {
        const p = this.game.player.pos;
        this._look.x = damp(this._look.x, p.x, 1.5, dt);
        this._look.y = damp(this._look.y, p.y + 1.2, 1.5, dt);
        this._look.z = damp(this._look.z, p.z, 1.5, dt);
        this.cam.lookAt(this._look);
      }

      // a long shot takes more than one frame
      if (s.t > 2.5 && Math.floor(s.t / 2.5) !== Math.floor((s.t - dt) / 2.5)) this.grab();

      let done = s.t >= s.dur;
      // 'hold' will not let go while you are still moving about in shot
      if (done && s.hold && this.game.player.speed > 0.35 && s.t < s.dur + 12) done = false;
      // 'sticky' keeps the shot until you leave the room it can see
      if (s.sticky && this.game.playerRoom === s.startRoom && s.t < s.dur + 40) done = false;
      if (s.locked) done = false;

      if (done) this.release();
      return;
    }

    // ---- otherwise, wonder whether now is a good time
    this.sinceCut += dt;
    if (this.used >= this.budget.count) return;
    this.nextIn -= dt;
    if (this.nextIn > 0 || this.sinceCut < 14) return;

    const lensId = this.pickLens();
    if (!lensId) { this.nextIn = 6; return; }

    // the shots get longer as the week goes on and as the day goes on
    const k = this.budget.count > 1 ? this.used / (this.budget.count - 1) : 1;
    const secs = this.budget.min + (this.budget.max - this.budget.min) * Math.pow(k, 1.6);
    if (this.cut(lensId, secs, { hold: secs > 8, track: secs > 12 })) {
      this.used++;
      this.nextIn = 30 + this.rand() * 40;
    }
  }

  /** Something that can see the room you are standing in. Failing that, any. */
  pickLens() {
    const room = this.game.playerRoom;
    const here = [];
    const all = [];
    for (const [id, spot] of this.world.camSpots) {
      if (!this.game.lensExists(id)) continue;
      all.push(id);
      if (!spot.room || spot.room === room) here.push(id);
    }
    const from = here.length ? here : all;
    if (!from.length) return null;
    // don't take the same angle twice running if there is a choice
    const fresh = from.filter((id) => id !== this.lastLens);
    const pool = fresh.length ? fresh : from;
    const id = pool[Math.floor(this.rand() * pool.length) % pool.length];
    this.lastLens = id;
    return id;
  }

  // ---------------------------------------------------------------- stills

  /**
   * Render one small frame from whichever camera is taking the shot and keep
   * it. This is the whole payoff of the game and it costs 320x240 pixels.
   */
  grab(fromCamera = null) {
    const cam = fromCamera || (this.shot ? this.cam : this.game.camera);
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    try {
      r.setRenderTarget(this.capRT);
      r.clear();
      r.render(this.scene, cam);
      r.readRenderTargetPixels(this.capRT, 0, 0, CAP_W, CAP_H, this.buf);
    } catch {
      r.setRenderTarget(prevTarget);
      return null;
    }
    r.setRenderTarget(prevTarget);

    // WebGL hands them back upside down, as it always has
    const img = this.capCtx.createImageData(CAP_W, CAP_H);
    for (let y = 0; y < CAP_H; y++) {
      const src = (CAP_H - 1 - y) * CAP_W * 4;
      const dst = y * CAP_W * 4;
      img.data.set(this.buf.subarray(src, src + CAP_W * 4), dst);
    }

    const cv = document.createElement('canvas');
    cv.width = CAP_W;
    cv.height = CAP_H;
    const ctx = cv.getContext('2d');
    ctx.putImageData(img, 0, 0);

    // wash the colour out of it and put a deck's worth of wear on top, so it
    // matches the thing it is going to be cut into
    ctx.fillStyle = 'rgba(30,34,30,0.22)';
    ctx.fillRect(0, 0, CAP_W, CAP_H);
    agedPass(ctx, CAP_W, CAP_H, { grain: 22, vign: 0.6 });

    const rec = {
      cv,
      cam: this.camNum,
      stamp: fmtStamp(this.game.dayIndex, this.game.clockSecs),
      room: this.game.playerRoom,
      day: this.game.dayIndex,
    };
    this.frames.push(rec);
    if (this.frames.length > this.maxFrames) this.frames.shift();
    return rec;
  }

  /** n frames spread across the week, newest last, for the advertisement. */
  reel(n) {
    if (!this.frames.length) return [];
    if (this.frames.length <= n) return this.frames.slice();
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(this.frames[Math.floor((i / (n - 1)) * (this.frames.length - 1))]);
    }
    return out;
  }

  /** What the burn-in strip should say, or null when you have your own eyes. */
  strip() {
    if (!this.shot) return null;
    const noticed = this.game.noticed.has(this.shot.lens);
    return {
      cam: this.shot.spot.num,
      stamp: fmtStamp(this.game.dayIndex, this.game.clockSecs),
      // knowing which camera it is does not help, and the game tells you so
      note: this.shot.note || (noticed ? '◉ NOTICED' : ''),
    };
  }

  dispose() {
    this.capRT.dispose();
    this.frames.length = 0;
  }
}
