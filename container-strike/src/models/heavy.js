// Heavy — Nova, XM1014, MAG-7, Sawed-Off, M249, Negev.
// Conventions: muzzle along -Z, +Y up, +X right/ejection side, origin at trigger.
import * as THREE from '../three.js';
import {
  MAT, box, cyl, cylY, sphere, ring, angledGrip, triggerAssembly,
  ironSights, rail, boxMagazine, makeGroup,
} from './common.js';

// ---------- local micro-helpers (shared heavy-gun furniture) ----------

// Cross-pin / rivet visible on both receiver sides (axis along X).
function pinX(g, mat, r, len, y, z) {
  return cylY(g, mat, r, r, len, 0, y, z, 0, 0, Math.PI / 2, 10);
}

// Ribbed sliding forend: body box + raised grip ribs. Returns wrapper group
// (translated along Z by the pump-action animation).
function pumpForend(parent, mat, w, h, d, x, y, z, ribs = 5, ribMat = MAT.black) {
  const grp = makeGroup();
  grp.position.set(x, y, z);
  parent.add(grp);
  box(grp, mat, w, h, d, 0, 0, 0);
  for (let i = 0; i < ribs; i++) {
    box(grp, ribMat, w + 0.003, h * 0.8, 0.005, 0, 0, -d / 2 + (i + 0.75) * (d / (ribs + 0.5)));
  }
  return grp;
}

// Thin darker inset on the +X receiver wall (ejection port).
function ejectionPort(g, x, y, z, len = 0.05, h = 0.02, mat = MAT.gunmetal) {
  return box(g, mat, 0.002, h, len, x, y, z);
}

// Side sling loop (plane faces +-X).
function slingLoop(g, x, y, z, r = 0.007) {
  return ring(g, MAT.black, r, 0.002, x, y, z, 0, Math.PI / 2, 0, 12);
}

// ---------- Nova (pump shotgun) ----------
export function buildNova() {
  const g = makeGroup();

  // Receiver: distinct upper/lower masses + top ridge.
  box(g, MAT.darkGray, 0.038, 0.036, 0.17, 0, 0.058, -0.015);      // upper receiver
  box(g, MAT.black, 0.036, 0.032, 0.15, 0, 0.026, -0.01);          // lower/trigger housing
  box(g, MAT.darkGray, 0.028, 0.006, 0.17, 0, 0.079, -0.015);      // sight-plane ridge
  ejectionPort(g, 0.0195, 0.058, -0.045, 0.055, 0.02);
  box(g, MAT.black, 0.022, 0.004, 0.05, 0, 0.009, -0.03);          // shell loading port
  pinX(g, MAT.gunmetal, 0.004, 0.039, 0.05, 0.045);                // trigger-group pins
  pinX(g, MAT.gunmetal, 0.004, 0.039, 0.05, 0.015);

  // Barrel with ventilated rib and twin beads.
  cyl(g, MAT.black, 0.011, 0.012, 0.50, 0, 0.058, -0.35);          // barrel -0.10..-0.60
  cyl(g, MAT.gunmetal, 0.0127, 0.0127, 0.014, 0, 0.058, -0.595);   // muzzle collar
  box(g, MAT.black, 0.012, 0.003, 0.46, 0, 0.0765, -0.36);         // vent rib plane
  for (let i = 0; i < 6; i++) {
    box(g, MAT.black, 0.008, 0.006, 0.008, 0, 0.071, -0.155 - i * 0.078); // rib standoffs
  }
  sphere(g, MAT.silver, 0.0032, 0, 0.0805, -0.585, 8);             // front bead
  sphere(g, MAT.steel, 0.0025, 0, 0.0795, -0.36, 8);               // mid bead

  // Magazine tube parallel below the barrel.
  cyl(g, MAT.black, 0.0095, 0.0095, 0.40, 0, 0.024, -0.30);        // tube -0.10..-0.50
  cyl(g, MAT.gunmetal, 0.011, 0.011, 0.018, 0, 0.024, -0.50);      // mag cap
  ring(g, MAT.black, 0.007, 0.002, 0, 0.009, -0.505, 0, Math.PI / 2, 0, 12); // front sling loop
  box(g, MAT.black, 0.006, 0.026, 0.012, 0, 0.041, -0.485);        // barrel band clamp

  // Sliding forend (animated on pump).
  const pump = pumpForend(g, MAT.polymer, 0.04, 0.036, 0.13, 0, 0.028, -0.26, 6);
  box(pump, MAT.polymer, 0.042, 0.04, 0.012, 0, 0, -0.072);        // front lip
  box(g, MAT.gunmetal, 0.004, 0.006, 0.16, 0.017, 0.036, -0.15);   // action bar R
  box(g, MAT.gunmetal, 0.004, 0.006, 0.16, -0.017, 0.036, -0.15);  // action bar L

  // Dark polymer stock with pistol-grip-ish comb.
  angledGrip(g, MAT.polymer, 0.032, 0.085, 0.052, 0, 0.02, 0.035, 0.5);
  box(g, MAT.grip, 0.033, 0.04, 0.04, 0, -0.022, 0.062, 0.5);      // grip stipple wrap
  box(g, MAT.polymer, 0.032, 0.05, 0.21, 0, 0.04, 0.185, 0.06);    // stock body (comb drop)
  box(g, MAT.polymer, 0.03, 0.045, 0.09, 0, -0.005, 0.24, 0.35);   // toe riser
  box(g, MAT.polymer, 0.026, 0.012, 0.13, 0, 0.068, 0.19, 0.06);   // comb strip
  box(g, MAT.grip, 0.034, 0.1, 0.018, 0, 0.02, 0.30);              // rubber recoil pad
  slingLoop(g, 0, -0.02, 0.285);                                   // rear sling loop

  triggerAssembly(g);
  pinX(g, MAT.silver, 0.004, 0.04, -0.032, 0.028);                 // cross-bolt safety

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.058, -0.605),
    parts: { pump },
  };
}

