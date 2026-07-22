// Rifles A — FAMAS, Galil AR, M4A4, M4A1-S, AK-47.
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
function ejectionPort(g, xFace, y, z, len = 0.04, h = 0.018, mat = MAT.gunmetal) {
  return box(g, mat, 0.002, h, len, xFace, y, z);
}

// Magazine (mesh + baseplate) inside a tilted wrapper group so the baseplate
// stays glued to the mag on reload animations. Returns the wrapper.
function tiltedMag(g, mat, w, h, d, x, y, z, tilt = 0) {
  const wrap = makeGroup();
  wrap.position.set(x, y, z);
  wrap.rotation.x = tilt;
  g.add(wrap);
  boxMagazine(wrap, mat, w, h, d, 0, 0, 0, 0);
  return wrap;
}

// A2-style birdcage flash hider at barrel line y, tip at zTip (+Z of the crown).
function birdcage(g, y, zTip, r = 0.0125) {
  cyl(g, MAT.black, r, r * 0.9, 0.036, 0, y, zTip + 0.02);           // cage body
  box(g, MAT.polymer, 0.002, 0.008, 0.024, -r - 0.0005, y, zTip + 0.02); // slot L
  box(g, MAT.polymer, 0.002, 0.008, 0.024, r + 0.0005, y, zTip + 0.02);  // slot R
  ring(g, MAT.gunmetal, r * 0.9, 0.0022, 0, y, zTip + 0.003, 0, 0, 0, 12); // crown ring
  cyl(g, MAT.black, 0.005, 0.005, 0.006, 0, y, zTip);                // bore
}

