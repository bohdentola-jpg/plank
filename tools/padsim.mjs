// Virtual DualSense harness: serves the repo, injects a fake standard-mapping
// gamepad into headless Chromium, drives it with a timed script, records
// rumble calls + page errors, and takes screenshots into qa/.
//
//   node tools/padsim.mjs "?quick" --script "800:press CROSS; 4000:press CROSS; 4200:stick 0 -1; 4200:down R2; 5500:shot run.png; 6000:up R2" --wait 7000
//
// Script events (semicolon separated, "time:command args"):
//   press BTN        tap a button (down, then up after 110ms)
//   down BTN / up BTN
//   stick LX LY      left stick (-1..1);  rstick RX RY  right stick
//   key Space        keyboard press (Playwright key name)
//   shot name.png    screenshot to qa/name.png
//   eval <js>        evaluate JS in page, print result
//   connect          fire gamepadconnected
// BTN names: CROSS CIRCLE SQUARE TRIANGLE L1 R1 L2 R2 SHARE OPTIONS L3 R3 UP DOWN LEFT RIGHT PS TOUCHPAD  or a number.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const BTN = { CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3, L1: 4, R1: 5, L2: 6, R2: 7, SHARE: 8, OPTIONS: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, PS: 16, TOUCHPAD: 17 };
const btnIndex = (s) => (s in BTN ? BTN[s] : parseInt(s, 10));

const [query = '', ...rest] = process.argv.slice(2);
const opt = (name, dflt) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : dflt; };
const wait = parseInt(opt('wait', '4000'), 10);
const width = parseInt(opt('w', '1366'), 10);
const height = parseInt(opt('h', '820'), 10);
const script = opt('script', '');
const quiet = rest.includes('--quiet');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); if (!quiet) console.log('[page error]', m.text()); } });
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });

await page.addInitScript(() => {
  const st = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, touched: false, value: 0 })), rumble: [] };
  window.__padState = st;
  const gp = {
    id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
    index: 0, connected: true, mapping: 'standard', hapticActuators: [],
    get timestamp() { return performance.now(); },
    get axes() { return st.axes; },
    get buttons() { return st.buttons; },
    vibrationActuator: {
      type: 'dual-rumble',
      playEffect(type, p) { st.rumble.push({ t: Math.round(performance.now()), type, ...p }); return Promise.resolve('complete'); },
      reset() { return Promise.resolve('complete'); },
    },
  };
  window.__gp = gp;
  navigator.getGamepads = () => [gp, null, null, null];
  window.__padConnect = () => { const e = new Event('gamepadconnected'); e.gamepad = gp; window.dispatchEvent(e); };
  window.__padSet = (i, pressed, value) => { const b = st.buttons[i]; b.pressed = pressed; b.touched = pressed; b.value = value ?? (pressed ? 1 : 0); };
  window.__padAxes = (a) => { for (let i = 0; i < a.length; i++) if (a[i] !== null && a[i] !== undefined) st.axes[i] = a[i]; };
});

await page.goto(`http://127.0.0.1:${port}/index.html${query}`);
await page.evaluate(() => window.__padConnect());

const events = script.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
  const m = s.match(/^(\d+)\s*:\s*(\S+)\s*(.*)$/);
  if (!m) throw new Error(`bad script event: ${s}`);
  return { t: parseInt(m[1], 10), cmd: m[2], args: m[3] };
}).sort((a, b) => a.t - b.t);

const start = Date.now();
for (const ev of events) {
  const delay = ev.t - (Date.now() - start);
  if (delay > 0) await page.waitForTimeout(delay);
  const a = ev.args.split(/\s+/).filter(Boolean);
  try {
    switch (ev.cmd) {
      case 'press': { const i = btnIndex(a[0]); await page.evaluate((i) => window.__padSet(i, true), i); await page.waitForTimeout(110); await page.evaluate((i) => window.__padSet(i, false), i); break; }
      case 'down': await page.evaluate((i) => window.__padSet(i, true), btnIndex(a[0])); break;
      case 'up': await page.evaluate((i) => window.__padSet(i, false), btnIndex(a[0])); break;
      case 'stick': await page.evaluate((v) => window.__padAxes([v[0], v[1]]), [parseFloat(a[0]), parseFloat(a[1])]); break;
      case 'rstick': await page.evaluate((v) => window.__padAxes([null, null, v[0], v[1]]), [parseFloat(a[0]), parseFloat(a[1])]); break;
      case 'key': await page.keyboard.press(a[0]); break;
      case 'shot': await page.screenshot({ path: `qa/${a[0]}` }); if (!quiet) console.log('shot', a[0]); break;
      case 'eval': { const r = await page.evaluate(ev.args); console.log('[eval]', JSON.stringify(r)); break; }
      case 'connect': await page.evaluate(() => window.__padConnect()); break;
      default: console.log('unknown cmd', ev.cmd);
    }
  } catch (e) { console.log(`[script error @${ev.t} ${ev.cmd}]`, e.message); }
}
const remaining = wait - (Date.now() - start);
if (remaining > 0) await page.waitForTimeout(remaining);

const rumble = await page.evaluate(() => window.__padState.rumble);
console.log(`[rumble] ${rumble.length} effects`, JSON.stringify(rumble.slice(0, 12)));
console.log(`[errors] ${errors.length}`);
await browser.close();
server.close();
process.exit(errors.length ? 2 : 0);
