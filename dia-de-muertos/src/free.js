// "Make your own ofrenda": choose who to honor (optional and gentle), draw a
// portrait (no photo uploads), then build freely in a quiet room.
import { t, UI as S } from './i18n.js';
import { icon, hydrateIcons } from './icons.js';
import { PAL } from './toon.js';

const KINDS = [
  { id: 'familia', ico: 'heart', name: { en: 'Someone in my family', es: 'Alguien de mi familia' }, sub: { en: 'A grandparent, a relative, an ancestor you\'d like to learn about', es: 'Un abuelo, un familiar, un antepasado que quieras conocer' } },
  { id: 'mascota', ico: 'paw', name: { en: 'A pet', es: 'Una mascota' }, sub: { en: 'Pet ofrendas are a new, popular custom', es: 'Las ofrendas para mascotas son una costumbre nueva y popular' } },
  { id: 'historia', ico: 'book', name: { en: 'A hero from history', es: 'Un personaje de la historia' }, sub: { en: 'Like Mexico\'s school calaverita contest does!', es: '¡Como en el concurso de calaveritas de la SEP!' } },
  { id: 'admiro', ico: 'star', name: { en: 'Someone I admire', es: 'Alguien a quien admiro' }, sub: { en: 'An artist, a scientist, an athlete…', es: 'Una artista, un científico, una atleta…' } },
  { id: 'cuento', ico: 'sparkle', name: { en: 'A character from a story', es: 'Un personaje de un cuento' }, sub: { en: 'Just for practice and fun', es: 'Para practicar y divertirse' } },
];

export function startFree(game) {
  const body = document.createElement('div');
  body.className = 'mg';
  const st = { kind: 'familia', name: '' };
  const m = game.ui.modal({ title: S.freeMode, ico: 'heart', body, cls: 'wide' });
  const render = () => {
    body.innerHTML = `
      <p style="font-weight:800;margin:0">${t({ en: 'Who would you like to honor? This is completely up to you.', es: '¿A quién te gustaría honrar? Tú decides.' })}</p>
      <div class="choicegrid">${KINDS.map((k) => `<button type="button" class="bigchoice${st.kind === k.id ? ' on' : ''}" data-k="${k.id}">${icon(k.ico)}<b>${t(k.name)}</b><span>${t(k.sub)}</span></button>`).join('')}</div>
      <div class="row" style="align-items:center"><b>${t({ en: 'Their name:', es: 'Su nombre:' })}</b><input class="inp" maxlength="24" style="max-width:320px" value="${st.name.replace(/"/g, '')}" placeholder="${t({ en: 'Type a name', es: 'Escribe un nombre' })}"></div>
      <div class="gentle">${t({ en: 'Remembering someone can bring up big feelings. It\'s okay to feel sad, happy, or both — or nothing in particular. You can always talk to a grown-up you trust.', es: 'Recordar a alguien puede traer sentimientos grandes. Está bien sentir tristeza, alegría o las dos cosas, o nada en especial. Siempre puedes platicar con un adulto de confianza.' })}</div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn rosa" data-a="go">${icon('pencil')} ${t({ en: 'Next: draw their portrait', es: 'Siguiente: dibuja su retrato' })}</button></div>`;
    hydrateIcons(body);
    body.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { st.kind = b.dataset.k; game.sfx('tap'); render(); }; });
    const inp = body.querySelector('input');
    inp.oninput = () => { st.name = inp.value; };
    body.querySelector('[data-a=go]').onclick = async () => {
      st.name = inp.value.trim() || t({ en: 'Someone special', es: 'Alguien especial' });
      m.close();
      const portrait = await drawPortrait(game, st);
      if (!portrait) return;
      game.go('free', { honoree: { ...st, portrait } });
    };
  };
  render();
}