// ---------- FAMAS (F1) ----------
// French bullpup: magazine BEHIND the grip, one HUGE full-length carry handle
// (two uprights + long top bar), cheese-grater handguard, stubby barrel with
// 22mm grenade rings, folded integral bipod. parts: magazine.
export function buildFAMAS() {
  const g = makeGroup();

  // Bullpup body: rear stock mass + mid body around the grip + cheek comb.
  box(g, MAT.green, 0.042, 0.064, 0.32, 0, 0.03, 0.155);             // rear body / stock
  box(g, MAT.green, 0.04, 0.052, 0.16, 0, 0.03, -0.05);              // mid body
  box(g, MAT.green, 0.036, 0.018, 0.12, 0, 0.068, 0.2, -0.05);       // cheek comb
  box(g, MAT.polymer, 0.046, 0.096, 0.014, 0, 0.02, 0.322);          // buttplate
  box(g, MAT.grip, 0.047, 0.098, 0.006, 0, 0.02, 0.332);             // rubber butt pad

  // THE carry handle: inverted U spanning nearly the whole receiver.
  box(g, MAT.green, 0.028, 0.09, 0.028, 0, 0.1, -0.095);             // front upright
  box(g, MAT.green, 0.028, 0.09, 0.028, 0, 0.1, 0.155);              // rear upright
  box(g, MAT.green, 0.034, 0.022, 0.40, 0, 0.156, 0.03);             // long top bar
  box(g, MAT.green, 0.022, 0.01, 0.38, 0, 0.172, 0.03);              // sight rib on top
  ironSights(g, 0.18, 0.13, -0.07);                                  // sights ride the rib

  // Charging handle in the channel under the handle, with grip grooves.
  box(g, MAT.black, 0.03, 0.014, 0.034, 0, 0.075, -0.03);
  serrations(g, MAT.black, 0.075, -0.042, 4, 0.01, 0.007);

  // Grip + trigger inside the full-hand guard.
  angledGrip(g, MAT.green, 0.03, 0.088, 0.048, 0, -0.002, 0.03, 0.26);
  box(g, MAT.grip, 0.031, 0.046, 0.04, 0, -0.042, 0.045, 0.26);      // stipple panel
  triggerAssembly(g);
  box(g, MAT.green, 0.008, 0.006, 0.15, 0, -0.062, -0.04);           // guard bottom bar
  box(g, MAT.green, 0.008, 0.036, 0.006, 0, -0.044, -0.112, 0.15);   // guard front riser
  box(g, MAT.green, 0.008, 0.03, 0.006, 0, -0.052, 0.033, -0.2);     // guard rear riser

  // 25rd straight magazine BEHIND the grip (bullpup!).
  const magazine = tiltedMag(g, MAT.black, 0.028, 0.125, 0.05, 0, -0.058, 0.16, 0.1);
  box(g, MAT.black, 0.01, 0.014, 0.008, 0, -0.004, 0.2);             // mag release paddle

  // Cheese-grater handguard: slotted vents down both sides.
  box(g, MAT.green, 0.04, 0.054, 0.14, 0, 0.035, -0.2);
  for (let i = 0; i < 4; i++) {
    const z = -0.155 - i * 0.032;
    box(g, MAT.polymer, 0.002, 0.022, 0.02, -0.0201, 0.035, z);
    box(g, MAT.polymer, 0.002, 0.022, 0.02, 0.0201, 0.035, z);
  }

  // Integral bipod, folded back along the handguard sides.
  box(g, MAT.darkGray, 0.05, 0.008, 0.016, 0, 0.07, -0.135);         // hinge crossbar
  cyl(g, MAT.darkGray, 0.0035, 0.0035, 0.13, -0.0235, 0.065, -0.2);  // folded leg L
  cyl(g, MAT.darkGray, 0.0035, 0.0035, 0.13, 0.0235, 0.065, -0.2);   // folded leg R
  box(g, MAT.darkGray, 0.006, 0.006, 0.012, -0.0235, 0.065, -0.268); // foot L
  box(g, MAT.darkGray, 0.006, 0.006, 0.012, 0.0235, 0.065, -0.268);  // foot R

  // Stubby barrel with 22mm grenade-launching rings + slotted flash hider.
  cyl(g, MAT.black, 0.011, 0.011, 0.16, 0, 0.055, -0.35);
  ring(g, MAT.black, 0.016, 0.003, 0, 0.055, -0.345, 0, 0, 0, 12);   // grenade ring
  ring(g, MAT.black, 0.016, 0.003, 0, 0.055, -0.385, 0, 0, 0, 12);   // grenade ring stop
  cyl(g, MAT.gunmetal, 0.014, 0.014, 0.005, 0, 0.055, -0.421);       // hider collar
  cyl(g, MAT.black, 0.0135, 0.012, 0.034, 0, 0.055, -0.438);         // flash hider
  box(g, MAT.polymer, 0.002, 0.008, 0.022, -0.0136, 0.055, -0.438);  // hider slot L
  box(g, MAT.polymer, 0.002, 0.008, 0.022, 0.0136, 0.055, -0.438);   // hider slot R
  cyl(g, MAT.black, 0.006, 0.006, 0.006, 0, 0.055, -0.456);          // crown

  // Ejection port at the cheek (bullpup), sling loops, assembly pins.
  ejectionPort(g, 0.0211, 0.042, 0.1, 0.042, 0.022);
  ring(g, MAT.black, 0.008, 0.002, -0.021, 0.016, 0.15, 0, Math.PI / 2, 0, 10);
  ring(g, MAT.black, 0.008, 0.002, -0.0205, 0.055, -0.13, 0, Math.PI / 2, 0, 10);
  pinX(g, MAT.black, 0.0035, 0.041, 0.03, -0.09);
  pinX(g, MAT.black, 0.0035, 0.043, 0.03, 0.12);

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.457), parts: { magazine } };
}

