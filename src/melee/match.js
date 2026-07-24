// The match: rules, the fixed-step sim loop, KOs, the clock, sudden death.
// Everything here is pure simulation — pass in no-op fx/sfx and it runs headless.
import { Fighter } from './fighter.js';
import { World } from './world.js';
import { resolveHits, updateProjectiles, updateItems, tickBuffs, Projectile } from './combat.js';
import { Cpu } from './ai.js';
import { VirtualControls } from './input.js';

export const DEFAULT_RULES = {
  mode: 'stock',        // 'stock' | 'time'
  stocks: 3,
  timeLimit: 0,         // seconds; 0 = no limit in stock mode
  items: false,
  itemRate: 1,
  damageRatio: 1,
  teams: false,
  friendlyFire: false,
  hazards: true,
};

export const PLAYER_COLORS = ['#e8433f', '#3f7ce8', '#f2c14a', '#3fbf6a'];

const noop = () => {};
export const NULL_FX = new Proxy({}, { get: () => noop });
export const NULL_SFX = new Proxy({}, { get: () => noop });

export class Match {
  /**
   * entrants: [{ def, alt, name, cpu (level 1-9 or 0 for human), controls }]
   */
  constructor({ stage, entrants, rules = {}, fx = NULL_FX, sfx = NULL_SFX, seed = 1 }) {
    this.stage = stage;
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.world = new World(stage);
    this.fx = fx;
    this.sfx = sfx;
    this.frame = 0;
    this.freeze = 0;
    this.projectiles = [];
    this.items = [];
    this.itemTimer = 240;
    this.over = false;
    this.finishing = 0;
    this.result = null;
    this.timeLeft = this.rules.timeLimit || 0;
    this.suddenDeath = false;
    this.countdown = 180;          // 3 seconds of READY? GO!
    this.started = false;
    this.events = [];              // {type, ...} drained by the HUD each frame
    this.rand = mulberry(seed);

    this.fighters = entrants.map((e, i) => {
      const controls = e.controls || new VirtualControls();
      const f = new Fighter(e.def, {
        index: i, color: PLAYER_COLORS[i], team: this.rules.teams ? (i % 2) : i,
        world: this.world, match: this, controls, stocks: this.rules.stocks, alt: e.alt || 0,
      });
      f.name = e.name || e.def.name;
      f.isCpu = !!e.cpu;
      f.cpuLevel = e.cpu || 0;
      f.brain = e.cpu ? new Cpu(f, this, e.cpu) : null;
      const sp = this.world.spawnPoint(i);
      f.spawn(sp.x, sp.y, sp.x > 0 ? -1 : 1);
      return f;
    });
  }

