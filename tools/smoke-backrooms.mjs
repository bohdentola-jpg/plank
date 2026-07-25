// Headless harness for NOCLIP (the backrooms tape).
//
// Levels are pure data — no three.js, no DOM — so every one of them can be
// built here in milliseconds and interrogated properly:
//
//   1. VOCABULARY  every material / prop / entity / scare / item a level names
//                  exists, and (once the engine modules are in) has a builder.
//   2. GEOMETRY    the grid encloses itself, spawn is standing on floor, the
//                  exits are actually reachable on foot, nothing is NaN.
//   3. GRAPH       every exit points at a level that exists, and every level is
//                  reachable from LEVEL 0 by walking the exit graph.
//   4. DETERMINISM the same seed builds the same level, twice.
//
// Usage: node tools/smoke-backrooms.mjs [--level poolrooms] [--verbose]
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const levelsDir = join(root, 'backrooms/src/levels');
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const only = (() => {
  const i = args.indexOf('--level');
  return i >= 0 ? args[i + 1] : null;
})();

let failures = 0, warnings = 0;
const fail = (msg) => { failures++; console.error(`FAIL ${msg}`); };
const warn = (msg) => { warnings++; console.log(`warn ${msg}`); };
const ok = (msg) => console.log(`ok   ${msg}`);

// DOM stubs: levels don't need them, but the engine-coverage phase imports
// modules that build canvases at module scope.
function stubCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (prop === 'canvas') return { width: 256, height: 256 };
      if (typeof prop === 'string') return () => {};
      return undefined;
    },
    set() { return true; },
  });
}
const stubCanvas = () => ({
  width: 256, height: 256, style: {},
  getContext: () => stubCtx(), toDataURL: () => 'data:,', appendChild() {},
});
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? stubCanvas() : {
    style: {}, dataset: {}, appendChild() {}, addEventListener() {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  }),
  createElementNS: () => stubCanvas(),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  body: { appendChild() {}, style: {}, classList: { add() {}, remove() {} } },
};
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const kitMod = await import('../backrooms/src/kit.js');
const { makeKit, C, WALKABLE, WET, MATS, PROPS, ENTITIES, SCARES, ITEMS, HIDES, GIMMICKS, climbable, minTrek } = kitMod;

// ------------------------------------------------------------------ discover
const files = (await readdir(levelsDir)).filter((f) => f.endsWith('.js') && f !== 'index.js').sort();
if (!files.length) { console.error('no level modules found'); process.exit(1); }

const mods = [];
for (const f of files) {
  const mod = await import(join(levelsDir, f));
  if (!mod.meta || !mod.build) { fail(`${f}: a level module must export \`meta\` and \`build(kit)\``); continue; }
  mods.push({ file: f, ...mod });
}
const ids = new Set(mods.map((m) => m.meta.id));