// ---------- Galil AR ----------
// Israeli AK-family rifle: boxy receiver with round top cover, polymer
// handguard, forward gas tube, curved 35rd steel mag, tubular folding stock
// (modeled fixed/extended), upswept charging knob. parts: magazine, bolt.
export function buildGalil() {
  const g = makeGroup();

  // Receiver: milled slab + rounded top cover + rear trunnion face.
  box(g, MAT.darkGray, 0.038, 0.052, 0.25, 0, 0.042, -0.065);
  cyl(g, MAT.gunmetal, 0.017, 0.017, 0.24, 0, 0.066, -0.065);        // round top cover
  box(g, MAT.darkGray, 0.036, 0.05, 0.014, 0, 0.042, 0.062);         // rear trunnion
  box(g, MAT.gunmetal, 0.039, 0.006, 0.2, 0, 0.02, -0.06);           // milled rail line

  // Upswept charging handle riding the carrier (animates as bolt).
  const bolt = makeGroup();
  bolt.position.set(0, 0.078, -0.02);
  g.add(bolt);
  box(bolt, MAT.black, 0.026, 0.01, 0.06, 0.006, 0, 0);              // carrier top
  cylY(bolt, MAT.black, 0.005, 0.006, 0.032, 0.016, 0.018, 0.018, 0, 0, 0, 10); // vertical knob

  // Rear aperture sight on the cover, front post + hood on the gas block.
  box(g, MAT.black, 0.022, 0.012, 0.024, 0, 0.086, 0.02);
  box(g, MAT.black, 0.006, 0.012, 0.004, 0, 0.098, 0.02);            // L-flip aperture
  cylY(g, MAT.black, 0.002, 0.002, 0.016, 0, 0.098, -0.375, 0, 0, 0, 8); // front post
  ring(g, MAT.black, 0.009, 0.002, 0, 0.104, -0.375, 0, 0, 0, 12);   // front hood ring
  box(g, MAT.black, 0.016, 0.01, 0.018, 0, 0.088, -0.375);           // front sight base

  // Polymer handguard with grip grooves.
  box(g, MAT.polymerLt, 0.044, 0.05, 0.15, 0, 0.036, -0.265);
  box(g, MAT.polymer, 0.045, 0.004, 0.13, 0, 0.026, -0.265);         // groove line low
  box(g, MAT.polymer, 0.045, 0.004, 0.13, 0, 0.046, -0.265);         // groove line high
  cyl(g, MAT.gunmetal, 0.02, 0.02, 0.014, 0, 0.05, -0.185);          // handguard retainer ring

  // Gas system forward and above the barrel.
  cyl(g, MAT.gunmetal, 0.0085, 0.0085, 0.17, 0, 0.082, -0.27);       // gas tube
  box(g, MAT.darkGray, 0.022, 0.032, 0.028, 0, 0.072, -0.37);        // gas block
  cone(g, MAT.darkGray, 0.008, 0.016, 0, 0.082, -0.392);             // gas block nose

  // Barrel with step + slotted flash suppressor.
  cyl(g, MAT.black, 0.0105, 0.0105, 0.03, 0, 0.055, -0.355);         // chamber step
  cyl(g, MAT.black, 0.0085, 0.0085, 0.15, 0, 0.055, -0.43);
  cyl(g, MAT.black, 0.012, 0.011, 0.032, 0, 0.055, -0.516);          // flash hider
  box(g, MAT.polymer, 0.002, 0.007, 0.02, -0.0121, 0.055, -0.516);   // hider slot L
  box(g, MAT.polymer, 0.002, 0.007, 0.02, 0.0121, 0.055, -0.516);    // hider slot R
  cyl(g, MAT.black, 0.0055, 0.0055, 0.005, 0, 0.055, -0.533);        // crown

  // Curved 35rd steel magazine + flared well + AK paddle release.
  box(g, MAT.darkGray, 0.034, 0.024, 0.058, 0, 0.008, -0.09);        // mag well flare
  const magazine = curvedMagazine(g, MAT.gunmetal, 0.03, 0.036, 0.054, 0, 0.005, -0.09, -0.14, 6);
  box(g, MAT.black, 0.012, 0.016, 0.02, 0, -0.002, -0.05);           // paddle release

  // Trigger group + pistol grip.
  triggerAssembly(g);
  angledGrip(g, MAT.polymer, 0.032, 0.09, 0.05, 0, -0.004, 0.035, 0.28);
  box(g, MAT.grip, 0.033, 0.048, 0.044, 0, -0.044, 0.05, 0.28);      // grip stipple
  box(g, MAT.black, 0.003, 0.04, 0.01, 0.0197, 0.036, 0.01, 0.35);   // AK selector lever R
  box(g, MAT.black, 0.005, 0.008, 0.02, -0.0197, 0.052, 0.03);       // thumb selector L

  // Tubular folding stock (fixed open): twin struts -> triangular butt.
  box(g, MAT.black, 0.036, 0.048, 0.026, 0, 0.04, 0.082);            // hinge block
  cyl(g, MAT.steel, 0.0065, 0.0065, 0.2, -0.013, 0.054, 0.19);       // strut L
  cyl(g, MAT.steel, 0.0065, 0.0065, 0.2, 0.013, 0.054, 0.19);        // strut R
  box(g, MAT.steel, 0.007, 0.07, 0.01, -0.013, 0.022, 0.279, 0.18);  // butt frame L
  box(g, MAT.steel, 0.007, 0.07, 0.01, 0.013, 0.022, 0.279, 0.18);   // butt frame R
  box(g, MAT.black, 0.038, 0.082, 0.014, 0, 0.02, 0.3);              // buttplate
  box(g, MAT.grip, 0.039, 0.084, 0.006, 0, 0.02, 0.31);              // rubber pad

  // Ejection port, pins, sling loops.
  ejectionPort(g, 0.0195, 0.046, -0.05, 0.044, 0.02);
  pinX(g, MAT.black, 0.0035, 0.043, 0.036, 0.04);
  pinX(g, MAT.black, 0.0035, 0.043, 0.036, -0.15);
  ring(g, MAT.black, 0.008, 0.002, -0.023, 0.036, -0.185, 0, Math.PI / 2, 0, 10);
  ring(g, MAT.black, 0.008, 0.002, -0.019, 0.04, 0.085, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.535), parts: { magazine, bolt } };
}

