// Misc held items — combat knife + grenades (HE, flashbang, smoke, molotov,
// incendiary, decoy). Same viewmodel conventions as the guns: -Z is forward,
// +Y up, origin near the hand. Grenades are compact (fist-size) and centered
// near the origin because they double as thrown projectiles. "muzzle" is the
// tip/front point of the item.
import * as THREE from '../three.js';
import {
  MAT, box, cylY, sphere, ring, makeGroup,
} from './common.js';

// ---------- local materials (item-specific finishes) ----------
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x5a7a4a, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.05,
});
const blueMat = new THREE.MeshStandardMaterial({ color: 0x2a4f8f, roughness: 0.5, metalness: 0.3 });
const amberMat = new THREE.MeshStandardMaterial({ color: 0xd0912c, roughness: 0.5, metalness: 0.3 });
const lightGrayMat = new THREE.MeshStandardMaterial({ color: 0xb9bdb9, roughness: 0.6, metalness: 0.2 });
const edgeMat = new THREE.MeshStandardMaterial({ color: 0xdadee2, roughness: 0.18, metalness: 0.95 });

// ---------- local micro-helpers (shared grenade furniture) ----------

// Fuze neck + cap on top of a grenade body (hex cap for the flashbang family).
function fuzeCap(g, y, hex = false) {
  cylY(g, MAT.steel, 0.009, 0.011, 0.012, 0, y + 0.006, 0, 0, 0, 0, 12);
  cylY(g, MAT.steel, 0.0105, 0.0105, 0.011, 0, y + 0.017, 0, 0, 0, 0, hex ? 6 : 12);
}

// Safety lever (spoon) bending down the +Z flank, safety pin through the fuze,
// and the pull ring hanging on the -Z side. Returns parts for animation.
function leverRing(g, topY, bodyR) {
  const lever = makeGroup();
  g.add(lever);
  box(lever, MAT.steel, 0.012, 0.0028, 0.026, 0, topY + 0.02, 0.012, 0.55); // strap over cap
  box(lever, MAT.steel, 0.011, 0.048, 0.0026, 0, topY - 0.008, bodyR + 0.0035, -0.08); // flank
  cylY(g, MAT.steel, 0.0016, 0.0016, 0.018, 0, topY + 0.014, -0.004, Math.PI / 2, 0, 0, 8); // pin
  const pullRing = ring(g, MAT.steel, 0.0095, 0.0017, 0, topY + 0.01, -0.02, 0, 0, 0, 12);
  return { lever, pullRing };
}

// Ring of small dark vent-hole discs half-embedded in a cylinder wall at y.
function ventHoles(g, r, y, count, holeR = 0.0045) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    cylY(g, MAT.black, holeR, holeR, 0.004,
      Math.sin(a) * r, y, Math.cos(a) * r, 0, a - Math.PI / 2, Math.PI / 2, 8);
  }
}

// Fragmentation band: a wrap of small squares around the body at height y.
function fragBand(g, r, y, count) {
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) / count) * Math.PI * 2;
    box(g, MAT.polymer, 0.0085, 0.0085, 0.0022, Math.sin(a) * r, y, Math.cos(a) * r, 0, a, 0);
  }
}

// ---------- combat knife ----------
export function buildKnife() {
  const g = makeGroup();

  // Ribbed handle: stacked, slightly-varied segments over a rubber core.
  for (let i = 0; i < 5; i++) {
    const w = i % 2 ? 0.022 : 0.0255;
    box(g, MAT.polymer, w, i === 2 ? 0.033 : 0.03, 0.0195, 0, 0, 0.028 + i * 0.019);
  }

  // Steel pommel with lanyard loop.
  box(g, MAT.steel, 0.025, 0.031, 0.014, 0, 0, 0.128);
  ring(g, MAT.steel, 0.006, 0.0016, 0, -0.016, 0.132, 0, Math.PI / 2, 0, 10);

  // Crossguard with upper/lower quillon tips.
  box(g, MAT.steel, 0.013, 0.072, 0.009, 0, 0.002, 0.014);
  box(g, MAT.steel, 0.011, 0.008, 0.013, 0, 0.04, 0.014);
  box(g, MAT.steel, 0.011, 0.008, 0.013, 0, -0.036, 0.014);

  // Handle retention pins through both sides.
  cylY(g, MAT.darkGray, 0.0035, 0.0035, 0.028, 0, 0, 0.046, 0, 0, Math.PI / 2, 10);
  cylY(g, MAT.darkGray, 0.0035, 0.0035, 0.028, 0, 0, 0.096, 0, 0, Math.PI / 2, 10);

  // Clip-point blade: main body, tip wedge, spine clip cut.
  const blade = makeGroup();
  g.add(blade);
  box(blade, MAT.silver, 0.006, 0.034, 0.17, 0, 0.002, -0.076);
  box(blade, MAT.silver, 0.0058, 0.022, 0.08, 0, -0.004, -0.196, -0.1); // tip wedge
  box(blade, MAT.silver, 0.005, 0.012, 0.05, 0, 0.008, -0.208, 0.22);   // clip spine slope

  // Darker fuller groove stripe + bright edge bevels.
  box(blade, MAT.gunmetal, 0.0066, 0.007, 0.125, 0, 0.011, -0.06);
  box(blade, edgeMat, 0.0024, 0.003, 0.165, 0, -0.0145, -0.075);
  box(blade, edgeMat, 0.0024, 0.0028, 0.07, 0, -0.012, -0.2, -0.11);

  return { group: g, muzzle: new THREE.Vector3(0, -0.006, -0.244), parts: { blade } };
}

