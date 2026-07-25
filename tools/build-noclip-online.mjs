// Builds NOCLIP ONLINE: the whole game in one HTML file you can drop on any static host
// (Netlify, GitHub Pages, a phone's downloads folder). The shelf version in backrooms/ is
// never touched — its modules are read and concatenated here.
//
//   node tools/build-noclip-online.mjs           → noclip-online.html (three + peerjs from a CDN)
//   node tools/build-noclip-online.mjs --local   → qa/noclip-online.local.html (vendored, for tests)
//
// The one wrinkle is the level library: twenty-three modules that each export `meta` and
// `build`, which would collide the moment you concatenate them. Each one is wrapped in an
// IIFE that hands its two exports to a LEVELS table instead, and the loader in
// levels/index.js is replaced with a lookup in that table. Nothing else in the engine
// needs touching, because none of it knows what a module is.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (p) => readFile(join(root, p), 'utf8');

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const PEER_CDN = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';

// dependency order: every internal import is satisfied by concatenation
const MODULES = [
  'backrooms/src/util.js',
  'backrooms/src/textures.js',
  'backrooms/src/props.js',
  'backrooms/src/kit.js',
  'backrooms/src/bestiary.js',
  'backrooms/src/hazmat.js',
  'backrooms/src/world.js',
  'backrooms/src/player.js',
  'backrooms/src/entities.js',
  'backrooms/src/camcorder.js',
  'backrooms/src/audio.js',
  'backrooms/src/powerups.js',
];

// Names that appear at top level in more than one module and have to be pulled apart.
// (Checked by the collision guard below — if a new one appears, the build fails loudly
// rather than shipping a file where one module quietly overwrites another's helper.)
const RENAMES = {
  'backrooms/src/hazmat.js': [['box', 'hzBox'], ['cyl', 'hzCyl'], ['sph', 'hzSph'], ['dim', 'hzDim']],
  'backrooms/src/bestiary.js': [['box', 'bsBox'], ['cyl', 'bsCyl'], ['sph', 'bsSph'], ['dim', 'bsDim'], ['skin', 'bsSkin'], ['wetSkin', 'bsWetSkin'], ['shadow', 'bsShadow'], ['teeth', 'bsTeeth'], ['eyeGlow', 'bsEyeGlow'], ['biped', 'bsBiped']],
  'backrooms/src/props.js': [['box', 'prBox'], ['cyl', 'prCyl'], ['sph', 'prSph'], ['plane', 'prPlane'], ['G', 'prG'], ['M', 'prM'], ['mat', 'prMat']],
  'backrooms/src/world.js': [['MeshBuf', 'wdMeshBuf'], ['HALF_H', 'wdHalfH'], ['POOL_SIZE', 'wdPoolSize'], ['BAKE_GAIN', 'wdBakeGain']],
};

function stripModule(src, path) {
  let out = src;
  for (const [from, to] of RENAMES[path] || []) {
    // word-boundary rename inside this module only; these are all local helpers
    out = out.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  out = out
    .split('\n')
    .filter((line) => !/^\s*import\s.*from\s+['"].*['"];?\s*$/.test(line))
    .filter((line) => !/^\s*import\s+['"].*['"];?\s*$/.test(line))
    .join('\n')
    .replace(/^export\s+(const|let|var|function|class|async function)\b/gm, '$1')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '');
  if (/^\s*export\b/m.test(out)) throw new Error(`unhandled export form left in ${path}`);
  return `// ================= ${path} =================\n${out}`;
}

// Every top-level declaration a module makes, so collisions are caught at build time.
function topLevelNames(src) {
  const names = new Set();
  const re = /^(?:export\s+)?(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  return names;
}

async function levelBundle() {
  const dir = 'backrooms/src/levels';
  const files = (await readdir(join(root, dir))).filter((f) => f.endsWith('.js') && f !== 'index.js').sort();
  const parts = ['// ================= the level library =================', 'const LEVELS = {};'];
  for (const f of files) {
    const id = f.replace(/\.js$/, '');
    const src = (await R(`${dir}/${f}`))
      .split('\n')
      .filter((line) => !/^\s*import\s.*from\s+['"].*['"];?\s*$/.test(line))
      .join('\n')
      .replace(/^export\s+(const|let|var|function|class)\b/gm, '$1');
    if (/^\s*export\b/m.test(src)) throw new Error(`unhandled export form left in ${f}`);
    // an IIFE per level: `meta` and `build` stay private and are registered by id
    parts.push(`LEVELS[${JSON.stringify(id)}] = (() => {\n${src}\nreturn { meta, build };\n})();`);
  }
  // CHAIN + makeRun come from index.js; the dynamic loader does not (there is nothing to
  // load — everything is already here)
  const idx = await R(`${dir}/index.js`);
  const chain = idx.slice(idx.indexOf('export const CHAIN'), idx.indexOf('const cache = new Map()'))
    .replace(/^export\s+(const|function)\b/gm, '$1');
  parts.push(chain);
  parts.push('const loadLevelModule = (id) => LEVELS[id];');
  parts.push('const levelSeed = (id, n) => (Math.abs([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) ^ n) >>> 0;');
  return parts.join('\n\n');
}

async function build({ local = false } = {}) {
  const parts = ["import * as THREE from 'three';"];
  const seen = new Map();
  for (const m of MODULES) {
    const src = await R(m);
    for (const n of topLevelNames(src)) {
      const renamed = (RENAMES[m] || []).some(([from]) => from === n);
      if (seen.has(n) && !renamed) {
        throw new Error(`name collision: "${n}" is declared in both ${seen.get(n)} and ${m} — add it to RENAMES`);
      }
      if (!renamed) seen.set(n, m);
    }
    parts.push(stripModule(src, m));
  }
  parts.push(await levelBundle());
  parts.push('// ================= backrooms/online/online.js =================');
  parts.push(await R('backrooms/online/online.js'));

  const bundle = parts.join('\n\n');
  if (bundle.includes('</scr' + 'ipt>')) throw new Error('bundle contains a script-closing tag');

  const css = await R('backrooms/online/online.css');
  const html = (await R('backrooms/online/template.html'))
    .replace('{{CSS}}', () => css)
    .replace('{{BUNDLE}}', () => bundle)
    .replace('{{THREE_URL}}', local ? '/vendor/three.module.js' : THREE_CDN)
    .replace('{{PEER_URL}}', local ? '/vendor/peerjs.min.js' : PEER_CDN);

  const out = local ? 'qa/noclip-online.local.html' : 'noclip-online.html';
  if (local) await mkdir(join(root, 'qa'), { recursive: true });
  await writeFile(join(root, out), html);
  console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KB)`);
}

await build();
if (process.argv.includes('--local')) await build({ local: true });
