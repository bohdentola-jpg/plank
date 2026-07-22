// Rifles B — AUG, SG 553, SSG 08, AWP, SCAR-20, G3SG1.
// Conventions per common.js: muzzle along -Z, +Y up, +X right/ejection side,
// origin at the trigger. Units are meters.
import * as THREE from '../three.js';
import {
  MAT, box, cyl, cylY, ring, angledGrip, triggerAssembly,
  rail, scopeAssembly, serrations, boxMagazine, curvedMagazine, makeGroup,
} from './common.js';

// AWP signature dark green.
const AWP_GREEN = new THREE.MeshStandardMaterial({ color: 0x37503a, roughness: 0.78, metalness: 0.08 });

// ---------- local micro-helpers ----------

// Cross-pin / screw visible on both receiver sides (axis along X).
function pinX(g, mat, r, len, y, z) {
  return cylY(g, mat, r, r, len, 0, y, z, 0, 0, Math.PI / 2, 10);
}

// Thin darker inset on the +X side (ejection port).
function ejectionPort(g, xFace, y, z, len = 0.04, h = 0.018, mat = MAT.gunmetal) {
  return box(g, mat, 0.002, h, len, xFace, y, z);
}

// Magazine (mesh + baseplate) in a tilted wrapper group so the baseplate
// stays glued to the mag on reload animations. Returns the wrapper.
function wrappedMag(g, mat, w, h, d, x, y, z, tilt = 0) {
  const wrap = makeGroup();
  wrap.position.set(x, y, z);
  wrap.rotation.x = tilt;
  g.add(wrap);
  boxMagazine(wrap, mat, w, h, d, 0, 0, 0, 0);
  return wrap;
}

// Bolt-action bolt: body cylinder along Z + handle L (shaft + knob) to +X.
// Returns the group (animated on cycling).
function boltAction(g, y, z, bodyLen = 0.1, drop = 0.35) {
  const bolt = makeGroup();
  bolt.position.set(0, y, z);
  g.add(bolt);
  cyl(bolt, MAT.silver, 0.0085, 0.0085, bodyLen, 0, 0, 0);
  cyl(bolt, MAT.black, 0.011, 0.011, 0.022, 0, 0, bodyLen / 2 + 0.008);     // rear shroud
  cylY(bolt, MAT.steel, 0.0045, 0.0045, 0.034, 0.021, -0.003, 0.02, 0, 0, Math.PI / 2 + drop, 10);
  cylY(bolt, MAT.black, 0.008, 0.009, 0.022, 0.04, -0.011, 0.02, 0, 0, Math.PI / 2 + drop, 10); // knob
  return bolt;
}

// Short accessory rail with slats on a ±X face.
function sideRail(g, xFace, y, zc, len, slats = 3, mat = MAT.darkGray) {
  box(g, mat, 0.006, 0.018, len, xFace, y, zc);
  for (let i = 0; i < slats; i++) {
    box(g, mat, 0.004, 0.02, 0.006, xFace + Math.sign(xFace) * 0.004, y,
      zc - len / 2 + (i + 0.5) * (len / slats));
  }
}

