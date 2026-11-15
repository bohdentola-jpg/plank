// One fighter on the stage: movement, the state machine and move playback.
// Character files only supply data (stats, moves, a pose and a draw function);
// everything that is the same for every character lives here.

import { G } from '../core/config.js';
import { clamp, approach, sign, lerp } from '../core/util.js';
import { blankSnap } from '../core/input.js';
import { moveBody, ledgesOf, groundBelow } from './physics.js';

const BUF = ['attack', 'special', 'jump', 'shield', 'grab', 'strong', 'taunt', 'tapjump'];

// states in which the player is not in control of the body at all
const NO_PHYS = { grabbed: 1, trapped: 1, ledge: 1, ledgeclimb: 1, dead: 1, respawn: 1, entrance: 0 };

export class Fighter {
  constructor(m, def, slot, opt = {}) {
    this.m = m; this.def = def; this.slot = slot;
    this.id = 'f' + slot;
    this.ctl = opt.ctl;
    this.isCPU = !!(opt.ctl && opt.ctl.isCPU);
    this.cpuLevel = opt.cpuLevel || 0;
    this.costume = opt.costume || 0;
    this.pal = def.costumes[this.costume % def.costumes.length].pal;
    this.team = opt.team === undefined ? slot : opt.team;
    this.st = Object.assign({}, G.stats, def.stats);
    this.w = this.st.w; this.h = this.st.h; this.scale = 1;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
    this.facing = 1; this.grounded = false; this.ground = null; this.platDrop = 0;
    this.pct = 0; this.stocks = m.rules.stocks; this.out = false;
    this.state = 'entrance'; this.sf = 0; this.prevState = ''; this.serial = 0;
    this.freeze = 0; this.invuln = 0; this.armor = 0; this.permArmor = 0; this.intangible = false;
    this.jumps = this.st.airJumps; this.fastFalling = false; this.airdodged = false; this.coyote = 0;
    this.shieldHP = G.shieldMax; this.shieldT = 0;
    this.move = null; this.moveId = ''; this.mf = 0; this.charge = 0; this.hitLog = new Map(); this.moveHit = false;
    this.launch = null; this.hitstun = 0; this.tumble = false; this.launched = false; this.techT = 99;
    this.grabbing = null; this.grabbedBy = null; this.grabT = 0; this.pummelT = 0;
    this.ledge = null; this.ledgeCD = 0; this.ledgeGrabs = 0;
    this.stunT = 0; this.stunKind = '';
    this.superReady = false; this.superActive = false;
    this.buf = {}; for (const b of BUF) this.buf[b] = 99;
    this.inp = blankSnap(); this.sdir = null; this.downHeld = 0; this.tapJumpAt = -99;
    this.cycle = 0; this.t = 0; this.lag = 0; this.rollDir = 1;
    this.v = {};
    this.stats = { kos: 0, falls: 0, sds: 0, dealt: 0, taken: 0 };
    this.lastHitBy = -1; this.lastHitFrame = -9999;
    this.flash = 0; this.flashColor = '#ffffff'; this.shakeX = 0;
    this.pose = null; this.pts = null;
    this.dmgMul = 1; this.kbMul = 1;
    this.deadT = 0; this.respawnT = 0;
    this.silence = 0; this.overrideDraw = null; this.inWater = false; this.wasInWater = false; this.swimT = 0;
    this.gravMul = 1;
    if (def.hooks && def.hooks.init) def.hooks.init(this, m);
  }

  // ------------------------------------------------------------- helpers --
  get stage() { return this.m.stage; }
  hook(name, a, b, c) { const h = this.def.hooks; return h && h[name] ? h[name](this, this.m, a, b, c) : undefined; }
  pressed(a, win = G.buffer) { return this.buf[a] <= win; }
  eat(a) { this.buf[a] = 99; }
  get shielding() { return this.state === 'shield' || this.state === 'shieldstun'; }
  get busy() { return this.state === 'move' || this.freeze > 0; }
  get cx() { return this.x; }
  get cy() { return this.y - this.h * this.scale * 0.5; }
  box() { const w = this.w * this.scale, h = this.h * this.scale; return { x: this.x - w / 2, y: this.y - h, w, h }; }

  hurtboxes() {
    if (this.def.hurt) { const r = this.def.hurt(this); if (r) return r; }
    const s = this.scale; let w = this.w * s + 6, h = this.h * s;
    if (this.state === 'crouch') h *= 0.62;
    else if (this.state === 'down') { h *= 0.4; w *= 1.6; }
    else if (this.state === 'ledge') return [{ x: this.x - w / 2, y: this.y - h - 6, w, h: h + 6 }];
    return [{ x: this.x - w / 2, y: this.y - h, w, h }];
  }

  setState(s, lag) {
    if (this.state === 'move' && this.move && this.move.exit) this.move.exit(this, this.m);
    if (this.state === 'ledge' && s !== 'ledge') { this.ledge = null; }
    this.prevState = this.state;
    this.state = s; this.sf = 0; this.serial++;
    this.armor = 0;
    if (s !== 'move') { this.move = null; this.moveId = ''; this.charge = 0; }
    if (lag !== undefined) this.lag = lag;
    this.intangible = false;
    this.gravMul = 1;
    if (s !== 'hitstun' && s !== 'tumble') this.tumble = false;
  }

  face(dir) { if (dir) this.facing = dir > 0 ? 1 : -1; }

  // --------------------------------------------------------------- input --
  readInput() {
    const inp = this.ctl ? this.ctl.read(this, this.m) : this.inp;
    this.inp = inp;
    const b = this.buf;
    for (const a of BUF) b[a]++;
    for (const a of ['attack', 'special', 'jump', 'shield', 'grab', 'strong', 'taunt']) if (inp.p[a]) b[a] = 0;
    if (inp.p.strong) this.sdir = inp.sdir;
    if (inp.tapY < 0 && this.ctl && this.ctl.tapJump) { b.tapjump = 0; this.tapJumpAt = this.m.frame; }
    if (inp.p.shield) this.techT = 0; else this.techT++;
    this.downHeld = inp.y > 0.6 ? this.downHeld + 1 : 0;
  }

