// TUNNEL RUN — the arcade cabinet in Car 6. Run the tunnel, hop the junk,
// grab tokens, duck the pigeons (by not jumping), and pray for pizza.
// Tap / click / SPACE / ↑ / W to jump; hold for height; one double jump.
import { openArcade } from './frame.js';
import { rrect, rect, ellipse, blob, stroke, text, dot, shape, FONTS, INK, mulberry32, makeCanvas } from '../ink.js';
import { drawFigure } from '../art/figure.js';
import { tag } from '../art/graffiti.js';
import { devParams } from '../dev.js';

const W = 800, H = 450;
const GROUND = 366;       // feet line
const RUN_X = 170;
const GRAV = 2500, JUMP_V = 860, DOUBLE_V = 760, CUT = 0.42;
const START_SPEED = 360, MAX_SPEED = 920, ACCEL = 11;
const UNIT_M = 1 / 30;    // world units → meters
const PIZZA_TIME = 4;
const PR = 2;             // pre-render resolution

const GRADES = [['S', 1200], ['A', 800], ['B', 500], ['C', 250], ['D', 0]];
const CRASH_TITLES = { bag: 'TRASHED', cone: 'CONED', turnstile: 'TURNSTILED', pigeon: "PIGEON'D" };

// ---------------------------------------------------------------- pre-rendered layers

function makeFarWall() {
  const SW = 1600;
  const c = makeCanvas(SW * PR, H * PR);
  const g = c.getContext('2d');
  g.scale(PR, PR);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d0a1c');
  grad.addColorStop(0.45, '#231b46');
  grad.addColorStop(0.8, '#1a1436');
  g.fillStyle = grad;
  g.fillRect(0, 0, SW, H);
  // bricks
  g.strokeStyle = 'rgba(8,5,20,0.55)';
  g.lineWidth = 1.4;
  for (let y = 40; y < GROUND; y += 16) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(SW, y); g.stroke();
    for (let x = ((y / 16) % 2) * 18; x < SW; x += 36) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
  }
  const r = mulberry32(77);
  // grime + water streaks
  for (let i = 0; i < 26; i++) {
    const x = r() * SW, len = 80 + r() * 200;
    const sg = g.createLinearGradient(0, 60, 0, 60 + len);
    sg.addColorStop(0, 'rgba(0,0,0,0.35)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg;
    g.fillRect(x, 60, 8 + r() * 18, len);
  }
  // cable runs
  for (const [y, col, sag] of [[96, '#0a0716', 10], [112, '#3a2030', 14], [128, '#0a0716', 8]]) {
    g.strokeStyle = col;
    g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= SW; x += 200) {
      if (x === 0) g.moveTo(x, y);
      else g.quadraticCurveTo(x - 100, y + sag, x, y);
    }
    g.stroke();
  }
  // graffiti + signs
  const words = ['DRIP', 'LINE', 'NOVA', 'SKUM', 'OKAY', 'ZEEK', 'MOTOR', 'VYBE'];
  for (let i = 0; i < 8; i++) tag(g, 100 + i * 200 + r() * 60, 210 + r() * 90, { word: words[i], seed: 400 + i, alpha: 0.42, size: 30 + r() * 18 });
  for (let i = 0; i < 4; i++) {
    const x = 160 + i * 400;
    rrect(g, x, 150, 22, 46, 4, { fill: '#0d0b18', lw: 2.4, seed: x });
    dot(g, x + 11, 163, 5, i % 2 ? '#7ed957' : '#e8456b');
    dot(g, x + 11, 183, 5, '#2a2020');
  }
  // vent grilles
  for (let i = 0; i < 3; i++) {
    const x = 340 + i * 520;
    ellipse(g, x, 300, 26, 26, { fill: '#120e22', lw: 2.6, seed: x });
    for (let k = -18; k <= 18; k += 6) stroke(g, [[x + k, 300 - Math.sqrt(Math.max(0, 600 - k * k))], [x + k, 300 + Math.sqrt(Math.max(0, 600 - k * k))]], { lw: 1.4, color: '#2a2246', amp: 0 });
  }
  return { canvas: c, w: SW };
}

function makeCrt() {
  const c = makeCanvas(W * PR, H * PR);
  const g = c.getContext('2d');
  g.scale(PR, PR);
  g.fillStyle = 'rgba(0,0,0,0.13)';
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  return c;
}

let farWall = null, crt = null;

// ---------------------------------------------------------------- obstacle art

