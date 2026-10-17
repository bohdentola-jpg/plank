// How long PORT HALCYON's world cells take to build, step by step (the
// streamer runs a few milliseconds of building a frame: a long single step
// is a hitch while driving). Under the browser lock:
//   flock -w 7200 /tmp/claude-browser.lock node racing/tools/worldprof.mjs \
//     [--district=<id>] [--cells="cx,cz;cx,cz"] [--max=12]
// Prints each cell's total, its longest step, its meshes and vertices, and
// what the district's plan cost; fails (exit 1) on a page error.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' / ')));
await page.goto(`http://127.0.0.1:${server.address().port}/racing/index.html?screen=world&car=silvio&budget=1&x=700&z=736&heading=3.14&time=day`);
await page.waitForFunction(() => window.__world && window.__world.state === 'roam', null, { timeout: 900000, polling: 500 });
const rep = await page.evaluate(async ({ district, cells, max }) => {
  const { buildCell } = await import('/racing/src/world/build/cell.js');
  const { CELL } = await import('/racing/src/world/terrain.js');
  const { districtAt } = await import('/racing/src/world/ground.js');
  const S = window.__world;
  const ctx = S.world.ctx;
  const D = ctx.districts;
  let list = cells;
  if (!list.length && district) {
    // the cells most covered by the district (sampled every 32 m)
    const d = D.byId.get(district);
    const cover = new Map();
    for (let x = d.box.x0; x < d.box.x1; x += 32) {
      for (let z = d.box.z0; z < d.box.z1; z += 32) {
        if (districtAt(x, z)?.id !== district) continue;
        const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
        cover.set(k, (cover.get(k) || 0) + 1);
      }
    }
    list = [...cover.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k.split(',').map(Number));
  }
  const out = [];
  for (const [cx, cz] of list) {
    for (const k of [...ctx.terrain.cache.keys()]) if (k.endsWith(`:${cx}:${cz}`)) ctx.terrain.cache.delete(k);
    D.scatters.delete(`${cx},${cz}`);
    const job = buildCell(ctx, cx, cz);
    const steps = [];
    let r, total = 0;
    do {
      const t = performance.now();
      r = job.next();
      const dt = performance.now() - t;
      steps.push(dt);
      total += dt;
    } while (!r.done);
    let verts = 0, meshes = 0;
    r.value.group.traverse((o) => { if (o.isMesh) { meshes++; verts += o.geometry.attributes.position.count * (o.count || 1); } });
    r.value.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    out.push({ cell: `${cx},${cz}`, total: +total.toFixed(1), maxStep: +Math.max(...steps).toFixed(1), steps: steps.length, meshes, verts });
  }
  return { cells: out, plan: D.stats.planMs[district] ?? null, stats: { items: D.stats.items, colliders: D.stats.colliders, lamps: D.stats.lamps, far: D.stats.far } };
}, { district: opt.district || null, cells: opt.cells ? opt.cells.split(';').map((s) => s.split(',').map(Number)) : [], max: Number(opt.max || 12) });
for (const c of rep.cells) console.log(`cell ${c.cell.padEnd(8)} total ${String(c.total).padStart(6)} ms  longest step ${String(c.maxStep).padStart(5)} ms  ${c.steps} steps  ${c.meshes} meshes  ${c.verts} verts`);
if (rep.cells.length) {
  const tot = rep.cells.map((c) => c.total), mx = rep.cells.map((c) => c.maxStep);
  console.log(`cells: avg ${(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(1)} ms, worst ${Math.max(...tot).toFixed(1)} ms; longest single step ${Math.max(...mx).toFixed(1)} ms`);
}
if (rep.plan !== null) console.log(`plan (${opt.district}): ${rep.plan.toFixed(1)} ms`);
console.log('whole world plan:', JSON.stringify(rep.stats));
console.log(errs.length ? `PAGE ERRORS:\n  ${errs.slice(0, 8).join('\n  ')}` : 'no page errors');
await browser.close();
server.close();
process.exit(errs.length ? 1 : 0);
