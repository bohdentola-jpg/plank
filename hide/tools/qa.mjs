// Headless screenshots of the built game. Usage:
//   node tools/qa.mjs <scenario> [--mobile] [--w 1280 --h 720] [--out dir]
// Scenarios are defined below; each is a list of steps run inside the page.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const scenario = args[0] || 'title';
const mobile = args.includes('--mobile');
const W = +opt('w', mobile ? 844 : 1280), H = +opt('h', mobile ? 390 : 720);
const outDir = opt('out', join(root, '..', 'qa'));
await mkdir(outDir, { recursive: true });
const file = join(root, mobile ? 'hide-mobile.html' : 'hide.html');

const S = {
  title: [{ shot: 'title' }],
  hole: [{ js: 'g.dbgStart(); g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'hole' }],
  aisle: [{ js: 'g.dbgStart(); const L=g.lvl.layout||null; g.dbgTeleport(g.lvl.W*0.5-1.8+0.0, 12, Math.PI, -0.05)' }, { js: 'g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'aisle' }],
  face: [{ js: 'g.dbgStart(); g.dbgTeleport(g.lvl.W*0.5-1.8, 12, Math.PI, 0.3); g.dbgMonster(g.lvl.W*0.5-1.8, 13.1, Math.PI, "linger"); const m=g.monster; m.model.lookTarget=g.player.eye; m.model.set("scream",1); for(let i=0;i<40;i++) m.model.update(0.05,0); m.update=()=>{}; const hp=new (g.camera.position.constructor)(); m.model.head.getWorldPosition(hp); g.player.lockLook=hp; g.dbgSettle(20)' }, { wait: 3000 }, { shot: 'face' }],
  front: [{ js: 'g.dbgStart(); g.dbgTeleport(g.lvl.W*0.5+3, 8.8, -0.35, 0.02)' }, { js: 'g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'front' }],
  stock: [{ js: 'g.dbgStart(); g.dbgTeleport(g.lvl.W*0.5, g.lvl.S0+1.2, -Math.PI/2-0.6, -0.05)' }, { js: 'g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'stock' }],
  monster: [{ js: 'g.dbgStart(); g.dbgTeleport(g.lvl.W*0.5-1.8, 12, Math.PI, 0.05); g.dbgMonster(g.lvl.W*0.5-1.8, 16.5, Math.PI, "linger"); g.monster.update=()=>{}; g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'monster' }],
  close: [{ js: 'g.dbgStart(); g.dbgTeleport(g.lvl.W*0.5-1.8, 12, Math.PI, 0.25); g.dbgMonster(g.lvl.W*0.5-1.8, 14.2, Math.PI, "linger"); const m=g.monster; m.model.lookTarget=g.player.eye; for(let i=0;i<30;i++) m.model.update(0.05,0); m.update=()=>{}; g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'close' }],
  walk: [{ js: 'g.dbgStart(); g.dbgTeleport(g.lvl.W*0.5-1.8, 12, Math.PI, 0.1); g.dbgMonster(g.lvl.W*0.5-1.8, 15.5, Math.PI, "linger"); const m=g.monster; for(let i=0;i<13;i++) m.model.update(0.05,1.3); m.update=()=>{}; g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'walk' }],
  check: [{ js: 'g.dbgStart(); const h=g.hole; g.dbgMonster(h.check.x, h.check.z, -Math.PI/2, "linger"); g.monster.spot=h; g.monster.setState("check", 999); g.dbgSettle(60)' }, { wait: 3000 }, { shot: 'check' }],
  peerside: [{ js: 'g.dbgStart(); const h=g.hole; g.dbgMonster(h.check.x, h.check.z, -Math.PI/2, "linger"); g.monster.spot=h; g.monster.setState("check", 999); g.monster.checkT=0; g.dbgTeleport(h.check.x+0.9, h.check.z-2.8, 2.83, -0.12); g.dbgSettle(60); g.dbgTeleport(h.check.x+0.9, h.check.z-2.8, 2.83, -0.12); g.dbgSettle(3)' }, { wait: 3000 }, { shot: 'peerside' }],
  litaisle: [{ js: 'g.dbgStart(); const f=g.lvl.pointLights.find(p=>p.kind==="fixture"); g.dbgTeleport(f.x+0.3, f.z-4.5, Math.PI, -0.05); g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'litaisle' }],
  holeout: [{ js: 'g.dbgStart(); const h=g.hole; g.dbgTeleport(h.enter.x+2.5, h.enter.z-1.2, Math.PI/2+0.35, -0.2);' }, { js: 'g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'holeout' }],
  staff: [{ js: 'g.dbgStart(); g.dbgTeleport(g.lvl.W-5.5, g.lvl.D-2.6, Math.PI-0.5, -0.1)' }, { js: 'g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'staff' }],
  dead: [{ js: 'g.dbgStart(); g.dbgTeleport(g.lvl.W*0.5-1.8, 12, Math.PI, 0.05); g.dbgMonster(g.lvl.W*0.5-1.8, 13.0, Math.PI, "linger"); g.monster.grab(); g.dbgSettle(12, 0.05); g._upd=g.update; g.update=()=>{};' }, { wait: 2500 }, { shot: 'grab' }, { js: 'g.update=g._upd; g.dbgSettle(40, 0.05)' }, { wait: 4000 }, { shot: 'dead' }],
  overview: [{ js: 'g.dbgStart(); g.dbgTeleport(2.2, 1.2, -Math.PI*0.8, -0.25); g.player.flashlight=false;' }, { js: 'g.dbgSettle(30)' }, { wait: 3000 }, { shot: 'overview' }],
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !m.text().includes('GPU stall')) console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const sc of scenario.split(',')) {
const t0 = Date.now();
await page.goto('file://' + file + '?debug' + (opt('q', '') ? '&' + opt('q') : ''));
await page.waitForFunction(() => window.__hide && window.__hide.state === 'title', null, { timeout: 180000 });
console.log(sc, 'booted in', ((Date.now() - t0) / 1000).toFixed(1), 's');
for (const step of S[sc]) {
  if (step.js) await page.evaluate(`(()=>{const g=window.__hide; ${step.js}})()`);
  if (step.wait) await page.waitForTimeout(step.wait);
  if (step.shot) {
    const p = join(outDir, `${mobile ? 'm-' : ''}${step.shot}.png`);
    await page.screenshot({ path: p, timeout: 180000 });
    console.log('shot', p);
  }
}
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { if (++n >= 5) res(((performance.now() - t0) / n).toFixed(0) + 'ms/frame'); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
console.log(fps);
const info = await page.evaluate(() => { const g = window.__hide; const r = g.renderer.info; return { calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, tex: r.memory.textures, progs: r.programs.length, state: g.state, mstate: g.monster.state }; });
console.log(JSON.stringify(info));
}
await browser.close();
