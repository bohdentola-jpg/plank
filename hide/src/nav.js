// Navigation grid, A* pathfinding and line-of-sight for the monster.
export class Nav {
  constructor(lvl, cell = 0.5, inflate = 0.32) {
    this.cell = cell;
    this.w = Math.ceil(lvl.W / cell);
    this.h = Math.ceil((lvl.D + 0.3) / cell);
    const N = this.w * this.h;
    this.block = new Uint8Array(N);
    this.sight = new Uint8Array(N);
    for (const c of lvl.colliders) {
      this._mark(c.x0 - inflate, c.z0 - inflate, c.x1 + inflate, c.z1 + inflate, (i) => (this.block[i] = 1));
      this._mark(c.x0, c.z0, c.x1, c.z1, (i) => {
        if (c.tall) this.sight[i] = 1;
        else if (!this.sight[i]) this.sight[i] = 2;
      }, true);
    }
    // borders
    for (let x = 0; x < this.w; x++) { this.block[x] = 1; this.block[(this.h - 1) * this.w + x] = 1; }
    for (let z = 0; z < this.h; z++) { this.block[z * this.w] = 1; this.block[z * this.w + this.w - 1] = 1; }
    this.g = new Float32Array(N);
    this.f = new Float32Array(N);
    this.parent = new Int32Array(N);
    this.stamp = new Uint32Array(N);
    this.closed = new Uint32Array(N);
    this.gen = 1;
    this.heap = new Int32Array(N);
    this.doorBlock = null; // (ax,az,bx,bz) => bool, set by the game
  }
  _mark(x0, z0, x1, z1, fn, touch = false) {
    const c = this.cell;
    // centre-inside test for walk grid; any-overlap test for sight grid
    const ix0 = Math.max(0, Math.floor(touch ? x0 / c : x0 / c + 0.5 - 0.0001));
    const ix1 = Math.min(this.w - 1, Math.floor(touch ? (x1 - 1e-4) / c : x1 / c - 0.5 + 0.0001));
    const iz0 = Math.max(0, Math.floor(touch ? z0 / c : z0 / c + 0.5 - 0.0001));
    const iz1 = Math.min(this.h - 1, Math.floor(touch ? (z1 - 1e-4) / c : z1 / c - 0.5 + 0.0001));
    for (let z = iz0; z <= iz1; z++) for (let x = ix0; x <= ix1; x++) fn(z * this.w + x);
  }
  ix(x) { return Math.floor(x / this.cell); }
  index(x, z) {
    const ix = Math.floor(x / this.cell), iz = Math.floor(z / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return -1;
    return iz * this.w + ix;
  }
  walkable(x, z) {
    const i = this.index(x, z);
    return i >= 0 && !this.block[i];
  }
  centre(i) {
    return { x: ((i % this.w) + 0.5) * this.cell, z: (Math.floor(i / this.w) + 0.5) * this.cell };
  }
  nearestWalkable(x, z, maxR = 12) {
    const i0 = this.index(x, z);
    if (i0 >= 0 && !this.block[i0]) return { x, z };
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let r = 1; r < maxR; r++) {
      let best = null, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ix = cx + dx, iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) continue;
        const i = iz * this.w + ix;
        if (this.block[i]) continue;
        const p = this.centre(i);
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) return best;
    }
    return { x, z };
  }
  // Is the straight segment walkable for the monster?
  clear(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(len / (this.cell * 0.4));
    for (let k = 0; k <= n; k++) {
      const t = n ? k / n : 0;
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }
  // Line of sight between two points. lowBlocks: low furniture hides the target.
  los(ax, az, bx, bz, lowBlocks = false) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(len / (this.cell * 0.35));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const i = this.index(ax + (bx - ax) * t, az + (bz - az) * t);
      if (i < 0) return false;
      const s = this.sight[i];
      if (s === 1 || (lowBlocks && s === 2 && t > 0.5)) return false;
    }
    if (this.doorBlock && this.doorBlock(ax, az, bx, bz)) return false;
    return true;
  }
  path(sx, sz, tx, tz) {
    const s = this.nearestWalkable(sx, sz), t = this.nearestWalkable(tx, tz);
    const si = this.index(s.x, s.z), ti = this.index(t.x, t.z);
    if (si < 0 || ti < 0) return null;
    if (si === ti) return [{ x: t.x, z: t.z }];
    const W = this.w, gen = ++this.gen;
    const { g, f, parent, stamp, closed, heap, block } = this;
    let hn = 0;
    const tx_ = ti % W, tz_ = Math.floor(ti / W);
    const H = (i) => {
      const dx = Math.abs((i % W) - tx_), dz = Math.abs(Math.floor(i / W) - tz_);
      return (dx + dz + (1.4142 - 2) * Math.min(dx, dz));
    };
    const push = (i) => {
      let k = hn++;
      heap[k] = i;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (f[heap[p]] <= f[heap[k]]) break;
        const tmp = heap[p]; heap[p] = heap[k]; heap[k] = tmp;
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      heap[0] = heap[--hn];
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < hn && f[heap[l]] < f[heap[m]]) m = l;
        if (r < hn && f[heap[r]] < f[heap[m]]) m = r;
        if (m === k) break;
        const tmp = heap[m]; heap[m] = heap[k]; heap[k] = tmp;
        k = m;
      }
      return top;
    };
    stamp[si] = gen;
    g[si] = 0;
    f[si] = H(si);
    parent[si] = -1;
    push(si);
    let found = false, iter = 0;
    while (hn > 0 && iter++ < 20000) {
      const cur = pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === ti) { found = true; break; }
      const cx = cur % W, cz = Math.floor(cur / W);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const ni = nz * W + nx;
        if (block[ni] || closed[ni] === gen) continue;
        if (dx && dz && (block[cz * W + nx] || block[nz * W + cx])) continue;
        const ng = g[cur] + (dx && dz ? 1.4142 : 1);
        if (stamp[ni] !== gen || ng < g[ni]) {
          stamp[ni] = gen;
          g[ni] = ng;
          f[ni] = ng + H(ni);
          parent[ni] = cur;
          push(ni);
        }
      }
    }
    if (!found) return null;
    const raw = [];
    for (let i = ti; i !== -1; i = parent[i]) raw.push(this.centre(i));
    raw.reverse();
    raw[raw.length - 1] = { x: t.x, z: t.z };
    // string-pull
    const out = [];
    let anchor = { x: sx, z: sz };
    let k = 0;
    while (k < raw.length - 1) {
      let far = k + 1;
      for (let j = raw.length - 1; j > k + 1; j--) {
        if (this.clear(anchor.x, anchor.z, raw[j].x, raw[j].z)) { far = j; break; }
      }
      out.push(raw[far]);
      anchor = raw[far];
      k = far;
    }
    if (!out.length) out.push(raw[raw.length - 1]);
    return out;
  }
}