// ---------- HE grenade (olive frag body) ----------
export function buildHE() {
  const g = makeGroup();

  // Ovoid olive body from stacked segments + rounded base.
  cylY(g, MAT.green, 0.03, 0.03, 0.028, 0, 0, 0, 0, 0, 0, 14);
  cylY(g, MAT.green, 0.03, 0.021, 0.026, 0, -0.027, 0, 0, 0, 0, 14);
  cylY(g, MAT.green, 0.018, 0.03, 0.024, 0, 0.026, 0, 0, 0, 0, 14);
  sphere(g, MAT.green, 0.02, 0, -0.042, 0, 10);

  // Fragmentation notch band around the equator.
  fragBand(g, 0.0305, 0, 10);

  // Fuze head, safety lever, pin + pull ring.
  fuzeCap(g, 0.038);
  const { lever, pullRing } = leverRing(g, 0.038, 0.031);

  return { group: g, muzzle: new THREE.Vector3(0, 0.062, 0), parts: { lever, ring: pullRing } };
}

// ---------- flashbang (steel cylinder, blue band) ----------
export function buildFlashbang() {
  const g = makeGroup();

  // Straight steel body with crimped top/bottom rims.
  cylY(g, MAT.steel, 0.0165, 0.0165, 0.078, 0, 0, 0, 0, 0, 0, 14);
  cylY(g, MAT.steel, 0.0175, 0.0175, 0.007, 0, 0.041, 0, 0, 0, 0, 14);
  cylY(g, MAT.steel, 0.0175, 0.0175, 0.007, 0, -0.041, 0, 0, 0, 0, 14);

  // Blue ID band + ring of vent holes.
  cylY(g, blueMat, 0.0172, 0.0172, 0.009, 0, 0.028, 0, 0, 0, 0, 14);
  ventHoles(g, 0.0165, -0.013, 8);

  // Hex fuze cap, lever, pin + ring.
  fuzeCap(g, 0.0445, true);
  const { lever, pullRing } = leverRing(g, 0.0445, 0.0175);

  return { group: g, muzzle: new THREE.Vector3(0, 0.068, 0), parts: { lever, ring: pullRing } };
}

// ---------- smoke grenade (tall can) ----------
export function buildSmoke() {
  const g = makeGroup();

  // Tall gunmetal can with light-gray top band and bottom crimp.
  cylY(g, MAT.gunmetal, 0.02, 0.02, 0.104, 0, 0, 0, 0, 0, 0, 14);
  cylY(g, lightGrayMat, 0.0205, 0.0205, 0.016, 0, 0.046, 0, 0, 0, 0, 14);
  cylY(g, MAT.gunmetal, 0.021, 0.021, 0.005, 0, -0.0515, 0, 0, 0, 0, 14);

  // Emission holes ringing the fuze on the top face.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    cylY(g, MAT.black, 0.0032, 0.0032, 0.003, Math.sin(a) * 0.0135, 0.0535, Math.cos(a) * 0.0135, 0, 0, 0, 8);
  }

  // Stenciled band suggestion: contrasting label strips on the front.
  box(g, MAT.polymerLt, 0.024, 0.004, 0.0014, 0, 0.01, 0.0202);
  box(g, MAT.polymerLt, 0.017, 0.004, 0.0014, 0, 0.001, 0.0202);
  box(g, MAT.polymerLt, 0.021, 0.004, 0.0014, 0, -0.008, 0.0202);

  // Fuze, lever, pin + ring.
  fuzeCap(g, 0.054);
  const { lever, pullRing } = leverRing(g, 0.054, 0.0205);

  return { group: g, muzzle: new THREE.Vector3(0, 0.078, 0), parts: { lever, ring: pullRing } };
}

