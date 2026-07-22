// Validates weapon model builders: import the registry, build every model,
// assert the return contract and a minimum detail level.
// Usage: node container-strike/test/checkmodels.mjs [fileStem]
//   fileStem (optional): only check builders from that models file, e.g. "rifles_a"
const stubDoc = {
  createElement: () => ({ getContext: () => null, style: {} }),
  createElementNS: () => ({ style: {} }),
};
globalThis.document = globalThis.document || stubDoc;
globalThis.window = globalThis.window || globalThis;
globalThis.self = globalThis.self || globalThis;

const FILE_IDS = {
  pistols_a: ['glock', 'usps', 'p2000', 'dualies', 'p250'],
  pistols_b: ['fiveseven', 'cz75', 'tec9', 'deagle', 'r8'],
  heavy: ['nova', 'xm1014', 'mag7', 'sawedoff', 'm249', 'negev'],
  smgs_a: ['mp9', 'mac10', 'mp5sd', 'mp7'],
  smgs_b: ['mp8', 'ump45', 'p90', 'bizon'],
  rifles_a: ['famas', 'galil', 'm4a4', 'm4a1s', 'ak47'],
  rifles_b: ['aug', 'sg553', 'ssg08', 'awp', 'scar20', 'g3sg1'],
  misc: ['knife', 'he', 'flash', 'smoke', 'molotov', 'incendiary', 'decoy'],
};
// grenades + knife are smaller objects; lower mesh floor
const SMALL = new Set(['knife', 'he', 'flash', 'smoke', 'molotov', 'incendiary', 'decoy']);
const MIN_MESHES_GUN = 22;
const MIN_MESHES_SMALL = 6;

const stem = process.argv[2];
const ids = stem ? FILE_IDS[stem] : Object.values(FILE_IDS).flat();
if (!ids) { console.error(`unknown file stem "${stem}"`); process.exit(2); }

const { getModel } = await import(new URL('../src/models/index.js', import.meta.url));

let failures = 0;
for (const id of ids) {
  try {
    const m = getModel(id);
    let meshes = 0;
    m.group.traverse((o) => { if (o.isMesh) meshes++; });
    const min = SMALL.has(id) ? MIN_MESHES_SMALL : MIN_MESHES_GUN;
    const problems = [];
    if (!m.muzzle || typeof m.muzzle.x !== 'number') problems.push('missing muzzle Vector3');
    if (meshes < min) problems.push(`only ${meshes} meshes (need >= ${min})`);
    // sanity: guns should extend forward (-z)
    if (!SMALL.has(id)) {
      const box = { min: { z: 1e9 }, max: { z: -1e9 } };
      m.group.updateMatrixWorld(true);
      m.group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        const zs = [bb.min.z, bb.max.z].map((z) => z + o.getWorldPosition(new (Object.getPrototypeOf(m.muzzle).constructor)()).z);
        box.min.z = Math.min(box.min.z, ...zs);
        box.max.z = Math.max(box.max.z, ...zs);
      });
      if (box.min.z > -0.1) problems.push(`does not extend forward (minZ=${box.min.z.toFixed(2)})`);
      if (m.muzzle.z > -0.05) problems.push(`muzzle.z=${m.muzzle.z.toFixed(2)} should be well negative`);
    }
    if (problems.length) {
      failures++;
      console.log(`FAIL ${id}: ${problems.join('; ')}`);
    } else {
      console.log(`ok   ${id}: ${meshes} meshes, muzzle z=${m.muzzle.z.toFixed(2)}`);
    }
  } catch (err) {
    failures++;
    console.log(`FAIL ${id}: threw ${err.message}`);
  }
}
console.log(failures ? `\n${failures} FAILURES` : '\nall models pass');
process.exit(failures ? 1 : 0);
