// CPU brains, levels 1-9. The AI drives a VirtualControls exactly like a human
// pad would, so it obeys every rule the sim enforces — jumpsquat, IASA windows,
// hitstun, no teleporting. Higher levels react faster, recover better, and know
// when a percent is a killing percent.

const LEVELS = {
  //          react  aggro  tech  spacing  specials
  1: { react: 26, aggro: 0.30, tech: 0.05, space: 0.4, specials: 0.05, dodge: 0.02 },
  2: { react: 22, aggro: 0.42, tech: 0.10, space: 0.5, specials: 0.12, dodge: 0.06 },
  3: { react: 19, aggro: 0.54, tech: 0.18, space: 0.6, specials: 0.22, dodge: 0.12 },
  4: { react: 16, aggro: 0.64, tech: 0.28, space: 0.7, specials: 0.32, dodge: 0.20 },
  5: { react: 13, aggro: 0.72, tech: 0.40, space: 0.8, specials: 0.42, dodge: 0.28 },
  6: { react: 11, aggro: 0.80, tech: 0.52, space: 0.9, specials: 0.50, dodge: 0.38 },
  7: { react: 9, aggro: 0.86, tech: 0.64, space: 1.0, specials: 0.58, dodge: 0.48 },
  8: { react: 7, aggro: 0.92, tech: 0.78, space: 1.0, specials: 0.64, dodge: 0.58 },
  9: { react: 5, aggro: 1.00, tech: 0.92, space: 1.0, specials: 0.70, dodge: 0.70 },
};

const rnd = () => Math.random();

export class Cpu {
  constructor(fighter, match, level = 5) {
    this.f = fighter;
    this.match = match;
    this.level = Math.max(1, Math.min(9, level | 0));
    this.p = LEVELS[this.level];
    this.plan = { kind: 'wait', t: 0 };
    this.cool = 0;
    this.target = null;
    this.hold = {};
    this.holdT = 0;
    this.jumpCool = 0;
  }

  /** One frame of thought. Writes the controller the fighter will read. */
  think() {
    const f = this.f, m = this.match;
    const c = f.input;
    if (!c.set) return;                       // a human is driving this slot
    if (this.cool > 0) this.cool--;
    if (this.jumpCool > 0) this.jumpCool--;

    if (!m.started || f.state === 'dead' || m.over) { c.set(0, 0, {}); return; }
    const t = m.nearestOpponent(f);
    this.target = t;

    // --- being hit: all we can do is DI and mash
    if (f.hitlag > 0 || f.hitstun > 0 || f.state === 'tumble') {
      const toStage = Math.sign(-f.x) || 1;
      const ax = f.y < 1 ? toStage * 0.9 : toStage * 0.55;
      const ay = f.y < 2 ? 0.7 : 0.2;
      const acts = {};
      if (f.state === 'tumble' && f.vy < 2 && this.p.tech > 0.3) acts.jump = this.holdT % 6 < 2;
      this.holdT++;
      c.set(ax * this.p.tech, ay * this.p.tech, acts);
      return;
    }
    if (f.state === 'held') {
      // mash out
      this.holdT++;
      c.set(((this.holdT % 4) < 2 ? 1 : -1), 0, { attack: this.holdT % 3 === 0, jump: this.holdT % 5 === 0 });
      return;
    }
    if (f.state === 'shieldBreak' || f.state === 'downed') {
      c.set(0, 0, { attack: f.state === 'downed' && this.holdT++ % 8 === 0 });
      return;
    }

    // --- holding someone: pummel then throw them at the nearest blast zone
    if (f.grabbed) {
      const v = f.grabbed;
      const outward = Math.sign(f.x) || 1;
      const killing = v.percent > 70;
      if (this.holdT++ < 12 && !killing) { c.set(0, 0, { attack: this.holdT % 6 < 2 }); return; }
      this.holdT = 0;
      const throwUp = v.percent > 110 && this.p.tech > 0.5 && rnd() < 0.4;
      c.set(throwUp ? 0 : (f.facing === outward ? outward : -outward), throwUp ? 1 : 0, {}, { smashX: throwUp ? 0 : outward });
      return;
    }

    // --- off the stage: get back
    const w = m.world;
    const edge = this.stageEdge();
    const offStage = !f.grounded && (f.x < edge.left - 0.4 || f.x > edge.right + 0.4 || f.y < edge.y - 1.2);
    if (offStage && f.state !== 'ledge') {
      this.recover(c, edge);
      return;
    }
    if (f.state === 'ledge') {
      // hop up when it's safe, or wait a beat at high level
      const wait = this.p.tech > 0.5 && t && Math.abs(t.x - f.x) < 3.2 && f.ledgeTimer < 26;
      c.set(0, wait ? 0 : 1, { jump: !wait && f.ledgeTimer > 8 && rnd() < 0.4, attack: !wait && f.ledgeTimer > 8 && rnd() < 0.25 });
      return;
    }
    if (f.state === 'helpless' || f.helpless) {
      const toStage = Math.sign(-f.x) || 1;
      c.set(toStage * 0.9, 0, {});
      return;
    }

    if (!t) { c.set(0, 0, {}); return; }

    // --- pick a plan on a reaction clock, then commit to it
    if (this.cool <= 0) {
      this.plan = this.choose(t, edge);
      this.cool = Math.max(2, Math.round(this.p.react * (0.7 + rnd() * 0.6)));
      this.holdT = 0;
    }
    this.execute(this.plan, c, t, edge);
  }

