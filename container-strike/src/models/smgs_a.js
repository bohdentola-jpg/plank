// SMGs A — MP9, MAC-10, MP5-SD, MP7.
// Conventions per common.js: muzzle along -Z, +Y up, +X right/ejection side,
// origin at the trigger. Units are meters.
import * as THREE from '../three.js';
import {
  MAT, box, cyl, cylY, ring, cone, angledGrip, triggerAssembly, ironSights,
  rail, serrations, boxMagazine, curvedMagazine, makeGroup,
} from './common.js';

// ---------- local micro-helpers ----------

// Cross-pin visible on both receiver sides (axis along X).
function pinX(g, mat, r, len, y, z) {
  return cylY(g, mat, r, r, len, 0, y, z, 0, 0, Math.PI / 2, 10);
}

// Thin darker inset on the +X side (ejection port).
function ejectionPort(g, xFace, y, z, len = 0.032, h = 0.016, mat = MAT.gunmetal) {
  return box(g, mat, 0.002, h, len, xFace, y, z);
}

// Magazine (mesh + baseplate) inside a tilted wrapper group so the baseplate
// stays glued to the mag bottom. Returns the wrapper (animated on reloads).
function tiltedMag(g, mat, w, h, d, x, y, z, tilt = 0) {
  const wrap = makeGroup();
  wrap.position.set(x, y, z);
  wrap.rotation.x = tilt;
  g.add(wrap);
  boxMagazine(wrap, mat, w, h, d, 0, 0, 0, 0);
  return wrap;
}

// Short side-mounted accessory rail (base + slats) on the ±X face.
function sideRail(g, xFace, y, zc, len, slats = 3, mat = MAT.darkGray) {
  box(g, mat, 0.006, 0.018, len, xFace, y, zc);
  for (let i = 0; i < slats; i++) {
    box(g, mat, 0.004, 0.02, 0.006, xFace + Math.sign(xFace) * 0.004, y,
      zc - len / 2 + (i + 0.5) * (len / slats));
  }
}

