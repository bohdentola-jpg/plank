// Screenshots of PORT HALCYON from chosen spots (for checking how a place
// looks): the car is put at each spot, the streamer is let finish, a shot is
// taken. Run it under the browser lock:
//   flock -w 7200 /tmp/claude-browser.lock node racing/tools/worldshot.mjs \
//     --out=/some/dir --time=night --car=silvio "x,z,heading[,name]" ...
// Named spots: garage, plaza, oldtown, chinatown, harbor, kaido, summit, desert, lake, bridge.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const SPOTS = {
  garage: '700,736,3.14', plaza: '-80,-60,3.14', main: '-600,-60,1.57', oldtown: '-1700,250,0.4', chinatown: '-80,700,0',
  harbor: '-2000,1990,1.57', kaido: '-150,-2700,3.14', summit: '1250,-4200,1.57', desert: '3960,-900,3.14', lake: '-2900,-1020,-1.57',
  bridge: '2900,2840,-2.1', skyline: '-360,0,3.14', pier: '1200,2000,0', farm: '-4600,250,-1.57',
};
const spots = args.filter((a) => !a.startsWith('--')).map((a) => SPOTS[a] ? [SPOTS[a], a] : [a, null]).map(([s, name]) => {
  const [x, z, h, n] = s.split(',');
  return { x: Number(x), z: Number(z), h: Number(h || 0), name: name || n || `${x}_${z}` };
});
const out = opt.out || 'worldshots';
await mkdir(out, { recursive: true });
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
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' / ')));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text().slice(0, 400); if (!errors.includes('console: ' + t)) errors.push('console: ' + t); } });
const first = spots[0] || { x: 700, z: 780, h: 3.14 };
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/racing/index.html?screen=world&car=${opt.car || 'silvio'}&time=${opt.time || 'night'}&budget=${opt.budget || 120}&x=${first.x}&z=${first.z}&heading=${first.h}`);
await page.waitForFunction(() => window.__world && window.__world.state === 'roam', null, { timeout: 900000, polling: 500 });
console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's');
await page.evaluate((cam) => {
  const S = window.__world;
  // hold the car still where it's put
  S.readPlayer = () => { const c = S.player.ctl; c.throttle = 0; c.brake = 0; c.steer = 0; c.handbrake = true; c.nitro = false; };
  if (cam) S.camera.setMode(Number(cam));
}, opt.cam);
for (const sp of spots) {
  await page.evaluate((sp) => {
    const S = window.__world, P = S.player;
    S.sim.placeAt(P, sp.x, sp.z, sp.h);
    S.camera.first = true;
  }, sp);
  // let the streamer catch up (nothing queued or building near the car)
  const t1 = Date.now();
  await page.waitForFunction(() => {
    const W = window.__world.world;
    if (W.current) return false;
    for (const c of W.cells.values()) if (c.state === 'queued') return false;
    return true;
  }, null, { timeout: 900000, polling: 500 });
  await page.waitForTimeout(Number(opt.wait || 1500));
  const st = await page.evaluate(() => {
    const S = window.__world, W = S.world, v = S.player.vehicle, g = S.player.g;
    const info = window.__game.renderer.gl.info;
    return { y: v.y.toFixed(1), surface: g.surface, road: g.road?.name || g.road?.spec?.id || '-', cells: W.cells.size, built: W.stats.built, avgMs: (W.stats.buildMs / Math.max(1, W.stats.built)).toFixed(1), calls: info.render.calls, tris: info.render.triangles, geo: info.memory.geometries, fps: window.__game.fps?.toFixed(1) };
  });
  const file = `${out}/${sp.name}.png`;
  await page.screenshot({ path: file });
  console.log(`${sp.name}: ${file}  (${((Date.now() - t1) / 1000).toFixed(1)} s)  ${JSON.stringify(st)}`);
}
console.log(errors.length ? `PAGE ERRORS (${errors.length}):\n  ${errors.slice(0, 8).join('\n  ')}` : 'no page errors');
await browser.close();
server.close();
