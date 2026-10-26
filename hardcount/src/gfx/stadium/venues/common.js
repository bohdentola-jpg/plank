// Shared pieces for the bowl venues: tier specs → seats, light banks on the
// rim (on masts or the roof edge), video boards, LED ribbons, padded ad
// walls, and city / campus blocks with lit windows.
import * as THREE from 'three';
import { buildTier, ringWall } from '../bowl.js';
import { V3, beam, pole, box, building, spill } from '../kit.js';
import { adStripTex, BRANDS, tex, cv } from '../tex.js';
import { makeRng } from '../../../core/util.js';
import { ribbonTexture } from '../scoreboard.js';

/** Fill priority: lower rows and seats near midfield fill first. */
export function wantFn(path, field, rows) {
  return (s, r) => {
    const p = path.at(s, 0);
    return Math.max(0, 1 - Math.abs(p.z) / (field.end + 25) * 0.55 - (r / rows) * 0.35);
  };
}

/** Which section a seat is in by its angle around the bowl (deg, 0 = +x side, 90 = +z end). */
export function angleAt(path, s) {
  const p = path.at(s, 0);
  return ((Math.atan2(p.z, p.x) * 180) / Math.PI + 360) % 360;
}

/** Suite-level glass: lit boxes with people in them (emissive at night). */
export function suiteMat(ctx, seed = 'suites', warm = true) {
  const [c, x] = cv(512, 128);
  x.fillStyle = '#1c2026';
  x.fillRect(0, 0, 512, 128);
  const rng = makeRng(seed);
  for (let k = 0; k < 8; k++) {
    const lit = rng() < 0.82;
    const g = x.createLinearGradient(0, 20, 0, 108);
    g.addColorStop(0, lit ? (warm ? '#f4d8a0' : '#d8e4f4') : '#2a3038');
    g.addColorStop(1, lit ? (warm ? '#b08050' : '#7890b0') : '#1a1e24');
    x.fillStyle = g;
    x.fillRect(k * 64 + 4, 22, 56, 84);
    if (lit) {
      x.fillStyle = 'rgba(30,20,10,0.7)';
      for (let p = 0; p < 3; p++) x.fillRect(k * 64 + 8 + rng() * 40, 66 + rng() * 14, 8, 26);
    }
  }
  x.fillStyle = '#3a3e46';
  x.fillRect(0, 0, 512, 14);
  x.fillRect(0, 112, 512, 16);
  const t = tex(c, { aniso: 8 });
  return spill(new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: ctx.day && !ctx.atmos.dome ? 0.15 : 0.75, roughness: 0.3, metalness: 0.3 }), ctx, 0.3);
}

/** An ad-panel material for the field wall (a strip of brands). */
export function adWallMat(ctx, key = 'adwall', list = BRANDS, aw = 512, ah = 96) {
  const t = adStripTex(key, list, aw, ah);
  return spill(new THREE.MeshStandardMaterial({
    map: t, roughness: 0.6, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: ctx.night ? 0.32 : ctx.dusk ? 0.15 : 0.0,
  }), ctx, 0.6);
}

/** LED ribbon material (MeshBasic, HDR) with its texture, animated by `scroll(t)`. */
export function ribbonMat(ctx, lines) {
  const t = ribbonTexture(ctx.home, lines);
  const k = ctx.day ? 1.3 : 1.8;
  const m = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(k, k, k) });
  return { mat: m, tex: t, scroll: (time) => { t.offset.x = (time * 0.012) % 1; } };
}

/**
 * Light banks along a stand's rim on masts. at: list of s values. d: offset of
 * the mast base, y: its base height, h: mast height.
 */
