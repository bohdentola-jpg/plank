// Detailed procedural pistol models, set B:
//   Five-SeveN, CZ75-Auto, Tec-9, Desert Eagle, R8 Revolver.
// Conventions per common.js: muzzle along -Z, +Y up, +X is the right
// (ejection) side, origin at the trigger. Units are meters.
import * as THREE from '../three.js';
import {
  MAT, box, cyl, cylY, ring, angledGrip, triggerAssembly,
  ironSights, serrations, boxMagazine, makeGroup,
} from './common.js';

// Detachable magazine wrapped in its own group so the baseplate follows the
// mag body during the reload animation.
function magGroup(parent, mat, w, h, d, x, y, z, tilt = 0) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  parent.add(grp);
  boxMagazine(grp, mat, w, h, d, 0, 0, 0, tilt);
  return grp;
}

// Slide serrations at a configurable half-width (the shared serrations()
// helper assumes a ~30 mm slide).
function serr(parent, mat, hw, y, zc, n = 5, h = 0.018, spacing = 0.007) {
  for (let i = 0; i < n; i++) {
    box(parent, mat, 0.001, h, 0.0035, -hw, y, zc + i * spacing);
    box(parent, mat, 0.001, h, 0.0035, hw, y, zc + i * spacing);
  }
}

// Through-pin: a small cylinder along X poking out both receiver sides.
function pinX(parent, mat, r, len, x, y, z) {
  return cylY(parent, mat, r, r, len, x, y, z, 0, 0, Math.PI / 2, 10);
}

// ---------------------------------------------------------------------------
// Five-SeveN — futuristic polymer pistol: long slide with a smooth rounded
// top, oversized trigger guard, skinny 20-round magazine.
export function buildFiveSeven() {
  const g = makeGroup();

  // Slide: polymer-shrouded, smooth crowned top.
  const slide = new THREE.Group();
  g.add(slide);
  box(slide, MAT.polymer, 0.03, 0.024, 0.198, 0, 0.046, -0.056);       // slide body
  box(slide, MAT.polymer, 0.022, 0.008, 0.192, 0, 0.061, -0.056);      // smooth crown
  box(slide, MAT.black, 0.026, 0.02, 0.012, 0, 0.044, -0.152);         // nose block
  serrations(slide, MAT.black, 0.046, 0.012, 4);                       // rear grasp grooves
  serrations(slide, MAT.black, 0.046, -0.132, 4);                      // front grasp grooves
  box(slide, MAT.gunmetal, 0.002, 0.013, 0.032, 0.0152, 0.05, -0.028); // ejection port (+X)
  box(slide, MAT.darkGray, 0.006, 0.003, 0.05, 0.009, 0.0625, 0.0);    // extractor line
  ironSights(slide, 0.066, 0.036, -0.142);

  // Barrel and recoil assembly at the nose.
  cyl(g, MAT.steel, 0.0065, 0.0065, 0.025, 0, 0.05, -0.155);
  cyl(g, MAT.black, 0.0078, 0.0078, 0.005, 0, 0.05, -0.166);           // muzzle crown
  cyl(g, MAT.steel, 0.004, 0.004, 0.01, 0, 0.037, -0.15);              // recoil rod tip

  // Polymer frame with molded accessory rail.
  box(g, MAT.polymerLt, 0.032, 0.024, 0.148, 0, 0.024, -0.028);        // frame body
  box(g, MAT.polymerLt, 0.024, 0.01, 0.054, 0, 0.008, -0.07);          // dust cover rail
  box(g, MAT.polymer, 0.026, 0.004, 0.008, 0, 0.002, -0.058);          // rail slot
  box(g, MAT.polymer, 0.026, 0.004, 0.008, 0, 0.002, -0.076);          // rail slot

  // Oversized squared-off trigger guard.
  triggerAssembly(g, 1.45);
  box(g, MAT.polymerLt, 0.007, 0.034, 0.008, 0, -0.026, -0.05);        // guard front strap

  // Grip with stippled wrap and flat backstrap.
  angledGrip(g, MAT.polymer, 0.03, 0.102, 0.05, 0, 0.012, 0.034, 0.3);
  box(g, MAT.grip, 0.032, 0.055, 0.044, 0, -0.04, 0.05, 0.3);          // stipple wrap
  box(g, MAT.polymer, 0.024, 0.09, 0.01, 0, -0.035, 0.075, 0.3);       // backstrap
  box(g, MAT.black, 0.006, 0.008, 0.01, -0.017, -0.005, 0.03);         // mag release
  box(g, MAT.black, 0.004, 0.006, 0.03, -0.017, 0.036, 0.005);         // slide stop lever
  pinX(g, MAT.black, 0.004, 0.034, 0, 0.03, -0.005);                   // takedown pin
  pinX(g, MAT.black, 0.004, 0.034, 0, 0.03, 0.038);                    // rear frame pin

  // Skinny 20-round magazine.
  const magazine = magGroup(g, MAT.polymerLt, 0.021, 0.118, 0.04, 0, -0.048, 0.052, 0.3);

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.05, -0.17),
    parts: { slide, magazine },
  };
}

