// Drives NOCLIP in headless Chromium: boots the tape, starts a run, walks around
// a bit, and saves frames into qa/. Also fails loudly on any page error, which is
// how the engine gets debugged without a human at the keyboard.
//
//   node tools/shot-backrooms.mjs [levelId] [--frames 4] [--walk 6000] [--quiet]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/backrooms/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('nope');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
await mkdir(join(root, 'qa'), { recursive: true });

const args = process.argv.slice(2);
const level = args.find((a) => !a.startsWith('--')) || 'level0';
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const frames = parseInt(opt('frames', '3'), 10);
const walkMs = parseInt(opt('walk', '5000'), 10);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
  else if (!args.includes('--quiet') && m.type() === 'warning') console.log('[warn]', m.text());
});

console.log(`loading ${level}…`);
if (args.includes('--nopool')) await page.addInitScript(() => { window.__nopool = true; });
await page.goto(`http://127.0.0.1:${port}/backrooms/index.html?quick&level=${level}`);
await page.waitForTimeout(400);
await page.mouse.click(640, 380);          // leave the boot screen
await page.waitForTimeout(600);

// the quick-start flag jumps straight into slot 1
await page.waitForFunction(() => window.NOCLIP && window.NOCLIP.state === 'play', { timeout: 60000 })
  .catch(() => errors.push('[fail] never reached play state'));
await page.waitForTimeout(1200);

const stats = await page.evaluate(() => {
  const g = window.NOCLIP;
  return {
    level: g.levelId,
    meta: g.meta && { num: g.meta.num, name: g.meta.name },
    walkable: g.world?.data?.stats?.walkable,
    lights: g.world?.lights?.length,
    entities: g.entities?.list?.length,
    meshes: g.world?.meshes?.length,
    triangles: g.renderer.info.render.triangles,
    calls: g.renderer.info.render.calls,
    pos: g.player && { x: +g.player.pos.x.toFixed(1), y: +g.player.pos.y.toFixed(2), z: +g.player.pos.z.toFixed(1) },
  };
});
console.log('stats', JSON.stringify(stats));

// walk forward, taking frames as we go. The look direction is driven through
// the game object rather than the mouse: pointer lock in headless is unreliable,
// and a screenshot of the ceiling tells you nothing.
if (args.includes('--torch')) await page.keyboard.press('KeyF');
if (args.includes('--night')) await page.keyboard.press('KeyN');
const per = Math.max(600, Math.floor(walkMs / frames));
for (let i = 0; i < frames; i++) {
  await page.evaluate((k) => {
    const g = window.NOCLIP;
    g.player.pitch = 0;
    g.player.yaw += k * 0.8;
    if (window.__nopool) g.world.pool.forEach((p) => { p.visible = false; p.intensity = 0; });
  }, i === 0 ? 0 : 1);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(per);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(root, `qa/backrooms-${level}-${i}.png`) });
}

const after = await page.evaluate(() => {
  const g = window.NOCLIP;
  return {
    pos: g.player && { x: +g.player.pos.x.toFixed(1), z: +g.player.pos.z.toFixed(1) },
    hp: Math.round(g.hp), sanity: Math.round(g.sanity), battery: Math.round(g.camBattery),
    fps: Math.round(1 / (g.lastDt || 0.016)),
    triangles: g.renderer.info.render.triangles,
  };
});
console.log('after walk', JSON.stringify(after));

if (errors.length) {
  console.log('\n--- errors ---');
  for (const e of [...new Set(errors)].slice(0, 25)) console.log(e);
}
await browser.close();
server.close();
console.log(errors.length ? `\n${errors.length} error(s)` : '\nno page errors');
process.exit(errors.length ? 1 : 0);
