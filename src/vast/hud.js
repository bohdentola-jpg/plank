// HUD: compass ribbon, discovery banners, interaction prompt, stamina,
// day dial, minimap, journal and help overlays. Pure DOM/canvas — the 3D
// scene never knows any of this exists.

import { clamp } from './noise.js';
import { BIOMES } from './world.js';

const TYPE_GLYPH = { shrine: '✦', ruin: '⌂', camp: '▲', stones: '◦', tower: '♜', village: '⌂', obelisk: '▮' };
const TYPE_LABEL = { shrine: 'Shrine', ruin: 'Ruin', camp: 'Camp', stones: 'Standing Stones', tower: 'Watchtower', village: 'Village', obelisk: 'Obelisk' };
const TYPE_PLURAL = { shrine: 'Shrines', ruin: 'Ruins', camp: 'Camps', stones: 'Standing Stones', tower: 'Watchtowers', village: 'Villages', obelisk: 'Obelisks' };

export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.compass = this.el('vast-compass');
    this.cctx = this.compass.getContext('2d');
    this.dial = this.el('vast-dial');
    this.dctx = this.dial.getContext('2d');
    this.mini = this.el('vast-minimap');
    this.mctx = this.mini.getContext('2d');
    this.banner = this.el('vast-banner');
    this.bannerMain = this.banner.querySelector('.main');
    this.bannerSub = this.banner.querySelector('.sub');
    this.prompt = this.el('vast-prompt');
    this.toastEl = this.el('vast-toast');
    this.stamWrap = this.el('vast-stamina');
    this.stamFill = this.stamWrap.querySelector('.fill');
    this.journal = this.el('vast-journal');
    this.help = this.el('vast-help');
    this._bannerQ = [];
    this._bannerT = 0;
    this._toastT = 0;
    this._miniT = 0;
    this._miniImg = null;
  }

  // ---- banners ------------------------------------------------------------
  showBanner(main, sub, cls = '') {
    this._bannerQ.push({ main, sub, cls });
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this._toastT = 2.6;
  }

  setPrompt(text) {
    if (text) {
      this.prompt.textContent = text;
      this.prompt.classList.add('show');
    } else {
      this.prompt.classList.remove('show');
    }
  }

  setStamina(v) {
    this.stamWrap.classList.toggle('show', v < 0.995);
    this.stamFill.style.width = `${(v * 100).toFixed(1)}%`;
    this.stamFill.classList.toggle('low', v < 0.25);
  }

  update(dt) {
    if (this._bannerT > 0) {
      this._bannerT -= dt;
      if (this._bannerT <= 0) this.banner.classList.remove('show');
    } else if (this._bannerQ.length) {
      const b = this._bannerQ.shift();
      this.bannerMain.textContent = b.main;
      this.bannerSub.textContent = b.sub || '';
      this.banner.className = 'show ' + b.cls;
      this._bannerT = 3.6;
    }
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.toastEl.classList.remove('show');
    }
  }

  // ---- compass ------------------------------------------------------------
  // markers: [{angle (world rad), color, glyph}]
  drawCompass(camYaw, markers) {
    const c = this.cctx, W = this.compass.width, H = this.compass.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(10,14,18,0.45)';
    c.beginPath();
    c.roundRect(0, H / 2 - 15, W, 30, 15);
    c.fill();
    const fov = Math.PI * 1.1; // ribbon spans this much world angle
    const toX = (worldAng) => {
      let d = worldAng - camYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return W / 2 - (d / fov) * W; // camYaw convention: -dx turns right
    };
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // ticks every 15°, cardinals big  (N at angle 0 = -Z? we define N = -Z → world angle π)
    for (let deg = 0; deg < 360; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const x = toX(a);
      if (x < 8 || x > W - 8) continue;
      // world angle 0 = +Z = map-south; π = -Z = map-north; π/2 = +X = east
      const card = { 0: 'S', 90: 'E', 180: 'N', 270: 'W' }[deg];
      if (card) {
        c.fillStyle = card === 'N' ? '#ff8a66' : '#e8e2d2';
        c.font = '600 15px Georgia, serif';
        c.fillText(card, x, H / 2);
      } else {
        c.fillStyle = 'rgba(220,215,200,0.5)';
        c.fillRect(x - 0.5, H / 2 - 5, 1, 10);
      }
    }
    for (const m of markers) {
      const x = toX(m.angle);
      if (x < 6 || x > W - 6) continue;
      c.fillStyle = m.color;
      c.font = '13px serif';
      c.fillText(m.glyph, x, H / 2 - 22);
    }
    // center notch
    c.fillStyle = '#e8e2d2';
    c.fillRect(W / 2 - 1, H / 2 - 15, 2, 4);
  }

  // ---- day dial -------------------------------------------------------------
  drawDial(dayT, day) {
    const c = this.dctx, W = this.dial.width, H = this.dial.height, R = 26;
    c.clearRect(0, 0, W, H);
    const cx = R + 4, cy = H / 2;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fillStyle = 'rgba(10,14,18,0.5)';
    c.fill();
    c.strokeStyle = 'rgba(230,225,210,0.5)';
    c.lineWidth = 1.5;
    c.stroke();
    // sun/moon on the wheel: dayT 0.25 = sunrise at east point
    const a = (dayT - 0.25) * Math.PI * 2;
    const sx = cx + Math.cos(a) * (R - 8) * -1, sy = cy - Math.sin(a) * (R - 8);
    c.beginPath();
    c.arc(sx, sy, 5, 0, Math.PI * 2);
    c.fillStyle = '#ffd77a';
    c.fill();
    const mx = cx + Math.cos(a + Math.PI) * (R - 8) * -1, my = cy - Math.sin(a + Math.PI) * (R - 8);
    c.beginPath();
    c.arc(mx, my, 3.6, 0, Math.PI * 2);
    c.fillStyle = '#cfd8ea';
    c.fill();
    // horizon line
    c.fillStyle = 'rgba(230,225,210,0.35)';
    c.fillRect(cx - R + 3, cy - 0.5, R * 2 - 6, 1);
    c.fillStyle = '#e8e2d2';
    c.font = '600 13px Georgia, serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(`Day ${day}`, cx + R + 10, cy);
  }

  // ---- minimap ---------------------------------------------------------------
  updateMinimap(dt, world, px, pz, camYaw, pois, state) {
    this._miniT -= dt;
    const S = this.mini.width;
    const SPAN = 460; // meters across
    if (this._miniT <= 0) {
      this._miniT = 0.7;
      const N = 46;
      const img = this.mctx.createImageData(N, N);
      for (let iy = 0; iy < N; iy++) {
        for (let ix = 0; ix < N; ix++) {
          const wx = px + (ix / N - 0.5) * SPAN;
          const wz = pz + (iy / N - 0.5) * SPAN;
          const h = world.heightAt(wx, wz);
          const col = world.colorAt(wx, wz, h, 0.2);
          const o = (iy * N + ix) * 4;
          img.data[o] = col[0] * 255; img.data[o + 1] = col[1] * 255; img.data[o + 2] = col[2] * 255;
          img.data[o + 3] = 255;
        }
      }
      this._miniImg = img;
    }
    const c = this.mctx;
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath();
    c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    c.clip();
    if (this._miniImg) {
      // draw the sampled patch scaled up (reuse one scratch canvas)
      if (!this._tmp) {
        this._tmp = document.createElement('canvas');
        this._tmp.width = this._tmp.height = this._miniImg.width;
        this._tmpCtx = this._tmp.getContext('2d');
      }
      this._tmpCtx.putImageData(this._miniImg, 0, 0);
      c.imageSmoothingEnabled = true;
      c.drawImage(this._tmp, 0, 0, S, S);
    }
    // water tint at sea level handled by colorAt already
    const SPAN_HALF = 460 / 2;
    for (const p of pois) {
      const dx = (p.x - px) / SPAN_HALF, dz = (p.z - pz) / SPAN_HALF;
      if (dx * dx + dz * dz > 1) continue;
      const x = S / 2 + dx * S / 2, y = S / 2 + dz * S / 2;
      const known = state.discovered.has(p.id);
      const rumor = state.rumors.has(p.id);
      if (!known && !rumor) continue;
      c.font = '11px serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = !known ? 'rgba(240,230,200,0.75)' : p.type === 'shrine' && state.litShrines.has(p.id) ? '#ffd766' : '#f4efe2';
      c.fillText(known ? (TYPE_GLYPH[p.type] || '•') : '?', x, y);
    }
    // player arrow
    c.save();
    c.translate(S / 2, S / 2);
    c.rotate(-camYaw + Math.PI);
    c.fillStyle = '#ffffff';
    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(4.6, 5); c.lineTo(0, 2.4); c.lineTo(-4.6, 5);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
    c.restore();
    // ring
    c.beginPath();
    c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(230,225,210,0.55)';
    c.lineWidth = 2;
    c.stroke();
    // N
    c.fillStyle = '#ff8a66';
    c.font = '600 12px Georgia, serif';
    c.textAlign = 'center';
    c.fillText('N', S / 2, 11);
  }

  // ---- journal ---------------------------------------------------------------
  renderJournal(game) {
    const { state, stats, seed, day, knownPois } = game;
    const relics = state.relics.size;
    const shrines = state.litShrines.size;
    const disc = state.discovered.size;
    const km = (stats.dist / 1000).toFixed(1);
    const hours = Math.floor(stats.playTime / 3600);
    const mins = Math.floor((stats.playTime % 3600) / 60);
    let rows = '';
    const byType = {};
    for (const p of knownPois) (byType[p.type] || (byType[p.type] = [])).push(p);
    for (const [type, list] of Object.entries(byType)) {
      rows += `<div class="j-type">${TYPE_PLURAL[type] || type}</div>`;
      for (const p of list) {
        const extra = type === 'shrine'
          ? (state.litShrines.has(p.id) ? ' <span class="lit">✦ awakened</span>' : ' <span class="dim">dormant</span>')
          : (p.hasRelic ? (state.relics.has(p.id) ? ' <span class="lit">◆ relic taken</span>' : ' <span class="dim">◆ relic remains</span>') : '');
        rows += `<div class="j-row">${TYPE_GLYPH[type] || '•'} ${p.name}${extra}</div>`;
      }
    }
    if (!rows) rows = '<div class="j-row dim">Nothing yet. The world is out there.</div>';
    this.journal.querySelector('.j-body').innerHTML = `
      <div class="j-stats">
        <div><b>${disc}</b><span>places found</span></div>
        <div><b>${relics}</b><span>relics</span></div>
        <div><b>${shrines}</b><span>shrines lit</span></div>
        <div><b>${km}<i>km</i></b><span>traveled</span></div>
        <div><b>${day}</b><span>days</span></div>
        <div><b>${hours}h ${mins}m</b><span>out here</span></div>
      </div>
      <div class="j-list">${rows}</div>
      <div class="j-seed">world seed ${seed}</div>`;
  }

  regionLabel(world, biome) {
    return (BIOMES[biome] && BIOMES[biome].label) || '';
  }
}

export { TYPE_GLYPH, TYPE_LABEL };
