// Move data DSL + the knockback math every hit runs through.
//
// A move is pure data: frame windows, hitbox offsets, damage, knockback. The
// fighter state machine reads it; combat.js resolves it. Nothing here touches
// three.js or the DOM, so the whole fight sim runs headless in node.
//
// Frames are 60 Hz. Facing-relative X: a hitbox at x:+1 is 1 unit in FRONT of
// the fighter, mirrored automatically when they turn around.

export const STEP = 1 / 60;

/** Sentinel angle: shallow when knockback is low, 44° once it's big (Sakurai angle). */
export const SAKURAI = 361;

// Knockback tuning. Raised launch factor over Melee's because our stage is
// small in world units — these numbers give kills around 110-150% off a strong
// smash from center stage, and jabs that combo instead of launching.
export const LAUNCH = 0.16;     // knockback units → units/s
export const HITSTUN = 0.4;     // knockback units → frames of hitstun
export const KB_DRAG = 0.978;   // per-frame decay of launch velocity
export const HITSTUN_GRAV = 0.62; // gravity scale while in hitstun

/**
 * Melee-flavoured knockback.
 * p = victim percent AFTER the hit, d = damage dealt, w = victim weight.
 */
export function knockback(d, p, w, base, growth) {
  const kb = (((p / 10 + (p * d) / 20) * 1.4 * (200 / (w + 100)) + 18) * (growth / 100)) + base;
  return Math.max(0, kb);
}

/** Freeze frames on contact: heavier hits bite harder. */
export function hitlagFrames(d, mult = 1) {
  return Math.max(2, Math.round((3 + d * 0.62) * mult));
}

/** Resolve an angle spec into a unit launch vector. dir = +1 right, -1 left. */
export function launchVector(angle, kb, dir, out = { x: 0, y: 0 }) {
  let a = Number.isFinite(angle) ? angle : 45;
  if (a === SAKURAI) {
    // low knockback skims along the ground, big knockback pops up to 44°
    a = kb < 60 ? 0 : kb > 130 ? 44 : ((kb - 60) / 70) * 44;
  }
  const r = (a * Math.PI) / 180;
  out.x = Math.cos(r) * dir;
  out.y = Math.sin(r);
  return out;
}

/** Normalize one hitbox spec, filling in defaults. */
export function hit(spec) {
  return {
    start: spec.start ?? 1,
    end: spec.end ?? (spec.start ?? 1) + 2,
    x: spec.x ?? 0.8,
    y: spec.y ?? 0.9,
    r: spec.r ?? 0.5,
    dmg: spec.dmg ?? 5,
    angle: spec.angle ?? SAKURAI,
    kbBase: spec.kbBase ?? 20,
    kbGrowth: spec.kbGrowth ?? 90,
    hitlag: spec.hitlag ?? 1,
    shieldDmg: spec.shieldDmg ?? 0,
    group: spec.group ?? 0,
    sfx: spec.sfx ?? 'punch',
    fx: spec.fx ?? 'spark',
    // a hitbox that grabs instead of launching (command grabs, suplexes)
    grabHit: spec.grabHit ?? null,
    // 'set' knockback ignores the victim's percent (multi-hit drills, pummels)
    setKb: spec.setKb ?? 0,
    // hits that don't turn the victim around (windboxes, tiny pokes)
    noFlip: !!spec.noFlip,
    absorb: !!spec.absorb,
  };
}