// ---------------------------------------------------------------------------
// CZ75-Auto — classic all-steel: the slide rides INSIDE the frame rails
// (slide narrower than frame), spurred hammer, long thin barrel.
export function buildCZ75() {
  const g = makeGroup();

  // Steel frame, wider than the slide, with raised full-length rails.
  box(g, MAT.gunmetal, 0.034, 0.026, 0.148, 0, 0.024, -0.028);         // frame
  box(g, MAT.gunmetal, 0.004, 0.014, 0.148, -0.016, 0.042, -0.028);    // left frame rail
  box(g, MAT.gunmetal, 0.004, 0.014, 0.148, 0.016, 0.042, -0.028);     // right frame rail
  box(g, MAT.gunmetal, 0.03, 0.012, 0.028, 0, 0.043, -0.088);          // dust cover hump

  // Narrow slide riding between the rails.
  const slide = new THREE.Group();
  g.add(slide);
  box(slide, MAT.gunmetal, 0.026, 0.02, 0.144, 0, 0.048, -0.03);       // slide body
  box(slide, MAT.gunmetal, 0.018, 0.006, 0.138, 0, 0.061, -0.03);      // rounded top rib
  serr(slide, MAT.black, 0.0132, 0.048, 0.01, 6, 0.016, 0.006);        // rear serrations
  box(slide, MAT.black, 0.002, 0.012, 0.028, 0.0132, 0.051, -0.02);    // ejection port (+X)
  box(slide, MAT.black, 0.016, 0.01, 0.008, 0, 0.052, 0.04);           // rear plate
  ironSights(slide, 0.066, 0.034, -0.095);

  // Long thin barrel protruding well past the slide, plus bushing.
  cyl(g, MAT.gunmetal, 0.008, 0.008, 0.012, 0, 0.052, -0.104);         // barrel bushing
  cyl(g, MAT.steel, 0.0055, 0.0055, 0.085, 0, 0.052, -0.135);          // long thin barrel
  ring(g, MAT.black, 0.0062, 0.0018, 0, 0.052, -0.172);                // muzzle band

  // Spurred hammer.
  pinX(g, MAT.gunmetal, 0.008, 0.008, 0, 0.048, 0.048);                // hammer body
  box(g, MAT.gunmetal, 0.005, 0.02, 0.005, 0, 0.06, 0.054, 0.9);       // hammer spur
  box(g, MAT.black, 0.01, 0.004, 0.009, 0, 0.068, 0.06);               // spur thumb pad
  box(g, MAT.gunmetal, 0.024, 0.008, 0.024, 0, 0.032, 0.052);          // beavertail

  // Steel grip frame with checkered panels and screws.
  const grip = new THREE.Group();
  grip.position.set(0, 0.012, 0.036);
  grip.rotation.x = 0.3;
  g.add(grip);
  box(grip, MAT.gunmetal, 0.026, 0.1, 0.042, 0, -0.048, 0);            // grip frame
  box(grip, MAT.grip, 0.006, 0.082, 0.036, -0.0155, -0.05, 0);         // left panel
  box(grip, MAT.grip, 0.006, 0.082, 0.036, 0.0155, -0.05, 0);          // right panel
  pinX(grip, MAT.steel, 0.0035, 0.039, 0, -0.03, 0);                   // grip screw
  pinX(grip, MAT.steel, 0.0035, 0.039, 0, -0.072, 0);                  // grip screw
  box(grip, MAT.gunmetal, 0.02, 0.096, 0.006, 0, -0.05, 0.022);        // backstrap
  box(grip, MAT.gunmetal, 0.024, 0.006, 0.048, 0, -0.099, 0);          // butt / magwell lip

  // Controls.
  box(g, MAT.black, 0.004, 0.008, 0.018, -0.018, 0.036, 0.024);        // left safety
  box(g, MAT.black, 0.004, 0.008, 0.018, 0.018, 0.036, 0.024);         // right safety (ambi)
  box(g, MAT.black, 0.004, 0.006, 0.026, -0.018, 0.036, -0.012);       // slide stop
  box(g, MAT.black, 0.005, 0.008, 0.009, -0.018, -0.002, 0.028);       // mag release
  triggerAssembly(g, 1);

  const magazine = magGroup(g, MAT.black, 0.019, 0.112, 0.036, 0, -0.05, 0.052, 0.3);

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.052, -0.18),
    parts: { slide, magazine },
  };
}