  // Which way is the player pointing for an attack? 'u','d','f','b' or ''.
  dirOf(x, y) {
    const ax = Math.abs(x), ay = Math.abs(y);
    if (ax < 0.4 && ay < 0.4) return '';
    if (ay >= ax * 0.95) return y < 0 ? 'u' : 'd';
    return x * this.facing > 0 ? 'f' : 'b';
  }

  // ------------------------------------------------------- action intake --
  tryGround(fromDash) {
    const inp = this.inp;
    if (this.silence > 0) { this.eat('attack'); this.eat('special'); this.eat('strong'); this.eat('grab'); this.eat('taunt'); }
    if (this.superReady && this.pressed('special') && this.dirOf(inp.x, inp.y) === '') {
      this.eat('special'); if (this.startSuper()) return true;
    }
    if (this.pressed('strong')) {
      this.eat('strong');
      let d = this.sdir ? this.dirOf(this.sdir[0], this.sdir[1]) : this.dirOf(inp.x, inp.y);
      const sx = this.sdir ? this.sdir[0] : inp.x;
      this.sdir = null;
      if (d === 'u') return this.startMove('usmash');
      if (d === 'd') return this.startMove('dsmash');
      if (d === 'b' || d === 'f') this.face(sx);
      return this.startMove('fsmash');
    }
    if (this.pressed('grab') || (this.shielding && this.pressed('attack'))) {
      this.eat('grab'); this.eat('attack');
      if (this.startMove('grab')) { if (!fromDash) this.vx *= 0.3; return true; }
    }
    if (this.pressed('attack')) {
      this.eat('attack');
      if (fromDash && this.def.moves.dash) return this.startMove('dash');
      const d = this.dirOf(inp.x, inp.y);
      if (d === 'u') return this.startMove('utilt');
      if (d === 'd') return this.startMove('dtilt');
      if (d === 'f' || d === 'b') { this.face(inp.x); return this.startMove('ftilt'); }
      return this.startMove('jab');
    }
    if (this.pressed('special')) {
      this.eat('special');
      const d = this.dirOf(inp.x, inp.y);
      if (d === 'u') return this.startMove('uspecial');
      if (d === 'd') return this.startMove('dspecial');
      if (d === 'f' || d === 'b') { this.face(inp.x); return this.startMove('sspecial'); }
      return this.startMove('nspecial');
    }
    if (this.pressed('jump') || this.pressed('tapjump', 2)) {
      const tap = !this.pressed('jump');
      this.eat('jump'); this.eat('tapjump');
      if (this.def.noJump) return false;
      this.jumpSrc = tap ? 'tap' : 'btn';
      this.setState('jumpsquat');
      return true;
    }
    if (inp.h.shield && !this.def.noShield && this.state !== 'shield' && this.shieldHP > 4) {
      this.setState('shield'); this.shieldT = 0;
      return true;
    }
    if (this.pressed('taunt') && this.def.moves.taunt) { this.eat('taunt'); return this.startMove('taunt'); }
    return false;
  }

  tryAir() {
    const inp = this.inp, m = this.m;
    if (this.silence > 0) { this.eat('attack'); this.eat('special'); this.eat('strong'); this.eat('grab'); }
    if (this.superReady && this.pressed('special') && this.dirOf(inp.x, inp.y) === '') {
      this.eat('special'); if (this.startSuper()) return true;
    }
    if (this.pressed('special')) {
      this.eat('special');
      const d = this.dirOf(inp.x, inp.y);
      // an up-tap that was about to become a jump is the "up" of up+special
      if (d === 'u') { this.eat('tapjump'); return this.startMove('uspecial'); }
      if (d === 'd') return this.startMove('dspecial');
      if (d === 'f' || d === 'b') { this.face(inp.x); return this.startMove('sspecial'); }
      return this.startMove('nspecial');
    }
    if (this.pressed('attack') || this.pressed('strong')) {
      const strong = !this.pressed('attack');
      this.eat('attack'); this.eat('strong');
      let d = strong && this.sdir ? this.dirOf(this.sdir[0], this.sdir[1]) : this.dirOf(inp.x, inp.y);
      this.sdir = null;
      if (d === 'u') this.eat('tapjump');
      const id = d === 'u' ? 'uair' : d === 'd' ? 'dair' : d === 'f' ? 'fair' : d === 'b' ? 'bair' : 'nair';
      return this.startMove(id) || this.startMove('nair');
    }
    if (this.pressed('shield') && !this.airdodged && !this.def.noShield) {
      this.eat('shield'); this.airdodged = true; this.setState('airdodge');
      return true;
    }
    // air jump: a tapped "up" waits a few frames in case it was up+attack
    const tapReady = this.pressed('tapjump', 12) && m.frame - this.tapJumpAt >= 3;
    if (this.pressed('jump') || tapReady) {
      if (this.coyote > 0 && !this.def.noJump) {
        this.eat('jump'); this.eat('tapjump'); this.coyote = 0;
        this.vy = -this.st.jump; m.sfx('jump'); return true;
      }
      if (this.jumps > 0) {
        this.eat('jump'); this.eat('tapjump');
        this.airJump();
        return true;
      }
    }
    return false;
  }

  airJump() {
    const used = this.st.airJumps - this.jumps;
    this.jumps--;
    const decay = Math.pow(this.st.djumpDecay || 1, used);
    this.vy = -this.st.djump * decay; this.ky = Math.min(this.ky, 0) * 0.3;
    this.fastFalling = false;
    if (Math.abs(this.inp.x) > 0.3) this.vx = this.inp.x * this.st.airSpeed * 0.9;
    this.m.sfx('djump', { rate: 1 + used * 0.06 });
    this.m.fx.ring(this.x, this.y, 16, '#ffffff');
    if (this.state !== 'air') this.setState('air');
    this.hook('onAirJump');
  }

  startMove(id, force) {
    const moves = this.def.moves;
    if (this.def.remap) id = this.def.remap(this, id) || id;
    let mv = (!this.grounded && moves[id + '_air']) || moves[id];
    if (!mv) return false;
    if (!force) {
      if (mv.can && !mv.can(this, this.m)) return false;
      if (mv.groundOnly && !this.grounded) return false;
      if (mv.airOnly && this.grounded) return false;
    }
    this.setState('move');
    this.move = mv; this.moveId = id; this.mf = 0; this.charge = 0; this.moveHit = false;
    this.hitLog.clear();
    this.fastFalling = false;
    if (mv.start) mv.start(this, this.m);
    return true;
  }

