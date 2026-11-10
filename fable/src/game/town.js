// Life in Huddle Hollow between adventures: rebuilding the town, the shop,
// game-day meals, resting / time of day, uniforms, decorating the clubhouse,
// the bus, the practice field's Route Lab, the arcade, and hanging out with
// teammates (which is how combo plays get unlocked).
import * as THREE from 'three';
import { G } from '../core/game.js';
import { el, clamp, rich, pick } from '../core/util.js';
import { CAST, charState, displayName, teamSpec, maxStamina } from '../data/cast.js';
import { ITEMS, DECOR, MEALS, FISH } from '../data/items.js';
import { ROUTE_TREE, getPlay } from '../data/plays.js';
import { MINIGAMES } from '../minigames/index.js';
import { playArt } from '../battle/hud.js';
import { portrait, clearPortraits } from '../art/portraits.js';
import { flag, setFlag, addCoins, addItem, addDecor, unlockPlay, restAll, save, startQuest, setQuestStage, finishQuest, questActive, questStage } from './state.js';

const S = () => G.S;
const say = (w, who, text) => w.say(who, text);
const narr = (t) => G.ui.say(null, t);

// ================================================================ rebuilding
export const PROJECTS = {
  clubhouse: { name: 'Patch up the Clubhouse', icon: '🏠', flag: 'clubhouse_fixed', levels: [{ coins: 40, parts: 1, desc: 'New roof, straight sign. Lets you decorate inside.' }] },
  diner: { name: 'Fix the Diner', icon: '🥞', levels: [{ coins: 60, parts: 2, desc: 'Game-day meals that boost the whole team, and a booth where teammates open up.' }] },
  field: { name: 'Renovate the Practice Field', icon: '🏈', levels: [{ coins: 80, parts: 3, desc: 'Fresh paint and the Route Lab: design your own plays and run free practice drives.' }] },
  arcade: { name: 'Reopen the Arcade', icon: '🕹️', levels: [{ coins: 90, parts: 3, desc: 'Replay every minigame you\'ve found, try the hard versions, and win prizes from Dot.' }] },
  stadium: { name: 'Restore the Stadium', icon: '🏟️', levels: [
    { coins: 150, parts: 6, desc: 'Unchain the gate. Visiting teams come for exhibition games; after dark you can chase the fuse-box hum.' },
    { coins: 300, parts: 12, desc: 'Lights, seats, vendors, new neighbors — and a field fit to host the Midnight Bowl.' },
  ] },
};
const level = (id) => (PROJECTS[id].flag ? (flag(PROJECTS[id].flag) ? 1 : 0) : S().town[id]);

export async function noticeBoard(w) {
  let built = false;
  await G.ui.panel({
    title: '📌 Town Notice Board', wide: true,
    build: (body, api) => {
      const draw = () => {
        body.innerHTML = '';
        body.append(el('p', { html: `Pin your winnings to a project and the town does the rest. You have <b>🪙 ${S().coins}</b> and <b>🔩 ${S().parts}</b>.` }));
        for (const [id, p] of Object.entries(PROJECTS)) {
          const lv = level(id);
          const next = p.levels[lv];
          const can = next && S().coins >= next.coins && S().parts >= next.parts;
          body.append(el(`div.card${next ? '' : '.sel'}`, { style: { margin: '0.4em 0', display: 'flex', gap: '0.8em', alignItems: 'center' } },
            el('div', { style: { fontSize: '2em' } }, p.icon),
            el('div.grow', el('div', { style: { fontWeight: 900 } }, `${p.name}${p.levels.length > 1 ? ` (${lv}/${p.levels.length})` : ''}`), el('div.tiny', next ? next.desc : 'Done! The town thanks you.')),
            next ? el(`button.btn.small.focusable${can ? '' : '.disabled'}`, { html: `🪙 ${next.coins} · 🔩 ${next.parts}`, onclick: () => {
              if (!can) { G.audio.sfx('deny'); return; }
              S().coins -= next.coins; S().parts -= next.parts;
              if (p.flag) setFlag(p.flag); else S().town[id]++;
              built = id;
              G.audio.sfx('recruit');
              api.close(true);
            } }) : el('span.tag', { style: { background: 'var(--leaf)' } }, 'BUILT')));
        }
      };
      draw();
    },
  });
  if (built) {
    const p = PROJECTS[built];
    await G.fadeOut();
    w.rebuild();
    await G.fadeIn();
    await G.ui.banner(`${p.icon} ${p.name}`, 'Hammers. Sawdust. One very excited Mayor.', { dur: 2, cls: 'small' });
    const lines = {
      clubhouse: 'The clubhouse stands up straight for the first time in years. Inside, you can now *decorate*: stand where you want something and use the menu prompt.',
      diner: 'The stove roars back to life. Maple is taking orders — *game-day meals* buff the whole team through your next rival match.',
      field: 'The practice field has lines again. Walk onto it to open the *Route Lab* or run a free practice drive.',
      arcade: 'The arcade lights flicker on, one cabinet at a time. Dot is beside herself.',
      stadium: S().town.stadium >= 2 ? 'The stadium is whole again. All it needs now is a game worth hosting.' : 'The gate swings open. The field inside is strangely tidy — as if someone has been mowing it at night.',
    };
    await narr(lines[built]);
    const all = S().town.diner + S().town.arcade + S().town.field + S().town.stadium;
    if (all >= 1) finishQuest('rebuild');
    if (built === 'stadium' && S().town.stadium === 1 && !questActive('lights')) startQuest('lights');
    if (built === 'stadium' && S().town.stadium >= 2 && S().quests.bowl) setQuestStage('bowl', 1);
    save();
  }
}