function drawBag(g, x, o) {
  const h = o.h, w = o.w;
  g.save();
  g.translate(x + w / 2, GROUND);
  g.scale(1 + Math.sin(o.wob) * 0.03, 1 - Math.sin(o.wob) * 0.03);
  blob(g, [['M', -w / 2, 0], ['C', -w / 2 - 4, -h * 0.7, -w * 0.22, -h, 0, -h * 0.92], ['C', w * 0.22, -h, w / 2 + 4, -h * 0.7, w / 2, 0], ['Z']],
    { fill: '#25212f', shade: '#15121e', sdx: 3, sdy: 2, lw: 3, seed: o.seed });
  blob(g, [['M', -6, -h * 0.9], ['L', -12, -h - 10], ['L', 0, -h * 0.97], ['L', 12, -h - 10], ['L', 6, -h * 0.9], ['Z']], { fill: '#25212f', lw: 2.6, seed: o.seed + 1 });
  stroke(g, [[-7, -h * 0.93], [7, -h * 0.93]], { lw: 3, color: '#ffd23f', amp: 0 });
  stroke(g, [[-w * 0.28, -h * 0.55], [-w * 0.14, -h * 0.75]], { lw: 3, color: 'rgba(255,255,255,0.22)', amp: 0 });
  g.restore();
}

function drawCone(g, x, o) {
  const w = o.w, h = o.h;
  rrect(g, x - 6, GROUND - 8, w + 12, 9, 2, { fill: '#2a2238', lw: 2.6, seed: o.seed });
  shape(g, [[x + w * 0.38, GROUND - h], [x + w * 0.62, GROUND - h], [x + w, GROUND - 8], [x, GROUND - 8]], { fill: '#ff8a3d', shade: '#d4602a', sdx: 3, sdy: 0, lw: 3, seed: o.seed + 1 });
  g.save();
  g.beginPath();
  g.moveTo(x + w * 0.38, GROUND - h); g.lineTo(x + w * 0.62, GROUND - h); g.lineTo(x + w, GROUND - 8); g.lineTo(x, GROUND - 8);
  g.closePath();
  g.clip();
  g.fillStyle = '#fffaf0';
  g.fillRect(x - 4, GROUND - h * 0.62, w + 8, 8);
  g.fillRect(x - 4, GROUND - h * 0.34, w + 8, 7);
  g.restore();
}

function drawTurnstile(g, x, o) {
  const w = o.w, h = o.h;
  rrect(g, x, GROUND - h + 10, w * 0.62, h - 10, 6, { fill: '#9aa0b8', shade: '#6a7090', sdx: 3, sdy: 0, lw: 3, seed: o.seed });
  rrect(g, x - 3, GROUND - h + 2, w * 0.62 + 6, 13, 4, { fill: '#c8ccdc', lw: 2.6, seed: o.seed + 1 });
  rrect(g, x + 7, GROUND - h - 8, w * 0.36, 11, 2, { fill: '#2a2e46', lw: 2.2, seed: o.seed + 2 });
  dot(g, x + w * 0.42, GROUND - h - 3, 2, '#7ed957');
  ellipse(g, x + w * 0.74, GROUND - h * 0.62, 7, 7, { fill: '#c8ccdc', lw: 2.4, seed: o.seed + 3 });
  stroke(g, [[x + w * 0.74, GROUND - h * 0.62], [x + w + 16, GROUND - h * 0.64]], { lw: 6, color: INK, amp: 0 });
  stroke(g, [[x + w * 0.74, GROUND - h * 0.62], [x + w + 16, GROUND - h * 0.64]], { lw: 3.4, color: '#d8dce8', amp: 0 });
  stroke(g, [[x + w * 0.74, GROUND - h * 0.62], [x + w * 0.84, GROUND - h * 0.36]], { lw: 6, color: INK, amp: 0 });
  stroke(g, [[x + w * 0.74, GROUND - h * 0.62], [x + w * 0.84, GROUND - h * 0.36]], { lw: 3.4, color: '#b8bcd0', amp: 0 });
}

function drawFlyingPigeon(g, x, y, o, t) {
  const flap = Math.sin(t * 18 + o.seed) * 0.9;
  g.save();
  g.translate(x, y);
  g.scale(-1, 1); // flying toward the runner
  // far wing
  g.save();
  g.rotate(-0.4 - flap * 0.6);
  blob(g, [['M', -4, -4], ['C', -10, -34, -34, -40, -40, -30], ['C', -28, -20, -18, -8, -4, 4], ['Z']], { fill: '#5d6b8f', lw: 2.6, seed: o.seed });
  g.restore();
  blob(g, [['M', -26, 2], ['L', -42, -6], ['L', -40, 6], ['L', -24, 8], ['Z']], { fill: '#5d6b8f', lw: 2.6, seed: o.seed + 1 });
  ellipse(g, -6, 2, 22, 13, { fill: '#8d9bc0', shade: '#6a779e', sdx: 2, sdy: 2, lw: 3, seed: o.seed + 2 });
  blob(g, [['M', 4, -6], ['C', 12, -12, 20, -6, 20, 2], ['C', 12, 6, 6, 4, 2, 2], ['Z']], { fill: '#4fae93', lw: 0, seed: o.seed + 3 });
  ellipse(g, 18, -6, 10, 9, { fill: '#8d9bc0', lw: 2.8, seed: o.seed + 4 });
  blob(g, [['M', 26, -8], ['L', 36, -5], ['L', 26, -2], ['Z']], { fill: '#3a3550', lw: 2.2, seed: o.seed + 5 });
  ellipse(g, 21, -8, 3.4, 3.4, { fill: '#ff9a3c', lw: 1.8, seed: o.seed + 6 });
  dot(g, 22, -8, 1.4, INK);
  // near wing
  g.save();
  g.rotate(0.2 + flap);
  blob(g, [['M', -2, -2], ['C', -6, -36, -26, -46, -38, -38], ['C', -26, -24, -16, -10, -4, 6], ['Z']], { fill: '#7787ad', lw: 2.8, seed: o.seed + 7 });
  g.restore();
  // dangling feet
  stroke(g, [[-8, 14], [-12, 22]], { lw: 2.4, color: '#ff8a5c', amp: 0 });
  stroke(g, [[0, 14], [-2, 22]], { lw: 2.4, color: '#ff8a5c', amp: 0 });
  g.restore();
}