// ---------- XM1014 (semi-auto tactical shotgun) ----------
export function buildXM1014() {
  const g = makeGroup();

  // Receiver with picatinny top rail.
  box(g, MAT.darkGray, 0.04, 0.05, 0.20, 0, 0.048, 0.0);           // upper receiver
  box(g, MAT.black, 0.036, 0.026, 0.18, 0, 0.018, 0.0);            // lower/trigger housing
  rail(g, 0.082, -0.005, 0.15, MAT.black);
  ejectionPort(g, 0.0205, 0.052, -0.03, 0.06, 0.022);
  box(g, MAT.darkGray, 0.006, 0.01, 0.014, -0.021, 0.03, 0.03);    // bolt release (left)
  pinX(g, MAT.gunmetal, 0.004, 0.041, 0.03, 0.06);
  pinX(g, MAT.gunmetal, 0.004, 0.041, 0.03, 0.085);

  // Bolt group: carrier face in the port + charging handle on the right.
  const bolt = makeGroup();
  g.add(bolt);
  box(bolt, MAT.silver, 0.004, 0.018, 0.05, 0.019, 0.052, -0.03);  // bolt carrier face
  cylY(bolt, MAT.steel, 0.004, 0.004, 0.026, 0.032, 0.052, -0.02, 0, 0, Math.PI / 2, 10);
  sphere(bolt, MAT.black, 0.007, 0.046, 0.052, -0.02, 8);          // handle knob

  // Fat cylindrical forend (iconic M4 handguard) with grip rings + gas pistons.
  cyl(g, MAT.polymer, 0.027, 0.028, 0.20, 0, 0.048, -0.20);        // handguard -0.10..-0.30
  ring(g, MAT.black, 0.0277, 0.0018, 0, 0.048, -0.15);
  ring(g, MAT.black, 0.0277, 0.0018, 0, 0.048, -0.21);
  ring(g, MAT.black, 0.0277, 0.0018, 0, 0.048, -0.27);
  cyl(g, MAT.gunmetal, 0.006, 0.006, 0.05, -0.012, 0.076, -0.135); // gas piston L
  cyl(g, MAT.gunmetal, 0.006, 0.006, 0.05, 0.012, 0.076, -0.135);  // gas piston R

  // Barrel + magazine tube.
  cyl(g, MAT.black, 0.011, 0.012, 0.28, 0, 0.052, -0.44);          // barrel -0.30..-0.58
  cyl(g, MAT.gunmetal, 0.013, 0.013, 0.012, 0, 0.052, -0.572);     // muzzle collar
  cyl(g, MAT.black, 0.009, 0.009, 0.20, 0, 0.016, -0.40);          // mag tube -0.30..-0.50
  cyl(g, MAT.gunmetal, 0.0105, 0.0105, 0.016, 0, 0.016, -0.50);    // tube cap
  box(g, MAT.black, 0.006, 0.026, 0.012, 0, 0.034, -0.49);         // barrel band
  slingLoop(g, 0, 0.003, -0.49);                                   // front sling loop

  // Ghost-ring rear sight + winged front post.
  box(g, MAT.black, 0.02, 0.008, 0.016, 0, 0.093, 0.07);           // rear sight base
  ring(g, MAT.black, 0.0075, 0.0022, 0, 0.105, 0.07, 0, 0, 0, 14); // ghost ring aperture
  box(g, MAT.black, 0.004, 0.016, 0.006, -0.012, 0.102, 0.07);     // wing L
  box(g, MAT.black, 0.004, 0.016, 0.006, 0.012, 0.102, 0.07);      // wing R
  box(g, MAT.black, 0.014, 0.008, 0.014, 0, 0.068, -0.55);         // front sight base
  box(g, MAT.black, 0.004, 0.016, 0.005, 0, 0.078, -0.55);         // front post
  box(g, MAT.black, 0.003, 0.014, 0.005, -0.008, 0.076, -0.55, 0, 0, 0.25);  // wing L
  box(g, MAT.black, 0.003, 0.014, 0.005, 0.008, 0.076, -0.55, 0, 0, -0.25);  // wing R

  // Black synthetic stock with pistol grip.
  angledGrip(g, MAT.polymer, 0.032, 0.09, 0.05, 0, 0.012, 0.035, 0.42);
  box(g, MAT.grip, 0.033, 0.045, 0.042, 0, -0.026, 0.06, 0.42);    // grip texture panel
  box(g, MAT.polymer, 0.032, 0.048, 0.20, 0, 0.045, 0.20, 0.05);   // stock body
  box(g, MAT.polymer, 0.028, 0.014, 0.12, 0, 0.073, 0.21, 0.05);   // cheek comb
  box(g, MAT.polymer, 0.03, 0.05, 0.10, 0, 0.0, 0.245, 0.3);       // toe riser
  box(g, MAT.grip, 0.034, 0.105, 0.02, 0, 0.028, 0.305);           // recoil pad
  slingLoop(g, 0, -0.012, 0.295);                                  // rear sling loop

  triggerAssembly(g);
  pinX(g, MAT.silver, 0.0035, 0.038, -0.033, 0.028);               // cross-bolt safety

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.052, -0.58),
    parts: { bolt },
  };
}