// ---------- AUG (Steyr AUG A1) ----------
// Austrian bullpup: smooth one-piece green polymer body, integrated optic on
// a die-cast stalk, folding foregrip modeled FOLDED FORWARD under the fat
// round barrel shroud, magazine behind the grip. parts: magazine, scope.
export function buildAUG() {
  const g = makeGroup();

  // One-piece green polymer body: butt block, mid section, chamfered top.
  box(g, MAT.green, 0.05, 0.09, 0.24, 0, 0.038, 0.2);                 // butt block
  box(g, MAT.green, 0.046, 0.07, 0.1, 0, 0.04, 0.035);                // mid around grip
  box(g, MAT.green, 0.018, 0.008, 0.22, -0.019, 0.081, 0.2, 0, 0, 0.5);  // chamfer L
  box(g, MAT.green, 0.018, 0.008, 0.22, 0.019, 0.081, 0.2, 0, 0, -0.5);  // chamfer R
  box(g, MAT.grip, 0.052, 0.094, 0.01, 0, 0.038, 0.325);              // rubber butt pad

  // Die-cast alloy receiver bridging body and barrel.
  box(g, MAT.darkGray, 0.044, 0.055, 0.13, 0, 0.058, -0.06);

  // Green polymer nose + FAT round barrel shroud.
  box(g, MAT.green, 0.042, 0.055, 0.06, 0, 0.05, -0.14);
  cyl(g, MAT.green, 0.019, 0.022, 0.1, 0, 0.055, -0.215);             // fat shroud
  cyl(g, MAT.darkGray, 0.02, 0.02, 0.008, 0, 0.055, -0.263);          // shroud collar

  // Barrel + slotted flash hider.
  cyl(g, MAT.black, 0.009, 0.0095, 0.15, 0, 0.055, -0.335);
  cyl(g, MAT.black, 0.0125, 0.0115, 0.038, 0, 0.055, -0.425);
  cyl(g, MAT.gunmetal, 0.013, 0.013, 0.004, 0, 0.055, -0.412);        // hider collar
  cyl(g, MAT.gunmetal, 0.0065, 0.0065, 0.006, 0, 0.055, -0.4455);     // bore

  // Integrated scope on a stalk (the iconic AUG donut optic).
  box(g, MAT.darkGray, 0.026, 0.05, 0.03, 0, 0.108, 0.03);            // rear stalk
  box(g, MAT.darkGray, 0.026, 0.05, 0.03, 0, 0.108, -0.05);           // front stalk
  box(g, MAT.darkGray, 0.028, 0.012, 0.13, 0, 0.128, -0.01);          // stalk bridge
  const scope = makeGroup();
  g.add(scope);
  scopeAssembly(scope, 0.152, -0.01, 0.12, 0.021);
  box(scope, MAT.black, 0.004, 0.007, 0.004, 0, 0.183, -0.06);        // backup post
  box(scope, MAT.black, 0.012, 0.005, 0.006, 0, 0.182, 0.04);         // backup notch

  // Grip with the AUG's huge full-hand trigger guard loop.
  angledGrip(g, MAT.green, 0.034, 0.09, 0.05, 0, 0.005, 0.028, 0.12);
  box(g, MAT.grip, 0.029, 0.05, 0.044, 0, -0.032, 0.032, 0.12);       // stipple panel
  serrations(g, MAT.grip, -0.032, 0.022, 3, 0.012, 0.008);            // grip ribs
  triggerAssembly(g);
  box(g, MAT.green, 0.008, 0.007, 0.11, 0, -0.08, -0.02);             // guard bottom bar
  box(g, MAT.green, 0.008, 0.1, 0.008, 0, -0.028, -0.072);            // guard front riser

  // Folding vertical foregrip — FOLDED FORWARD under the shroud.
  box(g, MAT.green, 0.03, 0.022, 0.032, 0, 0.014, -0.112);            // hinge block
  box(g, MAT.green, 0.029, 0.024, 0.1, 0, 0.006, -0.178);             // folded grip body
  serrations(g, MAT.green, 0.006, -0.21, 4, 0.02, 0.009);             // finger grooves
  box(g, MAT.green, 0.026, 0.02, 0.014, 0, 0.004, -0.235);            // grip toe cap

  // Translucent-ish 30rd magazine BEHIND the grip (bullpup).
  const magazine = wrappedMag(g, MAT.polymerLt, 0.026, 0.115, 0.05, 0, -0.048, 0.19, 0.06);
  box(magazine, MAT.darkGray, 0.001, 0.1, 0.003, -0.0132, 0, 0.012);  // witness rib L
  box(magazine, MAT.darkGray, 0.001, 0.1, 0.003, 0.0132, 0, 0.012);   // witness rib R

  // Charging handle on the left, ejection port on the right (rear, bullpup).
  box(g, MAT.black, 0.012, 0.01, 0.05, -0.028, 0.075, -0.07);
  box(g, MAT.black, 0.01, 0.022, 0.014, -0.036, 0.07, -0.085);        // handle knob
  ejectionPort(g, 0.0255, 0.05, 0.12, 0.05, 0.024);

  // Cross-bolt safety, takedown pins, sling loops.
  box(g, MAT.black, 0.04, 0.008, 0.008, 0, -0.005, 0.075);            // cross-bolt safety
  pinX(g, MAT.darkGray, 0.005, 0.048, 0.02, 0.15);
  pinX(g, MAT.darkGray, 0.005, 0.048, 0.06, -0.115);
  ring(g, MAT.black, 0.007, 0.002, -0.023, 0.055, -0.13, 0, Math.PI / 2, 0, 10);
  ring(g, MAT.black, 0.007, 0.002, -0.024, 0.07, 0.3, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.448), parts: { magazine, scope } };
}

