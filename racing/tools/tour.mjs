// Track tour: parks the trackview camera at a few points along each track and
// stitches the captures into one contact sheet (qa/<out>).
//   node racing/tools/tour.mjs tour.png [ids=all|id,id] [--n 4] [--h 1.5] [--look 40]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const n = Number(flag('n', '4'));
const camH = Number(flag('h', '1.5'));
const look = Number(flag('look', '40'));
const [out = 'tour.png', idsArg = 'all'] = args;

await mkdir(join(root, 'qa', 'cells'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });

await page.goto(`http://127.0.0.1:${port}/racing/index.html?screen=dev`);
const ids = idsArg === 'all'
  ? await page.evaluate(async () => (await import('./src/track/tracks.js')).TRACKS.map((t) => t.id))
  : idsArg.split(',');

const files = [];
const t0 = Date.now();
for (const id of ids) {
  await page.goto(`http://127.0.0.1:${port}/racing/index.html?screen=trackview&track=${id}`);
  await page.waitForFunction(() => window.__trackview, null, { timeout: 120000 });
  const len = await page.evaluate(() => window.__trackview.length);
  const box = await page.locator('canvas').first().boundingBox();
  for (let k = 0; k < n; k++) {
    const s = len * ((k + 0.5) / n);
    await page.evaluate(([s, h, lk]) => window.__trackview.set(s, h, 0, lk, 0), [s, camH, look]);
    await page.waitForTimeout(1500);
    const f = join(root, 'qa', 'cells', `t_${id}_${k}.png`);
    await page.screenshot({ path: f, clip: box });
    files.push([f, `${id} s=${Math.round(s)}`]);
  }
  console.log(id, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
server.close();
execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
out, cols = sys.argv[1], int(sys.argv[2])
rest = sys.argv[3:]
files, labels = rest[0::2], rest[1::2]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = 400, int(400 * ims[0].size[1] / ims[0].size[0])
ims = [im.resize((w, h)) for im in ims]
rows = (len(ims)+cols-1)//cols
sheet = Image.new('RGB', (w*cols, h*rows), (0,0,0))
d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i%cols)*w, (i//cols)*h
    sheet.paste(im, (x, y))
    d.text((x+8, y+6), labels[i], fill=(255,255,0))
sheet.save(out)
`, join(root, 'qa', out), String(n), ...files.flat()]);
console.log('saved', out, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(0);