// ---------- M4A4 ----------
// AR-15 family: flat-top upper with full-length rail, quad-rail handguard,
// birdcage flash hider, collapsible stock, STANAG mag, forward assist +
// ejection port door. parts: magazine, bolt.
export function buildM4A4() {
  const g = makeGroup();

  // Upper receiver (flat-top) + full-length rail + flip sights.
  box(g, MAT.darkGray, 0.038, 0.048, 0.22, 0, 0.058, -0.02);
  rail(g, 0.086, -0.02, 0.21);
  box(g, MAT.black, 0.024, 0.012, 0.024, 0, 0.096, 0.06);            // rear flip-sight base
  box(g, MAT.black, 0.02, 0.012, 0.018, 0, 0.096, -0.115);           // front flip-sight base
  ironSights(g, 0.106, 0.06, -0.115);

  // Charging handle (T-handle, animates as bolt) + latch.
  const bolt = makeGroup();
  bolt.position.set(0, 0.083, 0.09);
  g.add(bolt);
  box(bolt, MAT.black, 0.012, 0.008, 0.06, 0, 0, -0.02);             // handle spine
  box(bolt, MAT.black, 0.038, 0.008, 0.013, 0, 0, 0.012);            // T wings
  box(bolt, MAT.black, 0.008, 0.006, 0.016, -0.02, 0, 0.008);        // latch

  // Right side: forward assist, ejection port + spring-open door, deflector.
  cylY(g, MAT.black, 0.0065, 0.0065, 0.014, 0.023, 0.06, 0.05, 0, 0, Math.PI / 2, 10);
  ejectionPort(g, 0.0195, 0.052, -0.05, 0.046, 0.02);
  box(g, MAT.gunmetal, 0.0025, 0.026, 0.05, 0.0205, 0.032, -0.05);   // port door (open, hangs low)
  box(g, MAT.darkGray, 0.008, 0.016, 0.016, 0.021, 0.058, -0.015, 0, 0.5, 0); // brass deflector

  // Lower receiver + magwell + STANAG mag with slight curve.
  box(g, MAT.darkGray, 0.036, 0.042, 0.13, 0, 0.02, 0.0);
  box(g, MAT.darkGray, 0.034, 0.048, 0.032, 0, 0.045, 0.078);        // buffer tower
  box(g, MAT.darkGray, 0.038, 0.05, 0.055, 0, 0.008, -0.088);        // flared magwell
  const magazine = curvedMagazine(g, MAT.gunmetal, 0.028, 0.032, 0.05, 0, -0.012, -0.088, -0.06, 4);
  box(magazine, MAT.black, 0.03, 0.01, 0.054, 0, -0.126, -0.012, -0.18); // baseplate

  // Controls: trigger, selector, mag release, bolt catch.
  triggerAssembly(g);
  box(g, MAT.black, 0.004, 0.008, 0.022, -0.0185, 0.032, 0.02);      // selector L
  box(g, MAT.black, 0.005, 0.01, 0.01, 0.0195, 0.024, -0.052);       // mag release button
  box(g, MAT.black, 0.004, 0.022, 0.016, -0.0185, 0.042, -0.045);    // bolt catch

  // Grip with backstrap.
  angledGrip(g, MAT.polymer, 0.032, 0.088, 0.05, 0, -0.002, 0.042, 0.3);
  box(g, MAT.grip, 0.033, 0.046, 0.044, 0, -0.042, 0.058, 0.3);
  box(g, MAT.grip, 0.027, 0.06, 0.006, 0, -0.036, 0.075, 0.3);       // backstrap

  // Buffer tube + collapsible stock with adjustment ridges.
  cyl(g, MAT.black, 0.015, 0.015, 0.15, 0, 0.06, 0.165);
  for (let i = 0; i < 4; i++) {
    box(g, MAT.gunmetal, 0.012, 0.005, 0.008, 0, 0.044, 0.125 + i * 0.022); // position notches
  }
  box(g, MAT.polymer, 0.042, 0.056, 0.095, 0, 0.048, 0.26);          // sliding stock body
  box(g, MAT.polymer, 0.03, 0.03, 0.07, 0, 0.014, 0.275, 0.5);       // stock toe wedge
  box(g, MAT.polymer, 0.044, 0.09, 0.014, 0, 0.032, 0.312);          // buttplate
  box(g, MAT.grip, 0.045, 0.092, 0.006, 0, 0.032, 0.322);            // rubber pad
  box(g, MAT.black, 0.016, 0.012, 0.03, 0, 0.016, 0.245);            // release latch
  ring(g, MAT.black, 0.007, 0.002, -0.022, 0.048, 0.24, 0, Math.PI / 2, 0, 10); // sling loop

  // Delta ring + quad-rail handguard.
  cyl(g, MAT.gunmetal, 0.021, 0.023, 0.016, 0, 0.055, -0.14);
  box(g, MAT.darkGray, 0.042, 0.042, 0.17, 0, 0.055, -0.235);        // handguard core
  rail(g, 0.081, -0.235, 0.16);                                      // top rail
  box(g, MAT.darkGray, 0.006, 0.02, 0.16, -0.024, 0.055, -0.235);    // side rail base L
  box(g, MAT.darkGray, 0.006, 0.02, 0.16, 0.024, 0.055, -0.235);     // side rail base R
  for (let i = 0; i < 3; i++) {
    const z = -0.185 - i * 0.05;
    box(g, MAT.darkGray, 0.004, 0.022, 0.008, -0.027, 0.055, z);     // side slats L
    box(g, MAT.darkGray, 0.004, 0.022, 0.008, 0.027, 0.055, z);      // side slats R
    box(g, MAT.darkGray, 0.022, 0.004, 0.008, 0, 0.031, z);          // bottom slats
  }
  box(g, MAT.darkGray, 0.02, 0.006, 0.16, 0, 0.033, -0.235);         // bottom rail base
  cyl(g, MAT.gunmetal, 0.019, 0.019, 0.012, 0, 0.055, -0.318);       // front cap ring

  // Low-profile gas block, barrel with step, birdcage.
  box(g, MAT.black, 0.02, 0.024, 0.026, 0, 0.062, -0.35);
  cyl(g, MAT.black, 0.011, 0.011, 0.02, 0, 0.055, -0.33);            // barrel step
  cyl(g, MAT.black, 0.009, 0.009, 0.13, 0, 0.055, -0.4);
  birdcage(g, 0.055, -0.497);

  // Takedown/pivot pins + front sling swivel.
  pinX(g, MAT.black, 0.0035, 0.039, 0.018, 0.055);
  pinX(g, MAT.black, 0.0035, 0.039, 0.018, -0.055);
  ring(g, MAT.black, 0.008, 0.002, -0.024, 0.04, -0.3, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.5), parts: { magazine, bolt } };
}

