// The boot import survives a dropped file: abort one module request on the first
// page load and check the game reloads itself and starts.
//   python3 serve.py 8765 --no-browser &   node coldboot/tools/serve_retry_check.mjs 8765
import { chromium } from 'playwright';
const port = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
let dropped = 0, loads = 0;
await page.route('**/coldboot/src/world/smoke.js', (route) => { if (dropped++ === 0) route.abort('connectionreset'); else route.continue(); });
page.on('load', () => loads++);
await page.goto(`http://127.0.0.1:${port}/coldboot/index.html`);
await page.waitForTimeout(15000);
const shown = await page.evaluate(() => [...document.querySelectorAll('pre')].map((p) => p.textContent).join(' | '));
const screen = await page.evaluate(() => window.__game?.screen?.name || null);
console.log(JSON.stringify({ dropped, loads, screen, errorBox: shown || null }));
await browser.close();
