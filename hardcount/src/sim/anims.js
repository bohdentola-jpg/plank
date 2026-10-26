// The animation contract between the sim and the player models.
//
// Every frame the match hands each model an animation state A (see below).
// The sim owns timing: an action's `t` is the seconds since the sim started
// it, so a throw releases the ball exactly when the arm comes through. The
// model samples its clip at A.action.t. Durations and key moments live here so
// both sides agree. No three.js in this file (the sim runs headless).
//
// A = {
//   x, z,          feet position (yards)
//   heading,       radians, facing direction: 0 = +z, π/2 = +x  (heading = atan2(dirX, dirZ));
//                  model.group.rotation.y = heading.  NB facing +z, +x is the player's LEFT.
//   speed,         ground speed, yd/s (0 … ~11)
//   moveAngle,     velocity direction relative to heading, radians (0 forward, +π/2 to the
//                  player's left, −π/2 to his right, ±π backwards) → backpedal / shuffle gaits
//   accel,         forward acceleration yd/s² (lean into a burst, rock back when braking)
//   turnRate,      heading change rad/s (bank into turns)
//   effort,        0..1 — jog posture at 0, full sprint posture at 1
//   base,          one of BASES: the stance when standing still (locomotion takes over with speed)
//   action,        null | { name, t, side: 'L'|'R'|null, power: 0..1 }  (one of ACTIONS)
//   carry,         null | 'L' | 'R' | 'two'   — arm cradling the ball / both hands on it
//   look,          null | {x, y, z} world point the head tracks (ball in the air, the QB's read)
//   reach,         null | {x, y, z} world point the hands reach for (catching, swatting, tackling)
//   engage,        null | { dx, dz, push }  blocking contact: unit direction to the opponent and
//                  push −1 (being driven back) … +1 (driving him back)
//   dirt,          0..1 how muddy / grass-stained the uniform is (rises through a game)
// }

export const BASES = [
  'stand',      // relaxed between plays, subtle breathing and weight shifts
  'ready',      // athletic stance: knees bent, hands up (DBs, LBs, returners)
  'stance3',    // three-point stance, one hand down (OL, DL, a FB / I-form RB)
  'stance2',    // two-point stance (WR on the line, staggered feet, slight crouch)
  'qbUnder',    // QB under center, hands under the center
  'qbGun',      // QB in the shotgun, hands ready for the snap
  'center',     // center over the ball, hand on it
  'huddle',     // hands on knees, leaning into the huddle
  'kneel',      // on one knee (QB kneel-down, holder, coaches)
  'lie_front',  // on the ground face down
  'lie_back',   // on the ground on his back
  'sit',        // sitting (bench)
  'hips',       // standing, hands on hips (tired / waiting)
  'block',      // pass-pro / run-block posture: low, arms extended (also kick-slide)
  'rush',       // pass rusher / run defender fighting a block
  'kick_ready', // kicker lined up
  'ref',        // official standing, arms at sides
];

