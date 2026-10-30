// Your stash: profile + streak calendar, the Operator's jobs, the sticker
// book, pockets (coupons, keys, freezes, token exchange) and orders.
import { el, openOverlay, panelHead, xButton } from './dom.js';
import { drawRat } from '../art/critters.js';
import { stickerImage } from '../art/stickers.js';
import { STICKERS, STICKER_PAGES, STREAK_REWARDS, EXCHANGE } from '../data/content.js';
import { money } from '../config.js';
import * as E from '../systems/econ.js';
import * as D from '../systems/daily.js';
import { wipe, storageWorks } from '../systems/save.js';
import * as audio from '../audio.js';
import { toast } from './hud.js';

let api = { editLook: () => {} };
export function initStash(a) { api = { ...api, ...a }; }

function calendar() {
  const st = E.S.streak;
  const today = D.dayKey();
  const checked = new Set(E.S.checkins);
  const cal = el('div', { class: 'cal' });
  // center the week on the current cycle position
  const pos = st.last === today ? (st.count - 1) % 7 : (E.streakPreview().next - 1) % 7;
  for (let i = 0; i < 7; i++) {
    const key = D.addDays(today, i - pos);
    const R = STREAK_REWARDS[i];
    const done = checked.has(key);
    cal.append(el('div', { class: `cal-day${done ? ' done' : ''}${key === today ? ' today' : ''}` },
      el('span', {}, `DAY ${i + 1}`),
      el('b', {}, `+${R.tokens}`),
      el('span', {}, R.key ? 'KEY?' : R.sticker ? 'STICKER' : D.weekdayName(key))));
  }
  return cal;
}

async function shareStreak() {
  const st = E.S.streak;
  const name = E.S.profile?.name || 'A rat';
  const url = location.href.split('#')[0].split('?')[0];
  const text = `${name} is on a ${st.count}-day streak at 3RD RAIL, the shop under the city. ${E.stickerCount()}/${STICKERS.length} stickers, ${Object.values(E.S.secrets).filter(Boolean).length}/4 secrets found. Can you find the ghost train?`;
  // copy first, while we're still inside the tap (clipboard needs that), then try the share sheet
  const copied = navigator.clipboard ? navigator.clipboard.writeText(`${text} ${url}`).then(() => true, () => false) : Promise.resolve(false);
  if (navigator.share) {
    try {
      await navigator.share({ title: '3RD RAIL', text, url });
      return;
    } catch { /* refused or cancelled: the copy still happened */ }
  }
  if (await copied) toast('Copied. Paste it anywhere.', 'cash');
  else toast(text, '', 7000);
}

function stat(k, v) { return el('div', { class: 'stat' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, v)); }