// ---------------------------------------------------------------------------
// Tec-9 — open-bolt machine pistol: long perforated barrel shroud, boxy
// stamped receiver, magazine in a magwell AHEAD of the grip.
export function buildTec9() {
  const g = makeGroup();

  // Boxy stamped receiver.
  box(g, MAT.black, 0.036, 0.04, 0.19, 0, 0.048, -0.015);              // upper receiver
  box(g, MAT.darkGray, 0.03, 0.006, 0.19, 0, 0.07, -0.015);            // top rib
  box(g, MAT.black, 0.038, 0.042, 0.01, 0, 0.048, 0.083);              // rear cap
  ring(g, MAT.black, 0.008, 0.002, 0, 0.048, 0.09);                    // sling loop
  box(g, MAT.darkGray, 0.002, 0.026, 0.11, -0.0185, 0.048, 0.0);       // left side plate
  box(g, MAT.black, 0.032, 0.03, 0.14, 0, 0.014, -0.01);               // lower frame
  pinX(g, MAT.darkGray, 0.004, 0.038, 0, 0.04, 0.065);                 // receiver pin
  pinX(g, MAT.darkGray, 0.004, 0.038, 0, 0.04, -0.095);                // receiver pin

  // Charging knob (left side) and ejection port (right side).
  cylY(g, MAT.black, 0.005, 0.005, 0.016, -0.024, 0.06, 0.03, 0, 0, Math.PI / 2, 10);
  cylY(g, MAT.black, 0.008, 0.008, 0.004, -0.033, 0.06, 0.03, 0, 0, Math.PI / 2, 10);
  box(g, MAT.gunmetal, 0.002, 0.016, 0.034, 0.0182, 0.052, -0.02);     // ejection port (+X)

  // Long perforated barrel shroud with vent holes and collars.
  cyl(g, MAT.darkGray, 0.016, 0.016, 0.135, 0, 0.048, -0.177);         // shroud
  ring(g, MAT.black, 0.0165, 0.0025, 0, 0.048, -0.115);                // rear collar
  ring(g, MAT.black, 0.0165, 0.0025, 0, 0.048, -0.24);                 // front collar
  for (let i = 0; i < 4; i++) {
    const z = -0.128 - i * 0.028;
    pinX(g, MAT.black, 0.0045, 0.0335, 0, 0.048, z);                   // side vent holes
    cylY(g, MAT.black, 0.0045, 0.0045, 0.0335, 0, 0.048, z, 0, 0, 0, 10); // top/bottom vents
  }

  // Barrel with threaded muzzle.
  cyl(g, MAT.black, 0.0075, 0.0075, 0.045, 0, 0.048, -0.255);
  ring(g, MAT.darkGray, 0.008, 0.0018, 0, 0.048, -0.268);              // muzzle thread
  ring(g, MAT.darkGray, 0.008, 0.0018, 0, 0.048, -0.273);              // muzzle thread

  // Sights.
  ironSights(g, 0.075, 0.07, -0.235);
  box(g, MAT.black, 0.01, 0.008, 0.01, 0, 0.068, -0.235);              // front sight ramp

  // Front magwell with a long menacing magazine ahead of the grip.
  box(g, MAT.black, 0.03, 0.045, 0.036, 0, -0.012, -0.048);            // front magwell
  const magazine = magGroup(g, MAT.gunmetal, 0.024, 0.14, 0.03, 0, -0.1, -0.048, 0.04);

  // Rear grip.
  angledGrip(g, MAT.polymer, 0.028, 0.098, 0.044, 0, 0.029, 0.062, 0.34);
  box(g, MAT.grip, 0.03, 0.05, 0.04, 0, -0.03, 0.083, 0.34);           // stipple wrap
  box(g, MAT.polymer, 0.02, 0.085, 0.008, 0, -0.017, 0.1, 0.34);       // backstrap
  triggerAssembly(g, 1.1);

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.048, -0.28),
    parts: { magazine },
  };
}