function drawCoin(g, x, y, t, k = 1) {
  const spin = Math.cos(t * 5 + x * 0.02);
  g.save();
  g.translate(x, y);
  g.scale(Math.max(0.18, Math.abs(spin)) * k, k);
  ellipse(g, 0, 0, 11, 11, { fill: spin > 0 ? '#f0c24a' : '#d4a030', lw: 3, amp: 0.2, seed: 3 });
  ellipse(g, 0, 0, 6.5, 6.5, { fill: '#ffe08a', lw: 0, amp: 0, seed: 4 });
  dropMark(g, 0, 0, 5.5);
  g.restore();
}

// the paint-drop symbol stamped on every drip token
export function dropMark(g, x, y, r) {
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(x, y - r);
  g.bezierCurveTo(x + r * 0.35, y - r * 0.45, x + r * 0.62, y - r * 0.05, x + r * 0.62, y + r * 0.3);
  g.arc(x, y + r * 0.3, r * 0.62, 0, Math.PI);
  g.bezierCurveTo(x - r * 0.62, y - r * 0.05, x - r * 0.35, y - r * 0.45, x, y - r);
  g.fill();
}

function drawSlice(g, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shape(g, [[0, 0], [34, -10], [36, 0], [34, 10]], { fill: '#ffcf5a', shade: '#e8a83a', sdx: 2, sdy: 2, lw: 2.6, seed: 141 });
  rrect(g, 30, -12, 8, 24, 4, { fill: '#c8742e', lw: 2.4, seed: 142 });
  for (const [px, py] of [[14, -1], [24, -4], [24, 4]]) ellipse(g, px, py, 3, 2.6, { fill: '#e8456b', lw: 1.6, seed: 143 + px });
  g.restore();
}

// ---------------------------------------------------------------- the game

