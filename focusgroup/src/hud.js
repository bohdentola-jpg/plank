// FOCUS GROUP — the furniture around the picture.
//
// The important one is the checklist. On Tuesday it is a to-do list on Valco
// notepaper and it reads like a tutorial. On Friday it contains two items you
// do not remember writing. On Sunday the heading stops saying YOUR MORNING and
// starts saying SHOOTING SCRIPT, the items go into screenplay format, and
// there is a TAKE counter in the corner. Nothing about it is ever explained.
//
// The other important one is ENGAGEMENT, which goes up when you play well, and
// which the game congratulates you for.

import { clamp01, damp } from './util.js';
import { ENGAGEMENT_PRAISE } from './story.js';

export class Hud {
  constructor(host, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <div class="pad" id="pad">
        <div class="pad-brand">VALCO</div>
        <div class="pad-head" id="pad-head">YOUR MORNING</div>
        <div class="pad-date" id="pad-date"></div>
        <ul class="pad-list" id="pad-list"></ul>
        <div class="pad-eng">
          <span class="pe-k">ENGAGEMENT</span>
          <span class="pe-bar"><i id="pad-eng"></i></span>
        </div>
        <div class="pad-take" id="pad-take" hidden>TAKE 1</div>
      </div>

      <div class="prompt" id="prompt" hidden></div>
      <div class="toast" id="toast" hidden></div>
      <div class="say" id="say" hidden></div>
      <div class="reticle" id="reticle"><i></i></div>
      <div class="daycard" id="daycard" hidden>
        <div class="dc-day" id="dc-day"></div>
        <div class="dc-title" id="dc-title"></div>
        <div class="dc-sub" id="dc-sub"></div>
      </div>`;
    host.appendChild(this.el);

    this.pad = this.el.querySelector('#pad');
    this.padHead = this.el.querySelector('#pad-head');
    this.padDate = this.el.querySelector('#pad-date');
    this.padList = this.el.querySelector('#pad-list');
    this.padEng = this.el.querySelector('#pad-eng');
    this.padTake = this.el.querySelector('#pad-take');
    this.promptEl = this.el.querySelector('#prompt');
    this.toastEl = this.el.querySelector('#toast');
    this.sayEl = this.el.querySelector('#say');
    this.reticle = this.el.querySelector('#reticle');
    this.dayCard = this.el.querySelector('#daycard');

    this.toastT = 0;
    this.sayT = 0;
    this.engShown = 0;
    this.praiseIdx = 0;
  }

  setVisible(v) { this.el.style.display = v ? 'block' : 'none'; }

  // ---------------------------------------------------------------- the pad

  /** @param {object} day a DAYS entry */
  setDay(day) {
    this.day = day;
    this.script = !!day.script;
    this.padHead.textContent = day.listHead;
    this.padDate.textContent = `${day.weekday} ${day.date}`;
    this.pad.classList.toggle('as-script', this.script);
    this.padTake.hidden = !this.script;
    this.take = 1;
  }

  /**
   * @param {Array} steps [{ id, text, note, count, done, n, hidden, unclaimed }]
   */
  renderSteps(steps) {
    this.padList.innerHTML = '';
    for (const s of steps) {
      if (s.hidden) continue;
      const li = document.createElement('li');
      li.className = [
        s.done ? 'done' : '',
        s.unclaimed ? 'unclaimed' : '',
        s.fresh ? 'fresh' : '',
      ].filter(Boolean).join(' ');
      const tick = this.script ? '' : `<span class="tick">${s.done ? '☑' : '☐'}</span>`;
      const count = s.count ? ` <i>(${s.n || 0}/${s.count})</i>` : '';
      li.innerHTML = `${tick}<span class="t">${s.text}${count}</span>`
        + (s.note ? `<span class="n">${s.note}</span>` : '');
      this.padList.appendChild(li);
    }
  }

  setTake(n) {
    this.take = n;
    this.padTake.textContent = `TAKE ${n}`;
  }

  // ---------------------------------------------------------------- talking

  /** The prompt under the reticle. `key` is the letter, `label` the verb. */
  setPrompt(key, label) {
    if (!label) { this.promptEl.hidden = true; return; }
    this.promptEl.hidden = false;
    this.promptEl.innerHTML = `<b>${key}</b> ${label}`;
  }

  setReticle(v) { this.reticle.style.opacity = v ? '1' : '0'; }

  /** A line of the game noticing something on your behalf. */
  say(text, secs = 5) {
    if (!text) { this.sayEl.hidden = true; this.sayT = 0; return; }
    this.sayEl.textContent = text;
    this.sayEl.hidden = false;
    this.sayT = secs;
  }

  toast(text, secs = 2.4, kind = '') {
    this.toastEl.textContent = text;
    this.toastEl.className = `toast ${kind}`;
    this.toastEl.hidden = false;
    this.toastT = secs;
  }

  /** Valco is pleased, and says so, which is the worst part. */
  praise() {
    this.toast(ENGAGEMENT_PRAISE[this.praiseIdx++ % ENGAGEMENT_PRAISE.length], 2.6, 'good');
  }

  // ---------------------------------------------------------------- cards

  showDayCard(day) {
    this.dayCard.hidden = false;
    this.dayCard.classList.remove('fade');
    this.el.querySelector('#dc-day').textContent = `${day.weekday} · ${day.date}`;
    this.el.querySelector('#dc-title').textContent = day.title;
    this.el.querySelector('#dc-sub').textContent = day.card || '';
  }

  hideDayCard() {
    this.dayCard.classList.add('fade');
    setTimeout(() => { this.dayCard.hidden = true; }, 1400);
  }

  // ---------------------------------------------------------------- frame

  update(dt) {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.hidden = true;
    }
    if (this.sayT > 0) {
      this.sayT -= dt;
      if (this.sayT <= 0) this.sayEl.hidden = true;
    }
    // the bar fills smoothly, because it is a nice bar
    this.engShown = damp(this.engShown, clamp01(this.game.engagement / 100), 2.2, dt);
    this.padEng.style.width = `${(this.engShown * 100).toFixed(1)}%`;
  }
}

/**
 * The page you find under a door or in a box. Blocks the game until closed.
 */
export class Reader {
  constructor(host) {
    this.el = document.createElement('div');
    this.el.className = 'reader';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="page">
        <h3></h3>
        <pre></pre>
        <div class="sign"></div>
        <button class="close">CLOSE  [E]</button>
      </div>`;
    host.appendChild(this.el);
    this.h3 = this.el.querySelector('h3');
    this.pre = this.el.querySelector('pre');
    this.sign = this.el.querySelector('.sign');
    this.el.querySelector('.close').onclick = () => this.close();
    this.open = false;
  }

