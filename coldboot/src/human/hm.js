// Loads the baked MakeHuman bundle (tools/build_humans.py → assets/human/).
// Exposes typed-array views over hm.bin plus the skeleton/targets metadata.

const BASE = new URL('../../assets/human/', import.meta.url);
const TYPES = {
  float32: Float32Array, uint16: Uint16Array, int16: Int16Array, uint8: Uint8Array, uint32: Uint32Array,
};

let promise = null;

export function loadHM() {
  if (!promise) promise = (async () => {
    const [meta, bin] = await Promise.all([
      fetch(new URL('hm.json', BASE)).then((r) => r.json()),
      fetch(new URL('hm.bin', BASE)).then((r) => r.arrayBuffer()),
    ]);
    const arr = (name) => {
      const l = meta.layout[name];
      if (!l) return null;
      const T = TYPES[l.t];
      return new T(bin, l.o, l.n);
    };
    const parts = {};
    for (const name of Object.keys(meta.parts)) {
      parts[name] = { map: arr(`part.${name}.map`), uv: arr(`part.${name}.uv`), index: arr(`part.${name}.index`) };
    }
    const targets = new Map();
    meta.targets.forEach((t, i) => {
      targets.set(t.name, { name: t.name, k: t.k, scale: t.scale, idx: arr(`t${i}.i`), d: arr(`t${i}.d`) });
    });
    const hm = {
      meta,
      N: meta.N,
      basePos: arr('basePos'),
      parts,
      targets,
      skinI: arr('skin.i'),
      skinW: arr('skin.w'),
      ao: arr('ao'),
      face: arr('face'),
      lip: arr('lip'),
      scalp: arr('scalp'),
      eye: {
        map: arr('eye.map'), uv: arr('eye.uv'), index: arr('eye.index'),
        refs: arr('eye.refs'), w: arr('eye.w'), off: arr('eye.off'), side: arr('eye.side'),
        scale: meta.eyeScale,
      },
      bones: meta.bones,
      joints: meta.joints,
      planes: meta.planes,
      boneIndex: meta.boneIndex,
      eyeTexURL: new URL('eye.png', BASE).href,
    };
    // welded triangle lists (base vertex indices) per part, for normals
    hm.weldedTris = {};
    for (const [name, p] of Object.entries(parts)) {
      const t = new Uint32Array(p.index.length);
      for (let i = 0; i < t.length; i++) t[i] = p.map[p.index[i]];
      hm.weldedTris[name] = t;
    }
    return hm;
  })();
  return promise;
}
