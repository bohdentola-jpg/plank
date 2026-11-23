// Northstar is watching. Cameras (the NORTHSTAR 24 store, the new "smart"
// streetlights), Evan, the night patrol and Mr. Grey each see a cone with line
// of sight. Doing something suspicious where you're seen raises ATTENTION;
// time, honest work and church bring it down. At 100 you're BURNED: the
// current mission fails back to its checkpoint.

const s0 = (G) => G.state.attention;

export class Attention {
  constructor(G) {
    this.G = G;
    this.watchers = [];
    this.suspicious = 0;     // seconds of suspicious activity left this frame window
    this.zones = [];         // {x, z, r, rate, label}
    this.seenBy = null;
    this.watched = 0;
    this.looped = new Set(G.state.looped || []); // camera indices looped by a hack (saved)
    for (const c of G.town.cameras || []) {
      this.watchers.push({ kind: 'camera', x: c.x, y: c.y ?? 4, z: c.z, yaw: c.yaw || 0, fov: c.fov || 1.2, range: c.range || 22, owner: c.owner });
    }
  }

  get value() { return this.G.state.attention; }

  add(n) {
    const s = this.G.state;
    s.attention = Math.max(0, Math.min(100, s.attention + n));
    if (s.attention >= 100 && !this.burning) this._burn();
  }

  /** A suspicious act happening now (lockpicking, planting a bug, trespassing…). */
  act(strength = 1, secs = 0.6) { this.suspicious = Math.max(this.suspicious, secs); this.strength = strength; }

  zone(id, x, z, r, rate = 6, label = 'Restricted') { this.zones = this.zones.filter((q) => q.id !== id); this.zones.push({ id, x, z, r, rate, label }); }
  clearZone(id) { this.zones = this.zones.filter((q) => q.id !== id); }

  _sees(w, p, eyeY) {
    const dx = p.x - w.x, dz = p.z - w.z;
    const d = Math.hypot(dx, dz);
    if (d > w.range) return 0;
    const a = Math.atan2(dx, dz);
    let da = a - w.yaw;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > w.fov / 2) return 0;
    if (this.G.world.blocked(w.x, w.y, w.z, p.x, eyeY, p.z)) return 0;
    const crouch = this.G.player.crouch ? 0.55 : 1;
    return (1 - d / w.range * 0.6) * crouch;
  }

  update(dt) {
    const G = this.G, P = G.player.pos;
    if (this.looped.size !== (G.state.looped?.length || 0)) G.state.looped = [...this.looped];
    let best = 0, by = null;
    const eye = P.y + (G.player.crouch ? 1.0 : 1.5);
    this.watchers.forEach((w, i) => {
      if (this.looped.has(i)) return;
      if (Math.abs(w.x - P.x) > 40 || Math.abs(w.z - P.z) > 40) return;
      const k = this._sees(w, P, eye);
      if (k > best) { best = k; by = w; }
    });
    // people who watch (Evan from the register, Mr. Grey, patrols)
    for (const id of ['evan', 'okafor', 'gideon']) {
      const n = G.npcs.get(id);
      if (!n?.ch || n.hidden) continue;
      const k = this._sees({ x: n.pos.x, y: n.pos.y + 1.6, z: n.pos.z, yaw: n.yaw, fov: 2.0, range: 16 }, P, eye);
      if (k > best) { best = k; by = { kind: 'person', id }; }
    }
    const was = this.watched;
    this.watched += ((best > 0.05 ? 1 : 0) - this.watched) * Math.min(1, dt * 6);
    if (was < 0.5 && this.watched >= 0.5 && (this.suspicious > 0 || s0(G) > 30)) G.sfx?.sting?.('spotted');
    this.seenBy = by;
    G.hud.watched = this.watched;
    // the eye turns red only when being seen costs you something
    G.hud.danger = this.watched > 0.3 && (this.suspicious > 0 || this.zones.some((zn) => Math.hypot(P.x - zn.x, P.z - zn.z) < zn.r));
    const s = G.state;
    // suspicious acts in view
    if (this.suspicious > 0) {
      this.suspicious -= dt;
      if (best > 0.05) this.add(dt * 22 * best * (this.strength || 1));
    }
    for (const zn of this.zones) {
      if (Math.hypot(P.x - zn.x, P.z - zn.z) < zn.r && best > 0.05) this.add(dt * zn.rate * best);
    }
    // cooling off
    if (this.suspicious <= 0 && best < 0.05) s.attention = Math.max(0, s.attention - dt * 0.35);
  }

  _burn() {
    const G = this.G;
    this.burning = true;
    this.G.sfx?.sting?.('fail');
    G.hud.toast('BURNED', 'Northstar has you. Back to the last checkpoint.', '#ff4048');
    setTimeout(() => {
      G.state.attention = 55;
      this.burning = false;
      G.missions.restartCurrent?.();
    }, 2500);
  }
}