// ================================================================ shop
export async function shop(w) {
  if (!flag('nan_met')) { setFlag('nan_met'); await say(w, 'nan', 'Thistle & Son. There is no son. The sign was cheaper with the "& Son".'); }
  const stock = ['orange', 'drink', 'salts'];
  if (S().chapter >= 2) stock.push('gum', 'cider');
  if (S().town.stadium >= 2 || S().chapter >= 4) stock.push('cocoa');
  const decor = Object.entries(DECOR).filter(([id, d]) => d.price && !S().decor.owned.includes(id));
  await G.ui.panel({
    title: '🧺 Thistle & Son', wide: true,
    build: (body, api) => {
      const draw = (keep) => {
        body.innerHTML = '';
        body.append(el('p', { html: `You have <b>🪙 ${S().coins}</b>.` }));
        const fishN = Object.entries(S().fish).reduce((a, [id, n]) => a + n * (FISH[id] ? FISH[id].value : 0), 0);
        if (fishN > 0) body.append(el('button.btn.teal.focusable', { html: `🎣 Sell your catch (+${fishN} coins)`, onclick: () => { addCoins(fishN, true); S().fish = {}; G.audio.sfx('coin'); draw(); } }));
        body.append(el('h3', 'Snacks'));
        for (const id of stock) {
          const it = ITEMS[id];
          const can = S().coins >= it.price;
          body.append(el('div.card', { style: { display: 'flex', gap: '0.8em', alignItems: 'center', margin: '0.3em 0' } },
            el('div', { style: { fontSize: '1.6em' } }, it.icon), el('div.grow', el('div', { style: { fontWeight: 900 } }, `${it.name}${S().items[id] ? ` (have ${S().items[id]})` : ''}`), el('div.tiny', it.desc)),
            el(`button.btn.small.focusable${can ? '' : '.disabled'}${keep === id ? '.first' : ''}`, { html: `🪙 ${it.price}`, onclick: () => { if (!can) { G.audio.sfx('deny'); return; } S().coins -= it.price; addItem(id, 1, true); G.audio.sfx('coin'); draw(id); api.refocus('.first'); } })));
        }
        const left = decor.filter(([id]) => !S().decor.owned.includes(id));
        if (S().chapter >= 2 && left.length) {
          body.append(el('h3', { style: { marginTop: '0.7em' } }, 'For the clubhouse'));
          for (const [id, d] of left) {
            const can = S().coins >= d.price;
            body.append(el('div.card', { style: { display: 'flex', gap: '0.8em', alignItems: 'center', margin: '0.3em 0' } },
              el('div', { style: { fontSize: '1.6em' } }, d.icon), el('div.grow', { style: { fontWeight: 900 } }, d.name),
              el(`button.btn.small.focusable${can ? '' : '.disabled'}`, { html: `🪙 ${d.price}`, onclick: () => { if (!can) { G.audio.sfx('deny'); return; } S().coins -= d.price; addDecor(id, true); G.audio.sfx('coin'); draw(); } })));
          }
        }
      };
      draw();
    },
  });
  save();
}

