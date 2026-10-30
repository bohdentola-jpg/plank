// The Grabber: hold to slide the claw right, let go to drop. Grab a capsule,
// survive the wobbly lift, carry it to the chute. Prizes come from the daily
// pit (econ.clawPrizes) and are paid by econ.clawWin.
import { openArcade } from './frame.js';
import { emblem } from '../art/products.js';
import { shape, rect, rrect, ellipse, stroke, tube, dot, text, FONTS, INK, rgba, shade, mulberry32 } from '../ink.js';

const COST = 15;
const R = 27;                      // capsule radius
const PIT_X0 = 214, PIT_X1 = 724;  // capsule pit (logical x)
const FLOOR = 404;                 // pit floor (logical y)
const RAIL_Y = 74;
const START_X = 132;               // claw home, above the chute
const MAX_X = 712;
const MOVE_V = 175;
const CHUTE = { x0: 64, x1: 194, y: 300 };

// Phones get a taller canvas: the machine sits at the bottom, a lit topper
// with big labels fills the extra height.
const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < 640;

export const PRIZE_COLORS = { tokens: '#ffd23f', ticket: '#ff4f9a', item: '#3ec7b0', freeze: '#5aa0ff', key: '#ff8a3d', rare: '#b48cff' };
const LABEL = { tokens: '+40 TOKENS', ticket: 'CAPSULE TICKET', item: 'CLOTHES', freeze: 'STREAK FREEZE', key: 'CAB KEY', rare: 'GHOST TICKET' };
const EXPLAIN = {
  tokens: 'Tokens added to your wallet.',
  ticket: 'A free pull at Plug\'s machines in Car 7.',
  item: 'It\'s in your closet. Go try it on.',
  freeze: 'Covers one missed day of your streak.',
  key: 'It opens the driver\'s cab, right behind the front car.',
  rare: 'Show it to the chained door at the back of Car 7…',
};