// ---------- SG 553 (SIG Sauer) ----------
// Swiss carbine: classic layout, side-folding skeleton stock (extended),
// vented polymer handguard, low-profile optic on the receiver rail,
// translucent-ish curved magazine. parts: magazine, scope, bolt.
export function buildSG553() {
  const g = makeGroup();

  // Stamped receiver with top-cover ridge + lower housing.
  box(g, MAT.black, 0.04, 0.06, 0.22, 0, 0.05, 0.0);
  box(g, MAT.darkGray, 0.028, 0.008, 0.22, 0, 0.084, 0.0);            // cover ridge
  box(g, MAT.darkGray, 0.038, 0.035, 0.18, 0, 0.008, 0.015);          // lower housing

  // Receiver rail + low-profile scope.
  rail(g, 0.093, -0.01, 0.16);
  const scope = makeGroup();
  g.add(scope);
  scopeAssembly(scope, 0.125, -0.02, 0.14, 0.02);

  // Vented polymer handguard.
  box(g, MAT.polymer, 0.042, 0.048, 0.17, 0, 0.048, -0.195);
  box(g, MAT.polymer, 0.036, 0.02, 0.16, 0, 0.022, -0.195);           // lower taper
  for (const zc of [-0.145, -0.2, -0.255]) {                          // vent slots
    box(g, MAT.black, 0.002, 0.007, 0.045, -0.0215, 0.058, zc);
    box(g, MAT.black, 0.002, 0.007, 0.045, 0.0215, 0.058, zc);
  }

  // Gas block + hooded front sight + barrel + flash hider.
  box(g, MAT.black, 0.024, 0.032, 0.03, 0, 0.062, -0.295);
  box(g, MAT.black, 0.004, 0.016, 0.004, 0, 0.092, -0.295);           // front post
  ring(g, MAT.black, 0.011, 0.002, 0, 0.096, -0.295, 0, 0, 0, 12);    // front hood
  cyl(g, MAT.black, 0.0095, 0.0095, 0.15, 0, 0.055, -0.355);
  cyl(g, MAT.black, 0.012, 0.011, 0.042, 0, 0.055, -0.451);           // flash hider
  cyl(g, MAT.gunmetal, 0.0125, 0.0125, 0.004, 0, 0.055, -0.434);      // hider collar
  cyl(g, MAT.gunmetal, 0.0065, 0.0065, 0.005, 0, 0.055, -0.473);      // bore

  // Rear drum sight.
  cylY(g, MAT.black, 0.011, 0.011, 0.016, 0, 0.094, 0.075, 0, 0, 0, 12);

  // Side-folding skeleton stock, modeled EXTENDED.
  box(g, MAT.black, 0.018, 0.055, 0.03, 0, 0.045, 0.125);             // hinge block
  box(g, MAT.polymer, 0.014, 0.016, 0.18, 0, 0.065, 0.225);           // top strut
  box(g, MAT.polymer, 0.014, 0.014, 0.16, 0, 0.01, 0.21, 0.12);       // bottom strut
  box(g, MAT.polymer, 0.012, 0.01, 0.08, 0, 0.038, 0.26, 0.65);       // diagonal brace
  box(g, MAT.polymer, 0.016, 0.088, 0.028, 0, 0.032, 0.305);          // butt vertical
  box(g, MAT.grip, 0.018, 0.092, 0.008, 0, 0.032, 0.322);             // butt pad
  box(g, MAT.polymerLt, 0.016, 0.01, 0.1, 0, 0.075, 0.22);            // cheek strip

  // Grip + trigger.
  angledGrip(g, MAT.polymer, 0.032, 0.088, 0.048, 0, 0.0, 0.045, 0.3);
  box(g, MAT.grip, 0.029, 0.048, 0.042, 0, -0.038, 0.06, 0.3);
  serrations(g, MAT.grip, -0.038, 0.05, 3, 0.012, 0.008);
  triggerAssembly(g);
  box(g, MAT.black, 0.007, 0.005, 0.05, 0, -0.036, -0.01);            // guard bottom

  // Translucent-ish curved 30rd magazine + mag well.
  box(g, MAT.darkGray, 0.032, 0.028, 0.058, 0, -0.002, -0.055);
  const magazine = curvedMagazine(g, MAT.polymerLt, 0.027, 0.036, 0.05, 0, -0.014, -0.055, -0.12, 5);
  box(magazine, MAT.black, 0.029, 0.012, 0.054, 0, -0.17, -0.05, -0.48); // baseplate

  // Charging handle on the RIGHT (SIG style) — parts.bolt.
  const bolt = makeGroup();
  bolt.position.set(0.022, 0.065, -0.06);
  g.add(bolt);
  cylY(bolt, MAT.steel, 0.004, 0.004, 0.022, 0.008, 0, 0, 0, 0, Math.PI / 2, 10);
  cylY(bolt, MAT.black, 0.006, 0.007, 0.026, 0.022, 0.008, 0, 0.2, 0, 0, 10);

  // Ejection port, controls, pins, sling points.
  ejectionPort(g, 0.0205, 0.052, -0.02);
  box(g, MAT.black, 0.005, 0.009, 0.02, -0.02, 0.025, 0.06);          // selector L
  box(g, MAT.black, 0.005, 0.009, 0.02, 0.02, 0.025, 0.06);           // selector R
  box(g, MAT.black, 0.01, 0.016, 0.006, 0, -0.008, -0.024);           // paddle release
  pinX(g, MAT.black, 0.0035, 0.041, 0.03, 0.09);
  pinX(g, MAT.black, 0.0035, 0.041, 0.03, -0.09);
  ring(g, MAT.black, 0.007, 0.002, -0.022, 0.055, -0.13, 0, Math.PI / 2, 0, 10);
  ring(g, MAT.black, 0.007, 0.002, -0.01, 0.045, 0.13, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.475), parts: { magazine, scope, bolt } };
}

