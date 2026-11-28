// TONGUE SNACK — a tiny canvas minigame to play while you wait for a match
// (and on the Clash Tower's Sky Deck arcade). Your Chromeleon sits on a
// branch; click to flick your tongue at the bugs. Gold butterflies are worth
// a lot, and gray Drab drips gum up your tongue. Catch bugs in a row to build a combo.

const W = 480, H = 270;
const ROUND = 40;

const BUGS = {
  fly: { pts: 1, r: 7, speed: 95, color: '#2b2f45', wing: 'rgba(220,240,255,0.75)', weight: 6 },
  beetle: { pts: 2, r: 9, speed: 60, color: '#1e9e6a', wing: 'rgba(160,255,200,0.5)', weight: 3 },
  moth: { pts: 3, r: 10, speed: 75, color: '#a335ff', wing: 'rgba(230,200,255,0.7)', weight: 2 },
  gold: { pts: 8, r: 10, speed: 120, color: '#ffd21a', wing: 'rgba(255,240,170,0.9)', weight: 0.7 },
  drab: { pts: -4, r: 11, speed: 55, color: '#8a8f99', wing: null, weight: 1.6 },
};
const KINDS = Object.keys(BUGS);
const rand = (a, b) => a + Math.random() * (b - a);

export class TongueSnack {
  constructor(container, { ink = '#ff2e88', audio = null, best = 0, onBest = null, compact = false } = {}) {
    this.ink = ink;
    this.audio = audio;
    this.best = best || 0;
    this.onBest = onBest;
    const root = this.root = document.createElement('div');
    root.className = 'minigame' + (compact ? ' compact' : '');
    root.innerHTML = `<div class="mg-bar"><b>TONGUE SNACK</b><span class="mg-score">0</span><span class="mg-combo"></span><span class="mg-time"></span><span class="mg-best">BEST ${this.best}</span></div><canvas></canvas><div class="mg-over on"><div class="mg-msg"></div><button class="btn small go" data-mg="play">PLAY</button></div>`;
    container.appendChild(root);
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scoreEl = root.querySelector('.mg-score');
    this.comboEl = root.querySelector('.mg-combo');
    this.timeEl = root.querySelector('.mg-time');
    this.bestEl = root.querySelector('.mg-best');
    this.over = root.querySelector('.mg-over');
    this.msg = root.querySelector('.mg-msg');
    this.msg.innerHTML = 'Click to flick your tongue at the bugs.<br><span style="color:#ffd21a">Gold</span> butterflies are worth the most. Don\'t lick the <span style="color:#aab">gray goo</span>!';
    root.querySelector('[data-mg="play"]').onclick = (e) => { e.stopPropagation(); this.start(); };
    this.aim = { x: W / 2, y: H / 2 };
    this.mouth = { x: W / 2, y: H - 46 };
    this.state = 'menu';
    this.bugs = [];
    this.splats = [];
    this.pops = [];
    this.leaves = Array.from({ length: 14 }, (_, i) => ({ x: (i / 13) * W + rand(-20, 20), y: rand(-10, 40), r: rand(26, 50), a: rand(0, 6), c: Math.random() < 0.5 ? '#1c6b4a' : '#2a8a5c' }));
    this.tongue = null;
    this.t = 0;
    this.score = 0;
    this.combo = 0;
    this.gummed = 0;
    this.blink = 0;
    this.onDown = (e) => {
      const p = this.pos(e);
      this.aim = p;
      if (this.state === 'play') this.flick();
    };
    this.onMove = (e) => { this.aim = this.pos(e); };
    this.onKey = (e) => {
      if (e.code !== 'Space' || this.state !== 'play' || !root.isConnected) return;
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      this.flick();
    };
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    addEventListener('keydown', this.onKey);
    this.resize();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this.ro?.observe(root);
    this.last = performance.now();
    const loop = (now) => {
      if (this.dead) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!root.isConnected) return;
      this.update(dt);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(240, Math.round((r.width || W) * dpr));
    if (this.canvas.width !== w) { this.canvas.width = w; this.canvas.height = Math.round(w * H / W); }
  }

  sfx(n, o) { try { this.audio?.sfx?.(n, o); } catch { /* audio is optional */ } }

