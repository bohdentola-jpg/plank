// Auto-player: loads the game and keeps clicking through dialogue, choices and
// cards so whole story beats can be tested headlessly. Usage:
//   node tools/play.mjs "?scene=home&reset" intro --steps 80 --shot-every 8
//   node tools/play.mjs "?scene=home" x --choice 1 --eval "__game.state.flags"
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
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
const [query = '', name = 'play', ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
const steps = +opt('steps', 60);
const every = +opt('shot-every', 0);
const choice = +opt('choice', 0);
const evalJs = opt('eval', null);
const idleStop = +opt('idle', 6);
const actions = (opt('actions', '') || '').split(';;').map((x) => x.trim()).filter(Boolean);
const w = +opt('w', 1366), h = +opt('h', 768);
await mkdir(join(root, 'qa'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|GL Driver/.test(m.text())) { errors.push(m.text()); console.log('[console.error]', m.text()); } });
page.on('dialog', (d) => d.accept());
await page.goto(`http://127.0.0.1:${server.address().port}/index.html${query}`);
await page.waitForTimeout(+opt('wait', 4000));
let idle = 0, shot = 0;
for (let i = 0; i < steps; i++) {
  const st = await page.evaluate(() => {
    // also wait while the engine is busy with a scene interaction (not idle)
    const vis = (s) => { const e = document.querySelector(s); return e && !e.classList.contains('hidden') && e.offsetParent !== null; };
    return {
      card: vis('#card'), dialog: vis('#dialog'), modal: vis('#modal'),
      choices: document.querySelectorAll('#dialog .choices .choice').length,
      text: document.querySelector('#dialog .text')?.textContent?.slice(0, 90),
      who: document.querySelector('#dialog .who')?.textContent,
      busy: !!window.__game?.engine?.stage?.busy || !!window.__game?.busy,
    };
  });
  if (st.card) {
    await page.click('#card .ok').catch(() => {});
    idle = 0;
  } else if (st.dialog && st.choices) {
    console.log(`  [${st.who}] ${st.text}  → choice ${Math.min(choice, st.choices - 1)}`);
    await page.click(`#dialog .choices .choice:nth-child(${Math.min(choice, st.choices - 1) + 1})`).catch(() => {});
    idle = 0;
  } else if (st.dialog) {
    console.log(`  [${st.who}] ${st.text}`);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    idle = 0;
  } else if (st.modal) {
    // close panels (end cards etc.) unless an action expects them
    await page.click('#modal .phead .x').catch(() => {});
  } else if (st.busy) {
    idle = 0; // a handler is still running (camera moves, animations)
  } else if (actions.length) {
    const a = actions.shift();
    console.log(`>> ${a}`);
    // fire and forget: handlers wait for dialogue clicks that this loop provides
    await page.evaluate((code) => { setTimeout(() => { try { (0, eval)(code); } catch (e) { console.error('action failed: ' + e.message); } }, 0); }, a)
      .catch((e) => console.log('[action error]', e.message));
    idle = 0;
    await page.waitForTimeout(1200);
  } else {
    idle++;
    if (idle >= idleStop) break;
  }
  if (every && i % every === 0) await page.screenshot({ path: join(root, 'qa', `${name}_${shot++}.png`) });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: join(root, 'qa', `${name}_end.png`) });
if (evalJs) console.log('[eval]', JSON.stringify(await page.evaluate(evalJs)));
console.log(errors.length ? `${errors.length} error(s)` : 'no errors');
await browser.close();
server.close();
process.exit(0);
