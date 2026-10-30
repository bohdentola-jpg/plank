// ME: your streak and milestones, Signal's jobs, today's drops, and the full
// collection (owned items in color, the rest as mystery silhouettes).
import { el, openOverlay, xButton } from './dom.js';
import { drawFigurePortrait } from '../art/figure.js';
import { ITEMS, itemById, RARITIES, RARITY_ORDER, SLOTS, SLOT_NAMES, SHOPS, sourceOf } from '../data/items.js';
import { STREAK, TICKETS, FREEZE_COST } from '../data/content.js';
import * as E from '../systems/econ.js';
import * as D from '../systems/daily.js';
import { wipe, storageWorks } from '../systems/save.js';
import * as audio from '../audio.js';
import { toast } from './hud.js';
import { itemImage, rarityChip, fmt, priceTag } from './shop.js';

let api = { closet: () => {}, goShop: () => {} };
export function initMe(a) { api = { ...api, ...a }; }

function stat(k, v) { return el('div', { class: 'stat' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, v)); }

function calendar() {
  const st = E.S.streak;
  const today = D.dayKey();
  const checked = new Set(E.S.checkins);
  const cal = el('div', { class: 'cal' });
  const pos = st.last === today ? (st.count - 1) % 7 : (E.streakPreview().next - 1) % 7;
  for (let i = 0; i < 7; i++) {
    const key = D.addDays(today, i - pos);
    const R = STREAK[i];
    cal.append(el('div', { class: `cal-day${checked.has(key) ? ' done' : ''}${key === today ? ' today' : ''}` },
      el('span', {}, `DAY ${i + 1}`),
      el('b', {}, `+${R.tokens}`),
      el('span', {}, R.ticket ? (R.ticket === 'epic' ? 'EPIC TICKET' : 'TICKET') : D.weekdayName(key))));
  }
  return cal;
}

