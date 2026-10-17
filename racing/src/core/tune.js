// Live driving tunables, for the dev menu (core/devmenu.js). TUNE is a plain
// object the game reads every step, so a change takes effect at once.
// TUNE_DEFS lists them in menu order: { key, group, label, min, max, step,
// def, unit?, fmt?, desc } (a switch has a true/false def and no range).
// Every default is the constant it stands in for, or a ×1 / +0, so an
// untouched TUNE drives exactly the stock game.
//
// Who reads them:
//   DRIFT, SPEED & GRIP, STEERING  car/physics.js, for the car a human drives
//     (the AI keeps the stock numbers its plans are made for, and so do the
//     garage's measured stats)
//   CAMERA      race/camera.js (the chase camera)
//   COLLISIONS  car/physics.js (hitWall, collideCars), race/sim.js, race/traffic.js
//   MISC        main.js (game speed), core/devmenu.js (telemetry)
//
// Changes are saved in localStorage (store key 'tune'): only the values that
// differ from their defaults, so a key that has gone is dropped and a new one
// starts at its default.
import { store, settings } from './settings.js';
import { clamp } from './util.js';

const DEG = Math.PI / 180;

export const TUNE_GROUPS = ['DRIFT', 'SPEED & GRIP', 'STEERING', 'CAMERA', 'COLLISIONS', 'MISC'];

