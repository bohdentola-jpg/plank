// CAMP KIDS - slot 9 of the roster.
// Brief: three interchangeable kids (the other two are costumes). They wear
// floaties, so one good shove attack with strong knockback - but otherwise
// ONLY ranged attacks, which makes them annoying; they want a high perch.
// Super: a huge rocket that crosses the whole screen.
//
// Every costume is the same puppet body; `pal.kid` picks which head is drawn
// (Benny, Jo, Mikey or the Counselor). The one melee tool is the vest bump
// (jab, dash attack, get-up attack). Everything else leaves the hand.

import { biped, at } from '../game/rig.js';
import { K, hit, air, stdGrab, stdThrows, shoot, countMine, costumes } from '../game/movekit.js';
import { Entity, Projectile } from '../game/entities.js';
import { groundBelow, pointInSolid } from '../game/physics.js';
import { OUT, LW, circle, ellipse, blob, rrect, limb, line, polygon, fs, eye, eyes, mouth, gloss, darken, txt } from '../core/gfx.js';
import { TAU, clamp, lerp, sign } from '../core/util.js';

const BASE = {
  main: '#f58220', kid: 0,
  vest: '#f58220', strap: '#fff4dc', buckle: '#3a3f55', floatie: '#ffd23a',
  skin: '#f6c7a0', hair: '#8a5527', shorts: '#2f7fd0', shoe: '#e8402a', sole: '#fff7e0',
  wood: '#a9703a', band: '#d4334a', tie: '#ffe23a', cap: '#e8402a', frame: '#3a2d4a', glass: '#dff4ff',
};

const CAP = 6;                     // most shots one kid may have in the world at once
const LOB = 10.4, LOB_G = 0.28;    // tennis ball speed and gravity (the aim preview uses the same numbers)
const AIM_LO = -0.3, AIM_HI = 1.4; // how far the lob can be tilted, radians above flat

