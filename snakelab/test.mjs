// Headless check of snake-lab.html: every lesson's starter fails politely, every
// solution passes, every play mode runs, and the error messages point at the right line.
// Run: node snakelab/build.mjs && node snakelab/test.mjs [--shots DIR]
import { chromium } from 'playwright';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(here, 'snake-lab.html')).href;
const shotsArg = process.argv.indexOf('--shots');
const shots = shotsArg > 0 ? resolve(process.argv[shotsArg + 1]) : null;
if (shots) mkdirSync(shots, { recursive: true });

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ok ' : 'FAIL '} ${msg}`); if (!cond) failures++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept());
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__snakelab);

const shot = async (name) => { if (shots) await page.screenshot({ path: join(shots, name + '.png') }); };
const setCode = (code) => page.evaluate((c) => { const s = window.__snakelab.src; s.value = c; s.dispatchEvent(new Event('input')); }, code);
const consoleText = () => page.$eval('#console', (e) => e.innerText);
const idle = () => page.waitForFunction(() => !document.getElementById('led').classList.contains('busy'), null, { timeout: 8000 });
async function run(code) {
  if (code !== undefined) await setCode(code);
  await page.click('#runBtn');
  await idle();
  return consoleText();
}
const lesson = () => page.evaluate(() => { const { S, LESSONS } = window.__snakelab; return LESSONS[S.at]; });
const done = (id) => page.evaluate((i) => !!window.__snakelab.S.done[i], id);
const game = () => page.evaluate(() => { const g = window.__snakelab.game; return { on: g.on, alive: g.alive, started: g.started, snake: g.snake, score: g.score, rate: g.rate, dir: g.dir }; });
const overlayText = () => page.$eval('#overlay', (e) => e.innerText.replace(/\s+/g, ' ').trim());

const LESSONS = await page.evaluate(() => window.__snakelab.LESSONS.map((l) => ({ id: l.id, kind: l.kind, play: l.play || null, solution: l.solution, starter: l.starter })));
ok(LESSONS.length === 15, `${LESSONS.length} lessons`);
await shot('01-start');

for (const [i, L] of LESSONS.entries()) {
  const cur = await lesson();
  ok(cur.id === L.id, `lesson ${i + 1} is on screen (${L.id})`);
  // the starter code runs but doesn't solve it (the sandbox starter is already a working game)
  const t0 = await run();
  if (L.kind !== 'sandbox') ok(!(await done(L.id)) && !/inside Snake Lab itself/.test(t0), `  starter fails politely: ${t0.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 90)}`);
  if (i === 3) await shot('02-draw-starter');
  const t1 = await run(L.solution ?? undefined);
  ok(await done(L.id), `  solution passes${(await done(L.id)) ? '' : ': ' + t1.slice(0, 300)}`);
  if (i === 6) await shot('03-checkerboard');

  if (L.play) {
    await page.click('#playBtn');
    let g = await game();
    ok(g.on && !g.started, `  ${L.play}: Play waits for an arrow key`);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(450);
    g = await game();
    ok(g.started && g.alive && g.snake[0][1] > 8, `  ${L.play}: the snake moves down (head ${JSON.stringify(g.snake[0])})`);
    // put an apple right in front of the head
    await page.evaluate(() => { const g = window.__snakelab.game; g.apple = [g.snake[0][0], g.snake[0][1] + 1]; });
    await page.waitForFunction(() => window.__snakelab.game.score > 0 || !window.__snakelab.game.on, null, { timeout: 3000 });
    g = await game();
    ok(g.score === 1, `  ${L.play}: ate an apple (score ${g.score}, length ${g.snake.length})`);
    if (L.play !== 'dot' && L.play !== 'walls') ok(g.snake.length === 4, `  ${L.play}: grew to 4`);
    if (L.play === 'speed' || L.kind === 'sandbox') {
      await page.evaluate(() => { const g = window.__snakelab.game; g.score = 8; g.apple = [g.snake[0][0], g.snake[0][1] + 1]; });
      await page.waitForFunction(() => window.__snakelab.game.score === 9 || !window.__snakelab.game.on, null, { timeout: 3000 });
      g = await game();
      ok(g.rate === 8, `  ${L.play}: speed(9) sets ${g.rate} moves a second`);
    }
    if (L.play === 'full' || L.play === 'speed') {
      await page.evaluate(() => { const g = window.__snakelab.game; g.snake = [[5, 5], [6, 5], [6, 6], [5, 6], [4, 6]]; g.dir = 'down'; g.queue = []; g.apple = [12, 1]; });
      await page.waitForFunction(() => !window.__snakelab.game.on, null, { timeout: 3000 });
      ok(/bit yourself/i.test(await overlayText()), `  ${L.play}: biting itself ends it (${await overlayText()})`);
    } else {
      // run into the bottom edge
      await page.waitForFunction(() => !window.__snakelab.game.on, null, { timeout: 8000 });
      const o = await overlayText();
      ok(L.play === 'dot' ? /off the edge/i.test(o) : /wall/i.test(o), `  ${L.play}: hitting the edge ends it (${o})`);
    }
    if (i === 9) await shot('04-play-dot');
    if (i === 13) await shot('05-play-speed');
  }
  if (i < LESSONS.length - 1) {
    ok(await page.isVisible('#nextBtn'), '  Next lesson button shows');
    await page.click('#nextBtn');
  }
}