export function playClaw(ctx) {
  const E = ctx.econ;
  let prepaid = true; // main.js charged the first play
  const TALL = isNarrow();
  const H = TALL ? 800 : 450, OY = H - 450;
  const say = (msg) => { if (ctx.hud && ctx.hud.toast) ctx.hud.toast(msg, 'hot', 2600); };
  const hudFor = (api, n) => api.setHud(`${COST} TOKENS A PLAY · ${n ?? E.clawPrizes().length} CAPSULES LEFT`, `TOKENS ${E.S.tokens.toLocaleString('en-US')}`);

  return openArcade({
    id: 'claw',
    title: 'THE GRABBER',
    color: '#ff4f9a',
    blurb: 'Hold to move the claw. Let go to drop.',
    logical: [800, H],
    stageBg: '#e8456b',
    skipIntro: true,
    hud: (api) => hudFor(api),
    async beforePlay(api) {
      if (prepaid) {
        prepaid = false;
        return true;
      }
      if (!E.clawPrizes().length) {
        say('The Grabber is empty. It restocks at midnight.');
        return false;
      }
      if (!E.spend(COST)) {
        say(`You need ${COST} tokens to play.`);
        api.setHud(`Not enough tokens. A play costs ${COST}.`, null);
        return false;
      }
      return true;
    },
    create(api) {
      const A = api.audio;
      const rnd = mulberry32((Math.random() * 1e9) | 0);
      const caps = layout(E.clawPrizes());
      const claw = { x: START_X, len: 40, open: 0.6, sway: 0, swayV: 0 };
      let state = 'ready', st = 0, holding = false, held = null, target = null, slipAt = -1, result = null, liftFrom = 40;
      let hint = true;

      const press = () => {
        if (state === 'ready') {
          state = 'moving';
          hint = false;
          A.motor(true);
        }
      };
      const release = () => {
        if (state === 'moving') drop();
      };
      const drop = () => {
        A.motor(false);
        A.clunk();
        state = 'drop';
        st = 0;
        // what is under the claw: the highest exposed capsule within reach
        target = null;
        let best = Infinity;
        for (const c of caps) {
          if (c.taken || coveredBy(c, caps)) continue;
          const dx = Math.abs(c.x - claw.x);
          if (dx < R * 1.9 && dx < best) { best = dx; target = c; }
        }
      };
      const stopLen = () => {
        // claw descends until the prongs reach a capsule top or the floor
        let surface = FLOOR - 24;
        // over the prize chute the claw bumps the plexi shield
        if (claw.x < CHUTE.x1 + 14) surface = CHUTE.y - 70 - 26;
        for (const c of caps) {
          if (c.taken || c.gone) continue;
          if (Math.abs(c.x - claw.x) < R * 1.1) surface = Math.min(surface, c.y - R * 0.55);
        }
        return Math.max(60, surface - RAIL_Y - 30);
      };

      return {
        start() { hudFor(api, caps.filter((c) => !c.taken).length); },
        destroy() { A.motor(false); },
        pointer(type) {
          if (type === 'down') { holding = true; press(); }
          if (type === 'up') { holding = false; release(); }
        },
        key(type, code) {
          if (!['Space', 'ArrowRight', 'KeyD', 'Enter'].includes(code)) return;
          if (type === 'down') { if (!holding) { holding = true; press(); } }
          else { holding = false; release(); }
        },
        update(dt) {
          st += dt;
          // pendulum sway of the claw head
          claw.swayV += (-claw.sway * 40 - claw.swayV * 3) * dt;
          claw.sway += claw.swayV * dt;
          if (state === 'moving') {
            claw.x = Math.min(MAX_X, claw.x + MOVE_V * dt);
            claw.swayV -= 22 * dt;
            if (claw.x >= MAX_X) drop();
          } else if (state === 'drop') {
            claw.open = Math.min(1, claw.open + dt * 3);
            const goal = stopLen();
            claw.len = Math.min(goal, claw.len + dt * 230);
            if (claw.len >= goal - 0.5) {
              state = 'close';
              st = 0;
              A.click();
            }
          } else if (state === 'close') {
            claw.open = Math.max(target ? 0.22 : 0, claw.open - dt * 3.2);
            if (st > 0.42) {
              held = null;
              if (target) {
                const align = Math.max(0, 1 - Math.abs(target.x - claw.x) / (R * 1.9));
                let chance = 0.18 + 0.8 * Math.pow(align, 1.25);
                if (target.kind === 'key' || target.kind === 'rare') chance *= 0.55;
                if (rnd() < chance) {
                  held = target;
                  // wobbly grip: weaker grabs may slip on the way up
                  const slip = 0.28 * (1 - align) + (target.kind === 'key' || target.kind === 'rare' ? 0.12 : 0);
                  slipAt = rnd() < slip ? 0.35 + rnd() * 0.4 : -1;
                }
              }
              state = 'lift';
              st = 0;
              liftFrom = claw.len;
              A.clunk();
            }
          } else if (state === 'lift') {
            claw.len = Math.max(40, claw.len - dt * 170);
            const k = 1 - (claw.len - 40) / Math.max(1, liftFrom - 40);
            if (held && slipAt > 0 && k > slipAt) {
              held.fall = { vy: 0, home: held.homeY, fromX: held.x, homeX: held.homeX, y0: held.y };
              held = null;
              slipAt = -1;
              A.sad();
              claw.swayV += 30;
            }
            if (held) {
              held.y = clawTipY(claw) + R * 0.4;
              held.x += (claw.x + claw.sway * 6 - held.x) * Math.min(1, dt * 12);
            }
            if (claw.len <= 40.5) {
              state = 'return';
              st = 0;
              if (held) A.motor(true);
            }
          } else if (state === 'return') {
            claw.x = Math.max(START_X, claw.x - MOVE_V * 1.4 * dt);
            if (held) { held.x = claw.x + claw.sway * 6; held.y = clawTipY(claw) + R * 0.4; }
            if (claw.x <= START_X + 0.5) {
              A.motor(false);
              state = 'release';
              st = 0;
              if (held) {
                held.fall = { vy: 0, chute: true };
                held.taken = true;
              }
            }
          } else if (state === 'release') {
            claw.open = Math.min(0.8, claw.open + dt * 3);
            if (st > 0.9 && !result) {
              result = settle(held);
              state = 'done';
              st = 0;
            }
          } else if (state === 'done' && st > 0.5 && result) {
            const r = result;
            result = 'shown';
            api.finish(r);
          }
          // falling capsules (slips back into the pile, or down the chute)
          for (const c of caps) {
            if (!c.fall) continue;
            c.fall.vy += 1500 * dt;
            c.y += c.fall.vy * dt;
            if (c.fall.chute) {
              if (c.y > 470) { c.fall = null; c.gone = true; A.pop(); }
            } else {
              if (c.fall.homeX != null) {
                const span = Math.max(1, c.fall.home - c.fall.y0);
                const k = Math.min(1, Math.max(0, (c.y - c.fall.y0) / span));
                c.x = c.fall.fromX + (c.fall.homeX - c.fall.fromX) * k;
              }
              if (c.y >= c.fall.home) {
                c.y = c.fall.home;
                if (c.fall.vy > 260) { c.fall.vy *= -0.35; A.land(); } else { c.x = c.homeX; c.fall = null; }
              }
            }
          }
          if (!holding && state === 'moving') release();
        },
        draw(g, t) {
          // what's under the claw right now (for the aim label)
          let under = null;
          if (state === 'ready' || state === 'moving') {
            let best = Infinity;
            for (const c of caps) {
              if (c.taken || coveredBy(c, caps)) continue;
              const dx = Math.abs(c.x - claw.x);
              if (dx < R * 1.2 && dx < best) { best = dx; under = c; }
            }
          }
          if (TALL) drawTopper(g, t, OY, hint, under, caps.some((c) => !c.taken));
          g.save();
          g.translate(0, OY);
          drawMachine(g, t);
          for (const c of caps) if (!c.gone && c !== held) drawCapsule(g, c.x, c.y, c.kind, c.i);
          // the held capsule sits inside the prongs, so it's drawn first
          if (held) drawCapsule(g, held.x, held.y, held.kind, held.i);
          drawClaw(g, claw, t);
          drawFront(g, t, !TALL);
          if (!TALL) {
            if (under) text(g, LABEL[under.kind] || '', claw.x, RAIL_Y + 150 + Math.sin(t * 6) * 2, { size: 16, font: FONTS.sign, fill: PRIZE_COLORS[under.kind], lw: 4 });
            if (hint) {
              g.save();
              g.globalAlpha = 0.6 + Math.sin(t * 5) * 0.4;
              text(g, 'HOLD TO MOVE · RELEASE TO DROP', 460, 196, { size: 22, font: FONTS.sign, fill: '#ffd23f', lw: 5 });
              g.restore();
            }
            if (!caps.some((c) => !c.taken)) text(g, 'EMPTY · RESTOCKS AT MIDNIGHT', 470, 300, { size: 20, font: FONTS.sign, fill: '#fffaf0', lw: 5 });
          }
          g.restore();
        },
      };

      function settle(prize) {
        if (!prize) {
          A.sad();
          hudFor(api, caps.filter((c) => !c.taken).length);
          return {
            title: pickOne(['SO CLOSE', 'SLIPPED!', 'NOTHING BUT AIR']),
            lines: [pickOne(['The Grabber\'s grip is famously weak.', 'It wobbled. They always wobble.', 'Line it up dead center for a better grip.'])],
            again: caps.some((c) => !c.taken),
            againLabel: `PLAY AGAIN · ${COST}`,
          };
        }
        const res = E.clawWin(prize.i);
        A.fanfare();
        if (res && res.tokens) A.coin(true);
        const left = E.clawPrizes().length;
        hudFor(api, left);
        return {
          title: 'GOT ONE!',
          tokens: res && res.tokens ? res.tokens : 0,
          lines: [res ? res.label : LABEL[prize.kind], EXPLAIN[res ? res.kind : prize.kind] || '', left ? '' : 'That was the last capsule. Restocks at midnight.'].filter(Boolean),
          again: left > 0,
          againLabel: `PLAY AGAIN · ${COST}`,
        };
      }
    },
  }, ctx);
}