  emit(type, data = {}) { this.events.push({ type, frame: this.frame, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  nearestOpponent(f, x = f.x, y = f.y) {
    let best = null, bd = Infinity;
    for (const o of this.fighters) {
      if (o === f || !o.alive || o.state === 'dead') continue;
      if (this.rules.teams && o.team === f.team) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  spawnProjectile(owner, def) {
    this.projectiles.push(new Projectile(owner, def, this));
    this.sfx?.hit?.(def.sfx || 'zap', 0.35);
  }

  /** Live standings, sorted best-first. Drives the HUD and the results screen. */
  standings() {
    return [...this.fighters].sort((a, b) => {
      if (this.rules.mode === 'time') return (b.kos - b.falls) - (a.kos - a.falls);
      if (b.stocks !== a.stocks) return b.stocks - a.stocks;
      return a.percent - b.percent;
    });
  }

  /** Advance one 60 Hz frame. */
  step() {
    if (this.over) return;
    if (this.freeze > 0) { this.freeze--; return; }

    if (!this.started) {
      this.countdown--;
      if (this.countdown === 120) this.sfx?.countdown?.(3);
      if (this.countdown === 80) this.sfx?.countdown?.(2);
      if (this.countdown === 40) this.sfx?.countdown?.(1);
      if (this.countdown <= 0) {
        this.started = true;
        this.sfx?.go?.();
        this.emit('go');
      }
      // fighters still fall into place during the countdown
      for (const f of this.fighters) f.step();
      this.frame++;
      return;
    }

    this.frame++;
    if (this.rules.timeLimit && !this.suddenDeath) {
      this.timeLeft = Math.max(0, this.rules.timeLimit - this.frame / 60);
    }

    this.world.syncMoving();

    for (const f of this.fighters) {
      if (f.brain && f.alive) f.brain.think();
      f.step();
    }
    resolveHits(this);
    updateProjectiles(this);
    updateItems(this);
    tickBuffs(this);
    this.stageHazards();
    this.checkKOs();

    const takeFreeze = this.fx?.takeFreeze?.();
    if (takeFreeze) this.freeze = Math.min(12, takeFreeze);

    if (this.finishing > 0) {
      this.finishing--;
      if (this.finishing === 0) this.finish();
      return;
    }
    this.checkEnd();
  }

  stageHazards() {
    if (!this.rules.hazards) return;
    this.stage.hazard?.(this, this.frame);
  }

  checkKOs() {
    for (const f of this.fighters) {
      if (!f.alive || f.state === 'dead') continue;
      if (!this.world.outOfBounds(f.x, f.y)) continue;
      const side = this.world.koSide(f.x, f.y);
      const killer = (this.frame - f.lastHitAt < 480) ? f.lastHitBy : null;
      if (killer && killer !== f) killer.kos++;
      else f.selfDestructs++;
      f.loseStock(side);
      this.sfx?.blastZone?.();
      if (side === 'top') this.sfx?.star?.();
      this.fx?.koBlast?.(
        Math.max(this.world.blast.left, Math.min(this.world.blast.right, f.x)),
        Math.max(this.world.blast.bottom + 1, Math.min(this.world.blast.top - 1, f.y)),
        f.color,
      );
      this.fx?.shake?.(0.8);
      this.fx?.flash?.('#ffffff', 0.5);
      this.emit('ko', { who: f.index, by: killer ? killer.index : -1, side, self: !killer });
      const last = this.livingCount() <= 1 || (this.rules.mode === 'stock' && f.stocks <= 0 && this.aliveWithStocks() <= 1);
      if (last) this.finishing = 90;
    }
  }

  livingCount() {
    return this.fighters.filter((f) => f.stocks > 0).length;
  }

  aliveWithStocks() {
    return this.fighters.filter((f) => f.stocks > 0).length;
  }

  checkEnd() {
    if (this.rules.mode === 'stock') {
      if (this.aliveWithStocks() <= 1) { this.finish(); return; }
    }
    if (this.rules.timeLimit && this.timeLeft <= 0) {
      const board = this.standings();
      const top = board[0];
      const tied = board.filter((f) => (this.rules.mode === 'time'
        ? (f.kos - f.falls) === (top.kos - top.falls)
        : f.stocks === top.stocks));
      if (tied.length > 1 && !this.suddenDeath) { this.startSuddenDeath(tied); return; }
      this.sfx?.timeUp?.();
      this.finish();
    }
  }

  startSuddenDeath(tied) {
    this.suddenDeath = true;
    this.rules = { ...this.rules, mode: 'stock', stocks: 1, timeLimit: 0 };
    this.frame = 0;
    this.timeLeft = 0;
    this.countdown = 150;
    this.started = false;
    this.projectiles.length = 0;
    this.items.length = 0;
    for (const f of this.fighters) {
      const inIt = tied.includes(f);
      f.stocks = inIt ? 1 : 0;
      if (inIt) {
        const sp = this.world.spawnPoint(f.index);
        f.spawn(sp.x, sp.y, sp.x > 0 ? -1 : 1);
        f.percent = 150;
      } else {
        f.alive = false;
        f.setState('dead');
        f.deadTimer = 1e9;
      }
    }
    this.sfx?.suddenDeath?.();
    this.emit('suddenDeath');
  }

  finish() {
    if (this.over) return;
    this.over = true;
    const board = this.standings();
    this.result = {
      order: board.map((f) => ({
        index: f.index, name: f.name, def: f.def, color: f.color,
        stocks: Math.max(0, f.stocks), kos: f.kos, falls: f.falls, sd: f.selfDestructs,
        damage: Math.round(f.damageDealt), isCpu: f.isCpu,
      })),
      winner: board[0]?.index ?? -1,
      draw: board.length > 1 && this.rules.mode === 'stock' && board[0].stocks === board[1].stocks && board[0].stocks <= 0,
      frames: this.frame,
      suddenDeath: this.suddenDeath,
    };
    for (const f of this.fighters) {
      if (f.index === this.result.winner) f.setState('win');
    }
    this.sfx?.voice?.('Game!');
    this.emit('game');
  }
}

/** Tiny deterministic PRNG so stage hazards can be seeded for tests. */
function mulberry(a) {
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