// ---- the sandbox: wrap-around rules from the hints
const sandboxCode = await page.evaluate(() => window.__snakelab.src.value);
ok(/def draw\(snake, apple\)/.test(sandboxCode) && /def speed\(score\)/.test(sandboxCode) && !/^draw\(\[/m.test(sandboxCode), 'sandbox starter holds all six functions and none of the try-it-out calls');
const wrap = sandboxCode
  .replace(/def step\(head, direction\):[\s\S]*?(?=\n\n|\n#)/, 'def step(head, direction):\n    x, y = head\n    if direction == "up":\n        return (x, (y - 1) % 16)\n    elif direction == "down":\n        return (x, (y + 1) % 16)\n    elif direction == "left":\n        return ((x - 1) % 16, y)\n    return ((x + 1) % 16, y)')
  .replace(/def hits_wall\(pos\):[\s\S]*?(?=\n\n|\n#)/, 'def hits_wall(pos):\n    return False');
await run(wrap);
await page.click('#playBtn');
await page.keyboard.press('ArrowRight');
await page.evaluate(() => { const g = window.__snakelab.game; g.apple = [0, 0]; });
await page.waitForFunction(() => window.__snakelab.game.snake[0][0] < 5, null, { timeout: 6000 }).catch(() => {});
let g = await game();
ok(g.alive && g.snake[0][0] < 5, `sandbox wrap-around: the head came out the left side (${JSON.stringify(g.snake[0])})`);
await page.click('#playBtn');

// ---- errors point at the right place
await page.evaluate(() => window.__snakelab.showLesson(9));   // step
let t = await run('def step(head, direction):\n    x, y = head\n    if direction == "up"\n        return (x, y - 1)\n');
let err = await page.evaluate(() => [...document.querySelectorAll('#hl .ln')].findIndex((e) => e.classList.contains('err')) + 1);
ok(/SyntaxError/.test(t) && err === 3, `syntax error is shown on line 3 (${err}): ${t.split('\n')[0]}`);
t = await run('def step(head, direction):\n    x, y = head\n    return (x, y + sped)\n');
err = await page.evaluate(() => [...document.querySelectorAll('#hl .ln')].findIndex((e) => e.classList.contains('err')) + 1);
ok(/NameError/.test(t) && err === 3, `NameError inside step() highlights line 3 (${err})`);
t = await run('def step(head, direction):\n    x, y = head\n    if direction == "up":\n        return (x, y - 1)\n');
ok(/None/.test(t) && /return/.test(t), 'missing return is explained');
// a broken draw() from an earlier lesson is reported as such, not as a line of this one
await page.evaluate(() => { window.__snakelab.S.kit.draw = 'def draw(snake, apple):\n    clear()\n    pixel(apple[0], apple[1], "rde")\n'; });
await run(LESSONS[9].solution);
await page.click('#playBtn');
await page.keyboard.press('ArrowUp');
await page.waitForFunction(() => !window.__snakelab.game.on, null, { timeout: 3000 }).catch(() => {});
t = await consoleText();
err = await page.evaluate(() => [...document.querySelectorAll('#hl .ln')].findIndex((e) => e.classList.contains('err')) + 1);
ok(/Did you mean "red"/.test(t) && /earlier lesson/.test(t) && err === 0, `error in an earlier lesson's draw() is reported there: ${t.replace(/\s+/g, ' ').slice(0, 160)}`);
await page.evaluate(() => { delete window.__snakelab.S.kit.draw; });
// pixel() checks
await page.evaluate(() => window.__snakelab.showLesson(3));
t = await run('pixel(16, 3, "red")\n');
ok(/x must be between 0 and 15/.test(t), 'pixel(16, ...) explains the range');
t = await run('pixel(2, 3, "red")\npixel(7, 7, "gren")\n');
ok(/Did you mean "green"/.test(t), 'a misspelt colour gets a suggestion');
t = await run('while True:\n    pass\n');
ok(/TimeoutError/.test(t), 'an endless loop stops with a TimeoutError');

// ---- progress survives a reload
await page.reload();
await page.waitForFunction(() => window.__snakelab);
const progress = await page.evaluate(() => Object.keys(window.__snakelab.S.done).length);
ok(progress === 15, `progress kept after reload (${progress} lessons done)`);
await page.evaluate(() => window.__snakelab.showLesson(0));

// ---- phone layout
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
phone.on('pageerror', (e) => problems.push('phone pageerror: ' + e.message));
await phone.goto(url);
await phone.waitForFunction(() => window.__snakelab);
const wide = await phone.evaluate(() => document.documentElement.scrollWidth);
ok(wide <= 390, `no sideways scrolling on a phone (page is ${wide}px wide)`);
if (shots) await phone.screenshot({ path: join(shots, '06-phone.png'), fullPage: true });

ok(problems.length === 0, `no page errors${problems.length ? ': ' + problems.slice(0, 5).join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