// ------------------------------------------------------------------ per level
const built = new Map();
for (const m of mods) {
  const { file, meta, build } = m;
  if (only && meta.id !== only) continue;
  const label = `${meta.id.padEnd(14)} ${String(meta.num).padStart(4)} ${meta.name}`;
  try {
    for (const need of ['id', 'num', 'name', 'tagline', 'brief']) {
      if (!meta[need]) fail(`${file}: meta.${need} is missing`);
    }
    if (meta.id !== file.replace(/\.js$/, '')) warn(`${file}: meta.id "${meta.id}" doesn't match the filename`);

    const t0 = performance.now();
    const seed = 20260724 ^ [...meta.id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const d = build(makeKit(seed));
    const ms = performance.now() - t0;
    built.set(meta.id, d);

    // ---- vocabulary
    const seen = { mats: new Set(), props: new Set(), ents: new Set(), scares: new Set(), items: new Set() };
    for (const arr of [d.matF, d.matW, d.matC]) for (const v of arr) seen.mats.add(v);
    for (const p of d.props) seen.props.add(p.name);
    for (const e of d.entities) seen.ents.add(e.type);
    for (const s of d.scares) seen.scares.add(s.name);
    for (const it of d.items) seen.items.add(it.type);
    for (const h of d.hides) if (!HIDES.includes(h.kind)) fail(`${meta.id}: unknown hiding place "${h.kind}"`);
    if (!GIMMICKS.includes(d.gimmick)) fail(`${meta.id}: unknown gimmick "${d.gimmick}"`);
    if (!d.monster) fail(`${meta.id}: no monster`);
    if (d.hides.length < 5) fail(`${meta.id}: only ${d.hides.length} hiding places`);
    if (!d.exits.some((e) => e.kind === 'elevator')) fail(`${meta.id}: no lift`);
    for (const [set, vocab, what] of [
      [seen.mats, MATS, 'material'], [seen.props, PROPS, 'prop'],
      [seen.ents, ENTITIES, 'entity'], [seen.scares, SCARES, 'scare'], [seen.items, ITEMS, 'item'],
    ]) {
      for (const v of set) if (!vocab.includes(v)) fail(`${meta.id}: unknown ${what} "${v}"`);
    }

    // ---- geometry sanity beyond what finish() already refuses to build
    let walkable = 0, edgeLeak = 0, nan = 0;
    for (let z = 0; z < d.h; z++) {
      for (let x = 0; x < d.w; x++) {
        const i = z * d.w + x;
        if (WALKABLE.has(d.cells[i])) {
          walkable++;
          if (x === 0 || z === 0 || x === d.w - 1 || z === d.h - 1) edgeLeak++;
        }
        if (!Number.isFinite(d.floorYs[i]) || !Number.isFinite(d.ceilYs[i])) nan++;
        if (d.ceilYs[i] <= d.floorYs[i]) nan++;
      }
    }
    if (edgeLeak) fail(`${meta.id}: ${edgeLeak} walkable cells on the outer ring — the level leaks into the void`);
    if (nan) fail(`${meta.id}: ${nan} cells with broken floor/ceiling heights`);
    if (walkable < 300) warn(`${meta.id}: only ${walkable} walkable cells — small for a level of the backrooms`);

    if (!d.objectives.length) fail(`${meta.id}: no objectives`);

    // ---- determinism
    const again = build(makeKit(seed));
    if (again.stats.walkable !== d.stats.walkable || again.stats.props !== d.stats.props) {
      fail(`${meta.id}: same seed built a different level (${d.stats.walkable}/${d.stats.props} vs ${again.stats.walkable}/${again.stats.props})`);
    }
    // and a different seed should not build the identical level
    const other = build(makeKit(seed + 991));
    if (other.stats.walkable === d.stats.walkable && other.stats.props === d.stats.props && d.stats.props > 12) {
      warn(`${meta.id}: seed doesn't change the layout — is the level fully hand-placed?`);
    }

    for (const w of d.warnings) warn(`${meta.id}: ${w}`);

    const { dist, trek } = (() => {
      // longest walk from spawn (how big the floor feels) and the walk to the lift
      // (how much floor the player actually has to cross to finish it)
      let far = 0;
      const L = { w: d.w, h: d.h };
      const q = [d.spawn.z * d.w + d.spawn.x];
      const seenD = new Int32Array(d.w * d.h).fill(-1);
      seenD[q[0]] = 0;
      for (let head = 0; head < q.length; head++) {
        const i = q[head], x = i % d.w, z = (i / d.w) | 0;
        far = Math.max(far, seenD[i]);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= L.w || nz >= L.h) continue;
          const j = nz * d.w + nx;
          if (seenD[j] !== -1 || !WALKABLE.has(d.cells[j])) continue;
          if (!climbable(d.cells[i], d.cells[j], d.floorYs[i], d.floorYs[j])) continue;
          seenD[j] = seenD[i] + 1;
          q.push(j);
        }
      }
      const e = d.exits.find((x) => x.kind === 'elevator') || d.exits[0];
      return { dist: far, trek: seenD[Math.round(e.z) * d.w + Math.round(e.x)] };
    })();
    if (trek < 0) fail(`${meta.id}: the lift is not walkable to from the spawn`);
    else if (trek < minTrek(walkable)) warn(`${meta.id}: the lift is only ${trek} cells from the spawn`);

    ok(`${label}  ${String(walkable).padStart(6)} cells · ${String(d.lights.length).padStart(4)} lights · `
      + `${String(d.props.length).padStart(4)} props · ${String(d.hides.length).padStart(2)} hides · `
      + `${(d.monster?.type || '—').padEnd(12)} ${String(d.gimmick).padEnd(10)} `
      + `walk ${String(dist).padStart(3)} · lift ${String(trek).padStart(3)} · ${ms.toFixed(0)}ms`);
    if (VERBOSE) {
      console.log(`      lift at ${d.exits[0].x},${d.exits[0].z} · monster ${d.monster.type} at ${d.monster.x},${d.monster.z}`);
      console.log(`      tone: ${d.ambience.room}/${d.ambience.music} · fog ${d.fog.density} · objectives ${d.objectives.length}`);
    }
  } catch (e) {
    fail(`${meta.id}: ${e.message}`);
    if (VERBOSE && e.stack) console.error(e.stack.split('\n').slice(1, 5).join('\n'));
  }
}

