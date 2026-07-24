// Hit resolution, projectiles, and item pickups. Called once per sim frame,
// after every fighter has stepped.
import { knockback, launchVector, hitlagFrames, LAUNCH, HITSTUN, UNIVERSAL } from './moves.js';

/** Circle-vs-circle, cheap and good enough at this scale. */
function overlaps(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by, r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/** World-space centre of a hitbox on an attacker. */
export function hitboxPos(f, hb) {
  return { x: f.x + hb.x * f.facing * f.stats.size, y: f.y + hb.y * f.stats.size };
}

const scratch = [];

/** Every active hitbox on every attacker vs every hurtbox. */
export function resolveHits(match) {
  const fs = match.fighters;
  for (const a of fs) {
    if (!a.move || (a.state !== 'attack' && a.state !== 'throwing')) continue;
    const m = a.move;
    if (!m.hits.length) continue;
    for (const hb of m.hits) {
      if (a.moveFrame < hb.start || a.moveFrame > hb.end) continue;
      const p = hitboxPos(a, hb);
      const r = hb.r * a.stats.size;
      for (const v of fs) {
        if (v === a || !v.alive || v.state === 'dead') continue;
        if (match.rules.teams && v.team === a.team && !match.rules.friendlyFire) continue;
        if (v.state === 'held' && v.heldBy === a) continue;
        const key = `${v.uid}:${hb.group}`;
        if (a.hitList.has(key)) continue;
        v.hurtboxes(scratch);
        let struck = false;
        for (const hbx of scratch) {
          if (overlaps(p.x, p.y, r, hbx.x, hbx.y, hbx.r)) { struck = true; break; }
        }
        if (!struck) continue;
        a.hitList.add(key);
        const dmgMult = (a.chargeMult || 1) * match.rules.damageRatio * (a.powerUp > 0 ? 1.5 : 1);
        const kbMult = (a.chargeKbMult || 1) * (a.powerUp > 0 ? 1.15 : 1);
        v.takeHit(hb, a, { dmgMult, kbMult, fromX: p.x });
      }
    }
  }
  clankCheck(match);
}

/** Two attacks meeting in the middle bounce off each other. */
function clankCheck(match) {
  const fs = match.fighters;
  for (let i = 0; i < fs.length; i++) {
    const a = fs[i];
    if (a.state !== 'attack' || !a.move?.hits.length || a.hitlag > 0) continue;
    for (let j = i + 1; j < fs.length; j++) {
      const b = fs[j];
      if (b.state !== 'attack' || !b.move?.hits.length || b.hitlag > 0) continue;
      for (const ha of a.move.hits) {
        if (a.moveFrame < ha.start || a.moveFrame > ha.end) continue;
        for (const hbx of b.move.hits) {
          if (b.moveFrame < hbx.start || b.moveFrame > hbx.end) continue;
          const pa = hitboxPos(a, ha), pb = hitboxPos(b, hbx);
          if (!overlaps(pa.x, pa.y, ha.r * a.stats.size, pb.x, pb.y, hbx.r * b.stats.size)) continue;
          if (Math.abs(ha.dmg - hbx.dmg) > 4) return;   // the stronger move wins outright
          const lag = hitlagFrames(Math.max(ha.dmg, hbx.dmg), 1);
          a.hitlag = b.hitlag = lag;
          a.vx -= a.facing * 2.6; b.vx -= b.facing * 2.6;
          a.endMove(); b.endMove();
          const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
          match.sfx?.hit?.('bonk', 0.7);
          match.fx?.spark?.(mx, my, 'star', 0.7);
          match.fx?.popup?.(mx, my + 0.6, 'CLANK', '#ffe98a');
          return;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- projectiles
let projUid = 1;

export class Projectile {
  constructor(owner, def, match) {
    this.uid = projUid++;
    this.owner = owner;
    this.def = def;
    this.match = match;
    this.kind = def.kind || 'ball';
    this.color = def.color || '#ffd34d';
    this.r = def.r ?? 0.24;
    this.dir = owner.facing;
    this.x = owner.x + this.dir * (def.ox ?? 0.7) * owner.stats.size;
    this.y = owner.y + (def.oy ?? owner.height * 0.55);
    this.vx = (def.speed ?? 12) * this.dir;
    this.vy = def.vy ?? 0;
    this.gravity = def.gravity ?? 0;
    this.life = def.life ?? 90;
    this.bounces = def.bounces ?? 0;
    this.spin = def.spin ?? 0;
    this.rot = 0;
    this.dead = false;
    this.hitList = new Set();
    this.homing = def.homing ?? 0;
    this.pierce = def.pierce ?? false;
    this.team = owner.team;
  }

  hb() {
    const d = this.def;
    return {
      dmg: d.dmg ?? 6, angle: d.angle ?? 40, kbBase: d.kbBase ?? 24, kbGrowth: d.kbGrowth ?? 60,
      hitlag: d.hitlag ?? 1, shieldDmg: d.shieldDmg ?? 0, fx: d.fx || 'spark', sfx: d.sfx || 'zap',
      r: this.r, x: 0, y: 0, group: 0, setKb: d.setKb || 0, noFlip: false, noShield: false, grabHit: null,
    };
  }

  step() {
    const STEP = 1 / 60;
    this.life--;
    if (this.life <= 0) { this.expire(); return; }
    if (this.homing) {
      const t = this.match.nearestOpponent(this.owner, this.x, this.y);
      if (t) {
        const a = Math.atan2(t.y + t.height * 0.5 - this.y, t.x - this.x);
        const sp = Math.hypot(this.vx, this.vy);
        const cur = Math.atan2(this.vy, this.vx);
        let d = a - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + Math.max(-this.homing, Math.min(this.homing, d));
        this.vx = Math.cos(na) * sp;
        this.vy = Math.sin(na) * sp;
      }
    }
    this.vy -= this.gravity * STEP;
    this.x += this.vx * STEP;
    this.y += this.vy * STEP;
    this.rot += this.spin * STEP;

    // stage collision
    const w = this.match.world;
    if (this.def.bounces !== undefined || this.gravity) {
      const g = w.groundYAt(this.x, this.y + 0.4);
      if (this.y - this.r <= g && this.vy < 0) {
        if (this.bounces > 0) {
          this.bounces--;
          this.y = g + this.r;
          this.vy = Math.abs(this.vy) * 0.62;
          this.vx *= 0.86;
          this.match.sfx?.hit?.('bonk', 0.3);
        } else if (this.def.explode) { this.explode(); return; }
        else { this.expire(); return; }
      }
    }
    if (w.outOfBounds(this.x, this.y)) { this.dead = true; return; }

    // reflectors flip ownership
    for (const f of this.match.fighters) {
      if (f === this.owner || !f.alive) continue;
      if (f.state === 'attack' && f.move?.reflect) {
        const [a, b] = f.move.reflect.window;
        if (f.moveFrame >= a && f.moveFrame <= b) {
          const fx = f.x + f.facing * 0.6, fy = f.y + f.height * 0.5;
          if (overlaps(this.x, this.y, this.r, fx, fy, 0.85)) {
            this.vx *= -1;
            this.dir *= -1;
            this.owner = f;
            this.team = f.team;
            this.hitList.clear();
            this.def = { ...this.def, dmg: (this.def.dmg ?? 6) * (f.move.reflect.mult || 1.4) };
            this.life = Math.max(this.life, 70);
            this.match.sfx?.hit?.('zap', 0.6);
            this.match.fx?.ring?.(fx, fy, f.color, 0.7);
            return;
          }
        }
      }
    }

    // fighters
    for (const f of this.match.fighters) {
      if (f === this.owner || !f.alive || f.state === 'dead') continue;
      if (this.match.rules.teams && f.team === this.team && !this.match.rules.friendlyFire) continue;
      if (this.hitList.has(f.uid)) continue;
      f.hurtboxes(scratch);
      let struck = false;
      for (const hx of scratch) if (overlaps(this.x, this.y, this.r, hx.x, hx.y, hx.r)) { struck = true; break; }
      if (!struck) continue;
      this.hitList.add(f.uid);
      const connected = f.takeHit(this.hb(), this.owner, {
        dmgMult: this.match.rules.damageRatio, dir: Math.sign(this.vx) || this.dir, fromX: this.x,
        noAttackerLag: true,
      });
      if (this.def.explode) { this.explode(); return; }
      if (!this.pierce) { this.dead = true; if (connected) this.match.fx?.spark?.(this.x, this.y, this.def.fx || 'spark', 0.5); return; }
    }
  }

  explode() {
    const d = this.def.explode;
    const r = d.r ?? 1.6;
    this.match.fx?.spark?.(this.x, this.y, 'flame', 1);
    this.match.fx?.ring?.(this.x, this.y, '#ffb43a', r);
    this.match.fx?.shake?.(0.45);
    this.match.sfx?.explode?.(0.8);
    for (const f of this.match.fighters) {
      if (!f.alive || f.state === 'dead') continue;
      const dist = Math.hypot(f.x - this.x, f.y + f.height * 0.5 - this.y);
      if (dist > r + 0.6) continue;
      const falloff = Math.max(0.45, 1 - dist / (r + 0.6));
      f.takeHit({
        ...this.hb(), dmg: (d.dmg ?? 14) * falloff, angle: Math.atan2(f.y + 0.6 - this.y, f.x - this.x) * 180 / Math.PI,
        kbBase: 44, kbGrowth: 88, hitlag: 1.3, fx: 'flame', sfx: 'burn',
      }, this.owner, { dir: Math.sign(f.x - this.x) || 1, fromX: this.x, noAttackerLag: true });
    }
    this.dead = true;
  }

  expire() {
    if (this.def.explode) { this.explode(); return; }
    this.dead = true;
  }
}

export function updateProjectiles(match) {
  const ps = match.projectiles;
  for (let i = ps.length - 1; i >= 0; i--) {
    ps[i].step();
    if (ps[i].dead) ps.splice(i, 1);
  }
}

// --------------------------------------------------------------------- items
export const ITEM_KINDS = {
  turkey: { label: 'TURKEY LEG', color: '#c8863a', effect: 'heal', r: 0.3 },
  star: { label: 'STAR', color: '#ffe34d', effect: 'invincible', r: 0.32 },
  cap: { label: 'POWER CAP', color: '#e8433f', effect: 'power', r: 0.3 },
  orb: { label: 'MELEE ORB', color: '#8ad6ff', effect: 'finisher', r: 0.38 },
  bomb: { label: 'BOMB CRATE', color: '#4a4f5a', effect: 'bomb', r: 0.34 },
};

export class Item {
  constructor(kind, x, y, match) {
    this.kind = kind;
    this.def = ITEM_KINDS[kind];
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = 0;
    this.match = match;
    this.life = 900;
    this.dead = false;
    this.bob = Math.random() * 6.28;
  }

  step() {
    const STEP = 1 / 60;
    this.life--;
    this.bob += 0.12;
    if (this.life <= 0) { this.dead = true; return; }
    this.vy -= 22 * STEP;
    this.x += this.vx * STEP;
    this.y += this.vy * STEP;
    const g = this.match.world.groundYAt(this.x, this.y + 0.3);
    if (this.y - this.def.r <= g && this.vy < 0) {
      this.y = g + this.def.r;
      this.vy = Math.abs(this.vy) * 0.36;
      this.vx *= 0.7;
      if (Math.abs(this.vy) < 0.6) this.vy = 0;
    }
    if (this.match.world.outOfBounds(this.x, this.y)) { this.dead = true; return; }
    for (const f of this.match.fighters) {
      if (!f.alive || f.state === 'dead') continue;
      if (Math.hypot(f.x - this.x, f.y + f.height * 0.5 - this.y) < this.def.r + 0.75) { this.pickup(f); return; }
    }
  }

  pickup(f) {
    this.dead = true;
    const fx = this.match.fx, sfx = this.match.sfx;
    sfx?.item?.(this.kind);
    switch (this.def.effect) {
      case 'heal':
        f.percent = Math.max(0, f.percent - 14);
        fx?.popup?.(f.x, f.y + f.height + 0.4, '-14%', '#7dff9a');
        sfx?.heal?.();
        break;
      case 'invincible':
        f.invuln = 480;
        fx?.popup?.(f.x, f.y + f.height + 0.4, 'INVINCIBLE!', '#ffe34d');
        break;
      case 'power':
        f.powerUp = 540;
        fx?.popup?.(f.x, f.y + f.height + 0.4, 'POWER UP!', '#ff7a5a');
        break;
      case 'finisher':
        f.finisherReady = true;
        fx?.popup?.(f.x, f.y + f.height + 0.4, 'FINISHER READY', '#8ad6ff');
        fx?.ring?.(f.x, f.y + f.height * 0.5, '#8ad6ff', 1.2);
        sfx?.voice?.('Finisher ready');
        break;
      case 'bomb': {
        const p = new Projectile(f, {
          kind: 'bomb', r: 0.34, speed: 0, vy: 0, gravity: 0, life: 1,
          dmg: 16, explode: { r: 2.3, dmg: 17 }, color: '#4a4f5a',
        }, this.match);
        p.x = this.x; p.y = this.y;
        p.explode();
        break;
      }
    }
  }
}

export function updateItems(match) {
  const items = match.items;
  for (let i = items.length - 1; i >= 0; i--) {
    items[i].step();
    if (items[i].dead) items.splice(i, 1);
  }
  if (!match.rules.items) return;
  match.itemTimer--;
  if (match.itemTimer <= 0 && items.length < 3) {
    match.itemTimer = Math.round(360 + Math.random() * 420) / Math.max(0.4, match.rules.itemRate);
    const keys = Object.keys(ITEM_KINDS).filter((k) => k !== 'orb' || Math.random() < 0.22);
    const kind = keys[(Math.random() * keys.length) | 0];
    const b = match.world.blast;
    const x = (Math.random() - 0.5) * (b.right - b.left) * 0.42;
    items.push(new Item(kind, x, b.top - 2, match));
  }
}

/** Percent-based decay of temporary power-ups; called once per frame. */
export function tickBuffs(match) {
  for (const f of match.fighters) {
    if (f.powerUp > 0) f.powerUp--;
    if (f.shieldHp < UNIVERSAL.shieldMax && f.state !== 'shield') {
      f.shieldHp = Math.min(UNIVERSAL.shieldMax, f.shieldHp + UNIVERSAL.shieldRegen);
    }
  }
}