/** Normalize a move spec. Everything the state machine needs, defaulted. */
export function mv(spec) {
  const hits = (spec.hits || []).map(hit);
  const frames = spec.frames ?? (hits.length ? Math.max(...hits.map((h) => h.end)) + 12 : 20);
  return {
    name: spec.name ?? null,
    clip: spec.clip ?? null,
    frames,
    iasa: spec.iasa ?? frames,
    charge: spec.charge ?? null,
    landCancel: !!spec.landCancel,
    landLag: spec.landLag ?? 0,
    autoCancel: spec.autoCancel ?? null,
    gravityMul: spec.gravityMul ?? 1,
    driftMul: spec.driftMul ?? 1,
    // move-driven movement: [{frame, vx, vy, kill}] — kill zeroes existing velocity first
    momentum: spec.momentum ?? null,
    armor: spec.armor ?? null,
    invuln: spec.invuln ?? null,
    intangibleHurt: spec.intangibleHurt ?? null,
    counter: spec.counter ?? null,
    reflect: spec.reflect ?? null,
    spawn: spec.spawn ?? null,
    hits,
    // specials
    air: spec.air ?? 'both',          // 'ground' | 'air' | 'both'
    grounded: spec.grounded ?? null,  // force fighter to the ground during the move
    lands: spec.lands !== false,      // false = keeps going through the ground state change
    helpless: !!spec.helpless,        // up-B: fall helpless afterwards
    resetJumps: !!spec.resetJumps,
    hangs: !!spec.hangs,              // can grab a ledge during the move
    turn: spec.turn ?? false,         // allow facing flip on startup
    sfxStart: spec.sfxStart ?? null,
    voice: spec.voice ?? null,
    fxStart: spec.fxStart ?? null,
    stall: spec.stall ?? null,        // {frame, vy} — hover/stall for recovery moves
    loop: spec.loop ?? null,          // {from, to, holdBtn} — held multi-hit specials
    slide: spec.slide ?? null,        // per-frame traction override
    noShield: !!spec.noShield,        // unblockable (command grabs)
    kind: spec.kind ?? 'attack',      // 'attack' | 'grab' | 'throw' | 'special'
    finisher: !!spec.finisher,
    // throws carry their launch data on the move itself (no hitbox scan)
    release: spec.release ?? null,
    dmg: spec.dmg ?? null,
    angle: spec.angle ?? null,
    kbBase: spec.kbBase ?? null,
    kbGrowth: spec.kbGrowth ?? null,
  };
}

/** Grab/throw shorthand: throws launch from a fixed vector, no hitbox scan. */
export function throwMv(spec) {
  return mv({
    kind: 'throw',
    clip: spec.clip,
    frames: spec.frames ?? 30,
    release: spec.release ?? 12,
    ...spec,
    hits: [],
  });
}

// ---------------------------------------------------------------- archetypes
// Sane, complete default movesets. Character files spread one of these and then
// override the moves that give them their identity. This keeps 12 fighters
// consistent to fight against without hand-authoring 250 hitboxes.

const jabSet = (dmg, reach, speed) => ({
  jab1: mv({
    clip: 'jab1', frames: Math.round(16 * speed), iasa: Math.round(13 * speed),
    hits: [hit({ start: Math.round(3 * speed), end: Math.round(5 * speed), x: reach, y: 1.0, r: 0.42, dmg, angle: SAKURAI, kbBase: 14, kbGrowth: 22, sfx: 'punch' })],
  }),
  jab2: mv({
    clip: 'jab2', frames: Math.round(17 * speed), iasa: Math.round(14 * speed),
    hits: [hit({ start: Math.round(3 * speed), end: Math.round(5 * speed), x: reach + 0.06, y: 1.0, r: 0.42, dmg: dmg + 1, angle: SAKURAI, kbBase: 15, kbGrowth: 24, sfx: 'punch' })],
  }),
  jab3: mv({
    clip: 'jab3', frames: Math.round(26 * speed), iasa: Math.round(22 * speed),
    hits: [hit({ start: Math.round(5 * speed), end: Math.round(8 * speed), x: reach + 0.14, y: 1.0, r: 0.5, dmg: dmg + 3, angle: 40, kbBase: 40, kbGrowth: 62, hitlag: 1.15, sfx: 'thwack' })],
  }),
});