// ---- the things they shoot (each drawn around its own centre) ---------------
function pebbleArt(ctx) {
  blob(ctx, [-4.6, 0.6, -2, -4, 3, -3.6, 4.8, 0.6, 2, 4, -2.6, 3.6], '#aeb7c4', OUT, 1.8, 0.5);
  circle(ctx, -1, -1.3, 1.1, '#eef2f7', null, 0);
}
function tennisArt(ctx) {
  circle(ctx, 0, 0, 7, '#d4ec3a', OUT, 2);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-7.4, 0, 6, -0.75, 0.75); ctx.stroke();
  ctx.beginPath(); ctx.arc(7.4, 0, 6, Math.PI - 0.75, Math.PI + 0.75); ctx.stroke();
}
function gumArt(ctx, c) { circle(ctx, 0, 0, 5.4, c, OUT, 1.8); gloss(ctx, -1.6, -1.8, 1.9, 1.1, 0.6); }
function balloonArt(ctx, s = 1, wob = 0) {
  ctx.save(); ctx.scale(s * (1 + wob), s * (1 - wob));
  polygon(ctx, [-9.5, -2.6, -13, -3.4, -13, 3.4, -9.5, 2.6], '#2f7fd0', OUT, 1.6);    // the knot
  ellipse(ctx, 0, 0, 10.5, 9, '#4db8f2', OUT, LW);
  gloss(ctx, -1, -4.2, 4.2, 2, 0.55, -0.3);
  ctx.restore();
}
function dodgeArt(ctx) {
  circle(ctx, 0, 0, 11, '#c93a52', OUT, LW);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.clip();
  ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(-13, 0, 11, -1.1, 1.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(13, 0, 11, Math.PI - 1.1, Math.PI + 1.1); ctx.stroke();
  ctx.restore();
  gloss(ctx, -3, -5.4, 3.6, 1.8, 0.45);
}
// a bottle rocket lying along +x, nose at the right; `fl` = flame length (0 = unlit), `stick` = how much
// stick trails behind. Outlines are divided by the scale so a big one keeps the house line weight.
function rocketArt(ctx, s = 1, fl = 0, t = 0, stick = 17) {
  const k = 1 / s;
  ctx.save(); ctx.scale(s, s);
  limb(ctx, [-4 - stick, 2.2, -4, 2.2], 1.8, '#c9a26a', OUT, 1.6 * k);
  if (fl > 0) {
    const n = fl * (t % 4 < 2 ? 18 : 13);
    blob(ctx, [-8, -3.6, -8 - n * 0.5, -1.6, -8 - n, 0, -8 - n * 0.5, 1.8, -8, 3.6], '#ff8a1e', darken('#ff8a1e', 0.45), 1.6 * k, 0.4);
    blob(ctx, [-8, -2, -8 - n * 0.3, -0.7, -8 - n * 0.55, 0, -8 - n * 0.3, 0.9, -8, 2], '#ffe45c', null, 0, 0.4);
  }
  polygon(ctx, [-9, -3.4, -13.5, -7, -5, -3.4], '#2f7fd0', OUT, 2 * k);                 // fins
  polygon(ctx, [-9, 3.4, -13.5, 7, -5, 3.4], '#2f7fd0', OUT, 2 * k);
  rrect(ctx, -9, -3.6, 15, 7.2, 2, '#e8402a', OUT, 2.2 * k);
  ctx.fillStyle = '#fff4dc'; ctx.fillRect(-3.4, -3.6 + 1.1 * k, 2.6, 7.2 - 2.2 * k);
  polygon(ctx, [6, -3.8, 12.5, 0, 6, 3.8], '#ffd23a', OUT, 2.2 * k);                    // nose cone
  ctx.restore();
}
function stinkArt(ctx, t = 0, fuse = 1) {
  circle(ctx, 0, -6.5, 6.5, '#7d9a3a', OUT, 2);
  rrect(ctx, -2.4, -15.6, 4.8, 4.4, 1.2, '#d9b77c', OUT, 1.5);                          // cork
  gloss(ctx, -2.2, -8.6, 2.2, 1.2, 0.45);
  if (fuse > 0) {      // wavy stink lines that get busier as it is about to go
    ctx.strokeStyle = '#8bc23a'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
    for (const dx of [-6, 0, 6]) {
      const y0 = -19 - ((t * 0.5 + dx * 3) % 9);
      ctx.beginPath(); ctx.moveTo(dx, y0); ctx.quadraticCurveTo(dx + 3, y0 - 3, dx, y0 - 6); ctx.quadraticCurveTo(dx - 3, y0 - 9, dx, y0 - 12); ctx.stroke();
    }
  }
}
// the slingshot; origin = the hand that holds it, +x = the way it points
function slingArt(ctx, pal, pull = 0, ammo = null) {
  const px = 9 - pull * 17;                                                             // where the pouch is
  line(ctx, 13.2, 6, px, 0.6, pal.band, 1.8);                                           // far half of the band
  limb(ctx, [-3.6, 0, 6.4, 0], 3.4, pal.wood, OUT, 1.8);                                // handle
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(13.4, -6.2); ctx.quadraticCurveTo(5.4, -5.6, 6.2, 0); ctx.quadraticCurveTo(5.4, 5.6, 13.4, 6.2);
  ctx.strokeStyle = OUT; ctx.lineWidth = 3 + 3.6; ctx.stroke(); ctx.strokeStyle = pal.wood; ctx.lineWidth = 3; ctx.stroke();
  line(ctx, 13.2, -6, px, -0.6, pal.band, 1.8);                                         // near half of the band
  if (pull > 0.12) {
    if (ammo) { ctx.save(); ctx.translate(px + 2.4, 0); ctx.scale(0.72, 0.72); ammo(ctx); ctx.restore(); }
    circle(ctx, px - 1.2, 0, 3.7, pal.skin, OUT, 1.7);                                  // the fingers pinching the pouch
  } else rrect(ctx, px - 1.6, -2, 3.2, 4, 1.2, darken(pal.band, 0.25), OUT, 1.2);
}

// what the throwing hand is holding right now
const RELEASE = { fsmash: 16, dsmash: 15, usmash: 14, dspecial: 13 };
const HANDS_FREE = { grab: 1, fthrow: 1, bthrow: 1, uthrow: 1, dthrow: 1, uspecial: 1, super: 1 };
function holding(f) {
  if (f.state === 'grabhold' || f.state === 'ledge' || f.state === 'ledgeclimb') return 'none';
  if (f.state !== 'move') return 'sling';
  const id = f.moveId, fr = f.mf;
  if (HANDS_FREE[id]) return 'none';
  if (id === 'fsmash') return fr < RELEASE.fsmash ? 'balloon' : 'none';
  if (id === 'dsmash') return fr < RELEASE.dsmash ? 'ball' : 'none';
  if (id === 'usmash') return fr < RELEASE.usmash ? 'rocket' : 'bottle';
  if (id === 'dspecial') return fr < RELEASE.dspecial ? 'stink' : 'none';
  return 'sling';
}
const AMMO = { nspecial: tennisArt, sspecial: (ctx) => gumArt(ctx, '#e8402a') };

// ---- the four heads ----------------------------------------------------------
function pigtail(ctx, x, y, ang, pal) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  blob(ctx, [0, -2.6, 6, -5.4, 12.5, -2.4, 13.6, 3, 7, 5.2, 0, 2.6], pal.hair, OUT, 2, 0.5);
  rrect(ctx, -1.8, -3.4, 3.6, 6.8, 1.5, pal.tie, OUT, 1.4);
  ctx.restore();
}
function kidFace(ctx, pal, ex, kid, t) {
  if (kid === 2) {            // Mikey's glasses, with the eyes drawn inside the lenses
    line(ctx, -2, 0.4, -7.6, 1.6, pal.frame, 1.6);
    circle(ctx, 2.4, 0.9, 4.6, pal.glass, pal.frame, 1.7); circle(ctx, 11, 1, 4.1, pal.glass, pal.frame, 1.7);
    line(ctx, 6.9, 0.2, 7.1, 0.2, pal.frame, 1.7);
    if (ex === 2 || ex === 3 || ex === 5) { eye(ctx, 2.6, 1, 2.5, ex, 0, 0, 1, { lw: 1.2 }); eye(ctx, 11, 1.1, 2.3, ex, 0, 0, -1, { lw: 1.2 }); }
    else if (ex === 4) { eye(ctx, 2.4, 0.9, 3, 4, 0, 0, 1, { lw: 0.01, white: pal.glass, t }); eye(ctx, 11, 1, 2.8, 4, 0, 0, -1, { lw: 0.01, white: pal.glass, t }); }
    else {
      const pr = ex === 6 ? 0.9 : 1.7;
      circle(ctx, 3.2, 1, pr, OUT, null, 0);
      if (ex === 1) line(ctx, 9.2, 1.2, 12.8, 1.2, OUT, 1.6); else circle(ctx, 11.6, 1.1, pr, OUT, null, 0);
    }
  } else if (ex === 1) {      // taking aim: one eye shut
    eye(ctx, 2.2, 0.9, 3.5, 0, 0.6, 0, 1, { lw: 1.5, tall: true });
    eye(ctx, 10.7, 1.2, 3.3, 5, 0, 0, -1, { lw: 1.3 });
    line(ctx, -1.6, -4.4, 5.2, -3.4, OUT, 1.7);
  } else eyes(ctx, 6.4, 0.9, 3.4, 4.3, ex, 0.5, 0.05, { lw: 1.5, tall: true, t });
  if (kid === 3) rrect(ctx, 6.4, 3.4, 5.6, 2.6, 1.3, '#ffffff', OUT, 1.1);              // sunscreen on the nose
  else { ctx.beginPath(); ctx.arc(8.2, 4.2, 1.5, -0.4, 2.2); ctx.strokeStyle = darken(pal.skin, 0.4); ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.stroke(); }
  if (kid < 2) {              // freckles
    ctx.fillStyle = darken(pal.skin, 0.28);
    for (const [fx, fy] of [[0.6, 5.6], [-1.2, 7], [2.2, 7.2], [11.4, 5.6], [12.4, 7]]) { ctx.beginPath(); ctx.arc(fx, fy, 0.75, 0, TAU); ctx.fill(); }
  }
  if (ex === 1) {             // ...and the tongue out, concentrating
    line(ctx, 4.6, 8.6, 9, 8.2, OUT, 1.5);
    ctx.beginPath(); ctx.ellipse(8.8, 9.6, 1.9, 2.2, 0, 0, TAU); fs(ctx, '#ff7f9a', OUT, 1.2);
  } else if (ex === 2 || ex === 6) mouth(ctx, 7.2, 8.6, 6.5, 2, { lw: 1.4 });
  else if (ex === 3) mouth(ctx, 7, 7.4, 9, 3, { lw: 1.4, inside: '#7a1f25' });
  else if (ex === 4) mouth(ctx, 7, 8.4, 7, 4, { lw: 1.5 });
  else if (ex === 5) mouth(ctx, 7, 8.6, 5.5, 5, { lw: 1.5 });
  else mouth(ctx, 7, 8, 7, 0, { lw: 1.5 });
}
function kidHead(ctx, { pal, p, f }) {
  const ex = p.face, kid = pal.kid | 0, t = f.t || 0, hair = pal.hair;
  const sway = Math.sin(t * 0.11) * 0.07 + clamp((f.vy || 0) * 0.03, -0.3, 0.3);
  if (kid === 1) pigtail(ctx, 8.6, -11.4, -0.95 - sway, pal);                           // the far pigtail peeks over the top
  ellipse(ctx, 0.6, 0.6, 13.6, 13, pal.skin);
  if (kid !== 0) ellipse(ctx, -7.6, 2.8, 2.6, 3.4, pal.skin, OUT, 1.6);                 // ear (the bowl cut hides Benny's)
  ctx.beginPath();
  if (kid === 0) {            // Benny: a bowl cut with a ruler-straight fringe
    ctx.moveTo(-13.6, 5.2); ctx.quadraticCurveTo(-16.6, -14.8, 0.6, -15.4); ctx.quadraticCurveTo(15.8, -15.2, 15.2, -3.6);
    ctx.quadraticCurveTo(15.2, -1.8, 13.4, -2.8); ctx.lineTo(-3.4, -4); ctx.quadraticCurveTo(-5.6, -1, -6, 4.8); ctx.quadraticCurveTo(-10, 6.8, -13.6, 5.2);
    ctx.closePath(); fs(ctx, hair, OUT, 2);
    gloss(ctx, -2.6, -10.4, 7, 2, 0.3, -0.2);
  } else if (kid === 1) {     // Jo: swept fringe and two pigtails
    ctx.moveTo(-12.8, 2.8); ctx.quadraticCurveTo(-15.6, -14.6, 0.8, -15.2); ctx.quadraticCurveTo(15, -14.8, 14.6, -5.4);
    ctx.quadraticCurveTo(9, -9.8, 3.4, -8.4); ctx.quadraticCurveTo(-3, -6.8, -6.4, -1.4); ctx.quadraticCurveTo(-9, 3, -12.8, 2.8);
    ctx.closePath(); fs(ctx, hair, OUT, 2);
    gloss(ctx, -3, -11, 5.4, 1.8, 0.3, -0.3);
    pigtail(ctx, -11.2, -6.8, Math.PI + 0.62 + sway, pal);
  } else if (kid === 2) {     // Mikey: a buzz cut, close to the skull
    ctx.moveTo(-13, -0.6); ctx.quadraticCurveTo(-13.8, -14.3, 0.8, -14.4); ctx.quadraticCurveTo(13.6, -14.2, 14.1, -6.2);
    ctx.quadraticCurveTo(6, -10.8, -2.4, -8.8); ctx.quadraticCurveTo(-6.4, -7, -7.2, -1.6); ctx.quadraticCurveTo(-10, -0.2, -13, -0.6);
    ctx.closePath(); fs(ctx, hair, OUT, 1.8);
  } else {                    // the Counselor: hair under a tall trucker cap with the camp's pine tree on it
    ctx.moveTo(-13.4, -4); ctx.quadraticCurveTo(-14, 4.4, -9.8, 5.6); ctx.quadraticCurveTo(-6.4, 2, -6.4, -4.6); ctx.closePath(); fs(ctx, hair, OUT, 1.8);
    ctx.beginPath(); ctx.moveTo(-13.8, -3.6); ctx.quadraticCurveTo(-15, -18, 1, -19); ctx.quadraticCurveTo(14.4, -19.2, 14.8, -5.2); ctx.closePath(); fs(ctx, pal.cap, OUT, 2);
    ctx.beginPath(); ctx.moveTo(2.4, -4.6); ctx.quadraticCurveTo(2.2, -17.8, 8.6, -18); ctx.quadraticCurveTo(14.4, -17, 14.8, -5.2); ctx.closePath(); fs(ctx, '#fff7e0', OUT, 1.6);
    polygon(ctx, [8.6, -15.8, 12, -8.6, 5.2, -8.6], '#35a84a', OUT, 1.2);
    ctx.beginPath(); ctx.moveTo(5, -6.2); ctx.lineTo(21.6, -5.4); ctx.quadraticCurveTo(24.2, -2.6, 20.4, -2.2); ctx.lineTo(5, -3.4); ctx.closePath(); fs(ctx, darken(pal.cap, 0.18), OUT, 2);
  }
  kidFace(ctx, pal, ex, kid, t);
}