  stageEdge() {
    const p = this.match.world.solids[0] || { l: -8, r: 8, top: 0 };
    return { left: p.l, right: p.r, y: p.top };
  }

  choose(t, edge) {
    const f = this.f;
    const dx = t.x - f.x, dy = t.y - f.y;
    const dist = Math.abs(dx);
    const p = this.p;

    // punish: they're stuck in something
    const theyAreOpen = t.hitstun > 0 || t.state === 'shieldBreak' || t.state === 'downed' || t.state === 'landLag';
    // danger: they're swinging
    const theyAttack = t.state === 'attack' && t.moveFrame < (t.move?.frames || 20) * 0.6;

    if (theyAttack && dist < 2.6 && rnd() < p.dodge) {
      return { kind: rnd() < 0.55 ? 'shield' : (rnd() < 0.5 ? 'spotdodge' : 'roll'), t: 18 };
    }
    if (t.percent > 95 && dist < 2.2 && rnd() < p.tech) return { kind: 'kill', t: 26 };
    if (theyAreOpen && dist < 3.4) return { kind: 'punish', t: 22 };

    // edgeguard: they're off stage and below us
    if (!t.grounded && (t.x < edge.left || t.x > edge.right) && p.tech > 0.4 && rnd() < p.aggro) {
      return { kind: 'edgeguard', t: 40 };
    }
    if (dy > 1.8 && dist < 2.6) return { kind: 'antiAir', t: 20 };
    if (dy < -1.6 && !f.grounded) return { kind: 'spike', t: 20 };
    if (dist > 6.5) {
      if (this.f.hasMove('nspecial') && rnd() < p.specials * 0.8) return { kind: 'zone', t: 26 };
      return { kind: 'approach', t: 26 };
    }
    if (dist > 2.4) return { kind: rnd() < p.aggro ? 'approach' : 'reposition', t: 22 };
    if (rnd() < 0.18 + p.tech * 0.2 && f.hasMove('grab')) return { kind: 'grab', t: 20 };
    if (rnd() < p.specials * 0.5) return { kind: 'special', t: 24 };
    return { kind: 'attack', t: 20 };
  }