export function rimBanks(ctx, path, at, d, y, h, opts = {}) {
  const { B, rig } = ctx;
  const m = B.get('metal');
  const cols = opts.cols || 7, rows = opts.rows || 4, lamp = opts.lamp || 0.85;
  for (const s of at) {
    const p = path.at(s, d);
    const yaw = Math.atan2(-p.nx, -p.nz);
    m.setColor(...(opts.color || [0.6, 0.62, 0.65]));
    const top = y + h;
    if (h > 0.5) {
      pole(m, V3(p.x, y, p.z), V3(p.x, top, p.z), opts.mastR || 0.35, 8);
      beam(m, V3(p.x + p.nx * 3, y, p.z + p.nz * 3), V3(p.x, top * 0.6 + y * 0.4, p.z), 0.18);
    }
    const W = cols * lamp, H = rows * lamp;
    const cx = p.x - p.nx * 0.6, cz = p.z - p.nz * 0.6, cy = top + H / 2;
    m.setColor(0.28, 0.29, 0.31);
    box(m, cx + p.nx * 0.25, cy - H / 2 - 0.2, cz + p.nz * 0.25, W + 0.5, H + 0.4, 0.3, yaw, { top: true });
    const aim = opts.aim ? opts.aim(p) : V3(p.x * 0.15, 0, p.z * 0.4);
    rig.bank({ center: V3(cx, cy, cz), yaw, tilt: opts.tilt ?? 0.55, cols, rows, lamp, w: W, h: H, aim, warm: !!opts.warm, glare: opts.glare ?? 1 });
  }
}

/** Light banks hung under / on a roof edge (no masts). */
export function edgeBanks(ctx, path, at, d, y, opts = {}) {
  rimBanks(ctx, path, at, d, y, 0, opts);
}

/** Video board: a framed face showing `board` on a structure. Faces `ry` (0 = +z). */
export function videoBoard(ctx, x, y, z, w, h, ry, board, opts = {}) {
  const { B, root } = ctx;
  const frame = B.get('paint');
  frame.setColor(...(opts.frame || [0.12, 0.13, 0.15]));
  const fx = Math.sin(ry), fz = Math.cos(ry);
  box(frame, x - fx * 0.4, y - 0.6, z - fz * 0.4, w + 1.4, h + 1.2, 0.8, ry, {});
  if (opts.legs !== false) {
    const m = B.get('metal');
    m.setColor(0.4, 0.42, 0.45);
    const rx = Math.cos(ry), rz = -Math.sin(ry);
    for (const u of [-w * 0.3, w * 0.3]) beam(m, V3(x + rx * u - fx * 1.2, 0, z + rz * u - fz * 1.2), V3(x + rx * u - fx * 1.2, y + h * 0.4, z + rz * u - fz * 1.2), 0.9);
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), board.material);
  face.position.set(x + fx * 0.02, y + h / 2, z + fz * 0.02);
  face.rotation.y = ry;
  face.name = 'videoboard';
  root.add(face);
  if (opts.title) {
    // a lit header sign on top
    const hdr = B.get('glow');
    hdr.setColor(...(opts.titleColor || [1.6, 1.6, 1.6]));
  }
  return face;
}

/** A block of city buildings (facade textures), returns nothing; batched by style. */
export function cityBlock(ctx, rng, list) {
  for (const b of list) {
    building(ctx.B, ctx, b.x, b.z, b.w, b.d, b.h, b.ry || 0, b.style, b.seed || 'a', { tint: b.tint, uw: b.uw, uh: b.uh, glow: b.glow, y0: b.y0 });
    const top = (b.y0 || 0) + b.h;
    if (b.antenna && (ctx.night || ctx.dusk)) ctx.lightsList.push({ pos: V3(b.x, top + 4, b.z), color: [1, 0.15, 0.08], size: 2.2, k: 1.4, blink: 1 });
    if (b.crown) {
      // a lit crown band round the top floors
      const g = ctx.B.get('glow');
      g.setColor(...(ctx.day ? [0.55, 0.6, 0.65] : b.crown));
      const hw = b.w / 2 + 0.15, hd = b.d / 2 + 0.15, y0 = top - 4, y1 = top - 1.5;
      const P = (x, y, z) => V3(b.x + x, y, b.z + z);
      g.quad(P(-hw, y0, hd), P(hw, y0, hd), P(hw, y1, hd), P(-hw, y1, hd));
      g.quad(P(hw, y0, -hd), P(-hw, y0, -hd), P(-hw, y1, -hd), P(hw, y1, -hd));
      g.quad(P(hw, y0, hd), P(hw, y0, -hd), P(hw, y1, -hd), P(hw, y1, hd));
      g.quad(P(-hw, y0, -hd), P(-hw, y0, hd), P(-hw, y1, hd), P(-hw, y1, -hd));
    }
  }
}

/** Build a tier and return its seats with group / want / light applied. */
export function tier(ctx, path, spec) {
  const t = buildTier(ctx.B, path, spec);
  return t;
}

export { ringWall, tex };
