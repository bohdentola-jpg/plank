// SMGs B — MP8, UMP-45, P90, PP-Bizon.
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
function ejectionPort(g, xFace, y, z, len = 0.034, h = 0.016, mat = MAT.gunmetal) {
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

// ---------- MP8 (fictional — modern HK UMP/MP5 hybrid) ----------
// Slim tubular upper riding on an angled polymer lower, straight 30rd mag,
// short top rail with flip sights, threaded suppressor-ready muzzle with a
// knurled thread protector. parts: magazine, bolt.
export function buildMP8() {
  const g = makeGroup();

  // Slim tubular upper receiver over a boxy alloy core.
  cyl(g, MAT.darkGray, 0.019, 0.019, 0.26, 0, 0.055, -0.05);
  box(g, MAT.darkGray, 0.036, 0.038, 0.26, 0, 0.033, -0.05);
  cyl(g, MAT.gunmetal, 0.02, 0.02, 0.016, 0, 0.055, 0.086);          // rear end cap
  cyl(g, MAT.gunmetal, 0.02, 0.02, 0.012, 0, 0.055, -0.185);         // front trunnion ring

  // Barrel + suppressor-ready threaded muzzle: knurl ring, exposed threads,
  // knurled thread protector.
  cyl(g, MAT.black, 0.009, 0.009, 0.1, 0, 0.055, -0.23);
  cyl(g, MAT.gunmetal, 0.0128, 0.0128, 0.01, 0, 0.055, -0.25);       // knurl ring
  cyl(g, MAT.steel, 0.0105, 0.0105, 0.004, 0, 0.055, -0.262);        // thread
  cyl(g, MAT.steel, 0.0105, 0.0105, 0.004, 0, 0.055, -0.269);        // thread
  cyl(g, MAT.black, 0.0115, 0.0115, 0.01, 0, 0.055, -0.277);         // thread protector

  // Short top rail + flip sights.
  rail(g, 0.081, -0.07, 0.14);
  ironSights(g, 0.092, -0.005, -0.125);

  // Non-reciprocating charging handle on the left of the tube (parts.bolt).
  const bolt = makeGroup();
  bolt.position.set(0, 0.062, -0.13);
  g.add(bolt);
  cylY(bolt, MAT.black, 0.005, 0.005, 0.022, -0.023, 0, 0, 0, 0, Math.PI / 2, 10);
  cylY(bolt, MAT.polymer, 0.0075, 0.0065, 0.02, -0.04, 0, 0, 0, 0, Math.PI / 2, 10);

  // Ejection port on the right.
  ejectionPort(g, 0.0185, 0.05, -0.05);

  // Angled polymer lower with sloped chin and flared magwell.
  box(g, MAT.polymer, 0.038, 0.03, 0.17, 0, 0.008, -0.015);
  box(g, MAT.polymer, 0.036, 0.02, 0.05, 0, -0.004, -0.115, 0.35);   // sloped chin
  box(g, MAT.polymer, 0.032, 0.03, 0.052, 0, -0.005, -0.075);        // magwell

  // Straight 30rd magazine with witness ribs.
  const magazine = tiltedMag(g, MAT.black, 0.024, 0.115, 0.044, 0, -0.022, -0.075, 0.06);
  box(magazine, MAT.darkGray, 0.001, 0.1, 0.004, -0.0125, -0.004, 0.012);
  box(magazine, MAT.darkGray, 0.001, 0.1, 0.004, 0.0125, -0.004, 0.012);

  // Trigger group + grip with backstrap angle and stipple panel.
  triggerAssembly(g);
  angledGrip(g, MAT.polymer, 0.032, 0.088, 0.048, 0, 0, 0.045, 0.26);
  box(g, MAT.grip, 0.033, 0.048, 0.042, 0, -0.038, 0.058, 0.26);
  box(g, MAT.grip, 0.027, 0.06, 0.006, 0, -0.043, 0.077, 0.26);      // backstrap

  // Retractable stock: latch housing, twin slide rails, buttplate + pad.
  box(g, MAT.black, 0.044, 0.04, 0.035, 0, 0.05, 0.1);               // latch housing
  box(g, MAT.gunmetal, 0.008, 0.012, 0.16, -0.017, 0.058, 0.185);    // rail L
  box(g, MAT.gunmetal, 0.008, 0.012, 0.16, 0.017, 0.058, 0.185);     // rail R
  box(g, MAT.polymer, 0.04, 0.075, 0.016, 0, 0.035, 0.27);           // buttplate
  box(g, MAT.grip, 0.041, 0.077, 0.006, 0, 0.035, 0.281);            // rubber pad

  // Controls, pins, sling points.
  box(g, MAT.black, 0.005, 0.009, 0.018, -0.02, 0.02, 0.028);        // ambi selector L
  box(g, MAT.black, 0.005, 0.009, 0.018, 0.02, 0.02, 0.028);         // ambi selector R
  box(g, MAT.black, 0.01, 0.016, 0.006, 0, -0.006, -0.046);          // paddle mag release
  pinX(g, MAT.black, 0.0035, 0.04, 0.03, 0.055);
  pinX(g, MAT.black, 0.0035, 0.04, 0.03, -0.1);
  ring(g, MAT.black, 0.007, 0.002, -0.021, 0.055, 0.095, 0, Math.PI / 2, 0, 10);
  box(g, MAT.black, 0.004, 0.006, 0.016, -0.019, 0.06, -0.16);       // front sling slot

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.283), parts: { magazine, bolt } };
}

