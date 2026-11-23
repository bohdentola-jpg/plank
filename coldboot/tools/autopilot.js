// QA autopilot: plays the current objectives in the real game (in a headless
// browser), so a broken chain shows up as an objective that never changes.
//   node coldboot/tools/shot.mjs "screen=town&ff=1" ap.png --wait 60000 \
//     --eval "import('/coldboot/tools/autopilot.js').then((m) => m.run(480))"
// It teleports next to the objective, presses interact when there's a prompt,
// answers every choice with the first option, skips lines, wins minigames,
// backs out of the laptop (marking the day's lesson done) and sleeps when the
// day's work is finished. Returns a log of objectives with timestamps.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(seconds = 300, o = {}) {
  const { G, input } = window.__cb;
  const { LESSONS } = await import('../src/code/lessons.js');
  const log = [];
  const t0 = performance.now();
  let last = '', same = 0, lastDay = G.state.day;
  const key = (code) => input._pendingKeys.push(code);
  const note = (s) => { log.push(`${((performance.now() - t0) / 1000).toFixed(0)}s d${G.state.day} ${G.state.hour.toFixed(1)}h  ${s}`); };
  const errs = [];
  window.addEventListener('error', (e) => errs.push(e.message));
  while (performance.now() - t0 < seconds * 1000) {
    await sleep(350);
    const s = G.state, d = G.director;
    if (s.day !== lastDay) { note(`=== DAY ${s.day} ===`); lastDay = s.day; }
    if (o.stopDay && s.day >= o.stopDay) break;
    if (d.choice) { const c = d.choice; d.choice = null; c.r(0); continue; }
    if (d.lineHandle && d.lineHandle.h.t > 0.15) { d._skipResolve?.(); continue; }
    if (G.minigames?.cur) { G.minigames._end(true); continue; }
    if (G.overlay) {
      const L = LESSONS.find((l) => l.day === s.day) || LESSONS[Math.min(LESSONS.length - 1, s.day - 1)];
      if (L) s.lessons[L.id] = true;
      key('Escape');
      continue;
    }
    if (G.phone?.open) G.phone.close();
    if (G.cinematic || G.player.locked) continue;
    const obj = G.hud.objective;
    const text = obj ? obj.text : '(none)';
    if (text !== last) { note('◆ ' + text); last = text; same = 0; } else same++;
    const tg = obj?.target;
    if (tg) {
      const P = G.player.pos;
      const dist = Math.hypot(P.x - tg.x, P.z - tg.z);
      if (dist > 2.2) {
        const a = Math.atan2(P.x - tg.x, P.z - tg.z);
        const off = tg.y !== undefined ? 0.5 : 1.3;
        const x = tg.x + Math.sin(a) * off, z = tg.z + Math.cos(a) * off;
        G.player.place(x, z, Math.atan2(tg.x - x, tg.z - z), tg.y);
        continue;
      }
    }
    if (G.hud.prompt && G.hud.prompt.action === 'interact') { key('KeyE'); continue; }
    // nothing to do here: let the clock run (missions that wait for an hour)
    if (same > 6) {
      s.hour = Math.min(23.4, s.hour + 0.5);
      if (s.hour >= 23.3) {
        note('… sleeping');
        const c = G.town.points['cabin.bed'];
        if (c) G.player.place(c.x + 0.8, c.z + 0.8, 0);
        await sleep(400);
        await G.sleep?.();
        same = 0;
      }
    }
  }
  if (errs.length) log.push('ERRORS: ' + [...new Set(errs)].slice(0, 6).join(' | '));
  log.push(`done: day ${G.state.day}, missions done: ${Object.keys(G.state.missions.done).length}, active: ${Object.keys(G.state.missions.active).join(', ')}`);
  return log.join('\n');
}
