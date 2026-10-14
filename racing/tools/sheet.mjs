// Contact sheet of every car: node racing/tools/sheet.mjs out.png [env] [ang] [dist] [h] [lookJSON]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
const [out = 'sheet.png', env = 'studio', ang = '0.7', dist = '6.6', h = '1.45', look = '{}'] = process.argv.slice(2);
await mkdir(join(root, 'qa', 'cells'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/racing/index.html?screen=carlab&env=${env}`);
await page.waitForTimeout(2500);
const ids = await page.evaluate(() => window.__carlab.ids);
const files = [];
for (const id of ids) {
  await page.evaluate(([i, a, d, hh, lk]) => window.__carlab.set(i, a, d, hh, lk), [id, Number(ang), Number(dist), Number(h), JSON.parse(look)]);
  await page.waitForTimeout(900);
  const f = join(root, 'qa', 'cells', `${id}.png`);
  const el = await page.$('#tv-screen');
  await el.screenshot({ path: f });
  files.push(f);
}
await browser.close();
server.close();
execFileSync('python3', ['-c', `
import sys
from PIL import Image
files = sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
s = 0.5
tw, th = int(w*s), int(h*s)
cols = 4
rows = (len(ims)+cols-1)//cols
sheet = Image.new('RGB', (tw*cols, th*rows), (0,0,0))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th)), ((i%cols)*tw, (i//cols)*th))
sheet.save(sys.argv[1])
`, join(root, 'qa', out), ...files]);
console.log('saved', out);