// ---------- SSG 08 (Steyr Scout) ----------
// Light bolt-action: slim FLUTED barrel, polymer skeleton stock with a big
// cutout, medium scope, right-side bolt handle, flush 10rd single-stack mag.
// parts: bolt, scope, magazine.
export function buildSSG08() {
  const g = makeGroup();

  // Polymer fore-end + tubular receiver.
  box(g, MAT.polymer, 0.04, 0.045, 0.24, 0, 0.035, -0.11);
  box(g, MAT.polymer, 0.042, 0.01, 0.24, 0, 0.014, -0.11);            // belly rib
  cyl(g, MAT.darkGray, 0.017, 0.017, 0.16, 0, 0.068, 0.03);           // receiver tube

  // Slim fluted barrel: taper cyl + 3 darker flute stripes.
  cyl(g, MAT.gunmetal, 0.0105, 0.014, 0.36, 0, 0.068, -0.3);
  box(g, MAT.black, 0.003, 0.0028, 0.26, 0, 0.0795, -0.27);           // flute top
  box(g, MAT.black, 0.0028, 0.003, 0.26, -0.0082, 0.0762, -0.27);     // flute L
  box(g, MAT.black, 0.0028, 0.003, 0.26, 0.0082, 0.0762, -0.27);      // flute R
  cyl(g, MAT.black, 0.0115, 0.0115, 0.014, 0, 0.068, -0.487);         // thread protector
  cyl(g, MAT.gunmetal, 0.006, 0.006, 0.004, 0, 0.068, -0.4955);       // bore

  // Receiver rail + medium scope.
  rail(g, 0.089, 0.03, 0.12);
  const scope = makeGroup();
  g.add(scope);
  scopeAssembly(scope, 0.122, 0.01, 0.2, 0.026);

  // Bolt with right-side handle — parts.bolt.
  const bolt = boltAction(g, 0.068, 0.095, 0.09, 0.4);

  // Skeleton buttstock: four boxes framing a big rectangular cutout.
  box(g, MAT.polymer, 0.034, 0.026, 0.19, 0, 0.078, 0.2);             // comb / top bar
  box(g, MAT.polymer, 0.032, 0.02, 0.18, 0, -0.018, 0.2, 0.1);        // bottom bar
  box(g, MAT.polymer, 0.036, 0.13, 0.035, 0, 0.028, 0.3);             // butt vertical
  box(g, MAT.polymer, 0.034, 0.1, 0.03, 0, 0.02, 0.115);              // front vertical
  box(g, MAT.grip, 0.038, 0.134, 0.008, 0, 0.028, 0.322);             // butt pad
  box(g, MAT.polymerLt, 0.036, 0.012, 0.12, 0, 0.097, 0.19);          // cheek piece

  // Grip + trigger.
  angledGrip(g, MAT.polymer, 0.03, 0.085, 0.045, 0, 0.0, 0.03, 0.28);
  box(g, MAT.grip, 0.029, 0.046, 0.04, 0, -0.036, 0.043, 0.28);
  serrations(g, MAT.grip, -0.036, 0.032, 3, 0.012, 0.008);
  triggerAssembly(g);

  // Flush 10rd single-stack magazine.
  const magazine = wrappedMag(g, MAT.black, 0.02, 0.032, 0.068, 0, -0.006, -0.045);

  // Sling studs, action screws.
  cylY(g, MAT.black, 0.0035, 0.0035, 0.014, 0, 0.008, -0.2, 0, 0, 0, 8);
  cylY(g, MAT.black, 0.0035, 0.0035, 0.014, 0, -0.032, 0.27, 0, 0, 0, 8);
  pinX(g, MAT.gunmetal, 0.0035, 0.042, 0.055, 0.08);
  pinX(g, MAT.gunmetal, 0.0035, 0.042, 0.055, -0.02);

  return { group: g, muzzle: new THREE.Vector3(0, 0.068, -0.497), parts: { bolt, scope, magazine } };
}