const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

// map econ prizes (x 0..1, layer) to settled positions in the pit
function layout(prizes) {
  const caps = prizes.map((p) => ({ i: p.i, kind: p.kind, layer: p.layer, x: PIT_X0 + R + p.x * (PIT_X1 - PIT_X0 - 2 * R), y: FLOOR - R }));
  const base = caps.filter((c) => c.layer === 0);
  for (const c of caps.filter((c) => c.layer === 1)) {
    // rest on the two nearest bottom capsules, or drop to the floor if unsupported
    const near = base.filter((b) => Math.abs(b.x - c.x) < R * 2).sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x));
    if (near.length) {
      const b = near[0];
      const dx = Math.min(Math.abs(c.x - b.x), R * 1.9);
      c.y = b.y - Math.sqrt(Math.max(0, (2 * R) ** 2 - dx * dx));
    } else {
      // slide to the floor, nudged away from neighbours
      c.y = FLOOR - R;
      c.layer = 0;
    }
  }
  for (const c of caps) { c.homeY = c.y; c.homeX = c.x; }
  return caps;
}

function coveredBy(c, caps) {
  return caps.some((o) => o !== c && !o.taken && !o.gone && o.y < c.y - R * 0.6 && Math.abs(o.x - c.x) < R * 1.5);
}

