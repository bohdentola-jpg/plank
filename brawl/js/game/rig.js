// The puppet rig shared by every fighter with two arms and two legs.
//
// A pose says where the hands and feet are and how the body leans; the rig
// works out elbows and knees and draws the limbs. Character files supply the
// proportions plus their own head / torso / prop drawing, and describe each
// attack as a handful of keyframed poses.
//
// Local space: origin at the feet, +x is the way the fighter faces, -y is up.
// "R" is the near (weapon) side and is drawn in front, "L" is the far side.

import { clamp, lerp, evalKeys, ease, TAU } from '../core/util.js';
import { limb, ik2, circle, ellipse, OUT, LW } from '../core/gfx.js';

const rotv = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

export function biped(spec) {
  const S = Object.assign({
    hipY: 24, hipW: 6, shY: 44, shW: 9, headY: 56,
    arm: [12, 12], leg: [12.5, 12.5], armW: 6.5, legW: 7.5,
    handR: 5, footL: 11, footH: 6, propLen: 0,
    armKey: 'skin', sleeveKey: null, legKey: 'pants', handKey: 'skin', footKey: 'shoe',
    kneeBend: -1, elbowBend: 1, lw: LW,
  }, spec);
  const H = S.headY + 12;

  const stance = Object.assign({
    by: 0, lean: 0, hx: 0, hy: 0, ht: 0,
    hR: [11, -(S.shY - 15)], hL: [-9, -(S.shY - 16)],
    fR: [S.hipW + 1, 0], fL: [-S.hipW - 1, 0],
    rot: 0, ox: 0, oy: 0, sx: 1, sy: 1, prop: -1.15, face: 0,
  }, S.stance);
  const airStance = Object.assign({}, stance, {
    hR: [13, -(S.shY + 2)], hL: [-12, -(S.shY + 1)], fR: [6, -7], fL: [-7, -2], lean: 0.05,
  }, S.airStance);

  // ---- the stock animations: everything that isn't an attack ----
  function auto(f) {
    const t = f.t, sf = f.sf, st = f.state, P = {};
    const set = (o) => Object.assign(P, o);
    const hand = (x, y) => [x, -y], foot = (x, y) => [x, -y];
    switch (st) {
      case 'walk': case 'run': case 'dash': {
        const run = st !== 'walk';
        const ph = f.cycle / (run ? 15 : 10);
        const A = run ? 13 : 8, L = run ? 9 : 5;
        const s1 = Math.sin(ph), c1 = Math.cos(ph);
        set({
          fR: [s1 * A, -Math.max(0, c1) * L], fL: [-s1 * A, -Math.max(0, -c1) * L],
          hR: [stance.hR[0] - s1 * (run ? 12 : 6) - (run ? 2 : 0), stance.hR[1] - (run ? 4 : 0) + Math.abs(s1) * 2],
          hL: [stance.hL[0] + s1 * (run ? 12 : 6) + (run ? 4 : 0), stance.hL[1] - (run ? 4 : 0) + Math.abs(s1) * 2],
          lean: run ? 0.2 : 0.06, by: Math.abs(c1) * (run ? 2.2 : 1.2),
        });
        if (st === 'dash' && sf < 4) set({ lean: 0.34 });
        break;
      }
      case 'brake': case 'turn':
        set({ lean: -0.26, fR: [14, 0], fL: [-3, 0], hR: [16, -(S.shY - 8)], hL: [-2, -(S.shY - 4)], by: 4 });
        break;
      case 'crouch': set({ by: S.hipY * 0.5, lean: 0.18, hR: [12, -(S.shY * 0.34)], hL: [-6, -(S.shY * 0.34)], fR: [S.hipW + 4, 0], fL: [-S.hipW - 4, 0] }); break;
      case 'jumpsquat': set({ by: S.hipY * 0.42, lean: 0.12, hR: [6, -(S.shY * 0.42)], hL: [-12, -(S.shY * 0.42)] }); break;
      case 'land': {
        const k = 1 - clamp(sf / Math.max(1, f.lag), 0, 1);
        set({ by: S.hipY * 0.45 * k, lean: 0.12 * k, sy: 1 - 0.06 * k, sx: 1 + 0.05 * k, fR: [S.hipW + 3, 0], fL: [-S.hipW - 3, 0] });
        break;
      }
      case 'air': case 'respawn': {
        if (st === 'respawn') break;
        const v = clamp(f.vy / 8, -1, 1);
        Object.assign(P, airStance);
        if (v < 0) set({ hR: [10, -(S.shY + 10)], hL: [-10, -(S.shY + 8)], fR: [5, -3 + v * 2], fL: [-6, -9], sy: 1 + -v * 0.05 });
        else set({ hR: [15, -(S.shY + 4 + v * 6)], hL: [-14, -(S.shY + 4 + v * 6)], fR: [8, -5], fL: [-8, -1], lean: -0.05 });
        break;
      }
      case 'helpless': {
        const w = Math.sin(t * 0.5) * 5;
        Object.assign(P, airStance);
        set({ hR: [12 + w, -(S.shY + 14)], hL: [-12 - w, -(S.shY + 14)], fR: [6, -3], fL: [-6, -3], face: 2, lean: Math.sin(t * 0.25) * 0.12 });
        break;
      }
      case 'shield': case 'shieldstun':
        set({ by: 5, lean: 0.06, hR: [13, -(S.shY - 3)], hL: [9, -(S.shY - 10)], fR: [S.hipW + 4, 0], fL: [-S.hipW - 3, 0], face: 1 });
        if (st === 'shieldstun') set({ lean: -0.12, ox: Math.sin(sf * 2) * 1.5 });
        break;
      case 'roll': case 'tech': {
        const u = clamp(sf / 24, 0, 1), dir = f.rollDir * f.facing || 1;
        Object.assign(P, airStance);
        set({ rot: dir * ease.io(u) * TAU, by: 0, sy: 0.82, sx: 0.9, hR: [8, -(S.shY * 0.55)], hL: [-6, -(S.shY * 0.55)], fR: [6, -8], fL: [-4, -8], oy: S.hipY * 0.25 });
        break;
      }
      case 'spotdodge': {
        const u = Math.sin(clamp(sf / 22, 0, 1) * Math.PI);
        set({ lean: -0.5 * u, ox: -9 * u, by: 4 * u, hR: [4, -(S.shY + 2)], hL: [-12, -(S.shY - 6)] });
        break;
      }
      case 'airdodge': {
        const u = clamp(sf / 26, 0, 1);
        Object.assign(P, airStance);
        set({ rot: -ease.io(u) * TAU, sy: 0.86, hR: [8, -(S.shY * 0.6)], hL: [-6, -(S.shY * 0.6)], fR: [6, -9], fL: [-4, -9] });
        break;
      }
      case 'hitstun': case 'trapped': {
        if (f.tumble || !f.grounded) {
          Object.assign(P, airStance);
          const w = Math.sin(t * 0.7) * 4;
          set({ rot: f.tumble ? -f.t * 0.2 : -0.5, hR: [14, -(S.shY + 12) + w], hL: [-15, -(S.shY + 10) - w], fR: [11, -6 - w], fL: [-11, -3 + w], face: 2 });
        } else set({ lean: -0.42, hx: -2, ht: -0.25, hR: [14, -(S.shY + 6)], hL: [-2, -(S.shY + 10)], fR: [S.hipW + 6, 0], fL: [-S.hipW, 0], face: 2, by: 2 });
        break;
      }
      case 'tumble': {
        Object.assign(P, airStance);
        const w = Math.sin(t * 0.5) * 5;
        set({ rot: -f.t * 0.13, hR: [14, -(S.shY + 10) + w], hL: [-15, -(S.shY + 8) - w], fR: [10, -6], fL: [-10, -3], face: 2 });
        break;
      }
      case 'down':
        set({ rot: -1.5, oy: H * 0.34, ox: -4, hR: [16, -(S.shY + 6)], hL: [-12, -(S.shY + 2)], fR: [8, -2], fL: [-6, 0], face: sf < 30 ? 2 : 5 });
        break;
      case 'getup': {
        const u = ease.io(clamp(sf / 20, 0, 1));
        set({ rot: -1.5 * (1 - u), oy: H * 0.34 * (1 - u), by: S.hipY * 0.5 * Math.sin(u * Math.PI), hR: [12, -(S.shY * 0.5)], hL: [-8, -(S.shY * 0.5)] });
        break;
      }
      case 'stun': {
        if (f.stunKind === 'dizzy') {
          const w = Math.sin(t * 0.13);
          set({ lean: w * 0.22, ht: -w * 0.3, hR: [10 + w * 3, -(S.shY - 22)], hL: [-9 + w * 3, -(S.shY - 22)], face: 4, by: 3 });
        } else {
          const j = (t % 4 < 2 ? 1 : -1);
          set({ hR: [17, -(S.shY + 8 + j)], hL: [-17, -(S.shY + 8 - j)], fR: [S.hipW + 6, 0], fL: [-S.hipW - 6, 0], face: 6, ox: j * 1.5, sy: 1.04 });
        }
        break;
      }
      case 'grabbed': set({ hR: [5, -(S.shY - 14)], hL: [-5, -(S.shY - 14)], face: 2, ox: Math.sin(t * 0.9) * 1.2, fR: [4, -1], fL: [-4, 0], lean: -0.1 }); break;
      case 'grabhold': {
        const p = f.pummelT > 0 ? Math.sin((f.pummelT / 16) * Math.PI) : 0;
        set({ hR: [S.shW + S.arm[0] + S.arm[1] - 5 - p * 6, -(S.shY - 4)], hL: [S.shW + 12 + p * 14, -(S.shY - 2 + p * 8)], lean: 0.12, fR: [S.hipW + 5, 0], fL: [-S.hipW - 3, 0], face: 1 });
        break;
      }
      case 'ledge': {
        const sw = Math.sin(t * 0.07) * 2;
        set({ hR: [10, -(H + 2)], hL: [6, -(H + 2)], fR: [1 + sw, 0], fL: [-4 + sw, -3], lean: 0.05, hy: 4 });
        break;
      }
      case 'ledgeclimb': {
        const u = clamp(sf / 26, 0, 1);
        const a = { hR: [10, -(H + 2)], hL: [6, -(H + 2)], fR: [1, 0], fL: [-4, -3] };
        const b = { hR: [12, -(S.shY * 0.4)], hL: [6, -(S.shY * 0.4)], fR: [6, 0], fL: [-5, 0] };
        const k = ease.io(u);
        set({ hR: [lerp(a.hR[0], b.hR[0], k), lerp(a.hR[1], b.hR[1], k)], hL: [lerp(a.hL[0], b.hL[0], k), lerp(a.hL[1], b.hL[1], k)],
          fR: [lerp(a.fR[0], b.fR[0], k), 0], fL: [lerp(a.fL[0], b.fL[0], k), lerp(-3, 0, k)], by: Math.sin(u * Math.PI) * S.hipY * 0.5, lean: 0.25 * Math.sin(u * Math.PI) });
        break;
      }
      case 'win': {
        const j = Math.abs(Math.sin(t * 0.14));
        set({ oy: -j * 12, hR: [10, -(S.shY + 16 + j * 4)], hL: [-12, -(S.shY + 14 + j * 4)], face: 3, fR: [S.hipW + 2, -j * 2], fL: [-S.hipW - 2, -j * 3] });
        break;
      }
      case 'lose': {
        const c = (Math.sin(t * 0.35) + 1) / 2;
        set({ hR: [8 + c * 3, -(S.shY - 6)], hL: [8 - c * 3, -(S.shY - 8)], face: 5, lean: 0.08, by: 1 });
        break;
      }
      case 'entrance': {
        const u = clamp(sf / 26, 0, 1);
        if (!f.grounded) { Object.assign(P, airStance); set({ hR: [14, -(S.shY + 12)], hL: [-14, -(S.shY + 12)] }); }
        else set({ by: S.hipY * 0.4 * (1 - u), sy: 1 - 0.08 * (1 - u) });
        break;
      }
      default: {   // idle
        const b = Math.sin(t * 0.085);
        set({ by: b * 0.9 + 0.9, hR: [stance.hR[0], stance.hR[1] + b * 1.3], hL: [stance.hL[0], stance.hL[1] + b * 1.3] });
      }
    }
    return P;
  }

  function pose(f) {
    let base = f.grounded || f.state === 'ledge' || f.state === 'respawn' ? stance : airStance;
    let p;
    if (f.state === 'move' && f.move) {
      const mv = f.move;
      if (mv.base === 'air') base = airStance; else if (mv.base === 'ground') base = stance;
      const keys = typeof mv.pose === 'function' ? mv.pose(f, f.mf) : mv.pose;
      p = Array.isArray(keys) ? evalKeys(keys, f.mf, base) : Object.assign({}, base, keys);
      if (p.face === 0 && mv.kind !== 'taunt') p.face = 1;
      if (f.charge > 0 && mv.charge && f.mf === mv.charge.at) p.ox = (p.ox || 0) + (f.t % 2 ? 1.2 : -1.2);
    } else {
      p = Object.assign({}, base, auto(f));
    }
    if (S.poseFix) S.poseFix(f, p);
    return p;
  }

  // joints in local space for a pose
  function joints(p) {
    const hip = [0, -S.hipY + p.by];
    const up = rotv(0, -(S.shY - S.hipY), p.lean);
    const sh = [hip[0] + up[0], hip[1] + up[1]];
    const hd = rotv(p.hx, -(S.headY - S.hipY) + p.hy, p.lean * 0.85);
    const head = [hip[0] + hd[0], hip[1] + hd[1]];
    const shR = [sh[0] + S.shW * 0.35, sh[1] + 1], shL = [sh[0] - S.shW * 0.35, sh[1] + 1];
    const hipR = [hip[0] + S.hipW * 0.55, hip[1]], hipL = [hip[0] - S.hipW * 0.55, hip[1]];
    const eR = ik2(shR[0], shR[1], p.hR[0], p.hR[1], S.arm[0], S.arm[1], S.elbowBend);
    const eL = ik2(shL[0], shL[1], p.hL[0], p.hL[1], S.arm[0], S.arm[1], S.elbowBend);
    const kR = ik2(hipR[0], hipR[1], p.fR[0], p.fR[1] - S.footH * 0.5, S.leg[0], S.leg[1], S.kneeBend);
    const kL = ik2(hipL[0], hipL[1], p.fL[0], p.fL[1] - S.footH * 0.5, S.leg[0], S.leg[1], S.kneeBend);
    return {
      hip, sh, head, shR, shL, hipR, hipL,
      eR: [eR[0], eR[1]], hR: [eR[2], eR[3]], eL: [eL[0], eL[1]], hL: [eL[2], eL[3]],
      kR: [kR[0], kR[1]], fR: [kR[2], kR[3] + S.footH * 0.5], kL: [kL[0], kL[1]], fL: [kL[2], kL[3] + S.footH * 0.5],
      ht: p.ht + p.lean * 0.6,
    };
  }

  // apply the whole-body spin/offset/squash to a local point
  function xf(p, x, y) {
    x *= p.sx; y *= p.sy;
    if (p.rot) { const cy = -H * 0.5; const r = rotv(x, y - cy, p.rot); x = r[0]; y = r[1] + cy; }
    return [x + p.ox, y + p.oy];
  }

  function points(f, p) {
    const J = joints(p);
    const tip = S.propLen ? [J.hR[0] + Math.cos(p.prop) * S.propLen, J.hR[1] + Math.sin(p.prop) * S.propLen] : J.hR;
    const mid = S.propLen ? [J.hR[0] + Math.cos(p.prop) * S.propLen * 0.55, J.hR[1] + Math.sin(p.prop) * S.propLen * 0.55] : J.hR;
    const out = {
      hR: xf(p, J.hR[0], J.hR[1]), hL: xf(p, J.hL[0], J.hL[1]),
      fR: xf(p, J.fR[0], J.fR[1] - 3), fL: xf(p, J.fL[0], J.fL[1] - 3),
      eR: xf(p, J.eR[0], J.eR[1]), kR: xf(p, J.kR[0], J.kR[1]),
      head: xf(p, J.head[0], J.head[1]), body: xf(p, 0, (J.hip[1] + J.sh[1]) / 2),
      hip: xf(p, J.hip[0], J.hip[1]),
      prop: xf(p, tip[0], tip[1]), propMid: xf(p, mid[0], mid[1]),
      grab: [S.shW + S.arm[0] + S.arm[1] + 6, 0],
    };
    if (S.extraPoints) S.extraPoints(f, p, J, out, xf);
    return out;
  }

  function draw(ctx, f, p, m) {
    const pal = f.drawPal || f.pal, J = joints(p), lw = S.lw;
    const D = { J, pal, p, S, f, m };
    ctx.save();
    ctx.translate(p.ox, p.oy);
    if (p.rot) { ctx.translate(0, -H * 0.5); ctx.rotate(p.rot); ctx.translate(0, H * 0.5); }
    if (p.sx !== 1 || p.sy !== 1) ctx.scale(p.sx, p.sy);

    const arm = (sh, e, h, front) => {
      if (S.drawArm) return S.drawArm(ctx, D, sh, e, h, front);
      const col = pal[S.armKey] || '#f1c27d';
      if (S.sleeveKey && pal[S.sleeveKey]) {
        limb(ctx, [e[0], e[1], h[0], h[1]], S.armW * 0.92, col, OUT, lw);
        limb(ctx, [sh[0], sh[1], e[0], e[1]], S.armW, pal[S.sleeveKey], OUT, lw);
      } else limb(ctx, [sh[0], sh[1], e[0], e[1], h[0], h[1]], S.armW, col, OUT, lw);
      if (S.hand) S.hand(ctx, D, h[0], h[1], front);
      else circle(ctx, h[0], h[1], S.handR, pal[S.handKey] || col, OUT, lw);
    };
    const leg = (hp, k, ft, front) => {
      if (S.drawLeg) return S.drawLeg(ctx, D, hp, k, ft, front);
      limb(ctx, [hp[0], hp[1], k[0], k[1], ft[0], ft[1] - S.footH * 0.5], S.legW, pal[S.legKey] || '#3b4a6b', OUT, lw);
      if (S.foot) S.foot(ctx, D, ft[0], ft[1], front);
      else {
        const lift = clamp(-ft[1] / 10, 0, 1) * 0.5;
        ctx.save(); ctx.translate(ft[0], ft[1] - S.footH * 0.5); ctx.rotate(lift);
        ellipse(ctx, S.footL * 0.22, 0, S.footL * 0.5, S.footH * 0.5, pal[S.footKey] || '#5a3a22', OUT, lw);
        ctx.restore();
      }
    };

    if (S.back) S.back(ctx, D);
    if (!S.hideArms) arm(J.shL, J.eL, J.hL, false);
    leg(J.hipL, J.kL, J.fL, false);
    if (S.torso) S.torso(ctx, D);
    leg(J.hipR, J.kR, J.fR, true);
    if (S.head) {
      ctx.save(); ctx.translate(J.head[0], J.head[1]); ctx.rotate(J.ht);
      S.head(ctx, D);
      ctx.restore();
    }
    if (S.prop && !S.propBehind) { ctx.save(); ctx.translate(J.hR[0], J.hR[1]); ctx.rotate(p.prop); S.prop(ctx, D); ctx.restore(); }
    if (!S.hideArms) arm(J.shR, J.eR, J.hR, true);
    if (S.prop && S.propBehind) { ctx.save(); ctx.translate(J.hR[0], J.hR[1]); ctx.rotate(p.prop); S.prop(ctx, D); ctx.restore(); }
    if (S.front) S.front(ctx, D);
    ctx.restore();
  }

  return { pose, points, draw, stance, airStance, joints, spec: S, height: H };
}