// ---------- AWP (Accuracy International AWM) ----------
// The green icon: LONG heavy barrel with a big cylindrical muzzle brake,
// dark-green chassis, thumbhole stock, LARGE scope, 5rd box mag, bipod stud.
// parts: bolt, scope, magazine.
export function buildAWP() {
  const g = makeGroup();

  // Dark-green chassis: fore-end, mid section, butt.
  box(g, AWP_GREEN, 0.042, 0.05, 0.24, 0, 0.04, -0.16);               // fore-end
  box(g, AWP_GREEN, 0.044, 0.065, 0.17, 0, 0.038, 0.03);              // mid chassis
  box(g, AWP_GREEN, 0.04, 0.075, 0.19, 0, 0.045, 0.225);              // butt block

  // Thumbhole: bridge + rear riser enclose a hole behind the grip.
  box(g, AWP_GREEN, 0.034, 0.026, 0.11, 0, -0.048, 0.16, 0.12);       // bottom bridge
  box(g, AWP_GREEN, 0.036, 0.06, 0.03, 0, -0.015, 0.21);              // rear riser

  // Butt spacers + pad + cheek piece.
  box(g, MAT.black, 0.042, 0.08, 0.008, 0, 0.045, 0.324);
  box(g, MAT.grip, 0.043, 0.082, 0.008, 0, 0.045, 0.332);
  box(g, MAT.black, 0.038, 0.014, 0.13, 0, 0.089, 0.21);              // cheek piece

  // Flat-sided action + round bolt raceway on top.
  box(g, MAT.darkGray, 0.038, 0.042, 0.17, 0, 0.06, 0.0);
  cyl(g, MAT.darkGray, 0.0165, 0.0165, 0.17, 0, 0.078, 0.0);

  // LONG heavy barrel + big cylindrical muzzle brake.
  cyl(g, MAT.black, 0.0135, 0.016, 0.42, 0, 0.072, -0.36);
  cyl(g, MAT.gunmetal, 0.02, 0.02, 0.055, 0, 0.072, -0.595);          // fat brake body
  cyl(g, MAT.black, 0.021, 0.021, 0.006, 0, 0.072, -0.578);           // brake ring
  cyl(g, MAT.black, 0.021, 0.021, 0.006, 0, 0.072, -0.606);           // brake ring
  cyl(g, MAT.black, 0.008, 0.008, 0.008, 0, 0.072, -0.625);           // bore

  // Receiver rail + LARGE scope.
  rail(g, 0.102, 0.0, 0.15);
  const scope = makeGroup();
  g.add(scope);
  scopeAssembly(scope, 0.142, -0.03, 0.26, 0.032);

  // Bolt with right-side handle — parts.bolt.
  const bolt = boltAction(g, 0.078, 0.075, 0.11, 0.42);

  // Thick 5rd magazine plate under the action.
  const magazine = wrappedMag(g, MAT.black, 0.032, 0.046, 0.085, 0, -0.018, -0.045);

  // Grip + trigger.
  angledGrip(g, AWP_GREEN, 0.03, 0.08, 0.044, 0, -0.002, 0.035, 0.32);
  box(g, MAT.grip, 0.029, 0.044, 0.04, 0, -0.036, 0.049, 0.32);
  serrations(g, MAT.grip, -0.036, 0.038, 3, 0.012, 0.008);
  triggerAssembly(g);

  // Fore-end vent slots (both sides).
  for (const zc of [-0.12, -0.17, -0.22]) {
    box(g, MAT.black, 0.002, 0.01, 0.035, -0.0215, 0.04, zc);
    box(g, MAT.black, 0.002, 0.01, 0.035, 0.0215, 0.04, zc);
  }

  // Front bipod stud + sling loops + action screws.
  box(g, MAT.black, 0.014, 0.008, 0.02, 0, 0.012, -0.245);
  cylY(g, MAT.black, 0.004, 0.004, 0.014, 0, 0.005, -0.245, 0, 0, 0, 8);
  ring(g, MAT.black, 0.007, 0.002, -0.022, 0.04, -0.2, 0, Math.PI / 2, 0, 10);
  ring(g, MAT.black, 0.007, 0.002, -0.021, 0.02, 0.29, 0, Math.PI / 2, 0, 10);
  pinX(g, MAT.gunmetal, 0.004, 0.046, 0.04, 0.06);
  pinX(g, MAT.gunmetal, 0.004, 0.046, 0.04, -0.05);

  return { group: g, muzzle: new THREE.Vector3(0, 0.072, -0.63), parts: { bolt, scope, magazine } };
}