// ---------- MP9 (Brugger & Thomet machine pistol) ----------
// Tiny Swiss machine pistol: polymer lower with integral vertical foregrip,
// magazine housed in the grip, side-folding stock folded along the RIGHT side.
export function buildMP9() {
  const g = makeGroup();

  // Upper receiver: compact rectangular alloy body with chamfered top edges.
  box(g, MAT.darkGray, 0.038, 0.042, 0.24, 0, 0.052, -0.03);
  box(g, MAT.darkGray, 0.014, 0.006, 0.24, -0.015, 0.072, -0.03, 0, 0, 0.5);
  box(g, MAT.darkGray, 0.014, 0.006, 0.24, 0.015, 0.072, -0.03, 0, 0, -0.5);
  box(g, MAT.gunmetal, 0.034, 0.01, 0.02, 0, 0.05, -0.155);          // front trunnion face

  // Full-length top rail with flip sights.
  rail(g, 0.078, -0.035, 0.17);
  ironSights(g, 0.088, 0.045, -0.11);

  // Polymer lower: frame shell wrapping the receiver bottom.
  box(g, MAT.polymer, 0.04, 0.032, 0.18, 0, 0.018, -0.02);
  box(g, MAT.polymer, 0.036, 0.014, 0.03, 0, 0.006, 0.075);          // rear frame heel

  // Trigger + guard flowing into the integral vertical foregrip.
  triggerAssembly(g);
  box(g, MAT.polymer, 0.008, 0.006, 0.06, 0, -0.033, -0.035);        // guard bottom bar
  box(g, MAT.polymer, 0.03, 0.078, 0.036, 0, -0.033, -0.073, 0.1);   // vertical foregrip
  box(g, MAT.grip, 0.031, 0.008, 0.03, 0, -0.02, -0.0745, 0.1);      // finger groove
  box(g, MAT.grip, 0.031, 0.008, 0.03, 0, -0.044, -0.0725, 0.1);     // finger groove
  box(g, MAT.polymer, 0.03, 0.012, 0.04, 0, -0.069, -0.075, 0.1);    // foregrip toe

  // Pistol grip (magazine feeds through it) with stipple panels.
  angledGrip(g, MAT.polymer, 0.032, 0.088, 0.048, 0, 0.002, 0.046, 0.24);
  box(g, MAT.grip, 0.033, 0.05, 0.042, 0, -0.036, 0.058, 0.24);
  box(g, MAT.grip, 0.027, 0.062, 0.006, 0, -0.043, 0.076, 0.24);     // backstrap

  // 30rd magazine protruding from the grip.
  const magazine = tiltedMag(g, MAT.polymer, 0.024, 0.095, 0.04, 0, -0.062, 0.062, 0.24);

  // Short barrel with mounting lug + muzzle nut.
  cyl(g, MAT.black, 0.009, 0.009, 0.05, 0, 0.052, -0.175);
  box(g, MAT.black, 0.014, 0.012, 0.022, 0, 0.04, -0.172);           // barrel lug
  cyl(g, MAT.gunmetal, 0.011, 0.011, 0.01, 0, 0.052, -0.196);        // muzzle nut

  // Rear ambidextrous charging handle.
  box(g, MAT.black, 0.048, 0.012, 0.016, 0, 0.06, 0.092);
  box(g, MAT.grip, 0.008, 0.014, 0.018, -0.026, 0.06, 0.092);
  box(g, MAT.grip, 0.008, 0.014, 0.018, 0.026, 0.06, 0.092);

  // Ejection port on the right.
  ejectionPort(g, 0.0195, 0.055, -0.06);

  // Side-folding stock, folded ALONG the right (+X) side.
  box(g, MAT.gunmetal, 0.014, 0.03, 0.018, 0.026, 0.045, 0.086);     // hinge block
  box(g, MAT.polymer, 0.008, 0.012, 0.16, 0.03, 0.06, 0.002);       // upper stock strut
  box(g, MAT.polymer, 0.008, 0.012, 0.16, 0.03, 0.028, 0.002);      // lower stock strut
  box(g, MAT.polymer, 0.01, 0.05, 0.022, 0.031, 0.044, -0.082);     // folded buttplate
  box(g, MAT.grip, 0.012, 0.052, 0.006, 0.031, 0.044, -0.095);      // butt pad

  // Controls + pins + sling loop.
  box(g, MAT.black, 0.005, 0.009, 0.018, -0.018, 0.028, 0.03);       // ambi selector L
  box(g, MAT.black, 0.005, 0.009, 0.018, 0.018, 0.028, 0.03);        // ambi selector R
  box(g, MAT.black, 0.004, 0.008, 0.008, -0.017, -0.004, 0.032);     // mag release
  pinX(g, MAT.black, 0.0035, 0.041, 0.03, 0.06);
  pinX(g, MAT.black, 0.0035, 0.041, 0.03, -0.12);
  ring(g, MAT.black, 0.007, 0.002, -0.02, 0.012, 0.088, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.052, -0.202), parts: { magazine } };
}

