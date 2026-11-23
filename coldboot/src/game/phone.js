// Your phone (Tab). Five apps, Q/E to flip between them:
//   MAP      north-up Port Zarya: streets, buildings, you, the objective,
//            friends you know; pan with WASD, X zooms, Enter drops a waypoint
//   JOURNAL  the day, what you're doing, what's open, Night School, meters
//   PEOPLE   everyone you've met and how close you are
//   TOWN     the restoration projects and Town Spirit
//   WALLET   money and what's in your pockets
// M opens the map, J the journal. The world keeps turning while you look.
import { input } from '../core/input.js';
import { C, W, H, text, vText, panel, hints, hit, roundRect, statBar, MONO_FONT } from '../core/ui.js';
import { TOWN } from '../world/townplan.js';
import { shoreZ } from '../world/terrain.js';
import { CAST } from '../data/cast.js';
import { ALL_MISSIONS } from '../data/script/index.js';
import { REPAIRS } from '../data/script/side_town.js';
import { LESSONS } from '../code/lessons.js';
import { CHALLENGE_ORDER } from '../code/challenges.js';
import { ITEMS } from './economy.js';
import { relLevel, REL_NAMES } from './state.js';

const APPS = [
  { id: 'map', label: 'MAP', icon: '◎' },
  { id: 'journal', label: 'JOURNAL', icon: '✎' },
  { id: 'people', label: 'PEOPLE', icon: '☺' },
  { id: 'town', label: 'TOWN', icon: '⌂' },
  { id: 'wallet', label: 'WALLET', icon: '$' },
];
const DOW = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT = {
  church: 'Church', koshkin: "Koshkin's", northstar: 'Northstar 24', hall: 'Parish Hall', cityhall: 'City Hall', police: 'Police',
  post: 'Post Office', clinic: 'Clinic', school: 'School', radio: 'KZRY Radio', diner: 'Diner', bar: 'Rusty Anchor',
  hardware: 'Hardware & Fuel', cannery: 'Cannery', harbor: 'Harbor', cabin: 'Your cabin', terminal: 'Airport', hangar: 'Tolliver Air',
  dome: 'The Dome', lighthouse: 'Lighthouse', cemetery: 'Cemetery',
};
const SPECIAL = { earpiece: 'Earpiece (Nadia)', passport: 'Passport', matryoshka: "Baba Valya's matryoshka", phone: 'Phone', drive: 'The drive', key: "Mayor's key", camera: 'Camera', lockpicks: 'Lockpicks' };

const PX = W - 540, PY = 26, PW = 500, PH = 668;     // the phone body
const SX = PX + 22, SY = PY + 96, SW = PW - 44, SH = PH - 150;   // its screen

export class Phone {
  constructor(G) {
    this.G = G;
    this.open = false;
    this.app = 'journal';
    this.t = 0;
    this.sel = 0;
    this.scroll = 0;
    this.map = { x: 0, z: 0, zoom: 1 };
  }

  toggle(app) {
    if (this.open && (!app || app === this.app)) return this.close();
    this.open = true;
    this.t = 0;
    this.fresh = true;          // the key that opened it is still "pressed" this frame
    this.setApp(app || this.app);
    this.G.player.locked = true;
    this.G.sfx?.buzz?.();
  }

  close() {
    this.open = false;
    this.G.player.locked = false;
  }

  setApp(id) {
    this.app = id;
    this.sel = 0;
    this.scroll = 0;
    if (id === 'map') { const p = this.G.player.pos; this.map.x = p.x; this.map.z = p.z; }
  }