// ---------------------------------------------------------------------------
// Desert Eagle — HUGE: triangular-profile top barrel (stacked boxes + center
// rib), big square muzzle, gas piston tube under the barrel, wide grip.
export function buildDeagle() {
  const g = makeGroup();

  // Massive fixed barrel: triangular profile from stacked boxes + rib.
  box(g, MAT.black, 0.04, 0.022, 0.22, 0, 0.052, -0.09);               // lower barrel mass
  box(g, MAT.black, 0.028, 0.013, 0.22, 0, 0.0695, -0.09);             // upper, narrower
  box(g, MAT.darkGray, 0.012, 0.007, 0.215, 0, 0.0795, -0.09);         // center rib
  box(g, MAT.black, 0.045, 0.044, 0.03, 0, 0.056, -0.212);             // big square muzzle
  cyl(g, MAT.gunmetal, 0.009, 0.009, 0.01, 0, 0.056, -0.228);          // bore
  cyl(g, MAT.steel, 0.0075, 0.0075, 0.115, 0, 0.034, -0.135);          // gas piston tube
  box(g, MAT.black, 0.02, 0.014, 0.016, 0, 0.034, -0.19);              // gas block
  box(g, MAT.black, 0.014, 0.003, 0.01, 0, 0.0835, -0.05);             // scope groove cut
  box(g, MAT.black, 0.014, 0.003, 0.01, 0, 0.0835, -0.09);             // scope groove cut
  box(g, MAT.black, 0.014, 0.003, 0.01, 0, 0.0835, -0.13);             // scope groove cut
  box(g, MAT.black, 0.012, 0.006, 0.008, 0, 0.083, -0.202);            // front sight ramp
  box(g, MAT.black, 0.004, 0.015, 0.006, 0, 0.089, -0.208);            // front sight blade

  // Rear slide (bolt housing) with slanted grasp serrations.
  const slide = new THREE.Group();
  g.add(slide);
  box(slide, MAT.black, 0.042, 0.034, 0.075, 0, 0.05, 0.0525);         // slide block
  box(slide, MAT.darkGray, 0.03, 0.012, 0.075, 0, 0.073, 0.0525);      // top rear plate
  serr(slide, MAT.darkGray, 0.0215, 0.05, 0.05, 5, 0.026, 0.007);      // grasp serrations
  box(slide, MAT.gunmetal, 0.002, 0.015, 0.03, 0.0212, 0.056, 0.028);  // ejection port (+X)
  box(slide, MAT.black, 0.026, 0.024, 0.008, 0, 0.05, 0.092);          // rear plate
  box(slide, MAT.black, 0.018, 0.01, 0.008, 0, 0.083, 0.082);          // rear sight body
  box(slide, MAT.black, 0.005, 0.007, 0.006, -0.006, 0.089, 0.082);    // rear sight ear
  box(slide, MAT.black, 0.005, 0.007, 0.006, 0.006, 0.089, 0.082);     // rear sight ear
  box(slide, MAT.black, 0.005, 0.01, 0.016, -0.023, 0.062, 0.078);     // left safety lever
  box(slide, MAT.black, 0.005, 0.01, 0.016, 0.023, 0.062, 0.078);      // right safety lever

  // Exposed hammer at the very back.
  pinX(g, MAT.gunmetal, 0.007, 0.01, 0, 0.052, 0.098);                 // hammer body
  box(g, MAT.gunmetal, 0.005, 0.018, 0.005, 0, 0.063, 0.103, 0.8);     // hammer spur
  box(g, MAT.black, 0.01, 0.004, 0.009, 0, 0.07, 0.108);               // spur pad

  // Frame with a big hooked trigger guard.
  box(g, MAT.darkGray, 0.038, 0.026, 0.115, 0, 0.026, -0.0125);        // frame
  triggerAssembly(g, 1.35);
  box(g, MAT.black, 0.006, 0.026, 0.01, 0, -0.028, -0.048);            // guard front hook
  pinX(g, MAT.black, 0.004, 0.04, 0, 0.03, -0.05);                     // frame pin
  pinX(g, MAT.black, 0.004, 0.04, 0, 0.03, 0.03);                      // frame pin
  box(g, MAT.black, 0.004, 0.006, 0.026, -0.02, 0.038, -0.02);         // slide stop
  box(g, MAT.black, 0.006, 0.008, 0.01, -0.02, -0.004, 0.03);          // mag release

  // Wide grip.
  const grip = new THREE.Group();
  grip.position.set(0, 0.012, 0.042);
  grip.rotation.x = 0.28;
  g.add(grip);
  box(grip, MAT.polymer, 0.034, 0.105, 0.052, 0, -0.052, 0);           // grip core
  box(grip, MAT.grip, 0.006, 0.09, 0.048, -0.0185, -0.054, 0);         // left panel
  box(grip, MAT.grip, 0.006, 0.09, 0.048, 0.0185, -0.054, 0);          // right panel
  box(grip, MAT.polymer, 0.028, 0.1, 0.008, 0, -0.052, 0.028);         // backstrap
  pinX(grip, MAT.black, 0.0035, 0.047, 0, -0.05, 0);                   // grip screw

  const magazine = magGroup(g, MAT.gunmetal, 0.027, 0.115, 0.046, 0, -0.055, 0.058, 0.28);

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.056, -0.235),
    parts: { slide, magazine },
  };
}

