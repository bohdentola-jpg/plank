#!/usr/bin/env node
// export-game.mjs — package the "game" folder for static hosting.
//
//   node tools/export-game.mjs
//
// Produces:
//   dist/game-site/      → the site as a plain folder
//   dist/game-site.zip   → the same thing zipped
//
// Deploy either one: drag the folder (or the zip) onto https://app.netlify.com/drop
// — or point any static host (Vercel, GitHub Pages, Cloudflare Pages) at it.
// No build step, no server: the whole game is static files.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'game');
const distDir = path.join(root, 'dist');
const outDir = path.join(distDir, 'game-site');
const zipPath = path.join(distDir, 'game-site.zip');

const SKIP = new Set(["tests", ".DS_Store"]);

async function collect(dir, rel = '') {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const r = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...await collect(abs, r));
    else out.push({ abs, rel: r });
  }
  return out;
}

// ---- minimal zip writer (STORE, no compression — the game is tiny) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function le16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v & 0xffff); return b; }
function le32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; }

function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.rel, 'utf8');
    const crc = crc32(f.data);
    const common = Buffer.concat([
      le16(20), le16(0x0800), le16(0),        // version, utf8 flag, method=store
      le16(0), le16(0x2121),                   // dos time/date (fixed, deterministic)
      le32(crc), le32(f.data.length), le32(f.data.length),
      le16(nameBuf.length), le16(0),
    ]);
    const local = Buffer.concat([le32(0x04034b50), common, nameBuf, f.data]);
    locals.push(local);
    centrals.push(Buffer.concat([
      le32(0x02014b50), le16(20), common,
      le16(0), le16(0), le16(0), le32(0), le32(offset), nameBuf,
    ]));
    offset += local.length;
  }
  const centralStart = offset;
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.concat([
    le32(0x06054b50), le16(0), le16(0),
    le16(files.length), le16(files.length),
    le32(centralBuf.length), le32(centralStart), le16(0),
  ]);
  return Buffer.concat([...locals, centralBuf, end]);
}

// ---- main ----
const files = await collect(srcDir);
if (!files.length) {
  console.error('nothing found in game/ — run from the repo');
  process.exit(1);
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const zipEntries = [];
let bytes = 0;
for (const f of files.sort((a, b) => a.rel.localeCompare(b.rel))) {
  const data = await fs.readFile(f.abs);
  bytes += data.length;
  const dest = path.join(outDir, f.rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, data);
  zipEntries.push({ rel: f.rel, data });
}
await fs.writeFile(zipPath, buildZip(zipEntries));

console.log(`packaged ${files.length} files (${(bytes / 1024).toFixed(0)} KB)`);
console.log(`  folder: ${path.relative(root, outDir)}/`);
console.log(`  zip:    ${path.relative(root, zipPath)}`);
console.log();
console.log('to put it online: drag dist/game-site (or the zip) onto https://app.netlify.com/drop');