  update(dt) {
    if (!this.open) return;
    if (this.fresh) { this.fresh = false; return; }
    this.t += dt;
    const G = this.G;
    if (this.t > 0.15 && (input.pressed('back') || input.pressed('phone'))) { this.close(); return; }
    if (input.pressed('tabL') || input.pressed('tabR')) {
      const i = APPS.findIndex((a) => a.id === this.app);
      this.setApp(APPS[(i + (input.pressed('tabR') ? 1 : APPS.length - 1)) % APPS.length].id);
      G.sfx?.ui?.('move');
    }
    if (input.pressed('map') && this.app !== 'map') this.setApp('map');
    if (input.pressed('journal') && this.app !== 'journal') this.setApp('journal');
    const h = hit.hover || '';
    const click = input.takeClick();
    if (click && h.startsWith('app:')) { this.setApp(h.slice(4)); G.sfx?.ui?.('move'); return; }
    if (this.app === 'map') {
      const k = 140 / this.map.zoom;
      this.map.x += input.move.x * k * dt;
      this.map.z -= input.move.y * k * dt;
      if (input.pressed('extra')) this.map.zoom = this.map.zoom >= 2 ? 0.35 : this.map.zoom >= 1 ? 2 : 1;
      if (input.pressed('confirm') || (click && h === 'map')) {
        const wp = G.hud.waypoint;
        if (wp && Math.hypot(wp.x - this.map.x, wp.z - this.map.z) < 12 / this.map.zoom) G.hud.waypoint = null;
        else G.hud.waypoint = { x: this.map.x, z: this.map.z };
        G.sfx?.ui?.('select');
      }
      if (input.pressed('replay')) { const p = G.player.pos; this.map.x = p.x; this.map.z = p.z; }
    } else {
      if (input.pressed('up')) this.sel = Math.max(0, this.sel - 1);
      if (input.pressed('down')) this.sel++;
    }
  }

