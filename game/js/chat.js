// chat.js — the chat input + iMessage-style bubbles over heads.
// Your own messages render in the blue apple bubble; everyone else's in gray.

import { PAL, wrapText } from './util.js';

const BUBBLE_LIFE = 7;      // seconds a bubble hangs around
const BUBBLE_FADE = 0.6;
const FONT = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export class Chat {
  constructor(barEl, inputEl, onSend) {
    this.bar = barEl;
    this.input = inputEl;
    this.onSend = onSend;
    this.open = false;
    this.handler = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = inputEl.value.trim().slice(0, 120);
        if (text) this.onSend(text);
        this.close();
      } else if (e.key === 'Escape') {
        this.close();
      }
    };
    inputEl.addEventListener('keydown', this.handler);
  }

  destroy() {
    this.input.removeEventListener('keydown', this.handler);
    this.close();
  }

  openBar() {
    this.open = true;
    this.bar.style.display = 'flex';
    this.input.value = '';
    setTimeout(() => this.input.focus(), 0);
  }

  close() {
    this.open = false;
    this.input.value = '';
    this.bar.style.display = 'none';
    this.input.blur();
  }
}

// add a message to an actor's bubble stack (players and scripted objects both)
export function addBubble(actor, text, life = BUBBLE_LIFE) {
  if (!actor.bubbles) actor.bubbles = [];
  actor.bubbles.push({ text: String(text).slice(0, 200), t: 0, life });
  while (actor.bubbles.length > 3) actor.bubbles.shift();
}

export function updateBubbles(actor, dt) {
  if (!actor.bubbles) return;
  for (const b of actor.bubbles) b.t += dt;
  actor.bubbles = actor.bubbles.filter(b => b.t < b.life);
}

// Draw an actor's bubbles on the hi-res overlay.
// headScreen = {x, y} screen position of the point the tail should aim at.
export function drawBubbles(o, actor, headScreen, mine) {
  if (!actor.bubbles || !actor.bubbles.length) return;
  o.font = FONT;
  o.textBaseline = 'top';
  const maxW = 190;
  let bottom = headScreen.y - 10;
  for (let i = actor.bubbles.length - 1; i >= 0; i--) {
    const b = actor.bubbles[i];
    const alpha = b.t > b.life - BUBBLE_FADE ? Math.max(0, (b.life - b.t) / BUBBLE_FADE) : 1;
    const lines = wrapText(o, b.text, maxW);
    const lineH = 15;
    const w = Math.min(maxW, Math.max(...lines.map(l => o.measureText(l).width))) + 18;
    const h = lines.length * lineH + 10;
    const x = headScreen.x - w / 2;
    const y = bottom - h - (i === actor.bubbles.length - 1 ? 7 : 3);

    o.globalAlpha = alpha;
    o.fillStyle = mine ? PAL.imBlue : PAL.imGray;
    roundRect(o, x, y, w, h, 10);
    o.fill();
    // tail on the newest bubble only
    if (i === actor.bubbles.length - 1) {
      o.beginPath();
      o.moveTo(headScreen.x - 5, y + h - 1);
      o.lineTo(headScreen.x, y + h + 6);
      o.lineTo(headScreen.x + 6, y + h - 1);
      o.closePath();
      o.fill();
    }
    o.fillStyle = mine ? '#ffffff' : '#111111';
    lines.forEach((l, li) => o.fillText(l, x + 9, y + 5 + li * lineH));
    o.globalAlpha = 1;
    bottom = y;
  }
}

export function drawNameTag(o, name, headScreen, mine) {
  if (!name) return;
  o.font = '10px ui-monospace, Menlo, Consolas, monospace';
  o.textBaseline = 'bottom';
  o.textAlign = 'center';
  o.fillStyle = mine ? 'rgba(90,90,90,0.85)' : 'rgba(140,140,140,0.85)';
  o.fillText(name, headScreen.x, headScreen.y - 2);
  o.textAlign = 'left';
}

function roundRect(o, x, y, w, h, r) {
  o.beginPath();
  o.moveTo(x + r, y);
  o.arcTo(x + w, y, x + w, y + h, r);
  o.arcTo(x + w, y + h, x, y + h, r);
  o.arcTo(x, y + h, x, y, r);
  o.arcTo(x, y, x + w, y, r);
  o.closePath();
}
