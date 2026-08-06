// 3D smoke: boot the menu, walk the world, open the editor, model a voxel thing.
import { chromium } from 'playwright';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, '..', 'qa', 'shots');
await fs.mkdir(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    let p = new URL(req.url, 'http://x').pathname;
    if (p === '/') p = '/index.html';
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(await fs.readFile(path.join(ROOT, p)));
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8899, r));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('  ok  ' + name); }
  catch (e) { console.log('FAIL  ' + name + ' — ' + String(e.message).split('\n')[0]); failed = 1; }
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
};

await step('01-menu', async () => {
  await page.goto('http://127.0.0.1:8899/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#btn-join', { state: 'visible', timeout: 8000 });
  if (await page.title() !== 'game') throw new Error('bad title');
});

await step('02-main-world', async () => {
  await page.click('#btn-create');
  await page.waitForSelector('.map-row');
  await page.click('#btn-maps-back');
  // play the main world solo through the private flow's map=null path
  await page.evaluate(() => {
    const g = window.__game;
    window.__startSolo = true;
  });
  // simplest deterministic path: play the sample map, then the main map
  await page.click('#btn-create');
  await page.waitForSelector('.map-row');
  await page.click('.map-row .menu-mini:nth-of-type(2)'); // play
  await page.waitForFunction(() => window.__game.session, null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => {
    const s = window.__game.session;
    return { ents: s.ents.length, y: s.me.y, players: s.players.size, pixel: s.view.pixel };
  });
  if (!st.ents) throw new Error('no entities: ' + JSON.stringify(st));
});

await step('03-walk', async () => {
  await page.mouse.move(640, 380);
  await page.mouse.down(); await page.mouse.up();   // grab pointer lock
  await page.waitForTimeout(400);
  await page.keyboard.down('w');
  await page.waitForTimeout(1200);
  await page.keyboard.up('w');
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
});

await step('04-chat-bubble', async () => {
  await page.keyboard.press('t');
  await page.waitForSelector('#chatinput', { state: 'visible' });
  await page.fill('#chatinput', 'hello from 3d');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  const has = await page.evaluate(() => document.querySelectorAll('.bubble').length);
  if (!has) throw new Error('no bubble element');
});

await step('05-pause', async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('#pause', { state: 'visible' });
});

await step('06-leave-to-menu', async () => {
  await page.click('#pause-leave');
  await page.waitForTimeout(600);
});

await step('07-editor-world', async () => {
  // leaving a played map drops us back on the map list
  await page.waitForSelector('#btn-maps-new', { state: 'visible', timeout: 8000 });
  await page.click('#btn-maps-new');
  await page.waitForSelector('.ed-top', { timeout: 8000 });
  await page.waitForTimeout(2000);
});

await step('08-place-objects', async () => {
  await page.click('.ed-left .ed-model'); // first model (box)
  for (const [x, y] of [[600, 430], [660, 450], [720, 430]]) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(150);
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);
  }
  const n = await page.evaluate(() => window.__game.editor.map.objects.length);
  if (n < 3) throw new Error('placed ' + n);
});

await step('09-inspector-script', async () => {
  await page.waitForSelector('.ed-right', { state: 'visible' });
  const btn = await page.locator('.ed-right .ed-btn.ed-wide').first();
  await btn.click();
  await page.waitForSelector('.ed-script');
  await page.fill('.ed-script', 'to hop with n\n  repeat with i from 1 to n\n    spawn box at my x, i * 2, my z\n  end\nend\n\nwhen clicked\n  hop with 3\n  say "tower!"\nend');
  await page.click('.ed-modal-bar .ed-btn:first-child');
  await page.waitForTimeout(400);
  const err = await page.textContent('.ed-errors');
  if (!err.includes('looks good')) throw new Error('check said: ' + err);
  await page.click('.ed-modal-bar .ed-primary');
});

await step('10-modeller', async () => {
  await page.click('.ed-left .ed-btn.ed-wide'); // make a model
  await page.waitForFunction(() => window.__game.editor.mode === 'model', null, { timeout: 5000 });
  await page.waitForTimeout(900);
  const before = await page.evaluate(() => window.__game.editor.mdl.vox.data.replace(/\./g, '').length);
  // click on the shape to add voxels
  for (const [x, y] of [[640, 360], [660, 350], [620, 370]]) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(220);
  }
  const after = await page.evaluate(() => window.__game.editor.mdl.vox.data.replace(/\./g, '').length);
  if (after <= before) throw new Error('voxel count did not grow: ' + before + ' → ' + after);
});

await step('11-save-model', async () => {
  await page.fill('.ed-left input', 'blob');
  const btns = await page.locator('.ed-left .ed-btn.ed-primary');
  await btns.first().click();
  await page.waitForFunction(() => window.__game.editor.mode === 'world', null, { timeout: 5000 });
  const models = await page.evaluate(() => Object.keys(window.__game.editor.map.models));
  if (!models.includes('blob')) throw new Error('models: ' + models.join());
  await page.waitForTimeout(600);
});

await step('12-place-custom-model', async () => {
  await page.mouse.move(560, 460);
  await page.waitForTimeout(200);
  await page.mouse.click(560, 460);
  await page.waitForTimeout(300);
  const has = await page.evaluate(() => window.__game.editor.map.objects.some(o => o.model === 'blob'));
  if (!has) throw new Error('custom model not placed');
});

await step('13-test-play', async () => {
  await page.click('.ed-top .ed-primary');
  await page.waitForFunction(() => window.__game.session, null, { timeout: 12000 });
  await page.waitForTimeout(2200);
  const st = await page.evaluate(() => {
    const s = window.__game.session;
    return { ents: s.ents.length, errors: s.errors, test: s.testMode };
  });
  if (!st.test) throw new Error('not in test mode');
  if (st.errors.length) throw new Error('script errors: ' + st.errors.join(' | '));
});

await step('14-back-to-editor', async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('#pause', { state: 'visible' });
  await page.click('#pause-leave');
  await page.waitForSelector('.ed-top', { timeout: 8000 });
  await page.waitForTimeout(800);
});

const real = errors.filter(e => !/favicon|peerjs|PeerJS|WebGL|SwiftShader|GroupMarkerNotSet|Automatic fallback/i.test(e));
if (real.length) { console.log('\nJS ERRORS:'); real.forEach(e => console.log('  ' + e)); failed = 1; }
else console.log('\nno js errors');

await browser.close();
server.close();
process.exit(failed);
