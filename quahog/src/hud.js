// The overlay: portrait, wallet, wanted stars, clock, objective card, the
// round minimap cut out of the town's own ground texture, and the big map.
import { portrait, charSpec } from './cast.js';
import { HALF } from './city.js';

const DISTRICTS = [
  ['Pewterschmidt Estate', 'James Woods High', 'Quahog Park', 'The Docks'],
  ['Spooner Street', 'Downtown', 'Civic Center', 'The Waterfront'],
  ['West Quahog', 'Midtown', 'Quahog Mall', 'Quahog Beach'],
  ['Quahog Woods', 'Pawtucket Works', 'Quahog Airport', 'Quahog Salvage'],
];

export function districtAt(x, z) {
  const bx = Math.min(3, Math.max(0, Math.floor((x + HALF) / 160)));
  const bz = Math.min(3, Math.max(0, Math.floor((z + HALF) / 160)));
  return DISTRICTS[bz][bx];
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export function clockText(hour) {
  const h24 = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export class Hud {
  constructor() {
    this.el = {
      face: document.getElementById('hud-face'),
      name: document.getElementById('hud-name'),
      coins: document.getElementById('hud-coins'),
      stars: document.getElementById('hud-stars'),
      health: document.querySelector('#hud-health i'),
      clock: document.getElementById('hud-clock'),
      day: document.getElementById('hud-day'),
      where: document.getElementById('hud-where'),
      objective: document.getElementById('hud-objective'),
      obTitle: document.querySelector('#hud-objective .ob-title'),
      obLine: document.querySelector('#hud-objective .ob-line'),
      obTimer: document.querySelector('#hud-objective .ob-timer'),
      mini: document.getElementById('minimap'),
      speedo: document.getElementById('hud-speedo'),
      speedoNum: document.getElementById('speedo-num'),
      prompt: document.getElementById('hud-prompt'),
      toast: document.getElementById('hud-toast'),
      sub: document.getElementById('hud-subtitle'),
      damage: document.getElementById('hud-damage'),
      bigmap: document.getElementById('bigmap'),
      mapLegend: document.getElementById('map-legend'),
    };
    this.miniCtx = this.el.mini.getContext('2d');
    this.bigCtx = this.el.bigmap.getContext('2d');
    this._where = '';
    this._sub = 0;
  }

  setCharacter(id) {
    const spec = charSpec(id);
    const cv = portrait(spec, 120);
    const ctx = this.el.face.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);
    ctx.drawImage(cv, 0, 0);
    this.el.name.textContent = spec.short;
  }

  setCoins(n) { this.el.coins.textContent = `🪙 ${n.toLocaleString()}`; }
  setStars(n) { this.el.stars.textContent = n > 0 ? '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)) : ''; }
  setHealth(frac) { this.el.health.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`; }

  setClock(hour, day) {
    this.el.clock.textContent = clockText(hour);
    this.el.day.textContent = DAYS[day % 7];
  }

  setWhere(name) {
    if (name === this._where) return;
    this._where = name;
    this.el.where.textContent = name.toUpperCase();
  }

  speed(mph, show) {
    this.el.speedo.classList.toggle('show', !!show);
    if (show) this.el.speedoNum.textContent = mph;
  }

  prompt(text) {
    this.el.prompt.classList.toggle('show', !!text);
    if (text) this.el.prompt.innerHTML = text;
  }

  toast(text, kind = '') {
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.textContent = text;
    this.el.toast.appendChild(d);
    setTimeout(() => {
      d.style.transition = 'opacity 0.4s, transform 0.4s';
      d.style.opacity = '0';
      d.style.transform = 'translateY(-14px)';
      setTimeout(() => d.remove(), 420);
    }, 2100);
  }

  subtitle(name, line, dur = 3) {
    this.el.sub.classList.add('show');
    this.el.sub.innerHTML = `<b>${name}</b><span>${line}</span>`;
    this._sub = dur;
  }

  damage() {
    this.el.damage.classList.add('hit');
    setTimeout(() => this.el.damage.classList.remove('hit'), 200);
  }

  setObjective(title, line, timer) {
    this.el.objective.classList.add('show');
    this.el.obTitle.textContent = title;
    this.el.obLine.textContent = line;
    this.el.obTimer.textContent = timer > 0 ? fmtTime(timer) : '';
  }

  updateObjective(count, timer) {
    const t = timer > 0 ? fmtTime(timer) : '';
    this.el.obTimer.textContent = count ? `${count}${t ? '   ' + t : ''}` : t;
    this.el.obTimer.classList.toggle('urgent', timer > 0 && timer < 15);
  }

  clearObjective() { this.el.objective.classList.remove('show'); }

  tick(dt) {
    if (this._sub > 0) {
      this._sub -= dt;
      if (this._sub <= 0) this.el.sub.classList.remove('show');
    }
  }

  // ---------------------------------------------------------------- maps
  /** The minimap is a window cut straight out of the town's ground canvas. */
  drawMinimap(ground, px, pz, yaw, blips) {
    const ctx = this.miniCtx;
    const size = this.el.mini.width;
    const span = 150;                       // metres across the window
    const s = ground.width / (HALF * 2);
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    const sx = (px + HALF) * s - (span * s) / 2;
    const sz = (pz + HALF) * s - (span * s) / 2;
    ctx.drawImage(ground, sx, sz, span * s, span * s, 0, 0, size, size);
    // blips
    const toScreen = (x, z) => [
      ((x - px) / span + 0.5) * size,
      ((z - pz) / span + 0.5) * size,
    ];
    for (const b of blips) {
      const [bx, by] = toScreen(b.x, b.z);
      if (bx < -10 || by < -10 || bx > size + 10 || by > size + 10) {
        // clamp off-screen objectives to the rim so you always know the way
        if (!b.edge) continue;
        const a = Math.atan2(by - size / 2, bx - size / 2);
        const r = size / 2 - 10;
        drawBlip(ctx, size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, b, true);
        continue;
      }
      drawBlip(ctx, bx, by, b, false);
    }
    // the player, always dead centre
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(yaw);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.5, 8);
    ctx.lineTo(0, 4.5);
    ctx.lineTo(-6.5, 8);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#141418';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  drawBigMap(ground, px, pz, landmarks, blips) {
    const ctx = this.bigCtx;
    const size = this.el.bigmap.width;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(ground, 0, 0, size, size);
    const k = size / (HALF * 2);
    const toS = (x, z) => [(x + HALF) * k, (z + HALF) * k];
    ctx.font = "700 11px 'Arial Narrow', sans-serif";
    ctx.textAlign = 'center';
    for (const l of landmarks) {
      const [x, y] = toS(l.x, l.z);
      ctx.fillStyle = l.color;
      ctx.strokeStyle = '#141418';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#141418';
      ctx.fillText(l.name.length > 22 ? l.name.slice(0, 20) + '…' : l.name, x, y - 9);
    }
    for (const b of blips) {
      const [x, y] = toS(b.x, b.z);
      drawBlip(ctx, x, y, b, false, 8);
    }
    const [x, y] = toS(px, pz);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#141418';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawBlip(ctx, x, y, b, edge, r = 6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#141418';
  ctx.lineWidth = 2;
  ctx.fillStyle = b.color || '#c0392b';
  if (b.shape === 'diamond') {
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
  } else if (b.shape === 'square') {
    ctx.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
    ctx.strokeRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, r * (edge ? 0.7 : 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
