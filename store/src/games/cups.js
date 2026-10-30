// Eight's shell game: a token goes under a cup, Eight shuffles, you pick.
// Honest game — the token never leaves its cup; bigger bets mean more, faster swaps.
import { openArcade } from './frame.js';
import { dropMark } from './runner.js';
import { drawNpc } from '../art/figure.js';
import { shape, rect, rrect, ellipse, stroke, tube, text, FONTS, INK, rgba, shade, tint, mulberry32 } from '../ink.js';

const SLOTS = [250, 400, 550];
const TABLE_Y = 338;        // where cups stand
const CUP_W = 46, CUP_TOP = 32, CUP_H = 92;
const FUR = '#1d1830', COAT = '#7b2d8a';
const SHUFFLE = { 10: [6, 0.45], 25: [9, 0.36], 50: [12, 0.28], 100: [15, 0.2] };

const QUIPS = {
  show: ['Keep your eye on the token…', 'Watch it close now…', 'See it? Good. Now watch.'],
  shuffle: ['Round and round she goes…', 'Hands faster than the A train!', 'Don\'t blink, pal.', 'Easy money, easy money…'],
  pick: ['Pick a cup. Any cup.', 'Well? Which one?', 'Take your time. Or don\'t.'],
  win: ['It is decidedly so. You win.', 'Sharp eyes, kid. Real sharp.', 'Outlook: bad for business.'],
  lose: ['Very doubtful. Better luck next time.', 'My sources say no.', 'Nope! Ask again?'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ease = (t) => 0.5 - Math.cos(Math.PI * Math.max(0, Math.min(1, t))) / 2;
// Phones get a taller canvas: the 800x450 scene sits at the bottom and the
// speech bubble + labels get room to be readable.
const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < 640;

export function playCups(ctx) {
  const E = ctx.econ;
  const bet = [10, 25, 50, 100].includes(ctx.bet) ? ctx.bet : 10;
  const [SWAPS, SWAP_T] = SHUFFLE[bet];
  let winStreak = 0;
  const TALL = isNarrow();
  const H = TALL ? 800 : 450, OY = H - 450, TS = TALL ? 1.5 : 1;
  const say = (msg, cls = 'hot') => {
    if (ctx.hud && ctx.hud.toast) ctx.hud.toast(msg, cls, 2600);
  };
  const hudFor = (api) => {
    E.ensureDay();
    api.setHud(`BET ${bet} · EIGHT'S LOSSES TODAY ${E.S.day.cupsWins}/5${winStreak > 1 ? ` · STREAK ${winStreak}` : ''}`, `TOKENS ${E.S.tokens.toLocaleString('en-US')}`);
  };

  return openArcade({
    id: 'cups',
    title: 'SHELL GAME',
    color: '#e0b07a',
    blurb: 'Follow the token. Find it, double your bet.',
    logical: [800, H],
    stageBg: '#3a3170',
    intro: {
      title: 'FIND THE TOKEN',
      text: 'Eight hides a token under one cup and shuffles. Pick the cup with the token and you win double your bet.',
      note: `Your bet: ${bet} tokens · ${SWAPS} swaps · Eight quits after 5 losses a day.`,
      button: `BET ${bet}`,
    },
    hud: hudFor,
    async beforePlay(api) {
      E.ensureDay();
      if (E.S.day.cupsWins >= 5) {
        say('Eight packed up for the day. Come back tomorrow.');
        api.setHud('Eight is out of tokens for today.', null);
        return false;
      }
      if (!E.spend(bet)) {
        say(`You need ${bet} tokens to bet.`);
        api.setHud(`Not enough tokens for a ${bet} bet.`, null);
        return false;
      }
      return true;
    },
    create(api) {
      const A = api.audio;
      // cups keep identity; `slot` says where they rest
      const cups = SLOTS.map((x, i) => ({ id: i, slot: i, x, y: TABLE_Y, s: 1, lift: 0, depth: 0, glow: 0 }));
      const tokenCup = Math.floor(Math.random() * 3);
      const r = mulberry32((Math.random() * 1e9) | 0);
      let phase = 'idle', pt = 0;
      let swaps = [], swapIdx = 0, swap = null;
      let sel = 1, hover = -1, picked = -1, won = false;
      let bubble = pick(QUIPS.pick), bubbleT = 0;
      const paws = { L: { x: 335, y: 302 }, R: { x: 465, y: 302 } };
      const pawTarget = { L: { x: 335, y: 302 }, R: { x: 465, y: 302 } };
      let coins = [];
      let started = false;

      const talk = (key) => { bubble = pick(QUIPS[key]); bubbleT = 0; };
      const REST = { L: { x: 335, y: 302 }, R: { x: 465, y: 302 } };
      // the paw on the cup's side lifts it; the other one rests on the table
      const lifter = (c) => {
        const side = c.x < 400 ? 'L' : c.x > 400 ? 'R' : 'R';
        const other = side === 'L' ? 'R' : 'L';
        const away = c.x < 400 ? -1 : 1;
        pawTarget[side] = { x: c.x + away * c.lift * 40 + 4, y: c.y - CUP_H - c.lift * 56 + 12 };
        pawTarget[other] = { ...REST[other] };
      };
      const cupAtSlot = (s) => cups.find((c) => c.slot === s);

      const planSwaps = () => {
        const pairs = [[0, 1], [1, 2], [0, 2]];
        const out = [];
        let prev = -1;
        for (let i = 0; i < SWAPS; i++) {
          let k = Math.floor(r() * 3);
          if (k === prev && r() < 0.7) k = (k + 1 + Math.floor(r() * 2)) % 3;
          prev = k;
          out.push(pairs[k]);
        }
        return out;
      };

      const startSwap = () => {
        const [a, b] = swaps[swapIdx];
        const ca = cupAtSlot(a), cb = cupAtSlot(b);
        const frontFirst = r() < 0.5;
        swap = { ca, cb, a, b, t: 0, front: frontFirst ? ca : cb };
        A.shuffleTick();
      };

      const doPick = (i) => {
        if (phase !== 'pick' || i < 0 || i > 2) return;
        picked = cupAtSlot(i).id;
        won = picked === tokenCup;
        phase = 'reveal';
        pt = 0;
        A.click();
      };

      const settle = () => {
        if (won) {
          E.addTokens(bet * 2, 'cups');
          E.S.day.cupsWins += 1;
          if (E.S.day.cupsWins === 3) E.achieve('shell3');
          winStreak += 1;
          E.S.bests.cupsStreak = Math.max(E.S.bests.cupsStreak || 0, winStreak);
          E.track('win:cups');
          E.commit();
          A.fanfare();
          A.coin(true);
        } else {
          winStreak = 0;
          A.sad();
        }
      };

      const finish = () => {
        const out = E.S.day.cupsWins >= 5;
        const lines = won
          ? [`You bet ${bet}, you get ${bet * 2} back.`, out ? 'Eight: "That\'s it, I\'m tapped out for today!"' : `Win streak: ${winStreak}`]
          : [`Eight keeps your ${bet} tokens.`, 'It was under the glowing cup.'];
        api.finish({
          title: won ? 'YOU FOUND IT' : 'NOT THIS TIME',
          tokens: won ? bet * 2 : 0,
          lines,
          again: !out,
          againLabel: `BET ${bet} AGAIN`,
        });
      };

      return {
        start() {
          started = true;
          phase = 'show';
          pt = 0;
          talk('show');
          hudFor(api);
        },
        destroy() {},
        pointer(type, x, py) {
          const y = py - OY;
          const idx = SLOTS.findIndex((sx) => Math.abs(x - sx) < 70);
          const onCup = idx >= 0 && y > TABLE_Y - CUP_H - 40 && y < TABLE_Y + 84;
          if (type === 'move') hover = onCup ? idx : -1;
          if (type === 'down' && onCup && phase === 'pick') doPick(idx);
        },
        key(type, code) {
          if (type !== 'down' || phase !== 'pick') return;
          if (code === 'Digit1' || code === 'Numpad1') doPick(0);
          else if (code === 'Digit2' || code === 'Numpad2') doPick(1);
          else if (code === 'Digit3' || code === 'Numpad3') doPick(2);
          else if (code === 'ArrowLeft' || code === 'KeyA') { sel = (sel + 2) % 3; A.click(); }
          else if (code === 'ArrowRight' || code === 'KeyD') { sel = (sel + 1) % 3; A.click(); }
          else if (code === 'Enter' || code === 'Space') doPick(sel);
        },
        update(dt) {
          pt += dt;
          bubbleT += dt;
          // paws ease toward their targets
          for (const k of ['L', 'R']) {
            const kk = 1 - Math.exp(-dt * 22);
            paws[k].x += (pawTarget[k].x - paws[k].x) * kk;
            paws[k].y += (pawTarget[k].y - paws[k].y) * kk;
          }
          const tc = cups[tokenCup];
          if (phase === 'show') {
            // lift the token's cup, show it, put it back
            const T = 1.5;
            const k = pt / T;
            tc.lift = k < 0.25 ? ease(k / 0.25) : k < 0.7 ? 1 : 1 - ease((k - 0.7) / 0.3);
            lifter(tc);
            if (pt >= T) {
              tc.lift = 0;
              swaps = planSwaps();
              swapIdx = 0;
              phase = 'shuffle';
              pt = 0;
              talk('shuffle');
              startSwap();
            }
          } else if (phase === 'shuffle' && swap) {
            swap.t += dt / SWAP_T;
            const k = ease(swap.t);
            const { ca, cb, a, b } = swap;
            const arc = Math.sin(Math.PI * Math.min(1, swap.t));
            for (const [c, from, to] of [[ca, a, b], [cb, b, a]]) {
              const front = c === swap.front;
              c.x = SLOTS[from] + (SLOTS[to] - SLOTS[from]) * k;
              c.y = TABLE_Y + (front ? 16 : -18) * arc;
              c.s = 1 + (front ? 0.06 : -0.1) * arc;
              c.depth = front ? 1 : -1;
            }
            const left = ca.x < cb.x ? ca : cb, right = left === ca ? cb : ca;
            pawTarget.L = { x: left.x, y: left.y - CUP_H * left.s + 8 };
            pawTarget.R = { x: right.x, y: right.y - CUP_H * right.s + 8 };
            if (swap.t >= 1) {
              ca.slot = b; cb.slot = a;
              for (const c of [ca, cb]) { c.x = SLOTS[c.slot]; c.y = TABLE_Y; c.s = 1; c.depth = 0; }
              swapIdx += 1;
              if (swapIdx >= swaps.length) {
                swap = null;
                if (ctx.qa) ctx.qa({ tokenSlot: cups[tokenCup].slot });
                phase = 'pick';
                pt = 0;
                talk('pick');
                pawTarget.L = { x: 335, y: 302 };
                pawTarget.R = { x: 465, y: 302 };
              } else startSwap();
            }
          } else if (phase === 'reveal') {
            const pc = cups[picked];
            pc.lift = ease(pt / 0.45);
            lifter(won || pt < 0.95 ? pc : tc);
            if (pt > 0.45 && !pc.done) {
              pc.done = true;
              settle();
              talk(won ? 'win' : 'lose');
              if (won) {
                for (let i = 0; i < 18; i++) coins.push({ x: pc.x, y: TABLE_Y - 24, vx: (Math.random() - 0.5) * 360, vy: -260 - Math.random() * 260, life: 1.2 });
              }
            }
            if (!won && pt > 0.95) tc.lift = ease((pt - 0.95) / 0.4);
            if (pt > (won ? 1.9 : 2.2)) {
              phase = 'done';
              finish();
            }
          }
          for (const c of cups) c.glow = Math.max(0, c.glow - dt * 3);
          for (const co of coins) { co.vy += 900 * dt; co.x += co.vx * dt; co.y += co.vy * dt; co.life -= dt; }
          coins = coins.filter((co) => co.life > 0);
        },
        draw(g, t) {
          drawRoom(g, t, OY, TALL);
          g.save();
          g.translate(0, OY);
          // Eight behind the table
          drawNpc(g, 'eight', 400, 432, { scale: 3.05, t, blink: (t % 3.3) < 0.12 ? 1 : 0, talk: bubbleT < 1.2, boil: 81 + (Math.floor(t * 7) % 3) * 101 });
          // arms reach to the paws (behind the cups)
          for (const [k, sx] of [['L', 366], ['R', 440]]) {
            tube(g, [[sx, 236], [(sx + paws[k].x) / 2, Math.min(paws[k].y, 240) - 4], [paws[k].x, paws[k].y]], COAT, 22, { lw: 3.4, seed: k === 'L' ? 5 : 9 });
          }
          drawTable(g);
          // token (only visible when its cup is lifted / during the reveal)
          const tc = cups[tokenCup];
          if (tc.lift > 0.05 || phase === 'done' || (phase === 'reveal' && won && cups[picked].lift > 0.3)) drawToken(g, SLOTS[tc.slot], TABLE_Y - 20, t);
          // cups, back to front
          const order = cups.slice().sort((a, b) => a.depth - b.depth);
          const showTrue = !won && (phase === 'done' || (phase === 'reveal' && pt > 0.95));
          for (const c of order) {
            const slot = c.slot;
            const hot = (phase === 'pick' && (hover === slot || (hover < 0 && sel === slot))) || (showTrue && c.id === tokenCup);
            drawCup(g, c, t, hot, (phase === 'done' || (phase === 'reveal' && c.done)) && c.id === tokenCup);
          }
          // paws on top
          for (const k of ['L', 'R']) {
            ellipse(g, paws[k].x, paws[k].y, 15, 12, { fill: FUR, shade: shade(FUR, 0.25), sdx: 1.5, sdy: 2, lw: 3, seed: k === 'L' ? 11 : 13 });
            for (let f = -1; f <= 1; f++) stroke(g, [[paws[k].x + f * 6, paws[k].y + 2], [paws[k].x + f * 6, paws[k].y + 9]], { lw: 2, amp: 0 });
          }
          // pick labels
          if (phase === 'pick') {
            SLOTS.forEach((sx, i) => {
              const hot = hover === i || (hover < 0 && sel === i);
              ellipse(g, sx, 394, 17 * TS, 17 * TS, { fill: hot ? '#ffd23f' : '#fffaf0', lw: 3, seed: 20 + i });
              text(g, String(i + 1), sx, 394 + 8 * TS, { size: 20 * TS, font: FONTS.sign, fill: INK, lw: 0 });
            });
            if (!TALL) text(g, 'PICK A CUP', 400, 436, { size: 22, font: FONTS.sign, fill: '#ffd23f', lw: 5 });
          }
          // coins
          for (const co of coins) drawToken(g, co.x, co.y, t * 3 + co.x, 0.6);
          if (!TALL) drawBubble(g, bubble, Math.min(1, bubbleT * 4));
          g.restore();
          if (TALL) {
            drawBubbleTall(g, bubble, Math.min(1, bubbleT * 4), OY);
            if (phase === 'pick') text(g, 'TAP THE CUP WITH THE TOKEN', 400, 74 + Math.sin(t * 5) * 3, { size: 34, font: FONTS.sign, fill: '#ffd23f', lw: 7 });
          }
        },
      };
    },
  }, ctx);
}

// ---------------------------------------------------------------- art

function drawRoom(g, t, oy = 0, tall = false) {
  const H = 450 + oy;
  g.fillStyle = '#3a3170';
  g.fillRect(0, 0, 800, H);
  // tile rows (cover the extra height on tall screens too)
  g.strokeStyle = 'rgba(20,15,38,0.55)';
  g.lineWidth = 1.4;
  for (let y = 6, row = 0; y < oy + 330; y += 16, row++) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(800, y); g.stroke();
    for (let x = (row % 2) * 16; x < 800; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
  }
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 8; y < oy + 330; y += 16) g.fillRect(0, y, 800, 2);
  // spotlight on the table
  g.save();
  g.globalCompositeOperation = 'lighter';
  const lg = g.createLinearGradient(0, 0, 0, oy + 340);
  lg.addColorStop(0, 'rgba(255,236,190,0.24)');
  lg.addColorStop(1, 'rgba(255,236,190,0.03)');
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(330, 0); g.lineTo(470, 0); g.lineTo(700, oy + 340); g.lineTo(100, oy + 340); g.fill();
  g.restore();
  // faded graffiti + cardboard sign
  text(g, 'RIZO', 110, oy * 0.45 + 120, { size: tall ? 60 : 40, font: FONTS.tag, fill: 'rgba(255,79,154,0.35)', lw: 0, rot: -0.1 });
  text(g, 'KAPS', 700, oy * 0.55 + 210, { size: tall ? 50 : 34, font: FONTS.tag, fill: 'rgba(62,199,176,0.35)', lw: 0, rot: 0.08 });
  g.save();
  g.translate(96, oy + 218);
  g.rotate(-0.07);
  rect(g, -62, -40, 124, 78, { fill: '#c89a62', shade: '#a07844', sdx: 0, sdy: 4, lw: 3, amp: 0.8, seed: 31 });
  text(g, 'FIND THE', 0, -10, { size: 18, font: FONTS.marker, fill: INK, lw: 0 });
  text(g, 'TOKEN', 0, 12, { size: 22, font: FONTS.marker, fill: '#d4473f', lw: 0 });
  text(g, '2X PAYOUT', 0, 30, { size: 12, font: FONTS.marker, fill: INK, lw: 0 });
  g.restore();
}

function drawTable(g) {
  // cardboard box top (slight perspective) and front
  shape(g, [[150, 300], [650, 300], [690, 362], [110, 362]], { fill: '#d8aa72', shade: '#b88a52', sdx: 0, sdy: 4, lw: 3.4, smooth: false, seed: 41 });
  stroke(g, [[400, 300], [400, 362]], { lw: 2, color: 'rgba(20,15,38,0.25)', amp: 0 });
  rect(g, 110, 362, 580, 100, { fill: '#c89a62', shade: '#a07844', sdx: 0, sdy: 6, lw: 3.4, amp: 0.6, seed: 42 });
  // tape strip
  g.fillStyle = 'rgba(240,226,190,0.6)';
  g.fillRect(372, 362, 56, 90);
  text(g, 'FRAGILE', 560, 430, { size: 22, font: FONTS.sign, fill: 'rgba(138,42,26,0.6)', lw: 0, rot: -0.05 });
  text(g, 'THIS SIDE UP ↑', 220, 428, { size: 14, font: FONTS.sign, fill: 'rgba(20,15,38,0.45)', lw: 0, rot: 0.03 });
}

function drawCup(g, c, t, hot, hasToken) {
  g.save();
  const away = c.x < 400 ? -1 : 1;
  g.translate(c.x + away * c.lift * 26, c.y - c.lift * 56);
  g.rotate(away * c.lift * 0.3);
  g.scale(c.s, c.s);
  if (c.depth < 0) g.globalAlpha = 0.92;
  // inside rim shows when lifted
  if (c.lift > 0.02) ellipse(g, 0, 0, CUP_W, 9, { fill: '#6a1a1a', lw: 3, seed: c.id + 3 });
  if (hot) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(0, -CUP_H / 2, 10, 0, -CUP_H / 2, 90);
    gl.addColorStop(0, 'rgba(255,210,63,0.35)');
    gl.addColorStop(1, 'rgba(255,210,63,0)');
    g.fillStyle = gl;
    g.fillRect(-100, -CUP_H - 50, 200, CUP_H + 100);
    g.restore();
  }
  const body = hasToken ? '#e8565a' : '#d4473f';
  shape(g, [[-CUP_W, 0], [CUP_W, 0], [CUP_TOP, -CUP_H], [-CUP_TOP, -CUP_H]], { fill: body, shade: shade(body, 0.3), sdx: 4, sdy: 0, lw: hot ? 4.6 : 3.6, line: hot ? '#ffd23f' : INK, smooth: true, seed: c.id + 7, amp: 0.6 });
  // rim band + ridges
  stroke(g, [[-CUP_W + 3, -10], [CUP_W - 3, -10]], { lw: 2.4, color: tint(body, 0.35), amp: 0 });
  stroke(g, [[-CUP_TOP - 2, -CUP_H + 16], [CUP_TOP + 2, -CUP_H + 16]], { lw: 2, color: 'rgba(255,250,240,0.7)', amp: 0 });
  stroke(g, [[-CUP_TOP - 4, -CUP_H + 26], [CUP_TOP + 4, -CUP_H + 26]], { lw: 2, color: 'rgba(255,250,240,0.7)', amp: 0 });
  ellipse(g, 0, -CUP_H, CUP_TOP, 7, { fill: tint(body, 0.18), lw: 3, seed: c.id + 9 });
  // shine
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath();
  g.moveTo(-CUP_W + 12, -6); g.lineTo(-CUP_TOP + 6, -CUP_H + 8); g.lineTo(-CUP_TOP + 16, -CUP_H + 8); g.lineTo(-CUP_W + 24, -6);
  g.fill();
  g.restore();
}

