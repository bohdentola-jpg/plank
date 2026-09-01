// 3D smoke: boot the menu, walk the world, open the editor, model a voxel thing.
//
// This headless environment's compositor never consumes WebGL frames, which
// poisons everything downstream: a free-running rAF loop balloons memory until
// the cgroup OOM-kills the browser, and once WebGL has started, in-page rAF
// stops firing — so Playwright's rAF-polled machinery (waitForSelector, click
// actionability, fill) strands forever even on a ready DOM. The rules here:
//   1. the moment a session or the editor starts its rAF loop, cancel it and
//      hand-crank time with pump()/pumpEd();
//   2. after WebGL exists, interact only through evaluate (element.click(),
//      synthetic KeyboardEvents/MouseEvents) and node-side evaluate polling;
//   3. pictures come from canvas.toDataURL, never page.screenshot.
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

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// ---- rAF-free interaction helpers (rule 2)
const click = (sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) throw new Error('no element ' + sel);
  el.click();
}, sel);
// even timer-polled waitForFunction can strand in this environment, so poll
// from node with plain evaluates instead
const waitEval = async (fn, arg, t = 8000, what = 'condition') => {
  const t0 = Date.now();
  do {
    if (await page.evaluate(fn, arg)) return;
    await new Promise(r => setTimeout(r, 120));
  } while (Date.now() - t0 < t);
  throw new Error('never came true: ' + what);
};
const exists = (sel, t = 8000) => waitEval(
  (sel) => { const el = document.querySelector(sel); return !!el && el.getClientRects().length > 0; },
  sel, t, sel);
