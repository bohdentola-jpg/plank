// The stage as the sim sees it: solid ground, pass-through platforms, ledges,
// blast zones, and the camera fit. Pure geometry — no three.js — so a whole
// match can be simulated headless in node for testing.

const EPS = 0.001;
/** How far past a platform edge still counts as standing on it. */
export const LIP = 0.12;

function rect(p) {
  const h = p.h ?? 2;
  return {
    l: p.x - p.w / 2,
    r: p.x + p.w / 2,
    top: p.y,
    bottom: p.y - h,
    walls: p.walls !== false,
    ledges: p.ledges || null,
    ref: p,
  };
}

export class World {
  constructor(stage) {
    this.stage = stage;
    this.solids = (stage.solids || []).map(rect);
    this.soft = (stage.soft || []).map((p) => rect({ h: 0.35, walls: false, ...p }));
    this.blast = stage.blast || { left: -22, right: 22, top: 18, bottom: -14 };
    this.spawns = stage.spawns || [{ x: -5, y: 5 }, { x: 5, y: 5 }, { x: -2, y: 8 }, { x: 2, y: 8 }];
    this.ledgeHeld = new Map();      // ledge key → fighter, so two players can't share one
    this.moving = [];                // platforms that shift each frame (blimp, ice floes)
  }

  /** Register a platform whose position is driven by the stage script. */
  addMoving(plat, kind = 'solid') {
    const r = rect(plat);
    r.dynamic = plat;
    (kind === 'soft' ? this.soft : this.solids).push(r);
    this.moving.push(r);
    return r;
  }

  /** Re-read moving platform positions (stage visuals own the animation). */
  syncMoving() {
    for (const r of this.moving) {
      const p = r.dynamic;
      r.l = p.x - p.w / 2;
      r.r = p.x + p.w / 2;
      r.top = p.y;
      r.bottom = p.y - (p.h ?? 0.35);
    }
  }

  /**
   * Highest walkable surface at x that is at or below `fromY`. -Infinity if none.
   * `lip` is how far past the edge still counts — a platform fighter lets you
   * stand with your heels over the drop, and landing and standing must agree on
   * that number or fighters end up "grounded" in mid-air.
   */
  groundYAt(x, fromY = Infinity, includeSoft = true, lip = LIP) {
    let best = -Infinity;
    const scan = (list) => {
      for (const p of list) {
        if (x < p.l - lip || x > p.r + lip) continue;
        if (p.top <= fromY + 0.02 && p.top > best) best = p.top;
      }
    };
    scan(this.solids);
    if (includeSoft) scan(this.soft);
    return best;
  }

  /** The platform a fighter is standing on, or null. */
  platformUnder(x, y, includeSoft = true, lip = LIP) {
    const list = includeSoft ? [...this.solids, ...this.soft] : this.solids;
    let best = null;
    for (const p of list) {
      if (x < p.l - lip || x > p.r + lip) continue;
      if (Math.abs(p.top - y) < 0.06 && (!best || p.top > best.top)) best = p;
    }
    return best;
  }

  /** True if there is no ground within 6 units below this x (used by CPU edge fear). */
  isOffStage(x, y = 0.5) {
    return this.groundYAt(x, y + 0.2) < y - 6;
  }

  /** Every ledge on the stage: {x, y, dir} where dir points away from the stage. */
  ledges() {
    if (this._ledges) return this._ledges;
    const out = [];
    for (const p of this.solids) {
      if (!p.ledges) continue;
      for (const lx of p.ledges) {
        out.push({ x: lx, y: p.top, dir: lx < (p.l + p.r) / 2 ? -1 : 1, key: `${lx.toFixed(2)}:${p.top.toFixed(2)}` });
      }
    }
    this._ledges = out;
    return out;
  }

  /**
   * A grabbable ledge for a fighter falling past the stage edge.
   * They must be outside the ledge, below the lip, falling, and facing the stage.
   */
  grabbableLedge(x, y, facing, vy) {
    if (vy > 0.5) return null;
    for (const L of this.ledges()) {
      if (this.ledgeHeld.get(L.key)) continue;
      const outside = (x - L.x) * L.dir;
      if (outside < -0.15 || outside > 1.15) continue;      // hanging just off the lip
      const dy = y - L.y;
      if (dy > 0.35 || dy < -1.9) continue;
      if (facing === L.dir) continue;                      // must face back toward the stage
      return L;
    }
    return null;
  }

  claimLedge(L, f) { this.ledgeHeld.set(L.key, f); }
  releaseLedge(L, f) { if (this.ledgeHeld.get(L.key) === f) this.ledgeHeld.delete(L.key); }

  /** Blast-zone test. */
  outOfBounds(x, y) {
    return x < this.blast.left || x > this.blast.right || y > this.blast.top || y < this.blast.bottom;
  }

  /** Which side they flew off — drives the KO effect and the star vs screen-crash. */
  koSide(x, y) {
    if (y < this.blast.bottom) return 'bottom';
    if (y > this.blast.top) return 'top';
    return x < 0 ? 'left' : 'right';
  }

  spawnPoint(i) {
    const s = this.spawns[i % this.spawns.length];
    return { x: s.x, y: s.y };
  }

  /** Respawn platform position: above the middle of the stage. */
  respawnPoint(i) {
    const r = this.stage.respawn || { x: 0, y: 0 };
    const spread = [-3.2, 3.2, -6.4, 6.4][i % 4];
    const base = this.stage.respawn ? r.y : (this.solids[0]?.top ?? 0) + 8.5;
    return { x: r.x + spread, y: base };
  }

  /**
   * Camera fit, Smash-style: frame every live fighter with margin, clamped to
   * the stage's zoom range. Returns world-space centre + visible width.
   */
  cameraTarget(fighters) {
    const cam = this.stage.cam || {};
    const minW = cam.minW ?? 16;
    const maxW = cam.maxW ?? 34;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, n = 0;
    for (const f of fighters) {
      if (!f.alive || f.offscreen) continue;
      minX = Math.min(minX, f.x); maxX = Math.max(maxX, f.x);
      minY = Math.min(minY, f.y); maxY = Math.max(maxY, f.y + f.height * 0.6);
      n++;
    }
    if (!n) {
      const p = this.solids[0];
      return { x: p ? (p.l + p.r) / 2 : 0, y: (p?.top ?? 0) + 3, w: (minW + maxW) / 2 };
    }
    // Tight enough that a 1.75-unit fighter reads at low resolution, loose enough
    // that nobody drifts off the edge of the frame before the blast zone.
    const padX = 3.4, padY = 2.4;
    const wantW = Math.max(maxX - minX + padX * 2, (maxY - minY + padY * 2) * 1.72);
    const w = Math.max(minW, Math.min(maxW, wantW));
    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2 + (cam.yBias ?? 0.85);
    // keep the camera inside the blast zones so we never frame pure void
    const halfW = w / 2, halfH = w / 1.72 / 2;
    cx = Math.max(this.blast.left + halfW * 0.72, Math.min(this.blast.right - halfW * 0.72, cx));
    cy = Math.max(this.blast.bottom + halfH * 0.86, Math.min(this.blast.top - halfH * 0.7, cy));
    return { x: cx, y: cy, w };
  }
}