// ---------- MAC-10 (Ingram) ----------
// Crude stamped box: one chunky receiver, tiny barrel nub with threaded
// muzzle, magazine in the pistol grip, wire stock collapsed at the rear.
export function buildMAC10() {
  const g = makeGroup();

  // One chunky stamped-steel receiver box + top cover seam.
  box(g, MAT.black, 0.05, 0.068, 0.21, 0, 0.045, -0.005);
  box(g, MAT.darkGray, 0.052, 0.004, 0.21, 0, 0.062, -0.005);        // stamped seam line
  box(g, MAT.darkGray, 0.05, 0.012, 0.012, 0, 0.045, 0.104);         // rear cap

  // Top-slot charging handle (slotted knob rides in a groove).
  box(g, MAT.gunmetal, 0.012, 0.004, 0.12, 0, 0.081, 0.005);         // top slot plate
  cylY(g, MAT.black, 0.009, 0.009, 0.012, 0, 0.087, 0.03, 0, 0, 0, 12);
  box(g, MAT.darkGray, 0.02, 0.003, 0.004, 0, 0.094, 0.03);          // sight-notch slot in knob

  // Ejection port on the right.
  ejectionPort(g, 0.0255, 0.05, -0.025, 0.036, 0.02);

  // Nearly-vertical pistol grip housing the magazine.
  angledGrip(g, MAT.black, 0.036, 0.082, 0.05, 0, 0.011, 0.042, 0.08);
  box(g, MAT.grip, 0.037, 0.05, 0.044, 0, -0.026, 0.045, 0.08);
  box(g, MAT.grip, 0.031, 0.06, 0.005, 0, -0.031, 0.069, 0.08);      // backstrap

  // 30rd magazine hanging from the grip.
  const magazine = tiltedMag(g, MAT.gunmetal, 0.027, 0.115, 0.042, 0, -0.068, 0.048, 0.08);

  // Trigger group with stamped front strap.
  triggerAssembly(g);
  box(g, MAT.black, 0.007, 0.03, 0.005, 0, -0.026, -0.026, -0.1);    // guard front strap
  box(g, MAT.black, 0.004, 0.008, 0.01, -0.019, 0.005, 0.02);        // safety slide (left)
  box(g, MAT.black, 0.004, 0.007, 0.007, 0.019, -0.01, 0.045);       // mag release button

  // Tiny barrel nub with threaded muzzle + knurled thread protector.
  cyl(g, MAT.black, 0.01, 0.01, 0.045, 0, 0.045, -0.128);
  cyl(g, MAT.gunmetal, 0.0115, 0.0115, 0.004, 0, 0.045, -0.136);     // thread ring
  cyl(g, MAT.gunmetal, 0.0115, 0.0115, 0.004, 0, 0.045, -0.143);     // thread ring
  cyl(g, MAT.gunmetal, 0.0115, 0.0115, 0.004, 0, 0.045, -0.15);      // thread ring
  cyl(g, MAT.black, 0.0125, 0.0125, 0.008, 0, 0.045, -0.156);        // thread protector

  // Wire stock collapsed at the rear: rods alongside, butt frame folded under.
  box(g, MAT.steel, 0.006, 0.006, 0.13, -0.021, 0.055, 0.075);       // wire rod L
  box(g, MAT.steel, 0.006, 0.006, 0.13, 0.021, 0.055, 0.075);        // wire rod R
  box(g, MAT.steel, 0.048, 0.006, 0.006, 0, 0.055, 0.138);           // rear crossbar
  box(g, MAT.steel, 0.006, 0.05, 0.006, -0.021, 0.03, 0.138);        // butt frame drop L
  box(g, MAT.steel, 0.006, 0.05, 0.006, 0.021, 0.03, 0.138);         // butt frame drop R
  box(g, MAT.steel, 0.048, 0.006, 0.032, 0, 0.007, 0.125);           // buttplate folded under

  // Stamped sights: rear aperture plate + protected front blade.
  box(g, MAT.black, 0.024, 0.016, 0.003, 0, 0.088, 0.09);            // rear aperture plate
  cylY(g, MAT.gunmetal, 0.004, 0.004, 0.004, 0, 0.09, 0.088, Math.PI / 2, 0, 0, 10);
  box(g, MAT.black, 0.004, 0.014, 0.004, 0, 0.086, -0.1);            // front blade
  box(g, MAT.black, 0.003, 0.012, 0.004, -0.008, 0.085, -0.1, 0, 0, 0.25);  // front ear L
  box(g, MAT.black, 0.003, 0.012, 0.004, 0.008, 0.085, -0.1, 0, 0, -0.25);  // front ear R

  // Front sling strap + receiver rivets.
  box(g, MAT.black, 0.004, 0.018, 0.01, 0, 0.002, -0.095);
  ring(g, MAT.steel, 0.008, 0.002, 0, -0.012, -0.095, 0, Math.PI / 2, 0, 10);
  pinX(g, MAT.gunmetal, 0.003, 0.052, 0.03, 0.08);
  pinX(g, MAT.gunmetal, 0.003, 0.052, 0.03, -0.07);
  pinX(g, MAT.gunmetal, 0.003, 0.052, 0.062, 0.09);

  return { group: g, muzzle: new THREE.Vector3(0, 0.045, -0.161), parts: { magazine } };
}