// ---------- molotov (glass bottle + rag) ----------
export function buildMolotov() {
  const g = makeGroup();

  // Green glass bottle: body, shoulder taper, neck, thick bottom, lip ring.
  cylY(g, glassMat, 0.026, 0.026, 0.082, 0, -0.018, 0, 0, 0, 0, 14);
  cylY(g, glassMat, 0.011, 0.026, 0.026, 0, 0.036, 0, 0, 0, 0, 14);
  cylY(g, glassMat, 0.011, 0.011, 0.034, 0, 0.066, 0, 0, 0, 0, 12);
  cylY(g, glassMat, 0.0245, 0.0245, 0.006, 0, -0.061, 0, 0, 0, 0, 14);
  ring(g, glassMat, 0.0115, 0.002, 0, 0.081, 0, Math.PI / 2, 0, 0, 12);

  // Fuel visible through the glass (body + a little up the neck).
  cylY(g, MAT.orange, 0.0225, 0.0225, 0.052, 0, -0.028, 0, 0, 0, 0, 12);
  cylY(g, MAT.orange, 0.008, 0.008, 0.028, 0, 0.062, 0, 0, 0, 0, 10);

  // Cloth rag: wraps around the neck, drooping tail, wick out the top; cork.
  box(g, MAT.tan, 0.03, 0.011, 0.03, 0, 0.059, 0);
  box(g, MAT.tan, 0.029, 0.01, 0.029, 0, 0.049, 0, 0, 0.6, 0);
  box(g, MAT.tan, 0.014, 0.045, 0.007, 0.018, 0.027, 0.007, 0.15, 0, -0.45);
  box(g, MAT.tan, 0.012, 0.02, 0.007, 0.031, -0.001, 0.013, 0.3, 0, -0.75);
  box(g, MAT.tan, 0.011, 0.026, 0.011, 0.003, 0.097, 0.002, 0.12, 0, 0.1);
  cylY(g, MAT.wood, 0.0085, 0.0095, 0.012, 0, 0.0855, 0, 0, 0, 0, 10);

  return { group: g, muzzle: new THREE.Vector3(0, 0.108, 0), parts: {} };
}

// ---------- incendiary grenade (red canister) ----------
export function buildIncendiary() {
  const g = makeGroup();

  // Red canister with domed shoulder and dark base rim.
  cylY(g, MAT.red, 0.023, 0.023, 0.088, 0, 0, 0, 0, 0, 0, 14);
  cylY(g, MAT.red, 0.013, 0.023, 0.016, 0, 0.052, 0, 0, 0, 0, 14);
  cylY(g, MAT.darkGray, 0.0235, 0.0235, 0.006, 0, -0.046, 0, 0, 0, 0, 14);

  // Amber warning band with black hazard slashes.
  cylY(g, amberMat, 0.0233, 0.0233, 0.011, 0, 0.024, 0, 0, 0, 0, 14);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    box(g, MAT.black, 0.0045, 0.013, 0.0016, Math.sin(a) * 0.0236, 0.024, Math.cos(a) * 0.0236, 0, a, 0.5);
  }

  // Valve top with small side nozzle; lever, pin + ring.
  cylY(g, MAT.steel, 0.0085, 0.0105, 0.014, 0, 0.067, 0, 0, 0, 0, 12);
  cylY(g, MAT.steel, 0.003, 0.003, 0.013, 0.01, 0.069, 0, 0, 0, Math.PI / 2, 8);
  const { lever, pullRing } = leverRing(g, 0.056, 0.0235);

  return { group: g, muzzle: new THREE.Vector3(0, 0.074, 0), parts: { lever, ring: pullRing } };
}

// ---------- decoy grenade (flashbang body + antenna) ----------
export function buildDecoy() {
  const g = makeGroup();

  // Flashbang-style steel body with amber ID band and vent holes.
  cylY(g, MAT.steel, 0.0165, 0.0165, 0.078, 0, 0, 0, 0, 0, 0, 14);
  cylY(g, MAT.steel, 0.0175, 0.0175, 0.007, 0, 0.041, 0, 0, 0, 0, 14);
  cylY(g, MAT.steel, 0.0175, 0.0175, 0.007, 0, -0.041, 0, 0, 0, 0, 14);
  cylY(g, amberMat, 0.0172, 0.0172, 0.009, 0, 0.026, 0, 0, 0, 0, 14);
  ventHoles(g, 0.0165, -0.014, 6);

  // Hex fuze cap, lever, pin + ring.
  fuzeCap(g, 0.0445, true);
  const { lever, pullRing } = leverRing(g, 0.0445, 0.0175);

  // Radio antenna with ball tip + blinking LED dot on the flank.
  cylY(g, MAT.black, 0.0015, 0.0015, 0.05, 0.008, 0.086, 0, 0, 0, 0, 8);
  sphere(g, MAT.black, 0.0026, 0.008, 0.112, 0, 8);
  box(g, MAT.sightDot, 0.0035, 0.0035, 0.0035, 0.0163, 0.02, 0.004);

  return { group: g, muzzle: new THREE.Vector3(0.008, 0.113, 0), parts: { lever, ring: pullRing } };
}