  start() {
    this.state = 'play';
    this.over.classList.remove('on');
    this.score = 0; this.combo = 0; this.t = 0; this.timeLeft = ROUND;
    this.bugs.length = 0; this.splats.length = 0; this.pops.length = 0;
    this.tongue = null; this.gummed = 0; this.spawnT = 0.2;
    this.sfx('ui_select');
  }

  end() {
    this.state = 'over';
    const nb = this.score > this.best;
    if (nb) { this.best = this.score; this.onBest?.(this.best); this.bestEl.textContent = `BEST ${this.best}`; }
    this.msg.innerHTML = `${nb ? '<b style="color:#ffd21a">NEW BEST!</b><br>' : ''}You snacked <b>${this.score}</b> points.`;
    this.over.querySelector('button').textContent = 'PLAY AGAIN';
    this.over.classList.add('on');
    this.sfx(nb ? 'coin' : 'whistle', { volume: 0.5 });
  }

  flick() {
    if (this.tongue || this.gummed > 0) return;
    const dx = this.aim.x - this.mouth.x, dy = this.aim.y - this.mouth.y;
    const d = Math.hypot(dx, dy) || 1;
    this.tongue = { dx: dx / d, dy: dy / d, len: 0, max: Math.min(290, Math.max(60, d + 12)), out: true, caught: [] };
    this.sfx('tongue', { volume: 0.5, pitch: 1.1 + Math.random() * 0.2 });
  }

  spawn() {
    let tot = 0;
    for (const k of KINDS) tot += BUGS[k].weight;
    let r = Math.random() * tot, kind = 'fly';
    for (const k of KINDS) { r -= BUGS[k].weight; if (r <= 0) { kind = k; break; } }
    const B = BUGS[kind];
    const fromLeft = Math.random() < 0.5;
    const y = rand(24, H - 110);
    const sp = B.speed * rand(0.8, 1.25) * (1 + this.t / ROUND * 0.5);
    this.bugs.push({ kind, x: fromLeft ? -20 : W + 20, y, vx: fromLeft ? sp : -sp, vy: 0, a: rand(0, 6), r: B.r, t: 0, wob: rand(1.5, 3.5) });
  }