const grabSet = (reach, pummelDmg) => ({
  grab: mv({
    kind: 'grab', clip: 'grab', frames: 30, iasa: 30,
    hits: [hit({ start: 7, end: 9, x: reach, y: 1.0, r: 0.44, dmg: 0, grabHit: { hold: true }, sfx: 'punch' })],
  }),
  pummel: mv({
    clip: 'pummel', frames: 16, iasa: 16,
    hits: [hit({ start: 3, end: 4, x: 0.4, y: 1.0, r: 0.3, dmg: pummelDmg, setKb: 0, kbBase: 0, kbGrowth: 0, sfx: 'punch', hitlag: 0.7 })],
  }),
  throwF: throwMv({ clip: 'throwF', frames: 28, release: 12, dmg: 8, angle: 45, kbBase: 60, kbGrowth: 62 }),
  throwB: throwMv({ clip: 'throwB', frames: 32, release: 16, dmg: 9, angle: 135, kbBase: 62, kbGrowth: 60 }),
  throwU: throwMv({ clip: 'throwU', frames: 28, release: 11, dmg: 7, angle: 88, kbBase: 58, kbGrowth: 68 }),
  throwD: throwMv({ clip: 'throwD', frames: 32, release: 14, dmg: 8, angle: 78, kbBase: 42, kbGrowth: 52 }),
});

