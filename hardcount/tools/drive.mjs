// QA driver: open a screen, then run a script of steps against the live page.
//   node hardcount/tools/drive.mjs "<query>" script.json
// steps: { wait: ms } | { key: 'KeyK', hold?: ms } | { eval: 'js' } | { shot: 'name.png' }
//        | { until: 'js expr', timeout: ms } (poll until truthy)
//        | { dualsense: true } (first step: plug in a virtual DualSense) then
//          { pad: 'cross', hold?: ms } (a button by name) | { stick: [lx, ly, rx, ry], hold: ms }
//        Rumble the game asks for lands in window.__rumbles.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const [query = '', scriptPath] = process.argv.slice(2);
const steps = JSON.parse(await readFile(scriptPath, 'utf8'));
await mkdir(join(root, 'qa'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[qa]')) console.log(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}\n${e.stack}`));
// a DualSense on the standard mapping, driven from the steps
const PAD_BUTTONS = ['cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'l2', 'r2', 'create', 'options', 'l3', 'r3', 'dup', 'ddown', 'dleft', 'dright', 'ps', 'touch'];
if (steps[0]?.dualsense) {
  await page.addInitScript(() => {
    const mk = () => ({ pressed: false, touched: false, value: 0 });
    const pad = {
      id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      index: 0, connected: true, mapping: 'standard', timestamp: 0,
      buttons: Array.from({ length: 18 }, mk),
      axes: [0, 0, 0, 0],
      vibrationActuator: { type: 'dual-rumble', playEffect(type, p) { (window.__rumbles ||= []).push({ type, ...p }); return Promise.resolve('complete'); } },
    };
    window.__pad = pad;
    // a press stays down until the game has polled it twice, and counts as done once
    // the game has seen it come back up twice (a slow headless frame can't swallow it)
    let polls = 0;
    const presses = [];
    const tick = () => {
      const now = performance.now();
      for (const p of presses) {
        if (p.phase === 'down' && now >= p.at + p.ms && polls >= p.poll + 2) { pad.buttons[p.i].pressed = false; pad.buttons[p.i].value = 0; p.phase = 'up'; p.poll = polls; }
        else if (p.phase === 'up' && polls >= p.poll + 2) p.phase = 'done';
      }
    };
    Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => { polls++; tick(); return [pad, null, null, null]; } });
    window.__padPress = (i, ms) => { const b = pad.buttons[i]; b.pressed = true; b.value = 1; presses.push({ i, ms, at: performance.now(), poll: polls, phase: 'down' }); };
    window.__padBusy = () => presses.some((p) => p.phase !== 'done');
    window.__padAxes = (a, ms) => { pad.axes = a.slice(); setTimeout(() => { pad.axes = [0, 0, 0, 0]; }, ms); };
  });
}
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/hardcount/index.html?${query}`);
for (const st of steps) {
  if (st.wait) await page.waitForTimeout(st.wait);
  if (st.key) {
    if (st.hold) { await page.keyboard.down(st.key); await page.waitForTimeout(st.hold); await page.keyboard.up(st.key); } else await page.keyboard.press(st.key);
  }
  if (st.pad) {
    const hold = st.hold || 260;
    await page.evaluate(([i, ms]) => window.__padPress(i, ms), [PAD_BUTTONS.indexOf(st.pad), hold]);
    const end = Date.now() + 8000;
    do await page.waitForTimeout(60); while (Date.now() < end && await page.evaluate(() => window.__padBusy()));
  }
  if (st.stick) {
    const hold = st.hold || 400;
    await page.evaluate(([a, ms]) => window.__padAxes(a, ms), [st.stick, hold]);
    await page.waitForTimeout(hold + 120);
  }
  if (st.until) {
    const end = Date.now() + (st.timeout || 20000);
    let ok = false;
    while (Date.now() < end) { try { ok = await page.evaluate(st.until); } catch { ok = false; } if (ok) break; await page.waitForTimeout(150); }
    console.log(`[until] ${st.until} → ${ok} @${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  if (st.eval) { try { const r = await page.evaluate(st.eval); console.log('[eval]', JSON.stringify(r)); } catch (e) { console.log('[eval error]', e.message); } }
  if (st.shot) await page.screenshot({ path: join(root, 'qa', st.shot) });
}
console.log(`done (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
await browser.close();
server.close();
process.exit(0);
