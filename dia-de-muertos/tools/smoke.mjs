// Fast checks without a browser: content consistency (both languages present,
// sources exist, glossary covers every tappable word, card pictures exist) and
// that every 3D builder runs. Run: node tools/smoke.mjs
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('./three-loader.mjs', import.meta.url);

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0, warnings = 0;
const fail = (m) => { failures++; console.error(`FAIL ${m}`); };
const warn = (m) => { warnings++; console.warn(`warn ${m}`); };
const ok = (m) => console.log(`ok   ${m}`);

// minimal DOM so the modules can be imported in Node
function ctx2d() {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (p === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (p === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (typeof p === 'string') return () => {};
      return undefined;
    },
    set() { return true; },
  });
}
const canvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d(), toDataURL: () => 'data:,', addEventListener() {} });
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? canvas() : { style: {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } }),
  createElementNS: () => canvas(),
  getElementById: () => null,
  querySelector: () => null,
  documentElement: {},
};
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.Image = class { set src(v) { this._s = v; } decode() { return Promise.resolve(); } };

const THREE = await import('../vendor/three.module.js');
void THREE;
const { CARDS, CARD_BY_ID } = await import('../src/content/cards.js');
const { SOURCES } = await import('../src/content/sources.js');
const { GLOSSARY, lookup } = await import('../src/content/glossary.js');
const { CHAPTERS } = await import('../src/content/book.js');
const { RIDDLES } = await import('../src/content/quiz.js');
const { PROP_INFO, makeProp } = await import('../src/props.js');
const { CARD_PROPS } = await import('../src/cardprops.js');
const { CAST, makeCharacter } = await import('../src/characters.js');
const { ITEMS, HOME_ITEMS } = await import('../src/content/items.js');

// ---- every {en, es} object in content has both languages
function walk(o, path, seen = new Set()) {
  if (!o || typeof o !== 'object' || seen.has(o)) return;
  seen.add(o);
  // a card's "en" gloss is shown only in English mode, so it's English-only on purpose
  if (('en' in o || 'es' in o) && !/CARDS\.\d+\.en$/.test(path)) {
    if (typeof o.en === 'string' && typeof o.es !== 'string') fail(`missing es at ${path}`);
    if (typeof o.es === 'string' && typeof o.en !== 'string') fail(`missing en at ${path}`);
  }
  for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`, seen);
}
walk(CARDS, 'CARDS'); walk(CHAPTERS, 'CHAPTERS'); walk(RIDDLES, 'RIDDLES'); walk(GLOSSARY, 'GLOSSARY'); walk(ITEMS, 'ITEMS');
ok('content has both languages');

// ---- cards: sources exist, pictures exist, ids unique
const ids = new Set();
for (const c of CARDS) {
  if (ids.has(c.id)) fail(`duplicate card ${c.id}`);
  ids.add(c.id);
  for (const s of c.src || []) if (!SOURCES[s]) fail(`card ${c.id}: unknown source ${s}`);
  if (!c.src?.length) warn(`card ${c.id} has no sources`);
  const p = c.pic;
  if (p.char && !CAST[p.char] && p.char !== 'chispa') fail(`card ${c.id}: unknown character ${p.char}`);
  if (p.prop && !PROP_INFO[p.prop] && !CARD_PROPS[p.prop]) fail(`card ${c.id}: unknown prop ${p.prop}`);
}
for (const id of Object.keys(RIDDLES)) if (!CARD_BY_ID[id]) fail(`riddle for unknown card ${id}`);
for (const [id, it] of Object.entries(ITEMS)) {
  if (it.card && !CARD_BY_ID[it.card]) fail(`item ${id}: unknown card ${it.card}`);
  if (!PROP_INFO[it.prop] && !CARD_PROPS[it.prop]) fail(`item ${id}: unknown prop ${it.prop}`);
}
for (const id of HOME_ITEMS) if (!PROP_INFO[id]) fail(`home item ${id} has no prop`);
ok(`${CARDS.length} cards, ${Object.keys(SOURCES).length} sources, ${Object.keys(RIDDLES).length} riddles`);

// ---- every [[word]] in the code and content has a glossary entry
const files = [];
async function collect(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await collect(p); else if (p.endsWith('.js')) files.push(p);
  }
}
await collect(join(root, 'src'));
const missing = new Set();
for (const f of files) {
  // skip comment lines (they document the markup with made-up examples)
  const txt = (await readFile(f, 'utf8')).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').replace(/\\'/g, "'");
  for (const m of txt.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    const key = m[2] || m[1];
    if (!lookup(key)) missing.add(key);
  }
}
if (missing.size) for (const w of missing) warn(`no glossary entry for [[${w}]]`);
else ok('every tappable word is in the glossary');

// ---- 3D builders run
try {
  for (const id of Object.keys(PROP_INFO)) makeProp(id, id === 'foto' ? {} : {});
  ok(`${Object.keys(PROP_INFO).length} props build`);
} catch (e) { fail(`props: ${e.message}`); }
try {
  for (const [id, fn] of Object.entries(CARD_PROPS)) fn({});
  ok(`${Object.keys(CARD_PROPS).length} card dioramas build`);
} catch (e) { fail(`card props: ${e.message}`); }
try {
  for (const id of [...Object.keys(CAST), 'chispa', 7, 42]) {
    const c = makeCharacter(id);
    for (const a of ['idle', 'walk', 'wave', 'cheer', 'point', 'think', 'clap', 'sit', 'kneel', 'dance', 'play-guitar', 'trot', 'happy', 'jump', 'lie']) {
      c.play(a, { restart: true });
      c.say(true);
      for (let i = 0; i < 5; i++) c.update(0.05);
    }
  }
  ok('all characters build and animate');
} catch (e) { fail(`characters: ${e.message}\n${e.stack.split('\n').slice(1, 4).join('\n')}`); }

console.log(failures ? `\n${failures} failure(s), ${warnings} warning(s)` : `\nall smoke checks passed (${warnings} warning(s))`);
process.exit(failures ? 1 : 0);
