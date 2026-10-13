// Merge the static meshes under a group into one mesh per material (or one vertex-colored mesh for all opaque toon parts)
// so a helmet or a rigid body part costs a handful of draw calls instead of dozens. Transparent and textured meshes are kept as-is.
import * as THREE from '../../vendor/three.module.js';
import { gradientMap } from './textures.js';

let VC_MAT = null;
const vcMat = () => VC_MAT || (VC_MAT = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradientMap(), vertexColors: true }));

function concat(parts, name, size) {
  let n = 0; for (const p of parts) n += p.geometry.attributes[name].count * size; const out = new Float32Array(n); let o = 0;
  for (const p of parts) { const a = p.geometry.attributes[name].array; out.set(a, o); o += a.length; }
  return new THREE.Float32BufferAttribute(out, size);
}
function bake(mesh, inv) {
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}
/** Merge static meshes under `group`. `filter(mesh)` returns true for meshes that may be merged. Keeps meshes that fail the filter. */
export function mergeStatic(group, filter = () => true) {
  group.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const opaque = [], byMat = new Map(); const victims = [];
  group.traverse(o => {
    if (!o.isMesh || !filter(o)) return; const m = o.material; if (Array.isArray(m)) return;
    const geometry = bake(o, inv);
    if (m.isMeshToonMaterial && !m.transparent && !m.map && !m.emissive?.getHex?.()) {
      const n = geometry.attributes.position.count; const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = m.color.r; col[i * 3 + 1] = m.color.g; col[i * 3 + 2] = m.color.b; }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); opaque.push({ geometry }); victims.push(o);
    } else if (!m.transparent && !m.map) { if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push({ geometry }); victims.push(o); }
  });
  const build = (parts, material, withColor) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', concat(parts, 'position', 3)); g.setAttribute('normal', concat(parts, 'normal', 3)); g.setAttribute('uv', concat(parts, 'uv', 2));
    if (withColor) g.setAttribute('color', concat(parts, 'color', 3)); for (const p of parts) p.geometry.dispose();
    const mesh = new THREE.Mesh(g, material); mesh.castShadow = true; mesh.receiveShadow = false; return mesh;
  };
  // detach the originals (children that were themselves merged are gone with them; keep any un-merged descendants by re-parenting)
  for (const v of victims) { const keep = v.children.filter(c => !victims.includes(c)); for (const c of keep) { c.updateMatrixWorld(true); const mw = c.matrixWorld.clone(); group.add(c); c.matrix.copy(new THREE.Matrix4().multiplyMatrices(inv, mw)); c.matrix.decompose(c.position, c.quaternion, c.scale); } if (v.parent) v.parent.remove(v); }
  if (opaque.length) group.add(build(opaque, vcMat(), true));
  for (const [m, parts] of byMat) group.add(build(parts, m, false));
  return group;
}
