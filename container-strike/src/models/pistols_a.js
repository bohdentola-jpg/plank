// Pistols A — Glock-18, USP-S, P2000, Dual Berettas, P250.
// Conventions: muzzle along -Z, +Y up, +X right/ejection side, origin at trigger.
import * as THREE from '../three.js';
import {
  MAT, box, cyl, cylY, ring, angledGrip, triggerAssembly, ironSights,
  serrations, boxMagazine, makeGroup,
} from './common.js';

// ---------- local micro-helpers (shared pistol furniture) ----------

// Cross-pin visible on both receiver sides (axis along X).
function pinX(g, mat, r, len, y, z) {
  return cylY(g, mat, r, r, len, 0, y, z, 0, 0, Math.PI / 2, 10);
}

// Under-barrel accessory rail (slats face DOWN, unlike the top-rail helper).
function underRail(g, y, zc, len, mat = MAT.black) {
  box(g, mat, 0.02, 0.006, len, 0, y, zc);
  const n = Math.max(2, Math.floor(len / 0.016));
  for (let i = 0; i < n; i++) {
    box(g, mat, 0.022, 0.003, 0.006, 0, y - 0.0045, zc - len / 2 + (i + 0.5) * (len / n));
  }
}

// Thin darker inset on the +X side of the slide (ejection port).
function ejectionPort(slide, slideW, y, z, len = 0.03, h = 0.014, mat = MAT.gunmetal) {
  box(slide, mat, 0.002, h, len, slideW / 2, y, z);
}

// Magazine (mesh + baseplate) inside a tilted wrapper group so the baseplate
// stays glued to the mag bottom. Returns the wrapper (animated on reloads).
function tiltedMag(g, mat, w, h, d, x, y, z, tilt) {
  const wrap = makeGroup();
  wrap.position.set(x, y, z);
  wrap.rotation.x = tilt;
  g.add(wrap);
  boxMagazine(wrap, mat, w, h, d, 0, 0, 0, 0);
  return wrap;
}

// ---------- Glock-18 ----------
export function buildGlock() {
  const g = makeGroup();

  // Boxy polymer frame: dust cover + rear frame, accessory rail below.
  box(g, MAT.polymer, 0.03, 0.024, 0.075, 0, 0.026, -0.0625);   // dust cover
  box(g, MAT.polymer, 0.03, 0.024, 0.075, 0, 0.026, 0.0125);    // rear frame
  underRail(g, 0.012, -0.075, 0.045, MAT.polymer);
  box(g, MAT.polymer, 0.026, 0.008, 0.02, 0, 0.012, 0.055);     // beavertail

  // Raked Glock grip with stipple wrap, backstrap and finger grooves.
  angledGrip(g, MAT.polymer, 0.028, 0.095, 0.05, 0, 0.005, 0.035, 0.42);
  box(g, MAT.grip, 0.0295, 0.055, 0.044, 0, -0.038, 0.056, 0.42);
  box(g, MAT.grip, 0.026, 0.07, 0.006, 0, -0.046, 0.076, 0.42);
  box(g, MAT.grip, 0.029, 0.006, 0.008, 0, -0.026, 0.031, 0.42);
  box(g, MAT.grip, 0.029, 0.006, 0.008, 0, -0.040, 0.037, 0.42);
  box(g, MAT.grip, 0.029, 0.006, 0.008, 0, -0.053, 0.043, 0.42);

  // Trigger with Safe-Action blade, controls, frame pins.
  triggerAssembly(g);
  box(g, MAT.darkGray, 0.003, 0.018, 0.004, 0, -0.016, -0.003, 0.3); // trigger safety blade
  box(g, MAT.darkGray, 0.032, 0.006, 0.018, 0, 0.03, -0.018);        // takedown lever (ambi)
  box(g, MAT.darkGray, 0.004, 0.005, 0.03, -0.0165, 0.036, 0.012);   // slide stop
  box(g, MAT.darkGray, 0.004, 0.008, 0.008, -0.016, -0.004, 0.028);  // mag release
  pinX(g, MAT.darkGray, 0.0035, 0.031, 0.02, 0.028);
  pinX(g, MAT.darkGray, 0.0035, 0.031, 0.022, -0.004);

  // Extended 20-round magazine with sleeve, hanging well below the grip.
  const magazine = tiltedMag(g, MAT.polymer, 0.023, 0.14, 0.036, 0, -0.06, 0.065, 0.42);
  box(g, MAT.black, 0.025, 0.02, 0.038, 0, -0.118, 0.089, 0.42);     // mag extension sleeve

  // Squared slide with rear serrations, port, sights.
  const slide = makeGroup();
  g.add(slide);
  box(slide, MAT.black, 0.028, 0.03, 0.185, 0, 0.055, -0.045);
  box(slide, MAT.black, 0.012, 0.005, 0.185, -0.011, 0.0665, -0.045, 0, 0, 0.5);
  box(slide, MAT.black, 0.012, 0.005, 0.185, 0.011, 0.0665, -0.045, 0, 0, -0.5);
  serrations(slide, MAT.black, 0.054, 0.008, 5, 0.026, 0.007);
  ejectionPort(slide, 0.028, 0.058, -0.018);
  box(slide, MAT.gunmetal, 0.002, 0.005, 0.02, 0.0145, 0.052, 0.008); // extractor
  ironSights(slide, 0.071, 0.042, -0.128);
  box(slide, MAT.sightDot, 0.003, 0.003, 0.002, 0, 0.0795, -0.13);    // front dot

  // Stubby barrel + guide rod poking from the slide face.
  cyl(g, MAT.steel, 0.0075, 0.0075, 0.014, 0, 0.056, -0.141);
  cyl(g, MAT.darkGray, 0.005, 0.005, 0.01, 0, 0.043, -0.139);

  return { group: g, muzzle: new THREE.Vector3(0, 0.056, -0.149), parts: { slide, magazine } };
}

