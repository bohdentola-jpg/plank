// Global tunables. Distances are logical pixels on the 800x600 stage,
// time is frames at 60 per second.

export const W = 800;
export const H = 600;
export const FPS = 60;
export const VERSION = '1.0';

export const G = {
  // --- hit feel ---
  hitlagBase: 3,          // frames of freeze on every hit...
  hitlagPerDmg: 0.36,     // ...plus this per point of damage
  hitlagMax: 22,
  kbVel: 0.108,           // launch speed (px/frame) per unit of knockback
  kbDecay: 0.2,           // launch speed lost per frame
  hitstunMul: 0.4,        // hitstun frames per unit of knockback
  tumbleKB: 78,           // knockback above this sends you tumbling
  diMax: 0.3,             // radians you can bend a launch by holding a direction
  bounceKeep: 0.75,       // speed kept when a tumbling body hits a wall/ceiling

  // --- shield ---
  shieldMax: 55,
  shieldDrain: 0.13,
  shieldRegen: 0.075,
  shieldDmgMul: 0.8,
  shieldBreakStun: 300,
  perfectShieldFrames: 3,

  // --- ledge / respawn ---
  ledgeInvuln: 26,
  ledgeMaxHang: 300,
  ledgeCooldown: 28,
  respawnDelay: 80,
  respawnInvuln: 130,
  respawnHover: 300,

  // --- input ---
  buffer: 7,              // frames a button press is remembered
  tapWindow: 4,           // frames a stick flick counts as a "tap"

  // --- defaults a fighter inherits unless its file overrides them ---
  stats: {
    weight: 100,
    walk: 2.3,
    dash: 5.6,            // initial dash burst
    run: 5.0,
    traction: 0.42,
    airSpeed: 3.5,
    airAccel: 0.26,
    airFriction: 0.045,
    gravity: 0.36,
    fall: 7.4,
    fastFall: 11,
    jump: 10.6,           // full hop launch speed
    hop: 6.6,             // short hop
    djump: 9.8,           // air jump
    airJumps: 1,
    jumpSquat: 4,
    landLag: 3,
    dashFrames: 11,
    rollSpeed: 5.2,
    w: 30,                // collision box
    h: 60,
  },
};

// The four player colours (ring under the feet, HUD plate, cursor).
export const PLAYER_COLORS = ['#e8402a', '#2f7fe0', '#f2b81c', '#35a84a'];
export const PLAYER_DARK = ['#8f1d10', '#184a8c', '#9a6d00', '#1b6a2b'];
export const CPU_COLOR = '#8b8f98';
