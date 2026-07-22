// Shared combatant state: inventory, ammo, armor, damage. Player and Bot
// both extend this so the combat system can treat them identically.
import * as THREE from './three.js';
import { WEAPONS, KNIFE, GRENADES, GRENADE_ORDER, DEFAULT_LOADOUT } from './weapons.js';
import { G } from './state.js';

let nextId = 1;

export class Combatant {
  constructor(name, team) {
    this.id = nextId++;
    this.name = name;
    this.team = team;
    this.isPlayer = false;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.radius = 0.38;
    this.height = 1.85;
    this.eyeHeight = 1.62;
    this.crouched = false;
    this.grounded = true;
    this.walking = false;
    this.alive = true;
    this.health = 100;
    this.armor = 0;
    this.helmet = false;
    this.money = 800;
    this.kills = 0; this.deaths = 0;
    this.slot = 'secondary';
    this.grenadeSel = 0;
    this.flashedUntil = 0;
    this.tagFactor = 1;
    this.tagUntil = 0;
    this.nextFireTime = 0;
    this.recoilIndex = 0;
    this.fireInacc = 0;
    this.lastShotTime = -10;
    this.scoped = false;
    this.zoomLevel = 0;
    this.reloadEnd = 0;
    this.drawEnd = 0;
    this.burnTicks = 0;
    this.resetInventory();
  }

  resetInventory() {
    this.weapons = {
      primary: null,
      secondary: this.makeWeapon(DEFAULT_LOADOUT[this.team]),
      grenades: { he: 0, flash: 0, smoke: 0, molotov: 0, incendiary: 0, decoy: 0 },
    };
    this.slot = 'secondary';
    this.armor = 0;
    this.helmet = false;
  }

  makeWeapon(id) {
    const def = WEAPONS[id];
    return { id, def, ammo: def.mag, reserve: def.reserve };
  }

  currentWeapon() {
    if (this.slot === 'primary') return this.weapons.primary;
    if (this.slot === 'secondary') return this.weapons.secondary;
    return null; // knife or grenade
  }

  currentDef() {
    const w = this.currentWeapon();
    if (w) return w.def;
    if (this.slot === 'knife') return KNIFE;
    return null;
  }

  currentGrenadeId() {
    const owned = GRENADE_ORDER.filter((g) => this.weapons.grenades[g] > 0);
    if (!owned.length) return null;
    return owned[this.grenadeSel % owned.length];
  }

  maxSpeed() {
    if (this.slot === 'grenade') return 4.9;
    const def = this.currentDef();
    let s = def ? def.moveSpeed : 5.0;
    if (this.crouched) s *= 0.34;
    else if (this.walking) s *= 0.52;
    if (G.time < this.tagUntil) s *= this.tagFactor;
    if (this.scoped) s *= 0.55;
    return s;
  }

  eyePos(out) {
    out = out || new THREE.Vector3();
    return out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  viewDir(out) {
    out = out || new THREE.Vector3();
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  giveWeapon(id, ammo = null, reserve = null) {
    const def = WEAPONS[id];
    if (!def) return null;
    const inst = this.makeWeapon(id);
    if (ammo !== null) inst.ammo = ammo;
    if (reserve !== null) inst.reserve = reserve;
    const slot = def.class === 'pistol' ? 'secondary' : 'primary';
    const old = this.weapons[slot];
    this.weapons[slot] = inst;
    return old;
  }

  giveGrenade(id) {
    const g = GRENADES[id];
    if (this.weapons.grenades[id] >= g.maxCarry) return false;
    this.weapons.grenades[id]++;
    return true;
  }

  isBlind() { return G.time < this.flashedUntil; }
  blindFactor() {
    const rem = this.flashedUntil - G.time;
    if (rem <= 0) return 0;
    return Math.min(1, rem / 1.2);
  }

  resetForRound(spawn, keepGear) {
    this.alive = true;
    this.health = 100;
    this.pos.copy(spawn);
    this.vel.set(0, 0, 0);
    this.recoilIndex = 0; this.fireInacc = 0;
    this.flashedUntil = 0; this.tagUntil = 0;
    this.scoped = false; this.zoomLevel = 0;
    this.reloadEnd = 0; this.burnTicks = 0;
    if (!keepGear) this.resetInventory();
    else {
      // survivors keep guns; top up nothing, dead players were reset already
      if (this.weapons.primary) this.slot = 'primary';
      else this.slot = 'secondary';
    }
    if (!this.weapons.secondary) this.weapons.secondary = this.makeWeapon(DEFAULT_LOADOUT[this.team]);
  }
}