// ---------- USP-S (suppressed) ----------
export function buildUSPS() {
  const g = makeGroup();

  // Polymer frame with USP's grooved proprietary rail ledge.
  box(g, MAT.polymer, 0.029, 0.026, 0.08, 0, 0.025, -0.058);
  box(g, MAT.polymer, 0.029, 0.026, 0.068, 0, 0.025, 0.016);
  box(g, MAT.polymer, 0.027, 0.008, 0.05, 0, 0.009, -0.072);
  box(g, MAT.black, 0.029, 0.003, 0.05, 0, 0.005, -0.072);

  // Grip with stippling wrap and backstrap.
  angledGrip(g, MAT.polymer, 0.03, 0.095, 0.052, 0, 0.005, 0.033, 0.35);
  box(g, MAT.grip, 0.031, 0.06, 0.046, 0, -0.037, 0.055, 0.35);
  box(g, MAT.grip, 0.026, 0.075, 0.006, 0, -0.049, 0.074, 0.35);

  // Distinctive SQUARED trigger guard (built from bars, not the torus helper).
  box(g, MAT.black, 0.007, 0.026, 0.009, 0, -0.017, -0.002, 0.28);       // trigger
  box(g, MAT.polymer, 0.009, 0.044, 0.007, 0, -0.027, -0.0305, -0.12);   // guard front bar
  box(g, MAT.polymer, 0.009, 0.006, 0.052, 0, -0.049, -0.006);           // guard bottom bar
  box(g, MAT.polymer, 0.009, 0.014, 0.007, 0, -0.043, 0.019);            // guard rear riser

  // Controls, pins, exposed hammer.
  box(g, MAT.black, 0.004, 0.01, 0.026, -0.0165, 0.032, 0.02);   // slide stop
  box(g, MAT.black, 0.005, 0.009, 0.014, -0.016, 0.012, 0.042);  // safety lever
  box(g, MAT.black, 0.004, 0.007, 0.009, -0.0165, -0.002, 0.03); // mag release paddle
  pinX(g, MAT.darkGray, 0.0035, 0.03, 0.02, 0.035);
  pinX(g, MAT.darkGray, 0.0035, 0.03, 0.018, -0.005);
  box(g, MAT.gunmetal, 0.008, 0.012, 0.006, 0, 0.052, 0.053);    // hammer
  box(g, MAT.gunmetal, 0.01, 0.005, 0.01, 0, 0.06, 0.057);       // hammer spur

  const magazine = tiltedMag(g, MAT.black, 0.024, 0.105, 0.038, 0, -0.045, 0.055, 0.35);

  // Slim slide, rear serrations, all black.
  const slide = makeGroup();
  g.add(slide);
  box(slide, MAT.black, 0.028, 0.032, 0.19, 0, 0.054, -0.045);
  box(slide, MAT.black, 0.011, 0.005, 0.19, -0.0105, 0.0665, -0.045, 0, 0, 0.45);
  box(slide, MAT.black, 0.011, 0.005, 0.19, 0.0105, 0.0665, -0.045, 0, 0, -0.45);
  serrations(slide, MAT.black, 0.052, 0.01, 6, 0.028, 0.0065);
  ejectionPort(slide, 0.028, 0.057, -0.012);
  box(slide, MAT.gunmetal, 0.002, 0.004, 0.018, 0.0145, 0.05, 0.012); // extractor
  ironSights(slide, 0.073, 0.044, -0.13);

  // Threaded barrel stub + LONG cylindrical suppressor (fixed to frame,
  // so the slide can cycle without dragging the can).
  cyl(g, MAT.steel, 0.0085, 0.0085, 0.024, 0, 0.054, -0.146);
  cyl(g, MAT.darkGray, 0.0148, 0.0148, 0.01, 0, 0.054, -0.155);   // mount collar
  cyl(g, MAT.black, 0.014, 0.014, 0.09, 0, 0.054, -0.195);        // suppressor can
  ring(g, MAT.darkGray, 0.0135, 0.0018, 0, 0.054, -0.175);        // knurl ring
  ring(g, MAT.darkGray, 0.0135, 0.0018, 0, 0.054, -0.215);        // knurl ring
  cyl(g, MAT.darkGray, 0.0148, 0.0148, 0.007, 0, 0.054, -0.2365); // front cap
  cyl(g, MAT.black, 0.006, 0.006, 0.003, 0, 0.054, -0.2405);      // bore

  return { group: g, muzzle: new THREE.Vector3(0, 0.054, -0.243), parts: { slide, magazine } };
}