export const TUNE_DEFS = [
  // ---------------------------------------------------------------- drift
  { key: 'driftAngle', group: 'DRIFT', label: 'DRIFT ANGLE', min: 0.3, max: 2.5, step: 0.05, def: 1, unit: '×', desc: 'How far the tail hangs out for the stick you give it (up to MAX ANGLE).' },
  { key: 'driftMaxAngle', group: 'DRIFT', label: 'MAX ANGLE', min: 0.17, max: 1.22, step: DEG, def: 0.52, unit: 'rad', fmt: (v) => `${(v / DEG).toFixed(1)}°`, desc: 'The most angle a drift will hang, whatever the stick asks for.' },
  { key: 'driftSnap', group: 'DRIFT', label: 'SNAP', min: 0.3, max: 3, step: 0.05, def: 1, unit: '×', desc: 'How fast the car swings to its angle: the stiffness of the angle\'s spring.' },
  { key: 'driftDamping', group: 'DRIFT', label: 'DAMPING', min: 0.1, max: 1.5, step: 0.05, def: 0.65, unit: 'ζ', desc: 'How the swing settles while held: low wobbles past the angle, 1 and up comes in clean.' },
  { key: 'driftLine', group: 'DRIFT', label: 'LINE', min: 0.3, max: 2.5, step: 0.05, def: 1, unit: '×', desc: 'How tight the drifting line bends for the stick (past grip: the arcade bite).' },
  { key: 'driftKick', group: 'DRIFT', label: 'ENTRY KICK', min: 0, max: 3, step: 0.05, def: 1.15, unit: 'rad/s', desc: 'The flick of yaw that throws the tail out as a drift starts.' },
  { key: 'driftMinSpeed', group: 'DRIFT', label: 'MIN SPEED', min: 0, max: 30, step: 0.5, def: 9, unit: 'm/s', fmt: (v) => `${v.toFixed(1)} m/s · ${speedIn(v)}`, desc: 'The speed a drift can start from (brake and steer below it is just braking).' },
  { key: 'driftArmTime', group: 'DRIFT', label: 'ARM TIME', min: 0, max: 0.5, step: 0.01, def: 0.05, unit: 's', desc: 'How long brake and steer are held before it kicks (the handbrake skips the wait).' },
  { key: 'driftKeyTighten', group: 'DRIFT', label: 'KEYS: TIGHTEN', min: 0.2, max: 6, step: 0.1, def: 1.3, unit: '/s', desc: 'Keys and d-pad: how fast holding into the turn tightens the drift.' },
  { key: 'driftKeyLoosen', group: 'DRIFT', label: 'KEYS: LOOSEN', min: 0.2, max: 6, step: 0.1, def: 2.2, unit: '/s', desc: 'Keys and d-pad: how fast the other way opens the drift up.' },
  { key: 'driftScrub', group: 'DRIFT', label: 'SPEED SCRUB', min: 0, max: 3, step: 0.05, def: 1, unit: '×', desc: 'The speed a drift bleeds: its angle, the held brake, coming straight. 0 keeps it all.' },
  // ---------------------------------------------------------------- speed & grip
  { key: 'power', group: 'SPEED & GRIP', label: 'POWER', min: 0.25, max: 4, step: 0.05, def: 1, unit: '×', desc: 'Engine torque, on top of the car and its parts.' },
  { key: 'grip', group: 'SPEED & GRIP', label: 'GRIP', min: 0.3, max: 2.5, step: 0.05, def: 1, unit: '×', desc: 'Tire friction: cornering, braking, traction and the drifting line.' },
  { key: 'brakes', group: 'SPEED & GRIP', label: 'BRAKES', min: 0.2, max: 3, step: 0.05, def: 1, unit: '×', desc: 'Brake force (the tires still have the last word).' },
  { key: 'drag', group: 'SPEED & GRIP', label: 'AERO DRAG', min: 0, max: 3, step: 0.05, def: 1, unit: '×', desc: 'Air resistance: less drag, higher top speed.' },
  { key: 'nitroPower', group: 'SPEED & GRIP', label: 'NITROUS POWER', min: 0, max: 4, step: 0.1, def: 1, unit: '×', desc: 'The extra thrust a shot of nitrous adds.' },
  { key: 'nitroDuration', group: 'SPEED & GRIP', label: 'NITROUS TANK', min: 0.25, max: 5, step: 0.05, def: 1, unit: '×', desc: 'How long a full tank lasts.' },
  { key: 'gravity', group: 'SPEED & GRIP', label: 'GRAVITY', min: 2, max: 20, step: 0.1, def: 9.81, unit: 'm/s²', desc: 'Weight, and with it grip and braking, and how the car flies off a crest.' },
  // ---------------------------------------------------------------- steering
  { key: 'steerLock', group: 'STEERING', label: 'LOCK', min: 0.3, max: 2.5, step: 0.05, def: 1, unit: '×', desc: 'How far the front wheels turn at full stick.' },
  { key: 'steerRate', group: 'STEERING', label: 'STEERING SPEED', min: 0.25, max: 4, step: 0.05, def: 1, unit: '×', desc: 'How quickly the front wheels follow the stick.' },
  { key: 'steerSpeedFade', group: 'STEERING', label: 'SPEED FADE', min: 4, max: 80, step: 1, def: 24, unit: 'm/s', desc: 'Speed-sensitive lock: it halves at 6 m/s plus this. Higher keeps more lock at speed.' },
  { key: 'counterSteer', group: 'STEERING', label: 'COUNTERSTEER', min: 0, max: 3, step: 0.05, def: 1, unit: '×', desc: 'How hard the front wheels steer into a slide for you (0 is off).' },
  { key: 'steerLimiter', group: 'STEERING', label: 'LIMITER', min: 0.25, max: 5, step: 0.05, def: 1, unit: '×', desc: 'How far past the grip peak the wheels may point at speed (higher is looser).' },
  // ---------------------------------------------------------------- camera
  { key: 'camDist', group: 'CAMERA', label: 'DISTANCE', min: 0.4, max: 3, step: 0.05, def: 1, unit: '×', desc: 'How far behind the car the chase views sit.' },
  { key: 'camHeight', group: 'CAMERA', label: 'HEIGHT', min: 0.2, max: 4, step: 0.05, def: 1, unit: '×', desc: 'How high the chase views sit.' },
  { key: 'camFov', group: 'CAMERA', label: 'FIELD OF VIEW', min: -30, max: 40, step: 1, def: 0, unit: '°', fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}°`, desc: 'Added to every view\'s field of view.' },
  { key: 'camSpeedFov', group: 'CAMERA', label: 'SPEED FOV', min: 0, max: 50, step: 1, def: 18, unit: '°', desc: 'Extra field of view at full speed (about 135 mph).' },
  { key: 'camLag', group: 'CAMERA', label: 'FOLLOW RATE', min: 0.5, max: 30, step: 0.25, def: 5.5, unit: '/s', desc: 'How fast the chase view swings round behind the car (lower is lazier).' },
  { key: 'camLookAhead', group: 'CAMERA', label: 'LOOK AHEAD', min: 0, max: 30, step: 0.5, def: 4, unit: 'm', desc: 'How far ahead of the car the chase views aim.' },
  { key: 'camShake', group: 'CAMERA', label: 'SHAKE', min: 0, max: 4, step: 0.05, def: 1, unit: '×', desc: 'Speed rumble, kerbs and impacts.' },
  // ---------------------------------------------------------------- collisions
  { key: 'wallCollisions', group: 'COLLISIONS', label: 'WALLS', def: true, desc: 'Off: every car drives through walls and barriers (a ghost mode, for testing).' },
  { key: 'carCollisions', group: 'COLLISIONS', label: 'CAR CONTACT', def: true, desc: 'Off: the race cars pass through each other.' },
  { key: 'trafficCollisions', group: 'COLLISIONS', label: 'TRAFFIC CONTACT', def: true, desc: 'Off: the race cars pass through the traffic.' },
  { key: 'wallBounce', group: 'COLLISIONS', label: 'WALL BOUNCE', min: 0, max: 1, step: 0.01, def: 0.18, unit: '', desc: 'Restitution off a wall: 0 stops dead against it, 1 bounces right back.' },
  { key: 'wallFriction', group: 'COLLISIONS', label: 'WALL SCRAPE', min: 0, max: 4, step: 0.05, def: 1, unit: '×', desc: 'Friction sliding along a wall (lower slides on more freely).' },
  { key: 'carBounce', group: 'COLLISIONS', label: 'CAR BOUNCE', min: 0, max: 1, step: 0.01, def: 0.25, unit: '', desc: 'Restitution between cars (and the traffic).' },
  { key: 'crashSpin', group: 'COLLISIONS', label: 'CRASH SPIN', min: 0, max: 4, step: 0.05, def: 1, unit: '×', desc: 'The yaw a wall or car hit kicks into a car.' },
  // ---------------------------------------------------------------- misc
  { key: 'timeScale', group: 'MISC', label: 'GAME SPEED', min: 0.25, max: 2, step: 0.05, def: 1, unit: '×', desc: 'Slow motion or fast forward for the whole game (watch a drift at 0.25×).' },
  { key: 'telemetry', group: 'MISC', label: 'TELEMETRY', def: false, desc: 'A live readout while you drive: speed, drift angle and state, slip, gear, rpm, FPS.' },
];

export const TUNE_BY_KEY = Object.fromEntries(TUNE_DEFS.map((d) => [d.key, d]));

/** The stock values (what the AI and the garage's stats always drive on). */
export const TUNE_STOCK = Object.freeze(Object.fromEntries(TUNE_DEFS.map((d) => [d.key, d.def])));

/** The live values. */
export const TUNE = { ...TUNE_STOCK };

const isSwitch = (d) => typeof d.def === 'boolean';

function speedIn(ms) {
  return settings.get('units') === 'kmh' ? `${Math.round(ms * 3.6)} km/h` : `${Math.round(ms * 2.23694)} mph`;
}

/** Decimals a value shows with: enough for its step and its default. */
function decimals(d) {
  const dp = (x) => (String(x).split('.')[1] || '').length;
  return Math.min(3, Math.max(dp(d.step), dp(d.def)));
}

/** A value as the menu shows it, with its unit. */
export function tuneFormat(d, v = TUNE[d.key]) {
  if (isSwitch(d)) return v ? 'ON' : 'OFF';
  if (d.fmt) return d.fmt(v);
  const s = v.toFixed(decimals(d));
  return d.unit === '×' || d.unit === '°' ? s + d.unit : d.unit ? `${s} ${d.unit}` : s;
}

/** Is this key at its default? */
export function tuneIsDefault(key) {
  const d = TUNE_BY_KEY[key];
  return isSwitch(d) ? TUNE[key] === d.def : Math.abs(TUNE[key] - d.def) < 1e-9;
}

/** The values that differ from their defaults: { key: value }. */
export function tuneDiff() {
  const out = {};
  for (const d of TUNE_DEFS) {
    if (tuneIsDefault(d.key)) continue;
    out[d.key] = isSwitch(d) ? TUNE[d.key] : Math.round(TUNE[d.key] * 1e6) / 1e6;
  }
  return out;
}

export function tuneSave() {
  store.save('tune', tuneDiff());
}

/** Set one value (clamped to its range) and save. */
export function tuneSet(key, v) {
  const d = TUNE_BY_KEY[key];
  if (!d) return;
  TUNE[key] = isSwitch(d) ? !!v : clamp(Number(v) || 0, d.min, d.max);
  tuneSave();
}

/** Back to the default: one key, or every key. */
export function tuneReset(key) {
  for (const d of TUNE_DEFS) if (key === undefined || d.key === key) TUNE[d.key] = d.def;
  tuneSave();
}

/** Back to the defaults: every key in one group. */
export function tuneGroupReset(group) {
  for (const d of TUNE_DEFS) if (d.group === group) TUNE[d.key] = d.def;
  tuneSave();
}

// load what was saved (anything unknown, mistyped or missing stays default)
try {
  const saved = store.load('tune');
  if (saved && typeof saved === 'object') {
    for (const d of TUNE_DEFS) {
      const v = saved[d.key];
      if (isSwitch(d)) { if (typeof v === 'boolean') TUNE[d.key] = v; }
      else if (typeof v === 'number' && Number.isFinite(v)) TUNE[d.key] = clamp(v, d.min, d.max);
    }
  }
} catch { /* storage unavailable: stock values */ }
