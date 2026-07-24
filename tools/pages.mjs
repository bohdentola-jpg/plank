// Browser smoke test for the whole library: loads every page in headless
// Chromium, fails on any console error or uncaught exception, checks that each
// page actually came up (a canvas, a menu, a running match), and drops
// screenshots in qa/ so the visuals can be eyeballed.
//
// Usage: node tools/pages.mjs [--shots]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = process.argv.includes('--shots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('nope');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
await mkdir(join(root, 'qa'), { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--mute-audio'] });
let failures = 0;

/**
 * page      path + query to load
 * check     runs in the browser, returns a string on failure
 * keys      ["KeyJ@1200", ...] presses at the given ms
 */
async function visit(name, path, { wait = 2200, check = null, keys = [], shot = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/${path}`);
  for (const spec of keys) {
    const [key, at] = spec.split('@');
    setTimeout(() => page.keyboard.press(key.trim()).catch(() => {}), parseInt(at || '0', 10));
  }
  await page.waitForTimeout(wait);
  let verdict = null;
  if (check) {
    try { verdict = await page.evaluate(check); } catch (e) { verdict = `evaluate threw: ${e.message}`; }
  }
  if (SHOTS && shot) await page.screenshot({ path: join(root, 'qa', shot) });
  const bad = errors.length || verdict;
  if (bad) {
    failures++;
    console.error(`FAIL ${name}`);
    for (const e of errors.slice(0, 6)) console.error(`     ${e}`);
    if (verdict) console.error(`     check: ${verdict}`);
  } else {
    console.log(`ok   ${name}`);
  }
  await ctx.close();
}

// ---- the launcher
await visit('kiosk (index.html)', 'index.html', {
  wait: 1400,
  shot: 'kiosk.png',
  check: () => {
    const cards = document.querySelectorAll('.rack-card');
    if (cards.length !== 2) return `expected 2 games on the shelf, found ${cards.length}`;
    if (!document.querySelector('.detail-box')) return 'no box art rendered in the detail pane';
    if (!document.querySelector('.d-play')) return 'no PLAY button';
    if (document.documentElement.scrollWidth > window.innerWidth + 2) return 'page scrolls sideways';
    return null;
  },
});

// ---- launcher keyboard navigation actually selects the other game
await visit('kiosk selects melee', 'index.html', {
  wait: 1200,
  keys: ['ArrowDown@500'],
  check: () => {
    const sel = document.querySelector('.rack-card.sel .rack-meta b');
    return sel && sel.textContent.includes('MELEE') ? null : `selection did not move (${sel?.textContent})`;
  },
});

// ---- the fighter: boot screen
await visit('melee boot', 'melee.html', {
  wait: 1800,
  shot: 'melee-boot.png',
  check: () => {
    if (!document.querySelector('.mboot')) return 'boot screen never rendered';
    if (!document.querySelector('.boot-logo')?.src?.startsWith('data:image')) return 'no generated logo';
    return null;
  },
});

// ---- the fighter: a live match through ?quick
await visit('melee match (?quick)', 'melee.html?quick&p1=blitz&p2=tusk', {
  wait: 6500,
  shot: 'melee-fight.png',
  check: () => {
    const app = window.melee;
    if (!app) return 'app never booted';
    const m = app.match;
    if (!m) return 'no match running';
    if (m.frame < 120) return `sim only advanced ${m.frame} frames`;
    if (!app.view) return 'no view built';
    const canvas = document.querySelector('#melee-game canvas');
    if (!canvas || canvas.width < 100) return 'render canvas missing or tiny';
    if (canvas.width > window.innerWidth) return `canvas is ${canvas.width}px — the low-res pass is not happening`;
    if (!document.querySelectorAll('.hud-panel').length) return 'no HUD panels';
    for (const f of m.fighters) {
      if (![f.x, f.y, f.percent].every(Number.isFinite)) return `${f.def.name} went non-finite`;
    }
    return null;
  },
});

// ---- the fighter on a hazard stage, with items on, four fighters
await visit('melee 4-way on magma', 'melee.html?quick&stage=magma&p1=crunch&p2=volt&p3=spirit', {
  wait: 7000,
  shot: 'melee-magma.png',
  check: () => {
    const m = window.melee?.match;
    if (!m) return 'no match';
    if (m.fighters.length < 3) return `only ${m.fighters.length} fighters`;
    if (m.frame < 120) return 'sim stalled';
    return null;
  },
});

// ---- a human on the keyboard: every core action must actually do something.
// The CPU's brain is switched off first so nothing interrupts the script.
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/melee.html?quick&p1=blitz&p2=tusk`);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const m = window.melee.match;
    m.fighters[1].brain = null;              // the dummy stands still
    m.fighters[1].x = 6;
  });

  const problems = [];
  const state = () => page.evaluate(() => {
    const f = window.melee?.match?.fighters?.[0];
    return f ? { x: f.x, y: f.y, state: f.state, moveId: f.moveId, grounded: f.grounded } : null;
  });
  /** Hold keys for `ms`, sampling state the whole time. Returns what was seen. */
  const act = async (codes, ms) => {
    const seen = new Set();
    const moves = new Set();
    for (const c of codes) await page.keyboard.down(c);
    const steps = Math.max(3, Math.round(ms / 35));
    for (let i = 0; i < steps; i++) {
      const s = await state();
      if (s) { seen.add(s.state); if (s.moveId) moves.add(s.moveId); }
      await page.waitForTimeout(35);
    }
    for (const c of codes) await page.keyboard.up(c);
    // let the move play out and sample the tail
    for (let i = 0; i < 8; i++) {
      const s = await state();
      if (s) { seen.add(s.state); if (s.moveId) moves.add(s.moveId); }
      await page.waitForTimeout(35);
    }
    return { seen, moves };
  };
  /** Wait until P1 is grounded and free to act, so inputs aren't eaten by lag. */
  const settle = async (ms = 2000) => {
    for (let i = 0; i < ms / 50; i++) {
      const s = await state();
      if (s && s.grounded && ['idle', 'walk', 'run', 'dash', 'crouch'].includes(s.state)) return true;
      await page.waitForTimeout(50);
    }
    return false;
  };
  const expect = (label, got, wanted) => {
    const hit = wanted.some((w) => got.has(w));
    if (!hit) problems.push(`${label}: saw {${[...got].join(',')}}, wanted one of {${wanted.join(',')}}`);
  };

  const before = await state();
  const walk = await act(['KeyD'], 500);
  const after = await state();
  if (!before || !after) problems.push('no fighter to drive');
  else if (after.x <= before.x + 0.4) problems.push(`holding D moved P1 ${(after.x - before.x).toFixed(2)} units`);
  expect('walk then run', walk.seen, ['walk']);
  expect('run', walk.seen, ['run', 'dash']);

  const jump = await act(['Space'], 90);
  expect('jump', jump.seen, ['jumpsquat', 'air']);

  await settle();
  const jab = await act(['KeyJ'], 70);
  expect('attack', jab.seen, ['attack']);
  expect('jab', jab.moves, ['jab1', 'jab2', 'ftilt']);

  await settle();
  const shield = await act(['KeyL'], 340);
  expect('shield', shield.seen, ['shield']);

  await settle();
  const roll = await act(['KeyL', 'KeyA'], 260);
  expect('roll out of shield', roll.seen, ['roll', 'shield']);

  await settle();
  const dtilt = await act(['KeyS', 'KeyJ'], 70);
  expect('down tilt', dtilt.moves, ['dtilt']);

  await settle();
  const special = await act(['KeyK'], 70);
  expect('neutral special', special.moves, ['nspecial']);

  await settle();
  const upB = await act(['KeyW', 'KeyK'], 90);
  expect('up special', upB.moves, ['uspecial']);

  await settle();
  const grab = await act(['KeyH'], 70);
  expect('grab', grab.moves, ['grab']);

  await settle();
  const smash = await act(['ShiftLeft', 'KeyD', 'KeyJ'], 300);
  expect('charged smash', smash.seen, ['charge', 'attack']);
  expect('fsmash', smash.moves, ['fsmash']);

  if (errors.length) problems.push(`page errors: ${errors[0]}`);
  if (problems.length) {
    failures++;
    console.error('FAIL melee keyboard controls');
    for (const p of problems) console.error(`     ${p}`);
  } else {
    console.log('ok   melee keyboard controls (walk, run, jump, jab, shield, roll, dtilt, specials, grab, smash)');
  }
  if (SHOTS) await page.screenshot({ path: join(root, 'qa', 'melee-input.png') });
  await ctx.close();
}

