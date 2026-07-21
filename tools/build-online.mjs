// Builds RIM CITY ONLINE: one self-contained HTML file you can drop on any
// static host (Netlify, GitHub Pages, a USB stick with opinions).
// The engine modules from rimcity/src are bundled read-only — the arcade
// version is untouched. Usage:
//   node tools/build-online.mjs            → rimcity-online.html (CDN three/peer)
//   node tools/build-online.mjs --local    → also qa test copy using ../vendor three
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (p) => readFile(join(root, p), 'utf8');

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const PEER_CDN = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';

// dependency order matters; every internal import is satisfied by concatenation
const MODULES = [
  'rimcity/src/util.js',
  'rimcity/src/gamepad.js',
  'rimcity/src/audio.js',
  'rimcity/src/teams.js',
  'rimcity/src/animation.js',
  'rimcity/src/clips.js',
  'rimcity/src/playerModel.js',
  'rimcity/src/arena.js',
  'rimcity/src/game.js',
];

function stripModule(src, path) {
  let out = src;
  if (path.endsWith('teams.js')) {
    // teams' local helper collides with animation's exported P once concatenated
    out = out.replace(/\bP\(/g, 'PLAYER(');
  }
  out = out
    .split('\n')
    .filter((line) => !/^\s*import\s.*from\s+['"].*['"];?\s*$/.test(line))
    .join('\n')
    .replace(/^export\s+(const|let|var|function|class)\b/gm, '$1');
  if (/^\s*export\b/m.test(out)) {
    throw new Error(`unhandled export form left in ${path}`);
  }
  return `// ================= ${path} =================\n${out}`;
}

async function build({ local = false } = {}) {
  const parts = ["import * as THREE from 'three';"];
  for (const m of MODULES) parts.push(stripModule(await R(m), m));
  parts.push('// ================= rimcity/online/online.js =================');
  parts.push(await R('rimcity/online/online.js'));
  const bundle = parts.join('\n\n');
  if (bundle.includes('</scr' + 'ipt>')) throw new Error('bundle contains a script-closing tag');

  const css = await R('rimcity/online/online.css');
  const html = (await R('rimcity/online/template.html'))
    .replace('{{CSS}}', () => css)
    .replace('{{BUNDLE}}', () => bundle)
    .replace('{{THREE_URL}}', local ? '/vendor/three.module.js' : THREE_CDN)
    .replace('{{PEER_URL}}', local ? '/vendor/peer-missing.js' : PEER_CDN);

  const out = local ? 'qa/rimcity-online.local.html' : 'rimcity-online.html';
  if (local) await mkdir(join(root, 'qa'), { recursive: true });
  await writeFile(join(root, out), html);
  console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KB)`);
}

await build();
if (process.argv.includes('--local')) await build({ local: true });