// Convenience for writing poses: h(x, up) reads as "hand 12 forward, 40 up".
export const at = (x, up) => [x, -up];

// ---------------------------------------------------------------------------
// For fighters that are one squashy body rather than a puppet (balls, blocks,
// vehicles): stock squash/stretch/spin for every non-attack state.
// Returns { sx, sy, rot, ox, oy, face }; the fighter adds its own extras.
export function blobAuto(f, o = {}) {
  const t = f.t, sf = f.sf, P = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0, face: 0 };
  switch (f.state) {
    case 'walk': case 'run': case 'dash': P.sx = 1.06; P.sy = 0.95; P.rot = o.lean === undefined ? 0.08 : o.lean; break;
    case 'brake': case 'turn': P.sx = 0.94; P.sy = 1.05; P.rot = -(o.lean === undefined ? 0.12 : o.lean * 1.5); break;
    case 'crouch': P.sy = 0.72; P.sx = 1.2; break;
    case 'jumpsquat': P.sy = 0.7; P.sx = 1.24; break;
    case 'air': { const v = clamp(f.vy / 8, -1, 1); P.sy = 1 + Math.abs(v) * 0.14; P.sx = 1 - Math.abs(v) * 0.1; break; }
    case 'land': { const k = 1 - clamp(sf / Math.max(1, f.lag), 0, 1); P.sy = 1 - 0.28 * k; P.sx = 1 + 0.24 * k; break; }
    case 'helpless': P.rot = Math.sin(t * 0.3) * 0.3; P.face = 2; break;
    case 'shield': case 'shieldstun': P.sy = 0.93; P.sx = 1.05; P.face = 1; break;
    case 'roll': case 'tech': P.rot = (f.rollDir * f.facing || 1) * ease.io(clamp(sf / 24, 0, 1)) * TAU; P.sy = 0.92; break;
    case 'spotdodge': { const u = Math.sin(clamp(sf / 22, 0, 1) * Math.PI); P.sx = 1 - 0.3 * u; P.ox = -8 * u; break; }
    case 'airdodge': P.rot = -ease.io(clamp(sf / 26, 0, 1)) * TAU; break;
    case 'hitstun': case 'trapped': P.face = 2; P.rot = f.tumble ? -f.t * 0.25 : -0.3; P.sx = 0.94; P.sy = 1.06; break;
    case 'tumble': P.face = 2; P.rot = -f.t * 0.16; break;
    case 'down': P.sy = 0.6; P.sx = 1.35; P.face = sf < 30 ? 2 : 5; break;
    case 'getup': { const u = clamp(sf / 20, 0, 1); P.sy = 0.6 + 0.4 * u + Math.sin(u * Math.PI) * 0.15; P.sx = 1.35 - 0.35 * u; break; }
    case 'stun': if (f.stunKind === 'dizzy') { P.rot = Math.sin(t * 0.13) * 0.25; P.face = 4; } else { P.ox = t % 4 < 2 ? 1.5 : -1.5; P.face = 6; } break;
    case 'grabbed': P.face = 2; P.ox = Math.sin(t * 0.9) * 1.2; P.sx = 0.93; break;
    case 'grabhold': P.face = 1; break;
    case 'ledge': P.sy = 1.08; P.sx = 0.94; break;
    case 'ledgeclimb': { const u = clamp(sf / 26, 0, 1); P.rot = (1 - u) * 0.6; break; }
    case 'win': { const j = Math.abs(Math.sin(t * 0.14)); P.oy = -j * 16; P.sy = 1 + (0.5 - j) * 0.2; P.sx = 1 - (0.5 - j) * 0.16; P.face = 3; break; }
    case 'lose': P.sy = 0.9; P.sx = 1.08; P.face = 5; break;
    case 'entrance': { const u = clamp(sf / 26, 0, 1); if (f.grounded) { P.sy = 1 - 0.25 * (1 - u); P.sx = 1 + 0.2 * (1 - u); } break; }
    default: { const b = Math.sin(t * 0.09) * 0.025; P.sy = 1 + b; P.sx = 1 - b; }
  }
  return P;
}

// Pose for a custom rig: stock states from blobAuto (plus `extra` defaults),
// attacks from the move's keyframes laid over `base`.
export function customPose(f, base, extraAuto) {
  if (f.state === 'move' && f.move) {
    const mv = f.move;
    const keys = typeof mv.pose === 'function' ? mv.pose(f, f.mf) : mv.pose;
    const p = Array.isArray(keys) ? evalKeys(keys, f.mf, base) : Object.assign({}, base, keys);
    if (p.face === 0 && mv.kind !== 'taunt') p.face = 1;
    if (f.charge > 0 && mv.charge && f.mf === mv.charge.at) p.ox = (p.ox || 0) + (f.t % 2 ? 1.2 : -1.2);
    return p;
  }
  const p = Object.assign({}, base, blobAuto(f, base._auto));
  if (extraAuto) extraAuto(f, p);
  return p;
}
