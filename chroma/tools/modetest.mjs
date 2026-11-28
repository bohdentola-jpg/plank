// Battle-mode test: runs short CPU matches (your Chromeleon on autoplay) in
// Zone Clash and Hue Hoops on several stages and checks that the mode really
// plays out: zones get captured and counts drop; the ball gets grabbed, thrown
// and scored; every match ends with a result and the page throws no errors.
//   node chroma/tools/modetest.mjs
//   node chroma/tools/modetest.mjs --modes hoops --stages mesa --time 60
// Headless software rendering is slow, so it uses &sim (several simulation
// steps per rendered frame) and &fast (bigger dt cap).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('../..', import.meta.url));
const qa = fileURLToPath(new URL('../qa/', import.meta.url));
await mkdir(qa, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => { try { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(join(root, p))); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/chroma/index.html`;

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const modes = arg('modes', 'zones,hoops').split(',');
// two stages per mode by default (override with --stages a,b)
const STAGES = { zones: ['terminal', 'mesa'], hoops: ['terminal', 'skyline'] };
const stagesFor = (mode) => (arg('stages', null) ? arg('stages').split(',') : STAGES[mode] || ['terminal']);
const TIME = +arg('time', '0'); // 0 = per-mode default (zones 90 s, hoops 120 s)
const sim = +arg('sim', '6');
const skill = arg('skill', 'normal');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) { pass++; console.log('  ok  ', name, extra); } else { fail++; console.log('  FAIL', name, extra); } };

const probe = () => {
  const m = window.__chroma.mode, r = m?.rules;
  if (!m || !r) return { state: m?.state || 'loading' };
  const o = { state: m.state, t: Math.round(m.timeLeft), mode: r.kind, stats: { ...r.stats } };
  if (r.kind === 'zones') Object.assign(o, { ctrl: r.ctrl, count: [r.count[1], r.count[2]].map((v) => +v.toFixed(1)), pen: [r.pen[1], r.pen[2]].map((v) => +v.toFixed(1)), cov: [r.cov[1], r.cov[2]].map((v) => +v.toFixed(2)), ot: r.ot });
  else Object.assign(o, { ball: ['reset', 'free', 'held'][r.ball.st], carrier: r.ball.carrier?.name || null, score: [r.score[1], r.score[2]], open: [r.hoops[1].open, r.hoops[2].open], prog: [r.hoops[1].prog, r.hoops[2].prog].map((v) => +v.toFixed(2)), ot: r.ot });
  return o;
};

for (const mode of modes) {
  const time = TIME || (mode === 'hoops' ? 120 : 90);
  for (const stage of stagesFor(mode)) {
    console.log(`-- ${mode} on ${stage} (${time}s match)`);
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    const errors = [];
    page.on('pageerror', (e) => { errors.push(e.message); console.log('  [pageerror]', e.message); });
    page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text().slice(0, 200)); });
    await page.goto(`${base}?quick&skipintro&qa&autoplay&fast&nonews&sim=${sim}&mode=${mode}&stage=${stage}&time=${time}&skill=${skill}`);
    await page.waitForFunction(() => window.__chroma?.mode?.constructor.name === 'Battle' && !window.__chroma.loadingNow, null, { timeout: 180000 });
    let last = null, minCount = 100, maxScore = 0, shot = false;
    const t0 = Date.now();
    for (;;) {
      await page.waitForTimeout(4000);
      const s = await page.evaluate(probe);
      if (s.mode) {
        last = s;
        if (s.count) minCount = Math.min(minCount, ...s.count);
        if (s.score) maxScore = Math.max(maxScore, ...s.score);
        console.log('   ', JSON.stringify(s));
      }
      if (!shot && s.state === 'play' && s.t < time * 0.55) { shot = true; await page.screenshot({ path: join(qa, `mode_${mode}_${stage}.png`) }); }
      if (s.state === 'results' || s.state === 'judge') break;
      if (Date.now() - t0 > 900000) { console.log('   timeout'); break; }
    }
    // the judge screen runs on timers, which crawl at headless frame rates
    await page.waitForFunction(() => document.querySelector('.overlay.results .rs-pct'), null, { timeout: 240000 }).catch(() => console.log('   (results screen did not appear in time)'));
    await page.waitForTimeout(1500);
    const res = await page.evaluate(() => ({ result: window.__chroma.mode.result, pct: document.querySelector('.rs-pct')?.textContent || null }));
    await page.screenshot({ path: join(qa, `mode_${mode}_${stage}_results.png`) });
    const st = last?.stats || {};
    if (mode === 'zones') {
      check(`${stage}: zone captured`, st.captures >= 1, `captures=${st.captures} neutrals=${st.neutrals}`);
      check(`${stage}: a count dropped`, minCount < 100, `lowest count ${minCount}`);
    } else {
      check(`${stage}: ball grabbed`, st.grabs >= 1, `grabs=${st.grabs}`);
      check(`${stage}: ball thrown`, st.throws >= 1, `throws=${st.throws}`);
      check(`${stage}: a team scored`, st.scores >= 1 && maxScore > 0, `scores=${st.scores} dunks=${st.dunks} best=${maxScore}`);
    }
    check(`${stage}: match ended with a ${mode} result`, res.result?.mode === mode && (res.result.winner === 1 || res.result.winner === 2), JSON.stringify(res));
    check(`${stage}: results screen shows the ${mode === 'zones' ? 'counts' : 'score'}`, !!res.pct && /\d/.test(res.pct), String(res.pct));
    check(`${stage}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }
}
console.log(`${pass} passed, ${fail} failed`);
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