// ================================================================ diner: meals
export async function dinerMenu(w) {
  const recipes = S().seen.recipes || [];
  const list = Object.entries(MEALS).filter(([id, m]) => !m.recipe || recipes.includes(id));
  let bought = null;
  await G.ui.panel({
    title: '🥞 Game-Day Menu',
    build: (body, api) => {
      body.append(el('p', { html: `One meal at a time; it lasts through your <b>next rival match</b>. You have <b>🪙 ${S().coins}</b>.${S().meal ? ` Current: <b>${S().meal.name}</b>.` : ''}` }));
      for (const [id, m] of list) {
        const can = S().coins >= m.price;
        body.append(el('div.card', { style: { display: 'flex', gap: '0.8em', alignItems: 'center', margin: '0.3em 0' } },
          el('div', { style: { fontSize: '1.7em' } }, m.icon), el('div.grow', el('div', { style: { fontWeight: 900 } }, m.name), el('div.tiny', m.desc)),
          el(`button.btn.small.focusable${can ? '' : '.disabled'}`, { html: `🪙 ${m.price}`, onclick: () => { if (!can) { G.audio.sfx('deny'); return; } S().coins -= m.price; S().meal = { id, name: m.name, desc: m.desc, stat: m.stat, amt: m.amt }; bought = m; G.audio.sfx('item'); api.close(true); } })));
      }
      const locked = Object.values(MEALS).filter((m) => m.recipe).length - recipes.length;
      if (locked > 0) body.append(el('p.muted.tiny', `${locked} more recipe${locked > 1 ? 's' : ''} out there — word is the snack shack crowd trades them.`));
    },
  });
  if (bought) { restAll(); await say(w, 'maple', `One ${bought.name}! Eat up. Uncle Waffle says you play how you chew.`); save(); }
}

// ================================================================ bed: rest + time of day
export async function bed(w) {
  const opts = ['Just a nap (restore stamina)'];
  const free = S().chapter >= 2;
  if (free) opts.push('Sleep until morning ☀️', 'Sleep until sunset 🌇', 'Sleep until night 🌙');
  opts.push('Never mind');
  const p = await G.ui.choose(null, free ? 'The cot creaks invitingly. The town moves on your schedule — rest until whenever you like.' : 'The cot creaks invitingly.', opts, { cancel: opts.length - 1 });
  if (p === opts.length - 1) return;
  const tod = free ? [S().tod, 'day', 'dusk', 'night'][p] : S().tod;
  await G.fadeOut();
  restAll();
  S().tod = tod;
  G.audio.sfx('item');
  w.rebuild();
  save();
  await G.fadeIn();
  G.ui.toast(p === 0 ? '😴 Everyone feels rested.' : `😴 Rested. It's now ${tod === 'day' ? 'morning' : tod === 'dusk' ? 'sunset' : 'night'}.`);
}

// ================================================================ uniforms
const PALETTE = ['#f08a24', '#d4502f', '#c8452d', '#8a2f3a', '#ffd45a', '#f2b632', '#6aa84f', '#3f7a52', '#2a6f77', '#58b8c9', '#3f6fb5', '#2a3a6a', '#8a5aa8', '#5a3f8a', '#3b2148', '#2b1a33', '#fff4dc', '#ffffff', '#c9d2da', '#6a7480'];
export async function uniforms(w) {
  const t = S().team;
  await G.ui.panel({
    title: '👕 Uniform Locker', wide: true,
    build: (body, api) => {
      const img1 = el('img.creator-face'), img2 = el('img.creator-face');
      const refresh = () => {
        clearPortraits('uni:');
        img1.src = portrait(`uni:c${Math.random()}`, teamSpec('captain'));
        img2.src = portrait(`uni:w${Math.random()}`, teamSpec(S().roster.includes('waffle') ? 'waffle' : 'captain'));
      };
      const rows = [['jersey', 'Jersey'], ['helmet', 'Helmet'], ['stripe', 'Helmet stripe'], ['pants', 'Pants'], ['trim', 'Collar trim']];
      const col = el('div.col.grow');
      for (const [key, label] of rows) {
        col.append(el('div.lbl', label), el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.25em' } }, PALETTE.map((c) => el('button.focusable', {
          style: { width: '1.9em', height: '1.9em', borderRadius: '0.5em', border: `0.18em solid ${t[key] === c ? 'var(--maple)' : 'var(--ink)'}`, background: c },
          dataset: { k: key, c },
          onclick: (e) => { t[key] = c; G.audio.sfx('ok'); for (const b of col.querySelectorAll(`[data-k="${key}"]`)) b.style.borderColor = b.dataset.c === c ? 'var(--maple)' : 'var(--ink)'; refresh(); void e; },
        }))));
      }
      if (S().costumes.length) {
        col.append(el('div.lbl', 'Sideline mascot'), el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.3em' } }, S().costumes.map((c) => el(`button.card.focusable.mc${(S().mascot || S().costumes[S().costumes.length - 1]) === c ? '.sel' : ''}`, { text: c, style: { padding: '0.1em 0.7em', fontWeight: 800, textTransform: 'capitalize' }, onclick: (e) => { S().mascot = c; G.audio.sfx('ok'); for (const b of col.querySelectorAll('.mc')) b.classList.toggle('sel', b === e.currentTarget); } }))));
      }
      body.append(el('div.creator', el('div.col.center', img1, img2), col));
      refresh();
    },
  });
  clearPortraits('cast:');
  w.rebuild();
  save();
}