// ---------- M4A1-S ----------
// Suppressed M4: LONG fat can up front, slim round handguard with vent holes,
// fixed A-frame front sight. Distinct build from the A4. parts: magazine, bolt.
export function buildM4A1S() {
  const g = makeGroup();

  // Flat-top upper + receiver-length rail + rear flip sight only.
  box(g, MAT.darkGray, 0.038, 0.048, 0.22, 0, 0.058, -0.02);
  rail(g, 0.086, -0.02, 0.2);
  box(g, MAT.black, 0.024, 0.012, 0.024, 0, 0.096, 0.055);           // rear flip base
  box(g, MAT.black, 0.006, 0.014, 0.004, -0.006, 0.108, 0.055);      // aperture ear L
  box(g, MAT.black, 0.006, 0.014, 0.004, 0.006, 0.108, 0.055);       // aperture ear R

  // Charging handle (bolt part).
  const bolt = makeGroup();
  bolt.position.set(0, 0.083, 0.09);
  g.add(bolt);
  box(bolt, MAT.black, 0.012, 0.008, 0.06, 0, 0, -0.02);
  box(bolt, MAT.black, 0.038, 0.008, 0.013, 0, 0, 0.012);
  box(bolt, MAT.black, 0.008, 0.006, 0.016, -0.02, 0, 0.008);        // latch

  // Right side details.
  cylY(g, MAT.black, 0.0065, 0.0065, 0.014, 0.023, 0.06, 0.05, 0, 0, Math.PI / 2, 10); // fwd assist
  ejectionPort(g, 0.0195, 0.052, -0.05, 0.046, 0.02);
  box(g, MAT.darkGray, 0.008, 0.016, 0.016, 0.021, 0.058, -0.015, 0, 0.5, 0); // deflector

  // Lower receiver, magwell, STANAG mag.
  box(g, MAT.darkGray, 0.036, 0.042, 0.13, 0, 0.02, 0.0);
  box(g, MAT.darkGray, 0.034, 0.048, 0.032, 0, 0.045, 0.078);
  box(g, MAT.darkGray, 0.038, 0.05, 0.055, 0, 0.008, -0.088);
  const magazine = curvedMagazine(g, MAT.darkGray, 0.028, 0.032, 0.05, 0, -0.012, -0.088, -0.06, 4);
  box(magazine, MAT.black, 0.03, 0.01, 0.054, 0, -0.126, -0.012, -0.18); // baseplate
  triggerAssembly(g);
  box(g, MAT.black, 0.004, 0.008, 0.022, -0.0185, 0.032, 0.02);      // selector
  box(g, MAT.black, 0.005, 0.01, 0.01, 0.0195, 0.024, -0.052);       // mag release
  box(g, MAT.black, 0.004, 0.022, 0.016, -0.0185, 0.042, -0.045);    // bolt catch

  // Grip.
  angledGrip(g, MAT.polymer, 0.032, 0.088, 0.05, 0, -0.002, 0.042, 0.3);
  box(g, MAT.grip, 0.033, 0.046, 0.044, 0, -0.042, 0.058, 0.3);
  box(g, MAT.grip, 0.027, 0.06, 0.006, 0, -0.036, 0.075, 0.3);

  // Buffer tube + collapsible stock (leaner profile than the A4 build).
  cyl(g, MAT.black, 0.015, 0.015, 0.15, 0, 0.06, 0.165);
  for (let i = 0; i < 4; i++) {
    box(g, MAT.gunmetal, 0.012, 0.005, 0.008, 0, 0.044, 0.125 + i * 0.022);
  }
  box(g, MAT.polymer, 0.04, 0.052, 0.1, 0, 0.05, 0.258);
  box(g, MAT.polymer, 0.028, 0.028, 0.065, 0, 0.018, 0.272, 0.55);   // toe wedge
  box(g, MAT.polymer, 0.042, 0.086, 0.014, 0, 0.034, 0.312);         // buttplate
  box(g, MAT.grip, 0.043, 0.088, 0.006, 0, 0.034, 0.322);            // rubber pad
  box(g, MAT.black, 0.016, 0.012, 0.03, 0, 0.018, 0.242);            // release latch

  // Slim ROUND handguard with vent holes + end rings.
  cyl(g, MAT.gunmetal, 0.021, 0.023, 0.016, 0, 0.055, -0.14);        // delta ring
  cyl(g, MAT.black, 0.0225, 0.0225, 0.18, 0, 0.055, -0.24, 0, 0, 0, 16);
  for (let i = 0; i < 3; i++) {
    pinX(g, MAT.polymer, 0.005, 0.047, 0.062, -0.18 - i * 0.05);     // vent holes upper
    pinX(g, MAT.polymer, 0.005, 0.047, 0.048, -0.205 - i * 0.05);    // vent holes lower
  }
  cyl(g, MAT.gunmetal, 0.02, 0.02, 0.012, 0, 0.055, -0.328);         // front cap ring

  // Fixed A-frame front sight (F-marked FSB) + sling swivel.
  box(g, MAT.black, 0.024, 0.016, 0.026, 0, 0.06, -0.35);            // FSB base
  box(g, MAT.black, 0.008, 0.05, 0.018, -0.009, 0.088, -0.35, 0, 0, 0.3);  // A-frame leg L
  box(g, MAT.black, 0.008, 0.05, 0.018, 0.009, 0.088, -0.35, 0, 0, -0.3);  // A-frame leg R
  box(g, MAT.black, 0.014, 0.012, 0.018, 0, 0.112, -0.35);           // sight crown
  cylY(g, MAT.black, 0.002, 0.002, 0.014, 0, 0.124, -0.35, 0, 0, 0, 8); // front post
  ring(g, MAT.black, 0.008, 0.002, -0.014, 0.05, -0.35, 0, Math.PI / 2, 0, 10); // sling swivel

  // Short barrel, then the LONG FAT suppressor.
  cyl(g, MAT.black, 0.009, 0.009, 0.06, 0, 0.055, -0.36);
  cyl(g, MAT.gunmetal, 0.013, 0.013, 0.012, 0, 0.055, -0.384);       // mount collar
  cyl(g, MAT.black, 0.017, 0.017, 0.16, 0, 0.055, -0.46, 0, 0, 0, 16); // suppressor body
  cyl(g, MAT.gunmetal, 0.0175, 0.0175, 0.006, 0, 0.055, -0.398);     // knurl ring rear
  cyl(g, MAT.gunmetal, 0.0175, 0.0175, 0.006, 0, 0.055, -0.522);     // knurl ring front
  cyl(g, MAT.darkGray, 0.017, 0.017, 0.01, 0, 0.055, -0.538);        // end cap
  cyl(g, MAT.black, 0.006, 0.006, 0.005, 0, 0.055, -0.5445);         // bore

  // Pins.
  pinX(g, MAT.black, 0.0035, 0.039, 0.018, 0.055);
  pinX(g, MAT.black, 0.0035, 0.039, 0.018, -0.055);

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.546), parts: { magazine, bolt } };
}