// ---- the whole front end, driven like a player: boot → SMASH → setup →
// character select → stage select → a live match → pause → resume
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/melee.html`);
  const screen = () => page.evaluate(() => document.querySelector('.mscreen')?.className.replace('mscreen ', '') || (window.melee?.match ? 'MATCH' : 'none'));
  const tap = async (code = 'KeyJ') => {
    await page.keyboard.down(code);
    await page.waitForTimeout(90);
    await page.keyboard.up(code);
    await page.waitForTimeout(260);
  };
  /** Press confirm until the screen changes (or give up). */
  const advance = async (from, tries = 6) => {
    for (let i = 0; i < tries; i++) {
      if ((await screen()) !== from) return true;
      await tap();
    }
    return (await screen()) !== from;
  };
  const problems = [];
  await page.waitForTimeout(1200);
  if ((await screen()) !== 'mboot') problems.push(`expected boot, got ${await screen()}`);
  await advance('mboot');
  if ((await screen()) !== 'mtitle') problems.push(`expected title, got ${await screen()}`);
  await advance('mtitle');                       // SMASH
  if ((await screen()) !== 'msetup') problems.push(`expected setup, got ${await screen()}`);
  await advance('msetup');                       // CHOOSE FIGHTERS
  if ((await screen()) !== 'mchars') problems.push(`expected character select, got ${await screen()}`);
  await tap();                                   // lock P1
  await tap();                                   // lock the CPU's fighter
  if ((await screen()) !== 'mstages') problems.push(`expected stage select, got ${await screen()}`);
  await advance('mstages');                      // fight on the highlighted stage
  await page.waitForTimeout(2500);
  const live = await page.evaluate(() => {
    const m = window.melee?.match;
    if (!m) return null;
    return { frame: m.frame, names: m.fighters.map((f) => f.def.name), stage: m.stage.id, stocks: m.rules.stocks };
  });
  if (!live) problems.push('no match after stage select');
  else if (live.frame < 60) problems.push(`match only ran ${live.frame} frames`);
  // pause and come back
  if (live) {
    await page.keyboard.down('Escape');
    await page.waitForTimeout(90);
    await page.keyboard.up('Escape');
    await page.waitForTimeout(500);
    const paused = await page.evaluate(() => ({ paused: window.melee.paused, screen: document.querySelector('.mscreen')?.className || '' }));
    if (!paused.paused || !paused.screen.includes('mpause')) problems.push(`pause did not open (${JSON.stringify(paused)})`);
    if (SHOTS) await page.screenshot({ path: join(root, 'qa', 'melee-pause.png') });
    await tap();                                 // BACK TO THE FIGHT
    await page.waitForTimeout(600);
    const resumed = await page.evaluate(() => ({ paused: window.melee.paused, frame: window.melee.match?.frame }));
    if (resumed.paused) problems.push('pause never released');
    if (!(resumed.frame > 0)) problems.push('match did not resume');
  }
  if (errors.length) problems.push(`page errors: ${errors[0]}`);
  if (problems.length) {
    failures++;
    console.error('FAIL melee menu flow');
    for (const p of problems) console.error(`     ${p}`);
  } else {
    console.log(`ok   melee menu flow (${live.names.join(' vs ')} on ${live.stage}, pause + resume)`);
  }
  await ctx.close();
}

// ---- two humans on one keyboard, moving independently
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/melee.html?quick&humans=2&p1=blitz&p2=spirit`);
  await page.waitForTimeout(4000);
  const read = () => page.evaluate(() => {
    const m = window.melee?.match;
    if (!m) return null;
    return {
      n: m.fighters.length,
      devices: m.fighters.map((f) => f.input?.device || 'none'),
      x: m.fighters.map((f) => f.x),
      cpu: m.fighters.map((f) => f.isCpu),
    };
  });
  const before = await read();
  // P1 goes right on WASD, P2 goes left on the arrows — at the same time
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(200);
  const after = await read();
  const problems = [];
  if (!before || !after) problems.push('no match');
  else {
    if (before.cpu.some(Boolean)) problems.push(`a slot is still CPU: ${JSON.stringify(before.cpu)}`);
    if (before.devices[0] !== 'kb1' || before.devices[1] !== 'kb2') problems.push(`devices are ${before.devices.join(',')}`);
    if (after.x[0] - before.x[0] < 0.5) problems.push(`P1 moved ${(after.x[0] - before.x[0]).toFixed(2)}`);
    if (before.x[1] - after.x[1] < 0.5) problems.push(`P2 moved ${(after.x[1] - before.x[1]).toFixed(2)}`);
  }
  if (errors.length) problems.push(`page errors: ${errors[0]}`);
  if (problems.length) {
    failures++;
    console.error('FAIL melee two players');
    for (const p of problems) console.error(`     ${p}`);
  } else {
    console.log('ok   melee two players (WASD and arrows drive different fighters)');
  }
  await ctx.close();
}

