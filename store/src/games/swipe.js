// The daily swipe: drag your fare card through the reader at the right
// speed. Too fast or too slow and the reader says SWIPE AGAIN (as is tradition).
// Keyboard: press SPACE when the speed needle is in the green.
import { openArcade } from './frame.js';
import { rrect, rect, ellipse, stroke, text, dot, FONTS, INK, rgba, shape, rrectPts } from '../ink.js';

const SLOT_Y = 250, SLOT_X0 = 190, SLOT_X1 = 610;
// Judge by how long the card takes to cross the reader, so the same physical
// swipe works on a phone and a big monitor: 0.13s .. 0.9s is a good swipe.
const SPAN = SLOT_X1 - SLOT_X0;
const MIN_V = SPAN / 0.9, MAX_V = SPAN / 0.13, GAUGE = 3600;

export function playSwipe(ctx) {
  let checkin = null;
  return openArcade({
    id: 'swipe',
    title: 'DAILY SWIPE',
    color: '#ffd23f',
    blurb: 'Swipe your fare card. Not too fast, not too slow.',
    logical: [800, 450],
    stageBg: '#2b2350',
    intro: {
      title: 'SWIPE IN',
      text: 'Swipe left to right in one smooth move, anywhere on the screen. Keyboard: press SPACE when the needle is in the green.',
      note: ctx.econ.canCheckIn() ? `Today is day ${ctx.econ.streakPreview().next} of your streak.` : 'You already swiped today.',
      button: 'GRAB THE CARD',
    },
    skipIntro: false,
    create(api) {
      const A = api.audio;
      let cardX = 70, dragging = false, grabDX = 0;
      let samples = [];
      let msg = 'SWIPE CARD', msgCol = '#7ed957', msgT = 0;
      let attempts = 0, done = false, flash = 0, needle = 0, auto = null;
      const reset = () => {
        cardX = 70;
        samples = [];
        auto = null;
      };
      const judge = (v) => {
        attempts++;
        if (v > MAX_V) return fail('TOO FAST. SWIPE AGAIN');
        if (v < MIN_V) return fail('TOO SLOW. SWIPE AGAIN');
        success(attempts === 1);
      };
      const fail = (m) => {
        msg = m;
        msgCol = '#ff4f9a';
        msgT = 1.4;
        flash = 0.3;
        A.swipeSound();
        setTimeout(() => A.beepBad(), 120);
        setTimeout(reset, 450);
      };
      const success = (perfect) => {
        done = true;
        msg = 'GO';
        msgCol = '#7ed957';
        A.swipeSound();
        setTimeout(() => { A.beepGood(); A.clunk(); }, 120);
        checkin = api.econ.checkIn(perfect);
        setTimeout(() => {
          const lines = [];
          if (checkin) {
            lines.push(`Streak: ${checkin.count} day${checkin.count === 1 ? '' : 's'}${perfect ? ' · perfect swipe +5' : ''}`);
            if (checkin.key) lines.push('Bonus: a MAINTENANCE KEY');
          } else lines.push('Already swiped today.');
          api.finish({ title: perfect ? 'PERFECT SWIPE' : 'GO THROUGH', tokens: checkin ? checkin.tokens : 0, lines, again: false });
        }, 900);
      };
      const speedOf = () => {
        // average speed across the reader zone
        const inside = samples.filter((s) => s.x >= SLOT_X0 && s.x <= SLOT_X1);
        if (inside.length < 2) return null;
        const a = inside[0], b = inside[inside.length - 1];
        const dt = b.t - a.t;
        return dt > 0 ? (b.x - a.x) / dt : null;
      };
      return {
        start() {
          if (!api.econ.canCheckIn()) {
            done = true;
            api.finish({ title: 'ALREADY IN', lines: ['You swiped today. Come back tomorrow to grow your streak.'], again: false });
          }
          api.setHud('Card reader · Token Sq', `ATTEMPTS: ${attempts}`);
        },
        pointer(type, x) {
          if (done || auto) return;
          if (type === 'down') {
            // grab anywhere: the card follows your finger's relative motion
            dragging = true;
            grabDX = x - cardX;
            samples = [];
          } else if (type === 'move' && dragging) {
            const nx = Math.max(40, Math.min(760, x - grabDX));
            if (nx < cardX - 30) samples = [];
            cardX = nx;
            samples.push({ x: cardX + 120, t: performance.now() / 1000 });
            if (cardX + 120 > SLOT_X1 + 20) {
              dragging = false;
              const v = speedOf();
              if (v == null) return;
              judge(v);
            }
          } else if (type === 'up' && dragging) {
            dragging = false;
            if (cardX + 120 > SLOT_X0 + 40 && cardX + 120 <= SLOT_X1 + 20) fail('INCOMPLETE. SWIPE AGAIN');
            else if (cardX + 120 <= SLOT_X0 + 40) reset();
          }
        },
        key(type, code) {
          if (type !== 'down' || done || auto || dragging) return;
          if (code === 'Space' || code === 'Enter') {
            const v = 250 + ((Math.sin(needle) + 1) / 2) * (GAUGE - 300);
            auto = { v };
            cardX = 70;
            samples = [];
          }
        },
        update(dt) {
          needle += dt * 3.2;
          if (msgT > 0) {
            msgT -= dt;
            if (msgT <= 0 && !done) { msg = 'SWIPE CARD'; msgCol = '#7ed957'; }
          }
          if (flash > 0) flash -= dt;
          if (auto) {
            cardX += auto.v * dt;
            samples.push({ x: cardX + 120, t: performance.now() / 1000 });
            if (cardX + 120 > SLOT_X1 + 20) {
              const v = auto.v;
              auto = null;
              judge(v);
            }
          }
          if (done && cardX < 820) cardX += dt * 900;
          api.setHud('Card reader · Token Sq', `ATTEMPTS: ${attempts}`);
        },
        draw(g, t) {
          // wall behind
          g.fillStyle = '#2b2350';
          g.fillRect(0, 0, 800, 450);
          g.strokeStyle = 'rgba(20,15,38,0.6)';
          g.lineWidth = 1.5;
          for (let y = 0; y < 450; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(800, y); g.stroke(); }
          // reader body
          rrect(g, 140, 120, 520, 230, 26, { fill: '#b8bccc', shade: '#8a8ea4', sdx: 0, sdy: 10, lw: 4, seed: 3 });
          rrect(g, 160, 136, 480, 70, 12, { fill: '#1a1a2a', lw: 3.4, seed: 4 });
          // LED message
          g.save();
          g.font = `30px ${FONTS.sign}`;
          g.textAlign = 'center';
          g.fillStyle = msgCol;
          g.shadowColor = msgCol;
          g.shadowBlur = 12;
          g.fillText(msg, 400, 182);
          g.restore();
          // slot
          rrect(g, SLOT_X0 - 30, SLOT_Y - 14, SLOT_X1 - SLOT_X0 + 60, 28, 12, { fill: '#2a2a3a', lw: 3.4, seed: 5 });
          stroke(g, [[SLOT_X0 - 20, SLOT_Y], [SLOT_X1 + 20, SLOT_Y]], { lw: 4, color: '#0a0a14', amp: 0 });
          // lights
          dot(g, 600, 300, 12, done ? '#7ed957' : '#2a4a2a');
          dot(g, 560, 300, 12, flash > 0 ? '#ff4f9a' : '#4a2a2a');
          text(g, 'GO', 600, 334, { size: 13, font: FONTS.sign, fill: INK, lw: 0 });
          text(g, 'NO', 560, 334, { size: 13, font: FONTS.sign, fill: INK, lw: 0 });
          text(g, '→ SWIPE →', 300, 320, { size: 22, font: FONTS.sign, fill: '#5a5e74', lw: 0 });
          // speed gauge (shows the needle for keyboard players)
          const gx = 400, gy = 420;
          g.lineCap = 'butt';
          g.lineWidth = 14;
          const span = (v0, v1, col) => {
            const a0 = Math.PI + (v0 / GAUGE) * Math.PI, a1 = Math.PI + (v1 / GAUGE) * Math.PI;
            g.strokeStyle = col;
            g.beginPath();
            g.arc(gx, gy, 52, a0, a1);
            g.stroke();
          };
          span(0, MIN_V, '#ff4f9a');
          span(MIN_V, MAX_V, '#7ed957');
          span(MAX_V, GAUGE, '#ff4f9a');
          const nv = 250 + ((Math.sin(needle) + 1) / 2) * (GAUGE - 300);
          const na = Math.PI + (nv / GAUGE) * Math.PI;
          stroke(g, [[gx, gy], [gx + Math.cos(na) * 58, gy + Math.sin(na) * 58]], { lw: 4, color: '#fffaf0', amp: 0 });
          dot(g, gx, gy, 6, '#fffaf0');
          // the card (rides in the slot)
          const cy = SLOT_Y - 60;
          g.save();
          g.translate(cardX, cy);
          g.rotate(dragging || auto ? 0 : -0.04);
          rrect(g, 0, 0, 150, 92, 10, { fill: '#ffd23f', shade: '#e0b020', sdx: 3, sdy: 3, lw: 3.4, seed: 7 });
          rect(g, 0, 18, 150, 14, { fill: '#140f26', lw: 0, amp: 0 });
          text(g, '3RD RAIL', 75, 56, { size: 20, font: FONTS.sign, fill: '#140f26', lw: 0 });
          text(g, 'FARE CARD', 75, 78, { size: 12, font: FONTS.sign, fill: '#140f26', lw: 0 });
          shape(g, [[130, 40], [122, 56], [128, 56], [124, 70], [136, 52], [130, 52], [134, 40]], { fill: '#140f26', lw: 0, smooth: false });
          g.restore();
          if (!dragging && !auto && !done && cardX < 100) {
            const bob = Math.sin(t * 4) * 6;
            text(g, 'SWIPE →', cardX + 75, cy - 18 + bob, { size: 16, font: FONTS.sign, fill: '#fffaf0', lw: 4 });
          }
        },
      };
    },
  }, ctx).then(() => ({ checkin }));
}