export function openMe(tab = 'me') {
  openOverlay('me', (panel, close) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const face = el('canvas', { class: 'panel-portrait', width: Math.round(96 * dpr), height: Math.round(96 * dpr), 'aria-hidden': 'true' });
    drawFigurePortrait(face, E.S.profile.body, E.outfitOf(), { t: 0.3 });
    const head = el('div', { class: 'panel-head' }, face,
      el('div', { style: { minWidth: '0' } },
        el('h2', { class: 'panel-title' }, E.S.profile.name || 'RIDER'),
        el('p', { class: 'panel-sub' }, `Drip score ${fmt(E.dripScore())} · ${fmt(E.S.tokens)} tokens`)));
    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    const body = el('div', { class: 'panel-body' });
    panel.append(head, tabs, body, xButton(close));
    const TABS = [['me', 'STREAK'], ['jobs', 'JOBS'], ['collection', 'COLLECTION'], ['settings', 'SETTINGS']];
    const select = (id) => {
      tab = id;
      [...tabs.children].forEach((b) => b.setAttribute('aria-selected', b.dataset.id === id ? 'true' : 'false'));
      body.innerHTML = '';
      body.scrollTop = 0;
      VIEWS[id]();
    };
    for (const [id, label] of TABS) {
      const b = el('button', { type: 'button', class: 'tab', role: 'tab', 'data-id': id, 'aria-selected': 'false' }, label);
      b.addEventListener('click', () => { audio.click(); select(id); });
      tabs.append(b);
    }

    const VIEWS = {
      me() {
        const st = E.S.streak;
        const next = E.nextMilestone();
        const col = E.collection();
        body.append(...[
          el('div', { class: 'section-h' }, st.count > 0 ? `🔥 ${st.count}-DAY STREAK` : 'NO STREAK YET'),
          el('p', { class: 'note' }, E.canCheckIn() ? 'You haven’t punched in today. Find Signal in the front car.' : 'Punched in today. Come back tomorrow to keep it alive.'),
          calendar(),
          next ? el('div', { class: 'milestone' },
            el('b', {}, `DAY ${next.day}`),
            el('span', {}, next.reward.item ? `${itemById[next.reward.item].name} (${RARITIES[itemById[next.reward.item].rarity].name}, only from this streak)` : `${TICKETS[next.reward.ticket].name}`),
            el('em', {}, `${next.left} day${next.left === 1 ? '' : 's'} to go`)) : null,
          el('div', { class: 'row', style: { marginTop: '12px' } },
            el('span', { class: 'note' }, `Streak freezes: ${st.freezes}/2 (each covers a missed day) · Best streak: ${st.best}`),
            el('button', {
              type: 'button', class: 'btn btn-sm btn-sun', disabled: st.freezes >= 2 || E.S.tokens < FREEZE_COST,
              onclick: () => {
                const r = E.buyFreeze();
                if (r.err) { toast(r.err, 'hot'); audio.beepBad(); return; }
                audio.register();
                toast('STREAK FREEZE ADDED ❄', 'cash');
                select('me');
              },
            }, `BUY A FREEZE · ${FREEZE_COST}`)),
          el('div', { class: 'stat-row' },
            stat('TOKENS', fmt(E.S.tokens)),
            stat('EARNED ALL-TIME', fmt(E.S.lifetime)),
            stat('ITEMS', `${col.owned}/${col.total}`),
            stat('MYTHICS', `${col.by.mythic[0]}/${col.by.mythic[1]}`),
            stat('PRISMATICS', String(col.prismatic)),
            stat('CAPSULES PULLED', fmt(E.S.pulls)),
            stat('TICKETS', `${E.S.tickets.basic + E.S.tickets.epic + E.S.tickets.legendary}`),
            stat('SECRETS', `${Object.values(E.S.secrets).filter(Boolean).length}/4`))].filter(Boolean));
      },
      jobs() {
        E.track('drops');
        const list = el('div', { class: 'list' });
        for (const j of E.jobs()) {
          list.append(el('div', { class: `mission${j.done ? ' done' : ''}` },
            el('span', { class: 'ck' }, j.done ? '✓' : ''),
            el('div', { style: { minWidth: '0' } },
              el('div', { class: 'mt' }, j.def.text),
              j.def.goal > 1 ? el('div', { class: 'bar' }, el('i', { style: { width: `${Math.round((j.progress / j.def.goal) * 100)}%` } })) : null),
            el('span', { class: 'mr' }, `+${j.def.reward}`)));
        }
        body.append(el('div', { class: 'section-h' }, 'TODAY’S JOBS'), list,
          el('p', { class: 'note' }, E.allJobsDone() ? (E.S.day.jobsClaimed ? 'All done. Signal paid up.' : 'All three done! Talk to Signal in the front car for your bonus and this week’s secret word.') : 'Finish all three for a bonus, a capsule ticket, and a secret word that opens a certain door.'),
          el('p', { class: 'note' }, `New jobs in ${D.fmtCountdown(D.msToMidnight())}.`));
        // today's drops
        body.append(el('div', { class: 'section-h' }, 'TODAY’S DROPS'));
        const grid = el('div', { class: 'drops' });
        const drop = E.dropOfDay();
        for (const sid of E.SHOP_CARS) {
          const f = E.stock(sid).find((r) => r.featured);
          if (!f) continue;
          const b = el('button', { type: 'button', class: `drop-card r-${f.item.rarity}` },
            el('img', { src: itemImage(f.item, 120), alt: '' }),
            el('span', { class: 'drop-shop', style: { color: SHOPS[sid].color } }, SHOPS[sid].name),
            el('span', { class: 'drop-name' }, f.item.name),
            rarityChip(f.item.rarity),
            priceTag(f.price, f.was),
            drop.shop === sid ? el('span', { class: 'badge deal' }, 'DROP OF THE DAY') : null);
          b.addEventListener('click', () => { close(); api.goShop(sid, f.item.id); });
          grid.append(b);
        }
        body.append(grid);
      },
      collection() {
        const col = E.collection();
        body.append(el('div', { class: 'coll-sum' }, ...RARITY_ORDER.map((r) => el('span', { class: `rchip r-${r}` }, `${RARITIES[r].name} ${col.by[r][0]}/${col.by[r][1]}`))));
        for (const slot of SLOTS) {
          const items = ITEMS.filter((i) => i.slot === slot).sort((a, b) => RARITIES[a.rarity].rank - RARITIES[b.rarity].rank);
          body.append(el('div', { class: 'section-h' }, SLOT_NAMES[slot], el('small', {}, ` ${items.filter((i) => E.owns(i.id)).length}/${items.length}`)));
          const grid = el('div', { class: 'coll-grid' });
          for (const it of items) {
            const own = E.owns(it.id);
            const prism = own && E.isPrismatic(it.id);
            grid.append(el('div', { class: `coll r-${it.rarity}${own ? ' have' : ' missing'}${prism ? ' prism' : ''}`, title: own ? it.name : sourceOf(it) },
              el('img', { src: itemImage(it, 120, prism), alt: own ? it.name : 'Not found yet' }),
              el('span', { class: 'coll-name' }, own ? it.name : '???'),
              el('em', {}, own ? RARITIES[it.rarity].name : sourceOf(it))));
          }
          body.append(grid);
        }
      },
      settings() {
        if (!storageWorks()) body.append(el('p', { class: 'note warn' }, 'This browser is blocking storage, so progress resets when you leave. Open the game in a regular browser tab to keep your streak.'));
        body.append(el('p', { class: 'note' }, 'Your progress is saved in this browser on this device.'));
        const reset = el('button', { type: 'button', class: 'btn btn-ghost' }, 'RESET ALL PROGRESS');
        reset.addEventListener('click', () => {
          if (reset.dataset.armed) {
            wipe();
            location.reload();
          } else {
            reset.dataset.armed = '1';
            reset.textContent = 'TAP AGAIN TO ERASE EVERYTHING';
            reset.classList.add('armed');
          }
        });
        body.append(reset);
      },
    };
    select(tab);
  }, { label: 'Your stats' });
}