export function openStash(tab = 'me') {
  openOverlay('stash', (panel, close) => {
    const name = E.S.profile?.name || 'NEW RAT';
    const head = panelHead(name, 'Your stash: streak, jobs, stickers, pockets, orders.');
    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    const body = el('div', { class: 'panel-body' });
    panel.append(head, tabs, body, xButton(close));
    let raf = 0;
    const TABS = [['me', 'ME'], ['jobs', 'JOBS'], ['stickers', 'STICKERS'], ['pockets', 'POCKETS'], ['orders', 'ORDERS']];
    const select = (id) => {
      cancelAnimationFrame(raf);
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
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cv = el('canvas', { width: 220 * dpr, height: 220 * dpr, style: { width: '140px', height: '140px', background: 'var(--panel-3)', borderRadius: '16px 20px 14px 18px', border: '3px solid var(--ink)' }, 'aria-hidden': 'true' });
        const g = cv.getContext('2d');
        const loop = (ms) => {
          const t = ms / 1000;
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.clearRect(0, 0, cv.width, cv.height);
          g.setTransform(cv.width / 220 * 1.55, 0, 0, cv.width / 220 * 1.55, cv.width * 0.48, cv.height * 0.9);
          drawRat(g, 0, 0, { t, look: E.S.profile, blink: (t % 3) < 0.12 ? 1 : 0, boil: 11 + (Math.floor(t * 7) % 3) * 101 });
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        const st = E.S.streak;
        body.append(
          el('div', { class: 'row', style: { alignItems: 'flex-start' } }, cv,
            el('div', { style: { flex: '1 1 220px', minWidth: '0' } },
              el('div', { class: 'section-h', style: { marginTop: 0 } }, `🔥 ${st.count}-DAY STREAK`),
              el('p', { class: 'note' }, E.canCheckIn() ? 'You haven’t swiped in today. Shelly is waiting at the Token Booth in Token Sq.' : 'Swiped in today. Come back tomorrow to keep it going.'),
              el('p', { class: 'note' }, `Streak freezes: ${st.freezes} / 2 · Best streak: ${st.best}`),
              el('div', { class: 'row' },
                el('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: () => { close(); api.editLook(); } }, 'EDIT YOUR LOOK'),
                el('button', { type: 'button', class: 'btn btn-sm btn-hot', onclick: shareStreak }, 'SHARE MY STREAK')))),
          el('div', { class: 'label' }, 'THIS WEEK'),
          calendar(),
          el('div', { class: 'stat-row' },
            stat('TOKENS', E.S.tokens.toLocaleString('en-US')),
            stat('EARNED ALL-TIME', E.S.lifetime.toLocaleString('en-US')),
            stat('STICKERS', `${E.stickerCount()}/${STICKERS.length}`),
            stat('SECRETS FOUND', `${Object.values(E.S.secrets).filter(Boolean).length}/4`),
            stat('BEST TAG', E.S.bests.tagGrade || '—'),
            stat('RAT RACE BEST', E.S.bests.runner ? `${E.S.bests.runner}m` : '—')),
        );
        if (!storageWorks()) body.append(el('p', { class: 'note', style: { color: 'var(--hot)' } }, 'This browser is blocking storage, so progress resets when you leave. Open the store in a regular browser tab to keep your streak.'));
        const reset = el('button', { type: 'button', class: 'link-btn' }, 'Reset all progress on this device');
        reset.addEventListener('click', () => {
          if (reset.dataset.armed) {
            wipe();
            location.reload();
          } else {
            reset.dataset.armed = '1';
            reset.textContent = 'Tap again to erase everything (tokens, streak, stickers, orders)';
            reset.style.color = 'var(--hot)';
          }
        });
        body.append(el('div', { style: { marginTop: '18px' } }, reset));
      },
      jobs() {
        const ms = E.missions();
        body.append(el('p', { class: 'note' }, E.S.day.opHeard ? 'Today’s jobs from the voice on the phone. Rewards pay out the moment you finish.' : 'The phone booth at Token Sq is ringing. Pick up to hear today’s jobs. (They’re already counting.)'));
        const list = el('div', { class: 'list' });
        for (const m of ms) {
          list.append(el('div', { class: `mission${m.done ? ' done' : ''}` },
            el('span', { class: 'ck' }, m.done ? '✓' : ''),
            el('div', { style: { minWidth: '0' } },
              el('div', { class: 'mt' }, m.def.text),
              m.def.goal > 1 ? el('div', { class: 'bar' }, el('i', { style: { width: `${Math.round((m.progress / m.def.goal) * 100)}%` } })) : null),
            el('span', { class: 'mr' }, `+${m.def.reward}`)));
        }
        body.append(list);
        const all = E.allMissionsDone();
        body.append(el('p', { class: 'note', style: { marginTop: '14px' } },
          all ? (E.S.day.opClaimed ? 'All done today. The caller paid up.' : 'All three done. Go answer the phone at Token Sq — the caller has a bonus and a secret for you.')
            : 'Finish all three for a bonus, a sticker, and this week’s Back Room password.'));
        body.append(el('p', { class: 'note' }, `New jobs in ${D.fmtCountdown(D.msToMidnight())}.`));
      },
      stickers() {
        for (const page of STICKER_PAGES) {
          const list = STICKERS.filter((s) => s.page === page.id);
          const have = list.filter((s) => E.S.stickers[s.id]).length;
          body.append(el('div', { class: 'section-h' }, `${page.name} · ${have}/${list.length}`, el('span', { class: 'badge', style: { marginLeft: 'auto' } }, E.S.pagesClaimed[page.id] ? `CLAIMED: ${page.reward.label}` : `FILL IT: ${page.reward.label}`)));
          const book = el('div', { class: 'book' });
          for (const s of list) {
            const own = E.S.stickers[s.id];
            book.append(el('div', { class: `stk ${own ? 'have' : 'missing'}` },
              el('img', { src: stickerImage(s, 144), alt: own ? s.name : 'Missing sticker' }),
              el('span', {}, own ? s.name.toUpperCase() : '???'),
              !own && s.hint ? el('em', {}, s.hint) : own > 1 ? el('em', {}, `×${own}`) : null));
          }
          body.append(book);
        }
        body.append(el('p', { class: 'note', style: { marginTop: '14px' } }, 'Stickers come from your daily streak, The Grabber, finishing jobs, top grades in the minigames, and the secret stores.'));
      },
      pockets() {
        body.append(el('div', { class: 'section-h', style: { marginTop: 0 } }, 'COUPONS'));
        if (E.S.coupons.length) {
          const list = el('div', { class: 'list' });
          for (const c of E.S.coupons) list.append(el('div', { class: 'coupon' }, el('span', {}, c.label), el('small', {}, c.src ? `from ${c.src}` : '')));
          body.append(list);
        } else body.append(el('p', { class: 'note' }, 'No coupons. Trade tokens below, or win one from The Grabber.'));
        if (E.S.golden) body.append(el('div', { class: 'coupon', style: { marginTop: '10px', background: 'var(--sun)' } }, el('span', {}, 'GOLDEN FARE CARD'), el('small', {}, '10% off forever')));
        body.append(el('div', { class: 'section-h' }, 'KEYS + TICKETS'));
        const keys = [];
        if (E.S.keys.maint) keys.push(['MAINTENANCE KEY', 'Opens a certain door at Bodega Blvd.']);
        if (E.S.ghostTicket) keys.push(['GHOST TICKET', 'Your next train will be… different.']);
        keys.push([`STREAK FREEZES · ${E.S.streak.freezes}/2`, 'Each one covers a missed day.']);
        const kl = el('div', { class: 'list' });
        for (const [k, v] of keys) kl.append(el('div', { class: 'coupon', style: { background: 'var(--panel-2)', color: 'var(--cream)', borderColor: 'var(--cream)' } }, el('span', {}, k), el('small', { style: { color: 'var(--muted)' } }, v)));
        body.append(kl);
        body.append(el('div', { class: 'section-h' }, `TOKEN EXCHANGE · ${E.S.tokens.toLocaleString('en-US')} TOKENS`));
        const ex = el('div', { class: 'list' });
        for (const item of EXCHANGE) {
          const b = el('button', { type: 'button', class: 'btn btn-sm btn-go', disabled: E.S.tokens < item.cost }, `${item.cost} TOKENS`);
          b.addEventListener('click', () => {
            const r = E.exchange(item.id);
            if (r.err) { toast(r.err, 'hot'); audio.beepBad(); return; }
            audio.register();
            toast(`GOT IT: ${item.label.toUpperCase()}`, 'cash');
            select('pockets');
          });
          ex.append(el('div', { class: 'coupon', style: { background: 'var(--panel-2)', color: 'var(--cream)', borderStyle: 'solid', borderColor: 'var(--ink)' } }, el('span', { style: { font: '18px var(--f-hand)' } }, item.label), b));
        }
        body.append(ex);
      },
      orders() {
        if (!E.S.orders.length) {
          body.append(el('div', { class: 'empty' }, 'No orders yet. Your fare cards will show up here.'));
          return;
        }
        const list = el('div', { class: 'list' });
        for (const o of E.S.orders) {
          list.append(el('div', { class: 'mission' },
            el('span', { class: 'ck' }, '✓'),
            el('div', { style: { minWidth: '0' } },
              el('div', { class: 'mt' }, `${o.id} · ${new Date(o.date).toLocaleDateString()}`),
              el('div', { class: 'note' }, o.items.map((i) => `${i.qty}× ${i.name}`).join(', '))),
            el('span', { class: 'mr' }, money(o.total))));
        }
        body.append(list, el('p', { class: 'note', style: { marginTop: '12px' } }, 'Demo orders live on this device only.'));
      },
    };
    select(tab);
    return { onClose: () => cancelAnimationFrame(raf) };
  }, { label: 'Your stash' });
}
