// Screenshot driver for FOCUS GROUP. Boots the game headless, drops the player
// where you ask, and captures frames into qa/.
//   node tools/shot-focusgroup.mjs                       # a tour of the flat
//   node tools/shot-focusgroup.mjs --day 5               # dressed for Saturday
//   node tools/shot-focusgroup.mjs --set studio          # the soundstage
//   node tools/shot-focusgroup.mjs --set basement
//   node tools/shot-focusgroup.mjs --cut kettle          # sit on a hidden camera
//   node tools/shot-focusgroup.mjs --ad                  # the cold open, frame by frame
//   node tools/shot-focusgroup.mjs --props               # every model on a grid
// Exits non-zero on any page error.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/focusgroup/index.html';
    if (p.endsWith('/')) p += 'index.html';
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
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const flag = (n) => args.includes(`--${n}`);
const set = opt('set', 'flat');
const day = parseInt(opt('day', set === 'studio' ? '6' : '4'), 10);
const quiet = flag('quiet');

// where to stand and what to look at, per set
const TOURS = {
  flat: [
    ['bedroom', -0.9, -6.2, 3.6, -0.04],
    ['hall', -1.4, -4.5, 1.35, 0.0],
    ['living', -0.4, -0.6, 2.15, -0.02],
    ['sofa-tv', -1.2, -1.1, 1.55, 0.0],
    ['window', -2.2, -1.6, 3.05, 0.05],
    ['kitchen', 1.5, -2.3, 3.05, 0.0],
    ['counter', 2.0, 0.0, 3.05, -0.1],
    ['bathroom', 0.8, -6.4, 3.14, -0.05],
    ['bedroom-door', -2.00, -7.00, 2.80, 0.02],
    ['bathroom-door', 0.90, -7.60, 3.19, 0.02],
  ],
  basement: [
    ['car', -0.9, 0.0, -1.57, 0.0],
    ['corridor', 2.4, 0.0, -1.57, 0.02],
    ['panel', 5.0, -0.5, -1.9, 0.05],
    ['corner', 8.9, 2.0, 3.14, 0.0],
    ['door', 9.0, 6.4, 3.14, 0.0],
  ],
  studio: [
    ['wake', -0.85, -2.8, 1.57, 0.0],
    ['reveal', 0.6, -1.4, -1.45, 0.03],
    ['house', 3.2, -1.2, -1.57, 0.05],
    ['monitors', 4.4, -4.4, -2.4, 0.05],
    ['mark', -2.35, -0.3, -1.4, 0.0],
    ['back', -5.6, -1.4, -1.57, 0.0],
  ],
};

const errors = [];
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
  else if (!quiet && m.type() === 'warning') console.log('[warn]', m.text());
});

// ------------------------------------------------------------------ the models
if (flag('props')) {
  const rows = parseInt(opt('rows', '9'), 10);
  await page.goto(`http://127.0.0.1:${port}/focusgroup/?props&row=0`);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(root, 'qa/focusgroup-props-all.png') });
  // and a close-up of everything with detail worth checking
  const CLOSE = ['valMascot', 'avatar', 'coffeeMaker', 'clockRadio', 'figurine',
    'cabinetMirror', 'television', 'studioCamera', 'servicesDoor', 'extractor',
    'window7 (shut)', 'basin', 'lensBead'];
  for (const name of CLOSE) {
    const q = encodeURIComponent(name);
    await page.goto(`http://127.0.0.1:${port}/focusgroup/?props&only=${q}&dist=2.4&y=1.35&h=1.05`);
    await page.waitForTimeout(1100);
    await page.keyboard.press('Space');
    await page.waitForTimeout(2200);
    await page.screenshot({ path: join(root, `qa/focusgroup-prop-${name.replace(/[^a-z0-9]/gi, '')}.png`) });
  }
  for (let r = 0; r < rows; r++) {
    await page.goto(`http://127.0.0.1:${port}/focusgroup/?props&row=${r}&dist=10.6&y=2.8&h=0.9`);
    await page.waitForTimeout(1200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(2600);
    await page.screenshot({ path: join(root, `qa/focusgroup-props-row${r}.png`) });
  }
  console.log(errors.length ? `\n${errors.length} error(s)\n${errors.slice(0, 10).join('\n')}` : '\nno page errors');
  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
}

// ------------------------------------------------------------------ the ad
if (flag('ad')) {
  await page.goto(`http://127.0.0.1:${port}/focusgroup/`);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.click('#t-new');
  for (let i = 0; i < 13; i++) {
    await page.waitForTimeout(2200);
    await page.screenshot({ path: join(root, `qa/focusgroup-ad-${i}.png`) });
  }
} else {
  await page.goto(`http://127.0.0.1:${port}/focusgroup/?day=${day}`);
  await page.waitForTimeout(1200);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.FOCUSGROUP?.state === 'play', { timeout: 40000 })
    .catch(() => errors.push('[fail] never reached play state'));
  await page.waitForTimeout(2500);

  if (set !== 'flat') {
    await page.evaluate(async (which) => {
      const g = window.FOCUSGROUP;
      if (which === 'basement') await g.goToBasement();
    }, set);
    await page.waitForTimeout(2500);
  }

  if (flag('rig')) {
    await page.evaluate(() => {
      const g = window.FOCUSGROUP;
      g.world.props.rigUp?.(1);
      g.world.props.cams?.wide?.setLive(true);
      g.world.props.sign?.setOn(true);
      if (g.world.props.val) g.world.props.val.group.visible = true;
      g.paintMonitors?.();
    });
    await page.waitForTimeout(600);
  }

  const cut = opt('cut', null);
  if (cut) {
    // stand somewhere the camera can see, so the shot has you in it
    const AT = { smoke: [-1.2, -4.5], peephole: [0.4, -4.6], kettle: [1.9, -0.9],
      tv: [-1.6, -0.9], vent: [1.5, -1.4], mirror: [0.85, -7.3], clock: [-2.2, -6.6],
      blinds: [-2.2, -1.4] };
    const at = AT[cut] || [-1.6, -1.1];
    await page.evaluate(([px, pz]) => {
      const g = window.FOCUSGROUP;
      g.player.pos.x = px; g.player.pos.z = pz; g.player.yaw = 1.2;
    }, at);
    await page.waitForTimeout(400);
    await page.evaluate((id) => window.FOCUSGROUP.director.cut(id, 1e6, { force: true, locked: true }), cut);
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(root, `qa/focusgroup-cut-${cut}.png`) });
  } else {
    for (const [name, x, z, yaw, pitch] of TOURS[set] || TOURS.flat) {
      await page.evaluate(([px, pz, py, pp]) => {
        const g = window.FOCUSGROUP;
        g.player.pos.x = px;
        g.player.pos.z = pz;
        g.player.yaw = py;
        g.player.pitch = pp;
      }, [x, z, yaw, pitch]);
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(root, `qa/focusgroup-${set}${day}-${name}.png`) });
    }
  }

  const info = await page.evaluate(() => {
    const g = window.FOCUSGROUP;
    return {
      state: g.state, day: g.day?.n, room: g.playerRoom,
      interacts: g.world?.interacts.length, colliders: g.world?.colliders.length,
      lenses: [...(g.activeLenses || [])].length, frames: g.director?.frames.length,
      calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles,
    };
  });
  if (!quiet) console.log(JSON.stringify(info));
}

console.log(errors.length ? `\n${errors.length} error(s)\n${errors.slice(0, 10).join('\n')}` : '\nno page errors');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
