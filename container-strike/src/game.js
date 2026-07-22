// Round state machine, team management, and the economy. Elimination rules:
// last team standing takes the round, first to 13 wins, sides swap at
// halftime. Money follows CS conventions: win reward, escalating loss bonus,
// per-weapon kill rewards, survivors keep their gear.
import * as THREE from './three.js';
import { G } from './state.js';
import { WEAPONS, GRENADES, EQUIPMENT, DEFAULT_LOADOUT } from './weapons.js';
import { Bot, BOT_NAMES } from './bots.js';
import { pick } from './util.js';

const FREEZE_TIME = 6, ROUND_TIME = 115, END_TIME = 5;
const WIN_MONEY = 3250, MAX_MONEY = 16000;
const LOSS_BONUS = [1400, 1900, 2400, 2900, 3400];
const HALF = 12, WIN_ROUNDS = 13;

const TIPS = [
  'Stop moving before you shoot — spread balloons while running.',
  'Tap the opposite movement key to counter-strafe to an instant stop.',
  'Recoil patterns are fixed. Pull down and against the sway to control sprays.',
  'Walk with SHIFT to silence your footsteps.',
  'Rifles wallbang container walls. Concrete stops everything.',
  'Low on cash? Save this round — force-buying into rifles loses money wars.',
  'Smokes block bot vision. Flashes blind whoever faces them.',
  'Molotovs deny ground. Smokes extinguish them.',
  'The AWP one-shots to the chest, but you walk slower carrying it.',
  'Buy armor before upgrading your pistol — aim duels favor the vested.',
];

export class Game {
  constructor() {
    this.phase = 'warmup';
    this.phaseEnd = 0;
    this.round = 0;
    this.scores = { CT: 0, T: 0 };
    this.lossStreak = { CT: 0, T: 0 };
    this.liveStart = 0;
    this.roundEndPending = 0;
    this.matchOver = false;
  }

  setupMatch(playerTeam) {
    // clear old bots
    for (const b of G.bots) G.scene.remove(b.mesh);
    G.bots.length = 0;
    G.player.team = playerTeam;
    G.player.money = 800;
    G.player.kills = 0; G.player.deaths = 0;
    G.player.resetInventory();
    const enemyTeam = playerTeam === 'CT' ? 'T' : 'CT';
    for (let i = 0; i < 4; i++) G.bots.push(new Bot(BOT_NAMES[playerTeam][i], playerTeam));
    for (let i = 0; i < 5; i++) G.bots.push(new Bot(BOT_NAMES[enemyTeam][i], enemyTeam));
    this.scores = { CT: 0, T: 0 };
    this.lossStreak = { CT: 0, T: 0 };
    this.round = 0;
    this.matchOver = false;
    G.combat.clearDecals();
    this.startRound(true);
  }

  everyone() { return [G.player, ...G.bots]; }
  teamOf(team) { return this.everyone().filter((e) => e.team === team); }
  aliveOf(team) { return this.teamOf(team).filter((e) => e.alive); }

  startRound(fresh = false) {
    this.round++;
    this.phase = 'freeze';
    this.phaseEnd = G.time + FREEZE_TIME;
    this.roundEndPending = 0;
    G.grenades.clearAll();
    G.combat.clearRoundFX();
    G.combat.clearDrops();
    G.audio.stopEarRing();
    // spawns
    const spawnIdx = { CT: 0, T: 0 };
    for (const ent of this.everyone()) {
      const list = G.world.spawns[ent.team];
      const spawn = list[spawnIdx[ent.team]++ % list.length];
      const keepGear = ent.alive && !fresh;
      ent.resetForRound(new THREE.Vector3(spawn.x, 0, spawn.z), keepGear);
      ent.yaw = ent.team === 'CT' ? Math.PI : 0; // face the middle
      ent.pitch = 0;
    }
    for (const b of G.bots) b.buyRound();
    if (G.player.isPlayer) {
      G.combat.viewModel.switchTo(G.player.currentWeapon().id);
      G.player.spectating = null;
    }
    G.hud.announce(`ROUND ${this.round}`, this.round === HALF + 1 ? 'SECOND HALF' : '');
    G.hud.tip(pick(TIPS) + '  —  [B] BUY');
    G.hud.refreshAll();
    G.audio.announce('start');
  }

  movementFrozen() { return this.phase === 'freeze'; }
  canFight() { return this.phase === 'live' || this.phase === 'end'; }

  buyAllowed(ent) {
    if (this.phase === 'freeze') { /* ok */ }
    else if (this.phase === 'live' && G.time - this.liveStart < 10) { /* ok */ }
    else return false;
    const c = G.world.spawnCenter[ent.team];
    return Math.hypot(ent.pos.x - c.x, ent.pos.z - c.z) < 16;
  }

  // ------------------------------------------------------------- purchases
  buyWeapon(ent, id) {
    const def = WEAPONS[id];
    if (!def || !this.buyAllowed(ent)) return this._deny();
    if (def.team && def.team !== ent.team) return this._deny();
    if (ent.money < def.price) return this._deny();
    ent.money -= def.price;
    const old = ent.giveWeapon(id);
    if (old && old.id !== DEFAULT_LOADOUT[ent.team]) G.combat.spawnDrop(old, ent.pos.clone().add(new THREE.Vector3(0.5, 0.5, 0)));
    const slot = def.class === 'pistol' ? 'secondary' : 'primary';
    ent.slot = slot;
    if (ent.isPlayer) {
      G.combat.viewModel.switchTo(id);
      ent.drawEnd = G.time + 0.4;
      G.audio.ui('buy');
      G.hud.refreshAll();
    }
    return true;
  }

