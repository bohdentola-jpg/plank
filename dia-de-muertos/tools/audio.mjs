// Plays every music track and sound effect for a moment in headless Chromium
// and reports any errors (WebAudio runs without speakers).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(join(root, p))); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|GL Driver/.test(m.text())) errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?lowq`);
const out = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  while (!window.__game) await sleep(100);
  const s = window.__game.sound;
  s.ensure();
  const state = s.ctx?.state;
  const tracks = ['title', 'home', 'market', 'workshop', 'plaza', 'cemetery', 'ofrenda'];
  for (const tr of tracks) { s.music(tr, true); await sleep(1200); }
  for (const amb of ['night', 'crowd', 'birds']) { s.setAmbient(amb); await sleep(600); }
  const fx = ['tap', 'tick', 'card', 'pickup', 'sparkle', 'chime', 'success', 'loteria', 'tok', 'snip', 'whoosh', 'petal', 'strike', 'bark', 'ding', 'page', 'bean', 'knead', 'pour', 'oops', 'brush'];
  for (const f of fx) { s.sfx(f); await sleep(80); }
  return { state, plucks: s.pluckCache.size, tracks: tracks.length, fx: fx.length };
});
console.log(JSON.stringify(out), errors.length ? errors : 'no errors');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
