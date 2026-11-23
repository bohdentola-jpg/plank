// Money in Port Zarya: shops (Hank's, Koshkin's, NORTHSTAR 24 — which logs
// everything you buy — and the diner), paid jobs played as small games, and
// repairs that use materials and visibly fix the town.
import { input } from '../core/input.js';
import { C, W, H, text, panel, vText, roundRect, hints, actionGlyph } from '../core/ui.js';
import { saveGame } from './state.js';

export const ITEMS = {
  lumber: 'Lumber (2×4s)', nails: 'Box of nails', paint: 'Can of paint', glass: 'Window glass', wire: 'Electrical wire',
  shingles: 'Roof shingles', hemp_rope: 'Hemp rope', rope: 'Rope', pipe: 'Pipe fittings', coffee: 'Coffee beans', tea: 'Black tea (Russian)',
  pie: 'Blueberry pie', flowers: 'Dried flowers', whiskey: 'Whiskey', fish: 'Smoked salmon', chocolate: 'Chocolate bar',
  batteries: 'Batteries', film: 'Film for the camera', gloves: 'Work gloves', ushanka: 'Ushanka hat', soup: 'Bowl of soup',
  diner_coffee: 'Cup of coffee', northstar_coffee: 'Northstar coffee', candle: 'Church candle',
};

export const SHOPS = {
  hardware: { name: 'BRUBAKER HARDWARE & FUEL', owner: 'hank', items: { lumber: 12, nails: 4, paint: 18, glass: 25, wire: 8, shingles: 15, hemp_rope: 25, rope: 10, pipe: 10, gloves: 15, batteries: 5 } },
  koshkin: { name: "KOSHKIN'S GENERAL MDSE.", owner: 'koshkin', items: { coffee: 9, tea: 6, flowers: 8, whiskey: 28, fish: 7, chocolate: 3, batteries: 5, film: 9, ushanka: 40, candle: 2 } },
  northstar: { name: 'NORTHSTAR 24', owner: 'evan', watched: true, items: { coffee: 6, tea: 5, flowers: 6, whiskey: 22, fish: 6, chocolate: 2, batteries: 3, film: 7 } },
  diner: { name: 'MIDNIGHT SUN DINER', owner: 'dolly', items: { diner_coffee: 2, pie: 5, soup: 7 } },
};

// ------------------------------------------------------------------ overlay helper
function overlay(G, impl) {
  return new Promise((resolve) => {
    G.player.locked = true;
    const close = (v) => { G.overlay = null; G.player.locked = false; saveGame(); resolve(v); };
    G.overlay = {
      update: (dt) => impl.update(dt, close),
      draw: (ctx, dt) => impl.draw(ctx, dt),
      finish: close,   // QA: end the job with this result
    };
  });
}

export class Economy {
  constructor(G) { this.G = G; }

