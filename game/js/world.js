// world.js — entities, models, physics, map format.
//
// World space: x grows right, y grows DOWN (canvas-style). Ground top sits at
// map.groundY. Entity (x, y) is the CENTER of its AABB.
// boxscript user space is y-UP; the bindings in game.js convert.

import { uid, clamp, COLORS } from './util.js';

export const GRAV = 900;          // world px / s^2
export const PLAYER_W = 9;
export const PLAYER_H = 24;
export const PLAYER_SPEED = 110;
export const PLAYER_JUMP = 340;
export const BOLT_SPEED = 420;
export const BOLT_LIFE = 1.4;
export const THROW_SPEED = 300;
export const BONK_SPEED = 260;    // a box moving faster than this pops you

export const PALETTE_KEYS = Object.keys(COLORS); // index ↔ char '0'-'e'

// ---------------------------------------------------------------- models
// Built-in models. w/h in world px at scale 100.
export const BUILTIN_MODELS = {
  box:          { w: 14, h: 14, solid: true,  physical: true,  label: 'box' },
  bigbox:       { w: 20, h: 20, solid: true,  physical: true,  label: 'big box' },
  platform:     { w: 48, h: 10, solid: true,  physical: false, label: 'platform' },
  block:        { w: 16, h: 16, solid: true,  physical: false, label: 'block' },
  wall:         { w: 12, h: 64, solid: true,  physical: false, label: 'wall' },
  blasterstand: { w: 14, h: 18, solid: false, physical: false, label: 'blaster stand' },
  pongtable:    { w: 88, h: 26, solid: true,  physical: false, label: 'ping pong table' },
  sign:         { w: 18, h: 20, solid: false, physical: false, label: 'sign' },
};

export function modelInfo(map, name) {
  if (BUILTIN_MODELS[name]) return BUILTIN_MODELS[name];
  const m = map && map.models && map.models[name];
  if (m) return { w: m.w, h: m.h, solid: m.solid !== false, physical: !!m.physical, custom: m, label: name };
  return { w: 14, h: 14, solid: false, physical: false, missing: true, label: name };
}

// ---------------------------------------------------------------- entities
export function createEntity(map, spec) {
  const info = modelInfo(map, spec.model);
  const scale = spec.scale || 100;
  return {
    id: spec.id || uid(),
    model: spec.model,
    x: spec.x || 0,
    y: spec.y || 0,
    vx: 0, vy: 0,
    scale,
    solid: spec.solid != null ? !!spec.solid : info.solid,
    physical: spec.physical != null ? !!spec.physical : info.physical,
    color: spec.color || null,           // tint name from COLORS, null = model default
    script: spec.script || null,          // source text
    visible: true,
    heldBy: null,                         // player id while carried
    onGround: false,
    say: null,                            // {text, until}
    scriptInst: null,
    synced: false,                        // host-authoritative over network
    spawned: !!spec.spawned,              // created by a script at runtime
  };
}

export function entW(map, ent) { return modelInfo(map, ent.model).w * ent.scale / 100; }
export function entH(map, ent) { return modelInfo(map, ent.model).h * ent.scale / 100; }

export function entBox(map, ent) {
  const w = entW(map, ent), h = entH(map, ent);
  return { x0: ent.x - w / 2, y0: ent.y - h / 2, x1: ent.x + w / 2, y1: ent.y + h / 2 };
}

export function boxesOverlap(a, b, pad = 0) {
  return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad;
}

export function pointInBox(px, py, b, pad = 0) {
  return px >= b.x0 - pad && px <= b.x1 + pad && py >= b.y0 - pad && py <= b.y1 + pad;
}

