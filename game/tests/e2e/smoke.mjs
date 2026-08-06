// smoke test for "game": load menu, join solo, chat, editor — screenshot each.
import { chromium } from 'playwright';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, '..', 'qa', 'shots');
await fs.mkdir(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/plain', '.toml': 'text/plain' };
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const data = await fs.readFile(path.join(ROOT, p));
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(8899, r));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

const step = async (name, fn) => {
  try { await fn(); console.log('  ok  ' + name); }
  catch (e) { console.log('FAIL  ' + name + ' — ' + e.message.split('\n')[0]); process.exitCode = 1; }
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
};

await step('01-menu', async () => {
  await page.goto('http://127.0.0.1:8899/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#btn-join', { state: 'visible', timeout: 5000 });
  const title = await page.title();
  if (title !== 'game') throw new Error('title=' + title);
});

await step('02-private-screen', async () => {
  await page.click('#btn-private');
  await page.waitForSelector('#priv-code', { state: 'visible' });
  await page.click('#btn-priv-back');
  await page.waitForSelector('#btn-join', { state: 'visible' });
});

await step('03-maps-screen', async () => {
  await page.click('#btn-create');
  await page.waitForSelector('#btn-maps-new', { state: 'visible' });
  // sample map should be seeded
  await page.waitForSelector('.map-row', { timeout: 4000 });
});

await step('04-editor', async () => {
  await page.click('#btn-maps-new');
  await page.waitForSelector('.ed-top', { timeout: 4000 });
});

await step('05-editor-place-box', async () => {
  // pick "box" from the palette and click the canvas
  await page.click('.ed-model');
  await page.mouse.click(640, 400);
  await page.waitForTimeout(300);
});

await step('06-editor-script-modal', async () => {
  // select the placed box and open script editor
  await page.click('.ed-tool'); // select tool
  await page.mouse.click(640, 400);
  await page.waitForSelector('.ed-right', { state: 'visible', timeout: 3000 });
  await page.click('.ed-right .ed-btn.ed-wide'); // add script
  await page.waitForSelector('.ed-script', { timeout: 3000 });
  await page.fill('.ed-script', 'when clicked\n  say "hi"\n  sound pop\nend');
  await page.click('.ed-modal-bar .ed-btn:first-child'); // check
  const err = await page.textContent('.ed-errors');
  if (!err.includes('looks good')) throw new Error('check said: ' + err);
  await page.click('.ed-modal-bar .ed-primary'); // save script
});

await step('07-editor-test-play', async () => {
  await page.click('.ed-top .ed-primary'); // ▶ test
  await page.waitForTimeout(1200);
  // canvas visible, editor gone
  const vis = await page.isVisible('.ed-top');
  if (vis) throw new Error('editor chrome still visible in test mode');
});

await step('08-test-walk-and-jump', async () => {
  await page.keyboard.down('d');
  await page.waitForTimeout(600);
  await page.keyboard.up('d');
  await page.keyboard.press('w');
  await page.waitForTimeout(400);
});

await step('09-back-to-editor', async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.ed-top', { timeout: 4000 });
});

await step('10-menu-back', async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('#btn-join', { state: 'visible', timeout: 4000 });
});

// solo session on the MAIN map via private-lobby fallback is network-dependent,
// so drive the sample map's "play" (soloLobby → real session, main-map-like)
await step('11-play-sample-map', async () => {
  await page.click('#btn-create');
  await page.waitForSelector('.map-row');
  await page.click('.map-row .menu-mini:nth-child(3)'); // play
  await page.waitForTimeout(1500);
});

await step('12-chat-bubble', async () => {
  await page.keyboard.press('t');
  await page.waitForSelector('#chatinput', { state: 'visible' });
  await page.fill('#chatinput', 'hello world');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
});

await step('13-walk-into-sign', async () => {
  await page.keyboard.down('a');
  await page.waitForTimeout(900);
  await page.keyboard.up('a');
  await page.waitForTimeout(600);
});

const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('peerjs') && !e.includes('PeerJS'));
if (realErrors.length) {
  console.log('\nJS ERRORS:');
  for (const e of realErrors) console.log('  ' + e);
  process.exitCode = 1;
} else {
  console.log('\nno js errors');
}

await browser.close();
server.close();
