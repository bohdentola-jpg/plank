// Shared kit for procedural weapon models.
//
// CONVENTIONS (all builders must follow):
//  - Units are meters. The weapon points muzzle-forward along -Z, +Y is up,
//    +X is the right (ejection-port) side.
//  - Origin sits at the grip/trigger area: the trigger is near (0, 0, 0),
//    the barrel line is around y = +0.03..+0.07, stock extends to +Z,
//    muzzle to -Z. A rifle spans roughly z = +0.35 (butt) to z = -0.55 (muzzle).
//  - Builders return { group, muzzle, parts } where muzzle is a THREE.Vector3
//    in local space at the muzzle tip, and parts may name meshes for
//    animation: { magazine, slide, bolt, cylinder, scope, pump }.
//  - Use the shared MAT materials so every gun grades consistently under the
//    same lighting. Meshes should cast shadows (helpers set this for you).
import * as THREE from '../three.js';

function std(color, rough, metal, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

export const MAT = {
  black:     std(0x161616, 0.55, 0.55), // phosphate steel / black oxide
  darkGray:  std(0x2b2d2e, 0.5, 0.6),   // receiver alloy
  gunmetal:  std(0x3a3f44, 0.4, 0.75),
  steel:     std(0x71767c, 0.35, 0.85),
  silver:    std(0xb8bcc0, 0.28, 0.9),  // stainless slides
  polymer:   std(0x232323, 0.8, 0.05),  // frames, stocks
  polymerLt: std(0x3c3f3a, 0.82, 0.05),
  grip:      std(0x1c1c1c, 0.92, 0.0),  // stippled grip areas
  wood:      std(0x7a4f28, 0.62, 0.08),
  darkWood:  std(0x59391d, 0.65, 0.08),
  tan:       std(0x9c8a64, 0.75, 0.1),  // FDE furniture
  green:     std(0x4c5942, 0.78, 0.08), // AUG/FAMAS style furniture
  orange:    std(0xb06820, 0.6, 0.2),
  brass:     std(0xb08d3e, 0.35, 0.9),
  red:       std(0x8a2418, 0.6, 0.3),
  gold:      std(0xc9a227, 0.35, 0.95),
  scopeGlass: std(0x9db8d8, 0.1, 0.9, { emissive: 0x223a55, emissiveIntensity: 0.35 }),
  sightDot:  std(0x30ff70, 0.4, 0.1, { emissive: 0x30ff70, emissiveIntensity: 0.8 }),
};

function place(mesh, parent, x, y, z, rx, ry, rz) {
  mesh.position.set(x, y, z);
  if (rx) mesh.rotation.x = rx;
  if (ry) mesh.rotation.y = ry;
  if (rz) mesh.rotation.z = rz;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Box: dimensions (w=x, h=y, d=z) centered at (x,y,z).
export function box(parent, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  return place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent, x, y, z, rx, ry, rz);
}

// Cylinder along the Z axis by default (barrels!). rTop is the -Z end.
export function cyl(parent, mat, rTop, rBottom, len, x, y, z, rx = 0, ry = 0, rz = 0, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, seg), mat);
  m.geometry.rotateX(-Math.PI / 2); // axis Y -> Z, rTop faces -Z (muzzle-ward)
  return place(m, parent, x, y, z, rx, ry, rz);
}

// Cylinder left along Y (for vertical parts like grips-pins, drums).
export function cylY(parent, mat, rTop, rBottom, len, x, y, z, rx = 0, ry = 0, rz = 0, seg = 14) {
  return place(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, seg), mat), parent, x, y, z, rx, ry, rz);
}

export function sphere(parent, mat, r, x, y, z, seg = 10) {
  return place(new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat), parent, x, y, z);
}

export function ring(parent, mat, r, tube, x, y, z, rx = 0, ry = 0, rz = 0, seg = 16) {
  return place(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, seg), mat), parent, x, y, z, rx, ry, rz);
}

export function cone(parent, mat, r, len, x, y, z, rx = 0, ry = 0, rz = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, len, seg), mat);
  m.geometry.rotateX(-Math.PI / 2); // point toward -Z
  return place(m, parent, x, y, z, rx, ry, rz);
}

// Angled pistol grip: a box rotated back around X, top at (x, y, z).
export function angledGrip(parent, mat, w, h, d, x, y, z, angle = 0.32) {
  const g = box(parent, mat, w, h, d, x, y - h / 2 * Math.cos(angle), z + h / 2 * Math.sin(angle), angle);
  return g;
}

// Trigger + guard around origin.
export function triggerAssembly(parent, scale = 1) {
  const grp = new THREE.Group();
  parent.add(grp);
  box(grp, MAT.black, 0.008 * scale, 0.028 * scale, 0.01 * scale, 0, -0.018 * scale, 0, 0.25);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.026 * scale, 0.004 * scale, 6, 14, Math.PI), MAT.black);
  guard.rotation.set(0, Math.PI / 2, 0);
  guard.position.set(0, -0.03 * scale, 0);
  guard.castShadow = true;
  grp.add(guard);
  return grp;
}

