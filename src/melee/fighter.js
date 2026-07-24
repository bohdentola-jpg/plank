// One fighter: the state machine, the physics, and every input rule that turns
// a stick angle plus a button into the right move. Runs at a fixed 60 Hz — call
// step() exactly once per sim frame. No three.js in here; view.js reads the
// resulting state and poses the rig.
import { UNIVERSAL, STEP, LAUNCH, HITSTUN, KB_DRAG, HITSTUN_GRAV, knockback, launchVector, hitlagFrames } from './moves.js';
import { LIP } from './world.js';

const DEFAULT_STATS = {
  weight: 100, walk: 4.4, run: 8.0, air: 5.6, airAccel: 30,
  gravity: 36, jump: 15.0, hop: 10.2, djump: 14.0, jumps: 2,
  fall: 14.5, fastFall: 22, traction: 55, size: 1,
};

let uid = 1;

export class Fighter {
  constructor(def, { index = 0, color = '#ff4444', team = index, world, match, controls, stocks = 4, cpu = null, alt = 0 }) {
    this.uid = uid++;
    this.def = def;
    this.index = index;
    this.color = color;
    this.team = team;
    this.alt = alt;
    this.world = world;
    this.match = match;
    this.input = controls;
    this.cpu = cpu;
    this.stats = { ...DEFAULT_STATS, ...(def.stats || {}) };
    this.moves = def.moves || {};

    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.percent = 0;
    this.stocks = stocks;
    this.alive = true;
    this.offscreen = false;

    this.state = 'entry';
    this.stateT = 0;
    this.move = null;
    this.moveId = null;
    this.moveFrame = 0;
    this.hitList = new Set();
    this.chargeFrames = 0;
    this.chargeMult = 1;

    this.grounded = false;
    this.platform = null;
    this.jumps = this.stats.jumps;
    this.fastFalling = false;
    this.dropThrough = 0;

    this.shieldHp = UNIVERSAL.shieldMax;
    this.shielding = false;
    this.hitstun = 0;
    this.hitlag = 0;
    this.hitlagFlash = 0;
    this.invuln = 0;
    this.intangible = false;
    this.launchKb = 0;
    this.tumbling = false;
    this.helpless = false;
    this.ledge = null;
    this.ledgeTimer = 0;
    this.grabbed = null;      // victim I am holding
    this.heldBy = null;       // who is holding me
    this.grabTimer = 0;
    this.mashes = 0;
    this.throwPending = null;
    this.deadTimer = 0;
    this.respawnInvuln = 0;
    this.lastHitBy = null;
    this.lastHitAt = -999;
    this.comboCount = 0;
    this.kos = 0;
    this.falls = 0;
    this.selfDestructs = 0;
    this.damageDealt = 0;
    this.finisherReady = false;
    this.finisherUsed = false;
    this.height = 1.75 * (this.stats.size || 1);
    this.wide = 0.62 * (this.stats.size || 1);
    this.frame = 0;              // frames alive, for effects
    this.landSquash = 0;
    this.event = null;           // one-shot label the view/HUD can pick up
  }

  // ------------------------------------------------------------- helpers
  get sfx() { return this.match.sfx; }
  get fx() { return this.match.fx; }

  get moveMax() { return this.move ? this.move.frames : 0; }

  /** Hurtboxes in world space. Crouching and grabbing shrink the profile. */
  hurtboxes(out = []) {
    out.length = 0;
    const h = this.height;
    const crouch = this.state === 'crouch' || this.state === 'spotdodge' || this.moveId === 'dtilt';
    const down = this.state === 'downed';
    if (down) {
      out.push({ x: this.x, y: this.y + 0.3, r: 0.62 * this.stats.size });
      return out;
    }
    const squash = crouch ? 0.62 : 1;
    out.push({ x: this.x, y: this.y + h * 0.34 * squash, r: 0.42 * this.stats.size });
    out.push({ x: this.x, y: this.y + h * 0.74 * squash, r: 0.4 * this.stats.size });
    return out;
  }

  distanceTo(o) { return Math.hypot(o.x - this.x, o.y - this.y); }

  canAct() {
    if (this.hitlag > 0 || this.hitstun > 0) return false;
    if (['ko', 'dead', 'shieldBreak', 'held', 'thrown', 'entry', 'win'].includes(this.state)) return false;
    if (this.state === 'attack' || this.state === 'charge' || this.state === 'throwing') {
      return this.move && this.moveFrame >= this.move.iasa;
    }
    if (['roll', 'spotdodge', 'airdodge', 'land', 'landLag', 'getup', 'ledgeGetup', 'skid', 'jumpsquat', 'turn', 'grab', 'grabbing'].includes(this.state)) return false;
    return true;
  }

  setState(s) {
    // the getup animation is still hanging off the same ledge — don't release it
    if (this.state === 'ledge' && s !== 'ledge' && s !== 'ledgeGetup' && this.ledge) {
      this.world.releaseLedge(this.ledge, this);
      this.ledge = null;
    }
    this.state = s;
    this.stateT = 0;
  }