  execute(plan, c, t, edge) {
    const f = this.f;
    const dx = t.x - f.x, dy = (t.y + t.height * 0.4) - (f.y + f.height * 0.4);
    const dir = Math.sign(dx) || f.facing;
    const dist = Math.abs(dx);
    const acts = {};
    let ax = 0, ay = 0, smashX = 0, smashY = 0;
    const beat = this.holdT++;
    const tapped = beat % 10 < 2;      // buttons must be tapped, not mashed flat

    switch (plan.kind) {
      case 'approach': {
        ax = dir * (dist > 4.5 ? 1 : 0.72);
        if (dy > 1.6 && f.grounded && this.jumpCool <= 0) { acts.jump = tapped; this.jumpCool = 26; }
        if (dist < 1.5 && tapped) acts.attack = true;
        break;
      }
      case 'reposition': {
        ax = dir * (this.p.space > 0.7 && dist < 1.4 ? -0.7 : 0.5);
        if (rnd() < 0.02) acts.shield = true;
        break;
      }
      case 'attack': {
        ax = dist > 1.2 ? dir * 0.5 : 0;
        if (beat % 14 < 2) {
          acts.attack = true;
          if (dy > 1.2) ay = 0.8;
          else if (dist > 1.1) ax = dir * 0.7;
        }
        break;
      }
      case 'punish': {
        ax = dist > 1.3 ? dir * 0.9 : 0;
        if (beat % 12 < 2) { acts.attack = true; ax = dir * 0.8; }
        break;
      }
      case 'kill': {
        // charge a smash into the kill
        ax = dist > 1.3 ? dir * 0.8 : 0;
        if (beat < 3) { smashX = dir; acts.attack = true; ax = dir; }
        else if (beat < 3 + Math.round(10 + this.p.tech * 22)) { acts.attack = true; ax = dir * 0.2; }
        break;
      }
      case 'antiAir': {
        ax = dir * 0.3;
        if (beat % 12 < 2) { acts.attack = true; ay = 1; if (this.p.tech > 0.5 && rnd() < 0.5) smashY = 1; }
        break;
      }
      case 'spike': {
        ax = dir * 0.5;
        if (beat % 14 < 2) { acts.attack = true; ay = -1; }
        break;
      }
      case 'grab': {
        ax = dist > 1.1 ? dir * 0.8 : 0;
        acts.grab = beat % 16 < 2;
        break;
      }
      case 'special': {
        ax = dist > 2 ? dir * 0.6 : 0;
        if (beat % 16 < 2) {
          acts.special = true;
          if (dy > 1.6) ay = 1;
          else if (dist > 3) ax = dir;
          else if (rnd() < 0.3) ay = -1;
        }
        break;
      }
      case 'zone': {
        ax = dist > 9 ? dir * 0.6 : 0;
        if (beat % 22 < 2) acts.special = true;
        break;
      }
      case 'shield': {
        acts.shield = beat < 16;
        ax = 0;
        break;
      }
      case 'spotdodge': {
        acts.shield = beat < 4;
        ay = beat < 4 ? -1 : 0;
        break;
      }
      case 'roll': {
        acts.shield = beat < 4;
        ax = beat < 4 ? -dir : 0;
        smashX = beat < 2 ? -dir : 0;
        break;
      }
      case 'edgeguard': {
        const side = t.x < 0 ? -1 : 1;
        const want = side < 0 ? edge.left + 0.9 : edge.right - 0.9;
        ax = Math.abs(f.x - want) > 0.5 ? Math.sign(want - f.x) * 0.7 : 0;
        if (Math.abs(f.x - want) < 0.8 && beat % 18 < 2) {
          if (f.hasMove('nspecial') && rnd() < 0.4) acts.special = true;
          else { acts.attack = true; ax = side * 0.8; }
        }
        break;
      }
      default: {
        // idle fidget so low levels look human
        ax = Math.sin(this.match.frame / 40 + this.f.index) * 0.3;
        break;
      }
    }

    // never walk into the blast zone
    if (f.grounded) {
      if (f.x < edge.left + 0.6 && ax < 0) ax = 0.6;
      if (f.x > edge.right - 0.6 && ax > 0) ax = -0.6;
    }
    // low levels drop inputs
    if (this.level <= 2 && rnd() < 0.35) { ax *= 0.4; for (const k in acts) acts[k] = false; }
    c.set(ax, ay, acts, { smashX, smashY });
  }

  /** Fly home: drift in, double jump, then up-B, aiming at the ledge. */
  recover(c, edge) {
    const f = this.f;
    const toStage = f.x < edge.left ? 1 : -1;
    const targetX = f.x < edge.left ? edge.left : edge.right;
    const belowLip = f.y < edge.y - 0.6;
    const acts = {};
    let ay = 0;
    const beat = this.holdT++;
    // save the jump/up-B until we're close enough to convert it
    const far = Math.abs(f.x - targetX) > 5;
    if (!f.helpless) {
      if (belowLip && f.jumps > 0 && (!far || f.y < edge.y - 4) && beat % 12 < 2) {
        acts.jump = true;
      } else if (belowLip && f.jumps <= 0 && f.hasMove('uspecial') && beat % 10 < 2) {
        acts.special = true;
        ay = 1;
      }
    }
    // aim slightly into the wall so the ledge grab triggers
    c.set(toStage * (far ? 1 : 0.72), ay, acts);
  }
}
