// Stage collision. The world is made of two kinds of surface:
//   solids : full boxes {x,y,w,h}. You stand on top, bump the sides and bottom.
//   plats  : thin one-way ledges {x,y,w}. You land on them from above and can
//            drop through by pressing down.
// Either kind may carry vx/vy (moving platforms) and conv (conveyor speed).
//
// A body is anything with x,y at its FEET CENTRE, a w/h box, vx/vy, and the
// bookkeeping fields grounded / ground / platDrop.

export function mkSolid(x, y, w, h, o = {}) {
  return Object.assign({ x, y, w, h, vx: 0, vy: 0, ledge: 'lr', soft: false, conv: 0, on: true }, o);
}
export function mkPlat(x, y, w, o = {}) {
  return Object.assign({ x, y, w, h: 10, vx: 0, vy: 0, soft: true, conv: 0, on: true }, o);
}

export function surfaces(stage) {
  return stage._all || (stage._all = stage.solids.concat(stage.plats));
}
export function refreshSurfaces(stage) { stage._all = stage.solids.concat(stage.plats); }

// Is there ground straight below (px,py) within `maxDrop`? Returns the surface.
export function groundBelow(stage, px, py, maxDrop = 2000, includeSoft = true) {
  let best = null, bestY = Infinity;
  for (const s of stage.solids) {
    if (!s.on) continue;
    if (px >= s.x && px <= s.x + s.w && s.y >= py - 1 && s.y - py <= maxDrop && s.y < bestY) { best = s; bestY = s.y; }
  }
  if (includeSoft) for (const s of stage.plats) {
    if (!s.on) continue;
    if (px >= s.x && px <= s.x + s.w && s.y >= py - 1 && s.y - py <= maxDrop && s.y < bestY) { best = s; bestY = s.y; }
  }
  return best;
}

export function pointInSolid(stage, px, py) {
  for (const s of stage.solids) {
    if (s.on && px > s.x && px < s.x + s.w && py > s.y && py < s.y + s.h) return s;
  }
  return null;
}

// Moves a body by (dx,dy) against the stage. Returns flags describing what
// it touched: { landed, wall (-1/1), ceil, left (walked off its ground) }.
const res = { landed: null, wall: 0, ceil: false, left: false };
export function moveBody(stage, b, dx, dy, passSoft = false) {
  res.landed = null; res.wall = 0; res.ceil = false; res.left = false;
  const hw = b.w / 2;

  // ride whatever we're standing on
  if (b.grounded && b.ground) {
    const g = b.ground;
    if (!g.on) { b.grounded = false; b.ground = null; res.left = true; }
    else {
      b.x += (g.vx || 0) + (g.conv || 0);
      b.y = g.y;
    }
  }

  // ---- horizontal ----
  const prevX = b.x;
  b.x += dx;
  for (const s of stage.solids) {
    if (!s.on) continue;
    // feet line is excluded so standing on a box isn't "inside" it
    if (b.x + hw > s.x && b.x - hw < s.x + s.w && b.y - 2 > s.y && b.y - b.h < s.y + s.h) {
      const fromLeft = prevX <= s.x + s.w / 2 - (s.vx || 0);
      if (fromLeft) { b.x = s.x - hw; res.wall = 1; } else { b.x = s.x + s.w + hw; res.wall = -1; }
    }
  }

  // ---- vertical ----
  if (b.grounded && b.ground && dy >= 0) {
    const g = b.ground;
    if (b.x < g.x || b.x > g.x + g.w) { b.grounded = false; b.ground = null; res.left = true; }
    else b.y = g.y;
    return res;
  }
  const prevY = b.y;
  b.y += dy;
  if (dy >= 0) {
    let best = null, bestY = Infinity;
    const test = (s) => {
      if (!s.on) return;
      if (b.x < s.x || b.x > s.x + s.w) return;
      const tol = 3 + Math.max(0, -(s.vy || 0)) + Math.abs(s.vy || 0);
      if (prevY <= s.y + tol && b.y >= s.y && s.y < bestY) { best = s; bestY = s.y; }
    };
    for (const s of stage.solids) test(s);
    if (!passSoft && !(b.platDrop > 0)) for (const s of stage.plats) test(s);
    if (best) { b.y = best.y; b.grounded = true; b.ground = best; res.landed = best; }
    else if (b.grounded) { b.grounded = false; b.ground = null; res.left = true; }
  } else {
    b.grounded = false; b.ground = null;
    for (const s of stage.solids) {
      if (!s.on) continue;
      const bot = s.y + s.h;
      if (b.x + hw - 2 > s.x && b.x - hw + 2 < s.x + s.w && prevY - b.h >= bot - 4 - Math.abs(s.vy || 0) && b.y - b.h < bot) {
        b.y = bot + b.h; res.ceil = true;
      }
    }
  }
  return res;
}

// Ledges are the top corners of solids flagged for it.
export function ledgesOf(stage) {
  const out = stage._ledges || (stage._ledges = []);
  out.length = 0;
  for (const s of stage.solids) {
    if (!s.on || !s.ledge) continue;
    if (s.ledge.includes('l')) out.push({ s, dir: -1, x: s.x, y: s.y, key: s.id + 'l' });
    if (s.ledge.includes('r')) out.push({ s, dir: 1, x: s.x + s.w, y: s.y, key: s.id + 'r' });
  }
  return out;
}
