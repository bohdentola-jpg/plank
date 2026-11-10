// Real-time smoke test (no ?test): title → new game → creator → intro → walk
// around → open the binder. Uses real key events and wall-clock waits.
module.exports = async (h) => {
  const { page } = h;
  const url = (await h.ev(() => location.href).catch(() => null));
  void url;
  await h.open('');                                   // gives us the server origin
  const origin = await h.ev(() => location.origin);
  await page.goto(`${origin}/fable/index.html`);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.goto(`${origin}/fable/index.html`);
  await page.waitForFunction(() => window.__fable && window.__fable.G.top(), null, { timeout: 60000 });
  const key = async (k, n = 1, gap = 250) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };
  const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
  const mode = () => page.evaluate(() => ({ mode: window.__fable.mode(), err: window.__fable.errors().slice(0, 3), area: window.__fable.G.S && window.__fable.G.S.area }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${h.qaDir}/rt-0-title.png` });
  await key('Space');                                 // New Game (focused)
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${h.qaDir}/rt-1-creator.png` });
  await page.click('text=Catch the bus');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${h.qaDir}/rt-2-intro.png` });
  await key('Space', 14, 420);                        // through the intro cards
  await page.waitForTimeout(3000);
  console.log('after intro', JSON.stringify(await mode()));
  await key('Space', 10, 450);                        // Gus's arrival lines
  await page.waitForTimeout(800);
  await hold('KeyA', 2600);                           // walk west down Main Street
  await page.screenshot({ path: `${h.qaDir}/rt-3-walk.png` });
  await key('Tab');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${h.qaDir}/rt-4-binder.png` });
  await key('Escape');
  const st = await mode();
  console.log('end', JSON.stringify(st), JSON.stringify(await page.evaluate(() => { const g = window.__fable.G; return { x: g.world && g.world.leader.x, q: g.S.quests, fps: g.frame }; })));
  if (st.err.length) throw new Error(st.err[0]);
};