// ---------------------------------------------------------------------------
// R8 Revolver — heavy frame: fluted cylinder, vented rib over an 8-inch
// barrel with full underlug, exposed hammer, dark wood grip panels.
export function buildR8() {
  const g = makeGroup();

  // Heavy frame: standing breech, topstrap, front post, crane lug.
  box(g, MAT.gunmetal, 0.026, 0.048, 0.045, 0, 0.046, 0.008);          // frame core / breech
  box(g, MAT.gunmetal, 0.024, 0.012, 0.1, 0, 0.075, -0.032);           // topstrap
  box(g, MAT.gunmetal, 0.026, 0.045, 0.014, 0, 0.045, -0.082);         // front frame post
  box(g, MAT.gunmetal, 0.02, 0.02, 0.05, 0, 0.018, -0.045);            // bottom strap / crane lug
  box(g, MAT.gunmetal, 0.014, 0.026, 0.03, 0, 0.008, 0.004);           // trigger housing
  pinX(g, MAT.steel, 0.0035, 0.028, 0, 0.038, 0.02);                   // frame pin
  pinX(g, MAT.steel, 0.0035, 0.028, 0, 0.06, 0.022);                   // frame pin
  box(g, MAT.black, 0.004, 0.008, 0.02, -0.015, 0.052, 0.02);          // cylinder release latch

  // Fluted six-shot cylinder (grouped so the game can spin it around Z).
  const cylinder = new THREE.Group();
  cylinder.position.set(0, 0.045, -0.045);
  g.add(cylinder);
  cyl(cylinder, MAT.gunmetal, 0.0205, 0.0205, 0.05, 0, 0, 0, 0, 0, 0, 12); // drum
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6;
    cyl(cylinder, MAT.darkGray, 0.0055, 0.0055, 0.052,
      Math.cos(a) * 0.019, Math.sin(a) * 0.019, 0, 0, 0, 0, 8);        // flutes/chambers
  }
  cyl(cylinder, MAT.black, 0.009, 0.009, 0.008, 0, 0, 0.028);          // rear ratchet
  cyl(cylinder, MAT.gunmetal, 0.019, 0.019, 0.004, 0, 0, -0.027);      // front face ring

  // 8-inch barrel with full underlug, ejector rod, and vented rib.
  cyl(g, MAT.gunmetal, 0.009, 0.009, 0.185, 0, 0.052, -0.1665);        // barrel
  cyl(g, MAT.black, 0.0105, 0.0105, 0.012, 0, 0.052, -0.255);          // muzzle collar
  box(g, MAT.gunmetal, 0.013, 0.014, 0.15, 0, 0.034, -0.16);           // full underlug
  cyl(g, MAT.steel, 0.0035, 0.0035, 0.025, 0, 0.032, -0.243);          // ejector rod tip
  box(g, MAT.gunmetal, 0.015, 0.008, 0.18, 0, 0.066, -0.163);          // top rib
  for (let i = 0; i < 5; i++) {
    box(g, MAT.black, 0.017, 0.0035, 0.014, 0, 0.064, -0.095 - i * 0.033); // rib vents
  }
  box(g, MAT.black, 0.004, 0.014, 0.006, 0, 0.076, -0.248);            // front sight blade
  box(g, MAT.black, 0.016, 0.006, 0.012, 0, 0.084, 0.008);             // rear sight body
  box(g, MAT.black, 0.005, 0.005, 0.008, -0.0055, 0.089, 0.008);       // rear sight ear
  box(g, MAT.black, 0.005, 0.005, 0.008, 0.0055, 0.089, 0.008);        // rear sight ear

  // Exposed hammer.
  pinX(g, MAT.steel, 0.006, 0.014, 0, 0.058, 0.028);                   // hammer pivot
  box(g, MAT.gunmetal, 0.006, 0.024, 0.006, 0, 0.078, 0.033, 0.5);     // hammer body
  box(g, MAT.black, 0.011, 0.004, 0.012, 0, 0.089, 0.041);             // thumb pad

  triggerAssembly(g, 1.15);

  // Raked grip with dark wood panels and brass medallion screw.
  const grip = new THREE.Group();
  grip.position.set(0, 0.02, 0.028);
  grip.rotation.x = 0.5;
  g.add(grip);
  box(grip, MAT.gunmetal, 0.02, 0.095, 0.034, 0, -0.045, 0);           // grip frame
  box(grip, MAT.darkWood, 0.007, 0.082, 0.03, -0.0135, -0.048, 0);     // left wood panel
  box(grip, MAT.darkWood, 0.007, 0.082, 0.03, 0.0135, -0.048, 0);      // right wood panel
  pinX(grip, MAT.brass, 0.0035, 0.029, 0, -0.048, 0);                  // medallion screw
  box(grip, MAT.gunmetal, 0.022, 0.008, 0.038, 0, -0.094, 0);          // butt cap

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.052, -0.265),
    parts: { cylinder },
  };
}
