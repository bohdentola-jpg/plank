// Load COLD BOOT through a running serve.py (the way players run it) and report
// module-load failures.   python3 serve.py 8765 --no-browser &  then
//   node coldboot/tools/serve_check.mjs 8765 3
import { chromium } from 'playwright';
const port = process.argv[2], runs = +(process.argv[3] || 3);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
let fails = 0;
for (let r = 0; r < runs; r++) {
  const page = await browser.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('requestfailed', (q) => errs.push('REQUEST FAILED ' + q.url().replace(/^.*\/coldboot\//, '') + ' ' + (q.failure()?.errorText || '')));
  await page.goto(`http://127.0.0.1:${port}/coldboot/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(12000);
  const bad = errs.filter((e) => /fetch|FAILED|Failed|MIME|module/i.test(e));
  if (bad.length) fails++;
  console.log(`run ${r + 1}: ${bad.length ? 'FAIL\n  ' + bad.slice(0, 5).join('\n  ') : 'ok'}`);
  await page.close();
}
console.log(`${fails}/${runs} runs failed`);
await browser.close();
