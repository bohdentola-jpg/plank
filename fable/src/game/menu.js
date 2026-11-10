// The pause menu: team sheet, the two squads, playbook, bag, quests & notes, settings.
import { G } from '../core/game.js';
import { el, clamp, rich } from '../core/util.js';
import { CAST, ABILITIES, GEAR, charState, statsOf, maxStamina, displayName, teamSpec, xpToNext, fitSquad, OFF_SLOTS, DEF_SLOTS, autoSquads, normalizeSquads } from '../data/cast.js';
import { ITEMS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { CLUES } from '../data/clues.js';
import { PLAYS, DEF_PLAYS, STARTER_PLAYS, STARTER_DEF, getPlay } from '../data/plays.js';
import { playArt } from '../battle/hud.js';
import { portrait } from '../art/portraits.js';
import { save, addItem, healChar, flag } from './state.js';
import { clearSave } from '../core/save.js';

let cssDone = false;
function css() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
.menu-card { width:min(64em,96vw); height:min(40em,88vh); }
.menu-card .panel-body { flex:1; }
.roster { display:grid; grid-template-columns:repeat(auto-fill,minmax(8.6em,1fr)); gap:0.5em; }
.rc { text-align:center; padding:0.4em 0.3em; cursor:pointer; }
.rc img { width:4.2em; height:4.2em; border-radius:50%; background:var(--gold); border:0.16em solid var(--ink); }
.rc .nm { font-weight:900; } .rc .lv { font-size:0.78em; font-weight:800; opacity:0.75; }
.detail { margin-top:0.7em; padding:0.6em 0.8em; background:#fffaf0; border:0.18em solid var(--ink); border-radius:1em; }
.detail h3 { margin:0; font-size:1.25em; } .detail .ti { font-weight:800; color:var(--maple); font-size:0.85em; }
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:0.2em 0.9em; margin:0.4em 0; font-weight:800; font-size:0.9em; }
.stats span b { float:right; }
.sqcols { display:grid; grid-template-columns:1fr 1fr; gap:0.8em; }
.sqcol { background:#fffaf0; border:0.18em solid var(--ink); border-radius:1em; padding:0.5em 0.7em 0.7em; }
.sqcol h3 { display:flex; justify-content:space-between; align-items:center; }
.sqm { display:flex; align-items:center; gap:0.5em; width:100%; margin:0.25em 0; padding:0.2em 0.5em; text-align:left; cursor:pointer; }
.sqm img { width:2.3em; height:2.3em; border-radius:50%; background:var(--gold); border:0.12em solid var(--ink); }
.sqm .pos { margin-left:auto; font-size:0.74em; font-weight:900; opacity:0.75; text-align:right; }
.pbgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(11em,1fr)); gap:0.5em; }
.pb { padding:0.35em 0.45em; } .pb canvas { width:100%; border-radius:0.5em; display:block; }
.pb .pn { font-weight:900; } .pb .pd { font-size:0.78em; font-weight:700; line-height:1.2; opacity:0.85; }
.pb.locked { opacity:0.55; filter:grayscale(0.6); }
.bagrow { display:flex; align-items:center; gap:0.7em; margin:0.3em 0; padding:0.35em 0.7em; }
.bagrow .grow { font-weight:800; } .bagrow .d { font-size:0.8em; font-weight:700; opacity:0.8; }
.qrow { margin:0.35em 0; padding:0.4em 0.8em; } .qrow.done { opacity:0.55; }
.qrow .qt { font-weight:900; } .qrow .qs { font-weight:700; font-size:0.9em; }
.vol { display:flex; align-items:center; gap:0.6em; margin:0.35em 0; font-weight:900; }
.vol .bar { width:12em; }
`;
  document.head.appendChild(s);
}

const face = (id) => portrait(`cast:${id}:m${G.S.team.jersey}${G.S.team.helmet}${id === 'captain' ? G.S.captain.species : ''}`, teamSpec(id));
const STAT_LABEL = { spd: 'Speed', str: 'Strength', hnd: 'Hands', arm: 'Arm', agi: 'Agility', kick: 'Kick' };

export function openMenu(world, startTab = 'team') {
  css();
  const S = G.S;
  G.audio.sfx('page');
  return G.ui.panel({
    title: '📒 Team Binder', cls: 'menu-card', wide: true,
    build: (body, api) => {
      const tabs = [['team', '🧑‍🤝‍🧑 Team'], ['squads', '🔄 Squads'], ['plays', '📋 Playbook'], ['bag', '🎒 Bag'], ['quests', '📜 Quests'], ['opts', '⚙️ Options']];
      const bar = el('div.tabs');
      const page = el('div');
      body.append(bar, page);
      let cur = startTab;
      const show = (id) => {
        cur = id;
        bar.innerHTML = '';
        for (const [tid, label] of tabs) bar.append(el(`button.tab.focusable${tid === cur ? '.on' : ''}`, { text: label, onclick: () => { G.audio.sfx('page'); show(tid); api.refocus('.tab.on'); } }));
        page.innerHTML = '';
        PAGES[id](page, { show: () => show(cur), api, world });
      };
      show(startTab);
    },
  }).then(() => { save(); if (world && world.refreshParty) world.refreshParty(); });
}

const PAGES = {
  // ------------------------------------------------------------ team sheet
  team(page, ctx) {
    const S = G.S;
    const grid = el('div.roster');
    const detail = el('div.detail');
    const showChar = (id) => {
      const c = CAST[id], cs = charState(id), st = statsOf(id);
      const ab = ABILITIES[c.ability];
      detail.innerHTML = '';
      const gearBtn = el('button.btn.small.alt.focusable', { html: cs.gear ? `${GEAR[cs.gear].icon} ${GEAR[cs.gear].name}` : '＋ Equip gear', onclick: () => pickGear(id).then(() => showChar(id)) });
      detail.append(
        el('div.row.spread', el('div', el('h3', displayName(id)), el('div.ti', c.title)), el('div.tag', `Lv ${cs.lv}`)),
        el('p', c.bio),
        el('div.row', el('span', { style: { fontWeight: 800 } }, `Stamina ${Math.round(cs.st)}/${st.sta}`), el(`div.bar.grow${cs.st / st.sta < 0.2 ? '.low' : cs.st / st.sta < 0.5 ? '.mid' : ''}`, el('i', { style: { width: `${clamp(cs.st / st.sta, 0, 1) * 100}%` } }))),
        el('div.row', el('span', { style: { fontWeight: 800 } }, `XP ${cs.xp}/${xpToNext(cs.lv)}`), el('div.bar.grow', el('i', { style: { width: `${clamp(cs.xp / xpToNext(cs.lv), 0, 1) * 100}%`, background: 'var(--sky)' } }))),
        el('div.stats', Object.keys(STAT_LABEL).map((k) => el('span', STAT_LABEL[k], el('b', String(Math.round(st[k] * 10) / 10))))),
        el('p', { html: `<b>${ab.icon} ${ab.name}</b> (${ab.cost} stamina) — ${ab.desc}` }),
        el('div.row', el('span', { style: { fontWeight: 800 } }, 'Gear:'), gearBtn, el('span.muted.tiny', `Friendship ${'♥'.repeat(cs.bond)}${'♡'.repeat(Math.max(0, 3 - cs.bond))}`)));
    };
    for (const id of S.roster) {
      const cs = charState(id);
      const card = el('button.card.rc.focusable', { onclick: () => showChar(id) }, el('img', { src: face(id) }), el('div.nm', displayName(id)), el('div.lv', `Lv ${cs.lv} · ${CAST[id].role}`));
      card.addEventListener('focused', () => showChar(id));
      grid.append(card);
    }
    page.append(grid, detail);
    showChar(S.roster[0]);
  },

  // ------------------------------------------------------------ squads
  squads(page, ctx) {
    const S = G.S;
    normalizeSquads();
    const cols = el('div.sqcols');
    for (let q = 0; q < 2; q++) {
      const ids = S.squads[q];
      const off = fitSquad(ids, OFF_SLOTS), def = fitSquad(ids, DEF_SLOTS);
      const col = el('div.sqcol', el('h3', `Squad ${q + 1}`, el('span.tiny', `${S.offSquad === q ? '🏈 OFFENSE ' : ''}${S.defSquad === q ? '🛡️ DEFENSE' : ''}`)));
      ids.forEach((id, i) => {
        col.append(el('button.card.sqm.focusable', { onclick: () => swapMember(q, i).then(ctx.show) },
          el('img', { src: face(id) }), el('span', { style: { fontWeight: 900 } }, displayName(id)),
          el('span.pos', { html: `off: ${OFF_SLOTS[off.indexOf(id)] || '—'}<br>def: ${DEF_SLOTS[def.indexOf(id)] || '—'}` })));
      });
      col.append(el('div.row', { style: { marginTop: '0.4em' } },
        el(`button.btn.small.focusable${S.offSquad === q ? '' : '.alt'}`, { text: 'Use on offense', onclick: () => { S.offSquad = q; G.audio.sfx('ok'); ctx.show(); } }),
        el(`button.btn.small.focusable${S.defSquad === q ? '' : '.alt'}`, { text: 'Use on defense', onclick: () => { S.defSquad = q; G.audio.sfx('ok'); ctx.show(); } })));
      cols.append(col);
    }
    page.append(
      el('p', 'Two prepared squads. One takes the field on offense, one on defense — and you can swap them in any huddle to rest tired legs. Squad 1 follows you around town.'),
      cols,
      el('div.row', { style: { marginTop: '0.6em' } }, el('button.btn.small.alt.focusable', { text: '✨ Auto-arrange', onclick: () => { autoSquads(); delete S.flags.squads_custom; G.audio.sfx('ok'); ctx.show(); } })));
  },

  // ------------------------------------------------------------ playbook
  plays(page) {
    const S = G.S;
    const have = new Set([...STARTER_PLAYS, ...S.plays, ...S.customPlays.map((p) => p.id)]);
    const grid = el('div.pbgrid');
    const all = [...new Set([...STARTER_PLAYS, ...S.plays, ...S.customPlays.map((p) => p.id), 'hollow_dive', 'possum_trot', 'flea_flicker', 'hook_ladder', 'statue', 'no_look', 'pancake_stack', 'flutter'])];
    for (const id of all) {
      const p = getPlay(id, S);
      if (!p) continue;
      const got = have.has(id);
      const how = p.combo ? `Friendship: ${p.combo.map((c) => CAST[c].name).join(' + ')}` : p.trick ? 'Prize from Backyard Blitz' : 'Keep playing to learn it';
      grid.append(el(`div.card.pb${got ? '' : '.locked'}`, playArt(p, 'off'), el('div.pn', `${p.icon || ''} ${got ? p.name : '???'}`), el('div.pd', got ? p.desc : how)));
    }
    const dgrid = el('div.pbgrid');
    const dhave = new Set([...STARTER_DEF, ...S.defPlays]);
    for (const [id, p] of Object.entries(DEF_PLAYS)) {
      const got = dhave.has(id);
      dgrid.append(el(`div.card.pb${got ? '' : '.locked'}`, playArt(p, 'def'), el('div.pn', `${p.icon} ${got ? p.name : '???'}`), el('div.pd', got ? p.desc : 'Learned from a rival coach')));
    }
    page.append(el('h3', 'Offense'), grid, el('h3', { style: { marginTop: '0.8em' } }, 'Defense'), dgrid);
  },

  // ------------------------------------------------------------ bag
  bag(page, ctx) {
    const S = G.S;
    const ids = Object.keys(S.items).filter((id) => ITEMS[id]);
    if (!ids.length) page.append(el('p.muted', 'Empty. Nan Thistle sells snacks in town, and beaten opponents sometimes drop them.'));
    for (const id of ids) {
      const it = ITEMS[id];
      const usable = it.heal || it.healAll;
      page.append(el('div.card.bagrow', el('div', { style: { fontSize: '1.6em' } }, it.icon), el('div.grow', `${it.name} ×${S.items[id]}`, el('div.d', it.desc)),
        usable ? el('button.btn.small.focusable', { text: 'Use', onclick: () => useItem(id).then(ctx.show) }) : el('span.tiny.muted', 'Use in a huddle')));
    }
    if (S.gear.length) {
      page.append(el('h3', { style: { marginTop: '0.8em' } }, 'Gear'));
      for (const g of S.gear) { const who = S.roster.find((r) => charState(r).gear === g); page.append(el('div.card.bagrow', el('div', { style: { fontSize: '1.6em' } }, GEAR[g].icon), el('div.grow', GEAR[g].name, el('div.d', GEAR[g].desc)), el('span.tiny.muted', who ? `worn by ${displayName(who)}` : 'not equipped'))); }
    }
    const fish = Object.entries(S.fish).filter(([, n]) => n > 0);
    if (fish.length) page.append(el('p.muted', `🎣 Fish in the cooler: ${fish.reduce((a, [, n]) => a + n, 0)} (sell them to Nan).`));
    if (S.meal) page.append(el('p', { html: `🍽️ Game-day meal: <b>${S.meal.name}</b> — ${S.meal.desc} (lasts through your next rival match)` }));
  },

  // ------------------------------------------------------------ quests + notes
  quests(page) {
    const S = G.S;
    for (const id of S.questLog.slice().reverse()) {
      const q = S.quests[id], def = QUESTS[id];
      if (!def) continue;
      const text = q.done ? 'Complete.' : (typeof def.text === 'function' ? def.text(q.stage, S) : def.steps[Math.min(q.stage, def.steps.length - 1)]);
      page.append(el(`div.card.qrow${q.done ? '.done' : ''}`, el('div.qt', `${def.main ? '★ ' : ''}${def.title}${q.done ? ' ✓' : ''}`), el('div.qs', text)));
    }
    const clues = S.seen.clues || [];
    if (clues.length) {
      page.append(el('h3', { style: { marginTop: '0.8em' } }, '🗒️ Notes from the stadium'));
      for (const i of clues) page.append(el('div.card.qrow', el('div.qt', CLUES[i].title), el('div.qs', CLUES[i].text)));
    }
    const rivals = [['gnomes', 'Cul-de-Sac Gnomes'], ['haymakers', 'Harvest Haymakers'], ['flurries', 'Falls Flurries'], ['buzzers', 'Boardwalk Buzzers']];
    page.append(el('h3', { style: { marginTop: '0.8em' } }, '🏆 Road to the Midnight Bowl'), el('div.row', rivals.map(([k, n]) => el('span.tag', { style: { background: S.wins[k] ? 'var(--leaf)' : 'var(--ink)' } }, `${S.wins[k] ? '✓' : '○'} ${n}`))));
  },

  // ------------------------------------------------------------ options
  opts(page, ctx) {
    const S = G.S;
    for (const [k, label] of [['master', 'Volume'], ['music', 'Music'], ['sfx', 'Sound FX']]) {
      const fill = el('i', { style: { width: `${S.settings[k] * 100}%` } });
      const set = (d) => { S.settings[k] = clamp(Math.round((S.settings[k] + d) * 10) / 10, 0, 1); G.audio.setVolume(k, S.settings[k]); fill.style.width = `${S.settings[k] * 100}%`; G.audio.sfx('ok'); };
      page.append(el('div.vol', el('span', { style: { width: '6em' } }, label), el('button.btn.small.alt.focusable', { text: '−', onclick: () => set(-0.1) }), el('div.bar', fill), el('button.btn.small.alt.focusable', { text: '+', onclick: () => set(0.1) })));
    }
    const mins = Math.floor(S.playTime / 60);
    page.append(
      el('p.muted', `Play time: ${Math.floor(mins / 60)}h ${mins % 60}m · The game saves at benches, doors and after every drive.`),
      el('div.row', { style: { marginTop: '0.6em' } },
        el('button.btn.focusable', { text: '💾 Save now', onclick: () => save(false) }),
        el('button.btn.alt.focusable', { text: 'Quit to title', onclick: async () => { if (await G.ui.confirm('Save and go back to the title screen?')) { save(); ctx.api.close(); location.reload(); } } })),
      el('div', { style: { marginTop: '1em' }, html: `
        <p><b>Exploring:</b> ${G.ui.key('move')} move · ${G.ui.key('b')} run · ${G.ui.key('a')} talk/use · ${G.ui.key('x')} throw the football · ${G.ui.key('menu')} this binder</p>
        <p><b>Offense:</b> ${G.ui.key('a')} on HIKE · ${G.ui.key('t1')}${G.ui.key('t2')}${G.ui.key('t3')} throw · ${G.ui.key('a')} as the rings meet to catch · then ${G.ui.key('a')} juke, ${G.ui.key('b')} spin, ${G.ui.key('y')} lateral</p>
        <p><b>Defense:</b> ${G.ui.key('move')} steer the blue-ring defender · ${G.ui.key('a')} dive tackle / pick off a pass · ${G.ui.key('y')} switch defender</p>` }));
  },
};

function swapMember(q, slot) {
  const S = G.S;
  return G.ui.panel({
    title: `Squad ${q + 1}: who plays here?`, cls: 'small',
    build: (body, api) => {
      for (const id of S.roster) {
        const inSquad = S.squads[q].includes(id);
        body.append(el(`button.card.sqm.focusable${S.squads[q][slot] === id ? '.sel' : ''}`, { onclick: () => {
          const cur = S.squads[q][slot];
          if (inSquad) { const j = S.squads[q].indexOf(id); S.squads[q][j] = cur; }
          S.squads[q][slot] = id;
          S.flags.squads_custom = true;
          G.audio.sfx('ok');
          api.close(true);
        } }, el('img', { src: face(id) }), el('span', { style: { fontWeight: 900 } }, displayName(id)), el('span.pos', `${CAST[id].role}${inSquad ? ' · in squad' : ''}`)));
      }
    },
  });
}

function pickGear(id) {
  const S = G.S;
  const cs = charState(id);
  return G.ui.panel({
    title: `Gear for ${displayName(id)}`, cls: 'small',
    build: (body, api) => {
      if (!S.gear.length) body.append(el('p.muted', 'No gear yet. Minigame prizes and hidden corners have some.'));
      body.append(el('button.card.bagrow.focusable', { onclick: () => { cs.gear = null; api.close(true); } }, el('div.grow', 'Nothing')));
      for (const g of S.gear) {
        const who = S.roster.find((r) => charState(r).gear === g);
        body.append(el(`button.card.bagrow.focusable${cs.gear === g ? '.sel' : ''}`, { onclick: () => { if (who && who !== id) charState(who).gear = null; cs.gear = g; cs.st = Math.min(cs.st, maxStamina(id)); G.audio.sfx('item'); api.close(true); } },
          el('div', { style: { fontSize: '1.5em' } }, GEAR[g].icon), el('div.grow', GEAR[g].name, el('div.d', GEAR[g].desc)), who && who !== id ? el('span.tiny.muted', `on ${displayName(who)}`) : null));
      }
    },
  });
}

function useItem(itemId) {
  const S = G.S;
  const it = ITEMS[itemId];
  if (it.healAll) { for (const id of S.roster) healChar(id, it.healAll); addItem(itemId, -1, true); G.audio.sfx('item'); G.ui.toast(`${it.icon} Everyone perks up.`); return Promise.resolve(); }
  return G.ui.panel({
    title: `${it.icon} Who gets it?`, cls: 'small',
    build: (body, api) => {
      for (const id of S.roster) {
        const cs = charState(id), mx = maxStamina(id);
        body.append(el('button.card.sqm.focusable', { onclick: () => { healChar(id, it.heal); addItem(itemId, -1, true); G.audio.sfx('item'); api.close(true); } }, el('img', { src: face(id) }), el('span', { style: { fontWeight: 900 } }, displayName(id)), el('span.pos', `${Math.round(cs.st)}/${mx}`)));
      }
    },
  });
}

export function install() {
  G.hooks.menu = openMenu;
}

export { rich, flag, clearSave, PLAYS };
