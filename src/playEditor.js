// The play designer: a chalkboard where you drag your skill players into an
// alignment, draw routes/paths waypoint by waypoint, and save plays into your
// game-day playbook.
import { OL_ALIGN, drawPlayArt } from './plays.js';
import { sfx } from './audio.js';

const ROLES = ['QB', 'RB', 'FB', 'WR1', 'WR2', 'TE'];
const ROLE_COLORS = { QB: '#ffd84a', RB: '#7ad0ff', FB: '#9fd0a0', WR1: '#ff9a4a', WR2: '#ff7ad0', TE: '#c0a0ff' };

function blankPlay() {
  return {
    id: 'custom_' + Date.now().toString(36),
    name: 'My Play',
    type: 'pass',
    shotgun: true,
    custom: true,
    rawZ: true,
    carrier: null,
    handoff: { x: -2.4, z: 0.4 },
    align: { QB: [-5.2, 0], RB: [-5.2, -1.9], FB: [-0.9, -7.5], WR1: [-0.9, -13], WR2: [-1.5, 11], TE: [-0.7, 3.9] },
    assignments: { WR1: { route: [] }, WR2: { route: [] }, TE: { route: [] }, RB: { route: [] }, FB: { route: [] } },
    paths: {},
    targets: [],
  };
}

export class PlayEditor {
  constructor(panelEl, boardEl, state, onBack) {
    this.panel = panelEl;
    this.holder = boardEl;
    this.state = state;
    this.onBack = onBack;
    this.play = blankPlay();
    this.sel = 'WR1';
    this.dragging = null;
    this.canvas = document.createElement('canvas');
    this.holder.innerHTML = '';
    this.holder.appendChild(this.canvas);
    this._onResize = () => this.layout();
    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('pointerdown', (e) => this.pointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.pointerMove(e));
    this.canvas.addEventListener('pointerup', () => { this.dragging = null; });
    this.layout();
    this.renderPanel();
    this.draw();
  }

  layout() {
    const w = this.holder.clientWidth, h = this.holder.clientHeight;
    if (!w) return;
    this.canvas.width = w;
    this.canvas.height = h;
    // field window: z from -27..27 across, x from -10 (backfield) to +28 (downfield)
    this.view = { x0: -10, x1: 30, z0: -27, z1: 27, w, h };
    this.draw();
  }

  // field coords → canvas px (downfield = up)
  px(x, z) {
    const v = this.view;
    return [((z - v.z0) / (v.z1 - v.z0)) * v.w, v.h - ((x - v.x0) / (v.x1 - v.x0)) * v.h];
  }

  field(mx, my) {
    const v = this.view;
    return [((v.h - my) / v.h) * (v.x1 - v.x0) + v.x0, (mx / v.w) * (v.z1 - v.z0) + v.z0];
  }

  pointerDown(e) {
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const [fx, fz] = this.field(mx, my);
    // grab an alignment dot?
    for (const role of ROLES) {
      const [ax, az] = this.play.align[role];
      const [cx, cy] = this.px(ax, az);
      if (Math.hypot(mx - cx, my - cy) < 14) {
        this.sel = role;
        this.dragging = role;
        this.renderPanel();
        this.draw();
        return;
      }
    }
    // otherwise: add a waypoint for the selected role
    if (this.sel && this.sel !== 'QB') {
      const a = this.play.align[this.sel];
      const isCarrier = this.play.carrier === this.sel;
      if (isCarrier) {
        const path = this.play.paths[this.sel] || (this.play.paths[this.sel] = []);
        path.push([round1(fx - 0), round1(fz - 0)]); // paths are ball-relative
      } else {
        const asg = this.play.assignments[this.sel];
        if (asg && asg.route) {
          asg.route.push([round1(fx - a[0]), round1(fz - a[1])]); // rawZ route, player-relative
        }
      }
      sfx.chime();
      this.refreshTargets();
      this.draw();
      this.renderPanel();
    }
  }

  pointerMove(e) {
    if (!this.dragging) return;
    const r = this.canvas.getBoundingClientRect();
    const [fx, fz] = this.field(e.clientX - r.left, e.clientY - r.top);
    // pre-snap alignment must be on/behind the line
    const x = Math.max(-9, Math.min(this.dragging === 'TE' ? -0.7 : -0.7, fx));
    const z = Math.max(-25, Math.min(25, fz));
    this.play.align[this.dragging] = [round1(Math.min(x, -0.7)), round1(z)];
    this.draw();
  }

  refreshTargets() {
    this.play.targets = this.play.type === 'pass'
      ? ROLES.filter((rl) => rl !== 'QB' && (this.play.assignments[rl]?.route?.length))
          .slice(0, 4)
      : [];
  }