// ================================================================ decorating
export async function decorate(w) {
  if (!flag('clubhouse_fixed')) { await narr('The clubhouse is barely holding its own walls up. Patch it at the *notice board* first, then you can decorate.'); return; }
  const owned = S().decor.owned;
  if (!owned.length) { await narr('Nothing to put out yet. Nan sells furniture, and trophies come from winning.'); return; }
  const p = w.leader;
  let changed = false;
  await G.ui.panel({
    title: '🛋️ Decorate', build: (body, api) => {
      body.append(el('p', 'Pick something and it goes right where you\'re standing. Pick a placed item to put it away.'));
      for (const id of owned) {
        const d = DECOR[id];
        const placed = S().decor.placed.find((x) => x.id === id);
        body.append(el(`button.card.focusable${placed ? '.sel' : ''}`, { style: { display: 'flex', gap: '0.8em', alignItems: 'center', margin: '0.3em 0', width: '100%', textAlign: 'left' }, onclick: () => {
          if (placed) S().decor.placed = S().decor.placed.filter((x) => x.id !== id);
          else S().decor.placed.push({ id, x: clamp(Math.round(p.x * 2) / 2, 1.2, 14.8), z: clamp(Math.round((p.z - (d.flat ? 0 : 1.2)) * 2) / 2, 2.4, 9.6), r: 0 });
          changed = true;
          G.audio.sfx('item');
          api.close(true);
        } }, el('div', { style: { fontSize: '1.6em' } }, d.icon), el('div.grow', { style: { fontWeight: 900 } }, d.name), el('span.tiny.muted', placed ? 'placed — tap to put away' : 'place here')));
      }
    },
  });
  if (changed) { w.rebuild(); save(); }
}

// ================================================================ the bus
export const DESTS = [
  { id: 'hollow', name: 'Huddle Hollow', at: [69, 33.5], flag: null, blurb: 'Home.' },
  { id: 'fair', name: 'Harvest Fairgrounds', at: null, flag: 'bus_fair', blurb: 'Corn mazes, carnival games, and the Haymakers.' },
  { id: 'frost', name: 'Frostbite Falls', at: null, flag: 'bus_frost', blurb: 'Frozen rivers make fine passing lanes.' },
  { id: 'neon', name: 'Neon Boardwalk', at: null, flag: 'bus_neon', blurb: 'An abandoned indoor arena that still hums.' },
];
export async function travel(w) {
  const here = w.areaId;
  const open = DESTS.filter((d) => d.id !== here && (!d.flag || flag(d.flag)));
  if (!open.length) { await say(w, 'gus', 'Nowhere to go yet. The bus knows. It always knows.'); return; }
  const lines = { hollow: 'Home? Home it is. Mind the step; it minds you.', fair: 'Harvest Fairgrounds. Smells like kettle corn and bad decisions.', frost: 'Frostbite Falls. Heater\'s broken. Has been since the eighties. Bundle up.', neon: 'Neon Boardwalk. Lights are on, nobody\'s home, and the arcade keeps score anyway.' };
  const names = open.map((d) => `${d.name}`);
  names.push('Stay here');
  const p = await G.ui.choose('gus', 'Where to, Captain?', names, { cancel: names.length - 1 });
  if (p === names.length - 1) return;
  const d = open[p];
  await say(w, 'gus', lines[d.id]);
  if (d.id === 'fair') setQuestStage('welcome_back', 3);
  if (d.id === 'fair' && questActive('welcome_back')) { finishQuest('welcome_back'); startQuest('fair'); }
  if (d.id === 'frost' && !S().quests.frost) startQuest('frost');
  if (d.id === 'neon' && !S().quests.neon) startQuest('neon');
  await w.goto(d.id, d.at ? d.at[0] : undefined, d.at ? d.at[1] : undefined, { sfx: 'door' });
}