// Iron sights: rear notch at zRear, front post at zFront, on top line y.
export function ironSights(parent, y, zRear, zFront, mat = MAT.black) {
  box(parent, mat, 0.018, 0.012, 0.008, 0, y, zRear);
  box(parent, mat, 0.005, 0.008, 0.004, -0.006, y + 0.008, zRear);
  box(parent, mat, 0.005, 0.008, 0.004, 0.006, y + 0.008, zRear);
  box(parent, mat, 0.004, 0.014, 0.006, 0, y + 0.002, zFront);
  return parent;
}

// Picatinny-style top rail: length along z centered at (y, zc).
export function rail(parent, y, zc, len, mat = MAT.darkGray) {
  box(parent, mat, 0.022, 0.008, len, 0, y, zc);
  const n = Math.max(3, Math.floor(len / 0.02));
  for (let i = 0; i < n; i++) {
    box(parent, mat, 0.024, 0.004, 0.008, 0, y + 0.005, zc - len / 2 + (i + 0.5) * (len / n));
  }
  return parent;
}

// Tube scope with lenses and mounts, centered at (y, zc).
export function scopeAssembly(parent, y, zc, len = 0.22, r = 0.028) {
  cyl(parent, MAT.black, r, r, len, 0, y, zc);
  cyl(parent, MAT.black, r * 1.25, r * 1.05, 0.03, 0, y, zc - len / 2 - 0.012);
  cyl(parent, MAT.black, r * 1.05, r * 1.2, 0.03, 0, y, zc + len / 2 + 0.012);
  cyl(parent, MAT.scopeGlass, r * 0.85, r * 0.85, 0.004, 0, y, zc - len / 2 - 0.026);
  cyl(parent, MAT.scopeGlass, r * 0.8, r * 0.8, 0.004, 0, y, zc + len / 2 + 0.026);
  cylY(parent, MAT.black, 0.009, 0.009, 0.018, 0, y + r + 0.008, zc);           // elevation turret
  cylY(parent, MAT.black, 0.009, 0.009, 0.018, 0.02, y, zc, 0, 0, Math.PI / 2); // windage turret
  box(parent, MAT.darkGray, 0.014, r + 0.014, 0.02, 0, y - (r + 0.014) / 2 + 0.004, zc - len * 0.28);
  box(parent, MAT.darkGray, 0.014, r + 0.014, 0.02, 0, y - (r + 0.014) / 2 + 0.004, zc + len * 0.28);
  return parent;
}

// Ribbed slide serrations: n grooves on both sides near zc.
export function serrations(parent, mat, y, zc, n = 6, h = 0.02, spacing = 0.008) {
  for (let i = 0; i < n; i++) {
    box(parent, mat, 0.001, h, 0.004, -0.0145, y, zc + i * spacing);
    box(parent, mat, 0.001, h, 0.004, 0.0145, y, zc + i * spacing);
  }
}

// Magazine well marker + detachable magazine below (returned for reload anim).
export function boxMagazine(parent, mat, w, h, d, x, y, z, tilt = 0) {
  const mag = box(parent, mat, w, h, d, x, y, z, tilt);
  box(parent, MAT.black, w * 1.06, 0.012, d * 1.06, x, y - h / 2 + 0.006, z, tilt); // baseplate
  return mag;
}

// Curved magazine built from segments (AK style). Returns a group.
export function curvedMagazine(parent, mat, w, segLen, d, x, y, z, curve = 0.22, segs = 5) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  parent.add(grp);
  let py = 0, pz = 0, ang = 0;
  for (let i = 0; i < segs; i++) {
    box(grp, mat, w, segLen, d, 0, py - segLen / 2, pz, ang);
    ang += curve;
    py -= segLen * Math.cos(ang);
    pz += segLen * Math.sin(ang);
  }
  return grp;
}

export function makeGroup() {
  return new THREE.Group();
}

// Fallback model so a missing builder never crashes the game.
export function genericWeapon(cls) {
  const g = new THREE.Group();
  const len = cls === 'pistol' ? 0.22 : cls === 'smg' ? 0.45 : 0.7;
  box(g, MAT.darkGray, 0.032, 0.06, len * 0.55, 0, 0.04, -len * 0.1);
  cyl(g, MAT.black, 0.012, 0.012, len * 0.5, 0, 0.05, -len * 0.5);
  angledGrip(g, MAT.polymer, 0.03, 0.09, 0.045, 0, 0, 0.02);
  if (cls !== 'pistol') box(g, MAT.polymer, 0.03, 0.05, 0.18, 0, 0.03, len * 0.28);
  const mag = boxMagazine(g, MAT.black, 0.026, 0.1, 0.05, 0, -0.03, -0.08, 0.1);
  triggerAssembly(g);
  return { group: g, muzzle: new THREE.Vector3(0, 0.05, -len * 0.75), parts: { magazine: mag } };
}