  update(dt) {
    this.blink -= dt;
    if (this.blink < -3) this.blink = 0.12;
    for (const s of this.splats) s.a = Math.max(0, s.a - dt * 0.05);
    for (let i = this.pops.length - 1; i >= 0; i--) { const p = this.pops[i]; p.t += dt; p.y -= dt * 30; if (p.t > 0.9) this.pops.splice(i, 1); }
    if (this.state !== 'play') {
      // idle flutter in the menu
      if (this.bugs.length < 4 && Math.random() < dt) this.spawn();
      this.moveBugs(dt);
      return;
    }
    this.t += dt;
    this.timeLeft -= dt;
    this.gummed = Math.max(0, this.gummed - dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawn(); this.spawnT = rand(0.35, 0.8) * (1 - this.t / ROUND * 0.35); }
    this.moveBugs(dt);
    // tongue
    const tg = this.tongue;
    if (tg) {
      if (tg.out) {
        tg.len += dt * 1500;
        if (tg.len >= tg.max) { tg.len = tg.max; tg.out = false; }
      } else tg.len -= dt * 1100;
      const tx = this.mouth.x + tg.dx * tg.len, ty = this.mouth.y + tg.dy * tg.len;
      for (const c of tg.caught) { c.x = tx; c.y = ty; }
      if (tg.out || tg.caught.length === 0) {
        for (let i = this.bugs.length - 1; i >= 0; i--) {
          const b = this.bugs[i];
          if (Math.hypot(b.x - tx, b.y - ty) < b.r + 9) {
            this.bugs.splice(i, 1);
            if (b.kind === 'drab') {
              this.gummed = 1.1; this.combo = 0; tg.out = false;
              this.addPoints(BUGS.drab.pts, b.x, b.y, '#aab0bb');
              this.sfx('ui_error', { volume: 0.6 });
              this.splats.push({ x: b.x, y: b.y, r: 16, c: '#8a8f99', a: 0.9, seed: Math.random() });
            } else {
              tg.caught.push(b); tg.out = false;
            }
          }
        }
      }
      if (tg.len <= 0) {
        if (tg.caught.length) {
          for (const b of tg.caught) {
            this.combo++;
            const mult = Math.min(5, 1 + Math.floor(this.combo / 3));
            const pts = BUGS[b.kind].pts * mult;
            this.addPoints(pts, this.mouth.x + rand(-20, 20), this.mouth.y - 30, b.kind === 'gold' ? '#ffd21a' : '#fff');
            this.splats.push({ x: b.x0 ?? rand(40, W - 40), y: b.y0 ?? rand(30, H - 120), r: 10 + pts * 2, c: this.ink, a: 0.8, seed: Math.random() });
            this.sfx(b.kind === 'gold' ? 'coin' : 'pickup', { volume: 0.45, pitch: 0.9 + Math.min(0.6, this.combo * 0.05) });
          }
        } else if (!this.gummed) this.combo = 0;
        this.tongue = null;
      }
    }
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(); }
    this.scoreEl.textContent = this.score;
    const mult = Math.min(5, 1 + Math.floor(this.combo / 3));
    this.comboEl.textContent = mult > 1 ? `COMBO ×${mult}` : '';
    this.timeEl.textContent = `${Math.ceil(this.timeLeft)}s`;
  }

  moveBugs(dt) {
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const b = this.bugs[i];
      b.t += dt; b.a += dt * 30;
      if (b.kind === 'gold' || b.kind === 'moth') b.vy = Math.sin(b.t * b.wob) * 70;
      else if (b.kind === 'fly') { if (Math.random() < dt * 2) b.vy = rand(-80, 80); }
      else if (b.kind === 'drab') b.vy = Math.sin(b.t * 1.4) * 18 + 8;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.y = Math.max(16, Math.min(H - 90, b.y));
      b.x0 = b.x; b.y0 = b.y;
      if (b.x < -40 || b.x > W + 40) this.bugs.splice(i, 1);
    }
  }

  addPoints(n, x, y, c) {
    this.score = Math.max(0, this.score + n);
    this.pops.push({ x, y, t: 0, txt: (n > 0 ? '+' : '') + n, c });
  }

  draw() {
    const c = this.ctx, k = this.canvas.width / W;
    c.setTransform(k, 0, 0, k, 0, 0);
    // backdrop
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b1f5c'); g.addColorStop(0.55, '#c8507a'); g.addColorStop(1, '#ffb070');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // ink splats you've earned
    for (const s of this.splats) {
      c.globalAlpha = s.a * 0.85; c.fillStyle = s.c;
      c.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2, rr = s.r * (0.75 + 0.35 * Math.sin(a * 3 + s.seed * 20));
        c[i ? 'lineTo' : 'moveTo'](s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
      }
      c.fill();
    }
    c.globalAlpha = 1;
    // canopy
    for (const l of this.leaves) {
      c.fillStyle = l.c;
      c.beginPath(); c.ellipse(l.x, l.y, l.r, l.r * 0.55, l.a, 0, Math.PI * 2); c.fill();
    }
    // bugs
    for (const b of this.bugs) this.drawBug(c, b);
    if (this.tongue) for (const b of this.tongue.caught) this.drawBug(c, b);
    // branch
    c.fillStyle = '#5a3a24';
    c.beginPath(); c.moveTo(0, H - 22); c.quadraticCurveTo(W / 2, H - 34, W, H - 18); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = '#3f7a3a';
    for (const x of [70, 150, 330, 420]) { c.beginPath(); c.ellipse(x, H - 30, 16, 7, -0.4, 0, Math.PI * 2); c.fill(); }
    this.drawChameleon(c);
    // popups
    c.font = 'bold 16px "Lilita One", "Arial Black", sans-serif'; c.textAlign = 'center';
    for (const p of this.pops) {
      c.globalAlpha = Math.max(0, 1 - p.t / 0.9);
      c.lineWidth = 4; c.strokeStyle = '#1b1530'; c.strokeText(p.txt, p.x, p.y);
      c.fillStyle = p.c; c.fillText(p.txt, p.x, p.y);
    }
    c.globalAlpha = 1;
    // aim reticle
    if (this.state === 'play') {
      c.strokeStyle = this.gummed > 0 ? 'rgba(170,176,187,0.9)' : 'rgba(255,255,255,0.8)';
      c.lineWidth = 2;
      c.beginPath(); c.arc(this.aim.x, this.aim.y, 8, 0, Math.PI * 2); c.stroke();
    }
  }

  drawBug(c, b) {
    const B = BUGS[b.kind];
    c.save(); c.translate(b.x, b.y);
    if (b.vx < 0) c.scale(-1, 1);
    if (b.kind === 'drab') {
      // a gray drip of goo with sad eyes
      c.fillStyle = '#8a8f99';
      c.beginPath(); c.moveTo(0, -b.r * 1.3); c.quadraticCurveTo(b.r * 1.1, 0, 0, b.r); c.quadraticCurveTo(-b.r * 1.1, 0, 0, -b.r * 1.3); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-3, -1, 2.4, 0, 7); c.arc(3, -1, 2.4, 0, 7); c.fill();
      c.fillStyle = '#222'; c.beginPath(); c.arc(-3, 0, 1.2, 0, 7); c.arc(3, 0, 1.2, 0, 7); c.fill();
      c.restore(); return;
    }
    const flap = Math.sin(b.a) * 0.8;
    c.fillStyle = B.wing;
    c.beginPath(); c.ellipse(-2, -b.r * 0.6, b.r * 0.9, b.r * 0.45 * (0.4 + Math.abs(flap)), -0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(2, -b.r * 0.6, b.r * 0.8, b.r * 0.4 * (0.4 + Math.abs(flap)), 0.5, 0, Math.PI * 2); c.fill();
    if (b.kind === 'gold') { c.shadowColor = '#ffd21a'; c.shadowBlur = 12; }
    c.fillStyle = B.color;
    c.beginPath(); c.ellipse(0, 0, b.r * 0.85, b.r * 0.55, 0, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(b.r * 0.55, -1.5, 2, 0, 7); c.fill();
    c.restore();
  }

  drawChameleon(c) {
    const m = this.mouth, ink = this.ink;
    const bx = m.x - 26, by = m.y + 12;
    // tail curl
    c.strokeStyle = ink; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(bx - 24, by + 2); c.quadraticCurveTo(bx - 52, by + 6, bx - 50, by - 12);
    c.arc(bx - 40, by - 12, 10, Math.PI, Math.PI * 2.6); c.stroke();
    // legs
    c.strokeStyle = '#1b1530'; c.lineWidth = 4;
    for (const lx of [bx - 14, bx + 14]) { c.beginPath(); c.moveTo(lx, by + 10); c.lineTo(lx + 3, by + 22); c.stroke(); }
    // body
    c.fillStyle = ink;
    c.beginPath(); c.ellipse(bx, by, 30, 17, -0.08, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.beginPath(); c.ellipse(bx - 4, by - 7, 18, 5, -0.1, 0, Math.PI * 2); c.fill();
    // crest
    c.fillStyle = ink;
    c.beginPath(); c.moveTo(m.x - 6, m.y - 6); c.quadraticCurveTo(m.x + 4, m.y - 34, m.x + 16, m.y - 12); c.fill();
    // head
    c.beginPath(); c.ellipse(m.x + 6, m.y + 2, 18, 13, 0.1, 0, Math.PI * 2); c.fill();
    // tongue
    const tg = this.tongue;
    if (tg) {
      const tx = m.x + tg.dx * tg.len, ty = m.y + tg.dy * tg.len;
      c.strokeStyle = '#ff6fa8'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(m.x + 14, m.y + 6); c.lineTo(tx, ty); c.stroke();
      c.fillStyle = this.gummed > 0 ? '#8a8f99' : '#ff3f86';
      c.beginPath(); c.arc(tx, ty, 7, 0, Math.PI * 2); c.fill();
    }
    // turret eyes — each tracks the aim on its own
    for (const [ex, ey, lag] of [[m.x + 2, m.y - 6, 1], [m.x + 14, m.y - 4, 0.85]]) {
      const a = Math.atan2(this.aim.y - ey, this.aim.x - ex) * lag;
      c.fillStyle = ink; c.beginPath(); c.arc(ex, ey, 7.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, 5.5, 0, Math.PI * 2); c.fill();
      if (this.blink > 0) { c.fillStyle = ink; c.fillRect(ex - 6, ey - 1.5, 12, 3); }
      else { c.fillStyle = '#1b1530'; c.beginPath(); c.arc(ex + Math.cos(a) * 2.6, ey + Math.sin(a) * 2.6, 2.6, 0, Math.PI * 2); c.fill(); }
    }
    if (this.gummed > 0) {
      c.fillStyle = '#c8ccd4'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center';
      c.fillText('BLEH!', m.x + 30, m.y - 26);
    }
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    removeEventListener('keydown', this.onKey);
    this.ro?.disconnect();
    this.root.remove();
  }
}
