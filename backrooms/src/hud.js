// The parts of the screen that are not the tape: what you are looking for, what
// your body is doing, whether it is filming, and — if you bought the meter — a pip
// that tells you how far away the thing is.
//
// There is no inventory, because there is nothing to carry. You have a torch.

import { fmtTime } from './util.js';

export class Hud {
  constructor(host, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <div class="hud-obj"><ul></ul></div>
      <div class="hud-right">
        <div class="hud-footage"><span class="ft-n">0</span><span class="ft-l">FOOTAGE</span></div>
        <div class="hud-filming" hidden>● FILMING <span class="film-t">0s</span></div>
        <div class="hud-track" hidden><i></i><span class="tk-d"></span></div>
        <div class="hud-compass" hidden><i></i><span>LIFT</span></div>
      </div>
      <div class="hud-vitals">
        <div class="v-row"><span class="v-key">WIND</span><span class="v-bar stam"><i></i></span></div>
        <div class="v-row breath" hidden><span class="v-key">AIR</span><span class="v-bar air"><i></i></span></div>
      </div>
      <div class="hud-prompt" hidden></div>
      <div class="hud-sub" hidden></div>
      <div class="hud-toast" hidden></div>
      <div class="hud-crosshair"><i></i></div>
      <div class="hud-chase" hidden><span></span></div>
      <div class="lift-docket" hidden>
        <div class="ld-head"></div>
        <div class="ld-rows"></div>
        <div class="ld-foot">the stall is on your right · the button is by the doors</div>
      </div>
      <div class="hud-xray" hidden>
        <span class="xr-tag">X-RAY</span>
        <span class="xr-m">—</span>
        <span class="xr-l">—</span>
      </div>
      <div class="hide-frame" hidden><i class="hf-l"></i><i class="hf-r"></i><i class="hf-t"></i><i class="hf-b"></i></div>
      <div class="level-card" hidden>
        <div class="lc-floor"></div>
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
          <button class="d-retry">EJECT · BACK TO THE TITLE</button>
        </div>
      </div>`;
    host.appendChild(this.el);

    this.objList = this.el.querySelector('.hud-obj ul');
    this.promptEl = this.el.querySelector('.hud-prompt');
    this.subEl = this.el.querySelector('.hud-sub');
    this.toastEl = this.el.querySelector('.hud-toast');
    this.cardEl = this.el.querySelector('.level-card');
    this.deathEl = this.el.querySelector('.death');
    this.chaseEl = this.el.querySelector('.hud-chase');
    this.docketEl = this.el.querySelector('.lift-docket');
    this.xrayEl = this.el.querySelector('.hud-xray');
    this.xrayM = this.el.querySelector('.xr-m');
    this.xrayL = this.el.querySelector('.xr-l');
    this.hideFrame = this.el.querySelector('.hide-frame');
    this.filmEl = this.el.querySelector('.hud-filming');
    this.filmT = this.el.querySelector('.film-t');
    this.footEl = this.el.querySelector('.ft-n');
    this.trackEl = this.el.querySelector('.hud-track');
    this.trackPip = this.el.querySelector('.hud-track i');
    this.trackDist = this.el.querySelector('.tk-d');
    this.compassEl = this.el.querySelector('.hud-compass');
    this.compassPip = this.el.querySelector('.hud-compass i');
    this.bars = {
      stam: this.el.querySelector('.v-bar.stam i'),
      air: this.el.querySelector('.v-bar.air i'),
      breathRow: this.el.querySelector('.v-row.breath'),
      breathKey: this.el.querySelector('.v-row.breath .v-key'),
    };
    this.deathEl.querySelector('.d-retry').onclick = () => game.retry();
    this.subT = 0;
    this.toastT = 0;
    this.objectives = [];
  }

  // ---------------------------------------------------------------- objectives
  setObjectives(list) {
    this.objectives = list.filter((o) => o.text);
    this.objList.innerHTML = this.objectives.map((o) => `
      <li class="${o.done ? 'done' : ''}${o.optional ? ' opt' : ''}">
        <span class="tick">${o.done ? '✓' : '·'}</span>${o.text}
      </li>`).join('');
  }

  // ---------------------------------------------------------------- vitals
  setVitals(v) {
    this.bars.stam.style.width = `${Math.max(0, v.stamina)}%`;
    const showAir = v.hidden || v.breath < 99.5;
    this.bars.breathRow.hidden = !showAir;
    if (showAir) {
      this.bars.air.style.width = `${Math.max(0, v.breath)}%`;
      this.bars.air.style.background = v.breath < 30 ? '#d02a20' : '#7ac8e0';
      this.bars.breathKey.textContent = v.hidden ? 'STILL' : 'AIR';
    }
    this.hideFrame.hidden = !v.hidden;
    if (this.lastFootage !== v.footage) {
      this.lastFootage = v.footage;
      this.footEl.textContent = String(v.footage);
    }

    // the tracking meter: an arrow when it is far, a bar when it is close
    if (v.bearing) {
      this.trackEl.hidden = false;
      const b = v.bearing;
      this.trackPip.style.transform = `rotate(${b.rel}rad)`;
      const near = b.dist < 18;
      this.trackEl.classList.toggle('near', near);
      this.trackEl.classList.toggle('hunting', b.state === 'hunt');
      this.trackDist.textContent = v.trackerLevel > 1
        ? `${Math.round(b.dist)}m ${b.state === 'hunt' ? '· HUNTING' : ''}`
        : near ? 'CLOSE' : `${Math.round(b.dist / 10) * 10}m`;
    } else this.trackEl.hidden = true;

    if (v.compass) {
      this.compassEl.hidden = false;
      this.compassPip.style.transform = `rotate(${v.compass.angle - v.playerYaw}rad)`;
    } else this.compassEl.hidden = true;
  }

  setFilming(on, secs) {
    this.filmEl.hidden = !on;
    if (on) this.filmT.textContent = `${Math.floor(secs)}s`;
  }

  chaseOn(name) {
    this.chaseEl.hidden = false;
    this.chaseEl.querySelector('span').textContent = `${name} HAS YOU`;
  }

  chaseOff() { this.chaseEl.hidden = true; }

  // ---------------------------------------------------------------- the lift
  // What the floor you just left was worth, printed on the wall of the car. It stays up
  // the whole time you are in there, because there is nothing else to read.
  liftDocket(pay, footage, floor, floors) {
    if (!pay) { this.docketEl.hidden = true; return; }
    this.docketEl.hidden = false;
    this.docketEl.querySelector('.ld-head').textContent =
      floor >= floors ? 'THE LIFT GOES UP FROM HERE' : `FLOOR ${floor} CLEARED — ${floors - floor} TO GO`;
    const row = (label, v) => (v ? `<div><span>${label}</span><b>+${v}</b></div>` : '');
    this.docketEl.querySelector('.ld-rows').innerHTML = [
      row('off the floor alive', pay.base),
      row('footage of it', pay.film),
      row('never chased', pay.clean),
      row('brisk about it', pay.brisk),
      row('used the cover', pay.cover),
      `<div class="tot"><span>FOOTAGE</span><b>${footage}</b></div>`,
    ].join('');
  }

  hideDocket() { this.docketEl.hidden = true; }

  // ---------------------------------------------------------------- the cheat
  setXray(on) { this.xrayEl.hidden = !on; }

  setXrayRange(monsterM, liftM, state) {
    if (this.xrayEl.hidden) return;
    this.xrayM.textContent = monsterM === null ? 'nothing on the floor'
      : `${monsterM}m ${state ? `· ${state}` : ''}`;
    this.xrayL.textContent = liftM === null ? 'no lift' : `lift ${liftM}m`;
    // the closer it is, the harder the line reads
    this.xrayM.classList.toggle('near', monsterM !== null && monsterM < 25);
  }

  // ---------------------------------------------------------------- messages
  prompt(text) {
    if (!text) { this.promptEl.hidden = true; return; }
    this.promptEl.hidden = false;
    this.promptEl.innerHTML = text;
  }

  subtitle(text, secs = 4.5) {
    if (!text) { this.subEl.hidden = true; this.subT = 0; return; }
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

  // ---------------------------------------------------------------- cards
  levelCard(meta, floor, floors) {
    this.cardEl.hidden = false;
    this.cardEl.querySelector('.lc-floor').textContent = `FLOOR ${floor} OF ${floors}`;
    this.cardEl.querySelector('.lc-num').textContent = `LEVEL ${meta.num}`;
    this.cardEl.querySelector('.lc-name').textContent = meta.name;
    this.cardEl.querySelector('.lc-sub').textContent = meta.subtitle || '';
    this.cardEl.querySelector('.lc-tag').textContent = meta.tagline || '';
    this.cardEl.classList.remove('fade');
    setTimeout(() => this.cardEl.classList.add('fade'), 3000);
    setTimeout(() => { this.cardEl.hidden = true; }, 4800);
  }

  death(cause, stats) {
    this.deathEl.hidden = false;
    this.deathEl.querySelector('.d-cause').textContent = cause;
    this.deathEl.querySelector('.d-stats').textContent =
      `FLOOR ${stats.floor} OF ${stats.floors} · ${fmtTime(stats.tape)} OF TAPE · `
      + `${stats.footage} FOOTAGE UNSPENT · ${stats.kit} UPGRADE${stats.kit === 1 ? '' : 'S'}`;
  }

  hideDeath() { this.deathEl.hidden = true; }

  update(dt) {
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.subEl.hidden = true; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toastEl.hidden = true; }
  }

  setVisible(v) { this.el.style.display = v ? '' : 'none'; }
}