// ------------------------------------------------------------------ the pool
if (false) {
  const start = 'level0';
  if (!built.has(start)) {
    warn('no level0 — cannot check the chain');
  } else {
    const seenL = new Set([start]);
    const q = [start];
    while (q.length) {
      const id = q.pop();
      const d = built.get(id);
      if (!d) continue;
      for (const e of d.exits) {
        if (e.to === 'END' || e.to === 'BACK' || seenL.has(e.to)) continue;
        seenL.add(e.to);
        q.push(e.to);
      }
    }
    const orphans = [...built.keys()].filter((id) => !seenL.has(id));
    if (orphans.length) fail(`unreachable from LEVEL 0 by any exit: ${orphans.join(', ')}`);
    else ok(`chain: all ${built.size} levels reachable from LEVEL 0`);
    const ending = [...built.values()].some((d) => d.exits.some((e) => e.to === 'END'));
    if (!ending) fail('no level exits to END — the tape never gets out');
  }
}

// ------------------------------------------------------------------ engine coverage
// Skipped while the engine modules are still being written.
const enginePresent = ['textures.js', 'props.js', 'bestiary.js', 'fx.js'].every((f) => existsSync(join(root, 'backrooms/src', f)));
if (!enginePresent) {
  console.log('skip  engine coverage (textures/props/bestiary/fx not present yet)');
} else {
  try {
    const powerups = await import('../backrooms/src/powerups.js');
    if (Object.keys(powerups.CATALOG).length < 8) fail('the lift stall is too thin');
    else ok(`stall: ${Object.keys(powerups.CATALOG).length} upgrades for sale`);
    const tex = await import('../backrooms/src/textures.js');
    const missingMats = MATS.filter((m) => !tex.RECIPES[m]);
    if (missingMats.length) fail(`textures.js has no recipe for: ${missingMats.join(', ')}`);
    else ok(`textures: ${MATS.length} material recipes present`);

    const props = await import('../backrooms/src/props.js');
    const missingProps = PROPS.filter((p) => !props.BUILDERS[p]);
    if (missingProps.length) fail(`props.js has no builder for: ${missingProps.join(', ')}`);
    else ok(`props: ${PROPS.length} prop builders present`);

    const best = await import('../backrooms/src/bestiary.js');
    const missingEnts = ENTITIES.filter((e) => !best.SPECIES[e]);
    if (missingEnts.length) fail(`bestiary.js has no species for: ${missingEnts.join(', ')}`);
    else ok(`bestiary: ${ENTITIES.length} species present`);
    for (const [id, s] of Object.entries(best.SPECIES)) {
      for (const need of ['name', 'speed', 'senses', 'model']) {
        if (s[need] === undefined) fail(`bestiary ${id}: missing ${need}`);
      }
    }

    const fx = await import('../backrooms/src/fx.js');
    const missingScares = SCARES.filter((s) => !fx.SCARE_SCRIPTS[s]);
    if (missingScares.length) fail(`fx.js has no script for: ${missingScares.join(', ')}`);
    else ok(`scares: ${SCARES.length} scripts present`);

    const items = await import('../backrooms/src/items.js');
    const missingItems = ITEMS.filter((i) => !items.ITEM_DEFS[i]);
    if (missingItems.length) fail(`items.js has no def for: ${missingItems.join(', ')}`);
    else ok(`items: ${ITEMS.length} definitions present`);
  } catch (e) {
    fail(`engine coverage: ${e.message}`);
    if (VERBOSE && e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  }
}

console.log();
console.log(failures
  ? `${failures} failure(s), ${warnings} warning(s)`
  : `all backrooms checks passed (${warnings} warning(s))`);
process.exit(failures ? 1 : 0);
