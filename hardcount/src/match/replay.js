// The VCR: every live play is taped frame by frame (frame.js) and can be run
// back from any angle — rewind, fast forward, slow motion, frame by frame,
// follow any player, and a telestrator to draw on the picture, under the deck's
// green on-screen display.
import { osd, text, vText, hints, C } from '../core/ui.js';
import { clamp } from '../core/util.js';
import { REPLAY_CAMS, REPLAY_CAM_NAMES } from './camera.js';

const GREEN = '#d8ffd8';

export class Tape {
  constructor() { this.frames = []; this.tapes = []; }
  start() { this.frames = []; }
  push(f) { if (this.frames.length < 60 * 45) this.frames.push(f); }
  /** Keep the last few plays for the highlight reel. */
  close(label = '') {
    if (this.frames.length > 20) {
      this.tapes.push({ frames: this.frames, label });
      if (this.tapes.length > 6) this.tapes.shift();
    }
  }
  get last() { return this.tapes[this.tapes.length - 1] || null; }
}

const timecode = (t) => {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), fr = Math.floor((s % 1) * 30);
  return `${m}:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
};

function transportIcon(ctx, kind, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(160,255,160,0.5)';
  ctx.shadowBlur = 6;
  const tri = (x0, dir) => { ctx.beginPath(); ctx.moveTo(x0, y - s / 2); ctx.lineTo(x0 + dir * s * 0.8, y); ctx.lineTo(x0, y + s / 2); ctx.closePath(); ctx.fill(); };
  if (kind === 'play' || kind === 'slow') tri(x, 1);
  else if (kind === 'ff') { tri(x, 1); tri(x + s * 0.7, 1); }
  else if (kind === 'rew') { tri(x + s * 0.8, -1); tri(x + s * 1.5, -1); }
  else if (kind === 'pause') { ctx.fillRect(x, y - s / 2, s * 0.28, s); ctx.fillRect(x + s * 0.5, y - s / 2, s * 0.28, s); }
  ctx.restore();
}

/**
 * Plays a tape back. update() returns 'exit' when the person is done.
 * The screen draws world.draw(viewer.frame()) and asks viewer.camState().
 */
export class ReplayViewer {
  constructor(tape, opts = {}) {
    this.frames = tape.frames;
    this.label = tape.label || '';
    this.dur = this.frames.length / 60;
    this.t = 0;
    this.rate = 1;
    this.paused = false;
    this.cam = 0;
    this.focus = null;          // entity id the camera follows (null = the ball)
    this.focusIdx = -1;
    this.tele = [];             // telestrator strokes (UI coords)
    this.pen = { x: 512, y: 384, down: false };
    this.osdT = 0;
    this.auto = !!opts.auto;    // the broadcast's own replay: plays once, slow, and leaves
    if (this.auto) { this.rate = 0.6; this.cam = 1 + Math.floor(Math.random() * 3); this.t = Math.max(0, this.keyStart() - 1.2); }
    this.endAt = this.auto ? Math.min(this.dur, this.keyEnd() + 1.0) : this.dur;
  }

  /** Where the interesting part starts: the snap (or the kick). */
  keyStart() {
    const i = this.frames.findIndex((f) => f.phase === 'live');
    return i < 0 ? 0 : i / 60;
  }
  keyEnd() {
    let i = this.frames.length - 1;
    while (i > 0 && this.frames[i].phase !== 'live') i--;
    return i / 60;
  }

  frame() {
    const i = clamp(Math.floor(this.t * 60), 0, this.frames.length - 1);
    return this.frames[i];
  }

  status() {
    if (this.paused) return { icon: 'pause', label: 'PAUSE' };
    if (this.rate < 0) return { icon: 'rew', label: 'REW' };
    if (this.rate > 1.5) return { icon: 'ff', label: 'FF' };
    if (this.rate < 0.9) return { icon: 'slow', label: 'SLOW' };
    return { icon: 'play', label: 'PLAY' };
  }

  get camName() { return REPLAY_CAMS[this.cam]; }

  update(dt, pl) {
    this.osdT += dt;
    if (this.auto) {
      this.t += dt * this.rate;
      if (pl.pressed('cross') || pl.pressed('circle') || pl.pressed('options') || this.t >= this.endAt) return 'exit';
      return null;
    }
    // transport
    if (pl.pressed('cross')) { this.paused = !this.paused; if (!this.paused && this.t >= this.dur - 0.05) this.t = 0; this.tele.length = 0; }
    const rew = pl.down('l1') || pl.l2 > 0.3, ff = pl.down('r1') || pl.r2 > 0.3;
    if (rew) this.rate = pl.l2 > 0.3 ? -0.35 : -2.5;
    else if (ff) this.rate = pl.r2 > 0.3 ? 0.3 : 2.5;
    else this.rate = 1;
    if (!this.paused || rew || ff) this.t = clamp(this.t + dt * this.rate, 0, this.dur);
    if (this.paused && !rew && !ff) {
      if (pl.pressed('dright')) this.t = clamp(this.t + 1 / 60, 0, this.dur);
      if (pl.pressed('dleft')) this.t = clamp(this.t - 1 / 60, 0, this.dur);
    }
    if (this.t >= this.dur && !this.paused) this.paused = true;
    // camera and focus
    if (pl.pressed('triangle')) this.cam = (this.cam + 1) % REPLAY_CAMS.length;
    if (pl.pressed('circle')) {
      const f = this.frame();
      const ids = f.ents.map((e) => e.id);
      this.focusIdx = this.focusIdx + 1 >= ids.length ? -1 : this.focusIdx + 1;
      this.focus = this.focusIdx < 0 ? null : ids[this.focusIdx];
    }
    // telestrator: hold □ and steer the pen with the stick
    if (pl.down('square')) {
      if (!this.pen.down) { this.tele.push([]); this.pen.down = true; }
      this.pen.x = clamp(this.pen.x + pl.lx * dt * 420, 30, 994);
      this.pen.y = clamp(this.pen.y + pl.ly * dt * 420, 30, 738);
      const s = this.tele[this.tele.length - 1];
      const lastP = s[s.length - 1];
      if (!lastP || Math.hypot(lastP.x - this.pen.x, lastP.y - this.pen.y) > 3) s.push({ x: this.pen.x, y: this.pen.y });
      this.paused = true;
    } else {
      this.pen.down = false;
      if (this.paused) {
        this.pen.x = clamp(this.pen.x + pl.lx * dt * 420, 30, 994);
        this.pen.y = clamp(this.pen.y + pl.ly * dt * 420, 30, 738);
      }
    }
    if (pl.pressed('l3') || pl.pressed('r3')) this.tele.length = 0;
    if (pl.pressed('options') || pl.pressed('create')) return 'exit';
    return null;
  }

  /** Where the camera should be looking for this frame. */
  focusOf(f) {
    if (this.focus) {
      const e = f.ents.find((x) => x.id === this.focus);
      if (e) return { x: e.x, y: 1, z: e.z, vx: e.vx, vz: e.vz };
    }
    const b = f.ball;
    if (b.car) { const e = f.ents.find((x) => x.id === b.car); if (e) return { x: e.x, y: 1, z: e.z, vx: e.vx, vz: e.vz }; }
    return { x: b.x, y: Math.max(0.5, b.y), z: b.z, vx: b.vx, vz: b.vz };
  }

  draw(ctx, time) {
    if (this.auto) {
      // the broadcast's replay wipe: a corner badge, no transport
      vText(ctx, 'REPLAY', 70, 84, 26, { color: '#ffd23a', weight: 0.2, outline: 3, outlineColor: 'rgba(0,0,0,0.6)' });
      text(ctx, REPLAY_CAM_NAMES[this.camName] || '', 72, 106, { size: 13, weight: 800, color: '#ffffff', spacing: 2 });
      return;
    }
    // the telestrator ink
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of this.tele) {
      if (s.length < 2) continue;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 7;
      ctx.beginPath(); s.forEach((p, i) => (i ? ctx.lineTo(p.x + 2, p.y + 2) : ctx.moveTo(p.x + 2, p.y + 2))); ctx.stroke();
      ctx.strokeStyle = '#ffe53a'; ctx.lineWidth = 5;
      ctx.beginPath(); s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    }
    if (this.paused) {
      ctx.strokeStyle = '#ffe53a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.pen.x, this.pen.y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.pen.x - 12, this.pen.y); ctx.lineTo(this.pen.x + 12, this.pen.y); ctx.moveTo(this.pen.x, this.pen.y - 12); ctx.lineTo(this.pen.x, this.pen.y + 12); ctx.stroke();
    }
    ctx.restore();
    // transport + tape counter
    const st = this.status();
    const blinkOff = st.icon === 'pause' && Math.floor(time * 2) % 2 === 1;
    transportIcon(ctx, st.icon, 58, 62, 26, GREEN);
    if (!blinkOff) osd(ctx, st.label, st.icon === 'ff' || st.icon === 'rew' ? 112 : 92, 74, 30, GREEN);
    osd(ctx, `SP ${timecode(this.t)}`, 968, 74, 30, GREEN, 'right');
    const w = 220, x0 = 968 - w, y0 = 90;
    ctx.fillStyle = 'rgba(216,255,216,0.18)';
    ctx.fillRect(x0, y0, w, 3);
    ctx.fillStyle = GREEN;
    ctx.fillRect(x0, y0, w * Math.min(1, this.t / Math.max(0.01, this.dur)), 3);
    // what and where
    vText(ctx, 'INSTANT REPLAY', 56, 612, 22, { color: C.accent });
    if (this.label) text(ctx, this.label, 56, 636, { size: 14, weight: 800, color: '#ffffff', spacing: 1 });
    const f = this.frame();
    const who = this.focus ? (f.ents.find((e) => e.id === this.focus)?.role || '') : 'THE BALL';
    text(ctx, 'CAMERA', 56, 660, { size: 13, weight: 700, color: C.dim, spacing: 2 });
    text(ctx, REPLAY_CAM_NAMES[this.camName] || '', 140, 660, { size: 15, weight: 800, color: C.text, spacing: 1 });
    text(ctx, 'FOLLOW', 56, 682, { size: 13, weight: 700, color: C.dim, spacing: 2 });
    text(ctx, who, 140, 682, { size: 15, weight: 800, color: '#7fe8ff', spacing: 1 });
    hints(ctx, [['cross', this.paused ? 'PLAY' : 'PAUSE'], ['l1', 'REW'], ['r1', 'FF'], ['triangle', 'CAMERA'], ['circle', 'PLAYER'], ['square', 'DRAW'], ['options', 'DONE']]);
  }
}
