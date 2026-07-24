// The HUD: per-player damage panels, stock icons, the clock, and the big
// announcement banners. Plain DOM over the top of the canvas — it stays crisp
// while the 3D underneath renders at a third of the resolution, exactly like the
// 64-era games did with their 2D overlays.
import { emblemCanvas, stockIconCanvas } from './portraits.js';

function el(tag, cls, parent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
}

/** Damage colour ramp — white at 0%, red hot past 150%. */
function percentColor(p) {
  if (p < 40) return '#f6f6f0';
  if (p < 80) return '#ffe27a';
  if (p < 120) return '#ffa73a';
  if (p < 170) return '#ff6a3a';
  return '#ff3a3a';
}

export class Hud {
  constructor(root, match) {
    this.root = root;
    this.match = match;
    this.el = {};
    root.innerHTML = '';

    this.el.top = el('div', 'hud-top', root);
    this.el.clock = el('div', 'hud-clock', this.el.top);
    this.el.stageName = el('div', 'hud-stage', this.el.top);
    this.el.stageName.textContent = match.stage.name;

    this.el.banner = el('div', 'hud-banner', root);
    this.el.bannerMain = el('div', 'main', this.el.banner);
    this.el.bannerSub = el('div', 'sub', this.el.banner);

    this.el.flash = el('div', 'hud-flash', root);

    this.el.panels = el('div', 'hud-panels', root);
    this.panels = match.fighters.map((f) => {
      const p = el('div', 'hud-panel', this.el.panels);
      p.style.setProperty('--pc', f.color);
      const em = el('div', 'hp-emblem', p);
      const cv = emblemCanvas(f.def, 96);
      cv.className = 'hp-emblem-cv';
      em.appendChild(cv);
      const tag = el('div', 'hp-tag', em);
      tag.textContent = f.isCpu ? `CPU${f.cpuLevel}` : `P${f.index + 1}`;
      const col = el('div', 'hp-col', p);
      const name = el('div', 'hp-name', col);
      name.textContent = f.def.name;
      const pct = el('div', 'hp-pct', col);
      const stocks = el('div', 'hp-stocks', col);
      const stockCv = stockIconCanvas(f.def, 32);
      return { f, root: p, pct, stocks, stockCv, lastStocks: -1, lastPct: -1, shake: 0 };
    });

    this.bannerTimer = null;
    this._lastEventFrame = -1;
  }

  banner(main, sub = '', ms = 1400) {
    this.el.bannerMain.textContent = main;
    this.el.bannerSub.textContent = sub;
    this.el.banner.classList.add('show');
    this.el.bannerMain.classList.remove('pop');
    // restart the CSS pop animation
    void this.el.bannerMain.offsetWidth;
    this.el.bannerMain.classList.add('pop');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.el.banner.classList.remove('show'), ms);
  }

  /** Called once per rendered frame. */
  update(dt) {
    const m = this.match;
    // clock
    if (m.rules.timeLimit && !m.suddenDeath) {
      const t = Math.max(0, m.timeLeft);
      const mm = Math.floor(t / 60);
      const ss = Math.floor(t % 60);
      const cs = Math.floor((t % 1) * 100);
      this.el.clock.textContent = `${mm}:${String(ss).padStart(2, '0')}${t < 10 ? `.${String(cs).padStart(2, '0')}` : ''}`;
      this.el.clock.classList.toggle('urgent', t <= 10);
      this.el.clock.style.display = '';
    } else if (m.suddenDeath) {
      this.el.clock.textContent = 'SUDDEN DEATH';
      this.el.clock.style.display = '';
    } else {
      this.el.clock.style.display = 'none';
    }

    for (const p of this.panels) {
      const f = p.f;
      const pct = f.hudPercent();
      if (pct !== p.lastPct) {
        p.pct.textContent = `${pct}%`;
        p.pct.style.color = percentColor(pct);
        p.pct.style.fontSize = `${Math.min(46, 30 + pct * 0.06)}px`;
        p.shake = Math.min(1, (pct - p.lastPct) / 18);
        p.lastPct = pct;
      }
      if (p.shake > 0) {
        p.shake = Math.max(0, p.shake - dt * 5);
        p.pct.style.transform = `translate(${(Math.random() - 0.5) * p.shake * 7}px, ${(Math.random() - 0.5) * p.shake * 7}px)`;
      } else if (p.pct.style.transform) {
        p.pct.style.transform = '';
      }
      if (f.stocks !== p.lastStocks) {
        p.lastStocks = f.stocks;
        p.stocks.innerHTML = '';
        const shown = Math.min(6, Math.max(0, f.stocks));
        for (let i = 0; i < shown; i++) {
          const icon = document.createElement('canvas');
          icon.width = p.stockCv.width;
          icon.height = p.stockCv.height;
          icon.getContext('2d').drawImage(p.stockCv, 0, 0);
          icon.className = 'hp-stock';
          p.stocks.appendChild(icon);
        }
        if (f.stocks > 6) {
          const more = el('span', 'hp-more', p.stocks);
          more.textContent = `×${f.stocks}`;
        }
        p.root.classList.toggle('out', f.stocks <= 0);
      }
      p.root.classList.toggle('finisher', !!f.finisherReady);
      p.root.classList.toggle('dead', f.state === 'dead');
    }

    // screen flash from the fx layer
    const flash = m.fx?.takeFlash?.();
    if (flash) {
      this.el.flash.style.background = flash.color;
      this.el.flash.style.opacity = String(Math.min(0.8, flash.strength));
      this.el.flash.style.transition = 'none';
      void this.el.flash.offsetWidth;
      this.el.flash.style.transition = 'opacity 220ms ease-out';
      this.el.flash.style.opacity = '0';
    }

    // countdown banner
    if (!m.started && !m.over) {
      const c = m.countdown;
      const label = c > 120 ? 'READY?' : c > 40 ? String(Math.max(1, Math.ceil(c / 40))) : 'GO!';
      if (this._lastCount !== label) {
        this._lastCount = label;
        this.banner(label, label === 'READY?' ? m.stage.name : '', 700);
      }
    }
  }

  /** Turn sim events into banners and announcer lines. */
  handleEvents(events, sfx) {
    for (const e of events) {
      if (e.type === 'ko') {
        const f = this.match.fighters[e.who];
        if (e.self) {
          this.banner('SELF DESTRUCT', `${f.def.name} took the fast way down`, 1500);
          sfx?.voice?.('Self destruct');
        } else {
          const by = this.match.fighters[e.by];
          this.banner('K.O.!', `${by.def.name} sent ${f.def.name} flying`, 1500);
          sfx?.voice?.(f.stocks <= 0 ? `${f.def.name} is out` : 'K O');
        }
      } else if (e.type === 'game') {
        const win = this.match.result?.winner;
        const w = win >= 0 ? this.match.fighters[win] : null;
        this.banner('GAME!', w ? `${w.def.name} WINS` : 'NO CONTEST', 2600);
      } else if (e.type === 'suddenDeath') {
        this.banner('SUDDEN DEATH', 'ONE STOCK · 150% · GO', 2200);
      }
    }
  }

  dispose() {
    clearTimeout(this.bannerTimer);
    this.root.innerHTML = '';
  }
}