// the bottle rocket they hug for the up special, drawn behind the body
function rideRocket(ctx, f) {
  const fr = f.mf;
  if (fr < 5 || fr > 40) return;
  ctx.save(); ctx.translate(-13, -30); ctx.rotate(-Math.PI / 2);
  if (fr > 34) ctx.globalAlpha = clamp((41 - fr) / 6, 0, 1);
  rocketArt(ctx, 2.9, fr >= 9 && fr < 32 ? 0.45 : 0, f.t, f.grounded ? 7 : 12);
  ctx.restore();
}

const rig = biped({
  hipY: 13, hipW: 6.5, shY: 27, shW: 11, headY: 41.5,
  arm: [9, 9], leg: [7, 7], armW: 6, legW: 7, handR: 5, footL: 12, footH: 6.5, propLen: 14,
  legKey: 'skin',
  stance: { hR: at(13, 19), hL: at(-10, 16), prop: -0.9, pull: 0 },
  airStance: { hR: at(15, 29), hL: at(-12, 27), fR: at(6, 5), fL: at(-7, 1), prop: -0.8 },

  // the far hand follows the pouch whenever the band is drawn back
  poseFix(f, p) {
    if (!(p.pull > 0.02)) return;
    const J = rig.joints(p), d = 7.8 - p.pull * 17;
    p.hL = [J.hR[0] + Math.cos(p.prop) * d, J.hR[1] + Math.sin(p.prop) * d];
  },

  back(ctx, { J, pal, f }) {
    if (f.state === 'move' && f.moveId === 'uspecial') rideRocket(ctx, f);
    if (holding(f) !== 'sling') {     // slingshot tucked into the back of the trunks
      ctx.save(); ctx.translate(J.hip[0] - 7, J.hip[1] - 1); ctx.rotate(-2.05); slingArt(ctx, pal, 0); ctx.restore();
    }
    ellipse(ctx, J.sh[0] - 3.4, J.sh[1] - 4, 11.5, 7, pal.vest, OUT, LW, -0.2);        // the collar pillow of the life vest
  },

  torso(ctx, { J, pal }) {
    const sh = J.sh, hip = J.hip, mx = (sh[0] + hip[0]) / 2, my = (sh[1] + hip[1]) / 2;
    // swim trunks
    blob(ctx, [hip[0] - 9.5, hip[1] - 2, hip[0] + 9.5, hip[1] - 2, hip[0] + 10.5, hip[1] + 6.5, hip[0], hip[1] + 5, hip[0] - 10.5, hip[1] + 6.5], pal.shorts, OUT, LW, 0.25);
    // the life vest: one fat foam slab, wider than the kid inside it
    blob(ctx, [sh[0] - 10.5, sh[1] - 2.5, sh[0] + 10.5, sh[1] - 3.5, mx + 14.5, my - 0.5, hip[0] + 12.5, hip[1] + 1.5, hip[0] - 11.5, hip[1] + 1.5, mx - 13.5, my - 0.5], pal.vest, OUT, LW, 0.42);
    gloss(ctx, mx - 6.5, my - 4, 4, 2.1, 0.32);
    line(ctx, sh[0] + 5.6, sh[1] - 1.6, hip[0] + 6.4, hip[1] + 0.4, darken(pal.vest, 0.32), 1.6);       // zip
    for (const k of [0.3, 0.74]) {    // two webbing straps with buckles
      const x = lerp(sh[0], hip[0], k), y = lerp(sh[1], hip[1], k), w = 11.6 + Math.sin(k * Math.PI) * 2.4;
      limb(ctx, [x - w + 1.5, y, x + w, y], 2.4, pal.strap, OUT, 1.4);
      rrect(ctx, x + 3.4, y - 2.5, 5, 5, 1.2, pal.buckle, OUT, 1.3);
    }
    if ((pal.kid | 0) === 3) {        // the Counselor's whistle
      line(ctx, sh[0] - 2, sh[1] - 2, mx - 2.4, my - 0.5, pal.cap, 1.6); line(ctx, sh[0] + 4, sh[1] - 2.4, mx - 2.4, my - 0.5, pal.cap, 1.6);
      rrect(ctx, mx - 6, my - 1.4, 7, 4.6, 1.6, '#cfd6e0', OUT, 1.4); circle(ctx, mx - 1.8, my + 0.9, 1, OUT, null, 0);
    }
  },

  head: kidHead,

  // bare arms, each with an inflatable band round the upper arm
  drawArm(ctx, { pal, S }, sh, e, h) {
    limb(ctx, [sh[0], sh[1], e[0], e[1], h[0], h[1]], S.armW, pal.skin, OUT, S.lw);
    const ax = lerp(sh[0], e[0], 0.36), ay = lerp(sh[1], e[1], 0.36), bx = lerp(sh[0], e[0], 0.74), by = lerp(sh[1], e[1], 0.74);
    limb(ctx, [ax, ay, bx, by], S.armW + 2.6, pal.floatie, OUT, 1.8);
    circle(ctx, h[0], h[1], S.handR, pal.skin, OUT, S.lw);
  },

  foot(ctx, { pal, S }, x, y) {       // sneakers with a white toe cap
    ctx.save(); ctx.translate(x, y - S.footH * 0.5); ctx.rotate(clamp(-y / 10, 0, 1) * 0.5);
    ellipse(ctx, S.footL * 0.22, 0, S.footL * 0.5, S.footH * 0.5, pal.shoe, OUT, S.lw);
    ctx.beginPath(); ctx.ellipse(S.footL * 0.22 + 3.4, 0.5, 2.5, 2, 0, 0, TAU); ctx.fillStyle = pal.sole; ctx.fill();
    ctx.restore();
  },

  prop(ctx, { pal, p, f }) {          // whatever is in the throwing hand
    const h = holding(f);
    if (h === 'sling') slingArt(ctx, pal, p.pull || 0, AMMO[f.moveId] || pebbleArt);
    else if (h === 'balloon') { ctx.translate(11, 0); ctx.rotate(Math.PI); balloonArt(ctx, 0.9 + (f.charge || 0) / 200, Math.sin(f.t * 0.6) * 0.04); }
    else if (h === 'ball') { ctx.translate(10, 0); dodgeArt(ctx); }
    else if (h === 'stink') { ctx.translate(2, 0); ctx.rotate(Math.PI / 2); stinkArt(ctx, f.t, 0); }
    else if (h === 'rocket' || h === 'bottle') {
      if (h === 'rocket') { ctx.save(); ctx.translate(21, 0); rocketArt(ctx, 1.25, 0); ctx.restore(); }
      rrect(ctx, -6, -4.2, 13, 8.4, 2.4, '#7fd08a', OUT, 1.8); rrect(ctx, 6, -2.2, 6, 4.4, 1.2, '#7fd08a', OUT, 1.6);  // the pop bottle it stands in
      gloss(ctx, -1, -1.8, 3.4, 1.1, 0.5, 0);
    }
  },
});

// where the fork of the slingshot (or the hand) is this frame, as [forward, up]
function muzzle(f, key = 'prop') { const P = rig.points(f, rig.pose(f)); return [P[key][0], -P[key][1]]; }

const live = (f, m) => { let n = 0; for (const e of m.entities) if (e.owner === f && e.ck && !e.dead) n++; return n; };
const room = (f, m) => live(f, m) < CAP;

function streak(ctx, p, len = 2.2) {
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.x - p.vx * 0.5, p.y - p.vy * 0.5); ctx.lineTo(p.x - p.vx * len, p.y - p.vy * len); ctx.stroke();
}
const spun = (art) => (ctx, p) => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); art(ctx, p); ctx.restore(); };
const drawPebble = (ctx, p) => { streak(ctx, p); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); pebbleArt(ctx); ctx.restore(); };

// One slingshot pebble at angle `a` (radians above flat; PI = behind).
function pebble(f, m, a, o = {}) {
  const [x, y] = muzzle(f), sp = o.sp || 9.6;
  m.sfx('swishS', { rate: 1.5 }); m.sfx('pop', { vol: 0.35, rate: 1.6 });
  return shoot(f, m, Object.assign({ ck: true, tag: 'ckpeb', x, y, vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp, r: 6, life: 34, spin: 0.4, drawFn: drawPebble,
    onDie: (p, m2) => { m2.fx.spark(p.x, p.y, 3, '#dfe6ee'); } }, o,
    { hit: Object.assign({ dmg: 5, ang: 361, bk: 12, kg: 30, sfx: 'tink' }, o.hit) }));
}

