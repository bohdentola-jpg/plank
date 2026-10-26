// The controller side of a match: the DualSense (or keyboard) turned into the
// sim's per-frame command, the pre-snap tools (snap, hard count, audibles, hot
// routes, motion, switching men, timeouts) and the three-press kick meter.
import { BUTTONS } from '../core/input.js';
import { OFFENSE } from '../sim/plays/offense.js';
import { DEFENSE } from '../sim/plays/defense.js';
import { offenseCall, defenseCall } from '../sim/ai/playcall.js';
import { clamp } from '../core/util.js';

const PLAY_BTNS = BUTTONS.filter((b) => b !== 'options' && b !== 'ps');

/**
 * One person's command for this frame. The left stick is camera-relative:
 * up on the stick is "away from the camera" on the field.
 */
export function buildCmd(pl, cam, opts = {}) {
  const f = { x: cam.look.x - cam.pos.x, z: cam.look.z - cam.pos.z };
  const fl = Math.hypot(f.x, f.z) || 1;
  f.x /= fl; f.z /= fl;
  const r = { x: -f.z, z: f.x };
  const lx = pl.lx, ly = pl.ly;
  const move = { x: f.x * -ly + r.x * lx, z: f.z * -ly + r.z * lx };
  const mm = Math.hypot(move.x, move.z);
  if (mm > 1) { move.x /= mm; move.z /= mm; }
  const pressed = new Set(), held = new Set(), released = new Set();
  for (const b of PLAY_BTNS) {
    if (opts.eat?.has(b)) continue;
    if (pl.pressed(b)) pressed.add(b);
    if (pl.down(b)) held.add(b);
    if (pl.released(b)) released.add(b);
  }
  let flick = null;
  if (pl.flick) {
    const d = pl.flick;
    const v = d === 'up' ? f : d === 'down' ? { x: -f.x, z: -f.z } : d === 'right' ? r : { x: -r.x, z: -r.z };
    flick = { dir: d, x: v.x, z: v.z };
  }
  return { move, sprint: pl.r2, pressed, held, released, flick, leadHeld: pl.l2 > 0.5 };
}

// ------------------------------------------------------------------ pre-snap tools

const HOT = {
  up: { wide: 'go', back: 'wheel', label: 'GO' },
  down: { wide: 'hitch', back: 'checkdown', label: 'HITCH' },
  in: { wide: 'slant', back: 'angle', label: 'SLANT' },
  out: { wide: 'qout', back: 'flat', label: 'QUICK OUT' },
  r1: { wide: 'drag', back: 'swing', label: 'DRAG' },
};

/** Up to four audibles: what the coach would call now, from different families. */
export function audibleList(m) {
  const cur = m.play;
  const form = cur?.form;
  const pool = OFFENSE.filter((p) => p.kind !== 'kneel' && p.kind !== 'spike' && p.id !== cur?.id);
  const pick = (pred) => {
    const same = pool.filter((p) => pred(p) && p.form === form);
    const any = pool.filter(pred);
    const list = same.length ? same : any;
    return list.length ? list[Math.floor(m.rng() * list.length)] : null;
  };
  const out = [
    { label: 'QUICK', play: pick((p) => p.kind === 'pass' && (p.tags || []).includes('quick') || p.drop === 'quick') },
    { label: 'RUN', play: pick((p) => p.kind === 'run' && !p.motion) },
    { label: 'SHOT', play: pick((p) => p.kind === 'pass' && (p.tags || []).includes('deep')) },
    { label: 'COACH', play: OFFENSE.find((p) => p.id === offenseCall(m)) || pick((p) => p.kind === 'pass') },
  ];
  return out.filter((a) => a.play);
}

export function defAudibleList(m) {
  const cur = m.dplay?.id;
  const by = (id) => DEFENSE.find((d) => d.id === id);
  const list = [
    { label: 'COVER 2', play: by('c2') },
    { label: 'BLITZ', play: by(['c0', 'firezone', 'cblitz', 'mike'][Math.floor(m.rng() * 4)]) },
    { label: 'MAN', play: by('c1') },
    { label: 'COACH', play: by(defenseCall(m)) },
  ];
  return list.filter((a) => a.play && a.play.id !== cur);
}

/**
 * The pre-snap state machine for one person. Returns events the screen reacts
 * to (toasts, sounds). The snap button is "eaten" so the first live frame
 * doesn't also read it as a throw.
 */