  startSuper() {
    if (!this.def.moves.super && !this.def.superStart) return false;
    this.superReady = false; this.superActive = true;
    this.m.superCutIn(this);
    if (this.def.superStart) { this.def.superStart(this, this.m); return true; }
    return this.startMove('super', true);
  }

  // called by anything that should knock a fighter out of what it's doing
  interrupt() {
    if (this.grabbing) { const v = this.grabbing; this.grabbing = null; if (v.grabbedBy === this) v.releaseFromGrab(); }
    if (this.grabbedBy) { const h = this.grabbedBy; this.grabbedBy = null; if (h.grabbing === this) { h.grabbing = null; if (h.state === 'grabhold') h.setState('idle'); } }
    if (this.ledge) { this.ledge = null; this.ledgeCD = G.ledgeCooldown; }
    if (this.state === 'move' && this.move && this.move.exit) { this.move.exit(this, this.m); this.move = null; this.state = 'air'; }
    this.hook('onInterrupt');
  }

  releaseFromGrab(pop = true) {
    this.grabbedBy = null;
    if (this.state === 'grabbed') {
      this.setState(this.grounded ? 'idle' : 'air');
      if (pop) { this.vy = -4; this.grounded = false; this.ground = null; this.setState('air'); }
    }
  }

  // ---------------------------------------------------------- per frame --
  update() {
    const m = this.m;
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.ledgeCD > 0) this.ledgeCD--;
    if (this.platDrop > 0) this.platDrop--;
    if (this.flash > 0) this.flash--;
    if (this.coyote > 0) this.coyote--;
    if (this.silence > 0 && --this.silence === 0) this.overrideDraw = null;

    if (this.freeze > 0) {
      this.freeze--;
      this.shakeX = this.state === 'hitstun' ? ((this.freeze % 2) * 2 - 1) * Math.min(4, 1 + this.freeze * 0.4) : 0;
      return;
    }
    this.shakeX = 0;

    if (this.hook('preUpdate') === true) { this.afterUpdate(); return; }

    const fn = this['st_' + this.state], serial = this.serial;
    if (fn) fn.call(this); else this.setState(this.grounded ? 'idle' : 'air');
    if (this.serial === serial) this.sf++;

