// The race tracks' start lines out in PORT HALCYON's free roam: a column of
// light over each one (seen from right across the city, fading as you pull
// into it), a glowing square on the road under it, and a chequered square on
// the radar and the map. Pull up in one and the screen offers the race.
import * as THREE from 'three';
import { TRACKS } from '../track/tracks.js';
import { Track } from '../track/track.js';

let STARTS = null;

/**
 * Every track's start line, worked out a track at a time (a generator: the
 * caller spreads it over frames): [{ id, def, x, z, y, heading, W, closed,
 * arrive: {x, z, heading} (just behind the line, for fast travel),
 * after: {x, z, heading} (past the line, or past a sprint's finish) }].
 */
export function* buildStarts() {
  if (STARTS) return STARTS;
  const out = [];
  for (const def of TRACKS) {
    const T = new Track(def);
    const p = T.posAt(T.startS);
    const at = (s) => { const q = T.posAt(s); return { x: q.x, z: q.z, heading: q.heading }; };
    out.push({
      id: def.id, def, x: p.x, z: p.z, y: p.y, heading: p.heading, W: T.W[p.i], closed: T.closed,
      arrive: at(T.closed ? T.startS - 28 : Math.max(2, T.startS - 26)),
      start: at(T.closed ? T.startS + 30 : T.startS + 16),
      finish: T.closed ? null : at(Math.min(T.length - 2, T.finishS + 30)),
    });
    yield;
  }
  STARTS = out;
  return out;
}

export const raceStarts = () => STARTS;

/** The start whose box (on the road, either side of the line) the point is in, or null. */
export function startAt(starts, x, z) {
  if (!starts) return null;
  for (const st of starts) {
    const dx = x - st.x, dz = z - st.z;
    if (dx * dx + dz * dz > 900) continue;
    const s = Math.sin(st.heading), c = Math.cos(st.heading);
    const along = dx * s + dz * c, lat = dx * c - dz * s;
    if (Math.abs(along) < 16 && Math.abs(lat) < st.W + 5) return st;
  }
  return null;
}

function columnTex() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#000');
  g.addColorStop(0.55, '#2a2a2a');
  g.addColorStop(0.9, '#bdbdbd');
  g.addColorStop(1, '#fff');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const AMBER = new THREE.Color('#ffb03a');
const tmp = new THREE.Color();

/** The light columns and the squares under them: two instanced meshes, faded by distance. */
export class StartLights {
  constructor(scene, starts) {
    this.starts = starts;
    const n = starts.length;
    this.colMat = new THREE.MeshBasicMaterial({
      map: columnTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const cg = new THREE.CylinderGeometry(3.2, 4.6, 170, 20, 1, true);
    cg.translate(0, 85, 0);
    this.cols = new THREE.InstancedMesh(cg, this.colMat, n);
    this.padMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    // the square under it: a frame the width of the road, 6 m deep
    const pg = new THREE.BufferGeometry();
    const pos = [], idx = [];
    const ring = (w, d) => { for (const [a, b] of [[-w, -d], [w, -d], [w, d], [-w, d]]) pos.push(a, 0, b); };
    ring(1, 1); ring(0.86, 0.72);
    for (let k = 0; k < 4; k++) {
      const a = k, b = (k + 1) % 4, c = 4 + k, d = 4 + (k + 1) % 4;
      idx.push(a, b, d, a, d, c);
    }
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pg.setIndex(idx);
    this.pads = new THREE.InstancedMesh(pg, this.padMat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    starts.forEach((st, i) => {
      m.compose(new THREE.Vector3(st.x, st.y - 2, st.z), q.setFromAxisAngle(up, st.heading), new THREE.Vector3(1, 1, 1));
      this.cols.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(st.x, st.y + 0.06, st.z), q.setFromAxisAngle(up, st.heading), new THREE.Vector3(st.W + 2, 1, 6));
      this.pads.setMatrixAt(i, m);
      this.cols.setColorAt(i, AMBER);
      this.pads.setColorAt(i, AMBER);
    });
    for (const im of [this.cols, this.pads]) {
      im.frustumCulled = false;
      im.renderOrder = 5;
      im.instanceMatrix.needsUpdate = true;
      scene.add(im);
    }
    this.scene = scene;
  }

  /** Fade each one by how far the camera is (dim when you're on its line, gone past ~2.6 km; only its outside is drawn, so from in it there's nothing in the way). */
  update(cam, hot = null) {
    const p = cam.position;
    this.starts.forEach((st, i) => {
      const d = Math.hypot(st.x - p.x, st.z - p.z);
      const near = Math.min(1, Math.max(0.05, (d - 10) / 110));
      const far = Math.min(1, Math.max(0, (2600 - d) / 700));
      const pulse = st === hot ? 1.25 + 0.25 * Math.sin(performance.now() / 160) : 1;
      this.cols.setColorAt(i, tmp.copy(AMBER).multiplyScalar(near * far * 0.9 * pulse));
      this.pads.setColorAt(i, tmp.copy(AMBER).multiplyScalar(d < 900 ? 1.1 * pulse : 0));
    });
    this.cols.instanceColor.needsUpdate = true;
    this.pads.instanceColor.needsUpdate = true;
  }

  dispose() {
    for (const im of [this.cols, this.pads]) {
      this.scene.remove(im);
      im.geometry.dispose();
      im.dispose?.();
    }
    this.colMat.map?.dispose();
    this.colMat.dispose();
    this.padMat.dispose();
  }
}
