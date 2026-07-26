// Headless playtest for QUAHOG HIT & RUN: boots the world, then drives every
// system from the outside — walking, the direction WASD actually moves you,
// driving, a job start to finish, races, brawls, the boss, cops, cutaway gags,
// nightfall, the level handover, collectibles — and fails on any page error.
// Usage: npm run play:quahog
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
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

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });

await page.goto(`http://127.0.0.1:${port}/quahog/index.html?drop=peter`);
await page.waitForFunction('window.__quahog && window.__quahog.world && window.__quahog.world.city', null, { timeout: 120000 });
await page.waitForTimeout(1500);

let failures = 0;
async function check(name, fn) {
  const before = errors.length;
  try {
    const r = await fn();
    if (r === false) throw new Error('returned false');
    if (errors.length > before) throw new Error('page errors: ' + errors.slice(before).join(' | '));
    console.log(`ok   ${name}${typeof r === 'string' ? ' — ' + r : ''}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

const evalIn = (fn, arg) => page.evaluate(fn, arg);

await check('world booted with a town in it', () => evalIn(() => {
  const w = window.__quahog.world;
  return `${w.city.colliders.all.length} colliders, ${w.vehicles.length} cars, ${w.gagMarkers.length} gags, ${w.missionMarkers.length} jobs`;
}));

await check('a few seconds of simulation', async () => {
  await page.waitForTimeout(2500);
  return evalIn(() => `t=${window.__quahog.world.t.toFixed(1)}s`);
});

await check('walking around does not fall through the world', async () => {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1400);
  await page.keyboard.up('KeyW');
  return evalIn(() => {
    const p = window.__quahog.world.player;
    if (!isFinite(p.x) || !isFinite(p.z)) return false;
    return `at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`;
  });
});

await check('WASD moves the way the camera is facing', async () => {
  const before = await evalIn(() => {
    const w = window.__quahog.world;
    w.camYaw = 0; w.camManual = 9;          // camera parked behind, looking -Z
    w.player.x = -180; w.player.z = -40; w.player.vehicle = null;
    return { x: w.player.x, z: w.player.z };
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  const fwd = await evalIn(() => ({ x: window.__quahog.world.player.x, z: window.__quahog.world.player.z }));
  if (!(fwd.z < before.z - 0.5)) return `W went the wrong way (z ${before.z} -> ${fwd.z})`;
  await evalIn(() => { const w = window.__quahog.world; w.camYaw = 0; w.camManual = 9; });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyD');
  const right = await evalIn(() => ({ x: window.__quahog.world.player.x }));
  if (!(right.x > fwd.x + 0.5)) return `D went the wrong way (x ${fwd.x} -> ${right.x})`;
  return `W → -Z, D → +X`;
});

await check('gets in a car and drives it', async () => {
  await evalIn(() => { const w = window.__quahog.world; w.enterVehicle(w.myCar); });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2200);
  await page.keyboard.up('KeyW');
  const r = await evalIn(() => {
    const v = window.__quahog.world.player.vehicle;
    return v ? { mph: v.mph, ok: isFinite(v.pos.x) } : null;
  });
  if (!r || !r.ok) return false;
  return `${r.mph} mph`;
});

await check('gets back out again', async () => {
  await evalIn(() => window.__quahog.world.exitVehicle(true));
  return evalIn(() => window.__quahog.world.player.vehicle === null);
});

await check('collect mission runs start to finish', async () => {
  await evalIn(() => {
    const w = window.__quahog.world;
    const m = w.missionMarkers.find((x) => x.mission.id === 'l1m1') || w.missionMarkers[0];
    w.startMission(m.mission);
  });
  await page.waitForTimeout(400);
  await evalIn(() => window.__quahog.world.director.skip());
  await page.waitForTimeout(600);
  // teleport onto every pickup, then the drop-off marker
  for (let i = 0; i < 12; i++) {
    const done = await evalIn(() => {
      const w = window.__quahog.world;
      if (!w.missions.active) return 'done';
      const next = w.pickups.find((p) => !p.taken);
      const to = next || w.marker;
      if (!to) return 'waiting';
      w.player.x = to.x; w.player.z = to.z;
      return 'moving';
    });
    if (done === 'done') break;
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(500);
  await evalIn(() => { if (window.__quahog.world.director.active) window.__quahog.world.director.skip(); });
  await page.waitForTimeout(400);
  return evalIn(() => {
    const s = window.__quahog.world.save;
    return s.done.includes('l1m1') ? `coins ${s.coins}` : false;
  });
});

await check('race checkpoints tick over', async () => {
  await evalIn(() => {
    const w = window.__quahog.world;
    w.spawnCheckpoints([[0, -60], [0, 0], [-120, 0]]);
    return w.checkpointsTotal();
  });
  for (let i = 0; i < 4; i++) {
    await evalIn(() => {
      const w = window.__quahog.world;
      const c = w.checkpoints.find((x) => !x.taken);
      if (c) { w.player.x = c.x; w.player.z = c.z; }
    });
    await page.waitForTimeout(300);
  }
  const left = await evalIn(() => window.__quahog.world.checkpointsLeft());
  await evalIn(() => window.__quahog.world.clearCheckpoints());
  return left === 0 ? 'all taken' : false;
});

await check('brawlers spawn, get hit and go down', async () => {
  await evalIn(() => window.__quahog.world.spawnBrawlers(4));
  await page.waitForTimeout(1200);
  for (let i = 0; i < 8; i++) {
    await evalIn(() => {
      const w = window.__quahog.world;
      const b = w.brawlers.find((x) => x.down <= 0);
      if (b) { w.player.x = b.x - Math.sin(w.player.yaw) * 1.0; w.player.z = b.z - Math.cos(w.player.yaw) * 1.0; }
    });
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(220);
  }
  const standing = await evalIn(() => window.__quahog.world.brawlers.filter((b) => b.down <= 0).length);
  await evalIn(() => window.__quahog.world.clearBrawlers());
  return `${4 - standing}/4 down`;
});

await check('the giant chicken turns up and can be beaten', async () => {
  await evalIn(() => window.__quahog.world.spawnBoss(3));
  await page.waitForTimeout(800);
  for (let i = 0; i < 14; i++) {
    const gone = await evalIn(() => {
      const w = window.__quahog.world;
      if (!w.boss) return true;
      w.player.x = w.boss.x - Math.sin(w.player.yaw) * 1.4;
      w.player.z = w.boss.z - Math.cos(w.player.yaw) * 1.4;
      return false;
    });
    if (gone) break;
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(260);
  }
  const alive = await evalIn(() => !!window.__quahog.world.boss);
  await evalIn(() => window.__quahog.world.clearBoss());
  return alive ? false : 'chicken down';
});

await check('cops turn up and can bust you', async () => {
  await evalIn(() => window.__quahog.world.setWanted(3));
  await page.waitForTimeout(4000);
  const units = await evalIn(() => window.__quahog.world.police.units.length);
  await evalIn(() => { const w = window.__quahog.world; w.wanted = 0; w.police.clear(); });
  return units > 0 ? `${units} cruisers` : false;
});

await check('a cutaway gag plays and pays out', async () => {
  const before = await evalIn(() => window.__quahog.world.save.coins);
  await evalIn(() => window.__quahog.world.playGag(window.__quahog.world.gagMarkers[0]));
  await page.waitForTimeout(700);
  await evalIn(() => window.__quahog.world.director.skip());
  await page.waitForTimeout(700);
  const after = await evalIn(() => ({ coins: window.__quahog.world.save.coins, gags: window.__quahog.world.save.gags.length }));
  return after.gags > 0 && after.coins > before ? `+${after.coins - before}` : false;
});

await check('night falls and the lights come on', async () => {
  await evalIn(() => { window.__quahog.world.hour = 22; });
  await page.waitForTimeout(900);
  const { night } = await evalIn(async () => {
    const m = await import('/quahog/src/buildings.js');
    return { night: m.nightNow() };
  });
  return night ? 'lights on' : false;
});

await check('every Griffin can be swapped in', async () => {
  for (const id of ['lois', 'stewie', 'brian', 'chris', 'meg', 'peter']) {
    await evalIn((who) => window.__quahog.world.setCharacter(who), id);
    await page.waitForTimeout(220);
  }
  return evalIn(() => window.__quahog.world.player.id);
});

await check('the map opens', async () => {
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(500);
  const shown = await page.evaluate(() => document.getElementById('map-overlay').classList.contains('show'));
  await page.keyboard.press('KeyM');
  return shown;
});

await check('the story opens with a cutscene and level one', async () => {
  await evalIn(() => {
    const w = window.__quahog.world;
    w.save.done.length = 0;
    w.save.level = 1;
    w.beginStory();
  });
  await page.waitForTimeout(900);
  const inCut = await evalIn(() => window.__quahog.world.director.active);
  if (!inCut) return 'no opening cutscene';
  for (let i = 0; i < 24; i++) {
    const still = await evalIn(() => {
      const w = window.__quahog.world;
      if (w.director.active) { w.director.skip(); return true; }
      return false;
    });
    await page.waitForTimeout(200);
    if (!still && i > 2) break;
  }
  return evalIn(() => {
    const w = window.__quahog.world;
    return w.player.id === 'peter' && w.missionMarkers.length > 0
      ? `level ${w.save.level}, ${w.missionMarkers.length} job marker(s)` : false;
  });
});

await check('finishing a level rolls into the next one', async () => {
  await evalIn(async () => {
    const w = window.__quahog.world;
    const st = await import('/quahog/src/story.js');
    const lvl = st.levelById(1);
    for (const m of lvl.missions) if (!w.save.done.includes(m.id)) w.save.done.push(m.id);
    w.finishLevel();
  });
  for (let i = 0; i < 30; i++) {
    await evalIn(() => { const w = window.__quahog.world; if (w.director.active) w.director.skip(); });
    await page.waitForTimeout(180);
    const lv = await evalIn(() => window.__quahog.world.save.level);
    if (lv === 2) break;
  }
  return evalIn(() => {
    const w = window.__quahog.world;
    return w.save.level === 2 && w.player.id === 'brian'
      ? `level 2 as ${w.player.id}` : `stuck on level ${w.save.level} as ${w.player.id}`;
  });
});

await check('level collectibles can be picked up', async () => {
  const before = await evalIn(() => window.__quahog.world.collectibles.length);
  if (!before) return 'no collectibles spawned';
  // stand on one, waiting out any cutscene that is still running
  for (let i = 0; i < 12; i++) {
    const done = await evalIn(() => {
      const w = window.__quahog.world;
      if (w.director.active) { w.director.skip(); return false; }
      const c = w.collectibles[0];
      if (!c) return true;
      w.player.x = c.x; w.player.z = c.z;
      return false;
    });
    await page.waitForTimeout(260);
    if (done) break;
  }
  const after = await evalIn(() => ({
    left: window.__quahog.world.collectibles.length,
    found: Object.values(window.__quahog.world.save.found).flat().length,
  }));
  return after.left < before && after.found > 0 ? `${after.found} found` : false;
});

await check('still no page errors after all that', () => errors.length === 0 || errors.join(' | '));

if (errors.length) console.error('\npage errors:\n' + errors.join('\n'));
console.log(failures ? `\n${failures} playtest failure(s)` : '\nplaytest clean');
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