// ---------- SCAR-20 (FN SCAR-H PR) ----------
// FDE tan autosniper: monolithic upper with FULL-LENGTH flat-top rail, chunky
// squared handguard with side rails, tall scope on risers, precision stock
// with cheek riser + adjustment wheels, 20rd tall mag. parts: magazine, scope.
export function buildSCAR20() {
  const g = makeGroup();

  // Monolithic tan upper receiver + full-length top rail.
  box(g, MAT.tan, 0.046, 0.05, 0.4, 0, 0.065, -0.09);
  rail(g, 0.095, -0.09, 0.4, MAT.tan);

  // Chunky squared handguard with side + bottom rails.
  box(g, MAT.tan, 0.054, 0.032, 0.16, 0, 0.03, -0.21);
  sideRail(g, -0.029, 0.05, -0.21, 0.1);
  sideRail(g, 0.029, 0.05, -0.21, 0.1);
  box(g, MAT.darkGray, 0.02, 0.006, 0.1, 0, 0.012, -0.21);            // bottom rail base
  for (let i = 0; i < 3; i++) {
    box(g, MAT.darkGray, 0.022, 0.004, 0.008, 0, 0.008, -0.245 + i * 0.033);
  }

  // Barrel + slab-sided muzzle brake.
  cyl(g, MAT.black, 0.011, 0.012, 0.2, 0, 0.062, -0.39);
  cyl(g, MAT.black, 0.0145, 0.0145, 0.05, 0, 0.062, -0.515);
  cyl(g, MAT.gunmetal, 0.0155, 0.0155, 0.005, 0, 0.062, -0.502);      // baffle ring
  cyl(g, MAT.gunmetal, 0.0155, 0.0155, 0.005, 0, 0.062, -0.522);      // baffle ring
  cyl(g, MAT.gunmetal, 0.007, 0.007, 0.006, 0, 0.062, -0.541);        // bore

  // Black lower receiver.
  box(g, MAT.black, 0.04, 0.035, 0.22, 0, 0.012, 0.005);

  // Tall scope on riser blocks.
  box(g, MAT.darkGray, 0.018, 0.022, 0.026, 0, 0.113, -0.087);        // riser front
  box(g, MAT.darkGray, 0.018, 0.022, 0.026, 0, 0.113, 0.047);         // riser rear
  const scope = makeGroup();
  g.add(scope);
  scopeAssembly(scope, 0.155, -0.02, 0.24, 0.03);

  // Grip + trigger.
  angledGrip(g, MAT.black, 0.032, 0.088, 0.048, 0, -0.005, 0.045, 0.3);
  box(g, MAT.grip, 0.029, 0.048, 0.042, 0, -0.043, 0.06, 0.3);
  serrations(g, MAT.grip, -0.043, 0.05, 3, 0.012, 0.008);
  triggerAssembly(g);

  // Tall 20rd magazine with witness ribs.
  const magazine = wrappedMag(g, MAT.black, 0.03, 0.115, 0.078, 0, -0.06, -0.055, 0.05);
  box(magazine, MAT.darkGray, 0.001, 0.1, 0.003, -0.0155, 0, 0.02);
  box(magazine, MAT.darkGray, 0.001, 0.1, 0.003, 0.0155, 0, 0.02);

  // Precision stock: body, cheek riser block, adjustment wheels, buttplate.
  box(g, MAT.tan, 0.036, 0.055, 0.19, 0, 0.05, 0.21);
  box(g, MAT.tan, 0.034, 0.03, 0.17, 0, 0.014, 0.22, 0.12);           // lower taper
  box(g, MAT.black, 0.034, 0.022, 0.11, 0, 0.092, 0.195);             // cheek riser
  cylY(g, MAT.black, 0.005, 0.005, 0.02, 0, 0.075, 0.16, 0, 0, 0, 8); // riser post
  cylY(g, MAT.black, 0.005, 0.005, 0.02, 0, 0.075, 0.23, 0, 0, 0, 8); // riser post
  cylY(g, MAT.darkGray, 0.012, 0.012, 0.008, 0.02, 0.06, 0.165, 0, 0, Math.PI / 2, 12); // adj wheel
  cylY(g, MAT.darkGray, 0.012, 0.012, 0.008, 0.02, 0.035, 0.275, 0, 0, Math.PI / 2, 12); // adj wheel
  box(g, MAT.black, 0.038, 0.09, 0.01, 0, 0.04, 0.31);                // buttplate
  box(g, MAT.grip, 0.039, 0.092, 0.008, 0, 0.04, 0.319);              // rubber pad
  box(g, MAT.black, 0.03, 0.02, 0.05, 0, -0.008, 0.29);               // bottom hook

  // Charging handle (left), ejection port, controls, pins.
  box(g, MAT.black, 0.01, 0.01, 0.05, -0.028, 0.072, -0.1);
  box(g, MAT.black, 0.012, 0.024, 0.014, -0.035, 0.066, -0.115);      // handle knob
  ejectionPort(g, 0.0235, 0.062, -0.04);
  box(g, MAT.black, 0.005, 0.008, 0.02, -0.02, 0.03, 0.055);          // selector L
  box(g, MAT.black, 0.005, 0.008, 0.02, 0.02, 0.03, 0.055);           // selector R
  box(g, MAT.black, 0.005, 0.007, 0.01, 0.021, 0.005, -0.03);         // mag release
  pinX(g, MAT.black, 0.004, 0.043, 0.012, 0.1);
  pinX(g, MAT.black, 0.004, 0.043, 0.012, -0.09);
  ring(g, MAT.black, 0.007, 0.002, -0.024, 0.05, -0.26, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.062, -0.545), parts: { magazine, scope } };
}

