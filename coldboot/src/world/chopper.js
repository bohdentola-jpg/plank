// A small two-seat helicopter (Robinson-ish): bubble canopy, tail boom, skids,
// spinning rotors with blur discs, nav lights, an optional searchlight.
// Wade's "Dragonfly" is red and cream; Northstar's is black with a spotlight.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function buildChopper(o = {}) {
  const body = new THREE.Color(o.color || '#a3221c');
  const trim = new THREE.Color(o.trim || '#e8e2d2');
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: body, roughness: 0.32, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const trimM = new THREE.MeshPhysicalMaterial({ color: trim, roughness: 0.35, clearcoat: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a8e94, roughness: 0.4, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2430, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.55, clearcoat: 1 });

  // cabin: a teardrop with the canopy bubble
  const cabin = new THREE.SphereGeometry(1, 32, 20);
  cabin.scale(0.85, 0.85, 1.25);
  const cabinM = new THREE.Mesh(cabin, paint);
  cabinM.position.set(0, 1.25, 0.2);
  g.add(cabinM);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), glass);
  canopy.scale.set(0.84, 0.8, 1.05);
  canopy.rotation.x = -Math.PI * 0.42;
  canopy.position.set(0, 1.38, 0.62);
  g.add(canopy);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.18, 24), trimM);
  belly.position.set(0, 0.62, 0.1);
  g.add(belly);
  // mast + engine cowling
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.1), paint);
  cowl.position.set(0, 1.95, -0.55);
  g.add(cowl);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 12), metal);
  mast.position.set(0, 2.35, -0.25);
  g.add(mast);
  // tail boom, fins, tail rotor
  const boom = new THREE.CylinderGeometry(0.12, 0.26, 4.6, 14);
  boom.rotateX(Math.PI / 2);
  const boomM = new THREE.Mesh(boom, trimM);
  boomM.position.set(0, 1.45, -3.1);
  g.add(boomM);
  const fins = mergeGeometries([new THREE.BoxGeometry(0.06, 0.9, 0.5).translate(0, 1.85, -5.25), new THREE.BoxGeometry(1.1, 0.05, 0.35).translate(0, 1.45, -4.9)]);
  g.add(new THREE.Mesh(fins, paint));
  const tailRotor = new THREE.Group();
  tailRotor.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.08), dark));
  const tailDisc = new THREE.Mesh(new THREE.CircleGeometry(0.58, 24), new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  tailDisc.rotation.y = Math.PI / 2;
  tailRotor.add(tailDisc);
  tailRotor.position.set(0.12, 1.75, -5.3);
  g.add(tailRotor);
  // skids
  const skid = [];
  for (const s of [-1, 1]) {
    const rail = new THREE.CylinderGeometry(0.045, 0.045, 2.6, 8);
    rail.rotateX(Math.PI / 2);
    rail.translate(s * 0.82, 0.05, 0.1);
    skid.push(rail);
    for (const z of [-0.55, 0.75]) {
      const leg = new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8);
      leg.rotateZ(s * 0.35);
      leg.translate(s * 0.68, 0.38, z);
      skid.push(leg);
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(skid), metal));
  // main rotor
  const rotor = new THREE.Group();
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 4.0), dark);
    blade.position.z = 2.0;
    const arm = new THREE.Group();
    arm.rotation.y = a;
    arm.add(blade);
    rotor.add(arm);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.0, 48), new THREE.MeshBasicMaterial({ color: 0x666a70, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  rotor.add(disc);
  rotor.position.set(0, 2.65, -0.25);
  g.add(rotor);
  // lights
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 0.5, 0.3) }));
  navR.position.set(0.85, 1.2, 0.3);   // port (left) is +x with the nose at +z
  const navG = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 12, 1) }));
  navG.position.set(-0.85, 1.2, 0.3);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 1, 0.5) }));
  beacon.position.set(0, 2.25, -0.95);
  g.add(navR, navG, beacon);
  let spot = null;
  if (o.searchlight) {
    spot = new THREE.SpotLight(0xe8f0ff, 60, 160, 0.22, 0.4, 1.2);
    spot.position.set(0, 0.6, 1.0);
    spot.target.position.set(0, -30, 30);
    g.add(spot, spot.target);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.27, 0.3), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.set(0, -27, 14);
    cone.rotation.x = -0.45;
    g.add(cone);
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  let t = 0;
  return {
    group: g, rotor, tailRotor, spot,
    update(dt, rpm = 1) {
      t += dt;
      rotor.rotation.y += dt * 38 * rpm;
      tailRotor.rotation.x += dt * 90 * rpm;
      disc.material.opacity = 0.05 + 0.1 * rpm;
      beacon.visible = Math.floor(t * 1.4) % 2 === 0;
    },
  };
}
