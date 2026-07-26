// Drives the EB GAMES 95 desktop in Chromium and checks the shelf furniture:
// every cartridge has an icon, icons can be dragged, nothing can be dragged
// off an edge or under the taskbar, two icons never end up in one slot, a
// moved icon stays moved across a reload, a resize strands nothing, a window's
// title bar cannot go under the taskbar, and a game still opens from its
// window.  Usage: node tools/desk-check.mjs
// Exits non-zero on any problem or page error.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    if (p.endsWith('/')) p += 'index.html';
    const d = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(d);
  } catch { res.writeHead(404); res.end('no'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
await mkdir(join(root, 'qa'), { recursive: true });

const fails = [];
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
page.on('pageerror', (e) => fails.push('ERR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') fails.push('CON ' + m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForTimeout(3800);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

const TASKBAR = 30;

const iconBoxes = () => page.$$eval('.dicon', (els) => els.map((e) => {
  const r = e.getBoundingClientRect();
  return { label: e.textContent.trim(), x: r.x, y: r.y, right: r.right, bottom: r.bottom };
}));

// ---- every cartridge present, and none of them off the bottom to begin with
let boxes = await iconBoxes();
console.log(`icons: ${boxes.length}`);
for (const want of ['VARSITY 27', "BIG INNING '27", 'RIM CITY', 'LOAM', 'MASCOT MELEE 64',
  'QUAHOG HIT & RUN', 'NO VACANCY', 'NOCLIP', 'FOCUS GROUP', 'EB Hi-Fi', 'About']) {
  if (!boxes.some((x) => x.label === want)) fails.push(`missing icon: ${want}`);
}
for (const x of boxes) {
  if (x.bottom > 768 - TASKBAR + 1) fails.push(`${x.label} starts under the taskbar (bottom ${x.bottom.toFixed(0)})`);
  if (x.right > 1366 + 1 || x.x < -1) fails.push(`${x.label} starts off the side`);
}
await page.screenshot({ path: join(root, 'qa/desk-icons.png') });

// ---- drag one hard into the bottom-right corner and well past it
const drag = async (label, toX, toY) => {
  const el = await page.$(`.dicon:has-text("${label}")`);
  const r = await el.boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
};
await drag('NO VACANCY', 3000, 3000);
boxes = await iconBoxes();
const nv = boxes.find((x) => x.label === 'NO VACANCY');
console.log(`NO VACANCY dragged to bottom-right → bottom ${nv.bottom.toFixed(0)}, right ${nv.right.toFixed(0)}`);
if (nv.bottom > 768 - TASKBAR + 1) fails.push(`dragging past the corner put it under the taskbar (${nv.bottom.toFixed(0)})`);
if (nv.right > 1366 + 1) fails.push('dragging past the corner put it off the right');

await drag('LOAM', -900, -900);
boxes = await iconBoxes();
const lo = boxes.find((x) => x.label === 'LOAM');
if (lo.x < -1 || lo.y < -1) fails.push(`dragging past the top-left escaped: (${lo.x}, ${lo.y})`);

// ---- a real move to a sensible place, and does it survive a reload?
await drag('FOCUS GROUP', 700, 420);
const before = (await iconBoxes()).find((x) => x.label === 'FOCUS GROUP');
await page.reload();
await page.waitForTimeout(1800);
const after = (await iconBoxes()).find((x) => x.label === 'FOCUS GROUP');
if (Math.abs(before.x - after.x) > 2 || Math.abs(before.y - after.y) > 2) {
  fails.push(`a moved icon did not stay put across a reload: (${before.x},${before.y}) → (${after.x},${after.y})`);
}
await page.screenshot({ path: join(root, 'qa/desk-dragged.png') });

// ---- a shrunken window must not strand anything
await page.setViewportSize({ width: 900, height: 520 });
await page.waitForTimeout(1000);
for (const x of await iconBoxes()) {
  if (x.bottom > 520 - TASKBAR + 1) fails.push(`${x.label} is under the taskbar after a resize (${x.bottom.toFixed(0)})`);
  if (x.right > 900 + 1) fails.push(`${x.label} is off the right after a resize`);
}
await page.setViewportSize({ width: 1366, height: 768 });
await page.waitForTimeout(400);

// ---- dropping one icon on another must not stack them
await drag('RIM CITY', 700, 420);   // straight on top of FOCUS GROUP
{
  const bs = await iconBoxes();
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      if (Math.abs(bs[i].x - bs[j].x) < 4 && Math.abs(bs[i].y - bs[j].y) < 4) {
        fails.push(`${bs[i].label} and ${bs[j].label} are stacked in the same slot`);
      }
    }
  }
}

// ---- open the hotel window and drag it at the floor
await page.click('.dicon:has-text("NO VACANCY")');
await page.waitForTimeout(120);
await page.dblclick('.dicon:has-text("NO VACANCY")');
await page.waitForTimeout(600);
const title = await page.$('.win.focus .win-title');
if (!title) fails.push('the NO VACANCY window did not open');
else {
  const r = await title.boundingBox();
  await page.mouse.move(r.x + 80, r.y + 10);
  await page.mouse.down();
  await page.mouse.move(700, 4000, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const wb = await (await page.$('.win.focus')).boundingBox();
  console.log(`window dragged at the floor → top ${wb.y.toFixed(0)} (taskbar starts at ${768 - TASKBAR})`);
  if (wb.y > 768 - TASKBAR - 20) fails.push(`the window title bar went under the taskbar (top ${wb.y.toFixed(0)})`);
}
await page.screenshot({ path: join(root, 'qa/desk-window.png') });

// ---- and the game itself loads from the shelf
const [tab] = await Promise.all([
  page.context().waitForEvent('page'),
  page.click('.win.focus .play95'),
]);
await tab.waitForTimeout(3500);
const ok = await tab.evaluate(() => !!document.querySelector('#scr-title, #boot'));
if (!ok) fails.push('NO VACANCY did not boot from the shelf');
await tab.screenshot({ path: join(root, 'qa/desk-hotel-boot.png') });

// ---- and the way back from a game to the shelf
await tab.click('#boot');
await tab.waitForTimeout(1200);
const back = await tab.$('.back-link');
if (!back) fails.push('NO VACANCY has no way back to the shelf');
else {
  const href = await back.getAttribute('href');
  if (href !== '../index.html') fails.push(`the back link points at ${href}`);
  const vis = await back.isVisible();
  if (!vis) fails.push('the back link is not visible on the title screen');
}
await tab.screenshot({ path: join(root, 'qa/desk-hotel-title.png') });

console.log(fails.length ? `\n${fails.length} problem(s)\n${fails.join('\n')}` : '\ndesktop checks passed');
await b.close();
server.close();
process.exit(fails.length ? 1 : 0);