// ---------- UMP-45 (Heckler & Koch) ----------
// Chunky all-polymer body, boxy receiver taller at the rear, side-folding
// stock (extended) with a big hinge block, fat straight .45 magazine,
// oversized trigger guard. parts: magazine.
export function buildUMP45() {
  const g = makeGroup();

  // Boxy polymer receiver: lower front half, taller rear half.
  box(g, MAT.polymer, 0.046, 0.05, 0.16, 0, 0.042, -0.1);
  box(g, MAT.polymer, 0.048, 0.072, 0.17, 0, 0.048, 0.055);
  box(g, MAT.polymer, 0.018, 0.008, 0.17, -0.019, 0.082, 0.055, 0, 0, 0.5);
  box(g, MAT.polymer, 0.018, 0.008, 0.17, 0.019, 0.082, 0.055, 0, 0, -0.5);
  box(g, MAT.polymer, 0.04, 0.04, 0.05, 0, 0.05, -0.2);              // nose block
  box(g, MAT.polymer, 0.042, 0.024, 0.05, 0, 0.02, -0.185, 0.4);     // sloped chin

  // Barrel with threaded muzzle nut.
  cyl(g, MAT.black, 0.0105, 0.0105, 0.1, 0, 0.058, -0.27);
  cyl(g, MAT.steel, 0.0115, 0.0115, 0.006, 0, 0.058, -0.305);        // thread ring
  cyl(g, MAT.gunmetal, 0.0125, 0.0125, 0.012, 0, 0.058, -0.315);     // muzzle nut

  // Rear top rail + tall flip sights (front on a riser above the nose).
  rail(g, 0.088, 0.05, 0.16);
  ironSights(g, 0.098, 0.09, -0.19);
  box(g, MAT.polymer, 0.012, 0.03, 0.012, 0, 0.083, -0.19);          // front sight riser

  // Charging handle on the left front.
  cylY(g, MAT.black, 0.005, 0.005, 0.02, -0.028, 0.06, -0.13, 0, 0, Math.PI / 2, 10);
  cylY(g, MAT.polymer, 0.0075, 0.0065, 0.02, -0.044, 0.06, -0.13, 0, 0, Math.PI / 2, 10);

  // Ejection port + brass deflector on the right.
  ejectionPort(g, 0.0235, 0.052, -0.05, 0.038, 0.02);
  box(g, MAT.polymer, 0.006, 0.024, 0.014, 0.025, 0.05, -0.024);

  // Oversized (gloved-hand) trigger guard.
  triggerAssembly(g, 1.3);
  box(g, MAT.polymer, 0.008, 0.005, 0.08, 0, -0.047, -0.02);         // guard bottom bar
  box(g, MAT.polymer, 0.008, 0.032, 0.006, 0, -0.032, -0.058, -0.2); // guard front riser

  // Pistol grip with stipple panels.
  angledGrip(g, MAT.polymer, 0.034, 0.09, 0.05, 0, 0, 0.05, 0.24);
  box(g, MAT.grip, 0.035, 0.05, 0.044, 0, -0.038, 0.063, 0.24);
  box(g, MAT.grip, 0.029, 0.062, 0.006, 0, -0.043, 0.083, 0.24);     // backstrap

  // Flared magwell + fat straight .45 mag with witness slots.
  box(g, MAT.polymer, 0.036, 0.035, 0.056, 0, -0.002, -0.085);
  const magazine = tiltedMag(g, MAT.polymer, 0.031, 0.135, 0.052, 0, -0.025, -0.085, 0.04);
  box(magazine, MAT.black, 0.001, 0.11, 0.005, -0.016, -0.005, 0.01);
  box(magazine, MAT.black, 0.001, 0.11, 0.005, 0.016, -0.005, 0.01);

  // Side-folding stock, modeled EXTENDED: big hinge block + skeleton arm.
  box(g, MAT.polymer, 0.05, 0.062, 0.04, 0, 0.048, 0.16);            // big hinge block
  cylY(g, MAT.gunmetal, 0.006, 0.006, 0.066, 0, 0.048, 0.176);       // hinge pin
  box(g, MAT.polymer, 0.034, 0.018, 0.13, 0, 0.068, 0.245);          // upper arm
  box(g, MAT.polymer, 0.034, 0.016, 0.13, 0, 0.02, 0.248, -0.08);    // lower arm
  box(g, MAT.polymer, 0.036, 0.095, 0.022, 0, 0.04, 0.307);          // buttplate
  box(g, MAT.grip, 0.037, 0.097, 0.006, 0, 0.04, 0.321);             // rubber pad

  // Controls, pins, sling points.
  box(g, MAT.black, 0.005, 0.01, 0.02, -0.024, 0.022, 0.03);         // ambi selector L
  box(g, MAT.black, 0.005, 0.01, 0.02, 0.024, 0.022, 0.03);          // ambi selector R
  box(g, MAT.black, 0.012, 0.016, 0.006, 0, -0.024, -0.054);         // paddle mag release
  pinX(g, MAT.black, 0.004, 0.05, 0.03, 0.03);
  pinX(g, MAT.black, 0.004, 0.05, 0.03, -0.09);
  pinX(g, MAT.black, 0.004, 0.052, 0.07, 0.12);
  ring(g, MAT.black, 0.008, 0.002, -0.022, 0.062, 0.15, 0, Math.PI / 2, 0, 10);
  box(g, MAT.black, 0.004, 0.006, 0.016, -0.021, 0.05, -0.17);       // front sling slot

  return { group: g, muzzle: new THREE.Vector3(0, 0.058, -0.322), parts: { magazine } };
}

