// The parts of the screen that aren't the tape: objectives, what you're
// carrying, what you're standing next to, and the pages you pick up. Kept as DOM
// so it stays crisp while the 3D underneath is deliberately not.

import { ITEM_DEFS, itemIcon } from './items.js';
import { fmtTime } from './util.js';

export class Hud {
  constructor(host, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <div class="hud-obj"><ul></ul></div>
      <div class="hud-vitals">
        <div class="v-row"><span class="v-key">BODY</span><span class="v-bar hp"><i></i></span></div>
        <div class="v-row"><span class="v-key">NERVE</span><span class="v-bar sanity"><i></i></span></div>
        <div class="v-row"><span class="v-key">WIND</span><span class="v-bar stam"><i></i></span></div>
        <div class="v-row breath" hidden><span class="v-key">AIR</span><span class="v-bar air"><i></i></span></div>
      </div>
      <div class="hud-belt"></div>
      <div class="hud-prompt" hidden></div>
      <div class="hud-sub" hidden></div>
      <div class="hud-toast" hidden></div>
      <div class="hud-crosshair"><i></i></div>
      <div class="note-reader" hidden>
        <div class="note-page">
          <h3></h3>
          <p></p>
          <button class="note-close">CLOSE  [E]</button>
        </div>
      </div>
      <div class="level-card" hidden>
        <div class="lc-num"></div>
        <div class="lc-name"></div>
        <div class="lc-sub"></div>
        <div class="lc-tag"></div>
      </div>
      <div class="death" hidden>
        <div class="d-static"></div>
        <div class="d-box">
          <h2>THE TAPE STOPS HERE</h2>
          <p class="d-cause"></p>
          <p class="d-stats"></p>
          <button class="d-retry">REWIND  ·  LAST CHECKPOINT</button>
          <button class="d-quit">EJECT  ·  BACK TO TITLE</button>
        </div>
      </div>`;
    host.appendChild(this.el);

    this.objList = this.el.querySelector('.hud-obj ul');
    this.belt = this.el.querySelector('.hud-belt');
    this.promptEl = this.el.querySelector('.hud-prompt');
    this.subEl = this.el.querySelector('.hud-sub');
    this.toastEl = this.el.querySelector('.hud-toast');
    this.noteEl = this.el.querySelector('.note-reader');
    this.cardEl = this.el.querySelector('.level-card');
    this.deathEl = this.el.querySelector('.death');
    this.bars = {
      hp: this.el.querySelector('.v-bar.hp i'),
      sanity: this.el.querySelector('.v-bar.sanity i'),
      stam: this.el.querySelector('.v-bar.stam i'),
      air: this.el.querySelector('.v-bar.air i'),
      breathRow: this.el.querySelector('.v-row.breath'),
    };
    this.noteEl.querySelector('.note-close').onclick = () => this.hideNote();
    this.deathEl.querySelector('.d-retry').onclick = () => game.respawn();
    this.deathEl.querySelector('.d-quit').onclick = () => game.toTitle();
    this.iconCache = new Map();
    this.subT = 0;
    this.toastT = 0;
    this.objectives = [];
  }

  // ---------------------------------------------------------------- objectives
  setObjectives(list) {
    this.objectives = list;
    this.renderObjectives();
  }

  renderObjectives() {
    this.objList.innerHTML = this.objectives.map((o) => `
      <li class="${o.done ? 'done' : ''}${o.optional ? ' opt' : ''}">
        <span class="tick">${o.done ? '✓' : '·'}</span>${o.text}
      </li>`).join('');
  }

  completeObjective(id) {
    const o = this.objectives.find((x) => x.id === id);
    if (!o || o.done) return false;
    o.done = true;
    this.renderObjectives();
    this.toast('OBJECTIVE COMPLETE');
    return true;
  }

  addObjective(text) {
    this.objectives.push({ id: `x${this.objectives.length}`, text, done: false });
    this.renderObjectives();
  }

  // ---------------------------------------------------------------- vitals
  setVitals(v) {
    this.bars.hp.style.width = `${Math.max(0, v.hp)}%`;
    this.bars.hp.style.background = v.hp < 30 ? '#d02a20' : '#c8c0a8';
    this.bars.sanity.style.width = `${Math.max(0, v.sanity)}%`;
    this.bars.sanity.style.background = v.sanity < 35 ? '#8a4ad0' : '#a8a090';
    this.bars.stam.style.width = `${Math.max(0, v.stamina)}%`;
    const under = v.breath < 99.5;
    this.bars.breathRow.hidden = !under;
    if (under) {
      this.bars.air.style.width = `${Math.max(0, v.breath)}%`;
      this.bars.air.style.background = v.breath < 30 ? '#d02a20' : '#7ac8e0';
    }
  }

  // ---------------------------------------------------------------- belt
  setInventory(inv, sel) {
    const keys = Object.keys(inv).filter((k) => inv[k] > 0);
    this.belt.innerHTML = '';
    keys.forEach((k, i) => {
      const def = ITEM_DEFS[k];
      if (!def) return;
      const slot = document.createElement('div');
      slot.className = `slot${k === sel ? ' sel' : ''}`;
      if (!this.iconCache.has(k)) this.iconCache.set(k, itemIcon(k).toDataURL());
      slot.innerHTML = `<img src="${this.iconCache.get(k)}" alt=""/>
        <span class="n">${inv[k]}</span><span class="k">${i + 1}</span>`;
      slot.title = `${def.name} — ${def.tag}`;
      slot.onclick = () => this.game.selectItem(k);
      this.belt.appendChild(slot);
    });
  }

  // ---------------------------------------------------------------- messages
  prompt(text) {
    if (!text) { this.promptEl.hidden = true; return; }
    this.promptEl.hidden = false;
    this.promptEl.innerHTML = text;
  }

  subtitle(text, secs = 4.5) {
    if (!this.game.settings.subtitles) return;
    this.subEl.hidden = false;
    this.subEl.textContent = text;
    this.subT = secs;
  }

  toast(text, secs = 2.4) {
    this.toastEl.hidden = false;
    this.toastEl.textContent = text;
    this.toastT = secs;
  }

  // ---------------------------------------------------------------- pages
  showNote(note) {
    this.noteEl.hidden = false;
    this.noteEl.querySelector('h3').textContent = note.title;
    this.noteEl.querySelector('p').textContent = String(note.text).replace(/\s+/g, ' ').trim();
    this.game.audio?.oneShot('noteOpen', 0.5);
  }

  hideNote() {
    this.noteEl.hidden = true;
    this.game.resumeFromNote?.();
  }

  get noteOpen() { return !this.noteEl.hidden; }

  // ---------------------------------------------------------------- cards
  levelCard(meta) {
    this.cardEl.hidden = false;
    this.cardEl.querySelector('.lc-num').textContent = `LEVEL ${meta.num}`;
    this.cardEl.querySelector('.lc-name').textContent = meta.name;
    this.cardEl.querySelector('.lc-sub').textContent = meta.subtitle || '';
    this.cardEl.querySelector('.lc-tag').textContent = meta.tagline || '';
    this.cardEl.classList.remove('fade');
    setTimeout(() => this.cardEl.classList.add('fade'), 3200);
    setTimeout(() => { this.cardEl.hidden = true; }, 5000);
  }

  death(cause, stats) {
    this.deathEl.hidden = false;
    this.deathEl.querySelector('.d-cause').textContent = cause;
    this.deathEl.querySelector('.d-stats').textContent =
      `RUN TIME ${fmtTime(stats.playtime)} · LEVELS ${stats.levels} · TAPES ${stats.tapes} · DEATHS ${stats.deaths}`;
  }

  hideDeath() { this.deathEl.hidden = true; }

  update(dt) {
    if (this.subT > 0) {
      this.subT -= dt;
      if (this.subT <= 0) this.subEl.hidden = true;
    }
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.hidden = true;
    }
  }

  setVisible(v) { this.el.style.display = v ? '' : 'none'; }
}