// ---------- P2000 ----------
export function buildP2000() {
  const g = makeGroup();

  // Compact polymer frame with short picatinny under-rail.
  box(g, MAT.polymer, 0.031, 0.025, 0.062, 0, 0.025, -0.049);
  box(g, MAT.polymer, 0.031, 0.025, 0.066, 0, 0.025, 0.015);
  underRail(g, 0.011, -0.058, 0.036, MAT.polymer);

  // Grip with PRONOUNCED stippling block, swap backstrap, finger grooves.
  angledGrip(g, MAT.polymer, 0.029, 0.082, 0.05, 0, 0.005, 0.032, 0.34);
  box(g, MAT.grip, 0.0305, 0.052, 0.047, 0, -0.032, 0.049, 0.34);
  box(g, MAT.grip, 0.025, 0.062, 0.007, 0, -0.037, 0.069, 0.34);
  box(g, MAT.grip, 0.03, 0.007, 0.006, 0, -0.024, 0.028, 0.34);
  box(g, MAT.grip, 0.03, 0.007, 0.006, 0, -0.038, 0.033, 0.34);

  // Hooked trigger guard: round guard helper + forward hook.
  triggerAssembly(g);
  box(g, MAT.polymer, 0.008, 0.012, 0.014, 0, -0.05, -0.026, 0.5); // guard hook

  // Ambidextrous controls (HK paddle release), pins, bobbed hammer, lanyard.
  box(g, MAT.black, 0.004, 0.008, 0.03, -0.017, 0.033, 0.016);   // slide stop L
  box(g, MAT.black, 0.004, 0.008, 0.03, 0.017, 0.033, 0.016);    // slide stop R
  box(g, MAT.black, 0.005, 0.006, 0.012, -0.0155, -0.004, 0.024); // paddle L
  box(g, MAT.black, 0.005, 0.006, 0.012, 0.0155, -0.004, 0.024);  // paddle R
  pinX(g, MAT.darkGray, 0.0035, 0.032, 0.02, 0.03);
  pinX(g, MAT.darkGray, 0.0035, 0.032, 0.02, -0.002);
  box(g, MAT.gunmetal, 0.007, 0.01, 0.005, 0, 0.052, 0.05);      // bobbed hammer
  ring(g, MAT.black, 0.0055, 0.0018, 0, -0.079, 0.078, 0, Math.PI / 2, 0); // lanyard loop

  const magazine = tiltedMag(g, MAT.black, 0.024, 0.095, 0.037, 0, -0.04, 0.052, 0.34);

  // Chunky slide (wider/taller than the Glock) with wide-cut serrations.
  const slide = makeGroup();
  g.add(slide);
  box(slide, MAT.black, 0.032, 0.034, 0.165, 0, 0.053, -0.0375);
  box(slide, MAT.black, 0.013, 0.005, 0.165, -0.0125, 0.0665, -0.0375, 0, 0, 0.5);
  box(slide, MAT.black, 0.013, 0.005, 0.165, 0.0125, 0.0665, -0.0375, 0, 0, -0.5);
  for (let i = 0; i < 5; i++) { // custom serrations for the wide slide
    box(slide, MAT.black, 0.001, 0.028, 0.004, -0.0165, 0.051, 0.008 + i * 0.007);
    box(slide, MAT.black, 0.001, 0.028, 0.004, 0.0165, 0.051, 0.008 + i * 0.007);
  }
  ejectionPort(slide, 0.032, 0.057, -0.014);
  box(slide, MAT.gunmetal, 0.002, 0.005, 0.016, 0.0165, 0.05, 0.01); // extractor
  ironSights(slide, 0.074, 0.04, -0.11);

  cyl(g, MAT.steel, 0.008, 0.008, 0.016, 0, 0.055, -0.124); // short barrel

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.133), parts: { slide, magazine } };
}