// ---------- P90 (FN Herstal PS90/P90) ----------
// Unmistakable bullpup loaf: stacked tapering body boxes, TOP-MOUNTED
// translucent horizontal magazine, thumbhole grip loop, stubby barrel,
// integrated reflex sight bridge straddling the mag. parts: magazine.
export function buildP90() {
  const g = makeGroup();

  // One smooth wedge body: four stacked boxes with tapering widths.
  box(g, MAT.polymerLt, 0.06, 0.038, 0.36, 0, 0, 0.045);             // belly (widest)
  box(g, MAT.polymerLt, 0.052, 0.036, 0.4, 0, 0.034, 0.03);          // mid
  box(g, MAT.polymerLt, 0.044, 0.032, 0.38, 0, 0.065, 0.04);         // upper
  box(g, MAT.polymerLt, 0.034, 0.022, 0.35, 0, 0.09, 0.035);         // spine (narrowest)

  // Butt: the body IS the stock — plate + rubber pad.
  box(g, MAT.polymer, 0.056, 0.1, 0.014, 0, 0.04, 0.235);
  box(g, MAT.grip, 0.057, 0.102, 0.006, 0, 0.04, 0.245);

  // TOP-MOUNTED translucent horizontal 50rd magazine (parts.magazine):
  // long flat polymerLt box lying along the top, dark feed block at the
  // front, brass round-stack showing through, witness ribs on the edges.
  const magazine = makeGroup();
  magazine.position.set(0, 0.11, -0.005);
  g.add(magazine);
  box(magazine, MAT.polymerLt, 0.032, 0.017, 0.31, 0, 0, 0);
  box(magazine, MAT.black, 0.03, 0.021, 0.032, 0, -0.001, -0.14);    // feed block
  box(magazine, MAT.brass, 0.018, 0.007, 0.26, 0, -0.002, 0.015);    // rounds inside
  box(magazine, MAT.polymer, 0.0015, 0.014, 0.29, -0.0165, 0, 0);    // rib L
  box(magazine, MAT.polymer, 0.0015, 0.014, 0.29, 0.0165, 0, 0);     // rib R

  // Integrated reflex sight bridge straddling the magazine.
  box(g, MAT.polymer, 0.008, 0.05, 0.05, -0.024, 0.115, 0.06);       // post L
  box(g, MAT.polymer, 0.008, 0.05, 0.05, 0.024, 0.115, 0.06);        // post R
  box(g, MAT.darkGray, 0.058, 0.012, 0.052, 0, 0.145, 0.06);         // bridge
  cyl(g, MAT.black, 0.011, 0.011, 0.045, 0, 0.162, 0.06);            // reflex tube
  cyl(g, MAT.scopeGlass, 0.009, 0.009, 0.003, 0, 0.162, 0.036);      // glass
  box(g, MAT.sightDot, 0.004, 0.004, 0.004, 0, 0.175, 0.075);        // backup dot

  // Short barrel poking out of the nose + flash hider.
  cyl(g, MAT.black, 0.009, 0.009, 0.1, 0, 0.07, -0.215);
  cyl(g, MAT.gunmetal, 0.011, 0.011, 0.005, 0, 0.07, -0.258);        // collar
  cyl(g, MAT.black, 0.012, 0.0115, 0.024, 0, 0.07, -0.271);          // flash hider

  // Sloped nose faces (top slope + chin) framing the barrel.
  box(g, MAT.polymerLt, 0.04, 0.03, 0.06, 0, 0.085, -0.155, 0.55);
  box(g, MAT.polymerLt, 0.045, 0.03, 0.05, 0, 0.005, -0.15, -0.5);

  // Ambidextrous charging handles on the nose sides.
  box(g, MAT.polymer, 0.008, 0.014, 0.045, -0.028, 0.055, -0.13);
  box(g, MAT.polymer, 0.008, 0.014, 0.045, 0.028, 0.055, -0.13);

  // Thumbhole grip loop: rear riser, bottom bar, front bar (foregrip),
  // thumb shelf over the trigger hand.
  box(g, MAT.polymer, 0.032, 0.055, 0.04, 0, -0.045, 0.04, -0.15);   // rear riser
  box(g, MAT.polymer, 0.032, 0.016, 0.16, 0, -0.068, -0.03);         // bottom bar
  box(g, MAT.polymer, 0.032, 0.055, 0.028, 0, -0.042, -0.105, 0.1);  // front bar
  box(g, MAT.polymer, 0.032, 0.01, 0.07, 0, -0.021, -0.065);         // thumb shelf
  box(g, MAT.grip, 0.033, 0.006, 0.024, 0, -0.03, -0.104, 0.1);      // finger groove
  box(g, MAT.grip, 0.033, 0.006, 0.024, 0, -0.052, -0.102, 0.1);     // finger groove
  triggerAssembly(g);

  // Downward ejection chute under the belly.
  box(g, MAT.gunmetal, 0.02, 0.003, 0.05, 0, -0.0197, 0.07);

  // Mag release levers beside the mag rear, body screws, sling points.
  box(g, MAT.polymer, 0.006, 0.01, 0.03, -0.019, 0.098, 0.14);
  box(g, MAT.polymer, 0.006, 0.01, 0.03, 0.019, 0.098, 0.14);
  pinX(g, MAT.black, 0.003, 0.054, 0.034, 0.0);
  pinX(g, MAT.black, 0.003, 0.054, 0.034, 0.1);
  pinX(g, MAT.black, 0.003, 0.054, 0.034, 0.18);
  ring(g, MAT.black, 0.007, 0.002, -0.028, 0.06, 0.2, 0, Math.PI / 2, 0, 10);
  ring(g, MAT.black, 0.007, 0.002, -0.028, 0.03, -0.12, 0, Math.PI / 2, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.07, -0.285), parts: { magazine } };
}