const clawTipY = (claw) => RAIL_Y + claw.len + 34;

// ---------------------------------------------------------------- art

function drawMachine(g, t) {
  // back wall of the cabinet
  g.fillStyle = '#2a2252';
  g.fillRect(0, 0, 800, 450);
  const r = mulberry32(17);
  for (let i = 0; i < 70; i++) {
    const x = 40 + r() * 720, y = 40 + r() * 320;
    const tw = (Math.sin(t * 2 + i) + 1) / 2;
    dot(g, x, y, 1 + r() * 1.6, rgba('#ffd23f', 0.15 + tw * 0.35));
  }
  text(g, 'THE GRABBER', 470, 140, { size: 46, font: FONTS.drip, fill: rgba('#ff4f9a', 0.32), lw: 0 });
  // rail
  rect(g, 60, RAIL_Y - 8, 680, 12, { fill: '#c8c8e0', shade: '#8a8ea4', sdx: 0, sdy: 3, lw: 3, amp: 0, seed: 5 });
  // pit floor + back lip
  g.fillStyle = '#3a2f70';
  g.fillRect(PIT_X0 - 20, FLOOR - 4, PIT_X1 - PIT_X0 + 60, 60);
  stroke(g, [[PIT_X0 - 20, FLOOR], [760, FLOOR]], { lw: 3, amp: 0 });
  // chute (left)
  rect(g, CHUTE.x0, CHUTE.y, CHUTE.x1 - CHUTE.x0, 160, { fill: '#140f26', lw: 3.4, amp: 0.3, seed: 6 });
  text(g, 'PRIZE', (CHUTE.x0 + CHUTE.x1) / 2, CHUTE.y + 60, { size: 18, font: FONTS.sign, fill: rgba('#ffd23f', 0.5), lw: 0 });
  text(g, '↓', (CHUTE.x0 + CHUTE.x1) / 2, CHUTE.y + 96, { size: 30, font: FONTS.sign, fill: rgba('#ffd23f', 0.5), lw: 0 });
}