// ---------- MAG-7 (compact mag-fed pump shotgun) ----------
export function buildMAG7() {
  const g = makeGroup();

  // Bullpup-ish boxy receiver with rear butt block.
  box(g, MAT.darkGray, 0.044, 0.06, 0.24, 0, 0.05, 0.02);          // receiver -0.10..+0.14
  box(g, MAT.black, 0.046, 0.018, 0.22, 0, 0.087, 0.02);           // top cover strip
  box(g, MAT.polymer, 0.044, 0.075, 0.03, 0, 0.045, 0.155);        // rear butt block
  box(g, MAT.grip, 0.046, 0.06, 0.014, 0, 0.045, 0.177);           // rubber butt pad
  ejectionPort(g, 0.0225, 0.055, -0.02, 0.055, 0.022);
  pinX(g, MAT.gunmetal, 0.004, 0.045, 0.035, 0.10);
  pinX(g, MAT.gunmetal, 0.004, 0.045, 0.035, -0.06);

  // Top carry rail on risers, with irons.
  box(g, MAT.black, 0.016, 0.01, 0.03, 0, 0.101, -0.06);           // riser F
  box(g, MAT.black, 0.016, 0.01, 0.03, 0, 0.101, 0.08);            // riser R
  rail(g, 0.11, 0.01, 0.24, MAT.black);
  ironSights(g, 0.12, 0.09, -0.09);

  // Pistol grip housing the box magazine BEHIND the trigger.
  angledGrip(g, MAT.polymer, 0.035, 0.08, 0.05, 0, 0.02, 0.055, 0.12);
  box(g, MAT.grip, 0.036, 0.05, 0.044, 0, -0.02, 0.062, 0.12);     // grip stipple
  const magazine = makeGroup();
  magazine.position.set(0, -0.055, 0.065);
  magazine.rotation.x = 0.12;
  g.add(magazine);
  boxMagazine(magazine, MAT.black, 0.03, 0.085, 0.042, 0, -0.02, 0);
  box(g, MAT.darkGray, 0.01, 0.012, 0.012, 0, -0.005, 0.03);       // mag release lever

  // Stubby shrouded barrel.
  box(g, MAT.darkGray, 0.04, 0.048, 0.09, 0, 0.055, -0.145);       // barrel shroud
  cyl(g, MAT.black, 0.0125, 0.0135, 0.20, 0, 0.055, -0.24);        // barrel -0.14..-0.34
  cyl(g, MAT.gunmetal, 0.0145, 0.0145, 0.012, 0, 0.055, -0.335);   // muzzle nut
  box(g, MAT.black, 0.012, 0.008, 0.012, 0, 0.075, -0.305);        // front sight base
  box(g, MAT.black, 0.004, 0.012, 0.005, 0, 0.085, -0.305);        // front sight post

  // Pump forend + action bars.
  const pump = pumpForend(g, MAT.polymer, 0.042, 0.038, 0.11, 0, 0.026, -0.23, 5);
  box(g, MAT.gunmetal, 0.004, 0.006, 0.14, 0.019, 0.03, -0.15);    // action bar R
  box(g, MAT.gunmetal, 0.004, 0.006, 0.14, -0.019, 0.03, -0.15);   // action bar L

  triggerAssembly(g);
  slingLoop(g, -0.024, 0.05, 0.13);                                // side sling loop

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.055, -0.345),
    parts: { magazine, pump },
  };
}