// ---------- PP-Bizon (Izhmash) ----------
// AK-derived receiver and dust cover with the signature HELICAL DRUM
// magazine slung under the barrel from trigger guard to muzzle, plus a
// side-folding skeleton stock (extended). parts: magazine (the drum).
export function buildBizon() {
  const g = makeGroup();

  // AK stamped receiver + dust cover with rounded spine.
  box(g, MAT.darkGray, 0.04, 0.048, 0.24, 0, 0.045, 0.02);
  box(g, MAT.gunmetal, 0.038, 0.016, 0.2, 0, 0.077, 0.01);           // dust cover
  cyl(g, MAT.gunmetal, 0.016, 0.016, 0.2, 0, 0.082, 0.01);           // rounded spine

  // AK rear sight block + tangent leaf with slider.
  box(g, MAT.black, 0.032, 0.024, 0.03, 0, 0.075, -0.105);
  box(g, MAT.black, 0.014, 0.004, 0.055, 0, 0.09, -0.085, -0.12);    // tangent leaf
  box(g, MAT.gunmetal, 0.016, 0.006, 0.008, 0, 0.092, -0.095);       // slider

  // Barrel + threaded muzzle nut.
  cyl(g, MAT.black, 0.0095, 0.0095, 0.16, 0, 0.055, -0.21);
  cyl(g, MAT.gunmetal, 0.011, 0.011, 0.012, 0, 0.055, -0.293);       // muzzle nut
  cyl(g, MAT.steel, 0.0105, 0.0105, 0.004, 0, 0.055, -0.285);        // thread ring

  // AK front sight tower: block, post, protective ears.
  box(g, MAT.black, 0.016, 0.03, 0.018, 0, 0.062, -0.255);
  box(g, MAT.black, 0.004, 0.018, 0.004, 0, 0.086, -0.255);          // post
  box(g, MAT.black, 0.003, 0.016, 0.01, -0.009, 0.084, -0.255, 0, 0, 0.3);
  box(g, MAT.black, 0.003, 0.016, 0.01, 0.009, 0.084, -0.255, 0, 0, -0.3);

  // Short polymer upper handguard with rib lines.
  box(g, MAT.polymer, 0.036, 0.02, 0.075, 0, 0.066, -0.16);
  box(g, MAT.polymerLt, 0.037, 0.003, 0.06, 0, 0.073, -0.16);        // rib line
  box(g, MAT.black, 0.038, 0.018, 0.012, 0, 0.062, -0.122);          // handguard cap

  // HELICAL DRUM MAGAZINE (parts.magazine): long cylinder along Z slung
  // under the barrel from the trigger guard to the muzzle, with helical
  // ribs, end caps and the feed tower clipping into the receiver.
  const magazine = makeGroup();
  magazine.position.set(0, 0.012, -0.15);
  g.add(magazine);
  cyl(magazine, MAT.polymer, 0.026, 0.026, 0.25, 0, 0, 0);           // drum tube
  cyl(magazine, MAT.black, 0.027, 0.027, 0.014, 0, 0, -0.122);       // front cap
  cyl(magazine, MAT.black, 0.027, 0.027, 0.014, 0, 0, 0.122);        // rear cap
  ring(magazine, MAT.polymerLt, 0.026, 0.002, 0, 0, -0.075, 0, 0, 0, 14); // helical rib
  ring(magazine, MAT.polymerLt, 0.026, 0.002, 0, 0, -0.025, 0, 0, 0, 14); // helical rib
  ring(magazine, MAT.polymerLt, 0.026, 0.002, 0, 0, 0.025, 0, 0, 0, 14);  // helical rib
  ring(magazine, MAT.polymerLt, 0.026, 0.002, 0, 0, 0.075, 0, 0, 0, 14);  // helical rib
  box(magazine, MAT.black, 0.018, 0.018, 0.03, 0, 0.028, 0.105);     // feed tower
  box(magazine, MAT.black, 0.012, 0.01, 0.02, 0, 0.026, -0.11);      // front latch lug

  // AK pistol grip + trigger group.
  triggerAssembly(g);
  box(g, MAT.black, 0.008, 0.005, 0.055, 0, -0.038, -0.012);         // guard bottom bar
  angledGrip(g, MAT.polymer, 0.032, 0.085, 0.048, 0, -0.002, 0.05, 0.28);
  box(g, MAT.grip, 0.033, 0.046, 0.042, 0, -0.04, 0.063, 0.28);

  // Side-folding skeleton stock, modeled EXTENDED: hinge block, twin
  // struts with a vertical cross member, skeleton buttplate.
  box(g, MAT.gunmetal, 0.02, 0.045, 0.028, 0, 0.05, 0.15);           // hinge block
  cylY(g, MAT.black, 0.005, 0.005, 0.05, 0, 0.05, 0.152);            // hinge pin
  box(g, MAT.darkGray, 0.012, 0.014, 0.15, 0, 0.066, 0.235);         // upper strut
  box(g, MAT.darkGray, 0.012, 0.012, 0.15, 0, 0.028, 0.238, -0.06);  // lower strut
  box(g, MAT.darkGray, 0.012, 0.034, 0.012, 0, 0.047, 0.19);         // cross member
  box(g, MAT.darkGray, 0.014, 0.078, 0.018, 0, 0.042, 0.305);        // skeleton buttplate
  box(g, MAT.grip, 0.015, 0.08, 0.005, 0, 0.042, 0.316);             // butt pad

  // Ejection port, charging handle knob, long AK selector on the right.
  ejectionPort(g, 0.0205, 0.055, -0.03, 0.036, 0.018);
  box(g, MAT.black, 0.012, 0.012, 0.026, 0.025, 0.06, 0.005);        // charging handle
  box(g, MAT.black, 0.004, 0.012, 0.065, 0.021, 0.045, 0.04, 0.15);  // selector lever

  // Rivets/pins + sling loops.
  pinX(g, MAT.black, 0.0035, 0.042, 0.04, 0.1);
  pinX(g, MAT.black, 0.0035, 0.042, 0.04, -0.07);
  pinX(g, MAT.black, 0.003, 0.042, 0.062, -0.1);
  ring(g, MAT.black, 0.008, 0.002, -0.011, 0.062, -0.24, 0, Math.PI / 2, 0, 10); // front loop
  ring(g, MAT.black, 0.008, 0.002, -0.021, 0.045, 0.13, 0, Math.PI / 2, 0, 10);  // rear loop

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.3), parts: { magazine } };
}
