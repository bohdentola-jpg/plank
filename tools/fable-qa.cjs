#!/usr/bin/env node
// Headless QA driver for Fourth & Fable.
//   node tools/fable-qa.cjs --q "gallery=team" --steps 30 --shot team.png
//   node tools/fable-qa.cjs --script tools/fable-scenarios/some-scenario.cjs
// The game is loaded with ?test, which hands frame stepping to this harness
// (window.__fable.step) so runs are deterministic and fast even on software GL.
// Screenshots land in qa/ (git-ignored).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const flag = (name) => args.includes(`--${name}`);

async function main() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(root, p), (err, data) => {
      if (err) { res.writeHead(404); res.end('nope'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const width = parseInt(opt('w', '1280'), 10), height = parseInt(opt('h', '720'), 10);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || (t === 'warning' && !/GPU stall|GL Driver|swiftshader|WebGL/i.test(m.text()))) { const s = `[${t}] ${m.text().slice(0, 400)}`; errors.push(s); if (!flag('quiet')) console.log(s); }
    else if (t === 'log' && flag('logs')) console.log('[log]', m.text().slice(0, 400));
  });
  page.on('pageerror', (e) => { errors.push(`[pageerror] ${e.message}`); console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });

  const qaDir = path.join(root, 'qa');
  fs.mkdirSync(qaDir, { recursive: true });

  const h = {
    page, errors, root, qaDir,
    async open(query = '') {
      const q = query ? `&${query.replace(/^[?&]/, '')}` : '';
      await page.goto(`http://127.0.0.1:${port}/fable/index.html?test${q}`);
      await page.waitForFunction(() => window.__fable && window.__fable.G && window.__fable.G.top(), null, { timeout: 60000 });
    },
    step: (n = 1, dt = 1 / 60) => page.evaluate(([nn, d]) => window.__fable.step(nn, d), [n, dt]),
    ev: (fn, arg) => page.evaluate(fn, arg),
    async shot(name) {
      await page.evaluate(() => window.__fable.render());
      const file = path.join(qaDir, name.endsWith('.png') ? name : `${name}.png`);
      await page.screenshot({ path: file });
      console.log('shot', path.relative(root, file));
      return file;
    },
    press: (a) => page.evaluate((x) => window.__fable.press(x), a),
    sleep: (ms) => page.waitForTimeout(ms),
  };

  let code = 0;
  try {
    const script = opt('script', null);
    if (script) {
      const fn = require(path.resolve(script));
      await fn(h, args);
    } else {
      await h.open(opt('q', ''));
      await h.step(parseInt(opt('steps', '10'), 10));
      const evalJs = opt('eval', null);
      if (evalJs) console.log('[eval]', JSON.stringify(await page.evaluate(evalJs)));
      await h.shot(opt('shot', 'shot.png'));
    }
    const pageErrors = await page.evaluate(() => (window.__fable ? window.__fable.errors() : []));
    if (pageErrors.length) { console.log('[game errors]', pageErrors.slice(0, 6).join('\n')); code = 1; }
    if (errors.some((e) => e.startsWith('[pageerror]'))) code = 1;
  } catch (e) {
    console.error('QA FAILED:', e.message);
    code = 1;
  }
  await browser.close();
  server.close();
  process.exit(code);
}
main();