// ---------- Dual Berettas ----------
// One full Beretta Elite: stainless open-top slide over a black frame.
function berettaElite(px) {
  const g = makeGroup();
  g.position.x = px;

  // Black alloy frame + short rail.
  box(g, MAT.black, 0.028, 0.026, 0.062, 0, 0.026, -0.049);
  box(g, MAT.black, 0.028, 0.026, 0.068, 0, 0.026, 0.016);
  underRail(g, 0.012, -0.055, 0.034, MAT.black);

  // Grip with panels and through-screw.
  angledGrip(g, MAT.black, 0.028, 0.088, 0.048, 0, 0.006, 0.032, 0.3);
  box(g, MAT.grip, 0.0295, 0.055, 0.042, 0, -0.033, 0.048, 0.3);
  cylY(g, MAT.steel, 0.0045, 0.0045, 0.031, 0, -0.033, 0.048, 0, 0, Math.PI / 2, 10);

  triggerAssembly(g);
  box(g, MAT.gunmetal, 0.007, 0.012, 0.005, 0, 0.05, 0.052);    // ring hammer
  box(g, MAT.gunmetal, 0.011, 0.005, 0.009, 0, 0.058, 0.055);
  box(g, MAT.black, 0.004, 0.008, 0.024, -0.016, 0.034, 0.008); // slide stop
  box(g, MAT.black, 0.004, 0.006, 0.007, -0.016, -0.002, 0.028); // mag release
  pinX(g, MAT.darkGray, 0.003, 0.03, 0.02, 0.03);
  pinX(g, MAT.darkGray, 0.003, 0.03, 0.02, -0.005);

  const magazine = tiltedMag(g, MAT.black, 0.022, 0.09, 0.034, 0, -0.038, 0.05, 0.3);

  // Stainless OPEN-TOP slide: rear block + two thin rails + front block,
  // with the barrel exposed in the cutout between them.
  const slide = makeGroup();
  g.add(slide);
  box(slide, MAT.silver, 0.028, 0.028, 0.078, 0, 0.054, 0.011);      // rear block
  box(slide, MAT.silver, 0.008, 0.022, 0.09, -0.01, 0.052, -0.073);  // left rail
  box(slide, MAT.silver, 0.008, 0.022, 0.09, 0.01, 0.052, -0.073);   // right rail
  box(slide, MAT.silver, 0.028, 0.028, 0.02, 0, 0.054, -0.128);      // front block
  serrations(slide, MAT.steel, 0.052, 0.018, 4, 0.024, 0.007);
  box(slide, MAT.gunmetal, 0.002, 0.004, 0.016, 0.014, 0.052, 0);    // extractor line
  box(slide, MAT.black, 0.004, 0.007, 0.012, -0.016, 0.06, 0.042);   // safety L
  box(slide, MAT.black, 0.004, 0.007, 0.012, 0.016, 0.06, 0.042);    // safety R
  ironSights(slide, 0.071, 0.045, -0.132);

  cyl(g, MAT.steel, 0.008, 0.008, 0.128, 0, 0.058, -0.072); // exposed barrel
  cyl(g, MAT.steel, 0.009, 0.009, 0.008, 0, 0.058, -0.139); // muzzle collar

  return { g, slide, magazine };
}

