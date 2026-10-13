// Football helmets: an egg-shaped shell with a center stripe, ear holes, jaw pads, chin strap, bumper, a tube-cage facemask,
// optional visor, team logos on both sides, a number on the back, and a cartoon gloss. Built once per player.
import * as THREE from '../../vendor/three.module.js';
import { gradientMap, emblemTexture, numberTexture } from './textures.js';
import { shade, textOn } from '../util.js';
import { mergeStatic } from './merge.js';

const mats = new Map();
const mat = (color, extra = {}) => { const k = color + JSON.stringify(extra); if (!mats.has(k)) { const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra }); if (extra.opacity !== undefined && extra.opacity < 1) m.transparent = true; mats.set(k, m); } return mats.get(k); };
const OUTLINE = new THREE.MeshBasicMaterial({ color: '#141a2e', side: THREE.BackSide });
const M = (geo, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; return m; };
function outline(m, k = 1.07) { const o = new THREE.Mesh(m.geometry, OUTLINE); o.scale.setScalar(k); m.add(o); }
function tube(points, radius, material, closed = false) { const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'catmullrom', 0.3); const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 7, closed), material); m.castShadow = true; return m; }
function strut(a, b, radius, material) { const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const d = vb.clone().sub(va); const len = d.length(); const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 7), material); m.position.copy(va).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; return m; }

export function buildHelmet(R, team, opts = {}) {
  const g = new THREE.Group(); const [pri, sec] = team.colors; const maskColor = opts.maskColor || (textOn(pri) === '#ffffff' ? sec : shade(sec, -0.2));
  const shellMat = mat(pri), stripeMat = mat(sec), maskMat = mat(maskColor), darkMat = mat('#2a2a34'), padMat = mat('#3a3a44');
  const shell = new THREE.Group(); shell.scale.set(1, 1.06, 1.09); g.add(shell);
  const dome = M(new THREE.SphereGeometry(R, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), shellMat); shell.add(dome); outline(dome, 1.06);
  const back = M(new THREE.SphereGeometry(R, 32, 14, Math.PI, Math.PI, Math.PI * 0.5, Math.PI * 0.37), shellMat); shell.add(back); outline(back, 1.06);
  for (const [p0] of [[-0.36], [Math.PI - 0.36]]) { const cheek = M(new THREE.SphereGeometry(R, 10, 8, p0, 0.72, Math.PI * 0.5, Math.PI * 0.4), shellMat); shell.add(cheek); outline(cheek, 1.06); }
  const brow = M(new THREE.SphereGeometry(R, 24, 8, 0, Math.PI, Math.PI * 0.5, Math.PI * 0.07), shellMat); shell.add(brow);
  // center stripe: a thin meridian band over the top
  shell.add(M(new THREE.SphereGeometry(R * 1.012, 24, 12, Math.PI / 2 - 0.085, 0.17, 0, Math.PI * 0.5), stripeMat));
  shell.add(M(new THREE.SphereGeometry(R * 1.012, 24, 12, Math.PI * 1.5 - 0.085, 0.17, 0, Math.PI * 0.86), stripeMat));
  // ear holes + jaw pads + chin strap
  for (const s of [-1, 1]) {
    const hole = M(new THREE.CircleGeometry(R * 0.17, 16), darkMat, s * R * 1.012, -R * 0.08, -R * 0.06); hole.rotation.y = s * Math.PI / 2; hole.castShadow = false; shell.add(hole);
    const ring = M(new THREE.TorusGeometry(R * 0.18, R * 0.025, 6, 18), mat(shade(pri, -0.3)), s * R * 1.0, -R * 0.08, -R * 0.06); ring.rotation.y = Math.PI / 2; shell.add(ring);
    const pad = M(new THREE.BoxGeometry(R * 0.14, R * 0.34, R * 0.36), padMat, s * R * 0.8, -R * 0.62, R * 0.3); pad.rotation.y = -s * 0.25; g.add(pad);
    g.add(strut([s * R * 0.86, -R * 0.62, R * 0.32], [0, -R * 1.06, R * 0.58], R * 0.03, mat('#e8e8ec')));
  }
  g.add(M(new THREE.BoxGeometry(R * 0.26, R * 0.12, R * 0.16), mat('#e8e8ec'), 0, -R * 1.06, R * 0.58));
  // front bumper
  const bumper = M(new THREE.BoxGeometry(R * 0.5, R * 0.14, R * 0.14), darkMat, 0, R * 0.3, R * 0.98); bumper.rotation.x = 0.35; g.add(bumper);
  // facemask: two U-bars, a center bar from the brow, two side verticals, clips at the ends
  const U = (y, zOff, rx) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = 0.2 + (i / 10) * (Math.PI - 0.4); pts.push([-R * rx * Math.cos(a), y, zOff + R * 0.95 * Math.sin(a)]); } return pts; };
  const barR = R * 0.062; const yA = -R * 0.12, yB = -R * 0.55;
  g.add(tube(U(yA, R * 0.15, 0.98), barR, maskMat)); g.add(tube(U(yB, R * 0.2, 0.9), barR, maskMat));
  g.add(tube([[0, R * 0.44, R * 0.96], [0, R * 0.2, R * 1.08], [0, yA, R * 1.1], [0, yB, R * 1.12]], barR, maskMat));
  for (const s of [-1, 1]) { g.add(strut([s * R * 0.45, yA, R * 0.99], [s * R * 0.42, yB, R * 1.0], barR * 0.95, maskMat)); g.add(M(new THREE.BoxGeometry(R * 0.1, R * 0.18, R * 0.1), darkMat, s * R * 0.95, yA, R * 0.34)); g.add(M(new THREE.BoxGeometry(R * 0.1, R * 0.16, R * 0.1), darkMat, s * R * 0.88, yB, R * 0.38)); }
  if (opts.visor) { const v = M(new THREE.SphereGeometry(R * 1.02, 20, 8, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.42, Math.PI * 0.2), mat(opts.visor === true ? '#1a1a26' : opts.visor, { opacity: 0.62 })); v.castShadow = false; g.add(v); }
  // decals: logo both sides, number on the back, cartoon gloss on top
  const em = new THREE.MeshBasicMaterial({ map: team._emblem || (team._emblem = emblemTexture(team)), transparent: true });
  for (const s of [-1, 1]) { const d = M(new THREE.PlaneGeometry(R * 0.78, R * 0.78), em, s * (R * 1.02), R * 0.12, -R * 0.1); d.rotation.y = s * Math.PI / 2; d.castShadow = false; g.add(d); }
  if (opts.num !== undefined && opts.num !== null) { const nm = new THREE.MeshBasicMaterial({ map: numberTexture(opts.num, textOn(pri) === '#ffffff' ? '#ffffff' : sec, shade(pri, -0.5)), transparent: true }); const d = M(new THREE.PlaneGeometry(R * 0.5, R * 0.5), nm, 0, R * 0.05, -R * 1.1); d.rotation.y = Math.PI; d.castShadow = false; g.add(d); }
  const gloss = M(new THREE.SphereGeometry(R * 0.24, 10, 8), mat('#ffffff', { opacity: 0.32 }), -R * 0.36, R * 0.74, R * 0.5); gloss.scale.set(1.5, 0.45, 0.7); gloss.rotation.z = 0.5; gloss.castShadow = false; g.add(gloss);
  return opts.noMerge ? g : mergeStatic(g);
}