function drawToken(g, x, y, t, s = 1) {
  const spin = Math.cos(t * 5);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gl = g.createRadialGradient(x, y, 2, x, y, 34 * s);
  gl.addColorStop(0, 'rgba(255,220,120,0.5)');
  gl.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = gl;
  g.fillRect(x - 40 * s, y - 40 * s, 80 * s, 80 * s);
  g.restore();
  g.save();
  g.translate(x, y);
  g.scale(Math.max(0.2, Math.abs(spin)) * s, s);
  ellipse(g, 0, 0, 18, 18, { fill: spin > 0 ? '#f0c24a' : '#d4a030', lw: 3.4, amp: 0.3, seed: 3 });
  ellipse(g, 0, 0, 11, 11, { fill: '#ffe08a', lw: 0, amp: 0, seed: 4 });
  dropMark(g, 0, 0, 8.5);
  g.restore();
}

// big centered bubble for phones, tail pointing down at Eight
function drawBubbleTall(g, msg, k, oy) {
  if (!msg) return;
  g.save();
  g.font = `40px ${FONTS.hand}`;
  const w = Math.min(720, g.measureText(msg).width + 60);
  const x = 400 - w / 2, y = oy - 132;
  g.globalAlpha = k;
  g.translate(400, y + 50);
  g.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  g.translate(-400, -(y + 50));
  rrect(g, x, y, w, 100, 24, { fill: '#fffaf0', lw: 4.4, seed: 52 });
  shape(g, [[390, y + 96], [420, oy + 96], [444, y + 98]], { fill: '#fffaf0', lw: 0, smooth: false });
  stroke(g, [[390, y + 98], [420, oy + 96], [442, y + 99]], { lw: 4.4, amp: 0 });
  g.fillStyle = INK;
  g.font = `40px ${FONTS.hand}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(msg, 400, y + 52, w - 40);
  g.restore();
}

function drawBubble(g, msg, k) {
  if (!msg) return;
  g.save();
  g.font = `22px ${FONTS.hand}`;
  const w = Math.min(330, g.measureText(msg).width + 36);
  const x = 772 - w, y = 22;
  g.globalAlpha = k;
  g.translate(x + w, y);
  g.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  g.translate(-w, 0);
  rrect(g, 0, 0, w, 54, 16, { fill: '#fffaf0', lw: 3.4, seed: 51 });
  shape(g, [[34, 50], [16, 84], [62, 52]], { fill: '#fffaf0', lw: 0, smooth: false });
  stroke(g, [[34, 52], [16, 84], [60, 53]], { lw: 3.4, amp: 0 });
  g.fillStyle = INK;
  g.font = `22px ${FONTS.hand}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(msg, 18, 28, w - 30);
  g.restore();
}