export function buildDualies() {
  const g = makeGroup();
  const right = berettaElite(0.09);
  const left = berettaElite(-0.09);
  g.add(right.g, left.g);
  // Right gun's parts drive the reload/slide animation.
  return {
    group: g,
    muzzle: new THREE.Vector3(0.09, 0.058, -0.145),
    parts: { slide: right.slide, magazine: right.magazine },
  };
}

// ---------- P250 ----------
export function buildP250() {
  const g = makeGroup();

  // Dark-gray frame contrasting the black slide; rail under the dust cover.
  box(g, MAT.darkGray, 0.029, 0.025, 0.07, 0, 0.025, -0.053);
  box(g, MAT.darkGray, 0.029, 0.025, 0.068, 0, 0.025, 0.016);
  underRail(g, 0.011, -0.062, 0.04, MAT.darkGray);

  angledGrip(g, MAT.darkGray, 0.029, 0.088, 0.05, 0, 0.005, 0.033, 0.36);
  box(g, MAT.grip, 0.03, 0.05, 0.044, 0, -0.036, 0.052, 0.36);
  box(g, MAT.grip, 0.025, 0.065, 0.006, 0, -0.041, 0.072, 0.36);

  triggerAssembly(g);

  // SIG's signature large takedown lever, plus controls / pins / hammer.
  box(g, MAT.black, 0.004, 0.009, 0.032, -0.0165, 0.028, -0.008);
  cylY(g, MAT.black, 0.006, 0.006, 0.004, -0.0165, 0.028, 0.01, 0, 0, Math.PI / 2, 10);
  box(g, MAT.black, 0.004, 0.007, 0.022, -0.016, 0.036, 0.02);   // slide stop
  box(g, MAT.black, 0.005, 0.007, 0.007, -0.016, -0.004, 0.028); // mag release
  pinX(g, MAT.gunmetal, 0.0035, 0.031, 0.018, 0.034);
  pinX(g, MAT.gunmetal, 0.0035, 0.031, 0.02, -0.002);
  box(g, MAT.gunmetal, 0.007, 0.011, 0.005, 0, 0.051, 0.052);    // hammer
  box(g, MAT.gunmetal, 0.01, 0.004, 0.008, 0, 0.058, 0.055);     // spur

  const magazine = tiltedMag(g, MAT.black, 0.023, 0.098, 0.037, 0, -0.042, 0.054, 0.36);

  // Rounded black slide: canted side plates + narrow flat top strip.
  const slide = makeGroup();
  g.add(slide);
  box(slide, MAT.black, 0.028, 0.032, 0.175, 0, 0.053, -0.04);
  box(slide, MAT.black, 0.014, 0.004, 0.175, -0.0105, 0.0665, -0.04, 0, 0, 0.55);
  box(slide, MAT.black, 0.014, 0.004, 0.175, 0.0105, 0.0665, -0.04, 0, 0, -0.55);
  box(slide, MAT.black, 0.01, 0.003, 0.175, 0, 0.0705, -0.04);
  serrations(slide, MAT.black, 0.051, 0.01, 5, 0.026, 0.007);
  ejectionPort(slide, 0.028, 0.056, -0.016);
  box(slide, MAT.gunmetal, 0.002, 0.004, 0.016, 0.0145, 0.05, 0.008); // extractor
  ironSights(slide, 0.073, 0.042, -0.12);

  cyl(g, MAT.steel, 0.008, 0.008, 0.018, 0, 0.055, -0.133);  // barrel
  cyl(g, MAT.darkGray, 0.005, 0.005, 0.008, 0, 0.042, -0.128); // guide rod

  return { group: g, muzzle: new THREE.Vector3(0, 0.055, -0.145), parts: { slide, magazine } };
}