export function archetype(kind) {
  if (kind === 'speedster') {
    return {
      ...jabSet(2, 0.62, 0.82),
      ...grabSet(0.72, 2),
      ftilt: mv({ clip: 'ftilt', frames: 22, iasa: 18, hits: [hit({ start: 4, end: 6, x: 0.85, y: 0.95, r: 0.46, dmg: 7, angle: 361, kbBase: 22, kbGrowth: 78, sfx: 'thwack' })] }),
      utilt: mv({ clip: 'utilt', frames: 22, iasa: 18, hits: [hit({ start: 4, end: 7, x: 0.2, y: 1.85, r: 0.55, dmg: 6, angle: 95, kbBase: 26, kbGrowth: 84 })] }),
      dtilt: mv({ clip: 'dtilt', frames: 20, iasa: 16, hits: [hit({ start: 4, end: 6, x: 0.85, y: 0.28, r: 0.42, dmg: 6, angle: 12, kbBase: 18, kbGrowth: 62 })] }),
      dashAttack: mv({ clip: 'dashAttack', frames: 30, iasa: 26, momentum: [{ frame: 1, vx: 8, kill: true }], hits: [hit({ start: 5, end: 9, x: 0.8, y: 0.9, r: 0.6, dmg: 9, angle: 40, kbBase: 40, kbGrowth: 62, sfx: 'thwack' })] }),
      fsmash: mv({ clip: 'fsmash', frames: 38, iasa: 34, charge: { maxFrames: 45, dmgMult: 1.38, kbMult: 1.12 }, hits: [hit({ start: 9, end: 12, x: 1.05, y: 1.0, r: 0.56, dmg: 13, angle: 38, kbBase: 32, kbGrowth: 98, hitlag: 1.2, sfx: 'heavy', fx: 'slash' })] }),
      usmash: mv({ clip: 'usmash', frames: 38, iasa: 34, charge: { maxFrames: 45, dmgMult: 1.38, kbMult: 1.12 }, hits: [hit({ start: 8, end: 12, x: 0.15, y: 2.1, r: 0.7, dmg: 13, angle: 90, kbBase: 30, kbGrowth: 100, hitlag: 1.2, sfx: 'heavy' })] }),
      dsmash: mv({ clip: 'dsmash', frames: 40, iasa: 36, charge: { maxFrames: 45, dmgMult: 1.38, kbMult: 1.12 }, hits: [hit({ start: 8, end: 10, x: 0.95, y: 0.3, r: 0.55, dmg: 12, angle: 26, kbBase: 30, kbGrowth: 92, sfx: 'heavy' }), hit({ start: 14, end: 16, x: -0.95, y: 0.3, r: 0.55, dmg: 11, angle: 26, kbBase: 30, kbGrowth: 90, group: 1, sfx: 'heavy' })] }),
      nair: mv({ clip: 'nair', frames: 32, landCancel: true, landLag: 8, iasa: 30, hits: [hit({ start: 4, end: 10, x: 0.25, y: 1.0, r: 0.78, dmg: 8, angle: 361, kbBase: 20, kbGrowth: 74 })] }),
      fair: mv({ clip: 'fair', frames: 32, landCancel: true, landLag: 10, iasa: 30, hits: [hit({ start: 6, end: 9, x: 1.0, y: 1.1, r: 0.55, dmg: 9, angle: 42, kbBase: 24, kbGrowth: 88, sfx: 'slash', fx: 'slash' })] }),
      bair: mv({ clip: 'bair', frames: 30, landCancel: true, landLag: 9, iasa: 28, hits: [hit({ start: 5, end: 8, x: -0.95, y: 1.0, r: 0.55, dmg: 10, angle: 40, kbBase: 26, kbGrowth: 92, sfx: 'thwack' })] }),
      uair: mv({ clip: 'uair', frames: 28, landCancel: true, landLag: 8, iasa: 26, hits: [hit({ start: 4, end: 7, x: 0.15, y: 2.0, r: 0.6, dmg: 8, angle: 88, kbBase: 20, kbGrowth: 88 })] }),
      dair: mv({ clip: 'dair', frames: 34, landCancel: true, landLag: 14, iasa: 32, hits: [hit({ start: 7, end: 11, x: 0.15, y: 0.15, r: 0.55, dmg: 10, angle: 270, kbBase: 20, kbGrowth: 40, sfx: 'heavy', fx: 'ring' })] }),
    };
  }
  if (kind === 'heavy') {
    return {
      ...jabSet(4, 0.9, 1.18),
      ...grabSet(0.95, 3),
      ftilt: mv({ clip: 'ftilt', frames: 30, iasa: 26, hits: [hit({ start: 7, end: 10, x: 1.05, y: 1.0, r: 0.6, dmg: 12, angle: 361, kbBase: 28, kbGrowth: 84, hitlag: 1.15, sfx: 'heavy' })] }),
      utilt: mv({ clip: 'utilt', frames: 30, iasa: 26, hits: [hit({ start: 7, end: 11, x: 0.25, y: 2.05, r: 0.72, dmg: 11, angle: 95, kbBase: 30, kbGrowth: 86, sfx: 'heavy' })] }),
      dtilt: mv({ clip: 'dtilt', frames: 28, iasa: 24, hits: [hit({ start: 6, end: 9, x: 1.0, y: 0.3, r: 0.55, dmg: 10, angle: 20, kbBase: 26, kbGrowth: 74, sfx: 'thwack' })] }),
      dashAttack: mv({ clip: 'dashAttack', frames: 38, iasa: 34, momentum: [{ frame: 1, vx: 7, kill: true }], hits: [hit({ start: 7, end: 12, x: 0.9, y: 1.0, r: 0.75, dmg: 14, angle: 45, kbBase: 46, kbGrowth: 70, hitlag: 1.2, sfx: 'heavy' })] }),
      fsmash: mv({ clip: 'fsmash', frames: 52, iasa: 48, charge: { maxFrames: 55, dmgMult: 1.42, kbMult: 1.14 }, hits: [hit({ start: 14, end: 18, x: 1.2, y: 1.05, r: 0.72, dmg: 22, angle: 36, kbBase: 38, kbGrowth: 104, hitlag: 1.4, sfx: 'heavy', fx: 'star' })] }),
      usmash: mv({ clip: 'usmash', frames: 50, iasa: 46, charge: { maxFrames: 55, dmgMult: 1.42, kbMult: 1.14 }, hits: [hit({ start: 13, end: 17, x: 0.2, y: 2.25, r: 0.85, dmg: 20, angle: 90, kbBase: 34, kbGrowth: 104, hitlag: 1.4, sfx: 'heavy' })] }),
      dsmash: mv({ clip: 'dsmash', frames: 52, iasa: 48, charge: { maxFrames: 55, dmgMult: 1.42, kbMult: 1.14 }, hits: [hit({ start: 12, end: 15, x: 0, y: 0.32, r: 1.25, dmg: 18, angle: 28, kbBase: 36, kbGrowth: 96, hitlag: 1.3, sfx: 'heavy', fx: 'ring' })] }),
      nair: mv({ clip: 'nair', frames: 40, landCancel: true, landLag: 14, iasa: 38, hits: [hit({ start: 7, end: 14, x: 0.2, y: 1.05, r: 0.9, dmg: 12, angle: 361, kbBase: 24, kbGrowth: 80, sfx: 'thwack' })] }),
      fair: mv({ clip: 'fair', frames: 42, landCancel: true, landLag: 18, iasa: 40, hits: [hit({ start: 12, end: 16, x: 1.1, y: 1.15, r: 0.68, dmg: 15, angle: 40, kbBase: 28, kbGrowth: 96, hitlag: 1.25, sfx: 'heavy' })] }),
      bair: mv({ clip: 'bair', frames: 38, landCancel: true, landLag: 15, iasa: 36, hits: [hit({ start: 9, end: 13, x: -1.05, y: 1.05, r: 0.65, dmg: 14, angle: 38, kbBase: 30, kbGrowth: 94, sfx: 'heavy' })] }),
      uair: mv({ clip: 'uair', frames: 36, landCancel: true, landLag: 13, iasa: 34, hits: [hit({ start: 8, end: 12, x: 0.2, y: 2.1, r: 0.72, dmg: 13, angle: 85, kbBase: 26, kbGrowth: 92, sfx: 'heavy' })] }),
      dair: mv({ clip: 'dair', frames: 44, landCancel: true, landLag: 22, iasa: 42, hits: [hit({ start: 10, end: 15, x: 0.2, y: 0.1, r: 0.7, dmg: 16, angle: 270, kbBase: 24, kbGrowth: 48, hitlag: 1.3, sfx: 'heavy', fx: 'ring' })] }),
    };
  }
  if (kind === 'zoner') {
    return {
      ...jabSet(3, 0.75, 1.0),
      ...grabSet(0.8, 2),
      ftilt: mv({ clip: 'ftilt', frames: 26, iasa: 22, hits: [hit({ start: 6, end: 9, x: 1.1, y: 1.0, r: 0.5, dmg: 9, angle: 361, kbBase: 24, kbGrowth: 82, sfx: 'zap', fx: 'zap' })] }),
      utilt: mv({ clip: 'utilt', frames: 26, iasa: 22, hits: [hit({ start: 5, end: 9, x: 0.2, y: 1.95, r: 0.62, dmg: 8, angle: 96, kbBase: 26, kbGrowth: 88 })] }),
      dtilt: mv({ clip: 'dtilt', frames: 24, iasa: 20, hits: [hit({ start: 5, end: 8, x: 0.95, y: 0.28, r: 0.48, dmg: 8, angle: 14, kbBase: 20, kbGrowth: 70 })] }),
      dashAttack: mv({ clip: 'dashAttack', frames: 34, iasa: 30, momentum: [{ frame: 1, vx: 6.5, kill: true }], hits: [hit({ start: 6, end: 10, x: 0.85, y: 0.95, r: 0.65, dmg: 11, angle: 44, kbBase: 42, kbGrowth: 64, sfx: 'zap', fx: 'zap' })] }),
      fsmash: mv({ clip: 'fsmash', frames: 44, iasa: 40, charge: { maxFrames: 50, dmgMult: 1.4, kbMult: 1.12 }, hits: [hit({ start: 12, end: 15, x: 1.25, y: 1.0, r: 0.6, dmg: 16, angle: 36, kbBase: 34, kbGrowth: 100, hitlag: 1.25, sfx: 'zap', fx: 'zap' })] }),
      usmash: mv({ clip: 'usmash', frames: 42, iasa: 38, charge: { maxFrames: 50, dmgMult: 1.4, kbMult: 1.12 }, hits: [hit({ start: 10, end: 14, x: 0.15, y: 2.15, r: 0.75, dmg: 15, angle: 90, kbBase: 32, kbGrowth: 102, hitlag: 1.25, sfx: 'zap' })] }),
      dsmash: mv({ clip: 'dsmash', frames: 44, iasa: 40, charge: { maxFrames: 50, dmgMult: 1.4, kbMult: 1.12 }, hits: [hit({ start: 10, end: 13, x: 0, y: 0.3, r: 1.05, dmg: 14, angle: 24, kbBase: 32, kbGrowth: 94, sfx: 'zap', fx: 'ring' })] }),
      nair: mv({ clip: 'nair', frames: 34, landCancel: true, landLag: 10, iasa: 32, hits: [hit({ start: 5, end: 12, x: 0.2, y: 1.0, r: 0.8, dmg: 9, angle: 361, kbBase: 22, kbGrowth: 76 })] }),
      fair: mv({ clip: 'fair', frames: 34, landCancel: true, landLag: 12, iasa: 32, hits: [hit({ start: 8, end: 11, x: 1.05, y: 1.1, r: 0.58, dmg: 11, angle: 42, kbBase: 24, kbGrowth: 90, sfx: 'zap', fx: 'zap' })] }),
      bair: mv({ clip: 'bair', frames: 32, landCancel: true, landLag: 11, iasa: 30, hits: [hit({ start: 7, end: 10, x: -1.0, y: 1.05, r: 0.58, dmg: 12, angle: 40, kbBase: 26, kbGrowth: 92 })] }),
      uair: mv({ clip: 'uair', frames: 30, landCancel: true, landLag: 9, iasa: 28, hits: [hit({ start: 5, end: 9, x: 0.15, y: 2.05, r: 0.65, dmg: 10, angle: 88, kbBase: 22, kbGrowth: 90 })] }),
      dair: mv({ clip: 'dair', frames: 36, landCancel: true, landLag: 16, iasa: 34, hits: [hit({ start: 8, end: 12, x: 0.15, y: 0.15, r: 0.58, dmg: 12, angle: 270, kbBase: 22, kbGrowth: 44, sfx: 'zap', fx: 'ring' })] }),
    };
  }
  // 'brawler' — the middleweight default
  return {
    ...jabSet(3, 0.72, 0.95),
    ...grabSet(0.82, 2),
    ftilt: mv({ clip: 'ftilt', frames: 25, iasa: 21, hits: [hit({ start: 5, end: 8, x: 0.95, y: 1.0, r: 0.5, dmg: 9, angle: 361, kbBase: 24, kbGrowth: 82, sfx: 'thwack' })] }),
    utilt: mv({ clip: 'utilt', frames: 24, iasa: 20, hits: [hit({ start: 5, end: 8, x: 0.22, y: 1.95, r: 0.62, dmg: 8, angle: 95, kbBase: 28, kbGrowth: 86 })] }),
    dtilt: mv({ clip: 'dtilt', frames: 22, iasa: 18, hits: [hit({ start: 5, end: 7, x: 0.9, y: 0.28, r: 0.46, dmg: 7, angle: 14, kbBase: 20, kbGrowth: 66 })] }),
    dashAttack: mv({ clip: 'dashAttack', frames: 32, iasa: 28, momentum: [{ frame: 1, vx: 7.2, kill: true }], hits: [hit({ start: 6, end: 10, x: 0.85, y: 0.95, r: 0.66, dmg: 11, angle: 44, kbBase: 42, kbGrowth: 66, sfx: 'thwack' })] }),
    fsmash: mv({ clip: 'fsmash', frames: 42, iasa: 38, charge: { maxFrames: 50, dmgMult: 1.4, kbMult: 1.12 }, hits: [hit({ start: 11, end: 14, x: 1.1, y: 1.0, r: 0.62, dmg: 17, angle: 36, kbBase: 34, kbGrowth: 100, hitlag: 1.3, sfx: 'heavy', fx: 'star' })] }),
    usmash: mv({ clip: 'usmash', frames: 42, iasa: 38, charge: { maxFrames: 50, dmgMult: 1.4, kbMult: 1.12 }, hits: [hit({ start: 10, end: 14, x: 0.18, y: 2.15, r: 0.76, dmg: 16, angle: 90, kbBase: 32, kbGrowth: 102, hitlag: 1.3, sfx: 'heavy' })] }),
    dsmash: mv({ clip: 'dsmash', frames: 44, iasa: 40, charge: { maxFrames: 50, dmgMult: 1.4, kbMult: 1.12 }, hits: [hit({ start: 9, end: 12, x: 0, y: 0.3, r: 1.1, dmg: 15, angle: 26, kbBase: 32, kbGrowth: 94, hitlag: 1.2, sfx: 'heavy', fx: 'ring' })] }),
    nair: mv({ clip: 'nair', frames: 34, landCancel: true, landLag: 10, iasa: 32, hits: [hit({ start: 5, end: 11, x: 0.22, y: 1.0, r: 0.82, dmg: 10, angle: 361, kbBase: 22, kbGrowth: 78 })] }),
    fair: mv({ clip: 'fair', frames: 34, landCancel: true, landLag: 12, iasa: 32, hits: [hit({ start: 8, end: 11, x: 1.05, y: 1.1, r: 0.6, dmg: 12, angle: 42, kbBase: 26, kbGrowth: 92, sfx: 'thwack' })] }),
    bair: mv({ clip: 'bair', frames: 32, landCancel: true, landLag: 11, iasa: 30, hits: [hit({ start: 6, end: 9, x: -1.0, y: 1.05, r: 0.6, dmg: 13, angle: 40, kbBase: 28, kbGrowth: 94, sfx: 'thwack' })] }),
    uair: mv({ clip: 'uair', frames: 30, landCancel: true, landLag: 9, iasa: 28, hits: [hit({ start: 5, end: 9, x: 0.18, y: 2.05, r: 0.66, dmg: 11, angle: 88, kbBase: 24, kbGrowth: 90 })] }),
    dair: mv({ clip: 'dair', frames: 38, landCancel: true, landLag: 16, iasa: 36, hits: [hit({ start: 9, end: 13, x: 0.18, y: 0.12, r: 0.62, dmg: 13, angle: 270, kbBase: 22, kbGrowth: 46, hitlag: 1.25, sfx: 'heavy', fx: 'ring' })] }),
  };
}

/** Universal defensive/utility move timings — same for everyone, like Smash. */
export const UNIVERSAL = {
  jumpsquat: 4,
  landLag: 4,
  hardLandLag: 10,
  shieldStunPerDmg: 0.45,
  shieldMax: 55,
  shieldRegen: 0.1,
  shieldDrain: 0.14,
  shieldBreakStun: 150,
  rollFrames: 32,
  rollInvuln: [4, 20],
  rollDist: 5.2,
  spotdodgeFrames: 26,
  spotdodgeInvuln: [3, 16],
  airdodgeFrames: 34,
  airdodgeInvuln: [4, 22],
  airdodgeSpeed: 11,
  grabHold: 60,          // base frames a grab holds at 0%
  grabMashFrames: 8,     // each mash shortens the hold
  ledgeHangInvuln: 30,
  ledgeGetup: 26,
  respawnInvuln: 110,
  tumbleThreshold: 80,   // knockback above this puts you in tumble (can't act immediately)
  diStrength: 0.30,      // how much the stick bends the launch angle
  crouchSlide: 0.55,
};