// phone topper: big marquee, instructions, live aim label, prize legend
function drawTopper(g, t, oy, hint, under, any) {
  g.fillStyle = '#e8456b';
  g.fillRect(0, 0, 800, oy + 40);
  rrect(g, 34, 26, 732, oy - 46, 26, { fill: '#2a1a3a', lw: 4.4, seed: 61 });
  const n = 18;
  for (let i = 0; i < n; i++) {
    const on = (Math.floor(t * 9) + i) % 3 === 0;
    const x = 60 + (i / (n - 1)) * 680;
    dot(g, x, 14, 7, on ? '#ffd23f' : '#7a3050');
  }
  text(g, 'THE GRABBER', 400, 100, { size: 76, font: FONTS.drip, fill: '#ffd23f', lw: 8, extrude: [4, 6, 4, '#8a2050'] });
  const line = hint ? 'HOLD TO MOVE · LET GO TO DROP' : under ? `UNDER THE CLAW: ${LABEL[under.kind]}` : any ? 'LET GO TO DROP' : 'EMPTY · RESTOCKS AT MIDNIGHT';
  const col = hint ? '#ffd23f' : under ? PRIZE_COLORS[under.kind] : '#fffaf0';
  text(g, line, 400, 160 + (hint ? Math.sin(t * 5) * 3 : 0), { size: 31, font: FONTS.sign, fill: col, lw: 7 });
  // legend: two columns of capsule kinds
  const kinds = ['tokens', 'ticket', 'item', 'freeze', 'key', 'rare'];
  kinds.forEach((k, i) => {
    const x = 104 + (i % 2) * 330, y = 208 + Math.floor(i / 2) * 36;
    g.save();
    g.translate(x, y);
    g.scale(0.55, 0.55);
    drawCapsule(g, 0, 0, k, i);
    g.restore();
    text(g, LABEL[k], x + 26, y + 8, { size: 21, font: FONTS.sign, fill: PRIZE_COLORS[k], lw: 5, align: 'left' });
  });
}

function drawFront(g, t, lights = true) {
  // plexi shield around the chute
  g.fillStyle = 'rgba(191,233,255,0.16)';
  g.fillRect(CHUTE.x0 - 6, CHUTE.y - 70, CHUTE.x1 - CHUTE.x0 + 12, 70);
  stroke(g, [[CHUTE.x0 - 6, CHUTE.y - 70], [CHUTE.x1 + 6, CHUTE.y - 70], [CHUTE.x1 + 6, CHUTE.y]], { lw: 3, color: 'rgba(255,250,240,0.8)', amp: 0, smooth: false });
  // glass reflections
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.beginPath(); g.moveTo(90, 30); g.lineTo(190, 30); g.lineTo(80, 430); g.lineTo(-20, 430); g.fill();
  g.beginPath(); g.moveTo(240, 30); g.lineTo(272, 30); g.lineTo(162, 430); g.lineTo(130, 430); g.fill();
  // cabinet frame
  g.save();
  g.beginPath();
  g.rect(0, 0, 800, 450);
  g.rect(36, 30, 728, 404);
  g.fillStyle = '#e8456b';
  g.fill('evenodd');
  g.restore();
  g.fillStyle = 'rgba(20,15,38,0.25)';
  g.fillRect(0, 434, 800, 16);
  rect(g, 36, 30, 728, 404, { fill: null, lw: 4, amp: 0.4, seed: 8 });
  if (!lights) return;
  // chaser lights
  const n = 22;
  for (let i = 0; i < n; i++) {
    const on = (Math.floor(t * 9) + i) % 3 === 0;
    const x = 30 + (i / (n - 1)) * 740;
    dot(g, x, 16, 6, on ? '#ffd23f' : '#7a3050');
    if (on) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      dot(g, x, 16, 13, 'rgba(255,210,63,0.25)');
      g.restore();
    }
  }
  for (let i = 0; i < 8; i++) {
    const on = (Math.floor(t * 9) + i) % 3 === 1;
    dot(g, 18, 60 + i * 48, 5, on ? '#3ec7b0' : '#7a3050');
    dot(g, 782, 60 + i * 48, 5, on ? '#3ec7b0' : '#7a3050');
  }
}