  // ---------------------------------------------------------- chalkboard
  draw() {
    const ctx = this.canvas.getContext('2d');
    const v = this.view;
    if (!v) return;
    ctx.fillStyle = '#10231a';
    ctx.fillRect(0, 0, v.w, v.h);
    // yard lines every 5
    for (let x = -10; x <= 30; x += 5) {
      const [, y] = this.px(x, 0);
      ctx.strokeStyle = x === 0 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = x === 0 ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(v.w, y); ctx.stroke();
      if (x !== 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px Arial';
        ctx.fillText(`${x > 0 ? '+' : ''}${x}`, 8, y - 4);
      }
    }
    // hashes
    for (const hz of [-8.89, 8.89]) {
      const [hx] = this.px(0, hz);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.setLineDash([3, 7]);
      ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, v.h); ctx.stroke();
      ctx.setLineDash([]);
    }
    // OL
    for (const k in OL_ALIGN) {
      const [cx, cy] = this.px(OL_ALIGN[k][0], OL_ALIGN[k][1]);
      ctx.strokeStyle = '#cfc9b8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
    }
    // routes / paths
    for (const role of ROLES) {
      if (role === 'QB') continue;
      const a = this.play.align[role];
      const [sx, sy] = this.px(a[0], a[1]);
      const isCarrier = this.play.carrier === role;
      const pts = isCarrier
        ? (this.play.paths[role] || []).map(([dx, dz]) => this.px(dx, dz))
        : (this.play.assignments[role]?.route || []).map(([dx, dz]) => this.px(a[0] + dx, a[1] + dz));
      if (pts.length) {
        ctx.strokeStyle = isCarrier ? '#ff7a4a' : ROLE_COLORS[role];
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.stroke();
        const last = pts[pts.length - 1];
        const prev = pts.length > 1 ? pts[pts.length - 2] : [sx, sy];
        const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(last[0], last[1]);
        ctx.lineTo(last[0] - 11 * Math.cos(ang - 0.45), last[1] - 11 * Math.sin(ang - 0.45));
        ctx.lineTo(last[0] - 11 * Math.cos(ang + 0.45), last[1] - 11 * Math.sin(ang + 0.45));
        ctx.closePath(); ctx.fill();
      }
      // blockers get the T
      if (!isCarrier && this.play.assignments[role]?.block) {
        const [ex, ey] = this.px(a[0] + 1.6, a[1]);
        ctx.strokeStyle = '#9fd0ff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - 7, ey); ctx.lineTo(ex + 7, ey); ctx.stroke();
      }
    }
    // skill dots
    for (const role of ROLES) {
      const [ax, az] = this.play.align[role];
      const [cx, cy] = this.px(ax, az);
      const seld = role === this.sel;
      ctx.fillStyle = seld ? ROLE_COLORS[role] : '#10231a';
      ctx.strokeStyle = ROLE_COLORS[role];
      ctx.lineWidth = seld ? 3.5 : 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = seld ? '#10231a' : ROLE_COLORS[role];
      ctx.font = '700 9.5px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(role, cx, cy + 0.5);
    }
    // legend
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('DRAG a dot to set the alignment · CLICK the field to add waypoints for the selected player', 12, v.h - 12);
  }

  // ---------------------------------------------------------- side panel
  renderPanel() {
    const p = this.panel;
    const play = this.play;
    p.innerHTML = '';
    const el = (tag, cls, html) => {
      const d = document.createElement(tag);
      if (cls) d.className = cls;
      if (html !== undefined) d.innerHTML = html;
      return d;
    };
    p.appendChild(el('h2', 'panel-title', 'PLAY DESIGNER'));

    const nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.maxLength = 18; nameIn.value = play.name;
    nameIn.addEventListener('input', () => { play.name = nameIn.value || 'My Play'; });
    const nameField = el('label', 'field');
    nameField.appendChild(el('span', 'field-label', 'PLAY NAME'));
    nameField.appendChild(nameIn);
    p.appendChild(nameField);

    p.appendChild(el('h3', 'panel-sub', 'TYPE'));
    const segRow = el('div', 'seg-row');
    for (const [val, label] of [['pass', 'PASS'], ['run', 'RUN']]) {
      const b = el('button', 'seg' + (play.type === val ? ' on' : ''), label);
      b.onclick = () => {
        play.type = val;
        if (val === 'run' && !play.carrier) play.carrier = 'RB';
        if (val === 'pass') play.carrier = null;
        this.refreshTargets();
        sfx.chime(); this.renderPanel(); this.draw();
      };
      segRow.appendChild(b);
    }
    const gunB = el('button', 'seg' + (play.shotgun ? ' on' : ''), 'SHOTGUN');
    gunB.onclick = () => {
      play.shotgun = !play.shotgun;
      play.align.QB = play.shotgun ? [-5.2, 0] : [-1.6, 0];
      sfx.chime(); this.renderPanel(); this.draw();
    };
    segRow.appendChild(gunB);
    p.appendChild(segRow);

    if (play.type === 'run') {
      p.appendChild(el('h3', 'panel-sub', 'BALL CARRIER'));
      const carRow = el('div', 'seg-row');
      for (const rl of ['RB', 'FB', 'WR1', 'WR2', 'QB']) {
        const b = el('button', 'seg' + (play.carrier === rl ? ' on' : ''), rl);
        b.onclick = () => { play.carrier = rl; if (!play.paths[rl]) play.paths[rl] = []; sfx.chime(); this.renderPanel(); this.draw(); };
        carRow.appendChild(b);
      }
      p.appendChild(carRow);
    }

    p.appendChild(el('h3', 'panel-sub', 'PLAYERS — select, then click the field'));
    const list = el('div', 'ed-roles');
    for (const role of ROLES) {
      if (role === 'QB') continue;
      const row = el('div', 'ed-role' + (this.sel === role ? ' on' : ''));
      const dot = el('span', 'ed-dot');
      dot.style.background = ROLE_COLORS[role];
      row.appendChild(dot);
      row.appendChild(el('b', '', role));
      const isCarrier = play.carrier === role;
      const asg = play.assignments[role] || (play.assignments[role] = { route: [] });
      const status = isCarrier ? 'CARRIER' : asg.block ? 'BLOCK' : `${asg.route?.length || 0} pts`;
      row.appendChild(el('span', 'ed-status', status));
      const blockB = el('button', 'mini', asg.block ? '🛡' : '➰');
      blockB.title = asg.block ? 'Switch to route' : 'Switch to block';
      blockB.onclick = (e) => {
        e.stopPropagation();
        if (isCarrier) return;
        if (asg.block) { delete asg.block; asg.route = []; }
        else { asg.block = true; delete asg.route; }
        this.refreshTargets(); sfx.chime(); this.renderPanel(); this.draw();
      };
      const clearB = el('button', 'mini', '✖');
      clearB.title = 'Clear waypoints';
      clearB.onclick = (e) => {
        e.stopPropagation();
        if (isCarrier) play.paths[role] = [];
        else if (asg.route) asg.route = [];
        this.refreshTargets(); this.renderPanel(); this.draw();
      };
      row.appendChild(blockB);
      row.appendChild(clearB);
      row.onclick = () => { this.sel = role; this.renderPanel(); this.draw(); };
      list.appendChild(row);
    }
    p.appendChild(list);

    const undoB = el('button', 'seg', '↩ UNDO LAST POINT');
    undoB.onclick = () => {
      const role = this.sel;
      if (play.carrier === role) (play.paths[role] || []).pop();
      else (play.assignments[role]?.route || []).pop();
      this.draw(); this.renderPanel();
    };
    p.appendChild(undoB);

    // save / library
    const saveB = el('button', 'cta', '★ SAVE TO PLAYBOOK');
    saveB.onclick = () => {
      this.refreshTargets();
      if (play.type === 'run' && !(play.paths[play.carrier] || []).length) {
        alert('Draw a path for your ball carrier first (click the field).');
        return;
      }
      if (play.type === 'pass' && !play.targets.length) {
        alert('Give at least one player a route first.');
        return;
      }
      play.desc = 'Drawn up in your office.';
      const book = this.state.customPlays;
      const i = book.findIndex((x) => x.id === play.id);
      if (i >= 0) book[i] = JSON.parse(JSON.stringify(play));
      else book.push(JSON.parse(JSON.stringify(play)));
      sfx.firstDown();
      this.play = blankPlay();
      this.sel = 'WR1';
      this.renderPanel();
      this.draw();
    };
    p.appendChild(saveB);

    if (this.state.customPlays.length) {
      p.appendChild(el('h3', 'panel-sub', `YOUR PLAYBOOK (${this.state.customPlays.length})`));
      const lib = el('div', 'ed-lib');
      for (const cp of this.state.customPlays) {
        const row = el('div', 'ed-role');
        row.appendChild(el('b', '', cp.name));
        row.appendChild(el('span', 'ed-status', cp.type.toUpperCase()));
        const editB = el('button', 'mini', '✎');
        editB.onclick = () => { this.play = JSON.parse(JSON.stringify(cp)); this.sel = 'WR1'; this.renderPanel(); this.draw(); };
        const delB = el('button', 'mini', '🗑');
        delB.onclick = () => {
          this.state.customPlays = this.state.customPlays.filter((x) => x.id !== cp.id);
          this.renderPanel();
        };
        row.appendChild(editB);
        row.appendChild(delB);
        lib.appendChild(row);
      }
      p.appendChild(lib);
    }

    const backB = el('button', 'cta big', '◂ BACK TO THE OFFICE');
    backB.onclick = () => { sfx.back(); this.onBack(); };
    p.appendChild(backB);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.panel.innerHTML = '';
    this.holder.innerHTML = '';
  }
}

function round1(v) { return Math.round(v * 10) / 10; }