const text = (sel) => page.evaluate((sel) => (document.querySelector(sel) || {}).textContent || '', sel);
const setVal = (sel, val) => page.evaluate(([sel, val]) => {
  const el = document.querySelector(sel);
  el.value = val;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, [sel, val]);
const key = (k, type = 'keydown') => page.evaluate(([k, type]) => {
  window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
}, [k, type]);
const tap = async (k) => { await key(k); await key(k, 'keyup'); };
// the editor listens on window but insists the event started on the canvas
const canvasClick = (x, y) => page.evaluate(([x, y]) => {
  const c = document.querySelector('canvas');
  const opts = { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true };
  c.dispatchEvent(new MouseEvent('mousemove', opts));
  c.dispatchEvent(new MouseEvent('mousedown', opts));
  c.dispatchEvent(new MouseEvent('mouseup', opts));
}, [x, y]);

// ---- loop control (rule 1)
const stopSession = () => page.evaluate(() => {
  const s = window.__game.session;
  s.setPaused(false);
  cancelAnimationFrame(s.raf);
});
const pump = (n) => page.evaluate((n) => {
  const s = window.__game.session;
  for (let i = 0; i < n; i++) { s.simulate(1 / 60); s.render(1 / 60); }
}, n);
// the editor's frame() re-arms rAF every call, so run it once and cut the re-arm
const stopEditor = () => page.evaluate(() => cancelAnimationFrame(window.__game.editor.raf));
const pumpEd = (n) => page.evaluate((n) => {
  const ed = window.__game.editor;
  for (let i = 0; i < n; i++) { ed.frame(); cancelAnimationFrame(ed.raf); }
}, n);

// ---- pictures (rule 3)
const grab = async (name) => {
  try {
    const data = await page.evaluate(() => {
      const g = window.__game || {};
      if (g.session && g.session.view) { g.session.render(1 / 60); return g.session.view.renderer.domElement.toDataURL('image/png'); }
      if (g.editor && g.editor.view) { const ed = g.editor; ed.frame(); cancelAnimationFrame(ed.raf); return ed.view.renderer.domElement.toDataURL('image/png'); }
      return null;
    });
    if (data) await fs.writeFile(path.join(SHOTS, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  } catch (e) { /* the picture is a bonus, not a check */ }
};

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('  ok  ' + name); }
  catch (e) { console.log('FAIL  ' + name + ' — ' + String(e.message).split('\n')[0]); failed = 1; }
  await grab(name);
};

await step('01-menu', async () => {
  await page.goto('http://127.0.0.1:8899/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#btn-join', { state: 'visible', timeout: 8000 });
  if (await page.title() !== 'game') throw new Error('bad title');
});

await step('02-main-world', async () => {
  await page.click('#btn-create');
  await page.waitForSelector('.map-row');
  await page.click('.map-row .menu-mini:nth-of-type(2)'); // play the sample map
  await page.waitForFunction(() => window.__game.session, null, { timeout: 15000 });
  await stopSession();
  await pump(90);
  const st = await page.evaluate(() => {
    const s = window.__game.session;
    return { ents: s.ents.length, y: s.me.y, players: s.players.size, pixel: s.view.pixel };
  });
  if (!st.ents) throw new Error('no entities: ' + JSON.stringify(st));
});

await step('03-walk', async () => {
  const p0 = await page.evaluate(() => ({ x: window.__game.session.me.x, z: window.__game.session.me.z }));
  await key('w'); await pump(70); await key('w', 'keyup');
  const p1 = await page.evaluate(() => ({ x: window.__game.session.me.x, z: window.__game.session.me.z }));
  if (Math.hypot(p1.x - p0.x, p1.z - p0.z) < 2) throw new Error('did not move: ' + JSON.stringify([p0, p1]));
  await key(' '); await pump(8); await key(' ', 'keyup');
  const inAir = await page.evaluate(() => window.__game.session.me.y);
  await pump(40);
  if (inAir < 0.4) throw new Error('jump never left the ground: y=' + inAir);
});

await step('04-chat-bubble', async () => {
  await tap('t');
  await exists('#chatinput');
  await setVal('#chatinput', 'hello from 3d');
  await page.evaluate(() => {
    document.getElementById('chatinput').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  });
  await pump(10);
  const has = await page.evaluate(() => document.querySelectorAll('.bubble').length);
  if (!has) throw new Error('no bubble element');
});

await step('05-pause', async () => {
  await key('Escape');
  await exists('#pause');
});

await step('06-leave-to-menu', async () => {
  await click('#pause-leave');
  await page.waitForTimeout(400);
});

await step('07-editor-world', async () => {
  // leaving a played map drops us back on the map list
  await exists('#btn-maps-new');
  await click('#btn-maps-new');
  await exists('.ed-top');
  await stopEditor();
  await pumpEd(10);
});

await step('08-place-objects', async () => {
  await click('.ed-left .ed-model'); // first model (box)
  for (const [x, y] of [[600, 430], [660, 450], [720, 430]]) {
    await canvasClick(x, y);
    await pumpEd(3);
  }
  const n = await page.evaluate(() => window.__game.editor.map.objects.length);
  if (n < 3) throw new Error('placed ' + n);
});

await step('09-inspector-script', async () => {
  await exists('.ed-right');
  await click('.ed-right .ed-btn.ed-wide');
  await exists('.ed-script');
  await setVal('.ed-script', 'to hop with n\n  repeat with i from 1 to n\n    spawn box at my x, i * 2, my z\n  end\nend\n\nwhen clicked\n  hop with 3\n  say "tower!"\nend');
  await click('.ed-modal-bar .ed-btn:first-child');
  await page.waitForTimeout(300);
  const err = await text('.ed-errors');
  if (!err.includes('looks good')) throw new Error('check said: ' + err);
  await click('.ed-modal-bar .ed-primary');
});

await step('10-modeller', async () => {
  await click('.ed-left .ed-btn.ed-wide'); // make a model
  await waitEval(() => window.__game.editor.mode === 'model', null, 5000, 'modeller mode');
  await pumpEd(10);
  const before = await page.evaluate(() => window.__game.editor.mdl.vox.data.replace(/\./g, '').length);
  // click on the shape to add voxels
  for (const [x, y] of [[640, 360], [660, 350], [620, 370]]) {
    await canvasClick(x, y);
    await pumpEd(3);
  }
  const after = await page.evaluate(() => window.__game.editor.mdl.vox.data.replace(/\./g, '').length);
  if (after <= before) throw new Error('voxel count did not grow: ' + before + ' → ' + after);
});

await step('11-save-model', async () => {
  await setVal('.ed-left input', 'blob');
  await click('.ed-left .ed-btn.ed-primary');
  await waitEval(() => window.__game.editor.mode === 'world', null, 5000, 'world mode');
  const models = await page.evaluate(() => Object.keys(window.__game.editor.map.models));
  if (!models.includes('blob')) throw new Error('models: ' + models.join());
  await pumpEd(5);
});

await step('12-place-custom-model', async () => {
  await canvasClick(560, 460);
  await pumpEd(3);
  const has = await page.evaluate(() => window.__game.editor.map.objects.some(o => o.model === 'blob'));
  if (!has) throw new Error('custom model not placed');
});

await step('13-test-play', async () => {
  await click('.ed-top .ed-primary');
  await waitEval(() => !!window.__game.session, null, 12000, 'test-play session');
  await stopSession();
  await pump(90);
  const st = await page.evaluate(() => {
    const s = window.__game.session;
    return { ents: s.ents.length, errors: s.errors, test: s.testMode };
  });
  if (!st.test) throw new Error('not in test mode');
  if (st.errors.length) throw new Error('script errors: ' + st.errors.join(' | '));
});

await step('14-back-to-editor', async () => {
  await key('Escape');
  await exists('#pause');
  await click('#pause-leave');
  await exists('.ed-top');
  await stopEditor();
  await pumpEd(5);
});

const real = errors.filter(e => !/favicon|peerjs|PeerJS|WebGL|SwiftShader|GroupMarkerNotSet|Automatic fallback/i.test(e));
if (real.length) { console.log('\nJS ERRORS:'); real.forEach(e => console.log('  ' + e)); failed = 1; }
else console.log('\nno js errors');

await browser.close();
server.close();
process.exit(failed);
