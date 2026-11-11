// On-screen controls for phones and tablets: a floating stick on the left,
// four action buttons on the right. They appear on the first touch and feed
// the same virtual input layer the QA harness uses.
import { G } from './game.js';
import { el, clamp } from './util.js';

const CSS = `
#touch { position:absolute; inset:0; pointer-events:none; z-index:8; display:none; }
#touch.on { display:block; }
#touch .pad { position:absolute; left:0; top:22%; bottom:0; width:46%; pointer-events:auto; touch-action:none; }
#touch .nub { position:absolute; width:110px; height:110px; margin:-55px 0 0 -55px; border-radius:50%; border:4px solid rgba(255,244,220,0.55); background:rgba(27,16,36,0.25); display:none; }
#touch .nub i { position:absolute; left:50%; top:50%; width:52px; height:52px; margin:-26px 0 0 -26px; border-radius:50%; background:rgba(255,212,90,0.85); border:3px solid #2b1a33; }
#touch .tb { position:absolute; width:74px; height:74px; border-radius:50%; border:4px solid #2b1a33; background:rgba(255,244,220,0.82); color:#2b1a33; font:900 22px/66px var(--font); text-align:center; pointer-events:auto; touch-action:none; box-shadow:0 5px 0 rgba(27,16,36,0.5); user-select:none; }
#touch .tb.down { transform:translateY(4px); box-shadow:0 1px 0 rgba(27,16,36,0.5); background:#ffd45a; }
#touch .tb.a { right:26px; bottom:112px; width:92px; height:92px; line-height:84px; background:rgba(240,138,36,0.9); color:#fff4dc; }
#touch .tb.b { right:132px; bottom:84px; }
#touch .tb.y { right:44px; bottom:222px; }
#touch .tb.x { right:138px; bottom:176px; }
#touch .tb.m { right:14px; top:64px; width:54px; height:54px; line-height:46px; font-size:20px; }
#touch .lab { position:absolute; left:50%; top:100%; transform:translateX(-50%); font:800 11px/1.2 var(--font); color:#fff4dc; text-shadow:0 1px 0 #2b1a33; white-space:nowrap; margin-top:2px; }
`;

export function installTouch() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const nubDot = el('i');
  const nub = el('div.nub', nubDot);
  const pad = el('div.pad');
  const root = el('div#touch', pad, nub);
  const mk = (cls, action, glyph) => {
    const b = el(`div.tb.${cls}`, glyph);
    const dn = (e) => { e.preventDefault(); b.classList.add('down'); G.input.press(action); G.input.hold(action, true); G.input.device = 'touch'; };
    const up = (e) => { e.preventDefault(); b.classList.remove('down'); G.input.hold(action, false); };
    b.addEventListener('touchstart', dn, { passive: false });
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    root.appendChild(b);
    return b;
  };
  mk('a', 'a', 'A'); mk('b', 'b', 'B'); mk('x', 'x', 'X'); mk('y', 'y', 'Y'); mk('m', 'menu', '☰');
  document.getElementById('app').appendChild(root);

  let id = null, ox = 0, oy = 0;
  const end = () => { id = null; nub.style.display = 'none'; G.input.setAxis(0, 0); };
  pad.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    id = t.identifier; ox = t.clientX; oy = t.clientY;
    nub.style.display = 'block'; nub.style.left = `${ox}px`; nub.style.top = `${oy}px`;
    nubDot.style.transform = 'translate(0,0)';
  }, { passive: false });
  pad.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      const dx = clamp((t.clientX - ox) / 46, -1, 1), dy = clamp((t.clientY - oy) / 46, -1, 1);
      const m = Math.hypot(dx, dy);
      const k = m > 1 ? 1 / m : 1;
      G.input.setAxis(Math.abs(dx) < 0.18 ? 0 : dx * k, Math.abs(dy) < 0.18 ? 0 : dy * k);
      nubDot.style.transform = `translate(${dx * k * 30}px,${dy * k * 30}px)`;
    }
  }, { passive: false });
  for (const ev of ['touchend', 'touchcancel']) pad.addEventListener(ev, (e) => { for (const t of e.changedTouches) if (t.identifier === id) end(); }, { passive: false });

  // show the controls the first time a finger lands anywhere
  window.addEventListener('touchstart', () => { root.classList.add('on'); G.input.device = 'touch'; }, { once: true, passive: true });
  // running is automatic on touch once the stick is pushed most of the way
  G.touch = { root };
}