// ---------------------------------------------------------------- physics
// Resolve a moving AABB (cx, cy, w, h, vx, vy) against solids. Returns updated
// state. `solids` = array of boxes; `groundY` = infinite floor top or null.
export function stepBody(body, dt, solids, groundY, opts = {}) {
  const bounce = opts.bounce || 0;
  const fricGround = opts.friction != null ? opts.friction : 8;
  body.vy += (opts.gravity != null ? opts.gravity : GRAV) * dt;
  body.vy = clamp(body.vy, -2000, 2000);
  body.vx = clamp(body.vx, -2000, 2000);
  body.onGround = false;

  // x axis
  body.x += body.vx * dt;
  let bb = bodyBox(body);
  for (const s of solids) {
    if (!boxesOverlap(bb, s)) continue;
    if (body.vx > 0 && bb.x1 > s.x0 && bb.x0 < s.x0) {
      body.x = s.x0 - body.w / 2;
      body.vx = -body.vx * bounce;
    } else if (body.vx < 0 && bb.x0 < s.x1 && bb.x1 > s.x1) {
      body.x = s.x1 + body.w / 2;
      body.vx = -body.vx * bounce;
    }
    bb = bodyBox(body);
  }

  // y axis
  body.y += body.vy * dt;
  bb = bodyBox(body);
  for (const s of solids) {
    if (!boxesOverlap(bb, s)) continue;
    if (body.vy > 0 && bb.y1 > s.y0 && bb.y0 < s.y0) {
      body.y = s.y0 - body.h / 2;
      body.vy = -body.vy * bounce;
      if (Math.abs(body.vy) < 40) body.vy = 0;
      body.onGround = true;
    } else if (body.vy < 0 && bb.y0 < s.y1 && bb.y1 > s.y1) {
      body.y = s.y1 + body.h / 2;
      body.vy = Math.abs(body.vy) * bounce;
    }
    bb = bodyBox(body);
  }
  if (groundY != null && body.y + body.h / 2 > groundY) {
    body.y = groundY - body.h / 2;
    if (body.vy > 0) body.vy = -body.vy * bounce;
    if (Math.abs(body.vy) < 40) body.vy = 0;
    body.onGround = true;
  }
  if (body.onGround) {
    const f = Math.max(0, 1 - fricGround * dt);
    body.vx *= f;
    if (Math.abs(body.vx) < 2) body.vx = 0;
  }
  return body;
}

export function bodyBox(b) {
  return { x0: b.x - b.w / 2, y0: b.y - b.h / 2, x1: b.x + b.w / 2, y1: b.y + b.h / 2 };
}

// collect solid AABBs near a body (all solid, visible, not-held entities except `skip`)
export function collectSolids(map, ents, skip) {
  const out = [];
  for (const e of ents) {
    if (e === skip || !e.solid || !e.visible || e.heldBy) continue;
    out.push(entBox(map, e));
  }
  return out;
}

// ---------------------------------------------------------------- map format
export const MAP_VERSION = 1;

export function emptyMap(name = 'untitled') {
  return {
    v: MAP_VERSION,
    name,
    bg: '#ffffff',
    groundY: 0,
    spawn: { x: 0, y: -20 },
    models: {},   // custom models: name → {w,h,d,solid,physical,script}
    objects: [],  // placed entity specs
  };
}

export function validateMap(m) {
  if (!m || typeof m !== 'object') return null;
  const out = emptyMap(String(m.name || 'untitled').slice(0, 40));
  out.bg = /^#[0-9a-fA-F]{6}$/.test(m.bg) ? m.bg : '#ffffff';
  out.groundY = (m.groundY === null || m.groundY === undefined) ? null : +m.groundY || 0;
  if (m.spawn) out.spawn = { x: +m.spawn.x || 0, y: +m.spawn.y || 0 };
  if (m.models && typeof m.models === 'object') {
    for (const [name, mm] of Object.entries(m.models)) {
      if (!mm || typeof mm !== 'object') continue;
      const w = clamp(Math.floor(+mm.w || 16), 1, 64);
      const h = clamp(Math.floor(+mm.h || 16), 1, 64);
      let d = typeof mm.d === 'string' ? mm.d : '';
      d = d.slice(0, w * h).padEnd(w * h, '.');
      out.models[String(name).slice(0, 24)] = {
        w, h, d,
        solid: mm.solid !== false,
        physical: !!mm.physical,
        script: typeof mm.script === 'string' ? mm.script.slice(0, 20000) : null,
      };
    }
  }
  if (Array.isArray(m.objects)) {
    for (const o of m.objects.slice(0, 600)) {
      if (!o || typeof o !== 'object' || !o.model) continue;
      out.objects.push({
        id: String(o.id || uid()).slice(0, 20),
        model: String(o.model).slice(0, 24),
        x: +o.x || 0, y: +o.y || 0,
        scale: clamp(+o.scale || 100, 10, 800),
        solid: o.solid == null ? null : !!o.solid,
        physical: o.physical == null ? null : !!o.physical,
        color: o.color && COLORS[o.color] ? o.color : null,
        script: typeof o.script === 'string' ? o.script.slice(0, 20000) : null,
      });
    }
  }
  return out;
}

// share codes: "GM1." + base64(json), unicode-safe
export function mapToCode(map) {
  const json = JSON.stringify(map);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'GM1.' + btoa(bin);
}

export function codeToMap(code) {
  try {
    code = String(code).trim();
    if (!code.startsWith('GM1.')) return null;
    const bin = atob(code.slice(4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return validateMap(JSON.parse(json));
  } catch (e) {
    return null;
  }
}
