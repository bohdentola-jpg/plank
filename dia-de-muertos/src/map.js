// The town map: a hand-drawn (well, code-drawn) Santa María del Lago with a
// marigold-petal trail to wherever the story goes next.
import { t, UI as S } from './i18n.js';
import { icon } from './icons.js';
import { mkCanvas, rng } from './toon.js';

export const PLACES = [
  { id: 'casa', scene: 'home', x: 0.17, y: 0.66, pic: { prop: 'mini-ofrenda', opts: { levels: 2 } }, name: { en: 'Lupita\'s house', es: 'Casa de Lupita' } },
  { id: 'mercado', scene: 'market', x: 0.41, y: 0.78, pic: { prop: 'cempasuchil' }, name: { en: 'The market', es: 'El mercado' } },
  { id: 'panaderia', scene: 'bakery', x: 0.56, y: 0.5, pic: { prop: 'pan' }, name: { en: 'Don Ramón\'s bakery', es: 'Panadería de Don Ramón' } },
  { id: 'taller', scene: 'workshop', x: 0.27, y: 0.36, pic: { prop: 'papelito' }, name: { en: 'Tía Lucía\'s workshop', es: 'Taller de Tía Lucía' } },
  { id: 'plaza', scene: 'plaza', x: 0.76, y: 0.72, pic: { prop: 'catrina' }, name: { en: 'The plaza', es: 'La plaza' } },
  { id: 'panteon', scene: 'cemetery', x: 0.82, y: 0.3, pic: { prop: 'tumba' }, name: { en: 'The panteón', es: 'El panteón' } },
];

const ROADS = [['casa', 'mercado'], ['mercado', 'plaza'], ['mercado', 'panaderia'], ['panaderia', 'taller'], ['panaderia', 'plaza'], ['plaza', 'panteon'], ['casa', 'taller'], ['panaderia', 'panteon']];

export function placeUnlocked(game, id) {
  const f = game.state.flags;
  if (id === 'casa') return true;
  if (id === 'plaza') return !!f.ofrenda;
  if (id === 'panteon') return !!f.plaza;
  return !!f.intro;
}

// where the story wants you next
export function nextPlace(game) {
  const f = game.state.flags;
  if (!f.intro) return 'casa';
  if (!f.ofrenda) {
    const marketDone = ['cempasuchil', 'velas', 'copal', 'fruta'].every((i) => game.hasItem(i))
      && (game.hasItem('calavera-blanca') || game.hasItem('calavera')) && (game.hasItem('papel-china') || game.hasItem('papel'));
    if (!marketDone) return 'mercado';
    if (!f.pan) return 'panaderia';
    if (!f.papel || !f.skull) return 'taller';
    return 'casa';
  }
  if (!f.plaza) return 'plaza';
  if (!f.panteon) return 'panteon';
  if (!f.ending) return 'casa';
  return null;
}