// ---------- Sawed-Off (brutally short pump shotgun) ----------
export function buildSawedOff() {
  const g = makeGroup();

  // Blued steel receiver with bright side plates.
  box(g, MAT.gunmetal, 0.038, 0.058, 0.15, 0, 0.045, 0.0);         // receiver -0.075..+0.075
  box(g, MAT.steel, 0.002, 0.04, 0.11, 0.02, 0.045, 0.0);          // side plate R
  box(g, MAT.steel, 0.002, 0.04, 0.11, -0.02, 0.045, 0.0);         // side plate L
  box(g, MAT.gunmetal, 0.03, 0.008, 0.15, 0, 0.078, 0.0);          // top strap
  ejectionPort(g, 0.0195, 0.05, -0.02, 0.05, 0.02, MAT.black);
  box(g, MAT.black, 0.02, 0.004, 0.05, 0, 0.017, -0.01);           // loading port
  pinX(g, MAT.steel, 0.0045, 0.04, 0.055, 0.05);
  pinX(g, MAT.steel, 0.0045, 0.04, 0.03, 0.055);
  box(g, MAT.steel, 0.008, 0.02, 0.014, 0, 0.075, 0.082, 0.5);     // hammer spur

  // Sawn barrel with rough bright cut face, improvised brass bead.
  cyl(g, MAT.black, 0.0125, 0.013, 0.235, 0, 0.055, -0.19);        // barrel -0.07..-0.31
  cyl(g, MAT.steel, 0.0128, 0.0128, 0.004, 0, 0.055, -0.307, 0.05, 0.1, 0); // cut face (tilted)
  sphere(g, MAT.brass, 0.003, 0, 0.07, -0.295, 8);                 // soldered bead
  cyl(g, MAT.black, 0.0095, 0.0095, 0.21, 0, 0.02, -0.175);        // exposed mag tube
  cyl(g, MAT.steel, 0.0098, 0.0098, 0.006, 0, 0.02, -0.279, 0.04, -0.09, 0); // sawn tube end
  box(g, MAT.gunmetal, 0.006, 0.026, 0.01, 0, 0.037, -0.255, 0, 0, 0.06);   // rough band

  // Corncob wooden pump.
  const pump = makeGroup();
  pump.position.set(0, 0.02, -0.17);
  g.add(pump);
  cyl(pump, MAT.wood, 0.019, 0.021, 0.095, 0, 0, 0);
  ring(pump, MAT.darkWood, 0.02, 0.002, 0, 0, -0.03, 0, 0, 0, 12);
  ring(pump, MAT.darkWood, 0.0205, 0.002, 0, 0, 0, 0, 0, 0, 12);
  ring(pump, MAT.darkWood, 0.02, 0.002, 0, 0, 0.03, 0, 0, 0, 12);
  box(g, MAT.gunmetal, 0.004, 0.005, 0.13, 0.016, 0.028, -0.10);   // action bar R
  box(g, MAT.gunmetal, 0.004, 0.005, 0.13, -0.016, 0.028, -0.10);  // action bar L

  // Sawn wooden pistol grip — rz-tilted cut faces for the hacksaw look.
  angledGrip(g, MAT.wood, 0.034, 0.10, 0.055, 0, 0.016, 0.06, 0.55);
  box(g, MAT.darkWood, 0.035, 0.008, 0.05, 0, -0.063, 0.104, 0.55, 0, 0.10);  // cut face
  box(g, MAT.darkWood, 0.033, 0.005, 0.044, 0, -0.068, 0.108, 0.55, 0, -0.14); // splinter step
  box(g, MAT.darkWood, 0.0345, 0.006, 0.012, 0, -0.018, 0.077, 0.55);          // finger groove
  box(g, MAT.darkWood, 0.0345, 0.006, 0.012, 0, -0.04, 0.09, 0.55);            // finger groove

  // Side-saddle shells on the left receiver wall.
  box(g, MAT.black, 0.004, 0.022, 0.1, -0.021, 0.05, -0.005);      // carrier plate
  for (let i = 0; i < 3; i++) {
    const z = -0.035 + i * 0.03;
    cyl(g, MAT.red, 0.0075, 0.0075, 0.04, -0.028, 0.05, z, 0, 0, 0, 10);       // hull
    cyl(g, MAT.brass, 0.008, 0.008, 0.012, -0.028, 0.05, z + 0.024, 0, 0, 0, 10); // brass head
  }

  triggerAssembly(g);
  slingLoop(g, 0, -0.072, 0.112, 0.006);                           // lanyard loop

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.055, -0.31),
    parts: { pump },
  };
}

