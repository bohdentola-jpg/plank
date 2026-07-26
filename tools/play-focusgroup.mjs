// Plays FOCUS GROUP from Tuesday to the last frame without a human, by walking
// to each checklist item and pressing E. Proves the week is completable, the
// beats fire, the sets swap, and both main endings are reachable.
//   node tools/play-focusgroup.mjs            # say the line
//   node tools/play-focusgroup.mjs --decline  # do not
//   node tools/play-focusgroup.mjs --shots    # also drop frames into qa/
// Exits non-zero on any page error or if the week stalls.

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
    if (p.endsWith('/')) p += 'index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
await mkdir(join(root, 'qa'), { recursive: true });

const args = process.argv.slice(2);
const decline = args.includes('--decline');
const wantShots = args.includes('--shots');

const errors = [];
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });

await page.goto(`http://127.0.0.1:${port}/focusgroup/?day=1`);
await page.waitForTimeout(1200);
await page.keyboard.press('Space');
await page.waitForFunction(() => window.FOCUSGROUP?.state === 'play', { timeout: 40000 })
  .catch(() => errors.push('[fail] never reached Tuesday'));

/**
 * Teleport onto whatever the game will next accept an E on, and press it.
 * Returns the id it used, or null if there is nothing to do.
 */
const tally = new Map();
const doOne = () => page.evaluate((counts) => {
  const g = window.FOCUSGROUP;
  if (!g.world) return null;
  const seen = new Map(counts);
  // things that stay pressable (the panel, a mark you already stood on) would
  // otherwise soak up every turn, so take the least-used one each time
  const pool = g.world.interacts.filter((i) => i.enabled && !i.used && i.key === 'E'
    && (i.step || i.slot || ['bell', 'door', 'panel'].includes(i.id)));
  if (!pool.length) return null;
  pool.sort((a2, b2) => (seen.get(a2.id) || 0) - (seen.get(b2.id) || 0));
  const pick = pool[0];
  if ((seen.get(pick.id) || 0) > 3) return null;
  // stand a step back from it and look straight at it
  const p = g.player;
  p.pos.x = pick.pos.x;
  p.pos.z = pick.pos.z + 0.55;
  const dx = pick.pos.x - p.pos.x, dz = pick.pos.z - p.pos.z;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.atan2(pick.pos.y - (p.pos.y + p.h), 0.55);
  g.doInteract('E');
  return pick.id;
}, [...tally]).then((id) => {
  if (id) tally.set(id, (tally.get(id) || 0) + 1);
  return id;
});

const closeAnyPage = () => page.evaluate(() => {
  const g = window.FOCUSGROUP;
  if (g.reader.open) { g.reader.close(); return 'note'; }
  if (g.survey.open) {
    // tick the empty box on question four, because somebody has to
    const btns = [...document.querySelectorAll('.survey .q-a')].map((r) => r.children);
    btns.forEach((row, i) => row[i === 3 ? 3 : 0].click());
    document.querySelector('.survey .cf-send')?.click();
    setTimeout(() => document.querySelector('.survey .cf-send')?.click(), 60);
    return 'survey';
  }
  return null;
});

const snap = () => page.evaluate(() => {
  const g = window.FOCUSGROUP;
  return {
    state: g.state, day: g.day?.n, set: g.scene3,
    left: (g.steps || []).filter((s) => !s.done && !s.hidden).map((s) => s.id),
    noticed: g.noticed.size, frames: g.director.frames.length,
    engagement: Math.round(g.engagement),
  };
});

// notice every lens we can reach, so the third ending is on the table
const noticeAll = () => page.evaluate(() => {
  const g = window.FOCUSGROUP;
  let n = 0;
  for (const it of [...g.world.interacts]) {
    if (it.key !== 'Q' || !it.enabled) continue;
    g.player.pos.x = it.pos.x;
    g.player.pos.z = it.pos.z + 0.5;
    g.player.yaw = Math.atan2(-(it.pos.x - g.player.pos.x), -(it.pos.z - g.player.pos.z));
    g.player.pitch = Math.atan2(it.pos.y - (g.player.pos.y + g.player.h), 0.5);
    g.doInteract('Q');
    n++;
  }
  return n;
});

const log = [];
let guard = 0;
let lastDay = 0;
let lastSet = '';
while (guard++ < 260) {
  const s = await snap();
  if (s.state === 'ending') break;

  if (s.state === 'play') {
    if (s.day !== lastDay) {
      lastDay = s.day;
      tally.clear();
      log.push(`day ${s.day} (${s.set}) — ${s.left.join(', ')}`);
      if (wantShots) await page.screenshot({ path: join(root, `qa/focusgroup-play-day${s.day}.png`) });
    }
    await noticeAll();
    if (s.set !== lastSet) { lastSet = s.set; tally.clear(); }
    const did = await doOne();
    if (!did) {
      // the checklist may be waiting on a timer (the kettle, the knock)
      await page.waitForTimeout(2200);
    } else {
      await page.waitForTimeout(420);
      await closeAnyPage();
      await page.waitForTimeout(320);
    }
  } else {
    // an advertisement, a load, or the card between days
    await page.evaluate(() => window.FOCUSGROUP.reel?.skip?.());
    await page.waitForTimeout(900);
  }

  // the line, when they ask for it
  const choice = await page.$('#ch-say');
  if (choice) {
    if (wantShots) await page.screenshot({ path: join(root, 'qa/focusgroup-play-line.png') });
    await page.click(decline ? '#ch-no' : '#ch-say');
    await page.waitForTimeout(1500);
  }
}

// let the ending run
for (let i = 0; i < 26; i++) {
  await page.evaluate(() => window.FOCUSGROUP.reel?.skip?.());
  await page.waitForTimeout(900);
  const done = await page.evaluate(() => window.FOCUSGROUP.screen === 'end');
  if (done) break;
}
if (wantShots) await page.screenshot({ path: join(root, `qa/focusgroup-play-end-${decline ? 'declined' : 'said'}.png`) });

const final = await page.evaluate(() => {
  const g = window.FOCUSGROUP;
  return {
    screen: g.screen, state: g.state,
    head: document.querySelector('#scr-end .end-h')?.textContent,
    noticed: g.noticed.size, frames: g.director.frames.length,
    engagement: Math.round(g.engagement),
    endings: JSON.parse(localStorage.getItem('focusgroup_v1') || '{}').endings,
  };
});

console.log(log.join('\n'));
console.log(JSON.stringify(final, null, 1));
if (final.screen !== 'end') errors.push(`[fail] the week stalled on '${final.screen}' after ${guard} turns`);
if (lastDay < 6) errors.push(`[fail] only reached day ${lastDay}`);

console.log(errors.length ? `\n${errors.length} error(s)\n${errors.slice(0, 10).join('\n')}` : '\nplayed the whole week, no page errors');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