function drawMap(w, h, here, next) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  const r = rng(77);
  const P = Object.fromEntries(PLACES.map((p) => [p.id, [p.x * w, p.y * h]]));
  // meadow
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#9fd387'); g.addColorStop(1, '#86c56d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(40,90,40,0.08)';
    ctx.beginPath(); ctx.arc(r() * w, r() * h, 6 + r() * 16, 0, Math.PI * 2); ctx.fill();
  }
  // the lake along the top
  ctx.fillStyle = '#5aa9dc';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.12);
  for (let x = w; x >= 0; x -= w / 12) ctx.lineTo(x, h * (0.13 + Math.sin(x / w * 7) * 0.03 + (x < w * 0.5 ? 0.02 : 0)));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const x = r() * w, y = r() * h * 0.08 + 8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 12, y - 5, x + 24, y); ctx.stroke();
  }
  // a little island with a canoe
  ctx.fillStyle = '#7fbf6a';
  ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.05, 46, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4426';
  ctx.beginPath(); ctx.ellipse(w * 0.38, h * 0.07, 22, 6, 0.1, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#2a1a14';
  ctx.font = `bold ${Math.round(w / 60)}px 'Nunito', sans-serif`;
  ctx.fillText(t({ en: 'Lake', es: 'Lago' }), w * 0.08, h * 0.06);
  // roads
  ctx.lineCap = 'round';
  for (const [a, b] of ROADS) {
    const [x1, y1] = P[a], [x2, y2] = P[b];
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.08;
    ctx.strokeStyle = '#c9a26b'; ctx.lineWidth = w / 38;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    ctx.strokeStyle = '#e8cf9c'; ctx.lineWidth = w / 52;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
  }
  // little houses and trees
  const houses = ['#f7a8c4', '#ffd86b', '#6fc3e8', '#9ed98b', '#f0b48c', '#c9a0ff'];
  for (let i = 0; i < 46; i++) {
    const x = r() * w, y = h * 0.2 + r() * h * 0.78;
    if (PLACES.some((p) => Math.hypot(p.x * w - x, p.y * h - y) < w * 0.08)) continue;
    if (r() > 0.45) {
      ctx.fillStyle = houses[i % houses.length];
      ctx.fillRect(x - 9, y - 7, 18, 14);
      ctx.fillStyle = '#b8502e';
      ctx.fillRect(x - 10, y - 10, 20, 4);
    } else {
      ctx.fillStyle = '#3e8a45';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4fa053';
      ctx.beginPath(); ctx.arc(x - 3, y - 3, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // marigold trail to the next place
  if (here && next && here !== next) {
    const [x1, y1] = P[here], [x2, y2] = P[next];
    const n = Math.floor(Math.hypot(x2 - x1, y2 - y1) / 16);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const x = x1 + (x2 - x1) * k + Math.sin(k * 9) * 6, y = y1 + (y2 - y1) * k + Math.cos(k * 7) * 4;
      ctx.fillStyle = i % 2 ? '#ff9a0d' : '#ffc21a';
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c75e00'; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }
  // compass + town name
  ctx.save();
  ctx.translate(w * 0.93, h * 0.88);
  ctx.fillStyle = '#fff6e4'; ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e4007c';
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.fill();
  ctx.fillStyle = '#2a1a14';
  ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.fill();
  ctx.font = "bold 13px 'Nunito', sans-serif"; ctx.textAlign = 'center';
  ctx.fillText('N', 0, -28);
  ctx.restore();
  ctx.fillStyle = 'rgba(42,26,20,0.82)';
  const label = 'Santa María del Lago · Michoacán';
  ctx.font = `${Math.round(w / 42)}px 'Lilita One', sans-serif`;
  const tw = ctx.measureText(label).width;
  ctx.fillRect(w * 0.03, h * 0.9 - w / 42, tw + 24, w / 42 + 16);
  ctx.fillStyle = '#ffc21a';
  ctx.fillText(label, w * 0.03 + 12, h * 0.9 + 2);
  return cv;
}

export async function openMap(game) {
  const here = (PLACES.find((p) => p.scene === game.sceneId) || {}).id || null;
  const next = nextPlace(game);
  const body = document.createElement('div');
  const wrap = document.createElement('div');
  wrap.className = 'townmap';
  body.appendChild(wrap);
  const cv = drawMap(1280, 800, here, next);
  wrap.appendChild(cv);
  const m = game.ui.modal({ title: S.map, ico: 'map', body, cls: 'wide' });
  for (const p of PLACES) {
    const unlocked = placeUnlocked(game, p.id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `loc${unlocked ? '' : ' locked'}${p.id === here ? ' here' : ''}${p.id === next && p.id !== here ? ' next' : ''}`;
    b.style.left = `${p.x * 100}%`;
    b.style.top = `${p.y * 100}%`;
    b.innerHTML = `<span class="disc"><img alt=""></span><b>${t(p.name)}</b>${unlocked ? '' : `<span class="lk">${icon('lock')}</span>`}`;
    b.title = unlocked ? (p.id === here ? t(S.youAreHere) : t(p.name)) : t(S.locked);
    wrap.appendChild(b);
    game.propImage(p.pic, `map-${p.id}`).then((url) => { b.querySelector('img').src = url; });
    b.onclick = () => {
      if (!unlocked) {
        game.sfx('oops');
        game.ui.toast(t(S.locked), { ico: 'lock' });
        return;
      }
      game.sfx('whoosh');
      m.close();
      if (p.id !== here || game.sceneId !== p.scene) game.go(p.scene);
    };
  }
  game.ui.pulse('#btn-map', false);
}