  buyGrenade(ent, gid) {
    const def = GRENADES[gid];
    if (!def || !this.buyAllowed(ent)) return this._deny();
    if (def.team && def.team !== ent.team) return this._deny();
    if (ent.money < def.price) return this._deny();
    if (!ent.giveGrenade(gid)) return this._deny();
    ent.money -= def.price;
    if (ent.isPlayer) { G.audio.ui('buy'); G.hud.refreshAll(); }
    return true;
  }

  buyArmor(ent, full) {
    if (!this.buyAllowed(ent)) return this._deny();
    let cost;
    if (full) cost = ent.armor === 100 && !ent.helmet ? EQUIPMENT.helmet.upgradePrice : EQUIPMENT.helmet.price;
    else cost = EQUIPMENT.kevlar.price;
    if (full && ent.helmet && ent.armor === 100) return this._deny();
    if (!full && ent.armor === 100) return this._deny();
    if (ent.money < cost) return this._deny();
    ent.money -= cost;
    ent.armor = 100;
    if (full) ent.helmet = true;
    if (ent.isPlayer) { G.audio.ui('buy'); G.hud.refreshAll(); }
    return true;
  }

  _deny() { G.audio.ui('deny'); return false; }

  // ------------------------------------------------------------- kills
  onKill(attacker, victim, def, headshot) {
    G.hud.killfeed(attacker, victim, def, headshot);
    if (victim.isPlayer) G.hud.announce('YOU DIED', 'watching teammates — click to cycle');
    G.hud.refreshAll();
    if (this.phase === 'live' && !this.roundEndPending) {
      if (this.aliveOf('CT').length === 0 || this.aliveOf('T').length === 0) {
        this.roundEndPending = G.time + 1.2;
      }
    }
  }

  endRound(winner) {
    this.phase = 'end';
    this.phaseEnd = G.time + END_TIME;
    if (winner) {
      this.scores[winner]++;
      const loser = winner === 'CT' ? 'T' : 'CT';
      this.lossStreak[loser] = Math.min(LOSS_BONUS.length, this.lossStreak[loser] + 1);
      this.lossStreak[winner] = Math.max(0, this.lossStreak[winner] - 1);
      for (const e of this.teamOf(winner)) e.money = Math.min(MAX_MONEY, e.money + WIN_MONEY);
      const bonus = LOSS_BONUS[this.lossStreak[loser] - 1];
      for (const e of this.teamOf(loser)) e.money = Math.min(MAX_MONEY, e.money + bonus);
      const label = winner === 'CT' ? 'COUNTER-TERRORISTS WIN' : 'TERRORISTS WIN';
      G.hud.announce(label, `$${WIN_MONEY} win · $${bonus} loss bonus`);
      G.audio.announce(winner === G.player.team ? 'win' : 'lose');
    } else {
      for (const e of this.everyone()) e.money = Math.min(MAX_MONEY, e.money + 1400);
      G.hud.announce('ROUND DRAW', 'time expired');
      G.audio.announce('lose');
    }
    G.hud.refreshAll();
  }

  update(dt) {
    if (this.phase === 'warmup' || this.matchOver) return;
    if (this.roundEndPending && G.time > this.roundEndPending && this.phase === 'live') {
      const ctAlive = this.aliveOf('CT').length, tAlive = this.aliveOf('T').length;
      this.endRound(ctAlive > 0 && tAlive === 0 ? 'CT' : tAlive > 0 && ctAlive === 0 ? 'T' : ctAlive === tAlive ? null : (ctAlive > tAlive ? 'CT' : 'T'));
      this.roundEndPending = 0;
      return;
    }
    if (G.time < this.phaseEnd) return;
    if (this.phase === 'freeze') {
      this.phase = 'live';
      this.liveStart = G.time;
      this.phaseEnd = G.time + ROUND_TIME;
      G.hud.announce('GO GO GO', '');
      setTimeout(() => G.hud.announce('', ''), 1200);
    } else if (this.phase === 'live') {
      // timeout
      const ctAlive = this.aliveOf('CT').length, tAlive = this.aliveOf('T').length;
      this.endRound(ctAlive === tAlive ? null : ctAlive > tAlive ? 'CT' : 'T');
    } else if (this.phase === 'end') {
      if (this.scores.CT >= WIN_ROUNDS || this.scores.T >= WIN_ROUNDS) { this.finishMatch(); return; }
      if (this.round === HALF) this.halftime();
      this.startRound(this.round === HALF && this._justSwapped);
      this._justSwapped = false;
    }
  }

  halftime() {
    // swap everyone's side; economy and inventory reset
    for (const ent of this.everyone()) {
      ent.team = ent.team === 'CT' ? 'T' : 'CT';
      ent.money = 800;
      ent.alive = false; // force full reset in startRound
    }
    const s = this.scores.CT; this.scores.CT = this.scores.T; this.scores.T = s;
    const l = this.lossStreak.CT; this.lossStreak.CT = this.lossStreak.T; this.lossStreak.T = l;
    for (const b of G.bots) { G.scene.remove(b.mesh); b.buildBody(); }
    this._justSwapped = true;
    G.hud.announce('SWITCHING SIDES', 'first to 13 wins');
  }

  finishMatch() {
    this.matchOver = true;
    const playerWon = this.scores[G.player.team] >= WIN_ROUNDS;
    G.hud.showMatchEnd(playerWon, this.scores, G.player.team);
  }

  timeLeft() {
    return Math.max(0, this.phaseEnd - G.time);
  }
}