// name → { dur, key: { … named moments in seconds }, end?: base the player is left in, upper?: true
// when the clip is upper-body only (layers over the running legs), held?: true when it loops
// until the sim clears it }
export const ACTIONS = {
  // ---- snap & quarterback
  snap: { dur: 0.35, key: { release: 0.12 } },                 // center hikes (shotgun snap flies further)
  take_snap: { dur: 0.3, key: { ball: 0.08 } },                // QB under center takes it to his chest
  catch_snap: { dur: 0.35, key: { ball: 0.15 } },              // shotgun QB catches the snap
  throw: { dur: 0.55, key: { release: 0.25 }, upper: true },   // power 0 = touch lob, 1 = fastball
  pump: { dur: 0.4, key: { top: 0.2 }, upper: true },          // pump fake
  pitch: { dur: 0.4, key: { release: 0.16 }, upper: true },    // option pitch / toss sweep (side = direction)
  lateral: { dur: 0.35, key: { release: 0.14 }, upper: true }, // quick pitch back — works mid-tackle and falling
  handoff_give: { dur: 0.6, key: { transfer: 0.3 }, upper: true },
  handoff_take: { dur: 0.6, key: { transfer: 0.3 }, upper: true },
  spike: { dur: 0.5, key: { release: 0.22 } },
  kneel_down: { dur: 0.8, key: { down: 0.5 }, end: 'kneel' },

  // ---- ball carrier moves
  juke: { dur: 0.45, key: { plant: 0.12, push: 0.22 } },       // side = the way he jumps
  spin: { dur: 0.55, key: { mid: 0.27 } },                     // full 360 in the clip; heading stays put
  stiff: { dur: 0.65, key: { extend: 0.15 }, upper: true },    // side = arm that pushes
  hurdle: { dur: 0.75, key: { takeoff: 0.12, apex: 0.35, land: 0.62 } }, // apex ~1.1 yd off the ground
  truck: { dur: 0.5, key: { contact: 0.18 } },                 // lowers the shoulder
  dive: { dur: 0.8, key: { launch: 0.1, land: 0.45 }, end: 'lie_front' },
  slide: { dur: 0.8, key: { down: 0.35 }, end: 'sit' },        // QB feet-first slide
  protect: { dur: 1.0, held: true, upper: true },              // both arms over the ball
  highstep: { dur: 0.5, held: true },                          // showboat high knees
  wrapped: { dur: 0.6, held: true },                           // being held up: leaning forward, legs churning

  // ---- catching (the ball reaches the hands at key.ball)
  catch_chest: { dur: 0.55, key: { ball: 0.25 }, upper: true },
  catch_high: { dur: 0.75, key: { takeoff: 0.05, ball: 0.3, land: 0.6 } },   // leaping catch, apex at the ball
  catch_low: { dur: 0.55, key: { ball: 0.25 } },                              // scoop at the shoe tops
  catch_dive: { dur: 0.9, key: { launch: 0.05, ball: 0.3, land: 0.5 }, end: 'lie_front' },
  catch_shoulder: { dur: 0.55, key: { ball: 0.25 }, upper: true },           // over the shoulder on the run
  catch_side: { dur: 0.55, key: { ball: 0.25 }, upper: true },               // side = reach direction
  catch_onehand: { dur: 0.6, key: { ball: 0.28 } },
  bobble: { dur: 0.7, key: { pop: 0.1, regrab: 0.45 }, upper: true },
  drop: { dur: 0.5, key: { pop: 0.1 }, upper: true },

  // ---- defense
  tackle: { dur: 0.7, key: { wrap: 0.2 } },                    // wrap up and drive
  dive_tackle: { dur: 0.85, key: { launch: 0.08, contact: 0.3, land: 0.5 }, end: 'lie_front' },
  hit: { dur: 0.5, key: { contact: 0.15 } },                   // big hit: shoulder through the man
  cut: { dur: 0.6, key: { contact: 0.22 }, end: 'lie_front' }, // low tackle at the legs
  wrap_hold: { dur: 0.6, held: true },                         // hanging onto a ball carrier
  swat: { dur: 0.45, key: { swat: 0.2 }, upper: true },        // side = arm
  jump_swat: { dur: 0.65, key: { apex: 0.3, swat: 0.3 } },
  strip: { dur: 0.4, key: { punch: 0.18 }, upper: true },
  jam: { dur: 0.5, key: { contact: 0.15 }, upper: true },      // press at the line
  shed: { dur: 0.45, key: { free: 0.3 } },                     // swim / rip off a block (side)
  bull: { dur: 0.5, key: { push: 0.2 }, upper: true },

  // ---- falls & recovery
  fall_fwd: { dur: 0.8, key: { ground: 0.45 }, end: 'lie_front' },
  fall_back: { dur: 0.8, key: { ground: 0.45 }, end: 'lie_back' },
  fall_side: { dur: 0.8, key: { ground: 0.45 }, end: 'lie_back' },  // side = which way
  stumble: { dur: 0.6, key: { recover: 0.45 } },
  pancaked: { dur: 0.9, key: { ground: 0.5 }, end: 'lie_back' },
  getup_front: { dur: 1.1, key: { up: 0.9 }, end: 'stand' },
  getup_back: { dur: 1.2, key: { up: 1.0 }, end: 'stand' },
  scoop: { dur: 0.6, key: { ball: 0.3 } },                      // bend and pick up a loose ball
  fumble_dive: { dur: 0.8, key: { land: 0.4 }, end: 'lie_front' },

  // ---- kicking
  kick: { dur: 0.6, key: { contact: 0.28 } },                   // kickoff / field goal swing (the run-up is locomotion)
  punt: { dur: 0.9, key: { drop: 0.4, contact: 0.55 } },
  hold: { dur: 1.0, held: true },                               // holder on one knee, hands ready
  longsnap: { dur: 0.35, key: { release: 0.1 } },

  // ---- celebrations & reactions
  celebrate_spike: { dur: 1.4, key: { release: 0.35 } },
  celebrate_point: { dur: 2.0 },                                // point to the sky
  celebrate_flex: { dur: 2.0 },
  celebrate_dance: { dur: 1.2, held: true },
  celebrate_jump: { dur: 1.0, key: { apex: 0.4 } },
  celebrate_salute: { dur: 1.8 },
  dejected: { dur: 2.0, held: true },                           // hands on the helmet
  clap: { dur: 0.5, held: true, upper: true },
  huddle_clap: { dur: 0.6, key: { clap: 0.35 }, upper: true },
  raise_roof: { dur: 1.0, held: true, upper: true },

  // ---- officials
  sig_td: { dur: 2.2 },                                         // both arms straight up
  sig_first: { dur: 1.6 },                                      // point the way the offense goes (side)
  sig_incomplete: { dur: 1.6 },                                 // arms swinging across, low
  sig_flag: { dur: 0.8, key: { release: 0.35 } },               // throws the flag
  sig_safety: { dur: 1.8 },                                     // palms together over the head
  sig_timeout: { dur: 1.6 },                                    // crosses arms over the head
  sig_good: { dur: 2.0 },                                       // kick good: both arms up
  sig_nogood: { dur: 1.6 },                                     // kick no good: arms swing across
};

export function actionDur(name) { return ACTIONS[name]?.dur ?? 0.5; }
export function actionKey(name, key) { return ACTIONS[name]?.key?.[key] ?? 0; }
