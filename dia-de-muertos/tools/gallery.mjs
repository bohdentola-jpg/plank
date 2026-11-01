// Model gallery: renders every prop, character and card picture on its own so
// broken or ugly models are easy to spot. Output: qa/gallery_*.png
//   node tools/gallery.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
await mkdir(join(root, 'qa'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?fast&lowq`);
const sheets = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  while (!window.__game?.engine?.stage) await sleep(200);
  const G = window.__game;
  const { makeProp, PROP_INFO } = await import('./src/props.js');
  const { makeCharacter, CAST } = await import('./src/characters.js');
  const { CARD_PROPS } = await import('./src/cardprops.js');
  const sheet = async (title, entries, size = 180) => {
    const cols = 6;
    const rows = Math.ceil(entries.length / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * size; cv.height = rows * (size + 22) + 30;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f3ead8'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#222'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(title, 8, 22);
    for (let i = 0; i < entries.length; i++) {
      const [name, make, opts] = entries[i];
      let url = null;
      try { url = G.engine.thumb(make(), { size: size * 2, ...opts }); } catch (e) { console.log('fail', name, e.message); }
      const x = (i % cols) * size, y = 30 + Math.floor(i / cols) * (size + 22);
      ctx.fillStyle = (i + Math.floor(i / cols)) % 2 ? '#e8dcc4' : '#efe5d2';
      ctx.fillRect(x, y, size, size + 22);
      if (url) {
        const img = new Image();
        img.src = url;
        await img.decode();
        ctx.drawImage(img, x, y, size, size);
      }
      ctx.fillStyle = '#222'; ctx.font = '13px sans-serif'; ctx.fillText(name, x + 4, y + size + 16);
    }
    return cv.toDataURL('image/png');
  };
  const props = Object.keys(PROP_INFO).map((id) => [id, () => makeProp(id)]);
  const chars = [...Object.keys(CAST), 101, 107, 114, 201, 213, 300, 311, 431].map((id) => [String(id), () => makeCharacter(id).root, { dir: [0.25, 0.12, 1], fill: 0.95 }]);
  const cards = Object.keys(CARD_PROPS).map((id) => [id, () => CARD_PROPS[id]()]);
  return {
    props1: await sheet('props (1)', props.slice(0, 36)),
    props2: await sheet('props (2)', props.slice(36)),
    chars: await sheet('characters', chars),
    cards: await sheet('card pictures', cards),
  };
});
for (const [k, url] of Object.entries(sheets)) {
  await writeFile(join(root, 'qa', `gallery_${k}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('saved', `qa/gallery_${k}.png`);
}
await browser.close();
server.close();
process.exit(0);