// a small drawing pad; returns a data URL (or null if cancelled)
export function drawPortrait(game, st) {
  return new Promise((resolve) => {
    const body = document.createElement('div');
    body.className = 'mg';
    const cv = document.createElement('canvas');
    cv.width = 400; cv.height = 520;
    cv.className = 'board';
    cv.style.width = '260px';
    const ctx = cv.getContext('2d');
    const bg = () => {
      const g = ctx.createLinearGradient(0, 0, 0, 520);
      g.addColorStop(0, '#f6d7a8'); g.addColorStop(1, '#e9b07a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 400, 520);
    };
    bg();
    const pen = { color: '#2a1a14', size: 8 };
    const colors = ['#2a1a14', '#7a4a2a', '#c48d62', '#e4007c', '#ff9a0d', '#ffc21a', '#16b3ac', '#2357d1', '#7b3fbf', '#3e9b4f', '#ffffff'];
    body.innerHTML = `<div class="row"><div class="cv"></div><div style="flex:1;min-width:220px">
      <p style="font-weight:800;margin-top:0">${t({ en: 'Draw {name}! It doesn\'t have to be perfect — it\'s from the heart.', es: '¡Dibuja a {name}! No tiene que ser perfecto: es de corazón.' }, { name: st.name })}</p>
      <div class="swatches">${colors.map((c) => `<button type="button" class="swatch${c === pen.color ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <div class="swatches" style="margin-top:8px">
        <button type="button" class="tool" data-s="4">${t({ en: 'Thin', es: 'Delgado' })}</button>
        <button type="button" class="tool on" data-s="8">${t({ en: 'Medium', es: 'Mediano' })}</button>
        <button type="button" class="tool" data-s="18">${t({ en: 'Thick', es: 'Grueso' })}</button>
      </div>
      <p style="font-weight:800">${t({ en: 'Or start with a symbol:', es: 'O empieza con un símbolo:' })}</p>
      <div class="swatches">
        <button type="button" class="tool" data-y="heart">${t({ en: 'Heart', es: 'Corazón' })}</button>
        <button type="button" class="tool" data-y="flower">${t({ en: 'Marigold', es: 'Cempasúchil' })}</button>
        <button type="button" class="tool" data-y="paw">${t({ en: 'Paw', es: 'Huellita' })}</button>
        <button type="button" class="tool" data-y="star">${t({ en: 'Star', es: 'Estrella' })}</button>
      </div>
      <div class="row" style="margin-top:12px"><button type="button" class="btn cream small" data-a="clear">${icon('eraser')} ${t({ en: 'Clear', es: 'Borrar' })}</button>
      <button type="button" class="btn rosa" data-a="done">${icon('check')} ${t(S.done)}</button></div></div></div>`;
    body.querySelector('.cv').appendChild(cv);
    const m = game.ui.modal({ title: { en: 'Draw a portrait', es: 'Dibuja un retrato' }, ico: 'pencil', body, cls: 'wide', onClose: (v) => resolve(v || null) });
    body.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { pen.color = b.dataset.c; body.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); }; });
    body.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => { pen.size = +b.dataset.s; body.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b)); }; });
    body.querySelectorAll('[data-y]').forEach((b) => { b.onclick = () => { symbol(ctx, b.dataset.y); game.sfx('sparkle'); }; });
    body.querySelector('[data-a=clear]').onclick = () => { bg(); game.sfx('brush'); };
    body.querySelector('[data-a=done]').onclick = () => {
      // the name, written along the bottom like a photo label
      ctx.fillStyle = 'rgba(255,250,240,0.92)';
      ctx.fillRect(20, 450, 360, 52);
      ctx.fillStyle = PAL.purple;
      ctx.font = "32px 'Lilita One', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(st.name.slice(0, 22), 200, 488);
      m.close(cv.toDataURL('image/png'));
    };
    let last = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 400, y: (e.clientY - r.top) / r.height * 520 }; };
    cv.addEventListener('pointerdown', (e) => { last = pos(e); cv.setPointerCapture(e.pointerId); dot(last); });
    cv.addEventListener('pointermove', (e) => {
      if (!last) return;
      const p = pos(e);
      ctx.strokeStyle = pen.color; ctx.lineWidth = pen.size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p;
    });
    cv.addEventListener('pointerup', () => { last = null; });
    const dot = (p) => { ctx.fillStyle = pen.color; ctx.beginPath(); ctx.arc(p.x, p.y, pen.size / 2, 0, Math.PI * 2); ctx.fill(); };
    hydrateIcons(body);
  });
}

function symbol(ctx, kind) {
  ctx.save();
  ctx.translate(200, 230);
  if (kind === 'heart') {
    ctx.fillStyle = PAL.rosa;
    ctx.beginPath(); ctx.moveTo(0, 110);
    ctx.bezierCurveTo(-200, -10, -90, -150, 0, -50);
    ctx.bezierCurveTo(90, -150, 200, -10, 0, 110);
    ctx.fill();
  } else if (kind === 'flower') {
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? PAL.marigold : PAL.gold;
      const a = (i / 14) * Math.PI * 2;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * 70, Math.sin(a) * 70, 52, 26, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PAL.orange; ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'paw') {
    ctx.fillStyle = '#5a3a2a';
    ctx.beginPath(); ctx.ellipse(0, 40, 80, 65, 0, 0, Math.PI * 2); ctx.fill();
    for (const [x, y] of [[-95, -40], [-40, -100], [40, -100], [95, -40]]) { ctx.beginPath(); ctx.ellipse(x, y, 32, 40, 0, 0, Math.PI * 2); ctx.fill(); }
  } else if (kind === 'star') {
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 60 : 140, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
