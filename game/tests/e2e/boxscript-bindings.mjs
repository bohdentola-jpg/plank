// boxscript end-to-end: a scripted map exercising bindings in the real game.
import { chromium } from 'playwright';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, '..', 'qa', 'shots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    let p = new URL(req.url, 'http://x').pathname;
    if (p === '/') p = '/index.html';
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(await fs.readFile(path.join(ROOT, p)));
  } catch (e) { res.writeHead(404); res.end(); }
});
await fs.mkdir(SHOTS, { recursive: true });
await new Promise(r => server.listen(8899, r));

let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log('  ok  ' + name);
  else { console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); failed = 1; }
};

const MAP = {
  v: 1, name: 'script e2e', bg: '#ffffff', groundY: 0, spawn: { x: 0, y: -20 },
  models: {
    tile: {
      w: 8, h: 8, d: '7'.repeat(64), solid: false, physical: false,
      script: 'when clicked\n  change shared score by 1\n  write "score: " + shared score at 50, 8 size 4 as hud\n  sound pop\n  vanish\nend',
    },
  },
  objects: [
    {
      id: 'ctrl', model: 'block', x: -60, y: -30, solid: false, script: [
        'when start',
        '  hide',
        '  set shared score to 0',
        '  button "deal" at 50, 90',
        'end',
        'when button "deal"',
        '  set col to 0',
        '  repeat 3',
        '    spawn tile at (col * 30) + 40, 30',
        '    change col by 1',
        '  end',
        '  broadcast dealt',
        'end',
        'when message dealt',
        '  write "tiles: " + count of tile at 50, 16 size 3 as tilecount',
        'end',
      ].join('\n'),
    },
    {
      id: 'door', model: 'wall', x: 120, y: -32, script: [
        'when touched',
        '  say "the door dissolves"',
        '  solid off',
        '  color lightgray',
        'end',
      ].join('\n'),
    },
    {
      id: 'pad', model: 'platform', x: -140, y: -5, script: [
        'when touched',
        '  teleport player to 200, 60',
        '  sound boop',
        'end',
      ].join('\n'),
    },
  ],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => { console.log('PAGEERROR:', e.message); failed = 1; });

await page.goto('http://127.0.0.1:8899/', { waitUntil: 'networkidle' });
// inject the map and play it solo
await page.evaluate((map) => {
  localStorage.setItem('game.maps.v1', JSON.stringify({ e2e: map }));
}, MAP);
await page.reload({ waitUntil: 'networkidle' });
await page.click('#btn-create');
await page.waitForSelector('.map-row');
await page.click('.map-row .menu-mini:nth-child(3)'); // play
await page.waitForTimeout(1000);

// hidden controller: block should be invisible
const hidden = await page.evaluate(() => {
  const s = window.__game.session;
  return s.ents.find(e => e.id === 'ctrl').visible === false;
});
check('when start: hide works', hidden);

// button exists in the DOM
const btn = await page.$('.bs-btn');
check('boxscript button rendered', !!btn);

// click "deal" → 3 tiles spawn, write appears
await page.click('.bs-btn');
await page.waitForTimeout(500);
let tiles = await page.evaluate(() => window.__game.session.ents.filter(e => e.model === 'tile').length);
check('button click spawned 3 tiles', tiles === 3, 'tiles=' + tiles);
const writes = await page.evaluate(() => [...window.__game.session.writes.entries()].map(([k, v]) => k + '=' + v.text));
check('broadcast + count wrote tile count', writes.some(w => w.includes('tilecount=tiles: 3')), JSON.stringify(writes));

// click a tile → vanish + shared score + hud update
const tileScreen = await page.evaluate(() => {
  const s = window.__game.session;
  const t = s.ents.find(e => e.model === 'tile');
  return s.renderer.worldToScreen(t.x, t.y);
});
await page.mouse.click(tileScreen.x, tileScreen.y);
await page.waitForTimeout(400);
tiles = await page.evaluate(() => window.__game.session.ents.filter(e => e.model === 'tile').length);
const score = await page.evaluate(() => window.__game.session.shared.get('score'));
check('clicked tile vanished', tiles === 2, 'tiles=' + tiles);
check('shared score = 1', score === 1, 'score=' + score);
const hud = await page.evaluate(() => window.__game.session.writes.get('hud'));
check('hud write updated', hud && hud.text === 'score: 1', JSON.stringify(hud));

// walk into the door → solid off + say bubble
await page.evaluate(() => { const s = window.__game.session; s.me.x = 106; s.me.y = -12; });
await page.keyboard.down('d');
await page.waitForTimeout(500);
await page.keyboard.up('d');
const door = await page.evaluate(() => {
  const s = window.__game.session;
  const d = s.ents.find(e => e.id === 'door');
  return { solid: d.solid, color: d.color, said: d.bubbles && d.bubbles.length > 0 };
});
check('touched: door unsolid + tinted + says', door.solid === false && door.color === 'lightgray' && door.said, JSON.stringify(door));

// teleport pad
await page.evaluate(() => { const s = window.__game.session; s.me.x = -160; s.me.y = -12; s.me.vx = 0; });
await page.keyboard.down('d');
await page.waitForTimeout(400);
await page.keyboard.up('d');
await page.waitForTimeout(300);
// the player teleports to (200, 60), then gravity brings them back to the
// ground — assert they crossed the map (x ≈ 200+drift) and landed standing
const pos = await page.evaluate(() => ({ x: window.__game.session.me.x, y: window.__game.session.me.y, g: window.__game.session.me.onGround }));
check('teleport player carried across the map', pos.x > 180 && pos.x < 300 && pos.g, JSON.stringify(pos));

await page.screenshot({ path: path.join(SHOTS, 'script-e2e.png') });
await browser.close();
server.close();
process.exit(failed);