// ---------- MP5-SD (Heckler & Koch, integrally suppressed) ----------
// Slim receiver, FAT integral suppressor over most of the barrel, curved 30rd
// magazine, drum rear sight, fixed stock. parts: magazine, bolt.
export function buildMP5SD() {
  const g = makeGroup();

  // Slim stamped receiver with rounded top.
  box(g, MAT.darkGray, 0.036, 0.04, 0.24, 0, 0.046, -0.04);
  cyl(g, MAT.darkGray, 0.017, 0.017, 0.24, 0, 0.062, -0.04);         // rounded top spine
  box(g, MAT.gunmetal, 0.037, 0.005, 0.2, 0, 0.03, -0.05);           // stamped rib line

  // Cocking tube extending forward over the suppressor rear.
  cyl(g, MAT.darkGray, 0.011, 0.011, 0.11, 0, 0.074, -0.2);
  cyl(g, MAT.black, 0.0125, 0.0125, 0.014, 0, 0.074, -0.252);        // tube end cap

  // Charging handle (bolt) on the left front — animates on reloads/cocking.
  const bolt = makeGroup();
  bolt.position.set(0, 0.074, -0.225);
  g.add(bolt);
  cylY(bolt, MAT.black, 0.005, 0.005, 0.026, -0.018, 0, 0, 0, 0, Math.PI / 2, 10);
  cylY(bolt, MAT.polymer, 0.008, 0.007, 0.024, -0.036, 0, 0, 0, 0, Math.PI / 2, 10);

  // FAT integral suppressor running most of the barrel length.
  cyl(g, MAT.black, 0.021, 0.021, 0.27, 0, 0.05, -0.3);
  cyl(g, MAT.gunmetal, 0.023, 0.023, 0.018, 0, 0.05, -0.175);        // rear collar
  cyl(g, MAT.gunmetal, 0.022, 0.022, 0.006, 0, 0.05, -0.3);          // knurl ring
  cyl(g, MAT.gunmetal, 0.022, 0.022, 0.006, 0, 0.05, -0.36);         // knurl ring
  cyl(g, MAT.darkGray, 0.022, 0.022, 0.012, 0, 0.05, -0.428);        // end cap
  cyl(g, MAT.black, 0.007, 0.007, 0.005, 0, 0.05, -0.4355);          // bore

  // Drum rear sight + hooded front post (on the suppressor collar).
  box(g, MAT.black, 0.02, 0.01, 0.03, 0, 0.078, 0.052);              // sight base
  cylY(g, MAT.black, 0.013, 0.013, 0.02, 0, 0.092, 0.052, 0, 0, 0, 12);
  box(g, MAT.gunmetal, 0.004, 0.004, 0.014, 0, 0.1, 0.052);          // aperture detent line
  box(g, MAT.black, 0.004, 0.018, 0.004, 0, 0.086, -0.168);          // front post
  ring(g, MAT.black, 0.012, 0.002, 0, 0.09, -0.168, 0, 0, 0, 12);    // front hood ring
  box(g, MAT.black, 0.02, 0.006, 0.012, 0, 0.075, -0.168);           // front sight base

  // Lower: trigger group, grip, S-E-F selector.
  box(g, MAT.polymer, 0.034, 0.028, 0.09, 0, 0.012, 0.015);
  triggerAssembly(g);
  angledGrip(g, MAT.polymer, 0.032, 0.09, 0.05, 0, -0.002, 0.045, 0.3);
  box(g, MAT.grip, 0.033, 0.05, 0.044, 0, -0.04, 0.06, 0.3);
  cylY(g, MAT.black, 0.007, 0.007, 0.038, 0, 0.012, 0.035, 0, 0, Math.PI / 2, 10); // selector axis
  box(g, MAT.red, 0.003, 0.005, 0.014, -0.02, 0.012, 0.04);          // selector lever tip

  // Magazine well + curved 30rd magazine + paddle release.
  box(g, MAT.darkGray, 0.032, 0.032, 0.04, 0, 0.004, -0.075);
  const magazine = curvedMagazine(g, MAT.black, 0.026, 0.036, 0.046, 0, -0.01, -0.075, -0.13, 5);
  box(g, MAT.black, 0.01, 0.018, 0.006, 0, -0.004, -0.048);          // paddle release

  // Ejection port on the right.
  ejectionPort(g, 0.0185, 0.05, -0.095, 0.038, 0.018);

  // Fixed stock true to the A2 silhouette.
  box(g, MAT.polymer, 0.038, 0.046, 0.2, 0, 0.042, 0.185);
  box(g, MAT.polymer, 0.03, 0.026, 0.2, 0, 0.014, 0.19, 0.06);       // lower taper
  box(g, MAT.polymer, 0.042, 0.088, 0.016, 0, 0.026, 0.292);         // buttplate
  box(g, MAT.grip, 0.043, 0.09, 0.006, 0, 0.026, 0.302);             // rubber butt pad

  // HK push-pins, sling points.
  pinX(g, MAT.black, 0.004, 0.039, 0.03, 0.075);
  pinX(g, MAT.black, 0.004, 0.039, 0.058, 0.09);
  pinX(g, MAT.black, 0.004, 0.039, 0.03, -0.005);
  ring(g, MAT.black, 0.008, 0.002, -0.019, 0.05, 0.09, 0, Math.PI / 2, 0, 10); // rear sling loop
  box(g, MAT.black, 0.004, 0.006, 0.016, -0.019, 0.06, -0.15);       // front sling slot

  return { group: g, muzzle: new THREE.Vector3(0, 0.05, -0.44), parts: { magazine, bolt } };
}