// ---------- AK-47 ----------
// The icon: stamped receiver, wooden furniture, long curved bakelite mag,
// gas tube above the barrel, slanted muzzle brake, tangent rear sight ramp.
// parts: magazine, bolt.
export function buildAK47() {
  const g = makeGroup();

  // Stamped receiver + dust cover + rear trunnion.
  box(g, MAT.darkGray, 0.036, 0.05, 0.24, 0, 0.045, -0.06);
  box(g, MAT.gunmetal, 0.033, 0.014, 0.2, 0, 0.077, -0.04);          // dust cover
  cyl(g, MAT.gunmetal, 0.0155, 0.0155, 0.2, 0, 0.077, -0.04);        // cover round spine
  box(g, MAT.darkGray, 0.034, 0.048, 0.014, 0, 0.045, 0.058);        // rear trunnion
  box(g, MAT.gunmetal, 0.037, 0.005, 0.2, 0, 0.024, -0.05);          // stamped rib line

  // Bolt carrier + right-side charging knob (animates on reload).
  const bolt = makeGroup();
  bolt.position.set(0.019, 0.068, -0.03);
  g.add(bolt);
  box(bolt, MAT.steel, 0.006, 0.012, 0.09, 0, 0, 0);                 // carrier rail
  cylY(bolt, MAT.steel, 0.006, 0.006, 0.016, 0.008, 0, 0.025, 0, 0, Math.PI / 2, 10); // knob

  // Tangent rear sight ramp on the front trunnion.
  box(g, MAT.black, 0.022, 0.012, 0.05, 0, 0.086, -0.155, -0.15);    // sloped ramp
  box(g, MAT.black, 0.018, 0.006, 0.03, 0, 0.096, -0.17);            // sight leaf
  box(g, MAT.gunmetal, 0.02, 0.005, 0.008, 0, 0.1, -0.162);          // slider
  box(g, MAT.black, 0.026, 0.018, 0.014, 0, 0.078, -0.185);          // sight block base

  // Wooden handguard: lower with side bulges + upper over the gas tube.
  box(g, MAT.wood, 0.04, 0.034, 0.13, 0, 0.032, -0.245);             // lower handguard
  box(g, MAT.darkWood, 0.046, 0.014, 0.11, 0, 0.028, -0.245);        // palm-swell bulges
  box(g, MAT.wood, 0.028, 0.017, 0.11, 0, 0.086, -0.24);             // upper handguard
  cyl(g, MAT.gunmetal, 0.0175, 0.0175, 0.012, 0, 0.05, -0.182);      // rear ferrule
  cyl(g, MAT.gunmetal, 0.0165, 0.0165, 0.012, 0, 0.055, -0.312);     // front retainer cap

  // Gas tube running above the barrel into the gas block.
  cyl(g, MAT.gunmetal, 0.009, 0.009, 0.07, 0, 0.086, -0.33);
  box(g, MAT.darkGray, 0.02, 0.03, 0.026, 0, 0.075, -0.37);          // gas block (slanted)
  cone(g, MAT.darkGray, 0.008, 0.014, 0, 0.086, -0.39);              // gas block nose

  // Barrel with step, front sight tower, slanted muzzle brake.
  cyl(g, MAT.black, 0.0105, 0.0105, 0.03, 0, 0.052, -0.34);          // chamber step
  cyl(g, MAT.black, 0.008, 0.008, 0.17, 0, 0.052, -0.435);
  box(g, MAT.black, 0.018, 0.026, 0.022, 0, 0.07, -0.462);           // front sight base
  cylY(g, MAT.black, 0.002, 0.002, 0.016, 0, 0.098, -0.462, 0, 0, 0, 8); // front post
  ring(g, MAT.black, 0.0085, 0.002, 0, 0.102, -0.462, 0, 0, 0, 12);  // post hood ring
  cyl(g, MAT.gunmetal, 0.0095, 0.0095, 0.008, 0, 0.052, -0.508);     // thread collar
  box(g, MAT.black, 0.019, 0.021, 0.032, 0, 0.052, -0.527, 0, 0, 0.55); // slanted brake
  cyl(g, MAT.black, 0.005, 0.005, 0.006, 0, 0.052, -0.545);          // crown

  // Long curved bakelite 30rd magazine + well + paddle release.
  box(g, MAT.darkGray, 0.032, 0.022, 0.056, 0, 0.008, -0.09);        // mag well
  const magazine = curvedMagazine(g, MAT.orange, 0.03, 0.038, 0.054, 0, 0.005, -0.09, -0.15, 6);
  box(g, MAT.black, 0.012, 0.016, 0.022, 0, -0.002, -0.048);         // paddle release

  // Trigger group, long stamped selector lever on the right.
  triggerAssembly(g);
  box(g, MAT.black, 0.003, 0.042, 0.012, 0.0185, 0.038, 0.005, 0.35);// selector lever
  box(g, MAT.darkWood, 0.03, 0.084, 0.046, 0, -0.004, 0.032, 0.28);  // wood grip (angled)
  box(g, MAT.black, 0.031, 0.012, 0.04, 0, -0.078, 0.055, 0.28);     // grip cap

  // Wooden buttstock, dropped comb, steel buttplate.
  box(g, MAT.wood, 0.036, 0.054, 0.24, 0, 0.026, 0.19, 0.12);        // stock body
  box(g, MAT.wood, 0.03, 0.02, 0.1, 0, 0.052, 0.11, 0.12);           // comb wedge
  box(g, MAT.black, 0.038, 0.066, 0.012, 0, 0.012, 0.312, 0.12);     // steel buttplate
  pinX(g, MAT.black, 0.0035, 0.038, 0.02, 0.13);                     // stock bolt
  ring(g, MAT.black, 0.008, 0.002, -0.019, 0.014, 0.24, 0, Math.PI / 2, 0, 10); // rear sling loop

  // Ejection port, receiver rivets, front sling loop.
  ejectionPort(g, 0.0185, 0.052, -0.035, 0.046, 0.02);
  pinX(g, MAT.steel, 0.003, 0.038, 0.055, 0.03);                     // rivet
  pinX(g, MAT.steel, 0.003, 0.038, 0.055, -0.13);                    // rivet
  ring(g, MAT.black, 0.008, 0.002, -0.021, 0.03, -0.18, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.052, -0.548), parts: { magazine, bolt } };
}
