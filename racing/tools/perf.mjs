// Track build/perf report: node racing/tools/perf.mjs <trackId> [s]
// Prints build time, draw calls, triangles (from a camera at s), mesh count.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const [id = 'downtown', s = '100'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/racing/index.html?screen=trackview&track=${id}&s=${s}`);
await page.waitForFunction(() => window.__trackview, null, { timeout: 120000 });
const buildMs = Date.now() - t0;
const info = await page.evaluate(() => {
  const g = window.__game;
  const r = g.renderer.gl;
  const v = g.screen.view();
  let meshes = 0, tris = 0;
  v.scene.traverse((o) => { if (o.isMesh) { meshes++; const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
  r.info.autoReset = false; r.info.reset();
  r.render(v.scene, v.camera);
  return { meshes, sceneTris: Math.round(tris), drawCalls: r.info.render.calls, viewTris: r.info.render.triangles, textures: r.info.memory.textures, length: Math.round(window.__trackview.length) };
});
console.log(JSON.stringify({ track: id, buildMs, ...info }));
await browser.close();
server.close();