// ---------- M249 SAW (light machine gun) ----------
export function buildM249() {
  const g = makeGroup();

  // Box receiver + top feed-tray cover with rear sight drum.
  box(g, MAT.darkGray, 0.046, 0.062, 0.26, 0, 0.038, 0.0);         // receiver -0.13..+0.13
  box(g, MAT.black, 0.05, 0.022, 0.24, 0, 0.084, -0.005);          // feed-tray cover
  box(g, MAT.black, 0.052, 0.008, 0.05, 0, 0.098, -0.10);          // cover hinge boss
  cylY(g, MAT.black, 0.013, 0.013, 0.018, 0, 0.104, 0.09, 0, 0, 0, 12); // rear sight drum
  box(g, MAT.black, 0.004, 0.018, 0.01, 0, 0.117, 0.09);           // sight leaf
  rail(g, 0.099, -0.02, 0.10, MAT.darkGray);                       // cover rail
  ejectionPort(g, 0.0235, 0.045, 0.02);
  box(g, MAT.black, 0.008, 0.014, 0.06, 0.027, 0.03, 0.03);        // charging handle track
  box(g, MAT.polymer, 0.012, 0.018, 0.035, 0.034, 0.03, 0.05);     // charging handle grip
  pinX(g, MAT.gunmetal, 0.004, 0.047, 0.018, 0.10);
  pinX(g, MAT.gunmetal, 0.004, 0.047, 0.018, -0.09);
  pinX(g, MAT.gunmetal, 0.004, 0.047, 0.058, -0.115);

  // Carrying handle on top.
  box(g, MAT.black, 0.008, 0.03, 0.008, 0, 0.112, -0.055, 0.3);    // post F
  box(g, MAT.black, 0.008, 0.03, 0.008, 0, 0.112, -0.005, -0.3);   // post R
  box(g, MAT.polymer, 0.014, 0.012, 0.09, 0, 0.13, -0.03);         // handle bar

  // Long barrel, gas tube, heat shield, front sight.
  cyl(g, MAT.black, 0.013, 0.014, 0.36, 0, 0.052, -0.31);          // barrel -0.13..-0.49
  ring(g, MAT.black, 0.0145, 0.002, 0, 0.052, -0.235, 0, 0, 0, 12); // barrel change collar
  cyl(g, MAT.gunmetal, 0.008, 0.008, 0.30, 0, 0.022, -0.27);       // gas tube
  cyl(g, MAT.black, 0.011, 0.011, 0.03, 0, 0.022, -0.425);         // gas regulator
  box(g, MAT.polymer, 0.042, 0.014, 0.13, 0, 0.074, -0.185);       // heat shield
  box(g, MAT.black, 0.03, 0.003, 0.02, 0, 0.082, -0.15);           // vent slot
  box(g, MAT.black, 0.03, 0.003, 0.02, 0, 0.082, -0.22);           // vent slot
  box(g, MAT.black, 0.012, 0.01, 0.016, 0, 0.072, -0.43);          // front sight base
  box(g, MAT.black, 0.004, 0.015, 0.004, 0, 0.084, -0.43);         // front sight post

  // Slotted flash hider.
  cyl(g, MAT.black, 0.016, 0.014, 0.055, 0, 0.052, -0.5175);       // hider body -0.49..-0.545
  box(g, MAT.gunmetal, 0.036, 0.006, 0.008, 0, 0.052, -0.525);     // through slot
  box(g, MAT.gunmetal, 0.006, 0.036, 0.008, 0, 0.052, -0.512);     // through slot (vert)
  ring(g, MAT.black, 0.0155, 0.0022, 0, 0.052, -0.545, 0, 0, 0, 12); // crown ring

  // Bipod folded back under the barrel.
  box(g, MAT.darkGray, 0.03, 0.02, 0.03, 0, 0.03, -0.40);          // bipod mount block
  box(g, MAT.black, 0.007, 0.007, 0.17, -0.015, 0.028, -0.315, -0.04); // leg L
  box(g, MAT.black, 0.007, 0.007, 0.17, 0.015, 0.028, -0.315, -0.04);  // leg R
  box(g, MAT.black, 0.009, 0.012, 0.02, -0.015, 0.033, -0.235);    // foot L
  box(g, MAT.black, 0.009, 0.012, 0.02, 0.015, 0.033, -0.235);     // foot R

  // Belt box hanging under the receiver (animated on reloads).
  const magazine = makeGroup();
  magazine.position.set(0, -0.005, -0.035);
  g.add(magazine);
  box(magazine, MAT.green, 0.056, 0.095, 0.115, 0, -0.058, 0);     // ammo box
  box(magazine, MAT.green, 0.06, 0.014, 0.12, 0, -0.004, 0);       // lid
  box(magazine, MAT.darkGray, 0.02, 0.02, 0.006, 0, -0.032, -0.062); // latch
  box(magazine, MAT.black, 0.05, 0.004, 0.02, 0, -0.107, 0);       // bottom strap
  for (let i = 0; i < 4; i++) {
    const y = 0.014 + i * 0.011;                                   // linked rounds climbing
    cyl(magazine, MAT.brass, 0.0042, 0.0042, 0.034, -0.029, y, 0.0, 0, 0, 0, 10); // the feed side
    box(magazine, MAT.gunmetal, 0.009, 0.004, 0.012, -0.029, y + 0.0045, 0.008);  // belt link
  }

  // Grip, trigger, skeletonized buttstock with cutout.
  angledGrip(g, MAT.polymer, 0.032, 0.085, 0.05, 0, 0.005, 0.02, 0.35);
  box(g, MAT.grip, 0.033, 0.04, 0.044, 0, -0.03, 0.045, 0.35);     // grip panel
  triggerAssembly(g);
  box(g, MAT.polymer, 0.028, 0.05, 0.03, 0, 0.03, 0.145);          // stock root
  box(g, MAT.polymer, 0.03, 0.024, 0.20, 0, 0.055, 0.25);          // top tube
  box(g, MAT.polymer, 0.028, 0.018, 0.16, 0, -0.005, 0.25, 0.12);  // bottom strut (cutout between)
  box(g, MAT.polymer, 0.032, 0.11, 0.026, 0, 0.02, 0.35);          // butt plate
  box(g, MAT.grip, 0.034, 0.1, 0.008, 0, 0.02, 0.366);             // butt pad
  slingLoop(g, 0, -0.012, 0.335);                                  // rear sling loop
  slingLoop(g, -0.024, 0.05, -0.12);                               // front sling loop

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.052, -0.55),
    parts: { magazine },
  };
}