export class Presnap {
  constructor(m, side, pl) {
    this.m = m; this.side = side; this.pl = pl;
    this.mode = 'idle';          // idle | hot | hotRoute | motion | audible | defAudible
    this.target = null;
    this.list = null;
    this.events = [];
    this.eat = new Set();
  }

  isOffense() { return this.m.offSide === this.side; }

  update(dt) {
    const m = this.m, pl = this.pl;
    this.events.length = 0;
    this.eat.clear();
    if (m.phase !== 'presnap') { this.mode = 'idle'; return this.events; }
    const off = this.isOffense();
    const kick = m.playKind === 'kickoff' || m.playKind === 'fg' || m.playKind === 'punt' || m.tryMode === 'pat';
    if (pl.pressed('touch')) {
      if (m.callTimeout(this.side)) this.events.push({ type: 'timeout' });
      else this.events.push({ type: 'toast', text: m.timeouts[this.side] > 0 ? 'NOT NOW' : 'NO TIMEOUTS LEFT' });
      return this.events;
    }
    if (kick) return this.events;   // the kick meter drives the kicking team; the return team just waits
    switch (this.mode) {
      case 'idle':
        if (off) {
          if (pl.pressed('cross')) { this.eat.add('cross'); this.events.push({ type: 'snap' }); return this.events; }
          if (pl.pressed('square')) { m.hardCount(); this.events.push({ type: 'hardCount' }); }
          if (pl.pressed('triangle')) { this.mode = 'audible'; this.list = audibleList(m); this.events.push({ type: 'open', what: 'audible' }); }
          if (pl.pressed('r1')) { this.mode = 'hot'; this.events.push({ type: 'open', what: 'hot' }); }
          if (pl.pressed('l1')) { this.mode = 'motion'; this.events.push({ type: 'open', what: 'motion' }); }
        } else {
          if (pl.pressed('circle')) { m.switchDefender(this.side, { cycle: true }); this.events.push({ type: 'switch' }); }
          if (pl.pressed('triangle')) { this.mode = 'defAudible'; this.list = defAudibleList(m); this.events.push({ type: 'open', what: 'defAudible' }); }
        }
        break;
      case 'hot':
      case 'motion': {
        for (const b of ['cross', 'circle', 'square', 'triangle']) {
          if (!pl.pressed(b)) continue;
          const e = m.icons[this.side]?.[b];
          this.eat.add(b);
          if (!e) continue;
          if (this.mode === 'motion') {
            m.motion(e);
            this.events.push({ type: 'toast', text: 'MOTION' });
            this.mode = 'idle';
          } else { this.target = e; this.mode = 'hotRoute'; }
          return this.events;
        }
        if (pl.pressed('r1') || pl.pressed('l1')) { this.mode = 'idle'; this.eat.add('r1'); this.eat.add('l1'); }
        break;
      }
      case 'hotRoute': {
        const e = this.target;
        let dirKey = null;
        const x = pl.lx || pl.rx, y = pl.ly || pl.ry;
        if (pl.pressed('r1')) dirKey = 'r1';
        else if (Math.hypot(x, y) > 0.7) {
          if (Math.abs(y) > Math.abs(x)) dirKey = y < 0 ? 'up' : 'down';
          else {
            // left/right on the screen vs. "toward the ball" for him
            const inWorld = Math.sign(m.ballX - e.x) || 1;
            const camRight = this.camRight || { x: -1, z: 0 };
            const stickWorldX = camRight.x * Math.sign(x);
            dirKey = stickWorldX * inWorld > 0 ? 'in' : 'out';
          }
        }
        if (pl.pressed('circle')) { this.mode = 'idle'; this.eat.add('circle'); break; }
        if (dirKey) {
          const back = Math.abs(e.x - m.ballX) < 3;
          const h = HOT[dirKey];
          m.hotRoute(e, back ? h.back : h.wide);
          this.events.push({ type: 'toast', text: `HOT ROUTE: ${h.label}` });
          this.mode = 'idle';
          this.eat.add('r1');
        }
        break;
      }
      case 'audible':
      case 'defAudible': {
        const map = ['square', 'triangle', 'circle', 'cross'];
        for (let i = 0; i < map.length; i++) {
          if (!pl.pressed(map[i])) continue;
          this.eat.add(map[i]);
          const a = this.list?.[i];
          if (a) {
            if (this.mode === 'audible') m.audible(a.play.id); else m.defAudible(a.play.id);
            this.events.push({ type: 'toast', text: `AUDIBLE: ${a.play.name}` }, { type: 'audible', play: a.play });
          }
          this.mode = 'idle';
          return this.events;
        }
        if (pl.pressed('r1') || pl.pressed('l1') || pl.pressed('r2')) this.mode = 'idle';
        break;
      }
      default: this.mode = 'idle';
    }
    return this.events;
  }