// ---------- MP7 (Heckler & Koch PDW) ----------
// One-piece polymer body, folding front grip (extended), collapsible stock
// extended, side rails, translucent-ish 20rd magazine in the grip.
export function buildMP7() {
  const g = makeGroup();

  // One-piece polymer body with angular chamfered shoulders.
  box(g, MAT.polymer, 0.044, 0.06, 0.26, 0, 0.04, -0.03);
  box(g, MAT.polymer, 0.016, 0.008, 0.26, -0.018, 0.068, -0.03, 0, 0, 0.55);
  box(g, MAT.polymer, 0.016, 0.008, 0.26, 0.018, 0.068, -0.03, 0, 0, -0.55);
  box(g, MAT.polymer, 0.04, 0.024, 0.05, 0, 0.002, -0.135);          // front frame chin

  // Barrel + lugged flash hider.
  cyl(g, MAT.black, 0.009, 0.009, 0.12, 0, 0.055, -0.22);
  cyl(g, MAT.black, 0.013, 0.012, 0.026, 0, 0.055, -0.288);          // flash hider body
  cone(g, MAT.gunmetal, 0.011, 0.012, 0, 0.055, -0.303);             // crowned tip
  cyl(g, MAT.gunmetal, 0.0135, 0.0135, 0.004, 0, 0.055, -0.279);     // hider collar

  // Full-length top rail with flip sights, short side rails.
  rail(g, 0.078, -0.02, 0.2);
  ironSights(g, 0.088, 0.06, -0.11);
  sideRail(g, -0.025, 0.048, -0.095, 0.08);
  sideRail(g, 0.025, 0.048, -0.095, 0.08);

  // Pistol grip (magazine feeds through it).
  angledGrip(g, MAT.polymer, 0.034, 0.086, 0.05, 0, 0.002, 0.048, 0.18);
  box(g, MAT.grip, 0.035, 0.048, 0.044, 0, -0.036, 0.058, 0.18);
  box(g, MAT.grip, 0.029, 0.06, 0.006, 0, -0.042, 0.078, 0.18);      // backstrap

  // Translucent-ish 20rd magazine with witness ribs.
  const magazine = tiltedMag(g, MAT.polymerLt, 0.025, 0.085, 0.042, 0, -0.06, 0.062, 0.18);
  box(magazine, MAT.darkGray, 0.0005, 0.08, 0.003, -0.0128, 0, 0.012); // witness rib L
  box(magazine, MAT.darkGray, 0.0005, 0.08, 0.003, 0.0128, 0, 0.012);  // witness rib R

  // Trigger with oversized guard reaching the front grip hinge.
  triggerAssembly(g);
  box(g, MAT.polymer, 0.008, 0.006, 0.07, 0, -0.034, -0.045);        // guard bottom bar
  box(g, MAT.polymer, 0.008, 0.024, 0.006, 0, -0.022, -0.078, -0.25);// guard front riser

  // Folding front grip, modeled extended (vertical) with hinge block.
  box(g, MAT.polymer, 0.032, 0.018, 0.04, 0, -0.02, -0.125);         // hinge block
  box(g, MAT.polymer, 0.029, 0.082, 0.034, 0, -0.068, -0.128, 0.08);
  box(g, MAT.grip, 0.03, 0.008, 0.03, 0, -0.052, -0.1275, 0.08);     // finger groove
  box(g, MAT.grip, 0.03, 0.008, 0.03, 0, -0.078, -0.1255, 0.08);     // finger groove
  box(g, MAT.polymer, 0.03, 0.012, 0.038, 0, -0.106, -0.128, 0.08);  // grip toe

  // Collapsible stock, extended: twin struts + buttplate.
  box(g, MAT.black, 0.04, 0.036, 0.02, 0, 0.045, 0.105);             // stock latch housing
  cyl(g, MAT.gunmetal, 0.005, 0.005, 0.15, -0.013, 0.05, 0.185);     // strut L
  cyl(g, MAT.gunmetal, 0.005, 0.005, 0.15, 0.013, 0.05, 0.185);      // strut R
  box(g, MAT.polymer, 0.04, 0.08, 0.018, 0, 0.028, 0.265);           // buttplate
  box(g, MAT.grip, 0.041, 0.082, 0.006, 0, 0.028, 0.277);            // rubber pad

  // Rear charging handle (AR-style pull) with side wings.
  box(g, MAT.black, 0.026, 0.01, 0.03, 0, 0.075, 0.095);
  box(g, MAT.black, 0.012, 0.008, 0.012, -0.018, 0.074, 0.1);
  box(g, MAT.black, 0.012, 0.008, 0.012, 0.018, 0.074, 0.1);

  // Ejection port + controls + pins.
  ejectionPort(g, 0.0225, 0.048, -0.055, 0.036, 0.018);
  box(g, MAT.black, 0.005, 0.008, 0.018, -0.019, 0.02, 0.035);       // ambi selector L
  box(g, MAT.black, 0.005, 0.008, 0.018, 0.019, 0.02, 0.035);        // ambi selector R
  box(g, MAT.black, 0.006, 0.014, 0.01, 0, -0.036, 0.022);           // mag release lever
  box(g, MAT.black, 0.005, 0.006, 0.02, -0.023, 0.045, -0.005);      // bolt catch
  pinX(g, MAT.black, 0.0035, 0.047, 0.028, 0.07);
  pinX(g, MAT.black, 0.0035, 0.047, 0.028, -0.09);
  ring(g, MAT.black, 0.007, 0.002, -0.022, 0.06, 0.085, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.309), parts: { magazine } };
}