// ---- a controller: the Gamepad API is faked so the pad mapping is really exercised
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 700 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // a standard-mapping pad whose state the test can poke through window.__pad
  await page.addInitScript(() => {
    window.__pad = { axes: [0, 0, 0, 0], buttons: new Array(17).fill(0) };
    const snapshot = () => ({
      id: 'Fake Standard Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard',
      timestamp: performance.now(),
      axes: window.__pad.axes.slice(),
      buttons: window.__pad.buttons.map((v) => ({ pressed: v > 0.4, touched: v > 0.1, value: v })),
    });
    navigator.getGamepads = () => [snapshot()];
    window.__press = (i, v = 1) => { window.__pad.buttons[i] = v; };
    window.__release = (i) => { window.__pad.buttons[i] = 0; };
    window.__stick = (x, y) => { window.__pad.axes[0] = x; window.__pad.axes[1] = y; };
  });
  const tapPad = async (i, ms = 120) => {
    await page.evaluate((b) => window.__press(b), i);
    await page.waitForTimeout(ms);
    await page.evaluate((b) => window.__release(b), i);
    await page.waitForTimeout(240);
  };
  const problems = [];

  // 1. the launcher should notice the pad and switch its hint row
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForTimeout(600);
  // a short nudge: the rack only holds two games, so a long hold would repeat
  // and wrap straight back to the first one
  await page.evaluate(() => window.__stick(0, 1));        // stick down = next game
  await page.waitForTimeout(160);
  await page.evaluate(() => window.__stick(0, 0));
  await page.waitForTimeout(300);
  const kiosk = await page.evaluate(() => ({
    hint: document.getElementById('hint').textContent,
    sel: document.querySelector('.rack-card.sel .rack-meta b')?.textContent,
  }));
  if (!kiosk.hint.includes('✕')) problems.push(`kiosk hint did not switch to pad glyphs (${kiosk.hint})`);
  if (!kiosk.sel?.includes('MELEE')) problems.push(`pad stick did not move the kiosk selection (${kiosk.sel})`);

  // 2. the fighter: boot and menus on the pad alone
  await page.goto(`http://127.0.0.1:${port}/melee.html`);
  await page.waitForTimeout(1200);
  await tapPad(0);                                        // ✕ past the boot screen
  const atTitle = await page.evaluate(() => document.querySelector('.mscreen')?.className || '');
  if (!atTitle.includes('mtitle')) problems.push(`pad could not leave the boot screen (${atTitle})`);
  await page.evaluate(() => window.__stick(0, 1));        // down twice on the stick
  await page.waitForTimeout(360);
  await page.evaluate(() => window.__stick(0, 0));
  await page.waitForTimeout(200);
  const moved = await page.evaluate(() => document.querySelector('.mscreen .mbtn.sel .mbtn-label')?.textContent);
  if (moved === 'SMASH') problems.push('pad stick did not move the title selection');

  // 3. gameplay: stick and buttons drive a fighter
  await page.goto(`http://127.0.0.1:${port}/melee.html?quick&p1=blitz&p2=tusk`);
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window.melee.match.fighters[1].brain = null; window.melee.match.fighters[1].x = 7; });
  const state = () => page.evaluate(() => {
    const f = window.melee?.match?.fighters?.[0];
    return f ? { x: f.x, y: f.y, state: f.state, moveId: f.moveId, device: f.input.device } : null;
  });
  const s0 = await state();
  if (s0 && !String(s0.device).startsWith('pad')) problems.push(`P1 is on ${s0.device}, not a pad`);
  await page.evaluate(() => window.__stick(1, 0));        // hold right
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__stick(0, 0));
  const s1 = await state();
  if (s0 && s1 && s1.x - s0.x < 0.5) problems.push(`pad stick moved P1 ${(s1.x - s0.x).toFixed(2)} units`);
  const seen = new Set();
  const sample = async (ms) => {
    for (let i = 0; i < ms / 40; i++) {
      const s = await state();
      if (s) { seen.add(s.state); if (s.moveId) seen.add(`move:${s.moveId}`); }
      await page.waitForTimeout(40);
    }
  };
  await tapPad(0, 80); await sample(300);                 // ✕ attack
  await tapPad(2, 80); await sample(400);                 // □ jump
  await tapPad(1, 80); await sample(500);                 // ◯ special
  await page.evaluate(() => window.__press(7, 1));        // R2 shield
  await sample(320);
  await page.evaluate(() => window.__release(7));
  await tapPad(5, 80); await sample(300);                 // R1 grab
  for (const want of [['attack', 'attack'], ['jump', 'air'], ['shield', 'shield']]) {
    if (!seen.has(want[1])) problems.push(`pad ${want[0]} never produced ${want[1]} (saw ${[...seen].join(',')})`);
  }
  if (![...seen].some((s) => s.startsWith('move:'))) problems.push('no move ever started from the pad');
  // 4. OPTIONS pauses
  await tapPad(9, 120);
  await page.waitForTimeout(400);
  const paused = await page.evaluate(() => window.melee.paused);
  if (!paused) problems.push('OPTIONS did not pause the match');

  if (errors.length) problems.push(`page errors: ${errors[0]}`);
  if (problems.length) {
    failures++;
    console.error('FAIL melee controller');
    for (const p of problems) console.error(`     ${p}`);
  } else {
    console.log('ok   melee controller (kiosk nav, menus, stick, ✕ ◯ □ R1 R2, OPTIONS pause)');
  }
  await ctx.close();
}

// ---- the football game still works after moving to varsity.html
await visit('varsity title', 'varsity.html', {
  wait: 3000,
  shot: 'varsity.png',
  check: () => {
    if (!document.getElementById('lib-back')) return 'no way back to the library';
    if (!document.querySelector('#scr-title')) return 'title screen missing';
    return null;
  },
});

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILURES` : '\nall pages ok');
process.exit(failures ? 1 : 0);
