// chat.js — the chat bar and the speech bubbles that float over heads.
//
// Bubbles are real DOM, positioned each frame from the 3D projection: yours in
// the blue apple bubble, everyone else's in the gray one. DOM means the text
// stays crisp while the world behind it stays pixelated.

const BUBBLE_LIFE = 7;
const MAX_STACK = 3;

export class Chat {
  constructor(barEl, inputEl, onSend) {
    this.bar = barEl;
    this.input = inputEl;
    this.onSend = onSend;
    this.open = false;
    this.handler = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = this.input.value.trim().slice(0, 140);
        if (text) this.onSend(text);
        this.close();
      } else if (e.key === 'Escape') {
        this.close();
      }
    };
    this.input.addEventListener('keydown', this.handler);
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

  destroy() {
    this.input.removeEventListener('keydown', this.handler);
    this.close();
  }
}

// ---------------------------------------------------------------- bubbles
export function addBubble(actor, text, life = BUBBLE_LIFE) {
  if (!actor.bubbles) actor.bubbles = [];
  actor.bubbles.push({ text: String(text).slice(0, 200), t: 0, life, el: null });
  while (actor.bubbles.length > MAX_STACK) {
    const old = actor.bubbles.shift();
    if (old.el) old.el.remove();
  }
}

export function updateBubbles(actor, dt) {
  if (!actor.bubbles || !actor.bubbles.length) return;
  for (const b of actor.bubbles) b.t += dt;
  const dead = actor.bubbles.filter(b => b.t >= b.life);
  for (const b of dead) if (b.el) b.el.remove();
  if (dead.length) actor.bubbles = actor.bubbles.filter(b => b.t < b.life);
}

export function clearBubbles(actor) {
  if (!actor.bubbles) return;
  for (const b of actor.bubbles) if (b.el) b.el.remove();
  actor.bubbles = [];
}

// The bubble layer owns the DOM nodes; call layout() once a frame.
export class BubbleLayer {
  constructor(root) {
    this.root = root;
    this.tags = new Map();     // actor → name tag element
  }

  // actors: [{actor, screen:{x,y,visible,depth}, mine, name}]
  layout(items) {
    for (const it of items) {
      const { actor, screen, mine, name } = it;
      // name tag
      if (name) {
        let tag = this.tags.get(actor);
        if (!tag) {
          tag = document.createElement('div');
          tag.className = 'nametag';
          this.root.appendChild(tag);
          this.tags.set(actor, tag);
        }
        if (tag.textContent !== name) tag.textContent = name;
        if (screen.visible) {
          tag.style.display = 'block';
          tag.style.transform = `translate(-50%,-100%) translate(${screen.x.toFixed(1)}px,${(screen.y - 4).toFixed(1)}px)`;
        } else tag.style.display = 'none';
      } else {
        const tag = this.tags.get(actor);
        if (tag) { tag.remove(); this.tags.delete(actor); }
      }

      if (!actor.bubbles || !actor.bubbles.length) continue;
      let stackY = screen.y - (name ? 20 : 6);
      for (let i = actor.bubbles.length - 1; i >= 0; i--) {
        const b = actor.bubbles[i];
        if (!b.el) {
          b.el = document.createElement('div');
          b.el.className = 'bubble ' + (mine ? 'mine' : 'theirs');
          b.el.textContent = b.text;
          if (i === actor.bubbles.length - 1) b.el.classList.add('tail');
          this.root.appendChild(b.el);
        }
        if (!screen.visible) { b.el.style.display = 'none'; continue; }
        b.el.style.display = 'block';
        const fade = b.life - b.t;
        b.el.style.opacity = fade < 0.6 ? String(Math.max(0, fade / 0.6)) : '1';
        b.el.style.transform = `translate(-50%,-100%) translate(${screen.x.toFixed(1)}px,${stackY.toFixed(1)}px)`;
        stackY -= (b.el.offsetHeight || 26) + 4;
      }
    }
  }

  forget(actor) {
    const tag = this.tags.get(actor);
    if (tag) { tag.remove(); this.tags.delete(actor); }
    clearBubbles(actor);
  }

  clear() {
    for (const [, tag] of this.tags) tag.remove();
    this.tags.clear();
    this.root.innerHTML = '';
  }
}