  /** @param {object} note from story.NOTES */
  show(note) {
    this.h3.textContent = note.head || '';
    this.pre.textContent = note.body || '';
    this.sign.textContent = note.sign || '';
    this.el.hidden = false;
    this.open = true;
    return new Promise((res) => { this.resolve = res; });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }
}

/**
 * The journal: every lens you have found, in the order you found it. It is
 * the only thing in the game that is yours.
 */
export function renderJournal(host, noticed, lenses) {
  host.innerHTML = '';
  const found = [...noticed];
  if (!found.length) {
    host.innerHTML = '<p class="j-none">Nothing yet. Look closer at things you have '
      + 'looked at every day for four years.</p>';
    return;
  }
  found.forEach((id, i) => {
    const rec = lenses[id];
    const row = document.createElement('div');
    row.className = 'j-row';
    row.innerHTML = `<span class="j-n">${String(i + 1).padStart(2, '0')}</span>`
      + `<span class="j-t">${rec ? rec.found : id}</span>`;
    host.appendChild(row);
  });
  const tail = document.createElement('p');
  tail.className = 'j-none';
  const ofTwelve = found.filter((id) => id !== 'last').length;
  tail.textContent = found.includes('last')
    ? `${ofTwelve} of 12, and one that was not on the list.`
    : `${ofTwelve} of 12. Knowing where they are has not moved any of them.`;
  host.appendChild(tail);
}
