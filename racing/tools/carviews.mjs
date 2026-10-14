// Car model QA grid: several cars × several camera views, rendered straight
// from buildCarModel on a bare studio page (no game loop / CRT post), so it is
// quick even on software GL.
//   node racing/tools/carviews.mjs out.png [cars=all|id,id] [views=0.7:1.45:6.6,1.57:0.8:6] [env=studio] [lookJSON]
//        [--cols N] [--w 640] [--h 400] [--perf] [--lights 1] [--fov 38]
// Views are ang:h:dist[:lookY] (orbit angle — 0 = front, 1.57 = left side,
// 3.14 = rear —, camera height, distance). Output lands in qa/.
// --perf prints buildCarModel timings (low/hi res) and mesh/triangle counts.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8">
<script type="importmap">{ "imports": { "three": "/vendor/three.module.js" } }</script>
<style>body{margin:0;background:#000}</style></head><body>
<script type="module">
import * as THREE from 'three';
import { buildCarModel } from '/racing/src/car/model.js';
import { CARS, CAR_BY_ID } from '/racing/src/car/cars.js';
import { getEnvMap } from '/racing/src/core/envmap.js';
const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 640), H = Number(q.get('h') || 400);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const envName = q.get('env') || 'studio';
scene.environment = getEnvMap(renderer, envName);
scene.background = new THREE.Color(envName === 'day' ? 0x8fb2d8 : 0x0c0d10);
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x202020, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(4, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.55 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const camera = new THREE.PerspectiveCamera(Number(q.get('fov') || 38), W / H, 0.1, 200);
window.__qa = {
  ids: CARS.map((c) => c.id),
  render(id, look, views, lights) {
    const m = buildCarModel(CAR_BY_ID[id], look || {}, { hiRes: true, interior: true, shadow: true });
    scene.add(m.group);
    m.setLights(lights || 0, 0.3, 0);
    m.animate(1 / 60, 0, 0);
    const out = [];
    for (const [a, h, d, ly] of views) {
      camera.position.set(Math.sin(a) * d, h, Math.cos(a) * d);
      camera.lookAt(0, ly ?? 0.55, 0);
      renderer.render(scene, camera);
      out.push(renderer.domElement.toDataURL('image/png'));
    }
    scene.remove(m.group);
    m.dispose();
    return out;
  },
  perf(list) {
    const rows = [];
    for (const id of list) {
      const spec = CAR_BY_ID[id];
      buildCarModel(spec, {}, { hiRes: false }).dispose();
      const t = (hi) => {
        const n = 3;
        let meshes = 0, tris = 0;
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
          const h = buildCarModel(spec, {}, { hiRes: hi, interior: true });
          if (i === 0) h.group.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
          h.dispose();
        }
        return { ms: (performance.now() - t0) / n, meshes, tris: Math.round(tris) };
      };
      const lo = t(false), hi = t(true);
      rows.push({ id, lo: +lo.ms.toFixed(1), hi: +hi.ms.toFixed(1), meshes: lo.meshes, tris: lo.tris });
    }
    return rows;
  },
};
window.__qaReady = true;
</script></body></html>`;

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/__carqa.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    if (p.endsWith('/')) p += 'index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const bool = (n) => { const i = args.indexOf(`--${n}`); if (i < 0) return false; args.splice(i, 1); return true; };
const colsArg = flag('cols', null);
const w = Number(flag('w', '640')), h = Number(flag('h', '400'));
const lights = Number(flag('lights', '0'));
const fov = flag('fov', '38');
const perf = bool('perf');
const [out = 'views.png', carsArg = 'all', viewsArg = '0.7:1.45:6.6', env = 'studio', look = '{}'] = args;
const views = viewsArg.split(',').map((v) => v.split(':').map(Number));
await mkdir(join(root, 'qa', 'cells'), { recursive: true });
await mkdir(join(root, 'qa', out, '..'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log(`[${m.type()}]`, m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/__carqa.html?env=${env}&w=${w}&h=${h}&fov=${fov}`);
await page.waitForFunction(() => window.__qaReady, null, { timeout: 60000 });
const ids = carsArg === 'all' ? await page.evaluate(() => window.__qa.ids) : carsArg.split(',');
if (perf) {
  const rows = await page.evaluate((list) => window.__qa.perf(list), ids);
  let sl = 0, sh = 0, sm = 0;
  for (const r of rows) { console.log(JSON.stringify(r)); sl += r.lo; sh += r.hi; sm += r.meshes; }
  console.log(`avg lo ${(sl / rows.length).toFixed(1)}ms  hi ${(sh / rows.length).toFixed(1)}ms  meshes ${(sm / rows.length).toFixed(1)}`);
}
const files = [];
const t0 = Date.now();
for (const id of ids) {
  const urls = await page.evaluate(([i, lk, vs, li]) => window.__qa.render(i, lk, vs, li), [id, JSON.parse(look), views, lights]);
  for (let k = 0; k < urls.length; k++) {
    const f = join(root, 'qa', 'cells', `q_${id}_${k}.png`);
    await writeFile(f, Buffer.from(urls[k].split(',')[1], 'base64'));
    files.push([f, `${id}`]);
  }
}
await browser.close();
server.close();
const cols = colsArg ? Number(colsArg) : (views.length > 1 ? views.length : 4);
execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
out, cols = sys.argv[1], int(sys.argv[2])
rest = sys.argv[3:]
files, labels = rest[0::2], rest[1::2]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
rows = (len(ims)+cols-1)//cols
sheet = Image.new('RGB', (w*cols, h*rows), (0,0,0))
d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i%cols)*w, (i//cols)*h
    sheet.paste(im, (x, y))
    d.text((x+8, y+6), labels[i], fill=(200,200,200))
sheet.save(out)
`, join(root, 'qa', out), String(cols), ...files.flat()]);
console.log('saved', out, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
