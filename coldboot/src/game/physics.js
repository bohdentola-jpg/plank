// Collision for people and vehicles on foot-level: oriented boxes (walls,
// lamp posts, crates) in a spatial hash, walkable floors and ramps on top of
// the terrain (porches, raised floors, docks, stairs). Circles slide along walls.
import { groundY } from '../world/terrain.js';

const CELL = 16;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.floors = [];
    this.grid = new Map();
    this.fgrid = new Map();
  }

  _key(i, j) { return i * 73856093 ^ j * 19349663; }

  _insert(grid, item, minX, minZ, maxX, maxZ) {
    for (let i = Math.floor(minX / CELL); i <= Math.floor(maxX / CELL); i++) {
      for (let j = Math.floor(minZ / CELL); j <= Math.floor(maxZ / CELL); j++) {
        const k = this._key(i, j);
        let a = grid.get(k);
        if (!a) grid.set(k, (a = []));
        a.push(item);
      }
    }
  }

  /** Box: {x, z, w, d, rot, y (base), h} */
  addBox(b) {
    b.c = Math.cos(b.rot || 0); b.s = Math.sin(b.rot || 0);
    b.hw = b.w / 2; b.hd = b.d / 2;
    const r = Math.hypot(b.hw, b.hd);
    this.boxes.push(b);
    this._insert(this.grid, b, b.x - r, b.z - r, b.x + r, b.z + r);
  }

  /** Floor: {x, z, w, d, rot, y} or ramp {…, y0, y1} (rises along local +z) */
  addFloor(f) {
    f.c = Math.cos(f.rot || 0); f.s = Math.sin(f.rot || 0);
    f.hw = f.w / 2; f.hd = f.d / 2;
    const r = Math.hypot(f.hw, f.hd);
    this.floors.push(f);
    this._insert(this.fgrid, f, f.x - r, f.z - r, f.x + r, f.z + r);
  }

  _near(grid, x, z) {
    return grid.get(this._key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  }

  /** Local coords of a point in a box/floor frame. */
  static local(b, x, z) {
    const dx = x - b.x, dz = z - b.z;
    // rot is a yaw (three.js rotation.y): world = R(rot) * local
    return [dx * b.c - dz * b.s, dx * b.s + dz * b.c];
  }

  /**
   * Height of the walkable surface under (x, z) for something whose feet are
   * at yFeet (floors more than stepUp above the feet are ceilings, ignored).
   */
  groundAt(x, z, yFeet = Infinity, stepUp = 0.55) {
    let y = groundY(x, z);
    if (y < 0) y = Math.max(y, -0.3); // shallow beach / ice
    for (const f of this._near(this.fgrid, x, z)) {
      const [lx, lz] = CollisionWorld.local(f, x, z);
      if (Math.abs(lx) > f.hw || Math.abs(lz) > f.hd) continue;
      let fy;
      if (f.y0 !== undefined) fy = f.y0 + (f.y1 - f.y0) * ((lz + f.hd) / (2 * f.hd));
      else fy = f.y;
      if (fy > y && fy <= yFeet + stepUp) y = fy;
    }
    return y;
  }

  /**
   * The walkable surface at (x, z) closest to a height hint: the floor you'd be
   * standing on there, not the top of the bell tower above it. No hint = ground level.
   */
  groundNear(x, z, yHint) {
    const base = yHint ?? Math.max(-0.3, groundY(x, z));
    return this.groundAt(x, z, base + 0.6);
  }

  /**
   * Move a circle (feet at y, height h) by (dx, dz); resolve against boxes.
   * Returns the new {x, z} and whether something was hit.
   */
  move(pos, dx, dz, radius = 0.3, yFeet = 0, height = 1.7) {
    let x = pos.x + dx, z = pos.z + dz;
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const b of this._near(this.grid, x, z)) {
        if (b.disabled) continue;
        const base = b.y ?? 0;
        if (yFeet + 0.35 > base + (b.h ?? 3) || yFeet + height < base) continue; // step over / under
        const [lx, lz] = CollisionWorld.local(b, x, z);
        const cx = Math.max(-b.hw, Math.min(b.hw, lx));
        const cz = Math.max(-b.hd, Math.min(b.hd, lz));
        let ox = lx - cx, oz = lz - cz;
        let d = Math.hypot(ox, oz);
        if (d >= radius) continue;
        if (d < 1e-5) {
          // centre inside the box: push out along the shallowest axis
          const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz);
          if (px < pz) { ox = Math.sign(lx) || 1; oz = 0; } else { ox = 0; oz = Math.sign(lz) || 1; }
          const push = (px < pz ? px : pz) + radius;
          const wx = ox * b.c + oz * b.s, wz = -ox * b.s + oz * b.c;
          x += wx * push; z += wz * push;
        } else {
          const push = radius - d;
          ox /= d; oz /= d;
          const wx = ox * b.c + oz * b.s, wz = -ox * b.s + oz * b.c;
          x += wx * push; z += wz * push;
        }
        pushed = true;
        hit = true;
      }
      if (!pushed) break;
    }
    return { x, z, hit };
  }

  /** Is a segment (eye → target) blocked by a box taller than eye height? (line of sight) */
  blocked(ax, ay, az, bx, by, bz, ignore = null) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.0);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t;
      for (const b of this._near(this.grid, x, z)) {
        if (b === ignore || b.disabled || (b.h ?? 3) < 1.6) continue;
        const base = b.y ?? 0;
        if (y < base || y > base + (b.h ?? 3)) continue;
        const [lx, lz] = CollisionWorld.local(b, x, z);
        if (Math.abs(lx) < b.hw && Math.abs(lz) < b.hd) return true;
      }
    }
    return false;
  }
}

