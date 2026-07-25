// Plays NOCLIP in headless Chromium and checks the loop actually works: walk,
// hide, get caught, reach the lift, buy something in the stall, ride it down.
// This is the test that would otherwise need a human with a keyboard.
//
//   node tools/play-backrooms.mjs [levelId ...]      one floor, or several
//   node tools/play-backrooms.mjs --all                 every floor in the library
import { createServer } from 'node:http';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/backrooms/index.html';
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(await readFile(join(root, p)));
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
await mkdir(join(root, 'qa'), { recursive: true });

const argv = process.argv.slice(2);
const levels = argv.includes('--all')
  ? (await readdir(join(root, 'backrooms/src/levels')))
      .filter((f) => f.endsWith('.js') && f !== 'index.js').map((f) => f.replace(/\.js$/, '')).sort()
  : (argv.filter((a) => !a.startsWith('--')).length ? argv.filter((a) => !a.startsWith('--')) : ['level0']);
const shots = !argv.includes('--noshots');
let failures = 0;
let level = levels[0];
const ok = (m) => console.log(`ok   ${m}`);
const fail = (m) => { failures++; console.error(`FAIL ${m}`); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 660 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function playFloor() {
  await page.goto(`http://127.0.0.1:${port}/backrooms/index.html?quick&level=${level}`);
  await page.mouse.click(550, 330);
  await page.waitForFunction(() => window.NOCLIP?.state === 'play', { timeout: 60000 })
    .catch(() => fail('never reached play'));
  await page.waitForTimeout(900);

  // ---------------------------------------------------------------- the floor
  const floor = await page.evaluate(() => {
    const g = window.NOCLIP;
    return {
      monster: g.entities.monster?.rec.type,
      monsterState: g.entities.monster?.state,
      hides: g.world.hides.length,
      arrows: g.world.arrows.length,
      gimmick: g.gimmick,
      lift: !!g.exitObjs.length,
      torch: g.lampOn,
      bearing: !!g.world.liftBearing(g.player.pos.x, g.player.pos.z),
    };
  });
  if (!floor.monster) fail('no monster on the floor'); else ok(`monster: ${floor.monster} (${floor.monsterState})`);
  if (floor.hides < 5) fail(`only ${floor.hides} hiding places`); else ok(`${floor.hides} hiding places`);
  if (!floor.arrows) fail('no chalk arrows'); else ok(`${floor.arrows} chalk marks to the lift`);
  if (!floor.lift) fail('no lift in the level'); else ok(`lift present · gimmick ${floor.gimmick}`);
  if (!floor.torch) fail('torch should start on'); else ok('torch on at spawn');
  if (!floor.bearing) fail('lift is not reachable from the spawn'); else ok('lift reachable from the spawn');

  // ---------------------------------------------------------------- hiding
  const hid = await page.evaluate(async () => {
    const g = window.NOCLIP;
    const h = g.world.hides[0];
    g.player.spawn(h.wx, h.wz, 0);
    await new Promise((r) => requestAnimationFrame(r));
    g.interact();
    const inCover = g.player.hidden;
    await new Promise((r) => setTimeout(r, 300));
    g.interact();
    return { inCover, outAgain: !g.player.hidden, kind: h.kind };
  });
  if (!hid.inCover) fail('could not get into cover'); else ok(`hid in the ${hid.kind}, and got out again (${hid.outAgain})`);

  // ------------------------------------------------------- the chase, then contact
  // The chase banner and its sting are a code path of their own, and one that only
  // fires when the thing notices you — so ring it deliberately on every floor.
  const chase = await page.evaluate(async () => {
    const g = window.NOCLIP;
    g.onChaseStart(g.entities.monster);
    const banner = !document.querySelector('.hud-chase')?.hidden;
    await new Promise((r) => requestAnimationFrame(r));
    g.onChaseEnd();
    return { banner, gone: !!document.querySelector('.hud-chase')?.hidden };
  });
  if (!chase.banner) fail('a chase starting put no banner on screen');
  else ok(`chase banner up and down (${chase.gone})`);

  const caught = await page.evaluate(async () => {
    const g = window.NOCLIP;
    const m = g.entities.monster;
    m.spawnGrace = 0;
    m.frozen = false;
    m.pos.x = g.player.pos.x + 1.2;
    m.pos.z = g.player.pos.z;
    m.pos.y = g.player.pos.y;
    m.state = 'hunt';
    m.alert = 1;
    for (let i = 0; i < 90 && !g.dead; i++) await new Promise((r) => requestAnimationFrame(r));
    return { dead: g.dead, deathVisible: !document.querySelector('.death').hidden };
  });
  if (!caught.dead) fail('the monster reached the player and nothing happened');
  else ok(`contact is lethal, death card shown (${caught.deathVisible})`);
  if (shots) await page.screenshot({ path: join(root, `qa/play-${level}-death.png`) });

  // ---------------------------------------------------------------- the lift
  const lift = await page.evaluate(async () => {
    const g = window.NOCLIP;
    // reset out of the death state and put the player on the lift
    g.dead = false;
    g.hud.hideDeath();
    g.filmSeconds = 12;                       // pretend we filmed it for a bit
    const e = g.exitObjs[0];
    g.player.spawn(e.mesh.position.x, e.mesh.position.z, 0);
    await new Promise((r) => requestAnimationFrame(r));
    g.interact();
    const items = [...document.querySelectorAll('.stall-item')];
    const before = g.footage;
    const modsBefore = JSON.stringify(g.mods);
    const affordable = items.find((b) => !b.classList.contains('broke'));
    const bought = affordable?.querySelector('.si-name')?.textContent || affordable?.textContent?.slice(0, 24);
    affordable?.click();
    const changed = Object.keys(g.mods).filter((k) => JSON.parse(modsBefore)[k] !== g.mods[k]);
    return {
      state: g.state,
      footage: before,
      spent: before - g.footage,
      offers: items.length,
      owned: Object.keys(g.owned).length,
      bought, changed,
    };
  });
  if (lift.state !== 'lift') fail(`interacting with the lift left the game in "${lift.state}"`);
  else ok(`lift screen · ${lift.footage} footage earned · ${lift.offers} offers on the stall`);
  if (lift.offers !== 3) fail(`the stall showed ${lift.offers} offers, expected 3`);
  if (!lift.owned) fail('buying from the stall did nothing');
  else if (!lift.changed.length) fail(`bought "${lift.bought}" and no run modifier moved`);
  else ok(`bought ${lift.bought} for ${lift.spent} ft — changed ${lift.changed.join(', ')}`);
  if (shots) await page.screenshot({ path: join(root, `qa/play-${level}-lift.png`) });

  // ---------------------------------------------------------------- descend
  const next = await page.evaluate(async () => {
    const g = window.NOCLIP;
    await g.descend();
    return { state: g.state, floorIndex: g.floorIndex, level: g.levelId, mods: g.player.mods?.speed };
  });
  if (next.state !== 'play' && next.state !== 'end') fail(`descending left the game in "${next.state}"`);
  else ok(`descended to floor ${next.floorIndex + 1} (${next.level || 'the end'}) with upgrades applied`);
  if (shots) await page.screenshot({ path: join(root, `qa/play-${level}-next.png`) });
}

for (const id of levels) {
  level = id;
  console.log(`\n=== ${id} ===`);
  const before = failures;
  errors.length = 0;
  try { await playFloor(); } catch (e) { fail(`${id}: ${e.message.split('\n')[0]}`); }
  for (const e of [...new Set(errors)].slice(0, 6)) fail(`${id} threw: ${e.split('\n')[0]}`);
  if (failures === before) ok(`${id}: the loop works end to end`);
}
await browser.close();
server.close();
console.log(failures ? `\n${failures} failure(s) across ${levels.length} floor(s)`
  : `\nall ${levels.length} floor(s) play end to end`);
process.exit(failures ? 1 : 0);
