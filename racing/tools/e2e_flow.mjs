// First-time player flow: boot → radio → story → classifieds → hub, plus
// radio → quick race lot → route. Fails loudly on page errors.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
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
await mkdir(join(root, 'qa'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('[console.error]', m.text()); } });
const base = `http://127.0.0.1:${server.address().port}/racing/index.html`;
const screen = () => page.evaluate(() => window.__game?.screen?.name || null);
const waitScreen = async (name, ms = 120000) => {
  await page.waitForFunction((n) => window.__game?.screen?.name === n && !window.__game._transition, name, { timeout: ms, polling: 500 });
};
// headless frames are slow: wait in GAME seconds, not wall seconds
const waitGame = async (sec) => {
  const t = await page.evaluate(() => window.__game.time);
  await page.waitForFunction((tt) => window.__game.time >= tt, t + sec, { timeout: 600000, polling: 250 });
};
const press = async (key, gameSec = 0.6) => { await page.keyboard.press(key); await waitGame(gameSec); };
const step = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
const t0 = Date.now();
await page.goto(base);
await page.waitForFunction(() => window.__game?.screen, null, { timeout: 60000 });
step('boot: ' + await screen());
await press('Space', 1);
await waitScreen('radio');
step('radio up');
await waitGame(5);
await press('ArrowRight', 1.5); // seek to 92.7 STORY
await press('Enter', 0.2);
await waitScreen('story');
step('story: ' + await page.evaluate(() => window.__story.page));
await waitGame(1);
await press('Enter', 1);
step('after phone: ' + await page.evaluate(() => window.__story.page));
await press('ArrowDown', 1);
await press('Enter', 1);
step('after buy: ' + await page.evaluate(() => JSON.stringify({ p: window.__story.page, cash: window.__story.story.s.cash, car: window.__story.story.car?.id })));
// the texts about the car, then chapter one's title card, then the hub
for (let k = 0; k < 6 && (await page.evaluate(() => window.__story.page)) !== 'hub'; k++) await press('Enter', 2);
step('hub: ' + await page.evaluate(() => window.__story.page));
await page.screenshot({ path: join(root, 'qa', 'flow_hub.png') });
await press('Escape', 0.3);
await waitScreen('radio');
step('back at radio');
await waitGame(5);
await press('ArrowLeft', 1.5); // back to 88.1
await press('Enter', 0.2);
await waitScreen('showroom');
step('showroom');
await waitGame(1.5);
await press('ArrowRight', 1);
await press('Enter', 1);
step('route phase: ' + await page.evaluate(() => window.__showroom.phase));
await page.screenshot({ path: join(root, 'qa', 'flow_route.png') });
console.log(errors.length ? `ERRORS: ${errors.length}` : 'NO ERRORS');
await browser.close();
server.close();