// ---------- Negev (light machine gun, shorter/fatter) ----------
export function buildNegev() {
  const g = makeGroup();

  // Fat receiver + top cover with rail and drum sight.
  box(g, MAT.darkGray, 0.052, 0.075, 0.23, 0, 0.04, 0.015);        // receiver -0.10..+0.13
  box(g, MAT.black, 0.054, 0.02, 0.21, 0, 0.09, 0.01);             // top cover
  rail(g, 0.104, 0.04, 0.12, MAT.black);
  cylY(g, MAT.black, 0.011, 0.011, 0.016, 0, 0.106, 0.115, 0, 0, 0, 12); // rear sight drum
  box(g, MAT.black, 0.004, 0.014, 0.008, 0, 0.117, 0.115);         // aperture leaf
  ejectionPort(g, 0.0265, 0.045, 0.0);
  box(g, MAT.polymer, 0.012, 0.016, 0.042, -0.033, 0.055, 0.03);   // charging handle (left)
  pinX(g, MAT.gunmetal, 0.004, 0.053, 0.018, 0.10);
  pinX(g, MAT.gunmetal, 0.004, 0.053, 0.018, -0.07);

  // Carry handle over the front cover.
  box(g, MAT.black, 0.008, 0.026, 0.008, 0, 0.112, -0.075, 0.35);  // post F
  box(g, MAT.black, 0.008, 0.026, 0.008, 0, 0.112, -0.03, -0.35);  // post R
  box(g, MAT.polymer, 0.013, 0.011, 0.075, 0, 0.128, -0.052);      // handle bar

  // Short fat barrel + muzzle brake with side slots.
  cyl(g, MAT.black, 0.015, 0.016, 0.26, 0, 0.052, -0.23);          // barrel -0.10..-0.36
  ring(g, MAT.gunmetal, 0.0165, 0.002, 0, 0.052, -0.15, 0, 0, 0, 12);
  ring(g, MAT.gunmetal, 0.0165, 0.002, 0, 0.052, -0.20, 0, 0, 0, 12);
  cyl(g, MAT.gunmetal, 0.019, 0.017, 0.055, 0, 0.052, -0.3875);    // brake body -0.36..-0.415
  box(g, MAT.black, 0.046, 0.009, 0.012, 0, 0.052, -0.396);        // side slots (through)
  box(g, MAT.black, 0.046, 0.009, 0.012, 0, 0.052, -0.378);        // side slots (through)
  cyl(g, MAT.black, 0.0155, 0.0155, 0.008, 0, 0.052, -0.418);      // brake face

  // Gas block + winged front sight.
  box(g, MAT.darkGray, 0.024, 0.03, 0.03, 0, 0.045, -0.31);
  box(g, MAT.black, 0.004, 0.016, 0.005, 0, 0.072, -0.31);         // front post
  box(g, MAT.black, 0.003, 0.012, 0.004, -0.008, 0.069, -0.31, 0, 0, 0.3);
  box(g, MAT.black, 0.003, 0.012, 0.004, 0.008, 0.069, -0.31, 0, 0, -0.3);

  // Polymer handguard + folded bipod alongside it.
  box(g, MAT.polymer, 0.042, 0.032, 0.13, 0, 0.028, -0.165);       // handguard
  box(g, MAT.black, 0.044, 0.004, 0.09, 0, 0.017, -0.165);         // groove line
  box(g, MAT.darkGray, 0.026, 0.018, 0.026, 0, 0.026, -0.30);      // bipod hinge
  box(g, MAT.black, 0.006, 0.006, 0.14, -0.024, 0.026, -0.225, -0.05); // leg L folded
  box(g, MAT.black, 0.006, 0.006, 0.14, 0.024, 0.026, -0.225, -0.05);  // leg R folded
  box(g, MAT.black, 0.008, 0.01, 0.016, -0.024, 0.03, -0.16);      // foot L
  box(g, MAT.black, 0.008, 0.01, 0.016, 0.024, 0.03, -0.16);       // foot R

  // Soft drum pouch (tan fabric) under the receiver — animated on reloads.
  const magazine = makeGroup();
  magazine.position.set(0, -0.01, -0.01);
  g.add(magazine);
  cylY(magazine, MAT.tan, 0.052, 0.052, 0.07, 0, -0.06, 0, 0, 0, Math.PI / 2, 16); // drum (axis X)
  ring(magazine, MAT.tan, 0.052, 0.005, 0.036, -0.06, 0, 0, Math.PI / 2, 0, 16);   // seam R
  ring(magazine, MAT.tan, 0.052, 0.005, -0.036, -0.06, 0, 0, Math.PI / 2, 0, 16);  // seam L
  box(magazine, MAT.tan, 0.05, 0.03, 0.05, 0, -0.008, 0);          // pouch neck
  box(magazine, MAT.darkGray, 0.032, 0.014, 0.042, 0, 0.011, 0);   // adapter clip
  box(magazine, MAT.black, 0.014, 0.1, 0.004, 0, -0.062, -0.053);  // front strap
  box(magazine, MAT.black, 0.018, 0.012, 0.006, 0, -0.1, -0.05);   // strap buckle

  // Skeleton stock.
  box(g, MAT.black, 0.02, 0.045, 0.02, 0, 0.03, 0.14);             // stock root/hinge
  box(g, MAT.black, 0.026, 0.02, 0.17, 0, 0.06, 0.225);            // top tube
  box(g, MAT.black, 0.024, 0.016, 0.15, 0, -0.002, 0.23, 0.18);    // lower strut (cutout between)
  box(g, MAT.black, 0.028, 0.10, 0.02, 0, 0.015, 0.315);           // butt plate
  box(g, MAT.grip, 0.03, 0.095, 0.006, 0, 0.015, 0.328);           // butt pad
  box(g, MAT.polymer, 0.024, 0.014, 0.09, 0, 0.076, 0.22);         // cheek rest

  // Grip + trigger + sling loops.
  angledGrip(g, MAT.polymer, 0.032, 0.085, 0.05, 0, 0.002, 0.025, 0.35);
  box(g, MAT.grip, 0.033, 0.04, 0.044, 0, -0.033, 0.05, 0.35);     // grip panel
  triggerAssembly(g);
  slingLoop(g, -0.028, 0.04, 0.115);
  slingLoop(g, -0.023, 0.028, -0.28);

  return {
    group: g,
    muzzle: new THREE.Vector3(0, 0.052, -0.422),
    parts: { magazine },
  };
}