// charged shots hit harder: the same +40% a charged melee smash gets
const chargeMul = (f) => 1 + clamp((f.charge || 0) / 60, 0, 1) * 0.4;

// ---- stink bomb ------------------------------------------------------------
const PUFFS = [[-24, -18, 17], [-4, -30, 20], [20, -20, 18], [-14, -44, 15], [12, -46, 16], [30, -36, 12], [-32, -34, 12]];
class StinkBomb extends Entity {
  constructor(m, f, x, y) {
    super({ owner: f, team: f.team, tag: 'ckstink', ck: true });
    this.x = x; this.y = y; this.vx = f.facing * 2.8; this.vy = -5.4;
    this.landed = false; this.ground = null; this.fuse = 72; this.cloud = 0; this.life = 150; this.rot = 0;
  }
  update(m) {
    this.t++;
    if (this.cloud) {
      if (++this.cloud > this.life) this.dead = true;
      if (this.cloud % 16 === 0) m.fx.smoke(this.x + m.rng.range(-30, 30), this.y - 44, '#b6e04a', 7);
      return;
    }
    if (!this.landed) {
      this.vy += 0.3; const py = this.y; this.x += this.vx; this.y += this.vy; this.rot += 0.25 * sign(this.vx);
      if (pointInSolid(m.stage, this.x, this.y - 4)) { this.x -= this.vx; this.vx = -this.vx * 0.3; }
      const g = groundBelow(m.stage, this.x, py, Math.max(2, this.vy + 2));
      if (g && this.vy > 0 && this.y >= g.y) { this.y = g.y; this.landed = true; this.ground = g; this.rot = 0; m.sfx('tink', { vol: 0.5, rate: 0.7 }); m.fx.dust(this.x, this.y, 2); }
      if (this.y > m.stage.blast.b) { this.dead = true; return; }
    } else {
      const g = this.ground;
      if (!g.on || this.x < g.x || this.x > g.x + g.w) { this.landed = false; this.ground = null; this.vx = 0; this.vy = 0; }
      else { this.x += (g.vx || 0) + (g.conv || 0); this.y = g.y; }
    }
    if (this.t >= this.fuse) {
      this.cloud = 1;
      this.hit = { dmg: 2, ang: 75, bk: 0, kg: 0, set: 18, rehit: 24, fx: 'goo', sfx: 'spit' };
      m.sfx('spray'); m.sfx('burp', { vol: 0.5 }); m.fx.puff(this.x, this.y - 20, 8, '#b6e04a'); m.fx.word(this.x, this.y - 70, 'PEE-YEW!', { color: '#b6e04a', size: 20 });
    }
  }
  hitShapes() { return this.cloud ? [{ x: this.x, y: this.y - 30, r: 40 }] : null; }
  draw(ctx) {
    if (!this.cloud) {
      const hurry = this.t > this.fuse - 24 && this.t % 6 < 3;
      ctx.save(); ctx.translate(this.x, this.y - (this.landed ? 0 : 6)); ctx.rotate(this.rot);
      if (hurry) ctx.scale(1.15, 1.15);
      stinkArt(ctx, this.t, this.landed ? 1 : 0);
      ctx.restore();
      return;
    }
    const c = this.cloud, grow = clamp(c / 10, 0, 1), fade = clamp((this.life - c) / 30, 0, 1);
    ctx.save(); ctx.globalAlpha = 0.8 * fade;
    const at2 = (i) => { const q = PUFFS[i], w = Math.sin(c * 0.07 + i * 1.7); return [this.x + q[0] * grow + w * 3, this.y + q[1] * grow - 2 + Math.cos(c * 0.05 + i) * 2.5, q[2] * (0.5 + 0.5 * grow)]; };
    ctx.strokeStyle = '#5f8f1f'; ctx.lineWidth = 4.4;
    for (let i = 0; i < PUFFS.length; i++) { const q = at2(i); ctx.beginPath(); ctx.arc(q[0], q[1], q[2], 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#a9d93c';
    for (let i = 0; i < PUFFS.length; i++) { const q = at2(i); ctx.beginPath(); ctx.arc(q[0], q[1], q[2], 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#c6ea6a';
    for (let i = 0; i < 4; i++) { const q = at2(i); ctx.beginPath(); ctx.arc(q[0] - q[2] * 0.25, q[1] - q[2] * 0.3, q[2] * 0.45, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = fade;
    for (let i = 0; i < 3; i++) {       // a few flies doing laps
      const a = c * 0.19 + i * 2.1, fx = this.x + Math.cos(a) * (34 - i * 6), fy = this.y - 34 + Math.sin(a * 1.3) * 16;
      circle(ctx, fx, fy, 1.5, OUT, null, 0);
    }
    ctx.restore();
  }
}

// ---- the super: THE BIG ONE ------------------------------------------------
// A warning stripe along the lane first, then a rocket the height of a kid and
// the length of a canoe crosses the whole screen.
class BigOne extends Entity {
  constructor(m, f) {
    super({ owner: f, team: f.team, tag: 'ckbig' });
    this.dir = f.facing; this.y = f.y - f.h * 0.5 - 2; this.len = 290; this.hh = 35; this.sp = 18;
    this.warn = 35; this.go = false; this.vx = 0;
    this.place(m);
  }
  place(m) { const v = m.cam.view(); this.x = this.dir > 0 ? v.l - 30 : v.r + 30; }
  update(m) {
    this.t++;
    if (!this.go) {
      this.place(m);
      if (this.t % 8 === 1) m.sfx('beep', { vol: 0.7, rate: 1 + this.t / 60 });
      if (this.t >= this.warn) {
        this.go = true; this.vx = this.dir * this.sp;
        this.hit = { dmg: 22, ang: 34, bk: 50, kg: 110, unblockable: true, fx: 'fire', sfx: 'explosion', hl: 1.4 };
        m.sfx('rocket'); m.sfx('rumble', { vol: 0.6 }); m.shake(8);
      }
      return;
    }
    this.x += this.vx;
    const tail = this.x - this.dir * this.len, b = m.stage.blast;
    if (this.t % 2 === 0) { m.fx.smoke(tail - this.dir * 30, this.y + m.rng.range(-16, 16), '#e9e4da', 16); m.fx.flame(tail - this.dir * 14, this.y + m.rng.range(-10, 10), 1); }
    if (this.t % 5 === 0) m.shake(3);
    if (this.dir > 0 ? tail > b.r + 80 : tail < b.l - 80) this.dead = true;
  }
  hitShapes() {
    if (!this.go) return null;
    const x0 = this.dir > 0 ? this.x - this.len + 24 : this.x + 10;
    return [{ x: x0, y: this.y - this.hh + 3, w: this.len - 34, h: this.hh * 2 - 6 }];
  }
  draw(ctx, m) {
    const y = this.y, hh = this.hh, v = m.cam.view();
    if (!this.go || this.t < this.warn + 8) {      // the lane warning
      const on = this.t % 10 < 6;
      ctx.save();
      ctx.globalAlpha = on ? 0.5 : 0.2;
      ctx.fillStyle = '#e8402a'; ctx.fillRect(v.l - 20, y - hh, v.r - v.l + 40, hh * 2);
      ctx.globalAlpha = on ? 0.95 : 0.45;
      for (const yy of [y - hh, y + hh - 7]) {     // hazard tape top and bottom
        ctx.fillStyle = '#ffd92e'; ctx.fillRect(v.l - 20, yy, v.r - v.l + 40, 7);
        ctx.fillStyle = OUT; ctx.beginPath();
        for (let x = Math.floor(v.l / 28) * 28 - 28; x < v.r + 28; x += 28) { ctx.moveTo(x, yy + 7); ctx.lineTo(x + 7, yy); ctx.lineTo(x + 18, yy); ctx.lineTo(x + 11, yy + 7); ctx.closePath(); }
        ctx.fill();
      }
      const off = (this.t * 9) % 120;              // chevrons sliding the way it will come
      for (let x = v.l - 120 + (this.dir > 0 ? off : 120 - off); x < v.r + 60; x += 120) {
        ctx.save(); ctx.translate(x, y); ctx.scale(this.dir, 1);
        polygon(ctx, [-12, -15, 4, 0, -12, 15, -2, 15, 14, 0, -2, -15], '#ffe66b', OUT, 2);
        ctx.restore();
      }
      ctx.restore();
    }
    if (!this.go) return;
    ctx.save(); ctx.translate(this.x, y); ctx.scale(this.dir, 1);
    const L = this.len, k = this.t % 4 < 2 ? 1 : 0.8;
    limb(ctx, [-L - 150, 14, -L + 20, 14], 6, '#c9a26a', OUT, 2.4);                                     // it is still a bottle rocket: the stick
    blob(ctx, [-L + 16, -22, -L - 40 * k, -12, -L - 110 * k, 0, -L - 40 * k, 12, -L + 16, 22], '#ff8a1e', darken('#ff8a1e', 0.45), 2.4, 0.4);
    blob(ctx, [-L + 16, -12, -L - 24 * k, -5, -L - 62 * k, 0, -L - 24 * k, 6, -L + 16, 12], '#ffe45c', null, 0, 0.4);
    polygon(ctx, [-L + 60, -hh + 6, -L - 6, -hh - 24, -L + 4, -hh + 6], '#2f7fd0', OUT, 3);             // fins
    polygon(ctx, [-L + 60, hh - 6, -L - 6, hh + 24, -L + 4, hh - 6], '#2f7fd0', OUT, 3);
    rrect(ctx, -L + 4, -hh + 4, L - 64, hh * 2 - 8, 12, '#e8402a', OUT, 3.2);                            // body
    ctx.fillStyle = '#fff4dc'; ctx.fillRect(-L + 40, -hh + 5.6, 26, hh * 2 - 11.2); ctx.fillRect(-98, -hh + 5.6, 14, hh * 2 - 11.2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-L + 12, -hh + 9, L - 80, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(-L + 12, hh - 16, L - 80, 8);
    ctx.beginPath(); ctx.moveTo(-64, -hh + 2); ctx.quadraticCurveTo(-18, -hh + 4, 0, 0); ctx.quadraticCurveTo(-18, hh - 4, -64, hh - 2); ctx.closePath(); fs(ctx, '#ffd23a', OUT, 3.2);   // nose cone
    gloss(ctx, -40, -14, 14, 4, 0.4, 0.35);
    ctx.save(); ctx.translate(-L / 2 - 28, 2); ctx.scale(this.dir, 1);
    txt(ctx, 'THE BIG ONE', 0, 0, { font: 'bangers', size: 30, fill: '#fff4dc', lw: 5 });
    ctx.restore();
    ctx.restore();
  }
}

// ---- the moveset -----------------------------------------------------------
// Poses for a slingshot shot: draw the band back (anticipation), let go on
// frame F, hold the follow-through.
const shot = (F, frames, draw, loose) => K([0, {}], [Math.max(2, F - 4), Object.assign({ pull: 1 }, draw), 'out'], [F - 1, Object.assign({ pull: 1 }, draw)], [F, Object.assign({ pull: 0 }, loose || draw)], [F + 7, Object.assign({ pull: 0 }, loose || draw)], [frames, {}]);
const canShoot = (f, m) => room(f, m);

const GUM1 = { pull: 1, hR: at(16, 27), prop: 0, lean: -0.1 }, GUM0 = { pull: 0, hR: at(18, 27), prop: 0.05, lean: 0.06 };
const GUMS = [['#e8402a', 0.02], ['#ffd23a', 0.12], ['#2f7fd0', -0.07]];
function gum(f, m, i) {
  if (!room(f, m)) return;
  const [c, a] = GUMS[i];
  pebble(f, m, a, { sp: 10.8, life: 28, tag: 'ckgum', spin: 0, hit: { dmg: 3, bk: 8, kg: 22, sfx: 'pop' },
    drawFn: (ctx, p) => { streak(ctx, p, 1.6); ctx.save(); ctx.translate(p.x, p.y); gumArt(ctx, c); ctx.restore(); }, onDie: (p, m2) => { m2.fx.spark(p.x, p.y, 3, c); } });
}

const BUMP = { hR: at(-6, 24), hL: at(-14, 22), prop: -2.3 };

const moves = {
  // --- the vest bump: the only thing they do with their body ---
  jab: {
    frames: 20, sfx: { 3: 'swishS' },
    pose: K([0, {}], [2, { ox: -3, lean: 0.16, by: 2, hR: at(8, 20), hL: at(-6, 18) }],
      [4, Object.assign({ ox: 8, lean: -0.32, by: 1, fR: at(9, 0), fL: at(-12, 0), sx: 1.1 }, BUMP), 'in'],
      [9, Object.assign({ ox: 7, lean: -0.26, fR: at(9, 0), fL: at(-11, 0) }, BUMP)], [20, {}]),
    hits: [hit([4, 7], 'body', 13, 5, 28, 58, 30, { off: [7, 1], sfx: 'rubber' })],
  },
  dash: {
    frames: 38, fric: 0.3, vel: [[0, 6.6, null]], sfx: { 3: 'swishM' },
    pose: K([0, { lean: 0.3 }], [3, { lean: 0.12, by: 3 }],
      [5, Object.assign({ ox: 7, oy: -5, lean: -0.38, fR: at(5, 2), fL: at(-12, 4), sx: 1.12 }, BUMP), 'in'],
      [16, Object.assign({ ox: 6, oy: -2, lean: -0.3, fR: at(8, 0), fL: at(-11, 2) }, BUMP)], [25, { by: 4, lean: 0.1 }], [38, {}]),
    hits: [hit([5, 10], 'body', 14, 9, 38, 74, 80, { off: [8, 0], sfx: 'whop' }), hit([11, 17], 'body', 13, 6, 40, 44, 40, { off: [7, 0], sfx: 'rubber' })],
  },

  // --- tilts: slingshot pebbles at fixed angles ---
  ftilt: {
    frames: 28, can: canShoot,
    pose: shot(8, 28, { hR: at(16, 27), prop: 0, lean: -0.1, hx: -1 }, { hR: at(18, 27), prop: 0.06, lean: 0.08 }),
    events: { 8: (f, m) => pebble(f, m, 0) },
  },
  utilt: {
    frames: 28, can: canShoot,
    pose: shot(8, 28, { hR: at(15, 34), prop: -0.9, lean: -0.16, hx: -1.5 }, { hR: at(16.5, 35.5), prop: -0.9, lean: -0.06 }),
    events: { 8: (f, m) => pebble(f, m, 0.9) },
  },
  dtilt: {
    frames: 30, can: canShoot,
    pose: shot(8, 30, { by: 6, lean: 0.16, hR: at(15, 12), prop: 0.1 }, { by: 6, lean: 0.26, hR: at(17, 12), prop: 0.1 }),
    events: { 8: (f, m) => pebble(f, m, -0.14, { sp: 7.8, g: 0.3, life: 36, stage: 'bounce', bounces: 3, rest: 0.72, tag: 'ckskip',
      hit: { ang: 80, bk: 24, kg: 28 }, onBounce: (p, m2) => { m2.fx.dust(p.x, p.y, 1); m2.sfx('tink', { vol: 0.3 }); } }) },
  },

  // --- smashes: bigger things, thrown or lit by hand ---
  fsmash: {     // water balloon, lobbed overhand; bursts with a splash
    frames: 50, charge: { at: 9, max: 60 }, can: canShoot, sfx: { 14: 'swishL' },
    pose: K([0, {}], [8, { hR: at(-7, 41), prop: -1.57, lean: -0.22, by: 1, fR: at(9, 0) }], [9, { hR: at(-7, 41), prop: -1.57, lean: -0.22, by: 1, fR: at(9, 0) }],
      [16, { hR: at(17, 32), prop: -0.5, lean: 0.3, by: 3, fR: at(11, 0) }, 'in3'], [25, { hR: at(17, 17), prop: 0.6, lean: 0.32, by: 3, fR: at(11, 0) }], [50, {}]),
    events: { 16: (f, m) => {
      const [x, y] = muzzle(f, 'hR'), c = clamp(f.charge / 60, 0, 1);
      m.sfx('throw');
      shoot(f, m, { ck: true, tag: 'ckballoon', x: x + 8, y: y + 4, vx: 4 + c * 2.4, vy: -6.3, g: 0.3, r: 10, life: 140, mul: chargeMul(f), big: 1 + c * 0.25,
        hit: { dmg: 14, ang: 80, bk: 30, kg: 106, fx: 'water', sfx: 'splash' },
        drawFn: (ctx, p) => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); balloonArt(ctx, p.big, Math.sin(p.t * 0.7) * 0.08); ctx.restore(); },
        onHitFn: (p, target) => { p.direct = target; },
        onDie: (p, m2) => {       // the splash catches anyone standing next to the burst
          m2.sfx('splash'); m2.fx.drops(p.x, p.y, 12); m2.fx.ring(p.x, p.y, 34, '#bfe9ff'); m2.fx.burst(p.x, p.y, 30, '#8fd6ff');
          m2.spawn(new Projectile(m2, { owner: p.owner, x: p.x, y: p.y, vx: 0, vy: 0, r: 36, life: 5, stage: 'pass', pierce: true, reflectable: false, mul: p.mul,
            hit: { dmg: 9, ang: 62, bk: 24, kg: 74, radial: true, fx: 'water', sfx: 'splash' }, ignore: (t) => t === p.direct }));
        } });
    } },
  },
  usmash: {     // a bottle rocket out of a pop bottle, straight up
    frames: 48, charge: { at: 8, max: 60 }, can: canShoot,
    pose: K([0, {}], [7, { by: 6, hR: at(15, 15), prop: -1.57, hL: at(9, 12), lean: 0.14 }], [8, { by: 6, hR: at(15, 15), prop: -1.57, hL: at(9, 12), lean: 0.14 }],
      [14, { hR: at(15, 25), prop: -1.57, hL: at(-11, 24), lean: -0.22, hx: -2, face: 6 }, 'in'], [26, { hR: at(15, 25), prop: -1.57, hL: at(-11, 24), lean: -0.2, hx: -2, face: 6 }], [48, {}]),
    events: { 14: (f, m) => {
      const [x, y] = muzzle(f, 'hR'), c = clamp(f.charge / 60, 0, 1);
      m.sfx('rocket', { rate: 1.3 }); m.fx.puff(f.x + f.facing * x, f.y - y - 14, 4, '#e9e4da');
      shoot(f, m, { ck: true, tag: 'ckrocket', x, y: y + 26, vx: 0, vy: -5, r: 10, life: 44 + c * 12, mul: chargeMul(f),
        hit: { dmg: 14, ang: 88, bk: 34, kg: 102, fx: 'fire', sfx: 'explosion' },
        tick: (p, m2) => { p.vy = Math.max(-15, p.vy - 0.55); if (p.t % 2 === 0) m2.fx.smoke(p.x, p.y + 16, '#e9e4da', 5); },
        drawFn: (ctx, p) => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-Math.PI / 2); rocketArt(ctx, 1.25, 1, p.t); ctx.restore(); },
        onDie: (p, m2) => { m2.fx.burst(p.x, p.y, 26, '#ffd23a'); m2.fx.spark(p.x, p.y, 8, '#ffe45c'); m2.sfx('pop'); } });
    } },
  },
  dsmash: {     // a dodgeball, bowled along the floor
    frames: 50, charge: { at: 8, max: 60 }, can: canShoot, sfx: { 13: 'swishM' },
    pose: K([0, {}], [7, { by: 5, lean: 0.2, hR: at(-12, 17), prop: 3.4, fR: at(10, 0), fL: at(-9, 0) }], [8, { by: 5, lean: 0.2, hR: at(-12, 17), prop: 3.4, fR: at(10, 0), fL: at(-9, 0) }],
      [15, { by: 9, lean: 0.44, hR: at(18, 9), prop: 0.2, fR: at(13, 0), fL: at(-12, 0) }, 'in3'], [25, { by: 8, lean: 0.4, hR: at(19, 17), prop: -0.4, fR: at(13, 0), fL: at(-12, 0) }], [50, {}]),
    events: { 15: (f, m) => {
      const c = clamp(f.charge / 60, 0, 1);
      m.sfx('throw', { rate: 0.8 });
      shoot(f, m, { ck: true, tag: 'ckdodge', x: 27, y: 10, vx: 5.8 + c * 2.4, vy: 0, g: 0.5, r: 11, life: 80, stage: 'bounce', bounces: 999, rest: 0, mul: chargeMul(f),
        hit: { dmg: 12, ang: 32, bk: 32, kg: 88, sfx: 'rubber' },
        hitShapes() { return [{ x: this.x, y: this.y - 11, r: this.r }]; },       // (x, y) is where it touches the floor
        tick: (p, m2) => { p.rot += p.vx / 11; if (Math.abs(p.vx) < 0.5) p.die(m2); },
        drawFn: (ctx, p) => { ctx.save(); ctx.translate(p.x, p.y - 11); ctx.rotate(p.rot); dodgeArt(ctx); ctx.restore(); },
        onDie: (p, m2) => { m2.fx.puff(p.x, p.y - 10, 4); m2.sfx('rubber', { vol: 0.4 }); } });
    } },
  },

  // --- aerials: a pebble in whichever direction the stick says ---
  nair: air({
    frames: 32, can: canShoot,
    pose: shot(7, 32, { hR: at(15, 20), prop: 0.78, lean: 0.12 }, { hR: at(16, 19), prop: 0.78, lean: 0.2 }),
    events: { 7: (f, m) => pebble(f, m, -0.78) },
  }, 8, [3, 24]),
  fair: air({
    frames: 32, can: canShoot,
    pose: shot(8, 32, { hR: at(16, 28), prop: 0, lean: -0.1 }, { hR: at(18, 28), prop: 0.06, lean: 0.06 }),
    events: { 8: (f, m) => pebble(f, m, 0) },
  }, 8, [3, 24]),
  bair: air({
    frames: 34, can: canShoot,
    pose: shot(9, 34, { hR: at(-13, 29), prop: 3.14, lean: -0.2, hx: -2, ht: -0.2 }, { hR: at(-14.5, 29), prop: 3.1, lean: -0.26, hx: -2, ht: -0.2 }),
    events: { 9: (f, m) => pebble(f, m, Math.PI) },
  }, 9, [4, 26]),
  uair: air({
    frames: 30, can: canShoot,
    pose: shot(7, 30, { hR: at(15, 38), prop: -1.57, lean: -0.1 }, { hR: at(15, 40), prop: -1.57, lean: -0.1 }),
    events: { 7: (f, m) => pebble(f, m, Math.PI / 2) },
  }, 8, [3, 22]),
  dair: air({   // straight down; the recoil is a small extra hop, once per airtime
    frames: 38, can: canShoot,
    pose: shot(10, 38, { hR: at(9, 14), prop: 1.57, lean: 0.22, fR: at(10, 9), fL: at(-10, 8) }, { hR: at(9, 12), prop: 1.57, lean: 0.1, fR: at(11, 4), fL: at(-11, 3), sy: 1.06 }),
    events: { 10: (f, m) => {
      pebble(f, m, -Math.PI / 2, { sp: 10.5, hit: { dmg: 6, ang: 285, bk: 12, kg: 48 } });
      if (!f.v.popped) { f.v.popped = true; f.vy = -6.4; f.fastFalling = false; m.fx.ring(f.x, f.y, 12, '#ffffff'); }
    } },
  }, 14, [4, 30]),

  // --- specials ---
  nspecial: {   // aimed lob: hold to aim (stick up/down tilts the arc), let go to fire a tennis ball
    kind: 'special', frames: 34, can: canShoot, drift: 0.5,
    start: (f, m) => { f.v.aim = 0.55; f.v.aimT = 0; f.v.aiming = true; f.v.aiErr = f.isCPU ? (m.rng.next() - 0.5) * (10 - f.cpuLevel) * 0.03 : 0; },
    exit: (f) => { f.v.aiming = false; },
    tick: (f, m, fr) => {
      if (!f.v.aiming || fr < 8) return;
      if (f.inp.h.special && f.v.aimT < 90) {
        f.v.aimT++; f.mf = 7;                          // the engine adds one: stay on frame 8 while aiming
        f.v.aim = clamp(f.v.aim - f.inp.y * 0.04, AIM_LO, AIM_HI);
        if (f.v.aimT % 14 === 1) m.sfx('click', { vol: 0.3, rate: 1.4 });
        return;
      }
      f.v.aiming = false;
      const [x, y] = muzzle(f), a = f.v.aim;
      m.sfx('swishM', { rate: 1.3 }); m.sfx('pop', { vol: 0.4, rate: 1.3 });
      shoot(f, m, { ck: true, tag: 'cktennis', x, y, vx: Math.cos(a) * LOB, vy: -Math.sin(a) * LOB, g: LOB_G, r: 8, life: 120, spin: 0.3, stage: 'bounce', bounces: 1, rest: 0.6,
        hit: { dmg: 8, ang: 60, bk: 26, kg: 46, sfx: 'rubber' }, drawFn: spun(tennisArt),
        onBounce: (p, m2) => { m2.sfx('rubber', { vol: 0.35 }); }, onDie: (p, m2) => { m2.fx.puff(p.x, p.y, 3, '#e6f58a'); } });
    },
    pose: (f) => {
      const a = f.v.aim === undefined ? 0.55 : f.v.aim;
      const A = { hR: at(15 + Math.cos(a) * 2.5, 26.5 + Math.sin(a) * 11), prop: -a, lean: -0.06 - a * 0.1, hx: -1 - a };
      return K([0, {}], [7, Object.assign({ pull: 1 }, A), 'out'], [8, Object.assign({ pull: 1 }, A)], [9, Object.assign({ pull: 0 }, A)], [17, Object.assign({ pull: 0 }, A)], [34, {}]);
    },
  },
  sspecial: {   // three gumballs, one after another
    kind: 'special', frames: 44, can: canShoot, drift: 0.5,
    pose: K([0, {}], [7, GUM1, 'out'], [10, GUM1], [11, GUM0], [15, GUM1], [17, GUM0], [21, GUM1], [23, GUM0], [31, GUM0], [44, {}]),
    events: { 11: (f, m) => gum(f, m, 0), 17: (f, m) => gum(f, m, 1), 23: (f, m) => gum(f, m, 2) },
  },
  uspecial: {   // hugs a bottle rocket and holds on
    kind: 'special', frames: 58, helpless: true, drift: 0.8, ledgeOK: 22, airOK: true, slideOff: true,
    vel: [[9, null, -7.4]], sfx: { 8: 'rocket' },
    tick: (f, m, fr) => {
      if (fr > 9 && fr < 32) { f.vy = -7.4; if (fr % 2 === 0) { m.fx.flame(f.x - f.facing * 13, f.y + 10, 1); m.fx.smoke(f.x - f.facing * 13, f.y + 18, '#e9e4da', 6); } }
      if (fr === 34) { m.fx.puff(f.x - f.facing * 13, f.y - 30, 5, '#e9e4da'); m.sfx('pop', { vol: 0.5 }); }
    },
    pose: K([0, {}], [6, { by: 6, hR: at(-3, 24), hL: at(-13, 26), lean: 0.1 }],
      [9, { hR: at(-3, 25), hL: at(-14, 30), fR: at(-3, 4), fL: at(-12, 6), lean: -0.08, sy: 1.08, face: 6 }, 'out'],
      [34, { hR: at(-3, 25), hL: at(-14, 30), fR: at(-2, 5), fL: at(-12, 7), lean: -0.08, face: 6 }], [58, { hR: at(13, 40), hL: at(-13, 40), face: 2 }]),
    hits: [hit([10, 33], [-13, 60], 11, 5, 84, 40, 46, { fx: 'fire', sfx: 'hitM' })],
  },
  dspecial: {   // stink bomb: lobbed, sits, then goes off
    kind: 'special', frames: 40, drift: 0.6, can: (f, m) => room(f, m) && countMine(f, m, 'ckstink') < 1,
    pose: K([0, {}], [8, { hR: at(-6, 36), prop: -1.57, lean: -0.14 }], [13, { hR: at(18, 31), prop: -0.4, lean: 0.22 }, 'in'], [21, { hR: at(17, 19), prop: 0.5, lean: 0.18 }], [40, {}]),
    events: { 13: (f, m) => { const [x, y] = muzzle(f, 'hR'); m.spawn(new StinkBomb(m, f, f.x + f.facing * (x + 6), f.y - y)); m.sfx('throw', { rate: 0.9 }); } },
  },
  dryfire: {    // nothing left to shoot: every shot move turns into this while the cap is reached
    frames: 18, iasa: 14, sfx: { 3: 'click' },
    pose: K([0, {}], [3, { hR: at(15, 31), prop: -0.6, face: 6, ht: 0.1 }], [12, { hR: at(15, 31), prop: -0.5, face: 6, ht: 0.1 }], [18, {}]),
  },

  // --- grab + throws ---
  grab: stdGrab(K([0, {}], [6, { hL: at(20, 25), hR: at(19, 27), lean: 0.3 }, 'out'], [12, { hL: at(19, 24), hR: at(18, 26), lean: 0.26 }], [30, {}]), 25, { h: 26, r: 12 }),
  ...stdThrows({
    f: { dmg: 7, bk: 64, kg: 58, f: 12, frames: 30, sfx: 'rubber', pose: K([0, { hL: at(20, 25), hR: at(19, 27) }], [8, { ox: -4, lean: 0.2, hL: at(16, 24), hR: at(15, 26) }], [12, Object.assign({ ox: 8, lean: -0.34, sx: 1.1 }, BUMP), 'in'], [18, Object.assign({ ox: 6, lean: -0.26 }, BUMP)], [30, {}]) },
    b: { dmg: 8, bk: 60, kg: 70, f: 15, frames: 36, pose: K([0, { hL: at(20, 25), hR: at(19, 27) }], [8, { hL: at(8, 40), hR: at(6, 42), lean: -0.1 }], [15, { hL: at(-16, 30), hR: at(-14, 33), lean: -0.36 }, 'in'], [36, {}]) },
    u: { dmg: 7, bk: 64, kg: 66, f: 12, frames: 32, pose: K([0, { hL: at(20, 25), hR: at(19, 27) }], [7, { by: 7, hR: at(17, 13), hL: at(17, 15) }], [12, { hR: at(10, 43), hL: at(4, 42), sy: 1.06 }, 'in'], [32, {}]) },
    d: { dmg: 6, bk: 50, kg: 44, f: 15, frames: 34, sfx: 'rubber', pose: K([0, { hL: at(20, 25), hR: at(19, 27) }], [8, { hL: at(17, 12), hR: at(15, 14), by: 4, oy: -8 }], [15, { hL: at(17, 8), hR: at(16, 9), by: 9, lean: 0.34, sx: 1.1, sy: 0.92 }, 'in'], [34, {}]) },
  }),
  getup: {      // a bump to the front, then one with the backside
    frames: 34, invuln: [[0, 12]], sfx: { 8: 'swishM', 15: 'swishM' },
    pose: K([0, { by: 10, lean: 0.2 }], [7, { by: 4, ox: -2 }], [9, Object.assign({ ox: 8, lean: -0.32, sx: 1.1 }, BUMP), 'in'], [13, Object.assign({ ox: 6, lean: -0.24 }, BUMP)],
      [17, { ox: -8, lean: 0.36, hR: at(16, 22), hL: at(8, 20), sx: 1.1 }, 'in'], [22, { ox: -6, lean: 0.3, hR: at(16, 22), hL: at(8, 20) }], [34, {}]),
    hits: [hit([9, 12], 'body', 13, 6, 45, 44, 44, { off: [7, 0], sfx: 'rubber' }), hit([17, 20], 'body', 13, 6, 45, 44, 44, { off: [-7, 0], rev: true, group: 1, sfx: 'rubber' })],
  },
  taunt: {
    kind: 'taunt', frames: 64, iasa: 56, sfx: { 10: 'cute' },
    pose: K([0, {}], [10, { hR: at(11, 42), prop: -1.5, hL: at(-12, 26), lean: -0.06, face: 3 }, 'back'], [50, { hR: at(11, 42), prop: -1.5, hL: at(-12, 26), lean: -0.06, face: 3 }], [64, {}]),
  },

  // --- the super: THE BIG ONE ---
  super: {      // blows the whistle, points, then covers his ears; the rocket does the rest
    kind: 'super', frames: 84, airOK: true,
    pose: K([0, {}], [7, { hR: at(-4, 43), hL: at(-12, 24), lean: -0.16, face: 3 }], [13, { hR: at(19, 31), hL: at(-12, 22), lean: 0.24 }, 'in'], [22, { hR: at(19, 31), hL: at(-12, 22), lean: 0.22 }],
      [30, { by: 9, lean: 0.24, hR: at(-1, 30), hL: at(12, 31), hy: 3, face: 5 }], [72, { by: 9, lean: 0.24, hR: at(-1, 30), hL: at(12, 31), hy: 3, face: 5 }], [84, {}]),
    events: { 13: (f, m) => { m.spawn(new BigOne(m, f)); m.sfx('whistle'); m.fx.word(f.x, f.y - 84, 'INCOMING!', { color: '#ffe23a', size: 24, life: 50 }); } },
    exit: (f) => { f.superActive = false; },
  },
};

// every move that puts something in the air; they all turn into `dryfire` at the cap
const SHOTS = { ftilt: 1, utilt: 1, dtilt: 1, fsmash: 1, usmash: 1, dsmash: 1, nair: 1, fair: 1, bair: 1, uair: 1, dair: 1, nspecial: 1, sspecial: 1, dspecial: 1 };

export default {
  id: 'campkids', name: 'CAMP KIDS', from: 'Canoe Wars', superName: 'The Big One',
  blurb: 'Banned from the archery range, so they brought their own. One shove, and then a great many things thrown from a safe distance.',
  stats: { weight: 93, walk: 2.2, dash: 5.2, run: 4.6, jump: 11, hop: 6.8, djump: 10, gravity: 0.34, fall: 6.9, airSpeed: 3.4, w: 28, h: 56 },
  portrait: { x: 2, y: -41, s: 1.16 },
  costumes: costumes(BASE, [
    ['Benny', {}],
    ['Jo', { kid: 1, main: '#4fb84a', vest: '#4fb84a', hair: '#e2622b', skin: '#f9d6ba', shorts: '#8a4fd0', floatie: '#ff8ac0', shoe: '#2f7fd0', tie: '#ffe23a' }],
    ['Mikey', { kid: 2, main: '#3d8fe0', vest: '#3d8fe0', hair: '#2b2018', skin: '#a8683f', shorts: '#e8402a', floatie: '#9be04a', shoe: '#f2b81c', strap: '#fff4dc' }],
    ['Counselor', { kid: 3, main: '#ffd21f', vest: '#ffd21f', hair: '#c98a3a', skin: '#e9b48c', shorts: '#3f7a4a', floatie: '#ff8a3a', shoe: '#3a3f55', cap: '#e8402a', buckle: '#e8402a' }],
  ]),
  pose: rig.pose, points: rig.points, draw: rig.draw,
  moves,
  remap(f, id) {
    if (!SHOTS[id] || !f.m || f.isDummy) return id;
    if (!room(f, f.m) || (id === 'dspecial' && countMine(f, f.m, 'ckstink') > 0)) return 'dryfire';
    return id;
  },
  hooks: {
    init(f) { f.v.aim = 0.55; f.v.aimT = 0; f.v.aiming = false; f.v.popped = false; },
    postUpdate(f) { if (f.grounded || f.state === 'ledge') f.v.popped = false; },
    onHit(f, m) { if (f.isCPU && (f.moveId === 'jab' || f.moveId === 'dash')) f.v.aiBump = m.frame; },
    // the dotted arc while the lob is being aimed
    drawFront(ctx, f, m) {
      if (f.state !== 'move' || f.moveId !== 'nspecial' || !f.v.aiming || f.mf < 7) return;
      const [mx, my] = muzzle(f), a = f.v.aim;
      let x = f.x + f.facing * mx, y = f.y - my, vy = -Math.sin(a) * LOB;
      const vx = f.facing * Math.cos(a) * LOB;
      for (let i = 1; i <= 110; i++) {
        vy += LOB_G; x += vx; y += vy;
        if (pointInSolid(m.stage, x, y)) { line(ctx, x - 5, y - 5, x + 5, y + 5, OUT, 4.4); line(ctx, x - 5, y + 5, x + 5, y - 5, OUT, 4.4); line(ctx, x - 5, y - 5, x + 5, y + 5, f.color, 2); line(ctx, x - 5, y + 5, x + 5, y - 5, f.color, 2); break; }
        if ((i + (f.t >> 1)) % 2 === 0) circle(ctx, x, y, 2.5, f.color || '#ffffff', OUT, 1.3);
      }
    },
    ai(f, m, cpu) {
      const L = cpu.level, r = cpu.rng, t = cpu.target;
      if (f.state === 'move' && f.moveId === 'nspecial' && f.v.aiming) {     // tilt the lob onto the target, then let go
        let want = 0.55;
        if (t) {
          const [mx, my] = muzzle(f), dx = Math.abs(t.x - f.x) - mx, up = (f.y - my) - (t.y - t.h * 0.5);
          const v2 = LOB * LOB, disc = v2 * v2 - LOB_G * (LOB_G * dx * dx + 2 * up * v2);
          want = disc > 0 && dx > 1 ? Math.atan((v2 - Math.sqrt(disc)) / (LOB_G * dx)) : 0.78;      // the low arc, or 45 degrees if out of reach
        }
        const d = clamp(want + (f.v.aiErr || 0), AIM_LO, AIM_HI) - f.v.aim;
        if (Math.abs(d) > 0.05 && f.v.aimT < 44) { cpu.stick(0, d > 0 ? -1 : 1); cpu.press('special', 2); }
        return true;
      }
      // The stock brain only compares |dy|, so the shots that care whether the target is above or below
      // (up tilt, up smash and every aerial) are chosen here and queued like any other input.
      const s = f.state;
      if (cpu.q.length || cpu.cool > 0 || cpu.wait > 0 || m.state !== 'fight') return;
      if (!(s === 'idle' || s === 'walk' || s === 'run' || s === 'dash' || s === 'air')) return;
      if (!t || t.out || t.state === 'dead' || t.state === 'respawn' || t.invuln > 12) return;
      const combo = m.frame - (f.v.aiBump || -99) < 30, kill = t.pct > 85 + (t.st.weight - 100) * 0.5;      // combo: a bump just landed
      if (!room(f, m) || !(combo && kill || r.chance(0.06 + L * 0.02))) return;
      if (!f.grounded && cpu.needsRecovery(f, m)) return;
      const dxw = t.x - f.x, adx = Math.abs(dxw), side = sign(dxw) || f.facing, fwd = dxw * f.facing, up = (f.y - f.h * 0.5) - (t.y - t.h * 0.5);
      let step = null;
      if (f.grounded && adx < 80 && Math.abs(up) < 40 && L >= 4 && r.chance(0.3)) {         // back to the ledge with them in my face: roll out through them
        const g = f.ground, room2 = side > 0 ? f.x - g.x : g.x + g.w - f.x;
        if (g && room2 < 70) { cpu.queue({ press: ['shield'], hold: 3 }, { x: side, press: ['shield'], hold: 2 }); cpu.cool = 30; return; }
      }
      if (f.grounded) {
        const flat = Math.abs(up) < 34 && t.grounded;
        const lead = 14 + up / 11, px = (dxw + (t.vx + t.kx) * lead) * side;        // where they will be when a rocket gets up there
        if (up > 55 && (adx < 30 || px > -14 && px < 44 && adx < 110)) step = [{ y: -1, press: ['strong'] }];
        else if (up > 40 && up < 230 && Math.abs(adx - up * 0.8) < 34) step = [{ y: -1, press: ['attack'] }];
        else if (flat && adx > 40 && adx < 120 && t.state === 'move' && t.move && t.move.hits && t.move.frames - t.mf > 16 && t.mf > t.move.hits[t.move.hits.length - 1].f[1]) {
          step = [{ x: side, n: adx > 80 ? 5 : 2 }, { x: side, press: ['attack'] }];                                       // they whiffed something big: run in and shove
        } else if (kill && (combo || r.chance(0.7))) {      // they are ready to go: reach for the things that launch
          if (flat && adx > 46 && adx < 115 && !combo) step = [{ x: side, n: 5 }, { x: side, press: ['attack'] }];        // run in for the shove
          else if (Math.abs(up) < 44 && adx > 150 && adx < 250) step = [{ x: side, press: ['strong'], charge: r.int(0, 18) }];
          else if (Math.abs(up) < 34 && adx >= 60 && adx < 340) step = [{ y: 1, press: ['strong'] }];
          f.v.aiBump = -99;
        }
        if (step && side !== f.facing) step.unshift({ x: side, n: 2 });
      } else if (Math.abs(up) < 26 && adx > 50 && adx < 300) step = [{ x: side, press: ['attack'] }];
      else if (up < -40 && up > -260 && fwd > 0 && Math.abs(fwd + up) < 34) step = [{ press: ['attack'] }];
      else if (up > 50 && adx < 26) step = [{ y: -1, press: ['attack'] }];
      else if (up < -50 && adx < 24 && !f.v.popped) step = [{ y: 0.7, press: ['attack'] }];
      if (!step) return;
      cpu.queue(...step); cpu.cool = 26 - L + r.int(0, 10);
    },
  },
  // Ranges for the stock CPU brain. (utilt, usmash and the aerials are picked in hooks.ai above.)
  ai: {
    keep: 170, noJumpIn: true,
    ftilt: { range: [70, 310], dy: 26 },
    dtilt: { range: [60, 250], dy: 26, w: 0.8 },
    fsmash: { range: [150, 260], dy: 40, w: 0.7 },
    dsmash: { range: [90, 380], dy: 24, w: 0.6 },
    nspecial: { range: [150, 380], dy: 170, w: 1.2, hold: 4 },
    sspecial: { range: [90, 280], dy: 28, w: 1.1 },
    dspecial: { range: [100, 180], dy: 40, w: 0.8 },
    super: { range: 560, dy: 40 },
    recovery: { up: 220 },
  },
};