    if (!NO_PHYS[this.state]) this.phys();
    this.afterUpdate();
  }

  afterUpdate() {
    this.hook('postUpdate');
    if (this.state !== 'dead' && this.state !== 'respawn' && !this.out) this.checkBlast();
    this.updatePose();
  }

  updatePose() {
    this.pose = this.def.pose(this, this.m);
    this.pts = this.def.points ? this.def.points(this, this.pose) : null;
  }

  // ------------------------------------------------------------ physics --
  phys() {
    const st = this.st, mv = this.state === 'move' ? this.move : null;
    if (!this.grounded && !this.def.floats) {
      const g = st.gravity * this.gravMul * (mv && mv.grav !== undefined ? mv.grav : 1);
      const cap = this.fastFalling ? st.fastFall : (mv && mv.fallCap) || st.fall;
      if (g < 0) this.vy = Math.max(-cap, this.vy + g);          // upside-down gravity
      else if (this.vy < cap) this.vy = Math.min(cap, this.vy + g);
      else if (this.vy > cap && !this.fastFalling) this.vy = Math.max(cap, this.vy - g);
    }
    this.inWater = false;
    const wt = this.stage.water;
    if (wt && !this.def.floats && this.y > wt.y + 8 && this.x > wt.l && this.x < wt.r && this.state !== 'hitstun') {
      // water: you bob to the surface and can swim/jump out, but not forever
      if (!this.wasInWater) { this.m.fx.drops(this.x, wt.y, 8); this.m.sfx('splash'); this.swimT = 0; }
      this.inWater = true; this.fastFalling = false; this.launched = false;
      const deep = this.y - (wt.y + this.h * 0.55);
      this.vy = deep > 0 ? approach(this.vy, -2.2, 0.7) : approach(this.vy, 0.6, 0.4);
      this.vx *= 0.9; this.kx *= 0.85; this.ky *= 0.85;
      this.jumps = Math.max(this.jumps, 1); this.airdodged = false;
      this.swimT = (this.swimT || 0) + 1;
      if (this.swimT > (wt.air || 260) && this.swimT % 24 === 0) { this.pct = Math.min(999, this.pct + 2); this.flash = 5; this.flashColor = '#7fc8ff'; this.m.fx.bubble(this.x, this.y - this.h); }
      if (this.m.frame % 14 === 0) this.m.fx.bubble(this.x + (this.m.rng.next() - 0.5) * 20, wt.y + 6, 3);
    } else if (this.wasInWater && wt) { this.m.fx.drops(this.x, wt.y, 6); }
    this.wasInWater = this.inWater;
    // knockback is its own decaying push on top of normal movement
    const km = Math.hypot(this.kx, this.ky);
    if (km > 0) {
      const dec = G.kbDecay + (this.grounded ? this.st.traction * 0.6 : 0);
      const nm = Math.max(0, km - dec);
      this.kx *= nm / km; this.ky *= nm / km;
    }
    const g0 = this.ground, wasGrounded = this.grounded;
    const passSoft = !this.grounded && (this.inp.y > 0.62 || this.state === 'hitstun' && this.ky > 3) && this.state !== 'airdodge';
    const r = moveBody(this.stage, this, this.vx + this.kx, this.vy + this.ky, passSoft);

    if (r.wall) {
      const hard = (this.state === 'hitstun' || this.state === 'tumble') && Math.abs(this.kx) > 5;
      if (hard) {
        this.kx = -this.kx * G.bounceKeep; this.m.fx.puff(this.x + r.wall * this.w / 2, this.cy, 4);
        this.m.sfx('bonk', { vol: 0.6 }); this.m.shake(3);
      } else { if (sign(this.vx) === r.wall) this.vx = 0; if (sign(this.kx) === r.wall) this.kx = 0; }
      this.hook('onWall', r.wall);
    }
    if (r.ceil) {
      if ((this.state === 'hitstun' || this.state === 'tumble') && this.ky < -5) {
        this.ky = -this.ky * G.bounceKeep; this.m.sfx('bonk', { vol: 0.6 }); this.m.shake(3);
      } else this.ky = Math.max(0, this.ky);
      this.vy = Math.max(0, this.vy);
    }
    if (r.left && wasGrounded) {
      // grounded attacks, shields and the like stop at the lip of a platform
      const stay = g0 && g0.on && (this.state === 'shield' || this.state === 'shieldstun' || this.state === 'land' ||
        this.state === 'roll' || this.state === 'spotdodge' || this.state === 'grabhold' || this.state === 'down' || this.state === 'getup' ||
        (mv && !mv.slideOff && mv.kind !== 'air'));
      if (stay) {
        this.x = clamp(this.x, g0.x + 0.5, g0.x + g0.w - 0.5);
        this.y = g0.y; this.grounded = true; this.ground = g0; this.vx = 0; this.kx = 0;
      } else this.onLeaveGround();
    }
    if (r.landed) this.onLand(r.landed);
    if (this.grounded) { this.vy = 0; if (this.ky > 0) this.ky = 0; }
  }

  friction(mul = 1) {
    this.vx = approach(this.vx, 0, this.st.traction * mul);
  }

  drift(mul = 1) {
    const st = this.st, x = this.inp.x, max = st.airSpeed;
    if (Math.abs(x) > 0.2) {
      const target = x * max;
      if (sign(target) !== sign(this.vx) || Math.abs(this.vx) < Math.abs(target)) this.vx = approach(this.vx, target, st.airAccel * mul);
    } else this.vx = approach(this.vx, 0, st.airFriction);
    if (Math.abs(this.vx) > max) this.vx = approach(this.vx, sign(this.vx) * max, st.airFriction * 2);
  }

  onLeaveGround() {
    const s = this.state;
    this.grounded = false; this.ground = null;
    if (s === 'idle' || s === 'walk' || s === 'dash' || s === 'run' || s === 'brake' || s === 'turn' || s === 'crouch') {
      this.coyote = 5; this.setState('air');
    } else if (s === 'move') {
      if (this.move && this.move.kind !== 'air' && !this.move.airOK) this.setState('air');
    } else if (s === 'jumpsquat' || s === 'shield' || s === 'shieldstun' || s === 'land' || s === 'getup' || s === 'down') {
      this.setState('air');
    }
  }

  onLand(surface) {
    const m = this.m, s = this.state, st = this.st;
    this.jumps = st.airJumps; this.fastFalling = false; this.airdodged = false; this.launched = false;
    const speed = Math.abs(this.vy + this.ky);
    this.vy = 0; if (this.ky > 0) this.ky = 0;
    this.hook('onLand', surface);
    if (s === 'air') { this.setState('land', st.landLag); this.landFx(speed); }
    else if (s === 'helpless') { this.setState('land', this.v.helplessLag || 12); this.landFx(speed); }
    else if (s === 'airdodge') { this.setState('land', 9); this.landFx(speed); }
    else if (s === 'move') {
      const mv = this.move;
      if (mv.onLand) { if (mv.onLand(this, m) === false) return; }
      if (this.state !== 'move' || this.move !== mv) return;
      if (mv.kind === 'air') {
        const ac = mv.ac;
        const lag = ac && (this.mf < ac[0] || this.mf > ac[1]) ? st.landLag : (mv.landLag === undefined ? 10 : mv.landLag);
        this.setState('land', lag); this.landFx(speed);
      } else if (mv.landEnd) { this.setState('land', mv.landLag || 8); this.landFx(speed); }
      else if (mv.landTo) { this.startMove(mv.landTo, true); }
    }
    else if (s === 'hitstun' || s === 'tumble') {
      if (this.tumble) {
        if (this.techT <= 20 && this.hitstun < 40) {
          this.setState('tech'); this.rollDir = Math.abs(this.inp.x) > 0.5 ? sign(this.inp.x) : 0;
          this.kx = 0; this.vx = 0; m.sfx('tech'); m.fx.ring(this.x, this.y, 20, '#ffffff');
        } else {
          if (speed > 9 && !this.v._bounced) {   // one bounce off the floor on hard landings
            this.v._bounced = true; this.grounded = false; this.ground = null;
            this.vy = -Math.min(7, speed * 0.42); this.kx *= 0.7; m.fx.puff(this.x, this.y, 5); m.sfx('thud'); m.shake(3);
            return;
          }
          this.v._bounced = false;
          this.setState('down'); this.kx *= 0.4; m.fx.puff(this.x, this.y, 4); m.sfx('thud', { vol: 0.7 });
        }
      } else if (s === 'tumble') { this.setState('land', 4); }
    }
  }

  landFx(speed) {
    if (speed > 4) { this.m.fx.dust(this.x, this.y, speed > 8 ? 5 : 3); this.m.sfx('land', { vol: clamp(speed / 12, 0.3, 0.8) }); }
  }

  checkBlast() {
    const b = this.stage.blast;
    const midY = this.y - this.h * this.scale * 0.5;
    if (this.x < b.l || this.x > b.r || midY > b.b || (midY < b.t && (this.launched || this.def.noTopSafe))) {
      this.m.ko(this, this.x < b.l ? 'l' : this.x > b.r ? 'r' : midY > b.b ? 'b' : 't');
    }
  }

  tryLedge() {
    if (this.def.noLedge || this.ledgeCD > 0 || this.inp.y > 0.5 || this.grounded) return false;
    if (this.vy + this.ky < -1 && !(this.move && this.move.ledgeOK !== undefined && this.mf >= this.move.ledgeOK)) return false;
    const hw = this.w * this.scale / 2, hy = this.y - this.h * this.scale * 0.8;
    for (const L of ledgesOf(this.stage)) {
      const dx = (this.x - L.x) * L.dir;           // + = outside the stage
      if (dx < -6 || dx > hw + 22) continue;
      if (hy < L.y - 26 || hy > L.y + 30) continue;
      if (this.m.ledgeTaken(L, this)) continue;
      this.interruptForLedge();
      this.ledge = L; this.setState('ledge'); this.ledge = L;
      this.facing = -L.dir; this.vx = this.vy = this.kx = this.ky = 0;
      this.jumps = this.st.airJumps; this.airdodged = false; this.fastFalling = false; this.launched = false;
      this.invuln = Math.max(this.invuln, Math.max(4, G.ledgeInvuln - this.ledgeGrabs * 8));
      this.ledgeGrabs++;
      this.m.sfx('ledge');
      this.snapToLedge();
      return true;
    }
    return false;
  }
  interruptForLedge() { if (this.state === 'move' && this.move && this.move.exit) this.move.exit(this, this.m); this.move = null; }
  snapToLedge() {
    const L = this.ledge, s = this.scale;
    L.x = L.dir < 0 ? L.s.x : L.s.x + L.s.w; L.y = L.s.y;
    this.x = L.x + L.dir * (this.w * s / 2 + 3);
    this.y = L.y + this.h * s * 0.94;
  }

  // -------------------------------------------------------------- states --
  st_entrance() {
    this.friction();
    if (this.m.state === 'fight') this.setState(this.grounded ? 'idle' : 'air');
  }

  platformDrop() {
    const inp = this.inp;
    if (!this.ground || !this.ground.soft) return false;
    const want = inp.digital ? this.downHeld === 9 : inp.tapY > 0;
    if (!want) return false;
    this.platDrop = 14; this.grounded = false; this.ground = null; this.y += 3; this.vy = 2;
    this.setState('air');
    return true;
  }

  st_idle() {
    const inp = this.inp;
    this.friction();
    if (this.tryGround()) return;
    if (this.platformDrop()) return;
    if (Math.abs(inp.x) > 0.25) {
      this.face(inp.x);
      if (this.def.noRun) { this.setState('walk'); return; }
      if (inp.digital || inp.tapX || Math.abs(inp.x) > 0.85) this.setState('dash'); else this.setState('walk');
    } else if (inp.y > 0.55) this.setState('crouch');
  }

  st_walk() {
    const inp = this.inp;
    if (this.tryGround()) return;
    if (this.platformDrop()) return;
    if (Math.abs(inp.x) < 0.25) { this.setState('idle'); return; }
    this.face(inp.x);
    if (!this.def.noRun && (inp.tapX || Math.abs(inp.x) > 0.85)) { this.setState('dash'); return; }
    const sp = this.def.noRun ? Math.max(Math.abs(inp.x), 0.6) : Math.abs(inp.x) / 0.85;
    this.vx = approach(this.vx, this.facing * this.st.walk * sp, this.st.traction * 1.4);
    this.cycle += Math.abs(this.vx);
    if (inp.y > 0.7 && Math.abs(inp.x) < 0.5) this.setState('crouch');
  }

  st_dash() {
    const inp = this.inp, st = this.st;
    if (this.sf === 0) { this.vx = this.facing * st.dash; this.m.fx.dust(this.x - this.facing * 8, this.y, 2); this.m.sfx('dash', { vol: 0.45 }); }
    if (this.tryGround(true)) return;
    if (this.platformDrop()) return;
    this.cycle += Math.abs(this.vx);
    if (this.sf > 1 && inp.x * this.facing < -0.5 && (inp.digital || inp.tapX)) { this.facing = -this.facing; this.setState('dash'); return; }
    if (this.sf >= st.dashFrames) {
      if (inp.x * this.facing > 0.5) this.setState('run'); else this.setState('brake');
    }
  }

  st_run() {
    const inp = this.inp, st = this.st;
    if (this.tryGround(true)) return;
    if (this.platformDrop()) return;
    this.vx = approach(this.vx, this.facing * st.run, 0.5);
    this.cycle += Math.abs(this.vx);
    if (this.sf % 9 === 0) this.m.sfx('step', { vol: 0.25 });
    if (inp.x * this.facing < -0.5) { this.setState('turn'); return; }
    if (Math.abs(inp.x) < 0.3) this.setState('brake');
  }

  st_brake() {
    this.friction(1.1);
    if (this.tryGround(this.sf < 5)) return;
    const inp = this.inp;
    if (Math.abs(inp.x) > 0.7 && (inp.digital || inp.tapX)) { this.face(inp.x); this.setState('dash'); return; }
    if (Math.abs(this.vx) < 0.6) this.setState('idle');
  }

  st_turn() {
    this.friction(1.3);
    if (this.sf === 0) { this.m.fx.dust(this.x + this.facing * 10, this.y, 3); this.m.sfx('skid', { vol: 0.4 }); }
    if (this.pressed('jump') || this.pressed('tapjump', 2)) { this.facing = -this.facing; if (this.tryGround()) return; }
    if (this.sf >= 9) {
      this.facing = -this.facing;
      if (this.inp.x * this.facing > 0.5) { this.setState('run'); this.vx = this.facing * this.st.run * 0.6; } else this.setState('idle');
    }
  }

  st_crouch() {
    const inp = this.inp;
    this.friction();
    if (this.tryGround()) return;
    if (this.platformDrop()) return;
    if (inp.y < 0.4) this.setState('idle');
  }

  st_jumpsquat() {
    const inp = this.inp, st = this.st;
    // up + a button during the squat is an up-attack, not a jump
    if (inp.y < -0.4 || this.jumpSrc === 'tap') {
      if (this.pressed('strong')) { this.eat('strong'); if (this.startMove('usmash')) return; }
      if (this.pressed('special')) { this.eat('special'); if (this.startMove('uspecial')) return; }
      if (this.pressed('attack') && this.jumpSrc === 'tap') { this.eat('attack'); if (this.startMove('utilt')) return; }
    }
    if (this.sf >= st.jumpSquat) {
      const held = this.jumpSrc === 'tap' ? inp.y < -0.5 : inp.h.jump;
      this.vy = -(held ? st.jump : st.hop);
      const carry = clamp(this.vx, -st.run, st.run) * 0.85;
      this.vx = Math.abs(inp.x) > 0.3 ? clamp(carry + inp.x * 1.3, -st.airSpeed * 1.25, st.airSpeed * 1.25) : carry * 0.8;
      this.grounded = false; this.ground = null;
      this.setState('air');
      this.m.sfx('jump'); this.m.fx.dust(this.x, this.y, 2);
      this.hook('onJump');
    }
  }

  st_air() {
    const inp = this.inp;
    this.drift();
    if (inp.tapY > 0 && this.vy > -1.5 && !this.fastFalling) { this.fastFalling = true; this.vy = this.st.fastFall; this.m.fx.spark(this.x, this.y - this.h, 1, '#ffffff'); }
    if (this.tryAir()) return;
    this.tryLedge();
  }

  st_land() {
    this.friction();
    if (this.sf >= this.lag) {
      this.setState('idle');
      this.st_idle();
    }
  }

  st_helpless() {
    this.drift(0.8);
    this.tryLedge();
  }

  chargeHeld() { return this.inp.h.strong || this.inp.h.attack || (this.isCPU && this.v.aiCharge > 0); }

  st_move() {
    const m = this.m, mv = this.move, fr = this.mf;
    // hold a strong attack to charge it
    if (mv.charge && fr === mv.charge.at && this.charge < (mv.charge.max || 60) && this.chargeHeld()) {
      this.charge++;
      if (this.v.aiCharge > 0) this.v.aiCharge--;
      if (this.charge % 10 === 1) { this.flash = 4; this.flashColor = '#fff2a8'; m.sfx('charge', { vol: 0.3, rate: 1 + this.charge / 90 }); }
      if (this.charge % 6 === 0) m.fx.spark(this.x + (m.rng.next() - 0.5) * 30, this.cy + (m.rng.next() - 0.5) * 40, 1, '#ffe66b');
      this.friction();
      return;
    }
    if (mv.events && mv.events[fr]) { mv.events[fr](this, m); if (this.move !== mv) return; }
    if (mv.sfx && mv.sfx[fr]) m.sfx(mv.sfx[fr]);
    if (mv.vel) for (const v of mv.vel) {
      if (v[0] === fr) { if (v[1] !== null && v[1] !== undefined) this.vx = v[1] * this.facing; if (v[2] !== null && v[2] !== undefined) { this.vy = v[2]; if (v[2] < 0) { this.grounded = false; this.ground = null; } } }
    }
    if (mv.tick) { mv.tick(this, m, fr); if (this.move !== mv) return; }
    if (mv.invuln) { for (const w of mv.invuln) if (fr >= w[0] && fr <= w[1]) this.invuln = Math.max(this.invuln, 1); }
    this.armor = 0;
    if (mv.armor) for (const w of mv.armor) if (fr >= w[0] && fr <= w[1]) this.armor = w[2] === undefined ? 9999 : w[2];
    if (mv.cancel) for (const c of mv.cancel) {
      if (fr >= c.f[0] && fr <= c.f[1] && (!c.on || this.pressed(c.on, c.win || 5)) && (!c.hit || this.moveHit)) {
        if (c.on) this.eat(c.on);
        this.startMove(c.to, true); return;
      }
    }
    // throws: keep the victim in hand, then let go
    if (mv.throw && this.grabbing) {
      const v = this.grabbing, th = mv.throw;
      if (fr < th.f) this.holdVictim();
      else if (fr === th.f) { this.grabbing = null; v.grabbedBy = null; m.throwRelease(this, v, th); }
    }
    this.mf++;
    if (this.grounded) { if (!mv.keepV) this.friction(mv.fric === undefined ? 1 : mv.fric); }
    else {
      const d = mv.drift === undefined ? (mv.kind === 'air' ? 1 : 0.6) : mv.drift;
      if (d > 0) this.drift(d);
      if (mv.kind === 'air' && this.inp.tapY > 0 && this.vy > -1.5 && !this.fastFalling) { this.fastFalling = true; this.vy = this.st.fastFall; }
      if (mv.ledgeOK !== undefined && this.mf >= mv.ledgeOK) { if (this.tryLedge()) return; }
    }
    if (this.mf >= mv.frames) { this.endMove(); return; }
    if (mv.iasa && this.mf >= mv.iasa) { if (this.grounded ? this.tryGround() : this.tryAir()) return; }
  }

  endMove() {
    const mv = this.move;
    this.armor = 0;
    if (mv.onEnd) { mv.onEnd(this, this.m); if (this.move !== mv) return; }
    if (mv.kind === 'super') this.superActive = false;
    if (mv.helpless && !this.grounded) { this.setState('helpless'); return; }
    if (mv.next) { this.setState(mv.next); return; }
    this.setState(this.grounded ? 'idle' : 'air');
  }

  // --- shield / dodges ---
  st_shield() {
    const inp = this.inp;
    this.friction();
    this.shieldT++;
    this.shieldHP -= G.shieldDrain;
    if (this.shieldHP <= 0) { this.shieldBreak(); return; }
    if (this.sf >= 2) {
      if ((inp.tapX || (inp.digital && inp.x && this.sf > 2 && this._sx !== inp.x)) && Math.abs(inp.x) > 0.6) {
        this.rollDir = sign(inp.x); this.setState('roll'); return;
      }
      if (inp.tapY > 0 || (inp.digital && inp.y > 0.6 && this._sy !== 1)) {
        if (!this.platformDropFromShield()) this.setState('spotdodge');
        return;
      }
      if (this.pressed('jump') || this.pressed('tapjump', 2)) { this.jumpSrc = this.pressed('jump') ? 'btn' : 'tap'; this.eat('jump'); this.eat('tapjump'); this.setState('jumpsquat'); return; }
      if (this.pressed('attack') || this.pressed('grab')) { this.eat('attack'); this.eat('grab'); if (this.startMove('grab')) return; }
    }
    this._sx = inp.digital ? inp.x : 0; this._sy = inp.digital && inp.y > 0.6 ? 1 : 0;
    if (!inp.h.shield && this.sf >= 4) this.setState('land', 5);
  }
  platformDropFromShield() { return false; }

  st_shieldstun() {
    this.friction(0.7);
    if (this.sf >= this.lag) { if (this.inp.h.shield) { this.setState('shield'); this.shieldT = 99; } else this.setState('land', 4); }
  }

  shieldBreak() {
    const m = this.m;
    this.shieldHP = G.shieldMax * 0.55;
    this.grounded = false; this.ground = null; this.vy = -9.5; this.vx = 0;
    this.setState('stun'); this.stunT = G.shieldBreakStun; this.stunKind = 'dizzy';
    m.sfx('shieldbreak'); m.shake(8); m.fx.burst(this.x, this.cy, 46, '#ffffff');
    m.fx.stars(this.x, this.cy, 8);
  }

  st_roll() {
    const f = this.sf;
    if (f === 0) this.m.sfx('roll', { vol: 0.5 });
    if (f >= 3 && f <= 17) this.invuln = Math.max(this.invuln, 1);
    const sp = this.st.rollSpeed;
    this.vx = f < 3 ? 0 : f <= 16 ? this.rollDir * sp : approach(this.vx, 0, 0.9);
    if (f === 3) this.m.fx.dust(this.x, this.y, 2);
    if (f >= 27) { if (this.rollDir === this.facing) this.facing = -this.facing; this.vx = 0; this.setState('idle'); }
  }

  st_spotdodge() {
    this.friction(2);
    if (this.sf === 0) this.m.sfx('dodge', { vol: 0.5 });
    if (this.sf >= 2 && this.sf <= 15) this.invuln = Math.max(this.invuln, 1);
    if (this.sf >= 23) this.setState('idle');
  }

  st_airdodge() {
    if (this.sf === 0) { this.m.sfx('dodge', { vol: 0.5 }); this.m.fx.ring(this.x, this.cy, 18, '#ffffff'); }
    if (this.sf >= 3 && this.sf <= 24) this.invuln = Math.max(this.invuln, 1);
    this.drift(0.5);
    if (this.sf >= 30) { this.setState('air'); return; }
    if (this.sf > 24) this.tryLedge();
  }

  st_tech() {
    if (this.sf <= 18) this.invuln = Math.max(this.invuln, 1);
    this.vx = this.sf < 16 ? this.rollDir * 4.6 : approach(this.vx, 0, 0.8);
    if (this.sf >= 26) { this.vx = 0; this.setState('idle'); }
  }

  // --- grabs ---
  grabPoint() {
    const gp = (this.pts && this.pts.grab) || [this.w * 0.5 + 16, 0];
    return [this.x + this.facing * gp[0] * this.scale, this.y + gp[1] * this.scale];
  }
  holdVictim() {
    const v = this.grabbing; if (!v) return;
    const p = this.grabPoint();
    v.x = p[0]; v.y = p[1]; v.vx = v.vy = v.kx = v.ky = 0;
    v.facing = -this.facing; v.grounded = this.grounded; v.ground = this.grounded ? this.ground : null;
  }

  st_grabhold() {
    const m = this.m, v = this.grabbing, inp = this.inp;
    this.friction();
    if (!v || v.grabbedBy !== this || v.state !== 'grabbed') { this.grabbing = null; this.setState(this.grounded ? 'idle' : 'air'); return; }
    this.holdVictim();
    this.grabT--;
    if (this.pummelT > 0) {
      this.pummelT--;
      if (this.pummelT === 9) {
        const pm = this.def.pummel || { dmg: 2 };
        v.pct = Math.min(999, v.pct + pm.dmg); v.flash = 5; v.flashColor = '#ffffff'; v.stats.taken += pm.dmg; this.stats.dealt += pm.dmg;
        this.freeze = 3; v.freeze = 3; m.sfx(pm.sfx || 'hitS'); m.fx.hit(v.x, v.cy, 'punch', 0.6);
      }
      return;
    }
    if (this.grabT <= 0) { this.grabbing = null; v.releaseFromGrab(); v.vx = this.facing * 3; this.vx = -this.facing * 2.5; this.setState('land', 14); return; }
    if (this.sf < 6) return;
    const d = this.dirOf(inp.x, inp.y);
    const act = inp.digital ? d : (inp.tapX || inp.tapY || this.sf > 14 ? d : '');
    if (act) {
      const id = act === 'u' ? 'uthrow' : act === 'd' ? 'dthrow' : act === 'f' ? 'fthrow' : 'bthrow';
      if (this.def.moves[id]) { this.startMove(id, true); this.grabbing = v; return; }
    }
    if (this.pressed('attack') || this.pressed('grab')) { this.eat('attack'); this.eat('grab'); this.pummelT = 16; }
  }

  st_grabbed() {
    const h = this.grabbedBy;
    if (!h || h.grabbing !== this || h.out || h.state === 'dead') { this.grabbedBy = null; this.setState(this.grounded ? 'idle' : 'air'); return; }
    const p = this.inp.p;
    if (p.attack || p.special || p.jump || p.shield || this.inp.tapX || this.inp.tapY) h.grabT -= 5;
    if (this.sf > 300) { h.grabbing = null; this.releaseFromGrab(); }
  }

  // --- getting hit ---
  st_hitstun() {
    if (this.sf === 0 && this.launch) this.applyLaunch();
    this.hitstun--;
    if (this.grounded) this.friction();
    if (this.hitstun <= 0) {
      if (this.grounded) this.setState('idle');
      else if (this.tumble) { this.setState('tumble'); this.tumble = true; }
      else this.setState('air');
    } else if (!this.grounded && this.launched && this.m.frame % 3 === 0 && Math.hypot(this.kx, this.ky) > 7) {
      this.m.fx.trail(this.x, this.cy, this.pal.main || '#ffffff');
    }
  }

  applyLaunch() {
    const L = this.launch, inp = this.inp; this.launch = null;
    let lx = Math.cos(L.ang) * L.dir, ly = -Math.sin(L.ang);
    // directional influence: push the stick sideways to the launch to bend it
    const im = Math.hypot(inp.x, inp.y);
    if (im > 0.3 && L.kb > 20) {
      const th = Math.atan2(ly, lx), ph = Math.atan2(inp.y, inp.x);
      let d = ph - th; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const a = th + Math.sin(d) * G.diMax * Math.min(1, im);
      lx = Math.cos(a); ly = Math.sin(a);
    }
    const sp = L.kb * G.kbVel;
    this.kx = lx * sp; this.ky = ly * sp; this.vx = 0; this.vy = 0;
    this.hitstun = L.hitstun; this.tumble = L.kb >= G.tumbleKB; this.launched = this.tumble;
    this.v._bounced = false;
    if (this.grounded) {
      if (this.ky > 0) {
        if (this.tumble) { this.ky = -this.ky * 0.8; this.m.fx.puff(this.x, this.y, 5); this.m.sfx('thud'); }
        else this.ky = 0;
      }
      if (this.ky < -0.5 || this.tumble) { this.grounded = false; this.ground = null; if (this.ky > -2 && this.tumble) this.ky = -2; }
    }
    this.jumps = Math.max(this.jumps, Math.min(1, this.st.airJumps));
    this.airdodged = false; this.fastFalling = false;
    if (L.face) this.facing = -L.dir;
  }

  st_tumble() {
    this.drift(0.5);
    this.tumble = true;
    if (this.tryAir()) { this.tumble = false; this.launched = false; return; }
    if (this.tryLedge()) { this.tumble = false; return; }
    if (Math.hypot(this.kx, this.ky) < 2 && this.sf > 40 && Math.abs(this.inp.x) > 0.6) { this.launched = false; }
  }

  st_down() {
    const inp = this.inp;
    this.friction(0.8);
    if (this.sf < 12) return;
    if (this.pressed('attack', 10) || this.pressed('strong', 10)) { this.eat('attack'); this.eat('strong'); if (this.def.moves.getup && this.startMove('getup', true)) { this.invuln = 8; return; } }
    if (Math.abs(inp.x) > 0.5) { this.rollDir = sign(inp.x); this.setState('tech'); return; }
    if (inp.y < -0.5 || this.pressed('jump', 10) || this.pressed('shield', 10) || this.pressed('special', 10) || this.sf > 85) { this.setState('getup'); }
  }
  st_getup() {
    if (this.sf <= 14) this.invuln = Math.max(this.invuln, 1);
    if (this.sf >= 22) this.setState('idle');
  }

  st_stun() {
    const p = this.inp.p;
    if (this.grounded) this.friction();
    this.stunT -= 1 + ((p.attack || p.special || p.jump || p.shield || this.inp.tapX || this.inp.tapY) ? 6 : 0);
    if (this.stunKind === 'dizzy' && this.grounded && this.sf % 20 === 0) this.m.fx.stars(this.x, this.y - this.h - 6, 1);
    if (this.stunT <= 0) this.setState(this.grounded ? 'idle' : 'air');
  }
  stun(frames, kind = 'dizzy') { this.interrupt(); this.setState('stun'); this.stunT = frames; this.stunKind = kind; }

  st_trapped() {
    if (this.sf > (this.v.trapMax || 600)) { this.setState(this.grounded ? 'idle' : 'air'); }
  }

  // --- ledge ---
  st_ledge() {
    const inp = this.inp, L = this.ledge, m = this.m;
    if (!L || !L.s.on) { this.ledge = null; this.ledgeCD = G.ledgeCooldown; this.setState('air'); return; }
    this.snapToLedge();
    const dk = (inp.x > 0.5 ? 1 : inp.x < -0.5 ? -1 : 0) * 3 + (inp.y > 0.5 ? 1 : inp.y < -0.5 ? -1 : 0);
    if (this.sf < 6) { this._lk = dk; return; }
    const fresh = dk !== this._lk; this._lk = dk;
    const toward = inp.x * -L.dir;      // + = pressing toward the stage
    if (this.pressed('jump') || (this.pressed('tapjump', 2) && this.ctl && this.ctl.tapJump && inp.tapY < 0)) {
      this.eat('jump'); this.eat('tapjump'); this.ledgeCD = G.ledgeCooldown; this.ledge = null;
      this.setState('air'); this.vy = -this.st.jump * 1.02; this.vx = -L.dir * 1.6; this.invuln = Math.max(this.invuln, 10);
      m.sfx('jump'); return;
    }
    if (this.pressed('attack') || this.pressed('strong')) { this.eat('attack'); this.eat('strong'); this.v.ledgeThen = 'attack'; this.setState('ledgeclimb'); this.ledge = L; return; }
    if (this.pressed('shield')) { this.eat('shield'); this.v.ledgeThen = 'roll'; this.setState('ledgeclimb'); this.ledge = L; return; }
    if (fresh && (toward > 0.6 || inp.y < -0.6)) { this.v.ledgeThen = ''; this.setState('ledgeclimb'); this.ledge = L; return; }
    if (fresh && (toward < -0.6 || inp.y > 0.6) || this.sf > G.ledgeMaxHang) {
      this.ledge = null; this.ledgeCD = G.ledgeCooldown; this.setState('air'); this.vx = L.dir * 0.8; this.vy = 1;
      if (inp.y > 0.6) { this.fastFalling = true; this.vy = this.st.fastFall * 0.7; }
    }
  }

  st_ledgeclimb() {
    const L = this.ledge, T = 26;
    if (!L) { this.setState('air'); return; }
    const hx = L.x + L.dir * (this.w * this.scale / 2 + 3), hy = L.y + this.h * this.scale * 0.94;
    const tx = L.x - L.dir * (this.w * this.scale / 2 + 6), ty = L.y;
    const t = clamp(this.sf / T, 0, 1);
    // up first, then over: an L-shaped path
    const up = clamp(t / 0.55, 0, 1), over = clamp((t - 0.45) / 0.55, 0, 1);
    this.y = lerp(hy, ty - 6, up * up * (3 - 2 * up)); if (over > 0) this.y = lerp(this.y, ty, over);
    this.x = lerp(hx, tx, over * over * (3 - 2 * over));
    this.invuln = Math.max(this.invuln, 1);
    if (this.sf >= T) {
      this.x = tx; this.y = ty; this.grounded = true; this.ground = L.s; this.ledge = null; this.ledgeCD = 12;
      const then = this.v.ledgeThen; this.v.ledgeThen = '';
      if (then === 'attack') { if (!this.startMove('getup', true) && !this.startMove('ftilt', true)) this.setState('idle'); }
      else if (then === 'roll') { this.rollDir = this.facing; this.setState('roll'); this.sf = 3; }
      else this.setState('idle');
    }
  }

  // --- KO / respawn ---
  st_dead() {
    this.deadT--;
    if (this.deadT <= 0) this.m.respawn(this);
  }
  st_respawn() {
    const inp = this.inp;
    this.invuln = Math.max(this.invuln, 2);
    const ty = this.v.respY;
    if (this.y < ty) this.y = Math.min(ty, this.y + 5.5);
    this.respawnT++;
    const wants = Math.abs(inp.x) > 0.5 || inp.y > 0.5 || inp.p.jump || inp.p.attack || inp.p.special || inp.tapY < 0;
    if (this.y >= ty && (this.respawnT > G.respawnHover || (this.respawnT > 30 && wants))) {
      this.invuln = G.respawnInvuln; this.grounded = false; this.ground = null; this.vy = 0;
      this.setState('air');
    }
  }
}