// ---------- G3SG1 (Heckler & Koch) ----------
// Black HK autosniper: G3 slab receiver with rounded top, slim handguard,
// scope raised on a claw mount, fixed buttstock with straight comb, slotted
// flash hider, 20rd steel mag. parts: magazine, scope, bolt.
export function buildG3SG1() {
  const g = makeGroup();

  // Slab stamped receiver + rounded top spine + stamped rib.
  box(g, MAT.black, 0.04, 0.06, 0.25, 0, 0.048, -0.015);
  cyl(g, MAT.black, 0.017, 0.017, 0.25, 0, 0.07, -0.015);             // rounded top
  box(g, MAT.darkGray, 0.042, 0.005, 0.25, 0, 0.032, -0.015);         // stamped rib

  // Cocking tube over the barrel + end cap.
  cyl(g, MAT.darkGray, 0.011, 0.011, 0.16, 0, 0.082, -0.22);
  cyl(g, MAT.black, 0.0125, 0.0125, 0.012, 0, 0.082, -0.298);

  // Forward charging handle on the LEFT — parts.bolt.
  const bolt = makeGroup();
  bolt.position.set(0, 0.082, -0.26);
  g.add(bolt);
  cylY(bolt, MAT.black, 0.005, 0.005, 0.024, -0.017, 0, 0, 0, 0, Math.PI / 2, 10);
  cylY(bolt, MAT.polymer, 0.007, 0.006, 0.024, -0.034, 0, 0, 0, 0, Math.PI / 2, 10);

  // Slim tapering handguard under the cocking tube.
  box(g, MAT.polymer, 0.032, 0.034, 0.16, 0, 0.044, -0.22);
  box(g, MAT.polymer, 0.026, 0.02, 0.15, 0, 0.024, -0.225, 0.06);     // lower taper
  serrations(g, MAT.polymer, 0.044, -0.27, 4, 0.026, 0.012);          // grip ribs

  // Barrel + slotted flash hider.
  cyl(g, MAT.black, 0.01, 0.01, 0.15, 0, 0.062, -0.375);
  cyl(g, MAT.black, 0.013, 0.011, 0.05, 0, 0.062, -0.475);            // flash hider
  cyl(g, MAT.gunmetal, 0.0135, 0.0135, 0.004, 0, 0.062, -0.455);      // hider collar
  cyl(g, MAT.gunmetal, 0.0135, 0.0135, 0.004, 0, 0.062, -0.478);      // hider collar
  cyl(g, MAT.gunmetal, 0.0065, 0.0065, 0.005, 0, 0.062, -0.501);      // bore

  // Hooded front post + rear rotary drum.
  box(g, MAT.black, 0.02, 0.008, 0.014, 0, 0.092, -0.295);            // front base
  box(g, MAT.black, 0.004, 0.016, 0.004, 0, 0.104, -0.295);           // front post
  ring(g, MAT.black, 0.012, 0.002, 0, 0.108, -0.295, 0, 0, 0, 12);    // front hood
  cylY(g, MAT.black, 0.012, 0.012, 0.018, 0, 0.096, 0.07, 0, 0, 0, 12); // drum sight

  // Claw mount: side claw plates + twin saddle blocks + bridge plate.
  box(g, MAT.darkGray, 0.004, 0.03, 0.13, -0.023, 0.06, 0.01);        // claw plate L
  box(g, MAT.darkGray, 0.004, 0.03, 0.13, 0.023, 0.06, 0.01);         // claw plate R
  box(g, MAT.darkGray, 0.034, 0.018, 0.035, 0, 0.096, -0.04);         // saddle front
  box(g, MAT.darkGray, 0.034, 0.018, 0.035, 0, 0.096, 0.06);          // saddle rear
  box(g, MAT.darkGray, 0.026, 0.008, 0.16, 0, 0.109, 0.01);           // bridge plate
  const scope = makeGroup();
  g.add(scope);
  scopeAssembly(scope, 0.142, 0.005, 0.2, 0.026);

  // Fixed buttstock with straight comb.
  box(g, MAT.polymer, 0.038, 0.05, 0.21, 0, 0.055, 0.215);
  box(g, MAT.polymer, 0.03, 0.032, 0.19, 0, 0.02, 0.225, 0.08);       // lower taper
  box(g, MAT.black, 0.04, 0.086, 0.012, 0, 0.04, 0.328);              // buttplate
  box(g, MAT.grip, 0.041, 0.088, 0.006, 0, 0.04, 0.337);              // rubber pad

  // Trigger group housing + grip + S-E-F selector.
  box(g, MAT.polymer, 0.034, 0.028, 0.1, 0, 0.008, 0.02);
  angledGrip(g, MAT.polymer, 0.032, 0.086, 0.05, 0, -0.004, 0.045, 0.3);
  box(g, MAT.grip, 0.029, 0.048, 0.044, 0, -0.042, 0.06, 0.3);
  triggerAssembly(g);
  cylY(g, MAT.black, 0.007, 0.007, 0.038, 0, 0.01, 0.04, 0, 0, Math.PI / 2, 10); // selector axis
  box(g, MAT.red, 0.003, 0.005, 0.014, -0.02, 0.01, 0.045);           // selector tip

  // 20rd steel magazine (slight curve) + mag well.
  box(g, MAT.black, 0.032, 0.026, 0.062, 0, -0.002, -0.065);
  const magazine = curvedMagazine(g, MAT.steel, 0.026, 0.034, 0.055, 0, -0.014, -0.065, -0.08, 4);
  box(magazine, MAT.black, 0.028, 0.012, 0.058, 0, -0.132, -0.021, -0.32); // baseplate

  // Ejection port, HK push-pins, sling points.
  ejectionPort(g, 0.0205, 0.055, -0.06);
  pinX(g, MAT.black, 0.004, 0.043, 0.028, 0.095);
  pinX(g, MAT.black, 0.004, 0.043, 0.062, 0.105);
  pinX(g, MAT.black, 0.004, 0.043, 0.028, -0.01);
  box(g, MAT.black, 0.004, 0.006, 0.018, -0.018, 0.055, -0.19);       // front sling slot
  ring(g, MAT.black, 0.008, 0.002, -0.02, 0.055, 0.14, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.062, -0.505), parts: { magazine, scope, bolt } };
}