  // --------------------------------------------------------------- lifecycle
  spawn(x, y, facing = 1) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = facing;
    this.percent = 0;
    this.alive = true;
    this.grounded = false;
    this.jumps = this.stats.jumps;
    this.shieldHp = UNIVERSAL.shieldMax;
    this.hitstun = this.hitlag = 0;
    this.helpless = false;
    this.tumbling = false;
    this.move = null; this.moveId = null;
    this.setState('entry');
    this.respawnInvuln = UNIVERSAL.respawnInvuln;
  }

  respawn(i = this.index) {
    const p = this.world.respawnPoint(i);
    this.spawn(p.x, p.y, p.x > 0 ? -1 : 1);
    this.event = 'respawn';
  }

  loseStock(side) {
    this.stocks--;
    this.falls++;
    this.alive = false;
    this.grabbed?.release?.();
    this.releaseGrab();
    if (this.heldBy) this.heldBy.releaseGrab();
    this.setState('dead');
    this.deadTimer = 78;
    this.percent = 0;
    this.hitstun = 0;
    this.hitlag = 0;
    this.vx = this.vy = 0;
    this.koSide = side;
  }

  // ------------------------------------------------------------------ damage
  /**
   * Take a hit. Returns true if it connected (false = shielded / whiffed).
   * `hb` is a normalized hitbox, `from` the attacker (or projectile owner).
   */
  takeHit(hb, from, { dmgMult = 1, kbMult = 1, dir = null, fromX = null, noAttackerLag = false } = {}) {
    if (!this.alive || this.state === 'dead') return false;
    if (this.invuln > 0 || this.respawnInvuln > 0 || this.intangible) return false;
    const dmg = hb.dmg * dmgMult;
    const facingDir = dir ?? Math.sign((this.x - (fromX ?? from?.x ?? 0)) || from?.facing || 1);

    // shields eat it if you're holding one and the hit comes from the front
    if (this.shielding && this.state === 'shield' && !hb.noShield && facingDir !== this.facing) {
      this.shieldHp -= dmg * 1.1 + (hb.shieldDmg || 0);
      const stun = Math.max(3, Math.round(dmg * UNIVERSAL.shieldStunPerDmg + 2));
      this.hitlag = hitlagFrames(dmg, hb.hitlag * 0.7);
      this.vx += facingDir * Math.min(2.4, dmg * 0.12);
      this.sfx?.shieldHit?.(Math.min(1, dmg / 20));
      this.fx?.spark?.(this.x + facingDir * -0.5, this.y + this.height * 0.5, 'ring', 0.4);
      if (this.shieldHp <= 0) this.breakShield();
      else this.setStateStun(stun);
      return false;
    }

    // counters (down-B) reverse the exchange
    if (this.state === 'attack' && this.move?.counter && from) {
      const [a, b] = this.move.counter.window;
      if (this.moveFrame >= a && this.moveFrame <= b) {
        this.counterFire(from, dmg * this.move.counter.mult);
        return false;
      }
    }

    // armour tanks the knockback but not the damage
    let armoured = false;
    if (this.move?.armor && this.state === 'attack') {
      const { from: a, to: b, threshold } = this.move.armor;
      if (this.moveFrame >= a && this.moveFrame <= b && dmg <= threshold) armoured = true;
    }

    this.percent = Math.min(999, this.percent + dmg);
    from?.creditDamage?.(dmg);
    this.lastHitBy = from || null;
    this.lastHitAt = this.match.frame;

    if (hb.grabHit && from && !from.grabbed && this.state !== 'held') {
      this.hitlag = hitlagFrames(dmg, hb.hitlag);
      if (!noAttackerLag) from.hitlag = this.hitlag;
      from.startGrab(this, hb.grabHit);
      return true;
    }

    const kbRaw = hb.setKb
      ? hb.setKb
      : knockback(dmg, this.percent, this.stats.weight, hb.kbBase, hb.kbGrowth) * kbMult;
    const kb = armoured ? 0 : kbRaw;
    const lag = hitlagFrames(dmg, hb.hitlag);
    this.hitlag = lag;
    this.hitlagFlash = lag;
    // the attacker shares the freeze — but a shooter doesn't stop for a hit
    // their projectile lands halfway across the stage
    if (from && !noAttackerLag) from.hitlag = Math.max(from.hitlag, lag);

    if (kb > 0) {
      const v = launchVector(hb.angle, kb, facingDir);
      const speed = kb * LAUNCH;
      this.pendingLaunch = { vx: v.x * speed, vy: v.y * speed, kb };
      this.hitstun = Math.max(this.hitstun, Math.round(kb * HITSTUN));
      this.launchKb = kb;
      this.tumbling = kb > UNIVERSAL.tumbleThreshold;
      if (!hb.noFlip) this.facing = -facingDir;
      this.releaseGrab();
      this.shielding = false;
      this.helpless = false;
      this.comboCount = (this.match.frame - (this._lastComboAt || -99) < 90) ? this.comboCount + 1 : 1;
      this._lastComboAt = this.match.frame;
    }
    this.sfx?.hit?.(hb.sfx || 'punch', Math.min(1, dmg / 18));
    this.fx?.hitFlash?.(this.x - facingDir * 0.3, this.y + this.height * 0.55, Math.min(1, dmg / 16));
    this.fx?.spark?.(this.x - facingDir * 0.35, this.y + this.height * 0.55, hb.fx || 'spark', Math.min(1, dmg / 16));
    this.fx?.shake?.(Math.min(0.6, dmg / 40));
    if (dmg >= 12) this.fx?.freezeFrames?.(Math.round(lag * 0.35));
    return true;
  }

  setStateStun(frames) {
    this.shieldStun = frames;
  }

  breakShield() {
    this.shieldHp = 0;
    this.shielding = false;
    this.setState('shieldBreak');
    this.stateT = 0;
    this.shieldBreakTimer = UNIVERSAL.shieldBreakStun;
    this.sfx?.shieldBreak?.();
    this.fx?.spark?.(this.x, this.y + this.height * 0.6, 'star', 1);
    this.fx?.shake?.(0.5);
  }

  counterFire(target, dmg) {
    this.hitlag = 8;
    target.hitlag = 8;
    const dir = Math.sign(target.x - this.x) || this.facing;
    this.facing = dir;
    target.percent += dmg;
    const kb = knockback(dmg, target.percent, target.stats.weight, 40, 90);
    const v = launchVector(40, kb, dir);
    target.pendingLaunch = { vx: v.x * kb * LAUNCH, vy: v.y * kb * LAUNCH, kb };
    target.hitstun = Math.round(kb * HITSTUN);
    target.tumbling = kb > UNIVERSAL.tumbleThreshold;
    target.hitlag = 10;
    this.creditDamage(dmg);
    this.sfx?.hit?.('heavy', 1);
    this.fx?.spark?.(target.x, target.y + 0.9, 'star', 1);
    this.fx?.popup?.(this.x, this.y + this.height + 0.5, 'COUNTER!', this.color);
    this.event = 'counter';
  }

  creditDamage(d) { this.damageDealt += d; }

  // -------------------------------------------------------------- grabbing
  startGrab(victim, opts = {}) {
    this.grabbed = victim;
    victim.heldBy = this;
    victim.setState('held');
    victim.vx = victim.vy = 0;
    victim.grounded = false;      // they are held off the floor, not standing
    victim.hitstun = 0;
    victim.mashes = 0;
    victim.grabTimer = Math.round(UNIVERSAL.grabHold + victim.percent * 0.35);
    this.setState('grabbing');
    this.grabHoldT = 0;
    this.cmdGrab = opts.hold ? null : opts;
    this.sfx?.grab?.();
  }

  releaseGrab() {
    if (this.grabbed) {
      const v = this.grabbed;
      v.heldBy = null;
      if (v.state === 'held') { v.setState('air'); v.hitstun = Math.max(v.hitstun, 6); }
      this.grabbed = null;
    }
    if (this.state === 'grabbing') this.setState(this.grounded ? 'idle' : 'air');
  }

  /** Launch the fighter I'm holding along a throw's vector. */
  executeThrow(mvDef) {
    const v = this.grabbed;
    if (!v) return;
    const dmg = mvDef.dmg ?? 8;
    const angle = mvDef.angle ?? 45;
    v.percent = Math.min(999, v.percent + dmg);
    this.creditDamage(dmg);
    const kb = knockback(dmg, v.percent, v.stats.weight, mvDef.kbBase ?? 60, mvDef.kbGrowth ?? 60);
    // angles past 90° throw them behind the thrower (back throws)
    const backward = angle > 90 && angle < 270;
    const dir = backward ? -this.facing : this.facing;
    const ang = backward ? 180 - angle : angle;
    const lv = launchVector(ang, kb, dir);
    v.heldBy = null;
    v.setState('air');
    v.grounded = false;
    v.vx = lv.x * kb * LAUNCH;
    v.vy = lv.y * kb * LAUNCH;
    v.hitstun = Math.round(kb * HITSTUN);
    v.tumbling = kb > UNIVERSAL.tumbleThreshold;
    v.launchKb = kb;
    v.lastHitBy = this;
    v.facing = -dir;
    this.grabbed = null;
    this.sfx?.hit?.('heavy', 0.7);
    this.sfx?.throwWhoosh?.();
    this.fx?.spark?.(v.x, v.y + 0.8, 'star', 0.8);
    this.fx?.shake?.(0.25);
  }

  // ------------------------------------------------------------ move control
  hasMove(id) { return !!this.moves[id]; }

  startMove(id, { charge = false, chargeMult = 1 } = {}) {
    const m = this.moves[id];
    if (!m) return false;
    this.move = m;
    this.moveId = id;
    this.moveFrame = 0;
    this.hitList.clear();
    this.chargeMult = chargeMult;
    this.chargeFrames = 0;
    this.setState(charge ? 'charge' : 'attack');
    this.landCancelled = false;
    if (m.grounded && !this.grounded) { /* aerial version handled by caller */ }
    if (m.sfxStart) this.sfx?.hit?.(m.sfxStart, 0.4);
    if (m.helpless) this.pendingHelpless = true;
    this.event = `move:${id}`;
    return true;
  }

  endMove() {
    const wasHelpless = this.move?.helpless;
    const landLag = this.move?.landLag || 0;
    this.move = null;
    this.moveId = null;
    this.moveFrame = 0;
    if (!this.grounded) {
      this.setState(wasHelpless ? 'helpless' : 'air');
      this.helpless = !!wasHelpless;
    } else if (landLag && this.landCancelled) {
      this.setState('landLag');
      this.landLagLeft = landLag;
    } else {
      this.setState('idle');
    }
  }

  // ------------------------------------------------------------------- step
  /** Advance exactly one 60 Hz frame. */
  step() {
    this.frame++;
    this.event = null;
    const c = this.input;
    if (this.hitlagFlash > 0) this.hitlagFlash--;
    if (this.invuln > 0) this.invuln--;
    if (this.respawnInvuln > 0) this.respawnInvuln--;
    if (this.landSquash > 0) this.landSquash = Math.max(0, this.landSquash - 0.08);

    if (this.state === 'dead') {
      this.deadTimer--;
      if (this.deadTimer <= 0 && this.stocks > 0) this.respawn();
      return;
    }

    // hitlag: everything freezes except directional influence
    if (this.hitlag > 0) {
      this.hitlag--;
      if (this.hitlag === 0 && this.pendingLaunch) {
        this.vx = this.pendingLaunch.vx;
        this.vy = this.pendingLaunch.vy;
        // directional influence: the stick bends the launch angle a little
        if (c && (Math.abs(c.ax) > 0.2 || Math.abs(c.ay) > 0.2)) {
          const sp = Math.hypot(this.vx, this.vy);
          if (sp > 0.01) {
            const ang = Math.atan2(this.vy, this.vx);
            const want = Math.atan2(c.ay, c.ax);
            let d = want - ang;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const bent = ang + Math.max(-1, Math.min(1, d)) * UNIVERSAL.diStrength;
            this.vx = Math.cos(bent) * sp;
            this.vy = Math.sin(bent) * sp;
          }
        }
        this.pendingLaunch = null;
        this.grounded = false;
        this.setState(this.tumbling ? 'tumble' : 'hitstun');
        if (this.launchKb > 130) this.fx?.trail?.(this.x, this.y + 0.8, this.color);
      }
      return;
    }

    this.stateT++;
    if (this.shieldStun > 0) { this.shieldStun--; }

    // ------------------------------------------------ reaction states first
    if (this.hitstun > 0) {
      this.hitstun--;
      this.vx *= KB_DRAG;
      this.vy *= KB_DRAG;
      this.vy -= this.stats.gravity * HITSTUN_GRAV * STEP;
      if (this.vy < -this.stats.fall * 1.6) this.vy = -this.stats.fall * 1.6;
      this.integrate();
      if (this.hitstun <= 0) {
        this.tumbling ? this.setState('tumble') : this.setState(this.grounded ? 'idle' : 'air');
        this.comboCount = 0;
      }
      if (this.launchKb > 90 && this.frame % 3 === 0) this.fx?.trail?.(this.x, this.y + this.height * 0.5, this.color);
      return;
    }

    if (this.state === 'shieldBreak') {
      this.shieldBreakTimer--;
      this.vx *= 0.86;
      this.integrate();
      if (this.shieldBreakTimer <= 0) { this.shieldHp = UNIVERSAL.shieldMax * 0.45; this.setState(this.grounded ? 'idle' : 'air'); }
      return;
    }

    if (this.state === 'held') {
      // mash out: every input shortens the hold
      const pressedAny = c && (c.pressed.attack || c.pressed.jump || c.pressed.special || c.pressed.shield || c.pressed.grab || c.smashX || c.smashY);
      if (pressedAny) { this.mashes++; this.grabTimer -= UNIVERSAL.grabMashFrames; }
      this.grabTimer--;
      const holder = this.heldBy;
      if (holder) {
        this.x = holder.x + holder.facing * 0.95 * holder.stats.size;
        this.y = holder.y + 0.06;
        this.facing = -holder.facing;
        this.vx = this.vy = 0;
      }
      if (this.grabTimer <= 0 || !holder) {
        holder?.releaseGrab();
        this.setState(this.grounded ? 'idle' : 'air');
        this.invuln = 14;
      }
      return;
    }

    if (this.state === 'downed') {
      if (this.stateT > 24 && c && (c.pressed.attack || c.pressed.jump || c.pressed.shield || Math.abs(c.ax) > 0.6 || this.stateT > 90)) {
        this.setState('getup');
        this.invuln = 14;
      }
      this.vx *= 0.7;
      this.integrate();
      return;
    }

    if (this.state === 'getup') {
      this.vx *= 0.8;
      this.integrate();
      if (this.stateT >= 33) this.setState('idle');
      return;
    }

    if (this.state === 'entry') {
      this.vy -= this.stats.gravity * 0.35 * STEP;
      this.integrate();
      if (this.grounded || this.stateT > 90) { this.setState('idle'); }
      return;
    }

    // ------------------------------------------------------------- the ledge
    if (this.state === 'ledge') {
      this.vx = this.vy = 0;
      this.ledgeTimer++;
      if (this.ledgeTimer < UNIVERSAL.ledgeHangInvuln) this.invuln = 2;
      const L = this.ledge;
      if (L) {
        this.x = L.x + L.dir * 0.42;
        this.y = L.y - 1.15;
      }
      if (!c) return;
      const wantUp = c.ay > 0.5 || c.pressed.jump;
      const wantAttack = c.pressed.attack;
      const wantDrop = c.ay < -0.5 || (L && Math.sign(c.ax) === L.dir && Math.abs(c.ax) > 0.6) || c.pressed.shield;
      if (wantUp || wantAttack) {
        this.jumps = this.stats.jumps;
        this.helpless = false;
        if (c.pressed.jump) {
          this.setState('air');
          this.vy = this.stats.jump * 0.92;
          this.vx = -L.dir * 1.4;
          this.sfx?.jump?.();
        } else {
          this.setState('ledgeGetup');
          this.invuln = 18;
        }
      } else if (wantDrop) {
        this.setState('air');
        this.jumps = Math.max(1, this.stats.jumps - 1);
        this.helpless = false;
        this.vy = -1.2;
      }
      return;
    }

    if (this.state === 'ledgeGetup') {
      const L = this.ledge;
      const t = this.stateT / UNIVERSAL.ledgeGetup;
      if (L) {
        this.x = L.x + L.dir * (0.42 - 0.95 * Math.min(1, t));
        this.y = L.y - 1.15 + 1.2 * Math.min(1, t);
      }
      if (this.stateT >= UNIVERSAL.ledgeGetup) {
        if (L) { this.world.releaseLedge(L, this); this.ledge = null; }
        this.y = (L?.y ?? this.y) + 0.02;
        this.vx = 0; this.vy = 0;
        this.grounded = true;
        this.jumps = this.stats.jumps;
        this.setState('idle');
      }
      return;
    }

    // ---------------------------------------------------- move / attack states
    if (this.state === 'charge') {
      this.chargeFrames++;
      const ch = this.move.charge;
      this.vx *= 0.8;
      this.applyGravity(1);
      this.integrate();
      const done = this.chargeFrames >= ch.maxFrames || !c || !c.held.attack;
      if (this.chargeFrames === 1) this.sfx?.charge?.(true);
      if (done) {
        this.sfx?.charge?.(false);
        const t = Math.min(1, this.chargeFrames / ch.maxFrames);
        this.chargeMult = 1 + (ch.dmgMult - 1) * t;
        this.chargeKbMult = 1 + (ch.kbMult - 1) * t;
        this.setState('attack');
        this.moveFrame = 0;
        this.hitList.clear();
      }
      return;
    }

    if (this.state === 'attack' || this.state === 'throwing' || this.state === 'grab') {
      this.stepMove(c);
      return;
    }

    if (this.state === 'grabbing') {
      this.grabHoldT++;
      this.vx *= 0.7;
      this.applyGravity(1);
      this.integrate();
      const v = this.grabbed;
      if (!v || v.state !== 'held') { this.releaseGrab(); return; }
      if (c) {
        if (c.pressed.attack && this.hasMove('pummel')) { this.startMove('pummel'); return; }
        const throwPick = c.smashX || (Math.abs(c.ax) > 0.6 ? Math.sign(c.ax) : 0)
          ? (Math.sign(c.smashX || c.ax) === this.facing ? 'throwF' : 'throwB')
          : (c.ay > 0.6 ? 'throwU' : c.ay < -0.6 ? 'throwD' : null);
        if (throwPick && this.hasMove(throwPick)) {
          this.startMove(throwPick);
          this.setState('throwing');
          return;
        }
        if (c.pressed.shield) { this.releaseGrab(); return; }
      }
      if (this.grabHoldT > 200) this.releaseGrab();
      return;
    }

    // ------------------------------------------------------ defensive states
    if (this.state === 'roll') {
      const [a, b] = UNIVERSAL.rollInvuln;
      if (this.stateT >= a && this.stateT <= b) this.invuln = 2;
      const t = this.stateT / UNIVERSAL.rollFrames;
      this.vx = this.rollDir * UNIVERSAL.rollDist * (t < 0.7 ? 1 : (1 - t) / 0.3) * 1.5;
      this.applyGravity(1);
      this.integrate();
      if (this.stateT >= UNIVERSAL.rollFrames) { this.setState('idle'); this.facing = -this.rollDir; }
      return;
    }

    if (this.state === 'spotdodge') {
      const [a, b] = UNIVERSAL.spotdodgeInvuln;
      if (this.stateT >= a && this.stateT <= b) this.invuln = 2;
      this.vx *= 0.7;
      this.applyGravity(1);
      this.integrate();
      if (this.stateT >= UNIVERSAL.spotdodgeFrames) this.setState('idle');
      return;
    }

    if (this.state === 'airdodge') {
      const [a, b] = UNIVERSAL.airdodgeInvuln;
      if (this.stateT >= a && this.stateT <= b) this.invuln = 2;
      if (this.stateT === 1) {
        const m = Math.hypot(c?.ax || 0, c?.ay || 0);
        if (m > 0.4) {
          this.vx = ((c.ax / m) * UNIVERSAL.airdodgeSpeed);
          this.vy = ((c.ay / m) * UNIVERSAL.airdodgeSpeed);
        } else { this.vx *= 0.4; this.vy = 0.4; }
        this.sfx?.airdodge?.();
      } else {
        this.vx *= 0.9;
        this.vy *= 0.9;
        if (this.stateT > 12) this.applyGravity(0.8);
      }
      this.integrate();
      if (this.grounded) { this.setState('land'); this.landLagLeft = 8; }
      else if (this.stateT >= UNIVERSAL.airdodgeFrames) { this.setState('helpless'); this.helpless = true; }
      return;
    }

    if (this.state === 'shield') {
      this.shielding = true;
      this.shieldHp -= UNIVERSAL.shieldDrain;
      this.vx *= 0.55;
      this.applyGravity(1);
      this.integrate();
      if (this.shieldHp <= 0) { this.breakShield(); return; }
      if (this.shieldStun > 0) return;
      if (!c || !c.held.shield || !this.grounded) {
        this.shielding = false;
        this.setState(this.grounded ? 'idle' : 'air');
        return;
      }
      // shield options
      if (c.pressed.grab || (c.pressed.attack && this.hasMove('grab'))) {
        this.shielding = false;
        this.startMove('grab');
        this.setState('attack');
        return;
      }
      if (c.pressed.jump) { this.shielding = false; this.startJump(); return; }
      if (Math.abs(c.ax) > 0.62 && (c.smashX || Math.abs(c.ax) > 0.8)) {
        this.shielding = false;
        this.rollDir = Math.sign(c.ax);
        this.setState('roll');
        this.sfx?.roll?.();
        return;
      }
      if (c.ay < -0.62) {
        this.shielding = false;
        this.setState('spotdodge');
        this.sfx?.dodge?.();
        return;
      }
      return;
    }

    if (this.state === 'land' || this.state === 'landLag') {
      this.vx *= 0.74;
      this.applyGravity(1);
      this.integrate();
      const lag = this.state === 'landLag' ? (this.landLagLeft || UNIVERSAL.landLag) : UNIVERSAL.landLag;
      if (this.stateT >= lag) this.setState('idle');
      else if (this.stateT >= 2 && c?.pressed.shield) { /* let shields buffer out of landing */ this.setState('shield'); }
      return;
    }

    if (this.state === 'jumpsquat') {
      this.vx *= 0.9;
      if (this.stateT >= UNIVERSAL.jumpsquat) {
        const full = !c || c.held.jump || c.ay > 0.4;
        this.vy = full ? this.stats.jump : this.stats.hop;
        // carry the stick into the jump for a snappier feel
        if (c) this.vx += c.ax * this.stats.air * 0.42;
        this.grounded = false;
        this.jumps = this.stats.jumps - 1;
        this.setState('air');
        this.sfx?.jump?.();
        this.fx?.dust?.(this.x, this.y, 0);
      }
      this.integrate();
      return;
    }

    if (this.state === 'skid') {
      this.groundFriction(1.4);
      this.integrate();
      if (Math.abs(this.vx) < 0.6 || this.stateT > 14) this.setState('idle');
      else if (c) this.groundOptions(c);
      return;
    }

    if (this.state === 'turn') {
      this.groundFriction(1.1);
      this.integrate();
      if (this.stateT >= 3) { this.facing = -this.facing; this.setState('idle'); }
      return;
    }

    if (this.state === 'tumble') {
      this.applyGravity(1);
      this.airDrift(c, 0.7);
      this.integrate();
      if (c && (c.pressed.jump || c.pressed.attack || c.pressed.special || c.pressed.shield || c.ay > 0.7)) {
        this.tumbling = false;
        this.setState('air');
      }
      if (this.grounded) {
        if (this.launchKb > 110 && this.vy < -8) { this.setState('downed'); this.sfx?.land?.(1); }
        else { this.setState('land'); }
        this.tumbling = false;
      }
      return;
    }

    if (this.state === 'helpless') {
      this.applyGravity(1);
      this.airDrift(c, 0.55);
      this.integrate();
      if (this.tryLedgeGrab()) return;
      if (this.grounded) { this.helpless = false; this.setState('land'); this.landLagLeft = UNIVERSAL.hardLandLag; }
      return;
    }

    if (this.state === 'taunt') {
      this.vx *= 0.8;
      this.applyGravity(1);
      this.integrate();
      if (this.stateT > 50) this.setState('idle');
      return;
    }

    if (this.state === 'win') {
      this.vx = 0;
      this.applyGravity(1);
      this.integrate();
      return;
    }

    // ------------------------------------------------------- neutral states
    if (this.grounded) this.groundUpdate(c);
    else this.airUpdate(c);
  }

  // ---------------------------------------------------------------- movement
  applyGravity(scale = 1) {
    if (this.grounded) return;
    const m = this.move?.gravityMul ?? 1;
    this.vy -= this.stats.gravity * scale * m * STEP;
    const max = this.fastFalling ? this.stats.fastFall : this.stats.fall;
    if (this.vy < -max) this.vy = -max;
  }

  groundFriction(scale = 1) {
    // stages can be slippery (the frozen pond runs at a fifth of normal grip)
    const dec = this.stats.traction * scale * (this.world.stage.friction ?? 1) * STEP;
    if (Math.abs(this.vx) <= dec) this.vx = 0;
    else this.vx -= Math.sign(this.vx) * dec;
  }

  airDrift(c, scale = 1) {
    if (!c) return;
    const m = (this.move?.driftMul ?? 1) * scale;
    const target = c.ax * this.stats.air;
    const accel = this.stats.airAccel * m * STEP;
    if (Math.abs(this.vx) > this.stats.air && Math.sign(this.vx) === Math.sign(target)) {
      this.vx *= 0.998;                       // preserve launch momentum
    } else if (target !== 0) {
      this.vx += Math.sign(target - this.vx) * Math.min(accel, Math.abs(target - this.vx));
    } else {
      this.vx *= 0.994;
    }
  }

  /** Integrate velocity and resolve stage collision. */
  integrate() {
    const w = this.world;
    const px = this.x, py = this.y;
    this.x += this.vx * STEP;
    this.y += this.vy * STEP;
    if (this.dropThrough > 0) this.dropThrough--;

    // walls + ceilings on solid blocks
    for (const p of w.solids) {
      if (!p.walls) continue;
      const halfW = this.wide * 0.5;
      const withinY = this.y + this.height * 0.85 > p.bottom && this.y < p.top - 0.12;
      if (!withinY) continue;
      if (this.x + halfW > p.l && this.x - halfW < p.r) {
        const fromLeft = px <= p.l;
        const fromRight = px >= p.r;
        if (fromLeft) { this.x = p.l - halfW; if (this.vx > 0) this.vx = 0; }
        else if (fromRight) { this.x = p.r + halfW; if (this.vx < 0) this.vx = 0; }
        else if (this.vy > 0) { this.y = p.bottom - this.height * 0.86; this.vy = 0; }
      }
    }

    // landing
    let landed = null;
    if (this.vy <= 0) {
      const scan = (list, soft) => {
        for (const p of list) {
          if (soft && this.dropThrough > 0) continue;
          if (this.x < p.l - LIP || this.x > p.r + LIP) continue;
          if (py + 0.001 >= p.top && this.y <= p.top) {
            if (!landed || p.top > landed.top) landed = p;
          }
        }
      };
      scan(w.solids, false);
      scan(w.soft, true);
    }
    if (landed) {
      this.y = landed.top;
      this.vy = 0;
      this.platform = landed;
      if (!this.grounded) this.onLand();
      this.grounded = true;
    } else {
      const under = w.platformUnder(this.x, this.y);
      if (this.grounded && !under) { this.grounded = false; this.platform = null; }
      if (this.grounded && under) { this.y = under.top; this.vy = 0; }
    }
    if (this.grounded) { this.fastFalling = false; this.jumps = this.stats.jumps; }
  }

  onLand() {
    const hard = this.vy < -14 || this.state === 'helpless';
    this.sfx?.land?.(hard ? 1 : 0.45);
    this.fx?.dust?.(this.x, this.y, 0);
    this.landSquash = hard ? 1 : 0.5;
    this.helpless = false;
    if (this.state === 'attack' && this.move?.landCancel) {
      this.landCancelled = true;
      this.endMove();
    } else if (this.state === 'air' || this.state === 'tumble' || this.state === 'helpless') {
      this.setState('land');
      this.landLagLeft = hard ? UNIVERSAL.hardLandLag : UNIVERSAL.landLag;
    }
  }

  startJump() {
    this.setState('jumpsquat');
    this.fastFalling = false;
  }

  tryLedgeGrab() {
    if (this.grounded || this.vy > 0.5) return false;
    if (this.state === 'attack' && !this.move?.hangs) return false;
    const L = this.world.grabbableLedge(this.x, this.y, this.facing, this.vy);
    if (!L) return false;
    this.ledge = L;
    this.world.claimLedge(L, this);
    this.setState('ledge');
    this.ledgeTimer = 0;
    this.vx = this.vy = 0;
    this.helpless = false;
    this.tumbling = false;
    this.jumps = this.stats.jumps;
    this.facing = -L.dir;
    this.invuln = 20;
    this.sfx?.grab?.();
    this.event = 'ledge';
    return true;
  }

  // ------------------------------------------------------------- ground kit
  groundUpdate(c) {
    if (!c) { this.groundFriction(1); this.integrate(); return; }
    if (this.groundOptions(c)) return;

    const ax = c.ax;
    const run = Math.abs(ax) > 0.66;
    if (this.state === 'dash') {
      if (this.stateT > 13) this.setState('run');
      if (Math.abs(ax) < 0.3) { this.setState('skid'); }
      else if (Math.sign(ax) !== this.facing) { this.facing = Math.sign(ax); this.setState('dash'); }
      this.vx = this.facing * this.stats.run * 1.05;
    } else if (this.state === 'run') {
      if (Math.abs(ax) < 0.3) { this.setState('skid'); }
      else if (Math.sign(ax) !== this.facing) { this.setState('turn'); }
      else this.vx = this.facing * this.stats.run;
    } else if (this.state === 'crouch') {
      this.groundFriction(UNIVERSAL.crouchSlide);
      if (c.ay > -0.4) this.setState('idle');
    } else {
      // idle / walk
      if (c.ay < -0.62) { this.setState('crouch'); this.groundFriction(1); }
      else if (c.smashX && Math.sign(c.smashX) !== 0) {
        this.facing = Math.sign(c.smashX);
        this.setState('dash');
        this.vx = this.facing * this.stats.run * 1.05;
        this.fx?.dust?.(this.x, this.y, -this.facing);
      } else if (Math.abs(ax) > 0.18) {
        this.facing = Math.sign(ax);
        this.setState(run ? 'dash' : 'walk');
        this.vx = ax * this.stats.walk;
      } else {
        this.setState('idle');
        this.groundFriction(1);
      }
    }
    this.integrate();
  }

  /** Buttons available from any grounded neutral state. Returns true if used. */
  groundOptions(c) {
    if (c.pressed.jump) { this.startJump(); return true; }
    if (c.held.shield && this.shieldHp > 4) { this.setState('shield'); this.shielding = true; return true; }
    if (c.pressed.grab) { this.startMove('grab'); return true; }
    if (c.pressed.taunt) { this.setState('taunt'); this.sfx?.taunt?.(); return true; }
    if (c.pressed.special) {
      const dir = Math.abs(c.ax) > 0.5 && Math.abs(c.ax) >= Math.abs(c.ay);
      let id = dir ? 'sspecial' : c.ay > 0.5 ? 'uspecial' : c.ay < -0.5 ? 'dspecial' : 'nspecial';
      // holding a MELEE ORB turns neutral special into the character's finisher
      if (id === 'nspecial' && this.finisherReady && this.hasMove('finisher')) {
        id = 'finisher';
        this.finisherReady = false;
        this.finisherUsed = true;
      }
      if (dir) this.facing = Math.sign(c.ax);
      if (this.hasMove(id)) { this.startMove(id); return true; }
    }
    const smash = c.smashDir?.();
    if (smash && this.moves.fsmash) {
      if (smash.x) {
        this.facing = smash.x;
        return this.startMove('fsmash', { charge: true });
      }
      if (smash.y > 0) return this.startMove('usmash', { charge: true });
      if (smash.y < 0) return this.startMove('dsmash', { charge: true });
    }
    if (c.pressed.attack) {
      if (this.state === 'dash' || this.state === 'run') return this.startMove('dashAttack');
      if (c.ay < -0.5) return this.startMove('dtilt');
      if (c.ay > 0.5) return this.startMove('utilt');
      if (Math.abs(c.ax) > 0.5) { this.facing = Math.sign(c.ax); return this.startMove('ftilt'); }
      // jab chain
      const nextJab = this.lastJab === 'jab1' ? 'jab2' : this.lastJab === 'jab2' ? 'jab3' : 'jab1';
      this.lastJab = this.match.frame - (this.lastJabAt || -99) < 32 ? nextJab : 'jab1';
      this.lastJabAt = this.match.frame;
      return this.startMove(this.lastJab);
    }
    return false;
  }

  // ---------------------------------------------------------------- air kit
  airUpdate(c) {
    this.applyGravity(1);
    this.airDrift(c, 1);
    if (c) {
      // flick down on a stick, or simply hold down on a keyboard
      if ((c.smashY < 0 || c.ay < -0.75) && this.vy < 1) this.fastFalling = true;
      if (c.pressed.jump && this.jumps > 0) {
        this.jumps--;
        this.vy = this.stats.djump;
        this.vx += (c.ax || 0) * this.stats.air * 0.5;
        this.fastFalling = false;
        this.helpless = false;
        this.sfx?.doubleJump?.();
        this.fx?.ring?.(this.x, this.y + 0.4, '#ffffff', 0.5);
        this.event = 'djump';
      } else if (c.pressed.shield) {
        this.setState('airdodge');
        return;
      } else if (c.pressed.special) {
        const dir = Math.abs(c.ax) > 0.5 && Math.abs(c.ax) >= Math.abs(c.ay);
        let id = dir ? 'sspecial' : c.ay > 0.5 ? 'uspecial' : c.ay < -0.5 ? 'dspecial' : 'nspecial';
        if (id === 'nspecial' && this.finisherReady && this.hasMove('finisher')) {
          id = 'finisher';
          this.finisherReady = false;
          this.finisherUsed = true;
        }
        if (dir) this.facing = Math.sign(c.ax);
        if (this.hasMove(id)) { this.startMove(id); this.integrate(); return; }
      } else if (c.pressed.grab && this.hasMove('grab')) {
        // air grab = the aerial version of the grab hitbox (a "z-air" style poke)
        this.startMove('nair');
      } else if (c.pressed.attack) {
        const up = c.ay > 0.55, down = c.ay < -0.55;
        const fwd = Math.abs(c.ax) > 0.4 && Math.sign(c.ax) === this.facing;
        const back = Math.abs(c.ax) > 0.4 && Math.sign(c.ax) === -this.facing;
        const id = up ? 'uair' : down ? 'dair' : fwd ? 'fair' : back ? 'bair' : 'nair';
        this.startMove(id);
        this.integrate();
        return;
      }
    }
    this.tryLedgeGrab();
    if (this.state === 'air' || this.state === 'idle') this.setState('air');
    this.integrate();
  }

  // ------------------------------------------------------------ move stepping
  stepMove(c) {
    const m = this.move;
    if (!m) { this.setState(this.grounded ? 'idle' : 'air'); return; }
    this.moveFrame++;

    // scripted movement
    if (m.momentum) {
      for (const k of m.momentum) {
        if (k.frame === this.moveFrame) {
          if (k.kill) { this.vx = 0; this.vy = 0; }
          this.vx += (k.vx || 0) * this.facing;
          this.vy += (k.vy || 0);
          if (k.grounded === false) this.grounded = false;
        }
      }
    }
    if (m.stall && this.moveFrame === m.stall.frame) { this.vy = m.stall.vy; }
    if (m.invuln && this.moveFrame >= m.invuln[0] && this.moveFrame <= m.invuln[1]) this.invuln = 2;
    if (m.spawn) {
      for (const s of m.spawn) {
        if (s.frame === this.moveFrame) this.match.spawnProjectile(this, s.proj);
      }
    }
    if (m.voice && this.moveFrame === 1) this.sfx?.voice?.(m.voice);

    // physics while attacking
    if (this.grounded) {
      this.groundFriction(m.slide ?? 1);
    } else {
      this.applyGravity(1);
      this.airDrift(c, m.driftMul ?? 0.9);
    }
    this.integrate();
    if (m.hangs) this.tryLedgeGrab();

    if (this.moveFrame >= m.frames) {
      if (m.kind === 'grab' && !this.grabbed) { this.endMove(); return; }
      if (this.state === 'throwing') { this.releaseGrab(); }
      this.endMove();
      return;
    }
    // interruptible tail: let the player act early
    if (this.moveFrame >= m.iasa && c) {
      if (this.grounded) { if (this.groundOptions(c)) return; if (Math.abs(c.ax) > 0.3 || c.ay < -0.5) { this.endMove(); return; } }
      else if (c.pressed.jump || c.pressed.attack || c.pressed.special || c.pressed.shield) { this.endMove(); return; }
    }
    // throws release their victim mid-animation
    if (this.state === 'throwing' && this.grabbed && this.moveFrame === (m.release || 12)) {
      this.executeThrow(m);
    }
  }

  /** Percent shown on the HUD, with the shake amount for high damage. */
  hudPercent() { return Math.floor(this.percent); }
}