function drawClaw(g, claw, t) {
  const cx = claw.x, ty = RAIL_Y;
  // carriage
  rrect(g, cx - 30, ty - 16, 60, 24, 6, { fill: '#5a5872', lw: 3, seed: 3 });
  dot(g, cx - 18, ty - 4, 3, '#ffd23f');
  // cable
  const hx = cx + claw.sway * 6, hy = ty + claw.len;
  stroke(g, [[cx, ty + 8], [hx, hy]], { lw: 3, color: '#c8c8e0', amp: 0 });
  // head
  rrect(g, hx - 20, hy, 40, 18, 6, { fill: '#c8c8e0', shade: '#8a8ea4', sdx: 0, sdy: 3, lw: 3, seed: 4 });
  // three prongs, opening = claw.open
  const spread = 10 + claw.open * 26;
  for (const d of [-1, 0, 1]) {
    const bx = hx + d * 12, by = hy + 16;
    const kx = hx + d * spread, ky = by + 22;
    const tipx = hx + d * (spread * 0.55 + 4) * (d === 0 ? 0 : 1), tipy = ky + 16;
    if (d === 0) {
      stroke(g, [[hx, by], [hx, by + 30]], { lw: 5, color: '#c8c8e0', amp: 0 });
      continue;
    }
    tube(g, [[bx, by], [kx, ky], [tipx, tipy]], '#c8c8e0', 4, { lw: 2.6, seed: 6 + d });
  }
}

function drawCapsule(g, x, y, kind, seed) {
  const c = PRIZE_COLORS[kind] || '#c8c8e0';
  g.save();
  g.translate(x, y);
  // bottom half: clear plastic
  g.save();
  g.beginPath();
  g.rect(-R - 4, 0, 2 * R + 8, R + 4);
  g.clip();
  ellipse(g, 0, 0, R, R, { fill: 'rgba(240,236,255,0.55)', lw: 3, seed: seed + 1 });
  g.restore();
  // top half: colored
  g.save();
  g.beginPath();
  g.rect(-R - 4, -R - 4, 2 * R + 8, R + 4);
  g.clip();
  ellipse(g, 0, 0, R, R, { fill: c, shade: shade(c, 0.28), sdx: 3, sdy: 2, lw: 3, seed: seed + 2 });
  g.restore();
  stroke(g, [[-R, 0], [R, 0]], { lw: 2.6, color: INK, amp: 0 });
  // icon
  drawIcon(g, kind);
  // shine
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.ellipse(-9, -14, 8, 4, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawIcon(g, kind) {
  switch (kind) {
    case 'tokens':
      ellipse(g, 0, 2, 11, 11, { fill: '#f0c24a', lw: 2.4, seed: 3 });
      shape(g, [[0, -5], [3.5, 1], [3.5, 4], [0, 7.5], [-3.5, 4], [-3.5, 1]], { fill: INK, lw: 0, smooth: true });
      break;
    case 'ticket':
      rrect(g, -14, -8, 28, 20, 3, { fill: '#fffaf0', lw: 2.2, seed: 4 });
      stroke(g, [[-6, -8], [-6, 12]], { lw: 1.6, color: '#140f26', amp: 0 });
      emblem(g, 'star', 4, 2, 0.4, '#ff4f9a', 5);
      break;
    case 'item':
      shape(g, [[-12, -6], [-5, -11], [5, -11], [12, -6], [9, 0], [7, -1], [7, 12], [-7, 12], [-7, -1], [-9, 0]], { fill: '#fffaf0', lw: 2.2, smooth: false, seed: 4 });
      break;
    case 'freeze':
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        stroke(g, [[-Math.cos(a) * 11, 2 - Math.sin(a) * 11], [Math.cos(a) * 11, 2 + Math.sin(a) * 11]], { lw: 3, color: '#fffaf0', amp: 0 });
      }
      dot(g, 0, 2, 3, '#fffaf0');
      break;
    case 'key':
      ellipse(g, -6, 2, 7, 7, { fill: '#ffd23f', lw: 2.4, seed: 6 });
      dot(g, -6, 2, 2.4, INK);
      rect(g, 0, 0, 15, 4.5, { fill: '#ffd23f', lw: 2, amp: 0 });
      rect(g, 10, 4, 3.5, 5, { fill: '#ffd23f', lw: 1.6, amp: 0 });
      break;
    case 'rare':
      emblem(g, 'ghost', 0, 2, 0.8, '#bff8ec', 7);
      break;
    default:
      text(g, '?', 0, 8, { size: 18, font: FONTS.sign, fill: '#fffaf0', lw: 2 });
  }
}