  /** What the hint row and the audible panel show. */
  describe() {
    const m = this.m;
    const off = this.isOffense();
    if (m.playKind === 'kickoff' || m.playKind === 'fg' || m.playKind === 'punt' || m.tryMode === 'pat') return { hints: [['touch', 'TIMEOUT']] };
    switch (this.mode) {
      case 'hot': return { title: 'HOT ROUTE', sub: 'PICK A RECEIVER', hints: [['r1', 'CANCEL']], pickIcons: true };
      case 'motion': return { title: 'MOTION', sub: 'PICK A RECEIVER', hints: [['l1', 'CANCEL']], pickIcons: true };
      case 'hotRoute': return { title: 'HOT ROUTE', sub: '↑ GO   ↓ HITCH   ← → SLANT / OUT   R1 DRAG', hints: [['circle', 'CANCEL']] };
      case 'audible': return { title: 'AUDIBLE', list: this.list, btns: ['square', 'triangle', 'circle', 'cross'] };
      case 'defAudible': return { title: 'DEFENSIVE AUDIBLE', list: this.list, btns: ['square', 'triangle', 'circle', 'cross'] };
      default:
        return off
          ? { hints: [['cross', 'SNAP'], ['square', 'HARD COUNT'], ['triangle', 'AUDIBLE'], ['r1', 'HOT ROUTE'], ['l1', 'MOTION'], ['touch', 'TIMEOUT']] }
          : { hints: [['circle', 'SWITCH'], ['triangle', 'AUDIBLE'], ['stick', 'SHIFT'], ['touch', 'TIMEOUT']] };
    }
  }
}

// ------------------------------------------------------------------ the kick meter

/**
 * Three presses: ✕ starts the swing, ✕ sets the power on the way up, ✕
 * stops the needle on the way down — in the green band is dead straight,
 * early hooks one way, late the other. Aim with the stick first.
 */
export class KickMeter {
  constructor(kind, opts = {}) {
    this.kind = kind;              // 'kickoff' | 'fg' | 'pat' | 'punt'
    this.state = 'aim';            // aim → power → acc → done
    this.power = 0;
    this.setPower = null;
    this.needle = null;
    this.aimX = 0;
    this.aimLimit = opts.aimLimit ?? (kind === 'fg' || kind === 'pat' ? 4 : 14);
    this.accZone = 0.1;
    this.speed = opts.speed ?? 1.0;   // seconds for a full sweep
    this.result = null;
    this.t = 0;
  }

  update(dt, pl) {
    this.t += dt;
    if (this.state === 'aim') {
      const x = Math.abs(pl.lx) > 0.2 ? pl.lx : pl.rx;
      this.aimX = clamp(this.aimX + x * dt * this.aimLimit * 0.9, -this.aimLimit, this.aimLimit);
      if (pl.pressed('cross')) { this.state = 'power'; this.power = 0; }
    } else if (this.state === 'power') {
      this.power += dt / this.speed;
      if (pl.pressed('cross') || this.power >= 1.04) { this.setPower = Math.min(1, this.power); this.state = 'acc'; this.needle = this.setPower; }
    } else if (this.state === 'acc') {
      this.needle -= dt / (this.speed * 0.8);
      if (pl.pressed('cross') || this.needle <= -0.08) {
        const miss = (this.needle - this.accZone) / 0.16;   // + early (high), − late (low)
        this.result = { power: this.setPower, acc: clamp(miss, -1, 1) * (Math.abs(miss) < 0.18 ? 0.25 : 1), aimX: this.aimX };
        this.state = 'done';
      }
    }
    return this.result;
  }

  view(distText = null) {
    const label = this.state === 'aim' ? 'AIM ← →  · ✕' : this.state === 'power' ? 'POWER  ✕' : this.state === 'acc' ? 'ACCURACY  ✕' : 'KICK!';
    return { power: this.state === 'aim' ? 0 : this.state === 'power' ? this.power : this.setPower, setPower: this.setPower, needle: this.state === 'acc' || this.state === 'done' ? this.needle : null, accZone: this.accZone, label, dist: distText };
  }
}