  shop(id) {
    const G = this.G, s = G.state, def = SHOPS[id];
    if (!def) return Promise.resolve();
    const list = Object.entries(def.items);
    let sel = 0, flash = 0, msg = '';
    return overlay(G, {
      update(dt, close) {
        flash = Math.max(0, flash - dt);
        const n = list.length + 1;
        if (input.pressed('up')) sel = (sel - 1 + n) % n;
        if (input.pressed('down')) sel = (sel + 1) % n;
        if (input.pressed('back')) close();
        if (input.pressed('confirm') || input.pressed('interact')) {
          if (sel === list.length) { close(); return; }
          const [item, price] = list[sel];
          if (s.money < price) { msg = 'Not enough money.'; flash = 1; return; }
          s.money -= price;
          s.inv[item] = (s.inv[item] || 0) + 1;
          msg = `Bought ${ITEMS[item] || item}.`;
          flash = 1;
          (G.sfx?.register ? G.sfx.register() : G.sfx?.ui?.('buy'));
          if (def.watched) G.attention.add(1.5); // Northstar keeps a record
        }
      },
      draw(ctx) {
        panel(ctx, 340, 90, 600, 120 + list.length * 38, { accentLen: 200 });
        vText(ctx, def.name, 370, 132, 22, { color: '#fff', weight: 0.16 });
        text(ctx, `$${Math.floor(s.money)}`, 910, 132, { size: 18, weight: 800, color: '#9fe8b0', align: 'right' });
        list.forEach(([item, price], i) => {
          const y = 170 + i * 38;
          const on = i === sel;
          if (on) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(360, y - 24, 560, 34); }
          text(ctx, ITEMS[item] || item, 380, y, { size: 17, weight: on ? 800 : 600, color: on ? '#fff' : C.dim });
          text(ctx, `owned ${s.inv[item] || 0}`, 760, y, { size: 13, weight: 600, color: C.faint, align: 'right' });
          text(ctx, `$${price}`, 900, y, { size: 17, weight: 800, color: s.money >= price ? '#ffd166' : C.red, align: 'right' });
        });
        const y = 170 + list.length * 38;
        if (sel === list.length) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(360, y - 24, 560, 34); }
        text(ctx, 'Done', 380, y, { size: 17, weight: 700, color: C.dim });
        if (msg) text(ctx, msg, 640, y + 46, { size: 15, weight: 700, color: flash > 0 ? '#ffd166' : C.dim, align: 'center' });
        if (def.watched) text(ctx, 'Every purchase here is logged to your loyalty profile. Smile!', 640, y + 72, { size: 13, color: C.accent, align: 'center', italic: true });
        hints(ctx, [['ud', 'SELECT'], ['confirm', 'BUY'], ['back', 'LEAVE']]);
      },
    });
  }

  // -------------------------------------------------------------- jobs
  /** Run a paid job; resolves to dollars earned. */
  job(kind, opts = {}) {
    const p = this._job(kind, opts);
    if (!opts.hours) return p;
    return p.then((n) => { const s = this.G.state; s.hour = Math.min(23.5, s.hour + opts.hours); return n; });
  }

  _job(kind, opts = {}) {
    if (kind === 'store' || kind === 'shop') return this._till(kind, opts);
    if (kind === 'cannery') return this._cannery(opts);
    if (kind === 'radio') return this._radio(opts);
    if (kind === 'plow') return this.G.vehicles?.plowRoute ? this.G.vehicles.plowRoute(opts) : this._cannery({ ...opts, plowFallback: true });
    return Promise.resolve(0);
  }

  /** The till at Koshkin's: ring up baskets, make change. Running the store adds pricing and profit. */
  _till(kind, opts) {
    const G = this.G, s = G.state;
    const own = kind === 'shop';
    const goods = [['Milk', 4.5], ['Bread', 3.25], ['Coffee', 8.99], ['Eggs', 5.75], ['Batteries', 4.99], ['Matches', 0.99], ['Tea', 5.5], ['Canned salmon', 3.79], ['Flour', 6.25], ['Soup', 2.49], ['Candles', 1.99], ['Oranges', 7.5]];
    const names = ['Mrs. Ivanoff', 'a fisherman', 'Tommy', 'two kids', 'old Mr. Kaplan', 'a nurse from the clinic', 'Pearl', 'a cannery worker', 'Dolly', 'a man in a Northstar cap'];
    const nCust = opts.customers || (own ? 6 : 4);
    let markup = own ? (s.flags.storeMarkup ?? 1.0) : 1;
    const custs = [];
    for (let i = 0; i < nCust; i++) {
      const k = 1 + Math.floor(Math.random() * 3);
      const basket = [];
      for (let j = 0; j < k; j++) basket.push(goods[Math.floor(Math.random() * goods.length)]);
      custs.push({ who: names[Math.floor(Math.random() * names.length)], basket });
    }
    let i = 0, phase = own ? 'price' : 'ring', sel = 0, opts3 = [], earned = 0, right = 0, t = 0, fb = null, lost = 0;
    const total = (c) => Math.round(c.basket.reduce((a, b) => a + b[1], 0) * markup * 100) / 100;
    const makeOpts = () => {
      const tt = total(custs[i]);
      const set = new Set([tt.toFixed(2)]);
      while (set.size < 3) set.add((tt + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.floor(Math.random() * 4) + (Math.random() < 0.5 ? 0.25 : 0))).toFixed(2));
      opts3 = [...set].sort(() => Math.random() - 0.5);
      sel = 0;
    };
    makeOpts();
    return overlay(G, {
      update(dt, close) {
        t += dt;
        if (fb) { fb.t -= dt; if (fb.t <= 0) fb = null; return; }
        if (phase === 'price') {
          if (input.pressed('left')) markup = Math.max(0.85, +(markup - 0.05).toFixed(2));
          if (input.pressed('right')) markup = Math.min(1.4, +(markup + 0.05).toFixed(2));
          if (input.pressed('confirm') || input.pressed('interact')) { s.flags.storeMarkup = markup; phase = 'ring'; makeOpts(); }
          return;
        }
        if (phase === 'done') { if (input.pressed('confirm') || input.pressed('interact') || input.pressed('back')) close(Math.round(earned)); return; }
        if (input.pressed('up')) sel = (sel + 2) % 3;
        if (input.pressed('down')) sel = (sel + 1) % 3;
        for (let k = 0; k < 3; k++) if (input.pressed('choice' + (k + 1))) { sel = k; }
        if (input.pressed('confirm') || input.pressed('interact') || [1, 2, 3].some((k) => input.pressed('choice' + k))) {
          const tt = total(custs[i]);
          const ok = opts3[sel] === tt.toFixed(2);
          // Northstar undercutting: with a high markup, some customers walk out
          const walks = own && markup > 1.15 && Math.random() < (markup - 1.1) * 1.6;
          if (walks) { lost++; fb = { ok: false, t: 1.2, msg: `${custs[i].who} sighs and leaves — "Northstar's cheaper."` }; }
          else if (ok) { right++; earned += own ? tt * 0.35 : 0; fb = { ok: true, t: 0.9, msg: 'Correct — thank you, come again!' }; }
          else { fb = { ok: false, t: 1.2, msg: `Wrong total — it was $${tt.toFixed(2)}.` }; if (own) earned += tt * 0.25; }
          i++;
          if (i >= custs.length) {
            if (!own) earned = 45 + right * 12;
            phase = 'done';
          } else makeOpts();
        }
      },
      draw(ctx) {
        panel(ctx, 300, 110, 680, 420, { accentLen: 220 });
        vText(ctx, own ? "RUNNING KOSHKIN'S" : "THE TILL AT KOSHKIN'S", 330, 154, 22, { color: '#fff', weight: 0.16 });
        if (phase === 'price') {
          text(ctx, 'Set today\'s prices against NORTHSTAR 24 across the square.', 330, 200, { size: 16, color: '#e8f0e8' });
          text(ctx, `Markup: ${(markup * 100).toFixed(0)}%`, 640, 270, { size: 30, weight: 900, color: markup > 1.15 ? C.red : markup < 0.95 ? C.green : '#ffd166', align: 'center' });
          text(ctx, markup > 1.15 ? 'More profit per sale — but customers may walk to Northstar.' : markup < 0.95 ? 'Cheaper than Northstar. People will notice. Thin margins.' : 'Fair prices. Koshkin would approve.', 640, 310, { size: 15, color: C.dim, align: 'center' });
          hints(ctx, [['lr', 'ADJUST'], ['confirm', 'OPEN THE DOORS']]);
          return;
        }
        if (phase === 'done') {
          text(ctx, `Customers served: ${right} right${lost ? `, ${lost} lost to Northstar` : ''}.`, 330, 220, { size: 18, weight: 700, color: '#fff' });
          text(ctx, own ? `Profit today: $${Math.round(earned)}` : `Wages: $${Math.round(earned)}`, 330, 260, { size: 24, weight: 900, color: '#9fe8b0' });
          hints(ctx, [['confirm', 'CLOSE UP']]);
          return;
        }
        const c = custs[i];
        text(ctx, `Customer ${i + 1} of ${custs.length}: ${c.who}`, 330, 196, { size: 16, weight: 700, color: C.accent });
        c.basket.forEach(([n, p], k) => {
          text(ctx, n, 350, 234 + k * 28, { size: 18, weight: 600, color: '#e8f0e8' });
          text(ctx, `$${(p * markup).toFixed(2)}`, 620, 234 + k * 28, { size: 18, weight: 700, color: '#e8f0e8', align: 'right' });
        });
        text(ctx, 'Ring it up — which total?', 680, 214, { size: 15, color: C.dim });
        opts3.forEach((o, k) => {
          const y = 244 + k * 50;
          const on = k === sel;
          ctx.fillStyle = on ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)';
          roundRect(ctx, 680, y, 260, 40, 6); ctx.fill();
          actionGlyph(ctx, 'choice' + (k + 1), 692, y + 20, 10);
          text(ctx, `$${o}`, 820, y + 28, { size: 22, weight: 900, color: on ? '#fff' : C.dim, align: 'center' });
        });
        if (fb) text(ctx, fb.msg, 640, 500, { size: 16, weight: 700, color: fb.ok ? C.green : C.red, align: 'center' });
      },
    });
  }

  /** The cannery line: sort fish left (keep) or right (reject) as they pass. */
  _cannery(opts) {
    const G = this.G;
    const kinds = [['Silver salmon', 'left'], ['Pink salmon', 'left'], ['Halibut', 'left'], ['Pollock', 'left'], ['Damaged', 'right'], ['Bycatch crab', 'right'], ['Old boot', 'right']];
    let fish = [], t = 0, spawn = 0, score = 0, miss = 0, done = false, total = 0;
    const N = opts.plowFallback ? 14 : 22;
    return overlay(G, {
      update(dt, close) {
        t += dt;
        if (done) { if (input.pressed('confirm') || input.pressed('interact')) close(Math.round(30 + score * 3.2)); return; }
        spawn -= dt;
        if (spawn <= 0 && total < N) { spawn = Math.max(0.55, 1.3 - total * 0.03); fish.push({ k: kinds[Math.floor(Math.random() * kinds.length)], x: 0 }); total++; }
        for (const f of fish) f.x += dt * (0.22 + total * 0.004);
        const head = fish[0];
        if (head) {
          const want = head.k[1];
          if (input.pressed('left') || input.pressed('right')) {
            const got = input.pressed('left') ? 'left' : 'right';
            if (got === want) score++; else miss++;
            fish.shift();
          } else if (head.x > 1) { miss++; fish.shift(); }
        }
        if (total >= N && !fish.length) done = true;
      },
      draw(ctx) {
        panel(ctx, 260, 140, 760, 360, { accentLen: 220 });
        vText(ctx, opts.plowFallback ? 'SHOVELLING OUT THE ROUTE' : 'ZARYA SEAFOODS — THE LINE', 290, 184, 22, { color: '#fff', weight: 0.16 });
        ctx.fillStyle = '#20262c'; ctx.fillRect(290, 300, 700, 60);
        fish.forEach((f, i) => {
          const x = 290 + f.x * 700;
          ctx.fillStyle = i === 0 ? '#ffd166' : '#9ab';
          ctx.beginPath(); ctx.ellipse(x, 330, 34, 13, 0, 0, Math.PI * 2); ctx.fill();
          if (i === 0) text(ctx, f.k[0], x, 290, { size: 15, weight: 800, color: '#fff', align: 'center' });
        });
        text(ctx, '←  KEEP (salmon, halibut, pollock)', 300, 410, { size: 15, weight: 700, color: C.green });
        text(ctx, 'REJECT (damaged, bycatch, junk)  →', 980, 410, { size: 15, weight: 700, color: C.red, align: 'right' });
        text(ctx, `sorted ${score}  ·  mistakes ${miss}`, 640, 460, { size: 15, color: C.dim, align: 'center' });
        if (done) { text(ctx, `Shift over — $${Math.round(30 + score * 3.2)}`, 640, 250, { size: 26, weight: 900, color: '#9fe8b0', align: 'center' }); hints(ctx, [['confirm', 'CLOCK OUT']]); }
      },
    });
  }

  /** KZRY 88.9: callers ask for a mood; pick the record that fits. */
  _radio() {
    const G = this.G;
    const calls = [
      ['Hank, at the hardware store', 'something with a beat, I\'m stacking lumber', ['Truck-stop boogie', 'Slow lullaby', 'News hour']],
      ['A nurse at the clinic', 'something calm for the night shift', ['Aurora pads', 'Polka party', 'Static']],
      ['Two kids', 'the loudest song you have', ['Guitar storm', 'Choir hymn', 'Weather report']],
      ['Father Gabriel', 'anything but polka, please', ['Accordion polka', 'Old Russian folk song', 'Polka remix']],
      ['Lou at the Rusty Anchor', 'a sad song for sad drinkers', ['Lonely harbour waltz', 'Birthday song', 'Disco']],
    ];
    const answers = [0, 0, 0, 1, 0];
    let i = 0, sel = 0, score = 0, done = false;
    return overlay(G, {
      update(dt, close) {
        if (done) { if (input.pressed('confirm') || input.pressed('interact')) close(25 + score * 8); return; }
        if (input.pressed('up')) sel = (sel + 2) % 3;
        if (input.pressed('down')) sel = (sel + 1) % 3;
        if (input.pressed('confirm') || input.pressed('interact')) { if (sel === answers[i]) score++; i++; sel = 0; if (i >= calls.length) done = true; }
      },
      draw(ctx) {
        panel(ctx, 300, 140, 680, 380, { accentLen: 220 });
        vText(ctx, 'KZRY 88.9 — YOU\'RE ON THE AIR', 330, 184, 22, { color: '#fff', weight: 0.16 });
        if (done) { text(ctx, `Good show. Listeners happy: ${score}/${calls.length}. $${25 + score * 8}`, 640, 300, { size: 20, weight: 800, color: '#9fe8b0', align: 'center' }); hints(ctx, [['confirm', 'SIGN OFF']]); return; }
        const c = calls[i];
        text(ctx, `Caller: ${c[0]}`, 330, 230, { size: 17, weight: 800, color: C.accent });
        text(ctx, `"Play ${c[1]}."`, 330, 262, { size: 18, weight: 600, color: '#fff', italic: true });
        c[2].forEach((o, k) => {
          const y = 300 + k * 50;
          ctx.fillStyle = k === sel ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)';
          roundRect(ctx, 330, y, 620, 40, 6); ctx.fill();
          text(ctx, '♪  ' + o, 350, y + 27, { size: 18, weight: 700, color: k === sel ? '#fff' : C.dim });
        });
      },
    });
  }

  // -------------------------------------------------------------- repairs
  async repair(id) {
    const G = this.G, s = G.state;
    const R = (await import('../data/script/side_town.js')).REPAIRS?.[id];
    if (!R) { console.warn('unknown repair', id); return true; }
    if (s.repairs[id]) return true;
    const need = Object.entries(R.materials || {}).filter(([k, n]) => (s.inv[k] || 0) < n);
    if (need.length) {
      G.hud.toast('MATERIALS NEEDED', need.map(([k, n]) => `${ITEMS[k] || k} ×${n - (s.inv[k] || 0)}`).join(', '), '#ffb21e');
      return false;
    }
    for (const mg of R.minigames || ['hammer']) await G.minigames.run(mg, { title: R.name.toUpperCase() });
    for (const [k, n] of Object.entries(R.materials || {})) s.inv[k] -= n;
    s.repairs[id] = true;
    s.stats.repairs++;
    s.spirit += R.spirit || 5;
    if (R.pay) s.money += R.pay;
    G.hud.toast('FIXED', `${R.name}${R.pay ? `  +$${R.pay}` : ''}  ·  Town Spirit +${R.spirit || 5}`, '#ffd166');
    // the building looks better for every project done on it
    if (R.building && G.town.rebuild) {
      const REP = (await import('../data/script/side_town.js')).REPAIRS;
      const mine = Object.keys(REP).filter((rid) => REP[rid].building === R.building);
      const k = mine.filter((rid) => s.repairs[rid]).length / Math.max(1, mine.length);
      s.repairs['state:' + R.building] = Math.min(1, 0.2 + k * 0.8);
      G.town.rebuild(R.building, s.repairs['state:' + R.building]);
    }
    saveGame();
    return true;
  }
}