  draw(ctx) {
    if (!this.open) return;
    const G = this.G, s = G.state;
    const k = Math.min(1, this.t * 6);
    ctx.save();
    ctx.translate(0, (1 - k) * 80);
    ctx.globalAlpha = k;
    // the body
    ctx.fillStyle = 'rgba(4,6,9,0.96)';
    roundRect(ctx, PX, PY, PW, PH, 34);
    ctx.fill();
    ctx.strokeStyle = 'rgba(127,230,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0a1018';
    roundRect(ctx, SX - 6, PY + 18, SW + 12, PH - 40, 22);
    ctx.fill();
    // status bar
    const hh = Math.floor(s.hour) % 24, mm = Math.floor((s.hour % 1) * 60);
    text(ctx, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, SX + 10, PY + 44, { size: 14, weight: 800, color: '#fff', font: MONO_FONT });
    text(ctx, 'ZARYA-TEL  ▂▄▆', SX + SW - 10, PY + 44, { size: 12, weight: 800, color: C.dim, align: 'right' });
    // app tabs
    const tw = SW / APPS.length;
    APPS.forEach((a, i) => {
      const x = SX + i * tw, on = a.id === this.app;
      hit.add('app:' + a.id, x, PY + 54, tw, 36);
      if (on) { ctx.fillStyle = 'rgba(127,230,255,0.14)'; ctx.fillRect(x + 2, PY + 54, tw - 4, 36); ctx.fillStyle = C.accent; ctx.fillRect(x + 8, PY + 88, tw - 16, 2); }
      text(ctx, `${a.icon} ${a.label}`, x + tw / 2, PY + 77, { size: 12, weight: 800, color: on ? '#fff' : C.dim, align: 'center', spacing: 1 });
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(SX, SY, SW, SH);
    ctx.clip();
    if (this.app === 'map') this._map(ctx);
    else if (this.app === 'journal') this._journal(ctx);
    else if (this.app === 'people') this._people(ctx);
    else if (this.app === 'town') this._town(ctx);
    else this._wallet(ctx);
    ctx.restore();
    ctx.restore();
    const hs = [['tabL', ''], ['tabR', 'APPS']];
    if (this.app === 'map') hs.push(['move', 'PAN'], ['extra', 'ZOOM'], ['confirm', 'WAYPOINT']);
    else hs.push(['ud', 'SCROLL']);
    hs.push(['phone', 'CLOSE']);
    hints(ctx, hs, { x: PX - 24 });
  }

  // -------------------------------------------------------------------- apps
  _list(ctx, rows, rowH, drawRow) {
    const visible = Math.floor(SH / rowH);
    this.sel = Math.min(this.sel, Math.max(0, rows.length - 1));
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + visible) this.scroll = this.sel - visible + 1;
    rows.slice(this.scroll, this.scroll + visible).forEach((r, i) => {
      const y = SY + i * rowH;
      const on = this.scroll + i === this.sel;
      if (on) { ctx.fillStyle = 'rgba(127,230,255,0.08)'; ctx.fillRect(SX, y, SW, rowH - 4); }
      drawRow(r, SX + 12, y, on);
    });
    if (rows.length > visible) {
      const bh = SH * visible / rows.length;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(SX + SW - 4, SY + (SH - bh) * (this.scroll / Math.max(1, rows.length - visible)), 3, bh);
    }
  }

  _map(ctx) {
    const G = this.G, s = G.state, m = this.map;
    const sc = 1.1 * m.zoom;            // px per metre
    const cx = SX + SW / 2, cy = SY + SH / 2;
    const tf = (x, z) => [cx + (x - m.x) * sc, cy + (z - m.z) * sc];
    ctx.fillStyle = '#c9d2da';
    ctx.fillRect(SX, SY, SW, SH);
    ctx.fillStyle = '#dfe6ec';
    ctx.fillRect(SX, SY, SW, SH);
    hit.add('map', SX, SY, SW, SH);
    // the sea
    const span = SW / sc / 2 + 40;
    ctx.fillStyle = '#5a7890';
    ctx.beginPath();
    for (let x = m.x - span; x <= m.x + span; x += 10) { const [a, b] = tf(x, shoreZ(x)); x === m.x - span ? ctx.moveTo(a, b) : ctx.lineTo(a, b); }
    ctx.lineTo(...tf(m.x + span, m.z + 4000));
    ctx.lineTo(...tf(m.x - span, m.z + 4000));
    ctx.fill();
    // streets with names
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const st of TOWN.streets) {
      ctx.strokeStyle = st.dirt ? '#b8aa94' : '#ffffff';
      ctx.lineWidth = Math.max(2, st.width * sc);
      ctx.beginPath();
      st.pts.forEach(([x, z], i) => { const [a, b] = tf(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
      ctx.stroke();
    }
    // buildings
    for (const b of G.buildingRects || []) {
      const c = Math.cos(b.rot), sn = Math.sin(b.rot);
      ctx.beginPath();
      [[-b.w / 2, -b.d / 2], [b.w / 2, -b.d / 2], [b.w / 2, b.d / 2], [-b.w / 2, b.d / 2]].forEach(([lx, lz], i) => {
        const [a, bb] = tf(b.x + lx * c + lz * sn, b.z - lx * sn + lz * c);
        i ? ctx.lineTo(a, bb) : ctx.moveTo(a, bb);
      });
      ctx.closePath();
      ctx.fillStyle = b.color ? '#36b8d8' : '#8a96a2';
      ctx.fill();
    }
    if (m.zoom >= 1) {
      for (const st of TOWN.streets) {
        const [x0, z0] = st.pts[0], [x1, z1] = st.pts[1];
        const [a, b] = tf((x0 + x1) / 2, (z0 + z1) / 2);
        text(ctx, st.name, a, b + 4, { size: 10, weight: 700, color: '#6a7480', align: 'center', shadow: false });
      }
    }
    for (const bd of TOWN.buildings) {
      const label = SHORT[bd.id];
      if (!label) continue;
      if (m.zoom < 1 && !['church', 'koshkin', 'northstar', 'cabin', 'terminal', 'dome', 'diner', 'cityhall', 'harbor'].includes(bd.id)) continue;
      const [a, b] = tf(bd.x, bd.z);
      text(ctx, label, a, b - 8, { size: 11, weight: 800, color: bd.id === 'cabin' ? '#a3221c' : '#1a2430', align: 'center', shadow: false });
    }
    // friends
    for (const [id, npc] of G.npcs?.list || []) {
      if (!s.met?.[id] || relLevel(s, id) < 1 || !npc.pos || npc.hidden) continue;
      const [a, b] = tf(npc.pos.x, npc.pos.z);
      ctx.fillStyle = CAST[id]?.color || '#ffd166';
      ctx.beginPath(); ctx.arc(a, b, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1a2430'; ctx.lineWidth = 1.5; ctx.stroke();
      if (m.zoom >= 1) text(ctx, CAST[id]?.short || id, a + 8, b + 4, { size: 10, weight: 800, color: '#1a2430', shadow: false });
    }
    // objective, waypoint, you
    const o = G.hud.objective?.target;
    if (o) this._diamond(ctx, ...tf(o.x, o.z), '#e8a000');
    const wp = G.hud.waypoint;
    if (wp) this._diamond(ctx, ...tf(wp.x, wp.z), '#a050e0');
    const p = G.player.pos;
    const [px, py] = tf(p.x, p.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-(G.player.yaw ?? 0) + Math.PI);
    ctx.fillStyle = '#e8203a';
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
    // crosshair
    ctx.strokeStyle = 'rgba(20,30,40,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
    // legend
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(SX + 8, SY + SH - 30, SW - 16, 22);
    text(ctx, `▲ you   ◆ objective   ◆ waypoint   ● friends   ·   ${m.zoom >= 2 ? 'close' : m.zoom >= 1 ? 'town' : 'region'}`, SX + 16, SY + SH - 14, { size: 11, weight: 700, color: '#1a2430', shadow: false });
  }

  _diamond(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  _journal(ctx) {
    const G = this.G, s = G.state;
    const rows = [];
    rows.push({ kind: 'day' });
    if (s.objective?.text) rows.push({ kind: 'now', text: s.objective.text, sub: s.objective.sub });
    const act = Object.keys(s.missions.active).map((id) => ({ id, def: ALL_MISSIONS[id] })).filter((x) => x.def?.title);
    const mains = act.filter((x) => x.def.main), sides = act.filter((x) => !x.def.main);
    if (mains.length) { rows.push({ kind: 'head', text: 'ASSIGNMENTS' }); for (const x of mains) rows.push({ kind: 'mission', text: x.def.title, main: true }); }
    if (sides.length) { rows.push({ kind: 'head', text: 'ALSO' }); for (const x of sides) rows.push({ kind: 'mission', text: x.def.title }); }
    rows.push({ kind: 'head', text: 'NIGHT SCHOOL' });
    const nl = LESSONS.filter((l) => s.lessons[l.id]).length;
    rows.push({ kind: 'meter', text: `Lessons  ${nl} / ${LESSONS.length}`, v: nl / LESSONS.length, color: C.green });
    const nh = CHALLENGE_ORDER.filter((c) => s.challenges[c]).length;
    rows.push({ kind: 'meter', text: `Field hacks  ${nh} / ${CHALLENGE_ORDER.length}`, v: nh / CHALLENGE_ORDER.length, color: C.green });
    rows.push({ kind: 'head', text: 'STANDING' });
    rows.push({ kind: 'meter', text: `Town Spirit  ${Math.round(s.spirit)}`, v: Math.min(1, s.spirit / 200), color: '#ffd166' });
    rows.push({ kind: 'meter', text: `Political standing  ${Math.round(s.standing)}`, v: Math.min(1, s.standing / 100), color: '#7fe6ff' });
    rows.push({ kind: 'meter', text: `Northstar attention  ${Math.round(s.attention)}%`, v: s.attention / 100, color: C.red });
    rows.push({ kind: 'note', text: `${Object.keys(s.missions.done).length} things done since you landed.` });
    this._list(ctx, rows, 58, (r, x, y) => {
      if (r.kind === 'day') {
        const left = 14 - s.day;
        vText(ctx, `DAY ${s.day}`, x, y + 30, 24, { color: '#fff', weight: 0.17 });
        text(ctx, DOW[(s.day - 1) % 7], x + 110, y + 30, { size: 16, weight: 700, color: C.dim });
        text(ctx, left > 0 ? `Wormwood wakes in ${left} day${left === 1 ? '' : 's'}` : 'Wormwood wakes at dawn', x, y + 50, { size: 12, weight: 800, color: left <= 3 ? C.red : C.dim });
      } else if (r.kind === 'now') {
        text(ctx, 'NOW', x, y + 18, { size: 11, weight: 800, color: '#ffd166', spacing: 2 });
        text(ctx, r.text, x, y + 38, { size: 16, weight: 700, color: '#fff' });
        if (r.sub) text(ctx, r.sub, x, y + 54, { size: 12, color: C.dim });
      } else if (r.kind === 'head') {
        text(ctx, r.text, x, y + 40, { size: 12, weight: 800, color: C.accent, spacing: 3 });
      } else if (r.kind === 'mission') {
        text(ctx, (r.main ? '◆ ' : '· ') + r.text, x, y + 34, { size: 16, weight: 700, color: r.main ? '#ffd166' : '#e8eef4' });
      } else if (r.kind === 'meter') {
        text(ctx, r.text, x, y + 24, { size: 14, weight: 700, color: '#e8eef4' });
        statBar(ctx, x, y + 34, SW - 40, 8, r.v, { color: r.color });
      } else text(ctx, r.text, x, y + 34, { size: 13, color: C.dim, italic: true });
    });
  }

  _people(ctx) {
    const s = this.G.state;
    const ids = Object.keys(s.met || {}).filter((id) => CAST[id] && id !== 'player');
    ids.sort((a, b) => (s.rel[b] || 0) - (s.rel[a] || 0));
    if (!ids.length) { text(ctx, "You haven't met anyone yet. Port Zarya is small; that won't last.", SX + 14, SY + 40, { size: 14, color: C.dim }); return; }
    this._list(ctx, ids, 62, (id, x, y, on) => {
      const L = relLevel(s, id), pts = s.rel[id] || 0;
      ctx.fillStyle = CAST[id].color || '#fff';
      ctx.beginPath(); ctx.arc(x + 14, y + 28, 12, 0, 7); ctx.fill();
      text(ctx, (CAST[id].short || CAST[id].name)[0], x + 14, y + 33, { size: 13, weight: 800, color: '#0a1018', align: 'center', shadow: false });
      text(ctx, CAST[id].name, x + 38, y + 24, { size: 16, weight: 700, color: on ? '#fff' : '#e8eef4' });
      text(ctx, REL_NAMES[L], x + 38, y + 44, { size: 12, weight: 800, color: L >= 3 ? '#ffd166' : C.dim, spacing: 1 });
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < L ? '#ff8aa0' : 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + SW - 140 + i * 22, y + 16, 16, 6);
      }
      if (L < 5) statBar(ctx, x + SW - 140, y + 32, 104, 5, (pts % 20) / 20, { color: '#ff8aa0', segments: 10 });
    });
  }

  _town(ctx) {
    const s = this.G.state;
    const all = Object.entries(REPAIRS || {}).map(([id, r]) => {
      const done = (s.repairs?.[id] || 0) >= 1;
      const open = !r.unlock || ((!r.unlock.day || s.day >= r.unlock.day) && (!r.unlock.flag || s.flags[r.unlock.flag]));
      return { id, r, done, open };
    });
    all.sort((a, b) => (a.done - b.done) || (b.open - a.open));
    const doneN = all.filter((x) => x.done).length;
    text(ctx, `TOWN SPIRIT  ${Math.round(s.spirit)}`, SX + 12, SY + 22, { size: 13, weight: 800, color: '#ffd166', spacing: 2 });
    text(ctx, `${doneN} of ${all.length} projects done`, SX + SW - 12, SY + 22, { size: 12, weight: 700, color: C.dim, align: 'right' });
    ctx.save();
    ctx.translate(0, 34);
    this._list(ctx, all, 64, (x0, x, y, on) => {
      const { r, done, open } = x0;
      text(ctx, (done ? '✓ ' : open ? '◇ ' : '· ') + r.name, x, y + 22, { size: 15, weight: 700, color: done ? C.green : open ? (on ? '#fff' : '#e8eef4') : C.faint });
      text(ctx, done ? 'Done.' : open ? r.hint || '' : r.unlock?.day ? `Not yet (day ${r.unlock.day})` : 'Not yet', x, y + 40, { size: 12, color: C.dim });
      if (!done && open && r.materials) text(ctx, Object.entries(r.materials).map(([k, n]) => `${n}× ${ITEMS[k] || k}`).join(' · '), x, y + 56, { size: 11, color: 'rgba(200,210,220,0.55)' });
    });
    ctx.restore();
  }

  _wallet(ctx) {
    const s = this.G.state;
    vText(ctx, `$${Math.floor(s.money)}`, SX + 14, SY + 44, 34, { color: '#9fe8b0', weight: 0.17 });
    text(ctx, 'Cash. Northstar takes cards; you pay cash.', SX + 14, SY + 70, { size: 12, color: C.dim, italic: true });
    const rows = Object.entries(s.inv || {}).filter(([, n]) => n > 0);
    ctx.save();
    ctx.translate(0, 90);
    this._list(ctx, rows, 34, ([k, n], x, y, on) => {
      text(ctx, SPECIAL[k] || ITEMS[k] || k, x, y + 22, { size: 15, weight: 700, color: SPECIAL[k] ? '#ffd166' : on ? '#fff' : '#e8eef4' });
      if (!SPECIAL[k] || n > 1) text(ctx, `× ${n}`, x + SW - 40, y + 22, { size: 14, weight: 800, color: C.dim, align: 'right' });
    });
    ctx.restore();
  }
}