// ================================================================ practice field: Route Lab + free drive
export async function practice(w) {
  const p = await G.ui.choose(null, 'The practice field. Lines painted, dummies standing at attention.', ['✏️ Route Lab (design a play)', '🏈 Practice drive (no stamina, no rewards)', 'Leave'], { cancel: 2 });
  if (p === 0) await routeLab(w);
  if (p === 1) {
    const before = {};
    for (const id of S().roster) before[id] = charState(id).st;
    await G.hooks.battle({ team: 'dishpit', kind: 'drive', side: 'off', venue: 'practice', start: 15, noRewards: true, tod: 'day' });
    for (const id of S().roster) charState(id).st = before[id];
  }
}

async function routeLab(w) {
  const slots = S().customPlays;
  const st = { name: `Custom ${slots.length + 1}`, routes: { WR1: 'post', WR2: 'drag', BACK: 'flat' } };
  const done = await G.ui.panel({
    title: '✏️ Route Lab', wide: true,
    build: (body, api) => {
      const art = el('div', { style: { width: '16em' } });
      const redraw = () => {
        const tmp = { ...st, id: '_tmp' };
        const saved = S().customPlays;
        S().customPlays = [...saved, tmp];
        const pl = getPlay('_tmp', S());
        S().customPlays = saved;
        art.innerHTML = ''; const c = playArt(pl, 'off'); c.style.width = '100%'; c.style.borderRadius = '0.6em'; art.append(c);
        for (const b of body.querySelectorAll('.rt')) b.classList.toggle('sel', st.routes[b.dataset.who] === b.dataset.r);
      };
      const col = el('div.col.grow');
      const who = { WR1: 'Top receiver (1)', WR2: 'Bottom receiver (2)', BACK: 'Back (3)' };
      for (const k of ['WR1', 'WR2', 'BACK']) {
        col.append(el('div.lbl', who[k]), el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.3em' } }, Object.entries(ROUTE_TREE).map(([rid, r]) => el('button.card.rt.focusable', { text: r.name, dataset: { who: k, r: rid }, style: { padding: '0.15em 0.6em', fontWeight: 800 }, onclick: () => { st.routes[k] = rid; G.audio.sfx('ok'); redraw(); } }))));
      }
      const name = el('input.text-in', { type: 'text', maxlength: 16, value: st.name });
      name.addEventListener('input', () => { st.name = name.value.trim() || 'Custom'; });
      col.append(el('div.lbl', 'Name'), name, el('div.row', { style: { marginTop: '0.6em' } },
        el('button.btn.focusable', { text: 'Save to playbook', onclick: () => api.close(true) }),
        slots.length ? el('button.btn.alt.small.focusable', { text: `Erase "${slots[slots.length - 1].name}"`, onclick: () => { slots.pop(); G.audio.sfx('back'); api.close(false); } }) : null));
      body.append(el('div.creator', art, col));
      redraw();
    },
  });
  if (done) {
    if (slots.length >= 3) slots.shift();
    slots.push({ id: `custom_${Date.now() % 100000}`, name: st.name, routes: { ...st.routes } });
    G.audio.sfx('quest');
    G.ui.toast(`📋 <b>${st.name}</b> added to the playbook`);
    save();
  }
}

// ================================================================ arcade
const FOUND = { blitz: 'mg_found_blitz', snack: 'mg_found_snack', golf: 'mg_found_golf', mascot: 'mg_found_mascot', lights: 'mg_found_lights' };
export async function arcadeGame(w, id) {
  const def = MINIGAMES[id];
  const best = S().best[id] || {};
  const opts = ['Play', 'Play HARD mode', 'Walk away'];
  const p = await G.ui.choose(null, `${def.icon} *${def.title}*${best.normal !== undefined ? ` — your best: ${best.normal}` : ''}${best.hard !== undefined ? ` (hard: ${best.hard})` : ''}`, opts, { cancel: 2 });
  if (p === 2) return;
  if (p === 1 && !(best.medal >= 2)) { await narr('The HARD switch is taped down. A note reads: "Earn a silver medal first. — Dot"'); return; }
  setFlag(FOUND[id] || `mg_found_${id}`);
  await G.hooks.minigame(id, { hard: p === 1 });
  save();
}

const PRIZES = [
  { need: 3, decor: 'cabinet', text: '3 medals: an Arcade Cabinet for the clubhouse' },
  { need: 6, decor: 'jukebox', text: '6 medals: the old Jukebox' },
  { need: 9, item: ['cocoa', 3], text: '9 medals: three Thermoses of Cocoa' },
  { need: 12, decor: 'dummy', text: '12 medals: a Tackling Dummy' },
];
export async function prizes(w) {
  let medals = 0;
  for (const id of Object.keys(MINIGAMES)) { const m = (S().best[id] || {}).medal || 0; medals += Math.min(3, m) + Math.max(0, m - 3); }
  await say(w, 'dot', `Prize counter! You've earned *${medals} medal points* across my machines. Hard-mode medals count double-ish.`);
  let any = false;
  for (const pz of PRIZES) {
    const key = `prize_${pz.need}`;
    if (medals >= pz.need && !flag(key)) {
      setFlag(key); any = true;
      if (pz.decor) addDecor(pz.decor);
      if (pz.item) addItem(pz.item[0], pz.item[1]);
      await say(w, 'dot', `${pz.text}. You earned it. Mostly.`);
    }
  }
  const next = PRIZES.find((pz) => !flag(`prize_${pz.need}`));
  if (!any) await say(w, 'dot', next ? `Next prize at ${next.need}: ${next.text.split(': ')[1]}.` : 'You\'ve cleaned me out. I\'m proud and financially devastated.');
  save();
}

// ================================================================ Backyard Blitz (Acorn twins)
export async function blitzTwins(w) {
  if (S().chapter < 1) { await say(w, 'nutmeg', 'We\'re the Acorn twins! We play *Backyard Blitz*: two on two, sprinklers on, no crying! Come back when you\'ve got a teammate who can catch.'); return; }
  const best = S().best.blitz;
  const p = await G.ui.choose('nutmeg', best ? 'Rematch? Clove\'s been practicing her mean face.' : 'Backyard Blitz! Two on two, first to three touchdowns, sprinklers stay ON. You in?', ['Play!', 'Play HARD mode', 'Later'], { cancel: 2 });
  if (p === 2) return;
  if (p === 1 && !((best || {}).medal >= 2)) { await say(w, 'clove', 'Hard mode is for people who\'ve beaten us properly. Get a silver first.'); return; }
  setFlag('mg_found_blitz');
  const res = await G.hooks.minigame('blitz', { hard: p === 1 });
  if (res && res.won) await say(w, 'nutmeg', 'Okay, okay! You can have one of our *trick plays*. Don\'t tell the gnomes.');
  else if (res && !res.quit) await say(w, 'clove', 'Told you. Mean face.');
  save();
}

// ================================================================ stadium gate + fuse box
export async function stadiumGate(w) {
  const t = S().town;
  if (t.stadium < 1) {
    await narr('A heavy chain. Through the bars: rows of empty bleachers, and a field somebody has kept suspiciously tidy.');
    if (flag('board_open')) await narr('The *notice board* in the square has a project for this.');
    return;
  }
  await w.goto('stadium', 30, 37);
}
export async function fuseBox(w) {
  if (S().town.stadium < 1) { await narr('A fuse box, rusted shut. Something inside it is humming a fight song.'); return; }
  if (S().tod !== 'night') { await narr('The fuse box hums quietly. Whatever tends it only comes out *after dark*. (Sleep at the clubhouse to change the time.)'); return; }
  const p = await G.ui.choose(null, 'The fuse box is warm. Inside the stadium, a lantern bobs between the bleachers.', ['Sneak in and fix the lights (Midnight Maintenance)', 'HARD mode', 'Not tonight'], { cancel: 2 });
  if (p === 2) return;
  if (p === 1 && !((S().best.lights || {}).medal >= 2)) { await narr('Better learn the route first. (Earn a silver medal to unlock hard mode.)'); return; }
  setFlag('mg_found_lights');
  const res = await G.hooks.minigame('lights', { hard: p === 1 });
  if (res && res.medal) { finishQuest('lights'); if (!flag('wick_seen')) { setFlag('wick_seen'); await say(w, 'hollow', 'That\'s *Wick*. Team mascot. Clockwork, lantern for a head. He\'s been trying to get these lights back on since the night they went out.'); await say(w, 'hollow', 'He doesn\'t mean any harm. He just takes "no cleats on the grass" extremely seriously.'); } }
  save();
}

// ================================================================ hangouts → friendships → combo plays
const HANG = {
  pip: [
    ['pip', 'I practice throwing at the water tower. It can\'t tackle me. That\'s the whole reason.'],
    ['pip', 'When I play dead, I actually think about soup. It helps. Tomato. It\'s very calming.'],
    ['pip', 'I think I\'m less scared when you\'re in the huddle. Don\'t tell Coach. He\'ll make it a drill.'],
  ],
  zip: [
    ['zip', 'Do you ever just run somewhere and forget why? I do that. I\'ve been to the next town twice by accident.'],
    ['zip', 'People think I talk because I\'m not listening. I\'m listening. I\'m just also talking. It\'s called efficiency.'],
    ['zip', 'You never tell me to slow down. Everybody tells me to slow down. I noticed. That\'s all. Okay bye. I\'m still here.'],
  ],
  waffle: [
    ['waffle', 'Blocking\'s like cooking. You stand in one place and refuse to let things burn.'],
    ['waffle', 'My grandmother played line for the Lanterns. She once blocked a truck. The truck apologized.'],
    ['waffle', 'You eat like a bird, Captain. I\'m putting an extra stack on your tab. The tab is imaginary. The stack is not.'],
  ],
  june: [
    ['june', '...The porch light at the clubhouse is the warm kind. I like the warm kind.'],
    ['june', 'Everyone watches the ball. I watch the quarterback\'s shoulders. Shoulders can\'t lie.'],
    ['june', 'I used to play alone. Under the stadium lights, before they went out. ...This is better.'],
  ],
  hollow: [
    ['hollow', 'Fifty-one seasons I\'ve waited to finish one kick. You\'d think I\'d have my steps down by now.'],
    ['hollow', 'The Captain before you? Sharp. Stubborn. Left-footed. Laughed like a kazoo. You\'ve got the same eyebrows.'],
    ['hollow', 'I won\'t say I\'m proud of you. Ghosts don\'t have feelings. We have *contracts.* ...The contract is very proud of you.'],
  ],
  cheese: [
    ['cheese', 'The wedge stays on. I don\'t ask what\'s under your helmet.'],
    ['cheese', 'I was a mascot for a team that folded. Then a mascot for nobody. That\'s just a guy in cheese. Now I\'m a fullback in cheese. It\'s an upgrade.'],
    ['cheese', 'If we win the big one, I\'ll take it off. ...I won\'t. But I\'ll think about it.'],
  ],
  slush: [
    ['slush', 'Walking is just sliding with extra steps. Literally.'],
    ['slush', 'Back home the whole river was ours till the Flurries started charging admission.'],
    ['slush', 'You\'re warm. All of you. It\'s weird. I\'m getting used to it.'],
  ],
  sal: [
    ['sal', 'I don\'t steal. I *redistribute.* Mostly fries.'],
    ['sal', 'An interception is just a fry that was going to somebody else.'],
    ['sal', 'I\'ve had my eye on that trophy case. Relax. I mean I want to help fill it.'],
  ],
};
const PAIRS = [
  { ids: ['pip', 'zip'], play: 'no_look', quest: 'argue', scene: async (w) => {
    await say(w, 'zip', 'You threw it BEHIND me. I was already where I was going to be! You have to throw it where I\'m going to be going to be!');
    await say(w, 'pip', 'I threw it where you WERE because that\'s where you were when I looked! Then you weren\'t! That\'s not my fault, that\'s physics!');
    const p = await G.ui.choose(null, 'They both look at you.', ['"Pip, don\'t look at her at all."', '"Zip, tell him before you cut."']);
    if (p === 0) { await say(w, 'pip', 'Don\'t... look? Just throw it at where she\'ll be and stare at somebody else like I\'ve got a secret?'); await say(w, 'zip', 'That\'s the most suspicious thing I\'ve ever heard. I love it.'); }
    else { await say(w, 'zip', 'Tell him? Out loud? In front of defenders? ...Or with my ears. I could do an ear thing. Left ear, I go left.'); await say(w, 'pip', 'And I pretend I didn\'t see it. And look at Waffle instead. Everyone looks at Waffle.'); }
    await narr('Pip and Zip worked out the *No-Look Pass*. It\'s in the playbook whenever both are in the squad.');
  } },
  { ids: ['waffle', 'captain'], play: 'pancake_stack', scene: async (w) => {
    await say(w, 'waffle', 'You keep running *around* me, Captain. Run *behind* me. I\'m a door. Wait for the door to open.');
    await say(w, 'waffle', 'One hand on my jersey. When the first one goes down, count to one. Then there\'s a second one. Then there isn\'t.');
    await narr('Waffle taught you the *Pancake Stack*. It\'s in the playbook whenever both of you are in the squad.');
  } },
  { ids: ['june', 'zip'], play: 'flutter', scene: async (w) => {
    await say(w, 'zip', 'June. June! How do you change direction like that? You go left-right-left and the defender falls over. I\'ve been asking for a week.');
    await say(w, 'june', '...You asked forty times in a week.');
    await say(w, 'june', 'Don\'t run at the lamp. Run at where the lamp makes you dizzy. Then don\'t be there.');
    await say(w, 'zip', 'That made no sense and I understood it completely.');
    await narr('June and Zip invented the *Porch Light Flutter*. It\'s in the playbook whenever both are in the squad.');
  } },
];

export async function hangout(w, id) {
  const cs = charState(id);
  const lines = HANG[id] || [[id, '...']];
  // a pair scene takes priority once both friends know you well enough
  for (const pr of PAIRS) {
    if (!pr.ids.includes(id) || S().plays.includes(pr.play)) continue;
    const other = pr.ids.find((x) => x !== id);
    const ok = pr.ids.every((x) => x === 'captain' || (S().roster.includes(x) && charState(x).bond >= 1));
    if (ok && S().roster.includes(other === 'captain' ? 'captain' : other)) {
      await pr.scene(w);
      unlockPlay(pr.play);
      for (const x of pr.ids) if (x !== 'captain') charState(x).bond = Math.min(3, charState(x).bond + 1);
      if (pr.quest) { if (!S().quests[pr.quest]) startQuest(pr.quest, 2); finishQuest(pr.quest); }
      save();
      return;
    }
  }
  const n = cs.hang || 0;
  if (n < lines.length) {
    await say(w, lines[n][0], lines[n][1]);
    cs.hang = n + 1;
    if (cs.bond < 3) { cs.bond++; G.audio.sfx('levelup'); G.ui.toast(`♥ You and <b>${displayName(id)}</b> are closer.`); }
    save();
  } else {
    const small = { pip: 'Soup. Still thinking about soup.', zip: 'Race you to the— okay I already won.', waffle: 'Eat something.', june: '...', hollow: 'Drink water. I can\'t, but you should.', cheese: 'The wedge abides.', slush: 'Wheee. Quietly.', sal: 'You gonna finish that?' };
    await say(w, id, small[id] || '...');
  }
}

/** Put the rest of the roster around the clubhouse as people to hang out with. */
export function loungers(w) {
  const party = w._partyIds();
  const rest = S().roster.filter((id) => !party.includes(id));
  const spots = [[5.4, 6.4, 1.2], [10.6, 6.6, -1.2], [12.6, 4.4, -0.6], [6.4, 8.6, 0.6]];
  rest.slice(0, spots.length).forEach((id, i) => {
    const [x, z, f] = spots[i];
    w.npc(`home_${id}`, x, z, { spec: teamSpec(id), name: displayName(id), face: f, speaker: id, label: `Hang out with ${displayName(id)}`, talk: () => hangout(w, id), mark: hangMark(id) });
  });
}
function hangMark(id) {
  const cs = charState(id);
  return (cs.hang || 0) < (HANG[id] || []).length ? '♥' : null;
}

/** Talk to a teammate who is following you (menu → "Chat"). */
export async function chatWithParty(w) {
  const party = w._partyIds().filter((id) => id !== 'captain');
  if (!party.length) return;
  const names = party.map((id) => `${displayName(id)}${hangMark(id) ? ' ♥' : ''}`);
  names.push('Never mind');
  const p = await G.ui.choose(null, 'Who do you want to talk to?', names, { cancel: names.length - 1 });
  if (p === names.length - 1) return;
  await hangout(w, party[p]);
}

export function install() {
  const H = G.hooks;
  H.board = noticeBoard; H.shop = shop; H.diner = dinerMenu; H.bed = bed; H.uniforms = uniforms; H.decorate = decorate;
  H.travel = travel; H.practice = practice; H.arcadeGame = arcadeGame; H.prizes = prizes; H.blitzTwins = blitzTwins;
  H.stadiumGate = stadiumGate; H.fuseBox = fuseBox; H.loungers = loungers; H.chat = chatWithParty;
  H.fish = (w) => G.hooks.minigame('fishing', { night: G.S.tod === 'night' }).then(() => save());
}

export { THREE, rich, pick, CAST, maxStamina, questStage };