export function playRunner(ctx) {
  const econ = ctx.econ;
  const paidLeft = () => econ.rewardsLeft('runner');
  if (!farWall) farWall = makeFarWall();
  if (!crt) crt = makeCrt();
  return openArcade({
    id: 'runner',
    title: 'TUNNEL RUN',
    color: '#e8456b',
    blurb: 'The Car 6 arcade cabinet. One life. No continues.',
    logical: [W, H],
    stageBg: '#0c0a18',
    intro: {
      title: 'TUNNEL RUN',
      text: 'Tap, click or press SPACE to jump. Hold for height, tap again in the air to double jump. Hop the junk, stay low under pigeons, grab tokens. Pizza makes you unstoppable.',
      note: `Best: ${econ.S.bests.runner || 0}m · ${paidLeft() > 0 ? `paid plays left today: ${paidLeft()}` : 'no paid plays left today, so this one is for fun'}`,
      button: 'INSERT 25¢',
    },
    create(api) {
      const A = api.audio;
      const rnd = mulberry32(Math.floor(Math.random() * 1e9));
      let dist = 0, speed = START_SPEED, t = 0;
      let h = 0, vh = 0, jumps = 0, holding = false, cutDone = false, phase = 0;
      let crashed = false, crashT = 0, tumble = 0, crashKind = 'bag', crashX = 0;
      let pizzaT = 0, nextPizzaM = 380 + rnd() * 260;
      let coins = 0, gapLeft = 520, shake = 0, done = false;
      const obs = [];      // { type, x, w, h, seed, wob, alt?, smashed? }
      const pick = [];     // coins + pizza: { kind, x, alt, taken }
      const fx = [];       // particles
      const trail = [];
      let pillarOff = 0, fgOff = 0, sparkT = 1;
      const best0 = econ.S.bests.runner || 0;
      // QA (local only, see dev.js): ?qa=god turns every hit into a smash and serves pizza early
      const god = devParams.get('qa') === 'god';
      if (god) nextPizzaM = 60;
      // QA (local only): ?qa=auto plays with good timing, to prove every spawn pattern is clearable
      const auto = devParams.get('qa') === 'auto';
      let autoHold = 0;

      const meters = () => Math.floor(dist * UNIT_M);
      const runSpeed = () => (crashed ? speed : speed * (pizzaT > 0 ? 1.35 : 1));

      const puff = (x, y, n, col = 'rgba(200,190,230,0.8)', sp = 90) => {
        for (let i = 0; i < n; i++) {
          const a = Math.PI + rnd() * Math.PI;
          fx.push({ x, y, vx: Math.cos(a) * sp * rnd(), vy: Math.sin(a) * sp * rnd(), g: 160, life: 0.5 + rnd() * 0.3, age: 0, r: 2 + rnd() * 3, col });
        }
      };

      const press = () => {
        if (crashed || done) return;
        holding = true;
        if (h <= 0.01 && vh <= 0) {
          vh = JUMP_V;
          jumps = 1;
          cutDone = false;
          A.jump?.();
          puff(RUN_X, GROUND, 6);
        } else if (jumps < 2) {
          vh = DOUBLE_V;
          jumps = 2;
          cutDone = false;
          A.jump?.();
          puff(RUN_X, GROUND - h, 8, 'rgba(255,240,200,0.9)', 120);
        }
      };
      const release = () => {
        holding = false;
        if (vh > 0 && !cutDone) {
          vh *= CUT;
          cutDone = true;
        }
      };

      // ---- spawning
      const spawn = () => {
        const m = meters();
        const x = W + 80;
        const early = m < 120;
        const r = rnd();
        const coinLine = (x0, n, alt) => { for (let i = 0; i < n; i++) pick.push({ kind: 'coin', x: x0 + i * 38, alt, taken: false }); };
        const coinArc = (x0, w, top) => {
          const n = 7;
          for (let i = 0; i < n; i++) {
            const k = i / (n - 1);
            pick.push({ kind: 'coin', x: x0 + k * w, alt: 40 + (top - 40) * (1 - Math.pow(2 * k - 1, 2)), taken: false });
          }
        };
        const add = (type, ox, extra = {}) => {
          const dims = { bag: [48, 40], cone: [32, 50], turnstile: [56, 92], pigeon: [44, 28] }[type];
          obs.push({ type, x: ox, w: dims[0], h: dims[1], seed: Math.floor(rnd() * 1e5), wob: rnd() * 6, ...extra });
        };
        let width = 60;
        if (early || r < 0.36) {
          const type = rnd() < 0.55 ? 'bag' : 'cone';
          add(type, x);
          if (rnd() < 0.5) coinArc(x - 70, 190, 130);
        } else if (r < 0.56 && m >= 90) {
          add('turnstile', x);
          coinArc(x - 80, 220, 175);
          width = 120;
        } else if (r < 0.74 && m >= 220) {
          add('pigeon', x, { alt: 118 + rnd() * 12, phase: rnd() * 6 });
          coinLine(x - 40, 5, 30);
          width = 100;
        } else if (r < 0.88 && m >= 420) {
          // bag then pigeon: hop the bag, land, then stay down. The gap scales with
          // speed so a quick hop always lands before the bird arrives.
          const gap = 170 + runSpeed() * (0.62 + rnd() * 0.12);
          add(rnd() < 0.5 ? 'bag' : 'cone', x);
          add('pigeon', x + gap, { alt: 120, phase: rnd() * 6 });
          width = gap + 80;
        } else if (m >= 320) {
          // two low ones in a row: one long jump or two hops
          add('bag', x);
          add('cone', x + 120 + rnd() * 50);
          coinArc(x - 30, 230, 165);
          width = 200;
        } else {
          coinLine(x, 6, 34);
          width = 220;
        }
        // pizza, somewhere clear
        if (m >= nextPizzaM) {
          nextPizzaM = m + 450 + rnd() * 320;
          pick.push({ kind: 'pizza', x: x + width + 160, alt: god ? 40 : 126, taken: false });
          width += 280;
        }
        const sp = runSpeed();
        const tmin = early ? 1.15 : m < 400 ? 0.85 : 0.72;
        const tmax = early ? 1.9 : m < 400 ? 1.55 : 1.3;
        gapLeft = width + sp * (tmin + rnd() * (tmax - tmin));
      };

      // ---- collisions
      const runnerBox = () => ({ x0: RUN_X - 14, x1: RUN_X + 20, y0: GROUND - h - 78, y1: GROUND - h - 3 });
      const hit = (o) => {
        const b = runnerBox();
        if (o.type === 'pigeon') {
          const py = GROUND - o.alt;
          return b.x1 > o.x - 20 && b.x0 < o.x + 22 && b.y0 < py + 12 && b.y1 > py - 10;
        }
        return b.x1 > o.x + 5 && b.x0 < o.x + o.w - 5 && b.y1 > GROUND - o.h + 4;
      };

      const crash = (o) => {
        crashed = true;
        crashT = 0;
        crashKind = o.type;
        crashX = RUN_X;
        vh = 620;
        h = Math.max(h, 1);
        shake = 12;
        A.clunk?.();
        setTimeout(() => A.sad?.(), 180);
        puff(RUN_X + 20, GROUND - h - 40, 16, 'rgba(255,255,255,0.9)', 220);
      };

      const smash = (o) => {
        o.smashed = true;
        o.svx = 380 + rnd() * 200;
        o.svy = -420 - rnd() * 200;
        o.sh = 0;
        o.spin = (rnd() - 0.5) * 14;
        coins += 1;
        shake = 6;
        A.clunk?.();
        puff(o.x + o.w / 2, GROUND - o.h / 2, 14, 'rgba(255,207,90,0.95)', 260);
        fx.push({ x: o.x, y: GROUND - o.h - 20, vx: 0, vy: -60, g: 0, life: 0.8, age: 0, r: 0, col: '#6dff9a', text: '+1' });
      };

      const finish = () => {
        done = true;
        const m = meters();
        const grade = GRADES.find(([, min]) => m >= min)[0];
        econ.track('score:runner', m);
        const pay = Math.min(80, Math.floor(m / 10) + coins);
        const tokens = econ.gameReward('runner', pay);
        const prize = m >= 1200 ? econ.achieve('run1200') : null;
        const record = m > best0;
        const beatOld = record && best0 > 0;
        if (record) {
          econ.S.bests.runner = m;
          econ.commit();
        }
        const lines = [`Coins grabbed: ${coins}`];
        lines.push(record ? (best0 ? `New record! Old best: ${best0}m` : 'First run on the board!') : `Best: ${econ.S.bests.runner}m`);
        if (prize) lines.push(`1,200m! You earned the ${prize.item.name}. It’s in your closet.`);
        lines.push(tokens ? `Paid plays left today: ${paidLeft()}` : 'Playing for fun · the 3 paid plays are used up today');
        api.finish({ title: beatOld ? 'NEW RECORD!' : CRASH_TITLES[crashKind] || 'WIPEOUT', grade, score: `${m}m`, scoreLabel: 'DISTANCE', tokens, lines, againLabel: 'RUN IT BACK' });
      };

      const autopilot = (dt, sp) => {
        if (autoHold > 0) {
          autoHold -= dt;
          if (autoHold <= 0) release();
          return;
        }
        if (h > 0) return;
        const ahead = obs.filter((o) => !o.smashed && o.type !== 'pigeon' && o.x + o.w > RUN_X - 10).sort((a, b) => a.x - b.x);
        const next = ahead[0];
        if (!next) return;
        // two obstacles close together need one long (held) jump
        const tall = next.type === 'turnstile' || (ahead[1] && ahead[1].x - (next.x + next.w) < 260);
        const lead = tall ? 0.2 : 0.17;
        const d = next.x - (RUN_X + 20);
        if (d > sp * lead) return;
        const air = tall ? 0.78 : 0.48;
        const bird = obs.find((o) => o.type === 'pigeon' && !o.smashed && o.x > RUN_X - 40 && (o.x - RUN_X) / (sp + 70) < air + 0.05);
        if (bird) return; // a jump now would meet the pigeon
        press();
        autoHold = tall ? 0.32 : 0.06;
      };

      const hud = () => {
        const left = paidLeft();
        api.setHud(`${left > 0 ? `Paid plays left today: ${left}` : 'Playing for fun'} · best ${Math.max(best0, econ.S.bests.runner || 0)}m`, `${meters()}m · ${coins} coins`);
      };
      hud();

      return {
        start() { hud(); },
        pointer(type) {
          if (type === 'down') press();
          else if (type === 'up') release();
        },
        key(type, code, e) {
          if (!['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(code)) return;
          if (type === 'down') {
            if (e && e.repeat) return;
            press();
          } else release();
        },
        update(dt, time) {
          t = time;
          if (done) return;
          // speed + distance
          if (!crashed) speed = Math.min(MAX_SPEED, START_SPEED + ACCEL * time);
          else speed = Math.max(0, speed - dt * 900);
          const sp = runSpeed();
          dist += sp * dt;
          pillarOff += sp * dt * 0.62;
          fgOff += sp * dt * 1.5;
          if (pizzaT > 0) pizzaT = Math.max(0, pizzaT - dt);
          // player
          if (h > 0 || vh > 0) {
            const g = holding && vh > 0 ? GRAV * 0.86 : GRAV;
            vh -= g * dt;
            h += vh * dt;
            if (h <= 0) {
              h = 0;
              vh = 0;
              jumps = 0;
              if (!crashed) {
                A.land?.();
                puff(RUN_X, GROUND, 5);
              }
            }
          }
          if (!crashed && h <= 0) phase = (phase + (sp * dt) / 74) % 1;
          if (crashed) {
            crashT += dt;
            tumble += dt * 9 * Math.max(0, 1 - crashT / 1.1);
            crashX -= dt * 140 * Math.max(0, 1 - crashT);
            if (crashT > 1.35) finish();
          }
          if (pizzaT > 0 && !crashed) {
            trail.push({ x: RUN_X, y: GROUND - h, a: 1, phase });
            if (trail.length > 10) trail.shift();
          } else if (trail.length) trail.shift();
          if (auto && !crashed) autopilot(dt, sp);
          // world objects
          gapLeft -= sp * dt;
          if (gapLeft <= 0 && !crashed && time > 1.1) spawn();
          for (const o of obs) {
            o.x -= sp * dt + (o.type === 'pigeon' ? 70 * dt : 0);
            o.wob += dt * 3;
            if (o.smashed) {
              o.x += o.svx * dt * 0.5;
              o.svy += 1400 * dt;
              o.sh -= o.svy * dt;
              continue;
            }
            if (!crashed && hit(o)) {
              if (pizzaT > 0 || god) smash(o);
              else crash(o);
            }
          }
          for (const p of pick) {
            p.x -= sp * dt;
            if (p.taken || crashed) continue;
            const cy = GROUND - p.alt;
            const dx = p.x - (RUN_X + 4), dy = cy - (GROUND - h - 42);
            if (dx * dx + dy * dy < (p.kind === 'pizza' ? 44 : 34) ** 2) {
              p.taken = true;
              if (p.kind === 'pizza') {
                pizzaT = PIZZA_TIME;
                A.fanfare?.();
                fx.push({ x: RUN_X, y: GROUND - h - 110, vx: 0, vy: -40, g: 0, life: 1.2, age: 0, r: 0, col: '#ffcf5a', text: 'PIZZA POWER!' });
              } else {
                coins += 1;
                A.coin?.();
                fx.push({ x: p.x, y: cy - 16, vx: 0, vy: -70, g: 0, life: 0.6, age: 0, r: 0, col: '#6dff9a', text: '+1' });
              }
            }
          }
          for (let i = obs.length - 1; i >= 0; i--) if (obs[i].x < -160 || obs[i].sh > 600) obs.splice(i, 1);
          for (let i = pick.length - 1; i >= 0; i--) if (pick[i].x < -60 || (pick[i].taken && pick[i].kind === 'coin')) pick.splice(i, 1);
          // third-rail sparks
          sparkT -= dt;
          if (sparkT < 0) {
            sparkT = 0.6 + rnd() * 2;
            const sx = 120 + rnd() * 640;
            for (let i = 0; i < 9; i++) fx.push({ x: sx, y: GROUND + 34, vx: (rnd() - 0.5) * 260, vy: -rnd() * 260, g: 700, life: 0.35, age: 0, r: 1.6, col: rnd() < 0.5 ? '#bfe9ff' : '#ffffff', spark: true });
          }
          for (const p of fx) {
            p.age += dt;
            p.vy += p.g * dt;
            p.x += p.vx * dt - (p.text ? 0 : sp * dt * 0.3);
            p.y += p.vy * dt;
          }
          for (let i = fx.length - 1; i >= 0; i--) if (fx[i].age > fx[i].life) fx.splice(i, 1);
          if (shake > 0) shake = Math.max(0, shake - dt * 30);
          hud();
        },
        draw(g, time) {
          const tt = done ? time : t;
          g.save();
          if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
          // far wall (parallax)
          const fw = farWall.w;
          const off = ((dist * 0.25) % fw + fw) % fw;
          g.drawImage(farWall.canvas, 0, 0, farWall.canvas.width, farWall.canvas.height, -off, 0, fw, H);
          g.drawImage(farWall.canvas, 0, 0, farWall.canvas.width, farWall.canvas.height, -off + fw, 0, fw, H);
          // ceiling pipe
          g.fillStyle = '#07050f';
          g.fillRect(0, 0, W, 34);
          g.fillStyle = INK;
          g.fillRect(0, 34, W, 14);
          g.fillStyle = '#3a3456';
          g.fillRect(0, 36, W, 10);
          g.fillStyle = 'rgba(255,255,255,0.12)';
          g.fillRect(0, 37, W, 2);
          // pillars + work lights (mid parallax)
          const step = 260;
          for (let k = -1; k < W / step + 2; k++) {
            const px = k * step - (pillarOff % step);
            g.save();
            g.globalCompositeOperation = 'lighter';
            const lg = g.createLinearGradient(0, 70, 0, GROUND + 10);
            lg.addColorStop(0, 'rgba(255,214,150,0.16)');
            lg.addColorStop(1, 'rgba(255,214,150,0)');
            g.fillStyle = lg;
            g.beginPath();
            g.moveTo(px + 6, 78); g.lineTo(px + 30, 78); g.lineTo(px + 120, GROUND + 6); g.lineTo(px - 80, GROUND + 6);
            g.fill();
            g.restore();
            rect(g, px, 46, 26, GROUND - 40, { fill: '#232038', lw: 3, amp: 0, seed: 2 });
            g.fillStyle = 'rgba(255,255,255,0.07)';
            g.fillRect(px + 3, 46, 5, GROUND - 46);
            for (let y = 70; y < GROUND - 10; y += 26) dot(g, px + 19, y, 1.5, 'rgba(0,0,0,0.45)');
            ellipse(g, px + 18, 80, 7, 8, { fill: '#fff0c0', lw: 2.4, amp: 0, seed: 3 });
          }
          // track bed
          const bed = g.createLinearGradient(0, GROUND, 0, H);
          bed.addColorStop(0, '#2a2240');
          bed.addColorStop(1, '#100c1e');
          g.fillStyle = bed;
          g.fillRect(0, GROUND - 2, W, H - GROUND + 2);
          const tieStep = 46;
          const toff = dist % tieStep;
          g.fillStyle = '#3a2a22';
          for (let x = -toff - tieStep; x < W + tieStep; x += tieStep) {
            g.beginPath();
            g.moveTo(x, GROUND + 4); g.lineTo(x + 24, GROUND + 4); g.lineTo(x + 30, H); g.lineTo(x - 6, H);
            g.fill();
          }
          // the rail you run on
          g.fillStyle = INK;
          g.fillRect(0, GROUND - 1, W, 12);
          g.fillStyle = '#5a5676';
          g.fillRect(0, GROUND + 1, W, 8);
          g.fillStyle = '#d8d8f0';
          g.fillRect(0, GROUND + 1, W, 2.4);
          // the third rail
          g.fillStyle = INK;
          g.fillRect(0, GROUND + 30, W, 10);
          g.fillStyle = '#c9a43a';
          g.fillRect(0, GROUND + 31, W, 3);
          g.fillStyle = '#3a3230';
          g.fillRect(0, GROUND + 34, W, 5);
          // pickups
          for (const p of pick) {
            if (p.taken) continue;
            const y = GROUND - p.alt + Math.sin(tt * 4 + p.x * 0.05) * 3;
            if (p.kind === 'pizza') {
              g.save();
              g.globalCompositeOperation = 'lighter';
              const gl = g.createRadialGradient(p.x, y, 4, p.x, y, 46);
              gl.addColorStop(0, 'rgba(255,200,90,0.55)');
              gl.addColorStop(1, 'rgba(255,200,90,0)');
              g.fillStyle = gl;
              g.fillRect(p.x - 50, y - 50, 100, 100);
              g.restore();
              g.save();
              g.translate(p.x, y);
              g.rotate(Math.sin(tt * 3) * 0.25 - Math.PI / 2);
              drawSlice(g, -18, 0, 1.15);
              g.restore();
            } else drawCoin(g, p.x, y, tt);
          }
          // obstacles
          for (const o of obs) {
            if (o.smashed) {
              g.save();
              g.translate(o.x + o.w / 2, GROUND - o.h / 2 - o.sh);
              g.rotate((o.spin || 0) * (o.sh / 200));
              g.translate(-(o.x + o.w / 2), -(GROUND - o.h / 2));
            }
            if (o.type === 'bag') drawBag(g, o.x, o);
            else if (o.type === 'cone') drawCone(g, o.x, o);
            else if (o.type === 'turnstile') drawTurnstile(g, o.x, o);
            else if (o.type === 'pigeon') {
              const y = GROUND - o.alt + Math.sin(tt * 3 + (o.phase || 0)) * 5;
              drawFlyingPigeon(g, o.x, y, o, tt);
            }
            if (o.smashed) g.restore();
          }
          // pizza trail
          for (let i = 0; i < trail.length; i++) {
            const tr = trail[i];
            g.save();
            g.globalAlpha = (i / trail.length) * 0.35;
            g.translate(-(trail.length - i) * 12, 0);
            drawFigure(g, tr.x, tr.y, { body: ctx.body, outfit: ctx.outfit, scale: 0.92, t: tt, view: 'side', facing: 1, pose: 'run', phase: tr.phase, boil: 11 });
            g.restore();
          }
          // shadow + runner
          const shW = Math.max(8, 24 - h * 0.1);
          g.fillStyle = 'rgba(5,3,14,0.45)';
          g.beginPath();
          g.ellipse((crashed ? crashX : RUN_X) + 2, GROUND + 1, shW, 4, 0, 0, Math.PI * 2);
          g.fill();
          g.save();
          if (crashed) {
            g.translate(crashX, GROUND - h - 40);
            g.rotate(-tumble);
            g.translate(-crashX, -(GROUND - h - 40));
          }
          if (pizzaT > 0) {
            g.save();
            g.globalCompositeOperation = 'lighter';
            const gl = g.createRadialGradient(RUN_X, GROUND - h - 44, 6, RUN_X, GROUND - h - 44, 80);
            gl.addColorStop(0, `rgba(255,170,60,${0.28 + Math.sin(tt * 20) * 0.08})`);
            gl.addColorStop(1, 'rgba(255,170,60,0)');
            g.fillStyle = gl;
            g.fillRect(RUN_X - 90, GROUND - h - 134, 180, 180);
            g.restore();
          }
          const pose = crashed ? 'fall' : h > 0.5 ? (vh > 0 ? 'jump' : 'fall') : 'run';
          drawFigure(g, crashed ? crashX : RUN_X, GROUND - h, {
            body: ctx.body, outfit: ctx.outfit, scale: 0.92, t: tt, view: 'side', facing: 1, pose, phase,
            blink: crashed ? 1 : 0, boil: 11 + (Math.floor(tt * 7) % 3) * 101,
          });
          if (pizzaT > 0 && !crashed) {
            g.save();
            g.translate(RUN_X + 30, GROUND - h - 44);
            g.rotate(-0.4);
            drawSlice(g, -6, 0, 0.8);
            g.restore();
          }
          g.restore();
          // particles
          for (const p of fx) {
            const k = 1 - p.age / p.life;
            g.save();
            g.globalAlpha = Math.min(1, k * 1.6);
            if (p.text) text(g, p.text, p.x, p.y, { size: p.text.length > 3 ? 26 : 18, font: FONTS.sign, fill: p.col, lw: 5, line: INK });
            else if (p.spark) {
              g.strokeStyle = p.col;
              g.lineWidth = 2;
              g.beginPath();
              g.moveTo(p.x, p.y);
              g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
              g.stroke();
            } else dot(g, p.x, p.y, p.r * (0.4 + k * 0.6), p.col);
            g.restore();
          }
          // foreground pillars (fast parallax, translucent so they never hide danger)
          const fstep = 1300;
          for (let k = 0; k < 2; k++) {
            const fx0 = k * fstep - (fgOff % fstep) + 700;
            if (fx0 < -80 || fx0 > W + 40) continue;
            g.save();
            g.globalAlpha = 0.62;
            g.fillStyle = '#05030c';
            g.fillRect(fx0, 0, 30, H);
            g.fillStyle = '#1c1830';
            g.fillRect(fx0 + 4, 0, 4, H);
            g.fillRect(fx0 - 8, 0, 46, 16);
            g.fillRect(fx0 - 8, H - 26, 46, 26);
            g.restore();
          }
          g.restore();
          // arcade HUD
          const m = meters();
          text(g, `${m.toLocaleString('en-US')}m`, 24, 82, { size: 38, font: FONTS.sign, fill: '#fffaf0', lw: 7, line: INK, align: 'left' });
          drawCoin(g, 38, 108, tt, 0.9);
          text(g, `${coins}`, 56, 116, { size: 22, font: FONTS.sign, fill: '#ffd23f', lw: 5, line: INK, align: 'left' });
          const best = Math.max(best0, econ.S.bests.runner || 0);
          if (best) text(g, `BEST ${best}m`, W - 22, 82, { size: 18, font: FONTS.sign, fill: m > best ? '#6dff9a' : '#b3a9e0', lw: 5, line: INK, align: 'right' });
          if (pizzaT > 0) {
            text(g, 'PIZZA POWER!', W / 2, 92 + Math.sin(tt * 10) * 3, { size: 34, font: FONTS.drip, fill: '#ffcf5a', lw: 7, line: INK, rot: -0.04 });
            rect(g, W / 2 - 80, 104, 160, 10, { fill: '#2a2238', lw: 2.4, amp: 0, seed: 5 });
            rect(g, W / 2 - 80, 104, 160 * (pizzaT / PIZZA_TIME), 10, { fill: '#ff8a3d', lw: 0, amp: 0, seed: 6 });
          }
          if (!crashed && t < 1.1 && !done && api.time > 0) {
            text(g, 'GO!', W / 2, H / 2, { size: 76, font: FONTS.drip, fill: '#6dff9a', lw: 12, line: INK, rot: -0.06 });
          }
          if (crashed && !done) {
            text(g, CRASH_TITLES[crashKind] || 'WIPEOUT', W / 2, H / 2 - 20, { size: 46, font: FONTS.drip, fill: '#ff4f9a', lw: 10, line: INK, rot: -0.06 });
          }
          // CRT glass
          g.drawImage(crt, 0, 0, W, H);
        },
      };
    },
  }, ctx);
}
